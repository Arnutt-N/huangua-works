/**
 * /api/queue — จองคิวนัดช่างและนัดหมาย อบต.หัวงัว (ช่องทางประชาชน, ไม่ต้อง login)
 *
 * GET  ?date=YYYY-MM-DD&category=technician|government → ช่วงว่างของวันแยกตามหมวดหมู่ (คืนเฉพาะว่าง/ไม่ว่าง ไม่มี PII)
 * POST { fullName, phoneNumber, category?, serviceType, note?, villageId?, bookingDate, slot, consent }
 *      → บันทึกการจอง + ตรวจสอบ LIFF session cookie + ส่งการแจ้งเตือนทาง LINE (non-blocking) + เขียน audit row
 *
 * กันจองซ้ำสองชั้น: pre-check ในแอป (ข้อความไทย) + compound partial unique index
 * (category, booking_date, slot) WHERE status <> 'cancelled' กัน race ระดับ DB → 409
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, count, eq, ne, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { isUniqueViolation } from '@/lib/db/errors';
import { generateId } from '@/lib/id';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { parseBody } from '@/lib/api-helpers';
import {
  createQueueBookingSchema,
  queueAvailabilityQuerySchema,
  validateOrError,
  QUEUE_CATEGORY_LABELS,
  QUEUE_SLOT_LABELS,
} from '@/lib/validation';
import { formatThaiDateLong } from '@/lib/thai-date';
import { HUA_NGUA_VILLAGES } from '@/app/queue/villages';
import { buildSlotAvailability } from '@/app/queue/slots';
import { LIFF_SESSION_COOKIE, readLiffSessionValue } from '@/lib/liff/session';
import { pseudonymizeLineId } from '@/lib/line/identity';
import { sendQueueBookingConfirmation } from '@/lib/line/notify/queue-booking-notify';
import { notifyNewQueueBooking } from '@/lib/notify';

function thaiDate(isoDate: string): string {
  return formatThaiDateLong(new Date(`${isoDate}T00:00:00`));
}

export async function GET(req: NextRequest) {
  const v = validateOrError(queueAvailabilityQuerySchema, {
    date: req.nextUrl.searchParams.get('date'),
    category: req.nextUrl.searchParams.get('category') || undefined,
  });
  if (!v.success) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const { date, category } = v.data;

  const db = await getDb();
  const taken = await db
    .select({ slot: queueBookings.slot })
    .from(queueBookings)
    .where(
      and(
        eq(queueBookings.bookingDate, date),
        eq(queueBookings.category, category),
        ne(queueBookings.status, 'cancelled'),
      ),
    );

  return NextResponse.json({
    date,
    dateTh: thaiDate(date),
    category,
    categoryTh: QUEUE_CATEGORY_LABELS[category],
    slots: buildSlotAvailability(taken.map((r) => r.slot)),
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § 10 ครั้ง / 10 นาที ต่อ IP — กันสแปมจองคิว
  const rateLimit = await checkRateLimit(`rate:queue-book:${ip}`, 10, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งคำขอถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 },
    );
  }

  const body = await parseBody(createQueueBookingSchema, req);
  if (!body.ok) return body.response;
  const { fullName, phoneNumber, category, serviceType, note, villageId, bookingDate, slot } = body.data;

  const db = await getDb();

  // § Anti-Abuse: จำกัดไม่เกิน 2 คิวต่อเบอร์โทรศัพท์ที่ยังอยู่ในสถานะจองหรือยืนยัน
  const activeCountRows = await db
    .select({ count: count() })
    .from(queueBookings)
    .where(
      and(
        eq(queueBookings.phoneNumber, phoneNumber),
        or(eq(queueBookings.status, 'booked'), eq(queueBookings.status, 'confirmed')),
      ),
    );
  const activeCount = Number(activeCountRows[0]?.count ?? 0);
  if (activeCount >= 2) {
    return NextResponse.json(
      {
        error:
          'หมายเลขโทรศัพท์นี้มีคิวนัดหมายที่ยังไม่เสร็จสิ้นเกิน 2 รายการ กรุณารอให้คิวเดิมเสร็จสิ้นหรือยกเลิกก่อนทำการจองใหม่',
      },
      { status: 429 },
    );
  }

  // § pre-check เพื่อข้อความไทยที่อ่านรู้เรื่อง — กัน race จริงด้วย compound unique index (category, date, slot)
  const existing = await firstOrUndefined(
    db
      .select({ id: queueBookings.id })
      .from(queueBookings)
      .where(
        and(
          eq(queueBookings.bookingDate, bookingDate),
          eq(queueBookings.slot, slot),
          eq(queueBookings.category, category),
          ne(queueBookings.status, 'cancelled'),
        ),
      )
      .limit(1),
  );
  if (existing) {
    return NextResponse.json(
      {
        error: `วันที่ ${thaiDate(bookingDate)} ช่วง${QUEUE_SLOT_LABELS[slot]} (${QUEUE_CATEGORY_LABELS[category]}) ถูกจองแล้ว กรุณาเลือกช่วงอื่น`,
      },
      { status: 409 },
    );
  }

  // § ดึงตัวตน LINE ที่ผ่านการ verify จาก LIFF session cookie เท่านั้น (ห้ามรับจาก request body)
  const rawCookie = req.cookies.get(LIFF_SESSION_COOKIE)?.value;
  const liffSession = readLiffSessionValue(rawCookie);
  let lineUserIdHash: string | null = null;
  let lineUserIdEnc: string | null = null;

  if (liffSession?.lineUserId) {
    try {
      const pseudo = pseudonymizeLineId(liffSession.lineUserId);
      lineUserIdHash = pseudo.hash;
      lineUserIdEnc = pseudo.enc;
    } catch (err) {
      console.warn('[queue-api] failed to pseudonymize LINE ID', err);
    }
  }

  // ถ้าเลือกหมู่บ้าน ให้ดึงชื่อหมู่บ้านเพื่อแสดงในข้อความแจ้งเตือน
  const villageName = villageId
    ? (HUA_NGUA_VILLAGES.find((v) => v.id === villageId)?.name ?? null)
    : null;

  const id = generateId();
  try {
    await db.insert(queueBookings).values({
      id,
      fullName,
      phoneNumber,
      category,
      serviceType,
      note: note || null,
      villageId: villageId || null,
      bookingDate,
      slot,
      status: 'booked',
      lineUserIdHash,
      lineUserIdEnc,
      lineNotificationStatus: lineUserIdEnc ? 'pending' : null,
    });
  } catch (error) {
    // § ชน unique index (อีกคนจองช่วงเดียวกันพร้อมกัน) → 409 ข้อความเดียวกับ pre-check
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        {
          error: `วันที่ ${thaiDate(bookingDate)} ช่วง${QUEUE_SLOT_LABELS[slot]} (${QUEUE_CATEGORY_LABELS[category]}) ถูกจองแล้ว กรุณาเลือกช่วงอื่น`,
        },
        { status: 409 },
      );
    }
    throw error;
  }

  // § Non-blocking LINE notification dispatch (ไม่บล็อกหรือ rollback HTTP response หาก LINE ล้มเหลว)
  if (lineUserIdEnc) {
    sendQueueBookingConfirmation({
      id,
      fullName,
      phoneNumber,
      category,
      serviceType,
      bookingDate,
      slot,
      note,
      villageName,
      lineUserIdEnc,
    })
      .then(async (sent) => {
        try {
          await db
            .update(queueBookings)
            .set({
              lineNotificationStatus: sent ? 'sent' : 'failed',
              lineNotificationAt: new Date(),
            })
            .where(eq(queueBookings.id, id));
        } catch (err) {
          console.warn('[queue-api] failed to update notification status', err);
        }
      })
      .catch((err) => console.warn('[queue-api] confirmation dispatch failed', err));
  }

  // § Non-blocking Staff notification dispatch (แจ้งเตือนเจ้าหน้าที่ผ่าน Telegram/Discord)
  notifyNewQueueBooking({
    bookingId: id,
    categoryLabel: QUEUE_CATEGORY_LABELS[category],
    serviceType,
    dateTh: thaiDate(bookingDate),
    slotLabel: QUEUE_SLOT_LABELS[slot],
    villageName,
    note: note || null,
  }).catch((err) => console.warn('[queue-api] staff notification dispatch failed', err));

  await logAudit(
    {
      action: AUDIT_ACTIONS.QUEUE_BOOKING_CREATE,
      resource: 'queue_bookings',
      resourceId: id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { bookingDate, slot, category, serviceType, hasLineNotify: !!lineUserIdEnc },
    },
    db,
  );

  return NextResponse.json(
    {
      success: true,
      booking: {
        id,
        bookingDate,
        dateTh: thaiDate(bookingDate),
        slot,
        slotLabel: QUEUE_SLOT_LABELS[slot],
        category,
        categoryLabel: QUEUE_CATEGORY_LABELS[category],
        serviceType,
        hasLineNotification: !!lineUserIdEnc,
      },
    },
    { status: 201 },
  );
}

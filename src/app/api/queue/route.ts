/**
 * /api/queue — จองคิวนัดช่าง (ช่องทางประชาชน, ไม่ต้อง login)
 *
 * GET  ?date=YYYY-MM-DD → ช่วงว่างของวัน (คืนเฉพาะว่าง/ไม่ว่าง ไม่มี PII)
 * POST { fullName, phoneNumber, serviceType, note?, bookingDate, slot, consent }
 *      → บันทึกการจอง + เขียน audit row
 *
 * กันจองซ้ำสองชั้น: pre-check ในแอป (ข้อความไทย) + partial unique index
 * (booking_date, slot) WHERE status <> 'cancelled' กัน race ระดับ DB → 409
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { queueBookings } from '@/lib/db/schema';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { isUniqueViolation } from '@/lib/db/errors';
import { generateId } from '@/lib/id';
import { logAudit, type AuditAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/upstash';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
import { parseBody } from '@/lib/api-helpers';
import {
  createQueueBookingSchema,
  queueAvailabilityQuerySchema,
  validateOrError,
  QUEUE_SLOT_LABELS,
} from '@/lib/validation';
import { formatThaiDateLong } from '@/lib/thai-date';
import { buildSlotAvailability } from '@/app/queue/slots';

// § ชื่อ action สำหรับ audit — ยังไม่ได้ย้ายเข้า AUDIT_ACTIONS (closed map ใน audit.ts)
// เพราะขอบเขตงาน branch นี้ห้ามแตะไฟล์นั้น (กัน conflict ตอนรวม) จึงส่งสตริงตรง
// พร้อม cast; ตอนรวมให้ย้ายสองค่านี้เข้า AUDIT_ACTIONS แล้วลบ cast ทิ้ง
const AUDIT_QUEUE_CREATE = 'queue_booking_create' as AuditAction;

function thaiDate(isoDate: string): string {
  return formatThaiDateLong(new Date(`${isoDate}T00:00:00`));
}

export async function GET(req: NextRequest) {
  const v = validateOrError(queueAvailabilityQuerySchema, {
    date: req.nextUrl.searchParams.get('date'),
  });
  if (!v.success) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const { date } = v.data;

  const db = await getDb();
  const taken = await db
    .select({ slot: queueBookings.slot })
    .from(queueBookings)
    .where(and(eq(queueBookings.bookingDate, date), ne(queueBookings.status, 'cancelled')));

  return NextResponse.json({
    date,
    dateTh: thaiDate(date),
    slots: buildSlotAvailability(taken.map((r) => r.slot)),
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);

  // § 5 ครั้ง / 10 นาที ต่อ IP — กันสแปมจองคิว
  // เรียก checkRateLimit ตรงแทน enforceRateLimit เพราะขอบเขตงาน branch นี้ห้ามแตะ
  // policies.ts (ที่อยู่ของนโยบายกลาง) — fail-open ตาม public path (บริการประชาชน
  // ต้องไม่ล่มตาม Redis); ตอนรวมให้ย้ายเป็น policy กลางแล้วเรียกผ่าน enforceRateLimit
  const rateLimit = await checkRateLimit(`rate:queue-book:${ip}`, 5, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'ส่งคำขอถี่เกินไป กรุณารอ ' + rateLimit.reset + ' วินาที' },
      { status: 429 },
    );
  }

  const body = await parseBody(createQueueBookingSchema, req);
  if (!body.ok) return body.response;
  const { fullName, phoneNumber, serviceType, note, bookingDate, slot } = body.data;

  const db = await getDb();

  // § pre-check เพื่อข้อความไทยที่อ่านรู้เรื่อง — กัน race จริงด้วย unique index
  const existing = await firstOrUndefined(
    db
      .select({ id: queueBookings.id })
      .from(queueBookings)
      .where(
        and(
          eq(queueBookings.bookingDate, bookingDate),
          eq(queueBookings.slot, slot),
          ne(queueBookings.status, 'cancelled'),
        ),
      )
      .limit(1),
  );
  if (existing) {
    return NextResponse.json(
      { error: `วันที่ ${thaiDate(bookingDate)} ช่วง${QUEUE_SLOT_LABELS[slot]} ถูกจองแล้ว กรุณาเลือกช่วงอื่น` },
      { status: 409 },
    );
  }

  const id = generateId();
  try {
    await db.insert(queueBookings).values({
      id,
      fullName,
      phoneNumber,
      serviceType,
      note: note || null,
      bookingDate,
      slot,
      status: 'booked',
    });
  } catch (error) {
    // § ชน unique index (อีกคนจองช่วงเดียวกันพร้อมกัน) → 409 ข้อความเดียวกับ pre-check
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `วันที่ ${thaiDate(bookingDate)} ช่วง${QUEUE_SLOT_LABELS[slot]} ถูกจองแล้ว กรุณาเลือกช่วงอื่น` },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit(
    {
      action: AUDIT_QUEUE_CREATE,
      resource: 'queue_bookings',
      resourceId: id,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
      // § ไม่ใส่ชื่อ–เบอร์ใน audit metadata — เป็น PII อยู่บนแถวการจองแล้ว ไม่ต้องซ้ำ
      metadata: { bookingDate, slot, serviceType },
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
        serviceType,
      },
    },
    { status: 201 },
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { checkRateLimit } from '@/lib/upstash';
import { parseBody } from '@/lib/api-helpers';
import { liffSessionSchema } from '@/lib/validation';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { verifyLineIdToken, type VerifiedLineIdentity } from '@/lib/liff/verify-line-id-token';
import {
  LIFF_SESSION_COOKIE,
  LIFF_SESSION_TTL_SECONDS,
  createLiffSessionValue,
  readLiffSessionValue,
} from '@/lib/liff/session';

/**
 * POST /api/liff/session — แลก LINE ID token เป็น session cookie (HttpOnly)
 * GET /api/liff/session — เช็คสถานะ session สำหรับ provider ฝั่ง client
 * DELETE /api/liff/session — ออกจากระบบ (ล้าง cookie)
 */

export const runtime = 'nodejs';

/**
 * upsert lineUsers + users แล้วคืน linkedUserId
 *
 * § เจ้าของความสัมพันธ์ line↔users เพียงจุดเดียวของระบบ — ก่อนหน้านี้ไม่มีใคร
 * เขียน linkedUserId เลย ทำให้แจ้งผ่านบอทครั้งที่ 2 ชน unique(users.email) และ
 * "เรื่องของฉัน" มองไม่เห็นเคสของบอท (ดู docs/prp-liff-mobile.md §1.2)
 */
async function linkLineIdentity(identity: VerifiedLineIdentity): Promise<string> {
  const db = await getDb();
  const lineEmail = `line-${identity.lineUserId}@placeholder.local`;

  const existingLineUser = await firstOrUndefined(
    db.select().from(lineUsers).where(eq(lineUsers.lineUserId, identity.lineUserId)).limit(1),
  );

  // reuse row เดิมก่อนสร้างใหม่เสมอ — กันชน unique(users.email) จากการ login ซ้ำ/แข่งกัน
  let userId = existingLineUser?.linkedUserId ?? undefined;
  if (!userId) {
    const existingUser = await firstOrUndefined(
      db.select({ id: users.id }).from(users).where(eq(users.email, lineEmail)).limit(1),
    );
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const newId = generateId();
      try {
        await db.insert(users).values({
          id: newId,
          email: lineEmail,
          role: 'citizen',
          isActive: true,
          fullName: identity.displayName || 'ผู้ใช้ LINE',
          metadata: JSON.stringify({ source: 'liff_session' }),
        });
        userId = newId;
      } catch {
        // login สอง tab พร้อมกัน — อีก request สร้างไปก่อนแล้ว ใช้ของมัน
        const raced = await firstOrUndefined(
          db.select({ id: users.id }).from(users).where(eq(users.email, lineEmail)).limit(1),
        );
        if (!raced) throw new Error('สร้างบัญชีผู้ใช้ LINE ไม่สำเร็จ');
        userId = raced.id;
      }
    }
  }

  if (existingLineUser) {
    await db
      .update(lineUsers)
      .set({
        linkedUserId: userId,
        ...(identity.displayName ? { displayName: identity.displayName } : {}),
        ...(identity.pictureUrl ? { pictureUrl: identity.pictureUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(lineUsers.id, existingLineUser.id));
  } else {
    const lineUserIdRow = generateId();
    try {
      await db.insert(lineUsers).values({
        id: lineUserIdRow,
        lineUserId: identity.lineUserId,
        displayName: identity.displayName ?? null,
        pictureUrl: identity.pictureUrl ?? null,
        linkedUserId: userId,
        metadata: { profileCheckedAt: new Date().toISOString() },
      });
    } catch {
      // unique(line_users.line_user_id) แพ้ race — ยอมแพ้แล้วเขียน link ผ่าน update แทน
      await db
        .update(lineUsers)
        .set({ linkedUserId: userId, updatedAt: new Date() })
        .where(eq(lineUsers.lineUserId, identity.lineUserId));
    }
  }

  return userId;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // § failOpen: false — path นี้คือการยืนยันตัวตน Redis ล่มต้องปิด กัน brute ไม่จำกัด
  const rateLimit = await checkRateLimit(`rate:liff-session:${ip}`, 5, 300, { failOpen: false });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `พยายามบ่อยเกินไป กรุณารอ ${rateLimit.reset} วินาที` },
      { status: 429 },
    );
  }

  const parsed = await parseBody(liffSessionSchema, req);
  if (!parsed.ok) return parsed.response;

  let identity: VerifiedLineIdentity;
  try {
    identity = await verifyLineIdToken(parsed.data.idToken);
  } catch {
    // ไม่ leak รายละเอียด error ออกไป — บอกเท่าที่ผู้ใช้ต้องรู้
    return NextResponse.json({ error: 'ยืนยันตัวตนผ่าน LINE ไม่สำเร็จ' }, { status: 401 });
  }

  const userId = await linkLineIdentity(identity);

  await logAudit({
    userId,
    action: AUDIT_ACTIONS.LIFF_LOGIN,
    resource: 'auth',
    resourceId: identity.lineUserId,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: { via: 'liff_session' },
  });

  const res = NextResponse.json({ ok: true, displayName: identity.displayName ?? null });
  res.cookies.set(LIFF_SESSION_COOKIE, createLiffSessionValue(identity.lineUserId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LIFF_SESSION_TTL_SECONDS,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const session = readLiffSessionValue(req.cookies.get(LIFF_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LIFF_SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

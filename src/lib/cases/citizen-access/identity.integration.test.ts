import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { resolveCitizen } from './index';

/**
 * resolveCitizen — ตัวตนของประชาชนจุดเดียว (แทน resolveSubmitter ใน intake.ts และ
 * linkLineIdentity ใน /api/liff/session) รันกับ Postgres จริง:
 *   docker compose up -d postgres redis up-redis
 */

const RUN = Date.now();
const CID = `it-ca-cid-${RUN}`;
const OTHER_CID = `it-ca-cid-other-${RUN}`;
const LINE_NEW = `U-it-ca-new-${RUN}`;
const LINE_LINKED = `U-it-ca-linked-${RUN}`;
const LINE_RACE = `U-it-ca-race-${RUN}`;
const STAFF_EMAIL = `it-ca-staff-${RUN}@placeholder.local`;

const createdUserIds = new Set<string>();
const createdLineIds = [LINE_NEW, LINE_LINKED, LINE_RACE];

function track(id: string): string {
  createdUserIds.add(id);
  return id;
}

/** users.metadata ถูกเขียนด้วย JSON.stringify (คงพฤติกรรมเดิม) — อ่านกลับได้ทั้งสองแบบ */
function parseMeta(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return (value ?? {}) as Record<string, unknown>;
}

afterAll(async () => {
  const db = await getDb();
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, createdLineIds));
  if (createdUserIds.size > 0) {
    await db.delete(users).where(inArray(users.id, [...createdUserIds]));
  }
  await closeDb();
});

describe('resolveCitizen · ผู้แจ้งทางเว็บ (CID)', () => {
  test('CID เดิม → user เดิม, CID ต่างกัน → user คนละคน', async () => {
    const first = track(await resolveCitizen({ kind: 'cid', cid: CID, fullName: 'สมชาย ทดสอบ' }));
    const again = await resolveCitizen({ kind: 'cid', cid: CID });
    const other = track(await resolveCitizen({ kind: 'cid', cid: OTHER_CID }));

    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  test('§ email ที่กรอกไม่ใช่ identity — ไม่ผูกกับบัญชีที่มี email นั้นอยู่แล้ว แต่เก็บเป็นช่องทางติดต่อ', async () => {
    const db = await getDb();
    const staffId = track(generateId());
    await db.insert(users).values({
      id: staffId,
      email: STAFF_EMAIL,
      role: 'officer',
      isActive: true,
      fullName: 'เจ้าหน้าที่ทดสอบ',
    });

    const citizenId = track(
      await resolveCitizen({ kind: 'cid', cid: `${CID}-contact`, contactEmail: STAFF_EMAIL }),
    );

    expect(citizenId).not.toBe(staffId);
    const [row] = await db.select().from(users).where(eq(users.id, citizenId)).limit(1);
    expect(row?.role).toBe('citizen');
    expect(row?.email).not.toBe(STAFF_EMAIL);
    expect(parseMeta(row?.metadata)).toMatchObject({ source: 'web_intake', contactEmail: STAFF_EMAIL });
  });
});

describe('resolveCitizen · ผู้ใช้ LINE', () => {
  test('LINE ใหม่ → สร้าง users + line_users ที่ผูกกัน และเรียกซ้ำได้ id เดิม', async () => {
    const db = await getDb();
    const first = track(
      await resolveCitizen({ kind: 'line', lineUserId: LINE_NEW, source: 'line_intake' }),
    );
    const again = await resolveCitizen({ kind: 'line', lineUserId: LINE_NEW, source: 'line_intake' });

    expect(again).toBe(first);
    const [lineRow] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_NEW)).limit(1);
    expect(lineRow?.linkedUserId).toBe(first);
    const [userRow] = await db.select().from(users).where(eq(users.id, first)).limit(1);
    expect(userRow?.fullName).toBe('ผู้ใช้ LINE');
  });

  test('line_users ที่ผูกแล้ว → คืน linkedUserId เดิม และอัปเดตโปรไฟล์ที่ส่งมา', async () => {
    const db = await getDb();
    const ownerId = track(generateId());
    await db.insert(users).values({
      id: ownerId,
      email: `it-ca-linked-owner-${RUN}@placeholder.local`,
      role: 'citizen',
      isActive: true,
      fullName: 'เจ้าของเดิม',
    });
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserId: LINE_LINKED,
      displayName: 'ชื่อเก่า',
      linkedUserId: ownerId,
    });

    const resolved = await resolveCitizen({
      kind: 'line',
      lineUserId: LINE_LINKED,
      fullName: 'ชื่อใหม่',
      profile: { displayName: 'ชื่อใหม่', pictureUrl: 'https://profile.line-scdn.net/it-ca' },
      source: 'liff_session',
    });

    expect(resolved).toBe(ownerId);
    const [lineRow] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_LINKED)).limit(1);
    expect(lineRow?.displayName).toBe('ชื่อใหม่');
    expect(lineRow?.pictureUrl).toBe('https://profile.line-scdn.net/it-ca');
  });

  test('§ เรียกพร้อมกันสองครั้ง (login สอง tab) → ได้ user เดียว ไม่พังที่ unique index', async () => {
    const [a, b] = await Promise.all([
      resolveCitizen({ kind: 'line', lineUserId: LINE_RACE, source: 'liff_session' }),
      resolveCitizen({ kind: 'line', lineUserId: LINE_RACE, source: 'liff_session' }),
    ]);
    track(a);
    track(b);

    expect(a).toBe(b);
  });
});

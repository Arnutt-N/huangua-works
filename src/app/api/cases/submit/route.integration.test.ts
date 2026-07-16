import { eq, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { cases, categories, consentRecords, dedupHashes, users } from '@/lib/db/schema';
import { generateCidHash } from '@/lib/cid-hmac';
import { POST } from './route';

/**
 * Integration test — ต้องมี local Postgres + Redis stack
 * (`docker compose up -d postgres redis up-redis`) รันอยู่จริง ยิงผ่าน route handler ตรง
 * (ไม่ผ่าน pnpm dev) แต่คุยกับ Postgres/Redis ของจริง ไม่ mock
 *
 * ip แต่ละ test derive จาก Date.now() ตอนไฟล์นี้ load เพื่อไม่ให้ rate-limit
 * ค้างข้ามการรันซ้ำ (5 นาที window) — เลข offset คงที่แค่กันชนกันเองภายในรันเดียว
 */
const RUN_SEED = (Date.now() % 200) + 10;
function testIp(offset: number): string {
  return `203.0.113.${((RUN_SEED + offset) % 250) + 1}`;
}

const VALID_CID = '1101200563040';
// email ใช้ HMAC hash ของ CID (ตรงกับที่ route สร้าง) — ไม่ฝัง plaintext CID
const TEST_EMAIL = `cid-${generateCidHash(VALID_CID)}@placeholder.local`;
// CID อื่นสำหรับทดสอบ consent rejection (ใช้ email ต่างกัน และ checksum ถูกต้อง)
const NO_CONSENT_CID = '1101400170025';

const createdCaseIds: string[] = [];
const createdUserEmails: string[] = [TEST_EMAIL, `cid-${generateCidHash(NO_CONSENT_CID)}@placeholder.local`];

function buildRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cases/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

let categoryId: string;

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `pnpm db:seed` ก่อน');
  categoryId = category.id;
});

afterAll(async () => {
  const db = await getDb();
  if (createdCaseIds.length > 0) {
    await db.delete(dedupHashes).where(inArray(dedupHashes.caseId, createdCaseIds));
    await db.delete(cases).where(inArray(cases.id, createdCaseIds));
  }
  // § ล้าง consent records ของ users ที่ทดสอบสร้างขึ้น (ใช้ email LIKE prefix)
  await db.delete(consentRecords).where(inArray(consentRecords.userId,
    (await db.select({ id: users.id }).from(users).where(inArray(users.email, createdUserEmails))).map(u => u.id)
  ));
  await db.delete(users).where(inArray(users.email, createdUserEmails));
  await closeDb();
});

describe('POST /api/cases/submit', () => {
  test('valid submission returns 201 with a caseId and trackingCode', async () => {
    const res = await POST(
      buildRequest(
        {
          cid: VALID_CID,
          fullName: 'ทดสอบ Integration',
          categoryId,
          title: `ทดสอบ submit สำเร็จ ${Date.now()}`,
          description: 'รายละเอียดทดสอบ submit สำเร็จ',
          location: 'ทดสอบ ตำบลหัวงัว',
          consent: true,
        },
        testIp(1)
      )
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.caseId).toBe('string');
    expect(body.trackingCode).toMatch(/^HN\d{9}$/);
    createdCaseIds.push(body.caseId);
  });

  test('rejects an invalid CID with 400', async () => {
    const res = await POST(
      buildRequest(
        {
          cid: '1234567890123', // wrong checksum
          fullName: 'ทดสอบ',
          categoryId,
          title: 'หัวเรื่องทดสอบ',
          description: 'รายละเอียดทดสอบ',
          location: 'ทดสอบ',
          consent: true,
        },
        testIp(2)
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('บัตรประชาชน');
  });

  test('rejects a missing required field with 400', async () => {
    const res = await POST(
      buildRequest(
        {
          cid: VALID_CID,
          fullName: 'ทดสอบ',
          categoryId,
          title: '', // missing
          description: 'รายละเอียดทดสอบ',
          location: 'ทดสอบ',
          consent: true,
        },
        testIp(3)
      )
    );

    expect(res.status).toBe(400);
  });

  test('rejects malformed JSON with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/cases/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp(4) },
      body: '{not valid json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('rejects a non-existent categoryId with 400', async () => {
    const res = await POST(
      buildRequest(
        {
          cid: VALID_CID,
          fullName: 'ทดสอบ',
          categoryId: 'not-a-real-category-id',
          title: `ทดสอบ category ผิด ${Date.now()}`,
          description: 'รายละเอียดทดสอบ',
          location: 'ทดสอบ',
          consent: true,
        },
        testIp(5)
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('หมวดหมู่');
  });

  test('rejects a duplicate submission (same cid+title+description within 7 days) with 409', async () => {
    const payload = {
      cid: VALID_CID,
      fullName: 'ทดสอบ',
      categoryId,
      title: `ทดสอบ dedup ${Date.now()}`,
      description: 'รายละเอียดทดสอบ dedup',
      location: 'ทดสอบ',
      consent: true,
    };

    const first = await POST(buildRequest(payload, testIp(6)));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    createdCaseIds.push(firstBody.caseId);

    const second = await POST(buildRequest(payload, testIp(6)));
    expect(second.status).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.existingCaseId).toBe(firstBody.caseId);
  });

  test('rate-limits after 3 requests from the same IP within the window', async () => {
    const ip = testIp(7);
    const makePayload = (n: number) => ({
      cid: VALID_CID,
      fullName: 'ทดสอบ',
      categoryId,
      title: `ทดสอบ rate limit ${Date.now()}-${n}`,
      description: `รายละเอียดทดสอบ rate limit ${n}`,
      location: 'ทดสอบ',
      consent: true,
    });

    for (let i = 0; i < 3; i++) {
      const res = await POST(buildRequest(makePayload(i), ip));
      expect(res.status).toBe(201);
      const body = await res.json();
      createdCaseIds.push(body.caseId);
    }

    const fourth = await POST(buildRequest(makePayload(3), ip));
    expect(fourth.status).toBe(429);
  });

  // ─── PDPA enforcement tests ────────────────────────────────────────────

  test('rejects submission without consent with 400', async () => {
    const res = await POST(
      buildRequest(
        {
          cid: NO_CONSENT_CID,
          fullName: 'ทดสอบไม่ยินยอม',
          categoryId,
          title: `ทดสอบ reject ไม่ยินยอม ${Date.now()}`,
          description: 'รายละเอียดทดสอบ',
          location: 'ทดสอบ',
          consent: false,
        },
        testIp(8)
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ยินยอม');
  });

  test('records a consent record after successful submission', async () => {
    // § ใช้ CID ที่ submit สำเร็จไปแล้วใน test แรก (VALID_CID) — consent record ต้องถูกเขียน
    const db = await getDb();
    const userRows = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);
    const user = userRows[0];
    expect(user).toBeDefined();
    if (!user) return; // type guard (expect ข้างบนจะ fail ก่อน)

    const consents = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.userId, user.id));

    expect(consents.length).toBeGreaterThan(0);
    expect(consents.some((c) => c.isGranted === true && c.consentType === 'data_collection')).toBe(true);
  });

  test('does NOT store plaintext CID in user metadata or email', async () => {
    const db = await getDb();
    const userRows = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);
    const user = userRows[0];
    expect(user).toBeDefined();
    if (!user) return; // type guard (expect ข้างบนจะ fail ก่อน)

    // § email ต้องไม่มี plaintext CID
    expect(user.email).not.toContain(VALID_CID);

    // § metadata ต้องไม่มี plaintext CID
    const metadata = user.metadata as Record<string, unknown> | null;
    if (metadata) {
      expect(JSON.stringify(metadata)).not.toContain(VALID_CID);
      expect(metadata.cid).toBeUndefined();
    }
  });
});

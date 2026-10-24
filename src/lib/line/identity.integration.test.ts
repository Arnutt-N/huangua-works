import { describe, expect, it, vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest';
import { pseudonymizeLineId, lookupHash, findLineUserByRaw, resolveRawLineId } from './identity';
import { getDb, closeDb } from '@/lib/db';
import { lineUsers } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';

// § ชุด resolver แตะ DB จริง (Postgres :5433) — ต้องตั้งชื่อไฟล์ *.integration.test.ts
// ให้รันตอน Docker stack ขึ้นเท่านั้น (เดิมอยู่ใน identity.test.ts ตัวเดียว ทำ unit run หัวทุกครั้ง)

const TEST_KEY = 'test-line-id-hmac-key-0123456789abcdef';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('identity resolver (integration)', () => {
  const RAW = `U-resolver-${Date.now()}`;
  let pk: string;

  beforeEach(() => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
  });

  beforeAll(async () => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
    const db = await getDb();
    const p = pseudonymizeLineId(RAW);
    pk = generateId();
    await db.insert(lineUsers).values({
      id: pk,
      lineUserIdHash: p.hash,
      lineUserIdEnc: p.enc,
      lineUserIdHashV: p.v,
    });
  });

  afterAll(async () => {
    const db = await getDb();
    await db.delete(lineUsers).where(eq(lineUsers.id, pk));
    vi.unstubAllEnvs();
    await closeDb();
  });

  it('findLineUserByRaw หาเจอจาก hash ไม่แตะ plaintext', async () => {
    const db = await getDb();
    const row = await findLineUserByRaw(db, RAW);
    expect(row).toBeDefined();
    expect(row!.id).toBe(pk);
    expect(row!.lineUserIdHash).toBe(lookupHash(RAW));
  });

  it('resolveRawLineId ถอด enc ได้ raw เดิม', async () => {
    const db = await getDb();
    const raw = await resolveRawLineId(db, pk);
    expect(raw).toBe(RAW);
  });

  it('resolveRawLineId คืน null เมื่อไม่มีแถว', async () => {
    const db = await getDb();
    expect(await resolveRawLineId(db, 'nonexistent-pk')).toBeNull();
  });
});

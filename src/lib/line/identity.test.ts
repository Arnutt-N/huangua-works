import { describe, expect, it, vi, afterEach, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  pseudonymizeLineId,
  lookupHash,
  decryptLineId,
  assertLineIdKeyUsable,
  findLineUserByRaw,
  resolveRawLineId,
  LINE_ID_HASH_VERSION,
} from './identity';
import { getDb, closeDb } from '@/lib/db';
import { lineUsers } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { eq } from 'drizzle-orm';

const TEST_KEY = 'test-line-id-hmac-key-0123456789abcdef';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('line identity pseudonym', () => {
  it('hash เดิมซ้ำได้ และ enc ถอดกลับได้ id เดิม', () => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
    const a = pseudonymizeLineId('Uabc123');
    const b = pseudonymizeLineId('Uabc123');
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toBe(lookupHash('Uabc123'));
    expect(a.v).toBe(LINE_ID_HASH_VERSION);
    expect(decryptLineId(a.enc)).toBe('Uabc123');
  });

  it('id ต่างกันได้ hash ต่างกัน', () => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
    expect(pseudonymizeLineId('Uaaa').hash).not.toBe(pseudonymizeLineId('Ubbb').hash);
  });

  it('เปลี่ยน key แล้ว hash ไม่ตรงกัน (ไม่เอา key ปน)', () => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
    const h1 = lookupHash('Uabc123');
    vi.stubEnv('LINE_ID_HMAC_KEY', 'another-line-id-key-0123456789abcdef');
    expect(lookupHash('Uabc123')).not.toBe(h1);
  });

  it('production ไม่มี key ต้อง throw ไม่ fallback เงียบ', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LINE_ID_HMAC_KEY', '');
    expect(() => assertLineIdKeyUsable()).toThrow(/LINE_ID_HMAC_KEY/);
    expect(() => lookupHash('Uabc123')).toThrow(/LINE_ID_HMAC_KEY/);
  });
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

import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { generateCidHash, generateDedupHash, generateLegacyDedupHash, legacyDedupPayload, normalizeDedupPayload, verifyDedupHash } from './cid-hmac';

describe('generateCidHash', () => {
  test('produces a 16-char lowercase hex string (truncated HMAC)', () => {
    const hash = generateCidHash('1101200563040');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test('is deterministic for identical CID', () => {
    expect(generateCidHash('1101200563040')).toBe(generateCidHash('1101200563040'));
  });

  test('changes when cid changes', () => {
    expect(generateCidHash('1101200563040')).not.toBe(generateCidHash('1101200563041'));
  });

  test('does NOT leak plaintext CID (substring check)', () => {
    const cid = '1101200563040';
    const hash = generateCidHash(cid);
    // hash เป็น hex อย่างเดียว ไม่มีตัวเลข CID ฝังอยู่
    expect(hash).not.toContain(cid);
    expect(hash).not.toContain('1101');
  });
});

describe('generateDedupHash', () => {
  test('produces a 64-char lowercase hex string (SHA-256 digest)', () => {
    const hash = generateDedupHash('1101200563040', 'ถนนชำรุด', 'มีหลุมบ่อ');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic for identical input', () => {
    const a = generateDedupHash('1101200563040', 'title', 'description');
    const b = generateDedupHash('1101200563040', 'title', 'description');
    expect(a).toBe(b);
  });

  test('is case-insensitive (payload is lowercased before hashing)', () => {
    const lower = generateDedupHash('1101200563040', 'title', 'description');
    const upper = generateDedupHash('1101200563040', 'TITLE', 'DESCRIPTION');
    expect(lower).toBe(upper);
  });

  test('changes when cid changes', () => {
    const a = generateDedupHash('1101200563040', 'title', 'description');
    const b = generateDedupHash('1101200563041', 'title', 'description');
    expect(a).not.toBe(b);
  });

  test('changes when title changes', () => {
    const a = generateDedupHash('1101200563040', 'title one', 'description');
    const b = generateDedupHash('1101200563040', 'title two', 'description');
    expect(a).not.toBe(b);
  });

  test('changes when description changes', () => {
    const a = generateDedupHash('1101200563040', 'title', 'description one');
    const b = generateDedupHash('1101200563040', 'title', 'description two');
    expect(a).not.toBe(b);
  });

  test('collapses inner whitespace — ช่องว่างกลางหลบ dedup ไม่ได้', () => {
    const a = generateDedupHash('1101200563040', 'ถนน  ชำรุด', 'มีหลุม\nบ่อ');
    const b = generateDedupHash('1101200563040', 'ถนน ชำรุด', 'มีหลุม บ่อ');
    expect(a).toBe(b);
  });
});

describe('normalizeDedupPayload', () => {
  test('lowercases + ยุบ whitespace + trim', () => {
    expect(normalizeDedupPayload('CID', '  ถนน\n\nชำรุด  ', 'A  B')).toBe('cid|ถนน ชำรุด|a b');
  });
});

describe('legacyDedupPayload · ช่วงเปลี่ยนผ่าน 7 วัน', () => {
  test('สูตรเก่า = lower+trim ปลายอย่างเดียว (whitespace กลางคงเดิม)', () => {
    expect(legacyDedupPayload('CID', '  ถนน\n\nชำรุด  ', 'A  B')).toBe('cid|  ถนน\n\nชำรุด  |a  b');
  });

  test('ข้อความมี whitespace กลาง → hash สูตรเก่า ≠ สูตรใหม่ (จึงต้องเทียบทั้งคู่ — ดู dedup.integration.test.ts)', () => {
    const oldHash = generateLegacyDedupHash('c', 'ถนน  ชำรุด', 'x');
    const newHash = generateDedupHash('c', 'ถนน ชำรุด', 'x');
    expect(oldHash).not.toBe(newHash);
  });

  test('golden: สูตรเก่า = HMAC ของ payload ทั้งก้อน lower+trim (คำนวณอิสระ)', () => {
    const expected = createHmac('sha256', process.env.CID_HMAC_KEY ?? '')
      .update('c|  ถนน  ชำรุด |x'.toLowerCase().trim(), 'utf8')
      .digest('hex');
    expect(generateLegacyDedupHash('c', '  ถนน  ชำรุด ', 'x')).toBe(expected);
  });
});

describe('อ่าน CID_HMAC_KEY สดทุกครั้ง', () => {
  // § import ครั้งเดียว (static ด้านบน) แล้วเปลี่ยน env — ถ้ากลับไปผูก key ตอน import test แรกแดง
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('เปลี่ยน key หลัง import → hash เปลี่ยนตาม', () => {
    vi.stubEnv('CID_HMAC_KEY', 'a'.repeat(32));
    const h1 = generateCidHash('1101200563040');
    vi.stubEnv('CID_HMAC_KEY', 'b'.repeat(32));
    const h2 = generateCidHash('1101200563040');
    expect(h1).not.toBe(h2);
  });

  test('production + key ถูกล้างหลัง import → throw ก่อน hash', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CID_HMAC_KEY', '');
    expect(() => generateCidHash('1101200563040')).toThrow(/CID_HMAC_KEY/);
  });
});

describe('verifyDedupHash', () => {
  test('returns true when the hash matches the given inputs', () => {
    const hash = generateDedupHash('1101200563040', 'title', 'description');
    expect(verifyDedupHash('1101200563040', 'title', 'description', hash)).toBe(true);
  });

  test('returns false when any input no longer matches the hash', () => {
    const hash = generateDedupHash('1101200563040', 'title', 'description');
    expect(verifyDedupHash('1101200563040', 'different title', 'description', hash)).toBe(false);
  });

  test('returns false for a malformed/unrelated hash', () => {
    expect(verifyDedupHash('1101200563040', 'title', 'description', 'not-a-real-hash')).toBe(false);
  });
});

describe('assertKeyUsable — ด่านกัน key ว่างตอน runtime', () => {
  // § reset module + import ใหม่ทุกเคส เพื่อจำลอง process ที่ env ต่างกัน (key อ่านสดอยู่แล้ว —
  // ดู describe 'อ่าน CID_HMAC_KEY สดทุกครั้ง')
  async function loadWith(env: { NODE_ENV?: string; CID_HMAC_KEY?: string }) {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', env.NODE_ENV ?? 'test');
    vi.stubEnv('CID_HMAC_KEY', env.CID_HMAC_KEY ?? '');
    return import('./cid-hmac');
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('throw ใน production เมื่อไม่มี CID_HMAC_KEY', async () => {
    const mod = await loadWith({ NODE_ENV: 'production', CID_HMAC_KEY: '' });

    expect(() => mod.generateCidHash('1101200563040')).toThrow(/CID_HMAC_KEY/);
    expect(() => mod.generateDedupHash('1101200563040', 'a', 'b')).toThrow(/CID_HMAC_KEY/);
  });

  test('throw ใน production เมื่อ key สั้นกว่า 32 ตัว', async () => {
    const mod = await loadWith({ NODE_ENV: 'production', CID_HMAC_KEY: 'x'.repeat(31) });
    expect(() => mod.generateCidHash('1101200563040')).toThrow(/32/);
  });

  test('ผ่านใน production เมื่อ key ยาวพอ', async () => {
    const mod = await loadWith({ NODE_ENV: 'production', CID_HMAC_KEY: 'x'.repeat(32) });
    expect(mod.generateCidHash('1101200563040')).toMatch(/^[0-9a-f]{16}$/);
  });

  test('ไม่ throw นอก production แม้ key ว่าง — dev/test ยังรันได้โดยไม่ต้องตั้ง secret', async () => {
    const mod = await loadWith({ NODE_ENV: 'development', CID_HMAC_KEY: '' });
    expect(mod.generateCidHash('1101200563040')).toMatch(/^[0-9a-f]{16}$/);
  });
});

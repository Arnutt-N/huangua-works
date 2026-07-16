import { describe, expect, test } from 'vitest';
import { generateCidHash, generateDedupHash, verifyDedupHash } from './cid-hmac';

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

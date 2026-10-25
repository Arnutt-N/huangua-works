import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  pseudonymizeLineId,
  lookupHash,
  decryptLineId,
  assertLineIdKeyUsable,
  LINE_ID_HASH_VERSION,
} from './identity';

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

  it('enc ใช้ IV สุ่ม — id เดิมได้ enc ต่างกันทุกครั้ง แต่ถอดกลับได้', () => {
    vi.stubEnv('LINE_ID_HMAC_KEY', TEST_KEY);
    const a = pseudonymizeLineId('Uabc123');
    const b = pseudonymizeLineId('Uabc123');
    expect(a.enc).not.toBe(b.enc);
    expect(decryptLineId(a.enc)).toBe('Uabc123');
    expect(decryptLineId(b.enc)).toBe('Uabc123');
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

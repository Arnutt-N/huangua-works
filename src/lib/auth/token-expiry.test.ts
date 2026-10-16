import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTokenExpired } from './token-expiry';

const NOW_S = 1_800_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_S * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isTokenExpired', () => {
  // § ขอบ: หมดอายุตรงวินาทีพอดีถือว่าหมด (<=) — กันเหลื่อม 1 วิลอด gate
  it.each([
    [NOW_S - 1, true],
    [NOW_S, true],
    [NOW_S + 1, false],
  ])('expiresAt=%i → %s', (expiresAt, expected) => {
    expect(isTokenExpired(expiresAt)).toBe(expected);
  });

  it('ไม่มี claim (undefined) → ไม่ถือว่าหมด', () => {
    expect(isTokenExpired(undefined)).toBe(false);
  });
});

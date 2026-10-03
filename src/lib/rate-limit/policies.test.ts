import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_POLICIES, rateLimitKey, type RateLimitPolicyName } from './policies';

const NAMES = Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[];

describe('RATE_LIMIT_POLICIES · auth path ต้อง fail-closed', () => {
  it('ทุก policy ชนิด auth ปฏิเสธเมื่อ Redis ล่ม', () => {
    // § กติกานี้เคยอยู่แค่ใน § comment ของแต่ละ caller และค่า default ของ
    // checkRateLimit คือ fail-open — ลืมใส่ { failOpen: false } ที่ path ไหน
    // brute-force protection ของ path นั้นหายเงียบ ๆ ทันทีที่ Redis ล่ม
    const authPolicies = NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth');
    for (const name of authPolicies) {
      expect({ name, failClosed: RATE_LIMIT_POLICIES[name].failClosed }).toEqual({ name, failClosed: true });
    }
  });

  it('ชุด auth path ตรงตามที่ตั้งใจ — เพิ่ม/ลบ/เปลี่ยน kind ต้องแก้ test นี้อย่างรู้ตัว', () => {
    const authPolicies = NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth').sort();
    expect(authPolicies).toEqual(
      [
        'adminLoginEmail',
        'adminLoginIp',
        'changePassword',
        'consentWithdraw',
        'liffSession',
        'pwResetComplete',
        'pwResetEmail',
        'pwResetIp',
      ].sort(),
    );
  });

  it('public path เปิดเมื่อ Redis ล่ม — บริการประชาชนต้องไม่ล่มตาม Redis', () => {
    expect(RATE_LIMIT_POLICIES.submit).toMatchObject({ kind: 'public', failClosed: false });
    expect(RATE_LIMIT_POLICIES.track).toMatchObject({ kind: 'public', failClosed: false });
  });
});

describe('RATE_LIMIT_POLICIES · ค่าเท่าเดิมก่อน refactor', () => {
  it.each<[RateLimitPolicyName, number, number]>([
    ['adminLoginIp', 5, 900],
    ['adminLoginEmail', 5, 900],
    ['pwResetIp', 5, 900],
    ['pwResetEmail', 3, 900],
    ['pwResetComplete', 5, 900],
    ['changePassword', 5, 900],
    ['liffSession', 5, 300],
    ['consentWithdraw', 5, 600],
    ['submit', 3, 300],
    ['track', 10, 300],
  ])('%s = %i ครั้ง / %i วินาที', (name, limit, windowSeconds) => {
    expect(RATE_LIMIT_POLICIES[name]).toMatchObject({ limit, windowSeconds });
  });
});

describe('rateLimitKey · รูปแบบ key เหมือนเดิมทุก byte', () => {
  // § key ใน Redis production ที่กำลังนับอยู่ตอน deploy ต้องนับต่อได้ และ e2e ล้าง key ตามชื่อ
  it.each<[RateLimitPolicyName, string, string]>([
    ['adminLoginIp', '::1', 'rate:admin-login:ip:::1'],
    ['adminLoginEmail', 'admin@huangua.go.th', 'rate:admin-login:email:admin@huangua.go.th'],
    ['pwResetIp', '203.0.113.5', 'rate:pw-reset:ip:203.0.113.5'],
    ['pwResetEmail', 'staff@huangua.go.th', 'rate:pw-reset:email:staff@huangua.go.th'],
    ['pwResetComplete', '203.0.113.5', 'rate:pw-reset:complete:203.0.113.5'],
    ['changePassword', 'user-123', 'rate:change-password:user-123'],
    ['liffSession', '::1', 'rate:liff-session:::1'],
    ['consentWithdraw', '203.0.113.5', 'rate:consent-withdraw:203.0.113.5'],
    ['submit', '::1', 'rate:submit:::1'],
    ['track', '203.0.113.5', 'rate:track:203.0.113.5'],
  ])('%s + %s → %s', (name, subject, expected) => {
    expect(rateLimitKey(name, subject)).toBe(expected);
  });
});

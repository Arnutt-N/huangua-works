import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// § ทดสอบ route กับ Postgres จริง แต่บังคับ audit ล้มเพื่อพิสูจน์ tx ของผู้เรียกทั้งเว็บ/LIFF
const control = vi.hoisted(() => ({ failAudit: false, allowed: true, lineId: 'U-withdraw-test' }));
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return { ...actual, logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
    if (control.failAudit) throw new Error('audit insert failed (forced)');
    return actual.logAudit(...args);
  }) };
});
vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: control.allowed, reset: 60 })),
}));
vi.mock('@/lib/liff/session', () => ({
  LIFF_SESSION_COOKIE: 'test-liff',
  readLiffSessionValue: vi.fn((value?: string) => value === 'owner' ? { lineUserId: control.lineId } : null),
}));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, consentRecords, lineUsers, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { generateCidHash } from '@/lib/cid-hmac';
import { CONSENT_VERSION, grantConsent, hasConsent } from '@/lib/consent';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { POST } from './route';

const userId = generateId();
const caseId = generateId();
const lineId = generateId();
const cidBase = '9' + Date.now().toString().slice(-11);
const cid = cidBase + ((11 - [...cidBase].reduce((sum, digit, i) => sum + Number(digit) * (13 - i), 0) % 11) % 10);
const trackingCode = 'HG' + Date.now().toString().slice(-9);
control.lineId = 'U-withdraw-' + lineId;
function request(via: 'web' | 'liff') {
  return new NextRequest('http://localhost:3000/api/consent/withdraw', {
    method: 'POST', body: JSON.stringify({ trackingCode, ...(via === 'web' ? { cid } : {}) }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.27',
      ...(via === 'liff' ? { cookie: 'test-liff=owner' } : {}) },
  });
}
beforeAll(async () => {
  const db = await getDb();
  await db.insert(users).values({ id: userId, email: 'cid-' + generateCidHash(cid) + '@placeholder.local', role: 'citizen', isActive: true, fullName: 'ทดสอบ ถอน consent' });
  await db.insert(lineUsers).values({ id: lineId, lineUserId: control.lineId, linkedUserId: userId });
  await db.insert(cases).values({ id: caseId, title: 'ทดสอบ route ถอน consent', description: 'ทดสอบ tx', location: 'หัวงัว', categoryId: 'test-category', submittedBy: userId, trackingCode });
});
beforeEach(async () => {
  control.failAudit = false; control.allowed = true; vi.mocked(enforceRateLimit).mockClear();
  const db = await getDb();
  await db.delete(consentRecords).where(eq(consentRecords.userId, userId));
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, caseId));
  await grantConsent({ userId, consentType: 'data_collection', version: CONSENT_VERSION });
});
afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, caseId));
  await db.delete(consentRecords).where(eq(consentRecords.userId, userId));
  await db.delete(cases).where(eq(cases.id, caseId));
  await db.delete(lineUsers).where(eq(lineUsers.id, lineId));
  await db.delete(users).where(eq(users.id, userId));
  await closeDb();
});
describe('withdraw route · atomic ก่อน c1', () => {
  test.each(['web', 'liff'] as const)('audit ล้มฝั่ง %s ต้องคง consent เดิม', async (via) => {
    control.failAudit = true;
    await expect(POST(request(via))).rejects.toThrow('audit insert failed (forced)');
    expect(await hasConsent(userId, 'data_collection')).toBe(true);
    const db = await getDb();
    expect(await db.select().from(consentRecords).where(eq(consentRecords.userId, userId))).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseId))).toHaveLength(0);
  });
  test.each(['web', 'liff'] as const)('สำเร็จฝั่ง %s ต้องถอนและ audit พร้อมกัน', async (via) => {
    const response = await POST(request(via));
    expect(response.status).toBe(200);
    expect(await hasConsent(userId, 'data_collection')).toBe(false);
    const db = await getDb();
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadata).toEqual({ trackingCode, via });
  });
  test('คง enforcement c7 ก่อน mutation', async () => {
    control.allowed = false;
    const response = await POST(request('web'));
    expect(response.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith('consentWithdraw', '198.51.100.27');
    expect(await hasConsent(userId, 'data_collection')).toBe(true);
  });
});

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * revokeConsentWithAudit ต้องเขียน consent_records + audit_logs แบบ all-or-nothing
 * เมื่อผู้เรียกเปิด transaction — helper เองห้ามเปิด tx
 * (PDPA: audit ของการถอนความยินยอมต้องตรงกับสถานะความยินยอมจริงเสมอ)
 */
const auditControl = vi.hoisted(() => ({ failNext: false }));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (auditControl.failNext) {
        auditControl.failNext = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, consentRecords, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { hasConsent, revokeConsentWithAudit } from './consent';

let userId: string;
const caseIdRollback = generateId();
const caseIdCommit = generateId();

beforeAll(async () => {
  const db = await getDb();
  userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: `it-consent-withdraw-${userId}@placeholder.local`,
    role: 'citizen',
    isActive: true,
    fullName: 'ทดสอบ ถอนความยินยอม',
  });
});

beforeEach(() => {
  auditControl.failNext = false;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
  await db.delete(consentRecords).where(eq(consentRecords.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await closeDb();
});

describe('revokeConsentWithAudit (integration)', () => {
  test('audit ล้ม → ไม่มี consent_records ถูกเขียน', async () => {
    auditControl.failNext = true;
    const db = await getDb();

    await expect(
      db.transaction((tx) =>
        revokeConsentWithAudit(
          { userId, caseId: caseIdRollback, trackingCode: 'HG000000001', via: 'web' },
          tx,
        ),
      ),
    ).rejects.toThrow('audit insert failed (forced)');

    expect(await db.select().from(consentRecords).where(eq(consentRecords.userId, userId))).toHaveLength(0);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseIdRollback))).toHaveLength(0);
  });

  test('สำเร็จ (liff) → consent ถูกถอน + audit มี metadata เดิม', async () => {
    const db = await getDb();
    await db.transaction((tx) =>
      revokeConsentWithAudit(
        {
          userId,
          caseId: caseIdCommit,
          trackingCode: 'HG000000002',
          via: 'liff',
          ipAddress: '203.0.113.7',
        },
        tx,
      ),
    );

    expect(await hasConsent(userId, 'data_collection')).toBe(false);
    const [consent] = await db.select().from(consentRecords).where(eq(consentRecords.userId, userId));
    expect(consent?.isGranted).toBe(false);
    expect(consent?.metadata).toEqual({ via: 'liff_withdraw', caseId: caseIdCommit, trackingCode: 'HG000000002' });

    const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseIdCommit));
    expect(audit?.action).toBe('consent_withdrawn');
    expect(audit?.ipAddress).toBe('203.0.113.7');
    // § baseline หลัง c2 เก็บ metadata เป็น object ใน jsonb
    expect(audit?.metadata).toEqual({ trackingCode: 'HG000000002', via: 'liff' });
  });
});

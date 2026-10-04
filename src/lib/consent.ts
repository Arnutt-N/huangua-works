/**
 * Consent Manager — PDPA compliance (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)
 * จัดการความยินยอมในการเก็บ/ใช้/เปิดเผยข้อมูล
 */

import { getDb, type DbOrTx } from './db';
import { consentRecords } from './db/schema';
import { generateId } from './id';
import { eq, and, desc } from 'drizzle-orm';
import { AUDIT_ACTIONS, logAudit } from './audit';

export type ConsentType = 'data_collection' | 'data_sharing' | 'marketing';

/**
 * เวอร์ชันนโยบาย PDPA ปัจจุบัน — ใช้ทุกที่ที่บันทึกความยินยอม
 * bump เมื่อมีการเปลี่ยนแปลงนโยบายที่ส่งผลต่อขอบเขตการเก็บ/ใช้ข้อมูล
 *
 * § 1.1 (2569-08-23): เพิ่มขอบเขตการเก็บข้อมูลโปรไฟล์ LINE ผ่าน LIFF
 * (ชื่อที่แสดง, รูปโปรไฟล์, รหัสผู้ใช้ LINE) ดูรายละเอียดใน /privacy
 */
export const CONSENT_VERSION = '1.1';

export interface ConsentGrant {
  userId: string;
  consentType: ConsentType;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * บันทึกความยินยอม
 */
export async function grantConsent(grant: ConsentGrant, db?: DbOrTx): Promise<void> {
  const _db = db ?? await getDb();

  await _db.insert(consentRecords).values({
    id: generateId(),
    userId: grant.userId,
    consentType: grant.consentType,
    version: grant.version,
    isGranted: true,
    grantedAt: new Date(),
    ipAddress: grant.ipAddress,
    userAgent: grant.userAgent,
    metadata: grant.metadata,
  });
}

/**
 * ถอนความยินยอม
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType,
  metadata?: Record<string, unknown>,
  db?: DbOrTx,
): Promise<void> {
  const _db = db ?? await getDb();

  await _db.insert(consentRecords).values({
    id: generateId(),
    userId,
    consentType,
    version: CONSENT_VERSION,
    isGranted: false,
    revokedAt: new Date(),
    metadata,
  });
}

/**
 * ตรวจสอบว่าผู้ใช้ให้ความยินยอมหรือไม่ (ใช้ล่าสุด)
 */
export async function hasConsent(
  userId: string,
  consentType: ConsentType,
  db?: DbOrTx,
): Promise<boolean> {
  const _db = db ?? await getDb();

  const rows = await _db
    .select()
    .from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), eq(consentRecords.consentType, consentType)))
    .orderBy(desc(consentRecords.createdAt))
    .limit(1);

  const latest = rows[0];

  return latest?.isGranted === true;
}

/**
 * ดึงประวัติความยินยอมทั้งหมด
 */
export async function getConsentHistory(userId: string, db?: DbOrTx) {
  const _db = db ?? await getDb();

  return _db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(consentRecords.createdAt);
}

export interface ConsentWithdrawal {
  userId: string;
  caseId: string;
  trackingCode: string;
  via: 'web' | 'liff';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ถอนความยินยอม data_collection พร้อม audit — ต้องถูกเรียกใน tx ที่ผู้เรียกเปิดไว้
 *
 * § ก่อน c1 route เป็นเจ้าของ tx; เมื่อ c1 merge ให้ withdrawCaseConsent เรียก helper นี้ใน tx เดิม
 * ห้ามเปิด transaction ในฟังก์ชันนี้ (จะซ้อน) และห้ามมี withdrawConsent ที่เปิด tx เอง
 * เดิม route เรียก revokeConsent แล้วค่อย logAudit แยกกัน ถ้า audit ล้ม ความยินยอมถูกถอน
 * ไปแล้วแต่ไม่มีหลักฐาน — PDPA ต้องการให้ audit ตรงกับสถานะจริงเสมอ
 * metadata audit มี via ทั้ง web และ liff ให้ตรง test ของ citizen-access
 */
export async function revokeConsentWithAudit(w: ConsentWithdrawal, tx: DbOrTx): Promise<void> {
  await revokeConsent(
    w.userId,
    'data_collection',
    {
      via: w.via === 'liff' ? 'liff_withdraw' : 'web_withdraw',
      caseId: w.caseId,
      trackingCode: w.trackingCode,
    },
    tx,
  );

  await logAudit(
    {
      userId: w.userId,
      action: AUDIT_ACTIONS.CONSENT_WITHDRAWN,
      resource: 'consent',
      resourceId: w.caseId,
      ipAddress: w.ipAddress,
      userAgent: w.userAgent,
      metadata: { trackingCode: w.trackingCode, via: w.via },
    },
    tx,
  );
}

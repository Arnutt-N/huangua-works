/**
 * Consent Manager — PDPA compliance (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)
 * จัดการความยินยอมในการเก็บ/ใช้/เปิดเผยข้อมูล
 */

import { getDb } from './db';
import { consentRecords } from './db/schema';
import { generateId } from './id';
import { eq, and } from 'drizzle-orm';

export type ConsentType = 'data_collection' | 'data_sharing' | 'marketing';

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
export async function grantConsent(grant: ConsentGrant): Promise<void> {
  const db = getDb();

  await db.insert(consentRecords).values({
    id: generateId(),
    userId: grant.userId,
    consentType: grant.consentType,
    version: grant.version,
    isGranted: true,
    grantedAt: new Date(),
    ipAddress: grant.ipAddress,
    userAgent: grant.userAgent,
    metadata: grant.metadata ? JSON.stringify(grant.metadata) : undefined,
  });
}

/**
 * ถอนความยินยอม
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getDb();

  await db.insert(consentRecords).values({
    id: generateId(),
    userId,
    consentType,
    version: '1.0', // current version
    isGranted: false,
    revokedAt: new Date(),
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
}

/**
 * ตรวจสอบว่าผู้ใช้ให้ความยินยอมหรือไม่ (ใช้ล่าสุด)
 */
export async function hasConsent(
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const db = getDb();

  const latest = await db
    .select()
    .from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), eq(consentRecords.consentType, consentType)))
    .orderBy(consentRecords.createdAt)
    .limit(1)
    .get();

  return latest?.isGranted === true;
}

/**
 * ดึงประวัติความยินยอมทั้งหมด
 */
export async function getConsentHistory(userId: string) {
  const db = getDb();

  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(consentRecords.createdAt)
    .all();
}

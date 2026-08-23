import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb, type Db } from '../db';
import { cases, lineUsers } from '../db/schema';
import type { CaseStatus } from './state-machine';

/**
 * "เรื่องของฉัน" — เคสของผู้ใช้ LINE คนหนึ่ง (ใช้ใน /track ฝั่ง LIFF)
 *
 * ผูกผ่าน lineUsers.linkedUserId = cases.submittedBy — การเชื่อมนี้ถูกเขียนโดย
 * /api/liff/session และ resolveSubmitter (สาย line) เท่านั้น
 */

export interface MyCaseItem {
  trackingCode: string;
  status: CaseStatus;
  title: string;
  updatedAt: string; // ISO string — serialize ข้าม server→client boundary ได้
}

interface MyCaseRow {
  trackingCode: string | null;
  status: CaseStatus;
  title: string;
  updatedAt: Date;
}

/**
 * pure mapper — แยกออกมาเพื่อทดสอบ invariant (ตัดเคสเก่าไม่มี trackingCode ทิ้ง)
 * โดยไม่ต้องมี DB
 */
export function toMyCaseItems(rows: MyCaseRow[]): MyCaseItem[] {
  return rows
    .filter((r) => r.trackingCode !== null)
    .map((r) => ({
      trackingCode: r.trackingCode!,
      status: r.status,
      title: r.title,
      updatedAt: r.updatedAt.toISOString(),
    }));
}

export async function getMyCases(lineUserId: string, db?: Db): Promise<MyCaseItem[]> {
  const _db = db ?? (await getDb());

  const rows = await _db
    .select({
      trackingCode: cases.trackingCode,
      status: cases.status,
      title: cases.title,
      updatedAt: cases.updatedAt,
    })
    .from(cases)
    .innerJoin(lineUsers, eq(lineUsers.linkedUserId, cases.submittedBy))
    .where(and(eq(lineUsers.lineUserId, lineUserId), isNotNull(cases.trackingCode)))
    .orderBy(desc(cases.updatedAt))
    .limit(20);

  return toMyCaseItems(rows);
}

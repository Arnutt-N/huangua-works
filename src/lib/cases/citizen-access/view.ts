import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb, type DbOrTx } from '../../db';
import { firstOrUndefined } from '../../db/query-helpers';
import { caseUpdates, cases, categories, lineUsers } from '../../db/schema';
import { AUDIT_ACTIONS, logAudit } from '../../audit';
import { normalizeTrackingCode } from '../../case-tracking';
import type { CaseStatus } from '../state-machine';
import { consentActiveFor } from './consent-policy';

type CaseRow = typeof cases.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type CaseUpdateRow = typeof caseUpdates.$inferSelect;

/** ช่องทางที่ประชาชนใช้ดูเรื่อง — บันทึกเป็น audit metadata.via */
export interface ViewContext {
  channel: 'web' | 'line_bot';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ข้อมูลเรื่องที่ประชาชนเห็นได้ — สถานะ + หัวเรื่อง + หมวด + ไทม์ไลน์ public เท่านั้น
 * § ไม่มี ชื่อ/เบอร์/ที่อยู่/รายละเอียด/เอกสารแนบ/department/submitter/assignedOfficer
 */
export interface TrackedCaseView {
  case: Pick<CaseRow, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority' | 'title' | 'dueDate' | 'closedAt'> & {
    trackingCode: string;
  };
  category: Pick<CategoryRow, 'id' | 'name' | 'icon'> | null;
  updates: Pick<CaseUpdateRow, 'id' | 'createdAt' | 'updateType' | 'oldValue' | 'newValue' | 'comment'>[];
}

/** แถว "เรื่องของฉัน" — updatedAt เป็น ISO string เพื่อข้าม server→client boundary ได้ */
export interface MyCaseItem {
  trackingCode: string;
  status: CaseStatus;
  title: string;
  updatedAt: string;
}

const MY_CASES_LIMIT = 20;

// § คงค่า 'tracking_code' ของเว็บไว้ตามเดิม — audit เก่าใช้ค่านี้ ค้นย้อนหลังได้ต่อเนื่อง
const VIEW_VIA: Record<ViewContext['channel'], string> = {
  web: 'tracking_code',
  line_bot: 'line_bot',
};

/**
 * ค้นเรื่องด้วยเลขติดตามสำหรับประชาชน (ติดตามเรื่องทางเว็บ + บอท LINE)
 * คืน null เหมือนกันทุกกรณี: รูปแบบผิด / ไม่พบ / เรื่องเก่าไม่มีเลข / เจ้าของถอนความยินยอม
 */
export async function findTrackableCase(
  rawCode: string,
  ctx: ViewContext,
  db?: DbOrTx,
): Promise<TrackedCaseView | null> {
  // § format ผิด → null ไม่ใช่ error เพื่อไม่เปิดเผยว่า format ผิด (กัน enumeration)
  const trackingCode = normalizeTrackingCode(rawCode);
  if (!trackingCode) return null;
  const _db = db ?? (await getDb());

  const row = await firstOrUndefined(
    _db
      .select({
        id: cases.id,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        status: cases.status,
        priority: cases.priority,
        title: cases.title,
        dueDate: cases.dueDate,
        closedAt: cases.closedAt,
        categoryId: cases.categoryId,
      })
      .from(cases)
      .where(and(eq(cases.trackingCode, trackingCode), consentActiveFor(cases.submittedBy)))
      .limit(1),
  );
  if (!row) return null;

  const category = await firstOrUndefined(
    _db
      .select({ id: categories.id, name: categories.name, icon: categories.icon })
      .from(categories)
      .where(eq(categories.id, row.categoryId))
      .limit(1),
  );

  // § public only — บันทึกภายใน (isPublic = false) ไม่ออกไปหาประชาชน
  const updates = await _db
    .select({
      id: caseUpdates.id,
      createdAt: caseUpdates.createdAt,
      updateType: caseUpdates.updateType,
      oldValue: caseUpdates.oldValue,
      newValue: caseUpdates.newValue,
      comment: caseUpdates.comment,
    })
    .from(caseUpdates)
    .where(and(eq(caseUpdates.caseId, row.id), eq(caseUpdates.isPublic, true)))
    .orderBy(caseUpdates.createdAt);

  await logAudit(
    {
      action: AUDIT_ACTIONS.VIEW_CASE,
      resource: 'cases',
      resourceId: row.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { via: VIEW_VIA[ctx.channel] },
    },
    _db,
  );

  return {
    case: {
      id: row.id,
      trackingCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      priority: row.priority,
      title: row.title,
      dueDate: row.dueDate,
      closedAt: row.closedAt,
    },
    category: category ?? null,
    updates,
  };
}

/**
 * "เรื่องของฉัน" ใน LIFF — เรื่องที่ผูกกับบัญชี LINE นี้ (line_users.linked_user_id = cases.submitted_by)
 * § ใช้กติกาความยินยอมเดียวกับ findTrackableCase — ถอนแล้วหายจากรายการด้วย
 * § ไม่เขียน audit: audit การเข้าดูมีเฉพาะการค้นด้วยเลขติดตามแบบไม่ล็อกอิน
 * (findTrackableCase) "เรื่องของฉัน" ผู้ดูคือเจ้าของที่ยืนยันตัวผ่าน LIFF แล้ว ไม่ใช่ช่องทางไม่ล็อกอิน
 */
export async function listMyCases(lineUserId: string, db?: DbOrTx): Promise<MyCaseItem[]> {
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
    .where(
      and(
        eq(lineUsers.lineUserId, lineUserId),
        isNotNull(cases.trackingCode),
        consentActiveFor(cases.submittedBy),
      ),
    )
    .orderBy(desc(cases.updatedAt))
    .limit(MY_CASES_LIMIT);

  // § เคสเก่าที่ไม่มี trackingCode ถูกตัดใน SQL แล้ว — flatMap ทำให้ type แคบลงโดยไม่ใช้ `!`
  return rows.flatMap((r) =>
    r.trackingCode
      ? [{ trackingCode: r.trackingCode, status: r.status, title: r.title, updatedAt: r.updatedAt.toISOString() }]
      : [],
  );
}

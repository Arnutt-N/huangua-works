import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { firstOrUndefined } from '../db/query-helpers';
import { cases, caseUpdates, type updateTypeEnum } from '../db/schema';
import { generateId } from '../id';
import { AUDIT_ACTIONS, logAudit, type AuditAction } from '../audit';
import { CASE_SUPERVISOR_ROLES } from '../auth/roles';
import { assertTransition, type CaseStatus } from './state-machine';

type UpdateType = (typeof updateTypeEnum.enumValues)[number];

export type CasePatch =
  | { kind: 'status'; newStatus: CaseStatus; comment?: string | null; isPublic: boolean }
  | { kind: 'assignment'; officerId: string | null }
  | { kind: 'department'; departmentId: string | null }
  | { kind: 'priority'; priority: 'normal' | 'urgent' }
  | { kind: 'comment'; comment: string; isPublic: boolean };

export interface CaseActor {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

export type CaseOperationResult = { ok: true } | { ok: false; error: string };

// § actor สำหรับงานอัตโนมัติ (cron) — caseUpdates.userId/auditLogs.userId ไม่มี FK จริง
export const SYSTEM_ACTOR: CaseActor = { userId: 'system', role: 'system' };

const PATCH_PERMISSIONS: Record<CasePatch['kind'], readonly string[] | null> = {
  status: null,
  assignment: null,
  department: CASE_SUPERVISOR_ROLES,
  priority: null,
  comment: null,
};

const PATCH_AUDIT_ACTIONS: Record<CasePatch['kind'], AuditAction> = {
  status: AUDIT_ACTIONS.UPDATE_CASE_STATUS,
  assignment: AUDIT_ACTIONS.ASSIGN_CASE,
  department: AUDIT_ACTIONS.CHANGE_CASE_DEPARTMENT,
  priority: AUDIT_ACTIONS.UPDATE_CASE_PRIORITY,
  comment: AUDIT_ACTIONS.ADD_CASE_COMMENT,
};

export function checkPermission(role: string, patch: CasePatch): { ok: boolean; reason?: string } {
  const allowed = PATCH_PERMISSIONS[patch.kind];
  if (allowed && !allowed.includes(role)) {
    return { ok: false, reason: 'ไม่มีสิทธิ์ดำเนินการนี้ (ต้องเป็นหัวหน้าขึ้นไป)' };
  }
  return { ok: true };
}

export async function applyCaseUpdate(
  caseId: string,
  patch: CasePatch,
  actor: CaseActor,
): Promise<CaseOperationResult> {
  const perm = checkPermission(actor.role, patch);
  if (!perm.ok) return { ok: false, error: perm.reason! };

  const db = await getDb();

  const current = await firstOrUndefined(
    db
      .select({
        id: cases.id,
        status: cases.status,
        priority: cases.priority,
        assignedTo: cases.assignedTo,
        departmentId: cases.departmentId,
        title: cases.title,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1)
  );

  if (!current) return { ok: false, error: 'ไม่พบเรื่องที่ระบุ' };

  const timeline = buildTimeline(patch, current);
  if ('error' in timeline) return { ok: false, error: timeline.error };

  const updateSet = buildUpdateSet(patch, timeline);

  try {
    await db.transaction(async (tx) => {
      await tx.update(cases).set(updateSet).where(eq(cases.id, caseId));

      await tx.insert(caseUpdates).values({
        id: generateId(),
        caseId,
        userId: actor.userId,
        ...timeline.entry,
      });

      await logAudit({
        userId: actor.userId,
        action: PATCH_AUDIT_ACTIONS[patch.kind],
        resource: 'cases',
        resourceId: caseId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        metadata: { title: current.title, ...timeline.auditMeta },
      }, tx);
    });
  } catch (err) {
    console.error(`[applyCaseUpdate:${patch.kind}] failed`, err);
    return { ok: false, error: 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง' };
  }

  return { ok: true };
}

type TimelineEntry = {
  updateType: UpdateType;
  oldValue?: string | null;
  newValue?: string | null;
  comment?: string | null;
  isPublic: boolean;
};

type TimelineResult =
  | { entry: TimelineEntry; auditMeta: Record<string, unknown>; updateSet?: Record<string, unknown> }
  | { error: string };

function buildTimeline(
  patch: CasePatch,
  current: { status: string; priority: string; assignedTo: string | null; departmentId: string | null },
): TimelineResult {
  switch (patch.kind) {
    case 'status': {
      const transition = assertTransition(current.status as CaseStatus, patch.newStatus);
      if (!transition.ok) return { error: transition.reason ?? 'การเปลี่ยนสถานะไม่ถูกต้อง' };

      const isClosing = patch.newStatus === 'closed' || patch.newStatus === 'done';
      const isRejected = patch.newStatus === 'rejected';

      return {
        entry: {
          updateType: 'status_change',
          oldValue: current.status,
          newValue: patch.newStatus,
          comment: patch.comment,
          isPublic: patch.isPublic,
        },
        auditMeta: { from: current.status, to: patch.newStatus },
        updateSet: {
          status: patch.newStatus,
          closedAt: isClosing || isRejected ? new Date() : null,
        },
      };
    }

    case 'assignment': {
      const oldValue = current.assignedTo ?? '(ยังไม่มอบหมาย)';
      const newValue = patch.officerId ?? '(ยังไม่มอบหมาย)';
      return {
        entry: {
          updateType: 'assignment',
          oldValue,
          newValue,
          isPublic: true,
        },
        auditMeta: { from: oldValue, to: newValue },
        updateSet: { assignedTo: patch.officerId },
      };
    }

    case 'department': {
      const oldValue = current.departmentId ?? '(ไม่ระบุ)';
      const newValue = patch.departmentId ?? '(ไม่ระบุ)';
      return {
        entry: {
          updateType: 'metadata_change',
          oldValue,
          newValue,
          comment: 'เปลี่ยนหน่วยงานที่รับผิดชอบ',
          isPublic: true,
        },
        auditMeta: { from: current.departmentId, to: patch.departmentId },
        updateSet: { departmentId: patch.departmentId },
      };
    }

    case 'priority': {
      if (current.priority === patch.priority) {
        return { error: 'ความเร่งด่วนเหมือนเดิม' };
      }
      return {
        entry: {
          updateType: 'metadata_change',
          oldValue: current.priority,
          newValue: patch.priority,
          comment: patch.priority === 'urgent' ? 'ปรับเป็นเรื่องด่วน' : 'ปรับเป็นเรื่องปกติ',
          isPublic: true,
        },
        auditMeta: { from: current.priority, to: patch.priority },
        updateSet: { priority: patch.priority },
      };
    }

    case 'comment': {
      return {
        entry: {
          updateType: 'comment',
          comment: patch.comment,
          isPublic: patch.isPublic,
        },
        auditMeta: { isPublic: patch.isPublic, length: patch.comment.length },
      };
    }
  }
}

function buildUpdateSet(
  patch: CasePatch,
  timeline: Extract<TimelineResult, { entry: TimelineEntry }>,
): Record<string, unknown> {
  const base: Record<string, unknown> = { updatedAt: new Date() };
  if (timeline.updateSet) Object.assign(base, timeline.updateSet);
  return base;
}

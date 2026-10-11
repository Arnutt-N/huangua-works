import { and, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { cases, users } from '../db/schema';
import { firstOrUndefined } from '../db/query-helpers';
import {
  ADMIN_ROLES,
  CASE_SUPERVISOR_ROLES,
  STAFF_ROLES,
} from '../auth/roles';
import { isCaseStatus, type CaseStatus } from '../cases/state-machine';
import { applyCaseUpdate } from '../cases/operations';
import { AUDIT_ACTIONS, logAudit } from '../audit';
import { getSystemSetting, isSystemSettingKey } from '../system/settings';

/**
 * MCP tool registry — รีจิสทรีในโค้ดก่อน (ยังไม่เปิด HTTP)
 * default deny: ชื่อไม่รู้จักปฏิเสธก่อนเสมอ ทุกการเรียกเขียน audit
 * role ไม่เชื่อค่าที่ caller ส่งมา อ่านแถว user จาก DB ใหม่ทุกครั้ง (แบบ requireStaff)
 */

const TOOL_TIERS = {
  get_case: STAFF_ROLES,
  search_cases: STAFF_ROLES,
  update_case_status: CASE_SUPERVISOR_ROLES,
  add_case_comment: CASE_SUPERVISOR_ROLES,
  get_system_setting: ADMIN_ROLES,
} as const;

export type McpToolName = keyof typeof TOOL_TIERS;

const TOOL_DESCRIPTIONS: Record<McpToolName, string> = {
  get_case: 'อ่านเรื่องรายเรื่องแบบ public-safe ด้วยเลขติดตาม',
  search_cases: 'ค้นเรื่องด้วยคำค้น ได้สูงสุด 20 แถว',
  update_case_status: 'เปลี่ยนสถานะเรื่อง (ตรวจ transition ก่อน)',
  add_case_comment: 'เพิ่มความเห็นใน timeline เรื่อง',
  get_system_setting: 'อ่านค่าตั้งค่ากลางทีละ key',
};

const TOOL_NAMES = Object.keys(TOOL_TIERS);

export function listTools(): { name: McpToolName; description: string }[] {
  return (TOOL_NAMES as McpToolName[]).map((name) => ({ name, description: TOOL_DESCRIPTIONS[name] }));
}

const searchArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const updateStatusArgsSchema = z.object({
  caseId: z.string().min(1),
  to: z.string().min(1),
  comment: z.string().max(2000).optional(),
});

const commentArgsSchema = z.object({
  caseId: z.string().min(1),
  comment: z.string().trim().min(1).max(2000),
});

const systemSettingArgsSchema = z.object({
  key: z.string().min(1),
});

function deny(message: string): never {
  throw new Error(message);
}

async function resolveActor(userId: string): Promise<{ id: string; role: string }> {
  const db = await getDb();
  const row = await firstOrUndefined(
    db.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, userId)).limit(1),
  );
  if (!row || !row.isActive) deny('forbidden: operator ไม่ active');
  return { id: row!.id, role: row!.role };
}

function requireTier(role: string, tool: McpToolName): void {
  const allowed = TOOL_TIERS[tool] as readonly string[];
  if (!allowed.includes(role)) deny(`forbidden: tool ${tool} ต้องเป็น ${allowed.join('/')}`);
}

function publicCase(row: { id: string; status: string; updatedAt: Date }) {
  return { id: row.id, status: row.status, updatedAt: row.updatedAt.toISOString() };
}

export async function callTool(
  name: string,
  args: unknown,
  actorUserId: string,
): Promise<unknown> {
  if (!TOOL_NAMES.includes(name)) deny(`unknown_tool: ${name}`);
  const tool = name as McpToolName;

  const actor = await resolveActor(actorUserId);
  requireTier(actor.role, tool);

  const db = await getDb();
  const auditMeta: Record<string, unknown> = { tool };

  if (tool === 'get_case') {
    const trackingCode = typeof args === 'string' ? args : (args as { trackingCode?: unknown })?.trackingCode;
    if (typeof trackingCode !== 'string' || trackingCode.length === 0) deny('invalid_args: trackingCode');
    const row = await firstOrUndefined(
      db.select({ id: cases.id, status: cases.status, updatedAt: cases.updatedAt }).from(cases).where(eq(cases.trackingCode, trackingCode)).limit(1),
    );
    if (!row) deny('not_found: case');
    await logAudit({ userId: actor.id, action: AUDIT_ACTIONS.MCP_TOOL_CALL, resource: 'mcp_tool', metadata: auditMeta });
    return publicCase(row!);
  }

  if (tool === 'search_cases') {
    const parsed = searchArgsSchema.safeParse(args);
    if (!parsed.success) deny('invalid_args: query/limit');
    const { query, status, limit } = parsed.data!;
    const capped = Math.min(limit ?? 20, 20);
    const rows = status
      ? await db.select({ id: cases.id, status: cases.status, updatedAt: cases.updatedAt }).from(cases).where(and(ilike(cases.title, `%${query}%`), eq(cases.status, status as CaseStatus))).orderBy(desc(cases.updatedAt)).limit(capped)
      : await db.select({ id: cases.id, status: cases.status, updatedAt: cases.updatedAt }).from(cases).where(ilike(cases.title, `%${query}%`)).orderBy(desc(cases.updatedAt)).limit(capped);
    await logAudit({ userId: actor.id, action: AUDIT_ACTIONS.MCP_TOOL_CALL, resource: 'mcp_tool', metadata: { ...auditMeta, count: rows.length } });
    return rows.map(publicCase);
  }

  if (tool === 'update_case_status') {
    const parsed = updateStatusArgsSchema.safeParse(args);
    if (!parsed.success) deny('invalid_args: caseId/to');
    const { caseId, to, comment } = parsed.data!;
    if (!isCaseStatus(to)) deny(`invalid_args: ${to} ไม่ใช่สถานะที่รู้จัก`);
    const result = await applyCaseUpdate(
      caseId,
      { kind: 'status', newStatus: to, comment: comment ?? null, isPublic: true },
      { userId: actor.id, role: actor.role },
    );
    if (!result.ok) deny(result.error);
    await logAudit({ userId: actor.id, action: AUDIT_ACTIONS.MCP_TOOL_CALL, resource: 'cases', resourceId: caseId, metadata: { ...auditMeta, to } });
    return { ok: true };
  }

  if (tool === 'add_case_comment') {
    const parsed = commentArgsSchema.safeParse(args);
    if (!parsed.success) deny('invalid_args: caseId/comment');
    const result = await applyCaseUpdate(
      parsed.data!.caseId,
      { kind: 'comment', comment: parsed.data!.comment, isPublic: true },
      { userId: actor.id, role: actor.role },
    );
    if (!result.ok) deny(result.error);
    await logAudit({ userId: actor.id, action: AUDIT_ACTIONS.MCP_TOOL_CALL, resource: 'cases', resourceId: parsed.data!.caseId, metadata: auditMeta });
    return { ok: true };
  }

  const parsed = systemSettingArgsSchema.safeParse(args);
  if (!parsed.success) deny('invalid_args: key');
  if (!isSystemSettingKey(parsed.data!.key)) deny(`invalid_args: ${parsed.data!.key} ไม่อยู่ใน allowlist`);
  const value = await getSystemSetting(parsed.data!.key);
  await logAudit({ userId: actor.id, action: AUDIT_ACTIONS.MCP_TOOL_CALL, resource: 'system_settings', metadata: { ...auditMeta, key: parsed.data!.key } });
  return { key: parsed.data!.key, value };
}

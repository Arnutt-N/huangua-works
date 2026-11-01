/**
 * Audit Logger — บันทึกการเข้าถึง sensitive data (PDPA compliance)
 * ใช้สำหรับตรวจสอบว่าใครเข้าถึงข้อมูลอะไร เมื่อไร
 */

import { getDb, type DbOrTx } from './db';
import { auditLogs } from './db/schema';
import { generateId } from './id';
import { and, eq, type SQL } from 'drizzle-orm';

export const AUDIT_ACTIONS = {
  ACCESS_DENIED: 'access_denied',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  LIFF_LOGIN: 'liff_login',
  SUBMIT_CASE: 'submit_case',
  VIEW_CASE: 'view_case',
  UPDATE_CASE_STATUS: 'update_case_status',
  ASSIGN_CASE: 'assign_case',
  CHANGE_CASE_DEPARTMENT: 'change_case_department',
  UPDATE_CASE_PRIORITY: 'update_case_priority',
  UPDATE_CASE_BUDGET: 'update_case_budget',
  UPDATE_CASE_BUDGET_AMOUNT: 'update_case_budget_amount',
  UPDATE_CASE_ACTION_DETAILS: 'update_case_action_details',
  ADD_CASE_COMMENT: 'add_case_comment',
  CREATE_USER: 'create_user',
  UPDATE_USER_ROLE: 'update_user_role',
  ROLE_TIER_UPDATE: 'role_tier_update',
  RESET_USER_PASSWORD: 'reset_user_password',
  PROFILE_UPDATE: 'profile_update',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_CHANGE_FAILURE: 'password_change_failure',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_FAILURE: 'password_reset_failure',
  PASSWORD_RESET_SUCCESS: 'password_reset_success',
  CONSENT_WITHDRAWN: 'consent_withdrawn',
  CONSENT_WITHDRAW_DENIED: 'consent_withdraw_denied',
  DEPARTMENT_CREATE: 'department_create',
  DEPARTMENT_UPDATE: 'department_update',
  DEPARTMENT_ACTIVATE: 'department_activate',
  DEPARTMENT_DEACTIVATE: 'department_deactivate',
  DEPARTMENT_DELETE: 'department_delete',
  CATEGORY_CREATE: 'category_create',
  CATEGORY_UPDATE: 'category_update',
  CATEGORY_ACTIVATE: 'category_activate',
  CATEGORY_DEACTIVATE: 'category_deactivate',
  ACTIVATE_USER: 'activate_user',
  DEACTIVATE_USER: 'deactivate_user',
  CITIZEN_UPDATE: 'citizen_update',
  CITIZEN_ACTIVATE: 'citizen_activate',
  CITIZEN_DEACTIVATE: 'citizen_deactivate',
  CITIZEN_SET_CID: 'citizen_set_cid',
  CITIZEN_UNLINK_LINE: 'citizen_unlink_line',
  CITIZEN_DELETE: 'citizen_delete',
  RESPONSIBLE_CREATE: 'responsible_create',
  RESPONSIBLE_UPDATE: 'responsible_update',
  RESPONSIBLE_ACTIVATE: 'responsible_activate',
  RESPONSIBLE_DEACTIVATE: 'responsible_deactivate',
  RESPONSIBLE_DELETE: 'responsible_delete',
  CHATBOT_SETTINGS_UPDATE: 'chatbot_settings_update',
  SYSTEM_SETTING_UPDATE: 'system_setting_update',
  API_CONNECTION_UPDATE: 'api_connection_update',
  MCP_TOOL_CALL: 'mcp_tool_call',
  FAQ_CREATE: 'faq_create',
  FAQ_UPDATE: 'faq_update',
  FAQ_DELETE: 'faq_delete',
  INTENT_CREATE: 'intent_create',
  INTENT_UPDATE: 'intent_update',
  INTENT_DELETE: 'intent_delete',
  REPLY_OBJECT_CREATE: 'reply_object_create',
  REPLY_OBJECT_UPDATE: 'reply_object_update',
  REPLY_OBJECT_DELETE: 'reply_object_delete',
  BROADCAST_CREATE: 'broadcast_create',
  BROADCAST_VIEW: 'broadcast_view',
  BROADCAST_SEND: 'broadcast_send',
  BROADCAST_DELETE: 'broadcast_delete',
  RICH_MENU_CREATE: 'rich_menu_create',
  RICH_MENU_SYNC: 'rich_menu_sync',
  RICH_MENU_PUBLISH: 'rich_menu_publish',
  RICH_MENU_IMAGE_UPLOAD: 'rich_menu_image_upload',
  RICH_MENU_ALIAS_UPDATE: 'rich_menu_alias_update',
  RICH_MENU_UPDATE: 'rich_menu_update',
  RICH_MENU_ASSIGN: 'rich_menu_assign',
  RICH_MENU_UNASSIGN: 'rich_menu_unassign',
  RICH_MENU_DELETE: 'rich_menu_delete',
  MEDIA_UPLOAD: 'media_upload',
  MEDIA_DELETE: 'media_delete',
  IMPORT_CASE: 'import_case',
  QUEUE_BOOKING_CREATE: 'queue_booking_create',
  QUEUE_BOOKING_UPDATE: 'queue_booking_update',
  CASE_EXPORT_CSV: 'case_export_csv',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditLogEntry, db?: DbOrTx): Promise<void> {
  const _db = db ?? await getDb();

  await _db.insert(auditLogs).values({
    id: generateId(),
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
  });
}

export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  const { userId, action, resource, limit = 50, offset = 0 } = filters;

  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(auditLogs.userId, userId));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (resource) conditions.push(eq(auditLogs.resource, resource));

  const query = db.select().from(auditLogs);

  if (conditions.length > 0) {
    return await query.where(and(...conditions)).limit(limit).offset(offset);
  }

  return await query.limit(limit).offset(offset);
}

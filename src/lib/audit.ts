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
  ADD_CASE_COMMENT: 'add_case_comment',
  CREATE_USER: 'create_user',
  UPDATE_USER_ROLE: 'update_user_role',
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
  CATEGORY_CREATE: 'category_create',
  CATEGORY_UPDATE: 'category_update',
  CATEGORY_ACTIVATE: 'category_activate',
  CATEGORY_DEACTIVATE: 'category_deactivate',
  ACTIVATE_USER: 'activate_user',
  DEACTIVATE_USER: 'deactivate_user',
  CHATBOT_SETTINGS_UPDATE: 'chatbot_settings_update',
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
  BROADCAST_SEND: 'broadcast_send',
  RICH_MENU_CREATE: 'rich_menu_create',
  RICH_MENU_SYNC: 'rich_menu_sync',
  RICH_MENU_PUBLISH: 'rich_menu_publish',
  MEDIA_UPLOAD: 'media_upload',
  MEDIA_DELETE: 'media_delete',
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

/**
 * Audit Logger — บันทึกการเข้าถึง sensitive data (PDPA compliance)
 * ใช้สำหรับตรวจสอบว่าใครเข้าถึงข้อมูลอะไร เมื่อไร
 */

import { getDb } from './db';
import { auditLogs } from './db/schema';
import { generateId } from './id';
import { eq } from 'drizzle-orm';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * บันทึก audit log
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const db = getDb();

  await db.insert(auditLogs).values({
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

/**
 * Query audit logs (สำหรับ admin dashboard)
 */
export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const { userId, action, resource, limit = 50, offset = 0 } = filters;

  let query = db.select().from(auditLogs);

  if (userId) {
    query = query.where(eq(auditLogs.userId, userId)) as typeof query;
  }

  if (action) {
    query = query.where(eq(auditLogs.action, action)) as typeof query;
  }

  if (resource) {
    query = query.where(eq(auditLogs.resource, resource)) as typeof query;
  }

  return query.limit(limit).offset(offset).all();
}

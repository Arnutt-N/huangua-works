import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Schema — อบต.หัวงัว citizen-help (SQLite)
 * P0 Foundation: core tables + audit + RLS simulation via application layer
 */

// ────────────────────────────────────────────────────────────────────────────
// § Users (ผู้ใช้งาน 5 บทบาท: citizen/officer/chief/head/superadmin)
// ────────────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // UUID v7
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    email: text('email').notNull().unique(),
    role: text('role', {
      enum: ['citizen', 'officer', 'chief', 'head', 'superadmin'],
    }).notNull(),
    departmentId: text('department_id'), // FK departments.id (nullable สำหรับ citizen)
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    fullName: text('full_name').notNull(),
    phoneNumber: text('phone_number'),
    metadata: text('metadata', { mode: 'json' }), // JSON: { lastLoginAt, preferences, etc }
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    deptIdx: index('users_department_id_idx').on(table.departmentId),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Departments (หน่วยงาน: กองการศึกษา/กองคลัง/กองช่าง/สำนักปลัด/กำนัน-ผู้ใหญ่)
// ────────────────────────────────────────────────────────────────────────────

export const departments = sqliteTable(
  'departments',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    color: text('color'), // oklch(...) for UI badge
    icon: text('icon'), // lucide icon name
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => ({
    slugIdx: index('departments_slug_idx').on(table.slug),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Categories (หมวดหมู่: ถนน/ไฟฟ้า/น้ำประปา/สิ่งแวดล้อม/สังคม/etc — 13 items)
// ────────────────────────────────────────────────────────────────────────────

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    icon: text('icon'), // lucide icon
    defaultDepartmentId: text('default_department_id'), // FK departments.id
    estimatedDays: integer('estimated_days').default(7),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => ({
    slugIdx: index('categories_slug_idx').on(table.slug),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Cases (เรื่องร้องเรียก/ร้องทุกข์ — state machine: received→reviewing→assigned→in_progress→done→closed/rejected)
// ────────────────────────────────────────────────────────────────────────────

export const cases = sqliteTable(
  'cases',
  {
    id: text('id').primaryKey(), // UUID v7
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),

    // Status
    status: text('status', {
      enum: [
        'received',
        'reviewing',
        'assigned',
        'in_progress',
        'done',
        'closed',
        'rejected',
      ],
    })
      .notNull()
      .default('received'),
    priority: text('priority', { enum: ['normal', 'urgent'] })
      .notNull()
      .default('normal'),

    // Content
    title: text('title').notNull(),
    description: text('description').notNull(),
    location: text('location').notNull(), // address/landmark ไทย
    categoryId: text('category_id').notNull(), // FK categories.id

    // Assignment
    submittedBy: text('submitted_by').notNull(), // FK users.id (citizen)
    assignedTo: text('assigned_to'), // FK users.id (officer)
    departmentId: text('department_id'), // FK departments.id

    // Tracking
    dueDate: integer('due_date', { mode: 'timestamp' }),
    closedAt: integer('closed_at', { mode: 'timestamp' }),

    // Metadata
    attachments: text('attachments', { mode: 'json' }), // JSON array: [{ url, type, size }]
    metadata: text('metadata', { mode: 'json' }), // JSON: { coordinates, internalNotes, etc }
  },
  (table) => ({
    statusIdx: index('cases_status_idx').on(table.status),
    submittedByIdx: index('cases_submitted_by_idx').on(table.submittedBy),
    assignedToIdx: index('cases_assigned_to_idx').on(table.assignedTo),
    categoryIdx: index('cases_category_id_idx').on(table.categoryId),
    deptIdx: index('cases_department_id_idx').on(table.departmentId),
    createdAtIdx: index('cases_created_at_idx').on(table.createdAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Case Updates (timeline: รับเรื่อง/มอบหมาย/ดำเนินการ/เสร็จ/ปิดเรื่อง)
// ────────────────────────────────────────────────────────────────────────────

export const caseUpdates = sqliteTable(
  'case_updates',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    caseId: text('case_id').notNull(), // FK cases.id
    userId: text('user_id').notNull(), // FK users.id (ผู้อัปเดต)

    updateType: text('update_type', {
      enum: [
        'status_change',
        'assignment',
        'comment',
        'attachment',
        'metadata_change',
      ],
    }).notNull(),

    oldValue: text('old_value'),
    newValue: text('new_value'),
    comment: text('comment'),
    attachments: text('attachments', { mode: 'json' }), // JSON array

    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true), // ประชาชนเห็นได้หรือไม่
  },
  (table) => ({
    caseIdx: index('case_updates_case_id_idx').on(table.caseId),
    userIdx: index('case_updates_user_id_idx').on(table.userId),
    createdAtIdx: index('case_updates_created_at_idx').on(table.createdAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Audit Logs (การตรวจสอบ: ทุกการเข้าถึง sensitive data — PDPA compliance)
// ────────────────────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),

    userId: text('user_id'), // FK users.id (nullable สำหรับ system events)
    action: text('action').notNull(), // 'view_case', 'update_case', 'export_data', etc
    resource: text('resource').notNull(), // 'cases', 'users', 'departments'
    resourceId: text('resource_id'), // FK ตาม resource

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata', { mode: 'json' }), // JSON: { changes, reason, etc }
  },
  (table) => ({
    userIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    resourceIdx: index('audit_logs_resource_idx').on(table.resource),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Consent Records (ความยินยอม PDPA: เก็บหลักฐานการยินยอม/ถอน)
// ────────────────────────────────────────────────────────────────────────────

export const consentRecords = sqliteTable(
  'consent_records',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),

    userId: text('user_id').notNull(), // FK users.id
    consentType: text('consent_type').notNull(), // 'data_collection', 'data_sharing', 'marketing'
    version: text('version').notNull(), // "1.0" (PDPA policy version)

    isGranted: integer('is_granted', { mode: 'boolean' }).notNull(),
    grantedAt: integer('granted_at', { mode: 'timestamp' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata', { mode: 'json' }),
  },
  (table) => ({
    userIdx: index('consent_records_user_id_idx').on(table.userId),
    typeIdx: index('consent_records_consent_type_idx').on(table.consentType),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Deduplication Hashes (ป้องกันซ้ำซ้อน: HMAC-SHA256 ของ CID+title+description)
// ────────────────────────────────────────────────────────────────────────────

export const dedupHashes = sqliteTable(
  'dedup_hashes',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),

    hash: text('hash').notNull().unique(), // HMAC-SHA256 hex
    caseId: text('case_id').notNull(), // FK cases.id

    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), // 7 วัน
  },
  (table) => ({
    hashIdx: index('dedup_hashes_hash_idx').on(table.hash),
    expiresAtIdx: index('dedup_hashes_expires_at_idx').on(table.expiresAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Case Stats Daily (materialized view simulation: สถิติรายวัน — refresh ทุก 00:00)
// ────────────────────────────────────────────────────────────────────────────

export const caseStatsDaily = sqliteTable(
  'case_stats_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull().unique(), // YYYY-MM-DD (ISO 8601)

    totalReceived: integer('total_received').notNull().default(0),
    totalClosed: integer('total_closed').notNull().default(0),
    totalRejected: integer('total_rejected').notNull().default(0),
    totalInProgress: integer('total_in_progress').notNull().default(0),

    avgResolutionDays: integer('avg_resolution_days'), // average (closedAt - createdAt) in days

    byDepartment: text('by_department', { mode: 'json' }), // JSON: { [deptId]: count }
    byCategory: text('by_category', { mode: 'json' }), // JSON: { [catId]: count }

    metadata: text('metadata', { mode: 'json' }), // JSON: { refreshedAt, dataSource, etc }
  },
  (table) => ({
    dateIdx: index('case_stats_daily_date_idx').on(table.date),
  })
);

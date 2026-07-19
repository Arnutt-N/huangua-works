import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Schema — อบต.หัวงัว citizen-help (PostgreSQL)
 * P0 Foundation: core tables + audit + RLS simulation via application layer
 *
 * Migrated from SQLite dialect → PostgreSQL dialect (self-hosted via Docker).
 * - integer(timestamp) + unixepoch() → timestamp({ mode: 'date' }) + defaultNow()
 * - integer(boolean) → boolean
 * - text(json) → jsonb
 * - inline text enums → pgEnum
 * - UUID v7 PKs remain text('id').primaryKey() (app-generated)
 */

// ────────────────────────────────────────────────────────────────────────────
// § Enums
// ────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'citizen',
  'officer',
  'chief',
  'head',
  'superadmin',
]);

export const caseStatusEnum = pgEnum('case_status', [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'rejected',
]);

export const casePriorityEnum = pgEnum('case_priority', ['normal', 'urgent']);

export const updateTypeEnum = pgEnum('update_type', [
  'status_change',
  'assignment',
  'comment',
  'attachment',
  'metadata_change',
]);

// ────────────────────────────────────────────────────────────────────────────
// § Users (ผู้ใช้งาน 5 บทบาท: citizen/officer/chief/head/superadmin)
// ────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // UUID v7
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    email: text('email').notNull().unique(),
    role: userRoleEnum().notNull(),
    departmentId: text('department_id'), // FK departments.id (nullable สำหรับ citizen)
    isActive: boolean('is_active').notNull().default(true),
    fullName: text('full_name').notNull(),
    phoneNumber: text('phone_number'),
    metadata: jsonb('metadata'), // JSON: { lastLoginAt, preferences, etc }
    // § bcrypt hash — null สำหรับ citizen (ไม่มี account login) และยังไม่ได้ตั้งรหัสผ่าน
    // ใช้แทน Supabase Auth (GoTrue) หลังย้าย stack เป็น plain Postgres + Auth.js v5
    passwordHash: text('password_hash'),
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

export const departments = pgTable(
  'departments',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    color: text('color'), // oklch(...) for UI badge
    icon: text('icon'), // lucide icon name
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    slugIdx: index('departments_slug_idx').on(table.slug),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Categories (หมวดหมู่: ถนน/ไฟฟ้า/น้ำประปา/สิ่งแวดล้อม/สังคม/etc — 13 items)
// ────────────────────────────────────────────────────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    icon: text('icon'), // lucide icon
    defaultDepartmentId: text('default_department_id'), // FK departments.id
    estimatedDays: integer('estimated_days').default(7),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    slugIdx: index('categories_slug_idx').on(table.slug),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Cases (เรื่องแจ้งเหตุ — state machine: received→reviewing→assigned→in_progress→done→closed/rejected)
// ────────────────────────────────────────────────────────────────────────────

export const cases = pgTable(
  'cases',
  {
    id: text('id').primaryKey(), // UUID v7
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow(),

    // Status
    status: caseStatusEnum().notNull().default('received'),
    priority: casePriorityEnum().notNull().default('normal'),

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
    dueDate: timestamp('due_date', { mode: 'date' }),
    closedAt: timestamp('closed_at', { mode: 'date' }),

    // § citizen-facing tracking code: HN + 9 หลักสุ่ม (คล้าย EMS ไปรษณีย์ไทย)
    // null = เคสเก่าก่อนใช้ระบบนี้ → ปิด track (คืน 404)
    // lookup ผ่าน /api/cases/[id] ใช้ค่านี้แทน PK เพื่อไม่เปิดเผย UUID ที่เดาได้ (UUID v7 timestamp-ordered)
    trackingCode: text('tracking_code'),

    // Metadata
    attachments: jsonb('attachments'), // JSON array: [{ url, type, size }]
    metadata: jsonb('metadata'), // JSON: { coordinates, internalNotes, etc }
  },
  (table) => ({
    statusIdx: index('cases_status_idx').on(table.status),
    submittedByIdx: index('cases_submitted_by_idx').on(table.submittedBy),
    assignedToIdx: index('cases_assigned_to_idx').on(table.assignedTo),
    categoryIdx: index('cases_category_id_idx').on(table.categoryId),
    deptIdx: index('cases_department_id_idx').on(table.departmentId),
    createdAtIdx: index('cases_created_at_idx').on(table.createdAt),
    // § partial unique index — เฉพาะ row ที่มี tracking_code (เคสใหม่); null (เคสเก่า) ไม่นับซ้ำ
    trackingCodeIdx: uniqueIndex('cases_tracking_code_idx')
      .on(table.trackingCode)
      .where(sql`tracking_code IS NOT NULL`),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Case Updates (timeline: รับเรื่อง/มอบหมาย/ดำเนินการ/เสร็จ/ปิดเรื่อง)
// ────────────────────────────────────────────────────────────────────────────

export const caseUpdates = pgTable(
  'case_updates',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),
    caseId: text('case_id').notNull(), // FK cases.id
    userId: text('user_id').notNull(), // FK users.id (ผู้อัปเดต)

    updateType: updateTypeEnum('update_type').notNull(),

    oldValue: text('old_value'),
    newValue: text('new_value'),
    comment: text('comment'),
    attachments: jsonb('attachments'), // JSON array

    isPublic: boolean('is_public').notNull().default(true), // ประชาชนเห็นได้หรือไม่
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

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),

    userId: text('user_id'), // FK users.id (nullable สำหรับ system events)
    action: text('action').notNull(), // 'view_case', 'update_case', 'export_data', etc
    resource: text('resource').notNull(), // 'cases', 'users', 'departments'
    resourceId: text('resource_id'), // FK ตาม resource

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'), // JSON: { changes, reason, etc }
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

export const consentRecords = pgTable(
  'consent_records',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),

    userId: text('user_id').notNull(), // FK users.id
    consentType: text('consent_type').notNull(), // 'data_collection', 'data_sharing', 'marketing'
    version: text('version').notNull(), // "1.0" (PDPA policy version)

    isGranted: boolean('is_granted').notNull(),
    grantedAt: timestamp('granted_at', { mode: 'date' }),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    userIdx: index('consent_records_user_id_idx').on(table.userId),
    typeIdx: index('consent_records_consent_type_idx').on(table.consentType),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Deduplication Hashes (ป้องกันซ้ำซ้อน: HMAC-SHA256 ของ CID+title+description)
// ────────────────────────────────────────────────────────────────────────────

export const dedupHashes = pgTable(
  'dedup_hashes',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { mode: 'date' })
      .notNull()
      .defaultNow(),

    hash: text('hash').notNull().unique(), // HMAC-SHA256 hex
    caseId: text('case_id').notNull(), // FK cases.id

    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(), // 7 วัน
  },
  (table) => ({
    hashIdx: index('dedup_hashes_hash_idx').on(table.hash),
    expiresAtIdx: index('dedup_hashes_expires_at_idx').on(table.expiresAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// § Case Stats Daily (materialized view simulation: สถิติรายวัน — refresh ทุก 00:00)
// ────────────────────────────────────────────────────────────────────────────

export const caseStatsDaily = pgTable(
  'case_stats_daily',
  {
    id: text('id').primaryKey(),
    date: date('date').notNull().unique(), // YYYY-MM-DD (ISO 8601)

    totalReceived: integer('total_received').notNull().default(0),
    totalClosed: integer('total_closed').notNull().default(0),
    totalRejected: integer('total_rejected').notNull().default(0),
    totalInProgress: integer('total_in_progress').notNull().default(0),

    avgResolutionDays: integer('avg_resolution_days'), // average (closedAt - createdAt) in days

    byDepartment: jsonb('by_department'), // JSON: { [deptId]: count }
    byCategory: jsonb('by_category'), // JSON: { [catId]: count }

    metadata: jsonb('metadata'), // JSON: { refreshedAt, dataSource, etc }
  },
  (table) => ({
    dateIdx: index('case_stats_daily_date_idx').on(table.date),
  })
);
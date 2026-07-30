/**
 * Role tiers — single source of truth
 *
 * Pure module (ห้าม import อะไร): ปลอดภัยใน client bundle และ schema.ts
 * derive pg enum จาก ALL_ROLES (pattern เดียวกับ caseStatusEnum ← ALL_STATUSES)
 *
 * หมายเหตุ: 'system' (SYSTEM_ACTOR ใน lib/cases/operations.ts) เป็น pseudo-role
 * จงใจไม่อยู่ใน UserRole — CaseActor.role จึงเป็น plain string
 */

export const ALL_ROLES = ['citizen', 'officer', 'chief', 'head', 'superadmin'] as const;

export type UserRole = (typeof ALL_ROLES)[number];

/** ทุก role ที่ login เข้า /admin ได้ — ใช้กับ zod schemas (createUser/updateUserRole) */
export const STAFF_ROLES = ['officer', 'chief', 'head', 'superadmin'] as const satisfies readonly UserRole[];

/** chief ขึ้นไป — สิทธิ์ระดับ "งานเคส" (เช่น เปลี่ยนหน่วยงานรับผิดชอบ) */
export const CASE_SUPERVISOR_ROLES: readonly UserRole[] = ['chief', 'head', 'superadmin'];

/** head ขึ้นไป — สิทธิ์ระดับ "บริหารระบบ" (จัดการผู้ใช้ / master data / nav) */
export const ADMIN_ROLES: readonly UserRole[] = ['head', 'superadmin'];

export const SUPERADMIN_ONLY: readonly UserRole[] = ['superadmin'];

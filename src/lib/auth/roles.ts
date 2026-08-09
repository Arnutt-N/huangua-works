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

/**
 * ผู้กระทำ (actorRole) มีสิทธิ์กำหนดบทบาท targetRole ให้คนอื่นหรือไม่
 *
 * § เฉพาะ superadmin เท่านั้นที่แจกบทบาท superadmin ได้
 * createUserFormSchema/updateUserRoleFormSchema ใช้ z.enum(STAFF_ROLES) ซึ่งรวม
 * 'superadmin' ไว้ด้วย ส่วนด่านที่กั้น action เหล่านั้นคือ ADMIN_ROLES = head|superadmin
 * ถ้าไม่มีฟังก์ชันนี้ head จะสร้างบัญชี superadmin พร้อมรหัสผ่านที่ตัวเองตั้งแล้ว login
 * เข้าไปได้ทันที หรือเลื่อน user ที่มีอยู่ขึ้น superadmin — ยกระดับสิทธิ์เต็มรูปแบบ
 *
 * ด่านนี้เป็นคู่ของด่าน `target.role === 'superadmin' && actor.role !== 'superadmin'`
 * ใน actions/users.ts ซึ่งกันคนละทิศ (ห้ามแก้ superadmin ที่มีอยู่ vs ห้ามตั้งใหม่)
 * ต้องมีทั้งคู่ — resetPassword ที่ล็อกเป็น SUPERADMIN_ONLY ยืนยันว่า head ไม่ควรมี
 * อำนาจระดับ superadmin
 */
export function canGrantRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return targetRole !== 'superadmin' || actorRole === 'superadmin';
}

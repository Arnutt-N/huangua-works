'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES, type UserRole } from '@/lib/auth/roles';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { getTierRoles, setTierRoles, TIER_KEYS, type TierKey } from '@/lib/auth/tiers';

export interface TierActionState {
  error: string | null;
  success?: string;
}

/** เมทริกซ์ปัจจุบันให้หน้า users (superadmin tier รวมด้วยแต่อ่านอย่างเดียว) */
export async function getTierMatrix(): Promise<Record<TierKey, string[]>> {
  await requireStaff(ADMIN_ROLES);
  return {
    staff: await getTierRoles('staff'),
    case_supervisor: await getTierRoles('case_supervisor'),
    admin: await getTierRoles('admin'),
    superadmin: await getTierRoles('superadmin'),
  };
}

const TIER_LABELS: Record<TierKey, string> = {
  staff: 'เจ้าหน้าที่ทั่วไป',
  case_supervisor: 'งานเคส',
  admin: 'บริหารระบบ',
  superadmin: 'ผู้ดูแลสูงสุด (ล็อก)',
};

/**
 * แก้สมาชิก tier — head ทำได้ทุก tier ยกเว้น superadmin (ล็อกที่ setTierRoles อีกชั้น)
 * form ส่ง roles เป็น CSV ต่อ tier (checkbox ที่ติ๊ก)
 * § validate ครบทุก tier ก่อนเขียนตัวแรก (กัน half-apply — interrogate D-9)
 */
export async function updateTierRoles(
  _prevState: TierActionState,
  formData: FormData,
): Promise<TierActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(ADMIN_ROLES);

  const parsed = TIER_KEYS.filter((k) => k !== 'superadmin').map((key) => {
    const raw = formData.get(`tier:${key}`);
    const roles = (raw === null ? [] : String(raw).split(',').map((r) => r.trim()).filter(Boolean)) as (
      | 'officer'
      | 'chief'
      | 'head'
      | 'superadmin'
    )[];
    return { key, roles };
  });
  // § ว่าง = เก่าค้าง (ฟอร์มส่ง hidden ทุก tier เสมอ) — ปฏิเสธก่อนเขียน ไม่ half-apply
  const empty = parsed.find((p) => p.roles.length === 0);
  if (empty) return { error: `tier ${TIER_LABELS[empty.key]} ต้องมีบทบาทอย่างน้อย 1 บทบาท` };
  // § กัน head ล็อกตัวเอง (ตัด role ตัวเองออก admin โดยไม่ใช่ superadmin)
  const adminNext = parsed.find((p) => p.key === 'admin')!.roles as UserRole[];
  if (actor.role !== 'superadmin' && !adminNext.includes(actor.role)) {
    return { error: 'ห้ามตัดบทบาทตัวเองออกจาก tier บริหารระบบ' };
  }

  for (const { key, roles } of parsed) {
    const res = await setTierRoles(key, roles);
    if (!res.ok) return { error: res.error ?? 'บันทึกไม่สำเร็จ' };
    await logAudit({
      userId: actor.id,
      action: AUDIT_ACTIONS.ROLE_TIER_UPDATE,
      resource: 'tier_roles',
      resourceId: key,
      ipAddress,
      userAgent,
      // § audit ค่าที่เก็บจริง (รวม superadmin ที่บังคับ) ไม่ใช่ค่าดิบจากฟอร์ม
      metadata: { tier: key, label: TIER_LABELS[key], roles: res.stored ?? roles },
    });
  }

  revalidatePath('/admin/users');
  return { error: null, success: 'บันทึกสิทธิ์แล้ว มีผลภายใน ~1 นาทีทุก process' };
}

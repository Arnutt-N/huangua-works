'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/require-staff';
import { ADMIN_ROLES } from '@/lib/auth/roles';
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
 */
export async function updateTierRoles(
  _prevState: TierActionState,
  formData: FormData,
): Promise<TierActionState> {
  const { user: actor, ipAddress, userAgent } = await requireStaff(ADMIN_ROLES);

  for (const key of TIER_KEYS) {
    if (key === 'superadmin') continue;
    const raw = formData.get(`tier:${key}`);
    if (raw === null) continue;
    const roles = String(raw)
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean) as ('officer' | 'chief' | 'head' | 'superadmin')[];
    const res = await setTierRoles(key, roles);
    if (!res.ok) return { error: res.error ?? 'บันทึกไม่สำเร็จ' };
    await logAudit({
      userId: actor.id,
      action: AUDIT_ACTIONS.ROLE_TIER_UPDATE,
      resource: 'tier_roles',
      resourceId: key,
      ipAddress,
      userAgent,
      metadata: { tier: key, label: TIER_LABELS[key], roles },
    });
  }

  revalidatePath('/admin/users');
  return { error: null, success: 'บันทึกสิทธิ์แล้ว มีผลภายใน ~1 นาทีทุก process' };
}

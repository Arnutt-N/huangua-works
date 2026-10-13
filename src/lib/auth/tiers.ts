/**
 * DB-backed tier membership — server-only (ห้าม import ฝั่ง client)
 *
 * `roles.ts` ต้อง pure (client bundle + schema ใช้) จึงเก็บ default ไว้ที่นั่น
 * ส่วนตาราง `tier_roles` เก็บ override ที่แอดมินแก้ผ่านหน้า UI ได้โดยไม่ deploy
 * อ่านผ่าน versioned cache (pattern เดียวกับ chat settings) ตก DB = fallback
 * ค่าคงที่เสมอ ไม่มีทางล็อกทั้งระบบ
 */

import { getDb } from '@/lib/db';
import { tierRoles } from '@/lib/db/schema';
import {
  ADMIN_ROLES,
  CASE_SUPERVISOR_ROLES,
  STAFF_ROLES,
  SUPERADMIN_ONLY,
  type UserRole,
} from './roles';
import { createVersionedCache } from '@/lib/line/versioned-cache';
import { bumpConfigVersion, readConfigVersion } from '@/lib/line/config-version';

export const TIER_KEYS = ['staff', 'case_supervisor', 'admin', 'superadmin'] as const;
export type TierKey = (typeof TIER_KEYS)[number];

const TIER_DEFAULTS: Record<TierKey, readonly UserRole[]> = {
  staff: STAFF_ROLES,
  case_supervisor: CASE_SUPERVISOR_ROLES,
  admin: ADMIN_ROLES,
  superadmin: SUPERADMIN_ONLY,
};

/** pure — DB มีแถวใช้แถว ไม่มี/ว่างใช้ default (ไม่มีทางคืนลิสต์ว่าง) */
export function pickTierRoles(
  stored: string[] | undefined,
  fallback: readonly UserRole[],
): UserRole[] {
  if (!stored || stored.length === 0) return [...fallback];
  return stored as UserRole[];
}

async function loadTierMap(): Promise<Record<TierKey, UserRole[]>> {
  const db = await getDb();
  let rows: Array<{ tier: string; roles: string[] }> = [];
  try {
    rows = await db.select({ tier: tierRoles.tier, roles: tierRoles.roles }).from(tierRoles);
  } catch {
    // § ตารางยังไม่มี (migrate ไม่ทัน) = fallback ทั้งหมด ไม่ throw
    return Object.fromEntries(
      TIER_KEYS.map((k) => [k, [...TIER_DEFAULTS[k]]]),
    ) as Record<TierKey, UserRole[]>;
  }
  const byTier = new Map(rows.map((r) => [r.tier, r.roles]));
  return Object.fromEntries(
    TIER_KEYS.map((k) => [k, pickTierRoles(byTier.get(k), TIER_DEFAULTS[k])]),
  ) as Record<TierKey, UserRole[]>;
}

const tierCache = createVersionedCache({
  load: loadTierMap,
  readVersion: () => readConfigVersion('tier_roles'),
  ttlMs: 60_000,
  versionCheckMs: 3_000,
});

export async function getTierRoles(key: TierKey): Promise<UserRole[]> {
  return (await tierCache.get())[key];
}

/** บันทึก override — tier superadmin ล็อกเสมอ (test ล็อกไว้) */
export async function setTierRoles(key: TierKey, roles: UserRole[]): Promise<{ ok: boolean; error?: string }> {
  if (key === 'superadmin') return { ok: false, error: 'tier superadmin ล็อก แก้ไขไม่ได้' };
  const EDITABLE: readonly string[] = ['officer', 'chief', 'head', 'superadmin'];
  const valid = roles.filter((r): r is UserRole => EDITABLE.includes(r));
  if (valid.length === 0) return { ok: false, error: 'ต้องมีบทบาทอย่างน้อย 1 บทบาท' };
  // § superadmin อยู่ในทุก tier เสมอ (กัน head ตัดสิทธิ์ superadmin แล้วล็อกทั้งระบบ)
  // ตัดซ้ำออกก่อน union กัน ['superadmin','superadmin']
  const forced = [...new Set([...valid, 'superadmin' as UserRole])];
  const db = await getDb();
  await db
    .insert(tierRoles)
    .values({ tier: key, roles: forced, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tierRoles.tier, set: { roles: forced, updatedAt: new Date() } });
  // § ประกาศให้ทุก process เห็นภายใน ~3 วิ (กติกาเดียวกับ chat settings)
  await bumpConfigVersion('tier_roles');
  return { ok: true };
}

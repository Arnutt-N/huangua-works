/**
 * DB-backed tier membership — server-only (ห้าม import ฝั่ง client)
 *
 * `roles.ts` ต้อง pure (client bundle + schema ใช้) จึงเก็บ default ไว้ที่นั่น
 * ส่วนตาราง `tier_roles` เก็บ override ที่แอดมินแก้ผ่านหน้า UI ได้โดยไม่ deploy
 * อ่านผ่าน versioned cache (pattern เดียวกับ chat settings)
 * § ตาราง tier_roles ยังไม่มี = ค่าคงที่ (ไม่มี override ให้ข้าม); อ่านไม่ได้ด้วยเหตุอื่น = throw
 * → require-staff fail-closed เหลือ superadmin (อยู่ทุก tier ตาม #111 จึงไม่ล็อกทั้งระบบ)
 */

import { getDb } from '@/lib/db';
import { tierRoles } from '@/lib/db/schema';
import {
  ADMIN_ROLES,
  ALL_ROLES,
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

/** บทบาทที่ให้ผ่านด่าน tier ได้ — ทุกตัวยกเว้น citizen (derive จาก ALL_ROLES ที่เดียว) */
export const TIERABLE_ROLES: readonly UserRole[] = ALL_ROLES.filter(
  (r): r is UserRole => r !== 'citizen',
);

function roleKey(r: string): string {
  return [...r].sort().join(',');
}

const TIER_KEY_BY_VALUE = new Map<string, TierKey>(
  TIER_KEYS.map((k) => [roleKey([...TIER_DEFAULTS[k]].sort().join(',')), k]),
);

/**
 * pure — จับคู่ whitelist กับ tier ด้วยค่า (sort+join) ไม่ใช่ reference
 * spread/สำเนา/literal เทียบเท่าเข้า matrix เหมือน const เดิม (interrogate D-14)
 */
export function tierKeyForRoles(allowedRoles: readonly string[]): TierKey | undefined {
  return TIER_KEY_BY_VALUE.get(roleKey([...allowedRoles].sort().join(',')));
}

/**
 * pure — DB มีแถวใช้แถว ไม่มี/ว่างใช้ default (ไม่มีทางคืนลิสต์ว่าง)
 * § union superadmin ตอนอ่านด้วย — แถวเก่าก่อน #111 (เช่น ['head']) self-heal ได้
 * โดยไม่ต้องรอ migrate/backfill (interrogate B-3)
 * § กรองขยะตอนอ่าน (typo/role ถูกลบ) — เหลือศูนย์ตัว fallback default พร้อม warn
 */
export function pickTierRoles(
  stored: string[] | undefined,
  fallback: readonly UserRole[],
): UserRole[] {
  if (!stored || stored.length === 0) return [...fallback];
  const clean = stored.filter((r): r is UserRole =>
    (TIERABLE_ROLES as readonly string[]).includes(r),
  );
  if (clean.length === 0) {
    console.error('[tiers] แถวขยะถูกทิ้งหมด ใช้ default แทน');
    return [...fallback];
  }
  return [...new Set([...clean, 'superadmin' as UserRole])];
}

const UNDEFINED_TABLE = '42P01';

/** drizzle 0.45 ห่อ error ของ postgres-js ไว้ใน .cause (DrizzleQueryError) — เช็คทั้งสองชั้น */
function isUndefinedTableError(err: unknown): boolean {
  const codeOf = (e: unknown): unknown =>
    e && typeof e === 'object' && 'code' in e ? (e as { code?: unknown }).code : undefined;
  return codeOf(err) === UNDEFINED_TABLE || codeOf((err as { cause?: unknown } | null)?.cause) === UNDEFINED_TABLE;
}

async function loadTierMap(): Promise<Record<TierKey, UserRole[]>> {
  const db = await getDb();
  let rows: Array<{ tier: string; roles: string[] }> = [];
  try {
    rows = await db.select({ tier: tierRoles.tier, roles: tierRoles.roles }).from(tierRoles);
  } catch (err) {
    // § ตารางยังไม่มี (migrate ไม่ทัน) = ไม่มี override ได้ → default คือค่าจริง ไม่ใช่ fail-open
    // error อื่น (DB สะดุด/สิทธิ์) = อ่าน override ไม่ได้ → throw (versioned cache ไม่เก็บ
    // ความล้มเหลว) ให้ require-staff fail-closed แทนการคืน default ที่กว้างกว่า override
    if (!isUndefinedTableError(err)) throw err;
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

/** ล้าง cache process นี้ทันที — เรียกหลังเขียนทุกครั้ง (กฎเดียวกับ settings) */
export function refreshTierCache(): void {
  tierCache.invalidate();
}

/**
 * บันทึก override — tier superadmin ล็อกเสมอ (test ล็อกไว้)
 * คืน roles ที่เก็บจริง (`forced`) ให้ caller เอาไป audit ต่อ (interrogate D-11)
 */
export async function setTierRoles(
  key: TierKey,
  roles: UserRole[],
): Promise<{ ok: boolean; error?: string; stored?: UserRole[] }> {
  if (key === 'superadmin') return { ok: false, error: 'tier superadmin ล็อก แก้ไขไม่ได้' };
  const valid = roles.filter((r): r is UserRole =>
    (TIERABLE_ROLES as readonly string[]).includes(r),
  );
  if (valid.length === 0) return { ok: false, error: 'ต้องมีบทบาทอย่างน้อย 1 บทบาท' };
  // § superadmin อยู่ในทุก tier เสมอ (กัน head ตัดสิทธิ์ superadmin แล้วล็อกทั้งระบบ)
  // ตัดซ้ำออกก่อน union กัน ['superadmin','superadmin']
  const forced = [...new Set([...valid, 'superadmin' as UserRole])];
  const db = await getDb();
  await db
    .insert(tierRoles)
    .values({ tier: key, roles: forced, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tierRoles.tier, set: { roles: forced, updatedAt: new Date() } });
  // § ล้าง cache ตัวเองก่อนประกาศ (ไม่งั้น process นี้ค้าง 60 วิ — interrogate C-6)
  refreshTierCache();
  // § ประกาศให้ทุก process เห็นภายใน ~3 วิ (กติกาเดียวกับ chat settings)
  await bumpConfigVersion('tier_roles');
  return { ok: true, stored: forced };
}

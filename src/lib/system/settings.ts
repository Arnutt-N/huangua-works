import { getDb } from '../db';
import { systemSettings } from '../db/schema';
import { generateId } from '../id';
import { bumpConfigVersion, readConfigVersion } from '../line/config-version';
import {
  BOT_CONFIG_TTL_MS,
  BOT_CONFIG_VERSION_CHECK_MS,
  createVersionedCache,
} from '../line/versioned-cache';

/**
 * System settings — ตั้งค่ากลางทั้งระบบ (รอบ system กลางก่อน)
 * รูปเดียวกับ line/settings.ts: get ผ่าน versioned cache, set ใน tx เดียว
 * ต่างกัน 3 จุด: key อยู่ใน allowlist ปิดตาย, scope version เป็น 'system',
 * ไม่มี BusinessHours (ค่าทุกตัวเป็น boolean int หรือ literal)
 */

export interface SystemSettingsValues {
  maintenance_mode: boolean;
  audit_retention_days: number;
  import_default_org: 'huangua';
}

export const SYSTEM_SETTING_KEYS = [
  'maintenance_mode',
  'audit_retention_days',
  'import_default_org',
] as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number];

const DEFAULTS: SystemSettingsValues = {
  maintenance_mode: false,
  audit_retention_days: 365,
  import_default_org: 'huangua',
};

/** เปิด DEFAULTS ให้ unit test assert ตรงกับแผน โดยไม่ต้องแตะ DB */
export const DEFAULTS_EXPOSED_FOR_TEST: SystemSettingsValues = { ...DEFAULTS };

export function isSystemSettingKey(key: string): key is SystemSettingKey {
  return (SYSTEM_SETTING_KEYS as readonly string[]).includes(key);
}

/** normalize ค่าดิบตอนอ่าน ชนิดเสีย fallback เป็น default ของ key นั้น */
export function normalizeSystemSetting(
  key: SystemSettingKey,
  value: unknown,
): SystemSettingsValues[SystemSettingKey] | undefined {
  if (key === 'maintenance_mode') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (key === 'audit_retention_days') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 30 && value <= 3650
      ? value
      : undefined;
  }
  return value === 'huangua' ? value : undefined;
}

async function loadAllSettings(): Promise<SystemSettingsValues> {
  const db = await getDb();
  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings);
  const overrides: Partial<SystemSettingsValues> = {};
  for (const row of rows) {
    if (!isSystemSettingKey(row.key) || row.value === null) continue;
    const normalized = normalizeSystemSetting(row.key, row.value);
    if (normalized !== undefined) overrides[row.key] = normalized as never;
  }
  return { ...DEFAULTS, ...overrides };
}

const settingsCache = createVersionedCache({
  load: loadAllSettings,
  readVersion: () => readConfigVersion('system'),
  ttlMs: BOT_CONFIG_TTL_MS,
  versionCheckMs: BOT_CONFIG_VERSION_CHECK_MS,
});

export async function getSystemSetting<K extends SystemSettingKey>(
  key: K,
): Promise<SystemSettingsValues[K]> {
  const all = await settingsCache.get();
  return all[key];
}

/**
 * บันทึกค่ากลางหลาย key ใน transaction เดียว แล้วประกาศให้ทุก process
 * ผู้เรียกไม่ต้อง invalidate เอง ฟังก์ชันนี้ล้าง cache process นี้
 * และ INCR เลข version scope system ให้ process อื่นเห็นภายใน ~3 วินาที
 */
export async function setSystemSettings(patch: Partial<SystemSettingsValues>): Promise<void> {
  const entries = Object.entries(patch).filter(
    ([key, value]) => value !== undefined && isSystemSettingKey(key),
  );
  if (entries.length === 0) return;

  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      const json: unknown = JSON.parse(JSON.stringify(value));
      await tx
        .insert(systemSettings)
        .values({ id: generateId(), key, value: json })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: json, updatedAt: new Date() },
        });
    }
  });

  settingsCache.invalidate();
  await bumpConfigVersion('system');
}

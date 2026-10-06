import { getDb } from '../db';
import { chatSettings } from '../db/schema';
import { generateId } from '../id';
import { COPY } from '@/lib/copy';
import type { BusinessHours } from './business-hours';
import { bumpConfigVersion, readConfigVersion } from './config-version';
import {
  BOT_CONFIG_TTL_MS,
  BOT_CONFIG_VERSION_CHECK_MS,
  createVersionedCache,
} from './versioned-cache';

export interface ChatSettingsDefaults {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: BusinessHours;
  bot_enabled: boolean;
  bot_engine_v2: boolean;
}

const DEFAULTS: ChatSettingsDefaults = {
  // § ข้อความนี้เป็นเพียง fallback — ถ้า prod เคยบันทึก welcome_message ไว้ใน
  // chatSettings แล้ว ค่าใน DB จะ override ตลอด ต้องอัปเดตผ่านหน้า admin ด้วย
  welcome_message:
    `สวัสดีครับ/ค่ะ ยินดีต้อนรับสู่ ${COPY.ORG_SHORT} 🏛️\n\nเลือกเมนูด้านล่างหรือพิมพ์:\n• ${COPY.INTAKE_LABEL} — แจ้งเรื่อง (เปิดฟอร์มกรอกใน LINE ได้เลย)\n• ${COPY.TRACK_LABEL} — ติดตามสถานะเรื่อง\n• ติดต่อเจ้าหน้าที่ — พูดคุยกับเจ้าหน้าที่`,
  handoff_keywords: [
    'ติดต่อเจ้าหน้าที่',
    'เจ้าหน้าที่',
    'คุยกับคน',
    'พบเจ้าหน้าที่',
    'handoff',
    'operator',
    'admin',
  ],
  business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] },
  bot_enabled: true,
  bot_engine_v2: false,
};

function isSettingKey(key: string): key is keyof ChatSettingsDefaults {
  return Object.hasOwn(DEFAULTS, key);
}

function isClock(value: unknown): value is string {
  return typeof value === 'string' && /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value);
}

/** normalize ค่าเก่าตอนอ่าน — ไม่ทำ schema migration; ชนิดเสีย fallback เป็น default ของ key นั้น */
function normalizeSetting(key: keyof ChatSettingsDefaults, value: unknown): ChatSettingsDefaults[typeof key] | undefined {
  if (key === 'bot_enabled' || key === 'bot_engine_v2') {
    return typeof value === 'boolean' ? value : undefined;
  }
  if (key === 'handoff_keywords') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) return undefined;
    return value;
  }
  if (key === 'business_hours') {
    if (!value || typeof value !== 'object') return undefined;
    const hours = value as { start?: unknown; end?: unknown; days?: unknown };
    const daysOk = Array.isArray(hours.days)
      && hours.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    if (!isClock(hours.start) || !isClock(hours.end) || hours.start >= hours.end || !daysOk) return undefined;
    return { start: hours.start, end: hours.end, days: [...new Set(hours.days as number[])].sort((a, b) => a - b) };
  }
  if (key === 'welcome_message') {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
  return undefined;
}

// โหลดทุก key ในคิวรีเดียว (ตารางมีไม่กี่แถว) แทนการคิวรีทีละ key แบบเดิม
async function loadAllSettings(): Promise<ChatSettingsDefaults> {
  const db = await getDb();
  const rows = await db
    .select({ key: chatSettings.key, value: chatSettings.value })
    .from(chatSettings);
  const overrides: Partial<ChatSettingsDefaults> = {};
  for (const row of rows) {
    if (!isSettingKey(row.key) || row.value === null) continue;
    const normalized = normalizeSetting(row.key, row.value);
    if (normalized !== undefined) overrides[row.key] = normalized as never;
  }
  return { ...DEFAULTS, ...overrides };
}

const settingsCache = createVersionedCache({
  load: loadAllSettings,
  readVersion: () => readConfigVersion('settings'),
  ttlMs: BOT_CONFIG_TTL_MS,
  versionCheckMs: BOT_CONFIG_VERSION_CHECK_MS,
});

export async function getChatSetting<K extends keyof ChatSettingsDefaults>(
  key: K,
): Promise<ChatSettingsDefaults[K]> {
  const all = await settingsCache.get();
  return all[key];
}

/**
 * บันทึกค่าบอทหลาย key ใน transaction เดียว แล้วประกาศการเปลี่ยนแปลงให้ทุก process
 *
 * § ผู้เรียกไม่ต้อง (และไม่มีทาง) invalidate cache เอง — ฟังก์ชันนี้ล้าง cache ของ process นี้
 * และ INCR เลข version ใน Redis ให้ webhook process อื่นเห็นภายใน ~3 วินาที
 * ห้ามเพิ่ม export invalidate กลับมา: กติกา "ต้องจำเรียกหลังเขียน" คือบั๊กที่ module นี้มาแก้
 */
export async function setChatSettings(patch: Partial<ChatSettingsDefaults>): Promise<void> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      const json: unknown = JSON.parse(JSON.stringify(value));
      await tx
        .insert(chatSettings)
        .values({ id: generateId(), key, value: json })
        .onConflictDoUpdate({
          target: chatSettings.key,
          set: { value: json, updatedAt: new Date() },
        });
    }
  });

  settingsCache.invalidate();
  await bumpConfigVersion('settings');
}

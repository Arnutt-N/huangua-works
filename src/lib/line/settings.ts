import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { chatSettings } from '../db/schema';
import { generateId } from '../id';
import { COPY } from '@/lib/copy';

export interface ChatSettingsDefaults {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: { start: string; end: string; days: number[] };
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

const cache = new Map<string, { value: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function getChatSetting<K extends keyof ChatSettingsDefaults>(
  key: K,
): Promise<ChatSettingsDefaults[K]> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value as ChatSettingsDefaults[K];
  }

  const db = await getDb();
  const rows = await db.select().from(chatSettings).where(eq(chatSettings.key, key)).limit(1);

  const value = rows[0]?.value ?? DEFAULTS[key];
  cache.set(key, { value, ts: Date.now() });
  return value as ChatSettingsDefaults[K];
}

export async function setChatSetting<K extends keyof ChatSettingsDefaults>(
  key: K,
  value: ChatSettingsDefaults[K],
): Promise<void> {
  const db = await getDb();
  const existing = await db.select({ id: chatSettings.id }).from(chatSettings).where(eq(chatSettings.key, key)).limit(1);

  if (existing[0]) {
    await db
      .update(chatSettings)
      .set({ value: JSON.parse(JSON.stringify(value)), updatedAt: new Date() })
      .where(eq(chatSettings.id, existing[0].id));
  } else {
    await db.insert(chatSettings).values({
      id: generateId(),
      key,
      value: JSON.parse(JSON.stringify(value)),
    });
  }

  cache.set(key, { value, ts: Date.now() });
}

export function invalidateSettingsCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

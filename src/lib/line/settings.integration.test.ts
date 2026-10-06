import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb } from '@/lib/db';
import { chatSettings } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { redis } from '@/lib/upstash';
import { getChatSetting, setChatSettings } from './settings';
import { configVersionKey, readConfigVersion } from './config-version';
import { GET, PUT } from '@/app/api/line/admin/settings/route';

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-settings-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));
// § ตัด audit ออก — ไฟล์นี้ทดสอบการบันทึกค่าบอท ส่วน audit row ต้องมี user จริงใน DB
vi.mock('@/lib/audit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audit')>()),
  logAudit: vi.fn(async () => {}),
}));

/**
 * Integration — ต้องมี `docker compose up -d postgres redis up-redis`
 *
 * § "อีก process" จำลองด้วย vi.resetModules() แล้ว import settings ใหม่ — ได้ module instance
 * ที่มี cache ใน memory ของตัวเอง (เหมือน webhook lambda) ส่วน instance ที่ import ด้านบน
 * ทำหน้าที่เป็น admin route ที่บันทึกค่า
 *
 * § chat_settings ใน dev DB คือค่าที่เครื่อง dev ใช้งานจริง — เก็บทั้งชุดก่อนเทสต์และคืนกลับหลังเทสต์
 */

type SettingsRow = typeof chatSettings.$inferSelect;
let snapshot: SettingsRow[] = [];
const isolatedDbClosers: Array<() => Promise<void>> = [];

async function loadOtherProcess() {
  vi.resetModules();
  const settings = await import('./settings');
  const db = await import('@/lib/db');
  isolatedDbClosers.push(db.closeDb);
  return settings;
}

beforeAll(async () => {
  const db = await getDb();
  snapshot = await db.select().from(chatSettings);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(chatSettings);
    if (snapshot.length > 0) await tx.insert(chatSettings).values(snapshot);
  });
  // ให้ dev server ที่รันอยู่โหลดค่าที่คืนกลับทันที (Redis ล่มก็ไม่เป็นไร — รอ TTL)
  await redis.incr(configVersionKey('settings')).catch(() => undefined);
  await Promise.all(isolatedDbClosers.map((close) => close()));
  await closeDb();
});

describe('settings · process เดียวกัน', () => {
  test('setChatSettings แล้ว getChatSetting เห็นค่าใหม่ทันที', async () => {
    await setChatSettings({ bot_enabled: true });
    expect(await getChatSetting('bot_enabled')).toBe(true);

    await setChatSettings({
      bot_enabled: false,
      business_hours: { start: '09:00', end: '15:00', days: [1, 3] },
    });
    expect(await getChatSetting('bot_enabled')).toBe(false);
    expect(await getChatSetting('business_hours')).toEqual({ start: '09:00', end: '15:00', days: [1, 3] });
  });

  test('ทุกครั้งที่เขียน เลข version ใน Redis เพิ่มขึ้น 1', async () => {
    const before = Number((await readConfigVersion('settings')) ?? '0');
    await setChatSettings({ bot_enabled: true });
    expect(await readConfigVersion('settings')).toBe(String(before + 1));
  });

  test('ไม่มีแถวใน DB → ใช้ค่า default', async () => {
    const db = await getDb();
    await db.delete(chatSettings).where(eq(chatSettings.key, 'welcome_message'));
    await setChatSettings({ bot_enabled: true }); // ล้าง cache ของ process นี้
    expect(await getChatSetting('welcome_message')).toContain('ยินดีต้อนรับ');
  });

  test('เขียน key เดิมซ้ำเป็น upsert ไม่เกิดแถวซ้ำ', async () => {
    await setChatSettings({ bot_enabled: false });
    await setChatSettings({ bot_enabled: true });
    const db = await getDb();
    const rows = await db.select().from(chatSettings).where(eq(chatSettings.key, 'bot_enabled'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(true);
  });
});

describe('settings · ข้าม process', () => {
  test('process อื่นเห็นค่าที่บันทึกภายในไม่กี่วินาที โดยไม่มีใครเรียก invalidate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await setChatSettings({ bot_enabled: true });

    const webhook = await loadOtherProcess();
    expect(await webhook.getChatSetting('bot_enabled')).toBe(true); // อุ่น cache

    await setChatSettings({ bot_enabled: false });
    // ยังอยู่ในรอบเช็ค 3 วินาที — ตอบจาก memory (พิสูจน์ว่าไม่ได้ยิง DB ทุกข้อความ)
    expect(await webhook.getChatSetting('bot_enabled')).toBe(true);

    vi.setSystemTime(Date.now() + 3_500);
    expect(await webhook.getChatSetting('bot_enabled')).toBe(false);
  });

  test('§ เขียนตรง DB โดยไม่ bump version → อีก process เห็นค่าใหม่เมื่อครบ TTL (fallback)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await setChatSettings({ business_hours: { start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] } });

    const webhook = await loadOtherProcess();
    expect((await webhook.getChatSetting('business_hours')).start).toBe('08:30');

    const db = await getDb();
    const changed = { start: '10:00', end: '12:00', days: [2] };
    await db
      .insert(chatSettings)
      .values({ id: generateId(), key: 'business_hours', value: changed })
      .onConflictDoUpdate({ target: chatSettings.key, set: { value: changed, updatedAt: new Date() } });

    vi.setSystemTime(Date.now() + 3_500);
    expect((await webhook.getChatSetting('business_hours')).start).toBe('08:30'); // version ไม่เปลี่ยน

    vi.setSystemTime(Date.now() + 60_000);
    expect(await webhook.getChatSetting('business_hours')).toEqual(changed);
  });
});

function putRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/line/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('loadAllSettings — ค่าเก่าใน DB', () => {
  test('bot_enabled/hours/keywords ที่ชนิดเสีย fallback เป็น default ไม่ throw', async () => {
    const db = await getDb();
    const broken = [
      // § ใช้เลข 42 แทน string — jsonb จะตีความ 'false' เป็น boolean false ที่ไม่เสียพอ
      ['bot_enabled', 42],
      ['handoff_keywords', { bad: true }],
      ['business_hours', { start: '16:30', end: '08:30', days: [1] }],
    ] as const;
    for (const [key, value] of broken) {
      await db
        .insert(chatSettings)
        .values({ id: generateId(), key, value: value as never })
        .onConflictDoUpdate({ target: chatSettings.key, set: { value: value as never, updatedAt: new Date() } });
    }

    // § cache ของ process นี้ถูกทิ้งไว้ด้วยเวลาจาก fake timers ตอนเทสต์ TTL — ขยับเวลา
    // ให้เกิน TTL เพื่อบังคับโหลดจาก DB ใหม่ (เขียนตรง DB ไม่ bump version จึงรอ TTL)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 130_000);

    expect(await getChatSetting('bot_enabled')).toBe(true);
    expect(await getChatSetting('handoff_keywords')).toContain('ติดต่อเจ้าหน้าที่');
    expect(await getChatSetting('business_hours')).toEqual({ start: '08:30', end: '16:30', days: [1, 2, 3, 4, 5] });
  });
});

describe('PUT /api/line/admin/settings', () => {
  test('บันทึก bot_enabled + business_hours แล้วบอทอ่านค่าใหม่ได้ทันที', async () => {
    const res = await PUT(
      putRequest({ bot_enabled: false, business_hours: { start: '09:00', end: '15:30', days: [5, 1, 1] } }),
    );
    expect(res.status).toBe(200);
    expect(await getChatSetting('bot_enabled')).toBe(false);
    // days ถูก dedupe + เรียง
    expect(await getChatSetting('business_hours')).toEqual({ start: '09:00', end: '15:30', days: [1, 5] });
  });

  test.each([
    ['เวลาเปิดหลังเวลาปิด', { start: '16:30', end: '08:30', days: [1] }],
    ['เวลาเปิดเท่าเวลาปิด', { start: '08:30', end: '08:30', days: [1] }],
    ['ชั่วโมงเกิน 23', { start: '25:00', end: '26:00', days: [1] }],
    ['นาทีเกิน 59', { start: '08:60', end: '16:30', days: [1] }],
  ])('400 เมื่อ business_hours ไม่ถูกต้อง (%s) และค่าเดิมไม่เปลี่ยน', async (_label, hours) => {
    const before = await getChatSetting('business_hours');
    const res = await PUT(putRequest({ business_hours: hours }));
    expect(res.status).toBe(400);
    expect(await getChatSetting('business_hours')).toEqual(before);
  });
});

describe('GET /api/line/admin/settings', () => {
  test('คืนค่าที่บันทึกล่าสุด', async () => {
    await PUT(putRequest({ bot_enabled: true }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bot_enabled: boolean; business_hours: unknown };
    expect(body.bot_enabled).toBe(true);
    expect(body.business_hours).toHaveProperty('days');
  });
});

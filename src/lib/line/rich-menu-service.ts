import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import {
  createLineRichMenu,
  deleteLineRichMenu,
  getLineRichMenu,
  uploadLineRichMenuImage,
  setDefaultLineRichMenu,
} from './client';

// § LINE แก้ layout เมนูไม่ได้ + รูปอัปได้ครั้งเดียวต่อ id — เทียบเฉพาะฟิลด์ที่ LINE
// เก็บจริง (key เฉพาะ local อย่าง `selected` ไม่นับ) เพี้ยน = สร้างใหม่แทน patch
const LINE_STORED_KEYS = ['size', 'name', 'chatBarText', 'areas'] as const;

function projectConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const key of LINE_STORED_KEYS) {
    out[key] = (config as Record<string, unknown>)[key] ?? null;
  }
  return out;
}

// § jsonb ไม่รักษา key order — เทียบด้วย canonical stringify (sort key recursive)
// ไม่งั้น config เดิมจาก DB จะเพี้ยนทุกครั้ง (test no-op จับได้)
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function isRichMenuDrift(localConfig: unknown, lineMenu: unknown): boolean {
  if (!lineMenu) return true;
  return stable(projectConfig(localConfig)) !== stable(projectConfig(lineMenu));
}

export async function syncRichMenu(
  id: string,
): Promise<{ ok: boolean; error?: string; recreated?: boolean }> {
  const db = await getDb();
  const [menu] = await db.select().from(richMenus).where(eq(richMenus.id, id)).limit(1);
  if (!menu) return { ok: false, error: 'ไม่พบ rich menu' };

  try {
    let lineId = menu.lineRichMenuId;
    let recreated = false;

    if (lineId) {
      const lineMenu = await getLineRichMenu(lineId);
      if (lineMenu && !isRichMenuDrift(menu.config, lineMenu)) {
        // ตรงกัน = no-op ห้ามสร้างซ้ำ
        await db
          .update(richMenus)
          .set({ syncStatus: 'synced', lastSyncError: null, updatedAt: new Date() })
          .where(eq(richMenus.id, id));
        return { ok: true };
      }
      // เพี้ยนหรือ stale → สร้างใหม่แล้วย้ายทุกอย่าง (recreate แบบ jsk-app)
      const oldLineId = lineMenu ? lineId : null;
      lineId = await createLineRichMenu(menu.config);
      recreated = true;
      await db
        .update(richMenus)
        .set({ lineRichMenuId: lineId, updatedAt: new Date() })
        .where(eq(richMenus.id, id));
      if (menu.status === 'active') {
        // § ย้าย default ก่อนลบ — LINE ลบเมนูที่เป็น default อยู่ไม่ได้ (400)
        await setDefaultLineRichMenu(lineId);
      }
      if (oldLineId) {
        // § ลบอันเก่าแบบ best-effort — เหลือค้างก็ inert ไม่กระทบใช้งาน
        await deleteLineRichMenu(oldLineId).catch(() => {});
      }
    } else {
      lineId = await createLineRichMenu(menu.config);
      await db.update(richMenus).set({ lineRichMenuId: lineId, updatedAt: new Date() }).where(eq(richMenus.id, id));
    }

    // § รูปเก็บเป็น URL ใน DB ไม่มี bytes ย้ายข้าม id ไม่ได้ — เตือนให้อัปใหม่ ไม่ fail sync
    const imageWarning =
      recreated && menu.imageUrl
        ? 'รูปเดิมไม่ได้ย้ายมาเมนูใหม่ กรุณากดอัปรูปอีกครั้ง'
        : null;
    await db
      .update(richMenus)
      .set({ syncStatus: 'synced', lastSyncError: imageWarning, updatedAt: new Date() })
      .where(eq(richMenus.id, id));
    return { ok: true, recreated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await db.update(richMenus).set({ syncStatus: 'error', lastSyncError: msg.slice(0, 500), updatedAt: new Date() }).where(eq(richMenus.id, id));
    return { ok: false, error: msg };
  }
}

export async function uploadMenuImage(id: string, imageBuffer: Buffer, imageUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const [menu] = await db.select({ lineRichMenuId: richMenus.lineRichMenuId }).from(richMenus).where(eq(richMenus.id, id)).limit(1);
  if (!menu?.lineRichMenuId) return { ok: false, error: 'ต้อง sync ก่อนอัปโหลดรูป' };

  try {
    await uploadLineRichMenuImage(menu.lineRichMenuId, imageBuffer);
    if (imageUrl) {
      await db.update(richMenus).set({ imageUrl, updatedAt: new Date() }).where(eq(richMenus.id, id));
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'upload failed' };
  }
}

export async function publishRichMenu(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const [menu] = await db.select({ lineRichMenuId: richMenus.lineRichMenuId }).from(richMenus).where(eq(richMenus.id, id)).limit(1);
  if (!menu?.lineRichMenuId) return { ok: false, error: 'ต้อง sync ก่อน publish' };

  try {
    await setDefaultLineRichMenu(menu.lineRichMenuId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'publish failed' };
  }

  await db.update(richMenus).set({ status: 'active', updatedAt: new Date() }).where(eq(richMenus.id, id));
  return { ok: true };
}

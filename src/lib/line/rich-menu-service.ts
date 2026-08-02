import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenus } from '@/lib/db/schema';
import { createLineRichMenu, uploadLineRichMenuImage, setDefaultLineRichMenu } from './client';

export async function syncRichMenu(id: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const [menu] = await db.select().from(richMenus).where(eq(richMenus.id, id)).limit(1);
  if (!menu) return { ok: false, error: 'ไม่พบ rich menu' };

  try {
    let lineId = menu.lineRichMenuId;

    if (!lineId) {
      lineId = await createLineRichMenu(menu.config);
      await db.update(richMenus).set({ lineRichMenuId: lineId, updatedAt: new Date() }).where(eq(richMenus.id, id));
    }

    await db.update(richMenus).set({ syncStatus: 'synced', lastSyncError: null, updatedAt: new Date() }).where(eq(richMenus.id, id));
    return { ok: true };
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

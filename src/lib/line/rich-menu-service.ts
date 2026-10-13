import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { richMenuAliases, richMenus } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import {
  cancelDefaultLineRichMenu,
  createAliasOnLine,
  createLineRichMenu,
  deleteAliasOnLine,
  deleteLineRichMenu,
  getAliasOnLine,
  getDefaultLineRichMenu,
  getLineRichMenu,
  updateAliasOnLine,
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

export interface DisplayCandidate {
  id: string;
  lineRichMenuId: string | null;
  status: string;
  syncStatus: string;
  displayStartAt: Date | null;
  displayEndAt: Date | null;
}

/**
 * § ตัดสินล้วนๆ ไม่แตะ I/O — cron route/test เรียกตัวนี้ก่อนค่อยลงมือ
 * กฎ: มี schedule + synced + ถึงเวลาเริ่ม → activate; หมดเวลา + active → expire;
 * ยกเลิก default บน LINE เฉพาะเมื่อเมนูหมดอายุยังเป็นเจ้าของ (AC4 แบบ jsk-app)
 * ไม่ทับ default ที่คนตั้งมือทีหลัง
 */
export function planDisplayActions(
  menus: DisplayCandidate[],
  now: Date,
  currentDefaultLineId: string | null,
): { activate: string[]; demote: string[]; expire: string[]; cancelDefault: boolean } {
  const expire: string[] = [];
  const live: DisplayCandidate[] = [];
  for (const m of menus) {
    if (!m.lineRichMenuId || m.syncStatus !== 'synced') continue;
    if (!m.displayStartAt && !m.displayEndAt) continue;
    // § ต้องมี start ที่ถึงเวลาแล้วเท่านั้น — มีแค่ end คือตั้งเวลาลงอย่างเดียว
    // ห้าม publish หลุด (interrogate D-6)
    const started = m.displayStartAt ? m.displayStartAt <= now : false;
    const ended = m.displayEndAt ? m.displayEndAt <= now : false;
    if (ended && m.status === 'active') expire.push(m.id);
    else if (started && !ended) live.push(m);
  }
  // § election ข้าม active ∪ contenders (start ล่าสุดชนะ, เสมอ id มากสุด) —
  // LINE มี default เดียว ตัวแพ้โดน demote ใน tick เดียวกัน (round-2 verdict)
  live.sort((a, b) => {
    const t = b.displayStartAt!.getTime() - a.displayStartAt!.getTime();
    return t !== 0 ? t : b.id.localeCompare(a.id);
  });
  const winner = live[0];
  const activate = winner && winner.status !== 'active' ? [winner.id] : [];
  const demote = live.filter((m) => m !== winner && m.status === 'active').map((m) => m.id);
  const expiringLineIds = new Set(
    menus.filter((m) => expire.includes(m.id)).map((m) => m.lineRichMenuId),
  );
  return {
    activate,
    demote,
    expire,
    // § มี activate = setDefault ใหม่ทับแล้ว ห้าม cancel ตาม (interrogate B-2/C-2)
    cancelDefault:
      activate.length === 0 &&
      expire.length > 0 &&
      currentDefaultLineId !== null &&
      expiringLineIds.has(currentDefaultLineId),
  };
}

/** cron tick แสดงเมนูตามเวลา — เรียกจาก `/api/cron/rich-menu-display` */
export interface DisplayTickResult {
  activated: number;
  expired: number;
  demoted: number;
  failed: string[];
  error?: string;
}

export async function runDisplayTick(now = new Date()): Promise<DisplayTickResult> {
  const db = await getDb();
  const failed: string[] = [];
  let activated = 0;
  let expired = 0;
  let demoted = 0;
  try {
    const rows = await db
      .select({
        id: richMenus.id,
        lineRichMenuId: richMenus.lineRichMenuId,
        status: richMenus.status,
        syncStatus: richMenus.syncStatus,
        displayStartAt: richMenus.displayStartAt,
        displayEndAt: richMenus.displayEndAt,
      })
      .from(richMenus);
    // § อ่าน default ล้ม = ไม่รู้เจ้าของ — ข้าม expire ทั้งหมด (defer รอบหน้า)
    // ไม่งั้น flip ไป inactive แล้ว cancel ไม่ได้อีกเลย (round-2 verdict Act On 1)
    let currentDefault: string | null = null;
    let readFailed = false;
    try {
      currentDefault = await getDefaultLineRichMenu();
    } catch (err) {
      readFailed = true;
      console.error('[display-tick] read default failed, defer expire', err);
    }
    const plan = planDisplayActions(
      rows.map((r) => ({ ...r, status: r.status as string })),
      now,
      currentDefault,
    );
    // § cancel ก่อน commit (ล้มแล้วยัง retry ได้ — DB ยัง active อยู่)
    if (plan.cancelDefault) {
      try {
        await cancelDefaultLineRichMenu();
      } catch (err) {
        failed.push('cancel-default');
        console.error('[display-tick] cancel default failed', err);
      }
    }
    for (const id of plan.activate) {
      try {
        const row = rows.find((r) => r.id === id)!;
        await setDefaultLineRichMenu(row.lineRichMenuId!);
        await db
          .update(richMenus)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(richMenus.id, id));
        activated += 1;
      } catch (err) {
        failed.push(`activate:${id}`);
        console.error(`[display-tick] activate ${id} failed`, err);
      }
    }
    for (const id of plan.demote) {
      try {
        await db
          .update(richMenus)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(eq(richMenus.id, id));
        demoted += 1;
      } catch (err) {
        failed.push(`demote:${id}`);
        console.error(`[display-tick] demote ${id} failed`, err);
      }
    }
    for (const id of plan.expire) {
      try {
        if (readFailed) continue;
        if (plan.cancelDefault && failed.includes('cancel-default')) continue;
        await db
          .update(richMenus)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(eq(richMenus.id, id));
        expired += 1;
      } catch (err) {
        failed.push(`expire:${id}`);
        console.error(`[display-tick] expire ${id} failed`, err);
      }
    }
    return { activated, expired, demoted, failed };
  } catch (err) {
    return {
      activated,
      expired,
      demoted,
      failed,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
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

// ─── alias (สลับ tab ด้วย richmenuswitch) ────────────────────────────────

/** pattern เดียวกับ LINE console: a-z A-Z 0-9 _ - ยาวไม่เกิน 50 */
export function isValidAliasId(aliasId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(aliasId);
}

async function resolveAliasTarget(
  db: Awaited<ReturnType<typeof getDb>>,
  menuId: string,
): Promise<{ ok: true; lineRichMenuId: string } | { ok: false; error: string }> {
  const [menu] = await db
    .select({ lineRichMenuId: richMenus.lineRichMenuId, syncStatus: richMenus.syncStatus })
    .from(richMenus)
    .where(eq(richMenus.id, menuId))
    .limit(1);
  // § เป้าต้อง sync แล้ว — alias ชี้เมนูที่ LINE ไม่มีคือเมนูตาย
  if (!menu?.lineRichMenuId) return { ok: false, error: 'เมนูเป้าหมายต้อง sync ก่อน' };
  if (menu.syncStatus !== 'synced') return { ok: false, error: 'เมนูเป้าหมายยัง sync ไม่สำเร็จ' };
  return { ok: true, lineRichMenuId: menu.lineRichMenuId };
}

export async function createMenuAlias(
  aliasId: string,
  menuId: string,
): Promise<{ ok: boolean; error?: string; code?: 'duplicate' }> {
  if (!isValidAliasId(aliasId)) return { ok: false, error: 'ชื่อ alias ใช้ได้แค่ a-z A-Z 0-9 _ - ยาวไม่เกิน 50' };
  const db = await getDb();
  // § เช็ค local ก่อนยิง LINE — ซ้ำตอบ 409 สะอาด ไม่สร้าง orphan (interrogate A-5)
  const [existing] = await db
    .select({ id: richMenuAliases.id })
    .from(richMenuAliases)
    .where(eq(richMenuAliases.aliasId, aliasId))
    .limit(1);
  if (existing) return { ok: false, error: 'ชื่อ alias นี้มีแล้ว', code: 'duplicate' };
  const target = await resolveAliasTarget(db, menuId);
  if (!target.ok) return target;
  try {
    await createAliasOnLine(aliasId, target.lineRichMenuId);
  } catch (err) {
    // § ชน 4xx (มีอยู่บน LINE แล้ว เช่น crash ค้าง) → อ่านกลับ: เป้าตรงเขียนแถวคืน
    // (reconcile) เป้าอื่นคือของคนอื่นแตะไม่ได้ (round-2 verdict Act On 7)
    const remote = await getAliasOnLine(aliasId).catch(() => null);
    if (remote?.richMenuId === target.lineRichMenuId) {
      try {
        await db.insert(richMenuAliases).values({ id: generateId(), aliasId, richMenuId: menuId });
        return { ok: true };
      } catch {
        return { ok: false, error: 'บันทึก alias ในระบบไม่สำเร็จ กรุณาลองใหม่' };
      }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'create alias failed' };
  }
  try {
    await db.insert(richMenuAliases).values({ id: generateId(), aliasId, richMenuId: menuId });
  } catch {
    // § ชดเชยเฉพาะเมื่อ remote เป็นของที่ call นี้สร้าง — ถ้าเป็นของ winner
    // (ชน unique) ห้ามลบเด็ดขาด (round-2 verdict Act On 3)
    const remote = await getAliasOnLine(aliasId).catch(() => null);
    if (!remote || remote.richMenuId === target.lineRichMenuId) {
      await deleteAliasOnLine(aliasId).catch(() => {});
    }
    return { ok: false, error: 'บันทึก alias ในระบบไม่สำเร็จ กรุณาลองใหม่' };
  }
  return { ok: true };
}

export async function repointMenuAlias(
  aliasId: string,
  menuId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const [row] = await db
    .select({ id: richMenuAliases.id })
    .from(richMenuAliases)
    .where(eq(richMenuAliases.aliasId, aliasId))
    .limit(1);
  if (!row) return { ok: false, error: 'ไม่พบ alias นี้ในระบบ' };
  const target = await resolveAliasTarget(db, menuId);
  if (!target.ok) return target;
  try {
    await updateAliasOnLine(aliasId, target.lineRichMenuId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'repoint alias failed' };
  }
  try {
    await db
      .update(richMenuAliases)
      .set({ richMenuId: menuId, updatedAt: new Date() })
      .where(eq(richMenuAliases.id, row.id));
  } catch (err) {
    // § LINE ย้ายแล้วแต่ DB เขียนไม่ลง — คืน ok:false ให้ retry ได้ (converge เอง)
    return { ok: false, error: err instanceof Error ? err.message : 'repoint alias failed' };
  }
  return { ok: true };
}

export async function deleteMenuAlias(
  aliasId: string,
): Promise<{ ok: boolean; error?: string; code?: 'not_found' }> {
  const db = await getDb();
  // § เช็คแถว local ก่อน — ไม่มีคือ 404 ไม่ audit ผี (interrogate A-6)
  const [row] = await db
    .select({ id: richMenuAliases.id })
    .from(richMenuAliases)
    .where(eq(richMenuAliases.aliasId, aliasId))
    .limit(1);
  if (!row) return { ok: false, error: 'ไม่พบ alias นี้ในระบบ', code: 'not_found' };
  // § ลบฝั่ง LINE ก่อน (404 = ไปแล้ว) แล้วค่อยลบแถว local — สลับกันจะเหลือขยะบน LINE
  try {
    await deleteAliasOnLine(aliasId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'delete alias failed' };
  }
  try {
    await db.delete(richMenuAliases).where(eq(richMenuAliases.id, row.id));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'delete alias failed' };
  }
  return { ok: true };
}

export async function listMenuAliases(): Promise<
  Array<{ aliasId: string; richMenuId: string; menuName: string | null }>
> {
  const db = await getDb();
  const rows = await db
    .select({
      aliasId: richMenuAliases.aliasId,
      richMenuId: richMenuAliases.richMenuId,
      menuName: richMenus.name,
    })
    .from(richMenuAliases)
    .leftJoin(richMenus, eq(richMenus.id, richMenuAliases.richMenuId));
  return rows;
}

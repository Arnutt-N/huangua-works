import type { RichMenuDisplayMode } from '@/lib/contracts';

export const SYNC_SYNCED = 'synced';
export const SYNC_PENDING = 'pending';
export const SYNC_FAILED = 'error';

export interface RichMenuSyncFields {
  lineRichMenuId: string | null;
  syncStatus: string;
}

/** เมนูอยู่บน LINE และ sync ล่าสุดสำเร็จ — ใช้ทั้งปุ่ม publish และตัวกรอง alias */
export function isSyncedMenu(menu: RichMenuSyncFields): boolean {
  return !!menu.lineRichMenuId && menu.syncStatus === SYNC_SYNCED;
}

/** ใช้ผูกเมนูรายคนได้หรือไม่ — ตรงกับ guard ของ POST friends/[id]/rich-menu */
export function isUsableMenu(menu: RichMenuSyncFields & { status: string }): boolean {
  return !!menu.lineRichMenuId && menu.status !== 'inactive';
}

export function needsResync(menu: RichMenuSyncFields): boolean {
  return !!menu.lineRichMenuId && menu.syncStatus === SYNC_PENDING;
}

export function isSyncFailed(menu: RichMenuSyncFields): boolean {
  return !!menu.lineRichMenuId && menu.syncStatus === SYNC_FAILED;
}

export type RichMenuPillTone =
  | 'active'
  | 'error'
  | 'pending'
  | 'scheduled'
  | 'inactive'
  | 'synced'
  | 'draft';

export interface RichMenuPill {
  label: string;
  tone: RichMenuPillTone;
  title?: string;
}

export const pillTone: Record<RichMenuPillTone, string> = {
  active: 'bg-success-soft text-success-ink border-success/30',
  error: 'bg-danger-soft text-danger-ink border-danger/30',
  pending: 'bg-warning-soft text-warning-ink border-warning/40',
  scheduled: 'bg-accent-sunken text-accent-strong border-accent-strong/30',
  inactive: 'bg-surface-sunken text-muted border-border/60',
  synced: 'bg-accent-sunken text-accent-strong border-accent-strong/30',
  draft: 'bg-warning-soft text-warning-ink border-warning/40',
};

export interface RichMenuPillFields extends RichMenuSyncFields {
  status: string;
  displayMode: string;
  displayStartAt: string | null;
  displayEndAt: string | null;
  lastSyncError: string | null;
}

export function menuStatusPill(menu: RichMenuPillFields): RichMenuPill {
  if (menu.status === 'active' && !needsResync(menu)) {
    return { label: 'ACTIVE', tone: 'active' };
  }
  if (isSyncFailed(menu)) {
    return { label: 'SYNC FAILED', tone: 'error', title: menu.lastSyncError ?? undefined };
  }
  if (needsResync(menu)) {
    return { label: 'รอซิงค์', tone: 'pending', title: 'แก้ไขในระบบแล้ว ยังไม่ส่งไป LINE' };
  }
  if (menu.displayMode === 'SCHEDULED') {
    if (menu.status === 'inactive') {
      return { label: 'หมดเวลา', tone: 'inactive', title: 'ช่วงเวลาการแสดงผลจบแล้ว' };
    }
    const start = menu.displayStartAt ? new Date(menu.displayStartAt) : null;
    const end = menu.displayEndAt ? new Date(menu.displayEndAt) : null;
    const title =
      start && end
        ? `แสดงตามเวลา: ${start.toLocaleString('th-TH')} – ${end.toLocaleString('th-TH')}`
        : 'แสดงตามช่วงเวลาที่กำหนด';
    return { label: 'ตามเวลา', tone: 'scheduled', title };
  }
  if (menu.displayMode === 'MANUAL' && menu.status !== 'active') {
    return {
      label: 'ซ่อน',
      tone: 'inactive',
      title: 'ซิงค์แล้วแต่ไม่ตั้งเป็นเมนูหลัก (ใช้กับ alias / ผู้ใช้เฉพาะราย)',
    };
  }
  if (menu.lineRichMenuId) return { label: 'SYNCED', tone: 'synced' };
  return { label: 'DRAFT', tone: 'draft' };
}

/** ISO → ค่าให้ <input type="datetime-local"> ตามเวลาท้องถิ่น (slice(0,16) จะได้ UTC) */
export function toLocalDatetimeInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DISPLAY_MODE_LABEL: Record<RichMenuDisplayMode, string> = {
  ALWAYS: 'แสดงตลอดเวลา',
  SCHEDULED: 'ตามช่วงเวลา',
  MANUAL: 'ซ่อน (เตรียมใช้งาน)',
};

/** สถานะที่ควรแสดงบนปุ่มหลักของแถว (list) — null = live แล้ว */
export function primaryAction(
  menu: RichMenuSyncFields & { status: string },
): 'sync' | 'resync' | 'publish' | null {
  if (!menu.lineRichMenuId) return 'sync';
  if (needsResync(menu)) return 'resync';
  if (isSyncFailed(menu)) return 'resync';
  if (isSyncedMenu(menu) && menu.status !== 'active') return 'publish';
  return null;
}

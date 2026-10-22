import type { RichMenuItem } from '@/app/admin/_lib/admin-api';

export function isUsableMenu(m: RichMenuItem): boolean {
  return !!m.lineRichMenuId && m.status !== 'inactive';
}

export function isSyncedMenu(m: RichMenuItem): boolean {
  return !!m.lineRichMenuId && m.syncStatus === 'synced';
}

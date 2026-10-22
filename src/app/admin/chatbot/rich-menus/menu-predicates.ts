import type { RichMenuItem } from '@/app/admin/_lib/admin-api';

/**
 * เมนูใช้เป็นเป้าหมายผูกริชเมนู — ตรง server guard POST /friends/:id/rich-menu
 * (422 เมื่อไม่มี lineRichMenuId หรือ status inactive)
 *
 * § แยกจาก isSyncedMenu โดยเจตนา — สองเส้นทาง server ใช้คนละเกณฑ์
 * (interrogate PR #143: รวมอันเดียวแล้ว dropdown เสนอเมนูที่ alias จะ 422)
 */
export function isUsableMenu(m: RichMenuItem): boolean {
  return !!m.lineRichMenuId && m.status !== 'inactive';
}

/**
 * เมนูใช้เป็นเป้าหมาย alias (create/repoint) — ตรง resolveAliasTarget
 * (`rich-menu-service.ts` 422 เมื่อ syncStatus !== 'synced')
 *
 * § สำคัญ: sync เคยสำเร็จแล้วไป error ทีหลัง lineRichMenuId ยังอยู่แต่ใช้เป็น
 * alias ไม่ได้ — filter นี้กันเมนูแบบนั้นออกจาก dropdown
 */
export function isSyncedMenu(m: RichMenuItem): boolean {
  return !!m.lineRichMenuId && m.syncStatus === 'synced';
}

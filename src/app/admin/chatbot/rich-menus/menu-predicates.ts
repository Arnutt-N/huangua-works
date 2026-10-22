import type { RichMenuItem } from '@/app/admin/_lib/admin-api';

/**
 * เมนูพร้อมผูกให้เพื่อน — predicate เดียว (เดิม 3 สำเนา: rich-menus, aliases, friends)
 *
 * § เกณฑ์ตรง server guard POST /friends/:id/rich-menu (422 เมื่อไม่มี lineRichMenuId
 * หรือ status inactive) — client ไม่เข้มกว่า server ไม่ซ่อนเมนูที่ผูกได้จริง
 */
export function isUsableMenu(m: RichMenuItem): boolean {
  return !!m.lineRichMenuId && m.status !== 'inactive';
}

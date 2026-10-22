// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isSyncedMenu, isUsableMenu } from './menu-predicates';
import type { RichMenuItem } from '@/app/admin/_lib/admin-api';

function menu(over: Partial<RichMenuItem> = {}): RichMenuItem {
  return {
    id: 'm1',
    name: 'เมนูหลัก',
    chatBarText: 'เมนู',
    lineRichMenuId: 'richmenu-abc',
    status: 'active',
    syncStatus: 'synced',
    lastSyncError: null,
    displayStartAt: null,
    displayEndAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('isUsableMenu — ตรง server guard POST friends/:id/rich-menu', () => {
  it('ใช้ได้เมื่อมี lineRichMenuId และไม่ถูกปิด', () => {
    expect(isUsableMenu(menu())).toBe(true);
    expect(isUsableMenu(menu({ syncStatus: 'error' }))).toBe(true);
  });

  it('ใช้ไม่ได้เมื่อยังไม่ sync ขึ้น LINE', () => {
    expect(isUsableMenu(menu({ lineRichMenuId: null, syncStatus: 'local' }))).toBe(false);
  });

  it('ใช้ไม่ได้เมื่อถูกปิดใช้งาน (server คืน 422 ข้อความเดียวกัน)', () => {
    expect(isUsableMenu(menu({ status: 'inactive' }))).toBe(false);
  });
});

describe('isSyncedMenu — ตรง resolveAliasTarget (alias create/repoint)', () => {
  it('ใช้ได้เฉพาะเมนูที่ sync สำเร็จ', () => {
    expect(isSyncedMenu(menu())).toBe(true);
  });

  it('ใช้ไม่ได้เมื่อ sync ค้าง error แม้ lineRichMenuId ยังอยู่', () => {
    expect(isSyncedMenu(menu({ syncStatus: 'error', lastSyncError: 'boom' }))).toBe(false);
    expect(isSyncedMenu(menu({ syncStatus: 'local' }))).toBe(false);
  });

  it('ใช้ไม่ได้เมื่อไม่มี lineRichMenuId', () => {
    expect(isSyncedMenu(menu({ lineRichMenuId: null, syncStatus: 'local' }))).toBe(false);
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isUsableMenu } from './menu-predicates';

function menu(over: Record<string, unknown> = {}) {
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
  it('ใช้ได้เมื่อ sync ขึ้น LINE แล้วและไม่ถูกปิด', () => {
    expect(isUsableMenu(menu())).toBe(true);
  });

  it('ใช้ไม่ได้เมื่อยังไม่ sync', () => {
    expect(isUsableMenu(menu({ lineRichMenuId: null, syncStatus: 'local' }))).toBe(false);
  });

  it('ใช้ไม่ได้เมื่อถูกปิดใช้งาน (server คืน 422 ข้อความเดียวกัน)', () => {
    expect(isUsableMenu(menu({ status: 'inactive' }))).toBe(false);
  });
});

import { describe, expect, test } from 'vitest';
import { isRichMenuDrift } from './rich-menu-service';

const BASE = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'เมนูบริการงานช่าง อบต.หัวงัว',
  chatBarText: 'เมนูหลัก',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'uri', uri: 'https://liff.line.me/X/intake' },
    },
  ],
};

describe('isRichMenuDrift', () => {
  test('config ตรงกัน → ไม่ drift', () => {
    expect(isRichMenuDrift(BASE, { ...BASE })).toBe(false);
  });

  test('areas เปลี่ยน → drift', () => {
    const edited = { ...BASE, areas: [] };
    expect(isRichMenuDrift(edited, BASE)).toBe(true);
  });

  test('key เฉพาะ local (selected) ต่างกัน → ไม่ drift', () => {
    expect(isRichMenuDrift({ ...BASE, selected: false }, BASE)).toBe(false);
  });

  test('ฝั่ง LINE ไม่มีเมนู (null) → drift (stale)', () => {
    expect(isRichMenuDrift(BASE, null)).toBe(true);
  });

  test('chatBarText เปลี่ยน → drift', () => {
    expect(isRichMenuDrift({ ...BASE, chatBarText: 'เมนู' }, BASE)).toBe(true);
  });
});

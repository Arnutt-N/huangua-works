import { describe, expect, test } from 'vitest';
import { isValidAliasId } from './rich-menu-service';

describe('isValidAliasId', () => {
  test('ตัวอักษรอังกฤษ ตัวเลข _ - ผ่าน', () => {
    expect(isValidAliasId('main-menu_v2')).toBe(true);
  });

  test('ว่าง/ยาวเกิน 50/มีช่องว่างหรืออักษรพิเศษ → ไม่ผ่าน', () => {
    expect(isValidAliasId('')).toBe(false);
    expect(isValidAliasId('a'.repeat(51))).toBe(false);
    expect(isValidAliasId('เมนูหลัก')).toBe(false);
    expect(isValidAliasId('has space')).toBe(false);
  });
});

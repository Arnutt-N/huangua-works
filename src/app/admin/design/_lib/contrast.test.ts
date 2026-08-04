import { describe, it, expect } from 'vitest';
import { contrast, flatten, levelOf, toHex } from './contrast';

/**
 * ทดสอบคณิตศาสตร์ WCAG ของหน้า /admin/design
 *
 * § ทำไมต้องมีแยกจาก tokens.contrast.test.ts
 * ไฟล์นั้นทดสอบ scripts/check-contrast.ts ซึ่งเป็นคนละ implementation — อ่าน oklch
 * จากไฟล์แล้วแปลงเอง ส่วนไฟล์นี้รับ sRGB จาก canvas ที่ browser render มาแล้ว
 * ทั้งสองใช้สูตร WCAG เหมือนกันแต่คนละโค้ด ถ้าสัมประสิทธิ์ตรงนี้พิมพ์ผิด หน้าเว็บ
 * จะรายงานตัวเลขที่ดูสมเหตุสมผลแต่ผิด และไม่มี gate ไหนจับได้เลย
 *
 * ค่าอ้างอิงเป็นค่าที่ตรวจสอบได้จากภายนอก ไม่ใช่ค่าที่ได้จากการรันโค้ดนี้เอง
 */
describe('contrast()', () => {
  it('ดำบนขาว = 21:1 (ค่าสูงสุดที่เป็นไปได้ตาม WCAG)', () => {
    expect(contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it('สีเดียวกัน = 1:1 (ค่าต่ำสุด)', () => {
    expect(contrast({ r: 120, g: 45, b: 200 }, { r: 120, g: 45, b: 200 })).toBeCloseTo(1, 10);
  });

  it('#767676 บนขาว ≈ 4.54:1 — ค่าอ้างอิงมาตรฐานที่อยู่เหนือเกณฑ์ AA พอดี', () => {
    const r = contrast({ r: 0x76, g: 0x76, b: 0x76 }, { r: 255, g: 255, b: 255 });
    expect(r).toBeGreaterThan(4.5);
    expect(r).toBeLessThan(4.6);
  });

  it('สลับ fg/bg แล้วได้ค่าเท่าเดิม — กัน regression ถ้ามีคนลบการสลับ hi/lo', () => {
    const a = { r: 30, g: 90, b: 180 };
    const b = { r: 240, g: 240, b: 250 };
    expect(contrast(a, b)).toBeCloseTo(contrast(b, a), 10);
  });

  it('ไวต่อ channel เขียวมากที่สุดตามสัมประสิทธิ์ luminance', () => {
    const onBlack = (c: { r: number; g: number; b: number }) => contrast(c, { r: 0, g: 0, b: 0 });
    const green = onBlack({ r: 0, g: 255, b: 0 });
    const red = onBlack({ r: 255, g: 0, b: 0 });
    const blue = onBlack({ r: 0, g: 0, b: 255 });
    // 0.7152 > 0.2126 > 0.0722 — ถ้าสลับสัมประสิทธิ์ ลำดับนี้จะพัง
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('toHex()', () => {
  it('เติมศูนย์หน้าให้ครบสองหลักทุก channel', () => {
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
    expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
  });
});

describe('flatten()', () => {
  it('alpha 1 = สีหน้าเต็ม, alpha 0 = สีพื้นเต็ม', () => {
    const fg = { r: 255, g: 0, b: 0 };
    const bg = { r: 0, g: 0, b: 255 };
    expect(flatten(fg, bg, 1)).toEqual(fg);
    expect(flatten(fg, bg, 0)).toEqual(bg);
  });

  it('alpha 0.5 ของขาวบนดำ = กลางพอดี', () => {
    expect(flatten({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }, 0.5)).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
  });
});

describe('levelOf()', () => {
  it('คู่ข้อความไล่ระดับตาม 7 / 4.5', () => {
    expect(levelOf(21, 'text', 4.5)).toBe('AAA');
    expect(levelOf(7, 'text', 4.5)).toBe('AAA');
    expect(levelOf(6.99, 'text', 4.5)).toBe('AA');
    expect(levelOf(4.5, 'text', 4.5)).toBe('AA');
  });

  it('คู่ข้อความที่ต่ำกว่าเกณฑ์ของตัวเอง = ไม่ผ่าน', () => {
    expect(levelOf(4.49, 'text', 4.5)).toBe('ไม่ผ่าน');
    expect(levelOf(1.5, 'text', 4.5)).toBe('ไม่ผ่าน');
  });

  it('คู่ non-text ที่ผ่าน 3:1 = "ผ่าน" ไม่ใช่ "AA-large"', () => {
    // 3:1 ของ SC 1.4.11 คือเกณฑ์เต็มของมัน ไม่ใช่การผ่อนผันให้ข้อความขนาดใหญ่
    expect(levelOf(3.26, 'non-text', 3)).toBe('ผ่าน');
    expect(levelOf(10, 'non-text', 3)).toBe('ผ่าน');
    expect(levelOf(2.99, 'non-text', 3)).toBe('ไม่ผ่าน');
  });

  it('คู่ reference ไม่ตัดสินผ่าน/ไม่ผ่าน แม้ ratio ต่ำมาก', () => {
    // เดิมคู่แบบนี้ได้ badge "fail" สีแดงทั้งที่แถวเดียวกันนับว่าผ่าน — ขัดกันเอง
    expect(levelOf(1.19, 'reference', 1)).toBe('อ้างอิง');
  });
});

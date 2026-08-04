/**
 * คำนวณ contrast จากสีที่ browser render จริง — ไม่ใช่จากตัวเลขใน tokens.css
 *
 * § ทำไมไม่ใช้ scripts/check-contrast.ts ตรง ๆ
 * สคริปต์นั้นอ่านค่า oklch จากไฟล์แล้วแปลงเองด้วย naive clipping ต่อ channel
 * ส่วน browser ใช้ CSS Color 4 gamut mapping (ลด chroma) เมื่อค่าเกินขอบเขต sRGB
 * ซึ่ง token หลายตัวของเราเกินจริง (เช่น accent-strong ที่ 42% 0.16 เกินเพดาน 0.139)
 * ตัวเลขสองฝั่งจึงไม่เท่ากัน และตัวที่ "ถูก" สำหรับผู้ใช้คือของ browser
 *
 * วิธี: วาดสีลง canvas 1×1 แล้วอ่าน pixel กลับมา — ได้ sRGB ที่ผ่าน gamut mapping
 * ของ browser แล้วจริง ไม่ต้องพึ่งสูตรที่เราเขียนเอง
 */

import type { PairKind } from '@/lib/design/contrast-pairs';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

let ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    // ความล้มเหลวระดับ "วัดอะไรไม่ได้ทั้งหน้า" ต้องไม่เงียบ
    console.error('[design] canvas 2d context ใช้ไม่ได้ — วัดสีไม่ได้ทั้งหน้า');
  }
  return ctx;
}

/**
 * แปลงค่าสี CSS อะไรก็ได้ (oklch, var(), hex) → sRGB ที่ browser จะแสดงจริง
 *
 * § ตรวจว่า fillStyle รับค่าไปจริงก่อนวาด
 * ตาม spec ของ canvas การ set fillStyle ด้วยสีที่ parse ไม่ได้จะถูก "เพิกเฉยเงียบ ๆ"
 * ค่าก่อนหน้าจะคงอยู่ ถ้าไม่ตรวจตรงนี้ ค่าที่ผิดจะกลายเป็นสีดำที่ดูเหมือนผลวัดจริง
 * แล้วให้ contrast สูง ๆ กับพื้นสว่าง (~19:1) → รายงานว่า "AAA ผ่านสวยงาม" ทั้งที่
 * token นั้นพัง ซึ่งอันตรายกว่าไม่แสดงผลเลย
 */
export function resolveToRgb(cssColor: string): Rgb | null {
  const c = getCtx();
  if (!c) return null;

  // ใช้ sentinel ที่ไม่มีทางเป็นค่าจริง แล้วดูว่า fillStyle เปลี่ยนไปหรือไม่หลัง assign
  const sentinel = '#010203';
  c.fillStyle = sentinel;
  c.fillStyle = cssColor;
  if (c.fillStyle === sentinel && cssColor.trim().toLowerCase() !== sentinel) {
    return null; // parse ไม่ผ่าน — ให้ผู้เรียกแสดงว่า "วัดไม่ได้" แทนสีดำปลอม ๆ
  }

  c.clearRect(0, 0, 1, 1);
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0 };
}

/** อ่านค่า CSS custom property จาก :root แล้ว resolve เป็น sRGB */
export function tokenToRgb(tokenName: string): Rgb | null {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();
  if (!raw) return null;
  return resolveToRgb(raw);
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** relative luminance ตาม WCAG 2.x */
function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** ทับสีที่มี alpha ลงบนพื้น เพื่อให้เทียบ contrast ได้ (WCAG ต้องการสีทึบ) */
export function flatten(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

export type Level = 'AAA' | 'AA' | 'AA-large' | 'ผ่าน' | 'อ้างอิง' | 'ไม่ผ่าน';

/**
 * ตัดสินระดับตามเกณฑ์ "ของคู่นั้น" ไม่ใช่เกณฑ์ตายตัว
 *
 * § เดิมฟังก์ชันนี้รับแค่ ratio แล้วเทียบกับ 7/4.5/3 ตายตัว ทำให้เกิดสองปัญหา
 * 1) คู่ที่ตั้ง min ต่ำโดยตั้งใจ (เช่นพื้นไอคอนที่ไม่มีข้อกำหนด contrast) ได้ป้าย
 *    "fail" สีแดง ทั้งที่แถวเดียวกันนับเป็น "ผ่าน" เพราะ ratio >= min — ขัดกันเอง
 * 2) คู่ non-text ที่ได้ 3.x:1 ถูกป้ายว่า "AA-large" ซึ่งเป็นศัพท์ของ SC 1.4.3
 *    (ผ่อนผันให้ข้อความขนาดใหญ่) ทั้งที่จริงคือผ่าน SC 1.4.11 เต็มเกณฑ์ของมัน
 *
 * ตอนนี้จึงตัดสินจาก kind + min ของคู่นั้นก่อน แล้วค่อยไล่ระดับ AA/AAA เฉพาะคู่
 * ที่เป็นข้อความจริง ซึ่งเป็นที่เดียวที่คำว่า AA/AAA มีความหมาย
 */
export function levelOf(ratio: number, kind: PairKind, min: number): Level {
  if (kind === 'reference') return 'อ้างอิง';
  if (ratio < min) return 'ไม่ผ่าน';
  if (kind === 'non-text') return 'ผ่าน';
  // kind === 'text' — ไล่ระดับตาม SC 1.4.3 / 1.4.6
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'AA-large';
}

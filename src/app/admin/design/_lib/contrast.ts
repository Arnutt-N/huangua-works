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
  return ctx;
}

/** แปลงค่าสี CSS อะไรก็ได้ (oklch, var(), hex) → sRGB ที่ browser จะแสดงจริง */
export function resolveToRgb(cssColor: string): Rgb | null {
  const c = getCtx();
  if (!c) return null;
  // เคลียร์ก่อนเพื่อไม่ให้สีเดิมค้างเมื่อ fillStyle ที่ส่งมาไม่ถูกต้อง
  c.clearRect(0, 0, 1, 1);
  c.fillStyle = '#000';
  c.fillStyle = cssColor;
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

export type Level = 'AAA' | 'AA' | 'AA-large' | 'fail';

/** เกณฑ์ WCAG 2.2: ข้อความปกติ 4.5 / ข้อความใหญ่+องค์ประกอบที่ไม่ใช่ข้อความ 3 / AAA 7 */
export function levelOf(ratio: number): Level {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

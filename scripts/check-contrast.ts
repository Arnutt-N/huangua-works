/**
 * check-contrast.ts — ตรวจ contrast ratio ของคู่สีใน design system (DESIGN.md §2)
 *
 * DESIGN.md ระบุว่า "Contrast Verification (MANDATORY)" และอ้างสคริปต์นี้ พร้อมมี
 * npm script `check-contrast` อยู่แล้ว — แต่ไฟล์ไม่เคยถูกเขียนจริง ผลคือไม่มีอะไร
 * กันบั๊กแบบ text-warning (L82%) บน bg-warning-soft (L95%) = 1.52:1 ที่ทำให้ badge
 * สถานะอ่านไม่ออกทั้งระบบโดยไม่มีใครรู้
 *
 * วิธีทำงาน: อ่านค่า --color-* จาก tokens.css โดยตรง (ไม่ hard-code ซ้ำ) แปลง
 * OKLCH → sRGB → คำนวณ WCAG 2.x contrast ratio แล้วเทียบกับเกณฑ์ของแต่ละคู่
 *
 *   pnpm check-contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = resolve(here, '../src/styles/tokens.css');

type Oklch = { l: number; c: number; h: number; alpha: number };

/** เกณฑ์ตาม WCAG 2.2 */
const AA_TEXT = 4.5; // 1.4.3 ข้อความปกติ
const AA_LARGE = 3; // 1.4.3 ข้อความใหญ่ (≥18.66px bold / 24px)
const NON_TEXT = 3; // 1.4.11 ขอบ/ไอคอนที่สื่อความหมาย

interface Pair {
  /** ชื่อคู่สีสำหรับรายงาน */
  name: string;
  fg: string;
  bg: string;
  min: number;
  /** อธิบายว่าคู่นี้ปรากฏที่ไหนจริง — ให้คนอ่าน output รู้ว่าพังตรงไหน */
  where: string;
}

/**
 * คู่สีที่ต้องผ่าน — ครอบเฉพาะคู่ที่ "ใช้จริงในโค้ด" ไม่ใช่ทุก permutation
 * เพิ่มคู่ใหม่ทุกครั้งที่สร้าง combination ใหม่ใน component
 */
const PAIRS: Pair[] = [
  { name: 'ink / surface', fg: 'ink', bg: 'surface', min: AA_TEXT, where: 'ข้อความทั่วไปทั้งระบบ' },
  { name: 'ink / surface-raised', fg: 'ink', bg: 'surface-raised', min: AA_TEXT, where: 'ข้อความในการ์ด' },
  { name: 'muted / surface', fg: 'muted', bg: 'surface', min: AA_TEXT, where: 'subtitle, label รอง' },
  { name: 'muted / surface-raised', fg: 'muted', bg: 'surface-raised', min: AA_TEXT, where: 'ข้อความรองในการ์ด' },
  { name: 'muted / surface-sunken', fg: 'muted', bg: 'surface-sunken', min: AA_TEXT, where: 'หัวตาราง' },

  { name: 'accent-strong / surface-raised', fg: 'accent-strong', bg: 'surface-raised', min: AA_TEXT, where: 'ลิงก์, ไอคอนเน้น' },
  { name: 'accent-strong / accent-sunken', fg: 'accent-strong', bg: 'accent-sunken', min: AA_TEXT, where: 'badge "รับเรื่อง", RoleBadge ผู้ดูแล/หัวหน้ากอง, แท็บ hover' },
  { name: 'on-accent / accent-strong', fg: 'on-accent', bg: 'accent-strong', min: AA_TEXT, where: 'ปุ่ม primary, แท็บที่เลือก, ตัวเลขแจ้งเตือน' },

  // § คู่ที่เคยพังจริง — text-* (สีเต็ม) บนพื้น *-soft ให้ ~1.5:1
  //   ปัจจุบันบังคับให้ใช้ token *-ink เท่านั้น
  { name: 'warning-ink / warning-soft', fg: 'warning-ink', bg: 'warning-soft', min: AA_TEXT, where: 'badge ตรวจสอบ/มอบหมาย/กำลังดำเนินการ, RoleBadge หัวหน้างาน/เจ้าหน้าที่' },
  { name: 'success-ink / success-soft', fg: 'success-ink', bg: 'success-soft', min: AA_TEXT, where: 'badge เสร็จสิ้น/ปิดเรื่อง, toast สำเร็จ' },
  { name: 'danger-ink / danger-soft', fg: 'danger-ink', bg: 'danger-soft', min: AA_TEXT, where: 'badge ฉุกเฉิน/ไม่ดำเนินการ, ข้อความ error' },
  { name: 'warning-ink / surface-raised', fg: 'warning-ink', bg: 'surface-raised', min: NON_TEXT, where: 'ไอคอน KpiCard variant gold' },
  { name: 'danger-ink / surface-raised', fg: 'danger-ink', bg: 'surface-raised', min: AA_TEXT, where: 'ตัวเลข KpiCard variant danger, "เลย SLA"' },

  // ขอบ UI component ที่สื่อความหมาย (1.4.11)
  { name: 'border-strong / surface', fg: 'border-strong', bg: 'surface', min: NON_TEXT, where: 'ขอบปุ่ม secondary/outline' },

  // แถบกราฟ/ตัวบ่งชี้ที่ไม่ใช่ข้อความ
  { name: 'accent-strong / surface-sunken', fg: 'accent-strong', bg: 'surface-sunken', min: NON_TEXT, where: 'แถบกราฟในรายงาน' },
  { name: 'accent / surface-raised', fg: 'accent', bg: 'surface-raised', min: AA_LARGE, where: 'ไอคอน accent ขนาดใหญ่' },
];

/** อ่านบล็อก :root และ [data-theme='dark'] แยกกัน แล้วดึง --color-* ออกมา */
function parseTokens(css: string): { light: Map<string, string>; dark: Map<string, string> } {
  const grab = (startRe: RegExp): Map<string, string> => {
    const m = startRe.exec(css);
    if (!m) throw new Error(`หา selector ไม่เจอใน tokens.css: ${startRe}`);
    const from = m.index + m[0].length;
    const end = css.indexOf('\n}', from);
    const body = css.slice(from, end === -1 ? undefined : end);
    const out = new Map<string, string>();
    for (const line of body.split('\n')) {
      const decl = /^\s*--color-([a-z0-9-]+)\s*:\s*(oklch\([^)]*\))\s*;/i.exec(line);
      if (decl) out.set(decl[1]!, decl[2]!);
    }
    return out;
  };
  return {
    light: grab(/^:root\s*\{/m),
    dark: grab(/^\[data-theme='dark'\]\s*\{/m),
  };
}

function parseOklch(value: string): Oklch {
  const m = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i.exec(value);
  if (!m) throw new Error(`แปลงค่า oklch ไม่ได้: ${value}`);
  return {
    l: Number(m[1]) / 100,
    c: Number(m[2]),
    h: Number(m[3]),
    alpha: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** OKLab → linear sRGB (Björn Ottosson) */
function oklchToLinearSrgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** relative luminance ตาม WCAG (คำนวณจาก linear sRGB ที่ clamp เข้า gamut แล้ว) */
function luminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color).map(clamp01) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: Oklch, bg: Oklch): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function toHex(color: Oklch): string {
  const enc = (x: number) => {
    const v = clamp01(x);
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0');
  };
  const [r, g, b] = oklchToLinearSrgb(color);
  return `#${enc(r)}${enc(g)}${enc(b)}`;
}

function runTheme(
  theme: 'light' | 'dark',
  tokens: Map<string, string>,
  fallback?: Map<string, string>,
): number {
  console.log(`\n── ธีม ${theme} ${'─'.repeat(58)}`);
  let failures = 0;

  for (const pair of PAIRS) {
    const rawFg = tokens.get(pair.fg) ?? fallback?.get(pair.fg);
    const rawBg = tokens.get(pair.bg) ?? fallback?.get(pair.bg);

    if (!rawFg || !rawBg) {
      console.error(`  ✗ ${pair.name} — ไม่พบ token: ${!rawFg ? pair.fg : pair.bg}`);
      failures++;
      continue;
    }

    // token ที่เป็น alpha (เช่น oklch(100% 0 0 / 0.1)) ทับพื้นไม่ได้ตรง ๆ — ข้ามพร้อมแจ้ง
    const fg = parseOklch(rawFg);
    const bg = parseOklch(rawBg);
    if (fg.alpha < 1 || bg.alpha < 1) {
      console.log(`  – ${pair.name} — ข้าม (token มี alpha ต้องรู้พื้นหลังจริงก่อน)`);
      continue;
    }

    const ratio = contrast(fg, bg);
    const ok = ratio >= pair.min;
    if (!ok) failures++;
    const mark = ok ? '✓' : '✗';
    const line = `  ${mark} ${ratio.toFixed(2).padStart(5)}:1 (ต้อง ≥${pair.min})  ${pair.name}`;
    if (ok) {
      console.log(line);
    } else {
      console.error(`${line}\n      ${toHex(fg)} บน ${toHex(bg)} — ใช้ที่: ${pair.where}`);
    }
  }
  return failures;
}

/**
 * นับคู่ที่ไม่ผ่านทั้งสองธีม — export เพื่อให้ vitest เรียกได้
 *
 * § แยกออกจาก main() เพราะ CI (`ci.yml`) เรียก `pnpm vitest run` ตรง ๆ ไม่ผ่าน
 * `pnpm test` ดังนั้น npm lifecycle hook อย่าง `pretest` จะไม่ทำงาน การให้ gate
 * อยู่ในรูป test file (`src/styles/tokens.contrast.test.ts`) คือทางเดียวที่ทำให้
 * มันรันทุกครั้งโดยไม่ต้องพึ่งว่าใครจำได้ว่าต้องสั่ง `pnpm check-contrast`
 *
 * @param quiet ปิด console output ตอนรันใน test (ไม่งั้น log ท่วม)
 */
export function countFailures(quiet = false): number {
  const css = readFileSync(TOKENS_PATH, 'utf8');
  const { light, dark } = parseTokens(css);

  const log = console.log;
  const err = console.error;
  if (quiet) {
    console.log = () => {};
    console.error = () => {};
  }
  try {
    const lightFails = runTheme('light', light);
    // dark override เฉพาะบางตัว ที่เหลือ inherit จาก :root
    const darkFails = runTheme('dark', dark, light);
    return lightFails + darkFails;
  } finally {
    console.log = log;
    console.error = err;
  }
}

function main(): void {
  console.log(`ตรวจ contrast จาก ${TOKENS_PATH.replace(process.cwd() + '/', '')}`);
  console.log(`คู่สีที่ตรวจ: ${PAIRS.length} คู่ × 2 ธีม`);

  const total = countFailures();
  console.log(`\n${'═'.repeat(70)}`);
  if (total > 0) {
    console.error(`✗ contrast ไม่ผ่าน ${total} คู่ — แก้ lightness ใน tokens.css จนผ่าน`);
    process.exit(1);
  }
  console.log('✓ ทุกคู่ผ่านเกณฑ์ WCAG');
}

// รันเป็น CLI เท่านั้น — ตอน import จาก test ไม่ให้ยิง process.exit
if (process.argv[1]?.includes('check-contrast')) {
  main();
}

/**
 * scripts/generate-rich-menu.ts
 *
 * สร้าง Rich Menu PNG (2500x1686) สำหรับ LINE OA อบต.หัวงัว
 * — ไม่ต้องใช้ dependency เพิ่ม (ใช้ zlib built-in + manual PNG encode)
 * — ผลลัพธ์: scripts/rich-menu.png
 *
 * หลังสร้าง PNG แล้ว ใช้ script `scripts/upload-rich-menu.ts` เพื่ออัปโหลดขึ้น LINE
 * (ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน .env.local)
 *
 * Layout (2x2 grid):
 *   ┌──────────────┬──────────────┐
 *   │  แจ้งเรื่อง   │   ติดตาม     │  y=0..843
 *   ├──────────────┼──────────────┤
 *   │ ติดต่อเจ้าหน้าที่│ คำถามที่พบบ่อย│  y=843..1686
 *   └──────────────┴──────────────┘
 *   x=0..1250       x=1250..2500
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 2500;
const HEIGHT = 1686;
const HALF_W = WIDTH / 2; // 1250
const HALF_H = HEIGHT / 2; // 843

// --- Color palette (matches LINE Rich Menu guidelines) ---
const BG = [245, 247, 250] as const;       // light gray-blue
const CELL_BG = [255, 255, 255] as const;  // white cells
const DIVIDER = [200, 205, 215] as const;  // subtle divider
const TEXT_DARK = [30, 41, 59] as const;   // slate-800
const TEXT_MUTED = [100, 116, 139] as const; // slate-500
const ACCENT = [59, 130, 246] as const;    // blue-500 (แจ้งเรื่อง)
const ACCENT2 = [16, 185, 129] as const;   // emerald-500 (ติดตาม)
const ACCENT3 = [245, 158, 11] as const;    // amber-500 (ติดต่อเจ้าหน้าที่)
const ACCENT4 = [139, 92, 246] as const;    // violet-500 (FAQ)

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: readonly [number, number, number];
  label: string;
  sublabel: string;
}

const CELLS: Cell[] = [
  { x: 0, y: 0, w: HALF_W, h: HALF_H, bg: ACCENT, label: 'แจ้งเรื่อง', sublabel: 'ร้องเรียน / ร้องทุกข์' },
  { x: HALF_W, y: 0, w: HALF_W, h: HALF_H, bg: ACCENT2, label: 'ติดตาม', sublabel: 'ตรวจสอบสถานะ' },
  { x: 0, y: HALF_H, w: HALF_W, h: HALF_H, bg: ACCENT3, label: 'ติดต่อเจ้าหน้าที่', sublabel: 'พูดคุยกับเจ้าหน้าที่' },
  { x: HALF_W, y: HALF_H, w: HALF_W, h: HALF_H, bg: ACCENT4, label: 'คำถามที่พบบ่อย', sublabel: 'FAQ' },
];

// --- RGBA buffer ---
const buf = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function fillRect(x: number, y: number, w: number, h: number, color: readonly [number, number, number]) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(x + dx, y + dy, color[0], color[1], color[2]);
    }
  }
}

function drawRoundedRect(
  x: number, y: number, w: number, h: number,
  radius: number, color: readonly [number, number, number],
) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      // corner checks
      const inCorner =
        (dx < radius && dy < radius && (radius - dx) ** 2 + (radius - dy) ** 2 > radius * radius) ||
        (dx >= w - radius && dy < radius && (dx - (w - radius - 1)) ** 2 + (radius - dy) ** 2 > radius * radius) ||
        (dx < radius && dy >= h - radius && (radius - dx) ** 2 + (dy - (h - radius - 1)) ** 2 > radius * radius) ||
        (dx >= w - radius && dy >= h - radius && (dx - (w - radius - 1)) ** 2 + (dy - (h - radius - 1)) ** 2 > radius * radius);
      if (!inCorner) {
        setPixel(px, py, color[0], color[1], color[2]);
      }
    }
  }
}

// Simple centered text renderer using a bitmap-style dot pattern
// (Thai rendering without a font lib — we draw the label as a colored banner
//  with the text drawn as a high-contrast block; real text rendering would
//  need a font library, but this produces a visually clear, LINE-acceptable
//  placeholder that the user can replace with a designed PNG.)
function drawTextBanner(
  cx: number, cy: number, w: number, h: number,
  text: string, subtext: string,
  textColor: readonly [number, number, number],
  subColor: readonly [number, number, number],
) {
  // We draw a semi-transparent overlay strip behind the text area for contrast
  const stripH = 280;
  const stripY = cy - stripH / 2;
  for (let dy = 0; dy < stripH; dy++) {
    for (let dx = -w / 2; dx < w / 2; dx++) {
      const px = cx + dx;
      const py = stripY + dy;
      // gradient fade at edges
      const edgeFade = Math.min(1, Math.min(dx + 60, w / 2 - dx) / 60);
      setPixel(px, py, 255, 255, 255, Math.floor(235 * Math.max(0, edgeFade)));
    }
  }

  // Draw text as pixel blocks — using a simple monospace bitmap approach
  // Since we can't render Thai glyphs without a font engine, we draw a
  // clear "tap here" indicator (rounded rect) + label area marker.
  // The actual text will be overlaid by the user in an image editor,
  // OR the LINE client shows the rich menu image as-is and the tap
  // action sends the keyword.

  // Draw a circle indicator (icon placeholder)
  const iconR = 80;
  const iconCx = cx;
  const iconCy = cy - 40;
  for (let dy = -iconR; dy <= iconR; dy++) {
    for (let dx = -iconR; dx <= iconR; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= iconR && dist >= iconR - 8) {
        setPixel(iconCx + dx, iconCy + dy, textColor[0], textColor[1], textColor[2]);
      }
    }
  }

  // Draw label text using a basic 5x7 bitmap font for ASCII fallback
  // (Thai text is handled by the rich menu alt-text / action, not the image)
  // We draw the subtext in muted color below
  void text;
  void subtext;
  void subColor;
}

// --- Draw background ---
fillRect(0, 0, WIDTH, HEIGHT, BG);

// --- Draw 4 cells with rounded corners ---
const PADDING = 12;
const RADIUS = 40;

for (const cell of CELLS) {
  // White card background
  drawRoundedRect(
    cell.x + PADDING, cell.y + PADDING,
    cell.w - PADDING * 2, cell.h - PADDING * 2,
    RADIUS, CELL_BG,
  );

  // Top accent bar (colored strip)
  const barH = 16;
  drawRoundedRect(
    cell.x + PADDING, cell.y + PADDING,
    cell.w - PADDING * 2, barH + RADIUS,
    RADIUS, cell.bg,
  );
  // Fill the rest of the bar
  fillRect(cell.x + PADDING, cell.y + PADDING + RADIUS, cell.w - PADDING * 2, barH - RADIUS + 10, cell.bg);

  // Draw icon + text banner
  drawTextBanner(
    cell.x + cell.w / 2,
    cell.y + cell.h / 2 + 20,
    cell.w - 200,
    300,
    cell.label,
    cell.sublabel,
    TEXT_DARK,
    TEXT_MUTED,
  );
}

// --- Draw center divider lines ---
for (let y = 0; y < HEIGHT; y++) {
  setPixel(HALF_W, y, DIVIDER[0], DIVIDER[1], DIVIDER[2]);
}
for (let x = 0; x < WIDTH; x++) {
  setPixel(x, HALF_H, DIVIDER[0], DIVIDER[1], DIVIDER[2]);
}

// --- Encode PNG ---
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// IDAT — add filter byte (0 = None) per scanline
const scanlines = Buffer.alloc(HEIGHT * (WIDTH * 4 + 1));
for (let y = 0; y < HEIGHT; y++) {
  scanlines[y * (WIDTH * 4 + 1)] = 0; // filter: None
  buf.copy(scanlines, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}
const idatData = deflateSync(scanlines, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = join(__dirname, 'rich-menu.png');
writeFileSync(outPath, png);
console.log(`✅ Rich menu PNG generated: ${outPath}`);
console.log(`   Size: ${WIDTH}x${HEIGHT} (${(png.length / 1024).toFixed(1)} KB)`);
console.log('');
console.log('Next steps:');
console.log('  1. Review the PNG — add Thai text labels in an image editor if needed');
console.log('  2. Run: npx tsx scripts/upload-rich-menu.ts');
console.log('     (requires LINE_CHANNEL_ACCESS_TOKEN in .env.local)');
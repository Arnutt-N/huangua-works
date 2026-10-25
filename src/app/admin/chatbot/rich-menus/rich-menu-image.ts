// § LINE รับ content ของ rich menu ไม่เกิน 1 MB (413) — ย่อฝั่ง client ก่อนอัปโหลด
// รูปที่พอดีอยู่แล้วผ่านไปเฉย ๆ (ไม่ re-encode เพื่อรักษา alpha ของ PNG)

import { RICH_MENU_IMAGE_LIMIT_BYTES } from '@/lib/contracts';

export const RICH_MENU_IMAGE_MAX_W = 2500;
export const RICH_MENU_IMAGE_MAX_H = 1686;

export const RICH_MENU_FIT_GUIDANCE =
  'ย่อรูปอัตโนมัติไม่ได้ — โปรดใช้รูปไม่เกิน 1 MB หรือย่อที่หน้า /admin/image-resize ก่อนอัปโหลด';

export interface RichMenuFitAttempt {
  scale: number;
  quality: number;
}

export function planRichMenuFit(fileSize: number): {
  fits: boolean;
  attempts: RichMenuFitAttempt[];
} {
  if (fileSize <= RICH_MENU_IMAGE_LIMIT_BYTES) return { fits: true, attempts: [] };
  const attempts: RichMenuFitAttempt[] = [];
  for (const scale of [1, 0.75, 0.5, 0.35]) {
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      attempts.push({ scale, quality });
    }
  }
  return { fits: false, attempts };
}

export function scaledToFit(
  width: number,
  height: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const ratio = Math.min(maxW / width, maxH / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** § fits:false คือผลที่ถูกต้องได้ — ย่อจนสุดแล้วยังเกิน 1 MB ให้ server 413 เป็นผู้ตัดสิน */
export type FitRichMenuImageResult =
  | { fits: true; converted: false; file: File; filename: string }
  | { fits: true; converted: true; file: Blob; filename: string }
  | { fits: false; converted: true; file: Blob; filename: string };

function canvasSupported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

async function tryDecodeBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

async function decodeSource(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  const bitmap = await tryDecodeBitmap(file);
  if (bitmap) {
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่ได้'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function encodeJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(RICH_MENU_FIT_GUIDANCE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error(RICH_MENU_FIT_GUIDANCE);
  return blob;
}

function jpegFilename(name: string): string {
  return `${name.replace(/\.[^.]+$/, '') || 'image'}.jpg`;
}

export async function fitRichMenuImage(file: File): Promise<FitRichMenuImageResult> {
  if (file.size <= RICH_MENU_IMAGE_LIMIT_BYTES) {
    return { fits: true, converted: false, file, filename: file.name };
  }
  if (typeof document === 'undefined' || !canvasSupported()) {
    throw new Error(RICH_MENU_FIT_GUIDANCE);
  }

  const decoded = await decodeSource(file);
  try {
    const target = scaledToFit(decoded.width, decoded.height, RICH_MENU_IMAGE_MAX_W, RICH_MENU_IMAGE_MAX_H);
    let best: Blob | null = null;
    for (const { scale, quality } of planRichMenuFit(file.size).attempts) {
      const blob = await encodeJpeg(
        decoded.source,
        Math.max(1, Math.round(target.width * scale)),
        Math.max(1, Math.round(target.height * scale)),
        quality,
      );
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= RICH_MENU_IMAGE_LIMIT_BYTES) {
        return { fits: true, converted: true, file: blob, filename: jpegFilename(file.name) };
      }
    }
    if (!best) throw new Error(RICH_MENU_FIT_GUIDANCE);
    return { fits: false, converted: true, file: best, filename: jpegFilename(file.name) };
  } finally {
    decoded.release();
  }
}

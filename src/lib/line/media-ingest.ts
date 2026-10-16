import { generateId } from '@/lib/id';
import { isStorageConfigured, uploadFile } from '@/lib/storage';
import { getMessageContent } from './client';

// § เพดานเดียวกับ admin media (10 MB) ตัดสินใน Review Gate ของ PRP line-gap-closure
export const MAX_LINE_MEDIA_BYTES = 10 * 1024 * 1024;

export type MediaIngestResult =
  | { kind: 'stored'; url: string; contentType: string; sizeBytes: number }
  | { kind: 'skipped'; reason: 'too_large' | 'unsupported' | 'download_failed' | 'storage_unconfigured' };

export interface MediaIngestDeps {
  isConfigured: () => boolean;
  download: (messageId: string) => Promise<{ bytes: Uint8Array; contentType: string | null }>;
  upload: (key: string, body: Buffer, contentType: string) => Promise<string>;
}

const defaultDeps: MediaIngestDeps = {
  isConfigured: isStorageConfigured,
  download: (messageId) => getMessageContent(messageId),
  upload: (key, body, contentType) => uploadFile(key, body, contentType),
};

/** ตรวจชนิดไฟล์จาก magic bytes เท่านั้น ไม่เชื่อ Content-Type ที่อีกฝั่งบอก */
export function sniffLineMediaMime(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    return brand.startsWith('M4A') || brand.startsWith('m4a')
      ? { mime: 'audio/mp4', ext: 'm4a' }
      : { mime: 'video/mp4', ext: 'mp4' };
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { mime: 'audio/wav', ext: 'wav' };
  }
  return null;
}

/**
 * ดึงสื่อที่ประชาชนส่งทาง LINE มาเก็บใน storage ของระบบ
 * ทุกความล้มเหลวคืน skipped ไม่ throw เพราะ webhook ต้องบันทึกข้อความต่อให้ได้
 */
export async function ingestLineMedia(
  messageId: string,
  deps: MediaIngestDeps = defaultDeps,
): Promise<MediaIngestResult> {
  if (!deps.isConfigured()) return { kind: 'skipped', reason: 'storage_unconfigured' };

  let bytes: Uint8Array;
  try {
    ({ bytes } = await deps.download(messageId));
  } catch {
    return { kind: 'skipped', reason: 'download_failed' };
  }

  if (bytes.byteLength > MAX_LINE_MEDIA_BYTES) return { kind: 'skipped', reason: 'too_large' };

  const sniffed = sniffLineMediaMime(bytes);
  if (!sniffed) return { kind: 'skipped', reason: 'unsupported' };

  const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const key = `line-inbound/${safeId}/${generateId()}.${sniffed.ext}`;
  try {
    const url = await deps.upload(key, Buffer.from(bytes), sniffed.mime);
    return { kind: 'stored', url, contentType: sniffed.mime, sizeBytes: bytes.byteLength };
  } catch {
    return { kind: 'skipped', reason: 'download_failed' };
  }
}

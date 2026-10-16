import { describe, expect, it, vi } from 'vitest';
import { ingestLineMedia, sniffLineMediaMime, MAX_LINE_MEDIA_BYTES } from './media-ingest';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe('sniffLineMediaMime', () => {
  it('jpeg จาก magic bytes', () => {
    expect(sniffLineMediaMime(JPEG)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });
  it('png จาก magic bytes', () => {
    expect(sniffLineMediaMime(PNG)).toEqual({ mime: 'image/png', ext: 'png' });
  });
  it('ไม่รู้จัก → null', () => {
    expect(sniffLineMediaMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('ingestLineMedia', () => {
  const baseDeps = {
    isConfigured: () => true,
    download: async () => ({ bytes: JPEG, contentType: 'image/jpeg' }),
    upload: vi.fn(async (key: string) => `https://files.example/${key}`),
  };

  it('เก็บสำเร็จ → url + mime + ขนาด', async () => {
    const result = await ingestLineMedia('msg-1', baseDeps);
    expect(result.kind).toBe('stored');
    if (result.kind === 'stored') {
      expect(result.url).toContain('line-inbound/msg-1/');
      expect(result.contentType).toBe('image/jpeg');
      expect(result.sizeBytes).toBe(JPEG.byteLength);
    }
  });

  it('เกินเพดาน → skipped too_large ไม่ upload', async () => {
    const upload = vi.fn(async () => 'x');
    const big = new Uint8Array(MAX_LINE_MEDIA_BYTES + 1);
    big.set(JPEG.slice(0, 3));
    const result = await ingestLineMedia('msg-2', {
      ...baseDeps,
      download: async () => ({ bytes: big, contentType: 'image/jpeg' }),
      upload,
    });
    expect(result).toEqual({ kind: 'skipped', reason: 'too_large' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('ชนิดไม่รองรับ → skipped unsupported', async () => {
    const result = await ingestLineMedia('msg-3', {
      ...baseDeps,
      download: async () => ({ bytes: new Uint8Array([9, 9, 9]), contentType: 'application/zip' }),
    });
    expect(result).toEqual({ kind: 'skipped', reason: 'unsupported' });
  });

  it('download ล้ม → skipped download_failed ไม่ throw', async () => {
    const result = await ingestLineMedia('msg-4', {
      ...baseDeps,
      download: async () => {
        throw new Error('LINE down');
      },
    });
    expect(result).toEqual({ kind: 'skipped', reason: 'download_failed' });
  });

  it('storage ไม่ได้ตั้งค่า → skipped storage_unconfigured ไม่ download', async () => {
    const download = vi.fn(async () => ({ bytes: JPEG, contentType: 'image/jpeg' }));
    const result = await ingestLineMedia('msg-5', { ...baseDeps, isConfigured: () => false, download });
    expect(result).toEqual({ kind: 'skipped', reason: 'storage_unconfigured' });
    expect(download).not.toHaveBeenCalled();
  });
});

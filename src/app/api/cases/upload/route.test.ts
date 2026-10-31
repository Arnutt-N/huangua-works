import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, sniffImageMime } from './route';

// Mocks
vi.mock('@/lib/storage', () => ({
  isStorageConfigured: vi.fn(() => true),
  uploadFile: vi.fn(async (key: string) => `https://storage.huangua.go.th/media/${key}`),
}));

vi.mock('@/lib/rate-limit/enforce', () => ({
  enforceRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, reset: 300 })),
}));

import { isStorageConfigured, uploadFile } from '@/lib/storage';
import { enforceRateLimit } from '@/lib/rate-limit/enforce';

function createPngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function createJpegBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function createWebpBuffer(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  return buf;
}

describe('sniffImageMime', () => {
  it('ตรวจจับไฟล์ JPEG ได้ถูกต้อง', () => {
    const result = sniffImageMime(createJpegBuffer());
    expect(result).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  it('ตรวจจับไฟล์ PNG ได้ถูกต้อง', () => {
    const result = sniffImageMime(createPngBuffer());
    expect(result).toEqual({ mime: 'image/png', ext: 'png' });
  });

  it('ตรวจจับไฟล์ WebP ได้ถูกต้อง', () => {
    const result = sniffImageMime(createWebpBuffer());
    expect(result).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  it('ปฏิเสธไฟล์ที่ไม่ใช่ภาพหรือ Magic bytes ไม่ตรง', () => {
    const fake = Buffer.from('NOT_AN_IMAGE_FILE');
    expect(sniffImageMime(fake)).toBeNull();
  });
});

describe('POST /api/cases/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: true, remaining: 9, reset: 300 });
  });

  it('ตอบกลับ 503 เมื่อ Object Storage ยังไม่ได้คอนฟิก', async () => {
    vi.mocked(isStorageConfigured).mockReturnValue(false);

    const formData = new FormData();
    formData.append('file', new File([new Uint8Array(createPngBuffer())], 'test.png', { type: 'image/png' }));

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('ยังไม่เปิดใช้งาน');
  });

  it('ตอบกลับ 400 เมื่อไม่ได้ส่งไฟล์มาใน formData', async () => {
    const formData = new FormData();

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ไม่พบไฟล์');
  });

  it('ตอบกลับ 413 เมื่อไฟล์มีขนาดเกิน 10MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    createPngBuffer().copy(bigBuffer);
    const bigFile = new File([new Uint8Array(bigBuffer)], 'big.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', bigFile);

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('ตอบกลับ 415 เมื่อ Content-Type และ Magic bytes ไม่ตรง (ไฟล์ปลอม)', async () => {
    const fakeFile = new File([new Uint8Array(Buffer.from('TEXT_FILE'))], 'fake.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', fakeFile);

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toContain('รองรับเฉพาะไฟล์ภาพ');
  });

  it('อัปโหลดไฟล์ PNG สำเร็จ → ได้รับ 201 พร้อม url และ key ในเคส prefix', async () => {
    const pngFile = new File([new Uint8Array(createPngBuffer())], 'photo.png', { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', pngFile);

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.type).toBe('image/png');
    expect(body.key).toMatch(/^cases\/attachments\/.+\.png$/);
    expect(body.url).toContain(body.key);
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('ตอบกลับ 429 เมื่อถูก Rate Limit', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({ allowed: false, remaining: 0, reset: 180 });

    const formData = new FormData();
    formData.append('file', new File([new Uint8Array(createPngBuffer())], 'test.png', { type: 'image/png' }));

    const req = new NextRequest('http://localhost:3000/api/cases/upload', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('อัปโหลดไฟล์ถี่เกินไป');
  });
});

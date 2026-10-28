import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyFromUrl } from './storage';

/**
 * § URL ที่ uploadFile เก็บลง DB คือ `${S3_ENDPOINT}/${bucket}/${key}` — keyFromUrl
 * ต้องเป็นตัวผกผันของสตริงนั้น ไม่ใช่การนับ slash เพราะ endpoint ของ Supabase
 * มี path prefix (`/storage/v1/s3`) ทำให้ slice(4) คืน `v1/s3/media/<key>`
 * แล้ว object บน S3 ไม่เคยถูกลบจริง
 */

const BUCKET = 'media';

function stubStorage(endpoint: string, bucket = BUCKET) {
  vi.stubEnv('S3_ENDPOINT', endpoint);
  vi.stubEnv('S3_BUCKET', bucket);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('keyFromUrl', () => {
  it('คืน key จาก URL ที่ endpoint ไม่มี path prefix', () => {
    stubStorage('http://localhost:9000');
    expect(keyFromUrl('http://localhost:9000/media/general/x.jpg')).toBe('general/x.jpg');
  });

  it('คืน key จาก URL ที่ endpoint มี path prefix อย่าง Supabase', () => {
    stubStorage('https://abc.supabase.co/storage/v1/s3');
    expect(
      keyFromUrl('https://abc.supabase.co/storage/v1/s3/media/general/x.jpg'),
    ).toBe('general/x.jpg');
  });

  it('คืน null เมื่อ URL อยู่คนละ endpoint', () => {
    stubStorage('http://localhost:9000');
    expect(
      keyFromUrl('https://abc.supabase.co/storage/v1/s3/media/general/x.jpg'),
    ).toBeNull();
  });

  it('คืน null เมื่อ URL อยู่คนละ bucket', () => {
    stubStorage('http://localhost:9000');
    expect(keyFromUrl('http://localhost:9000/other/general/x.jpg')).toBeNull();
  });

  it('ไม่จับ bucket ที่ชื่อขึ้นต้นเหมือนกันเป็น bucket เดียวกัน', () => {
    stubStorage('http://localhost:9000');
    expect(keyFromUrl('http://localhost:9000/media2/general/x.jpg')).toBeNull();
  });

  it('คืน null เมื่อมีแต่ bucket ไม่มี key', () => {
    stubStorage('http://localhost:9000');
    expect(keyFromUrl('http://localhost:9000/media/')).toBeNull();
    expect(keyFromUrl('http://localhost:9000/media')).toBeNull();
  });

  it('คืน null เมื่อไม่ได้ตั้ง S3_ENDPOINT', () => {
    stubStorage('');
    expect(keyFromUrl('http://localhost:9000/media/general/x.jpg')).toBeNull();
  });

  it('ผกผันกับสตริงที่ uploadFile สร้าง (round-trip)', () => {
    stubStorage('https://abc.supabase.co/storage/v1/s3');
    // สตริงเดียวกับที่ uploadFile คืน — ไม่เรียก uploadFile เองเพราะต้องยิง network
    const built = `${process.env.S3_ENDPOINT}/${BUCKET}/cases/2026/10/abc.jpg`;
    expect(keyFromUrl(built)).toBe('cases/2026/10/abc.jpg');
  });
});

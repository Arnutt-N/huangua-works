import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispositionFor, keyFromUrl, readUrlForKey, resolveReadKey } from './storage';

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

describe('readUrlForKey', () => {
  const KEY = 'line-inbound/msg1/abc.jpg';

  beforeEach(() => {
    vi.stubEnv('S3_ENDPOINT', 'https://abc.supabase.co/storage/v1/s3');
    vi.stubEnv('S3_BUCKET', BUCKET);
    vi.stubEnv('S3_ACCESS_KEY_ID', 'AKIAEXAMPLE');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secretexample');
  });

  it('เซ็นเป็น GET — มี X-Amz-Signature และอายุตามที่ขอ', async () => {
    // § GET-ness ถูกบังคับด้วย type แล้ว: ResponseContentType/ResponseContentDisposition
    // มีเฉพาะ GetObjectCommandInput (PutObject ไม่มีฟิลด์นี้) — เทสต์ข้างล่างจึงพิสูจน์
    // ทางอ้อมได้ว่า command ต้องเป็น GetObject ไม่ใช่ PutObject แบบเดิม
    const url = await readUrlForKey(KEY, { expiresIn: 120 });
    const u = new URL(url);
    expect(u.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(Number(u.searchParams.get('X-Amz-Expires'))).toBe(120);
  });

  it('ใส่ disposition inline พร้อมชื่อไฟล์สำหรับรูป', async () => {
    const url = await readUrlForKey(KEY, { disposition: 'inline', filename: 'รูปถ่าย.jpg' });
    const disposition = new URL(url).searchParams.get('response-content-disposition');
    expect(disposition).toContain('inline');
    expect(disposition).toContain(encodeURIComponent('รูปถ่าย.jpg'));
  });

  it('ใส่ disposition attachment ไม่ใส่ filename ได้', async () => {
    const url = await readUrlForKey(KEY, { disposition: 'attachment' });
    expect(new URL(url).searchParams.get('response-content-disposition')).toBe('attachment');
  });

  it('ไม่ส่ง response-content-* เมื่อไม่ขอ', async () => {
    const url = await readUrlForKey(KEY);
    const u = new URL(url);
    expect(u.searchParams.get('response-content-type')).toBeNull();
  });

  it('ส่ง response-content-type ตามที่ขอ', async () => {
    const url = await readUrlForKey(KEY, { contentType: 'application/pdf' });
    expect(new URL(url).searchParams.get('response-content-type')).toBe('application/pdf');
  });

  it('clamp expiresIn ไม่ให้เกินเพดาน SigV4 (900 วินาที)', async () => {
    const url = await readUrlForKey(KEY, { expiresIn: 86400 });
    const u = new URL(url);
    const expires = Number(u.searchParams.get('X-Amz-Expires'));
    expect(expires).toBe(900);
  });

  it('clamp expiresIn ต่ำสุดที่ 1 วินาที', async () => {
    const url = await readUrlForKey(KEY, { expiresIn: 0 });
    expect(Number(new URL(url).searchParams.get('X-Amz-Expires'))).toBe(1);
  });

  it('reject key ว่าง — ไม่เซ็น path ที่ชี้ไปที่ bucket root', async () => {
    await expect(readUrlForKey('')).rejects.toThrow();
  });

  it('reject key ที่มี .. — กัน path traversal ออกนอก prefix', async () => {
    await expect(readUrlForKey('line-inbound/../../secret')).rejects.toThrow();
  });
});

describe('dispositionFor', () => {
  it('รูป inline, อย่างอื่น attachment', () => {
    expect(dispositionFor('image/jpeg')).toBe('inline');
    expect(dispositionFor('image/png')).toBe('inline');
    expect(dispositionFor('image/webp')).toBe('inline');
    expect(dispositionFor('application/pdf')).toBe('attachment');
    expect(dispositionFor('text/html')).toBe('attachment');
    expect(dispositionFor('application/octet-stream')).toBe('attachment');
  });
});

describe('resolveReadKey', () => {
  it('storageKey มาก่อนเสมอ', () => {
    stubStorage('https://abc.supabase.co/storage/v1/s3');
    expect(resolveReadKey({ storageKey: 'a/b.jpg', legacyUrl: 'https://abc.supabase.co/storage/v1/s3/media/c/d.jpg' })).toBe('a/b.jpg');
  });

  it('fallback ไป legacyUrl เมื่อ storageKey ว่าง', () => {
    stubStorage('https://abc.supabase.co/storage/v1/s3');
    expect(resolveReadKey({ storageKey: null, legacyUrl: 'https://abc.supabase.co/storage/v1/s3/media/c/d.jpg' })).toBe('c/d.jpg');
  });

  it('คืน null เมื่อไม่มีทั้งคู่ หรือ legacyUrl ไม่ตรงรูปแบบ', () => {
    stubStorage('https://abc.supabase.co/storage/v1/s3');
    expect(resolveReadKey({ storageKey: null, legacyUrl: null })).toBeNull();
    expect(resolveReadKey({ storageKey: null, legacyUrl: 'https://other.example/x.jpg' })).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireCron } from './cron-auth';

/**
 * requireCron เป็นด่านเดียวที่กั้น /api/cron/* ทั้ง 5 เส้น ซึ่งเปิดรับ caller
 * จากอินเทอร์เน็ตจริง (scheduler ภายนอก ไม่ใช่ Vercel Cron) — regression ที่นี่
 * เท่ากับเปิดให้ใครก็ได้สั่งปิดเคส/ยิง broadcast
 */

const VALID_SECRET = 'cron-secret-that-is-long-enough';

function req(authorization?: string): Request {
  return new Request('https://example.test/api/cron/ping', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireCron · CRON_SECRET ที่ใช้ไม่ได้', () => {
  it('คืน 500 เมื่อไม่ได้ตั้ง CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const result = requireCron(req(`Bearer ${VALID_SECRET}`));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      error: 'CRON_SECRET not configured',
    });
  });

  it('คืน 500 เมื่อ CRON_SECRET สั้นกว่า 16 ตัว — กัน secret อ่อนที่หลุด verify-env ตอน runtime', () => {
    vi.stubEnv('CRON_SECRET', 'short');
    const result = requireCron(req('Bearer short'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(500);
  });

  it('ไม่ปล่อยผ่านแม้ header จะตรงกับ secret ที่สั้นเกินเกณฑ์', () => {
    // § ลำดับสำคัญ — ต้องเช็คความยาว secret ก่อนเทียบ header ไม่งั้น secret ว่าง
    // จะทำให้ `Bearer ` เปล่าๆ ผ่านได้
    vi.stubEnv('CRON_SECRET', '');
    expect(requireCron(req('Bearer ')).ok).toBe(false);
    expect(requireCron(req('Bearer undefined')).ok).toBe(false);
  });
});

describe('requireCron · การเทียบ Authorization header', () => {
  it('ผ่านเมื่อ header ตรงเป๊ะ', () => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    expect(requireCron(req(`Bearer ${VALID_SECRET}`)).ok).toBe(true);
  });

  it('คืน 401 เมื่อไม่มี Authorization header เลย', async () => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    const result = requireCron(req());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it.each([
    ['secret ผิดแต่ยาวเท่ากัน', `Bearer ${'x'.repeat(VALID_SECRET.length)}`],
    ['ไม่มีคำว่า Bearer', VALID_SECRET],
    ['scheme ผิด', `Basic ${VALID_SECRET}`],
    ['ตัวพิมพ์ของ scheme ไม่ตรง', `bearer ${VALID_SECRET}`],
    ['มีช่องว่างเกินคั่นกลาง', `Bearer  ${VALID_SECRET}`],
    ['เป็น prefix ของค่าที่ถูก', `Bearer ${VALID_SECRET.slice(0, -1)}`],
    ['ค่าที่ถูกบวกตัวอักษรต่อท้าย', `Bearer ${VALID_SECRET}x`],
  ])('คืน 401 เมื่อ %s', (_label, header) => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    const result = requireCron(req(header));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it('ช่องว่างหัวท้ายของ header ถูกตัดทิ้งตั้งแต่ชั้น HTTP — ไม่ต้อง trim เองใน requireCron', () => {
    // § Headers ตัด optional whitespace หัวท้ายของ field value ตามสเปค HTTP
    // ก่อนที่ค่าจะมาถึง requireCron ด้วยซ้ำ ถ้ามีใครจะเพิ่ม .trim() เข้าไปในโค้ด
    // ให้รู้ว่ามันซ้ำซ้อน และห้ามเปลี่ยนไปอ่าน raw header เพื่อ "เข้มขึ้น"
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    expect(req(`Bearer ${VALID_SECRET} `).headers.get('authorization')).toBe(
      `Bearer ${VALID_SECRET}`,
    );
    expect(requireCron(req(`Bearer ${VALID_SECRET} `)).ok).toBe(true);
  });

  it('ไม่ throw เมื่อความยาว header ต่างจาก secret — timingSafeEqual จะ throw ถ้า buffer ยาวไม่เท่ากัน', () => {
    // § safeEquals ต้องเช็คความยาวก่อนเรียก timingSafeEqual เสมอ ไม่งั้น request
    // ที่ส่ง header สั้น/ยาวผิดจะกลายเป็น 500 แทน 401
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    expect(() => requireCron(req('Bearer x'))).not.toThrow();
    expect(() => requireCron(req(`Bearer ${'x'.repeat(500)}`))).not.toThrow();
    expect(requireCron(req('Bearer x')).ok).toBe(false);
  });

  it('รับ NextRequest ได้ด้วย — broadcast-send ใช้ Request ส่วนอีก 4 route ใช้ NextRequest', async () => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    const { NextRequest } = await import('next/server');
    const nextReq = new NextRequest('https://example.test/api/cron/ping', {
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    });

    expect(requireCron(nextReq).ok).toBe(true);
  });
});

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rateLimit: vi.fn(), createCase: vi.fn(), liff: vi.fn() }));
vi.mock('@/lib/rate-limit/enforce', () => ({ enforceRateLimit: mocks.rateLimit }));
vi.mock('@/lib/cases/intake', () => ({ createCase: mocks.createCase }));
vi.mock('@/lib/liff/session', () => ({ LIFF_SESSION_COOKIE: 'liff-session', readLiffSessionValue: mocks.liff }));
import { POST } from './route';

const NOW = 1_800_000_000_000;
const prefix = '123456789012';
const sum = [...prefix].reduce((total, digit, i) => total + Number(digit) * (13 - i), 0);
const validBody = {
  cid: prefix + ((11 - sum % 11) % 10), fullName: 'นายทดสอบ', categoryId: 'roads',
  title: 'ถนนชำรุดในหมู่บ้าน', description: 'มีหลุมบนถนนหลายจุด กรุณาตรวจสอบและซ่อมแซมเพื่อความปลอดภัย',
  consent: true, websiteUrl: '', formStartedAt: NOW - 30_000,
};
const genericError = { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' };
function request(body: unknown) {
  return new NextRequest('http://unit.test/api/cases/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 2, reset: 300 });
  mocks.createCase.mockReset().mockResolvedValue({ ok: true, caseId: 'case-test', trackingCode: 'HG000000001', estimatedDays: 7 });
  mocks.liff.mockReset().mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('ห้ามยิง API จริงใน unit test'); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('submit route — honeypot และ validation ใช้ error กลาง', () => {
  it.each([false, true])('spam และ validation ปกติแยกจาก HTTP/body ไม่ได้ (LIFF=%s)', async (liff) => {
    if (liff) mocks.liff.mockReturnValue({ lineUserId: 'line-test' });
    const ordinary = await POST(request({}));
    const spam = await POST(request({ ...validBody, websiteUrl: 'https://spam.example' }));
    expect(ordinary.status).toBe(400);
    expect(spam.status).toBe(ordinary.status);
    expect(await ordinary.json()).toEqual(genericError);
    expect(await spam.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, [], 'ข้อความ', 0])('JSON shape ไม่ใช่ object ต้องไม่ล้ม: %j', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledWith('submit', '203.0.113.9');
  });

  it('malformed JSON ใช้ error กลางและผ่าน rate-limit ก่อน', async () => {
    const req = new NextRequest('http://unit.test/api/cases/submit', { method: 'POST', body: '{' });
    const readBody = vi.spyOn(req, 'json');
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.rateLimit.mock.invocationCallOrder[0]).toBeLessThan(readBody.mock.invocationCallOrder[0]!);
  });

  it.each([undefined, null, ''])('websiteUrl %s ใช้เป็นช่องว่างและสร้างเคสได้', async (websiteUrl) => {
    const response = await POST(request({ ...validBody, websiteUrl }));
    expect(response.status).toBe(201);
    expect(mocks.createCase).toHaveBeenCalledOnce();
    const payload = mocks.createCase.mock.calls[0]![0];
    expect(payload).not.toHaveProperty('websiteUrl');
    expect(payload).not.toHaveProperty('formStartedAt');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([' ', '\t\n', 'https://spam.example'])('ฟิลด์ลวงมีค่า %j ถูกปฏิเสธบน server', async (websiteUrl) => {
    const response = await POST(request({ ...validBody, websiteUrl }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
    expect(mocks.rateLimit).toHaveBeenCalledOnce();
  });

  it.each([0, NOW - 1000.5, NOW - 30_000.5, -1])('เวลา 0/ทศนิยม/ติดลบ %s ถูกปฏิเสธด้วย validation', async (formStartedAt) => {
    const response = await POST(request({ ...validBody, formStartedAt }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
  });

  it.each([0, 1999])('ส่งก่อนครบเกณฑ์ %s ms ถูกปฏิเสธบน server แม้ bypass client', async (elapsed) => {
    const response = await POST(request({ ...validBody, formStartedAt: NOW - elapsed }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
  });

  it.each([2000, 2001, 3_600_000])('ผ่านเมื่อกรอก %s ms รวมผู้สูงอายุที่กรอกช้า', async (elapsed) => {
    expect((await POST(request({ ...validBody, formStartedAt: NOW - elapsed }))).status).toBe(201);
  });

  it('เวลาอนาคตจาก clock skew และ client เก่าที่ไม่มีเวลา ยังส่งได้', async () => {
    expect((await POST(request({ ...validBody, formStartedAt: NOW + 60_000 }))).status).toBe(201);
    expect((await POST(request({ ...validBody, formStartedAt: undefined }))).status).toBe(201);
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
  });

  it('CID checksum ผิดไม่เปิดเผยเหตุผลเฉพาะเมื่อเทียบกับ honeypot', async () => {
    const response = await POST(request({ ...validBody, cid: prefix + ((Number(validBody.cid.at(-1)) + 1) % 10) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(genericError);
    expect(mocks.createCase).not.toHaveBeenCalled();
  });

  it('ทุก spam request ใช้ quota เดิมและเมื่อเต็มหยุดก่อนอ่าน body', async () => {
    mocks.rateLimit.mockImplementation(async () => ({ allowed: mocks.rateLimit.mock.calls.length <= 3, remaining: 0, reset: 300 }));
    for (let i = 0; i < 5; i++) {
      const req = request({ ...validBody, websiteUrl: 'https://spam.example' });
      const readBody = vi.spyOn(req, 'json');
      const response = await POST(req);
      expect(response.status).toBe(i < 3 ? 400 : 429);
      if (i >= 3) expect(readBody).not.toHaveBeenCalled();
    }
    expect(mocks.rateLimit).toHaveBeenCalledTimes(5);
    expect(mocks.createCase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chatPrefsSchema, chatTagSchema } from '@/lib/validation';
import { parseBody, parseBodyError } from './api-helpers';

/**
 * parseBody = ทางเข้าเดียวของ route handler ที่รับ JSON
 * ก่อนหน้านี้ไม่มี test เลย ทั้งที่ 14 route จะย้ายมาใช้ — ล็อกพฤติกรรมนี้ก่อน
 */
const schema = z.object({ name: z.string().min(1, 'ต้องระบุชื่อ'), count: z.number().int().optional() });

function requestWith(body: string): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('parseBody', () => {
  it('JSON ผ่าน schema → ok: true พร้อม data ที่ผ่าน transform/default', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: 'ทดสอบ' })));

    expect(result).toEqual({ ok: true, data: { name: 'ทดสอบ' } });
  });

  it('JSON พัง → ok: false, 400, { error: "Invalid JSON" } — ตรงกับโค้ดที่เขียนเอง', async () => {
    const result = await parseBody(schema, requestWith('{ not json'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('schema ไม่ผ่าน → ok: false, 400, ข้อความ zod ตัวแรก (ภาษาไทย/ของ schema)', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: '' })));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: 'ต้องระบุชื่อ' });
  });

  it('ข้อความ default ของ zod (ไม่ได้ตั้งเอง) ถูกส่งออกตรง ๆ', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({})));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // zod 4.4.3 — message เดียวกับที่โค้ดเดิม `issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'` คืน
    expect(await result.response.json()).toEqual({
      error: 'Invalid input: expected string, received undefined',
    });
  });

  it('type mismatch → 400 พร้อม message ของ zod', async () => {
    const result = await parseBody(schema, requestWith(JSON.stringify({ name: 'x', count: 1.5 })));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(await result.response.json()).toEqual({
      error: 'Invalid input: expected int, received number',
    });
  });
});

describe('parseBodyError', () => {
  it('คืน 400 JSON envelope เดียว', async () => {
    const response = parseBodyError('ข้อมูลไม่ถูกต้อง');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'ข้อมูลไม่ถูกต้อง' });
  });
});

describe('parseBody กับ schema จริง (ตัวแทน ไม่ครบ 14 route)', () => {
  it.each([
    {
      name: 'refine: prefs ว่าง → ข้อความ refine',
      schema: chatPrefsSchema,
      body: {},
      error: 'ต้องระบุ pinned หรือ muted',
    },
    {
      name: 'optional+default: tags ไม่ส่ง color → ไม่ 400 (default accent)',
      schema: chatTagSchema,
      body: { name: 'ด่วน' },
      error: null,
    },
    {
      name: 'refine ผ่าน: prefs ส่ง pinned',
      schema: chatPrefsSchema,
      body: { pinned: true },
      error: null,
    },
  ])('$name', async ({ schema, body, error }) => {
    const result = await parseBody(schema, requestWith(JSON.stringify(body)));
    if (error === null) {
      expect(result.ok).toBe(true);
      return;
    }
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error });
  });
});

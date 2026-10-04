import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * แก้/ลบ FAQ ต้อง rollback เมื่อ audit ล้ม (เดิม: FAQ เปลี่ยนแล้วแต่ไม่มี audit + ตอบ 500)
 */
const mocks = vi.hoisted(() => ({ failNextAudit: false }));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (mocks.failNextAudit) {
        mocks.failNextAudit = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-faq-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, chatFaq } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { DELETE, PATCH } from './route';

let faqId: string;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/faq/${faqId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function getFaq() {
  const db = await getDb();
  const [row] = await db.select().from(chatFaq).where(eq(chatFaq.id, faqId));
  if (!row) throw new Error('FAQ ทดสอบหาย');
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  faqId = generateId();
  await db.insert(chatFaq).values({
    id: faqId,
    question: 'คำถามเดิม',
    answer: 'คำตอบเดิม',
    keywords: ['ทดสอบ'],
  });
});

beforeEach(() => {
  mocks.failNextAudit = false;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, faqId));
  await db.delete(chatFaq).where(eq(chatFaq.id, faqId));
  await closeDb();
});

describe('FAQ [id] · audit ล้มต้อง rollback', () => {
  test('PATCH', async () => {
    mocks.failNextAudit = true;
    await expect(PATCH(patchRequest({ question: 'คำถามใหม่' }), params(faqId))).rejects.toThrow(
      'audit insert failed (forced)',
    );
    expect((await getFaq()).question).toBe('คำถามเดิม');
  });

  test('DELETE (soft)', async () => {
    mocks.failNextAudit = true;
    await expect(
      DELETE(new Request(`http://localhost:3000/api/line/admin/faq/${faqId}`, { method: 'DELETE' }), params(faqId)),
    ).rejects.toThrow('audit insert failed (forced)');
    expect((await getFaq()).isActive).toBe(true);
  });
});

describe('FAQ [id] · สำเร็จยังทำงานเหมือนเดิม', () => {
  test('PATCH อัปเดต + เขียน audit', async () => {
    const res = await PATCH(patchRequest({ question: 'คำถามใหม่' }), params(faqId));

    expect(res.status).toBe(200);
    expect((await getFaq()).question).toBe('คำถามใหม่');
    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, faqId));
    expect(audits.map((a) => a.action)).toEqual(['faq_update']);
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readinessOf } from './readiness';

function item(over: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    name: 'หมวดทดสอบ',
    isActive: true,
    keywords: [{ id: 'k1' }],
    responses: [{ id: 'r1' }],
    ...over,
  };
}

describe('readinessOf', () => {
  it('พร้อมเมื่อเปิดใช้และมี keyword + คำตอบ', () => {
    expect(readinessOf(item())).toEqual({ ready: true, reason: 'พร้อม' });
  });

  it('ไม่พร้อมเมื่อปิดใช้งาน (เหตุผลคือสถานะ ไม่ใช่ของขาด)', () => {
    expect(readinessOf(item({ isActive: false }))).toEqual({ ready: false, reason: 'ปิดใช้งาน' });
  });

  it('ไม่พร้อมเมื่อไม่มี keyword', () => {
    expect(readinessOf(item({ keywords: [] }))).toEqual({ ready: false, reason: 'ยังไม่มี keyword' });
  });

  it('ไม่พร้อมเมื่อไม่มีคำตอบ', () => {
    expect(readinessOf(item({ responses: [] }))).toEqual({ ready: false, reason: 'ยังไม่มีคำตอบ' });
  });
});

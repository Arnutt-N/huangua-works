import { describe, expect, it } from 'vitest';
import { toMyCaseItems } from './my-cases';

describe('toMyCaseItems (pure mapper)', () => {
  it('แปลง row → item ครบ field และวันที่เป็น ISO string', () => {
    const updatedAt = new Date('2026-08-23T10:00:00.000Z');
    const items = toMyCaseItems([
      { trackingCode: 'HN123456789', status: 'received', title: 'ถนนพัง', updatedAt },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      trackingCode: 'HN123456789',
      status: 'received',
      title: 'ถนนพัง',
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('ตัดเคสเก่าที่ไม่มี trackingCode ทิ้ง (หน้า track ใช้รหัสเป็น key)', () => {
    const items = toMyCaseItems([
      { trackingCode: null, status: 'closed', title: 'เคสเก่าก่อนใช้ระบบรหัส', updatedAt: new Date() },
      { trackingCode: 'HN987654321', status: 'pending', title: 'เคสใหม่', updatedAt: new Date() },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.trackingCode).toBe('HN987654321');
  });
});

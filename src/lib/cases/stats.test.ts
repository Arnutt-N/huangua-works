import { describe, expect, it } from 'vitest';
import { deriveStatusStats } from './stats';

describe('deriveStatusStats · มาตรฐานจาก Excel และ state machine', () => {
  it('ยอดทั้งหมด = ทุกสถานะ ไม่ใช่เฉพาะ received', () => {
    const result = deriveStatusStats(
      { received: 2, reviewing: 1, done: 3, closed: 4, rejected: 1 },
      [1, 2, 3, 4],
    );

    expect(result.totalCases).toBe(11);
    expect(result.totalClosed).toBe(4);
    expect(result.totalRejected).toBe(1);
    expect(result.resolutionRate).toBe(36);
  });

  it('ยอดค้าง = ทุกสถานะที่ยังไม่จบงาน รวม pending/awaiting_budget', () => {
    const result = deriveStatusStats(
      { pending: 2, received: 1, awaiting_budget: 1, done: 3, closed: 4, rejected: 1 },
      [],
    );

    expect(result.totalInProgress).toBe(4);
  });

  it('เฉลี่ยวันปิดคำนวณจากแถวที่มี closedAt เท่านั้น', () => {
    const result = deriveStatusStats({ closed: 3 }, [2, 4]);

    expect(result.avgResolutionDays).toBe(3);
  });

  it('ไม่มีเรื่อง → ทุกยอดเป็นศูนย์และเฉลี่ยเป็น null', () => {
    const result = deriveStatusStats({}, []);

    expect(result).toMatchObject({
      totalCases: 0,
      totalClosed: 0,
      totalRejected: 0,
      totalInProgress: 0,
      resolutionRate: 0,
      avgResolutionDays: null,
    });
  });
});

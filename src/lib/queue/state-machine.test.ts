import { describe, expect, it } from 'vitest';
import {
  ALL_QUEUE_BOOKING_STATUSES,
  ALL_QUEUE_CATEGORIES,
  assertQueueTransition,
  canTransitionQueueStatus,
  QUEUE_BOOKING_STATUS_LABELS,
  QUEUE_CATEGORY_LABELS,
  QUEUE_TRANSITIONS,
} from './state-machine';

describe('queue state-machine', () => {
  it('มีหมวดหมู่ครบ 2 หมวดตามข้อกำหนด', () => {
    expect(ALL_QUEUE_CATEGORIES).toEqual(['technician', 'government']);
    for (const cat of ALL_QUEUE_CATEGORIES) {
      expect(QUEUE_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it('มีสถานะครบ 4 สถานะ', () => {
    expect(ALL_QUEUE_BOOKING_STATUSES).toEqual(['booked', 'confirmed', 'done', 'cancelled']);
    for (const st of ALL_QUEUE_BOOKING_STATUSES) {
      expect(QUEUE_BOOKING_STATUS_LABELS[st]).toBeTruthy();
    }
  });

  it('อนุญาตการเปลี่ยนสถานะที่ถูกต้อง', () => {
    expect(canTransitionQueueStatus('booked', 'confirmed')).toBe(true);
    expect(canTransitionQueueStatus('booked', 'cancelled')).toBe(true);
    expect(canTransitionQueueStatus('confirmed', 'done')).toBe(true);
    expect(canTransitionQueueStatus('confirmed', 'cancelled')).toBe(true);

    expect(assertQueueTransition('booked', 'confirmed')).toEqual({ ok: true });
    expect(assertQueueTransition('confirmed', 'done')).toEqual({ ok: true });
  });

  it('ปฏิเสธการเปลี่ยนสถานะที่ไม่ถูกต้องและคืนข้อความภาษาไทย', () => {
    expect(canTransitionQueueStatus('done', 'booked')).toBe(false);
    expect(canTransitionQueueStatus('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionQueueStatus('booked', 'done')).toBe(false);

    const same = assertQueueTransition('booked', 'booked');
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.reason).toContain('สถานะปัจจุบันเป็นสถานะนี้อยู่แล้ว');

    const invalid = assertQueueTransition('done', 'booked');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.reason).toContain('ไม่ได้');
      expect(invalid.reason).toContain('เสร็จแล้ว');
      expect(invalid.reason).toContain('จองแล้ว');
    }
  });
});


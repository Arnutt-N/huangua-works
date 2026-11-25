import { describe, expect, it } from 'vitest';
import { QUEUE_PAGE_SIZE, buildQueueHref, parseQueueListParams } from './queue-list';

describe('parseQueueListParams', () => {
  it('ค่าเริ่มต้น = all / upcoming / หน้า 1', () => {
    expect(parseQueueListParams({})).toEqual({ category: 'all', range: 'upcoming', page: 1 });
  });

  it('กรอง category/range ด้วย whitelist และดึง page ออกจาก string', () => {
    expect(
      parseQueueListParams({ category: 'government', range: 'past', page: '3' }),
    ).toEqual({ category: 'government', range: 'past', page: 3 });
  });

  it('ค่าไม่รู้จัก / ติดลบ / ศูนย์ / ที่ไม่ใช่ตัวเลข → กลับค่าเริ่มต้นหรือ clamp', () => {
    expect(parseQueueListParams({ category: 'evil', range: 'evil', page: '-5' })).toEqual({
      category: 'all',
      range: 'upcoming',
      page: 1,
    });
    expect(parseQueueListParams({ page: '0' }).page).toBe(1);
    expect(parseQueueListParams({ page: 'abc' }).page).toBe(1);
    expect(parseQueueListParams({ page: ['2', '3'] }).page).toBe(2);
  });
});

describe('buildQueueHref', () => {
  it('เปลี่ยนตัวกรองแล้ว reset หน้ากลับเป็น 1', () => {
    expect(buildQueueHref({ category: 'all', range: 'upcoming', page: 7 }, { range: 'past' })).toBe(
      '/admin/queue?range=past',
    );
  });

  it('เปลี่ยนหน้าโดยไม่แตะตัวกรอง → เก็บ category/range ไว้', () => {
    expect(
      buildQueueHref({ category: 'government', range: 'past', page: 2 }, { page: 3 }),
    ).toBe('/admin/queue?category=government&range=past&page=3');
  });
});

describe('QUEUE_PAGE_SIZE', () => {
  it('ขนาดหน้าคือ 100 ตามที่หน้าเดิมเคย แสดง', () => {
    expect(QUEUE_PAGE_SIZE).toBe(100);
  });
});

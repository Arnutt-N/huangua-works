import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  getLineMessageQuota: vi.fn(),
}));

import { getLineMessageQuota } from './client';
import {
  clearLineQuotaCache,
  describeLineQuota,
  fetchLineQuota,
  LINE_QUOTA_CACHE_TTL_MS,
} from './quota';

describe('line quota service', () => {
  beforeEach(() => {
    clearLineQuotaCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(getLineMessageQuota).mockReset();
  });

  it('ดึงโควต้าแบบจำกัดและแคชไว้ 5 นาที', async () => {
    vi.mocked(getLineMessageQuota).mockResolvedValue({
      type: 'limited',
      limit: 500,
      used: 120,
      remaining: 380,
    });

    const first = await fetchLineQuota();
    const second = await fetchLineQuota();

    expect(first).toEqual({ type: 'limited', limit: 500, used: 120, remaining: 380 });
    expect(second).toEqual(first);
    expect(getLineMessageQuota).toHaveBeenCalledTimes(1);
    expect(describeLineQuota(first)).toBe('โควต้า LINE คงเหลือ 380 / 500 ข้อความ');
  });

  it('เมื่อพ้น TTL 5 นาทีหรือสั่ง forceRefresh จะดึงค่าใหม่จาก LINE API', async () => {
    vi.mocked(getLineMessageQuota)
      .mockResolvedValueOnce({ type: 'limited', limit: 500, used: 100, remaining: 400 })
      .mockResolvedValueOnce({ type: 'limited', limit: 500, used: 150, remaining: 350 })
      .mockResolvedValueOnce({ type: 'limited', limit: 500, used: 160, remaining: 340 });

    await fetchLineQuota();
    const forced = await fetchLineQuota({ forceRefresh: true });
    expect(forced.remaining).toBe(350);

    vi.advanceTimersByTime(LINE_QUOTA_CACHE_TTL_MS + 1);
    const afterTtl = await fetchLineQuota();
    expect(afterTtl.remaining).toBe(340);
    expect(getLineMessageQuota).toHaveBeenCalledTimes(3);
  });

  it('หากดึงใหม่ล้มเหลวต้องล้างค่าแคชเดิมทิ้ง ไม่คืนค่าเก่าค้าง', async () => {
    vi.mocked(getLineMessageQuota)
      .mockResolvedValueOnce({ type: 'limited', limit: 500, used: 10, remaining: 490 })
      .mockRejectedValueOnce(new Error('LINE 502'));

    await fetchLineQuota();
    await expect(fetchLineQuota({ forceRefresh: true })).rejects.toThrow('LINE 502');

    vi.mocked(getLineMessageQuota).mockResolvedValueOnce({
      type: 'limited',
      limit: 500,
      used: 20,
      remaining: 480,
    });
    const recovered = await fetchLineQuota();
    expect(recovered.remaining).toBe(480);
  });

  it('describeLineQuota รองรับโควต้าไม่จำกัดและกรณี null', () => {
    expect(describeLineQuota({ type: 'none', limit: null, used: 42, remaining: null })).toBe(
      'โควต้า LINE: ไม่จำกัด (ใช้ไป 42 ข้อความ)',
    );
    expect(describeLineQuota(null)).toBe('ไม่สามารถดึงข้อมูลโควต้าได้ชั่วคราว');
  });
});

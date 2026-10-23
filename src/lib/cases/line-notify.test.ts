import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/lib/db/query-helpers', () => ({
  firstOrUndefined: vi.fn(),
}));
vi.mock('@/lib/line/settings', () => ({
  getChatSetting: vi.fn(),
}));
vi.mock('@/lib/line/identity', () => ({
  resolveRawLineId: vi.fn(),
}));
vi.mock('@/lib/line/client', () => ({
  pushMessage: vi.fn(),
}));

import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { getChatSetting } from '@/lib/line/settings';
import { resolveRawLineId } from '@/lib/line/identity';
import { pushMessage } from '@/lib/line/client';
import { notifyCitizenStatusChange } from './line-notify';

describe('notifyCitizenStatusChange', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function mockDbChain() {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    } as never);
  }

  it('ไม่แตะ DB หรือส่ง LINE เมื่อปิดสวิตช์ line_notify_enabled (gate-before-resolve)', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'tok-test');
    vi.mocked(getChatSetting).mockResolvedValue(false);

    const sent = await notifyCitizenStatusChange('case-1', 'in_progress');
    expect(sent).toBe(false);
    expect(getDb).not.toHaveBeenCalled();
    expect(pushMessage).not.toHaveBeenCalled();
  });

  it('ส่ง Flex message แจ้งสถานะเมื่อเปิด line_notify_enabled และเคสผูกกับบัญชี LINE', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'tok-test');
    vi.mocked(getChatSetting).mockResolvedValue(true);
    mockDbChain();
    vi.mocked(firstOrUndefined).mockResolvedValue({
      trackingCode: 'HG123456789',
      title: 'ไฟกิ่งดับซอย 3',
      lineUserPk: 'lu-1',
    } as never);
    vi.mocked(resolveRawLineId).mockResolvedValue('U999888777');
    vi.mocked(pushMessage).mockResolvedValue(undefined);

    const sent = await notifyCitizenStatusChange('case-1', 'done');
    expect(sent).toBe(true);
    expect(pushMessage).toHaveBeenCalledWith(
      'U999888777',
      expect.arrayContaining([
        expect.objectContaining({
          type: 'flex',
          altText: expect.stringContaining('HG123456789'),
        }),
      ]),
    );
  });

  it('คืน false แบบไม่ throw เมื่อ LINE API ล้มเหลว (exception isolation)', async () => {
    vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'tok-test');
    vi.mocked(getChatSetting).mockResolvedValue(true);
    mockDbChain();
    vi.mocked(firstOrUndefined).mockResolvedValue({
      trackingCode: 'HG123456789',
      title: 'ถนนชำรุด',
      lineUserPk: 'lu-1',
    } as never);
    vi.mocked(resolveRawLineId).mockResolvedValue('U999888777');
    vi.mocked(pushMessage).mockRejectedValue(new Error('LINE 502'));

    await expect(notifyCitizenStatusChange('case-1', 'done')).resolves.toBe(false);
  });
});

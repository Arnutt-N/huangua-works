import { describe, expect, it, vi } from 'vitest';

const { broadcastMock, followerMock } = vi.hoisted(() => ({
  broadcastMock: vi.fn(),
  followerMock: vi.fn(),
}));

vi.mock('./client', () => ({
  broadcastMessage: broadcastMock,
  getFollowerIds: followerMock,
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

const { getDb } = await import('@/lib/db');
const { sendBroadcast, dryRunBroadcast } = await import('./broadcast-service');

function dbStub(row: { id: string; content: unknown }) {
  const updates: unknown[] = [];
  const chain = {
    set: (v: unknown) => {
      updates.push(v);
      return { where: () => ({ returning: async () => [row] }) };
    },
  };
  return {
    updates,
    db: { update: () => chain },
  };
}

describe('sendBroadcast · retry', () => {
  it('ล้ม 2 ครั้งแล้วสำเร็จ → ยิง 3 ครั้ง สถานะ sent', async () => {
    const { db, updates } = dbStub({ id: 'b1', content: [] });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockReset();
    broadcastMock
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce(undefined);

    await sendBroadcast('b1');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    expect(updates.at(-1)).toMatchObject({ status: 'sent' });
  });

  it('ล้มครบ 3 ครั้ง → สถานะ failed พร้อม error', async () => {
    const { db, updates } = dbStub({ id: 'b2', content: [] });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockReset();
    broadcastMock.mockRejectedValue(new Error('LINE down'));

    await sendBroadcast('b2');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    expect(updates.at(-1)).toMatchObject({ status: 'failed' });
  });
});

describe('dryRunBroadcast · ไม่ส่งจริง', () => {
  it('คืนจำนวน followers โดยไม่เรียก broadcastMessage', async () => {
    followerMock.mockReset();
    broadcastMock.mockReset();
    followerMock.mockResolvedValue({ userIds: ['U1', 'U2', 'U3'] });

    const result = await dryRunBroadcast();

    expect(result).toMatchObject({ estimatedRecipients: 3 });
    expect(broadcastMock).not.toHaveBeenCalled();
  });
});

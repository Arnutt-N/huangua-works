import { beforeEach, describe, expect, it, vi } from 'vitest';

const { broadcastMock, followerMock, multicastMock } = vi.hoisted(() => ({
  broadcastMock: vi.fn(),
  followerMock: vi.fn(),
  multicastMock: vi.fn(),
}));

vi.mock('./client', () => ({
  broadcastMessage: broadcastMock,
  getFollowerIds: followerMock,
  multicast: multicastMock,
}));
vi.mock('./circuit-breaker', () => ({ withLineCircuit: (_: unknown, fn: () => unknown) => fn() }));
vi.mock('./identity', () => ({ decryptLineId: (enc: string) => enc }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

const { getDb } = await import('@/lib/db');
const { sendBroadcast } = await import('./broadcast-service');

interface Row { id: string; content: unknown; target: unknown }

function dbStub(target: unknown): unknown {
  const db = {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async (): Promise<Row[]> => [{ id: 'bad-target', content: [], target }],
        }),
      }),
    }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => [] }) }),
  };
  return Object.assign(db, { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db) });
}

beforeEach(() => {
  vi.clearAllMocks();
  broadcastMock.mockReset();
  multicastMock.mockReset();
  followerMock.mockReset().mockResolvedValue({ userIds: ['U1'] });
});

describe('sendBroadcast · persisted target ผิดรูปต้องไม่ขยายเป็นส่งทุกคน', () => {
  it.each([
    ['empty string', ''],
    ['unknown kind', { kind: 'group' }],
    ['empty ids', { kind: 'line_user_ids', ids: [] }],
    ['null', null],
  ])('%s → ไม่ยิง LINE transport', async (_label, target) => {
    vi.mocked(getDb).mockResolvedValue(dbStub(target) as never);

    const outcome = await sendBroadcast('bad-target');

    expect(outcome.kind).toBe('skipped-invalid-target');
    expect(broadcastMock).not.toHaveBeenCalled();
    expect(multicastMock).not.toHaveBeenCalled();
    expect(followerMock).not.toHaveBeenCalled();
  });
});

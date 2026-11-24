import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { broadcastMock, followerMock, multicastMock, LineApiErrorMock, LineCircuitOpenErrorMock } =
  vi.hoisted(() => {
    class LineApiErrorMock extends Error {
      constructor(endpoint: string, public readonly status: number, detail: string) {
        super(`LINE API ${endpoint} failed (${status}): ${detail}`);
        this.name = 'LineApiError';
      }
    }
    class LineCircuitOpenErrorMock extends Error {
      constructor(endpoint = 'x') {
        super(`LINE API circuit is open (${endpoint})`);
        this.name = 'LineCircuitOpenError';
      }
    }
    return {
      broadcastMock: vi.fn(),
      followerMock: vi.fn(),
      multicastMock: vi.fn(),
      LineApiErrorMock,
      LineCircuitOpenErrorMock,
    };
  });

vi.mock('./client', () => ({
  broadcastMessage: broadcastMock,
  getFollowerIds: followerMock,
  multicast: multicastMock,
  LineApiError: LineApiErrorMock,
}));

vi.mock('./circuit-breaker', () => ({
  withLineCircuit: vi.fn(),
  LineCircuitOpenError: LineCircuitOpenErrorMock,
}));

vi.mock('./identity', () => ({
  decryptLineId: (enc: string) => enc,
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

const { getDb } = await import('@/lib/db');
const { LineApiError } = await import('./client');
const { LineCircuitOpenError } = await import('./circuit-breaker');
const {
  broadcastRetryKey,
  sendBroadcast,
  dryRunBroadcast,
  recoverStaleSending,
  MULTICAST_BATCH_SIZE,
} = await import('./broadcast-service');

interface Row { id: string; content: unknown; target: unknown }

function hash(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

interface StubResult {
  db: unknown;
  updates: Record<string, unknown>[];
  failedInserts: Record<string, unknown>[];
  returningRows: (v: Record<string, unknown>) => Row[];
}

function dbStub(row: Row | null, rawByInternal: Record<string, string> = {}, rawOrder?: string[]): StubResult {
  const updates: Record<string, unknown>[] = [];
  const failedInserts: Record<string, unknown>[] = [];
  let claimCount = 0;
  const orderedValues = (rawOrder ?? Object.keys(rawByInternal)).map((id) => ({ lineUserIdEnc: rawByInternal[id]! }));

  const db = {
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updates.push(v);
        const buildWhere = () => {
          const where = {
            then: (resolve: (x: unknown) => void) => resolve([]),
            returning: async () => {
              claimCount++;
              if (row && claimCount <= 2 && v.status === 'sending') return [row];
              if (v.status === 'scheduled') return [{ id: 'stale-1' }];
              return [];
            },
          };
          return where;
        };
        return { where: buildWhere };
      },
    }),
    select: () => ({
      from: () => ({
        where: async () => orderedValues,
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        failedInserts.push(v);
        return { onConflictDoUpdate: async () => [] };
      },
    }),
  };
  return { db, updates, failedInserts, returningRows: () => [] };
}

const transient500 = () => new LineApiError('/message/broadcast', 500, 'LINE down');
const transient429 = () => new LineApiError('/message/broadcast', 429, 'rate limited');
const permanent400 = () => new LineApiError('/message/broadcast', 400, 'bad request');

beforeEach(() => {
  vi.clearAllMocks();
  broadcastMock.mockReset();
  multicastMock.mockReset();
  followerMock.mockReset();
  followerMock.mockResolvedValue({ userIds: [] });
});

describe('broadcastRetryKey', () => {
  it('deterministic ตาม broadcastId และชุดผู้รับ รูป UUID v5 ตัวพิมพ์เล็ก', () => {
    const first = broadcastRetryKey('b1', ['U1', 'U2']);
    expect(first).toBe(broadcastRetryKey('b1', ['U1', 'U2']));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(broadcastRetryKey('b1', ['U3'])).not.toBe(first);
    expect(broadcastRetryKey('b2', ['U1', 'U2'])).not.toBe(first);
  });

  it('ลำดับผล query ที่สลับกันได้ key เดิม แต่ชุดผู้รับต่างกันได้ key ต่างกัน', () => {
    expect(broadcastRetryKey('b1', ['U2', 'U1'])).toBe(broadcastRetryKey('b1', ['U1', 'U2']));
    expect(broadcastRetryKey('b1', ['U1', 'U3'])).not.toBe(broadcastRetryKey('b1', ['U1', 'U2']));
  });
});

describe('sendBroadcast · all path retry', () => {
  it('ล้มชั่วคราว 2 ครั้งแล้วสำเร็จ → 3 ครั้ง retry key เดิม', async () => {
    const { db, updates } = dbStub({ id: 'b1', content: [], target: { kind: 'all' } });
    vi.mocked(getDb).mockResolvedValue(db as never);
    followerMock.mockResolvedValue({ userIds: ['U1', 'U2'] });
    broadcastMock
      .mockRejectedValueOnce(transient500())
      .mockRejectedValueOnce(transient429())
      .mockResolvedValueOnce(undefined);

    const outcome = await sendBroadcast('b1');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    const keys = broadcastMock.mock.calls.map((call) => call[1]);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(keys[0]).not.toBe(broadcastRetryKey('b1', ['U1', 'U2']));
    expect(outcome).toMatchObject({ kind: 'sent', totalRecipients: 2, successCount: 2, failedCount: 0 });
    expect(updates.at(-1)).toMatchObject({ status: 'sent', totalRecipients: 2, successCount: 2 });
  });

  it('ล้มครบ 3 ครั้ง → failed outcome', async () => {
    const { db, updates } = dbStub({ id: 'b2', content: [], target: 'all' });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockRejectedValue(transient500());

    const outcome = await sendBroadcast('b2');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    expect(outcome.kind).toBe('failed');
    expect(updates.at(-1)).toMatchObject({ status: 'failed' });
  });

  it('400 ถาวร → ยิงครั้งเดียว', async () => {
    const { db } = dbStub({ id: 'b-perm', content: [], target: { kind: 'all' } });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockRejectedValue(permanent400());

    const outcome = await sendBroadcast('b-perm');

    expect(broadcastMock).toHaveBeenCalledTimes(1);
    expect(outcome.kind).toBe('failed');
  });

  it('circuit open → ยิงครั้งเดียว', async () => {
    const { db } = dbStub({ id: 'b-circuit', content: [], target: { kind: 'all' } });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockRejectedValue(new LineCircuitOpenError('/message/broadcast'));

    const outcome = await sendBroadcast('b-circuit');

    expect(broadcastMock).toHaveBeenCalledTimes(1);
    expect(outcome.kind).toBe('failed');
  });

  it('claim ไม่ได้ (ส่งแล้ว) → skipped-not-claimable', async () => {
    const { db } = dbStub(null);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const outcome = await sendBroadcast('bx');
    expect(outcome.kind).toBe('skipped-not-claimable');
    expect(broadcastMock).not.toHaveBeenCalled();
  });
});

describe('sendBroadcast · targeted multicast', () => {
  it('501 recipients แบ่ง 2 ชุด retry key ต่างกัน และ retry ในชุดใช้ key ของชุด', async () => {
    const total = MULTICAST_BATCH_SIZE + 1;
    const ids: string[] = [];
    const rawByInternal: Record<string, string> = {};
    for (let i = 0; i < total; i++) {
      ids.push(`pk-${i}`);
      rawByInternal[`pk-${i}`] = `U${i}`;
    }
    const { db, updates } = dbStub(
      { id: 'bt', content: [], target: { kind: 'line_user_ids', ids } },
      rawByInternal,
    );
    vi.mocked(getDb).mockResolvedValue(db as never);
    multicastMock.mockResolvedValue(undefined);

    const outcome = await sendBroadcast('bt');

    expect(multicastMock).toHaveBeenCalledTimes(2);
    const calls = multicastMock.mock.calls;
    expect(calls[0]?.[0]).toHaveLength(500);
    expect(calls[1]?.[0]).toHaveLength(1);
    const keys = calls.map((call) => call[2]);
    const batch1 = Array.from({ length: 500 }, (_, i) => `U${i}`);
    expect(keys[0]).toBe(broadcastRetryKey('bt', batch1));
    expect(keys[1]).toBe(broadcastRetryKey('bt', ['U500']));
    expect(keys[0]).not.toBe(keys[1]);
    expect(outcome).toMatchObject({ kind: 'sent', totalRecipients: total, successCount: total, failedCount: 0 });
    expect(updates.at(-1)).toMatchObject({ status: 'sent', successCount: total });
  });

  it('ชุดที่สองล้มครบ retry → ใช้ key เดิม 3 ครั้ง counters + failed hash ถูกต้อง', async () => {
    const ids: string[] = [];
    const big: Record<string, string> = {};
    for (let i = 0; i < 501; i++) {
      ids.push(`pk-${i}`);
      big[`pk-${i}`] = `U${i}`;
    }
    const { db, updates, failedInserts } = dbStub(
      { id: 'bp', content: [], target: { kind: 'line_user_ids', ids } },
      big,
    );
    vi.mocked(getDb).mockResolvedValue(db as never);
    multicastMock.mockResolvedValueOnce(undefined).mockRejectedValue(transient500());

    const outcome = await sendBroadcast('bp');

    expect(multicastMock).toHaveBeenCalledTimes(4);
    const retryKeys = multicastMock.mock.calls.slice(1).map((call) => call[2]);
    expect(new Set(retryKeys).size).toBe(1);
    expect(retryKeys[0]).toBe(broadcastRetryKey('bp', ['U500']));
    expect(outcome).toMatchObject({ kind: 'failed', totalRecipients: 501, successCount: 500, failedCount: 1 });
    expect(updates.at(-1)).toMatchObject({ status: 'failed', successCount: 500, failedCount: 1 });
    expect(failedInserts).toHaveLength(1);
    expect(failedInserts[0]).toMatchObject({ recipientHash: hash('U500'), attempts: 3 });
    expect(JSON.stringify(failedInserts)).not.toContain('U500');
  }, 15000);

  it('ผล query สลับลำดับ → key เดิม; ผู้รับเปลี่ยน → key เปลี่ยน (header ที่ LINE เห็น)', async () => {
    const rawByInternal = { 'pk-1': 'U1', 'pk-2': 'U2' };
    const target = { kind: 'line_user_ids' as const, ids: ['pk-1', 'pk-2'] };
    const ordered = dbStub({ id: 'bo', content: [], target }, rawByInternal, ['pk-1', 'pk-2']);
    vi.mocked(getDb).mockResolvedValueOnce(ordered.db as never);
    multicastMock.mockResolvedValueOnce(undefined);
    await sendBroadcast('bo');
    const firstKey = multicastMock.mock.calls[0]?.[2];

    const reordered = dbStub({ id: 'bo', content: [], target }, rawByInternal, ['pk-2', 'pk-1']);
    vi.mocked(getDb).mockResolvedValueOnce(reordered.db as never);
    await sendBroadcast('bo');
    const reorderedKey = multicastMock.mock.calls[1]?.[2];

    const changed = dbStub({ id: 'bo', content: [], target }, { 'pk-1': 'U1', 'pk-2': 'U3' }, ['pk-1', 'pk-2']);
    vi.mocked(getDb).mockResolvedValueOnce(changed.db as never);
    await sendBroadcast('bo');
    const changedKey = multicastMock.mock.calls[2]?.[2];

    expect(reorderedKey).toBe(firstKey);
    expect(changedKey).not.toBe(firstKey);
  });

  it('retry ในชุดใช้ key เดิมเมื่อ results สลับลำดับ', async () => {
    const { db } = dbStub(
      { id: 'br', content: [], target: { kind: 'line_user_ids', ids: ['pk-1', 'pk-2'] } },
      { 'pk-1': 'U1', 'pk-2': 'U2' },
      ['pk-2', 'pk-1'],
    );
    vi.mocked(getDb).mockResolvedValue(db as never);
    multicastMock.mockRejectedValueOnce(transient500()).mockResolvedValueOnce(undefined);

    await sendBroadcast('br');

    expect(multicastMock).toHaveBeenCalledTimes(2);
    const keys = multicastMock.mock.calls.map((call) => call[2]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toBe(broadcastRetryKey('br', ['U1', 'U2']));
  });

  it('เป้าหมายว่างหลัง resolve → failed ไม่ยิง multicast', async () => {
    const { db } = dbStub({ id: 'be', content: [], target: { kind: 'line_user_ids', ids: ['pk-x'] } }, {});
    vi.mocked(getDb).mockResolvedValue(db as never);
    const outcome = await sendBroadcast('be');
    expect(outcome.kind).toBe('failed');
    expect(multicastMock).not.toHaveBeenCalled();
  });
});

describe('recoverStaleSending', () => {
  it('requeue sending ค้างเป็น scheduled และคืนจำนวนแถว', async () => {
    const { db, updates } = dbStub(null);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const recovered = await recoverStaleSending();

    expect(recovered).toBe(1);
    expect(updates[0]).toMatchObject({ status: 'scheduled' });
    expect(updates[0]?.scheduledAt).toBeInstanceOf(Date);
    expect(updates[0]?.updatedAt).toBeInstanceOf(Date);
    expect(String(updates[0]?.errorMessage ?? '')).toBe('');
  });

  it('sendBroadcast ไม่ mark stale เป็น failed อีกต่อไป', async () => {
    const { db, updates } = dbStub({ id: 'b1', content: [], target: { kind: 'all' } });
    vi.mocked(getDb).mockResolvedValue(db as never);
    followerMock.mockResolvedValue({ userIds: [] });
    broadcastMock.mockResolvedValue(undefined);

    await sendBroadcast('b1');

    expect(updates.some((u) => String(u.errorMessage ?? '').includes('ค้างสถานะกำลังส่ง'))).toBe(false);
  });
});

describe('dryRunBroadcast', () => {
  it('all นับ followers โดยไม่เรียก broadcastMessage', async () => {
    followerMock.mockResolvedValue({ userIds: ['U1', 'U2', 'U3'] });
    const result = await dryRunBroadcast();
    expect(result).toMatchObject({ estimatedRecipients: 3 });
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('targeted นับจาก DB ไม่ยิง LINE', async () => {
    const { db } = dbStub(null, { 'pk-1': 'U1', 'pk-2': 'U2' });
    vi.mocked(getDb).mockResolvedValue(db as never);
    const result = await dryRunBroadcast({ kind: 'line_user_ids', ids: ['pk-1', 'pk-2'] });
    expect(result.estimatedRecipients).toBe(2);
    expect(followerMock).not.toHaveBeenCalled();
  });
});

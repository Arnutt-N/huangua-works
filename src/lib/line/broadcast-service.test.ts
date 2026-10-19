import { createHash } from 'node:crypto';
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

// § mock decrypt ให้คืนค่าตรงๆ — enc จริงต้องผ่าน key ซึ่ง test นี้ไม่ต้องการพิสูจน์
vi.mock('./identity', () => ({
  decryptLineId: (enc: string) => enc,
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

const { getDb } = await import('@/lib/db');
const { sendBroadcast, dryRunBroadcast, MULTICAST_BATCH_SIZE } = await import('./broadcast-service');

interface Row { id: string; content: unknown; target: unknown }

function hash(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

// § stub DB แบบ stateful ขั้นต่ำ — update claim คืนแถวครั้งแรก, select line_users คืน enc
// insert failed recipients เก็บลง array ให้ตรวจว่าไม่มี raw id หลุด
function dbStub(row: Row | null, rawByInternal: Record<string, string> = {}) {
  const updates: Record<string, unknown>[] = [];
  const failedInserts: Record<string, unknown>[] = [];
  let claimCount = 0;
  const db = {
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updates.push(v);
        return {
          where: () => ({
            returning: async () => {
              claimCount++;
              // update แรกคือ stale recovery (ไม่มี returning chain ในโค้ดจริงใช้ await ตรง)
              if (row && claimCount <= 2 && (v.status === 'sending')) return [row];
              return [];
            },
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        // § mock enc ด้วย raw ตรงๆ — decryptLineId ถูก mock ข้างล่างให้คืนค่านี้กลับ
        where: async () => Object.values(rawByInternal).map((lineUserId) => ({ lineUserIdEnc: lineUserId })),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        failedInserts.push(v);
        return { onConflictDoUpdate: async () => [] };
      },
    }),
  };
  // stale recovery update ไม่มี .returning — where ต้อง await ได้
  const origUpdate = db.update;
  db.update = (() => {
    const chain = origUpdate();
    const origSet = chain.set;
    chain.set = (v: Record<string, unknown>) => {
      const r = origSet(v);
      const origWhere = r.where;
      r.where = (() => {
        const w = origWhere();
        const thenable = Object.assign(w, {
          then: (resolve: (x: unknown) => void) => resolve([]),
        });
        return thenable;
      }) as never;
      return r;
    };
    return chain;
  }) as never;
  return { db, updates, failedInserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  broadcastMock.mockReset();
  multicastMock.mockReset();
  followerMock.mockReset();
  followerMock.mockResolvedValue({ userIds: [] });
});

describe('sendBroadcast · all path', () => {
  it('ล้ม 2 ครั้งแล้วสำเร็จ → ยิง 3 ครั้ง สถานะ sent พร้อม counters จาก follower count', async () => {
    const { db, updates } = dbStub({ id: 'b1', content: [], target: { kind: 'all' } });
    vi.mocked(getDb).mockResolvedValue(db as never);
    followerMock.mockResolvedValue({ userIds: ['U1', 'U2'] });
    broadcastMock
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce(undefined);

    const outcome = await sendBroadcast('b1');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ kind: 'sent', totalRecipients: 2, successCount: 2, failedCount: 0 });
    expect(updates.at(-1)).toMatchObject({ status: 'sent', totalRecipients: 2, successCount: 2 });
  });

  it('ล้มครบ 3 ครั้ง → failed outcome', async () => {
    const { db, updates } = dbStub({ id: 'b2', content: [], target: 'all' });
    vi.mocked(getDb).mockResolvedValue(db as never);
    broadcastMock.mockRejectedValue(new Error('LINE down'));

    const outcome = await sendBroadcast('b2');

    expect(broadcastMock).toHaveBeenCalledTimes(3);
    expect(outcome.kind).toBe('failed');
    expect(updates.at(-1)).toMatchObject({ status: 'failed' });
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
  it('แบ่งชุดละ 500 และนับ success ครบ', async () => {
    const total = MULTICAST_BATCH_SIZE + 1;
    const rawByInternal: Record<string, string> = {};
    const ids: string[] = [];
    for (let i = 0; i < total; i++) {
      ids.push(`pk-${i}`);
      rawByInternal[`pk-${i}`] = `U${i}`;
    }
    const { db, updates } = dbStub({ id: 'bt', content: [], target: { kind: 'line_user_ids', ids } }, rawByInternal);
    vi.mocked(getDb).mockResolvedValue(db as never);
    multicastMock.mockResolvedValue(undefined);

    const outcome = await sendBroadcast('bt');

    expect(multicastMock).toHaveBeenCalledTimes(2);
    expect(multicastMock.mock.calls[0]?.[0]).toHaveLength(500);
    expect(multicastMock.mock.calls[1]?.[0]).toHaveLength(1);
    expect(outcome).toMatchObject({ kind: 'sent', totalRecipients: total, successCount: total, failedCount: 0 });
    expect(updates.at(-1)).toMatchObject({ status: 'sent', successCount: total });
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('ชุดที่สองล้มครบ retry → failed counters แยกชุด + failed rows เก็บ hash ไม่เก็บ raw id', async () => {
    const rawByInternal = { 'pk-1': 'U1', 'pk-2': 'U2' };
    // บังคับชุดละ 1 ด้วยการ mock batch boundary ไม่ได้ — ใช้ 501 รายให้ชุดสองมี 1 รายแทน
    const big: Record<string, string> = {};
    const ids: string[] = [];
    for (let i = 0; i < 501; i++) {
      ids.push(`pk-${i}`);
      big[`pk-${i}`] = `U${i}`;
    }
    void rawByInternal;
    const { db, updates, failedInserts } = dbStub({ id: 'bp', content: [], target: { kind: 'line_user_ids', ids } }, big);
    vi.mocked(getDb).mockResolvedValue(db as never);
    multicastMock.mockResolvedValueOnce(undefined).mockRejectedValue(new Error('429'));

    const outcome = await sendBroadcast('bp');

    expect(outcome).toMatchObject({ kind: 'failed', totalRecipients: 501, successCount: 500, failedCount: 1 });
    expect(updates.at(-1)).toMatchObject({ status: 'failed', successCount: 500, failedCount: 1 });
    expect(failedInserts).toHaveLength(1);
    expect(failedInserts[0]).toMatchObject({ recipientHash: hash('U500'), attempts: 3 });
    expect(JSON.stringify(failedInserts)).not.toContain('U500');
  }, 15000);

  it('เป้าหมายว่างหลัง resolve → failed ไม่ยิง multicast', async () => {
    const { db } = dbStub({ id: 'be', content: [], target: { kind: 'line_user_ids', ids: ['pk-x'] } }, {});
    vi.mocked(getDb).mockResolvedValue(db as never);
    const outcome = await sendBroadcast('be');
    expect(outcome.kind).toBe('failed');
    expect(multicastMock).not.toHaveBeenCalled();
  });
});

describe('sendBroadcast · stale sending recovery', () => {
  it('update แรกของ send คือการ mark stale sending เป็น failed', async () => {
    const { db, updates } = dbStub(null);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await sendBroadcast('stale-check');
    expect(updates[0]).toMatchObject({ status: 'failed' });
    expect(String(updates[0]?.errorMessage)).toContain('ค้างสถานะกำลังส่ง');
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
    // dryRun targeted ใช้ select({id}) — stub คืน raw map ก็ยังนับจำนวนแถวได้
    vi.mocked(getDb).mockResolvedValue(db as never);
    const result = await dryRunBroadcast({ kind: 'line_user_ids', ids: ['pk-1', 'pk-2'] });
    expect(result.estimatedRecipients).toBe(2);
    expect(followerMock).not.toHaveBeenCalled();
  });
});

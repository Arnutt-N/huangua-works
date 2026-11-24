import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recoverMock, dueMock, sendMock } = vi.hoisted(() => ({
  recoverMock: vi.fn(async () => 2),
  dueMock: vi.fn(async () => [] as { id: string }[]),
  sendMock: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ requireCron: () => ({ ok: true }) }));
vi.mock('@/lib/line/broadcast-service', () => ({
  recoverStaleSending: recoverMock,
  getDueScheduled: dueMock,
  sendBroadcast: sendMock,
}));

import { GET } from './route';

function cronRequest() {
  return new NextRequest('http://localhost/api/cron/broadcast-send');
}

describe('GET /api/cron/broadcast-send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recoverMock.mockResolvedValue(2);
    dueMock.mockResolvedValue([]);
    sendMock.mockReset();
  });

  it('ไม่มี due row ก็ยังเรียก recovery ทุก รอบ', async () => {
    const res = await GET(cronRequest());
    const body = await res.json();

    expect(recoverMock).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({ ok: true, recovered: 2, sent: 0, failed: 0, skipped: 0, results: [] });
  });

  it('รายการแรก throw ไม่หยุดรายการที่สอง และผลแยกตาม id', async () => {
    dueMock.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    sendMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ kind: 'sent', totalRecipients: 3, successCount: 3, failedCount: 0 });

    const res = await GET(cronRequest());
    const body = (await res.json()) as {
      recovered: number;
      sent: number;
      failed: number;
      skipped: number;
      results: Array<{ id: string; error?: string }>;
    };

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toMatchObject({ id: 'b1', error: 'boom' });
    expect(body.results[1]).toMatchObject({ id: 'b2', kind: 'sent', successCount: 3 });
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
  });

  it('ผล failed/skipped นับตาม outcome ของแต่ละรายการ', async () => {
    dueMock.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    sendMock
      .mockResolvedValueOnce({ kind: 'failed', totalRecipients: 2, successCount: 1, failedCount: 1, error: ' LINE down' })
      .mockResolvedValueOnce({ kind: 'skipped-not-claimable' });

    const body = (await (await GET(cronRequest())).json()) as {
      sent: number;
      failed: number;
      skipped: number;
      results: Array<{ id: string; kind: string }>;
    };

    expect(body).toMatchObject({ sent: 0, failed: 1, skipped: 1 });
    expect(body.results.map((r) => r.kind)).toEqual(['failed', 'skipped-not-claimable']);
  });
});

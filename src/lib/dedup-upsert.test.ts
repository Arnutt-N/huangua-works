import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

const { mockDb, mockState, mockInsert } = vi.hoisted(() => {
  const mockState = { config: null as { target: unknown; set: unknown; setWhere?: unknown } | null };
  const mockInsert = {
    values: vi.fn(() => mockInsert),
    onConflictDoUpdate: vi.fn((config: { target: unknown; set: unknown; setWhere?: unknown }) => {
      mockState.config = config;
      return mockInsert;
    }),
    onConflictDoNothing: vi.fn(() => mockInsert),
    returning: vi.fn(async () => [{ caseId: 'winner', id: 'row-1' }]),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
  };
  const mockDb = {
    insert: vi.fn(() => mockInsert),
    select: vi.fn(() => mockInsert),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
  };
  return { mockDb, mockState, mockInsert };
});

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => mockDb) }));

const { claimDedupHash } = await import('./dedup');
const { dedupHashes } = await import('@/lib/db/schema');

describe('claimDedupHash · SQL shape', () => {
  it('แถวที่ยังไม่หมดอายุชนแล้วคืน caseId เดิมให้ caller ปฏิเสธการซ้ำ', async () => {
    mockInsert.returning.mockResolvedValueOnce([{ caseId: 'other-case', id: 'existing-row' }]);

    const result = await claimDedupHash('cid', 'title', 'desc', 'new-case', mockDb as never);

    expect(result.caseId).toBe('other-case');
  });


  it('ใช้ ON CONFLICT DO UPDATE เฉพาะแถวที่หมดอายุ', async () => {
    const result = await claimDedupHash('cid', 'title', 'desc', 'case-1', mockDb as never);

    expect(result).toEqual({ caseId: 'winner', fingerprint: 'row-1' });
    expect(mockInsert.onConflictDoUpdate).toHaveBeenCalled();
    const config = mockState.config;
    expect(config?.target).toBe(dedupHashes.hash);
    expect(config?.set).toMatchObject({ caseId: 'case-1' });
    expect(config?.setWhere).toBeDefined();
    const dialect = new PgDialect();
    const rendered = dialect.sqlToQuery(config?.setWhere as never);
    expect(rendered.sql.toLowerCase()).toContain('expires_at');
    expect(mockState.config).not.toHaveProperty('targetWhere');
    expect(mockInsert.onConflictDoNothing).not.toHaveBeenCalled();
  });
});

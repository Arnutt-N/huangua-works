import { describe, expect, it } from 'vitest';
import { parseBroadcastTarget } from './broadcast-target';

describe('parseBroadcastTarget · fail closed', () => {
  it('ยอมรับ explicit all', () => {
    expect(parseBroadcastTarget({ kind: 'all' })).toEqual({ kind: 'all' });
  });

  it('ยอมรับ legacy text all', () => {
    expect(parseBroadcastTarget('all')).toEqual({ kind: 'all' });
  });

  it('ยอมรับ targeted ids ที่ถูกต้อง', () => {
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: ['pk-1', 'pk-2'] })).toEqual({
      kind: 'line_user_ids',
      ids: ['pk-1', 'pk-2'],
    });
  });

  it('รูปแบบวัตถุที่ไม่รู้จักต้อง invalid ไม่ใช่ all', () => {
    expect(parseBroadcastTarget({ kind: 'unknown' })).toBeNull();
    expect(parseBroadcastTarget({})).toBeNull();
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: [] })).toBeNull();
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: [''] })).toBeNull();
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: 'pk-1' })).toBeNull();
  });

  it('ค่าเปล่า/ผิดชนิดต้อง invalid', () => {
    expect(parseBroadcastTarget('')).toBeNull();
    expect(parseBroadcastTarget(null)).toBeNull();
    expect(parseBroadcastTarget(undefined)).toBeNull();
    expect(parseBroadcastTarget(42)).toBeNull();
    expect(parseBroadcastTarget([])).toBeNull();
  });
});

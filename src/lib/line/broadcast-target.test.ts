import { describe, expect, it } from 'vitest';
import { broadcastTargetSchema, parseBroadcastTarget } from './broadcast-target';

describe('parseBroadcastTarget', () => {
  it('all object ผ่านตรง', () => {
    expect(parseBroadcastTarget({ kind: 'all' })).toEqual({ kind: 'all' });
  });

  it('line_user_ids dedupe และตัดค่าที่ไม่ใช่ string', () => {
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: ['a', 'a', 'b', 1, ''] })).toEqual({
      kind: 'line_user_ids',
      ids: ['a', 'b'],
    });
  });

  it('legacy text และค่าเพี้ยน fallback เป็น all', () => {
    expect(parseBroadcastTarget('all')).toEqual({ kind: 'all' });
    expect(parseBroadcastTarget(null)).toEqual({ kind: 'all' });
    expect(parseBroadcastTarget({ kind: 'line_user_ids', ids: [] })).toEqual({ kind: 'all' });
    expect(parseBroadcastTarget({ kind: 'bogus' })).toEqual({ kind: 'all' });
  });
});

describe('broadcastTargetSchema (API boundary)', () => {
  it('รับรูปแบบที่ถูกต้อง ปฏิเสธ ids ว่าง', () => {
    expect(broadcastTargetSchema.parse({ kind: 'line_user_ids', ids: ['pk-1'] })).toEqual({
      kind: 'line_user_ids',
      ids: ['pk-1'],
    });
    expect(broadcastTargetSchema.safeParse({ kind: 'line_user_ids', ids: [] }).success).toBe(false);
    expect(broadcastTargetSchema.safeParse({ kind: 'raw', ids: ['U1'] }).success).toBe(false);
  });
});

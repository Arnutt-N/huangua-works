import { describe, expect, test } from 'vitest';
import { planDisplayActions, type DisplayCandidate } from './rich-menu-service';

const T0 = new Date('2026-10-13T12:00:00Z');
const PAST = new Date('2026-10-13T11:00:00Z');
const FUTURE = new Date('2026-10-13T13:00:00Z');

function cand(over: Partial<DisplayCandidate>): DisplayCandidate {
  return {
    id: 'm1',
    lineRichMenuId: 'line-1',
    status: 'draft',
    syncStatus: 'synced',
    displayStartAt: null,
    displayEndAt: null,
    ...over,
  };
}

describe('planDisplayActions', () => {
  test('ถึงเวลาเริ่ม + synced → activate', () => {
    const r = planDisplayActions([cand({ displayStartAt: PAST })], T0, null);
    expect(r.activate).toEqual(['m1']);
    expect(r.expire).toEqual([]);
    expect(r.cancelDefault).toBe(false);
  });

  test('หมดเวลา + active + เป็น default อยู่ → expire + ยกเลิก default', () => {
    const r = planDisplayActions(
      [cand({ status: 'active', displayStartAt: PAST, displayEndAt: PAST })],
      T0,
      'line-1',
    );
    expect(r.expire).toEqual(['m1']);
    expect(r.cancelDefault).toBe(true);
  });

  test('หมดเวลาแต่ default เป็นของคนอื่น → expire แต่ไม่ยกเลิก (AC4)', () => {
    const r = planDisplayActions(
      [cand({ status: 'active', displayStartAt: PAST, displayEndAt: PAST })],
      T0,
      'line-other',
    );
    expect(r.expire).toEqual(['m1']);
    expect(r.cancelDefault).toBe(false);
  });

  test('ยังไม่ sync (ไม่มี line id) → ไม่ทำอะไร', () => {
    const r = planDisplayActions(
      [cand({ lineRichMenuId: null, displayStartAt: PAST })],
      T0,
      null,
    );
    expect(r.activate).toEqual([]);
    expect(r.expire).toEqual([]);
  });

  test('ไม่มี schedule (null คู่) → manual ไม่แตะ', () => {
    const r = planDisplayActions([cand({})], T0, null);
    expect(r.activate).toEqual([]);
    expect(r.expire).toEqual([]);
  });

  test('ยังไม่ถึงเวลาเริ่ม → ไม่ activate', () => {
    const r = planDisplayActions([cand({ displayStartAt: FUTURE })], T0, null);
    expect(r.activate).toEqual([]);
  });

  test('election ข้าม incumbent — active ใหม่กว่าชนะ ไม่ activate ซ้ำ', () => {
    const r = planDisplayActions(
      [
        cand({ id: 'new', status: 'active', displayStartAt: PAST }),
        cand({ id: 'old', lineRichMenuId: 'line-old', displayStartAt: new Date('2026-10-13T10:00:00Z') }),
      ],
      T0,
      'line-1',
    );
    expect(r.activate).toEqual([]);
    expect(r.demote).toEqual([]);
  });

  test('demote ตัวแพ้ election (active เก่ากว่า)', () => {
    const r = planDisplayActions(
      [
        cand({ id: 'old', status: 'active', lineRichMenuId: 'line-old', displayStartAt: new Date('2026-10-13T10:00:00Z') }),
        cand({ id: 'new', lineRichMenuId: 'line-2', displayStartAt: PAST }),
      ],
      T0,
      'line-old',
    );
    expect(r.activate).toEqual(['new']);
    expect(r.demote).toEqual(['old']);
  });

  test('มีแค่ end (ไม่มี start) → ไม่ activate (กัน publish หลุด)', () => {
    const r = planDisplayActions([cand({ displayEndAt: FUTURE })], T0, null);
    expect(r.activate).toEqual([]);
    expect(r.expire).toEqual([]);
  });

  test('expire + activate พร้อมกัน → ข้าม cancel (setDefault ใหม่ทับแล้ว)', () => {
    const r = planDisplayActions(
      [
        cand({ id: 'old', status: 'active', displayStartAt: PAST, displayEndAt: PAST }),
        cand({ id: 'new', lineRichMenuId: 'line-2', displayStartAt: PAST }),
      ],
      T0,
      'line-1',
    );
    expect(r.activate).toEqual(['new']);
    expect(r.expire).toEqual(['old']);
    expect(r.cancelDefault).toBe(false);
  });

  test('overlap สองตัว → ชนะตัวเดียว (start ล่าสุด)', () => {
    const r = planDisplayActions(
      [
        cand({ id: 'a', lineRichMenuId: 'line-a', displayStartAt: PAST }),
        cand({ id: 'b', lineRichMenuId: 'line-b', displayStartAt: new Date('2026-10-13T11:30:00Z') }),
      ],
      T0,
      null,
    );
    expect(r.activate).toEqual(['b']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ALL_STATUSES_ORDERED,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS_TH,
  TERMINAL_STATUSES,
  assertTransition,
  statusProgress,
} from './state-machine';

describe('state-machine · assertTransition', () => {
  describe('valid forward transitions', () => {
    it('allows received → reviewing', () => {
      expect(assertTransition('received', 'reviewing')).toEqual({ ok: true });
    });
    it('allows reviewing → assigned', () => {
      expect(assertTransition('reviewing', 'assigned')).toEqual({ ok: true });
    });
    it('allows assigned → in_progress', () => {
      expect(assertTransition('assigned', 'in_progress')).toEqual({ ok: true });
    });
    it('allows in_progress → done', () => {
      expect(assertTransition('in_progress', 'done')).toEqual({ ok: true });
    });
    it('allows done → closed', () => {
      expect(assertTransition('done', 'closed')).toEqual({ ok: true });
    });
  });

  describe('rejection paths', () => {
    it('allows received → rejected (early triage)', () => {
      expect(assertTransition('received', 'rejected')).toEqual({ ok: true });
    });
    it('allows reviewing → rejected (after review)', () => {
      expect(assertTransition('reviewing', 'rejected')).toEqual({ ok: true });
    });
  });

  describe('reopen path', () => {
    it('allows done → in_progress (citizen reports not fixed)', () => {
      expect(assertTransition('done', 'in_progress')).toEqual({ ok: true });
    });
    it('allows reviewing → received (sent back to intake)', () => {
      expect(assertTransition('reviewing', 'received')).toEqual({ ok: true });
    });
  });

  describe('same-status rejected', () => {
    it('rejects received → received', () => {
      const r = assertTransition('received', 'received');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/ไม่เหมือนสถานะปัจจุบัน/);
    });
  });

  describe('invalid skips', () => {
    it('rejects received → in_progress (skips reviewing/assigned)', () => {
      const r = assertTransition('received', 'in_progress');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/ไม่สามารถเปลี่ยน/);
    });
    it('rejects received → closed (skips everything)', () => {
      expect(assertTransition('received', 'closed').ok).toBe(false);
    });
    it('rejects assigned → done (skips in_progress)', () => {
      expect(assertTransition('assigned', 'done').ok).toBe(false);
    });
    it('rejects received → assigned (skips reviewing)', () => {
      expect(assertTransition('received', 'assigned').ok).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('rejects closed → anything', () => {
      const r = assertTransition('closed', 'received');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/ปิดเรื่อง/);
    });
    it('rejects rejected → anything', () => {
      expect(assertTransition('rejected', 'received').ok).toBe(false);
    });
    it('terminal reason mentions "ผู้ดูแลระบบ"', () => {
      const r = assertTransition('closed', 'reviewing');
      expect(r.reason).toMatch(/ผู้ดูแลระบบ/);
    });
  });
});

describe('state-machine · TERMINAL_STATUSES', () => {
  it('contains closed + rejected', () => {
    expect(TERMINAL_STATUSES).toEqual(['closed', 'rejected']);
  });
});

describe('state-machine · ALLOWED_TRANSITIONS', () => {
  it('terminal states have empty allowed list', () => {
    expect(ALLOWED_TRANSITIONS.closed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
  });
  it('received has 2 options', () => {
    expect(ALLOWED_TRANSITIONS.received).toHaveLength(2);
  });
});

describe('state-machine · STATUS_LABELS_TH', () => {
  it('covers all 7 statuses', () => {
    expect(Object.keys(STATUS_LABELS_TH)).toHaveLength(7);
  });
  it('uses Thai for received', () => {
    expect(STATUS_LABELS_TH.received).toBe('รับเรื่อง');
  });
});

describe('state-machine · ALL_STATUSES_ORDERED', () => {
  it('has 7 entries', () => {
    expect(ALL_STATUSES_ORDERED).toHaveLength(7);
  });
});

describe('state-machine · statusProgress', () => {
  it('received = ~17% (1/6)', () => {
    expect(statusProgress('received')).toBe(17);
  });
  it('closed = 100% (6/6)', () => {
    expect(statusProgress('closed')).toBe(100);
  });
  it('rejected = 100% (terminal)', () => {
    expect(statusProgress('rejected')).toBe(100);
  });
  it('in_progress = ~67% (4/6)', () => {
    expect(statusProgress('in_progress')).toBe(67);
  });
});

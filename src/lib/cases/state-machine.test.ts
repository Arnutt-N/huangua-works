import { describe, expect, it } from 'vitest';
import {
  ALL_STATUSES,
  ALLOWED_TRANSITIONS,
  OPEN_STATUSES,
  STATUS_LABELS_TH,
  STATUS_LABELS_TH_CITIZEN,
  TERMINAL_STATUSES,
  assertTransition,
  isCaseStatus,
  statusProgress,
} from './state-machine';

describe('state-machine · assertTransition', () => {
  describe('valid forward transitions', () => {
    it('allows pending → received', () => {
      expect(assertTransition('pending', 'received')).toEqual({ ok: true });
    });
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
  it('covers all 9 statuses', () => {
    expect(Object.keys(STATUS_LABELS_TH)).toHaveLength(9);
  });
  it('uses Thai for received', () => {
    expect(STATUS_LABELS_TH.received).toBe('รับเรื่อง');
  });
});

describe('state-machine · STATUS_LABELS_TH_CITIZEN', () => {
  it('covers all 9 statuses', () => {
    expect(Object.keys(STATUS_LABELS_TH_CITIZEN)).toHaveLength(9);
  });
  it('pins citizen wording where it differs from admin register', () => {
    expect(STATUS_LABELS_TH_CITIZEN.received).toBe('รับเรื่องแล้ว');
    expect(STATUS_LABELS_TH_CITIZEN.reviewing).toBe('กำลังตรวจสอบ');
    expect(STATUS_LABELS_TH_CITIZEN.assigned).toBe('มอบหมายแล้ว');
    expect(STATUS_LABELS_TH_CITIZEN.done).toBe('เสร็จสิ้น');
    expect(STATUS_LABELS_TH_CITIZEN.rejected).toBe('ไม่รับเรื่อง');
  });
});

describe('state-machine · OPEN_STATUSES', () => {
  it('contains the 6 open statuses', () => {
    expect(OPEN_STATUSES).toEqual(['pending', 'received', 'reviewing', 'awaiting_budget', 'assigned', 'in_progress']);
  });
  it('is disjoint from TERMINAL_STATUSES', () => {
    expect(OPEN_STATUSES.filter((s) => TERMINAL_STATUSES.includes(s))).toEqual([]);
  });
  it('excludes done', () => {
    expect(OPEN_STATUSES).not.toContain('done');
  });
});

describe('state-machine · isCaseStatus', () => {
  it('accepts every known status', () => {
    for (const s of ALL_STATUSES) {
      expect(isCaseStatus(s)).toBe(true);
    }
  });
  it('rejects unknown strings', () => {
    expect(isCaseStatus('urgent')).toBe(false);
    expect(isCaseStatus('unknown_status')).toBe(false);
    expect(isCaseStatus('')).toBe(false);
  });
});

describe('state-machine · ALL_STATUSES', () => {
  it('has 9 entries', () => {
    expect(ALL_STATUSES).toHaveLength(9);
  });
});

describe('state-machine · statusProgress', () => {
  it('pending = ~13% (1/8)', () => {
    expect(statusProgress('pending')).toBe(13);
  });
  it('received = 25% (2/8)', () => {
    expect(statusProgress('received')).toBe(25);
  });
  it('awaiting_budget = 50% (4/8)', () => {
    expect(statusProgress('awaiting_budget')).toBe(50);
  });
  it('closed = 100% (8/8)', () => {
    expect(statusProgress('closed')).toBe(100);
  });
  it('rejected = 100% (terminal)', () => {
    expect(statusProgress('rejected')).toBe(100);
  });
  it('in_progress = 75% (6/8)', () => {
    expect(statusProgress('in_progress')).toBe(75);
  });
});

describe('state-machine · awaiting_budget transitions', () => {
  it('reviewing → awaiting_budget ผ่าน', () => {
    expect(assertTransition('reviewing', 'awaiting_budget')).toEqual({ ok: true });
  });
  it('awaiting_budget → assigned ผ่าน', () => {
    expect(assertTransition('awaiting_budget', 'assigned')).toEqual({ ok: true });
  });
  it('awaiting_budget → reviewing ย้อนกลับได้', () => {
    expect(assertTransition('awaiting_budget', 'reviewing')).toEqual({ ok: true });
  });
  it('awaiting_budget → done ตรงไม่ได้', () => {
    expect(assertTransition('awaiting_budget', 'done').ok).toBe(false);
  });
  it('มี label ภาษาไทยทั้งสอง register', () => {
    expect(STATUS_LABELS_TH.awaiting_budget).toBe('รออนุมัติงบประมาณ');
    expect(STATUS_LABELS_TH_CITIZEN.awaiting_budget).toBe('รออนุมัติงบประมาณ');
  });
});

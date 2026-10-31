import { describe, it, expect } from 'vitest';
import { buildTimeline } from './operations';

/**
 * ปักหมุด privacy invariant ของ timeline — ทดสอบได้โดยไม่ต้องมี Postgres
 *
 * § ทำไมต้องมี
 * GET /api/cases/[id] เป็น endpoint สาธารณะที่กรองด้วย `isPublic = true` อย่างเดียว
 * ไม่ดู updateType ดังนั้น entry ไหนที่ถูกตั้ง isPublic: true จะถูกส่งออกให้ใครก็ตาม
 * ที่มีเลขติดตาม โดยไม่ต้องล็อกอิน
 *
 * assignment/department เก็บ oldValue/newValue เป็น UUID ของ users/departments
 * ถ้ามีใครเผลอเปลี่ยนกลับเป็น true จะไม่มี type error ไม่มี runtime error และ
 * ไม่มีอะไรพังให้เห็น — ข้อมูลแค่ไหลออกไปเงียบ ๆ เทสต์นี้คือด่านเดียวที่จับได้
 */
const CURRENT = {
  status: 'received',
  priority: 'normal',
  budgetStatus: 'unspecified',
  budgetAmount: null,
  actionDetails: null,
  assignedTo: null,
  departmentId: null,
};

describe('buildTimeline — privacy invariant', () => {
  it('assignment ต้องไม่เป็น public เพราะ oldValue/newValue คือ users.id', () => {
    const result = buildTimeline({ kind: 'assignment', officerId: 'officer-uuid' }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(false);
      // ยืนยันด้วยว่า UUID อยู่ในฟิลด์ที่เราคิดจริง ๆ — ถ้าโครงสร้างเปลี่ยน เทสต์ต้องรู้
      expect(result.entry.newValue).toBe('officer-uuid');
    }
  });

  it('การเปลี่ยนหน่วยงานต้องไม่เป็น public เพราะเก็บ departments.id', () => {
    const result = buildTimeline({ kind: 'department', departmentId: 'dept-uuid' }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(false);
      expect(result.entry.newValue).toBe('dept-uuid');
    }
  });

  it('หมายเหตุส่งค่า isPublic ที่ผู้เรียกระบุมาตรง ๆ ไม่แอบเปลี่ยน', () => {
    const priv = buildTimeline({ kind: 'comment', comment: 'โทรหาผู้แจ้ง', isPublic: false }, CURRENT);
    expect('entry' in priv && priv.entry.isPublic).toBe(false);

    const pub = buildTimeline({ kind: 'comment', comment: 'ลงพื้นที่แล้ว', isPublic: true }, CURRENT);
    expect('entry' in pub && pub.entry.isPublic).toBe(true);
  });

  it('การเปลี่ยนสถานะส่งค่า isPublic ที่ผู้เรียกระบุมาตรง ๆ', () => {
    const result = buildTimeline(
      { kind: 'status', newStatus: 'reviewing', comment: null, isPublic: true },
      CURRENT,
    );
    expect('entry' in result && result.entry.isPublic).toBe(true);
  });

  /**
   * § ความเร่งด่วนยังเป็น public โดยตั้งใจ — ต่างจาก assignment/department
   *
   * ค่าที่เก็บคือ 'normal'/'urgent' กับ comment ภาษาไทยที่อ่านออก ไม่ใช่ UUID ภายใน
   * และผู้แจ้งควรได้รู้ว่าเรื่องของตัวเองถูกจัดเป็นด่วนหรือไม่ จึงไม่ใช่ข้อมูลที่ต้องปิด
   *
   * ที่ต้องระวังคือมันใช้ updateType 'metadata_change' ร่วมกับการเปลี่ยนหน่วยงาน
   * ดังนั้นการกวาดปิดด้วย updateType อย่างเดียว (เช่นใน migration) จะปิดอันนี้ไปด้วย
   * — เทสต์นี้จึงทำหน้าที่เตือนว่าสองอย่างนี้ใช้ type เดียวกันแต่มีนโยบายต่างกัน
   */
  it('ความเร่งด่วนยังเป็น public — ค่าไม่ใช่ UUID และผู้แจ้งควรได้รู้', () => {
    const result = buildTimeline({ kind: 'priority', priority: 'urgent' }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(true);
      expect(result.entry.updateType).toBe('metadata_change'); // ใช้ type ร่วมกับ department
      expect(result.entry.newValue).toBe('urgent');
    }
  });
});

describe('buildTimeline — budget', () => {
  it('ค่าเดิม → error ภาษาไทย (กัน timeline ขยะจากการกดซ้ำ)', () => {
    const result = buildTimeline({ kind: 'budget', budgetStatus: 'unspecified' }, CURRENT);
    expect('error' in result && result.error).toBe('สถานะงบประมาณเหมือนเดิม');
  });

  /**
   * § งบประมาณเป็น internal โดยตั้งใจ — ค่าที่เก็บเป็น enum ภาษาอังกฤษ
   * ไม่ใช่ข้อความอ่านออก และ /track ไม่มี field งบประมาณให้ประชาชนดู
   * ถ้าเผลอตั้ง true จะไม่มี type error — เทสต์นี้คือด่านเดียวที่จับได้
   * (pattern เดียวกับ privacy invariant ของ assignment ด้านบน)
   */
  it('เปลี่ยนงบประมาณต้องไม่เป็น public — ค่าเป็น enum ภายใน', () => {
    const result = buildTimeline({ kind: 'budget', budgetStatus: 'has_budget' }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(false);
      expect(result.entry.updateType).toBe('metadata_change');
      expect(result.entry.oldValue).toBe('unspecified');
      expect(result.entry.newValue).toBe('has_budget');
    }
  });
});

describe('buildTimeline — budget amount and action details', () => {
  it('budget_amount เปลี่ยนค่าได้ เป็น internal', () => {
    const result = buildTimeline({ kind: 'budget_amount', budgetAmount: 15000 }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(false);
      expect(result.entry.newValue).toBe('15000');
    }
  });
  it('budget_amount เท่าเดิมถูกปฏิเสธ', () => {
    const same = { ...CURRENT, budgetAmount: 15000 };
    expect(buildTimeline({ kind: 'budget_amount', budgetAmount: 15000 }, same)).toHaveProperty('error');
  });
  it('action_details เปลี่ยนค่าได้ เป็น internal', () => {
    const result = buildTimeline({ kind: 'action_details', actionDetails: 'เทคอนกรีตแล้ว' }, CURRENT);
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.isPublic).toBe(false);
      expect(result.entry.newValue).toBe('เทคอนกรีตแล้ว');
    }
  });
});

describe('buildTimeline — FLOW-02: assignment vs assigned status invariant', () => {
  it('เปลี่ยนสถานะเป็น assigned แต่ยังไม่มี assignedTo → ปฏิเสธพร้อมแจ้งเตือนภาษาไทย', () => {
    const unassignedCase = {
      ...CURRENT,
      status: 'reviewing',
      assignedTo: null,
    };
    const result = buildTimeline(
      { kind: 'status', newStatus: 'assigned', comment: null, isPublic: true },
      unassignedCase
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('ไม่สามารถเปลี่ยนเป็นสถานะ "มอบหมายแล้ว" ได้เนื่องจากยังไม่ได้ระบุเจ้าหน้าที่รับผิดชอบ');
    }
  });

  it('เปลี่ยนสถานะเป็น assigned เมื่อมี assignedTo แล้ว → ผ่าน', () => {
    const assignedCase = {
      ...CURRENT,
      status: 'reviewing',
      assignedTo: 'officer-1',
    };
    const result = buildTimeline(
      { kind: 'status', newStatus: 'assigned', comment: null, isPublic: true },
      assignedCase
    );
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.updateType).toBe('status_change');
      expect(result.entry.newValue).toBe('assigned');
    }
  });

  it('ยกเลิกผู้รับผิดชอบ (officerId: null) ขณะเรื่องอยู่ในสถานะ assigned → ปฏิเสธ', () => {
    const assignedCase = {
      ...CURRENT,
      status: 'assigned',
      assignedTo: 'officer-1',
    };
    const result = buildTimeline(
      { kind: 'assignment', officerId: null },
      assignedCase
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('ไม่สามารถยกเลิกผู้รับผิดชอบขณะเรื่องอยู่ในสถานะ "มอบหมายแล้ว" ได้');
    }
  });

  it('เปลี่ยนผู้รับผิดชอบเป็นคนอื่นขณะสถานะเป็น assigned → ผ่าน', () => {
    const assignedCase = {
      ...CURRENT,
      status: 'assigned',
      assignedTo: 'officer-1',
    };
    const result = buildTimeline(
      { kind: 'assignment', officerId: 'officer-2' },
      assignedCase
    );
    expect('entry' in result).toBe(true);
    if ('entry' in result) {
      expect(result.entry.newValue).toBe('officer-2');
    }
  });
});


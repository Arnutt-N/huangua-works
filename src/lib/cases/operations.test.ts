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

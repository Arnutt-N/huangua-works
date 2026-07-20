/**
 * State Machine — การเปลี่ยนสถานะเคส
 *
 * state machine: received → reviewing → assigned → in_progress → done → closed/rejected
 *
 * DB (pgEnum) ไม่ enforce transition — เช็คที่ app layer ที่นี่
 * ทุก admin action ที่เปลี่ยน status ต้องเรียก assertTransition() ก่อน
 *
 * เหตุผลของแต่ละ transition:
 * - received → reviewing: เจ้าหน้าที่รับเรื่องและเริ่มตรวจสอบ
 * - received/reviewing → rejected: หลังตรวจสอบแล้วไม่อยู่ในขอบเขต/ไม่ชอบด้วยกฎหมาย
 * - reviewing → assigned: ตรวจสอบผ่าน + มอบหมายให้หน่วยงาน/เจ้าหน้าที่
 * - assigned → in_progress: เจ้าหน้าที่ลงมือดำเนินการ
 * - in_progress → done: ดำเนินการเสร็จ (รอ citizen ยืนยันหรือ auto-close)
 * - done → closed: ปิดเรื่องถาวร
 * - done → in_progress: reopen (citizen แจ้งว่ายังไม่เสร็จ)
 * - สถานะปลายทาง (closed/rejected) ไม่อนุญาตให้เปลี่ยนอีก (ต้อง reopen ผ่าน superadmin เท่านั้น)
 */

export type CaseStatus =
  | 'received'
  | 'reviewing'
  | 'assigned'
  | 'in_progress'
  | 'done'
  | 'closed'
  | 'rejected';

/** terminal states — ไม่สามารถเปลี่ยนต่อได้ (ต้อง reopen) */
export const TERMINAL_STATUSES: readonly CaseStatus[] = ['closed', 'rejected'];

/**
 * allowed next statuses จากแต่ละ status
 * key = current, value = array ของที่ไปได้
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  received: ['reviewing', 'rejected'],
  reviewing: ['assigned', 'rejected', 'received'],
  assigned: ['in_progress', 'reviewing'],
  in_progress: ['done', 'assigned'],
  done: ['closed', 'in_progress'],
  closed: [],
  rejected: [],
};

export interface TransitionResult {
  ok: boolean;
  reason?: string;
}

/**
 * ตรวจสอบว่าเปลี่ยน status จาก `from` → `to` ได้หรือไม่
 *
 * คืน `{ ok: true }` ถ้าผ่าน
 * คืน `{ ok: false, reason }` ถ้าไม่ผ่าน (พร้อมข้อความอธิบายภาษาไทยสำหรับ user)
 */
export function assertTransition(from: CaseStatus, to: CaseStatus): TransitionResult {
  if (from === to) {
    return { ok: false, reason: 'สถานะใหม่ต้องไม่เหมือนสถานะปัจจุบัน' };
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    if (TERMINAL_STATUSES.includes(from)) {
      return {
        ok: false,
        reason: `เรื่องนี้อยู่ในสถานะ "${STATUS_LABELS_TH[from]}" แล้ว ไม่สามารถเปลี่ยนแปลงได้ (ต้องเปิดใหม่ผ่านผู้ดูแลระบบ)`,
      };
    }
    return {
      ok: false,
      reason: `ไม่สามารถเปลี่ยนจาก "${STATUS_LABELS_TH[from]}" เป็น "${STATUS_LABELS_TH[to]}" ได้โดยตรง`,
    };
  }

  return { ok: true };
}

/** ลำดับ status ตาม state machine (เพื่อคำนวณ progress %) */
export const STATUS_ORDER: readonly CaseStatus[] = [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
];

/** คำนวณความคืบหน้าเป็น % (0-100) */
export function statusProgress(status: CaseStatus): number {
  // rejected = terminal (ไม่อยู่ในลำดับ STATUS_ORDER) → ถือว่าจบ 100%
  if (status === 'rejected') return 100;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
}

/** label ภาษาไทย ของแต่ละ status */
export const STATUS_LABELS_TH: Record<CaseStatus, string> = {
  received: 'รับเรื่อง',
  reviewing: 'ตรวจสอบ',
  assigned: 'มอบหมาย',
  in_progress: 'กำลังดำเนินการ',
  done: 'เสร็จสิ้น',
  closed: 'ปิดเรื่อง',
  rejected: 'ไม่ดำเนินการ',
};

/** รายการ status ทั้งหมด เรียงตาม state machine (สำหรับ dropdown) */
export const ALL_STATUSES_ORDERED: readonly CaseStatus[] = [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'rejected',
];

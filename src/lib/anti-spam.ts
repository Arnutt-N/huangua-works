/**
 * สัญญาณกันสแปมแบบ honeypot + จับเวลากรอกฟอร์ม
 *
 * หลักการ: ฟอร์มจริงมี input ลวงชื่อ `website_url` ที่ซ่อนจากผู้ใช้
 * (อยู่นอกจอ + aria-hidden + ไม่อยู่ใน tab order) — ผู้ใช้จริงไม่มีทางกรอก
 * แต่บอทที่กรอกทุก field จะติดกับ นอกจากนั้นยังจับเวลาตั้งแต่ฟอร์ม mount
 * จนกดส่ง ถ้าเร็วเกินคนปกติ (ต่ำกว่าเกณฑ์) ก็น่าสงสัย
 *
 * § ทั้งสองเป็นแค่ "สัญญาณ" ไม่ใช่หลักฐาน — client ปลอม timestamp ได้
 * จึงใช้ปฏิเสธแบบ fail-closed เฉพาะกรณีชัดเจน (honeypot มีค่า) ส่วนกรณี
 * ส่งเร็วเกินใช้เกณฑ์ต่ำ ๆ (2 วินาที) เพื่อไม่ให้โดนผู้ใช้จริงที่กรอกไว
 * และ error ที่ตอบต้อง generic เหมือน validation ทั่วไป ห้ามบอกว่าโดนจับ
 * ว่าเป็นบอท (ไม่งั้นบอทเอาไปปรับตัว)
 */

/** ชื่อ field ลวงในฟอร์ม (ต้องตรงกับ name ใน intake-form.tsx) */
export const HONEYPOT_FIELD = 'website_url';

/** เวากรอกขั้นต่ำที่ยอมรับได้ (มิลลิวินาที) */
export const MIN_SUBMIT_MS = 2000;

export interface SpamSignals {
  /** ค่าในฟิลด์ลวง — ผู้ใช้จริงต้องเป็นค่าว่างเสมอ */
  websiteUrl?: string | null;
  /** เวลาที่ฟอร์ม mount (epoch ms จาก client) — optional เพราะ client เก่าไม่มี */
  formStartedAt?: number | null;
}

/**
 * ตรวจว่าเป็น submission ที่น่าสงสัยหรือไม่
 * @param now เวลาปัจจุบัน (epoch ms) — รับเป็น param เพื่อให้ test ได้
 */
export function isSpamSubmission(signals: SpamSignals, now: number): boolean {
  // § สัญญาณหลัก: ฟิลด์ลวงมีค่า — ผู้ใช้จริงกรอกไม่ได้ (ซ่อนจากจอ+AT+tab)
  if (signals.websiteUrl != null && signals.websiteUrl !== '') {
    return true;
  }

  // § สัญญาณเสริม: ส่งเร็วเกินคนกรอกจริง — timestamp ปลอมได้จึงใช้เกณฑ์ต่ำ
  // ค่าติดลบ/อนาคต (นาฬิกา client เพี้ยน) ถือว่าไม่น่าสงสัย ไม่ปฏิเสธผู้ใช้จริง
  if (
    typeof signals.formStartedAt === 'number' &&
    Number.isFinite(signals.formStartedAt) &&
    signals.formStartedAt > 0 &&
    signals.formStartedAt <= now &&
    now - signals.formStartedAt < MIN_SUBMIT_MS
  ) {
    return true;
  }

  return false;
}

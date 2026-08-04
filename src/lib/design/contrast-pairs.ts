/**
 * รายการคู่สีที่ต้องผ่านเกณฑ์ WCAG — แหล่งเดียวสำหรับทั้ง gate และหน้า /admin/design
 *
 * § ทำไมต้องแยกไฟล์นี้ออกมา
 * เดิมรายการนี้ถูกเขียนซ้ำสองที่ (PAIRS ใน scripts/check-contrast.ts กับ PAIR_CHECKS
 * ในหน้า design) แล้ว drift จริง — หน้าเว็บมี 18 คู่ สคริปต์มี 16 แปลว่าสองคู่ที่โชว์
 * บนหน้าไม่ถูก gate ตรวจเลย ไฟล์นี้ห้าม import อะไรจาก node เพื่อให้ client component
 * ใช้ได้ (สคริปต์ import ด้วย relative path เหมือนที่ scripts/seed-*.ts ทำอยู่แล้ว)
 *
 * § ชื่อ token เก็บแบบไม่มี prefix `--color-`
 * ตรงกับ key ที่ parseTokens() ใน check-contrast.ts คืนออกมา ฝั่งหน้าเว็บเป็นคนเติม
 * prefix เองตอนอ่าน CSS custom property
 */

/** เกณฑ์ตาม WCAG 2.2 */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
export const NON_TEXT = 3;

/**
 * ประเภทของคู่สี — ตัดสินว่าเกณฑ์ที่ใช้มาจาก SC ข้อไหน
 *
 * § สำคัญต่อการแสดงผล: 3:1 ของ non-text (SC 1.4.11) คือเกณฑ์เต็มของมัน ไม่ใช่
 * การผ่อนผันแบบ "ข้อความขนาดใหญ่" (SC 1.4.3) การใช้ป้ายเดียวกันทำให้เข้าใจผิดว่า
 * ขอบปุ่มที่ได้ 3.26:1 นั้น "ผ่านแบบมีเงื่อนไข" ทั้งที่ผ่านเต็มตามเกณฑ์ของมัน
 */
export type PairKind =
  /** ข้อความปกติ — ต้อง 4.5:1 (SC 1.4.3) */
  | 'text'
  /** ขอบ/ไอคอนที่สื่อความหมาย — ต้อง 3:1 (SC 1.4.11) */
  | 'non-text'
  /** ไม่มีข้อกำหนด contrast — เช่นพื้นของไอคอน แสดงไว้เพื่อดูค่าเฉย ๆ */
  | 'reference';

export interface ContrastPair {
  fg: string;
  bg: string;
  min: number;
  kind: PairKind;
  /** อธิบายว่าคู่นี้ปรากฏที่ไหนจริง — ให้คนอ่านผลรู้ว่าพังตรงไหน */
  where: string;
}

/** ชื่อคู่สำหรับแสดงผล — derive จาก fg/bg ไม่เก็บซ้ำเพื่อกันไม่ให้ label หลุดจากค่าจริง */
export function pairLabel(p: ContrastPair): string {
  return `${p.fg} / ${p.bg}`;
}

/**
 * คู่ที่ต้องผ่าน — ครอบเฉพาะคู่ที่ "ใช้จริงในโค้ด" ไม่ใช่ทุก permutation
 * เพิ่มคู่ใหม่ทุกครั้งที่สร้าง combination ใหม่ใน component
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: 'ink', bg: 'surface', min: AA_TEXT, kind: 'text', where: 'ข้อความทั่วไปทั้งระบบ' },
  { fg: 'ink', bg: 'surface-raised', min: AA_TEXT, kind: 'text', where: 'ข้อความในการ์ด' },
  { fg: 'muted', bg: 'surface', min: AA_TEXT, kind: 'text', where: 'subtitle, label รอง' },
  { fg: 'muted', bg: 'surface-raised', min: AA_TEXT, kind: 'text', where: 'ข้อความรองในการ์ด' },
  { fg: 'muted', bg: 'surface-sunken', min: AA_TEXT, kind: 'text', where: 'หัวตาราง' },

  { fg: 'accent-strong', bg: 'surface-raised', min: AA_TEXT, kind: 'text', where: 'ลิงก์, ไอคอนเน้น' },
  { fg: 'accent-strong', bg: 'accent-sunken', min: AA_TEXT, kind: 'text', where: 'badge "รับเรื่อง", RoleBadge ผู้ดูแล/หัวหน้ากอง, แท็บ hover' },
  { fg: 'on-accent', bg: 'accent-strong', min: AA_TEXT, kind: 'text', where: 'ปุ่ม primary, แท็บที่เลือก, ตัวเลขแจ้งเตือน' },

  // § คู่ที่เคยพังจริง — text-* (สีเต็ม) บนพื้น *-soft ให้ ~1.5:1 ปัจจุบันบังคับใช้ *-ink เท่านั้น
  { fg: 'warning-ink', bg: 'warning-soft', min: AA_TEXT, kind: 'text', where: 'badge ตรวจสอบ/มอบหมาย/กำลังดำเนินการ, RoleBadge หัวหน้างาน/เจ้าหน้าที่' },
  { fg: 'success-ink', bg: 'success-soft', min: AA_TEXT, kind: 'text', where: 'badge เสร็จสิ้น/ปิดเรื่อง, toast สำเร็จ' },
  { fg: 'danger-ink', bg: 'danger-soft', min: AA_TEXT, kind: 'text', where: 'badge ฉุกเฉิน/ไม่ดำเนินการ, ข้อความ error, tag ในหน้าแชท' },
  { fg: 'warning-ink', bg: 'surface-raised', min: NON_TEXT, kind: 'non-text', where: 'ไอคอน KpiCard variant gold' },
  { fg: 'danger-ink', bg: 'surface-raised', min: AA_TEXT, kind: 'text', where: 'ตัวเลข KpiCard variant danger, "เลย SLA"' },

  // ขอบ UI component ที่สื่อความหมาย (SC 1.4.11)
  { fg: 'border-strong', bg: 'surface', min: NON_TEXT, kind: 'non-text', where: 'ขอบปุ่ม secondary/outline' },

  // แถบกราฟ/ตัวบ่งชี้ที่ไม่ใช่ข้อความ
  { fg: 'accent-strong', bg: 'surface-sunken', min: NON_TEXT, kind: 'non-text', where: 'แถบกราฟในรายงาน' },
  { fg: 'accent', bg: 'surface-raised', min: AA_LARGE, kind: 'non-text', where: 'ไอคอน accent ขนาดใหญ่' },

  // คู่ที่เกิดจาก token ชุด accent-* ที่เพิ่มภายหลัง
  { fg: 'accent-strong', bg: 'accent-100', min: AA_TEXT, kind: 'text', where: 'ไอคอนบนพื้น accent-100 (intake, track, Hero)' },
  { fg: 'accent', bg: 'accent-100', min: NON_TEXT, kind: 'non-text', where: 'ไอคอนบริการบนพื้น accent-100 (Services)' },
  { fg: 'muted', bg: 'accent-sunken', min: AA_TEXT, kind: 'text', where: 'ตัวเลขขั้นที่ยังไม่เสร็จใน Hero tracking card' },
];

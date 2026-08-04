/**
 * แคตตาล็อกของ token และคู่สีที่ต้องแสดง — แยกจาก UI เพื่อให้เพิ่ม token ใหม่แล้ว
 * หน้านี้ตามทันทีโดยไม่ต้องแตะ JSX
 *
 * § รายการคู่สีตรงกับ PAIRS ใน scripts/check-contrast.ts โดยตั้งใจ เพื่อให้เทียบได้ว่า
 * ตัวเลขที่ browser render จริงต่างจากที่สคริปต์คำนวณแค่ไหน (ดู _lib/contrast.ts)
 */

export interface TokenGroup {
  title: string;
  note?: string;
  tokens: { name: string; use: string }[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    title: 'พื้นผิว',
    note: 'ไล่จากพื้นหลังหน้า → การ์ด → พื้นจม',
    tokens: [
      { name: '--color-surface', use: 'พื้นหลังทั้งหน้า' },
      { name: '--color-surface-raised', use: 'การ์ด, dialog' },
      { name: '--color-surface-sunken', use: 'หัวตาราง, พื้นจม' },
    ],
  },
  {
    title: 'ตัวอักษร',
    tokens: [
      { name: '--color-ink', use: 'ข้อความหลัก' },
      { name: '--color-muted', use: 'ข้อความรอง, คำอธิบาย' },
      { name: '--color-on-accent', use: 'ข้อความบนพื้น accent' },
    ],
  },
  {
    title: 'เส้นขอบ',
    note: 'border-strong ต้องผ่าน 3:1 เพราะเป็นขอบ UI ที่สื่อความหมาย (WCAG 1.4.11)',
    tokens: [
      { name: '--color-border', use: 'เส้นคั่นบาง (ตกแต่ง)' },
      { name: '--color-border-strong', use: 'ขอบปุ่ม secondary' },
    ],
  },
  {
    title: 'สีหลัก — น้ำเงิน 255°',
    note: 'chroma ถูกจำกัดด้วยเพดาน sRGB ตาม lightness ดู DESIGN.md §2',
    tokens: [
      { name: '--color-accent-sunken', use: 'พื้น badge, hover' },
      { name: '--color-accent-100', use: 'พื้นไอคอน' },
      { name: '--color-accent-200', use: 'ขอบ badge' },
      { name: '--color-accent', use: 'ไอคอน, ตัวคั่น, mesh' },
      { name: '--color-accent-700', use: 'hover ของปุ่ม' },
      { name: '--color-accent-strong', use: 'ปุ่ม primary, ลิงก์' },
    ],
  },
  {
    title: 'ทอง — amber 80°',
    tokens: [
      { name: '--color-accent-gold', use: 'ไฮไลต์, badge รอง' },
      { name: '--color-accent-gold-soft', use: 'พื้นของทอง' },
    ],
  },
  {
    title: 'สถานะ — สีเต็ม',
    note: 'ใช้เป็นพื้น/ไอคอนบนพื้นเข้ม ห้ามใช้เป็นสีข้อความบนพื้น *-soft',
    tokens: [
      { name: '--color-success', use: 'สำเร็จ' },
      { name: '--color-warning', use: 'รอดำเนินการ' },
      { name: '--color-danger', use: 'ผิดพลาด, ฉุกเฉิน' },
    ],
  },
  {
    title: 'สถานะ — พื้นอ่อน',
    tokens: [
      { name: '--color-success-soft', use: 'พื้น badge สำเร็จ' },
      { name: '--color-warning-soft', use: 'พื้น badge รอ' },
      { name: '--color-danger-soft', use: 'พื้น badge ผิดพลาด' },
    ],
  },
  {
    title: 'สถานะ — สีข้อความ',
    note: 'ใช้บนพื้น *-soft เท่านั้น — นี่คือ token ที่แก้บั๊ก 1.52:1 ที่เกิดซ้ำมา 3 รอบ',
    tokens: [
      { name: '--color-success-ink', use: 'ข้อความบน success-soft' },
      { name: '--color-warning-ink', use: 'ข้อความบน warning-soft' },
      { name: '--color-danger-ink', use: 'ข้อความบน danger-soft' },
    ],
  },
];

export interface PairCheck {
  label: string;
  fg: string;
  bg: string;
  min: number;
  where: string;
}

/** คู่สีที่ใช้จริงในโค้ด — ตรงกับ PAIRS ใน scripts/check-contrast.ts */
export const PAIR_CHECKS: PairCheck[] = [
  { label: 'ink / surface', fg: '--color-ink', bg: '--color-surface', min: 4.5, where: 'ข้อความทั่วไป' },
  { label: 'ink / surface-raised', fg: '--color-ink', bg: '--color-surface-raised', min: 4.5, where: 'ข้อความในการ์ด' },
  { label: 'muted / surface', fg: '--color-muted', bg: '--color-surface', min: 4.5, where: 'คำอธิบาย' },
  { label: 'muted / surface-raised', fg: '--color-muted', bg: '--color-surface-raised', min: 4.5, where: 'ข้อความรองในการ์ด' },
  { label: 'muted / surface-sunken', fg: '--color-muted', bg: '--color-surface-sunken', min: 4.5, where: 'หัวตาราง' },
  { label: 'accent-strong / surface-raised', fg: '--color-accent-strong', bg: '--color-surface-raised', min: 4.5, where: 'ลิงก์, ไอคอนเน้น' },
  { label: 'accent-strong / accent-sunken', fg: '--color-accent-strong', bg: '--color-accent-sunken', min: 4.5, where: 'badge รับเรื่อง, RoleBadge' },
  { label: 'on-accent / accent-strong', fg: '--color-on-accent', bg: '--color-accent-strong', min: 4.5, where: 'ปุ่ม primary' },
  { label: 'warning-ink / warning-soft', fg: '--color-warning-ink', bg: '--color-warning-soft', min: 4.5, where: 'badge กำลังดำเนินการ' },
  { label: 'success-ink / success-soft', fg: '--color-success-ink', bg: '--color-success-soft', min: 4.5, where: 'badge เสร็จสิ้น' },
  { label: 'danger-ink / danger-soft', fg: '--color-danger-ink', bg: '--color-danger-soft', min: 4.5, where: 'badge ฉุกเฉิน' },
  { label: 'warning-ink / surface-raised', fg: '--color-warning-ink', bg: '--color-surface-raised', min: 3, where: 'ไอคอน KpiCard gold' },
  { label: 'danger-ink / surface-raised', fg: '--color-danger-ink', bg: '--color-surface-raised', min: 4.5, where: 'ตัวเลข KpiCard danger' },
  { label: 'border-strong / surface', fg: '--color-border-strong', bg: '--color-surface', min: 3, where: 'ขอบปุ่ม secondary' },
  { label: 'accent-strong / surface-sunken', fg: '--color-accent-strong', bg: '--color-surface-sunken', min: 3, where: 'แถบกราฟ' },
  { label: 'accent / surface-raised', fg: '--color-accent', bg: '--color-surface-raised', min: 3, where: 'ไอคอน accent ขนาดใหญ่' },
  { label: 'accent-100 / surface-raised', fg: '--color-accent-100', bg: '--color-surface-raised', min: 1, where: 'พื้นไอคอน (ไม่ใช่ข้อความ)' },
  { label: 'accent-strong / accent-100', fg: '--color-accent-strong', bg: '--color-accent-100', min: 4.5, where: 'ไอคอนบนพื้น accent-100' },
];

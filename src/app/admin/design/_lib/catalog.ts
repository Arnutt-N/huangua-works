/**
 * แคตตาล็อกของ token ที่ต้องแสดง — แยกจาก UI เพื่อให้เพิ่ม token ใหม่แล้ว
 * หน้านี้ตามทันทีโดยไม่ต้องแตะ JSX
 *
 * § รายการ "คู่สี" ไม่ได้อยู่ในไฟล์นี้ — อยู่ที่ src/lib/design/contrast-pairs.ts
 * ซึ่ง scripts/check-contrast.ts ใช้ร่วมกัน เดิมเคยเขียนซ้ำสองที่แล้ว drift จริง
 * (สคริปต์ 16 คู่ หน้าเว็บ 18) ทำให้สองคู่ที่โชว์บนหน้าไม่ถูก gate ตรวจ
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


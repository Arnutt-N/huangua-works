import {
  LayoutDashboard,
  BarChart3,
  Users,
  ScrollText,
  MessageSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { userRoleEnum } from '@/lib/db/schema';

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type AdminTab =
  | 'dashboard'
  | 'reports'
  | 'chat'
  | 'users'
  | 'audit'
  | 'settings';

export interface AdminNavItem {
  key: AdminTab;
  label: string;
  href: string;
  icon: LucideIcon;
  supervisorOnly?: boolean;
}

/**
 * นิยาม nav ของแอดมินไว้ที่เดียว — sidebar (desktop + mobile drawer) อ่านจากตัวนี้ทั้งคู่
 * ไม่ให้เมนูสองที่หลุดกันเหมือนตอนที่ nav ฝังอยู่ใน header component เดียว
 */
export const ADMIN_NAV_MAIN: AdminNavItem[] = [
  { key: 'dashboard', label: 'แดชบอร์ด', href: '/admin', icon: LayoutDashboard },
  { key: 'reports', label: 'รายงานสรุป', href: '/admin/reports', icon: BarChart3 },
  { key: 'chat', label: 'แชท LINE', href: '/admin/chat', icon: MessageSquare },
  {
    key: 'users',
    label: 'จัดการผู้ใช้',
    href: '/admin/users',
    icon: Users,
    supervisorOnly: true,
  },
  { key: 'audit', label: 'ประวัติการกระทำ', href: '/admin/audit', icon: ScrollText },
];

/** เมนูส่วนล่าง — แยกกลุ่มเพราะเป็นเรื่องของ "บัญชีฉัน" ไม่ใช่ข้อมูลงาน */
export const ADMIN_NAV_ACCOUNT: AdminNavItem[] = [
  { key: 'settings', label: 'ตั้งค่าบัญชี', href: '/admin/settings', icon: Settings },
];

const SUPERVISOR_ROLES: UserRole[] = ['head', 'superadmin'];

export function visibleNavItems(role: UserRole, items: AdminNavItem[]): AdminNavItem[] {
  const isSupervisor = SUPERVISOR_ROLES.includes(role);
  return items.filter((item) => !item.supervisorOnly || isSupervisor);
}

/** คำนำหน้าชื่อไทยที่ไม่ควรกลายเป็นอักษรย่อบน avatar */
const NAME_PREFIXES = ['นางสาว', 'น.ส.', 'นาย', 'นาง', 'ดร.', 'ว่าที่'];

/**
 * ตัดอักษรตัวแรกแบบ grapheme cluster
 *
 * § ภาษาไทยตัดด้วย code point ไม่ได้ — สระบน/ล่างและวรรณยุกต์เป็นคนละ code point
 * กับพยัญชนะ เช่น "ผู้" = ผ + ู + ้ (3 code points) การใช้ [...str][0] จะได้ "ผ"
 * เปล่า ๆ และ .slice(0,2) จะได้ "ผู" ที่วรรณยุกต์หายไป ตัวอักษรบน avatar จึงดูพิการ
 * Intl.Segmenter granularity 'grapheme' รวมให้เป็นตัวอักษรที่คนอ่านเห็นจริง
 */
function graphemes(s: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
    return [...seg.segment(s)].map((g) => g.segment);
  }
  return [...s];
}

/**
 * อักษรย่อสำหรับ avatar — ตัดคำนำหน้าออกก่อน แล้วเอาอักษรแรกของสองคำแรก
 * (นายสมชาย ใจดี → "สใ") ถ้ามีคำเดียวก็ใช้สองอักษรแรกของคำนั้น
 */
export function initialsOf(fullName: string): string {
  let name = fullName.trim();
  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length).trim();
      break;
    }
  }
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return graphemes(words[0]!).slice(0, 2).join('');
  return (graphemes(words[0]!)[0] ?? '') + (graphemes(words[1]!)[0] ?? '');
}

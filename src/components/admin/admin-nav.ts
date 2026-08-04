import {
  ClipboardList,
  BarChart3,
  Users,
  ScrollText,
  MessageSquare,
  FolderCog,
  Bot,
  Send,
  Image,
  LayoutGrid,
  HeartPulse,
  Settings,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_ROLES, type UserRole } from '@/lib/auth/roles';

export type { UserRole } from '@/lib/auth/roles';

export type AdminTab =
  | 'dashboard'
  | 'reports'
  | 'chat'
  | 'users'
  | 'audit'
  | 'master-data'
  | 'profile'
  | 'chatbot'
  | 'auto-replies'
  | 'reply-objects'
  | 'broadcast'
  | 'rich-menus'
  | 'files'
  | 'image-resize'
  | 'health'
  | 'design'
  | 'settings';

export interface AdminNavItem {
  key: AdminTab;
  label: string;
  href: string;
  icon: LucideIcon;
  supervisorOnly?: boolean;
}

export interface AdminNavGroup {
  /** หัวข้อกลุ่ม — ซ่อนตอน sidebar ย่อ */
  label: string;
  items: AdminNavItem[];
}

/**
 * นิยาม nav ของแอดมินไว้ที่เดียว — sidebar (desktop + mobile drawer) อ่านจากตัวนี้ทั้งคู่
 *
 * § หลักการตั้งชื่อกลุ่ม: ตั้งตาม "หน้าที่ของงาน" ไม่ใช่ "ใครเข้าได้"
 * เดิมเคยคิดจะใช้ชื่อกลุ่มว่า "Admin" แต่ในระบบนี้มีแค่ /admin/users กับ
 * /admin/master-data ที่จำกัด head/superadmin ส่วน /admin/audit เจ้าหน้าที่ทุกคน
 * เข้าได้ — ถ้าใช้ชื่อ "Admin" เจ้าหน้าที่ทั่วไปจะเห็นกลุ่มที่สื่อว่าตัวเองไม่มีสิทธิ์
 * ทั้งที่กดเข้าได้ จึงใช้ "ระบบและเครื่องมือ" ซึ่งบอกว่าเป็นเรื่องของระบบ
 * ไม่ได้บอกระดับสิทธิ์
 *
 * § ทำไม ไฟล์สื่อ/ย่อรูป/สุขภาพระบบ/ตั้งค่า ไม่อยู่ในกลุ่ม "แชทบอท"
 * ทั้งสี่ตัวไม่ได้ผูกกับบอทโดยเฉพาะ — ไฟล์สื่อใช้กับ Rich Menu ก็จริงแต่ใช้กับ
 * งานอื่นได้ด้วย, ย่อรูปเป็นเครื่องมือทั่วไป, สุขภาพระบบตรวจ DB/Redis/LINE ทั้งระบบ
 * และ /admin/settings จะมีการตั้งค่าอื่นนอกจากบอทตามมา จึงเลี่ยงชื่อ "ตั้งค่าบอท"
 * ที่ผูกกับบอทเกินจริง
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'งานหลัก',
    items: [
      { key: 'dashboard', label: 'แดชบอร์ด', href: '/admin', icon: BarChart3 },
      { key: 'reports', label: 'จัดการคำร้อง / แจ้งเหตุ', href: '/admin/reports', icon: ClipboardList },
    ],
  },
  {
    /**
     * § กลุ่มนี้มีเมนูเดียวโดยตั้งใจ — อย่ายุบรวมเข้า "แชทบอท"
     * การสนทนาคือเจ้าหน้าที่คุยกับประชาชนเอง (งานประจำวัน ทุก staff เข้าได้)
     * ส่วนกลุ่มแชทบอทคืองานตั้งค่าให้บอทตอบแทน (supervisorOnly ทั้งกลุ่ม)
     * ถ้ายุบรวมกัน เวลา officer ล็อกอิน visibleNavGroups() จะกรองจนเหลือหัวข้อ
     * "แชทบอท" ที่มีลูกเดียวคือ "การสนทนา" — หัวข้อขัดกับเนื้อหาที่อยู่ข้างใน
     */
    label: 'แชท LINE',
    items: [
      { key: 'chat', label: 'การสนทนา', href: '/admin/chat', icon: MessageSquare },
    ],
  },
  {
    label: 'แชทบอท',
    items: [
      { key: 'chatbot', label: 'ภาพรวมบอท', href: '/admin/chatbot', icon: Bot, supervisorOnly: true },
      { key: 'auto-replies', label: 'ตอบอัตโนมัติ', href: '/admin/chatbot/auto-replies', icon: MessageSquare, supervisorOnly: true },
      { key: 'reply-objects', label: 'ข้อความสำเร็จรูป', href: '/admin/chatbot/reply-objects', icon: LayoutGrid, supervisorOnly: true },
      { key: 'broadcast', label: 'ส่งประกาศ', href: '/admin/chatbot/broadcast', icon: Send, supervisorOnly: true },
      { key: 'rich-menus', label: 'Rich Menu', href: '/admin/chatbot/rich-menus', icon: LayoutGrid, supervisorOnly: true },
    ],
  },
  {
    label: 'ระบบและเครื่องมือ',
    items: [
      {
        key: 'users',
        label: 'จัดการผู้ใช้',
        href: '/admin/users',
        icon: Users,
        supervisorOnly: true,
      },
      {
        key: 'master-data',
        label: 'หน่วยงาน / หมวดหมู่',
        href: '/admin/master-data',
        icon: FolderCog,
        supervisorOnly: true,
      },
      { key: 'files', label: 'ไฟล์สื่อ', href: '/admin/files', icon: Image, supervisorOnly: true },
      { key: 'image-resize', label: 'ย่อรูป', href: '/admin/image-resize', icon: Image, supervisorOnly: true },
      { key: 'settings', label: 'ตั้งค่า', href: '/admin/settings', icon: Settings, supervisorOnly: true },
      { key: 'design', label: 'ระบบดีไซน์', href: '/admin/design', icon: Palette, supervisorOnly: true },
      { key: 'health', label: 'สุขภาพระบบ', href: '/admin/health', icon: HeartPulse, supervisorOnly: true },
      { key: 'audit', label: 'ประวัติการกระทำ', href: '/admin/audit', icon: ScrollText },
    ],
  },
];

export function isSupervisor(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function visibleNavItems(role: UserRole, items: AdminNavItem[]): AdminNavItem[] {
  return items.filter((item) => !item.supervisorOnly || isSupervisor(role));
}

/**
 * กรองทั้งกลุ่มตามสิทธิ์ แล้วตัดกลุ่มที่ไม่เหลือรายการทิ้ง
 * (ไม่งั้น officer จะเห็นหัวข้อ "ระบบ" ลอยอยู่โดยไม่มีเมนูข้างใต้)
 */
export function visibleNavGroups(role: UserRole): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleNavItems(role, group.items),
  })).filter((group) => group.items.length > 0);
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

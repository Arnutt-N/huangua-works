import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN_NAV_GROUPS, visibleNavGroups, visibleNavItems, initialsOf } from './admin-nav';

/**
 * § เทสต์นี้ปักหมุดกฎเรื่องสิทธิ์ที่ comment ในโค้ดเขียนเตือนไว้แต่ไม่มีอะไรบังคับ
 * โดยเฉพาะข้อที่ว่า supervisorOnly ของเมนูต้องตรงกับ guard ในหน้า page.tsx —
 * ถ้าไม่ตรง จะได้เมนูที่กดแล้วเด้งกลับโดยไม่มีคำอธิบาย (ทางตันเงียบ)
 */
describe('visibleNavGroups', () => {
  it('officer ไม่เห็นกลุ่ม "ระบบและเครื่องมือ" เลย เพราะทุกเมนูในกลุ่มเป็น supervisorOnly แล้ว', () => {
    const labels = visibleNavGroups('officer').map((g) => g.label);
    expect(labels).not.toContain('ระบบและเครื่องมือ');
    expect(labels).toEqual(['งานหลัก', 'แชท LINE']);
  });

  it('officer ไม่เห็นกลุ่ม "แชทบอท" (ทุกเมนูเป็น supervisorOnly)', () => {
    expect(visibleNavGroups('officer').map((g) => g.label)).not.toContain('แชทบอท');
  });

  it('chief อยู่ต่ำกว่า ADMIN_ROLES จึงไม่เห็นเมนู supervisorOnly ใด ๆ', () => {
    const items = visibleNavGroups('chief').flatMap((g) => g.items);
    expect(items.every((i) => !i.supervisorOnly)).toBe(true);
  });

  it('head และ superadmin เห็นครบทุกกลุ่ม รวมประวัติการกระทำ', () => {
    for (const role of ['head', 'superadmin'] as const) {
      const groups = visibleNavGroups(role);
      expect(groups).toHaveLength(ADMIN_NAV_GROUPS.length);
      const sys = groups.find((g) => g.label === 'ระบบและเครื่องมือ');
      expect(sys?.items.map((i) => i.key)).toContain('audit');
    }
  });

  it('กลุ่มที่ถูกกรองจนไม่เหลือเมนูต้องถูกตัดทิ้ง ไม่ใช่เหลือหัวข้อลอย', () => {
    for (const g of visibleNavGroups('officer')) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it('visibleNavItems กรองตาม supervisorOnly ถูกต้อง', () => {
    const items = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
    const forOfficer = visibleNavItems('officer', items);
    expect(forOfficer.every((i) => !i.supervisorOnly)).toBe(true);
    expect(visibleNavItems('superadmin', items)).toHaveLength(items.length);
  });
});

/**
 * § ตรวจว่า nav กับ route guard ตรงกัน — อ่าน source ของ page.tsx จริง
 *
 * ใช้ regex บน source text ได้เพราะทุกหน้าเขียน guard เป็น literal เดียวกันหมด
 * (`requireStaff(ADMIN_ROLES)` หรือ `requireStaff()`) ไม่มีที่ไหน alias ตัวแปร
 *
 * ข้อจำกัดที่ต้องรู้: เทสต์นี้จับ "nav กับ guard ไม่ตรงกัน" ได้ แต่จับ "ทั้งสองฝั่ง
 * ตั้งค่าหลวมเกินไปพร้อมกัน" ไม่ได้ — ซึ่งเป็นบั๊กที่ /admin/audit เคยเป็นอยู่จริง
 * (nav เปิด + guard เปิด = สอดคล้องกันแต่ผิดนโยบาย) เรื่องนั้นต้องใช้คนตัดสิน
 */
const PAGE_OF: Record<string, string> = {
  dashboard: 'src/app/admin/page.tsx',
  reports: 'src/app/admin/reports/page.tsx',
  chat: 'src/app/admin/chat/page.tsx',
  users: 'src/app/admin/users/page.tsx',
  'master-data': 'src/app/admin/master-data/page.tsx',
  chatbot: 'src/app/admin/chatbot/page.tsx',
  'auto-replies': 'src/app/admin/chatbot/auto-replies/page.tsx',
  'reply-objects': 'src/app/admin/chatbot/reply-objects/page.tsx',
  broadcast: 'src/app/admin/chatbot/broadcast/page.tsx',
  'rich-menus': 'src/app/admin/chatbot/rich-menus/page.tsx',
  files: 'src/app/admin/files/page.tsx',
  'image-resize': 'src/app/admin/image-resize/page.tsx',
  settings: 'src/app/admin/settings/page.tsx',
  design: 'src/app/admin/design/page.tsx',
  health: 'src/app/admin/health/page.tsx',
  audit: 'src/app/admin/audit/page.tsx',
};

describe('nav ↔ route guard', () => {
  const items = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

  it('ทุกเมนูมีไฟล์ page.tsx ที่ระบุไว้ในตาราง', () => {
    for (const item of items) {
      expect(PAGE_OF[item.key], `เพิ่ม "${item.key}" ลง PAGE_OF`).toBeDefined();
    }
  });

  it.each(items)('เมนู "$label" — supervisorOnly ตรงกับ guard ในหน้า', (item) => {
    const file = PAGE_OF[item.key];
    if (!file) return;
    const src = readFileSync(resolve(process.cwd(), file), 'utf8');
    const usesAdminGuard = /requireStaff\(\s*ADMIN_ROLES\s*\)/.test(src);
    expect(usesAdminGuard).toBe(Boolean(item.supervisorOnly));
  });
});

describe('initialsOf', () => {
  it('ตัดคำนำหน้าไทยออกก่อนแล้วเอาอักษรแรกของสองคำ', () => {
    expect(initialsOf('นายสมชาย ใจดี')).toBe('สใ');
    // "รั" เป็น grapheme cluster เดียว (ร + สระอั) จึงได้ทั้งคู่ ไม่ใช่แค่ "ร"
    // — นี่คือพฤติกรรมที่ตั้งใจ ถ้าตัดด้วย code point สระจะหายกลายเป็นตัวอักษรพิการ
    expect(initialsOf('นางสาวมาลี รักดี')).toBe('มรั');
  });

  it('ชื่อคำเดียวใช้สองอักษรแรกแบบ grapheme ไม่ตัดวรรณยุกต์ทิ้ง', () => {
    // "ผู้" = ผ + ู + ้ (3 code points) แต่เป็น 1 ตัวอักษรที่คนอ่านเห็น
    expect(initialsOf('ผู้ดูแล')).toBe('ผู้ดู');
  });

  it('ชื่อว่างคืน ? ไม่ throw', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

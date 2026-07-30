import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/auth/roles';

/**
 * RoleBadge — แสดง role ของ user ในรูปแบบ badge
 *
 * ใช้ soft bg + *-ink text (เหมือน CaseStatusBadge — unity กับ design language)
 * Palette: emerald (supervisor), amber (officer), muted (citizen)
 *
 * § chief/officer เดิมใช้ text-warning บน bg-warning-soft = 1.52:1 (อ่านไม่ออก)
 * เปลี่ยนเป็น text-warning-ink = 6.5:1
 */
/** ป้ายบทบาทภาษาไทย — export เพื่อให้หน้าอื่น (เช่น /admin/profile) ใช้ชื่อเดียวกัน */
export const ROLE_LABELS_TH: Record<UserRole, string> = {
  superadmin: 'ผู้ดูแลระบบ',
  head: 'หัวหน้ากอง',
  chief: 'หัวหน้างาน',
  officer: 'เจ้าหน้าที่',
  citizen: 'ประชาชน',
};

const roleMap: Record<UserRole, { label: string; class: string }> = {
  superadmin: {
    label: ROLE_LABELS_TH.superadmin,
    class: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  },
  head: {
    label: ROLE_LABELS_TH.head,
    class: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  },
  chief: { label: ROLE_LABELS_TH.chief, class: 'bg-warning-soft text-warning-ink ring-warning-ink/20' },
  officer: { label: ROLE_LABELS_TH.officer, class: 'bg-warning-soft text-warning-ink ring-warning-ink/20' },
  citizen: { label: ROLE_LABELS_TH.citizen, class: 'bg-surface-sunken text-muted ring-border-strong/30' },
};

export function RoleBadge({
  role,
  className,
}: {
  role: UserRole;
  className?: string;
}) {
  const { label, class: badgeClass } = roleMap[role];
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-pill px-3 py-0.5 text-xs font-semibold ring-1 ring-inset',
        badgeClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

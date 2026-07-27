import { cn } from '@/lib/cn';
import type { userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * RoleBadge — แสดง role ของ user ในรูปแบบ badge
 *
 * ใช้ soft bg + *-ink text (เหมือน CaseStatusBadge — unity กับ design language)
 * Palette: emerald (supervisor), amber (officer), muted (citizen)
 *
 * § chief/officer เดิมใช้ text-warning บน bg-warning-soft = 1.52:1 (อ่านไม่ออก)
 * เปลี่ยนเป็น text-warning-ink = 6.5:1
 */
const roleMap: Record<UserRole, { label: string; class: string }> = {
  superadmin: {
    label: 'ผู้ดูแลระบบ',
    class: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  },
  head: {
    label: 'หัวหน้ากอง',
    class: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  },
  chief: { label: 'หัวหน้างาน', class: 'bg-warning-soft text-warning-ink ring-warning-ink/20' },
  officer: { label: 'เจ้าหน้าที่', class: 'bg-warning-soft text-warning-ink ring-warning-ink/20' },
  citizen: { label: 'ประชาชน', class: 'bg-surface-sunken text-muted ring-border-strong/30' },
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

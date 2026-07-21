import { cn } from '@/lib/cn';
import type { userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * RoleBadge — แสดง role ของ user ในรูปแบบ badge
 *
 * ใช้ soft bg + strong text (เหมือน CaseStatusBadge — unity กับ design language)
 * Palette: emerald (supervisor), amber (officer), muted (citizen)
 */
const roleMap: Record<UserRole, { label: string; class: string }> = {
  superadmin: { label: 'ผู้ดูแลระบบ', class: 'bg-accent-sunken text-accent-strong' },
  head: { label: 'หัวหน้ากอง', class: 'bg-accent-sunken text-accent-strong' },
  chief: { label: 'หัวหน้างาน', class: 'bg-warning-soft text-warning' },
  officer: { label: 'เจ้าหน้าที่', class: 'bg-warning-soft text-warning' },
  citizen: { label: 'ประชาชน', class: 'bg-surface-sunken text-muted' },
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
        'inline-flex items-center rounded-pill px-3 py-0.5 text-xs font-semibold',
        badgeClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

import { cn } from '../../lib/cn';
import { STATUS_LABELS_TH, type CaseStatus } from '../../lib/cases/state-machine';

/**
 * CaseStatusBadge — signature component (DESIGN.md §5 Chips/Status Badge)
 * แมป state machine รับเรื่อง → ปิดเรื่อง ไปยังสีสถานะ
 * ใช้ soft พื้น + *-ink text (contrast ปลอดภัย ไม่ใช่ badge เต็มสี)
 * Palette: emerald (primary), amber (warning/progress), red (danger)
 *
 * § ใช้ token *-ink เท่านั้นเป็นสีข้อความ ห้ามใช้ text-warning/text-success/text-danger
 * ซึ่งเป็น "สีเต็ม" สำหรับ fill — ของเดิม text-warning บน bg-warning-soft ได้แค่ 1.52:1
 * ทำให้ 3 สถานะที่พบบ่อยที่สุด (ตรวจสอบ/มอบหมาย/กำลังดำเนินการ) อ่านแทบไม่ออก
 * ค่าใหม่ ≥6.4:1 ทุกสถานะ + เพิ่ม ring บาง ๆ ให้ chip มีขอบเขตชัดบนพื้นขาว
 */

const statusClasses: Record<CaseStatus, string> = {
  pending: 'bg-ink/5 text-ink ring-ink/15',
  received: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  reviewing: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  assigned: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  in_progress: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  done: 'bg-success-soft text-success-ink ring-success-ink/20',
  closed: 'bg-success-soft text-success-ink ring-success-ink/20',
  rejected: 'bg-danger-soft text-danger-ink ring-danger-ink/20',
};

export interface CaseStatusBadgeProps {
  status: CaseStatus;
  label?: string;
  className?: string;
}

export function CaseStatusBadge({ status, label, className }: CaseStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-pill px-3.5 py-1 text-sm font-semibold ring-1 ring-inset',
        statusClasses[status],
        className,
      )}
    >
      {label ?? STATUS_LABELS_TH[status]}
    </span>
  );
}

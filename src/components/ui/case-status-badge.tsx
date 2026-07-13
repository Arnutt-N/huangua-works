import { cn } from '../../lib/cn';

/**
 * CaseStatusBadge — signature component (DESIGN.md §5 Chips/Status Badge)
 * แมป state machine รับเรื่อง → ปิดเรื่อง ไปยังสีสถานะ
 * ใช้ soft พื้น + strong text (contrast ปลอดภัย ไม่ใช่ badge เต็มสี)
 * Palette: emerald (primary), amber (warning/progress), red (urgent/danger)
 */

export type CaseStatus =
  | 'received' // รับเรื่อง
  | 'reviewing' // ตรวจสอบ
  | 'assigned' // มอบหมาย
  | 'in_progress' // ดำเนินการ
  | 'done' // เสร็จ
  | 'closed' // ปิดเรื่อง
  | 'rejected' // ปฏิเสธ (case_status enum จริงใน DB)
  | 'urgent'; // ฉุกเฉิน (ใช้กับ priority ไม่ใช่ status)

const statusMap: Record<CaseStatus, { label: string; class: string }> = {
  received: { label: 'รับเรื่อง', class: 'bg-accent-sunken text-accent-strong' },
  reviewing: { label: 'ตรวจสอบ', class: 'bg-warning-soft text-warning' },
  assigned: { label: 'มอบหมาย', class: 'bg-warning-soft text-warning' },
  in_progress: { label: 'กำลังดำเนินการ', class: 'bg-warning-soft text-warning' },
  done: { label: 'เสร็จสิ้น', class: 'bg-success-soft text-success' },
  closed: { label: 'ปิดเรื่อง', class: 'bg-success-soft text-success' },
  rejected: { label: 'ไม่ดำเนินการ', class: 'bg-danger-soft text-danger' },
  urgent: { label: 'ฉุกเฉิน', class: 'bg-danger-soft text-danger' },
};

export interface CaseStatusBadgeProps {
  status: CaseStatus;
  label?: string;
  className?: string;
}

export function CaseStatusBadge({ status, label, className }: CaseStatusBadgeProps) {
  const { label: defaultLabel, class: statusClass } = statusMap[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-3.5 py-1 text-sm font-semibold',
        statusClass,
        className,
      )}
    >
      {label ?? defaultLabel}
    </span>
  );
}
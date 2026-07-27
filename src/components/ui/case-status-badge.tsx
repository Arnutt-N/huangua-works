import { cn } from '../../lib/cn';

/**
 * CaseStatusBadge — signature component (DESIGN.md §5 Chips/Status Badge)
 * แมป state machine รับเรื่อง → ปิดเรื่อง ไปยังสีสถานะ
 * ใช้ soft พื้น + *-ink text (contrast ปลอดภัย ไม่ใช่ badge เต็มสี)
 * Palette: emerald (primary), amber (warning/progress), red (urgent/danger)
 *
 * § ใช้ token *-ink เท่านั้นเป็นสีข้อความ ห้ามใช้ text-warning/text-success/text-danger
 * ซึ่งเป็น "สีเต็ม" สำหรับ fill — ของเดิม text-warning บน bg-warning-soft ได้แค่ 1.52:1
 * ทำให้ 3 สถานะที่พบบ่อยที่สุด (ตรวจสอบ/มอบหมาย/กำลังดำเนินการ) อ่านแทบไม่ออก
 * ค่าใหม่ ≥6.4:1 ทุกสถานะ + เพิ่ม ring บาง ๆ ให้ chip มีขอบเขตชัดบนพื้นขาว
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
  received: {
    label: 'รับเรื่อง',
    class: 'bg-accent-sunken text-accent-strong ring-accent-strong/20',
  },
  reviewing: {
    label: 'ตรวจสอบ',
    class: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  },
  assigned: {
    label: 'มอบหมาย',
    class: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    class: 'bg-warning-soft text-warning-ink ring-warning-ink/20',
  },
  done: {
    label: 'เสร็จสิ้น',
    class: 'bg-success-soft text-success-ink ring-success-ink/20',
  },
  closed: {
    label: 'ปิดเรื่อง',
    class: 'bg-success-soft text-success-ink ring-success-ink/20',
  },
  rejected: {
    label: 'ไม่ดำเนินการ',
    class: 'bg-danger-soft text-danger-ink ring-danger-ink/20',
  },
  urgent: {
    label: 'ฉุกเฉิน',
    class: 'bg-danger-soft text-danger-ink ring-danger-ink/20',
  },
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
        'inline-flex items-center whitespace-nowrap rounded-pill px-3.5 py-1 text-sm font-semibold ring-1 ring-inset',
        statusClass,
        className,
      )}
    >
      {label ?? defaultLabel}
    </span>
  );
}
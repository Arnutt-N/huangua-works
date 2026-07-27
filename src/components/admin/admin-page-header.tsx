import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * AdminPageHeader — ส่วนหัวของทุก admin page
 *
 * § เจตนา: เงียบ
 * หัวหน้าแอดมินคือ "ป้ายบอกว่าอยู่หน้าไหน" ไม่ใช่หัวข้อโปรโมต เจ้าหน้าที่เปิดหน้านี้
 * วันละหลายสิบครั้ง ของตกแต่งที่พอดีบน landing (ซึ่งผู้ใช้เห็นครั้งเดียว) จะกลายเป็น
 * noise เมื่อเจอซ้ำทุกวัน — จึงใช้หัวเรื่องสีทึบธรรมดา ไม่ใช้ .gradient-text
 * (บน landing สงวนไว้ให้ H1 hero กับหัว section เท่านั้น การเอามาใช้ทุกหน้าทำให้
 * มันไม่เหลือความหมายของการเน้น)
 *
 * ความเป็นชุดเดียวกับ landing มาจาก glass-panel + พาเลต + typography
 * ไม่ใช่จากการแปะ gradient/eyebrow/แถบสีเพิ่ม
 *
 * Layout: title + subtitle ซ้าย, optional action ขวา (เช่น ปุ่ม "เพิ่มผู้ใช้")
 */
export function AdminPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-panel rounded-xl px-5 py-5 shadow-sm sm:px-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-none items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

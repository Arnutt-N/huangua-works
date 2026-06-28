import type { ReactNode } from 'react';

/**
 * SiteFooter — ใช้ร่วมทุกหน้า (server component)
 * ที่ตั้ง + PDPA 2562, รับ children สำหรับหมายเหตุเฉพาะหน้า (เช่น seed data note)
 */
export function SiteFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-semibold text-ink">
          องค์การบริหารส่วนตำบลหัวงัว · อำเภอยางตลาด · จังหวัดกาฬสินธุ์
        </p>
        <p className="mt-1">
          ข้อมูลของท่านอยู่ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) พ.ศ. 2562
        </p>
        {children}
      </div>
    </footer>
  );
}
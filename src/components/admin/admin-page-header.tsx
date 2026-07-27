import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * AdminPageHeader — ส่วนหัวของทุก admin page
 *
 * Unity กับ landing: หัวเรื่องใช้ .gradient-text (emerald→amber) ชุดเดียวกับหัวข้อ
 * section บนหน้าแรก ("บริการของเรา") + มีแถบ accent-rule คั่นเป็นซิกเนเจอร์
 * ไม่ใช่ hero เต็มจอ — เพียงพอให้รู้สึกว่าเป็น product เดียวกัน
 *
 * Layout: title + subtitle ซ้าย, optional action ขวา (เช่น ปุ่ม "เพิ่มผู้ใช้")
 * `eyebrow` = ข้อความกำกับเล็ก ๆ เหนือหัวเรื่อง (เช่นชื่อโมดูล)
 */
export function AdminPageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-panel relative overflow-hidden rounded-xl px-5 py-5 shadow-sm sm:px-6 sm:py-6',
        className,
      )}
    >
      {/* mesh accent เข้มกว่าเดิม (.04 → .10) — เดิมจางจนแทบไม่ต่างจากพื้นขาว */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(at 8% 10%, oklch(55% 0.13 160) 0px, transparent 55%), radial-gradient(at 92% 8%, oklch(82% 0.14 80) 0px, transparent 55%)',
        }}
        aria-hidden="true"
      />
      {/* แถบ accent ซ้ายมือ — จุดยึดสายตาเดียวกันทุกหน้า */}
      <div
        className="accent-rule pointer-events-none absolute top-0 bottom-0 left-0 w-1"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold tracking-wide text-accent-strong uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="gradient-text">{title}</span>
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex flex-none items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

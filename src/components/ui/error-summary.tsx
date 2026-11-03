'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface ErrorSummaryItem {
  fieldId: string;
  message: string;
  fieldLabel?: string;
}

export interface ErrorSummaryProps {
  title?: string;
  description?: string;
  errors: ErrorSummaryItem[];
  submitCount?: number;
  className?: string;
}

/**
 * ErrorSummary (WCAG 2.2 AA SC 3.3.1, SC 3.3.3, G199)
 * - สรุปจุดที่ต้องกรอกหรือแก้ไขข้อมูลด้านบนฟอร์ม
 * - โฟกัสกล่องอัตโนมัติเมื่อกดส่งแล้วพบข้อมูลไม่ครบ เพื่อให้ screen reader ประกาศทันที
 * - ลิงก์แต่ละจุดเลื่อนหน้าจอและย้ายโฟกัสไปยังฟิลด์ที่ต้องแก้ไข
 * - ป้องกัน hash ใน URL เพื่อไม่ให้ประวัติหน้าเว็บเสียและไม่กระทบ LINE LIFF webview
 * - ปรับตาม prefers-reduced-motion เพื่อความปลอดภัยของผู้สูงอายุและผู้ใช้อ่อนไหวต่อการเคลื่อนไหว
 */
export function ErrorSummary({
  title,
  description = 'กดเลือกรายการด้านล่างเพื่อไปยังช่องที่ต้องการแก้ไขได้ทันที',
  errors,
  submitCount,
  className,
}: ErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSubmitCountRef = useRef(submitCount);

  useEffect(() => {
    if (errors.length === 0) return;

    if (submitCount !== undefined) {
      if (submitCount > 0 && submitCount !== prevSubmitCountRef.current) {
        containerRef.current?.focus({ preventScroll: true });
      }
      prevSubmitCountRef.current = submitCount;
    } else {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [errors.length, submitCount]);

  if (errors.length === 0) return null;

  const defaultTitle = `กรุณาตรวจสอบข้อมูลที่ต้องระบุเพิ่มเติม (${errors.length} จุด)`;
  const resolvedTitle = title ?? defaultTitle;

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, fieldId: string) {
    e.preventDefault();
    const target = document.getElementById(fieldId);
    if (!target) return;

    const focusable = target.matches('input, button, select, textarea, [tabindex="0"]')
      ? target
      : target.querySelector<HTMLElement>('input, button, select, textarea, [tabindex="0"]') ?? target;

    if (!focusable.hasAttribute('tabindex') && !focusable.matches('input, button, select, textarea')) {
      focusable.setAttribute('tabindex', '-1');
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    focusable.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    focusable.focus({ preventScroll: true });
  }

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-labelledby="error-summary-title"
      tabIndex={-1}
      className={cn(
        'rounded-xl border border-danger-ink/30 bg-danger-soft/40 p-4 text-ink sm:p-5',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-ink',
        'motion-reduce:transition-none',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-danger-ink">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="error-summary-title" className="text-base font-bold text-danger-ink sm:text-lg">
            {resolvedTitle}
          </h2>
          {description && <p className="mt-1 text-sm text-ink/80">{description}</p>}
          <ul className="mt-3 space-y-1" role="list">
            {errors.map((item, idx) => (
              <li key={`${item.fieldId}-${idx}`}>
                <a
                  href={`#${item.fieldId}`}
                  onClick={(e) => handleLinkClick(e, item.fieldId)}
                  className="inline-flex min-h-touch items-center py-1 text-sm font-semibold text-danger-ink underline underline-offset-4 hover:text-danger-ink/80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  {item.fieldLabel ? `${item.fieldLabel}: ${item.message}` : item.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

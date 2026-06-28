'use client';

import { Label as LabelPrimitive } from '@radix-ui/react-label';
import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Field primitives (DESIGN.md §5 Inputs/Fields)
 * - label ข้างบน field (ไม่ใช่ placeholder แทน label)
 * - 1px hairline border + 10px radius + surface-raised bg
 * - focus = border accent-strong + ring 3px indigo 35%
 * - error = border danger + danger-soft พื้น
 * - touch ≥44px บังคับ
 */

const fieldBase =
  'min-h-touch w-full rounded-md border bg-surface-raised px-4 text-ink placeholder:text-muted ' +
  'transition-colors duration-normal ease-out-expo ' +
  'focus:outline-none focus:border-accent-strong focus-visible:ring focus-visible:ring-accent-strong/35 ' +
  'disabled:opacity-50 motion-reduce:transition-none';

const fieldState = {
  ok: 'border-border',
  error: 'border-danger bg-danger-soft/40 focus:border-danger focus-visible:ring-danger/35',
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, invalid ? fieldState.error : fieldState.ok, className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, 'py-3 resize-y', invalid ? fieldState.error : fieldState.ok, className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive
      ref={ref}
      className={cn('mb-1.5 block text-sm font-semibold text-ink', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

/** FieldError — ข้อความ error ใต้ field (weight 600, danger) */
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-semibold text-danger">
      {children}
    </p>
  );
}

/** FieldHint — ข้อความช่วยเหลือ ใต้ field (muted) */
export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-muted">
      {children}
    </p>
  );
}
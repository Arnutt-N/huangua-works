'use client';

import { Label as LabelPrimitive } from '@radix-ui/react-label';
import type { LucideIcon } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import {
  fieldChrome,
  fieldIconClass,
  fieldPad,
  fieldPadEndGlyph,
  fieldPadIcon,
  fieldPadIconReveal,
} from './control-styles';

/**
 * Field primitives (DESIGN.md §5 Inputs/Fields)
 * - label ข้างบน field (ไม่ใช่ placeholder แทน label)
 * - focus = border accent-strong + ring 3px indigo 35%
 * - error = border danger + danger-soft พื้น
 * - touch ≥44px บังคับ
 */

const END_GLYPH_TYPES = new Set(['time', 'date', 'datetime-local', 'month', 'week']);

const fieldState = {
  ok: 'border-border focus:border-accent-strong',
  error: 'border-danger bg-danger-soft/40 focus:border-danger focus-visible:ring-danger/35',
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** lucide icon แสดงด้านซ้ายของ field (เพิ่ม left padding อัตโนมัติ) */
  icon?: LucideIcon;
  /** ปุ่มด้านในขอบขวา เช่น แสดงรหัสผ่าน ใช้ระยะขวาชุดเดียว ไม่ส่ง pr- ซ้ำทาง className */
  trailing?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, icon: Icon, trailing = false, type, ...props }, ref) => {
    const endGlyph = typeof type === 'string' && END_GLYPH_TYPES.has(type);
    let pad = fieldPad;
    if (Icon && trailing) pad = fieldPadIconReveal;
    else if (Icon) pad = fieldPadIcon;
    else if (endGlyph) pad = fieldPadEndGlyph;
    const input = (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(fieldChrome, pad, invalid ? fieldState.error : fieldState.ok, className)}
        {...props}
      />
    );
    if (!Icon) return input;
    return (
      <span className="relative block">
        <Icon aria-hidden="true" className={fieldIconClass} />
        {input}
      </span>
    );
  },
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
      className={cn(fieldChrome, fieldPad, 'py-3 resize-y', invalid ? fieldState.error : fieldState.ok, className)}
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
    <p id={id} role="alert" className="mt-1.5 text-sm font-semibold text-danger-ink">
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
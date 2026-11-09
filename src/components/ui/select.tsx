'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../../lib/cn';
import { controlChevronIcon, selectTriggerClass } from './control-styles';

/**
 * Select (DESIGN.md §5)
 * - trigger เป็น field style (hairline + 44px)
 * - เชฟรอน v อยู่ห่างขอบขวา pr-5 และไม่ถูกข้อความยาวทับ (truncate + shrink-0)
 * - content ลอยด้วย overlay shadow ไม่ติดขอบช่องและไม่หลุดจอ
 * - ใช้ Radix จัด focus/escape/portal
 *
 * § ห้ามใช้ <select> ดิบ — glyph ของเบราว์เซอร์ชิดขอบและจัดระยะเองไม่ได้
 * (scripts/lint_native_select.py)
 */

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

/** Radix ไม่อนุญาต value="" — แมปตัวเลือกว่างผ่าน sentinel นี้ */
const SELECT_NONE = '__none__';

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(selectTriggerClass, className)}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className={controlChevronIcon} aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'relative z-[60] max-h-72 overflow-hidden rounded-md border border-border bg-surface-raised shadow-overlay',
        'min-w-[var(--radix-select-trigger-width)] max-w-[min(24rem,calc(100vw-1.5rem))]',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-xs font-semibold text-muted', className)}
    {...props}
  />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex min-h-touch w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-4 text-left text-base leading-snug text-ink outline-none',
      'data-[highlighted]:bg-accent-sunken data-[state=checked]:font-semibold',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-accent-strong" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

/**
 * SelectField — ตัวเลือกมาตรฐานสำหรับแอดมิน
 * รับ value ว่างได้ (แมปเป็น sentinel ภายใน) และจัดกลุ่ม option ได้
 * className อยู่ที่กรอบนอก ใช้กำหนดความกว้าง ไม่ทับ padding ของเชฟรอน
 */
export function SelectField({
  id,
  ariaLabel,
  value,
  onValueChange,
  options,
  groups,
  placeholder,
  className,
  disabled,
}: {
  id?: string;
  ariaLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectOptionGroup[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const flat = [...(options ?? []), ...(groups?.flatMap((group) => group.options) ?? [])];
  const hasEmpty = flat.some((option) => option.value === '');
  const radixValue = value === '' ? (hasEmpty ? SELECT_NONE : undefined) : value;

  const renderOption = (option: SelectOption) => (
    <SelectItem
      key={`${option.value}:${option.label}`}
      value={option.value === '' ? SELECT_NONE : option.value}
      disabled={option.disabled}
    >
      {option.label}
    </SelectItem>
  );

  return (
    <div className={cn('min-w-0 max-w-full', className ?? 'w-full')}>
      <Select
        value={radixValue}
        onValueChange={(next) => onValueChange(next === SELECT_NONE ? '' : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options?.map(renderOption)}
          {groups?.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map(renderOption)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

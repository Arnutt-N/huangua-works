'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {
  forwardRef,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[80] max-w-xs overflow-hidden rounded-md border border-border bg-surface-raised px-2.5 py-1.5',
        'text-left font-sans text-xs font-medium leading-snug text-ink shadow-overlay',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export function isTextClipped(el: HTMLElement): boolean {
  return el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1;
}

/**
 * ข้อความบนการ์ด ปุ่ม และตัวควบคุมที่ถูกตัดด้วย …
 * ทูลทิปโผล่เฉพาะตอนเนื้อหาล้นกรอบ จึงไม่ซ้ำกับป้ายที่อ่านได้อยู่แล้ว
 */
export function ClipText({
  children,
  className,
  side = 'top',
  delayMs = 300,
}: {
  children: ReactNode;
  className?: string;
  side?: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
  delayMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');

  return (
    <TooltipProvider delayDuration={delayMs} skipDelayDuration={120}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            return;
          }
          const el = ref.current;
          const text = el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          if (!el || !text || !isTextClipped(el)) return;
          setLabel(text);
          setOpen(true);
        }}
      >
        <TooltipTrigger asChild>
          <span ref={ref} data-ds-allow-clip="" className={cn('min-w-0 max-w-full truncate', className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

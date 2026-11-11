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
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'group z-[80] max-w-56 rounded-[6px] border border-border bg-surface-raised px-2 py-1',
        'text-left font-sans text-xs font-medium leading-snug text-ink shadow-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'absolute h-2 w-2 rotate-45 bg-surface-raised',
          'group-data-[side=top]:bottom-0 group-data-[side=top]:left-1/2 group-data-[side=top]:-translate-x-1/2 group-data-[side=top]:translate-y-1/2',
          'group-data-[side=bottom]:top-0 group-data-[side=bottom]:left-1/2 group-data-[side=bottom]:-translate-x-1/2 group-data-[side=bottom]:-translate-y-1/2',
          'group-data-[side=left]:right-0 group-data-[side=left]:top-1/2 group-data-[side=left]:translate-x-1/2 group-data-[side=left]:-translate-y-1/2',
          'group-data-[side=right]:left-0 group-data-[side=right]:top-1/2 group-data-[side=right]:-translate-x-1/2 group-data-[side=right]:-translate-y-1/2',
        )}
      />
    </TooltipPrimitive.Content>
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

'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../../lib/cn';

/**
 * Toast (DESIGN.md §5)
 * - viewport ล่างขวา ห่างจากขอบ
 * - surface-raised + overlay shadow (overlay เท่านั้น ตาม Elevation rule)
 * - Radix จัด swipe/escape/stack
 */

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

const toastVariant: Record<ToastVariant, string> = {
  info: 'bg-surface-raised text-ink border-border',
  success: 'bg-success-soft text-ink border-success/30',
  warning: 'bg-warning-soft text-ink border-warning/30',
  danger: 'bg-danger-soft text-ink border-danger/30',
};

export interface ToastProps extends ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant;
}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = 'info', ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'rounded-md border p-4 shadow-overlay',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        toastVariant[variant],
        className,
      )}
      {...props}
    />
  ),
);
Toast.displayName = 'Toast';

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-base font-semibold', className)} {...props} />
));
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-sm text-muted', className)}
    {...props}
  />
));
ToastDescription.displayName = 'ToastDescription';

export const ToastClose = ToastPrimitive.Close;
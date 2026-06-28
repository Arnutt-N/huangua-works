import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * Button — primitive หลัก (DESIGN.md §5 Buttons)
 * - ปุ่ม primary = Civic Indigo Strong + white text (≥7:1 AAA)
 * - touch target ≥44px (C6) ทุก variant
 * - focus-visible ring 3px indigo (ไม่ใช่ outline กรอบเดี่ยว)
 * - ใช้ Radix Slot สำหรับ asChild (render เป็น <a>/<Link> ได้)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ' +
  'transition-colors duration-normal ease-out-expo ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ' +
  'disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'min-h-touch bg-accent-strong px-7 text-on-accent hover:bg-accent-strong/90',
  secondary:
    'min-h-touch border border-border-strong bg-transparent px-7 text-accent-strong hover:bg-accent-sunken',
  destructive: 'min-h-touch bg-danger px-7 text-on-accent hover:bg-danger/90',
  ghost: 'min-h-touch px-3 text-ink/80 hover:bg-accent-sunken hover:text-ink',
};

const sizeClass: Record<ButtonSize, string> = {
  md: 'text-base',
  lg: 'min-h-touch px-8 text-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(base, variantClass[variant], sizeClass[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
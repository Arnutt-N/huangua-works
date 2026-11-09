import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * Button — primitive หลัก (DESIGN.md §5 Buttons)
 * - ปุ่ม primary = Emerald gradient + white text
 * - touch target ≥44px (C6) ทุก variant
 * - focus-visible ring น้ำเงิน (ไม่ใช่ outline กรอบเดี่ยว)
 * - ใช้ Radix Slot สำหรับ asChild (render เป็น <a>/<Link> ได้)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex min-h-touch cursor-pointer items-center justify-center gap-2 rounded-md font-semibold leading-snug whitespace-nowrap ' +
  // transition-[color,background-color,border-color,opacity] แทน transition-colors
  // เพราะ primary hover เปลี่ยนที่ opacity (gradient ทำ transition สีตรง ๆ ไม่ได้)
  'transition-[color,background-color,border-color,opacity] duration-normal ease-out-expo ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ' +
  'disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none';

const variantClass: Record<ButtonVariant, string> = {
  // § primary = gradient น้ำเงิน ตาม DESIGN.md §5 / §2 "The One Blue Rule"
  // ก่อนหน้านี้ variant นี้ถูก implement เป็นสีทึบ bg-accent-strong ซึ่งไม่ตรง spec
  // ผลคือทุกหน้าที่อยากได้ปุ่มจริงตาม design (Hero, CTA, Navbar, login, track,
  // intake) ต้องเขียน style={{ background: 'linear-gradient(...)' }} ทับเอง
  // รวม 6 จุด — ปุ่ม "primary จริง" จึงไม่เคยมาจาก component นี้เลย และฝั่งแอดมิน
  // ที่เรียกใช้ตรง ๆ ก็ได้ปุ่มคนละหน้าตากับหน้าสาธารณะ
  // § padding lives on sizeClass only. cn() does not drop a conflicting px.
  primary: 'bg-accent-gradient text-on-accent shadow-md hover:opacity-90',
  secondary: 'border border-border-strong bg-transparent text-accent-strong hover:bg-accent-sunken',
  outline: 'border border-border-strong bg-transparent text-ink hover:bg-accent-sunken',
  destructive: 'bg-danger text-on-accent hover:bg-danger/90',
  ghost: 'text-ink/80 hover:bg-accent-sunken hover:text-ink',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-4 text-sm',
  md: 'px-7 text-base',
  lg: 'px-8 text-lg',
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
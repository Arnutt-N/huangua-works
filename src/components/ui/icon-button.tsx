import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const intentClass = {
  neutral:
    'text-muted hover:bg-accent-sunken hover:text-accent-strong focus-visible:outline-accent-strong',
  danger: 'text-danger hover:bg-danger/10 focus-visible:outline-danger',
} as const;

export type IconButtonIntent = keyof typeof intentClass;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: IconButtonIntent;
  asChild?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, intent = 'neutral', asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(
          'inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-md',
          'transition-colors duration-normal ease-out-expo',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          intentClass[intent],
          className,
        )}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-950 dark:bg-white text-white dark:text-black shadow-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 focus-visible:ring-neutral-950/30 dark:focus-visible:ring-white/30 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900',
        secondary:
          'bg-black/5 dark:bg-white/5 text-neutral-900 dark:text-neutral-200 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900',
        ghost:
          'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-200 focus-visible:ring-black/10 dark:focus-visible:ring-white/10',
        destructive:
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300 focus-visible:ring-red-500/30',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
        md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
        lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
        icon: 'p-2.5 text-sm rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

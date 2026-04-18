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
          'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-primary/40 focus-visible:ring-offset-background',
        secondary:
          'bg-accent text-accent-foreground border border-accent/20 hover:bg-accent/90 focus-visible:ring-accent/30 focus-visible:ring-offset-background',
        ghost:
          'text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-border/30',
        destructive:
          'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 focus-visible:ring-destructive/30',
        outline:
          'border border-border text-foreground bg-background hover:bg-muted focus-visible:ring-border/30',
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

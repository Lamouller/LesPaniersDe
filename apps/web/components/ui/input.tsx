import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

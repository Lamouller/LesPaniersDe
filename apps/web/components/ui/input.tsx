import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed',
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

import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: React.ReactNode;
  accent?: 'default' | 'green' | 'amber' | 'blue';
  className?: string;
}

export function StatCard({ label, value, sublabel, icon, accent = 'default', className }: StatCardProps) {
  const accentMap = {
    default: 'text-foreground',
    green: 'text-green-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div
      className={cn(
        'bg-white/[0.03] backdrop-blur-lg border border-white/[0.07] rounded-xl shadow-lg p-5 flex flex-col gap-2',
        className
      )}
    >
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-border flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-3xl font-bold tracking-tight leading-tight', accentMap[accent])}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-muted-foreground leading-normal">{sublabel}</p>
      )}
    </div>
  );
}

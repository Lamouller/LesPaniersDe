import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ForecastKPIProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: 'default' | 'green' | 'amber' | 'blue';
}

export function ForecastKPI({ label, value, sub, icon: Icon, accent = 'default' }: ForecastKPIProps) {
  const colorMap = {
    default: {
      wrap: 'bg-white/5 border-white/10',
      icon: 'bg-white/5 border border-white/10',
      iconText: 'text-neutral-400',
      value: 'text-neutral-50',
      sub: 'text-neutral-600',
    },
    green: {
      wrap: 'bg-green-500/5 border-green-500/20',
      icon: 'bg-green-500/10',
      iconText: 'text-green-400',
      value: 'text-green-300',
      sub: 'text-green-700',
    },
    amber: {
      wrap: 'bg-amber-500/5 border-amber-500/20',
      icon: 'bg-amber-500/10',
      iconText: 'text-amber-400',
      value: 'text-amber-300',
      sub: 'text-amber-700',
    },
    blue: {
      wrap: 'bg-blue-500/5 border-blue-500/20',
      icon: 'bg-blue-500/10',
      iconText: 'text-blue-400',
      value: 'text-blue-300',
      sub: 'text-blue-700',
    },
  };

  const colors = colorMap[accent];

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-5 shadow-xl ${colors.wrap}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors.icon}`}>
          <Icon className={`w-4 h-4 ${colors.iconText}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold mb-1 ${colors.value}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      {sub && <p className={`text-xs mt-1 ${colors.sub}`}>{sub}</p>}
    </div>
  );
}

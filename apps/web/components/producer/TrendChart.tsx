'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendPoint {
  week_label: string;
  revenue_cents: number;
  orders_count: number;
  unique_clients: number;
  avg_basket_cents: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    cents / 100
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const cents = payload[0]?.value ?? 0;
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-neutral-200 mb-1">{label}</p>
      <p className="text-green-400">{formatEur(cents)}</p>
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground/60">
        Pas encore de données historiques.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="week_label"
          tick={{ fill: '#737373', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatEur(v)}
          tick={{ fill: '#737373', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar
          dataKey="revenue_cents"
          fill="rgba(34,197,94,0.7)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

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

interface ProducerEntry {
  name: string;
  cents: number;
}

interface ProducerBreakdownChartProps {
  data: ProducerEntry[];
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
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-neutral-200 mb-1">{label}</p>
      <p className="text-blue-400">{formatEur(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

export function ProducerBreakdownChart({ data }: ProducerBreakdownChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-neutral-600">
        Aucune donnée.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(60 * data.length, 120)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatEur(v)}
          tick={{ fill: '#737373', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#a3a3a3', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar
          dataKey="cents"
          fill="rgba(59,130,246,0.7)"
          radius={[0, 4, 4, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

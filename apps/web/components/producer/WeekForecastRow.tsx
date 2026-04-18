'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EntityDetail {
  entity_id: string;
  entity_name: string;
  confirmed_orders_count: number;
  projected_orders_count: number;
  baskets_mix_confirmed: Record<string, number>;
  total_cents: number;
}

interface WeekForecastRowProps {
  weekLabel: string;
  weekOffset: number;
  confirmedCents: number;
  projectedCents: number;
  totalCents: number;
  confirmedOrdersCount: number;
  projectedOrdersCount: number;
  confirmedBasketsBySize: Record<string, number>;
  projectedBasketsBySize: Record<string, number>;
  entityDetails: EntityDetail[];
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    cents / 100
  );
}

function SizeBadges({ sizes }: { sizes: Record<string, number> }) {
  const entries = Object.entries(sizes).filter(([, v]) => v > 0);
  if (!entries.length) return <span className="text-muted-foreground/60 text-xs">—</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {entries.map(([size, count]) => (
        <span
          key={size}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-border text-[10px] font-medium text-foreground/70"
        >
          {size}&nbsp;×{count}
        </span>
      ))}
    </div>
  );
}

export function WeekForecastRow({
  weekLabel,
  weekOffset,
  confirmedCents,
  projectedCents,
  totalCents,
  confirmedOrdersCount,
  projectedOrdersCount,
  confirmedBasketsBySize,
  projectedBasketsBySize,
  entityDetails,
}: WeekForecastRowProps) {
  const [open, setOpen] = useState(false);

  const weekBadgeVariant =
    weekOffset === 0
      ? 'success'
      : weekOffset === 1
      ? 'warning'
      : 'default';

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground/80">{weekLabel}</span>
            {weekOffset === 0 && (
              <Badge variant={weekBadgeVariant} className="text-[10px]">
                En cours
              </Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-green-400">
          {formatEur(confirmedCents)}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-blue-300">
          {formatEur(projectedCents)}
        </td>
        <td className="px-4 py-3 text-sm font-bold text-foreground">
          {formatEur(totalCents)}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <SizeBadges sizes={confirmedBasketsBySize} />
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <SizeBadges sizes={projectedBasketsBySize} />
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {confirmedOrdersCount + projectedOrdersCount}
        </td>
      </tr>

      {open && entityDetails.length > 0 && (
        <tr className="border-b border-white/5 bg-white/[0.02]">
          <td colSpan={7} className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Répartition par entité
            </p>
            <div className="space-y-2">
              {entityDetails.map((entity) => (
                <div
                  key={entity.entity_id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground/80">{entity.entity_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entity.confirmed_orders_count} confirmée(s) + {entity.projected_orders_count} projetée(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SizeBadges sizes={entity.baskets_mix_confirmed} />
                    <span className="text-sm font-semibold text-foreground/70 ml-2">
                      {formatEur(entity.total_cents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}

      {open && entityDetails.length === 0 && (
        <tr className="border-b border-white/5 bg-white/[0.02]">
          <td colSpan={7} className="px-6 py-3 text-sm text-muted-foreground/60">
            Aucune entité pour cette semaine.
          </td>
        </tr>
      )}
    </>
  );
}

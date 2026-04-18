import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrendingUp, ShoppingBasket, CalendarDays, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastKPI } from '@/components/producer/ForecastKPI';
import { WeekForecastRow } from '@/components/producer/WeekForecastRow';
import { TrendChart } from '@/components/producer/TrendChart';
import { formatCents } from '@/lib/utils';
import { getProducerContext } from '@/lib/auth/producer-context';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
interface ForecastWeekRow {
  producer_id: string;
  producer_name: string;
  week_start: string;
  week_label: string;
  week_offset: number;
  confirmed_cents: number;
  projected_cents: number;
  total_cents: number;
  confirmed_orders_count: number;
  projected_orders_count: number;
  confirmed_baskets_by_size: Record<string, number>;
  projected_baskets_by_size: Record<string, number>;
}

interface ForecastEntityRow {
  producer_id: string;
  entity_id: string;
  entity_name: string;
  week_start: string;
  confirmed_orders_count: number;
  projected_orders_count: number;
  baskets_mix_confirmed: Record<string, number>;
  total_cents: number;
}

interface TrendRow {
  producer_id: string;
  week_start: string;
  week_label: string;
  orders_count: number;
  revenue_cents: number;
  unique_clients: number;
  avg_basket_cents: number;
}

// ---------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------
async function getProducerForecast(producerId: string) {
  const supabase = await createClient();

  const [
    { data: weeklyForecast },
    { data: entityForecast },
    { data: trend },
    { data: subscriptions },
  ] = await Promise.all([
    supabase
      .from('v_producer_forecast_weekly')
      .select('*')
      .eq('producer_id', producerId)
      .order('week_start', { ascending: true }),
    supabase
      .from('v_producer_forecast_by_entity')
      .select('*')
      .eq('producer_id', producerId)
      .order('week_start', { ascending: true }),
    supabase
      .from('v_producer_trend_12w')
      .select('*')
      .eq('producer_id', producerId)
      .order('week_start', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('producer_id', producerId)
      .eq('status', 'active'),
  ]);

  return {
    weeklyForecast: (weeklyForecast ?? []) as ForecastWeekRow[],
    entityForecast: (entityForecast ?? []) as ForecastEntityRow[],
    trend: (trend ?? []) as TrendRow[],
    activeSubscriptions: subscriptions?.length ?? 0,
  };
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
export default async function ProducerForecastPage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  const { weeklyForecast, entityForecast, trend, activeSubscriptions } =
    await getProducerForecast(ctx.producerId);

  // KPI values
  const currentWeek = weeklyForecast.find((w) => w.week_offset === 0);
  const nextWeek = weeklyForecast.find((w) => w.week_offset === 1);
  const total4w = weeklyForecast.reduce((sum, w) => sum + (w.total_cents ?? 0), 0);

  // "À produire semaine prochaine" aggregate
  const nextWeekEntities = entityForecast.filter((e) => {
    if (!nextWeek) return false;
    return e.week_start === nextWeek.week_start;
  });

  // Merge confirmed + projected sizes for next week
  const nextWeekSizes: Record<string, number> = {};
  const allSizes = {
    ...(nextWeek?.confirmed_baskets_by_size ?? {}),
    ...(nextWeek?.projected_baskets_by_size ?? {}),
  };
  for (const [size, qty] of Object.entries(allSizes)) {
    nextWeekSizes[size] = (nextWeekSizes[size] ?? 0) + (qty as number);
  }

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
            Vision financière
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
            Prévisionnel — {ctx.producerName}
          </h1>
        </div>

        {/* 4 KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ForecastKPI
            label="CA semaine en cours"
            value={formatCents(currentWeek?.confirmed_cents ?? 0)}
            sub={`${currentWeek?.confirmed_orders_count ?? 0} commande(s) confirmée(s)`}
            icon={TrendingUp}
            accent="green"
          />
          <ForecastKPI
            label="CA semaine prochaine"
            value={formatCents(nextWeek?.total_cents ?? 0)}
            sub={`Confirmé ${formatCents(nextWeek?.confirmed_cents ?? 0)} + projeté ${formatCents(nextWeek?.projected_cents ?? 0)}`}
            icon={CalendarDays}
            accent="blue"
          />
          <ForecastKPI
            label="Projection 4 semaines"
            value={formatCents(total4w)}
            sub="Confirmé + abonnements"
            icon={ShoppingBasket}
            accent="amber"
          />
          <ForecastKPI
            label="Abonnements actifs"
            value={String(activeSubscriptions)}
            sub="Commandes récurrentes"
            icon={RefreshCw}
            accent="default"
          />
        </div>

        {/* Graphique tendance 12 semaines */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Tendance 12 semaines</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>

        {/* Tableau 4 semaines */}
        <Card className="mb-8 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Détail semaine par semaine</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Semaine
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Confirmé
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Projeté
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">
                    Paniers confirmés
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">
                    Paniers projetés
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Nb cmd
                  </th>
                </tr>
              </thead>
              <tbody>
                {weeklyForecast.map((row) => {
                  const entityDetails = entityForecast.filter(
                    (e) => e.week_start === row.week_start
                  );
                  return (
                    <WeekForecastRow
                      key={`${row.producer_id}-${row.week_start}`}
                      weekLabel={row.week_label}
                      weekOffset={row.week_offset}
                      confirmedCents={row.confirmed_cents}
                      projectedCents={row.projected_cents}
                      totalCents={row.total_cents}
                      confirmedOrdersCount={row.confirmed_orders_count}
                      projectedOrdersCount={row.projected_orders_count}
                      confirmedBasketsBySize={row.confirmed_baskets_by_size ?? {}}
                      projectedBasketsBySize={row.projected_baskets_by_size ?? {}}
                      entityDetails={entityDetails.map((e) => ({
                        entity_id: e.entity_id,
                        entity_name: e.entity_name,
                        confirmed_orders_count: e.confirmed_orders_count,
                        projected_orders_count: e.projected_orders_count,
                        baskets_mix_confirmed: e.baskets_mix_confirmed ?? {},
                        total_cents: e.total_cents,
                      }))}
                    />
                  );
                })}
                {weeklyForecast.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-600">
                      Aucune donnée prévisionnelle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Bloc "À produire semaine prochaine" */}
        {nextWeek && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                A produire — {nextWeek.week_label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Total paniers par taille */}
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                  Total paniers prévus
                </p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(nextWeekSizes)
                    .filter(([, v]) => v > 0)
                    .map(([size, count]) => (
                      <div
                        key={size}
                        className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10"
                      >
                        <span className="text-2xl font-bold text-neutral-50">{count}</span>
                        <span className="text-xs text-neutral-500 font-medium">Panier {size}</span>
                      </div>
                    ))}
                  {Object.keys(nextWeekSizes).length === 0 && (
                    <p className="text-sm text-neutral-600">Aucun panier prévu.</p>
                  )}
                </div>
              </div>

              {/* Répartition par entité */}
              {nextWeekEntities.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                    Par entité
                  </p>
                  <div className="space-y-3">
                    {nextWeekEntities.map((entity) => (
                      <div
                        key={entity.entity_id}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-200">
                            {entity.entity_name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {entity.confirmed_orders_count} confirmée(s) + {entity.projected_orders_count} projetée(s)
                          </p>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {Object.entries(entity.baskets_mix_confirmed ?? {})
                            .filter(([, v]) => v > 0)
                            .map(([size, count]) => (
                              <span
                                key={size}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium text-neutral-300"
                              >
                                {size}&nbsp;×{count}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

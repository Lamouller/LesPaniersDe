import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrendingUp, ShoppingBasket, CalendarDays, RefreshCw, Fuel, Leaf, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastKPI } from '@/components/producer/ForecastKPI';
import { WeekForecastRow } from '@/components/producer/WeekForecastRow';
import { TrendChart } from '@/components/producer/TrendChart';
import { formatCents } from '@/lib/utils';
import { getProducerContext } from '@/lib/auth/producer-context';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';
import { calculateRouteEconomics } from '@/lib/economics/fuel';
import type { VehicleConfig } from '@/lib/economics/fuel';
import Link from 'next/link';

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
    { data: producerVehicle },
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
    supabase
      .from('producers')
      .select(
        'vehicle_fuel_type, vehicle_consumption_l_per_100km, vehicle_kwh_per_100km, custom_diesel_price_eur, custom_gasoline_price_eur, custom_electric_price_eur'
      )
      .eq('id', producerId)
      .single(),
  ]);

  const vehicleConfig: VehicleConfig | null = producerVehicle?.vehicle_fuel_type
    ? {
        fuel_type: producerVehicle.vehicle_fuel_type as VehicleConfig['fuel_type'],
        consumption_l_per_100km: producerVehicle.vehicle_consumption_l_per_100km as number | null,
        kwh_per_100km: producerVehicle.vehicle_kwh_per_100km as number | null,
        custom_diesel_price_eur: producerVehicle.custom_diesel_price_eur as number | null,
        custom_gasoline_price_eur: producerVehicle.custom_gasoline_price_eur as number | null,
        custom_electric_price_eur: producerVehicle.custom_electric_price_eur as number | null,
      }
    : null;

  return {
    weeklyForecast: (weeklyForecast ?? []) as ForecastWeekRow[],
    entityForecast: (entityForecast ?? []) as ForecastEntityRow[],
    trend: (trend ?? []) as TrendRow[],
    activeSubscriptions: subscriptions?.length ?? 0,
    vehicleConfig,
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

  const { weeklyForecast, entityForecast, trend, activeSubscriptions, vehicleConfig } =
    await getProducerForecast(ctx.producerId);

  // KPI values
  const currentWeek = weeklyForecast.find((w) => w.week_offset === 0);
  const nextWeek = weeklyForecast.find((w) => w.week_offset === 1);
  const total4w = weeklyForecast.reduce((sum, w) => sum + (w.total_cents ?? 0), 0);

  // ---- Impact environnemental estimé 4 semaines ----
  // Estimation simple : on utilise une distance de tournée forfaitaire (200 km si pas de données OSRM)
  // En pratique, l'admin peut améliorer ça en stockant la distance OSRM dans les deliveries.
  const ESTIMATED_TOUR_DISTANCE_M = 200_000; // 200 km par tournée (estimation conservative)

  interface WeekEnvImpact {
    week_label: string;
    cost_eur: number | null;
    co2_kg: number | null;
    savings_eur: number | null;
    savings_co2_kg: number | null;
  }

  const envImpact4w: WeekEnvImpact[] = weeklyForecast.map((w) => {
    if (!vehicleConfig) {
      return { week_label: w.week_label, cost_eur: null, co2_kg: null, savings_eur: null, savings_co2_kg: null };
    }
    const eco = calculateRouteEconomics(ESTIMATED_TOUR_DISTANCE_M, vehicleConfig);
    if (!eco) {
      return { week_label: w.week_label, cost_eur: null, co2_kg: null, savings_eur: null, savings_co2_kg: null };
    }
    return {
      week_label: w.week_label,
      cost_eur: eco.cost_eur,
      co2_kg: eco.co2_kg,
      savings_eur: eco.vs_naive.savings_eur,
      savings_co2_kg: eco.vs_naive.savings_co2_kg,
    };
  });

  const totalCostEur4w = envImpact4w.reduce((s, w) => s + (w.cost_eur ?? 0), 0);
  const totalCo2Kg4w = envImpact4w.reduce((s, w) => s + (w.co2_kg ?? 0), 0);
  const totalSavingsEur4w = envImpact4w.reduce((s, w) => s + (w.savings_eur ?? 0), 0);
  const totalSavingsCo24w = envImpact4w.reduce((s, w) => s + (w.savings_co2_kg ?? 0), 0);

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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Vision financière
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Semaine
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Confirmé
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Projeté
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Paniers confirmés
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Paniers projetés
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground/60">
                      Aucune donnée prévisionnelle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Impact environnemental 4 semaines */}
        {vehicleConfig ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-500" />
                Impact environnemental — 4 semaines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Estimé sur une tournée de ~200 km/semaine.{' '}
                <Link href="/producer/settings" className="underline">
                  Ajuster les paramètres véhicule
                </Link>
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {envImpact4w.map((w) => (
                  <div
                    key={w.week_label}
                    className="flex flex-col gap-1 p-3 rounded-xl bg-white/5 border border-border"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {w.week_label}
                    </p>
                    {w.cost_eur !== null ? (
                      <>
                        <p className="text-sm font-bold text-foreground flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-muted-foreground" />
                          {w.cost_eur.toFixed(2).replace('.', ',')} €
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Leaf className="w-3 h-3 text-green-500" />
                          {w.co2_kg} kg CO₂
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Cumul 4 semaines */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                  <Fuel className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Total : {totalCostEur4w.toFixed(2).replace('.', ',')} €
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <Leaf className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(totalCo2Kg4w * 10) / 10} kg CO₂
                  </span>
                </div>
                {totalSavingsEur4w > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                    <TrendingDown className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                      Économie vs non optimisé :{' '}
                      <span className="font-semibold text-green-500">
                        {totalSavingsEur4w.toFixed(2).replace('.', ',')} €
                      </span>{' '}
                      ·{' '}
                      <span className="font-semibold text-green-500">
                        {Math.round(totalSavingsCo24w * 10) / 10} kg CO₂
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mb-8 px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-muted-foreground flex items-center gap-2">
            <Fuel className="w-4 h-4 flex-shrink-0" />
            Configurez votre véhicule dans{' '}
            <Link href="/producer/settings" className="underline font-medium text-foreground ml-1">
              Paramètres
            </Link>{' '}
            pour voir l&apos;impact environnemental de vos tournées.
          </div>
        )}

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
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Total paniers prévus
                </p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(nextWeekSizes)
                    .filter(([, v]) => v > 0)
                    .map(([size, count]) => (
                      <div
                        key={size}
                        className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-border"
                      >
                        <span className="text-2xl font-bold text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground font-medium">Panier {size}</span>
                      </div>
                    ))}
                  {Object.keys(nextWeekSizes).length === 0 && (
                    <p className="text-sm text-muted-foreground/60">Aucun panier prévu.</p>
                  )}
                </div>
              </div>

              {/* Répartition par entité */}
              {nextWeekEntities.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Par entité
                  </p>
                  <div className="space-y-3">
                    {nextWeekEntities.map((entity) => (
                      <div
                        key={entity.entity_id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground/80">
                            {entity.entity_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entity.confirmed_orders_count} confirmée(s) + {entity.projected_orders_count} projetée(s)
                          </p>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {Object.entries(entity.baskets_mix_confirmed ?? {})
                            .filter(([, v]) => v > 0)
                            .map(([size, count]) => (
                              <span
                                key={size}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-border text-[10px] font-medium text-foreground/70"
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

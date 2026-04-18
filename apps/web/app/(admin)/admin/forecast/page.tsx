import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrendingUp, Users, ShoppingBasket, AlertTriangle, Download, Fuel, Leaf, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CapacityAlerts } from '@/components/admin/CapacityAlerts';
import { ProducerBreakdownChart } from '@/components/admin/ProducerBreakdownChart';
import { formatCents } from '@/lib/utils';
import Link from 'next/link';
import { calculateRouteEconomics } from '@/lib/economics/fuel';
import type { VehicleConfig } from '@/lib/economics/fuel';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
interface AggregateRow {
  week_start: string;
  week_label: string;
  week_offset: number;
  total_revenue_cents: number;
  producers_count: number;
  entities_count: number;
  orders_count: number;
  producer_breakdown: Array<{ producer_id: string; name: string; cents: number }>;
}

interface CapacityAlert {
  catalog_id: string;
  producer_id: string;
  producer_name: string;
  week_start: string;
  max_orders: number;
  current_orders: number;
  fill_pct: number;
  severity: 'critical' | 'warning' | 'info' | null;
}

// ---------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------
interface ProducerVehicleRow {
  id: string;
  vehicle_fuel_type: string | null;
  vehicle_consumption_l_per_100km: number | null;
  vehicle_kwh_per_100km: number | null;
  custom_diesel_price_eur: number | null;
  custom_gasoline_price_eur: number | null;
  custom_electric_price_eur: number | null;
}

async function getAdminForecast() {
  const supabase = await createClient();

  const [{ data: aggregate }, { data: capacityAlerts }, { data: producerVehicles }] = await Promise.all([
    supabase
      .from('v_admin_forecast_aggregate')
      .select('*')
      .order('week_start', { ascending: true }),
    supabase
      .from('v_producer_capacity_alerts')
      .select('*')
      .not('severity', 'is', null)
      .order('fill_pct', { ascending: false }),
    supabase
      .from('producers')
      .select(
        'id, vehicle_fuel_type, vehicle_consumption_l_per_100km, vehicle_kwh_per_100km, custom_diesel_price_eur, custom_gasoline_price_eur, custom_electric_price_eur'
      )
      .eq('is_active', true),
  ]);

  return {
    aggregate: (aggregate ?? []) as AggregateRow[],
    capacityAlerts: (capacityAlerts ?? []) as CapacityAlert[],
    producerVehicles: (producerVehicles ?? []) as ProducerVehicleRow[],
  };
}

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
export default async function AdminForecastPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  const { aggregate, capacityAlerts, producerVehicles } = await getAdminForecast();

  // Grand KPI : total 4 semaines
  const total4wCents = aggregate.reduce((sum, row) => sum + (row.total_revenue_cents ?? 0), 0);
  const totalOrders = aggregate.reduce((sum, row) => sum + (row.orders_count ?? 0), 0);

  // Breakdown pour la semaine N+1 (la plus intéressante pour la vue globale)
  const nextWeekRow = aggregate.find((r) => r.week_offset === 1) ?? aggregate[0];
  const breakdownData = (nextWeekRow?.producer_breakdown ?? []).map((p) => ({
    name: p.name,
    cents: p.cents,
  }));

  const criticalCount = capacityAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = capacityAlerts.filter((a) => a.severity === 'warning').length;

  // ---- Impact carburant plateforme (4 semaines) ----
  // Estimation : chaque producteur actif fait 1 tournée/semaine × 200 km × 4 semaines
  const ESTIMATED_TOUR_DISTANCE_M = 200_000;
  const NUM_WEEKS = aggregate.length > 0 ? aggregate.length : 4;

  let platformTotalCostEur = 0;
  let platformTotalCo2Kg = 0;
  let platformTotalSavingsEur = 0;
  let platformTotalSavingsCo2Kg = 0;

  for (const pv of producerVehicles) {
    if (!pv.vehicle_fuel_type) continue;
    const vc: VehicleConfig = {
      fuel_type: pv.vehicle_fuel_type as VehicleConfig['fuel_type'],
      consumption_l_per_100km: pv.vehicle_consumption_l_per_100km,
      kwh_per_100km: pv.vehicle_kwh_per_100km,
      custom_diesel_price_eur: pv.custom_diesel_price_eur,
      custom_gasoline_price_eur: pv.custom_gasoline_price_eur,
      custom_electric_price_eur: pv.custom_electric_price_eur,
    };
    const eco = calculateRouteEconomics(ESTIMATED_TOUR_DISTANCE_M, vc);
    if (eco) {
      platformTotalCostEur += eco.cost_eur * NUM_WEEKS;
      platformTotalCo2Kg += eco.co2_kg * NUM_WEEKS;
      platformTotalSavingsEur += eco.vs_naive.savings_eur * NUM_WEEKS;
      platformTotalSavingsCo2Kg += eco.vs_naive.savings_co2_kg * NUM_WEEKS;
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Vue globale
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Previsionnel agrege plateforme
          </h1>
        </div>
        <Link
          href="/api/admin/forecast/export"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-border text-sm font-medium text-foreground/70 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </Link>
      </div>

      {/* Grand KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-xl lg:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/10">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-300 mb-1">{formatCents(total4wCents)}</p>
          <p className="text-xs text-muted-foreground">CA total previsionnel 4 prochaines semaines</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{totalOrders} commandes (confirmees + projetees)</p>
        </div>
        <div
          className={`backdrop-blur-xl border rounded-2xl p-5 shadow-xl ${
            criticalCount > 0
              ? 'border-red-500/20 bg-red-500/5'
              : warningCount > 0
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'bg-white/5 border-border'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                criticalCount > 0 || warningCount > 0 ? 'bg-red-500/10' : 'bg-white/5 border border-border'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${
                  criticalCount > 0
                    ? 'text-red-400'
                    : warningCount > 0
                    ? 'text-amber-400'
                    : 'text-muted-foreground'
                }`}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mb-1 ${
              criticalCount > 0 ? 'text-red-300' : warningCount > 0 ? 'text-amber-300' : 'text-foreground'
            }`}
          >
            {criticalCount + warningCount}
          </p>
          <p className="text-xs text-muted-foreground">Alertes capacite</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {criticalCount} critique(s) · {warningCount} attention
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-border">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1">
            {aggregate[0]?.producers_count ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">Producteurs actifs</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{aggregate[0]?.entities_count ?? 0} entites</p>
        </div>
      </div>

      {/* KPI Impact carburant plateforme */}
      {platformTotalCostEur > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              Impact carburant plateforme — {NUM_WEEKS} semaines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Estimé sur ~200 km/tournée/semaine par producteur ayant renseigné son véhicule ({producerVehicles.filter((p) => !!p.vehicle_fuel_type).length}/{producerVehicles.length} producteurs configurés).
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-accent/10 border border-accent/20 rounded-xl">
                <Fuel className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {platformTotalCostEur.toFixed(2).replace('.', ',')} €
                  </p>
                  <p className="text-xs text-muted-foreground">Carburant total estimé</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <Leaf className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {Math.round(platformTotalCo2Kg * 10) / 10} kg
                  </p>
                  <p className="text-xs text-muted-foreground">CO₂ émis</p>
                </div>
              </div>
              {platformTotalSavingsEur > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                  <TrendingDown className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-lg font-bold text-green-400">
                      {platformTotalSavingsEur.toFixed(2).replace('.', ',')} €
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Économie optimisation ({Math.round(platformTotalSavingsCo2Kg * 10) / 10} kg CO₂ évité)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Tableau par semaine */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-muted-foreground" />
              Detail par semaine
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Semaine
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    CA total
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Commandes
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Moy. panier
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {aggregate.map((row) => {
                  const avgBasket =
                    row.orders_count > 0
                      ? Math.round(row.total_revenue_cents / row.orders_count)
                      : 0;
                  return (
                    <tr key={row.week_start} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground/80">{row.week_label}</span>
                          {row.week_offset === 0 && (
                            <Badge variant="success" className="text-[10px]">
                              En cours
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-green-400">
                        {formatCents(row.total_revenue_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {row.orders_count}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                        {avgBasket > 0 ? formatCents(avgBasket) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {aggregate.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground/60">
                      Aucune donnee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Breakdown par producer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Repartition producers — {nextWeekRow?.week_label ?? 'N+1'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProducerBreakdownChart data={breakdownData} />
          </CardContent>
        </Card>
      </div>

      {/* Alertes capacite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Alertes capacite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CapacityAlerts alerts={capacityAlerts} />
        </CardContent>
      </Card>
    </div>
  );
}

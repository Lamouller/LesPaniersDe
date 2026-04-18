import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrendingUp, Users, ShoppingBasket, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CapacityAlerts } from '@/components/admin/CapacityAlerts';
import { ProducerBreakdownChart } from '@/components/admin/ProducerBreakdownChart';
import { formatCents } from '@/lib/utils';
import Link from 'next/link';

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
async function getAdminForecast() {
  const supabase = await createClient();

  const [{ data: aggregate }, { data: capacityAlerts }] = await Promise.all([
    supabase
      .from('v_admin_forecast_aggregate')
      .select('*')
      .order('week_start', { ascending: true }),
    supabase
      .from('v_producer_capacity_alerts')
      .select('*')
      .not('severity', 'is', null)
      .order('fill_pct', { ascending: false }),
  ]);

  return {
    aggregate: (aggregate ?? []) as AggregateRow[],
    capacityAlerts: (capacityAlerts ?? []) as CapacityAlert[],
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

  const { aggregate, capacityAlerts } = await getAdminForecast();

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
            Vue globale
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
            Previsionnel agrege plateforme
          </h1>
        </div>
        <Link
          href="/api/admin/forecast/export"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-neutral-300 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </Link>
      </div>

      {/* Grand KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl lg:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/10">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-300 mb-1">{formatCents(total4wCents)}</p>
          <p className="text-xs text-neutral-500">CA total previsionnel 4 prochaines semaines</p>
          <p className="text-xs text-neutral-600 mt-1">{totalOrders} commandes (confirmees + projetees)</p>
        </div>
        <div
          className={`backdrop-blur-xl border rounded-2xl p-5 shadow-xl ${
            criticalCount > 0
              ? 'border-red-500/20 bg-red-500/5'
              : warningCount > 0
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                criticalCount > 0 || warningCount > 0 ? 'bg-red-500/10' : 'bg-white/5 border border-white/10'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${
                  criticalCount > 0
                    ? 'text-red-400'
                    : warningCount > 0
                    ? 'text-amber-400'
                    : 'text-neutral-400'
                }`}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mb-1 ${
              criticalCount > 0 ? 'text-red-300' : warningCount > 0 ? 'text-amber-300' : 'text-neutral-50'
            }`}
          >
            {criticalCount + warningCount}
          </p>
          <p className="text-xs text-neutral-500">Alertes capacite</p>
          <p className="text-xs text-neutral-600 mt-1">
            {criticalCount} critique(s) · {warningCount} attention
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
              <Users className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-50 mb-1">
            {aggregate[0]?.producers_count ?? 0}
          </p>
          <p className="text-xs text-neutral-500">Producteurs actifs</p>
          <p className="text-xs text-neutral-600 mt-1">{aggregate[0]?.entities_count ?? 0} entites</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Tableau par semaine */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-neutral-400" />
              Detail par semaine
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Semaine
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    CA total
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">
                    Commandes
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">
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
                          <span className="text-sm text-neutral-200">{row.week_label}</span>
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
                      <td className="px-4 py-2.5 text-xs text-neutral-400 hidden md:table-cell">
                        {row.orders_count}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-400 hidden md:table-cell">
                        {avgBasket > 0 ? formatCents(avgBasket) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {aggregate.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-600">
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

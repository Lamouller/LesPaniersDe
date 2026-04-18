import React from 'react';
import { ShoppingBasket, Users, TrendingUp, AlertTriangle, CalendarDays, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface CapacityAlert {
  catalog_id: string;
  producer_name: string;
  week_start: string;
  max_orders: number;
  current_orders: number;
  fill_pct: number;
  severity: 'critical' | 'warning' | 'info' | null;
}

interface ForecastWeekRow {
  producer_id: string;
  week_offset: number;
  confirmed_cents: number;
  projected_cents: number;
  total_cents: number;
  confirmed_orders_count: number;
}

async function getDashboardData(producerId: string) {
  const supabase = await createClient();

  const [
    { count: ordersCount },
    { count: clientsCount },
    { count: overdueCount },
    { data: forecastWeeks },
    { data: capacityAlerts },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('producer_id', producerId)
      .not('status', 'eq', 'canceled'),
    supabase
      .from('orders')
      .select('client_id', { count: 'exact', head: true })
      .eq('producer_id', producerId)
      .not('status', 'eq', 'canceled'),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'overdue']),
    supabase
      .from('v_producer_forecast_weekly')
      .select('producer_id, week_offset, confirmed_cents, projected_cents, total_cents, confirmed_orders_count')
      .eq('producer_id', producerId)
      .in('week_offset', [0, 1]),
    supabase
      .from('v_producer_capacity_alerts')
      .select('*')
      .eq('producer_id', producerId)
      .in('severity', ['warning', 'critical'])
      .limit(3),
  ]);

  const currentWeek = (forecastWeeks ?? []).find(
    (r: ForecastWeekRow) => r.week_offset === 0
  ) as ForecastWeekRow | undefined;
  const nextWeek = (forecastWeeks ?? []).find(
    (r: ForecastWeekRow) => r.week_offset === 1
  ) as ForecastWeekRow | undefined;

  return {
    ordersCount: ordersCount ?? 0,
    clientsCount: clientsCount ?? 0,
    overdueCount: overdueCount ?? 0,
    currentWeekCents: currentWeek?.confirmed_cents ?? 0,
    nextWeekCents: nextWeek?.total_cents ?? 0,
    capacityAlerts: (capacityAlerts ?? []) as CapacityAlert[],
  };
}

export default async function ProducerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: producer } = await supabase
    .from('producers')
    .select('id, name')
    .eq('user_id', user.id)
    .single();

  if (!producer) {
    // No producer profile yet — show basic page
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Tableau de bord producteur</h1>
        <p className="text-neutral-400 mt-2">Profil producteur non configure.</p>
      </div>
    );
  }

  const {
    ordersCount,
    clientsCount,
    overdueCount,
    currentWeekCents,
    nextWeekCents,
    capacityAlerts,
  } = await getDashboardData(producer.id);

  const hasCritical = capacityAlerts.some((a) => a.severity === 'critical');

  const STATS = [
    { label: 'Commandes semaine', value: String(ordersCount), icon: ShoppingBasket, alert: false },
    { label: 'Clients actifs', value: String(clientsCount), icon: Users, alert: false },
    { label: 'CA semaine en cours', value: formatCents(currentWeekCents), icon: TrendingUp, alert: false },
    { label: 'CA semaine prochaine', value: formatCents(nextWeekCents), icon: CalendarDays, alert: false },
    { label: 'Impayés', value: String(overdueCount), icon: AlertTriangle, alert: overdueCount > 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
          Semaine en cours
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Tableau de bord producteur</h1>
      </div>

      {/* Alerte capacite si warning ou critical */}
      {capacityAlerts.length > 0 && (
        <div
          className={`mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border ${
            hasCritical
              ? 'border-red-500/20 bg-red-500/5 text-red-300'
              : 'border-amber-500/20 bg-amber-500/5 text-amber-300'
          }`}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-0.5">
              {hasCritical ? 'Capacite atteinte' : 'Capacite presque atteinte'}
            </p>
            <p className="text-xs opacity-75">
              {capacityAlerts
                .map(
                  (a) =>
                    `${a.fill_pct}% rempli (${a.current_orders}/${a.max_orders} cmd)`
                )
                .join(' · ')}
            </p>
          </div>
          <Link
            href="/producer/forecast"
            className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            Voir detail
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {STATS.map((s) => (
          <Card
            key={s.label}
            className={s.alert ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/[0.08]' : ''}
          >
            <CardContent className="pt-6">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                  s.alert ? 'bg-red-500/10' : 'bg-white/5 border border-white/10'
                }`}
              >
                <s.icon className={`w-4 h-4 ${s.alert ? 'text-red-400' : 'text-neutral-400'}`} />
              </div>
              <p
                className={`text-2xl font-bold mb-1 ${
                  s.alert ? 'text-red-300' : 'text-neutral-50'
                }`}
              >
                {s.value}
              </p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lien previsionnel complet */}
      <div className="mb-8">
        <Link
          href="/producer/forecast"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-neutral-300 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        >
          <TrendingUp className="w-4 h-4" />
          Voir le previsionnel complet
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

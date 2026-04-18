import React from 'react';
import { TrendingUp, ShoppingBasket, AlertTriangle, UserX, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents, formatDateShort } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

async function getAdminStats() {
  const supabase = await createClient();

  // KPI 1 : commandes de la semaine en cours
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // lundi

  const { count: ordersCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('placed_at', weekStart.toISOString())
    .not('status', 'eq', 'canceled');

  // KPI 2 : CA prévisionnel de la semaine (statuts non annulés)
  const { data: weekOrders } = await supabase
    .from('orders')
    .select('total_cents, status')
    .gte('placed_at', weekStart.toISOString())
    .in('status', ['pending', 'confirmed', 'picked_up']);

  const revenueCents = (weekOrders ?? []).reduce((sum, o) => sum + (o.total_cents ?? 0), 0);

  // KPI 3 : paiements en attente (pending + overdue)
  const { count: pendingPayments } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'overdue']);

  // KPI 4 : clients bloqués
  const { count: blockedClients } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('ordering_blocked_until', new Date().toISOString());

  return {
    ordersCount: ordersCount ?? 0,
    revenueCents,
    pendingPayments: pendingPayments ?? 0,
    blockedClients: blockedClients ?? 0,
  };
}

async function getAlerts() {
  const supabase = await createClient();

  // Impayés overdue
  const { data: overduePayments } = await supabase
    .from('v_admin_reconciliation')
    .select('payment_id, client_name, amount_cents, due_at, order_number')
    .eq('payment_status', 'overdue')
    .order('due_at', { ascending: true })
    .limit(5);

  // Clients bloqués
  const { data: blockedProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, ordering_blocked_until')
    .gt('ordering_blocked_until', new Date().toISOString())
    .limit(5);

  return {
    overduePayments: overduePayments ?? [],
    blockedProfiles: blockedProfiles ?? [],
  };
}

async function getRecentActivity() {
  const supabase = await createClient();

  // 10 dernières orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_cents, placed_at, client_id, profiles!orders_client_id_fkey(full_name)')
    .order('placed_at', { ascending: false })
    .limit(10);

  // 10 derniers paiements pointés
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('id, status, amount_cents, method, reconciled_at, order_id, orders!payments_order_id_fkey(order_number, client_id, profiles!orders_client_id_fkey(full_name))')
    .eq('status', 'paid')
    .not('reconciled_at', 'is', null)
    .order('reconciled_at', { ascending: false })
    .limit(10);

  return {
    recentOrders: recentOrders ?? [],
    recentPayments: recentPayments ?? [],
  };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }> = {
    draft: { label: 'Brouillon', variant: 'default' },
    pending: { label: 'En attente', variant: 'warning' },
    confirmed: { label: 'Confirmée', variant: 'success' },
    picked_up: { label: 'Retirée', variant: 'success' },
    canceled: { label: 'Annulée', variant: 'destructive' },
    paid: { label: 'Payé', variant: 'success' },
    overdue: { label: 'En retard', variant: 'destructive' },
  };
  const cfg = map[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default async function AdminDashboardPage() {
  const [stats, alerts, activity] = await Promise.all([
    getAdminStats(),
    getAlerts(),
    getRecentActivity(),
  ]);

  const kpis = [
    {
      label: 'Commandes cette semaine',
      value: String(stats.ordersCount),
      icon: ShoppingBasket,
      alert: false,
      sub: 'Hors annulées',
    },
    {
      label: 'CA prévisionnel',
      value: formatCents(stats.revenueCents),
      icon: TrendingUp,
      alert: false,
      sub: 'Semaine en cours',
    },
    {
      label: 'Paiements en attente',
      value: String(stats.pendingPayments),
      icon: AlertTriangle,
      alert: stats.pendingPayments > 0,
      sub: 'Pending + overdue',
    },
    {
      label: 'Clients bloqués',
      value: String(stats.blockedClients),
      icon: UserX,
      alert: stats.blockedClients > 0,
      sub: 'Pour impayé',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Vue globale</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard admin</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`bg-background/50 dark:bg-white/5 backdrop-blur-xl border rounded-2xl p-5 shadow-sm ${kpi.alert ? 'border-destructive/20 bg-destructive/5' : 'border-border'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.alert ? 'bg-destructive/10' : 'bg-muted border border-border'}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.alert ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mb-1 ${kpi.alert ? 'text-destructive' : 'text-foreground'}`}>
              {kpi.value}
            </p>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xs mt-1 ${kpi.alert ? 'text-destructive/70' : 'text-muted-foreground/60'}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Alertes impayés */}
        <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Impayés overdue
            </h2>
            <Link
              href="/admin/sales"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Voir tout
            </Link>
          </div>
          {alerts.overduePayments.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">Aucun impayé en retard.</p>
          ) : (
            <div className="space-y-2">
              {alerts.overduePayments.map((p) => (
                <div key={p.payment_id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.client_name}</p>
                    <p className="text-xs text-muted-foreground">{p.order_number} · échu le {p.due_at ? formatDateShort(p.due_at) : '—'}</p>
                  </div>
                  <span className="text-sm font-semibold text-destructive">{formatCents(p.amount_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clients bloqués */}
        <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-warning" />
              Clients bloqués
            </h2>
            <Link
              href="/admin/users"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Voir tout
            </Link>
          </div>
          {alerts.blockedProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">Aucun client bloqué.</p>
          ) : (
            <div className="space-y-2">
              {alerts.blockedProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
                  <p className="text-xs text-warning">
                    jusqu&apos;au {profile.ordering_blocked_until ? formatDateShort(profile.ordering_blocked_until) : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières commandes */}
        <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ShoppingBasket className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Dernières commandes</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">N°</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montant</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activity.recentOrders.map((order) => {
                const clientName = (order as { profiles?: { full_name?: string } | null }).profiles?.full_name ?? '—';
                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{order.order_number}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground hidden md:table-cell">{clientName}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-foreground">{formatCents(order.total_cents)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={order.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Derniers paiements pointés */}
        <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Derniers paiements pointés</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montant</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Méthode</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activity.recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-sm text-muted-foreground/60 text-center">Aucun paiement pointé.</td>
                </tr>
              ) : activity.recentPayments.map((pay) => {
                const orderData = (pay as { orders?: { order_number?: string; profiles?: { full_name?: string } | null } | null }).orders;
                const clientName = orderData?.profiles?.full_name ?? '—';
                const methodLabels: Record<string, string> = { cash: 'Espèces', card: 'CB', transfer: 'Virement', check: 'Chèque' };
                return (
                  <tr key={pay.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-foreground hidden md:table-cell">{clientName}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-primary">{formatCents(pay.amount_cents)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{pay.method ? (methodLabels[pay.method] ?? pay.method) : '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{pay.reconciled_at ? formatDateShort(pay.reconciled_at) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

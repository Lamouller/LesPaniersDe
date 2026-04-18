import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShoppingBasket,
  Truck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatCents } from '@/lib/utils';

type DashboardRow = {
  order_id: string;
  order_number: string;
  order_status: string;
  total_cents: number;
  placed_at: string;
  picked_up_at: string | null;
  payment_status: string | null;
  payment_due_at: string | null;
  payment_method: string | null;
  invoice_number: string | null;
  pdf_url: string | null;
  producer_name: string;
  delivery_date: string;
  entity_name: string;
  client_id: string;
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  prepared: 'Préparée',
  ready_for_pickup: 'Prête',
  picked_up: 'Retirée',
  canceled: 'Annulée',
};

const ORDER_STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  pending: 'warning',
  confirmed: 'success',
  prepared: 'warning',
  ready_for_pickup: 'success',
  picked_up: 'default',
  canceled: 'destructive',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const sp = await searchParams;
  const newOrderNumber = sp?.order;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Profile check
  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_id, ordering_blocked_until, full_name')
    .eq('id', user.id)
    .single();

  if (!profile?.entity_id) redirect('/onboarding/entity');

  const isBlocked =
    profile.ordering_blocked_until != null &&
    new Date(profile.ordering_blocked_until) > new Date();

  // Fetch dashboard via view
  const { data: rows } = await supabase
    .from('v_client_dashboard')
    .select('*')
    .eq('client_id', user.id)
    .limit(20);

  const dashRows = (rows ?? []) as DashboardRow[];

  // Categorize
  const upcomingOrders = dashRows.filter(
    (r) =>
      ['confirmed', 'prepared', 'ready_for_pickup', 'pending'].includes(r.order_status) &&
      new Date(r.delivery_date) >= new Date()
  );

  const unpaidOrders = dashRows.filter(
    (r) =>
      r.picked_up_at != null &&
      r.payment_status != null &&
      ['pending', 'overdue'].includes(r.payment_status)
  );

  const historyOrders = dashRows
    .filter((r) => ['picked_up', 'canceled'].includes(r.order_status))
    .slice(0, 5);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
          Tableau de bord
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
          {profile.full_name ? `Bonjour, ${profile.full_name.split(' ')[0]}` : 'Mon espace'}
        </h1>
      </div>

      {/* New order banner */}
      {newOrderNumber && (
        <div className="flex items-start gap-3 px-4 py-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-300">Commande confirmée !</p>
            <p className="text-xs text-green-400/80 mt-1">
              Votre commande <strong>{newOrderNumber}</strong> a bien été enregistrée. Vous
              serez prévenus lors de la livraison.
            </p>
          </div>
        </div>
      )}

      {/* Blocked banner */}
      {isBlocked && (
        <div className="flex items-start gap-3 px-4 py-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">
              Compte bloqué pour impayé
            </p>
            <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
              Vous ne pouvez pas passer de nouvelle commande tant que vos paiements en
              attente ne sont pas réglés. Contactez l'administrateur pour débloquer votre
              compte.
            </p>
          </div>
        </div>
      )}

      {/* Unpaid orders warning */}
      {unpaidOrders.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              {unpaidOrders.length} paiement{unpaidOrders.length > 1 ? 's' : ''} en attente
            </p>
            <p className="text-xs text-amber-400/80 mt-1">
              Pensez à régler vos commandes retirées avant la prochaine date limite.
            </p>
          </div>
        </div>
      )}

      {/* Upcoming orders */}
      {upcomingOrders.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-300">Prochaines commandes</h2>
          {upcomingOrders.map((order) => (
            <Link
              key={order.order_id}
              href={`/account/orders/${order.order_id}`}
              className="block"
            >
              <Card className="cursor-pointer hover:-translate-y-0.5 active:scale-[0.99]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-4 h-4 text-neutral-400" />
                      {order.order_number}
                    </CardTitle>
                    <Badge variant={ORDER_STATUS_VARIANT[order.order_status] ?? 'default'}>
                      {ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-neutral-500 mb-3">
                    {order.producer_name} · Retrait le{' '}
                    {formatDate(order.delivery_date)} · {order.entity_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-neutral-50">
                      {formatCents(order.total_cents)}
                    </span>
                    <Link href="/shop">
                      <Button variant="secondary" size="sm" type="button">
                        Modifier
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <ShoppingBasket className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-400 mb-4">
              Aucune commande à venir. Passez votre commande pour la semaine !
            </p>
            <Link href="/shop">
              <Button type="button">Commander cette semaine</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {historyOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-neutral-400" />
              Historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {historyOrders.map((order) => (
                <Link
                  key={order.order_id}
                  href={`/account/orders/${order.order_id}`}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-200">
                      {order.order_number}
                    </p>
                    <p className="text-xs text-neutral-600">{formatDate(order.delivery_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-neutral-300">
                      {formatCents(order.total_cents)}
                    </span>
                    {order.payment_status === 'paid' ? (
                      <Badge variant="success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Payé
                      </Badge>
                    ) : order.order_status === 'canceled' ? (
                      <Badge variant="destructive">Annulée</Badge>
                    ) : order.payment_status === 'overdue' ? (
                      <Badge variant="destructive">En retard</Badge>
                    ) : (
                      <Badge variant="warning">À régler</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/shop">
          <Card className="cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
              <ShoppingBasket className="w-6 h-6 text-neutral-400" />
              <p className="text-sm font-medium text-neutral-200">Boutique</p>
              <p className="text-xs text-neutral-500">Commander cette semaine</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/account/deliveries">
          <Card className="cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
              <Truck className="w-6 h-6 text-neutral-400" />
              <p className="text-sm font-medium text-neutral-200">Mes retraits</p>
              <p className="text-xs text-neutral-500">Voir le planning</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

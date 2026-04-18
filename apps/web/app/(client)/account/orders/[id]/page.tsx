import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, FileText, CheckCircle2, Clock, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCents } from '@/lib/utils';

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  prepared: 'Préparée',
  ready_for_pickup: 'Prête pour retrait',
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

const STATUS_TIMELINE = [
  'confirmed',
  'prepared',
  'ready_for_pickup',
  'picked_up',
];

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch order with items
  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, total_cents, notes, placed_at, picked_up_at,
       producers(name),
       weekly_catalogs(delivery_date),
       entities(name, pickup_address, pickup_instructions),
       order_items(id, product_name_snapshot, unit_price_cents, quantity, line_total_cents),
       payments(status, amount_cents, due_at, method)
      `
    )
    .eq('id', id)
    .eq('client_id', user.id)
    .single();

  if (!order) notFound();

  const items = (order.order_items ?? []) as unknown as OrderItem[];
  const producer = order.producers as unknown as { name: string } | null;
  const catalog = order.weekly_catalogs as unknown as { delivery_date: string } | null;
  const entity = order.entities as unknown as {
    name: string;
    pickup_address: string;
    pickup_instructions: string | null;
  } | null;
  const payment = order.payments as unknown as {
    status: string;
    amount_cents: number;
    due_at: string | null;
    method: string | null;
  } | null;

  const currentStatusIdx = STATUS_TIMELINE.indexOf(order.status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/account">
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground/80 transition-all duration-200"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Commande
          </p>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {order.order_number}
          </h1>
        </div>
        <div className="ml-auto">
          <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'default'}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </Badge>
        </div>
      </div>

      {/* Status timeline */}
      {order.status !== 'canceled' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {STATUS_TIMELINE.map((step, idx) => {
                const isPast = idx < currentStatusIdx;
                const isCurrent = idx === currentStatusIdx;
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isPast
                            ? 'bg-green-400'
                            : isCurrent
                            ? 'bg-foreground'
                            : 'bg-muted-foreground/30'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-medium text-center leading-tight ${
                          isCurrent
                            ? 'text-foreground'
                            : isPast
                            ? 'text-green-500'
                            : 'text-muted-foreground/60'
                        }`}
                      >
                        {ORDER_STATUS_LABEL[step]}
                      </span>
                    </div>
                    {idx < STATUS_TIMELINE.length - 1 && (
                      <div
                        className={`flex-1 h-px ${
                          idx < currentStatusIdx ? 'bg-green-400/50' : 'bg-muted-foreground/20'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-muted-foreground" />
            Détail de la commande
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground/80">
                    {item.product_name_snapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(item.unit_price_cents)} × {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatCents(item.line_total_cents)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <p className="text-base font-semibold text-foreground">Total</p>
              <span className="text-lg font-bold text-foreground">
                {formatCents(order.total_cents)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pickup info */}
      {entity && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground/80">
                  Retrait : {entity.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{entity.pickup_address}</p>
                {entity.pickup_instructions && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {entity.pickup_instructions}
                  </p>
                )}
                {catalog?.delivery_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Livraison prévue le {formatDate(catalog.delivery_date)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment status */}
      {payment && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground/80">Paiement</p>
                  {payment.status === 'paid' ? (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Payé
                    </Badge>
                  ) : payment.status === 'overdue' ? (
                    <Badge variant="destructive">En retard</Badge>
                  ) : payment.status === 'pending' ? (
                    <Badge variant="warning">En attente</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Montant : {formatCents(payment.amount_cents)}
                </p>
                {payment.method && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mode : {payment.method}
                  </p>
                )}
                {payment.due_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Échéance : {formatDate(payment.due_at)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Notes
            </p>
            <p className="text-sm text-foreground/70 leading-relaxed">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Placed at */}
      <p className="text-center text-xs text-muted-foreground/60">
        Commandé le {formatDate(order.placed_at)}
        {producer ? ` auprès de ${producer.name}` : ''}
      </p>
    </div>
  );
}

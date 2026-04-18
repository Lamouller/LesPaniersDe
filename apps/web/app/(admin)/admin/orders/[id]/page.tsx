import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Tractor,
  Calendar,
  ShoppingBasket,
  CreditCard,
  FileText,
  Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents, formatDate, formatDateShort } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type OrderStatus = 'pending' | 'confirmed' | 'prepared' | 'ready_for_pickup' | 'picked_up' | 'canceled';
type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'refunded' | 'canceled';

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    prepared: 'Préparée',
    ready_for_pickup: 'Prête à retirer',
    picked_up: 'Retirée',
    canceled: 'Annulée',
  };
  return labels[status] ?? status;
}

function statusVariant(
  status: OrderStatus,
): 'default' | 'success' | 'warning' | 'destructive' {
  if (status === 'confirmed' || status === 'picked_up' || status === 'prepared' || status === 'ready_for_pickup')
    return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'canceled') return 'destructive';
  return 'default';
}

function paymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'En attente',
    paid: 'Payé',
    overdue: 'En retard',
    refunded: 'Remboursé',
    canceled: 'Annulé',
  };
  return labels[status] ?? status;
}

function paymentStatusVariant(
  status: PaymentStatus,
): 'default' | 'success' | 'warning' | 'destructive' {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'destructive';
  if (status === 'pending') return 'warning';
  return 'default';
}

function methodLabel(method: string | null): string {
  const labels: Record<string, string> = {
    cash: 'Espèces',
    card: 'CB',
    transfer: 'Virement',
    check: 'Chèque',
    other: 'Autre',
  };
  return method ? (labels[method] ?? method) : '—';
}

interface TimelineEvent {
  label: string;
  date: string | null;
}

function InfoBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

export default async function AdminOrderDetailPage({
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  // Fetch order with all relations
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_cents,
      notes,
      placed_at,
      picked_up_at,
      canceled_at,
      updated_at,
      profiles!orders_client_id_fkey(id, full_name, phone, ordering_blocked_until),
      producers!orders_producer_id_fkey(id, name, contact_email, contact_phone),
      entities!orders_entity_id_fkey(id, name, address, pickup_address),
      weekly_catalogs!orders_weekly_catalog_id_fkey(id, order_deadline_at, delivery_date, week_start),
      order_items(id, product_name_snapshot, quantity, unit_price_cents, line_total_cents),
      payments(id, status, method, amount_cents, due_at, reconciled_at, reconciled_by, payment_reference, notes),
      invoices(id, invoice_number, pdf_url, issued_at, amount_cents, status)
    `)
    .eq('id', id)
    .single();

  if (error || !order) {
    notFound();
  }

  // Fetch reconciled_by email from profiles if available
  type PaymentRaw = {
    id: string;
    status: string;
    method: string | null;
    amount_cents: number;
    due_at: string | null;
    reconciled_at: string | null;
    reconciled_by: string | null;
    payment_reference: string | null;
    notes: string | null;
  };

  type ProfileRaw = { id: string; full_name: string | null; phone: string | null; ordering_blocked_until: string | null };
  type ProducerRaw = { id: string; name: string; contact_email: string | null; contact_phone: string | null };
  type EntityRaw = { id: string; name: string; address: string; pickup_address: string };
  type CatalogRaw = { id: string; order_deadline_at: string; delivery_date: string; week_start: string };
  type ItemRaw = { id: string; product_name_snapshot: string; quantity: number; unit_price_cents: number; line_total_cents: number };
  type InvoiceRaw = { id: string; invoice_number: string; pdf_url: string | null; issued_at: string; amount_cents: number; status: string };

  const typedOrder = order as unknown as {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_cents: number;
    notes: string | null;
    placed_at: string;
    picked_up_at: string | null;
    canceled_at: string | null;
    updated_at: string;
    profiles: ProfileRaw | null;
    producers: ProducerRaw | null;
    entities: EntityRaw | null;
    weekly_catalogs: CatalogRaw | null;
    order_items: ItemRaw[];
    payments: PaymentRaw | null;
    invoices: InvoiceRaw | null;
  };

  const payment = typedOrder.payments;
  let reconciledByEmail: string | null = null;
  if (payment?.reconciled_by) {
    const { data: reconciledUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', payment.reconciled_by)
      .single();
    reconciledByEmail = reconciledUser?.full_name ?? payment.reconciled_by;
  }

  // Timeline events
  const timeline: TimelineEvent[] = [
    { label: 'Commande passée', date: typedOrder.placed_at },
    {
      label: 'Confirmée / mise à jour',
      date: typedOrder.status === 'confirmed' ? typedOrder.updated_at : null,
    },
    { label: 'Retirée', date: typedOrder.picked_up_at },
    { label: 'Paiement pointé', date: payment?.reconciled_at ?? null },
  ].filter((e) => e.date !== null);

  const items = typedOrder.order_items ?? [];
  const catalog = typedOrder.weekly_catalogs;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <Link href="/admin/sales">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Revenir aux ventes
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Commande
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {typedOrder.order_number}
          </h1>
        </div>
        <Badge variant={statusVariant(typedOrder.status)}>
          {statusLabel(typedOrder.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Client */}
        <InfoBlock title="Client" icon={User}>
          <InfoRow label="Nom" value={typedOrder.profiles?.full_name ?? '—'} />
          <InfoRow label="Téléphone" value={typedOrder.profiles?.phone ?? '—'} />
          <InfoRow label="Lieu de retrait" value={typedOrder.entities?.name ?? '—'} />
          {typedOrder.entities?.pickup_address && (
            <InfoRow label="Adresse pickup" value={typedOrder.entities.pickup_address} />
          )}
        </InfoBlock>

        {/* Producteur */}
        <InfoBlock title="Producteur" icon={Tractor}>
          <InfoRow label="Nom" value={typedOrder.producers?.name ?? '—'} />
          <InfoRow label="Email" value={typedOrder.producers?.contact_email ?? '—'} />
          <InfoRow label="Téléphone" value={typedOrder.producers?.contact_phone ?? '—'} />
        </InfoBlock>

        {/* Calendrier */}
        <InfoBlock title="Calendrier" icon={Calendar}>
          {catalog ? (
            <>
              <InfoRow label="Deadline commande" value={formatDate(catalog.order_deadline_at)} />
              <InfoRow label="Livraison prévue" value={formatDateShort(catalog.delivery_date)} />
              <InfoRow label="Semaine du" value={formatDateShort(catalog.week_start)} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun catalogue lié.</p>
          )}
          {typedOrder.picked_up_at && (
            <InfoRow label="Retirée le" value={formatDate(typedOrder.picked_up_at)} />
          )}
          {typedOrder.canceled_at && (
            <InfoRow label="Annulée le" value={formatDate(typedOrder.canceled_at)} />
          )}
        </InfoBlock>

        {/* Paiement */}
        <InfoBlock title="Paiement" icon={CreditCard}>
          {payment ? (
            <>
              <InfoRow
                label="Statut"
                value={
                  <Badge variant={paymentStatusVariant(payment.status as PaymentStatus)}>
                    {paymentStatusLabel(payment.status as PaymentStatus)}
                  </Badge>
                }
              />
              <InfoRow label="Méthode" value={methodLabel(payment.method)} />
              <InfoRow label="Montant" value={formatCents(payment.amount_cents)} />
              {payment.due_at && (
                <InfoRow label="Échéance" value={formatDate(payment.due_at)} />
              )}
              {payment.reconciled_at && (
                <InfoRow label="Pointé le" value={formatDate(payment.reconciled_at)} />
              )}
              {reconciledByEmail && (
                <InfoRow label="Pointé par" value={reconciledByEmail} />
              )}
              {payment.payment_reference && (
                <InfoRow label="Référence" value={payment.payment_reference} />
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun paiement enregistré.</p>
          )}
        </InfoBlock>
      </div>

      {/* Order items */}
      <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShoppingBasket className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Articles</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Aucun article.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Qté
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Prix unit.
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-foreground">{item.product_name_snapshot}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground text-right hidden sm:table-cell">
                      {formatCents(item.unit_price_cents)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                      {formatCents(item.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-sm font-semibold text-foreground text-right hidden sm:table-cell"
                  >
                    Total commande
                  </td>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-sm font-semibold text-foreground text-right sm:hidden"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-primary text-right">
                    {formatCents(typedOrder.total_cents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Invoice */}
      {typedOrder.invoices && (
        <InfoBlock title="Facture" icon={FileText}>
          <InfoRow label="N° facture" value={typedOrder.invoices.invoice_number} />
          <InfoRow label="Émise le" value={formatDate(typedOrder.invoices.issued_at)} />
          <InfoRow label="Montant" value={formatCents(typedOrder.invoices.amount_cents)} />
          <InfoRow label="Statut" value={typedOrder.invoices.status} />
          {typedOrder.invoices.pdf_url && (
            <div className="mt-3">
              <a
                href={typedOrder.invoices.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <FileText className="w-3.5 h-3.5" />
                Télécharger le PDF
              </a>
            </div>
          )}
        </InfoBlock>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="mt-5 bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Chronologie
          </h2>
          <ol className="relative border-l border-border ml-3 space-y-4">
            {timeline.map((event, idx) => (
              <li key={idx} className="ml-4">
                <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <p className="text-xs font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">
                  {event.date ? formatDate(event.date) : '—'}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {typedOrder.notes && (
        <div className="mt-5 bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{typedOrder.notes}</p>
        </div>
      )}
    </div>
  );
}

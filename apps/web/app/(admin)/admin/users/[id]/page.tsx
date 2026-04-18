import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Building2,
  ShoppingBasket,
  Settings,
  Unlock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents, formatDate, formatDateShort } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type OrderStatus = 'pending' | 'confirmed' | 'prepared' | 'ready_for_pickup' | 'picked_up' | 'canceled';

function orderStatusLabel(status: OrderStatus): string {
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

function orderStatusVariant(
  status: OrderStatus,
): 'default' | 'success' | 'warning' | 'destructive' {
  if (status === 'confirmed' || status === 'picked_up' || status === 'prepared' || status === 'ready_for_pickup')
    return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'canceled') return 'destructive';
  return 'default';
}

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  client: 'default',
  producer: 'success',
  admin: 'warning',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground font-medium text-right">{value}</span>
    </div>
  );
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

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) redirect('/login');

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (currentProfile?.role !== 'admin') redirect('/');

  // Fetch profile with entity
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      display_name,
      phone,
      role,
      entity_id,
      referral_code,
      ordering_blocked_until,
      dietary_preferences,
      notification_channels,
      created_at,
      updated_at,
      entities!profiles_entity_id_fkey(id, name, address, pickup_address)
    `)
    .eq('id', id)
    .single();

  if (error || !profile) {
    notFound();
  }

  type EntityRaw = { id: string; name: string; address: string; pickup_address: string };
  type ProfileRaw = {
    id: string;
    full_name: string | null;
    display_name: string | null;
    phone: string | null;
    role: string;
    entity_id: string | null;
    referral_code: string | null;
    ordering_blocked_until: string | null;
    dietary_preferences: Record<string, unknown>;
    notification_channels: { email?: boolean; push?: boolean; whatsapp?: boolean };
    created_at: string;
    updated_at: string;
    entities: EntityRaw | null;
  };

  const typedProfile = profile as unknown as ProfileRaw;
  const now = new Date().toISOString();
  const isBlocked = !!(
    typedProfile.ordering_blocked_until && typedProfile.ordering_blocked_until > now
  );

  // Count orders and total spent
  const { data: orderStats } = await supabase
    .from('orders')
    .select('id, total_cents, status')
    .eq('client_id', id);

  const orderCount = orderStats?.length ?? 0;
  const totalSpentCents = (orderStats ?? [])
    .filter((o) => o.status !== 'canceled')
    .reduce((sum, o) => sum + (o.total_cents ?? 0), 0);

  // Count overdue payments
  const orderIds = (orderStats ?? []).map((o) => o.id);
  let overdueCount = 0;
  if (orderIds.length > 0) {
    const { count } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .in('order_id', orderIds)
      .eq('status', 'overdue');
    overdueCount = count ?? 0;
  }

  // Last 10 orders
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_cents, placed_at')
    .eq('client_id', id)
    .order('placed_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back */}
      <div className="mb-6">
        <Link href="/admin/users">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Retour aux utilisateurs
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Utilisateur
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {typedProfile.full_name ?? typedProfile.display_name ?? 'Sans nom'}
          </h1>
        </div>
        <Badge variant={roleVariant[typedProfile.role] ?? 'default'}>{typedProfile.role}</Badge>
        {isBlocked && <Badge variant="destructive">Bloqué</Badge>}
      </div>

      {/* Unblock action */}
      {isBlocked && (
        <form
          action={`/api/users/unblock`}
          method="POST"
          className="mb-6 flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-2xl"
        >
          <input type="hidden" name="user_id" value={id} />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Client bloqué</p>
            <p className="text-xs text-muted-foreground">
              Bloqué jusqu&apos;au {formatDate(typedProfile.ordering_blocked_until!)}
            </p>
          </div>
          <Button type="submit" size="sm" variant="secondary" className="gap-1.5">
            <Unlock className="w-3.5 h-3.5" />
            Débloquer
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Identité */}
        <InfoBlock title="Identité" icon={User}>
          <InfoRow label="Nom complet" value={typedProfile.full_name ?? '—'} />
          <InfoRow label="Nom affiché" value={typedProfile.display_name ?? '—'} />
          <InfoRow label="Téléphone" value={typedProfile.phone ?? '—'} />
          <InfoRow label="Code parrainage" value={typedProfile.referral_code ?? '—'} />
          <InfoRow label="Inscrit le" value={formatDate(typedProfile.created_at)} />
        </InfoBlock>

        {/* Entité */}
        {typedProfile.entities && (
          <InfoBlock title="Entité de rattachement" icon={Building2}>
            <InfoRow label="Nom" value={typedProfile.entities.name} />
            <InfoRow label="Adresse" value={typedProfile.entities.address} />
            <InfoRow label="Retrait" value={typedProfile.entities.pickup_address} />
            <div className="mt-3">
              <Link
                href={`/admin/entities/${typedProfile.entity_id}`}
                className="text-xs text-primary hover:underline"
              >
                Voir la fiche entité →
              </Link>
            </div>
          </InfoBlock>
        )}

        {/* Stats */}
        <InfoBlock title="Statistiques" icon={ShoppingBasket}>
          <InfoRow label="Commandes passées" value={String(orderCount)} />
          <InfoRow label="Total dépensé" value={formatCents(totalSpentCents)} />
          {overdueCount > 0 && (
            <InfoRow
              label="Paiements en retard"
              value={<span className="text-destructive font-semibold">{overdueCount}</span>}
            />
          )}
        </InfoBlock>

        {/* Préférences */}
        <InfoBlock title="Préférences" icon={Settings}>
          <InfoRow
            label="Email"
            value={typedProfile.notification_channels.email ? 'Activé' : 'Désactivé'}
          />
          <InfoRow
            label="Push"
            value={typedProfile.notification_channels.push ? 'Activé' : 'Désactivé'}
          />
          <InfoRow
            label="WhatsApp"
            value={typedProfile.notification_channels.whatsapp ? 'Activé' : 'Désactivé'}
          />
          {Object.keys(typedProfile.dietary_preferences).length > 0 && (
            <InfoRow
              label="Allergies / préférences"
              value={JSON.stringify(typedProfile.dietary_preferences)}
            />
          )}
        </InfoBlock>
      </div>

      {/* Historique commandes */}
      <div className="bg-background/50 dark:bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShoppingBasket className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">10 dernières commandes</h2>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Aucune commande.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    N° commande
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {formatDateShort(order.placed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusVariant(order.status as OrderStatus)}>
                        {orderStatusLabel(order.status as OrderStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground text-right">
                      {formatCents(order.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button type="button" size="sm" variant="ghost">
                          Détails
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

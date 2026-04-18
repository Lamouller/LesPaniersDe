'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  CreditCard,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents, formatDateShort } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ReconcilePaymentModal, type ReconcileTarget } from '@/components/admin/ReconcilePaymentModal';

type FilterStatus = 'pending' | 'overdue' | 'paid' | 'all';

interface ReconciliationRow {
  payment_id: string;
  payment_status: string;
  amount_cents: number;
  due_at: string | null;
  method: string | null;
  payment_reference: string | null;
  order_id: string;
  order_number: string;
  placed_at: string;
  client_name: string;
  client_phone: string | null;
  entity_name: string;
  producer_name: string;
  reminders_sent: number;
  client_id: string;
  is_client_blocked: boolean;
}

interface Producer {
  id: string;
  name: string;
}

interface EntityItem {
  id: string;
  name: string;
}

function ageDays(due_at: string | null): number {
  if (!due_at) return 0;
  const diff = Date.now() - new Date(due_at).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'overdue') return <Badge variant="destructive">En retard</Badge>;
  if (status === 'pending') return <Badge variant="warning">En attente</Badge>;
  if (status === 'paid') return <Badge variant="success">Payé</Badge>;
  return <Badge>{status}</Badge>;
}

export default function AdminSalesPage() {
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterProducer, setFilterProducer] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [reconcileTarget, setReconcileTarget] = useState<ReconcileTarget | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const supabase = createClient();

  const loadFilters = useCallback(async () => {
    const [{ data: prodData }, { data: entData }] = await Promise.all([
      supabase.from('producers').select('id, name').eq('is_active', true),
      supabase.from('entities').select('id, name').eq('is_active', true),
    ]);
    setProducers(prodData ?? []);
    setEntities(entData ?? []);
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Pending + overdue from view
    const { data: viewData } = await supabase
      .from('v_admin_reconciliation')
      .select('payment_id, payment_status, amount_cents, due_at, method, payment_reference, order_id, order_number, placed_at, client_name, client_phone, entity_name, producer_name, reminders_sent');

    let allRows: ReconciliationRow[] = (viewData ?? []).map((r) => ({
      ...r,
      client_id: '',
      is_client_blocked: false,
    }));

    // For paid rows, query payments + joins
    if (filterStatus === 'paid' || filterStatus === 'all') {
      type PaidPayment = {
        id: string;
        status: string;
        amount_cents: number;
        due_at: string | null;
        method: string | null;
        payment_reference: string | null;
        order_id: string;
        reconciled_at: string | null;
        orders: {
          order_number: string;
          placed_at: string;
          client_id: string;
          profiles: { full_name: string | null; phone: string | null; ordering_blocked_until: string | null } | null;
          entities: { name: string } | null;
          producers: { name: string } | null;
        } | null;
      };

      let paidQuery = supabase
        .from('payments')
        .select(`
          id, status, amount_cents, due_at, method, payment_reference, order_id, reconciled_at,
          orders!inner(
            order_number, placed_at, client_id,
            profiles!orders_client_id_fkey(full_name, phone, ordering_blocked_until),
            entities!orders_entity_id_fkey(name),
            producers!orders_producer_id_fkey(name)
          )
        `)
        .eq('status', 'paid');

      if (filterFrom) paidQuery = paidQuery.gte('reconciled_at', filterFrom);
      if (filterTo) paidQuery = paidQuery.lte('reconciled_at', filterTo + 'T23:59:59Z');

      const { data: paidData } = await paidQuery;
      const now = new Date().toISOString();

      const paidRows: ReconciliationRow[] = ((paidData ?? []) as unknown as PaidPayment[]).map((p) => {
        const order = p.orders;
        return {
          payment_id: p.id,
          payment_status: p.status,
          amount_cents: p.amount_cents,
          due_at: p.due_at,
          method: p.method,
          payment_reference: p.payment_reference,
          order_id: p.order_id,
          order_number: order?.order_number ?? '—',
          placed_at: order?.placed_at ?? '',
          client_name: order?.profiles?.full_name ?? '—',
          client_phone: order?.profiles?.phone ?? null,
          entity_name: order?.entities?.name ?? '—',
          producer_name: order?.producers?.name ?? '—',
          reminders_sent: 0,
          client_id: order?.client_id ?? '',
          is_client_blocked: !!(order?.profiles?.ordering_blocked_until && order.profiles.ordering_blocked_until > now),
        };
      });

      allRows = filterStatus === 'paid' ? paidRows : [...allRows, ...paidRows];
    }

    // Enrich view rows with client_id + blocking status
    // Get client_ids from orders for view rows
    const orderIds = allRows.filter((r) => !r.client_id).map((r) => r.order_id);
    if (orderIds.length > 0) {
      const { data: orderClientData } = await supabase
        .from('orders')
        .select('id, client_id')
        .in('id', orderIds);

      const orderMap = new Map((orderClientData ?? []).map((o) => [o.id, o.client_id as string]));
      allRows = allRows.map((r) => ({
        ...r,
        client_id: r.client_id || orderMap.get(r.order_id) || '',
      }));
    }

    // Fetch blocking status for all clients
    const clientIds = [...new Set(allRows.map((r) => r.client_id).filter(Boolean))];
    if (clientIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, ordering_blocked_until')
        .in('id', clientIds);

      const now = new Date().toISOString();
      const blockMap = new Map(
        (profileData ?? []).map((p) => [
          p.id,
          !!(p.ordering_blocked_until && p.ordering_blocked_until > now),
        ])
      );
      allRows = allRows.map((r) => ({
        ...r,
        is_client_blocked: r.client_id ? (blockMap.get(r.client_id) ?? r.is_client_blocked) : r.is_client_blocked,
      }));
    }

    // Apply status filter
    if (filterStatus !== 'all' && filterStatus !== 'paid') {
      allRows = allRows.filter((r) => r.payment_status === filterStatus);
    }

    // Apply producer / entity filters by name
    if (filterProducer) {
      const pName = producers.find((p) => p.id === filterProducer)?.name;
      if (pName) allRows = allRows.filter((r) => r.producer_name === pName);
    }
    if (filterEntity) {
      const eName = entities.find((e) => e.id === filterEntity)?.name;
      if (eName) allRows = allRows.filter((r) => r.entity_name === eName);
    }

    // Sort: overdue → pending (due_at asc) → paid
    const statusOrder: Record<string, number> = { overdue: 0, pending: 1, paid: 2 };
    allRows.sort((a, b) => {
      const oa = statusOrder[a.payment_status] ?? 9;
      const ob = statusOrder[b.payment_status] ?? 9;
      if (oa !== ob) return oa - ob;
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    setRows(allRows);
    setLoading(false);
  }, [filterStatus, filterProducer, filterEntity, filterFrom, filterTo, supabase, producers, entities]);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRemind(paymentId: string) {
    setRemindingId(paymentId);
    try {
      await fetch('/api/payments/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      void loadData();
    } finally {
      setRemindingId(null);
    }
  }

  function handleReconcileSuccess(paymentId: string) {
    setReconcileTarget(null);
    setRows((prev) => prev.filter((r) => r.payment_id !== paymentId));
    void loadData();
  }

  const overdueCount = rows.filter((r) => r.payment_status === 'overdue').length;
  const pendingCount = rows.filter((r) => r.payment_status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">Admin</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Rapprochement bancaire</h1>
      </div>

      {/* Summary chips */}
      {(overdueCount > 0 || pendingCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueCount} en retard
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {pendingCount} en attente
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
        >
          <option value="pending">En attente + retard</option>
          <option value="overdue">En retard seulement</option>
          <option value="paid">Payés</option>
          <option value="all">Tous</option>
        </select>

        <select
          value={filterProducer}
          onChange={(e) => setFilterProducer(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
        >
          <option value="">Tous producteurs</option>
          {producers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
        >
          <option value="">Toutes entités</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30"
        />
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">Chargement...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-neutral-400">Aucun paiement pour ces filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">N° commande</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Producteur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Entité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Échéance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Âge</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => {
                  const days = ageDays(row.due_at);
                  return (
                    <tr key={row.payment_id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-neutral-400">{row.order_number}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200 font-medium">
                        {row.client_name}
                        {row.is_client_blocked && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">bloqué</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-400 hidden lg:table-cell">{row.producer_name}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">{row.entity_name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-neutral-200">{formatCents(row.amount_cents)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">
                        {row.due_at ? formatDateShort(row.due_at) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {row.due_at && row.payment_status !== 'paid' ? (
                          <span className={`text-xs font-medium ${days > 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                            {days > 0 ? `+${days}j` : `${Math.abs(days)}j`}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.payment_status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {row.payment_status !== 'paid' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                setReconcileTarget({
                                  payment_id: row.payment_id,
                                  order_number: row.order_number,
                                  client_name: row.client_name,
                                  amount_cents: row.amount_cents,
                                  client_id: row.client_id,
                                  is_client_blocked: row.is_client_blocked,
                                })
                              }
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pointer
                            </Button>
                          )}
                          <Link href={`/admin/orders/${row.order_id}`}>
                            <Button type="button" size="sm" variant="ghost">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          {row.payment_status === 'overdue' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={remindingId === row.payment_id}
                              onClick={() => handleRemind(row.payment_id)}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {remindingId === row.payment_id ? '...' : 'Relancer'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReconcilePaymentModal
        target={reconcileTarget}
        onClose={() => setReconcileTarget(null)}
        onSuccess={handleReconcileSuccess}
      />
    </div>
  );
}

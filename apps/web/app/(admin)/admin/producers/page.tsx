'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tractor, Plus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatCents } from '@/lib/utils';
import Link from 'next/link';
import { ViewAsButton } from '@/components/admin/ViewAsButton';

interface ProducerRow {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  whatsapp_enabled: boolean;
  is_active: boolean;
  payment_reminder_days: number;
  entity_count: number;
  order_count: number;
  revenue_cents: number;
}

export default function AdminProducersPage() {
  const [producers, setProducers] = useState<ProducerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: prodData } = await supabase
      .from('producers')
      .select('id, name, slug, contact_email, whatsapp_enabled, is_active, payment_reminder_days')
      .order('name', { ascending: true });

    const producerIds = (prodData ?? []).map((p) => p.id);

    // Entity count per producer
    const { data: peData } = await supabase
      .from('producer_entities')
      .select('producer_id')
      .in('producer_id', producerIds)
      .eq('is_active', true);

    const entityCountMap = new Map<string, number>();
    (peData ?? []).forEach((pe) => {
      entityCountMap.set(pe.producer_id, (entityCountMap.get(pe.producer_id) ?? 0) + 1);
    });

    // Orders this week
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    const { data: orderData } = await supabase
      .from('orders')
      .select('producer_id, total_cents')
      .in('producer_id', producerIds)
      .gte('placed_at', weekStart.toISOString())
      .not('status', 'eq', 'canceled');

    const orderCountMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    (orderData ?? []).forEach((o) => {
      orderCountMap.set(o.producer_id, (orderCountMap.get(o.producer_id) ?? 0) + 1);
      revenueMap.set(o.producer_id, (revenueMap.get(o.producer_id) ?? 0) + (o.total_cents ?? 0));
    });

    const rows: ProducerRow[] = (prodData ?? []).map((p) => ({
      ...p,
      entity_count: entityCountMap.get(p.id) ?? 0,
      order_count: orderCountMap.get(p.id) ?? 0,
      revenue_cents: revenueMap.get(p.id) ?? 0,
    }));

    setProducers(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Tractor className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Producteurs</h1>
            <p className="text-sm text-neutral-500">{producers.length} producteurs</p>
          </div>
        </div>
        <Link href="/admin/producers/new">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Créer
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-neutral-500">Chargement...</div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Entités</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Cmds S.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">CA S.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {producers.map((producer) => (
                <tr key={producer.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-neutral-200">{producer.name}</p>
                    <p className="text-xs text-neutral-600 font-mono">{producer.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">
                    {producer.contact_email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400 hidden lg:table-cell">
                    {producer.entity_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400 hidden md:table-cell">
                    {producer.order_count}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-200 hidden lg:table-cell">
                    {producer.revenue_cents > 0 ? formatCents(producer.revenue_cents) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant={producer.is_active ? 'success' : 'default'}>
                        {producer.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                      {producer.whatsapp_enabled && (
                        <Badge variant="success">WhatsApp</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ViewAsButton producerId={producer.id} />
                      <Link href={`/admin/producers/${producer.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

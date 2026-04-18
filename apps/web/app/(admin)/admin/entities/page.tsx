'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface EntityRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  pickup_address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  member_count: number;
}

export default function AdminEntitiesPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: entData } = await supabase
      .from('entities')
      .select('id, name, slug, address, pickup_address, contact_email, contact_phone, is_active')
      .order('name', { ascending: true });

    // Member count per entity
    const { data: profileCounts } = await supabase
      .from('profiles')
      .select('entity_id')
      .not('entity_id', 'is', null);

    const countMap = new Map<string, number>();
    (profileCounts ?? []).forEach((p) => {
      if (p.entity_id) {
        countMap.set(p.entity_id, (countMap.get(p.entity_id) ?? 0) + 1);
      }
    });

    const rows: EntityRow[] = (entData ?? []).map((e) => ({
      ...e,
      member_count: countMap.get(e.id) ?? 0,
    }));

    setEntities(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Entités</h1>
            <p className="text-sm text-neutral-500">{entities.length} points de retrait</p>
          </div>
        </div>
        <Link href="/admin/entities/new">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Adresse</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Membres</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entities.map((entity) => (
                <tr key={entity.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-neutral-200">{entity.name}</p>
                    <p className="text-xs text-neutral-600 font-mono">{entity.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">
                    {entity.pickup_address ?? entity.address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500 hidden lg:table-cell">
                    {entity.contact_email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400 hidden md:table-cell">
                    {entity.member_count}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={entity.is_active ? 'success' : 'default'}>
                      {entity.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/entities/${entity.id}`}>
                      <Button type="button" size="sm" variant="secondary">
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
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
  );
}

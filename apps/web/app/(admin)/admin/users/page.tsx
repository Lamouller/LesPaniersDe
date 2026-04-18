'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatDateShort } from '@/lib/utils';
import Link from 'next/link';

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string;
  entity_id: string | null;
  entity_name: string | null;
  ordering_blocked_until: string | null;
  created_at: string;
  order_count: number;
}

type FilterRole = 'all' | 'client' | 'producer' | 'admin';

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  client: 'default',
  producer: 'success',
  admin: 'warning',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterBlocked, setFilterBlocked] = useState(false);
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const [{ data: entData }] = await Promise.all([
      supabase.from('entities').select('id, name').eq('is_active', true),
    ]);
    setEntities(entData ?? []);

    // Build profiles query with entity join
    let query = supabase
      .from('profiles')
      .select(`
        id, full_name, role, entity_id, ordering_blocked_until, created_at,
        entities!profiles_entity_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterRole !== 'all') query = query.eq('role', filterRole);
    if (filterEntity) query = query.eq('entity_id', filterEntity);
    if (filterBlocked) query = query.gt('ordering_blocked_until', new Date().toISOString());

    const { data: profileData } = await query;

    // Get order counts per user
    const userIds = (profileData ?? []).map((p) => p.id);
    const { data: orderData } = await supabase
      .from('orders')
      .select('client_id')
      .in('client_id', userIds);

    const orderCountMap = new Map<string, number>();
    (orderData ?? []).forEach((o) => {
      const count = orderCountMap.get(o.client_id) ?? 0;
      orderCountMap.set(o.client_id, count + 1);
    });

    type RawProfile = {
      id: string;
      full_name: string | null;
      role: string;
      entity_id: string | null;
      ordering_blocked_until: string | null;
      created_at: string;
      entities: { name: string } | null;
    };

    const rows: ProfileRow[] = ((profileData ?? []) as unknown as RawProfile[]).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
      entity_id: p.entity_id,
      entity_name: p.entities?.name ?? null,
      ordering_blocked_until: p.ordering_blocked_until,
      created_at: p.created_at,
      order_count: orderCountMap.get(p.id) ?? 0,
    }));

    setUsers(rows);
    setLoading(false);
  }, [supabase, filterRole, filterEntity, filterBlocked, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleUnblock(userId: string) {
    setUnblockingId(userId);
    try {
      await fetch('/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      void loadData();
    } finally {
      setUnblockingId(null);
    }
  }

  const now = new Date().toISOString();
  const isBlocked = (u: ProfileRow) =>
    !!(u.ordering_blocked_until && u.ordering_blocked_until > now);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-neutral-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Utilisateurs</h1>
          <p className="text-sm text-neutral-500">{users.length} résultats</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value as FilterRole); setPage(0); }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
        >
          <option value="all">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="producer">Producteurs</option>
          <option value="admin">Admins</option>
        </select>

        <select
          value={filterEntity}
          onChange={(e) => { setFilterEntity(e.target.value); setPage(0); }}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
        >
          <option value="">Toutes entités</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-400 cursor-pointer hover:border-white/20 transition-colors">
          <input
            type="checkbox"
            checked={filterBlocked}
            onChange={(e) => { setFilterBlocked(e.target.checked); setPage(0); }}
            className="w-3.5 h-3.5 accent-white cursor-pointer"
          />
          Bloqués uniquement
        </label>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">Chargement...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Rôle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Entité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Commandes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Inscrit le</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-200 font-medium">
                        {user.full_name ?? <span className="text-neutral-600 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleVariant[user.role] ?? 'default'}>{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">
                        {user.entity_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-400 hidden lg:table-cell">
                        {user.order_count}
                      </td>
                      <td className="px-4 py-3">
                        {isBlocked(user) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                            bloqué jusqu&apos;au {formatDateShort(user.ordering_blocked_until!)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">actif</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">
                        {formatDateShort(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isBlocked(user) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={unblockingId === user.id}
                              onClick={() => handleUnblock(user.id)}
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              {unblockingId === user.id ? '...' : 'Débloquer'}
                            </Button>
                          )}
                          <Link href={`/admin/users/${user.id}`}>
                            <Button type="button" size="sm" variant="ghost">Détails</Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
              <p className="text-xs text-neutral-600">{users.length} résultats</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Précédent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={users.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

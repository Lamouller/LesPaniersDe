import React from 'react';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Placeholder
const USERS = [
  { id: '1', name: 'Marie Dupont', email: 'marie@exemple.fr', role: 'client', entity: 'Open Space du Centre', created: '2025-03-01' },
  { id: '2', name: 'Jean Martin', email: 'jean@exemple.fr', role: 'client', entity: 'Coworking Nord', created: '2025-03-15' },
  { id: '3', name: 'Alice Ferme', email: 'alice@ferme.fr', role: 'producer', entity: '—', created: '2025-02-01' },
  { id: '4', name: 'Admin Système', email: 'admin@lespaniersde.fr', role: 'admin', entity: '—', created: '2025-01-01' },
];

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  client: 'default',
  producer: 'success',
  admin: 'warning',
};

export default function AdminUsersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Users className="w-5 h-5 text-neutral-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Utilisateurs</h1>
          <p className="text-sm text-neutral-500">{USERS.length} utilisateurs</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">E-mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Entité</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {USERS.map((user) => (
              <tr key={user.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3 text-sm text-neutral-200 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-sm text-neutral-400 hidden md:table-cell">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={roleVariant[user.role] ?? 'default'}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-500 hidden lg:table-cell">{user.entity}</td>
                <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">{user.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

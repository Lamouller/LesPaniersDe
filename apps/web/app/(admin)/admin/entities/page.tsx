import React from 'react';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ENTITIES = [
  { id: '1', name: 'Open Space du Centre', city: 'Lyon 2e', address: '12 rue des Entrepreneurs', members: 18, active: true },
  { id: '2', name: 'Coworking Nord', city: 'Lyon 4e', address: '45 avenue des Travailleurs', members: 12, active: true },
  { id: '3', name: 'Bureau Confluence', city: 'Lyon 2e', address: '8 place Nautique', members: 6, active: false },
];

export default function AdminEntitiesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Entités</h1>
            <p className="text-sm text-neutral-500">{ENTITIES.length} points de retrait</p>
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ENTITIES.map((entity) => (
          <div
            key={entity.id}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-white/15 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-neutral-400" />
              </div>
              <Badge variant={entity.active ? 'success' : 'default'}>
                {entity.active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-neutral-50 mb-1">{entity.name}</h3>
            <p className="text-xs text-neutral-500 mb-3">{entity.address} — {entity.city}</p>
            <p className="text-xs text-neutral-600">{entity.members} membres inscrits</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="ghost" className="flex-1">Modifier</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { Tractor, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PRODUCERS = [
  { id: '1', name: 'La Ferme des Collines', description: 'Légumes BIO, fruits de saison', whatsapp: true, active: true },
  { id: '2', name: 'Les Oeufs du Moulin', description: 'Oeufs fermiers, volailles', whatsapp: false, active: true },
];

export default function AdminProducersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Tractor className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Producteurs</h1>
            <p className="text-sm text-neutral-500">{PRODUCERS.length} producteurs</p>
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRODUCERS.map((producer) => (
          <div
            key={producer.id}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Tractor className="w-5 h-5 text-neutral-400" />
              </div>
              <div className="flex gap-2">
                {producer.whatsapp && <Badge variant="success">WhatsApp</Badge>}
                <Badge variant={producer.active ? 'success' : 'default'}>
                  {producer.active ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
            <h3 className="text-base font-semibold text-neutral-50 mb-1">{producer.name}</h3>
            <p className="text-sm text-neutral-500 mb-4">{producer.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1">Modifier</Button>
              <Button size="sm" variant="ghost">Voir catalogue</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

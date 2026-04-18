'use client';

import React from 'react';
import { Truck, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface DeliveryItem {
  id: string;
  week_start: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  producer_name: string;
  entity_name: string;
  eta_minutes?: number;
}

// Placeholder data
const DELIVERIES: DeliveryItem[] = [
  {
    id: 'del_1',
    week_start: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_progress',
    producer_name: 'La Ferme des Collines',
    entity_name: 'Open Space du Centre',
    eta_minutes: 10,
  },
  {
    id: 'del_2',
    week_start: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    producer_name: 'La Ferme des Collines',
    entity_name: 'Open Space du Centre',
  },
  {
    id: 'del_3',
    week_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    producer_name: 'La Ferme des Collines',
    entity_name: 'Open Space du Centre',
  },
];

function LiveMapPlaceholder({ eta }: { eta?: number }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] h-48 flex flex-col items-center justify-center gap-2 text-neutral-600">
      <MapPin className="w-8 h-8" />
      <p className="text-sm font-medium">Carte en direct (Leaflet)</p>
      <p className="text-xs">
        {eta ? `Arrive dans environ ${eta} min` : 'Localisation en cours...'}
      </p>
      <p className="text-[10px] text-neutral-700 mt-1">
        Phase 2 — Intégration Leaflet + Supabase Realtime
      </p>
    </div>
  );
}

export default function DeliveriesPage() {
  const inProgress = DELIVERIES.find((d) => d.status === 'in_progress');
  const upcoming = DELIVERIES.filter((d) => d.status === 'scheduled');
  const completed = DELIVERIES.filter((d) => d.status === 'completed');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Retraits</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Mes livraisons</h1>
      </div>

      {/* En cours */}
      {inProgress && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-300">
                <Truck className="w-4 h-4 animate-pulse" />
                Livraison en cours
              </CardTitle>
              <Badge variant="success">En route</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-300 mb-1">{inProgress.producer_name}</p>
            <p className="text-xs text-neutral-500">→ {inProgress.entity_name}</p>
            {inProgress.eta_minutes && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <Clock className="w-4 h-4 text-green-400" />
                <p className="text-sm text-green-400">
                  Arrive dans environ <strong>{inProgress.eta_minutes} min</strong>
                </p>
              </div>
            )}
            <LiveMapPlaceholder eta={inProgress.eta_minutes} />
          </CardContent>
        </Card>
      )}

      {/* A venir */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 mb-3">À venir</h2>
          <div className="space-y-3">
            {upcoming.map((d) => (
              <Card key={d.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-200">{d.producer_name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatDate(d.week_start)} · {d.entity_name}
                      </p>
                    </div>
                    <Badge variant="default">Planifié</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Terminés */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 mb-3">Historique</h2>
          <div className="space-y-3">
            {completed.map((d) => (
              <Card key={d.id} className="opacity-70">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-300">{d.producer_name}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {formatDate(d.week_start)} · {d.entity_name}
                      </p>
                    </div>
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Livré
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

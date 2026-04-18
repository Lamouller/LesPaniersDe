'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, Play, Loader2, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EntityStop {
  id: string;
  name: string;
  address: string;
  orders: number;
  lat: number;
  lng: number;
}

const ENTITIES: EntityStop[] = [
  { id: '1', name: 'Open Space du Centre', address: '12 rue des Entrepreneurs, Lyon 2e', orders: 28, lat: 45.7481, lng: 4.8312 },
  { id: '2', name: 'Coworking Nord', address: '45 avenue des Travailleurs, Lyon 4e', orders: 19, lat: 45.7722, lng: 4.8338 },
];

interface RouteClientProps {
  readOnly: boolean;
}

export function RouteClient({ readOnly }: RouteClientProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);

  async function handleOptimize() {
    if (readOnly) return;
    setOptimizing(true);
    // TODO: POST /api/route/optimize { entity_ids: ENTITIES.map(e => e.id) }
    await new Promise((r) => setTimeout(r, 1500));
    setOptimized(true);
    setOptimizing(false);
  }

  async function handleStartTour() {
    if (readOnly) return;
    setStarting(true);
    // TODO: POST /api/deliveries (créer delivery record) + activer broadcast GPS
    await new Promise((r) => setTimeout(r, 800));
    setStarted(true);
    setStarting(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Route className="w-5 h-5 text-neutral-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Optimisation de tournée</h1>
          <p className="text-sm text-neutral-500">Vendredi · {ENTITIES.length} arrêts · {ENTITIES.reduce((a, e) => a + e.orders, 0)} commandes</p>
        </div>
      </div>

      {/* Arrêts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arrêts de la semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ENTITIES.map((entity, idx) => (
              <div key={entity.id} className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-neutral-400">
                  {optimized ? idx + 1 : '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-200">{entity.name}</p>
                  <p className="text-xs text-neutral-600">{entity.address}</p>
                </div>
                <Badge variant="default">{entity.orders} cdes</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Carte placeholder */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] h-64 flex flex-col items-center justify-center gap-2 text-neutral-600">
        <MapPin className="w-8 h-8" />
        <p className="text-sm font-medium">Carte de tournée (Leaflet + OSRM)</p>
        <p className="text-xs text-center max-w-xs">
          Affiche la route optimisée après calcul OSRM. Phase 2.
        </p>
      </div>

      {/* Actions — cachées en mode lecture seule */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={() => { void handleOptimize(); }}
            disabled={optimizing || started}
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto gap-2"
            type="button"
          >
            {optimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Optimiser avec OSRM
              </>
            )}
          </Button>

          <Button
            onClick={() => { void handleStartTour(); }}
            disabled={!optimized || starting || started}
            size="lg"
            className="w-full sm:w-auto gap-2"
            type="button"
          >
            {starting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Démarrage...
              </>
            ) : started ? (
              <>
                <MapPin className="w-4 h-4" />
                Tournée en cours
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Démarrer la tournée
              </>
            )}
          </Button>
        </div>
      )}

      {started && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
          GPS activé — les clients voient votre position en temps réel.
        </div>
      )}
    </div>
  );
}

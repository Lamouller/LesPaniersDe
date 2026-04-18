'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Navigation, Play, Loader2, Route, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Waypoint, OptimizeResult } from '@/components/producer/RouteMap';

// Leaflet is client-only — no SSR
const RouteMap = dynamic(
  () => import('@/components/producer/RouteMap').then((m) => m.RouteMap),
  { ssr: false, loading: () => (
    <div className="rounded-2xl overflow-hidden border border-border bg-muted/20 h-72 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )},
);

interface EntityStop extends Waypoint {
  id: string;
  address: string;
  orders: number;
}

interface RouteClientProps {
  readOnly: boolean;
  initialEntities: EntityStop[];
}

export function RouteClient({ readOnly, initialEntities }: RouteClientProps) {
  const [entities, setEntities] = useState<EntityStop[]>(initialEntities);
  const [optimizedOrder, setOptimizedOrder] = useState<number[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);

  const waypoints: Waypoint[] = entities.map((e) => ({ lat: e.lat, lng: e.lng, name: e.name }));

  async function handleOptimize(): Promise<OptimizeResult> {
    const body = { waypoints: entities.map((e) => [e.lng, e.lat]) };
    const res = await fetch('/api/route/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_ids: entities.map((e) => e.id) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Erreur OSRM');
    }

    const data = (await res.json()) as {
      ok: boolean;
      order: Array<{ id: string; stop: number }>;
      polyline: [number, number][];
      total_distance_m: number;
      total_duration_s: number;
    };

    // Reorder entities display
    const orderMap = new Map(data.order.map((o) => [o.id, o.stop]));
    const reordered = [...entities].sort(
      (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99),
    );
    setEntities(reordered);
    setOptimizedOrder(data.order.map((o) => o.stop - 1));

    return {
      order: data.order.map((o) => o.stop - 1),
      distance_m: data.total_distance_m,
      duration_s: data.total_duration_s,
      polyline: data.polyline,
    };
  }

  async function handleStartTour() {
    if (readOnly) return;
    setStarting(true);
    // TODO: POST /api/deliveries + activer broadcast GPS
    await new Promise<void>((r) => setTimeout(r, 800));
    setStarted(true);
    setStarting(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Route className="w-5 h-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Optimisation de tournée
          </h1>
          <p className="text-sm text-muted-foreground">
            {entities.length} arrêt{entities.length > 1 ? 's' : ''} ·{' '}
            {entities.reduce((a, e) => a + e.orders, 0)} commandes
          </p>
        </div>
      </div>

      {/* Arrêts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arrêts de la semaine</CardTitle>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun arrêt configuré pour cette semaine.
            </p>
          ) : (
            <div className="space-y-3">
              {entities.map((entity, idx) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 p-3 bg-background/30 dark:bg-white/[0.02] border border-border rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {optimizedOrder ? idx + 1 : '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{entity.name}</p>
                    <p className="text-xs text-muted-foreground">{entity.address}</p>
                  </div>
                  <Badge variant="default">{entity.orders} cdes</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carte Leaflet */}
      {waypoints.length > 0 ? (
        <RouteMap
          waypoints={waypoints}
          readOnly={readOnly}
          onOptimize={readOnly ? undefined : handleOptimize}
        />
      ) : (
        <div className="rounded-2xl overflow-hidden border border-border bg-muted/20 h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="w-8 h-8" />
          <p className="text-sm font-medium">Aucun point GPS disponible</p>
          <p className="text-xs text-center max-w-xs">
            Configurez les coordonnées des entités pour afficher la carte.
          </p>
        </div>
      )}

      {/* Démarrer la tournée */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            type="button"
            onClick={() => { void handleStartTour(); }}
            disabled={!optimizedOrder || starting || started}
            size="lg"
            className="w-full sm:w-auto gap-2"
          >
            {starting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Démarrage…
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
        <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary">
          GPS activé — les clients voient votre position en temps réel.
        </div>
      )}
    </div>
  );
}

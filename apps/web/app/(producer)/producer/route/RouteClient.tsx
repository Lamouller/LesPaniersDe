'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Play, Loader2, Route, MapPin, Fuel, Leaf, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Waypoint, OptimizeResult } from '@/components/producer/RouteMap';
import { calculateRouteEconomics, fuelTypeLabel } from '@/lib/economics/fuel';
import type { VehicleConfig, RouteEconomics } from '@/lib/economics/fuel';

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
  vehicleConfig: VehicleConfig | null;
}

export function RouteClient({ readOnly, initialEntities, vehicleConfig }: RouteClientProps) {
  const router = useRouter();
  const [entities, setEntities] = useState<EntityStop[]>(initialEntities);
  const [optimizedOrder, setOptimizedOrder] = useState<number[] | null>(null);
  const [starting, setStarting] = useState(false);
  const started = false; // Navigation is handled on the navigate page
  const [economics, setEconomics] = useState<RouteEconomics | null>(null);
  const [routeDistanceM, setRouteDistanceM] = useState<number | null>(null);
  const [routeDurationS, setRouteDurationS] = useState<number | null>(null);

  const waypoints: Waypoint[] = entities.map((e) => ({ lat: e.lat, lng: e.lng, name: e.name }));

  async function handleOptimize(): Promise<OptimizeResult> {
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
    setRouteDistanceM(data.total_distance_m);
    setRouteDurationS(data.total_duration_s);

    // Calcul économies carburant
    if (vehicleConfig && data.total_distance_m > 0) {
      const eco = calculateRouteEconomics(data.total_distance_m, vehicleConfig);
      setEconomics(eco);
    }

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
    // Navigate to the GPS navigation page
    router.push('/producer/route/navigate');
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

      {/* Impact carburant + CO₂ */}
      {economics && routeDistanceM !== null && routeDurationS !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              Impact de la tournée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Résumé distance + durée */}
            <p className="text-sm text-muted-foreground">
              Tournée optimisée :{' '}
              <span className="font-semibold text-foreground">
                {Math.round(routeDistanceM / 1000)} km
              </span>{' '}
              ·{' '}
              <span className="font-semibold text-foreground">
                {Math.round(routeDurationS / 60)} min
              </span>
            </p>

            {economics.warning ? (
              <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Fuel className="w-4 h-4 flex-shrink-0" />
                {economics.warning}{' '}
                <Link href="/producer/settings" className="underline font-medium">
                  Paramètres
                </Link>
              </div>
            ) : (
              <>
                {/* Carburant + coût + CO₂ */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                    <Fuel className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {economics.fuel_units} {economics.fuel_unit_label}{' '}
                      {vehicleConfig ? fuelTypeLabel(vehicleConfig.fuel_type) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                    <span className="text-sm font-semibold text-foreground">
                      {economics.cost_eur.toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Leaf className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-foreground">
                      {economics.co2_kg} kg CO₂
                    </span>
                  </div>
                </div>

                {/* Économies vs naïf */}
                {economics.vs_naive.savings_eur > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-green-500/5 border border-green-500/10 rounded-xl">
                    <TrendingDown className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      Économie vs trajet non optimisé :{' '}
                      <span className="font-semibold text-green-500">
                        {economics.vs_naive.savings_eur.toFixed(2).replace('.', ',')} €
                      </span>{' '}
                      ·{' '}
                      <span className="font-semibold text-green-500">
                        {economics.vs_naive.savings_co2_kg} kg CO₂
                      </span>{' '}
                      <span className="text-xs text-muted-foreground">
                        ({economics.vs_naive.savings_pct} %)
                      </span>
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pas de config véhicule */}
      {!vehicleConfig && optimizedOrder && (
        <div className="px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm text-muted-foreground flex items-center gap-2">
          <Fuel className="w-4 h-4 flex-shrink-0" />
          Configurez votre véhicule dans{' '}
          <Link href="/producer/settings" className="underline font-medium text-foreground">
            Paramètres
          </Link>{' '}
          pour voir l&apos;impact carburant de cette tournée.
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

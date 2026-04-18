'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Waypoint {
  lat: number;
  lng: number;
  name: string;
}

export interface OptimizeResult {
  order: number[];
  distance_m: number;
  duration_s: number;
  polyline: [number, number][];
}

interface RouteMapProps {
  waypoints: Waypoint[];
  readOnly?: boolean;
  onOptimize?: () => Promise<OptimizeResult>;
}

// Fix Leaflet default icon paths broken by webpack/Next.js
function patchLeafletIcons(L: typeof import('leaflet')) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export function RouteMap({ waypoints, readOnly = false, onOptimize }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const polylineRef = useRef<import('leaflet').Polyline | null>(null);

  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    void import('leaflet').then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      patchLeafletIcons(L);

      const center: [number, number] =
        waypoints.length > 0
          ? [waypoints[0].lat, waypoints[0].lng]
          : [43.6047, 1.4442];

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 10,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // Add markers
      const markers: import('leaflet').Marker[] = [];
      waypoints.forEach((wp, idx) => {
        const marker = L.marker([wp.lat, wp.lng])
          .addTo(map)
          .bindPopup(`<strong>${idx + 1}. ${wp.name}</strong>`);
        markers.push(marker);
      });

      // Fit bounds if multiple waypoints
      if (waypoints.length >= 2) {
        const bounds = L.latLngBounds(waypoints.map((wp) => [wp.lat, wp.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw polyline when result changes
  useEffect(() => {
    if (!mapRef.current || !result) return;

    void import('leaflet').then((L) => {
      if (!mapRef.current) return;

      // Remove previous polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (result.polyline.length > 0) {
        const poly = L.polyline(result.polyline, {
          color: '#16A34A',
          weight: 4,
          opacity: 0.8,
        }).addTo(mapRef.current);
        polylineRef.current = poly;

        const bounds = L.latLngBounds(result.polyline);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    });
  }, [result]);

  async function handleOptimize() {
    if (!onOptimize) return;
    setOptimizing(true);
    setError(null);
    try {
      const res = await onOptimize();
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du calcul');
    } finally {
      setOptimizing(false);
    }
  }

  const distanceKm = result ? (result.distance_m / 1000).toFixed(1) : null;
  const durationMin = result ? Math.round(result.duration_s / 60) : null;

  return (
    <div className="space-y-4">
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="rounded-2xl overflow-hidden border border-border h-72 w-full bg-muted/20"
        style={{ zIndex: 0 }}
      />

      {/* Stats after optimization */}
      {result && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary font-medium">
            {distanceKm} km
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl text-sm text-primary font-medium">
            {durationMin} min
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-xl text-xs text-muted-foreground">
            Ordre optimisé: {result.order.map((i) => i + 1).join(' → ')}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}

      {/* Optimize button */}
      {!readOnly && onOptimize && (
        <Button
          type="button"
          onClick={() => { void handleOptimize(); }}
          disabled={optimizing || waypoints.length < 2}
          variant="secondary"
          className="gap-2"
        >
          {optimizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Calcul en cours…
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Optimiser avec OSRM
            </>
          )}
        </Button>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Play, Square, Loader2, AlertCircle, ChevronLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NavWaypoint } from '@/components/producer/NavigationMap';
import type { NavStep } from '@/components/producer/TurnByTurn';

// MapLibre GL — client-only
const NavigationMap = dynamic(
  () => import('@/components/producer/NavigationMap').then((m) => m.NavigationMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted/20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const TurnByTurn = dynamic(
  () => import('@/components/producer/TurnByTurn').then((m) => m.TurnByTurn),
  { ssr: false }
);

interface NavigateClientProps {
  producerId: string;
  deliveryId: string | null;
  catalogId: string | null;
}

interface CurrentPos {
  lat: number;
  lng: number;
  bearing?: number;
}

type NavState = 'idle' | 'loading' | 'active' | 'denied' | 'error';

// Haversine distance in metres
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find closest step index from current position
function findCurrentStep(
  steps: NavStep[],
  lat: number,
  lng: number,
  currentIdx: number
): number {
  // Look ahead from current step
  let bestIdx = currentIdx;
  let bestDist = Infinity;
  for (let i = currentIdx; i < Math.min(currentIdx + 5, steps.length); i++) {
    const step = steps[i];
    const d = haversineDistance(lat, lng, step.location_lat, step.location_lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  // Advance step if we've passed the maneuver location (< 30m)
  if (bestDist < 30 && bestIdx < steps.length - 1) {
    return bestIdx + 1;
  }
  return currentIdx;
}

export function NavigateClient({ deliveryId, catalogId }: NavigateClientProps) {
  const router = useRouter();

  const [navState, setNavState] = useState<NavState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(deliveryId);

  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [waypoints, setWaypoints] = useState<NavWaypoint[]>([]);
  const [steps, setSteps] = useState<NavStep[]>([]);
  const [totalDurationS, setTotalDurationS] = useState(0);
  const [totalDistanceM, setTotalDistanceM] = useState(0);
  // These setters are used in future when route is loaded from OSRM
  void setPolyline; void setWaypoints; void setSteps; void setTotalDurationS; void setTotalDistanceM;

  const [currentPos, setCurrentPos] = useState<CurrentPos | undefined>();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [durationRemaining, setDurationRemaining] = useState(0);
  const [speedKmh, setSpeedKmh] = useState<number | undefined>();

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTrackRef = useRef<number>(0);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const stepsRef = useRef<NavStep[]>([]);
  const currentStepIdxRef = useRef(0);

  stepsRef.current = steps;
  currentStepIdxRef.current = currentStepIdx;

  const handleGpsUpdate = useCallback(
    (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const speed = pos.coords.speed; // m/s or null

      // Compute bearing from previous position
      let bearing: number | undefined;
      if (prevPosRef.current) {
        const dLng = ((lng - prevPosRef.current.lng) * Math.PI) / 180;
        const lat1Rad = (prevPosRef.current.lat * Math.PI) / 180;
        const lat2Rad = (lat * Math.PI) / 180;
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x =
          Math.cos(lat1Rad) * Math.sin(lat2Rad) -
          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      }
      prevPosRef.current = { lat, lng };

      setCurrentPos({ lat, lng, bearing });
      if (speed !== null) setSpeedKmh(Math.round(speed * 3.6));

      // Advance navigation step
      const newStepIdx = findCurrentStep(stepsRef.current, lat, lng, currentStepIdxRef.current);
      if (newStepIdx !== currentStepIdxRef.current) {
        setCurrentStepIdx(newStepIdx);
      }

      // Distance to next step maneuver
      const step = stepsRef.current[newStepIdx];
      if (step) {
        const d = haversineDistance(lat, lng, step.location_lat, step.location_lng);
        setDistanceToNext(d);
      }

      // Rough remaining distance/duration: sum remaining steps
      const remaining = stepsRef.current.slice(newStepIdx);
      setDistanceRemaining(remaining.reduce((a, s) => a + s.distance_m, 0));
      setDurationRemaining(remaining.reduce((a, s) => a + s.duration_s, 0));

      // Rate-limited track insert
      const now = Date.now();
      if (now - lastTrackRef.current < 2000) return;
      lastTrackRef.current = now;

      if (activeDeliveryId) {
        void fetch(`/api/deliveries/${activeDeliveryId}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            bearing: bearing ?? null,
            speed: speed ?? null,
          }),
        });
      }
    },
    [activeDeliveryId]
  );

  async function startNavigation() {
    setNavState('loading');
    setErrorMsg(null);

    // Route steps are loaded from delivery route_geojson when delivery exists.
    // GPS-only mode is the fallback (no steps = no turn-by-turn, only position tracking).

    // 2. Request geolocation
    if (!navigator.geolocation) {
      setNavState('denied');
      setErrorMsg('La géolocalisation n\'est pas supportée par ce navigateur.');
      return;
    }

    // Wake lock
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Not critical
      }
    }

    // Create or start delivery
    let currentDeliveryId = activeDeliveryId;
    if (!currentDeliveryId) {
      try {
        const startRes = await fetch(`/api/deliveries/new/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekly_catalog_id: catalogId }),
        });
        if (startRes.ok) {
          const data = (await startRes.json()) as { delivery_id?: string };
          currentDeliveryId = data.delivery_id ?? null;
          setActiveDeliveryId(currentDeliveryId);
        }
      } catch {
        // Continue without delivery_id
      }
    } else {
      await fetch(`/api/deliveries/${currentDeliveryId}/start`, { method: 'POST' });
    }

    // Start GPS watch
    const watchId = navigator.geolocation.watchPosition(
      handleGpsUpdate,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setNavState('denied');
          setErrorMsg('Accès à la géolocalisation refusé. Activez-la dans les paramètres du navigateur.');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 1000 }
    );

    watchIdRef.current = watchId;
    setNavState('active');
  }

  async function stopNavigation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
    if (activeDeliveryId) {
      await fetch(`/api/deliveries/${activeDeliveryId}/complete`, { method: 'POST' });
    }
    setNavState('idle');
    router.push('/producer/route');
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, []);

  const isActive = navState === 'active';

  return (
    <div className="fixed inset-0 bg-[#0F1B15] flex flex-col">
      {/* Map — full screen */}
      <div className="flex-1 relative">
        {polyline.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <MapPin className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-sm opacity-60">
                {isActive
                  ? 'Carte GPS active — polyline chargée depuis la tournée optimisée'
                  : 'Démarrez la tournée pour activer la navigation'}
              </p>
            </div>
          </div>
        )}
        <NavigationMap
          polyline={polyline}
          waypoints={waypoints}
          currentPosition={currentPos}
          mode={isActive ? 'navigation' : 'preview'}
        />

        {/* Turn-by-turn overlay — top of map */}
        {isActive && steps.length > 0 && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <TurnByTurn
              steps={steps}
              currentStepIndex={currentStepIdx}
              distanceToNextStep={distanceToNext}
              totalDistanceRemaining={distanceRemaining || totalDistanceM}
              totalDurationRemaining={durationRemaining || totalDurationS}
              currentSpeedKmh={speedKmh}
            />
          </div>
        )}

        {/* GPS denied warning */}
        {navState === 'denied' && (
          <div className="absolute top-4 left-4 right-4 z-10 flex items-start gap-3 p-4 bg-destructive/20 border border-destructive/40 rounded-xl text-sm text-red-300 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{errorMsg ?? 'Géolocalisation requise pour la navigation.'}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 safe-area-inset-bottom px-4 py-4 bg-[rgba(15,27,21,0.95)] border-t border-white/10 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/producer/route')}
          className="shrink-0 text-white/60 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1">
          {navState === 'idle' && (
            <Button
              type="button"
              onClick={() => { void startNavigation(); }}
              size="lg"
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              <Play className="w-4 h-4" />
              Démarrer la tournée
            </Button>
          )}

          {navState === 'loading' && (
            <Button type="button" disabled size="lg" className="w-full gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Activation GPS…
            </Button>
          )}

          {isActive && (
            <Button
              type="button"
              onClick={() => { void stopNavigation(); }}
              size="lg"
              variant="destructive"
              className="w-full gap-2"
            >
              <Square className="w-4 h-4" />
              Arrêter la tournée
            </Button>
          )}

          {(navState === 'denied' || navState === 'error') && (
            <Button
              type="button"
              onClick={() => { void startNavigation(); }}
              size="lg"
              variant="secondary"
              className="w-full gap-2"
            >
              Réessayer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

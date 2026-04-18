'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Play, Square, Loader2, AlertCircle, ChevronLeft, MapPin, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NavWaypoint } from '@/components/producer/NavigationMap';
import type { NavStep } from '@/components/producer/TurnByTurn';

// MapLibre GL — client-only
const NavigationMap = dynamic(
  () => import('@/components/producer/NavigationMap').then((m) => m.NavigationMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
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
  speed?: number; // m/s
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
  if (bestDist < 30 && bestIdx < steps.length - 1) {
    return bestIdx + 1;
  }
  return currentIdx;
}

const MUTE_KEY = 'nav_mute_voice';

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
  void setPolyline; void setWaypoints; void setSteps; void setTotalDurationS; void setTotalDistanceM;

  const [currentPos, setCurrentPos] = useState<CurrentPos | undefined>();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);
  const [durationRemaining, setDurationRemaining] = useState(0);
  const [speedKmh, setSpeedKmh] = useState<number | undefined>();

  // Mute state — persisted to localStorage
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === 'true';
  });

  // Stop confirmation state
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTrackRef = useRef<number>(0);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const stepsRef = useRef<NavStep[]>([]);
  const currentStepIdxRef = useRef(0);

  stepsRef.current = steps;
  currentStepIdxRef.current = currentStepIdx;

  // Persist mute preference
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      if (next && typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
      return next;
    });
  }, []);

  // Wake lock helper — separated so we can re-request on visibility change
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLockRef.current) return; // already held
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (e) {
      // Not critical — log only
      console.warn('[nav] WakeLock request failed:', e);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch { /* ignore */ }
    wakeLockRef.current = null;
  }, []);

  // Re-request wake lock when tab becomes visible again
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navState === 'active') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [navState, requestWakeLock]);

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

      setCurrentPos({ lat, lng, bearing, speed: speed ?? undefined });
      if (speed !== null && speed !== undefined) setSpeedKmh(Math.round(speed * 3.6));

      const newStepIdx = findCurrentStep(stepsRef.current, lat, lng, currentStepIdxRef.current);
      if (newStepIdx !== currentStepIdxRef.current) {
        setCurrentStepIdx(newStepIdx);
      }

      const step = stepsRef.current[newStepIdx];
      if (step) {
        const d = haversineDistance(lat, lng, step.location_lat, step.location_lng);
        setDistanceToNext(d);
      }

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

    if (!navigator.geolocation) {
      setNavState('denied');
      setErrorMsg("La géolocalisation n'est pas supportée par ce navigateur.");
      return;
    }

    await requestWakeLock();

    let currentDeliveryId = activeDeliveryId;
    if (!currentDeliveryId) {
      try {
        const startRes = await fetch('/api/deliveries/new/start', {
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

    const watchId = navigator.geolocation.watchPosition(
      handleGpsUpdate,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setNavState('denied');
          setErrorMsg('Accès à la géolocalisation refusé. Activez-la dans les paramètres.');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 1000 }
    );

    watchIdRef.current = watchId;
    setNavState('active');
  }

  async function stopNavigation() {
    setShowStopConfirm(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    await releaseWakeLock();
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
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
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const isActive = navState === 'active';

  // ─── NAVIGATION ACTIVE — full-screen dark layout ────────────────────────────
  if (isActive) {
    return (
      <div
        className="fixed inset-0 z-50 bg-zinc-950 flex flex-col landscape:flex-row"
        style={{ height: '100dvh' }}
      >
        {/* ── Portrait: top instruction bar ── Landscape: left sidebar ──────── */}
        <div className="shrink-0 bg-zinc-900 border-b-2 border-primary landscape:border-b-0 landscape:border-r-2 landscape:w-80 landscape:flex landscape:flex-col landscape:justify-between">
          {/* Main instruction */}
          <div
            className="px-5 py-4 flex items-center gap-4"
            aria-live="assertive"
            aria-atomic="true"
          >
            {steps.length > 0 ? (
              <TurnByTurn
                steps={steps}
                currentStepIndex={currentStepIdx}
                distanceToNextStep={distanceToNext}
                totalDistanceRemaining={distanceRemaining || totalDistanceM}
                totalDurationRemaining={durationRemaining || totalDurationS}
                currentSpeedKmh={speedKmh}
                isMuted={isMuted}
                layout="inline"
              />
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/20 border-2 border-primary flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-4xl font-bold text-white leading-none">GPS actif</p>
                  <p className="text-sm text-zinc-400 mt-1">Suivi de position en cours</p>
                </div>
              </div>
            )}

            {/* Mute button — top right */}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Activer le guidage vocal' : 'Couper le guidage vocal'}
              className="shrink-0 w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 active:bg-zinc-700"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Landscape-only: stats + stop button at bottom of sidebar */}
          <div className="hidden landscape:block">
            <BottomStats
              distanceRemaining={distanceRemaining || totalDistanceM}
              durationRemaining={durationRemaining || totalDurationS}
              speedKmh={speedKmh}
            />
            <div className="px-4 pb-4">
              <StopButton
                onRequestStop={() => setShowStopConfirm(true)}
                showConfirm={showStopConfirm}
                onConfirm={() => { void stopNavigation(); }}
                onCancel={() => setShowStopConfirm(false)}
              />
            </div>
          </div>
        </div>

        {/* ── Map — flex-1 ─────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <NavigationMap
            polyline={polyline}
            waypoints={waypoints}
            currentPosition={currentPos}
            mode="navigation"
          />
        </div>

        {/* ── Portrait-only: bottom bar ─────────────────────────────────────── */}
        <div className="landscape:hidden shrink-0 bg-zinc-900 border-t-2 border-zinc-800">
          <BottomStats
            distanceRemaining={distanceRemaining || totalDistanceM}
            durationRemaining={durationRemaining || totalDurationS}
            speedKmh={speedKmh}
          />
          <div className="px-4 pb-4">
            <StopButton
              onRequestStop={() => setShowStopConfirm(true)}
              showConfirm={showStopConfirm}
              onConfirm={() => { void stopNavigation(); }}
              onCancel={() => setShowStopConfirm(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── IDLE / LOADING / ERROR — standard layout ────────────────────────────────
  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col" style={{ height: '100dvh' }}>
      {/* Map — full screen */}
      <div className="flex-1 relative">
        {polyline.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
            <div className="text-center space-y-3">
              <MapPin className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-sm opacity-60">
                Démarrez la tournée pour activer la navigation
              </p>
            </div>
          </div>
        )}
        <NavigationMap
          polyline={polyline}
          waypoints={waypoints}
          currentPosition={currentPos}
          mode="preview"
        />

        {/* GPS denied warning */}
        {navState === 'denied' && (
          <div className="absolute top-4 left-4 right-4 z-10 flex items-start gap-3 p-4 bg-red-950/80 border border-red-700 rounded-xl text-sm text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{errorMsg ?? 'Géolocalisation requise pour la navigation.'}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 px-4 py-4 bg-zinc-900 border-t border-zinc-800 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/producer/route')}
          className="shrink-0 h-11 w-11 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1">
          {navState === 'idle' && (
            <Button
              type="button"
              onClick={() => { void startNavigation(); }}
              size="lg"
              className="w-full h-14 gap-2 text-lg bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              <Play className="w-5 h-5" />
              Démarrer la tournée
            </Button>
          )}

          {navState === 'loading' && (
            <Button type="button" disabled size="lg" className="w-full h-14 gap-2 text-lg">
              <Loader2 className="w-5 h-5 animate-spin" />
              Activation GPS…
            </Button>
          )}

          {(navState === 'denied' || navState === 'error') && (
            <Button
              type="button"
              onClick={() => { void startNavigation(); }}
              size="lg"
              variant="secondary"
              className="w-full h-14 gap-2 text-lg"
            >
              Réessayer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Stats Bar ──────────────────────────────────────────────────────────

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtETA(s: number): string {
  const now = new Date();
  now.setSeconds(now.getSeconds() + Math.round(s));
  return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface BottomStatsProps {
  distanceRemaining: number;
  durationRemaining: number;
  speedKmh?: number;
}

function BottomStats({ distanceRemaining, durationRemaining, speedKmh }: BottomStatsProps) {
  return (
    <div className="grid grid-cols-3 divide-x divide-zinc-800 border-b border-zinc-800">
      {/* Distance restante */}
      <div className="flex flex-col items-center justify-center py-3 px-2">
        <span className="text-3xl font-bold text-white leading-none">
          {distanceRemaining > 0 ? fmtDistance(distanceRemaining) : '—'}
        </span>
        <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Restant</span>
      </div>

      {/* Vitesse — donnée la plus glanceable, XXL */}
      <div className="flex flex-col items-center justify-center py-3 px-2 bg-zinc-800/50">
        <span className="text-6xl font-black text-amber-400 leading-none tabular-nums">
          {speedKmh !== undefined ? speedKmh : '—'}
        </span>
        <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">km/h</span>
      </div>

      {/* ETA */}
      <div className="flex flex-col items-center justify-center py-3 px-2">
        <span className="text-3xl font-bold text-white leading-none">
          {durationRemaining > 0 ? fmtETA(durationRemaining) : '—'}
        </span>
        <span className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Arrivée</span>
      </div>
    </div>
  );
}

// ─── Stop Button with Confirmation ────────────────────────────────────────────

interface StopButtonProps {
  onRequestStop: () => void;
  showConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function StopButton({ onRequestStop, showConfirm, onConfirm, onCancel }: StopButtonProps) {
  if (showConfirm) {
    return (
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={onConfirm}
          size="lg"
          variant="destructive"
          className="flex-1 h-14 text-lg font-bold"
        >
          Arrêter
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          size="lg"
          variant="secondary"
          className="flex-1 h-14 text-lg"
        >
          Continuer
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={onRequestStop}
      size="lg"
      className="w-full h-14 gap-2 text-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
    >
      <Square className="w-5 h-5" />
      Arrêter la tournée
    </Button>
  );
}

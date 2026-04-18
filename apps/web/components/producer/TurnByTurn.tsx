'use client';

import React, { useEffect, useRef } from 'react';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  RotateCw,
  Flag,
} from 'lucide-react';

export interface NavStep {
  leg_index: number;
  step_index: number;
  maneuver_type: string;
  maneuver_modifier: string | null;
  location_lng: number;
  location_lat: number;
  bearing_after: number | null;
  street_name: string | null;
  distance_m: number;
  duration_s: number;
}

interface TurnByTurnProps {
  steps: NavStep[];
  currentStepIndex: number;
  distanceToNextStep: number; // metres
  totalDistanceRemaining: number; // metres
  totalDurationRemaining: number; // seconds
  currentSpeedKmh?: number;
  /** Whether speech synthesis is muted externally */
  isMuted?: boolean;
  /** 'inline' = compact single-row for the top nav bar; 'card' (default) = standalone card */
  layout?: 'inline' | 'card';
}

function ManeuverIcon({ type, modifier, size = 'lg' }: { type: string; modifier: string | null; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';

  if (type === 'arrive' || type === 'depart') return <Flag className={cls} />;
  if (type === 'roundabout' || type === 'rotary') return <RotateCw className={cls} />;

  const mod = modifier ?? '';
  if (mod.includes('left') && mod.includes('sharp')) return <RotateCcw className={`${cls} text-amber-400`} />;
  if (mod.includes('right') && mod.includes('sharp')) return <RotateCw className={`${cls} text-amber-400`} />;
  if (mod.includes('slight left') || mod === 'left') return <ArrowUpLeft className={`${cls} text-sky-300`} />;
  if (mod.includes('slight right') || mod === 'right') return <ArrowUpRight className={`${cls} text-sky-300`} />;
  if (mod === 'uturn') return <RotateCcw className={`${cls} text-rose-400`} />;

  return <ArrowUp className={cls} />;
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtDuration(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}min`;
}

export function maneuverText(step: NavStep): string {
  const type = step.maneuver_type;
  const mod = step.maneuver_modifier ?? '';
  const street = step.street_name ? ` sur ${step.street_name}` : '';

  if (type === 'depart') return `Démarrer${street}`;
  if (type === 'arrive') return 'Arrivée à destination';

  if (type === 'turn') {
    if (mod.includes('left')) return `Tournez à gauche${street}`;
    if (mod.includes('right')) return `Tournez à droite${street}`;
    return `Continuez${street}`;
  }
  if (type === 'new name') return `Continuez${street}`;
  if (type === 'merge') return `Rejoignez${street}`;
  if (type === 'ramp') return `Prenez la bretelle${street}`;
  if (type === 'fork') {
    if (mod.includes('left')) return `Gardez la gauche${street}`;
    if (mod.includes('right')) return `Gardez la droite${street}`;
  }
  if (type === 'roundabout' || type === 'rotary') return `Prenez le rond-point${street}`;
  if (type === 'exit roundabout') return `Sortez du rond-point${street}`;
  if (type === 'continue') return `Continuez${street}`;

  return `Continuez${street}`;
}

export function TurnByTurn({
  steps,
  currentStepIndex,
  distanceToNextStep,
  totalDistanceRemaining,
  totalDurationRemaining,
  currentSpeedKmh,
  isMuted = false,
  layout = 'card',
}: TurnByTurnProps) {
  const spokenRef = useRef<number>(-1);

  const currentStep = steps[currentStepIndex] ?? null;
  const nextStep = steps[currentStepIndex + 1] ?? null;

  // Vocal guidance: speak when within 300m of a maneuver
  useEffect(() => {
    if (!currentStep) return;
    if (isMuted) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (spokenRef.current === currentStepIndex) return;

    if (distanceToNextStep <= 300 && distanceToNextStep > 0) {
      const text =
        distanceToNextStep < 50
          ? maneuverText(currentStep)
          : `Dans ${fmtDistance(distanceToNextStep)}, ${maneuverText(currentStep)}`;

      spokenRef.current = currentStepIndex;

      // Vibration feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'fr-FR';
      utt.rate = 1.0;
      utt.volume = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    }
  }, [currentStepIndex, distanceToNextStep, currentStep, isMuted]);

  if (!currentStep) return null;

  // ── Inline layout (used inside the top nav bar) ────────────────────────────
  if (layout === 'inline') {
    return (
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Maneuver icon */}
        <div className="shrink-0 w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary flex items-center justify-center text-white">
          <ManeuverIcon type={currentStep.maneuver_type} modifier={currentStep.maneuver_modifier} size="lg" />
        </div>

        {/* Instruction text */}
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-amber-400 leading-none tabular-nums">
            {fmtDistance(distanceToNextStep)}
          </p>
          <p className="text-4xl md:text-5xl font-bold text-white leading-tight mt-0.5 truncate">
            {maneuverText(currentStep)}
          </p>
          {nextStep && (
            <p className="text-sm text-zinc-400 mt-1 truncate">
              Ensuite : {maneuverText(nextStep)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Card layout (standalone overlay, legacy) ───────────────────────────────
  return (
    <div className="pointer-events-none select-none space-y-2">
      {/* Main instruction card */}
      <div className="pointer-events-auto bg-zinc-900 border-2 border-primary rounded-2xl shadow-2xl overflow-hidden">
        {/* Next maneuver */}
        <div className="flex items-center gap-4 px-5 py-4" aria-live="assertive" aria-atomic="true">
          <div className="shrink-0 w-16 h-16 rounded-xl bg-primary/20 border-2 border-primary flex items-center justify-center text-white">
            <ManeuverIcon type={currentStep.maneuver_type} modifier={currentStep.maneuver_modifier} size="lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-amber-400 leading-none tabular-nums">
              {fmtDistance(distanceToNextStep)}
            </p>
            <p className="text-4xl font-bold text-white leading-tight mt-0.5 truncate">
              {maneuverText(currentStep)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-800 mx-5" />

        {/* Bottom stats row */}
        <div className="flex items-center gap-4 px-5 py-3 text-sm text-zinc-400">
          <span>{fmtDistance(totalDistanceRemaining)}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-white font-medium">ETA {fmtDuration(totalDurationRemaining)}</span>
          {currentSpeedKmh !== undefined && (
            <span className="ml-auto text-amber-400 font-bold text-3xl tabular-nums">
              {Math.round(currentSpeedKmh)} <span className="text-xs text-zinc-500 font-normal">km/h</span>
            </span>
          )}
        </div>
      </div>

      {/* Next step preview */}
      {nextStep && (
        <div className="pointer-events-auto bg-zinc-900/90 border border-zinc-700 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            <ManeuverIcon type={nextStep.maneuver_type} modifier={nextStep.maneuver_modifier} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500">Ensuite</p>
            <p className="text-sm text-zinc-200 truncate">{maneuverText(nextStep)}</p>
          </div>
          <span className="text-xs text-zinc-500 shrink-0">{fmtDistance(nextStep.distance_m)}</span>
        </div>
      )}
    </div>
  );
}

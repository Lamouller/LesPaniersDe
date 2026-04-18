'use client';

import React, { useEffect, useRef } from 'react';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  RotateCw,
  Navigation,
  Flag,
  Gauge,
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
}

function ManeuverIcon({ type, modifier }: { type: string; modifier: string | null }) {
  const cls = 'w-8 h-8';

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

function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtDuration(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}min`;
}

function maneuverText(step: NavStep): string {
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
}: TurnByTurnProps) {
  const spokenRef = useRef<number>(-1);

  const currentStep = steps[currentStepIndex] ?? null;
  const nextStep = steps[currentStepIndex + 1] ?? null;

  // Vocal guidance: speak when within 300m of a maneuver
  useEffect(() => {
    if (!currentStep) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (spokenRef.current === currentStepIndex) return;

    if (distanceToNextStep <= 300 && distanceToNextStep > 0) {
      const text =
        distanceToNextStep < 50
          ? maneuverText(currentStep)
          : `Dans ${fmtDistance(distanceToNextStep)}, ${maneuverText(currentStep)}`;

      spokenRef.current = currentStepIndex;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'fr-FR';
      utt.rate = 1.0;
      utt.volume = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    }
  }, [currentStepIndex, distanceToNextStep, currentStep]);

  if (!currentStep) return null;

  return (
    <div className="pointer-events-none select-none space-y-2">
      {/* Main instruction card */}
      <div className="pointer-events-auto bg-[rgba(15,27,21,0.92)] backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Next maneuver */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-white">
            <ManeuverIcon type={currentStep.maneuver_type} modifier={currentStep.maneuver_modifier} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-white leading-tight">
              {fmtDistance(distanceToNextStep)}
            </p>
            <p className="text-sm text-white/70 mt-0.5 truncate">
              {maneuverText(currentStep)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mx-5" />

        {/* Bottom stats row */}
        <div className="flex items-center gap-4 px-5 py-3 text-xs text-white/60">
          {/* Total remaining */}
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>{fmtDistance(totalDistanceRemaining)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>ETA</span>
            <span className="text-white/80 font-medium">{fmtDuration(totalDurationRemaining)}</span>
          </div>
          {/* Speed */}
          {currentSpeedKmh !== undefined && (
            <div className="ml-auto flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 shrink-0" />
              <span className="text-white/80 font-medium">{Math.round(currentSpeedKmh)} km/h</span>
            </div>
          )}
        </div>
      </div>

      {/* Next step preview */}
      {nextStep && (
        <div className="pointer-events-auto bg-[rgba(15,27,21,0.75)] backdrop-blur-sm border border-white/8 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
            <ManeuverIcon type={nextStep.maneuver_type} modifier={nextStep.maneuver_modifier} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50">Ensuite</p>
            <p className="text-sm text-white/80 truncate">{maneuverText(nextStep)}</p>
          </div>
          <span className="text-xs text-white/50 shrink-0">{fmtDistance(nextStep.distance_m)}</span>
        </div>
      )}
    </div>
  );
}

// Export helpers for use in the nav page
export { fmtDistance, fmtDuration, maneuverText };

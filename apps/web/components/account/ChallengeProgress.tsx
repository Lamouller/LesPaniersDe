import React from 'react';
import { Target } from 'lucide-react';

interface ChallengeProgressProps {
  title: string;
  description: string | null;
  currentValue: number;
  targetValue: number;
  reward: string | null;
  endDate: string;
}

export function ChallengeProgress({
  title,
  description,
  currentValue,
  targetValue,
  reward,
  endDate,
}: ChallengeProgressProps) {
  const pct = Math.min(100, Math.round((currentValue / targetValue) * 100));
  const completed = currentValue >= targetValue;

  const endDateFormatted = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(endDate));

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-green-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-1">
            Challenge en cours
          </p>
          <h3 className="text-base font-semibold text-neutral-50">{title}</h3>
          {description && (
            <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold text-neutral-50">
            {currentValue}
            <span className="text-base font-normal text-neutral-500 ml-1">/ {targetValue}</span>
          </span>
          <span className="text-sm font-semibold text-neutral-400">{pct}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completed ? 'bg-green-400' : 'bg-white'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 mt-3">
        <span>Jusqu&apos;au {endDateFormatted}</span>
        {completed && (
          <span className="text-green-400 font-semibold">Objectif atteint !</span>
        )}
      </div>

      {reward && (
        <div className="mt-4 px-3 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <p className="text-xs text-amber-400/90">{reward}</p>
        </div>
      )}
    </div>
  );
}

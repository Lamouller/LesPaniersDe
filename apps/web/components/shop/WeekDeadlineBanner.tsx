import React from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Props = {
  deadline: string; // ISO datetime
  weekStart: string; // ISO date YYYY-MM-DD
};

export default function WeekDeadlineBanner({ deadline, weekStart }: Props) {
  const deadlineDate = new Date(deadline);
  const weekStartDate = new Date(weekStart);

  const formattedDeadline = format(deadlineDate, "EEEE d MMMM 'à' HH'h'mm", { locale: fr });
  const formattedWeek = format(weekStartDate, "d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-2 mb-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Semaine du {formattedWeek}
      </p>
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-400">
          Commande possible jusqu'au{' '}
          <strong className="text-amber-300">{formattedDeadline}</strong>
        </p>
      </div>
    </div>
  );
}

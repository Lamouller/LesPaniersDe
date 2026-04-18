import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function BlockedBanner() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-300">
          Votre compte est bloqué pour impayé
        </p>
        <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
          Vous ne pouvez pas passer de nouvelle commande tant que vos paiements en attente ne
          sont pas réglés. Contactez l'admin pour débloquer votre compte.
        </p>
      </div>
    </div>
  );
}

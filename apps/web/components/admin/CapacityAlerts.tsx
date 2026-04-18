import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CapacityAlert {
  catalog_id: string;
  producer_id: string;
  producer_name: string;
  week_start: string;
  max_orders: number;
  current_orders: number;
  fill_pct: number;
  severity: 'critical' | 'warning' | 'info' | null;
}

interface CapacityAlertsProps {
  alerts: CapacityAlert[];
}

function severityConfig(severity: CapacityAlert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        icon: AlertCircle,
        iconColor: 'text-red-400',
        badgeVariant: 'destructive' as const,
        label: 'Complet',
        recommendation: 'Fermer les commandes immédiatement.',
        border: 'border-red-500/20 bg-red-500/5',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        iconColor: 'text-amber-400',
        badgeVariant: 'warning' as const,
        label: 'Presque complet',
        recommendation: 'Surveiller les nouvelles commandes, envisager de clôturer bientôt.',
        border: 'border-amber-500/20 bg-amber-500/5',
      };
    case 'info':
      return {
        icon: Info,
        iconColor: 'text-blue-400',
        badgeVariant: 'default' as const,
        label: 'Faible remplissage',
        recommendation: 'Relancer les clients pour éviter les invendus.',
        border: 'border-blue-500/20 bg-blue-500/5',
      };
    default:
      return null;
  }
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(d));
}

export function CapacityAlerts({ alerts }: CapacityAlertsProps) {
  const filteredAlerts = alerts.filter((a) => a.severity !== null);

  if (filteredAlerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Aucune alerte capacité pour le moment.</p>
    );
  }

  return (
    <div className="space-y-3">
      {filteredAlerts.map((alert) => {
        const cfg = severityConfig(alert.severity);
        if (!cfg) return null;
        const IconComponent = cfg.icon;
        return (
          <div
            key={`${alert.catalog_id}`}
            className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.border}`}
          >
            <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground/80">{alert.producer_name}</span>
                <Badge variant={cfg.badgeVariant} className="text-[10px]">
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                Semaine du {formatDate(alert.week_start)} — {alert.current_orders}/{alert.max_orders} commandes ({alert.fill_pct}%)
              </p>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    alert.severity === 'critical'
                      ? 'bg-red-500'
                      : alert.severity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(alert.fill_pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{cfg.recommendation}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React from 'react';
import { ShoppingBasket, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/utils';

const STATS = [
  { label: 'Commandes semaine', value: '47', icon: ShoppingBasket },
  { label: 'Clients actifs', value: '36', icon: Users },
  { label: 'Revenus à venir', value: formatCents(142500), icon: TrendingUp },
  { label: 'Impayés', value: '3', icon: AlertTriangle, alert: true },
];

const BY_ENTITY = [
  { name: 'Open Space du Centre', orders: 28, capacity: 40 },
  { name: 'Coworking Nord', orders: 19, capacity: 25 },
];

export default function ProducerDashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Semaine en cours</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Tableau de bord producteur</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s) => (
          <Card key={s.label} className={s.alert ? 'border-red-500/20 bg-red-500/5' : ''}>
            <CardContent className="pt-6">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.alert ? 'bg-red-500/10' : 'bg-white/5 border border-white/10'}`}>
                <s.icon className={`w-4 h-4 ${s.alert ? 'text-red-400' : 'text-neutral-400'}`} />
              </div>
              <p className={`text-2xl font-bold mb-1 ${s.alert ? 'text-red-300' : 'text-neutral-50'}`}>{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Par entité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commandes par entité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {BY_ENTITY.map((entity) => {
              const pct = Math.round((entity.orders / entity.capacity) * 100);
              return (
                <div key={entity.name}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-neutral-200">{entity.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">{entity.orders}/{entity.capacity}</span>
                      <Badge variant={pct >= 90 ? 'destructive' : pct >= 70 ? 'warning' : 'success'}>
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

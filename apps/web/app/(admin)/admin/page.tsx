import React from 'react';
import { TrendingUp, ShoppingBasket, AlertTriangle, Tractor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';

// Placeholder stats — sera remplacé par fetch Supabase
const STATS = [
  { label: 'CA cette semaine', value: formatCents(142500), icon: TrendingUp, trend: '+12%' },
  { label: 'Commandes', value: '47', icon: ShoppingBasket, trend: '+3 vs S-1' },
  { label: 'Impayés', value: '3', icon: AlertTriangle, trend: '890 €', alert: true },
  { label: 'Producteurs actifs', value: '2', icon: Tractor, trend: 'Cette semaine' },
];

export default function AdminDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Vue globale</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Dashboard admin</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => (
          <Card key={stat.label} className={stat.alert ? 'border-red-500/20 bg-red-500/5' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.alert ? 'bg-red-500/10' : 'bg-white/5 border border-white/10'}`}>
                  <stat.icon className={`w-4 h-4 ${stat.alert ? 'text-red-400' : 'text-neutral-400'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold mb-1 ${stat.alert ? 'text-red-300' : 'text-neutral-50'}`}>
                {stat.value}
              </p>
              <p className="text-xs text-neutral-500">{stat.label}</p>
              <p className={`text-xs mt-1 ${stat.alert ? 'text-red-500' : 'text-neutral-600'}`}>{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-300">
              <AlertTriangle className="w-4 h-4" />
              Impayés à pointer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-3">3 paiements en attente depuis plus de 7 jours</p>
            <a
              href="/admin/sales"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              Voir les impayés
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBasket className="w-4 h-4 text-neutral-400" />
              Commandes de la semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500 mb-3">47 commandes confirmées pour vendredi</p>
            <a
              href="/admin/sales"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/5 text-neutral-300 text-sm font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
            >
              Voir les commandes
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

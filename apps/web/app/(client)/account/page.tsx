import React from 'react';
import Link from 'next/link';
import { Package, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCents } from '@/lib/utils';

// Placeholder data — sera remplacé par fetch Supabase
const NEXT_ORDER = {
  id: 'ord_1',
  label: 'Panier moyen + Option fruits',
  total_cents: 3300,
  pickup_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  entity_name: 'Open Space du Centre',
  status: 'confirmed' as const,
};

const HISTORY = [
  { id: 'ord_0', label: 'Panier moyen', total_cents: 2500, date: '2025-04-11', paid: true },
  { id: 'ord_-1', label: 'Petit panier + Oeufs', total_cents: 1850, date: '2025-04-04', paid: true },
  { id: 'ord_-2', label: 'Grand panier', total_cents: 3500, date: '2025-03-28', paid: false },
];

export default function AccountPage() {
  const unpaid = HISTORY.filter((o) => !o.paid);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Tableau de bord</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Mon espace</h1>
      </div>

      {/* Impayés */}
      {unpaid.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">
              {unpaid.length} paiement{unpaid.length > 1 ? 's' : ''} en attente
            </p>
            <p className="text-xs text-red-400/80 mt-1">
              Pensez à régler avant la prochaine commande.
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-red-300 hover:text-red-100 transition-colors whitespace-nowrap"
          >
            J'ai payé, prévenir l'admin
          </button>
        </div>
      )}

      {/* Prochaine commande */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-400" />
              Prochaine commande
            </CardTitle>
            <Badge variant="success">Confirmée</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium text-neutral-200 mb-1">{NEXT_ORDER.label}</p>
          <p className="text-xs text-neutral-500 mb-3">
            Retrait le {formatDate(NEXT_ORDER.pickup_date)} · {NEXT_ORDER.entity_name}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-neutral-50">{formatCents(NEXT_ORDER.total_cents)}</span>
            <Link href="/shop">
              <Button variant="secondary" size="sm">Modifier</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-neutral-400" />
            Historique
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {HISTORY.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-200">{order.label}</p>
                  <p className="text-xs text-neutral-600">{formatDate(order.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-neutral-300">
                    {formatCents(order.total_cents)}
                  </span>
                  {order.paid ? (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Payé
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Impayé</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

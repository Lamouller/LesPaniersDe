import React from 'react';
import Link from 'next/link';
import { MapPin, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CheckoutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/shop">
          <button
            type="button"
            className="p-2 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-neutral-200 transition-all duration-200"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Récapitulatif</h1>
      </div>

      {/* Empty state placeholder */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Votre panier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Placeholder items */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-neutral-200">Panier moyen</p>
                <p className="text-xs text-neutral-500">Légumes + fruits · ×1</p>
              </div>
              <span className="text-sm font-semibold text-neutral-50">25,00 €</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-neutral-200">Option fruits</p>
                <p className="text-xs text-neutral-500">Supplément · ×1</p>
              </div>
              <span className="text-sm font-semibold text-neutral-50">8,00 €</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-base font-semibold text-neutral-50">Total</p>
              <span className="text-lg font-bold text-neutral-50">33,00 €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pickup info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-neutral-200">Lieu de retrait</p>
              <p className="text-sm text-neutral-400 mt-1">Open Space du Centre — 12 rue des Entrepreneurs, Lyon 2e</p>
              <p className="text-xs text-neutral-600 mt-1">Livraison prévue vendredi entre 12h et 14h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment info */}
      <div className="flex items-start gap-3 px-4 py-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-8">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-300">Paiement au retrait</p>
          <p className="text-sm text-blue-400/80 mt-1 leading-relaxed">
            Vous paierez en direct lors du retrait à votre entité — cash, CB, virement ou chèque
            selon les préférences du producteur. Aucun paiement en ligne n'est collecté.
          </p>
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg">
        Confirmer la commande
      </Button>

      <p className="text-center text-xs text-neutral-600 mt-4">
        Vous pouvez annuler votre commande jusqu'au jeudi 20h
      </p>
    </div>
  );
}

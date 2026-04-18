'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Info, Loader2 } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart';
import { formatCents } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  entityName: string;
  pickupAddress: string;
  pickupInstructions: string | null;
  deliveryInfo: string;
};

export default function CheckoutClient({
  entityName,
  pickupAddress,
  pickupInstructions,
  deliveryInfo,
}: Props) {
  const router = useRouter();
  const { lines, totalCents, clear } = useCartStore();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = totalCents();

  if (lines.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground text-sm mb-4">Votre panier est vide.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (loading || lines.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Group lines by producer (take first producer from lines)
      const firstLine = lines[0];

      const payload = {
        producer_id: firstLine.producer_id,
        weekly_catalog_id: firstLine.weekly_catalog_id,
        items: lines.map((l) => ({
          product_id: l.product_id,
          product_name_snapshot: l.product_name,
          unit_price_cents: l.unit_price_cents,
          quantity: l.quantity,
        })),
        notes: notes.trim() || undefined,
      };

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création de la commande.');
        return;
      }

      clear();
      router.push(`/account?order=${data.order_number}`);
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/shop">
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground/80 transition-all duration-200"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Récapitulatif</h1>
      </div>

      {/* Cart lines */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Votre commande</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.product_id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground/80">{line.product_name}</p>
                  <p className="text-xs text-muted-foreground">×{line.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatCents(line.unit_price_cents * line.quantity)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between pt-3">
              <p className="text-base font-semibold text-foreground">Total</p>
              <span className="text-lg font-bold text-foreground">{formatCents(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pickup info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground/80">
                Retrait : {entityName}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{pickupAddress}</p>
              {pickupInstructions && (
                <p className="text-xs text-muted-foreground mt-1">{pickupInstructions}</p>
              )}
              {deliveryInfo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Livraison prévue : {deliveryInfo}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment info */}
      <div className="flex items-start gap-3 px-4 py-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-300">Paiement au retrait</p>
          <p className="text-sm text-blue-400/80 mt-1 leading-relaxed">
            Vous paierez en direct au retrait (cash, CB, virement ou chèque). Aucun paiement
            n'est effectué sur la plateforme.
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-8 space-y-1.5">
        <label className="text-sm font-medium text-foreground/70">
          Notes pour le producteur (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex : allergie à la courgette, livrez en bas de l'immeuble..."
          className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 resize-y min-h-[80px]"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black text-base font-medium rounded-xl shadow-lg shadow-white/10 hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Confirmation en cours...
          </>
        ) : (
          'Confirmer ma commande'
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground/60 mt-4">
        Vous pouvez contacter le producteur si vous devez annuler.
      </p>
    </div>
  );
}

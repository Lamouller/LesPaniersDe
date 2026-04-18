'use client';

import React, { useState } from 'react';
import { Banknote, CreditCard, Building, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/types/database';

export interface ReconcileTarget {
  payment_id: string;
  order_number: string;
  client_name: string;
  amount_cents: number;
  client_id: string;
  is_client_blocked: boolean;
}

interface Props {
  target: ReconcileTarget | null;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

const METHODS: { value: PaymentMethod; label: string; placeholder: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Espèces', placeholder: '—', icon: <Banknote className="w-4 h-4" /> },
  { value: 'card', label: 'CB', placeholder: 'N° transaction', icon: <CreditCard className="w-4 h-4" /> },
  { value: 'transfer', label: 'Virement', placeholder: 'Réf. virement', icon: <Building className="w-4 h-4" /> },
  { value: 'check', label: 'Chèque', placeholder: 'N° chèque', icon: <FileText className="w-4 h-4" /> },
];

export function ReconcilePaymentModal({ target, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [unblockClient, setUnblockClient] = useState(target?.is_client_blocked ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync unblockClient default when target changes
  React.useEffect(() => {
    setUnblockClient(target?.is_client_blocked ?? false);
    setMethod('cash');
    setReference('');
    setNotes('');
    setError(null);
  }, [target?.payment_id, target?.is_client_blocked]);

  const currentMethod = METHODS.find((m) => m.value === method);

  async function handleConfirm() {
    if (!target) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: target.payment_id,
          method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          unblock_client: unblockClient,
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Erreur inconnue');
        return;
      }

      onSuccess(target.payment_id);
    } catch {
      setError('Erreur réseau, veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pointer le paiement</DialogTitle>
          <DialogDescription>
            {target?.client_name} — {target && formatCents(target.amount_cents)} · {target?.order_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Méthode */}
          <div>
            <p className="text-sm font-medium text-neutral-300 mb-2">Mode de paiement</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    method === m.value
                      ? 'bg-white/10 border-white/30 text-neutral-50'
                      : 'bg-white/[0.03] border-white/10 text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Référence */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-300" htmlFor="reconcile-ref">
              Référence <span className="text-neutral-600 font-normal">(optionnel)</span>
            </label>
            <input
              id="reconcile-ref"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={currentMethod?.placeholder ?? '—'}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-300" htmlFor="reconcile-notes">
              Notes <span className="text-neutral-600 font-normal">(optionnel)</span>
            </label>
            <textarea
              id="reconcile-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Remarque interne..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 resize-none"
            />
          </div>

          {/* Débloquer client */}
          {target?.is_client_blocked && (
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={unblockClient}
                onChange={(e) => setUnblockClient(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-white cursor-pointer"
              />
              <span className="text-sm text-neutral-300 group-hover:text-neutral-200 transition-colors">
                Débloquer le client si tous ses impayés sont réglés
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Confirmer le pointage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

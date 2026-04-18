'use client';

import React, { useState } from 'react';
import { CreditCard, Banknote, Building, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCents } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/types/database';

interface PaymentRow {
  id: string;
  client_name: string;
  entity_name: string;
  amount_cents: number;
  status: 'pending' | 'overdue' | 'paid';
  due_date: string;
  order_label: string;
}

// Placeholder data
const PAYMENTS: PaymentRow[] = [
  { id: 'pay_1', client_name: 'Marie Dupont', entity_name: 'Open Space du Centre', amount_cents: 2500, status: 'overdue', due_date: '2025-04-04', order_label: 'Panier moyen' },
  { id: 'pay_2', client_name: 'Jean Martin', entity_name: 'Coworking Nord', amount_cents: 3500, status: 'overdue', due_date: '2025-04-04', order_label: 'Grand panier' },
  { id: 'pay_3', client_name: 'Sophie Bernard', entity_name: 'Open Space du Centre', amount_cents: 1850, status: 'pending', due_date: '2025-04-18', order_label: 'Petit panier + Oeufs' },
  { id: 'pay_4', client_name: 'Pierre Moreau', entity_name: 'Coworking Nord', amount_cents: 3300, status: 'pending', due_date: '2025-04-18', order_label: 'Panier moyen + Fruits' },
];

const METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Espèces', icon: <Banknote className="w-4 h-4" /> },
  { value: 'card', label: 'CB', icon: <CreditCard className="w-4 h-4" /> },
  { value: 'transfer', label: 'Virement', icon: <Building className="w-4 h-4" /> },
  { value: 'check', label: 'Chèque', icon: <FileText className="w-4 h-4" /> },
];

export default function AdminSalesPage() {
  const [payments, setPayments] = useState(PAYMENTS);
  const [modalPayment, setModalPayment] = useState<PaymentRow | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const pending = payments.filter((p) => p.status !== 'paid');
  const paid = payments.filter((p) => p.status === 'paid');

  async function handlePointer() {
    if (!modalPayment) return;
    setLoading(true);

    // TODO: PATCH /api/admin/payments/:id avec { status: 'paid', method, reference, reconciled_at, reconciled_by }
    await new Promise((r) => setTimeout(r, 600)); // Simulated delay

    setPayments((prev) =>
      prev.map((p) => (p.id === modalPayment.id ? { ...p, status: 'paid' as const } : p))
    );
    setLoading(false);
    setModalPayment(null);
    setReference('');
    setMethod('cash');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Admin</p>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Pointage des paiements</h1>
      </div>

      {/* Table pending */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            En attente / En retard ({pending.length})
          </h2>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Entité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider hidden md:table-cell">Commande</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pending.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-sm text-neutral-200 font-medium">{p.client_name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-400 hidden md:table-cell">{p.entity_name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500 hidden md:table-cell">{p.order_label}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-200">{formatCents(p.amount_cents)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'overdue' ? 'destructive' : 'warning'}>
                        {p.status === 'overdue' ? 'En retard' : 'En attente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setModalPayment(p)}
                      >
                        Pointer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table paid */}
      {paid.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            Pointés ({paid.length})
          </h2>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden opacity-60">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paid.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-neutral-400">{p.client_name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-400">{formatCents(p.amount_cents)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="success">Payé</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal pointage */}
      <Dialog open={!!modalPayment} onOpenChange={(open) => { if (!open) setModalPayment(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pointer le paiement</DialogTitle>
            <DialogDescription>
              {modalPayment?.client_name} — {modalPayment && formatCents(modalPayment.amount_cents)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="block mb-2">Mode de paiement</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="reference">Référence (optionnel)</Label>
              <Input
                id="reference"
                type="text"
                placeholder="N° chèque, réf virement..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalPayment(null)} type="button">
              Annuler
            </Button>
            <Button onClick={handlePointer} disabled={loading} type="button">
              {loading ? 'Enregistrement...' : 'Confirmer le pointage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBasket } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart';
import { formatCents } from '@/lib/utils';

type Props = {
  disabled?: boolean;
};

export default function CartSummaryBar({ disabled = false }: Props) {
  const router = useRouter();
  const { lines, totalCents, lineCount } = useCartStore();

  const count = lineCount();
  const total = totalCents();

  if (count === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-4 z-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between px-5 py-4 bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center">
              <ShoppingBasket className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-50">
                {count} {count > 1 ? 'produits' : 'produit'}
              </p>
              <p className="text-xs text-neutral-400">
                {lines.length} {lines.length > 1 ? 'références' : 'référence'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-neutral-50">{formatCents(total)}</span>
            <button
              type="button"
              onClick={() => router.push('/shop/checkout')}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-xl shadow-lg shadow-white/10 hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Valider ma commande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

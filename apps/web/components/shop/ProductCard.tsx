'use client';

import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart';
import { formatCents } from '@/lib/utils';

type Props = {
  product_id: string;
  product_name: string;
  description?: string | null;
  unit_price_cents: number;
  weekly_catalog_id: string;
  producer_id: string;
  is_available: boolean;
  disabled?: boolean;
};

export default function ProductCard({
  product_id,
  product_name,
  description,
  unit_price_cents,
  weekly_catalog_id,
  producer_id,
  is_available,
  disabled = false,
}: Props) {
  const { lines, add, update } = useCartStore();

  const currentLine = lines.find((l) => l.product_id === product_id);
  const qty = currentLine?.quantity ?? 0;

  const handleAdd = () => {
    if (!is_available || disabled) return;
    add({
      product_id,
      product_name,
      unit_price_cents,
      quantity: 1,
      weekly_catalog_id,
      producer_id,
    });
  };

  const handleDecrement = () => {
    update(product_id, qty - 1);
  };

  const handleIncrement = () => {
    if (!is_available || disabled) return;
    update(product_id, qty + 1);
  };

  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/15 ${
        !is_available ? 'opacity-50' : ''
      }`}
    >
      {/* Photo placeholder */}
      <div className="w-full h-24 rounded-xl bg-white/[0.03] border border-white/5 mb-4 flex items-center justify-center">
        <span className="text-3xl">🥬</span>
      </div>

      <p className="text-sm font-semibold text-neutral-50 mb-1">{product_name}</p>
      {description && (
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{description}</p>
      )}

      <div className="flex items-center justify-between mt-auto">
        <span className="text-base font-bold text-neutral-50">
          {formatCents(unit_price_cents)}
        </span>

        {is_available && !disabled ? (
          qty === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200"
              aria-label={`Ajouter ${product_name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrement}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
                aria-label="Diminuer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center text-sm text-neutral-50 font-medium">
                {qty}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center hover:bg-neutral-200 active:scale-[0.98] transition-all duration-200"
                aria-label="Augmenter"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        ) : (
          <span className="text-xs text-neutral-600">
            {!is_available ? 'Indisponible' : 'Bloqué'}
          </span>
        )}
      </div>
    </div>
  );
}

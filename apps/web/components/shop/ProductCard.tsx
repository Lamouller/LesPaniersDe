'use client';

import React from 'react';
import { Plus, Minus, ShoppingBasket, Apple, Egg, MoreHorizontal } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart';
import { formatCents } from '@/lib/utils';

type ProductKind = 'basket' | 'fruit_option' | 'egg_option' | 'other';

type Props = {
  product_id: string;
  product_name: string;
  description?: string | null;
  photo_url?: string | null;
  kind?: ProductKind;
  unit_price_cents: number;
  weekly_catalog_id: string;
  producer_id: string;
  is_available: boolean;
  disabled?: boolean;
};

const KIND_BG: Record<ProductKind, string> = {
  basket: 'from-green-600/30 to-green-600/10',
  fruit_option: 'from-amber-500/30 to-amber-500/10',
  egg_option: 'from-yellow-400/30 to-yellow-400/10',
  other: 'from-neutral-500/30 to-neutral-500/10',
};

const KIND_ICON_COLOR: Record<ProductKind, string> = {
  basket: 'text-green-500/60',
  fruit_option: 'text-amber-500/60',
  egg_option: 'text-yellow-400/60',
  other: 'text-muted-foreground/60',
};

function KindFallbackIcon({ kind }: { kind: ProductKind }) {
  const cls = 'w-10 h-10';
  if (kind === 'basket') return <ShoppingBasket className={cls} />;
  if (kind === 'fruit_option') return <Apple className={cls} />;
  if (kind === 'egg_option') return <Egg className={cls} />;
  return <MoreHorizontal className={cls} />;
}

export default function ProductCard({
  product_id,
  product_name,
  description,
  photo_url,
  kind = 'other',
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
      className={`bg-white/5 backdrop-blur-xl border border-border rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:bg-white/[0.07] hover:border-border/70 ${
        !is_available ? 'opacity-50' : ''
      }`}
    >
      {/* Photo / Fallback */}
      <div className="w-full aspect-[4/3] overflow-hidden">
        {photo_url ? (
          <img
            src={photo_url}
            alt={product_name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${KIND_BG[kind]} flex items-center justify-center`}>
            <span className={KIND_ICON_COLOR[kind]}>
              <KindFallbackIcon kind={kind} />
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4">
        <p className="text-sm font-semibold text-foreground mb-1">{product_name}</p>
        {description && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">{description}</p>
        )}

        <div className="flex items-center justify-between mt-auto">
          <span className="text-base font-bold text-foreground">
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
                  className="w-8 h-8 rounded-lg bg-white/5 border border-border flex items-center justify-center text-foreground/70 hover:bg-white/10 active:scale-[0.98] transition-all duration-200"
                  aria-label="Diminuer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm text-foreground font-medium">
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
            <span className="text-xs text-muted-foreground/60">
              {!is_available ? 'Indisponible' : 'Bloqué'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

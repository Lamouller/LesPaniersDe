'use client';

import React, { useState, useCallback } from 'react';
import { Package, ShoppingBasket, Apple, Egg, MoreHorizontal, Plus, Check, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { euroToCents, centsToEuro } from '@/lib/utils';
import type { Product } from './page';

// ─── Zod schemas ────────────────────────────────────────────────────────────

const kindValues = ['basket', 'fruit_option', 'egg_option', 'other'] as const;
const sizeValues = ['S', 'M', 'L', 'XL'] as const;

const createProductSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  kind: z.enum(kindValues),
  size: z.enum(sizeValues).nullable().optional(),
  description: z.string().optional(),
  price_euro: z
    .string()
    .min(1, 'Prix requis')
    .refine((v) => !isNaN(parseFloat(v.replace(',', '.'))), 'Prix invalide')
    .refine((v) => parseFloat(v.replace(',', '.')) >= 0, 'Prix doit être >= 0'),
  photo_url: z.string().optional(),
  is_active: z.boolean(),
});

type CreateProductForm = z.infer<typeof createProductSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<Product['kind'], string> = {
  basket: 'Paniers',
  fruit_option: 'Options fruits',
  egg_option: 'Options œufs',
  other: 'Autres',
};

const KIND_ORDER: Product['kind'][] = ['basket', 'fruit_option', 'egg_option', 'other'];

function KindIcon({ kind }: { kind: Product['kind'] }) {
  const cls = 'w-4 h-4';
  if (kind === 'basket') return <ShoppingBasket className={cls} />;
  if (kind === 'fruit_option') return <Apple className={cls} />;
  if (kind === 'egg_option') return <Egg className={cls} />;
  return <MoreHorizontal className={cls} />;
}

// ─── Row state type ──────────────────────────────────────────────────────────

interface RowState {
  name: string;
  kind: Product['kind'];
  size: Product['size'];
  price_euro: string;
  is_active: boolean;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

// ─── ProductRow ──────────────────────────────────────────────────────────────

interface ProductRowProps {
  product: Product;
  readOnly: boolean;
  onSoftDelete: (id: string) => void;
}

function ProductRow({ product, readOnly, onSoftDelete }: ProductRowProps) {
  const [state, setState] = useState<RowState>({
    name: product.name,
    kind: product.kind,
    size: product.size,
    price_euro: centsToEuro(product.unit_price_cents),
    is_active: product.is_active,
    dirty: false,
    saving: false,
    saved: false,
    error: null,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  function update<K extends keyof RowState>(field: K, value: RowState[K]) {
    setState((prev) => ({ ...prev, [field]: value, dirty: true, saved: false, error: null }));
  }

  async function handleSave() {
    if (readOnly || !state.dirty) return;

    // Client-side validation
    if (!state.name.trim()) {
      setState((prev) => ({ ...prev, error: 'Nom requis' }));
      return;
    }
    const cents = euroToCents(state.price_euro);
    if (isNaN(cents) || cents < 0) {
      setState((prev) => ({ ...prev, error: 'Prix invalide' }));
      return;
    }

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const res = await fetch(`/api/producers/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name.trim(),
          kind: state.kind,
          size: state.kind === 'basket' ? state.size : null,
          unit_price_cents: cents,
          is_active: state.is_active,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setState((prev) => ({ ...prev, saving: false, error: data.error ?? 'Erreur serveur' }));
        return;
      }
      setState((prev) => ({ ...prev, saving: false, dirty: false, saved: true, error: null }));
      setTimeout(() => setState((prev) => ({ ...prev, saved: false })), 2000);
    } catch {
      setState((prev) => ({ ...prev, saving: false, error: 'Erreur réseau' }));
    }
  }

  async function handleDelete() {
    if (readOnly) return;
    setState((prev) => ({ ...prev, saving: true }));
    try {
      const res = await fetch(`/api/producers/products/${product.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setState((prev) => ({ ...prev, saving: false, error: data.error ?? 'Erreur serveur' }));
        return;
      }
      onSoftDelete(product.id);
    } catch {
      setState((prev) => ({ ...prev, saving: false, error: 'Erreur réseau' }));
    }
  }

  const inputCls = `w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-neutral-100
    focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
      {/* Nom */}
      <td className="py-2.5 px-3">
        <input
          type="text"
          value={state.name}
          onChange={(e) => update('name', e.target.value)}
          disabled={readOnly}
          className={inputCls}
          placeholder="Nom du produit"
        />
      </td>

      {/* Type */}
      <td className="py-2.5 px-3">
        <select
          value={state.kind}
          onChange={(e) => update('kind', e.target.value as Product['kind'])}
          disabled={readOnly}
          className={inputCls}
        >
          <option value="basket">Panier</option>
          <option value="fruit_option">Option fruits</option>
          <option value="egg_option">Option œufs</option>
          <option value="other">Autre</option>
        </select>
      </td>

      {/* Taille */}
      <td className="py-2.5 px-3">
        {state.kind === 'basket' ? (
          <select
            value={state.size ?? ''}
            onChange={(e) => update('size', (e.target.value || null) as Product['size'])}
            disabled={readOnly}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
          </select>
        ) : (
          <span className="text-neutral-600 text-sm px-2">—</span>
        )}
      </td>

      {/* Prix */}
      <td className="py-2.5 px-3">
        <div className="relative">
          <input
            type="text"
            value={state.price_euro}
            onChange={(e) => update('price_euro', e.target.value)}
            disabled={readOnly}
            className={`${inputCls} pr-6`}
            placeholder="0,00"
            inputMode="decimal"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">€</span>
        </div>
      </td>

      {/* Actif */}
      <td className="py-2.5 px-3 text-center">
        <button
          type="button"
          onClick={() => !readOnly && update('is_active', !state.is_active)}
          disabled={readOnly}
          className={`w-9 h-5 rounded-full transition-colors duration-200 relative flex-shrink-0
            ${state.is_active ? 'bg-primary' : 'bg-white/10'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={state.is_active ? 'Désactiver' : 'Activer'}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${state.is_active ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
      </td>

      {/* Actions */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5 justify-end">
          {state.error && (
            <span className="text-xs text-red-400 max-w-[120px] truncate" title={state.error}>
              {state.error}
            </span>
          )}
          {state.saved && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> enregistré
            </span>
          )}
          {!readOnly && state.dirty && !state.saving && (
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              title="Enregistrer"
            >
              💾
            </button>
          )}
          {state.saving && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
          {!readOnly && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Supprimer (désactiver)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!readOnly && confirmDelete && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400">Confirmer ?</span>
              <button
                type="button"
                onClick={() => { void handleDelete(); }}
                className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 text-xs rounded bg-white/5 text-neutral-400 hover:bg-white/10 transition-colors"
              >
                Non
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── CreateProductModal ──────────────────────────────────────────────────────

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  producerId: string;
  onCreated: (product: Product) => void;
}

function CreateProductModal({ open, onClose, producerId, onCreated }: CreateProductModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductForm>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      kind: 'basket',
      size: null,
      description: '',
      price_euro: '',
      photo_url: '',
      is_active: true,
    },
  });

  const watchKind = watch('kind');

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  async function onSubmit(values: CreateProductForm) {
    setServerError(null);
    const unit_price_cents = euroToCents(values.price_euro);

    const res = await fetch('/api/producers/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name.trim(),
        kind: values.kind,
        size: values.kind === 'basket' ? (values.size ?? null) : null,
        description: values.description?.trim() || null,
        photo_url: values.photo_url?.trim() || null,
        unit_price_cents,
        is_active: values.is_active,
        producer_id: producerId,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setServerError(data.error ?? 'Erreur serveur');
      return;
    }

    const data = (await res.json()) as { product: Product };
    onCreated(data.product);
    handleClose();
  }

  const inputCls = `w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-100
    focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors`;
  const errorCls = 'text-xs text-red-400 mt-1';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau produit</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="create-name">Nom *</Label>
            <input
              id="create-name"
              type="text"
              className={inputCls}
              placeholder="Ex: Panier XL premium"
              {...register('name')}
            />
            {errors.name && <p className={errorCls}>{errors.name.message}</p>}
          </div>

          {/* Type + Taille */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-kind">Type *</Label>
              <select id="create-kind" className={inputCls} {...register('kind')}>
                <option value="basket">Panier</option>
                <option value="fruit_option">Option fruits</option>
                <option value="egg_option">Option œufs</option>
                <option value="other">Autre</option>
              </select>
            </div>
            {watchKind === 'basket' && (
              <div className="space-y-1.5">
                <Label htmlFor="create-size">Taille</Label>
                <select id="create-size" className={inputCls} {...register('size')}>
                  <option value="">—</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              </div>
            )}
          </div>

          {/* Prix */}
          <div className="space-y-1.5">
            <Label htmlFor="create-price">Prix € *</Label>
            <div className="relative">
              <input
                id="create-price"
                type="text"
                className={`${inputCls} pr-8`}
                placeholder="Ex: 22,50"
                inputMode="decimal"
                {...register('price_euro')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">€</span>
            </div>
            {errors.price_euro && <p className={errorCls}>{errors.price_euro.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="create-desc">Description</Label>
            <textarea
              id="create-desc"
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Description optionnelle"
              {...register('description')}
            />
          </div>

          {/* Photo URL */}
          <div className="space-y-1.5">
            <Label htmlFor="create-photo">URL photo</Label>
            <input
              id="create-photo"
              type="text"
              className={inputCls}
              placeholder="https://..."
              {...register('photo_url')}
            />
          </div>

          {/* Actif */}
          <div className="flex items-center gap-3">
            <input
              id="create-active"
              type="checkbox"
              className="w-4 h-4 rounded accent-primary"
              {...register('is_active')}
            />
            <Label htmlFor="create-active">Produit actif</Label>
          </div>

          {serverError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ProductsTableClient ─────────────────────────────────────────────────────

interface ProductsTableClientProps {
  initialProducts: Product[];
  readOnly: boolean;
  producerId: string;
}

export function ProductsTableClient({ initialProducts, readOnly, producerId }: ProductsTableClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSoftDelete = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleCreated = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
  }, []);

  const displayed = showInactive ? products : products.filter((p) => p.is_active);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: displayed.filter((p) => p.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Mes produits</h1>
            <p className="text-sm text-neutral-500">Catalogue permanent — édition des prix et infos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 border border-white/10 hover:bg-white/5 transition-colors"
          >
            {showInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showInactive ? 'Masquer inactifs' : 'Afficher inactifs'}
          </button>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un produit
            </Button>
          )}
        </div>
      </div>

      {/* Sections par kind */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-neutral-500">
            Aucun produit{!showInactive ? ' actif' : ''} pour le moment.
          </CardContent>
        </Card>
      ) : (
        grouped.map(({ kind, items }) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-neutral-300">
                <KindIcon kind={kind} />
                {KIND_LABELS[kind]}
                <span className="text-xs text-neutral-600 font-normal">({items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-white/5">
                      <th className="py-2 px-3 font-medium">Nom</th>
                      <th className="py-2 px-3 font-medium">Type</th>
                      <th className="py-2 px-3 font-medium">Taille</th>
                      <th className="py-2 px-3 font-medium">Prix</th>
                      <th className="py-2 px-3 font-medium text-center">Actif</th>
                      <th className="py-2 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        readOnly={readOnly}
                        onSoftDelete={handleSoftDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {!readOnly && (
        <CreateProductModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          producerId={producerId}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

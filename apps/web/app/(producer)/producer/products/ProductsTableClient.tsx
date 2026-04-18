'use client';

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Package,
  ShoppingBasket,
  Apple,
  Egg,
  MoreHorizontal,
  Plus,
  Check,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  Info,
  Pencil,
  Upload,
  ImageOff,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { euroToCents, centsToEuro } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Product } from './page';

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const kindValues = ['basket', 'fruit_option', 'egg_option', 'other'] as const;
const sizeValues = ['S', 'M', 'L', 'XL'] as const;

const productFormSchema = z.object({
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

type ProductForm = z.infer<typeof productFormSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<Product['kind'], string> = {
  basket: 'Paniers',
  fruit_option: 'Options fruits',
  egg_option: 'Options œufs',
  other: 'Autres',
};

const KIND_BADGE: Record<Product['kind'], string> = {
  basket: 'Panier',
  fruit_option: 'Fruits',
  egg_option: 'Œufs',
  other: 'Autre',
};

const KIND_ORDER: Product['kind'][] = ['basket', 'fruit_option', 'egg_option', 'other'];

const KIND_BG: Record<Product['kind'], string> = {
  basket: 'from-primary/30 to-primary/10',
  fruit_option: 'from-amber-500/30 to-amber-500/10',
  egg_option: 'from-yellow-400/30 to-yellow-400/10',
  other: 'from-neutral-500/30 to-neutral-500/10',
};

const KIND_ICON_COLOR: Record<Product['kind'], string> = {
  basket: 'text-primary/60',
  fruit_option: 'text-amber-500/60',
  egg_option: 'text-yellow-400/60',
  other: 'text-muted-foreground/60',
};

const KIND_BADGE_COLOR: Record<Product['kind'], string> = {
  basket: 'bg-primary/20 text-primary border-primary/30',
  fruit_option: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  egg_option: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  other: 'bg-muted text-muted-foreground border-border',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KindIcon({ kind, className }: { kind: Product['kind']; className?: string }) {
  const cls = className ?? 'w-4 h-4';
  if (kind === 'basket') return <ShoppingBasket className={cls} />;
  if (kind === 'fruit_option') return <Apple className={cls} />;
  if (kind === 'egg_option') return <Egg className={cls} />;
  return <MoreHorizontal className={cls} />;
}

function KindBadge({ kind }: { kind: Product['kind'] }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${KIND_BADGE_COLOR[kind]}`}>
      <KindIcon kind={kind} className="w-3 h-3" />
      {KIND_BADGE[kind]}
    </span>
  );
}

// ─── Photo upload helper ──────────────────────────────────────────────────────

async function uploadProductPhoto(
  file: File,
  producerId: string,
  productId: string,
): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${producerId}/${productId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('products').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    console.error('[uploadProductPhoto]', error);
    return null;
  }

  const { data } = supabase.storage.from('products').getPublicUrl(path);
  return data.publicUrl;
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
  readOnly: boolean;
  onSoftDelete: (id: string) => void;
  onUpdated: (product: Product) => void;
  onEdit: () => void;
}

function ProductCard({ product, readOnly, onSoftDelete, onUpdated, onEdit }: ProductCardProps) {
  const [isActive, setIsActive] = useState(product.is_active);
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [priceStr, setPriceStr] = useState(centsToEuro(product.unit_price_cents));
  const [priceDirty, setPriceDirty] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  async function handleToggle() {
    if (readOnly || toggling) return;
    setToggling(true);
    const newActive = !isActive;
    try {
      const res = await fetch(`/api/producers/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (res.ok) {
        setIsActive(newActive);
        const d = (await res.json()) as { product: Product };
        onUpdated(d.product);
      }
    } finally {
      setToggling(false);
    }
  }

  async function handlePriceSave() {
    if (readOnly || !priceDirty) return;
    const cents = euroToCents(priceStr);
    if (isNaN(cents) || cents < 0) {
      setPriceError('Prix invalide');
      return;
    }
    setPriceSaving(true);
    setPriceError(null);
    try {
      const res = await fetch(`/api/producers/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_price_cents: cents }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setPriceError(d.error ?? 'Erreur');
      } else {
        const d = (await res.json()) as { product: Product };
        onUpdated(d.product);
        setPriceDirty(false);
        setPriceSaved(true);
        setTimeout(() => setPriceSaved(false), 2000);
      }
    } catch {
      setPriceError('Erreur réseau');
    } finally {
      setPriceSaving(false);
    }
  }

  async function handleDelete() {
    if (readOnly || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/producers/products/${product.id}`, { method: 'DELETE' });
      if (res.ok) {
        onSoftDelete(product.id);
      } else {
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const priceCls =
    'w-full pl-3 pr-8 py-2 text-2xl font-bold text-primary bg-white/5 border border-border rounded-lg focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const [imgError, setImgError] = useState(false);
  const showFallback = !product.photo_url || imgError;

  return (
    <div className="group relative bg-white/5 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-xl hover:border-white/20 hover:bg-white/[0.07] transition-all duration-300">
      {/* Photo zone */}
      <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${KIND_BG[product.kind]}`}>
        {!showFallback && (
          <img
            src={product.photo_url!}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        )}
        {showFallback && (
          <div className="w-full h-full flex items-center justify-center">
            <KindIcon kind={product.kind} className={`w-16 h-16 ${KIND_ICON_COLOR[product.kind]}`} />
          </div>
        )}

        {/* Gradient bas */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-neutral-950/60 to-transparent pointer-events-none" />

        {/* Kind badge — haut gauche */}
        <div className="absolute top-2 left-2">
          <KindBadge kind={product.kind} />
        </div>

        {/* Toggle actif — haut droite */}
        <div className="absolute top-2 right-2">
          <button
            type="button"
            onClick={() => { void handleToggle(); }}
            disabled={readOnly || toggling}
            aria-label={isActive ? 'Désactiver' : 'Activer'}
            className={`w-10 h-5 rounded-full transition-colors duration-200 relative flex-shrink-0 shadow-md
              ${isActive ? 'bg-primary' : 'bg-neutral-700'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3">
        {/* Nom + taille */}
        <div>
          <h3 className="font-semibold text-lg text-foreground leading-tight">{product.name}</h3>
          {product.size && product.kind === 'basket' && (
            <span className="inline-block mt-0.5 text-xs font-medium text-muted-foreground bg-white/5 border border-border rounded px-1.5 py-0.5">
              Taille {product.size}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {product.description}
          </p>
        )}

        {/* Prix éditable inline */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={priceStr}
                onChange={(e) => {
                  setPriceStr(e.target.value);
                  setPriceDirty(true);
                  setPriceSaved(false);
                  setPriceError(null);
                }}
                onBlur={() => { if (priceDirty) void handlePriceSave(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handlePriceSave(); }}
                disabled={readOnly}
                inputMode="decimal"
                className={priceCls}
                placeholder="0,00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-primary/60 font-bold pointer-events-none">€</span>
            </div>
            {priceError && <p className="text-xs text-red-400 mt-1">{priceError}</p>}
          </div>
          {priceSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0 mb-2" />}
          {priceSaved && <Check className="w-4 h-4 text-green-400 flex-shrink-0 mb-2" />}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground/70 bg-white/5 border border-border hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Éditer
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-400">Supprimer ?</span>
                <button
                  type="button"
                  onClick={() => { void handleDelete(); }}
                  disabled={deleting}
                  className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Oui'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
                >
                  Non
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProductEditModal ─────────────────────────────────────────────────────────

interface ProductEditModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  onUpdated: (product: Product) => void;
}

function ProductEditModal({ open, onClose, product, onUpdated }: ProductEditModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product.photo_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product.name,
      kind: product.kind,
      size: product.size,
      description: product.description ?? '',
      price_euro: centsToEuro(product.unit_price_cents),
      photo_url: product.photo_url ?? '',
      is_active: product.is_active,
    },
  });

  const watchKind = watch('kind');

  function handleClose() {
    reset({
      name: product.name,
      kind: product.kind,
      size: product.size,
      description: product.description ?? '',
      price_euro: centsToEuro(product.unit_price_cents),
      photo_url: product.photo_url ?? '',
      is_active: product.is_active,
    });
    setServerError(null);
    setPreviewUrl(product.photo_url);
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploadingPhoto(true);
    try {
      const url = await uploadProductPhoto(file, product.producer_id, product.id);
      if (url) {
        setValue('photo_url', url);
        setPreviewUrl(url);
      } else {
        setServerError('Erreur upload photo — vérifiez la connexion');
        setPreviewUrl(product.photo_url);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSubmit(values: ProductForm) {
    setServerError(null);
    const unit_price_cents = euroToCents(values.price_euro);

    const res = await fetch(`/api/producers/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name.trim(),
        kind: values.kind,
        size: values.kind === 'basket' ? (values.size ?? null) : null,
        description: values.description?.trim() || null,
        photo_url: values.photo_url?.trim() || null,
        unit_price_cents,
        is_active: values.is_active,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setServerError(data.error ?? 'Erreur serveur');
      return;
    }

    const data = (await res.json()) as { product: Product };
    onUpdated(data.product);
    onClose();
  }

  const inputCls = `w-full px-3 py-2 bg-white/5 border border-border rounded-xl text-sm text-foreground
    focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors`;
  const errorCls = 'text-xs text-red-400 mt-1';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le produit</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-white/5 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground/60" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { void handleFileChange(e); }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground/70 bg-white/5 border border-border hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingPhoto ? 'Upload en cours…' : 'Choisir une photo'}
                </button>
                <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP · Max 5 Mo</p>
                <input
                  type="text"
                  className={`${inputCls} text-xs`}
                  placeholder="Ou coller une URL d'image"
                  {...register('photo_url')}
                  onChange={(e) => {
                    setValue('photo_url', e.target.value);
                    if (e.target.value) setPreviewUrl(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${product.id}`}>Nom *</Label>
            <input
              id={`edit-name-${product.id}`}
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
              <Label htmlFor={`edit-kind-${product.id}`}>Type *</Label>
              <select id={`edit-kind-${product.id}`} className={inputCls} {...register('kind')}>
                <option value="basket">Panier</option>
                <option value="fruit_option">Option fruits</option>
                <option value="egg_option">Option œufs</option>
                <option value="other">Autre</option>
              </select>
            </div>
            {watchKind === 'basket' && (
              <div className="space-y-1.5">
                <Label htmlFor={`edit-size-${product.id}`}>Taille</Label>
                <select id={`edit-size-${product.id}`} className={inputCls} {...register('size')}>
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
            <Label htmlFor={`edit-price-${product.id}`}>Prix € *</Label>
            <div className="relative">
              <input
                id={`edit-price-${product.id}`}
                type="text"
                className={`${inputCls} pr-8`}
                placeholder="Ex: 22,50"
                inputMode="decimal"
                {...register('price_euro')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
            </div>
            {errors.price_euro && <p className={errorCls}>{errors.price_euro.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor={`edit-desc-${product.id}`}>Description</Label>
            <textarea
              id={`edit-desc-${product.id}`}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Description optionnelle"
              {...register('description')}
            />
          </div>

          {/* Actif */}
          <div className="flex items-center gap-3">
            <input
              id={`edit-active-${product.id}`}
              type="checkbox"
              className="w-4 h-4 rounded accent-primary"
              {...register('is_active')}
            />
            <Label htmlFor={`edit-active-${product.id}`}>Produit actif</Label>
          </div>

          {serverError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting || uploadingPhoto}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || uploadingPhoto}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CreateProductModal ───────────────────────────────────────────────────────

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  producerId: string;
  onCreated: (product: Product) => void;
}

function CreateProductModal({ open, onClose, producerId, onCreated }: CreateProductModalProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
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
    setPreviewUrl(null);
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploadingPhoto(true);

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const tempId = `new-${Date.now()}`;
      const path = `${producerId}/${tempId}.${ext}`;

      const { error } = await supabase.storage.from('products').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

      if (!error) {
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        setValue('photo_url', data.publicUrl);
        setPreviewUrl(data.publicUrl);
      } else {
        setServerError('Erreur upload photo');
        setPreviewUrl(null);
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onSubmit(values: ProductForm) {
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

  const inputCls = `w-full px-3 py-2 bg-white/5 border border-border rounded-xl text-sm text-foreground
    focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors`;
  const errorCls = 'text-xs text-red-400 mt-1';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau produit</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-white/5 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-8 h-8 text-muted-foreground/60" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { void handleFileChange(e); }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-foreground/70 bg-white/5 border border-border hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingPhoto ? 'Upload…' : 'Choisir une photo'}
                </button>
                <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP · Max 5 Mo</p>
                <input
                  type="text"
                  className={`${inputCls} text-xs`}
                  placeholder="Ou coller une URL d'image"
                  {...register('photo_url')}
                  onChange={(e) => {
                    setValue('photo_url', e.target.value);
                    if (e.target.value) setPreviewUrl(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

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
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting || uploadingPhoto}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || uploadingPhoto}>
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

// ─── ProductsTableClient (main export) ───────────────────────────────────────

interface ProductsTableClientProps {
  initialProducts: Product[];
  readOnly: boolean;
  producerId: string;
}

export function ProductsTableClient({
  initialProducts,
  readOnly,
  producerId,
}: ProductsTableClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleSoftDelete = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleCreated = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
  }, []);

  const handleUpdated = useCallback((updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const displayed = showInactive ? products : products.filter((p) => p.is_active);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: displayed.filter((p) => p.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Mes produits</h1>
            <p className="text-sm text-muted-foreground">
              Catalogue permanent — photos, prix et descriptions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground border border-border hover:bg-white/5 transition-colors"
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

      {/* Hint catalogue hebdo */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>
          Pour ouvrir des commandes, rendez-vous dans{' '}
          <Link href="/producer/catalog" className="text-primary hover:underline font-medium">
            Catalogue hebdo →
          </Link>
        </span>
      </div>

      {/* Grille par section */}
      {grouped.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl py-16 text-center">
          <Package className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Aucun produit{!showInactive ? ' actif' : ''} pour le moment.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter votre premier produit
            </button>
          )}
        </div>
      ) : (
        grouped.map(({ kind, items }) => (
          <section key={kind} className="space-y-4">
            <div className="flex items-center gap-2">
              <KindIcon kind={kind} className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
                {KIND_LABELS[kind]}
              </h2>
              <span className="text-xs text-muted-foreground/60">({items.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  readOnly={readOnly}
                  onSoftDelete={handleSoftDelete}
                  onUpdated={handleUpdated}
                  onEdit={() => setEditingProduct(product)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Modal création */}
      {!readOnly && (
        <CreateProductModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          producerId={producerId}
          onCreated={handleCreated}
        />
      )}

      {/* Modal édition */}
      {editingProduct && (
        <ProductEditModal
          open
          onClose={() => setEditingProduct(null)}
          product={editingProduct}
          onUpdated={(updated) => {
            handleUpdated(updated);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

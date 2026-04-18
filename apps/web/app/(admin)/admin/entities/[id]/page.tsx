'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const entitySchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  slug: z.string().min(2, 'Slug requis').regex(/^[a-z0-9-]+$/, 'Slug : minuscules, chiffres et tirets uniquement'),
  description: z.string().optional(),
  address: z.string().optional(),
  pickup_address: z.string().optional(),
  pickup_lat: z.coerce.number().nullable().optional(),
  pickup_lng: z.coerce.number().nullable().optional(),
  pickup_instructions: z.string().optional(),
  contact_email: z.string().email('Email invalide').or(z.literal('')).optional(),
  contact_phone: z.string().optional(),
  is_active: z.boolean(),
});

type EntityFormData = z.infer<typeof entitySchema>;

export default function AdminEntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: { is_active: true },
  });

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      const { data } = await supabase
        .from('entities')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        reset({
          name: data.name ?? '',
          slug: data.slug ?? '',
          description: data.description ?? '',
          address: data.address ?? '',
          pickup_address: data.pickup_address ?? '',
          pickup_lat: data.pickup_lat ?? null,
          pickup_lng: data.pickup_lng ?? null,
          pickup_instructions: data.pickup_instructions ?? '',
          contact_email: data.contact_email ?? '',
          contact_phone: data.contact_phone ?? '',
          is_active: data.is_active ?? true,
        });
      }
      setLoading(false);
    })();
  }, [id, isNew, supabase, reset]);

  async function onSubmit(data: EntityFormData) {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const url = isNew ? '/api/entities' : `/api/entities/${id}`;
    const method = isNew ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json() as { error?: string; entity?: { id: string } };

    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la sauvegarde');
    } else {
      setSuccess(true);
      if (isNew && json.entity?.id) {
        router.push(`/admin/entities/${json.entity.id}`);
      }
    }
    setSaving(false);
  }

  async function handleDeactivate() {
    if (!confirm('Désactiver cette entité ? Les membres ne seront plus redirigés vers elle.')) return;
    const res = await fetch(`/api/entities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
    if (res.ok) router.push('/admin/entities');
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/entities">
          <Button type="button" size="sm" variant="ghost">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Building2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isNew ? 'Nouvelle entité' : 'Modifier l\'entité'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Informations générales</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Nom *</label>
              <input
                {...register('name')}
                type="text"
                placeholder="Open Space du Centre"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Slug *</label>
              <input
                {...register('slug')}
                type="text"
                placeholder="open-space-du-centre"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.slug && <p className="text-xs text-red-400">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/70">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Description de l'entité..."
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              {...register('is_active')}
              type="checkbox"
              id="is_active"
              className="w-4 h-4 rounded border-white/20 bg-white/5 accent-white cursor-pointer"
            />
            <label htmlFor="is_active" className="text-sm text-foreground/70 cursor-pointer">
              Entité active (visible pour les clients)
            </label>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Adresses</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/70">Adresse postale</label>
            <input
              {...register('address')}
              type="text"
              placeholder="12 rue des Entrepreneurs, 75011 Paris"
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/70">Lieu de retrait</label>
            <input
              {...register('pickup_address')}
              type="text"
              placeholder="Salle café, rez-de-chaussée"
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Latitude</label>
              <input
                {...register('pickup_lat')}
                type="number"
                step="0.000001"
                placeholder="48.8566"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Longitude</label>
              <input
                {...register('pickup_lng')}
                type="number"
                step="0.000001"
                placeholder="2.3522"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/70">Instructions de retrait</label>
            <textarea
              {...register('pickup_instructions')}
              rows={3}
              placeholder="Récupérez votre panier le samedi entre 10h et 12h..."
              className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200 resize-none"
            />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-foreground/70 mb-4">Contact</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Email</label>
              <input
                {...register('contact_email')}
                type="email"
                placeholder="contact@entity.fr"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.contact_email && <p className="text-xs text-red-400">{errors.contact_email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70">Téléphone</label>
              <input
                {...register('contact_phone')}
                type="text"
                placeholder="+33 1 23 45 67 89"
                className="w-full px-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            Entité sauvegardée avec succès.
          </p>
        )}

        <div className="flex items-center justify-between">
          {!isNew && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDeactivate}>
              <Trash2 className="w-4 h-4" />
              Désactiver
            </Button>
          )}
          <div className="ml-auto">
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

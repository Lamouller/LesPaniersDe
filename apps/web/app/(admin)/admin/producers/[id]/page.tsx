'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tractor, ArrowLeft, Save, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const producerSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug : minuscules, chiffres et tirets'),
  bio: z.string().optional().nullable(),
  photo_url: z.string().url('URL invalide').or(z.literal('')).optional().nullable(),
  contact_email: z.string().email('Email invalide').or(z.literal('')).optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  default_order_deadline_hours: z.coerce.number().int().min(1).default(48),
  payment_reminder_days: z.coerce.number().int().min(1).default(3),
  payment_block_days: z.coerce.number().int().min(1).default(7),
  whatsapp_enabled: z.boolean().default(false),
  whatsapp_phone_id: z.string().optional().nullable(),
  whatsapp_access_token: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type ProducerFormData = z.infer<typeof producerSchema>;

interface EntityOption {
  id: string;
  name: string;
}

interface ProducerEntityLink {
  entity_id: string;
  entity_name: string;
  delivery_day: number | null;
  time_from: string | null;
  time_to: string | null;
  is_active: boolean;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function AdminProducerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [producerLinks, setProducerLinks] = useState<ProducerEntityLink[]>([]);
  const [allEntities, setAllEntities] = useState<EntityOption[]>([]);
  const [addEntityId, setAddEntityId] = useState('');

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProducerFormData>({
    resolver: zodResolver(producerSchema),
    defaultValues: {
      is_active: true,
      whatsapp_enabled: false,
      default_order_deadline_hours: 48,
      payment_reminder_days: 3,
      payment_block_days: 7,
    },
  });

  const whatsappEnabled = watch('whatsapp_enabled');

  useEffect(() => {
    void (async () => {
      const { data: entData } = await supabase
        .from('entities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setAllEntities(entData ?? []);

      if (isNew) return;

      const [{ data: prodData }, { data: linksData }] = await Promise.all([
        supabase.from('producers').select('*').eq('id', id).single(),
        supabase
          .from('producer_entities')
          .select('entity_id, delivery_day, time_from, time_to, is_active, entities!producer_entities_entity_id_fkey(name)')
          .eq('producer_id', id),
      ]);

      if (prodData) {
        reset({
          name: prodData.name ?? '',
          slug: prodData.slug ?? '',
          bio: prodData.bio ?? '',
          photo_url: prodData.photo_url ?? '',
          contact_email: prodData.contact_email ?? '',
          contact_phone: prodData.contact_phone ?? '',
          default_order_deadline_hours: prodData.default_order_deadline_hours ?? 48,
          payment_reminder_days: prodData.payment_reminder_days ?? 3,
          payment_block_days: prodData.payment_block_days ?? 7,
          whatsapp_enabled: prodData.whatsapp_enabled ?? false,
          whatsapp_phone_id: prodData.whatsapp_phone_id ?? '',
          whatsapp_access_token: '',
          is_active: prodData.is_active ?? true,
        });
      }

      type RawLink = {
        entity_id: string;
        delivery_day: number | null;
        time_from: string | null;
        time_to: string | null;
        is_active: boolean;
        entities: { name: string } | null;
      };

      setProducerLinks(
        ((linksData ?? []) as unknown as RawLink[]).map((l) => ({
          entity_id: l.entity_id,
          entity_name: l.entities?.name ?? '—',
          delivery_day: l.delivery_day,
          time_from: l.time_from,
          time_to: l.time_to,
          is_active: l.is_active,
        }))
      );

      setLoading(false);
    })();
  }, [id, isNew, supabase, reset]);

  async function onSubmit(data: ProducerFormData) {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const url = isNew ? '/api/producers' : `/api/producers/${id}`;
    const method = isNew ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json() as { error?: string; producer?: { id: string } };

    if (!res.ok) {
      setError(json.error ?? 'Erreur lors de la sauvegarde');
    } else {
      setSuccess(true);
      if (isNew && json.producer?.id) {
        router.push(`/admin/producers/${json.producer.id}`);
      }
    }
    setSaving(false);
  }

  async function handleAddEntity() {
    if (!addEntityId || isNew) return;

    const res = await fetch('/api/producer-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producer_id: id, entity_id: addEntityId }),
    });

    if (res.ok) {
      const entity = allEntities.find((e) => e.id === addEntityId);
      if (entity) {
        setProducerLinks((prev) => [
          ...prev,
          {
            entity_id: addEntityId,
            entity_name: entity.name,
            delivery_day: null,
            time_from: null,
            time_to: null,
            is_active: true,
          },
        ]);
      }
      setAddEntityId('');
    }
  }

  async function handleRemoveEntity(entityId: string) {
    if (!confirm('Retirer cette entité du producteur ?')) return;

    const res = await fetch('/api/producer-entities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producer_id: id, entity_id: entityId }),
    });

    if (res.ok) {
      setProducerLinks((prev) => prev.filter((l) => l.entity_id !== entityId));
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-sm text-neutral-500">
        Chargement...
      </div>
    );
  }

  const linkedEntityIds = new Set(producerLinks.map((l) => l.entity_id));
  const availableEntities = allEntities.filter((e) => !linkedEntityIds.has(e.id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/producers">
          <Button type="button" size="sm" variant="ghost">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Tractor className="w-5 h-5 text-neutral-400" />
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
          {isNew ? 'Nouveau producteur' : 'Modifier le producteur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations générales */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4">Informations générales</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Nom *</label>
              <input
                {...register('name')}
                type="text"
                placeholder="La Ferme des Collines"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Slug *</label>
              <input
                {...register('slug')}
                type="text"
                placeholder="la-ferme-des-collines"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 font-mono focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.slug && <p className="text-xs text-red-400">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-300">Bio</label>
            <textarea
              {...register('bio')}
              rows={3}
              placeholder="Description du producteur..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-300">URL photo</label>
            <input
              {...register('photo_url')}
              type="url"
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
            />
            {errors.photo_url && <p className="text-xs text-red-400">{errors.photo_url.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Email contact</label>
              <input
                {...register('contact_email')}
                type="email"
                placeholder="ferme@example.fr"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
              {errors.contact_email && <p className="text-xs text-red-400">{errors.contact_email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Téléphone</label>
              <input
                {...register('contact_phone')}
                type="text"
                placeholder="+33 6 ..."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              {...register('is_active')}
              type="checkbox"
              id="prod_is_active"
              className="w-4 h-4 rounded border-white/20 bg-white/5 accent-white cursor-pointer"
            />
            <label htmlFor="prod_is_active" className="text-sm text-neutral-300 cursor-pointer">
              Producteur actif
            </label>
          </div>
        </div>

        {/* Paiement */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4">Paramètres paiement</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Délai commande (h)</label>
              <input
                {...register('default_order_deadline_hours')}
                type="number"
                min={1}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Relance après (j)</label>
              <input
                {...register('payment_reminder_days')}
                type="number"
                min={1}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-300">Blocage après (j)</label>
              <input
                {...register('payment_block_days')}
                type="number"
                min={1}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4">WhatsApp Business</h2>

          <div className="flex items-center gap-3">
            <input
              {...register('whatsapp_enabled')}
              type="checkbox"
              id="whatsapp_enabled"
              className="w-4 h-4 rounded border-white/20 bg-white/5 accent-white cursor-pointer"
            />
            <label htmlFor="whatsapp_enabled" className="text-sm text-neutral-300 cursor-pointer">
              Activer WhatsApp
            </label>
          </div>

          {whatsappEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-300">Phone ID</label>
                <input
                  {...register('whatsapp_phone_id')}
                  type="text"
                  placeholder="123456789012345"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-300">
                  Access Token <span className="text-neutral-600 font-normal">(chiffré au stockage)</span>
                </label>
                <input
                  {...register('whatsapp_access_token')}
                  type="password"
                  placeholder="EAABxx..."
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 transition-all duration-200"
                />
                <p className="text-xs text-neutral-600">Laisser vide pour conserver l&apos;existant.</p>
              </div>
            </div>
          )}
        </div>

        {/* Entités servies (seulement si édition) */}
        {!isNew && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-neutral-300 mb-4">Entités servies</h2>

            {producerLinks.length === 0 ? (
              <p className="text-sm text-neutral-600 mb-4">Aucune entité associée.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {producerLinks.map((link) => (
                  <div key={link.entity_id} className="flex items-center justify-between py-2.5 px-3 bg-white/[0.03] border border-white/5 rounded-xl">
                    <div>
                      <p className="text-sm text-neutral-200">{link.entity_name}</p>
                      <p className="text-xs text-neutral-600">
                        {link.delivery_day !== null ? DAYS[link.delivery_day] ?? `Jour ${link.delivery_day}` : 'Jour non défini'}
                        {link.time_from && link.time_to ? ` · ${link.time_from}–${link.time_to}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={link.is_active ? 'success' : 'default'}>
                        {link.is_active ? 'actif' : 'inactif'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntity(link.entity_id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {availableEntities.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={addEntityId}
                  onChange={(e) => setAddEntityId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-50 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
                >
                  <option value="">Ajouter une entité...</option>
                  {availableEntities.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!addEntityId}
                  onClick={handleAddEntity}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            Producteur sauvegardé avec succès.
          </p>
        )}

        <div className="flex items-center justify-between">
          {!isNew && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!confirm('Désactiver ce producteur ?')) return;
                await fetch(`/api/producers/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_active: false }),
                });
                router.push('/admin/producers');
              }}
            >
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

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Loader2, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Entity } from '@/lib/types/database';

const registerSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  entity_id: z.string().min(1, 'Veuillez sélectionner votre lieu de retrait'),
  gdpr: z.boolean().refine((v) => v === true, 'Vous devez accepter les conditions'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('entities')
      .select('id, name, city')
      .order('name')
      .then(({ data }) => {
        if (data) setEntities(data as Entity[]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: RegisterForm) {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { entity_id: data.entity_id, role: 'client' },
        emailRedirectTo: `${window.location.origin}/shop`,
      },
    });

    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({
        type: 'success',
        text: 'Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inscription</CardTitle>
        <CardDescription>Rejoignez votre communauté locale</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input id="email" type="email" placeholder="vous@exemple.fr" className="pl-9" {...register('email')} />
            </div>
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input id="password" type="password" placeholder="••••••••" className="pl-9" {...register('password')} />
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entity_id">Votre lieu de retrait</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                id="entity_id"
                className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-foreground transition-all duration-200 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 hover:border-white/20 appearance-none"
                {...register('entity_id')}
              >
                <option value="" className="bg-neutral-900">Sélectionnez votre entité</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id} className="bg-neutral-900">
                    {e.name} — {e.city}
                  </option>
                ))}
              </select>
            </div>
            {errors.entity_id && <p className="text-xs text-red-400">{errors.entity_id.message}</p>}
          </div>

          <div className="flex items-start gap-3">
            <input
              id="gdpr"
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/20"
              {...register('gdpr')}
            />
            <Label htmlFor="gdpr" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
              J'accepte les{' '}
              <Link href="/legal/terms" className="text-foreground/80 hover:underline">
                conditions générales
              </Link>{' '}
              et la{' '}
              <Link href="/legal/privacy" className="text-foreground/80 hover:underline">
                politique de confidentialité
              </Link>{' '}
              (RGPD)
            </Label>
          </div>
          {errors.gdpr && <p className="text-xs text-red-400">{errors.gdpr.message}</p>}

          {message && (
            <div
              className={`px-4 py-3 rounded-xl text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer mon compte
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-foreground/70 hover:text-foreground transition-colors">
            Se connecter
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

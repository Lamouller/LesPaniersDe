'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(6, 'Mot de passe trop court').optional().or(z.literal('')),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const supabase = createClient();

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    setMessage(null);

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { emailRedirectTo: `${window.location.origin}/shop` },
      });
      setLoading(false);
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Lien de connexion envoyé ! Vérifiez votre boîte mail.' });
      }
      return;
    }

    const { data: auth, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password ?? '',
    });

    if (error || !auth.user) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Email ou mot de passe incorrect.' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, entity_id')
      .eq('id', auth.user.id)
      .single();

    setLoading(false);

    const role = profile?.role as string | undefined;
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    if (redirect) {
      window.location.href = redirect;
    } else if (role === 'admin') {
      window.location.href = '/admin';
    } else if (role === 'producer') {
      window.location.href = '/producer';
    } else if (role === 'client' && !profile?.entity_id) {
      window.location.href = '/onboarding/entity';
    } else {
      window.location.href = '/shop';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accédez à votre espace LesPaniersDe</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.fr"
                className="pl-9"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          {mode === 'password' && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>
          )}

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
            {mode === 'magic' ? 'Envoyer le lien' : 'Se connecter'}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            {mode === 'password'
              ? 'Connexion par lien magique (sans mot de passe)'
              : 'Connexion avec mot de passe'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border flex justify-between text-sm text-muted-foreground">
          <Link href="/register" className="hover:text-foreground transition-colors">
            Créer un compte
          </Link>
          <Link href="/forgot-password" className="hover:text-foreground transition-colors">
            Mot de passe oublié ?
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

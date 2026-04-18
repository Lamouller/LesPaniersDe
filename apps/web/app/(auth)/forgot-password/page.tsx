'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const supabase = createClient();

  async function onSubmit(data: FormData) {
    setLoading(true);
    setErrorMsg(null);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      // Ne pas exposer si l'email existe ou non — message générique
      setErrorMsg('Une erreur est survenue. Veuillez réessayer.');
      return;
    }

    setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>
          Saisissez votre email pour recevoir un lien de réinitialisation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary">
              Si votre email existe dans notre base, un lien de réinitialisation vient d&apos;être
              envoyé. Vérifiez votre boîte mail (ou{' '}
              <a
                href="http://localhost:8250"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                http://localhost:8250
              </a>{' '}
              en dev).
            </div>
            <Link href="/login">
              <Button type="button" variant="ghost" className="w-full gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  className="pl-9"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {errorMsg && (
              <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer le lien
            </Button>

            <Link href="/login">
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Retour à la connexion
              </button>
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import Link from 'next/link';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-white/5 border border-border items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">404</h1>
        <p className="text-xl font-semibold text-foreground/70 mb-3">Page introuvable</p>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link href="/">
          <Button className="gap-2">
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </Button>
        </Link>
      </div>
    </div>
  );
}

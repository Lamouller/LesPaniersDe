import React from 'react';
import Link from 'next/link';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-white/5 border border-white/10 items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-neutral-400" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-50 mb-2">404</h1>
        <p className="text-xl font-semibold text-neutral-300 mb-3">Page introuvable</p>
        <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
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

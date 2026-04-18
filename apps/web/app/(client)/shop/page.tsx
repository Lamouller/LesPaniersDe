import React from 'react';
import Link from 'next/link';
import { Clock, ShoppingBasket, Plus, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/utils';

// Mock data utilisé si Supabase n'est pas configuré (build time)
const MOCK_PRODUCTS = [
  { id: '1', name: 'Petit panier', description: 'Pour 1-2 personnes · Légumes de saison', price_cents: 1500, size: 'S', available: true },
  { id: '2', name: 'Panier moyen', description: 'Pour 2-3 personnes · Légumes + fruits', price_cents: 2500, size: 'M', available: true },
  { id: '3', name: 'Grand panier', description: 'Pour 3-4 personnes · Légumes + fruits + herbes', price_cents: 3500, size: 'L', available: true },
  { id: '4', name: 'Option fruits', description: 'Supplément fruits de saison 1kg', price_cents: 800, size: null, available: true },
  { id: '5', name: 'Option oeufs', description: '6 oeufs fermiers', price_cents: 350, size: null, available: false },
];

export default async function ShopPage() {
  // Fetch depuis Supabase si configuré
  const products = MOCK_PRODUCTS;
  let deadline = 'jeudi 20h';
  let weekLabel =
    'Semaine du ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  try {
    const supabase = await createClient();
    const { data: catalog } = await supabase
      .from('weekly_catalogs')
      .select('*, items:weekly_catalog_items(*, product:products(*))')
      .eq('is_open', true)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (catalog) {
      weekLabel =
        'Semaine du ' +
        new Date(catalog.week_start).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
        });
      deadline = new Date(catalog.deadline).toLocaleDateString('fr-FR', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // Supabase not configured — using mock data
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{weekLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">Catalogue de la semaine</h1>
        </div>
        <Link href="/shop/checkout">
          <Button className="gap-2">
            <ShoppingBasket className="w-4 h-4" />
            Voir mon panier
          </Button>
        </Link>
      </div>

      {/* Deadline banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-8">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-400">
          Commande possible jusqu'au <strong>{deadline}</strong>
        </p>
      </div>

      {/* Paniers */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-neutral-300 mb-4">Paniers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products
            .filter((p) => p.size !== null)
            .map((product) => (
              <Card key={product.id} className={!product.available ? 'opacity-50' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <Badge variant={product.available ? 'success' : 'default'}>
                      {product.available ? 'Disponible' : 'Complet'}
                    </Badge>
                  </div>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-neutral-50">
                      {formatCents(product.price_cents)}
                    </span>
                    {product.available && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 hover:bg-white/10 transition-colors"
                          aria-label="Diminuer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm text-neutral-50 font-medium">0</span>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300 hover:bg-white/10 transition-colors"
                          aria-label="Augmenter"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* Options */}
      <section>
        <h2 className="text-base font-semibold text-neutral-300 mb-4">Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products
            .filter((p) => p.size === null)
            .map((product) => (
              <Card key={product.id} className={!product.available ? 'opacity-50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-50">{product.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{product.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-neutral-50">
                        {formatCents(product.price_cents)}
                      </span>
                      {product.available && (
                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors"
                          aria-label="Ajouter"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:right-8 md:left-auto md:w-auto flex justify-end pointer-events-none">
        <Link href="/shop/checkout" className="pointer-events-auto">
          <Button size="lg" className="shadow-2xl shadow-white/10 gap-2">
            <ShoppingBasket className="w-4 h-4" />
            Voir mon panier
          </Button>
        </Link>
      </div>
    </div>
  );
}

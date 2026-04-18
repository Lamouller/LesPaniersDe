import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WeekDeadlineBanner from '@/components/shop/WeekDeadlineBanner';
import BlockedBanner from '@/components/shop/BlockedBanner';
import ProductCard from '@/components/shop/ProductCard';
import CartSummaryBar from '@/components/shop/CartSummaryBar';

type BasketCompositionItem = {
  name: string;
  qty: number;
  unit: string;
};

export default async function ShopPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Profile + entity
  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_id, ordering_blocked_until')
    .eq('id', user.id)
    .single();

  if (!profile?.entity_id) redirect('/onboarding/entity');

  const isBlocked =
    profile.ordering_blocked_until != null &&
    new Date(profile.ordering_blocked_until) > new Date();

  // Producers serving this entity
  const { data: producerEntities } = await supabase
    .from('producer_entities')
    .select(
      'producer_id, delivery_day, time_from, time_to, producers(id, name, slug, bio)'
    )
    .eq('entity_id', profile.entity_id)
    .eq('is_active', true);

  if (!producerEntities || producerEntities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-neutral-400 text-sm">
          Aucun producteur n'est rattaché à votre espace pour l'instant.
        </p>
      </div>
    );
  }

  const producerIds = producerEntities.map((pe) => pe.producer_id);

  // Open catalogs for those producers
  const { data: catalogs } = await supabase
    .from('weekly_catalogs')
    .select(
      `id, producer_id, week_start, order_deadline_at, delivery_date, status, basket_composition, notes,
       weekly_catalog_products(product_id, price_snapshot_cents, stock, is_available,
         products(id, producer_id, kind, size, name, description, photo_url, unit_price_cents, is_active)
       )`
    )
    .in('producer_id', producerIds)
    .eq('status', 'open')
    .order('week_start', { ascending: false });

  if (!catalogs || catalogs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-neutral-400 text-sm">
          Aucun catalogue ouvert cette semaine. Revenez bientôt !
        </p>
      </div>
    );
  }

  // Group by producer (take first catalog per producer)
  const catalogsByProducer: Record<
    string,
    {
      catalog: (typeof catalogs)[0];
      producerName: string;
    }
  > = {};
  for (const catalog of catalogs) {
    if (!catalogsByProducer[catalog.producer_id]) {
      const pe = producerEntities.find((p) => p.producer_id === catalog.producer_id);
      const producer = pe?.producers as unknown as { name: string } | null;
      catalogsByProducer[catalog.producer_id] = {
        catalog,
        producerName: producer?.name ?? 'Producteur',
      };
    }
  }

  const producerList = Object.values(catalogsByProducer);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-32">
      {/* Blocked banner */}
      {isBlocked && <BlockedBanner />}

      {producerList.map(({ catalog, producerName }) => {
        const composition = (catalog.basket_composition ?? []) as BasketCompositionItem[];
        const wcProducts = catalog.weekly_catalog_products ?? [];

        const baskets = wcProducts.filter(
          (wcp) => (wcp.products as unknown as { kind: string } | null)?.kind === 'basket'
        );
        const options = wcProducts.filter(
          (wcp) => (wcp.products as unknown as { kind: string } | null)?.kind !== 'basket'
        );

        return (
          <section key={catalog.id} className="mb-12">
            {/* Header */}
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">
                {producerName}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
                Catalogue de la semaine
              </h1>
            </div>

            {/* Deadline + week banner */}
            <WeekDeadlineBanner
              deadline={catalog.order_deadline_at}
              weekStart={catalog.week_start}
            />

            {/* Basket composition */}
            {composition.length > 0 && (
              <div className="mb-8 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                  Composition du panier cette semaine
                </p>
                <div className="flex flex-wrap gap-2">
                  {composition.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400"
                    >
                      {item.name} — {item.qty} {item.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Paniers */}
            {baskets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-base font-semibold text-neutral-300 mb-4">Paniers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {baskets.map((wcp) => {
                    const product = wcp.products as unknown as {
                      id: string;
                      producer_id: string;
                      name: string;
                      description: string | null;
                      is_active: boolean;
                    } | null;
                    if (!product) return null;
                    return (
                      <ProductCard
                        key={wcp.product_id}
                        product_id={wcp.product_id}
                        product_name={product.name}
                        description={product.description}
                        unit_price_cents={wcp.price_snapshot_cents}
                        weekly_catalog_id={catalog.id}
                        producer_id={catalog.producer_id}
                        is_available={wcp.is_available && product.is_active}
                        disabled={isBlocked}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Options */}
            {options.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-neutral-300 mb-4">Options</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {options.map((wcp) => {
                    const product = wcp.products as unknown as {
                      id: string;
                      producer_id: string;
                      name: string;
                      description: string | null;
                      is_active: boolean;
                    } | null;
                    if (!product) return null;
                    return (
                      <ProductCard
                        key={wcp.product_id}
                        product_id={wcp.product_id}
                        product_name={product.name}
                        description={product.description}
                        unit_price_cents={wcp.price_snapshot_cents}
                        weekly_catalog_id={catalog.id}
                        producer_id={catalog.producer_id}
                        is_available={wcp.is_available && product.is_active}
                        disabled={isBlocked}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* Floating cart bar */}
      <CartSummaryBar disabled={isBlocked} />
    </div>
  );
}

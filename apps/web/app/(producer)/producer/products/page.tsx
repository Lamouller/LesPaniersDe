import React from 'react';
import { redirect } from 'next/navigation';
import { getProducerContext } from '@/lib/auth/producer-context';
import { createClient } from '@/lib/supabase/server';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';
import { ProductsTableClient } from './ProductsTableClient';

export type Product = {
  id: string;
  producer_id: string;
  kind: 'basket' | 'fruit_option' | 'egg_option' | 'other';
  size: 'S' | 'M' | 'L' | 'XL' | null;
  name: string;
  description: string | null;
  photo_url: string | null;
  unit_price_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default async function ProducerProductsPage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('producer_id', ctx.producerId)
    .order('kind')
    .order('name');

  if (error) {
    console.error('[ProducerProductsPage] fetch error', error);
  }

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <ProductsTableClient
        initialProducts={(products ?? []) as Product[]}
        readOnly={ctx.isReadOnly}
        producerId={ctx.producerId}
      />
    </>
  );
}

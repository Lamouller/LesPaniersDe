import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';
import { getProducerContext } from '@/lib/auth/producer-context';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';
import { CatalogClient } from './CatalogClient';

export default async function ProducerCatalogPage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <div className="max-w-3xl mx-auto px-4 pt-6 flex justify-end">
        <Link
          href="/producer/products"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 border border-white/10 hover:bg-white/5 hover:text-neutral-200 transition-colors"
        >
          <Package className="w-3.5 h-3.5" />
          Gérer mes produits
        </Link>
      </div>
      <CatalogClient readOnly={ctx.isReadOnly} />
    </>
  );
}

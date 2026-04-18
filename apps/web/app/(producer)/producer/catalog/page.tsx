import React from 'react';
import { redirect } from 'next/navigation';
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
      <CatalogClient readOnly={ctx.isReadOnly} />
    </>
  );
}

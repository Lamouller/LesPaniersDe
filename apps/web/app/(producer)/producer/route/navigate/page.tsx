import React from 'react';
import { redirect } from 'next/navigation';
import { getProducerContext } from '@/lib/auth/producer-context';
import { NavigateClient } from './NavigateClient';

interface PageProps {
  searchParams: Promise<{ delivery_id?: string; catalog_id?: string }>;
}

export default async function NavigatePage({ searchParams }: PageProps) {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId || ctx.isReadOnly) {
    redirect('/producer/route');
  }

  const { delivery_id, catalog_id } = await searchParams;

  return (
    <NavigateClient
      producerId={ctx.producerId}
      deliveryId={delivery_id ?? null}
      catalogId={catalog_id ?? null}
    />
  );
}

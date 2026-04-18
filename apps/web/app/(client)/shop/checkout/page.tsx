import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutClient from './CheckoutClient';

const DAYS_FR = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

export default async function CheckoutPage() {
  const supabase = await createClient();

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

  // Entity details
  const { data: entity } = await supabase
    .from('entities')
    .select('id, name, pickup_address, pickup_instructions')
    .eq('id', profile.entity_id)
    .single();

  // Producer entities for delivery info
  const { data: producerEntities } = await supabase
    .from('producer_entities')
    .select('producer_id, delivery_day, time_from, time_to')
    .eq('entity_id', profile.entity_id)
    .eq('is_active', true);

  // Format delivery info (use first active producer)
  let deliveryInfo = '';
  if (producerEntities && producerEntities.length > 0) {
    const pe = producerEntities[0];
    const dayName = pe.delivery_day != null ? DAYS_FR[pe.delivery_day] : null;
    const timeFrom = pe.time_from ? pe.time_from.slice(0, 5) : null;
    const timeTo = pe.time_to ? pe.time_to.slice(0, 5) : null;
    if (dayName && timeFrom && timeTo) {
      deliveryInfo = `${dayName} entre ${timeFrom} et ${timeTo}`;
    } else if (dayName) {
      deliveryInfo = dayName;
    }
  }

  return (
    <CheckoutClient
      entityName={entity?.name ?? ''}
      pickupAddress={entity?.pickup_address ?? ''}
      pickupInstructions={entity?.pickup_instructions ?? null}
      deliveryInfo={deliveryInfo}
    />
  );
}

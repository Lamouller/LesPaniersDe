import React from 'react';
import { redirect } from 'next/navigation';
import { getProducerContext } from '@/lib/auth/producer-context';
import { createClient } from '@/lib/supabase/server';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';
import { SettingsClient } from './SettingsClient';

export default async function ProducerSettingsPage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  const supabase = await createClient();

  const { data: producer } = await supabase
    .from('producers')
    .select(
      'vehicle_type, vehicle_fuel_type, vehicle_consumption_l_per_100km, vehicle_kwh_per_100km, custom_diesel_price_eur, custom_gasoline_price_eur, custom_electric_price_eur, vehicle_home_lat, vehicle_home_lng, vehicle_home_address'
    )
    .eq('id', ctx.producerId)
    .single();

  const initial = {
    vehicle_type: (producer?.vehicle_type as 'van' | 'car' | 'truck' | 'electric' | 'bike' | null) ?? null,
    vehicle_fuel_type: (producer?.vehicle_fuel_type as 'diesel' | 'gasoline' | 'electric' | 'hybrid' | 'none' | null) ?? null,
    vehicle_consumption_l_per_100km: (producer?.vehicle_consumption_l_per_100km as number | null) ?? null,
    vehicle_kwh_per_100km: (producer?.vehicle_kwh_per_100km as number | null) ?? null,
    custom_diesel_price_eur: (producer?.custom_diesel_price_eur as number | null) ?? null,
    custom_gasoline_price_eur: (producer?.custom_gasoline_price_eur as number | null) ?? null,
    custom_electric_price_eur: (producer?.custom_electric_price_eur as number | null) ?? null,
    vehicle_home_lat: (producer?.vehicle_home_lat as number | null) ?? null,
    vehicle_home_lng: (producer?.vehicle_home_lng as number | null) ?? null,
    vehicle_home_address: (producer?.vehicle_home_address as string | null) ?? null,
  };

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <SettingsClient readOnly={ctx.isReadOnly} initial={initial} />
    </>
  );
}

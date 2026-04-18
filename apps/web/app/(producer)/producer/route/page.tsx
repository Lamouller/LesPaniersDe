import React from 'react';
import { redirect } from 'next/navigation';
import { getProducerContext } from '@/lib/auth/producer-context';
import { createClient } from '@/lib/supabase/server';
import { ViewAsBanner } from '@/components/admin/ViewAsBanner';
import { RouteClient } from './RouteClient';
import type { VehicleConfig } from '@/lib/economics/fuel';


export default async function ProducerRoutePage() {
  const ctx = await getProducerContext();

  if (!ctx.producerId && ctx.role === 'admin') {
    redirect('/admin/producers');
  }
  if (!ctx.producerId) {
    redirect('/');
  }

  const supabase = await createClient();

  // Fetch producer vehicle config
  const { data: producerData } = await supabase
    .from('producers')
    .select(
      'vehicle_type, vehicle_fuel_type, vehicle_consumption_l_per_100km, vehicle_kwh_per_100km, custom_diesel_price_eur, custom_gasoline_price_eur, custom_electric_price_eur'
    )
    .eq('id', ctx.producerId)
    .single();

  const vehicleConfig: VehicleConfig | null = producerData?.vehicle_fuel_type
    ? {
        fuel_type: producerData.vehicle_fuel_type as VehicleConfig['fuel_type'],
        consumption_l_per_100km: producerData.vehicle_consumption_l_per_100km as number | null,
        kwh_per_100km: producerData.vehicle_kwh_per_100km as number | null,
        custom_diesel_price_eur: producerData.custom_diesel_price_eur as number | null,
        custom_gasoline_price_eur: producerData.custom_gasoline_price_eur as number | null,
        custom_electric_price_eur: producerData.custom_electric_price_eur as number | null,
      }
    : null;

  // Fetch entities linked to this producer (with lat/lng)
  const { data: producerEntities } = await supabase
    .from('producer_entities')
    .select(`
      entity_id,
      entities!producer_entities_entity_id_fkey(id, name, address, pickup_address, pickup_lat, pickup_lng)
    `)
    .eq('producer_id', ctx.producerId)
    .eq('is_active', true);

  // Fetch pending order counts per entity for current open catalog
  const { data: openCatalogs } = await supabase
    .from('weekly_catalogs')
    .select('id')
    .eq('producer_id', ctx.producerId)
    .eq('status', 'open')
    .limit(1);

  const catalogId = openCatalogs?.[0]?.id ?? null;

  const orderCountMap: Map<string, number> = new Map();
  if (catalogId) {
    const { data: orders } = await supabase
      .from('orders')
      .select('entity_id')
      .eq('producer_id', ctx.producerId)
      .eq('weekly_catalog_id', catalogId)
      .neq('status', 'canceled');

    (orders ?? []).forEach((o) => {
      const count = orderCountMap.get(o.entity_id) ?? 0;
      orderCountMap.set(o.entity_id, count + 1);
    });
  }

  type EntityRaw = {
    id: string;
    name: string;
    address: string;
    pickup_address: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
  };

  const initialEntities = (producerEntities ?? [])
    .map((pe) => {
      const e = (pe as unknown as { entities: EntityRaw | null }).entities;
      if (!e) return null;

      // Use entity pickup_lat/lng or skip if no coords
      const lat = e.pickup_lat;
      const lng = e.pickup_lng;
      if (lat === null || lng === null) return null;

      return {
        id: e.id,
        name: e.name,
        address: e.pickup_address || e.address,
        orders: orderCountMap.get(e.id) ?? 0,
        lat,
        lng,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // If producer has no entities yet, show demo waypoints (Toulouse + Albi)
  const waypoints =
    initialEntities.length > 0
      ? initialEntities
      : [
          {
            id: '11111111-0000-0000-0000-000000000001',
            name: 'Open Space Antislash',
            address: 'Toulouse (démo)',
            orders: 0,
            lat: 43.6047,
            lng: 1.4442,
          },
          {
            id: '11111111-0000-0000-0000-000000000002',
            name: 'Coworking Le Jardin',
            address: 'Albi (démo)',
            orders: 0,
            lat: 43.928,
            lng: 2.148,
          },
        ];

  return (
    <>
      {ctx.isViewAs && <ViewAsBanner producerName={ctx.producerName} />}
      <RouteClient readOnly={ctx.isReadOnly} initialEntities={waypoints} vehicleConfig={vehicleConfig} />
    </>
  );
}

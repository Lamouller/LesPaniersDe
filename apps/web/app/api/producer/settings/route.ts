import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  vehicle_type: z.enum(['van', 'car', 'truck', 'electric', 'bike']).nullable().optional(),
  vehicle_fuel_type: z.enum(['diesel', 'gasoline', 'electric', 'hybrid', 'none']).nullable().optional(),
  vehicle_consumption_l_per_100km: z.number().positive().nullable().optional(),
  vehicle_kwh_per_100km: z.number().positive().nullable().optional(),
  custom_diesel_price_eur: z.number().positive().nullable().optional(),
  custom_gasoline_price_eur: z.number().positive().nullable().optional(),
  custom_electric_price_eur: z.number().positive().nullable().optional(),
  vehicle_home_lat: z.number().nullable().optional(),
  vehicle_home_lng: z.number().nullable().optional(),
  vehicle_home_address: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Only producers can update their own settings via this endpoint
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'producer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Fetch producer record
  const { data: producer } = await supabase
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!producer) {
    return NextResponse.json({ error: 'producer_not_found' }, { status: 404 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    const raw: unknown = await request.json();
    body = patchSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.vehicle_type !== undefined) updates.vehicle_type = body.vehicle_type;
  if (body.vehicle_fuel_type !== undefined) updates.vehicle_fuel_type = body.vehicle_fuel_type;
  if (body.vehicle_consumption_l_per_100km !== undefined) updates.vehicle_consumption_l_per_100km = body.vehicle_consumption_l_per_100km;
  if (body.vehicle_kwh_per_100km !== undefined) updates.vehicle_kwh_per_100km = body.vehicle_kwh_per_100km;
  if (body.custom_diesel_price_eur !== undefined) updates.custom_diesel_price_eur = body.custom_diesel_price_eur;
  if (body.custom_gasoline_price_eur !== undefined) updates.custom_gasoline_price_eur = body.custom_gasoline_price_eur;
  if (body.custom_electric_price_eur !== undefined) updates.custom_electric_price_eur = body.custom_electric_price_eur;
  if (body.vehicle_home_lat !== undefined) updates.vehicle_home_lat = body.vehicle_home_lat;
  if (body.vehicle_home_lng !== undefined) updates.vehicle_home_lng = body.vehicle_home_lng;
  if (body.vehicle_home_address !== undefined) updates.vehicle_home_address = body.vehicle_home_address;

  const { data: updated, error } = await supabase
    .from('producers')
    .update(updates)
    .eq('id', producer.id)
    .select(
      'id, vehicle_type, vehicle_fuel_type, vehicle_consumption_l_per_100km, vehicle_kwh_per_100km, custom_diesel_price_eur, custom_gasoline_price_eur, custom_electric_price_eur, vehicle_home_lat, vehicle_home_lng, vehicle_home_address'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, producer: updated });
}

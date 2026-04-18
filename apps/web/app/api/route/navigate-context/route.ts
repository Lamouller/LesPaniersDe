import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProducerContext } from '@/lib/auth/producer-context';

export async function GET() {
  const ctx = await getProducerContext();
  if (!ctx.producerId) {
    return NextResponse.json({ error: 'no_producer' }, { status: 403 });
  }

  const supabase = await createClient();

  // Récupère entités servies par ce producer avec coords
  const { data, error } = await supabase
    .from('producer_entities')
    .select('entities!producer_entities_entity_id_fkey(id, name, pickup_lat, pickup_lng)')
    .eq('producer_id', ctx.producerId)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = { entities: { id: string; name: string; pickup_lat: number | null; pickup_lng: number | null } | null };
  const rows = (data as unknown as Row[]) ?? [];

  const valid = rows
    .map((r) => r.entities)
    .filter((e): e is { id: string; name: string; pickup_lat: number; pickup_lng: number } =>
      !!e && e.pickup_lat !== null && e.pickup_lng !== null
    );

  return NextResponse.json({
    entity_ids: valid.map((e) => e.id),
    waypoints: valid.map((e, idx) => ({
      lat: e.pickup_lat,
      lng: e.pickup_lng,
      name: e.name,
      stop: idx + 1,
    })),
  });
}

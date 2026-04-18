import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  entity_ids: z.array(z.string().uuid()).min(1).max(20),
});

interface Entity {
  id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  name: string;
}

interface OsrmTrip {
  geometry: {
    coordinates: [number, number][];
  };
  legs: Array<{ duration: number; distance: number }>;
}

interface OsrmResponse {
  code: string;
  trips?: OsrmTrip[];
  waypoints?: Array<{ waypoint_index: number; name: string }>;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { entity_ids } = parsed.data;

  // Fetch entity coordinates
  const { data: entities, error: dbError } = await supabase
    .from('entities')
    .select('id, name, pickup_lat, pickup_lng')
    .in('id', entity_ids);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const validEntities = (entities as Entity[]).filter(
    (e) => e.pickup_lat !== null && e.pickup_lng !== null
  );
  if (validEntities.length < 1) {
    return NextResponse.json({ error: 'no_coordinates' }, { status: 422 });
  }

  // Build OSRM coordinates string: lng,lat;lng,lat
  const coordStr = validEntities.map((e) => `${e.pickup_lng},${e.pickup_lat}`).join(';');
  const osrmBase = process.env.OSRM_URL ?? 'http://router.project-osrm.org';
  const osrmUrl = `${osrmBase}/trip/v1/driving/${coordStr}?overview=simplified&geometries=geojson&roundtrip=true&steps=false`;

  let optimizedOrder: Entity[] = validEntities;
  let polyline: [number, number][] = [];
  let totalDistanceM = 0;
  let totalDurationS = 0;

  try {
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });
    if (osrmRes.ok) {
      const osrmData = (await osrmRes.json()) as OsrmResponse;
      if (osrmData.code === 'Ok' && osrmData.trips && osrmData.waypoints) {
        const trip = osrmData.trips[0];
        polyline = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        totalDurationS = trip.legs.reduce((acc, leg) => acc + leg.duration, 0);
        totalDistanceM = trip.legs.reduce((acc, leg) => acc + leg.distance, 0);

        // Reorder entities by waypoint_index
        const waypointOrder = osrmData.waypoints
          .sort((a, b) => a.waypoint_index - b.waypoint_index)
          .map((wp) => wp.waypoint_index);
        optimizedOrder = waypointOrder.map((i) => validEntities[i]).filter(Boolean);
      }
    }
  } catch {
    // OSRM unavailable — return original order
  }

  return NextResponse.json({
    ok: true,
    order: optimizedOrder.map((e, idx) => ({ ...e, stop: idx + 1 })),
    polyline,
    total_distance_m: Math.round(totalDistanceM),
    total_duration_s: Math.round(totalDurationS),
  });
}

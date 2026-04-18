import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  entity_ids: z.array(z.string().uuid()).min(1).max(20),
  include_home: z.boolean().optional().default(false),
});

interface Entity {
  id: string;
  name: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
}

interface OsrmStep {
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
    bearing_after?: number;
  };
  name: string;
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

interface OsrmLeg {
  distance: number;
  duration: number;
  steps: OsrmStep[];
}

interface OsrmTrip {
  geometry: { coordinates: [number, number][] };
  legs: OsrmLeg[];
  distance: number;
  duration: number;
}

interface OsrmResponse {
  code: string;
  trips?: OsrmTrip[];
  waypoints?: Array<{ waypoint_index: number; name: string; location: [number, number] }>;
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

  const { entity_ids, include_home } = parsed.data;

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

  // If include_home, fetch producer's home coords
  let homeCoords: [number, number] | null = null;
  if (include_home) {
    const { data: producer } = await supabase
      .from('producers')
      .select('vehicle_home_lat, vehicle_home_lng')
      .eq('user_id', user.id)
      .single();
    if (producer?.vehicle_home_lat && producer?.vehicle_home_lng) {
      homeCoords = [producer.vehicle_home_lng, producer.vehicle_home_lat];
    }
  }

  const coordParts: string[] = [];
  if (homeCoords) coordParts.push(`${homeCoords[0]},${homeCoords[1]}`);
  validEntities.forEach((e) => coordParts.push(`${e.pickup_lng},${e.pickup_lat}`));
  if (homeCoords) coordParts.push(`${homeCoords[0]},${homeCoords[1]}`);

  const coordStr = coordParts.join(';');
  const osrmBase = process.env.OSRM_URL ?? 'http://router.project-osrm.org';
  // Use route (not trip) to get detailed steps
  const osrmUrl = `${osrmBase}/trip/v1/driving/${coordStr}?overview=full&geometries=geojson&roundtrip=true&steps=true&annotations=duration,distance`;

  try {
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(15000) });
    if (!osrmRes.ok) {
      return NextResponse.json({ error: 'osrm_unavailable' }, { status: 503 });
    }

    const osrmData = (await osrmRes.json()) as OsrmResponse;
    if (osrmData.code !== 'Ok' || !osrmData.trips || !osrmData.waypoints) {
      return NextResponse.json({ error: 'osrm_no_route' }, { status: 422 });
    }

    const trip = osrmData.trips[0];
    const polyline: [number, number][] = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    // Extract all steps from all legs
    const steps = trip.legs.flatMap((leg, legIdx) =>
      leg.steps.map((step, stepIdx) => ({
        leg_index: legIdx,
        step_index: stepIdx,
        maneuver_type: step.maneuver.type,
        maneuver_modifier: step.maneuver.modifier ?? null,
        location_lng: step.maneuver.location[0],
        location_lat: step.maneuver.location[1],
        bearing_after: step.maneuver.bearing_after ?? null,
        street_name: step.name || null,
        distance_m: Math.round(step.distance),
        duration_s: Math.round(step.duration),
      }))
    );

    const legs = trip.legs.map((leg) => ({
      distance_m: Math.round(leg.distance),
      duration_s: Math.round(leg.duration),
    }));

    // Build waypoints with stop order
    const waypointOrder = (osrmData.waypoints ?? [])
      .sort((a, b) => a.waypoint_index - b.waypoint_index)
      .map((wp) => wp.waypoint_index);
    const orderedEntities = waypointOrder
      .map((i) => {
        const offset = homeCoords ? i - 1 : i;
        return validEntities[offset];
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      polyline,
      legs,
      steps,
      total_distance_m: Math.round(trip.distance),
      total_duration_s: Math.round(trip.duration),
      waypoints: orderedEntities.map((e, idx) => ({
        id: e.id,
        name: e.name,
        lat: e.pickup_lat,
        lng: e.pickup_lng,
        stop: idx + 1,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'osrm_timeout' }, { status: 503 });
  }
}

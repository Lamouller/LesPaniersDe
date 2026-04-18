import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  delivery_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Simple in-process rate limiter (per delivery_id)
const lastInsert = new Map<string, number>();
const RATE_LIMIT_MS = 5000;

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

  const { delivery_id, lat, lng } = parsed.data;

  // Rate limit — 1 insert per 5s per delivery
  const now = Date.now();
  const last = lastInsert.get(delivery_id) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  lastInsert.set(delivery_id, now);

  const { error } = await supabase.from('delivery_tracking_points').insert({
    delivery_id,
    lat,
    lng,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

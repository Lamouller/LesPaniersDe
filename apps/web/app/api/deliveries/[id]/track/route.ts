import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  bearing: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

// Simple in-memory rate limit: max 1 INSERT per 2s per delivery
const lastInsert = new Map<string, number>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limit: 1 per 2s per delivery
  const now = Date.now();
  const last = lastInsert.get(id) ?? 0;
  if (now - last < 2000) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }
  lastInsert.set(id, now);

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

  const { lat, lng, bearing, speed } = parsed.data;

  // Verify this delivery belongs to the authenticated producer
  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .select('id, producer_id, status')
    .eq('id', id)
    .single();

  if (deliveryError || !delivery) {
    return NextResponse.json({ error: 'delivery_not_found' }, { status: 404 });
  }

  // Check producer owns this delivery
  const { data: producer } = await supabase
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!producer || delivery.producer_id !== producer.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (delivery.status !== 'in_progress') {
    return NextResponse.json({ error: 'delivery_not_in_progress' }, { status: 409 });
  }

  const { error: insertError } = await supabase
    .from('delivery_tracking_points')
    .insert({
      delivery_id: id,
      lat,
      lng,
      bearing: bearing ?? null,
      speed: speed ?? null,
      recorded_at: new Date().toISOString(),
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

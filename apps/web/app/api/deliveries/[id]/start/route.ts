import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  weekly_catalog_id: z.string().uuid().optional(),
  entity_ids: z.array(z.string().uuid()).optional(),
  polyline: z.array(z.tuple([z.number(), z.number()])).optional(),
  entities_order: z.array(z.object({ id: z.string(), stop: z.number() })).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // empty body ok
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 422 });
  }

  const { weekly_catalog_id, polyline, entities_order } = parsed.data;

  // Find producer
  const { data: producer } = await supabase
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!producer) {
    return NextResponse.json({ error: 'not_a_producer' }, { status: 403 });
  }

  // If id = 'new', create a new delivery; otherwise update existing
  if (id === 'new') {
    if (!weekly_catalog_id) {
      return NextResponse.json({ error: 'weekly_catalog_id_required' }, { status: 422 });
    }

    const { data: newDelivery, error: createError } = await supabase
      .from('deliveries')
      .upsert(
        {
          weekly_catalog_id,
          producer_id: producer.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          route_geojson: polyline ? { type: 'LineString', coordinates: polyline } : null,
          entities_order: entities_order ?? null,
        },
        { onConflict: 'weekly_catalog_id,producer_id' }
      )
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, delivery_id: newDelivery?.id });
  }

  // Update existing delivery
  const { data: delivery, error: fetchError } = await supabase
    .from('deliveries')
    .select('id, producer_id')
    .eq('id', id)
    .single();

  if (fetchError || !delivery) {
    return NextResponse.json({ error: 'delivery_not_found' }, { status: 404 });
  }

  if (delivery.producer_id !== producer.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('deliveries')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      route_geojson: polyline ? { type: 'LineString', coordinates: polyline } : undefined,
      entities_order: entities_order ?? undefined,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, delivery_id: id });
}

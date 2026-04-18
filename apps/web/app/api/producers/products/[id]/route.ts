import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProducerContext } from '@/lib/auth/producer-context';
import { z } from 'zod';

const kindValues = ['basket', 'fruit_option', 'egg_option', 'other'] as const;
const sizeValues = ['S', 'M', 'L', 'XL'] as const;

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(kindValues).optional(),
  size: z.enum(sizeValues).nullable().optional(),
  description: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  unit_price_cents: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const ctx = await getProducerContext();

  if (ctx.isReadOnly || !ctx.producerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    const raw: unknown = await request.json();
    body = patchSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const supabase = await createClient();

  // Vérifier ownership
  const { data: existing } = await supabase
    .from('products')
    .select('id, producer_id')
    .eq('id', id)
    .single();

  if (!existing || existing.producer_id !== ctx.producerId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.kind !== undefined) updateData.kind = body.kind;
  if (body.size !== undefined) updateData.size = body.size;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.photo_url !== undefined) updateData.photo_url = body.photo_url;
  if (body.unit_price_cents !== undefined) updateData.unit_price_cents = body.unit_price_cents;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  const { data: product, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .eq('producer_id', ctx.producerId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const ctx = await getProducerContext();

  if (ctx.isReadOnly || !ctx.producerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = await createClient();

  // Vérifier ownership
  const { data: existing } = await supabase
    .from('products')
    .select('id, producer_id')
    .eq('id', id)
    .single();

  if (!existing || existing.producer_id !== ctx.producerId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('producer_id', ctx.producerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

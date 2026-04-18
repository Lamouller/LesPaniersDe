import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProducerContext } from '@/lib/auth/producer-context';
import { z } from 'zod';

const kindValues = ['basket', 'fruit_option', 'egg_option', 'other'] as const;
const sizeValues = ['S', 'M', 'L', 'XL'] as const;

const createProductSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(kindValues),
  size: z.enum(sizeValues).nullable().optional(),
  description: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  unit_price_cents: z.number().int().min(0),
  is_active: z.boolean().default(true),
  // producer_id envoyé depuis le client mais on ignore — on utilise ctx.producerId
  producer_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getProducerContext();

  if (ctx.isReadOnly || !ctx.producerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof createProductSchema>;
  try {
    const raw: unknown = await request.json();
    body = createProductSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      producer_id: ctx.producerId,
      name: body.name,
      kind: body.kind,
      size: body.kind === 'basket' ? (body.size ?? null) : null,
      description: body.description ?? null,
      photo_url: body.photo_url ?? null,
      unit_price_cents: body.unit_price_cents,
      is_active: body.is_active,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product }, { status: 201 });
}

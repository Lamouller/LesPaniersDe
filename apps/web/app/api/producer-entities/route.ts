import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProducerContext } from '@/lib/auth/producer-context';
import { z } from 'zod';

const addSchema = z.object({
  producer_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  delivery_day: z.number().int().min(0).max(6).optional().nullable(),
  time_from: z.string().optional().nullable(),
  time_to: z.string().optional().nullable(),
});

const deleteSchema = z.object({
  producer_id: z.string().uuid(),
  entity_id: z.string().uuid(),
});

async function getAdminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(request: NextRequest) {
  const ctx = await getProducerContext();
  if (ctx.isReadOnly) {
    return NextResponse.json({ error: 'Read-only mode (view-as-producer)' }, { status: 403 });
  }

  const supabase = await createClient();
  const user = await getAdminUser(supabase);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: z.infer<typeof addSchema>;
  try {
    const raw: unknown = await request.json();
    body = addSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  // Upsert (the link may already exist but inactive)
  const { error } = await supabase
    .from('producer_entities')
    .upsert(
      {
        producer_id: body.producer_id,
        entity_id: body.entity_id,
        delivery_day: body.delivery_day ?? null,
        time_from: body.time_from ?? null,
        time_to: body.time_to ?? null,
        is_active: true,
      },
      { onConflict: 'producer_id,entity_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getProducerContext();
  if (ctx.isReadOnly) {
    return NextResponse.json({ error: 'Read-only mode (view-as-producer)' }, { status: 403 });
  }

  const supabase = await createClient();
  const user = await getAdminUser(supabase);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: z.infer<typeof deleteSchema>;
  try {
    const raw: unknown = await request.json();
    body = deleteSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  // Soft delete: is_active = false
  const { error } = await supabase
    .from('producer_entities')
    .update({ is_active: false })
    .eq('producer_id', body.producer_id)
    .eq('entity_id', body.entity_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

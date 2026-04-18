import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const entitySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pickup_address: z.string().optional().nullable(),
  pickup_lat: z.number().optional().nullable(),
  pickup_lng: z.number().optional().nullable(),
  pickup_instructions: z.string().optional().nullable(),
  contact_email: z.string().email().or(z.literal('')).optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
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
  const supabase = await createClient();
  const user = await getAdminUser(supabase);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: z.infer<typeof entitySchema>;
  try {
    const raw: unknown = await request.json();
    body = entitySchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const { data: entity, error } = await supabase
    .from('entities')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      address: body.address ?? null,
      pickup_address: body.pickup_address ?? null,
      pickup_lat: body.pickup_lat ?? null,
      pickup_lng: body.pickup_lng ?? null,
      pickup_instructions: body.pickup_instructions ?? null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone ?? null,
      is_active: body.is_active,
    })
    .select('id, name, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, entity });
}

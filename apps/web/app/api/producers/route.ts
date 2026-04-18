import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const producerSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  bio: z.string().optional().nullable(),
  photo_url: z.string().url().or(z.literal('')).optional().nullable(),
  contact_email: z.string().email().or(z.literal('')).optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  default_order_deadline_hours: z.number().int().min(1).default(48),
  payment_reminder_days: z.number().int().min(1).default(3),
  payment_block_days: z.number().int().min(1).default(7),
  whatsapp_enabled: z.boolean().default(false),
  whatsapp_phone_id: z.string().optional().nullable(),
  whatsapp_access_token: z.string().optional().nullable(),
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

  let body: z.infer<typeof producerSchema>;
  try {
    const raw: unknown = await request.json();
    body = producerSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    name: body.name,
    slug: body.slug,
    bio: body.bio ?? null,
    photo_url: body.photo_url || null,
    contact_email: body.contact_email || null,
    contact_phone: body.contact_phone ?? null,
    default_order_deadline_hours: body.default_order_deadline_hours,
    payment_reminder_days: body.payment_reminder_days,
    payment_block_days: body.payment_block_days,
    whatsapp_enabled: body.whatsapp_enabled,
    whatsapp_phone_id: body.whatsapp_phone_id ?? null,
    is_active: body.is_active,
  };

  // Store access token as-is (encryption can be added later)
  if (body.whatsapp_access_token) {
    insertData.whatsapp_access_token_encrypted = body.whatsapp_access_token;
  }

  const { data: producer, error } = await supabase
    .from('producers')
    .insert(insertData)
    .select('id, name, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, producer });
}

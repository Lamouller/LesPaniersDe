import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  bio: z.string().optional().nullable(),
  photo_url: z.string().url().or(z.literal('')).optional().nullable(),
  contact_email: z.string().email().or(z.literal('')).optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  default_order_deadline_hours: z.number().int().min(1).optional(),
  payment_reminder_days: z.number().int().min(1).optional(),
  payment_block_days: z.number().int().min(1).optional(),
  whatsapp_enabled: z.boolean().optional(),
  whatsapp_phone_id: z.string().optional().nullable(),
  whatsapp_access_token: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAdminUser(supabase);
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    const raw: unknown = await request.json();
    body = patchSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url || null;
  if (body.contact_email !== undefined) updates.contact_email = body.contact_email || null;
  if (body.contact_phone !== undefined) updates.contact_phone = body.contact_phone;
  if (body.default_order_deadline_hours !== undefined) updates.default_order_deadline_hours = body.default_order_deadline_hours;
  if (body.payment_reminder_days !== undefined) updates.payment_reminder_days = body.payment_reminder_days;
  if (body.payment_block_days !== undefined) updates.payment_block_days = body.payment_block_days;
  if (body.whatsapp_enabled !== undefined) updates.whatsapp_enabled = body.whatsapp_enabled;
  if (body.whatsapp_phone_id !== undefined) updates.whatsapp_phone_id = body.whatsapp_phone_id;
  if (body.whatsapp_access_token) updates.whatsapp_access_token_encrypted = body.whatsapp_access_token;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data: producer, error } = await supabase
    .from('producers')
    .update(updates)
    .eq('id', id)
    .select('id, name, slug, is_active, payment_reminder_days')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, producer });
}

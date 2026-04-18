import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const IS_PROD = process.env.NODE_ENV === 'production';
const ONE_HOUR = 60 * 60;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;
  return user;
}

const postSchema = z.object({
  producer_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof postSchema>;
  try {
    const raw: unknown = await request.json();
    body = postSchema.parse(raw);
  } catch (e) {
    return NextResponse.json({ error: 'invalid_body', detail: String(e) }, { status: 400 });
  }

  // Verify producer exists
  const supabase = await createClient();
  const { data: producer } = await supabase
    .from('producers')
    .select('id')
    .eq('id', body.producer_id)
    .single();

  if (!producer) {
    return NextResponse.json({ error: 'producer_not_found' }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('lpd-view-as-producer', body.producer_id, {
    httpOnly: true,
    path: '/',
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: ONE_HOUR,
  });

  return response;
}

export async function DELETE(_request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('lpd-view-as-producer', '', {
    httpOnly: true,
    path: '/',
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 0,
  });

  return response;
}

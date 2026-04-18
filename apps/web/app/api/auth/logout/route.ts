import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const acceptHeader = request.headers.get('accept') ?? '';
  if (acceptHeader.includes('application/json')) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL('/', request.url));
}

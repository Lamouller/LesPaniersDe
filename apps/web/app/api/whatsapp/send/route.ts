import { type NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppTemplate } from '@/lib/notifications/whatsapp';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  to: z.string().regex(/^\+\d{7,15}$/, 'Format E.164 requis'),
  templateName: z.string().min(1),
  variables: z.record(z.string()).optional(),
  languageCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // Auth check — service role ou producteur
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['producer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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

  const result = await sendWhatsAppTemplate({
    to: parsed.data.to,
    templateName: parsed.data.templateName,
    variables: parsed.data.variables,
    languageCode: parsed.data.languageCode,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}

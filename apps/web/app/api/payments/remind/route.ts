import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';

const bodySchema = z.object({
  payment_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw: unknown = await request.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { payment_id } = body;

  // Récupérer les infos du paiement
  const { data: paymentData, error: fetchErr } = await supabase
    .from('payments')
    .select('id, amount_cents, due_at, status, order_id, orders!inner(order_number, client_id)')
    .eq('id', payment_id)
    .single();

  if (fetchErr || !paymentData) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 });
  }

  const orderData = (paymentData as { orders?: { order_number?: string; client_id?: string } | null }).orders;
  const clientId = orderData?.client_id;
  const orderNumber = orderData?.order_number;

  if (!clientId) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // INSERT notification (intention de relance — l'envoi effectif est géré par le cron)
  const { error: notifErr } = await serviceClient
    .from('notifications')
    .insert({
      user_id: clientId,
      channel: 'email',
      event_type: 'payment_reminder',
      payload: {
        payment_id,
        order_number: orderNumber,
        amount_cents: paymentData.amount_cents,
        due_at: paymentData.due_at,
      },
      status: 'pending',
    });

  if (notifErr) {
    return NextResponse.json({ error: notifErr.message }, { status: 500 });
  }

  // INSERT dans payment_reminders (historique)
  const { error: reminderErr } = await serviceClient
    .from('payment_reminders')
    .insert({
      payment_id,
      channel: 'email',
      template: 'payment_reminder',
      response_status: 'queued',
    });

  if (reminderErr) {
    return NextResponse.json({ error: reminderErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Relance enregistrée, envoi via cron.' });
}

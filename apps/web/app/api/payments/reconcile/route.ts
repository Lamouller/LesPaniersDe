import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';

const bodySchema = z.object({
  payment_id: z.string().uuid(),
  method: z.enum(['cash', 'card', 'transfer', 'check']),
  reference: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  unblock_client: z.boolean().optional().default(false),
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

  const { payment_id, method, reference, notes, unblock_client } = body;

  // UPDATE payment → paid
  const { data: payment, error: updateErr } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      method,
      payment_reference: reference ?? null,
      notes: notes ?? null,
      reconciled_at: new Date().toISOString(),
      reconciled_by: user.id,
    })
    .eq('id', payment_id)
    .select('id, status, amount_cents, method, reconciled_at, order_id')
    .single();

  if (updateErr || !payment) {
    return NextResponse.json({ error: updateErr?.message ?? 'update_failed' }, { status: 500 });
  }

  // Débloquer le client si demandé
  if (unblock_client) {
    // Récupérer le client de la commande
    const { data: orderData } = await supabase
      .from('orders')
      .select('client_id')
      .eq('id', payment.order_id)
      .single();

    if (orderData?.client_id) {
      const clientId: string = orderData.client_id;

      // Vérifier s'il reste des impayés overdue après ce paiement
      const { count: remainingOverdue } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .in('orders.client_id', [clientId])
        .in('status', ['overdue'])
        .neq('id', payment_id);

      // Pour bypasser RLS sur le UPDATE profiles, on utilise le service role
      // (les admins n'ont pas forcément UPDATE sur profiles.ordering_blocked_until via RLS)
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Vérifier via une query directe les overdue restants du client
      const { data: clientOverdue } = await serviceClient
        .from('payments')
        .select('id, orders!inner(client_id)')
        .in('status', ['overdue'])
        .neq('id', payment_id)
        .eq('orders.client_id', clientId);

      const hasRemainingOverdue = (clientOverdue?.length ?? 0) > 0;

      if (!hasRemainingOverdue) {
        await serviceClient
          .from('profiles')
          .update({ ordering_blocked_until: null, updated_at: new Date().toISOString() })
          .eq('id', clientId);
      }

      // Silence unused var warning
      void remainingOverdue;
    }
  }

  return NextResponse.json({ success: true, payment });
}

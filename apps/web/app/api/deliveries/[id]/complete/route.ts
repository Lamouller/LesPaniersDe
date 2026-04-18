import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: producer } = await supabase
    .from('producers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!producer) {
    return NextResponse.json({ error: 'not_a_producer' }, { status: 403 });
  }

  const { data: delivery, error: fetchError } = await supabase
    .from('deliveries')
    .select('id, producer_id')
    .eq('id', id)
    .single();

  if (fetchError || !delivery) {
    return NextResponse.json({ error: 'delivery_not_found' }, { status: 404 });
  }

  if (delivery.producer_id !== producer.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('deliveries')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name_snapshot: z.string().min(1),
  unit_price_cents: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  producer_id: z.string().uuid(),
  weekly_catalog_id: z.string().uuid(),
  items: z.array(orderItemSchema).min(1),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Parse & validate body
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { producer_id, weekly_catalog_id, items, notes } = parsed.data;

    // Get client entity_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('entity_id, ordering_blocked_until')
      .eq('id', user.id)
      .single();

    if (!profile?.entity_id) {
      return NextResponse.json({ error: 'Entité client introuvable' }, { status: 400 });
    }

    const isBlocked =
      profile.ordering_blocked_until != null &&
      new Date(profile.ordering_blocked_until) > new Date();

    if (isBlocked) {
      return NextResponse.json(
        { error: 'Votre compte est bloqué pour impayé. Contactez l\'admin.' },
        { status: 403 }
      );
    }

    // Call the atomic PL/pgSQL function
    const { data, error } = await supabase.rpc('create_order', {
      p_client_id: user.id,
      p_producer_id: producer_id,
      p_catalog_id: weekly_catalog_id,
      p_entity_id: profile.entity_id,
      p_items: JSON.stringify(items),
      p_notes: notes ?? null,
    });

    if (error) {
      console.error('create_order error:', error);
      if (error.message?.includes('ORDERING_BLOCKED')) {
        return NextResponse.json(
          { error: 'Votre compte est bloqué pour impayé.' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 });
    }

    const result = data as { order_id: string; order_number: string };

    return NextResponse.json({
      order_id: result.order_id,
      order_number: result.order_number,
    });
  } catch (err) {
    console.error('Unexpected error in /api/orders/create:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}

-- ============================================================
-- Migration 0005 : Fonction atomique create_order
-- ============================================================

-- Type pour les items d'une commande
CREATE TYPE public.order_item_input AS (
  product_id              uuid,
  product_name_snapshot   text,
  unit_price_cents        int,
  quantity                int
);

-- ============================================================
-- create_order(...)
-- Insère order + order_items + payment de manière atomique
-- Retourne order_id et order_number
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_client_id         uuid,
  p_producer_id       uuid,
  p_catalog_id        uuid,
  p_entity_id         uuid,
  p_items             json,
  p_notes             text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id      uuid;
  v_order_number  text;
  v_total_cents   int := 0;
  v_item          json;
BEGIN
  -- Vérifier que le client n'est pas bloqué
  IF NOT public.check_ordering_allowed(p_client_id) THEN
    RAISE EXCEPTION 'ORDERING_BLOCKED: client % est bloqué pour impayé', p_client_id;
  END IF;

  -- Calculer le total
  FOR v_item IN SELECT * FROM json_array_elements(p_items)
  LOOP
    v_total_cents := v_total_cents +
      (v_item->>'unit_price_cents')::int * (v_item->>'quantity')::int;
  END LOOP;

  -- Générer le numéro de commande
  v_order_number := public.generate_order_number();

  -- Insérer la commande
  INSERT INTO public.orders (
    order_number,
    client_id,
    producer_id,
    weekly_catalog_id,
    entity_id,
    status,
    total_cents,
    notes
  ) VALUES (
    v_order_number,
    p_client_id,
    p_producer_id,
    p_catalog_id,
    p_entity_id,
    'confirmed',
    v_total_cents,
    p_notes
  )
  RETURNING id INTO v_order_id;

  -- Insérer les lignes de commande
  FOR v_item IN SELECT * FROM json_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      unit_price_cents,
      quantity,
      line_total_cents
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name_snapshot',
      (v_item->>'unit_price_cents')::int,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price_cents')::int * (v_item->>'quantity')::int
    );
  END LOOP;

  -- Insérer le paiement (pending, due_at null jusqu'au pickup)
  INSERT INTO public.payments (
    order_id,
    amount_cents,
    status
  ) VALUES (
    v_order_id,
    v_total_cents,
    'pending'
  );

  -- Créer la facture directement (le trigger ne se déclenche qu'en UPDATE,
  -- or on insère directement en status=confirmed)
  INSERT INTO public.invoices (order_id, invoice_number, amount_cents, status)
  VALUES (
    v_order_id,
    public.generate_invoice_number(),
    v_total_cents,
    'issued'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN json_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$;

COMMENT ON FUNCTION public.create_order(uuid, uuid, uuid, uuid, json, text)
  IS 'Création atomique : order + order_items + payment (pending). Facture via trigger.';

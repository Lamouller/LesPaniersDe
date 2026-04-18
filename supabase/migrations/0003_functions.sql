-- ============================================================
-- Migration 0003 : Fonctions métier, triggers, vues
-- ============================================================

-- ============================================================
-- 1. generate_order_number()
-- Format : LPD-YYYYMMDD-NNN (compteur journalier)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_daily_seq;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  today       text;
  day_prefix  text;
  count_today int;
  result      text;
BEGIN
  today      := to_char(timezone('UTC', now()), 'YYYYMMDD');
  day_prefix := 'LPD-' || today || '-';

  -- Compte les commandes du jour pour générer un numéro séquentiel
  SELECT COUNT(*) + 1
    INTO count_today
    FROM public.orders
   WHERE order_number LIKE day_prefix || '%';

  result := day_prefix || lpad(count_today::text, 3, '0');
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.generate_order_number() IS 'Génère un numéro de commande unique LPD-YYYYMMDD-NNN';

-- ============================================================
-- 2. generate_invoice_number()
-- Format : INV-YYYY-NNNNN (compteur annuel)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  year_str    text;
  year_prefix text;
  count_year  int;
  result      text;
BEGIN
  year_str    := to_char(timezone('UTC', now()), 'YYYY');
  year_prefix := 'INV-' || year_str || '-';

  SELECT COUNT(*) + 1
    INTO count_year
    FROM public.invoices
   WHERE invoice_number LIKE year_prefix || '%';

  result := year_prefix || lpad(count_year::text, 5, '0');
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_number() IS 'Génère un numéro de facture unique INV-YYYY-NNNNN';

-- ============================================================
-- 3. generate_referral_code()
-- 8 caractères alphanumériques uppercase aléatoires
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT upper(substring(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8));
$$;

COMMENT ON FUNCTION public.generate_referral_code() IS 'Génère un code de parrainage de 8 caractères uppercase';

-- ============================================================
-- 4. set_profile_defaults()
-- Trigger BEFORE INSERT sur profiles — génère referral_code si absent
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Générer un code de parrainage unique si non fourni
  IF NEW.referral_code IS NULL THEN
    LOOP
      NEW.referral_code := public.generate_referral_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE referral_code = NEW.referral_code
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_defaults
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_defaults();

COMMENT ON FUNCTION public.set_profile_defaults() IS 'Trigger : génère le referral_code si absent à l''insertion';

-- ============================================================
-- 5. calculate_payment_due_at(order_id, grace_days)
-- Renvoie picked_up_at + grace_days (null si pas encore retiré)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_payment_due_at(
  p_order_id  uuid,
  p_grace_days int
)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT o.picked_up_at + (p_grace_days || ' days')::interval
    FROM public.orders o
   WHERE o.id = p_order_id
     AND o.picked_up_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.calculate_payment_due_at(uuid, int) IS 'Calcule la date d''échéance = picked_up_at + grace_days';

-- ============================================================
-- 6. process_overdue_payments()
-- Batch : marque pending → overdue et bloque les clients
-- Appelable via pg_cron ou Supabase scheduled functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_overdue_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Marquer les paiements en retard
  UPDATE public.payments
     SET status = 'overdue',
         updated_at = now()
   WHERE status = 'pending'
     AND due_at IS NOT NULL
     AND due_at < now();

  -- Bloquer les clients dont le paiement est overdue
  -- depuis plus de payment_block_days jours
  FOR rec IN
    SELECT DISTINCT
      o.client_id,
      p.due_at,
      pr.payment_block_days
    FROM public.payments p
    JOIN public.orders o ON o.id = p.order_id
    JOIN public.producers pr ON pr.id = o.producer_id
   WHERE p.status = 'overdue'
     AND p.due_at IS NOT NULL
     AND p.due_at + (pr.payment_block_days || ' days')::interval < now()
  LOOP
    UPDATE public.profiles
       SET ordering_blocked_until = now() + interval '30 days',
           updated_at = now()
     WHERE id = rec.client_id
       AND (ordering_blocked_until IS NULL OR ordering_blocked_until < now());
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.process_overdue_payments() IS 'Batch cron : passe les paiements en overdue et bloque les clients impayés';

-- ============================================================
-- 7. send_payment_reminder(payment_id)
-- Insère une notification de type 'payment_reminder'
-- L'envoi effectif (email, WhatsApp) est géré par l'application
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_payment_reminder(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id uuid;
  v_order_id  uuid;
BEGIN
  -- Récupérer le client associé au paiement
  SELECT o.client_id, o.id
    INTO v_client_id, v_order_id
    FROM public.payments pay
    JOIN public.orders o ON o.id = pay.order_id
   WHERE pay.id = p_payment_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Paiement introuvable : %', p_payment_id;
  END IF;

  -- Insérer la notification (l'app se charge de l'envoi réel)
  INSERT INTO public.notifications (user_id, channel, event_type, payload, status)
  VALUES (
    v_client_id,
    'email',
    'payment_reminder',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'order_id',   v_order_id
    ),
    'pending'
  );
END;
$$;

COMMENT ON FUNCTION public.send_payment_reminder(uuid) IS 'Enqueue une notification de relance impayé (l''app envoie effectivement)';

-- ============================================================
-- 8. check_ordering_allowed(client_id)
-- Renvoie false si le client est bloqué pour impayé
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ordering_allowed(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT NOT (
    ordering_blocked_until IS NOT NULL
    AND ordering_blocked_until > now()
  )
  FROM public.profiles
  WHERE id = p_client_id;
$$;

COMMENT ON FUNCTION public.check_ordering_allowed(uuid) IS 'Retourne false si le client est bloqué pour impayé';

-- ============================================================
-- 9. Trigger after_order_pickup
-- Quand orders.status → 'picked_up' : calcule payments.due_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_after_order_pickup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_grace_days int;
BEGIN
  -- Seulement quand le statut passe à 'picked_up'
  IF NEW.status = 'picked_up' AND (OLD.status IS DISTINCT FROM 'picked_up') THEN
    -- Lire le délai de grâce du producteur (payment_reminder_days)
    SELECT payment_reminder_days
      INTO v_grace_days
      FROM public.producers
     WHERE id = NEW.producer_id;

    -- Mettre à jour picked_up_at si pas encore renseigné
    IF NEW.picked_up_at IS NULL THEN
      NEW.picked_up_at := now();
    END IF;

    -- Calculer et mettre à jour due_at sur le paiement associé
    UPDATE public.payments
       SET due_at     = NEW.picked_up_at + (v_grace_days || ' days')::interval,
           updated_at = now()
     WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_order_pickup
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_after_order_pickup();

COMMENT ON FUNCTION public.fn_after_order_pickup() IS 'Trigger : calcule payments.due_at quand la commande est retirée';

-- ============================================================
-- 10. Trigger create_invoice_on_order_confirmed
-- Quand orders.status → 'confirmed' : crée la facture
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_invoice_on_confirmed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Seulement quand le statut passe à 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    -- Insérer la facture uniquement si elle n'existe pas encore
    INSERT INTO public.invoices (order_id, invoice_number, amount_cents, status)
    VALUES (
      NEW.id,
      public.generate_invoice_number(),
      NEW.total_cents,
      'issued'
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_invoice_on_order_confirmed
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_create_invoice_on_confirmed();

COMMENT ON FUNCTION public.fn_create_invoice_on_confirmed() IS 'Trigger : génère une facture quand la commande passe en confirmed';

-- ============================================================
-- 11. Vue : v_client_dashboard
-- Commande courante + historique + impayés du client
-- ============================================================
CREATE OR REPLACE VIEW public.v_client_dashboard AS
SELECT
  o.id                  AS order_id,
  o.order_number,
  o.status              AS order_status,
  o.total_cents,
  o.placed_at,
  o.picked_up_at,
  p.status              AS payment_status,
  p.due_at              AS payment_due_at,
  p.method              AS payment_method,
  i.invoice_number,
  i.pdf_url,
  pr.name               AS producer_name,
  wc.delivery_date,
  e.name                AS entity_name,
  o.client_id
FROM public.orders o
LEFT JOIN public.payments p    ON p.order_id = o.id
LEFT JOIN public.invoices i    ON i.order_id = o.id
JOIN public.producers pr       ON pr.id = o.producer_id
JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
JOIN public.entities e         ON e.id = o.entity_id
ORDER BY o.placed_at DESC;

COMMENT ON VIEW public.v_client_dashboard IS 'Vue client : commandes, paiements et factures';

-- ============================================================
-- 12. Vue : v_producer_dashboard
-- Commandes de la semaine + revenus + impayés producteur
-- ============================================================
CREATE OR REPLACE VIEW public.v_producer_dashboard AS
SELECT
  wc.week_start,
  wc.delivery_date,
  wc.status             AS catalog_status,
  COUNT(o.id)           AS total_orders,
  SUM(o.total_cents)    AS total_revenue_cents,
  SUM(CASE WHEN p.status = 'overdue' THEN p.amount_cents ELSE 0 END) AS overdue_cents,
  SUM(CASE WHEN p.status = 'paid'    THEN p.amount_cents ELSE 0 END) AS paid_cents,
  SUM(CASE WHEN p.status = 'pending' THEN p.amount_cents ELSE 0 END) AS pending_cents,
  wc.producer_id
FROM public.weekly_catalogs wc
LEFT JOIN public.orders o ON o.weekly_catalog_id = wc.id
  AND o.status NOT IN ('canceled')
LEFT JOIN public.payments p ON p.order_id = o.id
GROUP BY wc.id, wc.week_start, wc.delivery_date, wc.status, wc.producer_id
ORDER BY wc.week_start DESC;

COMMENT ON VIEW public.v_producer_dashboard IS 'Vue producteur : synthèse semaines, revenus et impayés';

-- ============================================================
-- 13. Vue : v_admin_reconciliation
-- Paiements pending/overdue avec détails pour l'admin
-- ============================================================
CREATE OR REPLACE VIEW public.v_admin_reconciliation AS
SELECT
  p.id                  AS payment_id,
  p.status              AS payment_status,
  p.amount_cents,
  p.due_at,
  p.method,
  p.payment_reference,
  o.id                  AS order_id,
  o.order_number,
  o.placed_at,
  o.picked_up_at,
  pr_profile.full_name  AS client_name,
  pr_profile.phone      AS client_phone,
  e.name                AS entity_name,
  prod.name             AS producer_name,
  (SELECT COUNT(*) FROM public.payment_reminders rem WHERE rem.payment_id = p.id) AS reminders_sent
FROM public.payments p
JOIN public.orders o         ON o.id = p.order_id
JOIN public.profiles pr_profile ON pr_profile.id = o.client_id
JOIN public.entities e       ON e.id = o.entity_id
JOIN public.producers prod   ON prod.id = o.producer_id
WHERE p.status IN ('pending', 'overdue')
ORDER BY p.due_at ASC NULLS LAST;

COMMENT ON VIEW public.v_admin_reconciliation IS 'Vue admin : paiements en attente et en retard avec détails client';

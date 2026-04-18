-- ============================================================
-- Migration 0006 : Gamification — badges, leaderboard, challenges
-- ============================================================

-- ============================================================
-- Colonnes gamification sur profiles
-- Note : nécessite supabase_admin (owner de la table).
-- En local : psql -U supabase_admin ou via Supabase CLI.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_display_name text;

COMMENT ON COLUMN public.profiles.leaderboard_opt_in IS 'Consentement explicite RGPD pour apparaître dans le leaderboard entité';
COMMENT ON COLUMN public.profiles.public_display_name IS 'Pseudo public visible dans le leaderboard (fallback sur display_name puis Anonyme)';

-- ============================================================
-- TABLE : user_badges
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_code  text        NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS user_badges_user_awarded
  ON public.user_badges (user_id, awarded_at DESC);

COMMENT ON TABLE public.user_badges IS 'Badges de gamification attribués aux utilisateurs';
COMMENT ON COLUMN public.user_badges.badge_code IS 'first_basket | ten_baskets | fifty_baskets | regular_3_months | regular_6_months | entity_founder | multi_producer | early_adopter';

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Client : voir ses propres badges
CREATE POLICY user_badges_self_select ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Client : voir les badges des users opt-in de la même entité
CREATE POLICY user_badges_entity_select ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles viewer
      JOIN public.profiles owner ON owner.id = user_badges.user_id
      WHERE viewer.id = auth.uid()
        AND viewer.entity_id = owner.entity_id
        AND owner.leaderboard_opt_in = true
    )
  );

-- Admin : accès complet
CREATE POLICY user_badges_admin_all ON public.user_badges
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- ============================================================
-- TABLE : community_challenges
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_challenges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid        REFERENCES public.entities(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  metric        text        NOT NULL CHECK (metric IN ('total_baskets','total_clients','weeks_streak','revenue_cents')),
  target_value  bigint      NOT NULL,
  start_date    date        NOT NULL,
  end_date      date        NOT NULL,
  reward        text,
  created_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.community_challenges IS 'Défis collectifs par entité (entity_id NULL = global)';
COMMENT ON COLUMN public.community_challenges.entity_id IS 'NULL = challenge global pour toutes les entités';

ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;

-- Client : voir les challenges de son entité + challenges globaux
CREATE POLICY community_challenges_client_select ON public.community_challenges
  FOR SELECT
  TO authenticated
  USING (
    entity_id IS NULL
    OR entity_id = public.current_client_entity_id()
  );

-- Admin : accès complet
CREATE POLICY community_challenges_admin_all ON public.community_challenges
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- ============================================================
-- FONCTION : award_badges_for_user(p_user_id uuid)
-- Calcule et insère les badges manquants. Idempotente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_badges_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_picked_up_count   bigint;
  v_entity_id         uuid;
  v_user_created_at   timestamptz;
  v_first_order_at    timestamptz;
  v_platform_min_at   timestamptz;
  v_entity_first_at   timestamptz;
  v_distinct_producers bigint;
  v_streak_weeks      int;
  -- consecutive weeks calculation
  v_week_series       record;
  v_prev_week         date;
  v_current_streak    int;
  v_max_streak        int;
BEGIN
  -- Nombre de commandes picked_up
  SELECT COUNT(*) INTO v_picked_up_count
  FROM public.orders
  WHERE client_id = p_user_id
    AND status = 'picked_up';

  -- Badges volume
  IF v_picked_up_count >= 1 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'first_basket')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  IF v_picked_up_count >= 10 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'ten_baskets')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  IF v_picked_up_count >= 50 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'fifty_baskets')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  -- Calcul des séries hebdomadaires consécutives
  v_prev_week := NULL;
  v_current_streak := 0;
  v_max_streak := 0;

  FOR v_week_series IN
    SELECT DISTINCT date_trunc('week', picked_up_at)::date AS week_start
    FROM public.orders
    WHERE client_id = p_user_id
      AND status = 'picked_up'
      AND picked_up_at IS NOT NULL
    ORDER BY week_start ASC
  LOOP
    IF v_prev_week IS NULL THEN
      v_current_streak := 1;
    ELSIF v_week_series.week_start = v_prev_week + interval '7 days' THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;

    IF v_current_streak > v_max_streak THEN
      v_max_streak := v_current_streak;
    END IF;

    v_prev_week := v_week_series.week_start;
  END LOOP;

  IF v_max_streak >= 12 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'regular_3_months')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  IF v_max_streak >= 26 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'regular_6_months')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  -- Infos profil
  SELECT entity_id, created_at INTO v_entity_id, v_user_created_at
  FROM public.profiles
  WHERE id = p_user_id;

  -- entity_founder : premier client à commander sur son entité
  IF v_entity_id IS NOT NULL THEN
    SELECT MIN(o.placed_at) INTO v_entity_first_at
    FROM public.orders o
    JOIN public.profiles p2 ON p2.id = o.client_id
    WHERE p2.entity_id = v_entity_id
      AND p2.role = 'client';

    SELECT MIN(o.placed_at) INTO v_first_order_at
    FROM public.orders o
    WHERE o.client_id = p_user_id;

    IF v_first_order_at IS NOT NULL AND v_entity_first_at IS NOT NULL
       AND v_first_order_at = v_entity_first_at THEN
      INSERT INTO public.user_badges (user_id, badge_code)
      VALUES (p_user_id, 'entity_founder')
      ON CONFLICT (user_id, badge_code) DO NOTHING;
    END IF;
  END IF;

  -- multi_producer : commandé chez >=2 producteurs différents
  SELECT COUNT(DISTINCT producer_id) INTO v_distinct_producers
  FROM public.orders
  WHERE client_id = p_user_id
    AND status = 'picked_up';

  IF v_distinct_producers >= 2 THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'multi_producer')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;

  -- early_adopter : compte créé dans le 1er mois de la plateforme
  SELECT MIN(created_at) INTO v_platform_min_at
  FROM public.profiles;

  IF v_platform_min_at IS NOT NULL
     AND v_user_created_at < v_platform_min_at + interval '30 days' THEN
    INSERT INTO public.user_badges (user_id, badge_code)
    VALUES (p_user_id, 'early_adopter')
    ON CONFLICT (user_id, badge_code) DO NOTHING;
  END IF;
END;
$$;

-- ============================================================
-- TRIGGER : awards badges on order pickup
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_award_badges_on_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'picked_up' AND (OLD.status IS NULL OR OLD.status != 'picked_up') THEN
    PERFORM public.award_badges_for_user(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_award_badges_trg ON public.orders;
CREATE TRIGGER orders_award_badges_trg
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_badges_on_pickup();

-- ============================================================
-- VIEW : v_user_stats
-- Stats individuelles par client
-- ============================================================
CREATE OR REPLACE VIEW public.v_user_stats AS
SELECT
  p.id                                              AS user_id,
  COUNT(o.id) FILTER (WHERE o.status = 'picked_up') AS total_baskets,
  COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'picked_up'), 0)
                                                    AS total_spent_cents,
  -- Économies estimées : 15 % vs supermarché
  ROUND(
    COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'picked_up'), 0) * 0.15
  )::bigint                                         AS estimated_savings_cents,
  MIN(o.placed_at) FILTER (WHERE o.status = 'picked_up')
                                                    AS first_order_at,
  MAX(o.placed_at) FILTER (WHERE o.status = 'picked_up')
                                                    AS last_order_at,
  -- Producteur favori (le plus commandé en picked_up)
  (
    SELECT pr.name
    FROM public.orders sub_o
    JOIN public.producers pr ON pr.id = sub_o.producer_id
    WHERE sub_o.client_id = p.id
      AND sub_o.status = 'picked_up'
    GROUP BY pr.id, pr.name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )                                                 AS favorite_producer_name,
  (
    SELECT COUNT(*)
    FROM public.orders sub_o2
    JOIN public.producers pr2 ON pr2.id = sub_o2.producer_id
    WHERE sub_o2.client_id = p.id
      AND sub_o2.status = 'picked_up'
      AND pr2.name = (
        SELECT pr3.name
        FROM public.orders sub_o3
        JOIN public.producers pr3 ON pr3.id = sub_o3.producer_id
        WHERE sub_o3.client_id = p.id
          AND sub_o3.status = 'picked_up'
        GROUP BY pr3.id, pr3.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
  )                                                 AS favorite_producer_order_count
FROM public.profiles p
LEFT JOIN public.orders o ON o.client_id = p.id
WHERE p.role = 'client'
  AND p.deleted_at IS NULL
GROUP BY p.id;

COMMENT ON VIEW public.v_user_stats IS 'Stats agrégées par client (paniers, dépenses, économies, producteur favori)';

-- ============================================================
-- VIEW : v_entity_leaderboard
-- Classement par entité — filtre opt-in
-- ============================================================
CREATE OR REPLACE VIEW public.v_entity_leaderboard AS
SELECT
  p.entity_id,
  p.id                                              AS user_id,
  COALESCE(p.public_display_name, p.display_name, 'Anonyme')
                                                    AS public_display_name,
  COUNT(o.id) FILTER (WHERE o.status = 'picked_up') AS total_baskets,
  COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'picked_up'), 0)
                                                    AS total_spent_cents,
  DENSE_RANK() OVER (
    PARTITION BY p.entity_id
    ORDER BY COUNT(o.id) FILTER (WHERE o.status = 'picked_up') DESC
  )                                                 AS rank
FROM public.profiles p
LEFT JOIN public.orders o ON o.client_id = p.id
WHERE p.role = 'client'
  AND p.deleted_at IS NULL
  AND p.leaderboard_opt_in = true
GROUP BY p.entity_id, p.id, p.public_display_name, p.display_name;

COMMENT ON VIEW public.v_entity_leaderboard IS 'Classement public des clients opt-in par entité';

-- ============================================================
-- VIEW : v_entity_community_progress
-- Progression collective par entité
-- ============================================================
CREATE OR REPLACE VIEW public.v_entity_community_progress AS
SELECT
  p.entity_id,
  COUNT(o.id) FILTER (
    WHERE o.status = 'picked_up'
      AND o.picked_up_at >= date_trunc('week', now())
  )                                                 AS current_week_orders,
  COUNT(o.id) FILTER (
    WHERE o.status = 'picked_up'
      AND o.picked_up_at >= date_trunc('month', now())
  )                                                 AS current_month_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'picked_up') AS total_all_time_orders,
  COUNT(DISTINCT p.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM public.orders ao
      WHERE ao.client_id = p.id
        AND ao.status = 'picked_up'
        AND ao.picked_up_at >= now() - interval '30 days'
    )
  )                                                 AS total_active_clients
FROM public.profiles p
LEFT JOIN public.orders o ON o.client_id = p.id
WHERE p.role = 'client'
  AND p.deleted_at IS NULL
GROUP BY p.entity_id;

COMMENT ON VIEW public.v_entity_community_progress IS 'Progression collective de commandes par entité';

-- ============================================================
-- Grants pour les vues (authenticated + service_role)
-- ============================================================
GRANT SELECT ON public.v_user_stats TO authenticated;
GRANT SELECT ON public.v_entity_leaderboard TO authenticated;
GRANT SELECT ON public.v_entity_community_progress TO authenticated;
GRANT SELECT ON public.community_challenges TO authenticated;
GRANT SELECT ON public.user_badges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_badges TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.community_challenges TO service_role;

-- ============================================================
-- Seed badges pour les comptes de test
-- ============================================================
SELECT public.award_badges_for_user(id) FROM public.profiles WHERE role = 'client';

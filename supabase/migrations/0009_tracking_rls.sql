-- ============================================================
-- Migration 0009 : RLS enrichi delivery_tracking_points
--                  + colonnes speed/bearing
--                  + Supabase Realtime publication
-- ============================================================

-- Ajouter les colonnes speed et bearing si absentes
ALTER TABLE public.delivery_tracking_points
  ADD COLUMN IF NOT EXISTS speed   double precision,
  ADD COLUMN IF NOT EXISTS bearing double precision;

COMMENT ON COLUMN public.delivery_tracking_points.speed   IS 'Vitesse en m/s au moment de la prise de position';
COMMENT ON COLUMN public.delivery_tracking_points.bearing IS 'Cap en degrés (0-360, 0=Nord)';

-- Publier la table sur le canal Supabase Realtime
-- (nécessite que la publication supabase_realtime existe déjà)
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking_points;

-- Publier aussi la table deliveries pour les changements de status
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;

-- ============================================================
-- S'assurer que les policies nécessaires existent
-- (elles sont déjà dans 0002_rls.sql mais on vérifie l'INSERT)
-- ============================================================

-- Le producteur peut INSERT ses propres tracking points
-- (la policy tracking_producer_own couvre déjà FOR ALL avec WITH CHECK(true))
-- On s'assure que la policy client_select a bien la jointure sur orders
-- pour les clients ayant une commande dans le catalog concerné

DROP POLICY IF EXISTS tracking_client_select ON public.delivery_tracking_points;

CREATE POLICY tracking_client_select ON public.delivery_tracking_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.orders o ON o.weekly_catalog_id = d.weekly_catalog_id
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE d.id = delivery_tracking_points.delivery_id
        AND o.user_id = auth.uid()
        AND o.status NOT IN ('canceled')
    )
    OR
    -- Fallback: entity membership (pour les cas sans order directe)
    EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.weekly_catalogs wc ON wc.id = d.weekly_catalog_id
      JOIN public.producer_entities pe ON pe.producer_id = wc.producer_id
      WHERE d.id = delivery_tracking_points.delivery_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

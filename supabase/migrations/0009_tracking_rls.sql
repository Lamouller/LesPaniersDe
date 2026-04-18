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
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;

-- ============================================================
-- Recréer la policy client avec la bonne clé (client_id = auth.uid())
-- ============================================================

DROP POLICY IF EXISTS tracking_client_select ON public.delivery_tracking_points;

CREATE POLICY tracking_client_select ON public.delivery_tracking_points
  FOR SELECT
  TO authenticated
  USING (
    -- Client ayant une commande dans le catalog de cette livraison
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.orders o ON o.weekly_catalog_id = d.weekly_catalog_id
      WHERE d.id = delivery_tracking_points.delivery_id
        AND o.client_id = auth.uid()
        AND o.status NOT IN ('canceled')
    )
    OR
    -- Fallback: membre d'une entité liée au producteur
    EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.weekly_catalogs wc ON wc.id = d.weekly_catalog_id
      JOIN public.producer_entities pe ON pe.producer_id = wc.producer_id
      WHERE d.id = delivery_tracking_points.delivery_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

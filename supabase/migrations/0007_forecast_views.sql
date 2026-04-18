-- ============================================================
-- Migration 0007 : Vues prévisionnelles CA
-- ============================================================

-- ============================================================
-- VIEW : v_producer_forecast_weekly
-- Prévisionnel 4 semaines par producer
-- ============================================================
CREATE OR REPLACE VIEW public.v_producer_forecast_weekly AS
WITH
  current_week AS (
    SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
  ),
  weeks AS (
    SELECT
      (cw.week_start + (offset_val * 7))::date AS week_start,
      offset_val                                AS week_offset
    FROM current_week cw,
    LATERAL (VALUES (0),(1),(2),(3)) AS t(offset_val)
  ),
  all_producers AS (
    SELECT id AS producer_id, name AS producer_name
    FROM public.producers
    WHERE is_active = true
  ),
  producer_weeks AS (
    SELECT p.producer_id, p.producer_name, w.week_start, w.week_offset
    FROM all_producers p
    CROSS JOIN weeks w
  ),
  -- Commandes confirmées : totaux par producer × semaine
  confirmed_orders AS (
    SELECT
      o.producer_id,
      wc.week_start,
      COUNT(DISTINCT o.id)::int  AS confirmed_orders_count,
      SUM(o.total_cents)::bigint AS confirmed_cents
    FROM public.orders o
    JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
    WHERE o.status IN ('confirmed', 'prepared', 'ready_for_pickup', 'picked_up')
    GROUP BY o.producer_id, wc.week_start
  ),
  -- Paniers confirmés par size (séparé pour éviter les agrégats imbriqués)
  confirmed_basket_sizes AS (
    SELECT
      o.producer_id,
      wc.week_start,
      COALESCE(p.size, 'other') AS size,
      COUNT(oi.id)::int         AS basket_count
    FROM public.orders o
    JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.status IN ('confirmed', 'prepared', 'ready_for_pickup', 'picked_up')
      AND p.kind = 'basket'
    GROUP BY o.producer_id, wc.week_start, p.size
  ),
  confirmed_baskets_jsonb AS (
    SELECT
      producer_id,
      week_start,
      jsonb_object_agg(size, basket_count) AS confirmed_baskets_by_size
    FROM confirmed_basket_sizes
    GROUP BY producer_id, week_start
  ),
  -- Abonnements actifs avec valeur estimée
  subscription_value AS (
    SELECT
      s.producer_id,
      s.id       AS subscription_id,
      s.frequency,
      s.paused_until,
      (
        SELECT COALESCE(SUM((item->>'quantity')::int * p.unit_price_cents), 0)
        FROM jsonb_array_elements(s.items) AS item
        JOIN public.products p ON p.id = (item->>'product_id')::uuid
      )::int     AS order_value_cents
    FROM public.subscriptions s
    WHERE s.status = 'active'
  ),
  -- Paniers par abonnement (dénormalisé)
  subscription_basket_sizes AS (
    SELECT
      s.id                                                    AS subscription_id,
      s.producer_id,
      s.frequency,
      s.paused_until,
      COALESCE(p.size, 'other')                              AS size,
      (item->>'quantity')::int                               AS qty
    FROM public.subscriptions s
    CROSS JOIN jsonb_array_elements(s.items) AS item
    JOIN public.products p ON p.id = (item->>'product_id')::uuid
    WHERE s.status = 'active'
      AND p.kind = 'basket'
  ),
  -- Projection subscriptions : totaux par producer × semaine
  projected_subscriptions AS (
    SELECT
      sv.producer_id,
      w.week_start,
      COUNT(*)::int                     AS projected_orders_count,
      SUM(sv.order_value_cents)::bigint AS projected_cents
    FROM subscription_value sv
    CROSS JOIN weeks w
    WHERE (
      sv.frequency = 'weekly'
      OR (sv.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 2) = 0)
      OR (sv.frequency = 'monthly'  AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 4) = 0)
    )
    AND (sv.paused_until IS NULL OR sv.paused_until <= w.week_start)
    GROUP BY sv.producer_id, w.week_start
  ),
  -- Tailles projetées : d'abord SUM par (producer, week, size), puis jsonb_object_agg
  projected_basket_sizes_raw AS (
    SELECT
      sbs.producer_id,
      w.week_start,
      sbs.size,
      SUM(sbs.qty)::int AS total_qty
    FROM subscription_basket_sizes sbs
    CROSS JOIN weeks w
    WHERE (
      sbs.frequency = 'weekly'
      OR (sbs.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 2) = 0)
      OR (sbs.frequency = 'monthly'  AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 4) = 0)
    )
    AND (sbs.paused_until IS NULL OR sbs.paused_until <= w.week_start)
    GROUP BY sbs.producer_id, w.week_start, sbs.size
  ),
  projected_baskets_jsonb AS (
    SELECT
      producer_id,
      week_start,
      jsonb_object_agg(size, total_qty) AS projected_baskets_by_size
    FROM projected_basket_sizes_raw
    GROUP BY producer_id, week_start
  )
SELECT
  pw.producer_id,
  pw.producer_name,
  pw.week_start,
  'S' || TO_CHAR(pw.week_start, 'IW') || ' (' || TO_CHAR(pw.week_start, 'DD/MM') || ')' AS week_label,
  pw.week_offset,
  CASE WHEN pw.week_offset <= 1 THEN COALESCE(co.confirmed_cents, 0) ELSE 0 END::bigint          AS confirmed_cents,
  CASE WHEN pw.week_offset = 0  THEN 0 ELSE COALESCE(ps.projected_cents, 0) END::bigint          AS projected_cents,
  CASE
    WHEN pw.week_offset = 0 THEN COALESCE(co.confirmed_cents, 0)
    WHEN pw.week_offset = 1 THEN COALESCE(co.confirmed_cents, 0) + COALESCE(ps.projected_cents, 0)
    ELSE COALESCE(ps.projected_cents, 0)
  END::bigint                                                                                      AS total_cents,
  CASE WHEN pw.week_offset <= 1 THEN COALESCE(co.confirmed_orders_count, 0) ELSE 0 END::int      AS confirmed_orders_count,
  CASE WHEN pw.week_offset >= 1 THEN COALESCE(ps.projected_orders_count, 0) ELSE 0 END::int      AS projected_orders_count,
  COALESCE(cbj.confirmed_baskets_by_size, '{}'::jsonb)                                            AS confirmed_baskets_by_size,
  COALESCE(pbj.projected_baskets_by_size, '{}'::jsonb)                                            AS projected_baskets_by_size
FROM producer_weeks pw
LEFT JOIN confirmed_orders co
  ON co.producer_id = pw.producer_id AND co.week_start = pw.week_start
LEFT JOIN confirmed_baskets_jsonb cbj
  ON cbj.producer_id = pw.producer_id AND cbj.week_start = pw.week_start
LEFT JOIN projected_subscriptions ps
  ON ps.producer_id = pw.producer_id AND ps.week_start = pw.week_start
LEFT JOIN projected_baskets_jsonb pbj
  ON pbj.producer_id = pw.producer_id AND pbj.week_start = pw.week_start
ORDER BY pw.producer_id, pw.week_start;

COMMENT ON VIEW public.v_producer_forecast_weekly IS
  'Prévisionnel CA 4 semaines glissantes par producer (confirmé + projeté depuis subscriptions)';

-- ============================================================
-- VIEW : v_producer_forecast_by_entity
-- Détail producer × entity × semaine
-- ============================================================
CREATE OR REPLACE VIEW public.v_producer_forecast_by_entity AS
WITH
  current_week AS (
    SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
  ),
  weeks AS (
    SELECT
      (cw.week_start + (offset_val * 7))::date AS week_start,
      offset_val                                AS week_offset
    FROM current_week cw,
    LATERAL (VALUES (0),(1),(2),(3)) AS t(offset_val)
  ),
  -- Paniers confirmés par (producer, entity, week, size) puis jsonb
  entity_basket_sizes AS (
    SELECT
      o.producer_id,
      o.entity_id,
      wc.week_start,
      COALESCE(p.size, 'other') AS size,
      COUNT(oi.id)::int         AS basket_count
    FROM public.orders o
    JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.status IN ('confirmed', 'prepared', 'ready_for_pickup', 'picked_up')
      AND p.kind = 'basket'
    GROUP BY o.producer_id, o.entity_id, wc.week_start, p.size
  ),
  entity_baskets_jsonb AS (
    SELECT
      producer_id,
      entity_id,
      week_start,
      jsonb_object_agg(size, basket_count) AS baskets_mix_confirmed
    FROM entity_basket_sizes
    GROUP BY producer_id, entity_id, week_start
  ),
  -- Commandes confirmées par producer × entity × semaine
  confirmed_by_entity AS (
    SELECT
      o.producer_id,
      o.entity_id,
      e.name                     AS entity_name,
      wc.week_start,
      COUNT(DISTINCT o.id)::int  AS orders_count,
      SUM(o.total_cents)::bigint AS total_cents
    FROM public.orders o
    JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
    JOIN public.entities e ON e.id = o.entity_id
    WHERE o.status IN ('confirmed', 'prepared', 'ready_for_pickup', 'picked_up')
    GROUP BY o.producer_id, o.entity_id, e.name, wc.week_start
  ),
  -- Projection abonnements par entity
  projected_by_entity AS (
    SELECT
      s.producer_id,
      pr.entity_id,
      e.name        AS entity_name,
      w.week_start,
      COUNT(*)::int AS projected_orders
    FROM public.subscriptions s
    JOIN public.profiles pr ON pr.id = s.client_id
    JOIN public.entities e ON e.id = pr.entity_id
    CROSS JOIN weeks w
    WHERE s.status = 'active'
      AND pr.entity_id IS NOT NULL
      AND (
        s.frequency = 'weekly'
        OR (s.frequency = 'biweekly' AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 2) = 0)
        OR (s.frequency = 'monthly'  AND MOD(EXTRACT(WEEK FROM w.week_start)::int, 4) = 0)
      )
      AND (s.paused_until IS NULL OR s.paused_until <= w.week_start)
    GROUP BY s.producer_id, pr.entity_id, e.name, w.week_start
  )
SELECT
  COALESCE(cbe.producer_id, pbe.producer_id)        AS producer_id,
  COALESCE(cbe.entity_id, pbe.entity_id)            AS entity_id,
  COALESCE(cbe.entity_name, pbe.entity_name)        AS entity_name,
  COALESCE(cbe.week_start, pbe.week_start)          AS week_start,
  COALESCE(cbe.orders_count, 0)::int                AS confirmed_orders_count,
  COALESCE(pbe.projected_orders, 0)::int            AS projected_orders_count,
  COALESCE(ebj.baskets_mix_confirmed, '{}'::jsonb)  AS baskets_mix_confirmed,
  COALESCE(cbe.total_cents, 0)::bigint              AS total_cents
FROM confirmed_by_entity cbe
FULL OUTER JOIN projected_by_entity pbe
  ON pbe.producer_id = cbe.producer_id
  AND pbe.entity_id = cbe.entity_id
  AND pbe.week_start = cbe.week_start
LEFT JOIN entity_baskets_jsonb ebj
  ON ebj.producer_id = COALESCE(cbe.producer_id, pbe.producer_id)
  AND ebj.entity_id  = COALESCE(cbe.entity_id, pbe.entity_id)
  AND ebj.week_start = COALESCE(cbe.week_start, pbe.week_start)
ORDER BY
  COALESCE(cbe.producer_id, pbe.producer_id),
  COALESCE(cbe.week_start, pbe.week_start),
  COALESCE(cbe.entity_name, pbe.entity_name);

COMMENT ON VIEW public.v_producer_forecast_by_entity IS
  'Détail du prévisionnel par producer × entité × semaine (4 semaines)';

-- ============================================================
-- VIEW : v_producer_trend_12w
-- Historique 12 semaines glissantes par producer
-- ============================================================
CREATE OR REPLACE VIEW public.v_producer_trend_12w AS
WITH weeks AS (
  SELECT
    (date_trunc('week', CURRENT_DATE) - (gs * INTERVAL '7 days'))::date AS week_start
  FROM generate_series(0, 11) AS gs
)
SELECT
  o.producer_id,
  wc.week_start,
  'S' || TO_CHAR(wc.week_start, 'IW')         AS week_label,
  COUNT(DISTINCT o.id)::int                    AS orders_count,
  SUM(o.total_cents)::bigint                   AS revenue_cents,
  COUNT(DISTINCT o.client_id)::int             AS unique_clients,
  CASE
    WHEN COUNT(*) > 0 THEN (SUM(o.total_cents) / COUNT(*))::bigint
    ELSE 0
  END                                          AS avg_basket_cents
FROM public.orders o
JOIN public.weekly_catalogs wc ON wc.id = o.weekly_catalog_id
WHERE wc.week_start IN (SELECT week_start FROM weeks)
  AND o.status IN ('confirmed', 'prepared', 'ready_for_pickup', 'picked_up')
GROUP BY o.producer_id, wc.week_start
ORDER BY o.producer_id, wc.week_start;

COMMENT ON VIEW public.v_producer_trend_12w IS
  'Historique 12 semaines glissantes par producer pour le graphique tendance';

-- ============================================================
-- VIEW : v_admin_forecast_aggregate
-- Agrégat tous producers par semaine N à N+4
-- Dépend de v_producer_forecast_weekly et v_producer_forecast_by_entity
-- ============================================================
CREATE OR REPLACE VIEW public.v_admin_forecast_aggregate AS
WITH
  current_week AS (
    SELECT date_trunc('week', CURRENT_DATE)::date AS week_start
  ),
  weeks AS (
    SELECT
      (cw.week_start + (offset_val * 7))::date AS week_start,
      offset_val                                AS week_offset
    FROM current_week cw,
    LATERAL (VALUES (0),(1),(2),(3),(4)) AS t(offset_val)
  ),
  forecast_per_producer AS (
    SELECT
      fw.week_start,
      fw.producer_id,
      fw.producer_name,
      fw.total_cents,
      (fw.confirmed_orders_count + fw.projected_orders_count) AS orders_count
    FROM public.v_producer_forecast_weekly fw
  )
SELECT
  w.week_start,
  'S' || TO_CHAR(w.week_start, 'IW') || ' (' || TO_CHAR(w.week_start, 'DD/MM') || ')' AS week_label,
  w.week_offset,
  COALESCE(SUM(fp.total_cents), 0)::bigint   AS total_revenue_cents,
  COUNT(DISTINCT fp.producer_id)::int         AS producers_count,
  (
    SELECT COUNT(DISTINCT fbe.entity_id)
    FROM public.v_producer_forecast_by_entity fbe
    WHERE fbe.week_start = w.week_start
  )::int                                      AS entities_count,
  COALESCE(SUM(fp.orders_count), 0)::int      AS orders_count,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'producer_id', fp.producer_id,
        'name', fp.producer_name,
        'cents', fp.total_cents
      ) ORDER BY fp.total_cents DESC
    ) FILTER (WHERE fp.producer_id IS NOT NULL),
    '[]'::jsonb
  )                                           AS producer_breakdown
FROM weeks w
LEFT JOIN forecast_per_producer fp ON fp.week_start = w.week_start
GROUP BY w.week_start, w.week_offset
ORDER BY w.week_start;

COMMENT ON VIEW public.v_admin_forecast_aggregate IS
  'Agrégat prévisionnel tous producers par semaine (N à N+4) pour le dashboard admin';

-- ============================================================
-- VIEW : v_producer_capacity_alerts
-- Alertes capacité par catalog ouvert
-- ============================================================
CREATE OR REPLACE VIEW public.v_producer_capacity_alerts AS
WITH current_orders AS (
  SELECT
    o.weekly_catalog_id,
    COUNT(*)::int AS order_count
  FROM public.orders o
  WHERE o.status NOT IN ('canceled')
  GROUP BY o.weekly_catalog_id
)
SELECT
  wc.id                                                                      AS catalog_id,
  wc.producer_id,
  p.name                                                                     AS producer_name,
  wc.week_start,
  wc.max_orders,
  COALESCE(co.order_count, 0)::int                                           AS current_orders,
  CASE
    WHEN wc.max_orders > 0 THEN
      ROUND((COALESCE(co.order_count, 0)::numeric / wc.max_orders::numeric) * 100, 1)
    ELSE 0::numeric
  END                                                                        AS fill_pct,
  CASE
    WHEN wc.max_orders > 0
      AND COALESCE(co.order_count, 0) >= wc.max_orders                      THEN 'critical'
    WHEN wc.max_orders > 0
      AND (COALESCE(co.order_count, 0)::numeric / wc.max_orders) > 0.8      THEN 'warning'
    WHEN wc.max_orders > 0
      AND (COALESCE(co.order_count, 0)::numeric / wc.max_orders) < 0.3
      AND wc.week_start <= CURRENT_DATE + 7                                 THEN 'info'
    ELSE NULL
  END                                                                        AS severity
FROM public.weekly_catalogs wc
JOIN public.producers p ON p.id = wc.producer_id
LEFT JOIN current_orders co ON co.weekly_catalog_id = wc.id
WHERE wc.max_orders IS NOT NULL
  AND wc.status IN ('open', 'closed')
  AND wc.week_start >= date_trunc('week', CURRENT_DATE)::date
ORDER BY
  CASE
    WHEN wc.max_orders > 0 AND COALESCE(co.order_count, 0) >= wc.max_orders THEN 1
    WHEN wc.max_orders > 0
      AND (COALESCE(co.order_count, 0)::numeric / wc.max_orders) > 0.8     THEN 2
    ELSE 3
  END,
  wc.week_start;

COMMENT ON VIEW public.v_producer_capacity_alerts IS
  'Alertes capacité par catalog (critical/warning/info) selon fill_pct';

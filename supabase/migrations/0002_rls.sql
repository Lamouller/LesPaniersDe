-- ============================================================
-- Migration 0002 : Row Level Security (RLS)
-- ============================================================

-- ============================================================
-- Fonctions helper pour les policies
-- ============================================================

-- Vérifie si l'utilisateur courant est admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND deleted_at IS NULL
  );
$$;

-- Vérifie si l'utilisateur courant est producteur
CREATE OR REPLACE FUNCTION public.is_producer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'producer'
      AND deleted_at IS NULL
  );
$$;

-- Renvoie le producer_id de l'utilisateur courant (NULL si pas producteur)
CREATE OR REPLACE FUNCTION public.current_producer_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.producers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Renvoie l'entity_id du client courant (NULL si pas client)
CREATE OR REPLACE FUNCTION public.current_client_entity_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT entity_id FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'client'
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- ============================================================
-- Activation RLS sur toutes les tables
-- (audit_log : service role only, pas de RLS permissif)
-- ============================================================
ALTER TABLE public.entities                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producer_entities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_catalogs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_catalog_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking_points  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences  ENABLE ROW LEVEL SECURITY;
-- audit_log : PAS de RLS, accès service role uniquement

-- ============================================================
-- TABLE : entities
-- ============================================================
-- Admin : accès complet
CREATE POLICY entities_admin_all ON public.entities
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir son entité uniquement
CREATE POLICY entities_client_select ON public.entities
  FOR SELECT
  TO authenticated
  USING (id = public.current_client_entity_id());

-- Producteur : voir les entités qu'il dessert
CREATE POLICY entities_producer_select ON public.entities
  FOR SELECT
  TO authenticated
  USING (
    public.is_producer()
    AND EXISTS (
      SELECT 1 FROM public.producer_entities pe
      WHERE pe.entity_id = entities.id
        AND pe.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : producers
-- ============================================================
CREATE POLICY producers_admin_all ON public.producers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : voir/éditer son propre profil
CREATE POLICY producers_self_select ON public.producers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY producers_self_update ON public.producers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (true);

-- Client : voir les producteurs qui servent son entité
CREATE POLICY producers_client_select ON public.producers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.producer_entities pe
      WHERE pe.producer_id = producers.id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : producer_entities
-- ============================================================
CREATE POLICY producer_entities_admin_all ON public.producer_entities
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

CREATE POLICY producer_entities_producer_select ON public.producer_entities
  FOR SELECT
  TO authenticated
  USING (producer_id = public.current_producer_id());

CREATE POLICY producer_entities_client_select ON public.producer_entities
  FOR SELECT
  TO authenticated
  USING (entity_id = public.current_client_entity_id());

-- ============================================================
-- TABLE : profiles
-- ============================================================
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Chaque utilisateur lit/édite son propre profil
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (true);

-- Trigger d'insertion géré par la fonction set_profile_defaults (0003)
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Producteur : voir les profils clients qui lui ont commandé
CREATE POLICY profiles_producer_clients_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_producer()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.client_id = profiles.id
        AND o.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : products
-- ============================================================
CREATE POLICY products_admin_all ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : CRUD sur ses propres produits
CREATE POLICY products_producer_own ON public.products
  FOR ALL
  TO authenticated
  USING (producer_id = public.current_producer_id())
  WITH CHECK (true);

-- Client : voir les produits actifs des producteurs qui servent son entité
CREATE POLICY products_client_select ON public.products
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.producer_entities pe
      WHERE pe.producer_id = products.producer_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : weekly_catalogs
-- ============================================================
CREATE POLICY weekly_catalogs_admin_all ON public.weekly_catalogs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : CRUD sur ses catalogues
CREATE POLICY weekly_catalogs_producer_own ON public.weekly_catalogs
  FOR ALL
  TO authenticated
  USING (producer_id = public.current_producer_id())
  WITH CHECK (true);

-- Client : voir les catalogues ouverts des producteurs qui servent son entité
CREATE POLICY weekly_catalogs_client_select ON public.weekly_catalogs
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'closed', 'delivered')
    AND EXISTS (
      SELECT 1 FROM public.producer_entities pe
      WHERE pe.producer_id = weekly_catalogs.producer_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : weekly_catalog_products
-- ============================================================
CREATE POLICY wcp_admin_all ON public.weekly_catalog_products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : CRUD via son catalog
CREATE POLICY wcp_producer_own ON public.weekly_catalog_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_catalogs wc
      WHERE wc.id = weekly_catalog_products.weekly_catalog_id
        AND wc.producer_id = public.current_producer_id()
    )
  )
  WITH CHECK (true);

-- Client : SELECT si catalog accessible
CREATE POLICY wcp_client_select ON public.weekly_catalog_products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_catalogs wc
      JOIN public.producer_entities pe ON pe.producer_id = wc.producer_id
      WHERE wc.id = weekly_catalog_products.weekly_catalog_id
        AND wc.status IN ('open', 'closed', 'delivered')
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : subscriptions
-- ============================================================
CREATE POLICY subscriptions_admin_all ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir/gérer ses propres abonnements
CREATE POLICY subscriptions_client_own ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (true);

-- Producteur : voir les abonnements liés à lui
CREATE POLICY subscriptions_producer_select ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (producer_id = public.current_producer_id());

-- ============================================================
-- TABLE : orders
-- ============================================================
CREATE POLICY orders_admin_all ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir/créer ses propres commandes
CREATE POLICY orders_client_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY orders_client_insert ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Client : annuler sa commande (status → canceled uniquement)
CREATE POLICY orders_client_cancel ON public.orders
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (true);

-- Producteur : voir/mettre à jour les commandes de ses catalogues
CREATE POLICY orders_producer_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (producer_id = public.current_producer_id());

CREATE POLICY orders_producer_update ON public.orders
  FOR UPDATE
  TO authenticated
  USING (producer_id = public.current_producer_id())
  WITH CHECK (true);

-- ============================================================
-- TABLE : order_items
-- ============================================================
CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir les lignes de ses commandes
CREATE POLICY order_items_client_select ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.client_id = auth.uid()
    )
  );

-- Client : insérer les lignes de ses commandes
CREATE POLICY order_items_client_insert ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.client_id = auth.uid()
    )
  );

-- Producteur : voir les lignes des commandes de ses catalogues
CREATE POLICY order_items_producer_select ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : payments
-- ============================================================
CREATE POLICY payments_admin_all ON public.payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir le paiement de ses commandes
CREATE POLICY payments_client_select ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.client_id = auth.uid()
    )
  );

-- Producteur : voir les paiements de ses commandes
CREATE POLICY payments_producer_select ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : payment_reminders
-- ============================================================
CREATE POLICY payment_reminders_admin_all ON public.payment_reminders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir les relances qui le concernent
CREATE POLICY payment_reminders_client_select ON public.payment_reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.id = payment_reminders.payment_id
        AND o.client_id = auth.uid()
    )
  );

-- Producteur : voir les relances de ses paiements
CREATE POLICY payment_reminders_producer_select ON public.payment_reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.id = payment_reminders.payment_id
        AND o.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : invoices
-- ============================================================
CREATE POLICY invoices_admin_all ON public.invoices
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Client : voir ses factures
CREATE POLICY invoices_client_select ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = invoices.order_id
        AND o.client_id = auth.uid()
    )
  );

-- Producteur : voir les factures de ses commandes
CREATE POLICY invoices_producer_select ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = invoices.order_id
        AND o.producer_id = public.current_producer_id()
    )
  );

-- ============================================================
-- TABLE : deliveries
-- ============================================================
CREATE POLICY deliveries_admin_all ON public.deliveries
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : CRUD sur ses tournées
CREATE POLICY deliveries_producer_own ON public.deliveries
  FOR ALL
  TO authenticated
  USING (producer_id = public.current_producer_id())
  WITH CHECK (true);

-- Client : voir les tournées des producteurs qui servent son entité
CREATE POLICY deliveries_client_select ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_catalogs wc
      JOIN public.producer_entities pe ON pe.producer_id = wc.producer_id
      WHERE wc.id = deliveries.weekly_catalog_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : delivery_tracking_points
-- ============================================================
CREATE POLICY tracking_admin_all ON public.delivery_tracking_points
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Producteur : insérer/voir ses points GPS
CREATE POLICY tracking_producer_own ON public.delivery_tracking_points
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_tracking_points.delivery_id
        AND d.producer_id = public.current_producer_id()
    )
  )
  WITH CHECK (true);

-- Client : voir le tracking des tournées accessibles
CREATE POLICY tracking_client_select ON public.delivery_tracking_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.weekly_catalogs wc ON wc.id = d.weekly_catalog_id
      JOIN public.producer_entities pe ON pe.producer_id = wc.producer_id
      WHERE d.id = delivery_tracking_points.delivery_id
        AND pe.entity_id = public.current_client_entity_id()
        AND pe.is_active = true
    )
  );

-- ============================================================
-- TABLE : messages
-- ============================================================
CREATE POLICY messages_admin_all ON public.messages
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Utilisateur : voir les messages où il est expéditeur ou destinataire
CREATE POLICY messages_participant_select ON public.messages
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Utilisateur : envoyer un message
CREATE POLICY messages_participant_insert ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Utilisateur : marquer ses messages reçus comme lus (UPDATE read_at)
CREATE POLICY messages_recipient_update ON public.messages
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (true);

-- ============================================================
-- TABLE : notifications
-- ============================================================
CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

-- Utilisateur : voir ses propres notifications
CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- TABLE : notification_preferences
-- ============================================================
CREATE POLICY notif_prefs_admin_all ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (true);

CREATE POLICY notif_prefs_self_all ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (true);

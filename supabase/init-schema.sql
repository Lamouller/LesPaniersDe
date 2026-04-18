-- ============================================================
-- LesPaniersDe — Post-init Supabase passwords (DEV LOCAL ONLY)
-- Exécuté par migrate.sh en tant que supabase_admin.
-- Ces ALTER USER permettent les connexions scram-sha-256 depuis
-- le réseau Docker (PostgREST, GoTrue, Storage).
-- ============================================================
ALTER USER authenticator              WITH PASSWORD 'lespaniersde_dev_2026';
ALTER USER supabase_auth_admin        WITH PASSWORD 'lespaniersde_dev_2026';
ALTER USER supabase_storage_admin     WITH PASSWORD 'lespaniersde_dev_2026';
ALTER USER supabase_replication_admin WITH PASSWORD 'lespaniersde_dev_2026';

-- ============================================================
-- Migration 0001 : Schéma principal LesPaniersDe
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- Fonction utilitaire : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE : entities
-- Entreprises, open spaces, lieux de retrait
-- ============================================================
CREATE TABLE public.entities (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  slug                 text        UNIQUE NOT NULL,
  description          text,
  address              text        NOT NULL,
  pickup_address       text        NOT NULL,
  pickup_lat           double precision,
  pickup_lng           double precision,
  pickup_instructions  text,
  timezone             text        NOT NULL DEFAULT 'Europe/Paris',
  contact_email        text,
  contact_phone        text,
  logo_url             text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.entities IS 'Entreprises ou open spaces membres de la plateforme';
COMMENT ON COLUMN public.entities.pickup_address IS 'Précision lieu de retrait (ex: Salle café, 2e étage)';

-- ============================================================
-- TABLE : producers
-- Profil producteur (1 producer = 1 user avec rôle producer)
-- ============================================================
CREATE TABLE public.producers (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name                            text        NOT NULL,
  slug                            text        UNIQUE NOT NULL,
  bio                             text,
  photo_url                       text,
  contact_email                   text,
  contact_phone                   text,
  default_order_deadline_hours    int         NOT NULL DEFAULT 48,
  payment_reminder_days           int         NOT NULL DEFAULT 3,
  payment_block_days              int         NOT NULL DEFAULT 7,
  whatsapp_enabled                boolean     NOT NULL DEFAULT false,
  whatsapp_phone_id               text,
  whatsapp_access_token_encrypted text,
  default_pickup_entity_id        uuid        REFERENCES public.entities(id),
  is_active                       boolean     NOT NULL DEFAULT true,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER producers_updated_at
  BEFORE UPDATE ON public.producers
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.producers IS 'Profil étendu des utilisateurs de rôle producteur';
COMMENT ON COLUMN public.producers.payment_reminder_days IS 'Délai en jours avant envoi relance impayé';
COMMENT ON COLUMN public.producers.payment_block_days IS 'Délai en jours avant blocage commandes pour impayé';

-- ============================================================
-- TABLE : producer_entities
-- Jointure many-to-many producteurs <-> entités servies
-- ============================================================
CREATE TABLE public.producer_entities (
  producer_id         uuid        NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  entity_id           uuid        NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  delivery_day        int         CHECK (delivery_day BETWEEN 0 AND 6),
  time_from           time,
  time_to             time,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (producer_id, entity_id)
);

COMMENT ON TABLE public.producer_entities IS 'Producteurs desservant une entité (pickup only)';
COMMENT ON COLUMN public.producer_entities.delivery_day IS '0=dimanche, 6=samedi';

-- ============================================================
-- TABLE : profiles
-- Extension de auth.users pour tous les utilisateurs
-- ============================================================
CREATE TABLE public.profiles (
  id                      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                    text        NOT NULL DEFAULT 'client'
                            CHECK (role IN ('client', 'admin', 'producer')),
  full_name               text,
  display_name            text,
  phone                   text,
  entity_id               uuid        REFERENCES public.entities(id),
  avatar_url              text,
  language                text        NOT NULL DEFAULT 'fr'
                            CHECK (language IN ('fr', 'en')),
  dietary_preferences     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  notification_channels   jsonb       NOT NULL DEFAULT '{"email":true,"whatsapp":false,"push":false}'::jsonb,
  referral_code           text        UNIQUE,
  referred_by             uuid        REFERENCES public.profiles(id),
  ordering_blocked_until  timestamptz,
  rgpd_consent_at         timestamptz,
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- Un client doit toujours être rattaché à une entité
  CONSTRAINT client_must_have_entity CHECK (role != 'client' OR entity_id IS NOT NULL)
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.profiles IS 'Profil étendu pour tous les utilisateurs (client, admin, producer)';
COMMENT ON COLUMN public.profiles.ordering_blocked_until IS 'Blocage commandes pour impayé (null = non bloqué)';
COMMENT ON COLUMN public.profiles.dietary_preferences IS 'Allergies et préférences alimentaires (jsonb libre)';

-- ============================================================
-- TABLE : products
-- Catalogue produits d'un producteur
-- ============================================================
CREATE TABLE public.products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id       uuid        NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  kind              text        NOT NULL
                      CHECK (kind IN ('basket', 'fruit_option', 'egg_option', 'other')),
  size              text        CHECK (size IN ('S', 'M', 'L', 'XL')),
  name              text        NOT NULL,
  description       text,
  photo_url         text,
  unit_price_cents  int         NOT NULL CHECK (unit_price_cents >= 0),
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.products IS 'Catalogue des produits proposés par chaque producteur';
COMMENT ON COLUMN public.products.size IS 'Taille applicable uniquement aux paniers (kind=basket)';

-- ============================================================
-- TABLE : weekly_catalogs
-- Planning hebdomadaire par producteur
-- ============================================================
CREATE TABLE public.weekly_catalogs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id         uuid        NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  week_start          date        NOT NULL,
  order_deadline_at   timestamptz NOT NULL,
  delivery_date       date        NOT NULL,
  status              text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'open', 'closed', 'delivered', 'canceled')),
  max_orders          int,
  basket_composition  jsonb,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producer_id, week_start)
);

CREATE TRIGGER weekly_catalogs_updated_at
  BEFORE UPDATE ON public.weekly_catalogs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.weekly_catalogs IS 'Catalogue hebdomadaire : un par producteur par semaine';
COMMENT ON COLUMN public.weekly_catalogs.week_start IS 'Toujours un lundi (date de début de semaine)';
COMMENT ON COLUMN public.weekly_catalogs.basket_composition IS 'Liste légumes avec quantités [{name, qty, unit}]';

-- ============================================================
-- TABLE : weekly_catalog_products
-- Produits disponibles dans un catalogue hebdomadaire
-- ============================================================
CREATE TABLE public.weekly_catalog_products (
  weekly_catalog_id   uuid  NOT NULL REFERENCES public.weekly_catalogs(id) ON DELETE CASCADE,
  product_id          uuid  NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_snapshot_cents int  NOT NULL,
  stock               int,
  is_available        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (weekly_catalog_id, product_id)
);

COMMENT ON TABLE public.weekly_catalog_products IS 'Produits et prix snapshot pour un catalogue donné';

-- ============================================================
-- TABLE : subscriptions
-- Abonnements clients (abo récurrent)
-- ============================================================
CREATE TABLE public.subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid        NOT NULL REFERENCES public.profiles(id),
  producer_id   uuid        NOT NULL REFERENCES public.producers(id),
  frequency     text        NOT NULL
                  CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  items         jsonb       NOT NULL,
  status        text        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'canceled')),
  paused_until  timestamptz,
  canceled_at   timestamptz,
  started_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.subscriptions IS 'Abonnements récurrents clients auprès d''un producteur';
COMMENT ON COLUMN public.subscriptions.items IS 'Liste produits et quantités [{product_id, quantity}]';

-- ============================================================
-- TABLE : orders
-- Commandes clients
-- ============================================================
CREATE TABLE public.orders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text        UNIQUE NOT NULL,
  client_id           uuid        NOT NULL REFERENCES public.profiles(id),
  producer_id         uuid        NOT NULL REFERENCES public.producers(id),
  weekly_catalog_id   uuid        NOT NULL REFERENCES public.weekly_catalogs(id),
  subscription_id     uuid        REFERENCES public.subscriptions(id),
  entity_id           uuid        NOT NULL REFERENCES public.entities(id),
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'prepared', 'ready_for_pickup', 'picked_up', 'canceled')),
  total_cents         int         NOT NULL,
  notes               text,
  placed_at           timestamptz NOT NULL DEFAULT now(),
  picked_up_at        timestamptz,
  canceled_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX idx_orders_client_status    ON public.orders(client_id, status);
CREATE INDEX idx_orders_producer_status  ON public.orders(producer_id, status);
CREATE INDEX idx_orders_catalog          ON public.orders(weekly_catalog_id);
CREATE INDEX idx_orders_entity           ON public.orders(entity_id);

COMMENT ON TABLE public.orders IS 'Commandes passées par les clients';
COMMENT ON COLUMN public.orders.order_number IS 'Format LPD-YYYYMMDD-NNN, généré automatiquement';

-- ============================================================
-- TABLE : order_items
-- Lignes de commande
-- ============================================================
CREATE TABLE public.order_items (
  id                      uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid  NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id              uuid  REFERENCES public.products(id),
  product_name_snapshot   text  NOT NULL,
  unit_price_cents        int   NOT NULL,
  quantity                int   NOT NULL CHECK (quantity > 0),
  line_total_cents        int   NOT NULL
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

COMMENT ON TABLE public.order_items IS 'Lignes de commande avec snapshot du nom et prix au moment de l''achat';

-- ============================================================
-- TABLE : payments
-- Suivi des paiements (pas de paiement en ligne, juste statut)
-- ============================================================
CREATE TABLE public.payments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid        NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_cents    int         NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'overdue', 'refunded', 'canceled')),
  method              text        CHECK (method IN ('cash', 'card', 'transfer', 'check', 'other')),
  payment_reference   text,
  reconciled_at       timestamptz,
  reconciled_by   uuid        REFERENCES auth.users(id),
  notes           text,
  due_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX idx_payments_status_due ON public.payments(status, due_at);
CREATE INDEX idx_payments_order      ON public.payments(order_id);

COMMENT ON TABLE public.payments IS 'Suivi manuel des paiements pointés par l''admin';
COMMENT ON COLUMN public.payments.due_at IS 'Date limite calculée : picked_up_at + grace period producteur';

-- ============================================================
-- TABLE : payment_reminders
-- Historique des relances envoyées
-- ============================================================
CREATE TABLE public.payment_reminders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid        NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  channel         text        NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
  template        text,
  response_status text
);

CREATE INDEX idx_payment_reminders_payment ON public.payment_reminders(payment_id);

COMMENT ON TABLE public.payment_reminders IS 'Historique des relances impayés envoyées par canal';

-- ============================================================
-- TABLE : invoices
-- Facture générée à la confirmation de commande
-- ============================================================
CREATE TABLE public.invoices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid        NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number  text        UNIQUE NOT NULL,
  pdf_url         text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  amount_cents    int         NOT NULL,
  status          text        NOT NULL DEFAULT 'issued'
                    CHECK (status IN ('issued', 'paid', 'canceled'))
);

COMMENT ON TABLE public.invoices IS 'Facture associée à chaque commande confirmée (1 order = 1 invoice)';

-- ============================================================
-- TABLE : deliveries
-- Tournée d'un producteur pour un catalog donné
-- ============================================================
CREATE TABLE public.deliveries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_catalog_id   uuid        NOT NULL REFERENCES public.weekly_catalogs(id) ON DELETE CASCADE,
  producer_id         uuid        NOT NULL REFERENCES public.producers(id),
  status              text        NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
  started_at          timestamptz,
  completed_at        timestamptz,
  route_geojson       jsonb,
  entities_order      jsonb,
  tracking_token      text        UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE INDEX idx_deliveries_producer ON public.deliveries(producer_id);
CREATE INDEX idx_deliveries_catalog  ON public.deliveries(weekly_catalog_id);

COMMENT ON TABLE public.deliveries IS 'Tournée de livraison d''un producteur (1 par catalog)';
COMMENT ON COLUMN public.deliveries.tracking_token IS 'Token public partagé aux clients pour suivi live';

-- ============================================================
-- TABLE : delivery_tracking_points
-- Points GPS live pendant la tournée
-- ============================================================
CREATE TABLE public.delivery_tracking_points (
  id          bigserial   PRIMARY KEY,
  delivery_id uuid        NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_delivery_time ON public.delivery_tracking_points(delivery_id, recorded_at DESC);

COMMENT ON TABLE public.delivery_tracking_points IS 'Positions GPS enregistrées pendant la tournée';

-- ============================================================
-- TABLE : messages
-- Messagerie entre utilisateurs (contexte commande optionnel)
-- ============================================================
CREATE TABLE public.messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid        NOT NULL REFERENCES public.profiles(id),
  recipient_id  uuid        NOT NULL REFERENCES public.profiles(id),
  order_id      uuid        REFERENCES public.orders(id),
  content       text        NOT NULL,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_participants ON public.messages(sender_id, recipient_id, created_at);
CREATE INDEX idx_messages_order        ON public.messages(order_id);

COMMENT ON TABLE public.messages IS 'Messagerie interne entre clients et producteurs';

-- ============================================================
-- TABLE : notifications
-- Journal des envois de notifications
-- ============================================================
CREATE TABLE public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id),
  channel     text        NOT NULL,
  event_type  text        NOT NULL,
  payload     jsonb,
  status      text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user   ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

COMMENT ON TABLE public.notifications IS 'Journal de toutes les notifications envoyées ou à envoyer';

-- ============================================================
-- TABLE : notification_preferences
-- Préférences de canal par type d'événement
-- ============================================================
CREATE TABLE public.notification_preferences (
  user_id     uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  text  NOT NULL,
  channels    jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, event_type)
);

COMMENT ON TABLE public.notification_preferences IS 'Préférences de notification par event_type et par canal';

-- ============================================================
-- TABLE : audit_log
-- Journal RGPD de toutes les actions sensibles
-- ============================================================
CREATE TABLE public.audit_log (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id),
  action      text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  payload     jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user   ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

COMMENT ON TABLE public.audit_log IS 'Journal RGPD — accès réservé au service role';
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
-- ============================================================
-- Migration 0004 : Données de démonstration
-- ============================================================
-- Note : aucun compte utilisateur ici (créés via auth Supabase)
-- UUIDs fixes pour reproductibilité des seeds

-- ============================================================
-- Entité : Open Space Antislash
-- ============================================================
INSERT INTO public.entities (
  id,
  name,
  slug,
  description,
  address,
  pickup_address,
  pickup_lat,
  pickup_lng,
  pickup_instructions,
  timezone,
  contact_email,
  contact_phone,
  is_active,
  created_at,
  updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000001',
  'Open Space Antislash',
  'open-space-antislash',
  'Espace de coworking parisien, communauté tech & créatifs.',
  '12 Rue de la République, 75011 Paris',
  'Salle café, rez-de-chaussée — sonner à "Antislash"',
  48.8566,  -- latitude Paris fictive
  2.3522,   -- longitude Paris fictive
  'Récupérer votre panier le samedi entre 10h et 12h à l''accueil.',
  'Europe/Paris',
  'bonjour@antislash.studio',
  '+33 1 23 45 67 89',
  true,
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Producteur : Les Paniers de Nadine
-- (sans user_id car pas de compte auth dans le seed)
-- ============================================================
INSERT INTO public.producers (
  id,
  user_id,
  name,
  slug,
  bio,
  photo_url,
  contact_email,
  contact_phone,
  default_order_deadline_hours,
  payment_reminder_days,
  payment_block_days,
  whatsapp_enabled,
  default_pickup_entity_id,
  is_active,
  created_at,
  updated_at
) VALUES (
  '22222222-0000-0000-0000-000000000001',
  NULL,  -- compte auth créé séparément
  'Les Paniers de Nadine',
  'les-paniers-de-nadine',
  'Maraîchère en Île-de-France depuis 12 ans. Légumes de saison cultivés en agriculture raisonnée, récoltés le matin même de la livraison.',
  'https://placehold.co/400x400/4ade80/ffffff?text=Nadine',
  'nadine@lespaniersdenadine.fr',
  '+33 6 12 34 56 78',
  48,   -- deadline 48h avant livraison
  3,    -- relance à 3 jours
  7,    -- blocage à 7 jours
  false,
  '11111111-0000-0000-0000-000000000001',
  true,
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Lien producteur ↔ entité
-- Livraison le samedi (delivery_day=6), 10h-12h
-- ============================================================
INSERT INTO public.producer_entities (
  producer_id,
  entity_id,
  delivery_day,
  time_from,
  time_to,
  is_active,
  created_at
) VALUES (
  '22222222-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  6,         -- samedi
  '10:00',
  '12:00',
  true,
  timezone('UTC', now())
);

-- ============================================================
-- Produits : 5 références
-- ============================================================
-- Panier S — 15 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000001',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'S',
  'Panier S — Petit appétit',
  'Idéal pour 1 à 2 personnes. Environ 4-5 variétés de légumes de saison.',
  1500, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Panier M — 22 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'M',
  'Panier M — Famille standard',
  'Pour 2 à 3 personnes. Environ 6-7 variétés, toujours une surprise de saison.',
  2200, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Panier L — 30 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000003',
  '22222222-0000-0000-0000-000000000001',
  'basket', 'L',
  'Panier L — Grande famille',
  'Pour 4 à 5 personnes. Assortiment complet de la semaine.',
  3000, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Option fruits — 5 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000004',
  '22222222-0000-0000-0000-000000000001',
  'fruit_option', NULL,
  'Option fruits de saison',
  'Petit sachet de fruits de saison en provenance de producteurs partenaires.',
  500, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- Option 6 œufs — 3 €
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES (
  '33333333-0000-0000-0000-000000000005',
  '22222222-0000-0000-0000-000000000001',
  'egg_option', NULL,
  'Option 6 œufs fermiers',
  '6 œufs de poules élevées en plein air, non traités.',
  300, true,
  timezone('UTC', now()), timezone('UTC', now())
);

-- ============================================================
-- Catalogue hebdomadaire : semaine courante
-- week_start = prochain lundi, deadline jeudi 20h, livraison samedi
-- ============================================================
INSERT INTO public.weekly_catalogs (
  id,
  producer_id,
  week_start,
  order_deadline_at,
  delivery_date,
  status,
  max_orders,
  basket_composition,
  notes,
  created_at,
  updated_at
) VALUES (
  '44444444-0000-0000-0000-000000000001',
  '22222222-0000-0000-0000-000000000001',
  -- Prochain lundi (date_trunc + 7 jours si on est déjà après lundi)
  date_trunc('week', timezone('UTC', now())::date + 7)::date,
  -- Deadline : jeudi 20h de la même semaine
  date_trunc('week', timezone('UTC', now())::date + 7)::date + interval '3 days 20 hours',
  -- Livraison : samedi de la même semaine
  date_trunc('week', timezone('UTC', now())::date + 7)::date + 5,
  'open',
  40,  -- max 40 commandes
  -- Composition du panier de la semaine
  '[
    {"name": "Courgettes",       "qty": 3,   "unit": "pièces"},
    {"name": "Tomates cerises",  "qty": 250, "unit": "g"},
    {"name": "Carottes",         "qty": 4,   "unit": "pièces"},
    {"name": "Salade batavia",   "qty": 1,   "unit": "pièce"},
    {"name": "Haricots verts",   "qty": 300, "unit": "g"},
    {"name": "Betteraves rouges","qty": 2,   "unit": "pièces"}
  ]'::jsonb,
  'Superbe semaine pour les légumes d''été ! Profitez des tomates cerises qui sont au top.',
  timezone('UTC', now()),
  timezone('UTC', now())
);

-- ============================================================
-- Produits disponibles dans ce catalogue
-- ============================================================
INSERT INTO public.weekly_catalog_products (weekly_catalog_id, product_id, price_snapshot_cents, stock, is_available)
VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 1500, 15, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 2200, 20, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003', 3000,  5, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004',  500, 30, true),
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000005',  300, 50, true);

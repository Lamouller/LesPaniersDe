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

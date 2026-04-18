#!/usr/bin/env bash
# =============================================================================
# seed-test-accounts.sh
# Seed complet de comptes de test pour LesPaniersDe (dev uniquement)
# Idempotent : si un compte existe déjà, il est skippe
# Usage : ./scripts/seed-test-accounts.sh
# =============================================================================
set -euo pipefail

SUPABASE_URL="http://localhost:8200"
# La SERVICE_KEY sert de clé Kong (key-auth) — identique à kong.yml
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"
# JWT_SECRET dev (doit correspondre à GOTRUE_JWT_SECRET dans docker-compose)
JWT_SECRET="your-super-secret-jwt-token-with-at-least-32-characters-long"
DATABASE_URL="postgresql://postgres:lespaniersde_dev_2026@localhost:5441/postgres"

# Génère un Bearer JWT signé localement avec le bon secret
# (le SERVICE_KEY ci-dessus n'est pas signé avec ce secret — Kong utilise key-auth)
BEARER_JWT=$(python3 - <<'PYEOF'
import hmac, hashlib, base64, json, sys, os

secret = os.environ.get("JWT_SECRET_ARG", "your-super-secret-jwt-token-with-at-least-32-characters-long")

def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header  = b64url(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(',',':')))
payload = b64url(json.dumps({"role":"service_role","iss":"supabase-demo","iat":1641769200,"exp":1799535600}, separators=(',',':')))
msg     = f"{header}.{payload}"
sig     = b64url(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
print(f"{msg}.{sig}")
PYEOF
)

# Couleurs terminal
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*" >&2; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*" >&2; }
log_warn()    { echo -e "${YELLOW}[SKIP]${NC}  $*" >&2; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Vérifie les dépendances
for cmd in curl jq psql; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Commande manquante : $cmd. Installe-la avant de relancer."
    exit 1
  fi
done

# =============================================================================
# Fonction : créer un user via GoTrue admin API
# Retourne l'UUID (nouveau ou existant)
# =============================================================================
create_or_get_user() {
  local email="$1"
  local password="$2"

  # Vérifie si le user existe déjà (liste tous les users et filtre)
  local existing
  existing=$(curl -s \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $BEARER_JWT" \
    "$SUPABASE_URL/auth/v1/admin/users" \
    | jq -r --arg em "$email" '.users[] | select(.email == $em) | .id' 2>/dev/null | head -1)

  if [[ -n "$existing" ]]; then
    log_warn "User $email existe déjà (id=$existing)"
    echo "$existing"
    return 0
  fi

  # Crée le user
  local response
  response=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $BEARER_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"email_confirm\":true}")

  local uid
  uid=$(echo "$response" | jq -r '.id // empty')

  if [[ -z "$uid" ]]; then
    log_error "Echec création $email : $(echo "$response" | jq -r '.message // .error // "réponse inconnue"')"
    exit 1
  fi

  log_ok "User créé : $email (id=$uid)"
  echo "$uid"
}

# =============================================================================
# 1. Création des 9 comptes auth
# =============================================================================
echo ""
echo "==========================================="
echo "  LesPaniersDe — Seed comptes de test"
echo "==========================================="
echo ""
log_info "Étape 1/3 : Création des comptes auth..."

UID_ADMIN=$(create_or_get_user "admin@lespaniersde.local"      "DemoAdmin2026!")
UID_SUPERADMIN=$(create_or_get_user "superadmin@lespaniersde.local" "DemoSuper2026!")
UID_NADINE=$(create_or_get_user "nadine@lespaniersde.local"    "DemoNadine2026!")
UID_MARC=$(create_or_get_user "marc@lespaniersde.local"        "DemoMarc2026!")
UID_ALICE=$(create_or_get_user "alice@antislash.local"         "DemoAlice2026!")
UID_BOB=$(create_or_get_user "bob@antislash.local"             "DemoBob2026!")
UID_CLARA=$(create_or_get_user "clara@antislash.local"         "DemoClara2026!")
UID_DAVID=$(create_or_get_user "david@coworking.local"         "DemoDavid2026!")
UID_EMMA=$(create_or_get_user "emma@coworking.local"           "DemoEmma2026!")

log_ok "9 comptes auth prêts."

# =============================================================================
# 2. Injection des données via psql
# =============================================================================
log_info "Étape 2/3 : Injection des données en base..."

psql "$DATABASE_URL" <<SQL
BEGIN;

-- ===========================================================================
-- ENTITÉ : Coworking Étoile
-- ===========================================================================
INSERT INTO public.entities (
  id, name, slug, description, address, pickup_address,
  pickup_lat, pickup_lng, pickup_instructions,
  timezone, contact_email, is_active, created_at, updated_at
) VALUES (
  '11111111-0000-0000-0000-000000000002',
  'Coworking Étoile',
  'coworking-etoile',
  'Espace de coworking moderne au coeur du 17e arrondissement.',
  '12 Avenue de la Grande Armée, 75017 Paris',
  'Accueil RDC',
  48.8738,
  2.2950,
  'Récupérez votre panier à l''accueil du rez-de-chaussée.',
  'Europe/Paris',
  'contact@coworking-etoile.fr',
  true,
  now(), now()
) ON CONFLICT (slug) DO NOTHING;

-- ===========================================================================
-- PRODUCTEUR : Le Verger de Marc
-- ===========================================================================
INSERT INTO public.producers (
  id, user_id, name, slug, bio, contact_email,
  default_order_deadline_hours,
  payment_reminder_days, payment_block_days,
  whatsapp_enabled, default_pickup_entity_id,
  is_active, created_at, updated_at
) VALUES (
  '22222222-0000-0000-0000-000000000002',
  '$UID_MARC',
  'Le Verger de Marc',
  'le-verger-de-marc',
  'Producteur de fruits et miel en Île-de-France. Verger familial de 3 hectares à Milly-la-Forêt.',
  'marc@levergerdemac.fr',
  48,
  3, 7,
  false,
  '11111111-0000-0000-0000-000000000001',
  true,
  now(), now()
) ON CONFLICT (slug) DO NOTHING;

-- Met à jour user_id de Nadine
UPDATE public.producers
   SET user_id = '$UID_NADINE'
 WHERE id = '22222222-0000-0000-0000-000000000001'
   AND user_id IS NULL;

-- ===========================================================================
-- PRODUCER_ENTITIES
-- Nadine × Antislash (existe déjà via 0004_seed.sql)
-- Nadine × Coworking Étoile (samedi 10h-12h)
-- Marc × Antislash (mercredi 14h-16h)
-- Marc × Coworking Étoile (mercredi 14h-16h)
-- ===========================================================================
INSERT INTO public.producer_entities (producer_id, entity_id, delivery_day, time_from, time_to, is_active, created_at)
VALUES
  -- Nadine × Coworking Étoile — samedi
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 6, '10:00', '12:00', true, now()),
  -- Marc × Antislash — mercredi
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 3, '14:00', '16:00', true, now()),
  -- Marc × Coworking Étoile — mercredi
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 3, '14:00', '16:00', true, now())
ON CONFLICT (producer_id, entity_id) DO NOTHING;

-- ===========================================================================
-- PRODUITS : Le Verger de Marc
-- ===========================================================================
INSERT INTO public.products (id, producer_id, kind, size, name, description, unit_price_cents, is_active, created_at, updated_at)
VALUES
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002', 'basket', 'S',   'Panier fruits S — 500g',       'Assortiment 500g de fruits de saison variés.',            800,  true, now(), now()),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000002', 'basket', 'L',   'Panier fruits L — 1kg',        '1kg de fruits de saison, idéal pour une famille.',        1500, true, now(), now()),
  ('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000002', 'other',  NULL,  'Pot de miel 500g',             'Miel toutes fleurs d''Île-de-France, récolte locale.',    900,  true, now(), now()),
  ('33333333-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000002', 'other',  NULL,  'Confiture artisanale',         'Confiture maison fabriquée avec les fruits du verger.',   500,  true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- CATALOGUE HEBDO : Le Verger de Marc — semaine courante
-- week_start = lundi prochain, deadline = mardi 20h, delivery = mercredi
-- ===========================================================================
INSERT INTO public.weekly_catalogs (
  id, producer_id, week_start, order_deadline_at, delivery_date,
  status, max_orders, basket_composition, notes, created_at, updated_at
) VALUES (
  '44444444-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000002',
  -- Lundi de la semaine courante (date_trunc renvoie lundi en ISO)
  date_trunc('week', current_date)::date,
  -- Deadline : mardi 20h
  date_trunc('week', current_date)::date + interval '1 day 20 hours',
  -- Livraison : mercredi
  date_trunc('week', current_date)::date + 2,
  'open',
  30,
  '[{"name":"Pommes","qty":4,"unit":"pièces"},{"name":"Poires","qty":3,"unit":"pièces"},{"name":"Prunes","qty":200,"unit":"g"}]'::jsonb,
  'Belle saison pour les fruits ! Profitez des prunes d''été.',
  now(), now()
) ON CONFLICT (producer_id, week_start) DO NOTHING;

-- Produits dans le catalogue Marc
INSERT INTO public.weekly_catalog_products (weekly_catalog_id, product_id, price_snapshot_cents, stock, is_available)
VALUES
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000006',  800, 20, true),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000007', 1500, 15, true),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000008',  900, 10, true),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000009',  500, 25, true)
ON CONFLICT (weekly_catalog_id, product_id) DO NOTHING;

-- ===========================================================================
-- PROFILES
-- Pas de trigger on_auth_user_created -> INSERT manuel
-- ON CONFLICT DO UPDATE pour idempotence
-- ===========================================================================

-- Admins (pas d'entity_id — constraint ne s'applique qu'aux clients)
INSERT INTO public.profiles (id, role, full_name, display_name, rgpd_consent_at, created_at, updated_at)
VALUES
  ('$UID_ADMIN',      'admin', 'Admin Principal',  'Admin',   now(), now(), now()),
  ('$UID_SUPERADMIN', 'admin', 'Super Admin',       'Superadmin', now(), now(), now())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = now();

-- Producteurs (pas d'entity_id)
INSERT INTO public.profiles (id, role, full_name, display_name, rgpd_consent_at, created_at, updated_at)
VALUES
  ('$UID_NADINE', 'producer', 'Nadine Lefebvre', 'Nadine',  now(), now(), now()),
  ('$UID_MARC',   'producer', 'Marc Dupont',      'Marc',    now(), now(), now())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = now();

-- Clients Antislash (entity_id = Open Space Antislash)
INSERT INTO public.profiles (
  id, role, full_name, display_name,
  entity_id, dietary_preferences, notification_channels,
  rgpd_consent_at, created_at, updated_at
) VALUES
  -- Alice : cliente régulière, préférences alimentaires
  (
    '$UID_ALICE', 'client', 'Alice Martin', 'Alice',
    '11111111-0000-0000-0000-000000000001',
    '{"no":["poireaux","betteraves"]}'::jsonb,
    '{"email":true,"whatsapp":false,"push":false}'::jsonb,
    now(), now(), now()
  ),
  -- Bob : impayé, ordering bloqué
  (
    '$UID_BOB', 'client', 'Bob Leclerc', 'Bob',
    '11111111-0000-0000-0000-000000000001',
    '{}'::jsonb,
    '{"email":true,"whatsapp":true,"push":false}'::jsonb,
    now(), now(), now()
  ),
  -- Clara : cliente récente
  (
    '$UID_CLARA', 'client', 'Clara Petit', 'Clara',
    '11111111-0000-0000-0000-000000000001',
    '{}'::jsonb,
    '{"email":true,"whatsapp":false,"push":false}'::jsonb,
    now(), now(), now()
  )
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  entity_id = EXCLUDED.entity_id,
  dietary_preferences = EXCLUDED.dietary_preferences,
  notification_channels = EXCLUDED.notification_channels,
  updated_at = now();

-- Clients Coworking Étoile (entity_id = Coworking Étoile)
INSERT INTO public.profiles (
  id, role, full_name, display_name,
  entity_id, rgpd_consent_at, created_at, updated_at
) VALUES
  ('$UID_DAVID', 'client', 'David Bernard', 'David', '11111111-0000-0000-0000-000000000002', now(), now(), now()),
  ('$UID_EMMA',  'client', 'Emma Rousseau', 'Emma',  '11111111-0000-0000-0000-000000000002', now(), now(), now())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  entity_id = EXCLUDED.entity_id,
  updated_at = now();

-- ===========================================================================
-- COMMANDES + ITEMS + PAIEMENTS + FACTURES
-- On travaille avec des UUIDs fixes pour idempotence
-- Les triggers fn_after_order_pickup et fn_create_invoice_on_confirmed
-- ne s'activent que sur UPDATE, donc on gère manuellement les due_at
-- et les invoices ici pour les commandes insérées directement en 'picked_up'
-- ou 'confirmed'.
-- ===========================================================================

-- -------------------------------------------------------------------
-- ORDER 1 : Alice × Nadine — semaine dernière, picked_up + paid (cash)
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, picked_up_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'LPD-SEED-001',
  '$UID_ALICE',
  '22222222-0000-0000-0000-000000000001',
  '44444444-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'picked_up',
  2200,
  now() - interval '10 days',
  now() - interval '9 days',
  now() - interval '10 days',
  now() - interval '9 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002', 'Panier M — Famille standard', 2200, 1, 2200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, method, reconciled_at, due_at, created_at, updated_at)
VALUES (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  2200, 'paid', 'cash',
  now() - interval '8 days',
  now() - interval '6 days',
  now() - interval '10 days', now() - interval '8 days'
) ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'INV-SEED-0001', 2200, 'paid', now() - interval '10 days')
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------
-- ORDER 2 : Alice × Nadine — semaine en cours, confirmed + pending
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'LPD-SEED-002',
  '$UID_ALICE',
  '22222222-0000-0000-0000-000000000001',
  '44444444-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'confirmed',
  3500,
  now() - interval '2 days',
  now() - interval '2 days',
  now() - interval '2 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES
  ('bbbbbbbb-0002-0001-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'Panier M — Famille standard', 2200, 1, 2200),
  ('bbbbbbbb-0002-0002-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000005', 'Option 6 oeufs fermiers',      300,  1,  300),
  ('bbbbbbbb-0002-0003-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'Option fruits de saison',      500,  1,  500),
  ('bbbbbbbb-0002-0004-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004', 'Option fruits de saison x2',   500,  1,  500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, due_at, created_at, updated_at)
VALUES ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 3500, 'pending', NULL, now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'INV-SEED-0002', 3500, 'issued', now() - interval '2 days')
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------
-- ORDER 3 : Bob × Nadine — picked_up, overdue #1
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, picked_up_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'LPD-SEED-003',
  '$UID_BOB',
  '22222222-0000-0000-0000-000000000001',
  '44444444-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'picked_up',
  1500,
  now() - interval '20 days',
  now() - interval '18 days',
  now() - interval '20 days',
  now() - interval '18 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'Panier S — Petit appétit', 1500, 1, 1500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, due_at, created_at, updated_at)
VALUES (
  'cccccccc-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000003',
  1500, 'overdue',
  now() - interval '15 days',
  now() - interval '20 days', now()
) ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'INV-SEED-0003', 1500, 'issued', now() - interval '20 days')
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------
-- ORDER 4 : Bob × Nadine — picked_up, overdue #2
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, picked_up_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000004',
  'LPD-SEED-004',
  '$UID_BOB',
  '22222222-0000-0000-0000-000000000001',
  '44444444-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'picked_up',
  2200,
  now() - interval '30 days',
  now() - interval '28 days',
  now() - interval '30 days',
  now() - interval '28 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000002', 'Panier M — Famille standard', 2200, 1, 2200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, due_at, created_at, updated_at)
VALUES (
  'cccccccc-0000-0000-0000-000000000004',
  'aaaaaaaa-0000-0000-0000-000000000004',
  2200, 'overdue',
  now() - interval '25 days',
  now() - interval '30 days', now()
) ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'INV-SEED-0004', 2200, 'issued', now() - interval '30 days')
ON CONFLICT (order_id) DO NOTHING;

-- Blocage Bob pour impayés
UPDATE public.profiles
   SET ordering_blocked_until = now() + interval '7 days',
       updated_at = now()
 WHERE id = '$UID_BOB';

-- -------------------------------------------------------------------
-- ORDER 5 : Clara × Marc — pending, fruits en cours
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000005',
  'LPD-SEED-005',
  '$UID_CLARA',
  '22222222-0000-0000-0000-000000000002',
  '44444444-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  'pending',
  2400,
  now() - interval '1 day',
  now() - interval '1 day',
  now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES
  ('bbbbbbbb-0005-0001-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000007', 'Panier fruits L - 1kg',  1500, 1, 1500),
  ('bbbbbbbb-0005-0002-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000008', 'Pot de miel 500g',        900, 1,  900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, due_at, created_at, updated_at)
VALUES ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005', 2400, 'pending', NULL, now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------
-- ORDER 6 : David × Nadine — confirmed, première commande
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000006',
  'LPD-SEED-006',
  '$UID_DAVID',
  '22222222-0000-0000-0000-000000000001',
  '44444444-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  'confirmed',
  1500,
  now() - interval '1 day',
  now() - interval '1 day',
  now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000001', 'Panier S — Petit appétit', 1500, 1, 1500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, due_at, created_at, updated_at)
VALUES ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006', 1500, 'pending', NULL, now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006', 'INV-SEED-0006', 1500, 'issued', now() - interval '1 day')
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------
-- ORDER 7 : Emma × Marc — picked_up, paid (transfer)
-- -------------------------------------------------------------------
INSERT INTO public.orders (
  id, order_number, client_id, producer_id, weekly_catalog_id, entity_id,
  status, total_cents, placed_at, picked_up_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000007',
  'LPD-SEED-007',
  '$UID_EMMA',
  '22222222-0000-0000-0000-000000000002',
  '44444444-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000002',
  'picked_up',
  2400,
  now() - interval '8 days',
  now() - interval '7 days',
  now() - interval '8 days',
  now() - interval '7 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (id, order_id, product_id, product_name_snapshot, unit_price_cents, quantity, line_total_cents)
VALUES
  ('bbbbbbbb-0007-0001-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000007', 'Panier fruits L - 1kg',  1500, 1, 1500),
  ('bbbbbbbb-0007-0002-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000008', 'Pot de miel 500g',        900, 1,  900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (id, order_id, amount_cents, status, method, reconciled_at, due_at, created_at, updated_at)
VALUES (
  'cccccccc-0000-0000-0000-000000000007',
  'aaaaaaaa-0000-0000-0000-000000000007',
  2400, 'paid', 'transfer',
  now() - interval '5 days',
  now() - interval '4 days',
  now() - interval '8 days', now() - interval '5 days'
) ON CONFLICT (order_id) DO NOTHING;

INSERT INTO public.invoices (id, order_id, invoice_number, amount_cents, status, issued_at)
VALUES ('dddddddd-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000007', 'INV-SEED-0007', 2400, 'paid', now() - interval '8 days')
ON CONFLICT (order_id) DO NOTHING;

-- ===========================================================================
-- ABONNEMENT : Emma × Marc — weekly, Panier L + Miel
-- ===========================================================================
INSERT INTO public.subscriptions (
  id, client_id, producer_id, frequency, items, status, started_at, created_at, updated_at
) VALUES (
  'eeeeeeee-0000-0000-0000-000000000001',
  '$UID_EMMA',
  '22222222-0000-0000-0000-000000000002',
  'weekly',
  '[{"product_id":"33333333-0000-0000-0000-000000000007","quantity":1},{"product_id":"33333333-0000-0000-0000-000000000008","quantity":1}]'::jsonb,
  'active',
  now() - interval '30 days',
  now() - interval '30 days',
  now() - interval '30 days'
) ON CONFLICT (id) DO NOTHING;

-- Lier la commande 7 d'Emma à son abonnement
UPDATE public.orders
   SET subscription_id = 'eeeeeeee-0000-0000-0000-000000000001'
 WHERE id = 'aaaaaaaa-0000-0000-0000-000000000007'
   AND subscription_id IS NULL;

-- ===========================================================================
-- MESSAGES (2-3 échanges)
-- ===========================================================================
INSERT INTO public.messages (id, sender_id, recipient_id, order_id, content, created_at)
VALUES
  -- Alice demande une substitution à Nadine
  (
    'ffffffff-0000-0000-0000-000000000001',
    '$UID_ALICE',
    '$UID_NADINE',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Bonjour Nadine, pourriez-vous remplacer les betteraves par des courgettes si possible cette semaine ? Merci beaucoup !',
    now() - interval '1 day 3 hours'
  ),
  -- Nadine répond
  (
    'ffffffff-0000-0000-0000-000000000002',
    '$UID_NADINE',
    '$UID_ALICE',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Bonjour Alice, bien sûr ! J''ai noté la substitution pour votre panier. À samedi !',
    now() - interval '1 day 1 hour'
  ),
  -- Clara pose une question à Marc sur une commande
  (
    'ffffffff-0000-0000-0000-000000000003',
    '$UID_CLARA',
    '$UID_MARC',
    'aaaaaaaa-0000-0000-0000-000000000005',
    'Bonjour Marc, est-ce que le miel est disponible en version crémeux ? Super de vous avoir découvert !',
    now() - interval '4 hours'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
SQL

# =============================================================================
# 3. Vérification finale
# =============================================================================
log_info "Étape 3/3 : Vérification en base..."

echo ""
echo "--- Profils par rôle ---"
psql "$DATABASE_URL" -c "SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;"

echo "--- Commandes ---"
psql "$DATABASE_URL" -c "SELECT count(*) AS total_orders FROM public.orders;"

echo "--- Paiements par statut ---"
psql "$DATABASE_URL" -c "SELECT status, count(*) FROM public.payments GROUP BY status ORDER BY status;"

echo "--- Clients bloqués ---"
psql "$DATABASE_URL" -c "
  SELECT u.email, p.ordering_blocked_until
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.ordering_blocked_until IS NOT NULL
  ORDER BY u.email;"

echo ""
echo "==========================================="
echo "  Seed terminé avec succès !"
echo "==========================================="
echo ""
echo "  Comptes disponibles sur http://localhost:3200"
echo ""
printf "  %-35s %-22s %-10s\n" "Email" "Mot de passe" "Rôle"
printf "  %-35s %-22s %-10s\n" "-----------------------------------" "----------------------" "----------"
printf "  %-35s %-22s %-10s\n" "admin@lespaniersde.local"      "DemoAdmin2026!"   "admin"
printf "  %-35s %-22s %-10s\n" "superadmin@lespaniersde.local" "DemoSuper2026!"   "admin"
printf "  %-35s %-22s %-10s\n" "nadine@lespaniersde.local"     "DemoNadine2026!"  "producer"
printf "  %-35s %-22s %-10s\n" "marc@lespaniersde.local"       "DemoMarc2026!"    "producer"
printf "  %-35s %-22s %-10s\n" "alice@antislash.local"         "DemoAlice2026!"   "client"
printf "  %-35s %-22s %-10s\n" "bob@antislash.local"           "DemoBob2026!"     "client (bloqué)"
printf "  %-35s %-22s %-10s\n" "clara@antislash.local"         "DemoClara2026!"   "client"
printf "  %-35s %-22s %-10s\n" "david@coworking.local"         "DemoDavid2026!"   "client"
printf "  %-35s %-22s %-10s\n" "emma@coworking.local"          "DemoEmma2026!"    "client"
echo ""

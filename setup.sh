#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LesPaniersDe — Script de démarrage one-click
# Usage : chmod +x setup.sh && ./setup.sh
# Idempotent : peut être relancé plusieurs fois sans effet de bord
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ─── Couleurs pour les messages ───────────────────────────────
VERT='\033[0;32m'
JAUNE='\033[1;33m'
ROUGE='\033[0;31m'
BLEU='\033[0;34m'
RESET='\033[0m'
GRAS='\033[1m'

info()    { echo -e "${BLEU}[INFO]${RESET} $*"; }
succes()  { echo -e "${VERT}[OK]${RESET}   $*"; }
avert()   { echo -e "${JAUNE}[AVERT]${RESET} $*"; }
erreur()  { echo -e "${ROUGE}[ERREUR]${RESET} $*" >&2; }

echo ""
echo -e "${GRAS}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GRAS}   LesPaniersDe — Installation automatique      ${RESET}"
echo -e "${GRAS}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Vérification des prérequis ───────────────────────────────
info "Vérification des prérequis..."

# Docker
if ! command -v docker &>/dev/null; then
  erreur "Docker n'est pas installé."
  erreur "Installez Docker Desktop : https://docs.docker.com/get-docker/"
  exit 1
fi
DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
DOCKER_MAJOR=$(echo "$DOCKER_VERSION" | cut -d. -f1)
if [ "$DOCKER_MAJOR" -lt 24 ]; then
  erreur "Docker $DOCKER_VERSION détecté — version 24+ requise."
  exit 1
fi
succes "Docker $DOCKER_VERSION"

# Docker Compose v2
if ! docker compose version &>/dev/null 2>&1; then
  erreur "Docker Compose v2 n'est pas disponible."
  erreur "Mettez à jour Docker Desktop ou installez le plugin : https://docs.docker.com/compose/install/"
  exit 1
fi
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "inconnue")
succes "Docker Compose $COMPOSE_VERSION"

# Node.js (optionnel en prod, requis pour le dev local)
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | grep -oP '\d+' | head -1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    avert "Node.js v$NODE_VERSION détecté — version 20+ recommandée pour le développement."
  else
    succes "Node.js v$NODE_VERSION"
  fi
else
  avert "Node.js non trouvé — requis uniquement pour le développement local (pas pour la prod Docker)."
fi

echo ""

# ─── Fichier .env ─────────────────────────────────────────────
if [ ! -f ".env" ]; then
  info "Fichier .env absent — copie depuis .env.example..."
  cp .env.example .env
  echo ""
  avert "Le fichier .env a été créé avec des valeurs d'exemple."
  avert "Editez .env et renseignez vos vraies valeurs avant de continuer."
  avert "Puis relancez : ./setup.sh"
  echo ""
  exit 0
fi
succes "Fichier .env trouvé"

# ─── Chargement des variables d'environnement ─────────────────
# shellcheck disable=SC1091
set -a; source .env; set +a

# Vérification des variables critiques
VARS_REQUISES=(
  "POSTGRES_PASSWORD"
  "JWT_SECRET"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)
MANQUANTES=()
for VAR in "${VARS_REQUISES[@]}"; do
  VAL="${!VAR:-}"
  if [ -z "$VAL" ] || [[ "$VAL" == votre-* ]] || [[ "$VAL" == *placeholder* ]]; then
    MANQUANTES+=("$VAR")
  fi
done

if [ ${#MANQUANTES[@]} -gt 0 ]; then
  erreur "Variables d'environnement non configurées dans .env :"
  for VAR in "${MANQUANTES[@]}"; do
    erreur "  - $VAR"
  done
  erreur "Editez .env et relancez ./setup.sh"
  exit 1
fi

echo ""

# ─── Pull des images Docker ───────────────────────────────────
info "Téléchargement des images Docker (peut prendre quelques minutes)..."
docker compose pull --quiet 2>/dev/null || true
succes "Images à jour"

echo ""

# ─── Démarrage des services ───────────────────────────────────
info "Démarrage de la stack..."
docker compose up -d --build

succes "Stack démarrée"
echo ""

# ─── Attente que PostgreSQL soit prêt ─────────────────────────
info "Attente que PostgreSQL soit prêt..."
TENTATIVES=0
MAX_TENTATIVES=30

until docker compose exec -T db pg_isready -U postgres -q 2>/dev/null; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -ge $MAX_TENTATIVES ]; then
    erreur "PostgreSQL n'est pas prêt après ${MAX_TENTATIVES} tentatives."
    erreur "Vérifiez les logs : docker compose logs db"
    exit 1
  fi
  echo -n "."
  sleep 2
done
echo ""
succes "PostgreSQL prêt"

echo ""

# ─── Attente que Kong (API Supabase) soit prêt ────────────────
info "Attente que l'API Supabase (Kong) soit prête..."
TENTATIVES=0

until curl -sf "http://localhost:8000/health" -o /dev/null 2>/dev/null; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -ge $MAX_TENTATIVES ]; then
    avert "Kong n'est pas encore prêt — les migrations peuvent prendre du retard."
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

# ─── Application des migrations ───────────────────────────────
info "Application des migrations SQL..."

# Méthode : psql directement dans le container PostgreSQL
MIGRATION_DIR="./supabase/migrations"

if [ -d "$MIGRATION_DIR" ] && [ -n "$(ls -A "$MIGRATION_DIR" 2>/dev/null)" ]; then
  for MIGRATION in "$MIGRATION_DIR"/*.sql; do
    [ -f "$MIGRATION" ] || continue
    NOM=$(basename "$MIGRATION")
    info "  Migration : $NOM"
    docker compose exec -T db psql -U postgres -d postgres -f "/docker-entrypoint-initdb.d/$NOM" 2>/dev/null \
      || avert "  Déjà appliquée ou ignorée : $NOM"
  done
  succes "Migrations appliquées"
else
  avert "Aucune migration trouvée dans $MIGRATION_DIR — base vide."
fi

echo ""

# ─── Seed de démonstration ────────────────────────────────────
info "Chargement des données de démonstration..."

SEED_SQL=$(cat <<'EOF'
-- Entité de démonstration (open space)
INSERT INTO entities (id, name, address, pickup_point_description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Open Space La Fabrique',
  '12 rue des Artisans, 75011 Paris',
  'Réception du rez-de-chaussée, lundi de 12h à 14h'
) ON CONFLICT (id) DO NOTHING;

-- Producteur de démonstration
INSERT INTO producers (id, name, farm_name, description, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Nadine Dupont',
  'Ferme des Quatre Saisons',
  'Maraîchère bio en Île-de-France, 8 ans d expérience en vente directe.',
  '+33600000000',
  'nadine@exemple.fr'
) ON CONFLICT (id) DO NOTHING;

-- Produits de démonstration (3 tailles de panier)
INSERT INTO products (id, producer_id, name, description, unit, price_cents)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002',
   'Panier Solo', 'Légumes de saison pour 1-2 personnes (~3 kg)', 'panier', 1200),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002',
   'Panier Famille', 'Légumes de saison pour 3-4 personnes (~6 kg)', 'panier', 2000),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002',
   'Panier Jumbo', 'Légumes de saison pour 5+ personnes (~10 kg)', 'panier', 2800)
ON CONFLICT (id) DO NOTHING;
EOF
)

docker compose exec -T db psql -U postgres -d postgres -c "$SEED_SQL" 2>/dev/null \
  && succes "Données de démonstration chargées" \
  || avert "Seed ignoré (tables absentes ou données existantes) — relancez après les migrations."

echo ""

# ─── Affichage des URLs et informations ───────────────────────
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:8000}"

echo -e "${GRAS}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GRAS}   Installation terminée avec succes !          ${RESET}"
echo -e "${GRAS}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Application      : ${VERT}${APP_URL}${RESET}"
echo -e "  API Supabase     : ${VERT}${SUPABASE_URL}${RESET}"
echo -e "  Studio Supabase  : ${VERT}http://localhost:3001${RESET}"
echo ""
echo -e "  ${GRAS}Compte démo producteur${RESET}"
echo -e "  Nom : Nadine Dupont (Ferme des Quatre Saisons)"
echo ""
echo -e "  ${GRAS}Commandes utiles${RESET}"
echo -e "  Logs     : docker compose logs -f app"
echo -e "  Arrêter  : docker compose down"
echo -e "  Rebuild  : docker compose up -d --build app"
echo ""
echo -e "  ${JAUNE}Pour la production, configurez votre domaine dans .env (DOMAIN=votre-domaine.fr)${RESET}"
echo ""

exit 0

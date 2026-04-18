# Guide développeur — LesPaniersDe

Ce guide est destiné aux développeurs qui souhaitent contribuer au code de LesPaniersDe.

---

## Setup local (step-by-step)

### Prérequis

- Docker Desktop 24+ avec Docker Compose v2
- Node.js 20+ (`node --version` pour vérifier)
- Git
- Un éditeur avec support TypeScript (VS Code recommandé)

### 1. Cloner et configurer l'environnement

```bash
git clone https://github.com/Lamouller/LesPaniersDe.git
cd LesPaniersDe

# Copier l'exemple d'env
cp .env.example .env

# Pour le développement local, les valeurs par défaut suffisent
# Vous pouvez laisser WhatsApp/SMTP vides (fonctions désactivées en dev)
```

### 2. Démarrer la stack de développement

```bash
# Stack complète avec hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Ou via le script setup (mode prod simulé)
./setup.sh
```

### 3. Installer les dépendances Node.js (pour l'IDE)

```bash
cd apps/web
npm install
```

### 4. Ouvrir l'application

- Application : http://localhost:3000
- Supabase Studio : http://localhost:3001
- API Supabase (Kong) : http://localhost:8000
- PostgREST direct : http://localhost:3000

### 5. Appliquer les migrations manuellement

```bash
# Lancer les migrations SQL
docker compose exec db psql -U postgres -d postgres \
  -f /docker-entrypoint-initdb.d/001_schema.sql
```

---

## Arborescence du projet

```
LesPaniersDe/
├── apps/
│   └── web/                    # Application Next.js 15
│       ├── app/                # App Router Next.js
│       │   ├── (auth)/         # Pages d'authentification
│       │   ├── (consumer)/     # Interface consommateur
│       │   │   ├── shop/       # Catalogue
│       │   │   └── account/    # Mon compte
│       │   ├── admin/          # Interface admin
│       │   └── producer/       # Interface producteur
│       ├── components/         # Composants React partagés
│       │   ├── ui/             # Composants shadcn/ui
│       │   └── shared/         # Composants métier partagés
│       ├── lib/                # Utilitaires et clients
│       │   ├── supabase/       # Client Supabase (server + client)
│       │   ├── whatsapp.ts     # Client Meta Cloud API
│       │   ├── smtp.ts         # Client email (nodemailer)
│       │   └── osrm.ts         # Client OSRM
│       ├── hooks/              # React hooks personnalisés
│       ├── types/              # Types TypeScript globaux
│       ├── public/             # Assets statiques
│       └── Dockerfile          # Build production multi-étape
├── supabase/
│   ├── migrations/             # Migrations SQL (ordre alphabétique)
│   │   ├── 001_schema.sql      # Tables et contraintes
│   │   ├── 002_rls.sql         # Politiques RLS
│   │   └── 003_seed_demo.sql   # Données de démo
│   └── kong.yml                # Configuration Kong (API Gateway)
├── docs/                       # Documentation
├── .github/
│   ├── workflows/              # GitHub Actions CI/CD
│   └── ISSUE_TEMPLATE/         # Templates issues
├── docker-compose.yml          # Stack production
├── docker-compose.dev.yml      # Overrides développement
├── Caddyfile                   # Config reverse proxy
├── setup.sh                    # Installation one-click
└── .env.example                # Variables d'environnement
```

---

## Conventions de code

### TypeScript

- TypeScript strict activé (`strict: true` dans tsconfig)
- Pas de `any` explicite — utiliser `unknown` et affiner avec des guards
- Types dans `types/` pour les modèles partagés
- Interfaces préférées aux types pour les objets

```typescript
// Bon
interface Order {
  id: string;
  consumerId: string;
  status: 'pending' | 'confirmed' | 'picked_up' | 'cancelled';
  totalCents: number;
}

// A éviter
type Order = any;
```

### Composants React

- Un composant par fichier
- Nommage PascalCase pour les composants
- Props typées avec une interface dédiée
- `'use client'` uniquement si nécessaire (préférer les Server Components)

```typescript
// Bon — Server Component par défaut
interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // ...
}
```

### Conventions de nommage

| Elément | Convention | Exemple |
|---|---|---|
| Composants | PascalCase | `WeeklyCatalog.tsx` |
| Hooks | camelCase avec `use` | `useOrderStatus.ts` |
| Utilitaires | camelCase | `formatCents.ts` |
| Types | PascalCase | `OrderStatus` |
| Variables | camelCase | `weekStart` |
| Constantes | UPPER_SNAKE_CASE | `MAX_QUANTITY` |
| Routes API | kebab-case | `/api/weekly-catalog` |

### Base de données

- Nommage snake_case pour les colonnes (convention PostgreSQL)
- Toujours vérifier les colonnes existantes avant d'écrire une requête
- Utiliser UPSERT quand une ligne peut ne pas exister (évite les erreurs silencieuses)
- Toujours inclure `WITH CHECK (true)` sur les policies RLS d'écriture

```sql
-- Bon
INSERT INTO payments (invoice_id, amount_cents, method, pointed_by)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- A éviter
INSERT INTO payments (...) VALUES (...);
-- (échoue silencieusement en RLS si la ligne existe)
```

### Commits

Format strict : `emoji type: description courte en français`

| Emoji | Type | Quand |
|---|---|---|
| ✨ | feat | Nouvelle fonctionnalité |
| 🐛 | fix | Correction de bug |
| ♻️ | refactor | Refactoring sans changement fonctionnel |
| 🎨 | style | CSS/UI uniquement |
| 📝 | docs | Documentation |
| 🧪 | test | Ajout ou modification de tests |
| 🔧 | chore | Config, maintenance |
| 🔒 | security | Correctif sécurité |
| ⚡ | perf | Optimisation performance |

```bash
git commit -m "✨ feat: ajout filtre par allergie dans le catalogue"
git commit -m "🐛 fix: correction du calcul du total TTC sur les commandes mixtes"
git commit -m "📝 docs: mise à jour guide déploiement pour Ubuntu 24"
```

---

## Design system — Liquid Glass

LesPaniersDe utilise un design system **Liquid Glass noir/blanc** avec Tailwind CSS et shadcn/ui.

### Palette principale

| Token | Classe Tailwind | Usage |
|---|---|---|
| Fond principal | `bg-black` | Fond de page |
| Surface verre | `bg-white/5` + `backdrop-blur-md` | Cards, panels |
| Texte principal | `text-white` | Titres et labels |
| Texte secondaire | `text-white/60` | Descriptions, métadonnées |
| Bordure | `border-white/10` | Séparateurs |
| Accent/action | `bg-white text-black` | Boutons primaires |

### Composants

**Card glassmorphism :**
```tsx
<div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
  {/* contenu */}
</div>
```

**Bouton primaire :**
```tsx
<button type="button" className="rounded-xl bg-white text-black font-medium px-4 py-2 hover:bg-white/90 transition-colors">
  Commander
</button>
```

**Bouton secondaire :**
```tsx
<button type="button" className="rounded-xl border border-white/20 text-white px-4 py-2 hover:bg-white/5 transition-colors">
  Annuler
</button>
```

**Important :** tout `<button>` doit avoir `type="button"` sauf s'il est explicitement un submit de formulaire.

### shadcn/ui

Les composants shadcn/ui sont configurés avec le thème sombre par défaut. Utiliser les composants existants avant d'en créer de nouveaux :

```bash
# Ajouter un composant shadcn
cd apps/web
npx shadcn-ui@latest add dialog
```

---

## Tests

### Lancer les tests

```bash
cd apps/web

# Typecheck complet
npm run typecheck

# Lint
npm run lint

# Tests unitaires (à venir)
npm test

# Build de production (détecte les erreurs de build)
npm run build
```

### Stratégie de test

- **Tests unitaires** : fonctions utilitaires (calcul prix, formatage, validation)
- **Tests d'intégration** : routes API avec base de données de test
- **Tests E2E** (Phase 2) : parcours critiques avec Playwright

---

## Debug

### Logs des services

```bash
# Logs de l'application Next.js
docker compose logs -f app

# Logs PostgreSQL
docker compose logs -f db

# Logs Kong (API Gateway)
docker compose logs -f kong

# Logs de tous les services
docker compose logs -f
```

### Connexion directe à la base de données

```bash
# PostgreSQL interactif
docker compose exec db psql -U postgres -d postgres

# Requête rapide
docker compose exec db psql -U postgres -d postgres -c "SELECT * FROM entities;"
```

### Inspecter l'état Supabase

Ouvrir http://localhost:3001 pour accéder à Supabase Studio : tables, données, RLS, logs, etc.

### Variables d'environnement manquantes

```bash
# Vérifier que toutes les variables sont chargées
docker compose exec app env | grep -E "(SUPABASE|NEXT_PUBLIC|JWT)"
```

---

## Ouvrir une Pull Request

1. Forker le dépôt et créer une branche : `git checkout -b feat/ma-feature`
2. Développer et tester localement
3. S'assurer que lint et typecheck passent : `npm run lint && npm run typecheck`
4. Commit avec le bon format de message
5. Pousser et ouvrir une PR sur GitHub
6. Remplir le template de PR (checklist incluse)
7. Attendre la review — au moins un mainteneur doit approuver

Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour les détails complets du processus de contribution.

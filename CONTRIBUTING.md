# Guide de contribution — LesPaniersDe

Merci de contribuer ! Ce guide explique comment démarrer, les conventions à respecter et comment soumettre une Pull Request.

---

## Table des matières

1. [Code de conduite](#code-de-conduite)
2. [Setup local](#setup-local)
3. [Structure du projet](#structure-du-projet)
4. [Conventions de commit](#conventions-de-commit)
5. [Workflow de contribution](#workflow-de-contribution)
6. [Tests](#tests)
7. [Pull Request template](#pull-request-checklist)

---

## Code de conduite

Ce projet suit le [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). En contribuant, vous acceptez de respecter ces règles.

---

## Setup local

### Prérequis

- **Node.js 20+** — `node --version`
- **pnpm 9+** — `npm install -g pnpm`
- **Docker 24+** avec Compose v2 — `docker compose version`
- **Supabase CLI** — `npm install -g supabase`
- **Git** — `git --version`

### Installation

```bash
# 1. Fork le repo sur GitHub, puis :
git clone https://github.com/VOTRE_USERNAME/LesPaniersDe.git
cd LesPaniersDe

# 2. Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs locales (voir commentaires dans .env.example)

# 3. Démarrer les services Docker (Supabase + OSRM)
docker compose -f docker-compose.dev.yml up -d

# 4. Appliquer les migrations Supabase
supabase db reset  # ou supabase migration up

# 5. Installer les dépendances Next.js
cd apps/web
npm install

# 6. Démarrer le dev server
npm run dev
# → http://localhost:3000
```

### Variables d'environnement clés

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase locale (default: http://localhost:54321) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (jamais exposée côté client) |

Voir [`.env.example`](.env.example) pour la liste complète.

---

## Structure du projet

```
LesPaniersDe/
├── apps/
│   └── web/                    # Application Next.js 15
│       ├── app/
│       │   ├── (auth)/         # Login, Register (layout séparé)
│       │   ├── (client)/       # /shop, /account (layout client)
│       │   ├── (admin)/        # /admin/* (layout admin)
│       │   ├── (producer)/     # /producer/* (layout producteur)
│       │   └── api/            # Route handlers (server-side)
│       ├── components/
│       │   ├── ui/             # Composants shadcn/ui (design Liquid Glass)
│       │   └── layout/         # Nav, Footer, Sidebars
│       └── lib/
│           ├── supabase/       # Clients server + client + middleware
│           ├── notifications/  # WhatsApp, Email, WebPush
│           └── i18n/           # next-intl config + messages FR/EN
├── supabase/
│   └── migrations/             # SQL migrations (schéma, RLS, fonctions, seed)
├── docs/                       # Documentation technique
├── .github/
│   ├── workflows/              # CI/CD GitHub Actions
│   └── ISSUE_TEMPLATE/
└── docker-compose.yml          # Stack production
```

---

## Conventions de commit

Format : `emoji type: description en français (ou EN pour patches internationaux)`

| Emoji | Type | Usage |
|---|---|---|
| ✨ | feat | Nouvelle fonctionnalité |
| 🐛 | fix | Correction de bug |
| 🔧 | chore | Maintenance, config, dépendances |
| ♻️ | refactor | Refactoring sans changement fonctionnel |
| 🎨 | style | UI/CSS/design uniquement |
| 🧪 | test | Ajout ou modification de tests |
| 📝 | docs | Documentation uniquement |
| 🚀 | deploy | Configuration de déploiement |
| 🔒 | security | Correctif sécurité |
| ⚡ | perf | Optimisation de performance |
| 🌐 | i18n | Traductions, internationalisation |

### Exemples

```bash
git commit -m "✨ feat: ajout filtre par allergie dans le catalogue hebdo"
git commit -m "🐛 fix: correction calcul total panier avec options fruits"
git commit -m "🔒 security: renforcement RLS policy sur table orders"
git commit -m "🌐 i18n: traduction EN du flow checkout"
```

### Règles

- Description concise, verbe à l'infinitif ou impératif
- Corps du commit si besoin d'explication (laisser une ligne vide après le sujet)
- Référencer l'issue si applicable : `closes #42`

---

## Workflow de contribution

### 1. Créer une branche

```bash
git checkout -b feat/nom-de-la-feature
# ou
git checkout -b fix/description-du-bug
```

Convention de nommage : `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`

### 2. Développer

- **Lire le design system** avant toute modification UI (`docs/CONTRIBUTING_DEV.md`)
- **Jamais de secrets** dans le code (utiliser `.env.example` avec placeholders)
- **Boutons** : toujours `type="button"` sauf submit intentionnel
- **RLS** : toujours `WITH CHECK (true)` sur les policies d'écriture
- **TypeScript strict** : pas de `any`, pas de `@ts-ignore` sans justification

### 3. Vérifier avant de pousser

```bash
# Dans apps/web/
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run build        # Build de production (doit passer sans erreur)
```

### 4. Pousser et ouvrir une PR

```bash
git push origin feat/nom-de-la-feature
```

Puis ouvrir une Pull Request sur GitHub. Le template de PR vous guidera.

---

## Tests

> Phase 1 : les tests sont en placeholder. Phase 2 introduira Vitest + Playwright.

```bash
cd apps/web
npm run test        # Vitest (à venir)
npm run test:e2e    # Playwright (à venir)
```

En attendant, **tester manuellement** les 3 flows critiques :
1. Inscription + connexion
2. Commande d'un panier
3. Rapprochement bancaire admin

---

## Pull Request Checklist

Avant de soumettre une PR, vérifiez :

- [ ] `npm run lint` passe sans erreur
- [ ] `npm run typecheck` passe sans erreur
- [ ] `npm run build` passe sans erreur
- [ ] Pas de secrets ni credentials dans le code
- [ ] Migrations SQL incluses si changement de schéma
- [ ] Traductions FR **et** EN mises à jour si texte UI modifié
- [ ] RLS policies mises à jour si nouvelle table
- [ ] Description claire de ce que fait la PR et pourquoi

---

## Questions ?

- Ouvrir une [Discussion GitHub](https://github.com/Lamouller/LesPaniersDe/discussions)
- Consulter la [documentation](docs/)

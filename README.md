# LesPaniersDe 🥕

> Plateforme open source participative pour la mise en relation entre producteurs locaux et communautés de consommateurs.

**Aucune marge. Aucun paiement interne.** La plateforme sert uniquement de gestion et de rapprochement. Le paiement se fait en direct (cash, CB, virement, chèque).

---

## Aperçu

### Page d'accueil
![Landing](docs/screenshots/01-landing.png)

<details>
<summary>Version light</summary>

![Landing — light](docs/screenshots/01-landing-light.png)
</details>

### Espace client
| Catalogue hebdo | Tableau de bord | Stats & badges |
|---|---|---|
| ![Shop](docs/screenshots/10-shop.png) | ![Account](docs/screenshots/12-account.png) | ![Stats](docs/screenshots/13-account-stats.png) |

![Communauté — leaderboard + challenge collectif](docs/screenshots/14-account-community.png)

### Espace admin
| Dashboard | Rapprochement bancaire | Prévisionnel |
|---|---|---|
| ![Admin dashboard](docs/screenshots/20-admin-dashboard.png) | ![Admin sales](docs/screenshots/21-admin-sales.png) | ![Admin forecast](docs/screenshots/22-admin-forecast.png) |

### Espace producteur
| Dashboard | Prévisionnel CA | Catalogue hebdo |
|---|---|---|
| ![Producer dashboard](docs/screenshots/30-producer-dashboard.png) | ![Producer forecast](docs/screenshots/31-producer-forecast.png) | ![Producer catalog](docs/screenshots/32-producer-catalog.png) |

### Optimisation de tournée (OSRM + OpenStreetMap)
Tournée hebdo auto-optimisée sur 6 arrêts Occitanie : **Toulouse · Labège (IoT Valley) · Blagnac · Castres · Albi · Montauban**.

![Tournée producteur optimisée OSRM](docs/screenshots/33-producer-route-osrm.png)

### Mobile (iPhone 13)
| Landing | Shop | Stats & badges |
|---|---|---|
| ![Mobile landing](docs/screenshots/mobile-01-landing.png) | ![Mobile shop](docs/screenshots/mobile-10-shop.png) | ![Mobile stats](docs/screenshots/mobile-13-stats.png) |

| Admin | Forecast producteur | Produits producteur |
|---|---|---|
| ![Mobile admin](docs/screenshots/mobile-20-admin.png) | ![Mobile forecast](docs/screenshots/mobile-31-forecast.png) | ![Mobile products](docs/screenshots/mobile-33-products.png) |

---

## Fonctionnalités

- **Catalogue hebdo** — composition variable selon saison, capacité configurable, liste d'attente
- **Abonnement ou achat unique** — hebdo, bi-hebdo ou mensuel, pausable
- **Un point de retrait par entité** — chaque client rattaché à son entité (open space, entreprise, lieu de coworking)
- **Rapprochement bancaire manuel** — cash / CB / virement / chèque, sans aucune commission
- **GPS live pendant la livraison** — "le producteur est à 10 min"
- **Notifications multicanal** — Email, WhatsApp (Meta Cloud API), Web Push
- **Messagerie client ↔ producteur**
- **Factures PDF** — une par livraison, avec relances automatiques par email et blocage en cas d'impayé après pointage
- **Multi-producteur** — extensible dès le départ
- **Relances et blocage impayés auto** — email J+3, blocage J+7, déblocage après pointage
- **Pointage manuel des paiements (cash/CB/virement) par l'admin** — sans aucune commission ni paiement interne
- **RGPD** — export données + suppression compte
- **PWA** — installable sur mobile
- **Multi-langue** — FR 🇫🇷 / EN 🇬🇧
- **Préférences & allergies** — "pas de poireaux cette semaine"
- **Parrainage** — codes de referral

---

## Stack technique

| Brique | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Composants | shadcn/ui + design Liquid Glass |
| PWA | next-pwa + Web Push (VAPID) |
| i18n | next-intl (FR/EN) |
| Base de données | Supabase self-hosted (PostgreSQL + Auth + Realtime + Storage) |
| Routing tournée | OSRM + OpenStreetMap (Docker) |
| Notifications | WhatsApp Meta Cloud API · Email SMTP · Web Push |
| Infra | Docker Compose one-click + Caddy (auto-SSL) |
| CI/CD | GitHub Actions + GHCR |

---

## Démarrage rapide (one-click)

```bash
# 1. Cloner le repo
git clone https://github.com/Lamouller/LesPaniersDe.git
cd LesPaniersDe

# 2. Lancer le setup automatique
chmod +x setup.sh && ./setup.sh

# 3. Ouvrir http://localhost:3000
```

Le script `setup.sh` :
- Vérifie Docker et Node.js
- Copie `.env.example` → `.env`
- Initialise Supabase en local
- Lance tous les containers
- Charge les données de démo (producteur "Nadine", 3 tailles de panier...)

### Prérequis

- Docker 24+ et Docker Compose v2
- Node.js 20+ (pour le dev local)
- 4 Go de RAM minimum

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — schéma des 3 rôles, flux d'une commande
- [Déploiement](docs/DEPLOYMENT.md) — self-host VPS step-by-step
- [Modèle de données](docs/DATA_MODEL.md) — tables, relations, RLS
- [Roadmap](docs/ROADMAP.md) — Phase 1/2/3
- [WhatsApp Setup](docs/WHATSAPP_SETUP.md) — configuration Meta Cloud API
- [Guide développeur](docs/CONTRIBUTING_DEV.md) — setup local, conventions

---

## 3 interfaces par rôle

### Consommateur (`/shop`, `/account`)
Catalogue hebdo, panier, abonnement, suivi livraison GPS live, messagerie, factures PDF, préférences allergies, pause/vacances.

### Admin agrégateur (`/admin/`)
Ventes, rapprochement bancaire multi-modes, gestion users/producteurs/points de retrait, statistiques.

### Producteur (`/producer`)
Catalogue hebdo (composition saisonnière), capacité max, optimisation tournée OSRM, GPS broadcast live, messagerie, bons de tournée et étiquettes imprimables.

---

## Contribuer

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le guide complet.

```bash
# Fork + clone + branche
git checkout -b feat/ma-feature

# Commits format : emoji type: description
# ✨ feat · 🐛 fix · ♻️ refactor · 🎨 style · 📝 docs

git commit -m "✨ feat: ajout filtre par allergie dans le catalogue"
git push origin feat/ma-feature
# → Ouvrir une Pull Request
```

---

## Licence

[AGPL-3.0](LICENSE) — Libre d'utilisation, modification et distribution. Toute version modifiée déployée en réseau doit être publiée en open source sous la même licence.

---

## Quick Start (English)

```bash
git clone https://github.com/Lamouller/LesPaniersDe.git
cd LesPaniersDe && chmod +x setup.sh && ./setup.sh
# Open http://localhost:3000
```

LesPaniersDe is an open-source platform connecting local producers (e.g. a market gardener delivering weekly vegetable baskets to a co-working space) with community consumers. No margin, no internal payment processing — the platform handles scheduling and reconciliation only. AGPL-3.0 licensed.

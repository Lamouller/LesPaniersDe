# Roadmap — LesPaniersDe

---

## Phase 1 — Fondations (en cours)

Objectif : poser l'infrastructure solide et le modèle de données complet avant de coder les features.

### Infrastructure
- [x] Dépôt GitHub public sous licence AGPL-3.0
- [x] README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- [x] Stack Docker Compose complète (Next.js + Supabase + OSRM + Caddy)
- [x] Script `setup.sh` one-click idempotent
- [x] CI/CD GitHub Actions (lint + typecheck + build sur PR)
- [x] Publication GHCR sur tag `v*`
- [x] Dependabot npm + Docker
- [ ] Configuration Supabase Kong (kong.yml complet)
- [ ] Migrations SQL initiales (toutes les tables + RLS)
- [ ] Seed de démonstration complet

### Documentation
- [x] Architecture (schémas ASCII 3 rôles, flux commande, notifs, OSRM)
- [x] Modèle de données (toutes les tables)
- [x] Guide déploiement VPS
- [x] WhatsApp Setup
- [x] Roadmap
- [ ] Guide développeur complet (CONTRIBUTING_DEV.md)

---

## Phase 2 — Features core

Objectif : plateforme fonctionnelle de bout en bout pour un producteur et une entité.

### Authentification et profils
- [ ] Inscription / connexion via Supabase Auth (email + magic link)
- [ ] Création de profil avec choix de rôle
- [ ] Association consommateur → entité
- [ ] Page "Mon compte" (allergies, préférences, pausez l'abonnement)

### Catalogue hebdomadaire
- [ ] Interface producteur : composition du catalogue semaine par semaine
- [ ] Définition des capacités max par produit
- [ ] Affichage consommateur : catalogue de la semaine avec quantités restantes
- [ ] Liste d'attente si complet

### Commandes
- [ ] Panier et passage de commande (consommateur)
- [ ] Confirmation email automatique
- [ ] Vue admin : liste des commandes par semaine et par entité
- [ ] Blocage commande si profil `is_blocked = true`

### Paiements et facturation
- [ ] Génération automatique de facture PDF après livraison
- [ ] Envoi facture par email (PDF en pièce jointe)
- [ ] Interface admin : pointage manuel du paiement (cash / CB / virement)
- [ ] Tableau de bord rapprochement bancaire

### Relances et blocage impayés
- [ ] Cron job quotidien : détection factures en retard
- [ ] Email de relance J+`PAYMENT_REMINDER_DAYS`
- [ ] Blocage commandes à J+`PAYMENT_BLOCK_DAYS` + email de notification
- [ ] Déblocage automatique après pointage du paiement
- [ ] Historique des relances dans l'interface admin

### Abonnements
- [ ] Abonnement hebdo / bi-hebdo / mensuel
- [ ] Pause temporaire (dates de vacances)
- [ ] Génération automatique des commandes récurrentes

---

## Phase 3 — GPS live, WhatsApp, impression

Objectif : enrichir l'expérience pendant la livraison et optimiser les tournées.

### GPS et tournées
- [ ] Interface producteur : optimisation tournée via OSRM (algorithme TSP)
- [ ] Affichage de l'ordre optimal sur carte
- [ ] Bon de tournée imprimable (PDF)
- [ ] Étiquettes paniers imprimables
- [ ] GPS broadcast live pendant la tournée (Supabase Realtime)
- [ ] Vue consommateur : "Producteur à 10 min" avec carte
- [ ] Fallback Google Maps si OSRM indisponible

### Notifications WhatsApp
- [ ] Intégration Meta Cloud API complète
- [ ] Templates approuvés : confirmation, livraison proche, facture, relance
- [ ] Préférences utilisateur (activer/désactiver par canal et par type)
- [ ] Webhook de statut de livraison

### Web Push
- [ ] Génération clés VAPID
- [ ] Subscription côté client
- [ ] Notifications push : livraison proche, nouveau message, facture

### Messagerie
- [ ] Chat client ↔ producteur
- [ ] Notifications push et email sur nouveau message
- [ ] Historique par commande

### Statistiques
- [ ] Tableau de bord producteur : volumes, CA, top produits
- [ ] Tableau de bord admin : taux de paiement, retards, entités actives

---

## Phase 4 — PWA, i18n, mobile

Objectif : rendre la plateforme accessible sur tous les supports et à l'international.

### PWA
- [ ] next-pwa : installation sur écran d'accueil (iOS et Android)
- [ ] Cache offline du catalogue (service worker)
- [ ] Web Push notifications natives sur mobile

### Internationalisation
- [ ] next-intl : FR / EN complet
- [ ] Détection automatique de la langue navigateur
- [ ] Interface de traduction pour les admins (contenus produits)

### Mobile natif (exploration)
- [ ] Évaluation Capacitor.js (wrapper PWA → app native)
- [ ] ou React Native si l'usage GPS live le justifie

### RGPD
- [ ] Export données consommateur (JSON/CSV)
- [ ] Suppression de compte et anonymisation
- [ ] Consentement cookies et tracking

### Parrainage
- [ ] Codes de referral consommateur
- [ ] Tableau de suivi parrain/filleul

---

## Contribuer à la roadmap

Les priorités sont discutées dans les issues GitHub. Si vous souhaitez proposer ou prioriser une feature :

1. Ouvrir une issue avec le template "Feature Request"
2. Décrire l'usage métier et l'impact
3. La communauté vote et les mainteneurs décident de l'inclusion en roadmap

Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour le guide complet.

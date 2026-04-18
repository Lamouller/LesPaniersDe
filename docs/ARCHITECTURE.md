# Architecture — LesPaniersDe

## Vue d'ensemble

LesPaniersDe est organisée autour de **3 rôles** avec des interfaces dédiées, tous reliés à une base de données Supabase commune avec isolation par Row Level Security (RLS).

---

## Schéma des 3 rôles

```
┌──────────────────────────────────────────────────────────────────┐
│                        LesPaniersDe                              │
├──────────────┬─────────────────────┬────────────────────────────-┤
│  CONSOMMATEUR│       ADMIN          │       PRODUCTEUR            │
│  /shop       │       /admin/        │       /producer             │
│  /account    │                      │                             │
├──────────────┼──────────────────────┼─────────────────────────────┤
│ • Catalogue  │ • Tableau de bord    │ • Catalogue hebdo           │
│   hebdo      │   ventes             │   (composition saisonnière) │
│ • Panier     │ • Rapprochement      │ • Capacité max / semaine    │
│ • Abonnement │   bancaire           │ • Optimisation tournée OSRM │
│   (pause,    │   (cash/CB/virement) │ • GPS broadcast live        │
│    vacances) │ • Gestion users      │ • Messagerie client         │
│ • Suivi GPS  │ • Gestion entités    │ • Bon de tournée imprimable │
│   live       │ • Relances impayés   │ • Etiquettes paniers        │
│ • Messagerie │ • Blocage commandes  │ • Stats livraisons          │
│ • Factures   │ • Stats globales     │                             │
│   PDF        │ • Notifs WhatsApp    │                             │
│ • Préférences│ • Audit log          │                             │
│   allergies  │                      │                             │
└──────────────┴──────────────────────┴─────────────────────────────┘

Toutes les interfaces partagent :
  • Supabase Auth (JWT)
  • PostgreSQL (RLS par rôle)
  • Realtime (WebSockets pour GPS et messagerie)
  • Storage (photos produits, factures PDF)
```

---

## Flux d'une commande

```
CONSOMMATEUR                    ADMIN                    PRODUCTEUR
     │                            │                           │
     │  1. Consulte le            │                           │
     │     catalogue hebdo        │                           │
     │     (weekly_catalogs)      │  0. Crée le catalogue     │
     │◄───────────────────────────│────────────────────────── │
     │                            │                           │
     │  2. Passe commande         │                           │
     │     (orders + order_items) │                           │
     │─────────────────────────── │──────────────────────────►│
     │                            │                           │
     │  3. Reçoit confirmation    │                           │
     │     email + WhatsApp       │                           │
     │◄───────────────────────────│                           │
     │                            │                           │
     │        ┌───────────────────┤ 4. Prépare les paniers   │
     │        │   Jour de         │    (bon de tournée)       │
     │        │   livraison       │                           │
     │        │                   │                           │
     │  5. Suivi GPS live         │ 5. Démarre la tournée     │
     │     "Producteur à 10 min"  │    GPS broadcast ON       │
     │◄───────────────────────────│────────────────────────── │
     │                            │                           │
     │  6. Pickup au point        │                           │
     │     de retrait de son      │                           │
     │     entité                 │                           │
     │                            │                           │
     │        ┌───────────────────┤ 7. Marque livraison       │
     │        │   Post-livraison  │    effectuée              │
     │        │                   │    (deliveries)           │
     │        │                   │                           │
     │  8. Reçoit facture PDF     │ 8. Génère facture PDF     │
     │     par email              │    (invoices)             │
     │◄───────────────────────────│                           │
     │                            │                           │
     │  9. Paye (cash/CB/         │                           │
     │     virement direct)       │                           │
     │                            │                           │
     │       ┌────────────────────┤ 9. Pointe le paiement    │
     │       │   Paiement         │    (payments)             │
     │       │   reçu             │                           │
     │       │                    │                           │
     │       │              ──────┤ ← Paiement reçu :        │
     │       │                    │   statut invoice = PAID   │
     │       │                    │                           │
     │       │                ────┤ ← Paiement NON reçu      │
     │       │   Après J+3        │   après J+3 :             │
     │       │                    │   1er email de relance    │
     │◄──────│────────────────────│   (payment_reminders)     │
     │       │                    │                           │
     │       │   Après J+7        │                           │
     │       │                    │   2e relance + BLOCAGE    │
     │       │                    │   prochaine commande      │
     │       │   Après déblocage  │                           │
     │       │                    │   Pointage admin →        │
     │       │                    │   déblocage automatique   │
     │       │                    │                           │
     └────── ┘                    └───────────────────────────┘
```

---

## Schéma des notifications

```
EVENEMENT                   CANAL                   DESTINATAIRE
   │                           │                         │
   │  Nouvelle commande ──────►│── Email ───────────────►│ Consommateur
   │                           │── WhatsApp ────────────►│ Consommateur
   │                           │── Email ───────────────►│ Admin
   │                           │
   │  Livraison proche ───────►│── Web Push ────────────►│ Consommateur
   │  (GPS < 2 km)             │── WhatsApp ────────────►│ Consommateur
   │                           │
   │  Facture émise ──────────►│── Email (PDF joint) ───►│ Consommateur
   │                           │
   │  Relance impayé J+3 ─────►│── Email ───────────────►│ Consommateur
   │                           │
   │  Relance impayé J+7 ─────►│── Email + WhatsApp ────►│ Consommateur
   │  (+ blocage commandes)    │
   │                           │
   │  Nouveau message ────────►│── Web Push ────────────►│ Destinataire
   │                           │── Email (digest) ──────►│ Destinataire
   │                           │
   │  Confirmation paiement ──►│── Email ───────────────►│ Consommateur

Filtrage par préférences (notification_preferences) :
  Chaque utilisateur choisit les canaux actifs par type d'événement.
  WhatsApp = one-way uniquement (Meta Cloud API, pas de réception).
```

---

## Intégration OSRM (routing tournée)

```
PRODUCTEUR                  OSRM (Docker)              FRONTEND
     │                           │                         │
     │  1. Liste des adresses    │                         │
     │     de livraison du jour  │                         │
     │─────────────────────────►│                         │
     │                           │                         │
     │  2. Requête d'optimisation│                         │
     │     /trip (TSP)           │                         │
     │─────────────────────────►│                         │
     │                           │                         │
     │  3. Ordre optimisé +      │                         │
     │     temps estimés         │                         │
     │◄─────────────────────────│                         │
     │                           │                         │
     │  4. Affichage carte +     │                         │
     │     bon de tournée        │────────────────────────►│
     │                           │                         │
     │  5. Pendant la tournée :  │                         │
     │     GPS broadcast         │                         │
     │     (Supabase Realtime)   │────────────────────────►│ Consommateur
     │                           │                         │ "Producteur à 10 min"
     │                           │                         │
     │  Fallback si OSRM absent :│                         │
     │  Google Maps Directions   │                         │
     │  (GOOGLE_MAPS_API_KEY)    │                         │
```

---

## Intégration WhatsApp (Meta Cloud API)

```
BACKEND Next.js              Meta Cloud API           TELEPHONE
     │                           │                         │
     │  Event (nouvelle cde,     │                         │
     │  relance, livraison…)     │                         │
     │                           │                         │
     │  1. POST /v18.0/          │                         │
     │     {PHONE_ID}/messages   │                         │
     │     Authorization: Bearer │                         │
     │     {ACCESS_TOKEN}        │                         │
     │─────────────────────────►│                         │
     │                           │ 2. Envoi du message     │
     │                           │─────────────────────── ►│
     │  3. Webhook callback      │                         │
     │     (delivery receipt)    │                         │
     │◄─────────────────────────│                         │
     │                           │                         │
     │  Validation webhook :     │                         │
     │  HMAC-SHA256 avec         │                         │
     │  WHATSAPP_APP_SECRET      │                         │
     │                           │                         │
     │  Mode : one-way uniquement│                         │
     │  Pas de réception de      │                         │
     │  messages gérée           │                         │

Templates approuvés requis pour les notifications
(voir docs/WHATSAPP_SETUP.md pour la procédure de création)
```

---

## Stack technique détaillée

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS (443)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Caddy (reverse proxy)                      │
│              SSL auto Let's Encrypt                     │
│   {$DOMAIN} → app:3000                                  │
│   api.{$DOMAIN} → kong:8000                             │
│   studio.{$DOMAIN} → studio:3000                        │
└────────────────────────┬────────────────────────────────┘
                         │ réseau Docker interne
          ┌──────────────┼───────────────────┐
          ▼              ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌───────────────┐
│  app         │  │  kong        │  │  studio       │
│  Next.js 15  │  │  API Gateway │  │  Supabase     │
│  port 3000   │  │  port 8000   │  │  Studio       │
└──────┬───────┘  └──────┬───────┘  └───────────────┘
       │                 │
       │         ┌───────┴─────────────────┐
       │         ▼                         ▼
       │  ┌──────────────┐  ┌─────────────────────┐
       │  │  auth        │  │  rest               │
       │  │  GoTrue      │  │  PostgREST          │
       │  │  port 9999   │  │  port 3000          │
       │  └──────────────┘  └─────────────────────┘
       │         │                    │
       │         ▼                    ▼
       │  ┌────────────────────────────────────────┐
       │  │           db                           │
       │  │     PostgreSQL 15 (Supabase)           │
       │  │     + realtime + storage + meta        │
       │  └────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│  osrm        │
│  Routing     │
│  port 5000   │
└──────────────┘
```

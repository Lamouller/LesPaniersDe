# Modèle de données — LesPaniersDe

Toutes les tables sont dans le schéma `public` de PostgreSQL. Les politiques RLS (Row Level Security) sont activées sur toutes les tables contenant des données utilisateur.

---

## Vue d'ensemble des tables

```
entities ──────────────── profiles ──────── auth.users (Supabase)
    │                         │
    │                    (entity_id FK)
    │
    ├── producers ──────── products ─────── weekly_catalogs
    │                                             │
    │                                          orders ──── order_items
    │                                             │
    │                                          invoices
    │                                             │
    │                                          payments
    │                                             │
    │                                          payment_reminders
    │
    ├── deliveries ────── delivery_tracking_points
    │
    ├── messages
    ├── notifications ─── notification_preferences
    ├── subscriptions
    └── audit_log
```

---

## Tables

### `entities`
Représente une organisation ou un lieu rattaché à un **unique point de retrait**.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant unique |
| `name` | `text` NOT NULL | Nom de l'entité (ex: "Open Space La Fabrique") |
| `address` | `text` NOT NULL | Adresse complète du point de retrait |
| `pickup_point_description` | `text` | Instructions pour le pickup (ex: "Réception RDC") |
| `is_active` | `boolean` DEFAULT true | Entité active / désactivée |
| `created_at` | `timestamptz` DEFAULT now() | Date de création |

**Contraintes clés :**
- Une entité = un seul point de retrait. La colonne `address` + `pickup_point_description` définit ce point de manière unique.
- `UNIQUE (name)` pour éviter les doublons d'entité.

---

### `profiles`
Extension de `auth.users` (Supabase) avec les informations métier. Un profil par utilisateur.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK, FK → `auth.users.id` | Lié au compte Supabase Auth |
| `entity_id` | `uuid` FK → `entities.id` | Entité de rattachement |
| `role` | `text` CHECK ('consumer', 'admin', 'producer') | Rôle métier |
| `full_name` | `text` | Nom complet |
| `phone` | `text` | Téléphone (pour WhatsApp) |
| `allergies` | `text[]` | Liste d'allergènes/préférences |
| `is_blocked` | `boolean` DEFAULT false | Bloqué pour impayé |
| `blocked_reason` | `text` | Motif du blocage |
| `created_at` | `timestamptz` DEFAULT now() | |

**Contraintes clés :**
- `entity_id` est NOT NULL pour les consommateurs (`role = 'consumer'`). Un consommateur est toujours rattaché à une entité.
- Les admins et producteurs peuvent avoir `entity_id` NULL (profil global).
- `UNIQUE (id)` hérite de la PK.

**RLS :**
- Consommateur : lecture et modification de son propre profil uniquement.
- Admin : lecture de tous les profils de ses entités managées.
- Producteur : lecture des profils des consommateurs ayant commandé.

---

### `producers`
Informations sur un producteur (personne physique ou morale).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `profile_id` | `uuid` FK → `profiles.id` | Compte utilisateur associé |
| `farm_name` | `text` NOT NULL | Nom de la ferme/exploitation |
| `description` | `text` | Présentation |
| `phone` | `text` | Téléphone de contact |
| `email` | `text` | Email de contact |
| `address` | `text` | Adresse de l'exploitation |
| `lat` | `float8` | Latitude (pour le routing OSRM) |
| `lng` | `float8` | Longitude |
| `is_active` | `boolean` DEFAULT true | Actif / suspendu |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `products`
Produits proposés par un producteur (une taille de panier, un type de légume, etc.).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `producer_id` | `uuid` FK → `producers.id` NOT NULL | Producteur propriétaire |
| `name` | `text` NOT NULL | Nom du produit (ex: "Panier Famille") |
| `description` | `text` | Description |
| `unit` | `text` NOT NULL | Unité (ex: "panier", "kg", "botte") |
| `price_cents` | `int` NOT NULL | Prix en centimes d'euro |
| `is_available` | `boolean` DEFAULT true | Disponible à la commande |
| `image_url` | `text` | URL photo (Supabase Storage) |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `weekly_catalogs`
Catalogue hebdomadaire : quels produits sont disponibles pour une semaine donnée, avec quelle quantité.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `producer_id` | `uuid` FK → `producers.id` NOT NULL | Producteur |
| `product_id` | `uuid` FK → `products.id` NOT NULL | Produit |
| `week_start` | `date` NOT NULL | Lundi de la semaine de livraison |
| `max_quantity` | `int` NOT NULL | Quantité maximale disponible |
| `remaining_quantity` | `int` NOT NULL | Quantité restante (décrémentée à la commande) |
| `notes` | `text` | Notes saisonnières (ex: "pas de tomates cette semaine") |
| `created_at` | `timestamptz` DEFAULT now() | |

**Contraintes clés :**
- `UNIQUE (producer_id, product_id, week_start)` : un produit ne peut être listé qu'une fois par semaine par producteur.
- `CHECK (remaining_quantity >= 0)` : pas de quantité négative.

---

### `orders`
Commande passée par un consommateur.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `consumer_id` | `uuid` FK → `profiles.id` NOT NULL | Consommateur |
| `entity_id` | `uuid` FK → `entities.id` NOT NULL | Entité (point de retrait) |
| `week_start` | `date` NOT NULL | Semaine de livraison |
| `status` | `text` | 'pending', 'confirmed', 'picked_up', 'cancelled' |
| `total_cents` | `int` NOT NULL DEFAULT 0 | Total calculé en centimes |
| `notes` | `text` | Notes du consommateur |
| `created_at` | `timestamptz` DEFAULT now() | |

**Contraintes clés :**
- La commande est bloquée si `profiles.is_blocked = true`.
- `UNIQUE (consumer_id, week_start)` : une seule commande par consommateur par semaine.

---

### `order_items`
Lignes d'une commande (produit × quantité).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `order_id` | `uuid` FK → `orders.id` NOT NULL | Commande parente |
| `product_id` | `uuid` FK → `products.id` NOT NULL | Produit commandé |
| `quantity` | `int` NOT NULL DEFAULT 1 | Quantité |
| `unit_price_cents` | `int` NOT NULL | Prix unitaire au moment de la commande (snapshot) |

**Contraintes clés :**
- `unit_price_cents` est un snapshot du prix au moment de la commande, pas une FK live vers `products.price_cents`.
- `CHECK (quantity > 0)`.

---

### `payments`
Enregistrement d'un paiement reçu (pointage manuel par l'admin).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `invoice_id` | `uuid` FK → `invoices.id` NOT NULL | Facture concernée |
| `amount_cents` | `int` NOT NULL | Montant pointé |
| `method` | `text` | 'cash', 'card', 'transfer', 'check' |
| `pointed_by` | `uuid` FK → `profiles.id` | Admin ayant effectué le pointage |
| `pointed_at` | `timestamptz` DEFAULT now() | Date du pointage |
| `notes` | `text` | Notes (ex: "chèque 456, reçu le 12/04") |

**Note :** le pointage est l'acte de validation du paiement. Il peut être partiel (paiement échelonné). Quand `SUM(payments.amount_cents) >= invoices.total_cents`, la facture passe en statut `paid`.

---

### `payment_reminders`
Historique des relances envoyées pour impayé.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `invoice_id` | `uuid` FK → `invoices.id` NOT NULL | Facture concernée |
| `sent_at` | `timestamptz` DEFAULT now() | Date d'envoi |
| `channel` | `text` | 'email', 'whatsapp' |
| `reminder_number` | `int` NOT NULL | Numéro de relance (1, 2, ...) |
| `blocked_after` | `boolean` DEFAULT false | Si cette relance a déclenché un blocage |

---

### `deliveries`
Tournée de livraison effectuée par un producteur.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `producer_id` | `uuid` FK → `producers.id` NOT NULL | Producteur |
| `week_start` | `date` NOT NULL | Semaine de la tournée |
| `status` | `text` | 'planned', 'in_progress', 'completed' |
| `started_at` | `timestamptz` | Début réel de la tournée |
| `completed_at` | `timestamptz` | Fin de la tournée |
| `route_optimized` | `jsonb` | Résultat OSRM (ordre des stops, temps estimés) |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `delivery_tracking_points`
Points GPS enregistrés pendant une tournée (pour le suivi live).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `delivery_id` | `uuid` FK → `deliveries.id` NOT NULL | Tournée concernée |
| `lat` | `float8` NOT NULL | Latitude |
| `lng` | `float8` NOT NULL | Longitude |
| `recorded_at` | `timestamptz` DEFAULT now() | Timestamp GPS |
| `accuracy_meters` | `float4` | Précision du GPS en mètres |

**Note :** ces points sont diffusés en temps réel via Supabase Realtime aux consommateurs abonnés. Seul le dernier point est affiché aux consommateurs.

---

### `messages`
Messagerie entre consommateurs et producteurs (via l'admin).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `sender_id` | `uuid` FK → `profiles.id` NOT NULL | Expéditeur |
| `recipient_id` | `uuid` FK → `profiles.id` NOT NULL | Destinataire |
| `order_id` | `uuid` FK → `orders.id` | Commande liée (optionnel) |
| `content` | `text` NOT NULL | Corps du message |
| `read_at` | `timestamptz` | Date de lecture (NULL = non lu) |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `notifications`
File d'attente et historique des notifications envoyées.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `user_id` | `uuid` FK → `profiles.id` NOT NULL | Destinataire |
| `type` | `text` NOT NULL | 'order_confirmed', 'delivery_near', 'invoice_due', 'reminder_1', 'reminder_2', ... |
| `channel` | `text` NOT NULL | 'email', 'whatsapp', 'web_push' |
| `payload` | `jsonb` | Données de la notification |
| `status` | `text` | 'pending', 'sent', 'failed' |
| `sent_at` | `timestamptz` | Date d'envoi effectif |
| `error` | `text` | Message d'erreur si `status = 'failed'` |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `notification_preferences`
Préférences de notification de chaque utilisateur.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `user_id` | `uuid` FK → `profiles.id` NOT NULL UNIQUE | Utilisateur |
| `email_enabled` | `boolean` DEFAULT true | |
| `whatsapp_enabled` | `boolean` DEFAULT false | |
| `web_push_enabled` | `boolean` DEFAULT true | |
| `push_subscription` | `jsonb` | Subscription Web Push (endpoint, keys) |
| `updated_at` | `timestamptz` DEFAULT now() | |

---

### `invoices`
Facture générée automatiquement après chaque livraison.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `order_id` | `uuid` FK → `orders.id` NOT NULL UNIQUE | Commande facturée (1 commande = 1 facture) |
| `invoice_number` | `text` NOT NULL UNIQUE | Numéro de facture (ex: "FAC-2024-001") |
| `total_cents` | `int` NOT NULL | Montant total TTC en centimes |
| `status` | `text` | 'pending', 'partial', 'paid', 'overdue' |
| `pdf_url` | `text` | URL du PDF dans Supabase Storage |
| `due_date` | `date` NOT NULL | Date d'échéance (= date livraison + buffer configurable) |
| `paid_at` | `timestamptz` | Date de paiement complet |
| `created_at` | `timestamptz` DEFAULT now() | |

**Statuts :**
- `pending` : facture émise, non payée
- `partial` : paiement partiel reçu
- `paid` : paiement complet pointé
- `overdue` : en retard (déclenche les relances et le blocage)

---

### `subscriptions`
Abonnements récurrents d'un consommateur (hebdo, bi-hebdo, mensuel).

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `consumer_id` | `uuid` FK → `profiles.id` NOT NULL | Consommateur |
| `product_id` | `uuid` FK → `products.id` NOT NULL | Produit souscrit |
| `frequency` | `text` | 'weekly', 'biweekly', 'monthly' |
| `quantity` | `int` NOT NULL DEFAULT 1 | Quantité récurrente |
| `is_paused` | `boolean` DEFAULT false | Abonnement en pause |
| `pause_until` | `date` | Date de reprise (vacances) |
| `start_date` | `date` NOT NULL | Début de l'abonnement |
| `end_date` | `date` | Fin de l'abonnement (NULL = indéfini) |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### `audit_log`
Journal d'audit immuable pour toutes les actions sensibles.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant |
| `actor_id` | `uuid` FK → `profiles.id` | Utilisateur ayant effectué l'action |
| `action` | `text` NOT NULL | Ex: 'payment.pointed', 'user.blocked', 'order.cancelled' |
| `table_name` | `text` | Table concernée |
| `record_id` | `uuid` | Enregistrement concerné |
| `old_values` | `jsonb` | Valeurs avant modification |
| `new_values` | `jsonb` | Valeurs après modification |
| `ip_address` | `inet` | IP de l'acteur |
| `created_at` | `timestamptz` DEFAULT now() | |

**Note :** `audit_log` est en INSERT ONLY (pas de UPDATE ni DELETE) via RLS.

---

## Politiques RLS par rôle

| Table | Consommateur | Admin | Producteur |
|---|---|---|---|
| `entities` | SELECT own | ALL | SELECT |
| `profiles` | SELECT + UPDATE own | ALL own entities | SELECT consumers who ordered |
| `producers` | SELECT | ALL | SELECT + UPDATE own |
| `products` | SELECT | ALL | ALL own |
| `weekly_catalogs` | SELECT | ALL | ALL own |
| `orders` | SELECT + INSERT own | ALL | SELECT related |
| `order_items` | SELECT own | ALL | SELECT related |
| `payments` | SELECT own | INSERT + SELECT all | SELECT related |
| `invoices` | SELECT own | ALL | SELECT related |
| `payment_reminders` | SELECT own | ALL | — |
| `deliveries` | SELECT | ALL | ALL own |
| `delivery_tracking_points` | SELECT latest | SELECT | INSERT + SELECT own |
| `messages` | SELECT + INSERT own | ALL | SELECT + INSERT own |
| `notifications` | SELECT own | ALL | SELECT own |
| `notification_preferences` | ALL own | SELECT all | SELECT + UPDATE own |
| `subscriptions` | ALL own | ALL | SELECT related |
| `audit_log` | — | SELECT | — |

Toutes les policies d'écriture incluent `WITH CHECK (true)` explicite pour éviter les erreurs silencieuses PostgREST.

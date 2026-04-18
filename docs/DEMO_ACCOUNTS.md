# Comptes de démonstration — LesPaniersDe

> **DEV UNIQUEMENT** — Ces comptes et mots de passe sont destinés au développement local.
> Ne jamais utiliser en production. Ne pas committer de `.env` avec ces valeurs.

- App locale : http://localhost:3200/login
- Supabase Studio : http://localhost:54350
- Inbucket (mails dev) : http://localhost:8250

Pour relancer le seed complet :
```bash
./scripts/seed-test-accounts.sh
```

Le script est **idempotent** : si les comptes existent déjà, ils sont skippés et les données sont upsertées sans erreur.

---

## Comptes disponibles

| Email | Mot de passe | Rôle | Entité / Producer | Scénario testable |
|---|---|---|---|---|
| `admin@lespaniersde.local` | `DemoAdmin2026!` | admin | — | Admin plateforme principal : gestion complète, réconciliation paiements |
| `superadmin@lespaniersde.local` | `DemoSuper2026!` | admin | — | Second admin : test des droits multi-admin |
| `nadine@lespaniersde.local` | `DemoNadine2026!` | producer | Les Paniers de Nadine | Productrice légumes : voir commandes, gérer catalog, relances impayés |
| `marc@lespaniersde.local` | `DemoMarc2026!` | producer | Le Verger de Marc | Nouveau producteur fruits/miel : onboarding, catalog hebdo, entités multiples |
| `alice@antislash.local` | `DemoAlice2026!` | client | Open Space Antislash | Cliente régulière : historique OK, commande en cours, préférences alimentaires (no poireaux/betteraves) |
| `bob@antislash.local` | `DemoBob2026!` | client | Open Space Antislash | **Client bloqué** : 2 impayés overdue, `ordering_blocked_until` actif — tester le blocage de commande |
| `clara@antislash.local` | `DemoClara2026!` | client | Open Space Antislash | Cliente récente : 1 commande pending chez Marc, pas encore confirmée |
| `david@coworking.local` | `DemoDavid2026!` | client | Coworking Étoile | Nouveau client : première commande confirmée chez Nadine |
| `emma@coworking.local` | `DemoEmma2026!` | client | Coworking Étoile | Abonnée active : abonnement weekly Marc (Panier L + miel), paiement par virement pointé |

---

## Données de test créées

### Entités

| ID | Nom | Adresse | Pickup |
|---|---|---|---|
| `11111111-0000-0000-0000-000000000001` | Open Space Antislash | 12 Rue de la République, 75011 Paris | Salle café, RDC |
| `11111111-0000-0000-0000-000000000002` | Coworking Étoile | 12 Avenue de la Grande Armée, 75017 Paris | Accueil RDC |

### Producteurs

| ID | Nom | Entités desservies | Livraison |
|---|---|---|---|
| `22222222-0000-0000-0000-000000000001` | Les Paniers de Nadine | Antislash + Coworking Étoile | Samedi 10h-12h |
| `22222222-0000-0000-0000-000000000002` | Le Verger de Marc | Antislash + Coworking Étoile | Mercredi 14h-16h |

### Commandes de test

| # | Client | Producer | Statut | Paiement | Notes |
|---|---|---|---|---|---|
| LPD-SEED-001 | alice | Nadine | `picked_up` | `paid` (cash) | Semaine dernière, historique OK |
| LPD-SEED-002 | alice | Nadine | `confirmed` | `pending` | Semaine en cours (Panier M + options) |
| LPD-SEED-003 | bob | Nadine | `picked_up` | `overdue` | Impayé #1 — due_at il y a 15 jours |
| LPD-SEED-004 | bob | Nadine | `picked_up` | `overdue` | Impayé #2 — due_at il y a 25 jours |
| LPD-SEED-005 | clara | Marc | `pending` | `pending` | Commande fruits en attente |
| LPD-SEED-006 | david | Nadine | `confirmed` | `pending` | Première commande, Coworking Étoile |
| LPD-SEED-007 | emma | Marc | `picked_up` | `paid` (transfer) | Virement pointé, lié à son abonnement |

### Abonnement

Emma a un abonnement `weekly` actif chez Marc : 1 Panier fruits L + 1 Pot de miel 500g.

### Messages

3 messages de test :
- Alice → Nadine (sur commande 002) : demande substitution betteraves
- Nadine → Alice : réponse positive
- Clara → Marc (sur commande 005) : question sur le miel crémeux

---

## Requêtes de vérification

```sql
-- Profils par rôle (attendu : admin=2, producer=2, client=5)
SELECT role, count(*) FROM public.profiles GROUP BY role;

-- Total commandes (attendu : 7)
SELECT count(*) FROM public.orders;

-- Paiements par statut (attendu : paid=2, pending=3, overdue=2)
SELECT status, count(*) FROM public.payments GROUP BY status;

-- Clients bloqués (attendu : bob@antislash.local)
SELECT u.email, p.ordering_blocked_until
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.ordering_blocked_until IS NOT NULL;

-- Dashboard admin réconciliation
SELECT * FROM public.v_admin_reconciliation;

-- Abonnements actifs
SELECT s.frequency, s.status, p.email as client
FROM public.subscriptions s
JOIN auth.users p ON p.id = s.client_id;
```

---

## Nettoyage (reset complet du seed)

```sql
-- Supprimer les données de test (garder le schema)
DELETE FROM public.messages        WHERE id LIKE 'ffffffff%';
DELETE FROM public.subscriptions   WHERE id LIKE 'eeeeeeee%';
DELETE FROM public.invoices        WHERE invoice_number LIKE 'INV-SEED%';
DELETE FROM public.payments        WHERE id LIKE 'cccccccc%';
DELETE FROM public.order_items     WHERE id LIKE 'bbbbbbbb%';
DELETE FROM public.orders          WHERE order_number LIKE 'LPD-SEED%';
DELETE FROM public.profiles        WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@lespaniersde.local' OR email LIKE '%@antislash.local' OR email LIKE '%@coworking.local'
);
-- Puis supprimer via Supabase Studio : Auth > Users > supprimer les 9 comptes
-- Ou via script : relancer seed-test-accounts.sh recréera tout proprement
```

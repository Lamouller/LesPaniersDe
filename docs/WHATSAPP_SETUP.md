# Configuration WhatsApp — Meta Cloud API

LesPaniersDe utilise WhatsApp via la **Meta Cloud API** pour envoyer des notifications one-way (pas de réception de messages). Ce guide décrit la configuration complète.

---

## Prérequis

- Un compte Facebook personnel
- Un numéro de téléphone dédié à WhatsApp Business (qui ne doit pas être utilisé sur WhatsApp personnel)
- Un compte Meta Business Manager

---

## 1. Créer un compte Meta Business Manager

1. Aller sur https://business.facebook.com
2. Cliquer sur "Créer un compte"
3. Renseigner le nom de votre entreprise, votre nom et votre email professionnel
4. Valider l'email de confirmation

---

## 2. Créer une application Meta

1. Aller sur https://developers.facebook.com/apps
2. Cliquer sur "Créer une application"
3. Choisir le type **"Business"**
4. Renseigner le nom (ex: "LesPaniersDe Notifications")
5. Associer à votre compte Business Manager
6. Cliquer sur "Créer une application"

---

## 3. Ajouter le produit WhatsApp

1. Dans le tableau de bord de votre app, cliquer sur "Ajouter des produits"
2. Trouver **"WhatsApp"** et cliquer sur "Configurer"
3. Choisir ou créer un compte **WhatsApp Business**

---

## 4. Configurer le numéro de téléphone

1. Dans la section WhatsApp > Configuration
2. Cliquer sur "Ajouter un numéro de téléphone"
3. Renseigner votre numéro dédié
4. Choisir la méthode de vérification (SMS ou appel vocal)
5. Saisir le code reçu

Une fois vérifié, noter le **Phone Number ID** affiché — c'est la valeur `WHATSAPP_PHONE_ID`.

---

## 5. Générer un token d'accès permanent

Le token temporaire expire dans 24h. Pour la production, il faut un token permanent.

**Méthode via System User :**

1. Dans Meta Business Manager > Paramètres > Utilisateurs système
2. Cliquer sur "Ajouter" > créer un utilisateur système (rôle "Administrateur")
3. Cliquer sur "Générer un nouveau token"
4. Choisir votre application
5. Sélectionner les permissions : `whatsapp_business_messaging`, `whatsapp_business_management`
6. Cliquer sur "Générer le token"
7. Copier le token — c'est la valeur `WHATSAPP_ACCESS_TOKEN`

**Important :** ce token ne sera affiché qu'une seule fois. Stockez-le immédiatement dans votre `.env`.

---

## 6. Récupérer les identifiants restants

Dans votre app Meta Developers :

- **Business Account ID** (`WHATSAPP_BUSINESS_ACCOUNT_ID`) : visible dans WhatsApp > Configuration, section "Compte WhatsApp Business"
- **App Secret** (`WHATSAPP_APP_SECRET`) : dans Paramètres de l'app > Basique > Secret de l'application

---

## 7. Configurer le webhook

Le webhook permet à Meta de vous notifier des statuts de livraison des messages.

1. Dans WhatsApp > Configuration > section "Webhook"
2. Cliquer sur "Configurer le webhook"
3. URL du webhook : `https://votredomaine.fr/api/webhooks/whatsapp`
4. Token de vérification : choisir une chaîne arbitraire secrète (ex: `mon-token-secret-42`) → c'est `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. Cliquer sur "Vérifier et enregistrer"
6. S'abonner aux champs : `messages`, `message_deliveries`

---

## 8. Créer les templates de messages

Les notifications WhatsApp doivent utiliser des **templates pré-approuvés** par Meta. Les messages hors template ne sont pas autorisés pour les notifications one-way.

Aller dans WhatsApp > Gestionnaire de modèles > Créer un modèle.

**Templates recommandés pour LesPaniersDe :**

### `order_confirmed` — Confirmation de commande

```
Catégorie : UTILITY
Langue : Français (fr)
Corps :
Bonjour {{1}}, votre commande pour la semaine du {{2}} a été confirmée.
Total : {{3}} €. Retrait au point de votre entité le {{4}}.
```

### `delivery_near` — Livraison proche

```
Catégorie : UTILITY
Langue : Français (fr)
Corps :
Bonjour {{1}}, {{2}} est en route et sera à votre point de retrait dans environ {{3}} minutes.
```

### `invoice_due` — Facture à régler

```
Catégorie : UTILITY
Langue : Français (fr)
Corps :
Bonjour {{1}}, votre facture n°{{2}} d'un montant de {{3}} € est à régler.
Paiement en cash, CB ou virement directement auprès de votre gestionnaire.
```

### `payment_reminder` — Relance impayé

```
Catégorie : UTILITY
Langue : Français (fr)
Corps :
Bonjour {{1}}, votre facture n°{{2}} ({{3}} €) n'a pas encore été pointée comme réglée.
Sans régularisation, votre prochaine commande sera bloquée. Contactez votre gestionnaire.
```

Après soumission, l'approbation Meta prend généralement **24 à 48 heures**.

---

## 9. Tester l'intégration

Avant de mettre en production, tester avec le numéro de test fourni par Meta :

```bash
# Test d'envoi (remplacer les valeurs)
curl -X POST https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages \
  -H "Authorization: Bearer ${WHATSAPP_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "33600000000",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": { "code": "en_US" }
    }
  }'
```

---

## 10. Remplir le `.env`

Une fois toutes les valeurs récupérées :

```bash
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_APP_SECRET=abcdef1234567890abcdef1234567890
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mon-token-secret-42
```

---

## Limites et quotas

| Limite | Valeur par défaut |
|---|---|
| Messages par jour (numéro non vérifié) | 250 |
| Messages par jour (numéro vérifié) | 1 000 → 10 000 → 100 000 |
| Templates actifs | 250 |

Pour augmenter les quotas, vérifier votre compte WhatsApp Business auprès de Meta (processus de vérification d'entreprise).

---

## Dépannage

**Erreur 131030 — Recipient not in allowed list**
En mode développement Meta, seuls les numéros ajoutés manuellement dans "Destinataires de test" peuvent recevoir des messages.

**Erreur 132000 — Template not found**
Le template n'existe pas ou n'est pas encore approuvé. Vérifier dans le Gestionnaire de modèles.

**Webhook validation failed**
Vérifier que `WHATSAPP_WEBHOOK_VERIFY_TOKEN` dans `.env` correspond exactement au token saisi dans Meta Developers.

# Politique de sécurité — LesPaniersDe

## Signaler une vulnérabilité

Nous prenons la sécurité de LesPaniersDe très au sérieux. Si vous découvrez une vulnérabilité de sécurité, nous vous remercions de nous en informer de manière responsable.

**Ne pas ouvrir d'issue publique GitHub pour les vulnérabilités de sécurité.**

### Comment signaler

Envoyez un email à **security@lespaniersde.fr** avec :

- Une description claire de la vulnérabilité
- Les étapes pour la reproduire (proof of concept si possible)
- L'impact potentiel (données exposées, accès non autorisé, etc.)
- Votre nom et/ou pseudonyme GitHub si vous souhaitez être crédité

### Délais de réponse

| Etape | Délai |
|---|---|
| Accusé de réception | 48 heures (jours ouvrés) |
| Évaluation initiale | 5 jours ouvrés |
| Correction et patch | 30 jours (selon complexité) |
| Divulgation publique | Après déploiement du correctif |

Nous vous tiendrons informé de l'avancement tout au long du processus.

## Périmètre (scope)

### Dans le scope

- Injections SQL ou NoSQL
- Failles d'authentification / contournement de session
- Exposition de données personnelles (RGPD)
- Failles XSS stockées ou réfléchies permettant l'exécution de code
- Contournement des politiques RLS Supabase
- Fuites de clés API ou de secrets dans le code
- Failles CSRF sur les endpoints sensibles
- Escalade de privilèges (consommateur → admin ou producteur)

### Hors scope

- Attaques par force brute sans impact démontré
- Attaques de type déni de service (DoS/DDoS)
- Ingénierie sociale
- Problèmes sur des services tiers non maintenus par ce projet
- Vulnérabilités dans les dépendances sans vecteur d'exploitation démontré

## Divulgation responsable

Nous suivons un processus de **divulgation coordonnée** :

1. Le chercheur signale en privé
2. Nous développons et testons un correctif
3. Nous déployons le correctif
4. Nous créons un avis de sécurité public (GitHub Security Advisory)
5. Le chercheur peut publier ses recherches si il le souhaite

Nous ne poursuivrons pas en justice les chercheurs en sécurité agissant de bonne foi et respectant cette politique.

## Versions supportées

| Version | Support sécurité |
|---|---|
| `main` (dernière) | Oui |
| Releases antérieures | Non — mettre à jour |

## Remerciements

Les personnes ayant signalé des vulnérabilités validées seront remerciées dans notre Hall of Fame (avec leur accord).

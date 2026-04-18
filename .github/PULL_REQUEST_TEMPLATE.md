## Description

<!-- Décrivez les changements apportés par cette PR et pourquoi. -->
<!-- Describe the changes in this PR and why they were made. -->

## Type de changement

- [ ] Correction de bug (`fix`)
- [ ] Nouvelle fonctionnalité (`feat`)
- [ ] Refactoring sans changement fonctionnel (`refactor`)
- [ ] Documentation (`docs`)
- [ ] Changement de configuration / maintenance (`chore`)
- [ ] Amélioration des performances (`perf`)
- [ ] Correctif sécurité (`security`)

## Issue liée / Related Issue

Closes #<!-- numéro de l'issue -->

---

## Checklist

### Code

- [ ] Mon code suit les conventions du projet (voir `docs/CONTRIBUTING_DEV.md`)
- [ ] J'ai vérifié que `npm run lint` ne retourne aucune erreur
- [ ] J'ai vérifié que `npm run typecheck` ne retourne aucune erreur
- [ ] Le build `npm run build` réussit sans erreur

### Base de données (si applicable)

- [ ] Les nouvelles tables ont des politiques RLS activées
- [ ] Les policies d'écriture incluent `WITH CHECK (true)`
- [ ] Une migration SQL a été créée dans `supabase/migrations/`
- [ ] Les colonnes utilisées dans les requêtes ont été vérifiées dans le schéma

### Interface (si applicable)

- [ ] Les composants respectent le design system Liquid Glass (noir/blanc)
- [ ] Tous les `<button>` ont `type="button"` sauf les submits intentionnels
- [ ] L'interface est responsive (mobile et desktop)

### Tests

- [ ] J'ai testé manuellement les parcours affectés
- [ ] Les cas limites ont été vérifiés (valeurs vides, erreurs, permissions)

### Sécurité

- [ ] Aucun secret ou credential n'est inclus dans le code
- [ ] Les données utilisateur sont validées côté serveur
- [ ] Les nouvelles routes API vérifient les permissions (RLS ou middleware)

### Documentation

- [ ] J'ai mis à jour la documentation si nécessaire
- [ ] Les messages de commit respectent le format `emoji type: description`

---

## Captures d'écran (si changements UI)

<!-- Avant / Après si applicable -->

## Notes pour le reviewer

<!-- Informations supplémentaires pour faciliter la review. -->

---
name: choisir-les-tests
description: "Politique de tests du dépôt : ne lancer que les tests pertinents pour ce qui a changé (npm run test:cible), un seul jeu de tests sur le recouvrement après un simple rebase, la suite entière laissée à la CI ; comment affiner la sélection quand elle se trompe. À charger avant de lancer des tests pour un lot, un correctif ou un rebase."
user-invocable: false
---

# Choisir les tests à lancer

**Principe.** La CI lance toujours la suite entière : c'est le filet. En local, un agent ne lance que les tests qui couvrent ce qui a changé (demande du propriétaire). La sélection se fait par `npm run test:cible` (depuis `client/`), jamais à la main fichier par fichier, sauf pour un test que l'on est en train d'écrire.

## Quoi lancer

| Situation | Commande |
| --- | --- |
| Fonctionnalité ou correctif | `npm run test:cible` : les tests des fichiers modifiés (imports transitifs, tests qui citent le fichier, règles de `scripts/tests-cibles-regles.mjs`). Un correctif commence par un test qui échoue, puis la sélection. |
| Voir sans lancer | `npm run test:cible -- --liste`, et `--pourquoi <test>` pour la raison d'un choix. |
| **Simple rebase** (conflit sur Git) | `npm run test:cible -- --apres-rebase` : un seul jeu de tests, sur le **recouvrement** (fichiers que la base a changés et que le lot touche aussi). Recouvrement vide : aucun test, seulement l'absence de marqueurs de conflit. Un conflit résolu à la main : ajoute `--fichiers <ces fichiers>`. La pointe d'avant le rebase est `ORIG_HEAD` ; si une autre opération l'a déplacé depuis (la dernière opération n'était pas ce rebase), donne-la : `--avant <réf>`. |
| Rendu changé : un `.astro`, un style (`src/styles/**`) ou `public/**` | La sélection choisit tous les tests qui lisent `dist/` (règle `rendu`). Sans build ils se sautent : elle dit « lancer `npm run build` avant ». Lance donc `npm run build` d'abord. |
| `client/package.json`, verrou npm, `astro.config.mjs`, `.nvmrc`, `tsconfig.json` | Toujours la suite entière (règle `outillage`). |
| Fichier qu'aucune règle ne couvre | La sélection lance la suite entière et dit d'ajouter une règle. |
| Instructions (`.claude/`, `CLAUDE.md`, `docs/equipe.md`) | `npm run test:cible`, comme ailleurs : d'autres tests lisent ces fichiers (pour `CLAUDE.md`, 5 tests, dont `debug-schema` et `instructions-claude`). |
| Index des décisions modifié | `npm run decisions:index -- --verifier`. |

La suite entière (`npm run test:cible -- --tout` ou `npm test`) n'est lancée que pour un changement d'infrastructure de test, ou si la sélection le demande.

## Le rapport

Il donne : les fichiers considérés, le nombre de tests choisis et pourquoi (la sélection l'affiche), le résultat. Jamais un test sauté ou désactivé pour obtenir du vert.

## Affiner la politique

La sélection est une aide, pas une preuve. Elle s'améliore par ses règles, déclaratives, dans `client/scripts/tests-cibles-regles.mjs` :
- **La CI attrape un échec que la sélection avait manqué** : ajoute la règle qui aurait choisi ce test (fichier modifié → test), et un cas dans `test/tests-cibles.test.mjs`. C'est l'unique façon d'élargir.
- **Un test choisi à tort, systématiquement** : resserre la règle qui le choisit, avec son cas de test.
- Les règles se changent par un lot comme un autre (relu par `tech-qualite`).

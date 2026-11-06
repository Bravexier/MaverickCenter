---
name: choisir-les-tests
description: "Politique de tests du dépôt : un seul passage par lot, par tech-qualite, en fin de lot ; seuls les tests pertinents (npm run test:cible) ; reprises limitées aux échecs et au diff de la correction ; recouvrement après un rebase ; suite entière laissée à la CI. À charger avant de lancer des tests pour un lot, un correctif ou un rebase."
user-invocable: false
---

# Choisir les tests à lancer

**Principe.** La CI lance toujours la suite entière : c'est le filet. En local, les tests ne passent qu'**une fois par lot, par `tech-qualite`, en fin de lot**, quand tous les auteurs ont rendu et avant la validation du `leader-technique` (demande du propriétaire : relancer les mêmes tests à chaque passage coûtait 10 à 35 minutes). Il lance seulement ceux qui couvrent ce qui a changé, par `npm run test:cible` (depuis `client/`) sur tout le diff du lot, avec les contrôles de `controles-avant-rendu`, dans le même tour que la relecture.

- **Les auteurs** (`tech-front`, `tech-back`, `tech-db`, `tech-sources`) ne lancent que le fichier de test qu'ils écrivent ou corrigent (`node --test test/<fichier>`), jamais `npm test` ni `test:cible`. `tech-skills` ne lance aucun test.
- **Un même test ne se relance pas** sans qu'un fichier qu'il couvre ait changé, ou si son échec venait de l'environnement (ex. `node_modules` absent), une fois celui-ci réparé : seuls les fichiers en échec se relancent.

## Quoi lancer

| Situation | Commande |
| --- | --- |
| Fin de lot (par `tech-qualite`) | `npm run test:cible` : les tests des fichiers modifiés (imports transitifs, tests qui citent le fichier, règles de `scripts/tests-cibles-regles.mjs`). Un correctif commence par un test qui échoue (écrit par son auteur), puis la sélection. |
| **Après une correction** | Seulement les tests en échec et ceux du diff de la correction : `npm run test:cible -- --fichiers <fichiers corrigés>`. Jamais toute la sélection. |
| Voir sans lancer | `npm run test:cible -- --liste`, et `--pourquoi <test>` pour la raison d'un choix. |
| **Simple rebase** (conflit sur Git) | `tech-publication` ne lance rien : il donne le **recouvrement** (fichiers que la base a changés et que le lot touche aussi) par `npm run test:cible -- --apres-rebase --liste`. Vide : il pousse, seule l'absence de marqueurs de conflit se vérifie. Son rapport donne aussi la pointe d'avant le rebase (`ORIG_HEAD` n'est plus fiable plus tard) et les fichiers résolus à la main. Sinon `tech-qualite` passe ce seul jeu : `npm run test:cible -- --apres-rebase --avant <sha> [--fichiers <fichiers résolus à la main>]`. |
| Rendu changé : un `.astro`, un style (`src/styles/**`) ou `public/**` | La sélection choisit tous les tests qui lisent `dist/` (règle `rendu`). Sans build ils se sautent : elle dit « lancer `npm run build` avant ». `tech-qualite` lance donc `npm run build` d'abord. |
| `client/package.json`, verrou npm, `astro.config.mjs`, `.nvmrc`, `tsconfig.json` | Toujours la suite entière (règle `outillage`). |
| Fichier qu'aucune règle ne couvre | La sélection lance la suite entière et dit d'ajouter une règle. |
| Instructions (`.claude/`, `CLAUDE.md`, `docs/equipe.md`) | `npm run test:cible`, comme ailleurs : d'autres tests lisent ces fichiers (pour `CLAUDE.md`, 5 tests, dont `debug-schema` et `instructions-claude`). |
| Index des décisions modifié | `npm run decisions:index -- --verifier`. |

La suite entière (`npm run test:cible -- --tout` ou `npm test`) n'est lancée que pour un changement d'infrastructure de test, ou si la sélection le demande.

**Circuit court.** Le `leader-technique` fait ce passage lui-même, une seule fois, à la fin, juste avant de relire : aucun passage intermédiaire.

## Le rapport

Celui de `tech-qualite`. Il donne : les fichiers considérés, le nombre de tests choisis et pourquoi (la sélection l'affiche), le résultat. Jamais un test sauté ou désactivé pour obtenir du vert.

## Affiner la politique

La sélection est une aide, pas une preuve. Elle s'améliore par ses règles, déclaratives, dans `client/scripts/tests-cibles-regles.mjs` :
- **La CI attrape un échec que la sélection avait manqué** : ajoute la règle qui aurait choisi ce test (fichier modifié → test), et un cas dans `test/tests-cibles.test.mjs`. C'est l'unique façon d'élargir.
- **Un test choisi à tort, systématiquement** : resserre la règle qui le choisit, avec son cas de test.
- Les règles se changent par un lot comme un autre (relu par `tech-qualite`).

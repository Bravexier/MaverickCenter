---
name: resoudre-un-conflit
description: "Rebaser automatiquement une branche sur sa base juste après le dernier commit (et quand la base bouge sous une PR) et en résoudre les conflits selon leur nature — mécaniques, fichiers tenus par un outil (data/rows, migrations, docs/sql, version, verrou npm), schéma, conflits de sens confiés à l'auteur — puis contrôles et push. Préchargé par tech-publication ; à charger par un membre appelé sur un conflit."
---

# Rebaser et résoudre les conflits

## La règle

On rebase la branche sur sa base et on en résout les conflits sans attendre (demande du propriétaire), à deux moments :
- juste après le dernier commit d'un lot, avant le push qui sert à la PR ;
- chaque fois que la base bouge sous une PR ouverte (`corriger-une-pr`).

**Le cadre.**
- La base est `origin/dev`, ou `origin/master` pour un hotfix. On ne fusionne jamais la base dans la branche (`publier-une-branche`, `docs/flux-git.md`).
- Seul `tech-publication` fait du git : `git add`, `git rebase --continue`, `git push`. L'auteur appelé sur un conflit édite les fichiers et lance ses outils, sans git.
- Pendant un rebase, `--ours` désigne la base, et `--theirs` le commit de la branche qu'on rejoue.

**Exception : la branche de refusion.** Une `feature/…` qui refusionne `master` dans `dev` après un hotfix en conflit (`docs/flux-git.md`) contient une fusion qui doit rester. Elle ne se rebase jamais, car un rebase la rendrait linéaire et sortirait `master` de l'historique. Si `dev` bouge sous elle, on refait la refusion depuis le nouveau `dev`.

## Qui résout quoi

| Conflit | Qui | Comment |
| --- | --- | --- |
| **Mécanique** : lignes ajoutées des deux côtés au même endroit, ordre d'imports, entrées d'une liste ou d'un tableau, paragraphes de doc | `tech-publication` | Garder les deux apports, dans l'ordre du fichier. |
| **Version** dans `client/package.json` (et `package-lock.json`) | `tech-publication` | Garder la version de la base, tenue par le bot. |
| **Dépendances** changées des deux côtés | `tech-publication` | Réunir les deux apports dans `client/package.json`, puis régénérer le verrou : `npm install --package-lock-only` dans `client/`. Jamais à la main. |
| **`data/schema.sql`** (écrit à la main) | `tech-db` | Garder les apports des deux côtés. `PRAGMA user_version` passe au numéro de la migration de la branche. |
| **Migration de la branche dont la base a pris le numéro** | `tech-db` | La renuméroter au numéro suivant : le fichier `.sql`, son registre `.json` voisin, les tests et skills qui la citent. Précédent : `0072-index-jamais-choisis` devenue `0073` (commit 3dda773). |
| **Fichiers tenus par un outil** : `data/rows/`, `docs/sql/structure.md`, `docs/sql/apercu.md` | `tech-db` | Jamais à la main. Partir de la version de la base, puis rejouer l'outil de la branche (`db:migrate`, `db:sync-pages`, `db:appliquer-edition`) et `npm run db:doc` (`ecrire-une-migration`). |
| **Conflit de sens** : les deux côtés ont changé la même logique, le même texte ou le même choix | l'auteur de la zone, appelé par le `leader-technique` ; la session principale pour les instructions (`CLAUDE.md`, `.claude/`, `docs/equipe.md`) | Garder le comportement voulu des deux côtés, avec le skill de la zone. Si l'un des deux doit perdre un choix du propriétaire, c'est une question à celui qui a fait la demande (`poser-une-question`). |

**Au milieu d'un rebase en pause**, l'auteur ne lance que l'outil qui refait son fichier (`db:migrate`, `db:doc`, `npm install --package-lock-only`). Il ne lance pas ses contrôles complets : les commits suivants de la branche ne sont pas encore rejoués, et les contrôles viennent à l'étape 4.

**Avant de continuer**, aucun marqueur ne doit rester dans les fichiers qui étaient en conflit. On liste ces fichiers avec `git diff --name-only --diff-filter=U` (avant le `git add`), puis on lance `git grep -nE '^(<<<<<<<|>>>>>>>)( |$)' -- <ces fichiers>`. Il ne doit rien trouver : rc=1 est le bon résultat. On ne se sert pas de `git diff --check`, qui signale aussi les espaces de fin de ligne.

## Déroulé (`tech-publication`)

1. **Reprendre ce que la branche distante a reçu.** `git fetch --prune origin`. Si `origin/<branche>` existe et a des commits absents en local (une suggestion appliquée sur GitHub, par exemple) — c'est le cas quand `git merge-base --is-ancestor origin/<branche> HEAD` échoue — les reprendre d'abord : `git rebase origin/<branche>`.
2. **Rebaser sur la base** si elle a bougé, c'est-à-dire si `git merge-base --is-ancestor <base> HEAD` échoue : `git rebase <base>`. Sinon, il n'y a rien à faire.
3. **Classer chaque conflit** d'après le tableau.
   - Un conflit qui est à toi : le résoudre, vérifier les marqueurs, `git add`, `git rebase --continue`.
   - Sinon, laisser le rebase en pause et rendre aussitôt un rapport « bloqué » : les fichiers, la nature du conflit, les deux versions. Rien d'autre ne tourne dans l'arbre pendant ce temps (un seul lot qui écrit). Le chef lance le membre qui résout, puis te relance pour vérifier les marqueurs, faire `git add` et `git rebase --continue`.
   - Une résolution impossible dans ce lot (un choix du propriétaire, par exemple) : `git rebase --abort`. La branche revient à son état d'avant, qui reste aussi dans `ORIG_HEAD` et le reflog. Rapport « bloqué ». On ne pousse jamais un état à moitié résolu.
4. **Rebase fini.**
   - Le rapport liste les fichiers que la base a changés et que le lot touche aussi. Le chef fait relancer les contrôles qu'ils concernent (`controles-avant-rendu`).
   - Une résolution de sens faite après la relecture de `tech-qualite` a sa relecture courte, limitée à son diff.
5. **Pousser** quand tout est vert.
   - Une branche déjà poussée : `git push --force-with-lease --force-if-includes`. Le second drapeau refuse d'écraser un commit distant que l'étape 1 n'a pas repris.
   - La première fois : `git push -u origin <branche>`.
   - En cas d'erreur réseau, jusqu'à 4 reprises, après 2 s, 4 s, 8 s puis 16 s.
6. **Le rapport** dit : rebase fait ou non, chaque conflit et qui l'a résolu, les contrôles relancés, le commit poussé.

## Ce qui ne se fait jamais

- Fusionner la base dans la branche.
- Rebaser la branche de refusion.
- Résoudre à la main un fichier tenu par un outil.
- Garder un marqueur de conflit.
- Pousser un état à moitié résolu.
- Supprimer l'apport de l'un des côtés sans le dire dans le rapport.
- Désactiver un test pour passer.

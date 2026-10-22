---
name: publier-une-branche
description: "Publier un travail selon le flux Git du projet — branche feature/<nom> parlante depuis origin/dev, rebase avant chaque push, push avec reprises, puis PR vers dev ouverte, suivie et fusionnée par la session principale. Préchargé par tech-publication ; à charger par la session principale avant d'ouvrir ou de fusionner une PR."
---

# Publier une branche

Règles du propriétaire, en détail dans `docs/flux-git.md` (code : `tools/flux-git/`, workflows `garde-branches.yml`, `livraison.yml`, `ci.yml`).

## La branche (`tech-publication`)

- **Création.** Après `git fetch --prune origin` :
  - `feature/<nom>` depuis `origin/dev`, pour une PR vers `dev` ;
  - `hotfix/<nom>` depuis `origin/master`, pour une PR vers `master`, seulement à la demande du propriétaire.

  Toute autre branche poussée est supprimée par la garde (`claude/…`, `dev/…`, `main`…). `dev/…` ne peut même pas exister à côté de `dev`.
- **Le nom.** `<nom>` dit l'évolution ou le correctif, en minuscules et tirets (`feature/npm5-info-apres-titre`). Jamais le nom aléatoire que propose l'environnement (`feature/awesome-pascal-…`) : renommer la branche avant le premier push (`git branch -m`).
- **Les commits.** Ils contiennent les fichiers du lot que donne le chef, registres des chefs compris (`docs/decisions-regles.md`, `docs/sql/a-valider.md`…). Les messages disent quoi et pourquoi, en français ou en anglais comme l'historique. Une décision appliquée porte « décision » (`consigner-une-decision`). Jamais de fichier fabriqué (`client/src/content/wiki/`, `var/`, `dist/`).
- **La version.** Ne jamais modifier celle de `client/package.json` : le bot la tient après chaque fusion.
- **Avant chaque push**, même sans conflit. La base est `origin/dev`, ou `origin/master` pour un hotfix.
  1. `git fetch --prune origin` ;
  2. si la base a bougé depuis le départ de la branche (`git merge-base --is-ancestor <base> HEAD` échoue), `git rebase <base>` ;
  3. après un rebase, signaler au chef les contrôles que les changements reçus touchent : il les fait relancer (`controles-avant-rendu`) avant le push ;
  4. pousser.

  **Jamais de fusion de la base dans la branche.** La seule exception est la refusion de `master` dans `dev`, décrite dans `docs/flux-git.md`.
- **Le push.** `git push -u origin <branche>`, ou `--force-with-lease` après un rebase d'une branche déjà poussée. En cas d'erreur réseau, jusqu'à 4 reprises, après 2 s, 4 s, 8 s puis 16 s.
- **Le rapport** donne : la branche, le commit, le résumé du diff (`git diff --stat <base>...HEAD`), et s'il y a eu un rebase, les contrôles à relancer.

## La PR (session principale)

- **Ouverture.** Ouvrir la PR `feature/<nom>` → `dev` par les outils GitHub de la session, en français : quoi et pourquoi, contrôles passés. S'abonner à son activité.
- **Fusion.** Une fois la CI verte, la fusionner sans attendre le propriétaire, par « Create a merge commit » (ni squash, ni rebase). C'est une consigne permanente.
- **Événements.** Une CI rouge, une revue ou un conflit part au `leader-technique`. La correction est poussée par `tech-publication`.
- **Ce qui ne se fait qu'à la demande du propriétaire :** une livraison `dev` → `master`, un hotfix → `master`. Jamais `[V: X+1]` de soi-même : le passage en 1.0 est son signal.
- **Après la fusion**, le bot supprime la branche. Une suite de travail repart d'une nouvelle branche, depuis `origin/dev` à jour.

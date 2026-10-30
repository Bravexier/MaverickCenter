---
name: publier-une-branche
description: "Publier un travail selon le flux Git du projet — branche feature/<nom> parlante depuis origin/dev, rebase automatique et conflits résolus juste après le dernier commit, push avec reprises, puis PR vers dev ouverte, corrigée automatiquement et fusionnée par la session principale. Préchargé par tech-publication ; à charger par la session principale avant d'ouvrir, de corriger ou de fusionner une PR."
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
- **Juste après le dernier commit, et avant chaque push**, même sans conflit. La base est `origin/dev`, ou `origin/master` pour un hotfix.
  1. `git fetch --prune origin`, puis reprendre les commits que la branche distante aurait reçus (`resoudre-un-conflit`, étape 1) ;
  2. si la base a bougé (`git merge-base --is-ancestor <base> HEAD` échoue), et seulement à son tour (« L'ordre de passage »), `git rebase <base>`. La branche de refusion de `master` dans `dev` ne se rebase jamais (`docs/flux-git.md`) ;
  3. résoudre les conflits aussitôt : mécaniques par `tech-publication`, données, schéma et sens par leur auteur (`resoudre-un-conflit`) ;
  4. après un rebase, signaler au chef les contrôles que les changements reçus touchent : il les fait relancer (`controles-avant-rendu`) avant le push ;
  5. pousser.

  **Jamais de fusion de la base dans la branche.** La seule exception est la refusion de `master` dans `dev`, décrite dans `docs/flux-git.md`.
- **Le push.** Après un `git fetch --prune origin` juste avant : `git push -u --force-with-lease origin <branche>` la première fois, `git push --force-with-lease origin <branche>` ensuite. Le push forcé de SA PROPRE branche (`feature/<nom>` ou `hotfix/<nom>` créée par nous) après un rebase est TOUJOURS autorisé (choix du propriétaire, 2026-10-29) : on ne le lui redemande pas. Sans `--force-if-includes` : cette forme n'est pas dans la liste autorisée de `.claude/settings.json`. Jamais de push forcé sur `dev`, `master` ni sur la branche d'un autre, jamais `--force` ou `-f` seuls, jamais de rebase d'une branche qui n'est pas la nôtre. En cas d'erreur réseau, jusqu'à 4 reprises, après 2 s, 4 s, 8 s puis 16 s.
- **Le rapport** donne : la branche, le commit, le résumé du diff (`git diff --stat <base>...HEAD`), et s'il y a eu un rebase, les contrôles à relancer.

## L'ordre de passage

Règle du propriétaire (`CLAUDE.md`, « Git ») : éviter une suite de rebases quand `dev` avance sous plusieurs sessions.
- **L'ordre** : parmi les PR ouvertes vers `dev` dont les fichiers se recoupent, numéro croissant. Une PR sans recouvrement n'attend personne : elle est fusionnée dès que sa CI est verte.
- **Exception** : demande explicite et urgente du propriétaire → cette PR passe en tête, les autres s'alignent derrière elle sans changer leur ordre entre elles.
- **Qui impose** : la session principale (seule à avoir les outils GitHub). Elle liste les PR ouvertes vers dev et leurs fichiers, calcule les recouvrements, et pose UN commentaire par PR concernée : l'ordre complet, et « ne rebase ni ne pousse avant la fusion de #N ; ensuite un seul rebase sur dev à jour ». Elle n'en repose un que si l'ordre change. Les autres sessions le reçoivent par leur abonnement à leur PR.
- **Chaque PR, à son tour** : un seul rebase sur l'état actuel de dev, `test:cible -- --apres-rebase`, push, CI, fusion par la session principale, qui prévient la suivante (commentaire « à toi »).
- **Pas de rebase « pour suivre dev » pendant l'attente.** Si la PR en tête est bloquée (CI rouge qu'elle corrige, ou plus de réponse), la session principale le dit au propriétaire plutôt que de réordonner seule.
- **Commentaires GitHub** : footer d'attribution habituel.

## La PR (session principale)

- **Ouverture.** Ouvrir la PR `feature/<nom>` → `dev` par les outils GitHub de la session, en français : quoi et pourquoi, contrôles passés. S'abonner à son activité.
- **Fusion.** Une fois la CI verte, la fusionner sans attendre le propriétaire, par « Create a merge commit » (ni squash, ni rebase). C'est une consigne permanente.
- **Correction automatique.** Une CI rouge, une revue, un conflit ou un constat d'un robot se corrigent sans attendre le propriétaire, jusqu'à la fusion (`corriger-une-pr`). La session confie l'événement au `leader-technique`, et la correction est poussée par `tech-publication`.
- **Ce qui ne se fait qu'à la demande du propriétaire :** une livraison `dev` → `master`, un hotfix → `master`. Jamais `[V: X+1]` de soi-même : le passage en 1.0 est son signal.
- **Après la fusion**, le bot supprime la branche. Une suite de travail repart d'une nouvelle branche, depuis `origin/dev` à jour.

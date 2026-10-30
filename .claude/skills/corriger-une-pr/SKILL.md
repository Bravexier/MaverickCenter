---
name: corriger-une-pr
description: "Corriger automatiquement une PR ouverte jusqu'à sa fusion — CI rouge, conflit avec la base, commentaire de revue, constat d'un robot — par l'équipe technique, sans attendre le propriétaire, puis fusion dès que tout est vert. À charger par la session principale à chaque événement d'une PR, et par leader-technique quand il en reçoit un."
---

# Corriger une PR automatiquement

Une PR ouverte se corrige d'elle-même jusqu'à être verte et sans conflit, puis se fusionne (demande du propriétaire). On ne lui demande rien pour une correction : on la fait et on la pousse.

Trois choses seulement attendent le propriétaire :
- une demande de revue lourde ;
- un choix qui lui revient ;
- une livraison vers `master`.

## À chaque événement (session principale)

1. **Relire tout l'état de la PR** sur sa tête : checks du dernier commit, mergeabilité (conflit), fils de revue ouverts.
2. **Si tout est vert,** sans conflit et sans fil qui attend : fusionner par « Create a merge commit » (`publier-une-branche`).
3. **Sinon, lancer aussitôt `leader-technique`** avec la PR et sa tête, et selon le cas :
   - le journal du job rouge et l'état du même check sur le dernier commit de `dev` (outils GitHub) ;
   - le texte exact des commentaires.
4. **Après la correction poussée**, relire l'état et recommencer jusqu'à la fusion. Le nombre de tours n'est pas limité : un constat qui revient à chaque push appelle la correction de sa cause.
5. **Pour un conflit que GitHub n'annonce pas** (la base a bougé), rebaser avant la correction, mais seulement au tour de la PR : `resoudre-un-conflit`.

## Ce qui se corrige, et qui le fait

Seule la session principale a les outils GitHub. Elle seule commente, répond à un fil, le résout ou relance un job. Le `leader-technique` et son équipe font les corrections dans le dépôt.

| Événement | Équipe technique (`leader-technique`) | Session principale |
| --- | --- | --- |
| **CI rouge** | `tech-qualite` diagnostique (`diagnostiquer-la-ci`). L'auteur de la zone corrige, `tech-qualite` relit la correction en court, puis `tech-publication` rebase et pousse. | Fournit le journal et l'état du check sur `dev`. |
| **CI rouge venue de la base** (le même check est rouge sur `dev`) | Si un correctif existe (PR ouverte, revert), l'auteur de la zone le reporte dans la branche, puis `tech-publication` pousse. | Si aucun correctif n'existe : un seul commentaire sur la PR, qui dit le check, la raison et le correctif proposé. Une seule relance du job au plus, dans les cas de `diagnostiquer-la-ci`. |
| **Conflit avec la base** | Vérifier d'abord l'ordre de passage (`publier-une-branche`, « L'ordre de passage ») : si ce n'est pas le tour de la PR, ne pas rebaser. À son tour, `tech-publication` rebase et résout (`resoudre-un-conflit`). Un conflit de données ou de sens va aussitôt à son auteur. On relance les contrôles touchés, puis on pousse. | — |
| **Revue : petite demande** (renommage, test ajouté, correction locale) | Faite et poussée. | Répond au fil en une ligne, avec le commit, et le résout. |
| **Revue : demande lourde ou de conception** | Rien n'est poussé ; le `leader-technique` rédige sa proposition. | Remonte la proposition au propriétaire. |
| **Constat d'un robot de revue** | Vérifié : un chemin réel mène-t-il à l'erreur ? Si oui, corrigé et poussé. Un constat marqué facultatif ne déclenche pas un push à lui seul. | Sinon, répond sur le fil avec la raison. |

## Garde-fous

- **Jamais** de test sauté, désactivé ou mis en quarantaine, de commit vide, ni de PR refermée puis rouverte pour relancer la CI.
- **Jamais** de fusion de la base dans la branche : on rebase. Le push forcé de sa propre branche après un rebase est toujours autorisé (choix du propriétaire, 2026-10-29), sans le redemander : `git fetch --prune origin` puis `git push --force-with-lease origin <branche>`, sans `--force-if-includes` (hors de la liste autorisée de `.claude/settings.json`). Jamais sur `dev`, `master` ni la branche d'un autre, jamais `--force` ou `-f` seuls (`resoudre-un-conflit`).
- **Le fond.** Une correction qui change une règle ou le lore passe par le contrôle du fond (`circuit-des-demandes`).
- **Avant chaque push,** les tests pertinents pour la correction (`npm run test:cible`, `choisir-les-tests`) sont verts en local : un push qui rougit la CI coûte un tour.
- **Ce qui ne se corrige pas depuis la PR** (panne de la base sans correctif, accès manquant) se dit une fois, sur la PR, par la session principale. La PR reste suivie jusqu'à sa fusion ou sa fermeture.

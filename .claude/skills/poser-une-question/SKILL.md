---
name: poser-une-question
description: "Poser une question que seul le propriétaire peut trancher (règle, nom, valeur, choix d'affichage) — forme de la question, remontée jusqu'à la session principale, registre docs/sql/a-valider.md. À charger dès qu'une source manque ou se contredit."
---

# Poser une question au propriétaire

Règle d'or : ce qui n'est ni dans une source ni dans une décision ne se déduit pas. On le demande.

## La question

- **Autonome.** Le propriétaire doit pouvoir répondre sans relire la conversation : le contexte en une phrase, les lectures possibles citées telles quelles avec leur source (doc, onglet, case, page), puis ce que chaque réponse changerait.
- **Fermée quand c'est possible.** Oui ou non, ou un choix entre les lectures écrites ; ajouter « autre » si aucune ne convient.
- **Une question par point.** Regrouper par thème celles d'un même travail.

## La remontée

Un membre pose sa question dans son rapport (`format-de-rapport`). Son chef y répond s'il le peut à partir des décisions ou des sources ; sinon il la fait remonter, par le chef qui l'a sollicité s'il y en a un, jusqu'à la session principale.

La session principale la pose au propriétaire (`AskUserQuestion`, en français). Puis elle relance le chef avec la réponse **mot pour mot**. Le chef consigne la réponse si c'est une décision (`consigner-une-decision`).

## Si personne ne peut répondre maintenant

Avant d'ajouter une question, vérifier qu'elle n'est pas déjà posée. Certaines vivent dans les sections « Questions au propriétaire » de `docs/chronologie.md`, `docs/codex.md` et `docs/bestiaire.md`, tenues par l'auteur de ces docs. On les cite plutôt que de les recopier.

La question non bloquante se range dans `docs/sql/a-valider.md`. Une graphie à trancher se range dans `docs/sql/orthographe-a-valider.md`. Ces registres sont tenus par section, par le chef du domaine : `game-design` pour les règles et leurs noms, `worldbuilding` pour le lore et ses noms, `leader-technique` (par `tech-db`) pour les choix de forme du schéma. Ce qu'un chef y écrit se publie (`circuit-des-demandes`, « Publication »).

La question va dans la section du thème, ou dans une nouvelle section datée pour un travail en cours. Elle est numérotée comme ses voisines (Q…, G…). Le travail continue sans la valeur : absente (`NULL`, rien d'affiché), jamais devinée.

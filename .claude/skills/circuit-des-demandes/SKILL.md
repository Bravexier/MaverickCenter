---
name: circuit-des-demandes
description: "Protocole de l'organisation à trois chefs (leader-technique, game-design, worldbuilding) et de leurs équipes — routage, plan, briefs, rapports, relances, questions au propriétaire, profondeur des sous-agents. À charger par la session principale et par chaque chef avant de répartir un travail."
---

# Circuit des demandes

## Routage (session principale)

La session principale ne lance que les trois chefs (`docs/equipe.md`) et leur transmet la demande du propriétaire **mot pour mot**, avec ce qu'elle sait déjà (fichiers, PR, échanges précédents).

| Demande | Chef qui pilote |
| --- | --- |
| Règle ou mécanisme du jeu à créer, changer, vérifier, expliquer (sorts, dons, races, objets, combat, fiche) | `game-design` |
| Lore : histoire, chronologie, nations, factions, dieux, temples, légendes, cohérence du monde | `worldbuilding` |
| Le site : affichage, bug, base, import, outils, tests, CI, publication | `leader-technique` |
| Événement d'une PR (CI rouge, revue, conflit) | `leader-technique` |

Une demande mixte est pilotée par le chef du domaine d'origine, qui sollicite les autres. Une simple question dont la réponse est dans le contexte ou dans un fichier connu n'a pas besoin d'un chef.

**Un seul lot qui écrit à la fois** dans l'arbre de travail : deux migrations prendraient le même numéro, et deux `npm test` se gêneraient. Quand deux demandes doivent écrire, la seconde attend la fin de la première. Des analyses en lecture peuvent tourner pendant ce temps.

## Circuit d'une règle (demande du propriétaire)

1. La session principale confie la demande à `game-design`.
2. `game-design` cadre : sources, décisions R… en jeu, domaines touchés. Il ne lance que les membres concernés, chacun avec un brief.
3. Chaque membre analyse son domaine et rend un rapport (`format-de-rapport`).
4. `game-design` en fait une spécification unique : la règle exacte, sa source ou les mots du propriétaire, les valeurs, ce qui change. Il consigne la décision s'il y en a une (`consigner-une-decision`).
5. Si le site doit changer, `game-design` lance `leader-technique` avec cette spécification comme cahier des charges.
6. `leader-technique` fait réaliser le travail par son équipe (données, code, tests, relecture, branche poussée), puis rend son rapport à `game-design`.
7. `game-design` vérifie la conformité du résultat à la spécification, puis rend la synthèse finale à la session principale.

Le lore suit le même circuit avec `worldbuilding`. Un travail purement technique part directement à `leader-technique`.

**Contrôle du fond.** Un lot technique peut changer une valeur, un texte ou un nom de règle ou du lore sans venir d'une spécification de `game-design` ou de `worldbuilding` : migration de données, réimport, texte d'une page. `leader-technique` le soumet alors au chef du domaine. Ce chef fait vérifier le lot (sources, décisions R…) par le membre concerné et rend son verdict : conforme, ou à corriger avec les R… en cause.

Un rapatriement de l'édition du site de dev n'est pas jugé : le site est la source de ce qu'il modifie. On n'en tire, au plus, que des questions au propriétaire.

**L'ordre des vérifications.** Ce verdict, ou la conformité vérifiée par le chef qui a commandé, passe **avant** la relecture de `tech-qualite`. Une correction faite après la relecture (écart de conformité, CI rouge) a sa propre relecture courte, limitée à son diff.

## Le rôle d'un chef

- **Cadrer avant de lancer.** Lire juste ce qu'il faut (sections de docs, décisions, `git diff`) pour découper. Le travail lui-même revient à l'équipe. `game-design` et `worldbuilding` n'ont pas Bash : le `leader-technique` leur fournit, dans son rapport, la liste des fichiers changés et `git diff --stat`, et ils lisent les fichiers par Read.
- **Ne lancer que les membres utiles.** Les tâches dépendantes partent dans l'ordre : le résultat de l'une va dans le brief de la suivante. Les analyses en lecture seule partent en parallèle (plusieurs appels `Agent` dans un même message). Chaque membre se lance avec `run_in_background: false` (puce « Les membres qui passent en arrière-plan »).
- **Un seul arbre de travail.** Deux membres qui écrivent ou qui lancent des contrôles se suivent, jamais en même temps : `npm test` refabrique les pages du wiki, et `db:build` refait `var/maverick.db`. Si des analystes doivent interroger la base, elle est construite une fois avant de les lancer, ou chacun la construit dans son scratchpad (`interroger-la-base`).
- **Écrire un brief autonome :**
  - l'objectif ;
  - le périmètre (fichiers, tables, pages) ;
  - ce qui est déjà établi ;
  - le livrable attendu ;
  - les contraintes : décisions R…, choix du propriétaire, skill de zone à charger. Le skill d'une zone n'est proposé qu'après la lecture d'un fichier de la zone : le brief donne donc son chemin (`.claude/skills/<nom>/SKILL.md`), que le membre lit au besoin.

  Ne pas recopier `CLAUDE.md` : chaque agent le reçoit déjà.
- **Relayer entre membres.** Les membres d'une équipe se parlent par leur chef : il transmet à l'un ce dont il a besoin du travail de l'autre, ou relance l'un avec la question de l'autre (`SendMessage` à son identifiant : l'agent reprend avec tout son contexte).
- **Répondre aux doutes.** Un membre bloqué rend un rapport qui finit par ses questions. Le chef y répond par `SendMessage` s'il le peut. Sinon, il pose la question à celui qui lui a fait la demande.
- **Les membres qui passent en arrière-plan.** Un chef lance ses membres avec `run_in_background: false`. Un travail long passe pourtant en arrière-plan, et son rapport arrive alors à la session principale, pas au chef.
  - **Le chef** rend un point d'étape court : ce qui est fait, le membre attendu, et ce qu'il fera de son rapport. Il ne devine jamais un rapport qu'il n'a pas reçu.
  - **La session principale** lui transmet le rapport mot pour mot par `SendMessage`, dès qu'il arrive. Le chef reprend avec tout son contexte, et ainsi de suite jusqu'à la synthèse finale.
  - **Si ce chef a été lancé par un autre chef**, le chef lanceur reçoit son point d'étape et rend lui aussi un point d'étape. La session principale relaie le rapport du membre au chef qui l'attend. Ensuite, elle relaie mot pour mot la synthèse de ce chef au chef lanceur, par `SendMessage`, pour qu'il reprenne.
- **Synthétiser.** Le chef rend une synthèse, pas la copie des rapports. Elle contient : ce qui est fait (fichiers, décisions, branche), ce qui reste, les questions ouvertes, et qui doit agir ensuite.

## Entre chefs

Un chef parle librement aux deux autres. Pour lancer un autre chef, il utilise `Agent` avec une demande écrite (le cahier des charges), et le relance avec `SendMessage` pour la suite. Le chef sollicité répond dans son rapport.

Une valeur à vérifier sur un original Google (R83) se demande au `leader-technique`, qui la fait lire par `tech-sources` (document, onglet, case), puis la rend telle quelle.

Profondeur : la session principale est au niveau 0, un chef au niveau 1, un membre au niveau 2. Un chef lancé par un autre chef est au niveau 2 et ses membres au niveau 3, la limite. Un chef lancé par un chef ne lance donc **aucun** chef, pas même celui qui l'a lancé : il met sa demande dans son rapport, et le chef qui l'a lancé s'en charge.

## Questions au propriétaire

Seul le propriétaire tranche une règle, un nom ou un choix d'affichage absent des sources et des décisions (règle d'or). La question remonte : membre → chef → (chef demandeur) → session principale. La session principale la pose avec `AskUserQuestion`, puis relance le chef avec la réponse mot pour mot. Format et registre : skill `poser-une-question`.

## Publication

Tout fichier modifié du dépôt se publie, y compris les registres qu'écrivent les chefs (`docs/decisions-regles.md`, `docs/sql/a-valider.md`, `docs/sql/orthographe-a-valider.md`).
- **Les fichiers des chefs.** Un chef qui a écrit en donne la liste au `leader-technique`. Ils partent avec le lot technique qui applique la décision, ou seuls si le site ne change pas.
- **La branche.** `tech-publication` commite. Juste après le dernier commit, il rebase sur la base et résout les conflits (`resoudre-un-conflit`), puis pousse.
- **La PR.** La session principale ouvre la PR vers `dev`, s'y abonne et la fusionne une fois la CI verte (`publier-une-branche`).
- **Correction automatique.** Les événements de la PR (CI rouge, conflit, revue) arrivent à la session principale, qui les confie aussitôt à `leader-technique`. La PR se corrige sans attendre le propriétaire, jusqu'à la fusion (`corriger-une-pr`).

**Le travail commence sur sa branche.** Avant le premier fichier écrit d'un lot, `tech-publication` crée la `feature/<nom>` depuis `origin/dev` à jour : `db:migrate` part du schéma du dernier commit, et le numéro d'une migration se lit dans l'arbre.

**Les skills de zone suivent leur zone.** L'auteur d'un changement met à jour, dans le même lot, le skill de la zone qu'il touche (`zone-…`, `ui-…`, `site-…`, `base-…`, `sources-…`) : un choix du propriétaire ajouté ou changé, un invariant nouveau. `tech-qualite` relit ce skill avec le reste.

**Les instructions générales** (`CLAUDE.md`, `.claude/agents/`, les skills de procédure, `docs/equipe.md`) sont tenues par la session principale, à la demande du propriétaire. `tech-qualite` les relit, `tech-publication` les publie.

## Économie

- Un rapport tient en quelques dizaines de lignes : des chemins et des lignes, pas de fichiers recopiés.
- Une seule relecture par `tech-qualite`, à la fin d'un lot (plus une relecture courte de toute correction faite ensuite) ; une seule vérification de conformité par le chef qui a commandé.
- Un chef ne refait pas le travail d'un membre. En cas de doute sur un rapport, il relance ce membre avec le point précis.

# Mise à jour de décembre : dossier de travail provisoire

Ce dossier sert aux sessions qui intègrent la mise à jour de décembre du propriétaire (docx « MISE À JOUR - DÉCEMBRE » et classeur « Nouveauté mise à jour Décembre », reçus le 2026-11-12). **Il est à supprimer quand le dernier lot est fusionné.** Ce n'est ni une source de règles ni une documentation du site : les règles sont dans `docs/decisions-regles.md` (R236 et suivantes), les questions ouvertes au §11 de `docs/sql/a-valider.md`.

- `docx-mise-a-jour-decembre.md` : le texte du docx du propriétaire, converti tel quel (liste des modifications, par rubrique).
- Le classeur est dans le dépôt : instantané `sources/raw/classeurs/magie-maverick-v10.json` (25 onglets, dont Fongoïde, Gémidien, Porte-étendard, Boxeur, Cuirassé V2).
- `rapports/` : les analyses faites avant le premier lot, à lire au lieu de les refaire. Leurs numéros de ligne datent d'avant le lot des magies.
  - `gd-dons.md` : classes (Boxeur, Porte-étendard, Cuirassé V2, Parleur, Archimage).
  - `gd-objets.md` : effets secondaires des matériaux d'armes.
  - `gd-races.md` : Fongoïde, Gémidien, Mode Hyper de l'Elfe argenté et du Felfe.
  - `gd-mecaniques.md` : initiative, limite D12, « Construction », altérations d'état, météo.
  - `gd-fiche.md`, `gd-magies.md` : fiche et magies (lots déjà faits ou en cours).
  - `reponses-proprietaire-*.md` : les réponses du propriétaire, mot pour mot.

## Lots

| Lot | État |
| --- | --- |
| Magies V10 et spécialisations | fusionné (PR #334) |
| Fiche : spécialisations magiques | en cours, branche `feature/fiche-specialisations-magiques` (migration 0118) |
| Classes, matériaux d'armes, limite D12 | branche poussée `feature/classes-materiaux-d12` (migration 0119 ; R238, R241, R252), PR à ouvrir |
| Races : Fongoïde, Gémidien, Mode Hyper | à faire (R239) ; attend les vitesses des deux races (MAJ-R2) |
| Initiative groupée | à faire (R240) ; attend son texte (MAJ-G1) |

---
name: zone-mise-a-jour
description: "Page /mise-a-jour/ (notes de version, note en préparation, base de référence de master, lot figé, workflow mise-a-jour.yml, simulation en CI) et maintenance pendant une mise à jour (/maintenance/, annonce partagée). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/pages/mise-a-jour.astro", "client/src/scripts/mise-a-jour.mjs", "client/src/lib/notes-de-version*.mjs", "client/src/styles/mise-a-jour/**", "client/serveur/notes-de-version.mjs", "client/scripts/mise-a-jour-*.mjs", "client/scripts/db-reference.mjs", ".github/workflows/mise-a-jour.yml", "client/serveur/maintenance.mjs", "client/src/pages/maintenance.astro", "client/src/scripts/maintenance.mjs", "client/src/lib/maintenance-retour.mjs", "client/src/styles/maintenance/**", "client/test/mise-a-jour*.test.mjs", "client/test/notes-de-version*.test.mjs", "client/test/serveur-notes-de-version.test.mjs", "client/test/serveur-mise-a-jour-etats.test.mjs", "client/test/serveur-maintenance.test.mjs", "client/test/aide-mise-a-jour.mjs"]
user-invocable: false
---
# Mise à jour et maintenance

## Fichiers
- Page : `client/src/pages/mise-a-jour.astro` (menu Outils), script `src/scripts/mise-a-jour.mjs`, CSS `styles/mise-a-jour/`.
- Notes de version : `lib/notes-de-version.mjs` (`comparerBases`, `DEFINITIONS`, `TABLES_LUES`, `TABLES_DES_NOTES`, `resume`, `detail`), `lib/notes-de-version-sens.mjs` (couleurs R29), `lib/notes-de-version-rendu.mjs` (`lancementAffiche`).
- Service : `serveur/notes-de-version.mjs` (note en préparation, lot figé, états du lancement, `lireLot`, `modifierLancement`, `actualiserLancement`, `creerGithub`).
- Scripts : `scripts/db-reference.mjs` (base de master), `scripts/mise-a-jour-regles.mjs` (rejeu du lot sur `data/rows`, `TABLES_DE_LA_NOTE`, `notesEnAttente`), `scripts/mise-a-jour-github.mjs` (phases du workflow, `CONTROLES`, `CONTROLES_DE_LA_CI`), `scripts/mise-a-jour-simulation.mjs` (lot synthétique de la CI).
- Workflow : `.github/workflows/mise-a-jour.yml` ; job `simulation-de-mise-a-jour` de `.github/workflows/ci.yml`.
- Maintenance : `serveur/maintenance.mjs` (`annonceDuLancement`, `etatDeMaintenance`, `DUREE_MAX_MAINTENANCE`), `pages/maintenance.astro`, `scripts/maintenance.mjs`, `lib/maintenance-retour.mjs`, `styles/maintenance/` ; script en ligne de `layouts/Base.astro`.

## À lire
- `docs/serveur.md`, « Mise à jour (site de dev) » : les deux visages de la page, le lot figé, la simulation, les jobs `preparer` et `livrer`, les états du lancement et leurs garanties, l'historique (`historique_modification`), la simulation en CI, les routes `/api/mise-a-jour/…`, la mise en place des jetons.
- `docs/serveur.md`, « Maintenance pendant une mise à jour » : qui publie l'annonce, qui la lit, le script de chaque page, `/maintenance/`, les garde-fous, la mise en place du dossier partagé.
- `docs/decisions-regles.md`, R29 : le sens (vert, rouge) d'une modification.

## Choix du propriétaire
- En production (et partout sans service) : la note de version de la dernière livraison (tables `note_version`, `note_version_ligne`, section 15) puis l'historique.
- Sur le site de dev, en plus : la note en préparation (la base de master construite au build, `donnees/reference.db`, comparée à la base vivante : `comparerBases`), le champ libre (`note_version_brouillon`, section 14), les boutons « Simulation de mise à jour » (rien n'est poussé) et « Effectuer la mise à jour » (lot figé → workflow `mise-a-jour.yml` → lot rejoué sur `data/rows` sans toucher d'autres tables, PR vers dev fusionnée si verte, puis livraison dev → master).
- La case « Version majeure » à côté du titre « Mise à jour en préparation : VX.Y+1 » (demande du 2026-10-22) : cochée après confirmation (décochée sans), la version en préparation devient VX+1.0 ; elle ne déclenche rien, « Effectuer la mise à jour » reste le seul déclencheur. Colonne `note_version_brouillon.majeure` (migration `0070` : 1 cochée, NULL décochée), `POST /api/mise-a-jour/majeure/`, `enregistrerMajeure` ; figée avec le lot (`409`), gardée s'il est annulé, décochée quand la livraison vide le brouillon. `actualiserLancement` ne vide le brouillon qu'au passage d'un lancement annulé dont le lot est entré dans dev quand même, jamais ensuite (le brouillon est alors celui de la mise à jour suivante).
- La production est la base de master (décision du propriétaire).
- Pas de protection du bouton avant la connexion Discord (décision du propriétaire).
- La note de la V0.2 ne liste rien ; son texte dit « Import initial depuis les sources historiques » (migration `0028`, `historique_modification` gardé).
- L'encart « Dernier lancement » ne parle que de la version en préparation, sauf s'il pèse encore sur la page (`lancementAffiche`).
- Le bandeau du site de dev (`Base.astro`) dit « Serveur de dev. » et renvoie à cette page.
- Maintenance en cours (demande du propriétaire) : une vraie mise à jour lancée, les deux sites partent vers `/maintenance/` (menus grisés et inertes, « En travaux, merci de revenir dans quelques minutes »), et chaque serveur rouvre indépendamment dès qu'il a sa nouvelle version.

## Invariants
- Référence : `scripts/db-reference.mjs` construit la base de master depuis `git archive origin/master` (`donnees/reference.db`). La CI et la livraison font `git fetch … master` avant le build. Sans master, la page dit que la référence manque. Rien de tout cela en `SITE_MODE=prod` ni dans la version portable.
- La liste ne compare que les colonnes de `TABLES` (`lib/edition-modele.mjs`, skill `zone-edition`) ; le reste en est dérivé.
- Une couleur vient de R29 et de rien d'autre (`notes-de-version-sens.mjs`) ; tout cas douteux reste neutre.
- Domaines : sorts, magies, classes, races, métiers, guide, Codex, bestiaire, armes, armures, composants, chronologie, mots-clés, équipement. C'est la contrainte CHECK de `note_version_ligne.domaine` (migrations `0032`, `0034`, `0040`, `0043`, `0046`, `0056`) : un domaine nouveau demande une migration.
- Une table nouvelle dans `TABLES` n'est listée qu'avec sa définition (`DEFINITIONS`, `TABLES_LUES`).
- `detail` : une ligne qui n'existe qu'avec une autre (rubrique, butin) n'est listée que pour un champ modifié. `resume` : un contenu absent de la production est dit en une ligne.
- `scripts/mise-a-jour-regles.mjs` refuse d'écrire un fichier de `data/rows` hors des tables du journal et de la note (`TABLES_DE_LA_NOTE`). Un fichier de `data/rows` qui n'est pas tel que l'exporteur l'écrit bloque donc une mise à jour.
- Une vraie mise à jour retire les notes `exemple = 1` qui resteraient (lorem ipsum, migration `0023`).
- `[V: X+1]` n'est jamais repris d'un texte (corps des PR, commentaires : `neutraliserMarqueur`) ; il n'est posé que dans le titre de la PR de livraison d'un lot `majeure` (`titreLivraison`), et la livraison s'arrête si une PR de livraison le porte sans que le lot le demande, ou l'inverse (`desaccordMajeure`, `MAJEURE_AJOUTEE`, `MAJEURE_RETIREE`). La note du lot est alors la X+1.0 (`versionDeLivraison(…, { majeure })`, même règle que `planifier`).
- Le job `preparer` lance `npm test` après avoir écrit la note du lot dans `data/rows` (pas encore sur master). Le job CI `simulation-de-mise-a-jour` applique de même un lot synthétique (`scripts/mise-a-jour-simulation.mjs` : le service fait de vraies modifications et fige le lot) puis les mêmes contrôles (`CONTROLES`, épinglés par `test/mise-a-jour-simulation.test.mjs`).
- Un test qui lit `data/rows` tient avec une note en attente : copie sans elle (`test/aide-mise-a-jour.mjs#copieSansNoteEnAttente`), version libre (`versionLibre`), balayages qui sautent la section 15 (`TABLES_DES_NOTES`). Détail : skill `tests-conventions` et `docs/serveur.md`.
- Seul le lot du lancement actuel est servi au workflow (`lireLot`, sinon `410`) ; un suivi revenu en retard n'écrase jamais un état plus récent (`modifierLancement`).
- Maintenance, « terminé » pour un serveur : la version qui tourne (celle du service, lue au démarrage) atteint la version cible X.Y du lot. Le serveur de test passe par la version de dev qui porte le lot, encore en maintenance.
- L'annonce ne vient que d'une vraie mise à jour (`envoi` → `termine`), jamais d'une simulation ni de `manuel` (la page « Mise à jour » doit rester ouverte pour en donner les valeurs). Le service du site de dev la publie (lot, version cible) dans le dossier partagé (`MAVERICK_MAINTENANCE`, le `maintenance/` du serveur normal monté dans les deux instances) ; la production la lit et n'écrit rien.
- Échec, annulation, « Lever la maintenance » ou 4 h (`DUREE_MAX_MAINTENANCE`) retirent l'annonce.
- La minuterie du site de dev suit le run et republie l'annonce : personne n'est sur ses pages, qui renvoient vers `/maintenance/`.
- Le script de chaque page (`Base.astro`, demande `/api/maintenance/`) est en ligne (aucun module partagé), absent de la version portable et de `/maintenance/`. `lib/maintenance-retour.mjs` ne ramène qu'à une page de ce site.

## Tests
- `notes-de-version`, `notes-de-version-sens`, `serveur-notes-de-version`, `serveur-mise-a-jour-etats`, `mise-a-jour`, `mise-a-jour-regles`, `mise-a-jour-github`, `mise-a-jour-simulation`, `serveur-maintenance`, `mise-a-jour-script` (le script de la page dans un faux navigateur : la case « Version majeure »).
- `test/site-html.test.mjs` exécute le script de maintenance de chaque page dans un faux navigateur et compare la page `/mise-a-jour/` construite aux notes de la base.

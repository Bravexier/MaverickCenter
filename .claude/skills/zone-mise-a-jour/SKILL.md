---
name: zone-mise-a-jour
description: "Page /mise-a-jour/ (notes de version, note en préparation, base de référence de master, lot figé, workflow mise-a-jour.yml, simulation en CI). À charger avant de lire, modifier ou relire ce code. Conflits du journal et maintenance : sous-skills."
paths: ["client/src/pages/mise-a-jour.astro", "client/src/scripts/mise-a-jour.mjs", "client/src/lib/notes-de-version*.mjs", "client/src/styles/mise-a-jour/**", "client/serveur/notes-de-version.mjs", "client/scripts/mise-a-jour-*.mjs", "client/scripts/db-reference.mjs", ".github/workflows/mise-a-jour.yml", "client/test/mise-a-jour.test.mjs", "client/test/mise-a-jour-github.test.mjs", "client/test/mise-a-jour-regles.test.mjs", "client/test/mise-a-jour-script.test.mjs", "client/test/mise-a-jour-simulation.test.mjs", "client/test/notes-de-version*.test.mjs", "client/test/serveur-notes-de-version.test.mjs", "client/test/serveur-mise-a-jour-etats.test.mjs", "client/test/aide-mise-a-jour.mjs"]
user-invocable: false
---
# Mise à jour

## Fichiers
- Page : `client/src/pages/mise-a-jour.astro` (menu Outils), script `src/scripts/mise-a-jour.mjs`, CSS `styles/mise-a-jour/`.
- Notes de version : `lib/notes-de-version.mjs` (`comparerBases`, `DEFINITIONS`, `TABLES_LUES`, `TABLES_DES_NOTES`, `resume`, `detail`), `lib/notes-de-version-sens.mjs` (couleurs R29), `lib/notes-de-version-rendu.mjs` (`lancementAffiche`).
- Service : `serveur/notes-de-version.mjs` (note en préparation, lot figé, états du lancement, `lireLot`, `modifierLancement`, `actualiserLancement`, `creerGithub`).
- Scripts : `scripts/db-reference.mjs` (base de master), `scripts/mise-a-jour-regles.mjs` (rejeu du lot sur `data/rows`, `TABLES_DE_LA_NOTE`, `notesEnAttente`), `scripts/mise-a-jour-github.mjs` (phases du workflow, `CONTROLES`, `CONTROLES_DE_LA_CI`), `scripts/mise-a-jour-simulation.mjs` (lot synthétique de la CI).
- Workflow : `.github/workflows/mise-a-jour.yml` ; job `simulation-de-mise-a-jour` de `.github/workflows/ci.yml`.

## Sous-skills
- Lots du journal en conflit (section de la page, résolution, vrais noms) : skill `zone-mise-a-jour-conflits`. Maintenance et `/maintenance/` : skill `zone-maintenance`.

## À lire
- `docs/serveur.md`, « Mise à jour (site de dev) » : les deux visages de la page, le lot figé, la simulation, les jobs `preparer` et `livrer`, les états du lancement et leurs garanties, l'historique (`historique_modification`), la simulation en CI, les routes `/api/mise-a-jour/…`, la mise en place des jetons.
- `docs/decisions-regles.md`, R29 : le sens (vert, rouge) d'une modification.

## Choix du propriétaire
- En production (et partout sans service) : la note de version de la dernière livraison (tables `note_version`, `note_version_ligne`, section 15) puis l'historique.
- Sur le site de dev, en plus : la note en préparation (la base de master, `donnees/reference.db`, comparée à la base vivante : `comparerBases`), le champ libre (`note_version_brouillon`, section 14), les boutons « Simulation de mise à jour » (rien n'est poussé) et « Effectuer la mise à jour » (lot figé → workflow `mise-a-jour.yml` → lot rejoué sur `data/rows` sans toucher d'autres tables, PR vers dev fusionnée si verte, puis livraison dev → master).
- La case « Version majeure » à côté du titre « Mise à jour en préparation : VX.Y+1 » (demande du propriétaire) : cochée après confirmation (décochée sans), la version en préparation devient VX+1.0 ; elle ne déclenche rien, « Effectuer la mise à jour » reste le seul déclencheur. Colonne `note_version_brouillon.majeure` (migration `0070` : 1 cochée, NULL décochée), `POST /api/mise-a-jour/majeure/`, `enregistrerMajeure` ; figée avec le lot (`409`), gardée s'il est annulé, décochée quand la livraison vide le brouillon. `actualiserLancement` ne vide le brouillon qu'au passage d'un lancement annulé dont le lot est entré dans dev quand même.
- La production est la base de master (décision du propriétaire).
- Pas de protection du bouton avant la connexion Discord (décision du propriétaire), case « Version majeure » comprise : le risque qu'un visiteur du site de dev fasse partir une version majeure est accepté, à revoir avec l'authentification Discord.
- Une mise à jour sans modification ni texte reste refusée (« Rien à livrer », `figerLot`), même case cochée : un passage en version majeure seul demande un texte dans le champ libre (choix du propriétaire).
- La note de la V0.2 ne liste rien : « Import initial depuis les sources historiques » (migration `0028`).
- L'encart « Dernier lancement » ne parle que de la version en préparation, sauf s'il pèse encore sur la page (`lancementAffiche`).
- Le bandeau du site de dev (`Base.astro`) dit « Serveur de dev. » et renvoie à cette page. Ses couleurs (`.bandeau-test` de `styles/global/site-shell.css`, skill `zone-menu`) sont les jetons `--bandeau-dev` et `--texte-sur-fonce`.
- Texte des boutons principaux (« Effectuer la mise à jour », « Lancer la simulation », « Passer en version majeure », « Résoudre ce lot ») : blanc sur le vert du site, 1,9:1 en thème sombre ; réponse du propriétaire du 2026-10-23 : « Texte foncé en sombre (Recommandé) ». En sombre seulement, le texte prend le fond sombre du site (9,9:1) ; le clair ne change pas. `.nv-dev button.nv-principal, .nv-dialogue button.nv-principal` lit `var(--texte-sur-good)` (skill `ui-couleurs-theme` ; question mot pour mot : `docs/content-guide.md`). Les boîtes de dialogue sont dans `.mise-a-jour` (`racine.append`), la section des conflits dans `.nv-dev` : un bouton principal nouveau garde la classe `nv-principal`.

## Invariants
- Référence : `scripts/db-reference.mjs` construit la base de master depuis `git archive origin/master` (`donnees/reference.db`). La CI et la livraison font `git fetch … master` avant le build. Sans master, la page dit que la référence manque. Rien de tout cela en `SITE_MODE=prod` ni dans la version portable.
- La liste ne compare que les colonnes de `TABLES` (`lib/edition-modele.mjs`, skill `zone-edition`) ; le reste en est dérivé.
- Rien de technique sur la page : le service fournit les textes, la page les affiche (elle n'importe pas `TABLES`) ; chaque table et chaque colonne par son vrai nom (demande du propriétaire : « Un vrai nom serai mieux »), par le registre `lib/libelles-de-la-base.mjs` (skill `zone-edition`) ; détail des conflits : skill `zone-mise-a-jour-conflits`.
- Une couleur vient de R29 et de rien d'autre (`notes-de-version-sens.mjs`) ; tout cas douteux reste neutre. R29 fixe le sens (vert = amélioration, rouge = affaiblissement), pas les valeurs : `mise-a-jour.css` lit les jetons du thème `--amelioration…` et `--affaiblissement…` (skill `ui-couleurs-theme`). Les feuilles de la page n'écrivent aucune couleur (le voile des dialogues : un noir de mélange).
- Le détail mot à mot (`notes-de-version-rendu.mjs#diffMots`, aussi celui des conflits) garde une balise du glossaire entière dans un seul morceau, espaces intérieurs compris : coupée entre deux `<ins>`, le middleware la laisserait brute (R164, « Sort fer » posé autour d'un texte existant ; tests `notes-de-version`, `conflits-rendu`, `site-html`).
- Domaines : sorts, magies, classes, races, métiers, guide, Codex, bestiaire, armes, armures, composants, chronologie, mots-clés, équipement (CHECK de `note_version_ligne.domaine`) : un domaine nouveau demande une migration.
- Une table nouvelle dans `TABLES` n'est listée qu'avec sa définition (`DEFINITIONS`, `TABLES_LUES`).
- `detail` : une ligne qui n'existe qu'avec une autre (rubrique, butin) n'est listée que pour un champ modifié. `resume` : un contenu absent de la production est dit en une ligne.
- `scripts/mise-a-jour-regles.mjs` refuse d'écrire un fichier de `data/rows` hors des tables du journal et de la note (`TABLES_DE_LA_NOTE`), plus celles que le rejeu écrit au-delà du journal (`tablesCompletees`). Un fichier de `data/rows` qui n'est pas tel que l'exporteur l'écrit bloque donc une mise à jour.
- `scripts/mise-a-jour-github.mjs#tablesDuLot` (la liste blanche du commit) recopie la règle de `tablesCompletees` : `page_tag`, `page` et les tables à balises pour un mot-clé retiré ; `mot_cle` pour une étiquette d'avant 0043 ; les sources de maîtrise d'arme (`TABLES_DES_SOURCES_DE_MAITRISE`) pour un lot qui touche `classe`, `classe_maitrise_arme` ou `capacite` (skill `zone-edition`).
- Une vraie mise à jour retire les notes `exemple = 1` qui resteraient (lorem ipsum, migration `0023`).
- `[V: X+1]` n'est jamais repris d'un texte (corps des PR, commentaires : `neutraliserMarqueur`) ; il n'est posé que dans le titre de la PR de livraison d'un lot `majeure` (`titreLivraison`), et la livraison s'arrête si une PR de livraison le porte sans que le lot le demande, ou l'inverse (`desaccordMajeure`, `MAJEURE_AJOUTEE`, `MAJEURE_RETIREE`). La note du lot est alors la X+1.0 (`versionDeLivraison(…, { majeure })`, même règle que `planifier`).
- Le job `preparer` lance `npm test` après avoir écrit la note du lot dans `data/rows`. Le job CI `simulation-de-mise-a-jour` applique de même un lot synthétique (`scripts/mise-a-jour-simulation.mjs`) puis les mêmes contrôles (`CONTROLES`, épinglés par `test/mise-a-jour-simulation.test.mjs`).
- Un test qui lit `data/rows` tient avec une note en attente (`test/aide-mise-a-jour.mjs#copieSansNoteEnAttente`, `versionLibre`, `TABLES_DES_NOTES` : skill `tests-conventions`).
- Seul le lot du lancement actuel est servi au workflow (`lireLot`, sinon `410`) ; un suivi revenu en retard n'écrase jamais un état plus récent (`modifierLancement`).

## Tests
- `notes-de-version`, `notes-de-version-sens`, `serveur-notes-de-version`, `serveur-mise-a-jour-etats`, `mise-a-jour`, `mise-a-jour-regles`, `mise-a-jour-github`, `mise-a-jour-simulation`, `mise-a-jour-script` (le script de la page dans un faux navigateur : la case « Version majeure »). Conflits : skill `zone-mise-a-jour-conflits`.
- `test/site-html.test.mjs` compare la page `/mise-a-jour/` construite aux notes de la base et vérifie qu'elle n'a ni `style=` ni feuille de palette.
- `test/palette-css.test.mjs` : aucune couleur écrite dans les fichiers de la zone, lisibilité des jetons dans les deux thèmes, texte du bouton en sombre.

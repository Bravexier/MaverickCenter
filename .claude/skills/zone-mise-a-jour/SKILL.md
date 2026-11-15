---
name: zone-mise-a-jour
description: "Page /mise-a-jour/ (notes de version, note en préparation, base de référence de master, lot figé, lots de changements proposés, workflow mise-a-jour.yml, simulation en CI). À charger avant de lire, modifier ou relire ce code. Conflits du journal et maintenance : sous-skills."
paths: ["client/src/pages/mise-a-jour.astro", "client/src/scripts/mise-a-jour.mjs", "client/src/lib/notes-de-version*.mjs", "client/src/lib/lots-rendu.mjs", "client/src/styles/mise-a-jour/**", "client/serveur/notes-de-version.mjs", "client/scripts/mise-a-jour-*.mjs", "client/scripts/db-reference.mjs", ".github/workflows/mise-a-jour.yml", "client/test/mise-a-jour.test.mjs", "client/test/mise-a-jour-github.test.mjs", "client/test/mise-a-jour-regles.test.mjs", "client/test/mise-a-jour-script.test.mjs", "client/test/mise-a-jour-etat-production.test.mjs", "client/test/mise-a-jour-simulation.test.mjs", "client/test/notes-de-version*.test.mjs", "client/test/lots-rendu*.test.mjs", "client/test/mise-a-jour-lots.test.mjs", "client/test/serveur-notes-de-version.test.mjs", "client/test/serveur-mise-a-jour-*.test.mjs", "client/test/aide-mise-a-jour.mjs"]
user-invocable: false
---
# Mise à jour

## Fichiers
- Page : `src/pages/mise-a-jour.astro` (menu Outils), `src/scripts/mise-a-jour.mjs`, `styles/mise-a-jour/`.
- Notes de version : `lib/notes-de-version.mjs`, `lib/notes-de-version-sens.mjs` (couleurs R29), `lib/notes-de-version-rendu.mjs`.
- Lots de changements proposés : rendu pur `lib/lots-rendu.mjs`, monté par `src/scripts/mise-a-jour.mjs`.
- Service : `serveur/notes-de-version.mjs` (note en préparation, lot figé, états du lancement).
- Scripts : `scripts/db-reference.mjs` (base de master), `scripts/mise-a-jour-regles.mjs` (rejeu du lot sur `data/rows`), `scripts/mise-a-jour-github.mjs` (phases du workflow), `scripts/mise-a-jour-simulation.mjs` (lot synthétique de la CI).
- Workflow : `.github/workflows/mise-a-jour.yml` ; job `simulation-de-mise-a-jour` de `ci.yml`.

## Sous-skills
- Lots en conflit : skill `zone-mise-a-jour-conflits`. Maintenance : skill `zone-maintenance`. Ce que le service fait d'un lot de changements : skill `zone-edition-lots`.

## À lire
- `docs/serveur.md`, « Mise à jour (site de dev) » : les deux visages de la page, le lot figé, les jobs `preparer` et `livrer`, les états du lancement, l'historique, la simulation en CI, les routes `/api/mise-a-jour/…`, les jetons.
- `docs/decisions-regles.md`, R29 : le sens (vert, rouge) d'une modification.

## Choix du propriétaire
- En production (et sans service) : la note de la dernière livraison (tables `note_version`, `note_version_ligne`) puis l'historique.
- Sur le site de dev, en plus : la note en préparation (la référence, voir « Invariants », comparée à la base vivante : `comparerBases`, `comparerAutresTables`), le champ libre (`note_version_brouillon`), « Simulation de mise à jour » et « Effectuer la mise à jour » (lot figé, workflow `mise-a-jour.yml`, PR vers dev, livraison dev → master).
- La case « Version majeure » à côté du titre « Mise à jour en préparation : VX.Y+1 » (demande du propriétaire) : cochée après confirmation (décochée sans), la version devient VX+1.0 ; seul « Effectuer la mise à jour » déclenche. Colonne `note_version_brouillon.majeure` (1, NULL), `POST /api/mise-a-jour/majeure/` ; figée avec le lot (`409`), gardée s'il est annulé, décochée quand la livraison vide le brouillon (lancement annulé : seulement si son lot est entré dans dev).
- R274 : la base du site de dev est la source de vérité ; l'onglet compare au contenu réel de la production (`docs/chantier-base-de-dev.md`). La page dit quelle référence sert.
- `etat_production` (`GET /api/mise-a-jour/`, `attestation.mjs#etatDeLaProduction`) : la production a-t-elle appliqué sa dernière mise à jour ? Son attestation (skill `zone-service-extrait`) est comparée à `notes-de-version.mjs#productionPubliee`. États : `a_jour`, `pas_appliquee`, `inconnue`. La raison `en_cours` (`inconnue`) est la tolérance de 10 minutes après une livraison ; une préparation échouée n'est jamais tolérée.
- Affichage : `notes-de-version-rendu.mjs#affichageDeLaProduction` (choix pur) : alerte seulement pour `pas_appliquee`, ligne discrète sinon. Texte posé par `textContent`, ancre `data-nv-production`.
- La note de la V0.2 ne liste rien : « Import initial depuis les sources historiques ».
- Accès (R275 b ; `docs/serveur.md`, « Accès au site de dev ») : « Effectuer la mise à jour », Simulation, case « Version majeure », brouillon, libérer et résolution des conflits demandent le mot de passe. `GET /api/mise-a-jour/` (`etat_production` : versions, comptes et noms de tables seulement) et `…/lancement/` restent ouverts, `…/conflits/` demande la clé ou le mot de passe. Le lot figé `GET …/lots/<uuid>/` reste ouvert : le workflow le télécharge sans clé. Le 401 est géré par `src/scripts/acces.mjs`, rien à faire dans le script de page.
- Une mise à jour sans modification ni texte reste refusée (« Rien à livrer », `figerLot`), même case cochée : une version majeure seule demande un texte libre (choix du propriétaire).
- L'encart « Dernier lancement » ne parle que de la version en préparation, sauf s'il pèse encore (`lancementAffiche`).
- Le bandeau du site de dev (`Base.astro`) renvoie à cette page (skill `zone-menu`).
- Boutons principaux (« Effectuer la mise à jour », « Lancer la simulation », « Passer en version majeure », « Résoudre ce lot ») : « Texte foncé en sombre (Recommandé) » (réponse du propriétaire) : en sombre seulement, `.nv-dev button.nv-principal, .nv-dialogue button.nv-principal` lit `var(--texte-sur-good)` (skill `ui-couleurs-theme`). Un bouton principal nouveau garde la classe `nv-principal`.

## Lots de changements proposés (R274, R275)
- R275 (question 4 a) : « Chaque lot attend votre clic sur le site de dev, avec un aperçu avant et après. » Section `[data-nv-lots]` entre les listes de la note en préparation et les conflits, qui restent derniers (`zone.append(sectionDesLots(), sectionDesConflits())`).
- `charger()` lit `GET edition/lots/` ; 401, 403 ou 404 (production, service sans les lots, mot de passe annulé) cachent la section : rien en production ; toute autre erreur est dite. Le détail n'est lu que pour les lots à décider et les 10 appliqués les plus récents (`APPLIQUES_RECENTS`).
- « Appliquer » demande confirmation (`<dialog>`), une case par décision verrouillée : le bouton reste inactif tant qu'elle n'est pas cochée, le clic envoie `verrous_ouverts`. Aussi « Refuser » (confirmation), « Refaire l'essai », « Annuler ce lot » (aperçu, puis « Oui, annuler ce lot ») et « Tout recalculer ». Après un clic, `charger()` relit la note : les modifications du lot y comptent.
- Aucun jargon sur la page (ni « nature », ni « opération ») ; toute valeur est échappée (le HTML venu de la base ne s'exécute pas).

## Invariants
- Référence, dans cet ordre : le contenu publié par la production (`site/` de son instance monté en lecture seule sur `/production`, réglage `MAVERICK_PRODUCTION`, lu par `lireReference` : `donnees/maverick.db` et `_serveur/version.json`), à défaut la copie de master (`scripts/db-reference.mjs` : `git archive origin/master`, `donnees/reference.db` ; CI et livraison font d'abord `git fetch … master`). Avec `MAVERICK_CONTENU`, `integrationReference` ne produit pas `donnees/reference.*`. La production ne sert pas si sa base est le même fichier (`dev` et `ino`) que celle du site (`propre`, posé par `serveur/service.mjs`), ni si sa base est illisible à la lecture des tables : repli sur la copie du dépôt, jamais une erreur de page (test `serveur-mise-a-jour-production`). Sans l'une ni l'autre, la page dit que la référence manque. Rien de cela en `SITE_MODE=prod` ni en version portable.
- Le domaine « Autres tables » compare les tables de contenu hors fiches, journal, notes, `lien`, `lien_candidat`, `page_fts`, `entite_fts`. Il ignore les lignes des pages `example` (`lib/notes-de-version.mjs#autresSansExemples`) et ne compte pas dans `aLivrer` (`lignesALivrer`) tant que `scripts/mise-a-jour-regles.mjs#lireTables` ne l'écrit pas dans la note.
- Hors ce domaine, la liste ne compare que les colonnes de `TABLES` (`lib/edition-modele.mjs`) ; une table nouvelle n'y est listée qu'avec sa définition (`DEFINITIONS`, `TABLES_LUES`).
- Rien de technique sur la page : le service fournit les textes (pas d'import de `TABLES`) ; chaque table et colonne par son vrai nom (demande du propriétaire), registre `lib/libelles-de-la-base.mjs`.
- Une couleur vient de R29 et de rien d'autre (`notes-de-version-sens.mjs`) ; tout cas douteux reste neutre. R29 fixe le sens (vert = amélioration, rouge = affaiblissement), pas les valeurs : `mise-a-jour.css` lit les jetons `--amelioration…` et `--affaiblissement…` (skill `ui-couleurs-theme`). Les feuilles n'écrivent aucune couleur (voile des dialogues : un noir de mélange).
- Le détail mot à mot (`notes-de-version-rendu.mjs#diffMots`, aussi celui des conflits) garde une balise du glossaire entière dans un seul morceau, espaces intérieurs compris : coupée entre deux `<ins>`, le middleware la laisserait brute (R164 ; tests `notes-de-version`, `conflits-rendu`, `site-html`).
- La rubrique « Mots-clés » nomme un mot-clé par son libellé ; des synonymes ou catégories changés y font une ligne « Synonymes » ou « Catégories ». Une note publiée reste telle quelle (R232 (12), « Orios (classe) » compris).
- Les domaines sont ceux du CHECK de `note_version_ligne.domaine` (`data/schema.sql`) ; un domaine nouveau demande une migration.
- Une page du guide sans place dans le plan se range sous « Pages retirées », après le Guide du MJ (`placeDeLaPage` ; un changement de `livres.mjs#PAGES_RETIREES` ou de `rubrique: null` : `leader-technique`). Le plan est celui de la base de dev (tables `regles_onglet*`, skill `zone-guide`) : `noteEnPreparation` et `scripts/mise-a-jour-regles.mjs` l'installent avant `comparerBases`. Une entité inchangée n'est jamais rangée (test `notes-de-version`).
- Un lot en attente sur une page découpée ou retitrée (R184) donne un conflit `colonnes` : garder le lot remettrait le texte déplacé en double.
- La note en préparation retire les lots gardés non résolus (fusion à trois voies, skill `zone-edition-rejeu`) et leurs lots retenus : elle ne montre que ce qui partira ; ils y reviennent après la résolution (réponse du propriétaire « Les retirer »). `notes-de-version.mjs#tablesQuiPartiront` ; `en_attente` ne compte pas les retenus.
- Plan des Règles et ordre des races (skill `zone-edition-menus`), en lignes de la note : « Ordre du menu » (une par onglet dont l'ordre change, de la première à la dernière place qui diffère ; `comparerPlanDesRegles`), « Onglet : X → Y » (page déplacée dans un autre onglet) et « Ordre de la liste » (races, `comparerOrdreDesRaces` ; `rang_liste` n'est pas listé race par race). Une entrée ajoutée ou retirée est dite par sa page.
- `detail` : une ligne qui n'existe qu'avec une autre (rubrique, butin) n'est listée que pour un champ modifié. `resume` : un contenu absent de la production tient en une ligne.
- `scripts/mise-a-jour-regles.mjs` refuse d'écrire un fichier de `data/rows` hors des tables du journal et de la note (`TABLES_DE_LA_NOTE`), plus celles que le rejeu écrit en plus (`tablesCompletees`) : un fichier autre que l'exporteur l'écrit bloque une mise à jour.
- Nature des traces (R275, migration 0127) : l'historique que `scripts/mise-a-jour-regles.mjs` écrit reprend la nature et la décision du lot ; `verifierLot` refuse une nature inconnue ou un numéro mal placé (`natureDuLot`, code 2).
- `scripts/mise-a-jour-github.mjs#tablesDuLot` (liste blanche du commit) recopie la règle de `tablesCompletees` (skill `zone-edition-rejeu`).
- Une vraie mise à jour retire les notes `exemple = 1`.
- `[V: X+1]` n'est jamais repris d'un texte (PR, commentaires : `neutraliserMarqueur`) ; il n'est posé que dans le titre de la PR de livraison d'un lot `majeure` (`titreLivraison`), et la livraison s'arrête si la PR et le lot ne s'accordent pas (`desaccordMajeure`). La note du lot est alors la X+1.0 (`versionDeLivraison(…, { majeure })`).
- Le job `preparer` lance `npm test` après avoir écrit la note du lot dans `data/rows` ; le job CI `simulation-de-mise-a-jour` applique un lot synthétique puis les mêmes `CONTROLES` (épinglés par `mise-a-jour-simulation`). Seul le lot du lancement actuel est servi au workflow (`lireLot`, sinon `410`) ; un suivi en retard n'écrase jamais un état plus récent.
- « terminé » se pose au succès du run ; l'attente de l'installation passe par la référence (version de `_serveur/version.json` de la production, repli : copie de master). Lancement `manuel` : `docs/serveur.md`.

## Tests
- `notes-de-version`, `notes-de-version-sens`, `serveur-notes-de-version`, `serveur-mise-a-jour-etats`, `serveur-mise-a-jour-production` (référence), `mise-a-jour`, `mise-a-jour-regles`, `mise-a-jour-github`, `mise-a-jour-simulation`, `mise-a-jour-script` (script de la page en faux navigateur), `mise-a-jour-etat-production` (choix de l'affichage). Conflits : skill `zone-mise-a-jour-conflits`.
- `test/site-html.test.mjs` : la page construite égale les notes de la base, sans `style=` ni feuille de palette.
- `lots-rendu` (module pur), `mise-a-jour-lots` (le script, en faux navigateur), `lots-rendu-service` (sur un vrai lot du service).
- `test/palette-css.test.mjs` : aucune couleur écrite dans la zone (`lots-rendu` compris), jetons lisibles dans les deux thèmes, 3 dialogues `nv-dialogue` dans le script.

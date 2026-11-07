---
name: zone-guide
description: "Pages du guide : Découvrir, les 4 onglets des Règles (plan lu dans la base, lib/livres.mjs, plan-des-regles-db.mjs), Guide du MJ, Artisanat, anciennes adresses, blocs <!-- guide:… -->. À charger avant de lire, modifier ou relire ce code ou ces pages."
paths: ["client/src/lib/livres.mjs", "client/src/lib/plan-des-regles-db.mjs", "client/src/lib/guide*.mjs", "client/src/lib/guide-rendu.ts", "client/src/components/guide/**", "client/src/pages/decouvrir/**", "client/src/pages/regles/**", "client/src/pages/mj/**", "client/src/styles/guide/**", "client/src/scripts/edition/guide.mjs", "client/test/livres.test.mjs", "client/test/guide*.test.mjs", "client/test/serveur-edition-guide.test.mjs", "client/test/plan-des-regles-db.test.mjs", "client/test/db-r184-plan-des-regles.test.mjs", "data/migrations/0064-guide-sans-chapitres*", "data/migrations/0091-r184*"]
user-invocable: false
---
# Pages du guide

## Fichiers

- `client/src/lib/livres.mjs` : sans import, sans couleur (il entre dans la chaîne de l'édition du navigateur), testé. Il écrit Découvrir (`DECOUVRIR`), le Guide du MJ, l'Artisanat, `PARTIES`, `PAGES_DE_LA_CREATION`, `PAR_OU_COMMENCER`, `LIENS_ET_RENCONTRE` (skill `zone-accueil`), `NOMS_RESERVES` et les renvois figés (section « Anciennes adresses »). L'adresse d'une page ne vient que de `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`. `PARTIES` garde `plus-loin` (migration 0064, `test/guide-sans-chapitres.test.mjs`). Le plan des onglets lui est installé (`installerLePlan`).
- `lib/plan-des-regles-db.mjs#chargerPlanDesRegles` : lit le plan dans la base. `lib/parties-couleurs.mjs` : la couleur de chaque partie (skill `ui-couleurs`).
- `lib/guide.mjs` (`BLOCS`, `adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `avecPrefixe`), `lib/guide-db.mjs` (tableaux des blocs), `lib/guide-fil-rouge.mjs` (personnages fil rouge), `lib/guide-rendu.ts`.
- `components/guide/` (`PageDuGuide`, `PageDuPlan`, `MenuLateral`, `Sommaire`, `GuideBloc`) ; pages : `pages/decouvrir/`, `pages/regles/` (dont `artisanat.astro`), `pages/mj/`.
- Styles : `styles/guide/blocs.css`, `styles/guide/menu-lateral.css` (partagée avec `MenuDesRaces.astro` : un changement du menu change aussi celui des races, skill `zone-races`).

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires ».
- `docs/sql/a-valider.md` §6 (écarts original ↔ base), §8 (points ouverts de R184).
- Texte d'une page : skill `modifier-une-page-wiki`. Menu : `zone-menu`. Accueil, liens Discord et Tipeee, annonce : `zone-accueil`. Adresses et `[[liens]]` : `site-wiki-liens`. Éditeur en place : `zone-edition`. Mots-clés : `zone-mots-cles`. Tables du plan : `base-sqlite`. Lot de mise à jour : `zone-mise-a-jour`.

## Le plan du site

- Chaque page est une page simple (`PageDuGuide.astro`) : fil d'Ariane (`filDAriane`), titre, texte, blocs, mots-clés. Jamais de flèches, ← →, glissement, pagination ni numéro de chapitre (retour arrière au glissement empêché partout : `styles/global/base.css`, skill `ui-defilement`).
- Aucun rétrolien, `PiedDePage.astro` ne garde que les mots-clés (skill `site-wiki-liens`). Aucune source sous une page (G43) ; `sources:` reste dans la base, que `/archives/` lit (skill `zone-archives`).
- **Découvrir** (`DECOUVRIR`) : Bienvenue (`/decouvrir/`) et L'univers (`/decouvrir/l-univers/`) ; sous L'univers, les rubriques Races, Magies, Classes (`RUBRIQUES_SOUS_LA_PAGE`). Ni « Liens » ni « Rejoindre une partie » : `/decouvrir/liens/` et `/decouvrir/rejoindre-une-partie/` donnent la 404 (`test/livres.test.mjs`, `test/site-html.test.mjs`).
- **Les 4 onglets des Règles** (R184, R185, migration 0091) : Fiche de personnage, Mécaniques générales, Les combats, Exploration, après Découvrir et L'univers dans le menu (skill `zone-menu`). Ni onglet « Autre », ni « Les bases », « Règles avancées », « Créer son personnage » (R184 (1), R185 (7)).
  - **Le plan est une donnée de la base** (tables `regles_onglet` et `regles_onglet_entree`, skill `base-sqlite`), jamais écrit dans le code. L'installent `lib/wiki.ts` au build et, hors build, `serveur/notes-de-version.mjs#noteEnPreparation` et `scripts/mise-a-jour-regles.mjs` (skill `zone-mise-a-jour`) ; sans plan installé, une fonction qui en a besoin lève une erreur. Le site de dev le modifie (skill `zone-edition-menus`) ; une entrée installée garde l'`id` et le `rang` de sa ligne.
  - **Une entrée de page ne porte que l'id de la page** ; son libellé est le titre de la page. Une page existante garde son titre (retitrée si la découpe le rend faux, l'ancien titre en alias) ; une page nouvelle prend les mots de la puce du propriétaire (R184 (2)). Autres entrées : un lien `{ libelle, adresse }` (l'Artisanat, dans Exploration) et une entrée « bientôt » grisée.
  - **Adresses à plat** : toute page d'un onglet est à `/regles/<slug>/`, sans le plan (`adresseDuGuide`), car la chaîne de l'édition du navigateur, qui ne le reçoit pas, la calcule aussi. `/regles/<onglet>/` montre la page d'ouverture de l'onglet, `/regles/` celle du premier, avec un `<link rel="canonical">` vers `/regles/<slug>/` (`PageDuPlan.astro`). Les ids des onglets, `artisanat`, `avancees` et `glossaire` (la page Glossaire) sont réservés (`nomsReserves`).
  - **Plan strict** : `verifierLePlan` arrête le build sur une page nommée absente, d'exemple, nommée deux fois, absorbée, retirée ou supprimée mais revenue sans place, ou sur **toute page `guide/` non d'exemple qui n'est rangée nulle part**. Une page se range par une ligne de `regles_onglet_entree` (le site de dev ou une migration), jamais par le code.
  - **Menu latéral** (`MenuLateral.astro`, `menuLateralDe`) : comme la chronologie, une seule liste sans titres de groupe, la page à droite en `<slot />`, replié (`<details>`) sous 56rem et ouvert sans JavaScript. Mode modification : `editionDuMenuLateral` pose `data-ed-menu` (`onglet:<id>`, `races`) sur la liste et `data-ed-entree`, `data-ed-rang`, `data-ed-groupe` (races) sur les entrées, sans changer l'affichage ; l'Artisanat aussi (son menu, pas son sommaire). L'entrée du menu du site est marquée par `entree` de `Base.astro`, tirée du plan.
  - Ni badge « Guide » ni « Aussi appelé » (seul le Guide du MJ les a : `reference`).
  - **Couleurs** : Découvrir garde sa partie, l'introduction et les 6 étapes de la création (`PAGES_DE_LA_CREATION`) prennent `creer` ; toute autre page d'un onglet prend l'accent du site. `PageDuGuide.astro` pose sur `.guide-reference` le repère `.guide-reference--couleur` et la classe du mot-clé coloré qui mène à la page (skill `zone-mots-cles-liens`), sinon `.couleur-partie-<id>` (`palette-css.mjs#classeDePartie` ; feuille des parties émise pour elle seule), jamais un style ; `blocs.css` lit `--guide` et `--guide-sur` sur ce repère, quelle que soit la famille (skill `ui-couleurs`). Les enfants directs remettent `--couleur` et `--couleur-texte` à `initial` (`:where()`) : un bloc sans classe propre garde son repli.
  - `--guide-texte` (intertitres, termes, nom du fil rouge) mêle la couleur de la partie à 10 % de noir en thème clair (le vert reste sous 4,5:1 ; choix « Comme les cartes du fil rouge »). Le thème sombre ne change pas.
- **Les 6 étapes de la création** sont de nouveau des pages (ids repris), avec l'introduction `guide/creer-son-personnage`, en tête de la Fiche de personnage ; la 3e carte de l'accueil y mène (skill `zone-accueil`).
- **Guide du MJ** : sommaire `/mj/`, pages à `/mj/<slug>/`. **Artisanat** (`ARTISANAT`) : sommaire `/regles/artisanat/`, entrée lien d'Exploration ; Composants reste dans l'Équipement (R185 (9)).
- `[slug].astro` ne construit aucune page du guide (`estServieASonId`).

## Anciennes adresses et anciens liens

- Renvois figés (listes, jamais un préfixe deviné), servis par la page 404 (`lib/metiers.mjs#renvoisDuGuide`) et par les liens Markdown écrits (`guide.mjs#adresseDesAnciensLiens`, `guide-rendu.ts`) ; requête et ancre écrites gardées. Un lien écrit garde son adresse en `data-lien-ecrit`, que l'éditeur relit (`markdown-edition.mjs#versMarkdown`).
  - `ADRESSES_DU_PLAN_PRECEDENT` : `/regles/avancees/` (vers `guide/le-mode-hyper`) et chaque `/regles/avancees/<slug>/`, les six étapes `/decouvrir/<étape>/`, `/decouvrir/campagne-ou-scenario-one-shot/`.
  - `PAGES_ECLATEES_DU_GUIDE` (`pagesEclateesDuGuide(existe)` retire les cibles absentes : sans cible, 404 ; même format que `RENVOIS_DES_PAGES_ECLATEES` de l'équipement, skill `zone-equipement` ; `data-eclatees`) : `/decouvrir/creer-son-personnage/` (chaque étape et sous-intertitre à sa page, le reste à l'introduction) et « Les situations avancées » (chaque section à sa page, le reste à la tenaille ; l'ancre `#les-boss-et-leurs-postures` mène à `/regles/les-postures/#les-boss`).
  - `PAGES_ABSORBEES` (`le-jeu-de-role` dans Bienvenue, `resistance-faiblesse-magie` dans Résistances et faiblesses, `situations-avancees` dans la prise en tenaille) ; `ANCRES_DES_PAGES_ABSORBEES` mène à l'intertitre où se lit le contenu, comparé aux intertitres (`test/livres.test.mjs`) et au site construit.
  - `livres.mjs#PAGES_RETIREES` : le Lexique, devenu des mots-clés (R183), `/regles/lexique/` et `/guide/lexique/` mènent au Glossaire, `/regles/glossaire/` (R190) (`adresseDeLaPageRetiree`).
  - `PAGES_SUPPRIMEES` (8 pages : R184 (9), migration 0094, R187 (1), R185 (6)) : 404 sans renvoi ; `verifierLePlan` arrête le build si l'une revient. Elle sort de `ANCIENNES_REGLES_AVANCEES`. Les tests comparent un segment d'adresse (`aPourSegment`), pas une sous-chaîne.
- La cible d'un renvoi peut être supprimée sur le site de dev (R185 (6)) ; `lib/pages-protegees.mjs` (seule source de la protection, skill `zone-edition-menus`) protège les pages des listes de `livres.mjs` : `PAGES_DE_LA_CREATION`, `PAR_OU_COMMENCER`, `PAGES_ABSORBEES`, `RUBRIQUES_SOUS_LA_PAGE`.
- `nav.mjs` n'importe pas `livres.mjs` : la page 404 reçoit les renvois au build (`data-renvois`).
- Le texte de la base n'est réécrit ni au rendu ni à la modification (`test/markdown-edition.test.mjs`).

## Blocs tirés de la base

- Une ligne `<!-- guide:<bloc> -->` (`BLOCS`) remplace le bloc par `GuideBloc.astro`. Jamais de tableau recopié ; chaque bloc appelé une fois ; un marqueur inconnu arrête le rendu. Plus de bloc `sommaire`, `magies` ni `documents` (sa page est supprimée).
- `mode-hyper` (`guide-db.mjs#chargerModeHyper`, sous « Ce qu'il donne » de `guide/le-mode-hyper`, R187 (2)) : deux tableaux sans intitulé. Magies, lecture `onglet_magie` : « Magie | Mono-Magie | Bi-magie », la « Forme Complète » du Potentiel Illimité en `colspan=2`. Races, lecture `onglet_race` : « Race | Capacité | Effet ». Les noms viennent de `magie.nom` et `race.nom` (nom du site, lien vers la page), pas de `libelle` (choix du leader-technique) ; les effets passent par `rendreLigne`.
- `relations-des-magies` : le tableau de `/magies/#relations`, même composant (skill `zone-magies`), dans « Résistances et faiblesses » (R185 (4)).
- Fil rouge (`lib/guide-fil-rouge.mjs`) : leurs choix seulement, les chiffres sont calculés. Un bloc se pose sous l'intertitre `##` qu'il illustre ; ses personnages sont des `h3`.
- `magie-bonus`, caractéristiques, postures : classe de la palette (`couleur-magie-<id>`, `couleur-caracteristique-<id>`, `couleur-posture-<id>`), jamais un style ; `blocs.css` en tire `--c`. Le bloc `postures` émet lui-même la feuille des postures (`cssDesFamilles(['posture'])`).

## Textes

- Les pages de Découvrir et de l'ancien guide sont réécrites d'après la base, les originaux et les décisions (demande du propriétaire) ; écarts dans `docs/sql/a-valider.md` §6, rien d'appliqué (R83). Aucun chiffre d'un bloc n'y est recopié.
- La découpe en onglets **déplace le texte tel quel** (R184 (1)). Une phrase rendue fausse perd son bout faux (« plus haut », « sur cette page ») ou prend un lien vers la page qui porte le texte (R184 (5)).
- Le code en lit quelques-unes (`## La ceinture`, « case Entraînement »…) : les garder (`docs/content-guide.md`).

## Tests

- `test/livres.test.mjs`, `test/guide.test.mjs`, `test/guide-html.test.mjs` épinglent le plan (skill `tests-conventions`).
  - Le plan et les renvois s'épinglent sur l'état d'import (`aide-base-d-import.mjs`) ; un test final « aujourd'hui » garde les invariants de la base courante (le plan tient, une place par page, un renvoi mène à une page servie ou à la 404).
  - Les blocs `<!-- guide:… -->` : leur place se lit dans l'état des migrations (`baseDImport({ garder: lotsAvant('0093') })`) ; sur l'état courant, seulement « un bloc au plus une fois ».
  - R149 (4 points, 5 dés) est épinglé par le moteur (`maitriseDArme`), la phrase des pages « Caractéristiques et compétences » et « L'équipement » et du mot-clé `maitrise-darme` lue à l'import. Le tarif du chakra manquant (R18, R186 : 3 santé ; tout coût en santé ignore la barrière) est lu dans `finaliser-son-personnage`, `la-magie-en-jeu`, `le-mode-hyper`, `le-mode-hyper-100`, `les-degats` et le mot-clé `chakra`, tels que la 0093 les a laissés (`fixtures/lots-avant-0093.json`).
- Les textes que les migrations 0104 et 0107 réécrivent d'après R198 à R208 (postures, dégâts, Mode Hyper, butin, métiers) se lisent à l'état de la migration (`baseDImport({ garder: lotsAvant('0104') })`, `lotsAvant('0107')` : `db-r198-r208-textes-du-guide.test.mjs`). Un test qui lit une de ces pages avant elles accepte l'une ou l'autre écriture (`guide.test.mjs`) ; la phrase de `guide/le-mode-hyper` sur l'onglet masqué (P9, R200 (5)) est retirée par la 0104 (`db-retrait-liste-des-effets-mode-hyper`). Les copies de source ne sont pas réécrites, sauf « Prouesse » devenu « Calme » dans `guide/fiche-competences` (R204).
- `test/db-r184-plan-des-regles.test.mjs` (tables, ouverture, ids ; ses pages d'essai se choisissent dans le plan courant : le site change une page d'onglet), `test/plan-des-regles-db.test.mjs` (`chargerPlanDesRegles` ; l'ordre attendu se lit dans le plan d'import, le site réordonne les menus), `test/guide-sans-chapitres.test.mjs` (migration 0064), `test/markdown-edition.test.mjs`, `test/serveur-edition-guide.test.mjs`.
- `test/guide-mode-hyper.test.mjs` et `test/guide-html.test.mjs` (R187 (2) ; Bienvenue construite ; ni rétroliens ni sources dans dist/), `test/gabarits-sources.test.mjs` (aucun gabarit n'annonce de sources).

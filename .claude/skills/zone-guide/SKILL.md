---
name: zone-guide
description: "Pages du guide : Découvrir, les 4 onglets des Règles (plan lu dans la base, lib/livres.mjs, plan-des-regles-db.mjs), Guide du MJ, Artisanat, anciennes adresses, blocs <!-- guide:… -->. À charger avant de lire, modifier ou relire ce code ou ces pages."
paths: ["client/src/lib/livres.mjs", "client/src/lib/plan-des-regles-db.mjs", "client/src/lib/guide*.mjs", "client/src/lib/guide-rendu.ts", "client/src/components/guide/**", "client/src/pages/decouvrir/**", "client/src/pages/regles/**", "client/src/pages/mj/**", "client/src/styles/guide/**", "client/src/scripts/edition/guide.mjs", "client/test/livres.test.mjs", "client/test/guide*.test.mjs", "client/test/serveur-edition-guide.test.mjs", "client/test/plan-des-regles-db.test.mjs", "client/test/db-r184-plan-des-regles.test.mjs", "data/migrations/0064-guide-sans-chapitres*", "data/migrations/0091-r184*"]
user-invocable: false
---
# Pages du guide

## Fichiers

- `client/src/lib/livres.mjs` : sans import, sans couleur (il entre dans la chaîne de l'édition du navigateur), testé. Il écrit Découvrir (`DECOUVRIR`), le Guide du MJ, l'Artisanat, `PARTIES`, `PAGES_DE_LA_CREATION`, `PAR_OU_COMMENCER`, `LIENS_ET_RENCONTRE` (skill `zone-accueil`), `NOMS_RESERVES` et les renvois figés (section « Anciennes adresses »). L'adresse d'une page ne vient que de `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`. `PARTIES` garde `plus-loin`, que nomme le registre de la migration 0064 (`test/guide-sans-chapitres.test.mjs`). Le plan des onglets n'y est pas écrit : il lui est installé (`installerLePlan`).
- `lib/plan-des-regles-db.mjs#chargerPlanDesRegles` : lit le plan dans la base. `lib/parties-couleurs.mjs` : la couleur de chaque partie (skill `ui-couleurs`).
- `lib/guide.mjs` (`BLOCS`, `adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `avecPrefixe`), `lib/guide-db.mjs` (tableaux des blocs), `lib/guide-fil-rouge.mjs` (personnages fil rouge), `lib/guide-rendu.ts`.
- `components/guide/` : `PageDuGuide.astro`, `PageDuPlan.astro`, `MenuLateral.astro`, `Sommaire.astro`, `GuideBloc.astro`.
- Pages : `pages/decouvrir/[...page].astro`, `pages/regles/` (`index.astro`, `[...page].astro`, `artisanat.astro`), `pages/mj/`.
- Styles : `styles/guide/blocs.css`, `styles/guide/menu-lateral.css` (partagée avec `components/race/MenuDesRaces.astro` : un changement du menu change aussi celui des races, skill `zone-races`).
- Liens Discord et Tipeee, encart et annonce de l'accueil : skill `zone-accueil`.

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » : plan, menu latéral, couleurs, Artisanat, liens de l'accueil, anciennes adresses, blocs, textes, fil rouge, édition.
- `docs/sql/a-valider.md` §6 (écarts original ↔ base) et §8 (points ouverts de R184).
- Texte d'une page : skill `modifier-une-page-wiki`. Menu : `zone-menu`. Accueil, liens Discord et Tipeee, annonce : `zone-accueil`. Adresses et `[[liens]]` : `site-wiki-liens`. Éditeur en place : `zone-edition`. Mots-clés : `zone-mots-cles`. Tables du plan : `base-sqlite`. Lot de mise à jour : `zone-mise-a-jour`.

## Le plan du site

- Chaque page est une page simple (`PageDuGuide.astro`) : fil d'Ariane (`filDAriane`), titre, texte, blocs, mots-clés. Jamais de flèches, ← →, glissement, pagination ni numéro de chapitre (le retour arrière au glissement est empêché pour tout le site par `styles/global/base.css`, skill `ui-defilement`).
- Aucun rétrolien (« Cette page mentionne », « Mentionnée par » ; `PiedDePage.astro` ne garde que les mots-clés) : « Supprime ces colonnes de toutes les pages. Elles polluent l'affichage pour rien. » Aucune source sous une page (G43 : « Plus de sources ailleurs que dans les archives »). `sources:` reste dans la base, que `/archives/` lit (skill `zone-archives`).
- **Découvrir** (`DECOUVRIR`) : Bienvenue (`/decouvrir/`) et L'univers (`/decouvrir/l-univers/`) ; sous L'univers, les rubriques Races, Magies, Classes (`RUBRIQUES_SOUS_LA_PAGE`). Ni page « Liens » ni « Rejoindre une partie » : `/decouvrir/liens/` et `/decouvrir/rejoindre-une-partie/` donnent la 404, sans renvoi (`test/livres.test.mjs`, `test/site-html.test.mjs`).
- **Les 4 onglets des Règles** (R184, R185, migration 0091) : Fiche de personnage, Mécaniques générales, Les combats, Exploration, après Découvrir et L'univers dans le menu (skill `zone-menu`). Aucun onglet « Autre », ni « Les bases », « Règles avancées », « Créer son personnage » (R184 (1), R185 (7)).
  - **Le plan est une donnée de la base** (tables `regles_onglet` et `regles_onglet_entree`, skill `base-sqlite`), jamais écrit dans le code. Qui charge les pages l'installe : `lib/wiki.ts` au build ; hors build, `serveur/notes-de-version.mjs#noteEnPreparation` et `scripts/mise-a-jour-regles.mjs` (skill `zone-mise-a-jour`). Une fonction qui en a besoin sans plan installé lève une erreur. Pas encore modifiable sur le site de dev.
  - **Une entrée de page ne porte que l'id de la page** ; son libellé est le titre de la page. Une page existante garde son titre (retitrée si la découpe le rend faux, l'ancien titre en alias) ; une page nouvelle prend les mots de la puce du propriétaire (R184 (2)). Autres entrées : un lien `{ libelle, adresse }` (l'Artisanat, dans Exploration) et une entrée « bientôt » grisée.
  - **Adresses à plat** : toute page d'un onglet est à `/regles/<slug>/`, sans le plan (`adresseDuGuide`), car la chaîne de l'édition du navigateur, qui ne le reçoit pas, la calcule aussi. `/regles/<onglet>/` montre la page d'ouverture de l'onglet, `/regles/` celle du premier, avec un `<link rel="canonical">` vers `/regles/<slug>/` (`PageDuPlan.astro`). Les ids des onglets, `artisanat` et `avancees` sont réservés (`nomsReserves`).
  - **Plan strict** : `verifierLePlan` arrête le build sur une page nommée absente, d'exemple, nommée deux fois, absorbée, retirée ou supprimée mais revenue sans place, ou sur **toute page `guide/` non d'exemple qui n'est rangée nulle part**. Pour placer une page : une ligne de `regles_onglet_entree` (migration), jamais le code.
  - **Menu latéral** (`MenuLateral.astro`, `menuLateralDe`) : comme la chronologie, une seule liste sans titres de groupe, la page à droite en `<slot />`, replié (`<details>`) sous 56rem et ouvert sans JavaScript. Props `{ rubrique, pages, entry }` partagées avec les races. L'entrée du menu du site est marquée par `entree` de `Base.astro`, tirée du plan.
  - Pages sans badge « Guide » ni « Aussi appelé » (seul le Guide du MJ les a : `reference`).
  - **Couleurs** : Découvrir garde sa partie, l'introduction et les 6 étapes de la création (`PAGES_DE_LA_CREATION`, partie `creer`) la leur (défaut confirmé par le propriétaire) ; toute autre page d'un onglet prend l'accent du site (« Accent du site », réponse du 2026-11-05). Classe `.couleur-partie-<id>` (`palette-css.mjs#classeDePartie`) posée par `PageDuGuide.astro` sur `.guide-reference`, jamais un style ; `blocs.css` en tire `--guide` et `--guide-sur`, skill `ui-couleurs`. `partieDeLaPage` rend null ailleurs ; `Sommaire.astro` n'en pose aucune. Jamais un style (ni `--couleur-partie` ni `--sommaire-couleur`) ; les enfants directs de la page remettent `--couleur` et `--couleur-texte` à `initial` (`:where()`), pour qu'un bloc sans classe propre garde son repli.
  - `--guide-texte` (intertitres, termes, nom du fil rouge) mêle la couleur de la partie à 10 % de noir en thème clair : le vert #2e7d4f sur le fond fait 4,48:1 et sur la carte teintée 4,24:1, sous 4,5:1 (choix « Comme les cartes du fil rouge », réponses du 2026-10-23). Le thème sombre ne change pas.
- **Les 6 étapes de la création** sont de nouveau des pages (ids repris), avec l'introduction `guide/creer-son-personnage`, en tête de la Fiche de personnage ; la 3e carte de l'accueil y mène (skill `zone-accueil`).
- **Guide du MJ** : sommaire `/mj/`, pages à `/mj/<slug>/`. **Artisanat** (`ARTISANAT`) : sommaire `/regles/artisanat/`, entrée lien d'Exploration ; Composants reste dans l'Équipement (R185 (9)). `Sommaire.astro` : titre et résumé, sans couleur.
- `[slug].astro` ne construit aucune page du guide (`estServieASonId`).

## Anciennes adresses et anciens liens

- Renvois figés (listes, jamais un préfixe deviné), servis par la page 404 (`lib/metiers.mjs#renvoisDuGuide`) et par les liens Markdown écrits (`guide.mjs#adresseDesAnciensLiens`, `guide-rendu.ts`) ; requête et ancre écrites gardées. Un lien écrit garde son adresse en `data-lien-ecrit`, que l'éditeur relit (`markdown-edition.mjs#versMarkdown`).
  - `ADRESSES_DU_PLAN_PRECEDENT` : `/regles/avancees/` (vers `guide/le-mode-hyper`) et chaque `/regles/avancees/<slug>/`, les six étapes `/decouvrir/<étape>/`, `/decouvrir/campagne-ou-scenario-one-shot/`.
  - `PAGES_ECLATEES_DU_GUIDE` (même format que `RENVOIS_DES_PAGES_ECLATEES` de l'équipement, skill `zone-equipement` ; `data-eclatees`) : `/decouvrir/creer-son-personnage/` (chaque étape et sous-intertitre à sa page, le reste à l'introduction) et « Les situations avancées » (chaque section à sa page, le reste à la tenaille).
  - `PAGES_ABSORBEES` (`le-jeu-de-role` dans Bienvenue, `resistance-faiblesse-magie` dans Résistances et faiblesses, `situations-avancees` dans la prise en tenaille) ; `ANCRES_DES_PAGES_ABSORBEES` mène à l'intertitre où se lit le contenu, comparé aux intertitres (`test/livres.test.mjs`) et au site construit.
  - `livres.mjs#PAGES_RETIREES` : le Lexique, devenu des mots-clés (R183), `/regles/lexique/` et `/guide/lexique/` mènent à `/recherche/` (`adresseDeLaPageRetiree`).
  - `PAGES_SUPPRIMEES` (4 pages, R184 (9), R185 (6)) : 404 sans renvoi, comme « Rejoindre une partie » ; `verifierLePlan` arrête le build si l'une revient.
- `nav.mjs` n'importe pas `livres.mjs` : la page 404 reçoit les renvois au build (`data-renvois`).
- Le texte de la base n'est réécrit ni au rendu ni à la modification (`test/markdown-edition.test.mjs`).

## Blocs tirés de la base

- Une ligne `<!-- guide:<bloc> -->` (`BLOCS`) remplace le bloc par `GuideBloc.astro`. Jamais de tableau recopié ; chaque bloc appelé une fois ; un marqueur inconnu arrête le rendu. Plus de bloc `sommaire`, `magies` ni `documents` (sa page est supprimée).
- `relations-des-magies` : le tableau de `/magies/#relations`, même composant (skill `zone-magies`), dans « Résistances et faiblesses » (R185 (4)).
- Fil rouge (`lib/guide-fil-rouge.mjs`) : leurs choix seulement, les chiffres sont calculés. Un bloc se pose sous l'intertitre `##` qu'il illustre ; ses personnages sont des `h3`.
- `magie-bonus`, caractéristiques, postures : classe de la palette (`couleur-magie-<id>`, `couleur-caracteristique-<id>`, `couleur-posture-<id>`), jamais un style ; `blocs.css` en tire `--c`. Le bloc `postures` émet lui-même la feuille des postures (`cssDesFamilles(['posture'])`).

## Textes

- Les pages de Découvrir et de l'ancien guide sont réécrites de zéro d'après la base, les originaux et les décisions (demande du propriétaire) ; écarts consignés dans `docs/sql/a-valider.md` §6, rien d'appliqué (R83). Aucun chiffre d'un bloc n'y est recopié.
- La découpe en onglets **déplace le texte tel quel** (R184 (1)). Une phrase rendue fausse perd son bout faux (« plus haut », « sur cette page ») ou prend un lien vers la page qui porte le texte (R184 (5)).
- Le code en lit quelques-unes (`## La ceinture`, « case Entraînement »…) : les garder (`docs/content-guide.md`, « Les textes de Découvrir et des Bases »).
- Une page ajoutée à la main a une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse et `db:export-pages` efface le `.md`.

## Tests

- `test/livres.test.mjs`, `test/guide.test.mjs`, `test/guide-html.test.mjs` épinglent le plan. `test/guide.test.mjs` épingle aussi le plafond de maîtrise d'arme (4 points, 5 dés, R149) dans deux pages (« Caractéristiques et compétences », « L'équipement ») et le mot-clé `maitrise-darme`.
- `test/db-r184-plan-des-regles.test.mjs` (tables, ouverture, ids), `test/plan-des-regles-db.test.mjs` (`chargerPlanDesRegles`), `test/guide-sans-chapitres.test.mjs` (migration 0064), `test/markdown-edition.test.mjs`, `test/serveur-edition-guide.test.mjs`.
- `test/guide-html.test.mjs` (Bienvenue construite ; aucune page de dist/ n'a de rétroliens ni de sources), `test/gabarits-sources.test.mjs` (aucun gabarit n'annonce de sources sous une page).

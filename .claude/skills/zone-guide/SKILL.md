---
name: zone-guide
description: "Pages du guide (plan lib/livres.mjs : Découvrir, Les bases, Règles avancées, Guide du MJ, Artisanat), page Liens et table annonce, anciens liens /guide/, blocs <!-- guide:… --> tirés de la base, textes réécrits. À charger avant de lire, modifier ou relire ce code ou ces pages."
paths: ["client/src/lib/livres.mjs", "client/src/lib/guide*.mjs", "client/src/lib/guide-rendu.ts", "client/src/lib/annonces.mjs", "client/src/components/guide/**", "client/src/pages/decouvrir/**", "client/src/pages/regles/**", "client/src/pages/mj/**", "client/src/styles/guide/**", "client/src/styles/liens/**", "client/src/scripts/edition/annonces.mjs", "client/src/scripts/edition/guide.mjs", "client/test/livres.test.mjs", "client/test/guide*.test.mjs", "client/test/*annonces.test.mjs", "client/test/serveur-edition-guide.test.mjs", "data/migrations/0064-guide-sans-chapitres*", "data/migrations/0068-annonces*"]
user-invocable: false
---
# Pages du guide, page Liens et annonces

## Fichiers

- `client/src/lib/livres.mjs` : le plan du site, sans import, testé. Range les pages `guide/…` (famille `docs`, ids inchangés) et leur donne leur adresse. Constantes : `DECOUVRIR`, `LES_BASES`, `PARTIES`, `PAGES_ABSORBEES`, `ANCRES_DES_PAGES_ABSORBEES`, `ADRESSES_DU_PLAN_PRECEDENT`, `ARTISANAT`, `LIENS`, `PAR_OU_COMMENCER`, `RUBRIQUES_SOUS_LA_PAGE` ; fonctions `adresseDuGuide`, `filDAriane`, `couleurDeLaPage`, `verifierLePlan`.
- `lib/guide.mjs` (`BLOCS`, `adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `pagesDeReference`, `avecPrefixe`), `lib/guide-db.mjs` (tableaux des blocs), `lib/guide-fil-rouge.mjs` (personnages fil rouge), `lib/guide-rendu.ts`, `lib/annonces.mjs`.
- `components/guide/` : `PageDuGuide.astro`, `PageDuPlan.astro`, `Sommaire.astro`, `GuideBloc.astro`.
- Pages : `pages/decouvrir/` (`[...page].astro`, `liens.astro`), `pages/regles/` (`index.astro`, `[...page].astro`, `artisanat.astro`, `avancees/index.astro`), `pages/mj/`.
- Styles : `styles/guide/blocs.css` (couleurs des pages et blocs), `styles/liens/liens.css`.
- Édition : `src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE`.

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » : plan, rubriques, couleurs, sommaires, Artisanat, page Liens, pages fusionnées, anciennes adresses, blocs, textes de Découvrir et des Bases, personnages fil rouge, édition sur le site de dev.
- `docs/sql/a-valider.md` §6 : écarts original ↔ base relevés par la réécriture, et G36 (présentation Tipeee).
- `docs/sources.md`, « Tipeee ».
- Modifier le texte d'une page : skill `modifier-une-page-wiki`. Menu : skill `zone-menu`. Accueil et cartes « Par où commencer ? » : skill `zone-accueil`. Adresses et `[[liens]]` : skill `site-wiki-liens`. Éditeur en place et Markdown sûr : skill `zone-edition`. Balises du glossaire : skill `zone-mots-cles`. Lot de mise à jour : skill `zone-mise-a-jour`.

## Le plan du site

- Plus de livre (demande du propriétaire : « éclater le guide », puis retirer le glissement, les flèches suivant / précédent et la pagination). Chaque page est une page simple (`PageDuGuide.astro`) : fil d'Ariane (`filDAriane`), titre, texte et blocs, mots-clés, rétroliens.
- Jamais : flèches, touches ← →, glissement du doigt, pagination, numéro de chapitre, `overscroll-behavior-x`.
- Les sources sous le texte ne s'affichent que pour une page de référence. Les pages de Découvrir et des Bases gardent `sources:` dans le frontmatter ; les montrer attend la réponse du propriétaire (`docs/sql/a-valider.md` §6).
- L'adresse d'une page du guide ne vient que du plan : `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`.
  - Découvrir (`DECOUVRIR`) : une page par entrée du menu (Bienvenue, L'univers, Créer son personnage, Rejoindre une partie). Bienvenue est à `/decouvrir/`, les autres à `/decouvrir/<slug>/`. Puis « Liens », `/decouvrir/liens/`.
  - Les bases (`LES_BASES`) : un sommaire à `/regles/` (`pages/regles/index.astro`), trois groupes ; pages à `/regles/<slug>/`.
  - Guide du MJ : sommaire `/mj/`, pages à `/mj/<slug>/`.
  - Toute autre page `guide/…` : Règles avancées, sommaire `/regles/avancees/` en groupes, pages à `/regles/avancees/<slug>/` (groupe « Autres pages de référence » si le plan ne la nomme pas).
  - Artisanat : `/regles/artisanat/` (`ARTISANAT`).
  - Plus rien sous `/guide/`.
- Trois sommaires (`components/guide/Sommaire.astro` : titre et résumé de chaque page) : Les bases, Règles avancées, Guide du MJ.
- `[slug].astro` ne construit aucune page du guide (`estServieASonId`).
- Plus de frontmatter `chapitre` ni `partie` (migration `0064-guide-sans-chapitres`). L'ordre et les couleurs des groupes sont dans le plan (`PARTIES`, aussi les couleurs des zones de la fiche ; `couleurDeLaPage`).
- `verifierLePlan` arrête le build sur une page nommée absente, d'exemple, nommée deux fois, ou fusionnée dans une autre (`PAGES_ABSORBEES` : Le jeu de rôle dans Bienvenue, les six étapes dans Créer son personnage) et revenue.
- Pour placer une page : la nommer dans `lib/livres.mjs`. `livres.mjs` n'écrit que des libellés de navigation ; seule exception, les présentations de la page Liens.

## Anciennes adresses et anciens liens

- Les anciennes adresses (`/guide/<slug>/`, `/decouvrir/<slug>/`) et celles du plan précédent (`ADRESSES_DU_PLAN_PRECEDENT`) mènent à la page qui les a par la page 404 (`lib/metiers.mjs#renvoisDuGuide`). Une page fusionnée mène à l'intertitre où se lit son contenu (`ANCRES_DES_PAGES_ABSORBEES`, comparées aux intertitres et au site construit).
- `livres.mjs` entre dans la chaîne de l'édition (par `metiers.mjs`), chargée aussi sur la page 404. Donc `nav.mjs` ne l'importe pas : la page 404 reçoit les renvois au build (`data-renvois`).
- Un lien Markdown écrit vers `/guide/<slug>/` mène à la nouvelle adresse au rendu (celle de la page qui absorbe une page fusionnée) : `guide.mjs#adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `guide-rendu.ts`. Il garde l'adresse écrite en `data-lien-ecrit`, que l'éditeur relit (`markdown-edition.mjs#versMarkdown`, gardée par `htmlSur`).
- Le texte de la base n'est réécrit ni au rendu ni quand on modifie la page (`test/markdown-edition.test.mjs`).

## Blocs tirés de la base

- Les tableaux viennent de la base par une ligne `<!-- guide:<bloc> -->` (`BLOCS`), sur toute page du guide. Jamais recopiés dans le texte ; chaque bloc appelé une fois ; plus de bloc `sommaire` (un marqueur inconnu arrête le rendu).
- Les personnages fil rouge (`lib/guide-fil-rouge.mjs`) : leurs choix seulement ; les chiffres sont calculés.

## Ajouter une page à la main

- Elle doit avoir une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse, et `db:export-pages` efface alors le `.md`. Vérifier la sortie de `db:sync-pages` avant d'exporter.

## Textes de Découvrir et des Bases

- Les seize pages de Découvrir et des Bases, « Le Mode Hyper et le Mode Super » et les présentations de la page Liens sont réécrits de zéro (demande du propriétaire), d'après la base, les originaux des deux Docs et les décisions.
- Les écarts original ↔ base relevés sont dans `docs/sql/a-valider.md` §6 ; rien n'en est appliqué (R83).
- Aucun chiffre d'un bloc n'y est recopié.
- Le code lit quelques-unes de leurs phrases (`## La ceinture`, « case Entraînement »…) : les garder en modifiant ces pages. Liste complète : `docs/content-guide.md`, « Les textes de Découvrir et des Bases ».

## Page Liens et annonces

- `pages/decouvrir/liens.astro` : fil d'Ariane vers Découvrir, puis chaque lien sous un `h2` avec sa présentation (`LIENS.liens[].presentation`, une constante écrite dans le plan ; ni modifiable sur le site de dev ni cherchée ; vide : rien ne s'affiche).
- La présentation Tipeee est tirée de sa propre page, lue le 2026-10-18 (`docs/sources.md`), à valider (`a-valider.md` G36).
- Puis l'encart « Notre prochaine rencontre IRL » (`LIENS.rencontre`, titre fixe) : l'annonce de la table `annonce` (migration `0068-annonces`, `lib/annonces.mjs`). NULL affiche « Aucune rencontre annoncée pour le moment. ».
- Modifiable en place sur le site de dev (`src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE` : Markdown sûr, balises canoniques).
- Livrée par la mise à jour (`scripts/mise-a-jour-regles.mjs#TEXTES_EN_MARKDOWN`, note de version domaine `guide`), ressource `/api/v1/annonces/`.
- Ni création ni suppression d'annonce.

## Tests

- `test/livres.test.mjs`, `test/guide.test.mjs`, `test/guide-html.test.mjs` épinglent le plan.
- `test/guide-sans-chapitres.test.mjs` (migration 0064), `test/markdown-edition.test.mjs` (aller-retour et `data-lien-ecrit`), `test/serveur-edition-guide.test.mjs`.
- `test/serveur-edition-annonces.test.mjs`, `test/edition-annonces.test.mjs`.

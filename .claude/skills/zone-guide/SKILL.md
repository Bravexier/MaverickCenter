---
name: zone-guide
description: "Pages du guide (plan lib/livres.mjs : Découvrir, Les bases, Règles avancées, Guide du MJ, Artisanat), sous Bienvenue les liens Discord et Tipeee (texte repris de Tipeee) et la table annonce, anciens liens /guide/, blocs <!-- guide:… --> tirés de la base, textes réécrits. À charger avant de lire, modifier ou relire ce code ou ces pages."
paths: ["client/src/lib/livres.mjs", "client/src/lib/guide*.mjs", "client/src/lib/guide-rendu.ts", "client/src/lib/annonces.mjs", "client/src/components/guide/**", "client/src/pages/decouvrir/**", "client/src/pages/regles/**", "client/src/pages/mj/**", "client/src/styles/guide/**", "client/src/scripts/tipeee.mjs", "client/src/scripts/edition/annonces.mjs", "client/src/scripts/edition/guide.mjs", "client/test/livres.test.mjs", "client/test/guide*.test.mjs", "client/test/*annonces.test.mjs", "client/test/serveur-edition-guide.test.mjs", "client/test/tipeee-script.test.mjs", "client/test/texte-en-place-barres.test.mjs", "data/migrations/0064-guide-sans-chapitres*", "data/migrations/0068-annonces*"]
user-invocable: false
---
# Pages du guide, sous Bienvenue (liens, Tipeee) et annonces

## Fichiers

- `client/src/lib/livres.mjs` : le plan du site, sans import, testé. Range les pages `guide/…` (famille `docs`, ids inchangés) et leur donne leur adresse. Constantes : `DECOUVRIR`, `LES_BASES`, `PARTIES`, `PAGES_ABSORBEES`, `ANCRES_DES_PAGES_ABSORBEES`, `ADRESSES_DU_PLAN_PRECEDENT`, `ARTISANAT`, `SOUS_BIENVENUE`, `NOMS_RESERVES`, `PAR_OU_COMMENCER`, `RUBRIQUES_SOUS_LA_PAGE` ; fonctions `adresseDuGuide`, `filDAriane`, `couleurDeLaPage`, `verifierLePlan`.
- `lib/guide.mjs` (`BLOCS`, `adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `pagesDeReference`, `avecPrefixe`), `lib/guide-db.mjs` (tableaux des blocs), `lib/guide-fil-rouge.mjs` (personnages fil rouge), `lib/guide-rendu.ts`, `lib/annonces.mjs`.
- `components/guide/` : `PageDuGuide.astro`, `PageDuPlan.astro`, `Sommaire.astro`, `GuideBloc.astro`, `SousBienvenue.astro` (sous le texte de Bienvenue).
- Pages : `pages/decouvrir/` (`[...page].astro` seulement : plus de page Liens), `pages/regles/` (`index.astro`, `[...page].astro`, `artisanat.astro`, `avancees/index.astro`), `pages/mj/`.
- Styles : `styles/guide/blocs.css` (couleurs des pages et blocs), `styles/guide/bienvenue.css` (liens et encart sous Bienvenue).
- Édition : `src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE`.
- Tipeee : `src/scripts/tipeee.mjs` (le script de Bienvenue), `lib/tipeee.mjs` (module pur), instantané `sources/tipeee/bienvenue.json` ; le service : skill `zone-service` (`serveur/tipeee.mjs`, `GET /api/tipeee/`).

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » : plan, rubriques, couleurs, sommaires, Artisanat, sous Bienvenue (liens, Tipeee, encart), pages fusionnées, anciennes adresses, blocs, textes de Découvrir et des Bases, personnages fil rouge, édition sur le site de dev.
- `docs/sql/a-valider.md` §6 : écarts original ↔ base relevés par la réécriture (G34, G36, G43 tranchés le 2026-10-22).
- `docs/sources.md`, « Tipeee ».
- Modifier le texte d'une page : skill `modifier-une-page-wiki`. Menu : skill `zone-menu`. Accueil et cartes « Par où commencer ? » : skill `zone-accueil`. Adresses et `[[liens]]` : skill `site-wiki-liens`. Éditeur en place et Markdown sûr : skill `zone-edition`. Balises du glossaire : skill `zone-mots-cles`. Lot de mise à jour : skill `zone-mise-a-jour`.

## Le plan du site

- Plus de livre (demande du propriétaire : « éclater le guide », puis retirer le glissement, les flèches suivant / précédent et la pagination). Chaque page est une page simple (`PageDuGuide.astro`) : fil d'Ariane (`filDAriane`), titre, texte et blocs, mots-clés, rétroliens.
- Jamais : flèches, touches ← →, glissement du doigt, pagination, numéro de chapitre. Le retour arrière au glissement horizontal est empêché pour tout le site par la feuille globale (`html { overscroll-behavior-x: none; }`, `styles/global/base.css`, skill `ui-defilement`), jamais par une page.
- Plus aucune source sous une page (réponse du propriétaire du 2026-10-22, G43 : « Plus de sources ailleurs que dans les archives. On va épurer un peu ce qui est redondant. ») : `PiedDePage.astro` n'a plus de pied « Sources » ; `sources:` reste dans le frontmatter et la base, que `/archives/` lit (skill `zone-archives`).
- L'adresse d'une page du guide ne vient que du plan : `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`.
  - Découvrir (`DECOUVRIR`) : une page par entrée du menu (Bienvenue, L'univers, Créer son personnage, Rejoindre une partie). Bienvenue est à `/decouvrir/`, les autres à `/decouvrir/<slug>/`. Plus de page « Liens » (supprimée le 2026-10-22) : `/decouvrir/liens/` mène à Bienvenue (`ADRESSES_DU_PLAN_PRECEDENT`), ancre et requête gardées.
  - Les bases (`LES_BASES`) : un sommaire à `/regles/` (`pages/regles/index.astro`), trois groupes ; pages à `/regles/<slug>/`.
  - Guide du MJ : sommaire `/mj/`, pages à `/mj/<slug>/`.
  - Toute autre page `guide/…` : Règles avancées, sommaire `/regles/avancees/` en groupes, pages à `/regles/avancees/<slug>/` (groupe « Autres pages de référence » si le plan ne la nomme pas).
  - Artisanat : `/regles/artisanat/` (`ARTISANAT`).
  - Plus rien sous `/guide/`.
- Trois sommaires (`components/guide/Sommaire.astro` : titre et résumé de chaque page) : Les bases, Règles avancées, Guide du MJ.
- `[slug].astro` ne construit aucune page du guide (`estServieASonId`).
- Plus de frontmatter `chapitre` ni `partie` (migration `0064-guide-sans-chapitres`). L'ordre et les couleurs des groupes sont dans le plan (`PARTIES`, aussi les couleurs des zones de la fiche ; `couleurDeLaPage`).
- `verifierLePlan` arrête le build sur une page nommée absente, d'exemple, nommée deux fois, ou fusionnée dans une autre (`PAGES_ABSORBEES` : Le jeu de rôle dans Bienvenue, les six étapes dans Créer son personnage) et revenue.
- Pour placer une page : la nommer dans `lib/livres.mjs`. `livres.mjs` n'écrit que des libellés de navigation ; seule exception, la présentation du lien Discord sous Bienvenue.
- `NOMS_RESERVES` (`artisanat`, `avancees`) : les pages Astro à côté des pages des Bases ; aucune page de Découvrir ni des Bases ne prend ce nom.

## Anciennes adresses et anciens liens

- Les anciennes adresses (`/guide/<slug>/`, `/decouvrir/<slug>/`) et celles du plan précédent (`ADRESSES_DU_PLAN_PRECEDENT`) mènent à la page qui les a par la page 404 (`lib/metiers.mjs#renvoisDuGuide`). Une page fusionnée mène à l'intertitre où se lit son contenu (`ANCRES_DES_PAGES_ABSORBEES`, comparées aux intertitres et au site construit).
- `livres.mjs` entre dans la chaîne de l'édition (par `metiers.mjs`), chargée aussi sur la page 404. Donc `nav.mjs` ne l'importe pas : la page 404 reçoit les renvois au build (`data-renvois`).
- Un lien Markdown écrit vers `/guide/<slug>/` mène à la nouvelle adresse au rendu (celle de la page qui absorbe une page fusionnée) : `guide.mjs#adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `guide-rendu.ts`. Il garde l'adresse écrite en `data-lien-ecrit`, que l'éditeur relit (`markdown-edition.mjs#versMarkdown`, gardée par `htmlSur`).
- Le texte de la base n'est réécrit ni au rendu ni quand on modifie la page (`test/markdown-edition.test.mjs`).

## Blocs tirés de la base

- Les tableaux viennent de la base par une ligne `<!-- guide:<bloc> -->` (`BLOCS`), sur toute page du guide. Jamais recopiés dans le texte ; chaque bloc appelé une fois ; plus de bloc `sommaire` (un marqueur inconnu arrête le rendu).
- Les personnages fil rouge (`lib/guide-fil-rouge.mjs`) : leurs choix seulement ; les chiffres sont calculés.
- Blocs `magies` et `magie-bonus` (`GuideBloc.astro`) : la case ou la ligne d'une magie porte la classe de la magie (`couleur-magie-<id>`, `lib/palette-css.mjs`, skill `ui-couleurs`), jamais un style ; `.guide-magie` en tire `--c` (`styles/guide/blocs.css`). Caractéristiques, compétences et postures restent en style (`styleDeCouleur`) jusqu'à leur lot.

## Ajouter une page à la main

- Elle doit avoir une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse, et `db:export-pages` efface alors le `.md`. Vérifier la sortie de `db:sync-pages` avant d'exporter.

## Textes de Découvrir et des Bases

- Les seize pages de Découvrir et des Bases, « Le Mode Hyper et le Mode Super » et la présentation du lien Discord sont réécrits de zéro (demande du propriétaire), d'après la base, les originaux des deux Docs et les décisions.
- Les écarts original ↔ base relevés sont dans `docs/sql/a-valider.md` §6 ; rien n'en est appliqué (R83).
- Aucun chiffre d'un bloc n'y est recopié.
- Le code lit quelques-unes de leurs phrases (`## La ceinture`, « case Entraînement »…) : les garder en modifiant ces pages. Liste complète : `docs/content-guide.md`, « Les textes de Découvrir et des Bases ».

## Sous Bienvenue : liens, Tipeee et annonce

- Choix du propriétaire du 2026-10-22 (G34) : l'encart et les présentations passent sur Bienvenue (« Bonne idée. ») ; la page Liens est supprimée (« Plus d'entrée Liens au menu : tout est sur Bienvenue. L'ancienne adresse renverrait vers Bienvenue. »).
- `components/guide/SousBienvenue.astro` (posé par `PageDuGuide.astro` sous le texte de `SOUS_BIENVENUE.page`, avant mots-clés et rétroliens) : chaque lien sous un `h2` (ancres `#lien-discord`, `#lien-tipeee`, celles de l'ancienne page) avec sa présentation, puis l'encart.
- Discord : `SOUS_BIENVENUE.liens[].presentation`, une constante écrite dans le plan (ni modifiable sur le site de dev ni cherchée).
- Tipeee (G36 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee », « La partie « Bienvenue » », « En direct par le serveur ») : la partie « Bienvenue » de Tipeee, telle quelle, jamais réécrite. Au build, les paragraphes de l'instantané (`sources/tipeee/bienvenue.json`, invalide : le build s'arrête), en texte seul dans une citation `[data-tipeee]` (`white-space: pre-line` : un `\n` de Tipeee reste un retour à la ligne). Puis `src/scripts/tipeee.mjs` (absent de la version portable) les remplace par ceux de `GET /api/tipeee/` s'ils diffèrent, en `textContent` seulement ; réponse vide, mal formée, hors des bornes, service absent : l'instantané reste. Seul script de page à importer `lib/tipeee.mjs`.
- L'encart « Notre prochaine rencontre IRL » (`SOUS_BIENVENUE.rencontre`, titre fixe, ancre `#prochaine-rencontre`) : l'annonce de la table `annonce` (migration `0068-annonces`, `lib/annonces.mjs`). NULL affiche « Aucune rencontre annoncée pour le moment. ».
- Modifiable en place sur le site de dev (`src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE` : Markdown sûr, balises canoniques), à côté du texte de la page (`edition/guide.mjs`) : une seule barre d'outils se montre, celle de la zone où est le curseur (`texte-en-place.mjs#choisirLaBarre`).
- Livrée par la mise à jour (`scripts/mise-a-jour-regles.mjs#TEXTES_EN_MARKDOWN`, note de version domaine `guide`, « Bienvenue › Notre prochaine rencontre IRL »), ressource `/api/v1/annonces/`.
- Ni création ni suppression d'annonce.
- Bienvenue et Rejoindre une partie y renvoient par des liens écrits vers `#lien-discord`, `/decouvrir/#lien-discord`, `/decouvrir/#prochaine-rencontre` (la version portable refuse un lien vers une page qui n'existe plus).

## Tests

- `test/livres.test.mjs`, `test/guide.test.mjs`, `test/guide-html.test.mjs` épinglent le plan.
- `test/guide-sans-chapitres.test.mjs` (migration 0064), `test/markdown-edition.test.mjs` (aller-retour et `data-lien-ecrit`), `test/serveur-edition-guide.test.mjs`.
- `test/serveur-edition-annonces.test.mjs`, `test/edition-annonces.test.mjs`, `test/texte-en-place-barres.test.mjs` (une barre d'outils à la fois), `test/tipeee-script.test.mjs` (le script de Tipeee, faux navigateur) ; `test/guide-html.test.mjs` (Bienvenue construite, plus de sources) ; `test/gabarits-sources.test.mjs` (aucun commentaire de gabarit n'annonce de sources sous une page, aucun gabarit ne finit par une ligne vide).

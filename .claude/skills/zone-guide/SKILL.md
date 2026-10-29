---
name: zone-guide
description: "Pages du guide (plan lib/livres.mjs : Découvrir, Les bases, Règles avancées, Guide du MJ, Artisanat), les liens Discord et Tipeee (texte repris de Tipeee) et la table annonce, posés sur l'accueil, anciens liens /guide/, blocs <!-- guide:… --> tirés de la base, textes réécrits. À charger avant de lire, modifier ou relire ce code ou ces pages."
paths: ["client/src/lib/livres.mjs", "client/src/lib/guide*.mjs", "client/src/lib/guide-rendu.ts", "client/src/lib/annonces.mjs", "client/src/components/guide/**", "client/src/pages/decouvrir/**", "client/src/pages/regles/**", "client/src/pages/mj/**", "client/src/styles/guide/**", "client/src/components/accueil/**", "client/src/styles/accueil/liens-et-rencontre.css", "client/src/scripts/tipeee.mjs", "client/src/scripts/edition/annonces.mjs", "client/src/scripts/edition/guide.mjs", "client/test/livres.test.mjs", "client/test/guide*.test.mjs", "client/test/*annonces.test.mjs", "client/test/serveur-edition-guide.test.mjs", "client/test/tipeee-script.test.mjs", "client/test/accueil-html.test.mjs", "client/test/texte-en-place-barres.test.mjs", "data/migrations/0064-guide-sans-chapitres*", "data/migrations/0068-annonces*"]
user-invocable: false
---
# Pages du guide, liens de l'accueil (Discord, Tipeee) et annonces

## Fichiers

- `client/src/lib/livres.mjs` : le plan du site, sans import, testé. Range les pages `guide/…` (famille `docs`, ids inchangés) et leur donne leur adresse. Constantes : `DECOUVRIR`, `LES_BASES`, `PARTIES`, `PAGES_ABSORBEES`, `ANCRES_DES_PAGES_ABSORBEES`, `ADRESSES_DU_PLAN_PRECEDENT`, `ARTISANAT`, `LIENS_ET_RENCONTRE`, `NOMS_RESERVES`, `PAR_OU_COMMENCER`, `RUBRIQUES_SOUS_LA_PAGE` ; fonctions `adresseDuGuide`, `filDAriane`, `partieDeLaPage`, `verifierLePlan`. Aucune couleur écrite (il entre dans la chaîne de l'édition du navigateur) : un groupe porte l'id de sa partie (`partie`).
- `lib/parties-couleurs.mjs` (`COULEURS_DES_PARTIES` : la couleur de chaque partie, lue par la palette seule ; skill `ui-couleurs`).
- `lib/guide.mjs` (`BLOCS`, `adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `pagesDeReference`, `avecPrefixe`), `lib/guide-db.mjs` (tableaux des blocs), `lib/guide-fil-rouge.mjs` (personnages fil rouge), `lib/guide-rendu.ts`, `lib/annonces.mjs`.
- `components/guide/` : `PageDuGuide.astro`, `PageDuPlan.astro`, `Sommaire.astro`, `GuideBloc.astro` ; `components/accueil/LiensEtRencontre.astro` (liens et encart de l'accueil).
- Pages : `pages/decouvrir/` (`[...page].astro` seulement : plus de page Liens), `pages/regles/` (`index.astro`, `[...page].astro`, `artisanat.astro`, `avancees/index.astro`), `pages/mj/`.
- Styles : `styles/guide/blocs.css` (couleurs des pages et blocs ; `styles/global/wiki.css` : le filet d'un groupe du sommaire), `styles/accueil/liens-et-rencontre.css` (liens et encart de l'accueil).
- Édition : `src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE`.
- Tipeee : `src/scripts/tipeee.mjs` (le script de l'accueil), `lib/tipeee.mjs` (module pur), instantané `sources/tipeee/bienvenue.json` ; le service : skill `zone-service-sorties` (`serveur/tipeee.mjs`, `GET /api/tipeee/`).

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » : plan, rubriques, couleurs, sommaires, Artisanat, liens de l'accueil (Discord, Tipeee, encart), pages fusionnées, anciennes adresses, blocs, textes de Découvrir et des Bases, personnages fil rouge, édition sur le site de dev.
- `docs/sql/a-valider.md` §6 : écarts original ↔ base relevés par la réécriture (G34, G36, G43 tranchés le 2026-10-22).
- `docs/sources.md`, « Tipeee ».
- Modifier le texte d'une page : skill `modifier-une-page-wiki`. Menu : skill `zone-menu`. Accueil et cartes « Par où commencer ? » : skill `zone-accueil`. Adresses et `[[liens]]` : skill `site-wiki-liens`. Éditeur en place et Markdown sûr : skill `zone-edition`. Balises du glossaire : skill `zone-mots-cles`. Lot de mise à jour : skill `zone-mise-a-jour`.

## Le plan du site

- Plus de livre (demande du propriétaire : « éclater le guide », puis retirer le glissement, les flèches suivant / précédent et la pagination). Chaque page est une page simple (`PageDuGuide.astro`) : fil d'Ariane (`filDAriane`), titre, texte et blocs, mots-clés, rétroliens.
- Jamais : flèches, touches ← →, glissement du doigt, pagination, numéro de chapitre. Le retour arrière au glissement horizontal est empêché pour tout le site par la feuille globale (`html { overscroll-behavior-x: none; }`, `styles/global/base.css`, skill `ui-defilement`), jamais par une page.
- Plus aucune source sous une page (réponse du propriétaire du 2026-10-22, G43 : « Plus de sources ailleurs que dans les archives. On va épurer un peu ce qui est redondant. ») : `PiedDePage.astro` n'a plus de pied « Sources » ; `sources:` reste dans le frontmatter et la base, que `/archives/` lit (skill `zone-archives`).
- L'adresse d'une page du guide ne vient que du plan : `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`.
  - Découvrir (`DECOUVRIR`) : une page par entrée du menu (Bienvenue, L'univers, Créer son personnage, Rejoindre une partie). Bienvenue est à `/decouvrir/`, les autres à `/decouvrir/<slug>/`. Plus de page « Liens » ; `/decouvrir/liens/` n'a aucun renvoi (choix du propriétaire : « supprimer ce lien ») : la page 404 la dit introuvable (`test/livres.test.mjs`, `test/site-html.test.mjs`).
  - Les bases (`LES_BASES`) : un sommaire à `/regles/` (`pages/regles/index.astro`), trois groupes ; pages à `/regles/<slug>/`.
  - Guide du MJ : sommaire `/mj/`, pages à `/mj/<slug>/`.
  - Toute autre page `guide/…` : Règles avancées, sommaire `/regles/avancees/` en groupes, pages à `/regles/avancees/<slug>/` (groupe « Autres pages de référence » si le plan ne la nomme pas).
  - Artisanat : `/regles/artisanat/` (`ARTISANAT`).
  - Plus rien sous `/guide/`.
- Trois sommaires (`components/guide/Sommaire.astro` : titre et résumé de chaque page) : Les bases, Règles avancées, Guide du MJ.
- `[slug].astro` ne construit aucune page du guide (`estServieASonId`).
- Plus de frontmatter `chapitre` ni `partie` (migration `0064-guide-sans-chapitres`). L'ordre des groupes et leur partie sont dans le plan (`PARTIES`, `partie` d'un groupe, `partieDeLaPage`) ; la couleur d'une partie est sa classe de la palette (`.couleur-partie-<id>`, `palette-css.mjs#classeDePartie`, valeur dans `lib/parties-couleurs.mjs`, aussi celle des zones de la fiche ; lot 8, skill `ui-couleurs`) : `PageDuGuide.astro` la pose sur `.guide-reference` (une page de Découvrir ou des Bases seulement, qui émet alors la feuille `cssDesParties()`), `Sommaire.astro` sur un groupe (`classe`, celle que donne `pages/regles/index.astro` ; feuille émise si un groupe en a une) ; jamais un style (ni `--couleur-partie` ni `--sommaire-couleur`). `blocs.css` tire `--guide` et `--guide-sur` (le texte d'un aplat, blanc) de la classe ; les enfants directs de la page remettent `--couleur` et `--couleur-texte` à `initial` (`:where()`), pour qu'un bloc sans classe propre garde son repli.
- Le nom d'un personnage fil rouge (`.guide-fil-rouge__nom`) lit `--guide-texte` (ci-dessous : en thème clair, la couleur de la partie mêlée de 10 % de noir). Sa correction n'est pas un choix du propriétaire : question « Sur la page « Créer son personnage », en thème clair, le nom de chaque personnage fil rouge est écrit dans le vert de la partie (#2e7d4f) sur la carte teintée de ce vert (#e6eee4) : 4,24:1, sous le contraste minimal de lisibilité (4,5:1). Les autres parties l'atteignent (4,6:1 à 5,6:1). Que faire ? » ; réponse du propriétaire du 2026-10-23 : sans préférence ; option recommandée appliquée, au nom de sa règle « Privilégé la lisibilité » : « Vert assombri » : « Sur ces cartes, la couleur de la partie est assombrie par le calcul, mêlée de 10 % de noir (environ #297147, 5,0:1). Aucune couleur n'est ajoutée, et le thème sombre ne change pas. »
- Le texte coloré d'une page qui a une partie (`--guide-texte` : intertitres, en-têtes du tableau des niveaux, termes des définitions, liens des rubriques, nom du fil rouge), en thème clair : `color-mix(in srgb, var(--guide) 90%, #000)`, posé par `.guide-reference[class*='couleur-partie-']` ; en sombre, l'éclairci d'avant ; une page sans partie garde l'accent du site (restriction du lot, le plus petit changement). Choix du propriétaire : question « Sur la page « Créer son personnage », en thème clair, les intertitres sont écrits dans le vert de la partie (#2e7d4f) sur le fond de la page (#f6f1e7) : 4,48:1, juste sous le contraste minimal de lisibilité (4,5:1). Les autres parties l'atteignent (4,9:1 à 6,1:1). Que faire ? » ; réponse du propriétaire du 2026-10-23 : « Comme les cartes du fil rouge (Recommandé) » ; option : « En thème clair, le texte coloré des pages du guide est assombri par le calcul, mêlé de 10 % de noir (environ #297147 pour Créer, 5,3:1), comme le nom des personnages fil rouge. Aucune couleur n'est ajoutée, et le thème sombre ne change pas. Vaut pour toutes les parties et tout le texte coloré de la page (intertitres, en-têtes du tableau des niveaux, termes des définitions) : les autres parties foncent un peu. »
- `verifierLePlan` arrête le build sur une page nommée absente, d'exemple, nommée deux fois, ou fusionnée dans une autre (`PAGES_ABSORBEES` : Le jeu de rôle dans Bienvenue, les six étapes dans Créer son personnage) et revenue.
- Pour placer une page : la nommer dans `lib/livres.mjs`. `livres.mjs` n'écrit que des libellés de navigation ; seule exception, la présentation du lien Discord de l'accueil.
- `NOMS_RESERVES` (`artisanat`, `avancees`) : les pages Astro à côté des pages des Bases ; aucune page de Découvrir ni des Bases ne prend ce nom.

## Anciennes adresses et anciens liens

- Les anciennes adresses (`/guide/<slug>/`, `/decouvrir/<slug>/`) et celles du plan précédent (`ADRESSES_DU_PLAN_PRECEDENT`) mènent à la page qui les a par la page 404 (`lib/metiers.mjs#renvoisDuGuide`). Une page fusionnée mène à l'intertitre où se lit son contenu (`ANCRES_DES_PAGES_ABSORBEES`, comparées aux intertitres et au site construit).
- `livres.mjs` entre dans la chaîne de l'édition (par `metiers.mjs`), chargée aussi sur la page 404. Donc `nav.mjs` ne l'importe pas : la page 404 reçoit les renvois au build (`data-renvois`).
- Un lien Markdown écrit vers `/guide/<slug>/` mène à la nouvelle adresse au rendu (celle de la page qui absorbe une page fusionnée) : `guide.mjs#adresseDesAnciensLiens`, `remarkAnciensLiensDuGuide`, `guide-rendu.ts`. Il garde l'adresse écrite en `data-lien-ecrit`, que l'éditeur relit (`markdown-edition.mjs#versMarkdown`, gardée par `htmlSur`).
- Le texte de la base n'est réécrit ni au rendu ni quand on modifie la page (`test/markdown-edition.test.mjs`).

## Blocs tirés de la base

- Les tableaux viennent de la base par une ligne `<!-- guide:<bloc> -->` (`BLOCS`), sur toute page du guide. Jamais recopiés dans le texte ; chaque bloc appelé une fois ; plus de bloc `sommaire` (un marqueur inconnu arrête le rendu).
- Les personnages fil rouge (`lib/guide-fil-rouge.mjs`) : leurs choix seulement ; les chiffres sont calculés.
- Blocs `magies` et `magie-bonus` (`GuideBloc.astro`) : la case ou la ligne d'une magie porte la classe de la magie (`couleur-magie-<id>`, `lib/palette-css.mjs`, skill `ui-couleurs`), jamais un style ; `.guide-magie` en tire `--c` (`styles/guide/blocs.css`). Caractéristiques (« +1 en … », cadre de leurs compétences) et postures de même : la classe `couleur-caracteristique-<id>` ou `couleur-posture-<id>` (`classeDeCaracteristique`, `classeDePosture`), dont `blocs.css` tire `--c` et `--c-texte` ; le bloc `postures` émet lui-même la feuille des postures (`cssDesFamilles(['posture'])` : famille d'une zone, absente de la palette de chaque page).

## Ajouter une page à la main

- Elle doit avoir une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse, et `db:export-pages` efface alors le `.md`. Vérifier la sortie de `db:sync-pages` avant d'exporter.

## Textes de Découvrir et des Bases

- Les seize pages de Découvrir et des Bases, « Le Mode Hyper et le Mode Super » et la présentation du lien Discord sont réécrits de zéro (demande du propriétaire), d'après la base, les originaux des deux Docs et les décisions.
- Les écarts original ↔ base relevés sont dans `docs/sql/a-valider.md` §6 ; rien n'en est appliqué (R83).
- Aucun chiffre d'un bloc n'y est recopié.
- Le code lit quelques-unes de leurs phrases (`## La ceinture`, « case Entraînement »…) : les garder en modifiant ces pages. Liste complète : `docs/content-guide.md`, « Les textes de Découvrir et des Bases ».

## Liens de l'accueil : Discord, Tipeee et annonce

- Sur l'accueil (place, ordre, mode modification, titre dans la note de version : skill `zone-accueil`), plus sur Bienvenue (`test/guide-html.test.mjs`).
- `components/accueil/LiensEtRencontre.astro`, données `LIENS_ET_RENCONTRE` (`lib/livres.mjs`) : chaque lien sous un `h2`, puis l'encart. Ancres figées `#lien-discord`, `#lien-tipeee`, `#prochaine-rencontre` : Bienvenue et Rejoindre une partie y renvoient par des liens écrits `/#lien-discord`, `/#prochaine-rencontre` (préfixe `SITE_BASE` par `lib/guide.mjs#avecPrefixe` ; la version portable refuse un lien vers une page qui n'existe plus). Aucun mot des blocs n'est réécrit.
- Discord : `LIENS_ET_RENCONTRE.liens[].presentation`, une constante écrite dans le plan (ni modifiable sur le site de dev ni cherchée).
- Tipeee (G36 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee », « La partie « Bienvenue » », « En direct par le serveur ») : la partie « Bienvenue » de Tipeee, telle quelle, jamais réécrite. Au build, les paragraphes de l'instantané (`sources/tipeee/bienvenue.json`, invalide : le build s'arrête), en texte seul dans une citation `[data-tipeee]` (`white-space: pre-line` : un `\n` de Tipeee reste un retour à la ligne). Puis `src/scripts/tipeee.mjs` (absent de la version portable) les remplace par ceux de `GET /api/tipeee/` s'ils diffèrent, en `textContent` seulement ; réponse vide, mal formée, hors des bornes, service absent : l'instantané reste. Seul script de page à importer `lib/tipeee.mjs`.
- L'encart « Notre prochaine rencontre IRL » (`LIENS_ET_RENCONTRE.rencontre`, titre fixe) : l'annonce de la table `annonce` (migration `0068-annonces`, `lib/annonces.mjs`). NULL affiche « Aucune rencontre annoncée pour le moment. ».
- Modifiable en place sur le site de dev (`src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE` : Markdown sûr, balises canoniques).
- Livrée par la mise à jour (`scripts/mise-a-jour-regles.mjs#TEXTES_EN_MARKDOWN`, note de version domaine `guide`, groupe Découvrir, « Accueil › Notre prochaine rencontre IRL »), ressource `/api/v1/annonces/`.
- Ni création ni suppression d'annonce.

## Tests

- `test/livres.test.mjs`, `test/guide.test.mjs`, `test/guide-html.test.mjs` épinglent le plan. `test/guide.test.mjs` épingle aussi le plafond de maîtrise d'arme (4 points, 5 dés, R149) dans « Créer son personnage », « L'équipement », « Aide-mémoire » et « Lexique ».
- `test/guide-sans-chapitres.test.mjs` (migration 0064), `test/markdown-edition.test.mjs` (aller-retour et `data-lien-ecrit`), `test/serveur-edition-guide.test.mjs`.
- `test/serveur-edition-annonces.test.mjs`, `test/edition-annonces.test.mjs`, `test/texte-en-place-barres.test.mjs` (une barre d'outils à la fois), `test/tipeee-script.test.mjs` (le script de Tipeee, faux navigateur) ; `test/accueil-html.test.mjs` (les blocs sur l'accueil construit) ; `test/guide-html.test.mjs` (Bienvenue construite, sans eux, plus de sources) ; `test/gabarits-sources.test.mjs` (aucun commentaire de gabarit n'annonce de sources sous une page, aucun gabarit ne finit par une ligne vide).

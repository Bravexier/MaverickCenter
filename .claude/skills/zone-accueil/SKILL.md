---
name: zone-accueil
description: "Accueil (/ : bienvenue, carrousel de la galerie, liens Discord et Tipeee, encart et table annonce « Notre prochaine rencontre IRL », cartes « Par où commencer ? ») et galeries (/galeries/, lib/galerie.mjs). À charger avant de lire, modifier ou relire ces pages, leurs composants, leurs styles ou leurs tests."
paths: ["client/src/pages/index.astro", "client/src/components/galerie/**", "client/src/components/accueil/**", "client/src/lib/galerie.mjs", "client/src/pages/galeries.astro", "client/src/styles/accueil/**", "client/src/styles/galerie/**", "client/test/galerie.test.mjs", "client/test/accueil-html.test.mjs", "client/src/lib/annonces.mjs", "client/src/scripts/tipeee.mjs", "client/src/scripts/edition/annonces.mjs", "client/test/*annonces.test.mjs", "client/test/tipeee-script.test.mjs", "client/test/texte-en-place-barres.test.mjs", "data/migrations/0068-annonces*"]
user-invocable: false
---
# Accueil, liens et annonce, galeries

## Fichiers

- `pages/index.astro`, `components/galerie/Carrousel.astro`, `components/accueil/LiensEtRencontre.astro`, `lib/galerie.mjs`, `pages/galeries.astro`, `styles/accueil/` (dont `liens-et-rencontre.css`), `styles/galerie/`.
- `lib/livres.mjs#LIENS_ET_RENCONTRE`, `lib/annonces.mjs`, `src/scripts/tipeee.mjs`, `lib/tipeee.mjs`, instantané `sources/tipeee/bienvenue.json` (service : skill `zone-service-sorties`), `src/scripts/edition/annonces.mjs`, `serveur/edition.mjs#ANNONCE`.
- Menu et en-tête : skill `zone-menu`. Pages de Découvrir et plan du site : skill `zone-guide`.

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » (Découvrir, cartes « Par où commencer ? », liens de l'accueil).
- `docs/sources.md`, « Tipeee ».
- `docs/feuille-de-route.md`, E1 (galerie humaine / IA).

## Accueil et galeries

- Accueil, dans cet ordre : texte de bienvenue, à côté du défilement des images de la galerie (flèches, points, pause, défilement automatique à partir de deux images ; sans JavaScript, la piste défile au doigt) ; puis les liens et l'encart ; puis « Par où commencer ? ».
- Liens et encart (`components/accueil/LiensEtRencontre.astro`) : sous la bienvenue et le carrousel, avant « Par où commencer ? » (demande du propriétaire : « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. », « Sous la bienvenue et le carrousel ») ; Discord, Tipeee, puis l'encart « Notre prochaine rencontre IRL ». Aucun autre id de l'accueil ne reprend leurs ancres. Rendu et styles de Bienvenue gardés tels quels, limite de largeur du texte (`.prose`) et tailles de titres comprises (choix du propriétaire : « Non, garder tel quel ») ; classes `accueil-liens…`, `accueil-tipeee`, `annonce…`.
- L'accueil propose le mode modification (`<Base edition={LIENS_ET_RENCONTRE.page}>`, page `accueil` au journal) : sans lui, l'annonce ne se modifie pas. Son titre « Accueil » (`LIENS_ET_RENCONTRE.titre`) nomme l'encart dans la note de version.
- Scripts : carrousel (sans import), `src/scripts/tipeee.mjs` (absent de la version portable), chargeur de l'édition ; aucun module importé par deux d'entre eux (skill `site-version-portable`).
- Puis « Par où commencer ? » : trois cartes (`lib/livres.mjs#PAR_OU_COMMENCER`) en grille de 3, puis de 1 sous 40rem, avec le titre et le résumé de la page : Bienvenue, L'univers, puis **« Créer son personnage »**, qui mène à `/regles/creer-son-personnage/` (introduction de l'onglet Fiche de personnage, défaut confirmé, R185 (9)). Chaque carte prend la couleur de sa partie (`.couleur-partie-<id>`, `palette-css.mjs#classeDePartie` d'après `livres.mjs#partieDeLaPage` : la 3e, `creer` ; la page émet `cssDesParties()`), dont `styles/accueil/accueil.css` tire `--c` ; jamais un style (skill `ui-couleurs`). La phrase « Première visite ? Commencez par Découvrir : le jeu, son univers et la création d’un personnage. » (« Phrase raccourcie ») et le bouton « Découvrir Maverick » ne disent que la navigation ; la phrase est épinglée par `test/site-html.test.mjs`.
- `/galeries/` : toutes les images.
- Une image = un fichier dans `public/` + une entrée de `GALERIE` (`lib/galerie.mjs`). En construction : le logo seul (`galerieEnConstruction`).

## Liens Discord et Tipeee, encart et annonce

- `LiensEtRencontre.astro` et `LIENS_ET_RENCONTRE` : chaque lien sous un `h2`, puis l'encart. Ancres figées `#lien-discord`, `#lien-tipeee`, `#prochaine-rencontre` : Bienvenue y renvoie par un lien écrit `/#lien-discord` (préfixe `SITE_BASE` par `lib/guide.mjs#avecPrefixe` ; la version portable refuse un lien vers une page absente). Plus rien de cela sur Bienvenue (`test/guide-html.test.mjs`). Aucun mot des blocs n'est réécrit.
- Discord : `presentation`, constante du plan (ni modifiable sur le site de dev ni cherchée).
- Tipeee (G36 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee ») : la partie « Bienvenue » de Tipeee, telle quelle, jamais réécrite. Au build, les paragraphes de l'instantané (invalide : le build s'arrête) en texte seul dans une citation `[data-tipeee]` (`white-space: pre-line`) ; puis `src/scripts/tipeee.mjs` (absent de la version portable) les remplace par `GET /api/tipeee/` s'ils diffèrent, en `textContent` ; réponse vide, mal formée ou service absent : l'instantané reste. Seul script de page à importer `lib/tipeee.mjs`.
- Encart « Notre prochaine rencontre IRL » (titre fixe) : l'annonce de la table `annonce` (migration `0068-annonces`) ; NULL affiche « Aucune rencontre annoncée pour le moment. ». Modifiable en place (Markdown sûr, balises canoniques), livrée par la mise à jour (`scripts/mise-a-jour-regles.mjs#TEXTES_EN_MARKDOWN`, note de version domaine `guide`, groupe Découvrir), ressource `/api/v1/annonces/`. Ni création ni suppression.

## Tests

- `test/galerie.test.mjs`.
- `test/serveur-edition-annonces.test.mjs`, `test/edition-annonces.test.mjs`, `test/texte-en-place-barres.test.mjs` (une barre d'outils à la fois), `test/tipeee-script.test.mjs` (faux navigateur).
- `test/site-html.test.mjs` : accueil et galeries (site construit, CI après le build ; la classe de la partie de chaque carte ; les ancres des liens sur l'accueil).
- `test/accueil-html.test.mjs` : les liens et l'encart sur l'accueil construit (place, ordre, Tipeee, annonce, mode modification, ids uniques) ; `test/livres.test.mjs` : `page` et `titre` de `LIENS_ET_RENCONTRE` repris de `pages/index.astro`.
- `test/palette-css.test.mjs` : la feuille des parties émise par l'accueil, `--c` lu sur la carte, lisibilité du titre et du résumé sur la teinte d'une carte dans les deux thèmes.

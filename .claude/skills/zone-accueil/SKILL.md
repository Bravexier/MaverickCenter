---
name: zone-accueil
description: "Accueil (/ : bienvenue, carrousel de la galerie, liens Discord et Tipeee et encart « Notre prochaine rencontre IRL », cartes « Par où commencer ? ») et galeries (/galeries/, lib/galerie.mjs). À charger avant de lire, modifier ou relire ces pages, leurs composants, leurs styles ou leurs tests."
paths: ["client/src/pages/index.astro", "client/src/components/galerie/**", "client/src/components/accueil/**", "client/src/lib/galerie.mjs", "client/src/pages/galeries.astro", "client/src/styles/accueil/**", "client/src/styles/galerie/**", "client/test/galerie.test.mjs", "client/test/accueil-html.test.mjs"]
user-invocable: false
---
# Accueil et galeries

## Fichiers

- `pages/index.astro`, `components/galerie/Carrousel.astro`, `components/accueil/LiensEtRencontre.astro`, `lib/galerie.mjs`, `pages/galeries.astro`, `styles/accueil/`, `styles/galerie/`.
- Menu et en-tête : skill `zone-menu`. Pages de Découvrir, plan du site, contenu des liens et de l'encart (Tipeee, annonce) : skill `zone-guide`.

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » (Découvrir, cartes « Par où commencer ? »).
- `docs/feuille-de-route.md`, E1 (galerie humaine / IA).

## Accueil et galeries

- Accueil, dans cet ordre : texte de bienvenue, à côté du défilement des images de la galerie (flèches, points, pause, défilement automatique à partir de deux images ; sans JavaScript, la piste défile au doigt) ; puis les liens et l'encart ; puis « Par où commencer ? ».
- Liens et encart (`components/accueil/LiensEtRencontre.astro`) : sous la bienvenue et le carrousel, avant « Par où commencer ? » (demande du propriétaire : « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. », « Sous la bienvenue et le carrousel ») ; Discord, Tipeee, puis l'encart « Notre prochaine rencontre IRL ». Aucun autre id de l'accueil ne reprend leurs ancres. Rendu et styles de Bienvenue gardés tels quels, limite de largeur du texte (`.prose`) et tailles de titres comprises (choix du propriétaire : « Non, garder tel quel ») ; classes `accueil-liens…`, `accueil-tipeee`, `annonce…`.
- L'accueil propose le mode modification (`<Base edition={LIENS_ET_RENCONTRE.page}>`, page `accueil` au journal) : sans lui, l'annonce ne se modifie pas. Son titre « Accueil » (`LIENS_ET_RENCONTRE.titre`) nomme l'encart dans la note de version.
- Scripts : carrousel (sans import), `src/scripts/tipeee.mjs` (absent de la version portable), chargeur de l'édition ; aucun module importé par deux d'entre eux (skill `site-version-portable`).
- Puis « Par où commencer ? » : quatre cartes, les quatre pages de Découvrir (`lib/livres.mjs#PAR_OU_COMMENCER`), avec le titre et le résumé de la page. Chaque carte dans la couleur de son groupe : la classe de sa partie (`.couleur-partie-<id>`, `palette-css.mjs#classeDePartie` d'après `livres.mjs#partieDeLaPage` ; la page émet `cssDesParties()`), dont `styles/accueil/accueil.css` tire `--c` sur la carte ; jamais un style (skill `ui-couleurs`, lot 8). La phrase « Première visite ? » et le bouton « Découvrir Maverick » ne disent que la navigation.
- `/galeries/` : toutes les images.
- Une image = un fichier dans `public/` + une entrée de `GALERIE` (`lib/galerie.mjs`). En construction : le logo seul (`galerieEnConstruction`).

## Tests

- `test/galerie.test.mjs`.
- `test/site-html.test.mjs` : accueil et galeries (site construit, CI après le build ; la classe de la partie de chaque carte ; les ancres des liens sur l'accueil).
- `test/accueil-html.test.mjs` : les liens et l'encart sur l'accueil construit (place, ordre, Tipeee, annonce, mode modification, ids uniques) ; `test/livres.test.mjs` : `page` et `titre` de `LIENS_ET_RENCONTRE` repris de `pages/index.astro`.
- `test/palette-css.test.mjs` : la feuille des parties émise par l'accueil, `--c` lu sur la carte, lisibilité du titre et du résumé sur la teinte d'une carte dans les deux thèmes.

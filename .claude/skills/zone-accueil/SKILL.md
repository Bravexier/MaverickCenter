---
name: zone-accueil
description: "Accueil (/ : bienvenue, carrousel de la galerie, cartes « Par où commencer ? ») et galeries (/galeries/, lib/galerie.mjs). À charger avant de lire, modifier ou relire ces pages, leurs composants, leurs styles ou leurs tests."
paths: ["client/src/pages/index.astro", "client/src/components/galerie/**", "client/src/lib/galerie.mjs", "client/src/pages/galeries.astro", "client/src/styles/accueil/**", "client/src/styles/galerie/**", "client/test/galerie.test.mjs"]
user-invocable: false
---
# Accueil et galeries

## Fichiers

- `pages/index.astro`, `components/galerie/Carrousel.astro`, `lib/galerie.mjs`, `pages/galeries.astro`, `styles/accueil/`, `styles/galerie/`.
- Menu et en-tête : skill `zone-menu`. Pages de Découvrir et plan du site : skill `zone-guide`.

## À lire

- `docs/content-guide.md`, « Les pages du guide : rubriques et sommaires » (Découvrir, cartes « Par où commencer ? »).
- `docs/feuille-de-route.md`, E1 (galerie humaine / IA).

## Accueil et galeries

- Accueil : texte de bienvenue, puis défilement des images de la galerie (flèches, points, pause, défilement automatique à partir de deux images ; sans JavaScript, la piste défile au doigt).
- Puis « Par où commencer ? » : quatre cartes, les quatre pages de Découvrir (`lib/livres.mjs#PAR_OU_COMMENCER`), avec le titre et le résumé de la page. La phrase « Première visite ? » et le bouton « Découvrir Maverick » ne disent que la navigation.
- `/galeries/` : toutes les images.
- Une image = un fichier dans `public/` + une entrée de `GALERIE` (`lib/galerie.mjs`). En construction : le logo seul (`galerieEnConstruction`).

## Tests

- `test/galerie.test.mjs`.
- `test/site-html.test.mjs` : accueil et galeries (site construit, CI après le build).

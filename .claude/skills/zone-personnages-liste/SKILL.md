---
name: zone-personnages-liste
description: "Recherche des personnages (/personnages/, « Personnages » de l'Espace joueur) : filtres, liste à 5 colonnes triable, ligne entière en lien vers la fiche, bordure aux couleurs des magies. À charger avant de lire, modifier ou relire cette page, son script, son module ou ses tests."
paths: ["client/src/pages/personnages.astro", "client/src/scripts/personnages.mjs", "client/src/lib/personnages-liste.mjs", "client/src/styles/personnages/**", "client/test/personnages-liste.test.mjs"]
user-invocable: false
---
# Recherche des personnages (`/personnages/`)

## Fichiers

- `pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs`, `styles/personnages/`.
- La fiche elle-même : skill `zone-fiche`. Le service qui sert les fiches et leur portrait : skill `zone-service`.

## À lire

- `docs/character-generator.md`, « La page `/personnages/` ».

## La page (« Personnages » de l'Espace joueur)

- Filtres, puis une liste de 5 colonnes seulement : portrait, nom, race, magies (« Innée, Acquise »), niveau (demande du propriétaire).
- Triée par chaque colonne sauf le portrait.
- Toute la ligne est le lien vers la fiche, bordée de la couleur de la magie innée, en dégradé vers l'acquise en bi-magie (`couleursDeBordure`, couleurs posées au build).
- Le portrait vient de `GET /api/personnages/<id>/portrait/`.
- Filtres et tri dans l'adresse.
- Ni phrase d'introduction ni bouton de création.
- `lib/personnages-liste.mjs` est importé côté navigateur : sans dépendance navigateur ni Astro (skill `site-version-portable`).

## Tests

- `test/personnages-liste.test.mjs`.

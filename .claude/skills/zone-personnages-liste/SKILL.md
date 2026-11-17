---
name: zone-personnages-liste
description: "Recherche des personnages (/personnages/, « Personnages » de l'Espace joueur) : filtres, liste à 6 colonnes triable, ligne entière en lien vers la fiche, bordure aux couleurs des magies. À charger avant de lire, modifier ou relire cette page, son script, son module ou ses tests."
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

- Filtres, puis une liste de 6 colonnes seulement : portrait, nom, race, magies (« Innée, Acquise »), classes, niveau (demande du propriétaire).
- Classes : par rang, chacune suivie de sa spécialité entre parenthèses s'il en a une, « Guerrier (Épéiste), Mage » : la classe telle que la base la donne, la spécialité avec juste une majuscule et le reste en minuscules (`lib/personnages-liste.mjs#casseDeSpecialite`, demande du propriétaire) ; la base et la fiche gardent leur casse, le tri ignore la casse (`#classesDe`, résumé `GET /api/personnages/` : `classes[].classe`, `classes[].specialite`).
- Triée par chaque colonne sauf le portrait.
- Toute la ligne est le lien vers la fiche, bordée de la couleur de la magie innée, en dégradé vers l'acquise en bi-magie : la page pose au build les classes de la palette de chaque magie (`data-couleurs` : `[classe, classe de second rang]`, `lib/palette-css.mjs#classesDeDeuxMagies`), le script pose sur la ligne `perso--magie`, la classe de l'innée et la classe de second rang de l'acquise (`classesDeBordure`), jamais une couleur ; `liste.css` en tire `--magie-1`, `--magie-2` (skill `ui-couleurs`). Le module, importé par le navigateur, n'importe pas la palette.
- Le portrait vient de `GET /api/personnages/<id>/portrait/`.
- Filtres et tri dans l'adresse.
- Ni phrase d'introduction ni bouton de création.
- `lib/personnages-liste.mjs` est importé côté navigateur : sans dépendance navigateur ni Astro (skill `site-version-portable`).

## Tests

- `test/personnages-liste.test.mjs`.

---
name: zone-archives
description: "Page /archives/ (menu Outils) : les Google Docs et Sheets (registre de la migration 0014, manifeste sources/sources.json) et l'ancien wiki Fandom, documents retirés, copies du propriétaire. À charger avant de lire, modifier ou relire cette page, lib/archives.mjs ou leurs tests."
paths: ["client/src/pages/archives.astro", "client/src/lib/archives.mjs", "client/src/styles/archives/**", "client/test/archives.test.mjs"]
user-invocable: false
---
# Archives (`/archives/`, menu Outils)

## Fichiers

- `pages/archives.astro`, `lib/archives.mjs`, `styles/archives/`.
- Manifeste et rapprochement des classeurs : skill `sources-rapprochement`.

## La page

- Les Google Docs et Sheets (registre de la migration 0014 + manifeste `sources/sources.json`, avec les pages et onglets qui les citent d'après la base) et l'ancien wiki Fandom.
- Ni « Familiers » ni « Prototype » (`DOCUMENTS_RETIRES`, demande du propriétaire) ; la migration 0019 retire aussi leurs liens de la base.
- Le CODEX Maverick et le Bestiaire 2.0 passent par les copies que le propriétaire en a faites depuis (entrée du manifeste dont `original` cite l'identifiant d'origine), l'original en second lien.
- `lib/archives.mjs` lit les fichiers par `node:fs` (`lireArchives`) : ne pas l'importer côté navigateur.

## Tests

- `test/archives.test.mjs`.
- `test/site-html.test.mjs` : `/archives/`, les documents sources et l'ancien wiki (site construit, CI après le build).

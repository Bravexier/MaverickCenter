---
name: zone-races
description: "Pages de race (/races/<race>/) rendues depuis les tables de l'onglet, liste /races/ en pastilles, relations entre peuples, races et magies (champs structurés, races pures et hybrides). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/races-db.mjs", "client/src/lib/races.ts", "client/src/lib/race-*.mjs", "client/src/lib/corps-races.mjs", "client/src/components/race/**", "client/src/styles/race/**", "client/src/components/magie/TableauMagiesInnees.astro", "client/test/race*.test.mjs", "client/test/corps-races.test.mjs", "tools/db/races_onglet.py", "tools/sheets/races.py", "tools/sheets/relations-races.py"]
user-invocable: false
---
# Pages de race et liste des races

## Fichiers
- Lecture de la base : `client/src/lib/races-db.mjs`, `lib/races.ts`.
- Gabarit : `components/race/RacePage.astro`, `RaceRelations.astro` ; CSS `client/src/styles/race/`.
- Relations entre peuples : `lib/race-relations.mjs`.
- Pures ou hybrides, ordre et couleurs : `lib/race-kinds.mjs` (`ORDRE_DES_RACES`, `RACE_COLORS`, `HYBRIDES_SANS_CLASSE_RACIALE`).
- Liste `/races/` : `components/race/RacesPastilles.astro`, `styles/race/liste.css` ; tableau des magies innées : `components/magie/TableauMagiesInnees.astro`.
- Liens races et magies : `lib/magie-relations.mjs` (partagé avec skill `zone-magies`).
- Import : `tools/sheets/races.py` (`RACE_DETAIL_OVERRIDES`), `tools/db/races_onglet.py`, `tools/sheets/relations-races.py` (la page `lore/relations-entre-les-races`, onglet « Relation entre les races ») ; corps Markdown tenu d'accord : `lib/corps-races.mjs` (skill `zone-edition`).

## À lire
- `docs/content-guide.md`, « Pages de race : un gabarit commun, alimenté par la base ».
- `docs/content-guide.md`, « Champs structurés (races et magies) » (priorité des sources, exception du Nain, races pures et hybrides, liste des races, tableaux des magies).

## Invariants
- Une page de race est rendue depuis les tables, jamais depuis son `.md` (recherche et `[[liens]]` seulement). Aucun tableau Markdown. Pour changer une race, on change la base.
- L'onglet de la race est la source (décision R13) : tables `race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, `mode_hyper_effet` version `onglet_race` (migration `0007-races-onglet`, tirée des pages par `tools/db/races_onglet.py`, dont `--verifier` tourne dans `test/races-onglet.test.mjs`).
- Magies innées : la matrice de la fiche (R8), sauf `race_magie_onglet` qui prime (R11).
- Relations : la case (ligne A, colonne B) de « Relation entre les races » dit comment A voit B (R12, vue `v_regard_peuple`).
- `lib/race-relations.mjs` ne regroupe jamais deux peuples dont les relations diffèrent (Elfe Noir Charbon / Salé).
- Le CSS est dans `client/src/styles/race/`, inséré par `RacePage.astro` en `?raw` seulement, comme celui des magies.
- Les champs structurés des pages (`magies_innees`, `nom_court`, `resiste_a`, `vulnerable_a`, `incompatible_avec`) sont posés par `tools/sheets/races.py` et `magies.py` et déclarés dans `client/src/content.config.ts` : un champ non déclaré est supprimé par Astro.
- Exception explicite : la liste du Nain vient de l'onglet « Nain » de « Les races » (`RACE_DETAIL_OVERRIDES` dans `races.py`), pas de la matrice.
- Hybride = a une classe raciale, plus le Drassah'thac (décision R14). Distinction races pures / hybrides : `lib/magie-relations.mjs`, `lib/race-kinds.mjs`.
- `RACE_COLORS` (couleurs pure et hybride) est la source unique, partagée par la liste et les pages de race.

## Choix du propriétaire
- Sur la page : ni écarts avec la fiche V15.2.2, ni sous-races ou valeurs de la fiche, ni sources, ni liste des classes accessibles ; seule la classe raciale d'une race hybride, dans le bandeau.
- Liste `/races/` dans l'ordre du propriétaire (`ORDRE_DES_RACES`), pures et hybrides côte à côte, une pastille par race comme les classes (`RacesPastilles.astro`, `styles/race/liste.css`), accroche en infobulle, ni magies ni classe raciale.
- Le site tire des champs structurés les liens et deux tableaux : magies innées en bas de `/races/`, relations sous la carte de `/magies/` (skill `zone-magies`). Magies dans l'ordre du classeur et dans leur couleur, sans défilement horizontal (`styles/magie/tableaux.css`). L'ancienne page `/wiki/races-et-magies/` est supprimée.

## Tests
- `client/test/races-html.test.mjs` : site construit (CI après le build).
- `races-onglet.test.mjs` (`races_onglet.py --verifier`), `race-relations.test.mjs`, `race-kinds.test.mjs`, `races-magies-content.test.mjs`, `races-magies-innees-liste.test.mjs`, `races-detail-content.test.mjs`, `corps-races.test.mjs`.

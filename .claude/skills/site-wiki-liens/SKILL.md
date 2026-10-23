---
name: site-wiki-liens
description: "Pages du wiki fabriquées depuis la base (client/src/content/wiki), index et résolution des [[liens]] (wikilinks.mjs, wiki.ts), adresses /<type>/<slug>/ et renvois de la page 404, HIDE_EXAMPLES, Markdown d'Astro 7, maillage. À charger avant de lire, modifier ou relire ces fichiers."
paths: ["client/astro.config.mjs", "client/src/content.config.ts", "client/src/lib/wikilinks.mjs", "client/src/lib/wiki.ts", "client/src/lib/types.mjs", "client/src/lib/autolink.mjs", "client/src/pages/?type?/**", "client/src/pages/pages.astro", "client/src/pages/404.astro", "client/scripts/db-export-pages.mjs", "client/scripts/autolink*", "client/test/wikilinks.test.mjs", "client/test/autolink.test.mjs", "client/test/site-html.test.mjs"]
user-invocable: false
---
# Pages du wiki et liens

`client/` est le site Astro 7 statique (wiki et générateur), le code actif du projet. Tests : `client/test/`, `node:test`, lancés par `npm test`.

## Fichiers

- `client/src/content/wiki/<type>/*.md` : les pages du wiki (types dans `src/lib/types.mjs`).
- `client/src/lib/wikilinks.mjs` : index des pages (`scanContent`, `buildIndex`), résolution des `[[liens]]` (`resolve`, `extractLinks`), plugin remark (`remarkWikilinks`).
- `client/src/lib/wiki.ts` : chargement des pages (`loadWiki`) et graphe (liens sortants, rétroliens).
- `client/src/content.config.ts` : la collection `wiki` et son `generateId`.
- `client/astro.config.mjs` : processeur Markdown et index des liens du plugin.
- `client/src/pages/[type]/` : une page à `/<type>/<slug>/` ; `client/src/pages/pages.astro` : l'index alphabétique.
- `client/src/pages/404.astro` : renvois des anciennes adresses.

## À lire

- `docs/content-guide.md`, « Écrire des pages du wiki » (frontmatter, catégories), « Liens entre pages », « Statuts », « Conventions », « Maillage automatique ».
- `docs/sql/remplissage.md`, « Les pages du wiki viennent de la base » et « Qui met quoi à jour ».
- Pour modifier, créer ou supprimer une page : skill `modifier-une-page-wiki` (procédure pas à pas).

## Invariants

- Les `.md` de `client/src/content/wiki/` sont fabriqués depuis `data/rows` par `npm run db:export-pages` (lancé avant `dev`, `build` et `test` : `predev`, `prebuild`, `pretest`) et ignorés par git. La source est la base. Pour changer une page : modifier le `.md` fabriqué, puis `npm run db:sync-pages`, puis commiter `data/rows`.
- Astro 7 utilise Sätteri comme processeur Markdown par défaut, qui n'exécute pas les plugins remark. `astro.config.mjs` force `unified()` de `@astrojs/markdown-remark` pour le plugin des `[[liens]]` (et ceux des couleurs de case et des monnaies) : ne pas le retirer.
- L'index des liens du plugin est lu une fois au démarrage (`scanContent`) ; les pages (`wiki.ts`) sont rechargées par Astro. Les deux doivent rester d'accord sur l'id d'une page (`<type>/<slug>`, d'où `generateId` dans `content.config.ts`). Après l'ajout d'un nouveau fichier de contenu, relancer `npm run dev`.
- `HIDE_EXAMPLES=1` filtre les pages d'exemple (`status: example`) à deux endroits qui doivent rester d'accord : `scanContent` (index des liens, dans `astro.config.mjs`) et `loadWiki` (`src/lib/wiki.ts`). La base ouverte au build (`lib/donnees.mjs#ouvrirBase`) le suit aussi. `HIDE_EXAMPLES=1 npm run build` donne la version à montrer.
- Les liens `[[…]]` cassés produisent un avertissement `[wikilinks]` au build.
- Astro met le rendu Markdown en cache dans `client/node_modules/.astro/` (clé = contenu du fichier). Après une modification du plugin des `[[liens]]` sans toucher aux pages, supprimer ce dossier avant de reconstruire, sinon l'ancien rendu est réutilisé (la CI repart de zéro).

## Adresses (demande du propriétaire)

- Plus de préfixe `/wiki/`. Une page est à `/<type>/<slug>/` (`src/pages/[type]/`). Un métier n'a pas de page : sa ligne de `/metiers/` (skill `zone-metiers`, `cheminDePage`).
- L'index alphabétique (« Index du wiki », « Pages à créer ») est à `/pages/`. Le dossier `src/content/wiki/`, la collection `wiki` et `lib/wiki.ts` gardent leur nom.
- Le pied d'une page (`components/PiedDePage.astro`) : mots-clés, pages mentionnées, rétroliens ; plus de sources (seulement sur `/archives/`, réponse du propriétaire du 2026-10-22).
- Une ancienne adresse `/wiki/…` est renvoyée vers la nouvelle par la page 404 (`legacyWikiRedirect`, `lib/nav.mjs`, testé dans `test/nav.test.mjs`).
- Une page `guide/…` est à l'adresse que lui donne le plan du site (`lib/livres.mjs`, skill `zone-guide`), jamais sous `/guide/`. Ses anciennes adresses `/guide/…` sont renvoyées par la page 404 : renvois calculés au build (`lib/metiers.mjs#renvoisDuGuide`), passés au script par `data-renvois` (`nav.mjs` n'importe pas le plan).

## Maillage automatique

`npm run autolink` (aperçu) ou `npm run autolink -- --write` (écrit dans les `.md` fabriqués, à faire suivre de `npm run db:sync-pages`). Règles, exclusions (`TYPES_SANS_MAILLAGE` de `src/lib/autolink.mjs`, `client/scripts/autolink-ignore.txt`) : `docs/content-guide.md`, « Maillage automatique ».

## Tests

- `test/wikilinks.test.mjs`, `test/autolink.test.mjs`, `test/nav.test.mjs` (`legacyWikiRedirect`).
- `test/site-html.test.mjs` contrôle le site construit (adresses sans `/wiki/`) ; la CI le lance après le build.

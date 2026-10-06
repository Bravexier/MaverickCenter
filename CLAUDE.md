# Maverick Center — contexte pour Claude

Dépôt de projets autour de **Maverick JDR** (jeu de rôle high fantasy) :
un **wiki** de pages interconnectées par mots-clés et un **générateur de fiche de personnage**.
Interface et contenu en **français** ; identifiants de code, noms de fonctions et commits en anglais ou français, comme le code voisin.

## Règle d'or : ne jamais inventer de règles

Les règles et le lore viennent du Discord « L'univers de Maverick » et de Google Docs/Sheets (voir `docs/sources.md`,
manifeste `sources/sources.json`). Ne pas déduire une règle, une statistique ou un nom du lore « par vraisemblance » :
la citer depuis une source (`sources:` dans le frontmatter) ou la laisser absente. Les pages et données
`status: example` / `meta.status: "example"` sont des **fixtures de démonstration**, pas du lore.

## Accès aux sources

- Depuis une session cloud, Discord et `docs.google.com` sont **bloqués** par la politique réseau
  (l'utilisateur peut les autoriser dans les paramètres de l'environnement) et aucun connecteur Discord n'existe.
- Ne jamais utiliser un jeton Discord personnel. Voir `docs/sources.md` pour les alternatives (export local, bot).
- Le contenu brut importé va dans `sources/raw/` (Docs/Sheets) et `sources/discord/` ; le wiki ne lit que `client/src/content/wiki/`.

## Structure

| Chemin | Rôle |
| --- | --- |
| `client/` | Site Astro 7 statique (wiki + générateur). Le code actif du projet. |
| `client/src/content/wiki/<type>/*.md` | Pages du wiki (types dans `src/lib/types.mjs`) |
| `client/src/lib/wikilinks.mjs` | Index des pages, résolution des `[[liens]]`, plugin remark |
| `client/src/lib/wiki.ts` | Chargement des pages + graphe (liens sortants, rétroliens, tags) |
| `client/src/lib/character.mjs` | Moteur de fiche (fonctions pures, piloté par `src/data/rules.json`) |
| `client/src/data/rules.json` | Règles de création de personnage |
| `client/test/` | Tests `node:test` (`npm test`) |
| `tools/import-gdocs.mjs` | Export des Google Docs/Sheets listés dans `sources/sources.json` |
| `deploy/` | Paquet d'hébergement NAS (nginx + Docker, mot de passe), `build.sh` qui le génère, `update-nas.sh` (mise à jour auto depuis la branche `site`) |
| `.github/workflows/publish-site.yml` | Après chaque fusion dans `main` : tests, build `HIDE_EXAMPLES=1`, publication sur la branche `site` (refuse si le dépôt n'est pas privé) |
| `tools/build-artifact.mjs` | Version « portable » (liens relatifs, CSS/JS inline) publiée comme page privée claude.ai |
| `api/` | Services CRUD de personnages (Node sans dépendance + .NET). Non utilisés par le site pour l'instant. |
| `docs/` | `sources.md`, `content-guide.md`, `character-generator.md` |

## Commandes (depuis `client/`, Node ≥ 22.12)

```bash
npm install
npm run dev        # http://localhost:4321 — relancer après l'ajout d'un NOUVEAU fichier de contenu
npm run build      # build statique dans dist/ ; les [[liens]] cassés produisent un avertissement [wikilinks]
npm test           # tests unitaires + intégrité de rules.json
HIDE_EXAMPLES=1 npm run build   # version à montrer : sans les pages `status: example`
```

Déploiement sous un sous-chemin : `SITE_BASE=/MaverickCenter/ SITE_URL=https://… npm run build`.

## Pièges connus

- **Astro 7** utilise Sätteri comme processeur Markdown par défaut, qui n'exécute pas les plugins remark.
  `astro.config.mjs` force `unified()` de `@astrojs/markdown-remark` pour le plugin des `[[liens]]` : ne pas le retirer.
- L'index des liens du plugin est lu une fois au démarrage (`scanContent`) ; les pages (`wiki.ts`) sont, elles, rechargées par Astro.
  Les deux doivent rester d'accord sur l'id d'une page (`<type>/<slug>`, d'où `generateId` dans `content.config.ts`).
- `src/lib/*.mjs` doit rester sans dépendance navigateur/Astro (`text.mjs`, `search.mjs`, `character.mjs` sont importés
  côté navigateur ; `wikilinks.mjs` utilise `node:fs` et ne doit pas l'être).
- `HIDE_EXAMPLES=1` filtre les pages d'exemple à deux endroits qui doivent rester d'accord : `scanContent` (index des liens,
  dans `astro.config.mjs`) et `loadWiki` (`src/lib/wiki.ts`).
- La publication claude.ai (`node tools/build-artifact.mjs --out <dossier>`) impose : liens relatifs avec `index.html` explicite,
  accueil écrit en fragment (sans `<html>`/`<head>`/`<body>`), aucun script/CSS externe, pas d'impression ni de téléchargement
  (boutons masqués), et au plus 255 fichiers par publication (le script écrit `batch-N.json`). Détail dans le commentaire du script.
- Astro met le rendu Markdown en cache dans `client/node_modules/.astro/` (clé = contenu du fichier). Si vous modifiez le plugin
  des `[[liens]]` sans toucher aux pages, supprimez ce dossier avant de reconstruire, sinon l'ancien rendu est réutilisé (la CI repart de zéro).
- La page `/wiki/classes/` range les classes par catégorie (Physiques > Mêlée/Distance, Magiques, Raciales, Autres) d'après les tags
  posés par l'import (catégorie du Sommaire du classeur) : `client/src/lib/class-groups.mjs`, testé. « Raciales » = « Classe Hybride Animal » ;
  le Parleur (classé mêlée dans le classeur) est volontairement sous « Autres » (`CLASS_OVERRIDES`, décision du propriétaire).
- Races ↔ magies : les pages portent des listes structurées (`magies_innees`, `nom_court`, `resiste_a`, `vulnerable_a`, `incompatible_avec`)
  posées par `tools/sheets/races.py` et `magies.py` ; le site en tire les liens, les tableaux de `/wiki/races-et-magies/` et la distinction
  races pures / hybrides (`lib/magie-relations.mjs`, `lib/race-kinds.mjs`). Voir `docs/content-guide.md`. Les champs sont déclarés dans `content.config.ts`
  (un champ non déclaré est supprimé par Astro). Exception explicite : la liste du Nain vient de l'onglet « Nain » de « Les races » (`RACE_DETAIL_OVERRIDES` dans `races.py`), pas de la matrice.
- Capacités de classe : une page `capacites/<classe>-<nom>` par capacité ; les capacités d'une même ligne de l'onglet sont un choix exclusif
  (`choix_exclusif_avec`, symétrique), une spécialité exclut l'autre ; l'Archimage n'a pas de spécialité mais des groupes par palier
  (`lib/capacites.mjs`, `lib/classe-bonus.mjs`, `test/capacites-content.test.mjs`). Le +4 AM d'une classe raciale se lit dans le texte de la capacité
  de niveau 10 de sa 2ᵉ spécialité (« considérer comme classe magique »). Voir `docs/content-guide.md`.
- `npm run autolink` (aperçu) / `-- --write` : maillage automatique des pages, voir `docs/content-guide.md`.
- Le générateur ne gère ni compétences, ni équipement, ni dés (voir `docs/character-generator.md`).

## Conventions de travail

- Toute logique de règle ou de lien nouvelle → test dans `client/test/`.
- `rules.test.mjs` doit rester vert quand de vraies données remplacent l'exemple.
- Ne pas modifier `api/` sans demande : c'est l'existant d'avant le site.

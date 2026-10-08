# Maverick Center — contexte pour Claude

Dépôt de projets autour de **Maverick JDR** (jeu de rôle high fantasy) :
un **wiki** de pages interconnectées par mots-clés et un **générateur de fiche de personnage**.
Interface et contenu en **français** ; identifiants de code, noms de fonctions et commits en anglais ou français, comme le code voisin.

## Règle d'or : ne jamais inventer de règles

Les règles et le lore viennent du Discord « L'univers de Maverick » et de Google Docs/Sheets (voir `docs/sources.md`,
manifeste `sources/sources.json`). Ne pas déduire une règle, une statistique ou un nom du lore « par vraisemblance » :
la citer depuis une source (`sources:` dans le frontmatter) ou la laisser absente. Les pages et données
`status: example` / `meta.status: "example"` sont des **fixtures de démonstration**, pas du lore.

## Décisions du propriétaire

`docs/decisions-regles.md` : les choix tranchés quand les sources se contredisent (27 races, mono-classe, budgets exacts, Calme, Mode Hyper +15/+7, Archimage magique…).
Les suivre ; ne jamais en déduire d'autres.

## Vision à long terme

Le NAS est temporaire (migration à prévoir). Le site doit devenir une source rapide et navigable des règles et du lore, puis permettre de modifier sorts, dons,
classes et races pour remplacer à terme Google Docs/Sheets, et enfin simuler des combats pour juger l'équilibrage. Voir `docs/feuille-de-route.md` : identifiants
stables, SQL portable, modifications historisées, règles en données, moteur pur partagé, rien de spécifique au NAS hors de `deploy/`.

## Accès aux sources

- Depuis une session cloud, Discord et `docs.google.com` sont **bloqués** par la politique réseau
  (l'utilisateur peut les autoriser dans les paramètres de l'environnement) et aucun connecteur Discord n'existe.
- Ne jamais utiliser un jeton Discord personnel. Voir `docs/sources.md` pour les alternatives (export local, bot).
- Le contenu brut importé va dans `sources/raw/` (Docs/Sheets) et `sources/discord/` ; le wiki lit des pages fabriquées dans `client/src/content/wiki/` (voir plus bas : elles viennent de la base).

## Structure

| Chemin | Rôle |
| --- | --- |
| `client/` | Site Astro 7 statique (wiki + générateur). Le code actif du projet. |
| `client/src/content/wiki/<type>/*.md` | Pages du wiki (types dans `src/lib/types.mjs`) : **fabriquées depuis `data/rows` par `npm run db:export-pages`** (lancé avant `dev`, `build` et `test`), **ignorées par git**. La source est la base ; pour changer une page : modifier le `.md` fabriqué puis `npm run db:sync-pages` et commiter `data/rows` |
| `client/src/lib/wikilinks.mjs` | Index des pages, résolution des `[[liens]]`, plugin remark |
| `client/src/lib/wiki.ts` | Chargement des pages + graphe (liens sortants, rétroliens, tags) |
| `client/src/lib/magies-db.mjs`, `sort-format.mjs`, `components/MagiePage.astro`, `styles/magie.css` | Pages de magie : gabarit commun alimenté par les **tables typées** de la base (magie, sort, invocation…), **pas** par le Markdown ; un tableau par NPM, détails d'un sort sous sa ligne (voir `docs/content-guide.md`, « Pages de magie ») |
| `client/src/lib/character.mjs` | Moteur de fiche (fonctions pures, piloté par `src/data/rules.json`) |
| `client/src/data/rules.json` | Règles de création de personnage |
| `client/test/` | Tests `node:test` (`npm test`) |
| `tools/import-gdocs.mjs` | Export des Google Docs/Sheets listés dans `sources/sources.json` |
| `deploy/` | Hébergement (nginx + Docker, mot de passe). **Avant la 1.0** : `build.sh` → zip, `update-nas.sh` suit la branche `site`. **À partir de la 1.0** : `installateur.sh` (modèle) et `fabriquer-installateur.mjs` → un installateur `.sh` autonome par livraison, mode **prod** (serveur normal) ou **test** (copie le `db/` du serveur normal à l'installation) ; `update-nas.sh` exécute le dernier du mode de l'instance (lu dans `VERSION`) ; `build.sh prod\|test` en fabrique un à la main |
| `tools/flux-git/`, `.github/workflows/` | Flux Git (`docs/flux-git.md`) : `regles.mjs` (pur, testé), `cli.mjs` (le bot) ; `garde-branches.yml` (création et PR), `livraison.yml` (versions, puis le site sur la branche `site` avant la 1.0 ou les installateurs en *releases* ensuite ; refuse si le dépôt n'est pas privé), `ci.yml` ; règles GitHub importables dans `.github/rulesets/` |
| `tools/build-artifact.mjs` | Version « portable » (liens relatifs, CSS/JS inline) publiée comme page privée claude.ai |
| `data/schema.sql`, `data/rows/` | **Base SQLite** : structure (136 tables STRICT, FTS5, 29 vues) et lignes versionnées (991 pages + 7 domaines). Depuis `client/` : `npm run db:build` (→ `var/maverick.db`, ignoré par git), `db:check`, `db:pages-check` / `db:sync-pages` (pages des `.md` → `data/rows`), `db:init` (base vide), `db:doc` (régénère `docs/sql/structure.md` et `apercu.md`), `db:migrate` (changement de schéma : `data/migrations/`). Chaque table d'entités a une colonne `remarque` (texte libre, vide par défaut) qui reprend les notes de cellule des classeurs. Le site en tire ses pages (fichiers `.md` fabriqués au build) et l'onglet **DB** (`/donnees/` : toutes les tables, et la base en téléchargement `/donnees/maverick.db`) ; les lignes typées ne se réimportent pas encore depuis les classeurs. Voir `docs/sql/remplissage.md`. |
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
- Pages de magie : rendues depuis la base (`lib/magies-db.mjs`, `lib/magies.ts`), jamais depuis leur `.md` (qui ne sert qu'à la recherche et aux `[[liens]]`) ; la remarque d'un sort
  (note de cellule) est `sort.remarque`, la table `note_cellule` n'est qu'une trace et ne doit pas être lue. Le panneau d'un sort s'ouvre sous sa ligne (script de `MagieSorts.astro`, sans JavaScript tout est affiché).
  Leur CSS est dans `styles/magie.css`, inséré par `MagiePage.astro` (`?raw`) : ne pas le mettre dans `global.css` ni l'importer (Astro l'attacherait à toutes les pages de la route `[type]/[slug]`).
  La matrice de `/wiki/races-et-magies/` lit les mêmes relations dans la base (`entriesAvecRelationsDeLaBase`).
  Dans le panneau d'un sort, remarque et texte du sort sont dans le même cadre « Effets » que les effets secondaires ; les altérations d'état sont des pastilles **dans le texte** (`morceauxAvecEtats`, d'après `sort_etat`) avec infobulle (`Bulles.astro` : une bulle ne contient que des `<span>`, sinon le `<p>` qui la porte se ferme) ;
  les créatures invoquées ont une fiche minimale au clic, sous leur bloc. Pas de légende, pas de source citée (ni par sort, ni en pied de page), pas de liste des lanceurs sur ces pages.
  `test/magies-html.test.mjs` contrôle le site construit (ids, `aria-*`, bulles, éléments retirés) : il se saute sans `dist/` et la CI le lance après le build.
- Races ↔ magies : les pages portent des listes structurées (`magies_innees`, `nom_court`, `resiste_a`, `vulnerable_a`, `incompatible_avec`)
  posées par `tools/sheets/races.py` et `magies.py` ; le site en tire les liens, les tableaux de `/wiki/races-et-magies/` et la distinction
  races pures / hybrides (`lib/magie-relations.mjs`, `lib/race-kinds.mjs`). Voir `docs/content-guide.md`. Les champs sont déclarés dans `content.config.ts`
  (un champ non déclaré est supprimé par Astro). Exception explicite : la liste du Nain vient de l'onglet « Nain » de « Les races » (`RACE_DETAIL_OVERRIDES` dans `races.py`), pas de la matrice.
- Capacités de classe : une page `capacites/<classe>-<nom>` par capacité ; les capacités d'une même ligne de l'onglet sont un choix exclusif
  (`choix_exclusif_avec`, symétrique), une spécialité exclut l'autre ; l'Archimage n'a pas de spécialité mais des groupes par palier
  (`lib/capacites.mjs`, `lib/classe-bonus.mjs`, `test/capacites-content.test.mjs`). Le +4 AM d'une classe raciale se lit dans le texte de la capacité
  de niveau 10 de sa 2ᵉ spécialité (« considérer comme classe magique »). Voir `docs/content-guide.md`.
- Orthographe des sorts et des magies : corrigée **dans la base** par la migration de données `0003-orthographe-magies` (500 corrections, registre `.json` ; test `client/test/orthographe-magies.test.mjs`).
  Un nom de sort fautif n'est pas corrigé à la main : son identifiant (`<magie>#sort:<nom_cle>`) changerait. Les points en attente du propriétaire sont dans `docs/sql/orthographe-a-valider.md`.
- Niveaux de maîtrise (NM) des sorts : `sort_bonus_maitrise` (une ligne par expression de NM écrite dans une cellule, exhaustive, typée seulement quand l'écriture est sans ambiguïté) et la colonne `sort.bonus_maitrise` (« Bonus Maîtrise »), `sort_mode` + `sort.mode_brut`
  (le mode IC / imparable / inesquivable, séparé du type), vue `v_sort_bonus_au_nm` et `lib/sort-maitrise.mjs` (lecture « à N NM », même résultat en SQL et en JavaScript). Les tableaux de magie montrent la valeur de base dans Coût / Portée / Zone / D/S/B
  (`sansBonus`) et les bonus dans la colonne Maîtrise. Voir `docs/content-guide.md`, « Niveaux de maîtrise ». Ne rien calculer ni déduire d'une expression de NM.
- `npm run autolink` (aperçu) / `-- --write` : maillage automatique des pages, voir `docs/content-guide.md`.
- Le générateur ne gère ni compétences, ni équipement, ni dés (voir `docs/character-generator.md`).

## Conventions de travail

- **Branches** (`docs/flux-git.md`, décision du propriétaire) : `master` = production, `dev` = intégration. Ne créer que `feature/<nom>` depuis `origin/dev`
  (PR vers `dev`) ou `hotfix/<nom>` depuis `origin/master` (PR vers `master`) ; toute autre branche poussée (`claude/…`, `dev/…`, `main`…) est supprimée par la garde,
  et `dev/…` ne peut pas exister à côté de `dev`. Ne jamais modifier la version de `client/package.json` : le bot la tient après chaque fusion.
- **Fusion** : une fois la PR `feature/<nom>` → `dev` créée et la CI verte, la fusionner sans attendre le propriétaire (consigne permanente). Une livraison
  `dev` → `master` ou un hotfix → `master` : seulement à la demande du propriétaire, par « Create a merge commit ». Ne jamais mettre `[V: X+1]` de soi-même :
  le passage en 1.0 est le signal du propriétaire (connexion Discord, serveurs normal et de test).
- Toute logique de règle ou de lien nouvelle → test dans `client/test/`.
- `rules.test.mjs` doit rester vert quand de vraies données remplacent l'exemple.
- Ne pas modifier `api/` sans demande : c'est l'existant d'avant le site.

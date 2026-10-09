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

`docs/decisions-regles.md` : les choix tranchés quand les sources se contredisent (27 races, mono-classe, budgets exacts, Calme, Mode Hyper +15/+7, Archimage magique, sens des relations entre peuples, onglet de race source, Drassah'thac hybride, Corruption et Potentiel Illimité mono-magie, puissance magique 5 au niveau 16, 2 santé pour 1 chakra manquant, croix des caractéristiques, Corruption acquise des Elfes noirs Charbon et Felfes noirs…).
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
| `client/src/lib/magies-db.mjs`, `sort-format.mjs`, `components/MagiePage.astro`, `styles/magie.css` | Pages de magie : gabarit commun alimenté par les **tables typées** de la base (magie, sort, invocation…), **pas** par le Markdown ; un tableau par NPM (`TableauNpm.astro`), détails d'un sort sous sa ligne ; Potentiel Illimité : les autres magies en onglets (voir `docs/content-guide.md`, « Pages de magie ») |
| `client/src/lib/races-db.mjs`, `race-relations.mjs`, `components/race/RacePage.astro`, `styles/race/` | Pages de race : même principe que les magies, alimentées par les **tables** de la base (`race_onglet`, `race_don`…, relations entre peuples), **pas** par le Markdown ; aucun tableau Markdown (voir `docs/content-guide.md`, « Pages de race ») |
| `client/src/lib/classes-db.mjs`, `classe-dons.mjs`, `components/classes/ClassePage.astro`, `styles/classe/` | Pages de classe : même principe, alimentées par les **tables** (`classe`, `specialite`, `capacite`, `v_capacite_exclusive`…) ; les **dons** (« capacités » des onglets) disposés comme l'onglet, chaque choix encadré (voir `docs/content-guide.md`, « Pages de classe ») |
| `client/src/lib/metiers.mjs`, `components/metier/MetiersTableau.astro`, `styles/metier/tableau.css` | Page des métiers : un long tableau (Nom, Bonus, Artisanat, Équipement supplémentaire) lu dans la table `metier`, la description sous la ligne ; **pas de page par métier**, tout lien vers un métier mène à sa ligne (voir `docs/content-guide.md`, « Métiers ») |
| `client/src/lib/guide.mjs`, `guide-db.mjs`, `guide-fil-rouge.mjs`, `components/guide/`, `styles/guide/` | Guide du joueur (`/guide/`) : 24 chapitres (pages `guide/…` avec `chapitre` et `partie`) lus dans l'ordre, flèches, pagination par partie colorée ; tableaux et personnages fil rouge tirés de la base (voir `docs/content-guide.md`, « Guide du joueur ») |
| `client/src/lib/character.mjs` | Moteur de fiche (fonctions pures, piloté par `src/data/rules.json`) |
| `client/src/data/rules.json` | Règles de création de personnage |
| `client/test/` | Tests `node:test` (`npm test`) |
| `tools/import-gdocs.mjs` | Export des Google Docs/Sheets listés dans `sources/sources.json` |
| `deploy/` | Paquet d'hébergement NAS (nginx + Docker, mot de passe) **jusqu'à la 1.0**, inchangé : `build.sh` qui le génère, `update-nas.sh` (mise à jour auto depuis la branche `site`, reconstruite depuis `dev`). `deploy/installateur/` : l'hébergement **à partir de la 1.0** — `installateur.sh` (modèle) et `fabriquer.mjs` → un installateur `.sh` autonome par livraison, mode **prod** (serveur normal) ou **test** (copie le `db/` du serveur normal à l'installation) ; `mise-a-jour.sh` exécute le dernier du mode de l'instance ; `fabriquer.sh prod\|test` à la main |
| `tools/flux-git/`, `.github/workflows/` | Flux Git (`docs/flux-git.md`) : `regles.mjs` (pur, testé), `cli.mjs` (le bot) ; `garde-branches.yml` (création, PR, et balayage de toutes les branches toutes les 6 h), `livraison.yml` (versions, puis le site sur la branche `site` avant la 1.0 ou les installateurs en *releases* ensuite ; refuse si le dépôt n'est pas privé), `ci.yml` ; règles GitHub importables dans `.github/rulesets/` |
| `tools/build-artifact.mjs` | Version « portable » (liens relatifs, CSS/JS inline) publiée comme page privée claude.ai |
| `data/schema.sql`, `data/rows/` | **Base SQLite** : structure (160 tables STRICT, FTS5, 34 vues) et lignes versionnées (1015 pages + 7 domaines ; les 18 tables des fiches de personnages et des groupes de jeu, section 13, restent vides). Depuis `client/` : `npm run db:build` (→ `var/maverick.db`, ignoré par git), `db:check`, `db:pages-check` / `db:sync-pages` (pages des `.md` → `data/rows`), `db:init` (base vide), `db:doc` (régénère `docs/sql/structure.md` et `apercu.md`), `db:migrate` (changement de schéma : `data/migrations/`). Chaque table d'entités a une colonne `remarque` (texte libre, vide par défaut) qui reprend les notes de cellule des classeurs. Le site en tire ses pages (fichiers `.md` fabriqués au build) et l'onglet **DB** (`/donnees/` : toutes les tables, et la base en téléchargement `/donnees/maverick.db`) ; les lignes typées ne se réimportent pas encore depuis les classeurs. Voir `docs/sql/remplissage.md`. |
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
- **Adresses** (demande du propriétaire) : plus de préfixe `/wiki/`. Une page est à `/<type>/<slug>/` (`src/pages/[type]/` ; un métier : sa ligne de `/metiers/`, voir plus bas), l'index alphabétique (« Index du wiki », « Pages à créer »)
  à `/pages/` ; le dossier `src/content/wiki/`, la collection `wiki` et `lib/wiki.ts` gardent leur nom. Une ancienne adresse `/wiki/…` est renvoyée vers la nouvelle par la page 404
  (`legacyWikiRedirect`, `lib/nav.mjs`, testé). `test/site-html.test.mjs` contrôle le site construit (CI après le build).
- **En-tête** (`layouts/Base.astro`, `styles/global/site-shell.css`) : le logo officiel (`public/logo.webp`, redimensionné) remplace le titre et mène à l'accueil ; rubriques et recherche
  sur la même bande, à droite du logo, entrées de la rubrique dessous (sous-grille ; sous 60rem, le menu passe sous le logo). La hauteur de la bande est celle du menu, pas du logo
  (demande du propriétaire) : l'image est en absolu dans le lien, qui garde sa largeur, et la pointe de l'épée dépasse sous la bordure (`test/site-html.test.mjs`). Les icônes `favicon.png` (32 px) et `apple-touch-icon.png`
  sont tirées du même logo.
- La publication claude.ai (`node tools/build-artifact.mjs --out <dossier>`) impose : liens relatifs avec `index.html` explicite,
  accueil écrit en fragment (sans `<html>`/`<head>`/`<body>`), aucun script/CSS externe, pas d'impression ni de téléchargement
  (boutons masqués), et au plus 255 fichiers par publication (le script écrit `batch-N.json`). Détail dans le commentaire du script.
- Astro met le rendu Markdown en cache dans `client/node_modules/.astro/` (clé = contenu du fichier). Si vous modifiez le plugin
  des `[[liens]]` sans toucher aux pages, supprimez ce dossier avant de reconstruire, sinon l'ancien rendu est réutilisé (la CI repart de zéro).
- La page `/classes/` présente 5 colonnes côte à côte, une par catégorie (Physiques Mêlée, Physiques Distance, Magiques, Raciales, Spéciales), d'après les tags
  posés par l'import (catégorie du Sommaire du classeur) : `client/src/lib/class-groups.mjs`, testé ; chaque classe y est une **pastille sur le modèle de la carte des magies** (pas de tableau,
  demande du propriétaire) : `components/classes/ClassesPastilles.astro`, CSS `styles/classe/liste.css` (`?raw`).
  « Raciales » = « Classe Hybride Animal » ; « Spéciales » = « Classe Hybride » + « Classe spéciale » ; le Parleur (classé mêlée dans le classeur) est volontairement sous « Spéciales »
  (`CLASS_OVERRIDES`, décision du propriétaire). Chaque colonne a la couleur de sa catégorie, le résumé est en infobulle (`Bulles.astro`). **« (classe) » est supprimé de partout, base comprise** (demande du propriétaire, migration `0009-classes-sans-suffixe`) :
  une classe raciale porte le nom de sa race (titre « Orios », page `classes/orios`) ; `tools/sheets/classes.py` n'ajoute plus de suffixe ; `[[classes/orios]]` / `[[races/orios]]` lèvent l'ambiguïté d'un lien.
  `test/classes-html.test.mjs` contrôle la page construite (pastilles, couleurs, infobulles).
- Pages de magie : rendues depuis la base (`lib/magies-db.mjs`, `lib/magies.ts`), jamais depuis leur `.md` (qui ne sert qu'à la recherche et aux `[[liens]]`) ; la remarque d'un sort
  (note de cellule) est `sort.remarque`, la table `note_cellule` n'est qu'une trace et ne doit pas être lue. Le panneau d'un sort s'ouvre sous sa ligne (script de `SortsInteractifs.astro`, sans JavaScript tout est affiché).
  Leur CSS est dans `styles/magie.css`, inséré par `MagiePage.astro` (`?raw`) : ne pas le mettre dans `global.css` ni l'importer (Astro l'attacherait à toutes les pages de la route `[type]/[slug]`).
  Le tableau des relations sous la carte de `/magies/` (`TableauRelationsMagies.astro`) lit les mêmes relations dans la base (`entriesAvecRelationsDeLaBase`).
  La carte elle-même (`MagiesConstellation.astro`) montre, **au survol d'une magie seulement** (grand écran), ses relations : un trait par magie liée, **épée** au bout de la magie vulnérable,
  **bouclier** au bout de celle qui résiste, boucle pour « résiste à elle-même » (`lib/magie-fleches.mjs`, demandes du propriétaire), ou, selon la bascule à côté de la légende, l'infobulle de description (« Afficher les relations », par défaut, / « Afficher les détails », jamais les deux) ; le **Potentiel Illimité au centre**, disposition symétrique
  choisie pour qu'aucun trait ne passe sous une pastille (testé) : voir `docs/content-guide.md`, « La carte de `/magies/` ».
  Dans le panneau d'un sort, remarque et texte du sort sont dans le même cadre « Effets » que les effets secondaires ; les altérations d'état sont des pastilles **dans le texte** (`morceauxAvecEtats`, d'après `sort_etat`) avec infobulle (`Bulles.astro` : une bulle ne contient que des `<span>`, sinon le `<p>` qui la porte se ferme) ;
  les créatures invoquées ont une fiche minimale au clic, sous leur bloc. Pas de légende, pas de source citée (ni par sort, ni en pied de page), pas de liste des lanceurs sur ces pages.
  Demandes du propriétaire : encart de l'**altération d'état liée** (`etat_magie`) entre la présentation et les résistances (`MagieEtats.astro`) ; « Magie non compatible » sans le Potentiel Illimité,
  et « Mono-magie uniquement » pour une magie `magie.mono_magie` (Potentiel Illimité, Corruption excepté Elfe Noir Charbon et Felfe Noir : décision R15, migration `0010-mono-magie`, `lib/magie-non-compatible.mjs`) ;
  un (+) à côté de « Capacité Mode Hyper » au lieu du lien en texte ; « Disponibilité par race » = une seule liste, dans l'ordre de `/races/`, sans les races qui n'ont pas la magie.
  Un seul gabarit de tableau de sorts, `components/magie/TableauNpm.astro` (une magie, un NPM ; ligne `LigneDeSort.astro`, script `SortsInteractifs.astro`). La page du **Potentiel Illimité** (pas de sorts à lui)
  montre à la place 14 onglets, un par autre magie, avec ses tableaux du NPM 1 au NPM 4 (demande du propriétaire ; NPM 3 d'après son Explication, NPM 4 avec le don « Semi-complet » de l'Archimage niveau 20 ; `SortsDuPotentiel.astro`, `lib/potentiel-illimite.mjs`) ; ids préfixés du nom court
  de la magie (`#sort-feu-boule-de-feu`). Onglets : `components/Onglets.astro`, partagé avec les spécialités des classes (un composant et non un module importé : la version portable refuse un script qui en importe un autre).
  `test/magies-html.test.mjs` contrôle le site construit (ids, `aria-*`, bulles, éléments retirés) : il se saute sans `dist/` et la CI le lance après le build.
- Pages de race : rendues depuis la base (`lib/races-db.mjs`, `components/race/`), jamais depuis leur `.md` (recherche et `[[liens]]` seulement). L'onglet de la race est la source (décision R13) :
  tables `race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, `mode_hyper_effet` version `onglet_race` (migration `0007-races-onglet`, tirée des pages par `tools/db/races_onglet.py`, dont `--verifier`
  tourne dans `test/races-onglet.test.mjs`) ; ni écarts avec la fiche V15.2.2, ni sous-races ou valeurs de la fiche, ni sources, ni liste des classes accessibles (seule la classe raciale d'une race hybride, dans le bandeau). Magies innées : matrice de la fiche (R8), sauf `race_magie_onglet` (R11).
  Relations : la case (ligne A, colonne B) de « Relation entre les races » dit comment A voit B (R12, vue `v_regard_peuple`) ; `lib/race-relations.mjs` ne regroupe jamais deux peuples dont les relations diffèrent
  (Elfe Noir Charbon / Salé). CSS dans `styles/race/`, inséré par `RacePage.astro` (`?raw`). `test/races-html.test.mjs` contrôle le site construit (CI après le build).
- Races ↔ magies : les pages portent des listes structurées (`magies_innees`, `nom_court`, `resiste_a`, `vulnerable_a`, `incompatible_avec`)
  posées par `tools/sheets/races.py` et `magies.py` ; le site en tire les liens, les deux tableaux (magies innées en bas de `/races/`, relations sous la carte de `/magies/` ;
  l'ancienne page `/wiki/races-et-magies/` est supprimée ; magies dans l'ordre du classeur et dans leur couleur, sans défilement horizontal, `styles/magie/tableaux.css`) et la distinction
  races pures / hybrides (`lib/magie-relations.mjs`, `lib/race-kinds.mjs` : hybride = classe raciale, plus le Drassah'thac, décision R14). La liste `/races/` suit l'ordre
  du propriétaire (`ORDRE_DES_RACES`), pures et hybrides côte à côte, une **pastille** par race comme les classes (`components/race/RacesPastilles.astro`, `styles/race/liste.css`), accroche en infobulle, ni magies ni classe raciale ; couleurs pure/hybride = `RACE_COLORS`, partagées avec les pages de race. Voir `docs/content-guide.md`. Les champs sont déclarés dans `content.config.ts`
  (un champ non déclaré est supprimé par Astro). Exception explicite : la liste du Nain vient de l'onglet « Nain » de « Les races » (`RACE_DETAIL_OVERRIDES` dans `races.py`), pas de la matrice.
- Pages de classe : rendues depuis la base (`lib/classes-db.mjs`, `components/classes/ClassePage.astro`), jamais depuis leur `.md`. Les « capacités » s'affichent **Dons** (demande du propriétaire ; type `capacites`,
  table `capacite` et ids inchangés, libellé dans `type_page` par la migration `0008-dons-de-classe`, que `db:check` compare à `types.mjs`). Les dons suivent la disposition de l'onglet (`lib/classe-dons.mjs#plateauDeDons`),
  les choix sont ceux de `v_capacite_exclusive`, encadrés avec « ou », options côte à côte ; les spécialités sont des **onglets** (premier à gauche, second à droite ; script `components/Onglets.astro`,
  un lien `#don-…` ouvre le bon onglet, sans JavaScript tout est affiché). Couleur de la page d'après la catégorie de `/classes/` (`classColor` : rouge mêlée, vert distance, bleu magiques,
  violet raciales, jaune spéciales). CSS dans `styles/classe/`, inséré par `ClassePage.astro` (`?raw`). `test/classes-html.test.mjs` contrôle le site construit (CI après le build).
- Métiers : **pas de page par métier** (demande du propriétaire) ; `/metiers/` est un tableau tiré de la table `metier` (`lib/metiers.mjs#chargerMetiers`), description sous la ligne.
  Les pages `metiers/<slug>` restent (recherche, mots-clés, `[[liens]]`) mais `[slug].astro` ne les construit pas : tout lien vers une page passe par `cheminDePage` (via `entryHref`, `pageHref`, `entryUrl`),
  qui renvoie un métier à `/metiers/#metier-<slug>` ; ne pas écrire `${id}/` à la main. Seule « Règles des métiers » (`PAGE_DES_REGLES`) garde sa page.
  `test/metiers-html.test.mjs` vérifie qu'aucun lien du site construit ne mène à une page de métier.
- Dons de classe (« capacités ») : une page `capacites/<classe>-<nom>` par don ; les dons d'une même ligne de l'onglet sont un choix exclusif
  (`choix_exclusif_avec`, symétrique), une spécialité exclut l'autre ; l'Archimage n'a pas de spécialité mais des groupes par palier
  (`lib/capacites.mjs`, `lib/classe-bonus.mjs`, `test/capacites-content.test.mjs`). Le +4 AM d'une classe raciale se lit dans le texte de la capacité
  de niveau 10 de sa 2ᵉ spécialité (« considérer comme classe magique »). Voir `docs/content-guide.md`.
- Orthographe : corrigée **dans la base** par des migrations de données, sorts et magies (`0003-orthographe-magies`, 500 corrections) puis **toute la base** (`0005-orthographe-base` :
  pages, classes, capacités, races, bestiaire, équipement, guides, lore et tables typées ; 2 247 corrections relues deux fois, 56 noms à clé inchangée), puis les **noms** (`0006-orthographe-noms` :
  décision du propriétaire, sens le plus probable et, pour un nom propre écrit de plusieurs façons, graphie majoritaire ; 741 occurrences, 147 clés recalculées). Chaque migration a son registre `.json`
  et son test (`client/test/orthographe-magies.test.mjs`, `orthographe-base.test.mjs`, `orthographe-noms.test.mjs`). Une phrase corrigée l'est partout où elle est écrite (page, résumé, tables typées, extraits, notes de cellule),
  jamais dans les citations « telles quelles » de la fiche V15.2.2 (tableaux des écarts des races), ni dans `source`, `ecart_source`, `alias`, `page_tag`, `commentaire_orphelin` (empreinte de son texte), ni dans une adresse ou un lien.
  Un nom corrigé l'est partout (titres, noms typés, textes, cibles des `[[liens]]`) et sa clé `X_cle` est recalculée, mais **son identifiant ne change jamais** : depuis 0006, aucune table ne dérive plus l'id
  du nom (sort, classe, invocation, créature et leurs attaques et capacités gardent la clé du nom d'origine ; une page renommée garde son adresse). L'écriture de la source gardée comme trace
  (`gemmes_brut`, `nom_source`, `race_brut`) n'est pas corrigée. Les points en attente du propriétaire sont dans `docs/sql/orthographe-a-valider.md`.
  Les tests qui citent un texte de la base (notes de cellule « texte intégral ») suivent ces corrections ; leurs entrées synthétiques (qui imitent le classeur) gardent le texte d'origine.
- Niveaux de maîtrise (NM) des sorts : `sort_bonus_maitrise` (une ligne par expression de NM écrite dans une cellule, exhaustive, typée seulement quand l'écriture est sans ambiguïté) et la colonne `sort.bonus_maitrise` (« Bonus Maîtrise »), `sort_mode` + `sort.mode_brut`
  (le mode IC / imparable / inesquivable, séparé du type), vue `v_sort_bonus_au_nm` et `lib/sort-maitrise.mjs` (lecture « à N NM », même résultat en SQL et en JavaScript). Les tableaux de magie n'ont pas de colonne Maîtrise : l'expression de NM d'une cellule
  (« (-5/NM) ») est une pastille `.nm` à sa place, à côté de la valeur (`marquerBonus`), celle du type suit les types et le mode ; `sansBonus` donne la valeur de base. Voir `docs/content-guide.md`, « Niveaux de maîtrise ». Ne rien calculer ni déduire d'une expression de NM.
- **Guide** (`/guide/`) : un livre de chapitres, pas une liste (demande du propriétaire). Le premier chapitre (`guide/bienvenue`) est servi à `/guide/`
  (`adresseDePage`, comme les métiers) ; `[slug].astro` ne le construit pas. Chaque chapitre déclare `chapitre: N` et `partie:` (`lib/guide.mjs#PARTIES`, une couleur par partie) ;
  un trou de numérotation ou une partie inconnue arrête le build. Les tableaux viennent de la base par `<!-- guide:<bloc> -->` (jamais recopiés), les personnages
  fil rouge de `lib/guide-fil-rouge.mjs` (leurs choix seulement ; les chiffres sont calculés). Les autres pages `guide/…` restent des pages de référence, listées
  à la dernière page. Une page ajoutée à la main doit avoir une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse — et
  `db:export-pages` efface alors le `.md` : vérifier la sortie de `db:sync-pages` avant d'exporter. `test/guide.test.mjs` épingle le plan.
- `npm run autolink` (aperçu) / `-- --write` : maillage automatique des pages, voir `docs/content-guide.md`.
- Le générateur ne gère ni compétences, ni équipement, ni dés (voir `docs/character-generator.md`).
- **Fiches de personnages** (section 13 de `data/schema.sql`, migration `0011-personnages`) : les tables gardent les **choix** du joueur (race, ethnie, magies, classes, caractéristiques de base et croix (R19), points de compétences,
  gains de niveau, dons à choix, sorts et NM, équipement), cellule de la fiche auto V15.2.2 citée en commentaire ; **rien de ce que la fiche calcule n'est stocké** (niveaux, santé, totaux…).
  `v_personnage_niveau` (R2) et `v_personnage_controle` (une ligne par règle enfreinte, vide pour une fiche `valide`) ; `test/personnages-db.test.mjs` écrit dans une copie de la base.
  Demande du propriétaire : fiche de **joueur** (visible de lui seul et des administrateurs, ouvrable à des utilisateurs désignés, à tous les MJ ou à tous) ou **prétiré** (à personne, visible par tous) ;
  **groupes** de jeu (one-shot, campagne) : une fiche inscrite par membre et par groupe, visible des membres de ce groupe ; rôles cumulables `mj`, `editeur`, `admin` (`utilisateur_role`).
  Qui voit quoi : `v_personnage_visible` ; inscriptions : `v_groupe_controle` (voir `docs/character-generator.md`, « Fiches dans la base »).
  Les tables restent **vides dans `data/rows`** (les fiches réelles vivront dans la base du serveur, jamais dans git ni dans `/donnees/maverick.db`). Les bugs de la fiche relevés (non reproduits) sont dans `docs/sql/a-valider.md` §3.

## Conventions de travail

- **Branches** (`docs/flux-git.md`, décision du propriétaire) : `master` = production, `dev` = intégration. Ne créer que `feature/<nom>` depuis `origin/dev`
  (PR vers `dev`) ou `hotfix/<nom>` depuis `origin/master` (PR vers `master`), après `git fetch --prune origin` ; toute autre branche poussée (`claude/…`, `dev/…`,
  `main`…) est supprimée par la garde, et `dev/…` ne peut pas exister à côté de `dev`. Ne jamais modifier la version de `client/package.json` : le bot la tient
  après chaque fusion. Fusionner toujours par « Create a merge commit » (ni squash ni rebase). Après la fusion, le bot supprime la branche `feature/…` ou
  `hotfix/…` : une suite de travail repart d'une nouvelle branche. **Nom de branche** (demande du propriétaire) : `<nom>` dit l'évolution ou le correctif demandé,
  en minuscules et tirets (`feature/npm5-info-apres-titre`, `hotfix/lien-casse-bestiaire`), jamais le nom aléatoire que propose l'environnement
  (`feature/awesome-pascal-…`) : renommer la branche avant le premier push. **En cas de conflit avec la base, ne jamais fusionner la base dans la branche : rebase**
  (`git rebase origin/dev`, puis `git push --force-with-lease` ; demande du propriétaire, voir `docs/flux-git.md`).
- **Fusion** : une fois la PR `feature/<nom>` → `dev` créée et la CI verte, la fusionner sans attendre le propriétaire (consigne permanente). Une livraison
  `dev` → `master` ou un hotfix → `master` : seulement à la demande du propriétaire, par « Create a merge commit ». Ne jamais mettre `[V: X+1]` de soi-même :
  le passage en 1.0 est le signal du propriétaire (connexion Discord, serveurs normal et de test).
- Toute logique de règle ou de lien nouvelle → test dans `client/test/`.
- `rules.test.mjs` doit rester vert quand de vraies données remplacent l'exemple.
- Ne pas modifier `api/` sans demande : c'est l'existant d'avant le site.

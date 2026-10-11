# Maverick Center — contexte pour Claude

Dépôt de projets autour de **Maverick JDR** (jeu de rôle high fantasy) :
un **wiki** de pages interconnectées par mots-clés et un **générateur de fiche de personnage**.
Interface et contenu en **français** ; identifiants de code, noms de fonctions et commits en anglais ou français, comme le code voisin.
**Claude répond toujours en français** au propriétaire (demande du propriétaire) : messages, comptes rendus, questions et corps des PR, du début à la fin de chaque session, même quand le reste du contexte est en anglais.

## Règle d'or : ne jamais inventer de règles

Les règles et le lore viennent du Discord « L'univers de Maverick » et de Google Docs/Sheets (voir `docs/sources.md`,
manifeste `sources/sources.json`). Ne pas déduire une règle, une statistique ou un nom du lore « par vraisemblance » :
la citer depuis une source (`sources:` dans le frontmatter) ou la laisser absente. Les pages et données
`status: example` / `meta.status: "example"` sont des **fixtures de démonstration**, pas du lore.

## Décisions du propriétaire

`docs/decisions-regles.md` : les choix tranchés quand les sources se contredisent (27 races, mono-classe, budgets exacts, Calme, Mode Hyper +15/+7, Archimage magique, sens des relations entre peuples, onglet de race source, Drassah'thac hybride, Corruption et Potentiel Illimité mono-magie, quota de maîtrise d'arme des classes et de leurs dons, puissance magique 5 au niveau 16, 2 santé pour 1 chakra manquant, croix des caractéristiques, Corruption acquise des Elfes noirs Charbon et Felfes noirs, déesse de la Corruption « Eaunoire », Corruption innée de la Lamia, Archimage réservée au Potentiel Illimité qui l'impose, Mage Bleu fermé au Potentiel Illimité, NM de livre ou du MJ et 3 NM au plus sur un sort, pas d'emplacement de sort en plus, Lamia à une seule magie, couleurs des notes de version, 3 magies innées des hybrides = simple constat, liste des magies innées qui fait foi sur la phrase des inconvénients, quota de maîtrise d'arme, bonus de métier en Acquis (rogné au plafond) ou à l'initiative et aux vitesses avec choix dans la fiche, artisanat = 10 × ses 2 caractéristiques (−20 par croix), équipement du métier = objets de départ aux options écrites en entier, acquis au plus 5 par point de caractéristique totale, fiches : élément supprimé retiré avec une note datée, élément modifié suivi (R42), deux spécialités au plus (R43), dons aux niveaux 1, 5, 10, 15 ou 20 (R44)…).
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
- Les documents Google sont des **copies dans le Drive du propriétaire** (dossier « Maverick JDR », 2026-10-10 ; l'ancien mainteneur est parti) : manifeste, extracteurs et base les citent
  (migration `0014-sources-copies-drive`, registre `.json` ancien → nouvel identifiant). La **fiche auto corrigée V1.2** (copie de la V1.1) et ce qui reste à trancher : `docs/fiche-auto.md`.

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
| `client/src/lib/metiers.mjs`, `metier-champs.mjs`, `components/metier/MetiersTableau.astro`, `styles/metier/tableau.css` | Page des métiers : un long tableau (Nom, Bonus, Artisanat, Caractéristiques, Équipement supplémentaire) lu dans les tables `metier`, `metier_bonus`, `metier_objet_depart`, la description sous la ligne ; bonus liés aux compétences (pastilles) ou à l'initiative, artisanat en texte + 2 caractéristiques, objets de départ (décisions R33 à R35) ; **pas de page par métier**, tout lien vers un métier mène à sa ligne (voir `docs/content-guide.md`, « Métiers ») |
| `client/src/lib/guide.mjs`, `guide-db.mjs`, `guide-fil-rouge.mjs`, `components/guide/`, `styles/guide/` | Guide du joueur (`/guide/`) : 24 chapitres (pages `guide/…` avec `chapitre` et `partie`) lus dans l'ordre, page sur toute la largeur, flèches par-dessus en bas de l'écran (et glissement du doigt sur mobile), pagination par partie colorée ; tableaux et personnages fil rouge tirés de la base (voir `docs/content-guide.md`, « Guide du joueur ») |
| `client/src/pages/fiche/index.astro`, `src/scripts/fiche.mjs`, `lib/fiche-regles.mjs`, `lib/fiche-moteur.mjs`, `lib/fiche-controles.mjs`, `lib/maitrise-arme.mjs`, `lib/resistance-texte.mjs`, `styles/fiche/` | **Fiche de personnage** (`/fiche/`, `/fiche/?id=<id>`) : création et modification d'un prétiré sur le même écran, un bloc par étape du guide (couleurs de ses parties), sans numéro, en rangées (identité · magies · classes, attributs · progression, caractéristiques · sorts, maîtrises d'armes, équipement · notes), races/magies/classes en pastilles ; règles tirées de la base au build (`/fiche/regles.json`), calculs purs et testés contre les vues de la base et le fil rouge du guide, enregistrement par le service (`/api/`) ; voir `docs/character-generator.md` |
| `client/src/pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs`, `styles/personnages/` | **Recherche des personnages** (`/personnages/`, « Listes » du menu Personnages) : filtres, tableau trié par chaque colonne, filtres et tri dans l'adresse |
| `client/src/lib/nav.mjs`, `layouts/Base.astro` | **Menu** (arborescence du propriétaire) : Règles, Personnages, Inventaire, Codex, Outils ; une entrée sans `path` est « bientôt » ; `autres` = pages de la rubrique hors menu (`ressources/` ouvre l'Inventaire) ; `test/nav.test.mjs` épingle le plan |
| `client/src/pages/index.astro`, `components/galerie/Carrousel.astro`, `lib/galerie.mjs`, `pages/galeries.astro`, `styles/accueil/`, `styles/galerie/` | **Accueil** : texte de bienvenue et défilement des images de la galerie (flèches, points, pause, défilement automatique à partir de deux images ; sans JavaScript la piste défile au doigt) ; **Galeries** (`/galeries/`) : toutes les images. Une image = un fichier dans `public/` + une entrée de `GALERIE` (en construction : le logo seul) |
| `client/src/pages/recherche.astro`, `lib/search.mjs`, `styles/recherche/` | **Recherche** (`/recherche/`, menu Outils ; plus de barre dans l'en-tête) : mêlée aux mots-clés — tous sans recherche, ceux qui correspondent sinon (`filtrerMotsCles`), puis les pages ; `/tags/` y renvoie (page 404) |
| `client/src/pages/mise-a-jour.astro`, `src/scripts/mise-a-jour.mjs`, `lib/notes-de-version*.mjs`, `serveur/notes-de-version.mjs`, `scripts/mise-a-jour-*.mjs`, `scripts/db-reference.mjs`, `.github/workflows/mise-a-jour.yml` | **Mise à jour** (`/mise-a-jour/`, menu Outils ; `docs/serveur.md`, « Mise à jour ») : en production, la note de version de la dernière livraison (tables `note_version`, `note_version_ligne`, section 15) et l'historique ; sur le site de dev, en plus, la note en préparation (production = base de master construite au build, `donnees/reference.db`, comparée à la base vivante : `comparerBases`), couleurs R29 (`notes-de-version-sens.mjs`), champ libre (`note_version_brouillon`), les boutons « Simulation de mise à jour » (rien n'est poussé) et « Effectuer la mise à jour » : lot figé → workflow `mise-a-jour.yml` (lot rejoué sur `data/rows` sans toucher d'autres tables, PR vers dev fusionnée si verte, puis livraison dev → master) |
| `client/src/pages/archives.astro`, `lib/archives.mjs`, `styles/archives/` | **Archives** (`/archives/`, menu Outils) : les Google Docs/Sheets (registre de la migration 0014 + manifeste `sources/sources.json`, pages et onglets qui les citent d'après la base) et l'ancien wiki Fandom ; ni « Familiers » ni « Prototype » (`DOCUMENTS_RETIRES`, demande du propriétaire : la migration 0019 retire aussi leurs liens de la base) ; les deux docs non copiés (CODEX Maverick, Bestiaire 2.0) sur l'original, avec leur titre |
| `client/test/` | Tests `node:test` (`npm test`) |
| `tools/import-gdocs.mjs` | Export des Google Docs/Sheets listés dans `sources/sources.json` |
| `deploy/` | Paquet d'hébergement NAS (nginx + service des personnages dans Docker, mot de passe) **jusqu'à la 0.2.0** : `build.sh` qui le génère, `update-site.sh` (installe la branche `site`, reconstruite depuis `dev`, dans un dossier et la tient à jour : le NAS — une installation existante garde sa copie `update-nas.sh` — et, avant la 0.2.0, le serveur de test du VPS). Les `.sh` et tout `deploy/` restent en LF (`.gitattributes`) : ils partent tels quels sur un serveur Linux, même depuis un clone Windows. `deploy/installateur/` : l'hébergement **à partir de la 0.2.0** — `installateur.sh` (modèle) et `fabriquer.mjs` → un installateur `.sh` autonome par livraison, mode **prod** (serveur normal) ou **test** (copie le `db/` du serveur normal à l'installation) ; `mise-a-jour.sh` exécute le dernier du mode de l'instance ; `fabriquer.sh prod\|test` à la main `deploy/vps/` : le serveur (VPS) des deux instances — `durcir.sh`, `outils.sh`, `instances.sh` (dossiers, `.env` avec ports sur `127.0.0.1`, `MAVERICK_BASE_TEST=conservee` et `MAVERICK_EDITION=1` pour le test, mots de passe internes présentés par Caddy), `Caddyfile` (`maverick-jdr.com` → 8080, `dev.maverick-jdr.com` → 8081), `README.md` pas à pas (dont « Avant la 0.2.0 » : le serveur de test seul, sur la branche `site`) ; `test/deploy-vps.test.mjs`. |
| `tools/flux-git/`, `.github/workflows/` | Flux Git (`docs/flux-git.md`) : `regles.mjs` (pur, testé), `cli.mjs` (le bot) ; `garde-branches.yml` (création, PR, et balayage de toutes les branches toutes les 6 h), `livraison.yml` (versions et leur étiquette — `VX.Y.Z` sur `dev`, `VX.Y` sur `master`, demande du propriétaire —, puis le site sur la branche `site` avant la 0.2.0 ou les installateurs en *releases* ensuite ; refuse si le dépôt n'est pas privé), `ci.yml` ; règles GitHub importables dans `.github/rulesets/` |
| `tools/build-artifact.mjs` | Version « portable » (liens relatifs, CSS/JS inline) publiée comme page privée claude.ai |
| `data/schema.sql`, `data/rows/` | **Base SQLite** : structure (168 tables STRICT, FTS5, 35 vues) et lignes versionnées (1015 pages + 7 domaines ; les 19 tables des fiches de personnages et des groupes de jeu, section 13, et les 3 du journal de l'édition et du brouillon de la note de version, section 14, restent vides ; section 15 : les notes de version et l'historique des modifications du site). Depuis `client/` : `npm run db:build` (→ `var/maverick.db`, ignoré par git), `db:check`, `db:pages-check` / `db:sync-pages` (pages des `.md` → `data/rows`), `db:init` (base vide), `db:doc` (régénère `docs/sql/structure.md` et `apercu.md`), `db:migrate` (changement de schéma : `data/migrations/`), `db:appliquer-edition -- <journal.json>` (rapatrie les modifications du site de dev : journal rejoué sur `data/rows`, versé dans `historique_modification`, réécrit par `tools/db/exporter.py`). Chaque table d'entités a une colonne `remarque` (texte libre, vide par défaut) qui reprend les notes de cellule des classeurs. Le site en tire ses pages (fichiers `.md` fabriqués au build) et l'onglet **DB** (`/donnees/` : toutes les tables, et la base en téléchargement `/donnees/maverick.db`) ; les lignes typées ne se réimportent pas encore depuis les classeurs. Voir `docs/sql/remplissage.md`. |
| `client/serveur/` | **Mode client / serveur** (`docs/serveur.md`) : le service des personnages (Node ≥ 22.13, `node:sqlite`, **aucun paquet npm**) qui répond sous `/api/` (prétirés : liste, lecture, création, modification avec `version`, contrôles de `v_personnage_controle`) et écrit dans la **base vivante** `db/vivante.db` = copie de `site/donnees/maverick.db` + lignes de la section 13, refaite quand les règles changent (fiches reprises ; un don, une spécialité, un sort ou un métier disparu en est retiré avec une note datée, R42, `serveur/fiches-retraits.mjs`, liste dans `/api/etat` ; toute autre référence rompue : rien ne change et `/api/etat` dit pourquoi ; archives dans `db/archives/`). Livré **avec le site** : `serveur/livraison.mjs` (intégration Astro) le copie dans `dist/_serveur/` avec `version.json` ; format d'une fiche partagé avec les pages : `src/lib/fiche-format.mjs`. Sur le site de dev seulement (`MAVERICK_EDITION=1`), l'**édition des règles** : `/api/edition/`, `serveur/edition.mjs` (un lot d'un bloc, tout ce qui dépend d'un champ recalculé), journal `serveur/edition-journal.mjs` (section 14, rejoué quand les règles changent) ; supprimer un don, une spécialité ou un métier qu'une fiche utilise l'en retire (R33, réponse `fiches` du lot) |
| `src/scripts/edition.mjs`, `src/scripts/edition/`, `lib/edition-modele.mjs`, `edition-rendu.mjs`, `markdown-edition.mjs`, `markdown-couleurs.mjs`, `components/edition/Edition.astro`, `styles/edition/` | **Mode modification** (demande du propriétaire : site de dev et ordinateur seulement ; `docs/serveur.md`, « Édition ») : crayon à cocher, bouton « Enregistrer » flottant ; champs `data-ed` des pages du guide, des races, des magies, des classes et des métiers ; création de races, peuples, classes, métiers, spécialités et dons ; suppression des métiers, spécialités et dons (D11 : `lib/dons-edition.mjs`, extension `edition/classes.mjs`, rendu pur `lib/classe-dons-rendu.mjs` sur `lib/classe-assemblage.mjs`) ; éditeur en place du texte du guide (HTML → Markdown) ; surcouche des lignes modifiées depuis la construction |
| `api/` | Services CRUD de personnages d'avant le site (Node sans dépendance + .NET). Non utilisés par le site ; le service actif est `client/serveur/`. |
| `docs/` | `sources.md`, `content-guide.md`, `character-generator.md`, `fiche-auto.md` (fiche Google corrigée V1.2) |

## Commandes (depuis `client/`, Node ≥ 22.12)

```bash
npm install
npm run dev        # http://localhost:4321 — relancer après l'ajout d'un NOUVEAU fichier de contenu
npm run serveur    # le service des personnages (http://127.0.0.1:8787/api/, base vivante dans var/serveur/) : `npm run dev` lui transmet /api/
npm run build      # build statique dans dist/ ; les [[liens]] cassés produisent un avertissement [wikilinks]
npm test           # tests unitaires (et du service, des règles de la base…)
HIDE_EXAMPLES=1 npm run build   # version à montrer : sans les pages `status: example`
```

Déploiement sous un sous-chemin : `SITE_BASE=/MaverickCenter/ SITE_URL=https://… npm run build`.

## Pièges connus

- **Astro 7** utilise Sätteri comme processeur Markdown par défaut, qui n'exécute pas les plugins remark.
  `astro.config.mjs` force `unified()` de `@astrojs/markdown-remark` pour le plugin des `[[liens]]` : ne pas le retirer.
- L'index des liens du plugin est lu une fois au démarrage (`scanContent`) ; les pages (`wiki.ts`) sont, elles, rechargées par Astro.
  Les deux doivent rester d'accord sur l'id d'une page (`<type>/<slug>`, d'où `generateId` dans `content.config.ts`).
- `src/lib/*.mjs` doit rester sans dépendance navigateur/Astro (`text.mjs`, `search.mjs`, `fiche-moteur.mjs`, `fiche-format.mjs`, `personnages-liste.mjs`
  sont importés côté navigateur ; `wikilinks.mjs` utilise `node:fs` et ne doit pas l'être). Le code qui touche au DOM d'une page va dans `src/scripts/`
  (`fiche.mjs`, `personnages.mjs`) ; deux scripts de page ne doivent jamais importer le même module (la version portable refuse le module partagé
  que Vite en ferait : `tools/build-artifact.mjs`, CI).
- `HIDE_EXAMPLES=1` filtre les pages d'exemple à deux endroits qui doivent rester d'accord : `scanContent` (index des liens,
  dans `astro.config.mjs`) et `loadWiki` (`src/lib/wiki.ts`).
- **Adresses** (demande du propriétaire) : plus de préfixe `/wiki/`. Une page est à `/<type>/<slug>/` (`src/pages/[type]/` ; un métier : sa ligne de `/metiers/`, voir plus bas), l'index alphabétique (« Index du wiki », « Pages à créer »)
  à `/pages/` ; le dossier `src/content/wiki/`, la collection `wiki` et `lib/wiki.ts` gardent leur nom. Une ancienne adresse `/wiki/…` est renvoyée vers la nouvelle par la page 404
  (`legacyWikiRedirect`, `lib/nav.mjs`, testé). `test/site-html.test.mjs` contrôle le site construit (CI après le build).
- **En-tête** (`layouts/Base.astro`, `styles/global/site-shell.css`) : le logo officiel (`public/logo.webp`, redimensionné) remplace le titre et mène à l'accueil ; rubriques
  sur la même bande, à droite du logo, entrées de la rubrique dessous (sous 60rem, le menu passe sous le logo). **Pas de barre de recherche** (demande du propriétaire) : la recherche
  est une page du menu Outils, mêlée aux mots-clés. La hauteur de la bande est celle du menu, pas du logo
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
  **bouclier** au bout de celle qui résiste, boucle pour « résiste à elle-même » (`lib/magie-fleches.mjs`, demandes du propriétaire), au survol ou au focus clavier (`:focus-visible`, pas `:focus-within` : un clic laissait les relations affichées au retour arrière) ; **pas d'infobulle** sur la carte, légende sur une ligne ; le **Potentiel Illimité au centre**, disposition symétrique
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
  Règles des métiers (décisions R33 à R40, migrations `0024-metiers-fiche`, `0025-metiers-precisions`) : un bonus vise une compétence (`metier_bonus.competence_id`, son Acquis,
  rogné au plafond : R38) ou un attribut (`attribut` : initiative, vitesse, vitesse de nage ; `ATTRIBUT_DE_CIBLE`), un rang à plusieurs compétences se choisit dans la fiche (`personnage_metier_bonus`, `v_personnage_metier_bonus`) ; l'artisanat = un texte + 2 caractéristiques
  (10 × chacune, constante `metier.artisanat_par_point_caracteristique`) ; l'équipement = des objets de départ (`metier_objet_depart`) ajoutés à l'inventaire. Les cellules du
  tableau sont les rendus de `lib/edition-rendu.mjs` (un seul HTML avec le mode modification) ; sur le site de dev, l'artisanat se modifie en texte + deux listes
  (`artisanat_brut` en est recalculé, jamais saisi). Un nom de compétence dans « Bonus » la lie (`decouperBonus`) : ne rien lier d'autre par vraisemblance.
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
  (« (-5/NM) ») est une pastille `.nm` à sa place, à côté de la valeur (`marquerBonus`), celle du type suit les types et le mode ; `sansBonus` donne la valeur de base. Voir `docs/content-guide.md`, « Niveaux de maîtrise ». Ne rien calculer ni déduire d'une expression de NM, sauf dans le tableau des sorts de la fiche
  (`valeurAuNm`, demande du propriétaire : la valeur à N NM, seulement quand l'écriture n'est qu'un calcul ; sinon le bonus appliqué est écrit, ou l'expression reste).
- **Guide** (`/guide/`) : un livre de chapitres, pas une liste (demande du propriétaire). Le premier chapitre (`guide/bienvenue`) est servi à `/guide/`
  (`adresseDePage`, comme les métiers) ; `[slug].astro` ne le construit pas. Chaque chapitre déclare `chapitre: N` et `partie:` (`lib/guide.mjs#PARTIES`, une couleur par partie) ;
  un trou de numérotation ou une partie inconnue arrête le build. Les tableaux viennent de la base par `<!-- guide:<bloc> -->` (jamais recopiés), les personnages
  fil rouge de `lib/guide-fil-rouge.mjs` (leurs choix seulement ; les chiffres sont calculés). Les autres pages `guide/…` restent des pages de référence, listées
  à la dernière page. Une page ajoutée à la main doit avoir une première source « Google Doc « … » » (famille `docs`), sinon `db:sync-pages` la refuse — et
  `db:export-pages` efface alors le `.md` : vérifier la sortie de `db:sync-pages` avant d'exporter. `test/guide.test.mjs` épingle le plan.
  Sur écran tactile, glisser le doigt tourne la page (script de `GuideChapitre.astro`, hors tableau qui défile et bord de l'écran) ; `html { overscroll-behavior-x: none; }`
  de `styles/guide/guide.css` empêche Chrome d'en faire aussi un retour dans l'historique : ne pas le retirer (`test/guide-html.test.mjs`).
- **Service des personnages** (`client/serveur/`, `docs/serveur.md`) : deux conteneurs dans chaque `docker-compose.yml` (NAS et installateurs), nginx et
  `serveur` (`node:22-alpine`, exécute `site/_serveur/serveur/index.mjs`, port 8787 sans port publié) ; `deploy/nginx.conf` (commun) transmet `/api/` (adresse
  résolue à chaque requête, `proxy_connect_timeout 5s`) et répond 404 sur `/_serveur/`. Le service se relance seul quand `version.json` change (code 0, `restart:
  unless-stopped`), refait la base vivante quand `site/donnees/maverick.db` change, rouvre `db/vivante.db` remplacée : un changement compte vu deux fois
  de suite (`guetteur`). L'installateur de test remplace le **contenu** de `db/`, jamais le dossier (monté dans le conteneur). Avant la 1.0 : prétirés
  seulement, pas de comptes (mot de passe du site) ; une écriture exige `Content-Type: application/json` et refuse `Sec-Fetch-Site` d'un autre site.
  Les adresses de l'API finissent par « / » (`/api/personnages/<id>/`) : en développement, Astro (`trailingSlash: 'always'`) refuse les autres avant de les relayer.
  Le service n'importe que `node:…` et des chemins relatifs (`modulesDuServeur`, testé) ; `tools/build-artifact.mjs` n'emporte pas `_serveur/`.
  Une table ajoutée à la section 13 va dans `TABLES_FICHES` (`src/lib/fiche-format.mjs`, réexportée par `base-vivante.mjs`, donc dans `TABLES_VIVANTES` et dans
  `TABLES_INTERDITES` du journal) et, si elle cite `personnage`, dans `PARTIES_DE_FICHE` ou `HORS_FICHE` (`fiche-format.mjs`) : les tests `serveur-*` le vérifient contre
  `data/schema.sql` ; une clé étrangère de plus vers `metier`, `specialite`, `capacite` ou `sort` va dans `RETRAITS` (`serveur/fiches-retraits.mjs`, testé).
- **Mode modification** (site de dev, `docs/serveur.md`, « Édition ») : le service n'accepte que les colonnes de `TABLES` (`lib/edition-modele.mjs`) ; un champ affiché
  porte `data-ed='["table",{clé},"colonne"]'` (`attributEd`) et, s'il ne s'affiche pas en texte brut, un rendu de `lib/edition-rendu.mjs` (`data-ed-rendu`) qui redonne le HTML du
  gabarit. Une colonne rendue modifiable : son entrée dans `TABLES`, ce qui en dépend recalculé dans `serveur/edition.mjs` (colonnes `X_cle`, typées, tables de détail, page du
  wiki) et un test `serveur-edition-*`. Les découpages (`metier-champs.mjs`, `sort-analyse.mjs`, `classe-champs.mjs`) refont ceux des importeurs : leurs tests les rejouent sur
  toute la base. Une table ajoutée à la section 14 va dans `TABLES_EDITION` (`base-vivante.mjs`) et dans `TABLES_INTERDITES` (`edition-journal.mjs`), comme celles de la section 15. `Edition.astro` n'est pas dans la version portable (`INLINE_CSS=1`).
  Une colonne tirée des tables (corps et résumé des pages typées, `donnees` des fiches de dons) est une colonne dérivée (`colonneDerivee`) : le rejeu la refait (`recalculerLesPages`), elle n'est jamais recopiée du journal.
  Spécialités et dons créés ou supprimés (D11) : identifiant tiré une fois du nom puis figé et jamais réutilisé (l'historique et le journal comptent), place « à la fin de son niveau » sur un numéro libre, nature selon la règle des choix déjà écrite (un don seul sur sa ligne est reçu sans choix) ; rien d'autre n'est déduit.
  Guide : `data-ed-morceau` = un morceau de texte visible du corps (`decouperCorps`) ; ni HTML brut ni lien non sûr ajouté au Markdown d'une page (`lib/markdown-sur.mjs` : service, lot reçu et pages après le rejeu de la mise à jour) ; les liens du wiki portent `data-cible` (`wikilinks.mjs`) et la couleur d'une case
  s'écrit `{couleur:x}` (`markdown-couleurs.mjs`, plugin déclaré dans `astro.config.mjs` ET `lib/guide-rendu.ts`, qui doivent rester d'accord) ; `test/markdown-edition.test.mjs`
  rejoue l'aller-retour Markdown → HTML → Markdown sur toutes les pages du guide.
- **Mise à jour** (`/mise-a-jour/`, `docs/serveur.md`, « Mise à jour ») : la **production** est la base de master (décision du propriétaire), construite par
  `scripts/db-reference.mjs` depuis `git archive origin/master` (CI et livraison font `git fetch … master` avant le build ; sans master, la page dit que la référence manque ;
  rien en `SITE_MODE=prod` ni dans la version portable). La liste ne compare que les colonnes de `TABLES` (`edition-modele.mjs`) ; une couleur vient de R29 et de rien d'autre
  (`notes-de-version-sens.mjs`, tout cas douteux reste neutre). `scripts/mise-a-jour-regles.mjs` refuse d'écrire un fichier de `data/rows` hors des tables du journal et de la
  note (`TABLES_DE_LA_NOTE`) : un fichier de `data/rows` qui n'est pas tel que l'exporteur l'écrit bloque donc une mise à jour. Pas de protection du bouton avant la connexion Discord
  (décision du propriétaire). La première mise à jour fait la livraison 0.2.0. Les notes `exemple = 1` (lorem ipsum, migration `0023`) sont retirées par la première vraie.
- **Couleurs des caractéristiques (et de leurs compétences) et des postures** (demande du propriétaire) : `lib/caracteristiques-postures.mjs` (clés = ids de la base,
  `test/caracteristiques-postures.test.mjs`), posées en `--c` / `--c-texte` (aplat clair, texte foncé) dans le guide (`GuideBloc.astro`) et la fiche ; la fiche les reçoit
  par `regles.json` (`fiche-regles.mjs`), son script n'importe pas le module.
- `npm run autolink` (aperçu) / `-- --write` : maillage automatique des pages, voir `docs/content-guide.md`.
- **Fiche de personnage** (`/fiche/`, `docs/character-generator.md`) : `/generateur/` n'existe plus, la page 404 y renvoie (`lib/nav.mjs#nouvelleAdresse`,
  `PAGES_RENOMMEES`). Les règles de la page viennent de la base au build (`lib/fiche-regles.mjs`), jamais écrites à la main ; chaque calcul de
  `lib/fiche-moteur.mjs` cite sa source (fiche auto V15.2.2, guide, décisions) et a son test, comparé aux vues SQL quand elles existent. Les contrôles qui font
  foi sont ceux de `v_personnage_controle` (rendus par le service) ; toute règle ajoutée à la vue doit avoir son libellé dans `lib/fiche-controles.mjs`
  (`test/fiche-controles.test.mjs`). Avant la 1.0 la fiche ne crée que des prétirés. Une colonne ajoutée à la section 13 apparaît dans le JSON d'une fiche
  sans rien changer au service ; la page, elle, doit lui donner un champ. L'Archimage n'est ouverte qu'au Potentiel Illimité inné, qui l'impose en classe 1 et l'y verrouille
  (décision R23 : colonne `classe.magie_innee_id`, migration `0015-archimage-potentiel-illimite`, règles `classe_reservee` / `classe_imposee`, `classesSelonLaMagieInnee`) ; le Mage Bleu lui est fermé
  (décision R25 : `classe.magie_innee_exclue_id`, migration `0020-mage-bleu-potentiel-illimite`, règle `classe_exclue`) ; la Lamia n'a pas de magie acquise
  (décision R28 : `race.mono_magie`, migration `0022-lamia-une-seule-magie`, règle `race_mono_magie`) ; une ethnie sans choix se pose d'office (`ethnieImposee`) et une magie
  acquise que la race ou l'innée ferme part d'office (`magieAcquiseValable`) ;
  un don à choix d'une classe ou d'une spécialité retirée part avec elle, et un don qu'aucun choix des règles ne range (supprimé sur le site de dev, devenu reçu d'office : D11) aussi (`donsValables`). Page compacte (demandes du propriétaire) : choix en menus déroulants
  (`<details class="choix">`), caractéristiques (1 par défaut, jamais vides : `caracteristiquesCompletes`) et naturel des compétences en curseurs, tableau des sorts
  à une liste par emplacement sans emplacement en plus (`lignesDeSorts`, R27 ; groupée par NPM, chaque sort sur la couleur de sa magie : `sortsParNpm`), NM par origine — niveau, livre (un par sort), MJ — et 3 au plus sur un sort (R24, R26 :
  `personnage_sort.nm_livre`, `nm_cadeau`, migration `0021-nm-plafond`), acquis des compétences, maîtrises d'armes (bloc à part, curseur étroit, dé du Pugilat
  selon la Force : `deDeLaFamille` ; quota des classes et de leurs dons dans le coin : `quotaDeMaitrise`, R32, textes des dons lus par `lib/maitrise-arme.mjs`) et valeurs du moment
  en curseurs aussi, dans les cartes des attributs avec leur maximum, plus des boutons + et − (`ajusterValeurDuMoment` ; chakra actuel ≤ chakra − corruption hors magie de la Corruption :
  `valeursDuMoment` ; santé rouge, barrière jaune, chakra bleu, corruption noire), clic droit ou Entrée sur un curseur = saisie bornée (`borner`), alignement calculé à côté de ses quatre
  scores (`alignementDe`, guide « Alignement »), jauge d'XP en tête du bloc de progression (`progressionXp`), pas de lien vers le guide ;
  une fiche se supprime (`DELETE /api/personnages/<id>/` avec sa version). Le métier (R33 à R40) : son bonus s'ajoute à l'Acquis de la compétence (affiché « +N », compté
  dans le score, rogné au plafond de 5 par point de caractéristique totale (R41) qui prévaut sur lui : `competencesDe`) ou à l'initiative et aux vitesses (`attributsDe`), une croix retire 20 à
  l'artisanat, deux le rendent inutilisable (R39), un rang à choix se choisit sous le métier (`bonusDuMetier`,
  `choixDeMetierValables`), la compétence d'artisanat s'affiche (`artisanatDe`) et ses objets de départ entrent dans l'inventaire au choix du métier (`inventaireSelonLeMetier`,
  `choisirObjetDeMetier`) ; l'Acquis du métier n'est jamais écrit dans `personnage_competence`.
  Suite des demandes du propriétaire : caractéristiques sur une seule ligne, deux cases de croix chacune, score « N/A » à deux croix ; acquis au plus 5 par point de la caractéristique
  totale, magie innée comprise (décision R41, migration `0026-acquis-caracteristique-totale`) ; gains de niveau en petites cartes ; tableau des sorts sans colonne NPM, avec D/S/B, valeurs
  au NM du sort (`valeurAuNm`), effet secondaire sur sa ligne, étoile et infobulle pour la remarque, puis le rappel des dons (don de base, don de l'ethnie et ligne du tableau de la race :
  `donsDeRace` ; dons de classe débloqués : `donsAcquis`) ; attributs sans texte de calcul (infobulle), initiative, vitesse et nage en pastilles, sélecteur des six postures
  (`personnage.posture_id`, migration `0027-posture-du-moment`) ; cadres des blocs dans la couleur de la magie innée, en dégradé vers l'acquise (`--magie-1`, `--magie-2` ; seuls les cadres).
  Résistances et faiblesses dans le bloc des magies (`resistancesDe`, sur le modèle du tableau de la fiche auto : six paliers de `resistance_palier`) : les crans s'additionnent — listes
  des pages de magie (`magie_resistance`, V8 ; Arcane/Corruption reste une question ouverte) pour l'innée et l'acquise, et ce que les dons écrivent en toutes lettres (`lib/resistance-texte.mjs` :
  race et ethnie de l'onglet, dons de classe débloqués ; une immunité écrite prévaut ; au choix ou aléatoire = signalé, jamais compté) ; pas encore les objets.
- **Fiches de personnages** (section 13 de `data/schema.sql`, migration `0011-personnages`) : les tables gardent les **choix** du joueur (race, ethnie, magies, classes, caractéristiques de base et croix (R19), points de compétences,
  gains de niveau, dons à choix, sorts et NM, équipement), cellule de la fiche auto V15.2.2 citée en commentaire ; **rien de ce que la fiche calcule n'est stocké** (niveaux, santé, totaux…).
  `v_personnage_niveau` (R2) et `v_personnage_controle` (une ligne par règle enfreinte, vide pour une fiche `valide`) ; `test/personnages-db.test.mjs` écrit dans une copie de la base.
  Demande du propriétaire : fiche de **joueur** (visible de lui seul et des administrateurs, ouvrable à des utilisateurs désignés, à tous les MJ ou à tous) ou **prétiré** (à personne, visible par tous) ;
  **groupes** de jeu (one-shot, campagne) : une fiche inscrite par membre et par groupe, visible des membres de ce groupe ; rôles cumulables `mj`, `editeur`, `admin` (`utilisateur_role`).
  Qui voit quoi : `v_personnage_visible` ; inscriptions : `v_groupe_controle` (voir `docs/character-generator.md`, « Fiches dans la base »).
  Les tables restent **vides dans `data/rows`** (les fiches réelles vivent dans la base vivante du service, `db/` de l'instance : voir plus haut ; jamais dans git ni dans `/donnees/maverick.db`). Les bugs de la fiche relevés (non reproduits) sont dans `docs/sql/a-valider.md` §3.
  Décision R42 : un don, une spécialité (avec ses dons choisis), un sort ou un métier supprimé des règles est **retiré des fiches** (site de dev : dans le lot ; livraison : à la reconstruction
  de la base vivante, après le rejeu), avec une ligne datée par élément à la fin de `notes` (`lib/fiche-format.mjs#ligneDeRetrait`) ; un élément modifié ou renommé ne touche pas les fiches
  (elles n'ont que des identifiants). Ces écritures se font en SQL direct (`serveur/fiches-retraits.mjs`), **jamais par le rédacteur du journal `w`** (qui refuse la section 13) : rien des
  fiches ne va au journal, dans `data/rows` ni dans le résumé d'un lot. Une race, une classe ou une magie disparue bloque toujours la reconstruction, y compris par un don, une spécialité ou un sort qui en relève (non retiré).

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
  le passage en 1.0 est le signal du propriétaire (ouverture à tout le Discord, avec la connexion Discord) ; les serveurs normal et de test existent dès la 0.2.0 (`PREMIERE_VERSION_HEBERGEE`, `tools/flux-git/regles.mjs`).
- Toute logique de règle ou de lien nouvelle → test dans `client/test/`. Le site de dev est la source de ce qu'il modifie (décision du propriétaire) : un test qui épingle une valeur de l'import (effectif, texte cité, liste du classeur) la lit par `src/lib/historique-site.mjs` (`valeurDImport`, `lignesDImport`, `effectifDImport` : table `historique_modification`) et contrôle l'état courant par des invariants de cohérence ; un test du service lit l'état avant d'écrire et prend des noms absents de la base (`docs/serveur.md`, « Mise à jour »).
- Ne pas modifier `api/` sans demande : c'est l'existant d'avant le site.

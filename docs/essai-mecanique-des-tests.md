# Essai mécanique des tests (lot 10, premier temps)

Mesure faite le 2026-11-15 sur `origin/dev` (v0.4.94 ; le tri est refait sur v0.4.95, les fichiers arrivés depuis ne sont pas mesurés), sans modifier un test, un module du site ni une donnée. Script : `client/scripts/essai-mecanique-tests.mjs` (usage en tête). Tri par fichier : `docs/essai-mecanique-des-tests.json` (`--trier --ecrire-docs`).

## Méthode

Chaque fichier de `client/test/` est lancé seul, deux fois, avec `MAVERICK_CONTENU=<fichier SQLite>` (`lib/contenu-fourni.mjs`) :
- **A, le vrai contenu** : l'extrait de la base construite depuis `data/rows` (`fabriquerExtrait`). Vérifie le branchement.
- **B, un contenu différent** : le même extrait, dont les **noms** (`nom`, `titre`, `libelle`, `intitule`) et les **textes libres** (`description`, `texte`, `corps_md`, `effet`, `remarque`… : 26 colonnes) sont remplacés par des valeurs factices (« Nom factice <table> <n> », « Texte factice… »). Identifiants, clés de jointure, `*_brut`, formules, types, JSON `donnees`, liens entre lignes et structure restent ; les `*_cle` sont recalculées par `normalize()`. 123 tables, 14 431 lignes. Restent telles quelles : `evenement_extrait` (un CHECK exige que `texte` contienne `date_brut`), `alias`, `source`, `mot_cle_synonyme` et les tables du journal.

Deux réglages ont été nécessaires pour A, sans toucher aux tests : fabriquer `client/src/content/wiki/` (`npm run db:export-pages`, absent d'une copie neuve), et retirer du contenu la vue `extrait_meta` (voir « Surprises »).

## Les trois comptes (444 fichiers)

| Catégorie | Fichiers |
| --- | ---: |
| Passe sur les deux contenus | 177 |
| **Casse sur le contenu différent** (passe sur le vrai) | **212** |
| Ne lit pas le contenu (passe sur les deux, aucune marque de lecture) | 55 |
| Casse sur le vrai contenu | 0 |

« Ne lit pas le contenu » vient d'une lecture statique des importations (transitives). Sur les 177 qui passent, **173 lisent aussi le dépôt en direct** (`data/rows`, `data/migrations`, Python, `db-build`, `content/wiki`) : leur réussite sur B ne prouve rien, ils lisent encore le vrai contenu par un autre chemin que la variable.

## Familles de cause des 212 (classement par règles sur le premier message d'erreur : approché)

| Famille | Fichiers | Réglable d'un coup ? |
| --- | ---: | --- |
| Valeur, liste ou comptage attendus qui ont changé | 70 | non : un par un |
| Un nom ou un texte du contenu comparé tel quel | 57 | par famille de tables |
| Fiche de personnage et moteur (échec sans message) | 41 | par famille : la fiche lit noms et textes de règles |
| Ligne cherchée par son nom ou son titre, absente | 12 | oui, en cherchant par identifiant |
| Règle lue dans un texte (puces d'effets, notes, relecture) | 13 | non : se contrôle sur le vrai contenu |
| Structure du corps Markdown (sections, balises) | 8 | oui : un corps de gabarit |
| Autre | 11 | un par un |

Sur les 161 fichiers qui utilisent `aide-base-d-import`, **131 cassent** sur B et 30 passent ; sur les 40 qui lancent Python, 22 cassent.

## Le second chemin (`aide-base-d-import`)

Il passe **déjà** par `cheminBase()`, donc par `MAVERICK_CONTENU` : les 161 fichiers se branchent en un seul endroit, et passent sur le vrai contenu fourni (A). L'extrait garde `historique_modification`, donc l'état d'import se reconstruit. Deux restes lisent encore le dépôt : `data/migrations/*.json` (réécritures des migrations) et `test/fixtures/lots-avant-*.json`.

Ce qui ne se branche pas, c'est la **nature** de ces tests : ils épinglent le texte que l'import a écrit, donc le vrai contenu ; sur un contenu factice ils cassent (131/161). Il faut les trier : (a) un contrôle de **cohérence du vrai contenu**, qui tourne sur le serveur (R275) ; (b) un test de **fonctionnement** qui reçoit son contenu d'un jeu d'essai. La demande : une décision par famille de tables, puis brancher `aide-base-d-import` sur un contenu d'essai (même schéma, identifiants stables) au lieu du vrai.

## Reste à faire, en lots

1. **S : branchement propre.** Fait (lot 10) : la vue `extrait_meta` est retirée de la copie de travail (`lib/contenu-fourni.mjs#preparerLaCopie`), et `content/wiki` se fabrique depuis le contenu fourni (`db-export-pages`) ; voir « Passe C et variantes ».
2. **M : un jeu d'essai commun**, aux identifiants stables, qui remplace le vrai pour GitHub ; l'essai B en est le prototype.
3. **M : les familles réglables d'un coup** (~80 fichiers : lignes cherchées par nom, corps Markdown, noms comparés).
4. **L : les 131 tests d'état d'import**, famille par famille, avec la décision du propriétaire (contrôle du vrai contenu sur le serveur, ou invariant sur le jeu d'essai).
5. **L : fiche et moteur (41)**, les 70 « valeurs attendues », puis Python (22).

Estimation : environ 130 fichiers demanderont un vrai travail, 80 se règlent par famille, 232 n'ont rien à faire (55 ne lisent pas le contenu, 177 passent déjà, sous réserve du chemin direct ci-dessus).

## Passe C et variantes (lot 10, 2026-11-18)

La passe C lance chaque fichier de test sur l'extrait du site de dev (`var/extrait/maverick-dev.db`), dans une copie jetable de l'arbre **sans** `data/rows/*.sql` (`scripts/essai-mecanique-tests.mjs --passe C`). Premier passage : **58 fichiers sur 486 en échec**, en cinq familles.

- **F1, pages d'exemple absentes** (le site de dev n'en a pas) : la copie de travail d'un contenu qui n'en a aucune reçoit celles du dépôt (`data/pages-d-exemple.sql`, `scripts/db-pages-d-exemple.mjs`). `adresses-db`, `db-liens-en-mots-cles`, `db-r184-plan-des-regles`, `donnees`, `livres`, `mots-cles-liens`, `serveur-edition-liens-rompus`, `serveur-edition-mots-cles-liens`, `serveur-mise-a-jour-production` passent depuis.
- **F2, une base ou des lignes de départ reconstruites depuis `data/rows`** par une aide ou un test (`db-build`, copie de `data/rows`). Réglé par une aide commune, `test/aide-base-de-depart.mjs` : sans `MAVERICK_CONTENU`, rien ne change ; avec, `baseDeDepart()` prend une copie du contenu fourni préparée par la voie de `ouvrirBase` (`preparerLeContenu`, tables calculées vidées : une base non dérivée), et `rowsDeDepart()` l'export de cette copie (`tools/db/exporter.py`, une fois par processus). Branchées : `aide-structure-sur-place.mjs#baseDesRegles`, `aide-mots-cles.mjs#reglesAvecDesMotsClesDEssai`, et les copies de `data/rows` des tests de rapatriement et de mise à jour (`copieSansNoteEnAttente(…, { rows: rowsDeDepart() })`). Les 22 fichiers branchés passent C et restent verts sans la variable (les 3 autres de la liste de départ, `mots-cles-liens` et les deux `serveur-edition-*-liens*`, ne cassaient que sur F1), ainsi que `bascule-constat`, qui n'avait que `baseDesRegles` contre lui.
- **F3, l'ancien circuit**, qui écrit ou relit `data/rows` par nature (`db:build`, `db:sync-pages`, `db:appliquer-edition`, mise à jour et copie vers le dépôt, simulation) ;
- **F4, les invariants « table des fiches vide dans `data/rows` »** ;
- **F5, les outils Python** qui relisent `data/rows` (`codex.py --verifier`, `races_onglet.py --verifier`) : vide depuis le lot 12, tous deux lisent une base (`--base`).

**Ce qui lit encore le dépôt, et pourquoi.** F3, F4 et F5 sont déclarées dans `LIT_LE_DEPOT_PAR_NATURE` (`scripts/essai-mecanique-tests.mjs`) : fichier, famille, raison en une ligne, tests concernés. Le tri de C les range dans une rubrique « lit le dépôt par nature, jusqu'au lot 12 » (quand `data/rows` quitte le dépôt et que l'ancien circuit est retiré), à part des échecs inattendus ; un fichier classé qui passe C y est signalé, à retirer de la liste. `test/essai-mecanique.test.mjs` vérifie que chaque nom existe dans `client/test/`. Ils étaient 22 (5 depuis le lot 12, ci-dessous) : 14 en F3 (dont `pages-d-exemple`, test 1, voulu : le fichier des pages d'exemple est comparé à `data/rows`, dont il est tiré ; `baliser-mot-cle`, tests 3, 7 et 8, sur une copie de `data/rows` ; et `contenu-fourni`, test 2, voulu : sans la variable, le build exige `data/rows`), 6 en F4, 2 en F5. `db-r182-critique-du-sort-prepare` en est sorti : sa lecture de `data/rows/posture_critique.sql` doublait celle de la base.

**Conversions du lot 12 (2026-11-18).** Sept fichiers sortent de la liste, verts sur C et sur D : `baliser-mot-cle` (tests 3, 7 et 8 : les lignes de départ de `aide-base-de-depart`), `db-appliquer-edition` et `db-appliquer-edition-familles` (copie des lignes de départ, `copieDesRowsDeDepart`), `db-appliquer-edition-traces-0113` (test 3 converti ; le test 4 est retiré avec le mode `--reparer-traces`, qui réécrivait `data/rows`), `serveur-edition-rapatriement` et `mise-a-jour-simulation` (lignes de départ et `copieSansNoteEnAttente(…, { rows: rowsDeDepart() })`), `suppressions-d11` (le dépôt de travail reçoit les lignes de départ ; ses enfants lisent la base construite depuis ces lignes, par `MAVERICK_CONTENU`). Restent `db-donnees` (`db:build`, aller-retour Python et `db:pages-check` sur `data/rows` par nature ; la preuve que `db:check` voit un défaut injecté vit dans `test/db-check-contenu.test.mjs`) et `contenu-fourni` (test 2, voulu). Les lignes de départ sont celles de `data/rows` sans la variable, l'export du contenu fourni avec elle (`rowsDeDepart`).

**Conversions du lot 12, partie base (2026-11-18).** Dix fichiers de plus sortent de la liste, verts sur C et sur D (`--passe C` puis `--passe D --fichiers …`, extrait tiré de `var/maverick.db`) et avec ou sans `MAVERICK_CONTENU` :
- **F4 est vide.** `personnages-db` (test 1), `db-0118-specialisation-de-la-fiche` (6), `db-0128-lots-de-changements` (1), `db-0129-migrations-recues` (1), `db-r173-compteurs-d-actions` (1) et `db-r181-dons-variables` (4) vérifient l'invariant « un contenu ne porte aucune fiche, aucun lot, aucune migration reçue » (garde-fou 9) sur le contenu qui fait foi : `test/aide-base-de-depart.mjs#lignesDuContenu(table)` compte les lignes du contenu fourni (lecture seule ; une table qu'il n'a pas encore n'y porte rien) quand la variable est posée, sinon celles de `data/rows/<table>.sql` (fichier et en-tête de l'exporteur exigés). Un contenu fourni qui porte une migration reçue fait échouer `db-0129` (vérifié sur une copie salie de l'extrait).
- **`races-onglet`** (F5) : `tools/db/races_onglet.py --verifier --base <fichier.db>` lit une base déjà construite, en lecture seule, à la version du schéma ; le test lui donne la base construite depuis le contenu qui fait foi (`donnees.mjs#cheminBase`), et sans la variable éprouve aussi le repli `data/rows`.
- **`db-pages-du-site`** (F3) : `pages_md.py sync` n'écrit plus `data/rows`. Le test reporte les `.md` dans une base de travail (`--base`, copie de `baseDeDepart`), compare par `lot-de-source.mjs#lotDeSource` (le lot insère la page ; après le retrait, aucune différence), lance `npm run db:sync-pages` (`scripts/db-sync-pages.mjs`) de bout en bout, et vérifie que `sync` et `tools/db/exporter.py` refusent `data/rows`.

- **`codex`** (F5) : `tools/docs/codex.py --verifier --base <fichier.db>` lit l'historique (`historique_modification`) et les mots-clés (`mot_cle`) de la base, en lecture seule, à la version du schéma (`--historique` et `--vocabulaire` gardent leur sens : un fichier SQL qui remplace la table de la base, pour les essais) ; les pages à contrôler sont celles de `--out` (le wiki fabriqué depuis le même contenu). Le test (`codex.test.mjs`) donne `donnees.mjs#cheminBase` et, sans la variable, éprouve aussi le repli `data/rows` (test 1) ; F5 est vide.
- **`races-magies-innees-liste`** (F3) : le rapatriement (`db-appliquer-edition.mjs#appliquerJournal`) s'applique à une copie des lignes de départ (`copieDesRowsDeDepart`), plus à une copie de `data/rows` ; `races_onglet.py --verifier --rows` lit cette copie. Il reste sur `--rows` : le rapatriement ne produit que des lignes, pas de base.

Restent cinq fichiers : `db-donnees` (`db:build` sur `data/rows` par nature), `mise-a-jour-paquet` et `mise-a-jour-regles` (bascule 2 : chemins permis du workflow), `pages-d-exemple` et `contenu-fourni` (voulus).

**Conversions de la PR 4 du lot 12 (2026-11-19), pour la passe S.** `mise-a-jour-paquet` et `mise-a-jour-regles` sortent de la liste : leur base de départ et leurs copies de lignes viennent de `aide-base-de-depart.mjs` (`baseDeDepart`, `rowsDeDepart`, `copieDesRowsDeDepart` ; `VERSION` y est écrit par l'exporteur, `tools/db/maverick.py#exporter`), verts avec et sans `MAVERICK_CONTENU`. `contenu-fourni` (test 2) sort aussi : il lit le code de `donnees.mjs` depuis un faux dépôt complet jetable (`--preserve-symlinks`), et prouve donc la même chose où que vive le dépôt qui le lance. `db-remarque` (copie de `data/rows`) passe par `copieDesRowsDeDepart`, et le faux `sqlite3` de `deploy-demenagement` reproduit `.backup`. Restent deux fichiers : `db-donnees` et `pages-d-exemple`.

**Passe D : ce que voit la CI (2026-11-18).** Classés « par nature », ces fichiers échouent sur C faute de `data/rows` : leur échec y est attendu et ne dit rien de ce que fait la CI, qui lance `npm test` sous `MAVERICK_CONTENU` (l'extrait) AVEC `data/rows` dans l'arbre. C'est ainsi que le run 44320300043 de `dev` est resté rouge (`db-donnees` tests 7 à 9 : le wiki fabriqué depuis l'extrait comparé à `data/rows` ; `mise-a-jour-paquet` tests 2 et 3 : une base de départ tirée de l'extrait, dont `alias` et `mot_cle` diffèrent de `data/rows`) sans que l'essai du lot 10 le voie. La passe D (`--passe D`, une copie jetable qui garde `data/rows`, l'extrait pour contenu, les seuls fichiers de `LIT_LE_DEPOT_PAR_NATURE`) reproduit cette situation : un échec y est rouge (`passes.D.rouges`), jamais rangé à part. Ces fichiers portent sur `data/rows` explicitement (ni `MAVERICK_CONTENU` dans les processus lancés, ni wiki fabriqué) et doivent passer avec et sans la variable.

**Passe S : le dépôt sans le contenu qui sort (lot 12, préparation).** `--passe S` lance chaque fichier de test dans une copie jetable d'où sont retirés tous les fichiers des catégories de l'inventaire (`docs/lot-12-inventaire.md`, `scripts/inventaire-sortie-du-contenu-lib.mjs#listerCeQuiSort`) : `data/rows/` entier, les migrations de données et leurs registres `.json`, `sources/raw/` ; `--avec-mixtes` retire aussi les migrations qui mêlent DDL et données (question ouverte au propriétaire, informatif). Le contenu est l'extrait (`MAVERICK_CONTENU`), comme sur C. **Aucune rubrique « par nature »** : un fichier de `LIT_LE_DEPOT_PAR_NATURE` qui casse en S est rouge comme les autres, et le tri (`trierLaPasseSansLeContenu`) liste chaque échec par fichier avec le premier message de son journal. `--passe S --controles` lance les contrôles de la CI, sans `db:build` (il reconstruit la base depuis `data/rows`), avec `db:check` sur le contenu fourni, et chaque contrôle est rouge au moindre échec. C'est le **critère de fin du lot 12** : le lot s'exécute quand S est verte (`docs/chantier-base-de-dev.md`, « Le jour J du lot 12 »). S n'est pas dans le passage « tout » : `node scripts/essai-mecanique-tests.mjs --passe S`, puis `--passe S --controles`, puis `--trier` (`var/essai-mecanique/tri.md`). `test/essai-mecanique-sans-le-contenu.test.mjs` éprouve la construction de la copie (retiré, conservé, mixtes) et le tri sur un arbre jetable, sans lancer la suite.

**Troisième passage de S, allumée (2026-11-19, PR 5, extrait du jour du site de dev) : 490 fichiers sur 490 au vert, contrôles 31 sur 31 au vert.** Refaite après relecture (archive des seules migrations qui sortent, lues avec celles qui restent ; tests de `codex` et `bestiaire-extraction` ordinaires, sur l'archive des exports) : de nouveau 490/490 et 31/31. Le critère de fin du lot 12 est rempli pour la suite ; si le propriétaire fait sortir aussi les migrations mixtes, la passe se refait avec `--avec-mixtes` (mesure partielle ci-dessous, « Avec `--avec-mixtes` »).

**Passe S allumée (lot 12, PR 5).** Tout ce qui ne vaut qu'une fois le contenu sorti passe derrière un interrupteur éteint, `src/lib/sortie-du-contenu.mjs#CONTENU_SORTI` (`contenuSorti(env)` : la constante, ou `MAVERICK_CONTENU_SORTI=1`). La CI et le dépôt d'aujourd'hui ne voient aucune différence ; **la passe S l'allume**, comme la PR du jour J : `environnementDeLaPasse('S', …)` pose `MAVERICK_CONTENU_SORTI=1` pour la suite (`lancerUn`), pour la construction de la copie et pour les contrôles de S (les autres passes retirent la variable), et `MAVERICK_SOURCES_RAW` vers un dossier hors de la copie, rempli par `git archive HEAD sources/raw` (`archiverLesExports` : la simulation de l'archive restaurée du jour J, lue par `tools/sources/dossier-des-exports.mjs`), retiré à la fin du processus ; et `MAVERICK_MIGRATIONS_ARCHIVEES` vers un dossier hors de la copie, rempli par `git archive HEAD` des seules migrations de données qui sortent (`archiverLesMigrations`, `listerCeQuiSort` ; les mixtes aussi avec `--avec-mixtes`), que `tools/sources/rapprocher.mjs` lit AVEC les migrations restées dans la copie (registres d'orthographe), retiré lui aussi. Commande : `cd client && node scripts/essai-mecanique-tests.mjs --passe S` (puis `--passe S --controles`, puis `--trier`) ; un fichier seul : `--passe S --fichiers a.test.mjs`. Ce que cela change pour les tests :
- les tests de `RETIRES_AVEC_LE_CONTENU` (`sortie-du-contenu.mjs`, fichier → raison et titres exacts) sont déclarés par `test/aide-sortie-du-contenu.mjs#testRetireAvecLeContenu` : déclarés quand c'est éteint, **non déclarés** quand c'est allumé (la PR du jour J les supprime). Ne sort que ce qui éprouve ce qui sort : le SQL ou le registre d'une migration de données, `db:build` depuis `data/rows` et `db:sync-pages`, le fichier des pages d'exemple comparé à `data/rows`, et les extracteurs du Codex (`tools/docs/codex.py`) et du Bestiaire (`tools/bestiaire/extraire.mjs`) rejoués sur un export (reco (e), en attente du propriétaire). Les autres tests de ces fichiers éprouvent des invariants de la base ou un outil qui reste (`db:check`, `db:export-pages`, `db:pages-check`, lus sur le contenu fourni) et restent ;
- les tests qui lisent les instantanés des classeurs (`annexes-magie-notes`, `db-armes-elementaires`, `importeurs-etiquettes`, `mots-cles-python`, `sources-rapprochement`) lisent le dossier des exports par `dossierDesExports()` : `sources/raw` sans variable (éteint, chemin d'avant), l'archive restaurée avec ;
- `instructions-claude` tolère, allumé, un `paths` de skill dont la cible fait partie de ce qui sort (catégories de `listerCeQuiSort`, lues dans `HEAD`) : le jour J, `tech-skills` retire ces `paths` ;
- `LIT_LE_DEPOT_PAR_NATURE` ne garde de `db-donnees` que ses tests 1, 5, 6, 8 et 9 et de `pages-d-exemple` son test 1, et `test/essai-mecanique.test.mjs` exige que chaque fichier « par nature » les déclare dans `RETIRES_AVEC_LE_CONTENU`.
- **Avec `--avec-mixtes`**, S pose aussi `MAVERICK_MIXTES_SORTIES=1` (`sortie-du-contenu.mjs#mixtesSorties`, interrupteur `MIXTES_SORTIES`, éteint) : les tests de `RETIRES_AVEC_LES_MIXTES` ne sont plus déclarés (`testRetireAvecLesMixtes`), `registreDeMigration` lit les registres mixtes gardés dans `test/fixtures/registres-sortis.json`, et les tests de structure appliquent une vraie migration au-dessus du plancher `data/schema.sql` (`test/aide-structure-sur-place.mjs#LIVRAISON`). Le code qui tourne ne lit plus aucun registre : `data/references/` (`docs/chantier-base-de-dev.md`, « Les lecteurs des migrations mixtes »). Mesure (2026-11-19, PR `feature/lecteurs-des-migrations-mixtes`) : les 94 fichiers qui lisaient une migration mixte, ses aides ou `test/fixtures/registres-sortis.json` passent tous (94/94) ; 144 tests dans 44 fichiers sont retirés avec les mixtes. Passe entière mesurée par `tech-qualite` : 501/503 et 31/31 contrôles ; les deux rouges (`serveur-livraison`, `mise-a-jour`) corrigés : 503/503 et 31/31 contrôles après correction (reconfirmé par `tech-qualite` le 2026-11-19 : 9/9 en passe S `--avec-mixtes` sur les fichiers corrigés).
`test/essai-mecanique-sans-le-contenu.test.mjs` éprouve aussi l'environnement de la passe et l'archive des exports, sans lancer la suite.

**Premier passage de S (2026-11-19, `c2749bd3` et la préparation non commitée de la PR 3 ; contenu : un extrait tiré de `var/maverick.db`, l'extrait du jour n'étant pas lisible depuis la session).** Copie S : 292 fichiers retirés (35,9 Mo). **447 fichiers sur 485 passent, 38 sont rouges** ; contrôles : 1 sur 31 au vert (`db:check`). Familles :
- **Le build** (réglé par la PR 4, voir « Deuxième passage ») : la page `/archives` lit `data/migrations/0014-sources-copies-drive.json` ; tous les contrôles du site construit en découlent (tests du site sautés faute de `dist/`, donc rouges).
- **Les registres `.json` des migrations de données, lus pour reconstruire l'état d'import** (aides de test, `test/aide-base-d-import.mjs` et voisines ; premier fichier manquant : `0120-races-fongoide-gemidien.json`) : `db-0114-categories-assignees`, `db-0120-races-fongoide-gemidien`, `db-donnees`, `db-rang-des-races`, `fiche-html`, `fiche-moteur`, `lamia-corruption`, `personnages-db`, `races-detail-content`, `races-magies-content`, `races-magies-innees-liste`, `races-onglet`, `serveur-edition-verrou`. C'est la famille la plus nombreuse : elle se règle en un endroit.
- **Une migration de données lue par son nom** (`.sql` ou `.json`) : `archives` et `liens-familiers-prototype`, `sources-copies` (0014, réglés par la PR 4), `db-0100-ancres-figees-des-intertitres` (0100), `guide-sans-chapitres` (0064), `orthographe-base` (0005), `orthographe-magies` (0003), `db-liens-en-mots-cles` et `serveur-edition-rejeu-ids` (0114), `db-retrait-pages-doublons-des-combats` (0094), `db-retrait-alterations-d-etats-et-mode-hyper` (0096) ; `instructions-claude` : des `paths` de skills visent des migrations retirées ; `serveur-structure-sur-place-reconstruction` : un compte de migrations change (105 contre 104).
- **`data/rows` encore lu** : `mise-a-jour-paquet`, `mise-a-jour-regles` (`data/rows/VERSION`), `contenu-fourni` (test 2, voulu), `db-remarque` (copie de `data/rows`) ; réglés ensuite (PR 4).
- **`sources/raw` lu en dur** (extracteurs et instantanés) : `annexes-magie-notes`, `bestiaire-extraction`, `codex`, `db-armes-elementaires`, `importeurs-etiquettes`, `mots-cles-python`, `sources-rapprochement`.
- **Hors lot** : `deploy-demenagement` (faux `sqlite3` de l'environnement de la session ; rouge aussi sur `origin/dev`) ; réglé ensuite (PR 4 : le faux reproduit `.backup`).

Le détail par fichier est dans `var/essai-mecanique/tri.md` (refait par `--trier`). À refaire sur l'extrait du jour avant le jour J.

**Deuxième passage de S (2026-11-19, PR 4 du lot 12, sur l'extrait du jour du site de dev).** **459 fichiers sur 489 passent, 30 rouges** ; le build et tous les contrôles passent, sauf `fiche-html` (même cause que la première famille ci-dessous). Réglés par la PR 4 : le build (`/archives` lit `sources/copies-drive.json`), `archives`, `liens-familiers-prototype`, `sources-copies`, les lecteurs de `data/rows` (`db-remarque`, `mise-a-jour-paquet`, `mise-a-jour-regles`, `contenu-fourni`) et `deploy-demenagement`. Les 30 qui restent dépendent tous d'une réponse du propriétaire sur ce qui sort (question des migrations mixtes et des tests d'extracteurs, lot 12) :
- registres `.json` des migrations lus pour l'état d'import (13, dont `db-donnees`, et `fiche-html` aux contrôles) ;
- une migration de données lue par son nom (8), plus `instructions-claude` (`paths` de skills) et `serveur-structure-sur-place-reconstruction` (compte des migrations) ;
- `sources/raw` lu en dur (7 : `annexes-magie-notes`, `bestiaire-extraction`, `codex`, `db-armes-elementaires`, `importeurs-etiquettes`, `mots-cles-python`, `sources-rapprochement`).

**Après ce lot**, les passes C et V1 complètes ne font échouer que les fichiers classés par nature (22 alors, 5 après le lot 12).

**Contrôles d'une passe (`--passe <P> --controles`, P = C, V1 à V5).** Les tests du site construit échappent aux passes fichier par fichier : une copie jetable n'a pas de `dist/`. `--controles` lance dans la copie, sous `MAVERICK_CONTENU` = le contenu de la passe, les contrôles du job preparer (`mise-a-jour-github.mjs#CONTROLES`, donc le job client de `ci.yml`) :
- le build, puis chaque test du site construit, à part : un test sauté ou vide est rouge ;
- le build de test et le bandeau, l'installateur, puis le build de production et ses deux tests, et l'artefact.

`npm test` reste à la passe elle-même. `db:build` et `db:check` (`CONTROLES_PAR_NATURE`) sont notés à part et ne la rendent pas rouge. Sur C (2026-11-18) : au vert en 205 s, 24 tests du site lancés, aucun test sauté (`races-html` : 15 passés).

**Variantes.** V1 (icônes posées sur des mots-clés de genres variés) a trouvé une valeur figée : `db-0116-icone-des-mots-cles`, « lui seul a une icône ». V1 laisse maintenant la trace de ses saisies : le test vérifie à l'import que chaque mot-clé d'une monnaie a l'icône de sa monnaie, et lui seul, et lit aussi dans la migration qu'elle n'en pose qu'à eux. Il passe V1.

**Des variantes fidèles au site.** Les passes complètes V2 et V3 trouvaient 24 fichiers qui passaient C et cassaient sur une variante (18 sur V2, 6 sur V3). Tous venaient de variantes infidèles (c), aucun d'un défaut du code :
- **Aucune trace.** Une saisie du site laisse sa trace dans `historique_modification`, et l'état d'import la défait ; les variantes écrivaient sans trace. Chacune note désormais ses écritures comme le journal (`essai-variantes.mjs#journalDeLaVariante` : nature `saisie`, version NULL, la ligne entière pour une insertion ou une suppression, les colonnes changées pour une modification). Réglés ainsi : `bestiaire-extraction`, `db-0121-maj-decembre-suites`, `sources-rapprochement`.
- **V2 renommait une magie**, ce que le site ne permet pas : `magie.nom` n'est pas modifiable (`lib/edition-modele.mjs#TABLES.magie`), et un test peut alors lire une magie par son nom (`tests-conventions`). V2 renomme désormais un sort **par le service** (`serveur/edition.mjs#enregistrer` : validations, dérivations, journal), puis verse le journal dans l'historique et vide les tables du journal, comme l'extrait (`serveur/historique.mjs#historiser`). Les 18 fichiers de V2 passent. L'ancien renommage d'une magie reste une variante à part, **V5** (écriture directe, avec sa trace) : elle est hors des voies du site aujourd'hui, et le tri la range à part (« informative, ne bloque rien », `PASSES_INFORMATIVES`). La preuve qu'aucune voie du site ne renomme une magie est `test/serveur-edition-nom-de-magie.test.mjs` : le service refuse `magie.nom`, le titre de la page d'une magie (seules les pages du guide et du Codex ont un titre modifiable) et tout alias (ni table du modèle, ni entité).
- **V3 copiait une ligne en écriture directe**, sans ses filles ni le corps de la page qui la montre, et au-delà de ce que le service permet (une troisième spécialité). V3 crée maintenant chaque ligne **par le service** (opération `creer`, valeurs tirées de la dernière ligne de la table) : un refus est noté, jamais forcé (la spécialité : `SPECIALITES_MAX`). Réglés : `arme-champs`, `chronologie`, puis, sur la passe complète, `capacites-content` (test 4), `corps-armes` (test 1) et `serveur-edition-armes` (test 4).
- **`corps-classes`, test 4.** Le test exigeait un don pour chaque spécialité ; or le site peut créer une spécialité avant ses dons. Il le vérifie maintenant à l'import ; sur l'état courant, une spécialité est une bannière si et seulement si elle a un don.

`races-html` (tableau des magies innées) lit maintenant dans la base les noms de ses en-têtes et le nombre de ses colonnes. La couleur d'une magie reste tirée de son nom (`lib/palette-css.mjs#classeDeMagie`, `lib/sort-format.mjs#cleDeMagieConnue`). Le site ne peut pas la renommer, mais un renommage par l'import ou par une migration ferait perdre la couleur : à tirer de l'identifiant (proposition à tech-front). Le nom d'une magie reste non modifiable sur le site : tranché par R303 (3).

## Surprises

- 232 fichiers passent sans changement, mais 173 lisent le dépôt par un autre chemin que la variable.
- Un contenu fourni est un **extrait** : sa vue `extrait_meta` fait échouer 8 fichiers sur le vrai contenu même.
- Le dossier fabriqué `content/wiki` n'est pas couvert par `MAVERICK_CONTENU` : 18 fichiers échouent sans lui, et il porte le vrai contenu.
- Durée cumulée des deux passes : environ 66 minutes de processeur, sur 4 cœurs.

## Annexe : les listes (pour la suite ; le détail par fichier est dans le fichier JSON)

Noms de fichiers sans `.test.mjs`. Le fichier JSON porte la catégorie, la famille et ce que chaque fichier lit.

### Les trois tas

#### Cassent sur le contenu factice (212)

`accessoire-champs`, `accessoires-db`, `aide-base-d-import`, `alchimie-couleurs`, `arme-champs`, `armes-elementaires-db`, `armes-elementaires-rendu`, `armes-materiau-par-defaut`, `armure-elementaire-donnees`, `armures-e6`, `baliser-mot-cle`, `bestiaire-db`, `bestiaire-echelles`, `bestiaire-extraction`, `boucliers-poids`, `boxeur-bouclier`, `capacites-content`, `caracteristiques-postures`, `ceinture-db`, `chronologie`, `classe-champs`, `classes-dons`, `classes-notes`, `classes-sans-suffixe`, `codex`, `corps-armes`, `corps-armures`, `corps-classes`, `corps-composants`, `corps-magies`, `corps-metiers`, `corps-potions`, `corps-races`, `creature-npm`, `db-0100-ancres-figees-des-intertitres`, `db-0111-relecture-des-regles`, `db-0113-mots-cles-id-entier`, `db-0114-categories-assignees`, `db-0117-magies-v10-specialisations`, `db-0118-specialisation-de-la-fiche`, `db-0119-classes-materiaux-d12`, `db-0120-races-fongoide-gemidien`, `db-0121-maj-decembre-suites`, `db-0122-retrait-la-montee-de-niveau`, `db-0123-fusion-pages-alignement`, `db-0124-retrait-accessoires-et-ceinture`, `db-0126-onglets-de-l-alignement`, `db-appliquer-edition-familles`, `db-appliquer-edition`, `db-arme-famille-nom-lecture`, `db-armes-elementaires`, `db-lexique-en-mots-cles`, `db-liens-en-mots-cles`, `db-pages-du-site`, `db-r174-resistances-physiques`, `db-r180-reussite-critique`, `db-r181-dons-variables`, `db-r182-critique-du-sort-prepare`, `db-r184-plan-des-regles`, `db-r198-r208-textes-du-guide`, `db-r203-r204-r205`, `db-r207-armures-et-fabrication`, `db-r209-bestiaire`, `db-r231-attaquer-et-se-defendre`, `db-remarque`, `db-retrait-alterations-d-etats-et-mode-hyper`, `db-retrait-liste-des-effets-mode-hyper`, `db-retrait-pages-doublons-des-combats`, `degats-texte`, `donnees`, `eaunoire`, `edition-liens-des-valeurs`, `edition-rendu`, `epreuve-lots-0122-0124`, `equipement-craft-notes`, `equipement`, `etat-ancre`, `fiche-accessoires`, `fiche-acquis`, `fiche-actions-passifs`, `fiche-arme-choisie`, `fiche-armes-elementaires`, `fiche-armes-tri`, `fiche-armure-cassee`, `fiche-armure-elementaire`, `fiche-armure`, `fiche-bouclier-defense`, `fiche-ceinture-inventaire`, `fiche-critique-sort-prepare`, `fiche-critique`, `fiche-degats-recus`, `fiche-dons-variables`, `fiche-durabilite`, `fiche-familles-creees`, `fiche-flagelleur`, `fiche-format-retirees`, `fiche-grenades-et-sort-prepare`, `fiche-invocations`, `fiche-liens-glossaire`, `fiche-listes-infobulles`, `fiche-maitrises`, `fiche-maj-decembre-suites`, `fiche-mode-hyper-r187`, `fiche-mode-hyper`, `fiche-moteur`, `fiche-postures-sorts`, `fiche-refonte`, `fiche-regles`, `fiche-resistances-armure-elementaire`, `fiche-resistances-physiques`, `fiche-sante-potentiel`, `fiche-sorts-fer`, `fiche-tableur-aller-retour`, `fiche-tableur-export`, `fiche-tableur-import`, `fiche-tableur-noms-d-avant`, `fiche-tableur-noms-renommes-par-migration`, `fiche-tableur-page`, `glossaire-filtre`, `guide-mode-hyper`, `guide`, `liens-familiers-prototype`, `limite-texte`, `livres`, `lots-rendu-service`, `magie-fleches`, `magies-notes`, `magies-page`, `magies-specialisations`, `maitrise-arme-sources`, `maitrise-arme`, `maitrise-sorts`, `markdown-edition`, `markdown-sur`, `metier-champs`, `metiers`, `mise-a-jour-regles`, `monnaies`, `mots-cles-balises`, `mots-cles-cles`, `mots-cles-des-valeurs`, `mots-cles-liens`, `mots-cles-r195`, `nav`, `orthographe-base`, `orthographe-magies`, `orthographe-noms`, `palette-css`, `panneaux-regles`, `personnages-db`, `plan-des-regles-db`, `potentiel-illimite`, `potion-etats`, `r188-npm-potentiel-illimite-base`, `r188-r189-npm-et-grimoire`, `r236-fiche-specialisations`, `race-relations`, `races-detail-content`, `races-magies-content`, `races-magies-innees-liste`, `races-onglet`, `resistance-combinaison`, `resistance-texte`, `ressources-registre`, `serveur-api-v1`, `serveur-api`, `serveur-armure-elementaire`, `serveur-base-vivante-empreinte-logique`, `serveur-base-vivante`, `serveur-debug-tables`, `serveur-dons-obtenus`, `serveur-edition-armes`, `serveur-edition-armures`, `serveur-edition-bestiaire`, `serveur-edition-classes`, `serveur-edition-composants`, `serveur-edition-conflits-maitrises`, `serveur-edition-conflits`, `serveur-edition-consommables`, `serveur-edition-corps`, `serveur-edition-derivations`, `serveur-edition-fiches`, `serveur-edition-fusion`, `serveur-edition-guide`, `serveur-edition-journal`, `serveur-edition-lots-annulation`, `serveur-edition-lots-mot-cle`, `serveur-edition-lots`, `serveur-edition-magies`, `serveur-edition-maitrises`, `serveur-edition-mots-cles-liens`, `serveur-edition-panneaux`, `serveur-edition-plan`, `serveur-edition-races`, `serveur-edition-rapatriement`, `serveur-edition-regles-du-don`, `serveur-edition-rejeu-corps`, `serveur-edition-rejeu-gel`, `serveur-edition-rejeu-liens`, `serveur-edition-rejeu-metiers`, `serveur-edition-rejeu-resistances`, `serveur-edition`, `serveur-poids-portable`, `sort-analyse`, `sort-cout-secondaire`, `sort-etats`, `sorts-fer`, `sources-copies`, `sources-rapprochement`, `suppressions-d11`, `tables-de-la-base`, `valeurs-fermees-rendu`

#### Passent sur les deux (177)

`accessoires-generateur`, `accessoires-html`, `accueil-html`, `adresses-db`, `ancres-figees`, `annexes-magie-notes`, `api-doc`, `archives`, `arme-forge`, `armes-de-famille`, `armes-edition`, `armes-effets-a-part`, `armes-filtres`, `armes-html`, `armes-menus`, `armure-champs`, `armures-html`, `autolink`, `bestiaire-html`, `bestiaire-pages-html`, `ceinture-html`, `chronologie-editeur`, `chronologie-html`, `chronologie-rendu`, `citations-db`, `classe-dons-rendu`, `classes-html`, `comparaison-de-sites`, `composants-html`, `composants-onglets`, `conflits-rendu`, `conflits-suit-le-don`, `contenu-fourni`, `controles-du-contenu`, `corrections`, `db-0099-solidite-et-tableau-du-sort`, `db-0115-mots-cles-synonymes`, `db-0116-icone-des-mots-cles`, `db-0125-types-de-degats-et-magies`, `db-0127-nature-des-traces`, `db-0128-lots-de-changements`, `db-0129-migrations-recues`, `db-appliquer-edition-traces-0113`, `db-derive-recherche`, `db-donnees`, `db-extrait`, `db-index-retires`, `db-journal-resolution`, `db-r172-mode-hyper-activable`, `db-r172-sort-prepare-en-mode-hyper`, `db-r173-compteurs-d-actions`, `db-rang-des-races`, `db-schema`, `debug-metriques`, `debug-schema`, `debug-structure`, `deploy-acces`, `deploy-sauvegardes-installer`, `deploy-volume`, `diff-replie`, `dons-edition`, `dons-variable-formulaire`, `edition-annonces`, `edition-composants-ajout`, `edition-mots-cles`, `edition-panneaux`, `edition-races-liens-magies`, `edition-saisies`, `equipement-html`, `fabrication-depuis-contenu`, `fiche-html`, `flux-git-etat`, `fusion-trois-voies`, `glossaire-balisage`, `glossaire-html`, `glossaire-tableau`, `guide-html`, `guide-sans-chapitres`, `historique-site`, `icones-degats-et-magies`, `importeurs-etiquettes`, `infobulles`, `installateur-essai-de-structure`, `installateur`, `instructions-claude`, `invocations-notes`, `lamia-corruption`, `libelles-de-la-base`, `lot-de-changements-annulation`, `lot-de-changements-numeros`, `lot-de-changements`, `lots-rendu`, `magie-non-compatible`, `magie-relations`, `magies-html`, `markdown-rendu`, `materiaux-couleurs`, `mentions-des-mots-cles`, `metiers-html`, `migrer-normaliseur`, `mise-a-jour-etat-production`, `mise-a-jour-github`, `mise-a-jour-simulation`, `mise-a-jour`, `mots-cles-liens-rendu`, `mots-cles-python`, `mots-cles-r223`, `mots-cles-vivants-liens`, `mots-cles-vivants`, `mutation`, `notes-de-version-sens`, `notes-de-version`, `onglets-markdown`, `ordre-des-menus`, `pages-db`, `pages-protegees`, `personnages-armure-elementaire`, `personnages-liste`, `personnages-livre-de-sort`, `portrait`, `r160-potentiel-illimite-sans-gemme`, `race-kinds`, `races-html`, `recherche-mots-cles`, `recherche-script`, `scripts-controler-les-migrations`, `serveur-acces-routes`, `serveur-attestation`, `serveur-classeur`, `serveur-edition-ancres-figees`, `serveur-edition-annonces`, `serveur-edition-chronologie`, `serveur-edition-colonnes-figees`, `serveur-edition-don-variable-fiches`, `serveur-edition-don-variable`, `serveur-edition-liens-rompus`, `serveur-edition-mots-cles-cles`, `serveur-edition-mots-cles-fusion`, `serveur-edition-mots-cles-icone`, `serveur-edition-mots-cles-references`, `serveur-edition-nature-des-traces`, `serveur-edition-numeros`, `serveur-edition-pages-regles`, `serveur-edition-r160`, `serveur-edition-rejeu-capacites`, `serveur-edition-rejeu-fantomes`, `serveur-edition-rejeu-fusions`, `serveur-edition-rejeu-ids`, `serveur-edition-suppression-forcee`, `serveur-edition-verrou`, `serveur-essai-dans-l-ombre`, `serveur-essai-de-structure`, `serveur-extrait`, `serveur-fiches-retraits`, `serveur-livraison`, `serveur-maintenance`, `serveur-metriques-bornes`, `serveur-metriques-disque`, `serveur-metriques-http`, `serveur-metriques-sauvegardes`, `serveur-metriques`, `serveur-mise-a-jour-etats`, `serveur-mise-a-jour-production`, `serveur-notes-de-version`, `serveur-specialisations-magie`, `serveur-structure-sur-place-reconstruction`, `serveur-structure-sur-place`, `serveur-tipeee`, `sheets-api-to-json`, `site-html`, `sort-bonus-contexte`, `tableaux`, `tests-cibles`, `texte-en-place-barres`, `texte-en-place-mots-cles`, `wikilinks`, `xlsx-to-json`

#### Ne lisent pas le contenu (55)

`acces-navigateur`, `accessoires-script`, `aide-faux-dom`, `armes-script`, `armure-forge`, `armures-tri`, `batons-script`, `bestiaire-filtres`, `capacites`, `chronologie-filtre`, `class-groups`, `classe-magique`, `debug-balise`, `debug-metriques-sauvegardes`, `debug-page`, `decisions-index`, `defilement`, `deploy-sauvegardes`, `deploy-vps`, `dossiers-temporaires`, `durcissement`, `edition-tous-ecrans`, `fiche-controles`, `fiche-modele`, `fiche-retraits-texte`, `fiche-tiroir-clavier`, `flux-git`, `gabarits-sources`, `galerie`, `google-sheets`, `journal-du-service`, `liste-choix-script`, `liste-choix`, `metiers-tri`, `mise-a-jour-conflits`, `mise-a-jour-lots`, `mise-a-jour-script`, `monnaies-html`, `onglets-script`, `pieces-elementaires-script`, `pose-unique`, `search`, `serveur-acces`, `serveur-edition-corps-refus`, `skills-ecarts`, `sort-maitrise`, `sources-tipeee`, `tableur-ecriture`, `tableur-lecture`, `tableur-mesure`, `tipeee-script`, `tipeee`, `update-site`, `xml-mini`, `zip`

### Les familles de cause des 212

#### valeur-attendue (70)

`accessoire-champs`, `alchimie-couleurs`, `arme-champs`, `armes-elementaires-rendu`, `baliser-mot-cle`, `capacites-content`, `ceinture-db`, `codex`, `corps-armures`, `corps-classes`, `corps-metiers`, `corps-potions`, `corps-races`, `db-0100-ancres-figees-des-intertitres`, `db-0117-magies-v10-specialisations`, `db-0118-specialisation-de-la-fiche`, `db-0119-classes-materiaux-d12`, `db-0121-maj-decembre-suites`, `db-0122-retrait-la-montee-de-niveau`, `db-0124-retrait-accessoires-et-ceinture`, `db-0126-onglets-de-l-alignement`, `db-appliquer-edition`, `db-armes-elementaires`, `db-pages-du-site`, `db-r174-resistances-physiques`, `db-r181-dons-variables`, `db-r198-r208-textes-du-guide`, `db-r207-armures-et-fabrication`, `db-r231-attaquer-et-se-defendre`, `db-retrait-alterations-d-etats-et-mode-hyper`, `degats-texte`, `donnees`, `edition-liens-des-valeurs`, `edition-rendu`, `equipement-craft-notes`, `equipement`, `etat-ancre`, `glossaire-filtre`, `guide`, `magies-page`, `magies-specialisations`, `maitrise-arme-sources`, `maitrise-arme`, `maitrise-sorts`, `markdown-edition`, `markdown-sur`, `metier-champs`, `mots-cles-balises`, `mots-cles-cles`, `races-magies-innees-liste`, `resistance-texte`, `serveur-api-v1`, `serveur-base-vivante-empreinte-logique`, `serveur-debug-tables`, `serveur-edition-bestiaire`, `serveur-edition-classes`, `serveur-edition-conflits-maitrises`, `serveur-edition-conflits`, `serveur-edition-derivations`, `serveur-edition-guide`, `serveur-edition-lots-annulation`, `serveur-edition-lots`, `serveur-edition-maitrises`, `serveur-edition-plan`, `serveur-edition-rejeu-gel`, `serveur-edition-rejeu-liens`, `serveur-edition-rejeu-metiers`, `serveur-edition`, `sort-etats`, `valeurs-fermees-rendu`

#### nom-ou-texte-compare (57)

`accessoires-db`, `armes-elementaires-db`, `bestiaire-db`, `bestiaire-echelles`, `bestiaire-extraction`, `boucliers-poids`, `caracteristiques-postures`, `classe-champs`, `classes-dons`, `classes-notes`, `classes-sans-suffixe`, `corps-magies`, `db-0113-mots-cles-id-entier`, `db-0114-categories-assignees`, `db-0123-fusion-pages-alignement`, `db-lexique-en-mots-cles`, `db-liens-en-mots-cles`, `db-r182-critique-du-sort-prepare`, `db-r184-plan-des-regles`, `db-r203-r204-r205`, `db-r209-bestiaire`, `db-remarque`, `db-retrait-pages-doublons-des-combats`, `eaunoire`, `fiche-format-retirees`, `guide-mode-hyper`, `liens-familiers-prototype`, `livres`, `lots-rendu-service`, `magie-fleches`, `metiers`, `mise-a-jour-regles`, `monnaies`, `nav`, `panneaux-regles`, `plan-des-regles-db`, `potentiel-illimite`, `potion-etats`, `race-relations`, `races-detail-content`, `races-magies-content`, `races-onglet`, `resistance-combinaison`, `ressources-registre`, `serveur-api`, `serveur-armure-elementaire`, `serveur-base-vivante`, `serveur-dons-obtenus`, `serveur-edition-journal`, `serveur-edition-panneaux`, `serveur-edition-races`, `serveur-edition-regles-du-don`, `serveur-edition-rejeu-resistances`, `sort-analyse`, `sort-cout-secondaire`, `sorts-fer`, `suppressions-d11`

#### fiche-moteur (41)

`fiche-accessoires`, `fiche-acquis`, `fiche-actions-passifs`, `fiche-arme-choisie`, `fiche-armes-elementaires`, `fiche-armure-cassee`, `fiche-armure-elementaire`, `fiche-armure`, `fiche-bouclier-defense`, `fiche-ceinture-inventaire`, `fiche-critique-sort-prepare`, `fiche-critique`, `fiche-degats-recus`, `fiche-dons-variables`, `fiche-durabilite`, `fiche-familles-creees`, `fiche-flagelleur`, `fiche-grenades-et-sort-prepare`, `fiche-invocations`, `fiche-liens-glossaire`, `fiche-listes-infobulles`, `fiche-maitrises`, `fiche-maj-decembre-suites`, `fiche-mode-hyper-r187`, `fiche-mode-hyper`, `fiche-moteur`, `fiche-postures-sorts`, `fiche-refonte`, `fiche-regles`, `fiche-resistances-armure-elementaire`, `fiche-resistances-physiques`, `fiche-sante-potentiel`, `fiche-sorts-fer`, `fiche-tableur-aller-retour`, `fiche-tableur-export`, `fiche-tableur-import`, `fiche-tableur-noms-d-avant`, `fiche-tableur-noms-renommes-par-migration`, `fiche-tableur-page`, `r188-r189-npm-et-grimoire`, `r236-fiche-specialisations`

#### regle-lue-dans-un-texte (13)

`aide-base-d-import`, `armes-materiau-par-defaut`, `db-0111-relecture-des-regles`, `db-0120-races-fongoide-gemidien`, `db-arme-famille-nom-lecture`, `fiche-armes-tri`, `magies-notes`, `mots-cles-des-valeurs`, `mots-cles-r195`, `palette-css`, `r188-npm-potentiel-illimite-base`, `serveur-edition-fusion`, `sources-copies`

#### ligne-absente (12)

`chronologie`, `creature-npm`, `db-r180-reussite-critique`, `db-retrait-liste-des-effets-mode-hyper`, `orthographe-base`, `orthographe-magies`, `orthographe-noms`, `personnages-db`, `serveur-edition-consommables`, `serveur-edition-mots-cles-liens`, `sources-rapprochement`, `tables-de-la-base`

#### autre (11)

`armure-elementaire-donnees`, `armures-e6`, `boxeur-bouclier`, `db-appliquer-edition-familles`, `epreuve-lots-0122-0124`, `limite-texte`, `mots-cles-liens`, `serveur-edition-corps`, `serveur-edition-lots-mot-cle`, `serveur-edition-rapatriement`, `serveur-poids-portable`

#### corps-markdown (8)

`corps-armes`, `corps-composants`, `serveur-edition-armes`, `serveur-edition-armures`, `serveur-edition-composants`, `serveur-edition-fiches`, `serveur-edition-magies`, `serveur-edition-rejeu-corps`

### Les 173 fichiers qui passent et lisent le dépôt en direct, et ce qu'ils lisent

Lecture statique (importations transitives de client/test et client/src, sans `lib/donnees.mjs` ni `lib/contenu-fourni.mjs` qui obéissent à la variable) : chaque motif est un endroit du dépôt ou un outil qui lit le contenu sans passer par la variable. `data/rows` et `rows` : le dossier des lignes ; `maverick.py`, `tools/db`, `db-build`, `python` : la reconstruction de la base par les outils ; `data/migrations` : les migrations et leurs registres ; `MAVERICK_ROOT` : la racine du dépôt ; `content/wiki` : le dossier de pages fabriqué depuis `data/rows`. Un motif ne prouve pas qu'une lecture a lieu, seulement qu'elle est possible par ce chemin.

| Motif lu | Fichiers |
| --- | ---: |
| `data/migrations` | 155 |
| `data/rows` | 145 |
| `tools/db` | 138 |
| `maverick.py` | 135 |
| `content/wiki` | 91 |
| `db-build` | 52 |
| `python3?['"`]` | 25 |
| `['"`]rows['"`]` | 24 |
| `MAVERICK_ROOT` | 2 |

Par fichier (motifs lus) :

- `accessoires-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `accueil-html` : data/migrations
- `adresses-db` : data/migrations, content/wiki, data/rows, tools/db, maverick.py
- `ancres-figees` : content/wiki, data/migrations, tools/db, maverick.py
- `annexes-magie-notes` : content/wiki, python3?['"`], data/migrations, tools/db, maverick.py, data/rows
- `api-doc` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `archives` : data/migrations
- `arme-forge` : data/migrations, data/rows, tools/db, maverick.py
- `armes-de-famille` : tools/db, maverick.py, data/migrations, data/rows
- `armes-edition` : data/rows, tools/db, maverick.py, data/migrations
- `armes-effets-a-part` : data/migrations, data/rows, tools/db, maverick.py
- `armes-filtres` : tools/db, maverick.py, data/migrations
- `armes-html` : data/rows, ['"`]rows['"`], db-build, data/migrations, tools/db, maverick.py, content/wiki
- `armes-menus` : data/migrations, data/rows, tools/db, maverick.py
- `armure-champs` : tools/db, maverick.py, data/migrations
- `armures-html` : data/rows, ['"`]rows['"`], db-build, content/wiki, data/migrations, tools/db, maverick.py
- `autolink` : content/wiki, tools/db
- `bestiaire-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `bestiaire-pages-html` : tools/db, maverick.py, data/migrations, data/rows
- `ceinture-html` : data/migrations, tools/db, maverick.py, data/rows
- `chronologie-editeur` : data/migrations, tools/db, maverick.py, data/rows
- `chronologie-html` : data/migrations, data/rows, tools/db, maverick.py
- `chronologie-rendu` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `citations-db` : data/migrations, tools/db, maverick.py, data/rows
- `classe-dons-rendu` : tools/db, maverick.py, data/migrations, data/rows
- `classes-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `comparaison-de-sites` : data/rows
- `composants-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `composants-onglets` : data/rows, tools/db, maverick.py, data/migrations
- `conflits-rendu` : data/rows, tools/db, maverick.py, data/migrations
- `conflits-suit-le-don` : data/rows
- `contenu-fourni` : data/rows, ['"`]rows['"`], MAVERICK_ROOT, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `controles-du-contenu` : db-build, data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `corrections` : python3?['"`]
- `db-0099-solidite-et-tableau-du-sort` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-0115-mots-cles-synonymes` : tools/db, maverick.py, python3?['"`], data/migrations, data/rows
- `db-0116-icone-des-mots-cles` : data/migrations, data/rows
- `db-0125-types-de-degats-et-magies` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-0127-nature-des-traces` : data/migrations
- `db-0128-lots-de-changements` : data/rows, data/migrations
- `db-0129-migrations-recues` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-appliquer-edition-traces-0113` : ['"`]rows['"`], db-build, python3?['"`], data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `db-derive-recherche` : data/rows, db-build
- `db-donnees` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations
- `db-extrait` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `db-index-retires` : tools/db, maverick.py, data/migrations
- `db-journal-resolution` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `db-r172-mode-hyper-activable` : data/rows, data/migrations
- `db-r172-sort-prepare-en-mode-hyper` : data/rows, data/migrations
- `db-r173-compteurs-d-actions` : data/rows, data/migrations
- `db-rang-des-races` : data/migrations, data/rows
- `db-schema` : data/rows, tools/db, python3?['"`]
- `debug-metriques` : data/rows, tools/db, maverick.py, data/migrations
- `debug-schema` : data/rows
- `debug-structure` : tools/db, maverick.py, data/migrations
- `deploy-acces` : content/wiki, data/rows, data/migrations
- `deploy-sauvegardes-installer` : content/wiki, data/rows, data/migrations
- `deploy-volume` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `diff-replie` : data/rows
- `dons-edition` : data/rows, tools/db, maverick.py, data/migrations
- `dons-variable-formulaire` : data/rows, tools/db, maverick.py, data/migrations
- `edition-annonces` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `edition-composants-ajout` : data/migrations, data/rows, tools/db, maverick.py, content/wiki
- `edition-mots-cles` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `edition-panneaux` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `edition-races-liens-magies` : data/migrations, tools/db, maverick.py, data/rows, content/wiki
- `edition-saisies` : data/migrations, tools/db, maverick.py, data/rows
- `equipement-html` : data/rows, tools/db, maverick.py, data/migrations
- `fabrication-depuis-contenu` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, MAVERICK_ROOT
- `fiche-html` : data/migrations, data/rows, tools/db, maverick.py, content/wiki
- `flux-git-etat` : data/rows, data/migrations
- `fusion-trois-voies` : data/rows, tools/db, maverick.py, data/migrations
- `glossaire-balisage` : tools/db, maverick.py, data/migrations
- `glossaire-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `glossaire-tableau` : data/migrations, tools/db, maverick.py, data/rows
- `guide-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `guide-sans-chapitres` : tools/db, maverick.py, data/migrations, data/rows, content/wiki
- `historique-site` : data/rows
- `icones-degats-et-magies` : tools/db, maverick.py, data/migrations
- `importeurs-etiquettes` : tools/db, python3?['"`]
- `infobulles` : tools/db, maverick.py, data/migrations
- `installateur-essai-de-structure` : data/migrations, content/wiki, data/rows
- `installateur` : content/wiki, data/rows, data/migrations
- `instructions-claude` : db-build
- `invocations-notes` : content/wiki, python3?['"`], data/migrations, data/rows, tools/db, maverick.py
- `lamia-corruption` : data/migrations, tools/db, content/wiki, data/rows, maverick.py
- `libelles-de-la-base` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements-annulation` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements-numeros` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements` : data/rows, tools/db, maverick.py, data/migrations
- `lots-rendu` : data/rows
- `magie-non-compatible` : data/migrations, tools/db, maverick.py
- `magies-html` : tools/db, maverick.py, data/migrations, data/rows, content/wiki
- `markdown-rendu` : content/wiki, data/migrations, tools/db, maverick.py
- `mentions-des-mots-cles` : tools/db, maverick.py, data/migrations, data/rows
- `metiers-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `migrer-normaliseur` : tools/db, maverick.py, python3?['"`]
- `mise-a-jour-etat-production` : data/rows
- `mise-a-jour-github` : data/rows, ['"`]rows['"`], db-build, tools/db, python3?['"`], data/migrations, maverick.py, content/wiki
- `mise-a-jour-simulation` : data/rows, db-build, ['"`]rows['"`], python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `mise-a-jour` : content/wiki, data/rows, data/migrations
- `mots-cles-liens-rendu` : tools/db, maverick.py, data/migrations, data/rows
- `mots-cles-python` : tools/db, maverick.py, python3?['"`], data/migrations
- `mots-cles-r223` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `mots-cles-vivants-liens` : data/migrations, tools/db, maverick.py
- `mots-cles-vivants` : data/migrations, tools/db, maverick.py
- `mutation` : data/migrations, data/rows, tools/db, maverick.py, db-build
- `notes-de-version-sens` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `notes-de-version` : tools/db, maverick.py, data/migrations, data/rows, db-build
- `onglets-markdown` : content/wiki, data/migrations, tools/db, maverick.py, db-build, data/rows
- `ordre-des-menus` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `pages-db` : content/wiki, data/rows, tools/db, maverick.py, python3?['"`], data/migrations
- `pages-protegees` : data/migrations, data/rows, tools/db, maverick.py
- `personnages-armure-elementaire` : data/rows, data/migrations
- `personnages-liste` : data/rows
- `personnages-livre-de-sort` : data/rows, data/migrations
- `portrait` : tools/db, maverick.py, data/migrations, data/rows
- `r160-potentiel-illimite-sans-gemme` : data/rows, data/migrations
- `race-kinds` : data/rows
- `races-html` : tools/db, content/wiki, data/rows, maverick.py, data/migrations
- `recherche-mots-cles` : tools/db, maverick.py, data/migrations, data/rows
- `recherche-script` : tools/db, maverick.py, data/migrations
- `scripts-controler-les-migrations` : data/rows, data/migrations, db-build, tools/db, maverick.py, ['"`]rows['"`]
- `serveur-acces-routes` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-attestation` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-classeur` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-edition-ancres-figees` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-annonces` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-chronologie` : data/rows, ['"`]rows['"`], db-build, python3?['"`], tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-colonnes-figees` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-don-variable-fiches` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-don-variable` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-liens-rompus` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-edition-mots-cles-cles` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-mots-cles-fusion` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-mots-cles-icone` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-mots-cles-references` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-nature-des-traces` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-numeros` : data/rows, data/migrations, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-pages-regles` : data/rows, ['"`]rows['"`], db-build, tools/db, python3?['"`], data/migrations, content/wiki, maverick.py
- `serveur-edition-r160` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-rejeu-capacites` : data/rows, data/migrations, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-rejeu-fantomes` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki, python3?['"`]
- `serveur-edition-rejeu-fusions` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-rejeu-ids` : data/migrations, data/rows, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-suppression-forcee` : data/rows, ['"`]rows['"`], db-build, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-verrou` : data/migrations, data/rows, tools/db, maverick.py, content/wiki, db-build
- `serveur-essai-dans-l-ombre` : tools/db, maverick.py, data/migrations, data/rows, db-build, content/wiki
- `serveur-essai-de-structure` : tools/db, maverick.py, data/migrations, data/rows, db-build, content/wiki
- `serveur-extrait` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-fiches-retraits` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-livraison` : data/migrations, tools/db, maverick.py
- `serveur-maintenance` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-metriques-bornes` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-metriques-disque` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-metriques-http` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-metriques-sauvegardes` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-metriques` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-mise-a-jour-etats` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-mise-a-jour-production` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-notes-de-version` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-specialisations-magie` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-structure-sur-place-reconstruction` : data/rows, db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-structure-sur-place` : maverick.py, data/migrations, data/rows, db-build, tools/db, content/wiki
- `serveur-tipeee` : data/migrations, tools/db, maverick.py, data/rows, content/wiki, db-build
- `sheets-api-to-json` : python3?['"`]
- `site-html` : data/rows, data/migrations, tools/db, maverick.py, ['"`]rows['"`], db-build, content/wiki
- `sort-bonus-contexte` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `tests-cibles` : content/wiki, data/rows, ['"`]rows['"`], db-build, data/migrations
- `texte-en-place-barres` : data/migrations, tools/db, maverick.py
- `texte-en-place-mots-cles` : data/migrations, tools/db, maverick.py
- `wikilinks` : content/wiki, data/migrations
- `xlsx-to-json` : python3?['"`]

S'y ajoutent 0 fichiers rangés « ne lit pas le contenu » qui lisent le dépôt en direct sans toucher à `lib/donnees` : .

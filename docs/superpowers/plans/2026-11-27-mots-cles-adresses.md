# L'adresse qui suit le titre (chantier 2) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** renommer une page change son adresse dans le même lot, l'ancienne adresse y renvoie, l'identifiant ne bouge pas, et le mot-clé, les balises, les menus et la recherche suivent seuls.

**Architecture :** une migration de structure ajoute `page.slug_adresse` (`NULL` : adresse tirée de l'identifiant, comme aujourd'hui) et la table `page_ancienne_adresse`. Les fonctions pures d'adresse (`lib/metiers.mjs`, `lib/livres.mjs`) reçoivent le segment renommé : explicitement dans le service, qui lit la base vivante, par un état installé une fois au build et dans la chaîne d'édition du navigateur. En fin de lot, `serveur/edition-adresses.mjs` suit chaque page dont le titre a changé ; la page 404 reçoit les anciennes adresses avec ses renvois actuels.

**Tech Stack :** Node ≥ 22.12 (`node:sqlite`, `node:test`), SQLite STRICT, Astro 7 statique, Python 3 pour `db:migrate`. Aucune dépendance nouvelle.

**Spec :** [`docs/chantier-adresses.md`](../../chantier-adresses.md), validée par le propriétaire le 2026-11-27 (R316). Les renvois « §n » visent ce document.

## Global Constraints

- Travail uniquement dans `C:\Git\MaverickCenter\.claude\worktrees\mots-cles-adresses-54a506`, branche `feature/mots-cles-adresses`. Ne jamais toucher à `C:\Git\MaverickCenter`. Commandes npm depuis `client/`.
- Migration **0133**, `user_version` 133, structure seule : aucune ligne écrite, aucun texte de règle. Écrite d'abord 0132 et R310, renumérotée avant le rebase : dev a pris 0132 et R310 à R313 (connexion Discord).
- L'identifiant d'une page ne change jamais. `slug_adresse` et `page_ancienne_adresse` ne s'écrivent que par `serveur/edition-adresses.mjs` (et par l'annulation et le rejeu, qui relisent le journal).
- **Deux lectures, jamais mêlées.** Le service passe toujours le segment lu en base (`null` compris) et n'appelle jamais `installerLesAdresses`. Le build et la chaîne d'édition du navigateur installent l'état une fois et appellent `cheminDePage(id)` sans second argument. `undefined` : état installé ; `null` : pas de segment renommé.
- Formes : `page.slug_adresse` a la forme de `page.slug` ; `page_ancienne_adresse.adresse` est relative à la racine, **sans barre initiale** (`capacites/anansi-anti-corps/`, `metiers/#metier-forgeron`), comme les clés de `data-renvois` ; `mot_cle.url` garde sa barre initiale.
- Un refus écrit par ce chantier ne cite **aucun** numéro `R<n>` (`edition-lots.mjs` : un refus qui en cite un devient un verrou qu'une session Créateur ouvre).
- Un renommage n'est jamais refusé à cause de l'adresse (§3, décision 2).
- `src/lib/*.mjs` reste sans dépendance navigateur ni Astro ; deux scripts de page n'importent jamais le même module (lire `.claude/skills/site-version-portable/SKILL.md` avant de toucher `src/scripts/`).
- Avant de toucher une zone, lire son skill (`.claude/skills/<nom>/SKILL.md`) : `ecrire-une-migration`, `base-sqlite-migrations`, `zone-mots-cles-liens`, `zone-mots-cles-service`, `zone-edition-lots`, `zone-guide`, `zone-metiers`, `site-wiki-liens`, `tests-conventions`. Ne jamais lire en entier un fichier de plus de 60 Ko (`edition.mjs`, `schema.sql`, `docs/serveur.md`) : `Grep`, puis `Read` avec `offset` et `limit`.
- Ne pas modifier : `api/`, la version de `client/package.json`, `data/paquet.json`, `.claude/skills/**`, `data/rows/` hors ce que `db:migrate` écrit pour 0133 (`page.sql`, `page_ancienne_adresse.sql`, `VERSION`).
- Tests : pas de texte ni de valeur modifiable figés (lire par id ou créer ses données avec `test/aide-ancrage.mjs`, noms inventés) ; un test écrit dans une copie, jamais dans `data/rows` ni `var/`. Chaque test se lance seul : `node --test test/<fichier>` depuis `client/`. Durée de chaque fichier de test nouveau notée dans le rapport, moins de 10 s. Une douzaine de tests échouent déjà sur ce poste Windows (`rm`, `sh`, `bash` de WSL) : ne pas les corriger. Une décision appliquée est épinglée par un test qui cite R316.
- Commits en français, un par tâche au moins, terminés par `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Jamais `--no-verify`, jamais de push.

## Review Focus

1. **Renommer la page d'une magie** : l'adresse de chacun de ses sorts (`/magies/<segment>/#sort-…`) change, donc `mot_cle.url` de leurs mots-clés doit suivre, sinon `db:check` refuse la base. Test : tâche 3.
2. **Deux pages qui échangent leurs titres dans le même lot** : aucune ne doit recevoir de suffixe à cause de l'adresse que l'autre quitte. Test : tâche 3.
3. **Créer une page dont l'adresse est celle d'une page renommée, ou une ancienne adresse** : la première reçoit le suffixe ou un refus de la création, la seconde reprend l'adresse et la redirection s'arrête (décision 3). Test : tâche 4.
4. **Une page sans mot-clé, ou dont le mot-clé est verrouillé**, renommée : l'adresse suit quand même, et l'adresse du mot-clé verrouillé aussi. Test : tâche 3.
5. **Un titre sans lettre ni chiffre**, ou un métier dont la page n'a pas de ligne dans `metier` (« Règles des métiers ») : rien ne casse, le segment se tire du titre ou ne bouge pas. Test : tâche 3.

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `data/migrations/0133-adresses-des-pages.sql` (créé) | `page.slug_adresse`, `page_ancienne_adresse` |
| `client/src/lib/adresses-renommees.mjs` (créé) | Pur, sans import : l'état installé des segments renommés du site construit |
| `client/src/lib/livres.mjs`, `metiers.mjs` | Adresse d'une page avec son segment renommé ; renvois des anciennes adresses ; ancres des métiers |
| `client/src/lib/adresses-db.mjs` | Lecture en base : segments, anciennes adresses, adresse d'une page et d'un sort, index |
| `client/serveur/edition-adresses.mjs` (créé) | Suivi du renommage en fin de lot, adresse prise, libération d'une ancienne adresse, refus d'un lot qui écrit une adresse |
| `client/serveur/edition-ancrage.mjs`, `edition.mjs`, `edition-plan.mjs`, `edition-journal.mjs`, `edition-lots.mjs` | Branchements : suivi, création, suppression, plan, verrou, lignes en attente |
| `client/serveur/controles-du-contenu.mjs`, `client/scripts/db-check.mjs` | Contrôles : deux pages à la même adresse, ancienne adresse vivante |
| `client/src/lib/wiki.ts`, `client/astro.config.mjs`, `src/pages/[type]/[slug].astro`, `src/pages/404.astro`, `src/layouts/Base.astro`, `src/components/metier/MetiersTableau.astro` | Site construit |
| `client/src/scripts/edition/*.mjs`, `client/serveur/api.mjs`, `acces-routes.mjs` | Site de dev avant la refabrication |
| `client/test/adresses-renommees.test.mjs`, `serveur-edition-adresses*.test.mjs`, `db-0133-adresses-des-pages.test.mjs` (créés) | Tests |

---

### Task 1: Migration 0133 et registres

**Agent :** sonnet, effort élevé. Skills à lire : `ecrire-une-migration`, `base-sqlite-migrations`, `base-sqlite`, `revue-sql`.

**Files:**
- Create: `data/migrations/0133-adresses-des-pages.sql`, `client/test/db-0133-adresses-des-pages.test.mjs`
- Modify: `data/schema.sql` (colonne en dernier de `page`, table après `alias`, `PRAGMA user_version = 133`), `data/pages-d-exemple.sql`, `data/rows/{VERSION,page.sql,page_ancienne_adresse.sql}` (par `db:migrate` seulement), `docs/sql/structure.md`, `docs/sql/apercu.md` (par `db:doc`)
- Modify: `client/src/lib/tables-de-la-base.mjs:56` (`TABLES_DE_REGLES`), `client/src/lib/libelles-de-la-base.mjs:23,235` (`NOMS_DES_TABLES`, `NOMS_DES_COLONNES`), `client/src/lib/ressources/wiki.mjs:464` (`HORS_RESSOURCE`), `client/src/lib/notes-de-version.mjs:1017` (`TRACES_TECHNIQUES`), `client/serveur/epreuve-des-lots.mjs:157` (`COUVERT_PAR_L_ENTITE.page`)
- Test : les compteurs épinglés que le précédent 0131 a touchés (commit `d13109a2` : `git show --stat d13109a2 -- client/test`)

**Interfaces:**
- Produces : `page.slug_adresse TEXT` (`NULL` par défaut, `CHECK` de même forme que celui de `page.slug`) ; `page_ancienne_adresse (adresse TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE) STRICT, WITHOUT ROWID`, `CHECK` : `adresse` non vide, ne commence pas par `/`, finit par `/` ou contient `#` ; index `page_ancienne_adresse_page` sur `page_id`. Modèle : `mot_cle_ancienne_cle` (`schema.sql:250`).

- [ ] **Step 1 : le test qui échoue.** `db-0133-adresses-des-pages.test.mjs`, sur le modèle de `db-0131-ancrage-mots-cles.test.mjs` : la colonne existe et vaut `NULL` sur chaque page ; la table existe, vide, avec sa clé étrangère en cascade et son index ; un `slug_adresse` mal formé (`'A b'`) et une adresse `'/x/'` ou `'x'` sont refusés par le `CHECK` ; `user_version` vaut 133 ; la migration ne contient aucun `INSERT`, `UPDATE` ni `DELETE` (R316).
- [ ] **Step 2 :** `node --test test/db-0133-adresses-des-pages.test.mjs`. Attendu : échec, colonne absente.
- [ ] **Step 3 :** écrire la migration et `schema.sql`, puis `npm run db:migrate -- ../data/migrations/0133-adresses-des-pages.sql`, `node scripts/db-pages-d-exemple.mjs`, `npm run db:doc`. Ne garder de `data/rows` que `VERSION`, `page.sql`, `page_ancienne_adresse.sql` (`git status` : rien d'autre).
- [ ] **Step 4 :** registres. `page_ancienne_adresse` : classée « contenu » (`TABLES_DE_REGLES`), nommée « Anciennes adresses des pages », colonnes `adresse` « Ancienne adresse » et `page_id` ; hors ressource de l'API (registre technique des renvois) ; trace technique de la note de version ; couverte par l'entité `page` dans l'épreuve des lots. `slug_adresse` : libellé « Segment d'adresse ».
- [ ] **Step 5 :** faire suivre les compteurs épinglés, puis lancer le test de la tâche et chaque test modifié, un par un. Attendu : verts.
- [ ] **Step 6 :** `npm run db:controler-migrations -- --base origin/dev`, `npm run db:check`, `npm run db:doc -- --check`. Attendu : verts.
- [ ] **Step 7 :** commit « Adresses : migration 0133 (`page.slug_adresse`, `page_ancienne_adresse`) ».

### Task 2: Lire une adresse

**Agent :** opus, effort élevé. Skills : `zone-guide`, `zone-metiers`, `zone-mots-cles-liens`, `site-wiki-liens`.

**Files:**
- Create: `client/src/lib/adresses-renommees.mjs`, `client/test/adresses-renommees.test.mjs`
- Modify: `client/src/lib/livres.mjs:265-292,402-409` (`adresseDuGuide`, `slugDAdresse`, `pageDuGuideALAdresse`), `client/src/lib/metiers.mjs:17,35-53,68-91,105-125` (`ancreDeMetier`, `adresseDePage`, `cheminDePage`, `estServieASonId`, `renvoisDuGuide`, `chargerMetiers`), `client/src/lib/adresses-db.mjs`
- Test: `client/test/livres.test.mjs`, `metiers.test.mjs`, `adresses-db.test.mjs`

**Interfaces:**
- Produces, `lib/adresses-renommees.mjs` (aucun import) :
  - `installerLesAdresses(paires: Iterable<[id: string, slug: string]>): number` remplace l'état, rend le nombre de paires ;
  - `slugRenomme(id: string): string | null` ;
  - `pageAuSlug(type: string, slug: string): string | null` (l'inverse, pour une page du guide `type` vaut `'guide'`).
- Produces, `lib/livres.mjs` : `slugDAdresse(id, slug = slugRenomme(id))` rend `slug ?? ADRESSES_RENOMMEES_DU_GUIDE[id] ?? slugDe(id)` ; `adresseDuGuide(id, slug)` le transmet ; `pageDuGuideALAdresse(adresse)` rend d'abord `pageAuSlug('guide', segment)`, et `null` pour le segment d'identifiant d'une page qui en a reçu un autre.
- Produces, `lib/metiers.mjs` : `ancreDeMetier(id, slug)`, `adresseDePage(id, slug)`, `cheminDePage(id, slug)` (second argument : `undefined` état installé, `null` aucun) ; `segmentDePage(id, slug): string` (dernier segment d'une page ordinaire) ; `estServieASonId(id)` devient « servie par la route du wiki » : ni métier, ni `pageSansAdresse`, ni `guide/…`, quel que soit son segment ; `pageARouteFixe(id): boolean` (vrai pour `pageSansAdresse(id)` et pour `DECOUVRIR.accueil`) ; `renvoisDuGuide(ids, anciennes = [])` où `anciennes: { adresse, page_id }[]` ajoute, pour chaque adresse sans `#` dont la page est chargée, `adresse → cheminDePage(page_id)` si elles diffèrent ; `chargerMetiers(db)` lit `slug_adresse` et rend pour chaque métier `ancre` et `anciennesAncres: string[]` (les `metier-…` de ses lignes `metiers/#metier-…`).
- Produces, `lib/adresses-db.mjs` : `slugsDAdresse(db): Map<id, slug>` et `anciennesAdresses(db): { adresse, page_id }[]`, vides si la colonne ou la table manque ; `adresseDeLaPage(id, slug)` ; `adresseDeLaPageEnBase(db, id): string` ; `adresseDuSort(sortId, slugDeLaMagie)` ; `adresseDuSortEnBase(db, sortId)` ; `pageDeLAncienneAdresse(db, adresse): string | null` ; `adressesDuSite(db)` et `indexDesAdresses(db, options)` passent le segment lu en base pour chaque page, jamais l'état installé.

- [ ] **Step 1 : les tests qui échouent** (`adresses-renommees.test.mjs`, R316 cité). Sans état installé, `cheminDePage(id)` de chaque page de la base d'essai vaut ce qu'il valait (`<id>/`, adresse du guide, ancre du métier, R228 `regles/mode-super/`, R272). Avec `slug` explicite : `cheminDePage('capacites/a-b', 'a-c') === 'capacites/a-c/'` ; `cheminDePage('guide/x', 'y') === 'regles/y/'` ; une page du Guide du MJ garde `mj/` ; `cheminDePage('metiers/forgeron', 'ferronnier') === 'metiers/#metier-ferronnier'` ; une page à route fixe ignore le segment ; `cheminDePage(id, null)` ignore l'état installé. État installé : `installerLesAdresses([['guide/x','y']])` puis `cheminDePage('guide/x') === 'regles/y/'`, `pageDuGuideALAdresse('regles/y/') === 'guide/x'`, `pageDuGuideALAdresse('regles/x/') === null` ; un second appel remplace le premier. `renvoisDuGuide(ids, [{ adresse: 'regles/x/', page_id: 'guide/x' }])` contient `'regles/x/': 'regles/y/'`, ignore une adresse à `#`, une page non chargée et un renvoi sur soi. Base : `adresseDeLaPageEnBase`, `adresseDuSortEnBase` (magie renommée), `adressesDuSite` et `pageDeLAdresse(indexDesAdresses(db), …)` connaissent la nouvelle adresse et plus l'ancienne ; `pageDeLAncienneAdresse` ; `slugsDAdresse` et `anciennesAdresses` sur une base sans la colonne ni la table rendent du vide ; `chargerMetiers` rend `anciennesAncres`.
- [ ] **Step 2 :** lancer le fichier. Attendu : échec, module absent.
- [ ] **Step 3 :** écrire `adresses-renommees.mjs`, puis les signatures ci-dessus. `metiers.mjs` et `livres.mjs` importent `slugRenomme` de `adresses-renommees.mjs` (pas de cycle : ce module n'importe rien).
- [ ] **Step 4 :** adapter `livres.test.mjs:204-225`, `metiers.test.mjs:27,42` et `adresses-db.test.mjs` à la nouvelle définition de `estServieASonId` et aux signatures ; lancer ces quatre fichiers. Attendu : verts.
- [ ] **Step 5 :** commit « Adresses : lecture du segment renommé (R316) ».

### Task 3: Suivre le renommage

**Agent :** opus, effort très élevé. Skills : `zone-mots-cles-service`, `zone-edition`, `zone-edition-lots`, `zone-mots-cles-liens`.

**Files:**
- Create: `client/serveur/edition-adresses.mjs`, `client/test/serveur-edition-adresses.test.mjs`
- Modify: `client/serveur/edition-journal.mjs:201-207` (`w.lignes`), `client/serveur/edition-ancrage.mjs:7,90-98,347-349` (`elementDe`, `suivreLesElements`), `client/serveur/edition.mjs` (construction de `ANCRAGE` : chercher `outilsDeLAncrage(`)
- Test: `client/test/serveur-edition-ancrage-suivi.test.mjs:154`, `serveur-edition-pages-regles.test.mjs:144`, `serveur-edition-guide.test.mjs:45,119`

**Interfaces:**
- Consumes : tâche 2 (`adresseDeLaPage`, `adresseDeLaPageEnBase`, `adresseDuSortEnBase`, `indexDesAdresses`, `pageARouteFixe`) ; `lib/dons-edition.mjs#idDeDon`, `slugDeClasse` ; `lib/text.mjs#normalize` ; `lib/mots-cles-liens.mjs#decouperLAdresse`.
- Produces, `edition-journal.mjs` : chaque entrée de `w.lignes` gagne `avant` (pour un `modifier` : les valeurs d'avant des colonnes changées ; `null` sinon).
- Produces, `serveur/edition-adresses.mjs` :
  - `segmentsVoulus(db, page): Iterable<string>` : les segments à essayer, dans l'ordre, pour la page lue en base (§3) ;
  - `outilsDesAdresses({ ErreurEdition }): { suivreLesTitres(ctx): number, adressePrise(db, adresse, { sauf?: Iterable<string> }): string | null, libererLAdresse(ctx, adresse): void, retirerLesAnciennes(ctx, pageId): void }`. `adresse` : forme de `mot_cle.url` (barre initiale). `adressePrise` rend l'id de la page vivante qui la tient, ou un motif (`'route'`) pour une route fixe, une rubrique ou un nom réservé des Règles, sinon `null`.
- Produces, `edition-ancrage.mjs` : `outilsDeLAncrage({ …, ADRESSES })` ; `suivreLesElements(ctx)` appelle `ADRESSES.suivreLesTitres(ctx)` juste après son test d'annulation, avant tout le reste ; `elementDe` lit l'adresse par `adresseDeLaPageEnBase` et `adresseDuSortEnBase`.

**Règle de `suivreLesTitres(ctx)`**, dans cet ordre :

1. Pages à suivre : pour chaque entrée `page` de `w.lignes` dont `colonnes` contient `titre`, la page si elle existe encore, n'est pas à route fixe, et si `normalize(premier avant.titre du lot) !== normalize(titre actuel)`.
2. Adresses prises : `indexDesAdresses(db, { exemples: true }).exactes`, **sans** les adresses des pages à suivre de l'étape 1, plus les routes fixes, les rubriques (`type_page`), `regles/<nom réservé>/` et `regles/<onglet>/`.
3. Pour chaque page, dans l'ordre du lot : le premier segment de `segmentsVoulus` dont l'adresse n'est pas prise. Si c'est son adresse d'aujourd'hui : rien. Sinon écrire, par `w` : `page.slug_adresse` (le segment, ou `null` si `adresseDeLaPage(id, null)` est déjà la nouvelle adresse) ; l'insertion de l'adresse quittée dans `page_ancienne_adresse` ; la suppression de la ligne de `page_ancienne_adresse` qui porte la nouvelle adresse ; `mot_cle.url` de chaque mot-clé dont l'adresse est l'adresse quittée (page à ancre : égalité entière ; sinon égalité du chemin, requête et ancre gardées). L'adresse retenue rejoint les adresses prises.

**`segmentsVoulus`** : capacité qui a sa ligne dans `capacite` : les candidats d'`idDeDon({ slugClasse: slugDeClasse(classe_id), nom, niveau, rang }, …)` sans le préfixe `capacites/` (base, `-<niveau>`, `-<niveau>-<rang>`, `-<niveau>-<rang>-2`…) ; métier, race, classe qui a sa ligne : `normalize(nom)` (classe raciale : le segment de sa race, comme `edition.mjs:1257-1271`), puis `-2`, `-3`… ; toute autre page : `normalize(titre)`, puis `-2`, `-3`… Un segment vide : aucun candidat, rien ne bouge.

- [ ] **Step 1 : les tests qui échouent** (`serveur-edition-adresses.test.mjs`, base de `test/aide-ancrage.mjs`, renommages par `enregistrer` comme `serveur-edition-ancrage-suivi.test.mjs`). Un test par ligne, chacun vérifie `slug_adresse`, `page_ancienne_adresse`, `mot_cle.url` et `adresseDeLaPageEnBase` :
  - page des Règles renommée : nouvelle adresse `/regles/<nouveau>/`, ancienne enregistrée, id inchangé (R316) ;
  - accent ou majuscule seuls : rien n'est écrit ;
  - retour à l'ancien titre : `slug_adresse` redevient `NULL`, la ligne de l'ancienne adresse reprise disparaît, celle de l'adresse intermédiaire existe ;
  - trois renommages de suite : deux anciennes adresses, toutes vers la même page ;
  - adresse prise par une autre page : suffixe `-2`, renommage accepté (R316 (2)) ;
  - nom réservé (`Glossaire` pour une page des Règles) : suffixe ;
  - adresse reprise sur l'ancienne d'une autre page : la ligne de l'autre page disparaît (R316 (3)) ;
  - capacité renommée : `capacites/<classe>-<nouveau>/` ; nom déjà pris dans la classe : `-<niveau>` (R316 (1), (2)) ;
  - métier renommé : `mot_cle.url === '/metiers/#metier-<nouveau>'`, ancienne `metiers/#metier-<ancien>` (R316 (4)) ;
  - race et classe renommées ; classe sans « (classe) » dans son adresse ;
  - page à route fixe renommée : rien ;
  - page de R228 (`guide/liste-des-effets-mode-super`) renommée à un titre dont le segment est celui de son identifiant : `slug_adresse` écrit, non `NULL` ;
  - Review Focus 1 : page d'une magie renommée, `mot_cle.url` de ses sorts ancrés suit, ancre gardée ;
  - Review Focus 2 : deux pages échangent leurs titres dans un même lot (lot déposé, `deposerEtAppliquer`), aucune n'a de suffixe ;
  - Review Focus 4 : page sans mot-clé ; page dont le mot-clé est verrouillé ;
  - Review Focus 5 : titre sans lettre ni chiffre ; « Règles des métiers » renommée ;
  - mot-clé sans élément dont l'adresse est une section de la page (`/regles/x/#s`) : son chemin suit, `#s` gardé ;
  - après chaque cas, `controlerLeContenu(db).problemes` n'a rien de plus qu'avant.
- [ ] **Step 2 :** lancer le fichier. Attendu : échec, module absent.
- [ ] **Step 3 :** `w.lignes` porte `avant` ; adapter les tests qui comparent la forme d'une entrée (`Grep` : `colonnes:` dans `client/test/`).
- [ ] **Step 4 :** écrire `edition-adresses.mjs` et les branchements. Les écritures du module vont directement par `w`, jamais sous le verrou.
- [ ] **Step 5 :** les trois tests qui disaient « l'adresse ne bouge pas » changent de sens et citent R316 ; lancer les quatre fichiers et `serveur-edition-ancrage*.test.mjs`. Attendu : verts. Noter la durée du fichier nouveau.
- [ ] **Step 6 :** commit « Adresses : le renommage d'une page déplace son adresse (décision R316) ».

### Task 4: Création, suppression, plan et autres lecteurs du service

**Agent :** opus, effort moyen. Skills : `zone-edition`, `zone-edition-menus`, `zone-mots-cles-service`.

**Files:**
- Modify: `client/serveur/edition.mjs:221-245` (`supprimerPage`), `:390` (`adresseDuLien`), `:632-651` (`creerPage`), `:1368` (`idDeDonPris`), `:3683` ; `client/serveur/edition-plan.mjs:125-131,246` ; `client/src/lib/mots-cles-ancrage.mjs:283,332,338` ; `client/src/lib/mots-cles-db.mjs:122-125` ; `client/src/lib/citations-db.mjs:71`
- Test: `client/test/serveur-edition-adresses-creation.test.mjs` (créé), `serveur-edition-plan.test.mjs:167`, `citations-db.test.mjs:99`

**Interfaces:**
- Consumes : tâche 2 (`adresseDeLaPageEnBase`, `adresseDuSortEnBase`, `slugsDAdresse`), tâche 3 (`ADRESSES.adressePrise`, `libererLAdresse`, `retirerLesAnciennes`).
- Produces : aucune signature nouvelle. `creerPage` refuse (409, sans numéro de décision, message qui nomme la page) une page dont l'adresse est celle d'une page vivante, et libère l'ancienne adresse qu'elle reprend ; `idPris` et `idDeDonPris` comptent comme pris un identifiant dont l'adresse est celle d'une page vivante ; `supprimerPage` retire par `w` les lignes de `page_ancienne_adresse` de la page avant la page ; l'entrée du plan rend l'adresse d'aujourd'hui.

- [ ] **Step 1 : les tests qui échouent** : Review Focus 3 (page des Règles créée au titre dont le segment est l'adresse d'une page renommée : `-2` ; don créé de même ; métier créé dont l'adresse est une ancienne adresse d'un métier renommé : créé, la ligne de l'ancienne adresse disparaît) ; page renommée puis supprimée : ses anciennes adresses sont retirées, chacune a sa ligne au journal, et le lot rejoué redonne la même base ; l'entrée du plan d'une page renommée porte `regles/<nouveau>/` ; un lien saisi `[texte](/regles/<nouveau>/)` est accepté et devient la balise du mot-clé, le même vers `/regles/<ancien>/` est refusé (400) ; la citation d'une page renommée se fait par son adresse d'aujourd'hui.
- [ ] **Step 2 :** lancer. Attendu : échecs.
- [ ] **Step 3 :** adapter chaque site d'appel de la liste « Files » : plus aucun `adresseDeLaPage(id)` ni `adresseDuSort(id)` à un argument dans `client/serveur/`, `lib/mots-cles-ancrage.mjs`, `lib/mots-cles-db.mjs` (`Grep` à zéro).
- [ ] **Step 4 :** lancer le fichier nouveau, `serveur-edition-plan`, `citations-db`, `mots-cles-ancrage*`, `mots-cles-db*`. Attendu : verts.
- [ ] **Step 5 :** commit « Adresses : création, suppression et plan connaissent l'adresse renommée (R316) ».

### Task 5: Verrou, contrôles, annulation, note de version

**Agent :** opus, effort élevé. Skills : `zone-edition-lots`, `zone-mise-a-jour-lots`, `zone-edition-rejeu`, `zone-mise-a-jour`.

**Files:**
- Modify: `client/serveur/edition-adresses.mjs` (`refusDeLAdresse`), `client/serveur/edition.mjs:3593,3657,3676` et l'insertion générique d'un lot (voisins de `refusDuDetachement`), `client/serveur/controles-du-contenu.mjs:417`, `client/scripts/db-check.mjs`, `client/serveur/edition-journal.mjs:1061-1091` (`lignesEnAttente`)
- Test: `client/test/serveur-edition-adresses-lots.test.mjs` (créé), `notes-de-version*.test.mjs` (le fichier qui épingle `mot_cle_id` hors des colonnes listées)

**Interfaces:**
- Consumes : tâche 3 (`sousLeVerrou` de `edition-ancrage.mjs`, `ADRESSES`), tâche 2 (`indexDesAdresses`, `anciennesAdresses`, `pageARouteFixe`).
- Produces : `refusDeLAdresse(ctx, table: string, valeurs: object | null): string | null` exportée par `edition-adresses.mjs` : sous le verrou et par la voie d'un lot, refuse toute écriture de `page.slug_adresse` et toute insertion, modification ou suppression dans `page_ancienne_adresse` (« L'adresse d'une page vient de son titre : aucun lot ne l'écrit. ») ; jamais en annulation ni au rejeu. Contrôles du contenu nouveaux, lus par le service et par `db:check` : « deux pages à la même adresse » (nomme les deux pages et l'adresse), « ancienne adresse tenue par une page vivante », « segment d'adresse sur une page à route fixe ».

- [ ] **Step 1 : les tests qui échouent** : un lot qui écrit `page.slug_adresse` ou une ligne de `page_ancienne_adresse` est refusé, session Créateur comprise, et son refus ne contient aucun `R<n>` ; un lot qui renomme une page passe et l'adresse suit ; ce lot annulé en entier rend le titre, `slug_adresse`, `page_ancienne_adresse` et `mot_cle.url` d'avant (choix 8) ; ses lignes annulées une à une, de la dernière à la première, rendent le même état ; l'annulation est refusée (409) quand l'adresse d'avant est tenue par une autre page, et le message nomme cette page (choix 12) ; le journal rejoué sur une base neuve donne les mêmes `slug_adresse`, `page_ancienne_adresse` et `mot_cle.url` ; chaque contrôle nouveau se déclenche sur une base fabriquée fautive et se tait sur la base saine ; `lignesEnAttente(db, { pourLesPages: true })` ne rend ni les lignes de `page_ancienne_adresse` ni une ligne `page` qui n'écrit que `slug_adresse` ; la note de version d'un renommage n'a qu'une ligne pour la page, aucune pour l'adresse (choix 9).
- [ ] **Step 2 :** lancer. Attendu : échecs.
- [ ] **Step 3 :** implémenter. Si une ligne annulée seule laisse un état que les contrôles refusent, c'est le refus attendu : ne pas ajouter de dépendance entre lignes.
- [ ] **Step 4 :** lancer le fichier nouveau, `serveur-edition-lots*.test.mjs`, `controles-du-contenu*.test.mjs`, `notes-de-version*.test.mjs`, puis `npm run db:check`. Attendu : verts. Noter la durée du fichier nouveau.
- [ ] **Step 5 :** commit « Adresses : verrou des lots, contrôles et annulation (R316) ».

### Task 6: Le site construit

**Agent :** sonnet, effort élevé. Skills : `site-wiki-liens`, `site-version-portable`, `zone-metiers`, `zone-classes`.

**Files:**
- Modify: `client/src/lib/wiki.ts:17-24,71-77`, `client/astro.config.mjs` (index des `[[liens]]`), `client/src/pages/[type]/[slug].astro:24-32`, `client/src/pages/404.astro:14-17`, `client/src/components/metier/MetiersTableau.astro:61,168-178`, `client/src/lib/classe-dons-rendu.mjs:19`, `client/src/layouts/Base.astro`
- Test: `client/test/adresses-du-site.test.mjs` (créé), `livres.test.mjs:842`

**Interfaces:**
- Consumes : tâche 2 (`installerLesAdresses`, `slugsDAdresse`, `anciennesAdresses`, `segmentDePage`, `estServieASonId`, `renvoisDuGuide(ids, anciennes)`, `chargerMetiers` avec `anciennesAncres`).
- Produces : `wiki.ts` installe les segments au chargement, sur une ligne à part après `installerLePlan(…)` (`livres.test.mjs:842` épingle cette dernière mot pour mot) et exporte `slugOf(entry)` rendu par `segmentDePage(entry.id)` ; `astro.config.mjs` installe les mêmes avant `scanContent` (les deux graphes de modules ne partagent pas l'état) ; `Base.astro` écrit `<script type="application/json" id="adresses-renommees">` (objet `{ id: slug }`) seulement s'il y a au moins un segment renommé.

- [ ] **Step 1 : les tests qui échouent** (`adresses-du-site.test.mjs`, sans build) : `wiki.ts` et `astro.config.mjs` appellent `installerLesAdresses` (lecture du source, comme `livres.test.mjs:842`) ; la route `[type]/[slug].astro` tire `slug` de `slugOf` et filtre par `estServieASonId` ; `404.astro` passe `anciennesAdresses(…)` à `renvoisDuGuide` ; `MetiersTableau.astro` pose un élément d'`id` égal à chaque ancienne ancre dans la ligne du métier et son script ouvre la ligne pour une ancienne ancre ; `classe-dons-rendu.mjs` rend l'adresse d'un don par `cheminDePage` (état installé : `capacites/a-b` renommée mène à `capacites/a-c/`) ; `Base.astro` n'écrit rien quand aucune page n'est renommée.
- [ ] **Step 2 :** lancer. Attendu : échecs.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npm run build`, puis `node --test test/site-html.test.mjs test/equipement-html.test.mjs test/glossaire-html.test.mjs` et le fichier nouveau. Attendu : verts, et le même nombre de pages dans `dist/` qu'avant la tâche (aucune page n'est renommée dans la copie du dépôt).
- [ ] **Step 5 :** commit « Adresses : le site construit sert la nouvelle adresse et renvoie l'ancienne (R316) ».

### Task 7: Le site de dev avant la refabrication

**Agent :** sonnet, effort élevé. Skills : `site-version-portable`, `zone-edition`, `zone-service`, `zone-api-rest`.

**Files:**
- Modify: `client/serveur/api.mjs:596-609`, `client/serveur/acces-routes.mjs:47`, `client/src/scripts/edition/editeur.mjs`, `client/src/scripts/edition/nouvelles.mjs:160-200`, `client/src/scripts/edition/metiers.mjs:15-21`, `client/src/scripts/edition/classes.mjs:166`, `docs/api.md`
- Test: `client/test/serveur-edition-page-de-l-adresse.test.mjs` (créé), le test qui épingle la liste des routes (`Grep` : `'en-attente'` dans `client/test/`)

**Interfaces:**
- Consumes : tâche 2 (`indexDesAdresses`, `pageDeLAdresse`, `pageDeLAncienneAdresse`, `installerLesAdresses`, `cheminDePage`).
- Produces : `GET /api/edition/page-de-l-adresse/?adresse=<chemin relatif>` rend `200 { page: string | null }` : la page vivante de cette adresse, sinon celle de cette ancienne adresse ; même classe d'accès que `GET /api/edition/pages/`. `editeur.mjs` installe au démarrage l'objet de `#adresses-renommees` s'il existe. `nouvelles.mjs` exporte `adresseEncoreServie(page: string | null, chemin: string): string | null` (pure : `cheminDePage(page)` s'il diffère de `chemin`, sinon `null`).

- [ ] **Step 1 : les tests qui échouent** : la route rend l'id pour l'adresse d'aujourd'hui d'une page renommée, pour chacune de ses anciennes adresses, et `null` pour une adresse inconnue, une rubrique, une adresse mal formée ; `adresseEncoreServie` rend l'adresse construite d'une page renommée depuis le build, `null` quand c'est déjà l'adresse demandée (pas de boucle) et `null` pour `page` nul.
- [ ] **Step 2 :** lancer. Attendu : échecs.
- [ ] **Step 3 :** implémenter. Sur la page 404 du site de dev, `nouvelles.mjs` interroge la route avant ses cas actuels et fait `location.replace` vers `adresseEncoreServie(…)` s'il n'est pas nul, requête et ancre gardées. `metiers.mjs` et `classes.mjs` tirent ancre et adresse de `lib/metiers.mjs`, plus de l'identifiant.
- [ ] **Step 4 :** lancer le fichier nouveau, le test des routes, `nouvelles*.test.mjs`, et le test qui contrôle les imports des scripts de page (`Grep` : `n'importent jamais le même module` dans `client/test/`). Attendu : verts.
- [ ] **Step 5 :** commit « Adresses : une page renommée reste visible sur le site de dev avant la refabrication (R316) ».

### Task 8: Documentation et règle « Identifiants figés »

**Agent :** sonnet, effort moyen.

**Files:**
- Modify: `CLAUDE.md:68`, `docs/content-guide.md:476`, `docs/serveur.md` (« Édition des règles (site de dev) »), `docs/api.md`, `client/src/lib/ressources/wiki.mjs:32-34` (description de `pages-du-guide`), les commentaires de tête de `lib/metiers.mjs`, `lib/livres.mjs:259-282`, `lib/adresses-db.mjs:1-9`, `serveur/edition.mjs:1825`
- Create: `docs/superpowers/plans/2026-11-27-mots-cles-adresses-skills.md` (la demande à `tech-skills`)

- [ ] **Step 1 :** `CLAUDE.md:68` devient exactement : « - **Identifiants figés, adresses qui suivent.** Un nom corrigé ou renommé ne change jamais son identifiant. L'adresse d'une page suit son titre : le service la recalcule au renommage et l'ancienne redirige (R316) ; elle ne s'écrit jamais à la main. »
- [ ] **Step 2 :** chaque doc et commentaire qui dit qu'une adresse ne change pas dit la règle de R316 ; `docs/serveur.md` décrit le suivi (§3), l'annulation (§6) et la route de la tâche 7.
- [ ] **Step 3 :** la demande à `tech-skills` liste, sans les modifier, les skills à mettre à jour avec la phrase à corriger et son remplacement : `site-wiki-liens`, `zone-mots-cles-liens`, `zone-mots-cles-service`, `zone-guide`, `zone-metiers`, `zone-edition`, `base-sqlite` (compteurs).
- [ ] **Step 4 :** `node --test test/instructions-claude.test.mjs test/decisions-index.test.mjs` et les tests qui lisent `docs/` (`Grep` : `docs/serveur.md` dans `client/test/`). Attendu : verts.
- [ ] **Step 5 :** commit « Adresses : documentation et règle des identifiants figés amendée (R316) ».

### Task 9: Contrôle final et PR

**Agent :** la session principale, avec un agent de test (sonnet) pour les passages longs et un relecteur (opus) pour la branche entière.

- [ ] **Step 1 : copie du dépôt.** `npm run test:cible`, `npm run db:check`, `npm run db:pages-check`, `npm run db:controler-migrations -- --base origin/dev`, `npm run db:doc -- --check`, `npm run build`, puis la suite entière `npm test`. Attendu : verts, hors les échecs connus de ce poste, comparés à la liste obtenue sur `origin/dev`.
- [ ] **Step 2 : extrait ancré.** Fabriquer un extrait d'une base ancrée (`serveur/extrait.mjs#fabriquerExtrait`, comme le chantier 1), `MAVERICK_CONTENU=<fichier> npm test`. Attendu : les mêmes verts.
- [ ] **Step 3 : site entier, une page renommée.** Sur une copie de la base, renommer par le service une page des Règles, une capacité et un métier ; `MAVERICK_CONTENU=<copie> npm run build` ; vérifier dans `dist/` : la page à sa nouvelle adresse, aucun fichier à l'ancienne, le renvoi dans `404.html`, l'ancienne ancre dans `metiers/index.html`, la nouvelle adresse dans l'index de recherche et le menu, `#adresses-renommees` présent. Puis `node tools/build-artifact.mjs` : la version portable se fabrique.
- [ ] **Step 4 :** durée des tests nouveaux additionnée ; relecture de la branche entière (skill `revue-de-diff`), corrections.
- [ ] **Step 5 :** `git fetch --prune origin`, rebase sur `origin/dev` si elle a bougé, push de `feature/mots-cles-adresses`, PR vers `dev` en français (skill `publier-une-branche`), fusion automatique par merge commit et auto-fix activés. Jamais vers `master`.

# Les pages de notion (chantier 3 des mots-clés) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque notion (mot-clé sans élément, type de sort, monnaie, type de dégâts) a sa page des Règles hors menu, ancrée sur son mot-clé, qui montre ce que la base sait d'elle ; un mot-clé nouveau naît avec sa page ; la mise en place est un lot annulable ligne par ligne.

**Architecture :** une page de notion est une ligne `page` de type `guide` qui n'est dans aucun menu (ni Découvrir, ni onglet, ni Guide du MJ), sans résumé, dont le texte est la seule ligne `<!-- guide:notion -->`. `lib/livres.mjs` l'admet hors du plan ; le bloc calculé `notion` (`lib/notion-db.mjs`, `components/guide/BlocNotion.astro`) lit la base au build. Le service la crée par un module neuf (`serveur/edition-notions.mjs`), pour un mot-clé existant ou avec un mot-clé neuf ; le format `maverick-lot/1` reçoit une forme d'opération (`page`, `inserer`, `ancrage: { notion: true }`). « Préparer l'ancrage » apprend une cinquième famille, déposée après les quatre autres. Aucune migration.

**Tech Stack :** Node ≥ 22.12 (`node:sqlite`, `node:test`), SQLite STRICT, Astro 7 statique. Aucune dépendance nouvelle.

**Spec :** [`docs/chantier-pages-de-notion.md`](../../chantier-pages-de-notion.md), écrite le 2026-11-27 par la session, **sans validation du propriétaire** (choix d'équipe, décision suivie : R309 (7)). Les renvois « §n » visent ce document.

## Global Constraints

- Travail uniquement dans `C:\Git\MaverickCenter\.claude\worktrees\mots-cles-pages-de-notion-d7928c`. Ne jamais toucher à `C:\Git\MaverickCenter`. Commandes npm et `node --test` depuis `client/`.
- **Règle d'or :** aucun texte de règle, définition ou nom de lore inventé. Une page de notion n'a pas de résumé et son corps est la seule ligne du bloc. Le bloc n'écrit que des intitulés d'interface courts (« Type », « Autres noms », « Sorts », « Pages »). Les fixtures de test portent des noms inventés (`status: example`, « Zephyrion … »), jamais du lore.
- **Aucune migration.** Aucune écriture dans `data/rows/`, `data/paquet.json`, `data/schema.sql`, `api/`, `.claude/skills/**`, ni de la version de `client/package.json`.
- **Décisions.** R268 : Bête, Mécanique et Démon restent sans infobulle (leur page n'a ni résumé ni texte). R291 : chaque ligne d'un lot est annulable. R309 (7) : la notion a sa page ; (9) : un mot-clé ancré ne se modifie plus au Glossaire ; (16) : supprimer, « protéger et refuser » ; (17) : type, couleur, icône, synonymes et définition d'un ancré se corrigent par un lot de l'équipe. R316 : l'adresse suit le titre, elle ne s'écrit jamais à la main. R185 (7) : aucun onglet créé, les onglets sont fixes.
- **Les 24 mots-clés sans élément qui ont déjà une adresse ne reçoivent pas de page** : ils sont listés « à trancher ». Le numéro, la clé, le type, la définition, les synonymes et la couleur d'un mot-clé existant ne changent jamais ; seule son adresse (`url`) devient celle de sa page.
- Un refus écrit par ce chantier ne cite **aucun** numéro `R<n>` (`edition-lots.mjs#ecrireLesOperations` : un refus qui en cite un devient un verrou qu'une session Créateur ouvre).
- `src/lib/*.mjs` reste sans dépendance navigateur ni Astro ; le code qui touche au DOM va dans `src/scripts/` ; deux scripts de page n'importent jamais le même module (lire `.claude/skills/site-version-portable/SKILL.md` avant de toucher `src/scripts/`).
- Avant de toucher une zone, lire son skill (`.claude/skills/<nom>/SKILL.md`, nommé dans chaque tâche). Ne jamais lire en entier un fichier de plus de 60 Ko (un hook le refuse : `edition.mjs`, `edition-lots.mjs`, `edition-modele.mjs`, `notes-de-version.mjs`, `mots-cles-balises.mjs`, `data/schema.sql`, `docs/serveur.md`, `docs/content-guide.md`) : `Grep`, puis `Read` avec `offset` et `limit`. Ne pas ouvrir `node_modules/`, `client/dist/`, `data/rows/`, `sources/raw/`, `api/`, `var/`.
- **Tests :** aucun texte ni valeur modifiable sur le site figés (créer ses données avec `test/aide-ancrage.mjs`, noms inventés) ; un test écrit dans une copie ou en mémoire, jamais dans `data/rows` ni `var/`. Chaque auteur ne lance que les tests qu'il écrit ou modifie, un fichier à la fois : `node --test test/<fichier>.test.mjs` depuis `client/`. Jamais la suite entière, ni `npm run build`, hors tâche 8. Chaque fichier de test nouveau dure moins de 10 s ; sa durée est notée dans le rapport. Sur ce poste, `installateur-essai-de-structure` et `instructions-claude` échouent déjà sur `origin/dev` : ne pas les corriger.
- Pas de commit, pas de `git stash`, pas de `--no-verify`, aucune commande Git d'écriture : la session principale commite à la fin. Commentaires et messages en français, comme le code voisin ; identifiants comme le code voisin.
- Les numéros de ligne de ce plan datent de `b7f3ed97` : une tâche précédente a pu les décaler, retrouver l'endroit par `Grep` sur le nom cité.

## Review Focus

1. **Annuler la ligne d'une page de notion posée sur un mot-clé existant** : la page, sa ligne `page_source` et l'adresse du mot-clé partent ensemble (un groupe) ; le mot-clé reste, avec son numéro, sa clé, son type, sa définition, ses synonymes, ses mentions. La ligne `source` du jour, partagée par toutes les pages du lot, ne bloque rien. Test : tâche 3.
2. **Mot-clé verrouillé (`verrou = 1`) ou de monnaie (table figée)** : sa page de notion se crée et s'annule sans ouvrir aucun verrou de décision. Test : tâche 3.
3. **Le bloc `notion` ne protège pas la page** (`lib/pages-protegees.mjs:98` protège toute page qui porte un bloc) : sans cela, ni la suppression (décision 16) ni l'annulation ne passeraient. Test : tâche 3.
4. **Noms.** Un nom qui est déjà le titre, le slug ou l'alias d'une autre page, deux mots-clés candidats de même nom, un nom sans lettre ni chiffre : « à trancher », jamais de page. Un identifiant déjà employé (journal, historique, nom réservé, id d'onglet) : suffixe `-2`, `-3`… Tests : tâches 3 et 4.
5. **Les tests existants créent un mot-clé nu par `enregistrer`** (environ 120 appels dans 26 fichiers) : la règle « un mot-clé naît avec sa page » ne joue que pour `voie: 'route'`, que seules les deux routes donnent. Test : tâche 6.
6. **R268** : après la mise en place, un mot-clé sans définition dont la page n'a pas de résumé n'a pas d'infobulle. Test : tâche 4.

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `client/src/lib/livres.mjs` | Page hors plan admise ; `GLOSSAIRE`, `estHorsDuPlan`, `estUnePageDeNotion`, fil d'Ariane et place d'une page de notion |
| `client/src/components/guide/PageDuPlan.astro`, `PageDuGuide.astro` | Page servie sans menu latéral, fil vers le Glossaire, `data-ed-notion` |
| `client/src/lib/guide.mjs`, `client/src/lib/notion-db.mjs` (créé), `client/src/components/guide/BlocNotion.astro` (créé), `GuideBloc.astro`, `client/src/styles/guide/blocs.css` | Le bloc calculé `notion` |
| `client/serveur/edition-notions.mjs` (créé), `edition.mjs`, `edition-plan.mjs`, `edition-lots.mjs`, `client/src/lib/lot-de-changements.mjs`, `client/src/lib/pages-protegees.mjs` | Créer, supprimer, déposer par lot, annuler, rejouer |
| `client/src/lib/mots-cles-ancrage.mjs`, `client/serveur/edition-ancrage-lots.mjs`, `client/src/lib/lots-rendu.mjs` | La cinquième famille de « Préparer l'ancrage » |
| `client/src/lib/notes-de-version.mjs` | Une ligne pour la famille |
| `client/serveur/edition-chronologie.mjs`, `api.mjs`, `ressources.mjs`, `client/src/scripts/edition/mots-cles.mjs`, `client/src/lib/mots-cles-edition.mjs` | « Nouveau mot-clé » crée la notion et sa page |
| `client/src/scripts/edition/nouvelles.mjs`, `guide.mjs`, `menus.mjs`, `docs/*.md` | Site de dev avant la refabrication, résumé facultatif, suppression, documentation |
| `client/test/livres-pages-de-notion.test.mjs`, `notion-db.test.mjs`, `serveur-edition-notions.test.mjs`, `serveur-edition-notions-lots.test.mjs`, `mots-cles-ancrage-notions.test.mjs`, `serveur-edition-ancrage-notions.test.mjs`, `notes-de-version-notions.test.mjs`, `serveur-edition-notions-glossaire.test.mjs` (créés) | Tests |

**Ordre :** 1 et 2 en parallèle ; puis 3 ; puis 4, 5 et 6 en parallèle ; puis 7 ; puis 8.

---

### Task 1: Le plan des Règles admet une page hors menu

**Agent :** sonnet, effort élevé. Taille : petite. Skills à lire : `zone-guide`, `tests-conventions`.

**Files:**
- Modify: `client/src/lib/livres.mjs:165` (voisin de `NOMS_RESERVES` : `GLOSSAIRE`), `:518` (après `estDesOnglets`), `:544-552` (`placeDansLeGuide`), `:592-598` (`filDAriane`), `:612-657` (`verifierLePlan`, le refus des lignes 651-655)
- Modify: `client/src/components/guide/PageDuPlan.astro:27-35`, `client/src/components/guide/PageDuGuide.astro:36,80`
- Create: `client/test/livres-pages-de-notion.test.mjs`
- Test: `client/test/livres.test.mjs:248-258` (le cas « rangée nulle part »)

**Constat :** la route `client/src/pages/regles/[...page].astro:14` sert déjà toute page dont l'adresse commence par `regles/` (`pagesSous`), et `PageDuPlan.astro:40-46` la rend sans menu latéral quand `menuLateralDe` rend `null` (c'est le cas de la fixture `guide/utiliser-ce-wiki`). Seul `verifierLePlan` arrête le build. Aucune route à créer. `CeinturePanneau.astro`, `pages/index.astro`, `pages/mj/index.astro`, `serveur/notes-de-version.mjs:232` et `scripts/mise-a-jour-regles.mjs:245` n'ont rien à changer (`notes-de-version.mjs` : tâche 5).

**Interfaces:**
- Produces, `lib/livres.mjs` :
  - `GLOSSAIRE = gele({ titre: 'Glossaire', chemin: 'regles/glossaire/' })` (le titre de `pages/regles/glossaire.astro:45`) ;
  - `estHorsDuPlan(id: string): boolean` (plan installé) : `id` commence par `guide/` et n'est ni dans Découvrir (`estDansDecouvrir`), ni dans un onglet (`estDesOnglets`), ni dans le Guide du MJ (`estDuGuideDuMj`) ;
  - `estUnePageDeNotion(entry: { id, data?: { status? } }): boolean` : `estHorsDuPlan(entry.id)` et `entry.data?.status !== 'example'` ;
  - `filDAriane(id, { notion = false } = {})` : pour une page rangée nulle part, `[{ titre: GLOSSAIRE.titre, chemin: GLOSSAIRE.chemin }]` si `notion`, sinon `[]` comme aujourd'hui ;
  - `placeDansLeGuide(id, { notion = false } = {})` : pour une page rangée nulle part, `{ rubrique: GLOSSAIRE.titre, rang: onglets.length + 2, ordre: null }` si `notion`, sinon les trois `null` comme aujourd'hui ;
  - `verifierLePlan(entries)` : une page `guide/…` non rangée et pas d'exemple n'arrête plus le build (c'est une page de notion). Elle l'arrête si son segment d'adresse (`slugDAdresse(id)`) est un nom réservé ou un id d'onglet (`nomsReserves()`), avec un message qui la nomme. Toutes les autres erreurs restent (page absorbée, retirée, supprimée revenue, adresse d'une page renommée).

- [ ] **Step 1 : le test qui échoue** (`livres-pages-de-notion.test.mjs`, plan d'essai installé par `installerLePlan` comme en tête de `livres.test.mjs`, ids inventés) : `verifierLePlan` rend ses entrées quand une page `guide/zephyrion-notion` n'est dans aucun menu (R309 (7), R185 (7) cités) ; il s'arrête pour une page hors plan dont l'id est `guide/glossaire`, `guide/artisanat` ou `guide/<id d'un onglet>` ; il s'arrête toujours pour une page de `PAGES_SUPPRIMEES` revenue ; `estHorsDuPlan` est faux pour une page de Découvrir, d'un onglet, du Guide du MJ et pour un id qui ne commence pas par `guide/` ; `estUnePageDeNotion` est faux pour une page d'exemple hors plan ; `filDAriane(id, { notion: true })` vaut `[{ titre: GLOSSAIRE.titre, chemin: 'regles/glossaire/' }]` et `filDAriane(id)` reste `[]` ; `placeDansLeGuide(id, { notion: true })` rend la rubrique du Glossaire et un rang supérieur à celui du Guide du MJ ; une page d'onglet ne change ni de fil ni de place, avec ou sans l'option ; `menuLateralDe` d'une page hors plan vaut `null`.
- [ ] **Step 2 :** `node --test test/livres-pages-de-notion.test.mjs`. Attendu : échec (`GLOSSAIRE` absent).
- [ ] **Step 3 :** implémenter dans `livres.mjs`. Mettre à jour l'en-tête de `verifierLePlan` (:600-611) et de `filDAriane`, `placeDansLeGuide`.
- [ ] **Step 4 :** `PageDuGuide.astro:36` : `filDAriane(entry.id, { notion: estUnePageDeNotion(entry) })` ; `:80` : l'élément `.guide-corps` porte `data-ed-notion=""` quand la page est une page de notion et `modifiable` (lu par la tâche 7). `PageDuPlan.astro:35` : `entree` vaut `GLOSSAIRE.chemin` pour une page de notion (le menu du site a cette entrée : `lib/nav.mjs:48`).
- [ ] **Step 5 :** `livres.test.mjs:258` : le cas `guide/une-page-nouvelle` ne lève plus ; l'assertion devient « admise, c'est une page de notion » et cite R309 (7). Les lignes 193, 380, 393 et 394 (sans l'option) ne changent pas. Lancer `livres-pages-de-notion`, `livres`, `guide`, `pages-protegees`. Attendu : verts.

**Critères de fin :** les deux fichiers verts ; aucune route nouvelle ; `Grep "n'est rangée nulle part" client/src` ne trouve plus le refus.

### Task 2: Le bloc calculé `notion`

**Agent :** sonnet, effort élevé. Taille : moyenne. Skills : `zone-guide`, `zone-mots-cles`, `zone-recherche`, `ui-couleurs`, `tests-conventions`.

**Files:**
- Modify: `client/src/lib/guide.mjs:23-27` (`BLOCS`), `client/src/components/guide/GuideBloc.astro` (une branche `bloc === 'notion'`, près de `:200`), `client/src/styles/guide/blocs.css`
- Create: `client/src/lib/notion-db.mjs`, `client/src/components/guide/BlocNotion.astro`, `client/test/notion-db.test.mjs`
- Test: `client/test/guide.test.mjs:126-129` (`NON_APPELES`)

**Interfaces:**
- Produces, `lib/guide.mjs` : `BLOCS` contient `'notion'` ; `BLOC_DE_NOTION = 'notion'` ; `CORPS_D_UNE_PAGE_DE_NOTION = '<!-- guide:notion -->\n'`.
- Produces, `lib/notion-db.mjs` (pur, la base est passée par l'appelant) : `chargerNotion(db, pageId: string)` rend `null` si la page n'existe pas ou n'a pas de `mot_cle_id`, sinon :
  ```
  { mot_cle: { id, cle, libelle },
    definition: string | null,          // definitionDuMotCle(m), lib/mots-cles-balises.mjs:189
    type: string | null,                // libellé de sa catégorie s'il en a exactement une
    synonymes: string[],                // mot_cle_synonyme, dans leur ordre
    sorts: [{ magie: { id, nom, adresse }, sorts: [{ id, nom, adresse }] }],
    pages: [{ rubrique: string, pages: [{ id, titre, adresse }] }],   // rubrique : page.type
    recherche: string }                 // `/recherche/?mot-cle=${encodeURIComponent(cle)}`
  ```
- Consumes : `lib/mots-cles-db.mjs#chargerVocabulaire` (:149, en cache par base : ne pas appeler `motsClesDeLaBase` à chaque page, le build rend 156 pages), `#categoriesDesMotsCles` (:29) ; `lib/adresses-db.mjs#adresseDeLaPage` (:63), `#adresseDuSort` (:75), `#slugsDAdresse` (:84) ; `lib/mots-cles-balises.mjs#definitionDuMotCle`, `#htmlDeLaDefinition` (:906).

**Comportement :**
- **Sorts liés** : ceux de `sort_mot_cle` (`mot_cle_id` = le mot-clé) et, si un `type_sort` a ce mot-clé (`type_sort.mot_cle_id`), ceux dont une ligne `sort_type.type` vaut ce code ; un sort présent des deux côtés n'apparaît qu'une fois ; groupés par magie (`sort.magie_id`), magies par nom, sorts dans l'ordre de leur page (lire par `PRAGMA table_info(sort)` la colonne d'ordre qu'utilise `lib/magies`, sinon par nom) ; adresse : `adresseDuSort(id, segment de la magie)`. Structure : `Grep "CREATE TABLE sort_mot_cle\|CREATE TABLE sort_type\|CREATE TABLE type_sort" data/schema.sql`.
- **Pages** : celles de `page_tag` (`tag_id` = le mot-clé), sans la page elle-même ni les pages `statut = 'example'`, groupées par `page.type` dans l'ordre de `lib/types.mjs#TYPES`, par titre dans un groupe ; adresse : `adresseDeLaPage(id, segment)`.
- **Rendu** (`BlocNotion.astro`, props `{ entry }`, base par `ouvrirBase()` comme `GuideBloc.astro:2`) : la définition par `htmlDeLaDefinition` (`set:html`, comme la sous-ligne du Glossaire, `mots-cles-balises.mjs:895` : ses balises deviennent des liens par le middleware du site) ; une liste de définitions « Type », « Autres noms » ; « Sorts », un sous-titre par magie (lien vers sa page), chaque sort en lien ; « Pages », un sous-titre par rubrique (`TYPES[type].label`) ; un lien « Voir dans la Recherche » vers `recherche`. Adresses passées par `url()` de `lib/wiki`. **Chaque partie est absente quand elle est vide** : ni titre, ni phrase de remplacement. Tout vide et sans définition : le bloc ne rend que le lien de Recherche.
- CSS : classes `guide-notion…` dans `styles/guide/blocs.css`, couleurs par les variables du site (skill `ui-couleurs`), listes longues sur plusieurs colonnes (`columns`), sans script.

- [ ] **Step 1 : le test qui échoue** (`notion-db.test.mjs`, base de `test/aide-ancrage.mjs` : `baseDAncrage`, `poserMotCle`, `poserPage`, `poserMagie`, `poserSort`, noms inventés ; les étiquettes de sort, de page et l'ancre d'un type posées en SQL) : définition écrite rendue telle quelle ; sans définition et sans résumé : `definition === null` ; type et synonymes dans l'ordre ; deux catégories ou aucune : `type === null` ; sorts par étiquette groupés par magie avec leur adresse `/magies/<magie>/#sort-…` ; sorts par type quand le mot-clé est celui d'un `type_sort` ; un sort étiqueté et du type : une seule fois ; pages par étiquette groupées par rubrique, sans la page elle-même ni une page d'exemple ; `recherche` porte la clé ; chaque partie vide rend une liste vide ; page sans `mot_cle_id` ou inconnue : `null` ; une magie dont la page a un segment renommé (`page.slug_adresse`) donne l'adresse d'aujourd'hui (R316). `morceauxDuChapitre(CORPS_D_UNE_PAGE_DE_NOTION)` vaut `[{ bloc: 'notion' }]`.
- [ ] **Step 2 :** `node --test test/notion-db.test.mjs`. Attendu : échec, module absent.
- [ ] **Step 3 :** implémenter le module, le composant, la branche de `GuideBloc.astro`, le CSS. Commenter `BLOCS` (:11-22) : le bloc `notion`, R309 (7).
- [ ] **Step 4 :** `guide.test.mjs:126-129` : `notion` rejoint `NON_APPELES` (aucune migration ne le pose : il est posé par le service). Chercher les autres tests qui énumèrent `BLOCS` (`Grep "BLOCS" client/test`). Lancer `notion-db`, `guide`. Attendu : verts.

**Critères de fin :** les deux fichiers verts ; `BlocNotion.astro` ne contient aucune phrase de règle ; aucun `motsClesDeLaBase(` dans `notion-db.mjs`.

### Task 3: Créer, supprimer et déposer une page de notion

**Agent :** opus, effort très élevé. Taille : grande. Skills : `zone-mots-cles-service`, `zone-edition`, `zone-edition-lots`, `zone-edition-rejeu`, `zone-edition-menus`, `zone-mots-cles-liens`, `tests-conventions`.

**Files:**
- Create: `client/serveur/edition-notions.mjs`, `client/test/serveur-edition-notions.test.mjs`, `client/test/serveur-edition-notions-lots.test.mjs`
- Modify: `client/serveur/edition.mjs:640-667` (`creerPage`), `:1901` (`PLAN`, puis `NOTIONS`), `:1823-1844` (`PAGE.colonnes`, résumé), `:3673-3739` (`OPERATIONS_DU_LOT`)
- Modify: `client/serveur/edition-plan.mjs:128-135` (`idPris`), `:183-209` (`page.supprimer`), `:212` (retour)
- Modify: `client/src/lib/lot-de-changements.mjs:6-26` (en-tête), `:64-67`, `:231-251` (`controlerLAncrage`)
- Modify: `client/serveur/edition-lots.mjs:155-184` (`traduire`), `:897-921` (`lignesEmportees`)
- Modify: `client/src/lib/pages-protegees.mjs:16,98-100`
- Test: `client/test/lot-de-changements.test.mjs`, `pages-protegees.test.mjs:42-52`, `serveur-edition-pages-regles.test.mjs:190`

**Constat :** `creerPage` appelle toujours `ANCRAGE.ancrerLaPage` (:665), qui crée un mot-clé neuf du type « Guide » et ne refuse jamais. `page.creer` (`edition-plan.mjs:146`) exige un onglet et un résumé. `traduire` refuse l'insertion d'une `page` (:181). `page.supprimer` refuse une page sans entrée de menu (:189). L'annulation d'une ligne `page` insérée passe par `traduire` → `supprimer` de l'entité `page_des_regles` (`operationsDeLAnnulation`, `edition-lots.mjs:586`). `ANCRAGE.alignerMotCle` (`edition-ancrage.mjs:265`) prend la page comme élément avant le type de sort (`ancreDuMotCle`, :253) et écrit `mot_cle.url` par `w`, hors du verrou. `ANCRAGE.retirerLeMotCle` (:410) garde déjà un mot-clé tenu par un autre élément (R289).

**Interfaces:**
- Consumes : tâche 2 (`CORPS_D_UNE_PAGE_DE_NOTION`, `BLOC_DE_NOTION`).
- Produces, `edition-plan.mjs` : `domainesDuPlan(…)` rend aussi `idPris(db, slug, onglets, index)`.
- Produces, `edition.mjs` : `creerPage(ctx, { …, motCle })` : `motCle` absent, comportement actuel ; un id de mot-clé, la ligne `page` est insérée avec `mot_cle_id` et `ancrerLaPage` n'est pas appelé. Exporte `NOTIONS` (les outils ci-dessous, liés au service).
- Produces, `serveur/edition-notions.mjs` : `outilsDesNotions({ ErreurEdition, refus, creerPage, creerMotCle, ANCRAGE, idPris })` rend :
  - `estUnePageDeNotion(db, pageId): boolean` : page de type `guide`, pas d'exemple, sans ligne dans `regles_onglet_entree`, ni dans Découvrir ni dans le Guide du MJ (`lib/livres.mjs#estDansDecouvrir`, `#estDuGuideDuMj`, qui ne demandent pas le plan installé) ;
  - `idDeNotion(db, nom: string, { pris = new Set() } = {}): string | null` : `guide/<normalize(nom)>`, puis `-2`, `-3`… tant que `idPris` le dit pris ou que `pris` le contient ; `null` si `normalize(nom)` est vide ;
  - `refusDeLaNotion(db, motCle: { id?, libelle }): { statut, message, details? } | null` : nom sans lettre ni chiffre ; nom déjà titre, slug ou alias d'une autre page (`cle_page`, message qui nomme la page) ; mot-clé qui désigne déjà une page (`page.mot_cle_id`) ;
  - `creerLaPageDeNotion(ctx, { mot_cle_id, id = undefined, titre = undefined }): string` : la page d'un mot-clé EXISTANT. Refus 404 (mot-clé inconnu), 409 (`refusDeLaNotion` ; `titre` donné différent du libellé ; `id` donné qui n'est pas `guide/<normalize(libellé)>` suivi ou non de `-<n>`, ou qui est pris). Écrit : la page (`type: 'guide'`, titre = libellé caractère pour caractère, `resume: null`, `corps: CORPS_D_UNE_PAGE_DE_NOTION`, `mot_cle_id`), sa provenance comme toute page créée, puis `ANCRAGE.alignerMotCle(ctx, mot_cle_id)` (l'adresse). **Aucune ligne de `regles_onglet_entree`.** Rend l'id de la page ;
  - `creerLaNotion(ctx, { libelle, categorie, description = null, synonymes = [], couleur = null, icone = null }): { id: number, page: string }` : la notion NOUVELLE. Contrôle d'abord `refusDeLaNotion`, crée la page sans ancre, puis le mot-clé par `creerMotCle(ctx, libelle, description, { url: <adresse de la page>, categories: [categorie], synonymes, couleur, icone, ancre: { table: 'page', id } })` (`edition.mjs:261`). Tout refus de `creerMotCle` remonte (409) : jamais de page sans mot-clé, jamais de mot-clé sans page ;
- Produces, format `maverick-lot/1` : `{ "table": "page", "cle": { "id": "guide/<slug>" }, "operation": "inserer", "apres": { "id": "guide/<slug>", "titre": "<nom du mot-clé>", "mot_cle_id": <id, ou un jeton déjà donné> }, "ancrage": { "notion": true } }`. `controlerLAncrage` : sur `page`, seule l'insertion est admise, `ancrage` vaut exactement `{ notion: true }`, `apres` n'a que `id`, `titre`, `mot_cle_id`. Les deux formes de `mot_cle` ne changent pas.
- Produces, `OPERATIONS_DU_LOT.creer_page_de_notion(ctx, { id, titre, mot_cle_id })` → `NOTIONS.creerLaPageDeNotion`. `traduire` (avant le refus de la ligne 181) rend `[{ op: 'creer_page_de_notion', … }, { op: 'verifier_ligne', table: 'page', cle: { id }, attendu: { id, titre, resume: null, corps_md: CORPS_D_UNE_PAGE_DE_NOTION, mot_cle_id } }]`.

**Suppression (décision 16) :** `page.supprimer` admet une page de notion (`NOTIONS.estUnePageDeNotion`, donné au domaine comme `adressePrise`) : pas d'entrée de menu à retirer ; les contrôles actuels restent (protection, mot-clé verrouillé, citations et mentions de son mot-clé : 409 avec la liste). Le mot-clé part avec elle par `supprimerPage` (:225), sauf s'il est tenu par un type de sort, une monnaie, un type de dégâts ou une étiquette de sort (R289, déjà dans `retirerLeMotCle`) : il reste alors et son adresse se vide. **En annulation** (`ctx.annulation`) : ni les mentions du mot-clé ni son verrou ne retiennent la page (le mot-clé reste : `motCleARetirer` rend déjà `null`, `edition-ancrage.mjs:394`). Toute autre page hors des onglets reste refusée (400). `pages-protegees.mjs` : le bloc `notion` n'est pas une raison de protection ; les autres blocs le restent.

**Résumé :** `PAGE.colonnes` accepte un résumé vidé (enregistré `NULL`) pour une page de notion ; il reste obligatoire pour une page d'un onglet. Trouver le contrôle par `Grep "function valeursValidees" client/serveur/edition.mjs` (`TABLES.page.colonnes.resume.requis`, `edition-modele.mjs:698`, ne change pas).

**Annulation (R291) :** `lignesEmportees` forme un groupe par page de notion insérée par le lot : la ligne `page` (effet net `inserer`, `fin.mot_cle_id` non nul, `fin.corps_md` égal à `CORPS_D_UNE_PAGE_DE_NOTION`), ses lignes `page_source` (`cle.page_id`), et la ligne `mot_cle` de ce mot-clé si le lot l'a écrite (`modifier` de `url` pour un mot-clé existant ; `inserer`, avec ses catégories et clés quittées par `tientAuMotCle`, pour un mot-clé créé par le lot). La ligne `source` du jour reste hors du groupe. Le groupe s'annule entier ou reste en place (`groupesGardes`, :1018), comme ceux des chantiers 1 et 2.

- [ ] **Step 1 : les tests du service qui échouent** (`serveur-edition-notions.test.mjs`, base de `test/aide-ancrage.mjs` en fichier ouverte par `ouvrirBaseVivante`, modèle : `serveur-edition-adresses-creation.test.mjs` ; les outils sont appelés par un lot : `appliquerUnLot` ou `deposerEtAppliquer`) :
  - mot-clé existant sans élément ni adresse : la page a son libellé pour titre, `resume IS NULL`, `corps_md === CORPS_D_UNE_PAGE_DE_NOTION`, `statut = 'draft'`, une source ; aucune ligne de `regles_onglet_entree` ; `page.mot_cle_id` le désigne ; son `id`, `cle`, `description`, `couleur`, `icone`, ses catégories et ses synonymes sont ceux d'avant ; son `url` est `/regles/<slug>/` (R309 (7)) ; `controlerLeContenu(db).problemes` n'a rien de plus qu'avant ;
  - mot-clé d'un type de sort, d'un type de dégâts, d'une monnaie : la page est créée, `type_sort.mot_cle_id` (ou l'autre lien) n'a pas bougé ;
  - Review Focus 2 : mot-clé `verrou = 1`, et mot-clé de monnaie : créés sans refus ;
  - refus, rien d'écrit : mot-clé inconnu ; nom sans lettre ni chiffre ; nom qui est le titre, le slug ou l'alias d'une autre page ; mot-clé qui désigne déjà une page ; `titre` différent du libellé ; aucun de ces messages ne contient `R<chiffres>` ;
  - identifiant : `guide/<slug>` déjà employé par une page supprimée du journal, nom réservé (`glossaire`), id d'onglet : `-2` ; un `id` donné déjà pris : 409 ;
  - notion nouvelle : mot-clé créé avec le type donné et la définition, page et ancre dans le même lot du journal ; la clé suit la règle (un homonyme d'un autre type passe) ; un nom que la règle refuse (synonyme d'un autre mot-clé) : 409, ni page ni mot-clé ;
  - verrou : après la création, modifier le libellé ou la définition du mot-clé par une opération de route est refusé (409, R309 (9)) ; renommer la page renomme le mot-clé, sa clé et son adresse (R316) ;
  - résumé : vidé sur une page de notion, accepté ; vidé sur une page d'onglet, refusé ;
  - suppression : refusée (409, `details.citations`) quand un texte cite le mot-clé ; refusée quand il est verrouillé ; sinon la page et le mot-clé partent ; le mot-clé d'un type de sort reste et son `url` redevient `NULL` (R309 (16)) ; une page hors plan d'exemple ou une page de Découvrir : 400 ;
  - Review Focus 3 : `raisonsDeProtection` d'une page de notion est vide ; avec un second bloc (`<!-- guide:initiative -->`), elle est protégée.
- [ ] **Step 2 : les tests du lot qui échouent** (`serveur-edition-notions-lots.test.mjs`, modèles : `serveur-edition-adresses-lots.test.mjs`, `serveur-edition-lots-ancrage.test.mjs`) : `controlerLeLot` accepte la forme et refuse `ancrage: { notion: true }` sur une modification, sur une autre table, avec une colonne de plus dans `apres` ; un lot de trois pages de notion s'applique (`deposerEtAppliquer`) ; Review Focus 1 : annuler la ligne d'une page (`annulerUneLigne`) retire la page, sa ligne `page_source` et l'adresse du mot-clé, laisse le mot-clé tel qu'avant le lot et les deux autres pages en place ; annuler le lot entier (`annuler`) rend la base d'avant, `source` comprise ; une page de notion renommée depuis le lot : son groupe est gardé, avec son motif ; un mot-clé verrouillé : sa ligne s'annule sans décision à ouvrir ; un lot qui insère un mot-clé (voie existante), sa catégorie, puis sa page de notion par un jeton `{ "$numero": … }` s'applique et s'annule en entier ; le journal rejoué sur une base neuve (`rejouer`, skill `zone-edition-rejeu`) donne les mêmes lignes `page`, `page_source`, `mot_cle` ; un lot qui écrit `page.mot_cle_id`, `resume` ou `corps_md` d'une page de notion par la voie générique garde les refus d'aujourd'hui.
- [ ] **Step 3 :** lancer les deux fichiers. Attendu : échecs (module absent).
- [ ] **Step 4 :** implémenter dans l'ordre : `pages-protegees.mjs`, `edition-plan.mjs`, `creerPage`, `edition-notions.mjs`, `NOTIONS` dans `edition.mjs` (après `PLAN`, :1901), le format, `traduire`, l'opération du lot, les groupes. Les écritures passent par `w` ; aucune n'ouvre un verrou.
- [ ] **Step 5 :** adapter `pages-protegees.test.mjs:42-52` (le bloc `notion` ne protège pas), `serveur-edition-pages-regles.test.mjs:190` (« 400 hors des onglets » : une page de Découvrir, plus une page hors plan), `lot-de-changements.test.mjs` (la forme nouvelle, et la liste des clés d'`ancrage`). Mettre à jour l'en-tête de `lot-de-changements.mjs:24-26`, de `traduire` (:143-154) et de `lignesEmportees` (:887-896).
- [ ] **Step 6 :** lancer, un par un : les deux fichiers nouveaux, `lot-de-changements`, `lot-de-changements-annulation`, `pages-protegees`, `serveur-edition-pages-regles`, `serveur-edition-plan`, `serveur-edition-lots-annulation`, `serveur-edition-lots-ancrage`, `serveur-edition-ancrage`, `serveur-edition-adresses-creation`, `serveur-edition-adresses-lots`. Attendu : verts. Noter la durée des deux fichiers nouveaux.

**Critères de fin :** les tests ci-dessus verts ; `Grep "R[0-9]" client/serveur/edition-notions.mjs` ne trouve un numéro que dans des commentaires ; aucune ligne de `regles_onglet_entree` écrite par ce module.

### Task 4: La cinquième famille de « Préparer l'ancrage »

**Agent :** opus, effort élevé. Taille : moyenne. Skills : `zone-mots-cles-service`, `zone-edition-lots`, `zone-mise-a-jour-lots`, `tests-conventions`.

**Files:**
- Modify: `client/src/lib/mots-cles-ancrage.mjs:1-8` (en-tête), `:42-47` (`TITRES`), `:234-242` (signature), `:377-403` (comptes, lots, retour)
- Modify: `client/serveur/edition-ancrage-lots.mjs:17-23` (`cleDuPlan`), `:43-58`, `:101,133` (appels du plan)
- Modify: `client/src/lib/lots-rendu.mjs:489-496` (`phraseDeLEcartee`)
- Create: `client/test/mots-cles-ancrage-notions.test.mjs`, `client/test/serveur-edition-ancrage-notions.test.mjs`
- Test: `client/test/mots-cles-ancrage.test.mjs:269,301,315`, `lots-rendu.test.mjs`

**Interfaces:**
- Consumes : tâche 3 (la forme d'opération, `NOTIONS.idDeNotion` exporté par `serveur/edition.mjs`), `lib/mots-cles-db.mjs#elementsDesMotsCles` (:113).
- Produces : `planDeLAncrage(db, { ecartees, idDeNotion })` où `idDeNotion?: (nom: string, pris: Set<string>) => string | null` (donné par le service ; sans lui, une version locale : `guide/<normalize(nom)>` suffixé tant qu'une page porte cet id ou que `pris` le contient). `comptes.notions: number`. Clé écartée : `notion:<mot_cle_id>`. Lot `famille: 'notions'`, titre « Ancrage des mots-clés : pages de notion », `nature: 'decision'`, `DECISION_DE_L_ANCRAGE`, `AUTEUR_DE_L_ANCRAGE` (c'est donc un lot d'ancrage : replié sur la page Mise à jour, annulé par groupes).

**Règle du plan (§3) :**
1. Candidats, par id croissant. Les éléments de chaque mot-clé se lisent par `elementsDesMotsCles(db)`. Famille A : aucun élément. Famille B : ses éléments sont tous dans `type_sort`, `type_degats`, `monnaie`. Tout mot-clé qui a un élément `page`, `sort` ou `magie` est sauté (il a déjà son nom et son adresse), comme tout mot-clé que le plan ancre dans ce même calcul (`pris`, :280 et :321).
2. « À trancher » (`table: 'mot_cle'`, son id, son libellé, la raison), sans opération : `url` non nulle (« il mène déjà à <url> » : les 24, et tout mot-clé de la famille B qui aurait une adresse) ; nom sans lettre ni chiffre ; nom qui est le titre, le slug ou l'alias d'une page (`cle_page`, la raison nomme la page) ; deux candidats de même `normalize(libelle)` (les deux) ; `idDeNotion` qui rend `null`.
3. Les autres : une opération de la tâche 3, `id = idDeNotion(libelle, pris)` (l'id retenu rejoint `pris`), `titre = libelle`, `mot_cle_id = id du mot-clé` ; sautée et listée dans `ecartees` si `notion:<id>` est écartée.
4. Le lot `notions` n'est rendu que si les quatre autres n'ont plus d'opération (comme la suite attend les catégories, :393) ; `comptes.notions` le compte dans tous les cas. Au plus `OPERATIONS_MAX` opérations.
5. Rejouable : un mot-clé qui désigne une page n'est plus candidat.

**Service :** `preparerLAncrage` donne `idDeNotion: (nom, pris) => NOTIONS.idDeNotion(db, nom, { pris })` aux deux appels du plan. `cleDuPlan` : une ligne `page` de genre `inserer` dont `fin.mot_cle_id` est non nul rend `notion:<fin.mot_cle_id>` ; la ligne `mot_cle` (`modifier` de `url`) du même groupe ne rend pas `nom:<id>` (sinon l'annulation d'une page écarterait aussi l'alignement de son mot-clé). `phraseDeLEcartee` : `notion` → « la page de notion du mot-clé n° <id> ».

- [ ] **Step 1 : les tests du plan qui échouent** (`mots-cles-ancrage-notions.test.mjs`, base `baseDAncrage()` avec les quatre catégories nouvelles posées par `poserLesCategoriesNouvelles`, opérations lues par `operationsDe(plan, 'notions')`) : un mot-clé sans élément ni adresse reçoit une opération (R309 (7)) ; un mot-clé de type de sort, de type de dégâts, de monnaie sans page aussi ; un mot-clé de magie, de sort ou de page : rien ; un mot-clé sans élément qui a une adresse : à trancher, aucune opération ; nom pris par une page, deux homonymes, nom sans lettre : à trancher ; l'id suit `idDeNotion` donné et deux noms au même slug prennent deux ids ; tant qu'un des quatre lots a une opération, `notions` n'est pas rendu et `comptes.notions` le compte ; une fois appliqué (helper SQL du fichier : insérer la page avec `mot_cle_id`, poser `url`), le plan est vide ; `notion:<id>` écartée : sautée et listée ; aucune opération du lot ne porte `resume`, `corps_md` ni `cle`.
- [ ] **Step 2 : les tests de l'action qui échouent** (`serveur-edition-ancrage-notions.test.mjs`, sur le modèle exact de `serveur-edition-ancrage.test.mjs:22-81` : base d'essai en fichier, un seul enchaînement `preparerLAncrage(base, { par: 'cle_de_depot', dossier, controle: { ouvertHorsEdition: true }, enArrierePlan: false })`, copié pour chaque test) : la base d'essai ajoute deux mots-clés sans élément (l'un avec définition et synonyme, l'autre sans définition), un mot-clé sans élément avec adresse, un type de sort dont le mot-clé n'a pas de page ; après l'enchaînement, le dernier lot appliqué est celui des notions, chaque page attendue existe, `resultat.a_trancher` cite le mot-clé à adresse, `controlerLeContenu` n'a rien de nouveau ; un second lancement ne dépose rien ; `annulerUneLigne` sur une page : `lignesAnnuleesDeLAncrage(db)` contient `notion:<id>` et pas `nom:<id>`, le lancement suivant ne la refait pas et la liste dans `ecartees`, `{ reprendre: true }` la redépose ; sans clé de dépôt (`par` absent) : une proposition, rien d'écrit ; `messageDeLAncrage` dit la ligne écartée sans son code. **R268 (Review Focus 6)** : après l'enchaînement, le mot-clé sans définition a `definitionDuMotCle(m) === null` (lu par `motsClesDeLaBase(db)`) et le rendu de sa balise ne porte pas de bulle (chercher la fonction de rendu par `Grep "sansBulle" client/src/lib/mots-cles-balises.mjs`) ; le test cite R268.
- [ ] **Step 3 :** lancer les deux fichiers. Attendu : échecs.
- [ ] **Step 4 :** implémenter. Mettre à jour l'en-tête de `mots-cles-ancrage.mjs` (un cinquième lot) et le JSDoc de `planDeLAncrage`.
- [ ] **Step 5 :** adapter `mots-cles-ancrage.test.mjs` (les tests qui comptent les lots ou attendent un plan vide : `:269`, `:301`, `:315` ; leurs bases n'ont pas de mot-clé sans élément, sauf celles qui en posent : vérifier chacune) et `lots-rendu.test.mjs` (`phraseDeLEcartee`). Lancer les deux fichiers nouveaux, `mots-cles-ancrage`, `lots-rendu`, `serveur-edition-ancrage`, `serveur-edition-ancrage-categories`, `serveur-edition-lots-ancrage`. Attendu : verts. Noter la durée des fichiers nouveaux.

**Critères de fin :** tests verts ; aucun bouton nouveau ; le plan ne lit ni `TYPE_UNIQUE` ni un numéro de mot-clé écrit en dur pour cette famille.

### Task 5: Note de version et page Mise à jour

**Agent :** sonnet, effort élevé. Taille : petite. Skills : `zone-mise-a-jour`, `zone-mise-a-jour-lots`, `tests-conventions`.

**Files:**
- Modify: `client/src/lib/notes-de-version.mjs:44-49` (`placeDeLaPage`), `:232-243` (la page du guide), `:462-467` (le mot-clé), `:586-608` (le contexte `x`), `:820-856` (la ligne condensée), `:1152`
- Create: `client/test/notes-de-version-notions.test.mjs`
- Test: `client/test/notes-de-version-ancrage.test.mjs`

**Constat :** sans rien faire, la mise en place donnerait 156 lignes « Page du guide ajoutée » rangées sous « Pages retirées » (`placeDansLeGuide` rend une rubrique nulle, :48) et 156 lignes « Lien » de mot-clé. Sur la page Mise à jour, le lot des notions est déjà replié : c'est un lot d'ancrage (`lib/lots-d-ancrage.mjs#estUnLotDAncrage`).

**Interfaces:**
- Consumes : tâche 1 (`placeDansLeGuide(id, { notion })`, `estHorsDuPlan`).
- Produces : dans le contexte `x`, `pageDeNotionAjoutee(motCleId): boolean` (une page de dev absente de la production, hors plan, dont `mot_cle_id` vaut ce mot-clé, lequel existait en production). La page du guide gagne `suit: (r, x) => …` vrai pour une telle page. Le mot-clé gagne dans `dejaDit` : `colonne === 'url' && x.pageDeNotionAjoutee(r.id)`. Une ligne condensée de plus, domaine `mots-cles`, neutre, sur le modèle de `comparerLesMotsClesAncres` : le nombre de pages de notion ajoutées à des mots-clés qui existaient (« 156 pages de notion ajoutées », singulier accordé, nombre écrit par `nombreEnFrancais`).
- `placeDeLaPage(id, { vivante })` : une page présente dans la base de dev et hors plan se range sous la rubrique du Glossaire (`placeDansLeGuide(id, { notion: true })`) ; une page absente de dev reste sous « Pages retirées ».

- [ ] **Step 1 : le test qui échoue** (`notes-de-version-notions.test.mjs`, bases synthétiques comme `notes-de-version-ancrage.test.mjs`, noms inventés ; les assertions portent sur le nombre de lignes, leur domaine, leur nature et le nombre qu'elles disent, pas sur une phrase entière) : trois pages de notion posées sur trois mots-clés existants donnent une seule ligne, qui dit 3 ; aucune ligne par page, aucune ligne « Lien » par mot-clé ; une notion nouvelle (mot-clé et page absents de la production) donne la ligne de sa page, rangée sous le Glossaire, et aucune ligne de mot-clé ; une page d'onglet supprimée en dev reste sous « Pages retirées » ; une page de notion renommée ensuite donne la ligne de son renommage ; la définition d'un mot-clé de notion corrigée par un lot garde sa ligne (R309 (17)).
- [ ] **Step 2 :** lancer. Attendu : échec.
- [ ] **Step 3 :** implémenter ; commenter comme les voisins (:457-461, :832-838).
- [ ] **Step 4 :** lancer le fichier nouveau, `notes-de-version-ancrage`, `notes-de-version`, `serveur-notes-de-version`. Attendu : verts.

**Critères de fin :** une ligne pour la famille ; les lignes des autres familles d'ancrage inchangées.

### Task 6: Le Glossaire : « Nouveau mot-clé » crée la notion et sa page

**Agent :** opus, effort élevé. Taille : moyenne. Skills : `zone-glossaire`, `zone-mots-cles-service`, `zone-edition`, `zone-api-rest`, `site-version-portable`, `tests-conventions`.

**Files:**
- Modify: `client/serveur/edition.mjs:3843-3868` (`enregistrer` : option `voie`), `:1882-1887` (outils donnés à `domainesDeLaChronologie`)
- Modify: `client/serveur/edition-chronologie.mjs:416-432` (`MOT_CLE.creer`), `client/serveur/api.mjs:654`, `client/serveur/ressources.mjs:854`
- Modify: `client/src/scripts/edition/mots-cles.mjs:581-625`, `client/src/lib/mots-cles-edition.mjs:324`, `docs/api.md:373-381`
- Create: `client/test/serveur-edition-notions-glossaire.test.mjs`
- Test: `client/test/serveur-api-v1.test.mjs`, le test de `lib/mots-cles-edition.mjs` (`Grep "typeParDefaut" client/test`)

**Variante retenue (à signaler) :** la conception dit « la création d'un mot-clé nu par le site est refusée ». Refuser dans `enregistrer` casserait environ 120 créations de fixtures dans 26 fichiers de test, qui l'appellent directement. La règle est donc portée par la voie : `enregistrer(db, corps, { voie: 'route' })`, donné par les deux seules routes (`api.mjs:654`, `ressources.mjs:854`). Par une route, créer un mot-clé (`op: 'creer'`, `entite: 'mot_cle'`) crée la notion **et** sa page, ou est refusé en entier (409) : jamais de mot-clé nu. Sans `voie` (tests, rejeu) et par un lot (`voie: 'lot'`), la création reste celle d'aujourd'hui.

**Interfaces:**
- Consumes : tâche 3 (`NOTIONS.creerLaNotion`, donné à `domainesDeLaChronologie` par une fonction qui le lit à l'appel, comme `recalculerLesCles`, `edition.mjs:1885`, car `NOTIONS` est défini après).
- Produces : `enregistrer(db, corps, { …, voie })` pose `ctx.voie` (`'route'` ou absent ; `sousLeVerrou`, `edition-ancrage.mjs:38`, ne change pas). `MOT_CLE.creer`, quand `ctx.voie === 'route'` : `url` donnée → 409 (« l'adresse d'un mot-clé vient de sa page ») ; plus d'une catégorie → le refus actuel ; aucune catégorie → celle de « Notion » (`lib/mots-cles-ancrage.mjs#categorieDuType(db, 'Notion')`), 409 si elle n'existe pas ; puis `creerLaNotion`. Rend `{ id, resume }` comme aujourd'hui. `lib/mots-cles-edition.mjs` : `CHAMPS_D_UNE_NOTION = Object.freeze(['libelle', 'categories', 'description'])`.

- [ ] **Step 1 : le test qui échoue** (`serveur-edition-notions-glossaire.test.mjs`, base de `test/aide-ancrage.mjs` en fichier, catégories nouvelles posées) : par `enregistrer(db, { operations: [{ op: 'creer', entite: 'mot_cle', valeurs }] }, { voie: 'route' })` : un seul lot du journal porte le mot-clé, sa catégorie, la page de notion et l'ancre (R309 (7), (9)) ; sans catégorie donnée, le type est « Notion » ; avec une définition, elle est sur le mot-clé et la page n'a pas de résumé ; `url` donnée : 409, rien d'écrit ; nom qui est le titre d'une page : 409, ni mot-clé ni page ; catégorie « Notion » absente et aucune donnée : 409 ; le mot-clé créé est verrouillé (modifier son libellé par la même voie : 409) ; **Review Focus 5** : sans `voie`, la même opération crée un mot-clé nu, sans page ; par un lot déposé (`deposerEtAppliquer`, insertion d'un `mot_cle`), le mot-clé est nu aussi ; `CHAMPS_D_UNE_NOTION` ne contient que des champs de `ENTITES.mot_cle.champs`.
- [ ] **Step 2 :** lancer. Attendu : échec.
- [ ] **Step 3 :** implémenter le service et les deux routes. Vérifier par `Grep "enregistrer(" client/serveur` qu'aucune autre route n'appelle `enregistrer`.
- [ ] **Step 4 : la page.** `champsDeCreation()` (:582) ne garde que `CHAMPS_D_UNE_NOTION` (nom, type en cases exclusives avec « Notion » présélectionné, définition). Le texte d'aide (:611) dit que le mot-clé est créé avec sa page et ne se modifie ensuite plus au Glossaire. Après la création (:616-622), relire le vocabulaire (`relire(ed)`) et redessiner la ligne comme celle d'un mot-clé ancré, avec son lien « Ouvrir » (`ligneDeGestion`, :338-420, lit `m.element`) : ne plus la fabriquer par `ajouter` avec des champs modifiables. Le message annonce la page créée.
- [ ] **Step 5 :** `serveur-api-v1.test.mjs` : `POST /api/v1/mots-cles/` passe par la route ; adapter ses quatre cas (le mot-clé créé a sa page ; ce qu'un test modifiait ensuite sur lui se fait sur un mot-clé posé en SQL). Chercher les autres tests qui créent un mot-clé par HTTP (`Grep "traiter(" client/test` croisé avec `mot_cle`). `docs/api.md:373-381` : la création crée la notion et sa page, `url` refusée. Si un test épingle la description OpenAPI de `mots-cles/` (`Grep "mots-cles" client/serveur/openapi.mjs`), la faire suivre.
- [ ] **Step 6 :** lancer le fichier nouveau, `serveur-api-v1`, `edition-mots-cles`, `serveur-edition-chronologie`, `serveur-edition-mots-cles-cles`, `serveur-edition-ancrage-verrou`, `glossaire-html` (seulement si `client/dist` existe déjà : ne pas construire), et le test des imports des scripts de page (`Grep "n'importent jamais le même module" client/test`). Attendu : verts.

**Critères de fin :** tests verts ; aucun des 26 fichiers qui créent un mot-clé par `enregistrer` n'a dû changer, hors ceux qui passent par HTTP.

### Task 7: Effets de bord et documentation

**Agent :** sonnet, effort élevé. Taille : moyenne. Skills : `site-version-portable`, `zone-edition`, `zone-edition-menus`, `zone-guide`, `zone-recherche`.

**Files:**
- Create: `client/src/lib/page-de-notion-rendu.mjs`
- Modify: `client/src/scripts/edition/nouvelles.mjs:138-166,190-204`, `client/src/scripts/edition/guide.mjs:112-127,169`, `client/src/scripts/edition/menus.mjs:240-311,343`
- Modify: `docs/serveur.md` (« Édition des règles (site de dev) », :441 ; « Lots de changements (format) », :862), `docs/content-guide.md` (:1333, :1524, :1663), `docs/chantier-ancrage-mots-cles.md:272-281`
- Create: `docs/superpowers/plans/2026-11-27-mots-cles-pages-de-notion-skills.md`, `client/test/pages-de-notion-site-de-dev.test.mjs`

**Interfaces:**
- Consumes : tâche 1 (`data-ed-notion`, `GLOSSAIRE`), tâche 3 (suppression d'une page de notion, résumé facultatif).
- Produces : une fonction pure `htmlDeLaPageDeNotion({ id, titre, base }): string` dans un module neuf, `client/src/lib/page-de-notion-rendu.mjs` (sans dépendance navigateur ; importé par `nouvelles.mjs` seulement, qui ne s'importe pas en test à cause de ses feuilles `?raw`) : le gabarit de `PageDuGuide.astro` sans menu latéral, fil « Accueil › Glossaire », titre modifiable (`data-ed`), le bandeau « Page créée sur le site de dev… » de `nouvelles.mjs:160`, et à la place du texte une ligne d'interface qui dit que le contenu de la page est calculé à la fabrication du site.

- [ ] **Step 1 : le test qui échoue** (`pages-de-notion-site-de-dev.test.mjs`) : `htmlDeLaPageDeNotion` échappe le titre, mène au Glossaire, ne pose aucun `data-ed-menu` et aucun menu latéral, porte `data-ed-corps` et `data-ed-notion` ; `sansMarqueurs(CORPS_D_UNE_PAGE_DE_NOTION).trim()` est vide (le corps d'une page de notion ne donne aucun texte à l'index de recherche, `lib/recherche-index.ts:83`).
- [ ] **Step 2 : la page 404 du site de dev.** `dessinerPage` (:195-204) : quand la page `guide/<slug>` existe dans les lignes et que le plan vivant ne la range pas (`pageDesRegles` rend `null`), dessiner `htmlDeLaPageDeNotion` au lieu de laisser la 404. Une page d'onglet créée ne change pas.
- [ ] **Step 3 : le mode modification d'une page de notion** (`[data-ed-notion]`). `guide.mjs#poserLeResume` : le libellé dit que le résumé est facultatif et le champ accepte le vide. `menus.mjs` : l'extension est active aussi sur `[data-ed-notion]` (:343) ; son bloc sous le titre (:286-311) n'y montre pas la liste « Onglet », seulement « Supprimer la page » ; à l'enregistrement, l'opération `{ op: 'supprimer', entite: 'page_des_regles', cle: { id } }` part comme pour une page d'onglet, un refus s'affiche par `refusEnListe` (:314), et après une suppression réussie la page mène au Glossaire. La conception ne dit pas où se trouve ce geste : c'est le choix le plus proche de l'existant, à signaler.
- [ ] **Step 4 : ce qui énumère les pages du guide.** Vérifier par `Grep "placeDansLeGuide\|menuLateralDe\|ongletDe(" client/src client/serveur client/scripts` qu'aucun lecteur ne suppose une page rangée (attendu : rien de plus que les tâches 1 et 5). Vérifier `lib/recherche-index.ts:82-89` (un résumé absent et un corps vide ne cassent rien), `pages/pages.astro`, `components/guide/Sommaire.astro`. Corriger seulement ce qui casse ; lister le reste dans le rapport.
- [ ] **Step 5 : documentation**, par `Grep` puis `Read` avec `offset` (fichiers de plus de 60 Ko). `docs/serveur.md` : la page de notion (ce qu'elle est, sa création par le service et par un lot, sa suppression, le groupe d'annulation, la voie `route`), la forme d'opération dans « Lots de changements (format) », la cinquième famille de « Préparer l'ancrage ». `docs/content-guide.md` : une page des Règles peut vivre hors menu (:1333), le bloc `notion` dans la liste des blocs (:1524), « Nouveau mot-clé » crée la page (:1663). `docs/chantier-ancrage-mots-cles.md:272-281` : la section « Chantier 3 » commence par « **Conçu le 2026-11-27 : `docs/chantier-pages-de-notion.md`.** Ce qui suit est l'état d'avant cette conception. », comme celle du chantier 2 (:261).
- [ ] **Step 6 : la demande à `tech-skills`** (`…-pages-de-notion-skills.md`, sur le modèle de `2026-11-27-mots-cles-adresses-skills.md`) : sans modifier aucun skill, lister ceux à mettre à jour avec la phrase à corriger et son remplacement : `zone-guide` (page hors menu, bloc `notion`), `zone-mots-cles-service` (notion, voie `route`), `zone-edition-lots` (forme d'opération, groupe), `zone-glossaire` (création), `zone-edition-menus` (suppression d'une page hors menu), `zone-mise-a-jour-lots` (cinquième famille).
- [ ] **Step 7 :** lancer le fichier nouveau, le test des imports des scripts de page, et les tests qui lisent les docs (`Grep "docs/serveur.md\|docs/content-guide.md" client/test`). Attendu : verts.

**Critères de fin :** tests verts ; aucun skill modifié ; aucune règle de jeu écrite dans les docs.

### Task 8: Contrôle final

**Agent :** la session principale, avec un agent de test (sonnet) pour les passages longs et un relecteur (opus) pour la branche entière. Skills : `choisir-les-tests`, `controles-avant-rendu`, `revue-de-diff`, `publier-une-branche`.

Toutes les commandes depuis `client/`, par `node ../tools/sobre.mjs <commande>` (bilan d'une ligne, détail dans `var/journaux/`).

- [ ] **Step 1 : copie du dépôt.** `npm run test:cible`, `npm run db:check`, `npm run db:pages-check`, `npm run db:controler-migrations -- --base origin/dev` (attendu : aucune migration nouvelle), `npm run db:doc -- --check`, `npm run build`. Attendu : verts, hors `installateur-essai-de-structure` et `instructions-claude`, comparés à la suite de référence obtenue sur `origin/dev`. `git status` : rien sous `data/rows/`, `data/paquet.json`, `.claude/skills/`.
- [ ] **Step 2 : base ancrée avec ses pages de notion.** Dans un dossier temporaire hors du dépôt : une copie en fichier de la base du dépôt ouverte par `serveur/base-vivante.mjs#ouvrirBaseVivante`, puis `preparerLAncrage(base, { par: 'cle_de_depot', dossier, controle: { ouvertHorsEdition: true }, enArrierePlan: false })` relancé jusqu'à `suite === false` (les appels : `client/test/serveur-edition-ancrage.test.mjs:57-66`), puis `serveur/extrait.mjs#fabriquerExtrait({ source, destination })` (:91). Relever : `comptes.notions` (attendu : 156 moins les « à trancher », §« Les mots-clés concernés »), la liste `a_trancher` (à remettre au propriétaire : les 24, « Localisation des dégâts », tout nom déjà pris), la durée du lot des notions. Vérifier en SQL : aucune page de notion n'a de résumé ni de ligne dans `regles_onglet_entree` ; chaque mot-clé concerné a gardé `id`, `cle`, `description` ; Bête, Mécanique et Démon ont une page et aucune définition (R268).
- [ ] **Step 3 : les deux contenus.** `MAVERICK_CONTENU=<extrait>` devant `npm run test:cible`, `npm run db:check` et `npm run build` (`lib/contenu-fourni.mjs`). Attendu : les mêmes verts. Dans `dist/` : une page de notion à `/regles/<slug>/` sans menu latéral, son fil vers le Glossaire, son bloc (définition, sorts groupés pour un type de sort) ; la balise de ce mot-clé dans une autre page est un lien vers elle ; `regles/glossaire/index.html` porte « Ouvrir » sur sa ligne ; la page figure dans `search-index.json` ; le nombre de pages de `dist/` a monté du nombre de pages de notion. Puis `node ../tools/build-artifact.mjs` : la version portable se fabrique.
- [ ] **Step 4 :** durées des tests nouveaux additionnées (le job `preparer` de la CI a 45 min) ; relecture de la branche entière (skill `revue-de-diff`), corrections, tests en échec et ceux du diff relancés seuls.
- [ ] **Step 5 :** commits en français (un par tâche), `git fetch --prune origin`, rebase sur `origin/dev` si elle a bougé, branche renommée `feature/mots-cles-pages-de-notion` avant le premier push, PR vers `dev` en français, fusion automatique par merge commit et auto-fix activés. Jamais vers `master`. Après la fusion, la mise en place se lance sur le site de dev par « Préparer l'ancrage ».

# Ancrage des mots-clés (chantier 1) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque page, sort et type de sort a son mot-clé, qui suit seul son élément et ne se modifie plus à la main ; le Glossaire et la Recherche montrent tout le registre, paginé.

**Architecture :** une migration de structure ajoute `mot_cle_id` à `page` et `sort` et crée `type_sort`. Un module pur (`lib/mots-cles-ancrage.mjs`) calcule ce qui manque, une action du service le dépose en quatre lots `maverick-lot/1` (R291, R306), et `serveur/edition-ancrage.mjs` tient la règle à chaque création, renommage et suppression. Jusqu'au chantier 4, `mot_cle.libelle` et `url` d'un mot-clé ancré restent des copies écrites par ce seul module : les lecteurs existants ne changent pas.

**Tech Stack :** Node ≥ 22.12 (`node:sqlite`, `node:test`), SQLite STRICT, Astro 7 statique, Python 3 pour la jumelle de la règle de clé. Aucune dépendance nouvelle.

**Spec :** [`docs/chantier-ancrage-mots-cles.md`](../../chantier-ancrage-mots-cles.md), validée par le propriétaire le 2026-11-22. Les renvois « §n » visent ce document.

## Global Constraints

- Travail uniquement dans `C:\Git\MaverickCenter\.claude\worktrees\mots-cles-ancrage`, branche `feature/mots-cles-ancrage`. Ne jamais toucher à `C:\Git\MaverickCenter`. Commandes npm depuis `client/`.
- Migration **0131**, `user_version` 131, structure seule. Le contenu n'entre que par des lots. Si R309 ou 0131 est pris au rebase, prendre le numéro libre suivant partout.
- Lots de l'ancrage : `format: 'maverick-lot/1'`, `nature: 'decision'`, `decision: 'R309'`, `auteur: 'préparer l’ancrage'`.
- Catégories créées, écrites exactement : `Notion`, `Guide`, `Ressource`, `Type de sort`.
- Type par rubrique : `capacites` Don, `classes` Classe, `races` Race, `metiers` Métier, `bestiaire` Bestiaire, `guide` Guide, `ressources` Ressource. Sort : `Sort`. Type de sort : `Type de sort`.
- Mots-clés créés : jamais verrouillés (R219 (5)), aucune définition écrite, aucun balisage automatique des textes.
- Un refus du verrou ne cite **aucun** numéro `R<n>` (`edition-lots.mjs:260` : un refus qui en cite un devient ouvrable au mot de passe) et ne se lève pas par `gel: false` sur un lot.
- Ni le nom, ni l'adresse, ni la clé d'un mot-clé ancré ne s'écrivent par un lot, mot de passe compris. Type, couleur, icône, synonymes et définition restent corrigeables par lot (décision 17).
- Pagination : **50** lignes au Glossaire, **100** pastilles à la Recherche, paramètre `?page=`, sans JavaScript tout s'affiche.
- Scripts de page : `scripts/glossaire.mjs` n'importe que `lib/glossaire-filtre.mjs` ; `scripts/recherche.mjs` n'importe que `lib/recherche-mots-cles.mjs` et `lib/search.mjs` ; aucun n'importe `mots-cles-balises.mjs`.
- Ne pas modifier : `api/`, la version de `client/package.json`, `data/paquet.json`, `.claude/skills/**` (réservé à `tech-skills`, tâche 14), `data/rows/` hors `page`, `sort`, `type_sort` exportées par la migration.
- Tests : pas de texte ni de valeur modifiable figés (lire par id ou créer ses données, noms inventés) ; chaque test se lance seul à l'écriture, `npm run test:cible` une fois par tâche. Une décision appliquée est épinglée par un test qui cite R309.
- Commits en français, un par tâche au moins, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Jamais `--no-verify`.

## Review Focus

1. **Renommer une magie** dont deux sorts portent le même nom qu'ailleurs : le parent change, donc la clé des sorts homonymes doit suivre, sinon `db:check` refuse la base. Test : tâche 7.
2. **Une ancre n'est pas une mention** : une page ancrée ne doit apparaître ni dans la colonne Pages du Glossaire de son propre mot-clé, ni comme « texte à retoucher » à sa suppression (R196). Test : tâche 7.
3. **Un renommage annulé ne revient pas** au lot suivant qui touche la même page sans changer son titre. Test : tâche 7.
4. **Rejeu d'un lot qui supprime une page avec son mot-clé** : aucun faux conflit (`liensRompusParLeLot`, `motsClesEncoreMentionnes`). Test : tâche 7.
5. **Durée du lot des 690 capacités** : chaque création relit le vocabulaire et les adresses. Mesurée à la tâche 6, moins de 30 s par lot, sinon mémoriser `adressesDuSite` sur `ctx`.

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `data/migrations/0131-ancrage-mots-cles.sql` (créé) | `page.mot_cle_id`, `sort.mot_cle_id`, `type_sort`, trois index uniques partiels |
| `client/src/lib/mots-cles-ancrage.mjs` (créé) | Pur : données du §2-§3, élément d'un mot-clé, `estAncre`, `planDeLAncrage` |
| `client/serveur/edition-ancrage.mjs` (créé) | Service : créer, aligner, suivre, retirer, verrou. Seul à écrire `libelle` et `url` d'un ancré |
| `client/serveur/edition-ancrage-lots.mjs` (créé) | Action « Préparer l'ancrage » : dépose les quatre lots, lignes annulées, reprise |
| `client/test/aide-ancrage.mjs` (créé) | Base d'essai et données inventées, partagées par les tests de l'ancrage |
| `client/src/lib/lot-de-changements.mjs`, `serveur/edition-lots.mjs` | Format : clé `ancrage`, création de catégorie, recalcul différé |
| `client/serveur/edition.mjs`, `edition-chronologie.mjs`, `edition-mots-cles.mjs`, `edition-journal.mjs`, `edition-plan.mjs` | Branchements : création, suivi, suppression, verrou |
| `client/src/lib/mots-cles-cles.mjs`, `tools/db/maverick.py` | Règle de clé avec parent (jumelles) |
| `client/src/lib/mots-cles-db.mjs`, `mots-cles-balises.mjs`, `mentions-des-mots-cles.mjs` | Élément du mot-clé, texte montré, ancres hors des mentions |
| `client/src/lib/glossaire-filtre.mjs`, `recherche-mots-cles.mjs`, leurs scripts et pages | Pagination, lecture seule, vue de l'élément |
| `client/src/lib/notes-de-version.mjs`, `lots-rendu.mjs`, `scripts/mise-a-jour.mjs` | Note condensée, lots repliés, bouton |
| `client/src/lib/autolink.mjs`, `tools/db/homonymes.py` | Effets de bord du §11 |

---

### Task 1: Finir la conception et consigner R309

**Files:**
- Modify: `docs/chantier-ancrage-mots-cles.md:3,100,151-155,231`
- Modify: `docs/decisions-regles.md` (ligne après R308, `:316`), `docs/decisions-index.md` (généré)

- [ ] **Step 1 : Installer les dépendances.** Depuis `client/` : `npm ci`. Attendu : code 0.
- [ ] **Step 2 : Mettre la conception à jour.** Ligne 3 : `État : conception validée par le propriétaire le 2026-11-22. Décision : R309. Branche : feature/mots-cles-ancrage.` Retirer « (à valider) » du titre du §3 et « , à vérifier » du titre « Choix de l'équipe », en ajoutant sous ce titre « Validés avec la conception le 2026-11-22. ». Au §5 : une création d'élément est **une** opération de lot, donc environ 400, 428, 204 et 690 opérations ; les quatre lots ne sont plus imposés par le plafond de 2 000 mais groupent par famille (relecture, annulation, arrêt au premier refus).
- [ ] **Step 3 : Ajouter la ligne R309** au tableau (`Réf. | Question | Décision | Citation | Conséquence`), d'après les décisions 1 à 18 et le paragraphe « R309 consignera » de la conception, citations du propriétaire telles quelles.
- [ ] **Step 4 : Régénérer l'index.** `npm run decisions:index`. Attendu : `docs/decisions-index.md` contient R309.
- [ ] **Step 5 : Commit.**

```bash
git add docs/chantier-ancrage-mots-cles.md docs/decisions-regles.md docs/decisions-index.md docs/superpowers/plans/2026-11-22-mots-cles-ancrage.md
git commit -m "Mots-clés : conception de l'ancrage et décision R309"
```

### Task 2: Migration 0131

**Files:**
- Create: `data/migrations/0131-ancrage-mots-cles.sql`, `client/test/db-0131-ancrage-mots-cles.test.mjs`
- Modify: `data/schema.sql:26` (version), tables `page`, `sort` (colonne **en dernier**), `type_sort` après `sort_type:921`
- Modify: `client/src/lib/tables-de-la-base.mjs` (`TABLES_DE_REGLES`), `client/src/lib/ressources/magie.mjs:352` (`HORS_RESSOURCE`), `client/src/lib/libelles-de-la-base.mjs` (`type_sort: 'Type de sort'`)
- Regenerate: `data/pages-d-exemple.sql`, `docs/sql/structure.md`, `docs/sql/apercu.md`, `data/rows/{page,sort,type_sort}.sql`

**Interfaces — Produces :** colonnes `page.mot_cle_id`, `sort.mot_cle_id` ; table `type_sort(id TEXT PK, mot_cle_id)` ; index `page_ancre_mot_cle`, `sort_ancre_mot_cle`, `type_sort_ancre_mot_cle` (`sort_mot_cle` est déjà une table).

- [ ] **Step 1 : Écrire le test.**

```js
test('0131 : page et sort citent mot_cle, sans cascade, NULL permis', () => {
  for (const t of ['page', 'sort']) {
    const fk = db.prepare(`PRAGMA foreign_key_list(${t})`).all().find((f) => f.from === 'mot_cle_id');
    assert.equal(fk.table, 'mot_cle'); assert.equal(fk.on_delete, 'NO ACTION');
    assert.equal(db.prepare(`SELECT "notnull" n FROM pragma_table_info('${t}') WHERE name = 'mot_cle_id'`).get().n, 0);
  }
});
test('0131 : type_sort porte exactement les codes du CHECK de sort_type, sans mot-clé', () => {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'sort_type'").get().sql;
  const codes = [...sql.match(/type\s+TEXT[^,]*CHECK \(type IN \(([^)]*)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(db.prepare('SELECT id FROM type_sort ORDER BY id').all().map((r) => r.id), codes);
  assert.equal(db.prepare('SELECT count(*) n FROM type_sort WHERE mot_cle_id IS NOT NULL').get().n, 0);
});
test('0131 : un mot-clé ancre au plus une page, un sort, un type ; une page ET un type sont permis (R309, Météo)', () => {
  // deux pages sur le même mot-clé : UNIQUE refusé ; une page et un type sur le même : accepté ; deux pages à NULL : accepté
});
```

- [ ] **Step 2 : Lancer.** `node --test test/db-0131-ancrage-mots-cles.test.mjs`. Attendu : FAIL (`no such table: type_sort`).
- [ ] **Step 3 : Écrire le schéma, puis la migration** (mêmes instructions) :

```sql
ALTER TABLE page ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);
CREATE UNIQUE INDEX page_ancre_mot_cle ON page (mot_cle_id) WHERE mot_cle_id IS NOT NULL;
ALTER TABLE sort ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);
CREATE UNIQUE INDEX sort_ancre_mot_cle ON sort (mot_cle_id) WHERE mot_cle_id IS NOT NULL;
CREATE TABLE type_sort (
  id TEXT PRIMARY KEY CHECK (id IN ('attaque','entrave','soin','amplification','placement','invocation','construction','protection','meteo','aleatoire')),
  mot_cle_id INTEGER REFERENCES mot_cle(id)
) STRICT, WITHOUT ROWID;
CREATE UNIQUE INDEX type_sort_ancre_mot_cle ON type_sort (mot_cle_id) WHERE mot_cle_id IS NOT NULL;
INSERT INTO type_sort (id) VALUES ('attaque'),('entrave'),('soin'),('amplification'),('placement'),('invocation'),('construction'),('protection'),('meteo'),('aleatoire');
```

- [ ] **Step 4 : Appliquer et régénérer.** `npm run db:migrate -- ../data/migrations/0131-ancrage-mots-cles.sql`, `node scripts/db-pages-d-exemple.mjs`, `npm run db:doc`. Ne garder dans `data/rows/` que `page.sql`, `sort.sql`, `type_sort.sql`, `VERSION`.
- [ ] **Step 5 : Classer la table** dans les trois registres listés, avec une raison dans `HORS_RESSOURCE`.
- [ ] **Step 6 : Vérifier.** `node --test test/db-0131-ancrage-mots-cles.test.mjs test/db-schema.test.mjs test/tables-de-la-base.test.mjs test/libelles-de-la-base.test.mjs`, `npm run db:check`, `npm run db:controler-migrations -- --base origin/dev`. Attendu : PASS, aucun problème.
- [ ] **Step 7 : Commit** (`Mots-clés : migration 0131, ancres de page, de sort et de type`).

### Task 3: La règle de clé connaît le parent

**Files:**
- Modify: `client/src/lib/mots-cles-cles.mjs:35`, `tools/db/maverick.py:67`, `client/src/lib/mots-cles-db.mjs:43`
- Test: `client/test/mots-cles-cles.test.mjs` (cas communs JS et Python)

**Interfaces — Produces :**
- `clesDesMotsCles(motsCles, categories, { strict })` : chaque mot-clé peut porter `parent: string | null`.
- `cles_des_mots_cles(mots_cles, categories, strict=True, parents=None)` : `parents` = `{id: libellé}`.
- `motsClesDeLaBase(db)` : chaque mot-clé porte `parent`, le nom de la magie de son sort ancré, sinon `null`. Tolère une base sans `sort.mot_cle_id`.

- [ ] **Step 1 : Ajouter les cas** (catégories `{ 10: 'Métier', 16: 'Sort' }`) :

```js
{ nom: 'même type : le parent distingue (R309)', mots: [{ id: 1, libelle: 'Contre-sort', categories: [16], parent: 'Arcane' }, { id: 2, libelle: 'Contre-sort', categories: [16], parent: 'Corruption' }], cles: { 1: 'contre-sort-arcane', 2: 'contre-sort-corruption' } },
{ nom: 'types différents : le type suffit', mots: [{ id: 1, libelle: 'Sapeur', categories: [10] }, { id: 2, libelle: 'Sapeur', categories: [16], parent: 'Feu' }], cles: { 1: 'sapeur-metier', 2: 'sapeur-sort' } },
{ nom: 'même parent : clé prise', mots: [{ id: 1, libelle: 'X', categories: [16], parent: 'Feu' }, { id: 2, libelle: 'X', categories: [16], parent: 'Feu' }], faute: 'cle-prise' },
{ nom: 'sans parent : refus inchangé', mots: [{ id: 1, libelle: 'X', categories: [16] }, { id: 2, libelle: 'X', categories: [16] }], faute: 'incluses' },
```

- [ ] **Step 2 : Lancer.** `node --test test/mots-cles-cles.test.mjs`. Attendu : FAIL sur le premier cas.
- [ ] **Step 3 : Implémenter.** Un membre dont les catégories sont incluses dans celles d'un autre **et** qui a un parent prend `[base, ...propres, normalize(parent)]` ; sans parent, faute `incluses` ; deux clés égales, `cle-prise`. Même logique en Python.
- [ ] **Step 4 : Vérifier.** Même commande. Attendu : PASS. `npm run db:check` : aucun problème.
- [ ] **Step 5 : Commit** (`Mots-clés : le parent distingue deux homonymes de même type`).

### Task 4: Calculer ce que l'ancrage doit faire

**Files:**
- Create: `client/src/lib/mots-cles-ancrage.mjs`, `client/test/mots-cles-ancrage.test.mjs`, `client/test/aide-ancrage.mjs`
- Modify: `client/src/lib/adresses-db.mjs` (`adresseDuSort`), `client/src/lib/mots-cles-db.mjs` (`elementsDesMotsCles`, ici pour éviter un import circulaire), `client/src/lib/mentions-des-mots-cles.mjs:25,90`

**Interfaces — Consumes :** `clesDesMotsCles`, `motsClesDeLaBase`, `categoriesDesMotsCles`, `adresseDeLaPage`, `synonymesPris`.

**Interfaces — Produces :**

```ts
// lib/adresses-db.mjs
adresseDuSort(sortId: string): string                       // `${adresseDeLaPage(magieId)}#sort-${slug}`, slug = ce qui suit `#sort:`
// lib/mots-cles-db.mjs : les éléments dans cet ordre : page, sort, type_sort, magie, type_degats, monnaie ; texte : page.resume, sort.effets, sinon null
elementsDesMotsCles(db): Map<number, Element[]>             // Element = { table, id, nom, adresse, texte }
// lib/mentions-des-mots-cles.mjs : page, sort et type_sort rejoignent REFERENCES_AUX_MOTS_CLES ; mentionsDesMotsCles ne les rend PAS comme mentions
// lib/mots-cles-ancrage.mjs
CATEGORIES_NOUVELLES: readonly string[]; TYPE_DE_RUBRIQUE: Record<string, string>; TYPE_UNIQUE: Record<string, number[]>; REPRISES: Map<number, string>;
estAncre(db, id: number): boolean                           // referencesDesMotsCles non vide, ou monnaie_id posé
planDeLAncrage(db, { ecartees?: Set<string> }): {
  lots: Array<{ format, titre, nature, decision, auteur, famille: 'noms'|'sorts'|'pages'|'capacites', operations }>,  // lots vides absents
  a_trancher: Array<{ table, id, nom, raison }>, ecartees: string[],
  comptes: { crees, capacites, autres_pages, sorts, types, renommes, reclasses, ancres_existants }
}
// clés d'`ecartees` : `page:<id>`, `sort:<id>`, `type_sort:<id>`, `nom:<mot_cle_id>`, `type:<mot_cle_id>`
```

Données à recopier telles quelles (§3 et décision 3) :

```js
export const TYPE_UNIQUE = {
  Alignement: [10, 421, 422, 423, 424, 425, 426, 428, 429], Équipement: [21, 22, 39, 198, 301, 302, 331, 431, 432], Métier: [25, 240, 325],
  'Fiche de personnage': [37, 121, 122, 123, 125, 137, 139, 140, 141, 226, 318, 323, 362, 368, 369, 373], Classe: [43, 68, 260], Bestiaire: [48, 414],
  Notion: [51, 130, 245, 246, 289, 420, 430, 446], Magie: [60, 115, 222, 297, 356, 417, 418, 419],
  Faction: [63, 106, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348], Événement: [190], Guide: [201], Dégâts: [308, 365, 442, 443],
};
export const REPRISES = new Map([[31, 'guide/fiche-attributs'], [162, 'guide/initiative'], [56, 'guide/fiche-caracteristiques'], [420, 'guide/le-mode-hyper-100']]);
// le type de sort `meteo` reprend #239 ; `aleatoire` n'a aucun mot-clé tant qu'aucun sort ne l'utilise
```

**Algorithme à suivre :**
1. Pages : `SELECT id, type, titre, resume, mot_cle_id FROM page WHERE statut <> 'example'`. Mot-clé d'une page : la reprise, sinon celui dont `url` vaut exactement `adresseDeLaPage(id)`, **sans compter les mots-clés repris** (`guide/le-mode-hyper` revient ainsi à #245 quand #420 part vers sa page) ; plusieurs : « à trancher ». Une reprise disparue : « à trancher ».
2. Type d'un mot-clé existant : le sien s'il en a exactement un ; sinon `TYPE_UNIQUE` ; absent de la liste : « à trancher ».
3. Vocabulaire futur, éprouvé par `clesDesMotsCles` strict et par `synonymesPris` : un élément créé ou renommé que la règle refuse sort du plan et va « à trancher », puis on recommence.
4. Lot 1, dans cet ordre : `inserer categorie_mot_cle` (jetons `c1`…) ; pour chaque reclassé, `supprimer` puis `inserer` sur `mot_cle_categorie` ; ancres des pages déjà désignées et de `meteo` (`modifier` de `mot_cle_id`) ; `modifier` de `mot_cle` avec `ancrage: { aligner: true }` pour chaque **page** dont le nom ou l'adresse diffère du mot-clé. #239 garde son nom et son adresse.
5. Lots 2 (sorts et types), 3 (pages hors capacités), 4 (capacités) : un `inserer` de `mot_cle` par élément, `apres: { id: {$numero}, libelle, url }` (**sans `cle`**), `ancrage: { table, id, type }`.
6. Un élément déjà ancré n'est pas repris ; une clé de `ecartees` est sautée et listée.

- [ ] **Step 1 : Écrire `aide-ancrage.mjs` et les tests** (patron `serveur-edition-lots-mot-cle.test.mjs`, pages et sorts inventés) :

```js
test('une page sans mot-clé reçoit une création portant son type de rubrique (R309)');   // operation 'inserer', apres.libelle === titre, ancrage.type === id de Don
test('une page dont un mot-clé a l’adresse exacte est ancrée sans création');
test('une adresse de section (#) ne désigne pas la page');
test('deux mots-clés sur la même adresse : à trancher, rien pour cette page');
test('une reprise disparue : à trancher');
test('une reprise libère l’adresse qu’elle quitte : la page reste désignée par l’autre mot-clé');
test('un mot-clé à plusieurs catégories absent de TYPE_UNIQUE : à trancher');
test('une ancre n’est pas une mention (R196) ; une magie reste une référence mentionnée');
test('sort : adresse <magie>#sort-<slug>, type Sort ; deux sorts homonymes de magies différentes passent');
test('types : un par code utilisé, `meteo` reprend #239 sans changer son nom ni son adresse, `aleatoire` absent');
test('même nom et même type sans parent : à trancher, jamais une erreur');
test('ordre du lot 1 : catégories, reclassements, ancres, alignements');
test('chaque lot porte au plus 2 000 opérations ; aucun `cle` dans un apres de création');
test('rejouable : une fois appliqué, le plan est vide');
test('une clé écartée est sautée et listée');
```

- [ ] **Step 2 : Lancer.** `node --test test/mots-cles-ancrage.test.mjs`. Attendu : FAIL (module absent).
- [ ] **Step 3 : Implémenter** les signatures ci-dessus.
- [ ] **Step 4 : Vérifier.** Même commande : PASS. Sur `var/maverick.db` (`npm run db:build`), un script hors dépôt compare `comptes` à la conception : 1 322 créés (690, 204, 420, 8), 77 reclassés, 18 renommés, `a_trancher` vide. Un écart s'explique avant de continuer.
- [ ] **Step 5 : Commit** (`Mots-clés : calcul du plan d'ancrage`).

### Task 5: Le format de lot apprend l'ancrage

**Files:**
- Create: `client/serveur/edition-ancrage.mjs`, `client/test/serveur-edition-lots-ancrage.test.mjs`
- Modify: `client/src/lib/lot-de-changements.mjs:58,123`, `client/serveur/edition-lots.mjs:147,173,288,576`, `client/serveur/edition.mjs:245,3615,3672`

**Interfaces — Produces :**

```ts
// une opération de lot peut porter `ancrage` :
//   inserer mot_cle : { table: 'page'|'sort'|'type_sort', id, type: number }    modifier mot_cle : { aligner: true } (apres ⊆ {libelle, url})
creerMotCle(ctx, libelle, description, { ...existant, ancre?: { table, id }, parent?: string | null }): number   // l'ancre s'écrit AVANT recalculerLesCles
appliquerUnLot(db, { titre, nature, decision, travail, annulation = false })                                     // ctx.voie = 'lot', ctx.annulation
outilsDeLAncrage({ ErreurEdition, MOTS_CLES, creerMotCle }): {
  ancrerNouveau(ctx, { table, id, libelle, url, type }): number,
  ancrerElement(ctx, { table, id, mot_cle_id }): void,   // mot_cle_id null seulement en annulation
  alignerMotCle(ctx, id): void,                          // recopie nom et adresse depuis l'élément, n'accepte aucune valeur
}
// OPERATIONS_DU_LOT : ancrer_nouveau, ancrer_element, aligner_mot_cle, recalculer_les_cles
```

Traductions (`traduire`) : création ancrée vers `ancrer_nouveau` puis `verifier_ligne` sur `{ id, libelle, url }` ; alignement vers `aligner_mot_cle` puis `verifier_ligne` sur `apres` ; `modifier` d'un `mot_cle_id` de `page`, `sort`, `type_sort` vers `ancrer_element` ; `inserer categorie_mot_cle` vers `{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle } }` puis `verifier_ligne`.

Recalcul différé : si le lot touche `mot_cle_categorie`, `appliquerLeLot` et `annulerLeLot` jouent `recalculer_les_cles` **une fois**, après la dernière opération. Un refus lève `ErreurEdition` : l'essai rend `a_corriger`, l'application refuse le lot.

- [ ] **Step 1 : Écrire les tests.**

```js
test('format : `ancrage` refusé hors d’un inserer ou d’un alignement de mot_cle');
test('traduire : création ancrée, alignement, ancre, catégorie');
test('une opération crée le mot-clé, son type et son ancre : journal mot_cle, mot_cle_categorie, page');
test('le second homonyme de même type reçoit sa clé par le parent (ancre écrite avant le recalcul)');
test('une catégorie créée par le lot est citée par jeton dans la clé composée');
test('déplacer les catégories en plusieurs lignes passe par un seul recalcul, clés finales justes');
test('un recalcul refusé : essai a_corriger, application refusée, rien d’écrit');
test('aligner recopie l’élément : un `apres` différent de l’élément est refusé');
test('retirer une ancre par un lot est refusé, permis à l’annulation');
test('annuler le lot retire le mot-clé, son type et l’ancre, clés recalculées');
```

- [ ] **Step 2 : Lancer.** `node --test test/serveur-edition-lots-ancrage.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 : Implémenter**, sur le patron `outilsDesMotsCles` (`edition-mots-cles.mjs:137`), pour éviter un import circulaire.
- [ ] **Step 4 : Vérifier.** Ce test, puis `serveur-edition-lots-mot-cle`, `serveur-edition-lots-annulation`, `serveur-edition-lots-lignes`, `serveur-edition-mots-cles-cles`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Lots : créer un mot-clé ancré et recalculer ses clés en fin de lot`).

### Task 6: L'action « Préparer l'ancrage »

**Files:**
- Create: `client/serveur/edition-ancrage-lots.mjs`, `client/test/serveur-edition-ancrage.test.mjs`
- Modify: `client/serveur/api.mjs:64-67,416,450`, `client/serveur/acces-routes.mjs:59-61`, `client/src/lib/lots-rendu.mjs:389,441`, `client/src/scripts/mise-a-jour.mjs:346-351,500-505`
- Test: `client/test/serveur-acces-routes.test.mjs`

**Interfaces — Consumes :** `planDeLAncrage`, `deposer`, `deposerEtAppliquer`.

**Interfaces — Produces :**

```ts
lignesAnnuleesDeLAncrage(db): Set<string>   // lit les lots `decision = 'R309'`, `bilan.lignes_annulees` et, pour un lot annulé, toutes ses lignes
preparerLAncrage(base, { par?, reprendre?, enArrierePlan?, dossier?, ...options }): Promise<{
  lots: object[], arret: { titre, motif } | null, suite: boolean, a_trancher: object[], ecartees: string[], comptes: object
}>
// POST /api/edition/lots/ancrage/  corps { reprendre?: boolean }, classe d'accès `proposition`
messageDeLAncrage(resultat): string          // lots-rendu.mjs
```

Comportement : avec `par`, dépose et applique le lot suivant, **recalcule le plan**, enchaîne, s'arrête au premier refus. Sans `par`, dépose un seul lot en proposition et rend `suite: true`. `reprendre: true` passe `ecartees` vide.

- [ ] **Step 1 : Écrire les tests.**

```js
test('avec la clé de dépôt : les lots s’enchaînent, chaque élément est ancré, la base passe db:check (R291, R306)');
test('sans clé : un seul lot en proposition, le contenu n’a pas bougé, `suite` vrai');
test('un lot refusé n’écrit rien et arrête la suite, avec son motif');
test('rejouable : un second lancement ne dépose rien');
test('une ligne annulée reste écartée et listée');
test('un renommage annulé garde l’ancien nom, signalé comme écart');
test('« Reprendre » redépose les lignes annulées');
test('le refus d’une reprise par un lot forgé : aligner ne prend aucune valeur');
test('« à trancher » arrive dans le résultat');
```

Dans `serveur-acces-routes.test.mjs`, ajouter `POST /api/edition/lots/ancrage/` à la classe `proposition`.

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter** l'action sur le modèle de `recalculerTout` (`edition-lots.mjs:1083`), la route sur `traiterLeRecalcul` (`api.mjs:416`), et le bouton « Préparer l'ancrage » à côté de « Tout recalculer » (`data-nv-ancrage`).
- [ ] **Step 4 : Mesurer sur une copie réelle** (Review Focus 5). Script hors dépôt, dans le dossier temporaire de la session, qui copie `var/maverick.db` et joue l'action complète. Attendu : 4 lots appliqués, 1 322 créés, `a_trancher` vide, `db:check` sans problème, moins de 30 s par lot. Au-delà, mémoriser `adressesDuSite` sur `ctx` et remesurer.
- [ ] **Step 5 : Vérifier.** Les tests de cette tâche, `lots-rendu`, `lots-rendu-service`, `mise-a-jour-lots`. Attendu : PASS.
- [ ] **Step 6 : Commit** (`Mise à jour : action « Préparer l'ancrage » en quatre lots`).

### Task 7: Tout suit seul

**Files:**
- Modify: `client/serveur/edition-ancrage.mjs`, `client/serveur/edition-journal.mjs:201-207`, `client/serveur/edition.mjs:215,619,1628,1649,3672,3741`, `client/serveur/edition-plan.mjs:177-202`
- Test: `client/test/serveur-edition-ancrage-suivi.test.mjs`

**Interfaces — Produces :**

```ts
w.lignes[i].colonnes: string[] | null     // les colonnes changées d'un 'modifier'
outilsDeLAncrage(...) ajoute :
  ancrerLaPage(ctx, { id, type, titre }): number | null   // null : le nom attend, listé « à trancher » ; la page est créée quand même
  suivreLesElements(ctx): void                            // fin d'enregistrer et d'appliquerUnLot, avant w.terminer ; jamais en annulation ni au rejeu
  motCleARetirer(ctx, { table, id }): number | null       // refus 409 si une balise ou une étiquette le cite, avec la liste des textes
  retirerLeMotCle(ctx, id): void                          // après l'élément ; garde le mot-clé tenu par un autre élément (R289)
```

`suivreLesElements` ne regarde que **les lignes de ce lot** : `page.titre` et `sort.nom` changés (nom suivi, clés recalculées), `magie.nom` changé (clés recalculées, le parent a bougé). Un nom que la règle refuse laisse le mot-clé tel quel.

`supprimerPage` : `motCleARetirer` avant toute écriture, `retirerLeMotCle` après la page. `refuserSiUnMotCleYMene`, `refuserSiLesFichesSontCitees` et `edition-plan.mjs` ignorent le propre mot-clé de l'élément, sauf s'il est verrouillé (R221). Un `ecrire_supprimer` de `sort` suit la même règle.

- [ ] **Step 1 : Écrire les tests.**

```js
test('créer un métier crée son mot-clé, type Métier, ancre posée');
test('un métier homonyme d’une caractéristique : deux clés par type, balises réécrites');
test('même nom, même type : la page est créée, sans mot-clé');
test('renommer une page renomme le mot-clé, sa clé et ses balises, l’adresse ne bouge pas');
test('renommer un sort renomme son mot-clé');
test('renommer une magie recalcule la clé de ses sorts homonymes, db:check passe');           // Review Focus 1
test('une ancre n’est pas une mention : ni colonne Pages, ni texte à retoucher');              // Review Focus 2
test('un renommage annulé ne revient pas au lot suivant sur la même page');                    // Review Focus 3
test('rejeu d’un lot qui supprime une page et son mot-clé : aucun conflit');                   // Review Focus 4
test('supprimer une page non citée retire son mot-clé dans le même lot');
test('supprimer une page citée : 409 avec la liste des textes, rien d’écrit');
test('une page protégée (R221) reste insupprimable');
test('un mot-clé aussi tenu par un type de sort reste après la suppression de la page (R289)');
test('le forçage de R223 ne supprime jamais une page');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter**, en branchant `ancrerLaPage` dans `creerPage` après l'insertion.
- [ ] **Step 4 : Vérifier.** Ce test, `mentions-des-mots-cles`, `mots-cles-r223`, `serveur-edition-liens-rompus`, `serveur-edition-suppression-forcee`, `serveur-edition-mots-cles-references`, `suppressions-d11`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Mots-clés : le mot-clé suit la création, le renommage et la suppression`).

### Task 8: Le verrou

**Files:**
- Modify: `client/serveur/edition-ancrage.mjs`, `client/serveur/edition.mjs:3459,3615`, `client/serveur/edition-chronologie.mjs:444,545,589-647`, `client/serveur/edition-mots-cles.mjs:105,316,337`
- Test: `client/test/serveur-edition-ancrage-verrou.test.mjs` ; adapter les tests existants qui posent deux catégories (R309 remplace R232 (5))

**Interfaces — Produces :**

```ts
outilsDeLAncrage(...) ajoute :
  sousLeVerrou(ctx): boolean = !ctx.annulation && (ctx.voie === 'lot' || ctx.gel !== false)
  refusDuVerrou(ctx, id: number, colonnes: string[]): string | null   // jamais de `R<n>` dans le texte
```

| Geste sur un mot-clé ancré | Route du site | Lot | Annulation, rejeu |
| --- | --- | --- | --- |
| `libelle`, `url`, `cle` | refusé | refusé | permis |
| type, couleur, icône, synonymes, définition | refusé | permis | permis |
| supprimer, fusionner comme source | refusé | refusé | permis |
| recevoir une fusion | clé seule, synonymes refusés (R219 (4)) | idem | permis |
| poser une seconde catégorie (ancré ou non) | refusé | refusé | permis |

Le contrôle du verrou passe **avant** `raisonDuGel ?? raisonDeLaColonneTenue` dans `ecrire_modifier`.

- [ ] **Step 1 : Écrire les tests**, une ligne par case du tableau, plus :

```js
test('le refus d’un lot sur le nom ne cite aucun numéro de décision', () => assert.deepEqual(decisionsCitees(e.message), []));
test('le mot de passe n’ouvre pas ce refus (verrous_ouverts sans effet)');
test('un mot-clé sans élément garde tous ses gestes');
test('un ancien lot repasse au rejeu (R219 (6))');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier.** Ce test, puis `serveur-edition-verrou`, `serveur-edition-mots-cles-fusion`, `-liens`, `-icone`, `-references`, `serveur-edition-lots-mot-cle`, `serveur-edition-ancrage`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Mots-clés : un mot-clé ancré ne se modifie plus à la main`).

### Task 9: Ce que montre un mot-clé

**Files:**
- Modify: `client/src/lib/mots-cles-db.mjs:43`, `client/src/lib/mots-cles-balises.mjs:193,321,677-688,812-848,869-878,1012`
- Test: `client/test/mots-cles-element.test.mjs`

**Interfaces — Produces :**
- `motsClesDeLaBase(db)` : chaque mot-clé porte `element: { table, id, adresse, texte } | null`, le premier de `elementsDesMotsCles` (tâche 4).
- `definitionDuMotCle(m): string | null` (`mots-cles-balises.mjs`) : `m.description`, sinon `m.element?.texte`, sinon `null`. Lu à l'affichage, jamais recopié.

- [ ] **Step 1 : Écrire les tests.**

```js
test('une définition écrite reste prioritaire sur le texte de l’élément (R309)');
test('sans définition : le résumé de la page, ou les effets du sort');
test('ni l’un ni l’autre : pas de bulle');
test('la bulle, le mode complet et la sous-ligne du Glossaire montrent le même texte');
test('une balise dans le texte de l’élément se rend comme dans une définition');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter** en remplaçant chaque lecture de `description` destinée à l'affichage par `definitionDuMotCle`.
- [ ] **Step 4 : Vérifier.** Ce test, `mots-cles-liens-rendu`, `glossaire-html`, `mentions-des-mots-cles`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Mots-clés : montrer le texte de l'élément à défaut de définition`).

### Task 10: Glossaire en lecture seule, un type, paginé

**Files:**
- Modify: `client/src/lib/glossaire-filtre.mjs`, `client/src/scripts/glossaire.mjs`, `client/src/pages/regles/glossaire.astro`, `client/src/lib/mots-cles.mjs:65`, `client/src/lib/mots-cles-balises.mjs:812-848`, `client/src/scripts/edition/mots-cles.mjs:104,295,321,431,503`, `client/src/scripts/edition/mots-cles-vivants.mjs:93,230`
- Test: `glossaire-filtre`, `glossaire-tableau`, `glossaire-html`, `edition-mots-cles`, `mots-cles-vivants`

**Interfaces — Produces :**

```ts
// lib/glossaire-filtre.mjs (sans import)
TAILLE_DE_PAGE_DU_GLOSSAIRE = 50
pageDeLaListe(total: number, page: number, taille: number): { page, pages, debut, fin }   // page ramenée dans [1, pages], au moins 1 page
pageDeLAdresse(search: string): number                                                    // ?page=, 1 si absent ou invalide
// lib/mots-cles.mjs
sansArticle(libelle: string): string                                                      // retire Le, La, Les, L' de tête ; parLibelle compare sur ce résultat
```

Ligne du Glossaire : `data-ancre="<table>"` sur un ancré ; colonne et filtre **« Type »** ; option « Sans catégorie » masquée quand aucun mot-clé n'est à classer. Sous-ligne : texte de l'élément signalé comme tel, avec un lien vers l'endroit où il se modifie. Création : un seul type, `Notion` par défaut. Un ancré n'offre aucun geste d'édition.

- [ ] **Step 1 : Écrire les tests.**

```js
test('pageDeLaListe : 120 lignes par 50 donnent 3 pages, la page 9 est ramenée à 3, 0 ligne donne 1 page');
test('pageDeLAdresse : ?page=2 donne 2 ; absent, 0, -1, abc donnent 1');
test('parLibelle ignore l’article de tête : « Les postures » se range à P, « L’embuscade » à E');
test('HTML construit : seules les 50 premières lignes visibles, `<noscript>` montre tout');
test('le filtre s’applique à tout le registre, puis la pagination ; changer de filtre revient à la page 1');
test('un mot-clé ancré n’a aucun geste en mode modification ; un mot-clé sans élément les garde');
test('créer un mot-clé propose un seul type, Notion par défaut');
test('l’évènement glossaire:mots-cles réapplique la pagination');
test('la navigation porte aria-label et aria-current');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter.** Chaque ligne hors page reçoit `hidden` ; le numéro est gardé par `history.replaceState`.
- [ ] **Step 4 : Vérifier.** Les cinq tests listés, `npm run build`, puis `node --test test/site-html.test.mjs`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Glossaire : lecture seule des mots-clés ancrés, type unique, pagination`).

### Task 11: Recherche paginée, vue de l'élément

**Files:**
- Modify: `client/src/lib/recherche-mots-cles.mjs:56,68,81`, `client/src/scripts/recherche.mjs:93,140,156`, `client/src/pages/recherche.astro`, `client/src/lib/recherche-index.ts`
- Test: `recherche-mots-cles`, `recherche-script`, `glossaire-filtre` (comparaison)

**Interfaces — Produces :**

```ts
// lib/recherche-mots-cles.mjs (recopie, pas d'import commun : les scripts de page n'en partagent aucun)
TAILLE_DE_PAGE_DE_LA_RECHERCHE = 100
pageDeLaListe, pageDeLAdresse   // mêmes résultats que glossaire-filtre, comparés par test
vueDuMotCle(motCle, pages): { element: { nom, adresse, texte } | null, pages }   // l'élément d'abord
```

Dans le HTML, la liste ne garde que les définitions écrites. Le texte de l'élément arrive avec la vue. Une pastille mène toujours à `?mot-cle=`.

- [ ] **Step 1 : Écrire les tests.**

```js
test('la vue d’un mot-clé montre d’abord son élément, puis les pages qui le portent ou le citent');
test('un mot-clé de sort sans page qui le cite ne dit plus « Aucune page »');
test('100 pastilles par page, filtre sur tout le registre, retour à la page 1');
test('pageDeLaListe et pageDeLAdresse : même résultat dans les deux modules');
test('la pastille mène à ?mot-cle=, jamais à l’adresse du mot-clé');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier.** Les tests listés, `npm run build`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Recherche : pagination et vue de l'élément d'un mot-clé`).

### Task 12: Note de version et page Mise à jour

**Files:**
- Modify: `client/src/lib/notes-de-version.mjs:81-88,433-435,589,711,1019`, `client/src/lib/lots-rendu.mjs:315,361`
- Test: `client/test/notes-de-version-ancrage.test.mjs`, `lots-rendu`

**Interfaces — Produces :**
- `comparerLesMotsClesAncres(ref, dev, x): LigneDeNote[]` : une ligne par famille, `« 1 322 mots-clés ajoutés : 690 capacités, 204 autres pages, 420 sorts, 8 types de sort »`, la valeur venant du calcul.
- Un mot-clé créé ou renommé **avec son élément** n'a plus de ligne à lui ; un renommage sans changement de l'élément (les 18 du §4) reste détaillé ; `mot_cle_id` n'est listé pour aucune table.
- `htmlDuLot` replie un lot `decision === 'R309'` derrière son titre et son nombre de lignes (`<details>`), lignes consultables et annulables.

- [ ] **Step 1 : Écrire les tests.**

```js
test('une ligne par famille pour les mots-clés créés avec leur élément');
test('les renommages du §4 restent détaillés, les catégories nouvelles aussi');
test('un mot-clé qui suit son élément n’a pas de ligne ; `mot_cle_id` n’apparaît pas');
test('un mot-clé sans élément garde sa ligne');
test('un lot R309 est replié, ses lignes restent annulables une à une');
```

- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter.**
- [ ] **Step 4 : Vérifier.** Ce test, puis `npm run test:cible -- --liste` pour les tests de `notes-de-version` et `lots-rendu`. Attendu : PASS.
- [ ] **Step 5 : Commit** (`Note de version : condenser l'ancrage des mots-clés`).

### Task 13: Effets de bord

**Files:**
- Modify: `client/src/lib/autolink.mjs:57`, `client/scripts/autolink.mjs:36`, `tools/db/homonymes.py:22`, `client/src/scripts/edition/mots-cles-vivants.mjs` (si la mesure l'exige)
- Test: `client/test/autolink.test.mjs`, `client/test/importeurs-etiquettes.test.mjs:20-26,49-58`

**Interfaces :** `ciblesDuVocabulaire(motsCles, pages, pageDuMotCle)` ne compte plus un mot-clé de sort comme mot-clé de la page de sa magie.

Valeur exacte :

```py
ETIQUETTES_NON_POSEES = frozenset({'bouclier', 'pièce élémentaire', 'amélioration', 'tour', 'mode hyper', 'mode super',
                                   'invocation', 'chasseur', 'gladiateur', 'maison', 'construction', 'malédiction'})
```

Le filtre reste dans les importeurs, jamais dans `mots_cles_poses`. `invocations.py` et `classes.py` doivent lire cette liste.

- [ ] **Step 1 : Écrire les tests.** Dans `autolink.test.mjs` : `une page de magie garde ses termes malgré les mots-clés de ses sorts`. Dans `importeurs-etiquettes.test.mjs` : étendre `IMPORTEURS` à `invocations.py` (`invocation.json`) et `classes.py` (`classe-maverick-v7.json --sans-liens`), `EXCLUES` aux six nouvelles étiquettes.
- [ ] **Step 2 : Lancer.** Attendu : FAIL.
- [ ] **Step 3 : Implémenter**, y compris le filtre dans `invocations.py` (`tab_tags`, l.556) et `classes.py`.
- [ ] **Step 4 : Mesurer le vocabulaire vivant** sur une copie ancrée. Attendu : environ 114 Ko. Si la page en souffre, charger le texte des éléments à part.
- [ ] **Step 5 : Vérifier.** Les deux tests, `mots-cles-vivants`. Attendu : PASS.
- [ ] **Step 6 : Commit** (`Mots-clés : autolien et importeurs après l'ancrage`).

### Task 14: Documentation, contrôle final, PR

**Files:**
- Modify: `docs/content-guide.md` (mots-clés), `docs/serveur.md` (route, verrou)

- [ ] **Step 1 : Mettre à jour la documentation** : ce qu'est un mot-clé ancré, le verrou, l'action, la route. Lister dans la description de la PR les changements à reporter par `tech-skills` dans `zone-mots-cles`, `zone-mots-cles-service`, `zone-glossaire`, `zone-recherche`, `zone-edition-lots`, `base-sqlite-migrations`.
- [ ] **Step 2 : Contrôle complet.** `npm run test:cible`, `npm run db:check`, `npm run db:controler-migrations -- --base origin/dev`, `npm run build`, `HIDE_EXAMPLES=1 npm run build`. Attendu : tout passe.
- [ ] **Step 3 : Rejouer l'ancrage complet** sur une copie de la base (script de la tâche 6). Attendu : 4 lots, 0 refus, `db:check` sans problème, annulation du lot 4 puis relance sans écart.
- [ ] **Step 4 : Contrôler le site construit** sur une copie ancrée : Glossaire (première page visible, pagination), bulle d'un sort, vue Recherche d'une capacité, avec le navigateur intégré.
- [ ] **Step 5 : Relecture indépendante** de toute la branche par un agent neuf, sans mes conclusions.
- [ ] **Step 6 : Publier** selon le skill `publier-une-branche` : `git fetch --prune origin`, rebase sur `origin/dev` si la base a bougé, `npm run test:cible -- --apres-rebase --liste`, `git push -u --force-with-lease origin feature/mots-cles-ancrage`, PR vers `dev` en français, auto-fix activé. CI verte et sans conflit : fusion par « Create a merge commit ».
- [ ] **Step 7 : Lancer l'ancrage** sur le site de dev, une fois la mise à jour passée : avec la clé de dépôt si elle est fournie, sinon demander au propriétaire un clic sur « Préparer l'ancrage ». Contrôler les comptes réels et la page Mise à jour. Rien ne part en production sans « Effectuer la mise à jour ».

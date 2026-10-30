// Explorateur de données du site (/donnees/) : lit la base reconstruite depuis data/rows et prépare tables, lignes, liens entre tables et liens vers le wiki.
// Les gabarits Astro ne contiennent que des boucles : toute la logique est dans src/lib/donnees.mjs, testée ici sur les vraies données.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ancre, cheminBase, lister, ouvrirBase, preparerTable, trouverRacine } from '../src/lib/donnees.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';

const racine = trouverRacine();
const schemaTexte = readFileSync(join(racine, 'data', 'schema.sql'), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const sections = lister(db);
const objets = sections.flatMap((s) => s.objets);

test('lireSchema : 18 sections (dont la 5 bis de la chronologie et la 8 bis des monstres), 203 tables, 38 vues, 2 tables de recherche ; descriptions et marques « dérivée »', () => {
  const lues = lireSchema(schemaTexte).filter((s) => s.objets.length);
  assert.equal(lues.length, 18);
  assert.ok(lues.some((s) => s.titre.startsWith('5 bis. CHRONOLOGIE')), 'section 5 bis (migration 0035)');
  assert.ok(lues.some((s) => s.titre.startsWith('8 bis. BESTIAIRE 2.0')), 'section 8 bis (migration 0029)');
  const tous = lues.flatMap((s) => s.objets);
  assert.equal(tous.filter((o) => o.genre === 'table').length, 203);
  assert.equal(tous.filter((o) => o.genre === 'vue').length, 38);
  assert.equal(tous.filter((o) => o.genre.startsWith('table de recherche')).length, 2);
  const page = tous.find((o) => o.nom === 'page');
  assert.match(page.description, /fichier client\/src\/content\/wiki/);
  assert.match(page.colonnes.get('corps_md') ?? '', /./, 'les commentaires de colonne sont lus');
  assert.deepEqual(tous.filter((o) => o.derivee).map((o) => o.nom).sort(), ['entite_fts', 'lien', 'lien_candidat', 'page_fts']);
});

test('lister : toutes les tables et vues explorables (hors recherche plein texte), avec leur nombre de lignes', () => {
  assert.equal(objets.length, 203 + 38);
  assert.ok(!objets.some((o) => /_fts$/.test(o.nom)), 'les tables de recherche ne sont pas explorables');
  const n = (nom) => objets.find((o) => o.nom === nom).nbLignes;
  assert.equal(n('page'), readdirSync(join(racine, 'client', 'src', 'content', 'wiki')).reduce((s, t) => s + readdirSync(join(racine, 'client', 'src', 'content', 'wiki', t)).length, 0));
  // le nombre affiché est celui de la base (les effectifs de l'import sont épinglés par db-donnees.test.mjs ; le site peut en créer)
  for (const o of objets) assert.equal(o.nbLignes, db.prepare(`SELECT count(*) AS n FROM "${o.nom}"`).get().n, o.nom);
  for (const t of ['sort', 'capacite', 'race']) assert.ok(n(t) > 0, `${t} est rempli`);
  assert.ok(n('lien') > 0, 'les tables dérivées (liens des pages) sont calculées');
  assert.ok(n('v_classe_capacite') > 0, 'les vues sont lisibles');
  assert.equal(new Set(objets.map((o) => o.nom)).size, objets.length, 'un nom de page par objet : pas de doublon');
});

test('HIDE_EXAMPLES : la base « à montrer » n’a plus les pages d’exemple', () => {
  const sans = ouvrirBase({ sansExemples: true });
  const n = (b) => b.prepare('SELECT count(*) AS n FROM page').get().n;
  assert.equal(n(db) - n(sans), 5);
  assert.equal(sans.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n, 0);
});

test('ancre : déterministe, valide en HTML, sans collision entre valeurs voisines', () => {
  assert.equal(ancre(['magies/magie-du-sang']), 'r-magies_2f_magie-du-sang');
  assert.equal(ancre([3, 'a']), 'r-3.a');
  assert.notEqual(ancre(['a/b']), ancre(['a_2f_b']), 'un caractère échappé et son code écrit tel quel ne se confondent pas');
  assert.match(ancre(['Épée de feu (rare) #1']), /^r-[A-Za-z0-9_.-]+$/);
});

test('preparerTable : chaque ligne d’une table a une ancre unique ; chaque lien de clé étrangère mène à une ligne qui existe', () => {
  const ancres = new Map(); // table -> ensemble des ancres
  const prepares = new Map();
  for (const o of objets) {
    const t = preparerTable(db, o.nom);
    prepares.set(o.nom, t);
    const vues = new Set();
    for (const l of t.lignes) {
      if (l.ancre === null) continue;
      assert.ok(!vues.has(l.ancre), `${o.nom} : ancre en double ${l.ancre}`);
      vues.add(l.ancre);
    }
    ancres.set(o.nom, vues);
    assert.equal(t.lignes.length, o.nbLignes, `${o.nom} : toutes les lignes sont préparées`);
    for (const l of t.lignes) assert.equal(l.cellules.length, t.colonnes.length, `${o.nom} : une cellule par colonne`);
  }
  let liens = 0;
  for (const t of prepares.values()) {
    for (const l of t.lignes) for (const c of l.cellules) {
      if (!c.lien) continue;
      liens += 1;
      assert.ok(ancres.has(c.lien.table), `${t.nom} : lien vers la table inconnue ${c.lien.table}`);
      assert.ok(ancres.get(c.lien.table).has(c.lien.ancre), `${t.nom} : lien vers ${c.lien.table}#${c.lien.ancre} qui n’existe pas`);
    }
  }
  assert.ok(liens > 20000, `beaucoup de liens entre tables (${liens})`);
});

test('preparerTable : un sort renvoie à sa magie, une capacité à sa page du wiki, la table page ne porte pas le corps des pages', () => {
  const sort = preparerTable(db, 'sort');
  const iMagie = sort.colonnes.findIndex((c) => c.nom === 'magie_id');
  assert.ok(iMagie >= 0 && sort.colonnes[iMagie].vers === 'magie');
  const cell = sort.lignes[0].cellules[iMagie];
  assert.equal(cell.lien.table, 'magie');
  assert.match(cell.lien.ancre, /^r-magies_2f_/);

  const capacite = preparerTable(db, 'capacite');
  assert.ok(capacite.lignes.every((l) => l.page && l.page.startsWith('capacites/')), 'chaque capacité a sa page du wiki');
  const iSpec = capacite.colonnes.findIndex((c) => c.nom === 'specialite_id');
  assert.ok(capacite.lignes.some((l) => l.cellules[iSpec].nul), 'une valeur absente est marquée absente (NULL), jamais remplacée');

  const page = preparerTable(db, 'page');
  assert.ok(!page.colonnes.some((c) => c.nom === 'corps_md'), 'le texte intégral est dans le wiki');
  assert.ok(page.colonnes.some((c) => c.nom === 'corps_md_caracteres'));
  assert.ok(page.lignes.every((l) => l.page === l.cellules[0].t), 'chaque ligne de page renvoie vers sa page');
});

test('preparerTable : les colonnes portent leur type, leur clé et le commentaire du schéma ; les clés à plusieurs colonnes ne deviennent pas des liens', () => {
  const t = preparerTable(db, 'caracteristique');
  assert.deepEqual(t.colonnes.map((c) => [c.nom, c.cle]).slice(0, 2), [['id', true], ['nom', false]]);
  assert.match(t.colonnes[0].type, /TEXT/);
  assert.match(t.description, /six caractéristiques/);
  const composite = preparerTable(db, 'alias'); // clé primaire (page_id, ordre)
  assert.equal(composite.colonnes.filter((c) => c.cle).length, 2);
  assert.ok(composite.lignes.every((l) => l.ancre.includes('.')), 'ancre à deux valeurs');
  assert.throws(() => preparerTable(db, 'table_inconnue'), /inconnu/);
});

test('cheminBase : le fichier publié sur /donnees/maverick.db est une base SQLite complète, intègre, avec ses tables dérivées', () => {
  const fichier = cheminBase({ sansExemples: false });
  const copie = new DatabaseSync(fichier, { readOnly: true });
  assert.deepEqual(copie.prepare('PRAGMA integrity_check').all().map((l) => l.integrity_check), ['ok']);
  assert.equal(copie.prepare('SELECT count(*) AS n FROM page').get().n, db.prepare('SELECT count(*) AS n FROM page').get().n);
  assert.ok(copie.prepare('SELECT count(*) AS n FROM page_fts').get().n > 0, 'plein texte présent');
  assert.equal(copie.prepare('PRAGMA user_version').get().user_version, db.prepare('PRAGMA user_version').get().user_version, 'même version que la base construite');
  copie.close();
});

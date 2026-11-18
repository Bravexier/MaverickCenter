// Essai mécanique des tests, passes du site de dev (lot 10, R278 ; scripts/essai-mecanique-tests.mjs, scripts/essai-variantes.mjs) : chaque variante est
// une modification que le site de dev peut faire, fabriquée sans rompre la base (clés étrangères, CHECK, intégrité) ; le tri compte une variante
// seulement sur les fichiers qui passent C. Les lignes visées sont lues dans l'extrait d'essai, jamais supposées.
//   node --test test/essai-mecanique.test.mjs
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  compteursDuTest, CONTROLES_PAR_NATURE, controlesDeLaPasse, LIT_LE_DEPOT_PAR_NATURE, trierLesControlesDUnePasse, trierLesPassesDuSite,
} from '../scripts/essai-mecanique-tests.mjs';
import { CONTROLES } from '../scripts/mise-a-jour-github.mjs';
import { TABLES_AJOUTEES, TABLES_VIDEES, VARIANTES } from '../scripts/essai-variantes.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { ICONES } from '../src/lib/icones.mjs';
import { TABLES_DU_JOURNAL } from '../src/lib/tables-de-la-base.mjs';
import { normalize } from '../src/lib/text.mjs';
import { copieDEssai, empreinteDuFichier, extraitDEssai } from './aide-contenu-fourni.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const compte = (db, table) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;

/** Applique la variante à une copie de l'extrait ; rend { rapport, avant (comptes), apres (comptes), db (copie ouverte en lecture) }. */
function variante(t, nom, tables = []) {
  const dossier = dossierTemporaire(`essai-variante-${nom}`, { t });
  let rapport;
  const avant = {};
  const chemin = copieDEssai(dossier, (db) => {
    for (const table of tables) avant[table] = compte(db, table);
    rapport = VARIANTES[nom](db);
  });
  const db = new DatabaseSync(chemin, { readOnly: true });
  t.after(() => db.close());
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], `${nom} : aucune clé étrangère rompue`);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  for (const r of rapport.refusees) assert.ok(r.table && r.raison, `${nom} : un refus dit sa table et sa raison`);
  return { rapport, avant, db };
}

test('l’extrait d’essai n’est jamais modifié par une variante', (t) => {
  const avant = empreinteDuFichier(extraitDEssai());
  for (const nom of Object.keys(VARIANTES)) variante(t, nom);
  assert.equal(empreinteDuFichier(extraitDEssai()), avant);
});

test('V1 : des icônes de la liste du site, sur des mots-clés de plusieurs genres', (t) => {
  const { rapport, db } = variante(t, 'V1');
  assert.ok(rapport.faites.length > 0);
  const valeurs = new Set(ICONES.map((i) => i.valeur));
  for (const f of rapport.faites) assert.equal(db.prepare('SELECT icone FROM mot_cle WHERE id = ?').get(f.id).icone, f.icone);
  assert.ok(rapport.faites.every((f) => valeurs.has(f.icone)), 'seulement des icônes que le site propose (lib/icones.mjs)');
  const genres = new Set(rapport.faites.map((f) => f.groupe.split(':')[0]));
  assert.ok(genres.has('categorie') && genres.has('page'), 'des catégories de mots-clés et des types de page');
  assert.ok(new Set(rapport.faites.map((f) => f.groupe)).size >= 3, 'plusieurs groupes, pas seulement les magies');
  const h = historiqueSite(db);
  for (const f of rapport.faites) {
    assert.ok(h.modifiee('mot_cle', { id: f.id }, 'icone'), `mot-clé ${f.id} : l’icône posée est une saisie du site (historique)`);
    assert.notEqual(h.valeurDImport('mot_cle', { id: f.id }, 'icone'), f.icone, `mot-clé ${f.id} : l’état d’import défait l’icône posée`);
  }
});

test('V2 : un sort renommé par le service garde son identifiant ; la trace est une saisie, le journal est vidé comme dans un extrait', (t) => {
  const { rapport, db } = variante(t, 'V2');
  assert.equal(rapport.faites.length, 1, JSON.stringify(rapport.refusees));
  const [f] = rapport.faites;
  assert.notEqual(f.apres, f.avant);
  assert.equal(db.prepare('SELECT nom FROM sort WHERE id = ?').get(f.id).nom, f.apres);
  const h = historiqueSite(db);
  assert.ok(h.modifiee('sort', { id: f.id }, 'nom'), 'le renommage est une saisie du site (historique)');
  const traces = db.prepare('SELECT DISTINCT nature, version FROM historique_modification WHERE lot_id = ?').all(f.lot).map((r) => ({ ...r }));
  assert.deepEqual(traces, [{ nature: 'saisie', version: null }]);
  for (const table of TABLES_DU_JOURNAL) assert.equal(compte(db, table), 0, `${table} : vide, comme dans un extrait`);
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  assert.equal(h.valeurDImport('sort', { id: f.id }, 'nom'), historiqueSite(origine).valeurDImport('sort', { id: f.id }, 'nom'), 'l’état d’import rend le nom d’import');
  assert.equal(compte(db, 'sort'), compte(origine, 'sort'));
});

test('V5 (informative) : une magie renommée garde son identifiant ; sa clé suit le nom ; le renommage est noté comme une saisie', (t) => {
  const { rapport, db } = variante(t, 'V5');
  assert.equal(rapport.faites.length, 1);
  const [f] = rapport.faites;
  const apres = db.prepare('SELECT nom, nom_cle FROM magie WHERE id = ?').get(f.id);
  assert.notEqual(apres.nom, f.avant);
  assert.deepEqual({ ...apres }, { nom: f.apres, nom_cle: normalize(f.apres) });
  assert.ok(historiqueSite(db).modifiee('magie', { id: f.id }, 'nom'));
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  assert.equal(historiqueSite(db).valeurDImport('magie', { id: f.id }, 'nom'), historiqueSite(origine).valeurDImport('magie', { id: f.id }, 'nom'));
});

test('V3 : une ligne de plus dans des tables que le site sait créer, sous une clé nouvelle', (t) => {
  const { rapport, avant, db } = variante(t, 'V3', TABLES_AJOUTEES);
  assert.ok(rapport.faites.length >= 3, `au moins trois tables (refus : ${JSON.stringify(rapport.refusees)})`);
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  // les magies innées d'une race, changées par le service : la page de la race suit, la trace est une saisie, le journal est vidé
  const innees = rapport.faites.find((f) => f.operation === 'magies_innees');
  assert.ok(innees, `magies innées changées (refus : ${JSON.stringify(rapport.refusees)})`);
  assert.notDeepEqual(innees.apres, innees.avant);
  const nomsDe = (ids) => ids.map((id) => db.prepare('SELECT nom FROM magie WHERE id = ?').get(id).nom);
  const surLaPage = JSON.parse(db.prepare('SELECT donnees FROM page WHERE id = ?').get(innees.race).donnees).magies_innees;
  assert.deepEqual(new Set(surLaPage), new Set(nomsDe(innees.apres)), 'la page de la race suit');
  assert.deepEqual(db.prepare('SELECT DISTINCT nature FROM historique_modification WHERE lot_id = ?').all(innees.lot).map((r) => r.nature), ['saisie']);
  assert.ok(historiqueSite(db).modifiee('page', { id: innees.race }, 'donnees'));
  for (const table of TABLES_DU_JOURNAL) assert.equal(compte(db, table), 0, `${table} : vide, comme dans un extrait`);
  for (const f of rapport.faites.filter((x) => x.operation !== 'magies_innees')) {
    assert.equal(compte(db, f.table), avant[f.table] + 1, f.table);
    const ou = Object.keys(f.cle).map((c) => `"${c}" = ?`).join(' AND ');
    assert.ok(db.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE ${ou}`).get(...Object.values(f.cle)), `${f.table} : la ligne ajoutée est là`);
    assert.equal(origine.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE ${ou}`).get(...Object.values(f.cle)), undefined, `${f.table} : sa clé est nouvelle`);
    assert.ok(historiqueSite(db).creee(f.table, f.cle), `${f.table} : la ligne ajoutée est une saisie du site (historique)`);
  }
  for (const r of rapport.refusees) assert.equal(compte(db, r.table), avant[r.table], `${r.table} : un ajout refusé ne laisse rien`);
});

test('V4 : une ligne de moins dans des tables que le site sait vider, choisie sans dépendant', (t) => {
  const { rapport, avant, db } = variante(t, 'V4', TABLES_VIDEES);
  assert.ok(rapport.faites.length >= 2, `au moins deux tables (refus : ${JSON.stringify(rapport.refusees)})`);
  for (const f of rapport.faites) {
    assert.equal(compte(db, f.table), avant[f.table] - 1, f.table);
    const [[k, v]] = Object.entries(f.cle);
    assert.equal(db.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE "${k}" = ?`).get(v), undefined);
    assert.equal(db.prepare('SELECT count(*) AS n FROM page_entite WHERE entite_table = ? AND entite_id = ?').get(f.table, String(v)).n, 0, 'son rattachement à une page part avec elle');
    // supprimée, ou créée puis supprimée (un contenu qui porte déjà une variante V3) : une saisie du site dans les deux cas
    assert.ok(historiqueSite(db).touchee(f.table, f.cle), `${f.table} : la ligne retirée est une saisie du site (historique)`);
    assert.equal(db.prepare("SELECT count(*) AS n FROM historique_modification WHERE table_nom = ? AND cle = ? AND operation = 'supprimer'")
      .get(f.table, JSON.stringify(f.cle)).n, 1, `${f.table} : une trace de suppression`);
  }
  for (const r of rapport.refusees) assert.equal(compte(db, r.table), avant[r.table]);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('les variantes laissent un état d’import intact : défaire leurs saisies rend les lignes de l’extrait', (t) => {
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  for (const [nom, tables] of [['V1', ['mot_cle']], ['V2', ['sort']], ['V3', TABLES_AJOUTEES], ['V4', TABLES_VIDEES], ['V5', ['magie']]]) {
    const { db } = variante(t, nom);
    const h = historiqueSite(db);
    const hOrigine = historiqueSite(origine);
    // l'ordre n'est pas garanti (une ligne remise par l'état d'import vient après les autres) : comparées triées
    const triees = (lignes) => lignes.map((l) => JSON.stringify(l)).sort();
    for (const table of tables) assert.deepEqual(triees(h.lignesDImport(table)), triees(hOrigine.lignesDImport(table)), `${nom} : ${table}`);
  }
});

test('tri des passes du site : C compte ce qui lit encore le dépôt ; une variante ne compte que les fichiers qui passent C', () => {
  const m = (lignes) => new Map(lignes.map(([fichier, code]) => [fichier, { fichier, code }]));
  const { passes, fichiers, md } = trierLesPassesDuSite({
    C: m([['a.test.mjs', 0], ['b.test.mjs', 1], ['c.test.mjs', 0]]),
    V1: m([['a.test.mjs', 1], ['b.test.mjs', 1], ['c.test.mjs', 0]]),
    V3: m([['a.test.mjs', 0], ['b.test.mjs', 0], ['c.test.mjs', 'delai']]),
  }, (passe, fichier) => `not ok 1\n  error: échec de ${fichier} sur ${passe}\n`, {});
  assert.deepEqual(passes.C, { mesures: 3, passent: 2, cassent: ['b.test.mjs'], par_nature: [], classes_qui_passent: [] });
  assert.deepEqual(passes.V1, { mesures: 3, figent_une_valeur: ['a.test.mjs'], deja_casses_par_C: 1 });
  assert.deepEqual(passes.V3, { mesures: 3, figent_une_valeur: ['c.test.mjs'], deja_casses_par_C: 0 });
  assert.equal(passes.V2, undefined, 'une passe non lancée n’apparaît pas');
  assert.deepEqual(fichiers.find((f) => f.fichier === 'a.test.mjs'), { fichier: 'a.test.mjs', C: 'passe', V1: 'casse', V3: 'passe', causes: { V1: 'error: échec de a.test.mjs sur V1' } });
  assert.ok(md.some((l) => l.startsWith('## Passe V1')));
});

test('tri : une passe informative (V5) range ses échecs à part, jamais comme une valeur figée', () => {
  const m = (lignes) => new Map(lignes.map(([fichier, code]) => [fichier, { fichier, code }]));
  const { passes, md } = trierLesPassesDuSite({ C: m([['a.test.mjs', 0]]), V5: m([['a.test.mjs', 1]]) }, () => '', {});
  assert.deepEqual(passes.V5, { mesures: 1, informative: true, cassent: ['a.test.mjs'], deja_casses_par_C: 0 });
  assert.ok(md.some((l) => l.includes('informative, ne bloque rien')));
});

test('tri de C : un fichier qui lit le dépôt par nature est rangé à part des échecs inattendus ; un fichier classé qui passe est signalé', () => {
  const m = (lignes) => new Map(lignes.map(([fichier, code]) => [fichier, { fichier, code }]));
  const parNature = { 'n.test.mjs': { famille: 'F3', raison: 'écrit data/rows', tests: '2' }, 'p.test.mjs': { famille: 'F4', raison: 'vide dans data/rows' } };
  const { passes, md } = trierLesPassesDuSite({
    C: m([['a.test.mjs', 1], ['n.test.mjs', 1], ['p.test.mjs', 0]]),
    V1: m([['a.test.mjs', 1], ['n.test.mjs', 1], ['p.test.mjs', 0]]),
  }, () => '', parNature);
  assert.deepEqual(passes.C, { mesures: 3, passent: 1, cassent: ['a.test.mjs'], par_nature: ['n.test.mjs'], classes_qui_passent: ['p.test.mjs'] });
  assert.equal(passes.V1.deja_casses_par_C, 2, 'une variante ne recompte pas un fichier classé qui casse sur C');
  const rubrique = md.indexOf('### Lit le dépôt par nature, jusqu’au lot 12');
  assert.ok(rubrique > 0, 'la rubrique est écrite');
  assert.ok(md.slice(rubrique).some((l) => l.startsWith('| n.test.mjs | F3 |')));
  assert.ok(md.some((l) => l.includes('p.test.mjs') && l.includes('à retirer')));
});

test('classement « lit le dépôt par nature » : chaque fichier existe dans client/test/, avec une famille F3 à F5 et une raison', () => {
  const noms = Object.keys(LIT_LE_DEPOT_PAR_NATURE);
  assert.ok(noms.length > 0);
  for (const [nom, { famille, raison }] of Object.entries(LIT_LE_DEPOT_PAR_NATURE)) {
    assert.ok(existsSync(new URL(`./${nom}`, import.meta.url)), `${nom} : absent de client/test/`);
    assert.match(famille, /^F[345]$/, `${nom} : famille`);
    assert.ok(raison && !raison.includes('\n'), `${nom} : une raison en une ligne`);
  }
});

test('contrôles d’une passe : ceux du job preparer, sans npm test ; chaque test du site construit à part ; db:build et db:check par nature', () => {
  const liste = controlesDeLaPasse(CONTROLES);
  assert.ok(!liste.some((c) => c.commande === 'npm test'), 'npm test reste à la passe');
  for (const c of Object.keys(CONTROLES_PAR_NATURE)) assert.ok(CONTROLES.includes(c) && liste.find((x) => x.commande === c)?.par_nature, c);
  // chaque fichier des listes de tests de CONTROLES, dans l'ordre, une fois par liste (site-html deux fois : après le build et après le build de production)
  const attendus = CONTROLES.filter((c) => c.startsWith('node --test ')).flatMap((c) => c.slice('node --test '.length).split(' ').map((f) => f.slice('test/'.length)));
  assert.deepEqual(liste.filter((c) => c.test).map((c) => c.test), attendus);
  assert.ok(attendus.includes('races-html.test.mjs') && attendus.filter((f) => f === 'site-html.test.mjs').length === 2);
  // l'ordre de la CI est gardé : un test du site après le build qui le précède dans CONTROLES
  const rang = (commande) => liste.findIndex((c) => c.commande === commande);
  assert.ok(rang('node --test test/races-html.test.mjs') > rang('npm run build'));
  assert.ok(liste.findLastIndex((c) => c.test === 'site-html.test.mjs') > rang('HIDE_EXAMPLES=1 SITE_MODE=prod SITE_TAG=v0.0.0 npm run build'));
  for (const c of liste.filter((x) => !x.test)) assert.ok(CONTROLES.includes(c.commande), c.commande);
});

test('verdict des contrôles : un contrôle par nature ne compte pas ; un test du site échoué, sauté ou vide est rouge', () => {
  assert.deepEqual(compteursDuTest('# tests 3\n# pass 2\n# fail 0\n# skipped 1\n'), { pass: 2, fail: 0, skipped: 1 });
  const t = trierLesControlesDUnePasse('C', [
    { commande: 'npm run db:build', code: 1, par_nature: 'data/rows', journal: 'a.log' },
    { commande: 'npm run build', code: 0, journal: 'b.log' },
    { commande: 'node --test test/a-html.test.mjs', test: 'a-html.test.mjs', code: 0, compteurs: { pass: 4, fail: 0, skipped: 0 }, journal: 'c.log' },
    { commande: 'node --test test/b-html.test.mjs', test: 'b-html.test.mjs', code: 0, compteurs: { pass: 0, fail: 0, skipped: 3 }, journal: 'd.log' },
    { commande: 'node --test test/c-html.test.mjs', test: 'c-html.test.mjs', code: 1, compteurs: { pass: 2, fail: 1, skipped: 0 }, journal: 'e.log' },
  ]);
  assert.deepEqual(t.rouges, ['b-html.test.mjs', 'c-html.test.mjs']);
  assert.deepEqual(t.par_nature, [{ commande: 'npm run db:build', code: 1, raison: 'data/rows' }]);
  assert.ok(t.md.some((l) => l.includes('| a-html.test.mjs | ok |')));
});

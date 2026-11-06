// Les pages des Règles protégées d'une suppression (lib/pages-protegees.mjs#raisonsDeProtection, la seule source ; lot de l'édition des menus et des
// pages, réponse du propriétaire : pas de bouton « Supprimer » sur une page dont le site ou d'autres données ont besoin, le service la refuse en disant
// pourquoi) : chaque raison sur une base synthétique, les raisons de la base du dépôt contre leurs sources (invariants, pas de valeur figée), et le
// garde-fou des pages lues par le code (tout « 'guide/… » écrit dans client/src/ est dans PAGES_LUES_PAR_LE_CODE).
//   node --test test/pages-protegees.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { PAGES_ABSORBEES, PAGES_DE_LA_CREATION, PAR_OU_COMMENCER, RUBRIQUES_SOUS_LA_PAGE } from '../src/lib/livres.mjs';
import { PAGES_LUES_PAR_LE_CODE, raisonsDeProtection } from '../src/lib/pages-protegees.mjs';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function baseDEssai() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const page = db.prepare('INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const p = (id, { corps = 'Texte.', origine = 'docs' } = {}) => {
    const [type, slug] = id.split('/');
    page.run(id, type, slug, slug, slug, corps, 'draft', origine);
  };
  p('guide/libre');
  p('guide/annexe', { origine: 'annexes' });
  p('guide/avec-bloc', { corps: 'Avant.\n\n<!-- guide:initiative -->\n\nAprès.\n' });
  p('guide/citee-par-une-cle');
  p('guide/ouvre-un-onglet');
  p('guide/chronologie');
  db.prepare("INSERT INTO regle_constante (id, valeur, nature, texte, page_id, origine, source_ref) VALUES ('essai', 1, 'texte', 'x', 'guide/citee-par-une-cle', 'fiche', 'x')").run();
  db.prepare("INSERT INTO regles_onglet (id, titre, ordre, ouverture_page_id) VALUES ('combats', 'Les combats', 1, 'guide/ouvre-un-onglet')").run();
  db.prepare("INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id) VALUES ('page:guide/libre', 'combats', 2, 'guide/libre'), ('page:guide/ouvre-un-onglet', 'combats', 1, 'guide/ouvre-un-onglet')").run();
  db.prepare("INSERT INTO evenement (id, rang, titre, titre_cle, epoque, origine, source_ref) VALUES ('e', 1, 'E', 'e', 'debut', 'chronologie', 'x')").run();
  db.prepare("INSERT INTO evenement_extrait (evenement_id, rang, page_id, texte, origine, source_ref) VALUES ('e', 1, 'guide/chronologie', 'x', 'chronologie', 'x')").run();
  return db;
}
const raisons = (db, id) => raisonsDeProtection(db, id).map((r) => r.raison);

test('raisonsDeProtection : clé étrangère sans cascade, famille hors docs, ouverture d’onglet, bloc tiré de la base ; rien pour une page libre ou absente', () => {
  const db = baseDEssai();
  assert.deepEqual(raisonsDeProtection(db, 'guide/libre'), [], 'son entrée de menu (ON DELETE CASCADE) ne la protège pas');
  assert.deepEqual(raisonsDeProtection(db, 'guide/absente'), []);
  assert.deepEqual(raisonsDeProtection(db, 'guide/chronologie'), [], 'une légende de la chronologie est une citation (lib/citations-db.mjs), pas une protection');
  const cle = raisonsDeProtection(db, 'guide/citee-par-une-cle');
  assert.deepEqual(cle.map(({ texte: _t, ...r }) => r), [{ raison: 'cle_etrangere', table: 'regle_constante', colonne: 'page_id', lignes: 1 }]);
  assert.match(cle[0].texte, /citée par 1 ligne de « Constante de règle »/);
  assert.deepEqual(raisons(db, 'guide/annexe'), ['famille']);
  assert.deepEqual(raisonsDeProtection(db, 'guide/ouvre-un-onglet').map((r) => [r.raison, r.onglet, r.texte]), [['ouverture', 'combats', 'page d’ouverture de l’onglet « Les combats »']]);
  assert.deepEqual(raisonsDeProtection(db, 'guide/avec-bloc').map((r) => [r.raison, r.bloc]), [['bloc', 'initiative']]);
  db.close();
});

test('raisonsDeProtection : les pages que le plan du site nomme (lib/livres.mjs) et celles que le code lit ; pas la cible d’un renvoi', () => {
  const db = baseDEssai();
  const page = db.prepare("INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine) VALUES (?, 'guide', ?, ?, ?, 'Texte.', 'draft', 'docs')");
  const ajouter = (id) => {
    const slug = id.slice('guide/'.length);
    if (!db.prepare('SELECT 1 FROM page WHERE id = ?').get(id)) page.run(id, slug, slug, slug);
  };
  const absorbante = Object.values(PAGES_ABSORBEES)[0];
  const sousLaPage = Object.keys(RUBRIQUES_SOUS_LA_PAGE)[0];
  const cas = [
    [PAGES_DE_LA_CREATION.pages.at(-1), 'creation'], [PAR_OU_COMMENCER[0], 'accueil'], [absorbante, 'absorbe'], [sousLaPage, 'rubriques'],
    ...Object.keys(PAGES_LUES_PAR_LE_CODE).map((id) => [id, 'code']),
  ];
  for (const [id, raison] of cas) {
    ajouter(id);
    assert.ok(raisons(db, id).includes(raison), `${id} : ${raison} (${raisons(db, id).join(', ')})`);
  }
  // la cible d'un renvoi d'une ancienne adresse (ADRESSES_DU_PLAN_PRECEDENT, PAGES_ECLATEES_DU_GUIDE) n'est pas protégée (choix du leader-technique :
  // supprimée, l'ancienne adresse mène à la 404, R185, P6) ; « Le mode hyper », cible de /regles/avancees/, est protégé par ailleurs (les pages des magies
  // et des races y renvoient, R187) : une autre cible d'une ancienne adresse
  for (const id of ['guide/campagne-ou-scenario-one-shot', 'guide/l-embuscade']) {
    ajouter(id);
    assert.deepEqual(raisons(db, id), [], id);
  }
  db.close();
});

test('base du dépôt : chaque raison suit sa source (ouverture des onglets, famille, blocs, clés étrangères) ; une page des Règles au moins reste supprimable', () => {
  const db = ouvrirBase({ sansExemples: false });
  const pages = db.prepare('SELECT p.id, p.origine, p.corps_md FROM regles_onglet_entree e JOIN page p ON p.id = e.page_id ORDER BY p.id').all();
  const ouvertures = new Set(db.prepare('SELECT ouverture_page_id AS id FROM regles_onglet').all().map((o) => o.id));
  let libres = 0;
  for (const p of pages) {
    const r = raisons(db, p.id);
    assert.equal(r.includes('ouverture'), ouvertures.has(p.id), `${p.id} : ouverture`);
    assert.equal(r.includes('famille'), p.origine !== 'docs', `${p.id} : famille`);
    assert.equal(r.includes('bloc'), /<!--\s*guide:/.test(p.corps_md), `${p.id} : bloc`);
    assert.equal(r.includes('code'), Object.hasOwn(PAGES_LUES_PAR_LE_CODE, p.id), `${p.id} : code`);
    const citee = ['page_entite', 'regle_constante', 'mode_texte', 'panneau_regles'].some((t) => db.prepare(`SELECT 1 FROM "${t}" WHERE page_id = ?`).get(p.id));
    if (citee) assert.ok(r.includes('cle_etrangere'), `${p.id} : citée par une clé étrangère`);
    if (!r.length) libres += 1;
  }
  assert.ok(ouvertures.size === 4 && [...ouvertures].every((id) => raisons(db, id).includes('ouverture')), 'les quatre pages d’ouverture');
  assert.ok(libres > 0, 'une page des Règles au moins n’est pas protégée (sinon « Supprimer » ne servirait jamais)');
});

/** Les fichiers de client/src/ (hors pages du wiki fabriquées). */
function fichiersDeSrc(dossier = SRC) {
  return readdirSync(dossier).flatMap((n) => {
    const chemin = join(dossier, n);
    if (statSync(chemin).isDirectory()) return n === 'content' ? [] : fichiersDeSrc(chemin);
    return /\.(?:mjs|js|ts|astro)$/.test(n) ? [chemin] : [];
  });
}

test('garde-fou : toute page « guide/… » écrite dans client/src/ (hors du plan, lib/livres.mjs) est dans PAGES_LUES_PAR_LE_CODE, sauf une adresse d’avant sans page', () => {
  const db = ouvrirBase({ sansExemples: false });
  const existe = (id) => Boolean(db.prepare('SELECT 1 FROM page WHERE id = ?').get(id));
  const ecrites = new Map();
  for (const f of fichiersDeSrc()) {
    const rel = relative(SRC, f).split('\\').join('/');
    if (['lib/livres.mjs', 'lib/pages-protegees.mjs'].includes(rel)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/['"`]guide\/([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
      const id = `guide/${m[1]}`;
      if (!ecrites.has(id)) ecrites.set(id, new Set());
      ecrites.get(id).add(rel);
    }
  }
  assert.ok(ecrites.has('guide/l-equipement'), 'le relevé lit bien client/src/ (lib/ceinture-db.mjs)');
  const oubliees = [...ecrites].filter(([id]) => existe(id) && !Object.hasOwn(PAGES_LUES_PAR_LE_CODE, id)).map(([id, f]) => `${id} (${[...f].join(', ')})`);
  assert.deepEqual(oubliees, [], 'à ajouter à lib/pages-protegees.mjs#PAGES_LUES_PAR_LE_CODE');
  // et la liste n'a rien de périmé : chacune est une page de la base, que le code écrit encore
  for (const id of Object.keys(PAGES_LUES_PAR_LE_CODE)) {
    assert.ok(existe(id), `${id} : une page de la base`);
    assert.ok(ecrites.has(id), `${id} : écrite dans client/src/`);
  }
});

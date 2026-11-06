// Migration data/migrations/0096-retrait-alterations-d-etats-et-mode-hyper.sql (demande du propriétaire du 2026-11-06 : « L'onglet suivant est à
// retirer https://dev.maverick-jdr.com/regles/alterations-d-etats-et-mode-hyper/ ») : la page « Altérations d'états et Mode Hyper », un aiguillage en
// doublon de « Altérations d’états », « Liste des altérations d'état » et « Le Mode Hyper », est retirée (adresse en 404, R185 (6)) ; ses deux alias
// partent avec elle, reportés nulle part ; les cinq liens écrits vers elle visent la page qui traite leur sujet, texte affiché inchangé.
// Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_DES_NOTES } from '../src/lib/notes-de-version.mjs';
import { buildIndex, resolve } from '../src/lib/wikilinks-resolution.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MIGRATION = '0096-retrait-alterations-d-etats-et-mode-hyper.sql';
const RETIREE = 'guide/alterations-d-etats-et-mode-hyper';
const TITRE = 'Altérations d\'états et Mode Hyper';
const ALTERATIONS = 'guide/alterations-d-etats';
const HYPER = 'guide/le-mode-hyper';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);

// Les cinq liens : où, le texte qui l'entoure (le lien avec sa nouvelle cible, texte affiché inchangé), la page visée
const LIENS = [
  { page: 'guide/fiche-competences', cible: ALTERATIONS, ancre: 'altérations d\'états',
    phrase: '*Vigueur (Volonté) :* Mieux résister aux [[guide/alterations-d-etats|altérations d\'états]] physiques comme le poison, les maladies ou les brûlures' },
  { page: 'guide/jet-de-des', cible: ALTERATIONS, ancre: 'altérations d\'états',
    phrase: 'Comme expliqué dans les compétences et les [[guide/alterations-d-etats|altérations d\'états]] (voir combat), le coma est une source de stress' },
  { page: 'guide/guide-pour-mj-maverick', cible: ALTERATIONS, ancre: 'Altérations d’états',
    phrase: '- *[[guide/alterations-d-etats|Altérations d’états]]*\n- *Mode Hyper*\n' },
  { page: 'guide/fiche-tableau-posture', cible: HYPER, ancre: 'mode hyper',
    phrase: 'Voici le tableau où on rassemble les informations sur le [[guide/le-mode-hyper|mode hyper]] du personnage, allez [ici]' },
];
const VIGUEUR = 'Mieux résister aux [[guide/alterations-d-etats|altérations d\'états]] physiques comme le poison, les maladies ou les brûlures';

test('0096 : la page retirée, avec ses lignes d’import, ses alias, son entrée de menu, ses liens ; aucune source orpheline', () => {
  assert.equal(page(RETIREE), undefined);
  for (const [table, colonne] of [['alias', 'page_id'], ['page_tag', 'page_id'], ['page_source', 'page_id'], ['page_entite', 'page_id'],
    ['regles_onglet_entree', 'page_id'], ['lien', 'page_id'], ['lien', 'cible_page_id'], ['lien_candidat', 'candidat_page_id'],
    ['panneau_regles', 'page_id'], ['regle_constante', 'page_id'], ['evenement_extrait', 'page_id']]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(RETIREE).n, 0, `${table}.${colonne}`);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'page' AND entite_id = ?").get(RETIREE).n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').get().n, 0, 'aucune source orpheline');
  // ses deux sources restent citées par d'autres pages
  for (const source of ['ref:google-doc-regle-du-jeu-guide-pour-mj-maverick', 'google-doc:17VxGUwjzEZWElwIYVaXvaaumqFM4yKnO1C7uhVyc9iM']) {
    assert.ok(db.prepare('SELECT count(*) AS n FROM page_source WHERE source_id = ?').get(source).n > 0, source);
  }
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui citent la page restent/);
});

test('0096 : ses alias « Altérations d’états » et « Mode Hyper » ne sont reportés sur aucune page', () => {
  assert.deepEqual(db.prepare("SELECT page_id, texte FROM alias WHERE cle IN ('alterations-detats', 'mode-hyper')").all(), []);
  assert.deepEqual(h.lignesDImport('alias').filter((a) => a.page_id === RETIREE), [], 'absents aussi de l’état d’import');
});

test('0096 : les cinq liens visent la page de leur sujet, résolus, texte affiché inchangé ; aucun ne vise plus la page retirée', () => {
  for (const { page: id, cible, ancre, phrase } of LIENS) {
    const corps = page(id).corps_md;
    assert.ok(corps.includes(phrase), `${id} : ${phrase}`);
    assert.ok(!corps.includes(`[[${TITRE}`), `${id} : plus de lien par l’ancien titre`);
    const liens = db.prepare('SELECT ancre, etat, cible_page_id FROM lien WHERE page_id = ? AND cible = ?').all(id, cible).map((r) => ({ ...r }));
    assert.deepEqual(liens, [{ ancre, etat: 'resolu', cible_page_id: cible }], id);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM lien WHERE cible_page_id = ? OR cible = ?').get(RETIREE, TITRE).n, 0);
  assert.deepEqual(db.prepare("SELECT page_id, cible FROM lien WHERE etat <> 'resolu' AND page_id IN (SELECT value FROM json_each(?))")
    .all(JSON.stringify(LIENS.map((l) => l.page))), []);
});

test('0096 : la compétence Vigueur renvoie à « Altérations d’états », lien résolu comme le site le résout', () => {
  const { description } = db.prepare("SELECT description FROM competence WHERE id = 'vigueur'").get();
  assert.equal(description, VIGUEUR);
  const alias = new Map();
  for (const a of db.prepare('SELECT page_id, texte FROM alias ORDER BY page_id, ordre').all()) alias.set(a.page_id, [...(alias.get(a.page_id) ?? []), a.texte]);
  const index = buildIndex(db.prepare('SELECT id, type, slug, titre FROM page').all()
    .map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: alias.get(p.id) ?? [] })));
  assert.equal(resolve(index, ALTERATIONS)?.entry?.id, ALTERATIONS);
  assert.equal(resolve(index, TITRE), null, 'l’ancien titre ne nomme plus aucune page');
  // l'alias retiré ne fait plus doublon avec le titre de guide/alterations-d-etats (même clé normalisée)
  assert.equal(resolve(index, 'Altérations d\'états')?.entry?.id, ALTERATIONS);
});

test('0096 : plus rien dans la base ne cite la page, hors de l’historique du site et des notes de version', () => {
  const sautees = new Set(TABLES_DES_NOTES);
  const occurrences = [];
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%'").all()) {
    if (sautees.has(name)) continue;
    for (const { name: col } of db.prepare(`PRAGMA table_info("${name}")`).all()) {
      const n = db.prepare(`SELECT count(*) AS n FROM "${name}" WHERE instr(CAST("${col}" AS TEXT), ?) > 0 OR instr(CAST("${col}" AS TEXT), ?) > 0`)
        .get('alterations-d-etats-et-mode-hyper', 'états et Mode Hyper').n;
      if (n) occurrences.push(`${name}.${col}:${n}`);
    }
  }
  assert.deepEqual(occurrences, []);
});

test('0096 : le menu « Mécaniques générales » sans la page, rangs de 1 à 9 (état d’import) ; le menu courant suit les éditions du site', () => {
  const entree = (e) => ({ id: e.id, page_id: e.page_id });
  const parRang = (a, b) => a.rang - b.rang || (a.id < b.id ? -1 : 1);
  const importees = h.lignesDImport('regles_onglet_entree').filter((e) => e.onglet_id === 'mecaniques-generales').sort(parRang);
  assert.deepEqual(importees.map((e) => e.page_id), ['reussir-une-action', 'jet-de-des', 'reussites-echecs-et-critiques', 'la-magie-en-jeu',
    'rater-ses-sortileges', 'resistances-et-faiblesses', 'alterations-d-etats', 'liste-des-alterations-d-etat', 'meteo'].map((s) => `guide/${s}`));
  assert.deepEqual(importees.map((e) => e.rang), importees.map((_, i) => i + 1));
  const actuelles = db.prepare("SELECT id, page_id FROM regles_onglet_entree WHERE onglet_id = 'mecaniques-generales'").all().map(entree);
  const attendues = importees.filter((e) => !h.supprimee('regles_onglet_entree', { id: e.id })).map(entree)
    .concat(actuelles.filter((e) => h.creee('regles_onglet_entree', { id: e.id })));
  const tri = (l) => l.map((e) => JSON.stringify(e)).sort();
  assert.deepEqual(tri(actuelles), tri(attendues));
});

test('0096 rejouée sur son propre résultat : rien ne change (UPDATE gardés)', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'retrait-alterations-hyper', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  const etat = () => ['page', 'alias', 'page_source', 'page_tag', 'regles_onglet_entree', 'source', 'competence', 'ecart_source']
    .map((table) => base.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((r) => JSON.stringify(r)).join('\n'));
  const avant = etat();
  base.exec('PRAGMA foreign_keys = ON');
  base.exec('BEGIN');
  base.exec(lire(`data/migrations/${MIGRATION}`));
  base.exec('COMMIT');
  assert.deepEqual(etat(), avant);
});

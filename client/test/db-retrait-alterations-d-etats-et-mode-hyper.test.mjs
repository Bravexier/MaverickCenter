// Migration data/migrations/0096-retrait-alterations-d-etats-et-mode-hyper.sql (demande du propriétaire du 2026-11-06 : « L'onglet suivant est à
// retirer https://dev.maverick-jdr.com/regles/alterations-d-etats-et-mode-hyper/ ») : la page « Altérations d'états et Mode Hyper », un aiguillage en
// doublon de « Altérations d’états », « Liste des altérations d'état » et « Le Mode Hyper », est retirée (adresse en 404, R185 (6)) ; ses deux alias
// partent avec elle, reportés nulle part ; les cinq liens écrits vers elle visent la page qui traite leur sujet, texte affiché inchangé.
// Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni dans data/rows.
// Le site de dev est la source de ce qu'il modifie (skill tests-conventions) : les textes que la migration a écrits (les phrases des liens, la
// description de Vigueur), les titres et alias qui résolvent les liens, et le menu se lisent tels que la migration les a laissés, dans
// baseDImport({ garder: lotsAvant('0096') }) (test/aide-base-d-import.mjs ; seuls les lots rapatriés après la 0096, absents de
// fixtures/lots-avant-0096.json, se défont) ; l'état courant ne garde que le fonctionnement (la page retirée n'existe plus, rien ne la cite ni n'y mène,
// les liens qui restent écrits sont résolus, le menu suit les éditions du site, la migration se rejoue). Ce que le site a écrit lui appartient : une page
// dont il a réécrit le texte ou qu'il a supprimée, une cellule qu'il a écrite, une cible qu'il a supprimée sont admises.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { buildIndex, extractLinks, resolve } from '../src/lib/wikilinks-resolution.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { citations, ecritParLeSite, lienDuSite } from './aide-page-retiree.mjs';

const MIGRATION = '0096-retrait-alterations-d-etats-et-mode-hyper.sql';
const RETIREE = 'guide/alterations-d-etats-et-mode-hyper';
const TITRE = 'Altérations d\'états et Mode Hyper';
const ALTERATIONS = 'guide/alterations-d-etats';
const HYPER = 'guide/le-mode-hyper';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
/** La base telle que la migration 0096 l'a laissée (les éditions du site rapatriées après elle défaites). */
const apres0096 = () => baseDImport({ garder: lotsAvant('0096') });
const corpsApres0096 = (id) => apres0096().prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
/** Une page importée que le site a supprimée (un lien écrit vers elle ne se résout plus : admis). */
const supprimeeParLeSite = (id) => h.supprimee('page', { id });
/** Les liens non résolus de ces pages, hors de celles dont le site a réécrit le texte et des cibles qu'il a supprimées. */
const liensCasses = (pages) => db.prepare(`SELECT page_id, cible, etat FROM lien WHERE etat <> 'resolu' AND page_id IN (${pages.map(() => '?').join(', ')})`)
  .all(...pages).map((r) => ({ ...r }))
  .filter((r) => !h.modifiee('page', { id: r.page_id }, 'corps_md') && !supprimeeParLeSite(r.cible));
/** L'index des liens `[[…]]` d'une base, bâti comme scripts/db-derive.mjs (id, slug, titre, alias). */
function indexDe(base) {
  const alias = new Map();
  for (const a of base.prepare('SELECT page_id, texte FROM alias ORDER BY page_id, ordre').all()) alias.set(a.page_id, [...(alias.get(a.page_id) ?? []), a.texte]);
  return buildIndex(base.prepare('SELECT id, type, slug, titre FROM page').all()
    .map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: alias.get(p.id) ?? [] })));
}

// Les quatre liens des pages (le cinquième est dans la description de Vigueur) : où, la page visée, le texte qui l'entoure tel que la migration l'a
// laissé (le lien avec sa nouvelle cible, texte affiché inchangé)
const LIENS = [
  { page: 'guide/fiche-competences', cible: ALTERATIONS,
    phrase: '*Vigueur (Volonté) :* Mieux résister aux [[guide/alterations-d-etats|altérations d\'états]] physiques comme le poison, les maladies ou les brûlures' },
  { page: 'guide/jet-de-des', cible: ALTERATIONS,
    phrase: 'Comme expliqué dans les compétences et les [[guide/alterations-d-etats|altérations d\'états]] (voir combat), le coma est une source de stress' },
  { page: 'guide/guide-pour-mj-maverick', cible: ALTERATIONS, phrase: '- *[[guide/alterations-d-etats|Altérations d’états]]*\n- *Mode Hyper*\n' },
  { page: 'guide/fiche-tableau-posture', cible: HYPER,
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
  // ses deux sources restent citées par d'autres pages, telles que la migration les a laissées (le site peut supprimer ces pages depuis)
  for (const source of ['ref:google-doc-regle-du-jeu-guide-pour-mj-maverick', 'google-doc:17VxGUwjzEZWElwIYVaXvaaumqFM4yKnO1C7uhVyc9iM']) {
    assert.ok(apres0096().prepare('SELECT count(*) AS n FROM page_source WHERE source_id = ?').get(source).n > 0, source);
  }
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui citent la page restent/);
});

test('0096 : ses alias « Altérations d’états » et « Mode Hyper » ne sont reportés sur aucune page', () => {
  // tels que la migration les a laissés (un renommage sur le site ajoute l'ancien titre en alias de la page renommée)
  assert.deepEqual(apres0096().prepare("SELECT page_id, texte FROM alias WHERE cle IN ('alterations-detats', 'mode-hyper')").all(), []);
  assert.deepEqual(h.lignesDImport('alias').filter((a) => a.page_id === RETIREE), [], 'absents aussi de l’état d’import');
});

test('0096 : les quatre liens des pages visent la page de leur sujet, texte affiché inchangé (texte de la migration) ; les liens écrits sont résolus', () => {
  // les textes tels que la migration les a écrits (le site peut les réécrire depuis)
  for (const { page: id, phrase } of LIENS) {
    const corps = corpsApres0096(id);
    assert.ok(corps.includes(phrase), `${id} : ${phrase}`);
    assert.ok(!corps.includes(`[[${TITRE}`), `${id} : plus de lien par l’ancien titre`);
  }
  // l'état courant : chaque lien encore écrit vers la page du sujet est une ligne de lien, résolue vers elle (sauf si le site l'a supprimée)
  for (const { page: id, cible } of LIENS) {
    const corps = page(id)?.corps_md;
    if (corps === undefined) {
      assert.ok(supprimeeParLeSite(id), `${id} absente sans que le site l'ait supprimée`);
      continue;
    }
    const ecrits = extractLinks(corps).filter((l) => l.target === cible).map((l) => l.label);
    const liens = db.prepare('SELECT ancre, etat, cible_page_id FROM lien WHERE page_id = ? AND cible = ? ORDER BY position').all(id, cible).map((r) => ({ ...r }));
    assert.deepEqual(liens.map((l) => l.ancre), ecrits, `${id} : les liens suivent le texte`);
    if (!supprimeeParLeSite(cible)) for (const l of liens) assert.deepEqual({ etat: l.etat, cible_page_id: l.cible_page_id }, { etat: 'resolu', cible_page_id: cible }, id);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM lien WHERE cible_page_id = ?').get(RETIREE).n, 0);
  // un lien par l'ancien titre ou l'ancienne adresse ne vient que d'un texte que le site a réécrit
  assert.deepEqual(db.prepare('SELECT page_id, cible FROM lien WHERE cible IN (?, ?)').all(TITRE, RETIREE).map((r) => ({ ...r }))
    .filter((r) => !h.modifiee('page', { id: r.page_id }, 'corps_md')), []);
  assert.deepEqual(liensCasses(LIENS.map((l) => l.page)), []);
});

test('0096 : la compétence Vigueur renvoie à « Altérations d’états », lien résolu comme le site le résout', () => {
  // le texte et les titres tels que la migration les a laissés (competence n'est pas écrite par le site, mais les titres et alias le sont)
  const base = apres0096();
  assert.equal(base.prepare("SELECT description FROM competence WHERE id = 'vigueur'").get().description, VIGUEUR);
  const index = indexDe(base);
  assert.equal(resolve(index, ALTERATIONS)?.entry?.id, ALTERATIONS);
  assert.equal(resolve(index, TITRE), null, 'l’ancien titre ne nomme plus aucune page');
  // l'alias retiré ne fait plus doublon avec le titre de guide/alterations-d-etats (même clé normalisée)
  assert.equal(resolve(index, 'Altérations d\'états')?.entry?.id, ALTERATIONS);
  // l'état courant : chaque lien écrit dans la description mène à une page (sauf une cible que le site a supprimée), jamais à la page retirée
  const actuel = indexDe(db);
  const { description } = db.prepare("SELECT description FROM competence WHERE id = 'vigueur'").get();
  for (const { target } of extractLinks(description)) {
    const vers = resolve(actuel, target)?.entry?.id;
    if (vers === undefined) assert.ok(supprimeeParLeSite(target), `${target} : lien non résolu`);
    else assert.notEqual(vers, RETIREE);
  }
});

test('0096 : plus rien dans la base ne cite la page, hors de l’historique du site, des notes de version et de ce que le site a écrit', () => {
  // l'adresse : nulle part dans l'état de la migration ; sur l'état courant, seulement dans une cellule dont la dernière valeur écrite par le site la
  // porte. Le titre en toutes lettres, tel que la migration l'a laissé (les liens de la copie sont ceux du texte courant : ceux d'un texte que le site a
  // écrit avec ce lien sont admis)
  assert.deepEqual(citations(apres0096(), 'alterations-d-etats-et-mode-hyper', lienDuSite(h)), []);
  assert.deepEqual(citations(db, 'alterations-d-etats-et-mode-hyper', ecritParLeSite(h)), []);
  assert.deepEqual(citations(apres0096(), 'états et Mode Hyper', lienDuSite(h)), []);
});

test('0096 : le menu « Mécaniques générales » sans la page, rangs de 1 à 9 (état de la migration) ; le menu courant suit les éditions du site', () => {
  // le menu tel que la migration l'a laissé
  const entree = (e) => ({ id: e.id, page_id: e.page_id });
  const importees = apres0096().prepare("SELECT id, page_id, rang FROM regles_onglet_entree WHERE onglet_id = 'mecaniques-generales' ORDER BY rang, id").all();
  assert.deepEqual(importees.map((e) => e.page_id), ['reussir-une-action', 'jet-de-des', 'reussites-echecs-et-critiques', 'la-magie-en-jeu',
    'rater-ses-sortileges', 'resistances-et-faiblesses', 'alterations-d-etats', 'liste-des-alterations-d-etat', 'meteo'].map((s) => `guide/${s}`));
  assert.deepEqual(importees.map((e) => e.rang), importees.map((_, i) => i + 1));
  // le menu courant : les mêmes entrées, moins celles que le site a supprimées ou envoyées dans un autre onglet, plus celles qu'il a créées ou y a amenées
  const actuelles = db.prepare("SELECT id, page_id FROM regles_onglet_entree WHERE onglet_id = 'mecaniques-generales'").all().map(entree);
  const ici = new Set(actuelles.map((e) => e.id));
  const deplacee = (e) => h.modifiee('regles_onglet_entree', { id: e.id }, 'onglet_id');
  const venues = new Set(importees.map((e) => e.id));
  const attendues = importees.filter((e) => !h.supprimee('regles_onglet_entree', { id: e.id }) && (ici.has(e.id) || !deplacee(e))).map(entree)
    .concat(actuelles.filter((e) => !venues.has(e.id) && (h.creee('regles_onglet_entree', { id: e.id }) || deplacee(e))));
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

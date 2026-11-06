// Migration data/migrations/0094-retrait-pages-doublons-des-combats.sql (demande du propriétaire du 2026-11-06 : « Il y a 4 pages à supprimer car
// inutile ou doublon. * Postures * Les boss et leurs postures * Le mode hyper * Mode super ») : trois pages de l'onglet « Les combats » retirées, avec
// leurs lignes liées ; les liens écrits vers elles menés à la page qui reprend leur contenu ; les postures gardent leurs ids (identifiants figés),
// rattachées à guide/les-postures. La quatrième page, « Le Mode Hyper », reste (R187 : c'est la « Liste des effets mode hyper » qui est retirée,
// migration 0095) : 0094 n'y touche pas.
// Lecture de la base construite ; la migration rejouée l'est sur une COPIE, jamais sur var/maverick.db ni sur data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MIGRATION = '0094-retrait-pages-doublons-des-combats.sql';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const corps = (id) => page(id).corps_md;
const RETIREES = ['guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'];
const POSTURES = ['defensif', 'focus', 'neutre', 'offensif', 'symbiose', 'vigilance'].map((s) => `guide/postures#posture:${s}`);

test('0094 : les trois pages retirées, avec leurs lignes d’import, leur alias, leur entrée de menu, leurs liens ; aucune source orpheline', () => {
  for (const id of RETIREES) {
    assert.equal(page(id), undefined, id);
    for (const [table, colonne] of [['alias', 'page_id'], ['page_tag', 'page_id'], ['page_source', 'page_id'], ['page_entite', 'page_id'],
      ['regles_onglet_entree', 'page_id'], ['lien', 'page_id'], ['lien', 'cible_page_id'], ['lien_candidat', 'candidat_page_id'],
      ['panneau_regles', 'page_id'], ['regle_constante', 'page_id'], ['mode_texte', 'page_id'], ['evenement_extrait', 'page_id']]) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(id).n, 0, `${table}.${colonne} ${id}`);
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'page' AND entite_id = ?").get(id).n, 0, id);
    // plus aucun lien écrit vers elles dans le texte d'une page
    assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE instr(corps_md, ?) > 0').get(`[[${id}`).n, 0, `[[${id}`);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM alias WHERE cle = 'les-boss-et-leurs-postures'").get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').get().n, 0, 'aucune source orpheline');
  // aucun lien cassé ni ambigu dans les pages qui citaient les pages retirées
  assert.deepEqual(db.prepare(`SELECT page_id, cible, etat FROM lien WHERE etat <> 'resolu'
    AND page_id IN ('guide/les-postures', 'guide/attaquer-et-se-defendre', 'guide/guide-pour-mj-maverick')`).all(), []);
  // la migration ne fait que retirer : l'historique du site et les notes de version gardent ce qui les citait
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui les citent restent/);
});

// « Le Mode Hyper » reste (R187) : la migration 0095 retire la Liste et change une phrase de « Le Mode Hyper » ; 0094, elle, n'y touche pas.
test('0094 : « Le Mode Hyper » reste (R187) et 0094 n’y touche pas : sa page, son alias, son entrée de menu, ses liens entrants', () => {
  assert.equal(page('guide/le-mode-hyper')?.titre, 'Le Mode Hyper');
  assert.deepEqual(db.prepare("SELECT texte FROM alias WHERE page_id = 'guide/le-mode-hyper'").all().map((r) => r.texte), ['Le Mode Hyper et le Mode Super']);
  assert.equal(db.prepare("SELECT onglet_id FROM regles_onglet_entree WHERE page_id = 'guide/le-mode-hyper'").get()?.onglet_id, 'combats');
  assert.ok(db.prepare("SELECT count(*) AS n FROM lien WHERE cible_page_id = 'guide/le-mode-hyper'").get().n > 0);
  assert.ok(corps('guide/les-postures').includes('(voir [[guide/le-mode-hyper|Le Mode Hyper]])'));
});

// La « Liste des effets mode hyper » est retirée à son tour par la migration 0095 (db-retrait-liste-des-effets-mode-hyper.test.mjs) : rangs de 1 à 19.
// L'ordre et les rangs se lisent dans l'état d'import (lib/historique-site.mjs) : le site de dev, source de ce qu'il modifie, peut supprimer une page
// du menu (ainsi guide/formule-des-degats, supprimée le 2026-11-06, sans renuméroter les suivantes) ; le menu courant en est le reflet.
test('0094 : le menu « Les combats » sans les trois pages, dans l’ordre de la migration 0091, rangs de 1 à n (état d’import) ; le menu courant suit les éditions du site', () => {
  // l'état d'import : le menu tel que les migrations l'ont laissé, les éditions du site défaites
  const entree = (e) => ({ id: e.id, page_id: e.page_id });
  const parRang = (a, b) => a.rang - b.rang || (a.id < b.id ? -1 : 1);
  const importees = h.lignesDImport('regles_onglet_entree').filter((e) => e.onglet_id === 'combats').sort(parRang);
  assert.deepEqual(importees.map((e) => e.page_id), ['le-tour-de-jeu', 'initiative', 'attaquer-et-se-defendre', 'attaque-et-defense',
    'les-attaques-d-opportunite', 'les-attaques-discretes', 'l-embuscade', 'vitesse-deplacement-et-portee', 'actions-et-mouvements', 'vitesse-et-portee',
    'prise-en-tenaille-et-zone-d-influence', 'deplacement-ou-sortie-de-la-zone-d-influence', 'les-degats', 'formule-des-degats', 'les-postures',
    'le-mode-hyper', 'le-mode-hyper-100', 'liste-des-effets-mode-super', 'blessures-et-etats'].map((s) => `guide/${s}`));
  assert.deepEqual(importees.map((e) => e.rang), importees.map((_, i) => i + 1));
  // le menu courant : les mêmes entrées, moins celles que le site a supprimées, plus celles qu'il a créées
  const actuelles = db.prepare("SELECT id, page_id FROM regles_onglet_entree WHERE onglet_id = 'combats'").all().map(entree);
  const attendues = importees.filter((e) => !h.supprimee('regles_onglet_entree', { id: e.id })).map(entree)
    .concat(actuelles.filter((e) => h.creee('regles_onglet_entree', { id: e.id })));
  const tri = (l) => l.map((e) => JSON.stringify(e)).sort();
  assert.deepEqual(tri(actuelles), tri(attendues));
});

test('0094 : identifiants figés : les six postures gardent leur id sous guide/postures, rattachées à guide/les-postures qui affiche leur tableau', () => {
  assert.deepEqual(db.prepare('SELECT id FROM posture ORDER BY id').all().map((r) => r.id), POSTURES);
  // leurs effets, leurs critiques et leurs écarts d'import citent toujours ces ids
  assert.equal(db.prepare('SELECT count(*) AS n FROM posture_effet WHERE posture_id NOT IN (SELECT id FROM posture)').get().n, 0);
  assert.ok(db.prepare('SELECT count(*) AS n FROM posture_effet').get().n > 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM posture_critique WHERE posture_id NOT IN (SELECT id FROM posture)').get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'posture' AND entite_id NOT IN (SELECT id FROM posture)").get().n, 0);
  // page_entite : une sous-entité (principale = 0) de la page qui montre le bloc des postures ; la page n'a pas d'entité principale
  assert.deepEqual(db.prepare("SELECT entite_id, page_id, principale FROM page_entite WHERE entite_table = 'posture' ORDER BY entite_id").all()
    .map((r) => ({ ...r })), POSTURES.map((entite_id) => ({ entite_id, page_id: 'guide/les-postures', principale: 0 })));
  assert.equal(db.prepare("SELECT count(*) AS n FROM page_entite WHERE page_id = 'guide/les-postures' AND principale = 1").get().n, 0);
  assert.ok(corps('guide/les-postures').includes('<!-- guide:postures -->'));
});

test('0094 : les liens écrits vers les pages retirées mènent à la page qui reprend leur contenu ; le texte copié d’un Doc ne change pas', () => {
  const postures = corps('guide/les-postures');
  assert.ok(postures.endsWith('Le texte d’origine des postures : [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).\n'));
  assert.ok(!postures.includes('Doc « Guide pour MJ ») et'));
  const attaquer = corps('guide/attaquer-et-se-defendre');
  assert.ok(attaquer.includes('ont plus de parades et d’esquives que les autres en posture neutre, de vigilance ou de symbiose (voir [[guide/les-postures|Les postures]]).'));
  assert.ok(!attaquer.includes('les-boss-et-leurs-postures'));
  // le sommaire transcrit du Doc « Guide pour MJ » garde « [[Postures]] » : un alias de guide/les-postures le résout
  assert.ok(corps('guide/guide-pour-mj-maverick').includes('- *[[Postures]]*\n'));
  assert.deepEqual(db.prepare("SELECT page_id, texte FROM alias WHERE cle = 'postures'").all().map((r) => ({ ...r })), [{ page_id: 'guide/les-postures', texte: 'Postures' }]);
  assert.deepEqual(db.prepare("SELECT cible_page_id, etat FROM lien WHERE page_id = 'guide/guide-pour-mj-maverick' AND cible = 'Postures'").all().map((r) => ({ ...r })),
    [{ cible_page_id: 'guide/les-postures', etat: 'resolu' }]);
});

test('0094 rejouée sur son propre résultat : rien ne change (UPDATE gardés par le texte d’avant, alias ajouté une fois)', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'retrait-combats', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  const etat = () => ['page', 'alias', 'page_entite', 'page_source', 'regles_onglet_entree', 'source']
    .map((table) => base.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((r) => JSON.stringify(r)).join('\n'));
  const avant = etat();
  base.exec('PRAGMA foreign_keys = ON');
  base.exec('BEGIN');
  base.exec(lire(`data/migrations/${MIGRATION}`));
  base.exec('COMMIT');
  assert.deepEqual(etat(), avant);
});

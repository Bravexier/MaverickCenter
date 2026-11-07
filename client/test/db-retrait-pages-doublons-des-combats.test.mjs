// Migration data/migrations/0094-retrait-pages-doublons-des-combats.sql (demande du propriétaire du 2026-11-06 : « Il y a 4 pages à supprimer car
// inutile ou doublon. * Postures * Les boss et leurs postures * Le mode hyper * Mode super ») : trois pages de l'onglet « Les combats » retirées, avec
// leurs lignes liées ; les liens écrits vers elles menés à la page qui reprend leur contenu ; les postures gardent leurs ids (identifiants figés),
// rattachées à guide/les-postures. La quatrième page, « Le Mode Hyper », reste (R187 : c'est la « Liste des effets mode hyper » qui est retirée,
// migration 0095) : 0094 n'y touche pas.
// Lecture de la base construite ; la migration rejouée l'est sur une COPIE, jamais sur var/maverick.db ni sur data/rows.
// Le site de dev est la source de ce qu'il modifie (skill tests-conventions) : titres, textes des pages et onglet d'une entrée de menu se lisent tels que
// les migrations les ont laissés, dans baseDImport({ garder: lotsAvant('0095') }) (test/aide-base-d-import.mjs ; seuls les lots rapatriés après la 0095,
// absents de fixtures/lots-avant-0095.json, se défont ; la 0095 ne touche aucun des textes lus ici hors de guide/le-mode-hyper) ; l'état courant ne garde
// que le fonctionnement (les pages retirées n'existent plus, rien n'y mène, les liens suivent le texte, le menu suit les éditions du site).
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { ecritParLeSite, lignesQuiCitent } from './aide-page-retiree.mjs';

const MIGRATION = '0094-retrait-pages-doublons-des-combats.sql';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
/** La base telle que les migrations 0094 et 0095 l'ont laissée (les éditions du site rapatriées après elles défaites). */
const apres0095 = () => baseDImport({ garder: lotsAvant('0095') });
const pageApres = (id) => apres0095().prepare('SELECT * FROM page WHERE id = ?').get(id);
const corpsApres = (id) => pageApres(id).corps_md;
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
    // plus aucun lien écrit vers elles dans le texte d'une page : aucun dans l'état des migrations ; sur l'état courant, seulement dans un texte dont la
    // dernière version écrite par le site porte déjà le lien (test/aide-page-retiree.mjs)
    assert.deepEqual(lignesQuiCitent(apres0095(), 'page', 'corps_md', `[[${id}`).map((p) => p.id), [], `[[${id} (état des migrations)`);
    assert.deepEqual(lignesQuiCitent(db, 'page', 'corps_md', `[[${id}`, ecritParLeSite(h)).map((p) => p.id), [], `[[${id}`);
  }
  // l'alias de la page retirée (un renommage sur le site ajoute l'ancien titre en alias de la page renommée : l'état de la migration)
  assert.equal(apres0095().prepare("SELECT count(*) AS n FROM alias WHERE cle = 'les-boss-et-leurs-postures'").get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').get().n, 0, 'aucune source orpheline');
  // aucun lien cassé ni ambigu dans les pages qui citaient les pages retirées, hors de celles dont le site a réécrit le texte (un lien qu'il a écrit lui
  // appartient)
  assert.deepEqual(db.prepare(`SELECT page_id, cible, etat FROM lien WHERE etat <> 'resolu'
    AND page_id IN ('guide/les-postures', 'guide/attaquer-et-se-defendre', 'guide/guide-pour-mj-maverick')`).all()
    .filter((r) => !h.modifiee('page', { id: r.page_id }, 'corps_md')), []);
  // la migration ne fait que retirer : l'historique du site et les notes de version gardent ce qui les citait
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui les citent restent/);
});

// « Le Mode Hyper » reste (R187) : la migration 0095 retire la Liste et change une phrase de « Le Mode Hyper » ; 0094, elle, n'y touche pas.
test('0094 : « Le Mode Hyper » reste (R187) et 0094 n’y touche pas : sa page, son alias, son entrée de menu, ses liens entrants', () => {
  const HYPER = 'guide/le-mode-hyper';
  // tels que les migrations les ont laissés
  const base = apres0095();
  assert.equal(pageApres(HYPER)?.titre, 'Le Mode Hyper');
  assert.deepEqual(base.prepare('SELECT texte FROM alias WHERE page_id = ?').all(HYPER).map((r) => r.texte), ['Le Mode Hyper et le Mode Super']);
  assert.equal(base.prepare('SELECT onglet_id FROM regles_onglet_entree WHERE page_id = ?').get(HYPER)?.onglet_id, 'combats');
  assert.ok(corpsApres('guide/les-postures').includes('(voir [[guide/le-mode-hyper|Le Mode Hyper]])'));
  // l'état courant : la page reste (sauf suppression par le site), avec son entrée de menu ; les liens suivent le texte des postures
  if (!page(HYPER)) {
    assert.ok(h.supprimee('page', { id: HYPER }), `${HYPER} absente sans que le site l'ait supprimée`);
    return;
  }
  const entree = db.prepare('SELECT id, onglet_id FROM regles_onglet_entree WHERE page_id = ?').get(HYPER);
  assert.ok(entree, `${HYPER} : une entrée de menu`);
  if (!h.modifiee('regles_onglet_entree', { id: entree.id }, 'onglet_id')) assert.equal(entree.onglet_id, 'combats');
  const postures = page('guide/les-postures')?.corps_md ?? '';
  const lie = db.prepare("SELECT count(*) AS n FROM lien WHERE page_id = 'guide/les-postures' AND cible_page_id = ?").get(HYPER).n > 0;
  if (postures.includes(`[[${HYPER}|`) || postures.includes(`[[${HYPER}]]`)) assert.ok(lie, 'le renvoi écrit dans guide/les-postures est résolu');
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
  // le menu courant : les mêmes entrées, moins celles que le site a supprimées ou envoyées dans un autre onglet, plus celles qu'il a créées ou y a amenées
  const actuelles = db.prepare("SELECT id, page_id FROM regles_onglet_entree WHERE onglet_id = 'combats'").all().map(entree);
  const ici = new Set(actuelles.map((e) => e.id));
  const deplacee = (e) => h.modifiee('regles_onglet_entree', { id: e.id }, 'onglet_id');
  const venues = new Set(importees.map((e) => e.id));
  const attendues = importees.filter((e) => !h.supprimee('regles_onglet_entree', { id: e.id }) && (ici.has(e.id) || !deplacee(e))).map(entree)
    .concat(actuelles.filter((e) => !venues.has(e.id) && (h.creee('regles_onglet_entree', { id: e.id }) || deplacee(e))));
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
  // le marqueur du tableau, tel que la migration l'a laissé (le site peut réécrire la page)
  assert.ok(corpsApres('guide/les-postures').includes('<!-- guide:postures -->'));
});

test('0094 : les liens écrits vers les pages retirées mènent à la page qui reprend leur contenu ; le texte copié d’un Doc ne change pas', () => {
  // les textes tels que la migration les a écrits (le site peut les réécrire depuis)
  const postures = corpsApres('guide/les-postures');
  assert.ok(postures.endsWith('Le texte d’origine des postures : [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).\n'));
  assert.ok(!postures.includes('Doc « Guide pour MJ ») et'));
  const attaquer = corpsApres('guide/attaquer-et-se-defendre');
  assert.ok(attaquer.includes('ont plus de parades et d’esquives que les autres en posture neutre, de vigilance ou de symbiose (voir [[guide/les-postures|Les postures]]).'));
  assert.ok(!attaquer.includes('les-boss-et-leurs-postures'));
  // le sommaire transcrit du Doc « Guide pour MJ » garde « [[Postures]] » : un alias de guide/les-postures le résout
  assert.ok(corpsApres('guide/guide-pour-mj-maverick').includes('- *[[Postures]]*\n'));
  assert.deepEqual(apres0095().prepare("SELECT page_id, texte FROM alias WHERE cle = 'postures'").all().map((r) => ({ ...r })), [{ page_id: 'guide/les-postures', texte: 'Postures' }]);
  // l'état courant : « [[Postures]] », s'il est encore écrit, mène à la page que l'alias « postures » désigne
  const vers = db.prepare("SELECT page_id FROM alias WHERE cle = 'postures'").get()?.page_id;
  const liens = db.prepare("SELECT cible_page_id, etat FROM lien WHERE page_id = 'guide/guide-pour-mj-maverick' AND cible = 'Postures'").all().map((r) => ({ ...r }));
  if (vers) for (const l of liens) assert.deepEqual(l, { cible_page_id: vers, etat: 'resolu' });
  if ((page('guide/guide-pour-mj-maverick')?.corps_md ?? '').includes('[[Postures]]')) assert.ok(liens.length > 0, '« [[Postures]] » est un lien');
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

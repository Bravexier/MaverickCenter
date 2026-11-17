// Migration data/migrations/0124-retrait-accessoires-et-ceinture.sql (décision R272 du propriétaire, 2026-11-14) : la page « Accessoires et Ceinture »
// est retirée ; ses sections « Accessoires » et « Ceinture » passent telles quelles dans « Inventaire/Sac à dos », que suivent la constante de R89 et
// l'onglet Ceinture (ancre figée {#ceinture}) ; son mot-clé (136) est fondu dans celui de l'inventaire (139, ses balises reciblées, le texte affiché
// gardé), qui mène à /regles/inventaire-sac-a-dos/ (exception aux adresses figées, comme R228). L'id de la page de l'inventaire ne change pas.
// Un lot du journal noté avant la migration lit ses balises de même (serveur/edition.mjs#FUSIONS_DE_MIGRATION).
// Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni dans data/rows. Le site de dev est la source de
// ce qu'il modifie (skill tests-conventions) : les textes réécrits se lisent à l'import (baseDImport), l'état courant garde les invariants.
//   node --test test/db-0124-retrait-accessoires-et-ceinture.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { ancresDuCorps, sectionParAncre } from '../src/lib/ancres-figees.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { FUSIONS_DE_MIGRATION } from '../serveur/edition.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { idDuMotCleNomme } from './aide-mots-cles.mjs';
import { citations, ecritParLeSite } from './aide-page-retiree.mjs';

const MIGRATION = '0124-retrait-accessoires-et-ceinture';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const SQL = lire(`data/migrations/${MIGRATION}.sql`);
const REGISTRE = JSON.parse(lire(`data/migrations/${MIGRATION}.json`));
const RETIREE = 'guide/fiche-accessoires-et-ceinture';
const GARDEE = 'guide/fiche-inventaire-sac-a-dos';
const [RETRAIT] = REGISTRE.pages_retirees;
const [ADRESSE] = REGISTRE.mots_cles_modifies;
const ANCIENNES_ADRESSES = ['/regles/fiche-accessoires-et-ceinture/', '/regles/fiche-inventaire-sac-a-dos/'];
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);

test('0124 (R272) : le registre, la migration et FUSIONS_DE_MIGRATION disent la même page, les mêmes valeurs, la même fusion', () => {
  assert.equal(REGISTRE.migration, MIGRATION);
  assert.deepEqual(REGISTRE.decisions, ['R272']);
  assert.deepEqual([REGISTRE.page_retiree, REGISTRE.page_gardee], [RETIREE, GARDEE]);
  assert.deepEqual([RETRAIT.id, RETRAIT.contenu_dans], [RETIREE, GARDEE]);
  for (const v of REGISTRE.valeurs) {
    assert.ok(SQL.includes(`'${v.apres}'`) && SQL.includes(`'${v.avant}'`), `${v.table}.${v.colonne} : avant et après écrits dans la migration`);
  }
  const { fusion } = REGISTRE;
  assert.deepEqual([fusion.source_id, fusion.cible_id], [idDuMotCleNomme(fusion.source), idDuMotCleNomme(fusion.cible)]);
  assert.deepEqual(FUSIONS_DE_MIGRATION.find((f) => f.migration === '0124'), { source: fusion.source, cible: fusion.cible, texte: fusion.texte, migration: '0124' });
  assert.ok(SQL.includes(`DELETE FROM mot_cle WHERE id = ${fusion.source_id};`));
  // la balise reciblée : le registre dit la réécriture de la migration (« {{x| » → « {{cible| »), texte affiché gardé
  const balise = REGISTRE.textes.find((t) => t.cle.id === 'guide/l-equipement');
  assert.equal(balise.apres, balise.avant.replace(`{{${fusion.source}|`, `{{${fusion.cible}|`));
  assert.ok(SQL.includes(`'{{${fusion.source}|', '{{${fusion.cible}|'`));
  assert.deepEqual([ADRESSE.id, ADRESSE.col], [fusion.cible_id, 'url']);
  assert.ok(SQL.includes(`url = '${ADRESSE.apres}' WHERE id = ${ADRESSE.id} AND url = '${ADRESSE.avant}'`));
  // le texte déplacé n'est pas recopié dans la migration : il est pris dans la page retirée, telle que la base l'a (le site de dev en est la source)
  const deplace = REGISTRE.textes.find((t) => t.cle.id === GARDEE);
  assert.ok(deplace.apres.startsWith(deplace.avant));
  assert.equal(SQL.includes(sectionParAncre(deplace.apres, 'ceinture')), false);
  assert.equal(RETRAIT.page_source_supprimees.length, 2);
  assert.ok(RETRAIT.page_source_supprimees.every((r) => r.page_id === RETIREE));
});

test('0124 : la page retirée n’existe plus, ni ses lignes ; ses sources restent ; rien ne cite son id ni les anciennes adresses', () => {
  assert.equal(db.prepare('SELECT 1 FROM page WHERE id = ?').get(RETIREE), undefined);
  for (const table of ['page_source', 'alias', 'page_tag', 'page_entite', 'regles_onglet_entree', 'regle_constante']) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE page_id = ?`).get(RETIREE).n, 0, table);
  }
  // les deux sources de la page sont aussi celles de l'inventaire : aucune n'est retirée
  assert.deepEqual(RETRAIT.sources_supprimees, []);
  for (const { source_id: id } of RETRAIT.page_source_supprimees) assert.ok(db.prepare('SELECT 1 FROM source WHERE id = ?').get(id), `${id} gardée`);
  // hors de l'historique du site et des notes de version ; ce que le site a écrit lui appartient
  for (const motif of [RETIREE, ...ANCIENNES_ADRESSES]) {
    assert.deepEqual(citations(baseDImport(), motif), [], `${motif} (import)`);
    assert.deepEqual(citations(db, motif, ecritParLeSite(h)), [], `${motif} (aujourd'hui)`);
  }
});

test('0124 (R272) : les sections « Accessoires » et « Ceinture » sont à la fin de l’inventaire, sous leurs ancres figées ; R89 suit la page', () => {
  const deplace = REGISTRE.textes.find((t) => t.cle.id === GARDEE);
  // à l'import : le corps de l'inventaire finit par le texte déplacé, chaque section lisible par son ancre
  const corps = baseDImport().prepare('SELECT corps_md FROM page WHERE id = ?').get(GARDEE).corps_md;
  assert.ok(corps.endsWith(deplace.apres));
  assert.equal(corps.split(deplace.avant).length - 1, 1);
  assert.deepEqual(ancresDuCorps(corps).map((a) => a.ancre), RETRAIT.ancres);
  for (const ancre of RETRAIT.ancres) assert.ok(sectionParAncre(corps, ancre), ancre);
  // aujourd'hui : la page de l'inventaire garde son id ; deux intertitres n'ont jamais la même ancre
  const courant = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(GARDEE)?.corps_md;
  assert.ok(courant !== undefined, 'la page de l’inventaire, lue par le code (lib/pages-protegees.mjs#PAGES_LUES_PAR_LE_CODE), existe');
  const ancres = ancresDuCorps(courant).map((a) => a.ancre);
  assert.equal(new Set(ancres).size, ancres.length);
  // regle_constante.page_id n'est écrit ni par lib/edition-modele.mjs ni par le service : la valeur se lit telle quelle
  const constante = REGISTRE.valeurs.find((v) => v.table === 'regle_constante');
  assert.equal(constante.decision, 'R89');
  assert.equal(db.prepare('SELECT page_id FROM regle_constante WHERE id = ?').get(constante.cle.id).page_id, GARDEE);
});

test('0124 : le menu « Fiche de personnage » perd l’entrée retirée, les autres gardent leur rang', () => {
  const { entree_du_menu: entree } = RETRAIT;
  const entrees = h.lignesDImport('regles_onglet_entree').filter((e) => e.onglet_id === entree.onglet_id);
  assert.ok(entrees.length > 0);
  assert.equal(entrees.some((e) => e.id === entree.id || e.page_id === RETIREE), false);
  assert.ok(entrees.some((e) => e.page_id === GARDEE), 'l’inventaire reste au menu');
  // l'entrée retirée laisse son rang libre, sans renumérotation (rang n'est ni UNIQUE ni continu) : la migration n'écrit aucun rang
  assert.equal(/UPDATE\s+regles_onglet_entree/i.test(SQL), false);
  assert.ok(SQL.includes(`DELETE FROM regles_onglet_entree WHERE page_id = '${RETIREE}';`));
  const rangs = entrees.map((e) => e.rang);
  assert.equal(new Set(rangs).size, rangs.length, 'un rang par entrée');
});

test('0124 (R272) : le mot-clé de la page retirée est fondu dans celui de l’inventaire, qui mène à /regles/inventaire-sac-a-dos/ ; plus rien ne le cite', () => {
  const { fusion } = REGISTRE;
  const imp = baseDImport();
  assert.equal(imp.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(fusion.source_id), undefined, 'la source a quitté le vocabulaire');
  assert.equal(imp.prepare('SELECT mot_cle_id FROM mot_cle_ancienne_cle WHERE cle = ?').get(fusion.source)?.mot_cle_id, fusion.cible_id, 'sa clé, quittée par la cible');
  const { url } = imp.prepare('SELECT url FROM mot_cle WHERE id = ?').get(fusion.cible_id);
  assert.equal(url, ADRESSE.apres);
  const index = indexDesAdresses(imp, { exemples: true });
  assert.equal(pageDeLAdresse(index, url), GARDEE, 'la nouvelle adresse mène à la page de l’inventaire (lib/livres.mjs#ADRESSES_RENOMMEES_DU_GUIDE)');
  // la balise reciblée, telle que la migration l'a écrite (le site de dev peut avoir réécrit ce texte depuis : défait par baseDImport)
  for (const t of REGISTRE.textes.filter((x) => x.cle.id !== GARDEE)) {
    const texte = imp.prepare(`SELECT ${t.col} AS v FROM ${t.table} WHERE id = ?`).get(t.cle.id)?.v;
    if (texte === undefined) { assert.ok(h.supprimee(t.table, t.cle), `${t.cle.id} absente sans que le site l’ait supprimée`); continue; }
    assert.ok(texte.includes(t.apres) && !texte.includes(t.avant), t.cle.id);
  }
  // aujourd'hui : ni le mot-clé fondu, ni une balise de sa clé, ni une étiquette, hors de ce que le site a écrit
  assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(fusion.source_id), undefined);
  for (const table of ['mot_cle_categorie', 'mot_cle_synonyme', 'sort_mot_cle']) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE mot_cle_id = ?`).get(fusion.source_id).n, 0, table);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?').get(fusion.source_id).n, 0);
  assert.deepEqual(citations(imp, `{{${fusion.source}`), [], 'balise (import)');
  assert.deepEqual(citations(db, `{{${fusion.source}`, ecritParLeSite(h)), [], 'balise (aujourd’hui)');
});

test('0124 : la garde arrête la migration rejouée sur son propre résultat, sans rien écrire', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'migration-0124', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  const etat = () => base.prepare("SELECT (SELECT corps_md FROM page WHERE id = 'guide/fiche-inventaire-sac-a-dos') AS c, (SELECT count(*) FROM page) AS p, (SELECT count(*) FROM mot_cle) AS m").get();
  const avant = { ...etat() };
  base.exec('BEGIN');
  assert.throws(() => base.exec(SQL), /CHECK constraint failed/);
  base.exec('ROLLBACK');
  assert.deepEqual({ ...etat() }, avant);
});

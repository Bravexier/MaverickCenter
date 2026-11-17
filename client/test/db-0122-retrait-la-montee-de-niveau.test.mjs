// Migration data/migrations/0122-retrait-la-montee-de-niveau.sql (demande du propriétaire du 2026-11-13 : « Supprime juste le doublon. ») : la page
// « La montée de niveau », en doublon de « Fiche de personnage : Expérience/Niveau global », est retirée. Réponses du propriétaire : l'onglet
// Exploration s'ouvre sur « Équipement et butin » ; la constante de R225, le mot-clé « La montée de niveau » (172) et les liens vers la page vont à la
// page gardée ; le mot-clé est fondu dans « Fiche de personnage : Expérience/Niveau global » (138 ; « Le fondre dans l'autre »), ses balises reciblées.
// Un lot du journal noté avant la migration lit ses balises de même (serveur/edition.mjs#FUSIONS_DE_MIGRATION : serveur-edition-rejeu-fusions.test.mjs).
// Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni dans data/rows. Le site de dev est la source de
// ce qu'il modifie (skill tests-conventions) : les textes reciblés se lisent à l'import (baseDImport), l'état courant garde les invariants (rien ne cite
// la page retirée ni le mot-clé fondu hors de ce que le site a écrit).
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { FUSIONS_DE_MIGRATION } from '../serveur/edition.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { idDuMotCleNomme } from './aide-mots-cles.mjs';
import { citations, ecritParLeSite } from './aide-page-retiree.mjs';

const MIGRATION = '0122-retrait-la-montee-de-niveau';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const SQL = lire(`data/migrations/${MIGRATION}.sql`);
const REGISTRE = JSON.parse(lire(`data/migrations/${MIGRATION}.json`));
const RETIREE = 'guide/la-montee-de-niveau';
const GARDEE = 'guide/fiche-experience-niveau-global';
const OUVERTURE = 'guide/equipement-et-butin';
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);

test('0122 : le registre, la migration et FUSIONS_DE_MIGRATION disent la même page, les mêmes valeurs, la même fusion', () => {
  assert.equal(REGISTRE.migration, MIGRATION);
  assert.deepEqual([REGISTRE.page_retiree, REGISTRE.page_gardee], [RETIREE, GARDEE]);
  assert.deepEqual(REGISTRE.valeurs.map((v) => [v.table, v.colonne]), [['regles_onglet', 'ouverture_page_id'], ['regle_constante', 'page_id']]);
  for (const v of REGISTRE.valeurs) {
    assert.ok(SQL.includes(`'${v.apres}'`) && SQL.includes(`'${v.avant}'`), `${v.table}.${v.colonne} : avant et après écrits dans la migration`);
  }
  const { fusion } = REGISTRE;
  assert.deepEqual([fusion.source_id, fusion.cible_id], [idDuMotCleNomme(fusion.source), idDuMotCleNomme(fusion.cible)]);
  assert.deepEqual(FUSIONS_DE_MIGRATION.find((f) => f.migration === '0122'), { source: fusion.source, cible: fusion.cible, texte: fusion.texte, migration: '0122' });
  assert.ok(SQL.includes(`DELETE FROM mot_cle WHERE id = ${fusion.source_id};`));
  for (const t of REGISTRE.textes) assert.ok(SQL.includes(`'${t.avant}', '${t.apres}'`), `${t.cle.id} : la réécriture du registre est celle de la migration`);
  assert.equal(REGISTRE.page_source_supprimees.length, 5);
  assert.ok(REGISTRE.page_source_supprimees.every((r) => r.page_id === RETIREE));
});

test('0122 : la page retirée n’existe plus, ni ses lignes d’import, ni la source qu’elle seule citait ; rien ne cite son adresse', () => {
  assert.equal(db.prepare('SELECT 1 FROM page WHERE id = ?').get(RETIREE), undefined);
  for (const table of ['page_source', 'alias', 'page_tag', 'regles_onglet_entree', 'regle_constante']) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE page_id = ?`).get(RETIREE).n, 0, table);
  }
  for (const id of REGISTRE.sources_supprimees) assert.equal(db.prepare('SELECT 1 FROM source WHERE id = ?').get(id), undefined, id);
  // les autres sources de la page restent (d'autres pages les citent)
  const gardees = [...new Set(REGISTRE.page_source_supprimees.map((r) => r.source_id))].filter((id) => !REGISTRE.sources_supprimees.includes(id));
  for (const id of gardees) assert.ok(db.prepare('SELECT 1 FROM source WHERE id = ?').get(id), `${id} gardée`);
  // ni l'id ni l'adresse de la page, hors de l'historique du site et des notes de version ; ce que le site a écrit lui appartient
  for (const motif of [RETIREE, '/regles/la-montee-de-niveau/']) {
    assert.deepEqual(citations(baseDImport(), motif), [], `${motif} (import)`);
    assert.deepEqual(citations(db, motif, ecritParLeSite(h)), [], `${motif} (aujourd'hui)`);
  }
});

test('0122 : Exploration s’ouvre sur « Équipement et butin », une page de son menu ; les autres entrées gardent leur rang', () => {
  // regles_onglet ne se modifie pas sur le site de dev (choix du propriétaire « Non, fixe » ; db-r184-plan-des-regles.test.mjs) : la valeur se lit telle quelle
  assert.equal(db.prepare("SELECT ouverture_page_id AS p FROM regles_onglet WHERE id = 'exploration'").get().p, OUVERTURE);
  assert.ok(db.prepare("SELECT 1 FROM regles_onglet_entree WHERE onglet_id = 'exploration' AND page_id = ?").get(OUVERTURE));
  // à l'import : l'entrée retirée laisse son rang (1) libre, sans renumérotation (rang n'est ni UNIQUE ni continu)
  const rangs = h.lignesDImport('regles_onglet_entree').filter((e) => e.onglet_id === 'exploration').map((e) => e.rang).sort((a, b) => a - b);
  assert.ok(rangs.length > 0);
  assert.equal(rangs.includes(REGISTRE.entree_supprimee.rang), false);
  assert.equal(new Set(rangs).size, rangs.length, 'un rang par entrée');
});

test('0122 (R225) : la constante de santé du Potentiel Illimité cite la page gardée', () => {
  // regle_constante.page_id n'est écrit ni par lib/edition-modele.mjs ni par le service : la valeur se lit telle quelle
  const constante = REGISTRE.valeurs.find((v) => v.table === 'regle_constante');
  assert.equal(constante.decision, 'R225');
  assert.equal(db.prepare('SELECT page_id FROM regle_constante WHERE id = ?').get(constante.cle.id).page_id, GARDEE);
});

test('0122 : « La montée de niveau » fondu dans la cible, qui mène à la page gardée ; ses balises la citent (import) ; plus rien ne le cite (aujourd’hui)', () => {
  const { fusion } = REGISTRE;
  const imp = baseDImport();
  assert.equal(imp.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(fusion.source_id), undefined, 'la source a quitté le vocabulaire');
  assert.equal(imp.prepare('SELECT mot_cle_id FROM mot_cle_ancienne_cle WHERE cle = ?').get(fusion.source)?.mot_cle_id, fusion.cible_id, 'sa clé, quittée par la cible');
  const cible = imp.prepare('SELECT url FROM mot_cle WHERE id = ?').get(fusion.cible_id);
  assert.equal(pageDeLAdresse(indexDesAdresses(imp, { exemples: true }), cible.url), GARDEE);
  // les balises reciblées, telles que la migration les a écrites (le site de dev peut avoir réécrit ces textes depuis : défait par baseDImport)
  for (const t of REGISTRE.textes) {
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
  assert.deepEqual(citations(baseDImport(), `{{${fusion.source}`), [], 'balise (import)');
  assert.deepEqual(citations(db, `{{${fusion.source}`, ecritParLeSite(h)), [], 'balise (aujourd’hui)');
});

test('0122 : la garde arrête la migration rejouée sur son propre résultat, sans rien écrire', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'migration-0122', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  const etat = () => base.prepare("SELECT (SELECT ouverture_page_id FROM regles_onglet WHERE id = 'exploration') AS o, (SELECT count(*) FROM page) AS p, (SELECT count(*) FROM mot_cle) AS m").get();
  const avant = { ...etat() };
  base.exec('BEGIN');
  assert.throws(() => base.exec(SQL), /CHECK constraint failed/);
  base.exec('ROLLBACK');
  assert.deepEqual({ ...etat() }, avant);
});

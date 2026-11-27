// Les pages de notion et l'index de recherche des pages (`page_fts`, table dérivée que la fabrication du site refait, scripts/db-derive.mjs ; le service ne l'écrit
// pas) : sur une base dont l'index a une ligne par page AVANT le lot (comme une base tirée de data/rows puis dérivée), le lot des pages de notion passe l'essai,
// s'applique, et chacune de ses lignes comme le lot entier s'annulent, malgré l'écart de l'index qu'ils font naître ; tout autre problème né d'un lot de notions le
// refuse encore. Un lot refusé arrête « Préparer l'ancrage » (`suite` faux). Petite base de test/aide-ancrage.mjs en fichier, noms inventés.
//   node --test test/serveur-edition-notions-index.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { ErreurEdition, NOTIONS } from '../serveur/edition.mjs';
import { preparerLAncrage } from '../serveur/edition-ancrage-lots.mjs';
import { annuler, annulerUneLigne, deposer, deposerEtAppliquer, previsualiserLAnnulation } from '../serveur/edition-lots.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { ancrerUnMotCle, baseDAncrage, poserMotCle, poserPageLisible, recalculerLesCles } from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('notions-index');
let n = 0;
const OUVERT = { controle: { ouvertHorsEdition: true }, enArrierePlan: false };
const nomInvente = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;

/** L'index refait comme la fabrication le fait : une ligne par page. */
const refaireLIndex = (db) => db.exec(`DELETE FROM page_fts; INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte)
  SELECT id, titre, '', '', coalesce(resume, ''), coalesce(corps_md, '') FROM page`);
/** Vrai si les contrôles du contenu trouvent l'écart de l'index (par sa table et sa règle, pas par son message). */
const ecartDeLIndex = (db) => controlerLeContenu(db).emplacements.some((e) => e.table === 'page_fts' && e.regle === 'table_derivee');
/** Les problèmes du contenu hors de `avant`, l'écart de l'index mis à part. */
function autresProblemes(db, avant) {
  const { problemes, emplacements } = controlerLeContenu(db);
  return problemes.filter((p, i) => !avant.has(p) && !(emplacements[i].table === 'page_fts' && emplacements[i].regle === 'table_derivee'));
}

/** La base d'essai, en fichier : une page des Règles ancrée, deux mots-clés sans élément (candidats à une page de notion) ; l'index a une ligne par page. */
function nouvelle() {
  const memoire = baseDAncrage();
  memoire.exec('BEGIN');
  const ancree = poserPageLisible(memoire, 'guide/zephyrion-ancre', nomInvente('ancre'));
  const motDeLAncre = ancrerUnMotCle(memoire, 'page', ancree, { categories: ['Règles'] });
  const notions = [poserMotCle(memoire, { libelle: nomInvente('notion un'), categories: ['Règles'] }), poserMotCle(memoire, { libelle: nomInvente('notion deux'), categories: ['Règles'] })];
  memoire.exec(`INSERT INTO famille (id, libelle, ordre) VALUES ('docs', 'Famille docs', 1); UPDATE page SET origine = 'docs';
    INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) SELECT type, type, type, '', '', row_number() OVER (ORDER BY type) FROM (SELECT DISTINCT type FROM page)`);
  recalculerLesCles(memoire);
  refaireLIndex(memoire);
  memoire.exec('COMMIT');
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  memoire.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  memoire.close();
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), monde: { motDeLAncre, notions } };
}

const pageDe = (m, motCle) => m.db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').get(motCle)?.id;
const lotDesNotions = (m) => m.db.prepare("SELECT id, lot_id, contenu FROM lot_de_changements WHERE decision = 'R309' AND etat = 'applique' ORDER BY rowid").all()
  .find((l) => JSON.parse(l.contenu).operations.some((o) => o.ancrage?.notion === true));
const lot = (operations) => ({ format: FORMAT_DU_LOT, titre: `Notions d’essai ${(n += 1)}`, nature: 'decision', decision: 'R309', operations });
/** L'insertion de la page de notion du mot-clé `k`, comme le plan l'écrit. */
function pageDeNotion(m, k) {
  const { libelle } = m.db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(k);
  const id = NOTIONS.idDeNotion(m.db, libelle);
  return { table: 'page', cle: { id }, operation: 'inserer', apres: { id, titre: libelle, mot_cle_id: k }, ancrage: { notion: true } };
}

test('l’index a une ligne par page avant le lot : le lot des notions passe l’essai et s’applique ; une ligne puis le lot entier s’annulent', async () => {
  const m = nouvelle();
  assert.equal(ecartDeLIndex(m.db), false, 'l’index est juste avant le lot');
  const avant = new Set(controlerLeContenu(m.db).problemes);
  const r = await preparerLAncrage(m.base, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.suite, false);
  for (const k of m.monde.notions) assert.ok(pageDe(m, k), `#${k} : sa page de notion`);
  assert.equal(ecartDeLIndex(m.db), true, 'la page créée n’a pas encore sa ligne d’index : la fabrication la fera');
  assert.deepEqual(autresProblemes(m.db, avant), []);

  // la fabrication a refait l'index : l'annulation d'une ligne fait naître l'écart, toléré (aperçu, puis clic)
  refaireLIndex(m.db);
  const notions = lotDesNotions(m);
  const [{ rang }] = m.db.prepare("SELECT rang FROM modification WHERE lot_id = ? AND table_nom = 'page' ORDER BY rang").all(notions.lot_id);
  const apercu = await previsualiserLAnnulation(m.base, notions.id, { enArrierePlan: false, dossier: m.dossier, ligne: rang });
  assert.deepEqual(apercu.problemes_nouveaux, [], JSON.stringify(apercu.problemes_nouveaux));
  assert.notEqual(apercu.verdict, 'refusee', apercu.refus_de_l_annulation);
  annulerUneLigne(m.db, notions.id, rang);
  assert.equal(m.db.prepare("SELECT count(*) AS n FROM page WHERE mot_cle_id IN (SELECT value FROM json_each(?))").get(JSON.stringify(m.monde.notions)).n, 1, 'une page de notion part');

  // puis le lot entier (le reste)
  refaireLIndex(m.db);
  const entier = await previsualiserLAnnulation(m.base, notions.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(entier.problemes_nouveaux, [], JSON.stringify(entier.problemes_nouveaux));
  annuler(m.db, notions.id);
  for (const k of m.monde.notions) assert.equal(pageDe(m, k), undefined, `#${k} : plus de page`);
  assert.deepEqual(autresProblemes(m.db, avant), []);
});

test('une page de notion dont le texte a été complété, retirée par un lot sur une base à l’index à jour : acceptée, et son annulation aussi', async () => {
  const m = nouvelle();
  const avant = new Set(controlerLeContenu(m.db).problemes);
  const r = await preparerLAncrage(m.base, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  assert.equal(r.arret, null, r.arret?.motif);
  const [k] = m.monde.notions;
  const id = pageDe(m, k);
  // le propriétaire a complété le texte : ce n'est plus exactement le bloc, c'est encore une page de notion (hors de tout menu)
  m.db.prepare("UPDATE page SET corps_md = corps_md || char(10) || 'Texte d’essai complété.' WHERE id = ?").run(id);
  refaireLIndex(m.db);
  assert.equal(ecartDeLIndex(m.db), false, 'l’index est à jour avant le lot');
  const ligne = m.db.prepare('SELECT * FROM page WHERE id = ?').get(id);
  assert.notEqual(ligne.corps_md, CORPS_D_UNE_PAGE_DE_NOTION);

  const retrait = lot([{ table: 'page', cle: { id }, operation: 'supprimer', avant: { ...ligne } }]);
  const propose = await deposer(m.base, retrait, { dossier: m.dossier, ...OUVERT });
  assert.deepEqual(propose.essai.problemes_nouveaux, [], JSON.stringify(propose.essai.problemes_nouveaux));
  assert.notEqual(propose.verdict, 'a_corriger', JSON.stringify(propose.essai));
  const applique = await deposerEtAppliquer(m.base, retrait, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  assert.ok(applique, 'le lot est appliqué');
  assert.equal(m.db.prepare('SELECT id FROM page WHERE id = ?').get(id), undefined, 'la page est retirée');
  assert.deepEqual(autresProblemes(m.db, avant), []);

  // l'annulation du retrait remet la page : l'index (refait comme la fabrication) n'a plus sa ligne, écart toléré de même
  refaireLIndex(m.db);
  const lotRetire = m.db.prepare("SELECT id FROM lot_de_changements WHERE titre = ? AND etat = 'applique'").get(retrait.titre);
  const apercu = await previsualiserLAnnulation(m.base, lotRetire.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.problemes_nouveaux, [], JSON.stringify(apercu.problemes_nouveaux));
  assert.notEqual(apercu.verdict, 'refusee', apercu.refus_de_l_annulation);
  annuler(m.db, lotRetire.id);
  assert.ok(m.db.prepare('SELECT id FROM page WHERE id = ?').get(id), 'la page est remise');
  assert.deepEqual(autresProblemes(m.db, avant), []);
});

test('un lot de notions qui fait naître un autre problème du contenu reste refusé, à l’essai comme au dépôt direct ; seul, il passe', async () => {
  const m = nouvelle();
  const [k] = m.monde.notions;
  const { cle } = m.db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(m.monde.motDeLAncre);
  // une ancienne clé qui est la clé courante d'un mot-clé : un problème des contrôles du contenu, sans rapport avec l'index
  const fautive = { table: 'mot_cle_ancienne_cle', cle: { cle }, operation: 'inserer', apres: { cle, mot_cle_id: k } };
  const propose = await deposer(m.base, lot([pageDeNotion(m, k), fautive]), { dossier: m.dossier, ...OUVERT });
  assert.equal(propose.verdict, 'a_corriger');
  assert.ok(propose.essai.problemes_nouveaux.length > 0, JSON.stringify(propose.essai));
  assert.ok(propose.essai.problemes_nouveaux.every((p) => !/page_fts/.test(p)), 'l’écart de l’index n’y est pas compté');
  const e = await deposerEtAppliquer(m.base, lot([pageDeNotion(m, k), fautive]), { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT }).then(() => null, (x) => x);
  assert.ok(e instanceof ErreurEdition, String(e));
  assert.equal(e.statut, 409, e.message);
  assert.equal(pageDe(m, k), undefined, 'rien n’est écrit');
  // la page seule : l'écart de l'index ne la refuse pas
  await deposerEtAppliquer(m.base, lot([pageDeNotion(m, k)]), { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  assert.ok(pageDe(m, k));
});

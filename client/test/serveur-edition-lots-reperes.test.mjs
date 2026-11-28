// Les repères des mots-clés par un lot de changements du site de dev (table `repere`, migration 0135 ; chantier 4 des mots-clés, « le retrait des colonnes » :
// docs/chantier-retrait-des-colonnes.md, §2 et §7) :
//   - le lot que fabrique scripts/lot-des-reperes.mjs (lib/lot-des-reperes.mjs) pose une ligne par mot-clé sans page ni sort, copie du nom, de l'adresse, de la
//     définition, de la couleur et de l'icône du mot-clé ; déposé par la route comme sur le site de dev (la base source : le lot vaut pour les tables hors
//     édition), son essai à blanc n'écrit rien, son application écrit les lignes au journal ; une ligne s'annule seule, puis le lot entier (R291) ;
//   - le service refuse (409, sans numéro de décision : ce n'est pas un verrou) le repère d'un mot-clé que désigne une page ou un sort, ou qui n'existe pas ;
//   - un lot modifie et supprime un repère ; l'annulation d'une suppression le remet, sauf si le mot-clé a reçu une page entre-temps ;
//   - tant que les colonnes du mot-clé font foi, rien ne lit la table (lib/tables-de-la-base.mjs#TABLES_PAS_ENCORE_LUES) ;
//   - un mot-clé supprimé emporte son repère, noté au journal (serveur/edition-mots-cles.mjs#FILLES_DU_MOT_CLE).
// Aucune valeur du site n'est figée : les mots-clés se prennent par ordre d'id, un repère se compare aux colonnes de son mot-clé, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-reperes.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lotDeLaBase } from '../scripts/lot-des-reperes.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { decisionsCitees } from '../serveur/edition-lots.mjs';
import { refusDuRepere, TABLES_DES_FILLES_DU_MOT_CLE } from '../serveur/edition-mots-cles.mjs';
import { controlerLeLot } from '../src/lib/lot-de-changements.mjs';
import { AUTEUR_DU_LOT_DES_REPERES, COLONNES_DU_REPERE, lotDesReperes, operationsDesReperes } from '../src/lib/lot-des-reperes.mjs';
import { estUnLotDAncrage } from '../src/lib/lots-d-ancrage.mjs';
import { textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { estUneTableAutre } from '../src/lib/notes-de-version.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';

const racine = dossierTemporaire('edition-lots-reperes');
const SCRIPT = fileURLToPath(new URL('../scripts/lot-des-reperes.mjs', import.meta.url));
const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

function nouvelle() {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  // `source` : la base du site de dev (db/source) : la route donne `ouvertHorsEdition` au contrôle du lot (serveur/api.mjs#traiterLots)
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false }, source: () => true };
  const appel = (methode, adresse, corps) => traiter({ methode, chemin: adresse, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  const tous = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
  return { db, chemin, appel, un, tous };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const SANS_ELEMENT = 'NOT EXISTS (SELECT 1 FROM page p WHERE p.mot_cle_id = m.id) AND NOT EXISTS (SELECT 1 FROM sort s WHERE s.mot_cle_id = m.id)';
const sansElement = (m) => m.tous(`SELECT m.id FROM mot_cle m WHERE ${SANS_ELEMENT} ORDER BY m.id`).map((l) => l.id);
const reperes = (m) => m.tous('SELECT mot_cle_id FROM repere ORDER BY mot_cle_id').map((l) => l.mot_cle_id);
const repere = (m, id) => m.un('SELECT * FROM repere WHERE mot_cle_id = ?', id);
/** Les repères qui ne sont pas la copie des colonnes de leur mot-clé (attendu : aucun). */
const ecarts = (m) => m.tous(`SELECT r.mot_cle_id FROM repere r JOIN mot_cle m ON m.id = r.mot_cle_id
  WHERE ${Object.entries(COLONNES_DU_REPERE).map(([r, c]) => `r."${r}" IS NOT m."${c}"`).join(' OR ')}`);
const unLot = (operations) => ({ format: 'maverick-lot/1', titre: `Repères d’essai ${(n += 1)}`, nature: 'code', operations });
const insertion = (m, id) => operationsDesReperes(m.db).find((o) => o.cle.mot_cle_id === id);

/** Donne une page à un mot-clé sans élément, un sort à un autre (les deux premiers par id) : { dePage, deSort }, écrits en base comme le ferait l'ancrage. */
function ancrerDeuxMotsCles(m) {
  const [dePage, deSort] = sansElement(m);
  m.db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = (SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(dePage);
  m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = (SELECT id FROM sort WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(deSort);
  return { dePage, deSort };
}
/** Dépose le lot par la route, vérifie son essai à blanc (rien n'est écrit), puis l'applique d'un clic. */
async function appliquer(m, lot) {
  const avant = reperes(m);
  const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
  assert.equal(proposition.verdict, 'applicable', JSON.stringify(proposition.essai?.operations?.filter((o) => o.etat !== 'applicable').slice(0, 5)));
  assert.deepEqual(reperes(m), avant, 'l’essai à blanc n’écrit rien dans la base');
  const applique = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  return applique;
}

test('module pur : un repère par mot-clé qui n’en a pas, valeurs recopiées telles quelles (NULL compris) ; le lot passe le contrôle du format sans numéro à donner', () => {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  db.exec(SCHEMA);
  db.prepare('INSERT INTO mot_cle (id, libelle, cle, url, description, couleur, icone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(3, 'Essai trois', 'essai-trois', '/essai/', 'Un texte d’essai.', '#a1b2c3', 'monnaie:rf');
  db.prepare('INSERT INTO mot_cle (id, libelle, cle) VALUES (?, ?, ?)').run(5, 'Essai cinq', 'essai-cinq');
  db.prepare('INSERT INTO mot_cle (id, libelle, cle) VALUES (?, ?, ?)').run(8, 'Essai huit', 'essai-huit');
  db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (8, ?)').run('Déjà posé');
  const lot = lotDesReperes(db);
  assert.deepEqual(lot.operations, [
    { table: 'repere', cle: { mot_cle_id: 3 }, operation: 'inserer', apres: { mot_cle_id: 3, nom: 'Essai trois', adresse: '/essai/', definition: 'Un texte d’essai.', couleur: '#a1b2c3', icone: 'monnaie:rf' } },
    { table: 'repere', cle: { mot_cle_id: 5 }, operation: 'inserer', apres: { mot_cle_id: 5, nom: 'Essai cinq', adresse: null, definition: null, couleur: null, icone: null } },
  ]);
  assert.equal(lot.format, 'maverick-lot/1');
  assert.equal(lot.nature, 'decision');
  assert.match(lot.decision, /^R[0-9]+$/);
  assert.equal(lot.auteur, AUTEUR_DU_LOT_DES_REPERES);
  assert.equal(estUnLotDAncrage(lot), false, 'un lot de l’équipe, pas un lot de l’action « Préparer l’ancrage »');
  assert.equal(lotDesReperes(db, { titre: 'Titre donné' }).titre, 'Titre donné');

  // le format : `repere.mot_cle_id` cite un mot-clé qui existe, ce n'est pas un numéro à donner ; la clé entière d'un mot-clé, elle, se donne toujours
  const types = (table) => Object.fromEntries(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => [c.name, c.type.toUpperCase()]));
  const structure = (table) => {
    const colonnes = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (!colonnes.length) return null;
    return { colonnes: colonnes.map((c) => c.name), cle: colonnes.filter((c) => c.pk).map((c) => c.name), types: types(table),
      etrangeres: Object.fromEntries(db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map((f) => [f.from, f.table])) };
  };
  assert.deepEqual(controlerLeLot(lot, { structure, ouvertHorsEdition: true }).erreurs, []);
  assert.equal(controlerLeLot(lot, { structure }).valide, false, 'hors de la base source, la table reste fermée aux lots');
  const motCle = unLot([{ table: 'mot_cle', cle: { id: 99 }, operation: 'inserer', apres: { id: 99, libelle: 'Essai', cle: 'essai' } }]);
  assert.equal(controlerLeLot(motCle, { structure, ouvertHorsEdition: true }).valide, false, 'un id de mot-clé écrit à la main reste refusé');

  assert.ok(!textesDeLaBase(db).some((t) => t.table === 'repere') && textesDeLaBase(db).some((t) => t.table === 'mot_cle' && t.colonne === 'description'));

  // rien à poser : pas de lot
  for (const o of lot.operations) db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (?, ?)').run(o.cle.mot_cle_id, o.apres.nom);
  assert.equal(lotDesReperes(db), null);
  db.exec('DROP TABLE repere');
  assert.throws(() => lotDesReperes(db), /0135/, 'une base d’avant la migration est refusée');
  db.close();

  // les déclarations de la table : elle part avec son mot-clé ; tant que les colonnes du mot-clé font foi, rien ne la lit (ni les textes à balises : mentions,
  // citations, contrôles ; ni la note de version)
  assert.ok(TABLES_DES_FILLES_DU_MOT_CLE.includes('repere'));
  assert.equal(estUneTableAutre('repere'), false);
});

test('le lot du script : une ligne par mot-clé sans page ni sort, copie de ses colonnes ; essai à blanc sans écriture, journal ; une ligne puis le lot s’annulent (R291)', async () => {
  const m = nouvelle();
  const { dePage, deSort } = ancrerDeuxMotsCles(m);
  const attendus = sansElement(m);
  assert.ok(attendus.length >= 2 && !attendus.includes(dePage) && !attendus.includes(deSort));

  // la ligne de commande écrit le même lot que la fonction, sur la sortie standard
  const lot = lotDeLaBase(m.chemin);
  const sortie = spawnSync(process.execPath, ['--no-warnings', SCRIPT, m.chemin], { encoding: 'utf8' });
  assert.equal(sortie.status, 0, sortie.stderr);
  assert.deepEqual(JSON.parse(sortie.stdout), lot);
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT], { encoding: 'utf8' }).status, 2, 'sans base : usage');
  assert.deepEqual(lot.operations.map((o) => o.cle.mot_cle_id), attendus);
  assert.ok(lot.operations.every((o) => o.table === 'repere' && o.operation === 'inserer'));

  const applique = await appliquer(m, lot);
  assert.equal(applique.operations, attendus.length);
  assert.deepEqual(reperes(m), attendus);
  assert.deepEqual(ecarts(m), [], 'chaque repère est la copie des colonnes de son mot-clé');
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('repere')"), []);
  assert.equal(m.un("SELECT count(*) AS n FROM modification WHERE table_nom = 'repere' AND operation = 'inserer' AND lot_id = ?", applique.lot_id).n, attendus.length);
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', applique.lot_id), { nature: lot.nature, decision: lot.decision });
  assert.equal(lotDeLaBase(m.chemin), null, 'chaque mot-clé sans élément a son repère : plus rien à poser');

  // une ligne s'annule seule : son repère part, les autres restent
  const { lignes } = ok(await m.appel('GET', adresse(applique.id)));
  assert.equal(lignes.length, attendus.length);
  assert.ok(lignes.every((l) => l.genre === 'inserer' && l.etat === 'en_place' && l.annulable_seule), JSON.stringify(lignes.find((l) => !l.annulable_seule)));
  const rang = lot.operations.findIndex((o) => o.cle.mot_cle_id === attendus[1]);
  const apres = ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[rang].n}/annuler/`), {}));
  assert.equal(apres.etat, 'applique');
  assert.deepEqual(reperes(m), attendus.filter((id) => id !== attendus[1]));

  // puis le lot entier : plus aucun repère, les mots-clés sont intacts
  const motsCles = m.un('SELECT count(*) AS n FROM mot_cle').n;
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(annule.etat, 'annule');
  assert.deepEqual(reperes(m), []);
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle').n, motsCles);
  m.db.close();
});

test('refus : le repère d’un mot-clé que désigne une page ou un sort, ou d’un mot-clé qui n’existe pas (409, sans numéro de décision) ; rien n’entre', async () => {
  const m = nouvelle();
  const { dePage, deSort } = ancrerDeuxMotsCles(m);
  const [libre] = sansElement(m);
  const absent = m.un('SELECT max(id) AS id FROM mot_cle').id + 1000;
  assert.equal(refusDuRepere(m.db, 'repere', { mot_cle_id: libre }), null);
  assert.equal(refusDuRepere(m.db, 'mot_cle_synonyme', { mot_cle_id: dePage }), null, 'la règle ne vaut que pour la table des repères');
  const messages = new Set();
  for (const id of [dePage, deSort, absent]) {
    const message = refusDuRepere(m.db, 'repere', { mot_cle_id: id });
    assert.equal(typeof message, 'string', `mot-clé ${id}`);
    assert.deepEqual(decisionsCitees(message), [], 'le refus ne cite aucune décision : une session Créateur ne l’ouvre pas');
    messages.add(message.replaceAll(String(id), ''));
    const lot = unLot([{ table: 'repere', cle: { mot_cle_id: id }, operation: 'inserer', apres: { mot_cle_id: id, nom: 'Repère d’essai', adresse: null, definition: null, couleur: null, icone: null } }]);
    const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
    assert.equal(proposition.verdict, 'a_corriger', `mot-clé ${id}`);
    assert.equal(proposition.essai.operations[0].etat, 'refusee');
    assert.equal(proposition.essai.operations[0].statut, 409);
    assert.ok(proposition.essai.operations[0].message.includes(message), 'le message du service est rendu tel quel');
    assert.deepEqual(proposition.essai.verrous_a_ouvrir ?? [], []);
    ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), { verrous_ouverts: ['R218', 'R219', 'R232', 'R309'] }), 409);
  }
  assert.equal(messages.size, 3, 'trois refus distincts : une page, un sort, un mot-clé absent');
  assert.deepEqual(reperes(m), []);
  m.db.close();
});

test('un lot modifie et supprime des repères ; annuler une suppression remet le repère, sauf si le mot-clé a reçu une page entre-temps', async () => {
  const m = nouvelle();
  const [a, b, c] = sansElement(m);
  await appliquer(m, unLot([insertion(m, a), insertion(m, b), insertion(m, c)]));
  assert.deepEqual(reperes(m), [a, b, c]);

  const definition = `Définition d’essai ${process.pid}`;
  const avant = { [b]: repere(m, b), [c]: repere(m, c) };
  const applique = await appliquer(m, unLot([
    { table: 'repere', cle: { mot_cle_id: a }, operation: 'modifier', avant: { definition: repere(m, a).definition }, apres: { definition } },
    { table: 'repere', cle: { mot_cle_id: b }, operation: 'supprimer', avant: avant[b] },
    { table: 'repere', cle: { mot_cle_id: c }, operation: 'supprimer', avant: avant[c] },
  ]));
  assert.equal(repere(m, a).definition, definition);
  assert.notEqual(m.un('SELECT description FROM mot_cle WHERE id = ?', a).description, definition, 'le repère seul est écrit : les colonnes du mot-clé ne changent pas');
  assert.deepEqual(reperes(m), [a]);

  // les lignes du lot, dans l'ordre de ses opérations : la suppression de b s'annule seule, son repère revient à l'identique
  const { lignes } = ok(await m.appel('GET', adresse(applique.id)));
  assert.deepEqual(lignes.map((l) => l.genre), ['modifier', 'supprimer', 'supprimer']);
  ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[1].n}/annuler/`), {}));
  assert.deepEqual(repere(m, b), avant[b]);

  // c reçoit une page : son repère ne revient pas (409), ni par sa ligne ni avec le lot entier
  m.db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = (SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(c);
  ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[2].n}/annuler/`), {}), 409);
  ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}), 409);
  assert.deepEqual(reperes(m), [a, b], 'un mot-clé qui a reçu une page ne retrouve pas son repère');
  assert.equal(repere(m, a).definition, definition, 'une annulation refusée n’écrit rien');
  m.db.close();
});

test('un mot-clé supprimé emporte son repère, noté au journal avant sa ligne', async () => {
  const m = nouvelle();
  // un mot-clé d'essai, nu (hors route : sans page de notion), que rien ne cite
  const id = ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: `Zq repère d’essai ${process.pid}` } }], 'regles/glossaire/')).crees[0].id;
  await appliquer(m, unLot([insertion(m, id)]));
  assert.equal(repere(m, id).nom, m.un('SELECT libelle FROM mot_cle WHERE id = ?', id).libelle);
  ok(await m.appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id }, forcer: true }] }));
  assert.equal(m.un('SELECT 1 AS x FROM mot_cle WHERE id = ?', id), undefined);
  assert.equal(repere(m, id), undefined);
  const retrait = (table, cle) => m.un("SELECT lot_id, rang FROM modification WHERE operation = 'supprimer' AND table_nom = ? AND cle = ?", table, JSON.stringify(cle));
  const [duRepere, duMotCle] = [retrait('repere', { mot_cle_id: id }), retrait('mot_cle', { id })];
  assert.ok(duRepere && duMotCle, 'les deux retraits sont au journal (la cascade du schéma ne retire rien hors du journal)');
  assert.equal(duRepere.lot_id, duMotCle.lot_id);
  assert.ok(duRepere.rang < duMotCle.rang, 'le repère d’abord');
  m.db.close();
});

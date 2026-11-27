// Le service des lots de changements (lot 6 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Lots de changements » ; serveur/edition-lots.mjs) :
//   - une session DÉPOSE une proposition avec la clé de lecture : rien n'est écrit dans le contenu ; un Créateur l'applique ou la refuse (session Discord) ;
//   - l'essai à blanc se fait sur une COPIE de la base (la base vivante est inchangée, la copie supprimée), avec les contrôles du contenu de `db:check` ;
//   - l'application écrit d'un bloc par le service d'édition, un lot du journal de la nature du lot, ses modifications « en attente » comme une saisie ;
//   - une valeur changée entre-temps n'est pas écrite (le site prime) : listée, avec la valeur trouvée ;
//   - un refus dit l'opération à corriger ; ce qu'une décision verrouille ne s'ouvre qu'avec le numéro donné au clic ; un numéro n'est jamais redonné ;
//   - le lot reste éteint hors des tables de l'édition ; l'édition ordinaire ne change pas.
// Aucune valeur de règle n'est figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { poserLAcces as poserLAccesCommun } from './aide-acces-d-essai.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { raisonDuGel } from '../serveur/edition.mjs';
import { decisionsCitees, plusHautNumero, purgerLesEssais, traduire } from '../serveur/edition-lots.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-lots');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

/** Une base vivante neuve (règles de l'import) et le service qui l'écrit ; l'essai tourne dans le fil du service (sauf `enArrierePlan`). */
function nouvelle({ enArrierePlan = false, acces = null } = {}) {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan }, ...(acces ? { acces } : {}) };
  const appel = async (methode, adresse, corps, entetes = {}) =>
    traiter({ methode, chemin: adresse, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  return { db, chemin, service, appel, un };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const refus = (r, statut) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};

const metiers = (db, k) => db.prepare('SELECT id, description FROM metier ORDER BY id LIMIT ?').all(k).map((m) => ({ ...m }));
const texteDuTest = (marque) => `Texte posé par l’essai ${marque} ${process.pid}`;
const modifierUnMetier = (m, texte) => ({ table: 'metier', cle: { id: m.id }, operation: 'modifier', avant: { description: m.description }, apres: { description: texte } });
const unLot = (operations, plus = {}) => ({ format: 'maverick-lot/1', titre: `Lot d’essai ${(n += 1)}`, nature: 'code', operations, ...plus });
const deposer = async (m, lot, statut = 201) => ok(await m.appel('POST', '/api/edition/lots/', lot), statut);
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const comptes = (db) => ({
  lots: db.prepare('SELECT count(*) AS n FROM modification_lot').get().n,
  modifications: db.prepare('SELECT count(*) AS n FROM modification').get().n,
  propositions: db.prepare('SELECT count(*) AS n FROM lot_de_changements').get().n,
});

test('déposer avec la clé de lecture : une proposition est enregistrée et essayée, rien n’est écrit dans le contenu ; appliquer demande une session Créateur (R275)', async () => {
  const a = poserLAccesCommun({ prefixe: 'edition-lots' });
  const m = nouvelle({ acces: a.acces });
  const avecCle = a.avecCle;
  const avecCreateur = a.createur;
  const [metier] = metiers(m.db, 1);
  const avant = comptes(m.db);
  const texte = texteDuTest('clé');

  // sans rien : fermé ; avec la clé : le dépôt passe
  refus(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(metier, texte)])), 401);
  const lot = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(metier, texte)]), avecCle), 201);
  assert.equal(lot.etat, 'propose');
  assert.equal(lot.verdict, 'applicable');
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', metier.id).description, metier.description, 'le contenu n’a pas changé');
  assert.deepEqual({ ...comptes(m.db), propositions: 0 }, { ...avant, propositions: 0 }, 'ni lot du journal ni modification');
  assert.equal(comptes(m.db).propositions, avant.propositions + 1);

  // la clé lit, refait l'essai ; elle n'applique ni ne refuse
  ok(await m.appel('GET', '/api/edition/lots/', undefined, avecCle));
  assert.equal(ok(await m.appel('GET', adresse(lot.id), undefined, avecCle)).id, lot.id);
  ok(await m.appel('POST', adresse(lot.id, 'essai/'), {}, avecCle));
  assert.equal(refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}, avecCle), 403).acces, 'cle');
  assert.equal(refus(await m.appel('POST', adresse(lot.id, 'refuser/'), {}, avecCle), 403).acces, 'cle');
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', metier.id).description, metier.description);

  // le clic d’un Créateur écrit
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}, avecCreateur));
  assert.equal(applique.etat, 'applique');
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', metier.id).description, texte);
});

test('l’essai se fait sur une copie : la base vivante est inchangée et la copie est supprimée ; l’essai est refait à la demande', async () => {
  const m = nouvelle();
  const [metier] = metiers(m.db, 1);
  const avant = comptes(m.db);
  const lot = await deposer(m, unLot([modifierUnMetier(metier, texteDuTest('copie'))]));
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', metier.id).description, metier.description);
  assert.deepEqual({ ...comptes(m.db), propositions: 0 }, { ...avant, propositions: 0 });
  const dossier = join(dirname(m.chemin), 'essais');
  assert.deepEqual(existsSync(dossier) ? readdirSync(dossier) : [], [], 'aucune copie ne reste');
  // l'essai porte l'aperçu avant et après, par les noms lisibles
  const [op] = lot.essai.operations;
  assert.equal(op.etat, 'applicable');
  assert.equal(op.apercu.colonnes.length, 1);
  assert.equal(op.apercu.colonnes[0].avant, metier.description);
  assert.equal(op.apercu.colonnes[0].apres, texteDuTest('copie'));
  assert.ok(op.apercu.colonnes[0].libelle && op.apercu.colonnes[0].libelle !== 'description', 'la colonne par son libellé');
  assert.ok(op.apercu.table && op.apercu.table !== 'metier', 'la table par son nom');
  // refaire l'essai : n'écrit que l'essai
  const premier = lot.essaye_le;
  const refait = ok(await m.appel('POST', adresse(lot.id, 'essai/'), {}));
  assert.ok(refait.essaye_le >= premier);
  assert.deepEqual({ ...comptes(m.db), propositions: 0 }, { ...avant, propositions: 0 });
});

test('l’essai tourne aussi dans un fil à part (le service ne s’arrête pas) et rend le même verdict', async () => {
  const m = nouvelle({ enArrierePlan: true });
  const [metier] = metiers(m.db, 1);
  const lot = await deposer(m, unLot([modifierUnMetier(metier, texteDuTest('fil'))]));
  assert.equal(lot.verdict, 'applicable');
  assert.equal(lot.essai.comptes.applicables, 1);
  const dossier = join(dirname(m.chemin), 'essais');
  assert.deepEqual(existsSync(dossier) ? readdirSync(dossier) : [], []);
});

test('un lot mal formé est refusé au dépôt, avec le rang de l’opération à corriger ; rien n’est enregistré', async () => {
  const m = nouvelle();
  const [metier] = metiers(m.db, 1);
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', '/api/edition/lots/', unLot([
    modifierUnMetier(metier, texteDuTest('ok')),
    { table: 'metier', cle: { id: metier.id }, operation: 'modifier', avant: { colonne_inconnue: 1 }, apres: { colonne_inconnue: 2 } },
  ])), 400);
  assert.match(r.erreur, /opération 2/);
  assert.ok(r.erreurs.some((e) => e.rang === 2));
  assert.deepEqual(comptes(m.db), avant);
  // un en-tête sans titre, une nature « saisie » : refusés
  refus(await m.appel('POST', '/api/edition/lots/', { nature: 'code', operations: [modifierUnMetier(metier, 'x')] }), 400);
  refus(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(metier, 'x')], { nature: 'saisie' })), 400);
});

test('le lot reste éteint hors des tables de l’édition (jusqu’au lot 8) : dépôt refusé, message clair', async () => {
  const m = nouvelle();
  const avant = comptes(m.db);
  const synonyme = { table: 'mot_cle_synonyme', cle: { id: 99999 }, operation: 'inserer', apres: { id: 99999, mot_cle_id: 1, libelle: 'Zqx', libelle_cle: 'zqx', ordre: 0 } };
  const r = refus(await m.appel('POST', '/api/edition/lots/', unLot([synonyme])), 400);
  assert.match(r.erreur, /lot 8/);
  assert.deepEqual(comptes(m.db), avant);
  // une table de trace
  refus(await m.appel('POST', '/api/edition/lots/', unLot([{ table: 'note_version', cle: { version: '0' }, operation: 'supprimer', avant: {} }])), 400);
});

test('l’application écrit d’un bloc par le service d’édition : un lot du journal de la nature du lot, ses modifications « en attente », la proposition « applique »', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))], { nature: 'decision', decision: 'R275', auteur: 'une session' }));
  assert.equal(lot.nature, 'decision');
  assert.equal(lot.decision, 'R275');
  assert.equal(lot.auteur, 'une session');
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  assert.equal(applique.bilan.ecrites, 2);
  assert.deepEqual(applique.bilan.changees, 0);
  assert.equal(applique.verrous_ouverts, null);
  assert.ok(applique.decide_le && applique.lot_id);
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', a.id).description, texteDuTest('a'));
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', b.id).description, texteDuTest('b'));
  // le journal : un lot à la nature, au numéro de décision et au titre du lot ; ses modifications attendent le rapatriement comme une saisie
  const journal = m.un('SELECT nature, decision, resume FROM modification_lot WHERE id = ?', applique.lot_id);
  assert.deepEqual(journal, { nature: 'decision', decision: 'R275', resume: lot.titre });
  const lignes = m.db.prepare('SELECT table_nom, etat FROM modification WHERE lot_id = ?').all(applique.lot_id);
  assert.ok(lignes.length >= 2);
  assert.ok(lignes.every((l) => l.etat === 'en_attente'));
  assert.ok(lignes.some((l) => l.table_nom === 'metier'));
  // une proposition appliquée ne se réapplique, ne se refuse ni ne s'essaie plus
  for (const suite of ['appliquer/', 'refuser/', 'essai/']) refus(await m.appel('POST', adresse(lot.id, suite), {}), 409);
});

test('une colonne que le service ne sait pas écrire, sur une table qu’il connaît, passe par le journal (voie générique) dans la même opération du lot', async () => {
  const m = nouvelle();
  const metier = m.un('SELECT id, description, test_brut FROM metier ORDER BY id LIMIT 1');
  const texte = texteDuTest('mixte');
  const generique = texteDuTest('générique');
  const lot = await deposer(m, unLot([{ table: 'metier', cle: { id: metier.id }, operation: 'modifier',
    avant: { description: metier.description, test_brut: metier.test_brut }, apres: { description: texte, test_brut: generique } }]));
  assert.equal(lot.verdict, 'applicable', JSON.stringify(lot.essai.operations.map((o) => o.message)));
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  const ligne = m.un('SELECT description, test_brut FROM metier WHERE id = ?', metier.id);
  assert.deepEqual(ligne, { description: texte, test_brut: generique });
  const noms = m.db.prepare("SELECT apres FROM modification WHERE lot_id = ? AND table_nom = 'metier'").all(applique.lot_id).map((l) => Object.keys(JSON.parse(l.apres)));
  assert.ok(noms.flat().includes('test_brut') && noms.flat().includes('description'));
});

test('une valeur changée entre-temps n’est pas écrite : elle est listée avec la valeur trouvée, le site prime ; le reste est écrit', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('perdu')), modifierUnMetier(b, texteDuTest('gagne'))]));
  assert.equal(lot.verdict, 'applicable');
  // le site (le propriétaire) modifie la ligne a après le dépôt, par l'édition ordinaire
  const duSite = texteDuTest('du site');
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: duSite } }] }));
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', a.id).description, duSite, 'le site prime');
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', b.id).description, texteDuTest('gagne'));
  assert.equal(applique.bilan.ecrites, 1);
  assert.equal(applique.bilan.changees, 1);
  const changee = applique.bilan.operations.find((o) => o.etat === 'changee');
  assert.equal(changee.rang, 1);
  assert.deepEqual(changee.ecarts, [{ colonne: 'description', attendue: a.description, actuelle: duSite }]);
});

test('toutes les opérations changées entre-temps : rien à écrire, 409, le lot reste proposé', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('seul'))]));
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('autre') } }] }));
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.match(r.erreur, /Rien à écrire/);
  assert.deepEqual(comptes(m.db), avant, 'ni lot du journal ni modification');
  assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', lot.id).etat, 'propose');
  // l'essai refait le dit : changée entre-temps
  const refait = ok(await m.appel('POST', adresse(lot.id, 'essai/'), {}));
  assert.equal(refait.essai.operations[0].etat, 'changee');
  assert.equal(refait.verdict, 'rien_a_ecrire');
});

test('une opération refusée : l’essai la marque avec son rang et son message, l’application est refusée et n’écrit rien (pas même les autres opérations)', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  // la base refuse cette valeur (CHECK : un métier qu'on fabrique a son texte d'artisanat) ; le service dit pourquoi
  const peutFabriquer = m.un('SELECT peut_fabriquer AS v FROM metier WHERE id = ?', b.id).v;
  const mauvais = { table: 'metier', cle: { id: b.id }, operation: 'modifier', avant: { peut_fabriquer: peutFabriquer }, apres: { peut_fabriquer: 1 - peutFabriquer } };
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('bon')), mauvais]));
  assert.equal(lot.verdict, 'a_corriger');
  const refusee = lot.essai.operations.find((o) => o.etat === 'refusee');
  assert.equal(refusee.rang, 2);
  assert.ok(refusee.message);
  assert.equal(lot.essai.operations[0].etat, 'applicable', 'une opération refusée n’arrête pas le jugement des autres');
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.match(r.erreur, /opération 2/);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', a.id).description, a.description);
  assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', lot.id).etat, 'propose');
});

test('une opération que le service accepte sans rien écrire (valeur ramenée à celle en place) est refusée à l’essai : ce n’est pas ce que le lot demandait', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const lot = await deposer(m, unLot([{ table: 'metier', cle: { id: a.id }, operation: 'modifier', avant: { test_carac_1_id: null }, apres: { test_carac_1_id: 'une-caracteristique-qui-n-existe-pas' } }]));
  assert.equal(lot.verdict, 'a_corriger');
  assert.match(lot.essai.operations[0].message, /rien écrit/);
});

test('l’application refait le jugement au clic : une opération refusée alors (l’essai était bon) arrête tout, rien n’est écrit, la proposition reste proposée', async () => {
  const m = nouvelle();
  const [a, b, c] = metiers(m.db, 3);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('premier')), modifierUnMetier(b, texteDuTest('second'))]));
  assert.equal(lot.verdict, 'applicable');
  // la base se met à refuser la seconde valeur après l'essai (une autre ligne la porte, sous un index unique)
  m.db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(texteDuTest('second'), c.id);
  m.db.exec('CREATE UNIQUE INDEX refus_d_essai ON metier (description)');
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.match(r.erreur, /Opération 2 refusée/);
  assert.equal(r.rang, 2);
  assert.deepEqual(comptes(m.db), avant, 'tout ou rien : le journal ne garde rien');
  assert.equal(m.un('SELECT description FROM metier WHERE id = ?', a.id).description, a.description, 'la première opération non plus n’est pas écrite');
  assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', lot.id).etat, 'propose');
  // l'essai refait voit le refus
  m.db.exec('DROP INDEX refus_d_essai');
});

test('un problème du contenu qui naît du lot (db:check) fait refuser l’essai ; ceux d’avant le lot ne comptent pas', async () => {
  const m = nouvelle();
  const metier = m.un('SELECT id, nom, nom_cle FROM metier ORDER BY id LIMIT 1');
  const lot = await deposer(m, unLot([{ table: 'metier', cle: { id: metier.id }, operation: 'modifier', avant: { nom_cle: metier.nom_cle }, apres: { nom_cle: 'une-cle-qui-n-est-pas-celle-du-nom' } }]));
  assert.equal(lot.verdict, 'a_corriger');
  assert.ok(lot.essai.problemes_nouveaux.length >= 1);
  assert.ok(lot.essai.problemes_nouveaux.some((p) => p.includes('nom_cle')));
  // les problèmes d'avant (la base d'import en a) sont gardés à part, jamais comptés comme nés du lot
  assert.ok(Array.isArray(lot.essai.problemes_avant));
  const ancien = await deposer(m, unLot([modifierUnMetier(...metiers(m.db, 1), texteDuTest('propre'))]));
  assert.deepEqual(ancien.essai.problemes_nouveaux, []);
  refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.equal(m.un('SELECT nom_cle FROM metier WHERE id = ?', metier.id).nom_cle, metier.nom_cle);
});

test('le service crée lui-même les lignes de ses tables : l’insertion d’un lot y est refusée à l’essai (rang), jamais écrite en douce', async () => {
  const m = nouvelle();
  const lot = await deposer(m, unLot([{ table: 'categorie_mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle: 'Catégorie d’essai', libelle_cle: 'categorie-d-essai' } }]));
  const id = lot.essai.numeros[0].numero;
  assert.equal(lot.verdict, 'a_corriger');
  assert.equal(lot.essai.operations[0].etat, 'refusee');
  assert.match(lot.essai.operations[0].message, /crée lui-même/);
  assert.equal(m.un('SELECT count(*) AS n FROM categorie_mot_cle WHERE id = ?', id).n, 0);
});

test('R219 : ce que le service refuse au nom d’une décision est « verrouillé » à l’essai ; refusé à l’application sauf si son numéro est donné au clic, qui est enregistré ; l’édition ordinaire reste fermée', async () => {
  const m = nouvelle();
  const monnaie = m.un('SELECT id, remarque FROM monnaie ORDER BY id LIMIT 1');
  const citees = decisionsCitees(raisonDuGel('monnaie', monnaie));
  assert.ok(citees.length >= 1, 'le gel de l’onglet Monnaie cite sa décision');
  const texte = texteDuTest('monnaie');
  const lot = await deposer(m, unLot([{ table: 'monnaie', cle: { id: monnaie.id }, operation: 'modifier', avant: { remarque: monnaie.remarque }, apres: { remarque: texte } }]));
  assert.equal(lot.verdict, 'verrous');
  assert.equal(lot.essai.operations[0].etat, 'verrouillee');
  assert.deepEqual(lot.essai.operations[0].decisions, citees);
  assert.deepEqual(lot.essai.verrous_a_ouvrir, citees);
  // sans le numéro, ou avec un autre : refusé, rien n'est écrit
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.deepEqual(r.verrous, citees);
  refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), { verrous_ouverts: ['R1'] }), 409);
  refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), { verrous_ouverts: 'R219' }), 400);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(m.un('SELECT remarque FROM monnaie WHERE id = ?', monnaie.id).remarque, monnaie.remarque);
  // avec le numéro : écrit, et le numéro ouvert est enregistré
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), { verrous_ouverts: citees }));
  assert.deepEqual(applique.verrous_ouverts, citees);
  assert.deepEqual(applique.bilan.verrous_ouverts, citees);
  assert.equal(m.un('SELECT remarque FROM monnaie WHERE id = ?', monnaie.id).remarque, texte);
  // l'ouverture ne vaut que pour ce lot : l'édition ordinaire refuse toujours la monnaie (409)
  refus(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'monnaie', cle: { id: monnaie.id }, valeurs: { abreviation: 'x' } }] }), 409);
});

test('R218 : une écriture générique de mot_cle.verrou (colonne que le service tient lui-même) est verrouillée à l’essai, refusée sans le numéro au clic, écrite avec lui', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id, verrou FROM mot_cle WHERE verrou = 0 ORDER BY id LIMIT 1');
  const lot = await deposer(m, unLot([{ table: 'mot_cle', cle: { id: motCle.id }, operation: 'modifier', avant: { verrou: 0 }, apres: { verrou: 1 } }]));
  assert.equal(lot.verdict, 'verrous', JSON.stringify(lot.essai.operations.map((o) => o.message)));
  assert.equal(lot.essai.operations[0].etat, 'verrouillee');
  assert.ok(lot.essai.verrous_a_ouvrir.includes('R218'));
  refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  assert.equal(m.un('SELECT verrou FROM mot_cle WHERE id = ?', motCle.id).verrou, 0);
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), { verrous_ouverts: lot.essai.verrous_a_ouvrir }));
  assert.ok(applique.verrous_ouverts.includes('R218'));
  assert.equal(m.un('SELECT verrou FROM mot_cle WHERE id = ?', motCle.id).verrou, 1);
});

test('le titre d’un lot est un résumé comme un autre : un marqueur de suppression forcée qu’il porterait est neutralisé (le rejeu le lirait)', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('marqueur'))], { titre: '[suppression forcée R223 : 1] titre d’essai' }));
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  const resume = m.un('SELECT resume FROM modification_lot WHERE id = ?', applique.lot_id).resume;
  assert.ok(!resume.includes('[suppression forcée'), resume);
});

test('les copies d’essai qu’un arrêt a laissées sont supprimées à l’ouverture du service, rien d’autre', async () => {
  const dossier = join(racine, 'purge');
  mkdirSync(join(dossier, 'essais'), { recursive: true });
  const copie = join(dossier, 'essais', `essai-123-${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}.db`);
  const autre = join(dossier, 'essais', 'autre.txt');
  writeFileSync(copie, 'x');
  writeFileSync(autre, 'x');
  assert.equal(purgerLesEssais(dossier), 1);
  assert.deepEqual(readdirSync(join(dossier, 'essais')), ['autre.txt']);
  assert.equal(purgerLesEssais(join(racine, 'absent')), 0, 'sans dossier d’essais : rien à faire');
});

test('refuser : la proposition passe à « refuse », rien n’est écrit, elle reste lisible ; un lot refusé ne s’applique plus', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const lot = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('refuse'))]));
  const avant = comptes(m.db);
  const refuse = ok(await m.appel('POST', adresse(lot.id, 'refuser/'), {}));
  assert.equal(refuse.etat, 'refuse');
  assert.ok(refuse.decide_le);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(ok(await m.appel('GET', adresse(lot.id))).etat, 'refuse');
  refus(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}), 409);
  const liste = ok(await m.appel('GET', '/api/edition/lots/')).lots;
  assert.ok(liste.some((l) => l.id === lot.id && l.etat === 'refuse'));
  assert.ok(liste.every((l) => !('contenu' in l) && !('essai' in l)), 'la liste est un résumé');
  refus(await m.appel('GET', adresse('00000000-0000-4000-8000-000000000000')), 404);
  refus(await m.appel('GET', '/api/edition/lots/pas-un-lot/'), 404);
});

test('hors du site de dev, les lots répondent 403 avant tout', async () => {
  const m = nouvelle();
  const prod = { ...m.service, edition: false };
  for (const [methode, chemin] of [['GET', '/api/edition/lots/'], ['POST', '/api/edition/lots/'], ['POST', adresse('00000000-0000-4000-8000-000000000000', 'appliquer/')]]) {
    assert.equal(traiter({ methode, chemin, entetes: JSON_, corps: '{}' }, prod).statut, 403, `${methode} ${chemin}`);
  }
});

test('l’édition ordinaire ne change pas : sa saisie reste une « saisie », et les opérations du lot ne sont joignables par aucune route d’édition', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const r = ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('saisie') } }] }));
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', r.lot), { nature: 'saisie', decision: null });
  for (const op of ['ecrire_modifier', 'ecrire_inserer', 'ecrire_supprimer']) {
    const refusee = refus(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op, table: 'metier', cle: { id: a.id }, valeurs: { peut_fabriquer: 0 } }] }), 400);
    assert.match(refusee.erreur, /opération inconnue/);
  }
  // un corps de requête ne donne ni nature ni décision à un lot de l'édition
  const avecNature = ok(await m.appel('POST', '/api/edition/', { page: 'essai', nature: 'decision', decision: 'R1', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('saisie 2') } }] }));
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', avecNature.lot), { nature: 'saisie', decision: null });
});

test('numéros : un numéro est donné à l’application (1 + le plus haut connu), jamais redonné — ni après une suppression, ni sans les traces, ni sans le plafond (base restaurée)', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id FROM mot_cle ORDER BY id LIMIT 1').id;
  let compteur = 0;
  /** Un lot qui insère deux synonymes dont les numéros sont à donner (table hors édition : ouverte par l'option de test, jamais par une route). */
  const lotDeSynonymes = () => {
    compteur += 1;
    const ligne = (jeton, libelle) => ({ table: 'mot_cle_synonyme', cle: { id: { $numero: jeton } }, operation: 'inserer',
      apres: { id: { $numero: jeton }, mot_cle_id: motCle, libelle, libelle_cle: libelle.toLowerCase().replaceAll(' ', '-'), ordre: 90 + compteur } });
    return unLot([ligne('a', `Qzxw essai ${compteur} a`), ligne('b', `Qzxw essai ${compteur} b`)]);
  };
  const { deposer: deposerLot } = await import('../serveur/edition-lots.mjs');
  const appliquerUn = async () => {
    const proposition = await deposerLot(() => m.db, lotDeSynonymes(), { enArrierePlan: false, controle: { ouvertHorsEdition: true } });
    assert.equal(proposition.verdict, 'applicable', JSON.stringify(proposition.essai.operations.map((o) => o.message ?? o.etat)));
    const r = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
    return { proposition, numeros: r.bilan.numeros.map((x) => x.numero) };
  };

  const plafondAvant = plusHautNumero(m.db, 'mot_cle_synonyme', 'id');
  const un = await appliquerUn();
  assert.deepEqual(un.numeros, [plafondAvant + 1, plafondAvant + 2], 'deux numéros consécutifs, après le plus haut connu');
  assert.deepEqual(un.proposition.essai.numeros.map((x) => x.numero), un.numeros, 'l’essai annonçait les mêmes numéros (provisoires)');
  assert.equal(m.un("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle_synonyme' AND colonne = 'id'").plafond, un.numeros[1]);
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id IN (?, ?)', ...un.numeros).n, 2);

  // 1. les lignes disparaissent (un lot annulé : la suite du chantier) : le numéro suivant ne les reprend pas
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id IN (?, ?)').run(...un.numeros);
  const deux = await appliquerUn();
  assert.ok(Math.min(...deux.numeros) > un.numeros[1], `${deux.numeros} après ${un.numeros}`);

  // 2. sans les traces du journal : le plafond tient
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id IN (?, ?)').run(...deux.numeros);
  m.db.exec("DELETE FROM modification WHERE table_nom = 'mot_cle_synonyme'");
  const trois = await appliquerUn();
  assert.ok(Math.min(...trois.numeros) > deux.numeros[1], `${trois.numeros} après ${deux.numeros}`);

  // 3. base restaurée sans `numero_donne` (la table est vide) : les traces du journal tiennent
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id IN (?, ?)').run(...trois.numeros);
  m.db.exec('DELETE FROM numero_donne');
  const quatre = await appliquerUn();
  assert.ok(Math.min(...quatre.numeros) > trois.numeros[1], `${quatre.numeros} après ${trois.numeros}`);
  assert.equal(m.un("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle_synonyme'").plafond, quatre.numeros[1], 'le plafond est remonté dans la même transaction');
});

test('traduire : le service d’édition pour ce qu’il sait écrire, la voie générique pour le reste, aucune insertion dans ce qu’il crée, aucune suppression de ce qu’il ne supprime pas', () => {
  const cle = { id: 'x' };
  // une colonne du modèle et une autre de la même ligne : deux écritures, le service d'abord
  const { ops } = traduire({ table: 'metier', cle, operation: 'modifier', avant: { description: 'a', peut_fabriquer: 1 }, apres: { description: 'b', peut_fabriquer: 0 } });
  assert.deepEqual(ops.map((o) => o.op), ['modifier', 'ecrire_modifier']);
  assert.deepEqual(Object.keys(ops[0].valeurs), ['description']);
  assert.deepEqual(Object.keys(ops[1].valeurs), ['peut_fabriquer']);
  // une table sans entité : suppression et insertion génériques
  assert.deepEqual(traduire({ table: 'magie_role', cle: { magie_id: 'm', rang: 1 }, operation: 'supprimer', avant: {} }).ops.map((o) => o.op), ['ecrire_supprimer']);
  assert.deepEqual(traduire({ table: 'magie_role', cle: { magie_id: 'm', rang: 1 }, operation: 'inserer', apres: {} }).ops.map((o) => o.op), ['ecrire_inserer']);
  // une table que le service crée : pas d'insertion ; la suppression passe par son entité quand elle en a une
  assert.ok(traduire({ table: 'metier', cle, operation: 'inserer', apres: { id: 'x' } }).refus);
  assert.deepEqual(traduire({ table: 'metier', cle, operation: 'supprimer', avant: {} }).ops.map((o) => [o.op, o.entite]), [['supprimer', 'metier']]);
  // une entité sans suppression (familles d'armes, R159) : refusée
  assert.ok(traduire({ table: 'arme_famille', cle, operation: 'supprimer', avant: {} }).refus);
  assert.deepEqual(decisionsCitees('verrouillé (décisions R218, R219) et R218 encore ; pas R ni R2x'), ['R218', 'R219']);
});

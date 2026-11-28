// « Annuler ce lot » et « tout recalculer » (lot 6 du chantier de la base de dev, R274, R275, garde-fous 10 et 11 ; docs/serveur.md, « Lots de changements » ;
// serveur/edition-lots.mjs#annuler, #previsualiserLAnnulation, #recalculerTout) :
//   - l'aperçu de l'annulation se calcule sur une COPIE (la base est inchangée) ; le clic remet `avant` seulement là où la valeur vaut encore ce que le lot a
//     écrit (le site prime : une valeur changée depuis est gardée, listée avec la valeur trouvée), d'un bloc, par le service d'édition ;
//   - une ligne créée par le lot n'est supprimée que si elle vaut encore, en entier, ce qu'il a inséré ; une ligne qu'il a retirée n'est réinsérée que si elle est absente ;
//   - le lot du journal d'annulation porte la nature et le numéro de décision du lot annulé ; un numéro donné n'est jamais rendu ;
//   - rien à remettre : refus, le lot reste appliqué ; les verrous de décision se rouvrent au clic ;
//   - « tout recalculer » DÉPOSE les écarts des colonnes dérivées comme un lot de nature « code » : rien n'entre sans le clic du propriétaire.
// Aucune valeur de règle figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-annulation.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { poserLAcces as poserLAccesCommun } from './aide-acces-d-essai.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { deposer as deposerLot, traduire } from '../serveur/edition-lots.mjs';
import { ligneDArme, PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';
import { pageDeLaLigne as pageDesArmuresDeLaLigne } from '../src/lib/corps-armures.mjs';
import { PAGE_DE_L_INVENTAIRE, PAGE_DES_INGREDIENTS } from '../src/lib/corps-composants.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';

const racine = dossierTemporaire('edition-lots-annulation');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

/** Une base vivante neuve (règles de l'import) et le service qui l'écrit ; l'essai et l'aperçu tournent dans le fil du service (sauf `enArrierePlan`). */
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
const description = (m, id) => m.un('SELECT description FROM metier WHERE id = ?', id).description;
const texteDuTest = (marque) => `Texte posé par l’annulation ${marque} ${process.pid}`;
const modifierUnMetier = (m, texte) => ({ table: 'metier', cle: { id: m.id }, operation: 'modifier', avant: { description: m.description }, apres: { description: texte } });
const unLot = (operations, plus = {}) => ({ format: FORMAT_DU_LOT, titre: `Lot d’annulation ${(n += 1)}`, nature: 'code', operations, ...plus });
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const deposer = async (m, lot) => ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
/** Dépose puis applique d'un clic (sans porte : tout est ouvert). */
async function appliquer(m, lot, corps = {}) {
  const proposition = await deposer(m, lot);
  return ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), corps));
}
/** Pour une table que le service ne sait pas écrire : le dépôt de test ouvre `ouvertHorsEdition` (aucune route ne le donne). */
async function appliquerHorsEdition(m, lot) {
  const proposition = await deposerLot(() => m.db, lot, { enArrierePlan: false, controle: { ouvertHorsEdition: true } });
  assert.notEqual(proposition.verdict, 'a_corriger', JSON.stringify(proposition.essai.operations.map((o) => o.message ?? o.etat)));
  return ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
}
const apercu = async (m, id) => ok(await m.appel('GET', adresse(id, 'annulation/')));
const comptes = (db) => ({
  lots: db.prepare('SELECT count(*) AS n FROM modification_lot').get().n,
  modifications: db.prepare('SELECT count(*) AS n FROM modification').get().n,
});
const dump = (db, tables) => Object.fromEntries(tables.map((t) => {
  const colonnes = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => `"${c.name}"`).join(', ');
  return [t, db.prepare(`SELECT * FROM "${t}" ORDER BY ${colonnes}`).all().map((r) => ({ ...r }))];
}));
const synonyme = (motCle, libelle, id, ordre) => ({ id, mot_cle_id: motCle, libelle, libelle_cle: libelle.toLowerCase().replaceAll(' ', '-'), ordre });

test('remise : une colonne modifiée reprend sa valeur ; le lot du journal d’annulation porte la nature et la décision du lot annulé, « Annulation de … » en résumé', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const lot = unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))], { nature: 'decision', decision: 'R275', titre: '[suppression forcée R223 : 1] Un titre d’essai' });
  const applique = await appliquer(m, lot);
  assert.equal(description(m, a.id), texteDuTest('a'));

  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(description(m, a.id), a.description);
  assert.equal(description(m, b.id), b.description);
  assert.equal(annule.etat, 'annule');
  assert.ok(annule.annule_le);
  assert.ok(annule.annulation_lot_id && annule.annulation_lot_id !== annule.lot_id);
  assert.equal(annule.bilan.ecrites, 2, 'le bilan de l’application est gardé');
  assert.deepEqual([annule.bilan.annulation.remises, annule.bilan.annulation.gardees], [2, 0]);
  const journal = m.un('SELECT nature, decision, resume FROM modification_lot WHERE id = ?', annule.annulation_lot_id);
  assert.deepEqual([journal.nature, journal.decision], ['decision', 'R275'], 'même nature, même numéro de décision');
  assert.ok(journal.resume.startsWith('Annulation de « '), journal.resume);
  assert.ok(!journal.resume.includes('[suppression forcée'), 'le marqueur du titre est neutralisé, comme à l’application');
  // le service écrit aussi les pages que ces métiers dérivent : l'annulation remet les mêmes lignes que le lot, en attente comme une saisie
  const lignes = (lot) => m.db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ? AND etat = 'en_attente'").get(lot).n;
  assert.ok(lignes(annule.lot_id) >= 2);
  assert.equal(lignes(annule.annulation_lot_id), lignes(annule.lot_id), 'les mêmes lignes du journal, en sens inverse');
  // le lot est annulé : ni appliqué, ni annulé deux fois
  refus(await m.appel('POST', adresse(applique.id, 'annuler/'), {}), 409);
  refus(await m.appel('POST', adresse(applique.id, 'appliquer/'), {}), 409);
  refus(await m.appel('GET', adresse(applique.id, 'annulation/')), 409);
});

test('une valeur changée depuis (le site prime) est gardée et listée avec la valeur trouvée ; le reste est remis ; l’aperçu dit la même chose', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))]));
  // le propriétaire retouche le premier métier sur le site, après le lot
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('site') } }] }));

  const avant = comptes(m.db);
  const vu = await apercu(m, applique.id);
  assert.equal(vu.verdict, 'applicable');
  // le service avait aussi refait la page du premier métier : sa ligne est gardée avec elle, celle du second est revenue d'elle-même avec son métier
  assert.equal(vu.comptes.remises, 1);
  assert.ok(vu.comptes.gardees >= 1);
  const gardee = vu.operations.find((o) => o.etat === 'gardee' && o.table === 'metier');
  assert.deepEqual(gardee.cle, { id: a.id });
  assert.deepEqual(gardee.ecarts.map((e) => [e.colonne, e.ecrite, e.avant, e.trouvee]), [['description', texteDuTest('a'), a.description, texteDuTest('site')]]);
  const remise = vu.operations.find((o) => o.etat === 'remise');
  assert.equal(remise.table, 'metier');
  assert.equal(remise.apercu.colonnes[0].avant, texteDuTest('b'), 'avant : la valeur d’aujourd’hui');
  assert.equal(remise.apercu.colonnes[0].apres, b.description, 'après : celle que l’annulation remet');
  assert.deepEqual(comptes(m.db), avant, 'l’aperçu n’écrit rien');
  assert.equal(description(m, b.id), texteDuTest('b'), 'la base est inchangée par l’aperçu');

  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(description(m, a.id), texteDuTest('site'), 'le site prime');
  assert.equal(description(m, b.id), b.description);
  assert.equal(annule.bilan.annulation.remises, 1);
  assert.equal(annule.bilan.annulation.gardees, vu.comptes.gardees, 'le clic fait la même comparaison que l’aperçu');
  assert.equal(annule.bilan.annulation.operations.find((o) => o.etat === 'gardee' && o.table === 'metier').ecarts[0].trouvee, texteDuTest('site'));
});

test('l’aperçu se calcule sur une copie : la base vivante et le dossier des essais sont intacts, dans le fil du service comme dans un fil à part', async () => {
  for (const enArrierePlan of [false, true]) {
    const m = nouvelle({ enArrierePlan });
    const [a] = metiers(m.db, 1);
    const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest(`fil ${enArrierePlan}`))]));
    const avant = { ...comptes(m.db), plafond: m.db.prepare('SELECT count(*) AS n FROM numero_donne').get().n };
    const vu = await apercu(m, applique.id);
    assert.equal(vu.verdict, 'applicable');
    assert.equal(vu.lot, applique.id);
    assert.ok(vu.titre.startsWith('Annulation de « '));
    assert.deepEqual({ ...comptes(m.db), plafond: m.db.prepare('SELECT count(*) AS n FROM numero_donne').get().n }, avant);
    assert.equal(description(m, a.id), texteDuTest(`fil ${enArrierePlan}`));
    assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', applique.id).etat, 'applique', 'l’aperçu ne change pas l’état');
    const dossier = join(dirname(m.chemin), 'essais');
    assert.deepEqual(existsSync(dossier) ? readdirSync(dossier) : [], [], 'aucune copie ne reste');
  }
});

test('une ligne insérée par le lot n’est supprimée que si elle vaut encore, en entier, ce qu’il a inséré ; les numéros donnés ne sont jamais rendus', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id FROM mot_cle ORDER BY id LIMIT 1').id;
  const ligne = (jeton, libelle) => ({ table: 'mot_cle_synonyme', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { ...synonyme(motCle, libelle, { $numero: jeton }, 90), ordre: 90 } });
  const applique = await appliquerHorsEdition(m, unLot([ligne('a', 'Zqxw annulation un'), ligne('b', 'Zqxw annulation deux')]));
  const [un, deux] = applique.bilan.numeros.map((x) => x.numero);
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id IN (?, ?)', un, deux).n, 2);
  // le site retouche la seconde ligne depuis
  m.db.prepare('UPDATE mot_cle_synonyme SET ordre = 95 WHERE id = ?').run(deux);

  const vu = await apercu(m, applique.id);
  assert.deepEqual([vu.comptes.remises, vu.comptes.gardees], [1, 1]);
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(m.un('SELECT id FROM mot_cle_synonyme WHERE id = ?', un), undefined, 'la ligne intacte est supprimée');
  assert.ok(m.un('SELECT id FROM mot_cle_synonyme WHERE id = ?', deux), 'la ligne retouchée reste');
  const gardee = annule.bilan.annulation.operations.find((o) => o.etat === 'gardee');
  assert.deepEqual(gardee.ecarts.map((e) => [e.colonne, e.ecrite, e.trouvee]), [['ordre', 90, 95]]);

  // jamais rendus : le plafond est resté, un lot déposé ensuite reçoit des numéros plus hauts, même si les lignes sont parties
  assert.equal(m.un("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle_synonyme' AND colonne = 'id'").plafond, deux);
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id = ?').run(deux);
  const suivant = await appliquerHorsEdition(m, unLot([ligne('c', 'Zqxw annulation trois')]));
  assert.ok(suivant.bilan.numeros[0].numero > deux, `${suivant.bilan.numeros[0].numero} après ${deux}`);
});

test('une ligne retirée par le lot n’est réinsérée que si elle est encore absente, telle qu’elle était ; recréée depuis, elle est gardée', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id FROM mot_cle ORDER BY id LIMIT 1').id;
  const poser = (id, libelle) => m.db.prepare('INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre) VALUES (:id, :mot_cle_id, :libelle, :libelle_cle, :ordre)')
    .run(synonyme(motCle, libelle, id, 91));
  const retirer = (id, libelle) => ({ table: 'mot_cle_synonyme', cle: { id }, operation: 'supprimer', avant: synonyme(motCle, libelle, id, 91) });
  const ids = [980001, 980002];
  poser(ids[0], 'Zqxw retiree un');
  poser(ids[1], 'Zqxw retiree deux');
  const applique = await appliquerHorsEdition(m, unLot([retirer(ids[0], 'Zqxw retiree un'), retirer(ids[1], 'Zqxw retiree deux')]));
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id IN (?, ?)', ...ids).n, 0);
  // la seconde est recréée depuis, autrement
  poser(ids[1], 'Zqxw recreee autrement');

  const vu = await apercu(m, applique.id);
  assert.deepEqual([vu.comptes.remises, vu.comptes.gardees], [1, 1]);
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.deepEqual(m.un('SELECT * FROM mot_cle_synonyme WHERE id = ?', ids[0]), synonyme(motCle, 'Zqxw retiree un', ids[0], 91), 'réinsérée telle qu’elle était');
  assert.equal(m.un('SELECT libelle FROM mot_cle_synonyme WHERE id = ?', ids[1]).libelle, 'Zqxw recreee autrement', 'la ligne recréée n’est pas écrasée');
  const gardee = annule.bilan.annulation.operations.find((o) => o.etat === 'gardee');
  assert.equal(gardee.raison, 'ligne_existante');
  assert.deepEqual(gardee.ecarts.map((e) => e.colonne), ['libelle', 'libelle_cle']);
});

test('rien à remettre (tout a changé depuis) : refus clair, le lot reste appliqué, rien n’est écrit', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a'))]));
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('site') } }] }));
  const avant = comptes(m.db);

  const vu = await apercu(m, applique.id);
  assert.equal(vu.verdict, 'rien_a_remettre');
  const r = refus(await m.appel('POST', adresse(applique.id, 'annuler/'), {}), 409);
  assert.match(r.erreur, /Rien à remettre/);
  assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', applique.id).etat, 'applique');
  assert.deepEqual(comptes(m.db), avant, 'aucun lot du journal de plus');
  assert.equal(description(m, a.id), texteDuTest('site'));

  // un lot qui n'est pas appliqué ne s'annule pas
  const propose = await deposer(m, unLot([modifierUnMetier(a, texteDuTest('autre'))]));
  refus(await m.appel('POST', adresse(propose.id, 'annuler/'), {}), 409);
  refus(await m.appel('GET', adresse(propose.id, 'annulation/')), 409);
  refus(await m.appel('POST', adresse('00000000-0000-4000-8000-000000000000', 'annuler/'), {}), 404);
});

test('R218 : annuler une écriture qu’une décision verrouille demande le même numéro au clic ; l’aperçu le dit', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id FROM mot_cle WHERE verrou = 0 ORDER BY id LIMIT 1');
  const proposition = await deposer(m, unLot([{ table: 'mot_cle', cle: { id: motCle.id }, operation: 'modifier', avant: { verrou: 0 }, apres: { verrou: 1 } }]));
  const applique = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), { verrous_ouverts: proposition.essai.verrous_a_ouvrir }));
  assert.equal(m.un('SELECT verrou FROM mot_cle WHERE id = ?', motCle.id).verrou, 1);

  const vu = await apercu(m, applique.id);
  assert.equal(vu.verdict, 'verrous');
  assert.ok(vu.verrous_a_ouvrir.includes('R218'));
  refus(await m.appel('POST', adresse(applique.id, 'annuler/'), {}), 409);
  assert.equal(m.un('SELECT verrou FROM mot_cle WHERE id = ?', motCle.id).verrou, 1, 'rien n’est écrit sans le numéro');
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), { verrous_ouverts: vu.verrous_a_ouvrir }));
  assert.equal(m.un('SELECT verrou FROM mot_cle WHERE id = ?', motCle.id).verrou, 0);
  assert.ok(annule.bilan.annulation.verrous_ouverts.includes('R218'));
});

test('ce que le service a écrit autour du lot (clé recalculée, balises réécrites) est remis aussi : le mot-clé et les textes redeviennent ce qu’ils étaient, la clé quittée reste un renvoi', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id, libelle, cle FROM v_mot_cle WHERE verrou = 0 ORDER BY id LIMIT 1');
  const proposition = await deposer(m, unLot([{ table: 'mot_cle', cle: { id: motCle.id }, operation: 'modifier', avant: { libelle: motCle.libelle }, apres: { libelle: `Zqxw renommé ${process.pid}` } }],
    { nature: 'decision', decision: 'R232' }));
  // les textes que les balises de la clé peuvent citer ; le repère, où se lit le nom d'un mot-clé sans page ni sort (migration 0136)
  const tables = ['mot_cle', 'repere', 'page', 'metier', 'sort', 'capacite'];
  const avantApplication = dump(m.db, tables);
  const anciennesAvant = dump(m.db, ['mot_cle_ancienne_cle']).mot_cle_ancienne_cle;
  const applique = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
  const clePosee = m.un('SELECT cle FROM mot_cle WHERE id = ?', motCle.id).cle;
  assert.notEqual(clePosee, motCle.cle, 'le service a recalculé la clé');
  assert.notDeepEqual(dump(m.db, ['mot_cle']), { mot_cle: avantApplication.mot_cle });

  const annule = ok(await m.appel('POST', adresse(proposition.id, 'annuler/'), {}));
  assert.equal(annule.etat, 'annule');
  assert.deepEqual(dump(m.db, tables), avantApplication, 'les tables que le renommage avait touchées (clé, balises des textes) sont remises');
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', annule.annulation_lot_id), { nature: 'decision', decision: 'R232' });
  // la clé que le renommage avait posée est maintenant une clé quittée (R233 (11)) : un renvoi vers le mot-clé, que le service tient lui-même
  const anciennes = dump(m.db, ['mot_cle_ancienne_cle']).mot_cle_ancienne_cle;
  assert.deepEqual(anciennes.filter((a) => !anciennesAvant.some((b) => b.cle === a.cle)), [{ cle: clePosee, mot_cle_id: motCle.id }]);
  assert.equal(applique.lot_id === annule.annulation_lot_id, false);
});

test('une colonne que le service recalcule vers une troisième valeur pendant la remise n’est pas écrasée : elle est listée « gardée » avec la valeur trouvée', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id, libelle, cle FROM v_mot_cle WHERE verrou = 0 ORDER BY id LIMIT 1');
  const [c1, c2] = m.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 2').all().map((c) => c.id);
  const proposition = await deposer(m, unLot([{ table: 'mot_cle', cle: { id: motCle.id }, operation: 'modifier', avant: { libelle: motCle.libelle }, apres: { libelle: `Zqxw tierce ${process.pid}` } }]));
  const applique = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
  const clePosee = m.un('SELECT cle FROM mot_cle WHERE id = ?', motCle.id).cle;
  // depuis le lot, un homonyme du nom d'origine apparaît, dans une autre catégorie : en revenant au nom d'origine, la clé se calcule avec la catégorie (ni celle du lot, ni l'ancienne)
  // nu, hors route (par une route, il naîtrait avec sa page de notion : aide-mot-cle-nu.mjs)
  ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: motCle.libelle, categories: [c2] } }], 'essai'));
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'categories_mot_cle', mot_cle: motCle.id, categories: [c1] }] }));
  const cleAvecCategorie = m.un('SELECT cle FROM mot_cle WHERE id = ?', motCle.id).cle;

  const vu = await apercu(m, applique.id);
  // depuis la migration 0136, le nom se remet sur l'élément du mot-clé (son repère, ou sa page) : cette ligne est remise ; la ligne du mot-clé ne porte plus
  // que la clé recalculée, gardée avec la valeur trouvée
  const nom = vu.operations.find((o) => (o.table === 'repere' && o.cle.mot_cle_id === motCle.id) || (o.table === 'page' && o.apercu?.colonnes?.some((c) => c.colonne === 'titre')));
  assert.equal(nom?.etat, 'remise', JSON.stringify(vu.operations));
  const op = vu.operations.find((o) => o.table === 'mot_cle' && o.cle.id === motCle.id);
  assert.equal(op.etat, 'gardee', JSON.stringify(op));
  assert.deepEqual(op.ecarts.map((e) => e.colonne), ['cle'], JSON.stringify(op));
  const trouvee = m.un('SELECT cle FROM mot_cle WHERE id = ?', motCle.id).cle;
  assert.equal(trouvee, cleAvecCategorie, 'l’aperçu n’écrit rien');
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(m.un('SELECT libelle FROM v_mot_cle WHERE id = ?', motCle.id).libelle, motCle.libelle, 'le libellé est remis');
  const apres = m.un('SELECT cle FROM mot_cle WHERE id = ?', motCle.id).cle;
  assert.notEqual(apres, clePosee);
  const ecart = annule.bilan.annulation.operations.find((o) => o.table === 'mot_cle' && o.cle.id === motCle.id && o.ecarts)?.ecarts.find((e) => e.colonne === 'cle');
  // la clé a pris une troisième valeur (celle de la règle avec la catégorie) : listée avec la valeur trouvée, jamais écrasée
  assert.notEqual(apres, motCle.cle);
  assert.deepEqual([ecart.ecrite, ecart.avant, ecart.trouvee], [clePosee, motCle.cle, apres]);
});

test('classes d’accès : l’aperçu se lit avec la clé, annuler demande une session Créateur (R275) ; hors du site de dev, 403 avant tout', async () => {
  const acces = poserLAccesCommun({ prefixe: 'edition-lots-annulation' });
  const m = nouvelle({ acces: acces.acces });
  const avecCle = acces.avecCle;
  const avecCreateur = acces.createur;
  const [a] = metiers(m.db, 1);
  const proposition = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(a, texteDuTest('accès'))]), avecCle), 201);
  ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}, avecCreateur));

  refus(await m.appel('GET', adresse(proposition.id, 'annulation/')), 401);
  assert.equal(ok(await m.appel('GET', adresse(proposition.id, 'annulation/'), undefined, avecCle)).verdict, 'applicable');
  assert.equal(refus(await m.appel('POST', adresse(proposition.id, 'annuler/'), {}, avecCle), 403).acces, 'cle', 'la clé ne décide pas');
  assert.equal(description(m, a.id), texteDuTest('accès'));
  assert.equal(ok(await m.appel('POST', adresse(proposition.id, 'annuler/'), {}, avecCreateur)).etat, 'annule');
  assert.equal(description(m, a.id), a.description);

  const prod = { ...m.service, edition: false };
  for (const [methode, chemin] of [['GET', adresse(proposition.id, 'annulation/')], ['POST', adresse(proposition.id, 'annuler/')], ['POST', '/api/edition/lots/recalcul/']]) {
    assert.equal(traiter({ methode, chemin, entetes: JSON_, corps: '{}' }, prod).statut, 403, `${methode} ${chemin}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tout recalculer
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une page typée dont le corps est dérivé des tables, par type : celle d'une classe et la fiche d'un don (le corps du test est périmé, comme après un changement de code). */
function perimer(m) {
  const classe = m.un("SELECT id, corps_md FROM page WHERE id GLOB 'classes/*' AND corps_md IS NOT NULL ORDER BY id LIMIT 1");
  const don = m.un("SELECT p.id, p.corps_md FROM page p JOIN capacite c ON c.id = p.id ORDER BY p.id LIMIT 1");
  for (const p of [classe, don]) m.db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Corps périmé du test ${p.id}`, p.id);
  return { classe, don };
}

/** Un premier recalcul, appliqué s'il a des écarts : la base part de ce que le code dérive (le lot du test n'a alors que ses propres pages). */
async function normaliser(m) {
  const r = await m.appel('POST', '/api/edition/lots/recalcul/', {});
  if (r.statut === 201) ok(await m.appel('POST', adresse(r.corps.lot.id, 'appliquer/'), {}));
  else ok(r);
}

test('tout recalculer dépose les écarts des colonnes dérivées comme un lot de nature « code » : rien n’est écrit dans le contenu, le clic applique, un second recalcul n’a plus d’écart', async () => {
  const m = nouvelle();
  // la base d'import peut garder des pages d'avant des migrations de balises : un premier recalcul, appliqué, la ramène à ce que le code dérive
  await normaliser(m);
  const { classe, don } = perimer(m);
  const avant = comptes(m.db);

  const r = ok(await m.appel('POST', '/api/edition/lots/recalcul/', {}), 201);
  assert.ok(r.recalcul.pages_examinees > 0);
  assert.ok(r.recalcul.ecarts >= 2, JSON.stringify(r.recalcul));
  assert.equal(r.lot.etat, 'propose');
  assert.equal(r.lot.nature, 'code');
  assert.equal(r.lot.decision, null);
  assert.match(r.lot.titre, /^Recalcul après un changement de code/);
  assert.equal(r.lot.verdict, 'applicable', JSON.stringify(r.lot.essai.operations.map((o) => o.message ?? o.etat)));
  // chaque opération : la valeur stockée en avant, la valeur recalculée en apres
  const operations = r.lot.contenu.operations;
  for (const [page, perime] of [[classe.id, `Corps périmé du test ${classe.id}`], [don.id, `Corps périmé du test ${don.id}`]]) {
    const o = operations.find((x) => x.cle.id === page);
    assert.equal(o.table, 'page');
    assert.equal(o.operation, 'modifier');
    assert.equal(o.avant.corps_md, perime);
    assert.notEqual(o.apres.corps_md, perime);
  }
  // rien n'est écrit dans le contenu : ni page, ni journal
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', classe.id).corps_md, `Corps périmé du test ${classe.id}`);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(m.un('SELECT count(*) AS n FROM lot_de_changements WHERE id = ?', r.lot.id).n, 1);
  assert.equal(m.un("SELECT count(*) AS n FROM lot_de_changements WHERE etat = 'propose'").n, 1, 'une proposition, rien d’autre');

  // le même essai, le même clic que tout lot
  const applique = ok(await m.appel('POST', adresse(r.lot.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', classe.id).corps_md, classe.corps_md, 'le corps que le code dérive des tables');
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', don.id).corps_md, don.corps_md);
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', applique.lot_id), { nature: 'code', decision: null });

  const encore = ok(await m.appel('POST', '/api/edition/lots/recalcul/', {}));
  assert.equal(encore.lot, null, 'plus d’écart : aucun lot déposé');
  assert.equal(encore.recalcul.ecarts, 0);
  assert.equal(m.un("SELECT count(*) AS n FROM lot_de_changements WHERE etat = 'propose'").n, 0, 'rien de déposé');

  // et l'annulation remet ce que le recalcul avait remplacé (une colonne dérivée s'écrit par le journal : le service la refuse)
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(annule.etat, 'annule');
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', classe.id).corps_md, `Corps périmé du test ${classe.id}`);
});

test('tout recalculer couvre les pages refaites morceau par morceau et en entier : une page de magie suit sa ligne de sort ; une arme changée dans sa table refait la page des armes', async () => {
  const m = nouvelle();
  await normaliser(m);
  // un sort et une arme changés dans leur table sans que leur page suive (comme après un changement de code qui rend autrement la ligne)
  const sort = m.un("SELECT s.id, s.magie_id FROM sort s JOIN page p ON p.id = s.magie_id WHERE p.corps_md IS NOT NULL AND s.effets IS NOT NULL ORDER BY s.magie_id, s.ordre LIMIT 1");
  m.db.prepare('UPDATE sort SET effets = effets || ? WHERE id = ?').run(' Effet du test.', sort.id);
  const arme = m.un('SELECT id FROM arme ORDER BY id LIMIT 1');
  m.db.prepare('UPDATE arme SET description = ?, nom_brut = nom_brut || ? WHERE id = ?').run('Description du test', ' du test', arme.id);
  const r = ok(await m.appel('POST', '/api/edition/lots/recalcul/', {}), 201);
  const o = r.lot.contenu.operations.find((x) => x.cle.id === sort.magie_id);
  assert.ok(o, 'la page de la magie est refaite');
  assert.ok(!o.avant.corps_md.includes('Effet du test.'));
  assert.ok(o.apres.corps_md.includes('Effet du test.'));
  assert.equal(r.lot.verdict, 'applicable', JSON.stringify(r.lot.essai.operations.map((x) => x.message ?? x.etat)));
  // la page des armes est refaite en entier : la ligne de l'arme (nom compris) que le corps n'écrivait pas comme sa table ; elle n'est plus « illisible »
  const page = r.lot.contenu.operations.find((x) => x.cle.id === PAGE_DES_ARMES);
  assert.ok(page, 'la page des armes est refaite');
  assert.ok(page.apres.corps_md.split('\n').includes(ligneDArme(m.un('SELECT * FROM arme WHERE id = ?', arme.id))), 'la ligne de l’arme, telle que sa table l’écrit');
  assert.ok(!page.avant.corps_md.split('\n').includes(ligneDArme(m.un('SELECT * FROM arme WHERE id = ?', arme.id))));
  assert.ok(!r.recalcul.pages_illisibles.some((x) => x.page === PAGE_DES_ARMES), JSON.stringify(r.recalcul.pages_illisibles));
});

test('tout recalculer : un bouclier, un ingrédient, un composant et une potion dont le nom a changé dans leur table sont refaits en entier (plus « illisibles »), leur page a une opération', async () => {
  const m = nouvelle();
  await normaliser(m);
  const recalcul = async () => ok(await m.appel('POST', '/api/edition/lots/recalcul/', {}), 201);
  // le nom désignait la ligne du corps : changé dans la table seule, le corps ne le retrouve plus par son texte, mais par sa place
  const bouclier = m.un('SELECT id FROM bouclier ORDER BY id LIMIT 1');
  const ingredient = m.un("SELECT r.id FROM ressource r JOIN ingredient_alchimie i ON i.ressource_id = r.id WHERE r.genre = 'ingredient_alchimie' ORDER BY r.id LIMIT 1");
  const objet = m.un("SELECT id FROM ressource WHERE genre = 'materiel' AND section = 'MATOS AVENTURES' ORDER BY id LIMIT 1");
  const potion = m.un('SELECT r.id, r.page_id FROM potion p JOIN ressource r ON r.id = p.ressource_id ORDER BY r.id LIMIT 1');
  m.db.prepare('UPDATE bouclier SET nom = ? WHERE id = ?').run('Bouclier du test', bouclier.id);
  m.db.prepare('UPDATE ressource SET nom = ? WHERE id = ?').run('Ingrédient du test', ingredient.id);
  m.db.prepare('UPDATE ressource SET nom = ? WHERE id = ?').run('Objet du test', objet.id);
  m.db.prepare('UPDATE ressource SET nom = ? WHERE id = ?').run('Potion du test', potion.id);
  const r = await recalcul();
  const illisibles = r.recalcul.pages_illisibles.map((x) => x.page);
  const pages = [
    [pageDesArmuresDeLaLigne('bouclier', m.un('SELECT * FROM bouclier WHERE id = ?', bouclier.id)), 'Bouclier du test'],
    [PAGE_DES_INGREDIENTS, 'Ingrédient du test'],
    [PAGE_DE_L_INVENTAIRE, 'Objet du test'],
    [potion.page_id, 'Potion du test'],
  ];
  for (const [page, nom] of pages) {
    assert.ok(page, 'la page de la ligne est connue');
    assert.ok(!illisibles.includes(page), `${page} n’est plus dite illisible : ${JSON.stringify(r.recalcul.pages_illisibles)}`);
    const o = r.lot.contenu.operations.find((x) => x.cle.id === page);
    assert.ok(o, `${page} est refaite`);
    assert.ok(o.apres.corps_md.includes(nom), `${page} écrit « ${nom} »`);
    assert.ok(!o.avant.corps_md.includes(nom));
  }
});

test('tout recalculer : la clé de lecture le dépose (classe « proposition »), il ne s’applique qu’au clic du propriétaire ; dans un fil à part comme dans celui du service', async () => {
  for (const enArrierePlan of [false, true]) {
    const m = nouvelle({ enArrierePlan });
    const { classe } = perimer(m);
    const r = ok(await m.appel('POST', '/api/edition/lots/recalcul/', {}), 201);
    assert.ok(r.lot.contenu.operations.some((o) => o.cle.id === classe.id));
    assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', r.lot.id).etat, 'propose');
    assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', classe.id).corps_md, `Corps périmé du test ${classe.id}`);
  }
});

test('traduire : une colonne dérivée d’une page typée passe par le journal (le service la refuse), le corps d’une page du guide par le service', () => {
  const typee = traduire({ table: 'page', cle: { id: 'classes/essai' }, operation: 'modifier', avant: { corps_md: 'a' }, apres: { corps_md: 'b' } });
  assert.deepEqual(typee.ops.map((o) => o.op), ['ecrire_modifier']);
  const guide = traduire({ table: 'page', cle: { id: 'guide/essai' }, operation: 'modifier', avant: { corps_md: 'a' }, apres: { corps_md: 'b' } });
  assert.deepEqual(guide.ops.map((o) => o.op), ['modifier']);
});

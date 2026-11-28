// Annuler une seule ligne d'un lot appliqué (R291 : « annuler cette modification » sur chaque ligne du patchnote ; docs/serveur.md, « Lots de changements (service) » ;
// serveur/edition-lots.mjs#lignesDuLotApplique, #annulerUneLigne, #previsualiserLAnnulation, #dependancesDesLignes) :
//   - une « ligne » est une ligne de l'effet net du lot (une ligne de table avec ses colonnes), numérotée par le rang de sa première écriture au journal ;
//   - GET …/<id>/ rend les lignes d'un lot appliqué : colonnes avant → après, état (en place, annulée, modifiée depuis, comme avant) et si elle s'annule seule ;
//   - le même code que le lot entier, sous le même verrou : une valeur n'est remise que si elle vaut encore ce que le lot a écrit, une insertion n'est supprimée
//     qu'intacte, un numéro n'est jamais rendu ; l'aperçu se calcule sur une copie ;
//   - une ligne qu'une autre ligne du lot tient (clé étrangère, page refaite d'après ses sources) ne s'annule pas seule : le motif est dit, rien n'est écrit ;
//   - l'état de chaque ligne est gardé dans le lot ; quand plus rien n'est en place, le lot passe « annule » ; le lot entier reste annulable ;
//   - aperçu et clic demandent une session Créateur.
// Aucune valeur de règle figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-lignes.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { poserLAcces as poserLAccesCommun } from './aide-acces-d-essai.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { deposer as deposerLot } from '../serveur/edition-lots.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-lots-lignes');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

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
const metiers = (db, k) => db.prepare('SELECT id, nom, description FROM metier ORDER BY id LIMIT ?').all(k).map((m) => ({ ...m }));
const description = (m, id) => m.un('SELECT description FROM metier WHERE id = ?', id).description;
const texteDuTest = (marque) => `Texte posé par la ligne ${marque} ${process.pid}`;
const modifierUnMetier = (m, texte) => ({ table: 'metier', cle: { id: m.id }, operation: 'modifier', avant: { description: m.description }, apres: { description: texte } });
const unLot = (operations, plus = {}) => ({ format: 'maverick-lot/1', titre: `Lot de lignes ${(n += 1)}`, nature: 'code', operations, ...plus });
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const adresseDeLaLigne = (id, ligne, suite) => adresse(id, `lignes/${ligne}/${suite}/`);
/** Dépose puis applique d'un clic (sans réglage d'accès : tout est ouvert). */
async function appliquer(m, lot, corps = {}) {
  const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
  return ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), corps));
}
/** Pour une table que le service ne sait pas écrire : le dépôt de test ouvre `ouvertHorsEdition` (aucune route ne le donne). */
async function appliquerHorsEdition(m, lot) {
  const proposition = await deposerLot(() => m.db, lot, { enArrierePlan: false, controle: { ouvertHorsEdition: true } });
  assert.equal(proposition.verdict, 'applicable', JSON.stringify(proposition.essai.operations.map((o) => o.message ?? o.etat)));
  return ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
}
const lignesDe = async (m, id) => ok(await m.appel('GET', adresse(id))).lignes;
const ligneDuMetier = (lignes, metier) => lignes.find((l) => l.table !== 'Page' && l.ligne.includes(metier.nom));
const comptes = (db) => ({
  lots: db.prepare('SELECT count(*) AS n FROM modification_lot').get().n,
  modifications: db.prepare('SELECT count(*) AS n FROM modification').get().n,
});
const synonyme = (motCle, libelle, id, ordre) => ({ id, mot_cle_id: motCle, libelle, libelle_cle: libelle.toLowerCase().replaceAll(' ', '-'), ordre });

test('un lot appliqué montre ses lignes : colonnes avant → après par leur libellé, état, et si chacune s’annule seule (une page refaite par le site est tenue par ses sources)', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))]));
  const lignes = await lignesDe(m, applique.id);

  const la = ligneDuMetier(lignes, a);
  const lb = ligneDuMetier(lignes, b);
  assert.equal(la.genre, 'modifier');
  assert.equal(la.etat, 'en_place');
  assert.equal(la.annulable_seule, true);
  assert.equal(la.motif, null);
  assert.equal(la.colonnes.length, 1);
  assert.equal(la.colonnes[0].avant, a.description);
  assert.equal(la.colonnes[0].apres, texteDuTest('a'));
  assert.ok(la.colonnes[0].libelle && la.colonnes[0].libelle !== 'description', 'la colonne par son libellé');
  assert.ok(la.table && la.table !== 'metier', 'la table par son nom');
  assert.notEqual(la.n, lb.n);
  assert.deepEqual([...new Set(lignes.map((l) => l.n))].length, lignes.length, 'un numéro par ligne');
  // le service a refait les pages des deux métiers : ces lignes-là sont tenues par les lignes dont elles dérivent
  const pages = lignes.filter((l) => l.table !== la.table && l.genre === 'modifier' && l.annulable_seule === false);
  assert.ok(pages.length >= 1, JSON.stringify(lignes.map((l) => [l.table, l.annulable_seule])));
  for (const p of pages) {
    assert.match(p.motif, /ne s’annule pas seule/);
    assert.ok(p.depend_de.includes(la.n) && p.depend_de.includes(lb.n), 'la page dépend des deux lignes du lot');
  }
  // un lot proposé n'a pas de lignes (rien n'est appliqué) ; la liste ne porte que le nombre de lignes annulées
  const propose = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(a, texteDuTest('proposé'))])), 201);
  assert.equal(ok(await m.appel('GET', adresse(propose.id))).lignes, undefined);
  const liste = ok(await m.appel('GET', '/api/edition/lots/')).lots.find((l) => l.id === applique.id);
  assert.equal(liste.lignes_annulees, 0);
});

test('annuler une seule ligne : aperçu sur une copie (rien n’est écrit), puis le clic remet cette ligne seule ; le lot du journal a la nature et la décision du lot', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))], { nature: 'decision', decision: 'R291' }));
  const lignes = await lignesDe(m, applique.id);
  const la = ligneDuMetier(lignes, a);

  const avant = comptes(m.db);
  const vu = ok(await m.appel('GET', adresseDeLaLigne(applique.id, la.n, 'annulation')));
  assert.equal(vu.verdict, 'applicable');
  assert.equal(vu.ligne, la.n);
  assert.equal(vu.lot, applique.id);
  assert.ok(vu.titre.startsWith('Annulation d’une ligne de « '));
  assert.equal(vu.comptes.remises, 1, 'l’aperçu ne juge que cette ligne');
  const remise = vu.operations.find((o) => o.etat === 'remise');
  assert.equal(remise.rang_du_lot, la.n);
  assert.equal(remise.apercu.colonnes[0].avant, texteDuTest('a'), 'avant : la valeur d’aujourd’hui');
  assert.equal(remise.apercu.colonnes[0].apres, a.description, 'après : celle que l’annulation remet');
  assert.deepEqual(comptes(m.db), avant, 'l’aperçu n’écrit rien');
  assert.equal(description(m, a.id), texteDuTest('a'));
  const dossier = join(dirname(m.chemin), 'essais');
  assert.deepEqual(existsSync(dossier) ? readdirSync(dossier) : [], [], 'aucune copie ne reste');

  const lot = ok(await m.appel('POST', adresseDeLaLigne(applique.id, la.n, 'annuler'), {}));
  assert.equal(description(m, a.id), a.description, 'la ligne est remise');
  assert.equal(description(m, b.id), texteDuTest('b'), 'les autres lignes du lot restent en place');
  assert.equal(lot.etat, 'applique', 'le lot reste appliqué tant qu’une ligne est en place');
  assert.equal(lot.lignes_annulees, 1);
  const fait = lot.bilan.lignes_annulees[la.n];
  assert.ok(fait.annule_le && fait.lot_id, 'l’état de la ligne est gardé : quand, et par quel lot du journal');
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', fait.lot_id), { nature: 'decision', decision: 'R291' });
  assert.ok(m.un('SELECT resume FROM modification_lot WHERE id = ?', fait.lot_id).resume.startsWith('Annulation d’une ligne de « '));
  assert.equal(comptes(m.db).lots, avant.lots + 1, 'un seul lot du journal pour la ligne');

  const apres = await lignesDe(m, applique.id);
  assert.equal(apres.find((l) => l.n === la.n).etat, 'annulee');
  assert.deepEqual(apres.find((l) => l.n === la.n).annulee, { annule_le: fait.annule_le, lot_id: fait.lot_id });
  assert.equal(apres.find((l) => l.n === la.n).annulable_seule, false);
  assert.equal(ligneDuMetier(apres, b).etat, 'en_place');
  // une ligne déjà annulée : rien à remettre, le lot est inchangé
  const encore = refus(await m.appel('POST', adresseDeLaLigne(applique.id, la.n, 'annuler'), {}), 409);
  assert.match(encore.erreur, /Rien à remettre/);
  assert.equal(comptes(m.db).lots, avant.lots + 1);
});

test('la dernière ligne en place annulée, le lot passe « annulé » ; le lot entier annule ce qui reste tant qu’une ligne est en place, et garde « annulée » la ligne déjà annulée seule', async () => {
  const m = nouvelle();
  const [a, b, c] = metiers(m.db, 3);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))]));
  const lignes = await lignesDe(m, applique.id);
  ok(await m.appel('POST', adresseDeLaLigne(applique.id, ligneDuMetier(lignes, a).n, 'annuler'), {}));
  // le lot entier annule ce qui reste : la ligne déjà annulée reste dite « annulée » (par sa ligne), pas « comme avant »
  const entier = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(entier.etat, 'annule');
  assert.equal(description(m, b.id), b.description);
  assert.equal(entier.bilan.annulation.remises >= 1, true);
  const apres = await lignesDe(m, applique.id);
  assert.equal(ligneDuMetier(apres, a).etat, 'annulee');
  assert.equal(ligneDuMetier(apres, b).etat, 'annulee');
  assert.equal(ligneDuMetier(apres, b).annulable_seule, false);

  // deuxième lot : toutes ses lignes annulées une à une → « annulé » sans passer par le lot entier
  const second = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a2')), modifierUnMetier(c, texteDuTest('c2'))]));
  const l2 = await lignesDe(m, second.id);
  const premier = ok(await m.appel('POST', adresseDeLaLigne(second.id, ligneDuMetier(l2, a).n, 'annuler'), {}));
  assert.equal(premier.etat, 'applique');
  const dernier = ok(await m.appel('POST', adresseDeLaLigne(second.id, ligneDuMetier(l2, c).n, 'annuler'), {}));
  assert.equal(dernier.etat, 'annule', 'plus aucune ligne en place');
  assert.ok(dernier.annule_le && dernier.annulation_lot_id);
  assert.equal(dernier.lignes_annulees, 2);
  assert.equal(description(m, a.id), a.description);
  assert.equal(description(m, c.id), c.description);
  refus(await m.appel('POST', adresse(second.id, 'annuler/'), {}), 409);
});

test('une valeur changée depuis (le site prime) : la ligne est « modifiée depuis », annulable seulement pour ce qui vaut encore ce que le lot a écrit ; rien n’est écrasé', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a'))]));
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: a.id }, valeurs: { description: texteDuTest('site') } }] }));
  const lignes = await lignesDe(m, applique.id);
  const la = ligneDuMetier(lignes, a);
  assert.equal(la.etat, 'modifiee_depuis');
  assert.equal(la.annulable_seule, false);
  assert.match(la.motif, /le site prime/);
  assert.deepEqual(la.colonnes_modifiees.map((c) => [c.ecrite, c.trouvee]), [[texteDuTest('a'), texteDuTest('site')]]);
  const vu = ok(await m.appel('GET', adresseDeLaLigne(applique.id, la.n, 'annulation')));
  assert.equal(vu.verdict, 'rien_a_remettre');
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', adresseDeLaLigne(applique.id, la.n, 'annuler'), {}), 409);
  assert.match(r.erreur, /Rien à remettre/);
  assert.equal(description(m, a.id), texteDuTest('site'));
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(m.un('SELECT etat FROM lot_de_changements WHERE id = ?', applique.id).etat, 'applique');
});

test('une ligne qu’une autre ligne du lot tient ne s’annule pas seule : le motif est dit (aperçu et clic), rien n’est écrit ; une fois la citante annulée, elle s’annule', async () => {
  const m = nouvelle();
  const nom = `Zephyr ligne ${process.pid}`;
  const lot = unLot([
    { table: 'mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle: nom, cle: nom.toLowerCase().replaceAll(' ', '-') } },
    { table: 'mot_cle_synonyme', cle: { id: { $numero: 's' } }, operation: 'inserer', apres: { id: { $numero: 's' }, mot_cle_id: { $numero: 'a' }, libelle: `${nom} syn`, libelle_cle: `${nom} syn`.toLowerCase().replaceAll(' ', '-'), ordre: 90 } },
  ]);
  const applique = await appliquerHorsEdition(m, lot);
  const [idMotCle, idSynonyme] = [applique.bilan.numeros.find((x) => x.table === 'mot_cle').numero, applique.bilan.numeros.find((x) => x.table === 'mot_cle_synonyme').numero];
  const lignes = await lignesDe(m, applique.id);
  const motCle = lignes.find((l) => l.genre === 'inserer' && l.table === 'Mot-clé');
  const citante = lignes.find((l) => l.genre === 'inserer' && l.table === 'Synonyme du mot-clé');
  assert.equal(motCle.annulable_seule, false);
  assert.deepEqual(motCle.depend_de, [citante.n]);
  assert.match(motCle.motif, /la cite/);
  assert.equal(citante.annulable_seule, true);

  const avant = comptes(m.db);
  const vu = ok(await m.appel('GET', adresseDeLaLigne(applique.id, motCle.n, 'annulation')));
  assert.equal(vu.verdict, 'refusee');
  // depuis la migration 0136, l'aperçu groupe le mot-clé et son repère (le nom) : l'opération refusée est celle du mot-clé
  const refusee = vu.operations.find((o) => o.table === 'mot_cle');
  assert.equal(refusee.etat, 'refusee');
  assert.match(refusee.message, /ne s’annule pas seule/);
  assert.deepEqual(refusee.depend_de, [citante.n]);
  const r = refus(await m.appel('POST', adresseDeLaLigne(applique.id, motCle.n, 'annuler'), {}), 409);
  assert.match(r.erreur, /ne s’annule pas seule/);
  assert.deepEqual(r.depend_de, [citante.n]);
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle WHERE id = ?', idMotCle).n, 1);
  assert.deepEqual(comptes(m.db), avant);

  // la citante d'abord (une insertion n'est supprimée qu'intacte), puis le mot-clé
  ok(await m.appel('POST', adresseDeLaLigne(applique.id, citante.n, 'annuler'), {}));
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id = ?', idSynonyme).n, 0);
  const apres = await lignesDe(m, applique.id);
  assert.equal(apres.find((l) => l.n === motCle.n).annulable_seule, true, 'plus rien ne le tient');
  const fini = ok(await m.appel('POST', adresseDeLaLigne(applique.id, motCle.n, 'annuler'), {}));
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle WHERE id = ?', idMotCle).n, 0);
  assert.equal(fini.etat, 'annule');
  // un numéro n'est jamais rendu
  assert.ok(m.un("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle' AND colonne = 'id'").plafond >= idMotCle);
  assert.ok(m.un("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle_synonyme' AND colonne = 'id'").plafond >= idSynonyme);
});

test('une ligne insérée n’est supprimée qu’intacte, une ligne retirée n’est réinsérée que si elle est absente : chacune annulée seule, l’autre intacte', async () => {
  const m = nouvelle();
  const motCle = m.un('SELECT id FROM mot_cle ORDER BY id LIMIT 1').id;
  const ligne = (jeton, libelle) => ({ table: 'mot_cle_synonyme', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: synonyme(motCle, libelle, { $numero: jeton }, 90) });
  const insere = await appliquerHorsEdition(m, unLot([ligne('a', 'Zqxw ligne un'), ligne('b', 'Zqxw ligne deux')]));
  const [un, deux] = insere.bilan.numeros.map((x) => x.numero);
  m.db.prepare('UPDATE mot_cle_synonyme SET ordre = 95 WHERE id = ?').run(deux); // le site retouche la seconde depuis
  const lignes = await lignesDe(m, insere.id);
  const l1 = lignes.find((l) => l.ligne.includes('Zqxw ligne un'));
  const l2 = lignes.find((l) => l.ligne.includes('Zqxw ligne deux'));
  assert.equal(l1.etat, 'en_place');
  assert.equal(l2.etat, 'modifiee_depuis');
  assert.equal(l2.annulable_seule, false);
  ok(await m.appel('POST', adresseDeLaLigne(insere.id, l1.n, 'annuler'), {}));
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id = ?', un).n, 0, 'la ligne intacte est supprimée');
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle_synonyme WHERE id = ?', deux).n, 1, 'la ligne retouchée reste');
  refus(await m.appel('POST', adresseDeLaLigne(insere.id, l2.n, 'annuler'), {}), 409);

  // une ligne retirée par le lot : réinsérée telle qu'elle était, si elle est absente
  const ids = [980011, 980012];
  const poser = (id, libelle) => m.db.prepare('INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre) VALUES (:id, :mot_cle_id, :libelle, :libelle_cle, :ordre)').run(synonyme(motCle, libelle, id, 91));
  poser(ids[0], 'Zqxw retiree un');
  poser(ids[1], 'Zqxw retiree deux');
  const retire = await appliquerHorsEdition(m, unLot(ids.map((id, i) => ({ table: 'mot_cle_synonyme', cle: { id }, operation: 'supprimer', avant: synonyme(motCle, i ? 'Zqxw retiree deux' : 'Zqxw retiree un', id, 91) }))));
  poser(ids[1], 'Zqxw recreee autrement'); // la seconde est recréée depuis, autrement
  const lr = await lignesDe(m, retire.id);
  const r1 = lr.find((l) => l.ligne.includes('Zqxw retiree un'));
  assert.equal(r1.genre, 'supprimer');
  assert.equal(r1.etat, 'en_place');
  const r2 = lr.find((l) => l.n !== r1.n);
  assert.equal(r2.etat, 'modifiee_depuis');
  ok(await m.appel('POST', adresseDeLaLigne(retire.id, r1.n, 'annuler'), {}));
  assert.deepEqual(m.un('SELECT * FROM mot_cle_synonyme WHERE id = ?', ids[0]), synonyme(motCle, 'Zqxw retiree un', ids[0], 91), 'réinsérée telle qu’elle était');
  assert.equal(m.un('SELECT libelle FROM mot_cle_synonyme WHERE id = ?', ids[1]).libelle, 'Zqxw recreee autrement', 'la ligne recréée n’est pas écrasée');
});

test('annuler une ligne qui n’existe pas, d’un lot non appliqué, ou à un numéro mal formé : 404 ou 409, rien n’est écrit', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a'))]));
  const avant = comptes(m.db);
  refus(await m.appel('POST', adresseDeLaLigne(applique.id, 999, 'annuler'), {}), 404);
  refus(await m.appel('GET', adresseDeLaLigne(applique.id, 999, 'annulation')), 404);
  refus(await m.appel('POST', adresse(applique.id, 'lignes/0/annuler/'), {}), 404);
  refus(await m.appel('POST', adresse(applique.id, 'lignes/x/annuler/'), {}), 404);
  refus(await m.appel('POST', adresse(applique.id, 'lignes/1/autre/'), {}), 404);
  refus(await m.appel('POST', adresse(applique.id, 'lignes/1/'), {}), 404);
  refus(await m.appel('GET', adresseDeLaLigne(applique.id, 1, 'annuler')), 405);
  refus(await m.appel('POST', adresseDeLaLigne('00000000-0000-4000-8000-000000000000', 1, 'annuler'), {}), 404);
  const propose = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(a, texteDuTest('autre'))])), 201);
  refus(await m.appel('POST', adresseDeLaLigne(propose.id, 1, 'annuler'), {}), 409);
  refus(await m.appel('GET', adresseDeLaLigne(propose.id, 1, 'annulation')), 409);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(description(m, a.id), texteDuTest('a'));
});

test('R291 : l’aperçu et le clic d’une ligne demandent une session Créateur (ni la clé de lecture ni la clé de dépôt) ; la liste et la lecture restent à la clé', async () => {
  const acces = poserLAccesCommun({ prefixe: 'edition-lots-lignes', depot: true });
  const m = nouvelle({ acces: acces.acces });
  const avecCle = acces.avecCle;
  const avecDepot = acces.avecDepot();
  const avecCreateur = acces.createur;
  const [a] = metiers(m.db, 1);

  const applique = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierUnMetier(a, texteDuTest('a'))]), avecDepot), 201);
  assert.equal(applique.etat, 'applique');
  // la lecture des lignes passe avec les clés
  assert.ok(ok(await m.appel('GET', adresse(applique.id), undefined, avecCle)).lignes.length >= 1);
  assert.ok(ok(await m.appel('GET', adresse(applique.id), undefined, avecDepot)).lignes.length >= 1);
  const la = ligneDuMetier(ok(await m.appel('GET', adresse(applique.id), undefined, avecCreateur)).lignes, a);
  for (const [entetes, statut, code] of [[{}, 401, 'connexion'], [avecCle, 403, 'cle'], [avecDepot, 403, 'cle'], [acces.mj, 403, 'niveau']]) {
    assert.deepEqual([refus(await m.appel('GET', adresseDeLaLigne(applique.id, la.n, 'annulation'), undefined, entetes), statut).acces], [code]);
    assert.deepEqual([refus(await m.appel('POST', adresseDeLaLigne(applique.id, la.n, 'annuler'), {}, entetes), statut).acces], [code]);
  }
  assert.equal(description(m, a.id), texteDuTest('a'), 'rien n’est annulé sans une session Créateur');
  assert.equal(ok(await m.appel('GET', adresseDeLaLigne(applique.id, la.n, 'annulation'), undefined, avecCreateur)).verdict, 'applicable');
  ok(await m.appel('POST', adresseDeLaLigne(applique.id, la.n, 'annuler'), {}, avecCreateur));
  assert.equal(description(m, a.id), a.description);
});

test('l’aperçu d’une ligne tourne aussi dans un fil à part (le service ne s’arrête pas) et rend le même verdict ; la base et le dossier des essais sont intacts', async () => {
  const m = nouvelle({ enArrierePlan: true });
  const [a, b] = metiers(m.db, 2);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('fil a')), modifierUnMetier(b, texteDuTest('fil b'))]));
  const la = ligneDuMetier(await lignesDe(m, applique.id), a);
  const avant = comptes(m.db);
  const vu = ok(await m.appel('GET', adresseDeLaLigne(applique.id, la.n, 'annulation')));
  assert.deepEqual([vu.verdict, vu.ligne, vu.comptes.remises], ['applicable', la.n, 1]);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(description(m, a.id), texteDuTest('fil a'));
  const dossier = join(dirname(m.chemin), 'essais');
  assert.deepEqual(existsSync(dossier) ? readdirSync(dossier) : [], [], 'aucune copie ne reste');
});

test('pas d’interblocage : une citante que le site a supprimée (ou dont il a changé la clé étrangère) ne tient plus la ligne qu’elle citait, qui s’annule seule', async () => {
  for (const geste of ['supprimer', 'rediriger']) {
    const m = nouvelle();
    const nom = `Zephyr bloc ${geste} ${process.pid}`;
    const autre = m.un('SELECT id FROM mot_cle ORDER BY id LIMIT 1').id;
    const cle = (x) => x.toLowerCase().replaceAll(' ', '-');
    const lot = unLot([
      { table: 'mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle: nom, cle: cle(nom) } },
      { table: 'mot_cle_synonyme', cle: { id: { $numero: 's' } }, operation: 'inserer', apres: { id: { $numero: 's' }, mot_cle_id: { $numero: 'a' }, libelle: `${nom} syn`, libelle_cle: cle(`${nom} syn`), ordre: 90 } },
    ]);
    const applique = await appliquerHorsEdition(m, lot);
    const idMotCle = applique.bilan.numeros.find((x) => x.table === 'mot_cle').numero;
    const idSynonyme = applique.bilan.numeros.find((x) => x.table === 'mot_cle_synonyme').numero;
    const avant = (await lignesDe(m, applique.id)).find((l) => l.table === 'Mot-clé');
    assert.equal(avant.annulable_seule, false, 'tant que la citante est en place');

    if (geste === 'supprimer') m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id = ?').run(idSynonyme);
    else m.db.prepare('UPDATE mot_cle_synonyme SET mot_cle_id = ? WHERE id = ?').run(autre, idSynonyme);
    const lignes = await lignesDe(m, applique.id);
    const motCle = lignes.find((l) => l.table === 'Mot-clé');
    assert.equal(motCle.annulable_seule, true, `${geste} : la citante n’a plus rien à remettre qui tienne le mot-clé (${motCle.motif})`);
    assert.deepEqual(motCle.depend_de, []);
    const fini = ok(await m.appel('POST', adresseDeLaLigne(applique.id, motCle.n, 'annuler'), {}));
    assert.equal(m.un('SELECT count(*) AS n FROM mot_cle WHERE id = ?', idMotCle).n, 0);
    assert.ok(['applique', 'annule'].includes(fini.etat));
  }
});

test('une ligne restée « modifiée depuis » quand le lot passe « annulé » dit son vrai motif, pas « le lot entier est annulé »', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const applique = await appliquer(m, unLot([modifierUnMetier(a, texteDuTest('a')), modifierUnMetier(b, texteDuTest('b'))]));
  ok(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'metier', cle: { id: b.id }, valeurs: { description: texteDuTest('site') } }] }));
  const lignes = await lignesDe(m, applique.id);
  const fini = ok(await m.appel('POST', adresseDeLaLigne(applique.id, ligneDuMetier(lignes, a).n, 'annuler'), {}));
  assert.equal(fini.etat, 'annule', 'plus rien n’est en place : l’autre ligne est modifiée depuis');
  const apres = ligneDuMetier(await lignesDe(m, applique.id), b);
  assert.equal(apres.etat, 'modifiee_depuis');
  assert.match(apres.motif, /le site prime/);
  assert.doesNotMatch(apres.motif, /lot entier/);
});

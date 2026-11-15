// L'insertion d'un mot-clé par un lot de changements (lot 6 du chantier de la base de dev, R274, R275 ; épreuve d'entrée : la 0123 crée neuf mots-clés ;
// serveur/edition-lots.mjs#traduire, #traduireLaCreationDUnMotCle ; edition.mjs#OPERATIONS_DU_LOT.verifier_ligne) :
//   - le SERVICE crée le mot-clé (id suivant, clé de la règle R232, adresse, couleur et icône contrôlées), jamais une insertion SQL du lot ;
//   - `verrou` à 1 est une colonne tenue par le service (R218 (4)) : le lot l'écrit sous le gel, que le propriétaire ouvre au clic (verrous_ouverts : R218) ;
//   - le lot vérifie que la ligne créée est celle qu'il décrit (identifiant donné à l'application, clé) : sinon l'opération est refusée ;
//   - l'annulation d'un lot qui a créé un mot-clé le supprime par le service, et le numéro n'est jamais redonné ;
//   - les autres entités que le service crée lui-même restent refusées à l'insertion ; `verifier_ligne` n'est pas une opération des routes.
// Les libellés sont ceux du test (absents de la base) ; aucune valeur de règle n'est lue.
//   node --test test/serveur-edition-lots-mot-cle.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurEdition, enregistrer } from '../serveur/edition.mjs';
import { annuler, appliquer, deposer, lire, traduire } from '../serveur/edition-lots.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('lots-mot-cle');
let n = 0;
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
  return { db, dossier: join(racine, `essais${n}`) };
}
const lot = (operations, plus = {}) => ({ format: 'maverick-lot/1', titre: `Mot-clé d’essai ${(n += 1)}`, nature: 'code', operations, ...plus });
const creation = (jeton, apres) => ({ table: 'mot_cle', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { id: { $numero: jeton }, ...apres } });
const proposer = (m, corps) => deposer(() => m.db, corps, { enArrierePlan: false, dossier: m.dossier });
const libelle = (suffixe) => `Zephyr essai ${suffixe} ${process.pid}`;
/** La clé que la règle donne à un libellé de lettres et de chiffres sans homonyme : ses mots en minuscules, reliés par des tirets. */
const cleDe = (texte) => texte.toLowerCase().replace(/ /g, '-');

test('traduire : l’insertion d’un mot-clé est une création du service, puis le verrou (colonne tenue), puis la vérification de la ligne créée ; les autres entités restent refusées', () => {
  const sans = traduire({ table: 'mot_cle', cle: { id: 5 }, operation: 'inserer', apres: { id: 5, libelle: 'X', cle: 'x', description: null } });
  assert.deepEqual(sans.ops.map((o) => o.op), ['creer', 'verifier_ligne']);
  assert.deepEqual(sans.ops[0], { op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'X' } });
  const verrouille = traduire({ table: 'mot_cle', cle: { id: 5 }, operation: 'inserer', apres: { id: 5, libelle: 'X', cle: 'x', verrou: 1, url: '/a/', couleur: 'alignement:x' } });
  assert.deepEqual(verrouille.ops.map((o) => o.op), ['creer', 'ecrire_modifier', 'verifier_ligne']);
  assert.deepEqual(verrouille.ops[0].valeurs, { libelle: 'X', url: '/a/', couleur: 'alignement:x' });
  assert.deepEqual(verrouille.ops[1].valeurs, { verrou: 1 });
  // ce que le service ne crée pas avec un mot-clé : refusé, avec la colonne
  assert.match(traduire({ table: 'mot_cle', cle: { id: 5 }, operation: 'inserer', apres: { id: 5, libelle: 'X', monnaie_id: 'or' } }).refus, /monnaie_id/);
  assert.match(traduire({ table: 'mot_cle', cle: { id: 5 }, operation: 'inserer', apres: { id: 5, libelle: 'X', verrou: 2 } }).refus, /verrou/);
  // une autre entité que le service crée lui-même : toujours refusée
  assert.match(traduire({ table: 'page', cle: { id: 'guide/x' }, operation: 'inserer', apres: { id: 'guide/x' } }).refus, /crée lui-même/);
});

test('un lot crée un mot-clé par le service : l’id suivant, la clé de la règle, le numéro donné à l’application et jamais redonné après l’annulation', async () => {
  const m = nouvelle();
  const nom = libelle('un');
  const avant = m.db.prepare('SELECT max(id) AS m FROM mot_cle').get().m;
  const p = await proposer(m, lot([creation('a', { libelle: nom, cle: cleDe(nom), description: 'Défini par un lot.' })]));
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.operations));
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle WHERE libelle = ?').get(nom).n, 0, 'l’essai n’écrit rien dans la base vivante');
  const fait = appliquer(m.db, p.id, {});
  assert.equal(fait.etat, 'applique');
  const ligne = m.db.prepare('SELECT * FROM mot_cle WHERE libelle = ?').get(nom);
  assert.equal(ligne.id, avant + 1, 'le numéro suivant, donné à l’application');
  assert.equal(ligne.cle, cleDe(nom));
  assert.equal(ligne.verrou, 0, 'un mot-clé créé n’est pas verrouillé (R219 (5)) tant que le lot ne le demande pas');
  assert.deepEqual(fait.bilan.numeros.map((x) => [x.table, x.colonne, x.numero]), [['mot_cle', 'id', ligne.id]]);
  // le lot du journal est écrit par le service : création du mot-clé (et clés recalculées), de la nature du lot
  const journal = m.db.prepare("SELECT l.nature FROM modification_lot l WHERE l.id = ?").get(fait.lot_id);
  assert.equal(journal.nature, 'code');

  // annuler : le service le supprime ; le numéro ne revient pas
  const retour = annuler(m.db, p.id, {});
  assert.equal(retour.etat, 'annule');
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle WHERE libelle = ?').get(nom).n, 0);
  const autre = libelle('deux');
  const p2 = await proposer(m, lot([creation('a', { libelle: autre, cle: cleDe(autre) })]));
  appliquer(m.db, p2.id, {});
  assert.ok(m.db.prepare('SELECT id FROM mot_cle WHERE libelle = ?').get(autre).id > ligne.id, 'un numéro annulé n’est jamais redonné');
});

test('verrou : le lot qui crée un mot-clé verrouillé demande R218 ; sans l’accord donné au clic il n’est pas appliqué, avec il l’est', async () => {
  const m = nouvelle();
  const nom = libelle('trois');
  const p = await proposer(m, lot([creation('a', { libelle: nom, cle: cleDe(nom), verrou: 1 })]));
  assert.equal(p.verdict, 'verrous');
  assert.deepEqual(lire(m.db, p.id).essai.verrous_a_ouvrir, ['R218']);
  assert.throws(() => appliquer(m.db, p.id, {}), (e) => e instanceof ErreurEdition && e.statut === 409 && /R218/.test(e.message));
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle WHERE libelle = ?').get(nom).n, 0, 'rien n’est écrit sans l’accord');
  appliquer(m.db, p.id, { verrous_ouverts: ['R218'] });
  assert.equal(m.db.prepare('SELECT verrou FROM mot_cle WHERE libelle = ?').get(nom).verrou, 1);
});

test('le lot vérifie la ligne créée : une clé ou un numéro que le service ne retient pas telle quelle refuse l’opération (rien n’est écrit)', async () => {
  const m = nouvelle();
  const nom = libelle('quatre');
  const p = await proposer(m, lot([creation('a', { libelle: nom, cle: `${cleDe(nom)}-autre` })]));
  assert.equal(p.verdict, 'a_corriger');
  const refus = lire(m.db, p.id).essai.operations.find((o) => o.etat === 'refusee');
  assert.ok(refus, 'une opération refusée');
  assert.match(refus.message, /autrement que le lot ne la décrit/);
  assert.match(refus.message, /cle/);
  assert.throws(() => appliquer(m.db, p.id, {}), (e) => e instanceof ErreurEdition && e.statut === 409);
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle WHERE libelle = ?').get(nom).n, 0);
});

test('« verifier_ligne » n’est pas une opération du service d’édition : aucune route ne la joint', () => {
  const m = nouvelle();
  const id = m.db.prepare('SELECT id FROM mot_cle ORDER BY id LIMIT 1').get().id;
  assert.throws(() => enregistrer(m.db, { operations: [{ op: 'verifier_ligne', table: 'mot_cle', cle: { id }, attendu: {} }] }), (e) => e instanceof ErreurEdition && /opération inconnue/.test(e.message));
});

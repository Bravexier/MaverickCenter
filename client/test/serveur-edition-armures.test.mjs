// Édition de la page « Armures » et de son onglet Boucliers depuis le site de dev (serveur/edition-armures.mjs ; demande du propriétaire, 2026-10-15 :
// « Modifiable tout de suite ») : une case modifiée refait ce que la base en tire (prix, AP, AM, résistances et faiblesses d'une armure ; prix, AP, AM
// d'un bouclier, son poids (décision R92) ; prix d'une forme ; Force d'un poids ; coût en RF d'une pièce ; coût et effet d'une amélioration, ligne TOTAL) et la ligne du corps
// Markdown de sa page ; le rejeu du journal (livraison) refait le même corps ; les notes de version les rangent sous « Armures et boucliers ». Les tests
// lisent l'état avant d'écrire : les essais du site de dev peuvent avoir modifié ces lignes.
// Depuis la demande du propriétaire du 2026-10-17 (« C'est en base que les deux devraient être séparées et donc éditable aussi » ; « Le +1matériaux
// devrai être dans le cout […] Valeur d'AP supplémentaire, et Solidité + 1 ou non ») : l'AP et l'AM d'une armure et d'un bouclier, et les quatre cases
// d'une amélioration de bouclier, se saisissent ; la défense écrite et le coût et l'effet écrits en sont refaits ; un lot noté avant se rejoue s'il se
// lit exactement dans ces cases, sinon il passe en conflit avec son explication (serveur/edition-armures.mjs#ancienneEcritureDesArmures).
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, nouveauLot } from '../serveur/edition-journal.mjs';
import {
  COLONNES_CALCULEES_DU_BOUCLIER, prixEcritDeLArmure, prixEcritDuBouclier, TABLES_DES_ENTREES_DU_CALCUL, TABLES_DES_VALEURS_CALCULEES, valeursCalculeesParLeLot,
} from '../serveur/edition-armures.mjs';
import { examinerLeLot } from '../serveur/edition-conflits.mjs';
import * as miseAJour from '../scripts/mise-a-jour-github.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { defenseExacte, nombreEcrit, totalDesAmeliorationsDeProtection } from '../src/lib/armure-champs.mjs';
import { TYPES_DES_MATERIAUX } from '../src/lib/armure-forge.mjs';
import { valeursCalculees } from '../src/lib/armures-db.mjs';
import {
  finDeLigneDArmure, finDeLigneDeBouclier, ligneDAmelioration, ligneDeForme, ligneDePoids, ligneDuTotal, PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS,
} from '../src/lib/corps-armures.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { optionsDuChoix, TABLES } from '../src/lib/edition-modele.mjs';
import { comparerBases } from '../src/lib/notes-de-version.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-armures');
let compteur = 0;
const vivante = (regles = cheminBase({ sansExemples: false })) => ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
/** Les outils d'un essai sur une base vivante : le service, une ligne, le corps d'une page. */
function outils(base) {
  const service = { base: () => base, etat: () => ({}), edition: true };
  return {
    enregistrer: (operations) =>
      traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: `${PAGE_DES_ARMURES}/`, operations }) }, service),
    ligne: (sql, ...p) => base.prepare(sql).get(...p),
    contient: (id, fin) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md.split('\n').some((l) => l.endsWith(fin)),
  };
}
const db = vivante();
const reference = lireTables(db);
const { enregistrer, ligne, contient } = outils(db);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (id, base = db) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;

test('le modèle : armure, pièce, forme, bouclier, poids et amélioration se modifient ; ni création ni suppression ; AP et AM saisis, défense écrite refaite', () => {
  for (const t of ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement']) assert.ok(TABLES[t], t);
  for (const c of ['stats_brut', 'prix', 'nom_cle']) assert.ok(!(c in TABLES.armure.colonnes), `${c} : tirée, jamais saisie`);
  assert.ok(!('defense_brut' in TABLES.bouclier.colonnes), 'bouclier : la défense écrite est tirée de l’AP et de l’AM');
  for (const c of ['ap', 'am']) assert.equal(TABLES.armure.colonnes[c]?.type, 'entier', `armure.${c} : une case entière (armure particulière)`);
  // décision R207 (1), E6 : l'AP, l'AM et le prix d'un bouclier se calculent d'après sa forme et sa matière ; ils restent dans TABLES, comme ceux de
  // l'armure de la grille, pour que leurs cases en lecture (data-ed-lecture) suivent la ligne renvoyée, et le service refuse une valeur changée
  for (const c of ['ap', 'am', 'prix_brut']) {
    assert.ok(c in TABLES.bouclier.colonnes, `bouclier.${c} : lisible par sa case (lireAttributEd)`);
    assert.ok(COLONNES_CALCULEES_DU_BOUCLIER.includes(c), `bouclier.${c} : calculé (R207), refusé à la saisie`);
  }
  assert.ok(COLONNES_CALCULEES_DU_BOUCLIER.every((c) => c in TABLES.bouclier.colonnes));
  assert.equal(TABLES.amelioration_equipement.colonnes.cout_ro.type, 'entier');
  for (const c of ['cout_materiaux', 'bonus_cran']) assert.deepEqual(TABLES.amelioration_equipement.colonnes[c].choix, [{ valeur: '1', libelle: 'Oui' }], `${c} : oui / non`);
});

test('armure de la grille : résistance et faiblesse refont les résistances et sa ligne du corps ; armure particulière : AP, AM et prix refont la défense écrite et le prix', () => {
  const avant = ligne("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1");
  // l'AP et l'AM renvoyés tels qu'en place passent (décision R207 (1) : ils se calculent, une valeur changée est refusée : test « R207 » plus bas)
  const valeurs = { ap: avant.ap === null ? '' : String(avant.ap), resistance_brut: 'x2 Taille', faiblesse_brut: 'Estoc/Frappe' };
  const r = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: avant.id }, valeurs, avant: { ap: avant.ap, am: avant.am } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM armure WHERE id = ?', avant.id);
  assert.deepEqual([apres.ap, apres.am, apres.stats_brut, apres.prix], [avant.ap, avant.am, avant.stats_brut, avant.prix]);
  assert.deepEqual(lignes('SELECT sens, type_degats, multiplicateur FROM armure_degats WHERE armure_id = ? ORDER BY sens, type_degats', avant.id), [
    { sens: 'resistance', type_degats: 'taille', multiplicateur: 2 },
    { sens: 'vulnerabilite', type_degats: 'estoc', multiplicateur: null },
    { sens: 'vulnerabilite', type_degats: 'frappe', multiplicateur: null },
  ]);
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(apres)), 'la ligne du corps suit');
  // une armure particulière garde ses valeurs saisies (R80) : l'AP et l'AM, chacun dans sa case (« +7 » : le signe est permis, comme la page l'envoie
  // d'une saisie), et le prix ; une AP, une AM et un prix autres que ceux en place (lus avant d'écrire)
  const p = ligne("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1");
  const [ap, am, prix] = [(p.ap ?? 0) + 7, (p.am ?? 0) + 3, (p.prix ?? 0) + 1234];
  const rp = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: p.id }, valeurs: { ap: `+${ap}`, am: String(am), prix_brut: String(prix) }, avant: { ap: p.ap, am: p.am } }]);
  assert.equal(rp.statut, 200, JSON.stringify(rp.corps));
  const pApres = ligne('SELECT * FROM armure WHERE id = ?', p.id);
  assert.deepEqual([pApres.ap, pApres.am, pApres.stats_brut, pApres.prix], [ap, am, `+${ap}AP +${am}AM`, prix]);
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(pApres)), 'la ligne du corps suit');
  assert.ok(!contient(PAGE_DES_ARMURES, finDeLigneDArmure(p)));
});

test('armure : une case AP ou AM vidée n’a pas de bonus (« Aucune » quand les deux le sont) ; la défense écrite de la source reste tant qu’elle dit la même chose ; elle ne se saisit plus', () => {
  // « +7AP+12AM » (sans espace, tel qu'écrit dans l'onglet) : une autre case modifiée ne la réécrit pas ; sur les règles d'import (une AP ou une AM
  // modifiée sur le site de dev réécrit la défense, la base courante peut n'en garder aucune)
  const { enregistrer, ligne, contient } = outils(vivante(cheminDImport()));
  const source = ligne("SELECT * FROM armure WHERE stats_brut GLOB '*AP+*AM' ORDER BY ordre LIMIT 1");
  assert.ok(source, 'une défense écrite sans espace dans la source');
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: source.id }, valeurs: { solidite: source.solidite + 1, ap: String(source.ap) } }]).statut, 200);
  assert.equal(ligne('SELECT stats_brut FROM armure WHERE id = ?', source.id).stats_brut, source.stats_brut, 'gardée telle qu’écrite');
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(ligne('SELECT * FROM armure WHERE id = ?', source.id))));
  // une case vidée : sur une armure particulière (celles de la grille se calculent, décision R207 (1)), qui a une AP et une AM
  const p = ligne("SELECT * FROM armure WHERE sorte = 'particuliere' AND ap IS NOT NULL AND am IS NOT NULL ORDER BY ordre LIMIT 1");
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: p.id }, valeurs: { ap: '' } }]).statut, 200);
  let x = ligne('SELECT * FROM armure WHERE id = ?', p.id);
  assert.deepEqual([x.ap, x.am, x.stats_brut], [null, p.am, `+${p.am}AM`]);
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: p.id }, valeurs: { am: '' } }]).statut, 200);
  x = ligne('SELECT * FROM armure WHERE id = ?', p.id);
  assert.deepEqual([x.ap, x.am, x.stats_brut], [null, null, 'Aucune']);
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(x)), 'la ligne du corps suit');
  // la défense écrite n'est plus une case ; une valeur qui n'est pas un entier est refusée
  for (const valeurs of [{ stats_brut: '+5AP' }, { ap: '5,5' }, { am: 'beaucoup' }]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: p.id }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  }
  assert.equal(ligne('SELECT stats_brut FROM armure WHERE id = ?', p.id).stats_brut, 'Aucune');
});

test('armure : un nom renommé change sa clé ; « ???? » donne un prix inconnu ; type hors liste, résistance d’une armure particulière, effet d’une combinaison, nom sans lettre ni chiffre, prix illisible : refusés', () => {
  const particuliere = ligne("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1");
  const r = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: particuliere.id }, valeurs: { nom: `${particuliere.nom} renommée`, prix_brut: '????', effet: '+1 INI' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM armure WHERE id = ?', particuliere.id);
  assert.equal(apres.prix, null);
  assert.ok(apres.nom_cle.endsWith('-renommee'));
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(apres)));
  const combinaison = ligne("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre DESC LIMIT 1");
  for (const [cle, valeurs] of [
    [particuliere.id, { resistance_brut: 'Taille' }],
    [combinaison.id, { effet: 'Un effet' }],
    [combinaison.id, { type: 'Inconnu' }],
    [combinaison.id, { nom: '—' }],
    [combinaison.id, { prix_brut: '2050 RO' }],
  ]) assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: cle }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  // une case vide (armure particulière : la grille calcule le sien, R207) : la source ne donne pas le prix
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: particuliere.id }, valeurs: { prix_brut: '' } }]).statut, 200);
  assert.equal(ligne('SELECT prix FROM armure WHERE id = ?', particuliere.id).prix, null);
});

test('bouclier, forme, poids et pièce : colonnes tirées et lignes du corps ; un prix de forme, une Force, un coût de pièce illisibles sont refusés', () => {
  const b = ligne('SELECT * FROM bouclier ORDER BY id LIMIT 1');
  // décision R207 (1), E6 : l'AP, l'AM et le prix d'un bouclier se calculent (forme et matière) ; la défense écrite n'est plus une case
  // une valeur changée (différente de celle en place) est refusée, avec la décision ; une colonne hors du modèle aussi
  const autre = (v) => String((v ?? 0) + 1);
  for (const valeurs of [{ prix_brut: `${autre(b.prix)},5` }, { ap: autre(b.ap) }, { am: autre(b.am) }]) {
    const r = enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs }]);
    assert.equal(r.statut, 400, JSON.stringify(valeurs));
    assert.match(r.corps.erreur, /R207/, JSON.stringify(valeurs));
  }
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { defense_brut: '+9AP +4AM' } }]).statut, 400);
  const bApres = ligne('SELECT * FROM bouclier WHERE id = ?', b.id);
  assert.deepEqual([bApres.ap, bApres.am, bApres.defense_brut, bApres.prix, bApres.prix_brut], [b.ap, b.am, b.defense_brut, b.prix, b.prix_brut]);
  // renvoyées telles qu'en place (le formulaire d'une autre case de la ligne), elles passent : rien ne change
  const telles = { ap: b.ap === null ? '' : String(b.ap), am: b.am === null ? '' : String(b.am), prix_brut: b.prix_brut ?? '' };
  const rTelles = enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: telles }]);
  assert.equal(rTelles.statut, 200, JSON.stringify(rTelles.corps));
  assert.deepEqual({ ...ligne('SELECT ap, am, prix, prix_brut, defense_brut FROM bouclier WHERE id = ?', b.id) },
    { ap: b.ap, am: b.am, prix: b.prix, prix_brut: b.prix_brut, defense_brut: b.defense_brut });

  // le poids (décision R92, migration 0054) : un poids de la liste, obligatoire ; un identifiant inconnu est refusé (clé étrangère), un poids vide aussi
  const autrePoids = ligne('SELECT id FROM bouclier_poids WHERE id <> ? ORDER BY ordre LIMIT 1', b.poids_id ?? '').id;
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { poids_id: autrePoids } }]).statut, 200);
  assert.equal(ligne('SELECT poids_id FROM bouclier WHERE id = ?', b.id).poids_id, autrePoids);
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { poids_id: 'plume' } }]).statut, 422);
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { poids_id: '' } }]).statut, 400);
  assert.equal(ligne('SELECT poids_id FROM bouclier WHERE id = ?', b.id).poids_id, autrePoids);
  assert.ok(contient(PAGE_DES_BOUCLIERS, finDeLigneDeBouclier(bApres)), 'le corps ne change pas avec le poids');

  const f = ligne('SELECT * FROM bouclier_classe WHERE classe = 2');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: f.id }, valeurs: { nom: `${f.nom} bis`, prix_brut: '6,5' } }]).statut, 200);
  const fApres = ligne('SELECT * FROM bouclier_classe WHERE id = ?', f.id);
  assert.equal(fApres.prix, 6.5);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDeForme(fApres)));
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(`### ${fApres.nom}`), 'le titre du tableau de la forme suit');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: f.id }, valeurs: { prix_brut: 'cher' } }]).statut, 400);

  const p = ligne('SELECT * FROM bouclier_poids ORDER BY ordre LIMIT 1');
  const force = (p.force_min ?? 0) + 1; // une autre Force que celle en place (lue avant d'écrire)
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_poids', cle: { id: p.id }, valeurs: { force_brut: `${force} de Force minimum` } }]).statut, 200);
  const pApres = ligne('SELECT * FROM bouclier_poids WHERE id = ?', p.id);
  assert.equal(pApres.force_min, force);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDePoids(pApres)));
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_poids', cle: { id: p.id }, valeurs: { force_brut: 'beaucoup' } }]).statut, 400);

  const piece = ligne("SELECT * FROM armure_emplacement WHERE id = 'casque'");
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: piece.id }, valeurs: { cout_brut: '200 RF / 2 RO' } }]).statut, 200);
  assert.equal(ligne("SELECT cout_rf FROM armure_emplacement WHERE id = 'casque'").cout_rf, 200);
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes(`| ${piece.nom} | 200 RF / 2 RO |`));
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: piece.id }, valeurs: { cout_brut: '2 RO' } }]).statut, 400);
  // la ligne du bouclier : « 250 RF / Classe », sans montant fixe
  const ligneDuBouclier = ligne("SELECT * FROM armure_emplacement WHERE id = 'bouclier'");
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: 'bouclier' }, valeurs: { cout_brut: ligneDuBouclier.cout_brut.replace(/^\d+/, '300') } }]).statut, 200);
  assert.equal(ligne("SELECT cout_rf FROM armure_emplacement WHERE id = 'bouclier'").cout_rf, null);
});

/**
 * Décision R207 (1), E6 : les colonnes calculées de `base` valent la formule (lib/armures-db.mjs#valeursCalculees) pour toute la grille et tous les
 * boucliers, leur défense et leur prix écrits s'y lisent, et la ligne du corps de chacune est celle de la ligne.
 */
function verifierE6(base) {
  const { armures, boucliers } = valeursCalculees(base);
  const lignesDu = (id) => new Set(base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md.split('\n'));
  const corpsArmures = [...lignesDu(PAGE_DES_ARMURES)];
  const corpsBoucliers = [...lignesDu(PAGE_DES_BOUCLIERS)];
  for (const a of base.prepare("SELECT * FROM armure WHERE sorte = 'combinaison'").all()) {
    const c = armures.get(a.id);
    assert.deepEqual([a.type, a.ap, a.am, a.prix], [c.type, c.ap, c.am, c.prix], a.id);
    assert.equal(nombreEcrit(a.prix_brut), a.prix, `${a.id} : prix écrit`);
    if (a.prix !== null) assert.equal(a.prix_brut, prixEcritDeLArmure(a.prix), `${a.id} : prix écrit au format de la colonne (« 2 500 »)`);
    assert.deepEqual(defenseExacte(a.stats_brut), { ap: a.ap, am: a.am }, `${a.id} : défense écrite`);
    assert.ok(corpsArmures.some((l) => l.endsWith(finDeLigneDArmure(a))), `${a.id} : ligne du corps`);
  }
  for (const b of base.prepare('SELECT * FROM bouclier').all()) {
    const c = boucliers.get(b.id);
    assert.deepEqual([b.ap, b.am, b.prix], [c.ap, c.am, c.prix], b.id);
    assert.equal(nombreEcrit(b.prix_brut), b.prix, `${b.id} : prix écrit`);
    if (b.prix !== null) assert.equal(b.prix_brut, prixEcritDuBouclier(b.prix), `${b.id} : prix écrit au format de la colonne (« 1207,5 »)`);
    assert.deepEqual(defenseExacte(b.defense_brut), { ap: b.ap, am: b.am }, `${b.id} : défense écrite`);
    assert.ok(corpsBoucliers.some((l) => l.endsWith(finDeLigneDeBouclier(b))), `${b.id} : ligne du corps`);
  }
}

test('R207 (1) : le type, l’AP, l’AM et le prix d’une armure de la grille ne se saisissent pas (400, rien d’écrit) ; renvoyés tels qu’en place, ils passent', () => {
  const a = ligne("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre DESC LIMIT 1 OFFSET 1");
  for (const valeurs of [{ type: TYPES_DES_MATERIAUX.find((t) => t !== a.type) }, { ap: String((a.ap ?? 0) + 1) }, { am: String((a.am ?? 0) + 1) },
    { prix_brut: String((a.prix ?? 0) + 1) }]) {
    const r = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: a.id }, valeurs }]);
    assert.equal(r.statut, 400, JSON.stringify(valeurs));
    assert.match(r.corps.erreur, /se calculent d’après ses deux matériaux \(décision R207\)/);
  }
  assert.deepEqual({ ...ligne('SELECT * FROM armure WHERE id = ?', a.id) }, { ...a }, 'rien d’écrit');
  const telles = { type: a.type, ap: a.ap === null ? '' : String(a.ap), am: a.am === null ? '' : String(a.am), prix_brut: a.prix_brut, solidite: String(a.solidite + 1) };
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: a.id }, valeurs: telles }]).statut, 200);
  const apres = ligne('SELECT * FROM armure WHERE id = ?', a.id);
  assert.deepEqual([apres.type, apres.ap, apres.am, apres.prix, apres.solidite], [a.type, a.ap, a.am, a.prix, a.solidite + 1]);
});

test('R207 (1) : un matériau modifié (prix, type), le coût de « Armure Complète » ou le prix d’une forme : la grille et les boucliers suivent la formule, et leur page', () => {
  verifierE6(db);
  // un matériau d'armure et de bouclier (choisi par id dans l'état courant) : son prix (page Composants) change ses armures et ses boucliers
  const m = ligne(`SELECT r.* FROM ressource r JOIN materiau_armure a ON a.ressource_id = r.id JOIN materiau_bouclier b ON b.ressource_id = r.id
    WHERE r.prix_rf IS NOT NULL ORDER BY r.id LIMIT 1`);
  const lesSiennes = () => lignes(`SELECT id, type, prix FROM armure WHERE sorte = 'combinaison' AND ? IN (materiau_ligne_id, materiau_colonne_id) ORDER BY id`, m.id);
  const sesBoucliers = () => lignes('SELECT id, prix FROM bouclier WHERE materiau_id = ? ORDER BY id', m.id);
  const [armuresAvant, boucliersAvant] = [lesSiennes(), sesBoucliers()];
  assert.ok(armuresAvant.length && boucliersAvant.length);
  const autres = () => lignes(`SELECT id, prix FROM armure WHERE sorte = 'combinaison' AND ? NOT IN (materiau_ligne_id, materiau_colonne_id) ORDER BY id`, m.id);
  const autresAvant = autres();
  const prix = `${String((m.prix_rf + 100) / 100).replace('.', ',')} RO`;
  const r = enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: m.id }, valeurs: { prix_brut: prix } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT prix_rf FROM ressource WHERE id = ?', m.id).prix_rf, m.prix_rf + 100);
  verifierE6(db);
  for (const [avant, apres] of [[armuresAvant, lesSiennes()], [boucliersAvant, sesBoucliers()]]) {
    for (const [i, x] of apres.entries()) assert.ok(x.prix > avant[i].prix, `${x.id} : son prix suit celui du matériau`);
  }
  assert.deepEqual(autres(), autresAvant, 'les armures sans ce matériau ne changent pas');

  // son type : l'armure de ce seul matériau (sa case de la diagonale) prend le type ; les autres, le plus lourd des deux (verifierE6)
  const fiche = ligne('SELECT type FROM materiau_armure WHERE ressource_id = ?', m.id);
  const type = TYPES_DES_MATERIAUX.find((t) => t !== fiche.type);
  assert.equal(enregistrer([{ op: 'modifier', table: 'materiau', cle: { ressource_id: m.id }, valeurs: { type } }]).statut, 200);
  assert.equal(ligne('SELECT type FROM materiau_armure WHERE ressource_id = ?', m.id).type, type);
  const seul = ligne("SELECT type FROM armure WHERE sorte = 'combinaison' AND materiau_ligne_id = ? AND materiau_colonne_id = ?", m.id, m.id);
  if (seul) assert.equal(seul.type, type);
  verifierE6(db);

  // le coût de « Armure Complète » (tableau FABRICATION) : toute la grille ; un autre montant que celui en place, lu avant d'écrire
  const complete = ligne("SELECT * FROM armure_emplacement WHERE id = 'armure-complete'");
  const grilleAvant = lignes("SELECT id, prix FROM armure WHERE sorte = 'combinaison' ORDER BY id");
  const rf = complete.cout_rf + 100;
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: complete.id }, valeurs: { cout_brut: `${rf} RF / ${rf / 100} RO` } }]).statut, 200);
  verifierE6(db);
  for (const [i, a] of lignes("SELECT id, prix FROM armure WHERE sorte = 'combinaison' ORDER BY id").entries()) {
    if (grilleAvant[i].prix !== null) assert.equal(a.prix, Math.round((grilleAvant[i].prix + 1) * 100) / 100, a.id);
  }

  // le prix d'une forme : ses boucliers (classe × matière + prix de la forme) ; les autres formes ne changent pas
  const forme = ligne('SELECT * FROM bouclier_classe ORDER BY classe DESC LIMIT 1');
  const autresBoucliers = lignes('SELECT id, prix FROM bouclier WHERE classe_id <> ? ORDER BY id', forme.id);
  const sesBoucliersAvant = lignes('SELECT id, prix FROM bouclier WHERE classe_id = ? ORDER BY id', forme.id);
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: forme.id }, valeurs: { prix_brut: String(forme.prix + 1).replace('.', ',') } }]).statut, 200);
  verifierE6(db);
  for (const [i, b] of lignes('SELECT id, prix FROM bouclier WHERE classe_id = ? ORDER BY id', forme.id).entries()) {
    if (sesBoucliersAvant[i].prix !== null) assert.equal(b.prix, Math.round((sesBoucliersAvant[i].prix + 1) * 100) / 100, b.id);
  }
  assert.deepEqual(lignes('SELECT id, prix FROM bouclier WHERE classe_id <> ? ORDER BY id', forme.id), autresBoucliers);
});

test('R207 (1) : le prix écrit recalculé garde le format de sa colonne (bouclier « 1207,5 », armure « 2 500 ») ; un recalcul sans changement n’écrit rien', () => {
  // le format de la donnée en place (classeur, migrations 0105 et 0108) : aucun séparateur de milliers pour un bouclier, une espace pour une armure
  assert.deepEqual([1207.5, 1210, 12, 112.5, 2012.5].map(prixEcritDuBouclier), ['1207,5', '1210', '12', '112,5', '2012,5']);
  assert.deepEqual([2500, 640, 1300.5].map(prixEcritDeLArmure), ['2 500', '640', '1 300,5']);
  assert.equal(prixEcritDuBouclier(null), null);
  const base = vivante();
  const o = outils(base);
  // aucune valeur calculée ne s'écarte de la formule : le recalcul après un lot qui écrit une entrée du calcul n'écrit rien
  const avant = base.prepare('SELECT id, prix, prix_brut, ap, am, defense_brut FROM bouclier ORDER BY id').all().map((l) => ({ ...l }));
  assert.deepEqual(valeursCalculeesParLeLot(base, [{ lot_id: 'essai', rang: 1, table_nom: 'ressource' }]), []);
  // par le service : une entrée du calcul modifiée sans changer aucun prix (la description d'un matériau) ne note ni armure ni bouclier
  const m = o.ligne('SELECT r.* FROM ressource r JOIN materiau_bouclier b ON b.ressource_id = r.id ORDER BY r.id LIMIT 1');
  const r = o.enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: m.id }, valeurs: { description: `${m.description ?? ''} (essai)` } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const notees = base.prepare('SELECT table_nom FROM modification WHERE lot_id = ?').all(r.corps.lot).map((x) => x.table_nom);
  assert.ok(notees.includes('ressource') && !notees.some((t) => t === 'armure' || t === 'bouclier'), JSON.stringify(notees));
  assert.deepEqual(base.prepare('SELECT id, prix, prix_brut, ap, am, defense_brut FROM bouclier ORDER BY id').all().map((l) => ({ ...l })), avant);
  // un prix de forme qui change : ses boucliers au-delà de 1 000 RO s'écrivent sans séparateur de milliers (verifierE6), comme le classeur
  const forme = o.ligne('SELECT c.* FROM bouclier_classe c JOIN bouclier b ON b.classe_id = c.id WHERE b.prix >= 1000 ORDER BY c.classe DESC LIMIT 1');
  assert.ok(forme, 'un bouclier de plus de 1 000 RO');
  assert.equal(o.enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: forme.id }, valeurs: { prix_brut: String(forme.prix + 1).replace('.', ',') } }]).statut, 200);
  const chers = base.prepare('SELECT id, prix, prix_brut FROM bouclier WHERE classe_id = ? AND prix >= 1000').all(forme.id);
  assert.ok(chers.length);
  for (const b of chers) assert.match(b.prix_brut, /^\d+(,\d+)?$/, b.id);
  verifierE6(base);
  base.close();
});

test('améliorations d’armure et de bouclier : coût et effet refont RO, matériaux (R76), AP, AM, crans, et la ligne TOTAL de leur tableau', () => {
  const armure = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'armure' AND niveau = 3");
  // un coût et un effet autres que ceux en place (lus avant d'écrire : le site de dev a pu les changer)
  const [roA, apA] = armure.cout_ro === 350 ? [360, 8] : [350, 7];
  let r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: armure.id }, valeurs: { cout_brut: `${roA} + 1 Matériau`, effet_brut: `+${apA} AP/AM, +1 cran de solidité` } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const aApres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', armure.id);
  assert.deepEqual([aApres.cout_ro, aApres.cout_materiaux, aApres.bonus_ap, aApres.bonus_am, aApres.bonus_cran], [roA, 1, apA, apA, 1]);
  const totalA = totalDesAmeliorationsDeProtection('armure', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'armure'"));
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'armure'").total_brut, totalA);
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes(ligneDAmelioration(aApres)));
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes(ligneDuTotal(totalA)));

  // une amélioration d'armure garde son coût et son effet écrits : les cases d'un bouclier y sont refusées
  for (const valeurs of [{ cout_ro: '400' }, { bonus_cran: '1' }]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: armure.id }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  }

  // une amélioration de bouclier : quatre cases (demande du propriétaire, 2026-10-17) ; le coût et l'effet écrits en sont refaits, le matériau du côté du coût
  const bouclier = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 3");
  for (const valeurs of [{ effet_brut: '+6 AP + matériaux' }, { cout_brut: '200' }]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: bouclier.id }, valeurs }]).statut, 400, `${JSON.stringify(valeurs)} : ne se saisit plus`);
  }
  for (const valeurs of [{ cout_materiaux: '2' }, { bonus_cran: 'oui' }, { cout_ro: '' }, { cout_ro: '-5' }]) {
    assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: bouclier.id }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  }
  // un coût et un AP autres que ceux en place (lus avant d'écrire : le site de dev a pu les changer), pour que la note de version les voie
  const ro = bouclier.cout_ro === 250 ? 260 : 250;
  const ap = bouclier.bonus_ap === 7 ? 8 : 7;
  r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: bouclier.id }, valeurs: { cout_ro: String(ro), cout_materiaux: '1', bonus_ap: String(ap), bonus_cran: '1' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  let bApres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', bouclier.id);
  assert.deepEqual([bApres.cout_ro, bApres.cout_materiaux, bApres.bonus_ap, bApres.bonus_am, bApres.bonus_cran], [ro, 1, ap, null, 1]);
  assert.deepEqual([bApres.cout_brut, bApres.effet_brut], [`${ro} + 1 Matériau`, `+${ap} AP, +1 cran de solidité`]);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDAmelioration(bApres)), 'la ligne du corps suit');
  // « Non » : la case vidée (NULL)
  r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: bouclier.id }, valeurs: { cout_materiaux: '', bonus_cran: '' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  bApres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', bouclier.id);
  assert.deepEqual([bApres.cout_materiaux, bApres.bonus_cran, bApres.cout_brut, bApres.effet_brut], [null, null, String(ro), `+${ap} AP`]);
  // une case enregistrée à la même valeur ne réécrit pas l'écriture de la source (« +4 AP + matériaux » au +2)
  const deux = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 2");
  assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: deux.id }, valeurs: { bonus_ap: String(deux.bonus_ap), cout_materiaux: deux.cout_materiaux ? '1' : '' } }]).statut, 200);
  assert.deepEqual({ ...ligne('SELECT cout_brut, effet_brut FROM amelioration_equipement WHERE id = ?', deux.id) }, { cout_brut: deux.cout_brut, effet_brut: deux.effet_brut });
  const totalB = totalDesAmeliorationsDeProtection('bouclier', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier'"));
  assert.match(totalB, /^\d+$/, 'les RO seuls, comme l’onglet (« 1550 ») : les matériaux sont comptés par la page');
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'bouclier'").total_brut, totalB);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDuTotal(totalB)));
});

test('notes de version : les modifications des armures et des boucliers sont rangées sous « Armures et boucliers »', () => {
  // un cran de solidité donné à une amélioration de bouclier qui n'en a pas (lu avant d'écrire) : une ligne « Non » → « Oui »
  const sansCran = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND bonus_cran IS NULL AND niveau <> 3 ORDER BY niveau LIMIT 1");
  assert.ok(sansCran, 'une amélioration de bouclier sans cran');
  assert.equal(enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: sansCran.id }, valeurs: { bonus_cran: '1' } }]).statut, 200);
  const lignesDeNote = comparerBases(reference, lireTables(db)).filter((l) => l.domaine === 'armures');
  const tables = new Set(lignesDeNote.map((l) => l.table_nom));
  for (const t of ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement']) assert.ok(tables.has(t), t);
  assert.ok(lignesDeNote.some((l) => l.groupe === 'Améliorations de bouclier'));
  assert.ok(!comparerBases(reference, lireTables(db)).some((l) => l.domaine === 'armes' && l.table_nom === 'amelioration_equipement'), 'pas sous les armes');
  // les cases saisies, pas les textes refaits : l'AP et l'AM d'une armure ; le prix d'un bouclier, calculé (décision R207 (1) : un matériau modifié plus
  // haut l'a changé) ; les quatre cases d'une amélioration de bouclier, le coût en matériaux et le cran en « Oui » / « Non »
  const colonnes = (table, groupe) => new Set(lignesDeNote.filter((l) => l.table_nom === table && (!groupe || l.groupe === groupe)).map((l) => l.colonne));
  for (const [table, saisies, refaites] of [['armure', ['ap', 'am'], ['stats_brut']], ['bouclier', ['prix_brut'], ['defense_brut']]]) {
    for (const c of saisies) assert.ok(colonnes(table).has(c), `${table} : ${c}`);
    for (const c of refaites) assert.ok(!colonnes(table).has(c), `${table} : ${c} n’est pas listée`);
  }
  const deBouclier = colonnes('amelioration_equipement', 'Améliorations de bouclier');
  for (const c of ['cout_ro', 'bonus_ap', 'bonus_cran']) assert.ok(deBouclier.has(c), c);
  for (const c of ['cout_brut', 'effet_brut']) assert.ok(!deBouclier.has(c), `${c} : refaite, pas listée`);
  const cran = lignesDeNote.find((l) => l.groupe === 'Améliorations de bouclier' && l.colonne === 'bonus_cran' && l.entite === `Amélioration +${sansCran.niveau}`);
  assert.deepEqual([cran.avant, cran.apres], ['Non', 'Oui'], JSON.stringify(cran));
  assert.deepEqual([...colonnes('amelioration_equipement', 'Améliorations d’armure')].sort(), ['cout_brut', 'effet_brut'], 'une amélioration d’armure : son coût et son effet écrits');
});

test('rejeu du journal (livraison) : les mêmes lignes et les mêmes corps de pages sur des règles neuves', () => {
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  assert.deepEqual(sortie.illisibles, []);
  for (const id of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS]) {
    assert.ok(sortie.pages.includes(id), `${id} refaite`);
    assert.equal(corps(id, neuve), corps(id), id);
  }
  for (const t of ['armure', 'armure_degats', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement', 'amelioration_total']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  }
  neuve.close();
});

test('rejeu d’un lot noté avant la saisie de l’AP et de l’AM et des cases d’une amélioration de bouclier : rejoué s’il s’y lit exactement, sinon en conflit expliqué', () => {
  // les règles d'import : ces lots sont écrits comme le site de dev les notait sur elles (cases d'amélioration, défense écrite)
  const neuve = vivante(cheminDImport());
  // une armure particulière pour le lot exact (celles de la grille se calculent depuis la décision R207 (1) : un lot qui les écrit est en conflit)
  const armure = neuve.prepare("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre DESC LIMIT 1").get();
  const autre = neuve.prepare("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre DESC LIMIT 1").get();
  const bouclier = neuve.prepare('SELECT * FROM bouclier ORDER BY id DESC LIMIT 1').get();
  const amelioration = neuve.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 1").get();
  const amelioration5 = neuve.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 5").get();
  // l'ancienne forme : le texte saisi, et ce que le service en tirait, notés ensemble
  const lot = (table, cle, avant, apres) => {
    const { id, instant } = nouveauLot();
    return { id, fait_le: instant, page_id: null, resume: 'ancien lot', modifications: [{ rang: 1, table, cle, operation: 'modifier', avant, apres }] };
  };
  const lots = [
    lot('armure', { id: armure.id }, { stats_brut: armure.stats_brut, ap: armure.ap, am: armure.am }, { stats_brut: '+21AP+4AM', ap: 21, am: 4 }),
    lot('armure', { id: autre.id }, { stats_brut: autre.stats_brut, ap: autre.ap }, { stats_brut: '+21AP (la nuit)', ap: 21 }),
    lot('bouclier', { id: bouclier.id }, { defense_brut: bouclier.defense_brut }, { defense_brut: 'Voir l’effet' }),
    lot('amelioration_equipement', { id: amelioration.id }, { effet_brut: amelioration.effet_brut, cout_materiaux: amelioration.cout_materiaux },
      { effet_brut: '+2 AP, +1 cran de solidité + matériaux', cout_materiaux: 1 }),
    lot('amelioration_equipement', { id: amelioration5.id }, { effet_brut: amelioration5.effet_brut, bonus_am: amelioration5.bonus_am },
      { effet_brut: '+10 AP/AM, +1 cran de solidité', bonus_am: 10 }),
  ];
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, { format: 'maverick-edition/1', lots });
  rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  const etat = (l) => neuve.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(l.id);
  // exact : rejoué tel quel, en attente de livraison (l'écriture notée reste, elle se lit exactement en l'AP et l'AM notés)
  assert.equal(etat(lots[0]).etat, 'en_attente', JSON.stringify(etat(lots[0])));
  assert.deepEqual({ ...neuve.prepare('SELECT stats_brut, ap, am FROM armure WHERE id = ?').get(armure.id) }, { stats_brut: '+21AP+4AM', ap: 21, am: 4 });
  assert.equal(etat(lots[3]).etat, 'en_attente', JSON.stringify(etat(lots[3])));
  assert.equal(neuve.prepare('SELECT cout_materiaux FROM amelioration_equipement WHERE id = ?').get(amelioration.id).cout_materiaux, 1);
  // pas exact : en conflit, avec ce qu'il faut refaire ; rien n'est écrit
  for (const [l, mot] of [[lots[1], 'cases AP et AM'], [lots[2], 'cases AP et AM'], [lots[4], 'au plus un cran de solidité']]) {
    const e = etat(l);
    assert.equal(e.etat, 'conflit', JSON.stringify(e));
    assert.ok(e.detail.includes('demande du propriétaire du 2026-10-17') && e.detail.includes(mot), e.detail);
  }
  assert.equal(neuve.prepare('SELECT stats_brut FROM armure WHERE id = ?').get(autre.id).stats_brut, autre.stats_brut);
  assert.equal(neuve.prepare('SELECT defense_brut FROM bouclier WHERE id = ?').get(bouclier.id).defense_brut, bouclier.defense_brut);
  assert.equal(neuve.prepare('SELECT bonus_am FROM amelioration_equipement WHERE id = ?').get(amelioration5.id).bonus_am, null);
  neuve.close();
});

/** Rejoue des lots notés à l'ancienne sur des règles neuves : la base, l'état de chaque lot ({ etat, detail } de sa première modification). */
function rejouerDesLots(fabriquer) {
  const neuve = vivante(cheminDImport()); // les règles d'import, sur lesquelles ces lots ont été notés
  const lot = (table, cle, avant, apres) => {
    const { id, instant } = nouveauLot();
    return { id, fait_le: instant, page_id: null, resume: 'ancien lot', modifications: [{ rang: 1, table, cle, operation: 'modifier', avant, apres }] };
  };
  const lots = fabriquer(neuve, lot);
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, { format: 'maverick-edition/1', lots });
  rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  return { neuve, etat: (l) => ({ ...neuve.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(l.id) }) };
}

test('rejeu : jamais vers une ligne dont le texte et les cases divergent — la ligne après la modification doit se lire exactement en ses cases', () => {
  let a1;
  let a2;
  let armure;
  let bouclier;
  let virgule;
  const lots = [];
  const { neuve, etat } = rejouerDesLots((db, lot) => {
    a1 = db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 1").get();
    a2 = db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 2").get();
    armure = db.prepare("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1").get();
    // une armure particulière : celles de la grille se calculent (décision R207 (1)), un lot qui les écrit est en conflit
    virgule = db.prepare("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1").get();
    bouclier = db.prepare('SELECT * FROM bouclier ORDER BY id LIMIT 1').get();
    lots.push(
      // « + 2 AP » (signe détaché) : l'ancien service ne lisait ni l'AP ni le cran (analyserAmeliorationDeProtection) et notait des cases vides
      lot('amelioration_equipement', { id: a1.id }, { effet_brut: a1.effet_brut, bonus_ap: a1.bonus_ap, bonus_cran: a1.bonus_cran },
        { effet_brut: '+ 2 AP, + 1 cran de solidité', bonus_ap: null, bonus_cran: null }),
      // un texte exact, mais des cases notées qui n'en sont pas la lecture
      lot('amelioration_equipement', { id: a2.id }, { effet_brut: a2.effet_brut, bonus_ap: a2.bonus_ap }, { effet_brut: '+3 AP', bonus_ap: 5 }),
      lot('armure', { id: armure.id }, { stats_brut: armure.stats_brut, ap: armure.ap, am: armure.am }, { stats_brut: '+21AP +4AM', ap: 20, am: 4 }),
      // les cases seules, sans le texte : la ligne garderait la défense écrite des règles
      lot('bouclier', { id: bouclier.id }, { ap: bouclier.ap }, { ap: (bouclier.ap ?? 0) + 7 }),
      // rien de perdu : « +5AP, +6AM » se lit exactement (virgule) en ce que l'ancien service notait, le lot passe (pas de mise à jour bloquée)
      lot('armure', { id: virgule.id }, { stats_brut: virgule.stats_brut, ap: virgule.ap, am: virgule.am }, { stats_brut: '+5AP, +6AM', ap: 5, am: 6 }),
    );
    return lots;
  });
  for (const [l, mot] of [[lots[0], 'ne se lisent pas exactement'], [lots[1], 'mais la ligne aurait'], [lots[2], 'mais la ligne aurait AP 20, AM 4'], [lots[3], 'mais la ligne aurait']]) {
    const e = etat(l);
    assert.equal(e.etat, 'conflit', JSON.stringify(e));
    assert.ok(e.detail.includes(mot), e.detail);
  }
  // rien n'est écrit : la ligne reste celle des règles, texte et cases d'accord
  assert.deepEqual({ ...neuve.prepare('SELECT effet_brut, bonus_ap, bonus_cran FROM amelioration_equipement WHERE id = ?').get(a1.id) },
    { effet_brut: a1.effet_brut, bonus_ap: a1.bonus_ap, bonus_cran: a1.bonus_cran });
  assert.deepEqual({ ...neuve.prepare('SELECT effet_brut, bonus_ap FROM amelioration_equipement WHERE id = ?').get(a2.id) }, { effet_brut: a2.effet_brut, bonus_ap: a2.bonus_ap });
  assert.deepEqual({ ...neuve.prepare('SELECT stats_brut, ap FROM armure WHERE id = ?').get(armure.id) }, { stats_brut: armure.stats_brut, ap: armure.ap });
  assert.equal(neuve.prepare('SELECT ap FROM bouclier WHERE id = ?').get(bouclier.id).ap, bouclier.ap);
  assert.equal(etat(lots[4]).etat, 'en_attente', JSON.stringify(etat(lots[4])));
  assert.deepEqual({ ...neuve.prepare('SELECT stats_brut, ap, am FROM armure WHERE id = ?').get(virgule.id) }, { stats_brut: '+5AP, +6AM', ap: 5, am: 6 });
  neuve.close();
});

test('rejeu : un lot mis en conflit n’emporte pas un lot indépendant sur la même amélioration ; un lot suivant se lit avec ceux qui passent', () => {
  let a3;
  const lots = [];
  const { neuve, etat } = rejouerDesLots((db, lot) => {
    a3 = db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 3").get();
    lots.push(
      // L1 : un effet qui ne se lit pas exactement (« brille ») → conflit
      lot('amelioration_equipement', { id: a3.id }, { effet_brut: a3.effet_brut }, { effet_brut: `${a3.effet_brut}, brille` }),
      // L2 : le coût seul, indépendant de L1 → passe, lu avec l'effet des règles (et non celui de L1)
      lot('amelioration_equipement', { id: a3.id }, { cout_brut: a3.cout_brut, cout_ro: a3.cout_ro }, { cout_brut: '250', cout_ro: 250 }),
      // L3 : l'effet, puis L4 : le coût en matériaux seul, lu avec l'effet que L3 a noté (« + matériaux » : 1, R76)
      lot('amelioration_equipement', { id: a3.id }, { effet_brut: a3.effet_brut, bonus_ap: a3.bonus_ap, cout_materiaux: a3.cout_materiaux },
        { effet_brut: '+7 AP + matériaux', bonus_ap: 7, cout_materiaux: 1 }),
      lot('amelioration_equipement', { id: a3.id }, { cout_brut: '250', cout_ro: 250 }, { cout_brut: '260', cout_ro: 260 }),
    );
    return lots;
  });
  const e1 = etat(lots[0]);
  assert.equal(e1.etat, 'conflit', JSON.stringify(e1));
  for (const l of lots.slice(1)) assert.equal(etat(l).etat, 'en_attente', JSON.stringify(etat(l)));
  assert.deepEqual({ ...neuve.prepare('SELECT cout_brut, cout_ro, cout_materiaux, effet_brut, bonus_ap FROM amelioration_equipement WHERE id = ?').get(a3.id) },
    { cout_brut: '260', cout_ro: 260, cout_materiaux: 1, effet_brut: '+7 AP + matériaux', bonus_ap: 7 });
  neuve.close();
});

test('mode modification : la liste d’un choix garde la valeur de la base qu’elle n’a pas (un « 2 » de coût en matériaux n’est jamais remis à vide sans qu’on y touche)', () => {
  const champ = TABLES.amelioration_equipement.colonnes.cout_materiaux;
  assert.deepEqual(optionsDuChoix(champ, champ.choix, null), [{ valeur: '', libelle: 'Non' }, { valeur: '1', libelle: 'Oui' }]);
  assert.deepEqual(optionsDuChoix(champ, champ.choix, 1), [{ valeur: '', libelle: 'Non' }, { valeur: '1', libelle: 'Oui' }]);
  assert.deepEqual(optionsDuChoix(champ, champ.choix, 2), [{ valeur: '', libelle: 'Non' }, { valeur: '1', libelle: 'Oui' }, { valeur: '2', libelle: '2' }]);
  // un choix requis n'a pas d'option vide ; « — » par défaut pour un choix non requis sans libellé
  assert.deepEqual(optionsDuChoix({ requis: true }, [{ valeur: 'a', libelle: 'A' }], 'a'), [{ valeur: 'a', libelle: 'A' }]);
  assert.deepEqual(optionsDuChoix({}, [], 'x'), [{ valeur: '', libelle: '—' }, { valeur: 'x', libelle: 'x' }]);
});

/** Rejoue des lots sur une base vivante neuve (règles courantes) : la base, la sortie du rejeu, l'état de chaque lot. */
function rejouerSurLesRegles(fabriquer) {
  const neuve = vivante();
  const lot = (modifications) => {
    const { id, instant } = nouveauLot();
    return { id, fait_le: instant, page_id: null, resume: 'ancien lot', modifications: modifications.map((x, i) => ({ rang: i + 1, operation: 'modifier', ...x })) };
  };
  const lots = fabriquer(neuve, lot);
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, { format: 'maverick-edition/1', lots });
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { neuve, sortie, etat: (l) => neuve.prepare('SELECT etat, detail FROM modification WHERE lot_id = ? ORDER BY rang').all(l.id).map((x) => ({ ...x })) };
}

test('R207 (1), rejeu : un lot noté avant R207 qui change le prix d’un matériau (sans noter ses armures ni ses boucliers) laisse la grille et les boucliers à la formule', () => {
  let m;
  let l;
  const { neuve, sortie, etat } = rejouerSurLesRegles((base, lot) => {
    m = base.prepare(`SELECT r.* FROM ressource r JOIN materiau_armure a ON a.ressource_id = r.id JOIN materiau_bouclier b ON b.ressource_id = r.id
      WHERE r.prix_rf IS NOT NULL ORDER BY r.id DESC LIMIT 1`).get();
    const rf = m.prix_rf + 100;
    l = lot([{ table: 'ressource', cle: { id: m.id }, avant: { prix_brut: m.prix_brut, prix_rf: m.prix_rf }, apres: { prix_brut: `${rf} RF / ${String(rf / 100).replace('.', ',')} RO`, prix_rf: rf } }]);
    return [l];
  });
  assert.deepEqual(etat(l).map((x) => x.etat), ['en_attente'], JSON.stringify(etat(l)));
  assert.equal(neuve.prepare('SELECT prix_rf FROM ressource WHERE id = ?').get(m.id).prix_rf, m.prix_rf + 100);
  verifierE6(neuve);
  for (const t of TABLES_DES_VALEURS_CALCULEES) assert.ok(sortie.tablesCompletees.includes(t), `${t} : écrite au-delà du journal`);
  // la même règle pour la mise à jour par GitHub (tablesDuLot), recopiée
  assert.deepEqual([...miseAJour.TABLES_DES_ENTREES_DU_CALCUL], [...TABLES_DES_ENTREES_DU_CALCUL]);
  assert.deepEqual([...miseAJour.TABLES_DES_VALEURS_CALCULEES], [...TABLES_DES_VALEURS_CALCULEES]);
  const tables = miseAJour.tablesDuLot({ journal: { lots: [{ modifications: [{ table: 'ressource', operation: 'modifier', cle: { id: m.id }, avant: {}, apres: {} }] }] } });
  for (const t of TABLES_DES_VALEURS_CALCULEES) assert.ok(tables.includes(t), t);
  neuve.close();
});

test('R207 (1), rejeu : un ancien lot qui écrit directement une colonne calculée est en conflit (choix 2 seul) ; une armure particulière ou une valeur déjà là passent', () => {
  const lots = {};
  let combinaison;
  let bouclier;
  let particuliere;
  const { neuve, etat } = rejouerSurLesRegles((base, lot) => {
    combinaison = base.prepare("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1 OFFSET 2").get();
    bouclier = base.prepare('SELECT * FROM bouclier ORDER BY id DESC LIMIT 1').get();
    particuliere = base.prepare("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre DESC LIMIT 1").get();
    const prix = (combinaison.prix ?? 0) + 1;
    lots.armure = lot([{ table: 'armure', cle: { id: combinaison.id }, avant: { prix_brut: combinaison.prix_brut, prix: combinaison.prix }, apres: { prix_brut: String(prix), prix } }]);
    const ap = (bouclier.ap ?? 0) + 3;
    lots.bouclier = lot([{ table: 'bouclier', cle: { id: bouclier.id }, avant: { ap: bouclier.ap, defense_brut: bouclier.defense_brut },
      apres: { ap, defense_brut: `+${ap}AP${bouclier.am === null ? '' : ` +${bouclier.am}AM`}` } }]);
    const pAp = (particuliere.ap ?? 0) + 1;
    lots.particuliere = lot([{ table: 'armure', cle: { id: particuliere.id }, avant: { ap: particuliere.ap, stats_brut: particuliere.stats_brut },
      apres: { ap: pAp, stats_brut: `+${pAp}AP${particuliere.am === null ? '' : ` +${particuliere.am}AM`}` } }]);
    lots.deja = lot([{ table: 'bouclier', cle: { id: bouclier.id }, avant: { prix: (bouclier.prix ?? 0) + 5 }, apres: { prix: bouclier.prix } }]);
    return [lots.armure, lots.bouclier, lots.particuliere, lots.deja];
  });
  for (const [nom, mot] of [['armure', 'armure de la grille'], ['bouclier', 'd’un bouclier']]) {
    const [e] = etat(lots[nom]);
    assert.equal(e.etat, 'conflit', JSON.stringify(e));
    assert.ok(e.detail.includes('décision R207 (1)') && e.detail.includes(mot), e.detail);
    const diag = examinerLeLot(neuve, lots[nom].id);
    assert.deepEqual(diag.conflits.map((c) => c.choix_possibles), [[2]], JSON.stringify(diag.conflits));
  }
  assert.equal(neuve.prepare('SELECT prix FROM armure WHERE id = ?').get(combinaison.id).prix, combinaison.prix, 'rien d’écrit');
  assert.equal(neuve.prepare('SELECT ap FROM bouclier WHERE id = ?').get(bouclier.id).ap, bouclier.ap, 'rien d’écrit');
  assert.equal(etat(lots.particuliere)[0].etat, 'en_attente', JSON.stringify(etat(lots.particuliere)));
  assert.equal(neuve.prepare('SELECT ap FROM armure WHERE id = ?').get(particuliere.id).ap, (particuliere.ap ?? 0) + 1);
  assert.equal(etat(lots.deja)[0].etat, 'integree', JSON.stringify(etat(lots.deja)));
  verifierE6(neuve);
  neuve.close();
});

// Un don « Variable » créé sur le site de dev (décision R181 ; réponse du propriétaire : « Demander la magie ») : sa création demande la magie qu'il vise
// (magie innée ou acquise : lib/edition-modele.mjs#MAGIES_D_UN_DON_VARIABLE, champ `magie` d'un don, `don_magie` du don d'une spécialité) et écrit la
// ligne capacite_variable, notée au journal et rejouée comme le reste ; exigée pour un don « Variable », refusée pour un autre type. Classe, dons et
// spécialité créés par le test (noms libres) ; rien de la base n'est cité en dur.
//   node --test test/serveur-edition-don-variable.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { CHAMPS_HORS_COLONNES, ENTITES, MAGIES_D_UN_DON_VARIABLE, TYPES_DE_DON_SAISIE } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('don-variable');
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const enregistrer = (operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
  corps: JSON.stringify({ page: 'classes/x', operations }) }, { base: () => db, etat: () => ({}), edition: true });
const nombre = () => db.prepare('SELECT count(*) AS n FROM modification').get().n;
/** Un nom de classe libre. */
function nomLibre(nom) {
  for (let i = 1; ; i += 1) {
    const n = `${nom} ${process.pid}${i === 1 ? '' : ` ${i}`}`;
    if (!db.prepare('SELECT 1 FROM classe WHERE id = ?').get(`classes/${normalize(n)}`) && !db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(n))) return n;
  }
}
const classe = (() => {
  const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-physique-corps-a-corps', nom: nomLibre('Mime d’essai') } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps.crees[0].id;
})();
const VARIABLE = TYPES_DE_DON_SAISIE.find((t) => normalize(t.valeur) === 'variable').valeur;
const AUTRE = TYPES_DE_DON_SAISIE.find((t) => normalize(t.valeur) !== 'variable').valeur;

test('le formulaire : la magie se choisit parmi « Magie innée » et « Magie acquise », les deux valeurs que la base accepte (CHECK de capacite_variable)', () => {
  assert.deepEqual(MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur), ['innee', 'acquise']);
  assert.deepEqual(MAGIES_D_UN_DON_VARIABLE.map((m) => m.libelle), ['Magie innée', 'Magie acquise']);
  for (const [entite, champ] of [['capacite', 'magie'], ['specialite', 'don_magie']]) {
    assert.equal(ENTITES[entite].champs[champ].choix, MAGIES_D_UN_DON_VARIABLE, entite);
    assert.ok(!ENTITES[entite].champs[champ].requis, `${entite} : exigé seulement pour un don « Variable » (le service)`);
  }
  const don = db.prepare('SELECT id FROM capacite ORDER BY id LIMIT 1').get().id;
  db.exec('SAVEPOINT essai');
  try {
    db.prepare('DELETE FROM capacite_variable WHERE capacite_id = ?').run(don);
    for (const { valeur } of MAGIES_D_UN_DON_VARIABLE) {
      db.prepare('INSERT INTO capacite_variable (capacite_id, magie) VALUES (?, ?)').run(don, valeur);
      db.prepare('DELETE FROM capacite_variable WHERE capacite_id = ?').run(don);
    }
    assert.throws(() => db.prepare('INSERT INTO capacite_variable (capacite_id, magie) VALUES (?, ?)').run(don, 'autre'));
  } finally {
    db.exec('ROLLBACK TO essai');
    db.exec('RELEASE essai');
  }
});

test('R181 : un don « Variable » créé sans magie est refusé (400, rien d’écrit) ; avec, sa ligne capacite_variable est écrite et notée ; un autre type refuse une magie', () => {
  const avant = nombre();
  const sans = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '1', nom: 'Copie', type: VARIABLE } }]);
  assert.equal(sans.statut, 400, JSON.stringify(sans.corps));
  assert.match(sans.corps.erreur, /R181/);
  const autre = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '1', nom: 'Garde', type: AUTRE, magie: 'innee' } }]);
  assert.equal(autre.statut, 400, JSON.stringify(autre.corps));
  assert.equal(enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '1', nom: 'Copie', type: VARIABLE, magie: 'les deux' } }]).statut, 400);
  assert.equal(nombre(), avant, 'rien d’écrit');
  for (const [niveau, magie] of [['1', 'innee'], ['5', 'acquise']]) {
    const r = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau, nom: `Copie ${niveau}`, type: VARIABLE, magie } }]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const id = r.corps.crees[0].id;
    assert.equal(db.prepare('SELECT type FROM capacite WHERE id = ?').get(id).type, 'variable');
    assert.equal(db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(id)?.magie, magie);
    const note = db.prepare("SELECT apres FROM modification WHERE lot_id = ? AND table_nom = 'capacite_variable' AND operation = 'inserer'").get(r.corps.lot);
    assert.deepEqual(JSON.parse(note.apres), { capacite_id: id, magie });
  }
  // un don d'un autre type : aucune ligne
  const passif = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '10', nom: 'Garde', type: AUTRE } }]);
  assert.equal(passif.statut, 200, JSON.stringify(passif.corps));
  assert.equal(db.prepare('SELECT 1 FROM capacite_variable WHERE capacite_id = ?').get(passif.corps.crees[0].id), undefined);
});

test('R181 : le don d’une spécialité créé « Variable » demande aussi sa magie (`don_magie`)', () => {
  const sans = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: 'Imitateur', don_nom: 'Imitation', don_type: VARIABLE } }]);
  assert.equal(sans.statut, 400, JSON.stringify(sans.corps));
  const r = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: 'Imitateur', don_nom: 'Imitation', don_type: VARIABLE, don_magie: 'acquise' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const don = db.prepare("SELECT id FROM capacite WHERE specialite_id = ? AND nature = 'specialite'").get(r.corps.crees[0].id).id;
  assert.equal(db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(don).magie, 'acquise');
});

test('rejeu du journal (livraison) : les mêmes lignes capacite_variable sur des règles neuves ; supprimé, le don emporte la sienne, notée', () => {
  const neuve = vivante();
  try {
    neuve.exec('PRAGMA foreign_keys = OFF');
    neuve.exec('BEGIN');
    chargerJournal(neuve, journalExporte(db));
    const bilan = rejouerLeJournal(neuve);
    neuve.exec('COMMIT');
    assert.equal(bilan.conflits, 0);
    const lignes = (base) => base.prepare('SELECT v.* FROM capacite_variable v JOIN capacite c ON c.id = v.capacite_id WHERE c.classe_id = ? ORDER BY 1').all(classe).map((l) => ({ ...l }));
    assert.equal(lignes(db).length, 3);
    assert.deepEqual(lignes(neuve), lignes(db));
  } finally {
    neuve.close();
  }
  const id = db.prepare("SELECT v.capacite_id AS id FROM capacite_variable v JOIN capacite c ON c.id = v.capacite_id WHERE c.classe_id = ? AND c.nature <> 'specialite' ORDER BY 1").get(classe).id;
  const r = enregistrer([{ op: 'supprimer', entite: 'capacite', cle: { id } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(db.prepare('SELECT 1 FROM capacite_variable WHERE capacite_id = ?').get(id), undefined);
  assert.ok(db.prepare("SELECT 1 FROM modification WHERE lot_id = ? AND table_nom = 'capacite_variable' AND operation = 'supprimer'").get(r.corps.lot));
});

// Le type d'un don existant qui change (décision R181 ; réponse du propriétaire « Demander ou retirer », R192 : « Passer à « Variable » demande la magie
// (innée ou acquise) ; quitter « Variable » retire le lien à la magie. ») : opération « modifier » de `capacite` (`type_brut`), la magie dans les mêmes
// `valeurs` (clé hors colonnes `magie` : lib/edition-modele.mjs#CHAMPS_HORS_COLONNES, serveur/edition.mjs#suivreLaMagieDuDon). Classe et dons créés
// par le test, sur une classe à lui (le test du rejeu plus haut compte les lignes de la sienne).
const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: JSON.stringify(corps) },
  { base: () => db, etat: () => ({ service: 'essai', version: '0.0.0-essai' }), journal: () => {}, edition: true });
const typeDe = (id) => db.prepare('SELECT type FROM capacite WHERE id = ?').get(id).type;
const magieDe = (id) => db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(id)?.magie ?? null;
const notes = (lot) => db.prepare('SELECT table_nom, operation, avant, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(lot)
  .map((m) => ({ table: m.table_nom, operation: m.operation, avant: JSON.parse(m.avant ?? 'null'), apres: JSON.parse(m.apres ?? 'null') }));
const modifierLeDon = (id, valeurs) => enregistrer([{ op: 'modifier', table: 'capacite', cle: { id }, valeurs }]);
let classeDuType = null;
function donDe(type, magie) {
  classeDuType ??= (() => {
    const r = enregistrer([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-physique-corps-a-corps', nom: nomLibre('Caméléon d’essai') } }]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps.crees[0].id;
  })();
  const nom = `Reflet ${(compteur += 1)}`;
  const r = enregistrer([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classeDuType, niveau: '1', nom, type, ...(magie ? { magie } : {}) } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps.crees[0].id;
}

test('R181 « Demander ou retirer », R192 : passer à « Variable » sans magie (ou hors de la liste) est refusé, 400, rien d’écrit ; avec, type et ligne capacite_variable dans le même lot', () => {
  const id = donDe(AUTRE);
  const avant = nombre();
  const sans = modifierLeDon(id, { type_brut: VARIABLE });
  assert.equal(sans.statut, 400, JSON.stringify(sans.corps));
  assert.match(sans.corps.erreur, /R181/);
  assert.equal(modifierLeDon(id, { type_brut: VARIABLE, magie: 'les deux' }).statut, 400);
  assert.equal(modifierLeDon(id, { type_brut: VARIABLE, magie: '' }).statut, 400, 'une magie vide est une magie absente');
  assert.equal(nombre(), avant, 'rien d’écrit');
  assert.notEqual(typeDe(id), 'variable');
  assert.equal(magieDe(id), null);
  for (const { valeur: magie } of MAGIES_D_UN_DON_VARIABLE) {
    const don = magie === MAGIES_D_UN_DON_VARIABLE[0].valeur ? id : donDe(AUTRE);
    const r = modifierLeDon(don, { type_brut: VARIABLE, magie });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.equal(typeDe(don), 'variable');
    assert.equal(magieDe(don), magie);
    const lot = notes(r.corps.lot);
    assert.ok(lot.some((n) => n.table === 'capacite' && n.operation === 'modifier' && n.apres.type === 'variable'), 'le type, noté');
    assert.deepEqual(lot.filter((n) => n.table === 'capacite_variable'), [{ table: 'capacite_variable', operation: 'inserer', avant: null, apres: { capacite_id: don, magie } }]);
  }
});

test('R181 « Demander ou retirer », R192 : quitter « Variable » retire la ligne capacite_variable (notée, ligne avant complète) ; une magie envoyée alors est refusée', () => {
  const [magie] = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur);
  const id = donDe(VARIABLE, magie);
  const avant = nombre();
  const refuse = modifierLeDon(id, { type_brut: AUTRE, magie });
  assert.equal(refuse.statut, 400, JSON.stringify(refuse.corps));
  assert.equal(nombre(), avant, 'rien d’écrit');
  assert.equal(magieDe(id), magie);
  const r = modifierLeDon(id, { type_brut: AUTRE });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.notEqual(typeDe(id), 'variable');
  assert.equal(magieDe(id), null);
  assert.deepEqual(notes(r.corps.lot).filter((n) => n.table === 'capacite_variable'),
    [{ table: 'capacite_variable', operation: 'supprimer', avant: { capacite_id: id, magie }, apres: null }]);
  // un type vidé quitte aussi « Variable »
  const vide = donDe(VARIABLE, magie);
  assert.equal(modifierLeDon(vide, { type_brut: '' }).statut, 200);
  assert.equal(magieDe(vide), null);
  // un don d'un autre type refuse une magie seule
  assert.equal(modifierLeDon(id, { magie }).statut, 400);
});

test('R181 : un don déjà « Variable » change de magie par `magie` (type envoyé ou non) ; une autre modification sans `magie` garde la sienne', () => {
  const [une, autre] = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur);
  const id = donDe(VARIABLE, une);
  const seule = modifierLeDon(id, { magie: autre });
  assert.equal(seule.statut, 200, JSON.stringify(seule.corps));
  assert.equal(magieDe(id), autre);
  assert.deepEqual(notes(seule.corps.lot), [{ table: 'capacite_variable', operation: 'modifier', avant: { magie: une }, apres: { magie: autre } }]);
  const avecType = modifierLeDon(id, { type_brut: VARIABLE, magie: une });
  assert.equal(avecType.statut, 200, JSON.stringify(avecType.corps));
  assert.equal(magieDe(id), une);
  assert.equal(modifierLeDon(id, { magie: 'les deux' }).statut, 400);
  const effet = modifierLeDon(id, { effet: `Essai ${process.pid}` });
  assert.equal(effet.statut, 200, JSON.stringify(effet.corps));
  assert.equal(magieDe(id), une);
  assert.ok(!notes(effet.corps.lot).some((n) => n.table === 'capacite_variable'));
});

test('R181 : le don d’une spécialité suit la même règle (son type se modifie par `capacite`)', () => {
  donDe(AUTRE); // la classe d'essai
  const r = enregistrer([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classeDuType, nom: `Mimique ${process.pid}`, don_nom: 'Écho', don_type: AUTRE } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const don = db.prepare("SELECT id FROM capacite WHERE specialite_id = ? AND nature = 'specialite'").get(r.corps.crees[0].id).id;
  assert.equal(modifierLeDon(don, { type_brut: VARIABLE }).statut, 400);
  const [magie] = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur);
  assert.equal(modifierLeDon(don, { type_brut: VARIABLE, magie }).statut, 200);
  assert.equal(magieDe(don), magie);
  assert.equal(modifierLeDon(don, { type_brut: AUTRE }).statut, 200);
  assert.equal(magieDe(don), null);
});

test('R181 par l’API /api/v1/ : le PATCH d’un don suit la même règle (clé `magie`), décrite par le catalogue et OpenAPI', () => {
  const id = donDe(AUTRE);
  const adresse = `/api/v1/dons-de-classe/${encodeURIComponent(id)}/`;
  const avant = nombre();
  const sans = appel('PATCH', adresse, { type_brut: VARIABLE });
  assert.equal(sans.statut, 400, JSON.stringify(sans.corps));
  assert.match(sans.corps.erreur, /R181/);
  assert.equal(nombre(), avant, 'rien d’écrit');
  const [magie] = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur);
  const r = appel('PATCH', adresse, { type_brut: VARIABLE, magie });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(magieDe(id), magie);
  assert.equal(appel('PATCH', adresse, { type_brut: AUTRE }).statut, 200);
  assert.equal(magieDe(id), null);
  const catalogue = appel('GET', '/api/v1/').corps;
  const dons = catalogue.ressources.find((x) => x.table === 'capacite' && x.capacites.modifier);
  assert.deepEqual(dons.hors_colonnes.map((c) => c.nom), Object.keys(CHAMPS_HORS_COLONNES.capacite));
  const spec = appel('GET', '/api/v1/openapi.json').corps;
  const patch = spec.paths[`/v1/${dons.cle}/{cle}/`]?.patch ?? Object.entries(spec.paths).find(([c]) => c.endsWith(`/${dons.cle}/{cle}/`))[1].patch;
  const proprietes = patch.requestBody.content['application/json'].schema.properties;
  assert.deepEqual(proprietes.magie.enum, [...MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur), null]);
});

test('R181 : rejeu du journal (copie) : les changements de type rejouent leurs lignes capacite_variable, ajoutées, modifiées et retirées', () => {
  assert.ok(classeDuType, 'les cas précédents ont créé leurs dons');
  const neuve = vivante();
  try {
    neuve.exec('PRAGMA foreign_keys = OFF');
    neuve.exec('BEGIN');
    chargerJournal(neuve, journalExporte(db));
    const bilan = rejouerLeJournal(neuve);
    neuve.exec('COMMIT');
    assert.equal(bilan.conflits, 0);
    const lignes = (base) => base.prepare('SELECT c.id, c.type, v.magie FROM capacite c LEFT JOIN capacite_variable v ON v.capacite_id = c.id WHERE c.classe_id = ? ORDER BY c.id')
      .all(classeDuType).map((l) => ({ ...l }));
    const ici = lignes(db);
    assert.ok(ici.some((l) => l.magie === null && l.type !== 'variable') && ici.some((l) => l.magie !== null), 'des dons qui ont quitté et rejoint « Variable »');
    assert.ok(ici.every((l) => (l.type === 'variable') === (l.magie !== null)), 'un don « Variable » a sa magie, un autre n’en a pas');
    assert.deepEqual(lignes(neuve), ici);
  } finally {
    neuve.close();
  }
});

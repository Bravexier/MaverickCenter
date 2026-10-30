// Édition des consommables de l'onglet Ceinture depuis le site de dev (serveur/edition-consommables.mjs ; demande du propriétaire, 2026-10-17 : « Les
// tableaux des consommables devrai pouvoir aussi être modifiées . (sauf pour les champ calculés) ») : le nom et le prix d'une potion (sa ressource : prix
// en RF recalculé), son niveau et son effet (ses altérations d'état refaites) ; le tableau de son palier dans la page de la potion suit ; les refus ; la
// liste des niveaux ; l'API REST ; le rejeu du journal (livraison) refait les mêmes lignes et les mêmes corps. Les tests lisent l'état avant d'écrire et
// prennent des noms absents de la base.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { prixEnRf } from '../src/lib/composants-champs.mjs';
import { celluleDePotion, tableauDuPalier } from '../src/lib/corps-potions.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-consommables');
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin, corps_) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps_ && JSON.stringify(corps_) }, service);
const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'ressources/objets-a-la-ceinture/', operations });
const ligne = (sql, ...p) => {
  const l = db.prepare(sql).get(...p);
  return l ? { ...l } : undefined;
};
const corps = (id, base = db) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const ok = (r) => assert.equal(r.statut, 200, JSON.stringify(r.corps));
/** Un nom de potion qu'aucune ressource ne porte encore. */
const nomLibre = (nom) => {
  let n = `${nom} ${process.pid}`;
  for (let i = 2; ligne('SELECT 1 FROM ressource WHERE nom_cle = ?', normalize(n)); i += 1) n = `${nom} ${process.pid} ${i}`;
  return n;
};
/** Le nom de la potion, puis ses prix, niveau et effet, tels que le tableau de son palier les écrit dans la page de la potion. */
function tableauDe(id) {
  const r = ligne('SELECT nom, page_id FROM ressource WHERE id = ?', id);
  const lignes = corps(r.page_id).split('\n');
  const t = tableauDuPalier(lignes, r.nom);
  const cases = (l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
  return { nom: cases(lignes[t.entete])[0], valeurs: cases(lignes[t.valeurs]) };
}
/** Une potion de la famille, la première par identifiant (sa ressource et sa ligne de potion) ; `avecEtats` : une qui a des altérations d'état. */
const potionDe = (famille, { avecEtats = false } = {}) => ligne(`SELECT r.*, p.niveau_id, p.effet, p.famille FROM potion p JOIN ressource r ON r.id = p.ressource_id
  WHERE p.famille = ?${avecEtats ? ' AND EXISTS (SELECT 1 FROM potion_etat e WHERE e.ressource_id = p.ressource_id)' : ''} ORDER BY r.id LIMIT 1`, famille);

test('le modèle : niveau et effet d’une potion (et le nom et le prix de sa ressource) se modifient ; une potion ne se crée ni ne se supprime', () => {
  assert.deepEqual(Object.keys(TABLES.potion.colonnes), ['niveau_id', 'effet']);
  assert.equal(TABLES.potion.colonnes.niveau_id.liste, 'niveauxDAlchimie');
  for (const c of ['nom', 'prix_brut']) assert.ok(TABLES.ressource.colonnes[c], c);
  assert.ok(!Object.values(ENTITES).some((e) => e.table === 'potion'), 'pas d’entité « potion »');
  // la liste des niveaux du choix « Niveau », dans l'ordre des niveaux (rang)
  const r = appel('GET', '/api/edition/listes/');
  ok(r);
  assert.deepEqual(r.corps.niveauxDAlchimie.map((n) => ({ ...n })), db.prepare('SELECT id AS valeur, nom AS libelle FROM niveau_alchimie ORDER BY rang').all().map((n) => ({ ...n })));
});

test('nom et prix : la ressource (clé du nom, prix en RF recalculés), le tableau du palier dans la page de la potion suit', () => {
  const p = potionDe('fiole');
  const page = corps(p.page_id);
  const avant = tableauDe(p.id);
  assert.equal(avant.nom, celluleDePotion(p.nom));
  const nom = nomLibre('Fiole d’essai');
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { nom, prix_brut: '1 234 RF / 12,34 RO' }, avant: { nom: p.nom, prix_brut: p.prix_brut } }]));
  const r = ligne('SELECT * FROM ressource WHERE id = ?', p.id);
  assert.deepEqual([r.nom, r.nom_cle, r.prix_brut, r.prix_rf], [nom, normalize(nom), '1 234 RF / 12,34 RO', prixEnRf('1 234 RF / 12,34 RO')]);
  const apres = tableauDe(p.id);
  assert.equal(apres.nom, nom);
  assert.deepEqual(apres.valeurs, ['1 234 RF / 12,34 RO', avant.valeurs[1], avant.valeurs[2]], 'le prix, le reste inchangé');
  assert.ok(!corps(p.page_id).includes(`| ${p.nom} |`), 'l’ancien nom ne désigne plus le tableau');
  // remis comme avant : la page redevient celle des règles, mot pour mot
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { nom: p.nom, prix_brut: p.prix_brut } }]));
  assert.equal(corps(p.page_id), page);
});

test('niveau et effet : la ligne de potion, ses altérations d’état refaites depuis l’effet, le tableau du palier suit', () => {
  const p = potionDe('remede', { avecEtats: true });
  const etatsAvant = db.prepare('SELECT etat_id, action FROM potion_etat WHERE ressource_id = ?').all(p.id).map((l) => ({ ...l }));
  assert.ok(etatsAvant.length >= 1, 'un remède réduit ou soigne une altération');
  const niveau = ligne('SELECT id, nom FROM niveau_alchimie WHERE id <> ? ORDER BY rang LIMIT 1', p.niveau_id);
  const effet = 'Inflige gel 2\nRéduit de deux crans la brûlure\nUne ligne | avec un tube';
  ok(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { niveau_id: niveau.id, effet }, avant: { niveau_id: p.niveau_id, effet: p.effet } }]));
  assert.deepEqual({ ...ligne('SELECT niveau_id, effet FROM potion WHERE ressource_id = ?', p.id) }, { niveau_id: niveau.id, effet });
  const etats = db.prepare("SELECT replace(etat_id, 'guide/liste-des-alterations-d-etat#etat:', '') AS etat, action, valeur, texte, origine, source_ref FROM potion_etat WHERE ressource_id = ? ORDER BY etat")
    .all(p.id).map((l) => ({ ...l }));
  assert.deepEqual(etats, [
    { etat: 'brulure', action: 'reduit', valeur: 2, texte: 'Réduit de deux crans la brûlure', origine: p.origine, source_ref: ligne('SELECT source_ref FROM potion WHERE ressource_id = ?', p.id).source_ref },
    { etat: 'gel', action: 'inflige', valeur: 2, texte: 'Inflige gel 2', origine: p.origine, source_ref: ligne('SELECT source_ref FROM potion WHERE ressource_id = ?', p.id).source_ref },
  ]);
  assert.deepEqual(tableauDe(p.id).valeurs.slice(1), [niveau.nom, 'Inflige gel 2<br>Réduit de deux crans la brûlure<br>Une ligne \\| avec un tube']);
  // l'effet d'origine : ses altérations reviennent
  ok(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { niveau_id: p.niveau_id, effet: p.effet } }]));
  assert.deepEqual(db.prepare('SELECT etat_id, action FROM potion_etat WHERE ressource_id = ?').all(p.id).map((l) => ({ ...l })), etatsAvant);
  assert.deepEqual(tableauDe(p.id).valeurs.slice(1), [ligne('SELECT nom FROM niveau_alchimie WHERE id = ?', p.niveau_id).nom, celluleDePotion(p.effet)]);
});

test('refus : description (l’onglet n’en montre pas), niveau inconnu, effet vide, HTML brut dans la page, nom d’un autre palier ; rien n’est écrit', () => {
  const p = potionDe('huile');
  const page = corps(p.page_id);
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { description: 'Essai.' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { niveau_id: 'inconnu' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: '  ' } }]).statut, 400, 'effet obligatoire');
  const html = enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: '<img src=x onerror=alert(1)>' } }]);
  assert.equal(html.statut, 400, JSON.stringify(html.corps));
  // un autre palier de la même page, à la casse et aux accents près (le tableau se retrouve par son nom)
  const autre = ligne("SELECT nom FROM ressource WHERE genre = 'potion' AND page_id = ? AND id <> ? ORDER BY id LIMIT 1", p.page_id, p.id);
  const proche = enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { nom: autre.nom.toUpperCase() } }]);
  assert.equal(proche.statut, 409, JSON.stringify(proche.corps));
  // le même nom qu'une potion d'une autre page : refusé par la base (clé du nom unique parmi les potions)
  const ailleurs = ligne("SELECT nom FROM ressource WHERE genre = 'potion' AND page_id <> ? ORDER BY id LIMIT 1", p.page_id);
  assert.equal(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { nom: ailleurs.nom } }]).statut, 422);
  assert.equal(corps(p.page_id), page);
  assert.deepEqual({ ...ligne('SELECT nom, description FROM ressource WHERE id = ?', p.id) }, { nom: p.nom, description: p.description });
  // une modification qui arrive après une autre (valeur lue périmée) : 409 et la ligne actuelle
  const conflit = enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: 'Essai.' }, avant: { effet: `${p.effet} (lu avant)` } }]);
  assert.equal(conflit.statut, 409);
  assert.equal(conflit.corps.ligne.effet, p.effet);
});

test('les champs se relisent pour la page (lignes, lignes en attente) ; un carquois reste au domaine des composants', () => {
  const p = potionDe('philtre');
  const r = appel('POST', '/api/edition/lignes/', { lignes: [{ table: 'potion', cle: { ressource_id: p.id } }, { table: 'ressource', cle: { id: p.id } }] });
  ok(r);
  assert.deepEqual(r.corps.lignes.map((l) => [l.table, l.ligne.niveau_id ?? l.ligne.nom]), [['potion', p.niveau_id], ['ressource', p.nom]]);
  ok(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: `${p.effet}\nUne ligne de plus.` } }]));
  const attente = appel('GET', '/api/edition/en-attente/');
  ok(attente);
  assert.ok(attente.corps.lignes.some((l) => l.table === 'potion' && l.cle.ressource_id === p.id && l.ligne.effet.endsWith('Une ligne de plus.')));
  ok(enregistrer([{ op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: p.effet } }]));
  const carquois = ligne("SELECT r.id, r.description FROM v_objet_ceinture v JOIN ressource r ON r.id = v.ressource_id WHERE v.famille = 'contenant' ORDER BY r.id LIMIT 1");
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: carquois.id }, valeurs: { description: 'Un carquois d’essai.' } }]));
  ok(enregistrer([{ op: 'modifier', table: 'ressource', cle: { id: carquois.id }, valeurs: { description: carquois.description } }]));
});

test('API REST : PATCH /api/v1/potions/<id>/ (nom, prix, niveau et effet par l’extension « potion ») ; la description est figée', () => {
  const p = potionDe('primitive');
  const adresse = `/api/v1/potions/${encodeURIComponent(p.id)}/`;
  const lu = appel('GET', adresse);
  ok(lu);
  assert.equal(lu.corps.extensions.potion.effet, p.effet);
  const effet = `${p.effet}\nPar l’API.`;
  const r = appel('PATCH', adresse, { prix_brut: '7 Ro', potion: { effet } });
  ok(r);
  assert.deepEqual([r.corps.element.prix_rf, r.corps.extensions.potion.effet], [700, effet]);
  assert.deepEqual(tableauDe(p.id).valeurs, ['7 Ro', tableauDe(p.id).valeurs[1], celluleDePotion(effet)]);
  assert.match(appel('PATCH', adresse, { description: 'x' }).corps.erreur, /description/);
  ok(appel('PATCH', adresse, { prix_brut: p.prix_brut, potion: { effet: p.effet } }));
});

test('rejeu du journal (livraison) : les mêmes potions, altérations d’état et corps de pages sur des règles neuves', () => {
  // une dernière modification qui reste en place : un nom et un prix, puis l'effet de la même potion (le nom désigne le tableau au rejeu)
  const p = potionDe('fiole');
  ok(enregistrer([
    { op: 'modifier', table: 'potion', cle: { ressource_id: p.id }, valeurs: { effet: `${p.effet}\nInflige peur 1` } },
    { op: 'modifier', table: 'ressource', cle: { id: p.id }, valeurs: { nom: nomLibre('Fiole rejouée'), prix_brut: '11 Ro' } },
  ]));
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  assert.deepEqual(sortie.illisibles, []);
  const pages = db.prepare("SELECT DISTINCT page_id FROM ressource WHERE genre = 'potion'").all().map((l) => l.page_id);
  for (const id of pages) assert.equal(corps(id, neuve), corps(id), id);
  for (const t of ['ressource', 'potion', 'potion_etat']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2, 3`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2, 3`).all(), t);
  }
  neuve.close();
});

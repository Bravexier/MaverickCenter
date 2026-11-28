// La ressource `mots-cles` de l'API v1 après le retrait des colonnes du mot-clé (migration 0136 ; chantier 4, docs/chantier-retrait-des-colonnes.md §4 et
// §5) : `libelle`, `url`, `description`, `couleur` et `icone` se lisent sur l'élément (page, sinon sort, sinon repère) et la ressource les rend sous les
// mêmes noms, filtrables, cherchables et triables ; leur écriture part au service, qui l'écrit sur le repère et refuse le nom d'un mot-clé ancré.
// Aucune valeur du site n'est figée : les mots-clés et les pages se prennent par requête, les textes écrits sont ceux du test.
//   node --test test/serveur-api-v1-mots-cles-element.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { adresseDeLaPageEnBase } from '../src/lib/adresses-db.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('api-v1-mots-cles-element');
const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'db') }).chemin);
const service = { base: () => db, etat: () => ({ service: 'essai', version: '0.0.0-essai' }), journal: () => {}, edition: true };
const appel = (methode, chemin, corps) =>
  traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps)?.slice(0, 600));
  return r.corps;
};
const un = (sql, ...p) => {
  const l = db.prepare(sql).get(...p);
  return l ? { ...l } : null;
};
const CHAMPS = ['libelle', 'url', 'description', 'couleur', 'icone'];
const champsDe = (o) => Object.fromEntries(CHAMPS.map((c) => [c, o[c] ?? null]));

/** Un mot-clé à repère non verrouillé (le Glossaire le modifie), et son repère. */
const aRepere = un('SELECT r.* FROM repere r JOIN mot_cle m ON m.id = r.mot_cle_id WHERE m.verrou = 0 ORDER BY r.mot_cle_id LIMIT 1');

/** Ancre en SQL un mot-clé neuf, non verrouillé, à une page qui n'en a pas, avec une définition, une couleur et une icône sur la page : { id, page }. */
function ancrerAUnePage() {
  const page = un("SELECT id, titre FROM page WHERE mot_cle_id IS NULL AND statut <> 'example' AND type = 'guide' ORDER BY id LIMIT 1");
  const id = un('SELECT max(id) + 1 AS n FROM mot_cle').n;
  db.prepare('INSERT INTO mot_cle (id, cle) VALUES (?, ?)').run(id, `essai-api-ancre-${id}`);
  db.prepare('UPDATE page SET mot_cle_id = ?, definition = ?, couleur = ?, icone = NULL WHERE id = ?').run(id, 'Définition d’essai de l’API.', '#123abc', page.id);
  return { id, page };
}

test('retrait des colonnes : la base d’essai est à la structure 136 (le mot-clé n’a plus ses cinq colonnes)', () => {
  const colonnes = db.prepare('PRAGMA table_info(mot_cle)').all().map((c) => c.name);
  assert.deepEqual(CHAMPS.filter((c) => colonnes.includes(c)), []);
  assert.ok(aRepere, 'un mot-clé à repère non verrouillé');
});

test('retrait des colonnes : le détail et la liste d’un mot-clé à repère rendent ses cinq champs, lus sur le repère', () => {
  const lu = ok(appel('GET', `/api/v1/mots-cles/${aRepere.mot_cle_id}/`)).element;
  const attendu = { libelle: aRepere.nom, url: aRepere.adresse, description: aRepere.definition, couleur: aRepere.couleur, icone: aRepere.icone };
  assert.deepEqual(champsDe(lu), attendu);
  // filtrés, cherchés et triés comme des colonnes
  const filtre = ok(appel('GET', `/api/v1/mots-cles/?libelle=${encodeURIComponent(aRepere.nom)}&limite=500`));
  assert.ok(filtre.elements.some((e) => e.id === aRepere.mot_cle_id));
  assert.ok(filtre.elements.every((e) => e.libelle === aRepere.nom));
  const cherche = ok(appel('GET', `/api/v1/mots-cles/?q=${encodeURIComponent(aRepere.nom)}&limite=500`));
  assert.ok(cherche.elements.some((e) => e.id === aRepere.mot_cle_id));
  const tries = ok(appel('GET', '/api/v1/mots-cles/?tri=-libelle&limite=20')).elements.map((e) => e.libelle);
  assert.deepEqual(tries, [...tries].sort((a, b) => b.localeCompare(a, 'fr', { numeric: true, sensitivity: 'variant' })));
  // le catalogue les décrit comme des colonnes de la ressource, modifiables
  const catalogue = ok(appel('GET', '/api/v1/'));
  const decrites = Object.fromEntries(catalogue.ressources.find((r) => r.cle === 'mots-cles').colonnes.map((c) => [c.nom, c]));
  for (const c of CHAMPS) assert.ok(decrites[c]?.modifiable, `${c} décrit et modifiable`);
  assert.equal(decrites.libelle.obligatoire, true);
});

test('retrait des colonnes : un mot-clé de page rend le titre, l’adresse, la définition, la couleur et l’icône de sa page', () => {
  const { id, page } = ancrerAUnePage();
  const lu = ok(appel('GET', `/api/v1/mots-cles/${id}/`)).element;
  assert.deepEqual(champsDe(lu), { libelle: page.titre, url: adresseDeLaPageEnBase(db, page.id), description: 'Définition d’essai de l’API.', couleur: '#123abc', icone: null });
});

test('retrait des colonnes : écrire le nom d’un mot-clé ancré est refusé ; les champs d’un mot-clé à repère s’écrivent dans son repère', () => {
  const { id, page } = ancrerAUnePage();
  const refus = appel('PATCH', `/api/v1/mots-cles/${id}/`, { libelle: 'Nom d’essai refusé' });
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
  assert.equal(un('SELECT titre FROM page WHERE id = ?', page.id).titre, page.titre, 'la page garde son titre');
  const corps = ok(appel('PATCH', `/api/v1/mots-cles/${aRepere.mot_cle_id}/`, { description: 'Définition d’essai écrite par l’API.' }));
  assert.equal(corps.element.description, 'Définition d’essai écrite par l’API.');
  assert.equal(un('SELECT definition FROM repere WHERE mot_cle_id = ?', aRepere.mot_cle_id).definition, 'Définition d’essai écrite par l’API.');
});

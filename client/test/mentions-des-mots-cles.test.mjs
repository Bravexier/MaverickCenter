// Les mentions d'un mot-clé (lib/mentions-des-mots-cles.mjs ; décision R196 : « Tous les mots clés je peux être supprimés que dans ils ne sont appelles
// nulle part » ; « Le mot clé n'est supprimable que si cette liste est vide ») : la liste que le service rend avec son refus et que le rejeu met en
// conflit. Une base d'essai en mémoire, au schéma réduit aux colonnes lues (le module lit les tables par sqlite_master et PRAGMA table_info) : les
// textes et les pages sont posés par le test, aucune donnée du jeu n'est lue.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { mentionsDe, mentionsDesMotsCles, texteDesMentions } from '../src/lib/mentions-des-mots-cles.mjs';

function baseDEssai() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE mot_cle (id TEXT PRIMARY KEY, libelle TEXT NOT NULL, libelle_cle TEXT NOT NULL, description TEXT, abreviation TEXT, url TEXT, couleur TEXT);
    CREATE TABLE page (id TEXT PRIMARY KEY, titre TEXT NOT NULL, statut TEXT NOT NULL, corps_md TEXT);
    CREATE TABLE page_tag (page_id TEXT NOT NULL, ordre INTEGER NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY (page_id, ordre));
    CREATE TABLE page_entite (entite_table TEXT NOT NULL, entite_id TEXT NOT NULL, page_id TEXT NOT NULL, principale INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (entite_table, entite_id, page_id));
    CREATE TABLE evenement (id TEXT PRIMARY KEY, titre TEXT NOT NULL, description TEXT);
    CREATE TABLE capacite (id TEXT PRIMARY KEY, effet TEXT);
    CREATE TABLE competence (id TEXT PRIMARY KEY, description TEXT);
    CREATE TABLE essai_sans_page (cle TEXT PRIMARY KEY, texte TEXT);
  `);
  const mot = db.prepare('INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, url, couleur) VALUES (?, ?, ?, ?, ?, ?, ?)');
  mot.run('feu', 'Feu', 'feu', 'Le feu brûle ; voir {{feu}} (sa propre définition).', 'Fe', '/{{feu}}/', null);
  mot.run('eau', 'Eau', 'eau', 'Contraire du {{feu}}.', null, null, null);
  mot.run('seul', 'Seul', 'seul', null, null, null, null);
  const page = db.prepare('INSERT INTO page (id, titre, statut, corps_md) VALUES (?, ?, ?, ?)');
  page.run('guide/combat', 'Combat', 'published', 'Le {{Fe}} et `{{eau}}` dans du code.');
  page.run('races/exemple-race', 'Race d’exemple', 'example', null);
  page.run('capacites/brasier', 'Brasier', 'published', null);
  page.run('competences/nage', 'Nage', 'published', null);
  db.prepare('INSERT INTO page_tag VALUES (?, ?, ?)').run('races/exemple-race', 0, 'feu');
  db.prepare('INSERT INTO capacite VALUES (?, ?)').run('capacites/brasier', 'Inflige des dégâts de {{feu|feu}}.');
  db.prepare('INSERT INTO competence VALUES (?, ?)').run('nage', 'Éteint le {{feu}}.');
  db.prepare('INSERT INTO page_entite VALUES (?, ?, ?, ?)').run('competence', 'nage', 'competences/nage', 1);
  db.prepare('INSERT INTO evenement VALUES (?, ?, ?)').run('grand-incendie', 'Le Grand Incendie', 'Un {{feu}} immense.');
  db.prepare('INSERT INTO essai_sans_page VALUES (?, ?)').run('k1', 'Un {{FEU}} caché.');
  return db;
}

test('R196 : chaque endroit qui mentionne le mot-clé, nommé par sa page (étiquette, corps, ligne de la page, page_entite), la chronologie ou sa table et sa ligne', () => {
  const db = baseDEssai();
  const vues = mentionsDe(db, 'feu').map((m) => [m.table, m.cle, m.colonne, m.comment, m.page?.id ?? null, m.libelle, m.exemple]);
  assert.deepEqual(vues.sort((a, b) => a[0].localeCompare(b[0])), [
    // la balise par son abréviation (« {{Fe}} ») compte ; celle d'un code (« `{{eau}}` ») ne compte pas
    ['capacite', { id: 'capacites/brasier' }, 'effet', 'balise', 'capacites/brasier', 'Brasier', false],
    ['competence', { id: 'nage' }, 'description', 'balise', 'competences/nage', 'Nage', false],
    ['essai_sans_page', { cle: 'k1' }, 'texte', 'balise', null, 'essai_sans_page k1', false],
    ['evenement', { id: 'grand-incendie' }, 'description', 'balise', null, 'Chronologie › Le Grand Incendie', false],
    // la définition d'un autre mot-clé compte ; la sienne, son adresse et sa couleur non
    ['mot_cle', { id: 'eau' }, 'description', 'balise', null, `${nomDeTable('mot_cle') ?? 'mot_cle'} eau`, false],
    ['page', { id: 'guide/combat' }, 'corps_md', 'balise', 'guide/combat', 'Combat', false],
    // une page d'exemple compte (marquée)
    ['page_tag', { page_id: 'races/exemple-race', ordre: 0 }, 'tag_id', 'etiquette', 'races/exemple-race', 'Race d’exemple', true],
  ]);
  // triée par libellé
  const libelles = mentionsDe(db, 'feu').map((m) => m.libelle);
  assert.deepEqual(libelles, [...libelles].sort((a, b) => a.localeCompare(b, 'fr')));
  // « eau » n'est cité que dans un code : aucune mention ; « seul » : aucune
  assert.deepEqual(mentionsDe(db, 'eau'), []);
  assert.deepEqual(mentionsDe(db, 'seul'), []);
  db.close();
});

test('un seul passage pour plusieurs mots-clés : une liste par id demandé, vide pour un id inconnu ; sans table mot_cle, des listes vides', () => {
  const db = baseDEssai();
  const parId = mentionsDesMotsCles(db, ['feu', 'seul', 'inconnu']);
  assert.deepEqual([...parId.keys()], ['feu', 'seul', 'inconnu']);
  assert.equal(parId.get('feu').length, mentionsDe(db, 'feu').length);
  assert.deepEqual([parId.get('seul'), parId.get('inconnu')], [[], []]);
  db.close();
  const vide = new DatabaseSync(':memory:');
  assert.deepEqual([...mentionsDesMotsCles(vide, ['feu']).entries()], [['feu', []]]);
  vide.close();
});

test('le texte d’un refus : chaque endroit nommé une fois, cinq au plus', () => {
  const m = (libelle) => ({ libelle });
  assert.equal(texteDesMentions([m('Combat'), m('Combat')]), 'un endroit (Combat)');
  assert.equal(texteDesMentions(['A', 'B', 'C', 'D', 'E', 'F'].map(m)), '6 endroits (A, B, C, D, E…)');
});

// Lecture du plan des Règles (lib/plan-des-regles-db.mjs ; migration 0091, décisions R184 et R185) : les onglets et leur menu latéral, tels que la base
// les range, dans la forme que lib/livres.mjs reçoit. Le contenu du plan lui-même (quelles pages, dans quel onglet) est épinglé par
// test/db-r184-plan-des-regles.test.mjs ; ici, la lecture : l'ordre, les trois formes d'entrée, une base d'avant la migration. Les cas d'ordre se
// jouent sur une base en mémoire, aux tables créées par le texte même de data/schema.sql.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerPlanDesRegles, entreeDuPlan } from '../src/lib/plan-des-regles-db.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
/** Le `CREATE TABLE` d'une table, tel que data/schema.sql l'écrit (jusqu'à son `) STRICT;`). */
const creation = (table) => {
  const m = SCHEMA.match(new RegExp(`^CREATE TABLE ${table} \\([\\s\\S]*?^\\) STRICT;`, 'm'));
  assert.ok(m, `${table} : dans data/schema.sql`);
  return m[0];
};

/** Une base en mémoire avec les deux tables du plan (clés étrangères contrôlées) et les pages `pages`. */
function baseDuPlan(pages) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE page (id TEXT NOT NULL PRIMARY KEY) STRICT');
  db.exec(creation('regles_onglet'));
  db.exec(creation('regles_onglet_entree'));
  const p = db.prepare('INSERT INTO page (id) VALUES (?)');
  for (const id of pages) p.run(id);
  return db;
}

test('R184 : le plan de la base, onglet par onglet et entrée par entrée, dans l’ordre de ses tables', () => {
  const db = ouvrirBase({ sansExemples: false });
  const plan = chargerPlanDesRegles(db);
  // la lecture du brief de tech-db, ligne par ligne : la même chose que le module
  const onglets = db.prepare('SELECT id, titre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all();
  assert.deepEqual(plan.map((o) => [o.id, o.titre, o.ouverture]), onglets.map((o) => [o.id, o.titre, o.ouverture_page_id]));
  for (const o of plan) {
    const lignes = db.prepare('SELECT page_id, libelle, adresse FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(o.id);
    assert.deepEqual(o.entrees.map((e) => e.page ?? e.libelle ?? e.bientot), lignes.map((l) => l.page_id ?? l.libelle), o.id);
    // la page d'ouverture est une page du menu de l'onglet
    assert.ok(o.entrees.some((e) => e.page === o.ouverture), `${o.id} : ouvre sur ${o.ouverture}`);
  }
  // R184 (1), (11) : les quatre onglets après Découvrir et L'univers ; « Artisanat » est un lien, juste après « Exercer un métier »
  assert.deepEqual(plan.map((o) => o.titre), ['Fiche de personnage', 'Mécaniques générales', 'Les combats', 'Exploration']);
  const exploration = plan.find((o) => o.id === 'exploration').entrees;
  const i = exploration.findIndex((e) => e.adresse === 'regles/artisanat/');
  assert.deepEqual(exploration[i], { libelle: 'Artisanat', adresse: 'regles/artisanat/' });
  assert.deepEqual(exploration[i - 1], { page: 'guide/exercer-un-metier' });
  // une entrée de page ne porte que son id (le titre est celui de la page)
  for (const e of plan.flatMap((o) => o.entrees)) if (e.page) assert.deepEqual(Object.keys(e), ['page']);
});

test('l’ordre : les onglets par `ordre` puis par id, les entrées par `rang` puis par id ; les trois formes d’entrée ; tout est gelé', () => {
  const db = baseDuPlan(['guide/a', 'guide/b', 'guide/c', 'guide/d']);
  // tout le lot dans une transaction : la page d'ouverture est contrôlée à la fin (clé étrangère différée)
  db.exec(`BEGIN;
    INSERT INTO regles_onglet (id, titre, ordre, ouverture_page_id) VALUES
      ('zeta', 'Zêta', 1, 'guide/b'), ('alpha', 'Alpha', 2, 'guide/c'), ('beta', 'Bêta', 2, 'guide/d');
    INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle, adresse) VALUES
      ('page:guide/b', 'zeta', 2, 'guide/b', NULL, NULL),
      ('page:guide/a', 'zeta', 2, 'guide/a', NULL, NULL),
      ('lien:regles/artisanat', 'zeta', 1, NULL, 'Artisanat', 'regles/artisanat/'),
      ('bientot:donjons', 'zeta', 3, NULL, 'Les donjons', NULL),
      ('page:guide/c', 'alpha', 1, 'guide/c', NULL, NULL),
      ('page:guide/d', 'beta', 1, 'guide/d', NULL, NULL);
    COMMIT;`);
  const plan = chargerPlanDesRegles(db);
  // à ordre égal (alpha et beta, 2), l'id départage
  assert.deepEqual(plan.map((o) => o.id), ['zeta', 'alpha', 'beta']);
  assert.deepEqual(plan[0], {
    id: 'zeta', titre: 'Zêta', ouverture: 'guide/b',
    // à rang égal (2), l'id départage : page:guide/a avant page:guide/b
    entrees: [{ libelle: 'Artisanat', adresse: 'regles/artisanat/' }, { page: 'guide/a' }, { page: 'guide/b' }, { bientot: 'Les donjons' }],
  });
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan[0]) && Object.isFrozen(plan[0].entrees) && Object.isFrozen(plan[0].entrees[0]));
  db.close();
});

test('une base d’avant la migration 0091 n’a pas de plan : [] ; une entrée qui n’est d’aucune forme arrête la lecture', () => {
  const db = new DatabaseSync(':memory:');
  assert.deepEqual(chargerPlanDesRegles(db), []);
  db.close();
  // la table refuse une telle ligne (ses CHECK) : seule une ligne lue ailleurs pourrait l'être
  assert.throws(() => entreeDuPlan({ id: 'lien:x', page_id: null, libelle: 'X', adresse: null }), /entrée illisible : lien:x/);
  assert.deepEqual(entreeDuPlan({ id: 'bientot:x', page_id: null, libelle: 'X', adresse: null }), { bientot: 'X' });
});

// L'ordre du menu latéral des races, de la liste /races/ et du tableau des magies innées en bas de /races/ devient une donnée de la base
// (migration data/migrations/0092-rang-des-races.sql, lot de l'édition des menus ; réponses du propriétaire « Menu + liste /races/ » et « /races/
// suit, le reste figé ») : race.rang_liste, nullable (NULL : pas encore rangée, en fin de liste ; choix du leader-technique), sans UNIQUE. La fiche
// garde race.ordre, auquel la migration ne touche pas. Le site de dev est la source de ce qu'il modifie : la valeur de la migration se lit dans
// l'historique (lignesDImport), l'état courant par des invariants. Lecture de la base construite ; les écritures se font dans une COPIE.
// La migration 0120 (décision R239) range Fongoïde et Gémidien à la fin des races pures (rangs 14 et 15) et décale les hybrides de deux.
//   node --test test/db-rang-des-races.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { horsDeLa0120, RACES_DE_LA_0120 } from './aide-races-0120.mjs';

const MIGRATION = '0092-rang-des-races.sql';
// L'ancienne constante du code (client/src/lib/race-kinds.mjs, ORDRE_DES_RACES, avant la migration 0092), figée ici : les races pures, puis les hybrides.
const ORDRE_D_AVANT = [
  'humain', 'nain', 'elfe-forestier', 'elfe-dore', 'elfe-argente', 'elfe-noir', 'farfadet', 'felfe', 'majin', 'hujin', 'drakos', 'lamia', 'mort-vivant',
  'drassahthac', 'orios', 'fenrir', 'kitsune', 'olwman', 'rokh', 'namazu', 'minotaure', 'satyre', 'medusain', 'jackalope', 'marcass', 'anansi', 'goleois',
].map((slug) => `races/${slug}`);
// Après la migration 0120 (R239) : les deux races, dans l'ordre du registre, à la fin des pures (après le Mort-vivant)
const FIN_DES_PURES = ORDRE_D_AVANT.indexOf('races/mort-vivant') + 1;
const ORDRE_APRES_0120 = [...ORDRE_D_AVANT.slice(0, FIN_DES_PURES), ...RACES_DE_LA_0120, ...ORDRE_D_AVANT.slice(FIN_DES_PURES)];

const db = ouvrirBase({ sansExemples: false });

/** Une copie de la base construite, ouverte en écriture (clés étrangères contrôlées), fermée à la fin du test `t`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'rang-des-races', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  t.after(() => base.close());
  return base;
}

test('migration 0092 : race.rang_liste, dernière colonne, entière et nullable, sans index UNIQUE ; race.ordre (la fiche) garde son UNIQUE', () => {
  const colonnes = db.prepare('PRAGMA table_info(race)').all();
  const rang = colonnes.at(-1);
  assert.deepEqual([rang.name, rang.type, rang.notnull, rang.dflt_value], ['rang_liste', 'INTEGER', 0, null]);
  const uniques = db.prepare("SELECT name FROM pragma_index_list('race') WHERE \"unique\" = 1").all()
    .map((i) => db.prepare('SELECT name FROM pragma_index_info(?)').all(i.name).map((c) => c.name).join(','));
  assert.ok(uniques.includes('ordre'), 'race.ordre reste UNIQUE');
  assert.ok(!uniques.some((u) => u.split(',').includes('rang_liste')), 'rang_liste sans UNIQUE');
});

test('valeur d’import : rang_liste reprend l’ancien ORDRE_DES_RACES, pures puis hybrides, Fongoïde et Gémidien à la fin des pures (0120) ; race.ordre n’est pas celui-là', () => {
  const lignes = historiqueSite(db).lignesDImport('race');
  assert.equal(lignes.filter((l) => horsDeLa0120(l.id)).length, 27);
  assert.equal(lignes.length, ORDRE_APRES_0120.length);
  const rangees = lignes.filter((l) => l.rang_liste !== null).sort((a, b) => a.rang_liste - b.rang_liste);
  assert.deepEqual(rangees.map((l) => l.id), ORDRE_APRES_0120);
  assert.deepEqual(rangees.map((l) => l.rang_liste), ORDRE_APRES_0120.map((_, i) => i + 1));
  // deux ordres distincts : la fiche (race.ordre, onglet « Race ») ne suit pas la liste
  assert.notDeepEqual([...lignes].sort((a, b) => a.ordre - b.ordre).map((l) => l.id), ORDRE_APRES_0120);
});

test('état courant : chaque rang est NULL ou au moins 1 ; toute race de l’import est rangée sauf si le site l’a remise à NULL', () => {
  assert.equal(db.prepare('SELECT count(*) AS n FROM race WHERE rang_liste IS NOT NULL AND rang_liste < 1').get().n, 0);
  const h = historiqueSite(db);
  for (const { id, rang_liste: rang } of db.prepare('SELECT id, rang_liste FROM race').all()) {
    if (h.creee('race', { id }) || h.modifiee('race', { id }, 'rang_liste')) continue;
    assert.ok(Number.isInteger(rang) && rang >= 1, `${id} : rangée par la migration`);
  }
});

test('rang_liste : NULL accepté, deux rangs égaux acceptés (un réordonnancement dans un même lot), 0 refusé', (t) => {
  const base = copie(t);
  const ranger = (id, rang) => base.prepare('UPDATE race SET rang_liste = ? WHERE id = ?').run(rang, id);
  ranger('races/goleois', null);
  assert.equal(base.prepare("SELECT rang_liste FROM race WHERE id = 'races/goleois'").get().rang_liste, null);
  // deux races au même rang : le rang courant de l'Humain (le site de dev réordonne les races), donné au Nain
  const rang = base.prepare("SELECT rang_liste FROM race WHERE id = 'races/humain'").get().rang_liste ?? 1;
  ranger('races/humain', rang);
  ranger('races/nain', rang);
  assert.ok(base.prepare('SELECT count(*) AS n FROM race WHERE rang_liste = ?').get(rang).n >= 2);
  assert.equal(base.prepare("SELECT count(*) AS n FROM race WHERE id IN ('races/humain', 'races/nain') AND rang_liste = ?").get(rang).n, 2);
  assert.throws(() => ranger('races/humain', 0), /CHECK constraint failed/);
  assert.throws(() => ranger('races/humain', -3), /CHECK constraint failed/);
});

test('migration 0092 rejouée : les 27 races de la liste prennent leur place, une race créée sur le site avant elle reste à NULL (comme celles d’après)', (t) => {
  const base = copie(t);
  base.exec('ALTER TABLE race DROP COLUMN rang_liste');
  // une race d'essai, absente de la liste (comme une race créée sur le site de dev) : sa page puis sa ligne, copiées de l'Humain
  const copier = (table, remplacements) => {
    const colonnes = base.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    const valeurs = colonnes.map((c) => (c in remplacements ? '?' : `"${c}"`));
    base.prepare(`INSERT INTO "${table}" (${colonnes.map((c) => `"${c}"`).join(', ')}) SELECT ${valeurs.join(', ')} FROM "${table}" WHERE id = 'races/humain'`)
      .run(...colonnes.filter((c) => c in remplacements).map((c) => remplacements[c]));
  };
  copier('page', { id: 'races/race-d-essai', slug: 'race-d-essai', titre: 'Race d’essai', titre_cle: 'race-d-essai' });
  copier('race', { id: 'races/race-d-essai', nom: 'Race d’essai', ordre: 999 });
  rejouerLaMigration(base, MIGRATION);
  // les races qu'elle ne connaît pas (créées sur le site, ou par une migration postérieure : Fongoïde et Gémidien, 0120) restent à NULL, par nom
  const apres = base.prepare('SELECT id FROM race WHERE id <> ? ORDER BY nom').all('races/humain').map((r) => r.id).filter((id) => !ORDRE_D_AVANT.includes(id));
  const rangs = base.prepare('SELECT id, rang_liste FROM race ORDER BY rang_liste IS NULL, rang_liste, nom').all();
  assert.deepEqual(rangs.map((r) => r.id), [...ORDRE_D_AVANT, ...apres]);
  assert.ok(apres.includes('races/race-d-essai') && [...RACES_DE_LA_0120].every((id) => apres.includes(id)));
  assert.deepEqual(rangs.map((r) => r.rang_liste), [...ORDRE_D_AVANT.map((_, i) => i + 1), ...apres.map(() => null)]);
  assert.equal(base.prepare("SELECT ordre FROM race WHERE id = 'races/humain'").get().ordre, db.prepare("SELECT ordre FROM race WHERE id = 'races/humain'").get().ordre);
  assert.match(readFileSync(new URL(`../../data/migrations/${MIGRATION}`, import.meta.url), 'utf8'), /^ALTER TABLE race ADD COLUMN rang_liste INTEGER CHECK/m);
});

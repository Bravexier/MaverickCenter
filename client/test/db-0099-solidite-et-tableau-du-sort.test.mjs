// Migration 0099-solidite-r51-et-tableau-du-sort (lot « Défauts du code ») :
//   * v_arme.solidite_sans_composition applique le plancher de la décision R51 (« impossible de descendre à moins de 1 »), comme le moteur
//     (lib/arme-champs.mjs#durabiliteDeLArme), sur la valeur fixée comme sur la valeur corrigée. L'égalité moteur = vue sur toutes les armes, à l'import
//     et aujourd'hui, est dans test/arme-champs.test.mjs ; ici, le plancher s'essaie sous 1 sur une copie de la base d'import.
//   * invocation.tableau_sort_id : le sort dont le tableau était aussi celui de l'invocation (décision R130), par son id figé. Le tableau « Amélioration
//     cadavérique » est retiré avec sa table (R237 (7), migration 0117) : la colonne reste, vide, avec ses gardes (CHECK, clé étrangère). Ni
//     lib/edition-modele.mjs ni le service n'écrivent la colonne.
//   node --test test/db-0099-solidite-et-tableau-du-sort.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { durabiliteDeLArme } from '../src/lib/arme-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport, cheminDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });

/** Une copie de la base d'import où écrire (clés étrangères actives). */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'db-0099');
  copyFileSync(cheminDImport(), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  t.after(() => base.close());
  return base;
}

test('R130 puis R237 (7), migration 0117 : le tableau « Amélioration cadavérique » est retiré, plus aucune invocation n’a de titre de tableau ni de sort de tableau (à l’import et aujourd’hui)', () => {
  for (const [base, quand] of [[baseDImport(), 'import'], [db, 'aujourd’hui']]) {
    assert.equal(base.prepare('SELECT count(*) AS n FROM invocation WHERE tableau_titre IS NOT NULL OR tableau_sort_id IS NOT NULL').get().n, 0, quand);
    assert.equal(base.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'amelioration_cadaverique'").get().n, 0, quand);
  }
});

test('migration 0099 : la colonne reste gardée par le schéma (un sort de tableau sans titre ou inconnu est refusé ; renommer le sort ne touche pas le lien)', (t) => {
  const base = copie(t);
  const invocation = base.prepare('SELECT id, sort_id FROM invocation WHERE sort_id IS NOT NULL ORDER BY id LIMIT 1').get();
  assert.ok(invocation, 'une invocation avec son sort');
  assert.throws(() => base.prepare('UPDATE invocation SET tableau_sort_id = ? WHERE id = ?').run(invocation.sort_id, invocation.id), /CHECK/);
  assert.throws(() => base.prepare("UPDATE invocation SET tableau_titre = 'Tableau d’essai', tableau_sort_id = ? WHERE id = ?").run(`${invocation.sort_id}-inconnu`, invocation.id), /FOREIGN KEY/);
  base.prepare("UPDATE invocation SET tableau_titre = 'Tableau d’essai', tableau_sort_id = ? WHERE id = ?").run(invocation.sort_id, invocation.id);
  base.prepare("UPDATE sort SET nom = nom || ' renommé', nom_cle = nom_cle || '-renomme' WHERE id = ?").run(invocation.sort_id);
  assert.equal(base.prepare('SELECT tableau_sort_id FROM invocation WHERE id = ?').get(invocation.id).tableau_sort_id, invocation.sort_id);
});

// R194 : une arme a toujours au moins 1 cran propre (le service refuse un effet qui l'en priverait) : ce plancher de la vue et du moteur n'est qu'une
// sécurité, essayée ici sur des lignes mises sous 1 à la main dans une copie
test('R51, R194, migration 0099 : la solidité de v_arme ne descend jamais sous 1 (plancher de sécurité), valeur fixée comme valeur corrigée, comme le moteur', (t) => {
  const base = copie(t);
  const solidite = base.prepare("SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base'").get().valeur;
  const [corrigee, fixee, haute] = base.prepare('SELECT id FROM arme WHERE solidite_fixee IS NULL ORDER BY id LIMIT 3').all().map((r) => r.id);
  base.prepare('UPDATE arme SET solidite_delta = ? WHERE id = ?').run(-solidite - 3, corrigee);
  base.prepare('UPDATE arme SET solidite_fixee = 0 WHERE id = ?').run(fixee);
  base.prepare('UPDATE arme SET solidite_delta = 1 WHERE id = ?').run(haute);
  const vue = (id) => base.prepare('SELECT solidite_sans_composition AS s FROM v_arme WHERE id = ?').get(id).s;
  const moteur = (id) => durabiliteDeLArme(base.prepare('SELECT * FROM arme WHERE id = ?').get(id), solidite);
  assert.equal(vue(corrigee), 1);
  assert.equal(vue(fixee), 1);
  assert.equal(vue(haute), solidite + 1, 'au-dessus du plancher, la valeur corrigée');
  for (const id of [corrigee, fixee, haute]) assert.equal(vue(id), moteur(id), id);
});

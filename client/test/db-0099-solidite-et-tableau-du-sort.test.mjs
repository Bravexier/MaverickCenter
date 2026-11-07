// Migration 0099-solidite-r51-et-tableau-du-sort (lot « Défauts du code ») :
//   * v_arme.solidite_sans_composition applique le plancher de la décision R51 (« impossible de descendre à moins de 1 »), comme le moteur
//     (lib/arme-champs.mjs#durabiliteDeLArme), sur la valeur fixée comme sur la valeur corrigée. L'égalité moteur = vue sur toutes les armes, à l'import
//     et aujourd'hui, est dans test/arme-champs.test.mjs ; ici, le plancher s'essaie sous 1 sur une copie de la base d'import.
//   * invocation.tableau_sort_id : le sort dont le tableau est aussi celui de l'invocation (décision R130), par son id figé. La migration l'a rempli
//     avec la résolution par le nom entre guillemets de tableau_titre (celle de lib/bestiaire-db.mjs#tableauxDesSorts avant le lot) : elle se rejoue
//     sur la base d'import (test/aide-base-d-import.mjs) ; sur la base courante (le site de dev renomme les sorts), seuls les invariants. Ni
//     lib/edition-modele.mjs ni le service n'écrivent la colonne.
//   node --test test/db-0099-solidite-et-tableau-du-sort.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { durabiliteDeLArme } from '../src/lib/arme-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';
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

/** La résolution d'avant la migration : nom entre guillemets du titre, cherché par nom_cle dans la magie du sort de l'invocation. Map(invocation → sort). */
function resolutionParLeNom(base) {
  const resolus = new Map();
  for (const i of base.prepare('SELECT i.id, i.tableau_titre, s.magie_id FROM invocation i JOIN sort s ON s.id = i.sort_id WHERE i.tableau_titre IS NOT NULL').all()) {
    const nom = /["“«]\s*([^"”»]+?)\s*["”»]/.exec(i.tableau_titre)?.[1];
    const sort = nom ? base.prepare('SELECT id FROM sort WHERE magie_id = ? AND nom_cle = ?').get(i.magie_id, normalize(nom)) : null;
    if (sort) resolus.set(i.id, sort.id);
  }
  return resolus;
}

const liens = (base) => new Map(base.prepare('SELECT id, tableau_sort_id FROM invocation WHERE tableau_sort_id IS NOT NULL').all().map((r) => [r.id, r.tableau_sort_id]));

test('R130, migration 0099 : à l’import, tableau_sort_id est le sort que le titre du tableau nomme, pour chaque invocation résolue', () => {
  const importee = baseDImport();
  const attendus = resolutionParLeNom(importee);
  assert.ok(attendus.size > 0, 'au moins un tableau de sacrifice (Amélioration cadavérique)');
  assert.deepEqual(liens(importee), attendus);
  // chaque invocation à titre de tableau est résolue (aucun titre orphelin à l'import)
  const titrees = importee.prepare('SELECT id FROM invocation WHERE tableau_titre IS NOT NULL').all().map((r) => r.id);
  assert.deepEqual(titrees.filter((id) => !attendus.has(id)), []);
});

test('R130, aujourd’hui : le lien par id tient, quel que soit le nom du sort ; même magie que le sort de l’invocation, titre présent', () => {
  // ids figés : la colonne n'est écrite que par la migration, le site de dev ne la change pas
  assert.deepEqual(liens(db), liens(baseDImport()));
  const lignes = db.prepare(`SELECT i.id, i.tableau_titre, i.tableau_sort_id, t.id AS sort_existe, t.magie_id AS magie_du_tableau, s.magie_id AS magie_de_l_invocation
    FROM invocation i LEFT JOIN sort t ON t.id = i.tableau_sort_id LEFT JOIN sort s ON s.id = i.sort_id WHERE i.tableau_sort_id IS NOT NULL`).all();
  assert.ok(lignes.length > 0);
  for (const l of lignes) {
    assert.ok(l.tableau_titre, l.id);
    assert.equal(l.sort_existe, l.tableau_sort_id, l.id);
    assert.equal(l.magie_du_tableau, l.magie_de_l_invocation, l.id);
  }
});

test('migration 0099 : un sort de tableau sans titre ou inconnu est refusé ; renommer le sort ne touche pas le lien', (t) => {
  const base = copie(t);
  const sansTitre = base.prepare('SELECT id FROM invocation WHERE tableau_titre IS NULL ORDER BY id LIMIT 1').get();
  const [invocation, sort] = [...liens(base)][0];
  assert.ok(sansTitre, 'une invocation sans tableau à l’import (golems, marionnettes)');
  assert.throws(() => base.prepare('UPDATE invocation SET tableau_sort_id = ? WHERE id = ?').run(sort, sansTitre.id), /CHECK/);
  assert.throws(() => base.prepare('UPDATE invocation SET tableau_sort_id = ? WHERE id = ?').run(`${sort}-inconnu`, invocation), /FOREIGN KEY/);
  base.prepare("UPDATE sort SET nom = nom || ' renommé', nom_cle = nom_cle || '-renomme' WHERE id = ?").run(sort);
  assert.equal(base.prepare('SELECT tableau_sort_id FROM invocation WHERE id = ?').get(invocation).tableau_sort_id, sort);
  assert.equal(resolutionParLeNom(base).has(invocation), false, 'l’ancienne résolution par le nom perdait le lien');
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

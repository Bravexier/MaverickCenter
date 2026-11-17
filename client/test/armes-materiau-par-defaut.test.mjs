// Le matériau par défaut d'une arme (décision R49 : « son matériau (par défaut le fer) ») se rattache par l'identifiant figé de sa ressource
// (lib/arme-forge.mjs#MATERIAU_PAR_DEFAUT), jamais par son nom ni son nom_cle, que le site de dev recalcule au renommage : la page Armes
// (lib/armes-db.mjs#chargerArmes, `defaut`) et la fiche (lib/fiche-regles.mjs, `materiau_arme_defaut`) gardent le fer renommé.
//   node --test test/armes-materiau-par-defaut.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MATERIAU_PAR_DEFAUT } from '../src/lib/arme-forge.mjs';
import { chargerArmes } from '../src/lib/armes-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { baseDImport, cheminDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const parDefaut = (db) => chargerArmes(db).materiaux.filter((m) => m.defaut).map((m) => m.ligne.ressource_id);

test('R49 : à l’import, le matériau par défaut est le fer, et l’id figé le désigne', () => {
  const importee = baseDImport();
  const fer = importee.prepare("SELECT m.ressource_id AS id FROM materiau_arme m JOIN ressource r ON r.id = m.ressource_id WHERE r.nom_cle = 'fer'").get();
  assert.equal(fer?.id, MATERIAU_PAR_DEFAUT, 'à l’import, le nom « Fer » et l’id figé désignent la même ressource');
  assert.deepEqual(parDefaut(importee), [MATERIAU_PAR_DEFAUT]);
});

test('R49, aujourd’hui : la page et la fiche désignent le même matériau par défaut, celui de l’id figé tant qu’il est au tableau', () => {
  const db = ouvrirBase({ sansExemples: false });
  const present = db.prepare('SELECT 1 FROM materiau_arme WHERE ressource_id = ?').get(MATERIAU_PAR_DEFAUT) !== undefined;
  assert.deepEqual(parDefaut(db), present ? [MATERIAU_PAR_DEFAUT] : []);
  assert.equal(chargerReglesDeFiche(db).materiau_arme_defaut, present ? MATERIAU_PAR_DEFAUT : null);
});

test('R49 : renommer le fer sur le site de dev (nom et nom_cle) ne perd pas le matériau par défaut', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'armes-materiau-par-defaut', { t });
  copyFileSync(cheminDImport(), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  base.exec('PRAGMA foreign_keys = ON');
  base.prepare("UPDATE ressource SET nom = nom || ' (essai)', nom_cle = nom_cle || '-essai' WHERE id = ?").run(MATERIAU_PAR_DEFAUT);
  assert.equal(base.prepare("SELECT count(*) AS n FROM ressource WHERE nom_cle = 'fer'").get().n, 0, 'plus aucune ressource au nom « fer »');
  assert.deepEqual(parDefaut(base), [MATERIAU_PAR_DEFAUT]);
  assert.equal(chargerReglesDeFiche(base).materiau_arme_defaut, MATERIAU_PAR_DEFAUT);
});

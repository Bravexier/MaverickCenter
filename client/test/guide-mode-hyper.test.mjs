// Décision R187 (2) (demande du propriétaire du 2026-11-06 : « Dans le mode hyper rajoute un tableau qui liste les diffents bonus des magie et des races en
// récupérant directement l'information depuis la DB. ») : le chargeur du bloc `mode-hyper` de la page « Le mode hyper » (lib/guide-db.mjs#chargerModeHyper).
// Magies : lecture `onglet_magie`, en-têtes « Magie | Mono-Magie | Bi-magie », le Potentiel Illimité sur une ligne « Forme Complète » dont la cellule tient
// les deux colonnes ; races : lecture `onglet_race`, en-têtes « Race | Capacité | Effet » ; ordre de la source, textes tels quels (balises comprises).
import assert from 'node:assert/strict';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerModeHyper } from '../src/lib/guide-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const tableau = chargerModeHyper(db);
const PI = 'magies/potentiel-illimite';
const effets = (version) => db.prepare('SELECT * FROM mode_hyper_effet WHERE version = ? ORDER BY rang, id').all(version);

test('R187 (2) : les en-têtes des deux tableaux, ceux de la décision (les libellés de colonne de la source pour les magies)', () => {
  assert.deepEqual(tableau.magies.entetes, ['Magie', 'Mono-Magie', 'Bi-magie']);
  assert.deepEqual(tableau.races.entetes, ['Race', 'Capacité', 'Effet']);
  const brut = (v) => db.prepare("SELECT DISTINCT variante_brut AS b FROM mode_hyper_effet WHERE version = 'onglet_magie' AND variante = ?").all(v).map((r) => r.b);
  assert.deepEqual([...brut('mono'), ...brut('bi')], tableau.magies.entetes.slice(1));
});

test('R187 (2) : magies — une ligne par magie de la lecture onglet_magie, dans l’ordre de la source, nom de la table magie, effets tels quels', () => {
  const lignes = effets('onglet_magie');
  const ordre = [...new Set(lignes.map((e) => e.magie_id))];
  assert.deepEqual(tableau.magies.lignes.map((l) => l.id), ordre, 'ordre de la source (rang)');
  assert.equal(ordre.length, 15);
  const parId = new Map(lignes.map((e) => [e.id, e]));
  for (const l of tableau.magies.lignes) {
    assert.equal(l.nom, db.prepare('SELECT nom FROM magie WHERE id = ?').get(l.id).nom, l.id);
    assert.equal(l.libelle, parId.get(l.cellules[0].id).libelle, l.id);
    for (const c of l.cellules) {
      const e = parId.get(c.id);
      assert.equal(e.magie_id, l.id);
      assert.equal(c.effet, e.effet, `${c.id} : tel quel`);
    }
    if (l.id === PI) continue;
    assert.deepEqual(l.cellules.map((c) => [parId.get(c.id).variante, c.colonnes]), [['mono', 1], ['bi', 1]], `${l.id} : Mono-Magie puis Bi-magie`);
  }
  // les balises du glossaire restent (le rendu s'en charge) : au moins un effet en porte une, dans l'état où les lots du site rapatriés avant la 0093
  // les ont posées (l'effet est modifiable sur le site de dev : seuls les lots rapatriés depuis sont défaits, test/aide-base-d-import.mjs)
  assert.ok(chargerModeHyper(baseDImport({ garder: lotsAvant('0093') })).magies.lignes.some((l) => l.cellules.some((c) => c.effet.includes('{{'))));
  assert.equal(tableau.magies.lignes.flatMap((l) => l.cellules).length, lignes.length, 'chaque effet une fois');
});

test('R187 (2) : le Potentiel Illimité, une seule cellule « Forme Complète » sur les deux colonnes', () => {
  const pi = tableau.magies.lignes.find((l) => l.id === PI);
  const e = db.prepare("SELECT * FROM mode_hyper_effet WHERE version = 'onglet_magie' AND magie_id = ?").all(PI);
  assert.equal(e.length, 1);
  assert.equal(e[0].variante, 'forme_complete');
  assert.deepEqual(pi.cellules, [{ id: e[0].id, intitule: 'Forme Complète', effet: e[0].effet, colonnes: 2 }]);
  assert.equal(pi.nom, 'Potentiel Illimité');
});

test('R187 (2) : races — lecture onglet_race, ordre de la source, nom de la table race, capacité = nom, effet tel quel', () => {
  const lignes = effets('onglet_race');
  // une capacité par race : les 27 du classeur « Les races » et les deux de la mise à jour de Décembre (R239, migration 0120 : rangs 28 et 29)
  assert.equal(lignes.length, db.prepare('SELECT count(*) AS n FROM race').get().n);
  assert.deepEqual(tableau.races.lignes, lignes.map((e) => ({
    id: e.race_id, nom: db.prepare('SELECT nom FROM race WHERE id = ?').get(e.race_id).nom, libelle: e.libelle, capacite: e.nom, effet: e.effet, effet_id: e.id,
  })));
  // le nom du site (table race), pas la cible telle que l'onglet l'écrit
  const namazu = tableau.races.lignes.find((l) => l.id === 'races/namazu');
  assert.equal(namazu.nom, db.prepare("SELECT nom FROM race WHERE id = 'races/namazu'").get().nom);
  assert.equal(namazu.libelle, db.prepare("SELECT libelle FROM mode_hyper_effet WHERE id = 'onglet_race:races/namazu'").get().libelle);
});

test('chargerModeHyper : une forme que le tableau ne sait pas montrer arrête le rendu (rien ne disparaît en silence)', (t) => {
  const copie = (sql) => {
    const chemin = join(dossierTemporaire('guide-mode-hyper', { t }), 'maverick.db');
    cpSync(cheminBase({ sansExemples: false }), chemin);
    const b = new DatabaseSync(chemin);
    b.exec(sql);
    t.after(() => b.close());
    return b;
  };
  assert.throws(() => chargerModeHyper(copie("DELETE FROM mode_hyper_effet WHERE id = 'onglet_magie:magies/magie-du-feu:bi'")), /magie-du-feu sans effet « bi »/);
  assert.throws(() => chargerModeHyper(copie("UPDATE mode_hyper_effet SET variante_brut = 'Bi magie' WHERE id = 'onglet_magie:magies/magie-du-feu:bi'")),
    /la colonne « bi » s'écrit « Bi-magie » et « Bi magie »/);
});

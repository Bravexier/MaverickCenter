// Les invocations sur la fiche (décision R130) : les créatures d'un sort qui invoque, celles à la portée du personnage d'abord, et ce que donne un sort qui
// sacrifie une invocation. Les invocations se lisent dans la base ; les tests suivent ses invariants (le site de dev peut modifier les créatures).
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { tableauxDesSorts } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { baseDImport, cheminDImport, reglesDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', xp: xpDuNiveau(20), ...x });
const sortDe = (inv) => regles.sorts.find((s) => s.id === inv.sort_id);
const POTENTIEL = 'magies/potentiel-illimite';

test('regles.invocations : chaque invocation qui a son sort, toutes ses créatures', () => {
  const n = (sql) => db.prepare(sql).get().n;
  assert.equal(regles.invocations.length, n('SELECT count(*) AS n FROM invocation WHERE sort_id IS NOT NULL'));
  assert.equal(regles.invocations.reduce((t, i) => t + i.creatures.length, 0),
    n('SELECT count(*) AS n FROM creature c JOIN invocation i ON i.id = c.invocation_id WHERE i.sort_id IS NOT NULL'));
  for (const i of regles.invocations) {
    assert.ok(sortDe(i), i.id);
    for (const c of i.creatures) {
      // une combinaison de magies commence par celle du sort ; une marionnette n'en a pas, mais un NPM
      if (c.npm === null) assert.equal(c.magies[0], sortDe(i).magie_id, c.id);
      else assert.deepEqual(c.magies, [], c.id);
    }
  }
});

test('creaturesDuSort : la combinaison mono et celle de la seconde magie d’abord, les autres avec un allié (« Toutes, les miennes d’abord »)', () => {
  const combinees = regles.invocations.filter((i) => i.creatures.some((c) => c.magies.length === 2));
  assert.ok(combinees.length >= 2, 'golems et non-morts');
  for (const inv of combinees) {
    const sort = sortDe(inv);
    const secondes = [...new Set(inv.creatures.filter((c) => c.magies.length === 2).map((c) => c.magies[1]))].filter((m) => m !== sort.magie_id && m !== POTENTIEL);
    for (const seconde of secondes) {
      // la magie du sort innée, la seconde acquise ; puis l'inverse : le même résultat
      for (const f of [fiche({ magie_innee_id: sort.magie_id, magie_acquise_id: seconde }), fiche({ magie_innee_id: seconde, magie_acquise_id: sort.magie_id })]) {
        const r = M.creaturesDuSort(regles, f, sort);
        assert.equal(r.raison, 'allie');
        assert.deepEqual([...r.miennes, ...r.autres].map((c) => c.id).sort(), inv.creatures.map((c) => c.id).sort());
        for (const c of r.miennes) assert.ok(c.magies.length === 1 || c.magies[1] === seconde, `${seconde} : ${c.id}`);
        for (const c of r.autres) assert.ok(c.magies.length === 2 && c.magies[1] !== seconde, `${seconde} : ${c.id}`);
        // l'ordre du classeur, dans chaque groupe
        const rang = (c) => inv.creatures.indexOf(c);
        assert.deepEqual(r.miennes.map(rang), r.miennes.map(rang).sort((a, b) => a - b));
      }
    }
    // une seule magie : la combinaison mono seulement ; deux fois la magie du sort (« Terre + Terre ») demande un allié
    const seul = M.creaturesDuSort(regles, fiche({ magie_innee_id: sort.magie_id }), sort);
    assert.ok(seul.miennes.length > 0);
    assert.ok(seul.miennes.every((c) => c.magies.length === 1));
    assert.ok(seul.autres.filter((c) => c.magies.length === 2 && c.magies[1] === sort.magie_id).length === inv.creatures.filter((c) => c.magies[1] === sort.magie_id).length);
    // le Potentiel Illimité « ne peut pas faire d'invocation double élément tout seul »
    const potentiel = M.creaturesDuSort(regles, fiche({ magie_innee_id: POTENTIEL }), sort);
    assert.deepEqual(potentiel.miennes.map((c) => c.id), seul.miennes.map((c) => c.id));
  }
});

test('creaturesDuSort : une marionnette (une créature par NPM) est à la portée du personnage jusqu’au NPM accessible', () => {
  const inv = regles.invocations.find((i) => i.creatures.length && i.creatures.every((c) => c.npm !== null));
  assert.ok(inv, 'marionnettes');
  const sort = sortDe(inv);
  for (const niveau of [1, 8, 20]) {
    const f = fiche({ magie_innee_id: sort.magie_id, xp: xpDuNiveau(niveau) });
    const max = M.npmMax(regles, f);
    const r = M.creaturesDuSort(regles, f, sort);
    assert.equal(r.raison, 'npm');
    assert.ok(r.miennes.every((c) => c.npm <= max) && r.autres.every((c) => c.npm > max), `niveau ${niveau}`);
  }
  // un sort qui n'invoque rien
  assert.equal(M.creaturesDuSort(regles, fiche(), regles.sorts.find((s) => !regles.invocations.some((i) => i.sort_id === s.id))), null);
});

test('sacrificeDuSort : l’effet de la carte sacrifiée (« Manteau noir »), le tableau entier (« Amélioration cadavérique »), rien pour un autre sort', () => {
  const effets = db.prepare('SELECT sort_id, count(*) AS n FROM creature_effet WHERE sort_id IS NOT NULL GROUP BY sort_id').all();
  assert.ok(effets.length > 0);
  for (const e of effets) {
    const r = M.sacrificeDuSort(regles, e.sort_id);
    assert.equal(r.type, 'effets');
    assert.equal(r.lignes.length, e.n);
    for (const x of r.lignes) assert.ok(x.creature.id && x.texte);
  }
  // le tableau d'une invocation se rattache au sort que désigne invocation.tableau_sort_id (id figé, migration 0099 ; lib/bestiaire-db.mjs#tableauxDesSorts) :
  // un renommage du sort ou un titre réécrit sur le site de dev ne coupe pas le lien. Le titre écrit le nom du sort à l'import seulement
  // (test/aide-base-d-import.mjs) ; sur la base courante, le lien est celui de la colonne
  for (const [r0, base, quand] of [[reglesDImport(), baseDImport(), 'import'], [regles, db, 'aujourd’hui']]) {
    const lies = base.prepare('SELECT id, tableau_sort_id FROM invocation WHERE tableau_sort_id IS NOT NULL ORDER BY id').all();
    assert.ok(lies.length > 0, `${quand} : Amélioration cadavérique`);
    assert.deepEqual(r0.tableaux_de_sacrifice.map((t) => [t.invocation_id, t.sort_id]).sort(), lies.map((l) => [l.id, l.tableau_sort_id]), quand);
    for (const t of r0.tableaux_de_sacrifice) {
      const r = M.sacrificeDuSort(r0, t.sort_id);
      assert.equal(r.type, 'tableau', quand);
      assert.equal(r.lignes.length, base.prepare('SELECT count(*) AS n FROM amelioration_cadaverique a JOIN sort s ON s.magie_id = a.magie_id WHERE s.id = ?').get(t.sort_id).n, quand);
      if (quand !== 'import') continue;
      // à l'import, le sort porte le nom écrit dans le titre du tableau de son invocation (décision R130)
      const titre = base.prepare('SELECT tableau_titre FROM invocation WHERE id = ?').get(t.invocation_id).tableau_titre;
      const nom = base.prepare('SELECT nom FROM sort WHERE id = ?').get(t.sort_id).nom;
      assert.equal(titre.toLocaleLowerCase('fr').includes(nom.toLocaleLowerCase('fr')), true, `${quand} : ${titre} / ${nom}`);
    }
    // un sort qui invoque sans rien donner au sacrifice
    const sacrifie = (id) => r0.tableaux_de_sacrifice.some((t) => t.sort_id === id) || r0.invocations.some((i) => i.creatures.some((c) => c.effets.some((e) => e.sort_id === id)));
    assert.equal(M.sacrificeDuSort(r0, r0.invocations.find((i) => !sacrifie(i.sort_id)).sort_id), null, quand);
  }
});

test('tableauxDesSorts : renommer le sort et réécrire le titre du tableau sur le site de dev ne coupe pas le lien (id figé, migration 0099)', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'fiche-invocations', { t });
  copyFileSync(cheminDImport(), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  base.exec('PRAGMA foreign_keys = ON');
  const avant = tableauxDesSorts(base);
  assert.ok(avant.size > 0, 'un tableau de sacrifice à l’import');
  for (const [sortId, tableau] of avant) {
    base.prepare("UPDATE sort SET nom = nom || ' (essai)', nom_cle = nom_cle || '-essai' WHERE id = ?").run(sortId);
    base.prepare("UPDATE invocation SET tableau_titre = 'Tableau d’essai' WHERE id = ?").run(tableau.invocationId);
  }
  const apres = tableauxDesSorts(base);
  assert.deepEqual([...apres.keys()], [...avant.keys()]);
  for (const [sortId, tableau] of apres) {
    assert.equal(tableau.invocationId, avant.get(sortId).invocationId, sortId);
    assert.deepEqual(tableau.lignes, avant.get(sortId).lignes, sortId);
    // le nom et le titre courants, lus par id
    assert.equal(tableau.nom, base.prepare('SELECT nom FROM sort WHERE id = ?').get(sortId).nom, sortId);
    assert.equal(tableau.titre, base.prepare('SELECT tableau_titre FROM invocation WHERE id = ?').get(tableau.invocationId).tableau_titre, sortId);
  }
});

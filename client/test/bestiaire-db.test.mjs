// Lignes des deux tableaux de /bestiaire/ (lib/bestiaire-db.mjs) : monstres du « Bestiaire 2.0 » et, à part, créatures invoquées (demande du propriétaire).
// Les monstres se modifient sur le site de dev : ces tests contrôlent la cohérence des lignes avec la base, pas les valeurs de l'import
// (test/bestiaire-extraction.test.mjs les compare au doc).
import { normalize } from '../src/lib/text.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORIES, chargerBestiaire, optionsDeFacette, tableauDuButin } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });
const { monstres, invocations } = chargerBestiaire(db);
const n = (sql) => db.prepare(sql).get().n;

test('monstres : une ligne par carte, et une par espèce sans carte ; ancres uniques', () => {
  assert.equal(monstres.cartes, n('SELECT count(*) AS n FROM monstre'));
  assert.equal(monstres.especes, n('SELECT count(*) AS n FROM monstre_espece'));
  assert.equal(monstres.lignes.length, monstres.cartes + n('SELECT count(*) AS n FROM monstre_espece e WHERE NOT EXISTS (SELECT 1 FROM monstre m WHERE m.espece_id = e.id)'));
  const ancres = [...monstres.lignes, ...invocations.lignes].map((l) => l.ancre);
  assert.equal(new Set(ancres).size, ancres.length);
  for (const a of ancres) assert.match(a, /^(monstre|invoquee)-[a-z0-9-]+$/);
  // l'ancre d'une carte est son nom ; un nom écrit dans deux espèces (« Golem de corail III ») : la seconde prend « -2 »
  const vus = new Map();
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const cle = normalize(l.nom);
    vus.set(cle, (vus.get(cle) ?? 0) + 1);
    assert.equal(l.ancre, vus.get(cle) === 1 ? `monstre-${cle}` : `monstre-${cle}-${vus.get(cle)}`, l.id);
  }
  // l'ordre du doc : espèce par espèce, carte par carte
  const ordre = db.prepare('SELECT m.id FROM monstre m JOIN monstre_espece e ON e.id = m.espece_id ORDER BY e.ordre, m.rang').all().map((r) => r.id);
  assert.deepEqual(monstres.lignes.filter((l) => l.carte).map((l) => l.id), ordre);
});

test('monstres : tri et filtres sur les colonnes du tableau seulement (espèce, nom, type, catégorie, EP, lieux), valeurs de la base, rien de calculé', () => {
  const parId = new Map(db.prepare('SELECT m.*, e.nom AS espece_nom FROM monstre m JOIN monstre_espece e ON e.id = m.espece_id').all().map((m) => [m.id, m]));
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const m = parId.get(l.id);
    assert.deepEqual(Object.keys(l.tri), ['espece', 'nom', 'type', 'categorie', 'ep', 'lieu'], l.id);
    assert.deepEqual(Object.keys(l.facettes), ['espece', 'type', 'categorie', 'ep', 'lieu'], l.id);
    assert.deepEqual([l.tri.espece, l.tri.nom, l.tri.type, l.tri.categorie, l.tri.ep], [m.espece_nom, m.nom, m.type_brut, ['ennemi_simple', 'mini_boss', 'boss'].indexOf(m.categorie), m.ep_min], l.id);
    assert.deepEqual(l.facettes.categorie, [m.categorie]);
    assert.deepEqual(l.facettes.espece, [normalize(m.espece_nom)]);
    assert.equal(l.facettes.ep.length, m.ep_max - m.ep_min + 1, l.id);
  }
  // une espèce sans carte : ni type ni catégorie (triée après les autres sur ces colonnes)
  for (const l of monstres.lignes.filter((x) => !x.carte)) assert.deepEqual(Object.keys(l.facettes), ['espece', 'ep', 'lieu'], l.id);
});

test('filtres des monstres : chaque option compte les lignes qui portent sa valeur ; libellé = l’écriture la plus fréquente', () => {
  // « Inutile de filtrer par les colonnes non affichées » (demande du propriétaire) : un filtre par colonne, dans leur ordre, sauf le nom (la recherche)
  assert.deepEqual(monstres.facettes.map((f) => f.cle), ['espece', 'type', 'categorie', 'ep', 'lieu']);
  // l'espèce : une option par nom d'espèce (« Golem de corail », écrit deux fois dans le doc, n'en fait qu'une)
  assert.deepEqual(
    monstres.facettes.find((f) => f.cle === 'espece').options.map((o) => o.valeur).sort(),
    [...new Set(db.prepare('SELECT nom FROM monstre_espece').all().map((r) => normalize(r.nom)))].sort(),
  );
  for (const f of monstres.facettes) {
    assert.ok(f.options.length > 0, f.cle);
    for (const o of f.options) assert.equal(o.nombre, monstres.lignes.filter((l) => (l.facettes[f.cle] ?? []).includes(o.valeur)).length, `${f.cle} ${o.valeur}`);
  }
  const options = (cle) => monstres.facettes.find((f) => f.cle === cle).options;
  assert.deepEqual(options('categorie').map((o) => o.libelle), Object.values(CATEGORIES));
  const echelles = [...new Set(monstres.lignes.flatMap((l) => l.facettes.ep))].sort((a, b) => a - b);
  assert.deepEqual(options('ep').map((o) => o.valeur), echelles, 'les échelles dans l’ordre');
  // un type écrit de plusieurs façons (« Non-mort », « Non-Mort ») : une seule option, l'écriture la plus fréquente, toutes ses lignes
  const types = db.prepare('SELECT type_brut AS t, count(*) AS n FROM monstre WHERE type_brut IS NOT NULL GROUP BY type_brut').all();
  for (const o of options('type')) {
    const ecritures = types.filter((x) => normalize(x.t) === o.valeur).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, 'fr'));
    assert.equal(o.libelle, ecritures[0].t, o.valeur);
    assert.equal(o.nombre, ecritures.reduce((k, x) => k + x.n, 0), o.valeur);
  }
  assert.ok(options('type').length < types.length, 'des écritures réunies');
});

test('optionsDeFacette : effectifs, libellés et ordre voulu', () => {
  const lignes = [{ facettes: { t: ['a', 'b'] } }, { facettes: { t: ['a'] } }, { facettes: {} }];
  const ecritures = new Map([['a', new Map([['A', 1], ['à', 3]])], ['b', new Map([['B', 1]])]]);
  assert.deepEqual(optionsDeFacette(lignes, 't', ecritures), [{ valeur: 'a', libelle: 'à', nombre: 2 }, { valeur: 'b', libelle: 'B', nombre: 1 }]);
  assert.deepEqual(optionsDeFacette(lignes, 't', ecritures, ['b']).map((o) => o.valeur), ['b', 'a']);
});

test('butin d’une espèce : une ligne par tranche, une colonne par catégorie, cellule vide = null', () => {
  const t = tableauDuButin([
    { rang: 1, score_brut: '3-15', categorie: 'boss', texte: 'X' },
    { rang: 1, score_brut: '3-15', categorie: 'ennemi_simple', texte: 'Y' },
    { rang: 2, score_brut: '16-60', categorie: 'mini_boss', texte: 'Z' },
  ]);
  assert.deepEqual(t, [
    { rang: 1, score: '3-15', ennemi_simple: 'Y', mini_boss: null, boss: 'X' },
    { rang: 2, score: '16-60', ennemi_simple: null, mini_boss: 'Z', boss: null },
  ]);
  // le butin d'une ligne : celui de son espèce dans la base, tranche par tranche
  for (const l of monstres.lignes) {
    const lignes = db.prepare('SELECT * FROM monstre_butin WHERE espece_id = ? ORDER BY rang').all(l.espece.id);
    assert.deepEqual(l.espece.butin, tableauDuButin(lignes), l.id);
  }
  assert.ok(monstres.lignes.some((l) => l.espece.butin.length));
});

test('créatures invoquées : à part, une carte par créature, dans l’ordre du classeur ; un filtre sur la seule colonne filtrable affichée (magie)', () => {
  assert.equal(invocations.lignes.length, n('SELECT count(*) AS n FROM creature'));
  assert.deepEqual(invocations.invocations.map((i) => i.nom), db.prepare('SELECT nom FROM invocation ORDER BY ordre').all().map((r) => r.nom));
  assert.deepEqual(invocations.facettes.map((f) => f.cle), ['magie']);
  const lignesDesTableaux = invocations.tableaux.flatMap((t) => t.lignes);
  // le nombre d'une valeur compte des créatures (les cases de ses lignes), comme le compte de la page, pas des combinaisons
  for (const f of invocations.facettes) {
    for (const o of f.options) {
      const n = lignesDesTableaux.filter((l) => l.facettes[f.cle].includes(o.valeur)).reduce((k, l) => k + l.cases.length, 0);
      assert.equal(o.nombre, n, `${f.cle} ${o.valeur}`);
    }
  }
  assert.ok(lignesDesTableaux.some((l) => l.cases.length === 2 && l.facettes.magie.length), 'des lignes de deux créatures sont comptées');
  const magma = invocations.lignes.find((l) => l.ancre === 'invoquee-golem-de-magma');
  assert.deepEqual(magma.magiesDuBloc, ['Terre', 'Feu']);
  assert.equal(magma.sante, '20/NPM');
  assert.equal(magma.invocation.sortNom, db.prepare("SELECT s.nom FROM invocation i JOIN sort s ON s.id = i.sort_id WHERE i.id = 'bestiaire/appel-aux-golems'").get().nom);
  const peur = (l) => l.defensesEcrites.some((d) => normalize(d.libelle) === 'immunite-peur');
  assert.ok(!peur(magma), 'les golems ne sont pas des non-morts');
  const zombi = invocations.lignes.find((l) => l.ancre === 'invoquee-zombi');
  assert.ok(peur(zombi), 'capacité commune « Non-Mort »');
  assert.deepEqual(zombi.defensesParMagie.map((d) => d.magie), ['Nécromancie']);
});

test('créatures invoquées : trois tableaux (demande du propriétaire), une ligne par bloc du classeur — combinaison et ses deux créatures côte à côte, le mono d’abord ; palier et sa créature', () => {
  // un tableau par invocation, dans l'ordre du classeur ; une ligne par bloc de la marge, dans son ordre ; chaque créature dans une case, une seule fois
  assert.deepEqual(invocations.tableaux.map((t) => t.invocation.id), db.prepare('SELECT id FROM invocation ORDER BY ordre').all().map((r) => r.id));
  const blocs = db.prepare('SELECT b.id, b.invocation_id, b.marge_brut, b.ep, (SELECT count(*) FROM invocation_bloc_magie m WHERE m.bloc_id = b.id) AS magies FROM invocation_bloc b ORDER BY b.invocation_id, b.rang').all();
  for (const t of invocations.tableaux) {
    const siens = blocs.filter((b) => b.invocation_id === t.invocation.id);
    assert.deepEqual(t.lignes.map((l) => l.id), siens.map((b) => b.id), `${t.invocation.id} : ses blocs, dans l'ordre`);
    assert.deepEqual(t.lignes.map((l) => l.marge), siens.map((b) => b.marge_brut));
    assert.equal(t.creatures, n(`SELECT count(*) AS n FROM creature WHERE invocation_id = '${t.invocation.id}'`));
    for (const l of t.lignes) {
      const rangs = db.prepare('SELECT id FROM creature WHERE bloc_id = ? ORDER BY rang').all(l.id).map((r) => r.id);
      assert.deepEqual(l.cases.map((c) => c.id), rangs, `${l.id} : carte de gauche, puis de droite`);
      // le mono : une seule magie dans la marge (« Terre + Terre » en a deux, la même) ; un palier n'a pas de magie
      assert.equal(l.mono, siens.find((b) => b.id === l.id).magies === 1, l.id);
      // les magies de la combinaison, dans l'ordre de la marge
      assert.deepEqual(l.magies, db.prepare('SELECT m.nom FROM invocation_bloc_magie bm JOIN magie m ON m.id = bm.magie_id WHERE bm.bloc_id = ? ORDER BY bm.rang').all(l.id).map((r) => r.nom), l.id);
    }
    // golems, non-morts : deux créatures par combinaison, le mono en premier ; marionnettes : une par palier « EP »
    if (t.duo) {
      assert.ok(t.lignes.every((l) => l.cases.length === 2), `${t.invocation.id} : deux cases côte à côte`);
      assert.ok(t.lignes[0].mono && t.lignes.slice(1).every((l) => !l.mono), `${t.invocation.id} : le mono d'abord, et lui seul`);
    } else {
      assert.ok(t.lignes.every((l) => l.cases.length === 1 && l.ep !== null && l.magies.length === 0), `${t.invocation.id} : une ligne par palier`);
    }
  }
  assert.deepEqual(invocations.tableaux.map((t) => t.duo), [true, true, false], 'golems et non-morts sur le même modèle, marionnettes à part');
  const ids = invocations.tableaux.flatMap((t) => t.lignes.flatMap((l) => l.cases.map((c) => c.id)));
  assert.deepEqual([...ids].sort(), invocations.lignes.map((l) => l.id).sort(), 'chaque créature une fois');
  // l'ordre des lignes (data-ordre) suit les trois tableaux
  assert.deepEqual(invocations.tableaux.flatMap((t) => t.lignes.map((l) => l.ordre)), blocs.map((_, k) => k));
});


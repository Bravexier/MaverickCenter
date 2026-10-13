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

test('monstres : les valeurs de tri et de filtre sont celles de la base, rien de calculé', () => {
  const parId = new Map(db.prepare('SELECT * FROM monstre').all().map((m) => [m.id, m]));
  for (const l of monstres.lignes.filter((x) => x.carte)) {
    const m = parId.get(l.id);
    assert.deepEqual([l.tri.sante, l.tri.chakra, l.tri.barriere, l.tri.defense, l.tri.vitesse, l.tri.ep], [m.sante, m.chakra, m.barriere, m.armure_physique, m.vitesse_sol, m.ep_min], l.id);
    assert.deepEqual(l.facettes.categorie, [m.categorie]);
    assert.equal(l.facettes.ep.length, m.ep_max - m.ep_min + 1, l.id);
  }
  // « varie » : une carte dont les stats sont par échelle n'a pas de santé typée
  for (const l of monstres.lignes.filter((x) => x.carte?.variable)) assert.equal(l.tri.sante, null, l.id);
});

test('filtres des monstres : chaque option compte les lignes qui portent sa valeur ; libellé = l’écriture la plus fréquente', () => {
  assert.deepEqual(monstres.facettes.map((f) => f.cle), ['categorie', 'ep', 'type', 'alignement', 'lieu', 'vulnerabilite', 'resistance', 'immunite', 'capacite']);
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

test('créatures invoquées : à part, une ligne par créature, dans l’ordre du classeur ; filtres sur l’invocation, la magie, les dégâts, les défenses, les capacités', () => {
  assert.equal(invocations.lignes.length, n('SELECT count(*) AS n FROM creature'));
  assert.deepEqual(invocations.invocations.map((i) => i.nom), db.prepare('SELECT nom FROM invocation ORDER BY ordre').all().map((r) => r.nom));
  assert.deepEqual(invocations.facettes.map((f) => f.cle), ['invocation', 'magie', 'degat', 'defense', 'capacite']);
  for (const f of invocations.facettes) for (const o of f.options) assert.equal(o.nombre, invocations.lignes.filter((l) => l.facettes[f.cle].includes(o.valeur)).length, `${f.cle} ${o.valeur}`);
  const magma = invocations.lignes.find((l) => l.ancre === 'invoquee-golem-de-magma');
  assert.deepEqual(magma.magiesDuBloc, ['Terre', 'Feu']);
  assert.equal(magma.sante, '20/NPM');
  assert.equal(magma.invocation.sortNom, db.prepare("SELECT s.nom FROM invocation i JOIN sort s ON s.id = i.sort_id WHERE i.id = 'bestiaire/appel-aux-golems'").get().nom);
  assert.ok(magma.facettes.defense.includes('immunite-peur') === false, 'les golems ne sont pas des non-morts');
  const zombi = invocations.lignes.find((l) => l.ancre === 'invoquee-zombi');
  assert.ok(zombi.facettes.defense.includes('immunite-peur'), 'capacité commune « Non-Mort »');
  assert.deepEqual(zombi.defensesParMagie.map((d) => d.magie), ['Nécromancie']);
});

// Relations de la carte des magies (lib/magie-fleches.mjs, demande du propriétaire) : épée au bout B d'un trait A – B quand A est efficace contre B,
// bouclier quand B résiste à A, boucle à bouclier quand une magie résiste à elle-même ; géométrie (pointes, traits, boucles). Cas limites, puis la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { geometrieDesLiaisons, liaisonsEntreMagies, POINTES, segmentCoupe } from '../src/lib/magie-fleches.mjs';

const magie = (id, { resiste = [], vulnerable = [] } = {}) => ({
  id,
  resistances: { resistance: { magies: resiste.map((m) => ({ id: m })) }, vulnerabilite: { magies: vulnerable.map((m) => ({ id: m })) } },
});

test('épée chez la magie vulnérable, bouclier chez celle qui résiste, un seul trait par paire', () => {
  // Terre est efficace contre Foudre (Foudre vulnérable à Terre) et résiste à Foudre
  const { liaisons, boucles } = liaisonsEntreMagies([magie('terre', { resiste: ['foudre'] }), magie('foudre', { vulnerable: ['terre'] })]);
  assert.deepEqual(liaisons, [{ a: 'terre', b: 'foudre', pointes: { terre: ['bouclier'], foudre: ['epee'] } }]);
  assert.deepEqual(boucles, []);
});

test('relations mutuelles : deux épées, ou deux boucliers', () => {
  const epees = liaisonsEntreMagies([magie('vide', { vulnerable: ['et'] }), magie('et', { vulnerable: ['vide'] })]);
  assert.deepEqual(epees.liaisons[0].pointes, { vide: ['epee'], et: ['epee'] });
  const boucliers = liaisonsEntreMagies([magie('arcane', { resiste: ['corruption'] }), magie('corruption', { resiste: ['arcane'] })]);
  assert.deepEqual(boucliers.liaisons[0].pointes, { arcane: ['bouclier'], corruption: ['bouclier'] });
});

test('une magie qui résiste à elle-même a une boucle à bouclier ; doublons et magies inconnues ignorés', () => {
  const { liaisons, boucles } = liaisonsEntreMagies([magie('feu', { resiste: ['feu', 'feu', 'inconnue'], vulnerable: ['inconnue'] })]);
  assert.deepEqual(liaisons, []);
  assert.deepEqual(boucles, [{ id: 'feu', pointes: ['bouclier'] }]);
});

const pastille = (x, y, w = 150) => ({ x, y, w, h: 48 });
const translation = (transform) => transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);

test('géométrie : épée tournée vers sa pastille, bouclier droit, trait arrêté derrière les pointes', () => {
  const relations = { liaisons: [{ a: 'a', b: 'b', pointes: { a: ['bouclier'], b: ['epee'] } }], boucles: [] };
  const { traits } = geometrieDesLiaisons(relations, new Map([['a', pastille(100, 100)], ['b', pastille(600, 100)]]), { hauteur: 200 });
  const [trait] = traits;
  const epee = trait.pointes.find((p) => p.forme === 'epee');
  const bouclier = trait.pointes.find((p) => p.forme === 'bouclier');
  // B est à droite : l'épée arrive de la gauche (rotation 0), pointe sur le bord de B (600 - 75 - 3)
  assert.equal(epee.transform, 'translate(522 100) rotate(0)');
  // bouclier sans rotation, centré à POINTES.bouclier.centre du bord de A (100 + 75 + 3)
  assert.ok(!bouclier.transform.includes('rotate'));
  assert.deepEqual(translation(bouclier.transform), [178 + POINTES.bouclier.centre, 100]);
  // le trait commence derrière le bouclier et finit derrière l'épée
  assert.equal(trait.x1, 178 + POINTES.bouclier.recul - 1);
  assert.equal(trait.x2, 522 - (POINTES.epee.recul - 1));
  assert.deepEqual(trait.bord, [178, 100, 522, 100]);
});

test('géométrie : deux pointes d’une même pastille ne se touchent pas (la seconde est éloignée le long de son trait)', () => {
  const relations = {
    liaisons: [
      { a: 'v', b: 'g', pointes: { v: ['bouclier'], g: ['epee'] } },
      { a: 'v', b: 'f', pointes: { v: ['bouclier'], f: ['epee'] } },
    ],
    boucles: [],
  };
  const pastilles = new Map([['v', pastille(100, 210)], ['g', pastille(500, 40)], ['f', pastille(405, 155)]]);
  const { traits } = geometrieDesLiaisons(relations, pastilles, { hauteur: 420 });
  const [c1, c2] = traits.map((t) => t.encombrement[0]);
  assert.ok(Math.hypot(c1.centre[0] - c2.centre[0], c1.centre[1] - c2.centre[1]) >= c1.rayon + c2.rayon);
});

test('géométrie : la boucle va là où il n’y a ni pastille voisine, ni trait de la magie', () => {
  // une voisine juste au-dessus à droite, un trait vers la droite : la boucle doit aller ailleurs
  const pastilles = new Map([['m', pastille(300, 200)], ['voisine', pastille(420, 125)], ['autre', pastille(800, 200)]]);
  const relations = { liaisons: [{ a: 'm', b: 'autre', pointes: { m: ['bouclier'], autre: ['epee'] } }], boucles: [{ id: 'm', pointes: ['bouclier'] }] };
  const { traits, boucles } = geometrieDesLiaisons(relations, pastilles, { hauteur: 400 });
  const [boucle] = boucles;
  const voisine = pastilles.get('voisine');
  const r = [voisine.x - voisine.w / 2, voisine.y - voisine.h / 2, voisine.x + voisine.w / 2, voisine.y + voisine.h / 2];
  assert.ok(!(boucle.boite[0] < r[2] && r[0] < boucle.boite[2] && boucle.boite[1] < r[3] && r[1] < boucle.boite[3]), 'sur la voisine');
  assert.ok(!segmentCoupe(traits[0].bord.slice(0, 2), traits[0].bord.slice(2), boucle.boite), 'sur son trait');
  assert.match(boucle.chemin, /^M [\d. -]+ C /);
});

// Contenu réel de la base : chaque relation entre deux magies est mutuelle et a le même gagnant (A efficace contre B ⇔ A résiste à B), ce qui
// permet un seul trait par paire ; aucun bout ne porte à la fois une épée et un bouclier (ce serait contradictoire).
test('base : un trait par paire, épée d’un côté et bouclier de l’autre, sauf les paires mutuelles', () => {
  const { magies } = chargerMagies(ouvrirBase());
  const liste = [...magies.values()];
  const { liaisons, boucles } = liaisonsEntreMagies(liste);
  assert.ok(liaisons.length > 0 && boucles.length > 0);
  for (const { a, b, pointes } of liaisons) {
    for (const id of [a, b]) assert.ok(pointes[id].length <= 1, `${id} (paire ${a} – ${b}) : épée et bouclier au même bout`);
    const formes = [...pointes[a], ...pointes[b]].sort().join(',');
    assert.ok(['bouclier,epee', 'epee,epee', 'bouclier,bouclier'].includes(formes), `${a} – ${b} : ${formes}`);
  }
  // les trois paires mutuelles de la base
  const nom = (id) => magies.get(id).nom;
  const mutuelles = liaisons.filter(({ a, b, pointes }) => pointes[a][0] === pointes[b][0]).map(({ a, b }) => [nom(a), nom(b)].sort().join(' – ')).sort();
  assert.deepEqual(mutuelles, ['Arcane – Corruption', 'Espace/Temps – Vide', 'Lumière – Ombre']);
  for (const boucle of boucles) assert.deepEqual(boucle.pointes, ['bouclier'], nom(boucle.id));
});

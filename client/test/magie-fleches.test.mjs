// Relations de la carte des magies (lib/magie-fleches.mjs, demande du propriétaire) : épée au bout B d'un trait A – B quand A est efficace contre B,
// bouclier quand B résiste à A, boucle à bouclier quand une magie résiste à elle-même ; géométrie (pointes, traits, boucles). Cas limites, puis la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { bord, geometrieDesLiaisons, liaisonsEntreMagies, POINTES, segmentCoupe } from '../src/lib/magie-fleches.mjs';

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

test('géométrie : deux pointes d’une même pastille ne se touchent pas', () => {
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

// Distance d'un point à une pastille en pilule (extrémités en demi-cercles de rayon h / 2, comme border-radius: var(--radius-pill)).
const horsPilule = ([px, py], { x, y, w, h }) => Math.hypot(Math.max(0, Math.abs(px - x) - (w / 2 - h / 2)), py - y) - h / 2;

test('géométrie : le bord est celui de la pilule, pas du rectangle (arrivée par une extrémité ou près d’un coin)', () => {
  const p = pastille(500, 200);
  // de face par la droite : comme le rectangle
  assert.deepEqual(bord(p, [1, 0], 3), { point: [578, 200], cote: 1 });
  // par le haut, sur la partie droite : comme le rectangle
  const haut = bord(p, [0, -1], 3);
  assert.deepEqual(haut, { point: [500, 173], cote: 0 });
  // près du coin haut gauche : à 3 de la pilule le long de la demi-droite (le rectangle laissait un vide de plusieurs unités)
  const u = [-0.95, -Math.sqrt(1 - 0.95 ** 2)];
  const coin = bord(p, u, 3);
  assert.equal(coin.cote, -1);
  const surLaPilule = [coin.point[0] - u[0] * 3, coin.point[1] - u[1] * 3];
  assert.ok(Math.abs(horsPilule(surLaPilule, p)) < 1e-9);
  // d'une origine décalée vers le bas, horizontalement : sur le demi-cercle de droite
  const decale = bord(p, [1, 0], 3, [500, 210]);
  assert.equal(decale.cote, 1);
  assert.ok(Math.abs(horsPilule([decale.point[0] - 3, 210], p)) < 1e-9);
});

test('géométrie : deux pointes qui sortent par la même extrémité glissent le long d’elle et restent contre la pastille (Feu, vers Terre et vers Eau)', () => {
  // disposition de la carte de /magies/ : Feu vulnérable à Eau (épée chez Feu, trait horizontal), Feu résiste à Terre (bouclier, trait presque parallèle) ;
  // ces deux pointes étaient repoussées de 30 unités le long de leur trait, loin de la pastille
  const pastilles = new Map([
    ['feu', pastille(145, 160, 134)], ['terre', pastille(385, 120, 134)], ['eau', pastille(855, 160, 134)], ['sang', pastille(615, 120)],
  ]);
  const relations = {
    liaisons: [
      { a: 'feu', b: 'eau', pointes: { feu: ['epee'], eau: ['bouclier'] } },
      { a: 'feu', b: 'terre', pointes: { feu: ['bouclier'], terre: ['epee'] } },
      { a: 'sang', b: 'eau', pointes: { sang: ['bouclier'], eau: ['epee'] } },
    ],
    boucles: [],
  };
  const { traits } = geometrieDesLiaisons(relations, pastilles, { hauteur: 440 });
  for (const trait of traits) {
    for (const pointe of trait.pointes) {
      const [x, y] = translation(pointe.transform);
      const p = pastilles.get(pointe.id);
      // l'épée : sa pointe à 3 de la pilule ; le bouclier : son centre à 3 + POINTES.bouclier.centre le long d'un trait presque horizontal
      const attendu = pointe.forme === 'epee' ? 3 : 3 + POINTES.bouclier.centre;
      assert.ok(horsPilule([x, y], p) <= attendu + 0.5, `${pointe.id} : ${pointe.forme} à ${horsPilule([x, y], p).toFixed(1)} de sa pastille`);
    }
  }
  // et elles ne se touchent pas : l'une au-dessus de l'autre
  const feu = traits.filter((t) => t.a === 'feu').map((t) => t.encombrement[0]);
  assert.ok(Math.hypot(feu[0].centre[0] - feu[1].centre[0], feu[0].centre[1] - feu[1].centre[1]) >= feu[0].rayon + feu[1].rayon);
  const [eau, terre] = feu;
  assert.ok(terre.centre[1] < eau.centre[1], 'le trait vers Terre (plus haut) part au-dessus de celui vers Eau');
  // le trait Feu – Eau reste horizontal (même glissement aux deux bouts, par symétrie avec Sang)
  const feuEau = traits.find((t) => t.b === 'eau' && t.a === 'feu');
  assert.equal(feuEau.y1, feuEau.y2);
});

// Trois ou quatre pointes par la même extrémité (traits presque parallèles) : elles n'ont pas la place de glisser toutes le long de l'extrémité ;
// celles qui se touchent encore sont échelonnées le long de leur trait, sans jamais se toucher (relecture : avec trois pointes, celle du milieu
// restait superposée aux autres).
for (const cibles of [{ a: 180, b: 200, c: 220 }, { a: 150, b: 190, c: 210, d: 250 }]) {
  const ids = Object.keys(cibles);
  test(`géométrie : ${ids.length} pointes par la même extrémité ne se touchent pas`, () => {
    const pastilles = new Map([['v', pastille(100, 200)], ...ids.map((k) => [k, pastille(600, cibles[k])])]);
    const relations = { liaisons: ids.map((k) => ({ a: 'v', b: k, pointes: { v: ['bouclier'], [k]: ['epee'] } })), boucles: [] };
    const { traits } = geometrieDesLiaisons(relations, pastilles, { hauteur: 440 });
    const chezV = traits.map((t) => t.encombrement[0]);
    for (const [i, e] of chezV.entries()) {
      for (const f of chezV.slice(i + 1)) {
        const d = Math.hypot(e.centre[0] - f.centre[0], e.centre[1] - f.centre[1]);
        assert.ok(d >= e.rayon + f.rayon, `pointes à ${d.toFixed(1)} l’une de l’autre`);
      }
    }
    // au moins deux restent contre la pastille (les extérieures, qui ont glissé)
    const contre = traits.filter((t) => horsPilule(translation(t.pointes.find((p) => p.id === 'v').transform), pastilles.get('v')) <= 3 + POINTES.bouclier.centre + 0.5);
    assert.ok(contre.length >= 2);
  });
}

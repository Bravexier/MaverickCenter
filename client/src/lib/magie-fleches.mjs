// Relations de la carte des magies (/magies/, components/magie/MagiesConstellation.astro), d'après les relations de la base (magie_resistance) :
//   - une ÉPÉE au bout B d'un trait A – B : A est efficace contre B (la « Vulnérabilité magique » de B cite A) ;
//   - un BOUCLIER au bout B : B résiste à A (la « Résistance magique » de B cite A) ; une magie qui résiste à elle-même a une boucle terminée par un bouclier.
// Les deux sens d'une paire sont sur le même trait (dans la base, quand A est efficace contre B, A résiste aussi à B : épée chez B, bouclier chez A).
// Fonctions pures (aucune dépendance Astro) : les liaisons, puis la géométrie (traits, boucles, pointes) dans les unités de la carte.

/**
 * Formes des pointes. L'épée suit le trait : dessinée pointe à l'origine vers +x (le trait arrive par -x). Le bouclier reste droit (écu : haut plat,
 * flancs droits puis arrondis jusqu'à la pointe, arête au milieu), centré à `centre` de la pastille. `recul` : longueur couverte, où le trait s'arrête.
 */
export const POINTES = {
  epee: { recul: 27, dessin: 'M 0 0 L -6.5 -3 H -17 V 3 H -6.5 Z M -17 -7 H -20.5 V 7 H -17 Z M -20.5 -1.6 H -24.5 V 1.6 H -20.5 Z M -24.5 0 a 2.3 2.3 0 1 0 -4.6 0 a 2.3 2.3 0 1 0 4.6 0 Z' },
  bouclier: { recul: 21, centre: 11, droit: true, dessin: 'M -9 -10 Q 0 -8 9 -10 V 1 Q 8.5 7.5 0 11 Q -8.5 7.5 -9 1 Z', arete: 'M 0 -7.5 V 8.5' },
};
// Encombrement d'une pointe, pour que deux pointes d'une même pastille ne se touchent pas : un disque de rayon `rayon`, à `milieu` du bout, le long du trait.
export const ENCOMBREMENT = { epee: { milieu: 15, rayon: 8 }, bouclier: { milieu: 11, rayon: 11 } };

/**
 * @param {{ id: string, resistances: { resistance: { magies: { id: string }[] }, vulnerabilite: { magies: { id: string }[] } } }[]} magies
 * @returns {{ liaisons: { a: string, b: string, pointes: Record<string, ('epee' | 'bouclier')[]> }[], boucles: { id: string, pointes: ('epee' | 'bouclier')[] }[] }}
 *   un trait par paire de magies liées (dans l'ordre des magies), avec les pointes de chaque bout ; une boucle par magie qui se cite elle-même
 */
export function liaisonsEntreMagies(magies) {
  const ordre = new Map(magies.map((m, i) => [m.id, i]));
  const liaisons = new Map();
  const boucles = new Map();
  const ajouter = (cible, autre, forme) => {
    if (!ordre.has(autre)) return;
    if (cible === autre) {
      const pointes = boucles.get(cible) ?? [];
      if (!pointes.includes(forme)) pointes.push(forme);
      boucles.set(cible, pointes);
      return;
    }
    const [a, b] = ordre.get(cible) < ordre.get(autre) ? [cible, autre] : [autre, cible];
    const cle = `${a}|${b}`;
    const liaison = liaisons.get(cle) ?? { a, b, pointes: { [a]: [], [b]: [] } };
    if (!liaison.pointes[cible].includes(forme)) liaison.pointes[cible].push(forme);
    liaisons.set(cle, liaison);
  };
  for (const cible of magies) {
    for (const { id } of cible.resistances.vulnerabilite.magies) ajouter(cible.id, id, 'epee');
    for (const { id } of cible.resistances.resistance.magies) ajouter(cible.id, id, 'bouclier');
  }
  const rang = (l) => [ordre.get(l.a), ordre.get(l.b)];
  return {
    liaisons: [...liaisons.values()].sort((x, y) => rang(x)[0] - rang(y)[0] || rang(x)[1] - rang(y)[1]),
    boucles: [...boucles.entries()].sort(([x], [y]) => ordre.get(x) - ordre.get(y)).map(([id, pointes]) => ({ id, pointes })),
  };
}

const arrondi = (n) => Math.round(n * 10) / 10;
const point = ([x, y]) => `${arrondi(x)} ${arrondi(y)}`;
const unitaire = (dx, dy) => {
  const n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
};

/**
 * Point où la demi-droite partant de `origine` (dans la pastille) dans la direction (ux, uy) sort de la pastille, écarté de `marge` le long de la
 * demi-droite. La pastille est une pilule (w × h, extrémités en demi-cercles de rayon h / 2, comme `border-radius: var(--radius-pill)`), pas un rectangle :
 * un trait qui arrive par une extrémité ou près d'un coin s'arrête à `marge` du dessin, pas du rectangle qui l'entoure.
 * `cote` : -1 ou 1 quand la demi-droite sort par l'extrémité gauche ou droite, 0 par le haut ou le bas.
 * Suppose une pastille plus large que haute (w ≥ h, extrémités à gauche et à droite) : c'est le cas de toutes celles de la carte.
 */
export function bord(p, [ux, uy], marge, origine = [p.x, p.y]) {
  const r = Math.min(p.h, p.w) / 2;
  const droit = p.w / 2 - r; // demi-longueur de la partie droite
  const [ox, oy] = origine;
  if (uy) {
    const t = (p.y + Math.sign(uy) * r - oy) / uy;
    const x = ox + ux * t;
    if (Math.abs(x - p.x) <= droit) return { point: [x + ux * marge, oy + uy * (t + marge)], cote: 0 };
  }
  const cote = Math.sign(ux) || 1;
  const dx = ox - (p.x + cote * droit);
  const dy = oy - p.y;
  const b = dx * ux + dy * uy;
  const t = -b + Math.sqrt(Math.max(0, b * b - (dx * dx + dy * dy - r * r))) + marge;
  return { point: [ox + ux * t, oy + uy * t], cote };
}

/** Pointe `forme` posée en `bout`, le trait arrivant selon (ux, uy) (vers la pastille) : attribut transform du dessin de POINTES. */
function pose(forme, bout, [ux, uy]) {
  const { droit, centre = 0 } = POINTES[forme];
  if (droit) return `translate(${point([bout[0] - ux * centre, bout[1] - uy * centre])})`;
  return `translate(${point(bout)}) rotate(${arrondi((Math.atan2(uy, ux) * 180) / Math.PI)})`;
}

/** Le segment [p, q] coupe-t-il le rectangle [x0, x1] × [y0, y1] ? (Liang–Barsky) */
export function segmentCoupe(p, q, [x0, y0, x1, y1]) {
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]]) {
    if (pp === 0) {
      if (qq < 0) return false;
    } else {
      const r = qq / pp;
      if (pp < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

const chevauche = (r, s) => r[0] < s[2] && s[0] < r[2] && r[1] < s[3] && s[1] < r[3];
const boite = (p, m = 0) => [p.x - p.w / 2 - m, p.y - p.h / 2 - m, p.x + p.w / 2 + m, p.y + p.h / 2 + m];

/**
 * Boucles possibles autour d'une pastille : au-dessus ou au-dessous d'une extrémité, ou à côté d'une extrémité. Chaque candidate : départ et arrivée
 * sur le bord, deux points de contrôle (courbe de Bézier cubique), direction d'arrivée (vers la pastille) et boîte englobante.
 */
function bouclesPossibles(p) {
  const r = p.h / 2;
  const candidates = [];
  for (const cote of [1, -1]) {
    const centre = p.x + cote * (p.w / 2 - r); // centre du demi-cercle de l'extrémité
    for (const sens of [-1, 1]) {
      // au-dessus (sens -1) ou au-dessous (sens 1) de l'extrémité
      const y = p.y + sens * (r + 1);
      const depart = [centre - cote * 20, y];
      const arrivee = [centre + cote * 4, y];
      candidates.push({ depart, arrivee, c1: [depart[0] - cote * 8, y + sens * 30], c2: [arrivee[0] + cote * 8, y + sens * 30], direction: unitaire(-cote * 8, -sens * 30) });
    }
    // à côté de l'extrémité
    const haut = [centre + cote * r * Math.SQRT1_2, p.y - r * Math.SQRT1_2 - 1];
    const bas = [centre + cote * r * Math.SQRT1_2, p.y + r * Math.SQRT1_2 + 1];
    candidates.push({ depart: haut, arrivee: bas, c1: [haut[0] + cote * 34, haut[1] - 14], c2: [bas[0] + cote * 34, bas[1] + 14], direction: unitaire(-cote * 34, -14) });
  }
  return candidates.map((c) => {
    const xs = [c.depart[0], c.arrivee[0], c.c1[0], c.c2[0]];
    const ys = [c.depart[1], c.arrivee[1], c.c1[1], c.c2[1]];
    // la courbe reste dans l'enveloppe de ses points de contrôle ; marge pour la pointe
    return { ...c, boite: [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4] };
  });
}

/**
 * Géométrie des liaisons dans les unités de la carte (largeur 1000 × hauteur).
 * @param {ReturnType<typeof liaisonsEntreMagies>} relations
 * @param {Map<string, { x: number, y: number, w: number, h: number }>} pastilles centre et taille de chaque pastille, par id de magie
 * @param {{ hauteur: number, marge?: number }} options marge : écart entre une pointe et sa pastille
 * @returns {{ traits: { a: string, b: string, x1: number, y1: number, x2: number, y2: number, bord: number[], pointes: { id: string, forme: string, transform: string }[],
 *     encombrement: { centre: number[], rayon: number }[] }[],
 *   boucles: { id: string, chemin: string, boite: number[], pointes: { id: string, forme: string, transform: string }[] }[] }}
 */
export function geometrieDesLiaisons({ liaisons, boucles }, pastilles, { hauteur, marge = 3 }) {
  // chaque bout : sur le bord de sa pastille, sur le trait qui joint les origines des deux bouts (au départ, les centres des pastilles). Quand deux
  // pointes d'une même pastille se toucheraient (traits presque parallèles) :
  //   - si elles sortent par la même extrémité (gauche ou droite), on écarte leurs origines verticalement (`decalage`, borné) : les pointes glissent
  //     le long de l'extrémité et restent à `marge` de la pastille (sinon, une extrémité n'ayant que h de haut, on les repoussait loin de la pastille) ;
  //   - ensuite, celles qui se touchent encore (extrémités différentes, ou plus de place pour glisser) : `ecart` éloigne la pointe le long de son trait.
  const bouts = [];
  const liees = liaisons.flatMap((liaison) => {
    const a = pastilles.get(liaison.a);
    const b = pastilles.get(liaison.b);
    if (!a || !b) return [];
    const deA = { id: liaison.a, p: a, formes: liaison.pointes[liaison.a] ?? [], ecart: 0, decalage: 0 };
    const deB = { id: liaison.b, p: b, formes: liaison.pointes[liaison.b] ?? [], ecart: 0, decalage: 0 };
    deA.autre = deB;
    deB.autre = deA;
    bouts.push(deA, deB);
    return [{ liaison, deA, deB }];
  });
  const origine = (bout) => [bout.p.x, bout.p.y + bout.decalage];
  const placer = (bout) => {
    const o = origine(bout);
    const q = origine(bout.autre);
    bout.dehors = unitaire(q[0] - o[0], q[1] - o[1]);
    const { point, cote } = bord(bout.p, bout.dehors, marge, o);
    bout.bord = point;
    bout.cote = cote;
  };
  const placerTout = () => bouts.forEach(placer);
  placerTout();
  // décalage vertical maximal d'une origine : la moitié du rayon de l'extrémité
  const decalageMax = (bout) => Math.min(bout.p.h, bout.p.w) / 4;
  const encombrement = (bout) =>
    bout.formes.map((f) => {
      const { milieu, rayon } = ENCOMBREMENT[f];
      const d = bout.ecart + milieu;
      return { centre: [bout.bord[0] + bout.dehors[0] * d, bout.bord[1] + bout.dehors[1] * d], rayon };
    });
  const seTouchent = (x, y) =>
    encombrement(x).some((e) => encombrement(y).some((f) => Math.hypot(e.centre[0] - f.centre[0], e.centre[1] - f.centre[1]) < e.rayon + f.rayon + 1));
  // 1. glissement le long d'une extrémité commune, jusqu'à ce qu'aucun décalage ne change sur un tour (bilan net : avec trois pointes ou plus, celle du
  //    milieu est poussée vers le haut par une paire et vers le bas par l'autre)
  for (let tour = 0; tour < 60; tour++) {
    const avant = bouts.map((bout) => bout.decalage);
    for (const [i, x] of bouts.entries()) {
      for (const y of bouts.slice(i + 1)) {
        if (x.id !== y.id || !x.cote || x.cote !== y.cote || !seTouchent(x, y)) continue;
        // le plus haut monte, l'autre descend (à égalité, celui qui part le plus vers le haut)
        const [haut, bas] = x.bord[1] < y.bord[1] || (x.bord[1] === y.bord[1] && x.dehors[1] <= y.dehors[1]) ? [x, y] : [y, x];
        haut.decalage = Math.max(-decalageMax(haut), haut.decalage - 1);
        bas.decalage = Math.min(decalageMax(bas), bas.decalage + 1);
      }
    }
    if (bouts.every((bout, i) => bout.decalage === avant[i])) break;
    placerTout();
  }
  // 2. les pointes qui se touchent encore (extrémités différentes, ou plus de place pour glisser) : on éloigne le long de son trait le bout déjà le
  //    plus éloigné (le second à égalité), pour qu'il passe devant l'autre ; les éloigner ensemble ne les séparerait pas, les traits étant presque
  //    parallèles
  for (let tour = 0; tour < 40; tour++) {
    let bouge = false;
    for (const [i, x] of bouts.entries()) {
      for (const y of bouts.slice(i + 1)) {
        if (x.id !== y.id || !seTouchent(x, y)) continue;
        (x.ecart > y.ecart ? x : y).ecart += 3;
        bouge = true;
      }
    }
    if (!bouge) break;
  }
  const traits = liees.map(({ liaison, deA, deB }) => {
    const pointes = [];
    const extremites = [deA, deB].map((bout) => {
      const tete = [bout.bord[0] + bout.dehors[0] * bout.ecart, bout.bord[1] + bout.dehors[1] * bout.ecart];
      const direction = [-bout.dehors[0], -bout.dehors[1]];
      for (const forme of bout.formes) pointes.push({ id: bout.id, forme, transform: pose(forme, tete, direction) });
      // le trait s'arrête derrière la plus longue pointe
      const recul = Math.max(0, ...bout.formes.map((f) => POINTES[f].recul - 1));
      return [tete[0] + bout.dehors[0] * recul, tete[1] + bout.dehors[1] * recul];
    });
    // `bord` : le trait entier, d'un bord à l'autre (pour placer les boucles)
    return {
      a: liaison.a, b: liaison.b,
      x1: arrondi(extremites[0][0]), y1: arrondi(extremites[0][1]), x2: arrondi(extremites[1][0]), y2: arrondi(extremites[1][1]),
      bord: [...deA.bord, ...deB.bord].map(arrondi),
      pointes,
      encombrement: [...encombrement(deA), ...encombrement(deB)],
    };
  });
  const boites = [...pastilles.entries()].map(([id, p]) => [id, boite(p, 4)]);
  const resultat = boucles.flatMap(({ id, pointes }) => {
    const p = pastilles.get(id);
    if (!p) return [];
    const siens = traits.filter((t) => t.a === id || t.b === id);
    // la première candidate libre : ni sur une autre pastille, ni sur un trait ou une pointe de la même magie, ni hors de la carte
    const score = (c) =>
      10 * boites.filter(([autre, r]) => autre !== id && chevauche(c.boite, r)).length +
      3 * siens.filter((t) => segmentCoupe([t.bord[0], t.bord[1]], [t.bord[2], t.bord[3]], c.boite)).length +
      3 * siens.flatMap((t) => t.encombrement).filter(({ centre: [x, y], rayon }) => chevauche(c.boite, [x - rayon, y - rayon, x + rayon, y + rayon])).length +
      5 * Number(c.boite[0] < 0 || c.boite[2] > 1000 || c.boite[1] < -24 || c.boite[3] > hauteur + 40);
    const choix = bouclesPossibles(p).reduce((meilleure, c) => (score(c) < score(meilleure) ? c : meilleure));
    const recul = Math.max(...pointes.map((f) => POINTES[f].recul)) * 0.6;
    const fin = [choix.arrivee[0] - choix.direction[0] * recul, choix.arrivee[1] - choix.direction[1] * recul];
    return [{
      id,
      chemin: `M ${point(choix.depart)} C ${point(choix.c1)} ${point(choix.c2)} ${point(fin)}`,
      boite: choix.boite.map(arrondi),
      pointes: pointes.map((forme) => ({ id, forme, transform: pose(forme, choix.arrivee, choix.direction) })),
    }];
  });
  return { traits, boucles: resultat };
}

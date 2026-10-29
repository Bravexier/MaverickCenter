// Pages de magie CONSTRUITES (client/dist/magies/*/index.html) : câblage des infobulles et des fiches de créatures, éléments retirés à la demande du propriétaire.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/magies-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerInvocations } from '../src/lib/bestiaire-db.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { classeDeMagie, cssDeLaPalette } from '../src/lib/palette-css.mjs';
import { ENCOMBREMENT, liaisonsEntreMagies, POINTES, segmentCoupe } from '../src/lib/magie-fleches.mjs';
import { tuilesDeCapacites } from './aide-bestiaire.mjs';

const dossier = fileURLToPath(new URL('../dist/magies/', import.meta.url));
const present = existsSync(dossier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const indexMagies = present ? readFileSync(join(dossier, 'index.html'), 'utf8') : '';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
// pages rendues par le gabarit (la magie d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="magie-hero"'))
  : [];
// pages qui ont leurs propres sorts ; le Potentiel Illimité n'en a pas, il montre ceux des autres magies (tests plus bas)
const avecSorts = pages.filter((p) => p.html.includes('<h2 id="sorts-titre">Sorts <span'));
const potentiel = pages.find((p) => p.slug === 'potentiel-illimite')?.html ?? '';

/** Contenu (HTML) de l'élément ouvrant en `debut` (index du « < »), jusqu'à sa fermeture : comptage des balises du même nom. */
function contenu(html, debut, nom) {
  const re = new RegExp(`<(/?)${nom}\\b[^>]*>`, 'g');
  re.lastIndex = debut;
  let profondeur = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) return html.slice(debut, m.index + m[0].length);
  }
  return html.slice(debut);
}
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

test('15 pages de magie construites, 14 avec une table de sorts', options, () => {
  assert.equal(pages.length, 15);
  assert.equal(avecSorts.length, 14);
});

test('index des magies : 15 noms courts, sans infobulle (demande du propriétaire), version au footer', options, () => {
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__noeud"/g)].length, 15);
  const nomsVisibles = [...indexMagies.matchAll(/<span class="magies-orbite__nom"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(nomsVisibles, ['Potentiel Illimité', 'Arcane', 'Corruption', 'Espace-Temps', 'Vide', 'Nécromancie', 'Sang', 'Lumière', 'Ombre', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre']);
  assert.ok(!indexMagies.includes('magies-orbite__description'));
  // plus d'infobulle sur la carte : le survol ne montre que les relations
  assert.ok(!indexMagies.includes('data-tooltip'));
  assert.ok(!/magies-orbite__noeud[^{]*::after/.test(indexMagies));
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__lien /g)].length, 4);
  assert.ok(indexMagies.includes(`<span class="site-footer__version">V${version}</span>`), 'pied de page : l\'étiquette de version (tools/flux-git)');
  assert.ok(!indexMagies.includes('Écoles, sorts et règles de magie.'));
});

// Carte des magies dense (demande du propriétaire : la page était « trop aérée ») : la carte du grand écran est large et basse, et aucune pastille n'en
// touche une autre, ni sur grand écran ni sur écran étroit (téléphone de 320px à 60rem). Grand écran : largeur et hauteur de chaque pastille en cqw
// (--l, --h, posées par MagiesConstellation.astro depuis TAILLES), donc proportionnelles à la carte ; sous 60rem, styles/magie/orbit.css
// (9rem, 8rem pour l'hexagone élémentaire, 12rem pour le Potentiel Illimité, plafonnées en cqw), hauteur 2.9rem.
test('carte des magies : compacte, et aucune pastille ne touche une autre', options, () => {
  const ratio = Number(indexMagies.match(/\.magies-orbite \{[^}]*aspect-ratio: 1000 \/ (\d+);/)?.[1]);
  const hauteurEtroite = Number(indexMagies.match(/\.magies-orbite \{ height: ([\d.]+)rem; aspect-ratio: auto; \}/)?.[1]);
  assert.ok(ratio > 0 && ratio <= 450, `carte du grand écran plus large que haute (1000 / ${ratio})`);
  assert.ok(hauteurEtroite > 0 && hauteurEtroite <= 40, `carte étroite de ${hauteurEtroite}rem`);
  const noeuds = [...indexMagies.matchAll(/class="magies-orbite__position magies-orbite__position--([\w-]+) couleur-magie-[\w-]+" data-magie="[^"]*" style="([^"]+)"[^]*?aria-label="([^"]+)"/g)].map(([, region, style, nom]) => {
    const v = (axe) => Number(style.match(new RegExp(`--${axe}: ([\\d.]+)%`))[1]) / 100;
    const cqw = (axe) => Number(style.match(new RegExp(`--${axe}: ([\\d.]+)cqw`))?.[1]) / 100;
    return { region, nom, x: v('x'), y: v('y'), mx: v('mx'), my: v('my'), l: cqw('l'), h: cqw('h') };
  });
  assert.equal(noeuds.length, 15);
  const ecart = (a, b) => Math.max(Math.abs(a.cx - b.cx) - (a.l + b.l) / 2, Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);
  // seuil : 0.25rem entre deux pastilles ; en unités de la carte sur grand écran (une carte de 62rem, la plus large : 1000 / 62 unités par rem)
  const verifier = (boites, ecran, seuil) => {
    for (const [i, a] of boites.entries()) {
      assert.ok(a.cx - a.l / 2 >= 0 && a.cx + a.l / 2 <= a.largeur + 1e-9, `${ecran} : pastille hors de la carte (${a.nom})`);
      for (const b of boites.slice(i + 1)) assert.ok(ecart(a, b) >= seuil, `${ecran} : pastilles qui se touchent (${a.nom} / ${b.nom} : ${ecart(a, b).toFixed(2)} < ${seuil.toFixed(2)})`);
    }
  };
  // grand écran : tout est proportionnel à la carte, une largeur suffit (unités de la carte, 1000 de large)
  assert.ok(noeuds.every((n) => n.l > 0 && n.h > 0), 'grand écran : --l et --h en cqw sur chaque pastille');
  verifier(noeuds.map((n) => ({ ...n, largeur: 1000, cx: n.x * 1000, cy: (n.y * 1000 * ratio) / 1000, l: n.l * 1000, h: n.h * 1000 })), 'grand écran', (0.25 * 1000) / 62);
  for (const vue of [20, 22.5, 24.375, 30, 45, 59.9]) {
    const largeur = Math.min(vue, 64) - 2;
    const l = { potentiel: Math.min(12, 0.8 * largeur), elementaire: Math.min(8, 0.36 * largeur) };
    verifier(noeuds.map((n) => ({ ...n, largeur, cx: n.mx * largeur, cy: n.my * hauteurEtroite, l: l[n.region] ?? Math.min(9, 0.46 * largeur), h: 2.9 })), `écran étroit de ${vue}rem`, 0.25);
  }
});

// Relations de la carte (lib/magie-fleches.mjs, demandes du propriétaire) : cachées, affichées au survol d'une magie (les siennes seulement), une épée
// ou un bouclier au bout des traits ; la disposition du grand écran est telle qu'aucun trait ni aucune boucle ne passe sous une autre pastille (tailles
// des pastilles en cqw, --l et --h : la géométrie est la même à toute largeur de carte), et chaque pointe arrive près de sa pastille (forme de pilule),
// y compris par une extrémité (gauche ou droite). Sous 60rem : rien.
test('carte des magies : une relation par paire liée dans la base, au survol seulement, et aucun trait sous une autre pastille', options, () => {
  const { magies } = chargerMagies(ouvrirBase());
  const { liaisons, boucles } = liaisonsEntreMagies([...magies.values()]);
  // un trait porte la classe de sa première magie et la classe de second rang de la seconde (lib/palette-css.mjs) : sa couleur, sans couleur écrite
  const traits = [...indexMagies.matchAll(/<g class="magies-relation avec-([\w-]+) avec-([\w-]+) couleur-magie-\1 couleur-2-magie-\2 seconde-\2"[^>]*><line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)]
    .map(([, a, b, ...xy]) => ({ a, b, p: xy.slice(0, 2).map(Number), q: xy.slice(2).map(Number) }));
  const lacets = [...indexMagies.matchAll(/<g class="magies-relation magies-relation--boucle avec-([\w-]+) couleur-magie-\1"[^>]*><path class="magies-relation__boucle" d="M ([^"]+)"/g)]
    .map(([, k, d]) => {
      const n = d.replace('C', '').trim().split(/\s+/).map(Number);
      const xs = n.filter((_, i) => i % 2 === 0);
      const ys = n.filter((_, i) => i % 2 === 1);
      return { k, boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
  assert.equal(traits.length, liaisons.length);
  assert.equal(lacets.length, boucles.length);
  assert.equal([...indexMagies.matchAll(/class="magies-relation__epee"/g)].length, liaisons.reduce((n, l) => n + l.pointes[l.a].filter((f) => f === 'epee').length + l.pointes[l.b].filter((f) => f === 'epee').length, 0));
  // cachées au repos, une règle de survol par magie de la carte ; rien sur écran étroit
  assert.match(indexMagies, /\.magies-relation \{ --trait: [^}]*opacity: 0;/);
  const cles = [...indexMagies.matchAll(/data-magie="([\w-]+)" style=/g)].map((m) => m[1]);
  assert.equal(cles.length, 15);
  // survol, ou focus au clavier seulement : avec :focus-within, un clic (qui donne le focus au lien) laissait les relations affichées au retour arrière
  for (const k of cles) {
    // la couleur de la magie survolée : --couleur (première magie du trait) ou --couleur-2 (la seconde), jamais une couleur écrite
    const survol = `.magies-orbite:has([data-magie="${k}"]:hover, [data-magie="${k}"] a:focus-visible)`;
    assert.ok(indexMagies.includes(`${survol} .magies-relation.avec-${k} { --c: var(--couleur); --part: `), k);
    assert.ok(indexMagies.includes(`${survol} .magies-relation.avec-${k} {`) && indexMagies.indexOf(`${survol} .magies-relation.seconde-${k} { --c: var(--couleur-2); }`)
      > indexMagies.indexOf(`${survol} .magies-relation.avec-${k} {`), `${k} : la règle du second rang après la première`);
  }
  const surbrillance = indexMagies.slice(indexMagies.indexOf('.magies-orbite:has('), indexMagies.lastIndexOf('opacity: 1; }'));
  assert.doesNotMatch(surbrillance, /#[0-9a-f]{3,6}\b/i, 'aucune couleur écrite dans les règles du survol');
  assert.ok(!indexMagies.includes(':focus-within)) .magies-relation'), 'plus de :focus-within pour les relations');
  assert.match(indexMagies.slice(indexMagies.indexOf('@media (max-width: 60rem)')), /\.magies-orbite__relations, \.magies-legende \{ display: none; \}/);
  // géométrie
  const hauteur = Number(indexMagies.match(/class="magies-orbite__relations" viewBox="0 0 1000 (\d+)"/)?.[1]);
  assert.equal(hauteur, Number(indexMagies.match(/\.magies-orbite \{[^}]*aspect-ratio: 1000 \/ (\d+);/)?.[1]), 'SVG aux proportions de la carte');
  // centre et taille de chaque pastille en unités de la carte (1 unité = 0.1cqw)
  const centres = new Map([...indexMagies.matchAll(/class="magies-orbite__position magies-orbite__position--([\w-]+) couleur-magie-[\w-]+" data-magie="([\w-]+)" style="([^"]+)"/g)].map(([, region, k, style]) => {
    const v = (nom) => Number(style.match(new RegExp(`--${nom}: ([\\d.]+)%`))[1]) / 100;
    const cqw = (nom) => Number(style.match(new RegExp(`--${nom}: ([\\d.]+)cqw`))[1]) * 10;
    return [k, { region, x: v('x') * 1000, y: v('y') * hauteur, w: cqw('l'), h: cqw('h') }];
  }));
  const boite = ({ x, y, w, h }, marge = 0) => [x - w / 2 - marge, y - h / 2 - marge, x + w / 2 + marge, y + h / 2 + marge];
  for (const { a, b, p, q } of traits) {
    for (const [k, c] of centres) if (k !== a && k !== b) assert.ok(!segmentCoupe(p, q, boite(c, 4)), `le trait ${a} – ${b} passe sous ${k}`);
  }
  for (const { k, boite: l } of lacets) {
    for (const [autre, c] of centres) {
      if (autre === k) continue;
      const r = boite(c);
      assert.ok(!(l[0] < r[2] && r[0] < l[2] && l[1] < r[3] && r[1] < l[3]), `la boucle de ${k} touche ${autre}`);
    }
  }
  // Pointes, chacune rattachée à la pastille de son trait (classes avec-… de son groupe ; pour un trait, celle des deux qui est la plus proche).
  // `tete` : où la pointe touche le trait du côté de la pastille ; `dehors` : direction du trait, de la pastille vers l'extérieur.
  const pilule = ([px, py], { x, y, w, h }) => Math.hypot(Math.max(0, Math.abs(px - x) - (w / 2 - h / 2)), py - y) - h / 2;
  const svg = indexMagies.slice(indexMagies.indexOf('class="magies-orbite__relations"'), indexMagies.indexOf('class="magies-orbite__liste"'));
  const pointes = svg.split('<g class="magies-relation ').slice(1).flatMap((groupe) => {
    const magiesDuGroupe = [...groupe.slice(0, groupe.indexOf('"')).matchAll(/\bavec-([\w-]+)/g)].map((m) => m[1]);
    const boucle = groupe.startsWith('magies-relation--boucle');
    const ligne = groupe.match(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/)?.slice(1).map(Number);
    return [...groupe.matchAll(/<g class="magies-relation__(epee|bouclier)" transform="translate\(([-\d.]+) ([-\d.]+)\)(?: rotate\(([-\d.]+)\))?"/g)].map(([, forme, x, y, angle]) => {
      const t = [Number(x), Number(y)];
      const k = magiesDuGroupe.reduce((m, c) => (pilule(t, centres.get(c)) < pilule(t, centres.get(m)) ? c : m));
      let dehors = null;
      if (!boucle) {
        // le bout du trait le plus proche de la pointe est de son côté ; dehors : vers l'autre bout
        const [p1, p2] = [[ligne[0], ligne[1]], [ligne[2], ligne[3]]];
        const [pres, loin] = Math.hypot(p1[0] - t[0], p1[1] - t[1]) < Math.hypot(p2[0] - t[0], p2[1] - t[1]) ? [p1, p2] : [p2, p1];
        const n = Math.hypot(loin[0] - pres[0], loin[1] - pres[1]);
        dehors = forme === 'epee' ? [-Math.cos((Number(angle) * Math.PI) / 180), -Math.sin((Number(angle) * Math.PI) / 180)] : [(loin[0] - pres[0]) / n, (loin[1] - pres[1]) / n];
      }
      // épée : translate = sa pointe ; bouclier (droit) : translate = son centre, à POINTES.bouclier.centre de la tête le long du trait
      const tete = forme === 'epee' || boucle ? t : [t[0] - dehors[0] * POINTES.bouclier.centre, t[1] - dehors[1] * POINTES.bouclier.centre];
      return { k, forme, t, tete, dehors, boucle };
    });
  });
  assert.equal(pointes.filter((p) => !p.boucle).length, liaisons.reduce((n, l) => n + l.pointes[l.a].length + l.pointes[l.b].length, 0));
  // chaque pointe près de sa pastille (demande du propriétaire : des épées et boucliers loin de Feu et d'Eau, par le côté) : la tête d'une pointe de
  // trait à au plus 3 unités de la pilule (la marge, comptée le long du trait) ; le centre du bouclier d'une boucle à au plus 3 + 11
  for (const { k, forme, t, tete, boucle } of pointes) {
    const d = pilule(boucle ? t : tete, centres.get(k));
    const plafond = 3 + (boucle ? POINTES.bouclier.centre : 0) + 0.2;
    assert.ok(d > 0 && d <= plafond, `${forme} de ${k} à ${d.toFixed(1)} unités de sa pastille (au plus ${plafond})`);
  }
  // deux pointes de traits d'une même magie ne se touchent pas (encombrement de lib/magie-fleches.mjs : un disque le long du trait)
  const disque = ({ forme, tete, dehors }) => {
    const { milieu, rayon } = ENCOMBREMENT[forme];
    return { centre: [tete[0] + dehors[0] * milieu, tete[1] + dehors[1] * milieu], rayon };
  };
  const deTraits = pointes.filter((p) => !p.boucle);
  for (const [i, x] of deTraits.entries()) {
    for (const y of deTraits.slice(i + 1)) {
      if (x.k !== y.k) continue;
      const [e, f] = [disque(x), disque(y)];
      const d = Math.hypot(e.centre[0] - f.centre[0], e.centre[1] - f.centre[1]);
      assert.ok(d >= e.rayon + f.rayon, `${x.k} : deux pointes qui se touchent (${x.forme}, ${y.forme} : ${d.toFixed(1)} unités)`);
    }
  }
});

// La légende de la carte tient sur une ligne (demande du propriétaire) ; plus de bascule relations / détails.
test('carte des magies : légende sur une ligne, sans bascule', options, () => {
  assert.ok(!indexMagies.includes('magies-mode'), 'plus de bascule');
  assert.match(indexMagies, /\.magies-legende \{[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap;/);
  assert.equal([...indexMagies.matchAll(/class="magies-legende__item"/g)].length, 3);
});

test('chaque identifiant est unique dans une page ; aria-controls, aria-describedby et data-bulle désignent un élément qui existe', options, () => {
  for (const { slug, html } of pages) {
    const tous = ids(html);
    const vus = new Set();
    for (const id of tous) {
      assert.ok(!vus.has(id), `${slug} : id en double « ${id} »`);
      vus.add(id);
    }
    for (const attribut of ['aria-controls', 'aria-describedby', 'aria-labelledby', 'data-bulle']) {
      for (const m of html.matchAll(new RegExp(`\\s${attribut}="([^"]+)"`, 'g'))) {
        for (const cible of m[1].split(/\s+/)) assert.ok(vus.has(cible), `${slug} : ${attribut}="${cible}" ne mène à rien`);
      }
    }
  }
});

test('infobulles : un déclencheur par bulle, un texte de repli (title), une bulle en role="tooltip" cachée et faite d’éléments en ligne seulement', options, () => {
  let bulles = 0;
  for (const { slug, html } of pages) {
    // la carte d'une créature (bulle-creature-…) est une infobulle à part : test suivant
    const declencheurs = [...html.matchAll(/<(?:a|button)\b[^>]*\sdata-bulle="([^"]+)"[^>]*>/g)].filter((d) => !d[1].startsWith('bulle-creature-'));
    for (const [balise, id] of declencheurs) {
      assert.match(balise, /\saria-describedby="/, `${slug} : ${id} sans aria-describedby`);
      assert.match(balise, /\stitle="[^"]+"/, `${slug} : ${id} sans texte de repli (sans JavaScript)`);
      const debut = html.indexOf(`id="${id}"`);
      const ouvrante = html.lastIndexOf('<span', debut);
      const bulle = contenu(html, ouvrante, 'span');
      assert.match(html.slice(ouvrante, debut + id.length + 40), /role="tooltip"/, `${slug} : ${id} n'est pas un tooltip`);
      assert.match(html.slice(ouvrante, debut + id.length + 40), /\shidden\b/, `${slug} : ${id} doit être cachée au départ`);
      // un bloc dans un paragraphe ferme le <p> : le contenu de la bulle fuirait dans le texte
      assert.doesNotMatch(bulle, /<(?:dl|dt|dd|div|ul|ol|li|p|table|h[1-6]|blockquote)\b/, `${slug} : bloc dans la bulle ${id}`);
      bulles += 1;
    }
    assert.equal(declencheurs.length, new Set(declencheurs.map((d) => d[1])).size, `${slug} : un déclencheur par bulle`);
  }
  assert.ok(bulles > 100, `infobulles posées : ${bulles}`);
});

test('règle spéciale du NPM 5 : une seule pastille « i », dans le titre du tableau du NPM 5 juste après son texte, et plus d’encart sous le tableau', options, () => {
  for (const { slug, html } of avecSorts) {
    const infos = [...html.matchAll(/class="info"/g)].length;
    assert.equal(infos, 1, `${slug} : une pastille « i »`);
    const npm5 = html.slice(html.indexOf('id="npm-5"'));
    assert.ok(npm5.indexOf('class="info"') > 0 && npm5.indexOf('class="info"') < npm5.indexOf('class="sorts-wrap'), `${slug} : la pastille est dans le titre du tableau 5`);
    // à gauche, après le texte du titre, avant les pastilles de niveau (demande du propriétaire)
    assert.ok(npm5.indexOf('class="npm__nom"') < npm5.indexOf('class="info"') && npm5.indexOf('class="info"') < npm5.indexOf('class="npm__pips"'), `${slug} : la pastille suit le texte du titre`);
    // dans le même bloc que le texte : sur un téléphone étroit, le « i » passe à la ligne avec lui, jamais seul sous le badge
    const intitule = contenu(npm5, npm5.indexOf('<span class="npm__intitule">'), 'span');
    assert.ok(intitule.includes('class="npm__nom"') && intitule.includes('class="info"'), `${slug} : texte du titre et pastille dans le même bloc`);
    assert.ok(!html.includes('magie-regle'), `${slug} : plus d'encart de règle sous le tableau`);
  }
});

test('retirés à la demande du propriétaire : pastilles Remarque / Texte, légende, source par sort et en pied de page, créatures qui lancent le sort, « voir la page », bandeau « brouillon »', options, () => {
  for (const { slug, html } of pages) {
    for (const interdit of ['pas encore relu', 'magie-legende', 'Légende', 'Source :', 'sort-detail__source', 'Créatures qui lancent', 'Voir la page', '<h2>Sources</h2>', '<h5>Remarque</h5>', '<h5>Texte du sort</h5>', '<h5>Effets secondaires</h5>', 'title="Remarque du classeur"', 'title="Texte du sort"']) {
      assert.ok(!html.includes(interdit), `${slug} : « ${interdit} » est revenu`);
    }
  }
});

test('niveaux de maîtrise : plus de colonne « Maîtrise » ; chaque bonus du type ou d’une cellule est une pastille à côté de sa valeur', options, () => {
  let pastilles = 0;
  for (const { slug, html } of avecSorts) {
    assert.ok(!html.includes('<th scope="col">Maîtrise</th>') && !html.includes('sort__maitrise') && !html.includes('nm__champ'), `${slug} : colonne Maîtrise revenue`);
    for (const m of html.matchAll(/<span class="nm"[^>]*>([^<]*)<\/span>/g)) {
      assert.match(m[1], /NM/, `${slug} : pastille « ${m[1]} » sans NM`);
      assert.doesNotMatch(m[1], /^\(|\)$/, `${slug} : pastille « ${m[1]} » avec ses parenthèses`);
      pastilles += 1;
    }
  }
  // 72 bonus de la colonne Type + 190 des cellules Coût, Portée, Zone, D/S/B (test/maitrise-sorts.test.mjs)
  assert.equal(pastilles, 262);
  const feu = pages.find((p) => p.slug === 'magie-du-feu').html;
  const bdf = contenu(feu, feu.indexOf('<tbody class="sort" id="sort-boule-de-feu"'), 'tbody');
  assert.match(bdf, /<span class="val">2d6 dégâts<\/span> <span class="nm">\+1d6\/NM<\/span>/);
});

test('coût (décisions R105, R106) : pas de colonne « Coût secondaire » ; le coût secondaire sous le coût, dans sa case, caché quand le sort n’en a pas', options, () => {
  const sorts = ouvrirBase().prepare('SELECT magie_id, nom, cout_secondaire FROM sort').all();
  for (const p of avecSorts) {
    const id = `magies/${p.slug}`;
    const siens = sorts.filter((s) => s.magie_id === id);
    const tableaux = [...p.html.matchAll(/<table class="sorts\b[^"]*">\s*<thead>([\s\S]*?)<\/thead>/g)];
    assert.ok(tableaux.length >= 5, `${p.slug} : un tableau par NPM`);
    for (const m of tableaux) {
      const colonnes = [...m[1].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((t) => t[1]);
      assert.deepEqual(colonnes, ['Nom', 'Type', 'Coût', 'Portée', 'Zone', 'D/S/B'], p.slug);
    }
    assert.doesNotMatch(p.html, /data-label="Coût secondaire"/, `${p.slug} : plus de case à part`);
    // chaque case « Coût » : le coût (son champ) puis le coût secondaire (son champ, caché s'il est vide)
    const cases = [...p.html.matchAll(/<td data-label="Coût" class="sort__cout">([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    assert.equal(cases.length, siens.length, `${p.slug} : une case par sort`);
    const secondaires = cases.map((c) => {
      assert.match(c, /^\s*<div class="sort__cout-chakra"[^>]*data-ed-rendu="sort-cout"/, p.slug);
      const m = /<div class="sort__cout-secondaire"([^>]*)>([\s\S]*?)<\/div>\s*$/.exec(c.replace(/<div>([\s\S]*?)<\/div>/g, '$1'));
      assert.ok(m, `${p.slug} : un champ de coût secondaire dans la case`);
      const texte = m[2].replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
      assert.equal(/\shidden\b/.test(m[1]), texte === '', `${p.slug} : caché si et seulement si vide (${texte})`);
      // un cadre de l'éditeur : vide, il se montre en mode modification pour être rempli (src/scripts/edition/editeur.mjs#cadres)
      assert.match(m[1], /\sdata-ed-cadre\b/, `${p.slug} : champ du coût secondaire sans data-ed-cadre`);
      return texte;
    });
    assert.deepEqual(secondaires.filter(Boolean).sort(), siens.filter((s) => s.cout_secondaire).map((s) => s.cout_secondaire).sort(), p.slug);
  }
  const html = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
  assert.ok(html('magie-du-sang').includes('1 Sang') && html('magie-du-feu').includes('20% PV') && html('magie-de-larcane').includes('Par tour et par cible'));
});

test('panneau d’un sort : un seul cadre « Effets » par sort, les règles d’invocation et l’annexe sont repliées par défaut', options, () => {
  for (const { slug, html } of avecSorts) {
    assert.equal([...html.matchAll(/<h5>Effets<\/h5>/g)].length, 23, `${slug} : 23 cadres « Effets »`);
    assert.doesNotMatch(html, /<details[^>]*\sopen\b/, `${slug} : un <details> est ouvert par défaut`);
  }
  const necro = pages.find((p) => p.slug === 'magie-de-la-necromancie').html;
  assert.match(necro, /<summary>Règles de l’invocation<\/summary>/);
  assert.match(necro, /<summary>TABLEAU &quot;AMÉLIORATION CADAVÉRIQUE&quot;<\/summary>/);
});

test('créatures invoquées (et celles de « Manteau noir ») : un bouton par créature, sur la couleur de sa ou ses magies, sans lien « Bestiaire » ni lien à bulle ; sa carte du bestiaire en infobulle (demande du propriétaire), une par créature et par page', options, () => {
  const db = ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' });
  const { lignes } = chargerInvocations(db);
  const parSlug = new Map(lignes.map((l) => [l.id.slice(l.id.indexOf('/') + 1), l]));
  // les améliorations d'« Amélioration cadavérique » qui portent le nom d'une créature (décision R130 : sa carte en infobulle)
  const ameliorees = [...chargerMagies(db).sorts.values()].flatMap((s) => s.ameliorations?.lignes ?? []).filter((a) => a.creature).length;
  assert.ok(ameliorees > 0);
  // les créatures citées par page : les sorts d'invocation (Terre, Nécromancie, Ombre), « Manteau noir » (Ombre), « Amélioration cadavérique »
  // (Nécromancie), et tout cela dans le Potentiel Illimité
  const attendu = { 'magie-de-la-necromancie': [28, 28 + ameliorees], 'magie-de-la-terre': [30, 30], 'magie-de-lombre': [5, 10], 'potentiel-illimite': [63, 68 + ameliorees] };
  for (const { slug, html } of pages) {
    const [cartes, declencheurs] = attendu[slug] ?? [0, 0];
    // la couleur : la classe de la première magie et la classe de second rang de la seconde, ou de la même (lib/palette-css.mjs), jamais un style
    const boutons = [...html.matchAll(/<button type="button" class="chip creature__bouton creature__bouton--magie couleur-magie-([\w-]+) couleur-2-magie-([\w-]+)" data-bulle="bulle-creature-([^"]+)" aria-describedby="bulle-creature-\3" title="[^"]+">([^<]+)<\/button>/g)]
      .map(([tout, c1, c2, s, nom]) => [tout, s, c1, c2, nom]);
    assert.doesNotMatch(html, /class="chip creature__bouton[^"]*"[^>]*style=/, `${slug} : aucun bouton de créature en style`);
    // au toucher, la carte couvre l'écran d'un téléphone : un lien à bulle ne pourrait pas être suivi (le second appui tomberait sur elle)
    assert.doesNotMatch(html, /<a\b[^>]*data-bulle="bulle-creature-/, `${slug} : aucun lien à bulle`);
    assert.equal(boutons.length, declencheurs, `${slug} : déclencheurs (noms des créatures, et « Carte de … » de Manteau noir)`);
    assert.equal([...html.matchAll(/data-bulle="bulle-creature-/g)].length, declencheurs, `${slug} : chaque déclencheur a la forme complète (aria-describedby, title)`);
    // plus de lien « Bestiaire » à côté du nom (demande du propriétaire)
    assert.doesNotMatch(html, /creature__lien|dans le bestiaire">Bestiaire</, `${slug} : aucun lien Bestiaire`);
    // une magie : une couleur ; deux magies (« Terre + Feu ») : un dégradé de l'une à l'autre
    if (slug === 'magie-de-la-terre' || slug === 'magie-de-la-necromancie') {
      assert.ok(boutons.some(([, , c1, c2]) => c1 === c2), `${slug} : créatures d'une seule magie`);
      assert.ok(boutons.some(([, , c1, c2]) => c1 !== c2), `${slug} : créatures de deux magies en dégradé`);
    }
    // (une amélioration d'« Amélioration cadavérique » garde l'écriture de son tableau, « Os Froid », rattachée au nom exact à la casse près : R130)
    for (const [, s, , , nom] of boutons) assert.equal(nom.replace(/&#39;/g, "'").toLocaleLowerCase('fr'), parSlug.get(s)?.nom.toLocaleLowerCase('fr'), `${slug} : ${s}`);
    // plus de fiche minimale sous les blocs
    assert.doesNotMatch(html, /creature__fiche|creature__rangee/, `${slug} : fiche minimale retirée`);
    // les cartes : une bulle par créature citée, cachée, role="tooltip", posée hors des onglets et des détails de sort (dans .cartes-creatures),
    // sans identifiant interne ni élément interactif (une infobulle n'en a pas)
    const bulles = [...html.matchAll(/<div class="bulle bulle--carte" role="tooltip" id="bulle-creature-([^"]+)" data-placement="cote" data-fermer-au-toucher(?:="[^"]*")? hidden>/g)].map((m) => m[1]);
    assert.equal(bulles.length, cartes, `${slug} : cartes en infobulle`);
    assert.equal(new Set(bulles).size, bulles.length, `${slug} : une par créature`);
    const cites = new Set(boutons.map((b) => b[1]));
    assert.deepEqual([...cites].sort(), [...bulles].sort(), `${slug} : chaque créature citée a sa carte, et seulement elles`);
    if (!cartes) continue;
    const reserve = html.slice(html.indexOf('<div class="cartes-creatures">'));
    for (const s of bulles) {
      const debut = reserve.indexOf(`id="bulle-creature-${s}"`);
      const carte = reserve.slice(debut, reserve.indexOf('</article>', debut)).replace(/&#39;/g, "'");
      // (`data-npm-carte` : une carte qui change avec le NPM, décision R130)
      assert.ok(carte.includes(`<article class="bcarte" aria-label="Carte de ${parSlug.get(s).nom}"${parSlug.get(s).npmDuBloc === null ? ' data-npm-carte' : ''}>`), `${slug} : carte de ${s}`);
      assert.doesNotMatch(carte, /<(?:a|button|input|select|textarea)\b|\sid="(?!bulle-creature-)/, `${slug} : ${s} sans lien, bouton ni identifiant interne`);
      assert.match(carte, /<p class="bcarte__titre">/);
      // ses capacités en tuiles, propres puis communes (lib/monstre-rendu.mjs#htmlDeCapacite)
      assert.deepEqual(tuilesDeCapacites(carte), [...parSlug.get(s).capacites.map((k) => [false, k.nom]), ...parSlug.get(s).communes.map((k) => [true, k.nom])], `${slug} : ${s}, ses capacités en tuiles`);
    }
    // la CSS de la carte vient avec elle (styles/bestiaire/carte.css)
    assert.match(html, /\.bulle--carte \{ width: min\(30rem, calc\(100vw - 1rem\)\);/);
  }
});

// Décision R130 : sur une page de magie, les cartes des golems et des non-morts suivent le NPM choisi au curseur de la liste des créatures (une bulle par
// créature et par page : tous les curseurs vont ensemble, posés par le script de SortsInteractifs.astro, cachés sans JavaScript) ; « Amélioration
// cadavérique » montre ses améliorations selon l'invocation sacrifiée (le tableau de l'invocation qui porte son nom).
test('pages de magie : curseur du NPM des cartes, améliorations d’« Amélioration cadavérique » selon l’invocation sacrifiée (décision R130)', options, () => {
  const db = ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' });
  const { sorts } = chargerMagies(db);
  const page = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
  for (const slug of ['magie-de-la-terre', 'magie-de-la-necromancie']) {
    const curseurs = [...page(slug).matchAll(/<p class="invoque__npm" data-npm-page-bloc hidden>/g)];
    assert.equal(curseurs.length, 1, `${slug} : un curseur, caché sans JavaScript`);
    assert.match(page(slug), /<input type="range" min="1" max="5" step="1" value="1" data-npm-page aria-valuetext="NPM 1">/, slug);
  }
  // les marionnettes (une créature par NPM) : pas de curseur
  assert.doesNotMatch(page('magie-de-lombre'), /<input[^>]* data-npm-page/);
  const amelioration = [...sorts.values()].find((s) => s.ameliorations);
  assert.ok(amelioration, 'un sort désigne le tableau de son invocation');
  const html = page(amelioration.magieId.slice(amelioration.magieId.indexOf('/') + 1));
  const debut = html.indexOf('Règles propres : selon l’invocation sacrifiée');
  assert.ok(debut > 0, 'la section du sort');
  const tableau = html.slice(debut, html.indexOf('</table>', debut));
  assert.equal([...tableau.matchAll(/<tr><th scope="row">/g)].length, amelioration.ameliorations.lignes.length, 'une ligne par amélioration');
  // une amélioration au nom d'une créature : sa carte en infobulle, sous le nom de la créature
  for (const a of amelioration.ameliorations.lignes.filter((x) => x.creature)) {
    assert.ok(tableau.includes(`data-bulle="bulle-creature-${a.creature.id.slice(a.creature.id.indexOf('/') + 1)}"`), a.nom);
  }
});

// Tableau des relations entre magies, sous la carte de /magies/ (components/magie/TableauRelationsMagies.astro) : il remplace /wiki/races-et-magies/.
// Le Potentiel Illimité n'y est pas (demande du propriétaire).
const ORDRE_DU_CLASSEUR = ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];

test('/magies/ : le tableau des relations suit la carte, lignes et colonnes dans l’ordre du classeur sans le Potentiel Illimité, chaque ligne dans la couleur de sa magie', options, () => {
  const debut = indexMagies.indexOf('<section id="relations"');
  assert.ok(debut > indexMagies.indexOf('class="magies-orbite"'), 'sous la carte des magies');
  const tableau = contenu(indexMagies, debut, 'section');
  assert.deepEqual([...tableau.matchAll(/<span class="tableau-magies__vertical">([^<]+)<\/span>/g)].map((m) => m[1]), ORDRE_DU_CLASSEUR, 'colonnes');
  // chaque ligne porte la classe de sa magie (lib/palette-css.mjs), jamais une couleur en style
  const lignes = [...tableau.matchAll(/<tr class="tableau-magies__ligne (couleur-magie-[\w-]+)"><th scope="row" class="tableau-magies__nom"><a [^>]*><span[^>]*><\/span>([^<]+)<\/a>/g)];
  assert.deepEqual(lignes.map((m) => m[2]), ORDRE_DU_CLASSEUR, 'lignes');
  assert.deepEqual(lignes.map((m) => m[1]), ORDRE_DU_CLASSEUR.map(classeDeMagie), 'chaque ligne : la classe de sa magie');
  assert.equal(lignes[6][1], 'couleur-magie-feu', 'la ligne du Feu');
  assert.ok(cssDeLaPalette().includes('.couleur-magie-feu{--couleur:#ff4500;'), 'rouge orangé (sa classe de la palette ; demande du propriétaire du 2026-10-23, valeur validée le 2026-10-23 : « Garder les deux »)');
  assert.doesNotMatch(tableau, /style=/, 'aucun style');
  assert.ok(!tableau.includes('Potentiel Illimité'), 'ni ligne ni colonne pour le Potentiel Illimité');
  assert.ok(!tableau.includes('Une case « – »'), 'plus d’explication des cases « – »');
  // Résistance = bouclier, vulnérabilité = épée (demande du propriétaire), plus de triangles.
  assert.match(tableau, /<td title="Feu vulnérable face à Eau"><span class="tableau-magies__marque tableau-magies__marque--faible" aria-hidden="true"><svg class="icone-relation icone-relation--epee"/);
  assert.match(tableau, /<td title="Nécromancie résiste face à Sang ; Nécromancie incompatible avec Sang"><span class="tableau-magies__marque tableau-magies__marque--fort" aria-hidden="true"><svg class="icone-relation icone-relation--bouclier"/, 'deux marques dans une case');
  assert.ok(!/[▲▼]|fort contre|faible contre/.test(tableau), 'plus de triangles ni de « fort / faible contre »');
});

test('/races-et-magies/ n’existe plus et aucune page de magie n’y renvoie', options, () => {
  assert.ok(!existsSync(fileURLToPath(new URL('../dist/races-et-magies/', import.meta.url))));
  for (const { slug, html } of [{ slug: 'index', html: indexMagies }, ...pages]) assert.ok(!html.includes('races-et-magies'), slug);
});

// Page du Potentiel Illimité (components/magie/SortsDuPotentiel.astro) : il pioche ses sorts dans les autres magies. Une magie par onglet, dans l'ordre
// du classeur ; chaque onglet reprend les tableaux de cette magie du NPM 1 au NPM 4 (demande du propriétaire), avec le gabarit de sa page (TableauNpm.astro).
const ongletsDuPotentiel = () =>
  [...potentiel.matchAll(/<a class="onglet autre-magie__onglet (couleur-magie-[\w-]+)( is-active)?" id="onglet-([^"]+)" href="#(sorts-[^"]+)">\s*([^<]+?)\s*<\/a>/g)].map(
    (m) => ({ actif: Boolean(m[2]), cle: m[3], panneau: m[4], couleur: m[1], nom: m[5] }),
  );
const panneauxDuPotentiel = () =>
  [...potentiel.matchAll(/<section class="autre-magie magie-teinte (couleur-magie-[\w-]+)( is-active)?" id="(sorts-[^"]+)"/g)].map((m) => ({
    actif: Boolean(m[2]),
    id: m[3],
    couleur: m[1],
    html: contenu(potentiel, potentiel.lastIndexOf('<section', m.index + 1), 'section'),
  }));
/** Lignes de sort d'un morceau de page : [{ id, html }] (le <tbody> entier : ligne et détails). */
const lignesDeSort = (html) => [...html.matchAll(/<tbody class="sort" id="([^"]+)"/g)].map((m) => ({ id: m[1], html: contenu(html, m.index, 'tbody') }));

test('Potentiel Illimité : 14 onglets, un par autre magie, dans l’ordre du classeur et dans sa couleur, le premier ouvert ; un panneau par onglet', options, () => {
  const onglets = ongletsDuPotentiel();
  assert.deepEqual(onglets.map((o) => o.nom), ORDRE_DU_CLASSEUR);
  assert.deepEqual(onglets.map((o) => o.actif), ORDRE_DU_CLASSEUR.map((_, i) => i === 0), 'seul le premier onglet est ouvert');
  // dans la couleur de sa magie : sa classe (lib/palette-css.mjs), sans style
  assert.deepEqual(onglets.map((o) => o.couleur), ORDRE_DU_CLASSEUR.map(classeDeMagie));
  assert.equal(onglets.find((o) => o.nom === 'Feu').couleur, 'couleur-magie-feu');
  assert.doesNotMatch(potentiel, /class="(?:onglet autre-magie__onglet|autre-magie magie-teinte)[^"]*"[^>]*style=/, 'ni onglet ni panneau en style');
  const panneaux = panneauxDuPotentiel();
  assert.deepEqual(panneaux.map((p) => p.id), onglets.map((o) => o.panneau), 'un panneau par onglet, dans le même ordre');
  assert.deepEqual(panneaux.map((p) => p.couleur), onglets.map((o) => o.couleur), 'chaque panneau dans la couleur de sa magie');
  assert.deepEqual(panneaux.map((p) => p.actif), onglets.map((o) => o.actif));
  // dans la section « Sorts » de la page, que la navigation de la page désigne ; les rôles d'onglet sont posés par le script (sans JavaScript : des liens)
  const sorts = contenu(potentiel, potentiel.indexOf('<section class="magie-section" id="sorts"'), 'section');
  assert.match(sorts, /<h2 id="sorts-titre">Sorts des autres magies <span class="count">280<\/span><\/h2>/);
  assert.ok(sorts.includes('<div class="autres-magies" data-onglets="Magies">'));
  assert.match(potentiel, /<a href="#sorts">Sorts<\/a>/);
  assert.doesNotMatch(potentiel, /role="tab(list|panel)?"/);
});

test('Potentiel Illimité : chaque onglet reprend, du NPM 1 au NPM 4, les tableaux de sa magie tels que sur sa page (mêmes lignes, mêmes détails)', options, () => {
  let total = 0;
  for (const panneau of panneauxDuPotentiel()) {
    const cle = panneau.id.slice('sorts-'.length);
    const slug = panneau.html.match(/<h3 class="autre-magie__titre" id="[^"]+"><a href="[^"]*\/magies\/([^/"]+)\/">/)?.[1];
    const page = pages.find((p) => p.slug === slug)?.html;
    assert.ok(page, `${cle} : le titre du panneau mène à la page de sa magie`);
    const niveaux = [...panneau.html.matchAll(/<section class="npm" id="npm-([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(niveaux, [1, 2, 3, 4].map((n) => `${cle}-${n}`), `${cle} : NPM 1 à 4, pas de NPM 5`);
    assert.match(panneau.html, /<h4 class="npm__titre">/, `${cle} : titres des tableaux sous le titre de la magie`);
    // même gabarit : à l'identifiant près (préfixé du nom court de la magie) et au numéro des infobulles, chaque ligne est celle de la page de la magie
    const surSaPage = lignesDeSort(page.slice(page.indexOf('id="npm-1"'), page.indexOf('id="npm-5"')));
    const ici = lignesDeSort(panneau.html);
    assert.equal(ici.length, 20, `${cle} : 5 sorts par NPM`);
    const bulles = (html) => html.replace(/"etat-\d+"/g, '"etat-n"');
    const sansPrefixe = (html) => html.replace(new RegExp(`(id|aria-controls|aria-labelledby)="(sort|detail|fiche)-${cle}-`, 'g'), '$1="$2-');
    assert.deepEqual(ici.map((l) => bulles(sansPrefixe(l.html))), surSaPage.map((l) => bulles(l.html)), `${cle} : lignes reprises de sa page`);
    total += ici.length;
  }
  assert.equal(total, 280);
  assert.ok(!potentiel.includes('class="info"'), 'pas de règle du NPM 5 sur cette page');
  assert.match(potentiel, /<tbody class="sort" id="sort-feu-boule-de-feu"[ >]/, 'lien profond vers un sort : #sort-<magie>-<sort>');
});

// Petits correctifs du propriétaire sur les pages de magie : races, « Magie non compatible », Mode Hyper, altération d'état liée.
const page = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const carteNonCompatible = (html) => contenu(html, html.indexOf('<article class="affinite affinite--incompatible">'), 'article');

test('disponibilité par race : une seule liste, dans l’ordre de /races/, sans races pures / hybrides, sans les races qui ne l’ont pas, sans lien vers le tableau', options, () => {
  for (const { slug, html } of pages) {
    const section = contenu(html, html.indexOf('<section class="relations" id="races-disponibles"'), 'section');
    for (const interdit of ['Races pures', 'Races hybrides', 'ne peuvent pas l’avoir', '<details', 'Voir le tableau de toutes les races', '#magies-innees']) {
      assert.ok(!section.includes(interdit), `${slug} : « ${interdit} »`);
    }
    assert.equal([...section.matchAll(/<ul class="chips">/g)].length, 1, `${slug} : une seule liste`);
    const races = [...section.matchAll(/<a class="chip" href="[^"]*\/races\/([^/"]+)\/">/g)].map((m) => `races/${m[1]}`);
    assert.ok(races.length > 0, slug);
    assert.deepEqual(races, ORDRE_DES_RACES.filter((r) => races.includes(r)), `${slug} : ordre de /races/`);
  }
  // le Feu : races pures et hybrides mêlées, dans l'ordre de la liste
  const feu = page('magie-du-feu');
  assert.match(texteDe(contenu(feu, feu.indexOf('<section class="relations" id="races-disponibles"'), 'section')), /Lamia Mort-vivant Drassah&#39;thac Kitsune Satyre Marcass$/);
});

test('« Magie non compatible » : le Potentiel Illimité n’est cité nulle part ; « Mono-magie uniquement » pour lui et pour la Corruption (excepté Elfe Noir Charbon et Felfe Noir)', options, () => {
  for (const { slug, html } of pages) assert.ok(!carteNonCompatible(html).includes('/magies/potentiel-illimite/'), `${slug} : le Potentiel Illimité est cité`);
  assert.equal(texteDe(carteNonCompatible(potentiel)), 'Magie non compatible Mono-magie uniquement');
  assert.equal(texteDe(carteNonCompatible(page('magie-de-la-corruption'))), 'Magie non compatible Mono-magie uniquement Excepté pour Elfe Noir Charbon Felfe Noir');
  assert.equal(texteDe(carteNonCompatible(page('magie-du-feu'))), 'Magie non compatible Aucune', 'le Feu ne citait que le Potentiel Illimité');
  assert.equal(texteDe(carteNonCompatible(page('magie-du-sang'))), 'Magie non compatible Arcane Corruption Espace/Temps Nécromancie');
  for (const { slug, html } of pages) assert.ok(!html.includes('Elfe Noir Salé'), `${slug} : l’Elfe Noir Salé est une erreur de la fiche`);
  assert.equal(pages.filter((p) => p.html.includes('Mono-magie uniquement</p>')).length, 2);
});

test('décision R174 : le Potentiel Illimité montre sa vulnérabilité physique (« Dégâts physiques » : Estoc, Frappe, Taille, puis la phrase de la source) ; aucune autre magie', options, () => {
  const carte = (html, cle) => contenu(html, html.indexOf(`<article class="affinite affinite--${cle}">`), 'article');
  const brut = 'Surtension corporelle (Vulnérabilité contre les dégâts physiques';
  assert.equal(texteDe(carte(potentiel, 'faible')), `Vulnérabilités Magies Aucune Altérations d’état Aucune Dégâts physiques Estoc Frappe Taille « ${brut} […] »`, 'la coupe de la citation marquée « […] »');
  assert.equal(texteDe(carte(potentiel, 'fort')), 'Résistances Magies Aucune Altérations d’état Aucune');
  for (const { slug, html } of pages.filter((p) => p.slug !== 'potentiel-illimite')) {
    assert.ok(!contenu(html, html.indexOf('<section class="magie-section" id="affinites"'), 'section').includes('Dégâts physiques'), `${slug} : pas de groupe physique`);
  }
});

test('Mode Hyper : plus de texte « Liste des effets mode hyper », un (+) à côté du titre mène à la liste', options, () => {
  for (const { slug, html } of pages) {
    const titre = html.match(/<h2 id="mode-hyper-titre">[\s\S]*?<\/h2>/)?.[0] ?? '';
    assert.match(titre, /Capacité Mode Hyper\s*<a class="lien-plus no-print" href="[^"]*\/regles\/avancees\/liste-des-effets-mode-hyper\/" title="Liste des effets mode hyper" aria-label="Liste des effets mode hyper"><span aria-hidden="true">\+<\/span><\/a>/, slug);
    assert.ok(!html.includes('>Liste des effets mode hyper</a>'), `${slug} : le texte du lien est revenu`);
  }
});

test('Potentiel Illimité : plus de texte d’aide au-dessus des onglets', options, () => {
  assert.ok(!potentiel.includes('Choisissez une magie'));
  assert.ok(!potentiel.includes('Les tableaux de chaque magie, du NPM 1 au NPM'));
});

test('altération d’état liée : un encart après la présentation (et l’explication), avant les résistances ; aucun pour le Potentiel Illimité', options, () => {
  for (const { slug, html } of pages) {
    const debut = html.indexOf('<section class="magie-section" id="alteration"');
    if (slug === 'potentiel-illimite') {
      assert.equal(debut, -1);
      assert.ok(!html.includes('href="#alteration"'));
      continue;
    }
    assert.ok(debut > 0, `${slug} : encart absent`);
    assert.ok(debut > html.indexOf('id="presentation"') && debut > html.indexOf('id="explication"'), `${slug} : après la présentation`);
    assert.ok(debut < html.indexOf('id="affinites"'), `${slug} : avant les résistances`);
    const encart = contenu(html, debut, 'section');
    assert.equal([...encart.matchAll(/<article class="etat-lie">/g)].length, 1, slug);
    assert.match(encart, /<a href="[^"]*\/regles\/avancees\/liste-des-alterations-d-etat\/#[^"]+">[^<]+<\/a> <span class="etat-lie__type">(Physique|Mental)<\/span>/, `${slug} : lien vers sa section, type`);
    assert.deepEqual([...encart.matchAll(/<span class="etat-lie__stade-nom">([^<]+)<\/span>/g)].map((m) => m[1]), ['Stade 1', 'Stade 2', 'Stade 3'], slug);
    assert.ok(html.indexOf('href="#alteration"') < html.indexOf('href="#affinites"'), `${slug} : entrée de navigation`);
  }
  const feu = contenu(page('magie-du-feu'), page('magie-du-feu').indexOf('<section class="magie-section" id="alteration"'), 'section');
  assert.match(texteDe(feu), /^Altération d’état Brûlure Physique Stade 1 Inflige 10% de la santé Max pendant 3 Tours\./);
  const arcane = contenu(page('magie-de-larcane'), page('magie-de-larcane').indexOf('<section class="magie-section" id="alteration"'), 'section');
  assert.match(texteDe(arcane), /^Altération d’état Surcharge Magique Mental Aussi liée à Corruption Stade 1/, 'altération partagée : l’autre magie est nommée');
});

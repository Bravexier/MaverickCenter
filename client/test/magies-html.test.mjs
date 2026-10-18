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
import { liaisonsEntreMagies, segmentCoupe } from '../src/lib/magie-fleches.mjs';
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
// touche une autre, ni sur grand écran (carte de 58 à 62rem de large) ni sur écran étroit (téléphone de 320px à 60rem). Les largeurs reprennent
// styles/magie/orbit.css (9rem, 8rem pour l'hexagone élémentaire, 12rem pour le Potentiel Illimité ; en cqw sous 60rem), hauteur 2.9rem.
test('carte des magies : compacte, et aucune pastille ne touche une autre', options, () => {
  const ratio = Number(indexMagies.match(/\.magies-orbite \{[^}]*aspect-ratio: 1000 \/ (\d+);/)?.[1]);
  const hauteurEtroite = Number(indexMagies.match(/\.magies-orbite \{ height: ([\d.]+)rem; aspect-ratio: auto; \}/)?.[1]);
  assert.ok(ratio > 0 && ratio <= 450, `carte du grand écran plus large que haute (1000 / ${ratio})`);
  assert.ok(hauteurEtroite > 0 && hauteurEtroite <= 40, `carte étroite de ${hauteurEtroite}rem`);
  const noeuds = [...indexMagies.matchAll(/class="magies-orbite__position magies-orbite__position--([\w-]+)" data-magie="[^"]*" style="([^"]+)"[^]*?aria-label="([^"]+)"/g)].map(([, region, style, nom]) => {
    const v = (axe) => Number(style.match(new RegExp(`--${axe}: ([\\d.]+)%`))[1]) / 100;
    return { region, nom, x: v('x'), y: v('y'), mx: v('mx'), my: v('my') };
  });
  assert.equal(noeuds.length, 15);
  const ecart = (a, b) => Math.max(Math.abs(a.cx - b.cx) - (a.l + b.l) / 2, Math.abs(a.cy - b.cy) - 2.9);
  const verifier = (boites, ecran) => {
    for (const [i, a] of boites.entries()) {
      assert.ok(a.cx - a.l / 2 >= 0 && a.cx + a.l / 2 <= a.largeur + 1e-9, `${ecran} : pastille hors de la carte (${a.nom})`);
      for (const b of boites.slice(i + 1)) assert.ok(ecart(a, b) >= 0.25, `${ecran} : pastilles qui se touchent (${a.nom} / ${b.nom})`);
    }
  };
  for (const vue of [60, 64, 90]) {
    const largeur = Math.min(vue, 64) - 2;
    const hauteur = (largeur * ratio) / 1000;
    const l = { potentiel: Math.min(12, 0.32 * vue), elementaire: Math.min(8, 0.16 * vue) };
    verifier(noeuds.map((n) => ({ ...n, largeur, cx: n.x * largeur, cy: n.y * hauteur, l: l[n.region] ?? Math.min(9, 0.16 * vue) })), `écran de ${vue}rem`);
  }
  for (const vue of [20, 22.5, 24.375, 30, 45, 59.9]) {
    const largeur = Math.min(vue, 64) - 2;
    const l = { potentiel: Math.min(12, 0.8 * largeur), elementaire: Math.min(8, 0.36 * largeur) };
    verifier(noeuds.map((n) => ({ ...n, largeur, cx: n.mx * largeur, cy: n.my * hauteurEtroite, l: l[n.region] ?? Math.min(9, 0.46 * largeur) })), `écran étroit de ${vue}rem`);
  }
});

// Relations de la carte (lib/magie-fleches.mjs, demandes du propriétaire) : cachées, affichées au survol d'une magie (les siennes seulement), une épée
// ou un bouclier au bout des traits ; la disposition du grand écran est telle qu'aucun trait ni aucune boucle ne passe sous une autre pastille, pour une
// carte de 58 à 62rem de large (pastilles de 9rem, 8rem pour les éléments, 12rem pour le Potentiel Illimité, 2.9rem de haut). Sous 60rem : rien.
test('carte des magies : une relation par paire liée dans la base, au survol seulement, et aucun trait sous une autre pastille', options, () => {
  const { magies } = chargerMagies(ouvrirBase());
  const { liaisons, boucles } = liaisonsEntreMagies([...magies.values()]);
  const traits = [...indexMagies.matchAll(/<g class="magies-relation avec-([\w-]+) avec-([\w-]+)"[^>]*><line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)]
    .map(([, a, b, ...xy]) => ({ a, b, p: xy.slice(0, 2).map(Number), q: xy.slice(2).map(Number) }));
  const lacets = [...indexMagies.matchAll(/<g class="magies-relation magies-relation--boucle avec-([\w-]+)"[^>]*><path class="magies-relation__boucle" d="M ([^"]+)"/g)]
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
  for (const k of cles) assert.ok(indexMagies.includes(`.magies-orbite:has([data-magie="${k}"]:hover, [data-magie="${k}"] a:focus-visible) .magies-relation.avec-${k} {`), k);
  assert.ok(!indexMagies.includes(':focus-within)) .magies-relation'), 'plus de :focus-within pour les relations');
  assert.match(indexMagies.slice(indexMagies.indexOf('@media (max-width: 60rem)')), /\.magies-orbite__relations, \.magies-legende \{ display: none; \}/);
  // géométrie
  const hauteur = Number(indexMagies.match(/class="magies-orbite__relations" viewBox="0 0 1000 (\d+)"/)?.[1]);
  assert.equal(hauteur, Number(indexMagies.match(/\.magies-orbite \{[^}]*aspect-ratio: 1000 \/ (\d+);/)?.[1]), 'SVG aux proportions de la carte');
  const centres = new Map([...indexMagies.matchAll(/class="magies-orbite__position magies-orbite__position--([\w-]+)" data-magie="([\w-]+)" style="([^"]+)"/g)].map(([, region, k, style]) => {
    const v = (nom) => Number(style.match(new RegExp(`--${nom}: ([\\d.]+)%`))[1]) / 100;
    return [k, { region, x: v('x') * 1000, y: v('y') * hauteur }];
  }));
  for (const largeurRem of [58, 62]) {
    const unite = 1000 / largeurRem;
    const boite = ({ region, x, y }, marge = 0) => {
      const w = (region === 'potentiel' ? 12 : region === 'elementaire' ? 8 : 9) * unite;
      const h = 2.9 * unite;
      return [x - w / 2 - marge, y - h / 2 - marge, x + w / 2 + marge, y + h / 2 + marge];
    };
    for (const { a, b, p, q } of traits) {
      for (const [k, c] of centres) if (k !== a && k !== b) assert.ok(!segmentCoupe(p, q, boite(c, 4)), `${largeurRem}rem : le trait ${a} – ${b} passe sous ${k}`);
    }
    for (const { k, boite: l } of lacets) {
      for (const [autre, c] of centres) {
        if (autre === k) continue;
        const r = boite(c);
        assert.ok(!(l[0] < r[2] && r[0] < l[2] && l[1] < r[3] && r[1] < l[3]), `${largeurRem}rem : la boucle de ${k} touche ${autre}`);
      }
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

test('coût en deux colonnes (décision R105) : chaque tableau a « Coût » puis « Coût secondaire » ; chaque sort, sa case de coût secondaire, celle de la base ou « — »', options, () => {
  const sorts = ouvrirBase().prepare('SELECT magie_id, nom, cout_secondaire FROM sort').all();
  for (const p of avecSorts) {
    const id = `magies/${p.slug}`;
    const siens = sorts.filter((s) => s.magie_id === id);
    const tableaux = [...p.html.matchAll(/<table class="sorts\b[^"]*">\s*<thead>([\s\S]*?)<\/thead>/g)];
    assert.ok(tableaux.length >= 5, `${p.slug} : un tableau par NPM`);
    for (const m of tableaux) {
      const colonnes = [...m[1].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((t) => t[1]);
      assert.deepEqual(colonnes, ['Nom', 'Type', 'Coût', 'Coût secondaire', 'Portée', 'Zone', 'D/S/B'], p.slug);
    }
    const cases = [...p.html.matchAll(/<td data-label="Coût secondaire" class="sort__cout-secondaire"[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim());
    assert.equal(cases.length, siens.length, `${p.slug} : une case par sort`);
    assert.deepEqual(cases.filter((c) => c !== '—').sort(), siens.filter((s) => s.cout_secondaire).map((s) => s.cout_secondaire).sort(), p.slug);
  }
  const html = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
  assert.ok(html('magie-du-sang').includes('1 Sang') && html('magie-du-feu').includes('20% PV'));
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
  const { lignes } = chargerInvocations(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  const parSlug = new Map(lignes.map((l) => [l.id.slice(l.id.indexOf('/') + 1), l]));
  // les créatures citées par page : les sorts d'invocation (Terre, Nécromancie, Ombre), « Manteau noir » (Ombre), et les trois dans le Potentiel Illimité
  const attendu = { 'magie-de-la-necromancie': [28, 28], 'magie-de-la-terre': [30, 30], 'magie-de-lombre': [5, 10], 'potentiel-illimite': [63, 68] };
  for (const { slug, html } of pages) {
    const [cartes, declencheurs] = attendu[slug] ?? [0, 0];
    const boutons = [...html.matchAll(/<button type="button" class="chip creature__bouton" data-bulle="bulle-creature-([^"]+)" aria-describedby="bulle-creature-\1" title="[^"]+" style="--creature-1: (#[0-9a-f]{6}); --creature-2: (#[0-9a-f]{6})">([^<]+)<\/button>/g)];
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
    for (const [, s, , , nom] of boutons) assert.equal(nom.replace(/&#39;/g, "'"), parSlug.get(s)?.nom, `${slug} : ${s}`);
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
      assert.ok(carte.includes(`<article class="bcarte" aria-label="Carte de ${parSlug.get(s).nom}">`), `${slug} : carte de ${s}`);
      assert.doesNotMatch(carte, /<(?:a|button|input|select|textarea)\b|\sid="(?!bulle-creature-)/, `${slug} : ${s} sans lien, bouton ni identifiant interne`);
      assert.match(carte, /<p class="bcarte__titre">/);
      // ses capacités en tuiles, propres puis communes (lib/monstre-rendu.mjs#htmlDeCapacite)
      assert.deepEqual(tuilesDeCapacites(carte), [...parSlug.get(s).capacites.map((k) => [false, k.nom]), ...parSlug.get(s).communes.map((k) => [true, k.nom])], `${slug} : ${s}, ses capacités en tuiles`);
    }
    // la CSS de la carte vient avec elle (styles/bestiaire/carte.css)
    assert.match(html, /\.bulle--carte \{ width: min\(30rem, calc\(100vw - 1rem\)\);/);
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
  const lignes = [...tableau.matchAll(/<tr class="tableau-magies__ligne" style="--couleur-magie: (#[0-9a-f]{6})"><th scope="row" class="tableau-magies__nom"><a [^>]*><span[^>]*><\/span>([^<]+)<\/a>/g)];
  assert.deepEqual(lignes.map((m) => m[2]), ORDRE_DU_CLASSEUR, 'lignes');
  assert.equal(lignes[6][1], '#ff0000', 'la ligne du Feu est rouge');
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
  [...potentiel.matchAll(/<a class="onglet autre-magie__onglet( is-active)?" id="onglet-([^"]+)" href="#(sorts-[^"]+)" style="--couleur-magie: (#[0-9a-f]{6}); --couleur-texte-magie: (#[0-9a-f]{6})">\s*([^<]+?)\s*<\/a>/g)].map(
    (m) => ({ actif: Boolean(m[1]), cle: m[2], panneau: m[3], couleur: m[4], nom: m[6] }),
  );
const panneauxDuPotentiel = () =>
  [...potentiel.matchAll(/<section class="autre-magie magie-teinte( is-active)?" id="(sorts-[^"]+)"[^>]*style="--couleur-magie: (#[0-9a-f]{6});/g)].map((m) => ({
    actif: Boolean(m[1]),
    id: m[2],
    couleur: m[3],
    html: contenu(potentiel, potentiel.lastIndexOf('<section', m.index + 1), 'section'),
  }));
/** Lignes de sort d'un morceau de page : [{ id, html }] (le <tbody> entier : ligne et détails). */
const lignesDeSort = (html) => [...html.matchAll(/<tbody class="sort" id="([^"]+)"/g)].map((m) => ({ id: m[1], html: contenu(html, m.index, 'tbody') }));

test('Potentiel Illimité : 14 onglets, un par autre magie, dans l’ordre du classeur et dans sa couleur, le premier ouvert ; un panneau par onglet', options, () => {
  const onglets = ongletsDuPotentiel();
  assert.deepEqual(onglets.map((o) => o.nom), ORDRE_DU_CLASSEUR);
  assert.deepEqual(onglets.map((o) => o.actif), ORDRE_DU_CLASSEUR.map((_, i) => i === 0), 'seul le premier onglet est ouvert');
  assert.equal(onglets.find((o) => o.nom === 'Feu').couleur, '#ff0000');
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

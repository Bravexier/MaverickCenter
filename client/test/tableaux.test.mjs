// Le gabarit commun des tableaux (demande du propriétaire, 2026-10-17 : « De manière générale il faudrait uniformiser tous les tableaux sous le même
// template commun » ; styles/global/tableaux.css, components/Tableau.astro) : la présentation d'un tableau (cadre, en-têtes en petites capitales sur
// un fond teinté, filets, cases) n'est écrite qu'à un endroit, et les tableaux des règles du site construit la suivent. Les sources sont lues sans
// build ; le site construit (dist/) se saute sans `npm run build` (la CI le lance après le build).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONTRASTE_MINIMAL, contraste } from '../src/lib/alchimie-couleurs.mjs';
import { couleursDeLaPalette } from '../src/lib/palette-css.mjs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const lire = (chemin) => readFileSync(join(src, chemin), 'utf8');
/** Les feuilles de style et les composants de src/ ({ chemin, texte }). */
const sources = (dossier = '') => readdirSync(join(src, dossier), { withFileTypes: true }).flatMap((e) => {
  const chemin = dossier ? `${dossier}/${e.name}` : e.name;
  if (e.isDirectory()) return sources(chemin);
  return /\.(css|astro)$/.test(e.name) ? [{ chemin, texte: lire(chemin) }] : [];
});

// La garde de la couleur pleine (demande du propriétaire du 2026-10-29 : « Je ne veux plus de ligne entièrement colorées de la couleur de la magie ») :
// les variables qui portent la couleur d'une classe de la palette, telle quelle, et celles qui la reprennent (`--cla: var(--couleur, …)`) ; une ligne
// ou une case du corps d'un tableau ne la prend jamais en fond, ni directement, ni avec un repli, ni par une variable intermédiaire
const PORTEUSES = ['couleur', 'couleur-2', 'ligne-fond', 'baton-fond', 'c', 'mag', 'niv', 'gemme'];
const valeurPleine = (porteuses) => new RegExp(`^var\\(--(?:${[...porteuses].map((p) => p.replace(/[-]/g, '\\-')).join('|')})\\s*(?:,[^;]*)?\\)\\s*(?:!important)?$`);
/** Les classes posées sur un `<tr>` par les composants, les pages et les modules de rendu (le texte de la balise ouvrante, `=>` compris). */
function classesDeLignes() {
  const fichiers = (dossier) => readdirSync(join(src, dossier), { withFileTypes: true }).flatMap((e) => {
    const chemin = `${dossier}/${e.name}`;
    return e.isDirectory() ? fichiers(chemin) : /\.(astro|mjs)$/.test(e.name) ? [lire(chemin)] : [];
  });
  const classes = new Set(['ligne-couleur']);
  for (const texte of [...fichiers('components'), ...fichiers('lib'), ...fichiers('pages')]) {
    for (const [balise] of texte.matchAll(/<tr\b(?:=>|[^>])*>/g)) for (const [mot] of balise.matchAll(/[a-z][a-z0-9]*(?:-{1,2}[a-z0-9]+)*/g)) classes.add(mot);
  }
  return classes;
}
/** Découpe au premier niveau (hors parenthèses et crochets) selon `separateur`. */
const decouper = (texte, separateur) => {
  const parts = [''];
  let niveau = 0;
  for (const car of texte) {
    if ('(['.includes(car)) niveau += 1;
    if (')]'.includes(car)) niveau -= 1;
    if (niveau === 0 && separateur.test(car)) parts.push('');
    else parts[parts.length - 1] += car;
  }
  return parts.map((p) => p.trim()).filter(Boolean);
};
/** Le sujet d'un sélecteur (son dernier composé) est-il une ligne ou une case du corps d'un tableau (les en-têtes `thead` exceptés) ? */
function visaUneLigne(selecteur, lignes) {
  if (/\bthead\b/.test(selecteur)) return false;
  const sujet = decouper(selecteur, /[\s>+~]/).at(-1) ?? '';
  // `:first-child` seul : une case ; `[data-x]` seul : un élément quelconque (une pastille dans la ligne)
  const sansPseudo = sujet.replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, '');
  const nu = sansPseudo.replace(/\[[^\]]*\]/g, '');
  if (sansPseudo === '' || nu === '*' || /^(?:tr|td|th)\b/.test(nu)) return true;
  return [...nu.matchAll(/\.([\w-]+)/g)].some(([, classe]) => lignes.has(classe));
}
const regles = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selecteurs, corps]) => ({
  selecteurs, declarations: corps.split(';').map((d) => d.match(/^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/)).filter(Boolean).map(([, p, v]) => [p, v]) }));
/** Les sélecteurs d'un ensemble de feuilles qui posent la couleur pleine en fond d'une ligne ou d'une case. */
function lignesPleines(css, lignes) {
  const toutes = regles(css);
  const porteuses = new Set(PORTEUSES);
  for (let taille = -1; taille !== porteuses.size;) {
    taille = porteuses.size;
    for (const { declarations } of toutes) for (const [p, v] of declarations) if (p.startsWith('--') && valeurPleine(porteuses).test(v)) porteuses.add(p.slice(2));
  }
  const pleine = valeurPleine(porteuses);
  return toutes.flatMap(({ selecteurs, declarations }) =>
    declarations.some(([p, v]) => /^background(?:-color)?$/.test(p) && pleine.test(v)) ? decouper(selecteurs, /,/).filter((s) => visaUneLigne(s, lignes)) : []);
}

test('le gabarit est chargé sur toutes les pages, sous :where() pour la table et ses cases', () => {
  const globale = lire('styles/global.css');
  assert.match(globale, /@import '\.\/global\/tableaux\.css';/);
  const gabarit = lire('styles/global/tableaux.css');
  for (const classe of ['.tableaux--cote-a-cote', '.tableau__titre', '.tableau__compte', '.tableau__note', '.tableau__defile', '.tableau--defile',
    '.table-donnees', '.table-donnees--serree', '.table-donnees--aeree', 'tr.ligne-couleur']) assert.ok(gabarit.includes(classe), classe);
  // la table et ses cases sous :where() : la feuille d'une page les précise sans surenchère de sélecteurs, quel que soit l'ordre des feuilles
  assert.match(gabarit, /:where\(\.table-donnees\) \{ width: 100%; border-collapse: collapse;/);
  assert.match(gabarit, /:where\(\.tableau__defile, \.tableau--defile\) \{ overflow-x: auto; \}/);
  assert.match(gabarit, /:where\(\.table-donnees\) > thead th \{/);
  assert.match(gabarit, /:where\(\.table-donnees\) > tbody > tr > \* \{/);
  // le composant écrit le cadre, le titre, la zone qui défile et la table du gabarit
  const composant = lire('components/Tableau.astro');
  for (const classe of ["'tableau'", "'tableau__titre'", "'tableau__nom'", "'tableau__compte'", "'tableau__note'", 'class="tableau__defile"', "'table-donnees'"]) {
    assert.ok(composant.includes(classe), classe);
  }
});

test('la présentation des en-têtes n’est écrite qu’une fois : aucune feuille de page ne la recopie', () => {
  // la recette du gabarit dans une case d'en-tête (`th`, `thead`) : ses petites capitales, ou leur crénage et leur taille ensemble ; hors gabarit,
  // seulement les tableaux de saisie et les outils
  const HORS_GABARIT = ['styles/fiche/', 'styles/debug/', 'styles/global/data-browser.css'];
  const recette = (decl) => /text-transform:\s*uppercase/.test(decl) || (/letter-spacing:\s*var\(--ls-caps\)/.test(decl) && /font-size:\s*var\(--fs-xxs\)/.test(decl));
  const recopies = sources().filter(({ chemin }) => chemin !== 'styles/global/tableaux.css' && !HORS_GABARIT.some((h) => chemin.startsWith(h)))
    .flatMap(({ chemin, texte }) => [...texte.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .filter((m) => /(?:^|[\s,>+~(])(?:thead|th)\b(?![-\w])/.test(m[1]) && recette(m[2]))
      .map((m) => `${chemin} : ${m[1].trim()}`));
  assert.deepEqual(recopies, []);
});

// Les lignes colorées (demande du propriétaire, 2026-10-29 : « Je ne veux plus de ligne entièrement colorées de la couleur de la magie. Je péfèrerai une
// bordure ou un fond plus transparent de la même manière sont soint faites les tuiles de caractéristiques et de compétences dans la fiche de
// personnage ») : comme les tuiles `.carac` de la fiche, le fond du thème teinté de la couleur, un filet et un liseré de la couleur, le texte du thème.

/** Les jetons d'un bloc du thème (styles/global/base.css) : `:root` (clair) et `:root[data-theme="dark"]` (sombre). */
const jetonsDuTheme = () => {
  const base = lire('styles/global/base.css');
  const blocs = [...base.matchAll(/(:root[^{]*)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ sel: sel.trim(), corps }));
  const jeton = (bloc, nom) => bloc.corps.match(new RegExp(`\\n\\s*${nom}: (#[0-9a-f]{6});`))?.[1];
  return Object.fromEntries([['clair', ':root'], ['sombre', ':root[data-theme="dark"]']].map(([theme, sel]) => {
    const bloc = blocs.find((b) => b.sel === sel) ?? assert.fail(`bloc ${sel} absent de base.css`);
    return [theme, Object.fromEntries(['--surface', '--text', '--muted', '--border'].map((n) => [n, jeton(bloc, n) ?? assert.fail(`${sel} ${n}`)]))];
  }));
};
/** `color-mix(in srgb, <couleur> <part>%, <fond>)`, comme le navigateur le calcule (mélange des canaux sRGB). */
const melange = (couleur, fond, part) => {
  const canaux = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
  const [c, f] = [canaux(couleur), canaux(fond)];
  return `#${c.map((v, i) => Math.round(v * part + f[i] * (1 - part)).toString(16).padStart(2, '0')).join('')}`;
};
const corpsDe = (css, selecteur) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .find(([, sel]) => sel.trim() === selecteur)?.[2] ?? assert.fail(`règle ${selecteur} absente`);

test('ligne colorée du gabarit : le fond du thème teinté de la couleur, un filet et un liseré de la couleur, le texte du thème lisible dans les deux thèmes', () => {
  const gabarit = lire('styles/global/tableaux.css');
  const cases = corpsDe(gabarit, ':where(.table-donnees) tr.ligne-couleur > *');
  const [, part] = cases.match(/background: color-mix\(in srgb, var\(--ligne-fond\) (\d+)%, var\(--surface\)\);/) ?? assert.fail(`fond teinté : ${cases}`);
  assert.match(cases, /color: var\(--text\);/, 'le texte du thème, plus jamais celui de la classe');
  assert.match(cases, /border-top: 1px solid color-mix\(in srgb, var\(--ligne-fond\) 60%, var\(--border\)\); border-bottom: 1px solid color-mix\(in srgb, var\(--ligne-fond\) 60%, var\(--border\)\);/,
    'le filet de la couleur, comme le cadre des tuiles de la fiche');
  assert.match(corpsDe(gabarit, ':where(.table-donnees) tr.ligne-couleur'), /--ligne-lisere: inset 4px 0 0 var\(--ligne-fond\), inset 5px 0 0 color-mix\(in srgb, var\(--ligne-texte\) 35%, var\(--ligne-fond\)\);/,
    'le liseré : la couleur pleine, bordée d’un trait tiré du texte de sa classe');
  assert.match(corpsDe(gabarit, ':where(.table-donnees) tr.ligne-couleur > :first-child'), /box-shadow: var\(--ligne-lisere\);/);
  const [, survol] = corpsDe(gabarit, ':where(.table-donnees) tr.ligne-couleur:hover > *').match(/background: color-mix\(in srgb, var\(--ligne-fond\) (\d+)%, var\(--surface\)\);/) ?? [];
  assert.ok(Number(survol) > Number(part), `le survol plus teinté (${survol} % contre ${part} %)`);
  // la tuile de la fiche, le modèle : la même teinte de la surface
  assert.match(corpsDe(lire('styles/fiche/fiche.css'), '.carac'), new RegExp(`background: color-mix\\(in srgb, var\\(--c\\) ${part}%, var\\(--surface\\)\\);`));
  // le texte du thème sur chaque teinte (repos, survol) de chaque couleur posée sur une ligne (magies : bâtons et armes élémentaires ; matériaux ;
  // niveaux des accessoires), dans les deux thèmes ; les potions : test/ceinture-html.test.mjs
  const themes = jetonsDuTheme();
  for (const [theme, t] of Object.entries(themes)) {
    for (const c of couleursDeLaPalette(['magie', 'materiau', 'niveau'])) {
      for (const p of [part, survol]) {
        const fond = melange(c.fond, t['--surface'], Number(p) / 100);
        assert.ok(contraste(t['--text'], fond) >= CONTRASTE_MINIMAL, `${theme}, ${c.classe} à ${p} % : ${t['--text']} sur ${fond} = ${contraste(t['--text'], fond).toFixed(2)}`);
      }
    }
  }
});

test('plus aucune ligne de tableau sur la couleur pleine : la couleur pleine ne sert qu’aux pastilles et aux liserés', () => {
  const lignes = classesDeLignes();
  // les cas que le garde-fou doit attraper (une case, une ligne nommée par sa seule classe, un repli, une variable intermédiaire), puis l'état actuel
  for (const css of ['.materiau > td { background: var(--couleur); }', '.baton { background: var(--couleur); }', 'tr.x { background-color: var(--couleur, #fff); }',
    'tr.baton > * { --elem-teinte: var(--couleur); } .baton > * { background: var(--elem-teinte); }', '.arme--elementaire > :first-child { background: var(--c) !important; }']) {
    assert.notDeepEqual(lignesPleines(css, lignes), [], css);
  }
  // ce qui reste permis : la couleur portée par une variable source, la teinte, une pastille posée dans la ligne
  for (const css of ['.materiau { --ligne-fond: var(--couleur); }', 'tr.x > * { background: color-mix(in srgb, var(--couleur) 12%, var(--surface)); }',
    '.arme--elementaire .arme-dgt--magie { background: var(--couleur); }']) {
    assert.deepEqual(lignesPleines(css, lignes), [], css);
  }
  // toutes les feuilles ensemble : une variable posée dans l'une peut servir de fond dans une autre
  const feuilles = sources('styles').filter(({ chemin }) => chemin.endsWith('.css')).map(({ texte }) => texte).join('\n');
  const fautives = lignesPleines(feuilles, lignes);
  assert.deepEqual(fautives, []);
});

// Le site construit : chaque <table> des pages de règles suit le gabarit, sauf les tableaux écrits en Markdown (une <table> nue dans `.prose`, que le
// gabarit habille par son conteneur) et les grilles à double entrée, qui gardent leurs filets de colonne : les matrices des
// magies (/magies/, /races/) et le butin d'une carte de monstre (une colonne par échelle).
const GRILLES = ['tableau-magies__table', 'bbutin'];
const PAGES = [
  ['ressources', 'equipement'], ['ressources', 'composants'], ['metiers'], ['bestiaire'], ['magies', 'magie-de-la-corruption'], ['races', 'elfe-noir'],
  ['decouvrir', 'creer-son-personnage'], ['regles', 'avancees', 'le-mode-hyper'], ['magies'], ['races'], ['lore', 'academie-de-larcane'],
];
const construit = existsSync(join(dist, 'ressources', 'equipement', 'index.html'));

test('le site construit : chaque tableau des règles suit le gabarit, dans un cadre qui défile', construit ? {} : { skip: 'site non construit (npm run build)' }, () => {
  let nombre = 0;
  for (const chemin of PAGES) {
    const html = readFileSync(join(dist, ...chemin, 'index.html'), 'utf8');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    for (const m of main.matchAll(/<table\b([^>]*)>/g)) {
      const classe = /class="([^"]*)"/.exec(m[1])?.[1] ?? '';
      const avant = main.slice(0, m.index);
      if (!classe) {
        // un tableau écrit en Markdown : dans le texte d'une page du wiki ou du guide
        assert.ok(/class="(?:[^"]* )?prose\b/.test(avant.slice(avant.lastIndexOf('<div class="'))), `${chemin.join('/')} : <table> nue hors du texte`);
        continue;
      }
      if (GRILLES.some((g) => classe.split(' ').includes(g))) continue;
      nombre += 1;
      assert.ok(classe.split(' ').includes('table-donnees'), `${chemin.join('/')} : <table class="${classe}"> hors gabarit`);
      // le conteneur qui défile : la zone du cadre, ou le cadre lui-même
      const conteneur = avant.slice(avant.lastIndexOf('<div '));
      assert.match(conteneur, /^<div class="(?:tableau__defile|[^"]*\btableau tableau--defile\b[^"]*)"/, `${chemin.join('/')} : <table class="${classe}"> sans sa zone qui défile`);
    }
  }
  assert.ok(nombre > 100, `${nombre} tableaux`);
});

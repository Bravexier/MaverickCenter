// Le gabarit commun des tableaux (demande du propriétaire, 2026-10-17 : « De manière générale il faudrait uniformiser tous les tableaux sous le même
// template commun » ; styles/global/tableaux.css, components/Tableau.astro) : la présentation d'un tableau (cadre, en-têtes en petites capitales sur
// un fond teinté, filets, cases) n'est écrite qu'à un endroit, et les tableaux des règles du site construit la suivent. Les sources sont lues sans
// build ; le site construit (dist/) se saute sans `npm run build` (la CI le lance après le build).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const lire = (chemin) => readFileSync(join(src, chemin), 'utf8');
/** Les feuilles de style et les composants de src/ ({ chemin, texte }). */
const sources = (dossier = '') => readdirSync(join(src, dossier), { withFileTypes: true }).flatMap((e) => {
  const chemin = dossier ? `${dossier}/${e.name}` : e.name;
  if (e.isDirectory()) return sources(chemin);
  return /\.(css|astro)$/.test(e.name) ? [{ chemin, texte: lire(chemin) }] : [];
});

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

// Le site construit : chaque <table> des pages de règles suit le gabarit, sauf les tableaux écrits en Markdown (une <table> nue dans `.prose` ou
// `.guide-texte`, que le gabarit habille par leur conteneur) et les grilles à double entrée, qui gardent leurs filets de colonne : les matrices des
// magies (/magies/, /races/) et le butin d'une carte de monstre (une colonne par échelle).
const GRILLES = ['tableau-magies__table', 'bbutin'];
const PAGES = [
  ['ressources', 'equipement'], ['ressources', 'composants'], ['metiers'], ['bestiaire'], ['magies', 'magie-de-la-corruption'], ['races', 'elfe-noir'],
  ['decouvrir', 'choisir-ses-magies'], ['regles', 'avancees', 'le-mode-hyper'], ['magies'], ['races'], ['lore', 'academie-de-larcane'],
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
        // un tableau écrit en Markdown : dans le texte d'une page ou d'un chapitre
        assert.ok(/class="(?:[^"]* )?(?:prose|guide-texte)\b/.test(avant.slice(avant.lastIndexOf('<div class="'))), `${chemin.join('/')} : <table> nue hors du texte`);
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

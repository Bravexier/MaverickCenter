// Défilement : au bout du défilement d'un panneau de la page (la fiche d'une arme, d'une armure, la carte d'un monstre, l'encart d'un accessoire…), la
// molette fait défiler la page entière (demande du propriétaire, 2026-10-16 : « corriger la roulette sur le scroll bar pour qu'elle descende la fenêtre
// entière si le max est atteint sur l'intermédiaire » ; « Il faut que ce problème ne se reproduise nulle part »). C'est le comportement du navigateur,
// sauf de deux façons, toutes deux gardées ici sur toutes les sources de src/ (CSS, composants, scripts) :
//   - une règle `overscroll-behavior` qui retient l'axe vertical (`contain` ou `none`, en propriété seule, en `-y` / `-block`, en seconde valeur du
//     raccourci, ou posée par un script) : seules les SURCOUCHES ci-dessous le peuvent, des éléments posés PAR-DESSUS la page (une bulle, une fenêtre,
//     un tiroir, un panneau en plein écran d'un écran étroit), dont le défilement ne doit pas faire bouger la page cachée dessous ; chacune est
//     reconnue à son fichier, à ses `@media` et à son sélecteur exacts (le même sélecteur hors de son `@media` retiendrait la molette sur grand écran) ;
//   - un écouteur de la molette (`wheel`) qui l'empêche (`preventDefault`) : seuls ceux de la liste ÉCOUTEURS, chacun avec sa raison.
// `overscroll-behavior-x` / `-inline` (glissement horizontal : retour arrière du navigateur, carrousel) n'est pas concerné.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = new URL('../src/', import.meta.url);
const ETROIT_ARMES = '@media (max-width: 79.99rem)';
const SURCOUCHES = [
  { fichier: 'styles/global/infobulles.css', media: '', selecteur: '.bulle', raison: 'une bulle flotte par-dessus la page (components/Infobulles.astro), la carte d’une créature invoquée comprise' },
  { fichier: 'styles/debug/schema.css', media: '', selecteur: '.schema-contenu__defilement', raison: 'le contenu d’une table, dans une fenêtre modale (<dialog>)' },
  { fichier: 'styles/chronologie/chronologie.css', media: '@media (max-width: 56rem)', selecteur: 'html.js .chrono--evenement .frise.est-ouverte .frise__liste', raison: 'la frise en tiroir par-dessus la page (téléphone)' },
  { fichier: 'styles/armes/armes.css', media: ETROIT_ARMES, selecteur: 'html.js .armes-vue.est-ouverte .armes-cote', raison: 'le panneau de l’arme en plein écran (écran étroit)' },
  { fichier: 'styles/armures/armures.css', media: ETROIT_ARMES, selecteur: 'html.js .armures-vue.est-ouverte .armures-cote', raison: 'le panneau de l’armure en plein écran (écran étroit)' },
  { fichier: 'styles/bestiaire/bestiaire.css', media: '@media (max-width: 70rem)', selecteur: 'html.js .bcartes', raison: 'la carte d’un monstre en plein écran (écran étroit)' },
];
const ECOUTEURS = [
  { fichier: 'scripts/portrait.mjs', raison: 'le zoom du portrait, dans la fenêtre modale du recadrage' },
  { fichier: 'scripts/debug-schema.mjs', raison: 'le zoom du schéma de la base, seulement une fois le schéma activé (sinon la page défile)' },
  { fichier: 'scripts/bestiaire.mjs', raison: 'fait défiler la PAGE d’abord, jusqu’à caler la vue (lib/bestiaire-filtres.mjs#defilementDAbord) : il ne la bloque jamais' },
];

const fichiers = readdirSync(src, { recursive: true }).map((n) => n.split('\\').join('/')).filter((n) => /\.(css|astro|mjs|ts)$/.test(n) && !n.startsWith('content/'));
const lire = (nom) => readFileSync(new URL(nom, src), 'utf8');
const blanc = (t) => t.replace(/[^\n]/g, ' ');

/**
 * Le texte sans ses commentaires, à la même longueur (les positions restent celles du fichier). En CSS, `/* … *\/` seulement ; ailleurs, les chaînes
 * sont sautées d'abord (`accept = 'image/*'` n'ouvre pas un commentaire), puis `/* … *\/` et `// …` (pas le `//` d'une adresse `https://`).
 */
export function sansCommentaires(texte, css) {
  if (css) return texte.replace(/\/\*[\s\S]*?\*\//g, blanc);
  return texte.replace(/'(?:\\.|[^\\'\n])*'|"(?:\\.|[^\\"\n])*"|`(?:\\.|[^\\`])*`|\/\*[\s\S]*?\*\/|(?<![:\\])\/\/[^\n]*/g, (m) => (m.startsWith('/') ? blanc(m) : m));
}

/** L'axe vertical d'une valeur d'`overscroll-behavior` (« auto contain » : la seconde valeur ; une seule : les deux axes). */
const vertical = (propriete, valeur) => {
  const v = valeur.trim().split(/\s+/);
  if (/-(y|block)$|Y$|Block$/.test(propriete)) return v[0];
  if (/-(x|inline)$|X$|Inline$/.test(propriete)) return null;
  return v[1] ?? v[0];
};

/** Les règles CSS d'un texte qui retiennent la molette : [{ media, selecteur }] (`media` : les `@media` qui l'englobent, du plus large au plus étroit). */
export function reglesCss(texte) {
  const trouvees = [];
  const pile = [];
  let debut = 0;
  // une déclaration finit à « ; » ou à la « } » de sa règle (la dernière peut ne pas avoir de « ; »)
  const lireLaDeclaration = (fin) => {
    const m = texte.slice(debut, fin).match(/^\s*(overscroll-behavior(?:-[a-z]+)?)\s*:\s*([^;!}]+)/);
    if (m && ['contain', 'none'].includes(vertical(m[1], m[2]))) {
      trouvees.push({ media: pile.slice(0, -1).filter((p) => p.startsWith('@media')).join(' '), selecteur: pile.at(-1) ?? '' });
    }
  };
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (c === '{') {
      pile.push(texte.slice(debut, i).trim().replace(/\s+/g, ' '));
      debut = i + 1;
    } else if (c === '}') {
      lireLaDeclaration(i);
      pile.pop();
      debut = i + 1;
    } else if (c === ';') {
      lireLaDeclaration(i);
      debut = i + 1;
    }
  }
  return trouvees;
}

/** Les écritures d'`overscroll-behavior` hors d'une feuille de style (un script, un style en ligne d'un composant) qui retiennent la molette : leurs lignes. */
export function ecrituresHorsCss(texte) {
  const lignes = [];
  const motifs = [
    /(overscroll-behavior(?:-[a-z]+)?)\s*:\s*([a-z]+(?:\s+[a-z]+)?)/g,
    /(overscrollBehavior[A-Za-z]*)\s*[:=]\s*['"`]([^'"`]+)['"`]/g,
    /setProperty\(\s*['"`](overscroll-behavior(?:-[a-z]+)?)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const motif of motifs) {
    for (const m of texte.matchAll(motif)) {
      if (['contain', 'none'].includes(vertical(m[1], m[2]))) lignes.push(texte.slice(texte.lastIndexOf('\n', m.index) + 1, texte.indexOf('\n', m.index)).trim());
    }
  }
  return lignes;
}

test('seules les surcouches posées par-dessus la page retiennent la molette ; un panneau de la page la rend à la page au bout de son défilement', () => {
  const trouvees = [];
  for (const nom of fichiers) {
    const css = nom.endsWith('.css');
    const texte = sansCommentaires(lire(nom), css);
    if (css) for (const r of reglesCss(texte)) trouvees.push({ fichier: nom, ...r });
    else for (const ligne of ecrituresHorsCss(texte)) trouvees.push({ fichier: nom, media: '', selecteur: ligne });
  }
  const estSurcouche = (r) => SURCOUCHES.some((s) => s.fichier === r.fichier && s.media === r.media && s.selecteur === r.selecteur);
  assert.deepEqual(trouvees.filter((r) => !estSurcouche(r)), [], 'une règle qui retient la molette hors des surcouches : la molette resterait bloquée au bout du panneau');
  // la liste reste juste : chaque surcouche y est encore
  for (const s of SURCOUCHES) assert.ok(trouvees.some((r) => estSurcouche(r) && r.fichier === s.fichier && r.selecteur === s.selecteur), `${s.fichier} ${s.selecteur} : plus de règle, la retirer de la liste`);
});

test('les écouteurs de la molette sont ceux de la liste, chacun avec sa raison', () => {
  const ecoute = fichiers.filter((nom) => /addEventListener\(\s*['"`]wheel['"`]|\bonwheel\s*=/.test(sansCommentaires(lire(nom), nom.endsWith('.css'))));
  assert.deepEqual(ecoute.sort(), ECOUTEURS.map((e) => e.fichier).sort(), 'un écouteur `wheel` de plus : qu’il ne bloque pas la molette dans un panneau de la page, puis l’inscrire ici');
});

test('les panneaux qui suivent le défilement à côté d’un tableau ne retiennent pas la molette (armes, armures, accessoires, bestiaire)', () => {
  for (const [fichier, selecteur] of [
    ['styles/armes/armes.css', 'html.js .armes-cote { position: sticky'],
    ['styles/armures/armures.css', 'html.js .armures-cote { position: sticky'],
    ['styles/accessoires/accessoires.css', 'html.js .acc .acc-cote {'],
    ['styles/bestiaire/bestiaire.css', '.bcartes { position: sticky'],
  ]) {
    const texte = sansCommentaires(lire(fichier), true);
    const i = texte.indexOf(selecteur);
    assert.ok(i >= 0, `${fichier} : ${selecteur}`);
    assert.match(texte.slice(i, texte.indexOf('}', i)), /overflow-y:\s*auto/, `${selecteur} : le panneau défile`);
  }
});

test('l’analyse : commentaires et chaînes, @media, raccourci à deux valeurs, axe horizontal, écritures d’un script', () => {
  const css = sansCommentaires('/* .x { overscroll-behavior: contain } */\n.a { overscroll-behavior: contain; }\n@media (max-width: 4rem) {\n  .a .b { overflow: auto; overscroll-behavior: auto contain; }\n}\n.c { overscroll-behavior-x: contain; overscroll-behavior: contain auto; }\n.d { overscroll-behavior-y: none; }\n.e { overflow: auto; overscroll-behavior: contain }', true);
  assert.deepEqual(reglesCss(css), [
    { media: '', selecteur: '.a' },
    { media: '@media (max-width: 4rem)', selecteur: '.a .b' },
    { media: '', selecteur: '.d' },
    { media: '', selecteur: '.e' },
  ]);
  // une chaîne qui écrit « /* » n'ouvre pas un commentaire : ce qui suit reste lu
  const js = sansCommentaires("input.accept = 'image/*';\nel.style.overscrollBehavior = 'contain'; // */\nel.style.setProperty('overscroll-behavior-y', 'none');\nObject.assign(el.style, { overscrollBehavior: 'auto contain' });\nfetch('https://exemple.org/x'); el.style.overscrollBehaviorX = 'contain';", false);
  assert.equal(ecrituresHorsCss(js).length, 3);
  assert.deepEqual(ecrituresHorsCss(sansCommentaires('// el.style.overscrollBehavior = "contain"\n/* el.style.overscrollBehavior = "none" */', false)), []);
});

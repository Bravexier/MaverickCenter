// Couleurs du site pour les potions et les attributs (lib/alchimie-couleurs.mjs, lib/attributs-couleurs.mjs ; demande du propriétaire du 2026-10-22 :
// « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du
// classeur. Aucune couleur en dur. » et, pour le texte, « Privilégé la lisibilité ») : la couleur d'une potion est une règle (l'affinité de son essence,
// ou la caractéristique d'un philtre, nuancée selon son niveau d'alchimie), jamais une couleur relevée ligne par ligne ; les attributs ont une seule
// source, que la fiche lit ; l'onglet Ceinture n'écrit aucune couleur en dur.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  ATTRIBUT_DE_L_AFFINITE, COULEURS_DES_AFFINITES, NUANCES_DES_NIVEAUX, caracteristiqueDesCompetences, couleurDAffinite, couleurDePotion, nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS, cssDesAttributs } from '../src/lib/attributs-couleurs.mjs';
import { COULEURS_CARACTERISTIQUES } from '../src/lib/caracteristiques-postures.mjs';
import { couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { couleursDesBatons } from '../src/lib/batons-rendu.mjs';
import { couleursDeLaLigne, htmlDeLigneDePotion } from '../src/lib/ceinture-rendu.mjs';

const db = ouvrirBase();
const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
const luminance = (hex) => hex.slice(1).match(/.{2}/g).map((c) => parseInt(c, 16)).reduce((n, c) => n + c, 0);

test('une affinité prend la couleur du site : son attribut, sa magie, ou la couleur ajoutée d’après le Doc ; Anti et Démon n’en ont pas', () => {
  for (const [affinite, attribut] of Object.entries(ATTRIBUT_DE_L_AFFINITE)) assert.equal(couleurDAffinite(affinite), COULEURS_DES_ATTRIBUTS[attribut], affinite);
  for (const magie of ['feu', 'eau', 'espace-temps', 'necromancie', 'lumiere']) assert.equal(couleurDAffinite(magie), couleurDeMagieConnue(magie), magie);
  for (const [affinite, couleur] of Object.entries(COULEURS_DES_AFFINITES)) assert.equal(couleurDAffinite(affinite), couleur, affinite);
  assert.equal(couleurDAffinite('anti'), null);
  assert.equal(couleurDAffinite('demon'), null);
  assert.equal(couleurDAffinite(null), null);
  // une couleur ajoutée ne double pas une règle qui existe déjà (attribut, magie), et elle vise une affinité de la base
  const affinites = new Set(db.prepare('SELECT id FROM affinite').all().map((a) => a.id));
  for (const affinite of Object.keys(COULEURS_DES_AFFINITES)) {
    assert.ok(affinites.has(affinite), `${affinite} : une affinité de la base`);
    assert.ok(!Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, affinite) && couleurDeMagieConnue(affinite) === null, `${affinite} : le site n’avait pas de règle`);
  }
});

test('chaque essence des recettes d’alchimie a sa couleur, sauf Anti et Démon (les philtres prennent celle de leur caractéristique)', () => {
  const essences = db.prepare("SELECT DISTINCT ri.affinite_id AS id FROM recette r JOIN recette_ingredient ri ON ri.recette_id = r.id WHERE r.genre = 'alchimie' AND ri.role = 'essence'")
    .all().map((e) => e.id).sort();
  assert.deepEqual(essences.filter((e) => couleurDAffinite(e) === null), ['anti', 'demon']);
});

test('la nuance d’un niveau d’alchimie : du plus clair (Novice) au plus foncé (Maître), la base à Avancé', () => {
  const rangs = db.prepare('SELECT rang FROM niveau_alchimie ORDER BY rang').all().map((n) => n.rang);
  assert.deepEqual(rangs, [1, 2, 3, 4, 5]);
  assert.deepEqual(Object.keys(NUANCES_DES_NIVEAUX).map(Number), rangs, 'une nuance par niveau');
  for (const base of ['#c62828', '#1e5bb8', '#e0b000', '#8e7cc3', '#ff6666']) {
    assert.equal(nuanceDuNiveau(base, 3), base);
    const l = rangs.map((r) => luminance(nuanceDuNiveau(base, r)));
    assert.deepEqual(l, [...l].sort((a, b) => b - a), `${base} : de plus en plus foncé`);
  }
  assert.equal(nuanceDuNiveau('#c62828', 1), '#eebfbf', '70 % de blanc');
  assert.equal(nuanceDuNiveau('#c62828', 5), '#771818', '40 % de noir');
  assert.equal(nuanceDuNiveau('#c62828', 9), '#c62828', 'un rang inconnu : la base');
});

test('la caractéristique dont un effet augmente les compétences : son nom exact, rien d’autre', () => {
  const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
  assert.equal(caracteristiqueDesCompetences('+5% dans toutes les compétences de Force pendant 2 tours.', caracteristiques), 'force');
  assert.equal(caracteristiqueDesCompetences("+10% dans toutes les compétences d' Agilité pendant 2 tours.", caracteristiques), 'agilite');
  assert.equal(caracteristiqueDesCompetences('+20% dans toutes les compétences de Volonté', caracteristiques), 'volonte');
  assert.equal(caracteristiqueDesCompetences('+1 Force jusqu’au prochain long repos', caracteristiques), null, 'pas dans cette tournure');
  assert.equal(caracteristiqueDesCompetences('compétences de Vigueur', caracteristiques), null, 'pas une caractéristique');
  assert.equal(caracteristiqueDesCompetences('Oblige un jet de vigueur', caracteristiques), null);
});

test('la couleur d’une potion : l’affinité de son essence, sinon la caractéristique (philtres), au niveau de son palier ; neutre sinon', () => {
  assert.deepEqual(couleurDePotion({ essence: 'sante', niveau: 1 }), { fond: nuanceDuNiveau(COULEURS_DES_ATTRIBUTS.sante, 1) });
  assert.deepEqual(couleurDePotion({ essence: 'coma', niveau: 4 }), { fond: nuanceDuNiveau(COULEURS_DES_AFFINITES.coma, 4) });
  assert.deepEqual(couleurDePotion({ essence: 'demon', caracteristique: 'force', niveau: 5 }), { fond: nuanceDuNiveau(COULEURS_CARACTERISTIQUES.force, 5) });
  assert.deepEqual(couleurDePotion({ essence: 'sante', caracteristique: 'force', niveau: 3 }), { fond: COULEURS_DES_ATTRIBUTS.sante }, 'l’essence d’abord');
  assert.equal(couleurDePotion({ essence: 'anti', niveau: 2 }), null);
  assert.equal(couleurDePotion({ essence: 'demon', caracteristique: 'inconnue', niveau: 2 }), null);
  assert.equal(couleurDePotion(), null);
  // le texte : le plus lisible sur le fond (« Privilégé la lisibilité »)
  const p = { id: 'ressources/x#potion:y', nom: 'Y', niveau_id: 'novice', niveau: 'Novice', prix_brut: '2 RO', effet: 'Z', couleur: couleurDePotion({ essence: 'chakra', niveau: 5 }) };
  const c = couleursDeLaLigne(p.couleur);
  assert.equal(c.texte, texteSurCouleur(c.fond));
  assert.ok(htmlDeLigneDePotion(p).includes(`style="--ligne-fond: ${c.fond}; --ligne-texte: ${c.texte}"`));
});

test('les bâtons : la couleur de leur magie sur le site, et le texte le plus lisible', () => {
  for (const nom of ['Sang', 'Feu', 'Eau', 'Corruption']) {
    assert.deepEqual(couleursDesBatons({ id: 'magies/x', nom }), { fond: couleurDeMagie(nom), texte: texteSurCouleur(couleurDeMagie(nom)) });
  }
});

test('aucune couleur en dur : ni dans l’onglet Ceinture, ni dans la règle des potions au-delà des couleurs ajoutées, ni pour les attributs de la fiche', () => {
  for (const f of ['src/styles/ceinture/ceinture.css', 'src/lib/ceinture-rendu.mjs', 'src/lib/ceinture-db.mjs', 'src/lib/batons-rendu.mjs',
    'src/components/ceinture/CeinturePanneau.astro', 'src/components/ceinture/BatonsMagiques.astro']) {
    assert.deepEqual(lire(f).match(HEX) ?? [], [], f);
  }
  assert.ok(!existsSync(new URL('../src/lib/ceinture-couleurs.mjs', import.meta.url)), 'plus de couleurs relevées ligne par ligne');
  // la règle des potions n'écrit que les couleurs qu'elle ajoute au site (une par affinité sans règle)
  const ecrites = [...lire('src/lib/alchimie-couleurs.mjs').matchAll(HEX)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(ecrites)].sort(), [...new Set(Object.values(COULEURS_DES_AFFINITES))].sort());
  // les attributs : une seule source, que la fiche lit (styles/fiche/fiche.css ne les écrit plus)
  const fiche = lire('src/styles/fiche/fiche.css');
  for (const cle of Object.keys(COULEURS_DES_ATTRIBUTS)) assert.match(fiche, new RegExp(`\\.attribut\\[data-a='${cle}'\\] \\{ --a: var\\(--attribut-${cle}\\); \\}`), cle);
  for (const couleur of Object.values(COULEURS_DES_ATTRIBUTS)) assert.ok(!fiche.toLowerCase().includes(couleur), `${couleur} n’est plus écrite dans fiche.css`);
  assert.equal(cssDesAttributs(), `:root { ${Object.entries(COULEURS_DES_ATTRIBUTS).map(([c, v]) => `--attribut-${c}: ${v};`).join(' ')} }`);
  assert.match(lire('src/pages/fiche/index.astro'), /set:html=\{`\$\{cssDesAttributs\(\)\}\\n\$\{ficheCss\}`\}/, 'la page de la fiche pose les couleurs des attributs');
  const construite = new URL('../dist/fiche/index.html', import.meta.url);
  if (existsSync(construite)) assert.ok(readFileSync(construite, 'utf8').includes(cssDesAttributs()), 'dans la fiche construite');
});

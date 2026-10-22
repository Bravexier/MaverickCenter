// Couleurs du site pour les potions et les attributs (lib/alchimie-couleurs.mjs, lib/attributs-couleurs.mjs ; demande du propriétaire du 2026-10-22 :
// « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du
// classeur. Aucune couleur en dur. » et, pour le texte, « Privilégé la lisibilité. ») : la couleur d'une potion est une règle (l'affinité de son essence,
// ou la caractéristique d'un philtre, nuancée selon son niveau d'alchimie), jamais une couleur relevée ligne par ligne ; les attributs ont une seule
// source, que la fiche lit ; l'onglet Ceinture n'écrit aucune couleur en dur.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  AFFINITE_DES_PHILTRES, ATTRIBUT_DE_L_AFFINITE, CONTRASTE_MINIMAL, COULEURS_DES_AFFINITES, NUANCES_DES_NIVEAUX, baseAvecCouleur, baseDAffinite, caracteristiqueDesCompetences,
  contraste, couleurDAffinite, couleurDePotion, lisible, nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS, cssDesAttributs } from '../src/lib/attributs-couleurs.mjs';
import { COULEURS_CARACTERISTIQUES } from '../src/lib/caracteristiques-postures.mjs';
import { COULEUR_PAR_DEFAUT, couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { classeDesBatons } from '../src/lib/batons-rendu.mjs';
import { htmlDeLigneDePotion } from '../src/lib/ceinture-rendu.mjs';
import { FAMILLES_DE_LA_PALETTE, classeDeCouleur, classeDeMagie, classeDePotion, couleursDeLaPalette } from '../src/lib/palette-css.mjs';
import { chargerObjetsDeCeinture } from '../src/lib/ceinture-db.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase();
const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const HEX = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
const luminance = (hex) => hex.slice(1).match(/.{2}/g).map((c) => parseInt(c, 16)).reduce((n, c) => n + c, 0);

test('une affinité prend la couleur du site : son attribut, sa magie, ou la couleur ajoutée d’après le Doc ; Anti et Démon n’en ont pas', () => {
  for (const [affinite, attribut] of Object.entries(ATTRIBUT_DE_L_AFFINITE)) assert.equal(couleurDAffinite(affinite), COULEURS_DES_ATTRIBUTS[attribut], affinite);
  for (const magie of ['feu', 'eau', 'espace-temps', 'necromancie', 'lumiere']) {
    assert.ok(couleurDeMagieConnue(magie), `${magie} : une magie connue du site`);
    assert.equal(couleurDAffinite(magie), couleurDeMagieConnue(magie), magie);
  }
  for (const [affinite, couleur] of Object.entries(COULEURS_DES_AFFINITES)) assert.equal(couleurDAffinite(affinite), couleur, affinite);
  // la base d'une affinité : la classe de son attribut, de sa magie, ou la sienne (aucune recopie : « Garder séparées » ne veut pas dire recopier)
  assert.deepEqual(baseDAffinite('sante'), { famille: 'attribut', cle: 'sante' });
  assert.deepEqual(baseDAffinite('4eme-barre'), { famille: 'attribut', cle: 'barre4' });
  assert.deepEqual(baseDAffinite('feu'), { famille: 'magie', cle: 'feu' });
  assert.deepEqual(baseDAffinite('coma'), { famille: 'affinite', cle: 'coma' });
  assert.equal(baseDAffinite('anti'), null);
  // une base sans couleur dans sa règle n'est pas une base : la ligne reste neutre, jamais une couleur incalculable (« #NaN »)
  for (const attribut of Object.values(ATTRIBUT_DE_L_AFFINITE)) assert.ok(COULEURS_DES_ATTRIBUTS[attribut], `${attribut} : un attribut qui a sa couleur`);
  assert.equal(baseAvecCouleur({ famille: 'attribut', cle: 'inconnu' }), null, 'un attribut sans couleur');
  assert.equal(baseAvecCouleur({ famille: 'magie', cle: 'inconnue' }), null);
  assert.equal(baseAvecCouleur({ famille: 'affinite', cle: 'anti' }), null);
  assert.equal(baseAvecCouleur({ famille: 'caracteristique', cle: 'constructor' }), null, 'pas une clé héritée');
  assert.equal(baseAvecCouleur({ famille: 'inconnue', cle: 'feu' }), null);
  assert.equal(baseAvecCouleur(null), null);
  assert.deepEqual(baseAvecCouleur({ famille: 'attribut', cle: 'sante' }), { famille: 'attribut', cle: 'sante' });
  for (const essence of ['inconnue', 'constructor', 'toString', 'anti', 'demon']) assert.equal(couleurDePotion({ essence, niveau: 2 }), null, essence);
  assert.equal(couleurDePotion({ essence: AFFINITE_DES_PHILTRES, caracteristique: 'constructor', niveau: 2 }), null);
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

test('la couleur d’une potion : l’affinité de son essence, sinon la caractéristique (philtres seulement), au niveau de son palier ; neutre sinon', () => {
  const attendue = (couleur, base, niveau) => {
    const fond = lisible(nuanceDuNiveau(couleur, niveau));
    return { fond, texte: texteSurCouleur(fond), base, niveau };
  };
  assert.deepEqual(couleurDePotion({ essence: 'sante', niveau: 1 }), attendue(COULEURS_DES_ATTRIBUTS.sante, { famille: 'attribut', cle: 'sante' }, 1));
  assert.deepEqual(couleurDePotion({ essence: 'coma', niveau: 4 }), attendue(COULEURS_DES_AFFINITES.coma, { famille: 'affinite', cle: 'coma' }, 4));
  assert.deepEqual(couleurDePotion({ essence: AFFINITE_DES_PHILTRES, caracteristique: 'force', niveau: 5 }),
    attendue(COULEURS_CARACTERISTIQUES.force, { famille: 'caracteristique', cle: 'force' }, 5));
  assert.deepEqual(couleurDePotion({ essence: 'sante', caracteristique: 'force', niveau: 3 }),
    { fond: COULEURS_DES_ATTRIBUTS.sante, texte: texteSurCouleur(COULEURS_DES_ATTRIBUTS.sante), base: { famille: 'attribut', cle: 'sante' }, niveau: 3 }, 'l’essence d’abord');
  assert.equal(couleurDePotion({ essence: 'feu' }).niveau, null, 'sans niveau : la base, niveau null');
  assert.equal(couleurDePotion({ essence: 'anti', niveau: 2 }), null);
  assert.equal(couleurDePotion({ essence: 'anti', caracteristique: 'volonte', niveau: 2 }), null, 'la caractéristique ne compte que pour un philtre');
  assert.equal(couleurDePotion({ essence: null, caracteristique: 'force', niveau: 2 }), null, 'sans recette : neutre');
  assert.equal(couleurDePotion({ essence: AFFINITE_DES_PHILTRES, caracteristique: 'inconnue', niveau: 2 }), null);
  assert.equal(couleurDePotion(), null);
  // la base est une classe du site, de la famille de sa règle, avec la même couleur (la nuance se calcule depuis elle)
  for (const [essence, caracteristique] of [['sante'], ['feu'], ['coma'], ['chakra+sante'], [AFFINITE_DES_PHILTRES, 'agilite']]) {
    const { base } = couleurDePotion({ essence, caracteristique, niveau: 3 });
    assert.ok(classeDeCouleur(base.famille, base.cle), `${essence} : une classe de la palette`);
    assert.equal(FAMILLES_DE_LA_PALETTE[base.famille][base.cle], couleurDAffinite(essence) ?? COULEURS_CARACTERISTIQUES[caracteristique], essence);
  }
  // la ligne ne porte que la classe de sa combinaison, jamais de style ni de couleur (le texte le plus lisible est dans la classe : « Privilégé la lisibilité. »)
  const p = { id: 'ressources/x#potion:y', nom: 'Y', niveau_id: 'novice', niveau: 'Novice', prix_brut: '2 RO', effet: 'Z', couleur: couleurDePotion({ essence: 'chakra', niveau: 5 }) };
  assert.equal(p.couleur.texte, texteSurCouleur(p.couleur.fond));
  const html = htmlDeLigneDePotion(p);
  assert.ok(html.startsWith('<tr class="ceint-ligne ligne-couleur couleur-potion-attribut-chakra-n5" id="objet-potion-y">'), html.slice(0, 120));
  assert.ok(!/style=|(?<!&)#[0-9a-f]{3,6}\b/i.test(html), 'ni style ni couleur dans la ligne (une entité « &#8239; » n’en est pas une)');
  assert.ok(htmlDeLigneDePotion({ ...p, couleur: null }).startsWith('<tr class="ceint-ligne" id="objet-potion-y">'), 'neutre : sans classe de couleur');
});

test('lisibilité : chaque ligne de potion et de bâton atteint un contraste de 4,5:1 avec son texte ; un fond trop pâle ou trop terne est corrigé', () => {
  assert.equal(CONTRASTE_MINIMAL, 4.5);
  assert.equal(contraste('#ffffff', '#000000').toFixed(0), '21');
  assert.equal(lisible('#c62828'), '#c62828', 'un fond déjà lisible ne change pas');
  for (const terne of ['#897a4c', '#7c7c7c', '#cc5252']) {
    const f = lisible(terne);
    assert.notEqual(f, terne, terne);
    assert.equal(texteSurCouleur(f), texteSurCouleur(terne), `${terne} : le texte ne change pas`);
    assert.ok(contraste(f, texteSurCouleur(f)) >= CONTRASTE_MINIMAL, terne);
  }
  const lignes = chargerObjetsDeCeinture(db).tableaux.flatMap((t) => (t.pages ?? []).flatMap((p) => p.potions)).filter((x) => x.couleur);
  assert.ok(lignes.length > 150, 'les potions colorées');
  for (const x of lignes) {
    const { fond, texte } = x.couleur;
    assert.ok(contraste(fond, texte) >= CONTRASTE_MINIMAL, `${x.nom} : ${fond} / ${texte} = ${contraste(fond, texte).toFixed(2)}`);
  }
  const palette = new Map(couleursDeLaPalette().map((c) => [c.classe, c]));
  for (const m of chargerBatons(db).magies) {
    const { fond, texte } = palette.get(classeDesBatons(m.magie));
    assert.ok(contraste(fond, texte) >= CONTRASTE_MINIMAL, `bâton ${m.magie.nom} : ${fond} / ${texte}`);
  }
});

test('des potions de la base : l’essence de leur recette et la couleur qui en vient', () => {
  const potions = new Map(chargerObjetsDeCeinture(db).tableaux.flatMap((t) => (t.pages ?? []).flatMap((p) => p.potions.map((x) => [x.id, { ...x, page: p }]))));
  const de = (id) => potions.get(id) ?? assert.fail(`potion absente : ${id}`);
  // les recettes ne se modifient pas sur le site de dev : leur essence est celle de l'import
  for (const [id, essence] of [
    ['ressources/fiole-rouge#potion:petite-fiole-rouge', 'sante'],
    ['ressources/fiole-verte-fonce#potion:super-fiole-verte-foncee', '4eme-barre'], // variantes : 4ème barre, puis Régénération santé
    ['ressources/remede-surcharge#potion:remede-de-surcharge-majeur', 'regeneration-chakra'], // variantes : Régénération chakra, puis Corruption
    ['ressources/panacee#potion:panacee-majeur', 'universelle'],
    ['ressources/remede-enrage#potion:remede-enrage-mineur', 'anti'],
    ['ressources/philtre-du-puissant#potion:ultime-philtre-du-puissant', AFFINITE_DES_PHILTRES],
  ]) {
    const x = de(id);
    assert.equal(x.essence, essence, id);
    assert.deepEqual(x.couleur, couleurDePotion({ essence, caracteristique: x.page.caracteristique, niveau: x.niveau_rang }), id);
  }
  assert.equal(de('ressources/remede-enrage#potion:remede-enrage-mineur').couleur, null, 'Anti : neutre');
  // l'ultime philtre n'écrit pas « compétences de Force » (« +1 Force ») : sa page la lui donne ; à l'import, les autres paliers la nomment
  const historique = historiqueSite(db);
  const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
  const page = de('ressources/philtre-du-puissant#potion:ultime-philtre-du-puissant').page;
  const aLImport = (x) => caracteristiqueDesCompetences(historique.valeurDImport('potion', { ressource_id: x.id }, 'effet', x.effet), caracteristiques);
  assert.equal(aLImport(page.potions.find((x) => x.niveau_rang === 5)), null, 'l’ultime ne la nomme pas');
  assert.deepEqual([...new Set(page.potions.filter((x) => x.niveau_rang < 5).map(aLImport))], ['force'], 'les autres paliers nomment la Force');
});

test('les bâtons : la classe de leur magie sur le site (sa couleur et le texte le plus lisible)', () => {
  const palette = new Map(couleursDeLaPalette().map((c) => [c.classe, c]));
  for (const nom of ['Sang', 'Feu', 'Eau', 'Corruption']) {
    assert.equal(classeDesBatons({ id: 'magies/x', nom }), classeDeMagie(nom));
    const { fond, texte } = palette.get(classeDesBatons({ id: 'magies/x', nom }));
    assert.deepEqual({ fond, texte }, { fond: couleurDeMagie(nom), texte: texteSurCouleur(couleurDeMagie(nom)) }, nom);
  }
  // chaque magie des bâtons est connue du site (aucune ne tombe sur la couleur par défaut)
  for (const m of chargerBatons(db).magies) assert.notEqual(palette.get(classeDesBatons(m.magie)).fond, COULEUR_PAR_DEFAUT, m.magie.nom);
  assert.equal(classeDePotion(null), null);
});

test('aucune couleur en dur : ni dans l’onglet Ceinture, ni dans la règle des potions au-delà des couleurs ajoutées, ni pour les attributs (fiche, bestiaire)', () => {
  for (const f of ['src/styles/ceinture/ceinture.css', 'src/lib/ceinture-rendu.mjs', 'src/lib/ceinture-db.mjs', 'src/lib/batons-rendu.mjs',
    'src/components/ceinture/CeinturePanneau.astro', 'src/components/ceinture/BatonsMagiques.astro', 'src/lib/palette-css.mjs']) {
    assert.deepEqual(lire(f).match(HEX) ?? [], [], f);
  }
  assert.ok(!existsSync(new URL('../src/lib/ceinture-couleurs.mjs', import.meta.url)), 'plus de couleurs relevées ligne par ligne');
  // la règle des potions n'écrit que les couleurs qu'elle ajoute au site (une par affinité sans règle)
  const ecrites = [...lire('src/lib/alchimie-couleurs.mjs').matchAll(HEX)].map((m) => m[0].toLowerCase());
  assert.deepEqual([...new Set(ecrites)].sort(), [...new Set(Object.values(COULEURS_DES_AFFINITES))].sort());
  // les attributs : une seule source, posée sur chaque page par layouts/Base.astro, que lisent la fiche et le bestiaire (ils ne les écrivent plus)
  const fiche = lire('src/styles/fiche/fiche.css');
  for (const cle of Object.keys(COULEURS_DES_ATTRIBUTS)) assert.match(fiche, new RegExp(`\\.attribut\\[data-a='${cle}'\\] \\{ --a: var\\(--attribut-${cle}\\); \\}`), cle);
  const carte = lire('src/styles/bestiaire/carte.css');
  for (const cle of ['sante', 'chakra', 'barriere']) assert.match(carte, new RegExp(`\\.bstat--${cle} \\{ border-color: color-mix\\(in srgb, var\\(--attribut-${cle}\\) `), `bestiaire : ${cle}`);
  for (const [f, css] of [['fiche.css', fiche], ['carte.css', carte]]) {
    for (const couleur of Object.values(COULEURS_DES_ATTRIBUTS)) assert.ok(!css.toLowerCase().includes(couleur), `${couleur} n’est plus écrite dans ${f}`);
  }
  assert.ok(!/\.bstat--(?:sante|chakra|barriere) \{[^}]*#/.test(carte), 'le bestiaire n’écrit plus ses propres couleurs d’attributs');
  assert.equal(cssDesAttributs(), `:root { ${Object.entries(COULEURS_DES_ATTRIBUTS).map(([c, v]) => `--attribut-${c}: ${v};`).join(' ')} }`);
  assert.match(lire('src/layouts/Base.astro'), /<style is:inline set:html=\{cssDesAttributs\(\)\}><\/style>/, 'chaque page pose les couleurs des attributs');
  for (const page of ['fiche', 'bestiaire']) {
    const construite = new URL(`../dist/${page}/index.html`, import.meta.url);
    if (existsSync(construite)) assert.ok(readFileSync(construite, 'utf8').includes(cssDesAttributs()), `dans la page construite : /${page}/`);
  }
});

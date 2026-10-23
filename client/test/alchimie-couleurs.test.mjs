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
  AFFINITE_DES_PHILTRES, ATTRIBUT_DE_L_AFFINITE, CONTRASTE_MINIMAL, COULEURS_CHOISIES_PAR_PAGE, COULEURS_DES_AFFINITES, MAGIE_DE_L_AFFINITE, NUANCES_DES_NIVEAUX, NUANCES_D_UNE_BASE_BLANCHE, baseAvecCouleur, baseDAffinite,
  baseChoisieDeLaPage, caracteristiqueDesCompetences,
  contraste, couleurDAffinite, couleurDePotion, lisible, nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS, couleurDAttribut, cssDesAttributs } from '../src/lib/attributs-couleurs.mjs';
import { COULEURS_CARACTERISTIQUES } from '../src/lib/caracteristiques-postures.mjs';
import { COULEURS_DES_MAGIES, COULEUR_PAR_DEFAUT, couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { classeDesBatons } from '../src/lib/batons-rendu.mjs';
import { htmlDeLigneDePotion } from '../src/lib/ceinture-rendu.mjs';
import { FAMILLES_DE_LA_PALETTE, classeDAffinite, classeDAttribut, classeDeCouleur, classeDeMagie, classeDePotion, couleursDeLaPalette } from '../src/lib/palette-css.mjs';
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
  assert.deepEqual(baseDAffinite('4eme-barre'), { famille: 'magie', cle: 'necromancie' }, 'la 4ᵉ barre : la Nécromancie (demande du propriétaire du 2026-10-23)');
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

test('la 4ᵉ barre prend la couleur de la Nécromancie (sa classe, sans couleur ajoutée) ; l’attribut barre4 n’a plus de couleur à lui', () => {
  // demande du propriétaire du 2026-10-23 : « La fiole verte foncée devrai avoir la couleur verte foncée en s'inspirant de la couleur de la nécromancie. »
  assert.deepEqual(MAGIE_DE_L_AFFINITE, { '4eme-barre': 'necromancie' });
  const affinites = new Set(db.prepare('SELECT id FROM affinite').all().map((a) => a.id));
  for (const [affinite, magie] of Object.entries(MAGIE_DE_L_AFFINITE)) {
    assert.ok(affinites.has(affinite), `${affinite} : une affinité de la base`);
    assert.ok(!Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, affinite) && !Object.hasOwn(COULEURS_DES_AFFINITES, affinite), `${affinite} : une seule règle`);
    assert.equal(couleurDeMagieConnue(affinite), null, `${affinite} : pas déjà une magie`);
    assert.ok(couleurDeMagieConnue(magie), `${magie} : une magie connue du site`);
    assert.deepEqual(baseDAffinite(affinite), { famille: 'magie', cle: magie });
    assert.equal(couleurDAffinite(affinite), couleurDeMagieConnue(magie), affinite);
    assert.equal(classeDAffinite(affinite), classeDeMagie(magie), `${affinite} : la classe de la magie`);
  }
  for (const niveau of [2, 3, 4, 5]) {
    const c = couleurDePotion({ essence: '4eme-barre', niveau });
    assert.deepEqual(c.base, { famille: 'magie', cle: 'necromancie' });
    assert.equal(classeDePotion(c), `couleur-potion-magie-necromancie-n${niveau}`);
    assert.equal(c.fond, lisible(nuanceDuNiveau(couleurDeMagieConnue('necromancie'), niveau)), `n${niveau} : la nuance de la Nécromancie`);
    assert.ok(contraste(c.fond, c.texte) >= CONTRASTE_MINIMAL, `n${niveau}`);
  }
  // les pages d'essence 4ᵉ barre sont celles que le propriétaire a demandées en Nécromancie : la Fiole verte foncée, « Le remède du poison couleur
  // nécromancie », « L'huile toxique devrait être couleur nécromancie » (2026-10-23)
  const pages = chargerObjetsDeCeinture(db).tableaux.flatMap((t) => t.pages ?? []);
  const de4emeBarre = pages.filter((p) => p.potions.some((x) => x.essence === '4eme-barre'));
  assert.deepEqual(de4emeBarre.map((p) => p.id).sort(), ['ressources/fiole-verte-fonce', 'ressources/huile-toxique', 'ressources/remede-poison']);
  for (const x of de4emeBarre.flatMap((p) => p.potions)) assert.equal(classeDePotion(x.couleur), `couleur-potion-magie-necromancie-n${x.niveau_rang}`, x.id);
  // la 4ᵉ barre de la fiche n'a plus de couleur d'attribut : elle prend la classe de la magie qui la donne, Sang ou Nécromancie (demande du
  // propriétaire du 2026-10-23 : « La 4eme barre doit être de couleur différente en fonction de la magie qui l'utilise (Sang ou nécromancie) » ;
  // test/fiche-moteur.test.mjs) ; plus aucune potion ne la lisait
  assert.equal(couleurDAttribut('barre4'), null);
  assert.ok(!Object.hasOwn(FAMILLES_DE_LA_PALETTE.attribut, 'barre4'));
  assert.equal(classeDAttribut('barre4'), null);
  assert.ok(!cssDesAttributs().includes('--attribut-barre4'));
  assert.match(lire('src/styles/fiche/fiche.css'), /\.attribut\[data-a='barre4'\]\[class\*='couleur-magie-'\] \{ --a: var\(--couleur\); \}/);
  assert.ok(!lire('src/styles/fiche/fiche.css').includes('--attribut-barre4'), 'fiche.css ne lit plus la couleur retirée');
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

test('une base blanche (la magie du Vide) : blanche jusqu’à Apprenti, puis un cran plus sombre à chaque palier ; toute autre base inchangée', () => {
  // réponse du propriétaire du 2026-10-23 à « Faut-il un palier visible entre Apprenti et Avancé ? » (Remède enragé et Huile rage, couleur du Vide) :
  // « Dégradé visible » ; puis, à « Dégradé visible du Vide (Remède enragé, Huile rage) : Apprenti #ffffff (blanc), Avancé #e6e6e6 (gris très clair),
  // Expert #cccccc (gris clair) ; et Maître #999999 si une potion en Vide en avait un. Le texte reste foncé et lisible. Ces teintes vous conviennent ? » :
  // « Oui, les garder » (NUANCES_D_UNE_BASE_BLANCHE ; valeurs écrites ici, validées)
  const blanc = COULEURS_DES_MAGIES.vide;
  assert.equal(blanc.toLowerCase(), '#ffffff', 'le Vide est le blanc pur');
  const rangs = [1, 2, 3, 4, 5];
  assert.deepEqual(JSON.parse(JSON.stringify(NUANCES_D_UNE_BASE_BLANCHE)),
    { 1: null, 2: null, 3: { vers: 'noir', part: 0.1 }, 4: { vers: 'noir', part: 0.2 }, 5: { vers: 'noir', part: 0.4 } }, 'une nuance par niveau');
  const nuances = rangs.map((r) => nuanceDuNiveau(blanc, r));
  assert.deepEqual(nuances, ['#ffffff', '#ffffff', '#e6e6e6', '#cccccc', '#999999']);
  // rien n'est plus clair que le blanc : Novice et Apprenti le restent ; d'Apprenti à Maître, chaque palier est plus sombre que le précédent
  for (let i = 2; i < nuances.length; i++) assert.ok(luminance(nuances[i]) < luminance(nuances[i - 1]), `${rangs[i]} plus sombre que ${rangs[i - 1]}`);
  for (const r of rangs) {
    const c = couleurDePotion({ page: 'ressources/huile-rage', niveau: r });
    assert.equal(c.fond, nuances[r - 1], `n${r} : la nuance reste telle quelle (déjà lisible)`);
    assert.equal(c.texte, texteSurCouleur('#ffffff'), `n${r} : texte foncé`);
    assert.ok(contraste(c.fond, c.texte) >= CONTRASTE_MINIMAL, `n${r}`);
  }
  // toute autre base suit la règle d'avant, au bit près : ses parts écrites ici (pas lues dans le module), recalculées pour chaque base
  const PARTS_D_AVANT = { 1: { vers: 'blanc', part: 0.7 }, 2: { vers: 'blanc', part: 0.45 }, 3: null, 4: { vers: 'noir', part: 0.2 }, 5: { vers: 'noir', part: 0.4 } };
  assert.deepEqual(JSON.parse(JSON.stringify(NUANCES_DES_NIVEAUX)), PARTS_D_AVANT, 'les nuances de toute autre base, inchangées');
  for (const [base, attendues] of [['#c62828', ['#eebfbf', '#e08989', '#c62828', '#9e2020', '#771818']],
    ['#1e5bb8', ['#bcceea', '#83a5d8', '#1e5bb8', '#184993', '#12376e']], ['#e0b000', ['#f6e7b3', '#eed473', '#e0b000', '#b38d00', '#866a00']]]) {
    assert.deepEqual(rangs.map((r) => nuanceDuNiveau(base, r)), attendues, `${base} : ses cinq teintes`);
  }
  const avant = (base, rang) => {
    const n = PARTS_D_AVANT[rang];
    if (!n) return base;
    const cible = n.vers === 'blanc' ? 255 : 0;
    return `#${base.slice(1).match(/.{2}/g).map((c) => Math.round(parseInt(c, 16) * (1 - n.part) + cible * n.part).toString(16).padStart(2, '0')).join('')}`;
  };
  const bases = [...Object.values(COULEURS_DES_MAGIES), COULEUR_PAR_DEFAUT, ...Object.values(COULEURS_DES_ATTRIBUTS), ...Object.values(COULEURS_DES_AFFINITES),
    ...Object.values(COULEURS_CARACTERISTIQUES), ...couleursDeLaPalette().map((c) => c.fond)];
  const autres = [...new Set(bases.map((b) => b.toLowerCase()))].filter((b) => b !== '#ffffff');
  assert.ok(autres.length > 40, `${autres.length} bases`);
  for (const base of autres) for (const r of [...rangs, 9]) assert.equal(nuanceDuNiveau(base, r), avant(base, r), `${base} n${r}`);
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
    assert.deepEqual(x.couleur, couleurDePotion({ page: x.page.id, essence, caracteristique: x.page.caracteristique, niveau: x.niveau_rang }), id);
  }
  assert.equal(couleurDePotion({ essence: 'anti', niveau: 2 }), null, 'Anti, hors des pages choisies : neutre');
  // les quatre paliers de la Fiole verte foncée : la Nécromancie, nuancée à leur niveau (demande du propriétaire du 2026-10-23)
  for (const [palier, rang] of [['fiole-verte-foncee-moyenne', 2], ['super-fiole-verte-foncee', 3], ['mega-fiole-verte-foncee', 4], ['ultime-fiole-verte-foncee', 5]]) {
    const x = de(`ressources/fiole-verte-fonce#potion:${palier}`);
    assert.equal(x.niveau_rang, rang, palier);
    assert.equal(classeDePotion(x.couleur), `couleur-potion-magie-necromancie-n${rang}`, palier);
  }
  // l'ultime philtre n'écrit pas « compétences de Force » (« +1 Force ») : sa page la lui donne ; à l'import, les autres paliers la nomment
  const historique = historiqueSite(db);
  const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
  const page = de('ressources/philtre-du-puissant#potion:ultime-philtre-du-puissant').page;
  const aLImport = (x) => caracteristiqueDesCompetences(historique.valeurDImport('potion', { ressource_id: x.id }, 'effet', x.effet), caracteristiques);
  assert.equal(aLImport(page.potions.find((x) => x.niveau_rang === 5)), null, 'l’ultime ne la nomme pas');
  assert.deepEqual([...new Set(page.potions.filter((x) => x.niveau_rang < 5).map(aLImport))], ['force'], 'les autres paliers nomment la Force');
});

test('les couleurs choisies par le propriétaire, page par page (2026-10-23) : la magie qu’il nomme, avant l’essence ; une autre page de même essence garde la sienne', () => {
  // ses retours, carte par carte : « Le remède enragé est de la couleur du Vide » ; « Le remêde du saignement devrai être couleur sang » ; « Le remêde
  // brûlure devrai couleur feu » ; « L'huile rage devrai être couleur du Vide » ; « L'huile séraphine couleur feu » ; puis, à « L'Huile hémophile
  // (inflige saignement, rouge-orangé #cc4125) passe-t-elle en Sang comme le Remède saignement ? » : « Huile hémophile → Sang »
  const attendues = {
    'ressources/remede-enrage': 'vide', 'ressources/remede-saignement': 'sang', 'ressources/remede-brulure': 'feu',
    'ressources/huile-rage': 'vide', 'ressources/huile-seraphine': 'feu', 'ressources/huile-hemophile': 'sang',
  };
  assert.deepEqual(Object.fromEntries(Object.entries(COULEURS_CHOISIES_PAR_PAGE)),
    Object.fromEntries(Object.entries(attendues).map(([p, m]) => [p, { famille: 'magie', cle: m }])));
  const pages = new Map(chargerObjetsDeCeinture(db).tableaux.flatMap((t) => t.pages ?? []).map((p) => [p.id, p]));
  for (const [page, magie] of Object.entries(attendues)) {
    assert.ok(couleurDeMagieConnue(magie), `${magie} : une magie du site (sa classe, aucune couleur ajoutée)`);
    assert.deepEqual(baseChoisieDeLaPage(page), { famille: 'magie', cle: magie });
    const p = pages.get(page) ?? assert.fail(`page absente : ${page}`);
    assert.ok(p.potions.length >= 3, `${page} : ses paliers`);
    for (const x of p.potions) {
      assert.deepEqual(x.couleur.base, { famille: 'magie', cle: magie }, x.id);
      assert.equal(classeDePotion(x.couleur), `couleur-potion-magie-${magie}-n${x.niveau_rang}`, x.id);
      assert.equal(x.couleur.fond, lisible(nuanceDuNiveau(couleurDeMagieConnue(magie), x.niveau_rang)), `${x.id} : le dégradé du niveau`);
      assert.ok(contraste(x.couleur.fond, x.couleur.texte) >= CONTRASTE_MINIMAL, x.id);
    }
  }
  assert.equal(baseChoisieDeLaPage('ressources/fiole-rouge'), null);
  assert.equal(baseChoisieDeLaPage(null), null);
  assert.equal(baseChoisieDeLaPage('constructor'), null, 'pas une clé héritée');
  // le choix ne change pas la règle de l'essence : une page non citée de même essence garde sa couleur (Santé, Régénération santé, Anti)
  for (const [page, base] of [
    ['ressources/fiole-rouge', { famille: 'attribut', cle: 'sante' }],
    ['ressources/alchimie-primitive', { famille: 'attribut', cle: 'sante' }],
    ['ressources/fiole-bordeaux', { famille: 'affinite', cle: 'regeneration-sante' }],
  ]) {
    const x = pages.get(page).potions.find((y) => y.essence === base.cle) ?? assert.fail(`${page} : une potion d’essence ${base.cle}`);
    assert.deepEqual(x.couleur.base, base, page);
  }
  // toute page d'essence Régénération santé que le propriétaire n'a pas nommée garde la couleur de l'affinité, à chacun de ses paliers (la Fiole
  // bordeaux, seule aujourd'hui : le Remède saignement et l'Huile hémophile sont en Sang)
  const regeneration = [...pages.values()].filter((p) => p.potions.some((x) => x.essence === 'regeneration-sante'));
  assert.ok(regeneration.some((p) => p.id === 'ressources/fiole-bordeaux'), 'la Fiole bordeaux : essence Régénération santé');
  for (const p of regeneration.filter((y) => !Object.hasOwn(attendues, y.id))) {
    for (const x of p.potions) assert.deepEqual(x.couleur.base, { famille: 'affinite', cle: 'regeneration-sante' }, x.id);
  }
  assert.equal(couleurDePotion({ essence: 'anti', niveau: 3 }), null);
  assert.deepEqual(couleurDePotion({ page: 'ressources/autre', essence: 'sante', niveau: 3 }).base, { famille: 'attribut', cle: 'sante' });
  assert.deepEqual(couleurDePotion({ page: 'ressources/remede-brulure', essence: 'sante', niveau: 3 }).base, { famille: 'magie', cle: 'feu' }, 'le choix d’abord');
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

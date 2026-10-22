// La palette du site en classes CSS (lib/palette-css.mjs ; demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site.
// Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. », puis « La classe CSS du
// site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. » ; choix de
// cadrage « Module JS → classe », « Règle de calcul », « Garder séparées ») : une classe par couleur des règles, sa valeur lue dans le module de sa
// règle, lisible (« Privilégé la lisibilité. ») ; les combinaisons des potions calculées depuis leur classe de base ; le module n'écrit aucune couleur.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  FAMILLES_DE_LA_PALETTE, MAGIE_PAR_DEFAUT, classeDAffinite, classeDAttribut, classeDeCaracteristique, classeDeCouleur, classeDeMagie, classeDePotion,
  classeDeSecondeMagie, classesDeDeuxMagies, classesDeLaPalette, couleursDeLaPalette, cssDeLaPalette, cssDesPotions, idDeCouleur, secondsRangsDesMagies,
} from '../src/lib/palette-css.mjs';
import {
  AFFINITE_DES_PHILTRES, ATTRIBUT_DE_L_AFFINITE, CONTRASTE_MINIMAL, COULEURS_DES_AFFINITES, NUANCES_DES_NIVEAUX, contraste, couleurDePotion, lisible,
  nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS } from '../src/lib/attributs-couleurs.mjs';
import { COULEURS_CARACTERISTIQUES } from '../src/lib/caracteristiques-postures.mjs';
import { COULEUR_PAR_DEFAUT, COULEURS_DES_MAGIES, couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const HEX = /(?<!&)#[0-9a-f]{6}\b|(?<!&)#[0-9a-f]{3}\b/gi;
/** Les règles d'une feuille fabriquée : Map(classe → { propriété: valeur }). */
const regles = (css) => new Map([...css.matchAll(/\.([a-z0-9-]+)\{([^}]*)\}/g)].map(([, classe, corps]) =>
  [classe, Object.fromEntries(corps.split(';').filter(Boolean).map((d) => d.split(':')))]));

test('quatre familles, chacune lue dans le module de sa règle : magies (et la couleur par défaut), attributs, caractéristiques, affinités sans autre règle', () => {
  assert.deepEqual(Object.keys(FAMILLES_DE_LA_PALETTE), ['magie', 'attribut', 'caracteristique', 'affinite']);
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.magie, { ...COULEURS_DES_MAGIES, [MAGIE_PAR_DEFAUT]: COULEUR_PAR_DEFAUT });
  assert.equal(FAMILLES_DE_LA_PALETTE.attribut, COULEURS_DES_ATTRIBUTS);
  assert.equal(FAMILLES_DE_LA_PALETTE.caracteristique, COULEURS_CARACTERISTIQUES);
  assert.equal(FAMILLES_DE_LA_PALETTE.affinite, COULEURS_DES_AFFINITES);
  // les caractéristiques : une par ligne de la base (leurs ids sont ceux des classes)
  const db = ouvrirBase();
  assert.deepEqual(Object.keys(COULEURS_CARACTERISTIQUES).sort(), db.prepare('SELECT id FROM caracteristique').all().map((c) => c.id).sort());
});

test('le nom d’une classe : « couleur-<famille>-<id> », l’id = la clé du module normalisée, unique, sans caractère à échapper en CSS', () => {
  assert.equal(classeDeMagie('Feu'), 'couleur-magie-feu');
  assert.equal(classeDeMagie('Espace-Temps'), 'couleur-magie-espace-temps');
  assert.equal(classeDeMagie('potentiel-illimite'), 'couleur-magie-potentiel-illimite');
  assert.equal(classeDeMagie('Lumière'), 'couleur-magie-lumiere');
  assert.equal(classeDeMagie('Inconnue'), `couleur-magie-${MAGIE_PAR_DEFAUT}`, 'une magie inconnue : la couleur par défaut, comme couleurDeMagie');
  assert.equal(classeDAttribut('sante'), 'couleur-attribut-sante');
  assert.equal(classeDAttribut('barre4'), 'couleur-attribut-barre4');
  assert.equal(classeDeCaracteristique('volonte'), 'couleur-caracteristique-volonte');
  assert.equal(classeDeCouleur('affinite', 'chakra+sante'), 'couleur-affinite-chakra-sante');
  assert.equal(idDeCouleur('barriere+chakra'), 'barriere-chakra');
  assert.equal(classeDAttribut('inconnu'), null);
  assert.equal(classeDeCouleur('inconnue', 'feu'), null);
  const classes = couleursDeLaPalette().map((c) => c.classe);
  assert.equal(classes.length, Object.values(FAMILLES_DE_LA_PALETTE).reduce((n, f) => n + Object.keys(f).length, 0));
  assert.equal(new Set(classes).size, classes.length, 'une classe par couleur');
  for (const c of classes) assert.match(c, /^couleur-(?:magie|attribut|caracteristique|affinite)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('pas de recopie : une affinité qui est un attribut ou une magie garde la classe de cet attribut ou de cette magie ; Anti et Démon n’en ont pas', () => {
  for (const [affinite, attribut] of Object.entries(ATTRIBUT_DE_L_AFFINITE)) assert.equal(classeDAffinite(affinite), classeDAttribut(attribut), affinite);
  for (const magie of ['feu', 'eau', 'espace-temps', 'necromancie']) assert.equal(classeDAffinite(magie), classeDeMagie(magie), magie);
  for (const affinite of Object.keys(COULEURS_DES_AFFINITES)) {
    assert.equal(classeDAffinite(affinite), `couleur-affinite-${idDeCouleur(affinite)}`, affinite);
    assert.ok(!Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, affinite) && couleurDeMagieConnue(affinite) === null, `${affinite} : le site n’avait pas de règle`);
  }
  assert.equal(classeDAffinite('anti'), null);
  assert.equal(classeDAffinite('demon'), null);
});

test('la valeur de chaque classe est celle de sa règle, et son texte le plus lisible dessus atteint un contraste de 4,5:1', () => {
  const feuille = regles(cssDeLaPalette());
  assert.equal(feuille.size, couleursDeLaPalette().length + secondsRangsDesMagies().length, 'une règle par classe (couleurs, puis seconds rangs)');
  for (const { famille, cle, classe, fond, texte } of couleursDeLaPalette()) {
    assert.equal(fond, FAMILLES_DE_LA_PALETTE[famille][cle], classe);
    assert.equal(texte, texteSurCouleur(fond), classe);
    assert.deepEqual(feuille.get(classe), { '--couleur': fond, '--couleur-texte': texte }, classe);
    assert.ok(contraste(fond, texte) >= CONTRASTE_MINIMAL, `${classe} : ${fond} / ${texte} = ${contraste(fond, texte).toFixed(2)}`);
  }
  assert.deepEqual(feuille.get(classeDeMagie('Sang')), { '--couleur': couleurDeMagie('Sang'), '--couleur-texte': texteSurCouleur(couleurDeMagie('Sang')) });
  assert.deepEqual(feuille.get(classeDAttribut('chakra')), { '--couleur': COULEURS_DES_ATTRIBUTS.chakra, '--couleur-texte': texteSurCouleur(COULEURS_DES_ATTRIBUTS.chakra) });
});

test('les combinaisons des potions : la base (une classe du site) et le niveau ; leur feuille, celles demandées seulement, calculées par la règle, lisibles', () => {
  const sante1 = couleurDePotion({ essence: 'sante', niveau: 1 });
  assert.equal(classeDePotion(sante1), 'couleur-potion-attribut-sante-n1');
  assert.equal(classeDePotion(couleurDePotion({ essence: 'chakra+sante', niveau: 4 })), 'couleur-potion-affinite-chakra-sante-n4');
  assert.equal(classeDePotion(couleurDePotion({ essence: AFFINITE_DES_PHILTRES, caracteristique: 'force', niveau: 2 })), 'couleur-potion-caracteristique-force-n2');
  assert.equal(classeDePotion(couleurDePotion({ essence: 'feu' })), 'couleur-potion-magie-feu-n0', 'sans niveau');
  assert.equal(classeDePotion(null), null);
  assert.equal(classeDePotion(couleurDePotion({ essence: 'anti', niveau: 2 })), null);
  // la feuille d'une page : une règle par combinaison qu'elle affiche, dans l'ordre, sans doublon ; une ligne neutre n'en demande pas
  const css = cssDesPotions([sante1, null, couleurDePotion({ essence: 'sante', niveau: 1 }), couleurDePotion({ essence: 'coma', niveau: 5 })]);
  assert.deepEqual([...regles(css).keys()], ['couleur-potion-attribut-sante-n1', 'couleur-potion-affinite-coma-n5']);
  assert.deepEqual(regles(css).get('couleur-potion-attribut-sante-n1'), { '--ligne-fond': sante1.fond, '--ligne-texte': sante1.texte });
  assert.equal(cssDesPotions([]), '');
  // chaque combinaison possible (toute essence des recettes d'alchimie, toute caractéristique d'un philtre, tout niveau) : sa base est une classe de la
  // palette, de la même couleur, et la combinaison est lisible
  const db = ouvrirBase();
  const essences = db.prepare("SELECT DISTINCT ri.affinite_id AS id FROM recette r JOIN recette_ingredient ri ON ri.recette_id = r.id WHERE r.genre = 'alchimie' AND ri.role = 'essence'")
    .all().map((e) => e.id);
  const cas = [...essences.map((essence) => ({ essence })), ...Object.keys(COULEURS_CARACTERISTIQUES).map((caracteristique) => ({ essence: AFFINITE_DES_PHILTRES, caracteristique }))];
  const palette = new Map(couleursDeLaPalette().map((c) => [c.classe, c]));
  let combinaisons = 0;
  for (const c of cas) for (const niveau of [...Object.keys(NUANCES_DES_NIVEAUX).map(Number), null]) {
    const couleur = couleurDePotion({ ...c, niveau });
    if (!couleur) continue;
    combinaisons++;
    const base = palette.get(classeDeCouleur(couleur.base.famille, couleur.base.cle));
    assert.ok(base, `${c.essence} : sa base est une classe de la palette`);
    assert.equal(couleur.fond, lisible(nuanceDuNiveau(base.fond, niveau)), `${classeDePotion(couleur)} : calculée depuis la couleur de sa classe de base`);
    assert.ok(contraste(couleur.fond, couleur.texte) >= CONTRASTE_MINIMAL, `${classeDePotion(couleur)} : ${couleur.fond} / ${couleur.texte}`);
  }
  assert.ok(combinaisons > 100, `${combinaisons} combinaisons`);
});

test('aucune couleur écrite dans le module de la palette ; la palette posée sur chaque page par layouts/Base.astro, d’un poids borné', () => {
  assert.deepEqual(lire('src/lib/palette-css.mjs').match(HEX) ?? [], []);
  assert.match(lire('src/layouts/Base.astro'), /<style is:inline set:html=\{cssDeLaPalette\(\)\}><\/style>/);
  // le poids ajouté à chaque page : environ 3,3 ko aujourd'hui (37 classes et les 16 de second rang des magies) ; au-delà de 4 ko, revoir la manière de
  // l'émettre
  assert.ok(cssDeLaPalette().length < 4000, `${cssDeLaPalette().length} octets`);
});

const construit = existsSync(new URL('../dist/index.html', import.meta.url));
test('la palette dans les pages construites', construit ? {} : { skip: 'site non construit (npm run build)' }, () => {
  for (const page of ['index.html', 'ressources/equipement/index.html', 'fiche/index.html']) {
    const construite = new URL(`../dist/${page}`, import.meta.url);
    assert.ok(existsSync(construite), `page construite : ${page}`);
    assert.ok(readFileSync(construite, 'utf8').includes(`<style>${cssDeLaPalette()}</style>`), `dans la page construite : ${page}`);
  }
});

/** Le corps de la règle CSS d'un sélecteur (écrit tel quel, au début d'une ligne), sans les retours à la ligne. */
const regleDe = (css, selecteur) => {
  const debut = css.indexOf(`\n${selecteur} {`);
  assert.ok(debut >= 0, `règle absente : ${selecteur}`);
  return css.slice(css.indexOf('{', debut) + 1, css.indexOf('}', debut)).replace(/\s+/g, ' ');
};

/** Les couleurs nommées de CSS (sans `transparent` ni `currentColor`, qui n'en sont pas). */
const COULEURS_NOMMEES = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue '
  + 'chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta '
  + 'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink '
  + 'deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey '
  + 'honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow '
  + 'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime '
  + 'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen '
  + 'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid '
  + 'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue '
  + 'saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle '
  + 'tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));

/** L'indice de la parenthèse qui ferme celle ouverte en `ouvrante`. */
const fermante = (texte, ouvrante) => {
  let profondeur = 0;
  for (let i = ouvrante; i < texte.length; i++) {
    if (texte[i] === '(') profondeur++;
    else if (texte[i] === ')' && --profondeur === 0) return i;
  }
  return texte.length - 1;
};
/** Le texte sans ses `var(…)` (imbriqués compris). */
const sansVariables = (texte) => {
  let reste = texte;
  for (let m = reste.indexOf('var('); m >= 0; m = reste.indexOf('var(')) reste = reste.slice(0, m) + reste.slice(fermante(reste, m + 3) + 1);
  return reste;
};

/**
 * Les couleurs écrites d'un texte, hors la seule exception admise (réponse du propriétaire du 2026-10-22 à « Ce noir ou ce blanc de mélange compte-t-il
 * comme une « couleur en dur » ? » : « Non, exception (Recommandé) » ; option : « Le noir et le blanc purs servant à assombrir ou éclaircir restent
 * écrits ; l'exception est notée dans la règle des couleurs du site. ») : `#000`, `#fff`, `#000000`, `#ffffff` comme argument d'un `color-mix(…)`.
 * Comptent : un hex ; une fonction de couleur (`rgb()`, `hsl()`, `oklch()`…) dont un argument est écrit, hors `var(…)` ; et, avec `nommees` (une
 * feuille CSS : ni du français ni du code), une couleur nommée dans la valeur d'une déclaration, commentaires retirés. Une teinte écrite dans une
 * variable (`--gh: 5`, lue par `hsl(var(--gh) …)`) ne se voit pas : seule la fonction qui la lit, si elle écrit un autre argument.
 */
const couleursEcrites = (texte, { nommees = false } = {}) => {
  const css = nommees ? texte.replace(/\/\*[\s\S]*?\*\//g, '') : texte;
  let reste = '';
  let i = 0;
  for (let m = css.indexOf('color-mix(', i); m >= 0; m = css.indexOf('color-mix(', i)) {
    const fin = fermante(css, m + 'color-mix'.length);
    reste += css.slice(i, m) + css.slice(m, fin + 1).replace(/(?<=[\s,(])#(?:000|fff|000000|ffffff)(?![0-9a-f])/gi, '');
    i = fin + 1;
  }
  reste += css.slice(i);
  const ecrites = reste.match(HEX) ?? [];
  for (const m of reste.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi)) {
    const ouvrante = m.index + m[0].length - 1;
    const appel = reste.slice(m.index, fermante(reste, ouvrante) + 1);
    if (/\d/.test(sansVariables(appel.slice(m[0].length, -1)))) ecrites.push(appel);
  }
  if (nommees) {
    for (const [, valeur] of reste.matchAll(/:([^;{}]*)(?=[;}])/g)) {
      for (const mot of valeur.match(/(?<![\w-])[a-z]+(?![\w-])/gi) ?? []) if (COULEURS_NOMMEES.has(mot.toLowerCase())) ecrites.push(mot);
    }
  }
  return ecrites;
};
/** Les couleurs écrites d'un fichier du site (les couleurs nommées dans une feuille CSS seulement). */
const couleursDuFichier = (f) => couleursEcrites(lire(f), { nommees: f.endsWith('.css') });

test('l’exception des couleurs écrites : le noir ou le blanc purs de mélange d’un color-mix, rien d’autre', () => {
  assert.deepEqual(couleursEcrites('a { border: 1px solid color-mix(in srgb, var(--x) 65%, #000); b: color-mix(in srgb, #FFFFFF 20%, var(--y)); }'), []);
  assert.deepEqual(couleursEcrites('a { color: #000; }'), ['#000'], 'hors d’un color-mix');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, var(--x) 65%, #111); }'), ['#111'], 'pas un noir pur');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, var(--x) 65%, #0000ff); }'), ['#0000ff'], 'pas un noir de six chiffres suivi d’autres');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, color-mix(in srgb, #fff 5%, var(--x)) 65%, #c62828); }'), ['#c62828'], 'mélange imbriqué');
  // les fonctions de couleur : un argument écrit hors variable, même dans un color-mix (l'exception ne vaut que pour #000 et #fff)
  assert.deepEqual(couleursEcrites('a { color: rgb(255 0 0); b: rgba(0, 0, 0, 0.08); }'), ['rgb(255 0 0)', 'rgba(0, 0, 0, 0.08)']);
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, var(--x) 10%, rgb(0 0 0)); }'), ['rgb(0 0 0)']);
  assert.deepEqual(couleursEcrites('a { color: hsl(var(--gh) var(--gs) 50%); }'), ['hsl(var(--gh) var(--gs) 50%)'], 'une teinte en variable, une clarté écrite');
  assert.deepEqual(couleursEcrites('a { color: hsl(var(--h) var(--s) var(--l, var(--m))); b: oklch(var(--x)); }'), [], 'toute en variables');
  // les couleurs nommées : dans la valeur d'une déclaration d'une feuille, commentaires retirés
  assert.deepEqual(couleursEcrites('a { color: white; border: 1px solid Red; }', { nommees: true }), ['white', 'Red']);
  assert.deepEqual(couleursEcrites('/* rouge : red */ .red-x, a.white { --red: var(--tan-x); b: transparent; c: currentColor; font: italic 700 0.8rem/1 Georgia, serif; }', { nommees: true }), [],
    'ni un commentaire, ni un sélecteur, ni un nom de variable, ni transparent ou currentColor, ni une police');
  assert.deepEqual(couleursEcrites('a { color: white; }'), [], 'sans `nommees` (un texte qui n’est pas une feuille), les mots ne comptent pas');
});

test('les feuilles lisent les propriétés que posent les classes : bâtons (ceinture.css), pastille de la gemme (equipement.css), ligne colorée (tableaux.css)', () => {
  // les noms des propriétés, lus dans les feuilles fabriquées : un renommage dans palette-css.mjs doit se voir ici
  const [palette] = regles(cssDeLaPalette()).values();
  assert.deepEqual(Object.keys(palette), ['--couleur', '--couleur-texte']);
  const [fond, texte] = Object.keys(palette);
  const [potion] = regles(cssDesPotions([couleurDePotion({ essence: 'sante', niveau: 2 })])).values();
  assert.deepEqual(Object.keys(potion), ['--ligne-fond', '--ligne-texte']);
  const [ligneFond, ligneTexte] = Object.keys(potion);
  // une ligne de bâtons : la classe de la magie → ses variables, la ligne colorée du gabarit et la teinte des infobulles (--mag)
  const ceinture = lire('src/styles/ceinture/ceinture.css');
  assert.equal(regleDe(ceinture, '.batons-table tr.baton'),
    ` --baton-fond: var(${fond}); --baton-texte: var(${texte}); ${ligneFond}: var(--baton-fond); ${ligneTexte}: var(--baton-texte); --mag: var(--baton-fond); `);
  assert.match(lire('src/components/ceinture/BatonsMagiques.astro'), /classeTable="batons-table"/, 'le tableau des bâtons porte la classe que lit la règle');
  // la pastille de la gemme : la classe de la magie, dans les accessoires comme dans les bâtons (plus de `--g` en style)
  const equipement = lire('src/styles/equipement/equipement.css');
  const pastille = regleDe(equipement, '.acc-gemme');
  assert.ok(pastille.includes(`--gemme: var(${fond});`), pastille);
  assert.ok(pastille.includes('background: var(--gemme);'), pastille);
  assert.ok(pastille.includes(`color: var(${texte});`), pastille);
  assert.ok(!/--g\b|--g-texte/.test(equipement), 'plus de --g ni de --g-texte');
  assert.deepEqual(couleursEcrites(pastille), [], 'la pastille n’écrit que le noir de mélange de son liseré');
  // la ligne colorée du gabarit commun lit les propriétés des combinaisons
  assert.match(lire('src/styles/global/tableaux.css'), new RegExp(`:where\\(\\.table-donnees\\) tr\\.ligne-couleur > \\* \\{ background: var\\(${ligneFond}\\); color: var\\(${ligneTexte}\\); \\}`));
  // les fichiers de l'onglet Ceinture n'écrivent aucune couleur, hors l'exception du mélange
  for (const f of ['src/styles/ceinture/ceinture.css', 'src/components/ceinture/CeinturePanneau.astro', 'src/components/ceinture/BatonsMagiques.astro']) {
    assert.deepEqual(couleursDuFichier(f), [], f);
  }
});

// Lot des magies (2026-10-22, même demande et mêmes choix de cadrage) : toute couleur de magie posée par une page passe par la classe de sa magie.

test('deux magies sur un même élément : la classe de la première, puis la classe de second rang de la seconde (--couleur-2), de la même quand il n’y en a qu’une', () => {
  assert.equal(classeDeSecondeMagie('Eau'), 'couleur-2-magie-eau');
  assert.equal(classeDeSecondeMagie('Espace/Temps'), 'couleur-2-magie-espace-temps');
  assert.equal(classeDeSecondeMagie('Inconnue'), `couleur-2-magie-${MAGIE_PAR_DEFAUT}`, 'une magie inconnue : la couleur par défaut, comme classeDeMagie');
  assert.deepEqual(classesDeDeuxMagies('Terre', 'Feu'), ['couleur-magie-terre', 'couleur-2-magie-feu']);
  assert.deepEqual(classesDeDeuxMagies('Terre'), ['couleur-magie-terre', 'couleur-2-magie-terre'], 'une seule magie : la même au second rang (rien n’est hérité d’un parent)');
  assert.deepEqual(classesDeDeuxMagies('Terre', null), classesDeDeuxMagies('Terre'));
  // une classe de second rang par couleur de la famille des magies, de la même valeur, qui ne pose que --couleur-2
  const feuille = regles(cssDeLaPalette());
  assert.deepEqual(secondsRangsDesMagies().map((c) => c.cle), Object.keys(FAMILLES_DE_LA_PALETTE.magie));
  for (const { cle, classe, fond } of secondsRangsDesMagies()) {
    assert.equal(classe, classeDeSecondeMagie(cle), cle);
    assert.equal(fond, FAMILLES_DE_LA_PALETTE.magie[cle], cle);
    assert.deepEqual(feuille.get(classe), { '--couleur-2': fond }, classe);
    assert.match(classe, /^couleur-2-magie-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  // toutes les classes posées sur chaque page
  assert.deepEqual([...classesDeLaPalette()].sort(), [...feuille.keys()].sort());
});

/** Les propriétés que posent les classes de la palette, lues dans la feuille fabriquée (un renommage dans palette-css.mjs doit se voir ici). */
const proprietes = () => {
  const feuille = regles(cssDeLaPalette());
  const [fond, texte] = Object.keys(feuille.get(classeDeMagie('Feu')));
  const [second] = Object.keys(feuille.get(classeDeSecondeMagie('Feu')));
  return { fond, texte, second };
};

test('les feuilles des magies lisent les propriétés que posent les classes : pages et tableaux des magies, carte, créatures, bestiaire, composants, races, classes, guide, accessoires, fiche, personnages', () => {
  const { fond, texte, second } = proprietes();
  assert.deepEqual([fond, texte, second], ['--couleur', '--couleur-texte', '--couleur-2']);
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
  };
  // pages de magie : la couleur de la page (et d'un onglet du Potentiel Illimité) vient de la classe ; plus de repli écrit
  dans('src/styles/magie/base.css', '.magie, .magie-teinte', [`--mag: var(${fond}, var(--accent));`, `--mag-texte: var(${texte}, var(--text));`]);
  dans('src/styles/magie/sorts.css', '.npm__badge', 'color: var(--mag-texte);');
  dans('src/styles/magie/potentiel.css', 'html.js .autre-magie__onglet.is-active', `background: var(${fond}); color: var(${texte});`);
  dans('src/styles/magie/tableaux.css', '.tableau-magies__point', `background: var(${fond});`);
  dans('src/styles/magie/tableaux.css', '.tableau-magies__ligne', `var(${fond})`);
  dans('src/styles/magie/creatures.css', 'button.creature__bouton--magie', `--creature-1: var(${fond}); --creature-2: var(${second});`);
  dans('src/styles/global/pastille.css', '.magies-orbite__noeud', `--p: var(${fond});`);
  dans('src/styles/global/pastille.css', '.magies-orbite__pastille', `--p: var(${fond});`);
  // la carte : le trait prend --couleur ou --couleur-2 de ses classes, selon la magie survolée
  const carte = lire('src/components/magie/MagiesConstellation.astro');
  assert.ok(carte.includes(`.magies-relation.avec-\${k} { --c: var(${fond});`) && carte.includes(`.magies-relation.seconde-\${k} { --c: var(${second}); }`), 'règles du survol');
  // bestiaire : pastilles de magie et cibles de défense
  dans('src/styles/bestiaire/carte.css', '.bmagie', [`background: var(${fond}); color: var(${texte});`]);
  dans('src/styles/bestiaire/carte.css', '.bcible--magie', [`background: var(${fond}); color: var(${texte});`]);
  dans('src/styles/bestiaire/carte.css', '.bcible--deux', `var(${second})`);
  // composants : pastille et filet des gemmes et des bois, teinte de leurs infobulles
  dans('src/styles/composants/composants.css', '.comp-magie', `background: var(${fond}); color: var(${texte});`);
  dans('src/styles/composants/composants.css', '.comp-table tr.composant--magie', `--mag: var(${fond});`);
  // races, classes, guide, accessoires
  dans('src/styles/race/page.css', '.race-magie', `var(${fond}, var(--border))`);
  dans('src/styles/race/page.css', '.race-magie::before', `background: var(${fond}, var(--muted));`);
  dans('src/styles/classe/page.css', '.annexe-classe__carte--magie', `border-left-color: var(${fond});`);
  dans('src/styles/guide/blocs.css', '.guide-magie', `--c: var(${fond}, var(--guide));`);
  dans('src/styles/accessoires/accessoires.css', '.bulle--gemme', `--mag: var(${fond});`);
  // la fiche : cadres (innée → acquise), éléments sur la couleur d'une magie, créatures à invoquer, Mode Hyper
  dans('src/styles/fiche/fiche.css', '.fiche[data-magie] .fiche-etape', `--cadre: var(${fond}); --cadre-2: var(${second}, var(${fond}));`);
  dans('src/styles/fiche/fiche.css', '.fiche .teinte-palette', `--c: var(${fond}); --c-texte: var(${texte}); --texte-sur-c: var(${texte});`);
  dans('src/styles/fiche/fiche.css', '.fiche option.teinte-palette', 'background-color: var(--c); color: var(--c-texte);');
  dans('src/styles/fiche/fiche.css', '.fiche .invocation-choix--magie', `--c1: var(${fond}); --c2: var(${second});`);
  dans('src/styles/fiche/fiche.css', '.posture-carte__magie', `border-left: 3px solid var(${fond});`);
  // les personnages : la bordure de la ligne
  dans('src/styles/personnages/liste.css', '.perso--magie', `--magie-1: var(${fond}); --magie-2: var(${second});`);
});

// Les fichiers du lot des magies : aucune couleur écrite, hors le noir et le blanc de mélange (l'exception du propriétaire). Une feuille partagée avec
// des couleurs d'autres lots (caractéristiques, catégories de classe, niveaux, impression…) n'est contrôlée que dans les règles des magies.
const FICHIERS_DU_LOT_DES_MAGIES = [
  'src/components/magie/MagiePage.astro', 'src/components/magie/MagiesConstellation.astro', 'src/components/magie/SortDetail.astro',
  'src/components/magie/SortsDuPotentiel.astro', 'src/components/magie/TableauMagiesInnees.astro', 'src/components/magie/TableauRelationsMagies.astro',
  'src/components/race/RacePage.astro', 'src/components/classes/ClassePage.astro', 'src/components/guide/GuideBloc.astro',
  'src/components/bestiaire/CarteInvoquee.astro', 'src/components/bestiaire/TableauInvocations.astro',
  'src/components/accessoires/AccessoiresPage.astro', 'src/components/accessoires/GemmesDeLEffet.astro', 'src/pages/personnages.astro',
  'src/lib/monstre-rendu.mjs', 'src/lib/composants-rendu.mjs', 'src/lib/accessoires-db.mjs', 'src/lib/personnages-liste.mjs', 'src/lib/fiche-regles.mjs',
  'src/scripts/edition/races.mjs', 'src/scripts/personnages.mjs',
  'src/styles/magie/base.css', 'src/styles/magie/creatures.css', 'src/styles/magie/orbit.css', 'src/styles/magie/potentiel.css',
  'src/styles/magie/tableaux.css', 'src/styles/global/pastille.css', 'src/styles/bestiaire/carte.css', 'src/styles/composants/composants.css',
];
/**
 * Les règles des magies des feuilles du site, choisies d'après ce qu'elles lisent : la couleur d'une classe de la palette (`var(--couleur…)`) ou la
 * teinte d'une magie (`var(--mag…)`) ; [{ fichier, selecteur, corps }], commentaires retirés.
 */
const reglesQuiLisentUneMagie = () => readdirSync(new URL('../src/styles/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.css'))
  .flatMap((n) => [...lire(`src/styles/${n}`).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , corps]) => /var\(--(?:couleur(?:-texte|-2)?|mag(?:-[a-z]+)?)[,)]/.test(corps))
    .map(([, selecteur, corps]) => ({ fichier: `src/styles/${n}`, selecteur: selecteur.trim().replace(/\s+/g, ' '), corps })));
/** Hors lot : une règle qui lit `--mag` sans être une couleur de magie (l'ombre de l'infobulle partagée, une couleur du thème : skill ui-infobulles). */
const HORS_DU_LOT = new Set(['src/styles/global/infobulles.css .bulle']);
/** Des règles des magies qui ne lisent que les variables de leur feuille (`--c` de la fiche, sur la couleur d'un sort). */
const REGLES_DES_MAGIES_SANS_LA_PALETTE = {
  'src/styles/fiche/fiche.css': ['.fiche .fiche-table--sorts select[data-couleur]', '.fiche .sort-prepare select[data-couleur], .sort-prepare__posture[data-couleur]',
    '.fiche .invocation-choix', '.resistance', '.resistance--magie'],
};

test('aucune couleur écrite dans les fichiers du lot des magies (ni dans les règles des magies des feuilles partagées), hors le noir et le blanc de mélange', () => {
  for (const f of FICHIERS_DU_LOT_DES_MAGIES) assert.deepEqual(couleursDuFichier(f), [], f);
  const regles = reglesQuiLisentUneMagie();
  assert.ok(regles.length > 60, `${regles.length} règles des magies`);
  for (const attendue of ['src/styles/fiche/fiche.css .fiche[data-magie] .fiche-etape', 'src/styles/personnages/liste.css .perso--magie',
    'src/styles/classe/page.css .annexe-classe__carte--magie', 'src/styles/equipement/equipement.css .acc-gemme', 'src/styles/magie/sorts.css .npm__badge']) {
    assert.ok(regles.some((r) => `${r.fichier} ${r.selecteur}` === attendue), `règle choisie : ${attendue}`);
  }
  for (const { fichier, selecteur, corps } of regles) {
    if (!HORS_DU_LOT.has(`${fichier} ${selecteur}`)) assert.deepEqual(couleursEcrites(corps, { nommees: true }), [], `${fichier}, ${selecteur}`);
  }
  for (const [f, selecteurs] of Object.entries(REGLES_DES_MAGIES_SANS_LA_PALETTE)) {
    for (const s of selecteurs) assert.deepEqual(couleursEcrites(regleDe(lire(f), s), { nommees: true }), [], `${f}, ${s}`);
  }
  // le script de la fiche : la couleur d'une magie par ses classes (regles.json : `classe`, `classe_2`), jamais sa couleur ni une variable posée
  const fiche = lire('src/scripts/fiche.mjs');
  assert.doesNotMatch(fiche, /\b(?:m|m1|m2|innee|acquise|acquiseChoisie|choisi|magie|magieDuSort)\??\.couleur\b/, 'aucune couleur de magie lue');
  assert.doesNotMatch(fiche, /--magie-[12]|--m:|--c1: \$\{/, 'aucune variable de couleur de magie posée');
  assert.match(fiche, /poserTeinte\(racine, innee \? \[innee\.classe, \(acquise \?\? innee\)\.classe_2\] : \[\]\);/, 'les cadres : innée puis acquise');
  // les modules lus par le navigateur n'importent pas la palette (elle tire tous les modules des règles : skill site-version-portable)
  for (const f of ['src/scripts/fiche.mjs', 'src/scripts/personnages.mjs', 'src/lib/personnages-liste.mjs']) assert.doesNotMatch(lire(f), /^import [^;]*palette-css\.mjs';$/m, f);
});

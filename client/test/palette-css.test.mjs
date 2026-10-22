// La palette du site en classes CSS (lib/palette-css.mjs ; demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site.
// Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. », puis « La classe CSS du
// site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. » ; choix de
// cadrage « Module JS → classe », « Règle de calcul », « Garder séparées ») : une classe par couleur des règles, sa valeur lue dans le module de sa
// règle, lisible (« Privilégé la lisibilité. ») ; les combinaisons des potions calculées depuis leur classe de base ; le module n'écrit aucune couleur.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  FAMILLES_DE_LA_PALETTE, MAGIE_PAR_DEFAUT, classeDAffinite, classeDAttribut, classeDeCaracteristique, classeDeCouleur, classeDeMagie, classeDePotion,
  couleursDeLaPalette, cssDeLaPalette, cssDesPotions, idDeCouleur,
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
  assert.equal(feuille.size, couleursDeLaPalette().length, 'une règle par classe');
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
  // le poids ajouté à chaque page : environ 2,6 ko aujourd'hui (37 classes) ; au-delà de 4 ko, revoir la manière de l'émettre
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

/**
 * Les couleurs écrites d'un texte CSS, hors la seule exception admise (réponse du propriétaire du 2026-10-22, « Non, exception (Recommandé) » : « Le noir
 * et le blanc purs servant à assombrir ou éclaircir restent écrits ») : `#000`, `#fff`, `#000000`, `#ffffff` comme argument d'un `color-mix(…)`.
 */
const couleursEcrites = (css) => {
  let reste = '';
  let i = 0;
  for (let m = css.indexOf('color-mix(', i); m >= 0; m = css.indexOf('color-mix(', i)) {
    let profondeur = 0;
    let fin = m + 'color-mix'.length;
    for (; fin < css.length; fin++) {
      if (css[fin] === '(') profondeur++;
      else if (css[fin] === ')' && --profondeur === 0) break;
    }
    reste += css.slice(i, m) + css.slice(m, fin + 1).replace(/(?<=[\s,(])#(?:000|fff|000000|ffffff)(?![0-9a-f])/gi, '');
    i = fin + 1;
  }
  return (reste + css.slice(i)).match(HEX) ?? [];
};

test('l’exception des couleurs écrites : le noir ou le blanc purs de mélange d’un color-mix, rien d’autre', () => {
  assert.deepEqual(couleursEcrites('a { border: 1px solid color-mix(in srgb, var(--x) 65%, #000); b: color-mix(in srgb, #FFFFFF 20%, var(--y)); }'), []);
  assert.deepEqual(couleursEcrites('a { color: #000; }'), ['#000'], 'hors d’un color-mix');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, var(--x) 65%, #111); }'), ['#111'], 'pas un noir pur');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, var(--x) 65%, #0000ff); }'), ['#0000ff'], 'pas un noir de six chiffres suivi d’autres');
  assert.deepEqual(couleursEcrites('a { b: color-mix(in srgb, color-mix(in srgb, #fff 5%, var(--x)) 65%, #c62828); }'), ['#c62828'], 'mélange imbriqué');
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
  // la pastille de la gemme : `--g` posé par les accessoires, sinon la classe de la magie (bâtons)
  const equipement = lire('src/styles/equipement/equipement.css');
  const pastille = regleDe(equipement, '.acc-gemme');
  assert.ok(pastille.includes(`--gemme: var(--g, var(${fond}));`), pastille);
  assert.ok(pastille.includes('background: var(--gemme);'), pastille);
  assert.ok(pastille.includes(`color: var(--g-texte, var(${texte}));`), pastille);
  assert.deepEqual(couleursEcrites(pastille), [], 'la pastille n’écrit que le noir de mélange de son liseré');
  // la ligne colorée du gabarit commun lit les propriétés des combinaisons
  assert.match(lire('src/styles/global/tableaux.css'), new RegExp(`:where\\(\\.table-donnees\\) tr\\.ligne-couleur > \\* \\{ background: var\\(${ligneFond}\\); color: var\\(${ligneTexte}\\); \\}`));
  // les fichiers de l'onglet Ceinture n'écrivent aucune couleur, hors l'exception du mélange
  for (const f of ['src/styles/ceinture/ceinture.css', 'src/components/ceinture/CeinturePanneau.astro', 'src/components/ceinture/BatonsMagiques.astro']) {
    assert.deepEqual(couleursEcrites(lire(f)), [], f);
  }
});

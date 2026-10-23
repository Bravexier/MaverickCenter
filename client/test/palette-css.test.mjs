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
  CLASSE_NEUTRE, FAMILLES_DE_CHAQUE_PAGE, FAMILLES_SANS_TEXTE, FAMILLES_DE_LA_PALETTE, FAMILLES_DES_ZONES, MAGIE_PAR_DEFAUT, PAR_DEFAUT, classeDAffinite, classeDAlignement,
  classeDAttribut, classeDUneClasse, classeDeCaracteristique, classeDeCategorie, classeDeCouleur, classeDeMagie, classeDePalier, classeDePosture,
  classeDePotion, classeDeRace, classeDeSecondeCaracteristique, classeDeSecondeMagie, classeDuModeHyper, classesDeDeuxCaracteristiques,
  classesDeDeuxMagies, classesDeLaPalette, couleursDeLaPalette, cssDeLaPalette, cssDesFamilles, cssDesPotions, cssDesSecondsRangs, idDeCouleur,
  secondsRangs, secondsRangsDesMagies,
} from '../src/lib/palette-css.mjs';
import {
  AFFINITE_DES_PHILTRES, ATTRIBUT_DE_L_AFFINITE, CONTRASTE_MINIMAL, COULEURS_DES_AFFINITES, NUANCES_DES_NIVEAUX, contraste, couleurDePotion, lisible,
  nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS } from '../src/lib/attributs-couleurs.mjs';
import { COULEUR_NEUTRE, COULEURS_ALIGNEMENTS, COULEURS_CARACTERISTIQUES, COULEURS_POSTURES } from '../src/lib/caracteristiques-postures.mjs';
import { COULEUR_PAR_DEFAUT, COULEURS_DES_MAGIES, couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { CLASS_COLORS, CLASS_GROUPS, classColor } from '../src/lib/class-groups.mjs';
import { RACE_COLORS } from '../src/lib/race-kinds.mjs';
import { COULEURS_DES_PALIERS, COULEURS_DU_MODE_HYPER } from '../src/lib/fiche-couleurs.mjs';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const HEX = /(?<!&)#[0-9a-f]{6}\b|(?<!&)#[0-9a-f]{3}\b/gi;
/** Les règles d'une feuille fabriquée : Map(classe → { propriété: valeur }). */
const regles = (css) => new Map([...css.matchAll(/\.([a-z0-9-]+)\{([^}]*)\}/g)].map(([, classe, corps]) =>
  [classe, Object.fromEntries(corps.split(';').filter(Boolean).map((d) => d.split(':')))]));

test('onze familles, chacune lue dans le module de sa règle : magies, attributs, caractéristiques, affinités sans autre règle, postures, alignements, catégories de classe, races, paliers de résistance, Mode Hyper, neutre (et la couleur par défaut de quatre d’entre elles)', () => {
  assert.deepEqual(Object.keys(FAMILLES_DE_LA_PALETTE), ['magie', 'attribut', 'caracteristique', 'affinite', 'posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre']);
  assert.equal(MAGIE_PAR_DEFAUT, PAR_DEFAUT);
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.magie, { ...COULEURS_DES_MAGIES, [PAR_DEFAUT]: COULEUR_PAR_DEFAUT });
  assert.equal(FAMILLES_DE_LA_PALETTE.attribut, COULEURS_DES_ATTRIBUTS);
  assert.equal(FAMILLES_DE_LA_PALETTE.affinite, COULEURS_DES_AFFINITES);
  // lot des caractéristiques, postures et alignements : la couleur d'un id inconnu (COULEUR_NEUTRE, la règle de caracteristiques-postures.mjs) est la
  // classe `par-defaut` de sa famille, comme celle d'une magie inconnue
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.caracteristique, { ...COULEURS_CARACTERISTIQUES, [PAR_DEFAUT]: COULEUR_NEUTRE });
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.posture, { ...COULEURS_POSTURES, [PAR_DEFAUT]: COULEUR_NEUTRE });
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.alignement, { ...COULEURS_ALIGNEMENTS, [PAR_DEFAUT]: COULEUR_NEUTRE });
  // lot des catégories de classe, des races et du reste de la fiche : la couleur reste dans le module de sa règle (class-groups.mjs, race-kinds.mjs,
  // fiche-couleurs.mjs) ; le neutre ne double aucune valeur : la seule classe `par-defaut`, de valeur COULEUR_NEUTRE
  assert.equal(FAMILLES_DE_LA_PALETTE.classe, CLASS_COLORS);
  assert.equal(FAMILLES_DE_LA_PALETTE.race, RACE_COLORS);
  assert.equal(FAMILLES_DE_LA_PALETTE.palier, COULEURS_DES_PALIERS);
  assert.equal(FAMILLES_DE_LA_PALETTE.mode, COULEURS_DU_MODE_HYPER);
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.neutre, { [PAR_DEFAUT]: COULEUR_NEUTRE });
  assert.deepEqual(Object.keys(CLASS_COLORS), CLASS_GROUPS.map((g) => g.key), 'une couleur par catégorie de /classes/');
  assert.deepEqual(Object.keys(RACE_COLORS), ['pure', 'hybride'], 'une couleur par nature de race (race-kinds.mjs#raceKind)');
  assert.deepEqual(Object.keys(COULEURS_DU_MODE_HYPER), ['hyper', 'cent'], 'le Mode Hyper et le Mode Hyper 100 %');
  // les caractéristiques, les postures et les paliers de résistance : une par ligne de la base (leurs ids sont ceux des classes)
  const db = ouvrirBase();
  assert.deepEqual(Object.keys(COULEURS_CARACTERISTIQUES).sort(), db.prepare('SELECT id FROM caracteristique').all().map((c) => c.id).sort());
  assert.deepEqual(Object.keys(COULEURS_POSTURES).sort(), db.prepare('SELECT id FROM posture').all().map((p) => p.id.split(':').at(-1)).sort());
  assert.deepEqual(Object.keys(COULEURS_DES_PALIERS), db.prepare('SELECT id FROM resistance_palier ORDER BY ordre').all().map((p) => p.id));
  // chaque famille est émise sur chaque page ou par les pages de sa zone, jamais les deux
  assert.deepEqual([...FAMILLES_DE_CHAQUE_PAGE, ...FAMILLES_DES_ZONES].sort(), Object.keys(FAMILLES_DE_LA_PALETTE).sort());
  assert.deepEqual(FAMILLES_DE_CHAQUE_PAGE, ['magie', 'attribut', 'caracteristique', 'affinite']);
  assert.deepEqual(FAMILLES_DES_ZONES, ['posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre']);
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
  assert.equal(classeDeCaracteristique('chance'), `couleur-caracteristique-${PAR_DEFAUT}`, 'inconnue : la classe par défaut, comme couleurDeCaracteristique');
  assert.equal(classeDeCaracteristique(undefined), `couleur-caracteristique-${PAR_DEFAUT}`, 'une compétence sans caractéristique');
  assert.equal(classeDePosture('guide/postures#posture:offensif'), 'couleur-posture-offensif');
  assert.equal(classeDePosture('vigilance'), 'couleur-posture-vigilance');
  assert.equal(classeDePosture('guide/postures#posture:inconnue'), `couleur-posture-${PAR_DEFAUT}`);
  assert.equal(classeDAlignement('Loyal Bon'), 'couleur-alignement-loyal-bon');
  assert.equal(classeDAlignement('Neutre'), 'couleur-alignement-neutre');
  assert.equal(classeDAlignement('Neutre Pur'), `couleur-alignement-${PAR_DEFAUT}`);
  assert.equal(classeDAlignement(null), `couleur-alignement-${PAR_DEFAUT}`);
  assert.equal(classeDeCouleur('affinite', 'chakra+sante'), 'couleur-affinite-chakra-sante');
  assert.equal(idDeCouleur('barriere+chakra'), 'barriere-chakra');
  assert.equal(classeDAttribut('inconnu'), null);
  assert.equal(classeDeCouleur('inconnue', 'feu'), null);
  // lot des catégories de classe, des races et du reste de la fiche
  assert.equal(classeDeCategorie('melee'), 'couleur-classe-melee');
  assert.equal(classeDeCategorie('non-classees'), null, 'pas une catégorie de couleur : une section des Spéciales');
  assert.equal(classeDUneClasse({ id: 'classes/guerrier', data: { tags: ['classe', 'càc'] } }), 'couleur-classe-melee');
  assert.equal(classeDUneClasse({ id: 'classes/parleur', data: { tags: ['classe', 'càc'] } }), 'couleur-classe-speciales', 'exception du Parleur');
  assert.equal(classeDUneClasse({ id: 'classes/x', data: { tags: [] } }), 'couleur-classe-speciales', 'non classée : sous « Spéciales », comme classColor');
  for (const tags of [['càc'], ['distance'], ['magique'], ['hybride animal'], ['hybride'], []]) {
    const entree = { id: 'classes/x', data: { tags } };
    assert.equal(FAMILLES_DE_LA_PALETTE.classe[classeDUneClasse(entree).slice('couleur-classe-'.length)], classColor(entree), tags.join());
  }
  assert.equal(classeDeRace('pure'), 'couleur-race-pure');
  assert.equal(classeDeRace('hybride'), 'couleur-race-hybride');
  assert.equal(classeDeRace('autre'), null);
  assert.equal(classeDePalier('grande_resistance'), 'couleur-palier-grande-resistance');
  assert.equal(classeDePalier('inconnu'), null);
  assert.deepEqual([classeDuModeHyper('hyper'), classeDuModeHyper('cent')], ['couleur-mode-hyper', 'couleur-mode-cent']);
  assert.equal(CLASSE_NEUTRE, `couleur-neutre-${PAR_DEFAUT}`);
  const classes = couleursDeLaPalette().map((c) => c.classe);
  assert.equal(classes.length, Object.values(FAMILLES_DE_LA_PALETTE).reduce((n, f) => n + Object.keys(f).length, 0));
  assert.equal(new Set(classes).size, classes.length, 'une classe par couleur');
  for (const c of classes) assert.match(c, /^couleur-(?:magie|attribut|caracteristique|affinite|posture|alignement|classe|race|palier|mode|neutre)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
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

test('la valeur de chaque classe est celle de sa règle (rendue lisible), et son texte le plus lisible dessus atteint un contraste de 4,5:1', () => {
  const feuille = regles(cssDesFamilles(Object.keys(FAMILLES_DE_LA_PALETTE)));
  assert.equal(feuille.size, couleursDeLaPalette().length, 'une règle par classe, toutes familles');
  // la couleur de la règle, inchangée quand son texte atteint déjà 4,5:1 ; seuls Loyal Bon et Loyal Neutre (couleurs du guide pour MJ trop moyennes
  // pour un texte foncé comme pour un blanc) sont à peine éclaircis par la règle de lisibilité (alchimie-couleurs.mjs#lisible) : réponse du propriétaire
  // du 2026-10-23 à « Deux couleurs d'alignement du guide pour MJ, Loyal Bon (#45818e) et Loyal Neutre (#3c78d8), n'atteignent pas le contraste
  // minimal de lisibilité (4,5:1), ni avec le texte foncé ni avec le blanc (4,2:1 au mieux). Que faire ? » : « Éclaircir (Recommandé) » ; option :
  // « Fond à peine éclairci (#4e8794 et #467fda), texte foncé : lisible ; les couleurs de référence du guide restent dans le code. »
  assert.deepEqual(['Loyal Bon', 'Loyal Neutre'].map((a) => couleursDeLaPalette(['alignement']).find((c) => c.cle === a)).map((c) => [c.fond, c.texte]),
    [['#4e8794', '#171210'], ['#467fda', '#171210']], 'les fonds de l’option choisie, texte foncé');
  assert.deepEqual([COULEURS_ALIGNEMENTS['Loyal Bon'], COULEURS_ALIGNEMENTS['Loyal Neutre']], ['#45818e', '#3c78d8'], 'les couleurs de référence restent dans le code');
  const eclaircies = couleursDeLaPalette().filter((c) => c.fond !== FAMILLES_DE_LA_PALETTE[c.famille][c.cle]).map((c) => c.classe);
  assert.deepEqual(eclaircies, ['couleur-alignement-loyal-bon', 'couleur-alignement-loyal-neutre']);
  // une famille dont la couleur ne porte pas de texte (le trait d'un palier de résistance) n'est pas corrigée : le seuil de 4,5:1 vaut pour un texte ;
  // la grande vulnérabilité garde #e53935 (4,4:1 au mieux)
  assert.deepEqual(FAMILLES_SANS_TEXTE, ['palier']);
  assert.equal(couleursDeLaPalette(['palier']).find((c) => c.cle === 'grande_vulnerabilite').fond, '#e53935');
  assert.ok(contraste('#e53935', texteSurCouleur('#e53935')) < CONTRASTE_MINIMAL, 'elle serait corrigée si elle portait un texte');
  for (const { famille, cle, classe, fond, texte } of couleursDeLaPalette()) {
    const sansTexte = FAMILLES_SANS_TEXTE.includes(famille);
    assert.equal(fond, sansTexte ? FAMILLES_DE_LA_PALETTE[famille][cle] : lisible(FAMILLES_DE_LA_PALETTE[famille][cle]), classe);
    assert.equal(texte, texteSurCouleur(fond), classe);
    assert.deepEqual(feuille.get(classe), { '--couleur': fond, '--couleur-texte': texte }, classe);
    if (sansTexte) continue;   // aucun texte posé dessus : rien à mesurer
    assert.ok(contraste(fond, texte) >= CONTRASTE_MINIMAL, `${classe} : ${fond} / ${texte} = ${contraste(fond, texte).toFixed(2)}`);
  }
  assert.deepEqual(feuille.get(classeDeMagie('Sang')), { '--couleur': couleurDeMagie('Sang'), '--couleur-texte': texteSurCouleur(couleurDeMagie('Sang')) });
  assert.deepEqual(feuille.get(classeDAttribut('chakra')), { '--couleur': COULEURS_DES_ATTRIBUTS.chakra, '--couleur-texte': texteSurCouleur(COULEURS_DES_ATTRIBUTS.chakra) });
  assert.deepEqual(feuille.get(classeDePosture('focus')), { '--couleur': COULEURS_POSTURES.focus, '--couleur-texte': texteSurCouleur(COULEURS_POSTURES.focus) });
  assert.deepEqual(feuille.get(classeDAlignement('Neutre Mauvais')), { '--couleur': '#783f04', '--couleur-texte': texteSurCouleur('#783f04') }, 'foncé : texte clair');
  assert.notEqual(texteSurCouleur('#783f04'), texteSurCouleur(COULEURS_CARACTERISTIQUES.force), 'le texte suit la couleur (lisibilité)');
});

test('l’émission : la feuille de chaque page (familles de chaque page, seconds rangs des magies) ; celle d’une zone, ses familles seules', () => {
  const chaquePage = regles(cssDeLaPalette());
  assert.deepEqual([...chaquePage.keys()], [...couleursDeLaPalette(FAMILLES_DE_CHAQUE_PAGE).map((c) => c.classe), ...secondsRangsDesMagies().map((c) => c.classe)]);
  assert.deepEqual([...classesDeLaPalette()].sort(), [...chaquePage.keys()].sort());
  for (const famille of FAMILLES_DES_ZONES) {
    assert.ok(![...chaquePage.keys()].some((c) => c.startsWith(`couleur-${famille}-`)), `${famille} : pas sur chaque page`);
    assert.deepEqual([...regles(cssDesFamilles([famille])).keys()], couleursDeLaPalette([famille]).map((c) => c.classe), famille);
  }
  assert.ok(![...chaquePage.keys()].some((c) => c.startsWith('couleur-2-caracteristique-')), 'seconds rangs des caractéristiques : pas sur chaque page');
  assert.equal(cssDesFamilles([]), '');
  assert.equal(cssDesFamilles(['inconnue']), '');
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

test('aucune couleur écrite dans le module de la palette ; la palette posée sur chaque page par layouts/Base.astro, d’un poids borné ; les familles d’une zone émises par leurs pages', () => {
  assert.deepEqual(lire('src/lib/palette-css.mjs').match(HEX) ?? [], []);
  assert.match(lire('src/layouts/Base.astro'), /<style is:inline set:html=\{cssDeLaPalette\(\)\}><\/style>/);
  // le poids ajouté à chaque page : environ 3,4 ko aujourd'hui (38 classes et les 16 de second rang des magies) ; au-delà de 4 ko, revoir la manière de
  // l'émettre. Toutes les familles et tous les seconds rangs sur chaque page le dépasseraient : c'est pourquoi les familles d'une zone n'y sont pas.
  assert.ok(cssDeLaPalette().length < 4000, `${cssDeLaPalette().length} octets`);
  const tout = cssDesFamilles(Object.keys(FAMILLES_DE_LA_PALETTE)) + cssDesSecondsRangs('magie') + cssDesSecondsRangs('caracteristique');
  assert.ok(tout.length > 4000, `tout sur chaque page : ${tout.length} octets`);
  // les pages qui posent les classes d'une zone les émettent, dans leur composant : les postures (bloc « postures » du guide, fiche), les alignements
  // (fiche), les seconds rangs des caractéristiques (onglet Armes)
  assert.match(lire('src/components/guide/GuideBloc.astro'), /bloc === 'postures' && \(\s*<div class="guide-postures">[^]*?<style is:inline set:html=\{cssDesFamilles\(\['posture'\]\)\}><\/style>/);
  assert.match(lire('src/pages/fiche/index.astro'), /<style is:inline set:html=\{cssDesFamilles\(FAMILLES_DES_ZONES\)\}><\/style>/);
  assert.match(lire('src/components/armes/ArmesPage.astro'), /const secondsRangs = cssDesSecondsRangs\('caracteristique'\);[^]*<style is:inline set:html=\{secondsRangs\}><\/style>/);
  // les catégories de classe (/classes/, les pages de classe) et les races (/races/, les pages de race) ; la fiche les émet avec les autres familles
  // d'une zone (paliers, Mode Hyper, neutre compris) ; le mode modification avec la page d'une race ou d'une classe créée (la page 404 n'en a pas)
  for (const f of ['src/components/classes/ClassesPastilles.astro', 'src/components/classes/ClassePage.astro']) {
    assert.match(lire(f), /<style is:inline set:html=\{cssDesFamilles\(\['classe'\]\)\}><\/style>/, f);
  }
  for (const f of ['src/components/race/RacesPastilles.astro', 'src/components/race/RacePage.astro']) {
    assert.match(lire(f), /<style is:inline set:html=\{cssDesFamilles\(\['race'\]\)\}><\/style>/, f);
  }
  const nouvelles = lire('src/scripts/edition/nouvelles.mjs');
  assert.ok(nouvelles.includes("css: [raceBaseCss, racePageCss, raceRelationsCss, cssDesFamilles(['race'])].join('\\n'),"), 'la page d’une race créée');
  assert.ok(nouvelles.includes("css: [classeBaseCss, classePageCss, cssDesFamilles(['classe'])].join('\\n'),"), 'la page d’une classe créée');
  for (const famille of ['classe', 'race', 'palier', 'mode', 'neutre']) assert.ok(FAMILLES_DES_ZONES.includes(famille), `${famille} : une famille d’une zone`);
  // le poids de ce que la fiche émet (toutes les familles d'une zone) reste petit
  assert.ok(cssDesFamilles(FAMILLES_DES_ZONES).length < 3000, `${cssDesFamilles(FAMILLES_DES_ZONES).length} octets`);
});

const construit = existsSync(new URL('../dist/index.html', import.meta.url));
test('la palette dans les pages construites', construit ? {} : { skip: 'site non construit (npm run build)' }, () => {
  const page = (rel) => {
    const construite = new URL(`../dist/${rel}`, import.meta.url);
    assert.ok(existsSync(construite), `page construite : ${rel}`);
    return readFileSync(construite, 'utf8');
  };
  for (const rel of ['index.html', 'ressources/equipement/index.html', 'fiche/index.html', 'regles/les-postures/index.html']) {
    assert.ok(page(rel).includes(`<style>${cssDeLaPalette()}</style>`), `dans la page construite : ${rel}`);
  }
  // les familles d'une zone : sur les pages qui les posent, et seulement là
  assert.ok(page('fiche/index.html').includes(`<style>${cssDesFamilles(FAMILLES_DES_ZONES)}</style>`), 'postures et alignements : la fiche');
  assert.ok(page('regles/les-postures/index.html').includes(`<style>${cssDesFamilles(['posture'])}</style>`), 'postures : la page du guide');
  assert.ok(page('ressources/equipement/index.html').includes(`<style>${cssDesSecondsRangs('caracteristique')}</style>`), 'seconds rangs : l’onglet Armes');
  for (const rel of ['index.html', 'ressources/equipement/index.html']) assert.ok(!page(rel).includes('.couleur-posture-'), `${rel} : pas de postures`);
  // les catégories de classe et les races : sur leurs listes et leurs pages, et seulement là (et la fiche)
  for (const rel of ['classes/index.html', 'classes/guerrier/index.html']) assert.ok(page(rel).includes(`<style>${cssDesFamilles(['classe'])}</style>`), `classes : ${rel}`);
  for (const rel of ['races/index.html', 'races/humain/index.html']) assert.ok(page(rel).includes(`<style>${cssDesFamilles(['race'])}</style>`), `races : ${rel}`);
  for (const rel of ['index.html', 'magies/index.html']) assert.ok(!/\.couleur-(?:classe|race|palier|mode|neutre)-/.test(page(rel)), `${rel} : pas de ces familles`);
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

test('deux caractéristiques sur un même élément (une arme de deux compétences, R48) : la classe de la première, la classe de second rang de la seconde, ou de la même', () => {
  assert.equal(classeDeSecondeCaracteristique('agilite'), 'couleur-2-caracteristique-agilite');
  assert.equal(classeDeSecondeCaracteristique('chance'), `couleur-2-caracteristique-${PAR_DEFAUT}`);
  assert.deepEqual(classesDeDeuxCaracteristiques('force', 'perception'), ['couleur-caracteristique-force', 'couleur-2-caracteristique-perception']);
  assert.deepEqual(classesDeDeuxCaracteristiques('agilite'), ['couleur-caracteristique-agilite', 'couleur-2-caracteristique-agilite']);
  const feuille = regles(cssDesSecondsRangs('caracteristique'));
  assert.deepEqual(secondsRangs('caracteristique').map((c) => c.cle), Object.keys(FAMILLES_DE_LA_PALETTE.caracteristique));
  for (const { cle, classe, fond } of secondsRangs('caracteristique')) {
    assert.equal(classe, classeDeSecondeCaracteristique(cle), cle);
    assert.deepEqual(feuille.get(classe), { '--couleur-2': FAMILLES_DE_LA_PALETTE.caracteristique[cle] }, classe);
    assert.equal(fond, FAMILLES_DE_LA_PALETTE.caracteristique[cle], cle);
  }
  assert.deepEqual(secondsRangsDesMagies(), secondsRangs('magie'));
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

// Lot des caractéristiques (et de leurs compétences), des postures et des alignements (2026-10-22, même demande et mêmes choix de cadrage) : leur couleur
// passe par la classe de la palette (`couleur-caracteristique-<id>`, `couleur-posture-<id>`, `couleur-alignement-<id>`, et `par-defaut`).

test('les feuilles des caractéristiques, postures et alignements lisent les propriétés que posent les classes : guide, bestiaire, armes, métiers, fiche', () => {
  const { fond, texte, second } = proprietes();
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
  };
  // le guide : une caractéristique (pastille), le cadre de ses compétences, une posture
  dans('src/styles/guide/blocs.css', '.guide-carac', [`--c: var(${fond});`, `--c-texte: var(${texte});`, 'background: var(--c);', 'color: var(--c-texte);']);
  dans('src/styles/guide/blocs.css', '.guide-competences__groupe', `--c: var(${fond}, var(--guide));`);
  dans('src/styles/guide/blocs.css', '.guide-posture', [`--c: var(${fond}, var(--guide));`, `--c-texte: var(${texte}, var(--text));`]);
  dans('src/styles/guide/blocs.css', '.guide-posture__nom', ['background: var(--c);', 'color: var(--c-texte);']);
  // le bestiaire : une case de caractéristique ; les armes : la compétence, en dégradé de deux ; les métiers : compétences et caractéristiques
  dans('src/styles/bestiaire/carte.css', '.bcarac', `background: var(${fond}); color: var(${texte});`);
  dans('src/styles/armes/armes.css', '.arme-comp', `background: linear-gradient(90deg, var(${fond}), var(${second}, var(${fond}))); color: var(${texte});`);
  dans('src/styles/metier/tableau.css', '.metier-cible, .metier-carac', `background: var(${fond}, var(--met-soft)); color: var(${texte}, var(--text));`);
  // la fiche : teinte-palette fait lire la classe dans --c, --c-texte, --texte-sur-c, que lisent les cartes, tableaux, cases et l'alignement
  dans('src/styles/fiche/fiche.css', '.fiche .teinte-palette', `--c: var(${fond}); --c-texte: var(${texte}); --texte-sur-c: var(${texte});`);
  dans('src/styles/fiche/fiche.css', '.carac__nom', ['background: var(--c);', 'color: var(--c-texte);']);
  dans('src/styles/fiche/fiche.css', '.competences__groupe thead th', 'background: var(--c); color: var(--c-texte);');
  dans('src/styles/fiche/fiche.css', '.alignement__resultat', ['background: var(--c, var(--etape));', 'color: var(--c-texte);']);
  dans('src/styles/fiche/fiche.css', '.fiche .posture-carte[aria-pressed=\'true\'] .posture-carte__nom', 'background: var(--c); color: var(--c-texte);');
  dans('src/styles/fiche/fiche.css', '.invocation-carte__carac', 'background: var(--c); color: var(--c-texte);');
});

test('les classes du lot posées par les rendus et la fiche : des noms de la palette, jamais une couleur', async () => {
  const { htmlDeCompetence, htmlDuFiltreDeCompetence } = await import('../src/lib/armes-rendu.mjs');
  const { htmlDesCaracteristiques } = await import('../src/lib/monstre-rendu.mjs');
  const ctx = { caracteristiques: [{ id: 'force', nom: 'Force' }, { id: 'agilite', nom: 'Agilité' }, { id: 'perception', nom: 'Perception' }] };
  // les armes (R48) : la compétence, ses deux classes ; le bouton du filtre de même
  assert.match(htmlDeCompetence('Arme Légère', ctx), /^<span class="arme-comp couleur-caracteristique-agilite couleur-2-caracteristique-agilite" data-competences="arme-legere" title="[^"]+">Légère<\/span>$/);
  // deux compétences (les écritures réelles de l'onglet, arme-champs.mjs#COMPETENCES_PAR_ECRITURE) : la classe de la première caractéristique, le second
  // rang de la seconde, distinct (dégradé Force - Agilité)
  for (const ecriture of ['Arme Lourde/Légère', 'Arc / Arme Légère']) {
    assert.match(htmlDeCompetence(ecriture, ctx), /^<span class="arme-comp arme-comp--deux couleur-caracteristique-force couleur-2-caracteristique-agilite" data-competences="(?:arme-lourde|arc) arme-legere" title="[^"]+ et Arme Légère \(Agilité\)">/, ecriture);
  }
  assert.match(htmlDuFiltreDeCompetence('arbalete', ctx), /^<button type="button" class="arme-comp armes-filtre__choix couleur-caracteristique-perception couleur-2-caracteristique-perception" data-competence="arbalete"/);
  // le bestiaire : une case par caractéristique, F.P.V.S.I.A., chacune de sa classe
  assert.deepEqual([...htmlDesCaracteristiques([1, 2, 3, 4, 5, 6]).matchAll(/<span class="bcarac ([\w-]+)"/g)].map((m) => m[1]),
    ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'].map(classeDeCaracteristique));
  for (const html of [htmlDeCompetence('Arme Légère', ctx), htmlDesCaracteristiques([1, 2, 3, 4, 5, 6])]) assert.deepEqual(couleursEcrites(html), [], html);
});

// Les fichiers des lots faits : aucune couleur écrite, hors le noir et le blanc de mélange (l'exception du propriétaire). Une feuille partagée avec
// des couleurs d'autres lots (catégories de classe, niveaux, impression…) n'est contrôlée que dans les règles des lots faits.
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
/** Les fichiers propres au lot des caractéristiques (et de leurs compétences), des postures et des alignements, hors ceux du lot des magies. */
const FICHIERS_DU_LOT_DES_CARACTERISTIQUES = [
  'src/lib/armes-rendu.mjs', 'src/lib/edition-rendu.mjs', 'src/components/armes/ArmesPage.astro', 'src/components/metier/MetiersTableau.astro',
  'src/pages/fiche/index.astro', 'src/styles/metier/tableau.css',
];
/**
 * Les fichiers propres au lot des catégories de classe, des races et du reste de la fiche (paliers de résistance, Mode Hyper, couleurs d'interface,
 * neutres), hors ceux des lots d'avant : contrôlés en entier. Les modules des règles (class-groups.mjs, race-kinds.mjs, fiche-couleurs.mjs) écrivent
 * leurs couleurs ; les feuilles des pages de classe et de race (page.css, dons.css, race/base.css, relations.css) gardent celles de lots à venir
 * (impression, types de don, voiles des bannières, échelle des relations) et ne sont contrôlées que dans leurs règles de ce lot.
 */
const FICHIERS_DU_LOT_DES_CLASSES_ET_RACES = [
  'src/components/classes/ClassesPastilles.astro', 'src/components/race/RacesPastilles.astro', 'src/scripts/edition/nouvelles.mjs', 'src/scripts/fiche.mjs',
  'src/styles/classe/base.css', 'src/styles/classe/liste.css', 'src/styles/race/liste.css', 'src/styles/fiche/fiche.css',
];
/** Les feuilles où `--c`, `--c1`, `--c2`, `--c-texte` et `--texte-sur-c` sont les variables de la palette (tirées de la classe : `.fiche .teinte-palette`, `.guide-carac`…). */
const FEUILLES_DES_VARIABLES_DE_LA_PALETTE = new Set(['src/styles/fiche/fiche.css', 'src/styles/guide/blocs.css']);
/** Les variables que les feuilles des classes et des races tirent de la classe de leur catégorie ou de leur nature (`--cla: var(--couleur…)`, `--rac`…). */
const FEUILLES_DES_CLASSES_ET_RACES = /^src\/styles\/(?:classe|race)\//;
/**
 * Les règles des lots faits des feuilles du site, choisies d'après ce qu'elles lisent : la couleur d'une classe de la palette (`var(--couleur…)`), la
 * teinte d'une magie (`var(--mag…)`) ; dans les feuilles de FEUILLES_DES_VARIABLES_DE_LA_PALETTE, les variables qui en sont tirées (`var(--c)`,
 * `var(--c1)`, `var(--c2)`, `var(--c-texte)`, `var(--texte-sur-c)` : caractéristiques, compétences, postures, alignements, magies, races, classes,
 * Mode Hyper de la fiche et du guide) ; et, dans les feuilles des classes et des races, celles de leur catégorie ou de leur nature (`var(--cla…)`,
 * `var(--rac…)`, `var(--hero-1)`, `var(--hero-2)`) ; et partout, celles qui lisent un jeton de ce lot posé sur une bannière ou un aplat foncé
 * (`var(--texte-sur-fonce)`, `var(--fond-banniere)` : un `color: #fff` remis là se verrait) ; [{ fichier, selecteur, corps }], commentaires retirés.
 */
const reglesQuiLisentLaPalette = () => readdirSync(new URL('../src/styles/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.css'))
  .flatMap((n) => [...lire(`src/styles/${n}`).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , corps]) => /var\(--(?:couleur(?:-texte|-2)?|mag(?:-[a-z]+)?)[,)]/.test(corps)
      || (FEUILLES_DES_VARIABLES_DE_LA_PALETTE.has(`src/styles/${n}`) && /var\(--(?:c|c1|c2|c-texte|texte-sur-c)[,)]/.test(corps))
      || (FEUILLES_DES_CLASSES_ET_RACES.test(`src/styles/${n}`) && /var\(--(?:cla|rac)(?:-[a-z]+)?[,)]|var\(--hero-[12]\)/.test(corps))
      || /var\(--(?:texte-sur-fonce|fond-banniere)[,)]/.test(corps))
    .map(([, selecteur, corps]) => ({ fichier: `src/styles/${n}`, selecteur: selecteur.trim().replace(/\s+/g, ' '), corps })));
/**
 * Hors des lots faits : la seule déclaration de règles choisies qui n'est pas une couleur de ces lots, retirée avant le contrôle (le reste de la règle est
 * contrôlé). L'ombre de l'infobulle partagée (une couleur du thème : skill ui-infobulles) ; l'échelle des relations entre les peuples de la page d'une
 * race (`--regard-evitee`, la seule qui écrit sa teinte : un lot à venir). Les pastilles de la fiche n'en ont plus : toutes posent leur classe (races,
 * ethnies, classes, objets de départ et magie acquise « Aucune » compris).
 */
const HORS_DU_LOT = new Map([
  ['src/styles/global/infobulles.css .bulle', '--bulle-ombre: rgb(42 33 24 / 0.36);'],
  ['src/styles/race/base.css .race', '--regard-evitee: color-mix(in srgb, #c27a12 70%, var(--surface));'],
]);

test('aucune couleur écrite dans les fichiers des lots faits (ni dans les règles de ces lots des feuilles partagées), hors le noir et le blanc de mélange', () => {
  for (const f of [...FICHIERS_DU_LOT_DES_MAGIES, ...FICHIERS_DU_LOT_DES_CARACTERISTIQUES, ...FICHIERS_DU_LOT_DES_CLASSES_ET_RACES]) {
    assert.deepEqual(couleursDuFichier(f), [], f);
  }
  const regles = reglesQuiLisentLaPalette();
  assert.ok(regles.length > 140, `${regles.length} règles des lots faits`);
  for (const attendue of ['src/styles/fiche/fiche.css .fiche[data-magie] .fiche-etape', 'src/styles/personnages/liste.css .perso--magie',
    'src/styles/classe/page.css .annexe-classe__carte--magie', 'src/styles/equipement/equipement.css .acc-gemme', 'src/styles/magie/sorts.css .npm__badge',
    // les règles des magies qui ne lisent que les variables de leur feuille (`--c` de la fiche, sur la couleur d'un sort)
    'src/styles/fiche/fiche.css .fiche .fiche-table--sorts select[data-couleur]', 'src/styles/fiche/fiche.css .fiche .invocation-choix',
    'src/styles/fiche/fiche.css .resistance', 'src/styles/fiche/fiche.css .resistance--magie',
    // lot des caractéristiques, postures et alignements
    'src/styles/fiche/fiche.css .carac', 'src/styles/fiche/fiche.css .carac__nom', 'src/styles/fiche/fiche.css .competences__groupe',
    'src/styles/fiche/fiche.css .competences__groupe thead th', 'src/styles/fiche/fiche.css .alignement__resultat', 'src/styles/fiche/fiche.css .fiche .posture-carte',
    'src/styles/fiche/fiche.css .invocation-carte__carac', 'src/styles/fiche/fiche.css .fiche .sort-prepare select[data-couleur], .sort-prepare__posture[data-couleur]',
    'src/styles/guide/blocs.css .guide-carac', 'src/styles/guide/blocs.css .guide-competences__groupe', 'src/styles/guide/blocs.css .guide-posture',
    'src/styles/guide/blocs.css .guide-posture__nom', 'src/styles/bestiaire/carte.css .bcarac', 'src/styles/armes/armes.css .arme-comp',
    'src/styles/metier/tableau.css .metier-cible, .metier-carac',
    // lot des catégories de classe, des races et du reste de la fiche
    'src/styles/classe/base.css .classe', 'src/styles/classe/liste.css .classes-groupe', 'src/styles/classe/dons.css .don__niveau',
    'src/styles/classe/dons.css .onglet', 'src/styles/classe/page.css .classe-hero', 'src/styles/classe/page.css .classe-specialite h3',
    'src/styles/race/base.css .race', 'src/styles/race/liste.css .races-groupe', 'src/styles/race/page.css .race-hero', 'src/styles/race/page.css .race-don',
    'src/styles/race/relations.css .regards__bloc h4', 'src/styles/classe/page.css .classe-hero__reperes a', 'src/styles/race/page.css .race-hero__classe a',
    'src/styles/magie/page.css .magie-hero', 'src/styles/magie/base.css .magie, .magie-teinte', 'src/styles/classe/dons.css .specialite__titre', "src/styles/fiche/fiche.css .resistances__table tr[class*='couleur-palier-']",
    'src/styles/fiche/fiche.css .choix__pastille', "src/styles/fiche/fiche.css .pastille[aria-pressed='true']", 'src/styles/fiche/fiche.css .groupe-pastilles > h4',
    'src/styles/fiche/fiche.css .dons-classe > h4']) {
    assert.ok(regles.some((r) => `${r.fichier} ${r.selecteur}` === attendue), `règle choisie : ${attendue}`);
  }
  for (const [h, declaration] of HORS_DU_LOT) {
    const regle = regles.find((r) => `${r.fichier} ${r.selecteur}` === h);
    assert.ok(regle?.corps.includes(declaration), `hors du lot, mais choisie : ${h} (« ${declaration} »)`);
  }
  for (const { fichier, selecteur, corps } of regles) {
    const horsDuLot = HORS_DU_LOT.get(`${fichier} ${selecteur}`);
    assert.deepEqual(couleursEcrites(horsDuLot ? corps.replace(horsDuLot, '') : corps, { nommees: true }), [], `${fichier}, ${selecteur}`);
  }
  // le script de la fiche : la couleur d'une magie par ses classes (regles.json : `classe`, `classe_2`), jamais sa couleur ni une variable posée
  const fiche = lire('src/scripts/fiche.mjs');
  assert.doesNotMatch(fiche, /\b(?:m|m1|m2|innee|acquise|acquiseChoisie|choisi|magie|magieDuSort)\??\.couleur\b/, 'aucune couleur de magie lue');
  assert.doesNotMatch(fiche, /--magie-[12]|--m:|--c1: \$\{/, 'aucune variable de couleur de magie posée');
  assert.match(fiche, /poserTeinte\(racine, innee \? \[innee\.classe, \(acquise \?\? innee\)\.classe_2\] : \[\]\);/, 'les cadres : innée puis acquise');
  // … et celle d'une caractéristique (et de ses compétences), d'une posture ou d'un alignement : sa classe (regles.json : `classe`), posée avec
  // teinte-palette (teinteDe) ; aucune couleur lue, aucune variable posée, plus de repli écrit pour une compétence inconnue
  assert.doesNotMatch(fiche, /\b(?:carac|posture|p\.posture|teinte|alignement)\??\.(?:couleur|texte)\b/, 'aucune couleur de caractéristique, de posture ou d’alignement lue');
  // `k` est aussi une classe (sa couleur reste lue jusqu'à son lot) : dans construireCaracteristiques et le tableau des compétences, où `k` est la
  // caractéristique, aucune couleur
  const caracs = fiche.slice(fiche.indexOf("reconstruire($('caracs')"), fiche.indexOf("reconstruire($('competences')"));
  const competences = fiche.slice(fiche.indexOf("reconstruire($('competences')"), fiche.indexOf("el('tbody'", fiche.indexOf("reconstruire($('competences')")));
  assert.ok(caracs.length > 100 && competences.length > 50, 'les deux blocs trouvés');
  for (const bloc of [caracs, competences]) assert.doesNotMatch(bloc, /\bk\??\.(?:couleur|texte)\b|--c(?:-texte)?:/, 'aucune couleur de la caractéristique `k`');
  assert.doesNotMatch(fiche, /--c-texte: \$\{|setProperty\('--c-texte'|--texte-sur-c: \$\{p/, 'aucune variable de ces couleurs posée');
  for (const attendu of [
    "el('div', { class: ['carac', ...teinteDe(k)].join(' ') }", "el('div', { class: ['competences__groupe', ...teinteDe(k)].join(' ') }",
    "class: ['posture-carte', ...teinteDe(p)].join(' ')", 'poserTeinte(posture, teinteDe(p?.posture));',
    'poserTeinte(sortie, teinteDe(regles.alignements?.[a.nom] ?? regles.alignement_par_defaut));', 'teinte: caracDe(o.competence_id)',
    "class: ['invocation-carte__carac', ...teinteDe(carac ?? regles.caracteristique_par_defaut)].join(' ')",
  ]) assert.ok(fiche.includes(attendu), attendu);
  // les modules lus par le navigateur n'importent pas la palette (elle tire tous les modules des règles : skill site-version-portable)
  for (const f of ['src/scripts/fiche.mjs', 'src/scripts/personnages.mjs', 'src/lib/personnages-liste.mjs']) assert.doesNotMatch(lire(f), /^import [^;]*palette-css\.mjs';$/m, f);
});

// Lot des catégories de classe, des races et du reste de la fiche (2026-10-23, même demande et mêmes choix de cadrage) : la couleur d'une catégorie de
// classe, d'une race, d'un palier de résistance, du Mode Hyper et ce que la fiche montre sans couleur de règle passent par leur classe de la palette.

test('les feuilles des classes, des races et du reste de la fiche lisent les propriétés que posent les classes ; les couleurs d’interface viennent du thème', () => {
  const { fond, texte } = proprietes();
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
  };
  // la page d'une classe, /classes/ : --cla (et son texte) tiré de la classe de la catégorie ; la page d'une race, /races/ : --rac, de sa nature
  dans('src/styles/classe/base.css', '.classe', [`--cla: var(${fond}, var(--muted));`, `--cla-texte: var(${texte}, var(--texte-sur-fonce));`,
    '--hero-1: color-mix(in srgb, var(--cla) 35%, var(--fond-banniere));']);
  dans('src/styles/classe/liste.css', '.classes-groupe', `--cla: var(${fond}, var(--muted));`);
  dans('src/styles/race/base.css', '.race', [`--rac: var(${fond}, var(--muted));`, '--hero-1: color-mix(in srgb, var(--rac) 45%, var(--fond-banniere));']);
  dans('src/styles/race/liste.css', '.races-groupe', `--rac: var(${fond}, var(--muted));`);
  // les bannières des magies retrouvent le noir #111 d'avant le lot 2, par le même jeton
  dans('src/styles/magie/base.css', '.magie, .magie-teinte', ['--hero-1: color-mix(in srgb, var(--mag) 35%, var(--fond-banniere));',
    '--hero-2: color-mix(in srgb, var(--mag) 45%, var(--fond-banniere));']);
  for (const [f, s] of [['src/styles/classe/page.css', '.classe-hero'], ['src/styles/race/page.css', '.race-hero'], ['src/styles/magie/page.css', '.magie-hero']]) {
    dans(f, s, 'color: var(--texte-sur-fonce);');
  }
  // la fiche : le trait d'un palier (seulement sur une ligne qui porte sa classe : la fiche porte celle de sa magie innée), le texte des pastilles pleines
  dans('src/styles/fiche/fiche.css', ".resistances__table tr[class*='couleur-palier-']", `--r: var(${fond});`);
  dans('src/styles/fiche/fiche.css', ".pastille[aria-pressed='true']", 'color: var(--texte-sur-c, var(--texte-sur-fonce));');
  dans('src/styles/fiche/fiche.css', '.choix__pastille', 'color: var(--texte-sur-c, var(--texte-sur-fonce));');
  const fiche = lire('src/styles/fiche/fiche.css');
  assert.doesNotMatch(fiche, /\.posture-carte--(?:hyper|cent) \{ --c:/, 'le Mode Hyper : sa classe, plus de --c écrit');
  assert.doesNotMatch(fiche, /tr\[data-palier='[a-z_]+'\] \{ --r:/, 'les paliers : leur classe, plus de --r écrit');
  // les couleurs d'interface sans règle : des jetons du thème, avec leur valeur d'avant (styles/global/base.css ; « Thème reste, Debug à part »)
  const theme = lire('src/styles/global/base.css');
  const jeton = (nom) => theme.match(new RegExp(`\\n {2}${nom}: (#[0-9a-f]{3,6});`))?.[1];
  assert.deepEqual(['--texte-sur-fonce', '--fond-banniere', '--vert-action', '--a-choisir', '--a-choisir-plein', '--etoile'].map(jeton),
    ['#fff', '#111', '#2e7d4f', '#b45309', '#b45309', '#c99a06']);
  assert.equal((theme.match(/\n {2,4}--a-choisir: #f0a14a;/g) ?? []).length, 2, '--a-choisir du thème sombre (préférence du système et choix du site)');
  assert.doesNotMatch(fiche, /--a-choisir:|--vert: #/, 'la fiche ne les écrit plus');
  for (const [selecteur, attendu] of [['.sort-remarque', 'color: var(--etoile);'], ['.objet__etoile', 'color: var(--etoile);'],
    ['.onglet__compte--attente', 'background: var(--a-choisir-plein);'], ['.ceinture__numero', 'color: var(--texte-sur-fonce);'],
    [".budget[data-etat='manque']", 'color: var(--a-choisir);']]) dans('src/styles/fiche/fiche.css', selecteur, attendu);
});

test('les classes de ce lot posées par les pages, l’éditeur et la fiche : des noms de la palette, jamais une couleur ni un repli écrit', () => {
  // les gabarits : la classe sur l'élément, plus de --couleur-classe, --couleur-texte-classe ni --couleur-race en style
  for (const f of ['src/components/classes/ClassesPastilles.astro', 'src/components/classes/ClassePage.astro', 'src/components/race/RacesPastilles.astro',
    'src/components/race/RacePage.astro', 'src/scripts/edition/nouvelles.mjs']) {
    assert.doesNotMatch(lire(f), /--couleur-(?:classe|texte-classe|race)|style=\{?`?["']?--c/, f);
  }
  assert.match(lire('src/components/classes/ClassesPastilles.astro'), /<section class=\{`classes-groupe \$\{classeDeCategorie\(group\.key\)\}`\} id=\{group\.key\}>/);
  assert.match(lire('src/components/classes/ClassePage.astro'), /const couleur = classeDUneClasse\(entry\);[^]*<div class=\{`classe \$\{couleur\}`\}/);
  assert.match(lire('src/components/race/RacesPastilles.astro'), /<section class=\{`races-groupe \$\{classeDeRace\(group\.nature\)\}`\} id=\{group\.key\}>/);
  assert.match(lire('src/components/race/RacePage.astro'), /<div class=\{`race race--\$\{hybride \? 'hybride' : 'pure'\} \$\{classeDeRace\(hybride \? 'hybride' : 'pure'\)\}`\}>/);
  const nouvelles = lire('src/scripts/edition/nouvelles.mjs');
  assert.ok(nouvelles.includes(`<div class="race race--\${hybride ? 'hybride' : 'pure'} \${classeDeRace(hybride ? 'hybride' : 'pure')}">`), 'race créée');
  assert.ok(nouvelles.includes('const couleur = classeDUneClasse({ id, data: { tags } });') && nouvelles.includes('<div class="classe ${couleur}" data-ed-classe='), 'classe créée');
  // le script de la fiche : chaque pastille, groupe et choix fait pose une classe (teinteDe), jamais `--c` en style ni une couleur reçue ou écrite
  const fiche = lire('src/scripts/fiche.mjs');
  assert.doesNotMatch(fiche, /style: `--c|--texte-sur-c: \$\{|\bcouleur: (?:'#|r\.couleur|race|k\.couleur|c\.classe)|\.couleur \?\?|#6b5a45|#8a7a66/, 'aucune couleur de race, de classe ni de neutre');
  assert.doesNotMatch(fiche, /\b(?:r|race|k|g|c\.classe|d\.classe)\??\.couleur\b/, 'aucune couleur de race ni de classe lue');
  for (const attendu of [
    "groupe(titre, regles.race_par_nature[nature], races.map((r) => pastille({", "texte: r.nom, teinte: r,", "teinte: race ?? regles.neutre,",
    "pastille({ texte: 'Aucune', teinte: regles.neutre,", "texte: o.texte, teinte: regles.neutre,", "groupes.map((g) => groupe(g.label, g, g.classes.map((k) => pastille({",
    "class: ['dons-classe', ...teinteDe(c.classe)].join(' ')", "class: trouver(regles.resistance_paliers, p.id)?.classe ?? null, dataset: { palier: p.id }",
    "...teinteDe(regles.mode_hyper)]", "...teinteDe(regles.mode_hyper.cent)]",
  ]) assert.ok(fiche.includes(attendu), attendu);
  assert.match(fiche, /function groupe\(titre, teinte, elements\) \{\n {2}return el\('div', \{ class: \['groupe-pastilles', \.\.\.teinteDe\(teinte\)\]\.join\(' '\) \},\n {4}el\('h4', \{\}, el\('span', \{ class: 'pastille__point', 'aria-hidden': 'true' \}\), titre\),/);
  // les modules lus par le navigateur n'importent pas les modules de ces règles (les noms arrivent par regles.json)
  assert.doesNotMatch(fiche, /^import [^;]*(?:class-groups|race-kinds|fiche-couleurs)\.mjs';$/m);
});

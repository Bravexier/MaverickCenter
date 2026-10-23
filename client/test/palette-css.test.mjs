// La palette du site en classes CSS (lib/palette-css.mjs ; demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site.
// Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. », puis « La classe CSS du
// site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. » ; choix de
// cadrage « Module JS → classe », « Règle de calcul », « Garder séparées ») : une classe par couleur des règles, sa valeur lue dans le module de sa
// règle, lisible (« Privilégé la lisibilité. ») ; les combinaisons des potions calculées depuis leur classe de base ; le module n'écrit aucune couleur.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  CLASSE_DES_ARMES_DE_DEPART, CLASSE_NEUTRE, FAMILLES_DE_CHAQUE_PAGE, FAMILLES_DE_LA_FICHE, FAMILLES_SANS_TEXTE, FAMILLES_DE_LA_PALETTE, FAMILLES_DES_ZONES,
  MAGIE_PAR_DEFAUT, PAR_DEFAUT, classeDAffinite, classeDAlignement, classeDeMateriau, classeDuPoids, classeDuTypeDArmure,
  classeDAttribut, classeDUneClasse, classeDeCaracteristique, classeDeCategorie, classeDeCouleur, classeDeMagie, classeDePalier, classeDePosture,
  classeDeNiveau, classeDePartie, classeDePotion, cssDesParties, classeDeRace, classeDeSecondeCaracteristique, classeDeSecondeMagie, classeDuModeHyper, classesDeDeuxCaracteristiques,
  classesDeDeuxMagies, classesDeLaPalette, couleursDeLaPalette, cssDeLaPalette, cssDesEvenements, cssDesFamilles, cssDesPotions, cssDesSecondsRangs, idDeCouleur,
  secondsRangs, secondsRangsDesMagies, classeDEvenement, classeDeGenre, classeDeTypeDeDon,
} from '../src/lib/palette-css.mjs';
import { COULEURS_DES_GENRES, COULEURS_DES_TYPES_DE_DON } from '../src/lib/genres-couleurs.mjs';
import { TYPES_DE_SORT } from '../src/lib/sort-analyse.mjs';
import { TYPES_DE_DON } from '../src/lib/classe-champs.mjs';
import { RENDUS } from '../src/lib/edition-rendu.mjs';
import {
  AFFINITE_DES_PHILTRES, ATTRIBUT_DE_L_AFFINITE, CONTRASTE_MINIMAL, COULEURS_CHOISIES_PAR_PAGE, COULEURS_DES_AFFINITES, NUANCES_DES_NIVEAUX, contraste, couleurDePotion, lisible,
  nuanceDuNiveau,
} from '../src/lib/alchimie-couleurs.mjs';
import { COULEURS_DES_ATTRIBUTS } from '../src/lib/attributs-couleurs.mjs';
import { COULEUR_NEUTRE, COULEURS_ALIGNEMENTS, COULEURS_CARACTERISTIQUES, COULEURS_POSTURES } from '../src/lib/caracteristiques-postures.mjs';
import { COULEUR_PAR_DEFAUT, COULEURS_DES_MAGIES, couleurDeMagie, couleurDeMagieConnue, texteSurCouleur } from '../src/lib/sort-format.mjs';
import { CLASS_COLORS, CLASS_GROUPS, classColor } from '../src/lib/class-groups.mjs';
import { RACE_COLORS } from '../src/lib/race-kinds.mjs';
import { COULEURS_DES_PALIERS, COULEURS_DU_MODE_HYPER } from '../src/lib/fiche-couleurs.mjs';
import { COULEURS_DES_MATERIAUX } from '../src/lib/materiaux-couleurs.mjs';
import { COULEUR_SANS_TYPE, COULEURS_DES_ARMES, COULEURS_DES_POIDS, COULEURS_DES_TYPES } from '../src/lib/equipement-couleurs.mjs';
import { COULEURS_DES_NIVEAUX } from '../src/lib/accessoires-couleurs.mjs';
import { COULEURS_DES_PARTIES } from '../src/lib/parties-couleurs.mjs';
import { PARTIES, partieDeLaPage, RUBRIQUES_DU_GUIDE, RUBRIQUES_SOUS_LA_PAGE } from '../src/lib/livres.mjs';
import { COULEUR_AUJOURDHUI, COULEUR_INCONNUE, couleursDesEvenements } from '../src/lib/chronologie-couleurs.mjs';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const HEX = /(?<!&)#[0-9a-f]{6}\b|(?<!&)#[0-9a-f]{3}\b/gi;
/** Les règles d'une feuille fabriquée : Map(classe → { propriété: valeur }). */
const regles = (css) => new Map([...css.matchAll(/\.([a-z0-9-]+)\{([^}]*)\}/g)].map(([, classe, corps]) =>
  [classe, Object.fromEntries(corps.split(';').filter(Boolean).map((d) => d.split(':')))]));

test('dix-neuf familles, chacune lue dans le module de sa règle : magies, attributs, caractéristiques, affinités sans autre règle, postures, alignements, catégories de classe, races, paliers de résistance, Mode Hyper, neutre, matériaux, armes de départ, types d’armure, poids des boucliers, niveaux des accessoires, parties du guide, genres de sort, types de don (et la couleur par défaut de sept d’entre elles)', () => {
  assert.deepEqual(Object.keys(FAMILLES_DE_LA_PALETTE), ['magie', 'attribut', 'caracteristique', 'affinite', 'posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre',
    'materiau', 'arme', 'armure', 'poids', 'niveau', 'partie', 'genre', 'don']);
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
  // lot des matériaux, des armes et des armures : les couleurs du classeur restent dans leur module (materiaux-couleurs.mjs, equipement-couleurs.mjs) ;
  // un matériau sans couleur a le neutre du site (aucune valeur ajoutée), un type ou un poids sans couleur le gris sans type, une seule valeur pour les deux
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.materiau, { ...COULEURS_DES_MATERIAUX, [PAR_DEFAUT]: COULEUR_NEUTRE });
  assert.equal(FAMILLES_DE_LA_PALETTE.arme, COULEURS_DES_ARMES);
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.armure, { ...COULEURS_DES_TYPES, [PAR_DEFAUT]: COULEUR_SANS_TYPE });
  assert.deepEqual(FAMILLES_DE_LA_PALETTE.poids, { ...COULEURS_DES_POIDS, [PAR_DEFAUT]: COULEUR_SANS_TYPE });
  assert.deepEqual(Object.keys(COULEURS_DES_ARMES), ['depart'], 'le bleu des armes de départ');
  // lot des accessoires : les couleurs des niveaux (celles de l'onglet du classeur) restent dans leur module, une famille à elles même quand une valeur
  // est celle d'un type d'armure ou d'une magie (« Garder séparées ») ; pas de `par-defaut` (un niveau absent ne porte aucune couleur)
  assert.equal(FAMILLES_DE_LA_PALETTE.niveau, COULEURS_DES_NIVEAUX);
  assert.deepEqual(Object.keys(COULEURS_DES_NIVEAUX), ['1', '2', '3', '4', '5'], 'les cinq niveaux d’un accessoire');
  assert.ok(!Object.hasOwn(COULEURS_DES_NIVEAUX, PAR_DEFAUT));
  // lot des parties du guide : les couleurs des parties de l'ancien guide restent dans leur module (plus dans le plan, lib/livres.mjs, que le navigateur
  // reçoit), une par partie du plan, même clé ; pas de `par-defaut` (une page sans partie ne porte aucune classe : l'accent du site)
  assert.equal(FAMILLES_DE_LA_PALETTE.partie, COULEURS_DES_PARTIES);
  assert.deepEqual(Object.keys(COULEURS_DES_PARTIES), PARTIES.map((p) => p.id), 'une couleur par partie du plan');
  assert.deepEqual(COULEURS_DES_PARTIES, { decouvrir: '#2a6f97', creer: '#2e7d4f', jouer: '#b03030', progresser: '#6a4a9c', 'plus-loin': '#5a6470' }, 'les valeurs d’avant le lot');
  assert.ok(RUBRIQUES_DU_GUIDE.every((r) => r.groupes.every((g) => Object.hasOwn(COULEURS_DES_PARTIES, g.partie))), 'chaque groupe du plan, la partie d’une couleur');
  assert.ok(!Object.hasOwn(COULEURS_DES_PARTIES, PAR_DEFAUT));
  assert.deepEqual(Object.keys(COULEURS_DES_TYPES), ['Léger', 'Intermédiaire', 'Lourd'], 'les trois types de la légende de la grille');
  assert.deepEqual(Object.keys(CLASS_COLORS), CLASS_GROUPS.map((g) => g.key), 'une couleur par catégorie de /classes/');
  assert.deepEqual(Object.keys(RACE_COLORS), ['pure', 'hybride'], 'une couleur par nature de race (race-kinds.mjs#raceKind)');
  assert.deepEqual(Object.keys(COULEURS_DU_MODE_HYPER), ['hyper', 'cent'], 'le Mode Hyper et le Mode Hyper 100 %');
  // les caractéristiques, les postures et les paliers de résistance : une par ligne de la base (leurs ids sont ceux des classes)
  const db = ouvrirBase();
  assert.deepEqual(Object.keys(COULEURS_CARACTERISTIQUES).sort(), db.prepare('SELECT id FROM caracteristique').all().map((c) => c.id).sort());
  assert.deepEqual(Object.keys(COULEURS_POSTURES).sort(), db.prepare('SELECT id FROM posture').all().map((p) => p.id.split(':').at(-1)).sort());
  assert.deepEqual(Object.keys(COULEURS_DES_PALIERS), db.prepare('SELECT id FROM resistance_palier ORDER BY ordre').all().map((p) => p.id));
  // les poids des boucliers : un par ligne de bouclier_poids (les matériaux : test/materiaux-couleurs.test.mjs). Les types : une couleur par type que le
  // schéma admet (le CHECK de materiau.type), hors « Autres », sans couleur dans la source ; tout type présent dans la base en est un (invariant : le site
  // de dev peut changer le type d'un matériau)
  assert.deepEqual(Object.keys(COULEURS_DES_POIDS), db.prepare('SELECT id FROM bouclier_poids ORDER BY ordre').all().map((p) => p.id));
  const check = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8').match(/CREATE TABLE materiau \([^]*?\btype\s+TEXT\s+NOT NULL CHECK \(type IN \(([^)]*)\)\)/);
  assert.ok(check, 'le CHECK de materiau.type dans data/schema.sql');
  const typesDuSchema = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(typesDuSchema.includes('Autres'), typesDuSchema.join());
  assert.deepEqual(Object.keys(COULEURS_DES_TYPES).sort(), typesDuSchema.filter((t) => t !== 'Autres').sort());
  for (const { type } of db.prepare('SELECT DISTINCT type FROM materiau').all()) {
    assert.ok(Object.hasOwn(COULEURS_DES_TYPES, type) || type === 'Autres', `type de la base : ${type}`);
  }
  // chaque famille est émise sur chaque page ou par les pages de sa zone, jamais les deux
  assert.deepEqual([...FAMILLES_DE_CHAQUE_PAGE, ...FAMILLES_DES_ZONES].sort(), Object.keys(FAMILLES_DE_LA_PALETTE).sort());
  assert.deepEqual(FAMILLES_DE_CHAQUE_PAGE, ['magie', 'attribut', 'caracteristique', 'affinite']);
  assert.deepEqual(FAMILLES_DES_ZONES, ['posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre', 'materiau', 'arme', 'armure', 'poids', 'niveau', 'partie', 'genre', 'don']);
  // la fiche : les familles d'une zone qu'elle pose, sans celles des onglets de l'équipement hors le poids du bouclier ; plus les parties du guide (ses
  // quatre zones)
  assert.deepEqual(FAMILLES_DE_LA_FICHE, ['posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre', 'poids', 'partie']);
  assert.ok(FAMILLES_DE_LA_FICHE.every((f) => FAMILLES_DES_ZONES.includes(f)));
});

test('le nom d’une classe : « couleur-<famille>-<id> », l’id = la clé du module normalisée, unique, sans caractère à échapper en CSS', () => {
  assert.equal(classeDeMagie('Feu'), 'couleur-magie-feu');
  assert.equal(classeDeMagie('Espace-Temps'), 'couleur-magie-espace-temps');
  assert.equal(classeDeMagie('potentiel-illimite'), 'couleur-magie-potentiel-illimite');
  assert.equal(classeDeMagie('Lumière'), 'couleur-magie-lumiere');
  assert.equal(classeDeMagie('Inconnue'), `couleur-magie-${MAGIE_PAR_DEFAUT}`, 'une magie inconnue : la couleur par défaut, comme couleurDeMagie');
  assert.equal(classeDAttribut('sante'), 'couleur-attribut-sante');
  assert.equal(classeDAttribut('barre4'), null, 'la 4ᵉ barre : la classe de sa magie (2026-10-23)');
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
  // lot des matériaux, des armes et des armures
  assert.equal(classeDeMateriau('ressources/armures#materiau:fer-noir'), 'couleur-materiau-fer-noir');
  assert.equal(classeDeMateriau('ressources/armures#materiau:cuir'), `couleur-materiau-${PAR_DEFAUT}`, 'sans couleur : la classe par défaut');
  assert.equal(classeDeMateriau(undefined), `couleur-materiau-${PAR_DEFAUT}`);
  assert.equal(CLASSE_DES_ARMES_DE_DEPART, 'couleur-arme-depart');
  assert.deepEqual(['Léger', 'Intermédiaire', 'Lourd', 'Autres', null].map(classeDuTypeDArmure),
    ['couleur-armure-leger', 'couleur-armure-intermediaire', 'couleur-armure-lourd', `couleur-armure-${PAR_DEFAUT}`, `couleur-armure-${PAR_DEFAUT}`]);
  assert.deepEqual(['leger', 'tres-lourd', 'plume'].map(classeDuPoids), ['couleur-poids-leger', 'couleur-poids-tres-lourd', `couleur-poids-${PAR_DEFAUT}`]);
  // lot des accessoires : un niveau absent ou inconnu n'a pas de classe (pas de `par-defaut`), comme il n'avait pas de couleur
  assert.deepEqual([1, '5', null, undefined, 6].map(classeDeNiveau), ['couleur-niveau-1', 'couleur-niveau-5', null, null, null]);
  assert.notEqual(classeDeNiveau(1), classeDuTypeDArmure('Léger'), 'la même valeur, deux classes');
  // lot des parties du guide : la classe d'une partie (une page de Découvrir ou des Bases, un groupe du sommaire, une zone de la fiche) ; une page sans
  // partie (Règles avancées, Guide du MJ) n'a pas de classe (pas de `par-defaut`), comme elle n'avait pas de couleur
  assert.deepEqual(['decouvrir', 'creer', 'jouer', 'progresser', 'plus-loin', null, undefined, 'inconnue'].map(classeDePartie),
    ['couleur-partie-decouvrir', 'couleur-partie-creer', 'couleur-partie-jouer', 'couleur-partie-progresser', 'couleur-partie-plus-loin', null, null, null]);
  assert.equal(classeDePartie(partieDeLaPage('guide/rejoindre-une-partie')), 'couleur-partie-jouer');
  assert.equal(classeDePartie(partieDeLaPage('guide/meteo')), null, 'une page de référence');
  const classes = couleursDeLaPalette().map((c) => c.classe);
  assert.equal(classes.length, Object.values(FAMILLES_DE_LA_PALETTE).reduce((n, f) => n + Object.keys(f).length, 0));
  assert.equal(new Set(classes).size, classes.length, 'une classe par couleur');
  for (const c of classes) assert.match(c, /^couleur-(?:magie|attribut|caracteristique|affinite|posture|alignement|classe|race|palier|mode|neutre|materiau|arme|armure|poids|niveau|partie|genre|don)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
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
  // … et le Titane (lot des matériaux, des armes et des armures), la même couleur que Loyal Neutre (#3c78d8) : son texte suit la règle du site (le texte
  // foncé, 4,3:1) et non plus le noir du classeur ; le même fond que Loyal Neutre, la même correction
  assert.deepEqual(eclaircies, ['couleur-alignement-loyal-bon', 'couleur-alignement-loyal-neutre', 'couleur-materiau-titane']);
  assert.deepEqual(couleursDeLaPalette(['materiau']).find((c) => c.cle === 'titane').fond, couleursDeLaPalette(['alignement']).find((c) => c.cle === 'Loyal Neutre').fond);
  assert.equal(COULEURS_DES_MATERIAUX.titane, '#3c78d8', 'la couleur de référence reste dans son module');
  // une famille dont la couleur ne porte pas de texte (le trait d'un palier de résistance ; le bleu des armes de départ, une nuance et un filet) n'est
  // pas corrigée : le seuil de 4,5:1 vaut pour un texte ; la grande vulnérabilité garde #e53935 (4,4:1 au mieux), les armes de départ #3c78d8
  assert.deepEqual(FAMILLES_SANS_TEXTE, ['palier', 'arme', 'genre', 'don']);
  assert.equal(couleursDeLaPalette(['arme']).find((c) => c.cle === 'depart').fond, '#3c78d8');
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
  // lot des parties du guide : un texte est posé sur ces couleurs (le blanc des aplats du guide et de la fiche), la famille n'est donc pas sans texte ;
  // les cinq l'atteignent déjà (de 5,05:1 à 6,84:1 avec le blanc) : inchangées, texte blanc, le rendu d'avant
  assert.ok(!FAMILLES_SANS_TEXTE.includes('partie'));
  for (const c of couleursDeLaPalette(['partie'])) {
    assert.deepEqual([c.fond, c.texte], [COULEURS_DES_PARTIES[c.cle], '#ffffff'], c.classe);
    assert.ok(contraste(c.fond, c.texte) >= 5, `${c.classe} : ${contraste(c.fond, c.texte).toFixed(2)}:1`);
  }
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
  const cas = [...essences.map((essence) => ({ essence })), ...Object.keys(COULEURS_CARACTERISTIQUES).map((caracteristique) => ({ essence: AFFINITE_DES_PHILTRES, caracteristique })),
    ...Object.keys(COULEURS_CHOISIES_PAR_PAGE).map((page) => ({ page }))]; // les pages dont le propriétaire a choisi la couleur (2026-10-23)
  const palette = new Map(couleursDeLaPalette().map((c) => [c.classe, c]));
  let combinaisons = 0;
  for (const c of cas) for (const niveau of [...Object.keys(NUANCES_DES_NIVEAUX).map(Number), null]) {
    const couleur = couleurDePotion({ ...c, niveau });
    if (!couleur) continue;
    combinaisons++;
    const base = palette.get(classeDeCouleur(couleur.base.famille, couleur.base.cle));
    assert.ok(base, `${c.essence ?? c.page} : sa base est une classe de la palette`);
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
  assert.match(lire('src/pages/fiche/index.astro'), /<style is:inline set:html=\{cssDesFamilles\(FAMILLES_DE_LA_FICHE\)\}><\/style>/);
  assert.match(lire('src/components/armes/ArmesPage.astro'), /const secondsRangs = cssDesSecondsRangs\('caracteristique'\);[^]*<style is:inline set:html=\{secondsRangs\}><\/style>/);
  // les catégories de classe (/classes/, les pages de classe) et les races (/races/, les pages de race) ; la fiche les émet avec les autres familles
  // d'une zone (paliers, Mode Hyper, neutre compris) ; le mode modification avec la page d'une race ou d'une classe créée (la page 404 n'en a pas)
  assert.match(lire('src/components/classes/ClassesPastilles.astro'), /<style is:inline set:html=\{cssDesFamilles\(\['classe'\]\)\}><\/style>/);
  // la page d'une classe émet aussi les types de don (lot des restes)
  assert.match(lire('src/components/classes/ClassePage.astro'), /<style is:inline set:html=\{cssDesFamilles\(\['classe', 'don'\]\)\}><\/style>/);
  for (const f of ['src/components/race/RacesPastilles.astro', 'src/components/race/RacePage.astro']) {
    assert.match(lire(f), /<style is:inline set:html=\{cssDesFamilles\(\['race'\]\)\}><\/style>/, f);
  }
  const nouvelles = lire('src/scripts/edition/nouvelles.mjs');
  assert.ok(nouvelles.includes("css: [raceBaseCss, racePageCss, raceRelationsCss, cssDesFamilles(['race'])].join('\\n'),"), 'la page d’une race créée');
  assert.ok(nouvelles.includes("css: [classeBaseCss, classePageCss, cssDesFamilles(['classe'])].join('\\n'),"), 'la page d’une classe créée');
  for (const famille of ['classe', 'race', 'palier', 'mode', 'neutre']) assert.ok(FAMILLES_DES_ZONES.includes(famille), `${famille} : une famille d’une zone`);
  // les matériaux, le bleu des armes de départ (l'onglet Armes ; les matériaux aussi sur la page Composants), les types d'armure et les poids des
  // boucliers (les onglets Armures et Boucliers ; le poids aussi sur la fiche)
  assert.match(lire('src/components/armes/ArmesPage.astro'), /const couleurs = cssDesFamilles\(\['materiau', 'arme'\]\);[^]*<style is:inline set:html=\{couleurs\}><\/style>/);
  assert.match(lire('src/components/armures/ArmuresPage.astro'), /const couleurs = cssDesFamilles\(\['armure', 'poids'\]\);[^]*<style is:inline set:html=\{couleurs\}><\/style>/);
  assert.match(lire('src/components/composants/ComposantsPage.astro'), /const couleurs = cssDesFamilles\(\['materiau'\]\);[^]*<style is:inline set:html=\{couleurs\}><\/style>/);
  // les niveaux des accessoires : l'onglet Accessoires seul
  assert.match(lire('src/components/accessoires/AccessoiresPage.astro'), /const couleurs = cssDesFamilles\(\['niveau'\]\);[^]*<style is:inline set:html=\{couleurs\}><\/style>/);
  assert.doesNotMatch(lire('src/layouts/Base.astro'), /'niveau'/, 'pas sur chaque page');
  // les parties du guide : une page de Découvrir ou des Bases (seulement si elle en pose une), le sommaire (seulement si un groupe en pose une : celui des
  // Bases), l'accueil (ses cartes) et la fiche (ses zones, avec ses autres familles d'une zone) ; jamais sur chaque page
  assert.equal(cssDesParties(), cssDesFamilles(['partie']));
  assert.match(lire('src/components/guide/PageDuGuide.astro'), /\{couleur && <style is:inline set:html=\{cssDesParties\(\)\}><\/style>\}/);
  assert.match(lire('src/components/guide/Sommaire.astro'), /const enCouleur = groupes\.some\(\(g\) => g\.classe\);[^]*\{enCouleur && <style is:inline set:html=\{cssDesParties\(\)\}><\/style>\}/);
  assert.match(lire('src/pages/index.astro'), /<style is:inline set:html=\{cssDesParties\(\)\}><\/style>/);
  assert.ok(FAMILLES_DE_LA_FICHE.includes('partie') && FAMILLES_DES_ZONES.includes('partie') && !FAMILLES_DE_CHAQUE_PAGE.includes('partie'));
  assert.doesNotMatch(lire('src/layouts/Base.astro'), /'partie'/, 'pas sur chaque page');
  assert.ok(!cssDeLaPalette().includes('.couleur-partie-'), 'ni dans la feuille de chaque page (plafond de 4 ko)');
  for (const f of ['src/components/guide/PageDuGuide.astro', 'src/components/guide/Sommaire.astro', 'src/pages/index.astro']) assert.doesNotMatch(lire(f), /cssDesFamilles/, f);
  // le poids de ce que la fiche émet (les familles d'une zone qu'elle pose) reste petit
  assert.ok(cssDesFamilles(FAMILLES_DE_LA_FICHE).length < 3000, `${cssDesFamilles(FAMILLES_DE_LA_FICHE).length} octets`);
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
  assert.ok(page('fiche/index.html').includes(`<style>${cssDesFamilles(FAMILLES_DE_LA_FICHE)}</style>`), 'postures, alignements… et poids : la fiche');
  assert.ok(page('regles/les-postures/index.html').includes(`<style>${cssDesFamilles(['posture'])}</style>`), 'postures : la page du guide');
  assert.ok(page('ressources/equipement/index.html').includes(`<style>${cssDesSecondsRangs('caracteristique')}</style>`), 'seconds rangs : l’onglet Armes');
  for (const rel of ['index.html', 'ressources/equipement/index.html']) assert.ok(!page(rel).includes('.couleur-posture-'), `${rel} : pas de postures`);
  // les catégories de classe et les races : sur leurs listes et leurs pages, et seulement là (et la fiche)
  assert.ok(page('classes/index.html').includes(`<style>${cssDesFamilles(['classe'])}</style>`), 'classes : la liste');
  assert.ok(page('classes/guerrier/index.html').includes(`<style>${cssDesFamilles(['classe', 'don'])}</style>`), 'classes et types de don : la page d’une classe');
  // les genres de sort : sur les pages des magies seules
  assert.ok(page('magies/magie-du-feu/index.html').includes(`<style>${cssDesFamilles(['genre'])}</style>`), 'genres : la page d’une magie');
  for (const rel of ['index.html', 'classes/index.html', 'races/humain/index.html']) assert.ok(!/\.couleur-(?:genre|don)-/.test(page(rel)), `${rel} : ni genres ni types`);
  for (const rel of ['races/index.html', 'races/humain/index.html']) assert.ok(page(rel).includes(`<style>${cssDesFamilles(['race'])}</style>`), `races : ${rel}`);
  for (const rel of ['index.html', 'magies/index.html']) assert.ok(!/\.couleur-(?:classe|race|palier|mode|neutre)-/.test(page(rel)), `${rel} : pas de ces familles`);
  // les matériaux, les armes de départ, les types d'armure et les poids : l'équipement, les composants (matériaux), la fiche (poids)
  const equipement = page('ressources/equipement/index.html');
  assert.ok(equipement.includes(`<style>${cssDesFamilles(['materiau', 'arme'])}</style>`) && equipement.includes(`<style>${cssDesFamilles(['armure', 'poids'])}</style>`), 'l’équipement');
  assert.ok(page('ressources/composants/index.html').includes(`<style>${cssDesFamilles(['materiau'])}</style>`), 'les composants');
  assert.ok(!/\.couleur-(?:materiau|arme|armure)-/.test(page('fiche/index.html')), 'la fiche : le poids seulement');
  for (const rel of ['index.html', 'magies/index.html']) assert.ok(!/\.couleur-(?:materiau|arme|armure|poids)-/.test(page(rel)), `${rel} : pas de ces familles`);
  // les niveaux des accessoires : l'onglet Accessoires de l'équipement, et seulement là
  assert.ok(equipement.includes(`<style>${cssDesFamilles(['niveau'])}</style>`), 'les niveaux : l’onglet Accessoires');
  for (const rel of ['index.html', 'magies/index.html', 'fiche/index.html', 'ressources/composants/index.html']) assert.ok(!/\.couleur-niveau-/.test(page(rel)), `${rel} : pas des niveaux`);
  // les parties du guide : l'accueil, le sommaire des Bases, une page de Découvrir ou des Bases (la fiche : avec ses familles, ci-dessus) ; ni une page de
  // référence du guide, ni une autre page
  for (const rel of ['index.html', 'regles/index.html', 'decouvrir/index.html', 'regles/les-postures/index.html']) {
    assert.ok(page(rel).includes(`<style>${cssDesFamilles(['partie'])}</style>`), `les parties : ${rel}`);
  }
  for (const rel of ['magies/index.html', 'ressources/equipement/index.html', 'regles/avancees/index.html', 'mj/index.html']) assert.ok(!/\.couleur-partie-[a-z-]+\{/.test(page(rel)), `${rel} : pas des parties`);
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
 * leurs couleurs ; les feuilles des pages de classe et de race (page.css, dons.css, race/base.css, relations.css) sont contrôlées ici dans leurs
 * règles de ce lot, et en entier par le balayage du lot des restes (hors l'impression et les types de don, laissés de côté, nommés).
 */
const FICHIERS_DU_LOT_DES_CLASSES_ET_RACES = [
  'src/components/classes/ClassesPastilles.astro', 'src/components/race/RacesPastilles.astro', 'src/scripts/edition/nouvelles.mjs', 'src/scripts/fiche.mjs',
  'src/styles/classe/base.css', 'src/styles/classe/liste.css', 'src/styles/race/liste.css', 'src/styles/fiche/fiche.css',
];
/**
 * Les fichiers propres au lot des matériaux, des armes de départ, des types d'armure et des poids des boucliers (onglets Armes, Armures et Boucliers,
 * page Composants, tuile du poids de la fiche), hors ceux des lots d'avant : contrôlés en entier. Les modules des règles (materiaux-couleurs.mjs,
 * equipement-couleurs.mjs) écrivent leurs couleurs.
 */
const FICHIERS_DU_LOT_DES_ARMES_ET_ARMURES = [
  'src/lib/armures-rendu.mjs', 'src/components/armures/ArmuresPage.astro', 'src/components/composants/ComposantsPage.astro',
  'src/components/equipement/EquipementPage.astro', 'src/scripts/armes.mjs', 'src/scripts/armures.mjs', 'src/styles/armes/armes.css',
  'src/styles/armures/armures.css', 'src/styles/equipement/equipement.css',
];
/**
 * Les fichiers propres au lot des niveaux des accessoires (onglet Accessoires de l'équipement), hors ceux des lots d'avant (le gabarit de l'onglet,
 * GemmesDeLEffet.astro et lib/accessoires-db.mjs sont déjà dans le lot des magies) : contrôlés en entier. Le module de la règle
 * (lib/accessoires-couleurs.mjs) écrit ses couleurs, comme les autres modules des couleurs.
 */
const FICHIERS_DU_LOT_DES_ACCESSOIRES = ['src/lib/accessoires-generateur.mjs', 'src/scripts/accessoires.mjs', 'src/styles/accessoires/accessoires.css'];
/**
 * Les fichiers du lot de la chronologie (la frise, la page d'un événement, son éditeur du site de dev) : contrôlés en entier. Le module de la règle
 * (lib/chronologie-couleurs.mjs) écrit ses couleurs, comme les autres modules des couleurs.
 */
const FICHIERS_DU_LOT_DE_LA_CHRONOLOGIE = [
  'src/styles/chronologie/chronologie.css', 'src/components/chronologie/Frise.astro', 'src/components/chronologie/Chronologie.astro',
  'src/components/chronologie/ChronologieEvenement.astro', 'src/pages/chronologie/index.astro', 'src/pages/chronologie/[slug].astro',
  'src/lib/chronologie.mjs', 'src/lib/chronologie-rendu.mjs', 'src/lib/chronologie-db.mjs', 'src/scripts/edition/chronologie.mjs',
];
/**
 * Les fichiers du lot des parties du guide (les pages de Découvrir et des Bases, l'accueil, le sommaire des Bases ; la fiche et sa feuille sont déjà en
 * entier dans les lots d'avant) : contrôlés en entier. Le module de la règle (lib/parties-couleurs.mjs) écrit ses couleurs, comme les autres modules des
 * couleurs ; de styles/global/wiki.css, seules les règles du sommaire (`var(--couleur)`, `var(--sommaire-couleur)`) sont de ce lot, ses cases
 * `{couleur:x}` restent à un lot à venir.
 */
const FICHIERS_DU_LOT_DES_PARTIES = [
  'src/lib/livres.mjs', 'src/lib/guide.mjs', 'src/components/guide/PageDuGuide.astro', 'src/components/guide/Sommaire.astro', 'src/pages/index.astro',
  'src/pages/regles/index.astro', 'src/styles/accueil/accueil.css', 'src/styles/guide/blocs.css',
];
/**
 * Les fichiers du lot des archives et de la mise à jour (/archives/, /mise-a-jour/ et ses boîtes de dialogue, /maintenance/) : contrôlés en entier. Aucune
 * famille de la palette : leurs couleurs d'interface, sans règle du jeu, sont des jetons du thème (styles/global/base.css).
 */
const FICHIERS_DU_LOT_DES_ARCHIVES_ET_DE_LA_MISE_A_JOUR = [
  'src/styles/archives/archives.css', 'src/pages/archives.astro', 'src/lib/archives.mjs',
  'src/styles/mise-a-jour/mise-a-jour.css', 'src/pages/mise-a-jour.astro', 'src/scripts/mise-a-jour.mjs', 'src/lib/notes-de-version.mjs',
  'src/lib/notes-de-version-sens.mjs', 'src/lib/notes-de-version-rendu.mjs', 'src/lib/conflits-rendu.mjs',
  'src/styles/maintenance/maintenance.css', 'src/pages/maintenance.astro', 'src/scripts/maintenance.mjs', 'src/lib/maintenance-retour.mjs',
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
 * (`var(--texte-sur-fonce)`, `var(--fond-banniere)` : un `color: #fff` remis là se verrait), le bleu des armes de départ tiré de sa classe
 * (`var(--depart…)`), les jetons du lot des matériaux, des armes et des armures (`var(--degats-…)`, `var(--defense-ap|am)`, `var(--ombre-fiche)`) et ceux
 * du lot des accessoires (`var(--maudit)`, `var(--maudit-texte)`, `var(--maudit-choisi)`, `var(--ombre-encart)`) et de la chronologie (`var(--ombre-evenement)`,
 * `var(--ombre-barre-du-bas)`, `var(--ombre-poignee)`, `var(--ombre-tiroir)`, `var(--voile-tiroir)`) et des parties du guide (`var(--sommaire-couleur)`,
 * `var(--guide…)`, `var(--etape…)`) et des archives et de la mise à jour (`var(--doc-google…)`, `var(--sheet-google…)`, `var(--amelioration…)`,
 * `var(--affaiblissement…)`, `var(--texte-sur-good)`) ;
 * [{ fichier, selecteur, corps }], commentaires retirés.
 */
const reglesQuiLisentLaPalette = () => readdirSync(new URL('../src/styles/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.css'))
  .flatMap((n) => [...lire(`src/styles/${n}`).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    // les blocs du thème (`:root…` de global/base.css) écrivent ses jetons (« Thème reste ») : `--maudit-texte: var(--maudit)` n'y est pas une règle
    // d'un lot ; le reste de base.css est lu comme toute feuille
    .filter(([, selecteur]) => !(n === join('global', 'base.css') && selecteur.trim().startsWith(':root')))
    .filter(([, , corps]) => /var\(--(?:couleur(?:-texte|-2)?|mag(?:-[a-z]+)?)[,)]/.test(corps)
      || (FEUILLES_DES_VARIABLES_DE_LA_PALETTE.has(`src/styles/${n}`) && /var\(--(?:c|c1|c2|c-texte|texte-sur-c)[,)]/.test(corps))
      || (FEUILLES_DES_CLASSES_ET_RACES.test(`src/styles/${n}`) && /var\(--(?:cla|rac)(?:-[a-z]+)?[,)]|var\(--hero-[12]\)/.test(corps))
      || /var\(--(?:texte-sur-fonce|fond-banniere|depart(?:-[a-z]+)*|degats-[a-z]+|defense-a[pm]|ombre-fiche|maudit(?:-texte|-choisi)?|ombre-encart|ombre-evenement|ombre-barre-du-bas|ombre-poignee|ombre-tiroir|voile-tiroir|sommaire-couleur|guide(?:-[a-z]+)?|etape(?:-[a-z]+)?|(?:doc|sheet)-google(?:-fond)?|(?:amelioration|affaiblissement)(?:-fond)?|texte-sur-good)[,)]/.test(corps))
    .map(([, selecteur, corps]) => ({ fichier: `src/styles/${n}`, selecteur: selecteur.trim().replace(/\s+/g, ' '), corps })));
test('aucune couleur écrite dans les fichiers des lots faits (ni dans les règles de ces lots des feuilles partagées), hors le noir et le blanc de mélange', () => {
  for (const f of [...FICHIERS_DU_LOT_DES_MAGIES, ...FICHIERS_DU_LOT_DES_CARACTERISTIQUES, ...FICHIERS_DU_LOT_DES_CLASSES_ET_RACES, ...FICHIERS_DU_LOT_DES_ARMES_ET_ARMURES,
    ...FICHIERS_DU_LOT_DES_ACCESSOIRES, ...FICHIERS_DU_LOT_DE_LA_CHRONOLOGIE, ...FICHIERS_DU_LOT_DES_PARTIES, ...FICHIERS_DU_LOT_DES_ARCHIVES_ET_DE_LA_MISE_A_JOUR]) {
    assert.deepEqual(couleursDuFichier(f), [], f);
  }
  const regles = reglesQuiLisentLaPalette();
  assert.ok(regles.length > 160, `${regles.length} règles des lots faits`);
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
    'src/styles/fiche/fiche.css .dons-classe > h4',
    // lot des matériaux, des armes de départ, des types d'armure et des poids des boucliers
    'src/styles/armes/armes.css .materiau', 'src/styles/armes/armes.css .arme-fiche__materiau', 'src/styles/armes/armes.css .armes',
    'src/styles/armes/armes.css .armes__phrase-depart', 'src/styles/armes/armes.css .arme--depart > .arme__nom, .arme--depart + .arme-suite > .arme-suite__marge',
    'src/styles/armes/armes.css .arme-dgt--frappe',
    // les armes élémentaires (R167) : leurs lignes sur le fond de leur magie, sa pastille dans la fiche de l'arme
    'src/styles/armes/armes.css .arme--elementaire > *, .arme-suite--elementaire > *', 'src/styles/armes/armes.css .arme-fiche__magie',
    'src/styles/armures/armures.css .pmat__nom', 'src/styles/armures/armures.css .ptype, .pmat-pastille, .ppoids',
    'src/styles/armures/armures.css .poids__nom', 'src/styles/armures/armures.css .pdef__ap', 'src/styles/armures/armures.css .pdef__am',
    'src/styles/armures/armures.css .pdgt--frappe', 'src/styles/composants/composants.css .comp-teinte', 'src/styles/equipement/equipement.css .arme-dgt--taille, .pdgt--taille',
    'src/styles/equipement/equipement.css .arme-fiche, .pfiche', "src/styles/fiche/fiche.css .bouclier__tuile[data-poids]",
    // lot des niveaux des accessoires
    "src/styles/accessoires/accessoires.css .acc-niveau-pastille[class*='couleur-niveau-']", "src/styles/accessoires/accessoires.css .acc-ligne[class*='couleur-niveau-'] > *",
    "src/styles/accessoires/accessoires.css .acc-ligne[class*='couleur-niveau-'] > .acc-jet", "src/styles/accessoires/accessoires.css .acc-produit[class*='couleur-niveau-']",
    "src/styles/accessoires/accessoires.css .acc :where(.acc-ligne[class*='couleur-niveau-']) .acc-de--acquis", 'src/styles/accessoires/accessoires.css .acc-produit',
    'src/styles/accessoires/accessoires.css .acc-ligne--malediction > *', 'src/styles/accessoires/accessoires.css .acc-produit.est-maudit',
    'src/styles/accessoires/accessoires.css .acc-produit.est-detruit .acc-produit__titre', 'src/styles/accessoires/accessoires.css .acc-produit__sur strong',
    "src/styles/accessoires/accessoires.css .acc-produit[class*='couleur-niveau-'] .acc-produit__sur strong",
    "src/styles/accessoires/accessoires.css .acc tr.acc-ligne--malediction[data-choix]:not([class*='couleur-niveau-']).est-choisi > *",
    // lot de la chronologie
    "src/styles/chronologie/chronologie.css .chrono", "src/styles/chronologie/chronologie.css .chrono[class*='couleur-evenement-']",
    "src/styles/chronologie/chronologie.css .frise__evenement[class*='couleur-evenement-']", "src/styles/chronologie/chronologie.css .frise__barre[class*='couleur-evenement-']",
    "src/styles/chronologie/chronologie.css .frise__morceau[class*='couleur-evenement-']", 'src/styles/chronologie/chronologie.css .chrono-page',
    "src/styles/chronologie/chronologie.css html.js .frise-voile:not([hidden])",
    // lot des parties du guide
    "src/styles/global/wiki.css .sommaire[class*='couleur-partie-']", 'src/styles/global/wiki.css .sommaire--couleur > h2',
    "src/styles/guide/blocs.css .guide-reference[class*='couleur-partie-']", 'src/styles/guide/blocs.css .guide-rubriques__lien:hover, .guide-rubriques__lien:focus-visible',
    "src/styles/fiche/fiche.css .fiche-zone[class*='couleur-partie-']", 'src/styles/fiche/fiche.css .sort-prepare__marque',
    // lot des archives et de la mise à jour
    'src/styles/archives/archives.css .archive__genre--doc', 'src/styles/archives/archives.css .archive__genre--sheet',
    'src/styles/mise-a-jour/mise-a-jour.css .nv-badge--ajout', 'src/styles/mise-a-jour/mise-a-jour.css .nv-diff del',
    'src/styles/mise-a-jour/mise-a-jour.css .nv-dev button.nv-principal, .nv-dialogue button.nv-principal']) {
    assert.ok(regles.some((r) => `${r.fichier} ${r.selecteur}` === attendue), `règle choisie : ${attendue}`);
  }
  // plus rien hors du lot dans ces règles (l'ombre de l'infobulle et l'échelle des relations sont passées aux jetons au lot des restes) : chacune entière
  for (const { fichier, selecteur, corps } of regles) assert.deepEqual(couleursEcrites(corps, { nommees: true }), [], `${fichier}, ${selecteur}`);
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

// Lot des matériaux, des armes de départ, des types d'armure et des poids des boucliers (2026-10-23, même demande et mêmes choix de cadrage) : leur
// couleur passe par la classe de la palette (`couleur-materiau-<id>`, `couleur-arme-depart`, `couleur-armure-<type>`, `couleur-poids-<id>`).

test('les feuilles des matériaux, des armes, des armures et des boucliers lisent les propriétés que posent les classes ; les couleurs d’interface viennent du thème', () => {
  const { fond, texte } = proprietes();
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
  };
  // l'onglet Armes : la ligne d'un matériau (ligne colorée du gabarit) et sa pastille dans la fiche ; le bleu des armes de départ, tiré de la classe
  // posée sur `.armes`
  dans('src/styles/armes/armes.css', '.materiau', `--ligne-fond: var(${fond}); --ligne-texte: var(${texte});`);
  dans('src/styles/armes/armes.css', '.arme-fiche__materiau', `background: var(${fond}); color: var(${texte});`);
  dans('src/styles/armes/armes.css', '.armes', `--depart: var(${fond});`);
  // les armes élémentaires (R167) : leurs deux lignes et la pastille de leur magie dans la fiche, la classe de la magie (couleur-magie-<id>)
  dans('src/styles/armes/armes.css', '.arme--elementaire > *, .arme-suite--elementaire > *', `background: var(${fond}); color: var(${texte});`);
  dans('src/styles/armes/armes.css', '.arme-fiche__magie', `background: var(${fond}); color: var(${texte});`);
  // le bleu des armes de départ (famille sans texte : FAMILLES_SANS_TEXTE) : aucune règle qui le lit ne pose le texte de sa classe, et la classe posée sur
  // `.armes` ne s'hérite pas sous lui (un élément n'a de --couleur que par sa propre classe)
  const armesCss = lire('src/styles/armes/armes.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const lisentLeBleu = [...armesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel, corps]) => /var\(--depart/.test(corps) || sel.trim() === '.armes');
  assert.ok(lisentLeBleu.length >= 6, `${lisentLeBleu.length} règles lisent le bleu`);
  for (const [, sel, corps] of lisentLeBleu) assert.doesNotMatch(corps, /var\(--couleur-texte/, `${sel.trim()} : pas de texte sur le bleu des armes de départ`);
  assert.ok(armesCss.includes(':where(.armes) > * { --couleur: initial; --couleur-texte: initial; }'), 'la classe de `.armes` ne s’hérite pas');
  // les onglets Armures et Boucliers : la case d'une matière, les pastilles de type, de matériau et de poids, le filet d'un poids
  dans('src/styles/armures/armures.css', '.pmat__nom', [`background: var(${fond}, var(--surface)) !important;`, `color: var(${texte});`]);
  dans('src/styles/armures/armures.css', '.pmat__choisir', `color: var(${texte});`);
  dans('src/styles/armures/armures.css', '.ptype, .pmat-pastille, .ppoids', [`background: var(${fond}); color: var(${texte});`, `color-mix(in srgb, var(${texte}) 14%, transparent)`]);
  dans('src/styles/armures/armures.css', '.poids__nom', `box-shadow: inset 4px 0 0 var(${fond});`);
  // la page Composants : la pastille d'un matériau ; la fiche : la tuile du poids, par teinte-palette (--c, --texte-sur-c)
  dans('src/styles/composants/composants.css', '.comp-teinte', `background: var(${fond});`);
  dans('src/styles/fiche/fiche.css', '.bouclier__tuile[data-poids]', 'background: var(--c); color: var(--texte-sur-c);');
  // plus aucune des variables posées en style d'avant ce lot
  for (const f of ['src/styles/armes/armes.css', 'src/styles/armures/armures.css', 'src/styles/composants/composants.css']) {
    assert.doesNotMatch(lire(f), /var\(--(?:mat|mat-texte|t)\b[,)]|var\(--c\)/, f);
  }
  // les couleurs d'interface sans règle : des jetons du thème, avec leur valeur d'avant (styles/global/base.css ; « Thème reste, Debug à part »)
  const theme = lire('src/styles/global/base.css');
  const jeton = (nom) => theme.match(new RegExp(`\\n {2}${nom}: ([^;]+);`))?.[1];
  assert.deepEqual(['--degats-taille', '--degats-estoc', '--degats-frappe', '--defense-ap', '--defense-am', '--ombre-fiche'].map(jeton),
    ['#c0392b', '#2471a3', '#7d6608', '#7d6608', '#2471a3', '0 6px 14px -12px rgb(0 0 0 / 0.4)']);
  dans('src/styles/armures/armures.css', '.pdef__ap', ['color-mix(in srgb, var(--defense-ap) 16%, var(--surface))', 'color-mix(in srgb, var(--defense-ap) 40%, var(--border))']);
  dans('src/styles/armures/armures.css', '.pdef__am', ['color-mix(in srgb, var(--defense-am) 14%, var(--surface))', 'color-mix(in srgb, var(--defense-am) 40%, var(--border))']);
  for (const [f, s] of [['src/styles/armes/armes.css', '.arme-dgt--frappe'], ['src/styles/armures/armures.css', '.pdgt--frappe']]) dans(f, s, 'var(--degats-frappe)');
  dans('src/styles/equipement/equipement.css', '.arme-dgt--taille, .pdgt--taille', 'var(--degats-taille)');
  dans('src/styles/equipement/equipement.css', '.arme-dgt--estoc, .pdgt--estoc', 'var(--degats-estoc)');
  dans('src/styles/equipement/equipement.css', '.arme-fiche, .pfiche', 'box-shadow: var(--ombre-fiche);');
  assert.doesNotMatch(lire('src/styles/equipement/equipement.css'), /--degats-(?:taille|estoc):/, 'la page ne les écrit plus');
});

test('les classes de ce lot posées par les rendus, les scripts des onglets et la fiche : des noms de la palette, jamais une couleur ni un style', async () => {
  const { htmlDuPoids, htmlDeMateriau, htmlDeLigneDeMateriau, RENDUS_DES_ARMURES } = await import('../src/lib/armures-rendu.mjs');
  const { htmlDeLigneDeMateriau: ligneDeComposant } = await import('../src/lib/composants-rendu.mjs');
  // les rendus (les mêmes pour la page construite et le mode modification) : la classe, jamais un style
  const rendus = [
    [htmlDuPoids({ id: 'tres-lourd', nom: 'Très lourd', force_min: 4 }), 'couleur-poids-tres-lourd'],
    [htmlDeMateriau('Cuir', 'Léger'), 'couleur-armure-leger'],
    [RENDUS_DES_ARMURES['armure-type']('Intermédiaire'), 'couleur-armure-intermediaire'],
    [RENDUS_DES_ARMURES['armure-type']('Vêtement'), `couleur-armure-${PAR_DEFAUT}`],
    [htmlDeLigneDeMateriau({ ligne: { ressource_id: 'ressources/armures#materiau:fer', ap: 5, am: 0, solidite: 3 }, cle: 'fer', nom: 'Fer', type: 'Lourd', prix: '1 RO' }, 'matiere'), 'couleur-armure-lourd'],
    [ligneDeComposant({ id: 'ressources/armures#materiau:fer-noir', nom: 'Fer noir', type: 'Lourd', citations: [] }), 'couleur-materiau-fer-noir'],
    [ligneDeComposant({ id: 'ressources/armures#materiau:nouveau', nom: 'Nouveau', type: 'Autres', citations: [] }), `couleur-materiau-${PAR_DEFAUT}`],
  ];
  for (const [html, classe] of rendus) {
    assert.ok(html.includes(` ${classe}"`) || html.includes(` ${classe} `), `${classe} dans ${html.slice(0, 120)}`);
    assert.doesNotMatch(html, /\bstyle="/, html.slice(0, 120));
    assert.deepEqual(couleursEcrites(html), [], html.slice(0, 120));
  }
  // les scripts des onglets : ils reprennent la classe de la ligne ou de la pastille affichée (classList), jamais un style ; ils n'importent pas la palette
  const armes = lire('src/scripts/armes.mjs');
  assert.ok(armes.includes("couleur: [...ligne.classList].filter((c) => c.startsWith('couleur-')).join(' '),"), 'la classe du matériau lue sur sa ligne');
  assert.ok(armes.includes('`<span class="arme-fiche__materiau ${e(m.couleur)}">${e(m.nom)}</span>`'), 'la pastille du matériau dans la fiche');
  const armures = lire('src/scripts/armures.mjs');
  assert.ok(armures.includes("const couleurDe = (el) => [...(el?.classList ?? [])].filter((c) => c.startsWith('couleur-')).join(' ');"));
  for (const attendu of ["couleur: couleurDe(ligne.querySelector('.pmat__nom')),", 'couleur: couleurDe(p),', '<span class="pmat-pastille ${e(m.couleur)}">',
    '<span class="ppoids ${e(poids.couleur)}" data-poids=']) assert.ok(armures.includes(attendu), attendu);
  for (const [f, script] of [['src/scripts/armes.mjs', armes], ['src/scripts/armures.mjs', armures]]) {
    assert.doesNotMatch(script, /getAttribute\('style'\)|\bstyle="|--mat\b|--t\b/, f);
    assert.doesNotMatch(script, /^import [^;]*(?:palette-css|materiaux-couleurs|equipement-couleurs)\.mjs';$/m, f);
  }
  // la fiche : la tuile du poids par sa classe (regles.json : `classe` de chaque poids), plus `--c` ni `--texte-sur-c` posés en style
  const fiche = lire('src/scripts/fiche.mjs');
  assert.ok(fiche.includes('poserTeinte(tuilePoids.li, teinteDe(b.poids));'));
  assert.doesNotMatch(fiche, /style\.setProperty\('--(?:c|texte-sur-c)'|poids\.(?:couleur|texte)\b/);
  assert.doesNotMatch(fiche, /^import [^;]*(?:equipement-couleurs|materiaux-couleurs|armures-rendu)\.mjs';$/m);
  const { chargerReglesDeFiche } = await import('../src/lib/fiche-regles.mjs');
  const regles = chargerReglesDeFiche(ouvrirBase());
  assert.ok(regles.poids_bouclier.length >= 4);
  for (const p of regles.poids_bouclier) {
    assert.equal(p.classe, classeDuPoids(p.id), p.id);
    assert.ok(!('couleur' in p) && !('texte' in p), `${p.id} : aucune couleur`);
  }
  // les modules des règles n'importent rien (la palette les importe) ; le rendu des armures n'écrit plus aucune couleur
  for (const f of ['src/lib/materiaux-couleurs.mjs', 'src/lib/equipement-couleurs.mjs']) assert.doesNotMatch(lire(f), /^import /m, f);
  assert.doesNotMatch(lire('src/lib/armures-rendu.mjs'), /COULEURS_DES_|couleurDu(?:Type|Poids)/);
});

// Lot des niveaux des accessoires (2026-10-23, même demande et mêmes choix de cadrage) : la couleur du niveau d'un effet ou d'une monture passe par la
// classe de la palette (`couleur-niveau-<n>`, famille `niveau`, lib/accessoires-couleurs.mjs#COULEURS_DES_NIVEAUX) ; l'onglet en émet la feuille.

/** La couleur que donne un texte posé à `part` (de 0 à 1) d'opacité sur un fond (`color-mix(in srgb, <texte> <part>, transparent)` sur ce fond). */
const surFond = (texte, fond, part) => {
  const canaux = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16));
  const [t, f] = [canaux(texte), canaux(fond)];
  return `#${t.map((c, i) => Math.round(c * part + f[i] * (1 - part)).toString(16).padStart(2, '0')).join('')}`;
};

test('les feuilles de l’onglet Accessoires lisent les propriétés que posent les classes des niveaux, sur l’élément qui les porte ; le texte adouci reste lisible ; les couleurs d’interface viennent du thème', () => {
  const { fond, texte } = proprietes();
  const fichier = 'src/styles/accessoires/accessoires.css';
  const css = lire(fichier);
  const dans = (selecteur, attendu) => {
    const regle = regleDe(css, selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${selecteur} : « ${a} » dans « ${regle} »`);
    return regle;
  };
  const NIVEAU = "[class*='couleur-niveau-']";
  // les pastilles des niveaux, les lignes d'effet et de monture, l'encart : le fond et le texte de la classe
  dans(`.acc-niveau-pastille${NIVEAU}`, `background: var(${fond}); color: var(${texte});`);
  dans(`.acc-ligne${NIVEAU} > *`, `background: var(${fond}); color: var(${texte});`);
  dans(`.acc-ligne${NIVEAU} .acc-remarque`, `color: var(${texte});`);
  dans(`.acc-produit${NIVEAU}`, [`background: var(${fond}); color: var(${texte});`, `border-color: color-mix(in srgb, var(${fond}) 60%, #000);`]);
  // les champs, le dé et les cases d'une ligne sur la couleur de son niveau : le texte de la classe, un liseré qui en est tiré, un voile de blanc de mélange
  dans(`:where(.acc-ligne${NIVEAU}) .acc-acquis__curseur`, `accent-color: var(${texte});`);
  dans(`:where(.acc-ligne${NIVEAU}) .acc-gemme-choix input`, `accent-color: var(${texte});`);
  dans(`:where(.acc-ligne${NIVEAU}) .acc-acquis__saisie`, [`border-color: color-mix(in srgb, var(${texte}) 35%, transparent);`, 'background: color-mix(in srgb, #fff 70%, transparent);', `color: var(${texte});`]);
  dans(`.acc :where(.acc-ligne${NIVEAU}) .acc-de--acquis`, ['background: color-mix(in srgb, #fff 55%, transparent);', `color: var(${texte});`, `border-color: color-mix(in srgb, var(${texte}) 35%, transparent);`]);
  dans(`.acc :where(.acc-ligne${NIVEAU}) .acc-de--acquis:hover`, 'background: color-mix(in srgb, #fff 85%, transparent);');
  // chaque règle qui lit la couleur d'un niveau ne la lit que sur un élément qui porte la classe d'un niveau (une gemme porte celle de sa magie, dont
  // --couleur s'hériterait), hors l'infobulle d'une gemme, qui porte la classe de sa magie
  const regles = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , corps]) => /var\(--couleur/.test(corps));
  assert.ok(regles.length >= 10, `${regles.length} règles`);
  for (const [, selecteur] of regles) {
    const sel = selecteur.trim();
    if (sel === '.bulle--gemme') continue;
    assert.ok(sel.includes(NIVEAU), `${sel} : lue sur l’élément qui porte la classe d’un niveau`);
  }
  assert.doesNotMatch(css, /--niv\b|--sur-niveau|\[style/, 'plus de --niv, de --sur-niveau ni de sélecteur sur le style');
  // le texte adouci (la colonne du jet, les intitulés de l'encart) : une part du texte de la classe, lue dans la feuille ; lisible (4,5:1) sur chaque
  // niveau, comme le texte plein (« Privilégé la lisibilité. »)
  const [, part] = dans(`.acc-ligne${NIVEAU} > .acc-jet`, `transparent)`).match(new RegExp(`color: color-mix\\(in srgb, var\\(${texte}\\) (\\d+)%, transparent\\);`)) ?? [];
  assert.ok(part, 'le texte adouci de la colonne du jet');
  dans(`.acc-produit${NIVEAU} :is(.acc-produit__sur, .acc-produit__sous, dt, .acc-produit__note)`, `color: color-mix(in srgb, var(${texte}) ${part}%, transparent);`);
  const niveaux = couleursDeLaPalette(['niveau']);
  assert.deepEqual(niveaux.map((c) => c.classe), ['couleur-niveau-1', 'couleur-niveau-2', 'couleur-niveau-3', 'couleur-niveau-4', 'couleur-niveau-5']);
  for (const c of niveaux) {
    assert.equal(c.fond, COULEURS_DES_NIVEAUX[c.cle], `${c.classe} : la couleur de l’onglet, inchangée (déjà lisible)`);
    assert.equal(c.texte, '#171210', `${c.classe} : le texte foncé de la règle du site`);
    const doux = surFond(c.texte, c.fond, Number(part) / 100);
    assert.ok(contraste(c.fond, doux) >= CONTRASTE_MINIMAL, `${c.classe} : texte adouci ${doux} sur ${c.fond} = ${contraste(c.fond, doux).toFixed(2)}`);
  }
  // les couleurs d'interface sans règle : des jetons du thème, avec leur valeur d'avant (styles/global/base.css ; « Thème reste, Debug à part »)
  const theme = lire('src/styles/global/base.css');
  const jeton = (nom) => theme.match(new RegExp(`\\n {2}${nom}: ([^;]+);`))?.[1];
  assert.deepEqual(['--maudit', '--maudit-texte', '--maudit-choisi', '--ombre-encart'].map(jeton),
    ['#8e44ad', 'var(--maudit)', 'var(--maudit-texte)', '0 6px 12px -10px rgb(0 0 0 / 0.35)']);
  // la référence n'est écrite qu'une fois, dans :root : une valeur sombre de --maudit ferait tomber le violet assombri des niveaux sous 4,5:1
  assert.equal((theme.match(/--maudit:/g) ?? []).length, 1, 'un seul --maudit:');
  assert.doesNotMatch(css, /--maudit(?:-texte|-choisi)?:/, 'la feuille ne les écrit plus');
  // le violet d'un accessoire maudit (réponses du propriétaire du 2026-10-23 : « Plus clair en sombre (Recommandé) », « Violet assombri (Recommandé) ») :
  //   - en texte sur le fond de la page : la référence en clair, un violet plus clair dans les deux blocs du thème sombre (préférence du système et choix
  //     du site), lisible sur la surface et le fond sombres ;
  //   - sur un fond de niveau (clair dans les deux thèmes) : la référence (jamais la valeur sombre) assombrie par le calcul, lisible sur les cinq niveaux ;
  //   - le cadre pointillé de l'encart maudit ne porte pas de texte : la référence, non corrigée.
  const reference = jeton('--maudit');
  const sombres = [...theme.matchAll(/\n {2,4}--maudit-texte: (#[0-9a-f]{6});/g)].map((m) => m[1]);
  assert.equal(sombres.length, 2, 'le violet du texte, dans les deux blocs du thème sombre');
  assert.equal(new Set(sombres).size, 1);
  assert.equal(sombres[0], '#a86ec0', 'l’option choisie');
  const fondsSombres = [...theme.matchAll(/\n {2,4}--(?:surface|bg): (#[0-9a-f]{6});/g)].map((m) => m[1]).filter((f) => contraste(f, '#000000') < 2);
  assert.ok(fondsSombres.length >= 4, `fonds sombres : ${fondsSombres}`);
  for (const f of fondsSombres) assert.ok(contraste(sombres[0], f) >= CONTRASTE_MINIMAL, `violet ${sombres[0]} sur ${f} = ${contraste(sombres[0], f).toFixed(2)}`);
  assert.ok(contraste(reference, jeton('--surface')) >= CONTRASTE_MINIMAL, 'la référence sur la surface claire');
  dans('.acc-ligne--malediction > *', 'color: var(--maudit-texte);');
  dans('.acc-produit__sur strong', 'color: var(--maudit-texte);');
  dans('.acc-produit.est-detruit .acc-produit__titre', 'color: color-mix(in srgb, var(--maudit-texte) 70%, var(--text));');
  const [, partSombre] = dans(`.acc-produit${NIVEAU} .acc-produit__sur strong`, '#000)').match(/color: color-mix\(in srgb, var\(--maudit\) (\d+)%, #000\);/) ?? [];
  assert.ok(partSombre, 'sur un fond de niveau : la référence assombrie');
  const assombri = surFond(reference, '#000000', Number(partSombre) / 100);
  for (const c of niveaux) assert.ok(contraste(assombri, c.fond) >= CONTRASTE_MINIMAL, `violet assombri ${assombri} sur ${c.classe} (${c.fond}) = ${contraste(assombri, c.fond).toFixed(2)}`);
  assert.ok(contraste(surFond(sombres[0], '#000000', Number(partSombre) / 100), niveaux.at(-1).fond) < CONTRASTE_MINIMAL, 'parti de la valeur sombre, le calcul ne suffirait pas');
  dans('.acc-produit.est-maudit', 'border: 2px dashed var(--maudit);');
  // une ligne « MALÉDICTION » choisie (réponse du propriétaire du 2026-10-23 : « Plus clair sur la ligne choisie (Recommandé) ») : en sombre, le violet du
  // texte encore éclairci par le calcul (dans les deux blocs sombres), lisible sur le fond de la ligne choisie, calculé comme la feuille l'écrit ; en
  // clair, le violet du texte, déjà lisible ; la règle l'emporte sur celle de la ligne de malédiction
  const SELECTEUR_CHOISI = `.acc tr.acc-ligne--malediction[data-choix]:not(${NIVEAU}).est-choisi > *`;
  dans(SELECTEUR_CHOISI, 'color: var(--maudit-choisi);');
  assert.ok(css.indexOf(`\n${SELECTEUR_CHOISI} {`) > css.indexOf('\n.acc-ligne--malediction > * {'), 'après la règle de la ligne de malédiction (et d’un poids plus fort)');
  const eclaircis = [...theme.matchAll(/\n {2,4}--maudit-choisi: color-mix\(in srgb, var\(--maudit-texte\) (\d+)%, #fff\);/g)].map((m) => Number(m[1]));
  assert.equal(eclaircis.length, 2, '--maudit-choisi dans les deux blocs du thème sombre');
  assert.equal(new Set(eclaircis).size, 1);
  const [, partAcc] = regleDe(css, `.acc tr[data-choix]:not(${NIVEAU}).est-choisi > *`).match(/background: color-mix\(in srgb, var\(--acc\) (\d+)%, var\(--surface\)\);/) ?? [];
  assert.ok(partAcc, 'le fond d’une ligne choisie');
  assert.ok(regleDe(css, '.acc').includes('--acc: var(--accent);'), '--acc est l’accent du site');
  const blocs = [...theme.matchAll(/(:root[^{]*)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ sel: sel.trim(), valeur: (nom) => corps.match(new RegExp(`\\n\\s*${nom}: ([^;]+);`))?.[1] }));
  const clair = blocs.find((b) => b.sel === ':root');
  const blocsSombres = blocs.filter((b) => b.valeur('--maudit-choisi')?.startsWith('color-mix('));
  assert.deepEqual(blocsSombres.map((b) => b.sel), [':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
  for (const b of blocsSombres) {
    const fondChoisi = surFond(b.valeur('--accent'), b.valeur('--surface'), Number(partAcc) / 100);
    const violet = surFond(b.valeur('--maudit-texte'), '#ffffff', eclaircis[0] / 100);
    assert.ok(contraste(violet, fondChoisi) >= CONTRASTE_MINIMAL, `${b.sel} : ${violet} sur ${fondChoisi} = ${contraste(violet, fondChoisi).toFixed(2)}`);
    assert.ok(contraste(b.valeur('--maudit-texte'), fondChoisi) < CONTRASTE_MINIMAL, `${b.sel} : sans l’éclaircir, illisible`);
  }
  const fondChoisiClair = surFond(clair.valeur('--accent'), clair.valeur('--surface'), Number(partAcc) / 100);
  assert.ok(contraste(reference, fondChoisiClair) >= CONTRASTE_MINIMAL, `en clair : ${reference} sur ${fondChoisiClair}`);
  dans('.acc-produit', 'box-shadow: var(--ombre-encart);');
  dans('html.js .acc tr.acc-ligne:hover > *', 'box-shadow: inset 0 0 0 999px color-mix(in srgb, #000 5%, transparent);');
  assert.deepEqual(couleursDuFichier(fichier), [], 'la feuille n’écrit plus que le noir et le blanc de mélange');
});

test('les classes des niveaux posées par le gabarit et reprises par le script de l’onglet : des noms de la palette, jamais une couleur ni un style', () => {
  // le gabarit : la classe du niveau sur la pastille, la ligne d'un effet ou d'une monture, et dans data-niveaux (une ligne de compétence) ; aucun style
  const page = lire('src/components/accessoires/AccessoiresPage.astro');
  for (const attendu of ["classes('acc-niveau-pastille', classeDeNiveau(n))", "classes('acc-ligne acc-effet acc-competence', classeDeNiveau(e.niveau))",
    "classe: classeDeNiveau(x.niveau)", "classeDeNiveau(e.niveau))} data-choix=\"effet\"", "classes('acc-ligne acc-monture', classeDeNiveau(m.niveau))"]) {
    assert.ok(page.includes(attendu), attendu);
  }
  assert.doesNotMatch(page, /\bstyle=|styleDeNiveau|--niv\b/);
  // le script : il reprend la classe de la ligne choisie (classList) ou celle de data-niveaux, jamais une couleur ; il n'importe ni la palette ni le
  // module des couleurs
  const script = lire('src/scripts/accessoires.mjs');
  for (const attendu of ["const couleursDe = (el) => [...(el?.classList ?? [])].filter((c) => c.startsWith('couleur-niveau-'));",
    'poserCouleurs(x, n.classe ? [n.classe] : []);', 'poserCouleurs(produit, x && !detruit ? couleursDe(x) : []);', 'poserCouleurs(produit, []);']) {
    assert.ok(script.includes(attendu), attendu);
  }
  assert.doesNotMatch(script, /getComputedStyle|style\.setProperty|setAttribute\('style'|removeAttribute\('style'|--niv\b|n\.style\b/);
  assert.doesNotMatch(script, /^import [^;]*(?:palette-css|accessoires-couleurs)\.mjs';$/m);
  // le module de la règle n'importe rien (la palette l'importe) ; le générateur, que le script importe, ne porte plus aucune couleur
  assert.doesNotMatch(lire('src/lib/accessoires-couleurs.mjs'), /^import /m);
  assert.doesNotMatch(lire('src/lib/accessoires-generateur.mjs'), /COULEURS_DES_NIVEAUX =|styleDeNiveau/);
});

// Lot de la chronologie (2026-10-23, même demande et mêmes choix de cadrage) : la teinte de chaque événement (la règle du site,
// lib/chronologie-couleurs.mjs#couleursDesEvenements : aucune source ne donne de couleur à un événement) passe par sa classe `couleur-evenement-<id>`,
// une combinaison calculée d'après la liste des événements (comme les potions : « Règle de calcul »), émise par la page de la chronologie seule.

/** Les événements de la base, dans l'ordre de lecture (exemples compris : le site de dev les montre). */
const evenementsDeLaBase = () => chargerChronologie(ouvrirBase({ sansExemples: false }));

test('les couleurs des événements de la chronologie : une classe par événement, sa valeur celle de la règle du site, texte blanc ; une feuille à part', () => {
  assert.equal(classeDEvenement('flammes-bleues'), 'couleur-evenement-flammes-bleues');
  assert.equal(classeDEvenement('Âge de fer'), 'couleur-evenement-age-de-fer', 'l’id normalisé (idDeCouleur)');
  const evenements = evenementsDeLaBase();
  assert.ok(evenements.length >= 70, `${evenements.length} événements`);
  const couleurs = couleursDesEvenements(evenements);
  const feuille = regles(cssDesEvenements(couleurs));
  // une règle par événement, dans l'ordre de lecture, aux noms uniques et sans caractère à échapper ; la valeur de la règle, jamais corrigée
  assert.deepEqual([...feuille.keys()], evenements.map((e) => classeDEvenement(e.id)));
  for (const e of evenements) {
    assert.match(classeDEvenement(e.id), /^couleur-evenement-[a-z0-9]+(?:-[a-z0-9]+)*$/, e.id);
    assert.deepEqual(feuille.get(classeDEvenement(e.id)), { '--couleur': couleurs.get(e.id), '--couleur-texte': '#ffffff' }, `${e.id} : la règle, texte blanc`);
  }
  // le blanc de la règle du site (texteSurCouleur : la luminance reste sous son seuil, de justesse : les teintes visent 4,6:1 avec le blanc)
  for (const c of couleurs.values()) assert.equal(texteSurCouleur(c), '#ffffff', c);
  assert.equal(couleurs.get(evenements.find((e) => e.epoque === 'inconnue').id), COULEUR_INCONNUE);
  assert.equal(couleurs.get(evenements.find((e) => e.epoque === 'aujourdhui').id), COULEUR_AUJOURDHUI);
  assert.equal(cssDesEvenements(new Map()), '');
  assert.equal(cssDesEvenements(null), '');
  // pas une famille fixe : ni dans FAMILLES_DE_LA_PALETTE, ni sur chaque page (Base.astro), dont le plafond de 4 ko tient
  assert.ok(!('evenement' in FAMILLES_DE_LA_PALETTE));
  assert.ok(!cssDeLaPalette().includes('couleur-evenement-'), 'pas dans la feuille de chaque page');
  assert.ok(cssDeLaPalette().length < 4000, `${cssDeLaPalette().length} octets`);
  assert.doesNotMatch(lire('src/layouts/Base.astro'), /cssDesEvenements|chronologie-couleurs/);
  // la palette n'importe pas la règle (elle reçoit ses couleurs) ; la règle n'importe rien ; chronologie.mjs n'écrit plus aucune couleur
  assert.doesNotMatch(lire('src/lib/palette-css.mjs'), /^import [^;]*chronologie/m);
  assert.doesNotMatch(lire('src/lib/chronologie-couleurs.mjs'), /^import /m);
  assert.doesNotMatch(lire('src/lib/chronologie.mjs'), /couleursDesEvenements|contraste|hexDeTsl|COULEUR_|TEINTE_/);
  // l'émission : le composant de la chronologie seul, dans un <style> à part ; l'éditeur du site de dev la réécrit (aucun autre fichier du site)
  const chronologie = lire('src/components/chronologie/Chronologie.astro');
  assert.ok(chronologie.includes('<style is:inline data-couleurs-chronologie set:html={cssDesEvenements(couleurs)}></style>'));
  assert.ok(chronologie.includes("const couleurs = couleursDesEvenements(evenements);"));
  const emetteurs = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((n) => /\.(?:astro|mjs|ts)$/.test(n))
    .filter((n) => /cssDesEvenements\(/.test(lire(`src/${n}`))).map((n) => n.split('\\').join('/')).sort();
  assert.deepEqual(emetteurs, ['components/chronologie/Chronologie.astro', 'scripts/edition/chronologie.mjs']);
});

test('les feuilles de la chronologie lisent les propriétés que posent les classes des événements, sur l’élément qui les porte ; les ombres et le voile viennent du thème', () => {
  const { fond, texte } = proprietes();
  const fichier = 'src/styles/chronologie/chronologie.css';
  const css = lire(fichier);
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const dans = (selecteur, attendu) => {
    const regle = regleDe(css, selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${selecteur} : « ${a} » dans « ${regle} »`);
    return regle;
  };
  const EVENEMENT = "[class*='couleur-evenement-']";
  // la page : --chrono et le texte posé dessus (--chrono-sur), tirés de la classe de l'événement affiché ; sans classe, l'accent et le texte sur aplat foncé
  dans('.chrono', ['--chrono: var(--accent);', '--chrono-sur: var(--texte-sur-fonce);']);
  dans(`.chrono${EVENEMENT}`, `--chrono: var(${fond}); --chrono-sur: var(${texte});`);
  // la frise : la ligne (--c), sa barre (le précédent, --c-avant) et le morceau de barre (le suivant, --c-apres), chacun sur l'élément qui porte la classe
  dans(`.frise__evenement${EVENEMENT}`, `--c: var(${fond});`);
  dans(`.frise__barre${EVENEMENT}`, `--c-avant: var(${fond});`);
  dans(`.frise__morceau${EVENEMENT}`, `--c-apres: var(${fond});`);
  dans('.frise__barre', '--trait-avant: color-mix(in srgb, var(--c-avant, var(--c)), #fff var(--vif));');
  dans('.frise__morceau', '--trait-apres: color-mix(in srgb, var(--c-apres, var(--c)), #fff var(--vif));');
  dans('.frise__morceau::before', ['var(--trait-avant)', 'var(--trait) var(--y)', 'var(--trait-apres)']);
  const lisentLaCouleur = [...sansCommentaires.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , corps]) => /var\(--couleur/.test(corps));
  assert.deepEqual(lisentLaCouleur.map(([, sel]) => sel.trim()),
    [`.chrono${EVENEMENT}`, `.frise__evenement${EVENEMENT}`, `.frise__barre${EVENEMENT}`, `.frise__morceau${EVENEMENT}`], 'la couleur lue sur l’élément qui porte la classe, rien d’autre');
  // le texte posé sur la couleur de l'événement : celui de la classe (--chrono-sur), plus aucun #fff
  for (const sel of ['.chrono-portee--majeur', 'a.chrono-chevron:not([aria-disabled=\'true\']):hover,\na.chrono-chevron:not([aria-disabled=\'true\']):focus-visible']) {
    assert.ok(regleDe(css, sel).includes('color: var(--chrono-sur);'), sel);
  }
  dans('.chrono-commencer', ['background: var(--chrono);', 'color: var(--chrono-sur);']);
  assert.ok(css.includes(".chrono--evenement a.chrono-chevron:not([aria-disabled='true']):active { border-color: var(--chrono); background: var(--chrono); color: var(--chrono-sur); }"));
  assert.doesNotMatch(css, /--couleur-evenement|color: #fff/, 'plus de --couleur-evenement ni de texte blanc écrit');
  // les pointillés de « Date inconnue » : un masque (il ne lit que l'opacité), la partie pleine en currentColor, la couleur opaque du texte de la ligne
  dans('.frise__evenement--inconnue .frise__morceau::before', ['mask: repeating-linear-gradient(to bottom, currentColor 0 0.4rem, transparent 0.4rem 0.7rem);']);
  dans('.frise__lien', 'color: var(--text);');
  const theme = lire('src/styles/global/base.css');
  const textes = [...theme.matchAll(/\n {2,4}--text: ([^;]+);/g)].map((m) => m[1]);
  assert.ok(textes.length >= 3 && textes.every((t) => /^#[0-9a-f]{6}$/.test(t)), `--text opaque dans chaque bloc du thème : ${textes}`);
  // les ombres et le voile : des jetons du thème, avec la valeur que la feuille écrivait (« Thème reste, Debug à part ») ; la même dans les deux thèmes
  const jeton = (nom) => theme.match(new RegExp(`\\n {2}${nom}: ([^;]+);`))?.[1];
  assert.deepEqual(['--ombre-evenement', '--ombre-barre-du-bas', '--ombre-poignee', '--ombre-tiroir', '--voile-tiroir'].map(jeton),
    ['0 10px 30px rgb(0 0 0 / 0.05)', '0 -4px 18px rgb(0 0 0 / 0.08)', '0 1px 4px rgb(0 0 0 / 0.12)', '10px 0 34px rgb(0 0 0 / 0.28)', 'rgb(24 18 12 / 0.48)']);
  for (const nom of ['--ombre-evenement', '--ombre-barre-du-bas', '--ombre-poignee', '--ombre-tiroir', '--voile-tiroir']) {
    assert.equal((theme.match(new RegExp(`${nom}:`, 'g')) ?? []).length, 1, `${nom} : une seule valeur`);
  }
  dans('.chrono-page', 'box-shadow: 0 1px 0 var(--border), var(--ombre-evenement);');
  assert.ok(css.includes('    box-shadow: var(--ombre-barre-du-bas);') && css.includes('    box-shadow: var(--ombre-poignee);') && css.includes('    box-shadow: var(--ombre-tiroir);'));
  assert.ok(css.includes('background: var(--voile-tiroir);'));
  assert.deepEqual(couleursDuFichier(fichier), [], 'la feuille n’écrit plus que le noir et le blanc de mélange');
});

/** Les valeurs d'un bloc du thème (`:root…` de styles/global/base.css). */
const blocsDuTheme = () => [...lire('src/styles/global/base.css').matchAll(/(:root[^{]*)\{([^{}]*)\}/g)]
  .map(([, sel, corps]) => ({ sel: sel.trim(), valeur: (nom) => corps.match(new RegExp(`\\n\\s*${nom}: ([^;]+);`))?.[1] }));

test('lisibilité de la chronologie dans les deux thèmes, pour chaque événement de la base : le blanc sur sa couleur, le texte coloré sur la page et dans la frise (4,5:1)', () => {
  const css = lire('src/styles/chronologie/chronologie.css');
  // les parts des mélanges, lues dans la feuille (un réglage changé se mesure ici)
  const part = (re) => {
    const m = css.match(re);
    assert.ok(m, `dans la feuille : ${re}`);
    return Number(m[1]) / 100;
  };
  const p = {
    texteClair: part(/\n {2}--chrono-texte: color-mix\(in srgb, var\(--chrono\) (\d+)%, #000\);/),
    texteSombre: part(/:root\[data-theme="dark"\] \.chrono \{ --chrono-texte: color-mix\(in srgb, var\(--chrono\) (\d+)%, #fff\); \}/),
    soft: part(/--chrono-soft: color-mix\(in srgb, var\(--chrono\) (\d+)%, var\(--surface\)\);/),
    pastille: part(/\.chrono-categorie:hover, \.chrono-categorie:focus-visible \{ border-color: var\(--chrono\); background: color-mix\(in srgb, var\(--chrono\) (\d+)%, var\(--surface\)\); \}/),
    commencer: part(/\.chrono-commencer:hover, \.chrono-commencer:focus-visible \{ background: color-mix\(in srgb, var\(--chrono\) (\d+)%, #000\); \}/),
    ligneClair: part(/\n {2}--texte: color-mix\(in srgb, var\(--c, var\(--muted\)\) (\d+)%, #000\);/),
    ligneSombre: part(/:root\[data-theme="dark"\] \.frise__evenement \{ --vif: \d+%; --texte: color-mix\(in srgb, var\(--c\) (\d+)%, #fff\); \}/),
    vif: part(/:root\[data-theme="dark"\] \.frise__evenement \{ --vif: (\d+)%;/),
    courante: part(/\n {2}background: color-mix\(in srgb, var\(--trait\) (\d+)%, var\(--surface\)\);\n {2}box-shadow: inset -4px/),
    survol: part(/\.frise__lien:hover \{ background: color-mix\(in srgb, var\(--trait\) (\d+)%, transparent\); \}/),
  };
  // les mêmes réglages dans les deux blocs du thème sombre (préférence du système et choix du site)
  assert.ok(css.includes(`:root:not([data-theme="light"]) .chrono { --chrono-texte: color-mix(in srgb, var(--chrono) ${p.texteSombre * 100}%, #fff); }`));
  assert.ok(css.includes(`:root:not([data-theme="light"]) .frise__evenement { --vif: ${p.vif * 100}%; --texte: color-mix(in srgb, var(--c) ${p.ligneSombre * 100}%, #fff); }`));
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombres = blocs.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  assert.deepEqual(sombres.map((b) => b.sel), [':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
  const blanc = '#ffffff';
  const noir = '#000000';
  const mesures = [];
  const lisible = (texte, fond, quoi) => {
    const r = contraste(texte, fond);
    mesures.push([quoi, r]);
    assert.ok(r >= CONTRASTE_MINIMAL, `${quoi} : ${texte} sur ${fond} = ${r.toFixed(2)}:1`);
  };
  const couleurs = couleursDesEvenements(evenementsDeLaBase());
  for (const [id, c] of couleurs) {
    // le texte de la classe (--couleur-texte : le blanc) sur l'aplat de l'événement, et sur l'aplat assombri au survol de « Commencer »
    lisible(blanc, c, `${id} : blanc sur la couleur`);
    lisible(blanc, surFond(c, noir, p.commencer), `${id} : blanc sur la couleur assombrie`);
    // thème clair : le texte coloré de la page (date, pastille mineure, catégories, légende, chevrons) et celui d'une ligne de la frise
    {
      const [bg, surface] = [clair.valeur('--bg'), clair.valeur('--surface')];
      const texte = surFond(c, noir, p.texteClair);
      lisible(texte, surface, `${id}, clair : texte coloré sur la surface`);
      lisible(texte, surFond(c, surface, p.soft), `${id}, clair : texte coloré sur la teinte douce`);
      lisible(texte, surFond(c, surface, p.pastille), `${id}, clair : texte coloré sur la pastille survolée`);
      const ligne = surFond(c, noir, p.ligneClair);
      lisible(ligne, bg, `${id}, clair : texte d’une ligne sur le fond`);
      lisible(ligne, surFond(c, surface, p.courante), `${id}, clair : texte de la ligne courante`);
      lisible(ligne, surFond(c, bg, p.survol), `${id}, clair : texte d’une ligne survolée`);
    }
    // thème sombre (les deux blocs) : le texte éclairci, sur les fonds sombres ; le trait de la ligne éclairci (--vif)
    for (const b of sombres) {
      const [bg, surface] = [b.valeur('--bg'), b.valeur('--surface')];
      const texte = surFond(c, blanc, p.texteSombre);
      lisible(texte, surface, `${id}, ${b.sel} : texte coloré sur la surface`);
      lisible(texte, surFond(c, surface, p.soft), `${id}, ${b.sel} : texte coloré sur la teinte douce`);
      lisible(texte, surFond(c, surface, p.pastille), `${id}, ${b.sel} : texte coloré sur la pastille survolée`);
      const ligne = surFond(c, blanc, p.ligneSombre);
      const trait = surFond(c, blanc, 1 - p.vif);
      lisible(ligne, bg, `${id}, ${b.sel} : texte d’une ligne sur le fond`);
      lisible(ligne, surFond(trait, surface, p.courante), `${id}, ${b.sel} : texte de la ligne courante`);
      lisible(ligne, surFond(trait, bg, p.survol), `${id}, ${b.sel} : texte d’une ligne survolée`);
    }
  }
  assert.ok(mesures.length >= couleurs.size * 20, `${mesures.length} mesures`);
  // le plus juste : le blanc sur la couleur (les teintes visent 4,6:1)
  const [quoi, minimum] = mesures.reduce((m, x) => (x[1] < m[1] ? x : m));
  assert.match(quoi, /blanc sur la couleur$/, `le plus juste : ${quoi} (${minimum.toFixed(2)}:1)`);
});

test('les classes des événements posées par la frise, la page et l’éditeur du site de dev : des noms de la palette, jamais une couleur ni un style', () => {
  // les gabarits : la classe sur `.chrono`, sur chaque ligne, sur sa barre (le précédent) et son morceau (le suivant) ; aucun style de couleur
  const chronologie = lire('src/components/chronologie/Chronologie.astro');
  assert.ok(chronologie.includes("<div class:list={['chrono', evenement ? 'chrono--evenement' : 'chrono--accueil', (evenement ?? suivant) && classeDEvenement((evenement ?? suivant).id)]} data-chrono>"));
  const frise = lire('src/components/chronologie/Frise.astro');
  for (const attendu of ['class={`frise__evenement frise__evenement--${e.epoque} ${classeDEvenement(e.id)}`}', "<span class:list={['frise__barre', voisine(i, -1)]}>",
    "<span class:list={['frise__morceau', voisine(i, 1)]} />"]) assert.ok(frise.includes(attendu), attendu);
  for (const [f, source] of [['Chronologie.astro', chronologie], ['Frise.astro', frise]]) {
    assert.doesNotMatch(source, /--couleur-evenement|--c(?:-avant|-apres)?:|getPropertyValue\('--c|style=\{(?!`--progression)/, f);
  }
  // l'éditeur : la feuille réécrite et les classes de la frise sont exécutées en faux navigateur (test/chronologie-editeur.test.mjs) ; ici, ce qu'il
  // ne fait pas tourner (la page d'un événement créé, /chronologie/?evenement=, prend sa classe) et l'absence de tout style de couleur
  const editeur = lire('src/scripts/edition/chronologie.mjs');
  assert.ok(editeur.includes("poserCouleur(document.querySelector('[data-chrono]'), classeDEvenement(id));"), '.chrono de l’événement créé');
  assert.doesNotMatch(editeur, /style\.setProperty\('--(?:c|c-avant|c-apres|couleur-evenement)'|--couleur-evenement|couleurs\.get\(/);
  assert.doesNotMatch(editeur, /setProperty\(/, 'aucune variable posée en style');
  // le script de la frise (en ligne) n'importe rien : il reprend les classes des lignes (scripts du navigateur : jamais la palette ni la règle)
  assert.doesNotMatch(frise, /<script[^>]*>[\s\S]*?(?:import|palette-css|chronologie-couleurs)[\s\S]*?<\/script>/);
});

// Lot des parties du guide (2026-10-23, même demande et mêmes choix de cadrage) : la couleur d'une partie de l'ancien guide passe par la classe de la
// palette (`couleur-partie-<id>`, famille `partie`, lib/parties-couleurs.mjs#COULEURS_DES_PARTIES) : une page de Découvrir ou des Bases, les cartes de
// l'accueil, les groupes du sommaire des Bases, les quatre zones de la fiche ; plus aucune couleur dans le plan (lib/livres.mjs).

const PARTIE = "[class*='couleur-partie-']";

test('les feuilles des parties du guide lisent les propriétés que pose la classe, sur l’élément qui la porte ; ses enfants ne l’héritent pas', () => {
  const { fond, texte } = proprietes();
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
    return regle;
  };
  /** Les sélecteurs des règles d'une feuille qui lisent la couleur d'une classe (`var(--couleur…)`), commentaires retirés. */
  const lecteurs = (fichier) => [...lire(fichier).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , corps]) => /var\(--couleur(?:-texte|-2)?[,)]/.test(corps)).map(([, sel]) => sel.trim().replace(/\s+/g, ' '));
  // le guide : --guide et le texte de ses aplats (--guide-sur) tirés de la classe de la partie posée sur la page ; sans elle, l'accent et le texte sur
  // aplat foncé (le blanc d'avant, plus écrit) ; les enfants de la page retrouvent la valeur initiale de --couleur et --couleur-texte (celle d'avant la
  // classe : un bloc sans classe propre garde son repli), sous :where() (aucun poids : la classe propre d'un bloc l'emporte)
  const blocs = 'src/styles/guide/blocs.css';
  dans(blocs, '.guide-reference', ['--guide: var(--accent);', '--guide-sur: var(--texte-sur-fonce);']);
  dans(blocs, `.guide-reference${PARTIE}`, `--guide: var(${fond}); --guide-sur: var(${texte});`);
  dans(blocs, `:where(.guide-reference${PARTIE}) > *`, `${fond}: initial; ${texte}: initial;`);
  dans(blocs, '.guide-rubriques__lien:hover,\n.guide-rubriques__lien:focus-visible', 'background: var(--guide); color: var(--guide-sur);');
  assert.doesNotMatch(lire(blocs), /--couleur-partie|color: #fff/, 'plus de --couleur-partie ni de blanc écrit');
  // la seule règle du guide qui lit la couleur sans classe propre est celle de la page ; les blocs ne la lisent que sur l'élément qui porte leur classe
  // (magie, caractéristique, posture) ou leur repli
  assert.deepEqual(lecteurs(blocs), [`.guide-reference${PARTIE}`, '.guide-magie', '.guide-carac', '.guide-competences__groupe', '.guide-posture']);
  for (const [sel, repli] of [['.guide-magie', `--c: var(${fond}, var(--guide));`], ['.guide-competences__groupe', `--c: var(${fond}, var(--guide));`],
    ['.guide-posture', [`--c: var(${fond}, var(--guide));`, `--c-texte: var(${texte}, var(--text));`]]]) dans(blocs, sel, repli);
  // l'accueil et le sommaire : la couleur lue sur la carte ou le groupe qui porte la classe, rien d'autre
  const accueil = 'src/styles/accueil/accueil.css';
  dans(accueil, `.accueil-debut__carte${PARTIE}`, `--c: var(${fond});`);
  assert.deepEqual(lecteurs(accueil), [`.accueil-debut__carte${PARTIE}`]);
  const wiki = 'src/styles/global/wiki.css';
  dans(wiki, `.sommaire${PARTIE}`, `--sommaire-couleur: var(${fond});`);
  dans(wiki, '.sommaire--couleur > h2', 'border-left: 4px solid var(--sommaire-couleur);');
  assert.deepEqual(lecteurs(wiki), [`.sommaire${PARTIE}`]);
  // la fiche : --etape tirée de la classe de la partie de la zone, sur la zone ; la magie innée (sa classe est sur .fiche, posée par le script) est lue sur
  // .fiche elle-même, avant les zones, et les enfants d'une zone la retrouvent : les cadres (`.fiche[data-magie] .fiche-etape`) et tout élément sans classe
  // propre gardent la magie innée, jamais la couleur de la zone
  const fiche = 'src/styles/fiche/fiche.css';
  dans(fiche, '.fiche', `--couleur-de-la-fiche: var(${fond}); --couleur-texte-de-la-fiche: var(${texte});`);
  dans(fiche, `.fiche-zone${PARTIE}`, `--etape: var(${fond});`);
  dans(fiche, `:where(.fiche-zone${PARTIE}) > *`, `${fond}: var(--couleur-de-la-fiche); ${texte}: var(--couleur-texte-de-la-fiche);`);
  dans(fiche, '.fiche[data-magie] .fiche-etape', `--cadre: var(${fond}); --cadre-2: var(--couleur-2, var(${fond}));`);
  assert.ok(lire('src/scripts/fiche.mjs').includes("const racine = document.getElementById('fiche');"), 'la classe de la magie innée est posée sur #fiche (.fiche)');
  assert.match(lire('src/pages/fiche/index.astro'), /<div class="fiche" id="fiche"/);
  // la classe de la partie ne pose que --couleur et --couleur-texte (rien d'autre à rendre aux enfants), et les deux règles qui les rendent sont sans
  // poids (:where), sur les enfants directs seuls (leurs descendants en héritent)
  assert.deepEqual(Object.keys(regles(cssDesFamilles(['partie'])).get('couleur-partie-creer')), [fond, texte]);
  assert.ok(!/--couleur-2/.test(cssDesFamilles(['partie'])));
  // dans la fiche, en dehors de ces règles, toute règle qui lit la couleur d'une classe est sur un élément qui porte sa classe (teinte-palette, magie,
  // palier, créature à deux magies) ou sur les cadres (la magie innée de .fiche)
  assert.deepEqual(lecteurs(fiche), ['.fiche', '.fiche[data-magie] .fiche-etape', '.fiche .teinte-palette', `.fiche-zone${PARTIE}`,
    ".attribut[data-a='barre4'][class*='couleur-magie-']", '.posture-carte__magie', ".resistances__table tr[class*='couleur-palier-']", '.fiche .invocation-choix--magie']);
  assert.deepEqual(lecteurs(blocs).filter((s) => s.includes('couleur-partie')), [`.guide-reference${PARTIE}`], 'le guide : la page seule');
  // les gabarits posent les classes, jamais un style : ni --couleur-partie, ni --sommaire-couleur, ni --c des cartes, ni --etape
  const page = lire('src/components/guide/PageDuGuide.astro');
  assert.ok(page.includes('const couleur = classeDePartie(partieDeLaPage(entry.id));'));
  assert.ok(page.includes("<div class:list={['guide-reference', couleur && ['guide-reference--couleur', couleur]]}>"));
  const sommaire = lire('src/components/guide/Sommaire.astro');
  assert.ok(sommaire.includes("class:list={['sommaire', g.classe && ['sommaire--couleur', g.classe]]}"));
  assert.ok(lire('src/pages/regles/index.astro').includes('classe: classeDePartie(g.partie),'));
  const accueilPage = lire('src/pages/index.astro');
  assert.ok(accueilPage.includes("classe: classeDePartie(partieDeLaPage(e.id)),") && accueilPage.includes("<li class:list={['accueil-debut__carte', c.classe]}>"));
  const fichePage = lire('src/pages/fiche/index.astro');
  assert.ok(fichePage.includes('const classeDeZone = (id: string) => classeDePartie(ZONES.find((z) => z.id === id)!.partie);'));
  assert.equal(fichePage.match(/<section class:list=\{\['fiche-zone(?: fiche-zone--identite)?', classeDeZone\('[a-z]+'\)\]\}/g)?.length, 4, 'les quatre zones');
  for (const [f, source] of [['PageDuGuide.astro', page], ['Sommaire.astro', sommaire], ['index.astro', accueilPage], ['fiche/index.astro', fichePage]]) {
    assert.doesNotMatch(source, /--couleur-partie|--sommaire-couleur|--etape:|style=\{`--c:/, f);
  }
  // ni la palette ni le module des couleurs dans un script de page ; le plan (dans la chaîne de l'édition du navigateur) n'importe rien
  for (const f of readdirSync(new URL('../src/scripts/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.mjs'))) {
    assert.doesNotMatch(lire(`src/scripts/${f}`), /parties-couleurs\.mjs/, f);
  }
  for (const f of ['src/lib/livres.mjs', 'src/lib/parties-couleurs.mjs']) assert.doesNotMatch(lire(f), /^import /m, f);
});

test('lisibilité des parties du guide dans les deux thèmes : le blanc sur leur couleur, le texte coloré du guide, de la fiche et de l’accueil (4,5:1)', () => {
  const part = (fichier, re) => {
    const m = lire(fichier).match(re);
    assert.ok(m, `${fichier} : ${re}`);
    return Number(m[1]) / 100;
  };
  const [blocs, tooltips, fiche, accueil] = ['src/styles/guide/blocs.css', 'src/styles/magie/tooltips.css', 'src/styles/fiche/fiche.css', 'src/styles/accueil/accueil.css'];
  const p = {
    guideTexteSombre: part(blocs, /:root\[data-theme="dark"\] \.guide-reference \{ --guide-texte: color-mix\(in srgb, var\(--guide\) (\d+)%, #fff\); \}/),
    soft: part(blocs, /--guide-soft: color-mix\(in srgb, var\(--guide\) (\d+)%, var\(--surface\)\);/),
    guideTexteClair: part(blocs, /\.guide-reference\[class\*='couleur-partie-'\] \{[^}]*--guide-texte: color-mix\(in srgb, var\(--guide\) (\d+)%, #000\); \}/),
    info: part(tooltips, /\.info \{ --info: color-mix\(in srgb, var\(--mag\) (\d+)%, var\(--text\)\);/),
    doux: part(fiche, /\.fiche-zone \{\n {2}--etape-doux: color-mix\(in srgb, var\(--etape\) (\d+)%, var\(--surface\)\);/),
    sousTitre: part(fiche, /\.fiche-sous-titre \{[^}]*color: color-mix\(in srgb, var\(--etape\) (\d+)%, var\(--text\)\); \}/),
    resume: part(fiche, /\.fiche-resume strong \{ color: color-mix\(in srgb, var\(--etape\) (\d+)%, var\(--text\)\); \}/),
    ongletActif: part(fiche, /\.parametres \.onglet\.is-active \{[^}]*color: color-mix\(in srgb, var\(--etape\) (\d+)%, var\(--text\)\); \}/),
    ongletSurvol: part(fiche, /\.parametres \.onglet:hover \{ background: color-mix\(in srgb, var\(--etape\) (\d+)%, var\(--surface\)\); \}/),
    marqueSombre: part(fiche, /:root\[data-theme='dark'\] \.sort-prepare__marque \{ --marque: color-mix\(in srgb, var\(--etape\) (\d+)%, #fff\); \}/),
    carte: part(accueil, /background: color-mix\(in srgb, var\(--c\) (\d+)%, var\(--surface\)\);/),
  };
  // les mêmes réglages dans les deux blocs du thème sombre (préférence du système et choix du site)
  assert.ok(lire(blocs).includes(`:root:not([data-theme="light"]) .guide-reference { --guide-texte: color-mix(in srgb, var(--guide) ${p.guideTexteSombre * 100}%, #fff); }`));
  assert.ok(lire(fiche).includes(`:root:not([data-theme='light']) .sort-prepare__marque { --marque: color-mix(in srgb, var(--etape) ${p.marqueSombre * 100}%, #fff); }`));
  // le texte coloré d'une page qui a une partie, en thème clair : la couleur de la partie mêlée de 10 % de noir (réponse du propriétaire du 2026-10-23 :
  // « Comme les cartes du fil rouge (Recommandé) ») ; le nom d'un personnage fil rouge le lit (sa correction, sans préférence du propriétaire, était déjà
  // ce calcul) ; une page sans partie garde l'accent du site, inchangé ; en sombre, les deux blocs du thème (d'un poids plus fort) gardent l'éclairci
  assert.equal(p.guideTexteClair, 0.9);
  assert.ok(regleDe(lire(blocs), '.guide-reference').includes('--guide-texte: var(--guide);'), 'sans partie : l’accent du site');
  assert.ok(regleDe(lire(blocs), '.guide-fil-rouge__nom').includes('color: var(--guide-texte);'));
  assert.doesNotMatch(lire(blocs), /\.guide-fil-rouge__nom \{ color:/, 'plus de règle à part pour le thème sombre');
  assert.ok(lire(blocs).indexOf(`.guide-reference${PARTIE} {`) < lire(blocs).indexOf(':root[data-theme="dark"] .guide-reference {'));
  const marque = regleDe(lire(fiche), '.sort-prepare__marque');
  assert.ok(marque.includes('--marque: var(--etape);') && marque.includes('color: var(--marque);'), 'le texte : en clair, la couleur de la zone');
  assert.ok(marque.includes('border: 1px solid var(--etape);'), 'la bordure (sans texte) garde la couleur de la zone, dans les deux thèmes');
  assert.equal((lire(fiche).match(/var\(--marque\)/g) ?? []).length, 1, '--marque ne sert qu’au texte');
  const blocsTheme = blocsDuTheme();
  const clair = blocsTheme.find((b) => b.sel === ':root');
  const sombres = blocsTheme.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  assert.deepEqual(sombres.map((b) => b.sel), [':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
  const [blanc, noir] = ['#ffffff', '#000000'];
  // les parties de chaque zone de la fiche (pages/fiche/index.astro) ; la zone II (les sorts : la marque « préparé ») et la zone IV (ses onglets)
  const zones = Object.fromEntries([...lire('src/pages/fiche/index.astro').matchAll(/\{ id: '([a-z]+)', numero: '[IV]+', [^}]*partie: '([a-z-]+)' \}/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(zones, { identite: 'creer', portee: 'jouer', situation: 'decouvrir', parametres: 'progresser' });
  // les rubriques sous une page (la pastille d'un lien, texte coloré sur la teinte douce) : la partie des pages qui en ont
  const partiesDesRubriques = new Set(Object.keys(RUBRIQUES_SOUS_LA_PAGE).map(partieDeLaPage));
  assert.deepEqual([...partiesDesRubriques], ['decouvrir']);
  const mesures = [];
  const lisible = (texte, fond, quoi) => {
    const r = contraste(texte, fond);
    mesures.push([quoi, r]);
    assert.ok(r >= CONTRASTE_MINIMAL, `${quoi} : ${texte} sur ${fond} = ${r.toFixed(2)}:1`);
  };
  for (const c of couleursDeLaPalette(['partie'])) {
    const P = c.fond;
    // le texte de la classe (le blanc) sur l'aplat : pastille d'une rubrique au focus, dés d'un objet et numéros de la ceinture de la fiche
    lisible(c.texte, P, `${c.cle} : texte de la classe sur la couleur`);
    for (const [nom, b] of [['clair', clair], ...sombres.map((x) => [x.sel, x])]) {
      const sombre = b !== clair;
      const [bg, surface, text, muted] = ['--bg', '--surface', '--text', '--muted'].map((v) => b.valeur(v));
      const q = (quoi) => `${c.cle}, ${sombre ? 'sombre' : 'clair'} : ${quoi}`;
      // le guide : --guide-texte (intertitres, définitions, numéros de la montée de niveau) sur le fond de la page et sur la surface des tableaux ; sur
      // la teinte douce (la pastille d'une rubrique) ; le nom d'un personnage fil rouge sur sa carte ; l'icône d'une infobulle ; le texte et le texte adouci
      // (en-têtes des tableaux) sur la teinte douce
      const guideTexte = sombre ? surFond(P, blanc, p.guideTexteSombre) : surFond(P, noir, p.guideTexteClair);
      const soft = surFond(P, surface, p.soft);
      lisible(guideTexte, bg, q('texte coloré sur le fond'));
      lisible(guideTexte, surface, q('texte coloré sur la surface'));
      lisible(guideTexte, soft, q('texte coloré sur la teinte douce (rubriques, nom d’un personnage fil rouge)'));
      lisible(surFond(P, text, p.info), soft, q('icône d’une infobulle sur la teinte douce'));
      lisible(text, soft, q('texte sur la teinte douce'));
      lisible(muted, soft, q('texte adouci sur la teinte douce (en-têtes des tableaux)'));
      // l'accueil : le titre et le résumé d'une carte sur sa teinte
      lisible(text, surFond(P, surface, p.carte), q('titre d’une carte de l’accueil'));
      lisible(muted, surFond(P, surface, p.carte), q('résumé d’une carte de l’accueil'));
      // la fiche (les parties de ses zones) : sous-titres et mots en gras d'un résumé, sur la surface et la teinte douce de la zone ; texte sur la teinte
      // douce ; la marque « préparé » (sur la surface d'un bloc) ; les onglets de la zone IV (l'actif, et le texte d'un onglet survolé)
      if (!Object.values(zones).includes(c.cle)) continue;
      const doux = surFond(P, surface, p.doux);
      lisible(surFond(P, text, p.sousTitre), surface, q('sous-titre de la fiche sur la surface'));
      lisible(surFond(P, text, p.sousTitre), doux, q('sous-titre de la fiche sur la teinte de la zone'));
      lisible(surFond(P, text, p.resume), doux, q('mot en gras d’un résumé de la fiche'));
      lisible(text, doux, q('texte sur la teinte de la zone'));
      lisible(sombre ? surFond(P, blanc, p.marqueSombre) : P, surface, q('marque « préparé » d’un sort'));
      if (c.cle === zones.parametres) {
        lisible(surFond(P, text, p.ongletActif), surface, q('onglet actif de la zone IV'));
        lisible(text, surFond(P, surface, p.ongletSurvol), q('onglet survolé de la zone IV'));
      }
    }
  }
  assert.ok(mesures.length >= 100, `${mesures.length} mesures`);
  const [quoi, minimum] = mesures.reduce((m, x) => (x[1] < m[1] ? x : m));
  assert.ok(minimum >= CONTRASTE_MINIMAL, `le plus juste : ${quoi} (${minimum.toFixed(2)}:1)`);
  // les corrections appliquées (le fil rouge et la marque : sans préférence du propriétaire, options recommandées appliquées au nom de sa règle
  // « Privilégé la lisibilité » ; le texte coloré du guide : son choix, « Comme les cartes du fil rouge (Recommandé) ») : sans elles, illisibles
  assert.ok(contraste(COULEURS_DES_PARTIES.creer, surFond(COULEURS_DES_PARTIES.creer, clair.valeur('--surface'), p.soft)) < CONTRASTE_MINIMAL, 'le vert de la partie, non assombri, sur la carte');
  assert.ok(contraste(COULEURS_DES_PARTIES.creer, clair.valeur('--bg')) < CONTRASTE_MINIMAL, 'le vert de la partie, non assombri, sur le fond de la page');
  assert.ok(contraste(COULEURS_DES_PARTIES.jouer, sombres[0].valeur('--surface')) < CONTRASTE_MINIMAL, 'le rouge de la zone II, non éclairci');
});

// Lot des archives et de la mise à jour (2026-10-23, même demande et mêmes choix de cadrage) : aucune famille de la palette (des couleurs d'interface,
// sans règle du jeu, qui changent avec le thème) ; le bleu des Docs et le vert des Sheets des Archives, le vert et le rouge des notes de version (R29
// fixe le sens, pas les valeurs) et le texte des boutons principaux de la page Mise à jour sont des jetons du thème (choix « Thème reste, Debug à part »),
// avec les valeurs qu'écrivaient les feuilles ; le voile des boîtes de dialogue, en noir de mélange.

/** Les jetons du lot et leurs valeurs, en clair puis en sombre (les deux blocs du thème sombre) : celles qu'écrivaient les feuilles. */
const JETONS_DES_ARCHIVES_ET_DE_LA_MISE_A_JOUR = {
  '--amelioration': ['#1f7a45', '#7fd3a0'], '--amelioration-fond': ['#e3f4ea', '#18301f'],
  '--affaiblissement': ['#b3261e', '#f2a19a'], '--affaiblissement-fond': ['#fbe6e4', '#3a1d1b'],
  '--doc-google': ['#1a56b8', '#9cbcf2'], '--doc-google-fond': ['#e3ecfb', '#1d2a40'],
  '--sheet-google': ['#1b7340', '#8fd3a8'], '--sheet-google-fond': ['#e1f3e8', '#1b3326'],
};

test('les archives et la mise à jour : aucune famille de la palette ; leurs couleurs, des jetons du thème avec les valeurs d’avant ; le texte des boutons principaux, foncé en sombre', () => {
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombres = blocs.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  assert.deepEqual(sombres.map((b) => b.sel), [':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
  // les huit jetons, dans les trois blocs du thème ; aucun n'égale un jeton existant (« Garder séparées » : --good vaut #2f6f47, pas #1f7a45)
  for (const [nom, [enClair, enSombre]] of Object.entries(JETONS_DES_ARCHIVES_ET_DE_LA_MISE_A_JOUR)) {
    assert.equal(clair.valeur(nom), enClair, `${nom}, clair`);
    for (const b of sombres) assert.equal(b.valeur(nom), enSombre, `${nom}, ${b.sel}`);
  }
  // dans chaque bloc, aucun des huit n'a la valeur d'une autre variable du bloc (lue dans base.css ; --texte-sur-good, qui renvoie à d'autres jetons, à part)
  const corpsDesBlocs = new Map([...lire('src/styles/global/base.css').matchAll(/(:root[^{]*)\{([^{}]*)\}/g)].map(([, sel, corps]) => [sel.trim(), corps]));
  for (const b of [clair, ...sombres]) {
    const corps = corpsDesBlocs.get(b.sel);
    const variables = [...corps.matchAll(/\n\s*(--[a-z0-9-]+): ([^;]+);/g)].map(([, nom, v]) => [nom, v.trim().toLowerCase()]);
    assert.ok(variables.length >= 9, `${b.sel} : ${variables.length} variables`);
    for (const nom of Object.keys(JETONS_DES_ARCHIVES_ET_DE_LA_MISE_A_JOUR)) {
      const v = b.valeur(nom).toLowerCase();
      const egales = variables.filter(([autre, x]) => autre !== nom && autre !== '--texte-sur-good' && x === v).map(([autre]) => autre);
      assert.deepEqual(egales, [], `${b.sel} : ${nom} (${v}) a la valeur de ${egales}`);
    }
  }
  // le texte des boutons principaux (réponse du propriétaire du 2026-10-23 : « Texte foncé en sombre (Recommandé) ») : le texte sur aplat foncé en clair,
  // le fond sombre du site dans les deux blocs du thème sombre ; aucune couleur ajoutée
  assert.equal(clair.valeur('--texte-sur-good'), 'var(--texte-sur-fonce)');
  for (const b of sombres) assert.equal(b.valeur('--texte-sur-good'), 'var(--bg)', b.sel);
  // les feuilles ne lisent que les jetons ; plus aucun bloc du thème à elles (le thème est dans base.css), plus de variables --nv-vert…
  const archives = lire('src/styles/archives/archives.css');
  assert.ok(archives.includes('\n.archive__genre--doc { background: var(--doc-google-fond); color: var(--doc-google); }'));
  assert.ok(archives.includes('\n.archive__genre--sheet { background: var(--sheet-google-fond); color: var(--sheet-google); }'));
  const maj = lire('src/styles/mise-a-jour/mise-a-jour.css');
  for (const attendu of [
    '\n.nv-sens--amelioration ins, .nv-sens--amelioration.nv-champ--long > summary, span.nv-sens--amelioration { color: var(--amelioration); }',
    '\n.nv-sens--affaiblissement ins, .nv-sens--affaiblissement.nv-champ--long > summary, span.nv-sens--affaiblissement { color: var(--affaiblissement); }',
    '\n.nv-sens--amelioration ins { background: var(--amelioration-fond);', '\n.nv-sens--affaiblissement ins { background: var(--affaiblissement-fond);',
    '\n.nv-diff ins { color: var(--amelioration); background: var(--amelioration-fond); }', '\n.nv-diff del { color: var(--affaiblissement); background: var(--affaiblissement-fond); }',
    '\n.nv-badge--ajout { background: var(--amelioration-fond); color: var(--amelioration); }', '\n.nv-badge--retrait { background: var(--affaiblissement-fond); color: var(--affaiblissement); }',
    '\n.nv-dev button.nv-principal, .nv-dialogue button.nv-principal { background: var(--good); color: var(--texte-sur-good); border-color: var(--good); font-weight: bold; }',
    '\n.nv-dialogue::backdrop { background: color-mix(in srgb, #000 45%, transparent); }',
  ]) assert.ok(maj.includes(attendu), attendu);
  for (const [f, css] of [['archives.css', archives], ['mise-a-jour.css', maj]]) {
    assert.doesNotMatch(css, /:root|prefers-color-scheme|--nv-(?:vert|rouge)/, `${f} : ni bloc du thème, ni variable locale de couleur`);
  }
  // les quatre boutons principaux sont couverts par la règle : trois boîtes ou boutons du script, « Résoudre ce lot » du rendu des conflits ; la page et ses
  // boîtes de dialogue sont dans .mise-a-jour (les boîtes y sont ajoutées), la section des conflits dans .nv-dev
  const script = lire('src/scripts/mise-a-jour.mjs');
  const boutons = [...script.matchAll(/<button type="(?:button|submit)" class="nv-principal"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(boutons, ['Effectuer la mise à jour', 'Passer en version majeure', 'Lancer la simulation', 'Effectuer la mise à jour']);
  assert.ok(lire('src/lib/conflits-rendu.mjs').includes('<div class="nv-dev__actions"><button type="submit" class="nv-principal">Résoudre ce lot</button></div>'));
  assert.equal((script.match(/dialogue\.className = 'nv-dialogue';/g) ?? []).length, 2);
  assert.equal((script.match(/racine\.append\(dialogue\);/g) ?? []).length, 2);
  assert.ok(script.includes("const racine = document.querySelector('[data-mise-a-jour]');") && script.includes("const zone = racine.querySelector('[data-nv-dev]');")
    && script.includes('zone.append(sectionDesConflits());'));
  const page = lire('src/pages/mise-a-jour.astro');
  assert.match(page, /<div class="mise-a-jour" data-mise-a-jour [^>]*>\s*<section class="nv-dev" data-nv-dev /);
  // aucune famille ajoutée : les pages n'émettent aucune feuille de la palette (celle de chaque page leur vient de Base.astro), le plafond de 4 ko tenu
  for (const f of ['src/pages/archives.astro', 'src/pages/mise-a-jour.astro', 'src/pages/maintenance.astro']) {
    assert.doesNotMatch(lire(f), /palette-css|cssDes(?:Familles|SecondsRangs|Potions|Evenements|Parties)|style=/, f);
  }
  assert.doesNotMatch(cssDeLaPalette(), /amelioration|affaiblissement|google|texte-sur-good/);
  assert.ok(cssDeLaPalette().length < 4000, `${cssDeLaPalette().length} octets`);
});

test('lisibilité des archives et de la mise à jour dans les deux thèmes : chaque texte sur son fond, valeurs lues dans le thème (4,5:1)', () => {
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombres = blocs.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  /** La valeur d'un jeton dans un bloc du thème, ses `var(--x)` suivis (dans le bloc, sinon dans le thème clair). */
  const valeur = (b, nom) => {
    const v = b.valeur(nom) ?? clair.valeur(nom);
    const renvoi = v?.match(/^var\((--[a-z-]+)\)$/);
    if (renvoi) return valeur(b, renvoi[1]);
    return /^#[0-9a-f]{3}$/i.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v;
  };
  // les couples texte / fond des feuilles (règles épinglées par le test précédent) : l'étiquette d'un Doc et d'un Sheet ; le vert et le rouge sur leur fond
  // (mot ajouté ou retiré, pastilles) et seuls sur le fond de la page ou d'une liste (résumé d'un champ long, sens d'un champ) ; le texte d'un bouton
  // principal sur --good ; l'étiquette d'une partie, l'encart d'exemple, le texte adouci ; la coche d'une étape faite de la maintenance
  const COUPLES = [
    ['--doc-google', '--doc-google-fond'], ['--sheet-google', '--sheet-google-fond'],
    ['--amelioration', '--amelioration-fond'], ['--amelioration', '--bg'], ['--amelioration', '--surface'],
    ['--affaiblissement', '--affaiblissement-fond'], ['--affaiblissement', '--bg'], ['--affaiblissement', '--surface'],
    ['--texte-sur-good', '--good'], ['--accent', '--accent-soft'], ['--warn-text', '--warn-bg'], ['--muted', '--bg'], ['--muted', '--surface'],
    ['--surface', '--accent'],
  ];
  const css = ['src/styles/archives/archives.css', 'src/styles/mise-a-jour/mise-a-jour.css', 'src/styles/maintenance/maintenance.css'].map(lire).join('\n');
  for (const [texte, fond] of COUPLES) assert.ok(css.includes(`var(${texte})`) && css.includes(`var(${fond})`), `${texte} sur ${fond} : lus par les feuilles`);
  assert.ok(lire('src/styles/maintenance/maintenance.css').includes("li.fait::before { content: '✓'; border-color: var(--accent); background: var(--accent); color: var(--surface); }"));
  const mesures = [];
  for (const b of [clair, ...sombres]) {
    for (const [texte, fond] of COUPLES) {
      const [t, f] = [valeur(b, texte), valeur(b, fond)];
      assert.match(t, /^#[0-9a-f]{6}$/, `${texte}, ${b.sel}`);
      assert.match(f, /^#[0-9a-f]{6}$/, `${fond}, ${b.sel}`);
      const r = contraste(t, f);
      mesures.push([`${b.sel} : ${texte} sur ${fond}`, r]);
      assert.ok(r >= CONTRASTE_MINIMAL, `${b.sel} : ${texte} (${t}) sur ${fond} (${f}) = ${r.toFixed(2)}:1`);
    }
  }
  assert.equal(mesures.length, COUPLES.length * 3);
  // le plus juste : le vert d'une amélioration sur son fond, en clair (4,68:1)
  const [quoi, minimum] = mesures.reduce((m, x) => (x[1] < m[1] ? x : m));
  assert.equal(quoi, ':root : --amelioration sur --amelioration-fond', `le plus juste : ${quoi} (${minimum.toFixed(2)}:1)`);
  // le texte foncé des boutons en sombre (environ 9,9:1) : le blanc d'avant n'y était pas lisible (1,9:1), il l'est en clair (6,0:1)
  for (const b of sombres) {
    assert.ok(contraste(valeur(b, '--texte-sur-fonce'), valeur(b, '--good')) < CONTRASTE_MINIMAL, `${b.sel} : le blanc sur le vert clair`);
    assert.ok(contraste(valeur(b, '--texte-sur-good'), valeur(b, '--good')) > 9.5, `${b.sel} : le texte foncé`);
  }
  assert.ok(contraste(valeur(clair, '--texte-sur-fonce'), valeur(clair, '--good')) >= CONTRASTE_MINIMAL);
});

// Lot des restes (2026-10-23, même demande et mêmes choix de cadrage) : ce que les feuilles écrivaient encore. Le bandeau du site de dev, le niveau
// `evitee` de l'échelle des relations entre les peuples et l'ombre des infobulles passent à des jetons du thème, avec leurs valeurs d'avant (« Thème
// reste, Debug à part ») ; les voiles blancs des bannières et les ombres et voiles noirs s'écrivent en blanc et noir de mélange (« Non, exception »), au
// même rendu ; le texte posé sur le vert du site prend `--texte-sur-good` partout (réponse du propriétaire du 2026-10-23 à « En thème sombre, d'autres
// boutons et pastilles du site ont un texte blanc sur le vert du site (#7fcf9b) […] Faut-il appliquer le même choix ici ? » : « Même choix partout
// (Recommandé) »). Restent, nommés : l'impression et la page Debug (« la page Debug et l'impression ne changent pas »), les teintes des genres de sort et
// des types de don (en attente d'une réponse du propriétaire), les cases de tableau (lot 11).

/** Les feuilles que le balayage des restes laisse de côté en entier, avec leur raison. */
const FEUILLES_LAISSEES_DE_COTE = new Map([
  ['src/styles/debug/debug.css', 'la page Debug (« Thème reste, Debug à part » : elle ne change pas)'],
  ['src/styles/debug/schema.css', 'le schéma de la page Debug (même choix)'],
  ['src/styles/magie/print.css', 'l’impression des pages de magie (« l’impression ne change pas »)'],
]);
/** Les feuilles dont les blocs `@media print` écrivent le noir et le blanc de l'impression (« l'impression ne change pas ») : ces blocs sont laissés de côté. */
const IMPRESSION_LAISSEE_DE_COTE = ['src/styles/classe/page.css', 'src/styles/race/page.css', 'src/styles/global/common.css'];
/** Les règles laissées de côté : [feuille, sélecteur (tel quel, ou un motif), raison]. */
const REGLES_LAISSEES_DE_COTE = [
  ['src/styles/global/wiki.css', /^\[data-couleur="[a-z]+"\]$/, 'les couleurs des cases de tableau ({couleur:x}, lib/markdown-couleurs.mjs : lot 11)'],
];

/** L'indice de l'accolade qui ferme celle ouverte en `ouvrante`. */
const accoladeFermante = (texte, ouvrante) => {
  let profondeur = 0;
  for (let i = ouvrante; i < texte.length; i++) {
    if (texte[i] === '{') profondeur++;
    else if (texte[i] === '}' && --profondeur === 0) return i;
  }
  return texte.length - 1;
};
/** Une feuille sans ses blocs `@media print`, et ces blocs. */
const sansImpression = (css) => {
  const blocs = [];
  let reste = css;
  for (let m = reste.search(/@media print\s*\{/); m >= 0; m = reste.search(/@media print\s*\{/)) {
    const fin = accoladeFermante(reste, reste.indexOf('{', m));
    blocs.push(reste.slice(m, fin + 1));
    reste = reste.slice(0, m) + reste.slice(fin + 1);
  }
  return { reste, blocs };
};
/** Les feuilles du site (`src/styles/**.css`), chemins depuis client/. */
const feuillesDuSite = () => readdirSync(new URL('../src/styles/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.css'))
  .map((n) => `src/styles/${n.replaceAll('\\', '/')}`).sort();

test('les restes : aucune couleur écrite dans aucune feuille du site, hors les blocs du thème, le noir et le blanc de mélange et ce qui est laissé de côté, nommé', () => {
  const feuilles = feuillesDuSite();
  assert.ok(feuilles.length > 50, `${feuilles.length} feuilles`);
  // ce qui est laissé de côté existe et écrit encore ses couleurs (sinon, l'exception est à retirer)
  for (const f of FEUILLES_LAISSEES_DE_COTE.keys()) assert.ok(couleursDuFichier(f).length > 0, `${f} : plus de couleur écrite, l’exception est à retirer`);
  const trouvees = new Set();
  for (const f of feuilles.filter((x) => !FEUILLES_LAISSEES_DE_COTE.has(x))) {
    let css = lire(f).replace(/\/\*[\s\S]*?\*\//g, '');
    if (IMPRESSION_LAISSEE_DE_COTE.includes(f)) {
      const { reste, blocs } = sansImpression(css);
      assert.ok(blocs.some((b) => couleursEcrites(b, { nommees: true }).length > 0), `${f} : l’impression n’écrit plus de couleur, l’exception est à retirer`);
      css = reste;
    }
    // les blocs du thème (`:root…` de global/base.css) écrivent ses jetons (« Thème reste ») ; le reste de base.css est balayé comme toute feuille
    if (f === 'src/styles/global/base.css') css = css.replace(/:root[^{]*\{[^{}]*\}/g, '');
    css = css.replace(/([^{}]+)\{([^{}]*)\}/g, (regle, selecteur, corps) => {
      const s = selecteur.trim().replace(/\s+/g, ' ');
      const laissee = REGLES_LAISSEES_DE_COTE.find(([fichier, motif]) => fichier === f && (typeof motif === 'string' ? s === motif : motif.test(s)));
      if (!laissee) return regle;
      if (couleursEcrites(corps, { nommees: true }).length > 0) trouvees.add(laissee);
      return '';
    });
    assert.deepEqual(couleursEcrites(css, { nommees: true }), [], f);
  }
  for (const r of REGLES_LAISSEES_DE_COTE) assert.ok(trouvees.has(r), `${r[0]} ${r[1]} : plus de couleur écrite, l’exception est à retirer`);
  // les feuilles de ce lot y sont, entières hors l'impression et la partie B
  for (const f of ['src/styles/edition/edition.css', 'src/styles/global/site-shell.css', 'src/styles/global/infobulles.css', 'src/styles/galerie/carrousel.css',
    'src/styles/bestiaire/bestiaire.css', 'src/styles/race/base.css', 'src/styles/magie/page.css']) {
    assert.ok(feuilles.includes(f), f);
    assert.deepEqual(couleursDuFichier(f), [], f);
  }
});

/** Les jetons du lot des restes et leurs valeurs, en clair puis dans les deux blocs du thème sombre (null : pas redéfini, la même valeur dans les deux thèmes, comme avant). */
const JETONS_DES_RESTES = {
  '--bandeau-dev': ['#b45309', null],
  '--regard-evite': ['#c27a12', null],
  '--ombre-bulle': ['rgb(42 33 24 / 0.36)', 'rgb(0 0 0 / 0.6)'],
};

test('les restes : le bandeau du site de dev, l’échelle des relations et l’ombre des infobulles, des jetons du thème avec les valeurs d’avant ; le texte sur le vert du site, foncé en sombre partout ; les voiles en blanc et noir de mélange', () => {
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombres = blocs.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  assert.deepEqual(sombres.map((b) => b.sel), [':root:not([data-theme="light"])', ':root[data-theme="dark"]']);
  for (const [nom, [enClair, enSombre]] of Object.entries(JETONS_DES_RESTES)) {
    assert.equal(clair.valeur(nom), enClair, `${nom}, clair`);
    for (const b of sombres) assert.equal(b.valeur(nom), enSombre ?? undefined, `${nom}, ${b.sel}`);
  }
  // aucun n'a la valeur d'une autre variable de son bloc, sauf le bandeau : la valeur de --a-choisir et --a-choisir-plein en clair, un autre sens
  // (« Garder séparées », comme --vert-action au lot 8)
  const corpsDesBlocs = new Map([...lire('src/styles/global/base.css').matchAll(/(:root[^{]*)\{([^{}]*)\}/g)].map(([, sel, corps]) => [sel.trim(), corps]));
  for (const b of [clair, ...sombres]) {
    const variables = [...corpsDesBlocs.get(b.sel).matchAll(/\n\s*(--[a-z0-9-]+): ([^;]+);/g)].map(([, nom, v]) => [nom, v.trim().toLowerCase()]);
    for (const nom of Object.keys(JETONS_DES_RESTES).filter((n) => b.valeur(n))) {
      const egales = variables.filter(([autre, x]) => autre !== nom && x === b.valeur(nom).toLowerCase()).map(([autre]) => autre);
      assert.deepEqual(egales, nom === '--bandeau-dev' && b === clair ? ['--a-choisir', '--a-choisir-plein'] : [], `${b.sel} : ${nom} a la valeur de ${egales}`);
    }
  }
  const dans = (fichier, selecteur, attendu) => {
    const regle = regleDe(lire(fichier), selecteur);
    for (const a of [attendu].flat()) assert.ok(regle.includes(a), `${fichier}, ${selecteur} : « ${a} » dans « ${regle} »`);
  };
  // les feuilles lisent les jetons
  dans('src/styles/global/site-shell.css', '.bandeau-test', ['background: var(--bandeau-dev);', 'color: var(--texte-sur-fonce);']);
  assert.match(lire('src/layouts/Base.astro'), /<p class="bandeau-test" role="note">/, 'le bandeau : sa classe, sans style');
  dans('src/styles/race/base.css', '.race', '--regard-evitee: color-mix(in srgb, var(--regard-evite) 70%, var(--surface));');
  dans('src/styles/global/infobulles.css', '.bulle', 'box-shadow: 0 12px 28px -10px var(--ombre-bulle), 0 2px 6px -2px var(--ombre-bulle);');
  assert.doesNotMatch(lire('src/styles/global/infobulles.css'), /--bulle-ombre/, 'l’ombre ne se règle plus dans la feuille, ni en sombre');
  // le texte posé sur le vert du site : --texte-sur-good, sur chaque aplat --good des feuilles (hors Debug, dont la jauge ne porte pas de texte)
  const surLeVert = feuillesDuSite().filter((f) => !FEUILLES_LAISSEES_DE_COTE.has(f))
    .flatMap((f) => [...lire(f).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , corps]) => /background: var\(--good\)/.test(corps)).map(([, s, corps]) => ({ regle: `${f} ${s.trim().replace(/\s+/g, ' ')}`, corps })));
  assert.deepEqual(surLeVert.map((r) => r.regle), [
    "src/styles/edition/edition.css .ed-confirmer", "src/styles/edition/edition.css .ed-dialogue button[type='submit']",
    'src/styles/fiche/fiche.css .onglet__compte[data-ok]', 'src/styles/mise-a-jour/mise-a-jour.css .nv-dev button.nv-principal, .nv-dialogue button.nv-principal',
  ]);
  for (const { regle, corps } of surLeVert) assert.match(corps, /color: var\(--texte-sur-good\);/, regle);
  // le compteur des onglets de la fiche dans ses autres états : sur le rouge du site (règles à revoir), --texte-sur-danger (réponse du propriétaire du
  // 2026-10-23 à « En thème sombre, le compteur rouge de l'onglet « Contrôle » de la fiche […] Faut-il le même choix ici ? » : « Texte foncé en sombre
  // (Recommandé) ») : le texte sur aplat foncé en clair, le fond sombre du site dans les deux blocs du thème sombre ; en attente, le texte sur aplat foncé
  dans('src/styles/fiche/fiche.css', '.onglet__compte', ['background: var(--danger);', 'color: var(--texte-sur-danger);']);
  dans('src/styles/fiche/fiche.css', '.onglet__compte--attente', ['background: var(--a-choisir-plein);', 'color: var(--texte-sur-fonce);']);
  assert.equal(clair.valeur('--texte-sur-danger'), 'var(--texte-sur-fonce)');
  for (const b of sombres) assert.equal(b.valeur('--texte-sur-danger'), 'var(--bg)', b.sel);
  // les voiles blancs des bannières et les ombres et voiles noirs : le blanc ou le noir de mélange, à la part de l'alpha d'avant
  for (const [fichier, selecteur, attendu] of [
    ['src/styles/classe/page.css', '.classe-stat', ['background: color-mix(in srgb, #fff 12%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 22%, transparent);']],
    ['src/styles/classe/page.css', '.classe-hero__reperes li', ['background: color-mix(in srgb, #fff 14%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 28%, transparent);']],
    ['src/styles/classe/dons.css', '.onglet__magique', ['background: color-mix(in srgb, #fff 16%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 30%, transparent);']],
    ['src/styles/classe/dons.css', '.specialite__magique', ['background: color-mix(in srgb, #fff 16%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 30%, transparent);']],
    ['src/styles/race/page.css', '.race-stat', ['background: color-mix(in srgb, #fff 12%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 22%, transparent);']],
    ['src/styles/magie/page.css', '.magie-hero__roles li', ['background: color-mix(in srgb, #fff 16%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 28%, transparent);']],
    ['src/styles/magie/page.css', '.magie-stat', ['background: color-mix(in srgb, #fff 12%, transparent);', 'border: 1px solid color-mix(in srgb, #fff 22%, transparent);']],
    ['src/styles/edition/edition.css', '.ed-crayon,\n.ed-confirmer', 'box-shadow: 0 4px 14px color-mix(in srgb, #000 22%, transparent);'],
    ['src/styles/edition/edition.css', '.ed-dialogue', 'box-shadow: 0 18px 50px color-mix(in srgb, #000 35%, transparent);'],
    ['src/styles/edition/edition.css', '.ed-dialogue::backdrop', 'background: color-mix(in srgb, #000 45%, transparent);'],
    ['src/styles/edition/edition.css', '.ed-annonce', 'box-shadow: 0 6px 20px color-mix(in srgb, #000 25%, transparent);'],
    ['src/styles/edition/edition.css', '.ed-barre-guide', 'box-shadow: 0 6px 20px color-mix(in srgb, #000 20%, transparent);'],
    ['src/styles/galerie/carrousel.css', '.carrousel__diapo img', 'filter: drop-shadow(0 0.4rem 0.8rem color-mix(in srgb, #000 25%, transparent));'],
    ['src/styles/bestiaire/bestiaire.css', '.bfacette__panneau', 'box-shadow: 0 8px 24px color-mix(in srgb, #000 18%, transparent);'],
  ]) dans(fichier, selecteur, attendu);
  // rien d'ajouté à la feuille de chaque page, le plafond de 4 ko tenu
  assert.doesNotMatch(cssDeLaPalette(), /bandeau-dev|regard-evite|ombre-bulle|texte-sur-good/);
  assert.ok(cssDeLaPalette().length < 4000, `${cssDeLaPalette().length} octets`);
});

test('lisibilité des restes dans les deux thèmes : le bandeau du site de dev, les boutons du mode modification et le compteur des onglets de la fiche dans chacun de ses états (4,5:1)', () => {
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombres = blocs.filter((b) => b.sel !== ':root' && b.valeur('--bg'));
  /** La valeur d'un jeton dans un bloc du thème, ses `var(--x)` suivis (dans le bloc, sinon dans le thème clair). */
  const valeur = (b, nom) => {
    const v = b.valeur(nom) ?? clair.valeur(nom);
    const renvoi = v?.match(/^var\((--[a-z-]+)\)$/);
    if (renvoi) return valeur(b, renvoi[1]);
    return /^#[0-9a-f]{3}$/i.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v;
  };
  // les couples texte / fond des règles épinglées par le test précédent
  const COUPLES = [
    ['le bandeau du site de dev', '--texte-sur-fonce', '--bandeau-dev'],
    ['« Enregistrer », la validation des boîtes du mode modification et le compteur « ✓ » de l’onglet Contrôle', '--texte-sur-good', '--good'],
    ['le compteur des choix en attente', '--texte-sur-fonce', '--a-choisir-plein'],
    ['le compteur des règles à revoir', '--texte-sur-danger', '--danger'],
  ];
  const mesures = [];
  for (const b of [clair, ...sombres]) {
    for (const [quoi, texte, fond] of COUPLES) {
      const [t, f] = [valeur(b, texte), valeur(b, fond)];
      assert.match(t, /^#[0-9a-f]{6}$/, `${texte}, ${b.sel}`);
      assert.match(f, /^#[0-9a-f]{6}$/, `${fond}, ${b.sel}`);
      const r = contraste(t, f);
      const cle = `${b.sel} : ${quoi}`;
      mesures.push([cle, r]);
      assert.ok(r >= CONTRASTE_MINIMAL, `${cle} : ${texte} (${t}) sur ${fond} (${f}) = ${r.toFixed(2)}:1`);
    }
  }
  assert.equal(mesures.length, COUPLES.length * 3);
  // le plus juste : le blanc sur #b45309, 5,0:1, dans les deux thèmes (le bandeau, le compteur des choix en attente)
  assert.equal(Math.min(...mesures.map(([, r]) => r)).toFixed(2), '5.02');
  // le texte foncé sur le vert en sombre (9,9:1) : le blanc d'avant n'y était pas lisible (1,9:1) ; en clair, le blanc (6,0:1)
  for (const b of sombres) {
    assert.ok(contraste(valeur(b, '--texte-sur-fonce'), valeur(b, '--good')) < CONTRASTE_MINIMAL, `${b.sel} : le blanc sur le vert clair`);
    assert.ok(contraste(valeur(b, '--texte-sur-good'), valeur(b, '--good')) > 9.5, `${b.sel} : le texte foncé`);
  }
  assert.ok(contraste(valeur(clair, '--texte-sur-good'), valeur(clair, '--good')) > 6);
  // de même sur le rouge du site : en sombre, le texte foncé (7,6:1) là où le blanc n'atteignait que 2,4:1 ; en clair, le blanc inchangé (7,7:1)
  for (const b of sombres) {
    assert.ok(contraste(valeur(b, '--texte-sur-fonce'), valeur(b, '--danger')) < CONTRASTE_MINIMAL, `${b.sel} : le blanc sur le rouge clair`);
    assert.ok(contraste(valeur(b, '--texte-sur-danger'), valeur(b, '--danger')) > 7.5, `${b.sel} : le texte foncé`);
  }
  assert.equal(valeur(clair, '--texte-sur-danger'), valeur(clair, '--texte-sur-fonce'));
  assert.ok(contraste(valeur(clair, '--texte-sur-danger'), valeur(clair, '--danger')) > 7.6);
});

// Lot des restes, partie B (2026-10-23) : les teintes des genres de sort et des types de don, couleurs du site (réponse du propriétaire : « Garder les
// teintes actuelles (Recommandé) » ; option : « Garder les teintes actuelles comme couleurs du site : chaque genre et chaque type de don reçoit sa classe du
// site, avec la teinte qu'il a aujourd'hui, comme les parties du guide. Le rendu ne change pas, dans les deux thèmes. Aucune couleur nouvelle. »). Le Soin
// en clair : l'option recommandée « Assombrir le Soin en clair », appliquée au nom de la réponse permanente du propriétaire du 2026-10-23 (« Pour toutes tes
// prochaines questions sur le thème et les palette, considère que je réponds "rcommandé" à chaque fois. »).

/** Les teintes d'avant le lot, [teinte, saturation] de l'ancien `hsl(<teinte> <saturation> 50%)` des feuilles. */
const TEINTES_D_AVANT = {
  genre: { attaque: [5, 60], entrave: [275, 60], soin: [55, 60], amplification: [120, 60], protection: [185, 60], placement: [42, 60], invocation: [320, 60],
    construction: [22, 60], meteo: [232, 60], aleatoire: [30, 0] },
  don: { passif: [210, 30], actif: [32, 55], action: [5, 55], reaction: [275, 55], variable: [30, 0] },
};
/** hsl(h s l) en canaux sRGB 0-255, non arrondis. */
const canauxHsl = (h, s, l) => {
  const [S, L] = [s / 100, l / 100];
  const a = S * Math.min(L, 1 - L);
  const f = (n) => { const k = (n + h / 30) % 12; return (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255; };
  return [f(0), f(8), f(4)];
};
const versHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
const canauxHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** color-mix(in srgb, a p, b) sur des canaux. */
const melange = (a, p, b) => a.map((c, i) => c * p + b[i] * (1 - p));

test('les genres de sort et les types de don : une classe par genre et par type, la teinte d’avant ; posée par les rendus, émise par les seules pages des magies et des classes', () => {
  assert.equal(FAMILLES_DE_LA_PALETTE.genre, COULEURS_DES_GENRES);
  assert.equal(FAMILLES_DE_LA_PALETTE.don, COULEURS_DES_TYPES_DE_DON);
  // une couleur par valeur des listes fermées (CHECK du schéma, TYPES_DE_SORT, TYPES_DE_DON) : pas de `par-defaut`
  assert.deepEqual(Object.keys(COULEURS_DES_GENRES).sort(), [...TYPES_DE_SORT].sort());
  assert.deepEqual(Object.keys(COULEURS_DES_TYPES_DE_DON), TYPES_DE_DON);
  assert.ok(!Object.hasOwn(COULEURS_DES_GENRES, PAR_DEFAUT) && !Object.hasOwn(COULEURS_DES_TYPES_DE_DON, PAR_DEFAUT));
  // la valeur : l'ancien hsl(… 50 %), arrondi au hex ; le fond de la classe sans correction (famille sans texte posé sur la couleur pure)
  for (const [famille, teintes] of Object.entries(TEINTES_D_AVANT)) {
    for (const [cle, [h, s]] of Object.entries(teintes)) {
      assert.equal(FAMILLES_DE_LA_PALETTE[famille][cle], versHex(canauxHsl(h, s, 50)), `${famille} ${cle}`);
      assert.ok(cssDesFamilles([famille]).includes(`.couleur-${famille}-${cle}{--couleur:${versHex(canauxHsl(h, s, 50))};`), `${famille} ${cle} : sa classe`);
    }
  }
  assert.equal(classeDeGenre('soin'), 'couleur-genre-soin');
  assert.equal(classeDeTypeDeDon('reaction'), 'couleur-don-reaction');
  assert.equal(classeDeGenre('inconnu'), null);
  // émission : les pages des magies et des classes seules, pas la feuille de chaque page (plafond de 4 ko)
  assert.ok(lire('src/components/magie/MagiePage.astro').includes("<style is:inline set:html={cssDesFamilles(['genre'])}></style>"));
  assert.ok(lire('src/components/classes/ClassePage.astro').includes("<style is:inline set:html={cssDesFamilles(['classe', 'don'])}></style>"));
  assert.doesNotMatch(cssDeLaPalette(), /couleur-(?:genre|don)-/);
  assert.ok(cssDeLaPalette().length < 4000);
  // les rendus posent la classe, jamais un style
  assert.ok(lire('src/components/magie/LigneDeSort.astro').includes('<span class={`genre ${classeDeGenre(t.type)}`} data-genre={t.type}>'));
  assert.ok(lire('src/components/classes/DonCarte.astro').includes('<span class={`don-type ${classeDeTypeDeDon(don.type.id)}`} data-type={don.type.id} title={bulleType}>'));
  assert.equal(RENDUS['sort-type']('Attaque / Soin'), '<span class="genre couleur-genre-attaque" data-genre="attaque">Attaque</span> <span class="genre couleur-genre-soin" data-genre="soin">Soin</span> ');
  assert.match(RENDUS['don-type']('Réaction (1/combat)', {}, {}), /^<span class="don-type couleur-don-reaction" data-type="reaction">Réaction<\/span>/);
  // les feuilles : plus de teinte écrite ni de --gh, --gs, --gl ; la couleur lue sur l'étiquette qui porte la classe
  for (const [f, sel, v] of [['src/styles/magie/sorts.css', ".genre[class*='couleur-genre-']", '--genre-texte'], ['src/styles/classe/dons.css', ".don-type[class*='couleur-don-']", '--don-texte']]) {
    const css = lire(f);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /--g[hsl]\b|hsl\(/, f);
    assert.ok(regleDe(css, sel).includes(`${v}: color-mix(in srgb, var(--couleur) 68%, #000); border: 1px solid color-mix(in srgb, var(--couleur) 40%, var(--border)); background: color-mix(in srgb, var(--couleur) 15%, var(--surface)); color: color-mix(in srgb, var(${v}) 85%, var(--text));`), f);
    for (const sombre of [`:root:not([data-theme="light"]) ${sel}`, `:root[data-theme="dark"] ${sel}`]) assert.ok(css.includes(`${sombre} { ${v}: color-mix(in srgb, var(--couleur) 52%, #fff); }`), `${f} : ${sombre}`);
  }
  assert.ok(lire('src/styles/magie/sorts.css').includes('\n.genre.couleur-genre-soin { --genre-texte: color-mix(in srgb, var(--couleur) 64%, #000); }'));
  for (const f of ['src/styles/magie/base.css', 'src/styles/classe/base.css']) assert.doesNotMatch(lire(f), /--gl\b/, f);
});

test('lisibilité des étiquettes des genres de sort et des types de don dans les deux thèmes : le texte sur son fond (4,5:1), le rendu d’avant hors le Soin en clair', () => {
  const blocs = blocsDuTheme();
  const clair = blocs.find((b) => b.sel === ':root');
  const sombre = blocs.find((b) => b.sel === ':root[data-theme="dark"]');
  const mesures = [];
  for (const [famille, teintes] of Object.entries(TEINTES_D_AVANT)) {
    for (const [cle, [h, s]] of Object.entries(teintes)) {
      const couleur = canauxHex(FAMILLES_DE_LA_PALETTE[famille][cle]);
      for (const [theme, b, part, vers, gl] of [['clair', clair, famille === 'genre' && cle === 'soin' ? 0.64 : 0.68, [0, 0, 0], 34], ['sombre', sombre, 0.52, [255, 255, 255], 74]]) {
        const [surface, texteDuSite] = [canauxHex(b.valeur('--surface')), canauxHex(b.valeur('--text'))];
        const fond = melange(couleur, 0.15, surface);
        const texte = melange(melange(couleur, part, vers), 0.85, texteDuSite);
        // le rendu d'avant : hsl(h s gl) à 85 % sur le texte (écart d'arrondi seulement), sauf le Soin en clair, assombri
        const avant = melange(canauxHsl(h, s, gl), 0.85, texteDuSite);
        const ecart = Math.max(...texte.map((c, i) => Math.abs(c - avant[i])));
        if (famille === 'genre' && cle === 'soin' && theme === 'clair') {
          assert.ok(contraste(versHex(avant), versHex(fond)) < CONTRASTE_MINIMAL, 'le Soin d’avant en clair : 4,4:1');
        } else assert.ok(ecart < 0.5, `${famille} ${cle}, ${theme} : écart ${ecart}`);
        const r = contraste(versHex(texte), versHex(fond));
        mesures.push([`${famille} ${cle}, ${theme}`, r]);
        assert.ok(r >= CONTRASTE_MINIMAL, `${famille} ${cle}, ${theme} : ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.equal(mesures.length, 30);
  // le plus juste : l'Amplification en clair (4,67:1), puis le Soin assombri (4,8:1)
  const [quoi, minimum] = mesures.reduce((m, x) => (x[1] < m[1] ? x : m));
  assert.equal(quoi, 'genre amplification, clair', `${quoi} : ${minimum.toFixed(2)}`);
  assert.ok(mesures.find(([q]) => q === 'genre soin, clair')[1] > 4.7);
});

test('les étiquettes des genres et des types dans les pages construites : leur classe, définie dans une feuille de la page, sans style', construit ? {} : { skip: 'site non construit (npm run build)' }, () => {
  const page = (rel) => readFileSync(new URL(`../dist/${rel}`, import.meta.url), 'utf8');
  const pages = [];
  for (const dossier of ['magies', 'classes']) {
    for (const n of readdirSync(new URL(`../dist/${dossier}/`, import.meta.url))) if (existsSync(new URL(`../dist/${dossier}/${n}/index.html`, import.meta.url))) pages.push(`${dossier}/${n}/index.html`);
  }
  let genres = 0, types = 0;
  for (const rel of pages) {
    const html = page(rel);
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
    for (const [, classes] of html.matchAll(/<span class="((?:genre|don-type)(?: [^"]*)?)"/g)) {
      const famille = classes.startsWith('genre') ? 'genre' : 'don';
      const classe = classes.split(' ').find((c) => c.startsWith(`couleur-${famille}-`));
      assert.ok(classe, `${rel} : « ${classes} » sans sa classe`);
      assert.ok(styles.includes(`.${classe}{`), `${rel} : ${classe} sans sa feuille`);
      if (famille === 'genre') genres++; else types++;
    }
    assert.doesNotMatch(html, /<span class="(?:genre|don-type)[^"]*"[^>]*style=/, rel);
  }
  assert.ok(genres > 300 && types > 300, `${genres} genres, ${types} types`);
});

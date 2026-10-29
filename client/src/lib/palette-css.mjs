// La palette du site en classes CSS (demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de
// règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; « Privilégé la lisibilité. » ; puis, pour la
// source des couleurs : « La classe CSS du site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la
// couleur du classeur. »).
//
// Choix du propriétaire (2026-10-22, questions de cadrage) :
//   - « Module JS → classe » : la valeur reste dans le module de sa règle, cette feuille en est fabriquée au build ; une page ne pose plus que la classe.
//     Ce module n'écrit aucune couleur : il les lit toutes dans les modules des règles (test/palette-css.test.mjs).
//   - « Règle de calcul » : une couleur calculée (la nuance d'une potion selon son niveau) part d'une classe du site ; la classe d'une combinaison n'est
//     émise que par la page qui l'affiche (cssDesPotions), jamais écrite à la main.
//   - « Garder séparées » : chaque couleur garde son nom et sa classe, même quand deux règles ont la même valeur ; mais une affinité qui EST un attribut
//     ou une magie reste la classe de cet attribut ou de cette magie (aucune recopie : lib/alchimie-couleurs.mjs#baseDAffinite).
//   - « Thème reste, Debug à part » : les variables du thème (styles/global/base.css) ne sont pas ici ; la page Debug et l'impression ne changent pas.
//
// Une classe = `.couleur-<famille>-<id>`, qui pose `--couleur` (le fond) et `--couleur-texte` (le texte le plus lisible dessus,
// sort-format.mjs#texteSurCouleur). Les familles (FAMILLES_DE_LA_PALETTE) :
//   - magie : sort-format.mjs#COULEURS_DES_MAGIES, id = le nom court normalisé de la magie (« feu », « espace-temps »), plus `par-defaut`
//     (COULEUR_PAR_DEFAUT, la couleur d'une magie inconnue) ;
//   - attribut : lib/attributs-couleurs.mjs (sante, barriere, chakra, corruption ; la 4ᵉ barre prend la classe de sa magie) ;
//   - caracteristique : lib/caracteristiques-postures.mjs#COULEURS_CARACTERISTIQUES (id de la base : force, volonte…), plus `par-defaut`
//     (COULEUR_NEUTRE) ; une compétence porte la classe de sa caractéristique ;
//   - affinite : lib/alchimie-couleurs.mjs#COULEURS_DES_AFFINITES, les dix affinités sans autre règle (d'après le Doc « Alchimie ») ;
//   - posture : lib/caracteristiques-postures.mjs#COULEURS_POSTURES (fin de l'id de la base : offensif…), plus `par-defaut` ;
//   - alignement : lib/caracteristiques-postures.mjs#COULEURS_ALIGNEMENTS (« Loyal Bon » → loyal-bon), plus `par-defaut` ;
//   - classe : lib/class-groups.mjs#CLASS_COLORS, la couleur d'une catégorie de /classes/ (melee, distance, magiques, raciales, speciales), celle de ses
//     classes (classeDUneClasse : la catégorie de class-groups.mjs#groupeDeCouleur) ;
//   - race : lib/race-kinds.mjs#RACE_COLORS (pure, hybride) ; une ethnie n'a pas de couleur à elle : la fiche la montre dans celle de la race ;
//   - palier : lib/fiche-couleurs.mjs#COULEURS_DES_PALIERS (resistance_palier.id : grande_resistance → grande-resistance), le trait d'un palier de
//     résistance de la fiche ;
//   - mode : lib/fiche-couleurs.mjs#COULEURS_DU_MODE_HYPER (hyper, cent), les cases du Mode Hyper et du Mode Hyper 100 % de la fiche ;
//   - neutre : la seule classe `par-defaut` (COULEUR_NEUTRE), pour ce que la fiche montre sans couleur de règle (la magie acquise « Aucune », un
//     objet de départ au choix, une ethnie sans race choisie) ; aucune autre valeur n'est ajoutée pour eux.
//   - materiau : lib/materiaux-couleurs.mjs#COULEURS_DES_MATERIAUX (fin de ressource.id : fer, fer-noir…), plus `par-defaut` (COULEUR_NEUTRE : un
//     matériau sans couleur dans l'onglet) ; la ligne d'un matériau de l'onglet Armes, sa pastille dans la fiche de l'arme et sur la page Composants ;
//   - arme : lib/equipement-couleurs.mjs#COULEURS_DES_ARMES (depart : le bleu des armes de départ, sans texte : une nuance et un filet) ;
//   - armure : lib/equipement-couleurs.mjs#COULEURS_DES_TYPES (le type d'une armure ou d'une matière : « Léger » → leger), plus `par-defaut`
//     (COULEUR_SANS_TYPE) ;
//   - poids : lib/equipement-couleurs.mjs#COULEURS_DES_POIDS (bouclier_poids.id, décision R92), plus `par-defaut` (COULEUR_SANS_TYPE) ; la pastille du
//     poids d'un bouclier et sa tuile dans la fiche de personnage ;
//   - niveau : lib/accessoires-couleurs.mjs#COULEURS_DES_NIVEAUX (le niveau d'un effet ou d'une monture de l'onglet Accessoires, 1 à 5), sans
//     `par-defaut` : un niveau absent (« Niveau ? », ligne vide) ne porte aucune classe ; les pastilles des niveaux, les lignes d'effet et de monture,
//     l'encart de l'accessoire créé ;
//   - partie : lib/parties-couleurs.mjs#COULEURS_DES_PARTIES (l'id d'une partie de l'ancien guide, lib/livres.mjs#PARTIES : decouvrir, creer, jouer,
//     progresser, plus-loin), sans `par-defaut` : une page sans partie (Règles avancées, Guide du MJ) ne porte aucune classe et garde l'accent du site ;
//     les pages de Découvrir et des Bases, leurs cartes « Par où commencer ? » de l'accueil, les groupes du sommaire des Bases, les quatre zones de la
//     fiche. Un texte blanc est posé sur ces couleurs (aplats du guide et de la fiche) : leur famille porte un texte.
//   - genre, don : lib/genres-couleurs.mjs (sort_type.type, capacite.type), sans `par-defaut` (listes fermées) : les étiquettes des genres de sort
//     des pages des magies et des types de don des pages de classe.
//   - case : lib/cases-couleurs.mjs#COULEURS_DES_CASES (rouge, orange…, les couleurs « {couleur:x} » des cases de tableau du Markdown des pages, que
//     pose lib/markdown-couleurs.mjs et que relit l'éditeur), sans `par-defaut` : la case mêle la couleur à la surface, texte du site (sans texte).
// L'id d'une classe est la clé du module de sa règle passée par text.mjs#normalize (« chakra+sante » → « chakra-sante ») : il ne change pas quand le nom
// affiché change.
//
// Où la feuille est émise (le poids de chaque page) : les familles que beaucoup de pages posent (FAMILLES_DE_CHAQUE_PAGE : magies, attributs,
// caractéristiques, affinités, cases de tableau : toute page qui rend du Markdown, et l'éditeur en place) et les seconds rangs des magies sont posés sur chaque page par layouts/Base.astro (cssDeLaPalette) ; les familles d'une
// zone (FAMILLES_DES_ZONES : postures, alignements, catégories de classe, races, paliers, Mode Hyper, neutre, matériaux, armes de départ, types
// d'armure, poids des boucliers, niveaux des accessoires, parties du guide) et les seconds rangs des caractéristiques ne le sont que par le composant des
// pages qui les posent (cssDesFamilles, cssDesSecondsRangs : le bloc « postures » du guide, la fiche (FAMILLES_DE_LA_FICHE), l'onglet Armes, les onglets
// Armures et Boucliers, l'onglet Accessoires, la page Composants, /classes/ et les pages de classe, /races/ et les pages de race, le mode modification
// qui dessine une race ou une classe créée, une page de Découvrir ou des Bases, l'accueil et le sommaire des Bases), comme les combinaisons des potions
// (cssDesPotions).
//
// Deux couleurs d'une même famille sur un même élément (dégradé de l'innée vers l'acquise, créature ou cible à deux magies, trait d'une relation entre
// deux magies, arme de deux compétences) : la première est la classe de sa couleur (`--couleur`, `--couleur-texte`), la seconde sa classe de second
// rang `.couleur-2-<famille>-<id>` (classeDeSecondeMagie, classeDeSecondeCaracteristique), qui ne pose que `--couleur-2`. Un élément qui peut en avoir
// deux porte toujours les deux classes, la seconde de la même couleur quand il n'en a qu'une (classesDeDeuxMagies, classesDeDeuxCaracteristiques) : il
// n'hérite jamais du second rang d'un parent.
//
// Une potion (onglet Ceinture de la page Équipement) : sa classe de combinaison `.couleur-potion-<famille>-<id>-n<rang>` (classeDePotion) pose
// `--ligne-fond` et `--ligne-texte` (la ligne colorée du gabarit commun, styles/global/tableaux.css), calculés par lib/alchimie-couleurs.mjs#couleurDePotion
// depuis la couleur de sa classe de base ; components/ceinture/CeinturePanneau.astro n'émet que celles de ses lignes (cssDesPotions).
//
// Un événement de la chronologie : sa classe `.couleur-evenement-<id>` (classeDEvenement, id = l'id de l'événement normalisé) pose `--couleur` et
// `--couleur-texte`, la teinte que lui donne la règle du site (lib/chronologie-couleurs.mjs#couleursDesEvenements, d'après la liste des événements : ce
// n'est pas une famille fixe) ; components/chronologie/Chronologie.astro émet celles de la frise (cssDesEvenements), à part, et l'éditeur du site de
// dev les réécrit d'après la base vivante. Ce module n'importe pas la règle : il reçoit ses couleurs.
// Sans dépendance (modules purs) : importé au build (layouts/Base.astro, composants et modules de rendu) et par les tests.
import { COULEUR_PAR_DEFAUT, COULEURS_DES_MAGIES, cleDeMagieConnue, texteSurCouleur } from './sort-format.mjs';
import { COULEURS_DES_ATTRIBUTS } from './attributs-couleurs.mjs';
import { COULEUR_NEUTRE, COULEURS_ALIGNEMENTS, COULEURS_CARACTERISTIQUES, COULEURS_POSTURES, cleDePosture } from './caracteristiques-postures.mjs';
import { COULEURS_DES_AFFINITES, baseDAffinite, lisible } from './alchimie-couleurs.mjs';
import { CLASS_COLORS, groupeDeCouleur } from './class-groups.mjs';
import { RACE_COLORS } from './race-kinds.mjs';
import { COULEURS_DES_PALIERS, COULEURS_DU_MODE_HYPER } from './fiche-couleurs.mjs';
import { COULEURS_DES_MATERIAUX, cleDeMateriau } from './materiaux-couleurs.mjs';
import { COULEUR_SANS_TYPE, COULEURS_DES_ARMES, COULEURS_DES_POIDS, COULEURS_DES_TYPES } from './equipement-couleurs.mjs';
import { COULEURS_DES_NIVEAUX } from './accessoires-couleurs.mjs';
import { COULEURS_DES_PARTIES } from './parties-couleurs.mjs';
import { COULEURS_DES_GENRES, COULEURS_DES_TYPES_DE_DON } from './genres-couleurs.mjs';
import { COULEURS_DES_CASES } from './cases-couleurs.mjs';
import { normalize } from './text.mjs';

/** L'id de la classe d'une couleur inconnue de sa famille (magie : COULEUR_PAR_DEFAUT ; caractéristique, posture, alignement, neutre : COULEUR_NEUTRE). */
export const PAR_DEFAUT = 'par-defaut';
/** L'id de la couleur d'une magie inconnue du site (sort-format.mjs#couleurDeMagie : COULEUR_PAR_DEFAUT). */
export const MAGIE_PAR_DEFAUT = PAR_DEFAUT;

/** Les familles de la palette : pour chacune, ses couleurs (clé du module de la règle → « #rrggbb »), lues dans le module de sa règle. */
export const FAMILLES_DE_LA_PALETTE = Object.freeze({
  magie: Object.freeze({ ...COULEURS_DES_MAGIES, [PAR_DEFAUT]: COULEUR_PAR_DEFAUT }),
  attribut: COULEURS_DES_ATTRIBUTS,
  caracteristique: Object.freeze({ ...COULEURS_CARACTERISTIQUES, [PAR_DEFAUT]: COULEUR_NEUTRE }),
  affinite: COULEURS_DES_AFFINITES,
  posture: Object.freeze({ ...COULEURS_POSTURES, [PAR_DEFAUT]: COULEUR_NEUTRE }),
  alignement: Object.freeze({ ...COULEURS_ALIGNEMENTS, [PAR_DEFAUT]: COULEUR_NEUTRE }),
  classe: CLASS_COLORS,
  race: RACE_COLORS,
  palier: COULEURS_DES_PALIERS,
  mode: COULEURS_DU_MODE_HYPER,
  neutre: Object.freeze({ [PAR_DEFAUT]: COULEUR_NEUTRE }),
  materiau: Object.freeze({ ...COULEURS_DES_MATERIAUX, [PAR_DEFAUT]: COULEUR_NEUTRE }),
  arme: COULEURS_DES_ARMES,
  armure: Object.freeze({ ...COULEURS_DES_TYPES, [PAR_DEFAUT]: COULEUR_SANS_TYPE }),
  poids: Object.freeze({ ...COULEURS_DES_POIDS, [PAR_DEFAUT]: COULEUR_SANS_TYPE }),
  niveau: COULEURS_DES_NIVEAUX,
  partie: COULEURS_DES_PARTIES,
  genre: COULEURS_DES_GENRES,
  don: COULEURS_DES_TYPES_DE_DON,
  case: COULEURS_DES_CASES,
});

/**
 * Les familles posées sur chaque page (layouts/Base.astro : cssDeLaPalette), celles que beaucoup de pages posent ; `case` : les cases de tableau du
 * Markdown, sur toute page qui en rend (wiki, guide, Codex, chronologie, panneaux de règles, accueil) et dans l'éditeur en place, qui les pose au navigateur.
 */
export const FAMILLES_DE_CHAQUE_PAGE = Object.freeze(['magie', 'attribut', 'caracteristique', 'affinite', 'case']);
/**
 * Les familles d'une zone, émises par le composant des pages qui les posent (cssDesFamilles) : `posture` (le bloc « postures » du guide, la fiche),
 * `alignement`, `palier`, `mode`, `neutre` (la fiche), `classe` (/classes/, les pages de classe, la fiche, la page d'une classe créée sur le site de
 * dev), `race` (/races/, les pages de race, la fiche, la page d'une race créée), `materiau` (l'onglet Armes, la page Composants), `arme` (l'onglet
 * Armes), `armure` (les onglets Armures et Boucliers), `poids` (l'onglet Boucliers, la fiche), `niveau` (l'onglet Accessoires), `partie` (une page de
 * Découvrir ou des Bases, l'accueil, le sommaire des Bases, la fiche), `genre` (les pages des magies), `don` (les pages de classe).
 */
export const FAMILLES_DES_ZONES = Object.freeze(['posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre', 'materiau', 'arme', 'armure', 'poids', 'niveau', 'partie', 'genre', 'don']);

/**
 * Les familles d'une zone que la fiche de personnage pose (pages/fiche/index.astro) : toutes, sauf celles des onglets de l'équipement hors le poids (ni
 * les niveaux des accessoires) ; plus les parties du guide (la couleur de ses quatre zones).
 */
export const FAMILLES_DE_LA_FICHE = Object.freeze(['posture', 'alignement', 'classe', 'race', 'palier', 'mode', 'neutre', 'poids', 'partie']);

/**
 * Les familles sur la couleur desquelles aucun texte n'est posé en fond : `palier` (le trait de 3 px d'une ligne de résistance de la fiche), `arme` (le
 * bleu des armes de départ : une nuance sur la surface, un filet et, mêlé au texte du site, la couleur de la phrase des règles ; styles/armes/armes.css). Le seuil de lisibilité de 4,5:1 vaut pour un texte : leur fond reste la
 * couleur de leur règle, sans correction (test/palette-css.test.mjs ne mesure le contraste que des familles qui portent un texte). `genre` et `don`
 * (étiquettes des genres de sort et des types de don) : un fond pâle et un texte calculés depuis la couleur (styles/magie/sorts.css,
 * styles/classe/dons.css), mesurés à part ; jamais un texte sur la couleur pure. `case` (les cases de tableau du Markdown) : la couleur mêlée à 26 % à
 * la surface, sous le texte du site (styles/global/wiki.css), mesurée à part dans les deux thèmes.
 */
export const FAMILLES_SANS_TEXTE = Object.freeze(['palier', 'arme', 'genre', 'don', 'case']);

/**
 * Le fond d'une classe : la couleur de sa règle, rendue lisible (alchimie-couleurs.mjs#lisible) quand sa famille porte un texte : inchangée quand son
 * texte (texteSurCouleur) l'atteint déjà au contraste de 4,5:1, soit toutes sauf deux alignements, Loyal Bon et Loyal Neutre, à peine éclaircis
 * (test/palette-css.test.mjs). Pour ces deux-là, réponse du propriétaire du 2026-10-23 : « Éclaircir (Recommandé) » (la question et l'option, qui
 * écrivent les couleurs, sont citées telles quelles à lib/caracteristiques-postures.mjs#COULEURS_ALIGNEMENTS, où leur couleur de référence reste).
 * Une famille sans texte (FAMILLES_SANS_TEXTE) garde la couleur de sa règle.
 */
const fondDeClasse = (famille, couleur) => (FAMILLES_SANS_TEXTE.includes(famille) ? couleur : lisible(couleur));

/** L'id d'une couleur dans le nom de sa classe : la clé du module de sa règle, normalisée (« chakra+sante » → « chakra-sante »). */
export const idDeCouleur = (cle) => normalize(cle ?? '');

/** La classe d'une couleur de la palette (« couleur-magie-feu »), ou null si la famille ne la connaît pas. */
export function classeDeCouleur(famille, cle) {
  const couleurs = FAMILLES_DE_LA_PALETTE[famille];
  return couleurs && Object.hasOwn(couleurs, cle) ? `couleur-${famille}-${idDeCouleur(cle)}` : null;
}

/** La classe d'une couleur, ou celle de la couleur par défaut de sa famille (`par-defaut`) si la famille ne la connaît pas. */
const classeOuParDefaut = (famille, cle) => classeDeCouleur(famille, cle) ?? classeDeCouleur(famille, PAR_DEFAUT);
/** La classe de second rang d'une classe de la palette (« couleur-magie-eau » → « couleur-2-magie-eau » : `--couleur-2`). */
const auSecondRang = (classe) => `couleur-2-${classe.slice('couleur-'.length)}`;

/** La classe d'une magie, d'après son nom ou son nom court (« Feu », « espace-temps ») ; celle de la couleur par défaut pour une magie inconnue. */
export const classeDeMagie = (nom) => classeDeCouleur('magie', cleDeMagieConnue(nom) ?? PAR_DEFAUT);

/** La classe de second rang d'une magie (« couleur-2-magie-eau » : `--couleur-2`), d'après son nom ; celle de la couleur par défaut si inconnue. */
export const classeDeSecondeMagie = (nom) => auSecondRang(classeDeMagie(nom));

/**
 * Les deux classes d'un élément à deux magies (dans l'ordre : l'innée puis l'acquise, la première puis la seconde magie d'une créature) : la classe de la
 * première, la classe de second rang de la seconde, ou de la première quand il n'y en a qu'une.
 */
export const classesDeDeuxMagies = (premiere, seconde) => [classeDeMagie(premiere), classeDeSecondeMagie(seconde ?? premiere)];

/** La classe d'un attribut de la fiche (« sante »), ou null. */
export const classeDAttribut = (cle) => classeDeCouleur('attribut', cle);

/**
 * La classe d'une caractéristique (id de la base : « force »), celle d'une compétence étant celle de sa caractéristique ; celle de la couleur par défaut
 * (COULEUR_NEUTRE, comme caracteristiques-postures.mjs#couleurDeCaracteristique) pour un id inconnu ou absent.
 */
export const classeDeCaracteristique = (id) => classeOuParDefaut('caracteristique', id);

/** La classe de second rang d'une caractéristique (« couleur-2-caracteristique-agilite » : `--couleur-2`) ; celle par défaut si inconnue. */
export const classeDeSecondeCaracteristique = (id) => auSecondRang(classeDeCaracteristique(id));

/** Les deux classes d'un élément à deux caractéristiques (une arme de deux compétences) : comme classesDeDeuxMagies. */
export const classesDeDeuxCaracteristiques = (premiere, seconde) =>
  [classeDeCaracteristique(premiere), classeDeSecondeCaracteristique(seconde ?? premiere)];

/** La classe d'une posture, d'après son id dans la base (« guide/postures#posture:offensif ») ou sa clé ; celle par défaut si inconnue. */
export const classeDePosture = (id) => classeOuParDefaut('posture', cleDePosture(id));

/** La classe d'un alignement, d'après son nom (« Loyal Bon » → « couleur-alignement-loyal-bon ») ; celle par défaut si inconnu. */
export const classeDAlignement = (nom) => classeOuParDefaut('alignement', nom);

/** La classe d'une catégorie de /classes/, d'après sa clé (« melee » → « couleur-classe-melee ») ; null si inconnue. */
export const classeDeCategorie = (cle) => classeDeCouleur('classe', cle);

/**
 * La classe de la couleur d'une classe (une page de classe ou son entrée minimale `{ id, data: { tags } }`) : celle de sa catégorie
 * (class-groups.mjs#groupeDeCouleur : Parleur sous « Spéciales », une classe non classée aussi), comme class-groups.mjs#classColor.
 */
export const classeDUneClasse = (entree) => classeDeCategorie(groupeDeCouleur(entree));

/** La classe d'une nature de race (« pure », « hybride » : race-kinds.mjs#raceKind) ; null si inconnue. */
export const classeDeRace = (nature) => classeDeCouleur('race', nature);

/** La classe d'un palier de résistance (resistance_palier.id : « grande_resistance » → « couleur-palier-grande-resistance ») ; null si inconnu. */
export const classeDePalier = (id) => classeDeCouleur('palier', id);

/** La classe d'une case du Mode Hyper (« hyper », « cent » : le Mode Hyper 100 %) ; null si inconnue. */
export const classeDuModeHyper = (cle) => classeDeCouleur('mode', cle);

/** La classe d'un matériau, d'après son identifiant dans la base (« ressources/armures#materiau:fer-noir » → « couleur-materiau-fer-noir ») ; `par-defaut` sans couleur. */
export const classeDeMateriau = (ressourceId) => classeOuParDefaut('materiau', cleDeMateriau(ressourceId ?? ''));

/** La classe des armes de départ (« couleur-arme-depart ») : posée sur l'onglet Armes, dont la feuille en tire `--depart`. */
export const CLASSE_DES_ARMES_DE_DEPART = classeDeCouleur('arme', 'depart');

/** La classe du type d'une armure ou d'une matière (« Léger » → « couleur-armure-leger ») ; `par-defaut` pour un type sans couleur (« Autres »…). */
export const classeDuTypeDArmure = (type) => classeOuParDefaut('armure', type);

/** La classe d'un poids de bouclier (bouclier_poids.id : « tres-lourd » → « couleur-poids-tres-lourd ») ; `par-defaut` pour un poids sans couleur. */
export const classeDuPoids = (id) => classeOuParDefaut('poids', id);

/** La classe du niveau d'un effet ou d'une monture de l'onglet Accessoires (1 → « couleur-niveau-1 ») ; null pour un niveau absent ou inconnu (aucune couleur). */
export const classeDeNiveau = (niveau) => classeDeCouleur('niveau', String(niveau ?? ''));

/** Le nom de la famille des parties du guide dans la palette (FAMILLES_DE_LA_PALETTE). */
export const FAMILLE_DES_PARTIES = 'partie';

/**
 * La classe d'une partie de l'ancien guide (lib/livres.mjs#PARTIES : « creer » → « couleur-partie-creer ») : celle d'une page de Découvrir ou des Bases
 * (lib/livres.mjs#partieDeLaPage), d'un groupe du sommaire des Bases, d'une zone de la fiche ; null pour une partie absente ou inconnue (aucune couleur :
 * l'accent du site).
 */
export const classeDePartie = (id) => classeDeCouleur(FAMILLE_DES_PARTIES, id ?? '');

/** La classe d'un genre de sort (sort_type.type : « soin » → « couleur-genre-soin ») ; null si inconnu. */
export const classeDeGenre = (type) => classeDeCouleur('genre', type ?? '');

/** La classe d'un type de don (capacite.type : « reaction » → « couleur-don-reaction ») ; null si inconnu. */
export const classeDeTypeDeDon = (type) => classeDeCouleur('don', type ?? '');

/**
 * La classe de la couleur d'une case de tableau (« {couleur:vert} » → « couleur-case-vert ») ; null si inconnue. Le même nom que
 * lib/markdown-edition.mjs#classeDeCouleurDeCase, que le plugin remark et l'éditeur posent sans importer ce module (testé).
 */
export const classeDeCase = (id) => classeDeCouleur('case', id ?? '');

/** La classe neutre (COULEUR_NEUTRE) : ce que la fiche montre sans couleur de règle (magie acquise « Aucune », objet de départ, ethnie sans race). */
export const CLASSE_NEUTRE = classeDeCouleur('neutre', PAR_DEFAUT);

/**
 * La classe de la couleur d'une affinité d'alchimie (`affinite.id`) : celle de son attribut, de sa magie, ou celle que le site lui ajoute ; null si le
 * site n'en a pas (Anti, Démon).
 */
export function classeDAffinite(id) {
  const base = baseDAffinite(id);
  return base ? classeDeCouleur(base.famille, base.cle) : null;
}

/**
 * Les couleurs de la palette : [{ famille, cle, classe, fond, texte }], famille après famille, dans l'ordre de leur module ; toutes, ou celles des
 * `familles` demandées.
 */
export function couleursDeLaPalette(familles = Object.keys(FAMILLES_DE_LA_PALETTE)) {
  return familles.flatMap((famille) =>
    Object.entries(FAMILLES_DE_LA_PALETTE[famille] ?? {}).map(([cle, couleur]) => {
      const fond = fondDeClasse(famille, couleur);
      return { famille, cle, classe: classeDeCouleur(famille, cle), fond, texte: texteSurCouleur(fond) };
    }));
}

/** Les classes de second rang d'une famille (« magie », « caracteristique ») : [{ cle, classe, fond }], dans l'ordre de la famille. */
export const secondsRangs = (famille) =>
  Object.entries(FAMILLES_DE_LA_PALETTE[famille] ?? {}).map(([cle, couleur]) => ({ cle, classe: auSecondRang(classeDeCouleur(famille, cle)), fond: fondDeClasse(famille, couleur) }));

/** Les classes de second rang des magies : [{ cle, classe, fond }], dans l'ordre de la famille `magie`. */
export const secondsRangsDesMagies = () => secondsRangs('magie');

/** La feuille des familles demandées : une règle par couleur, `.couleur-<famille>-<id>{--couleur:…;--couleur-texte:…}`. */
export const cssDesFamilles = (familles) => couleursDeLaPalette(familles).map((c) => `.${c.classe}{--couleur:${c.fond};--couleur-texte:${c.texte}}`).join('');

/** La feuille des classes de second rang d'une famille : une règle par couleur, `.couleur-2-<famille>-<id>{--couleur-2:…}`. */
export const cssDesSecondsRangs = (famille) => secondsRangs(famille).map((c) => `.${c.classe}{--couleur-2:${c.fond}}`).join('');

/**
 * La feuille de la palette posée sur chaque page (layouts/Base.astro) : les familles de FAMILLES_DE_CHAQUE_PAGE, puis les classes de second rang des
 * magies. Les familles d'une zone (FAMILLES_DES_ZONES) et les seconds rangs des caractéristiques n'y sont pas.
 */
export const cssDeLaPalette = () => cssDesFamilles(FAMILLES_DE_CHAQUE_PAGE) + cssDesSecondsRangs('magie');

/**
 * La feuille des parties du guide (famille `partie`, d'une zone) : celle qu'émettent une page de Découvrir ou des Bases, l'accueil et le sommaire des Bases
 * (la fiche l'émet avec ses autres familles, FAMILLES_DE_LA_FICHE).
 */
export const cssDesParties = () => cssDesFamilles([FAMILLE_DES_PARTIES]);

/** Les classes que la palette pose sur chaque page (familles de chaque page et seconds rangs des magies). */
export const classesDeLaPalette = () =>
  new Set([...couleursDeLaPalette(FAMILLES_DE_CHAQUE_PAGE), ...secondsRangsDesMagies()].map((c) => c.classe));

/**
 * La classe de la combinaison d'une potion (`couleur` : lib/alchimie-couleurs.mjs#couleurDePotion) : sa base et son niveau,
 * « couleur-potion-attribut-sante-n1 » (n0 sans niveau) ; null pour une potion sans couleur.
 */
export function classeDePotion(couleur) {
  if (!couleur?.base || !classeDeCouleur(couleur.base.famille, couleur.base.cle)) return null;
  return `couleur-potion-${couleur.base.famille}-${idDeCouleur(couleur.base.cle)}-n${couleur.niveau ?? 0}`;
}

/**
 * La feuille des combinaisons de potions qu'une page affiche (`couleurs` : celles de ses lignes, null compris) : une règle par classe,
 * `.couleur-potion-…{--ligne-fond:…;--ligne-texte:…}`, dans l'ordre de la première ligne qui la porte.
 */
export function cssDesPotions(couleurs) {
  const regles = new Map();
  for (const c of couleurs ?? []) {
    const classe = classeDePotion(c);
    if (classe && !regles.has(classe)) regles.set(classe, `.${classe}{--ligne-fond:${c.fond};--ligne-texte:${c.texte}}`);
  }
  return [...regles.values()].join('');
}

/** La classe de la couleur d'un événement de la chronologie, d'après son id (« flammes-bleues » → « couleur-evenement-flammes-bleues »). */
export const classeDEvenement = (id) => `couleur-evenement-${idDeCouleur(id)}`;

/**
 * La feuille des couleurs des événements de la chronologie (`couleurs` : la Map id → « #rrggbb » de lib/chronologie-couleurs.mjs#couleursDesEvenements) :
 * une règle par événement, `.couleur-evenement-<id>{--couleur:…;--couleur-texte:…}`, dans l'ordre de la Map ; le texte est celui de la règle du site
 * (texteSurCouleur). La règle donne à chaque teinte 4,5:1 avec le blanc : aucune n'est corrigée (test/palette-css.test.mjs).
 */
export const cssDesEvenements = (couleurs) =>
  [...(couleurs ?? [])].map(([id, fond]) => `.${classeDEvenement(id)}{--couleur:${fond};--couleur-texte:${texteSurCouleur(fond)}}`).join('');

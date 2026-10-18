// Cases de la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et
// exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle »). Deux dispositions de l'onglet « Personnage » :
//   - ORDINATEUR : le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » (client/src/modeles/fiche-personnage, tools/fiche/modele.py),
//     que la page /fiche/ écrit (lib/fiche-tableur-export.mjs) et relit (lib/fiche-tableur-import.mjs) ;
//   - AUTO : la « Fiche personnage Maverick Auto V15.2.2 » (Google Sheets, docs/fiche-auto.md), relue seulement : les fiches des joueurs.
// Le côté gauche (identité, classes, attributs, caractéristiques, compétences, dons) est le même dans les deux ; le côté droit (armes, armure,
// accessoires, inventaire, sorts) diffère. Adresses relevées sur le modèle (tools/fiche/modele.py) et sur deux fiches auto du propriétaire.
// Sans dépendance (n'importe rien : lib/text.mjs est partagé par d'autres scripts de page, CLAUDE.md « Pièges connus »).

/** Clé de comparaison d'un nom écrit dans une case : celle de lib/text.mjs#normalize, la ligature œ décomposée (« Cœur » = « Coeur »). */
export function cle(texte) {
  return String(texte ?? '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** « AB » → 28 (A = 1). */
export function numeroDeColonne(lettres) {
  let n = 0;
  for (const c of lettres) n = n * 26 + c.charCodeAt(0) - 64;
  return n;
}

/** 28 → « AB ». */
export function lettresDeColonne(numero) {
  let s = '';
  for (let n = numero; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** « AB12 » → { colonne: 28, ligne: 12 } ; null pour une adresse mal formée. */
export function decouperAdresse(adresse) {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(String(adresse ?? ''));
  return m ? { colonne: numeroDeColonne(m[1]), ligne: Number(m[2]) } : null;
}

const plage = (debut, fin, pas = 1) => Array.from({ length: Math.floor((fin - debut) / pas) + 1 }, (_, i) => debut + i * pas);

/** Les 30 compétences, dans l'ordre des lignes 22 à 36 : colonne de gauche (B…K) puis de droite (O…X). Ids de la table `competence`. */
export const COMPETENCES_GAUCHE = Object.freeze(['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite', 'calme', 'concentration', 'fermete',
  'survie', 'vigueur', 'connaissance', 'magie', 'medecine', 'psychologie', 'vie-en-nature']);
export const COMPETENCES_DROITE = Object.freeze(['arbalete', 'distinction', 'observation', 'orientation', 'sabotage', 'diplomatie', 'dressage',
  'intimidation', 'manipulation', 'negociation', 'arme-legere', 'equilibre', 'esquive', 'reflexe', 'ruse']);

/** Une case par compétence : { id, libelle (B22…), naturel, acquis, total }, les mêmes dans les deux dispositions. */
export const CASES_COMPETENCES = Object.freeze([
  ...COMPETENCES_GAUCHE.map((id, i) => ({ id, libelle: `B${22 + i}`, naturel: `G${22 + i}`, acquis: `I${22 + i}`, total: `K${22 + i}` })),
  ...COMPETENCES_DROITE.map((id, i) => ({ id, libelle: `O${22 + i}`, naturel: `T${22 + i}`, acquis: `V${22 + i}`, total: `X${22 + i}` })),
].map(Object.freeze));

/** Les caractéristiques (E18…), les mêmes dans les deux dispositions : base, bonus (magie innée et accessoires), deux cases de croix (R19). */
export const CASES_CARACTERISTIQUES = Object.freeze([
  { id: 'force', base: 'E18', bonus: 'G18', croix: ['H18', 'I18'] },
  { id: 'volonte', base: 'M18', bonus: 'O18', croix: ['P18', 'Q18'] },
  { id: 'intelligence', base: 'U18', bonus: 'W18', croix: ['X18', 'Y18'] },
  { id: 'perception', base: 'E19', bonus: 'G19', croix: ['H19', 'I19'] },
  { id: 'social', base: 'M19', bonus: 'O19', croix: ['P19', 'Q19'] },
  { id: 'agilite', base: 'U19', bonus: 'W19', croix: ['X19', 'Y19'] },
].map(Object.freeze));

/** Familles d'armes des lignes 2 à 7 (« Maîtrise d'armes ») : à gauche (libellé en AA), à droite (libellé en AR) ; ids de `arme_famille`.
 * Les noms du modèle ne sont pas ceux de la base (« Masses (d10) » = MASSE/MARTEAU) : table fixe. ARME DE MONSTRES n'a pas de ligne (R45). */
export const MAITRISES = Object.freeze([
  { famille: 'dagues', ligne: 2, cote: 'gauche' },
  { famille: 'epees', ligne: 3, cote: 'gauche' },
  { famille: 'masse-marteau', ligne: 4, cote: 'gauche' },
  { famille: 'hache', ligne: 5, cote: 'gauche' },
  { famille: 'lance-arme-dhast', ligne: 6, cote: 'gauche' },
  { famille: 'pugilat', ligne: 7, cote: 'gauche' },
  { famille: 'baton-de-combat', ligne: 2, cote: 'droite' },
  { famille: 'arme-de-jet', ligne: 3, cote: 'droite' },
  { famille: 'bombes', ligne: 4, cote: 'droite' },
  { famille: 'arc', ligne: 5, cote: 'droite' },
  { famille: 'arbalete', ligne: 6, cote: 'droite' },
].map(Object.freeze));

/** Modèle ordinateur : les cases « 2d 3d 4d 5d » d'une famille (le 2e dé, le 3e…), à gauche de AI à AL, à droite en miroir de AQ à AN.
 * Un dé atteint = sa case remplie (couleur REMPLISSAGE_DE_ATTEINT à l'export ; à l'import, toute couleur — sauf un fond commun à toutes les cases de
 * dés, celui du bloc — ou une marque écrite). */
export function casesDesDes(maitrise) {
  const colonnes = maitrise.cote === 'gauche' ? ['AI', 'AJ', 'AK', 'AL'] : ['AQ', 'AP', 'AO', 'AN'];
  return colonnes.map((c) => `${c}${maitrise.ligne}`);
}

/** Couleur d'un dé de maîtrise atteint (RRGGBB) : le gris foncé du modèle (titres), texte resté lisible. */
export const REMPLISSAGE_DE_ATTEINT = '808080';

/** Postures, dans l'ordre de `regles.ordre_postures` : case du titre (« OFFENSIF »…) et case des effets. Celle du moment est marquée ✔. */
export const CASES_POSTURES = Object.freeze([
  { id: 'guide/postures#posture:offensif', titre: 'BA16', effets: 'BA18' },
  { id: 'guide/postures#posture:neutre', titre: 'BI16', effets: 'BI18' },
  { id: 'guide/postures#posture:defensif', titre: 'BR16', effets: 'BR18' },
  { id: 'guide/postures#posture:focus', titre: 'BA23', effets: 'BA25' },
  { id: 'guide/postures#posture:vigilance', titre: 'BI23', effets: 'BI25' },
  { id: 'guide/postures#posture:symbiose', titre: 'BR23', effets: 'BR25' },
].map(Object.freeze));

/** « RÉSISTANCE / FAIBLESSE » : un palier (`resistance_paliers`) par ligne, libellé en BA, magies et altérations en BI. */
export const CASES_RESISTANCES = Object.freeze([
  { palier: 'immunite', libelle: 'BA2', cibles: 'BI2' },
  { palier: 'grande_resistance', libelle: 'BA4', cibles: 'BI4' },
  { palier: 'resistance', libelle: 'BA6', cibles: 'BI6' },
  { palier: 'vulnerabilite', libelle: 'BA8', cibles: 'BI8' },
  { palier: 'grande_vulnerabilite', libelle: 'BA10', cibles: 'BI10' },
  { palier: 'sensibilite', libelle: 'BA12', cibles: 'BI12' },
].map(Object.freeze));

/** Les dons (« CAPACITES - DONS ») : nom en C, type en I, effets en L ; lignes B (don de base), R (race), M (métier), E (entraînement), puis
 * 7 dons par classe sur deux lignes chacun, et 4 lignes d'événements dans le modèle ordinateur (la fiche auto en a autant qu'elle veut). */
export const DONS = Object.freeze({
  base: 39,
  race: 40,
  metier: 41,
  entrainement: 42,
  classe1: Object.freeze(plage(43, 55, 2)),
  classe2: Object.freeze(plage(57, 69, 2)),
  evenements: Object.freeze(plage(71, 74)),
});
export const casesDuDon = (ligne) => ({ nom: `C${ligne}`, type: `I${ligne}`, effet: `L${ligne}` });

/** Emplacements d'accessoires (`EMPLACEMENTS_ACCESSOIRES` du moteur) qui ont une case dans les deux modèles ; ceinture et autre n'en ont pas. */
export const EMPLACEMENTS_DU_MODELE = Object.freeze(['chef', 'collier', 'bracelet-1', 'bracelet-2', 'bague-1', 'bague-2']);

/** Les cases communes aux deux dispositions (côté gauche). */
const IDENTITE = Object.freeze({
  nom: 'I1', surnom: 'S1', race: 'I2', magieInnee: 'S2', lieuOrigine: 'I3', magieAcquise: 'S3', alignement: 'I4', dieuInne: 'S4', dieuChoisi: 'S5',
  loyal: 'L5', chaotique: 'M5', bon: 'N5', mauvais: 'O5', bourseP: 'L6', bourseO: 'Q6', bourseF: 'W6',
  classe1: 'A9', niveau1: 'G9', specialite1: 'I9', classe2: 'A11', niveau2: 'G11', specialite2: 'I11', niveauGlobal: 'W8', xp: 'S11',
  titreAttributs: 'A13', initiative: 'X14', libelleBarre4: 'A15', vitesse: 'R15', vitesseNage: 'T15', titreCaracteristiques: 'B17',
});

/** Modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » : chaque zone de saisie est une seule case fusionnée. */
export const ORDINATEUR = Object.freeze({
  disposition: 'ordinateur',
  ...IDENTITE,
  // valeurs du moment : « actuelle / maximum » dans une case
  sante: 'D14', chakra: 'K14', barriere: 'R14', barre4: 'D15', corruption: 'K15',
  // `solidite` (AK17, AX17, sous le libellé « Solidité ») : la solidité du moment et le maximum de l'arme forgée, « N / M » (décision R74), relue ; le
  // modèle y écrit « / » (MODELE_DE_LA_SOLIDITE)
  armes: Object.freeze([
    Object.freeze({ nom: 'AA10', degats: 'AG10', effet: 'AA13', portee: 'AK13', solidite: 'AK17' }),
    Object.freeze({ nom: 'AN10', degats: 'AT10', effet: 'AN13', portee: 'AX13', solidite: 'AX17' }),
  ]),
  armure: Object.freeze({
    apBase: 'AA22', amBase: 'AA24', nom: 'AD22', bonus: 'AQ21',
    // T C BG BD JG JD (guide « Fiche de personnage : Armure, défense et bouclier ») : emplacement de la base → colonne ; lignes AP, AM, Sol.
    colonnes: Object.freeze({ casque: 'AI', torse: 'AJ', 'bras-gauche': 'AK', 'bras-droit': 'AL', 'jambe-gauche': 'AM', 'jambe-droit': 'AN' }),
    lignes: Object.freeze({ ap: 22, am: 23, solidite: 24 }),
  }),
  bouclier: Object.freeze({ nom: 'AA26', composition: 'AF26', classe: 'AK26', ap: 'AN26', am: 'AS26', solidite: 'AX26' }),
  accessoires: Object.freeze({ chef: 'AD29', collier: 'AL29', 'bracelet-1': 'AD32', 'bracelet-2': 'AL32', 'bague-1': 'AD35', 'bague-2': 'AL35' }),
  ceinture: Object.freeze(['AR29', 'AR32', 'AR35']),
  // 12 lignes × 4 colonnes, rempli colonne par colonne (comme la fiche auto) ; « Nom ×N » quand la quantité n'est pas 1
  inventaire: Object.freeze({ titre: 'AA38', colonnes: Object.freeze(['AA', 'AG', 'AN', 'AT']), lignes: Object.freeze(plage(40, 51)) }),
  sorts: Object.freeze({
    titre: 'AA52', magieInnee: 'AG53', magieAcquise: 'AT53', lignes: Object.freeze(plage(55, 74)),
    colonnes: Object.freeze({ nom: 'AA', type: 'AE', cout: 'AH', portee: 'AJ', zone: 'AK', description: 'AM', nm: 'AY' }),
  }),
  modeHyper: Object.freeze({ titre: 'BA31', effets: 'BI32', race: 'BI43', magieInnee: 'BI46', magieAcquise: 'BI49' }),
  note: 'BA54',
  image: 'A1',
});

/** Fiche auto V15.2.2 (onglet « Personnage ») : valeurs du moment et maximums dans deux cases, armes et accessoires en plusieurs cases, cases à
 * cocher (TRUE / FALSE) pour les croix et la malédiction, quantités à côté des noms, maîtrises écrites « Nd » (AI à gauche, AN à droite). */
export const AUTO = Object.freeze({
  disposition: 'auto',
  ...IDENTITE,
  xpSuivant: 'W11',
  sante: 'D14', santeMax: 'F14', chakra: 'K14', chakraMax: 'M14', barriere: 'R14', barriereMax: 'T14', barre4: 'D15', barre4Max: 'F15',
  corruption: 'K15', corruptionMax: 'M15',
  maitrises: Object.freeze({ gauche: 'AI', droite: 'AN' }),
  ambidextrie: 'AU8',
  // `solidite` (AK15, AX15) : le maximum que calcule la fiche auto (les deux fiches du propriétaire : celui de la décision R51), pas la solidité du
  // moment : jamais relue, comme les autres valeurs calculées (docs/fiche-auto.md)
  armes: Object.freeze([
    Object.freeze({ nom: 'AA10', composition: 'AE10', degats: 'AI10', effet: 'AA13', amelioration: 'AI13', portee: 'AI15', solidite: 'AK15', element: 'AI17' }),
    Object.freeze({ nom: 'AN10', composition: 'AR10', degats: 'AV10', effet: 'AN13', amelioration: 'AV13', portee: 'AV15', solidite: 'AX15', element: 'AV17' }),
  ]),
  armure: Object.freeze({ apBase: 'AA21', amBase: 'AA23', nom: 'AD21', amelioration: 'AT20', element: 'AS21', ameliorationElement: 'AX21', effets: 'AA24' }),
  bouclier: Object.freeze({
    nom: 'AA26',
    materiaux: Object.freeze([
      Object.freeze({ materiau: 'AF26', quantite: 'AH27' }), Object.freeze({ materiau: 'AJ26', quantite: 'AL27' }), Object.freeze({ materiau: 'AN26', quantite: 'AP27' }),
    ]),
  }),
  accessoires: Object.freeze({
    chef: Object.freeze({ propriete: 'AD29', effet: 'AA30', valeur: 'AA31', maudit: 'AD31' }),
    collier: Object.freeze({ propriete: 'AL29', effet: 'AI30', valeur: 'AI31', maudit: 'AL31' }),
    'bracelet-1': Object.freeze({ propriete: 'AD32', effet: 'AA33', valeur: 'AA34', maudit: 'AD34' }),
    'bracelet-2': Object.freeze({ propriete: 'AL32', effet: 'AI33', valeur: 'AI34', maudit: 'AL34' }),
    'bague-1': Object.freeze({ propriete: 'AD35', effet: 'AA36', valeur: 'AA37', maudit: 'AD37' }),
    'bague-2': Object.freeze({ propriete: 'AL35', effet: 'AI36', valeur: 'AI37', maudit: 'AL37' }),
  }),
  // « CEINTURE » en AQ28 (une colonne plus à gauche que le modèle ordinateur), quantité en AX : relevé sur les deux fiches du propriétaire
  ceinture: Object.freeze([
    Object.freeze({ nom: 'AQ29', quantite: 'AX29' }), Object.freeze({ nom: 'AQ32', quantite: 'AX32' }), Object.freeze({ nom: 'AQ35', quantite: 'AX35' }),
  ]),
  inventaire: Object.freeze({
    titre: 'AA38', lignes: Object.freeze(plage(40, 51)),
    colonnes: Object.freeze([['AA', 'AF'], ['AG', 'AM'], ['AN', 'AS'], ['AT', 'AY']].map(([nom, quantite]) => Object.freeze({ nom, quantite }))),
  }),
  sorts: Object.freeze({
    titre: 'AA52', magieInnee: 'AG53', magieAcquise: 'AT53', lignes: Object.freeze(plage(55, 74)),
    colonnes: Object.freeze({ nom: 'AA', type: 'AE', cout: 'AH', portee: 'AJ', zone: 'AM', description: 'AO', nm: 'AY' }),
  }),
  // la fiche auto n'arrête pas les événements à la ligne 74
  evenementsJusqua: 120,
  note: 'BA54',
  image: 'A1',
});

/** Modèle ordinateur : le texte des cases de solidité (armes : AK17, AX17 ; bouclier : AX26, relue depuis la décision R96), « / », qui n'est pas une valeur. */
export const MODELE_DE_LA_SOLIDITE = '/';

/**
 * Modèle ordinateur : l'AP et l'AM de chaque partie de l'armure (grille AI22:AN23, colonnes de ORDINATEUR.armure.colonnes, lignes ap et am de
 * ORDINATEUR.armure.lignes) : depuis la décision R108 (« Chacune des 6 parties […] a sa propre solidité et son propre compte d'AP / AM »), la valeur de
 * l'armure portée sur la partie, ou 0 quand elle est cassée (lib/fiche-moteur.mjs#armureParPartie) : écrites par l'export, calculées et non relues par
 * l'import, où une autre valeur que celle que calcule le site part dans les notes (lib/fiche-tableur-import.mjs). Avant R108 la fiche ne les calculait
 * pas : des zones de saisie sans place sur le site (la solidité des armes a sa place depuis la décision R74 : ORDINATEUR.armes[].solidite ; celle des
 * parties de l'armure, la ligne « Sol. » de la grille, depuis la décision R95 ; l'AP et l'AM du bouclier sont calculés et sa solidité relue depuis la
 * décision R96). `modele` : le texte du modèle, qui n'est pas une valeur. `emplacement` (id de armure_emplacement) et `valeur` ('ap', 'am').
 */
export const CASES_AP_AM_DE_L_ARMURE = Object.freeze([
  ...Object.entries(ORDINATEUR.armure.colonnes).flatMap(([emplacement, colonne]) => Object.entries(ORDINATEUR.armure.lignes)
    .filter(([valeur]) => valeur !== 'solidite')
    .map(([valeur, ligne]) => ({ adresse: `${colonne}${ligne}`, emplacement, valeur, modele: '' }))),
].map(Object.freeze));

/** Modèle ordinateur : le titre de l'inventaire (AA38), où le joueur écrit son sac à la suite (« INVENTAIRE | SAC = Sac à dos ») : le site n'en a pas. */
export const TITRE_DE_L_INVENTAIRE = 'INVENTAIRE | SAC =';

/** Le plus long texte qu'une case de tableur garde (Excel : 32 767 caractères ; lib/tableur-ecriture.mjs#MAX_TEXTE coupe au-delà, fini par « … »). */
export const LONGUEUR_MAX_D_UNE_CASE = 32_767;

/** La disposition d'un onglet d'après ses libellés fixes (« AP Base » : AA21 dans le modèle ordinateur, AA20 dans la fiche auto ; « COMPÉTENCES »
 * en B21 dans les deux), ou null. `texte(adresse)` rend le texte affiché d'une case. */
export function dispositionDe(texte) {
  if (cle(texte('B21')) !== 'competences') return null;
  if (cle(texte('AA21')) === 'ap-base') return ORDINATEUR;
  if (cle(texte('AA20')) === 'ap-base') return AUTO;
  return null;
}

/** Ligne qui sépare, dans la case NOTE, les notes du joueur des informations que le modèle n'a pas de case pour écrire (relue à l'import). */
export const MARQUEUR_DES_NOTES = '——— Maverick Center : ce que le modèle n’a pas de case pour écrire ———';

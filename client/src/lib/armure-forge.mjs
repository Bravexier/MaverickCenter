// Une armure ou un bouclier forgé (pages Armures et Boucliers (/ressources/armures/, /ressources/bouclier/), demandes du propriétaire, 2026-10-15) : ce que la page
// affiche une fois choisis les deux matériaux d'une armure (ou une armure particulière) et son amélioration, ou la forme et la matière d'un bouclier et
// son amélioration.
//   - Armure : elle ne se fabrique plus pièce par pièce, seulement complète (décision R93, demande du propriétaire du 2026-10-16, qui remplace le prix
//     d'une pièce de R75) ; AP, AM, solidité, résistances et faiblesses sont ceux de l'armure de la grille ; son prix est la fabrication de l'armure
//     complète (10 RO : « ça ne remplace pas le prix en Ricken d'or ») + 6 unités de chacun de ses deux matériaux (« le prix est toujours de 6 unités
//     d'un matériau 1, et 6 d'un matériau 2 »), achetées ou fournies, calculé partout (le prix écrit dans la grille n'est plus lu : R93) ; une
//     amélioration +N coûte les niveaux +1 à +N (« il faut faire toutes les étapes une à une ») et donne l'AP, l'AM et les crans écrits au niveau N,
//     pour l'armure entière (décision R77) ; une armure particulière n'a que le prix écrit de l'armure entière et s'améliore aussi (décision R80) ; un
//     « Matériau » d'une amélioration d'armure est compté sans prix (la source ne dit pas lequel des deux matériaux de l'armure : rien n'en est déduit).
//   - Bouclier : une forme + une matière (décision R78) ; prix et défense ceux du bouclier préfabriqué, solidité celle de la matière ; une amélioration +N
//     coûte les niveaux +1 à +N, donne l'AP écrit au niveau N et les crans de tous les niveaux +1 à +N (« cumulés », décision R76) ; ses matériaux (1 aux
//     +2 et +4, R76) sont la matière du bouclier, achetée ou fournie.
//   - Armure élémentaire (décision R165) : une armure transformée par une pièce élémentaire devient l'armure de sa magie et de son poids ; AP, AM et
//     effets écrits, solidité de la pièce (« Chaque pièce élémentaire possède 4 crans », plus le cran de la ligne de son amélioration : 5 au +4 et au
//     +5), **aucun prix** (« inestimable ») ; son amélioration +N coûte les lignes +1 à +N, en gemmes de la magie (qualité écrite : commune, raffinée,
//     parfaite) et en pièce élémentaire, jamais en RO, et donne l'effet de la ligne N, sans cumul (au +5 : +10 AP/AM et +1 cran).
// Les prix de la grille, des boucliers et des formes sont des RO (décision R79).
// Module pur, sans import : seul le script de la page (src/scripts/armures.mjs) l'importe parmi les scripts de page (deux scripts de page ne partagent
// jamais un module) ; lib/armures-db.mjs (build, et service, qui le livre) en tire le prix de chaque armure de la liste (prixDeLArmure).

/** Un nombre écrit à la française : « 1 220 », « 1,5 ». */
export const nombre = (n) => {
  const [entier, decimales] = String(Math.round(n * 100) / 100).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${decimales ? `,${decimales}` : ''}`;
};

/**
 * Un montant en Ricken d'or décomposé dans les trois monnaies (décision R63 : « 1245,5 » s'affiche « 1 [PP] 245 [RO] 50 [RF] ») : [{ nombre, abr }] de la
 * plus grande à la plus petite, sans les zéros ([{ nombre: 0, abr: 'RO' }] pour 0). Même calcul que lib/monnaies.mjs#montantDecompose (que ce module ne
 * peut pas importer : test/armure-forge.test.mjs les compare).
 */
export function piecesDuMontant(ro) {
  let reste = Math.round(ro * 100);
  if (!reste) return [{ nombre: 0, abr: 'RO' }];
  const sortie = [];
  for (const [abr, valeur] of [['PP', 100000], ['RO', 100], ['RF', 1]]) {
    const n = Math.floor(reste / valeur);
    reste -= n * valeur;
    if (n) sortie.push({ nombre: n, abr });
  }
  return sortie;
}

/** Un montant arrondi au Ricken de fer (0,01 RO). */
const arrondi = (n) => Math.round(n * 100) / 100;

/** Unités de chacun des deux matériaux d'une armure complète (décision R93 : « le prix est toujours de 6 unités d'un matériau 1, et 6 d'un matériau 2 »). */
export const UNITES_PAR_MATERIAU = 6;

/**
 * Le prix d'une armure de la grille (décision R93) : la fabrication de l'armure complète (ligne « Armure Complète » du tableau FABRICATION, 10 RO) +
 * 6 unités de chacun de ses deux matériaux, à leur prix (celui de la page Composants : R62), en RO.
 * @param {number | null} fabrication  en RO
 * @param {(number | null)[]} prix  les prix en RO du matériau 1 et du matériau 2 (le même deux fois pour une armure d'un seul matériau)
 * @returns {{ fabrication: number | null, materiaux: number | null, achetes: number | null, fournis: number | null }}  les RO des 12 unités, le prix
 *   matériaux achetés (null si un prix manque), le prix matériaux fournis (la fabrication seule)
 */
export function prixDeLArmure(fabrication, prix) {
  const f = fabrication ?? null;
  const materiaux = prix.every((p) => p !== null && p !== undefined) ? arrondi(prix.reduce((s, p) => s + UNITES_PAR_MATERIAU * p, 0)) : null;
  return { fabrication: f, materiaux, achetes: f === null || materiaux === null ? null : arrondi(f + materiaux), fournis: f };
}

/** Les niveaux faits pour une amélioration +N : les niveaux +1 à +N. */
const niveauxFaits = (ameliorations, niveau) => ameliorations.filter((a) => a.niveau >= 1 && a.niveau <= niveau);

/**
 * Une amélioration +N d'armure (décision R77) : coût des niveaux +1 à +N (RO et matériaux), AP, AM et crans écrits au niveau N.
 * `ameliorations` : [{ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }] ; `niveau` : 0 (aucune) à 5.
 */
export function ameliorationDArmure(ameliorations, niveau) {
  const faits = niveauxFaits(ameliorations, niveau);
  const dernier = ameliorations.find((a) => a.niveau === niveau);
  return {
    niveau,
    ro: faits.reduce((s, a) => s + (a.cout_ro ?? 0), 0),
    materiaux: faits.reduce((s, a) => s + (a.cout_materiaux ?? 0), 0),
    bonus_ap: dernier?.bonus_ap ?? 0,
    bonus_am: dernier?.bonus_am ?? 0,
    bonus_cran: dernier?.bonus_cran ?? 0,
  };
}

/**
 * Une amélioration +N de bouclier (décision R76) : coût des niveaux +1 à +N (RO et matériaux), AP (et AM, si une ligne en écrit) du niveau N, crans de
 * tous les niveaux +1 à +N.
 */
export function ameliorationDeBouclier(ameliorations, niveau) {
  const faits = niveauxFaits(ameliorations, niveau);
  const dernier = ameliorations.find((a) => a.niveau === niveau);
  return {
    niveau,
    ro: faits.reduce((s, a) => s + (a.cout_ro ?? 0), 0),
    materiaux: faits.reduce((s, a) => s + (a.cout_materiaux ?? 0), 0),
    bonus_ap: dernier?.bonus_ap ?? 0,
    bonus_am: dernier?.bonus_am ?? 0,
    bonus_cran: faits.reduce((s, a) => s + (a.bonus_cran ?? 0), 0),
  };
}

/**
 * L'armure forgée : toujours l'armure complète (décision R93).
 * @param {{ ap: number | null, am: number | null, solidite: number, prix: number | null }} armure  la ligne de la grille (ou une armure particulière ;
 *   `prix` : son prix écrit, lu pour une armure particulière seulement)
 * @param {{ niveau: number, cout_ro: number | null, cout_materiaux: number | null, bonus_ap: number | null, bonus_am: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune)
 * @param {{ fabrication: number | null, materiaux: { nom: string, prix_ro: number | null }[] } | null} composition  pour une armure de la grille : la
 *   fabrication de l'armure complète (RO) et ses deux matériaux (prixDeLArmure) ; null pour une armure particulière (son prix écrit : R80)
 */
export function forgerArmure(armure, ameliorations, niveau = 0, composition = null) {
  const amelioration = ameliorationDArmure(ameliorations, niveau);
  const ap = { armure: armure.ap ?? 0, amelioration: amelioration.bonus_ap };
  ap.total = ap.armure + ap.amelioration;
  const am = { armure: armure.am ?? 0, amelioration: amelioration.bonus_am };
  am.total = am.armure + am.amelioration;
  const solidite = { armure: armure.solidite ?? 0, amelioration: amelioration.bonus_cran };
  solidite.total = solidite.armure + solidite.amelioration;
  let base = { prix: armure.prix ?? null, fabrication: null, materiaux: [], fournis: null };
  if (composition) {
    const p = prixDeLArmure(composition.fabrication, composition.materiaux.map((m) => m.prix_ro ?? null));
    // les unités de chaque matériau ; une armure d'un seul matériau (« Armure de Cuir complète ») : 12 unités de ce matériau
    const materiaux = [];
    for (const m of composition.materiaux) {
      const deja = materiaux.find((x) => x.nom === m.nom);
      if (deja) deja.unites += UNITES_PAR_MATERIAU;
      else materiaux.push({ nom: m.nom, prix_ro: m.prix_ro ?? null, unites: UNITES_PAR_MATERIAU });
    }
    for (const m of materiaux) m.total = m.prix_ro === null ? null : arrondi(m.unites * m.prix_ro);
    base = { prix: p.achetes, fabrication: p.fabrication, materiaux, fournis: p.fournis };
  }
  return {
    ap,
    am,
    solidite,
    amelioration,
    cout: {
      // le prix de l'armure : matériaux achetés (R93) ou prix écrit d'une armure particulière (R80)
      prix: base.prix,
      fabrication: base.fabrication,
      materiaux: base.materiaux,
      amelioration: amelioration.ro,
      materiaux_amelioration: amelioration.materiaux,
      // sans les matériaux de l'amélioration (comptés à part, sans prix : la source ne dit pas lequel des deux matériaux)
      total: base.prix === null ? null : arrondi(base.prix + amelioration.ro),
      // les matériaux de l'armure fournis : la fabrication et l'amélioration (armure de la grille seulement)
      total_fournis: base.fournis === null ? null : arrondi(base.fournis + amelioration.ro),
    },
  };
}

/**
 * Le bouclier forgé (décision R78 : une forme + une matière).
 * @param {{ ap: number | null, am: number | null, prix: number | null }} bouclier  le bouclier préfabriqué (prix et défense écrits)
 * @param {{ nom: string, solidite: number, prix_ro: number | null }} matiere  la matière (fiche des matières pour boucliers ; prix de la ressource, R62)
 * @param {{ niveau: number, cout_ro: number | null, cout_materiaux: number | null, bonus_ap: number | null, bonus_am: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune)
 */
export function forgerBouclier(bouclier, matiere, ameliorations, niveau = 0) {
  const amelioration = ameliorationDeBouclier(ameliorations, niveau);
  const ap = { bouclier: bouclier.ap ?? 0, amelioration: amelioration.bonus_ap };
  ap.total = ap.bouclier + ap.amelioration;
  const am = { bouclier: bouclier.am ?? 0, amelioration: amelioration.bonus_am };
  am.total = am.bouclier + am.amelioration;
  const solidite = { matiere: matiere?.solidite ?? 0, amelioration: amelioration.bonus_cran };
  solidite.total = solidite.matiere + solidite.amelioration;
  const prixMatiere = matiere?.prix_ro ?? null;
  const fournis = bouclier.prix === null || bouclier.prix === undefined ? null : bouclier.prix + amelioration.ro;
  return {
    ap,
    am,
    solidite,
    amelioration,
    cout: {
      bouclier: bouclier.prix ?? null,
      amelioration: amelioration.ro,
      materiaux: amelioration.materiaux,
      prix_matiere: prixMatiere,
      // les matériaux de l'amélioration fournis, ou achetés (la matière du bouclier : R76)
      ro_materiaux_fournis: fournis,
      ro_total: fournis === null || (amelioration.materiaux && prixMatiere === null) ? null : fournis + amelioration.materiaux * (prixMatiere ?? 0),
    },
  };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Armures élémentaires (décision R165 (2), (3)) : le tableau « Armure » de l'onglet « Pièces élémentaires » (amelioration_equipement, cible
// 'armure_elementaire' : +1 « 2 gemmes communes », +2 « 2 gemmes raffinées », +3 « 2 gemmes parfaites », +4 « 3 gemmes parfaites », +5 « 1 pièce
// élémentaire ») ; « Chaque cout est cumulatif […] L'effet lui est celui de la ligne. Les gemmes à consommer sont les gemmes de la magie concernée. »
// ------------------------------------------------------------------------------------------------------------------------------------------------

/** Les qualités de gemme qu'écrit la source (amelioration_equipement.cout_gemmes_qualite) : [singulier, pluriel], dans l'ordre du tableau. */
export const QUALITES_DES_GEMMES = Object.freeze({ commune: ['commune', 'communes'], raffinee: ['raffinée', 'raffinées'], parfaite: ['parfaite', 'parfaites'] });

/**
 * Une amélioration +N d'armure élémentaire (décision R165 (2)) : le coût cumulé des lignes +1 à +N — `gemmes` : [{ qualite, nombre }] par qualité, dans
 * l'ordre où le tableau les demande ; `pieces_elementaires` : leur somme — et l'effet de la ligne N seule (`bonus_ap`, `bonus_am`, `bonus_cran`), sans cumul.
 * `ameliorations` : [{ niveau, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, bonus_ap, bonus_am, bonus_cran }] ; `niveau` : 0 (aucune) à 5.
 */
export function ameliorationElementaire(ameliorations, niveau) {
  const faits = niveauxFaits(ameliorations, niveau);
  const dernier = ameliorations.find((a) => a.niveau === niveau);
  const gemmes = [];
  for (const a of faits) {
    if (!a.cout_gemmes) continue;
    const qualite = a.cout_gemmes_qualite ?? null;
    const deja = gemmes.find((g) => g.qualite === qualite);
    if (deja) deja.nombre += a.cout_gemmes;
    else gemmes.push({ qualite, nombre: a.cout_gemmes });
  }
  return {
    niveau,
    gemmes,
    pieces_elementaires: faits.reduce((s, a) => s + (a.cout_pieces_elementaires ?? 0), 0),
    bonus_ap: dernier?.bonus_ap ?? 0,
    bonus_am: dernier?.bonus_am ?? 0,
    bonus_cran: dernier?.bonus_cran ?? 0,
  };
}

/** « de Rubis », « d’Ambre », « d’Émeraude » : le complément du nom d'une gemme (table gemme). */
export const deLaGemme = (nom) => (/^[aeiouyàâäéèêëîïôöûü]/i.test(String(nom)) ? `d’${nom}` : `de ${nom}`);

/**
 * Un coût d'armure élémentaire écrit, une part par qualité de gemme puis la pièce élémentaire, comme la source (« 2 gemmes communes », « 1 pièce
 * élémentaire »), chaque gemme nommée par celle de la magie quand elle est donnée (« 2 gemmes communes de Rubis ») : [texte]. Jamais de RO.
 * @param {{ gemmes: { qualite: string | null, nombre: number }[], pieces_elementaires: number }} cout  ameliorationElementaire, ou une ligne
 * @param {string | null} gemme  le nom de la gemme de la magie (table gemme), ou null
 */
export function coutElementaireEcrit(cout, gemme = null) {
  const parts = cout.gemmes.filter((g) => g.nombre > 0).map((g) => {
    const qualite = QUALITES_DES_GEMMES[g.qualite]?.[g.nombre > 1 ? 1 : 0];
    return `${g.nombre} ${g.nombre > 1 ? 'gemmes' : 'gemme'}${qualite ? ` ${qualite}` : ''}${gemme ? ` ${deLaGemme(gemme)}` : ''}`;
  });
  const p = cout.pieces_elementaires ?? 0;
  if (p > 0) parts.push(`${p} ${p > 1 ? 'pièces élémentaires' : 'pièce élémentaire'}`);
  return parts;
}

/** Le coût d'une seule ligne du tableau élémentaire, sous la forme de ameliorationElementaire (pour coutElementaireEcrit). */
export const coutDeLaLigneElementaire = (a) => ({
  gemmes: a?.cout_gemmes ? [{ qualite: a.cout_gemmes_qualite ?? null, nombre: a.cout_gemmes }] : [],
  pieces_elementaires: a?.cout_pieces_elementaires ?? 0,
});

/**
 * L'armure élémentaire forgée (décision R165) : AP et AM écrits plus ceux de la ligne de son amélioration ; solidité = `soliditeBase` (constante
 * 'piece_elementaire.solidite_base', 4) + le cran de la ligne (5 au +4 et au +5) ; coût : celui de l'amélioration seulement, en gemmes et en pièce
 * élémentaire (`prix` toujours null : « inestimable »).
 * @param {{ ap: number | null, am: number | null }} armure
 * @param {{ niveau: number, cout_gemmes: number | null, cout_gemmes_qualite: string | null, cout_pieces_elementaires: number | null, bonus_ap: number | null, bonus_am: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune)
 * @param {number} soliditeBase
 */
export function forgerArmureElementaire(armure, ameliorations, niveau = 0, soliditeBase = 0) {
  const amelioration = ameliorationElementaire(ameliorations, niveau);
  const ap = { armure: armure.ap ?? 0, amelioration: amelioration.bonus_ap };
  ap.total = ap.armure + ap.amelioration;
  const am = { armure: armure.am ?? 0, amelioration: amelioration.bonus_am };
  am.total = am.armure + am.amelioration;
  const solidite = { base: soliditeBase ?? 0, amelioration: amelioration.bonus_cran };
  solidite.total = solidite.base + solidite.amelioration;
  return { ap, am, solidite, amelioration, cout: { prix: null, gemmes: amelioration.gemmes, pieces_elementaires: amelioration.pieces_elementaires } };
}

/** Vrai quand l'élément et le poids d'une armure élémentaire sont choisis tous les deux (décision R165 (4)). */
export const estElementaire = (etat) => Boolean(etat?.element && etat?.poids);

/**
 * Le choix d'armure de la page après un clic (décision R165 (4)) — l'état : { m1, m2, particuliere, element, poids } (des valeurs comparées par
 * identité : les lignes et les boutons de la page, ou des clés) ; le reste de l'état est gardé tel quel :
 *   - { genre: 'element' | 'poids', valeur } : choisit (ou retire, s'il l'était) l'élément ou le poids ; les deux choisis, les matériaux et l'armure
 *     particulière se désélectionnent (« on désélectionne les matériaux et affiche l'armure correspondante ») ;
 *   - { genre: 'm1' | 'm2', valeur } : choisit (ou retire) un matériau ; choisir de nouveau un matériau vide le choix élément/poids ;
 *   - { genre: 'particuliere', valeur } ou { genre: 'armure', m1, m2 } : une armure de la liste, qui vide aussi le choix élément/poids ;
 *   - { genre: 'fermer' } : plus rien de choisi.
 * Rend un nouvel état (l'ancien n'est pas modifié).
 */
export function choixDArmureApres(etat, choix) {
  const e = { ...etat };
  const sansElementaire = { element: null, poids: null };
  switch (choix?.genre) {
    case 'element':
    case 'poids':
      e[choix.genre] = e[choix.genre] === choix.valeur ? null : choix.valeur ?? null;
      if (estElementaire(e)) Object.assign(e, { m1: null, m2: null, particuliere: null });
      break;
    case 'm1':
    case 'm2':
      Object.assign(e, { particuliere: null }, sansElementaire);
      e[choix.genre] = e[choix.genre] === choix.valeur ? null : choix.valeur ?? null;
      break;
    case 'particuliere':
      Object.assign(e, { particuliere: choix.valeur ?? null, m1: null, m2: null }, sansElementaire);
      break;
    case 'armure':
      Object.assign(e, { particuliere: null, m1: choix.m1 ?? null, m2: choix.m2 ?? null }, sansElementaire);
      break;
    case 'fermer':
      Object.assign(e, { m1: null, m2: null, particuliere: null }, sansElementaire);
      break;
    default:
      break;
  }
  return e;
}

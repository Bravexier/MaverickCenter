// Une armure ou un bouclier forgé (onglets Armures et Boucliers de /ressources/equipement/, demandes du propriétaire, 2026-10-15) : ce que la page
// affiche une fois choisis les deux matériaux d'une armure (ou une armure particulière), sa pièce et son amélioration, ou la forme et la matière d'un
// bouclier et son amélioration.
//   - Armure : AP, AM, solidité, résistances et faiblesses sont ceux de l'armure de la grille, quelle que soit la pièce (la source n'en donne pas par
//     pièce) ; l'armure complète coûte le prix écrit dans la grille, une pièce son coût de fabrication + 1 unité de chaque matériau, achetés ou fournis
//     (décision R75) ; une amélioration +N coûte les niveaux +1 à +N (« il faut faire toutes les étapes une à une ») et donne l'AP, l'AM et les crans
//     écrits au niveau N ; elle vaut pour l'armure entière seulement, pas pour une pièce (décision R77) ; une armure particulière n'a que le prix de
//     l'armure entière et s'améliore aussi (décision R80) ; un « Matériau » d'une amélioration d'armure est compté sans prix (la source ne dit pas lequel
//     des deux matériaux de l'armure : rien n'en est déduit).
//   - Bouclier : une forme + une matière (décision R78) ; prix et défense ceux du bouclier préfabriqué, solidité celle de la matière ; une amélioration +N
//     coûte les niveaux +1 à +N, donne l'AP écrit au niveau N et les crans de tous les niveaux +1 à +N (« cumulés », décision R76) ; ses matériaux (1 aux
//     +2 et +4, R76) sont la matière du bouclier, achetée ou fournie.
// Les prix de la grille, des boucliers et des formes sont des RO (décision R79).
// Module pur, sans import : seul le script de la page (src/scripts/armures.mjs) l'importe (deux scripts de page ne partagent jamais un module).

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
 * L'armure forgée.
 * @param {{ ap: number | null, am: number | null, solidite: number, prix: number | null }} armure  la ligne de la grille (ou une armure particulière)
 * @param {{ complete: boolean, cout_ro: number | null } | null} piece  la pièce (tableau FABRICATION) ; null ou `complete` : l'armure complète (une
 *   pièce ne prend pas d'amélioration : décision R77 ; une armure particulière n'a pas de pièce : R80)
 * @param {{ nom: string, prix_ro: number | null }[]} materiaux  les deux matériaux d'une combinaison ; [] pour une armure particulière
 * @param {{ niveau: number, cout_ro: number | null, cout_materiaux: number | null, bonus_ap: number | null, bonus_am: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune ; sans effet sur une pièce)
 */
export function forgerArmure(armure, piece, materiaux, ameliorations, niveau = 0) {
  // une pièce (décision R75) : son coût de fabrication + 1 unité de chaque matériau ; l'armure complète (ou une armure particulière, R80) : son prix écrit
  const enPieces = Boolean(piece && !piece.complete && materiaux.length);
  // le tableau d'amélioration vaut pour l'armure entière seulement (décision R77)
  const amelioration = ameliorationDArmure(ameliorations, enPieces ? 0 : niveau);
  const ap = { armure: armure.ap ?? 0, amelioration: amelioration.bonus_ap };
  ap.total = ap.armure + ap.amelioration;
  const am = { armure: armure.am ?? 0, amelioration: amelioration.bonus_am };
  am.total = am.armure + am.amelioration;
  const solidite = { armure: armure.solidite ?? 0, amelioration: amelioration.bonus_cran };
  solidite.total = solidite.armure + solidite.amelioration;
  const prixDesMateriaux = materiaux.map((m) => m.prix_ro ?? null);
  const materiauxConnus = prixDesMateriaux.every((p) => p !== null);
  let base;
  if (enPieces) {
    const fabrication = piece.cout_ro ?? null;
    base = {
      piece: true,
      fabrication,
      materiaux: materiaux.length,
      ro_materiaux_fournis: fabrication,
      ro_materiaux_achetes: fabrication === null || !materiauxConnus ? null : fabrication + prixDesMateriaux.reduce((s, p) => s + p, 0),
    };
  } else {
    base = { piece: false, prix: armure.prix ?? null };
  }
  const prixDeBase = enPieces ? base.ro_materiaux_achetes : base.prix;
  return {
    ap,
    am,
    solidite,
    amelioration,
    amelioration_possible: !enPieces,
    cout: {
      ...base,
      amelioration: amelioration.ro,
      materiaux_amelioration: amelioration.materiaux,
      // sans les matériaux de l'amélioration (comptés à part, sans prix : la source ne dit pas lequel des deux matériaux)
      total: prixDeBase === null ? null : prixDeBase + amelioration.ro,
      total_fournis: enPieces && base.fabrication !== null ? base.fabrication + amelioration.ro : null,
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

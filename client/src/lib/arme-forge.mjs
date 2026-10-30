// Une arme forgée (page Armes (/ressources/armes/), demande du propriétaire) : l'arme, son matériau et son amélioration ajustent ses dégâts, sa solidité et
// son coût. Règles de la page « Armes » : « tous les bonus se cumulent une fois l'arme forgée (exemple : une claymore en cuivre donne un bonus aux dégâts
// de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5) » ; « 1 Matériau + Le coût de l'arme + Particularité de l'arme = PRIX FINAL » ;
// le prix d'un matériau est celui en RO (« Ignore le prix en RF, il n'est plus d'actualité »). Une amélioration +N demande les coûts des niveaux 1 à N
// (exemple du propriétaire : « Un +5 demande 20 + 1 Mat + 50 + 100 + 1 mat + 150 + 200 ») et donne l'effet écrit au niveau N (+10 dégâts au +5).
// Exemple du propriétaire (test/arme-forge.test.mjs) : Espadon (100 RO, +10 dégâts) en titane (200 RO, +9) amélioré +5 → D10+29 ; 620 RO et 3 titanes
// (le matériau de l'arme et ceux des niveaux 2 et 4), ou 1 220 RO en achetant les titanes.
// Une arme élémentaire (décision R167) se forge à part (forgerArmeElementaire) : ni matériau ni prix en RO ; dé du type + son bonus (+8) + l'effet de la
// ligne d'amélioration, solidité de base (4) + les crans de la ligne, coût en gemmes de sa magie cumulé du +1 au +N.
// Module pur, sans import : seul le script de la page (src/scripts/armes.mjs) l'importe (deux scripts de page ne partagent jamais un module).

/** Solidité minimale d'une arme, en crans (décision R51). */
export const DURABILITE_MIN = 1;

/** Un nombre écrit à la française : « 1 220 ». */
export const nombre = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Un montant en Ricken d'or décomposé dans les trois monnaies (demande du propriétaire : « 1245,5 » s'affiche « 1 [PP] 245 [RO] 50 [RF] ») :
 * [{ nombre, abr }] de la plus grande à la plus petite, sans les zéros ([{ nombre: 0, abr: 'RO' }] pour 0). Même calcul que
 * lib/monnaies.mjs#montantDecompose (que ce module ne peut pas importer : test/arme-forge.test.mjs les compare), valeurs de la table monnaie.
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

/** « D10+29 », « D10−2 », « D8 » : le dé de l'arme et la somme de ses bonus (le nombre de dés dépend de la maîtrise du personnage). */
export function notationDesDegats(de, bonus) {
  if (!bonus) return de;
  return `${de}${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}`;
}

/**
 * Coût cumulé d'une amélioration +N : la somme des RO et des matériaux des niveaux 1 à N, et l'effet du niveau N (bonus de dégâts, crans de solidité).
 * `ameliorations` : [{ niveau, cout_ro, cout_materiaux, bonus_degats, bonus_cran }] ; `niveau` : 0 (aucune) à 10.
 */
export function ameliorationCumulee(ameliorations, niveau) {
  const faits = ameliorations.filter((a) => a.niveau <= niveau);
  const dernier = ameliorations.find((a) => a.niveau === niveau);
  return {
    niveau,
    ro: faits.reduce((s, a) => s + (a.cout_ro ?? 0), 0),
    materiaux: faits.reduce((s, a) => s + (a.cout_materiaux ?? 0), 0),
    bonus_degats: dernier?.bonus_degats ?? 0,
    bonus_cran: dernier?.bonus_cran ?? 0,
  };
}

/**
 * L'arme forgée.
 * @param {{ de: string, bonus_degats: number | null, durabilite: number, cout_ro: number | null }} arme  `de` : « D10 » (ou « D6/D8/D10 » selon la Force)
 * @param {{ nom: string, bonus_degats: number | null, cran_solidite: number | null, prix_ro: number | null } | null} materiau
 * @param {{ niveau: number, cout_ro: number | null, cout_materiaux: number | null, bonus_degats: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune)
 */
export function forgerArme(arme, materiau, ameliorations, niveau = 0) {
  const amelioration = ameliorationCumulee(ameliorations, niveau);
  const bonus = { arme: arme.bonus_degats ?? 0, materiau: materiau?.bonus_degats ?? 0, amelioration: amelioration.bonus_degats };
  bonus.total = bonus.arme + bonus.materiau + bonus.amelioration;
  // les crans se cumulent, sans descendre sous 1 (décision R51 : « il faut les cumuler mais il est impossible de descendre à moins de 1 »)
  const durabilite = { arme: arme.durabilite, materiau: materiau?.cran_solidite ?? 0, amelioration: amelioration.bonus_cran };
  durabilite.total = Math.max(DURABILITE_MIN, durabilite.arme + durabilite.materiau + durabilite.amelioration);
  // un matériau pour forger l'arme, plus ceux des niveaux d'amélioration ; payés en RO ou fournis
  const materiaux = materiau ? 1 + amelioration.materiaux : 0;
  const prixMateriau = materiau?.prix_ro ?? null;
  const roSansMateriaux = (arme.cout_ro ?? 0) + amelioration.ro;
  return {
    de: arme.de,
    degats: notationDesDegats(arme.de, bonus.total),
    bonus,
    durabilite,
    amelioration,
    cout: {
      arme: arme.cout_ro,
      amelioration: amelioration.ro,
      materiaux,
      prix_materiau: prixMateriau,
      ro_materiaux_fournis: roSansMateriaux,
      ro_total: prixMateriau === null ? null : roSansMateriaux + materiaux * prixMateriau,
    },
  };
}

// ------------------------------------------------------------------------------------------------------------------------------- armes élémentaires

/** Les qualités des gemmes d'un coût élémentaire, dans l'ordre du tableau (amelioration_equipement.cout_gemmes_qualite ; lib/armes-db.mjs#QUALITES_DES_GEMMES). */
export const QUALITES_DES_GEMMES = Object.freeze(['commune', 'raffinee', 'parfaite']);

/** Le nom d'une qualité de gemme, accordé au nombre (« 1 commune », « 3 raffinées »). */
const NOMS_DES_QUALITES = { commune: ['commune', 'communes'], raffinee: ['raffinée', 'raffinées'], parfaite: ['parfaite', 'parfaites'] };

/**
 * Coût élémentaire cumulé d'une amélioration +N (décision R167 : « le coût est cumulatif (du 0 au +2 : 1 + 2 = 3 gemmes communes), l'effet est celui de
 * la ligne ») : les gemmes des niveaux 1 à N par qualité, les pièces élémentaires, et l'effet du niveau N. Même cumul que
 * lib/armes-db.mjs#coutsElementairesCumules (que ce module ne peut pas importer : test/arme-forge.test.mjs les compare).
 * `ameliorations` : [{ niveau, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, bonus_degats, bonus_cran }] ; `niveau` : 0 (aucune) à 10.
 */
export function coutElementaireCumule(ameliorations, niveau) {
  const gemmes = Object.fromEntries(QUALITES_DES_GEMMES.map((q) => [q, 0]));
  let pieces = 0;
  for (const a of ameliorations.filter((x) => x.niveau <= niveau)) {
    if (a.cout_gemmes_qualite in gemmes) gemmes[a.cout_gemmes_qualite] += a.cout_gemmes ?? 0;
    pieces += a.cout_pieces_elementaires ?? 0;
  }
  const dernier = ameliorations.find((a) => a.niveau === niveau);
  return { niveau, gemmes, pieces_elementaires: pieces, bonus_degats: dernier?.bonus_degats ?? 0, bonus_cran: dernier?.bonus_cran ?? 0 };
}

/**
 * Le coût élémentaire en mots : « 6 communes + 3 raffinées de Grenat », « 6 communes + 6 raffinées + 6 parfaites de Grenat + 1 pièce élémentaire » ;
 * « » sans rien à payer. `gemme` : le nom de la gemme de la magie (« Grenat ») ; sans lui : « 6 gemmes communes + 3 gemmes raffinées ».
 */
export function texteDuCoutElementaire(cout, gemme) {
  const qualites = QUALITES_DES_GEMMES.filter((q) => cout.gemmes[q] > 0)
    .map((q) => `${cout.gemmes[q]} ${gemme ? '' : `gemme${cout.gemmes[q] > 1 ? 's' : ''} `}${NOMS_DES_QUALITES[q][cout.gemmes[q] > 1 ? 1 : 0]}`);
  const parties = [];
  if (qualites.length) parties.push(`${qualites.join(' + ')}${gemme ? ` de ${gemme}` : ''}`);
  if (cout.pieces_elementaires) parties.push(`${cout.pieces_elementaires} pièce${cout.pieces_elementaires > 1 ? 's' : ''} élémentaire${cout.pieces_elementaires > 1 ? 's' : ''}`);
  return parties.join(' + ');
}

/**
 * L'arme élémentaire forgée (décision R167) : « Dégâts : dé du type + 8 + l'effet de la ligne d'amélioration » (Arc de Sang +5 : D8+18) ; « Solidité : 4
 * crans + les crans de la ligne d'amélioration choisie » (5 au +5, 6 au +10 : ceux de la ligne, pas leur somme) ; ni matériau (R49 ne s'applique pas) ni
 * prix en RO : le coût en gemmes de sa magie, cumulé du +1 au +N.
 * @param {{ de: string, bonus_degats: number | null, solidite: number }} arme  `de` : celui du type (« D8 », ou « D6/D8/D10 » selon la Force) ;
 *   `bonus_degats` : celui de l'arme élémentaire (« +8 Dégâts ») ; `solidite` : la solidité de base d'une arme élémentaire (4)
 * @param {{ niveau: number, cout_gemmes: number | null, cout_gemmes_qualite: string | null, cout_pieces_elementaires: number | null, bonus_degats: number | null, bonus_cran: number | null }[]} ameliorations
 * @param {number} niveau amélioration choisie (0 : aucune)
 */
export function forgerArmeElementaire(arme, ameliorations, niveau = 0) {
  const amelioration = coutElementaireCumule(ameliorations, niveau);
  const bonus = { arme: arme.bonus_degats ?? 0, amelioration: amelioration.bonus_degats };
  bonus.total = bonus.arme + bonus.amelioration;
  const durabilite = { arme: arme.solidite, amelioration: amelioration.bonus_cran };
  durabilite.total = Math.max(DURABILITE_MIN, durabilite.arme + durabilite.amelioration);
  return {
    de: arme.de,
    degats: notationDesDegats(arme.de, bonus.total),
    bonus,
    durabilite,
    amelioration,
    cout: { gemmes: amelioration.gemmes, pieces_elementaires: amelioration.pieces_elementaires },
  };
}

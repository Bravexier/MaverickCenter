// Une arme forgée (page /ressources/armes/, demande du propriétaire) : l'arme, son matériau et son amélioration ajustent ses dégâts, sa durabilité et
// son coût. Règles de la page « Armes » : « tous les bonus se cumulent une fois l'arme forgée (exemple : une claymore en cuivre donne un bonus aux dégâts
// de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5) » ; « 1 Matériau + Le coût de l'arme + Particularité de l'arme = PRIX FINAL » ;
// le prix d'un matériau est celui en RO (« Ignore le prix en RF, il n'est plus d'actualité »). Une amélioration +N demande les coûts des niveaux 1 à N
// (exemple du propriétaire : « Un +5 demande 20 + 1 Mat + 50 + 100 + 1 mat + 150 + 200 ») et donne l'effet écrit au niveau N (+10 dégâts au +5).
// Exemple du propriétaire (test/arme-forge.test.mjs) : Espadon (100 RO, +10 dégâts) en titane (200 RO, +9) amélioré +5 → D10+29 ; 620 RO et 3 titanes
// (le matériau de l'arme et ceux des niveaux 2 et 4), ou 1 220 RO en achetant les titanes.
// Module pur, sans import : seul le script de la page (src/scripts/armes.mjs) l'importe (deux scripts de page ne partagent jamais un module).

/** Durabilité minimale d'une arme, en crans (décision R51). */
export const DURABILITE_MIN = 1;

/** Un nombre écrit à la française : « 1 220 ». */
export const nombre = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

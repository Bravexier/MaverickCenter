// Ce que l'effet d'un accessoire change sur la fiche de personnage (demande du propriétaire, 2026-10-14 : « Dans la fiche de personnage, l'accessoire
// influe sur le reste de la fiche […] Il convient donc de créer une table adaptée, à l'instar des armes ») : comme lib/arme-champs.mjs pour les armes, le
// découpage de l'effet écrit (accessoire_effet.libelle) en lignes typées, la table accessoire_effet_cible, et son usage (accessoire_effet.usage). La
// migration 0037 en a écrit les lignes ; test/accessoire-champs.test.mjs rejoue ce découpage sur toute la base. Pur, sans dépendance.
//
// Rien n'est déduit au-delà de ce que l'effet écrit et des décisions du propriétaire (docs/decisions-regles.md, R54) :
//   - Caractéristique (« Force », « Agilité »…) : +1 à cette caractéristique (R54 ; l'exemple des règles : « +1 force devient -1 force ») ;
//   - Compétence (« Compétence F », 1 % à 5 %…) : la valeur tirée (personnage_accessoire.valeur) en Acquis d'UNE compétence de cette caractéristique,
//     choisie dans la fiche (R54) : `choix` ;
//   - Attributs : « +N Santé / Barrière / Chakra / Initiative / Vitesse » (colonnes bonus_valeur, bonus_cible) ; « Augmente le maximum de sang ou d'âme de
//     N » : la 4ᵉ barre ;
//   - « Dégâts physiques +N » (toutes les armes) et « Dégâts magie +N » (les sorts d'attaque, R54) ; « +N dégâts avec une catégorie d'arme » : une famille
//     d'armes choisie dans la fiche (`choix`) ; « Augmente la portée des armes à distance / des sorts de +N » ; « Un point de maîtrise d'arme » : sur
//     une famille choisie dans la fiche (`choix` ; décision R151, migration 0076 : « (ne peut changer une fois décidé) » n'est qu'un rappel) ;
//     « +N tour de Mode Hyper » ; « Les AM / AP de base augmentent de N » ;
//   - « Résistance X et Y » : un cran de résistance à chaque magie ou altération d'état nommée ;
//   - « Augmente le dé de dégâts des sorts » (un cran, comme la posture Focus), « Permet à un dé de dégâts d'être maximum » (réponse du propriétaire
//     « Oui, un dé au max »), « Augmente de 1d les soins magiques » (R102, migration 0061).
// Usage (R54 : « (Action) + usages limités » ; listés parmi les actions de la fiche, décision R173) : `action` pour un effet écrit « (Action) … », `limite` pour un usage compté
// (« 1 fois par combat », « l'objet se brise », « recharge »…).

/** Les cibles de la table accessoire_effet_cible. */
export const CIBLES = [
  'caracteristique', 'competence', 'sante', 'chakra', 'barriere', 'initiative', 'vitesse', 'barre4_max', 'armure_ap', 'armure_am',
  'degats_physiques', 'degats_magie', 'degats_famille', 'portee_distance', 'portee_sorts', 'maitrise_arme', 'mode_hyper_tours', 'resistance',
  'cran_des_sorts', 'de_maximum', 'des_soins',
];

/** bonus_cible de la propriété « Attributs » → cible. */
const ATTRIBUTS = { Santé: 'sante', Chakra: 'chakra', Barrière: 'barriere', Initiative: 'initiative', Vitesse: 'vitesse' };

const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’`]/g, "'").trim();

/** Ce qu'une phrase écrit, en motifs : [motif, (m) => [{ cible, valeur, choix }]]. */
const MOTIFS = [
  [/^degats physiques \+(\d+)$/, (m) => [{ cible: 'degats_physiques', valeur: Number(m[1]) }]],
  [/^degats magie \+(\d+)$/, (m) => [{ cible: 'degats_magie', valeur: Number(m[1]) }]],
  [/^\+(\d+) degats avec une categorie d'arme\b/, (m) => [{ cible: 'degats_famille', valeur: Number(m[1]), choix: 1 }]],
  [/^augmente la portee des armes a distance de \+(\d+)$/, (m) => [{ cible: 'portee_distance', valeur: Number(m[1]) }]],
  [/^augmente la portee des sorts de \+(\d+)$/, (m) => [{ cible: 'portee_sorts', valeur: Number(m[1]) }]],
  [/^un point de maitrise d'arme\b/, () => [{ cible: 'maitrise_arme', valeur: 1, choix: 1 }]],
  [/^\+(\d+) tours? de mode hyper\b/, (m) => [{ cible: 'mode_hyper_tours', valeur: Number(m[1]) }]],
  [/^les (am|ap) de base augmentent de (\d+)$/, (m) => [{ cible: `armure_${m[1]}`, valeur: Number(m[2]) }]],
  [/^augmente le maximum de sang ou d'ame de (\d+)$/, (m) => [{ cible: 'barre4_max', valeur: Number(m[1]) }]],
  // décision R102 (migration 0061) : le dé des sorts d'un cran (comme la posture Focus), un dé de dégâts au maximum (armes et sorts), un dé de plus aux soins
  [/^augmente le de de degats des sorts$/, () => [{ cible: 'cran_des_sorts', valeur: 1 }]],
  [/^permet a un de de degats d'etre maximum$/, () => [{ cible: 'de_maximum', valeur: 1 }]],
  [/^augmente de 1d les soins magiques$/, () => [{ cible: 'des_soins', valeur: 1 }]],
];

/** L'usage d'un effet : « (Action) … » ; un usage compté ; sinon null. */
export function usageDeLEffet(libelle) {
  const t = plier(libelle);
  if (t.startsWith('(action)')) return 'action';
  if (/\b(?:1|une) fois(?: par combat|\/jour)\b|l'objet (?:se brise|est brise)|\brecharge\b/.test(t)) return 'limite';
  return null;
}

/**
 * Lecteur des effets d'accessoire. `cibles` : les magies et les altérations d'état, sous leur nom et leurs autres écritures ({ type: 'magie' | 'etat',
 * id, nom }, comme lib/resistance-texte.mjs). Rend `lire(effet)` → { bonus: [{ rang, cible, cible_id, valeur, choix }], usage } pour une ligne
 * accessoire_effet ; lève une erreur pour une « Résistance … » dont une cible est inconnue (rien n'est deviné).
 */
export function lecteurDEffets(cibles) {
  const parNom = new Map();
  for (const c of cibles) if (!parNom.has(plier(c.nom))) parNom.set(plier(c.nom), c);

  const resistances = (texte) => texte.split(/\s+et\s+/).map((nom) => {
    const c = parNom.get(plier(nom));
    if (!c) throw new Error(`accessoire : cible de résistance inconnue « ${nom} »`);
    return { cible: 'resistance', cible_id: c.id, valeur: 1 };
  });

  return function lire(effet) {
    const usage = usageDeLEffet(effet.libelle);
    let bonus = [];
    if (effet.malediction || !effet.libelle) bonus = [];
    else if (effet.propriete_id === 'caracteristique') bonus = [{ cible: 'caracteristique', cible_id: effet.caracteristique_id, valeur: 1 }];
    else if (effet.propriete_id === 'competence') bonus = [{ cible: 'competence', cible_id: effet.caracteristique_id, valeur: null, choix: 1 }];
    else if (effet.bonus_cible) bonus = [{ cible: ATTRIBUTS[effet.bonus_cible], valeur: effet.bonus_valeur }];
    else {
      const t = plier(effet.libelle);
      const r = /^resistance (.+)$/.exec(t);
      if (r) bonus = resistances(String(effet.libelle).trim().replace(/^Résistance\s+/i, ''));
      else for (const [motif, faire] of MOTIFS) {
        const m = motif.exec(t);
        if (m) { bonus = faire(m); break; }
      }
    }
    return {
      bonus: bonus.map((b, i) => ({ rang: i + 1, cible: b.cible, cible_id: b.cible_id ?? null, valeur: b.valeur ?? null, choix: b.choix ?? 0 })),
      usage,
    };
  };
}

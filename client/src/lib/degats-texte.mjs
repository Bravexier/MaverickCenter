// Bonus de dégâts écrits dans le texte d'un don de classe passif, pour la pastille des dégâts d'une arme dans la fiche (demande du propriétaire : « rajouter
// les bonus dus aux améliorations et potentiels passifs de classes »). Seul ce qu'un texte dit sans ambiguïté est compté : une valeur (« +8 dégâts », « augmente
// les dégâts de 3 », « 3+x dégâts […] x = +2 dégâts/6 niveaux de lanceur ») ET les armes qu'elle vise (« avec les arcs », « Les épées et dagues », « toutes les
// armes de corps à corps », « Les armes font », « dégâts de frappe »…). Le reste n'est jamais compté : un bonus lié à une situation (« si », « contre », « en
// forêt », « (Rage) », « par case »…), au choix, aux deux armes ou au bouclier, ou dont le texte ne dit pas quelles armes il vise, est rendu avec sa raison
// pour que la fiche le signale ; un bonus des sorts ou d'une magie (sans arme citée) n'est pas un bonus d'arme et n'est pas rendu.
// Une seule exception à « chaque » (une situation) : « Pour chaque cran de solidité perdu, l'arme en question fera +4 Dégâts. » (Vieille Branche du
// Mage Vert, décision R107), lu tel qu'écrit et seulement ainsi (`PAR_CRAN_PERDU`) : un bonus par cran perdu de chaque arme portée (`parCranPerdu`),
// que lib/fiche-moteur.mjs#degatsDArme multiplie par les crans perdus de l'arme.
// Sans dépendance : lu au build par lib/fiche-regles.mjs, testé sur toute la base (test/degats-texte.test.mjs).

/** Un mot entier (les lettres accentuées comptent comme des lettres : `\\b` ne les connaît pas). */
const mot = (source) => new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, 'u');
/** Familles d'armes (arme_famille.id) et les mots qui les nomment dans un texte. */
const FAMILLES = [
  ['arc', mot('arcs?')],
  ['arbalete', mot('arbal[eè]tes?')],
  ['epees', mot('[ée]p[ée]es?')],
  ['dagues', mot('dagues?')],
  ['hache', mot('haches?')],
  ['lance-arme-dhast', mot("armes? d'hast|lances?")],
  ['arme-de-jet', mot('armes? de jet')],
  ['pugilat', mot('pugilats?')],
  ['bombes', mot('bombes?')],
  ['masse-marteau', mot('masses?|marteaux?')],
  ['baton-de-combat', mot('b[âa]tons? de combat')],
];
const TYPES_DE_DEGATS = [['frappe', /d[ée]g[âa]ts? de frappe/], ['estoc', /d[ée]g[âa]ts? d['’]estoc/], ['taille', /d[ée]g[âa]ts? de taille/]];
const MAGIE = /\bsorts?\b|magi|alt[ée]ration|\bsoins?\b|d[ée]g[âa]ts? d['’]?(?:e |de |du |de la )?(?:arcane|n[ée]cromancie|ombre|feu|glace|eau|terre|vent|foudre|lumi[èe]re|vide|sang|corruption|temps|espace|souffrance)/;
const SITUATION = new RegExp([
  '\\bsi\\b', '\\bcontre\\b', '\\bquand\\b', 'lorsqu', '\\ben cas\\b', '\\bpendant\\b', '\\bcibl', '\\bchaque\\b', '\\bpar (?:case|alli[ée]|alt[ée]ration|tour)\\b',
  '\\(rage\\)', '\\(posture', '\\bposture\\b', 'en for[êe]t', "dans l['’]eau", 'sous la pluie', '\\bla nuit\\b', 'restreint', 'maladie', 'discr[èe]tes?',
  '\\bm[ée]t[ée]o', '\\bmonture\\b', '\\bdoit\\b', '\\bsacrifi', 'situation o[ùu]',
].join('|'));
const AU_CHOIX = /\bchoisi|\bau choix\b|\ben particulier\b/;
const SIGNE = /\+\s?(\d+)\s*(?:de |aux? |d['’]|en )?(?:d[ée]g[âa]ts?|bonus aux d[ée]g[âa]ts?)/;
const BONUS_DE = /bonus de \+?(\d+)\s*(?:aux? |de )?d[ée]g[âa]ts?/;
const AUGMENTE = /d[ée]g[âa]ts?[^.,/;]*?(?:augmentent?|font|de)\s+(?:de\s+)?\+?(\d+)\b(?!\s*%)/;
const AUGMENTE_LES = /augmente(?:nt)?\s+(?:les |ses )?d[ée]g[âa]ts?\s+(?:de\s+)?\+?(\d+)\b(?!\s*%)/;
const FORMULE_X = /(?:(\d+)\s*\+\s*)?x\s+(?:de\s+)?d[ée]g[âa]ts?/;
const PAS_X = /x\s*=\s*\+?\s*(\d+)\s*d[ée]g[âa]ts?\s*\/\s*(\d+)\s*niveaux?/;
/** Décision R107 (Vieille Branche) : tout le texte du don, tel qu'écrit (normalisé), et rien d'autre ; « l'arme en question » = chaque arme portée. */
const PAR_CRAN_PERDU = /^pour chaque cran de solidit[ée] perdu, l'arme en question fera \+\s?(\d+) d[ée]g[âa]ts\.?$/;

const normaliser = (texte) => String(texte ?? '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');
/** Le texte sans ce qui est entre guillemets (« Arc » : le nom d'une compétence, pas une arme visée) ni les maîtrises citées (« +1 maîtrise Dague »). */
const sansCitations = (texte) => texte.replace(/«[^»]*»|"[^"]*"/g, ' ').replace(/ma[îi]trises? (?:d['’]arme )?[a-zà-ÿ]+/g, ' ');

/** Les armes que vise un morceau de texte : { toutes } | { cac } | { familles, mains? } | { types } ; null s'il n'en dit rien. */
function porteeDe(morceau) {
  const m = sansCitations(morceau);
  if (/toutes les armes de corps [àa] corps/.test(m)) return { cac: true };
  const familles = FAMILLES.filter(([, re]) => re.test(m)).map(([id]) => id);
  if (familles.length) return { familles, ...(/[àa] une main/.test(m) ? { mains: 'une' } : {}) };
  const types = TYPES_DE_DEGATS.filter(([, re]) => re.test(m)).map(([id]) => id);
  if (types.length) return { types };
  if (/\bles armes font\b|\btoutes les armes\b|\bles attaques infligent\b/.test(m)) return { toutes: true };
  return null;
}

/** La valeur écrite : { valeur } ou, pour « 3+x dégâts […] x = +2 dégâts/6 niveaux », { base, pas, niveaux } (base + pas × ⌊niveau de classe ÷ niveaux⌋). */
function valeurDe(texte) {
  const pas = PAS_X.exec(texte);
  const x = FORMULE_X.exec(texte);
  if (pas && x) return { base: x[1] ? Number(x[1]) : 0, pas: Number(pas[1]), niveaux: Number(pas[2]) };
  for (const re of [SIGNE, BONUS_DE, AUGMENTE_LES, AUGMENTE]) {
    const m = re.exec(texte);
    if (m) return { valeur: Number(m[1]) };
  }
  return null;
}

/**
 * Le bonus de dégâts d'arme qu'écrit le texte d'un don passif, ou null s'il n'en écrit pas (ni « dégâts » ni valeur, ou un bonus des sorts ou d'une magie
 * sans arme citée). { valeur | base, pas, niveaux, portee } quand il se compte ; { valeur | base, pas, niveaux, raison } sinon, `raison` ∈ 'situation',
 * 'au_choix', 'deux_armes', 'bouclier', 'portee' (les armes visées ne sont pas écrites). « Pour chaque cran de solidité perdu, l'arme en question fera +4
 * Dégâts. » (décision R107) : { valeur: 4, portee: { toutes: true }, parCranPerdu: true }, la valeur d'un cran perdu.
 */
export function bonusDeDegatsEcrit(texte) {
  const t = normaliser(texte);
  if (!/d[ée]g[âa]t/.test(t)) return null;
  // décision R107, avant les situations (« chaque ») : cette écriture seule, le texte entier
  const parCran = PAR_CRAN_PERDU.exec(t.trim());
  if (parCran) return { valeur: Number(parCran[1]), portee: { toutes: true }, parCranPerdu: true };
  // le morceau qui porte le bonus : la phrase (ou la ligne) où il est écrit ; une formule « x = … » se lit sur tout le texte
  const valeur = valeurDe(t);
  if (!valeur) return null;
  const morceaux = t.split(/(?<=[.;])\s|\s\/\s|\n/).filter((m) => /d[ée]g[âa]t/.test(m));
  const morceau = morceaux.find((m) => ('pas' in valeur ? FORMULE_X.test(m) : valeurDe(m))) ?? t;
  const portee = porteeDe(morceau);
  if (!portee && MAGIE.test(t)) return null;
  // « prendre », « subis », « reçus » : la contrepartie (des dégâts pris), pas le bonus — elle ne change pas sa lecture ; une situation se cherche dans tout
  // le texte (« +8 dégâts, […]. Doit être dans l'eau. »)
  const sansContrepartie = morceau.replace(/(?:prendre|subis|re[çc]us?)[^.]*$/, '');
  if (AU_CHOIX.test(t)) return { ...valeur, raison: 'au_choix' };
  if (SITUATION.test(t.replace(/(?:prendre|subis|re[çc]us?)[^.]*/g, ''))) return { ...valeur, raison: 'situation' };
  if (/deux armes/.test(sansContrepartie)) return { ...valeur, raison: 'deux_armes' };
  if (/bouclier/.test(sansContrepartie)) return { ...valeur, raison: 'bouclier' };
  if (!portee) return { ...valeur, raison: 'portee' };
  return { ...valeur, portee };
}

/** Libellé d'une raison de non-comptage, pour l'infobulle de la fiche. */
export const RAISONS = Object.freeze({
  situation: 'selon la situation',
  au_choix: 'au choix',
  deux_armes: 'avec deux armes',
  bouclier: 'avec un bouclier',
  portee: 'armes visées non écrites',
  // décision R99 : avec un élément, les bonus du matériau et de l'amélioration de l'arme sont remplacés par les siens (lib/fiche-moteur.mjs#degatsDArme)
  element: 'remplacé par l’élément',
});

/** La valeur d'un bonus lu pour un niveau de classe (une formule « base + pas / N niveaux » s'y calcule). */
export const valeurAuNiveau = (b, niveauDeClasse) => ('valeur' in b ? b.valeur : b.base + b.pas * Math.floor(niveauDeClasse / b.niveaux));

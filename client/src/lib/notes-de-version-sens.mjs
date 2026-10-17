// Sens d'une modification sur la page « Mise à jour » : amélioration (vert), affaiblissement (rouge) ou neutre (gris), d'après les critères du
// propriétaire (docs/decisions-regles.md, R29) et rien d'autre :
//   amélioration : coût réduit, portée augmentée, zone augmentée, D/S/B augmentés (comparés par leur moyenne), nombre de tours augmenté, effet
//   secondaire ajouté, plus d'utilisations (dons), plus de santé ou de chakra ; affaiblissement : l'inverse.
// Tout le reste est neutre : barrière, vitesses, type, mode (IC, imparable…), forme de zone ou nature de portée changée (et les expressions de NM
// de cette valeur), textes libres, renommages, entités ajoutées ou retirées, et toute case qui n'est pas lue sans doute possible (lectures de
// lib/sort-analyse.mjs et lib/classe-champs.mjs).
// Une case se lit sans les balises du glossaire (le texte affiché : lib/mots-cles-balises.mjs#texteSansBalises) : une balise posée ou retirée ne change
// pas le sens.
// Fonctions pures, sans dépendance hors sort-analyse.mjs, classe-champs.mjs et mots-cles-balises.mjs : importables dans le navigateur
// (test/notes-de-version-sens.test.mjs).
import { analyserCout, analyserDegats, analyserDuree, analyserPortee, analyserZone, bonusDeMaitrise, sansExpressionsNM } from './sort-analyse.mjs';
import { analyserTypeDeDon } from './classe-champs.mjs';
import { texteSansBalises } from './mots-cles-balises.mjs';

/** Les trois sens d'une modification (CHECK de note_version_ligne.sens). */
export const SENS = ['amelioration', 'affaiblissement', 'neutre'];
const [MIEUX, MOINS, NEUTRE] = SENS;

/** Colonnes d'un sort lues en deux morceaux (valeur de base, expressions de NM), et leur champ de sort_bonus_maitrise. */
const CASES_DE_SORT = { cout_brut: 'cout', portee_brut: 'portee', zone_brut: 'zone', dsb_brut: 'dsb', effets: 'effets' };
/** Colonnes entières où « plus » est une amélioration (« Plus de santé ou de chakra = vert ») ; la barrière et les vitesses n'y sont pas. */
const ENTIERS_PLUS_EST_MIEUX = new Set([
  'classe.sante_depart', 'classe.chakra_depart',
  'race_onglet.sante_depart', 'race_onglet.chakra_depart',
  'magie.sante_offerte', 'magie.chakra_offert',
]);

const texte = (v) => (v === null || v === undefined ? '' : String(texteSansBalises(String(v))));
const espaces = (t) => t.replace(/\s+/g, ' ').trim();
const ouNull = (t) => (t === '' ? null : t);

/** Sens d'un passage de `avant` à `apres` (deux nombres) : plus grand = amélioration, ou l'inverse quand `plusEstMieux` est faux (coût). */
const comparer = (avant, apres, plusEstMieux = true) => (avant === apres ? NEUTRE : (apres > avant) === plusEstMieux ? MIEUX : MOINS);
const inverse = (sens) => (sens === MIEUX ? MOINS : sens === MOINS ? MIEUX : NEUTRE);
/** Sens de plusieurs morceaux : celui des morceaux non neutres s'ils sont tous d'accord, sinon neutre. */
const accord = (sens) => {
  const vifs = [...new Set(sens.filter((s) => s !== NEUTRE))];
  return vifs.length === 1 ? vifs[0] : NEUTRE;
};
const entier = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const m = /^\s*(-?\d+)\s*$/.exec(texte(v));
  return m ? Number(m[1]) : null;
};

// --- Valeur de base d'une case de sort ----------------------------------------------------------------------------------------------------------

/** Coût : chakra plus bas = amélioration, de même pour la quantité de la ressource (Sang, âmes) ; ressources différentes ou illisibles = neutre. */
function sensDuCout(avant, apres) {
  const a = analyserCout(avant);
  const b = analyserCout(apres);
  if (a.cout_ressource !== b.cout_ressource) return NEUTRE;
  const sens = [];
  for (const cle of ['cout_chakra', 'cout_ressource_valeur']) {
    if (a[cle] !== null && b[cle] !== null) sens.push(comparer(a[cle], b[cle], false));
    else if (a[cle] !== b[cle]) return NEUTRE;
  }
  return accord(sens);
}

/** Portée : un nombre des deux côtés, plus grand = amélioration ; « 6 » → « Vue » ou autre changement de nature = neutre. */
function sensDeLaPortee(avant, apres) {
  const a = analyserPortee(avant);
  const b = analyserPortee(apres);
  return a.portee_nature === 'nombre' && b.portee_nature === 'nombre' ? comparer(a.portee_valeur, b.portee_valeur) : NEUTRE;
}

/** Zone : même forme et tailles connues des deux côtés, plus grande = amélioration ; forme changée = neutre. */
function sensDeLaZone(avant, apres) {
  const a = analyserZone(avant);
  const b = analyserZone(apres);
  return a.zone_forme === b.zone_forme && a.zone_taille !== null && b.zone_taille !== null ? comparer(a.zone_taille, b.zone_taille) : NEUTRE;
}

/** D/S/B : deux cases lues, même effet (queue), même signe, même unité (% ou non), moyenne plus grande en valeur absolue = amélioration. */
function sensDesDegats(avant, apres) {
  const a = analyserDegats(avant);
  const b = analyserDegats(apres);
  if (!a.lisible || !b.lisible || a.queue !== b.queue || a.signe !== b.signe || a.pourcent !== b.pourcent) return NEUTRE;
  if (a.moyenne === null || b.moyenne === null) return NEUTRE;
  return comparer(Math.abs(a.moyenne), Math.abs(b.moyenne));
}

const SENS_DE_LA_VALEUR = { cout: sensDuCout, portee: sensDeLaPortee, zone: sensDeLaZone, dsb: sensDesDegats };

/**
 * Les deux valeurs de base sont-elles de même nature (même ressource, portée chiffrée, même forme de zone, même effet de D/S/B) ? Sinon, leurs
 * expressions de NM ne se comparent pas : un NM accroché à une autre forme de zone ou à un autre effet fait partie du changement de nature (neutre).
 */
const MEME_NATURE = {
  cout: (avant, apres) => {
    const a = analyserCout(avant);
    const b = analyserCout(apres);
    const forme = (c) => [c.cout_ressource, c.cout_chakra !== null, c.cout_ressource_valeur !== null].join('|');
    return forme(a) === forme(b) && (a.cout_chakra !== null || a.cout_ressource_valeur !== null);
  },
  portee: (avant, apres) => analyserPortee(avant).portee_nature === 'nombre' && analyserPortee(apres).portee_nature === 'nombre',
  zone: (avant, apres) => {
    const forme = analyserZone(avant).zone_forme;
    return forme !== 'autre' && forme === analyserZone(apres).zone_forme;
  },
  dsb: (avant, apres) => {
    const a = analyserDegats(avant);
    const b = analyserDegats(apres);
    return a.lisible && b.lisible && a.queue === b.queue && a.signe === b.signe && a.pourcent === b.pourcent;
  },
};

// --- Expressions de NM d'une case de sort -------------------------------------------------------------------------------------------------------

/** Incrément entier signé d'une expression « par NM » (« -1/NM » → -1, « +1 tour/NM » → 1) ; null sinon (« x4 », « -10% », palier, texte). */
function incrementEntier(e) {
  if (e.nature !== 'par_nm') return null;
  if (e.increment_entier !== null) return e.increment_entier;
  const m = /^([+\-–]?\d+)\s+tours?$/i.exec(e.increment_brut ?? '');
  return m ? Number(m[1].replace('–', '-')) : null;
}

/**
 * Ce qu'une expression de NM ajoute à chaque niveau, dans une unité comparable (null : pas de comparaison), orienté pour que « plus » soit
 * toujours une amélioration : coût, incrément entier changé de signe (coût qui baisse par NM = amélioration) ; portée, zone, durée : incrément
 * entier ; D/S/B : dés de même face ou nombre (même suffixe, AP, AM…), multiplié par le signe de la valeur de base (« -6 dégâts magiques (-2/NM) » :
 * une réduction qui grandit). Le pas (« /NM » ou « /3NM ») fait partie de l'unité : rien n'est calculé d'un pas à l'autre.
 */
function valeurParNm(champ, e, signeDeBase) {
  if (e.nature !== 'par_nm') return null;
  if (champ === 'cout') {
    const n = incrementEntier(e);
    return n === null ? null : { unite: `entier/${e.pas_nm}`, valeur: -n };
  }
  if (champ === 'portee' || champ === 'zone' || champ === 'effets') {
    const n = incrementEntier(e);
    return n === null ? null : { unite: `entier/${e.pas_nm}`, valeur: n };
  }
  if (champ === 'dsb') {
    const brut = (e.increment_brut ?? '').replace('–', '-');
    const des = /^([+-])(\d+)d(\d*)$/i.exec(brut);
    if (des) return { unite: `d${des[3]}/${e.pas_nm}`, valeur: signeDeBase * (des[1] === '-' ? -1 : 1) * Number(des[2]) };
    const nombre = /^([+-])(\d+)(%?)\s*(\p{L}*)$/u.exec(brut);
    if (nombre) return { unite: `${nombre[3]}${nombre[4].toLowerCase()}/${e.pas_nm}`, valeur: signeDeBase * (nombre[1] === '-' ? -1 : 1) * Number(nombre[2]) };
  }
  return null;
}

const sensDUnAjout = (v) => (v === null ? NEUTRE : v.valeur > 0 ? MIEUX : v.valeur < 0 ? MOINS : NEUTRE);
const sensDUnePaire = (a, b) => (a === null || b === null || a.unite !== b.unite ? NEUTRE : comparer(a.valeur, b.valeur));

/**
 * Parties « nm » : les expressions qui changent d'un côté à l'autre (mêmes textes retirés des deux côtés), ajoutées (sens de leur valeur),
 * retirées (l'inverse), ou appariées dans l'ordre quand il en reste autant des deux côtés ; un reste inégal est une seule partie neutre.
 * `comparable` faux : toutes les parties sont neutres (valeurs de base de natures différentes, ou expressions qui ne se comparent pas).
 */
function partiesNm(champ, avant, apres, expressionsAvant, expressionsApres, comparable = true) {
  const cle = (e) => espaces(e.texte_brut);
  const restantsApres = [...expressionsApres];
  const restantsAvant = [];
  for (const e of expressionsAvant) {
    const i = restantsApres.findIndex((f) => cle(f) === cle(e));
    if (i >= 0) restantsApres.splice(i, 1);
    else restantsAvant.push(e);
  }
  const signe = (t) => (/^[-–]/.test(sansExpressionsNM(t)) ? -1 : 1);
  const valeur = (e, t) => (comparable ? valeurParNm(champ, e, signe(t)) : null);
  const partie = (a, b, sens) => ({ partie: 'nm', avant: a, apres: b, sens });
  if (!restantsAvant.length) return restantsApres.map((e) => partie(null, cle(e), sensDUnAjout(valeur(e, apres))));
  if (!restantsApres.length) return restantsAvant.map((e) => partie(cle(e), null, inverse(sensDUnAjout(valeur(e, avant)))));
  if (restantsAvant.length === restantsApres.length) {
    return restantsAvant.map((e, i) => {
      const f = restantsApres[i];
      return partie(cle(e), cle(f), sensDUnePaire(valeur(e, avant), valeur(f, apres)));
    });
  }
  return [partie(restantsAvant.map(cle).join(' ; '), restantsApres.map(cle).join(' ; '), NEUTRE)];
}

// --- Effets d'un sort -------------------------------------------------------------------------------------------------------------------------

const DUREE = /(?<![\p{L}\d])(dure|pendant)\s+\d+\s+tours?(?!\p{L})/giu;
const sansAccents = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const PARENTHESES = /\(([^()]*)\)/g;

/** L'expression « par NM » d'une parenthèse quand elle n'écrit que cela (« (+1/NM) », « (+1 tour/NM) ») ; null sinon. */
const parNmSeul = (interieur) => bonusDeMaitrise('effets', `(${interieur})`).find((e) => e.nature === 'par_nm' && e.texte_brut === interieur.trim()) ?? null;

/**
 * Les expressions « par NM » d'une case d'effets, à leur place : `duree`, celles qui portent sur le nombre de tours (« +1 tour/NM », ou une
 * parenthèse qui ne contient qu'elle juste après « N tour(s) » : « Dure 2 tours (+1/NM) ») ; `autres`, les autres parenthèses qui ne contiennent
 * qu'une expression « par NM » (« 1 boule (+1/NM) »). La place compte : « 1 boule (+1/NM) … pendant 2 tours (+1/NM) » a une expression de chaque.
 */
function expressionsDesEffets(t) {
  const duree = [];
  const autres = [];
  const surLesTours = (e) => incrementEntier(e) !== null && /tours?$/i.test(e.increment_brut ?? '');
  for (const g of t.matchAll(PARENTHESES)) {
    const seule = parNmSeul(g[1]);
    const apresDesTours = /\d+\s+tours?\s*$/i.test(t.slice(0, g.index));
    if (seule && incrementEntier(seule) !== null && (surLesTours(seule) || apresDesTours)) duree.push(seule);
    else if (seule) autres.push(seule);
    else duree.push(...bonusDeMaitrise('effets', `(${g[1]})`).filter(surLesTours));
  }
  // hors parenthèses : « +1 tour/NM » écrit dans une phrase
  const horsParentheses = t.replace(PARENTHESES, (tout) => ' '.repeat(tout.length));
  duree.push(...bonusDeMaitrise('effets', horsParentheses).filter(surLesTours));
  return { duree, autres };
}

/** Le nombre de tours de la durée remplacé par « # », hors des parenthèses qui parlent de NM (que analyserDuree ne lit pas non plus). */
const sansNombreDeTours = (t) =>
  t.replace(/\([^()]*\)|[^(]+|\(/g, (morceau) => (/^\(.*\)$/s.test(morceau) && !sansExpressionsNM(morceau) ? morceau : morceau.replace(DUREE, '$1 # tours')));

/**
 * Phrases d'une case (lignes, puis « . ! ? » suivis d'une espace) : { brut, cle }. La clé compare les phrases sans casse, accents ni ponctuation,
 * sans les parenthèses qui n'écrivent qu'une expression « par NM », et sans le nombre de tours de la durée quand `sansDuree` (comparée à part).
 */
function phrasesDe(t, { sansDuree }) {
  const out = [];
  for (const ligne of texte(t).split(/\r?\n/)) {
    for (const morceau of ligne.split(/(?<=[.!?…])\s+/)) {
      const brut = morceau.trim();
      let cle = brut.replace(PARENTHESES, (tout, interieur) => (parNmSeul(interieur) ? ' ' : tout));
      if (sansDuree) cle = sansNombreDeTours(cle);
      cle = sansAccents(cle).toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}#%]+/gu, ' ').trim();
      if (cle) out.push({ brut, cle });
    }
  }
  return out;
}

const tours = (n) => `${n} tour${n > 1 ? 's' : ''}`;

/**
 * Effets : (a) la durée « Dure N tour(s) » / « pendant N tour(s) », plus de tours = amélioration ; (b) les expressions de NM sur la durée, plus grand
 * = amélioration (ajout positif = amélioration, retrait = affaiblissement) ; (c) l'effet secondaire : toutes les anciennes phrases gardées et au moins
 * une nouvelle = effet ajouté (amélioration), toutes les nouvelles déjà là et au moins une ancienne disparue = effet retiré (affaiblissement), sinon
 * reformulation (neutre) ; les autres expressions de NM entre parenthèses qui changent : parties neutres.
 */
function partiesDesEffets(avant, apres) {
  const parties = [];
  const dureeAvant = analyserDuree(avant);
  const dureeApres = analyserDuree(apres);
  const deuxDurees = dureeAvant !== null && dureeApres !== null;
  if (deuxDurees && dureeAvant.tours !== dureeApres.tours) {
    parties.push({ partie: 'valeur', avant: tours(dureeAvant.tours), apres: tours(dureeApres.tours), sens: comparer(dureeAvant.tours, dureeApres.tours) });
  }
  const exprAvant = expressionsDesEffets(avant);
  const exprApres = expressionsDesEffets(apres);
  parties.push(...partiesNm('effets', avant, apres, exprAvant.duree, exprApres.duree));

  const phrasesAvant = phrasesDe(avant, { sansDuree: deuxDurees });
  const phrasesApres = phrasesDe(apres, { sansDuree: deuxDurees });
  const clesAvant = new Set(phrasesAvant.map((p) => p.cle));
  const clesApres = new Set(phrasesApres.map((p) => p.cle));
  const retirees = phrasesAvant.filter((p) => !clesApres.has(p.cle));
  const ajoutees = phrasesApres.filter((p) => !clesAvant.has(p.cle));
  if (retirees.length || ajoutees.length) {
    const sens = !retirees.length ? MIEUX : !ajoutees.length ? MOINS : NEUTRE;
    const joindre = (ps) => ouNull(ps.map((p) => p.brut).join(' '));
    parties.push({ partie: 'valeur', avant: joindre(retirees), apres: joindre(ajoutees), sens });
  }

  // les autres parenthèses « par NM » (« 1 boule (+1/NM) ») : retirées des phrases ci-dessus, elles restent visibles, neutres
  parties.push(...partiesNm('effets', avant, apres, exprAvant.autres, exprApres.autres, false));
  return parties;
}

// --- Entrée -------------------------------------------------------------------------------------------------------------------------------------

/** Une case courte de sort (coût, portée, zone, D/S/B) : la valeur de base, puis chaque expression de NM qui change. */
function partiesDUneCaseCourte(champ, avant, apres) {
  const parties = [];
  const baseAvant = sansExpressionsNM(avant);
  const baseApres = sansExpressionsNM(apres);
  if (baseAvant !== baseApres) {
    parties.push({ partie: 'valeur', avant: ouNull(baseAvant), apres: ouNull(baseApres), sens: SENS_DE_LA_VALEUR[champ](avant, apres) });
  }
  const memeNature = baseAvant === baseApres || MEME_NATURE[champ](avant, apres);
  parties.push(...partiesNm(champ, avant, apres, bonusDeMaitrise(champ, avant), bonusDeMaitrise(champ, apres), memeNature));
  return parties;
}

/** Période d'une limite de don, normalisée : « Fois par combat » → « combat », « Combat » → « combat ». */
const periode = (p) => (p ?? '').toLowerCase().replace(/fois par/g, '').replace(/\bpar\b/g, '').replace(/\s+/g, '');

/** Type d'un don : même type et même période, plus d'utilisations = amélioration (« Réaction (3 fois/combat) » → « (2 fois/combat) » : affaiblissement). */
function sensDuTypeDeDon(avant, apres) {
  const a = analyserTypeDeDon(avant);
  const b = analyserTypeDeDon(apres);
  if (a.type === null || a.type !== b.type || a.limite_nombre === null || b.limite_nombre === null) return NEUTRE;
  if (periode(a.limite_periode) !== periode(b.limite_periode)) return NEUTRE;
  return comparer(a.limite_nombre, b.limite_nombre);
}

/**
 * Sens d'une modification d'une colonne : { sens, parties }. `sens` est l'un de SENS ; `parties` détaille une case de sort lue en morceaux
 * ([{ partie: 'valeur' | 'nm', avant, apres, sens }], seulement les morceaux qui changent) et vaut null ailleurs, ou quand aucun morceau ne change.
 * Le sens d'une case de sort est celui de ses morceaux non neutres s'ils sont d'accord, sinon neutre (Flash, coût « 6 » → « 8 (-1/NM) » : valeur
 * affaiblie, NM ajouté qui baisse le coût, donc neutre).
 * @param {string} table nom de la table (sort, capacite, classe, race_onglet, magie…)
 * @param {string} colonne nom de la colonne
 * @param {string | number | null} avant valeur brute avant la modification
 * @param {string | number | null} apres valeur brute après
 * @returns {{ sens: 'amelioration' | 'affaiblissement' | 'neutre', parties: { partie: 'valeur' | 'nm', avant: string | null, apres: string | null,
 *   sens: 'amelioration' | 'affaiblissement' | 'neutre' }[] | null }}
 */
export function sensDuChangement(table, colonne, avant, apres) {
  const neutre = { sens: NEUTRE, parties: null };
  if (texte(avant) === texte(apres)) return neutre;
  if (table === 'sort' && Object.hasOwn(CASES_DE_SORT, colonne)) {
    const champ = CASES_DE_SORT[colonne];
    const parties = champ === 'effets' ? partiesDesEffets(texte(avant), texte(apres)) : partiesDUneCaseCourte(champ, texte(avant), texte(apres));
    return parties.length ? { sens: accord(parties.map((p) => p.sens)), parties } : neutre;
  }
  if (table === 'capacite' && colonne === 'type_brut') return { sens: sensDuTypeDeDon(texte(avant), texte(apres)), parties: null };
  if (ENTIERS_PLUS_EST_MIEUX.has(`${table}.${colonne}`)) {
    const a = entier(avant);
    const b = entier(apres);
    return { sens: a === null || b === null ? NEUTRE : comparer(a, b), parties: null };
  }
  return neutre;
}

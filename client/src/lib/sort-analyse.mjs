// Analyse des cases d'un sort (tables sort, sort_type, sort_mode, sort_bonus_maitrise ; data/schema.sql, section 3) : ce que la base tire du texte
// d'une case (colonnes typées, types et modes, bonus de niveau de maîtrise). Les mêmes lectures que l'importeur des magies, réécrites pour l'édition
// depuis le site de dev (client/serveur/edition.mjs) ; test/sort-analyse.test.mjs les rejoue sur les 322 sorts de la base.
// Rien n'est inventé : une forme qui n'est pas reconnue laisse la colonne typée vide (NULL) et le brut fait foi.
// Fonctions pures, sans dépendance (sauf text.mjs) : partagées par le service et par les pages (affichage d'une case modifiée).
import { normalize } from './text.mjs';

/** Types de sort (CHECK de sort_type.type), par leur écriture normalisée. */
export const TYPES_DE_SORT = ['attaque', 'entrave', 'soin', 'amplification', 'placement', 'invocation', 'construction', 'protection', 'meteo', 'aleatoire'];

/** Colonnes d'un sort où un bonus de NM peut être écrit (sort_bonus_maitrise.champ), et leur colonne dans la table sort. */
export const COLONNES_NM = { type: 'type_brut', cout: 'cout_brut', portee: 'portee_brut', zone: 'zone_brut', dsb: 'dsb_brut', effets: 'effets', remarque: 'remarque' };
/** Cases courtes : l'expression de NM y est toujours entre parenthèses et dit elle-même ce qu'elle modifie. */
const CASES_COURTES = new Set(['type', 'cout', 'portee', 'zone', 'dsb']);

const SANS_NM = /\(([^()]*)\)/g;
const groupes = (texte) => [...String(texte ?? '').matchAll(SANS_NM)].map((m) => ({ debut: m.index, fin: m.index + m[0].length, interieur: m[1] }));
const mentionneNM = (texte) => /\d\s?NM|\/\s*NM|\bpar\s+(?:NM|niveau de ma[iî]trise)|niveaux?\s+(?:\d\s+)?de\s+ma[iî]trise|\bNM\b/i.test(texte);

/** Le texte d'une case sans ses précisions de NM entre parenthèses (« 55 (-5/NM) » → « 55 ») : la valeur de base que les colonnes typées lisent. */
export const sansExpressionsNM = (texte) =>
  String(texte ?? '')
    .replace(SANS_NM, (tout, interieur) => (mentionneNM(interieur) ? '' : tout))
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Colonne « Type » : les types (avant la première parenthèse, séparés par « / »), le mode (ce qui est entre parenthèses, une ligne par groupe) et ce
 * qu'en disent les colonnes typées de sort (IC direct, IC pour N NM, imparable, inesquivable) ; les modes de base (sort_mode) : IC, IC x N,
 * Imparable, Inesquivable — un mode qui dépend des NM (« IC pour 3 NM », « IC x 1/NM ») est un bonus de maîtrise, pas un mode.
 * @returns {{ types: { type: string, libelle: string }[], mode_brut: string | null, modes: { mode: string, libelle: string, fois: number | null }[],
 *   ic_direct: number, ic_nm_min: number | null, imparable: number, inesquivable: number, inconnus: string[] }}
 */
export function analyserType(typeBrut) {
  const texte = String(typeBrut ?? '');
  const tete = texte.split('(')[0];
  const libelles = tete.split('/').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const types = [];
  const inconnus = [];
  for (const libelle of libelles) {
    const type = normalize(libelle);
    if (TYPES_DE_SORT.includes(type)) {
      if (!types.some((t) => t.type === type)) types.push({ type, libelle });
    } else inconnus.push(libelle);
  }
  const parentheses = groupes(texte).map((g) => g.interieur.trim()).filter(Boolean);
  const modes = [];
  for (const g of parentheses) {
    if (mentionneNM(g)) continue;
    for (const morceau of g.split(/\/\s+/).map((m) => m.trim()).filter(Boolean)) {
      const fois = /^IC x (\d+)$/i.exec(morceau);
      const mode = /^IC$/i.test(morceau) || fois ? 'ic' : normalize(morceau) === 'imparable' ? 'imparable' : normalize(morceau) === 'inesquivable' ? 'inesquivable' : null;
      if (mode && !modes.some((m) => m.mode === mode)) modes.push({ mode, libelle: morceau, fois: fois ? Number(fois[1]) : null });
    }
  }
  const icPour = /ic pour (\d)/.exec(texte.replace(/\n/g, ' ').toLowerCase());
  return {
    types,
    mode_brut: parentheses.length ? parentheses.join('\n') : null,
    modes,
    ic_direct: texte.includes('(IC)') ? 1 : 0,
    ic_nm_min: icPour ? Number(icPour[1]) : null,
    imparable: texte.toLowerCase().includes('imparable') ? 1 : 0,
    inesquivable: texte.toLowerCase().includes('inesquivable') ? 1 : 0,
    inconnus,
  };
}

/**
 * Colonne « Coût » : la consommation de chakra quand la forme est « N », « N (k/NM) » ou « N + M Sang/âme(s) » ; la ressource de la 4ème barre
 * citée (« Sang », « âme(s) ») et sa quantité (NULL pour « X »).
 */
export function analyserCout(coutBrut) {
  const base = sansExpressionsNM(coutBrut);
  const seul = /^(\d+)$/.exec(base);
  if (seul) return { cout_chakra: Number(seul[1]), cout_ressource: null, cout_ressource_valeur: null };
  const avec = /^(?:(\d+)\s*\+\s*)?(\d+|X)\s+(Sang|âmes?)$/.exec(base);
  if (avec) {
    return {
      cout_chakra: avec[1] === undefined ? null : Number(avec[1]),
      cout_ressource: avec[3] === 'Sang' ? 'sang' : 'ame',
      cout_ressource_valeur: avec[2] === 'X' ? null : Number(avec[2]),
    };
  }
  return { cout_chakra: null, cout_ressource: null, cout_ressource_valeur: null };
}

/** Colonne « Portée » : nombre (sa valeur de base), soi, vue, illimitée, variable, ou autre (le brut fait foi). */
export function analyserPortee(porteeBrut) {
  const base = sansExpressionsNM(porteeBrut);
  if (/^\d+$/.test(base)) return { portee_nature: 'nombre', portee_valeur: Number(base) };
  const n = normalize(base);
  const nature = { 'soi-meme': 'soi', vue: 'vue', illimite: 'illimitee', variable: 'variable' }[n] ?? 'autre';
  return { portee_nature: nature, portee_valeur: null };
}

/** Colonne « Zone » : forme et premier nombre de « Cercle de N », « Ligne de N », « Carré … N », « Croix de N », « N cibles » ; 'autre' sinon. */
export function analyserZone(zoneBrut) {
  const base = sansExpressionsNM(zoneBrut);
  const nombre = (re) => {
    const m = re.exec(base);
    return m ? Number(m[1]) : null;
  };
  if (/^1$/.test(base)) return { zone_forme: 'unique', zone_taille: 1 };
  if (/^Cercle\b/i.test(base)) return { zone_forme: 'cercle', zone_taille: nombre(/(\d+)/) };
  if (/^Carré(?!\p{L})/iu.test(base)) return { zone_forme: 'carre', zone_taille: nombre(/(\d+)/) };
  if (/^Rectangle\b/i.test(base) || /^\d+x\d+$/.test(base)) return { zone_forme: 'rectangle', zone_taille: null };
  if (/^Ligne\b/i.test(base)) return { zone_forme: 'ligne', zone_taille: nombre(/(\d+)/) };
  if (/^Croix\b/i.test(base)) return { zone_forme: 'croix', zone_taille: nombre(/(\d+)/) };
  const cibles = /^(\d+) cibles$/.exec(base);
  if (cibles) return { zone_forme: 'cibles', zone_taille: Number(cibles[1]) };
  const forme = { cone: 'cone', terrain: 'terrain', vue: 'vue', variable: 'variable' }[normalize(base)] ?? 'autre';
  return { zone_forme: forme, zone_taille: null };
}

// --- Bonus de niveau de maîtrise -----------------------------------------------------------------------------------------------------------------
// Par NM : un incrément signé (« +1d6 », « -5 », « x4 », « IC x 1 ») ou un pourcentage (« 1% »), puis « /NM », « /3NM », « par NM » ou « par Niveau
// de Maîtrise » ; un mot peut suivre le nombre (« +1 tour/NM »).
const PAR_NM = /((?:[+\-–]\d+(?:d\d*)?(?:%|AM|AP)?|x\d+|IC x \d+|\d+%)(?: [a-zé]+)?)\s*(?:\/\s*(3?)\s*NM\b|\s+par\s+(?:NM\b|Niveau de Maîtrise))/i;
// À partir d'un palier : « 3NM = … », « IC pour 3 NM », « si 3NM », « à 3NM », « pour 3NM », « au niveau 3 de maîtrise », « si 3 niveaux de maîtrise ».
const PALIER_EGAL = /(\d)\s?NM\s*=/;
const PALIER_PHRASE = /(?<!\p{L})(?:si|à|pour)\s+(\d)\s?NM\b|(?<!\p{L})au\s+niveau\s+(\d)\s+de\s+ma[iî]trise|(?<!\p{L})si\s+(\d)\s+niveaux\s+de\s+ma[iî]trise/iu;
const SEUIL = /(\d)\s?NM\b|(\d)\s+de\s+ma[iî]trise|(\d)\s+niveaux/i;

const entierSigne = (increment) => (/^[+\-–]?\d+$/.test(increment) ? Number(increment.replace('–', '-')) : null);
const seuilDe = (texte) => {
  const m = SEUIL.exec(texte);
  return m ? Number(m[1] ?? m[2] ?? m[3]) : null;
};
const sansPoint = (t) => t.replace(/[.\s]+$/, '').trim();

/** Une expression trouvée dans un passage : { nature, texte_brut, increment_brut, increment_entier, pas_nm, seuil_nm, debut } (debut : place dans le passage). */
function expressionDe(passage, { entier = false } = {}) {
  const par = PAR_NM.exec(passage);
  if (par) {
    return { nature: 'par_nm', texte_brut: par[0].trim(), increment_brut: par[1].trim(), increment_entier: entierSigne(par[1].trim()), pas_nm: par[2] === '3' ? 3 : 1, seuil_nm: null, debut: par.index };
  }
  const egal = PALIER_EGAL.exec(passage);
  if (egal) return { nature: 'palier', texte_brut: sansPoint(passage.slice(egal.index)), increment_brut: null, increment_entier: null, pas_nm: null, seuil_nm: Number(egal[1]), debut: egal.index };
  const phrase = PALIER_PHRASE.exec(passage);
  if (phrase && !entier) {
    return { nature: 'palier', texte_brut: phrase[0].trim(), increment_brut: null, increment_entier: null, pas_nm: null, seuil_nm: Number(phrase[1] ?? phrase[2] ?? phrase[3]), debut: phrase.index };
  }
  if (!mentionneNM(passage)) return null;
  const seuil = seuilDe(passage);
  const texte = sansPoint(passage);
  return { nature: seuil ? 'palier' : 'texte', texte_brut: texte, increment_brut: null, increment_entier: null, pas_nm: null, seuil_nm: seuil, debut: passage.indexOf(texte) };
}

/** Phrases d'un texte (lignes, puis « . » suivi d'une espace), avec leur place dans le texte. */
function phrases(texte) {
  const out = [];
  const re = /[^\n.]+(?:\.(?!\s|$)[^\n.]*)*\.?/g;
  for (const m of texte.matchAll(re)) if (m[0].trim()) out.push({ debut: m.index, texte: m[0] });
  return out;
}

/**
 * Les bonus de NM qu'écrit une case (lignes de sort_bonus_maitrise de ce champ, sans sort_id) : { champ, rang, nature, texte_brut, contexte,
 * increment_brut, increment_entier, pas_nm, seuil_nm }. Case courte (type, coût, portée, zone, D/S/B) : une expression par groupe entre parenthèses
 * qui parle de NM, le contexte est l'expression elle-même (ou la case entière quand l'expression ne dit pas ce qu'elle modifie : « ou verticales/3NM »).
 * Effets et remarque : chaque groupe entre parenthèses, puis chaque phrase hors parenthèses, qui parle de NM ; le contexte est la phrase qui contient
 * l'expression.
 */
export function bonusDeMaitrise(champ, texteCase) {
  const texte = String(texteCase ?? '');
  if (!texte.trim()) return [];
  const trouvees = [];
  const lesGroupes = groupes(texte);
  for (const g of lesGroupes) {
    if (!mentionneNM(g.interieur)) continue;
    const interieur = g.interieur.trim();
    if (CASES_COURTES.has(champ)) {
      const e = expressionDe(interieur, { entier: true });
      const texteBrut = interieur;
      trouvees.push({ ...e, texte_brut: texteBrut, debut: g.debut, contexte: e.nature !== 'par_nm' && /^[a-zà-ÿ]/.test(texteBrut) ? texte.replace(/\s+/g, ' ').trim() : texteBrut });
      continue;
    }
    const e = expressionDe(interieur);
    if (!e) continue;
    trouvees.push({ ...e, debut: g.debut + 1 + g.interieur.indexOf(interieur) + e.debut });
  }
  if (!CASES_COURTES.has(champ)) {
    // hors parenthèses : les groupes sont masqués (même longueur), chaque phrase est lue
    const masque = lesGroupes.reduce((t, g) => t.slice(0, g.debut) + ' '.repeat(g.fin - g.debut) + t.slice(g.fin), texte);
    for (const p of phrases(masque)) {
      const e = expressionDe(p.texte);
      if (e) trouvees.push({ ...e, texte_brut: e.nature === 'texte' ? sansPoint(texte.slice(p.debut, p.debut + p.texte.length)) : e.texte_brut, debut: p.debut + e.debut });
    }
  }
  trouvees.sort((a, b) => a.debut - b.debut);
  return trouvees.map((e, i) => {
    const contexte = e.contexte ?? contexteDe(texte, e.debut, e.texte_brut);
    return {
      champ,
      rang: i + 1,
      nature: e.nature,
      texte_brut: e.texte_brut,
      contexte,
      increment_brut: e.increment_brut,
      increment_entier: e.increment_entier,
      pas_nm: e.pas_nm,
      seuil_nm: e.seuil_nm,
    };
  });
}

/** La phrase (ligne, ou morceau entre deux points) qui contient l'expression ; l'expression elle-même si elle n'y est pas retrouvée. */
function contexteDe(texte, debut, expression) {
  for (const p of phrases(texte)) {
    if (debut >= p.debut && debut < p.debut + p.texte.length) {
      const phrase = sansPoint(p.texte.trim());
      if (phrase.includes(expression)) return phrase;
    }
  }
  return expression;
}

/** Les colonnes d'un sort qui ont un effet dû aux NM (effets et remarque comptent pour une : la case « Effets »), dans l'ordre de lecture. */
export function colonnesAvecNM(sort) {
  const champs = [];
  for (const [champ, colonne] of Object.entries(COLONNES_NM)) {
    if (!bonusDeMaitrise(champ, sort[colonne]).length) continue;
    const nom = champ === 'remarque' ? 'effets' : champ;
    if (!champs.includes(nom)) champs.push(nom);
  }
  return champs;
}

// Analyse des cases d'un sort (tables sort, sort_type, sort_mode, sort_bonus_maitrise ; data/schema.sql, section 3) : ce que la base tire du texte
// d'une case (colonnes typées, types et modes, bonus de niveau de maîtrise). Les mêmes lectures que l'importeur des magies, réécrites pour l'édition
// depuis le site de dev (client/serveur/edition.mjs) ; test/sort-analyse.test.mjs les rejoue sur les 322 sorts de la base.
// Rien n'est inventé : une forme qui n'est pas reconnue laisse la colonne typée vide (NULL) et le brut fait foi.
// Une case s'analyse sans les balises du glossaire des mots-clés (lib/mots-cles-balises.mjs : « {{id|texte}} » se lit « texte »).
// Fonctions pures, sans dépendance (sauf text.mjs et mots-cles-balises.mjs) : partagées par le service et par les pages (affichage d'une case modifiée).
import { texteSansBalises } from './mots-cles-balises.mjs';
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

/** La case parle-t-elle de niveaux de maîtrise (« -1/NM », « si 3NM », « par NM ») ? Le coût secondaire n'en écrit pas (décision R105, migration 0063). */
export const mentionneUnNm = (texte) => mentionneNM(String(texteSansBalises(texte ?? '')));

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
  const texte = String(texteSansBalises(typeBrut ?? ''));
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
 * Colonnes « Coût » et « Coût secondaire » (décision R105) : la consommation de chakra quand le coût est « N » ou « N (k/NM) » ; la ressource de la
 * 4ème barre quand le coût secondaire est « M Sang » ou « M âme(s) », et sa quantité (NULL pour « X »).
 */
export function analyserCout(coutBrut, coutSecondaire = null) {
  const base = sansExpressionsNM(texteSansBalises(coutBrut));
  const seul = /^(\d+)$/.exec(base);
  const second = /^(\d+|X)\s+(Sang|âmes?)$/.exec(String(texteSansBalises(coutSecondaire ?? '')).trim());
  return {
    cout_chakra: seul ? Number(seul[1]) : null,
    cout_ressource: second ? (second[2] === 'Sang' ? 'sang' : 'ame') : null,
    cout_ressource_valeur: second && second[1] !== 'X' ? Number(second[1]) : null,
  };
}

/** Colonne « Portée » : nombre (sa valeur de base), soi, vue, illimitée, variable, ou autre (le brut fait foi). */
export function analyserPortee(porteeBrut) {
  const base = sansExpressionsNM(texteSansBalises(porteeBrut));
  if (/^\d+$/.test(base)) return { portee_nature: 'nombre', portee_valeur: Number(base) };
  const n = normalize(base);
  const nature = { 'soi-meme': 'soi', vue: 'vue', illimite: 'illimitee', variable: 'variable' }[n] ?? 'autre';
  return { portee_nature: nature, portee_valeur: null };
}

/** Colonne « Zone » : forme et premier nombre de « Cercle de N », « Ligne de N », « Carré … N », « Croix de N », « N cibles » ; 'autre' sinon. */
export function analyserZone(zoneBrut) {
  const base = sansExpressionsNM(texteSansBalises(zoneBrut));
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
  const texte = String(texteSansBalises(texteCase ?? ''));
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

/**
 * La phrase (ligne, ou morceau entre deux points) qui contient l'expression ; l'expression elle-même si elle n'y est pas retrouvée. Une phrase qui
 * n'est qu'un groupe entre parenthèses se lit comme l'import l'a lue : quand le groupe n'est que l'expression, sans « = » (« (+2/NM) », « (3NM
 * permet de le faire sur 2 alliés) »), la phrase qui le précède sur la même ligne et le groupe (« Réduit de 5 l'initiative… pour le prochain tour.
 * (+2/NM) ») ; sinon le groupe dit lui-même ce qu'il fait (« (3NM = Pas de dégâts alliés) », « (Ignore l'esquive… au niveau 3 de maîtrise) ») : le
 * groupe sans ses parenthèses.
 */
function contexteDe(texte, debut, expression) {
  const lesPhrases = phrases(texte);
  for (const [i, p] of lesPhrases.entries()) {
    if (debut >= p.debut && debut < p.debut + p.texte.length) {
      const phrase = sansPoint(p.texte.trim());
      if (!phrase.includes(expression)) break;
      const groupe = /^\(([^()]*)\)$/.exec(phrase);
      if (!groupe) return phrase;
      const interieur = groupe[1].trim();
      const precedente = lesPhrases[i - 1];
      if (interieur === expression && !interieur.includes('=')) {
        if (precedente && !texte.slice(precedente.debut, p.debut).includes('\n')) return sansPoint(texte.slice(precedente.debut, p.debut + p.texte.length).trim());
        return phrase;
      }
      return interieur.includes(expression) ? interieur : phrase;
    }
  }
  return expression;
}

// --- Lectures des notes de version ---------------------------------------------------------------------------------------------------------------
// Deux lectures de plus, pour la page « Mise à jour » (lib/notes-de-version-sens.mjs, décision R29) : elles ne remplissent aucune colonne de la base,
// elles disent seulement si une case modifiée a augmenté ou baissé. Même principe que plus haut : elles lisent la valeur de base (sansExpressionsNM)
// et une forme qui n'est pas reconnue n'est pas lue (lisible: false, ou null), jamais devinée.

// Un terme : des dés « NdF » (« 7d6 », « 3D6 », « 1d » sans faces) ou un nombre (« 15 », « 20% »).
const TERME_DSB = /^(?:(\d+)[dD](\d*)(?![\p{L}\d])|(\d+)(%?))/u;
// La suite d'une case qui écrit plus d'un effet (« +5AP, +10AM », « 6 Initiative et +2 Vitesse », « 15 - 30 - 15 », « => ») ou un calcul non lu
// (« 2 x 1d6 dégâts », « 10/3 dégâts », « dégâts 1d4 feu ») : l'effet commence par une lettre et n'écrit plus de dés.
const QUEUE_COMPOSEE = /[+–=,;%]|(?:^|\s)-|-(?:\s|\d|$)|(?:^|\s)(?:et|ou)(?:\s|$)|\bx\d|^[^\p{L}]|^d\d|\d+d(?:\d|(?!\p{L}))/iu;

/**
 * Case « D/S/B » : la quantité qu'elle écrit, quand c'est une somme de dés et de nombres suivie d'un seul effet (« 7d6 + 15 dégâts », « 3D6 dégâts »,
 * « +5 soin », « -6 dégâts magiques », « 20% de soin »). `des` et `fixe` sont écrits sans le signe de tête, `signe` le porte ; `queue` est la suite
 * de la case (minuscules, espaces réduits, sans espace autour de « / », sans « de » de tête ni point final) ; `moyenne` = signe × (somme des dés,
 * nombre × (faces + 1) / 2, + fixe), null si un dé n'a pas de faces (« 1d »). Une case qui ne commence pas par la quantité (« Soigne 6d6 »,
 * « Variable », « X dégâts ») ou qui écrit plusieurs effets (« +5AP, +10AM », « => ») n'est pas lue : lisible: false.
 * @returns {{ lisible: boolean, des: { nombre: number, faces: number | null }[], fixe: number, pourcent: boolean, signe: 1 | -1, queue: string | null,
 *   moyenne: number | null }}
 */
export function analyserDegats(dsbBrut) {
  const illisible = { lisible: false, des: [], fixe: 0, pourcent: false, signe: 1, queue: null, moyenne: null };
  const base = sansExpressionsNM(texteSansBalises(dsbBrut ?? '')).replace(/\s+/g, ' ').trim();
  const tete = /^([+\-–])?\s*/.exec(base);
  const signe = tete[1] === '-' || tete[1] === '–' ? -1 : 1;
  let reste = base.slice(tete[0].length);
  const des = [];
  let fixe = 0;
  let pourcent = false;
  let termes = 0;
  for (;;) {
    const t = TERME_DSB.exec(reste);
    if (!t) return illisible;
    termes += 1;
    if (t[1] !== undefined) des.push({ nombre: Number(t[1]), faces: t[2] ? Number(t[2]) : null });
    else {
      fixe += Number(t[3]);
      if (t[4]) pourcent = true;
    }
    reste = reste.slice(t[0].length);
    const plus = /^\s*\+\s*(?=\d)/.exec(reste);
    if (!plus) break;
    reste = reste.slice(plus[0].length);
  }
  if (pourcent && termes > 1) return illisible;
  const queue = reste
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim()
    .replace(/^(?:de\s+|d['’]\s*)/, '')
    .replace(/[\s.!;:]+$/, '');
  if (QUEUE_COMPOSEE.test(queue)) return illisible;
  const sansFaces = des.some((d) => d.faces === null);
  const moyenne = sansFaces ? null : signe * (des.reduce((somme, d) => somme + (d.nombre * (d.faces + 1)) / 2, 0) + fixe);
  return { lisible: true, des, fixe, pourcent, signe, queue, moyenne };
}

/**
 * Durée en tours qu'écrit une case (les effets d'un sort) : « Dure N tour(s) » ou « pendant N tour(s) », sans casse ni accents, hors expressions
 * de NM entre parenthèses (« Dure 2 tours (+1/NM) » → 2). { tours: N } si la case écrit exactement une durée, null sinon (aucune, ou plusieurs).
 * @returns {{ tours: number } | null}
 */
export function analyserDuree(texte) {
  const base = sansExpressionsNM(texteSansBalises(texte ?? '')).normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const durees = [...base.matchAll(/(?<![\p{L}\d])(?:dure|pendant)\s+(\d+)\s+tours?(?!\p{L})/giu)];
  return durees.length === 1 ? { tours: Number(durees[0][1]) } : null;
}

// Découpages des cellules des onglets « Armures » et « Bouclier » (Google Sheet « Ressources et Craft ») : ce que la base tire du texte d'une armure, d'un
// bouclier, d'une forme de bouclier, d'un poids, d'une pièce d'armure (tableau FABRICATION) et d'une amélioration d'armure ou de bouclier. Le service
// d'édition du site de dev (serveur/edition-armures.mjs) recalcule ces colonnes à chaque modification ; test/armure-champs.test.mjs rejoue chaque
// découpage sur toute la base (un changement du découpage doit redonner la base, sinon une migration). Rien n'est réécrit : un texte que le découpage ne
// lit pas donne NULL (« ???? » pour un prix, « Aucune » pour des stats).
// Sens inverse depuis la demande du propriétaire du 2026-10-17 (« C'est en base que les deux devraient être séparées et donc éditable aussi ») : l'AP et
// l'AM d'une armure et d'un bouclier, et les quatre cases d'une amélioration de bouclier (coût en RO, coût en matériaux, AP, cran), sont les valeurs
// saisies ; la défense écrite et le coût et l'effet écrits d'une amélioration de bouclier en sont refaits (defenseEcrite, textesDeBouclierEcrits),
// gardés tels qu'écrits tant qu'ils se lisent exactement en ces valeurs (defenseExacte, ameliorationDeBouclierExacte).
// Une case se lit sans les balises du glossaire des mots-clés (lib/mots-cles-balises.mjs : « {{id|texte}} » se lit « texte »).
// Fonctions pures (imports : lib/text.mjs, lib/mots-cles-balises.mjs).
import { texteSansBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';

/** Types d'une armure (armure.type) : ceux de la grille (Léger, Intermédiaire, Lourd) et des armures particulières (Vêtement, Familier). */
export const TYPES_D_ARMURE = ['Vêtement', 'Léger', 'Intermédiaire', 'Lourd', 'Familier'];

/** Les types de dégâts d'une résistance ou d'une faiblesse, comme ceux des armes (lib/arme-champs.mjs). */
const DEGATS = { taille: 'taille', estoc: 'estoc', frappe: 'frappe' };

/**
 * Un nombre écrit dans une case (« 2 050 », « 1,5 », « 1207,5 », « 100.0 ») ; null si la case n'est pas un nombre (« ???? », vide).
 */
export function nombreEcrit(texte) {
  const t = String(texteSansBalises(texte ?? '')).replace(/[\s  ]/g, '').replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

/**
 * L'armure physique et magique d'une case « Stats » ou « Défense » (« +10AP +14AM », « +13AP+12AM », « +2AM », « Aucune ») : { ap, am }, chacune null
 * quand elle n'est pas écrite (la fiche compte alors 0). C'est la lecture de l'import et de l'ancien service d'édition, large (le reste de la case est
 * ignoré) : defenseExacte en tire ses valeurs, après avoir vérifié que la case ne dit rien d'autre, si bien que les deux lectures ne divergent jamais.
 */
export function statsDeProtection(texte) {
  const t = String(texteSansBalises(texte ?? ''));
  const ap = /([+-]?\d+)\s*AP\b/i.exec(t);
  const am = /([+-]?\d+)\s*AM\b/i.exec(t);
  return { ap: ap ? Number(ap[1]) : null, am: am ? Number(am[1]) : null };
}

/** Un terme de défense, tel que statsDeProtection le lit : « +10AP », « -2 am ». */
const TERME_DE_DEFENSE = /([+-]?\d+)\s*(AP|AM)\b/gi;

/**
 * La défense écrite (`armure.stats_brut`, `bouclier.defense_brut`, `materiau_armure.stats_brut`, `materiau_bouclier.stats_brut`) qui se lit EXACTEMENT
 * en AP et en AM : « Aucune » ({ ap: null, am: null }), ou un « ±N AP » et / ou un « ±N AM », chacun une fois, dans un ordre ou dans l'autre, séparés
 * par des espaces, des virgules ou des points-virgules (« +13AP+12AM », « +5AP, +6AM ») ; null pour toute autre écriture (un mot de plus, un signe
 * détaché, un terme répété, « +2AP/+2AM », une case vide, une balise du glossaire) : elle ne se réduit pas à deux nombres. Les valeurs sont celles de
 * statsDeProtection (la lecture de l'import et de l'ancien service) : une défense exacte se lit de la même façon par les deux.
 */
export function defenseExacte(texte) {
  const t = String(texte ?? '').trim();
  if (t.includes('{{')) return null;
  if (/^aucune$/i.test(t)) return { ap: null, am: null };
  const unites = [...t.matchAll(TERME_DE_DEFENSE)].map((m) => m[2].toUpperCase());
  if (!unites.length || new Set(unites).size !== unites.length) return null;
  if (!/^[\s,;]*$/.test(t.replace(TERME_DE_DEFENSE, ' '))) return null;
  return statsDeProtection(t);
}

/** La défense écrite depuis l'AP et l'AM (demande du propriétaire, 2026-10-17 : deux valeurs séparées) : « +10AP +14AM », « +2AM », « Aucune ». */
export function texteDeLaDefense(ap, am) {
  const terme = (n, unite) => (n === null || n === undefined ? null : `${n < 0 ? '-' : '+'}${Math.abs(n)}${unite}`);
  return [terme(ap, 'AP'), terme(am, 'AM')].filter(Boolean).join(' ') || 'Aucune';
}

/**
 * La défense écrite d'une armure ou d'un bouclier après une modification de son AP ou de son AM (les deux colonnes saisies : demande du propriétaire,
 * 2026-10-17 ; le texte en est refait, jamais saisi) : `ancienne` telle qu'écrite si elle se lit exactement en ces AP et AM (l'écriture de la source,
 * « +13AP+12AM », reste), sinon refaite (texteDeLaDefense).
 */
export function defenseEcrite(ap, am, ancienne) {
  const lue = defenseExacte(ancienne);
  return lue && lue.ap === (ap ?? null) && lue.am === (am ?? null) ? ancienne : texteDeLaDefense(ap, am);
}

/**
 * Les résistances et faiblesses d'une armure (« x2 Frappe », « Estoc/Taille », « Taille/Frappe ») : une ligne par type de dégâts, { sens, sens_brut,
 * type_degats, multiplicateur } (« x2 » vaut pour chaque type de la case ; sans « x2 », null). Une case vide n'en donne aucune.
 */
export function degatsDeLArmure(resistanceBrut, faiblesseBrut) {
  const lignes = [];
  for (const [texte, sens, sensBrut] of [[resistanceBrut, 'resistance', 'Résistance'], [faiblesseBrut, 'vulnerabilite', 'Faiblesse']]) {
    const t = String(texteSansBalises(texte ?? '')).trim();
    if (!t) continue;
    const x = /^x\s*(\d+)\s*/i.exec(t);
    for (const mot of t.slice(x ? x[0].length : 0).split('/')) {
      const type = DEGATS[normalize(mot)];
      if (type && !lignes.some((l) => l.sens === sens && l.type_degats === type)) {
        lignes.push({ sens, sens_brut: sensBrut, type_degats: type, multiplicateur: x ? Number(x[1]) : null });
      }
    }
  }
  return lignes;
}

/**
 * Les colonnes d'une armure tirées de ses cases : clé du nom, prix (« ???? » : null) et la défense écrite, refaite depuis l'AP et l'AM (defenseEcrite :
 * `ligne.stats_brut` est la défense écrite d'avant la modification).
 */
export function colonnesDeLArmure(ligne) {
  return { nom_cle: normalize(ligne.nom), prix: nombreEcrit(ligne.prix_brut), stats_brut: defenseEcrite(ligne.ap, ligne.am, ligne.stats_brut) };
}

/** Les colonnes d'un bouclier préfabriqué tirées de ses cases : prix (vide : null) et la défense écrite, refaite depuis l'AP et l'AM (defenseEcrite). */
export function colonnesDuBouclier(ligne) {
  return { prix: nombreEcrit(ligne.prix_brut), defense_brut: defenseEcrite(ligne.ap, ligne.am, ligne.defense_brut) };
}

/** Le prix d'une forme (classe) de bouclier : « 2,5 » → 2.5 ; null si ce n'est pas un nombre. */
export const prixDeLaForme = (prixBrut) => nombreEcrit(prixBrut);

/** La Force minimum d'un poids de bouclier : le premier nombre de « 1 de Force minimum » ; null sans nombre. */
export function forceDuPoids(forceBrut) {
  const m = /\d+/.exec(String(texteSansBalises(forceBrut ?? '')));
  return m ? Number(m[0]) : null;
}

/**
 * Le coût d'une pièce d'armure (tableau FABRICATION), en Ricken de fer : « 1 000 RF / 10 RO » → 1000, « 100 RF / 1 R0 » → 100 ; null pour « 250 RF /
 * Classe » (le coût dépend de la classe du bouclier) ou sans montant en RF.
 */
export function coutDeLaPiece(coutBrut) {
  const t = String(texteSansBalises(coutBrut ?? ''));
  if (/\/\s*classe/i.test(t)) return null;
  const m = /(\d[\d\s  ]*)\s*RF\b/i.exec(t);
  return m ? Number(m[1].replace(/[\s  ]/g, '')) : null;
}

/**
 * Une amélioration d'armure ou de bouclier (tableau AMÉLIORATION des onglets) : { cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }.
 *   - le coût : « 100 », « 100 + 1 Matériau », « 1000 » (RO : en-tête « Coût(RO) ») — les nombres d'un terme sans « Matériau » font le RO, un terme
 *     « N Matériau(x) » les matériaux ;
 *   - l'effet : « +2 AP/AM » (l'AP et l'AM), « +2 AP, +1 cran de solidité », « +4 AP + matériaux » ; dans l'effet d'une amélioration de bouclier,
 *     « + N matériaux » compte N matériaux et « + matériaux » écrit sans nombre en compte 1 (décision R76).
 * Une valeur que le texte n'écrit pas est null (0 matériau aussi).
 */
export function analyserAmeliorationDeProtection(cible, coutBrut, effetBrut) {
  let ro = null;
  let materiaux = null;
  for (const terme of String(texteSansBalises(coutBrut ?? '')).split('+')) {
    const nombre = /\d[\d\s  ]*(?:[.,]\d+)?/.exec(terme);
    if (/mat[ée]ri(?:el|au)/i.test(terme)) materiaux = (materiaux ?? 0) + (nombre ? Number(nombre[0].replace(/[\s  ]/g, '')) : 1);
    else if (nombre) ro = (ro ?? 0) + nombreEcrit(nombre[0]);
  }
  const effet = String(texteSansBalises(effetBrut ?? ''));
  if (cible === 'bouclier') {
    // « + matériaux » (sans nombre : 1, décision R76), « + 2 matériaux » (2)
    for (const m of effet.matchAll(/\+\s*(\d+)?\s*mat[ée]ri(?:aux?|els?)\b/gi)) materiaux = (materiaux ?? 0) + (m[1] ? Number(m[1]) : 1);
  }
  const ap = /([+-]\d+)\s*AP\b/i.exec(effet);
  const am = /([+-]\d+)\s*(?:AP\s*\/\s*)?AM\b/i.exec(effet);
  const cran = /([+-]\d+)\s*crans? de solidité/i.exec(effet);
  return {
    cout_ro: ro === null ? null : Math.round(ro),
    // « 0 Matériau » : pas de matériau (la colonne n'admet que 1 et plus)
    cout_materiaux: materiaux || null,
    bonus_ap: ap ? Number(ap[1]) : null,
    bonus_am: am ? Number(am[1]) : null,
    bonus_cran: cran ? Number(cran[1]) : null,
  };
}

/**
 * Les cases d'une amélioration de bouclier, chacune modifiable sur le site de dev (demande du propriétaire, 2026-10-17 : « Le +1matériaux devrai être
 * dans le cout (une 2e collonne cout matériaux boolean) Les effet séparés en deux autres colones aussi, Valeur d'AP supplémentaire, et Solidité + 1 ou
 * non ») : le coût en RO, le coût en matériaux (oui : 1 matériau de la matière du bouclier, décision R76 ; non : NULL), l'AP supplémentaire, le cran de
 * solidité (oui : 1 ; non : NULL). Le coût et l'effet écrits (`cout_brut`, `effet_brut`) en sont refaits (textesDeLAmeliorationDeBouclier), jamais
 * saisis. Les améliorations d'arme et d'armure gardent leur coût et leur effet écrits comme cases.
 */
export const CASES_D_AMELIORATION_DE_BOUCLIER = ['cout_ro', 'cout_materiaux', 'bonus_ap', 'bonus_cran'];

/** Un montant de RO écrit entier (« 1000 », « 1 000 », « 100.0 ») : le nombre ; null sinon (« 100,5 » ne se réduit pas à des RO entiers). */
const roEntier = (texte) => {
  const m = /^(\d[\d\s  ]*)(?:[.,]0+)?(?:\s*R[Oo])?$/.exec(texte);
  return m ? Number(m[1].replace(/[\s  ]/g, '')) : null;
};

/** Les termes d'un effet d'amélioration de bouclier, tels que analyserAmeliorationDeProtection les lit (l'AP, le cran, « + matériaux » : R76). */
const TERMES_D_EFFET = { ap: /([+-]\d+)\s*AP\b/gi, cran: /([+-]\d+)\s*crans? de solidité/gi, materiaux: /\+\s*(\d+)?\s*mat[ée]ri(?:aux?|els?)\b/gi };

/**
 * Le coût et l'effet écrits d'une amélioration de bouclier qui se lisent EXACTEMENT dans ses cases (CASES_D_AMELIORATION_DE_BOUCLIER) : { cout_ro,
 * cout_materiaux, bonus_ap, bonus_am (toujours null : la case n'existe pas pour un bouclier), bonus_cran } ; null sinon. Le coût : un seul montant de
 * RO entier, et au plus « + 1 Matériau » (« Matériau » sans nombre aussi) ; l'effet : « ±N AP », « +1 cran de solidité », « + matériaux » (sans nombre,
 * ou 1 : décision R76), chacun au plus une fois, séparés par des espaces, des virgules ou des points-virgules, ou « Aucun ». Ne se réduisent pas : un
 * mot de plus, un signe détaché (« + 2 AP »), « solidite » sans accent, des espaces doublés, une AM ou « AP/AM », plus d'un cran, plus d'un matériau en
 * tout (coût et effet), un RO absent, répété ou décimal, une balise du glossaire. Les valeurs sont celles d'analyserAmeliorationDeProtection (la lecture
 * de l'import et de l'ancien service, que test/armure-champs.test.mjs rejoue sur la base) : un texte exact se lit de la même façon par les deux.
 */
export function ameliorationDeBouclierExacte(coutBrut, effetBrut) {
  const cout = String(coutBrut ?? '').trim();
  const effet = String(effetBrut ?? '').trim();
  if (cout.includes('{{') || effet.includes('{{')) return null;
  let montants = 0;
  for (const terme of cout.split('+').map((t) => t.trim())) {
    if (/^(?:\d+\s*)?mat[ée]ri(?:els?|aux?)$/i.test(terme)) continue;
    if (roEntier(terme) === null) return null;
    montants += 1;
  }
  if (montants !== 1) return null;
  if (!/^(?:aucun|aucune|rien)$/i.test(effet)) {
    if ([TERMES_D_EFFET.ap, TERMES_D_EFFET.cran].some((r) => [...effet.matchAll(r)].length > 1)) return null;
    const reste = Object.values(TERMES_D_EFFET).reduce((t, r) => t.replace(r, ' '), effet);
    if (!/^[\s,;]*$/.test(reste)) return null;
  }
  const a = analyserAmeliorationDeProtection('bouclier', cout, effet);
  if (a.cout_ro === null || a.bonus_am !== null || (a.cout_materiaux ?? 0) > 1 || (a.bonus_cran !== null && a.bonus_cran !== 1)) return null;
  return { cout_ro: a.cout_ro, cout_materiaux: a.cout_materiaux, bonus_ap: a.bonus_ap, bonus_am: null, bonus_cran: a.bonus_cran };
}

/**
 * Le coût et l'effet écrits d'une amélioration de bouclier, refaits depuis ses cases : « 100 + 1 Matériau » (le coût en matériaux passe du côté du coût,
 * comme pour une armure : demande du propriétaire, 2026-10-17) et « +2 AP, +1 cran de solidité » (« Aucun » sans AP ni cran).
 */
export function textesDeLAmeliorationDeBouclier({ cout_ro: ro, cout_materiaux: mat, bonus_ap: ap, bonus_cran: cran }) {
  const cout = [ro === null || ro === undefined ? null : String(ro), mat ? `${mat} Matériau${mat > 1 ? 'x' : ''}` : null].filter(Boolean).join(' + ');
  const effet = [
    ap === null || ap === undefined ? null : `${ap < 0 ? '-' : '+'}${Math.abs(ap)} AP`,
    cran ? `+${cran} cran${cran > 1 ? 's' : ''} de solidité` : null,
  ].filter(Boolean).join(', ');
  return { cout_brut: cout || 'Aucun', effet_brut: effet || 'Aucun' };
}

/**
 * Le coût et l'effet écrits d'une amélioration de bouclier après une modification de ses cases (`cases` : { cout_ro, cout_materiaux, bonus_ap,
 * bonus_cran }) : ceux d'avant (`avant` : { cout_brut, effet_brut }) tels qu'écrits s'ils se lisent exactement en ces cases (l'écriture de la source,
 * « +4 AP + matériaux », reste), sinon refaits (textesDeLAmeliorationDeBouclier).
 */
export function textesDeBouclierEcrits(cases, avant) {
  const lue = ameliorationDeBouclierExacte(avant?.cout_brut, avant?.effet_brut);
  const memes = lue && CASES_D_AMELIORATION_DE_BOUCLIER.every((c) => lue[c] === (cases[c] ?? null));
  return memes ? { cout_brut: avant.cout_brut, effet_brut: avant.effet_brut } : textesDeLAmeliorationDeBouclier(cases);
}

/** Un nombre écrit à la française, par milliers (« 1 300 »). */
const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * La ligne TOTAL du tableau des améliorations d'une cible, refaite depuis ses niveaux, dans la forme de l'onglet : armures « 1 300 Ro + 2 Matériaux »,
 * boucliers « 1550 » (les RO seuls, comme l'onglet : ses « + matériaux » sont écrits dans l'effet ; la page compte leurs matériaux à part, décision R76).
 */
export function totalDesAmeliorationsDeProtection(cible, niveaux) {
  const ro = niveaux.reduce((s, n) => s + (n.cout_ro ?? 0), 0);
  const mat = niveaux.reduce((s, n) => s + (n.cout_materiaux ?? 0), 0);
  if (cible === 'armure') return `${milliers(ro)} Ro${mat ? ` + ${mat} Matériau${mat > 1 ? 'x' : ''}` : ''}`;
  return String(ro);
}

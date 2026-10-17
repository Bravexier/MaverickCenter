// Découpages des cellules des onglets « Armures » et « Bouclier » (Google Sheet « Ressources et Craft ») : ce que la base tire du texte d'une armure, d'un
// bouclier, d'une forme de bouclier, d'un poids, d'une pièce d'armure (tableau FABRICATION) et d'une amélioration d'armure ou de bouclier. Le service
// d'édition du site de dev (serveur/edition-armures.mjs) recalcule ces colonnes à chaque modification ; test/armure-champs.test.mjs rejoue chaque
// découpage sur toute la base (un changement du découpage doit redonner la base, sinon une migration). Rien n'est réécrit : un texte que le découpage ne
// lit pas donne NULL (« ???? » pour un prix, « Aucune » pour des stats).
// Sens inverse depuis la demande du propriétaire du 2026-10-17 (« C'est en base que les deux devraient être séparées et donc éditable aussi ») : l'AP et
// l'AM d'une armure et d'un bouclier sont les valeurs saisies ; la défense écrite en est refaite (defenseEcrite), gardée telle qu'écrite tant qu'elle se
// lit exactement en ces valeurs (defenseExacte).
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
 * quand elle n'est pas écrite (la fiche compte alors 0). Lecture large (le reste de la case est ignoré) ; defenseExacte dit si la case ne dit rien d'autre.
 */
export function statsDeProtection(texte) {
  const t = String(texteSansBalises(texte ?? ''));
  const ap = /([+-]?\d+)\s*AP\b/i.exec(t);
  const am = /([+-]?\d+)\s*AM\b/i.exec(t);
  return { ap: ap ? Number(ap[1]) : null, am: am ? Number(am[1]) : null };
}

/**
 * La défense écrite (`armure.stats_brut`, `bouclier.defense_brut`, `materiau_armure.stats_brut`, `materiau_bouclier.stats_brut`) qui se lit EXACTEMENT
 * en AP et en AM : « Aucune » ({ ap: null, am: null }), ou un « ±N AP » et / ou un « ±N AM », chacun une fois, dans un ordre ou dans l'autre, espaces
 * libres (« +13AP+12AM ») ; null pour toute autre écriture (un mot de plus, un terme répété, une case vide) : elle ne se réduit pas à deux nombres.
 */
export function defenseExacte(texte) {
  let reste = String(texteSansBalises(texte ?? '')).trim();
  if (/^aucune$/i.test(reste)) return { ap: null, am: null };
  const lue = { ap: null, am: null };
  let termes = 0;
  while (reste) {
    const m = /^([+-]?\d+)\s*(AP|AM)(?![\p{L}\d])\s*/iu.exec(reste);
    if (!m) return null;
    const cle = m[2].toLowerCase();
    if (lue[cle] !== null) return null;
    lue[cle] = Number(m[1]);
    reste = reste.slice(m[0].length);
    termes += 1;
  }
  return termes ? lue : null;
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

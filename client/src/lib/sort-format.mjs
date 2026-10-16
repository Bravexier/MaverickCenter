// Mise en forme des données d'une magie et de ses sorts pour l'affichage (components/Magie*.astro). Fonctions pures, sans dépendance
// Astro ni navigateur. Les données viennent de la base (lib/magies-db.mjs) : ici on ne lit aucun Markdown.
//
// Règle : on change la FORME, jamais le fond. Un entier écrit « 4.0 » s'affiche « 4 », une liste « Feu, Glace » s'affiche en éléments
// séparés (jamais de virgules), un texte entre parenthèses (« +1/NM ») passe en petit ; le texte lui-même n'est pas réécrit.
import { normalize } from './text.mjs';

/** Lignes d'un texte de cellule : une par retour à la ligne, lignes vides écartées. */
export const lignes = (texte) =>
  String(texte ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');

/**
 * Blocs d'un texte de cellule ou de bloc long : un paragraphe par ligne vide, une liste quand des lignes commencent par « - ».
 * [{ liste: false, texte }, { liste: true, items }, { titre: true, texte }] ; dans un paragraphe, les retours à la ligne de la source sont
 * conservés. Une ligne « ▸ Titre » est un intertitre.
 */
export function blocsDeTexte(texte) {
  const blocs = [];
  for (const paragraphe of String(texte ?? '').split(/\r?\n[ \t]*\r?\n/)) {
    let courant = null;
    for (const ligne of paragraphe.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '')) {
      const puce = /^[-•]\s+(.*)$/.exec(ligne);
      const titre = /^▸\s*(.*)$/.exec(ligne);
      if (titre) {
        blocs.push({ titre: true, texte: titre[1] });
        courant = null;
      } else if (puce) {
        if (!courant?.liste) blocs.push((courant = { liste: true, items: [] }));
        courant.items.push(puce[1]);
      } else if (courant && !courant.liste) courant.texte += `\n${ligne}`;
      else blocs.push((courant = { liste: false, texte: ligne }));
    }
  }
  // des puces séparées par une ligne vide restent une seule liste
  return blocs.reduce((out, b) => {
    const precedent = out.at(-1);
    if (b.liste && precedent?.liste) precedent.items.push(...b.items);
    else out.push(b);
    return out;
  }, []);
}

/** « 4.0 » → « 4 » : le classeur écrit certains entiers avec une décimale ; tout autre texte est rendu tel quel. */
export const nombre = (texte) => String(texte).replace(/^(-?\d+)\.0+$/, '$1');

const premiereMajuscule = (s) => (s ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s);

/**
 * Coupe un texte en morceaux, les groupes `( … )` étant marqués `modif` (précisions : « +1/NM », « 3NM = … »).
 * Une parenthèse collée à un mot (« cible(s) ») fait partie du texte : seul un groupe en début de texte ou après une espace est une précision.
 */
export function segments(texte) {
  return String(texte)
    .split(/((?<=^|\s)\([^()]*\))/)
    .map((morceau) => {
      const m = /^\(([^()]*)\)$/.exec(morceau);
      return m ? { texte: m[1].trim(), modif: true } : { texte: morceau.trim(), modif: false };
    })
    .filter((s) => s.texte !== '');
}

/** Coupe une ligne sur les virgules suivies d'une espace, hors guillemets et parenthèses (« +6 AP, +8 dégâts » → deux éléments). */
function couperVirgules(ligne) {
  const parts = [];
  let courante = '';
  let profondeur = 0;
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') guillemets = !guillemets;
    else if (!guillemets && c === '(') profondeur++;
    else if (!guillemets && c === ')') profondeur = Math.max(0, profondeur - 1);
    if (c === ',' && !guillemets && profondeur === 0 && /\s/.test(ligne[i + 1] ?? '')) {
      parts.push(courante.trim());
      courante = '';
    } else courante += c;
  }
  parts.push(courante.trim());
  return parts.filter(Boolean);
}

/**
 * Valeur courte d'une cellule (portée, zone, D/S/B) : `vide` quand la cellule est absente ou vaut « / ».
 * `liste: true` (colonne D/S/B) : une cellule qui énumère des bonus (« +8 dégâts, +2AM ») donne un élément par bonus, sans virgule
 * (une virgule en tête ou en queue, reste d'un copier-coller du classeur, est écartée).
 */
export function valeurDeSort(brut, { liste = false } = {}) {
  let l = lignes(brut).map(nombre);
  if (liste) l = l.flatMap((ligne) => couperVirgules(ligne.replace(/^[,;\s]+|[,;\s]+$/g, ''))).filter((x) => x !== '');
  if (l.length === 0 || (l.length === 1 && l[0] === '/')) return { vide: true, lignes: [] };
  return { vide: false, lignes: l.map(segments) };
}

/** Coût : « 10 + 4 Sang » → principal « 10 » et supplément « 4 Sang » ; les parenthèses sont des précisions (« -1/NM »). */
export function coutDeSort(brut) {
  const texte = lignes(brut).map(nombre).join(' ');
  if (texte === '' || texte === '/') return { vide: true, parts: [] };
  return { vide: false, parts: texte.split(/\s+\+\s+/).map(segments) };
}

/**
 * Marques du MODE d'un sort (IC, imparable, inesquivable), lues dans la table sort_mode : le mode est séparé du type, et un mode qui dépend
 * d'un niveau de maîtrise (« IC pour 3 NM ») n'est pas ici mais dans les bonus de maîtrise.
 * @param {{ mode: string, libelle: string }[]} modes
 */
export const marquesDeMode = (modes) => modes.map((m) => ({ texte: premiereMajuscule(m.libelle), genre: m.mode }));

/** Éléments d'un texte d'effets : un par ligne et un par virgule (jamais de liste séparée par des virgules à l'affichage). */
export const elementsDeTexte = (texte) => lignes(texte).flatMap(couperVirgules);

/**
 * Morceaux d'un texte : { texte } ou { lien } (adresse nue). La ponctuation finale et une parenthèse fermante en trop
 * (« (voir https://x.fr/a.) ») ne font pas partie du lien.
 */
export function morceauxAvecLiens(texte) {
  const out = [];
  let dernier = 0;
  for (const m of String(texte).matchAll(/https?:\/\/[^\s<>"]+/g)) {
    let lien = m[0];
    const compte = (c) => lien.split(c).length - 1;
    for (;;) {
      if (/[.,;:!?]$/.test(lien) || (lien.endsWith(')') && compte(')') > compte('('))) lien = lien.slice(0, -1);
      else break;
    }
    if (m.index > dernier) out.push({ texte: texte.slice(dernier, m.index) });
    out.push({ lien });
    dernier = m.index + lien.length;
  }
  if (dernier < texte.length) out.push({ texte: texte.slice(dernier) });
  return out;
}

const echapperRegExp = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Écritures qui varient entre le texte d'un sort et l'extrait de sa table sort_etat : guillemets français ou anglais, espaces insécables.
// Un caractère pour un caractère : les positions restent celles du texte d'origine.
const pourComparer = (texte) => String(texte).replace(/[«»“”]/g, '"').replace(/[\u00a0\u202f]/g, ' ');

/**
 * Découpe un texte en morceaux { texte } ou { texte, etat } : l'altération d'état repérée dans ce texte (table sort_etat, un index dérivé du texte)
 * devient une pastille PLACÉE DANS LE TEXTE, sur le mot même que la source écrit (« brûlure » dans « Inflige brûlure 1 »), au lieu d'être signalée à part.
 * `restantes` : les lignes { forme, extrait } d'états pas encore placées ; celles qui trouvent leur place dans ce texte en sont retirées (le même état
 * n'est jamais placé deux fois, et on peut appeler la fonction texte après texte).
 */
export function morceauxAvecEtats(texte, restantes) {
  const T = String(texte);
  const N = pourComparer(T);
  // une balise du glossaire des mots-clés (« {{id|texte}} », lib/mots-cles-balises.mjs) reste entière : aucune pastille n'y est placée
  const places = [...T.matchAll(/\{\{[^{}\n]*\}\}/g)].map((m) => [m.index, m.index + m[0].length, null]);
  const balises = places.length;
  for (const r of [...restantes]) {
    const debut = N.indexOf(pourComparer(r.extrait));
    if (debut < 0) continue;
    const zone = N.slice(debut, debut + r.extrait.length);
    // le mot lui-même, entre deux non-lettres : « gel » n'est pas cherché dans « dégelé », et les blancs de la forme (espaces insécables
    // laissés par la source autour de « Couardise ») restent dans le texte, hors de la pastille
    const forme = pourComparer(r.forme).trim();
    if (!forme) continue;
    const re = new RegExp(`(?<![\\p{L}])${echapperRegExp(forme)}(?![\\p{L}])`, 'giu');
    for (let m = re.exec(zone); m; m = re.exec(zone)) {
      const a = debut + m.index;
      const b = a + m[0].length;
      if (places.some(([x, y]) => a < y && b > x)) continue;
      places.push([a, b, r]);
      restantes.splice(restantes.indexOf(r), 1);
      break;
    }
  }
  places.splice(0, balises);
  places.sort((x, y) => x[0] - y[0]);
  const out = [];
  let dernier = 0;
  for (const [a, b, r] of places) {
    if (a > dernier) out.push({ texte: T.slice(dernier, a) });
    out.push({ texte: T.slice(a, b), etat: r });
    dernier = b;
  }
  if (dernier < T.length || out.length === 0) out.push({ texte: T.slice(dernier) });
  return out;
}


/**
 * Contenu de l'infobulle d'une altération d'état : son type, sa ou ses magies liées, l'effet de chaque stade (le stade cité dans le texte est mis en avant).
 * @param {{ nom: string, typeBrut: string, magiesLiees: { nom: string }[], stades: { stade: number | null, effet: string }[] }} etat
 * @param {number | null} [stade] stade écrit dans le texte du sort (« brûlure 2 » → 2)
 */
export function infobulleDEtat(etat, stade = null) {
  const sous = [etat.typeBrut];
  if (etat.magiesLiees.length) sous.push(`Magie liée : ${etat.magiesLiees.map((m) => m.nom).join(' / ')}`);
  return {
    titre: etat.nom,
    sous,
    stades: etat.stades.map((s) => ({ libelle: s.stade ? `Stade ${s.stade}` : 'Tous les stades', effet: s.effet, actif: s.stade !== null && s.stade === stade })),
  };
}

/** Sorts regroupés par niveau de puissance magique (NPM), du plus faible au plus fort : [{ niveau, sorts }]. */
export function sortsParNpm(sorts) {
  const niveaux = [...new Set(sorts.map((s) => s.niveau))].sort((a, b) => a - b);
  return niveaux.map((niveau) => ({ niveau, sorts: sorts.filter((s) => s.niveau === niveau) }));
}

/** Ancre d'un titre `## Titre` rendu par Astro (github-slugger : minuscules, accents conservés, espaces → tirets). */
export const ancreDeTitre = (titre) =>
  String(titre)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

/** Couleurs de magie, pour les pastilles et les titres de magie. */
const COULEURS = {
  feu: '#ff0000',
  eau: '#0000ff',
  glace: '#00ffff',
  terre: '#996600',
  vent: '#00ff66',
  foudre: '#ffff00',
  lumiere: '#fff2cc',
  ombre: '#cc66ff',
  sang: '#cc0000',
  vide: '#ffffff',
  arcane: '#b7b7b7',
  corruption: '#000000',
  necromancie: '#274e13',
  'espace-temps': '#ff66cc',
  'potentiel-illimite': '#ff9900',
};

export const COULEUR_PAR_DEFAUT = '#ad5e29';
export const couleurDeMagie = (nom) => COULEURS[normalize(nom ?? '')] ?? COULEUR_PAR_DEFAUT;

export const texteSurCouleurDeMagie = (nom) => texteSurCouleur(couleurDeMagie(nom));

/** Texte lisible sur un fond de cette couleur (« #rrggbb ») : presque noir sur une couleur claire (jaune), blanc sinon. */
export function texteSurCouleur(couleur) {
  const composantes = couleur.slice(1).match(/.{2}/g).map((canal) => parseInt(canal, 16) / 255);
  const canauxLineaires = composantes.map((canal) => (canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4));
  const luminance = canauxLineaires[0] * 0.2126 + canauxLineaires[1] * 0.7152 + canauxLineaires[2] * 0.0722;
  return luminance > 0.179 ? '#171210' : '#ffffff';
}

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
 * Marques d'un type de sort : les parenthèses de « Attaque/ Entrave (Imparable) » (IC, imparable, inesquivable…).
 * Une barre sépare deux marques quand elle suit une lettre (« Imparable/ Inesquivable »), pas dans « IC x 1/NM ».
 * Les types eux-mêmes viennent de la table sort_type.
 */
export function marquesDeType(brut) {
  const texte = lignes(brut).join(' ');
  return [...texte.matchAll(/\(([^()]*)\)/g)]
    .map((m) => m[1])
    .flatMap((g) => g.split(/(?<=\p{L})\s*\/\s*(?=\p{L})/u))
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => {
      const cle = normalize(m);
      return {
        texte: premiereMajuscule(m),
        genre: /^IC\b/i.test(m) ? 'ic' : cle.includes('imparable') ? 'imparable' : cle.includes('inesquivable') ? 'inesquivable' : 'autre',
      };
    });
}

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

/**
 * Teinte (0-360) de la magie pour sa bannière : repère visuel, sans valeur de règle. Clé = nom court normalisé (table magie).
 * Une magie inconnue prend la teinte neutre de l'accent du site.
 */
const TEINTES = {
  feu: 14,
  eau: 208,
  glace: 190,
  terre: 32,
  vent: 160,
  foudre: 262,
  lumiere: 44,
  ombre: 272,
  sang: 350,
  vide: 232,
  arcane: 288,
  corruption: 318,
  necromancie: 124,
  'espace-temps': 176,
  'potentiel-illimite': 38,
};
export const TEINTE_PAR_DEFAUT = 24;
export const teinteDeMagie = (nom) => TEINTES[normalize(nom ?? '')] ?? TEINTE_PAR_DEFAUT;

/** Mot de l'état qui lie un sort à une altération (table sort_etat.relation) : « inflige », « prend » (jet raté), « soigne ». */
export const RELATIONS_ETAT = {
  inflige: 'Inflige',
  prend: 'Jet pour ne pas subir',
  soigne: 'Soigne',
};

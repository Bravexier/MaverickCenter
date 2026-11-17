// La liste de choix dessinée par le site (src/scripts/liste-choix.mjs) : ce qu'une touche fait dans la liste ouverte, sans le DOM. Le motif est celui
// d'une liste déroulante WAI-ARIA (`listbox`) dont l'option active a le focus réel (tabindex mobile) : components/Infobulles.astro n'ouvre au clavier
// que la bulle de l'élément qui a le focus, et chaque option montre ce qu'elle apporte en infobulle (demande du propriétaire). Module pur, importé par
// le script de la fiche seul (skill site-version-portable).

/** Le pas de Page précédente et Page suivante, en options. */
export const PAS_DE_PAGE = 10;

/** Le temps (ms) au-delà duquel une lettre tapée commence une nouvelle recherche au lieu de compléter la précédente. */
export const DELAI_DE_SAISIE = 700;

/**
 * L'option que vise une touche de déplacement dans une liste ouverte de `n` options, l'option `actif` ayant le focus (-1 : aucune) : ↓ et ↑ d'une
 * option (sans boucler, comme le motif WAI-ARIA), Début et Fin, Page suivante et Page précédente de PAS_DE_PAGE. Rend l'index, ou null quand la touche
 * ne déplace pas (ou que la liste est vide).
 */
export function optionVisee(touche, actif, n) {
  if (!Number.isInteger(n) || n <= 0) return null;
  const i = Number.isInteger(actif) && actif >= 0 && actif < n ? actif : -1;
  switch (touche) {
    case 'ArrowDown': return i < 0 ? 0 : Math.min(n - 1, i + 1);
    case 'ArrowUp': return i < 0 ? n - 1 : Math.max(0, i - 1);
    case 'Home': return 0;
    case 'End': return n - 1;
    case 'PageDown': return Math.min(n - 1, Math.max(i, 0) + PAS_DE_PAGE);
    case 'PageUp': return i < 0 ? 0 : Math.max(0, i - PAS_DE_PAGE);
    default: return null;
  }
}

/** Un libellé comparé à la frappe : sans accents ni majuscules, sans les blancs du début. */
export const pourLaSaisie = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').trimStart();

/**
 * La recherche à la frappe dans la liste ouverte (motif WAI-ARIA) : `saisie`, les caractères tapés à la suite (DELAI_DE_SAISIE entre deux) ; rend
 * l'index de l'option dont le libellé commence par eux (accents et majuscules ignorés), ou null. Une seule lettre, ou la même lettre répétée
 * (« sss »), passe à l'option suivante qui commence par cette lettre, en revenant au début après la dernière ; plusieurs lettres différentes
 * (« ver ») cherchent à partir de l'option active, qui reste choisie si elle convient encore. `libelles` : les libellés des options, dans l'ordre ;
 * `ignorees` (facultatif) : les index à sauter (options désactivées).
 */
export function optionParLettres(libelles, actif, saisie, ignorees = new Set()) {
  const s = pourLaSaisie(saisie);
  const n = libelles.length;
  if (!s || !n) return null;
  const repetee = [...s].every((c) => c === s[0]);
  const cherche = repetee ? s[0] : s;
  const depart = (Number.isInteger(actif) && actif >= 0 && actif < n ? actif : -1) + (repetee ? 1 : 0);
  for (let k = 0; k < n; k += 1) {
    const i = (Math.max(depart, 0) + k) % n;
    if (!ignorees.has(i) && pourLaSaisie(libelles[i]).startsWith(cherche)) return i;
  }
  return null;
}

/** Une touche qui écrit un caractère (une lettre, un chiffre…) sans Ctrl, Alt ni Méta : la recherche à la frappe. */
export const toucheDeSaisie = (ev) => typeof ev?.key === 'string' && [...ev.key].length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey;

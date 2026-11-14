// La couleur écrite d'un texte Markdown du site : `{couleur:<valeur>}` en tête d'une case de tableau (lib/markdown-couleurs.mjs) ou d'un intertitre
// d'onglet (lib/markdown-onglets.mjs). Demande du propriétaire : la couleur se choisit comme celle d'un mot-clé du glossaire, dans la même liste
// (lib/glossaire-couleurs.mjs : « famille:id » d'une couleur du site) ou par un cercle (« #rrggbb ») ; les sept noms d'avant (rouge, orange, jaune, vert,
// bleu, violet, gris), écrits dans les données existantes, restent lus.
//   - `{couleur:rouge}`               un des sept noms d'avant (COULEURS_DE_CASE) → la classe de la palette `couleur-case-rouge` ;
//   - `{couleur:alignement:loyal-bon}` une couleur du site → `couleur-alignement-loyal-bon` (lib/palette-css.mjs, même nom de classe que celle d'un mot-clé :
//                                     lib/mots-cles-liens.mjs#classeDuMotCle) ;
//   - `{couleur:#rrggbb}`             une couleur écrite → `couleur-ecrite-rrggbb` (la feuille en est fabriquée par lib/palette-css.mjs#cssDesCouleursEcrites).
// Un calcul de texte, sans la palette ni le DOM (le navigateur reçoit ce module) : qu'une référence existe dans la palette se contrôle à la fabrication
// des feuilles (cssDesCouleursEcrites : une référence inconnue n'a pas de règle, l'élément reste neutre). Sans import.

/**
 * Les sept noms de couleur de case d'avant : leurs noms seuls (aucune couleur ici). Leurs valeurs sont celles de lib/cases-couleurs.mjs#COULEURS_DES_CASES,
 * mêmes clés dans le même ordre (testé) ; la palette en fait une classe par couleur (famille `case`, sur chaque page).
 */
export const COULEURS_DE_CASE = ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris'];

/** Ce qu'une marque `{couleur:…}` accepte : un nom d'avant, une référence « famille:id », une couleur écrite « #rrggbb ». */
const VALEUR = '#[0-9a-fA-F]{6}|[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*|[a-z]+';
/** La marque en tête d'un texte : [marque, valeur], suivie d'au plus une espace (retirée avec elle). */
export const PREFIXE_DE_COULEUR = new RegExp(`^\\{couleur:(${VALEUR})\\}[ \\t]?`);
/** La même marque, n'importe où dans un texte (recherche, résumés, listes de couleurs d'une page). */
export const MARQUE_DE_COULEUR = new RegExp(`\\{couleur:(${VALEUR})\\}[ \\t]?`, 'g');

/**
 * La couleur écrite lue : { valeur (telle que la garde le Markdown : « #rrggbb » en minuscules), genre: 'nom' | 'reference' | 'ecrite', classe } ; null pour
 * une écriture qui n'est aucune des trois (un mot qui n'est pas un des sept noms, une écriture courte du cercle). Ne dit pas si la palette connaît la référence.
 */
export function lireLaCouleurEcrite(valeur) {
  const v = typeof valeur === 'string' ? valeur.trim() : '';
  if (COULEURS_DE_CASE.includes(v)) return { valeur: v, genre: 'nom', classe: `couleur-case-${v}` };
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    const ecrite = v.toLowerCase();
    return { valeur: ecrite, genre: 'ecrite', classe: `couleur-ecrite-${ecrite.slice(1)}` };
  }
  const m = /^([a-z]+):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(v);
  return m ? { valeur: v, genre: 'reference', classe: `couleur-${m[1]}-${m[2]}` } : null;
}

/** La classe de la palette d'une couleur écrite (« vert », « alignement:loyal-bon », « #rrggbb »), ou null si elle n'est pas lisible. */
export const classeDeLaCouleurEcrite = (valeur) => lireLaCouleurEcrite(valeur)?.classe ?? null;

/**
 * La classe qui marque une case de tableau colorée (`td.case-coloree`), avec celle de sa couleur : styles/global/wiki.css ne lit `--couleur` que sur une case
 * qui la porte (une case d'un tableau du site, qui peut porter une classe `couleur-…` pour une autre raison, n'est pas teintée).
 */
export const CLASSE_DE_CASE_COLOREE = 'case-coloree';

/** Les classes d'une case colorée (la marque, puis la classe de la palette de sa couleur) ; [] si la couleur n'est pas lisible. */
export const classesDeCase = (valeur) => {
  const classe = classeDeLaCouleurEcrite(valeur);
  return classe ? [CLASSE_DE_CASE_COLOREE, classe] : [];
};

/** La marque à écrire en tête d'un texte pour la couleur `valeur` (« {couleur:vert} »), sans espace finale ; '' si la couleur n'est pas lisible. */
export const marqueDeLaCouleur = (valeur) => {
  const lue = lireLaCouleurEcrite(valeur);
  return lue ? `{couleur:${lue.valeur}}` : '';
};

/**
 * Un texte sans sa marque de couleur de tête, et la couleur qu'elle donnait : { texte, couleur (valeur lue, ou null) }. Une marque dont la valeur n'est pas
 * lisible (un mot qui n'est pas un des sept noms) reste dans le texte, comme dans une case (lib/markdown-couleurs.mjs).
 */
export function separerLaCouleur(texte) {
  const t = String(texte ?? '');
  const m = PREFIXE_DE_COULEUR.exec(t);
  const lue = m ? lireLaCouleurEcrite(m[1]) : null;
  return lue ? { texte: t.slice(m[0].length), couleur: lue.valeur } : { texte: t, couleur: null };
}

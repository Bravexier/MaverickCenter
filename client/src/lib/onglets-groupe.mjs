// Un groupe d'onglets écrit dans un texte Markdown (demande du propriétaire : « Cette fois tu auras 2 tableaux […] un tableau à 4 onglets […] le 2e tableau
// avec les 9 onglets », et de quoi « faire manuellement ce genre de tableau et d'onglet » dans tous les menus d'édition). La syntaxe, lue par le plugin
// remark lib/markdown-onglets.mjs et écrite par l'éditeur (lib/markdown-edition.mjs) :
//
//     ::: onglets
//
//     ### {couleur:alignement:loyal-bon} {{loyal-bon}} {#loyal-bon}
//     texte…
//
//     ### Loyal
//     texte…
//
//     :::
//
// Une ligne `::: onglets`, une ligne `:::` (chacune seule dans son paragraphe, des lignes vides autour), et, entre les deux, un `###` par onglet : son texte
// nomme l'onglet, son ancre figée `{#…}` (lib/ancres-figees.mjs) est l'adresse de son panneau, la marque facultative `{couleur:…}` en tête de son texte le
// colore (lib/couleurs-ecrites.mjs : la liste des couleurs d'un mot-clé du glossaire). Le texte avant le premier `###` reste au-dessus de la barre.
// Ce module est le seul à savoir comment la barre se dessine : sa disposition (`colonnesDeLaBarre`), ses classes et le HTML d'un groupe
// (`htmlDuGroupe`, pour l'aperçu de l'éditeur : lib/markdown-edition.mjs#htmlSur), pendant, en HTML, de ce que le plugin pose dans l'arbre.
// Sans import (le service lit lib/markdown-edition.mjs, qui lit ce module) : ni DOM, ni dépendance.

/** Le texte de la ligne qui ouvre un groupe, et de celle qui le ferme. */
export const MARQUE_D_OUVERTURE = '::: onglets';
export const MARQUE_DE_FERMETURE = ':::';
/** Le niveau des intertitres qui font les onglets. */
export const NIVEAU_DES_ONGLETS = 3;

/** Les classes du groupe (la feuille : styles/guide/onglets.css). `onglet` est celle que lit le script des onglets (components/Onglets.astro). */
export const CLASSES_DES_ONGLETS = Object.freeze({
  groupe: 'onglets-md',
  liste: 'onglets-md__liste',
  onglet: 'onglets-md__onglet',
  panneau: 'onglets-md__panneau',
});
/** Le nom de la liste d'onglets (aria-label : le script le pose sur la barre). */
export const NOM_DE_LA_BARRE = 'Onglets';

/**
 * Le nombre de colonnes de la barre pour `n` onglets (demande du propriétaire : « Une rangée de 4 » pour les quatre tendances, les neuf alignements en
 * grille 3×3) : une colonne par onglet jusqu'à 4 ; au-delà, 3 colonnes si `n` est un multiple de 3, sinon 4.
 */
export function colonnesDeLaBarre(n) {
  const k = Math.max(1, Math.trunc(Number(n) || 0));
  if (k <= 4) return k;
  return k % 3 === 0 ? 3 : 4;
}

/** Les classes d'un onglet ou d'un panneau (le nom de classe de sa couleur, `couleur` : lib/couleurs-ecrites.mjs#classeDeLaCouleurEcrite) et `actif`. */
export const classesDeLOnglet = (base, classe, actif) => [base, ...(base === CLASSES_DES_ONGLETS.onglet ? ['onglet'] : []), ...(classe ? [classe] : []), ...(actif ? ['is-active'] : [])];

const ECHAPPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ECHAPPE[c]);

/**
 * La barre d'un groupe : `onglets` [{ id (celui du panneau, l'ancre), titre (le texte de l'onglet, en texte : échappé ici), classe (celle de sa couleur, ou
 * null) }] ; `actif` : l'index de l'onglet ouvert. Posée par htmlDuGroupe, et refaite par le mode modification quand un onglet change (scripts/edition/onglets.mjs).
 */
export function htmlDeLaBarre(onglets, actif = 0) {
  const ouvert = actif >= 0 && actif < onglets.length ? actif : 0;
  const liens = onglets.map((o, i) =>
    `<a class="${classesDeLOnglet(CLASSES_DES_ONGLETS.onglet, o.classe, i === ouvert).join(' ')}" id="onglet-${echapper(o.id)}" href="#${echapper(o.id)}">${echapper(o.titre)}</a>`);
  return `<nav class="${CLASSES_DES_ONGLETS.liste}" data-colonnes="${colonnesDeLaBarre(onglets.length)}" data-ed-ignorer contenteditable="false">${liens.join('')}</nav>`;
}

/**
 * Le HTML d'un groupe d'onglets : `intro` (HTML, au-dessus de la barre) ; `onglets` [{ id, titre, couleur (la valeur écrite, ou null), classe (celle de sa
 * couleur, ou null), html (le panneau : intertitre compris) }] ; `actif` (l'index de l'onglet ouvert, 0 par défaut). Le même que le plugin remark pose dans
 * l'arbre (test/markdown-onglets.test.mjs les compare).
 */
export function htmlDuGroupe({ intro = '', onglets, actif = 0 }) {
  const ouvert = actif >= 0 && actif < onglets.length ? actif : 0;
  const panneaux = onglets.map((o, i) =>
    `<section class="${classesDeLOnglet(CLASSES_DES_ONGLETS.panneau, o.classe, i === ouvert).join(' ')}" id="${echapper(o.id)}"${o.couleur ? ` data-couleur="${echapper(o.couleur)}"` : ''}>${o.html}</section>`);
  return `<div class="${CLASSES_DES_ONGLETS.groupe}" data-onglets-md data-onglets="${NOM_DE_LA_BARRE}">${intro}${htmlDeLaBarre(onglets, ouvert)}${panneaux.join('')}</div>`;
}

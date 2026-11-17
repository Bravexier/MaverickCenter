// Couleur d'une case de tableau dans le Markdown des pages (demande du propriétaire : les cases du guide et leur couleur se modifient depuis le site de
// dev) : une case qui commence par « {couleur:x} » est rendue avec l'attribut data-couleur="x" (la valeur, que relit l'éditeur) et la classe de la palette
// (lib/couleurs-ecrites.mjs : « couleur-case-vert » pour un des sept noms d'avant, « couleur-alignement-loyal-bon » pour une couleur du site,
// « couleur-ecrite-c0392b » pour une couleur écrite ; la feuille : lib/palette-css.mjs, que lit styles/global/wiki.css), sans ce préfixe. La liste des couleurs
// est celle d'un mot-clé du glossaire (demande du propriétaire : « Pour les couleurs il faudra reprendre la liste des couleurs de l'édition des mots clés du
// glossaire »).
// lib/markdown-edition.mjs l'écrit, ce plugin remark le lit (astro.config.mjs, lib/guide-rendu.ts). Seules les valeurs lisibles (lib/couleurs-ecrites.mjs)
// sont reconnues : tout autre texte entre accolades reste tel quel. Sans dépendance (ni la palette : le nom de la classe vient de lib/couleurs-ecrites.mjs).
import { classesDeCase, CLASSE_DE_CASE_COLOREE, PREFIXE_DE_COULEUR, separerLaCouleur } from './couleurs-ecrites.mjs';

/** Plugin remark : pose data-couleur et la classe de la palette sur les cases qui commencent par « {couleur:x} ». */
export function remarkCouleursDeCase() {
  const marquer = (cellule) => {
    const premier = cellule.children?.[0];
    if (premier?.type !== 'text' || !PREFIXE_DE_COULEUR.test(premier.value)) return;
    const { texte, couleur } = separerLaCouleur(premier.value);
    if (!couleur) return;
    premier.value = texte;
    if (!premier.value) cellule.children.shift();
    const proprietes = cellule.data?.hProperties ?? {};
    const autres = [proprietes.className ?? []].flat().filter((c) => c !== CLASSE_DE_CASE_COLOREE && !/^couleur-/.test(String(c)));
    cellule.data = { ...cellule.data, hProperties: { ...proprietes, 'data-couleur': couleur, className: [...autres, ...classesDeCase(couleur)] } };
  };
  const parcourir = (noeud) => {
    if (noeud.type === 'tableCell') marquer(noeud);
    for (const enfant of noeud.children ?? []) parcourir(enfant);
  };
  return (arbre) => parcourir(arbre);
}

// Couleur d'une case de tableau dans le Markdown des pages (demande du propriétaire : les cases du guide et leur couleur se modifient depuis le site de
// dev) : une case qui commence par « {couleur:vert} » est rendue avec l'attribut data-couleur="vert" (le nom, que relit l'éditeur) et la classe de la
// palette « couleur-case-vert » (lib/palette-css.mjs, famille `case` : la couleur, que lit styles/global/wiki.css), sans ce préfixe.
// lib/markdown-edition.mjs l'écrit, ce plugin remark le lit (astro.config.mjs, lib/guide-rendu.ts). Seules les couleurs de COULEURS_DE_CASE sont
// reconnues : tout autre texte entre accolades reste tel quel. Sans dépendance (ni la palette : le nom de la classe vient de markdown-edition.mjs).
import { COULEURS_DE_CASE, classeDeCouleurDeCase } from './markdown-edition.mjs';

const PREFIXE = /^\{couleur:([a-z]+)\}[ \t]?/;

/** Plugin remark : pose data-couleur et la classe de la palette sur les cases qui commencent par « {couleur:x} ». */
export function remarkCouleursDeCase() {
  const marquer = (cellule) => {
    const premier = cellule.children?.[0];
    if (premier?.type !== 'text') return;
    const m = PREFIXE.exec(premier.value);
    if (!m || !COULEURS_DE_CASE.includes(m[1])) return;
    premier.value = premier.value.slice(m[0].length);
    if (!premier.value) cellule.children.shift();
    const proprietes = cellule.data?.hProperties ?? {};
    const autres = [proprietes.className ?? []].flat().filter((c) => !String(c).startsWith('couleur-case-'));
    cellule.data = { ...cellule.data, hProperties: { ...proprietes, 'data-couleur': m[1], className: [...autres, classeDeCouleurDeCase(m[1])] } };
  };
  const parcourir = (noeud) => {
    if (noeud.type === 'tableCell') marquer(noeud);
    for (const enfant of noeud.children ?? []) parcourir(enfant);
  };
  return (arbre) => parcourir(arbre);
}

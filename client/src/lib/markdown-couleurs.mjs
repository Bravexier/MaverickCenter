// Couleur d'une case de tableau dans le Markdown des pages (demande du propriétaire : les cases du guide et leur couleur se modifient depuis le site de
// dev) : une case qui commence par « {couleur:vert} » est rendue avec l'attribut data-couleur="vert" (palette : styles/global/wiki.css), sans ce
// préfixe. lib/markdown-edition.mjs l'écrit, ce plugin remark le lit (astro.config.mjs, lib/guide-rendu.ts). Seules les couleurs de
// COULEURS_DE_CASE sont reconnues : tout autre texte entre accolades reste tel quel. Sans dépendance.
import { COULEURS_DE_CASE } from './markdown-edition.mjs';

const PREFIXE = /^\{couleur:([a-z]+)\}[ \t]?/;

/** Plugin remark : pose data-couleur sur les cases qui commencent par « {couleur:x} ». */
export function remarkCouleursDeCase() {
  const marquer = (cellule) => {
    const premier = cellule.children?.[0];
    if (premier?.type !== 'text') return;
    const m = PREFIXE.exec(premier.value);
    if (!m || !COULEURS_DE_CASE.includes(m[1])) return;
    premier.value = premier.value.slice(m[0].length);
    if (!premier.value) cellule.children.shift();
    cellule.data = { ...cellule.data, hProperties: { ...cellule.data?.hProperties, 'data-couleur': m[1] } };
  };
  const parcourir = (noeud) => {
    if (noeud.type === 'tableCell') marquer(noeud);
    for (const enfant of noeud.children ?? []) parcourir(enfant);
  };
  return (arbre) => parcourir(arbre);
}

// Les monnaies en icônes dans les cases de tableau du Markdown des pages (demande du propriétaire : « partout dans toutes les tables il faudra retirer
// les abréviations RO. Il faudra remplacer par des icônes » ; lib/monnaies.mjs). Plugin remark déclaré dans astro.config.mjs ET lib/guide-rendu.ts, qui
// doivent rester d'accord, comme celui de la couleur des cases (lib/markdown-couleurs.mjs). Seul le texte des cases change (pas un lien, pas un code) ;
// le texte hors tableau garde ses abréviations. Sans dépendance (sauf lib/monnaies.mjs, pur).
import { htmlDePiece, morceauxDeMonnaie } from './monnaies.mjs';

/** Plugin remark : dans une case de tableau, chaque abréviation de monnaie devient son icône. */
export function remarkMonnaies() {
  const remplacer = (noeud) => {
    if (!noeud.children) return;
    noeud.children = noeud.children.flatMap((enfant) => {
      if (enfant.type !== 'text') {
        if (enfant.type !== 'link' && enfant.type !== 'inlineCode') remplacer(enfant);
        return [enfant];
      }
      const morceaux = morceauxDeMonnaie(enfant.value);
      if (!morceaux.some((m) => m.monnaie)) return [enfant];
      return morceaux.map((m) => (m.monnaie ? { type: 'html', value: htmlDePiece(m.monnaie) } : { type: 'text', value: m.texte }));
    });
  };
  const parcourir = (noeud) => {
    if (noeud.type === 'tableCell') remplacer(noeud);
    else for (const enfant of noeud.children ?? []) parcourir(enfant);
  };
  return (arbre) => parcourir(arbre);
}

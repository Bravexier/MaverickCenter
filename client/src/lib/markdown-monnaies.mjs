// Les monnaies en icônes dans le Markdown des pages (demande du propriétaire : « partout dans toutes les tables il faudra retirer les abréviations RO.
// Il faudra remplacer par des icônes », puis, 2026-10-14, partout, texte courant compris, chaque montant décomposé en PP / RO / RF ; lib/monnaies.mjs).
// Plugin remark déclaré dans astro.config.mjs ET lib/guide-rendu.ts, qui doivent rester d'accord, comme celui de la couleur des cases
// (lib/markdown-couleurs.mjs). Seul le texte change (pas un lien, pas un code, pas du HTML, pas une balise du glossaire des mots-clés, « {{id|10 RO}} » :
// lib/monnaies.mjs#morceauxDeMonnaie la garde entière, le middleware la rend). Dans un tableau, une colonne dont l'en-tête écrit l'unité
// (« Coût(RO) ») lit un nombre seul de ses cases comme un montant dans cette monnaie (« 100.0 », « 100 + 1 Matériau ») ; ailleurs, un nombre sans
// monnaie reste un nombre. Sans dépendance (sauf lib/monnaies.mjs, pur).
import { htmlDuMorceau, morceauxDeMonnaie } from './monnaies.mjs';

/** L'unité écrite entre parenthèses à la fin d'un en-tête de colonne (« Coût(RO) », « Prix (Ro) »), ou null. */
export function uniteDeLEntete(texte) {
  const m = /\(\s*(R[Oo]|R[Ff]|PP)\s*\)\s*$/u.exec(String(texte ?? '').trim());
  return m ? m[1] : null;
}

const texteDe = (noeud) => (noeud.type === 'text' ? noeud.value : (noeud.children ?? []).map(texteDe).join(''));

/** Plugin remark : chaque montant devient ses icônes (décomposé), chaque abréviation seule son icône. */
export function remarkMonnaies() {
  const remplacer = (noeud, options) => {
    if (!noeud.children) return;
    noeud.children = noeud.children.flatMap((enfant) => {
      if (enfant.type !== 'text') {
        if (!['link', 'inlineCode', 'code', 'html'].includes(enfant.type)) remplacer(enfant, options);
        return [enfant];
      }
      const morceaux = morceauxDeMonnaie(enfant.value, options);
      if (!morceaux.some((m) => m.monnaie || m.montant)) return [enfant];
      return morceaux.map((m) => (m.texte !== undefined ? { type: 'text', value: m.texte } : { type: 'html', value: htmlDuMorceau(m) }));
    });
  };
  const parcourir = (noeud) => {
    if (noeud.type === 'table') {
      const [entete, ...lignes] = noeud.children ?? [];
      const unites = (entete?.children ?? []).map((c) => uniteDeLEntete(texteDe(c)));
      if (entete) remplacer(entete, {});
      for (const ligne of lignes) (ligne.children ?? []).forEach((c, i) => remplacer(c, { unite: unites[i] ?? null }));
      return;
    }
    if (['link', 'inlineCode', 'code', 'html'].includes(noeud.type)) return;
    if (noeud.type === 'paragraph' || noeud.type === 'heading' || noeud.type === 'tableCell') return remplacer(noeud, {});
    for (const enfant of noeud.children ?? []) parcourir(enfant);
  };
  return (arbre) => parcourir(arbre);
}

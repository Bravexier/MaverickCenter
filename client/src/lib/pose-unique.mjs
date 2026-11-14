// Ce qu'une page ne pose qu'une fois, quel que soit le nombre de composants qui le demandent (components/Onglets.astro : le script `js` en ligne ;
// components/SupportDuMarkdown.astro : la feuille des onglets) : skill ui-onglets, « posé une fois par page ». `locals` est `Astro.locals`, le même objet pour tous les
// composants d'une page rendue ; rend vrai la première fois qu'une clé est demandée, faux ensuite. Sans dépendance.

/** Vrai la première fois que `cle` est demandée pour ces `locals`, faux les suivantes. */
export function poserUneFois(locals, cle) {
  const poses = (locals.__posesUneFois ??= new Set());
  if (poses.has(cle)) return false;
  poses.add(cle);
  return true;
}

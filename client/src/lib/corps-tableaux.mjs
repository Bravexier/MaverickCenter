// Outils communs des rendus du corps ENTIER d'une page (lib/corps-armes.mjs, corps-armures.mjs, corps-composants.mjs, corps-potions.mjs) : repérer un
// tableau Markdown par sa SECTION et son RANG, et en remplacer les lignes de données, jamais par l'ancien texte d'une ligne. « Tout recalculer »
// (serveur/edition-lots.mjs#ecartsDuRecalcul) s'en sert quand le corps n'écrit plus une ligne comme le code d'aujourd'hui la rend : la prose du corps (hors
// tableaux) reste intacte, une forme non reconnue lève l'erreur du module appelant (la page reste « illisible »). Fonctions pures, sans dépendance.

/** Une ligne de tableau (en-tête, séparateur ou données). */
export const estUneLigneDeTableau = (l) => l.startsWith('|');
/** La ligne de séparation d'un tableau (« | --- | :-: |»). */
export const estUnSeparateur = (l) => /^\|[\s:|-]+\|$/.test(l);
/** Les cases d'une ligne de tableau, découpée sur les « | » non échappés (la première et la dernière, vides, comprises). */
export const casesDe = (l) => l.split(/(?<!\\)\|/);

/**
 * Les tableaux de [debut, fin[ (blocs de lignes « | » consécutives), dans l'ordre : [{ debut, fin }] (indices de lignes, `fin` exclu). Un tableau d'une ou deux
 * lignes (sans ligne de données) est rendu tel quel : son appelant décide s'il est de la forme attendue.
 */
export function tableauxDe(lignes, debut, fin) {
  const tableaux = [];
  for (let i = debut; i < fin; i++) {
    if (!estUneLigneDeTableau(lignes[i])) continue;
    let j = i;
    while (j + 1 < fin && estUneLigneDeTableau(lignes[j + 1])) j++;
    tableaux.push({ debut: i, fin: j + 1 });
    i = j;
  }
  return tableaux;
}

/** Les indices des lignes de données d'un tableau (après son en-tête et sa ligne de séparation). */
export function lignesDeDonnees(t) {
  const indices = [];
  for (let k = t.debut + 2; k < t.fin; k++) indices.push(k);
  return indices;
}

/**
 * Remplace en bloc les lignes de données du tableau `t` par `nouvelles` (leur nombre peut changer : ligne créée ou retirée) ; `lignes` est modifié sur
 * place. Rend le tableau après remplacement.
 */
export function remplacerLesLignesDeDonnees(lignes, t, nouvelles) {
  const debut = t.debut + 2;
  lignes.splice(debut, t.fin - debut, ...nouvelles);
  return { debut: t.debut, fin: debut + nouvelles.length };
}

/** Réécrit une à une, sur place, les lignes d'indices `indices` : la ligne de rang k devient `nouvelle(ancienne, k)` ; l'appelant a vérifié le compte. */
export function reecrireLesLignes(lignes, indices, nouvelle) {
  indices.forEach((i, rang) => {
    lignes[i] = nouvelle(lignes[i], rang);
  });
}

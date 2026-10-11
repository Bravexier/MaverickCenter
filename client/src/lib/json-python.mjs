// JSON écrit comme `json.dumps(valeur, ensure_ascii=False)` de Python, le format des colonnes JSON de data/rows (page.donnees : importeurs
// tools/sheets/*.py, tools/db/pages_md.py) : séparateurs « , » et « : » suivis d'une espace, caractères non ASCII gardés tels quels, clés dans leur
// ordre. Le service de l'édition (client/serveur/edition.mjs) l'utilise pour qu'une page qu'il réécrit sans la changer sur le fond reste identique
// octet pour octet (sinon db:pages-check la voit différente de son `.md`).
// Fonction pure, sans dépendance.

/**
 * @param {unknown} valeur texte, nombre, booléen, null, tableau ou objet (comme JSON.stringify ; un nombre non entier s'écrit à la façon de
 *   JavaScript : page.donnees n'en contient pas)
 * @returns {string}
 */
export function jsonCommePython(valeur) {
  if (valeur === null || valeur === undefined) return 'null';
  if (Array.isArray(valeur)) return `[${valeur.map((v) => jsonCommePython(v === undefined ? null : v)).join(', ')}]`;
  if (typeof valeur === 'object') {
    const paires = Object.entries(valeur).filter(([, v]) => v !== undefined);
    return `{${paires.map(([k, v]) => `${JSON.stringify(k)}: ${jsonCommePython(v)}`).join(', ')}}`;
  }
  if (typeof valeur === 'number' && !Number.isFinite(valeur)) throw new TypeError('JSON : nombre non fini');
  // texte : JSON.stringify échappe exactement ce que Python échappe avec ensure_ascii=False (« " », « \ », caractères de contrôle, \u00XX en minuscules)
  return JSON.stringify(valeur);
}

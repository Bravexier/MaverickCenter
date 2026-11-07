// Le filtre de la liste du Glossaire (/regles/glossaire/, src/scripts/glossaire.mjs) : un mot-clé correspond quand le texte tapé se trouve dans son
// libellé, son abréviation ou sa définition (balises lues comme leur texte), sans tenir compte de la casse, des accents ni de la ponctuation.
// Sans aucun import : le script de la page l'importe seul (skill site-version-portable : deux scripts de page n'importent jamais le même module) ;
// `normaliser` est la règle de lib/text.mjs#normalize, recopiée (test/glossaire-filtre.test.mjs les compare).

/** Clé de comparaison : minuscules, sans accents, sans apostrophes, tirets pour le reste (lib/text.mjs#normalize). */
export function normaliser(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Un texte dont les balises du glossaire (« {{id}} », « {{id|texte}} », « {{id:}} ») sont lues comme leur texte écrit, sinon leur ref. */
export const sansBalises = (texte) => String(texte ?? '')
  .replace(/\{\{([^{}|\n]+?)(?:\\?\|([^{}\n]*?))?\}\}/g, (_, ref, ecrit) => (ecrit?.trim() || ref.trim().replace(/\s*:$/, '')));

/** Le texte où se cherche un mot-clé ({ libelle, abreviation, definition }), normalisé. */
export const texteDuMotCle = ({ libelle = '', abreviation = '', definition = '' } = {}) =>
  normaliser(`${libelle} ${abreviation ?? ''} ${sansBalises(definition)}`);

/** Vrai si le mot-clé `m` correspond à la saisie `requete` (une saisie vide : tous). */
export function correspond(m, requete) {
  const q = normaliser(requete);
  return !q || texteDuMotCle(m).includes(q);
}

/** Le compte affiché sous le filtre : « 379 mots-clés » sans saisie, « 3 sur 379 » sinon. */
export function compteDuFiltre(visibles, total, requete) {
  if (!normaliser(requete)) return `${total} mot${total > 1 ? 's' : ''}-clé${total > 1 ? 's' : ''}`;
  return `${visibles} sur ${total}`;
}

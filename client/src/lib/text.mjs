// Utilitaires de texte purs (utilisables côté serveur ET navigateur).

/** Clé de comparaison : minuscules, sans accents, sans apostrophes, tirets pour le reste. */
export function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Le libellé d'un mot-clé du glossaire suivi de son abréviation entre parenthèses, quand il en a une (mot_cle.abreviation, migration 0090 ; réponse du
 * propriétaire du 2026-11-05 : « Modifiable et affichée », « Armure magique (AM) ») ; le libellé seul sinon. Lu par
 * lib/mots-cles-balises.mjs#htmlDuNomDuMotCle (titre de la bulle, pastille et vue de /recherche/), qui montre une monnaie par son icône à la place.
 */
export function libelleAvecAbreviation(libelle, abreviation) {
  const abr = typeof abreviation === 'string' ? abreviation.trim() : '';
  return abr ? `${libelle} (${abr})` : String(libelle);
}

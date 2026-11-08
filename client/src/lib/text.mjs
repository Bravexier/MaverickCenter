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

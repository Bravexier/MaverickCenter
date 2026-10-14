// Aide des tests du site construit qui lisent les capacités d'une carte du bestiaire (lib/monstre-rendu.mjs#htmlDeCapacite) : sur /bestiaire/
// (bestiaire-html) et dans les infobulles des pages de magie (magies-html). Module sans test (n'est pas un *.test.mjs).

/** Les tuiles de capacités d'un morceau de HTML, dans l'ordre : [commune ?, nom], chacune avec son en-tête (pastilles, nom) puis son texte. */
export const tuilesDeCapacites = (html) =>
  [...html.matchAll(/<li class="bcapacite( bcapacite--commune)?"><p class="bcapacite__tete">(?:<span class="prefixe"[^>]*>[^<]*<\/span> )*<strong class="bcapacite__nom">([^<]+)<\/strong><\/p> <div class="bcapacite__texte">/g)]
    .map((m) => [Boolean(m[1]), m[2]]);

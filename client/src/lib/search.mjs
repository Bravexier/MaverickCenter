import { normalize } from './text.mjs';

// Poids par champ : un titre qui correspond pèse plus qu'une simple occurrence dans le texte.
const WEIGHTS = { title: 6, aliases: 5, tags: 4, summary: 2, text: 1 };

/**
 * Recherche « tous les mots » dans l'index produit par pages/search-index.json.ts.
 * @param {{title:string, aliases:string[], tags:string[], summary:string, text:string}[]} index
 * @returns les pages triées par pertinence puis titre
 */
export function searchIndex(index, query) {
  const tokens = normalize(query).split('-').filter(Boolean);
  if (!tokens.length) return [];

  const results = [];
  for (const doc of index) {
    const fields = {
      title: normalize(doc.title),
      aliases: doc.aliases.map(normalize).join('|'),
      tags: doc.tags.map(normalize).join('|'),
      summary: normalize(doc.summary),
      text: normalize(doc.text),
    };
    let score = 0;
    const everyTokenFound = tokens.every((token) => {
      const best = Object.entries(WEIGHTS)
        .filter(([field]) => fields[field].includes(token))
        .reduce((max, [field, weight]) => Math.max(max, weight + (fields[field] === token ? 4 : 0)), 0);
      score += best;
      return best > 0;
    });
    if (everyTokenFound) results.push({ doc, score });
  }
  return results
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title, 'fr'))
    .map((r) => r.doc);
}

/**
 * Mots-clés qui correspondent à la recherche (page /recherche/, où la liste des mots-clés est mêlée à la recherche) : ceux dont la clé de recherche
 * (cleDeRecherche : les écritures normalisées du mot-clé) contient chaque mot cherché. Recherche vide : tous. Garde l'ordre reçu.
 * @param {string[]} cles
 */
export function filtrerMotsCles(cles, query) {
  const tokens = normalize(query).split('-').filter(Boolean);
  return cles.filter((cle) => tokens.every((token) => cle.includes(token)));
}

/**
 * Ce que filtrerMotsCles cherche dans un mot-clé de /recherche/ : son libellé normalisé (sinon `cle`, pour un appelant qui ne donne qu'elle), suivi de
 * chacun de ses synonymes normalisés (décision R233 (1) : « Saisie d'une balise, Recherche, Affichage » ; l'ancienne abréviation en est un : « AM »
 * trouve « Armure magique »), séparés par « | », que normalize ne produit pas (un mot cherché ne se lit jamais à cheval sur deux écritures). La clé d'un
 * homonyme (« namazu-race ») n'y entre pas : ses catégories ne sont pas son nom.
 * @param {{ libelle?: string, cle?: string, synonymes?: string[] }} motCle
 */
export function cleDeRecherche({ libelle, cle, synonymes = [] }) {
  const ecritures = [libelle !== undefined && libelle !== null ? normalize(libelle) : cle, ...(synonymes ?? []).map((s) => normalize(s))].filter(Boolean);
  return [...new Set(ecritures)].join('|');
}

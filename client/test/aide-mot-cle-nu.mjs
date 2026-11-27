// Un lot du service d'édition hors des routes du site (serveur/edition.mjs#enregistrer sans `voie`) : un mot-clé y naît encore nu, sans page de notion, comme
// dans un lot rejoué. Par une route (POST /api/edition/, /api/v1/), il naît avec sa page et n'est plus modifiable au Glossaire (docs/chantier-pages-de-notion.md,
// §4) : les tests qui créent un mot-clé d'essai pour le renommer, le fusionner ou le supprimer le créent ici. La réponse a la forme de serveur/api.mjs#traiter.
import { enregistrer, ErreurEdition } from '../serveur/edition.mjs';

/** `operations` jouées par le service d'édition hors route : { statut: 200, corps: le résultat du lot } ou { statut, corps: { erreur, …details } } d'un refus. */
export function lotHorsRoute(db, operations, page = 'essai/') {
  try {
    return { statut: 200, corps: enregistrer(db, { page, operations }) };
  } catch (e) {
    if (e instanceof ErreurEdition) return { statut: e.statut, corps: { erreur: e.message, ...(e.details ?? {}) } };
    throw e;
  }
}

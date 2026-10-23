// Page /ressources/equipement/ (menu Règles ; demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule
// onglet : "Equipement" A l'instar de "Armure et bouclier" les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les
// bâtons magiques du coup qui auront mieux leur place ici » ; « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires » ; puis « revoir
// intégralement la page des objets à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement », avec ses sous-onglets
// « Consommable / Carquois / Bâton magiques », où le tableau des bâtons magiques revient) : ses cinq onglets, dans l'ordre, les sous-onglets de
// l'onglet Ceinture, et la page du wiki que chacun sert. Ces pages ne sont plus construites : leurs liens mènent à l'onglet ou au sous-onglet
// (lib/metiers.mjs#adresseDePage), leurs anciennes adresses aussi, par la page 404 (lib/nav.mjs#PAGES_RENOMMEES, écrit à part : nav.mjs est importé
// par le script de la page 404 et n'importe rien ; test/equipement.test.mjs vérifie que les deux disent la même chose), comme celle de l'ancienne page
// « Objets à la ceinture » (sans page du wiki). Elles restent dans la base (recherche, [[liens]], règles affichées par l'onglet).
// Sans dépendance : importé par lib/metiers.mjs (au démarrage d'Astro), lib/ceinture-db.mjs, les composants de la page et les tests.

/** Le chemin de la page, relatif à la racine du site. */
export const CHEMIN_DE_L_EQUIPEMENT = 'ressources/equipement/';

/**
 * Les onglets : `id` (l'ancre de l'onglet et l'id de son panneau), `nom` (son libellé) et `page` (la page du wiki qu'il sert ; null pour l'onglet
 * Ceinture, qui n'en sert pas : ses sous-onglets, SOUS_ONGLETS_DE_LA_CEINTURE).
 */
export const ONGLETS_DE_L_EQUIPEMENT = Object.freeze([
  Object.freeze({ id: 'armes', nom: 'Armes', page: 'ressources/armes' }),
  Object.freeze({ id: 'armures', nom: 'Armures', page: 'ressources/armures' }),
  Object.freeze({ id: 'boucliers', nom: 'Boucliers', page: 'ressources/bouclier' }),
  Object.freeze({ id: 'ceinture', nom: 'Ceinture', page: null }),
  Object.freeze({ id: 'accessoires', nom: 'Accessoires', page: 'ressources/accessoires' }),
]);

/**
 * Les sous-onglets de l'onglet Ceinture, dans l'ordre voulu (« Consommable / Carquois / Bâton magiques ») : `id` (l'ancre du sous-onglet et l'id
 * de son panneau, unique sur la page), `nom` et `page` (la page du wiki qu'il sert, ou null). Le sous-onglet des bâtons garde l'ancre de l'ancien
 * onglet « Bâtons magiques » (#batons-magiques) : les liens déjà faits vers lui ouvrent l'onglet Ceinture et ce sous-onglet.
 */
export const SOUS_ONGLETS_DE_LA_CEINTURE = Object.freeze([
  Object.freeze({ id: 'ceinture-consommables', nom: 'Consommables', page: null }),
  Object.freeze({ id: 'ceinture-carquois', nom: 'Carquois', page: null }),
  Object.freeze({ id: 'batons-magiques', nom: 'Bâtons magiques', page: 'ressources/baton-magique' }),
]);

/** Les pages du wiki que la page sert : [{ page, ancre }], l'ancre de leur onglet ou de leur sous-onglet. */
export const PAGES_SERVIES_PAR_L_EQUIPEMENT = Object.freeze([...ONGLETS_DE_L_EQUIPEMENT, ...SOUS_ONGLETS_DE_LA_CEINTURE]
  .filter((o) => o.page)
  .map((o) => Object.freeze({ page: o.page, ancre: o.id })));

/** L'ancienne page « Objets à la ceinture » (sans page du wiki) : son adresse mène à l'onglet Ceinture (lib/nav.mjs#PAGES_RENOMMEES). */
export const ANCIENNE_PAGE_DE_LA_CEINTURE = 'ressources/objets-a-la-ceinture/';

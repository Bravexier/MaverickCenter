// Page /ressources/equipement/ (menu Ressources ; demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule
// onglet : "Equipement" A l'instar de "Armure et bouclier" les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les
// bâtons magiques du coup qui auront mieux leur place ici » ; « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires ») : ses cinq onglets,
// dans l'ordre, et la page du wiki que chacun sert. Ces pages ne sont plus construites : leurs liens mènent à l'onglet (lib/metiers.mjs#adresseDePage),
// leurs anciennes adresses aussi, par la page 404 (lib/nav.mjs#PAGES_RENOMMEES, écrit à part : nav.mjs est importé par le script de la page 404 et
// n'importe rien ; test/equipement.test.mjs vérifie que les deux disent la même chose). Elles restent dans la base (recherche, [[liens]], règles
// affichées par l'onglet).
// Sans dépendance : importé par lib/metiers.mjs (au démarrage d'Astro), par les composants de la page et par les tests.

/** Le chemin de la page, relatif à la racine du site. */
export const CHEMIN_DE_L_EQUIPEMENT = 'ressources/equipement/';

/** Les onglets : `id` (l'ancre de l'onglet et l'id de son panneau), `nom` (son libellé) et `page` (la page du wiki qu'il sert). */
export const ONGLETS_DE_L_EQUIPEMENT = Object.freeze([
  Object.freeze({ id: 'armes', nom: 'Armes', page: 'ressources/armes' }),
  Object.freeze({ id: 'armures', nom: 'Armures', page: 'ressources/armures' }),
  Object.freeze({ id: 'boucliers', nom: 'Boucliers', page: 'ressources/bouclier' }),
  Object.freeze({ id: 'batons-magiques', nom: 'Bâtons magiques', page: 'ressources/baton-magique' }),
  Object.freeze({ id: 'accessoires', nom: 'Accessoires', page: 'ressources/accessoires' }),
]);

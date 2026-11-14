// La liste des icônes du site qu'un mot-clé peut porter (mot_cle.icone, migration 0116 ; décision R235 : « tu peux mettre une colonne supplémentaire
// avec "icone" [...] Pour le moment, seul les monnaies vont l'utiliser » ; l'icône se choisit sur le site de dev dans la liste des icônes du site).
// Prolongée par le propriétaire le 2026-11-14 (sans nouveau numéro, R235 reste la règle) : « J'aimerai rajouter des icones supplémentaire sur le même
// modèle que ceux pour des monnaies » — pour les dégâts physiques, une épée (taille), une flèche (estoc), un marteau (frappe) ; pour les magies, un
// dessin par magie, « il faudra d'ailleurs avoir les mêmes teinte de couleur que leur magies respectives ». Réponses du même jour : « Liste seulement »
// (les icônes s'ajoutent au menu « Icône » du Glossaire du site de dev, il les attribue lui-même : aucune icône n'est posée sur un mot-clé) ; pour
// l'estoc, « Une flèche » (pas d'arc).
// La seule liste : db:check (client/scripts/db-check.mjs), le service (serveur/edition.mjs#refuserLIcone, GET /api/edition/mots-cles/, l'API v1) et le
// menu du site de dev la lisent. Une icône s'écrit « <famille>:<id> », sur le modèle de mot_cle.couleur (le CHECK de la colonne ne lit que cette
// forme). Trois familles :
//   - monnaie : les trois monnaies du jeu (lib/monnaies.mjs#MONNAIES_DU_JEU), dessinées par la classe « piece piece--<id> » (styles/global/monnaies.css) ;
//   - degats : les trois types de dégâts physiques (taille, estoc, frappe : les ids de lib/arme-champs.mjs), « icone icone--degats icone--degats-<id>
//     couleur-degats-<id> » : la dernière est la classe de la palette du type (lib/palette-css.mjs#classeDeDegats ; famille `degats`, sur chaque page),
//     les couleurs des pastilles de type des armes. Réponse du propriétaire du 2026-11-14 à « couleur du texte, ou couleurs déjà employées par les
//     pastilles de type des armes (Taille #c0392b, Estoc #2471a3, Frappe #7d6608) » : « Couleurs des armes » ; les dessins, « Tous me conviennent » ;
//   - magie : les quinze magies (les clés de lib/sort-format.mjs#COULEURS_DES_MAGIES), « icone icone--magie icone--magie-<id> couleur-magie-<id> » : la
//     dernière est la classe de la palette de la magie (lib/palette-css.mjs#classeDeMagie, la même ; testé), qui donne au dessin la couleur de sa magie
//     (« Aucune couleur en dur »). Le libellé reprend le nom de la magie tel que la carte de /magies/ l'écrit (components/magie/MagiesConstellation.astro).
// C'est un dessin du site, pas une ligne de la base : une monnaie supprimée ne retire pas son icône.
// Pur, sans dépendance navigateur ni Astro (un module feuille, avec lib/monnaies.mjs : il n'importe ni la palette ni les règles, un test les compare).
import { MONNAIES_DU_JEU } from './monnaies.mjs';

/** Les familles d'icônes : id → libellé du groupe (dans l'ordre de la liste). */
export const FAMILLES_D_ICONES = Object.freeze({ monnaie: 'Monnaies', degats: 'Dégâts', magie: 'Magies' });

/** Les types de dégâts physiques qui ont une icône : [id, libellé], dans l'ordre de la demande du propriétaire. */
const DEGATS = [['taille', 'Dégâts de taille'], ['estoc', 'Dégâts d’estoc'], ['frappe', 'Dégâts de frappe']];

/** Les magies qui ont une icône : [clé de COULEURS_DES_MAGIES, nom de la magie], dans l'ordre de la demande du propriétaire. */
const MAGIES = [
  ['sang', 'Sang'], ['necromancie', 'Nécromancie'], ['espace-temps', 'Espace-Temps'], ['vide', 'Vide'], ['arcane', 'Arcane'], ['corruption', 'Corruption'],
  ['lumiere', 'Lumière'], ['ombre', 'Ombre'], ['feu', 'Feu'], ['terre', 'Terre'], ['eau', 'Eau'], ['foudre', 'Foudre'], ['vent', 'Vent'], ['glace', 'Glace'],
  ['potentiel-illimite', 'Potentiel Illimité'],
];

const fige = (famille, id, libelle, classe) => Object.freeze({ valeur: `${famille}:${id}`, famille, id, libelle, classe });

/**
 * Les icônes du site, dans l'ordre du menu : [{ valeur: 'famille:id', famille, id, libelle, classe }] — `classe` : les classes CSS du dessin (une
 * monnaie : « piece piece--rf » ; des dégâts : « icone icone--degats icone--degats-taille couleur-degats-taille » ; une magie : « icone icone--magie icone--magie-feu couleur-magie-feu »),
 * `libelle` : son nom (celui de la monnaie ; « Dégâts de taille » ; « Magie : Feu »), qui la nomme aussi pour un lecteur d'écran (`aria-label`) et dans le menu.
 */
export const ICONES = Object.freeze([
  ...Object.values(MONNAIES_DU_JEU)
    .sort((a, b) => a.valeur_rf - b.valeur_rf)
    .map((m) => fige('monnaie', m.id, m.nom, `piece piece--${m.id}`)),
  ...DEGATS.map(([id, libelle]) => fige('degats', id, libelle, `icone icone--degats icone--degats-${id} couleur-degats-${id}`)),
  ...MAGIES.map(([id, nom]) => fige('magie', id, `Magie : ${nom}`, `icone icone--magie icone--magie-${id} couleur-magie-${id}`)),
]);

const PAR_VALEUR = new Map(ICONES.map((i) => [i.valeur, i]));

/** L'icône de valeur `valeur` (« monnaie:ro »), ou null. */
export const icone = (valeur) => (typeof valeur === 'string' ? PAR_VALEUR.get(valeur) ?? null : null);

/** La faute d'une icône écrite (une chaîne qui n'est pas dans ICONES), ou null quand elle convient ; NULL (aucune icône) convient toujours. */
export function fauteDeLIcone(valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur !== 'string') return 'une icône s’écrit « famille:id »';
  if (PAR_VALEUR.has(valeur)) return null;
  return `ce n’est pas une icône du site (${ICONES.map((i) => i.valeur).join(', ')})`;
}

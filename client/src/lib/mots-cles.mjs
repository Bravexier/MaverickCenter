// Le vocabulaire des mots-clés (table `mot_cle`, migration 0043 ; demande du propriétaire : sur /recherche/, en mode modification, « supprimer / ajouter /
// modifier des mots clés », une suppression le retirant « de tous les endroits qui le référencent » ; les événements de la chronologie, eux, ont leurs
// catégories : lib/chronologie.mjs ; depuis la migration 0056, un glossaire que les textes citent par des balises : lib/mots-cles-balises.mjs).
// Fonctions et constantes pures, sans dépendance navigateur ni Astro : partagées par le service
// (serveur/edition-chronologie.mjs), les gabarits et l'éditeur (src/scripts/edition/mots-cles.mjs).
import { CLASS_GROUPS } from './class-groups.mjs';
import { MOT_CLE_DE_CATEGORIE } from './classe-champs.mjs';
import { MOT_CLE_DES_DONS } from './dons-edition.mjs';
import { TAG_RACE_HYBRIDE } from './race-kinds.mjs';
import { normalize } from './text.mjs';

/**
 * Les mots-clés dont le site se sert pour ranger les pages (une règle les lit par leur écriture) : ni renommés, ni supprimés, ni fusionnés depuis le site,
 * sinon une page change de place sans que personne l'ait voulu. Clé = libelle_cle (normalize), valeur = la raison (« il … »), affichée en mode modification.
 */
export const MOTS_CLES_PROTEGES = new Map([
  ...Object.values(MOT_CLE_DE_CATEGORIE).map((t) => [normalize(t), 'est la catégorie posée sur une classe créée depuis le site']),
  // après les catégories : la raison la plus parlante l'emporte (une colonne de /classes/)
  ...CLASS_GROUPS.flatMap((g) => g.tags.map((t) => [normalize(t), `range les classes dans la colonne « ${g.label} » de /classes/`])),
  [TAG_RACE_HYBRIDE, 'range une race créée depuis le site parmi les races hybrides'],
  [normalize(MOT_CLE_DES_DONS), 'est posé sur chaque don de classe (fiches /capacites/)'],
  [normalize('classe'), 'est posé sur chaque page de classe'],
  [normalize('race'), 'est posé sur chaque page de race'],
  [normalize('métier'), 'est posé sur chaque métier'],
  [normalize('codex'), 'est posé par l’import du Codex sur chacune de ses pages (tools/docs/codex.py)'],
]);

/** La raison pour laquelle un mot-clé ne se renomme, ne se supprime ni ne se fusionne pas depuis le site (null : il le peut). */
export const raisonDeProtection = (libelleCle) => MOTS_CLES_PROTEGES.get(libelleCle) ?? null;

/** Mots-clés triés par libellé, à la française (pastilles d'un événement, listes). */
export const parLibelle = (a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

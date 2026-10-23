// Les tables de la base qui ne sont pas des règles, ou pas des textes à lire comme tels, chacune dans une seule liste (data/schema.sql ;
// test/tables-de-la-base.test.mjs les compare au schéma) :
//   - hors des règles (TABLES_HORS_REGLES), sections 13 à 15 : les fiches de personnages et les groupes de jeu (section 13 :
//     lib/fiche-format.mjs#TABLES_FICHES), le journal de l'édition et le brouillon de la note de version (section 14 : TABLES_DU_JOURNAL), les notes de
//     version et l'historique des modifications du site (section 15 : TABLES_DES_NOTES) — jamais modifiées par l'édition
//     (serveur/edition-journal.mjs#TABLES_INTERDITES) ;
//   - dérivées (TABLES_DERIVEES : section 11, `-- @derivee`, hors tables de recherche plein texte) : recalculées par le build depuis les autres ;
//   - les traces gardées telles quelles (TRACES_TELLES_QUELLES) : l'écriture d'une source, jamais corrigée ni réécrite (skill base-orthographe).
// Aucune n'est lue comme un texte de règles par les balises du glossaire des mots-clés (lib/mots-cles-db.mjs#textesDeLaBase : ni contrôlée par
// db:check, ni réécrite au rejeu du journal).
// Sans dépendance (sauf lib/fiche-format.mjs, pur).
import { TABLES_FICHES } from './fiche-format.mjs';

/** Section 14 : le journal des modifications du site de dev et le brouillon de la note de version. */
export const TABLES_DU_JOURNAL = Object.freeze(['modification_lot', 'modification', 'note_version_brouillon']);

/** Section 15 : les notes de version et l'historique des modifications faites sur le site de dev (des traces qui citent la production d'avant). */
export const TABLES_DES_NOTES = Object.freeze(['note_version', 'note_version_ligne', 'historique_modification']);

/** Sections 13 à 15 : tout ce qui n'est pas une règle. */
export const TABLES_HORS_REGLES = Object.freeze([...TABLES_FICHES, ...TABLES_DU_JOURNAL, ...TABLES_DES_NOTES]);

/** Section 11 : les tables dérivées (`-- @derivee`), hors tables de recherche plein texte (FTS5). */
export const TABLES_DERIVEES = Object.freeze(['lien', 'lien_candidat']);

/**
 * Les traces de l'import gardées telles qu'écrites : notes de cellule, écarts entre sources, corrections, commentaires orphelins (empreinte de leur
 * texte), alias des pages, dictionnaire des sources.
 */
export const TRACES_TELLES_QUELLES = Object.freeze(['note_cellule', 'ecart_source', 'correction', 'commentaire_orphelin', 'alias', 'source']);

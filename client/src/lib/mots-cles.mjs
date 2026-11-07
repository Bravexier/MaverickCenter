// Le vocabulaire des mots-clés (table `mot_cle`, migration 0043 ; demande du propriétaire : en mode modification, « supprimer / ajouter /
// modifier des mots clés » ; depuis la décision R196, un mot-clé ne se supprime que si rien ne le mentionne : lib/mentions-des-mots-cles.mjs ;
// aujourd'hui sur la page Glossaire /regles/glossaire/ ; les événements de la chronologie, eux, ont leurs catégories : lib/chronologie.mjs ; depuis la migration 0056, un glossaire
// que les textes citent par des balises : lib/mots-cles-balises.mjs).
// Fonctions et constantes pures, sans dépendance navigateur ni Astro : partagées par le service
// (serveur/edition-chronologie.mjs), les gabarits et l'éditeur (src/scripts/edition/mots-cles.mjs).
import { CLASS_GROUPS } from './class-groups.mjs';
import { MOT_CLE_DE_CATEGORIE } from './classe-champs.mjs';
import { MOT_CLE_DES_DONS } from './dons-edition.mjs';
import { TAG_RACE_HYBRIDE } from './race-kinds.mjs';

/**
 * Les mots-clés dont le site se sert pour ranger les pages (une règle les lit par leur id) ou reconnaître un sort (« Sort grenade », décision R114 ;
 * « Sort fer », décision R164) : une liste d'identification, plus un refus. Le site les reconnaît à leur id, jamais à leur écriture (décision R195 :
 * lib/class-groups.mjs, lib/race-kinds.mjs, lib/classe-magique.mjs, lib/races-db.mjs, serveur/edition.mjs#motCleDe) ; ils sont verrouillés
 * (mot_cle.verrou = 1, migration 0110 : décision R219 (2), « le verrou remplace leur protection actuelle » ; `race-hybride`, absent de la base, est
 * créé verrouillé avec la première race hybride : R220 (2)) : c'est le verrou qui refuse de les modifier, supprimer ou fusionner dans un autre
 * (serveur/edition.mjs#raisonDuGel). Une page créée par le service ne reçoit que ces mots-clés (motCleDe), et un mot-clé créé n'en prend jamais l'id
 * (creerMotCle). Clé = id du mot-clé (mot_cle.id, figé ; égal à l'écriture d'origine, normalize, d'où la lecture des lots d'avant la migration 0056 :
 * serveur/edition.mjs#ancienneEcritureDuGlossaire), valeur = ce que le site en fait (« il … »).
 */
export const MOTS_CLES_PROTEGES = new Map([
  ...Object.values(MOT_CLE_DE_CATEGORIE).map((id) => [id, 'est la catégorie posée sur une classe créée depuis le site']),
  // après les catégories : la raison la plus parlante l'emporte (une colonne de /classes/)
  ...CLASS_GROUPS.flatMap((g) => g.motsCles.map((id) => [id, `range les classes dans la colonne « ${g.label} » de /classes/`])),
  [TAG_RACE_HYBRIDE, 'range une race créée depuis le site parmi les races hybrides'],
  [MOT_CLE_DES_DONS, 'est posé sur chaque don de classe (fiches /capacites/)'],
  ['classe', 'est posé sur chaque page de classe'],
  ['race', 'est posé sur chaque page de race'],
  ['metier', 'est posé sur chaque métier'],
  ['codex', 'est posé par l’import du Codex sur chacune de ses pages (tools/docs/codex.py)'],
  // les étiquettes de sort (sort_mot_cle, migrations 0067 et 0079) que la fiche lit par leur id, `sort-grenade` (décision R114 : « Pardon ?!? » du Grenadier)
  // et `sort-fer` (décision R164 : « ... Brutale » du Mage Vert) — lib/sort-bonus-texte.mjs#ETIQUETTES_DES_SORTS, que ce module n'importe pas : le service
  // n'en a pas besoin ; test/fiche-grenades-et-sort-prepare.test.mjs les compare ; tout mot-clé qui étiquette un sort, verrouillé ou non, ne se supprime ni
  // ne se fusionne, dans un sens ou l'autre (serveur/edition-chronologie.mjs#verifierSansSort)
  ['sort-grenade', 'étiquette les sorts grenades, que la fiche de personnage reconnaît par lui (décision R114 : les +11 dégâts de « Pardon ?!? » du Grenadier)'],
  ['sort-fer', 'étiquette les sorts fer, que la fiche de personnage reconnaît par lui (décision R164 : les +2 dégâts de « ... Brutale » du Mage Vert, en posture Focus)'],
]);

/**
 * Un mot-clé verrouillé (mot_cle.verrou = 1, migration 0110 ; décisions R218, R219) : le site de dev n'en modifie aucun champ (libellé, définition,
 * abréviation, adresse, couleur) et ne le supprime pas, même sans mention, ni par sa fusion dans un autre ; il se pose encore sur une page et s'en
 * retire, se cite par une balise et reçoit la fusion d'un autre mot-clé (sans en prendre l'adresse ni la couleur). Aucune route n'écrit `verrou` : il
 * ne change que par une migration (R218 (4)). Le rejeu du journal ne le contrôle pas (R219 (6)). `m` : une ligne de mot_cle (ou du vocabulaire du
 * service, GET /api/edition/mots-cles/), dont `verrou` vaut 0 ou 1 ; absent (base d'avant la 0110) : non verrouillé.
 */
export const estVerrouille = (m) => m?.verrou === 1;

/** Ce que le verrou empêche, tel que le refus du service le dit après « Le mot-clé « X » est verrouillé : » (et l'infobulle du Glossaire peut le reprendre). */
export const RAISON_DU_VERROU = 'ses champs ne se modifient pas et il ne se supprime pas depuis le site (décisions R218, R219) ; il se pose encore sur une page, se cite par une balise et reçoit la fusion d’un autre mot-clé';

/** Mots-clés triés par libellé, à la française (pastilles d'un événement, listes). */
export const parLibelle = (a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

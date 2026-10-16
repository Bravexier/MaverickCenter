// Format d'échange d'une fiche de personnage entre les pages du site et le service (client/serveur/, docs/serveur.md) : un objet JSON qui reprend
// les colonnes de la section 13 de data/schema.sql sous leur nom. Les colonnes de `personnage` sont à la racine ; chaque table de détail est une
// liste d'objets (ses colonnes, sans `personnage_id`) rangée sous sa clé de PARTIES_DE_FICHE. Rien de ce qui se calcule n'y figure (niveaux,
// santé, totaux…) : une fiche, ce sont les choix du joueur (docs/character-generator.md, « Fiches dans la base »).
// Quand les règles suppriment un don, une spécialité, un sort ou un métier qu'une fiche utilise, l'élément en est retiré et une ligne datée le rappelle
// à la fin de ses notes (décision R42 : serveur/fiches-retraits.mjs) ; le texte de cette ligne, et sa relecture par la page /fiche/, sont ici.
// Sans dépendance : importé par le service et par le navigateur.

/**
 * Tables de la section 13 (« PERSONNAGES ») de data/schema.sql, chacune après celles qu'elle cite (test serveur-base-vivante). Ici plutôt que dans
 * serveur/base-vivante.mjs (qui la réexporte) : serveur/edition-journal.mjs en tire ses tables interdites sans cycle d'imports.
 */
export const TABLES_FICHES = Object.freeze([
  'utilisateur', 'utilisateur_role', 'personnage', 'personnage_partage', 'personnage_classe', 'personnage_caracteristique', 'personnage_competence',
  'personnage_metier_bonus', 'personnage_capacite', 'personnage_sort', 'personnage_maitrise_arme', 'personnage_arme', 'personnage_armure_partie',
  'personnage_bouclier_materiau', 'personnage_accessoire', 'personnage_inventaire', 'personnage_ceinture', 'groupe', 'groupe_membre',
]);

/** Clé du JSON → table de détail. Toute table de la section 13 qui cite `personnage` en fait partie, sauf HORS_FICHE (test serveur-fiches). */
export const PARTIES_DE_FICHE = Object.freeze({
  classes: 'personnage_classe',
  caracteristiques: 'personnage_caracteristique',
  competences: 'personnage_competence',
  metier_bonus: 'personnage_metier_bonus',
  capacites: 'personnage_capacite',
  sorts: 'personnage_sort',
  maitrises_armes: 'personnage_maitrise_arme',
  armes: 'personnage_arme',
  armure_parties: 'personnage_armure_partie',
  bouclier_materiaux: 'personnage_bouclier_materiau',
  accessoires: 'personnage_accessoire',
  inventaire: 'personnage_inventaire',
  ceinture: 'personnage_ceinture',
});

/** Tables qui citent une fiche sans en faire partie : le partage d'une fiche de joueur et les inscriptions dans les groupes de jeu. */
export const HORS_FICHE = Object.freeze(['personnage_partage', 'groupe_membre']);

/** Colonnes de `personnage` que fixe le service, jamais la page : identifiant, nature, propriétaire, visibilité (un prétiré : à personne, visible de tous), instants. */
export const COLONNES_DU_SERVICE = Object.freeze(['id', 'nature', 'proprietaire_id', 'visibilite', 'cree_le', 'modifie_le']);

/** Champ du JSON qui n'est pas une colonne : la version de la fiche lue, rendue à l'enregistrement (deux modifications simultanées ne s'écrasent pas). */
export const CHAMP_VERSION = 'version';

/**
 * Colonnes que les règles ont retirées d'une table de la section 13, par table : la base vivante les perd à sa reconstruction sans bloquer
 * (serveur/base-vivante.mjs), et une fiche qui en porte encore une (fichier exporté avant, page restée ouverte) se lit sans elle (page /fiche/, service).
 * `statut` (brouillon, validé, archivé) : la fiche n'a plus de statut (demande du propriétaire, migration 0038).
 */
export const COLONNES_RETIREES = Object.freeze({ personnage: Object.freeze(['statut']) });

/**
 * Tables que les règles ont retirées de la section 13, avec leur ancienne clé dans le JSON d'une fiche (PARTIES_RETIREES : l'inverse). Leurs lignes ne
 * se perdent jamais sans le dire : la base vivante les convertit à sa reconstruction (serveur/base-vivante.mjs, CONVERSIONS), et une fiche qui porte
 * encore leur clé (fichier exporté avant, page restée ouverte) est convertie à sa lecture (sansPartiesRetirees : service et page /fiche/).
 * `personnage_progression` (une ligne par niveau atteint) : les gains de niveau sont deux totaux, personnage.gains_sante et gains_chakra (décision R73,
 * migration 0045), la somme de ses lignes (gainsDeLaProgression).
 * `personnage_armure` (une armure par emplacement : armure complète, casque, torse…) : la fiche porte une seule armure complète, son amélioration, son
 * élément et l'amélioration de l'élément (décision R95, migration 0055 : COLONNES_DE_L_ARMURE de personnage), la ligne du premier emplacement
 * (armureDesArmures) ; chaque autre pièce différente est notée, datée, dans la fiche (lignesDesPiecesRetirees).
 */
export const TABLES_RETIREES = Object.freeze({ personnage_progression: 'progression', personnage_armure: 'armures' });
export const PARTIES_RETIREES = Object.freeze(Object.fromEntries(Object.entries(TABLES_RETIREES).map(([table, cle]) => [cle, table])));

const entierPositif = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.trunc(Number(v))) : 0);

/**
 * Les gains de niveau d'une ancienne `progression` (lignes de personnage_progression : points_sante, points_chakra, de_choix, de_resultat), en deux
 * totaux (décision R73) : les points de chaque niveau, plus le résultat du dé sur la santé (« sante »), le chakra (« chakra ») ou les deux
 * (« les_deux » : « 1d4 pour les deux » compte sur chacun) ; un résultat absent compte 0. La même somme que la reconstruction de la base vivante
 * (serveur/base-vivante.mjs, CONVERSIONS) et que la migration 0045. Une liste absente ou vide donne 0 et 0.
 * @param {Array<{ points_sante?: number, points_chakra?: number, de_choix?: string | null, de_resultat?: number | null }> | null | undefined} lignes
 * @returns {{ gains_sante: number, gains_chakra: number }}
 */
export function gainsDeLaProgression(lignes) {
  let gains_sante = 0;
  let gains_chakra = 0;
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (!l || typeof l !== 'object') continue;
    const de = entierPositif(l.de_resultat);
    gains_sante += entierPositif(l.points_sante) + (l.de_choix === 'sante' || l.de_choix === 'les_deux' ? de : 0);
    gains_chakra += entierPositif(l.points_chakra) + (l.de_choix === 'chakra' || l.de_choix === 'les_deux' ? de : 0);
  }
  return { gains_sante, gains_chakra };
}

/**
 * Vrai si la fiche porte à la fois une `progression` non vide et l'un des deux totaux (gains_sante, gains_chakra) : les deux formes des gains de niveau,
 * qu'on ne sait pas concilier. C'est l'envoi d'une page d'avant la migration 0045 restée ouverte, après un premier enregistrement auprès du service à
 * jour : elle a repris les deux totaux de sa réponse (sans `progression`, d'où sa liste vidée) et renvoie avec eux les lignes saisies depuis, qui
 * peuvent être des gains nouveaux ou les anciens saisis de nouveau. Le service refuse alors d'enregistrer (409, serveur/fiches.mjs) : la page doit
 * être rechargée.
 */
export function progressionAvecGains(fiche) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) return false;
  return Array.isArray(fiche.progression) && fiche.progression.length > 0 && ('gains_sante' in fiche || 'gains_chakra' in fiche);
}

/**
 * Colonnes de `personnage` qui portent l'armure de la fiche (décision R95, migration 0055), et la colonne de l'ancienne personnage_armure dont chacune
 * reprend la valeur (armureDesArmures, serveur/base-vivante.mjs#CONVERSIONS).
 */
export const COLONNES_DE_L_ARMURE = Object.freeze({
  armure_id: 'armure_id',
  armure_amelioration_id: 'amelioration_id',
  armure_elementaire_id: 'armure_elementaire_id',
  armure_amelioration_elementaire_id: 'amelioration_elementaire_id',
});

/**
 * Les emplacements d'armure dans l'ordre du tableau FABRICATION (armure_emplacement.ordre, sans le bouclier ; test/fiche-armure.test.mjs les compare à
 * la base) : la conversion d'une ancienne liste `armures` garde la ligne du premier. « armure-complete » est aussi, dans personnage_armure_partie, la
 * solidité unique d'une armure à solidité unifiée (décision R95).
 */
export const EMPLACEMENTS_D_ARMURE = Object.freeze(['armure-complete', 'casque', 'torse', 'bras-gauche', 'bras-droit', 'jambe-gauche', 'jambe-droit']);
export const ARMURE_ENTIERE = EMPLACEMENTS_D_ARMURE[0];

const rangDEmplacement = (id) => (EMPLACEMENTS_D_ARMURE.includes(id) ? EMPLACEMENTS_D_ARMURE.indexOf(id) : EMPLACEMENTS_D_ARMURE.length);
const vide = (v) => v === null || v === undefined || v === '';
const memeArmure = (a, b) => Object.values(COLONNES_DE_L_ARMURE).every((c) => (vide(a[c]) ? null : a[c]) === (vide(b[c]) ? null : b[c]));

/**
 * L'armure d'une ancienne liste `armures` (lignes de personnage_armure : emplacement_id, armure_id, amelioration_id, armure_elementaire_id,
 * amelioration_elementaire_id) dans le nouveau format (décision R95) : { colonnes (COLONNES_DE_L_ARMURE : la ligne du premier emplacement, l'armure
 * complète d'abord ; toutes à null sans ligne), retirees (les autres lignes qui ne portent pas la même armure, ou pas la même amélioration ou le même
 * élément, dans l'ordre des emplacements) }. La même règle que la reconstruction de la base vivante et que la migration 0055.
 */
export function armureDesArmures(lignes) {
  const portees = (Array.isArray(lignes) ? lignes : []).filter((l) => l && typeof l === 'object' && !vide(l.armure_id))
    .sort((a, b) => rangDEmplacement(a.emplacement_id) - rangDEmplacement(b.emplacement_id));
  const gardee = portees[0] ?? {};
  const colonnes = Object.fromEntries(Object.entries(COLONNES_DE_L_ARMURE).map(([cle, ancienne]) => [cle, vide(gardee[ancienne]) ? null : gardee[ancienne]]));
  return { colonnes, retirees: portees.slice(1).filter((l) => !memeArmure(l, gardee)) };
}

/**
 * Les lignes datées de `instant` à ajouter aux notes pour les pièces d'une ancienne liste `armures` que la fiche ne garde pas (armureDesArmures :
 * « retirees ») ; `noms` : { armure(id), emplacement(id) } rendent les noms (l'id sinon). Une ligne de retrait (préfixe PREFIXE_DE_RETRAIT), de nature
 * « piece_armure » : la page /fiche/ la compte dans son bandeau.
 */
export function lignesDesPiecesRetirees(retirees, instant, noms = {}) {
  return (retirees ?? []).map((l) => ligneDeRetrait({
    nature: 'piece_armure', id: l.armure_id, nom: noms.armure?.(l.armure_id) ?? null, emplacement: noms.emplacement?.(l.emplacement_id) ?? l.emplacement_id,
  }, instant));
}

/**
 * Vrai si la fiche porte à la fois une liste `armures` non vide (une armure par emplacement, avant la migration 0055) et l'une des nouvelles clés de
 * l'armure (COLONNES_DE_L_ARMURE, `armure_parties`) : comme progressionAvecGains, l'envoi d'une page d'avant restée ouverte, qui a repris les nouvelles
 * clés d'une réponse du service ; le service refuse (409) plutôt que de choisir entre les deux.
 */
export function armuresAvecArmure(fiche) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) return false;
  return Array.isArray(fiche.armures) && fiche.armures.length > 0 && [...Object.keys(COLONNES_DE_L_ARMURE), 'armure_parties'].some((c) => c in fiche);
}

/**
 * La fiche sans les clés des tables retirées (PARTIES_RETIREES), converties sans rien perdre : une `progression` reçue (page restée ouverte, fichier
 * exporté avant la migration 0045) donne gains_sante et gains_chakra (gainsDeLaProgression) quand la fiche ne les a pas. Si elle les a, ils sont
 * gardés et la progression est jetée : une progression vide n'est que le reste de la fiche vide d'une page d'avant, qui a repris les deux totaux d'une
 * réponse du service ; une progression NON vide ne se concilie pas avec eux (progressionAvecGains) et le service la refuse avant de convertir (409) ;
 * seule la page /fiche/, pour un fichier importé, la jette. De même une liste `armures` (avant la migration 0055) donne l'armure de la fiche
 * (armureDesArmures) quand la fiche n'a aucune des nouvelles clés, et chaque pièce qu'elle ne garde pas, une ligne datée de `instant` dans les notes
 * (lignesDesPiecesRetirees, `noms` pour les nommer) ; une liste vide est jetée, une liste non vide avec les nouvelles clés est refusée par le service
 * (armuresAvecArmure) et jetée par la page. Une fiche sans clé retirée est rendue telle quelle (le même objet) ; jamais modifiée en place.
 * @param {object} fiche
 * @param {{ instant?: string, noms?: { armure?: (id: string) => string | null, emplacement?: (id: string) => string | null } }} [options]
 *   `instant` : ISO 8601 UTC à la seconde (la date des lignes ajoutées aux notes) ; sans lui, une pièce retirée n'est pas notée
 */
export function sansPartiesRetirees(fiche, { instant = null, noms = {} } = {}) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) return fiche;
  if (!Object.keys(PARTIES_RETIREES).some((cle) => cle in fiche)) return fiche;
  const { progression, armures, ...reste } = fiche;
  if (progression !== undefined && !('gains_sante' in reste) && !('gains_chakra' in reste)) Object.assign(reste, gainsDeLaProgression(progression));
  if (armures !== undefined && ![...Object.keys(COLONNES_DE_L_ARMURE), 'armure_parties'].some((c) => c in reste)) {
    const { colonnes, retirees } = armureDesArmures(armures);
    Object.assign(reste, colonnes);
    if (retirees.length && instant) reste.notes = ajouterAuxNotes(reste.notes, lignesDesPiecesRetirees(retirees, instant, noms));
  }
  return reste;
}

/**
 * Une fiche neuve : feuille blanche, pas une règle. Les colonnes obligatoires de `personnage` reçoivent leur valeur de départ (mono-classe, 0 XP,
 * alignement, bourse, ambidextrie et gains de niveau à zéro), les listes sont vides ; le reste (race, magies…) est à choisir.
 */
export function ficheVide(nom = '') {
  return {
    nom,
    mode_classe: 'mono',
    xp: 0,
    alignement_loyal: 0,
    alignement_chaotique: 0,
    alignement_bon: 0,
    alignement_mauvais: 0,
    bourse_pp: 0,
    bourse_ro: 0,
    bourse_rf: 0,
    ambidextrie: 0,
    gains_sante: 0,
    gains_chakra: 0,
    ...Object.fromEntries(Object.keys(PARTIES_DE_FICHE).map((cle) => [cle, []])),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Retraits (décision R42) : un don, une spécialité (avec les dons choisis qui en dépendent), un sort ou un métier que les règles suppriment est retiré
// des fiches qui l'utilisent, et une ligne datée par élément s'ajoute à la fin de `notes` (« NOTE », cellule BA53 de la fiche auto) : le joueur s'en
// souvient et voit qu'il doit s'adapter à la nouvelle règle. Un élément seulement modifié (renommé…) reste dans la fiche : elle n'en garde que l'id.
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Ce qui suit la date d'une ligne de retrait : la page /fiche/ reconnaît ces lignes à ce préfixe. */
export const PREFIXE_DE_RETRAIT = 'Retrait (règles modifiées) : ';

/**
 * Natures d'un élément retiré, dans l'ordre des lignes d'une fiche : métier, spécialité, don, sort, arme (décision R52 : une arme supprimée, comme R42),
 * objet (R60), pièce d'armure (R95 : une fiche ne porte plus qu'une armure complète).
 */
export const ORDRE_DES_NATURES = Object.freeze(['metier', 'specialite', 'capacite', 'sort', 'arme', 'objet', 'piece_armure']);

/** Le jour (UTC) d'un instant au format des colonnes `*_le` (« 2026-10-11T08:30:00Z » → « 11/10/2026 ») ; lève une Error sur un instant mal formé. */
export function jourDuRetrait(instant) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}Z$/.exec(typeof instant === 'string' ? instant : '');
  if (!m || Number.isNaN(Date.parse(instant))) throw new Error(`instant mal formé : ${instant} (AAAA-MM-JJTHH:MM:SSZ attendu)`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** « « A » », « « A » et « B » », « « A », « B » et « C » ». */
const enumeration = (noms) => {
  const cites = noms.map((n) => `« ${n} »`);
  return cites.length > 1 ? `${cites.slice(0, -1).join(', ')} et ${cites.at(-1)}` : cites.join('');
};
const positif = (n) => typeof n === 'number' && n > 0;

/**
 * L'élément retiré, en mots : sa nature, son nom (l'id quand le nom manque), puis entre parenthèses ce qui le situe (les parties absentes sont omises) :
 *   don        : « le don « Botte secrète » (classe Bretteur des dunes, spécialité LAME COURBE, niveau 20) » ;
 *   spécialité : « la spécialité « LAME COURBE » (classe X, avec les dons choisis « A » et « B ») » (`dons` : ceux de la fiche qui partent avec elle) ;
 *   sort       : « le sort « Boule de feu » (magie Feu, NPM 2, 2 NM sur cette fiche dont 1 de livre et 1 du MJ) » (des faits, rien sur ce qu'ils deviennent) ;
 *   métier     : « le métier « Forgeron » » ;
 *   arme       : « l'arme « Katana » (ÉPÉES, arme 1) » (décision R52) ;
 *   objet      : « l'objet « Corde (1m) » (inventaire) » : un composant supprimé de la base, que la fiche garde sous son nom (décision R60) ;
 *   pièce      : « la pièce d'armure « Armure Cuir/Peau » (Torse) » : une pièce que la fiche ne porte plus, elle n'a plus qu'une armure (décision R95).
 * @param {{ nature: 'metier' | 'specialite' | 'capacite' | 'sort' | 'arme' | 'objet' | 'piece_armure', id: string, emplacement?: string | null, famille?: string | null, rang?: number | null, nom?: string | null, classe?: string | null, specialite?: string | null,
 *   niveau?: number | null, magie?: string | null, npm?: number | null, nm?: number | null, nm_livre?: number | null, nm_cadeau?: number | null,
 *   dons?: string[] }} d
 */
export function descriptionDuRetrait(d) {
  const nom = d.nom ?? d.id;
  const parties = [];
  let tete;
  if (d.nature === 'capacite') {
    tete = `le don « ${nom} »`;
    if (d.classe) parties.push(`classe ${d.classe}`);
    if (d.specialite) parties.push(`spécialité ${d.specialite}`);
    if (d.niveau !== null && d.niveau !== undefined) parties.push(`niveau ${d.niveau}`);
  } else if (d.nature === 'specialite') {
    tete = `la spécialité « ${nom} »`;
    if (d.classe) parties.push(`classe ${d.classe}`);
    const dons = d.dons ?? [];
    if (dons.length) parties.push(`${dons.length > 1 ? 'avec les dons choisis' : 'avec le don choisi'} ${enumeration(dons)}`);
  } else if (d.nature === 'sort') {
    tete = `le sort « ${nom} »`;
    if (d.magie) parties.push(`magie ${d.magie}`);
    if (d.npm !== null && d.npm !== undefined) parties.push(`NPM ${d.npm}`);
    if (positif(d.nm)) {
      const dont = [positif(d.nm_livre) && `${d.nm_livre} de livre`, positif(d.nm_cadeau) && `${d.nm_cadeau} du MJ`].filter(Boolean);
      parties.push(`${d.nm} NM sur cette fiche${dont.length ? ` dont ${dont.join(' et ')}` : ''}`);
    }
  } else if (d.nature === 'metier') {
    tete = `le métier « ${nom} »`;
  } else if (d.nature === 'arme') {
    tete = `l’arme « ${nom} »`;
    if (d.famille) parties.push(d.famille);
    if (d.rang !== null && d.rang !== undefined) parties.push(`arme ${d.rang}`);
  } else if (d.nature === 'objet') {
    tete = `l’objet « ${nom} »`;
    if (d.emplacement) parties.push(d.emplacement);
  } else if (d.nature === 'piece_armure') {
    tete = `la pièce d’armure « ${nom} »`;
    if (d.emplacement) parties.push(d.emplacement);
  } else {
    throw new Error(`nature de retrait inconnue : ${d.nature}`);
  }
  return parties.length ? `${tete} (${parties.join(', ')})` : tete;
}

/**
 * La ligne ajoutée aux notes d'une fiche pour un élément retiré, datée du jour de `instant` : neutre (une création perdue par un conflit à la
 * reconstruction n'a pas été « supprimée »), et sans dire quoi choisir (un choix dissous donne le survivant d'office).
 */
export const ligneDeRetrait = (d, instant) =>
  `[${jourDuRetrait(instant)}] ${PREFIXE_DE_RETRAIT}${descriptionDuRetrait(d)} ${d.nature === 'objet'
    // décision R60 : l'objet reste dans la fiche sous son nom (« objet supprimé de la base, veuillez la mettre à jour »)
    ? 'a été supprimé de la base ; il reste dans la fiche sous son nom : veuillez la mettre à jour.'
    : d.nature === 'piece_armure'
      // décision R95 : une seule armure complète par fiche, avec son amélioration et son élément ; ses parties n'ont plus que leur solidité
      ? 'n’est plus portée : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.'
      : 'n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.'}`;

/** Ordre des retraits d'une fiche : par nature (ORDRE_DES_NATURES), puis par nom ; le même sur le site de dev et à la reconstruction. */
export const ordreDesRetraits = (a, b) => ORDRE_DES_NATURES.indexOf(a.nature) - ORDRE_DES_NATURES.indexOf(b.nature)
  || String(a.nom ?? a.id).localeCompare(String(b.nom ?? b.id), 'fr', { numeric: true })
  || String(a.id).localeCompare(String(b.id));

/** Les notes suivies des lignes données, une par ligne : le texte du joueur n'est jamais touché (il reste un préfixe exact du résultat). */
export function ajouterAuxNotes(notes, lignes) {
  const ajout = lignes.join('\n');
  if (notes === null || notes === undefined || notes === '') return ajout;
  return `${notes}${notes.endsWith('\n') ? '' : '\n'}${ajout}`;
}

const LIGNE_DE_RETRAIT = /^\[(\d{2})\/(\d{2})\/(\d{4})\] Retrait \(règles modifiées\) : (.+)$/;

/** Les lignes de retrait des notes (les autres lignes sont ignorées) : [{ jour: 'JJ/MM/AAAA', ligne, texte }] (texte : ce qui suit le préfixe). */
export function retraitsDesNotes(notes) {
  if (!notes) return [];
  const retraits = [];
  for (const ligne of String(notes).split(/\r?\n/)) {
    const m = LIGNE_DE_RETRAIT.exec(ligne);
    if (m) retraits.push({ jour: `${m[1]}/${m[2]}/${m[3]}`, ligne, texte: m[4] });
  }
  return retraits;
}

/** Les lignes de retrait de `notesApres` absentes de `notesAvant` (texte exact) : ce qu'une fiche a perdu depuis qu'on l'a ouverte. */
export function nouveauxRetraits(notesAvant, notesApres) {
  const vues = new Set(retraitsDesNotes(notesAvant).map((r) => r.ligne));
  return retraitsDesNotes(notesApres).filter((r) => !vues.has(r.ligne));
}

const iso = (jour) => jour.split('/').reverse().join('-');

/**
 * Le bandeau de la page /fiche/ : null sans ligne de retrait ; sinon { nombre, dernier (le jour le plus récent, JJ/MM/AAAA), texte }.
 */
export function resumeDesRetraits(notes) {
  const retraits = retraitsDesNotes(notes);
  if (!retraits.length) return null;
  const dernier = retraits.reduce((a, r) => (iso(r.jour) > iso(a) ? r.jour : a), retraits[0].jour);
  const nombre = retraits.length;
  const texte = nombre === 1
    ? `Règles modifiées : 1 élément retiré de cette fiche le ${dernier}.`
    : `Règles modifiées : ${nombre} éléments retirés de cette fiche (dernier retrait le ${dernier}).`;
  return { nombre, dernier, texte };
}

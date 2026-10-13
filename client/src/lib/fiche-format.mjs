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
  'personnage_metier_bonus', 'personnage_progression', 'personnage_capacite', 'personnage_sort', 'personnage_maitrise_arme', 'personnage_arme', 'personnage_armure',
  'personnage_bouclier_materiau', 'personnage_accessoire', 'personnage_inventaire', 'personnage_ceinture', 'groupe', 'groupe_membre',
]);

/** Clé du JSON → table de détail. Toute table de la section 13 qui cite `personnage` en fait partie, sauf HORS_FICHE (test serveur-fiches). */
export const PARTIES_DE_FICHE = Object.freeze({
  classes: 'personnage_classe',
  caracteristiques: 'personnage_caracteristique',
  competences: 'personnage_competence',
  metier_bonus: 'personnage_metier_bonus',
  progression: 'personnage_progression',
  capacites: 'personnage_capacite',
  sorts: 'personnage_sort',
  maitrises_armes: 'personnage_maitrise_arme',
  armes: 'personnage_arme',
  armures: 'personnage_armure',
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
 * Une fiche neuve : feuille blanche, pas une règle. Les colonnes obligatoires de `personnage` reçoivent leur valeur de départ (brouillon,
 * mono-classe, 0 XP, alignement, bourse et ambidextrie à zéro), les listes sont vides ; le reste (race, magies…) est à choisir.
 */
export function ficheVide(nom = '') {
  return {
    nom,
    statut: 'brouillon',
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

/** Natures d'un élément retiré, dans l'ordre des lignes d'une fiche : métier, spécialité, don, sort, arme (décision R52 : une arme supprimée, comme R42). */
export const ORDRE_DES_NATURES = Object.freeze(['metier', 'specialite', 'capacite', 'sort', 'arme']);

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
 *   arme       : « l'arme « Katana » (ÉPÉES, arme 1) » (décision R52).
 * @param {{ nature: 'metier' | 'specialite' | 'capacite' | 'sort' | 'arme', id: string, famille?: string | null, rang?: number | null, nom?: string | null, classe?: string | null, specialite?: string | null,
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
  `[${jourDuRetrait(instant)}] ${PREFIXE_DE_RETRAIT}${descriptionDuRetrait(d)} n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.`;

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

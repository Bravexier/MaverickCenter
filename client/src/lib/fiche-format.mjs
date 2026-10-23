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
  'personnage_entrainement', 'personnage_acquis_choix', 'personnage_resistance_choix', 'personnage_metier_bonus', 'personnage_capacite', 'personnage_sort',
  'personnage_maitrise_choix', 'personnage_arme', 'personnage_armure_partie', 'personnage_accessoire', 'personnage_inventaire', 'personnage_ceinture', 'groupe',
  'groupe_membre',
]);

/** Clé du JSON → table de détail. Toute table de la section 13 qui cite `personnage` en fait partie, sauf HORS_FICHE (test serveur-fiches). */
export const PARTIES_DE_FICHE = Object.freeze({
  classes: 'personnage_classe',
  caracteristiques: 'personnage_caracteristique',
  competences: 'personnage_competence',
  metier_bonus: 'personnage_metier_bonus',
  capacites: 'personnage_capacite',
  sorts: 'personnage_sort',
  // une famille d'armes par point de maîtrise à choisir d'une source (décisions R148 à R153, migration 0076) : les points et les dés se calculent
  maitrise_choix: 'personnage_maitrise_choix',
  armes: 'personnage_arme',
  armure_parties: 'personnage_armure_partie',
  accessoires: 'personnage_accessoire',
  inventaire: 'personnage_inventaire',
  ceinture: 'personnage_ceinture',
  entrainements: 'personnage_entrainement',
  acquis_choix: 'personnage_acquis_choix',
  // la résistance au choix d'une ligne du tableau de la race (décision R124, migration 0069 : Drakos orange), ou à une magie au choix ou tirée d'un don
  // (décision R137, migration 0071 : Ocultomancien « Résilience », Anansi d'Arcane)
  resistance_choix: 'personnage_resistance_choix',
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
 * `statut` (brouillon, validé, archivé) : la fiche n'a plus de statut (demande du propriétaire, migration 0038). `nom` et `texte` d'un accessoire (le nom
 * donné à l'objet, l'effet hors table) : décision R97, migration 0060 ; ce qu'ils portaient est noté, daté, dans la fiche (accessoiresGardes).
 * `entrainement` (le texte libre de R71) : une ligne de texte de l'entraînement (décision R104, migration 0062 : entrainementEnLignes) ; `acquis` d'une
 * compétence : l'Acquis se calcule, les points saisis sont notés, datés, dans la fiche (acquisRetires). `nm_cadeau` d'un sort (les NM du MJ, sort par
 * sort : décision R26) : les NM du MJ sont ceux de la fiche, personnage.nm_mj, la somme de ses nm_cadeau (décision R118, migration 0066 : nmDuMjDesSorts) ;
 * le NM de chaque sort ne change pas. `arme_famille_id` d'un choix d'acquis (l'arme choisie du bonus « de l'arme choisie », décision R119) : l'arme du
 * bonus est la famille de la maîtrise au choix de la classe (décision R152, migration 0076) ; l'ancienne est notée, datée, avec les anciens dés
 * (décision R153 : maitrisesDAvant) ; la compétence du choix reste.
 */
export const COLONNES_RETIREES = Object.freeze({
  personnage: Object.freeze(['statut', 'entrainement']), personnage_accessoire: Object.freeze(['nom', 'texte']), personnage_competence: Object.freeze(['acquis']),
  personnage_sort: Object.freeze(['nm_cadeau']), personnage_acquis_choix: Object.freeze(['arme_famille_id']),
});

/**
 * Les NM du MJ d'une fiche d'avant la migration 0066, notés sort par sort (`nm_cadeau`, décision R26) : leur somme, les NM du MJ de la fiche (décision
 * R118 : « Les NM du MJ […] vaudront donc pour toute la fiche »). La même somme pour la base vivante (serveur/base-vivante.mjs), une fiche reçue d'une
 * page d'avant et la migration 0066.
 */
export const nmDuMjDesSorts = (sorts) => (Array.isArray(sorts) ? sorts : []).reduce((n, x) => n + (x && typeof x === 'object' ? entierPositif(x.nm_cadeau) : 0), 0);

/**
 * Vrai si la fiche reçue porte à la fois des NM du MJ sur ses sorts (`nm_cadeau` positif, avant la décision R118) et ceux de la fiche (`nm_mj`) : une
 * page d'avant qui a repris les NM du MJ d'une réponse, puis en a noté sur un sort ; on ne sait pas s'ils s'ajoutent, le service refuse (409).
 */
export const nmDuMjAvecCadeaux = (fiche) => Boolean(fiche) && typeof fiche === 'object' && 'nm_mj' in fiche && nmDuMjDesSorts(fiche.sorts) > 0;

/**
 * Les lignes d'entraînement d'un ancien texte d'entraînement (personnage.entrainement, décision R71) : une ligne de texte libre par ligne non vide du
 * texte, sans ses blancs de bord, rien pour un texte vide (décision R104 : « un texte libre pour les dons évènementiels »). La même conversion pour la
 * base vivante (serveur/base-vivante.mjs), une fiche reçue d'une page d'avant et la case L42 d'un classeur qu'on ne lit pas en compétences.
 */
export const entrainementEnLignes = (texte) => (typeof texte === 'string' ? texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [])
  .map((l, i) => ({ rang: i + 1, competence_id: null, valeur: null, texte: l }));

/**
 * Vrai si la fiche reçue porte à la fois l'ancien texte d'entraînement (non vide) et des lignes d'entraînement (décision R104) : une page d'avant qui a
 * repris les lignes d'une réponse ; on ne sait pas les concilier, le service refuse (409).
 */
export const entrainementAvecLignes = (fiche) => typeof fiche?.entrainement === 'string' && fiche.entrainement.trim() !== ''
  && Array.isArray(fiche?.entrainements) && fiche.entrainements.length > 0;

/**
 * Ce qu'une fiche perd avec l'acquis saisi de ses compétences (décision R104, réponse « Lus dans les dons » : les acquis saisis d'avant sont retirés et
 * listés dans une note datée) : un descripteur par compétence dont l'acquis saisi est positif, dans l'ordre reçu. `noms.competence(id)` rend son nom.
 */
export function acquisRetires(competences, noms = {}) {
  return (Array.isArray(competences) ? competences : [])
    .filter((c) => entierPositif(c?.acquis) > 0)
    .map((c) => ({ nature: 'acquis', id: c.competence_id, nom: noms.competence?.(c.competence_id) ?? null, valeur: entierPositif(c.acquis) }));
}

/**
 * Tables que les règles ont retirées de la section 13, avec leur ancienne clé dans le JSON d'une fiche (PARTIES_RETIREES : l'inverse). Leurs lignes ne
 * se perdent jamais sans le dire : la base vivante les convertit à sa reconstruction (serveur/base-vivante.mjs, CONVERSIONS), et une fiche qui porte
 * encore leur clé (fichier exporté avant, page restée ouverte) est convertie à sa lecture (sansPartiesRetirees : service et page /fiche/).
 * `personnage_progression` (une ligne par niveau atteint) : les gains de niveau sont deux totaux, personnage.gains_sante et gains_chakra (décision R73,
 * migration 0045), la somme de ses lignes (gainsDeLaProgression).
 * `personnage_armure` (une armure par emplacement : armure complète, casque, torse…) : la fiche porte une seule armure complète, son amélioration, son
 * élément et l'amélioration de l'élément (décision R95, migration 0055 : COLONNES_DE_L_ARMURE de personnage), la ligne du premier emplacement
 * (armureDesArmures) ; la pièce gardée qui devient l'armure complète et chaque autre pièce différente sont notées, datées, dans la fiche
 * (lignesDesPiecesRetirees).
 * `personnage_bouclier_materiau` (jusqu'à trois matériaux et leurs quantités) : le bouclier est une forme et une matière (décision R96, migration 0060 :
 * personnage.bouclier_materiau_id), le matériau du premier rang (matiereDuBouclier) ; chaque autre matériau est noté, daté, dans la fiche.
 * `personnage_maitrise_arme` (les dés par famille d'armes) : plus rien ne se saisit par famille, une famille se choisit par point de chaque source
 * (décision R148, migration 0076 : personnage_maitrise_choix) ; les anciens dés, et l'arme choisie de R119, sont notés en une ligne datée, aucun choix
 * n'est posé (décision R153 : maitrisesDAvant, ligneDeRetrait).
 */
export const TABLES_RETIREES = Object.freeze({
  personnage_progression: 'progression', personnage_armure: 'armures', personnage_bouclier_materiau: 'bouclier_materiaux', personnage_maitrise_arme: 'maitrises_armes',
});
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
 * Les emplacements d'armure dans l'ordre du tableau FABRICATION (armure_emplacement.ordre, sans le bouclier ; test/fiche-format-retirees.test.mjs les compare
 * à la base) : la conversion d'une ancienne liste `armures` garde la ligne du premier. « armure-complete » est aussi, dans personnage_armure_partie, la
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
 * élément, dans l'ordre des emplacements), transformee (la ligne gardée quand c'est une pièce qui devient l'armure complète : ni l'armure complète, ni
 * la même armure sur les six parties ; null sinon) }. La même règle que la reconstruction de la base vivante et que la migration 0055.
 */
export function armureDesArmures(lignes) {
  const portees = (Array.isArray(lignes) ? lignes : []).filter((l) => l && typeof l === 'object' && !vide(l.armure_id))
    .sort((a, b) => rangDEmplacement(a.emplacement_id) - rangDEmplacement(b.emplacement_id));
  const gardee = portees[0] ?? {};
  const colonnes = Object.fromEntries(Object.entries(COLONNES_DE_L_ARMURE).map(([cle, ancienne]) => [cle, vide(gardee[ancienne]) ? null : gardee[ancienne]]));
  const complete = !portees.length || gardee.emplacement_id === ARMURE_ENTIERE
    || EMPLACEMENTS_D_ARMURE.slice(1).every((e) => portees.some((l) => l.emplacement_id === e && memeArmure(l, gardee)));
  return { colonnes, retirees: portees.slice(1).filter((l) => !memeArmure(l, gardee)), transformee: complete ? null : gardee };
}

/**
 * Les lignes datées de `instant` à ajouter aux notes d'une fiche dont l'ancienne liste `armures` a été convertie (`conversion` : le résultat
 * d'armureDesArmures) : la pièce gardée qui devient l'armure complète (« transformee »), puis chaque pièce que la fiche ne garde pas (« retirees ») ;
 * `noms` : { armure(id), emplacement(id) } rendent les noms (l'id sinon). Des lignes de retrait (préfixe PREFIXE_DE_RETRAIT), de nature
 * « piece_armure » : la page /fiche/ les compte dans son bandeau.
 */
export function lignesDesPiecesRetirees(conversion, instant, noms = {}) {
  return retraitsDeLArmure(conversion, noms).map((d) => ligneDeRetrait(d, instant));
}

/**
 * Les descripteurs de retrait (nature « piece_armure », descriptionDuRetrait) d'une ancienne liste `armures` convertie (`conversion` : le résultat
 * d'armureDesArmures), dans l'ordre de lignesDesPiecesRetirees : la reconstruction de la base vivante les range avec ceux de la décision R42
 * (serveur/fiches-retraits.mjs#noterLesRetraits : notes et liste de /api/etat).
 */
export function retraitsDeLArmure({ colonnes = {}, retirees = [], transformee = null } = {}, noms = {}) {
  const retrait = (l, d) => ({
    nature: 'piece_armure', id: l.armure_id, nom: noms.armure?.(l.armure_id) ?? null, emplacement: noms.emplacement?.(l.emplacement_id) ?? l.emplacement_id, ...d,
  });
  // une pièce de l'armure que la fiche garde, avec une autre amélioration ou un autre élément : seuls ceux-ci se perdent
  return [...(transformee ? [retrait(transformee, { devenue: true })] : []), ...retirees.map((l) => retrait(l, { armureGardee: l.armure_id === colonnes.armure_id }))];
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

/** Colonnes de `personnage` qui portent le bouclier en plus de sa forme (décision R96, migration 0060). */
export const COLONNES_DU_BOUCLIER = Object.freeze(['bouclier_materiau_id', 'bouclier_amelioration_id', 'bouclier_solidite']);

/**
 * La matière du bouclier d'une ancienne liste `bouclier_materiaux` (lignes de personnage_bouclier_materiau : rang, materiau_id, quantite) dans le format
 * de la migration 0060 (décision R96 : une forme et une matière) : { materiau_id (celui du premier rang ; null sans ligne), retires (les lignes des
 * autres rangs, dans l'ordre) }. La même règle que la reconstruction de la base vivante et que la migration 0060.
 */
export function matiereDuBouclier(lignes) {
  const tries = (Array.isArray(lignes) ? lignes : []).filter((l) => l && typeof l === 'object' && !vide(l.materiau_id))
    .sort((a, b) => entierPositif(a.rang) - entierPositif(b.rang));
  return { materiau_id: tries[0]?.materiau_id ?? null, retires: tries.slice(1) };
}

/**
 * Les descripteurs de retrait (nature « materiau_bouclier ») des matériaux qu'un bouclier converti ne garde pas (`conversion` : le résultat de
 * matiereDuBouclier) ; `noms.ressource(id)` rend le nom d'un matériau (l'id sinon).
 */
export function retraitsDuBouclier({ materiau_id = null, retires = [] } = {}, noms = {}) {
  const matiere = materiau_id ? noms.ressource?.(materiau_id) ?? materiau_id : null;
  return retires.map((l) => ({ nature: 'materiau_bouclier', id: l.materiau_id, nom: noms.ressource?.(l.materiau_id) ?? null, quantite: entierPositif(l.quantite) || null, matiere }));
}

/**
 * Vrai si la fiche porte à la fois une liste `bouclier_materiaux` non vide (avant la migration 0060) et l'une des nouvelles clés du bouclier
 * (COLONNES_DU_BOUCLIER) : comme armuresAvecArmure, l'envoi d'une page d'avant restée ouverte ; le service refuse (409).
 */
export function bouclierAvecMatiere(fiche) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) return false;
  return Array.isArray(fiche.bouclier_materiaux) && fiche.bouclier_materiaux.length > 0 && COLONNES_DU_BOUCLIER.some((c) => c in fiche);
}

/** Les emplacements d'accessoire et leur nom ; Ceinture et Autre n'existent plus sur la fiche (décision R97, migration 0060). */
export const NOMS_DES_EMPLACEMENTS_D_ACCESSOIRE = Object.freeze({
  chef: 'Chef', collier: 'Collier', 'bracelet-1': 'Bracelet 1', 'bracelet-2': 'Bracelet 2', 'bague-1': 'Bague 1', 'bague-2': 'Bague 2', ceinture: 'Ceinture', autre: 'Autre',
});
export const EMPLACEMENTS_D_ACCESSOIRE_RETIRES = Object.freeze(['ceinture', 'autre']);

const ecarte = (a) => EMPLACEMENTS_D_ACCESSOIRE_RETIRES.includes(a.emplacement) || vide(a.accessoire_effet_id);
const accessoireAConvertir = (a) => Boolean(a) && typeof a === 'object' && ('nom' in a || 'texte' in a || ecarte(a));

/**
 * Les accessoires d'une fiche dans le format de la migration 0060 (décision R97 : six emplacements, ni nom, ni effet hors table) : { lignes (les
 * accessoires gardés, sans `nom` ni `texte`), retraits (un descripteur « accessoire » par accessoire écarté — emplacement Ceinture ou Autre, effet hors
 * table seul — ou qui perd son nom ou son effet hors table, dans l'ordre de la liste) }. `noms.accessoire(id)` rend le libellé d'un effet. La même règle
 * que la reconstruction de la base vivante (serveur/base-vivante.mjs, LIGNES_ECARTEES) et que la migration 0060.
 */
export function accessoiresGardes(lignes, noms = {}) {
  const gardes = [];
  const retraits = [];
  for (const a of Array.isArray(lignes) ? lignes : []) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
      gardes.push(a);
      continue;
    }
    const { nom = null, texte = null, ...reste } = a;
    const nomEcrit = vide(nom) ? null : String(nom);
    const texteEcrit = vide(texte) ? null : String(texte);
    const sorti = ecarte(a);
    if (!sorti) gardes.push(reste);
    if (sorti || nomEcrit || texteEcrit) {
      retraits.push({
        nature: 'accessoire', id: a.emplacement, nom: nomEcrit, emplacement: NOMS_DES_EMPLACEMENTS_D_ACCESSOIRE[a.emplacement] ?? a.emplacement,
        effet: vide(a.accessoire_effet_id) ? null : noms.accessoire?.(a.accessoire_effet_id) ?? a.accessoire_effet_id, texte: texteEcrit, ecarte: sorti,
      });
    }
  }
  return { lignes: gardes, retraits };
}

/**
 * Un nombre de dés en notation (colonne « Dés » des maîtrises) : « D10 » et 3 → « 3D10 » ; chaque option d'un dé au choix (Pugilat « D6/D8/D10 »,
 * selon la Force) → « 3D6/3D8/3D10 » ; sans dé écrit (ARME DE MONSTRES) → « 3 dés ». La notation de lib/fiche-moteur.mjs#notationDesDes (la même :
 * test/fiche-format-retirees.test.mjs), ici sans dépendance pour le service.
 */
export function desEnNotation(de, nombre) {
  if (!de) return `${nombre} dé${nombre > 1 ? 's' : ''}`;
  return String(de).split('/').map((d) => (/^D\d+$/i.test(d.trim()) ? `${nombre}${d.trim().toUpperCase()}` : d.trim())).join('/');
}

/**
 * Ce que la refonte des maîtrises d'armes (décisions R148 à R153, migration 0076) retire d'une fiche d'avant : ses dés par famille (lignes de l'ancienne
 * personnage_maitrise_arme : arme_famille_id, des) et l'arme choisie du bonus « de l'arme choisie » de ses choix d'acquis (personnage_acquis_choix
 * .arme_famille_id, décision R119 : désormais la famille de la maîtrise au choix de la classe, R152). Décision R153 : « Tout remettre à choisir », avec
 * « une note datée de l'ancien tableau » ; aucun choix n'est posé. Un descripteur de retrait de nature « maitrises_armes » (une ligne par fiche :
 * ligneDeRetrait), ou null quand la fiche n'avait ni dés ni arme choisie :
 *   familles : [{ id, nom, des }] dans l'ordre des familles (arme_famille.ordre ; une famille inconnue après, par id), `des` en notation (desEnNotation) ;
 *   armes    : [{ source, don, classe, famille }] dans l'ordre reçu, une par don et par famille.
 * `noms.famille(id)` rend { nom, de, ordre } d'une famille (nom : le bandeau, « ÉPÉES » ; de : arme_famille.de_brut) ; `noms.don(id)` rend { nom, classe }
 * d'un don. Sans eux, l'id tient lieu de nom et les dés s'écrivent « 3 dés ». La même règle pour la base vivante (serveur/base-vivante.mjs, CONVERSIONS)
 * et pour une fiche reçue d'une page d'avant ou importée d'un fichier exporté avant (sansPartiesRetirees).
 */
export function maitrisesDAvant(maitrises, acquisChoix = [], noms = {}) {
  const famille = (id) => noms.famille?.(id) ?? null;
  const rang = (id) => famille(id)?.ordre ?? Number.MAX_SAFE_INTEGER;
  const familles = (Array.isArray(maitrises) ? maitrises : [])
    .filter((l) => l && typeof l === 'object' && !vide(l.arme_famille_id) && entierPositif(l.des) > 0)
    .sort((a, b) => rang(a.arme_famille_id) - rang(b.arme_famille_id) || String(a.arme_famille_id).localeCompare(String(b.arme_famille_id)))
    .map((l) => ({ id: l.arme_famille_id, nom: famille(l.arme_famille_id)?.nom ?? l.arme_famille_id, des: desEnNotation(famille(l.arme_famille_id)?.de ?? null, entierPositif(l.des)) }));
  const vues = new Set();
  const armes = [];
  for (const a of Array.isArray(acquisChoix) ? acquisChoix : []) {
    if (!a || typeof a !== 'object' || vide(a.arme_famille_id)) continue;
    const cle = `${a.source}\u0000${a.arme_famille_id}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    const don = vide(a.source) ? null : noms.don?.(a.source) ?? null;
    armes.push({ source: a.source ?? null, don: don?.nom ?? a.source ?? null, classe: don?.classe ?? null, famille: famille(a.arme_famille_id)?.nom ?? a.arme_famille_id });
  }
  return familles.length || armes.length ? { nature: 'maitrises_armes', id: 'maitrises_armes', nom: null, familles, armes } : null;
}

/**
 * Vrai si la fiche reçue porte à la fois des maîtrises d'avant la migration 0076 (une liste `maitrises_armes` non vide, ou l'arme choisie d'un choix
 * d'acquis) et les choix de maîtrise (`maitrise_choix`, décision R148) : comme armuresAvecArmure, l'envoi d'une page d'avant restée ouverte, qui a
 * repris les nouvelles clés d'une réponse du service ; le service refuse (409) plutôt que de noter une seconde fois les anciennes maîtrises.
 */
export function maitrisesAvecChoix(fiche) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche) || !('maitrise_choix' in fiche)) return false;
  return (Array.isArray(fiche.maitrises_armes) && fiche.maitrises_armes.length > 0)
    || (Array.isArray(fiche.acquis_choix) && fiche.acquis_choix.some((a) => a && typeof a === 'object' && !vide(a.arme_famille_id)));
}

/**
 * La fiche sans les clés des tables retirées (PARTIES_RETIREES), converties sans rien perdre : une `progression` reçue (page restée ouverte, fichier
 * exporté avant la migration 0045) donne gains_sante et gains_chakra (gainsDeLaProgression) quand la fiche ne les a pas. Si elle les a, ils sont
 * gardés et la progression est jetée : une progression vide n'est que le reste de la fiche vide d'une page d'avant, qui a repris les deux totaux d'une
 * réponse du service ; une progression NON vide ne se concilie pas avec eux (progressionAvecGains) et le service la refuse avant de convertir (409) ;
 * seule la page /fiche/, pour un fichier importé, la jette. De même une liste `armures` (avant la migration 0055) donne l'armure de la fiche
 * (armureDesArmures) quand la fiche n'a aucune des nouvelles clés, et la pièce devenue l'armure complète et chaque pièce qu'elle ne garde pas, une ligne datée de `instant` dans les notes
 * (lignesDesPiecesRetirees, `noms` pour les nommer) ; une liste vide est jetée, une liste non vide avec les nouvelles clés est refusée par le service
 * (armuresAvecArmure) et jetée par la page. De même une liste `bouclier_materiaux` (avant la migration 0060) donne la matière du bouclier
 * (matiereDuBouclier) quand la fiche n'a aucune des nouvelles clés du bouclier (COLONNES_DU_BOUCLIER), chaque autre matériau une ligne datée
 * (retraitsDuBouclier) ; et des accessoires qui portent encore un nom, un effet hors table, ou un emplacement retiré (Ceinture, Autre) sont convertis
 * (accessoiresGardes), ce qu'ils perdent noté. Des sorts qui portent encore leurs NM du MJ (`nm_cadeau`, avant la migration 0066) les perdent : leur
 * somme devient les NM du MJ de la fiche (nmDuMjDesSorts, décision R118) quand elle n'a pas `nm_mj` (avec, positifs : refusés par le service,
 * nmDuMjAvecCadeaux, et jetés par la page). Des maîtrises d'avant la migration 0076 (une liste `maitrises_armes`, l'arme choisie `arme_famille_id`
 * d'un choix d'acquis) sont retirées, notées en une ligne datée quand la fiche n'a pas `maitrise_choix` (maitrisesDAvant, décision R153 ; aucun choix
 * n'est posé ; la compétence d'un choix d'acquis reste) ; avec `maitrise_choix` : refusées par le service (maitrisesAvecChoix) et jetées par la page.
 * Une fiche sans rien à convertir est rendue telle quelle (le même objet) ; jamais modifiée en place.
 * @param {object} fiche
 * @param {{ instant?: string, noms?: { armure?: (id: string) => string | null, emplacement?: (id: string) => string | null,
 *   ressource?: (id: string) => string | null, accessoire?: (id: string) => string | null, competence?: (id: string) => string | null,
 *   famille?: (id: string) => { nom: string, de: string | null, ordre: number } | null, don?: (id: string) => { nom: string, classe: string | null } | null },
 *   notes?: string | null }} [options]
 *   `instant` : ISO 8601 UTC à la seconde (la date des lignes ajoutées aux notes) ; sans lui, une pièce retirée n'est pas notée ; `notes` : celles de
 *   la fiche enregistrée, auxquelles les lignes s'ajoutent quand la fiche reçue n'a pas de `notes` (un envoi partiel ne les efface pas)
 */
export function sansPartiesRetirees(fiche, { instant = null, noms = {}, notes = null } = {}) {
  if (!fiche || typeof fiche !== 'object' || Array.isArray(fiche)) return fiche;
  const accessoires = Array.isArray(fiche.accessoires) && fiche.accessoires.some(accessoireAConvertir);
  // décision R104 : l'ancien texte d'entraînement et l'acquis saisi des compétences
  const entrainement = 'entrainement' in fiche;
  const acquis = Array.isArray(fiche.competences) && fiche.competences.some((c) => c && 'acquis' in c);
  // décision R118 : les NM du MJ notés sort par sort
  const cadeaux = Array.isArray(fiche.sorts) && fiche.sorts.some((x) => x && typeof x === 'object' && 'nm_cadeau' in x);
  // décisions R152 et R153 : l'arme choisie d'un choix d'acquis (R119)
  const armesChoisies = Array.isArray(fiche.acquis_choix) && fiche.acquis_choix.some((a) => a && typeof a === 'object' && !Array.isArray(a) && 'arme_famille_id' in a);
  if (!Object.keys(PARTIES_RETIREES).some((cle) => cle in fiche) && !accessoires && !entrainement && !acquis && !cadeaux && !armesChoisies) return fiche;
  const { progression, armures, bouclier_materiaux, maitrises_armes, ...reste } = fiche;
  const retraits = [];
  if (progression !== undefined && !('gains_sante' in reste) && !('gains_chakra' in reste)) Object.assign(reste, gainsDeLaProgression(progression));
  if (armures !== undefined && ![...Object.keys(COLONNES_DE_L_ARMURE), 'armure_parties'].some((c) => c in reste)) {
    const conversion = armureDesArmures(armures);
    Object.assign(reste, conversion.colonnes);
    retraits.push(...retraitsDeLArmure(conversion, noms));
  }
  if (bouclier_materiaux !== undefined && !COLONNES_DU_BOUCLIER.some((c) => c in reste)) {
    const conversion = matiereDuBouclier(bouclier_materiaux);
    reste.bouclier_materiau_id = conversion.materiau_id;
    retraits.push(...retraitsDuBouclier(conversion, noms));
  }
  if (accessoires) {
    const conversion = accessoiresGardes(reste.accessoires, noms);
    reste.accessoires = conversion.lignes;
    retraits.push(...conversion.retraits);
  }
  if (entrainement) {
    const { entrainement: texte } = reste;
    delete reste.entrainement;
    // la liste vide d'une page d'avant qui a repris une réponse (ficheVide) ne s'oppose pas au texte : il devient ses lignes (entrainementAvecLignes)
    if (!Array.isArray(reste.entrainements) || !reste.entrainements.length) reste.entrainements = entrainementEnLignes(texte);
  }
  if (acquis) {
    retraits.push(...acquisRetires(reste.competences, noms));
    // (une ligne qui n'est pas un objet reste telle quelle : la vérification de forme du service la refuse, 400)
    reste.competences = reste.competences.map((c) => (c && typeof c === 'object' && !Array.isArray(c) ? (({ acquis: _a, ...x }) => x)(c) : c));
  }
  if (cadeaux) {
    if (!('nm_mj' in reste)) reste.nm_mj = nmDuMjDesSorts(reste.sorts);
    reste.sorts = reste.sorts.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? (({ nm_cadeau: _c, ...y }) => y)(x) : x));
  }
  if (maitrises_armes !== undefined || armesChoisies) {
    // décision R153 : les anciens dés et l'arme choisie, une ligne datée ; jetés sans note avec les choix de maîtrise (maitrisesAvecChoix)
    const d = 'maitrise_choix' in reste ? null : maitrisesDAvant(maitrises_armes, armesChoisies ? reste.acquis_choix : [], noms);
    if (d) retraits.push(d);
    if (armesChoisies) {
      reste.acquis_choix = reste.acquis_choix.map((a) => (a && typeof a === 'object' && !Array.isArray(a) ? (({ arme_famille_id: _f, ...x }) => x)(a) : a));
    }
  }
  if (retraits.length && instant) reste.notes = ajouterAuxNotes('notes' in reste ? reste.notes : notes, retraits.map((d) => ligneDeRetrait(d, instant)));
  return reste;
}

/**
 * Une fiche neuve : feuille blanche, pas une règle. Les colonnes obligatoires de `personnage` reçoivent leur valeur de départ (mono-classe, 0 XP,
 * alignement, bourse, ambidextrie, gains de niveau et NM du MJ à zéro), les listes sont vides ; le reste (race, magies…) est à choisir.
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
    nm_mj: 0,
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
 * objet (R60), pièce d'armure (R95 : une fiche ne porte plus qu'une armure complète), matériau de bouclier (R96 : un bouclier n'a plus qu'une forme et une
 * matière), accessoire (R97 : plus d'emplacement Ceinture ni Autre, ni de nom, ni d'effet hors table), acquis saisi (R104), maîtrises d'armes d'avant la
 * refonte (R153 : la dernière ligne, une par fiche).
 */
export const ORDRE_DES_NATURES = Object.freeze([
  'metier', 'specialite', 'capacite', 'sort', 'arme', 'objet', 'piece_armure', 'materiau_bouclier', 'accessoire', 'acquis', 'maitrises_armes',
]);

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
 *   sort       : « le sort « Boule de feu » (magie Feu, NPM 2, 2 NM sur cette fiche dont 1 de livre) » (des faits, rien sur ce qu'ils deviennent ; les NM
 *                du MJ sont ceux de la fiche, décision R118 : ils restent quand le sort part) ;
 *   métier     : « le métier « Forgeron » » ;
 *   arme       : « l'arme « Katana » (ÉPÉES, arme 1) » (décision R52) ;
 *   objet      : « l'objet « Corde (1m) » (inventaire) » : un composant supprimé de la base, que la fiche garde sous son nom (décision R60) ;
 *   pièce      : « la pièce d'armure « Armure Cuir/Peau » (Torse) » : une pièce que la fiche ne porte plus, elle n'a plus qu'une armure (décision R95) ;
 *                avec `devenue`, la pièce gardée, devenue l'armure complète de la fiche (armureDesArmures : « transformee ») ; avec `armureGardee`, une
 *                pièce de l'armure gardée, dont l'amélioration ou l'élément propres se perdent ;
 *   matériau   : « le matériau de bouclier « Fer » (×2) » : un matériau que le bouclier ne garde pas, il n'a plus qu'une matière (décision R96) ;
 *   accessoire : « l'accessoire « Bague » (Ceinture, effet « Dégâts magie +2 », effet hors table « Brille la nuit ») » ou, sans nom, « l'accessoire de
 *                l'emplacement Chef (…) » (décision R97) ; avec `ecarte`, l'accessoire n'est plus porté ; sinon il ne perd que son nom et son effet hors table ;
 *   acquis     : « l'acquis saisi en Arc (7) » : les points d'acquis saisis d'une compétence, l'Acquis se calculant (décision R104 ; `valeur`) ;
 *   maîtrises  : « les maîtrises d'armes d'avant la refonte (ÉPÉES 3D10, ARC 2D8 ; arme choisie : Flétrisseur (Tueur) ÉPÉES) » (décision R153 :
 *                maitrisesDAvant ; `familles`, `armes`).
 * @param {{ nature: 'metier' | 'specialite' | 'capacite' | 'sort' | 'arme' | 'objet' | 'piece_armure' | 'materiau_bouclier' | 'accessoire' | 'acquis' | 'maitrises_armes', id: string, emplacement?: string | null, famille?: string | null, rang?: number | null, nom?: string | null, classe?: string | null, specialite?: string | null,
 *   niveau?: number | null, magie?: string | null, npm?: number | null, nm?: number | null, nm_livre?: number | null,
 *   dons?: string[], devenue?: boolean, armureGardee?: boolean, quantite?: number | null, matiere?: string | null, effet?: string | null, texte?: string | null,
 *   ecarte?: boolean, valeur?: number }} d
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
      parties.push(`${d.nm} NM sur cette fiche${positif(d.nm_livre) ? ` dont ${d.nm_livre} de livre` : ''}`);
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
  } else if (d.nature === 'materiau_bouclier') {
    tete = `le matériau de bouclier « ${nom} »`;
    if (positif(d.quantite)) parties.push(`×${d.quantite}`);
  } else if (d.nature === 'accessoire') {
    tete = d.nom ? `l’accessoire « ${d.nom} »` : `l’accessoire de l’emplacement ${d.emplacement ?? d.id}`;
    if (d.nom && d.emplacement) parties.push(d.emplacement);
    if (d.effet) parties.push(`effet « ${d.effet} »`);
    if (d.texte) parties.push(`effet hors table « ${d.texte} »`);
  } else if (d.nature === 'acquis') {
    tete = `l’acquis saisi en ${nom}`;
    if (positif(d.valeur)) parties.push(`${d.valeur}`);
  } else if (d.nature === 'maitrises_armes') {
    tete = 'les maîtrises d’armes d’avant la refonte';
    const texte = texteDesMaitrisesDAvant(d);
    if (texte) parties.push(texte);
  } else {
    throw new Error(`nature de retrait inconnue : ${d.nature}`);
  }
  return parties.length ? `${tete} (${parties.join(', ')})` : tete;
}

/**
 * Le texte des maîtrises d'une fiche d'avant la refonte (descripteur de maitrisesDAvant) : « ÉPÉES 3D10, ARC 2D8 ; arme choisie : Flétrisseur (Tueur)
 * ÉPÉES » ; une partie absente est omise (pas de dés, pas d'arme choisie, la classe d'un don inconnue). Le même texte dit, à l'import d'un classeur,
 * les dés et l'arme choisie qu'il écrit et que la fiche ne reprend pas (lib/fiche-tableur-import.mjs, `nonRepris`).
 */
export const texteDesMaitrisesDAvant = (d) => {
  const armes = (d.armes ?? []).map((a) => [a.don, a.classe ? `(${a.classe})` : null, a.famille].filter(Boolean).join(' '));
  return [
    (d.familles ?? []).map((f) => `${f.nom} ${f.des}`).join(', '),
    armes.length ? `${armes.length > 1 ? 'armes choisies' : 'arme choisie'} : ${armes.join(', ')}` : '',
  ].filter(Boolean).join(' ; ');
};

/** Le début de la ligne de la décision R153, avant la date et le texte des maîtrises (la page /fiche/ peut la reconnaître). */
export const PREFIXE_DES_MAITRISES_D_AVANT = 'Maîtrises d\'armes avant la refonte';

/**
 * La ligne ajoutée aux notes d'une fiche pour un élément retiré, datée du jour de `instant` : neutre (une création perdue par un conflit à la
 * reconstruction n'a pas été « supprimée »), et sans dire quoi choisir (un choix dissous donne le survivant d'office). Les maîtrises d'armes d'avant
 * la refonte (décision R153) ont leur ligne à elles, au texte du cahier de la refonte : « Maîtrises d'armes avant la refonte (2026-10-22) : ÉPÉES 3D10,
 * ARC 2D8 ; arme choisie : Flétrisseur (Tueur) ÉPÉES ».
 */
export const ligneDeRetrait = (d, instant) => (d.nature === 'maitrises_armes'
  ? `${PREFIXE_DES_MAITRISES_D_AVANT} (${jourDuRetrait(instant).split('/').reverse().join('-')}) : ${texteDesMaitrisesDAvant(d)}`
  : `[${jourDuRetrait(instant)}] ${PREFIXE_DE_RETRAIT}${descriptionDuRetrait(d)} ${d.nature === 'objet'
    // décision R60 : l'objet reste dans la fiche sous son nom (« objet supprimé de la base, veuillez la mettre à jour »)
    ? 'a été supprimé de la base ; il reste dans la fiche sous son nom : veuillez la mettre à jour.'
    : d.nature === 'piece_armure'
      // décision R95 : une seule armure complète par fiche, avec son amélioration et son élément ; ses parties n'ont plus que leur solidité
      ? `${d.devenue ? 'est devenue l’armure complète de la fiche'
        : d.armureGardee ? 'reste l’armure de la fiche, sans l’amélioration ni l’élément propres à cette pièce' : 'n’est plus portée'} : une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.`
      : d.nature === 'materiau_bouclier'
        // décision R96 : le bouclier de la liste, une forme et une matière (le matériau du premier rang)
        ? `n’est plus dans le bouclier : un bouclier n’a plus qu’une forme et une matière${d.matiere ? ` (« ${d.matiere} », son premier matériau)` : ''}. Adaptez la fiche.`
        : d.nature === 'accessoire'
          // décision R97 : six emplacements, un effet de la table des accessoires, ni nom ni effet hors table
          ? (d.ecarte
            ? 'n’est plus porté : la fiche n’a plus d’emplacement Ceinture ni Autre, et un accessoire a toujours un effet de la table des accessoires. Adaptez la fiche.'
            : 'reste porté avec son effet : la fiche ne garde plus le nom d’un accessoire ni son effet hors table.')
          : d.nature === 'acquis'
            // décision R104 : l'Acquis se calcule (entraînement, dons, métier, accessoires)
            ? 'n’est plus saisi : l’Acquis se calcule (entraînement, dons, métier, accessoires). Notez l’entraînement dans ses lignes.'
            : 'n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.'}`);

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

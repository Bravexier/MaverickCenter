// Modèle de l'édition depuis le site de dev (demande du propriétaire ; client/serveur/edition.mjs, docs/serveur.md, « Édition ») : quelles colonnes de
// quelles tables une page peut modifier, avec leur type de champ, et comment une page désigne un champ (attribut `data-ed`). Le service n'accepte
// que ces colonnes ; tout ce qui en dépend dans la base (colonnes typées, tables de détail, page du wiki) est recalculé par le service, jamais saisi.
// Entités créables (ENTITES) : métier, race, classe, peuple, spécialité, don de classe, espèce et carte de monstre ; supprimables : métier, spécialité,
// don de classe (retirés des fiches de personnage qui les ont, avec une note datée : décision R42, annonceDesFiches), espèce et carte de monstre.
// Fonctions et constantes pures, sans dépendance (sauf lib/dons-edition.mjs, pur lui aussi) : partagées par le service, les gabarits Astro et le
// script des pages (src/scripts/edition.mjs).
import { NIVEAUX_DE_DON, TYPES_DE_DON_SAISIE } from './dons-edition.mjs';

export { NIVEAUX_DE_DON, NIVEAU_DES_SPECIALITES, SPECIALITES_MAX, TYPES_DE_DON_SAISIE } from './dons-edition.mjs';

/**
 * Types de champ :
 *   ligne    texte sur une ligne (retours à la ligne remplacés par une espace) ;
 *   texte    texte long : paragraphes séparés par une ligne vide, puces « - », retours à la ligne gardés (lib/sort-format.mjs#blocsDeTexte) ;
 *   markdown corps Markdown d'une page (guide) ;
 *   entier   nombre entier (signe permis) ;
 *   choix    une valeur d'une liste : `choix` ([{ valeur, libelle }], contrôlée ici) ou `liste` (nom d'une liste de GET /api/edition/listes/, lue dans
 *            la base vivante et contrôlée par le service).
 * Options : `requis` (vide refusé), `vide` (valeur enregistrée pour un champ vidé quand la colonne n'accepte pas NULL : '' ou 'Rien'),
 * `min` / `max` (entier).
 */
/** Catégories d'un monstre (colonne `monstre.categorie`) : les libellés de lib/monstre-champs.mjs#CATEGORIES (test/serveur-edition-bestiaire.test.mjs). */
export const CATEGORIES_DE_MONSTRE = [
  { valeur: 'ennemi_simple', libelle: 'Ennemi simple' },
  { valeur: 'mini_boss', libelle: 'Mini-boss' },
  { valeur: 'boss', libelle: 'Boss' },
];
/** `monstre.variable` : la carte dit « Ses stats varient selon son échelle de puissance. » (1) ou non (0). */
export const STATS_VARIABLES = [
  { valeur: '0', libelle: 'Non' },
  { valeur: '1', libelle: 'Oui : « Ses stats varient selon son échelle de puissance. »' },
];

export const TABLES = {
  metier: {
    libelle: 'Métier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description', vide: '' },
      // bonus : « +3% Esquive, +2% Parade OU Esquive » ; un nom de compétence la lie (son Acquis), « +N INI » l'initiative (décision R33)
      bonus_brut: { type: 'ligne', libelle: 'Bonus', vide: '' },
      // artisanat (décision R34) : un texte libre et deux caractéristiques (vide : rien à fabriquer) ; « Artisanat possible » en est recalculé
      artisanat_texte: { type: 'ligne', libelle: 'Artisanat' },
      test_carac_1_id: { type: 'choix', libelle: 'Caractéristique d’artisanat 1', liste: 'caracteristiquesDArtisanat' },
      test_carac_2_id: { type: 'choix', libelle: 'Caractéristique d’artisanat 2', liste: 'caracteristiquesDArtisanat' },
      // objets de départ (décision R35) : « , » entre deux objets, « OU » entre les options d'un choix
      equipement_brut: { type: 'ligne', libelle: 'Équipement supplémentaire', vide: 'Rien' },
      avantage_brut: { type: 'texte', libelle: 'Avantage possible' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  // Magies : présentation, description, explication (la table des relations entre magies ne se modifie pas : demande du propriétaire)
  magie: {
    libelle: 'Magie',
    colonnes: {
      banniere: { type: 'texte', libelle: 'Bannière' },
      description: { type: 'texte', libelle: 'Présentation' },
      description_physique: { type: 'texte', libelle: 'Description physique' },
      explication: { type: 'texte', libelle: 'Explication' },
      sante_offerte: { type: 'entier', libelle: 'Santé offerte', min: 0 },
      chakra_offert: { type: 'entier', libelle: 'Chakra offert', min: 0 },
      caracteristique_brut: { type: 'ligne', libelle: 'Caractéristique bonus' },
      barre4_texte: { type: 'texte', libelle: '4ème barre' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  magie_role: {
    libelle: 'Rôle de magie',
    colonnes: { role_brut: { type: 'ligne', libelle: 'Rôle', requis: true } },
  },
  mode_hyper_effet: {
    libelle: 'Capacité Mode Hyper',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de la capacité' },
      effet: { type: 'texte', libelle: 'Effet', requis: true },
    },
  },
  // Races : la phrase de présentation, tout l'onglet de la race (textes, valeurs de départ, dons, tableau en panneaux, mode Hyper) ;
  // les magies innées et les relations entre peuples ont leurs opérations (`magies_innees`, `relations`)
  race: {
    libelle: 'Race',
    colonnes: { presentation: { type: 'texte', libelle: 'Présentation' } },
  },
  race_onglet: {
    libelle: 'Onglet de la race',
    colonnes: {
      description_generale: { type: 'texte', libelle: 'Présentation générale', requis: true },
      histoire: { type: 'texte', libelle: 'Histoire', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      sante_depart: { type: 'entier', libelle: 'Santé de départ', requis: true },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', requis: true },
      barriere_bonus: { type: 'entier', libelle: 'Barrière bonus', requis: true },
      vitesse_sol: { type: 'entier', libelle: 'Vitesse au sol', requis: true },
      vitesse_nage: { type: 'entier', libelle: 'Vitesse de nage', requis: true },
      avantages: { type: 'texte', libelle: 'Avantages', requis: true },
      inconvenients: { type: 'texte', libelle: 'Inconvénients', requis: true },
      don_base: { type: 'texte', libelle: 'Don de base', requis: true },
      dons_tableau_titre: { type: 'ligne', libelle: 'Titre du tableau des dons' },
    },
  },
  race_don: {
    libelle: 'Don racial',
    colonnes: {
      etiquette: { type: 'ligne', libelle: 'Ethnie' },
      nom: { type: 'ligne', libelle: 'Nom du don' },
      texte: { type: 'texte', libelle: 'Don', requis: true },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  race_don_tableau_colonne: {
    libelle: 'En-tête du tableau des dons',
    colonnes: { libelle: { type: 'ligne', libelle: 'En-tête', requis: true } },
  },
  race_don_tableau_cellule: {
    libelle: 'Case du tableau des dons',
    colonnes: { valeur: { type: 'texte', libelle: 'Case', requis: true } },
  },
  // Classes : bandeau (don de départ), présentation, chose à savoir, équipement de départ ; spécialités ; dons (« capacités »)
  classe: {
    libelle: 'Classe',
    colonnes: {
      sante_depart: { type: 'entier', libelle: 'Santé de départ', requis: true, min: 0 },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', requis: true, min: 0 },
      barriere_depart: { type: 'entier', libelle: 'Barrière de départ', requis: true, min: 0 },
      description: { type: 'texte', libelle: 'Présentation' },
      chose_a_savoir: { type: 'texte', libelle: 'Chose à savoir' },
      maitrise_arme: { type: 'texte', libelle: 'Maîtrise des armes (une ligne « - » par maîtrise)' },
      maitrise_armure: { type: 'texte', libelle: 'Maîtrise des armures (une ligne « - » par maîtrise)' },
      arme_depart: { type: 'ligne', libelle: 'Arme de départ' },
      armure_depart: { type: 'ligne', libelle: 'Armure de départ' },
      inventaire_depart: { type: 'ligne', libelle: 'Inventaire de départ (objets séparés par « , », « A OU B »)' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  specialite: {
    libelle: 'Spécialité',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  capacite: {
    libelle: 'Don de classe',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type_brut: { type: 'ligne', libelle: 'Type (« Actif (1 fois/combat) »)' },
      effet: { type: 'texte', libelle: 'Effet' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  // Sorts : chaque case du tableau et du détail (une ligne peut avoir un effet dû aux NM dans plusieurs colonnes)
  sort: {
    libelle: 'Sort',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type_brut: { type: 'ligne', libelle: 'Type', requis: true },
      cout_brut: { type: 'ligne', libelle: 'Coût', requis: true },
      portee_brut: { type: 'ligne', libelle: 'Portée', requis: true },
      zone_brut: { type: 'ligne', libelle: 'Zone', requis: true },
      dsb_brut: { type: 'ligne', libelle: 'D/S/B' },
      effets: { type: 'texte', libelle: 'Effets secondaires' },
      remarque: { type: 'texte', libelle: 'Remarque' },
      texte_niveau5: { type: 'texte', libelle: 'Texte du sort (niveau 5)' },
    },
  },
  // Bestiaire (/bestiaire/, components/bestiaire/ ; demande du propriétaire : créer, modifier, supprimer un monstre) : une espèce, une carte de monstre,
  // le texte de chaque rubrique d'une carte (les valeurs typées en sont tirées par le service : lib/monstre-champs.mjs#valeursDeLaCarte), les blocs et le
  // butin d'une espèce. Les échelles s'écrivent comme dans le doc (« EP2 », « EP1 - 10 » pour une espèce, « 2 », « 1-10 » pour une carte).
  monstre_espece: {
    libelle: 'Espèce de monstre',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de l’espèce', requis: true },
      ep_brut: { type: 'ligne', libelle: 'Échelle(s) de puissance de l’espèce (« EP2 », « EP1 - 10 »)', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      lieu_brut: { type: 'ligne', libelle: 'Lieu de rencontre (lieux séparés par des virgules)' },
      complement: { type: 'texte', libelle: 'Complément (après le lieu de rencontre)' },
    },
  },
  monstre: {
    libelle: 'Monstre',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom du monstre', requis: true },
      echelle_brut: { type: 'ligne', libelle: 'Échelle de puissance (« 2 », « 1-10 »)', requis: true },
      categorie: { type: 'choix', libelle: 'Catégorie', requis: true, choix: CATEGORIES_DE_MONSTRE },
      type_brut: { type: 'ligne', libelle: 'Type (« Vermine », « Non-mort »)' },
      alignement_brut: { type: 'ligne', libelle: 'Alignement' },
      variable: { type: 'choix', libelle: 'Stats selon l’échelle de puissance', requis: true, choix: STATS_VARIABLES },
    },
  },
  monstre_rubrique: {
    libelle: 'Rubrique de la carte',
    colonnes: {
      texte: { type: 'texte', libelle: 'Texte de la rubrique', vide: '' },
    },
  },
  monstre_espece_bloc: {
    libelle: 'Bloc de l’espèce',
    colonnes: {
      texte: { type: 'texte', libelle: 'Texte du bloc', vide: '' },
    },
  },
  monstre_butin: {
    libelle: 'Butin',
    colonnes: {
      texte: { type: 'ligne', libelle: 'Butin possible', requis: true },
    },
  },
  // Pages du guide et du Codex (texteDePageModifiable) : titre et texte (Markdown réécrit par l'éditeur visuel, lib/markdown-edition.mjs) ; le service
  // refuse toute autre page (celles des races, magies, classes et métiers suivent leurs tables)
  page: {
    libelle: 'Page',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Titre', requis: true },
      corps_md: { type: 'markdown', libelle: 'Texte', requis: true },
    },
  },
};

/** Première source des pages du Codex (tools/docs/codex.py, docs/codex.md). */
export const SOURCE_DU_CODEX = 'Google Doc « CODEX Maverick »';
/**
 * Une page dont le titre et le texte se modifient (lignes `page` de TABLES) : une page du guide, ou une page du Codex (demande du propriétaire :
 * « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi ») = type `lore` tiré du Google Doc « CODEX
 * Maverick » (première source) ; pas la description des relations entre les peuples (lore aussi, mais tirée du classeur des races). Les autres pages
 * suivent leurs tables.
 */
export const texteDePageModifiable = (type, premiereSource) => type === 'guide' || (type === 'lore' && premiereSource === SOURCE_DU_CODEX);

/**
 * Entités qu'une page peut créer ou supprimer (`suppression`), avec les champs demandés à la création (`champs`, même format que les colonnes de
 * TABLES ; ce qui n'est pas demandé prend sa valeur « vide » ou une valeur de départ visible, « À compléter. ») ; `nouveau` : le titre du formulaire
 * et des messages (« Nouvelle spécialité »), par défaut « Nouveau <libellé> ».
 */
const champsDe = (table, colonnes) => Object.fromEntries(colonnes.map((c) => [c, TABLES[table].colonnes[c]]));
/** Nature d'une race (demande du propriétaire : une race hybride peut être créée avant sa classe raciale ; lib/race-kinds.mjs). */
export const NATURES_DE_RACE = [
  { valeur: 'pure', libelle: 'Race pure' },
  { valeur: 'hybride', libelle: 'Race hybride (elle aura sa classe raciale)' },
];
/** Le mot-clé d'une race hybride créée depuis le site : il la range parmi les hybrides tant qu'elle n'a pas sa classe raciale. */
export const MOT_CLE_RACE_HYBRIDE = 'race hybride';

export const ENTITES = {
  metier: {
    table: 'metier',
    libelle: 'métier',
    champs: champsDe('metier', ['nom', 'description', 'bonus_brut', 'artisanat_texte', 'test_carac_1_id', 'test_carac_2_id', 'equipement_brut', 'avantage_brut']),
    suppression: true,
  },
  race: {
    table: 'race',
    libelle: 'race',
    champs: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      nature: { type: 'choix', libelle: 'Nature', requis: true, choix: NATURES_DE_RACE },
      presentation: { type: 'texte', libelle: 'Présentation (une phrase)' },
    },
  },
  // une classe parmi les catégories du Sommaire ; une classe raciale (« Classe Hybride Animal ») porte le nom de sa race, une race hybride qui n'en a pas
  classe: {
    table: 'classe',
    libelle: 'classe',
    champs: {
      categorie_id: { type: 'choix', libelle: 'Catégorie', requis: true, liste: 'categories' },
      nom: { type: 'ligne', libelle: 'Nom (une classe raciale prend celui de sa race)' },
      race_id: { type: 'choix', libelle: 'Race hybride (classe raciale seulement)', liste: 'racesSansClasse' },
      sante_depart: { type: 'entier', libelle: 'Santé de départ', min: 0 },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', min: 0 },
      barriere_depart: { type: 'entier', libelle: 'Barrière de départ', min: 0 },
    },
  },
  // un peuple de la matrice « Relation entre les races » (une race sans peuple n'a pas de relations : Anansi, Farfadet, Goleois)
  peuple: {
    table: 'peuple',
    libelle: 'peuple',
    champs: {
      nom: { type: 'ligne', libelle: 'Nom du peuple', requis: true },
      race_id: { type: 'ligne', libelle: 'Race', requis: true },
    },
  },
  // Bestiaire : une espèce (une ligne du tableau tant qu'elle n'a pas de carte), une carte de monstre dans une espèce, créée avec les rubriques vides de
  // la disposition la plus courante du doc (lib/monstre-champs.mjs#GABARIT_DE_CARTE). Identifiants tirés du nom une fois, puis figés et jamais
  // réutilisés ; une espèce ne se supprime qu'une fois ses cartes supprimées. Aucune fiche de personnage ne cite un monstre (pas de R42).
  monstre_espece: {
    table: 'monstre_espece',
    libelle: 'espèce',
    nouveau: 'Nouvelle espèce',
    suppression: true,
    champs: champsDe('monstre_espece', ['nom', 'ep_brut', 'description', 'lieu_brut']),
  },
  monstre: {
    table: 'monstre',
    libelle: 'monstre',
    suppression: true,
    champs: {
      espece_id: { type: 'choix', libelle: 'Espèce', requis: true, liste: 'especesDeMonstres' },
      ...champsDe('monstre', ['nom', 'echelle_brut', 'categorie', 'type_brut', 'alignement_brut']),
    },
  },
  // une spécialité d'une classe (D11) : créée avec son don de spécialité du niveau 10 (sans lui elle n'aurait ni colonne ni bannière) ; supprimée avec tous
  // ses dons. `classe_id` est donné par le bouton de la page, contrôlé par le service.
  specialite: {
    table: 'specialite',
    libelle: 'spécialité',
    nouveau: 'Nouvelle spécialité',
    suppression: true,
    champs: {
      classe_id: { type: 'ligne', libelle: 'Classe', requis: true },
      nom: { type: 'ligne', libelle: 'Nom de la spécialité', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      don_nom: { type: 'ligne', libelle: 'Nom du don de spécialité (niveau 10)', requis: true },
      don_type: { type: 'choix', libelle: 'Type du don de spécialité', requis: true, choix: TYPES_DE_DON_SAISIE },
      don_precision: { type: 'ligne', libelle: 'Précision du type (« 2 fois/combat »)' },
      don_effet: { type: 'texte', libelle: 'Effet du don de spécialité', aide: 's’il dit « considérer comme classe magique », la spécialité donne +4 AM (R7)' },
    },
  },
  // un don de classe (« capacité », D11) : sa place vient du bouton (classe, spécialité, ou le don `avec` dont il devient une option : même ligne, même
  // niveau, même spécialité) ; sans `avec`, une nouvelle ligne à la fin de son niveau (lib/dons-edition.mjs#placeNouvelleLigne). `specialite_id` et
  // `avec` acceptent « @i » : la spécialité ou le don créé par l'opération i du même lot.
  capacite: {
    table: 'capacite',
    libelle: 'don',
    nouveau: 'Nouveau don',
    suppression: true,
    champs: {
      classe_id: { type: 'ligne', libelle: 'Classe', requis: true },
      specialite_id: { type: 'ligne', libelle: 'Spécialité (vide : hors spécialité)' },
      avec: { type: 'ligne', libelle: 'Au choix avec (vide : une nouvelle ligne)' },
      niveau: { type: 'choix', libelle: 'Niveau de classe', choix: NIVEAUX_DE_DON.map((n) => ({ valeur: String(n), libelle: `Niveau ${n}` })) },
      nom: { type: 'ligne', libelle: 'Nom du don', requis: true },
      type: { type: 'choix', libelle: 'Type', requis: true, choix: TYPES_DE_DON_SAISIE },
      precision: { type: 'ligne', libelle: 'Précision du type (« 2 fois/combat »)' },
      effet: { type: 'texte', libelle: 'Effet' },
    },
  },
};

export class ErreurValeur extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurValeur';
  }
}

/**
 * Valeur saisie → valeur enregistrée, d'après le type du champ ; lève ErreurValeur (message en français) si elle est refusée.
 * Texte : fins de ligne unifiées, espaces de bord retirées ; un champ vidé vaut `vide` s'il est défini, sinon NULL (absent = NULL).
 */
export function valeurDuChamp(champ, brute, nom = champ.libelle) {
  if (champ.type === 'entier') {
    if (brute === null || brute === undefined || String(brute).trim() === '') {
      if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
      return champ.vide ?? null;
    }
    const n = typeof brute === 'number' ? brute : Number(String(brute).trim().replace(/^\+/, ''));
    if (!Number.isInteger(n)) throw new ErreurValeur(`« ${nom} » : nombre entier attendu`);
    if (champ.min !== undefined && n < champ.min) throw new ErreurValeur(`« ${nom} » : au moins ${champ.min}`);
    if (champ.max !== undefined && n > champ.max) throw new ErreurValeur(`« ${nom} » : au plus ${champ.max}`);
    return n;
  }
  if (brute !== null && brute !== undefined && typeof brute !== 'string' && typeof brute !== 'number') throw new ErreurValeur(`« ${nom} » : texte attendu`);
  let texte = String(brute ?? '').replace(/\r\n?/g, '\n');
  if (champ.type === 'ligne' || champ.type === 'choix') texte = texte.replace(/\s*\n\s*/g, ' ');
  texte = champ.type === 'markdown' ? texte.replace(/\s+$/, '') : texte.trim();
  if (champ.type === 'choix' && champ.choix && texte !== '' && !champ.choix.some((c) => c.valeur === texte)) throw new ErreurValeur(`« ${nom} » : valeur hors de la liste`);
  if (texte === '') {
    if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
    return champ.vide ?? null;
  }
  return texte;
}

/** L'attribut `data-ed` d'un élément qui affiche un champ : ["table", {clé primaire}, "colonne"] en JSON. */
export const attributEd = (table, cle, colonne) => JSON.stringify([table, cle, colonne]);

/** Lit un attribut `data-ed` ; null s'il est illisible ou vise un champ hors du modèle. */
export function lireAttributEd(texte) {
  try {
    const [table, cle, colonne] = JSON.parse(texte);
    if (!TABLES[table]?.colonnes[colonne] || !cle || typeof cle !== 'object') return null;
    return { table, cle, colonne, champ: TABLES[table].colonnes[colonne] };
  } catch {
    return null;
  }
}

/** Clé de regroupement d'une ligne (table + clé primaire), indépendante de l'ordre des colonnes de la clé. */
export const cleDeLigne = (table, cle) =>
  `${table}\u0000${JSON.stringify(Object.entries(cle ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))}`;

/** Fiches nommées une à une dans l'annonce d'un lot, au plus (les autres sont comptées). */
const FICHES_ANNONCEES = 5;

/**
 * L'annonce, après un lot, des fiches de personnage dont il a retiré un élément supprimé (décision R42 ; réponse `fiches` de POST /api/edition/, au
 * format de serveur/fiches-retraits.mjs#noterLesRetraits : [{ fiche, retraits }]) : '' s'il n'y en a pas ; sinon
 * « Retiré de 2 fiches de personnage (une note datée le rappelle dans chacune) — Aldric : le don « X » (…) ; fiche de joueur n° 1 : le métier « Y ». »
 */
export function annonceDesFiches(fiches) {
  if (!Array.isArray(fiches) || !fiches.length) return '';
  const n = fiches.length;
  const tete = n === 1 ? 'Retiré de 1 fiche de personnage (une note datée le rappelle)' : `Retiré de ${n} fiches de personnage (une note datée le rappelle dans chacune)`;
  const detail = fiches.slice(0, FICHES_ANNONCEES).map((f) => `${f.fiche} : ${(f.retraits ?? []).join(', ')}`).join(' ; ');
  return `${tete} — ${detail}${n > FICHES_ANNONCEES ? ` et ${n - FICHES_ANNONCEES} autre(s)` : ''}.`;
}

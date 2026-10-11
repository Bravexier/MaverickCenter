// Modèle de l'édition depuis le site de dev (demande du propriétaire ; client/serveur/edition.mjs, docs/serveur.md, « Édition ») : quelles colonnes de
// quelles tables une page peut modifier, avec leur type de champ, et comment une page désigne un champ (attribut `data-ed`). Le service n'accepte
// que ces colonnes ; tout ce qui en dépend dans la base (colonnes typées, tables de détail, page du wiki) est recalculé par le service, jamais saisi.
// Fonctions et constantes pures, sans dépendance : partagées par le service, les gabarits Astro et le script des pages (src/scripts/edition.mjs).

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
  // Pages du guide : titre et texte (Markdown réécrit par l'éditeur visuel, lib/markdown-edition.mjs) ; le service refuse toute autre page (celles des
  // races, magies, classes et métiers suivent leurs tables)
  page: {
    libelle: 'Page',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Titre', requis: true },
      corps_md: { type: 'markdown', libelle: 'Texte', requis: true },
    },
  },
};

/**
 * Entités qu'une page peut créer ou supprimer, avec les champs demandés à la création (`champs`, même format que les colonnes de TABLES ; ce qui
 * n'est pas demandé prend sa valeur « vide » ou une valeur de départ visible, « À compléter. »).
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

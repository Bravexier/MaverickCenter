-- 0011-personnages : tables des vraies fiches de personnages, des groupes de jeu et de la visibilité (section 13 de data/schema.sql), et trois
-- constantes de la fiche. Migration ADDITIVE de structure et de données.
--   * Structure : utilisateur et ses rôles (mj, editeur, admin) ; personnage, de nature 'joueur' (à son propriétaire) ou 'pretire' (à personne,
--     visible par tous), avec sa visibilité ('privee', 'mj', 'tous') et ses partages à des utilisateurs désignés ; ses tables de choix (classes,
--     caractéristiques et leurs croix, compétences, progression, dons, sorts, maîtrises d'armes, armes, armures, bouclier, accessoires, inventaire) ;
--     groupe (one-shot ou campagne) et groupe_membre (une fiche inscrite au plus par membre et par groupe) ; vues v_personnage_niveau,
--     v_personnage_visible, v_groupe_controle et v_personnage_controle. Les tables restent vides dans data/rows : les fiches réelles vivent dans la
--     base du serveur. Rien de ce que la fiche CALCULE n'est stocké (docs/character-generator.md).
--   * Données : trois constantes de regle_constante lues dans la fiche auto V15.2.2 ou son guide, citées mot pour mot :
--     'sort.nm_ecart_niveau_global' (BDD!BB6 : « NM maximum : » niveau global − 1), 'alignement.ecart_axe' (Personnage!I4 : un axe penche à partir
--     d'un écart de 5), 'barriere.diviseur_chakra' (guide « Attributs » : « Chakra total divisé par 2 = Barrière totale »).

-- Personne qui se connecte au site. Connexion par Discord à la 1.0 (docs/feuille-de-route.md, « Authentification ») : on ne garde que l'identifiant
-- Discord (immuable) et le nom d'affichage, jamais de mot de passe ni de jeton. Un compte local de secours (administrateur) n'a pas d'identifiant Discord.
-- Tout utilisateur connecté est lecteur ; les autres rôles sont dans utilisateur_role.
CREATE TABLE utilisateur (
  id             TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- identifiant stable du site, jamais réutilisé
  discord_id     TEXT    UNIQUE CHECK (discord_id IS NULL OR (length(discord_id) > 0 AND discord_id NOT GLOB '*[^0-9]*')),   -- « snowflake » Discord ; NULL = compte local de secours
  nom_affichage  TEXT    NOT NULL CHECK (length(nom_affichage) > 0),
  cree_le        TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;

-- Rôles d'un utilisateur, cumulables (la correspondance rôle Discord -> rôle du site est une configuration, pas une donnée) :
-- 'mj' = maître du jeu (le « groupe MJ » : cible de la visibilité 'mj' d'une fiche), 'editeur' = modifie les règles (phase 2), 'admin' = voit et gère tout.
CREATE TABLE utilisateur_role (
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('mj', 'editeur', 'admin')),
  PRIMARY KEY (utilisateur_id, role)
) STRICT, WITHOUT ROWID;

CREATE INDEX utilisateur_role_role ON utilisateur_role (role);   -- « tous les MJ », « tous les administrateurs »

-- Une fiche de personnage : le haut de l'onglet Personnage (identité, magies, alignement, bourse, expérience) et les choix uniques.
-- Deux natures (demande du propriétaire) : la fiche d'un JOUEUR, qu'il crée pour son personnage (visible de lui seul et des administrateurs, sauf ce
-- qu'il ouvre : visibilité, partage, inscription dans un groupe), et le PRÉTIRÉ, qui n'appartient à personne et que tout le monde voit.
CREATE TABLE personnage (
  id                    TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- identifiant stable, jamais réutilisé (un personnage renommé le garde)
  nature                TEXT    NOT NULL CHECK (nature IN ('joueur', 'pretire')),
  proprietaire_id       TEXT    REFERENCES utilisateur(id),   -- joueur qui l'a créée ; NULL exactement pour un prétiré
  visibilite            TEXT    NOT NULL CHECK (visibilite IN ('privee', 'mj', 'tous')),
                                                    -- qui la voit EN PLUS du propriétaire, des administrateurs, des membres des groupes où elle est inscrite
                                                    -- et des utilisateurs désignés (personnage_partage) : 'privee' personne d'autre, 'mj' tous les MJ,
                                                    -- 'tous' tout utilisateur connecté (toujours le cas d'un prétiré) ; calcul : v_personnage_visible
  statut                TEXT    NOT NULL CHECK (statut IN ('brouillon', 'valide', 'archive')),   -- 'valide' : v_personnage_controle doit être vide pour elle
  nom                   TEXT    NOT NULL CHECK (length(nom) > 0),   -- « NOM » (F1)
  surnom                TEXT,                         -- « Surnom » (P1)
  lieu_origine          TEXT,                         -- « Lieu origine » (F3)
  race_id               TEXT    REFERENCES race(id),  -- « RACE » (I2) ; NULL tant que le brouillon ne l'a pas choisie
  ethnie_id             TEXT    REFERENCES ethnie(id),   -- don racial de la ligne « R » (C40, onglet « Bonus Race ») : l'ethnie, de la race choisie
  magie_innee_id        TEXT    REFERENCES magie(id), -- « Magie inn » (S2)
  magie_acquise_id      TEXT    REFERENCES magie(id), -- « Magie acq » (S3) ; NULL = pas de magie acquise (facultative, guide « Personnage »)
  caracteristique_magie_id TEXT REFERENCES caracteristique(id),   -- point de caractéristique de la magie innée quand elle ne le fixe pas
                                                    -- (magie.caracteristique_id NULL : Potentiel Illimité, « AU CHOIX ou ALEATOIRE ») ; NULL sinon
  dieu_choisi_id        TEXT    REFERENCES dieu(id),  -- « Dieu choisi » (S5) ; le dieu inné se déduit de la magie innée (magie_dieu), il n'est pas stocké
  metier_id             TEXT    REFERENCES metier(id),   -- don de la ligne « M » (C41, « Métier ? ») ; NULL = sans métier
  mode_classe           TEXT    NOT NULL CHECK (mode_classe IN ('mono', 'bi')),   -- « Mono classe » / « Bi classe » (BDD!K26) : figé à la création
                                                    -- (la fiche le fige dès 201 XP) ; règle de progression : décision R2
  xp                    INTEGER NOT NULL CHECK (xp >= 0),   -- « TOTAL XP » (S11) ; le niveau global s'en déduit (v_personnage_niveau)
  alignement_loyal      INTEGER NOT NULL CHECK (alignement_loyal >= 0),       -- scores L, C, B, M (L5:O5, guide « Alignement ») ;
  alignement_chaotique  INTEGER NOT NULL CHECK (alignement_chaotique >= 0),   -- le libellé (« Neutre Pur »…, I4) se calcule
  alignement_bon        INTEGER NOT NULL CHECK (alignement_bon >= 0),
  alignement_mauvais    INTEGER NOT NULL CHECK (alignement_mauvais >= 0),
  bourse_pp             INTEGER NOT NULL CHECK (bourse_pp >= 0),   -- « Bourse » : Précieuse (I6), Or (N6), Fer (T6) = monnaie 'pp', 'ro', 'rf'
  bourse_ro             INTEGER NOT NULL CHECK (bourse_ro >= 0),
  bourse_rf             INTEGER NOT NULL CHECK (bourse_rf >= 0),
  ambidextrie           INTEGER NOT NULL CHECK (ambidextrie IN (0, 1)),   -- case « Ambidextrie » (AU8)
  bouclier_classe_id    TEXT    REFERENCES bouclier_classe(id),   -- « Nom Bouclier » (AA26) ; ses matériaux : personnage_bouclier_materiau
  -- État en jeu (valeurs courantes ; les maximums se calculent). NULL = non suivi (au maximum).
  sante_actuelle        INTEGER,
  chakra_actuel         INTEGER CHECK (chakra_actuel IS NULL OR chakra_actuel >= 0),
  barriere_actuelle     INTEGER CHECK (barriere_actuelle IS NULL OR barriere_actuelle >= 0),
  corruption            INTEGER CHECK (corruption IS NULL OR corruption >= 0),   -- « Corruption » (K15), guide « Attributs »
  barre4_actuelle       INTEGER CHECK (barre4_actuelle IS NULL OR barre4_actuelle >= 0),   -- Sang / Âme, la « 4ème barre » (A15:F15)
  notes                 TEXT,                         -- « NOTE » (BA53)
  evenements            TEXT,                         -- « ÉVÉNEMENTS » (B71)
  cree_le               TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  modifie_le            TEXT    NOT NULL CHECK (modifie_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z' AND modifie_le >= cree_le),
  CHECK ((nature = 'pretire') = (proprietaire_id IS NULL)),   -- un prétiré n'est à personne ; la fiche d'un joueur a son propriétaire
  CHECK (nature = 'joueur' OR visibilite = 'tous'),           -- « Les prétirés sont visibles par tous »
  CHECK (magie_acquise_id IS NULL OR magie_acquise_id <> magie_innee_id),
  CHECK (statut = 'brouillon' OR (race_id IS NOT NULL AND magie_innee_id IS NOT NULL))
) STRICT;

CREATE INDEX personnage_proprietaire ON personnage (proprietaire_id) WHERE proprietaire_id IS NOT NULL;   -- « mes personnages »

-- Utilisateurs à qui le propriétaire montre sa fiche en plus de sa visibilité (« un utilisateur spécifique », plusieurs possibles).
CREATE TABLE personnage_partage (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  PRIMARY KEY (personnage_id, utilisateur_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_partage_utilisateur ON personnage_partage (utilisateur_id);   -- « les fiches qu'on m'a montrées »

-- Classes du personnage : « CLASSE » 1 (A9) et 2 (A11), chacune avec sa spécialité (I9, I11 : choisie au niveau de classe 10). Les niveaux de classe
-- se déduisent de l'XP et du mode (v_personnage_niveau), ils ne sont pas stockés.
CREATE TABLE personnage_classe (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang IN (1, 2)),
  classe_id      TEXT    NOT NULL REFERENCES classe(id),
  specialite_id  TEXT,                                -- NULL tant qu'elle n'est pas choisie
  PRIMARY KEY (personnage_id, rang),
  UNIQUE (personnage_id, classe_id),
  FOREIGN KEY (specialite_id, classe_id) REFERENCES specialite (id, classe_id)   -- une spécialité de CETTE classe
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_classe_classe ON personnage_classe (classe_id);

-- Valeur de base de chaque caractéristique (E18, M18, U18, E19, M19, U19), choisie dans les bornes de la race (v_race_carac_borne) ; le total suit
-- seuil_niveau 'caracteristiques_total' (décision R3 : exactement). Le point de la magie innée (G18…) et les bonus d'accessoires se calculent.
CREATE TABLE personnage_caracteristique (
  personnage_id      TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  caracteristique_id TEXT    NOT NULL REFERENCES caracteristique(id),
  base               INTEGER NOT NULL CHECK (base >= 1),
  croix              INTEGER NOT NULL CHECK (croix BETWEEN 0 AND 2),   -- croix sous la caractéristique (cases H18, I18…), décision R19 : handicap ou malus
                                                    -- (blessure grave, trauma, maladie, mauvaise nuit) ; 1 = −20 % à tout test de la caractéristique,
                                                    -- 2 = ses compétences ne sont plus utilisables (regle_constante 'competence.croix_1_malus', 'competence.croix_2_malus')
  PRIMARY KEY (personnage_id, caracteristique_id)
) STRICT, WITHOUT ROWID;

-- Points de compétence : « Nat. » (naturel, budget de niveau_global, plafond seuil_niveau 'competence_naturel_max') et « Acquis » (bonus de race,
-- classe, don, équipement, entraînement : au plus 5 par point de caractéristique de base, guide « Compétences »). Le total (K22…) se calcule.
-- Compétence absente = 0 et 0.
CREATE TABLE personnage_competence (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  competence_id  TEXT    NOT NULL REFERENCES competence(id),
  naturel        INTEGER NOT NULL CHECK (naturel >= 0),
  acquis         INTEGER NOT NULL CHECK (acquis >= 0),
  PRIMARY KEY (personnage_id, competence_id)
) STRICT, WITHOUT ROWID;

-- Gains d'attributs à chaque niveau global à partir du 2 : les points d'attributs (niveau_global.points_attributs, 15) répartis entre santé et chakra
-- (la fiche compte F14 + M14 : BDD!K40), et le dé bonus des niveaux qui en donnent un (niveau_global.de_attributs_bonus : « 1d8 santé OU 1d8 chakra
-- OU 1d4 pour les deux »). La fiche ajoute tout à la main dans la formule de F14/M14 (« +0 ») : ici chaque gain est daté par son niveau.
CREATE TABLE personnage_progression (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  niveau         INTEGER NOT NULL REFERENCES niveau_global(niveau) CHECK (niveau >= 2),
  points_sante   INTEGER NOT NULL CHECK (points_sante >= 0),
  points_chakra  INTEGER NOT NULL CHECK (points_chakra >= 0),
  de_choix       TEXT    CHECK (de_choix IN ('sante', 'chakra', 'les_deux')),   -- NULL = pas de dé à ce niveau
  de_resultat    INTEGER CHECK (de_resultat >= 1),   -- résultat du dé, ajouté à la santé, au chakra, ou aux deux (« 1d4 pour les deux »)
  PRIMARY KEY (personnage_id, niveau),
  CHECK ((de_choix IS NULL) = (de_resultat IS NULL))
) STRICT, WITHOUT ROWID;

-- Dons de classe choisis (lignes « CLASSE 1 » / « CLASSE 2 », C43:L67) : seulement ceux qui demandent un CHOIX (v_capacite_exclusive : options d'une
-- même ligne, une spécialité contre l'autre, paliers de l'Archimage). Les dons sans alternative se déduisent de la classe, du niveau et de la spécialité.
CREATE TABLE personnage_capacite (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  capacite_id    TEXT    NOT NULL REFERENCES capacite(id),
  PRIMARY KEY (personnage_id, capacite_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_capacite_capacite ON personnage_capacite (capacite_id);

-- « LISTE DE SORTS » (AA55:AY74) : sorts de la magie innée ou acquise, avec leur niveau de maîtrise (« NM », AY ; au plus niveau global − 1, BDD!BB6).
-- Type, coût, portée, zone et effets se lisent dans `sort`.
CREATE TABLE personnage_sort (
  personnage_id    TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  sort_id          TEXT    NOT NULL REFERENCES sort(id),
  rang             INTEGER NOT NULL CHECK (rang >= 1),   -- ligne de la liste sur la fiche
  niveau_maitrise  INTEGER NOT NULL CHECK (niveau_maitrise >= 0),
  PRIMARY KEY (personnage_id, sort_id),
  UNIQUE (personnage_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_sort_sort ON personnage_sort (sort_id);

-- « Maîtrise d'armes » (AA2:AV7) : nombre de dés (1d à 5d) par famille d'armes. Famille absente = pas de maîtrise.
CREATE TABLE personnage_maitrise_arme (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  arme_famille_id TEXT    NOT NULL REFERENCES arme_famille(id),
  des             INTEGER NOT NULL CHECK (des BETWEEN 1 AND 5),
  PRIMARY KEY (personnage_id, arme_famille_id)
) STRICT, WITHOUT ROWID;

-- « ARMES » (AA9:AY18) : deux emplacements, chacun une arme du catalogue, sa composition (matériau), ses améliorations et son élément.
CREATE TABLE personnage_arme (
  personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang                         INTEGER NOT NULL CHECK (rang IN (1, 2)),   -- arme 1 (AA10) ou 2 (AN10)
  arme_id                      TEXT    NOT NULL REFERENCES arme(id),
  materiau_id                  TEXT    REFERENCES materiau_arme(ressource_id),   -- « Composition » (AE10)
  amelioration_id              TEXT    REFERENCES amelioration_equipement(id),   -- « Amélioration » (AI13) : cible 'arme'
  arme_elementaire_id          TEXT    REFERENCES arme_elementaire(id),          -- « Elément » (AI16)
  amelioration_elementaire_id  TEXT    REFERENCES amelioration_equipement(id),   -- amélioration de la pièce élémentaire (AI18) : cible 'arme_elementaire'
  effet_en_plus                TEXT,                                             -- « Effet en plus » (AA12), texte libre
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

-- « ARMURE / DÉFENSE » (AA19:AX23) : une pièce par emplacement (armure complète, ou casque, torse, bras, jambes).
CREATE TABLE personnage_armure (
  personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  emplacement_id               TEXT    NOT NULL REFERENCES armure_emplacement(id),
  armure_id                    TEXT    NOT NULL REFERENCES armure(id),              -- « Nom Armure » (AD21)
  amelioration_id              TEXT    REFERENCES amelioration_equipement(id),      -- cible 'armure'
  armure_elementaire_id        TEXT    REFERENCES armure_elementaire(id),           -- « Elément » (AQ21)
  amelioration_elementaire_id  TEXT    REFERENCES amelioration_equipement(id),      -- cible 'armure_elementaire'
  PRIMARY KEY (personnage_id, emplacement_id)
) STRICT, WITHOUT ROWID;

-- Matériaux du bouclier (AF26, AJ26, AN26 et leurs quantités AH27, AL27, AP27) : au plus trois, la somme des quantités ne dépasse pas la classe
-- du bouclier (validation de AL27 : « La somme des quantités de matériaux ne doit pas dépasser la… »).
CREATE TABLE personnage_bouclier_materiau (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
  materiau_id    TEXT    NOT NULL REFERENCES materiau_bouclier(ressource_id),
  quantite       INTEGER NOT NULL CHECK (quantite >= 1),
  PRIMARY KEY (personnage_id, rang),
  UNIQUE (personnage_id, materiau_id)
) STRICT, WITHOUT ROWID;

-- « ACCESSOIRES » (AA28:AY37) : Chef, Collier, Bracelet 1 et 2, Bague 1 et 2, Ceinture, Autre. Chacun porte un effet de la table des accessoires
-- (propriété en AD29…, effet en AA30…), sa valeur tirée quand l'effet est une fourchette, et la case « Malédiction » (AD31…).
CREATE TABLE personnage_accessoire (
  personnage_id       TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  emplacement         TEXT    NOT NULL CHECK (emplacement IN ('chef', 'collier', 'bracelet-1', 'bracelet-2', 'bague-1', 'bague-2', 'ceinture', 'autre')),
  nom                 TEXT,                           -- nom donné à l'objet
  accessoire_effet_id TEXT    REFERENCES accessoire_effet(id),   -- NULL = effet hors table (texte libre ci-dessous)
  valeur              INTEGER,                        -- valeur tirée dans [bonus_min, bonus_max] de l'effet ; NULL si l'effet n'a pas de fourchette
  texte               TEXT,                           -- effet tel qu'écrit sur la fiche quand il n'est pas dans la table
  maudit              INTEGER NOT NULL CHECK (maudit IN (0, 1)),
  PRIMARY KEY (personnage_id, emplacement),
  CHECK (accessoire_effet_id IS NOT NULL OR texte IS NOT NULL)
) STRICT, WITHOUT ROWID;

-- « INVENTAIRE | SAC » (AA39:AY…) : une ligne par objet ; `ressource_id` quand l'objet est au catalogue, sinon le nom seul.
CREATE TABLE personnage_inventaire (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),
  quantite       INTEGER NOT NULL CHECK (quantite >= 1),
  ressource_id   TEXT    REFERENCES ressource(id),
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

-- Groupe de jeu : la table d'un one-shot (« OS ») ou d'une campagne. Ses membres voient les fiches qui y sont inscrites.
CREATE TABLE groupe (
  id       TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  nom      TEXT    NOT NULL CHECK (length(nom) > 0),
  nature   TEXT    NOT NULL CHECK (nature IN ('one_shot', 'campagne')),
  cree_le  TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;

-- Membres d'un groupe et fiche inscrite (demande du propriétaire) : un joueur peut être dans plusieurs groupes et avoir plusieurs fiches, mais n'inscrit
-- qu'UNE fiche par groupe : une ligne par (groupe, membre), et inscrire une autre fiche remplace `personnage_id` (la précédente est désinscrite).
-- La fiche inscrite devient visible de tous les membres du groupe, et d'eux seuls : ses autres fiches restent cachées (v_personnage_visible).
-- On inscrit sa propre fiche ou un prétiré (v_groupe_controle).
CREATE TABLE groupe_membre (
  groupe_id       TEXT    NOT NULL REFERENCES groupe(id) ON DELETE CASCADE,
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('mj', 'joueur')),   -- MJ de la table ou joueur
  personnage_id   TEXT    REFERENCES personnage(id) ON DELETE SET NULL,   -- fiche inscrite ; NULL = aucune (membre qui n'a pas encore inscrit de fiche, MJ)
  rejoint_le      TEXT    NOT NULL CHECK (rejoint_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  PRIMARY KEY (groupe_id, utilisateur_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX groupe_membre_utilisateur ON groupe_membre (utilisateur_id);   -- « mes groupes »

CREATE INDEX groupe_membre_personnage ON groupe_membre (personnage_id) WHERE personnage_id IS NOT NULL;   -- « où cette fiche est inscrite »

-- Niveau global et niveaux de classe d'un personnage. Niveau global = plus haut niveau dont l'XP minimale est atteinte (Personnage!W8 :
-- VLOOKUP(S11; BDD!G2:H21; 2; 1)). Niveaux de classe : décision R2 (« un "monoclasse" choisit automatiquement sa 2e classe au niveau 11 ») :
-- mono-classe : classe 1 = min(20, 2 × niveau global), classe 2 = 2 × niveau global − classe 1 ; bi-classe : chacune = niveau global (G9, G11).
CREATE VIEW v_personnage_niveau AS
  SELECT p.id AS personnage_id, n.niveau AS niveau_global,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 20 ELSE 2 * n.niveau END AS niveau_classe_1,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 2 * n.niveau - 20 ELSE 0 END AS niveau_classe_2
  FROM personnage p
  JOIN niveau_global n ON n.niveau = (SELECT MAX(g.niveau) FROM niveau_global g WHERE g.xp_min <= p.xp);

-- Qui voit quelle fiche (demande du propriétaire) : une ligne par (fiche, utilisateur, motif) ; un utilisateur voit une fiche s'il a au moins une ligne.
-- Motifs : 'proprietaire' ; 'admin' (toutes les fiches) ; 'tous' (visibilité 'tous', donc tout prétiré) ; 'mj' (visibilité 'mj' : utilisateurs de rôle
-- 'mj') ; 'groupe' (membres du groupe `groupe_id` où la fiche est inscrite) ; 'partage' (utilisateur désigné par le propriétaire).
CREATE VIEW v_personnage_visible AS
  SELECT p.id AS personnage_id, p.proprietaire_id AS utilisateur_id, 'proprietaire' AS motif, NULL AS groupe_id
  FROM personnage p WHERE p.proprietaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'admin', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE r.role = 'admin'
  UNION ALL
  SELECT p.id, u.id, 'tous', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE p.visibilite = 'tous'
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'mj', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE p.visibilite = 'mj' AND r.role = 'mj'
  UNION ALL
  SELECT i.personnage_id, m.utilisateur_id, 'groupe', i.groupe_id
  FROM groupe_membre i JOIN groupe_membre m ON m.groupe_id = i.groupe_id
  WHERE i.personnage_id IS NOT NULL
  UNION ALL
  SELECT s.personnage_id, s.utilisateur_id, 'partage', NULL
  FROM personnage_partage s;

-- Contrôle des inscriptions dans les groupes : une ligne par anomalie (vide = conforme). Un membre inscrit sa propre fiche ou un prétiré.
CREATE VIEW v_groupe_controle AS
  SELECT m.groupe_id, m.utilisateur_id, 'fiche_d_un_autre' AS regle, m.personnage_id AS detail
  FROM groupe_membre m JOIN personnage p ON p.id = m.personnage_id
  WHERE p.nature = 'joueur' AND p.proprietaire_id <> m.utilisateur_id;

-- Contrôle d'une fiche : une ligne par règle enfreinte (vide = fiche conforme pour ces règles). `regle` est une clé stable ; `detail` dit quoi.
-- Seules des règles écrites dans la base sont vérifiées (matrices de la fiche, onglets, guide, décisions R2, R3, R8, R11, R15, R16, R20) ; ce qui
-- demande le moteur (bonus de classe, d'équipement, nombre de sorts, plafond de NPM du Potentiel Illimité) n'est pas ici. Une fiche 'brouillon' peut
-- avoir des lignes, une fiche 'valide' non (test).
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Magie innée accessible à la race : matrice « Accessibilité Magie » (R8), sauf liste de l'onglet de la race qui prime (R11)
  SELECT p.id, 'magie_innee_inaccessible', p.magie_innee_id
  FROM personnage p
  WHERE p.race_id IS NOT NULL AND p.magie_innee_id IS NOT NULL
    AND CASE WHEN EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id)
             THEN NOT EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id AND o.magie_id = p.magie_innee_id)
             ELSE NOT EXISTS (SELECT 1 FROM race_magie rm WHERE rm.race_id = p.race_id AND rm.magie_id = p.magie_innee_id AND rm.accessible = 1)
        END
  UNION ALL
  -- Magies incompatibles entre elles (bloc « Magie non compatible » des onglets de magie)
  SELECT p.id, 'magies_incompatibles', p.magie_innee_id || ' / ' || p.magie_acquise_id
  FROM personnage p
  JOIN v_magie_incompatible i ON i.a = p.magie_innee_id AND i.b = p.magie_acquise_id
  UNION ALL
  -- Mono-magie (décision R15) : pas de magie acquise avec une magie mono-magie, sauf ethnie citée par magie_ethnie_secondaire, que la magie
  -- mono-magie soit l'innée ou l'acquise (décision R20 : l'Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption)
  SELECT p.id, 'mono_magie', m.id
  FROM personnage p
  JOIN magie m ON m.mono_magie = 1 AND m.id IN (p.magie_innee_id, p.magie_acquise_id)
  WHERE p.magie_acquise_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM magie_ethnie_secondaire s WHERE s.magie_id = m.id AND s.ethnie_id = p.ethnie_id)
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE p.race_id IS NULL OR e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id IS NOT NULL AND (p.magie_innee_id IS NULL OR e.magie_id <> p.magie_innee_id)
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
  UNION ALL
  SELECT pc.personnage_id, 'caracteristique_hors_bornes', pc.caracteristique_id || ' = ' || pc.base
  FROM personnage_caracteristique pc
  JOIN personnage p ON p.id = pc.personnage_id
  JOIN v_race_carac_borne b ON b.race_id = p.race_id AND b.caracteristique_id = pc.caracteristique_id
  WHERE pc.base < b.minimum OR pc.base > b.maximum
  UNION ALL
  SELECT n.personnage_id, 'caracteristiques_total', (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) || ' / ' || s.valeur
  FROM v_personnage_niveau n
  JOIN seuil_niveau s ON s.regle = 'caracteristiques_total'
   AND s.niveau_min = (SELECT MAX(t.niveau_min) FROM seuil_niveau t WHERE t.regle = 'caracteristiques_total' AND t.niveau_min <= n.niveau_global)
  WHERE EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id)
    AND (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) <> s.valeur
  UNION ALL
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3) ; acquis au plus 5 par point de caractéristique de base
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.statut <> 'brouillon'
    AND COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  SELECT pco.personnage_id, 'competence_acquis_max', pco.competence_id || ' = ' || pco.acquis
  FROM personnage_competence pco
  JOIN competence co ON co.id = pco.competence_id
  JOIN personnage_caracteristique pca ON pca.personnage_id = pco.personnage_id AND pca.caracteristique_id = co.caracteristique_id
  WHERE pco.acquis > pca.base * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique')
  UNION ALL
  -- Progression : un gain par niveau atteint (2 à niveau global), points d'attributs exacts (R3), dé seulement aux niveaux qui en donnent un
  SELECT pp.personnage_id, 'progression_niveau_non_atteint', CAST(pp.niveau AS TEXT)
  FROM personnage_progression pp JOIN v_personnage_niveau n ON n.personnage_id = pp.personnage_id
  WHERE pp.niveau > n.niveau_global
  UNION ALL
  SELECT n.personnage_id, 'progression_manquante', CAST(g.niveau AS TEXT)
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN niveau_global g ON g.niveau BETWEEN 2 AND n.niveau_global
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_progression pp WHERE pp.personnage_id = n.personnage_id AND pp.niveau = g.niveau)
  UNION ALL
  SELECT pp.personnage_id, 'progression_points', pp.niveau || ' : ' || (pp.points_sante + pp.points_chakra) || ' / ' || COALESCE(g.points_attributs, 0)
  FROM personnage_progression pp JOIN niveau_global g ON g.niveau = pp.niveau
  WHERE pp.points_sante + pp.points_chakra <> COALESCE(g.points_attributs, 0)
  UNION ALL
  SELECT pp.personnage_id, 'progression_de', CAST(pp.niveau AS TEXT)
  FROM personnage_progression pp JOIN niveau_global g ON g.niveau = pp.niveau
  WHERE (pp.de_choix IS NULL) <> (g.de_attributs_bonus IS NULL)
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n JOIN personnage p ON p.id = n.personnage_id
  WHERE p.statut <> 'brouillon' AND n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n JOIN personnage p ON p.id = n.personnage_id
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
  UNION ALL
  SELECT pc.personnage_id, 'specialite_trop_tot', pc.specialite_id
  FROM personnage_classe pc JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  WHERE pc.specialite_id IS NOT NULL
    AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END < 10
  UNION ALL
  -- Dons choisis : d'une classe du personnage, de sa spécialité s'ils en dépendent, jamais deux options exclusives ensemble
  SELECT pk.personnage_id, 'capacite_hors_classe', pk.capacite_id
  FROM personnage_capacite pk JOIN capacite c ON c.id = pk.capacite_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = pk.personnage_id AND pc.classe_id = c.classe_id
                      AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id))
  UNION ALL
  SELECT a.personnage_id, 'capacites_exclusives', a.capacite_id || ' / ' || b.capacite_id
  FROM personnage_capacite a
  JOIN v_capacite_exclusive x ON x.capacite_id = a.capacite_id
  JOIN personnage_capacite b ON b.personnage_id = a.personnage_id AND b.capacite_id = x.autre_id
  WHERE a.capacite_id < b.capacite_id
  UNION ALL
  -- Sorts : d'une magie du personnage (le Potentiel Illimité « pioche ses sorts dans toutes les magies existantes », son Explication) ;
  -- NPM au plus la puissance magique du niveau (niveau_global : niveau 16 pour la 5, décision R16), le palier dont la note dit « non disponible pour
  -- les personnages avec une magie acquise » ne comptant pas pour eux ; NM au plus niveau global − 1 (BDD!BB6) ; total des NM au plus les NM gagnés
  SELECT ps.personnage_id, 'sort_hors_magie', ps.sort_id
  FROM personnage_sort ps JOIN sort s ON s.id = ps.sort_id JOIN personnage p ON p.id = ps.personnage_id
  WHERE s.magie_id <> COALESCE(p.magie_innee_id, '') AND s.magie_id <> COALESCE(p.magie_acquise_id, '')
    AND COALESCE(p.magie_innee_id, '') <> 'magies/potentiel-illimite'
  UNION ALL
  SELECT ps.personnage_id, 'sort_puissance', ps.sort_id || ' : NPM ' || s.niveau
  FROM personnage_sort ps
  JOIN sort s ON s.id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE s.niveau > (SELECT MAX(g.puissance_magique) FROM niveau_global g
                    WHERE g.niveau <= n.niveau_global AND (p.magie_acquise_id IS NULL OR g.puissance_magique_note IS NULL))
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global')
  UNION ALL
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / ' || v.niveaux_maitrise_cumul
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE (SELECT SUM(ps.niveau_maitrise) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul
  UNION ALL
  -- Bouclier : des matériaux seulement avec un bouclier, quantités au plus la classe du bouclier (validation de Personnage!AL27)
  SELECT p.id, 'bouclier_quantite', SUM(m.quantite) || ' / ' || COALESCE(MAX(bc.classe), 0)
  FROM personnage p
  JOIN personnage_bouclier_materiau m ON m.personnage_id = p.id
  LEFT JOIN bouclier_classe bc ON bc.id = p.bouclier_classe_id
  GROUP BY p.id
  HAVING SUM(m.quantite) > COALESCE(MAX(bc.classe), 0)
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_elementaire_id
  WHERE ae.cible <> 'arme_elementaire'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.emplacement_id || ' : ' || ae.id
  FROM personnage_armure pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.emplacement_id || ' : ' || ae.id
  FROM personnage_armure pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;

INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('alignement.ecart_axe', 5, 'points', 'formule', 'IF(AND(ABS(L5-M5)<5,ABS(N5-O5)<5),"Neutre Pur"', NULL, 'fiche', 'Fiche auto V15.2.2 › Personnage › I4', NULL),
  ('barriere.diviseur_chakra', 2, 'diviseur', 'texte', '[Chakra total divisé par 2 = Barrière totale]', 'guide/fiche-attributs', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Attributs', NULL),
  ('sort.nm_ecart_niveau_global', 1, 'niveau', 'formule', 'IF(Personnage!W8>1," - NM maximum : " & Personnage!W8-1,"")', NULL, 'fiche', 'Fiche auto V15.2.2 › BDD › BB6', NULL);

-- 0038-personnage-sans-statut : la fiche de personnage n'a plus de statut (demande du propriétaire, 2026-10-14 : « on n'a pas besoin de ce
-- status »). Plus de « brouillon », « validé » ni « archivé » :
-- - toute fiche est contrôlée par v_personnage_controle, même inachevée (les règles « sauf brouillon » s'appliquent à toutes : caractéristique,
--   classe, gain de niveau ou bonus de métier manquants, total des compétences) ; une ligne de contrôle signale, elle n'empêche jamais d'enregistrer
--   (« validé » refusait une fiche qui enfreignait une règle) ;
-- - la contrainte « race et magie innée hors brouillon » devient deux contrôles, race_manquante et magie_innee_manquante ; sans race ou sans
--   magie innée, ethnie_hors_race et ethnie_magie n'ont rien à comparer et ne se déclenchent plus (ils doublaient ces deux contrôles, à tort :
--   « Ethnie liée à une autre magie innée » pour une fiche qui n'en a pas) ;
-- - la liste des personnages ne cache plus les fiches archivées.
-- SQLite ne retire pas une colonne citée par une contrainte de la table : la table est refaite (colonnes dans le même ordre, sans `statut`), et les
-- vues qui la lisent avec elle. Les tables des fiches restent vides dans data/rows ; la base vivante du service perd la colonne à sa reconstruction
-- (serveur/base-vivante.mjs, COLONNES_RETIREES de src/lib/fiche-format.mjs).

DROP VIEW v_personnage_controle;
DROP VIEW v_groupe_controle;
DROP VIEW v_personnage_visible;
DROP VIEW v_personnage_metier_bonus;
DROP VIEW v_personnage_niveau;

CREATE TABLE personnage_0038 (
  id                    TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- identifiant stable, jamais réutilisé (un personnage renommé le garde)
  nature                TEXT    NOT NULL CHECK (nature IN ('joueur', 'pretire')),
  proprietaire_id       TEXT    REFERENCES utilisateur(id),   -- joueur qui l'a créée ; NULL exactement pour un prétiré
  visibilite            TEXT    NOT NULL CHECK (visibilite IN ('privee', 'mj', 'tous')),
                                                    -- qui la voit EN PLUS du propriétaire, des administrateurs, des membres des groupes où elle est inscrite
                                                    -- et des utilisateurs désignés (personnage_partage) : 'privee' personne d'autre, 'mj' tous les MJ,
                                                    -- 'tous' tout utilisateur connecté (toujours le cas d'un prétiré) ; calcul : v_personnage_visible
  nom                   TEXT    NOT NULL CHECK (length(nom) > 0),   -- « NOM » (F1)
  surnom                TEXT,                         -- « Surnom » (P1)
  lieu_origine          TEXT,                         -- « Lieu origine » (F3)
  race_id               TEXT    REFERENCES race(id),  -- « RACE » (I2) ; NULL tant que la fiche ne l'a pas choisie (contrôle race_manquante)
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
  posture_id            TEXT    REFERENCES posture(id),   -- posture du moment (sélecteur des 6 postures de la page /fiche/, demande du propriétaire ;
                                                    -- migration 0027) ; NULL = aucune choisie
  -- Portrait (demande du propriétaire, migration 0031) : l'image choisie, réduite par la page /fiche/ (data URL WebP ou JPEG, 700 000 caractères au plus),
  -- et son cadrage, pour la recadrer plus tard : centre du cadre carré dans l'image (portrait_x, portrait_y, de 0 à 1) et zoom (de 1 à 4). NULL = le logo.
  portrait              TEXT    CHECK (portrait IS NULL OR (portrait GLOB 'data:image/*' AND length(portrait) <= 700000)),
  portrait_x            REAL    CHECK (portrait_x IS NULL OR portrait_x BETWEEN 0 AND 1),
  portrait_y            REAL    CHECK (portrait_y IS NULL OR portrait_y BETWEEN 0 AND 1),
  portrait_zoom         REAL    CHECK (portrait_zoom IS NULL OR portrait_zoom BETWEEN 1 AND 4),
  CHECK ((nature = 'pretire') = (proprietaire_id IS NULL)),   -- un prétiré n'est à personne ; la fiche d'un joueur a son propriétaire
  CHECK (nature = 'joueur' OR visibilite = 'tous'),           -- « Les prétirés sont visibles par tous »
  CHECK (magie_acquise_id IS NULL OR magie_acquise_id <> magie_innee_id)
) STRICT;

INSERT INTO personnage_0038 (id, nature, proprietaire_id, visibilite, nom, surnom, lieu_origine, race_id, ethnie_id, magie_innee_id, magie_acquise_id, caracteristique_magie_id, dieu_choisi_id, metier_id, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, bouclier_classe_id, sante_actuelle, chakra_actuel, barriere_actuelle, corruption, barre4_actuelle, notes, evenements, cree_le, modifie_le, posture_id, portrait, portrait_x, portrait_y, portrait_zoom)
  SELECT id, nature, proprietaire_id, visibilite, nom, surnom, lieu_origine, race_id, ethnie_id, magie_innee_id, magie_acquise_id, caracteristique_magie_id, dieu_choisi_id, metier_id, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, bouclier_classe_id, sante_actuelle, chakra_actuel, barriere_actuelle, corruption, barre4_actuelle, notes, evenements, cree_le, modifie_le, posture_id, portrait, portrait_x, portrait_y, portrait_zoom FROM personnage;

DROP TABLE personnage;
ALTER TABLE personnage_0038 RENAME TO personnage;

CREATE INDEX personnage_proprietaire ON personnage (proprietaire_id) WHERE proprietaire_id IS NOT NULL;   -- « mes personnages »

CREATE VIEW v_personnage_niveau AS
  SELECT p.id AS personnage_id, n.niveau AS niveau_global,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 20 ELSE 2 * n.niveau END AS niveau_classe_1,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 2 * n.niveau - 20 ELSE 0 END AS niveau_classe_2
  FROM personnage p
  JOIN niveau_global n ON n.niveau = (SELECT MAX(g.niveau) FROM niveau_global g WHERE g.xp_min <= p.xp);

CREATE VIEW v_personnage_metier_bonus AS
  SELECT p.id AS personnage_id, b.rang, b.competence_id, b.attribut, b.valeur
  FROM personnage p
  JOIN metier_bonus b ON b.metier_id = p.metier_id
  WHERE (b.competence_id IS NOT NULL OR b.attribut IS NOT NULL)
    AND ((SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) = 1
         OR EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang AND c.competence_id = b.competence_id));

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

CREATE VIEW v_groupe_controle AS
  SELECT m.groupe_id, m.utilisateur_id, 'fiche_d_un_autre' AS regle, m.personnage_id AS detail
  FROM groupe_membre m JOIN personnage p ON p.id = m.personnage_id
  WHERE p.nature = 'joueur' AND p.proprietaire_id <> m.utilisateur_id;

CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Race et magie innée : toute fiche en a une (jusqu'à la migration 0038, une contrainte de la table pour toute fiche hors brouillon)
  SELECT p.id, 'race_manquante', NULL
  FROM personnage p
  WHERE p.race_id IS NULL
  UNION ALL
  SELECT p.id, 'magie_innee_manquante', NULL
  FROM personnage p
  WHERE p.magie_innee_id IS NULL
  UNION ALL
  -- Classe réservée à une magie innée, qui l'impose en classe 1 (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décision R23)
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  SELECT p.id, 'classe_imposee', c.id
  FROM personnage p
  JOIN classe c ON c.magie_innee_id = p.magie_innee_id
  JOIN personnage_classe pc ON pc.personnage_id = p.id AND pc.rang = 1
  WHERE pc.classe_id <> c.id
  UNION ALL
  -- Classe que ferme la magie innée, à tous les rangs (classe.magie_innee_exclue_id ; le Mage Bleu et le Potentiel Illimité, décision R25)
  SELECT pc.personnage_id, 'classe_exclue', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_exclue_id = p.magie_innee_id
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
  -- Race à une seule magie (race.mono_magie ; la Lamia, décision R28) : pas de magie acquise
  SELECT p.id, 'race_mono_magie', p.magie_acquise_id
  FROM personnage p JOIN race r ON r.id = p.race_id
  WHERE r.mono_magie = 1 AND p.magie_acquise_id IS NOT NULL
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2). Sans race ou sans magie
  -- innée, rien à comparer : race_manquante, magie_innee_manquante le disent (migration 0038)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id <> p.magie_innee_id
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
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
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  -- (l'Acquis compte le bonus du métier, décision R33, mais le plafond prévaut sur lui, décision R38 : le bonus ne compte que jusqu'au plafond ;
  -- seuls les points saisis au-delà de ce qu'il laisse sont une erreur). Plafond : 5 par point de la caractéristique totale, le +1 de la magie innée
  -- compris (sa caractéristique, ou celle que la fiche choisit quand la magie la laisse au choix), décision R41 : « 5 en volonté donnerait un max de
  -- 25 aquis » (migration 0026)
  SELECT pl.personnage_id, 'competence_acquis_max', co.id || ' = ' || (COALESCE(pco.acquis, 0) + MIN(COALESCE(mb.valeur, 0), pl.plafond))
  FROM (SELECT pca.personnage_id, pca.caracteristique_id,
               (pca.base + CASE WHEN mi.id IS NOT NULL AND pca.caracteristique_id = COALESCE(mi.caracteristique_id, p.caracteristique_magie_id)
                                THEN (SELECT r.valeur FROM regle_constante r WHERE r.id = 'caracteristique.bonus_magie_innee') ELSE 0 END)
               * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique') AS plafond
        FROM personnage_caracteristique pca
        JOIN personnage p ON p.id = pca.personnage_id
        LEFT JOIN magie mi ON mi.id = p.magie_innee_id) pl
  JOIN competence co ON co.caracteristique_id = pl.caracteristique_id
  LEFT JOIN personnage_competence pco ON pco.personnage_id = pl.personnage_id AND pco.competence_id = co.id
  LEFT JOIN (SELECT personnage_id, competence_id, SUM(valeur) AS valeur FROM v_personnage_metier_bonus WHERE competence_id IS NOT NULL
             GROUP BY personnage_id, competence_id) mb ON mb.personnage_id = pl.personnage_id AND mb.competence_id = co.id
  WHERE COALESCE(pco.acquis, 0) + MIN(COALESCE(mb.valeur, 0), pl.plafond) > pl.plafond
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
  UNION ALL
  -- Progression : un gain par niveau atteint (2 à niveau global), points d'attributs exacts (R3), dé seulement aux niveaux qui en donnent un
  SELECT pp.personnage_id, 'progression_niveau_non_atteint', CAST(pp.niveau AS TEXT)
  FROM personnage_progression pp JOIN v_personnage_niveau n ON n.personnage_id = pp.personnage_id
  WHERE pp.niveau > n.niveau_global
  UNION ALL
  SELECT n.personnage_id, 'progression_manquante', CAST(g.niveau AS TEXT)
  FROM v_personnage_niveau n
  JOIN niveau_global g ON g.niveau BETWEEN 2 AND n.niveau_global
  WHERE NOT EXISTS (SELECT 1 FROM personnage_progression pp WHERE pp.personnage_id = n.personnage_id AND pp.niveau = g.niveau)
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
  FROM v_personnage_niveau n
  WHERE n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
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
  -- les personnages avec une magie acquise » ne comptant pas pour eux. NM (décision R26) : au plus 3 sur un sort, toutes origines comprises ; ceux de niveau
  -- (hors livre et cadeau du MJ) au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du
  -- MJ (décision R24)
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
  SELECT ps.personnage_id, 'sort_nm_plafond', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps
  WHERE ps.niveau_maitrise > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_max')
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau)
  FROM personnage_sort ps JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global')
  UNION ALL
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / ' || v.niveaux_maitrise_cumul
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE (SELECT SUM(ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul
  UNION ALL
  -- Bouclier : des matériaux seulement avec un bouclier, quantités au plus la classe du bouclier (validation de Personnage!AL27)
  SELECT p.id, 'bouclier_quantite', SUM(m.quantite) || ' / ' || COALESCE(MAX(bc.classe), 0)
  FROM personnage p
  JOIN personnage_bouclier_materiau m ON m.personnage_id = p.id
  LEFT JOIN bouclier_classe bc ON bc.id = p.bouclier_classe_id
  GROUP BY p.id
  HAVING SUM(m.quantite) > COALESCE(MAX(bc.classe), 0)
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45)
  SELECT pm.personnage_id, 'maitrise_arme_exclue', pm.arme_famille_id
  FROM personnage_maitrise_arme pm JOIN arme_famille f ON f.id = pm.arme_famille_id
  WHERE f.maitrisable = 0
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

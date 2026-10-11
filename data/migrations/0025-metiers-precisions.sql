-- 0025-metiers-precisions : réponses du propriétaire aux points laissés ouverts par 0024-metiers-fiche (2026-10-11 : « 1. 3% survie. 2. Il y a une
-- valeur de Vitesse, et une valeur vitesse de nage. Il faudrai bien les ajouter. 3. Le plafond prévaut sur le bonus. […] 4. Oui réduction de 20% aussi
-- (fait comme -2 à la carac..) 5. Il faut donner les options. »). Décisions R36 à R40.
-- Migration de STRUCTURE et de DONNÉES.
--   * metier_bonus (reconstruite, mêmes colonnes) : attribut accepte aussi 'vitesse' et 'vitesse_nage' (R37) ; « +1 Vitesse nage » (Maître-nageur)
--     vise la vitesse de nage, « +1 Vitesse au sol pour le sprint » (Facteur), jusque-là texte libre, est typé et vise la vitesse.
--   * Prostitué (R36) : « +3% Manipulation, Survie » devient « +3% Manipulation, +3% Survie » (champ, ligne de metier_bonus, page du métier).
--   * v_personnage_controle (R38) : 'competence_acquis_max' ne compte le bonus du métier que jusqu'au plafond (5 par point de caractéristique de base) :
--     un bonus plus grand que le plafond n'est pas une erreur, il est rogné ; seuls les points saisis au-delà de ce qu'il laisse en sont une.
--   * Équipements à choix (R40) : les options écrites en entier, séparées par « OU » : Chasseur « Arc en acier (Arme) OU Arbalète en acier (Arme) »,
--     Gladiateur « Glaive lourd en acier (arme) OU Glaive léger en acier (arme) », Fossoyeur « Pelle en acier (arme) OU Faucille en acier (arme) »
--     (champ, metier_objet_depart, page du métier).
--   * La croix sur une caractéristique d'artisanat (R39) ne change que le calcul de la fiche (lib/fiche-moteur.mjs#artisanatDe) : rien en base.

DROP VIEW v_personnage_controle;
DROP VIEW v_personnage_metier_bonus;

CREATE TABLE metier_bonus__0024 (
  metier_id   TEXT    NOT NULL REFERENCES metier(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  option      INTEGER NOT NULL CHECK (option >= 1),
  texte       TEXT    NOT NULL,                       -- fragment exact
  valeur      INTEGER,                                -- 3 de « +3% Esquive »
  unite       TEXT    CHECK (unite IN ('%')),         -- '%' si le nombre est suivi de « % » ; NULL sinon (« +1 INI »)
  cible       TEXT,                                   -- « Esquive », « Arme lourde », « INI »
  cible_cle   TEXT CHECK (cible_cle IS NULL OR (cible_cle NOT GLOB '*[^a-z0-9-]*' AND cible_cle NOT GLOB '*--*' AND cible_cle NOT GLOB '-*' AND cible_cle NOT GLOB '*-')),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  competence_id TEXT  REFERENCES competence(id),      -- compétence que le bonus augmente (Acquis), décision R33
  attribut    TEXT    CHECK (attribut IN ('initiative', 'vitesse', 'vitesse_nage')),   -- attribut que le bonus augmente (décisions R33, R37)
  PRIMARY KEY (metier_id, rang, option),
  CHECK ((valeur IS NULL) = (cible IS NULL)),
  CHECK (competence_id IS NULL OR attribut IS NULL),
  CHECK ((competence_id IS NULL AND attribut IS NULL) OR valeur IS NOT NULL)
) STRICT, WITHOUT ROWID;
INSERT INTO metier_bonus__0024 (metier_id, rang, option, texte, valeur, unite, cible, cible_cle, origine, source_ref, competence_id, attribut)
  SELECT metier_id, rang, option, texte, valeur, unite, cible, cible_cle, origine, source_ref, competence_id,
         CASE WHEN cible_cle = 'vitesse-nage' THEN 'vitesse_nage' ELSE attribut END
  FROM metier_bonus;

DROP TABLE metier_bonus;
ALTER TABLE metier_bonus__0024 RENAME TO metier_bonus;

CREATE INDEX metier_bonus_cible ON metier_bonus (cible_cle) WHERE cible_cle IS NOT NULL;

CREATE INDEX metier_bonus_competence ON metier_bonus (competence_id) WHERE competence_id IS NOT NULL;

-- Facteur : « +1 Vitesse au sol pour le sprint » vise la vitesse (R37)
UPDATE metier_bonus SET valeur = 1, unite = NULL, cible = 'Vitesse au sol pour le sprint', cible_cle = 'vitesse-au-sol-pour-le-sprint', attribut = 'vitesse'
WHERE metier_id = 'metiers/facteur' AND texte = '+1 Vitesse au sol pour le sprint' AND valeur IS NULL;

-- Prostitué : « Survie » = +3 % Survie (R36)
UPDATE metier SET bonus_brut = '+3% Manipulation, +3% Survie' WHERE id = 'metiers/prostitue' AND bonus_brut = '+3% Manipulation, Survie';
UPDATE metier_bonus SET texte = '+3% Survie', valeur = 3, unite = '%', cible = 'Survie', cible_cle = 'survie', competence_id = 'survie'
WHERE metier_id = 'metiers/prostitue' AND rang = 2 AND option = 1 AND texte = 'Survie';
UPDATE page SET corps_md = replace(corps_md, '**Bonus :** +3% Manipulation, Survie
', '**Bonus :** +3% Manipulation, +3% Survie
')
WHERE id = 'metiers/prostitue' AND instr(corps_md, '**Bonus :** +3% Manipulation, Survie
') > 0;

-- Équipements à choix : les options en entier (R40)
UPDATE metier SET equipement_brut = 'Arc en acier (Arme) OU Arbalète en acier (Arme)' WHERE id = 'metiers/chasseur' AND equipement_brut = 'Arc ou Arbalète en acier (Arme)';
UPDATE metier SET equipement_brut = 'Glaive lourd en acier (arme) OU Glaive léger en acier (arme)' WHERE id = 'metiers/gladiateur' AND equipement_brut = 'Glaive lourd ou léger en acier (arme)';
UPDATE metier SET equipement_brut = 'Pelle en acier (arme) OU Faucille en acier (arme)' WHERE id = 'metiers/fossoyeur' AND equipement_brut = 'Pelle OU faucille en acier (arme)';
UPDATE page SET corps_md = replace(corps_md, '**Équipement supplémentaire possible :** Arc ou Arbalète en acier (Arme)
', '**Équipement supplémentaire possible :** Arc en acier (Arme) OU Arbalète en acier (Arme)
') WHERE id = 'metiers/chasseur';
UPDATE page SET corps_md = replace(corps_md, '**Équipement supplémentaire possible :** Glaive lourd ou léger en acier (arme)
', '**Équipement supplémentaire possible :** Glaive lourd en acier (arme) OU Glaive léger en acier (arme)
') WHERE id = 'metiers/gladiateur';
UPDATE page SET corps_md = replace(corps_md, '**Équipement supplémentaire possible :** Pelle OU faucille en acier (arme)
', '**Équipement supplémentaire possible :** Pelle en acier (arme) OU Faucille en acier (arme)
') WHERE id = 'metiers/fossoyeur';
DELETE FROM metier_objet_depart WHERE metier_id IN ('metiers/chasseur', 'metiers/gladiateur', 'metiers/fossoyeur')
  AND metier_id IN (SELECT id FROM metier WHERE equipement_brut LIKE '% OU %');
INSERT INTO metier_objet_depart (metier_id, rang, option, texte, objet_depart_id, origine, source_ref)
  SELECT v.metier_id, v.rang, v.option, v.texte, NULL, 'docs_typees', v.source_ref
  FROM (
    SELECT 'metiers/chasseur' AS metier_id, 1 AS rang, 1 AS option, 'Arc en acier (Arme)' AS texte, 'Google Doc « MÉTIER » › Chasseur › Équipement supplémentaire possible' AS source_ref UNION ALL
    SELECT 'metiers/chasseur', 1, 2, 'Arbalète en acier (Arme)', 'Google Doc « MÉTIER » › Chasseur › Équipement supplémentaire possible' UNION ALL
    SELECT 'metiers/gladiateur', 1, 1, 'Glaive lourd en acier (arme)', 'Google Doc « MÉTIER » › Gladiateur › Équipement supplémentaire possible' UNION ALL
    SELECT 'metiers/gladiateur', 1, 2, 'Glaive léger en acier (arme)', 'Google Doc « MÉTIER » › Gladiateur › Équipement supplémentaire possible' UNION ALL
    SELECT 'metiers/fossoyeur', 1, 1, 'Pelle en acier (arme)', 'Google Doc « MÉTIER » › Fossoyeur › Équipement supplémentaire possible' UNION ALL
    SELECT 'metiers/fossoyeur', 1, 2, 'Faucille en acier (arme)', 'Google Doc « MÉTIER » › Fossoyeur › Équipement supplémentaire possible'
  ) v
  JOIN metier m ON m.id = v.metier_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_objet_depart o WHERE o.metier_id = v.metier_id);

CREATE VIEW v_personnage_metier_bonus AS
  SELECT p.id AS personnage_id, b.rang, b.competence_id, b.attribut, b.valeur
  FROM personnage p
  JOIN metier_bonus b ON b.metier_id = p.metier_id
  WHERE (b.competence_id IS NOT NULL OR b.attribut IS NOT NULL)
    AND ((SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) = 1
         OR EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang AND c.competence_id = b.competence_id));
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
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
  -- (l'Acquis compte le bonus du métier, décision R33, mais le plafond prévaut sur lui, décision R38 : le bonus ne compte que jusqu'au plafond ;
  -- seuls les points saisis au-delà de ce qu'il laisse sont une erreur)
  SELECT pca.personnage_id, 'competence_acquis_max', co.id || ' = ' || (COALESCE(pco.acquis, 0) + MIN(COALESCE(mb.valeur, 0), pca.base * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique')))
  FROM personnage_caracteristique pca
  JOIN competence co ON co.caracteristique_id = pca.caracteristique_id
  LEFT JOIN personnage_competence pco ON pco.personnage_id = pca.personnage_id AND pco.competence_id = co.id
  LEFT JOIN (SELECT personnage_id, competence_id, SUM(valeur) AS valeur FROM v_personnage_metier_bonus WHERE competence_id IS NOT NULL
             GROUP BY personnage_id, competence_id) mb ON mb.personnage_id = pca.personnage_id AND mb.competence_id = co.id
  WHERE COALESCE(pco.acquis, 0) + MIN(COALESCE(mb.valeur, 0), pca.base * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique'))
        > pca.base * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique')
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien (sauf brouillon)
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE p.statut <> 'brouillon'
    AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
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

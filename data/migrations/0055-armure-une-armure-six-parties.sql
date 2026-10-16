-- 0055-armure-une-armure-six-parties : réponses du propriétaire du 2026-10-16 (décision R95), après la décision R93 (« On ne peux plus concevoir
-- d'armure pièce par pièce. Ce n'est que armure complète ») : « 1) Les emplacement d'armure restent. L'armure peut casser à certains endroits
-- seulement. (sauf si comme pour les armures spéciales, elle disposent de durabilité unifiée) . Chaque partie est à réparer individuellement pour
-- remonter (utilisation d'un kit de réparation ou métier adapté + matériau) 2) L'amélioration est pour l'armure complète. 3) Suppression de la création
-- par pièces. » ; réponses aux choix « Une armure, six parties » et « Pour l'armure entière » (l'élément et son amélioration). Migration de STRUCTURE et
-- de DONNÉES.
--   * Fiches (section 13) : la fiche porte UNE armure complète, avec son amélioration, son élément et l'amélioration de l'élément (quatre colonnes de
--     personnage, en dernier) ; chacune des six parties (casque, torse, bras, jambes) a sa solidité du moment, une ligne par partie abîmée dans
--     personnage_armure_partie (une armure à solidité unifiée : une seule, sous « armure-complete »). personnage_armure (une armure par emplacement)
--     disparaît : sa ligne du premier emplacement (l'armure complète, sinon la première pièce, dans l'ordre du tableau FABRICATION) donne l'armure et ce
--     qui l'améliore ; les tables des fiches sont vides dans data/rows. La base vivante du service fait la même conversion à sa reconstruction et note
--     dans la fiche, datée, la pièce gardée qui devient l'armure complète et chaque autre pièce qu'elle ne garde pas (serveur/base-vivante.mjs,
--     CONVERSIONS ; TABLES_RETIREES de src/lib/fiche-format.mjs) :
--     rien n'est perdu sans le dire. La règle amelioration_cible de v_personnage_controle lit les deux améliorations de l'armure dans personnage ;
--     deux règles nouvelles signalent une amélioration ou un élément sans armure et une partie que l'armure n'a pas.
--   * Page « Armures » (ressources/armures) : les paragraphes de ses règles sur la création des morceaux d'armure (« Comme vous le savez il est possible
--     de fabriquer des armures… », « Avant je disais… il faut 2 matériaux pour chaque morceau… », l'exemple du torse) sont retirés du corps (« Suppression
--     de la création par pièces ») ; le reste des règles (solidité, cran de solidité uni, « perdre un seul morceau de l'armure ») est inchangé, ainsi que
--     les traces (historique_modification).

DROP VIEW v_personnage_controle;

ALTER TABLE personnage ADD COLUMN armure_id TEXT REFERENCES armure(id);
ALTER TABLE personnage ADD COLUMN armure_amelioration_id TEXT REFERENCES amelioration_equipement(id);
ALTER TABLE personnage ADD COLUMN armure_elementaire_id TEXT REFERENCES armure_elementaire(id);
ALTER TABLE personnage ADD COLUMN armure_amelioration_elementaire_id TEXT REFERENCES amelioration_equipement(id);

CREATE TABLE personnage_armure_partie (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  emplacement_id  TEXT    NOT NULL REFERENCES armure_emplacement(id) CHECK (emplacement_id <> 'bouclier'),
  solidite        INTEGER NOT NULL CHECK (solidite >= 0),
  PRIMARY KEY (personnage_id, emplacement_id)
) STRICT, WITHOUT ROWID;

-- l'armure de la fiche : la ligne du premier emplacement (armure_emplacement.ordre : l'armure complète d'abord)
UPDATE personnage SET
  armure_id = (SELECT pa.armure_id FROM personnage_armure pa JOIN armure_emplacement e ON e.id = pa.emplacement_id
               WHERE pa.personnage_id = personnage.id ORDER BY e.ordre LIMIT 1),
  armure_amelioration_id = (SELECT pa.amelioration_id FROM personnage_armure pa JOIN armure_emplacement e ON e.id = pa.emplacement_id
                            WHERE pa.personnage_id = personnage.id ORDER BY e.ordre LIMIT 1),
  armure_elementaire_id = (SELECT pa.armure_elementaire_id FROM personnage_armure pa JOIN armure_emplacement e ON e.id = pa.emplacement_id
                           WHERE pa.personnage_id = personnage.id ORDER BY e.ordre LIMIT 1),
  armure_amelioration_elementaire_id = (SELECT pa.amelioration_elementaire_id FROM personnage_armure pa JOIN armure_emplacement e ON e.id = pa.emplacement_id
                                        WHERE pa.personnage_id = personnage.id ORDER BY e.ordre LIMIT 1)
WHERE id IN (SELECT personnage_id FROM personnage_armure);

DROP TABLE personnage_armure;

-- v_personnage_controle : copiée de data/schema.sql (règle amelioration_cible : les améliorations de l'armure, dans personnage ; règles armure_manquante
-- et armure_partie_hors_armure : une amélioration ou un élément sans armure, une partie que l'armure n'a pas)
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
  -- Gains de niveau (décision R73) : santé + chakra gagnés (personnage.gains_sante, gains_chakra) = les points d'attributs des niveaux atteints
  -- (v_niveau.points_attributs_cumul : 15 par niveau à partir du 2), plus le dé bonus de chaque niveau atteint qui en donne un, entre son plus petit
  -- et son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max : 1 et 8) ; au niveau 1, rien. Détail : « total / à saisir », ou
  -- « total / minimum à maximum » quand un dé est atteint
  SELECT n.personnage_id, 'gains_niveau', (p.gains_sante + p.gains_chakra) || ' / ' || (v.points_attributs_cumul + v.de_attributs_min_cumul)
         || CASE WHEN v.de_attributs_max_cumul > v.de_attributs_min_cumul THEN ' à ' || (v.points_attributs_cumul + v.de_attributs_max_cumul) ELSE '' END
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.gains_sante + p.gains_chakra NOT BETWEEN v.points_attributs_cumul + v.de_attributs_min_cumul
                                               AND v.points_attributs_cumul + v.de_attributs_max_cumul
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
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'élément de l’armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  -- Armure (décision R95) : une amélioration ou un élément d'armure n'existe qu'avec l'armure ; une partie n'a de solidité que si l'armure l'a (la seule
  -- « armure-complete » d'une armure à solidité unifiée, armure.solidite_uni = 1 ; les six autres sinon)
  SELECT p.id, 'armure_manquante', COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id)
  FROM personnage p
  WHERE p.armure_id IS NULL AND COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id) IS NOT NULL
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE a.id IS NULL OR (COALESCE(a.solidite_uni, 0) = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;


-- « Suppression de la création par pièces » : les paragraphes des règles de la page « Armures » sur la fabrication des morceaux
UPDATE page SET corps_md = replace(corps_md, 'Comme vous le savez il est possible de fabriquer des armures dans Maverick mais le système a toujours été un peu flou mais maintenant je vais pouvoir vous en dire plus.  
Pour fabriquer des morceaux d''armures (qui sont au nombre de 6 = Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droite) il faut rassembler 2 matériaux différents et les assembler pour fabriquer le morceau d''armure en question.

Avant je disais qu''il fallait 2 matériaux pour faire l''armure ENTIÈRE mais c''était illogique que 2 lingots de fer fassent l''armure entière, non maintenant il faut 2 matériaux pour chaque morceau. Donc pour faire un casque il faut 2 matériaux et le reste c''est pareil.

Exemple : Je veux un torse de cuir complet, un morceau de cuir me donne 2AP donc 2 morceaux de cuir me donneront 4AP (Oui la défense donnée par le matériau se cumule)

', '')
WHERE id = 'ressources/armures' AND instr(corps_md, 'Comme vous le savez il est possible de fabriquer des armures dans Maverick mais le système a toujours été un peu flou mais maintenant je vais pouvoir vous en dire plus.  
Pour fabriquer des morceaux d''armures (qui sont au nombre de 6 = Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droite) il faut rassembler 2 matériaux différents et les assembler pour fabriquer le morceau d''armure en question.

Avant je disais qu''il fallait 2 matériaux pour faire l''armure ENTIÈRE mais c''était illogique que 2 lingots de fer fassent l''armure entière, non maintenant il faut 2 matériaux pour chaque morceau. Donc pour faire un casque il faut 2 matériaux et le reste c''est pareil.

Exemple : Je veux un torse de cuir complet, un morceau de cuir me donne 2AP donc 2 morceaux de cuir me donneront 4AP (Oui la défense donnée par le matériau se cumule)

') > 0;

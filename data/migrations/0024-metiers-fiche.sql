-- 0024-metiers-fiche : les métiers deviennent des règles que la fiche de personnage applique (demande du propriétaire, 2026-10-11 : « Il faudrait
-- sélectionner un vrai lien entre les compétences et le bonus à attribuer […] La case artisanat peut être séparée en 2 partie. Un texte libre […] Et une
-- case caractéristiques qui assigne sa compétence d'artisanat comme étant l'ensemble de ses 2 caractéristiques […] Et enfin équipement supplémentaire
-- ajoute un "objet de départ" à la création du personnage. Du coup saisir un métier donnera automatiquement en aquis pour la compétence choisie. En cas
-- de choix c'est à saisir dans la fiche de personnage. +X INI donne le bonus à l'initiative. »). Décisions R33 (bonus), R34 (artisanat), R35 (objets).
-- Migration de STRUCTURE et de DONNÉES.
--   * metier_bonus (reconstruite, colonnes ajoutées en dernier) : competence_id (clé étrangère vers la compétence que le bonus augmente, posée quand la
--     cible typée est le nom d'une compétence) et attribut ('initiative' pour « +1 INI », la seule cible d'attribut que le propriétaire a nommée) ;
--     « +5% dans une compétence sociale au choix » (Comédien) devient un choix entre les cinq compétences de la caractéristique Social.
--   * metier : les deux caractéristiques de l'artisanat sont posées aussi pour « PERCEPTION x2 » (Peintre : deux fois la Perception) et « Artisanat
--     SOCIAL + INTELLIGENCE » (Scribe) ; les 24 autres crochets « CARAC + CARAC » l'étaient déjà.
--   * metier_objet_depart (nouvelle) : l'« Équipement supplémentaire possible » découpé comme l'inventaire de départ d'une classe (« , » puis « OU ») :
--     54 objets de 45 métiers, dont un choix (Fossoyeur : « Pelle OU faucille en acier (arme) »).
--   * personnage_metier_bonus (section 13, nouvelle) : la compétence choisie pour un rang de bonus à plusieurs options ; vue v_personnage_metier_bonus
--     (ce que le métier d'une fiche apporte) ; dans v_personnage_controle, 'metier_bonus_hors_choix', 'metier_bonus_manquant', et
--     'competence_acquis_max' compte le bonus du métier dans l'Acquis (la page « Règles des métiers » parle de bonus « d'acquis »).
--   * Constante 'metier.artisanat_par_point_caracteristique' = 10, et sa phrase dans la page « Règles des métiers » avec les deux exemples du
--     propriétaire.

DROP VIEW v_personnage_controle;

CREATE TABLE metier_bonus__0023 (
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
  attribut    TEXT    CHECK (attribut IN ('initiative')),   -- attribut que le bonus augmente : « +1 INI » -> 'initiative' (décision R33)
  PRIMARY KEY (metier_id, rang, option),
  CHECK ((valeur IS NULL) = (cible IS NULL)),
  CHECK (competence_id IS NULL OR attribut IS NULL),
  CHECK ((competence_id IS NULL AND attribut IS NULL) OR valeur IS NOT NULL)
) STRICT, WITHOUT ROWID;
INSERT INTO metier_bonus__0023 (metier_id, rang, option, texte, valeur, unite, cible, cible_cle, origine, source_ref, competence_id, attribut)
  SELECT b.metier_id, b.rang, b.option, b.texte, b.valeur, b.unite, b.cible, b.cible_cle, b.origine, b.source_ref,
         (SELECT c.id FROM competence c WHERE c.id = b.cible_cle), CASE WHEN b.cible_cle = 'ini' THEN 'initiative' END
  FROM metier_bonus b
  WHERE NOT (b.metier_id = 'metiers/comedien' AND b.texte = '+5% dans une compétence sociale au choix');

INSERT INTO metier_bonus__0023 (metier_id, rang, option, texte, valeur, unite, cible, cible_cle, origine, source_ref, competence_id, attribut)
  SELECT b.metier_id, b.rang, (SELECT count(*) FROM competence d WHERE d.caracteristique_id = 'social' AND d.ordre <= c.ordre), b.texte, 5, '%',
         c.nom, c.id, b.origine, b.source_ref, c.id, NULL
  FROM metier_bonus b JOIN competence c ON c.caracteristique_id = 'social'
  WHERE b.metier_id = 'metiers/comedien' AND b.texte = '+5% dans une compétence sociale au choix';

DROP TABLE metier_bonus;
ALTER TABLE metier_bonus__0023 RENAME TO metier_bonus;

CREATE INDEX metier_bonus_cible ON metier_bonus (cible_cle) WHERE cible_cle IS NOT NULL;

CREATE INDEX metier_bonus_competence ON metier_bonus (competence_id) WHERE competence_id IS NOT NULL;

UPDATE metier SET test_carac_1_id = 'perception', test_carac_2_id = 'perception' WHERE id = 'metiers/peintre' AND test_brut = 'PERCEPTION x2';
UPDATE metier SET test_carac_1_id = 'social', test_carac_2_id = 'intelligence' WHERE id = 'metiers/scribe' AND test_brut = 'Artisanat SOCIAL + INTELLIGENCE';

CREATE TABLE metier_objet_depart (
  metier_id        TEXT    NOT NULL REFERENCES metier(id),
  rang             INTEGER NOT NULL CHECK (rang >= 1),
  option           INTEGER NOT NULL CHECK (option >= 1),
  texte            TEXT    NOT NULL CHECK (length(texte) > 0),
  objet_depart_id  TEXT    REFERENCES objet_depart(id),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (metier_id, rang, option)
) STRICT, WITHOUT ROWID;
CREATE INDEX metier_objet_depart_objet ON metier_objet_depart (objet_depart_id) WHERE objet_depart_id IS NOT NULL;

INSERT INTO metier_objet_depart (metier_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES
  ('metiers/agriculteur', 1, 1, 'Faux en fer (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Agriculteur › Équipement supplémentaire possible'),
  ('metiers/alchimiste', 1, 1, 'Kit d’alchimiste de base', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Alchimiste › Équipement supplémentaire possible'),
  ('metiers/apothicaire', 1, 1, 'Kit d’alchimie de base', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Apothicaire › Équipement supplémentaire possible'),
  ('metiers/archeologue', 1, 1, 'Parchemin vierge', 'ressources/objets-de-depart-des-classes#objet:parchemin-vierge', 'docs_typees', 'Google Doc « MÉTIER » › Archéologue › Équipement supplémentaire possible'),
  ('metiers/archeologue', 2, 1, 'Encrier', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Archéologue › Équipement supplémentaire possible'),
  ('metiers/armurier', 1, 1, 'Kit de réparation d’armure', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Armurier › Équipement supplémentaire possible'),
  ('metiers/artisan', 1, 1, 'Maillet en fer', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Artisan › Équipement supplémentaire possible'),
  ('metiers/assassin', 1, 1, 'Dague/Poignard en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Assassin › Équipement supplémentaire possible'),
  ('metiers/astronome', 1, 1, 'Longue-vue', 'ressources/objets-de-depart-des-classes#objet:longue-vue', 'docs_typees', 'Google Doc « MÉTIER » › Astronome › Équipement supplémentaire possible'),
  ('metiers/aventurier', 1, 1, 'Grand sac à dos', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Aventurier › Équipement supplémentaire possible'),
  ('metiers/boucher', 1, 1, 'Couperet en acier (1 main) (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Boucher › Équipement supplémentaire possible'),
  ('metiers/bouffon', 1, 1, 'Cloche portable', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Bouffon › Équipement supplémentaire possible'),
  ('metiers/boulanger', 1, 1, 'Pelle en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Boulanger › Équipement supplémentaire possible'),
  ('metiers/bourreau', 1, 1, 'Couperet en acier (2 mains) (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Bourreau › Équipement supplémentaire possible'),
  ('metiers/bousier', 1, 1, 'Pelle en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Bousier › Équipement supplémentaire possible'),
  ('metiers/brasseur', 1, 1, 'Tonnelet en bois', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Brasseur › Équipement supplémentaire possible'),
  ('metiers/bucheron', 1, 1, 'Hache en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Bûcheron › Équipement supplémentaire possible'),
  ('metiers/cartographe', 1, 1, 'Boussole', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Cartographe › Équipement supplémentaire possible'),
  ('metiers/cartographe', 2, 1, 'Carte du monde', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Cartographe › Équipement supplémentaire possible'),
  ('metiers/charpentier', 1, 1, 'Maillet en fer', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Charpentier › Équipement supplémentaire possible'),
  ('metiers/chasseur', 1, 1, 'Arc ou Arbalète en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Chasseur › Équipement supplémentaire possible'),
  ('metiers/chef-cuisinier', 1, 1, 'Petit sac de sel', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Chef-cuisinier › Équipement supplémentaire possible'),
  ('metiers/couturier', 1, 1, 'Vêtement de voyage (Armure)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Couturier › Équipement supplémentaire possible'),
  ('metiers/crieur', 1, 1, 'Cloche portable', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Crieur › Équipement supplémentaire possible'),
  ('metiers/ecrivain', 1, 1, 'Plume', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Écrivain › Équipement supplémentaire possible'),
  ('metiers/ecrivain', 2, 1, 'encrier', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Écrivain › Équipement supplémentaire possible'),
  ('metiers/eleveur', 1, 1, 'Fouet en fer (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Éleveur (choix animal) › Équipement supplémentaire possible'),
  ('metiers/facteur', 1, 1, 'Grand sac à dos', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Facteur › Équipement supplémentaire possible'),
  ('metiers/flechier', 1, 1, 'Méga Carquois (équipement)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Fléchier › Équipement supplémentaire possible'),
  ('metiers/forgeron', 1, 1, 'Kit de réparation d’arme', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Forgeron › Équipement supplémentaire possible'),
  ('metiers/forgeron', 2, 1, 'Maillet en fer', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Forgeron › Équipement supplémentaire possible'),
  ('metiers/fossoyeur', 1, 1, 'Pelle', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Fossoyeur › Équipement supplémentaire possible'),
  ('metiers/fossoyeur', 1, 2, 'faucille en acier (arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Fossoyeur › Équipement supplémentaire possible'),
  ('metiers/garde-de-ville', 1, 1, 'Bouclier rond amalgame (bois+fer+fer) avec emblème de province', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Garde de ville › Équipement supplémentaire possible'),
  ('metiers/gladiateur', 1, 1, 'Glaive lourd ou léger en acier (arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Gladiateur › Équipement supplémentaire possible'),
  ('metiers/marchand', 1, 1, 'Gros sac à dos', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Marchand › Équipement supplémentaire possible'),
  ('metiers/marechal-ferrant', 1, 1, 'Kit de réparation d’armure', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Maréchal-ferrant › Équipement supplémentaire possible'),
  ('metiers/marin', 1, 1, 'Longue-vue', 'ressources/objets-de-depart-des-classes#objet:longue-vue', 'docs_typees', 'Google Doc « MÉTIER » › Marin › Équipement supplémentaire possible'),
  ('metiers/maroquinier', 1, 1, 'Kit de réparation d’armure', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Maroquinier › Équipement supplémentaire possible'),
  ('metiers/medecin', 1, 1, 'Sac de médecin', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Médecin › Équipement supplémentaire possible'),
  ('metiers/medecin', 2, 1, 'scalpel en fer', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Médecin › Équipement supplémentaire possible'),
  ('metiers/menuisier', 1, 1, 'Écu de bois', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Menuisier › Équipement supplémentaire possible'),
  ('metiers/mineur', 1, 1, 'Démarre avec une pioche en acier (arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Mineur › Équipement supplémentaire possible'),
  ('metiers/myciculteur', 1, 1, 'Pelle en fer (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Myciculteur › Équipement supplémentaire possible'),
  ('metiers/peintre', 1, 1, 'Parchemin vierge', 'ressources/objets-de-depart-des-classes#objet:parchemin-vierge', 'docs_typees', 'Google Doc « MÉTIER » › Peintre › Équipement supplémentaire possible'),
  ('metiers/peintre', 2, 1, 'plume', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Peintre › Équipement supplémentaire possible'),
  ('metiers/sapeur', 1, 1, 'Gros sac de bombe', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Sapeur › Équipement supplémentaire possible'),
  ('metiers/sapeur', 2, 1, 'Hache du sapeur en fer', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Sapeur › Équipement supplémentaire possible'),
  ('metiers/scribe', 1, 1, 'Plume à graver', 'ressources/objets-de-depart-des-classes#objet:plume-a-grave', 'docs_typees', 'Google Doc « MÉTIER » › Scribe › Équipement supplémentaire possible'),
  ('metiers/scribe', 2, 1, 'encrier', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Scribe › Équipement supplémentaire possible'),
  ('metiers/sculpteur', 1, 1, 'Dague en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Sculpteur › Équipement supplémentaire possible'),
  ('metiers/serrurier', 1, 1, 'Crochet (x3)', 'ressources/objets-de-depart-des-classes#objet:crochet', 'docs_typees', 'Google Doc « MÉTIER » › Serrurier › Équipement supplémentaire possible'),
  ('metiers/tailleur-de-pierre', 1, 1, 'Piolet en acier (arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Tailleur de pierre › Équipement supplémentaire possible'),
  ('metiers/verger', 1, 1, 'Faucille en acier (Arme)', NULL, 'docs_typees', 'Google Doc « MÉTIER » › Verger › Équipement supplémentaire possible');

CREATE TABLE personnage_metier_bonus (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang >= 1),   -- rang du bonus dans metier_bonus (métier de la fiche)
  competence_id  TEXT    NOT NULL REFERENCES competence(id),
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;
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
  -- (l'Acquis compte le bonus du métier, décision R33 : la page « Règles des métiers » dit ses bonus « d'acquis »)
  SELECT pca.personnage_id, 'competence_acquis_max', co.id || ' = ' || (COALESCE(pco.acquis, 0) + COALESCE(mb.valeur, 0))
  FROM personnage_caracteristique pca
  JOIN competence co ON co.caracteristique_id = pca.caracteristique_id
  LEFT JOIN personnage_competence pco ON pco.personnage_id = pca.personnage_id AND pco.competence_id = co.id
  LEFT JOIN (SELECT personnage_id, competence_id, SUM(valeur) AS valeur FROM v_personnage_metier_bonus WHERE competence_id IS NOT NULL
             GROUP BY personnage_id, competence_id) mb ON mb.personnage_id = pca.personnage_id AND mb.competence_id = co.id
  WHERE COALESCE(pco.acquis, 0) + COALESCE(mb.valeur, 0)
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

UPDATE page SET corps_md = replace(corps_md, 'il sera nécessaire de combiner deux caractéristiques ensemble pour connaître les chances de réussite.

  *Exemple : Pour fabriquer une épée', 'il sera nécessaire de combiner deux caractéristiques ensemble pour connaître les chances de réussite. La compétence d’artisanat vaut **10 × chacune des deux caractéristiques** du métier, additionnées.

  *Exemple : Un sculpteur (Force + Intelligence) qui a 3 en Force et 2 en Intelligence a 3 × 10 + 2 × 10 = 50 % ; un joaillier (Perception + Intelligence) qui a 5 en Intelligence et 4 en Perception a 5 × 10 + 4 × 10 = 90 %.*

  *Exemple : Pour fabriquer une épée')
WHERE id = 'metiers/regles-des-metiers' AND instr(corps_md, 'pour connaître les chances de réussite.

  *Exemple : Pour fabriquer une épée') > 0;

INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('metier.artisanat_par_point_caracteristique', 10, '%', 'texte', 'La compétence d’artisanat vaut **10 × chacune des deux caractéristiques** du métier, additionnées',
   'metiers/regles-des-metiers', 'fiche', 'Décision R34 du propriétaire', NULL);

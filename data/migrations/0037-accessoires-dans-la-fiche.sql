-- 0037-accessoires-dans-la-fiche : ce que l'effet d'un accessoire change sur la fiche de personnage (demande du propriétaire, 2026-10-14 : « Dans la fiche
-- de personnage, l'accessoire influe sur le reste de la fiche. Dans le cas d'une action ajoute-le à la suite des dons raciaux sous le même format. Il
-- convient donc de créer une table adaptée, à l'instar des armes. » ; décision R54). Migration de STRUCTURE et de DONNÉES.
--   * accessoire_effet_cible : les valeurs que chaque effet écrit, typées (lignes écrites par client/src/lib/accessoire-champs.mjs, que
--     test/accessoire-champs.test.mjs rejoue sur toute la base) ;
--   * accessoire_effet.usage : 'action' (« (Action) … ») ou 'limite' (usage compté), les effets rappelés sous les dons de race ;
--   * personnage_accessoire.competence_id, .arme_famille_id : les choix que demandent « Compétence X » et « +5 dégâts avec une catégorie d'arme » (les
--     tables des fiches restent vides dans data/rows).

ALTER TABLE accessoire_effet ADD COLUMN usage TEXT CHECK (usage IS NULL OR usage IN ('action', 'limite'));

ALTER TABLE personnage_accessoire ADD COLUMN competence_id TEXT REFERENCES competence(id);
ALTER TABLE personnage_accessoire ADD COLUMN arme_famille_id TEXT REFERENCES arme_famille(id);

CREATE TABLE accessoire_effet_cible (
  effet_id     TEXT    NOT NULL REFERENCES accessoire_effet(id),
  rang         INTEGER NOT NULL CHECK (rang >= 1),
  cible        TEXT    NOT NULL CHECK (cible IN ('caracteristique', 'competence', 'sante', 'chakra', 'barriere', 'initiative', 'vitesse', 'barre4_max',
                                                 'armure_ap', 'armure_am', 'degats_physiques', 'degats_magie', 'degats_famille', 'portee_distance',
                                                 'portee_sorts', 'maitrise_arme', 'mode_hyper_tours', 'resistance')),
  cible_id     TEXT,
  valeur       INTEGER,
  choix        INTEGER NOT NULL CHECK (choix IN (0, 1)),
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (effet_id, rang),
  CHECK ((cible IN ('caracteristique', 'competence', 'resistance')) = (cible_id IS NOT NULL)),
  CHECK (valeur IS NOT NULL OR cible = 'competence')
) STRICT, WITHOUT ROWID;

CREATE INDEX accessoire_effet_cible_par_cible ON accessoire_effet_cible (cible, cible_id);

UPDATE accessoire_effet SET usage = 'action' WHERE id IN (
  'ressources/accessoires#effet:autre:13',
  'ressources/accessoires#effet:autre:4',
  'ressources/accessoires#effet:defense:12');

UPDATE accessoire_effet SET usage = 'limite' WHERE id IN (
  'ressources/accessoires#effet:autre:16',
  'ressources/accessoires#effet:autre:17',
  'ressources/accessoires#effet:autre:19',
  'ressources/accessoires#effet:autre:3',
  'ressources/accessoires#effet:autre:5',
  'ressources/accessoires#effet:jet-de-de:11',
  'ressources/accessoires#effet:jet-de-de:16',
  'ressources/accessoires#effet:jet-de-de:2',
  'ressources/accessoires#effet:jet-de-de:5',
  'ressources/accessoires#effet:jet-de-de:6',
  'ressources/accessoires#effet:jet-de-de:7');

INSERT INTO accessoire_effet_cible (effet_id, rang, cible, cible_id, valeur, choix, origine, source_ref) VALUES
  ('ressources/accessoires#effet:attaque:1', 1, 'degats_physiques', NULL, 2, 0, 'equipement', 'Ressources et Craft › Accessoires › BI44:CA44'),
  ('ressources/accessoires#effet:attaque:15', 1, 'degats_famille', NULL, 5, 1, 'equipement', 'Ressources et Craft › Accessoires › BI72:CA72'),
  ('ressources/accessoires#effet:attaque:17', 1, 'portee_sorts', NULL, 1, 0, 'equipement', 'Ressources et Craft › Accessoires › BI76:CA76'),
  ('ressources/accessoires#effet:attaque:19', 1, 'degats_magie', NULL, 2, 0, 'equipement', 'Ressources et Craft › Accessoires › BI80:CA80 ; décision R54'),
  ('ressources/accessoires#effet:attaque:2', 1, 'degats_physiques', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › BI46:CA46'),
  ('ressources/accessoires#effet:attaque:20', 1, 'degats_magie', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › BI82:CA82 ; décision R54'),
  ('ressources/accessoires#effet:attaque:3', 1, 'portee_distance', NULL, 1, 0, 'equipement', 'Ressources et Craft › Accessoires › BI48:CA48'),
  ('ressources/accessoires#effet:attaque:7', 1, 'maitrise_arme', NULL, 1, 0, 'equipement', 'Ressources et Craft › Accessoires › BI56:CA56'),
  ('ressources/accessoires#effet:attaque:8', 1, 'mode_hyper_tours', NULL, 1, 0, 'equipement', 'Ressources et Craft › Accessoires › BI58:CA58'),
  ('ressources/accessoires#effet:attributs:1', 1, 'sante', NULL, 25, 0, 'equipement', 'Ressources et Craft › Accessoires › AK44:BC44'),
  ('ressources/accessoires#effet:attributs:11', 1, 'barriere', NULL, 25, 0, 'equipement', 'Ressources et Craft › Accessoires › AK64:BC64'),
  ('ressources/accessoires#effet:attributs:12', 1, 'barriere', NULL, 20, 0, 'equipement', 'Ressources et Craft › Accessoires › AK66:BC66'),
  ('ressources/accessoires#effet:attributs:13', 1, 'barriere', NULL, 15, 0, 'equipement', 'Ressources et Craft › Accessoires › AK68:BC68'),
  ('ressources/accessoires#effet:attributs:14', 1, 'barriere', NULL, 10, 0, 'equipement', 'Ressources et Craft › Accessoires › AK70:BC70'),
  ('ressources/accessoires#effet:attributs:15', 1, 'barriere', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › AK72:BC72'),
  ('ressources/accessoires#effet:attributs:16', 1, 'chakra', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › AK74:BC74'),
  ('ressources/accessoires#effet:attributs:17', 1, 'chakra', NULL, 10, 0, 'equipement', 'Ressources et Craft › Accessoires › AK76:BC76'),
  ('ressources/accessoires#effet:attributs:18', 1, 'chakra', NULL, 15, 0, 'equipement', 'Ressources et Craft › Accessoires › AK78:BC78'),
  ('ressources/accessoires#effet:attributs:19', 1, 'chakra', NULL, 20, 0, 'equipement', 'Ressources et Craft › Accessoires › AK80:BC80'),
  ('ressources/accessoires#effet:attributs:2', 1, 'sante', NULL, 20, 0, 'equipement', 'Ressources et Craft › Accessoires › AK46:BC46'),
  ('ressources/accessoires#effet:attributs:20', 1, 'chakra', NULL, 25, 0, 'equipement', 'Ressources et Craft › Accessoires › AK82:BC82'),
  ('ressources/accessoires#effet:attributs:3', 1, 'sante', NULL, 15, 0, 'equipement', 'Ressources et Craft › Accessoires › AK48:BC48'),
  ('ressources/accessoires#effet:attributs:4', 1, 'sante', NULL, 10, 0, 'equipement', 'Ressources et Craft › Accessoires › AK50:BC50'),
  ('ressources/accessoires#effet:attributs:5', 1, 'sante', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › AK52:BC52'),
  ('ressources/accessoires#effet:attributs:6', 1, 'initiative', NULL, 2, 0, 'equipement', 'Ressources et Craft › Accessoires › AK54:BC54'),
  ('ressources/accessoires#effet:attributs:7', 1, 'initiative', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › AK56:BC56'),
  ('ressources/accessoires#effet:attributs:8', 1, 'barre4_max', NULL, 2, 0, 'equipement', 'Ressources et Craft › Accessoires › AK58:BC58'),
  ('ressources/accessoires#effet:attributs:9', 1, 'vitesse', NULL, 1, 0, 'equipement', 'Ressources et Craft › Accessoires › AK60:BC60'),
  ('ressources/accessoires#effet:caracteristique:agilite', 1, 'caracteristique', 'agilite', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D54:R55 ; décision R54'),
  ('ressources/accessoires#effet:caracteristique:force', 1, 'caracteristique', 'force', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D44:R45 ; décision R54'),
  ('ressources/accessoires#effet:caracteristique:intelligence', 1, 'caracteristique', 'intelligence', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D52:R53 ; décision R54'),
  ('ressources/accessoires#effet:caracteristique:perception', 1, 'caracteristique', 'perception', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D46:R47 ; décision R54'),
  ('ressources/accessoires#effet:caracteristique:social', 1, 'caracteristique', 'social', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D50:R51 ; décision R54'),
  ('ressources/accessoires#effet:caracteristique:volonte', 1, 'caracteristique', 'volonte', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › D48:R49 ; décision R54'),
  ('ressources/accessoires#effet:competence:agilite:1', 1, 'competence', 'agilite', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB84:AE84 ; décision R54'),
  ('ressources/accessoires#effet:competence:agilite:2', 1, 'competence', 'agilite', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB86:AE86 ; décision R54'),
  ('ressources/accessoires#effet:competence:agilite:3', 1, 'competence', 'agilite', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB88:AE88 ; décision R54'),
  ('ressources/accessoires#effet:competence:agilite:4', 1, 'competence', 'agilite', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB90:AE90 ; décision R54'),
  ('ressources/accessoires#effet:competence:force:1', 1, 'competence', 'force', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB44:AE44 ; décision R54'),
  ('ressources/accessoires#effet:competence:force:2', 1, 'competence', 'force', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB46:AE46 ; décision R54'),
  ('ressources/accessoires#effet:competence:force:3', 1, 'competence', 'force', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB48:AE48 ; décision R54'),
  ('ressources/accessoires#effet:competence:force:4', 1, 'competence', 'force', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB50:AE50 ; décision R54'),
  ('ressources/accessoires#effet:competence:intelligence:1', 1, 'competence', 'intelligence', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB76:AE76 ; décision R54'),
  ('ressources/accessoires#effet:competence:intelligence:2', 1, 'competence', 'intelligence', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB78:AE78 ; décision R54'),
  ('ressources/accessoires#effet:competence:intelligence:3', 1, 'competence', 'intelligence', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB80:AE80 ; décision R54'),
  ('ressources/accessoires#effet:competence:intelligence:4', 1, 'competence', 'intelligence', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB82:AE82 ; décision R54'),
  ('ressources/accessoires#effet:competence:perception:1', 1, 'competence', 'perception', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB52:AE52 ; décision R54'),
  ('ressources/accessoires#effet:competence:perception:2', 1, 'competence', 'perception', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB54:AE54 ; décision R54'),
  ('ressources/accessoires#effet:competence:perception:3', 1, 'competence', 'perception', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB56:AE56 ; décision R54'),
  ('ressources/accessoires#effet:competence:perception:4', 1, 'competence', 'perception', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB58:AE58 ; décision R54'),
  ('ressources/accessoires#effet:competence:social:1', 1, 'competence', 'social', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB68:AE68 ; décision R54'),
  ('ressources/accessoires#effet:competence:social:2', 1, 'competence', 'social', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB70:AE70 ; décision R54'),
  ('ressources/accessoires#effet:competence:social:3', 1, 'competence', 'social', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB72:AE72 ; décision R54'),
  ('ressources/accessoires#effet:competence:social:4', 1, 'competence', 'social', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB74:AE74 ; décision R54'),
  ('ressources/accessoires#effet:competence:volonte:1', 1, 'competence', 'volonte', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB60:AE60 ; décision R54'),
  ('ressources/accessoires#effet:competence:volonte:2', 1, 'competence', 'volonte', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB62:AE62 ; décision R54'),
  ('ressources/accessoires#effet:competence:volonte:3', 1, 'competence', 'volonte', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB64:AE64 ; décision R54'),
  ('ressources/accessoires#effet:competence:volonte:4', 1, 'competence', 'volonte', NULL, 1, 'equipement', 'Ressources et Craft › Accessoires › AB66:AE66 ; décision R54'),
  ('ressources/accessoires#effet:defense:1', 1, 'resistance', 'magies/magie-du-sang', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG44:CY44'),
  ('ressources/accessoires#effet:defense:1', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:saignement', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG44:CY44'),
  ('ressources/accessoires#effet:defense:11', 1, 'resistance', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG64:CY64'),
  ('ressources/accessoires#effet:defense:14', 1, 'armure_ap', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › CG70:CY70'),
  ('ressources/accessoires#effet:defense:15', 1, 'resistance', 'magies/magie-de-la-glace', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG72:CY72'),
  ('ressources/accessoires#effet:defense:15', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:gel', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG72:CY72'),
  ('ressources/accessoires#effet:defense:16', 1, 'resistance', 'magies/magie-de-la-terre', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG74:CY74'),
  ('ressources/accessoires#effet:defense:16', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:petrifie', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG74:CY74'),
  ('ressources/accessoires#effet:defense:17', 1, 'resistance', 'magies/magie-du-vent', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG76:CY76'),
  ('ressources/accessoires#effet:defense:17', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:surdite', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG76:CY76'),
  ('ressources/accessoires#effet:defense:18', 1, 'resistance', 'magies/magie-de-la-foudre', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG78:CY78'),
  ('ressources/accessoires#effet:defense:18', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:paralysie', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG78:CY78'),
  ('ressources/accessoires#effet:defense:19', 1, 'resistance', 'magies/magie-de-la-lumiere', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG80:CY80'),
  ('ressources/accessoires#effet:defense:19', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:aveuglement', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG80:CY80'),
  ('ressources/accessoires#effet:defense:2', 1, 'resistance', 'magies/magie-de-lespace-temps', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG46:CY46'),
  ('ressources/accessoires#effet:defense:2', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:fatigue', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG46:CY46'),
  ('ressources/accessoires#effet:defense:20', 1, 'resistance', 'magies/magie-de-lombre', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG82:CY82'),
  ('ressources/accessoires#effet:defense:20', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:peur', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG82:CY82'),
  ('ressources/accessoires#effet:defense:3', 1, 'resistance', 'magies/magie-du-vide', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG48:CY48'),
  ('ressources/accessoires#effet:defense:3', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:enrage', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG48:CY48'),
  ('ressources/accessoires#effet:defense:4', 1, 'resistance', 'magies/magie-de-la-necromancie', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG50:CY50'),
  ('ressources/accessoires#effet:defense:4', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:poison', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG50:CY50'),
  ('ressources/accessoires#effet:defense:5', 1, 'resistance', 'magies/magie-du-feu', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG52:CY52'),
  ('ressources/accessoires#effet:defense:5', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:brulure', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG52:CY52'),
  ('ressources/accessoires#effet:defense:6', 1, 'resistance', 'magies/magie-de-leau', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG54:CY54'),
  ('ressources/accessoires#effet:defense:6', 2, 'resistance', 'guide/liste-des-alterations-d-etat#etat:confusion', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG54:CY54'),
  ('ressources/accessoires#effet:defense:7', 1, 'armure_am', NULL, 5, 0, 'equipement', 'Ressources et Craft › Accessoires › CG56:CY56'),
  ('ressources/accessoires#effet:defense:9', 1, 'resistance', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 1, 0, 'equipement', 'Ressources et Craft › Accessoires › CG60:CY60');

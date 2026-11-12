-- Migration 0117 : Magie V10, la mise à jour de Décembre (lot 1 « Magies V10, données ») : décisions R236, R237, R242, R243, R244, R246 (et R10 pour les coquilles).
-- Source : la pièce jointe du propriétaire « Nouveauté mise à jour Décembre.xlsx » (sha256 e89fc4be…), instantané
-- sources/raw/classeurs/magie-maverick-v10.json, cité « Nouveauté mise à jour Décembre › <onglet> › <plage> » ; R237 (12) : pas de lecture des originaux Google.
-- Générée par un script du lot (hors dépôt) depuis les plans de tech-sources (plan-sorts.json, plan-magies-annexes.json, extraction du classeur) et la
-- base à la version 116 ; enfants des sorts et colonnes tirées des cases par la chaîne du service (serveur/edition.mjs#SORT), corps des pages par
-- lib/corps-magies.mjs. Registre : 0117-magies-v10-specialisations.json (ids, comptes, coûts R244, coquilles R10, écarts à la chaîne du plan).
--   - Spécialisations (R236 (1)) : table magie_specialisation (28), colonne sort.specialisation_id (CHECK : un sort de NPM 3 à 5, une spécialisation de sa magie).
--   - Sorts (R237) : 21 supprimés, 166 mis à jour (dont 8 renommés R237 (4) et 16 R237 (11), ids gardés), 135 inchangés,
--     119 nouveaux ; ordre 1-10 commun, 11-20 et 21-30 les deux spécialisations. Coûts que la lecture du service ne répartit pas : R244 (chakra dans
--     « Coût », précision dans « Coût secondaire » ; Contre-sort « N/A ») ; Projectile arcanique tel qu'écrit, rien de typé (MAJ-K7). Coquilles du
--     classeur (R10) : tools/sheets/corrections.json, section magie-v10. R243 (1) : les 6 textes d'incantation de Glace et de Terre restent (provenance V8).
--     R243 (2) : les fils de commentaires du V8 sont retirés des remarques et de note_cellule ; une remarque modifiée sur le site de dev reste.
--   - Magies : 2 champs, 42 rôles supprimés (R237 (7)) ; annexes : Somnolence, stades 3 de la Paralysie et de la Surdité, météos Saccage temporel
--     et Zone vide supprimées ; améliorations cadavériques supprimées (R237 (7)) ; règle « CHOSES A SAVOIR » (Sommaire AP1).
--   - Bestiaire (R242) : nouveaux noms des sorts renommés sur les cartes, liens vers les sorts supprimés vidés, Poupée fulgurante -> Boules plasmiques
--     (R246 : le texte de la capacité aussi).
-- Les retraits des fiches (R42) se font à la livraison (serveur/fiches-retraits.mjs#retirerLesManquants : un id absent de `sort`) : aucune fiche ne
-- porte un sort supprimé dans data/rows.

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 1. Spécialisations magiques (R236 (1)) : table magie_specialisation, 28 lignes ; colonne sort.specialisation_id
-- --------------------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE magie_specialisation (
  id          TEXT    NOT NULL PRIMARY KEY,
  magie_id    TEXT    NOT NULL REFERENCES magie(id),
  ordre       INTEGER NOT NULL CHECK (ordre IN (1, 2)),
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),
  nom_cle     TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  description TEXT,
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'magies'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,
  UNIQUE (magie_id, ordre),
  UNIQUE (magie_id, nom_cle),
  CHECK (substr(id, 1, length(magie_id) + 16) = magie_id || '#specialisation:')
) STRICT;
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-sang#specialisation:puissance', 'magies/magie-du-sang', 1, 'PUISSANCE', 'puissance', 'Puissance est la force brute de la magie du sang, du dégâts pur et dur.', 'magies', 'Nouveauté mise à jour Décembre › Sang › M70:AK73', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-sang#specialisation:puissance', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-sang#specialisation:sanguilonant', 'magies/magie-du-sang', 2, 'SANGUILONANT', 'sanguilonant', 'Il s''agit du côté soin et amplification de la magie du sang. Ici on retrouve de formidable amplification et soin.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AU70:BS73', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-sang#specialisation:sanguilonant', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-larcane#specialisation:construction', 'magies/magie-de-larcane', 1, 'CONSTRUCTION', 'construction', 'Construction est la forme créatrice de la magie de l''arcane, elle se concentre sur l''amplification.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › M75:AK78', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-larcane#specialisation:construction', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-larcane#specialisation:destruction', 'magies/magie-de-larcane', 2, 'DESTRUCTION', 'destruction', 'Destruction, comme son nom l''indique, est la forme destructrice de la magie de l''arcane, elle se concentre sur la puissance.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AU75:BS78', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-larcane#specialisation:destruction', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-corruption#specialisation:petrole', 'magies/magie-de-la-corruption', 1, 'PÉTROLE', 'petrole', 'Pétrole est la spécialisation qui concentre la puissance de la corruption.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › M75:AK78', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-corruption#specialisation:petrole', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-corruption#specialisation:bloqueur', 'magies/magie-de-la-corruption', 2, 'BLOQUEUR', 'bloqueur', 'Le bloqueur est celui qui va exploiter le meilleur des entrave de la magie de la corruption.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AU75:BS78', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-corruption#specialisation:bloqueur', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-lespace-temps#specialisation:spacio', 'magies/magie-de-lespace-temps', 1, 'SPACIO', 'spacio', 'La puissance de l''espace est concentrée ici. Beaucoup d''entrave de zone.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › M69:AK72', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-lespace-temps#specialisation:spacio', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-lespace-temps#specialisation:temporelle', 'magies/magie-de-lespace-temps', 2, 'TEMPORELLE', 'temporelle', 'La puissance du temps est concentrée ici. Beaucoup d''amplification.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AU69:BS72', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-lespace-temps#specialisation:temporelle', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-vide#specialisation:esprit', 'magies/magie-du-vide', 1, 'ESPRIT', 'esprit', 'Esprit est la spécialisation qui se concentre sur le renforcement de soi et de ses alliés.', 'magies', 'Nouveauté mise à jour Décembre › Vide › M69:AK72', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-vide#specialisation:esprit', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-vide#specialisation:contestation', 'magies/magie-du-vide', 2, 'CONTESTATION', 'contestation', 'Contestation est une spécialisation de la magie du vide qui se concentre sur les entraves.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AU69:BS72', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-vide#specialisation:contestation', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-necromancie#specialisation:liche', 'magies/magie-de-la-necromancie', 1, 'LICHE', 'liche', 'Liche est une spécialisation de la nécromancie qui se focalise sur la puissance de l''invocation mais aussi dans l''amplification des alliés.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › M72:AK75', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-necromancie#specialisation:liche', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-necromancie#specialisation:poison', 'magies/magie-de-la-necromancie', 2, 'POISON', 'poison', 'Poison est la spécialisation qui se concentre sur la puissance brute mais l''explotation de l''altération d''état poison.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AU72:BS75', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-necromancie#specialisation:poison', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-feu#specialisation:volcan', 'magies/magie-du-feu', 1, 'VOLCAN', 'volcan', 'La puissance du feu dans son état le plus pure. Beaucoup d''attaque mais également des chances d''infliger des brûlures', 'magies', 'Nouveauté mise à jour Décembre › Feu › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-feu#specialisation:volcan', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-feu#specialisation:cendre', 'magies/magie-du-feu', 2, 'CENDRE', 'cendre', 'Cette spécialisation est une forme un peu particulière de la magie du feu, elle permet des placements mais aussi beaucoup d''entrave.', 'magies', 'Nouveauté mise à jour Décembre › Feu › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-feu#specialisation:cendre', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-leau#specialisation:deferlante', 'magies/magie-de-leau', 1, 'DÉFERLANTE', 'deferlante', 'Déferlante est une spécialisation exploite la force et les dégâts de la magie de l''eau.', 'magies', 'Nouveauté mise à jour Décembre › Eau › M65:AK68', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-leau#specialisation:deferlante', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-leau#specialisation:source', 'magies/magie-de-leau', 2, 'SOURCE', 'source', 'Source est une façon d''utiliser la magie de l''eau en se focalisant sur le soin.', 'magies', 'Nouveauté mise à jour Décembre › Eau › AU65:BS68', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-leau#specialisation:source', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-glace#specialisation:neige', 'magies/magie-de-la-glace', 1, 'NEIGE', 'neige', 'La magie de la glace se concentre sur la puissance avec le côté de la neige, ces sorts sont plus fort si la météo neige ou tempête de neige sont présent sur le terrain.', 'magies', 'Nouveauté mise à jour Décembre › Glace › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-glace#specialisation:neige', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-glace#specialisation:cristal', 'magies/magie-de-la-glace', 2, 'CRISTAL', 'cristal', 'La puissance du cristal se focalise sur la défense de la magie de la glace.', 'magies', 'Nouveauté mise à jour Décembre › Glace › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-glace#specialisation:cristal', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-terre#specialisation:vegetal', 'magies/magie-de-la-terre', 1, 'VÉGÉTAL', 'vegetal', 'Libérez la puissance des végétaux, cette spécialisation est focalisé sur la puissance des plantes avec des soins et des entraves.', 'magies', 'Nouveauté mise à jour Décembre › Terre › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-terre#specialisation:vegetal', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-terre#specialisation:mineral', 'magies/magie-de-la-terre', 2, 'MINÉRAL', 'mineral', 'Cette spécialisation exploite le potentiel défensif de la magie de la terre.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-terre#specialisation:mineral', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-vent#specialisation:tempete', 'magies/magie-du-vent', 1, 'TEMPÊTE', 'tempete', 'La tempête est proche ! Cette spécialisation possède beaucoup de placement et de contrôle du terrain.', 'magies', 'Nouveauté mise à jour Décembre › Vent › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-vent#specialisation:tempete', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-du-vent#specialisation:son', 'magies/magie-du-vent', 2, 'SON', 'son', 'La spécialisation Son de la magie du vent concentre la puissance de cette magie.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-du-vent#specialisation:son', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-foudre#specialisation:plasma', 'magies/magie-de-la-foudre', 1, 'PLASMA', 'plasma', 'Plasma est une spécialisation qui pousse la puissance de la foudre à ses derniers retranchements.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-foudre#specialisation:plasma', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-foudre#specialisation:magnetisme', 'magies/magie-de-la-foudre', 2, 'MAGNÉTISME', 'magnetisme', 'Cette spécialisation de la foudre se concentre sur les amplifications.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-foudre#specialisation:magnetisme', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-lumiere#specialisation:solaire', 'magies/magie-de-la-lumiere', 1, 'SOLAIRE', 'solaire', 'Loué soit la puissance du Soleil ! Cette spécialisation permet d''exploiter la lumière comme une source de dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-lumiere#specialisation:solaire', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-la-lumiere#specialisation:benediction', 'magies/magie-de-la-lumiere', 2, 'BÉNÉDICTION', 'benediction', 'Ce côté de la magie de la lumière permet d''exploiter la pleine puissance des soins et amplification de la lumière.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-la-lumiere#specialisation:benediction', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-lombre#specialisation:lune', 'magies/magie-de-lombre', 1, 'LUNE', 'lune', 'Puisse la puissance de la lune être avec nous ! Cette spécialisation pousse la puissance de la magie de l''ombre vers un autre niveau.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › M66:AK69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-lombre#specialisation:lune', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, description, origine, source_ref, remarque) VALUES ('magies/magie-de-lombre#specialisation:songe', 'magies/magie-de-lombre', 2, 'SONGE', 'songe', 'L''expression des deux filles d''Umbro. Songe est une spécialisation qui se concentre sur la somnolence et l''entrave', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AU66:BS69', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('magie_specialisation', 'magies/magie-de-lombre#specialisation:songe', 'magies/magie-de-lombre', 0, 'magies');
ALTER TABLE sort ADD COLUMN specialisation_id TEXT REFERENCES magie_specialisation(id)
  CHECK (specialisation_id IS NULL OR (niveau >= 3 AND substr(specialisation_id, 1, length(magie_id) + 16) = magie_id || '#specialisation:'));
CREATE INDEX sort_specialisation ON sort (specialisation_id) WHERE specialisation_id IS NOT NULL;

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 2. Sorts supprimés (R237 (2), (3), (5), (7)) : 21, avec leurs lignes enfants ; les capacités de créature qui les citent gardent leur texte, sans lien (R242 (2))
-- --------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM sort_type WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
DELETE FROM sort_mode WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
DELETE FROM sort_bonus_maitrise WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
DELETE FROM sort_etat WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
DELETE FROM sort_mot_cle WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
DELETE FROM page_entite WHERE entite_table = 'sort' AND entite_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
UPDATE creature_capacite_sort SET sort_id = NULL WHERE sort_id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');
UPDATE invocation SET tableau_sort_id = NULL, tableau_titre = NULL, source_ref = 'Invocation › Animation des morts › AP1:BE2; AP3:BE38' WHERE id = 'bestiaire/animation-des-morts';
DELETE FROM sort WHERE id IN ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'magies/magie-de-la-lumiere#sort:vitamine', 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'magies/magie-de-la-terre#sort:anti-mythril', 'magies/magie-de-larcane#sort:vision-magique', 'magies/magie-de-larcane#sort:voile-chakratique', 'magies/magie-de-lespace-temps#sort:double-action', 'magies/magie-de-lespace-temps#sort:faille-temporelle', 'magies/magie-de-lombre#sort:javelot-sombre', 'magies/magie-du-feu#sort:bouclier-de-feu', 'magies/magie-du-feu#sort:meteore-cramoisi', 'magies/magie-du-feu#sort:pluie-chaude', 'magies/magie-du-feu#sort:rai-solaire', 'magies/magie-du-sang#sort:autel-sanglant', 'magies/magie-du-sang#sort:sang-magie', 'magies/magie-du-vent#sort:grande-vitesse', 'magies/magie-du-vide#sort:anti-magie', 'magies/magie-du-vide#sort:esprit-solide', 'magies/magie-du-vide#sort:metronome', 'magies/magie-du-vide#sort:saccage-temporel');

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 3. Sorts gardés : ordre 1-10 commun, 11-20 spécialisation de gauche, 21-30 de droite (en deux temps : UNIQUE (magie_id, ordre)) ; valeurs du classeur (R237 (2), (4), (6), (11))
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE sort SET ordre = ordre + 1000;
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V45:BB47', ordre = 1 WHERE id = 'magies/magie-de-la-corruption#sort:boule-sombre';
UPDATE sort SET effets = 'Si {{corruption|CR}} : Inflige 4 {{corruption|corruption}}.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › V48:BB50', ordre = 2 WHERE id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V51:BB53', ordre = 3 WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort SET nom = 'Verrouille Visible', nom_cle = 'verrouille-visible', source_ref = 'Nouveauté mise à jour Décembre › Corruption › V54:BB56', ordre = 4 WHERE id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V57:BB59', ordre = 5 WHERE id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V60:BB62', ordre = 6 WHERE id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort SET effets = 'Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de {{corruption|corruption}} par coup qui touche. Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › V63:BB65', ordre = 7 WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
UPDATE sort SET effets = 'Si {{corruption|CR}} : Inflige 10 de {{corruption|corruption}} en plus.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › V66:BB68', ordre = 8 WHERE id = 'magies/magie-de-la-corruption#sort:souffle-noir';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V69:BB71', ordre = 9 WHERE id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort SET effets = 'Peut être surchargé (15 {{chakra|chakra}} en + = 1 dé en +) (maximum 45 {{chakra|chakra}} en surcharge)
Si {{corruption|CR}} :  Ignore 50% de l''AM.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › V72:BB74', ordre = 10 WHERE id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
UPDATE sort SET nom = 'Mine poisseuse', nom_cle = 'mine-poisseuse', type_brut = 'Attaque/ Construction
(Inesquivable)', source_ref = 'Nouveauté mise à jour Décembre › Corruption › E80:AK82', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole', ordre = 11 WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire';
UPDATE sort SET effets = 'Tire un rayon qui ignore l''AM.. Augmente la réussite critique de 1%/NM. 
Si {{corruption|CR}} : La cible a -20% pour le jet de défense', source_ref = 'Nouveauté mise à jour Décembre › Corruption › E83:AK85', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole', ordre = 12 WHERE id = 'magies/magie-de-la-corruption#sort:laser-noir';
UPDATE sort SET effets = 'Si jet de fermeté raté : Inflige 7 (+2/NM) {{corruption|corruption}}.
Si {{corruption|CR}} : Fait reculer la cible de 1 case.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › E86:AK88', bonus_maitrise = 'Effets : Si jet de fermeté raté : Inflige 7 (+2/NM) corruption', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole', ordre = 13 WHERE id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
UPDATE sort SET nom = 'Grenade collante', ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Corruption › E95:AK97', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole' WHERE id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort SET ordre = 18, source_ref = 'Nouveauté mise à jour Décembre › Corruption › E101:AK103', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole' WHERE id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort SET ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Corruption › E104:AK106', specialisation_id = 'magies/magie-de-la-corruption#specialisation:petrole' WHERE id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM86:BS88', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort SET ordre = 24, source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM89:BS91', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort SET ordre = 26, dsb_brut = '6d6 + 25 dégâts', effets = 'Si {{corruption|CR}} : Retire un effet positif de la cible et le transforme en 2d8 {{barriere|barrière}} pour le lanceur.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM95:BS97', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:pour-moi';
UPDATE sort SET ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM98:BS100', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort SET ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM101:BS103', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort SET ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM104:BS106', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:sapeur';
UPDATE sort SET ordre = 30, cout_brut = '55 (-5/NM)', cout_chakra = 55, effets = 'Baisse d''un cran les résistances magiques pendant 3 tours.
Si {{corruption|CR}} : Les retire complètement et agrave les vulnérabilités d''un cran.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM107:BS109', specialisation_id = 'magies/magie-de-la-corruption#specialisation:bloqueur' WHERE id = 'magies/magie-de-la-corruption#sort:eau-noire';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V36:BB38', ordre = 1 WHERE id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V39:BB41', ordre = 2 WHERE id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V42:BB44', ordre = 3 WHERE id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort SET effets = 'II : Augmente l''initiative au prochain tour.
IG : Augmente l''initiative passivement du premier jet d''initiative.', source_ref = 'Nouveauté mise à jour Décembre › Foudre › V45:BB47', remarque = 'II : Initiative individuelle
IG : Initiative groupée', ordre = 4 WHERE id = 'magies/magie-de-la-foudre#sort:nerveux';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V48:BB50', ordre = 5 WHERE id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort SET nom = 'Fer foudroyant', source_ref = 'Nouveauté mise à jour Décembre › Foudre › V51:BB53', ordre = 6 WHERE id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort SET nom = 'Réflexe éclair', source_ref = 'Nouveauté mise à jour Décembre › Foudre › V54:BB56', ordre = 7 WHERE id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V57:BB59', ordre = 8 WHERE id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort SET effets = '+4 dégâts (cumulable 3 fois) pour le prochain sort d''attaque.', source_ref = 'Nouveauté mise à jour Décembre › Foudre › V60:BB62', remarque = NULL, ordre = 9 WHERE id = 'magies/magie-de-la-foudre#sort:chargeur';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V63:BB65', ordre = 10 WHERE id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort SET nom = 'Boules plasmiques', nom_cle = 'boules-plasmiques', cout_brut = '5', cout_chakra = 5, source_ref = 'Nouveauté mise à jour Décembre › Foudre › E71:AK73', cout_secondaire = 'Par boule', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma', ordre = 11 WHERE id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
UPDATE sort SET nom = 'Foudre rouge', cout_brut = '17', cout_chakra = 17, source_ref = 'Nouveauté mise à jour Décembre › Foudre › E74:AK76', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma', ordre = 12 WHERE id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
UPDATE sort SET ordre = 15, portee_brut = '6 (+1/NM)', portee_valeur = 6, dsb_brut = '8d6 + 25 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Foudre › E83:AK85', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma' WHERE id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
UPDATE sort SET ordre = 16, effets = 'Invoque la météo "orage" pendant 3 tours (+1/NM).', source_ref = 'Nouveauté mise à jour Décembre › Foudre › E86:AK88', bonus_maitrise = 'Effets : Invoque la météo "orage" pendant 3 tours (+1/NM)', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma' WHERE id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
UPDATE sort SET ordre = 17, zone_brut = 'Croix diagonale de 3 cases', zone_forme = 'croix', zone_taille = 3, source_ref = 'Nouveauté mise à jour Décembre › Foudre › E89:AK91', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma' WHERE id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
UPDATE sort SET nom = 'Orage violet', ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Foudre › E95:AK97', specialisation_id = 'magies/magie-de-la-foudre#specialisation:plasma' WHERE id = 'magies/magie-de-la-foudre#sort:orage-violet';
UPDATE sort SET nom = 'Plaques polarisées', nom_cle = 'plaques-polarisees', ordre = 22, effets = 'Invoque 2 plaques qui vont attirés les sorts qui sont à 2 cases du lanceur et les dévier pour les annulés (sort de niveau 3 maximum)', source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM74:BS76', remarque = 'Une plaque bloque qu''UN seul sort et disparaissent.

2 plaques à la fois maximum.', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79', remarque = 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
UPDATE sort SET nom = 'Vitesse ampère', ordre = 24, portee_brut = '3', portee_valeur = 3, dsb_brut = '+1 Vitesse', effets = 'Augmente la vitesse de la cible. Si il porte une armure lourde, il n''est plus ralenti. Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM80:BS82', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
UPDATE sort SET nom = 'Armure magnétique', nom_cle = 'armure-magnetique', ordre = 27, dsb_brut = '+5AP, +5AM', effets = 'Utilisable uniquement si la cible porte une armure avec du métal., la refonce et impose un malus de 15% à l''ennemi pour toucher. Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM89:BS91', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
UPDATE sort SET ordre = 28, cout_brut = '23', cout_chakra = 23, dsb_brut = '7d6 dégâts (+8/NM)', source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM92:BS94', bonus_maitrise = 'D/S/B : +8/NM', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
UPDATE sort SET ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM95:BS97', specialisation_id = 'magies/magie-de-la-foudre#specialisation:magnetisme' WHERE id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V36:BB38', ordre = 1 WHERE id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V39:BB41', ordre = 2 WHERE id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V42:BB44', ordre = 3 WHERE id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V45:BB47', ordre = 4 WHERE id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V48:BB50', ordre = 5 WHERE id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V51:BB53', ordre = 6 WHERE id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V54:BB56', ordre = 7 WHERE id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V57:BB59', ordre = 8 WHERE id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V60:BB62', ordre = 9 WHERE id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V63:BB65', ordre = 10 WHERE id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort SET effets = 'Si bonne météo = Inflige 2d dégâts en plus.', source_ref = 'Nouveauté mise à jour Décembre › Glace › E71:AK73', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige', ordre = 11 WHERE id = 'magies/magie-de-la-glace#sort:avalanche';
UPDATE sort SET effets = 'Si jet de vigueur raté = Inflige gel 3.
Si bonne météo = Inflige +8 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Glace › E77:AK79', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige', ordre = 13 WHERE id = 'magies/magie-de-la-glace#sort:prison-boreale';
UPDATE sort SET ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Glace › E86:AK88', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige' WHERE id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort SET ordre = 17, source_ref = 'Nouveauté mise à jour Décembre › Glace › E89:AK91', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige' WHERE id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
UPDATE sort SET ordre = 19, effets = 'Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt.
Si bonne météo = -1 tour', source_ref = 'Nouveauté mise à jour Décembre › Glace › E95:AK97; Magie Maverick V8 › Glace › AK81:BA88', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige' WHERE id = 'magies/magie-de-la-glace#sort:execution-froide';
UPDATE sort SET ordre = 20, dsb_brut = '90 dégâts (+10/NM)', effets = 'Si jet de vigueur raté = Inflige gel 3.
Si bonne météo = Malus de 20% à la cible pour ne pas prendre l''altération d''état.', source_ref = 'Nouveauté mise à jour Décembre › Glace › E98:AK100; Magie Maverick V8 › Glace › BB81:BR88', specialisation_id = 'magies/magie-de-la-glace#specialisation:neige' WHERE id = 'magies/magie-de-la-glace#sort:rayon-polaire';
UPDATE sort SET ordre = 22, dsb_brut = '7d6 + 15 dégâts (+3/NM)', effets = 'Envoie un gros pic de glace.', source_ref = 'Nouveauté mise à jour Décembre › Glace › AM74:BS76', bonus_maitrise = 'D/S/B : +3/NM', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:stalactite';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › Glace › AM77:BS79', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:gel-profond';
UPDATE sort SET ordre = 24, type_brut = 'Construction', source_ref = 'Nouveauté mise à jour Décembre › Glace › AM80:BS82', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:mur-de-glace';
UPDATE sort SET nom = 'Lance cristalline', nom_cle = 'lance-cristalline', ordre = 25, cout_brut = '24 (-2/NM)', cout_chakra = 24, zone_brut = '1', zone_forme = 'unique', zone_taille = 1, source_ref = 'Nouveauté mise à jour Décembre › Glace › AM83:BS85', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:lance-de-givre';
UPDATE sort SET ordre = 27, type_brut = 'Amplification', ic_nm_min = NULL, dsb_brut = '-25% dégâts finaux magique', effets = 'Réduit les dégâts magiques subis pendant 2 tours. 
3NM = réduit les dégâts de 50% au lieu de 25%.', source_ref = 'Nouveauté mise à jour Décembre › Glace › AM89:BS91', mode_brut = NULL, bonus_maitrise = 'Effets : 3NM = réduit les dégâts de 50% au lieu de 25%', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:cape-hivernale';
UPDATE sort SET nom = 'Étage nival', nom_cle = 'etage-nival', ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Glace › AM92:BS94', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort SET nom = 'Comète de Celsius', nom_cle = 'comete-de-celsius', ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › Glace › AM95:BS97; Magie Maverick V8 › Glace › T81:AJ88', specialisation_id = 'magies/magie-de-la-glace#specialisation:cristal' WHERE id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V36:BB38', ordre = 1 WHERE id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort SET nom = 'Inspiration céleste', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V39:BB41', ordre = 2 WHERE id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort SET nom = 'Champ de force', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V42:BB44', ordre = 3 WHERE id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V48:BB50', ordre = 5 WHERE id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort SET nom = 'Fer lumineux', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V51:BB53', ordre = 6 WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort SET dsb_brut = '+1d de dégâts', effets = 'Augmente les dégâts pendant 2 tours (+1/NM).', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V54:BB56', bonus_maitrise = 'Effets : Augmente les dégâts pendant 2 tours (+1/NM)', ordre = 7 WHERE id = 'magies/magie-de-la-lumiere#sort:benediction';
UPDATE sort SET nom = 'Énergie solaire', effets = 'Permet de récupérer *10% de {{barriere|barrière}} pendant 3 tours lors des météos de soleil.', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V57:BB59', ordre = 8 WHERE id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
UPDATE sort SET nom = 'Panneau solaire', dsb_brut = '+5 santé/tour', source_ref = 'Nouveauté mise à jour Décembre › Lumière › V60:BB62', ordre = 9 WHERE id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
UPDATE sort SET portee_brut = '4', portee_valeur = 4, source_ref = 'Nouveauté mise à jour Décembre › Lumière › V63:BB65', remarque = NULL, bonus_maitrise = 'D/S/B : +5/NM', ordre = 10 WHERE id = 'magies/magie-de-la-lumiere#sort:flash';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E71:AK73', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:solaire', ordre = 11 WHERE id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E77:AK79', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:solaire', ordre = 13 WHERE id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
UPDATE sort SET ordre = 17, effets = 'Inflige des dégâts de zone de Lumière. (3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1)', source_ref = 'Nouveauté mise à jour Décembre › Lumière › E89:AK91', bonus_maitrise = 'Effets : 3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:solaire' WHERE id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
UPDATE sort SET ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Lumière › E95:AK97', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:solaire' WHERE id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort SET ordre = 22, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM74:BS76', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:recouvrer';
UPDATE sort SET ordre = 24, effets = 'Peut soigner temporairement les infirmités.(3NM = Soigne une croix en carac)', source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM80:BS82', bonus_maitrise = 'D/S/B : +10/NM
Effets : Peut soigner temporairement les infirmités.(3NM = Soigne une croix en carac)', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:operation';
UPDATE sort SET ordre = 25, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM83:BS85', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort SET ordre = 26, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM86:BS88', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort SET ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM89:BS91', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort SET ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM92:BS94', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort SET ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM95:BS97', specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:resurrection';
UPDATE sort SET ordre = 30, effets = 'Permet de ranimer un allié dans le coma en lui redonnant 100% de sa santé. Le sort peut être utilisé sur un allié qui n''est pas dans le coma.', source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM98:BS100', remarque = NULL, specialisation_id = 'magies/magie-de-la-lumiere#specialisation:benediction' WHERE id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V42:BB44', ordre = 1 WHERE id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V45:BB47', ordre = 2 WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V48:BB50', ordre = 3 WHERE id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V51:BB53', ordre = 4 WHERE id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V54:BB56', ordre = 5 WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
UPDATE sort SET effets = 'Permet d''augmenter sa puissance grâce aux âmes pour le prochain coup. (Maxi 5 âmes d''un coup)', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V57:BB59', ordre = 6 WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
UPDATE sort SET cout_brut = '5', cout_chakra = 5, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V60:BB62', ordre = 7 WHERE id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
UPDATE sort SET nom = 'Armure osseuse', nom_cle = 'armure-osseuse', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V63:BB65', ordre = 8 WHERE id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort SET cout_brut = '9 (–1/NM)', cout_chakra = 9, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V66:BB68', ordre = 9 WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
UPDATE sort SET nom = 'Fer toxique', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V69:BB71', ordre = 10 WHERE id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort SET ordre = 12, type_brut = 'Construction 
(IC pour 3 NM)', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E80:AK82', remarque = 'Cette arme est considérée comme Spectrale.
Arme Spectrale = Peut toucher l''immatériel et ignore 50% des AP.', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
UPDATE sort SET cout_brut = '9', cout_chakra = 9, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E83:AK85', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche', ordre = 13 WHERE id = 'magies/magie-de-la-necromancie#sort:prison-dos';
UPDATE sort SET ordre = 14, cout_brut = '10', cout_chakra = 10, effets = 'Si jet de vigueur raté = Inflige Poison 1.', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E86:AK88', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
UPDATE sort SET nom = 'Vague de cadavre', nom_cle = 'vague-de-cadavre', ordre = 16, dsb_brut = '6d6 + 10 dégâts', effets = 'Si jet de vigueur raté = Inflige Empoisonné stade 1.', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E92:AK94', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
UPDATE sort SET nom = 'Répar Os', nom_cle = 'repar-os', ordre = 18, cout_ressource_valeur = 4, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E98:AK100', cout_secondaire = '4 âmes', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:repar-os';
UPDATE sort SET ordre = 19, cout_brut = '45 (-3/NM)', cout_ressource_valeur = 8, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E101:AK103', bonus_maitrise = 'Coût : -3/NM', cout_secondaire = '8 âmes', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:reanimation';
UPDATE sort SET nom = 'Résurrection noire', ordre = 20, cout_ressource_valeur = 8, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E104:AK106', remarque = 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.', cout_secondaire = '8 âmes', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:liche' WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
UPDATE sort SET ordre = 21, cout_brut = '10', cout_chakra = 10, cout_ressource_valeur = 4, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM77:BS79', cout_secondaire = '4 âmes', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:poison' WHERE id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
UPDATE sort SET ordre = 22, effets = 'Si jet de vigueur raté = Inflige Poison 1 à tous les ennemis dans la zone.', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:poison' WHERE id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
UPDATE sort SET ordre = 26, cout_brut = '20', cout_chakra = 20, effets = 'Si jet de vigueur raté = Inflige Poison 2 à toutes les cibles (3NM = Sauf alliés).', source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM92:BS94', bonus_maitrise = 'Effets : Si jet de vigueur raté = Inflige Poison 2 à toutes les cibles (3NM = Sauf alliés)', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:poison' WHERE id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
UPDATE sort SET ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM95:BS97', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:poison' WHERE id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
UPDATE sort SET nom = 'Déchirure verte', nom_cle = 'dechirure-verte', ordre = 29, cout_brut = '45 (-3/NM)', cout_chakra = 45, cout_ressource = 'ame', cout_ressource_valeur = 8, source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103', bonus_maitrise = 'Coût : -3/NM
D/S/B : +10/NM', cout_secondaire = '8 âmes', specialisation_id = 'magies/magie-de-la-necromancie#specialisation:poison' WHERE id = 'magies/magie-de-la-necromancie#sort:dechirure';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V36:BB38', ordre = 1 WHERE id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V39:BB41', ordre = 2 WHERE id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V42:BB44', remarque = NULL, ordre = 3 WHERE id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V45:BB47', remarque = NULL, ordre = 4 WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V48:BB50', ordre = 5 WHERE id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V51:BB53', ordre = 6 WHERE id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V54:BB56', ordre = 7 WHERE id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V57:BB59', remarque = NULL, ordre = 8 WHERE id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V60:BB62', remarque = NULL, ordre = 9 WHERE id = 'magies/magie-de-la-terre#sort:infection';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V63:BB65', remarque = NULL, ordre = 10 WHERE id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort SET ordre = 12, source_ref = 'Nouveauté mise à jour Décembre › Terre › E74:AK76', specialisation_id = 'magies/magie-de-la-terre#specialisation:vegetal' WHERE id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort SET ordre = 14, source_ref = 'Nouveauté mise à jour Décembre › Terre › E80:AK82', specialisation_id = 'magies/magie-de-la-terre#specialisation:vegetal' WHERE id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort SET ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Terre › E86:AK88', specialisation_id = 'magies/magie-de-la-terre#specialisation:vegetal' WHERE id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort SET ordre = 18, source_ref = 'Nouveauté mise à jour Décembre › Terre › E92:AK94', specialisation_id = 'magies/magie-de-la-terre#specialisation:vegetal' WHERE id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
UPDATE sort SET ordre = 19, dsb_brut = '10d6 + 80 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Terre › E95:AK97; Magie Maverick V8 › Terre › T81:AJ88', specialisation_id = 'magies/magie-de-la-terre#specialisation:vegetal' WHERE id = 'magies/magie-de-la-terre#sort:terre-maudite';
UPDATE sort SET ordre = 21, source_ref = 'Nouveauté mise à jour Décembre › Terre › AM71:BS73', remarque = 'Si jamais un coup physiques ou magiques est encaisser par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
UPDATE sort SET ordre = 22, effets = 'Rend l''arme plus lourde et augmente ses dégâts.', source_ref = 'Nouveauté mise à jour Décembre › Terre › AM74:BS76', remarque = NULL, specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:alourdissement';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › Terre › AM77:BS79', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort SET ordre = 25, source_ref = 'Nouveauté mise à jour Décembre › Terre › AM83:BS85', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:rouille';
UPDATE sort SET ordre = 27, effets = 'Invoque la météo "tempête de sable" pendant 3 tours (+1/NM).', source_ref = 'Nouveauté mise à jour Décembre › Terre › AM89:BS91', bonus_maitrise = 'Effets : Invoque la météo "tempête de sable" pendant 3 tours (+1/NM)', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
UPDATE sort SET ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › Terre › AM95:BS97; Magie Maverick V8 › Terre › BB81:BR88', remarque = 'Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
UPDATE sort SET ordre = 30, source_ref = 'Nouveauté mise à jour Décembre › Terre › AM98:BS100; Magie Maverick V8 › Terre › AK81:BA88', specialisation_id = 'magies/magie-de-la-terre#specialisation:mineral' WHERE id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort SET nom = 'Boule de chakra', source_ref = 'Nouveauté mise à jour Décembre › Arcane › V45:BB47', ordre = 1 WHERE id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V48:BB50', ordre = 2 WHERE id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort SET nom = 'Rune arcane', source_ref = 'Nouveauté mise à jour Décembre › Arcane › V51:BB53', ordre = 3 WHERE id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V54:BB56', ordre = 4 WHERE id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort SET type_brut = 'Construction (IC)', source_ref = 'Nouveauté mise à jour Décembre › Arcane › V57:BB58', ordre = 5 WHERE id = 'magies/magie-de-larcane#sort:forge-magie';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V60:BB62', ordre = 6 WHERE id = 'magies/magie-de-larcane#sort:inhalation-magique';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V63:BB65', ordre = 7 WHERE id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V66:BB68', ordre = 8 WHERE id = 'magies/magie-de-larcane#sort:echange';
UPDATE sort SET effets = 'Peut être surchargé (15 {{chakra|chakra}} en + = 1 dé en +) (maximum 45 {{chakra|chakra}} en surcharge)', source_ref = 'Nouveauté mise à jour Décembre › Arcane › V72:BB74', ordre = 10 WHERE id = 'magies/magie-de-larcane#sort:vague-deferlante';
UPDATE sort SET type_brut = 'Construction', source_ref = 'Nouveauté mise à jour Décembre › Arcane › E80:AK82', specialisation_id = 'magies/magie-de-larcane#specialisation:construction', ordre = 11 WHERE id = 'magies/magie-de-larcane#sort:mur-de-chakra';
UPDATE sort SET nom = 'Rune arcane multiple', ordre = 13, cout_brut = '8', cout_chakra = 8, source_ref = 'Nouveauté mise à jour Décembre › Arcane › E86:AK88', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
UPDATE sort SET nom = 'Champ gardien', ordre = 14, source_ref = 'Nouveauté mise à jour Décembre › Arcane › E89:AK91', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:champ-gardien';
UPDATE sort SET nom = 'Peau nacrée', nom_cle = 'peau-nacree', ordre = 15, cout_brut = '12', cout_chakra = 12, effets = 'Réduit les dégâts magiques finaux subis.', source_ref = 'Nouveauté mise à jour Décembre › Arcane › E92:AK94', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:peau-de-chakra';
UPDATE sort SET nom = 'Pluie blanche', nom_cle = 'pluie-blanche', ordre = 16, effets = 'Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi autant de {{chakra|chakra}} que dépensé.', source_ref = 'Nouveauté mise à jour Décembre › Arcane › E95:AK97', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
UPDATE sort SET nom = 'Miroir des arcanes', nom_cle = 'miroir-des-arcanes', ordre = 17, type_brut = 'Amplification', ic_nm_min = NULL, effets = 'Permet de renvoyer le sortilège de l''agresseur, 3 utilisations. (3NM = Ne prend plus l''effet en question).', source_ref = 'Nouveauté mise à jour Décembre › Arcane › E98:AK100', mode_brut = NULL, bonus_maitrise = 'Effets : 3NM = Ne prend plus l''effet en question', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:miroir-magique';
UPDATE sort SET nom = 'Planète chakratique', ordre = 20, source_ref = 'Nouveauté mise à jour Décembre › Arcane › E107:AK109', specialisation_id = 'magies/magie-de-larcane#specialisation:construction' WHERE id = 'magies/magie-de-larcane#sort:planete-chakratique';
UPDATE sort SET ordre = 22, effets = 'Tire un rayon qui ignore l''AM.', source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM83:BS85', specialisation_id = 'magies/magie-de-larcane#specialisation:destruction' WHERE id = 'magies/magie-de-larcane#sort:laser-de-chakra';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM86:BS88', specialisation_id = 'magies/magie-de-larcane#specialisation:destruction' WHERE id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort SET nom = 'Grenade de chakra', ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM98:BS100', specialisation_id = 'magies/magie-de-larcane#specialisation:destruction' WHERE id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
UPDATE sort SET nom = 'Foudre argenté', nom_cle = 'foudre-argente', ordre = 28, cout_brut = '20', cout_chakra = 20, dsb_brut = '3d10 dégâts (+10/NM)', source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM101:BS103', specialisation_id = 'magies/magie-de-larcane#specialisation:destruction' WHERE id = 'magies/magie-de-larcane#sort:foudre-argente';
UPDATE sort SET ordre = 29, dsb_brut = 'Vole 5d10 (+1d/3NM) {{chakra|chakra}}', source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM104:BS106', specialisation_id = 'magies/magie-de-larcane#specialisation:destruction' WHERE id = 'magies/magie-de-larcane#sort:drain-denergie';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V35:BB37', ordre = 1 WHERE id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V38:BB40', ordre = 2 WHERE id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V41:BB43', ordre = 3 WHERE id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort SET effets = 'Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1". 
Soigne 4 santé si utilisé à 4 cases de l''eau.', source_ref = 'Nouveauté mise à jour Décembre › Eau › V44:BB46', ordre = 4 WHERE id = 'magies/magie-de-leau#sort:eau-purifiante';
UPDATE sort SET dsb_brut = '2d6 (+4/NM) de soin', source_ref = 'Nouveauté mise à jour Décembre › Eau › V47:BB49', bonus_maitrise = 'D/S/B : +4/NM', ordre = 5 WHERE id = 'magies/magie-de-leau#sort:eau-soignante';
UPDATE sort SET nom = 'Fer humide', source_ref = 'Nouveauté mise à jour Décembre › Eau › V50:BB52', ordre = 6 WHERE id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort SET nom = 'Souffle hydraulique', source_ref = 'Nouveauté mise à jour Décembre › Eau › V53:BB55', ordre = 7 WHERE id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort SET nom = 'Onde confusion', nom_cle = 'onde-confusion', source_ref = 'Nouveauté mise à jour Décembre › Eau › V56:BB58', ordre = 8 WHERE id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V59:BB61', ordre = 9 WHERE id = 'magies/magie-de-leau#sort:barriere-deau';
UPDATE sort SET dsb_brut = '3d6 (+4/NM) de soin', source_ref = 'Nouveauté mise à jour Décembre › Eau › V62:BB64', bonus_maitrise = 'D/S/B : +4/NM', ordre = 10 WHERE id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E70:AK72', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante', ordre = 11 WHERE id = 'magies/magie-de-leau#sort:trombe-deau';
UPDATE sort SET dsb_brut = '7d6 + 5 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Eau › E73:AK75', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante', ordre = 12 WHERE id = 'magies/magie-de-leau#sort:lame-sous-pression';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E76:AK78', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante', ordre = 13 WHERE id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E79:AK81', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante', ordre = 14 WHERE id = 'magies/magie-de-leau#sort:courant-salvateur';
UPDATE sort SET ordre = 15, portee_brut = '4 (+2/NM)', portee_valeur = 4, effets = 'Augmente de 5% la RC si à 4 cases d''un point d''eau.', source_ref = 'Nouveauté mise à jour Décembre › Eau › E82:AK84', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante' WHERE id = 'magies/magie-de-leau#sort:fouet-deau';
UPDATE sort SET ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Eau › E85:AK87', specialisation_id = 'magies/magie-de-leau#specialisation:deferlante' WHERE id = 'magies/magie-de-leau#sort:grenade-incapacitante';
UPDATE sort SET ordre = 24, dsb_brut = 'Soigne une altération d''état, +4d6 soin', source_ref = 'Nouveauté mise à jour Décembre › Eau › AM79:BS81', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:eau-parfaite';
UPDATE sort SET nom = 'Laser hydraulique', niveau = 4, ordre = 25, type_brut = 'Attaque', cout_brut = '26 (-2/NM)', cout_chakra = 26, portee_brut = '14', portee_valeur = 14, zone_brut = '1', zone_forme = 'unique', zone_taille = 1, dsb_brut = '35 dégâts', effets = 'Tire un rayon qui ignore l''AM. +10 dégâts si à 4 cases d''un point d''eau.', texte_niveau5 = NULL, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM82:BS84', remarque = 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', bonus_maitrise = 'Coût : -2/NM', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:laser-hydraulique';
UPDATE sort SET ordre = 26, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM85:BS87', remarque = NULL, specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort SET ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM88:BS90', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort SET ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM91:BS93', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:cascade-apaisante';
UPDATE sort SET ordre = 29, cout_brut = '55 (-5/NM)', cout_chakra = 55, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM94:BS96; AU100:BK101, AU102:BK109', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:larmes-doceane';
UPDATE sort SET ordre = 30, source_ref = 'Nouveauté mise à jour Décembre › Eau › AM97:BS99; AU111:BK112, AU113:BK120', specialisation_id = 'magies/magie-de-leau#specialisation:source' WHERE id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort SET nom = 'Coup du sablier', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V39:BB41', ordre = 1 WHERE id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V42:BB44', ordre = 2 WHERE id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V45:BB47', ordre = 3 WHERE id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V48:BB50', ordre = 4 WHERE id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V51:BB53', ordre = 5 WHERE id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort SET nom = 'Fer temporel', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V54:BB56', ordre = 6 WHERE id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort SET cout_brut = '6', cout_chakra = 6, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V60:BB62', ordre = 8 WHERE id = 'magies/magie-de-lespace-temps#sort:ralentissement';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V63:BB65', ordre = 9 WHERE id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort SET nom = 'Main de la momie', nom_cle = 'main-de-la-momie', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68', remarque = 'Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', ordre = 10 WHERE id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
UPDATE sort SET ordre = 13, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E80:AK82', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:spacio' WHERE id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort SET nom = 'Grenade distordue', ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E89:AK91', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:spacio' WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort SET ordre = 18, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E95:AK97', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:spacio' WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort SET nom = 'Trou noir', ordre = 19, cout_brut = '55 (-5/NM)', cout_chakra = 55, effets = 'Attire les cibles vers le centre de l''attaque, impossible de lutter contre.', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E98:AK100', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:spacio' WHERE id = 'magies/magie-de-lespace-temps#sort:trou-noir';
UPDATE sort SET ordre = 20, effets = 'Si jet de fermeté raté = Perd le tour.
Si jet de fermeté réussi = Étourdi pour 1 tour.', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E101:AK103', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:spacio' WHERE id = 'magies/magie-de-lespace-temps#sort:distorsion';
UPDATE sort SET ordre = 21, effets = 'Remet l''objet à un état antérieur il y a 10 secondes ou 1 minute.', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM74:BS76', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
UPDATE sort SET nom = 'Tranche temps', ordre = 22, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM77:BS79', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort SET ordre = 23, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM80:BS82', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort SET ordre = 24, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM83:BS85', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
UPDATE sort SET ordre = 25, dsb_brut = '+1 action', source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM86:BS88', remarque = 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:celerite';
UPDATE sort SET ordre = 27, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM92:BS94', remarque = NULL, specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
UPDATE sort SET ordre = 29, source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM98:BS100', specialisation_id = 'magies/magie-de-lespace-temps#specialisation:temporelle' WHERE id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V36:BB38', ordre = 1 WHERE id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V39:BB41', ordre = 2 WHERE id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V42:BB44', ordre = 3 WHERE id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort SET nom = 'Brume mental', nom_cle = 'brume-mental', source_ref = 'Nouveauté mise à jour Décembre › Ombre › V45:BB47', ordre = 4 WHERE id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort SET dsb_brut = '-5 INI (-2/NM)', effets = 'II : Diminue l''initiative de la cible à son prochain tour.
IG : Diminue l''initiative passivement du premier jet d''initiative ennemi.', source_ref = 'Nouveauté mise à jour Décembre › Ombre › V48:BB50', remarque = 'II : Initiative individuelle
IG : Initiative groupée', bonus_maitrise = 'D/S/B : -2/NM', ordre = 5 WHERE id = 'magies/magie-de-lombre#sort:pichenette';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V51:BB53', ordre = 6 WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V54:BB56', ordre = 7 WHERE id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V57:BB59', ordre = 8 WHERE id = 'magies/magie-de-lombre#sort:lame-dombre';
UPDATE sort SET dsb_brut = '-1d de dégâts', effets = 'Diminue les dégâts pendant 2 tours (+1/NM).', source_ref = 'Nouveauté mise à jour Décembre › Ombre › V60:BB62', bonus_maitrise = 'Effets : Diminue les dégâts pendant 2 tours (+1/NM)', ordre = 9 WHERE id = 'magies/magie-de-lombre#sort:malediction';
UPDATE sort SET nom = 'Fer obscur', source_ref = 'Nouveauté mise à jour Décembre › Ombre › V63:BB65', ordre = 10 WHERE id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E71:AK73', specialisation_id = 'magies/magie-de-lombre#specialisation:lune', ordre = 11 WHERE id = 'magies/magie-de-lombre#sort:brouillard-obscur';
UPDATE sort SET effets = 'Augmente dangereusement les dégâts pour 2 tours. (cumulable 2 fois)', source_ref = 'Nouveauté mise à jour Décembre › Ombre › E77:AK79', specialisation_id = 'magies/magie-de-lombre#specialisation:lune', ordre = 13 WHERE id = 'magies/magie-de-lombre#sort:amplification-sombre';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E80:AK82', specialisation_id = 'magies/magie-de-lombre#specialisation:lune', ordre = 14 WHERE id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort SET nom = 'Rayon lunatique', nom_cle = 'rayon-lunatique', ordre = 15, type_brut = 'Attaque/ Entrave', cout_brut = '22 (-2/NM)', cout_chakra = 22, portee_brut = '7', portee_valeur = 7, effets = 'Fermeté raté = Inflige Peur 1', source_ref = 'Nouveauté mise à jour Décembre › Ombre › E83:AK85', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:rayon-negatif';
UPDATE sort SET nom = 'Grenade fumigène', ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Ombre › E86:AK88', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort SET ordre = 17, source_ref = 'Nouveauté mise à jour Décembre › Ombre › E89:AK91', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort SET nom = 'Régolithe', nom_cle = 'regolithe', ordre = 18, cout_brut = '20 (-2/NM)', cout_chakra = 20, portee_brut = '5', portee_valeur = 5, effets = 'Fermeté réussi = Inflige Peur 2
Fermeté raté = Inflige Peur 3', source_ref = 'Nouveauté mise à jour Décembre › Ombre › E92:AK94', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:goudron';
UPDATE sort SET ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Ombre › E95:AK97', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
UPDATE sort SET nom = 'Frappe négative', ordre = 20, dsb_brut = '10d6 + 70 dégâts', effets = 'Lance un rayon différent des autres, plus la santé est basse, plus les effets sont puissants (voir la liste en commentaire)', source_ref = 'Nouveauté mise à jour Décembre › Ombre › E98:AK100', specialisation_id = 'magies/magie-de-lombre#specialisation:lune' WHERE id = 'magies/magie-de-lombre#sort:frappe-negative';
UPDATE sort SET ordre = 24, source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM80:BS82', specialisation_id = 'magies/magie-de-lombre#specialisation:songe' WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort SET ordre = 28, effets = 'Donne vie à l''ombre de la cible pour 6 tours et va attaquer qu''elle. Peut être décimé par une attaque de Lumière.', source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM92:BS94', specialisation_id = 'magies/magie-de-lombre#specialisation:songe' WHERE id = 'magies/magie-de-lombre#sort:pire-ami';
UPDATE sort SET nom = 'Armée de l''ombre', ordre = 29, zone_brut = 'Sur 4 ligne devant le lanceur', zone_forme = 'autre', zone_taille = NULL, effets = 'Ignore la défense partielle à 3NM. Les ennemis qui souffrent de somnolence prennent 10 dégâts/niveau de somnolence.', source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM95:BS97', bonus_maitrise = 'Coût : -5/NM
Effets : Ignore la défense partielle à 3NM', specialisation_id = 'magies/magie-de-lombre#specialisation:songe' WHERE id = 'magies/magie-de-lombre#sort:armee-de-lombre';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V36:BB38', ordre = 1 WHERE id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V39:BB41', ordre = 2 WHERE id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort SET nom = 'Aura chaude', source_ref = 'Nouveauté mise à jour Décembre › Feu › V42:BB44', ordre = 3 WHERE id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort SET nom = 'Détection du feu', source_ref = 'Nouveauté mise à jour Décembre › Feu › V45:BB47', ordre = 4 WHERE id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V48:BB50', ordre = 5 WHERE id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V51:BB53', remarque = 'Si coup critique avec une arme sous ce sort, inflige brûlure au stade 1', ordre = 6 WHERE id = 'magies/magie-du-feu#sort:fer-brulant';
UPDATE sort SET dsb_brut = '3d6 dégâts (+1d6/NM)', source_ref = 'Nouveauté mise à jour Décembre › Feu › V54:BB56', bonus_maitrise = 'D/S/B : +1d6/NM
Effets : Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise)', ordre = 7 WHERE id = 'magies/magie-du-feu#sort:etincelle';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V57:BB59', ordre = 8 WHERE id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V60:BB62', ordre = 9 WHERE id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V63:BB65', ordre = 10 WHERE id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort SET ordre = 11, source_ref = 'Nouveauté mise à jour Décembre › Feu › E71:AK73', specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E74:AK76', specialisation_id = 'magies/magie-du-feu#specialisation:volcan', ordre = 12 WHERE id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E77:AK79', specialisation_id = 'magies/magie-du-feu#specialisation:volcan', ordre = 13 WHERE id = 'magies/magie-du-feu#sort:marcheur-exalte';
UPDATE sort SET ordre = 14, type_brut = 'Construction', imparable = 0, effets = 'Ceux qui ne possèdent pas de résistance au Feu doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours.', source_ref = 'Nouveauté mise à jour Décembre › Feu › E80:AK82', mode_brut = NULL, specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:mur-de-flammes';
UPDATE sort SET ordre = 15, source_ref = 'Nouveauté mise à jour Décembre › Feu › E83:AK85', specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort SET ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Feu › E86:AK88', specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort SET ordre = 17, source_ref = 'Nouveauté mise à jour Décembre › Feu › E89:AK91', specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:zenith';
UPDATE sort SET ordre = 19, dsb_brut = '10d6 + 90 dégâts (+10/NM)', source_ref = 'Nouveauté mise à jour Décembre › Feu › E95:AK97; L102:AB103, L104:AB111', cout_secondaire = '25% PV', specialisation_id = 'magies/magie-du-feu#specialisation:volcan' WHERE id = 'magies/magie-du-feu#sort:bucher-purifiant';
UPDATE sort SET ordre = 28, cout_brut = '25 (-2/NM)', cout_chakra = 25, effets = 'Permet d''infliger brûlure 3 aux immunisés et de brûler ce qui ne peut l''être. Les petits objets brûlés deviennent des tas de cendre.', source_ref = 'Nouveauté mise à jour Décembre › Feu › AM92:BS94', specialisation_id = 'magies/magie-du-feu#specialisation:cendre' WHERE id = 'magies/magie-du-feu#sort:combustion-forte';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V40:BB42', ordre = 1 WHERE id = 'magies/magie-du-sang#sort:boule-de-sang';
UPDATE sort SET cout_brut = '2', cout_chakra = 2, dsb_brut = '1d6 dégâts (+3/NM)', source_ref = 'Nouveauté mise à jour Décembre › Sang › V43:BB45', bonus_maitrise = 'D/S/B : +3/NM', ordre = 2 WHERE id = 'magies/magie-du-sang#sort:clou';
UPDATE sort SET portee_brut = '1 (+1/NM)', dsb_brut = '+1d de dégâts reçu', source_ref = 'Nouveauté mise à jour Décembre › Sang › V46:BB48', bonus_maitrise = 'Portée : +1/NM', ordre = 3 WHERE id = 'magies/magie-du-sang#sort:marquage';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V49:BB51', remarque = '- Inutile contre les infirmités, la fatigue physique, les croix.
- Ne marche pas sur les effets magie niveau 3 ou plus
- Soigne d''un cran les altérations d''états.', ordre = 4 WHERE id = 'magies/magie-du-sang#sort:annulation';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V52:BB54', ordre = 5 WHERE id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort SET nom = 'Sang durci', effets = '+3AP/AM.  Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Sang › V55:BB57', ordre = 6 WHERE id = 'magies/magie-du-sang#sort:sang-durci';
UPDATE sort SET nom = 'Fer sanglant', source_ref = 'Nouveauté mise à jour Décembre › Sang › V58:BB60', ordre = 7 WHERE id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort SET nom = 'Sang garde', effets = '+10% aux jets de défense. Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Sang › V61:BB63', remarque = NULL, ordre = 8 WHERE id = 'magies/magie-du-sang#sort:sang-garde';
UPDATE sort SET nom = 'Sang gain', effets = '+2 Vitesse. Dure 3 tours.', source_ref = 'Nouveauté mise à jour Décembre › Sang › V67:BB69', ordre = 10 WHERE id = 'magies/magie-du-sang#sort:sang-gain';
UPDATE sort SET cout_ressource_valeur = 3, source_ref = 'Nouveauté mise à jour Décembre › Sang › E75:AK77', cout_secondaire = '3 Sang', specialisation_id = 'magies/magie-du-sang#specialisation:puissance', ordre = 11 WHERE id = 'magies/magie-du-sang#sort:saignee-forcee';
UPDATE sort SET ordre = 14, effets = 'Une explosion qui inflige des dégâts selon le nombre de Sang utilisé. Ne touche pas les alliés.', source_ref = 'Nouveauté mise à jour Décembre › Sang › E84:AK86', specialisation_id = 'magies/magie-du-sang#specialisation:puissance' WHERE id = 'magies/magie-du-sang#sort:deflagration-sanguine';
UPDATE sort SET ordre = 15, cout_ressource_valeur = 4, source_ref = 'Nouveauté mise à jour Décembre › Sang › E87:AK89', cout_secondaire = '4 Sang', specialisation_id = 'magies/magie-du-sang#specialisation:puissance' WHERE id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort SET nom = 'Grenade à clous', ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Sang › E90:AK92', specialisation_id = 'magies/magie-du-sang#specialisation:puissance' WHERE id = 'magies/magie-du-sang#sort:grenade-a-clous';
UPDATE sort SET nom = 'Sang perfection', ordre = 19, cout_ressource_valeur = 8, effets = '+15 dégâts, +5AP, +5AM, +2 Vitesse dure 2 tours (+1/NM).', source_ref = 'Nouveauté mise à jour Décembre › Sang › E99:AK101; L106:AB107, L108:AB115', bonus_maitrise = 'Effets : +15 dégâts, +5AP, +5AM, +2 Vitesse dure 2 tours (+1/NM)', cout_secondaire = '8 Sang', specialisation_id = 'magies/magie-du-sang#specialisation:puissance' WHERE id = 'magies/magie-du-sang#sort:sang-perfection';
UPDATE sort SET ordre = 22, source_ref = 'Nouveauté mise à jour Décembre › Sang › AM78:BS80', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:morsure-aspirante';
UPDATE sort SET ordre = 23, type_brut = 'Construction', source_ref = 'Nouveauté mise à jour Décembre › Sang › AM81:BS83', remarque = 'Le mur est fixé au sol.', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:coagulation';
UPDATE sort SET ordre = 24, cout_ressource_valeur = 3, source_ref = 'Nouveauté mise à jour Décembre › Sang › AM84:BS86', cout_secondaire = '3 Sang', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:renfermement';
UPDATE sort SET ordre = 26, cout_brut = '19', cout_chakra = 19, portee_brut = '4', portee_valeur = 4, effets = 'Prend la moitié des dégâts d''un allié ciblé pendant 3 tours. Redonne 1 sang tous les 15 dégâts encaissé.', source_ref = 'Nouveauté mise à jour Décembre › Sang › AM90:BS92', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:douleur-partagee';
UPDATE sort SET ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Sang › AM96:BS98', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort SET ordre = 29, cout_brut = '50', cout_chakra = 50, cout_ressource_valeur = 8, effets = 'Augmente la taille d''un cran, +1 Force, +20 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours. Jet de vigueur à la fin pour ne pas prendre fatigue 1.', source_ref = 'Nouveauté mise à jour Décembre › Sang › AM99:BS101; AU106:BK107, AU108:BK115', remarque = 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 6 de force temporairement)', bonus_maitrise = 'Effets : Augmente la taille d''un cran, +1 Force, +20 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours', cout_secondaire = '8 Sang', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree';
UPDATE sort SET ordre = 30, cout_brut = '45', cout_chakra = 45, effets = 'Donne et réparti toute sa santé aux alliés dans la zone. Coma. (Garde 1 santé à 3NM)', source_ref = 'Nouveauté mise à jour Décembre › Sang › AM102:BS104', specialisation_id = 'magies/magie-du-sang#specialisation:sanguilonant' WHERE id = 'magies/magie-du-sang#sort:sacrifice';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V36:BB38', ordre = 1 WHERE id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V39:BB41', ordre = 2 WHERE id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort SET nom = 'Vents murmures', source_ref = 'Nouveauté mise à jour Décembre › Vent › V42:BB44', ordre = 3 WHERE id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort SET nom = 'Force agile', source_ref = 'Nouveauté mise à jour Décembre › Vent › V45:BB47', ordre = 4 WHERE id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V48:BB50', ordre = 5 WHERE id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V51:BB53', ordre = 6 WHERE id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V54:BB56', ordre = 7 WHERE id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V57:BB59', ordre = 8 WHERE id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort SET type_brut = 'Protection (IC)', source_ref = 'Nouveauté mise à jour Décembre › Vent › V60:BB62', ordre = 9 WHERE id = 'magies/magie-du-vent#sort:feuille-morte';
UPDATE sort SET nom = 'Recul forcé', effets = 'Fait reculer la cible de 1 case (+1/NM). -1 case si la cible est grande.', source_ref = 'Nouveauté mise à jour Décembre › Vent › V63:BB65', remarque = 'Sans NM dedans, le sort ne peut pas reculé une cible grande. Et c''est maximum 1 pour cette même cible.', bonus_maitrise = 'Effets : Fait reculer la cible de 1 case (+1/NM)
Remarque : Sans NM dedans, le sort ne peut pas reculé une cible grande', ordre = 10 WHERE id = 'magies/magie-du-vent#sort:recul-force';
UPDATE sort SET ordre = 11, type_brut = 'Attaque (Inesquivable)', imparable = 0, dsb_brut = '5d6 + 15 dégâts', effets = 'Inflige des dégâts en zone.', source_ref = 'Nouveauté mise à jour Décembre › Vent › E71:AK73', remarque = NULL, mode_brut = 'Inesquivable', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:tornade';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E74:AK76', specialisation_id = 'magies/magie-du-vent#specialisation:tempete', ordre = 12 WHERE id = 'magies/magie-du-vent#sort:bourrasque';
UPDATE sort SET cout_brut = '12', cout_chakra = 12, source_ref = 'Nouveauté mise à jour Décembre › Vent › E77:AK79', specialisation_id = 'magies/magie-du-vent#specialisation:tempete', ordre = 13 WHERE id = 'magies/magie-du-vent#sort:desarmer';
UPDATE sort SET ordre = 14, source_ref = 'Nouveauté mise à jour Décembre › Vent › E80:AK82', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort SET ordre = 17, cout_brut = '21', cout_chakra = 21, dsb_brut = '+2 Vitesse', effets = 'Augmente la vitesse pour 3 tours. Divise par deux le poids de la cible.', source_ref = 'Nouveauté mise à jour Décembre › Vent › E89:AK91', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:allegement';
UPDATE sort SET ordre = 18, source_ref = 'Nouveauté mise à jour Décembre › Vent › E92:AK94', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort SET ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Vent › E95:AK97', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:danse-de-lair';
UPDATE sort SET ordre = 20, dsb_brut = '10d6 + 60 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Vent › E98:AK100', specialisation_id = 'magies/magie-du-vent#specialisation:tempete' WHERE id = 'magies/magie-du-vent#sort:explosif';
UPDATE sort SET nom = 'Estoc hurlante', nom_cle = 'estoc-hurlante', ordre = 21, cout_brut = '12', cout_chakra = 12, source_ref = 'Nouveauté mise à jour Décembre › Vent › AM71:BS73', specialisation_id = 'magies/magie-du-vent#specialisation:son' WHERE id = 'magies/magie-du-vent#sort:estoc-hurlante';
UPDATE sort SET ordre = 25, source_ref = 'Nouveauté mise à jour Décembre › Vent › AM83:BS85', specialisation_id = 'magies/magie-du-vent#specialisation:son' WHERE id = 'magies/magie-du-vent#sort:grenade-explosive';
UPDATE sort SET ordre = 26, dsb_brut = '6d6 + 25 dégâts sonores', effets = 'Incante une vibration insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité/réflexe raté = Tombe par terre.', source_ref = 'Nouveauté mise à jour Décembre › Vent › AM86:BS88', specialisation_id = 'magies/magie-du-vent#specialisation:son' WHERE id = 'magies/magie-du-vent#sort:vibration';
UPDATE sort SET ordre = 30, portee_brut = '8', portee_valeur = 8, dsb_brut = '10d6 + 60 dégâts sonores', source_ref = 'Nouveauté mise à jour Décembre › Vent › AM98:BS100', specialisation_id = 'magies/magie-du-vent#specialisation:son' WHERE id = 'magies/magie-du-vent#sort:megaphone';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V39:BB41', ordre = 1 WHERE id = 'magies/magie-du-vide#sort:bulle-de-vide';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V42:BB44', remarque = 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)', ordre = 2 WHERE id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V45:BB47', ordre = 3 WHERE id = 'magies/magie-du-vide#sort:silence';
UPDATE sort SET effets = 'Si jet d''athlétisme/équilibre raté =Les cibles perdent leur vitesse au prochain tour.', source_ref = 'Nouveauté mise à jour Décembre › Vide › V48:BB50', ordre = 4 WHERE id = 'magies/magie-du-vide#sort:pression';
UPDATE sort SET cout_brut = '4', cout_chakra = 4, source_ref = 'Nouveauté mise à jour Décembre › Vide › V51:BB53', ordre = 5 WHERE id = 'magies/magie-du-vide#sort:injonction-du-vide';
UPDATE sort SET nom = 'Fer vide', source_ref = 'Nouveauté mise à jour Décembre › Vide › V54:BB56', ordre = 6 WHERE id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort SET nom = 'Bisou du vide', effets = 'Inflige "enragé 1" à la cible.', source_ref = 'Nouveauté mise à jour Décembre › Vide › V57:BB59', ordre = 7 WHERE id = 'magies/magie-du-vide#sort:bisou-du-vide';
UPDATE sort SET nom = 'Poing implosif', nom_cle = 'poing-implosif', source_ref = 'Nouveauté mise à jour Décembre › Vide › V60:BB62', ordre = 8 WHERE id = 'magies/magie-du-vide#sort:poing-du-vide';
UPDATE sort SET cout_brut = '4', cout_chakra = 4, source_ref = 'Nouveauté mise à jour Décembre › Vide › V63:BB65', ordre = 9 WHERE id = 'magies/magie-du-vide#sort:lien-mental';
UPDATE sort SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V66:BB68', remarque = '- Ne marche pas sur les effets magie niveau 4 ou plus
- Inutile contre les infirmités, la fatigue physique, les croix.
- Soigne d''un cran les altérations d''états.', ordre = 10 WHERE id = 'magies/magie-du-vide#sort:dissipation';
UPDATE sort SET ordre = 11, source_ref = 'Nouveauté mise à jour Décembre › Vide › E74:AK76', remarque = 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.', specialisation_id = 'magies/magie-du-vide#specialisation:esprit' WHERE id = 'magies/magie-du-vide#sort:aspect-vide';
UPDATE sort SET zone_brut = '2', zone_forme = 'autre', zone_taille = NULL, source_ref = 'Nouveauté mise à jour Décembre › Vide › E77:AK79', specialisation_id = 'magies/magie-du-vide#specialisation:esprit', ordre = 12 WHERE id = 'magies/magie-du-vide#sort:invisibilite';
UPDATE sort SET dsb_brut = '20 dégâts', effets = 'Inflige des dégâts fixes à 4 ennemis visibles. (Ignore la BA pour 3NM)', source_ref = 'Nouveauté mise à jour Décembre › Vide › E80:AK82', bonus_maitrise = 'Effets : Ignore la BA pour 3NM', specialisation_id = 'magies/magie-du-vide#specialisation:esprit', ordre = 13 WHERE id = 'magies/magie-du-vide#sort:lame-du-vide';
UPDATE sort SET nom = 'Touché du vide', nom_cle = 'touche-du-vide', ordre = 14, source_ref = 'Nouveauté mise à jour Décembre › Vide › E83:AK85', specialisation_id = 'magies/magie-du-vide#specialisation:esprit' WHERE id = 'magies/magie-du-vide#sort:touche-du-vide';
UPDATE sort SET nom = 'Grenade implosive', ordre = 16, type_brut = 'Attaque/ Placement', source_ref = 'Nouveauté mise à jour Décembre › Vide › E89:AK91', specialisation_id = 'magies/magie-du-vide#specialisation:esprit' WHERE id = 'magies/magie-du-vide#sort:grenade-implosive';
UPDATE sort SET nom = 'Marteau du vide', ordre = 20, dsb_brut = '10d6 + 70 dégâts', source_ref = 'Nouveauté mise à jour Décembre › Vide › E101:AK103; L116:AB117, L118:AB125', specialisation_id = 'magies/magie-du-vide#specialisation:esprit' WHERE id = 'magies/magie-du-vide#sort:marteau-du-vide';
UPDATE sort SET nom = 'Sablier du vide', ordre = 21, source_ref = 'Nouveauté mise à jour Décembre › Vide › AM74:BS76', specialisation_id = 'magies/magie-du-vide#specialisation:contestation' WHERE id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort SET ordre = 25, source_ref = 'Nouveauté mise à jour Décembre › Vide › AM86:BS88', specialisation_id = 'magies/magie-du-vide#specialisation:contestation' WHERE id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort SET ordre = 28, source_ref = 'Nouveauté mise à jour Décembre › Vide › AM95:BS97', specialisation_id = 'magies/magie-du-vide#specialisation:contestation' WHERE id = 'magies/magie-du-vide#sort:mot-du-vide';

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 4. Lignes enfants des sorts gardés : recalculées par la chaîne du service là où une cellule a changé, sinon gardées ; provenance du classeur de Décembre
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V45:BB47' WHERE sort_id = 'magies/magie-de-la-corruption#sort:boule-sombre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V45:BB47' WHERE sort_id = 'magies/magie-de-la-corruption#sort:boule-sombre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V45:BB47' WHERE sort_id = 'magies/magie-de-la-corruption#sort:boule-sombre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V45:BB47' WHERE sort_id = 'magies/magie-de-la-corruption#sort:boule-sombre';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:tir-dhuile', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › V48:BB50');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V48:BB50' WHERE sort_id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V48:BB50' WHERE sort_id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V51:BB53' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V51:BB53' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V51:BB53' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V51:BB53' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V54:BB56' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V54:BB56' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V54:BB56' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V54:BB56' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V57:BB59' WHERE sort_id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V57:BB59' WHERE sort_id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V57:BB59' WHERE sort_id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V57:BB59' WHERE sort_id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V60:BB62' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V60:BB62' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V60:BB62' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V60:BB62' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:fer-corrompu', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Corruption › V63:BB65');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V63:BB65' WHERE sort_id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V63:BB65' WHERE sort_id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:souffle-noir';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:souffle-noir';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:souffle-noir', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › V66:BB68');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V66:BB68' WHERE sort_id = 'magies/magie-de-la-corruption#sort:souffle-noir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V66:BB68' WHERE sort_id = 'magies/magie-de-la-corruption#sort:souffle-noir';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V69:BB71' WHERE sort_id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V69:BB71' WHERE sort_id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V69:BB71' WHERE sort_id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V69:BB71' WHERE sort_id = 'magies/magie-de-la-corruption#sort:petrole';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:vague-deferlante', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › V72:BB74');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V72:BB74' WHERE sort_id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › V72:BB74' WHERE sort_id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-la-corruption#sort:mine-noire';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-la-corruption#sort:mine-noire';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:mine-noire';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:mine-noire';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E80:AK82');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 2, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E80:AK82');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E80:AK82');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:laser-noir';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:laser-noir';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:laser-noir', 'effets', 1, 'par_nm', '1%/NM', 'Augmente la réussite critique de 1%/NM', '1%', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E83:AK85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E83:AK85' WHERE sort_id = 'magies/magie-de-la-corruption#sort:laser-noir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E83:AK85' WHERE sort_id = 'magies/magie-de-la-corruption#sort:laser-noir';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:fouet-tenebreux', 'effets', 1, 'par_nm', '+2/NM', 'Si jet de fermeté raté : Inflige 7 (+2/NM) corruption', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E86:AK88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E86:AK88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E86:AK88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E95:AK97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E95:AK97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E95:AK97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E95:AK97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E101:AK103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E101:AK103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E101:AK103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E101:AK103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E104:AK106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E104:AK106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E104:AK106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › E104:AK106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:pour-moi';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:pour-moi';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pour-moi';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-corruption#sort:pour-moi';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM104:BS106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:sapeur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM104:BS106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:sapeur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM104:BS106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:sapeur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM104:BS106' WHERE sort_id = 'magies/magie-de-la-corruption#sort:sapeur';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-corruption#sort:eau-noire';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-corruption#sort:eau-noire';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:eau-noire', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM107:BS109');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM107:BS109' WHERE sort_id = 'magies/magie-de-la-corruption#sort:eau-noire';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AM107:BS109' WHERE sort_id = 'magies/magie-de-la-corruption#sort:eau-noire';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-foudre#sort:affutage';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:nerveux';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:nerveux';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:nerveux', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › V45:BB47');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:nerveux', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › V45:BB47');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V45:BB47' WHERE sort_id = 'magies/magie-de-la-foudre#sort:nerveux';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V45:BB47' WHERE sort_id = 'magies/magie-de-la-foudre#sort:nerveux';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:chargeur';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:chargeur';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:chargeur', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V60:BB62' WHERE sort_id = 'magies/magie-de-la-foudre#sort:chargeur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V60:BB62' WHERE sort_id = 'magies/magie-de-la-foudre#sort:chargeur';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:boules-de-foudre', 'effets', 1, 'par_nm', '+1/NM', '1 boule (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E71:AK73');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E71:AK73' WHERE sort_id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E71:AK73' WHERE sort_id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:foudre-rouge', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E74:AK76');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:foudre-rouge', 'guide/liste-des-alterations-d-etat#etat:brulure', 'inflige', 1, 1, 'effets', 'Brûlure', 'Si jet de vigueur raté = Inflige Brûlure 1.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E74:AK76');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:foudre-rouge', 'guide/liste-des-alterations-d-etat#etat:paralysie', 'inflige', 1, 1, 'effets', 'Paralysie', 'Si jet de vigueur 2 raté = Inflige Paralysie 1.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E74:AK76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:eclair-en-chaine', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E83:AK85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E83:AK85' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E83:AK85' WHERE sort_id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:colere-de-volt', 'effets', 1, 'par_nm', '+1/NM', 'Invoque la météo "orage" pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E86:AK88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:grenade-paralysante', 'effets', 1, 'palier', '3NM = Si jet de vigueur raté = Inflige paralysie 1', '3NM = Si jet de vigueur raté = Inflige paralysie 1', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E89:AK91');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:grenade-paralysante', 'guide/liste-des-alterations-d-etat#etat:paralysie', 'inflige', 1, 1, 'effets', 'paralysie', '(3NM = Si jet de vigueur raté = Inflige paralysie 1).', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E89:AK91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E89:AK91' WHERE sort_id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E89:AK91' WHERE sort_id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:orage-violet';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:orage-violet';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:orage-violet';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:orage-violet';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:plaque-miroir', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM74:BS76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:dysfonctionnement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:dysfonctionnement', 'effets', 1, 'par_nm', '+1 tour/NM', 'agit de manière incohérente pendant 1 tour (+1 tour/NM)', '+1 tour', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:vitesse-ampere', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM80:BS82');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:armure-conductrice', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM89:BS91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:cercle-electrique', 'dsb', 1, 'par_nm', '+8/NM', '+8/NM', '+8', 8, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM92:BS94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V36:BB38' WHERE sort_id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V36:BB38' WHERE sort_id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V36:BB38' WHERE sort_id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V36:BB38' WHERE sort_id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V39:BB41' WHERE sort_id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V39:BB41' WHERE sort_id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V39:BB41' WHERE sort_id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V39:BB41' WHERE sort_id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V42:BB44' WHERE sort_id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V42:BB44' WHERE sort_id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V42:BB44' WHERE sort_id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V42:BB44' WHERE sort_id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V45:BB47' WHERE sort_id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V45:BB47' WHERE sort_id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V45:BB47' WHERE sort_id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V45:BB47' WHERE sort_id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V48:BB50' WHERE sort_id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V48:BB50' WHERE sort_id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V48:BB50' WHERE sort_id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V48:BB50' WHERE sort_id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V51:BB53' WHERE sort_id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V51:BB53' WHERE sort_id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V51:BB53' WHERE sort_id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V51:BB53' WHERE sort_id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V54:BB56' WHERE sort_id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V54:BB56' WHERE sort_id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V54:BB56' WHERE sort_id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V54:BB56' WHERE sort_id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V57:BB59' WHERE sort_id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V57:BB59' WHERE sort_id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V57:BB59' WHERE sort_id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V57:BB59' WHERE sort_id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V60:BB62' WHERE sort_id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V60:BB62' WHERE sort_id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V60:BB62' WHERE sort_id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V60:BB62' WHERE sort_id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V63:BB65' WHERE sort_id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V63:BB65' WHERE sort_id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V63:BB65' WHERE sort_id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › V63:BB65' WHERE sort_id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:avalanche';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:avalanche';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:avalanche', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E71:AK73');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E71:AK73' WHERE sort_id = 'magies/magie-de-la-glace#sort:avalanche';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E71:AK73' WHERE sort_id = 'magies/magie-de-la-glace#sort:avalanche';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:prison-boreale';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:prison-boreale';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:prison-boreale', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E77:AK79');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:prison-boreale', 'guide/liste-des-alterations-d-etat#etat:gel', 'inflige', 1, 3, 'effets', 'gel', 'Si jet de vigueur raté = Inflige gel 3.', 'magies', 'Nouveauté mise à jour Décembre › Glace › E77:AK79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E77:AK79' WHERE sort_id = 'magies/magie-de-la-glace#sort:prison-boreale';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E77:AK79' WHERE sort_id = 'magies/magie-de-la-glace#sort:prison-boreale';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E86:AK88' WHERE sort_id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E86:AK88' WHERE sort_id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E86:AK88' WHERE sort_id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E86:AK88' WHERE sort_id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E89:AK91' WHERE sort_id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E89:AK91' WHERE sort_id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E89:AK91' WHERE sort_id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E89:AK91' WHERE sort_id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:execution-froide';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:execution-froide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:execution-froide', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E95:AK97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E95:AK97' WHERE sort_id = 'magies/magie-de-la-glace#sort:execution-froide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E95:AK97' WHERE sort_id = 'magies/magie-de-la-glace#sort:execution-froide';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:rayon-polaire';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:rayon-polaire';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:rayon-polaire', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E98:AK100');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:rayon-polaire', 'guide/liste-des-alterations-d-etat#etat:gel', 'inflige', 1, 3, 'effets', 'gel', 'Si jet de vigueur raté = Inflige gel 3.', 'magies', 'Nouveauté mise à jour Décembre › Glace › E98:AK100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E98:AK100' WHERE sort_id = 'magies/magie-de-la-glace#sort:rayon-polaire';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › E98:AK100' WHERE sort_id = 'magies/magie-de-la-glace#sort:rayon-polaire';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:stalactite';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:stalactite';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:stalactite', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM74:BS76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-glace#sort:stalactite';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-glace#sort:stalactite';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-glace#sort:gel-profond';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-glace#sort:gel-profond';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-glace#sort:gel-profond';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-glace#sort:gel-profond';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-la-glace#sort:mur-de-glace';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-la-glace#sort:mur-de-glace';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:mur-de-glace';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:mur-de-glace';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:mur-de-glace', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Glace › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:mur-de-glace', 'effets', 1, 'par_nm', '+10/NM', 'Encaisse un total de 40 points de dégâts (+10/NM)', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM80:BS82');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:lance-de-givre';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:lance-de-givre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:lance-de-givre', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM83:BS85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-glace#sort:lance-de-givre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-glace#sort:lance-de-givre';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-la-glace#sort:cape-hivernale';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-la-glace#sort:cape-hivernale';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-glace#sort:cape-hivernale';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-glace#sort:cape-hivernale';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cape-hivernale', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Glace › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cape-hivernale', 'effets', 1, 'palier', '3NM = réduit les dégâts de 50% au lieu de 25%', '3NM = réduit les dégâts de 50% au lieu de 25%', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM89:BS91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V36:BB38' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V36:BB38' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V36:BB38' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V36:BB38' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V39:BB41' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V39:BB41' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V39:BB41' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V39:BB41' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V42:BB44' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V42:BB44' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V42:BB44' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V42:BB44' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V48:BB50' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V48:BB50' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V48:BB50' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V48:BB50' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V51:BB53' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V51:BB53' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V51:BB53' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V51:BB53' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:benediction';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:benediction';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:benediction', 'effets', 1, 'par_nm', '+1/NM', 'Augmente les dégâts pendant 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V54:BB56');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V54:BB56' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:benediction';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V54:BB56' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:benediction';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:energie-solaire', 'zone', 1, 'palier', '3NM = Croix 1x1', '3NM = Croix 1x1', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V57:BB59');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V57:BB59' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V57:BB59' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:panneau-solaire', 'effets', 1, 'palier', '3NM permet de le faire sur 2 alliés', 'Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V60:BB62' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V60:BB62' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:flash';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:flash', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V63:BB65');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V63:BB65' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:flash';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V63:BB65' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:flash';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › V63:BB65' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:flash';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E71:AK73' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E71:AK73' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E71:AK73' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E71:AK73' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E77:AK79' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E77:AK79' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E77:AK79' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E77:AK79' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:grenade-flash', 'effets', 1, 'palier', '3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1', '3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E89:AK91');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:grenade-flash', 'guide/liste-des-alterations-d-etat#etat:aveuglement', 'prend', 1, 1, 'effets', 'aveuglé', '(3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1)', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E89:AK91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E89:AK91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E89:AK91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E95:AK97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E95:AK97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E95:AK97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › E95:AK97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:recouvrer';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:recouvrer';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:recouvrer';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:recouvrer';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:operation';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:operation';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:operation', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:operation', 'effets', 1, 'palier', '3NM = Soigne une croix en carac', 'Peut soigner temporairement les infirmités.(3NM = Soigne une croix en carac)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM80:BS82');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:operation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:operation';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM86:BS88' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:resurrection';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:resurrection';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:resurrection';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:resurrection';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:louange-daurora', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM98:BS100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V42:BB44' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V42:BB44' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V42:BB44' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V42:BB44' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V45:BB47' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V45:BB47' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V45:BB47' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V45:BB47' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V48:BB50' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V48:BB50' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V48:BB50' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V48:BB50' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V51:BB53' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V51:BB53' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V51:BB53' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V51:BB53' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V54:BB56' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V54:BB56' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V54:BB56' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V54:BB56' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forces-des-ames', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › V57:BB59');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forces-des-ames', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › V57:BB59');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V57:BB59' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V57:BB59' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:pieu-dos', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › V60:BB62');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:pieu-dos', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 1, 'effets', 'poison', 'Si jet de vigueur raté = Inflige poison 1', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V60:BB62' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V60:BB62' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V63:BB65' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V63:BB65' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V63:BB65' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V63:BB65' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:armure-dos';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:detection-de-la-mort', 'cout', 1, 'par_nm', '–1/NM', '–1/NM', '–1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › V66:BB68');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V66:BB68' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V66:BB68' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V69:BB71' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V69:BB71' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V69:BB71' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › V69:BB71' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 'effets', 1, 'par_nm', '+1 par NM', '1 seule utilisation (+1 par NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E80:AK82');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:prison-dos';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:prison-dos';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:prison-dos', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E83:AK85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E83:AK85' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:prison-dos';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E83:AK85' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:prison-dos';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:calin-putrefie', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E86:AK88');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:calin-putrefie', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 1, 'effets', 'Poison', 'Si jet de vigueur raté = Inflige Poison 1.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E86:AK88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E86:AK88' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E86:AK88' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:vague-de-cadavre', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E92:AK94');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:vague-de-cadavre', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 1, 'effets', 'Empoisonné', 'Si jet de vigueur raté = Inflige Empoisonné stade 1.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E92:AK94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E92:AK94' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E92:AK94' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E98:AK100' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:repar-os';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E98:AK100' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:repar-os';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E98:AK100' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:repar-os';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E98:AK100' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:repar-os';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:reanimation';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:reanimation';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:reanimation', 'cout', 1, 'par_nm', '-3/NM', '-3/NM', '-3', -3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E101:AK103');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E101:AK103' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:reanimation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E101:AK103' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:reanimation';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:resurrection-noir', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E104:AK106');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E104:AK106' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E104:AK106' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › E104:AK106' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:festin-des-ames', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM77:BS79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:poison-de-masse', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:poison-de-masse', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 1, 'dsb', 'poison', 'Inflige poison stade 1', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:poison-de-masse', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 2, 1, 'effets', 'Poison', 'Si jet de vigueur raté = Inflige Poison 1 à tous les ennemis dans la zone.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM80:BS82' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:grenade-caustique', 'effets', 1, 'palier', '3NM = Sauf alliés', 'Si jet de vigueur raté = Inflige Poison 2 à toutes les cibles (3NM = Sauf alliés)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM92:BS94');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:grenade-caustique', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 2, 'effets', 'Poison', 'Si jet de vigueur raté = Inflige Poison 2 à toutes les cibles (3NM = Sauf alliés).', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM92:BS94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM92:BS94' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-necromancie#sort:dechirure';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-necromancie#sort:dechirure';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:dechirure', 'cout', 1, 'par_nm', '-3/NM', '-3/NM', '-3', -3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:dechirure', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:dechirure', 'guide/liste-des-alterations-d-etat#etat:poison', 'inflige', 1, 2, 'effets', 'poison', 'Une terrible attaque qui inflige de gros dégâts, Si jet de vigueur raté = Inflige poison 2.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:dechirure';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AM101:BS103' WHERE sort_id = 'magies/magie-de-la-necromancie#sort:dechirure';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V36:BB38' WHERE sort_id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V39:BB41' WHERE sort_id = 'magies/magie-de-la-terre#sort:tremblement';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:peau-de-pierre', 'dsb', 1, 'par_nm', '+1AP/NM', '+1AP/NM', '+1AP', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › V42:BB44');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V42:BB44' WHERE sort_id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:appel-aux-golems', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › V45:BB47');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V45:BB47' WHERE sort_id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V45:BB47' WHERE sort_id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V45:BB47' WHERE sort_id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V48:BB50' WHERE sort_id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V51:BB53' WHERE sort_id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V54:BB56' WHERE sort_id = 'magies/magie-de-la-terre#sort:fer-raffine';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:arbre-fertilisant', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › V57:BB59');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V57:BB59' WHERE sort_id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:infection';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:infection', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › V60:BB62');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:infection', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V60:BB62' WHERE sort_id = 'magies/magie-de-la-terre#sort:infection';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V60:BB62' WHERE sort_id = 'magies/magie-de-la-terre#sort:infection';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V60:BB62' WHERE sort_id = 'magies/magie-de-la-terre#sort:infection';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:cuirasse-de-roche', 'dsb', 1, 'par_nm', '+2AP/NM', '+2AP/NM', '+2AP', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › V63:BB65');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › V63:BB65' WHERE sort_id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E74:AK76' WHERE sort_id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E80:AK82' WHERE sort_id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E80:AK82' WHERE sort_id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E80:AK82' WHERE sort_id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E80:AK82' WHERE sort_id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E86:AK88' WHERE sort_id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E92:AK94' WHERE sort_id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E92:AK94' WHERE sort_id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E92:AK94' WHERE sort_id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E92:AK94' WHERE sort_id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:terre-maudite';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-terre#sort:terre-maudite';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:terre-maudite', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E95:AK97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-terre#sort:terre-maudite';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › E95:AK97' WHERE sort_id = 'magies/magie-de-la-terre#sort:terre-maudite';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:barriere-rocheuse', 'effets', 1, 'par_nm', '+7/NM', 'Confère une protection par-dessus la barrière qui encaisse les coups inférieurs à 20 dégâts (+7/NM)', '+7', 7, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM71:BS73');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM71:BS73' WHERE sort_id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM71:BS73' WHERE sort_id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM71:BS73' WHERE sort_id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:alourdissement';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-terre#sort:alourdissement';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:alourdissement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM74:BS76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-terre#sort:alourdissement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM74:BS76' WHERE sort_id = 'magies/magie-de-la-terre#sort:alourdissement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM77:BS79' WHERE sort_id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-terre#sort:rouille';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-terre#sort:rouille';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-terre#sort:rouille';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM83:BS85' WHERE sort_id = 'magies/magie-de-la-terre#sort:rouille';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:redemption-de-dimitri', 'effets', 1, 'par_nm', '+1/NM', 'Invoque la météo "tempête de sable" pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM89:BS91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM89:BS91' WHERE sort_id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:corps-de-maverium', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM95:BS97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM95:BS97' WHERE sort_id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AM98:BS100' WHERE sort_id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V45:BB47' WHERE sort_id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V45:BB47' WHERE sort_id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V45:BB47' WHERE sort_id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V45:BB47' WHERE sort_id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V48:BB50' WHERE sort_id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V48:BB50' WHERE sort_id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V48:BB50' WHERE sort_id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V48:BB50' WHERE sort_id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V51:BB53' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V51:BB53' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V51:BB53' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V51:BB53' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V54:BB56' WHERE sort_id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V54:BB56' WHERE sort_id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V54:BB56' WHERE sort_id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V54:BB56' WHERE sort_id = 'magies/magie-de-larcane#sort:claquement';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-larcane#sort:forge-magie';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-larcane#sort:forge-magie';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:forge-magie';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:forge-magie';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:forge-magie', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Arcane › V57:BB58');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:forge-magie', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › V57:BB58');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:forge-magie', 'effets', 1, 'par_nm', '+1 utilisation/NM', 'Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM)', '+1 utilisation', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › V57:BB58');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V60:BB62' WHERE sort_id = 'magies/magie-de-larcane#sort:inhalation-magique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V60:BB62' WHERE sort_id = 'magies/magie-de-larcane#sort:inhalation-magique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V60:BB62' WHERE sort_id = 'magies/magie-de-larcane#sort:inhalation-magique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V60:BB62' WHERE sort_id = 'magies/magie-de-larcane#sort:inhalation-magique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V63:BB65' WHERE sort_id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V63:BB65' WHERE sort_id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V63:BB65' WHERE sort_id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V63:BB65' WHERE sort_id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V66:BB68' WHERE sort_id = 'magies/magie-de-larcane#sort:echange';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V66:BB68' WHERE sort_id = 'magies/magie-de-larcane#sort:echange';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V66:BB68' WHERE sort_id = 'magies/magie-de-larcane#sort:echange';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V66:BB68' WHERE sort_id = 'magies/magie-de-larcane#sort:echange';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:vague-deferlante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:vague-deferlante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:vague-deferlante', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › V72:BB74');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V72:BB74' WHERE sort_id = 'magies/magie-de-larcane#sort:vague-deferlante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › V72:BB74' WHERE sort_id = 'magies/magie-de-larcane#sort:vague-deferlante';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-larcane#sort:mur-de-chakra';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-larcane#sort:mur-de-chakra';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:mur-de-chakra';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:mur-de-chakra';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:mur-de-chakra', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Arcane › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:mur-de-chakra', 'effets', 1, 'par_nm', '+10/NM', 'Bloque 40 (+10/NM) dégâts par tour pendant 3 tours', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E80:AK82');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:rune-arcane-multiple', 'type', 1, 'par_nm', 'IC x 1/NM', 'IC x 1/NM', 'IC x 1', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E86:AK88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E86:AK88' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E86:AK88' WHERE sort_id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E89:AK91' WHERE sort_id = 'magies/magie-de-larcane#sort:champ-gardien';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E89:AK91' WHERE sort_id = 'magies/magie-de-larcane#sort:champ-gardien';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E89:AK91' WHERE sort_id = 'magies/magie-de-larcane#sort:champ-gardien';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E89:AK91' WHERE sort_id = 'magies/magie-de-larcane#sort:champ-gardien';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:peau-de-chakra';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:peau-de-chakra';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:peau-de-chakra', 'type', 1, 'par_nm', 'IC x 1/NM', 'IC x 1/NM', 'IC x 1', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E92:AK94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E92:AK94' WHERE sort_id = 'magies/magie-de-larcane#sort:peau-de-chakra';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E92:AK94' WHERE sort_id = 'magies/magie-de-larcane#sort:peau-de-chakra';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:pluie-de-chakra', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E95:AK97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E95:AK97' WHERE sort_id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E95:AK97' WHERE sort_id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-larcane#sort:miroir-magique';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-larcane#sort:miroir-magique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:miroir-magique';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:miroir-magique';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:miroir-magique', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Arcane › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:miroir-magique', 'effets', 1, 'palier', '3NM = Ne prend plus l''effet en question', '3NM = Ne prend plus l''effet en question', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E98:AK100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E107:AK109' WHERE sort_id = 'magies/magie-de-larcane#sort:planete-chakratique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E107:AK109' WHERE sort_id = 'magies/magie-de-larcane#sort:planete-chakratique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E107:AK109' WHERE sort_id = 'magies/magie-de-larcane#sort:planete-chakratique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › E107:AK109' WHERE sort_id = 'magies/magie-de-larcane#sort:planete-chakratique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:laser-de-chakra';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:laser-de-chakra';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:laser-de-chakra', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM83:BS85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM83:BS85' WHERE sort_id = 'magies/magie-de-larcane#sort:laser-de-chakra';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM83:BS85' WHERE sort_id = 'magies/magie-de-larcane#sort:laser-de-chakra';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM86:BS88' WHERE sort_id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM86:BS88' WHERE sort_id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM86:BS88' WHERE sort_id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM86:BS88' WHERE sort_id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM98:BS100' WHERE sort_id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM98:BS100' WHERE sort_id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM98:BS100' WHERE sort_id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM98:BS100' WHERE sort_id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:foudre-argente';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:foudre-argente';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:foudre-argente', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM101:BS103');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM101:BS103' WHERE sort_id = 'magies/magie-de-larcane#sort:foudre-argente';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM101:BS103' WHERE sort_id = 'magies/magie-de-larcane#sort:foudre-argente';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-larcane#sort:drain-denergie';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-larcane#sort:drain-denergie';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:drain-denergie', 'dsb', 1, 'par_nm', '+1d/3NM', '+1d/3NM', '+1d', NULL, 3, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM104:BS106');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM104:BS106' WHERE sort_id = 'magies/magie-de-larcane#sort:drain-denergie';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AM104:BS106' WHERE sort_id = 'magies/magie-de-larcane#sort:drain-denergie';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V35:BB37' WHERE sort_id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V35:BB37' WHERE sort_id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V35:BB37' WHERE sort_id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V35:BB37' WHERE sort_id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V38:BB40' WHERE sort_id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V38:BB40' WHERE sort_id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V38:BB40' WHERE sort_id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V38:BB40' WHERE sort_id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V41:BB43' WHERE sort_id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V41:BB43' WHERE sort_id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V41:BB43' WHERE sort_id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V41:BB43' WHERE sort_id = 'magies/magie-de-leau#sort:mucus-protecteur';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:eau-purifiante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:eau-purifiante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-purifiante', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Eau › V44:BB46');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-purifiante', 'guide/liste-des-alterations-d-etat#etat:poison', 'soigne', 1, 1, 'effets', 'Poison', 'Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1".', 'magies', 'Nouveauté mise à jour Décembre › Eau › V44:BB46');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-purifiante', 'guide/liste-des-alterations-d-etat#etat:brulure', 'soigne', 1, 1, 'effets', 'Brûlure', 'Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1".', 'magies', 'Nouveauté mise à jour Décembre › Eau › V44:BB46');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-purifiante', 'guide/liste-des-alterations-d-etat#etat:paralysie', 'soigne', 1, 1, 'effets', 'Paralysie', 'Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1".', 'magies', 'Nouveauté mise à jour Décembre › Eau › V44:BB46');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V44:BB46' WHERE sort_id = 'magies/magie-de-leau#sort:eau-purifiante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V44:BB46' WHERE sort_id = 'magies/magie-de-leau#sort:eau-purifiante';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:eau-soignante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:eau-soignante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-soignante', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › V47:BB49');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V47:BB49' WHERE sort_id = 'magies/magie-de-leau#sort:eau-soignante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V47:BB49' WHERE sort_id = 'magies/magie-de-leau#sort:eau-soignante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V50:BB52' WHERE sort_id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V50:BB52' WHERE sort_id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V50:BB52' WHERE sort_id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V50:BB52' WHERE sort_id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V53:BB55' WHERE sort_id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V53:BB55' WHERE sort_id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V53:BB55' WHERE sort_id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V53:BB55' WHERE sort_id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V56:BB58' WHERE sort_id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V56:BB58' WHERE sort_id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V56:BB58' WHERE sort_id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V56:BB58' WHERE sort_id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V59:BB61' WHERE sort_id = 'magies/magie-de-leau#sort:barriere-deau';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V59:BB61' WHERE sort_id = 'magies/magie-de-leau#sort:barriere-deau';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V59:BB61' WHERE sort_id = 'magies/magie-de-leau#sort:barriere-deau';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V59:BB61' WHERE sort_id = 'magies/magie-de-leau#sort:barriere-deau';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:ruisseau-conciliant', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › V62:BB64');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V62:BB64' WHERE sort_id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › V62:BB64' WHERE sort_id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E70:AK72' WHERE sort_id = 'magies/magie-de-leau#sort:trombe-deau';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E70:AK72' WHERE sort_id = 'magies/magie-de-leau#sort:trombe-deau';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E70:AK72' WHERE sort_id = 'magies/magie-de-leau#sort:trombe-deau';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E70:AK72' WHERE sort_id = 'magies/magie-de-leau#sort:trombe-deau';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:lame-sous-pression';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:lame-sous-pression';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:lame-sous-pression', 'zone', 1, 'palier', 'ou verticales/3NM', '3 cases horizontales devant (ou verticales/3NM)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Eau › E73:AK75');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E73:AK75' WHERE sort_id = 'magies/magie-de-leau#sort:lame-sous-pression';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E73:AK75' WHERE sort_id = 'magies/magie-de-leau#sort:lame-sous-pression';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E76:AK78' WHERE sort_id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E76:AK78' WHERE sort_id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E76:AK78' WHERE sort_id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E76:AK78' WHERE sort_id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E79:AK81' WHERE sort_id = 'magies/magie-de-leau#sort:courant-salvateur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E79:AK81' WHERE sort_id = 'magies/magie-de-leau#sort:courant-salvateur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E79:AK81' WHERE sort_id = 'magies/magie-de-leau#sort:courant-salvateur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E79:AK81' WHERE sort_id = 'magies/magie-de-leau#sort:courant-salvateur';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:fouet-deau';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:fouet-deau';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:fouet-deau', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E82:AK84');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E82:AK84' WHERE sort_id = 'magies/magie-de-leau#sort:fouet-deau';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E82:AK84' WHERE sort_id = 'magies/magie-de-leau#sort:fouet-deau';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E85:AK87' WHERE sort_id = 'magies/magie-de-leau#sort:grenade-incapacitante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E85:AK87' WHERE sort_id = 'magies/magie-de-leau#sort:grenade-incapacitante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E85:AK87' WHERE sort_id = 'magies/magie-de-leau#sort:grenade-incapacitante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › E85:AK87' WHERE sort_id = 'magies/magie-de-leau#sort:grenade-incapacitante';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:eau-parfaite';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:eau-parfaite';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-parfaite', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM79:BS81');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM79:BS81' WHERE sort_id = 'magies/magie-de-leau#sort:eau-parfaite';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM79:BS81' WHERE sort_id = 'magies/magie-de-leau#sort:eau-parfaite';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-leau#sort:laser-hydraulique';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-leau#sort:laser-hydraulique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:laser-hydraulique';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:laser-hydraulique';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:laser-hydraulique', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Eau › AM82:BS84');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:laser-hydraulique', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM82:BS84');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:dissolution';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:dissolution', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM85:BS87');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM85:BS87' WHERE sort_id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM85:BS87' WHERE sort_id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM85:BS87' WHERE sort_id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM88:BS90' WHERE sort_id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM88:BS90' WHERE sort_id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM88:BS90' WHERE sort_id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM88:BS90' WHERE sort_id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM91:BS93' WHERE sort_id = 'magies/magie-de-leau#sort:cascade-apaisante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM91:BS93' WHERE sort_id = 'magies/magie-de-leau#sort:cascade-apaisante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM91:BS93' WHERE sort_id = 'magies/magie-de-leau#sort:cascade-apaisante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM91:BS93' WHERE sort_id = 'magies/magie-de-leau#sort:cascade-apaisante';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-leau#sort:larmes-doceane';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-leau#sort:larmes-doceane';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:larmes-doceane', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM94:BS96');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM94:BS96' WHERE sort_id = 'magies/magie-de-leau#sort:larmes-doceane';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM94:BS96' WHERE sort_id = 'magies/magie-de-leau#sort:larmes-doceane';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM97:BS99' WHERE sort_id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM97:BS99' WHERE sort_id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM97:BS99' WHERE sort_id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AM97:BS99' WHERE sort_id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V39:BB41' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V39:BB41' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V39:BB41' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V39:BB41' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V42:BB44' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V42:BB44' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V42:BB44' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V42:BB44' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V45:BB47' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V45:BB47' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V45:BB47' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V45:BB47' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V48:BB50' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V48:BB50' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V48:BB50' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V48:BB50' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V51:BB53' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V51:BB53' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V51:BB53' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V51:BB53' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V54:BB56' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V54:BB56' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V54:BB56' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V54:BB56' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:ralentissement';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lespace-temps#sort:ralentissement';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ralentissement', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V60:BB62' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:ralentissement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V60:BB62' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:ralentissement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V63:BB65' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V63:BB65' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V63:BB65' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V63:BB65' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:inversion';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:frappe-temporelle', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:frappe-temporelle', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › V66:BB68' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E80:AK82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E80:AK82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E80:AK82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E80:AK82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E89:AK91' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E89:AK91' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E89:AK91' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E89:AK91' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E95:AK97' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E95:AK97' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E95:AK97' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E95:AK97' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:trou-noir';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lespace-temps#sort:trou-noir';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:trou-noir', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E98:AK100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E98:AK100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:trou-noir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E98:AK100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:trou-noir';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:distorsion';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lespace-temps#sort:distorsion';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:distorsion', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E101:AK103');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E101:AK103' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:distorsion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › E101:AK103' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:distorsion';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:etat-anterieur', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM74:BS76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM74:BS76' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM74:BS76' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM77:BS79' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM77:BS79' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM77:BS79' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM77:BS79' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM80:BS82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM80:BS82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM80:BS82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM80:BS82' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM83:BS85' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM83:BS85' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM83:BS85' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM83:BS85' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:celerite';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lespace-temps#sort:celerite';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:celerite', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM86:BS88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM86:BS88' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:celerite';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM86:BS88' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:celerite';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:teleport-parfait', 'portee', 1, 'par_nm', '+20/NM', '+20/NM', '+20', 20, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM92:BS94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM92:BS94' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM92:BS94' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM92:BS94' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM98:BS100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM98:BS100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM98:BS100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AM98:BS100' WHERE sort_id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V36:BB38' WHERE sort_id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V36:BB38' WHERE sort_id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V36:BB38' WHERE sort_id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V36:BB38' WHERE sort_id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V39:BB41' WHERE sort_id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V39:BB41' WHERE sort_id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V39:BB41' WHERE sort_id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V39:BB41' WHERE sort_id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V42:BB44' WHERE sort_id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V42:BB44' WHERE sort_id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V42:BB44' WHERE sort_id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V42:BB44' WHERE sort_id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V45:BB47' WHERE sort_id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V45:BB47' WHERE sort_id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V45:BB47' WHERE sort_id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V45:BB47' WHERE sort_id = 'magies/magie-de-lombre#sort:brume-mental';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:pichenette';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:pichenette';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:pichenette', 'dsb', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › V48:BB50');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V48:BB50' WHERE sort_id = 'magies/magie-de-lombre#sort:pichenette';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V48:BB50' WHERE sort_id = 'magies/magie-de-lombre#sort:pichenette';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V51:BB53' WHERE sort_id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V51:BB53' WHERE sort_id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V51:BB53' WHERE sort_id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V51:BB53' WHERE sort_id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V54:BB56' WHERE sort_id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V54:BB56' WHERE sort_id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V54:BB56' WHERE sort_id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V54:BB56' WHERE sort_id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V57:BB59' WHERE sort_id = 'magies/magie-de-lombre#sort:lame-dombre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V57:BB59' WHERE sort_id = 'magies/magie-de-lombre#sort:lame-dombre';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V57:BB59' WHERE sort_id = 'magies/magie-de-lombre#sort:lame-dombre';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V57:BB59' WHERE sort_id = 'magies/magie-de-lombre#sort:lame-dombre';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:malediction';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:malediction';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:malediction', 'effets', 1, 'par_nm', '+1/NM', 'Diminue les dégâts pendant 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › V60:BB62');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V60:BB62' WHERE sort_id = 'magies/magie-de-lombre#sort:malediction';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V60:BB62' WHERE sort_id = 'magies/magie-de-lombre#sort:malediction';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V63:BB65' WHERE sort_id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V63:BB65' WHERE sort_id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V63:BB65' WHERE sort_id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › V63:BB65' WHERE sort_id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E71:AK73' WHERE sort_id = 'magies/magie-de-lombre#sort:brouillard-obscur';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E71:AK73' WHERE sort_id = 'magies/magie-de-lombre#sort:brouillard-obscur';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E71:AK73' WHERE sort_id = 'magies/magie-de-lombre#sort:brouillard-obscur';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E71:AK73' WHERE sort_id = 'magies/magie-de-lombre#sort:brouillard-obscur';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:amplification-sombre';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:amplification-sombre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:amplification-sombre', 'type', 1, 'palier', 'IC x 2 si 3NM', 'IC x 2 si 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E77:AK79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E77:AK79' WHERE sort_id = 'magies/magie-de-lombre#sort:amplification-sombre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E77:AK79' WHERE sort_id = 'magies/magie-de-lombre#sort:amplification-sombre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E80:AK82' WHERE sort_id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E80:AK82' WHERE sort_id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E80:AK82' WHERE sort_id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E80:AK82' WHERE sort_id = 'magies/magie-de-lombre#sort:marque-suintante';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-de-lombre#sort:rayon-negatif';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-de-lombre#sort:rayon-negatif';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:rayon-negatif';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:rayon-negatif';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E83:AK85');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E83:AK85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E83:AK85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E83:AK85');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 'guide/liste-des-alterations-d-etat#etat:peur', 'inflige', 1, 1, 'effets', 'Peur', 'Fermeté raté = Inflige Peur 1', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E83:AK85');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E86:AK88' WHERE sort_id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E86:AK88' WHERE sort_id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E86:AK88' WHERE sort_id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E86:AK88' WHERE sort_id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E89:AK91' WHERE sort_id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E89:AK91' WHERE sort_id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E89:AK91' WHERE sort_id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E89:AK91' WHERE sort_id = 'magies/magie-de-lombre#sort:defaite-annoncee';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:goudron';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:goudron';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:goudron', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E92:AK94');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:goudron', 'guide/liste-des-alterations-d-etat#etat:peur', 'inflige', 1, 2, 'effets', 'Peur', 'Fermeté réussi = Inflige Peur 2', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E92:AK94');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:goudron', 'guide/liste-des-alterations-d-etat#etat:peur', 'inflige', 2, 3, 'effets', 'Peur', 'Fermeté raté = Inflige Peur 3', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E92:AK94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E92:AK94' WHERE sort_id = 'magies/magie-de-lombre#sort:goudron';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E92:AK94' WHERE sort_id = 'magies/magie-de-lombre#sort:goudron';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E95:AK97' WHERE sort_id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E95:AK97' WHERE sort_id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E95:AK97' WHERE sort_id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E95:AK97' WHERE sort_id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:frappe-negative';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:frappe-negative';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:frappe-negative', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E98:AK100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E98:AK100' WHERE sort_id = 'magies/magie-de-lombre#sort:frappe-negative';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › E98:AK100' WHERE sort_id = 'magies/magie-de-lombre#sort:frappe-negative';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM80:BS82' WHERE sort_id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM80:BS82' WHERE sort_id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM80:BS82' WHERE sort_id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM80:BS82' WHERE sort_id = 'magies/magie-de-lombre#sort:ombre-menacante';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:pire-ami';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:pire-ami';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:pire-ami', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM92:BS94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM92:BS94' WHERE sort_id = 'magies/magie-de-lombre#sort:pire-ami';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM92:BS94' WHERE sort_id = 'magies/magie-de-lombre#sort:pire-ami';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-de-lombre#sort:armee-de-lombre';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-de-lombre#sort:armee-de-lombre';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:armee-de-lombre', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM95:BS97');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:armee-de-lombre', 'effets', 1, 'palier', 'à 3NM', 'Ignore la défense partielle à 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM95:BS97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM95:BS97' WHERE sort_id = 'magies/magie-de-lombre#sort:armee-de-lombre';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AM95:BS97' WHERE sort_id = 'magies/magie-de-lombre#sort:armee-de-lombre';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V36:BB38' WHERE sort_id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V36:BB38' WHERE sort_id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V36:BB38' WHERE sort_id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V36:BB38' WHERE sort_id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V39:BB41' WHERE sort_id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V39:BB41' WHERE sort_id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V39:BB41' WHERE sort_id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V39:BB41' WHERE sort_id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V42:BB44' WHERE sort_id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V42:BB44' WHERE sort_id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V42:BB44' WHERE sort_id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V42:BB44' WHERE sort_id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V45:BB47' WHERE sort_id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V45:BB47' WHERE sort_id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V45:BB47' WHERE sort_id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V45:BB47' WHERE sort_id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V48:BB50' WHERE sort_id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V48:BB50' WHERE sort_id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V48:BB50' WHERE sort_id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V48:BB50' WHERE sort_id = 'magies/magie-du-feu#sort:braise-magique';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-feu#sort:fer-brulant';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:fer-brulant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Feu › V51:BB53');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V51:BB53' WHERE sort_id = 'magies/magie-du-feu#sort:fer-brulant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V51:BB53' WHERE sort_id = 'magies/magie-du-feu#sort:fer-brulant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V51:BB53' WHERE sort_id = 'magies/magie-du-feu#sort:fer-brulant';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-feu#sort:etincelle';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-feu#sort:etincelle';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:etincelle', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › V54:BB56');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:etincelle', 'effets', 1, 'palier', 'au Niveau 3 de Maîtrise', 'Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Feu › V54:BB56');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V54:BB56' WHERE sort_id = 'magies/magie-du-feu#sort:etincelle';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V54:BB56' WHERE sort_id = 'magies/magie-du-feu#sort:etincelle';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V57:BB59' WHERE sort_id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V57:BB59' WHERE sort_id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V57:BB59' WHERE sort_id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V57:BB59' WHERE sort_id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V60:BB62' WHERE sort_id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V60:BB62' WHERE sort_id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V60:BB62' WHERE sort_id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V60:BB62' WHERE sort_id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V63:BB65' WHERE sort_id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V63:BB65' WHERE sort_id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V63:BB65' WHERE sort_id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › V63:BB65' WHERE sort_id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E71:AK73' WHERE sort_id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E71:AK73' WHERE sort_id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E71:AK73' WHERE sort_id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E71:AK73' WHERE sort_id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E74:AK76' WHERE sort_id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E74:AK76' WHERE sort_id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E74:AK76' WHERE sort_id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E74:AK76' WHERE sort_id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E77:AK79' WHERE sort_id = 'magies/magie-du-feu#sort:marcheur-exalte';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E77:AK79' WHERE sort_id = 'magies/magie-du-feu#sort:marcheur-exalte';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E77:AK79' WHERE sort_id = 'magies/magie-du-feu#sort:marcheur-exalte';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E77:AK79' WHERE sort_id = 'magies/magie-du-feu#sort:marcheur-exalte';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-du-feu#sort:mur-de-flammes';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-du-feu#sort:mur-de-flammes';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-feu#sort:mur-de-flammes';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-feu#sort:mur-de-flammes';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:mur-de-flammes', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Feu › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:mur-de-flammes', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › E80:AK82');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E83:AK85' WHERE sort_id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E83:AK85' WHERE sort_id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E83:AK85' WHERE sort_id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E83:AK85' WHERE sort_id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E86:AK88' WHERE sort_id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E86:AK88' WHERE sort_id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E86:AK88' WHERE sort_id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E86:AK88' WHERE sort_id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E89:AK91' WHERE sort_id = 'magies/magie-du-feu#sort:zenith';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E89:AK91' WHERE sort_id = 'magies/magie-du-feu#sort:zenith';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E89:AK91' WHERE sort_id = 'magies/magie-du-feu#sort:zenith';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E89:AK91' WHERE sort_id = 'magies/magie-du-feu#sort:zenith';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-feu#sort:bucher-purifiant';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-feu#sort:bucher-purifiant';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bucher-purifiant', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › E95:AK97');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bucher-purifiant', 'guide/liste-des-alterations-d-etat#etat:brulure', 'inflige', 1, 2, 'effets', 'brûlure', 'Si jet de vigueur raté = Inflige brûlure 2.', 'magies', 'Nouveauté mise à jour Décembre › Feu › E95:AK97');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E95:AK97' WHERE sort_id = 'magies/magie-du-feu#sort:bucher-purifiant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › E95:AK97' WHERE sort_id = 'magies/magie-du-feu#sort:bucher-purifiant';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-feu#sort:combustion-forte';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-feu#sort:combustion-forte';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:combustion-forte', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM92:BS94');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-feu#sort:combustion-forte', 'guide/liste-des-alterations-d-etat#etat:brulure', 'inflige', 1, 3, 'effets', 'brûlure', 'Permet d''infliger brûlure 3 aux immunisés et de brûler ce qui ne peut l''être.', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM92:BS94');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AM92:BS94' WHERE sort_id = 'magies/magie-du-feu#sort:combustion-forte';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AM92:BS94' WHERE sort_id = 'magies/magie-du-feu#sort:combustion-forte';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V40:BB42' WHERE sort_id = 'magies/magie-du-sang#sort:boule-de-sang';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V40:BB42' WHERE sort_id = 'magies/magie-du-sang#sort:boule-de-sang';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V40:BB42' WHERE sort_id = 'magies/magie-du-sang#sort:boule-de-sang';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V40:BB42' WHERE sort_id = 'magies/magie-du-sang#sort:boule-de-sang';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:clou';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:clou';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:clou', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › V43:BB45');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-sang#sort:clou', 'guide/liste-des-alterations-d-etat#etat:saignement', 'inflige', 1, 1, 'effets', 'Saignement', 'Si jet de vigueur raté = Inflige Saignement 1.', 'magies', 'Nouveauté mise à jour Décembre › Sang › V43:BB45');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V43:BB45' WHERE sort_id = 'magies/magie-du-sang#sort:clou';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V43:BB45' WHERE sort_id = 'magies/magie-du-sang#sort:clou';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:marquage';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:marquage';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › V46:BB48');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V46:BB48' WHERE sort_id = 'magies/magie-du-sang#sort:marquage';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V46:BB48' WHERE sort_id = 'magies/magie-du-sang#sort:marquage';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:annulation';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:annulation', 'effets', 1, 'palier', '3NM = que négatif pour allié, que positif pour ennemi', '3NM = que négatif pour allié, que positif pour ennemi', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › V49:BB51');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V49:BB51' WHERE sort_id = 'magies/magie-du-sang#sort:annulation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V49:BB51' WHERE sort_id = 'magies/magie-du-sang#sort:annulation';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V49:BB51' WHERE sort_id = 'magies/magie-du-sang#sort:annulation';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V52:BB54' WHERE sort_id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V52:BB54' WHERE sort_id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V52:BB54' WHERE sort_id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V52:BB54' WHERE sort_id = 'magies/magie-du-sang#sort:attirance';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:sang-durci';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:sang-durci';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-durci', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › V55:BB57');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V55:BB57' WHERE sort_id = 'magies/magie-du-sang#sort:sang-durci';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V55:BB57' WHERE sort_id = 'magies/magie-du-sang#sort:sang-durci';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V58:BB60' WHERE sort_id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V58:BB60' WHERE sort_id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V58:BB60' WHERE sort_id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V58:BB60' WHERE sort_id = 'magies/magie-du-sang#sort:fer-sanglant';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:sang-garde';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:sang-garde';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-garde', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › V61:BB63');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V61:BB63' WHERE sort_id = 'magies/magie-du-sang#sort:sang-garde';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V61:BB63' WHERE sort_id = 'magies/magie-du-sang#sort:sang-garde';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:sang-gain';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:sang-gain';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-gain', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › V67:BB69');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V67:BB69' WHERE sort_id = 'magies/magie-du-sang#sort:sang-gain';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › V67:BB69' WHERE sort_id = 'magies/magie-du-sang#sort:sang-gain';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E75:AK77' WHERE sort_id = 'magies/magie-du-sang#sort:saignee-forcee';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E75:AK77' WHERE sort_id = 'magies/magie-du-sang#sort:saignee-forcee';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E75:AK77' WHERE sort_id = 'magies/magie-du-sang#sort:saignee-forcee';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E75:AK77' WHERE sort_id = 'magies/magie-du-sang#sort:saignee-forcee';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:deflagration-sanguine';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:deflagration-sanguine';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:deflagration-sanguine', 'dsb', 1, 'par_nm', 'x4/3NM', 'x4/3NM', 'x4', NULL, 3, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E84:AK86');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E84:AK86' WHERE sort_id = 'magies/magie-du-sang#sort:deflagration-sanguine';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E84:AK86' WHERE sort_id = 'magies/magie-du-sang#sort:deflagration-sanguine';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E87:AK89' WHERE sort_id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E87:AK89' WHERE sort_id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E87:AK89' WHERE sort_id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E87:AK89' WHERE sort_id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E90:AK92' WHERE sort_id = 'magies/magie-du-sang#sort:grenade-a-clous';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E90:AK92' WHERE sort_id = 'magies/magie-du-sang#sort:grenade-a-clous';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E90:AK92' WHERE sort_id = 'magies/magie-du-sang#sort:grenade-a-clous';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E90:AK92' WHERE sort_id = 'magies/magie-du-sang#sort:grenade-a-clous';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:sang-perfection';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:sang-perfection';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-perfection', 'effets', 1, 'par_nm', '+1/NM', '+15 dégâts, +5AP, +5AM, +2 Vitesse dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E99:AK101');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E99:AK101' WHERE sort_id = 'magies/magie-du-sang#sort:sang-perfection';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › E99:AK101' WHERE sort_id = 'magies/magie-du-sang#sort:sang-perfection';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM78:BS80' WHERE sort_id = 'magies/magie-du-sang#sort:morsure-aspirante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM78:BS80' WHERE sort_id = 'magies/magie-du-sang#sort:morsure-aspirante';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM78:BS80' WHERE sort_id = 'magies/magie-du-sang#sort:morsure-aspirante';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM78:BS80' WHERE sort_id = 'magies/magie-du-sang#sort:morsure-aspirante';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-du-sang#sort:coagulation';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-du-sang#sort:coagulation';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:coagulation';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:coagulation';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:coagulation', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM81:BS83');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:coagulation', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM81:BS83');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM84:BS86' WHERE sort_id = 'magies/magie-du-sang#sort:renfermement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM84:BS86' WHERE sort_id = 'magies/magie-du-sang#sort:renfermement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM84:BS86' WHERE sort_id = 'magies/magie-du-sang#sort:renfermement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM84:BS86' WHERE sort_id = 'magies/magie-du-sang#sort:renfermement';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:douleur-partagee';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:douleur-partagee';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:douleur-partagee', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM90:BS92');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM90:BS92' WHERE sort_id = 'magies/magie-du-sang#sort:douleur-partagee';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM90:BS92' WHERE sort_id = 'magies/magie-du-sang#sort:douleur-partagee';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM96:BS98' WHERE sort_id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM96:BS98' WHERE sort_id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM96:BS98' WHERE sort_id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM96:BS98' WHERE sort_id = 'magies/magie-du-sang#sort:perfusion';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:proportion-demesuree';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:proportion-demesuree';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:proportion-demesuree', 'effets', 1, 'par_nm', '+5/NM', 'Augmente la taille d''un cran, +1 Force, +20 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours', '+5', 5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM99:BS101');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-sang#sort:proportion-demesuree', 'guide/liste-des-alterations-d-etat#etat:fatigue', 'prend', 1, 1, 'effets', 'fatigue', 'Jet de vigueur à la fin pour ne pas prendre fatigue 1.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM99:BS101');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM99:BS101' WHERE sort_id = 'magies/magie-du-sang#sort:proportion-demesuree';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM99:BS101' WHERE sort_id = 'magies/magie-du-sang#sort:proportion-demesuree';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-sang#sort:sacrifice';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-sang#sort:sacrifice';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sacrifice', 'effets', 1, 'palier', 'à 3NM', 'Garde 1 santé à 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM102:BS104');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM102:BS104' WHERE sort_id = 'magies/magie-du-sang#sort:sacrifice';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AM102:BS104' WHERE sort_id = 'magies/magie-du-sang#sort:sacrifice';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V36:BB38' WHERE sort_id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V36:BB38' WHERE sort_id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V36:BB38' WHERE sort_id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V36:BB38' WHERE sort_id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V39:BB41' WHERE sort_id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V39:BB41' WHERE sort_id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V39:BB41' WHERE sort_id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V39:BB41' WHERE sort_id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V42:BB44' WHERE sort_id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V42:BB44' WHERE sort_id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V42:BB44' WHERE sort_id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V42:BB44' WHERE sort_id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V45:BB47' WHERE sort_id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V45:BB47' WHERE sort_id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V45:BB47' WHERE sort_id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V45:BB47' WHERE sort_id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V48:BB50' WHERE sort_id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V48:BB50' WHERE sort_id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V48:BB50' WHERE sort_id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V48:BB50' WHERE sort_id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V51:BB53' WHERE sort_id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V51:BB53' WHERE sort_id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V51:BB53' WHERE sort_id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V51:BB53' WHERE sort_id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V54:BB56' WHERE sort_id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V54:BB56' WHERE sort_id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V54:BB56' WHERE sort_id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V54:BB56' WHERE sort_id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V57:BB59' WHERE sort_id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V57:BB59' WHERE sort_id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V57:BB59' WHERE sort_id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V57:BB59' WHERE sort_id = 'magies/magie-du-vent#sort:fer-eolien';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-du-vent#sort:feuille-morte';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-du-vent#sort:feuille-morte';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:feuille-morte';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:feuille-morte';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:feuille-morte', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Vent › V60:BB62');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:feuille-morte', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › V60:BB62');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:feuille-morte', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › V60:BB62');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:recul-force';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:recul-force';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:recul-force', 'effets', 1, 'par_nm', '+1/NM', 'Fait reculer la cible de 1 case (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › V63:BB65');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:recul-force', 'remarque', 1, 'texte', 'Sans NM dedans, le sort ne peut pas reculé une cible grande', 'Sans NM dedans, le sort ne peut pas reculé une cible grande', NULL, NULL, NULL, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › V63:BB65');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V63:BB65' WHERE sort_id = 'magies/magie-du-vent#sort:recul-force';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › V63:BB65' WHERE sort_id = 'magies/magie-du-vent#sort:recul-force';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-du-vent#sort:tornade';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-du-vent#sort:tornade';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:tornade';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:tornade';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vent › E71:AK73');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E71:AK73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E71:AK73');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E74:AK76' WHERE sort_id = 'magies/magie-du-vent#sort:bourrasque';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E74:AK76' WHERE sort_id = 'magies/magie-du-vent#sort:bourrasque';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E74:AK76' WHERE sort_id = 'magies/magie-du-vent#sort:bourrasque';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E74:AK76' WHERE sort_id = 'magies/magie-du-vent#sort:bourrasque';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:desarmer';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:desarmer';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:desarmer', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E77:AK79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E77:AK79' WHERE sort_id = 'magies/magie-du-vent#sort:desarmer';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E77:AK79' WHERE sort_id = 'magies/magie-du-vent#sort:desarmer';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E80:AK82' WHERE sort_id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E80:AK82' WHERE sort_id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E80:AK82' WHERE sort_id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E80:AK82' WHERE sort_id = 'magies/magie-du-vent#sort:vent-changeant';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:allegement';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:allegement';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:allegement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vent › E89:AK91');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E89:AK91' WHERE sort_id = 'magies/magie-du-vent#sort:allegement';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E89:AK91' WHERE sort_id = 'magies/magie-du-vent#sort:allegement';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E92:AK94' WHERE sort_id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E92:AK94' WHERE sort_id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E92:AK94' WHERE sort_id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E92:AK94' WHERE sort_id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E95:AK97' WHERE sort_id = 'magies/magie-du-vent#sort:danse-de-lair';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E95:AK97' WHERE sort_id = 'magies/magie-du-vent#sort:danse-de-lair';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E95:AK97' WHERE sort_id = 'magies/magie-du-vent#sort:danse-de-lair';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E95:AK97' WHERE sort_id = 'magies/magie-du-vent#sort:danse-de-lair';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:explosif';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:explosif';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:explosif', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E98:AK100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E98:AK100' WHERE sort_id = 'magies/magie-du-vent#sort:explosif';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › E98:AK100' WHERE sort_id = 'magies/magie-du-vent#sort:explosif';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:estoc-hurlante';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:estoc-hurlante';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:estoc-hurlante', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM71:BS73');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM71:BS73' WHERE sort_id = 'magies/magie-du-vent#sort:estoc-hurlante';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM71:BS73' WHERE sort_id = 'magies/magie-du-vent#sort:estoc-hurlante';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM83:BS85' WHERE sort_id = 'magies/magie-du-vent#sort:grenade-explosive';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM83:BS85' WHERE sort_id = 'magies/magie-du-vent#sort:grenade-explosive';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM83:BS85' WHERE sort_id = 'magies/magie-du-vent#sort:grenade-explosive';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM83:BS85' WHERE sort_id = 'magies/magie-du-vent#sort:grenade-explosive';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:vibration';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:vibration';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vibration', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM86:BS88');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vibration', 'guide/liste-des-alterations-d-etat#etat:surdite', 'inflige', 1, 2, 'effets', 'surdité', 'Incante une vibration insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité/réflexe raté = Tombe par terre.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM86:BS88');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM86:BS88' WHERE sort_id = 'magies/magie-du-vent#sort:vibration';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM86:BS88' WHERE sort_id = 'magies/magie-du-vent#sort:vibration';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vent#sort:megaphone';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vent#sort:megaphone';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:megaphone', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM98:BS100');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-vent#sort:megaphone', 'guide/liste-des-alterations-d-etat#etat:surdite', 'inflige', 1, 3, 'effets', 'surdité', 'Si jet de vigueur raté = Inflige surdité niveau 3.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM98:BS100');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM98:BS100' WHERE sort_id = 'magies/magie-du-vent#sort:megaphone';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AM98:BS100' WHERE sort_id = 'magies/magie-du-vent#sort:megaphone';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V39:BB41' WHERE sort_id = 'magies/magie-du-vide#sort:bulle-de-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V39:BB41' WHERE sort_id = 'magies/magie-du-vide#sort:bulle-de-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V39:BB41' WHERE sort_id = 'magies/magie-du-vide#sort:bulle-de-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V39:BB41' WHERE sort_id = 'magies/magie-du-vide#sort:bulle-de-vide';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:telekinesie';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:telekinesie', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › V42:BB44');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:telekinesie', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', 'Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › V42:BB44');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V42:BB44' WHERE sort_id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V42:BB44' WHERE sort_id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V42:BB44' WHERE sort_id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V45:BB47' WHERE sort_id = 'magies/magie-du-vide#sort:silence';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V45:BB47' WHERE sort_id = 'magies/magie-du-vide#sort:silence';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V45:BB47' WHERE sort_id = 'magies/magie-du-vide#sort:silence';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V45:BB47' WHERE sort_id = 'magies/magie-du-vide#sort:silence';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:pression';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:pression';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:pression', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › V48:BB50');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V48:BB50' WHERE sort_id = 'magies/magie-du-vide#sort:pression';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V48:BB50' WHERE sort_id = 'magies/magie-du-vide#sort:pression';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:injonction-du-vide';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:injonction-du-vide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:injonction-du-vide', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › V51:BB53');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V51:BB53' WHERE sort_id = 'magies/magie-du-vide#sort:injonction-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V51:BB53' WHERE sort_id = 'magies/magie-du-vide#sort:injonction-du-vide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V54:BB56' WHERE sort_id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V54:BB56' WHERE sort_id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V54:BB56' WHERE sort_id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V54:BB56' WHERE sort_id = 'magies/magie-du-vide#sort:fer-vide';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:bisou-du-vide';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:bisou-du-vide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:bisou-du-vide', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › V57:BB59');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-vide#sort:bisou-du-vide', 'guide/liste-des-alterations-d-etat#etat:enrage', 'inflige', 1, 1, 'effets', 'enragé', 'Inflige "enragé 1" à la cible.', 'magies', 'Nouveauté mise à jour Décembre › Vide › V57:BB59');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V57:BB59' WHERE sort_id = 'magies/magie-du-vide#sort:bisou-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V57:BB59' WHERE sort_id = 'magies/magie-du-vide#sort:bisou-du-vide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V60:BB62' WHERE sort_id = 'magies/magie-du-vide#sort:poing-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V60:BB62' WHERE sort_id = 'magies/magie-du-vide#sort:poing-du-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V60:BB62' WHERE sort_id = 'magies/magie-du-vide#sort:poing-du-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V60:BB62' WHERE sort_id = 'magies/magie-du-vide#sort:poing-du-vide';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:lien-mental';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:lien-mental';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:lien-mental', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › V63:BB65');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V63:BB65' WHERE sort_id = 'magies/magie-du-vide#sort:lien-mental';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V63:BB65' WHERE sort_id = 'magies/magie-du-vide#sort:lien-mental';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:dissipation';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:dissipation', 'effets', 1, 'palier', 'pour 3NM', 'Un allié perd le négatif et un ennemi le positif pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › V66:BB68');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V66:BB68' WHERE sort_id = 'magies/magie-du-vide#sort:dissipation';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V66:BB68' WHERE sort_id = 'magies/magie-du-vide#sort:dissipation';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › V66:BB68' WHERE sort_id = 'magies/magie-du-vide#sort:dissipation';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:aspect-vide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:aspect-vide', 'effets', 1, 'par_nm', '+1/NM', 'Rend le lanceur intangible pour une attaque (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E74:AK76');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E74:AK76' WHERE sort_id = 'magies/magie-du-vide#sort:aspect-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E74:AK76' WHERE sort_id = 'magies/magie-du-vide#sort:aspect-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E74:AK76' WHERE sort_id = 'magies/magie-du-vide#sort:aspect-vide';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:invisibilite';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:invisibilite';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:invisibilite', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E77:AK79');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E77:AK79' WHERE sort_id = 'magies/magie-du-vide#sort:invisibilite';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E77:AK79' WHERE sort_id = 'magies/magie-du-vide#sort:invisibilite';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:lame-du-vide';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:lame-du-vide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:lame-du-vide', 'effets', 1, 'palier', 'pour 3NM', 'Ignore la BA pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › E80:AK82');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E80:AK82' WHERE sort_id = 'magies/magie-du-vide#sort:lame-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E80:AK82' WHERE sort_id = 'magies/magie-du-vide#sort:lame-du-vide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E83:AK85' WHERE sort_id = 'magies/magie-du-vide#sort:touche-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E83:AK85' WHERE sort_id = 'magies/magie-du-vide#sort:touche-du-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E83:AK85' WHERE sort_id = 'magies/magie-du-vide#sort:touche-du-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E83:AK85' WHERE sort_id = 'magies/magie-du-vide#sort:touche-du-vide';
DELETE FROM sort_type WHERE sort_id = 'magies/magie-du-vide#sort:grenade-implosive';
DELETE FROM sort_mode WHERE sort_id = 'magies/magie-du-vide#sort:grenade-implosive';
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:grenade-implosive';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:grenade-implosive';
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:grenade-implosive', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › E89:AK91');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:grenade-implosive', 2, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Vide › E89:AK91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:grenade-implosive', 'effets', 1, 'par_nm', '+1/NM', 'attire de 1 case (+1/NM) les victimes', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E89:AK91');
DELETE FROM sort_bonus_maitrise WHERE sort_id = 'magies/magie-du-vide#sort:marteau-du-vide';
DELETE FROM sort_etat WHERE sort_id = 'magies/magie-du-vide#sort:marteau-du-vide';
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:marteau-du-vide', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E101:AK103');
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E101:AK103' WHERE sort_id = 'magies/magie-du-vide#sort:marteau-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › E101:AK103' WHERE sort_id = 'magies/magie-du-vide#sort:marteau-du-vide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM74:BS76' WHERE sort_id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM74:BS76' WHERE sort_id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM74:BS76' WHERE sort_id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM74:BS76' WHERE sort_id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM86:BS88' WHERE sort_id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM86:BS88' WHERE sort_id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM86:BS88' WHERE sort_id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM86:BS88' WHERE sort_id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort_type SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM95:BS97' WHERE sort_id = 'magies/magie-du-vide#sort:mot-du-vide';
UPDATE sort_mode SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM95:BS97' WHERE sort_id = 'magies/magie-du-vide#sort:mot-du-vide';
UPDATE sort_bonus_maitrise SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM95:BS97' WHERE sort_id = 'magies/magie-du-vide#sort:mot-du-vide';
UPDATE sort_etat SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AM95:BS97' WHERE sort_id = 'magies/magie-du-vide#sort:mot-du-vide';

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 5. Sorts nouveaux (R237 (2), (3), (5)) : 119, id '<magie>#sort:<nom_cle>' (Torrent colérique : nom corrigé, R10)
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:saturation', 'magies/magie-de-la-corruption', 'Saturation', 'saturation', 3, 14, 'Amplification  (IC pour 3NM)', 0, 3, 0, 0, '10', 10, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, '+1 dégât/ 5 CR', 'La cible augmente ses dégâts selon son taux de corruption, 1 dégât par 5 corruption. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E89:AK91', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-corruption#specialisation:petrole');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:saturation', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E89:AK91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:saturation', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E89:AK91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:saturation', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:pression-noire', 'magies/magie-de-la-corruption', 'Pression noire', 'pression-noire', 4, 15, 'Amplification  (IC pour 3NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '+3 dégâts/10% de corruption', 'Le bénéficiaire aura un bonus de dégâts si sa cible a de la corruption en elle. Dure 3 tours.
Si CR : Le bonus est de +5 dégâts', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E92:AK94', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-corruption#specialisation:petrole');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:pression-noire', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:pression-noire', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:pression-noire', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:desintegration', 'magies/magie-de-la-corruption', 'Désintégration', 'desintegration', 4, 17, 'Attaque', 0, NULL, 0, 0, '20', 20, NULL, NULL, '7', 'nombre', 7, '1', 'unique', 1, '40 dégâts', 'Double les dégâts contre les sorts "Construction" et les éléments du décor.
SI CR : +15 dégâts', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E98:AK100', NULL, NULL, NULL, NULL, 'magies/magie-de-la-corruption#specialisation:petrole');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:desintegration', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:desintegration', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:choc-pretrolier', 'magies/magie-de-la-corruption', 'Choc prétrolier', 'choc-pretrolier', 5, 20, 'Attaque', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '7', 'nombre', 7, '1', 'unique', 1, '10d6 + 70 dégâts', 'Inflige une terrible frappe de corruption sur la cible.
Si CR : Inflige +30 dégâts.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E107:AK109', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-la-corruption#specialisation:petrole');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:choc-pretrolier', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Corruption › E107:AK109');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:choc-pretrolier', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › E107:AK109');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:choc-pretrolier', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:crachat-pollue', 'magies/magie-de-la-corruption', 'Crachat pollué', 'crachat-pollue', 3, 21, 'Attaque', 0, NULL, 0, 0, '14', 14, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '6d6 + 12 dégâts (+3/NM)', 'Si CR : Inflige 10 Corruption', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM80:BS82', NULL, NULL, 'D/S/B : +3/NM', NULL, 'magies/magie-de-la-corruption#specialisation:bloqueur');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:crachat-pollue', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:crachat-pollue', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:crachat-pollue', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:blessure-poisseuse', 'magies/magie-de-la-corruption', 'Blessure poisseuse', 'blessure-poisseuse', 3, 22, 'Attaque/ Entrave', 0, NULL, 0, 0, '13', 13, NULL, NULL, '4', 'nombre', 4, '1', 'unique', 1, '6d6 + 15 dégâts', 'Si CR : Empêche la cible de perdre de la corruption pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM83:BS85', NULL, NULL, NULL, NULL, 'magies/magie-de-la-corruption#specialisation:bloqueur');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:blessure-poisseuse', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM83:BS85');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:blessure-poisseuse', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:blessure-poisseuse', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-corruption#sort:contre-sort', 'magies/magie-de-la-corruption', 'Contre-sort', 'contre-sort', 4, 25, 'Entrave
(Réaction)', 0, NULL, 0, 0, 'N/A', NULL, NULL, NULL, '6 (+2/NM)', 'nombre', 6, '1', 'unique', 1, NULL, 'La lanceur bloque un sort ennemi lvl 1-4 le faisant passer de réussite à échec. Le coût correspond au sort qui a été bloqué. (1 fois par tour)', NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM92:BS94', NULL, 'Réaction', 'Portée : +2/NM', 'Variable selon le sort bloqué', 'magies/magie-de-la-corruption#specialisation:bloqueur');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:contre-sort', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM92:BS94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:contre-sort', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Corruption › AM92:BS94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-corruption#sort:contre-sort', 'magies/magie-de-la-corruption', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:surcharge', 'magies/magie-de-la-foudre', 'Surcharge', 'surcharge', 3, 13, 'Amplification  (IC pour 3 NM)', 0, 3, 0, 0, '12', 12, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, NULL, 'Le prochain sort d''attaque de Foudre coûtera 50% plus chère mais fera 25% de dégâts finaux en plus.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E77:AK79', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, 'magies/magie-de-la-foudre#specialisation:plasma');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:surcharge', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E77:AK79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:surcharge', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E77:AK79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:surcharge', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:mur-hertz', 'magies/magie-de-la-foudre', 'Mur hertz', 'mur-hertz', 3, 14, 'Construction', 0, NULL, 0, 0, '12', 12, NULL, NULL, '3 (+1/NM)', 'nombre', 3, 'Ligne 9 cases', 'ligne', 9, '15 - 30 - 15', 'Ceux qui ne possèdent pas de résistance à la Foudre doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E80:AK82', NULL, NULL, 'Portée : +1/NM', NULL, 'magies/magie-de-la-foudre#specialisation:plasma');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:mur-hertz', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:mur-hertz', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E80:AK82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:mur-hertz', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:turbine', 'magies/magie-de-la-foudre', 'Turbine', 'turbine', 4, 18, 'Attaque/ Amplification (IC)', 1, NULL, 0, 0, '20', 20, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, '10 dégâts/CE|
+10 CK/CE', 'Gagne 1 CE à chaque sort de Foudre lancé. À 1 charge ou +, choix : récupère du CK, en donne à un allié ou inflige une attaque de 6PO ignorant l''AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E92:AK94', 'CE = Charge électrique
CK = Chakra

1 seule charge par tour.
3 charges maximum cumulable

Une fois la ou les charges libérées, il faut relancer le sort pour recommencer', 'IC', NULL, NULL, 'magies/magie-de-la-foudre#specialisation:plasma');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:turbine', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E92:AK94');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:turbine', 2, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E92:AK94');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:turbine', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:turbine', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:rayonnement', 'magies/magie-de-la-foudre', 'Rayonnement', 'rayonnement', 5, 20, 'Amplification/ Entrave', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, 'Soi même', 'soi', NULL, 'Cercle de 3', 'cercle', 3, '30 dégâts', 'Invoque une zone électrifié qui inflige des dégâts perce BA aux ennemis. Les alliés sont sous l''effet du sort "Chargeur" trois fois. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E98:AK100', 'BA = Barrière', NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-la-foudre#specialisation:plasma');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:rayonnement', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E98:AK100');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:rayonnement', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Foudre › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:rayonnement', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:rayonnement', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:magnerance', 'magies/magie-de-la-foudre', 'Magnérance', 'magnerance', 3, 21, 'Attaque/ Placement', 0, NULL, 0, 0, '14', 14, NULL, NULL, '7', 'nombre', 7, '1', 'unique', 1, '5d6 + 15 dégâts', 'Une attaque qui force le jet de stabilite/réflexe à la cible pour ne pas être déplacer de 1 case (+1/NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM71:BS73', NULL, NULL, 'Effets : Une attaque qui force le jet de stabilite/réflexe à la cible pour ne pas être déplacer de 1 case (+1/NM)', NULL, 'magies/magie-de-la-foudre#specialisation:magnetisme');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:magnerance', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM71:BS73');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:magnerance', 2, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM71:BS73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:magnerance', 'effets', 1, 'par_nm', '+1/NM', 'Une attaque qui force le jet de stabilite/réflexe à la cible pour ne pas être déplacer de 1 case (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM71:BS73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:magnerance', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:reflexion-de-volt', 'magies/magie-de-la-foudre', 'Réflexion de Volt', 'reflexion-de-volt', 4, 25, 'Météo', 0, NULL, 0, 0, '20', 20, NULL, NULL, 'Soi même', 'soi', NULL, 'Terrain', 'terrain', NULL, NULL, 'Invoque la météo "champ magnétique" pendant 3 tours (+1/NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM83:BS85', NULL, NULL, 'Effets : Invoque la météo "champ magnétique" pendant 3 tours (+1/NM)', NULL, 'magies/magie-de-la-foudre#specialisation:magnetisme');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:reflexion-de-volt', 1, 'meteo', 'Météo', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM83:BS85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:reflexion-de-volt', 'effets', 1, 'par_nm', '+1/NM', 'Invoque la météo "champ magnétique" pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:reflexion-de-volt', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:repulsion-reflexe', 'magies/magie-de-la-foudre', 'Répulsion réflexe', 'repulsion-reflexe', 4, 26, 'Amplification/ Placement (IC)', 1, NULL, 0, 0, '20', 20, NULL, NULL, '4', 'nombre', 4, '1', 'unique', 1, '+1 attaque d''opportunité/tour', 'Lorsqu''une attaque touche la cible, celle-ci repousse automatiquement son attaquant de 2 cases (1 case si la créature est grande). Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM86:BS88', 'Ne déclenche pas d''attaque d''opportunité sauf pour le bénéficiaire du sort.', 'IC', NULL, NULL, 'magies/magie-de-la-foudre#specialisation:magnetisme');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:repulsion-reflexe', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM86:BS88');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:repulsion-reflexe', 2, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM86:BS88');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:repulsion-reflexe', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:repulsion-reflexe', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-foudre#sort:magnetosphere', 'magies/magie-de-la-foudre', 'Magnétosphère', 'magnetosphere', 5, 30, 'Entrave', 0, NULL, 0, 0, '50 (-5/NM)', 50, NULL, NULL, 'Soi même', 'soi', NULL, 'Cercle de 9', 'cercle', 9, NULL, 'Désarme automatiquement les ennemis dans la zone. Leurs armes tombent au sol et ne peuvent être ramassées qu''à leur prochain tour.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM98:BS100', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-la-foudre#specialisation:magnetisme');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:magnetosphere', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM98:BS100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:magnetosphere', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Foudre › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-foudre#sort:magnetosphere', 'magies/magie-de-la-foudre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:flomentation', 'magies/magie-de-la-glace', 'Flomentation', 'flomentation', 3, 12, 'Attaque', 0, NULL, 0, 0, '16', 16, NULL, NULL, '3 (+2/NM)', 'nombre', 3, '1', 'unique', 1, '7d6 + 7 dégâts', 'Si bonne météo = À l''impact, le projectile se fragmente en plusieurs projectiles qui vont à gauche et droite de la cible. Leur dégâts est divisé par 2.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E74:AK76', NULL, NULL, 'Portée : +2/NM', NULL, 'magies/magie-de-la-glace#specialisation:neige');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:flomentation', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Glace › E74:AK76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:flomentation', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E74:AK76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:flomentation', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:sublimation', 'magies/magie-de-la-glace', 'Sublimation', 'sublimation', 3, 14, 'Amplification (IC pour 3NM)', 0, 3, 0, 0, '18', 18, NULL, NULL, '1', 'nombre', 1, 'Illimité', 'autre', NULL, '+2 dégâts/état de gel retiré', 'Les cibles doit souffrir d''un gel = Retire les états de gel des ennemis pour augmenter les dégâts pendant 4 tours.
Si bonne météo = +1 dégât en plus', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E80:AK82', 'Un état de gel est comme retirer "gel 1". Donc par extension, "gel 2" correspond à 2 états de gel, etc.', 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-glace#specialisation:neige');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:sublimation', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Glace › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:sublimation', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Glace › E80:AK82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:sublimation', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:froid-gemellaire', 'magies/magie-de-la-glace', 'Froid gémellaire', 'froid-gemellaire', 4, 15, 'Attaque', 0, NULL, 0, 0, '22', 22, NULL, NULL, '5', 'nombre', 5, '1', 'unique', 1, '4d6 dégâts (+4/NM) = à faire deux fois', 'Une attaque en deux temps qui oblige la cible à faire deux jets de défense.
Si bonne météo = Malus de 15% aux jets de défnese', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E83:AK85', NULL, NULL, 'D/S/B : +4/NM', NULL, 'magies/magie-de-la-glace#specialisation:neige');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:froid-gemellaire', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Glace › E83:AK85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:froid-gemellaire', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:froid-gemellaire', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:blancheur-aveuglante', 'magies/magie-de-la-glace', 'Blancheur aveuglante', 'blancheur-aveuglante', 4, 18, 'Amplification (IC pour 3NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '-15% de malus pour les ennemis', 'Entoure la cible d''une brume qui permet d''imposer un malus pour le toucher. Dure 3 tours.
Si bonne météo = Le malus est doublé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › E92:AK94', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-glace#specialisation:neige');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:blancheur-aveuglante', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Glace › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:blancheur-aveuglante', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Glace › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:blancheur-aveuglante', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:cristal-absorbant', 'magies/magie-de-la-glace', 'Cristal absorbant', 'cristal-absorbant', 3, 21, 'Amplification (IC pour 3NM)', 0, 3, 0, 0, '16', 16, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'Quand un sort est encaisser, le quart de son coüt en chakra est donner au receveur. Dure 4 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM71:BS73', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-glace#specialisation:cristal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cristal-absorbant', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Glace › AM71:BS73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cristal-absorbant', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM71:BS73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:cristal-absorbant', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:prisme-protecteur', 'magies/magie-de-la-glace', 'Prisme protecteur', 'prisme-protecteur', 4, 26, 'Protection', 0, NULL, 0, 0, '26 (-2/NM)', 26, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'Protége un allié pendant 2 tours maximum d''un coup magique qui peut mettre dans le coma. Si protége d''un coup fatal = Voir remarque*', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM86:BS88', '*Met à 1 de santé et +20AM pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-la-glace#specialisation:cristal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:prisme-protecteur', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Glace › AM86:BS88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:prisme-protecteur', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:prisme-protecteur', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-glace#sort:pole-absolu', 'magies/magie-de-la-glace', 'Pôle absolu', 'pole-absolu', 5, 30, 'Protection', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, NULL, 'Une fois lancé, tout sort entrant dans un cercle de 3 autour du lanceur est automatiquement attiré vers ce dernier et devient ciblé sur lui. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM98:BS100', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-la-glace#specialisation:cristal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:pole-absolu', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Glace › AM98:BS100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:pole-absolu', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Glace › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-glace#sort:pole-absolu', 'magies/magie-de-la-glace', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:juvabien', 'magies/magie-de-la-lumiere', 'Juvabien', 'juvabien', 1, 4, 'Amplification (IC)', 1, NULL, 0, 0, '5', 5, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'Permet d''infliger un bonus de +2 (+2/NM) dégâts pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V45:BB47', NULL, 'IC', 'Effets : Permet d''infliger un bonus de +2 (+2/NM) dégâts pendant 2 tours', NULL, NULL);
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:juvabien', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Lumière › V45:BB47');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:juvabien', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V45:BB47');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:juvabien', 'effets', 1, 'par_nm', '+2/NM', 'Permet d''infliger un bonus de +2 (+2/NM) dégâts pendant 2 tours', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › V45:BB47');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:juvabien', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:lame-prismatique', 'magies/magie-de-la-lumiere', 'Lame prismatique', 'lame-prismatique', 3, 12, 'Construction (IC pour 3 NM)', 0, 3, 0, 0, '12', 12, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, NULL, 'Permet de concentrer la puissance de la lumière pour créer une arme qui frappera avec un bonus de +10 dégâts. 1 seule utilisation (+1 par NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E74:AK76', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM
Effets : 1 seule utilisation (+1 par NM)', NULL, 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:lame-prismatique', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E74:AK76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:lame-prismatique', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E74:AK76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:lame-prismatique', 'effets', 1, 'par_nm', '+1 par NM', '1 seule utilisation (+1 par NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E74:AK76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:lame-prismatique', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:mur-gamma', 'magies/magie-de-la-lumiere', 'Mur gamma', 'mur-gamma', 3, 14, 'Construction', 0, NULL, 0, 0, '12', 12, NULL, NULL, '3 (+1/NM)', 'nombre', 3, 'Ligne 9 cases', 'ligne', 9, '15 - 30 - 15', 'Ceux qui ne possèdent pas de résistance à la Lumière doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E80:AK82', 'Les non-morts prennent 2 fois plus de dégâts.', NULL, 'Portée : +1/NM', NULL, 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:mur-gamma', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E80:AK82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:mur-gamma', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E80:AK82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:mur-gamma', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:revelation', 'magies/magie-de-la-lumiere', 'Révélation', 'revelation', 4, 15, 'Construction', 0, NULL, 0, 0, '20', 20, NULL, NULL, '5', 'nombre', 5, 'Cercle de 8', 'cercle', 8, 'Dévoile l''invisible', 'Invoque une boule de lumière qui emet une lumière capable de dévoiler les ennemis discrets, camouflés ou invisibles. Possède 30 santé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E83:AK85', 'Il se comporte comme un soleil vis à vis des créatures sensible à la lumière.

Le brouillard obscur bloque son effet.', NULL, NULL, NULL, 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:revelation', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:revelation', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:condamnation-solaire', 'magies/magie-de-la-lumiere', 'Condamnation solaire', 'condamnation-solaire', 4, 16, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '22', 22, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, NULL, 'Applique une marque sur la cible qui fait qu''elle prendra plus de dégâts des attaques proportionnellement à son état de santé. Voir remarque*.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E86:AK88', '*Dure 2 tours
80% de santé restante : +3 dégâts
60% de santé restante : +6 dégâts
40% de santé restante : +9 dégâts
20%  de santé restante : +12 dégâts', 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:condamnation-solaire', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E86:AK88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:condamnation-solaire', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E86:AK88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:condamnation-solaire', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:rai-solaire', 'magies/magie-de-la-lumiere', 'Rai solaire', 'rai-solaire', 4, 18, 'Attaque', 0, NULL, 0, 0, '28 (-2/NM)', 28, NULL, NULL, '14', 'nombre', 14, '1', 'unique', 1, '40 dégâts', 'Tire un rayon qui ignore l''AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E92:AK94', 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:rai-solaire', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:rai-solaire', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:rai-solaire', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:nova-finale', 'magies/magie-de-la-lumiere', 'Nova finale', 'nova-finale', 5, 20, 'Attaque (Inesquivable)', 0, NULL, 0, 1, '30', 30, NULL, NULL, 'Soi même', 'soi', NULL, 'Cercle de 5', 'cercle', 5, '10d6 + 60 dégâts', 'Le lanceur se concentre et devient le centre d''une explosion de lumière. 3NM = Les alliés ne prennent que la moitié des dégâts.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E98:AK100', NULL, 'Inesquivable', 'Effets : 3NM = Les alliés ne prennent que la moitié des dégâts', '50 % de la santé max', 'magies/magie-de-la-lumiere#specialisation:solaire');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:nova-finale', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Lumière › E98:AK100');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:nova-finale', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:nova-finale', 'effets', 1, 'palier', '3NM = Les alliés ne prennent que la moitié des dégâts', '3NM = Les alliés ne prennent que la moitié des dégâts', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:nova-finale', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:sanctuaire-protecteur', 'magies/magie-de-la-lumiere', 'Sanctuaire protecteur', 'sanctuaire-protecteur', 3, 21, 'Protection', 0, NULL, 0, 0, '14', 14, NULL, NULL, '1 (+1/NM)', 'nombre', 1, '1', 'unique', 1, NULL, 'Pendant 3 tours, la cible bénéficie d''un avantage contre les altérations d''état.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM71:BS73', NULL, NULL, 'Portée : +1/NM', NULL, 'magies/magie-de-la-lumiere#specialisation:benediction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:sanctuaire-protecteur', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM71:BS73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:sanctuaire-protecteur', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM71:BS73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:sanctuaire-protecteur', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-lumiere#sort:marque-du-champion', 'magies/magie-de-la-lumiere', 'Marque du champion', 'marque-du-champion', 3, 23, 'Amplification', 0, NULL, 0, 0, '14', 14, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '+3d6 dégâts', 'Donne des dégâts qui feront des dégâts neutres* pour 3 tours. 50% des dégâts infligés de ce bonus se convertissent en santé (100% si 3NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM77:BS79', '*Prend en compte l''AM', NULL, 'Effets : 50% des dégâts infligés de ce bonus se convertissent en santé (100% si 3NM)', NULL, 'magies/magie-de-la-lumiere#specialisation:benediction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:marque-du-champion', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:marque-du-champion', 'effets', 1, 'palier', 'si 3NM', '50% des dégâts infligés de ce bonus se convertissent en santé (100% si 3NM)', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Lumière › AM77:BS79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:marque-du-champion', 'magies/magie-de-la-lumiere', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:seigneur-des-morts', 'magies/magie-de-la-necromancie', 'Seigneur des morts', 'seigneur-des-morts', 3, 11, 'Amplification   (IC pour 3 NM)', 0, 3, 0, 0, '10', 10, 'ame', 3, '5', 'nombre', 5, '1', 'unique', 1, NULL, 'Donne une amplification aux invocations alliés parmis une liste*. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E77:AK79', '- +10 dégâts
- +6 AP
- +6 AM
- +10% de réussite aux jets
- +2 Vitesse
- 20% de chance de forcer un jet de vigueur/fermeté pour ne pas prendre l''altération d''état de l''élément lié niveau 1 à chaque attaque de l''invocation.', 'IC pour 3 NM', 'Type : IC pour 3 NM', '3 âmes', 'magies/magie-de-la-necromancie#specialisation:liche');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:seigneur-des-morts', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E77:AK79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:seigneur-des-morts', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E77:AK79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:seigneur-des-morts', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:ame-sacrifice', 'magies/magie-de-la-necromancie', 'Âme sacrifice', 'ame-sacrifice', 4, 15, 'Amplification', 0, NULL, 0, 0, '20', 20, 'ame', 4, '10', 'nombre', 10, '1', 'unique', 1, '+4 dégâts +2AP et AM/NPM invocation', 'Sacrifie l''invocation pour augmenter la puissance et défense d''un allié. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E89:AK91', NULL, NULL, NULL, '4 âmes', 'magies/magie-de-la-necromancie#specialisation:liche');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:ame-sacrifice', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E89:AK91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:ame-sacrifice', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:eclatement-mortuaire', 'magies/magie-de-la-necromancie', 'Éclatement mortuaire', 'eclatement-mortuaire', 4, 17, 'Attaque/ Amplification
(Imparable)', 0, NULL, 1, 0, '20', 20, 'ame', 4, '6', 'nombre', 6, '1', 'unique', 1, '6d6 + 20 dégâts', 'Cible un ennemi, le sort fait une éruption de 2 cases autour de lui, les invocations dans la zone ont un bonus de +5 dégâts à leur prochaine attaque.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E95:AK97', NULL, 'Imparable', NULL, '4 âmes', 'magies/magie-de-la-necromancie#specialisation:liche');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:eclatement-mortuaire', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E95:AK97');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:eclatement-mortuaire', 2, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E95:AK97');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:eclatement-mortuaire', 1, 'imparable', 'Imparable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › E95:AK97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:eclatement-mortuaire', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:plaie-toxique', 'magies/magie-de-la-necromancie', 'Plaie toxique', 'plaie-toxique', 3, 23, 'Attaque', 0, NULL, 0, 0, '10', 10, 'ame', 3, '6', 'nombre', 6, '1', 'unique', 1, '6d6 + 12 dégâts', 'Si la cible souffre de poison : +8 dégâts et +1 tour de poison.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM83:BS85', NULL, NULL, NULL, '3 âmes', 'magies/magie-de-la-necromancie#specialisation:poison');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:plaie-toxique', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:plaie-toxique', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:venin-corrosif', 'magies/magie-de-la-necromancie', 'Venin corrosif', 'venin-corrosif', 3, 24, 'Amplification', 0, NULL, 0, 0, '9', 9, 'ame', 3, '1', 'nombre', 1, '1', 'unique', 1, NULL, 'Le prochain sort de Nécromancie fera des dégâts considérés comme acide.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM86:BS88', 'L''attaque en question ne détruira pas les armures ou arme comme pourrai le faire l''eau ou la terre.', NULL, NULL, '3 âmes', 'magies/magie-de-la-necromancie#specialisation:poison');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:venin-corrosif', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:venin-corrosif', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:purge', 'magies/magie-de-la-necromancie', 'Purge', 'purge', 4, 25, 'Attaque', 0, NULL, 0, 0, '20', 20, 'ame', 4, '5 (+1/NM)', 'nombre', 5, '1', 'unique', 1, '6d6 + 10 dégâts', 'Si la cible souffre de poison : +12 dégâts/stade de poison. Retire le poison après le sort.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM89:BS91', NULL, NULL, 'Portée : +1/NM', '4 âmes', 'magies/magie-de-la-necromancie#specialisation:poison');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:purge', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:purge', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:purge', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:pestilance', 'magies/magie-de-la-necromancie', 'Pestilance', 'pestilance', 4, 28, 'Entrave', 0, NULL, 0, 0, '20', 20, 'ame', 4, 'Vue', 'vue', NULL, '1', 'unique', 1, NULL, 'La cible doit souffrir de poison : La cible emet une aura de 2 cases, ses alliés doivent faire un jet de vigueur sous peine de souffrir du même poison.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM98:BS100', NULL, NULL, NULL, '4 âmes', 'magies/magie-de-la-necromancie#specialisation:poison');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:pestilance', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:pestilance', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-necromancie#sort:pandemie', 'magies/magie-de-la-necromancie', 'Pandémie', 'pandemie', 5, 30, 'Entrave', 0, NULL, 0, 0, '40', 40, 'ame', 8, 'Soi même', 'soi', NULL, 'Cercle de 3', 'cercle', 3, '15 dégâts perce AM', 'Contamine toutes les créatures dans la zone avec Poison 1. À chaque tour, les créatures déjà empoisonnées augmentent leur stade de Poison.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM104:BS106', NULL, NULL, NULL, '8 âmes', 'magies/magie-de-la-necromancie#specialisation:poison');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:pandemie', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AM104:BS106');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:pandemie', 'magies/magie-de-la-necromancie', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:floraison-parasitaire', 'magies/magie-de-la-terre', 'Floraison parasitaire', 'floraison-parasitaire', 3, 11, 'Entrave', 0, NULL, 0, 0, '13', 13, NULL, NULL, '5', 'nombre', 5, '1', 'unique', 1, '-3d8 chakra / tour', 'Retire du chakra à la cible pendant 4 tours. 3NM permet à la plante de retirer la barrière en même temps.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E71:AK73', NULL, NULL, 'Effets : 3NM permet à la plante de retirer la barrière en même temps', NULL, 'magies/magie-de-la-terre#specialisation:vegetal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:floraison-parasitaire', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Terre › E71:AK73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:floraison-parasitaire', 'effets', 1, 'palier', '3NM permet à la plante de retirer la barrière en même temps', '3NM permet à la plante de retirer la barrière en même temps', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › E71:AK73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:floraison-parasitaire', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:pollen-entravante', 'magies/magie-de-la-terre', 'Pollen entravante', 'pollen-entravante', 3, 13, 'Entrave', 0, NULL, 0, 0, '12', 12, NULL, NULL, 'Soi même', 'soi', NULL, 'Croix de 1 (Cercle de 2 si 3NM)', 'croix', 1, NULL, 'Créer une zone autour du lanceur qui oblige ceux qui approche à faire un jet de vigueur, s''ils ratent, ils sont étourdi tant qu''ils sont dans la zone.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E77:AK79', NULL, NULL, 'Zone : Cercle de 2 si 3NM', NULL, 'magies/magie-de-la-terre#specialisation:vegetal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:pollen-entravante', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Terre › E77:AK79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:pollen-entravante', 'zone', 1, 'palier', 'Cercle de 2 si 3NM', 'Cercle de 2 si 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › E77:AK79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:pollen-entravante', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:epine-perforante', 'magies/magie-de-la-terre', 'Épine perforante', 'epine-perforante', 4, 15, 'Attaque', 0, NULL, 0, 0, '20', 20, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '8d6 + 30 dégâts', 'Ignore 5AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E83:AK85', NULL, NULL, NULL, NULL, 'magies/magie-de-la-terre#specialisation:vegetal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:epine-perforante', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Terre › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:epine-perforante', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:petale-bouclier', 'magies/magie-de-la-terre', 'Pétale-bouclier', 'petale-bouclier', 4, 17, 'Protection', 0, NULL, 0, 0, '26 (-2/NM)', 26, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'Protége un allié pendant 2 tours maximum d''un coup physique qui peut mettre dans le coma. Si protége d''un coup fatal = Voir remarque*', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E89:AK91', '*Met à 1 de santé et +20AP pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-la-terre#specialisation:vegetal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:petale-bouclier', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Terre › E89:AK91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:petale-bouclier', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E89:AK91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:petale-bouclier', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:floraison-carnivore', 'magies/magie-de-la-terre', 'Floraison carnivore', 'floraison-carnivore', 5, 20, 'Invocation', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '4', 'nombre', 4, 'Cercle de 6 cases', 'cercle', 6, '50 dégâts / tour', 'Invoque une plante géante qui attaque les ennemis sur son chemin, il reste 4 tours maximum et possède 70 santé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E98:AK100', 'Prend 2 fois plus de dégâts des sorts de feu ou de sang.', NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-la-terre#specialisation:vegetal');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:floraison-carnivore', 1, 'invocation', 'Invocation', 'magies', 'Nouveauté mise à jour Décembre › Terre › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:floraison-carnivore', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:floraison-carnivore', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:rayon-geode', 'magies/magie-de-la-terre', 'Rayon géode', 'rayon-geode', 3, 24, 'Attaque', 0, NULL, 0, 0, '12', 12, NULL, NULL, '7', 'nombre', 7, '1', 'unique', 1, '20 dégâts (+3/NM)', 'Tire un rayon qui ignore l''AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM80:BS82', NULL, NULL, 'D/S/B : +3/NM', NULL, 'magies/magie-de-la-terre#specialisation:mineral');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:rayon-geode', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Terre › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:rayon-geode', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:rayon-geode', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:gemmification', 'magies/magie-de-la-terre', 'Gemmification', 'gemmification', 4, 26, 'Amplification', 0, NULL, 0, 0, '20', 20, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, '-25% dégâts finaux physique', 'Réduit les dégâts physique subis pendant 2 tours. 
3NM = réduit les dégâts de 50% au lieu de 25%.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM86:BS88', NULL, NULL, 'Effets : 3NM = réduit les dégâts de 50% au lieu de 25%', NULL, 'magies/magie-de-la-terre#specialisation:mineral');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:gemmification', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Terre › AM86:BS88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:gemmification', 'effets', 1, 'palier', '3NM = réduit les dégâts de 50% au lieu de 25%', '3NM = réduit les dégâts de 50% au lieu de 25%', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:gemmification', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-la-terre#sort:anti-alliage', 'magies/magie-de-la-terre', 'Anti-Alliage', 'anti-alliage', 4, 28, 'Amplification (IC pour 3 NM)', 0, 3, 0, 0, '23', 23, NULL, NULL, '2', 'nombre', 2, '1', 'unique', 1, NULL, 'Reforce la peau et bloque l''effet secondaire des matériaux pendant 3 tours. Ne bloque leur bonus de dégâts.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM92:BS94', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, 'magies/magie-de-la-terre#specialisation:mineral');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:anti-alliage', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Terre › AM92:BS94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:anti-alliage', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Terre › AM92:BS94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-la-terre#sort:anti-alliage', 'magies/magie-de-la-terre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:fer-brillant', 'magies/magie-de-larcane', 'Fer brillant', 'fer-brillant', 2, 9, 'Amplification (IC pour 3 NM)', 0, 3, 0, 0, '5', 5, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '+10 dégâts', 'Imprègne l''arme d''une énergie brillante. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › V69:BB71', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, NULL);
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:fer-brillant', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Arcane › V69:BB71');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:fer-brillant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Arcane › V69:BB71');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:fer-brillant', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:projectile-arcanique', 'magies/magie-de-larcane', 'Projectile arcanique', 'projectile-arcanique', 3, 12, 'Attaque', 0, NULL, 0, 0, '*4 / projectile', NULL, NULL, NULL, '10', 'nombre', 10, '1', 'unique', 1, '2d6 dégâts/ projectile', 'Peut cibler une ou plusieurs cibles. Le bonus de dégâts du lanceur ne s''applique qu''une fois par cible touchée.  3NM = Ignore 50% de AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E83:AK85', 'L''AM est pris en compte pour chaque projectile.

*Le coût augmente de 1 à chaque projectile envoyé sur l''action (le premier coute 4, le second coute 5, etc)', NULL, 'Effets : 3NM = Ignore 50% de AM', NULL, 'magies/magie-de-larcane#specialisation:construction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:projectile-arcanique', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Arcane › E83:AK85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:projectile-arcanique', 'effets', 1, 'palier', '3NM = Ignore 50% de AM', '3NM = Ignore 50% de AM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:projectile-arcanique', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:lance-dether', 'magies/magie-de-larcane', 'Lance d''éther', 'lance-dether', 4, 18, 'Attaque', 0, NULL, 0, 0, '24 (-2/NM)', 24, NULL, NULL, '20', 'nombre', 20, '1', 'unique', 1, '7d6 + 35 dégâts', 'Une grosse attaque d''arcane.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E101:AK103', NULL, NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-larcane#specialisation:construction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:lance-dether', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Arcane › E101:AK103');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:lance-dether', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E101:AK103');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:lance-dether', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:pate-de-la-trame', 'magies/magie-de-larcane', 'Pâte de la trame', 'pate-de-la-trame', 5, 19, 'Amplification
(+1 utilisation/NM)', 0, NULL, 0, 0, '12', 12, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, NULL, 'Le lanceur donne un boost pour les sorts parmis une liste*. Chaque boost maintenu augmente la consommation de chakra.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E104:AK106', '*
- +15 dégâts magiques
- +3 portée avec les sorts
- +1 portée d''une zone
- Le CC d''une attaque oblige le jet de vigueur/fermeté pour ne pas prendre l''altération d''état lié au niveau 1', '+1 utilisation/NM', 'Type : +1 utilisation/NM', 'Par effet et par tour', 'magies/magie-de-larcane#specialisation:construction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:pate-de-la-trame', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Arcane › E104:AK106');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:pate-de-la-trame', 'type', 1, 'par_nm', '+1 utilisation/NM', '+1 utilisation/NM', '+1 utilisation', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › E104:AK106');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:pate-de-la-trame', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:rupture-darmure', 'magies/magie-de-larcane', 'Rupture d''armure', 'rupture-darmure', 3, 21, 'Entrave', 0, NULL, 0, 0, '13', 13, NULL, NULL, '5', 'nombre', 5, '1', 'unique', 1, NULL, 'Divise par 2 les AM de base de la cible pendant 3 tours. 3NM = Divise par 2 les AM de l''armure en plus.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM80:BS82', NULL, NULL, 'Effets : 3NM = Divise par 2 les AM de l''armure en plus', NULL, 'magies/magie-de-larcane#specialisation:destruction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:rupture-darmure', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:rupture-darmure', 'effets', 1, 'palier', '3NM = Divise par 2 les AM de l''armure en plus', '3NM = Divise par 2 les AM de l''armure en plus', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:rupture-darmure', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:surdechirure', 'magies/magie-de-larcane', 'Surdéchirure', 'surdechirure', 3, 24, 'Attaque/Entrave', 0, NULL, 0, 0, '15', 15, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '7d6 + 15 dégâts', 'Si jet de fermeté raté = Inflige surcharge magique .1', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM89:BS91', NULL, NULL, NULL, NULL, 'magies/magie-de-larcane#specialisation:destruction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:surdechirure', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM89:BS91');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:surdechirure', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM89:BS91');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:surdechirure', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 'inflige', 1, NULL, 'effets', 'surcharge magique', 'Si jet de fermeté raté = Inflige surcharge magique .1', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:surdechirure', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:contre-sort', 'magies/magie-de-larcane', 'Contre-sort', 'contre-sort', 4, 25, 'Entrave
(Réaction)', 0, NULL, 0, 0, 'N/A', NULL, NULL, NULL, '6 (+2/NM)', 'nombre', 6, '1', 'unique', 1, NULL, 'La lanceur bloque un sort ennemi lvl 1-4 le faisant passer de réussite à échec. Le coût correspond au sort qui a été bloqué. (1 fois par tour)', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM92:BS94', NULL, 'Réaction', 'Portée : +2/NM', 'Variable selon le sort bloqué', 'magies/magie-de-larcane#specialisation:destruction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:contre-sort', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM92:BS94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:contre-sort', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM92:BS94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:contre-sort', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:effondrement-terne', 'magies/magie-de-larcane', 'Effondrement terne', 'effondrement-terne', 4, 26, 'Attaque', 0, NULL, 0, 0, '24', 24, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '5d6 + 40 dégâts', 'Si jet de fermeté raté = Inflige surcharge magique 1.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM95:BS97', NULL, NULL, NULL, NULL, 'magies/magie-de-larcane#specialisation:destruction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:effondrement-terne', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM95:BS97');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:effondrement-terne', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 'inflige', 1, 1, 'effets', 'surcharge magique', 'Si jet de fermeté raté = Inflige surcharge magique 1.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM95:BS97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:effondrement-terne', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-larcane#sort:cassage-gris', 'magies/magie-de-larcane', 'Cassage gris', 'cassage-gris', 5, 30, 'Attaque', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '8', 'nombre', 8, '1', 'unique', 1, '10d6 + 70 dégâts', 'Inflige de terribles dégâts d''arcane. Si jet de fermeté raté = Inflige surcharge magique 2.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM107:BS109', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-larcane#specialisation:destruction');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:cassage-gris', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM107:BS109');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:cassage-gris', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM107:BS109');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:cassage-gris', 'guide/liste-des-alterations-d-etat#etat:surcharge-magique', 'inflige', 1, 2, 'effets', 'surcharge magique', 'Si jet de fermeté raté = Inflige surcharge magique 2.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AM107:BS109');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-larcane#sort:cassage-gris', 'magies/magie-de-larcane', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:geyser', 'magies/magie-de-leau', 'Geyser', 'geyser', 4, 17, 'Attaque', 0, NULL, 0, 0, '24', 24, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '8d6 + 35 dégâts', 'Si jet de stabilité/réflexe raté = Tombe au sol', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E88:AK90', NULL, NULL, NULL, NULL, 'magies/magie-de-leau#specialisation:deferlante');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:geyser', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Eau › E88:AK90');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:geyser', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:vortex', 'magies/magie-de-leau', 'Vortex', 'vortex', 4, 18, 'Placement', 0, NULL, 0, 0, '20 (-2/NM)', 20, NULL, NULL, '10', 'nombre', 10, 'Cercle de 4', 'cercle', 4, NULL, 'Attire les cibles en son centre. Inflige 10 dégâts perce AM si à 4 cases d''un point d''eau.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E91:AK93', NULL, NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-leau#specialisation:deferlante');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:vortex', 1, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Eau › E91:AK93');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:vortex', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E91:AK93');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:vortex', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:torrent-colerique', 'magies/magie-de-leau', 'Torrent colérique', 'torrent-colerique', 5, 19, 'Attaque/ Entrave', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '20', 'nombre', 20, 'Ligne', 'ligne', NULL, '10d6 + 60 dégâts', 'Une attaque d''Eau en ligne qui touche tout sur son chemin. Si jet de stabilité/réflexe raté = Tombe au sol', 'Que l’eau cesse d’être douce et devienne une lame,
Que la pression des mers s’aligne dans mon bras,
Que le courant renverse tout ce qu’il traverse,
Que nul obstacle n’échappe à la Dame,
Et que la vague pure devienne un rayon destructeur…

LASER HYDRAULIQUE !', 'magies', 'Nouveauté mise à jour Décembre › Eau › E94:AK96; L102:AB109', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-de-leau#specialisation:deferlante');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:torrent-colerique', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Eau › E94:AK96');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:torrent-colerique', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Eau › E94:AK96');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:torrent-colerique', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E94:AK96');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:torrent-colerique', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:zone-abyssal', 'magies/magie-de-leau', 'Zone abyssal', 'zone-abyssal', 5, 20, 'Construction', 0, NULL, 0, 0, '50', 50, NULL, NULL, 'Soi même', 'soi', NULL, 'Terrain', 'terrain', NULL, NULL, 'Rempli le terrain d''eau, ce qui pousse à utiliser la vitesse de nage. Dure 3 tours (+1/NM)', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E97:AK99', NULL, NULL, 'Effets : Dure 3 tours (+1/NM)', NULL, 'magies/magie-de-leau#specialisation:deferlante');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:zone-abyssal', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Eau › E97:AK99');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:zone-abyssal', 'effets', 1, 'par_nm', '+1/NM', 'Dure 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › E97:AK99');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:zone-abyssal', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:dorsale-protectrice', 'magies/magie-de-leau', 'Dorsale protectrice', 'dorsale-protectrice', 3, 21, 'Protection', 0, NULL, 0, 0, '18 (-2/NM)', 18, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, NULL, 'L''armure obtient une résistance à la frappe, avantage pour résister aux sorts de placement, réduit les dégâts de 10. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM70:BS72', NULL, NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-leau#specialisation:source');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:dorsale-protectrice', 1, 'protection', 'Protection', 'magies', 'Nouveauté mise à jour Décembre › Eau › AM70:BS72');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:dorsale-protectrice', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM70:BS72');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:dorsale-protectrice', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:siphon-vital', 'magies/magie-de-leau', 'Siphon vital', 'siphon-vital', 3, 22, 'Attaque/Soin', 0, NULL, 0, 0, '14', 14, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '5d6 + 15 dégâts', 'Vampirise 25% des dégâts infligés à la santé. (50% au niveau 3 de maîtrise).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM73:BS75', NULL, NULL, 'Effets : 50% au niveau 3 de maîtrise', NULL, 'magies/magie-de-leau#specialisation:source');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:siphon-vital', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Eau › AM73:BS75');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:siphon-vital', 2, 'soin', 'Soin', 'magies', 'Nouveauté mise à jour Décembre › Eau › AM73:BS75');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:siphon-vital', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', '50% au niveau 3 de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM73:BS75');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:siphon-vital', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-leau#sort:riviere-douce', 'magies/magie-de-leau', 'Rivière douce', 'riviere-douce', 3, 23, 'Soin', 0, NULL, 0, 0, '14', 14, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '3d6 de soin (+8/NM)', 'Un sort de soin de l''eau. +3 portée si à 4 cases d''un point d''eau.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM76:BS78', NULL, NULL, 'D/S/B : +8/NM', NULL, 'magies/magie-de-leau#specialisation:source');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-leau#sort:riviere-douce', 1, 'soin', 'Soin', 'magies', 'Nouveauté mise à jour Décembre › Eau › AM76:BS78');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:riviere-douce', 'dsb', 1, 'par_nm', '+8/NM', '+8/NM', '+8', 8, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Eau › AM76:BS78');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-leau#sort:riviere-douce', 'magies/magie-de-leau', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:faille-chronique', 'magies/magie-de-lespace-temps', 'Faille chronique', 'faille-chronique', 2, 7, 'Placement', 0, NULL, 0, 0, '8 (-1/NM)', 8, NULL, NULL, 'Vue', 'vue', NULL, '1', 'unique', 1, NULL, '[Se combine avec une attaque distance] Envoie le projectile dans une faille qui va aller sur une cible aléatoire', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V57:BB59', NULL, NULL, 'Coût : -1/NM', NULL, NULL);
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:faille-chronique', 1, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V57:BB59');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:faille-chronique', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › V57:BB59');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:faille-chronique', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:spayon', 'magies/magie-de-lespace-temps', 'Spayon', 'spayon', 3, 11, 'Attaque', 0, NULL, 0, 0, '15', 15, NULL, NULL, '4 (+2/NM)', 'nombre', 4, '1', 'unique', 1, '7d6 + 15 dégâts', 'Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E74:AK76', NULL, NULL, 'Portée : +2/NM', NULL, 'magies/magie-de-lespace-temps#specialisation:spacio');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:spayon', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E74:AK76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:spayon', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E74:AK76');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:spayon', 'guide/liste-des-alterations-d-etat#etat:fatigue', 'prend', 1, 1, 'effets', 'fatigue', 'Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E74:AK76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:spayon', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:espace-relatif', 'magies/magie-de-lespace-temps', 'Espace relatif', 'espace-relatif', 3, 12, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '15', 15, NULL, NULL, 'Soi même', 'soi', NULL, 'Cercle de 2', 'cercle', 2, 'Malus de 25%', 'Ceux qui sont dans la zone impose un malus pour toucher à ceux qui tente de les attaquer à plus de 3 cases de distance. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E77:AK79', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-de-lespace-temps#specialisation:spacio');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:espace-relatif', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E77:AK79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:espace-relatif', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E77:AK79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:espace-relatif', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:principe-dincertitude', 'magies/magie-de-lespace-temps', 'Principe d''incertitude', 'principe-dincertitude', 3, 14, 'Amplification', 0, NULL, 0, 0, '15', 15, NULL, NULL, '4', 'nombre', 4, '1', 'unique', 1, NULL, 'Donne une seule réaction qui permet de se téléporter de 2 cases après qu''une attaque hostile a touchée. Reste 3 tours tant qu''il n''est pas utilisé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E83:AK85', NULL, NULL, NULL, NULL, 'magies/magie-de-lespace-temps#specialisation:spacio');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:principe-dincertitude', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:principe-dincertitude', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:vitesse-relative', 'magies/magie-de-lespace-temps', 'Vitesse relative', 'vitesse-relative', 4, 15, 'Entrave (IC pour 3 NM)', 0, 3, 0, 0, '23', 23, NULL, NULL, 'Soi même', 'soi', NULL, 'Cercle de 6', 'cercle', 6, NULL, 'Créer une zone où les alliés ont +1 vitesse et +1IC. Les ennemis ont -1 vitesse et -2IC. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E86:AK88', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, 'magies/magie-de-lespace-temps#specialisation:spacio');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:vitesse-relative', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E86:AK88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:vitesse-relative', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E86:AK88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:vitesse-relative', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:ancrage-dimensionnel', 'magies/magie-de-lespace-temps', 'Ancrage dimensionnel', 'ancrage-dimensionnel', 4, 17, 'Entrave (IC)', 1, NULL, 0, 0, '22 (-2/NM)', 22, NULL, NULL, '7', 'nombre', 7, '1', 'unique', 1, NULL, 'Empêche la cible d''exploiter l''effet de placement de ses sorts pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E92:AK94', NULL, 'IC', 'Coût : -2/NM', NULL, 'magies/magie-de-lespace-temps#specialisation:spacio');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ancrage-dimensionnel', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E92:AK94');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ancrage-dimensionnel', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ancrage-dimensionnel', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:ancrage-dimensionnel', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:erreur-ulterieur', 'magies/magie-de-lespace-temps', 'Erreur ultérieur', 'erreur-ulterieur', 4, 26, 'Amplification (IC pour 3 NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, NULL, 'Donne une seule réaction qui permet de relancer un jet d''attaque raté pour un allié/réussi pour un ennemi. Reste 3 tours tant qu''il n''est pas utilisé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM89:BS91', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, 'magies/magie-de-lespace-temps#specialisation:temporelle');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:erreur-ulterieur', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:erreur-ulterieur', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:erreur-ulterieur', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:vision-dephase', 'magies/magie-de-lespace-temps', 'Vision déphasé', 'vision-dephase', 4, 28, 'Attaque/Entrave', 0, NULL, 0, 0, '21', 21, NULL, NULL, '14', 'nombre', 14, '1', 'unique', 1, '3 x 2d6 dégâts', 'Tire un rayon qui ignore l''AM.
Si jet de fermeté raté = Impose un malus de 25% à ses jets d''attaque et de défense pendant 1 tour.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM95:BS97', NULL, NULL, NULL, NULL, 'magies/magie-de-lespace-temps#specialisation:temporelle');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:vision-dephase', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM95:BS97');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:vision-dephase', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM95:BS97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:vision-dephase', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lespace-temps#sort:convergence', 'magies/magie-de-lespace-temps', 'Convergence', 'convergence', 5, 30, 'Amplification', 0, NULL, 0, 0, '40', 40, NULL, NULL, '4', 'nombre', 4, '1', 'unique', 1, NULL, 'Invoque un clone qui va reproduire les deux prochaines actions réussi à hauteur de 50% (100%/3NM) des effets.', NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM101:BS103', NULL, NULL, 'Effets : Invoque un clone qui va reproduire les deux prochaines actions réussi à hauteur de 50% (100%/3NM) des effets', NULL, 'magies/magie-de-lespace-temps#specialisation:temporelle');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:convergence', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM101:BS103');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:convergence', 'effets', 1, 'par_nm', '100%/3NM', 'Invoque un clone qui va reproduire les deux prochaines actions réussi à hauteur de 50% (100%/3NM) des effets', '100%', NULL, 3, NULL, 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AM101:BS103');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:convergence', 'magies/magie-de-lespace-temps', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:javelot-lunaire', 'magies/magie-de-lombre', 'Javelot lunaire', 'javelot-lunaire', 3, 12, 'Attaque', 0, NULL, 0, 0, '16 (-1/NM)', 16, NULL, NULL, '12', 'nombre', 12, 'Ligne', 'ligne', NULL, '7d6 +15 dégâts', 'Une puissante attaque d''ombre.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E74:AK76', NULL, NULL, 'Coût : -1/NM', NULL, 'magies/magie-de-lombre#specialisation:lune');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:javelot-lunaire', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Ombre › E74:AK76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:javelot-lunaire', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › E74:AK76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:javelot-lunaire', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 'magies/magie-de-lombre', 'Grand bailleur', 'grand-bailleur', 3, 21, 'Attaque/ Entrave (Inesquivable)', 0, NULL, 0, 1, '12', 12, NULL, NULL, '4', 'nombre', 4, 'Cône', 'cone', NULL, '5d6 dégâts sonores (+6/NM)', 'Si jet de fermeté raté = Inflige somnolence 1', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73', NULL, 'Inesquivable', 'D/S/B : +6/NM', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 'dsb', 1, 'par_nm', '+6/NM', '+6/NM', '+6', 6, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grand-bailleur', 'guide/liste-des-alterations-d-etat#etat:somnolence', 'inflige', 1, 1, 'effets', 'somnolence', 'Si jet de fermeté raté = Inflige somnolence 1', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM71:BS73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:grand-bailleur', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:marchand-de-sable', 'magies/magie-de-lombre', 'Marchand de sable', 'marchand-de-sable', 3, 22, 'Entrave 
(IC) (IC x 2 si 3NM)', 1, NULL, 0, 0, '10', 10, NULL, NULL, '6', 'nombre', 6, 'Cercle de 2', 'cercle', 2, NULL, 'Si jet de fermeté raté = Inflige somnolence 1 à ceux dans le cercle.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM74:BS76', NULL, 'IC
IC x 2 si 3NM', 'Type : IC x 2 si 3NM', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marchand-de-sable', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM74:BS76');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marchand-de-sable', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM74:BS76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marchand-de-sable', 'type', 1, 'palier', 'IC x 2 si 3NM', 'IC x 2 si 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM74:BS76');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marchand-de-sable', 'guide/liste-des-alterations-d-etat#etat:somnolence', 'inflige', 1, 1, 'effets', 'somnolence', 'Si jet de fermeté raté = Inflige somnolence 1 à ceux dans le cercle.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM74:BS76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:marchand-de-sable', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:cauchemar', 'magies/magie-de-lombre', 'Cauchemar', 'cauchemar', 3, 23, 'Attaque', 0, NULL, 0, 0, '14', 14, NULL, NULL, 'Vue', 'vue', NULL, 'Illimité', 'autre', NULL, '3d6 dégâts / niveau somnolence', 'Inflige des dégâts aux cilbes qui ont un niveau de somnolence. Ne touche pas les alliés avec 3NM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM77:BS79', NULL, NULL, 'Effets : Ne touche pas les alliés avec 3NM', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:cauchemar', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:cauchemar', 'effets', 1, 'palier', 'Ne touche pas les alliés avec 3NM', 'Ne touche pas les alliés avec 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM77:BS79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:cauchemar', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:trait-somnoleur', 'magies/magie-de-lombre', 'Trait somnoleur', 'trait-somnoleur', 4, 25, 'Attaque', 0, NULL, 0, 0, '20 (-2/NM)', 20, NULL, NULL, '14', 'nombre', 14, '1', 'unique', 1, '25 dégâts', 'Inflige +7 dégâts bonus par niveau de somnolence de la cible. Ignore l''AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM83:BS85', NULL, NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:trait-somnoleur', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM83:BS85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:trait-somnoleur', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:trait-somnoleur', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:mauvaise-nuit', 'magies/magie-de-lombre', 'Mauvaise nuit', 'mauvaise-nuit', 4, 26, 'Entrave', 0, NULL, 0, 0, '22 (-2/NM)', 22, NULL, NULL, '5', 'nombre', 5, '1', 'unique', 1, '+5 dégâts/niv somnolence encaissé', 'La cible doit souffrir de somnolence : Applique une marque qui fait qu''il prendra plus de dégâts des attaques tant qu''il souffre de l''altération d''état.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM86:BS88', NULL, NULL, 'Coût : -2/NM', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:mauvaise-nuit', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM86:BS88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:mauvaise-nuit', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:mauvaise-nuit', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:croire-aux-reves', 'magies/magie-de-lombre', 'Croire aux rêves', 'croire-aux-reves', 4, 27, 'Amplification (IC)', 1, NULL, 0, 0, '20', 20, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, '+10% à la réussite', 'Dure 1 tour (+1/NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM89:BS91', NULL, 'IC', 'Effets : Dure 1 tour (+1/NM)', NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:croire-aux-reves', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM89:BS91');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:croire-aux-reves', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:croire-aux-reves', 'effets', 1, 'par_nm', '+1/NM', 'Dure 1 tour (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:croire-aux-reves', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-de-lombre#sort:prophetie', 'magies/magie-de-lombre', 'Prophétie', 'prophetie', 5, 30, 'Amplification', 0, NULL, 0, 0, '55', 55, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'Donne un avantage à tous les jets pendant 2 tours. Encaisse somnolence 2 à la fin.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM98:BS100', NULL, NULL, NULL, NULL, 'magies/magie-de-lombre#specialisation:songe');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:prophetie', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-de-lombre#sort:prophetie', 'magies/magie-de-lombre', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:rayon-de-fusion', 'magies/magie-du-feu', 'Rayon de fusion', 'rayon-de-fusion', 4, 18, 'Attaque', 0, NULL, 0, 0, '28 (-2/NM)', 28, NULL, NULL, '14', 'nombre', 14, '1', 'unique', 1, '40 dégâts', 'Tire un rayon qui ignore l''AM.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › E92:AK94', 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', NULL, 'Coût : -2/NM', NULL, 'magies/magie-du-feu#specialisation:volcan');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:rayon-de-fusion', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:rayon-de-fusion', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:rayon-de-fusion', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:meteore-eruptif', 'magies/magie-du-feu', 'Météore éruptif', 'meteore-eruptif', 5, 20, 'Attaque', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '8', 'nombre', 8, 'Cercle de 3', 'cercle', 3, '10d6 + 60 dégâts', 'Inflige de terribles dégâts de feu. Si jet de vigueur raté = Inflige brûlure 1', 'Que le ciel s’ouvre au courroux des flammes,
Que la voûte céleste s’embrase sous ma volonté,
Que la braise se condense en un cœur incandescent,
Qu’il chute comme un jugement ardent sur les vivants,
Et que nul ne puisse fuir l’ombre de sa chute…

MÉTÉORE CRAMOISI !', 'magies', 'Nouveauté mise à jour Décembre › Feu › E98:AK100; L115:AB122', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-du-feu#specialisation:volcan');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:meteore-eruptif', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:meteore-eruptif', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › E98:AK100');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-feu#sort:meteore-eruptif', 'guide/liste-des-alterations-d-etat#etat:brulure', 'inflige', 1, 1, 'effets', 'brûlure', 'Si jet de vigueur raté = Inflige brûlure 1', 'magies', 'Nouveauté mise à jour Décembre › Feu › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:meteore-eruptif', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:jet-de-cendre', 'magies/magie-du-feu', 'Jet de cendre', 'jet-de-cendre', 3, 21, 'Attaque/ Entrave', 0, NULL, 0, 0, '14', 14, NULL, NULL, '4', 'nombre', 4, 'Cône', 'cone', NULL, '7d6 dégâts (+4/NM)', 'Inflige un malus de -15% à l''adversaire pour sa prochaine attaque. +5% le malus si un tas de cendre est à côté des cibles.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM71:BS73', NULL, NULL, 'D/S/B : +4/NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:jet-de-cendre', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM71:BS73');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:jet-de-cendre', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM71:BS73');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:jet-de-cendre', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM71:BS73');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:jet-de-cendre', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:ruee-cendreuse', 'magies/magie-du-feu', 'Ruée cendreuse', 'ruee-cendreuse', 3, 22, 'Placement (IC)', 1, NULL, 0, 0, '17 (-2/NM)', 17, NULL, NULL, '5', 'nombre', 5, '1', 'unique', 1, NULL, 'Permet de se téléporter à un endroit. La portée est doublé si un tas de cendre est ciblé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM74:BS76', NULL, 'IC', 'Coût : -2/NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:ruee-cendreuse', 1, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM74:BS76');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-feu#sort:ruee-cendreuse', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM74:BS76');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:ruee-cendreuse', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM74:BS76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:ruee-cendreuse', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:aspect-cendreuse', 'magies/magie-du-feu', 'Aspect cendreuse', 'aspect-cendreuse', 3, 23, 'Amplification', 0, NULL, 0, 0, '12', 12, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, NULL, 'Rend le lanceur insensible pour 2 tours (+1/NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM77:BS79', 'L''insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. Prendre un coup physique annule cet état.', NULL, 'Effets : Rend le lanceur insensible pour 2 tours (+1/NM)', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:aspect-cendreuse', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:aspect-cendreuse', 'effets', 1, 'par_nm', '+1/NM', 'Rend le lanceur insensible pour 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM77:BS79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:aspect-cendreuse', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:tas-de-cendre', 'magies/magie-du-feu', 'Tas de cendre', 'tas-de-cendre', 3, 24, 'Construction 
(IC x1/NM)', 0, NULL, 0, 0, '9', 9, NULL, NULL, '9', 'nombre', 9, '1', 'unique', 1, NULL, 'Place un tas de cendre sur le terrain, possède 20 santé. Il peut être utile pour d''autres sorts. Maximum 4 à la fois sur le terrain.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM80:BS82', NULL, 'IC x1/NM', 'Type : IC x1/NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:tas-de-cendre', 1, 'construction', 'Construction', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:tas-de-cendre', 'type', 1, 'par_nm', 'IC x1/NM', 'IC x1/NM', 'x1', NULL, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:tas-de-cendre', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:eruption-grise', 'magies/magie-du-feu', 'Éruption grise', 'eruption-grise', 4, 25, 'Attaque/ Placement', 0, NULL, 0, 0, '22', 22, NULL, NULL, 'Vue', 'vue', NULL, 'Cercle de 2', 'cercle', 2, '5d6 + 12 dégâts', 'Peut être fait que sur un tas de cendre = Inflige des dégâts sur une zone et repousse de 2 cases les cibles. 3NM = Ne touche pas les alliés.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM83:BS85', NULL, NULL, 'Effets : 3NM = Ne touche pas les alliés', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:eruption-grise', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM83:BS85');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:eruption-grise', 2, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM83:BS85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:eruption-grise', 'effets', 1, 'palier', '3NM = Ne touche pas les alliés', '3NM = Ne touche pas les alliés', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:eruption-grise', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:fumerolle', 'magies/magie-du-feu', 'Fumerolle', 'fumerolle', 4, 26, 'Attaque', 0, NULL, 0, 0, '23', 23, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '6d6 + 20 dégâts', 'Inflige un bonus de +10 dégâts par tas de cendre présent sur le terrain.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM86:BS88', NULL, NULL, NULL, NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:fumerolle', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM86:BS88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:fumerolle', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:suie-concentree', 'magies/magie-du-feu', 'Suie concentrée', 'suie-concentree', 4, 27, 'Amplification  (IC pour 3 NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, '+1 portée/tas de cendre', 'Augmente la portée des sorts du feu par tas de cendre présent sur le terrain. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM89:BS91', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:suie-concentree', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:suie-concentree', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:suie-concentree', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:bombe-de-cancer', 'magies/magie-du-feu', 'Bombe de cancer', 'bombe-de-cancer', 5, 29, 'Attaque', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '8', 'nombre', 8, 'Cercle de 3', 'cercle', 3, '10d6 + 60 dégâts', 'Ignore à 50% des AM des cibles qui sont à côté d''un tas de cendre.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM95:BS97', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bombe-de-cancer', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM95:BS97');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bombe-de-cancer', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM95:BS97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:bombe-de-cancer', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-feu#sort:forteresse-escarbille', 'magies/magie-du-feu', 'Forteresse escarbille', 'forteresse-escarbille', 5, 30, 'Amplification', 0, NULL, 0, 0, '40 (-5/NM)', 40, NULL, NULL, 'Vue', 'vue', NULL, 'Terrain', 'terrain', NULL, NULL, 'Les tas de cendre deviennent des colonnes infranchissable avec le double de santé, leur bonus sont doublés et riposte contre des assauts*.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM98:BS100', '*Force le jet de vigueur à un agresseur pour ne pas qu''il prenne "brûlure 2"', NULL, 'Coût : -5/NM', NULL, 'magies/magie-du-feu#specialisation:cendre');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-feu#sort:forteresse-escarbille', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Feu › AM98:BS100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:forteresse-escarbille', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Feu › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-feu#sort:forteresse-escarbille', 'magies/magie-du-feu', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:crachat-bordeaux', 'magies/magie-du-sang', 'Crachat bordeaux', 'crachat-bordeaux', 2, 9, 'Attaque', 0, NULL, 0, 0, '4', 4, 'sang', 3, '7', 'nombre', 7, '1', 'unique', 1, '5d6 dégâts (+3/NM)', 'La cible doit souffrir d''un saignement = Oblige un jet de vigueur, si elle rate elle subit une fois les effets de l''altération d''état.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › V64:BB66', NULL, NULL, 'D/S/B : +3/NM', '3 Sang', NULL);
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:crachat-bordeaux', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Sang › V64:BB66');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:crachat-bordeaux', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › V64:BB66');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:crachat-bordeaux', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:marquage-surcharge', 'magies/magie-du-sang', 'Marquage surchargé', 'marquage-surcharge', 3, 12, 'Entrave (IC)', 1, NULL, 0, 0, '11', 11, 'sang', 3, '1 (+1/NM)', 'nombre', 1, '1', 'unique', 1, 'Variable', 'Inflige 4 dégâts neutre à la santé de la cible à chaque IC, action ou case de déplacement entrepris par cette dernière. Dure 1 tour. ', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E78:AK80', 'Ignore les défenses.', 'IC', 'Portée : +1/NM', '3 Sang', 'magies/magie-du-sang#specialisation:puissance');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage-surcharge', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Sang › E78:AK80');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage-surcharge', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E78:AK80');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage-surcharge', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E78:AK80');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-surcharge', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:super-hemoglobine', 'magies/magie-du-sang', 'Super hémoglobine', 'super-hemoglobine', 3, 13, 'Amplification', 0, NULL, 0, 0, '13', 13, 'sang', 1, 'Soi même', 'soi', NULL, '1', 'unique', 1, NULL, 'Permet de récupérer 2 (3/3NM) de sang par tour au lieu de 1 pendant 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E81:AK83', NULL, NULL, 'Effets : Permet de récupérer 2 (3/3NM) de sang par tour au lieu de 1 pendant 3 tours', '1 Sang', 'magies/magie-du-sang#specialisation:puissance');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:super-hemoglobine', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Sang › E81:AK83');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:super-hemoglobine', 'effets', 1, 'palier', '3/3NM', 'Permet de récupérer 2 (3/3NM) de sang par tour au lieu de 1 pendant 3 tours', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › E81:AK83');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:super-hemoglobine', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:fleau-sanglant', 'magies/magie-du-sang', 'Fléau sanglant', 'fleau-sanglant', 4, 17, 'Attaque
(Imparable)', 0, NULL, 1, 0, '19', 19, 'sang', 5, '5', 'nombre', 5, '1', 'unique', 1, '8d6 + 20 dégâts', 'Si 3NM = Divise par 2 le malus pour viser une partie du corps.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E93:AK95', NULL, 'Imparable', 'Effets : Si 3NM = Divise par 2 le malus pour viser une partie du corps', '5 Sang', 'magies/magie-du-sang#specialisation:puissance');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:fleau-sanglant', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Sang › E93:AK95');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:fleau-sanglant', 1, 'imparable', 'Imparable', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E93:AK95');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:fleau-sanglant', 'effets', 1, 'palier', '3NM = Divise par 2 le malus pour viser une partie du corps', 'Si 3NM = Divise par 2 le malus pour viser une partie du corps', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › E93:AK95');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:fleau-sanglant', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:marquage-dechirant', 'magies/magie-du-sang', 'Marquage déchirant', 'marquage-dechirant', 4, 18, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '16', 16, 'sang', 4, '4', 'nombre', 4, '1', 'unique', 1, NULL, 'La cible doit souffrir d''un saignement = Applique une marque qui oblige un double soin pour stopper le saignement. Dure tout le combat.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E96:AK98', '2 remède ou deux sorts de soin d''altération d''état sont nécessaire pour arrêter un saignement.', 'IC pour 3NM', 'Type : IC pour 3NM', '4 Sang', 'magies/magie-du-sang#specialisation:puissance');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage-dechirant', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Sang › E96:AK98');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage-dechirant', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › E96:AK98');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-dechirant', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:surtension-sanguine', 'magies/magie-du-sang', 'Surtension sanguine', 'surtension-sanguine', 5, 20, 'Attaque', 0, NULL, 0, 0, '45', 45, 'sang', 8, '8', 'nombre', 8, '1', 'unique', 1, '10d6 + 90 dégâts', 'Inflige de terribles dégâts. 
3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › E102:AK104', NULL, NULL, 'Effets : 3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2', '8 Sang', 'magies/magie-du-sang#specialisation:puissance');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:surtension-sanguine', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Sang › E102:AK104');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:surtension-sanguine', 'effets', 1, 'palier', '3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2', '3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › E102:AK104');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-sang#sort:surtension-sanguine', 'guide/liste-des-alterations-d-etat#etat:saignement', 'prend', 1, 2, 'effets', 'Saignement', '3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2.', 'magies', 'Nouveauté mise à jour Décembre › Sang › E102:AK104');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:surtension-sanguine', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:congestion', 'magies/magie-du-sang', 'Congestion', 'congestion', 3, 21, 'Amplification (IC pour 3 NM)', 0, 3, 0, 0, '8', 8, 'sang', NULL, '1', 'nombre', 1, '1', 'unique', 1, '+X dégâts', 'Augmente les dégâts infligés pendant 3 tours. 1 Sang = +1 dégât.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM75:BS77', NULL, 'IC pour 3 NM', 'Type : IC pour 3 NM', 'X Sang', 'magies/magie-du-sang#specialisation:sanguilonant');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:congestion', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM75:BS77');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:congestion', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM75:BS77');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:congestion', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:prise-de-sang', 'magies/magie-du-sang', 'Prise de sang', 'prise-de-sang', 4, 25, 'Attaque/Soin', 0, NULL, 0, 0, '20', 20, 'sang', 5, '3', 'nombre', 3, '1', 'unique', 1, '5d6 + 50 dégâts', 'Ce sort ne peut être fait que le lanceur est en dessous de 25% (50%/3NM) de santé. 25% des dégâts sont converti en santé.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM87:BS89', NULL, NULL, 'Effets : Ce sort ne peut être fait que le lanceur est en dessous de 25% (50%/3NM) de santé', '5 Sang', 'magies/magie-du-sang#specialisation:sanguilonant');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:prise-de-sang', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM87:BS89');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:prise-de-sang', 2, 'soin', 'Soin', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM87:BS89');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:prise-de-sang', 'effets', 1, 'par_nm', '50%/3NM', 'Ce sort ne peut être fait que le lanceur est en dessous de 25% (50%/3NM) de santé', '50%', NULL, 3, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM87:BS89');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:prise-de-sang', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-sang#sort:rage-de-guerre', 'magies/magie-du-sang', 'Rage de guerre', 'rage-de-guerre', 4, 27, 'Amplification', 0, NULL, 0, 0, '21 (-2/NM)', 21, 'sang', 5, '4', 'nombre', 4, '1', 'unique', 1, '+10 dégâts infligés et reçu, +1 vitesse', 'Inflige également l''état "Folle de guerre"  à la cible. Dure 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM93:BS95', NULL, NULL, 'Coût : -2/NM', '5 Sang', 'magies/magie-du-sang#specialisation:sanguilonant');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-sang#sort:rage-de-guerre', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Sang › AM93:BS95');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:rage-de-guerre', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Sang › AM93:BS95');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-sang#sort:rage-de-guerre', 'magies/magie-du-sang', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:courant-ecrasant', 'magies/magie-du-vent', 'Courant écrasant', 'courant-ecrasant', 4, 15, 'Attaque', 0, NULL, 0, 0, '23', 23, NULL, NULL, '7', 'nombre', 7, 'Carré de 9', 'carre', 9, '6d6 + 25 dégâts', 'Si jet de stabilité/réflexe raté = Divise par 2 la vitesse des cibles et clou au sol les créatures volante. Dure 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E83:AK85', NULL, NULL, NULL, NULL, 'magies/magie-du-vent#specialisation:tempete');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:courant-ecrasant', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vent › E83:AK85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:courant-ecrasant', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:catapulte-aerienne', 'magies/magie-du-vent', 'Catapulte aérienne', 'catapulte-aerienne', 4, 16, 'Placement', 0, NULL, 0, 0, '23 (-3/NM)', 23, NULL, NULL, '12', 'nombre', 12, '1', 'unique', 1, NULL, 'La cible est catapultée dans une direction et atterri sans encombre. ', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E86:AK88', NULL, NULL, 'Coût : -3/NM', NULL, 'magies/magie-du-vent#specialisation:tempete');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:catapulte-aerienne', 1, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Vent › E86:AK88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:catapulte-aerienne', 'cout', 1, 'par_nm', '-3/NM', '-3/NM', '-3', -3, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › E86:AK88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:catapulte-aerienne', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:onde-de-choc', 'magies/magie-du-vent', 'Onde de choc', 'onde-de-choc', 3, 22, 'Attaque', 0, NULL, 0, 0, '14', 14, NULL, NULL, '7', 'nombre', 7, 'La ligne entière', 'autre', NULL, '5d6 + 15 dégâts sonores', 'Envoi une attaque qui fait une ligne entière et touche toutes les cibles à l''intérieur.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM74:BS76', NULL, NULL, NULL, NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:onde-de-choc', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM74:BS76');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:onde-de-choc', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:grande-inspiration', 'magies/magie-du-vent', 'Grande inspiration', 'grande-inspiration', 3, 23, 'Amplification  (IC pour 3NM)', 0, 3, 0, 0, '14', 14, NULL, NULL, 'Soi même', 'soi', NULL, '1', 'unique', 1, '+10 dégâts', 'Augmente les dégâts sonores pendant 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM77:BS79', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:grande-inspiration', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:grande-inspiration', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM77:BS79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:grande-inspiration', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:infrason', 'magies/magie-du-vent', 'Infrason', 'infrason', 3, 24, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '12', 12, NULL, NULL, '3', 'nombre', 3, '1', 'unique', 1, NULL, 'La cible se retrouve dans l''incapacité de faire des réactions ou des attaques d''opportunité pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM80:BS82', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:infrason', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:infrason', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:infrason', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:sonar', 'magies/magie-du-vent', 'Sonar', 'sonar', 4, 27, 'Amplification  (IC pour 3NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, 'Insensible aux attaques discrète/
sournoise', 'Le bénéficiaire est capable de repérer des cibles à 20m même si elles sont cachés ou discrètes. Dure 3 tours. Annule les lignes de vue des sorts*.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM89:BS91', 'Ligne de vue : C''est le besoin de voir la cible pour la toucher dans la portée du sort. Ce sort permet d''attendre la cible malgré un obstacle. SAUF si cet obstacle ne possède pas de possibilité de faire passer le sort comme un mur sans trou.', 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:sonar', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:sonar', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:sonar', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:echo', 'magies/magie-du-vent', 'Écho', 'echo', 4, 28, 'Placement (IC)', 1, NULL, 0, 0, '22 (-2/NM)', 22, NULL, NULL, 'Variable', 'variable', NULL, '1', 'unique', 1, NULL, 'Le lanceur peut se téléporter selon le point le plus loin de la dernière attaque qui a fait des dégâts sonores.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM92:BS94', NULL, 'IC', 'Coût : -2/NM', NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:echo', 1, 'placement', 'Placement', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM92:BS94');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:echo', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM92:BS94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:echo', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM92:BS94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:echo', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vent#sort:silence-absolu', 'magies/magie-du-vent', 'Silence absolu', 'silence-absolu', 5, 29, 'Entrave', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '8', 'nombre', 8, '1', 'unique', 1, NULL, 'Place la cible dans un silence absolu pendant 24h. Elle ne peut plus lancer de sort niveau 5 et communiquer.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM95:BS97', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-du-vent#specialisation:son');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vent#sort:silence-absolu', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vent › AM95:BS97');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:silence-absolu', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vent › AM95:BS97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vent#sort:silence-absolu', 'magies/magie-du-vent', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:cadence-defensive', 'magies/magie-du-vide', 'Cadence défensive', 'cadence-defensive', 4, 15, 'Amplification  (IC pour 3NM)', 0, 3, 0, 0, '23', 23, NULL, NULL, '1', 'nombre', 1, '1', 'unique', 1, NULL, 'Permet d''avoir +1 jet de défense pour les postures Neutre, Symbiose et Vigilence. Augmente le coup critique de la posture Défense de 5. Dure 4 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E86:AK88', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vide#specialisation:esprit');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:cadence-defensive', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Vide › E86:AK88');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:cadence-defensive', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › E86:AK88');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:cadence-defensive', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:interieur-solide', 'magies/magie-du-vide', 'Intérieur solide', 'interieur-solide', 4, 17, 'Amplification (IC)', 1, NULL, 0, 0, '20', 20, NULL, NULL, 'Vue', 'vue', NULL, '1', 'unique', 1, NULL, 'Permet de résister à toute agression mentale. (3NM = Immunité au contrôle mental passif)', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E92:AK94', NULL, 'IC', 'Effets : 3NM = Immunité au contrôle mental passif', NULL, 'magies/magie-du-vide#specialisation:esprit');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:interieur-solide', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Vide › E92:AK94');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vide#sort:interieur-solide', 1, 'ic', 'IC', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E92:AK94');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:interieur-solide', 'effets', 1, 'palier', '3NM = Immunité au contrôle mental passif', '3NM = Immunité au contrôle mental passif', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › E92:AK94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:interieur-solide', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:leurre-de-rage', 'magies/magie-du-vide', 'Leurre de rage', 'leurre-de-rage', 4, 18, 'Attaque', 0, NULL, 0, 0, '23', 23, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '7d6 + 20 dégâts (+7/NM)', 'Inflige une frappe couplé à une moquerie.
Si jet fermeté raté = Inflige "Enragé 2"', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E95:AK97', NULL, NULL, 'D/S/B : +7/NM', NULL, 'magies/magie-du-vide#specialisation:esprit');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:leurre-de-rage', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › E95:AK97');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:leurre-de-rage', 'dsb', 1, 'par_nm', '+7/NM', '+7/NM', '+7', 7, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E95:AK97');
INSERT INTO sort_etat (sort_id, etat_id, relation, rang, stade, champ, forme_trouvee, extrait, origine, source_ref) VALUES ('magies/magie-du-vide#sort:leurre-de-rage', 'guide/liste-des-alterations-d-etat#etat:enrage', 'inflige', 1, 2, 'effets', 'Enragé', 'Si jet fermeté raté = Inflige "Enragé 2"', 'magies', 'Nouveauté mise à jour Décembre › Vide › E95:AK97');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:leurre-de-rage', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:regard-de-mora', 'magies/magie-du-vide', 'Regard de Mora', 'regard-de-mora', 5, 19, 'Amplification /Entrave', 0, NULL, 0, 0, '42', 42, NULL, NULL, 'Soi même', 'soi', NULL, 'Terrain', 'terrain', NULL, NULL, 'Permet d''imposer une règle au sein du champ de bataille parmis une liste* pendant 2 tours (+1/NM).', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E98:AK100', '- Les alliés infligent +5 dégâts et les ennemis -10.
- Les alliés ont +10% chances de réussir, les ennemis -20%
- Les ennemis ne peuvent plus sortir des zones d''influences d''eux mêmes
- Les ennemis perdent un niveau de puissance magique
- Banni les invocations et empêches les sorts d''invocations
- Détruit les sorts "Construction" sur le terrain et empêche ces sorts d''être utilisé
- Une fois pendant le Regard, si un allié fait des 1 dans les dés de dégâts, il peut les relancer.', NULL, 'Effets : Permet d''imposer une règle au sein du champ de bataille parmis une liste* pendant 2 tours (+1/NM)', NULL, 'magies/magie-du-vide#specialisation:esprit');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:regard-de-mora', 1, 'amplification', 'Amplification', 'magies', 'Nouveauté mise à jour Décembre › Vide › E98:AK100');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:regard-de-mora', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › E98:AK100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:regard-de-mora', 'effets', 1, 'par_nm', '+1/NM', 'Permet d''imposer une règle au sein du champ de bataille parmis une liste* pendant 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › E98:AK100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:regard-de-mora', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:suppression', 'magies/magie-du-vide', 'Suppression', 'suppression', 3, 22, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '15', 15, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, NULL, 'Retire toutes les amplifcation de la cible et elle ne peut pas bénéficier d''amplification pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM77:BS79', NULL, 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:suppression', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM77:BS79');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:suppression', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM77:BS79');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:suppression', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:fleche-du-rien', 'magies/magie-du-vide', 'Flèche du rien', 'fleche-du-rien', 3, 23, 'Attaque', 0, NULL, 0, 0, '14', 14, NULL, NULL, '4 (+1/NM)', 'nombre', 4, '1', 'unique', 1, '7d6 + 15 dégâts', 'Une lourde attaque du vide.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM80:BS82', NULL, NULL, 'Portée : +1/NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:fleche-du-rien', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM80:BS82');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:fleche-du-rien', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM80:BS82');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:fleche-du-rien', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:decret-de-represailles', 'magies/magie-du-vide', 'Décret de représailles', 'decret-de-represailles', 3, 24, 'Entrave', 0, NULL, 0, 0, '15', 15, NULL, NULL, '3 (+1/NM)', 'nombre', 3, '1', 'unique', 1, NULL, 'Si la cible fait un sort durant son tour, il prend 15 dégâts non élémentaire. Dure 3 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM83:BS85', NULL, NULL, 'Portée : +1/NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:decret-de-represailles', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM83:BS85');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:decret-de-represailles', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM83:BS85');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:decret-de-represailles', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:deni-de-classe', 'magies/magie-du-vide', 'Déni de classe', 'deni-de-classe', 4, 26, 'Entrave (IC pour 3NM)', 0, 3, 0, 0, '20', 20, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, NULL, 'La cible ne peut pas bénéficier de ses dons de classes pendant 2 tours.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM89:BS91', 'Ne retire pas le premier don niveau 10 des spécialisations', 'IC pour 3NM', 'Type : IC pour 3NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:deni-de-classe', 1, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM89:BS91');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:deni-de-classe', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM89:BS91');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:deni-de-classe', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:fissure-de-faiblesse', 'magies/magie-du-vide', 'Fissure de faiblesse', 'fissure-de-faiblesse', 4, 27, 'Attaque', 0, NULL, 0, 0, '23', 23, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '8d6 + 15 dégâts', 'Si jet fermeté raté = Annule les AM de base pendant 1 tour.', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM92:BS94', NULL, NULL, NULL, NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:fissure-de-faiblesse', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM92:BS94');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:fissure-de-faiblesse', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:etat-zero', 'magies/magie-du-vide', 'État zéro', 'etat-zero', 5, 29, 'Attaque/ Entrave', 0, NULL, 0, 0, '42', 42, NULL, NULL, 'Soi-même', 'soi', NULL, 'Terrain', 'terrain', NULL, '10d6 + 20 dégâts (+10/NM)', 'Indépendant de la défense : Supprime toutes les amplifications, entrave, protections, effets de sorts et constructions magiques dans la zone.', 'Que l’air lui-même se retire et que chaque souffle s’éteigne,
Que toute force s’évanouisse dans un néant sans fond,
Que les chants et incantations se brisent en silence,
Que la puissance des mages ne soit plus rien,
Et puisse l’univers se vider, jusqu’au dernier écho…

ÉTAT ZÉRO !', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM98:BS100; AU105:BK106, AU107:BK114', NULL, NULL, 'D/S/B : +10/NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:etat-zero', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM98:BS100');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:etat-zero', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM98:BS100');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:etat-zero', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM98:BS100');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:etat-zero', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min, imparable, inesquivable, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur, portee_brut, portee_nature, portee_valeur, zone_brut, zone_forme, zone_taille, dsb_brut, effets, texte_niveau5, origine, source_ref, remarque, mode_brut, bonus_maitrise, cout_secondaire, specialisation_id) VALUES ('magies/magie-du-vide#sort:extinction', 'magies/magie-du-vide', 'Extinction', 'extinction', 5, 30, 'Attaque/ Entrave', 0, NULL, 0, 0, '55 (-5/NM)', 55, NULL, NULL, '6', 'nombre', 6, '1', 'unique', 1, '10d6 + 70 dégâts', 'Si jet fermeté raté = Sous l''effet du sort "Silence"', NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM101:BS103', NULL, NULL, 'Coût : -5/NM', NULL, 'magies/magie-du-vide#specialisation:contestation');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:extinction', 1, 'attaque', 'Attaque', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM101:BS103');
INSERT INTO sort_type (sort_id, rang, type, libelle, origine, source_ref) VALUES ('magies/magie-du-vide#sort:extinction', 2, 'entrave', 'Entrave', 'magies', 'Nouveauté mise à jour Décembre › Vide › AM101:BS103');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:extinction', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Nouveauté mise à jour Décembre › Vide › AM101:BS103');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('sort', 'magies/magie-du-vide#sort:extinction', 'magies/magie-du-vide', 0, 'magies');
INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES ('magies/magie-de-larcane#sort:fer-brillant', 332);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 6. Notes de cellule des sorts : celles du classeur de Décembre (110) ; les fils de commentaires du V8 sont retirés, des notes et des remarques (R243 (2))
-- --------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM note_cellule WHERE entite_table = 'sort';
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:laser-noir', 1, 'effets', 'AC83', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:mine-noire', 1, 'effets', 'AC80', 'note', NULL, 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:petrole', 1, 'effets', 'AT69', 'note', NULL, 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT69');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-magique', 1, 'effets', 'BK98', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › BK98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-physique', 1, 'effets', 'BK101', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › BK101');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-simple', 1, 'effets', 'AT51', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouille-visible', 1, 'effets', 'AT54', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:colonne-tesla', 1, 'effets', 'AT57', 'note', NULL, 'Paratonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:dysfonctionnement', 1, 'effets', 'BK77', 'note', NULL, 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:fer-foudroyant', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être paralysé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:nerveux', 1, 'effets', 'AT45', 'note', NULL, 'II : Initiative individuelle
IG : Initiative groupée', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:plaque-miroir', 1, 'effets', 'BK74', 'note', NULL, 'Une plaque bloque qu''UN seul sort et disparaissent.

2 plaques à la fois maximum.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:rayonnement', 1, 'effets', 'AC98', 'note', NULL, 'BA = Barrière', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:repulsion-reflexe', 1, 'effets', 'BK86', 'note', NULL, 'Ne déclenche pas d''attaque d''opportunité sauf pour le bénéficiaire du sort.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:turbine', 1, 'dsb', 'Z92', 'note', NULL, 'CE = Charge électrique
CK = Chakra', 'magies', 'Nouveauté mise à jour Décembre › Foudre › Z92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:turbine', 2, 'effets', 'AC92', 'note', NULL, '1 seule charge par tour.
3 charges maximum cumulable

Une fois la ou les charges libérées, il faut relancer le sort pour recommencer', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:execution-froide', 1, 'effets', 'AC95', 'note', NULL, 'La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.', 'magies', 'Nouveauté mise à jour Décembre › Glace › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:fer-froid', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être gelé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Glace › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:gel-profond', 1, 'effets', 'BK77', 'note', NULL, 'L''allié sera aussi dispensé de jet de survie pendant cet état.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:lien-de-gel', 1, 'effets', 'AT60', 'note', NULL, '3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...', 'magies', 'Nouveauté mise à jour Décembre › Glace › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:mur-de-glace', 1, 'effets', 'BK80', 'note', NULL, 'Invoque un mur.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:prisme-protecteur', 1, 'effets', 'BK86', 'note', NULL, '*Met à 1 de santé et +20AM pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:sublimation', 1, 'effets', 'AC80', 'note', NULL, 'Un état de gel est comme retirer "gel 1". Donc par extension, "gel 2" correspond à 2 états de gel, etc.', 'magies', 'Nouveauté mise à jour Décembre › Glace › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:champ-de-force', 1, 'effets', 'AT42', 'note', NULL, 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 chakra maximum', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:condamnation-solaire', 1, 'effets', 'AC86', 'note', NULL, '*Dure 2 tours
80% de santé restante : +3 dégâts
60% de santé restante : +6 dégâts
40% de santé restante : +9 dégâts
20%  de santé restante : +12 dégâts', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:energie-solaire', 1, 'effets', 'AT57', 'note', NULL, '10% lors de neutre
20% lors de grand soleil.
25% lors de canicule.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:fer-lumineux', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:marque-du-champion', 1, 'effets', 'BK77', 'note', NULL, '*Prend en compte l''AM', 'magies', 'Nouveauté mise à jour Décembre › Lumière › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:mur-gamma', 1, 'effets', 'AC80', 'note', NULL, 'Les non-morts prennent 2 fois plus de dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:rai-solaire', 1, 'effets', 'AC92', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:revelation', 1, 'effets', 'AC83', 'note', NULL, 'Il se comporte comme un soleil vis à vis des créatures sensible à la lumière.

Le brouillard obscur bloque son effet.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 2, 'effets', 'AT45', 'note', NULL, 'Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:detection-de-vie', 1, 'effets', 'AT54', 'note', NULL, 'Ce sort permet de changer de vision et de voir la vie grouiller autour de soi, la vie se montre sous forme de petite brume, il est possible de détecter de l''humanoïde au simple brin d''herbe. 

Attention un simple mur empêche de voir à travers ce dernier.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:fer-toxique', 1, 'effets', 'AT69', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être empoisonné au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT69');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 1, 'effets', 'AC80', 'note', NULL, 'Cette arme est considérée comme Spectrale.
Arme Spectrale = Peut toucher l''immatériel et ignore 50% des AP.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:prison-dos', 1, 'effets', 'AC83', 'note', NULL, 'La prison d''os est Invulnérable à l''estoc, Résistant à la taille mais vulnérable à la frappe.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:resurrection-noir', 1, 'effets', 'AC104', 'note', NULL, 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC104');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:seigneur-des-morts', 1, 'effets', 'AC77', 'note', NULL, '- +10 dégâts
- +6 AP
- +6 AM
- +10% de réussite aux jets
- +2 Vitesse
- 20% de chance de forcer un jet de vigueur/fermeté pour ne pas prendre l''altération d''état de l''élément lié niveau 1 à chaque attaque de l''invocation.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:venin-corrosif', 1, 'effets', 'BK86', 'note', NULL, 'L''attaque en question ne détruira pas les armures ou arme comme pourrai le faire l''eau ou la terre.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:barriere-rocheuse', 1, 'effets', 'BK71', 'note', NULL, 'Si jamais un coup physiques ou magiques est encaisser par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK71');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:corps-de-maverium', 1, 'effets', 'BK95', 'note', NULL, 'Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:fer-raffine', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être pétrifié au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Terre › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:floraison-carnivore', 1, 'effets', 'AC98', 'note', NULL, 'Prend 2 fois plus de dégâts des sorts de feu ou de sang.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:frappe-racine', 1, 'effets', 'AC74', 'note', NULL, 'Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:petale-bouclier', 1, 'effets', 'AC89', 'note', NULL, '*Met à 1 de santé et +20AP pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:racine-soignante', 1, 'effets', 'AT48', 'note', NULL, 'L''environnement doit être majoritairement de Montagne, Forêt, Plaine, Caverne.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:sable-changeant', 1, 'effets', 'BK77', 'note', NULL, 'Le Terrain sable divise par 2 le déplacement, empêche le sprint et fait perdre un tour si jamais on saute.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:terre-maudite', 1, 'effets', 'AC95', 'note', NULL, 'La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:charge-denergie', 1, 'effets', 'AT48', 'note', NULL, '30 chakra maximum en 1 fois', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:forge-magie', 1, 'effets', 'AT57', 'note', NULL, 'Exemple : 

Un caillou c''est taille 1
Une dague c''est taille 2

Les bombes ne font pas les dégâts de zone.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:laser-de-chakra', 1, 'effets', 'BK83', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › BK83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:pate-de-la-trame', 1, 'effets', 'AC104', 'note', NULL, '*
- +15 dégâts magiques
- +3 portée avec les sorts
- +1 portée d''une zone
- Le CC d''une attaque oblige le jet de vigueur/fermeté pour ne pas prendre l''altération d''état lié au niveau 1', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC104');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:pillage-defensif', 1, 'effets', 'BK86', 'note', NULL, 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:projectile-arcanique', 1, 'effets', 'AC83', 'note', NULL, 'L''AM est pris en compte pour chaque projectile.

*Le coût augmente de 1 à chaque projectile envoyé sur l''action (le premier coute 4, le second coute 5, etc)
', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane', 1, 'effets', 'AT51', 'note', NULL, 'Ne se cumule avec "Rune Arcane multiple"', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane-multiple', 1, 'effets', 'AC86', 'note', NULL, 'Ne se cumule avec "Rune Arcane"', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:courant-salvateur', 1, 'effets', 'AC79', 'note', NULL, 'Ne déclenche pas d''attaques d''opportunités

Soigne les alliés de 2d6 si un point d''eau est à 4 cases.', 'magies', 'Nouveauté mise à jour Décembre › Eau › AC79');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:fer-humide', 1, 'effets', 'AT50', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être confus au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Eau › AT50');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:larmes-doceane', 1, 'effets', 'BK94', 'note', NULL, 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatosceptique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.', 'magies', 'Nouveauté mise à jour Décembre › Eau › BK94');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:laser-hydraulique', 1, 'effets', 'BK82', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Eau › BK82');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:celerite', 1, 'effets', 'BK86', 'note', NULL, 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:distorsion', 1, 'effets', 'AC101', 'note', NULL, 'Perdre le tour ne signifie pas perdre sa posture.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC101');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:etat-anterieur', 1, 'effets', 'BK74', 'note', NULL, 'Pour les armures, il faut faire le sort sur CHAQUE morceau.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:fer-temporel', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être fatigué au stade 1', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:frappe-temporelle', 1, 'effets', 'AT66', 'note', NULL, 'Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:grenade-distordue', 1, 'effets', 'AC89', 'note', NULL, 'Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:horloge-aspirante', 1, 'effets', 'BK83', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:image-diffuse', 1, 'effets', 'AC95', 'note', NULL, 'Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.
Si un clone prend un coup, il disparait.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:inversion', 1, 'effets', 'AT63', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contré par "Téléportation"', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:portail', 1, 'effets', 'AT45', 'note', NULL, 'Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du chakra.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:teleportation', 1, 'effets', 'AT42', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Ce sort permet également de contrer les ennemis qui voudraient se téléporter, pour que ça marche : il est nécessaire d’avoir le sort, de sacrifier une parade/esquive, de réussir un meilleur jet et que l’ennemi soit dans la portée du sort.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:amplification-sombre', 1, 'effets', 'AC77', 'note', NULL, 'EC = Échec critique', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:chaine-de-lentrave', 1, 'effets', 'AC95', 'note', NULL, 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :
1re tentative : Réussite divisée par 2
2e tentative : Réussite divisée par 1.5
3e tentative : Réussite divisée par 1.25
4e tentative : Score normal

Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:defaite-annoncee', 1, 'effets', 'AC89', 'note', NULL, 'Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:fer-obscur', 1, 'effets', 'AT63', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Peur au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:frappe-negative', 1, 'effets', 'AC98', 'note', NULL, 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:lame-dombre', 1, 'effets', 'AT57', 'note', NULL, 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:marionnette-de-lombre', 1, 'effets', 'AT42', 'note', NULL, 'Sort interdit aux familiers et aux invocations.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:ombre-menacante', 1, 'effets', 'BK80', 'note', NULL, 'L''ombre reste 3 tours.

Le jet de fermeté se relance tous les débuts de tour.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:pichenette', 1, 'effets', 'AT48', 'note', NULL, 'II : Initiative individuelle
IG : Initiative groupée', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:pire-ami', 1, 'effets', 'BK92', 'note', NULL, 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:aspect-cendreuse', 1, 'effets', 'BK77', 'note', NULL, 'L''insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. Prendre un coup physique annule cet état.', 'magies', 'Nouveauté mise à jour Décembre › Feu › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:fer-brulant', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, inflige brûlure au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Feu › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:forteresse-escarbille', 1, 'effets', 'BK98', 'note', NULL, '*Force le jet de vigueur à un agresseur pour ne pas qu''il prenne "brûlure 2"', 'magies', 'Nouveauté mise à jour Décembre › Feu › BK98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:rayon-de-fusion', 1, 'effets', 'AC92', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Feu › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:annulation', 1, 'effets', 'AT49', 'note', NULL, '- Inutile contre les infirmités, la fatigue physique, les croix.
- Ne marche pas sur les effets magie niveau 3 ou plus
- Soigne d''un cran les altérations d''états.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT49');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:attirance', 1, 'effets', 'AT52', 'note', NULL, 'Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C''est le lanceur qui est attiré.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT52');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:coagulation', 1, 'effets', 'BK81', 'note', NULL, 'Le mur est fixé au sol.', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK81');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:fer-sanglant', 1, 'effets', 'AT58', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Saignement au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT58');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-dechirant', 1, 'effets', 'AC96', 'note', NULL, '2 remède ou deux sorts de soin d''altération d''état sont nécessaire pour arrêter un saignement.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC96');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-surcharge', 1, 'effets', 'AC78', 'note', NULL, 'Ignore les défenses.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC78');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:morsure-aspirante', 1, 'effets', 'BK78', 'note', NULL, 'Ne marche pas si c''est la barrière qui encaisse le coup', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK78');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:proportion-demesuree', 1, 'effets', 'BK99', 'note', NULL, 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 6 de force temporairement)', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK99');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:renfermement', 1, 'effets', 'BK84', 'note', NULL, 'Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK84');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:saignee-forcee', 1, 'effets', 'AC75', 'note', NULL, 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC75');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:fer-eolien', 1, 'effets', 'AT57', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être sourd au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:feuille-morte', 1, 'effets', 'AT60', 'note', NULL, 'Maximum 30m', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:propulsion', 1, 'effets', 'AT48', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:recul-force', 1, 'effets', 'AT63', 'note', NULL, 'Sans NM dedans, le sort ne peut pas reculé une cible grande. Et c''est maximum 1 pour cette même cible.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:sonar', 1, 'effets', 'BK89', 'note', NULL, 'Ligne de vue : C''est le besoin de voir la cible pour la toucher dans la portée du sort. Ce sort permet d''attendre la cible malgré un obstacle. SAUF si cet obstacle ne possède pas de possibilité de faire passer le sort comme un mur sans trou.', 'magies', 'Nouveauté mise à jour Décembre › Vent › BK89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:alea-negatif', 1, 'effets', 'BK86', 'note', NULL, '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.

RIEN N''EST ESQUIVABLE

1 : Inflige *saignement 1
2 : Met une croix en Force pour 1 tour
3 : Inflige *poison 1
4 : Oblige un jet de vigueur ou fermeté (le meilleur), si raté : Perd le tour
5 : Inflige *brûlure 1
6 : Met une croix en Perception pour 1 tour
7 : Inflige le sort de l''ombre "Malédiction" pour 1 tour
8 : Inflige *surdité 1
9 : Inflige *paralysie 1
10 : Met une croix en Volonté pour 1 tour
11 : Inflige *surcharge magique 1
12 : Inflige *peur 1
13 : Inflige *aveuglement 1
14 : Met une croix en Intelligence pour 1 tour
15 : Inflige *enragé 1
16 : Inflige gel 1
17 : Inflige confusion 1
18 : Met une croix en Agilité pour 1 tour
19 : Retire tous les effets positifs de la cible
20 : Inflige couardise', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:aspect-vide', 1, 'effets', 'AC74', 'note', NULL, 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:deni-de-classe', 1, 'effets', 'BK89', 'note', NULL, 'Ne retire pas le premier don niveau 10 des spécialisations', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:dissipation', 1, 'effets', 'AT66', 'note', NULL, '- Ne marche pas sur les effets magie niveau 4 ou plus
- Inutile contre les infirmités, la fatigue physique, les croix.
- Soigne d''un cran les altérations d''états.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:fer-vide', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Rage au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:poing-du-vide', 1, 'effets', 'AT60', 'note', NULL, 'La cible est attirée d''une case seulement si elle rate totalement son jet de défense ou si elle est dans l''incapacité de se défendre.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:regard-de-mora', 1, 'effets', 'AC98', 'note', NULL, '- Les alliés infligent +5 dégâts et les ennemis -10.
- Les alliés ont +10% chances de réussir, les ennemis -20%
- Les ennemis ne peuvent plus sortir des zones d''influences d''eux mêmes
- Les ennemis perdent un niveau de puissance magique
- Banni les invocations et empêches les sorts d''invocations
- Détruit les sorts "Construction" sur le terrain et empêche ces sorts d''être utilisé
- Une fois pendant le Regard, si un allié fait des 1 dans les dés de dégâts, il peut les relancer.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:sablier-du-vide', 1, 'effets', 'BK74', 'note', NULL, 'Les ennemis peuvent se défendre contre le coup du sablier.', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:telekinesie', 1, 'effets', 'AT42', 'note', NULL, 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:touche-du-vide', 1, 'effets', 'AC83', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC83');

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 7. Magies : 2 champs du classeur (R237 (1)), provenance ; rôles supprimés (R237 (7)) ; résistances et Mode Hyper de l'onglet citent leurs nouvelles cellules
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE magie SET explication = 'Le principal intérêt repose sur sa versatilité, en effet cette magie pioche ses sorts dans toutes les magies existantes. Cette versatilité a un prix qui est de ne pouvoir atteindre que le niveau 3 de puissance magique maximum en plus d''être limité à peu de races.
- Humain, Nain, Elfe argenté, Forestier, Noir, Doré, Farfadet, Felfe, Hujin et Drakos sont les seuls qui peuvent l''avoir.
- Mono-magie uniquement.
- Classe unique = Archimage.
- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).
- État fatigue 1 en permanence (sans le malus aux dégâts).
- Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet.', source_ref = 'Nouveauté mise à jour Décembre › Potentiel illimité (magie diffi › A4:AJ12, A17:AJ21, A25, A26:AJ34, H39:K40, R39:U40, AC39:AJ40, Y1:AH2' WHERE id = 'magies/potentiel-illimite';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Potentiel illimité (magie diffi › A57, H57:AJ58' WHERE id = 'onglet_magie:magies/potentiel-illimite:forme_complete';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Sang › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8, AU9:BW10' WHERE id = 'magies/magie-du-sang';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Sang › BE24:BI25' WHERE magie_id = 'magies/magie-du-sang' AND autre_magie_id = 'magies/magie-de-la-corruption';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Sang › BJ24:BN25' WHERE magie_id = 'magies/magie-du-sang' AND autre_magie_id = 'magies/magie-de-la-necromancie';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AU24:AY25' WHERE magie_id = 'magies/magie-du-sang' AND autre_magie_id = 'magies/magie-de-larcane';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AZ24:BD25' WHERE magie_id = 'magies/magie-du-sang' AND autre_magie_id = 'magies/magie-de-lespace-temps';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AU12:AY13' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AZ12:BD13' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › BE12:BI13' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AU15:AY16' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AZ15:BD16' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › BE15:BI16' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AU18:AY19' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AZ18:BD19' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AU21:AY22' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AZ21:BD22' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AN30, AU30:BW32' WHERE id = 'onglet_magie:magies/magie-du-sang:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Sang › AN33, AU33:BW35' WHERE id = 'onglet_magie:magies/magie-du-sang:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › A7:AJ15, A20:AJ24, A29:AJ40, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-larcane';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › BE22:BI23' WHERE magie_id = 'magies/magie-de-larcane' AND autre_magie_id = 'magies/magie-de-la-corruption';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AZ22:BD23' WHERE magie_id = 'magies/magie-de-larcane' AND autre_magie_id = 'magies/magie-de-lespace-temps';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AU22:AY23' WHERE magie_id = 'magies/magie-de-larcane' AND autre_magie_id = 'magies/magie-du-sang';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AU10:AY11' WHERE magie_id = 'magies/magie-de-larcane' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AU13:AY14' WHERE magie_id = 'magies/magie-de-larcane' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-larcane:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AN32, AU32:BW34' WHERE id = 'onglet_magie:magies/magie-de-larcane:bi';
UPDATE magie SET description = 'La magie de la Corruption est l''ombre de l’Arcane, une énergie négative qui ne connaît ni faiblesse ni résistance. Semblable à l''Arcane, elle se manifeste sous une forme brute et malléable, mais son essence est pervertie par une volonté malveillante qui cherche à affaiblir, entraver et tuer. Contrairement aux autres formes de magie, la Corruption ne se mélange à aucune autre : elle est une entité à part entière qui refuse toute fusion, sauf entre les mains des Elfes Charbons et des Felfes Noirs, qui possèdent un lien et une histoire avec elle.

Tout comme la magie de l’Arcane, la Corruption offre une grande polyvalence, permettant à ses utilisateurs de s’adapter à toutes les situations. Mais là où l’Arcane façonne et construit, la Corruption érode et consume. Ses adeptes sont craints non pas pour leur force brute, mais pour leur capacité à manipuler l’affaiblissement et le désespoir. Ils sont perçus comme des combattants impitoyables et méthodiques, préférant saper leurs ennemis de l’intérieur plutôt que d’engager un combat frontal.', source_ref = 'Nouveauté mise à jour Décembre › Corruption › A7:AJ15, A20:AJ24, A29:AJ40, AU7:AX8, BE7:BH8, BP7:BW8, AU22' WHERE id = 'magies/magie-de-la-corruption';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AU10:AY11' WHERE magie_id = 'magies/magie-de-la-corruption' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-corruption' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AN30, AU30:BW32' WHERE id = 'onglet_magie:magies/magie-de-la-corruption:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Corruption › AN33, AU33:BW35' WHERE id = 'onglet_magie:magies/magie-de-la-corruption:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8', onglet = 'EspaceTemps' WHERE id = 'magies/magie-de-lespace-temps';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › BE22:BI23' WHERE magie_id = 'magies/magie-de-lespace-temps' AND autre_magie_id = 'magies/magie-de-la-corruption';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AZ22:BD23' WHERE magie_id = 'magies/magie-de-lespace-temps' AND autre_magie_id = 'magies/magie-de-larcane';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AU22:AY23' WHERE magie_id = 'magies/magie-de-lespace-temps' AND autre_magie_id = 'magies/magie-du-sang';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › BJ22:BN23' WHERE magie_id = 'magies/magie-de-lespace-temps' AND autre_magie_id = 'magies/magie-du-vide';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AU10:AY11' WHERE magie_id = 'magies/magie-de-lespace-temps' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AU13:AY14' WHERE magie_id = 'magies/magie-de-lespace-temps' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AU16:AY17' WHERE magie_id = 'magies/magie-de-lespace-temps' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AU19:AY20' WHERE magie_id = 'magies/magie-de-lespace-temps' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-lespace-temps:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › EspaceTemps › AN32, AU32:BW34' WHERE id = 'onglet_magie:magies/magie-de-lespace-temps:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Vide › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-du-vide';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AU22:AY23' WHERE magie_id = 'magies/magie-du-vide' AND autre_magie_id = 'magies/magie-de-lespace-temps';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AU10:AY11' WHERE magie_id = 'magies/magie-du-vide' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AU13:AY14' WHERE magie_id = 'magies/magie-du-vide' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AU16:AY17' WHERE magie_id = 'magies/magie-du-vide' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AU19:AY20' WHERE magie_id = 'magies/magie-du-vide' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-du-vide:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Vide › AN32, AU32:BW34' WHERE id = 'onglet_magie:magies/magie-du-vide:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8, AU10:BW11' WHERE id = 'magies/magie-de-la-necromancie';
UPDATE magie_incompatibilite SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AU25:AY26' WHERE magie_id = 'magies/magie-de-la-necromancie' AND autre_magie_id = 'magies/magie-du-sang';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AZ13:BD14' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › BE13:BI14' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AU16:AY17' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AZ16:BD17' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › BE16:BI17' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AU19:AY20' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AZ19:BD20' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AU22:AY23' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AZ22:BD23' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AN32, AU32:BW34' WHERE id = 'onglet_magie:magies/magie-de-la-necromancie:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Nécromancie › AN35, AU35:BW37' WHERE id = 'onglet_magie:magies/magie-de-la-necromancie:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Feu › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-du-feu';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AU10:AY11' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AZ10:BD11' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › BE10:BI11' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AU13:AY14' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AZ13:BD14' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › BE13:BI14' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AU16:AY17' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AZ16:BD17' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AU19:AY20' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AZ19:BD20' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-du-feu:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Feu › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-du-feu:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Eau › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-leau';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AU10:AY11' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AZ10:BD11' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › BE10:BI11' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AU13:AY14' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AZ13:BD14' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › BE13:BI14' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AU16:AY17' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AZ16:BD17' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AU19:AY20' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AZ19:BD20' WHERE magie_id = 'magies/magie-de-leau' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AN25, AU25:BW27' WHERE id = 'onglet_magie:magies/magie-de-leau:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Eau › AN28, AU28:BW30' WHERE id = 'onglet_magie:magies/magie-de-leau:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Glace › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-la-glace';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AU10:AY11' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AZ10:BD11' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › BE10:BI11' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AZ13:BD14' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › BE13:BI14' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AU16:AY17' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AZ16:BD17' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AU19:AY20' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AZ19:BD20' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-de-la-glace:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Glace › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-la-glace:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Terre › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-la-terre';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AU10:AY11' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AZ10:BD11' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › BE10:BI11' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AZ13:BD14' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › BE13:BI14' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AU16:AY17' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AZ16:BD17' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AU19:AY20' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AZ19:BD20' WHERE magie_id = 'magies/magie-de-la-terre' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-de-la-terre:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Terre › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-la-terre:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Vent › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-du-vent';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AU10:AY11' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AZ10:BD11' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › BE10:BI11' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AU13:AY14' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AZ13:BD14' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › BE13:BI14' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AU16:AY17' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AZ16:BD17' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AU19:AY20' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AZ19:BD20' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-du-vent:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Vent › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-du-vent:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-la-foudre';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AU10:AY11' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AZ10:BD11' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › BE10:BI11' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AZ13:BD14' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › BE13:BI14' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AU16:AY17' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AZ16:BD17' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 2;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AU19:AY20' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AZ19:BD20' WHERE magie_id = 'magies/magie-de-la-foudre' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 2;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-de-la-foudre:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Foudre › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-la-foudre:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-la-lumiere';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AU10:AY11' WHERE magie_id = 'magies/magie-de-la-lumiere' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AU13:AY14' WHERE magie_id = 'magies/magie-de-la-lumiere' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AU16:AY17' WHERE magie_id = 'magies/magie-de-la-lumiere' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AU19:AY20' WHERE magie_id = 'magies/magie-de-la-lumiere' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-de-la-lumiere:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Lumière › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-la-lumiere:bi';
UPDATE magie SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › A7:AJ15, A20:AJ24, AU7:AX8, BE7:BH8, BP7:BW8' WHERE id = 'magies/magie-de-lombre';
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AU10:AY11' WHERE magie_id = 'magies/magie-de-lombre' AND sens = 'resistance' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AU13:AY14' WHERE magie_id = 'magies/magie-de-lombre' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AU16:AY17' WHERE magie_id = 'magies/magie-de-lombre' AND sens = 'vulnerabilite' AND cible_type = 'magie' AND rang = 1;
UPDATE magie_resistance SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AU19:AY20' WHERE magie_id = 'magies/magie-de-lombre' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1;
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AN26, AU26:BW28' WHERE id = 'onglet_magie:magies/magie-de-lombre:mono';
UPDATE mode_hyper_effet SET source_ref = 'Nouveauté mise à jour Décembre › Ombre › AN29, AU29:BW31' WHERE id = 'onglet_magie:magies/magie-de-lombre:bi';
DELETE FROM magie_role;
UPDATE legende_sort SET source_ref = 'Nouveauté mise à jour Décembre › Arcane › AT59' WHERE code = 'NM';

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 8. Règle de magie « CHOSES A SAVOIR » (Sommaire AP1, R236) : cellule entière, coquilles corrigées par tools/sheets/corrections.json (R10)
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO regle_magie (id, titre, niveau_sort, texte, origine, source_ref) VALUES ('magies#regle:choses-a-savoir', 'CHOSES A SAVOIR', NULL, 'CHOSES A SAVOIR

Ceci est une version en test des nouvelles magies, vous allez assez vite comprendre qu''il va exister ce qu''on peut appeler des spécialisations magiques, nous allons prendre le temps d''expliquer.

- Les spécialisations magiques sont débloquables dès le niveau 3 de puissance magique.

- Seuls les bi-magie doivent faire un choix de chemin, les mono-magie ont accès aux deux spécialisations.

- A partir du niveau 8 global, si les personnages ont toujours mono-magie, leur magie est dans un état de "Super-magie" ce qui leur permet de débloquer les emplacements de sort de la magie acquise.

- Vu que c''est une bêta, il peut y avoir des trucs trop forts, pas assez clairs, trop faibles. N''hésitez pas à faire un retour, un salon sera dédié au retour ou aux questions.', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 9. Altérations d'état : Somnolence (R237 (1), (10) : ni remède ni panacée), stades 3 de la Paralysie et de la Surdité ; météos Saccage temporel et Zone vide supprimées (R237 (7))
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE etat SET ordre = ordre + 1000;
UPDATE etat SET ordre = 1, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A3:AV7' WHERE id = 'guide/liste-des-alterations-d-etat#etat:aveuglement';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E3' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › E3';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M3:V7' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › M3:V7';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W3:AF7' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › W3:AF7';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG3:AP7' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AG3:AP7';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ7:AV7' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ7:AV7';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ4:AV4' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ4:AV4';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ6:AV6' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ6:AV6';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ3:AV3' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ3:AV3';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ5:AV5' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aveuglement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ5:AV5';
UPDATE etat SET ordre = 2, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A8:AV12' WHERE id = 'guide/liste-des-alterations-d-etat#etat:brulure';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E8' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › E8';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M8:V12' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › M8:V12';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W8:AF12' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › W8:AF12';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG8:AP12' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AG8:AP12';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ12:AV12' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ12:AV12';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ9:AV9' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ9:AV9';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ11:AV11' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ11:AV11';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ8:AV8' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ8:AV8';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ10:AV10' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:brulure' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ10:AV10';
UPDATE etat SET ordre = 3, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A13:AV17' WHERE id = 'guide/liste-des-alterations-d-etat#etat:confusion';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E13' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › E13';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M13:V17' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › M13:V17';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W13:AF17' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › W13:AF17';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG13:AP17' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AG13:AP17';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ17:AV17' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ17:AV17';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ14:AV14' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ14:AV14';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ16:AV16' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ16:AV16';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ13:AV13' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ13:AV13';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ15:AV15' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:confusion' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ15:AV15';
UPDATE etat SET ordre = 4, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A18:AV22' WHERE id = 'guide/liste-des-alterations-d-etat#etat:enrage';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E18' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › E18';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M18:V22' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › M18:V22';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W18:AF22' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › W18:AF22';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG18:AP22' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AG18:AP22';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ22:AV22' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ22:AV22';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ19:AV19' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ19:AV19';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ21:AV21' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ21:AV21';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ18:AV18' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ18:AV18';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ20:AV20' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enrage' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ20:AV20';
UPDATE etat SET ordre = 5, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A23:AV27' WHERE id = 'guide/liste-des-alterations-d-etat#etat:fatigue';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E23' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › E23';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M23:V27' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › M23:V27';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W23:AF27' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › W23:AF27';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG23:AP27' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AG23:AP27';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ27:AV27' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ27:AV27';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ24:AV24' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ24:AV24';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ26:AV26' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ26:AV26';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ23:AV23' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ23:AV23';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ25:AV25' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:fatigue' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ25:AV25';
UPDATE etat SET ordre = 6, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A28:AV32' WHERE id = 'guide/liste-des-alterations-d-etat#etat:gel';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E28' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › E28';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M28:V32' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › M28:V32';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W28:AF32' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › W28:AF32';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG28:AP32' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AG28:AP32';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ32:AV32' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ32:AV32';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ29:AV29' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ29:AV29';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ31:AV31' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ31:AV31';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ28:AV28' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ28:AV28';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ30:AV30' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:gel' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ30:AV30';
UPDATE etat SET ordre = 7, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A33:AV37' WHERE id = 'guide/liste-des-alterations-d-etat#etat:paralysie';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E33' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › E33';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M33:V37' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › M33:V37';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W33:AF37' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › W33:AF37';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG33:AP37' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AG33:AP37';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ37:AV37' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ37:AV37';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ34:AV34' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ34:AV34';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ36:AV36' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ36:AV36';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ33:AV33' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ33:AV33';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ35:AV35' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ35:AV35';
UPDATE etat SET ordre = 8, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A38:AV42' WHERE id = 'guide/liste-des-alterations-d-etat#etat:peur';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E38' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › E38';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M38:V42' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › M38:V42';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W38:AF42' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › W38:AF42';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG38:AP42' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AG38:AP42';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ42:AV42' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ42:AV42';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ39:AV39' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ39:AV39';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ41:AV41' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ41:AV41';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ38:AV38' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ38:AV38';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ40:AV40' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:peur' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ40:AV40';
UPDATE etat SET ordre = 9, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A43:AV47' WHERE id = 'guide/liste-des-alterations-d-etat#etat:petrifie';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E43' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › E43';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M43:V47' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › M43:V47';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W43:AF47' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › W43:AF47';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG43:AP47' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AG43:AP47';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ47:AV47' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ47:AV47';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ44:AV44' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ44:AV44';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ46:AV46' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ46:AV46';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ43:AV43' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ43:AV43';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ45:AV45' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:petrifie' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ45:AV45';
UPDATE etat SET ordre = 10, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A48:AV52' WHERE id = 'guide/liste-des-alterations-d-etat#etat:poison';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E48' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › E48';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M48:V52' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › M48:V52';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W48:AF52' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › W48:AF52';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG48:AP52' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AG48:AP52';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ52:AV52' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ52:AV52';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ49:AV49' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ49:AV49';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ51:AV51' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ51:AV51';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ48:AV48' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ48:AV48';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ50:AV50' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:poison' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ50:AV50';
UPDATE etat SET ordre = 11, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A53:AV57' WHERE id = 'guide/liste-des-alterations-d-etat#etat:saignement';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E53' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › E53';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M53:V57' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › M53:V57';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W53:AF57' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › W53:AF57';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG53:AP57' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AG53:AP57';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ57:AV57' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ57:AV57';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ54:AV54' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ54:AV54';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ56:AV56' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ56:AV56';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ53:AV53' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ53:AV53';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ55:AV55' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:saignement' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ55:AV55';
UPDATE etat SET ordre = 13, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A63:AV67' WHERE id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E63' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › E58';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M63:V67' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › M58:V62';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W63:AF67' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › W58:AF62';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG63:AP67' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AG58:AP62';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ67:AV67' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ62:AV62';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ64:AV64' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ59:AV59';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ66:AV66' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ61:AV61';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ63:AV63' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ58:AV58';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ65:AV65' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surcharge-magique' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ60:AV60';
UPDATE etat SET ordre = 14, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A68:AV72' WHERE id = 'guide/liste-des-alterations-d-etat#etat:surdite';
UPDATE etat_magie SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › E68' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › E63';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M68:V72' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › M63:V67';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W68:AF72' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › W63:AF67';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG68:AP72' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AG63:AP67';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ72:AV72' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ67:AV67';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ69:AV69' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ64:AV64';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ71:AV71' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ66:AV66';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ68:AV68' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ63:AV63';
UPDATE etat_palier SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AQ70:AV70' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND source_ref = 'Magie Maverick V8 › Altération détats › AQ65:AV65';
UPDATE etat SET ordre = 15, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A73:AV77' WHERE id = 'guide/liste-des-alterations-d-etat#etat:aggripe';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M73:AP77' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:aggripe' AND source_ref = 'Magie Maverick V8 › Altération détats › M68:AP72';
UPDATE etat SET ordre = 16, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A78:AV82' WHERE id = 'guide/liste-des-alterations-d-etat#etat:coma';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M78:V82' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:coma' AND source_ref = 'Magie Maverick V8 › Altération détats › M73:V77';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › W78:AF82' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:coma' AND source_ref = 'Magie Maverick V8 › Altération détats › W73:AF77';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › AG78:AP82' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:coma' AND source_ref = 'Magie Maverick V8 › Altération détats › AG73:AP77';
UPDATE etat SET ordre = 17, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A83:AV87' WHERE id = 'guide/liste-des-alterations-d-etat#etat:couardise';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M83:AP87' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:couardise' AND source_ref = 'Magie Maverick V8 › Altération détats › M78:AP82';
UPDATE etat SET ordre = 18, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A88:AV92' WHERE id = 'guide/liste-des-alterations-d-etat#etat:enchevetre';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M88:AP92' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:enchevetre' AND source_ref = 'Magie Maverick V8 › Altération détats › M83:AP87';
UPDATE etat SET ordre = 19, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A93:AV97' WHERE id = 'guide/liste-des-alterations-d-etat#etat:etourdi';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M93:AP97' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:etourdi' AND source_ref = 'Magie Maverick V8 › Altération détats › M88:AP92';
UPDATE etat SET ordre = 20, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A98:AV102' WHERE id = 'guide/liste-des-alterations-d-etat#etat:folle-de-guerre';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M98:AP102' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:folle-de-guerre' AND source_ref = 'Magie Maverick V8 › Altération détats › M93:AP97';
UPDATE etat SET ordre = 21, source_ref = 'Nouveauté mise à jour Décembre › Altération détats › A103:AV107' WHERE id = 'guide/liste-des-alterations-d-etat#etat:sans-defense';
UPDATE etat_stade SET source_ref = 'Nouveauté mise à jour Décembre › Altération détats › M103:AP107' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:sans-defense' AND source_ref = 'Magie Maverick V8 › Altération détats › M98:AP102';
UPDATE etat_stade SET effet = '- Un jet de Vigueur est nécessaire pour ne pas perdre 1 Tour.
-  Vitesse divisée par 2.
- Force à jouer en dernier le tour
Dure 4 Tours.' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:paralysie' AND rang = 3;
UPDATE etat_stade SET effet = '- Malus de 30% aux compétences : Athlétisme, Équilibre, Stabilité, Reflexe, Distinction, Orientation.
- Un placement sur la victime fait qu''elle tombera toujours par terre juste après.
- Dure 3 Tours.' WHERE etat_id = 'guide/liste-des-alterations-d-etat#etat:surdite' AND rang = 3;
INSERT INTO etat (id, nom, ordre, type, type_brut, magie_liee_brut, origine, source_ref, remarque) VALUES ('guide/liste-des-alterations-d-etat#etat:somnolence', 'Somnolence', 12, 'mental', 'Mental', 'Ombre (Songe)', 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › A58:AP62', NULL);
INSERT INTO etat_magie (etat_id, magie_id, rang, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:somnolence', 'magies/magie-de-lombre', 1, 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › E58');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:somnolence', 1, 1, '- Malus de 5 à tout les dégâts
- Malus de 5% au jet de Force et Agilité
- Bonus de 5% aux jets de Volonté

Dure 3 tours', 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › M58:V62');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:somnolence', 2, 2, '- Malus de 7 à tout les dégâts
- Malus de 10% au jet de Force et Agilité
- Bonus de 10% aux jets de Volonté

Dure 3 tours', 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › W58:AF62');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:somnolence', 3, 3, '- Malus de 10 à tout les dégâts
- Malus de 15% au jet de Force et Agilité
- Bonus de 15% aux jets de Volonté

Dure 3 tours', 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › AG58:AP62');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('etat', 'guide/liste-des-alterations-d-etat#etat:somnolence', 'guide/liste-des-alterations-d-etat', 0, 'annexes');
DELETE FROM meteo_effet WHERE meteo_id IN ('guide/meteo#meteo:saccage-temporel', 'guide/meteo#meteo:zone-vide');
DELETE FROM page_entite WHERE entite_table = 'meteo' AND entite_id IN ('guide/meteo#meteo:saccage-temporel', 'guide/meteo#meteo:zone-vide');
DELETE FROM meteo WHERE id IN ('guide/meteo#meteo:saccage-temporel', 'guide/meteo#meteo:zone-vide');
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B2:T8' WHERE id = 'guide/meteo#meteo:normal';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:normal';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B9:T15' WHERE id = 'guide/meteo#meteo:grand-soleil';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:grand-soleil';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B16:T22' WHERE id = 'guide/meteo#meteo:canicule';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:canicule';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B23:T29' WHERE id = 'guide/meteo#meteo:pluie';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:pluie';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B30:T36' WHERE id = 'guide/meteo#meteo:pluie-diluvienne';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:pluie-diluvienne';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B37:T43' WHERE id = 'guide/meteo#meteo:neige';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:neige';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B44:T50' WHERE id = 'guide/meteo#meteo:tempete-de-neige';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:tempete-de-neige';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B51:T57' WHERE id = 'guide/meteo#meteo:vent-violent';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:vent-violent';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B58:T64' WHERE id = 'guide/meteo#meteo:brouillard';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:brouillard';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B65:T71' WHERE id = 'guide/meteo#meteo:puree-de-poix';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:puree-de-poix';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B72:T78' WHERE id = 'guide/meteo#meteo:brouillard-obscur';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:brouillard-obscur';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B79:T85' WHERE id = 'guide/meteo#meteo:orage';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:orage';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B86:T92' WHERE id = 'guide/meteo#meteo:champ-magnetique';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:champ-magnetique';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B93:T99' WHERE id = 'guide/meteo#meteo:tempete-de-sable';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:tempete-de-sable';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B100:T106' WHERE id = 'guide/meteo#meteo:lune-de-sang';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:lune-de-sang';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B107:T113' WHERE id = 'guide/meteo#meteo:eclipse';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:eclipse';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B114:T120' WHERE id = 'guide/meteo#meteo:crachin-blanc';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:crachin-blanc';
UPDATE meteo SET source_ref = 'Nouveauté mise à jour Décembre › Météo › B121:T127' WHERE id = 'guide/meteo#meteo:pluie-petrole';
UPDATE meteo_effet SET source_ref = replace(source_ref, 'Magie Maverick V8 › ', 'Nouveauté mise à jour Décembre › ') WHERE meteo_id = 'guide/meteo#meteo:pluie-petrole';

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 10. Améliorations cadavériques supprimées (R237 (7)) : table amelioration_cadaverique et ses lignes page_entite
-- --------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM page_entite WHERE entite_table = 'amelioration_cadaverique';
DROP TABLE amelioration_cadaverique;

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 11. Bestiaire (R242) : (1) nouveaux noms des sorts renommés sur les cartes ; (2) sorts supprimés écrits sans lien (§2) ; (3) Poupée fulgurante -> Boules plasmiques, nom affiché compris (R246)
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE monstre_capacite SET sorts = 'Téléportation, Faille temporelle, Main de la momie, Vieillissement.' WHERE monstre_id = 'monstres/momie#carte:momie' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Téléportation, Faille temporelle, Main de la momie, Vieillissement, Horloge aspirante, Inversion.' WHERE monstre_id = 'monstres/momie#carte:momie-royale' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Téléportation, Faille temporelle, Main de la momie, Vieillissement, Horloge aspirante.' WHERE monstre_id = 'monstres/momie#carte:momie-surveillante' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Éclair en chaîne, Anti-Mythril, Rayon lunatique, Poison de masse.' WHERE monstre_id = 'monstres/mordor#carte:mordor-chasseur' AND rang = 6;
UPDATE monstre_capacite SET sorts = 'Éclair en chaîne, Anti-Mythril, Rayon lunatique, Poison de masse.' WHERE monstre_id = 'monstres/mordor#carte:mordor-pilleur' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Pieu d’os, Armure osseuse.' WHERE monstre_id = 'monstres/squelette-venin#carte:squelette-poison' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Pieu d’os, Armure osseuse.' WHERE monstre_id = 'monstres/squelette-venin#carte:squelette-toxique' AND rang = 5;
UPDATE monstre_capacite SET sorts = 'Pieu d’os, Armure osseuse.' WHERE monstre_id = 'monstres/squelette-venin#carte:squelette-venin' AND rang = 5;
UPDATE creature_capacite SET texte = 'Cette créature obtient de nouveaux sorts en plus des autres : Main de la momie, Vieillissement' WHERE id = 'bestiaire/momie#capacite:sort-supplementaire:npm5';
UPDATE creature_capacite_sort SET sort_nom_brut = 'Main de la momie' WHERE capacite_id = 'bestiaire/momie#capacite:sort-supplementaire:npm5' AND rang = 1;
UPDATE creature_capacite SET texte = 'Cette créature obtient de nouveaux sorts en plus des autres : Rayon lunatique.' WHERE id = 'bestiaire/poupee-maudite#capacite:sort-supplementaire:npm5';
UPDATE creature_capacite_sort SET sort_nom_brut = 'Rayon lunatique' WHERE capacite_id = 'bestiaire/poupee-maudite#capacite:sort-supplementaire:npm5' AND rang = 1;
UPDATE creature_capacite SET texte = 'Cette créature obtient de nouveaux sorts en plus des autres : Réflexe éclair, Boules plasmiques.' WHERE id = 'bestiaire/poupee-fulgurante#capacite:sort-supplementaire:npm3';
UPDATE creature_capacite_sort SET sort_nom_brut = 'Boules plasmiques', sort_id = 'magies/magie-de-la-foudre#sort:boules-de-foudre' WHERE capacite_id = 'bestiaire/poupee-fulgurante#capacite:sort-supplementaire:npm3' AND rang = 2;

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 12. Corps des pages : 14 magies (tableau des sorts dans l'ordre 1 à 30, notes, textes de niveau 5, sans les rôles), Nécromancie et Animation des morts sans le tableau cadavérique, Momie et Poupée maudite (R242 (1)), Poupée fulgurante (R246), altérations d'état, météo
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE page SET corps_md = '**En-tête de l''onglet** : INVOCATION NON-MORT

## Texte général

Il n''est possible d’avoir qu’une seule invocation à la fois en combat et par personnage (sauf le mode hyper de la nécromancie qui permet d''en avoir un deuxième). L''invocation reste pour une durée limitée sur le terrain avant de disparaître, les invocations n''ont pas de prérequis en termes d''environnement ou de matière, ils sont créés magiquement.

N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule exception : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieure et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.

Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.

Les invocations sont systématiquement en neutre (sauf contre-indication) et ne peuvent pas changer de posture.

Le principe est strictement le même que pour le sort « Appel aux golems », les non-morts invoqués seront différents si jamais un allié vient vous aider dans votre tâche.

▸ Toutes ces créatures ont ceci en capacité commune

- Non-Mort. Une créature non-mort est immunisée à la peur, à la couardise, à la fatigue, au poison, à la maladie. Les soins de lumière lui infligent des dégâts mais il a la possibilité de faire un jet de défense pour ne pas prendre les dégâts.

- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément (sauf capacité lui donnant autre chose). \[Exemple. Celui du feu est résistant au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau\]. Chaque attaque physique de leur part est une attaque élémentaire.

▸ Invoquer une créature double-magie

Pour pouvoir invoquer un non-mort double-magie, il faut posséder une seconde magie ou alors être à proximité d’un allié qui peut en échange d’un IC, infuser sa magie.

## Créatures

- Nécromancie mono : Zombi, Squelette archer
- Nécromancie + Arcane : Zombinox, Squamique
- Nécromancie + Corruption : Goule, Os dégradés
- Nécromancie + Espace/Temps : Momie, Temposs
- Nécromancie + Vide : Fantôme, Verros
- Nécromancie + Nécromancie : Zombi soldat, Squelette venin
- Nécromancie + Feu : Charcabé, Embrasé
- Nécromancie + Eau : Noyé, Squelrail
- Nécromancie + Glace : Carcalanche, Os froid
- Nécromancie + Terre : Zombi ronce, Squelette de pierre
- Nécromancie + Vent : Zompi, Crieur osseux
- Nécromancie + Foudre : Réanimé, Fulgurâme
- Nécromancie + Lumière : Solécorché, Lumiphage
- Nécromancie + Ombre : Zombre, Noctèbre
' WHERE id = 'bestiaire/animation-des-morts';
UPDATE page SET corps_md = '**Invocation** : Animation des morts (onglet du classeur « Invocation »)

**Magie(s)** : Nécromancie + Espace/Temps

**Autre créature du bloc** : Temposs

## Description

Ces humanoïdes entourés de bandelettes de lin ont été créés pour garder les tombes des défunts importants. Elles restent toujours à l’affût d’intrus qui pourraient venir profaner les lieux sacrés qu’elles protègent. Contrairement aux autres non-morts, les momies possèdent un sens de l’honneur et n’attaquent pas les vivants par haine.

## Statistiques

| Santé | Chakra | Barrière |
| --- | --- | --- |
| 5/NPM | 15/NPM | Selon le chakra |

**Dégâts** : Griffes - 1d8/NPM dégâts de taille

**Défense** : 0 Armure Physique | 2/NPM Armure Magique

**Vitesse** : 4 cases sol / 0 case nage

**FPVSIA** : 5/3/5/0/5/4 (+1 Intelligence au niveau 2 magique, +1 Intelligence au niveau 4 magique)

## Capacité(s)

Lanceur de sorts. Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : Téléportation, Coup de sablier.

(NPM 3) Attaque maudite. L''attaque de cette créature a l''effet du sort de l''ombre "malédiction" et l''applique automatiquement.

(NPM 5) Sort supplémentaire. Cette créature obtient de nouveaux sorts en plus des autres : Main de la momie, Vieillissement
' WHERE id = 'bestiaire/momie';
UPDATE page SET corps_md = '**Invocation** : Appel aux golems (onglet du classeur « Invocation »)

**Magie(s)** : Terre + Foudre

**Autre créature du bloc** : Golem de foudre

## Description

La poupée fulgurante est entièrement métallique, avec des articulations visibles et des plaques finement ciselées. Des arcs de foudre courent constamment sur sa surface, crépitant et illuminant ses contours d’une lueur jaune. Sa nature est offensive : elle concentre la magie de la Foudre pour projeter des éclairs, électrocuter ses ennemis ou frapper rapidement avec des décharges précises.

## Statistiques

| Santé | Chakra | Barrière |
| --- | --- | --- |
| 10/NPM | 10/NPM | Selon le chakra |

**Dégâts** : Griffe - 1d4/NPM dégâts de taille

**Défense** : 0 Armure Physique | 2/NPM Armure Magique

**Vitesse** : 4 cases sol / 0 case nage

**FPVSIA** : 1/1/10/1/5/3 (+1 Intelligence au niveau 2 magique, +1 Intelligence au niveau 4 magique)

## Capacité(s)

Lanceur de sorts. Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : Éclair, Nerveux.

(NPM 3) Sort supplémentaire. Cette créature obtient de nouveaux sorts en plus des autres : Réflexe éclair, Boules plasmiques.

(NPM 5) Sort supplémentaire. Cette créature obtient de nouveaux sorts en plus des autres : Éclair en chaîne.
' WHERE id = 'bestiaire/poupee-fulgurante';
UPDATE page SET corps_md = '**Invocation** : Appel aux golems (onglet du classeur « Invocation »)

**Magie(s)** : Terre + Ombre

**Autre créature du bloc** : Golem d''ombre

## Description

La poupée maudite est faite de tissu sombre, mais son véritable danger vient de l’aura d’ombre qui l’entoure, rendant ses contours difficiles à distinguer. Elle se déplace silencieusement et attend le moment parfait pour frapper. Sa magie est subtile et insidieuse : elle entrave ses victimes, manipule les ombres autour d’elle, et attaque avec précision lorsqu’elles sont vulnérables.

## Statistiques

| Santé | Chakra | Barrière |
| --- | --- | --- |
| 10/NPM | 10/NPM | Selon le chakra |

**Dégâts** : Griffe - 1d4/NPM dégâts de taille

**Défense** : 0 Armure Physique | 2/NPM Armure Magique

**Vitesse** : 3 cases sol / 0 case nage

**FPVSIA** : 1/1/10/1/5/3 (+1 Intelligence au niveau 2 magique, +1 Intelligence au niveau 4 magique)

## Capacité(s)

Lanceur de sorts. Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : Sphère obscure, Pichenette.

(NPM 3) Sort supplémentaire. Cette créature obtient de nouveaux sorts en plus des autres : Malédiction, Javelot sombre.

(NPM 5) Sort supplémentaire. Cette créature obtient de nouveaux sorts en plus des autres : Rayon lunatique.
' WHERE id = 'bestiaire/poupee-maudite';
UPDATE page SET corps_md = '## Aveuglement {#aveuglement}

- **Magie Liée** : Lumière
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -20% pour tout test qui demande de toucher une cible pendant 2 tours. | -50% pour tout test qui demande de toucher une cible pendant 2 tours. | -100% pour tout test qui demande de toucher une cible pendant 2 tours.<br><br>Les dégâts de sorts qui sont liés à la vision ne font aucun dégât. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégâts liés à la vue fonctionnent toujours
- **Grande vulnérabilité** : +5 dégâts par tour
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Effet négatif divisé par 2
- **Grande résistance** : 2 fois + de chances d''y résister

## Brûlure {#brulure}

- **Magie Liée** : Feu
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Inflige 10% de la santé Max<br>pendant 3 Tours. | Inflige 10% de la santé Max<br>pendant 4 Tours | Inflige 10% de la santé Max<br>pendant 5 Tours.<br>Les dégâts des attaques physiques<br>de la victime sont divisés par 2 |

**Résistances/Vulnérabilités**

- **Sensibilité** : dégâts des attaques physiques,  divisés par 2 au stade 2.
- **Grande vulnérabilité** : 5% de dégâts supplémentaires
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : 5% de dégâts en moins
- **Grande résistance** : Dure 1 Tour de moins.

## Confusion {#confusion}

- **Magie Liée** : Eau
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Lance 1d100 pour voir le comportement<br>01-70 : Agit normalement.<br>71-80 : Passe son Tour<br>81-90 : Se frappe tout seul.<br>91-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-50 : Agit normalement.<br>51-60 : Passe son Tour<br>61-80 : Se frappe tout seul.<br>81-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-20 : Agit normalement.<br>21-40 : Passe son Tour<br>41-60 : Se frappe tout seul.<br>61-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Grande vulnérabilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Vulnérabilité** : Jette deux dés 100 et prend le pire résultat
- **Résistances** : Jette deux dés 100 et prend le meilleur résultat
- **Grande résistance** : Permet de lancer un jet de chance si la cible à attaquer est un allié

## Enragé {#enrage}

- **Magie Liée** : Vide
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - La victime a un bonus de +3 dégâts.<br>-Malus de 10% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. | - La victime a un bonus de +6 dégâts.<br>-Malus de 15% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. | - La victime a un bonus de +10 dégâts.<br>-Malus de 20% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Jette deux d100 pour la fermeté, prends le pire.
- **Grande vulnérabilité** : +1 Tour
- **Vulnérabilité** : Chaque coup infligé cause un contre-coup de 5 dégâts dans les PV.
- **Résistances** : Jet de chance pour ne pas frapper un allié si c''est la cible la plus proche
- **Grande résistance** : Jette deux d100 pour la fermeté, prends le meilleur.

## Fatigue {#fatigue}

- **Magie Liée** : Temps/<br>Espace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -Impossible de Sprint.<br>- Malus de 5 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Sprint.<br>- Croix en Force et en Agilité.<br>- Malus de 10 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Sprint.<br>- Croix à toutes les Caractéristiques.<br>- Malus de 15 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 met deux croix à toutes les caractéristiques.
- **Grande vulnérabilité** : Dure 2 Repos au lieu de 1.
- **Vulnérabilité** : Prends une croix supplémentaire aléatoire au stade 2.
- **Résistances** : Permet de choisir entre la Force ou l''Agilité pour le malus du stade 2
- **Grande résistance** : Le stade 3 met deux croix aléatoires au lieu d''une croix partout.

## Gel {#gel}

- **Magie Liée** : Glace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Vitesse -1<br>-Inflige 5% de la santé max.<br><br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 10% de la santé Max.<br>- Les dégâts des attaques magiques de la cible sont divisés par 2.<br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 15% de la santé Max.<br>- Les dégâts des attaques magiques de la cible sont divisés par 2.<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : -2 vitesse
- **Grande vulnérabilité** : Les dégâts des attaques magiques sont divisés par 2 dès le Stade 1.
- **Vulnérabilité** : +1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : La vitesse n''est plus réduite.

## Paralysie {#paralysie}

- **Magie Liée** : Foudre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br><br>Dure 2 Tours. | - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br>- Vitesse divisée par 2.<br><br>Dure 3 Tours. | - Un jet de Vigueur est nécessaire pour ne pas perdre 1 Tour.<br>-  Vitesse divisée par 2.<br>- Force à jouer en dernier le tour<br>Dure 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Inflige 10% de la santé max à chaque échec.
- **Grande vulnérabilité** : Jette deux d100 pour la Vigueur, prends le pire.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Jette deux d100 pour la Vigueur, prends le meilleur.
- **Grande résistance** : - 1 Tour

## Peur {#peur}

- **Magie Liée** : Ombre
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 10% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 20% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 25% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le malus s''applique au jet de Calme.
- **Grande vulnérabilité** : - 10% de chance de résister à l''altération.
- **Vulnérabilité** : - 5% à tous les jets
- **Résistances** : Divise par 2 l''effet négatif.
- **Grande résistance** : 2 fois plus de chance de résister à l''altération.

## Pétrifié {#petrifie}

- **Magie Liée** : Terre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Croix à l''Agilité<br>-Vitesse divisée par 2<br><br>Dure 3 Tours. | - Impossibilité de bouger<br>-Ne peut utiliser que des sorts.<br><br>Dure 3 Tours. | - Impossibilité de bouger  et<br>d''attaquer.<br><br>- Dure 3 Tours |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 implique un jet de survie à chaque tour. Échec = mort.
- **Grande vulnérabilité** : Malus de 10% à tous les jets.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Le malus de vitesse passe à -1.
- **Grande résistance** : Le Stade 3 ne s''applique pas.

## Poison {#poison}

- **Magie Liée** : Nécromancie
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 10% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 15% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 20% de la santé Max.<br><br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégâts doublés.
- **Grande vulnérabilité** : 1 Tour d''effet supplémentaire.
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : Dégâts divisés par 2.
- **Grande résistance** : - 1 Tour.

## Saignement {#saignement}

- **Magie Liée** : Sang
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 5% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche.<br>- Croix à la Volonté. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégâts doublés.
- **Grande vulnérabilité** : Croix à la Force.
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : Dégâts divisés par 2.
- **Grande résistance** : Dure que 3 Tours.

## Somnolence {#somnolence}

- **Magie Liée** : Ombre (Songe)
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 5 à tout les dégâts<br>- Malus de 5% au jet de Force et Agilité<br>- Bonus de 5% aux jets de Volonté<br><br>Dure 3 tours | - Malus de 7 à tout les dégâts<br>- Malus de 10% au jet de Force et Agilité<br>- Bonus de 10% aux jets de Volonté<br><br>Dure 3 tours | - Malus de 10 à tout les dégâts<br>- Malus de 15% au jet de Force et Agilité<br>- Bonus de 15% aux jets de Volonté<br><br>Dure 3 tours |

## Surcharge Magique {#surcharge-magique}

- **Magie Liée** : Arcane/<br>Corruption
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -  Consomme  5% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure magique divisée par 2. | - Consomme 10% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure magique divisée par 3. | - Consomme 15% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure Magique divisée par 4. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Croix à l''Intel et à la Volonté
- **Grande vulnérabilité** : Résistance Magique annulées
- **Vulnérabilité** : 5% de {{barriere|barrière}} et de {{chakra|chakra}} en moins.
- **Résistances** : - 1 Tour
- **Grande résistance** : La {{barriere|barrière}} n''est pas impactée

## Surdité {#surdite}

- **Magie Liée** : Vent
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 15% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 20% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 30% aux compétences : Athlétisme, Équilibre, Stabilité, Reflexe, Distinction, Orientation.<br>- Un placement sur la victime fait qu''elle tombera toujours par terre juste après.<br>- Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégâts liés aux oreilles fonctionnent toujours.
- **Grande vulnérabilité** : Les échecs des jets stabilité/réflexe seront considérés comme EC.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : Les malus sont divisés par 2.

## Agrippé {#aggripe}

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de bouger.<br>Un jet d''Athlétisme/Équilibre est nécessaire pour sortir de l''entrave. |

## Coma {#coma}

- **Magie Liée** : /
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Le personnage est inconscient et doit faire 3 jets de survie s''il ne veut pas mourir.<br>Une réussite et le personnage est stabilisé, 3 échecs et c''est la MORT ! | Si le personnage a atteint son négatif maximal (le négatif égal à ses pv max) il n''aura qu''un SEUL et UNIQUE jet de survie. S''il est raté c''est la MORT ! | Si le personnage a atteint son double négatif maximal, il est MORT. |

## Couardise {#couardise}

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible d''attaquer une cible qui a plus de santé. Force un jet de fermeté ou de calme à chaque tentative d''attaque ou d''entrave directe sur l''adversaire.<br>Dure 4 tours.<br>(Les boss et mini boss ne peuvent pas l''infliger) |

## Enchevêtré {#enchevetre}

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Ne peut pas se déplacer et l''assaillant non plus.<br>Les attaques physiques ont les dégâts divisés par 2. |

## Étourdi {#etourdi}

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de faire le déplacement ET l''action dans le même tour. Les IC deviennent des actions. |

## Folie de Guerre {#folle-de-guerre}

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| - Impossible d''attendre, doit avancer vers l''ennemi.<br>- Insensible à tout contrôle mental ou à la peur. |

## Sans Défense {#sans-defense}

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de se défendre et demande un tour complet pour le retirer.<br>Les coups portés sur lui seront automatiquement des coups critiques. |
' WHERE id = 'guide/liste-des-alterations-d-etat';
UPDATE page SET corps_md = '## Normal

**Description** : Une météo neutre offre un ciel dégagé parsemé de quelques nuages, où aucun élément ne prend le dessus. La magie y reste stable. Dans cet équilibre parfait, seuls le talent et l’expérience du combattant font la différence.

**Effet(s)**

- Aucun effet

## Grand Soleil

**Description** : Un grand soleil inonde le ciel d’une lumière éclatante, réchauffant l’air et éclaircissant fort bien la zone.

**Effet(s)**

- Élément Lumière = +6 dégâts, +6 Soin
- Élément Feu = +5 dégâts
- Élément Glace = -5 dégâts
- Élément Ombre = -5 Dégâts
- Avantage (lance 2d100 = gardez le meilleur résultat) sur les jets de méditation et de calme

## Canicule

**Description** : Une canicule écrasante s’abat sur le paysage, l’air brûlant rendant chaque souffle plus difficile. Sous cette chaleur oppressante, même les plus résistants peinent à maintenir leur énergie.

**Effet(s)**

- Élément Feu = +10 dégâts
- Élément Lumière = +5 dégâts, +5 Soin
- Élément Glace = -10 dégâts
- Élément Ombre = -5 dégâts
- Élément Vent = -5 dégâts
- Vigueur et Fermeté -5% (sauf les magies avantagées)

## Pluie

**Description** : Une pluie régulière tombe du ciel, rafraîchissant l’air et imbibant le sol d’humidité.

**Effet(s)**

- Élément Eau = +5 dégâts, +5 Soin
- Élément Terre = +2 dégâts
- Élément Glace = +2 dégâts
- Élément Foudre = -5 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -1

## Pluie diluvienne

**Description** : Une pluie diluvienne s’abat avec force, transformant le sol en bourbier et réduisant la visibilité. Le vent et l’humidité perturbent également les incantations, rendant tout affrontement plus chaotique.

**Effet(s)**

- Élément Eau = +10 dégâts
- Élément Terre = +5 dégâts
- Élément Foudre = -10 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -2

## Neige

**Description** : Une fine neige recouvre lentement le paysage, apportant un froid mordant et un silence feutré. Chaque pas devient plus difficile, rendant les déplacements plus lents et méthodiques.

**Effet(s)**

- Élément Glace  = +5 dégâts, +5 Soin
- Élément Eau = +2 dégâts
- Élément Ombre = +2 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Initiative -2 (sauf les magies avantagées)

## Tempête de neige

**Description** : Une tempête de neige déchaîne vents glacés et flocons cinglants, réduisant la visibilité à quelques mètres. Le blizzard rend les déplacements périlleux, exposant les imprudents à un destin gelé.

**Effet(s)**

- Élément Glace  = +10 dégâts
- Élément Ombre = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Initiative -3 (sauf les magies avantagées)
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)

## Vent violent

**Description** : Un vent violent balaie la zone, hurlant à travers les obstacles et rendant l’air instable. Les rafales imprévisibles mettent à l’épreuve même les combattants les plus aguerris

**Effet(s)**

- Élément Vent = +10 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Élément Glace = -5 dégâts
- Élément Terre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme à DISTANCE

## Brouillard

**Description** : Un brouillard dense enveloppe le paysage, noyant les formes dans un voile laiteux. Dans cette obscurité diffuse, seuls les plus rusés tirent avantage de l’incertitude ambiante.

**Effet(s)**

- Élément Nécromancie = +5 dégâts
- Élément Eau = +2 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 10% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Purée de pois

**Description** : Une purée de pois impénétrable noie le monde dans une obscurité quasi totale, étouffant sons et lumières. Seuls ceux dotés d’un sens aiguisé peuvent naviguer sans errer à l’aveugle.

**Effet(s)**

- Élément Nécromancie = +10 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 20% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Brouillard obscur

**Description** : Un brouillard obscur s’étend comme une ombre vivante, absorbant la lumière et troublant les sens. Dans cette nuit artificielle, la peur et l’incertitude deviennent des armes redoutables.

**Effet(s)**

- Élément Ombre = +5 dégâts
- Élément Lumière = -5 dégâts
- Les attaques ont un malus de 25% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Orage

**Description** : Un orage éclate, zébrant le ciel d’éclairs aveuglants tandis que le tonnerre gronde avec une puissance assourdissante. Chaque instant peut voir la fureur céleste frapper sans avertissement.

**Effet(s)**

- Élément Foudre = +10 dégâts
- Élément  Espace/Temps = +5 dégâts
- Élément Terre = -5 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Une foudre naturelle tombe tous les 2 tours, touche aléatoirement une cible (allié comme ennemi) qui inflige 20 de dégâts

## Champ magnétique

**Description** : Un champ magnétique invisible sature l’air d’une énergie étrange, troublant les flux magiques et les perceptions. Les boussoles s’affolent, et même les plus expérimentés peinent à comprendre où est la gauche et la droite.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Espace/Temps = +2 dégâts
- Élément Foudre = +2 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Portée maximum des armes à distance = +2

## Tempête de sable

**Description** : Une tempête de sable déchaîne des vents furieux, soulevant un mur de particules abrasives qui réentrent dans les vêtements et armures.  Chaque souffle est une lutte, et seuls les plus résistants parviennent à avancer sans faillir.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Vent = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)
- Inflige 1d6 dégâts (ignore les AM et AP) à tout le monde (sauf les magies avantagées)

## Lune de sang

**Description** : Une lune de sang s’élève dans le ciel, baignant le monde d’une lueur rouge inquiétante. Sous ce présage funeste, les instincts primaires s’éveillent, et la frontière entre chasseur et proie s’amenuise.

**Effet(s)**

- Élément Sang = +10 dégâts
- Élément Nécromancie = -5 dégâts
- Ceux qui ont la magie du Sang récupèrent 2 Sang au lieu de 1 par tour
- Les monstres et les vampires ont un bonus de +5 à tous leurs dégâts et +2 à l''initiative
- La rage de la classe "Martiale" et "Goleois" dure 1 tour de plus

## Éclipse

**Description** : Une éclipse plonge le monde dans une obscurité surnaturelle, où la lumière du soleil est totalement occultée. Ce phénomène étrange agit fort sur les magies d''Ombre et de Lumière.

**Effet(s)**

- Élément Ombre = (TOUR PAIR) +10 dégâts \| (TOUR IMPAIR) -10 dégâts
- Élément Glace = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Nécromancie = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Lumière = (TOUR PAIR) -10 dégâts \| (TOUR IMPAIR) +10 dégâts
- Élément Feu = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts
- Élément Sang = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts

## Crachin Blanc

**Description** : Un crachin blanc tombe doucement, enveloppant le monde d’une fine couche de chakra pure. Cette petite brume pousse le chakra des combattants à son paroxysme et permet d''énormes prouesses.

**Effet(s)**

- Magie Arcane = +5 dégâts
- {{chakra}} illimité
- Le mode hyper n''est plus limité à un être sur le terrain
- Divise la {{corruption|corruption}} par 2

## Pluie pétrole

**Description** : Une pluie de pétrole tombe du ciel, noire et épaisse, recouvrant tout d’une couche glissante , infligeant de la {{corruption|corruption}} à tout le monde.

**Effet(s)**

- Magie Corruption = +5 dégâts
- Toutes les autres magies = -3 dégâts
- Lors du premier tour de la météo uniquement = -25% de {{chakra|chakra}} pour tous ceux qui ne sont pas de la Corruption
- +2 {{corruption}} par tour
' WHERE id = 'guide/meteo';
UPDATE page SET corps_md = 'La magie de la Corruption est l''ombre de l’Arcane, une énergie négative qui ne connaît ni faiblesse ni résistance. Semblable à l''Arcane, elle se manifeste sous une forme brute et malléable, mais son essence est pervertie par une volonté malveillante qui cherche à affaiblir, entraver et tuer. Contrairement aux autres formes de magie, la Corruption ne se mélange à aucune autre : elle est une entité à part entière qui refuse toute fusion, sauf entre les mains des Elfes Charbons et des Felfes Noirs, qui possèdent un lien et une histoire avec elle.

Tout comme la magie de l’Arcane, la Corruption offre une grande polyvalence, permettant à ses utilisateurs de s’adapter à toutes les situations. Mais là où l’Arcane façonne et construit, la Corruption érode et consume. Ses adeptes sont craints non pas pour leur force brute, mais pour leur capacité à manipuler l’affaiblissement et le désespoir. Ils sont perçus comme des combattants impitoyables et méthodiques, préférant saper leurs ennemis de l’intérieur plutôt que d’engager un combat frontal.

## Description physique

Les utilisateurs de la corruption sont marqués surtout au niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur noire et le corps est parsemé de tatouages couleur anthracite qui deviennent noirs aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages sont de plus en plus noirs.

## Explication

L''utilisateur de la corruption est un combattant qui fait énormément de dégâts et utilise énormément d''entrave. Il utilise le {{chakra|Chakra}} et la {{corruption|Corruption}} comme un système de vases communicants.

Chaque sort demande du {{chakra|chakra}}, à chaque utilisation d''un sort, le coût en {{chakra|chakra}} se transfère dans la {{corruption|corruption}} (si un sort coûte 4, vous obtenez 4 {{corruption|corruption}}), il est possible d''utiliser cette réserve de {{corruption|corruption}} pour lancer les mêmes sorts mais avec des effets supplémentaires mais il faut consommer le double du coût en {{corruption|corruption}} (si le sort coûte 4, il vous faut 8 {{corruption|corruption}}). Bien entendu ceux qui sont de la corruption sont totalement immunisés à l''effet négatif du trop-plein de {{corruption|corruption}} (qui est la transformation en abomination, donc une mort du personnage) mais prudence, car quand on est gavé de {{corruption|corruption}} cela se voit physiquement sur le personnage et la corruption reste une magie mal vue.

Attention, si le {{chakra|chakra}} permet d''obtenir de la {{corruption|corruption}}, l''inverse ne se fait pas. Et, comme pour tous, chaque point de {{corruption|corruption}} empêche de récupérer un point de {{chakra|chakra}} : c''est en gros la même réserve, remplie avec autre chose.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 8.0
- **Caractéristiques bonus** : INTELLIGENCE
- **Résistance magique** : Arcane
- **Résistance altération d''état** : Surcharge magique
- **Vulnérabilité magique** : Aucune
- **Vulnérabilité altération d''état** : Aucune
- **Magie non compatible** : Toutes les magies ne peuvent pas se combiner avec la corruption, c''est mono-magie uniquement. Seuls les Elfes noirs (Charbon) et les Felfes noirs peuvent cette magie en innée/acquis avec une autre magie (les limitations de la magie acquise s''appliquent pour les magies primordiales : Pas d''arcane, sang ou espace/temps)

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Le {{chakra\|chakra}} active directement les effets secondaires |
| Bi-magie | Divise par 2 le coût en {{corruption\|corruption}} des sorts. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Boule sombre | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Si {{corruption\|CR}} : +1d de dégâts. |
| 1.0 | Tir d''huile | Attaque | 4.0 | 9 (+2/NM) | 1.0 | 2d6 dégâts | Si {{corruption\|CR}} : Inflige 4 {{corruption\|corruption}}. |
| 1.0 | Verrouillage Simple | Entrave | 4.0 | 6.0 | 1.0 | Bloque la posture Neutre | Dure 2 tours (+1/NM)<br>Si {{corruption\|CR}} : Le changement de posture est aléatoire. |
| 1.0 | Verrouille Visible | Entrave | 4.0 | 6.0 | 1.0 | Bloque la posture Vigilance | Dure 2 tours (+1/NM)<br>Si {{corruption\|CR}} : Le changement de posture est aléatoire. |
| 1.0 | Retrait | Soin (IC) | 5.0 | 1.0 | 1.0 | 2d6 {{corruption\|CR}} (+1d/NM) | Retire de la {{corruption\|corruption}} d''une cible pour la mettre dans la réserve. |
| 2.0 | Aiguisage magique | Amplification (IC pour 3 NM) | 6.0 | 1.0 | 1.0 | / | Permet d''augmenter la réussite critique de 2% au prochain sort.<br>Si {{corruption\|CR}} : Bonus de +5 dégâts en plus. |
| 2.0 | Fer corrompu | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de {{corruption\|corruption}} par coup qui touche. Dure 3 tours. |
| 2.0 | Souffle noir | Entrave | 7.0 | 2 (+1/NM) | Cône | Retire du 2d10 de {{chakra\|chakra}} à la cible | Si {{corruption\|CR}} : Inflige 10 de {{corruption\|corruption}} en plus. |
| 2.0 | Pétrole | Entrave (IC pour 3 NM) | 8.0 | 5.0 | 5x3 | Divise par 2 la vitesse et le bonus initiative | Pose une zone qui ralentit ceux qui sont dedans. Capable de brûler.<br>Si {{corruption\|CR}} : Bloque entièrement les cibles. |
| 2.0 | Vague déferlante | Attaque | 9.0 | 5.0 | 1.0 | 5d6 dégâts (+5/NM) | Peut être surchargé (15 {{chakra\|chakra}} en + = 1 dé en +) (maximum 45 {{chakra\|chakra}} en surcharge)<br>Si {{corruption\|CR}} :  Ignore 50% de l''AM. |
| 3.0 | Mine poisseuse | Attaque/ Construction<br>(Inesquivable) | 14.0 | 6.0 | 1.0 | 7d6 dégâts (+3/NM) | Pose une mine qui explose quand une cible touche la zone. Ne se voit pas.<br>Si {{corruption\|CR}} : Inflige 10 {{corruption\|corruption}} |
| 3.0 | Laser noir | Attaque | 12.0 | 7.0 | 1.0 | 23 dégâts | Tire un rayon qui ignore l''AM.. Augmente la réussite critique de 1%/NM.<br>Si {{corruption\|CR}} : La cible a -20% pour le jet de défense |
| 3.0 | Fouet ténébreux | Attaque/Entrave | 13.0 | 5.0 | 1.0 | 7d6 dégâts | Si jet de fermeté raté : Inflige 7 (+2/NM) {{corruption\|corruption}}.<br>Si {{corruption\|CR}} : Fait reculer la cible de 1 case. |
| 3.0 | Saturation | Amplification  (IC pour 3NM) | 10 | 3 | 1 | +1 dégât/ 5 CR | La cible augmente ses dégâts selon son taux de corruption, 1 dégât par 5 corruption. Dure 3 tours. |
| 4.0 | Pression noire | Amplification  (IC pour 3NM) | 20 | 1 | 1 | +3 dégâts/10% de corruption | Le bénéficiaire aura un bonus de dégâts si sa cible a de la corruption en elle. Dure 3 tours.<br>Si CR : Le bonus est de +5 dégâts |
| 4.0 | Grenade collante | Attaque | 23.0 | 6.0 | Cercle de 3 | 8d6 + 35 dégâts | Explose dans 1 tour, inflige d''énormes dégâts de zone. (3NM = La grenade colle la cible)<br>Si {{corruption\|CR}} : Le sort est inesquivable. |
| 4.0 | Désintégration | Attaque | 20 | 7 | 1 | 40 dégâts | Double les dégâts contre les sorts "Construction" et les éléments du décor.<br>SI CR : +15 dégâts |
| 4.0 | Pluie huileuse | Météo | 50% corruption | Soi-même | Terrain | / | Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM). |
| 5.0 | Une tu meurs | Attaque | 55 (-5/NM) | 1.0 | 1.0 | 30 dégâts perce AM/tour | Inflige une blessure qui va infliger des dégâts pendant 3 tours.<br>Si {{corruption\|CR}} : Ignore la {{barriere\|barrière}}. |
| 5.0 | Choc prétrolier | Attaque | 55 (-5/NM) | 7 | 1 | 10d6 + 70 dégâts | Inflige une terrible frappe de corruption sur la cible.<br>Si CR : Inflige +30 dégâts. |
| 3.0 | Crachat pollué | Attaque | 14 | 6 | 1 | 6d6 + 12 dégâts (+3/NM) | Si CR : Inflige 10 Corruption |
| 3.0 | Blessure poisseuse | Attaque/ Entrave | 13 | 4 | 1 | 6d6 + 15 dégâts | Si CR : Empêche la cible de perdre de la corruption pendant 2 tours. |
| 3.0 | Plaie suintante | Entrave (IC pour 3NM) | 12.0 | 3.0 | 1.0 | Bloque la {{barriere\|barrière}} | Si jet de fermeté raté : Empêche la régénération de la {{barriere\|barrière}} pour 3 tours.<br>Si {{corruption\|CR}} : L''inflige automatiquement. |
| 3.0 | Aura de frayeur | Entrave (IC pour 3 NM) | 14.0 | Soi-même | Cercle de 2 | / | Dure 3 tours. Si jet de Calme raté = Impossibilité pour la cible d''approcher. Si {{corruption\|CR}} : Ceux qui ratent le jet fuient. |
| 4.0 | Contre-sort | Entrave<br>(Réaction) | Variable selon le sort bloqué | 6 (+2/NM) | 1 | / | La lanceur bloque un sort ennemi lvl 1-4 le faisant passer de réussite à échec. Le coût correspond au sort qui a été bloqué. (1 fois par tour) |
| 4.0 | Pour moi ! | Attaque | 19.0 | 1.0 | 1.0 | 6d6 + 25 dégâts | Si {{corruption\|CR}} : Retire un effet positif de la cible et le transforme en 2d8 {{barriere\|barrière}} pour le lanceur. |
| 4.0 | Verrouillage Magique | Entrave | 20.0 | 6.0 | 1.0 | Bloque la posture Focus et Symbiose | Dure 2 tours (+1/NM)<br>Si {{corruption\|CR}} : Le changement de posture est aléatoire. |
| 4.0 | Verrouillage Physique | Entrave | 20.0 | 6.0 | 1.0 | Bloque la posture Offensif et Défensif | Dure 2 tours (+1/NM)<br>Si {{corruption\|CR}} : Le changement de posture est aléatoire. |
| 5.0 | Sapeur | Entrave | X Corruption | 3 (+1/NM) | 1.0 | / | Donne autant de {{corruption\|corruption}} à la cible que la réserve actuelle de {{corruption\|corruption}}. |
| 5.0 | Eau noire | Entrave | 55 (-5/NM) | Vue | Terrain | Retire les résistances magiques | Baisse d''un cran les résistances magiques pendant 3 tours.<br>Si {{corruption\|CR}} : Les retire complètement et agrave les vulnérabilités d''un cran. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Verrouillage Simple »**

Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.

**Note de la cellule « Effets secondaires » du sort « Verrouille Visible »**

Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.

**Note de la cellule « Effets secondaires » du sort « Pétrole »** : Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.

**Note de la cellule « Effets secondaires » du sort « Mine poisseuse »** : Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)

**Note de la cellule « Effets secondaires » du sort « Laser noir »** : Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.

**Note de la cellule « Effets secondaires » du sort « Verrouillage Magique »**

Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.

**Note de la cellule « Effets secondaires » du sort « Verrouillage Physique »**

Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
', resume = 'La magie de la Corruption est l''ombre de l’Arcane, une énergie négative qui ne connaît ni faiblesse ni résistance.' WHERE id = 'magies/magie-de-la-corruption';
UPDATE page SET corps_md = 'La magie de la foudre est une magie spécialisée dans les dégâts et l''amplification. Héritée du Dieu de la Foudre, le Dieu-Scientifique des nains, elle combine puissance destructrice et maîtrise des énergies électriques.

Les utilisateurs de la foudre manipulent l''électricité pour lancer des éclairs, déchaîner des orages ou surcharger leurs capacités et celles de leurs alliés. Rapide et violente, cette magie excelle dans les offensives fulgurantes et les techniques visant à amplifier les performances au-delà de leurs limites habituelles.

Associée à l''excitation, une émotion liée à l''élan et à la frénésie, la magie de la foudre attire souvent les individus curieux, audacieux et toujours en quête de nouvelles découvertes ou sensations.

## Description physique

Les utilisateurs de la foudre ont les mèches jaunes, les yeux jaunes lors de l''utilisation d''un sort, de l’électricité parcourt en permanence leur corps. Des plaques de fer très conductrices se trouvent sur certaines parties du corps (bras, jambes, organes vitaux).

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : AGILITÉ
- **Résistance magique** : Foudre, Eau, Vent
- **Résistance altération d''état** : Paralysie, Confusion, Surdité
- **Vulnérabilité magique** : Terre, Nécromancie
- **Vulnérabilité altération d''état** : Pétrification, Poison

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts qui va ignorer les AM et AP. Dégâts non élémentaires. |
| Bi-magie | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts. Dégâts non élémentaires. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Éclair | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Foudre. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre paralysie 1. |
| 1.0 | Contact de Volt | Attaque<br>(Imparable) | 4.0 | 5.0 | 1.0 | 1d8 dégâts (+2/NM) | Un sort qui se propage aux adversaires au contact de la cible et inflige +2 dégâts par cible touchée. |
| 1.0 | Affûtage | Amplification<br>(IC) | 4.0 | 1.0 | 1.0 | / | Permet d''augmenter la réussite critique de 2% (+1/NM) à la prochaine attaque avec une arme. |
| 1.0 | Nerveux | Amplification (IC pour 3 NM) | 3.0 | 1.0 | 1.0 | +2 INI (+1/NM) | II : Augmente l''initiative au prochain tour.<br>IG : Augmente l''initiative passivement du premier jet d''initiative. |
| 1.0 | Tazeur | Attaque/ Entrave | 5.0 | 1.0 | 1.0 | 2d4 dégâts (+2/NM) | Si jet de fermeté raté = Inflige "Couardise" |
| 2.0 | Fer foudroyant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Charge l''arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre. |
| 2.0 | Réflexe éclair | Amplification (IC pour 3 NM) | 8.0 | 1.0 | 1.0 | +5% Agilité | Augmente de 5% l''agilité pendant 2 tours. |
| 2.0 | Colonne Tesla | Amplification/ Entrave (IC pour 3 NM) | 7.0 | 4.0 | 1.0 | / | Donne la propriété « paratonnerre » à une cible. |
| 2.0 | Chargeur | Amplification (IC x 3) | 9 (-1/NM) | Soi-même | 1.0 | +4 dégâts | +4 dégâts (cumulable 3 fois) pour le prochain sort d''attaque. |
| 2.0 | Souffle électrique | Attaque<br>(Imparable) | 8.0 | 3.0 | Cône | 5d6 dégâts (+3/NM) | Si jet de vigueur raté = Inflige paralysie 1. |
| 3.0 | Boules plasmiques | Attaque | 5 par boule | 2.0 | 1.0 | 3d6 + 10 dégâts | 1 boule (+1/NM) vont apparaître et vont s''approcher de l''ennemi le plus proche de 2 cases par tour. |
| 3.0 | Foudre rouge | Attaque/ Entrave | 17 | 4 (+1/NM) | 1.0 | 5d10 dégâts | Si jet de vigueur raté = Inflige Brûlure 1.<br>Si jet de vigueur 2 raté = Inflige Paralysie 1. |
| 3.0 | Surcharge | Amplification  (IC pour 3 NM) | 12 | Soi même | 1 | / | Le prochain sort d''attaque de Foudre coûtera 50% plus chère mais fera 25% de dégâts finaux en plus. |
| 3.0 | Mur hertz | Construction | 12 | 3 (+1/NM) | Ligne 9 cases | 15 - 30 - 15 | Ceux qui ne possèdent pas de résistance à la Foudre doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours. |
| 4.0 | Éclair en chaîne | Attaque (Inesquivable) | 22.0 | 6 (+1/NM) | 1.0 | 8d6 + 25 dégâts | Inflige de gros dégâts et passe à la cible la plus proche suivante, ses dégâts se divisent par 2 à chaque nouvelle cible (5 maxi) |
| 4.0 | Colère de Volt | Météo | 21.0 | Soi-même | Terrain | / | Invoque la météo "orage" pendant 3 tours (+1/NM). |
| 4.0 | Grenade paralysante | Attaque | 23.0 | 6.0 | Croix diagonale de 3 cases | 8d6 + 35 dégâts | Inflige des dégâts de zone de Foudre. (3NM = Si jet de vigueur raté = Inflige paralysie 1). |
| 4.0 | Turbine | Attaque/ Amplification (IC) | 20 | Soi même | 1 | 10 dégâts/CE\|<br>+10 CK/CE | Gagne 1 CE à chaque sort de Foudre lancé. À 1 charge ou +, choix : récupère du CK, en donne à un allié ou inflige une attaque de 6PO ignorant l''AM. |
| 5.0 | Orage violet | Attaque/ Entrave | 55 (-5/NM) | 5.0 | Carré de 3 | 10d6 + 60 dégâts | Une attaque surpuissante de foudre qui tape en zone. 15% des dégâts se répercutent dans le {{chakra\|chakra}}. |
| 5.0 | Rayonnement | Amplification/ Entrave | 55 (-5/NM) | Soi même | Cercle de 3 | 30 dégâts | Invoque une zone électrifié qui inflige des dégâts perce BA aux ennemis. Les alliés sont sous l''effet du sort "Chargeur" trois fois. Dure 3 tours. |
| 3.0 | Magnérance | Attaque/ Placement | 14 | 7 | 1 | 5d6 + 15 dégâts | Une attaque qui force le jet de stabilite/réflexe à la cible pour ne pas être déplacer de 1 case (+1/NM). |
| 3.0 | Plaques polarisées | Amplification (IC pour 3 NM) | 13.0 | 1.0 | 1.0 | / | Invoque 2 plaques qui vont attirés les sorts qui sont à 2 cases du lanceur et les dévier pour les annulés (sort de niveau 3 maximum) |
| 3.0 | Dysfonctionnement | Entrave (IC pour 3 NM) | 11.0 | 4.0 | 1.0 | / | Une créature dite mécanique agit de manière incohérente pendant 1 tour (+1 tour/NM). |
| 3.0 | Vitesse ampère | Amplification (IC pour 3 NM) | 12.0 | 3 | 1.0 | +1 Vitesse | Augmente la vitesse de la cible. Si il porte une armure lourde, il n''est plus ralenti. Dure 3 tours. |
| 4.0 | Réflexion de Volt | Météo | 20 | Soi même | Terrain | / | Invoque la météo "champ magnétique" pendant 3 tours (+1/NM). |
| 4.0 | Répulsion réflexe | Amplification/ Placement (IC) | 20 | 4 | 1 | +1 attaque d''opportunité/tour | Lorsqu''une attaque touche la cible, celle-ci repousse automatiquement son attaquant de 2 cases (1 case si la créature est grande). Dure 3 tours. |
| 4.0 | Armure magnétique | Amplification (IC pour 3 NM) | 20.0 | 1.0 | 1.0 | +5AP, +5AM | Utilisable uniquement si la cible porte une armure avec du métal., la refonce et impose un malus de 15% à l''ennemi pour toucher. Dure 3 tours. |
| 4.0 | Cercle électrique | Attaque | 23 | Soi-même | Cercle de 5 | 7d6 dégâts (+8/NM) | Frappe au sol pour invoquer un cercle qui va électriser les ennemis. |
| 5.0 | Fulguration | Attaque | 55 (-5/NM) | 8.0 | Carré de 3 | 10d6 + 60 dégâts | Une attaque surpuissante de foudre qui tape en zone. Si jet de vigueur raté = Inflige paralysie 3. |
| 5.0 | Magnétosphère | Entrave | 50 (-5/NM) | Soi même | Cercle de 9 | / | Désarme automatiquement les ennemis dans la zone. Leurs armes tombent au sol et ne peuvent être ramassées qu''à leur prochain tour. |

## Notes et commentaires des sorts

**Remarque du sort « Nerveux »**

II : Initiative individuelle  
IG : Initiative groupée

**Note de la cellule « Effets secondaires » du sort « Fer foudroyant »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être paralysé au stade 1

**Note de la cellule « Effets secondaires » du sort « Colonne Tesla »** : Paratonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)

**Remarque du sort « Turbine »**

CE = Charge électrique  
CK = Chakra

1 seule charge par tour.  
3 charges maximum cumulable

Une fois la ou les charges libérées, il faut relancer le sort pour recommencer

**Remarque du sort « Rayonnement »** : BA = Barrière

**Remarque du sort « Plaques polarisées »**

Une plaque bloque qu''UN seul sort et disparaissent.

2 plaques à la fois maximum.

**Note de la cellule « Effets secondaires » du sort « Dysfonctionnement »** : C''est un équivalent de "Confusion 3" pour les créatures mécaniques.

**Remarque du sort « Répulsion réflexe »** : Ne déclenche pas d''attaque d''opportunité sauf pour le bénéficiaire du sort.

## Textes des sorts de niveau 5

### Orage violet

### Fulguration

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-foudre';
UPDATE page SET corps_md = 'La magie de la glace est l''une des formes les plus étonnantes de magie dans Maverick. Les mages qui maîtrisent cette magie sont capables de manipuler la glace et le froid pour créer des formes de glace incroyablement complexes et belles.  
Les utilisateurs de la glace peuvent utiliser leur pouvoir pour créer des ponts de glace, des lames de glace tranchantes, des murs de glace qui peuvent repousser les ennemis ou les protéger des attaques.  
Les utilisateurs de la glace peuvent également utiliser leur magie pour geler l''eau ou l''humidité dans l''air, créant des tempêtes de neige et des blizzards qui peuvent aveugler leurs ennemis. Ils peuvent également utiliser leur pouvoir pour rafraîchir des objets, des boissons ou des aliments, ou pour purifier l''eau en la transformant en glace.  
Les utilisateurs de la glace sont souvent considérés comme des personnages calmes et réfléchis, en raison de la nature froide de leur magie.

## Description physique

Les utilisateurs de la glace ont les mèches bleu cyan, des cheveux assez courts en général, les yeux bleu cyan lors de l''utilisation d''un sort. Certaines parties du corps présentent des plaques de glace, elles sont généralement sur les membres ou les zones vitales.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : INTELLIGENCE
- **Résistance magique** : Glace, Nécromancie, Sang
- **Résistance altération d''état** : Gel, Poison, Saignement
- **Vulnérabilité magique** : Feu, Vent
- **Vulnérabilité altération d''état** : Brûlure, Surdité

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | L''armure magique (AM) de base augmente de 25. |
| Bi-magie | L''armure magique (AM) de base augmente de 10. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Éclat glacé | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Glace. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1. |
| 1.0 | Tir de givre | Attaque/ Entrave | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+3/NM) | Si jet de vigueur raté = Inflige gel 1. |
| 1.0 | Sculpteur glacé | Construction (IC pour 3 NM) | 3 par taille créée | Soi-même | 1.0 | / | Permet de créer un objet fait de glace. Sert 1 fois. Une taille = une épée en taille |
| 1.0 | Peau verglacée | Amplification (IC) | 4.0 | 1.0 | 1.0 | +2AM (+1AM/NM) | Augmente l''armure magique pendant 3 tours. Peut se cumuler avec Cuirasse arctique. |
| 1.0 | Rafraîchissement | Soin (IC) | 3.0 | 1.0 | 1.0 | 2d4 soin (+3/NM) | Permet de soigner un état de brûlure. |
| 2.0 | Fer froid | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Refroidit l''arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace. |
| 2.0 | Souffle glacial | Attaque<br>(Imparable) | 8.0 | 3.0 | Cône | 5d6 dégâts (+3/NM) | Si jet de vigueur raté = Inflige gel 1. |
| 2.0 | Cerveau gelé | Entrave (IC pour 3 NM) | 9.0 | 4.0 | 1.0 | => | Jet de fermeté raté = Croix en I.<br>Jet de fermeté réussi = -10% à tout test d''I / Dure 3 tours pour les deux résultats. |
| 2.0 | Lien de gel | Entrave | 7.0 | 4.0 | 1.0 | / | Bloque les mains de l''adversaire, au prochain tour, propage le lien de gel aux autres à 2 cases autour. |
| 2.0 | Cuirasse arctique | Amplification (IC) | 7.0 | 1.0 | 1.0 | +4AM (+2AM/NM) | Augmente l''armure magique pendant 3 tours. Peut se cumuler avec Peau Verglacée. |
| 3.0 | Avalanche | Attaque | 15.0 | 7.0 | Carré de 5 | 5d6 dégâts (+3/NM) | Si bonne météo = Inflige 2d dégâts en plus. |
| 3.0 | Flomentation | Attaque | 16 | 3 (+2/NM) | 1 | 7d6 + 7 dégâts | Si bonne météo = À l''impact, le projectile se fragmente en plusieurs projectiles qui vont à gauche et droite de la cible. Leur dégâts est divisé par 2. |
| 3.0 | Prison boréale | Attaque/ Entrave | 15 (-2/NM) | 1.0 | 1.0 | 6d6 dégâts | Si jet de vigueur raté = Inflige gel 3.<br>Si bonne météo = Inflige +8 dégâts |
| 3.0 | Sublimation | Amplification (IC pour 3NM) | 18 | 1 | Illimité | +2 dégâts/état de gel retiré | Les cibles doit souffrir d''un gel = Retire les états de gel des ennemis pour augmenter les dégâts pendant 4 tours.<br>Si bonne météo = +1 dégât en plus |
| 4.0 | Froid gémellaire | Attaque | 22 | 5 | 1 | 4d6 dégâts (+4/NM) = à faire deux fois | Une attaque en deux temps qui oblige la cible à faire deux jets de défense.<br>Si bonne météo = Malus de 15% aux jets de défnese |
| 4.0 | Grenade cryogénique | Attaque/ Entrave | 23.0 | 6.0 | Cercle de 2 | 8d6 + 35 dégâts | Inflige des dégâts de zone de Glace. (Si jet de vigueur raté = Inflige gel 1/3NM) |
| 4.0 | Danse de Celsius | Météo | 20.0 | Soi-même | Terrain | / | Invoque la météo "Neige" ou "Tempête de Neige" pour 3 tours (+1/NM). |
| 4.0 | Blancheur aveuglante | Amplification (IC pour 3NM) | 20 | 1 | 1 | -15% de malus pour les ennemis | Entoure la cible d''une brume qui permet d''imposer un malus pour le toucher. Dure 3 tours.<br>Si bonne météo = Le malus est doublé. |
| 5.0 | Exécution froide | Entrave | 20 par tour | 3 (+1/NM) | 1.0 | 20 dégâts perce AM/tour | Sort à maintenir pendant 4 tours, au bout du 5ème tour, la victime meurt.<br>Si bonne météo = -1 tour |
| 5.0 | Rayon polaire | Attaque | 50.0 | 11.0 | 1.0 | 90 dégâts (+10/NM) | Si jet de vigueur raté = Inflige gel 3.<br>Si bonne météo = Malus de 20% à la cible pour ne pas prendre l''altération d''état. |
| 3.0 | Cristal absorbant | Amplification (IC pour 3NM) | 16 | 3 | 1 | / | Quand un sort est encaisser, le quart de son coüt en chakra est donner au receveur. Dure 4 tours. |
| 3.0 | Stalactite | Attaque | 15.0 | 5.0 | 1.0 | 7d6 + 15 dégâts (+3/NM) | Envoie un gros pic de glace. |
| 3.0 | Gel profond | Construction | 18.0 | 3 (+1/NM) | 1.0 | Isole la cible pour 1 tour | Bloque entièrement une cible mais elle ne subit plus aucun effet extérieur ou des altérations d''états. Peut être fait sur ennemis comme alliés |
| 3.0 | Mur de glace | Construction | 14.0 | 3.0 | Rectangle 5x2 | / | Encaisse un total de 40 points de dégâts (+10/NM). |
| 4.0 | Lance cristalline | Attaque (Inesquivable) | 24 (-2/NM) | 20.0 | 1 | 6d6 + 35 dégâts | Envoie une lance magique qui est si rapide qu''il est impossible de lui échapper. |
| 4.0 | Prisme protecteur | Protection | 26 (-2/NM) | 3 | 1 | / | Protége un allié pendant 2 tours maximum d''un coup magique qui peut mettre dans le coma. Si protége d''un coup fatal = Voir remarque\* |
| 4.0 | Cape hivernale | Amplification | 20.0 | 3.0 | 1.0 | -25% dégâts finaux magique | Réduit les dégâts magiques subis pendant 2 tours.<br>3NM = réduit les dégâts de 50% au lieu de 25%. |
| 4.0 | Étage nival | Amplification (IC pour 3 NM) | 20.0 | 1.0 | 1.0 | +2 crans de résistance | Augmente la résistance au Feu et au Vent de 1 cran. 3 tours. |
| 5.0 | Comète de Celsius | Attaque/ Entrave | 50 (-5/NM) | 6.0 | Carré de 4 | 10d6 + 60 dégâts | Une attaque surpuissante de glace qui tape en zone. Si jet de vigueur raté = Inflige gel 2. |
| 5.0 | Pôle absolu | Protection | 55 (-5/NM) | Soi même | 1 | / | Une fois lancé, tout sort entrant dans un cercle de 3 autour du lanceur est automatiquement attiré vers ce dernier et devient ciblé sur lui. Dure 3 tours. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Fer froid »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être gelé au stade 1

**Note de la cellule « Effets secondaires » du sort « Lien de gel »**

3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...

**Remarque du sort « Sublimation »** : Un état de gel est comme retirer "gel 1". Donc par extension, "gel 2" correspond à 2 états de gel, etc.

**Note de la cellule « Effets secondaires » du sort « Exécution froide »**

La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.  
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.

**Note de la cellule « Effets secondaires » du sort « Gel profond »** : L''allié sera aussi dispensé de jet de survie pendant cet état.

**Note de la cellule « Effets secondaires » du sort « Mur de glace »** : Invoque un mur.

**Remarque du sort « Prisme protecteur »**

\*Met à 1 de santé et +20AM pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.

## Textes des sorts de niveau 5

### Comète de Celsius

> Que la discipline glacée de Celsius guide mon mouvement,  
> Que son art martial sculpte l’air d’un froid parfait,  
> Que le souffle du givre s’abatte en un cercle implacable,  
> Que chaque battement gèle la chair et fige les os,  
> Et puisse la pureté du froid briser tout sur son passage…
>
> FRAPPE DE CELSIUS !

### Exécution froide

> Que le silence du givre referme ses doigts sur ma cible,  
> Que la glace se scelle autour d’elle comme un tombeau parfait,  
> Que le temps lui-même s’immobilise dans ce cercueil polaire,  
> Que son étreinte de froid se prolonge jusqu’à briser son souffle,  
> Et puisse la grande Celsius l’emporter sans un cri…
>
> EXÉCUTION FROIDE !

### Rayon polaire

> Que le froid absolu traverse l’air en une ligne parfaite,  
> Puisse Sa volonté condenser l’hiver dans un seul éclat,  
> Que le givre fige la chair et l’esprit d’un même trait,  
> Puisse le souffle polaire emprisonner tout battement de vie,  
> Et que la cible devienne une statue de glace vivante…
>
> RAYON POLAIRE !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-glace';
UPDATE page SET corps_md = 'La magie de la lumière est une magie spécialisée dans le soin et la protection. Héritée de la Déesse de la Lumière, une divinité de bonté et de guérison, elle est considérée comme l''une des magies les plus efficaces pour préserver la vie.

Les utilisateurs de la lumière emploient leur pouvoir pour soigner les blessures, purifier les altérations d''état et protéger leurs alliés. Cette magie peut également renforcer les capacités d''un groupe et se montrer redoutable contre les créatures vulnérables à la lumière.

Associée à l''espoir, une émotion liée à la foi et au fanatisme, la magie de la lumière est souvent pratiquée par ceux qui souhaitent guider, protéger et soutenir les autres face à l''adversité.

## Description physique

Les utilisateurs de la Lumière ont des cheveux avec les mèches beiges, les yeux beiges lors d''une utilisation de sort. Certains possèdent une petite aura de lumière qui émane des membres, d''autres ont les bracelets de lumière d''Aurora et d''autres possèdent une paire d''ailes de lumière (la déesse en possède 10)

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : PERCEPTION
- **Résistance magique** : Lumière
- **Résistance altération d''état** : Aveuglement
- **Vulnérabilité magique** : Ombre
- **Vulnérabilité altération d''état** : Peur

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Les soins, les protections et les amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). |
| Bi-magie | Chaque tour, un soin, une protection ou une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Frappe lumineuse | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de lumière. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre aveuglement 1. |
| 1.0 | Inspiration céleste | Protection (IC pour 3 NM) | 4.0 | 3.0 | 1.0 | / | Permet de résister à une altération d''état niveau 1. |
| 1.0 | Champ de force | Protection | 5.0 | 1.0 | 1.0 | / | Bloque 10 dégâts (+5/NM) (peut être surchargé en {{chakra\|chakra}} +2 dégâts/{{chakra\|chakra}}). |
| 1.0 | Juvabien | Amplification (IC) | 5 | 3 | 1 | / | Permet d''infliger un bonus de +2 (+2/NM) dégâts pendant 2 tours. |
| 1.0 | Premier soin | Soin | 4.0 | 1.0 | 1.0 | 2d6 soin (+1d6/NM) | Redonne des PV, ne soigne pas l''infirmité. |
| 2.0 | Fer lumineux | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière. |
| 2.0 | Bénédiction | Amplification (IC) | 7.0 | 3.0 | 1.0 | +1d de dégâts | Augmente les dégâts pendant 2 tours (+1/NM). |
| 2.0 | Énergie solaire | Soin | 8.0 | Soi-même | 1 (3NM = Croix 1x1) | / | Permet de récupérer \*10% de {{barriere\|barrière}} pendant 3 tours lors des météos de soleil. |
| 2.0 | Panneau solaire | Soin (IC) | 7.0 | 1.0 | 1.0 | +5 santé/tour | Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés) |
| 2.0 | Flash | Attaque/ Entrave | 6.0 | 4 | Cône | 5d6 dégâts (+5/NM) | Si jet de vigueur raté = Inflige Aveuglement stade 1. Ce sort ne marche pas sur des créatures aveugles. |
| 3.0 | Photon | Attaque | 15 (-1/NM) | 7.0 | 1.0 | 7d6 + 15 dégâts | Une puissante attaque de lumière. |
| 3.0 | Lame prismatique | Construction (IC pour 3 NM) | 12 | Soi même | 1 | / | Permet de concentrer la puissance de la lumière pour créer une arme qui frappera avec un bonus de +10 dégâts. 1 seule utilisation (+1 par NM). |
| 3.0 | Rayon d''Aurora | Météo | 12.0 | Illimité | Terrain | / | Invoque le grand soleil pendant 3 tours (+1/NM). |
| 3.0 | Mur gamma | Construction | 12 | 3 (+1/NM) | Ligne 9 cases | 15 - 30 - 15 | Ceux qui ne possèdent pas de résistance à la Lumière doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours. |
| 4.0 | Révélation | Construction | 20 | 5 | Cercle de 8 | Dévoile l''invisible | Invoque une boule de lumière qui emet une lumière capable de dévoiler les ennemis discrets, camouflés ou invisibles. Possède 30 santé. |
| 4.0 | Condamnation solaire | Entrave (IC pour 3NM) | 22 | 6 | 1 | / | Applique une marque sur la cible qui fait qu''elle prendra plus de dégâts des attaques proportionnellement à son état de santé. Voir remarque\*. |
| 4.0 | Grenade Flash | Attaque | 23.0 | 6.0 | Cercle de 2 | 8d6 + 35 dégâts | Inflige des dégâts de zone de Lumière. (3NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1) |
| 4.0 | Rai solaire | Attaque | 28 (-2/NM) | 14 | 1 | 40 dégâts | Tire un rayon qui ignore l''AM. |
| 5.0 | Lance sacrée | Attaque | 55 (-5/NM) | 15.0 | 1.0 | 10d6 + 80 dégâts | Inflige de terribles dégâts de lumière. Si jet de vigueur raté = Inflige aveuglement 1 |
| 5.0 | Nova finale | Attaque (Inesquivable) | 30 + 50 % de la santé max | Soi même | Cercle de 5 | 10d6 + 60 dégâts | Le lanceur se concentre et devient le centre d''une explosion de lumière. 3NM = Les alliés ne prennent que la moitié des dégâts. |
| 3.0 | Sanctuaire protecteur | Protection | 14 | 1 (+1/NM) | 1 | / | Pendant 3 tours, la cible bénéficie d''un avantage contre les altérations d''état. |
| 3.0 | Recouvrer | Soin | 12.0 | 1 (+1/NM) | 1.0 | / | Permet de soigner totalement les altérations d''état. |
| 3.0 | Marque du champion | Amplification | 14 | 1 | 1 | +3d6 dégâts | Donne des dégâts qui feront des dégâts neutres\* pour 3 tours. 50% des dégâts infligés de ce bonus se convertissent en santé (100% si 3NM). |
| 3.0 | Opération | Soin | 15.0 | 1.0 | 1.0 | 15 soin (+10/NM) | Peut soigner temporairement les infirmités.(3NM = Soigne une croix en carac) |
| 4.0 | Explosion glorifique | Amplification (IC pour 3 NM) | 25.0 | Soi-même | Cercle de 10 | +8 dégâts, +2AM, +5% à tous les jets | Motive les alliés et donne des amplificateurs pendant 1 tour. Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement. |
| 4.0 | Régénération | Soin | 24.0 | 1.0 | 1.0 | 5d6 + 10 soin/tour | Dure 3 tours (+1/NM). Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet. |
| 4.0 | Poussière d''étoile | Attaque/ Entrave<br>(Imparable) | 21.0 | 2 (+1/NM) | Cône | 4d6 + 25 dégâts | Si jet de vigueur raté = aveuglement 2 et leur met un malus de 15% aux jets de défense pendant 1 tour. |
| 4.0 | Cercle de soin | Soin | 26.0 | Soi-même | Cercle de 2 (+1/NM) | 6d6 + 30 soin | Redonne des PV en cercle autour du lanceur, ne soigne pas l''infirmité. |
| 5.0 | Résurrection | Soin | 60.0 | 1.0 | 1.0 | Remet les PV à 1 (+12/NM) | Ressuscite un allié mort depuis max 3 tours. Sinon demande un rituel long. |
| 5.0 | Louange d''Aurora | Soin | 55 (-5/NM) | 2.0 | 1.0 | Sort la cible du coma. | Permet de ranimer un allié dans le coma en lui redonnant 100% de sa santé. Le sort peut être utilisé sur un allié qui n''est pas dans le coma. |

## Notes et commentaires des sorts

**Remarque du sort « Champ de force »**

Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 {{chakra|chakra}} maximum

**Note de la cellule « Effets secondaires » du sort « Fer lumineux »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1

**Note de la cellule « Effets secondaires » du sort « Énergie solaire »**

10% lors de neutre  
20% lors de grand soleil.  
25% lors de canicule.

**Remarque du sort « Mur gamma »** : Les non-morts prennent 2 fois plus de dégâts.

**Remarque du sort « Révélation »**

Il se comporte comme un soleil vis à vis des créatures sensible à la lumière.

Le brouillard obscur bloque son effet.

**Remarque du sort « Condamnation solaire »**

\*Dure 2 tours  
80% de santé restante : +3 dégâts  
60% de santé restante : +6 dégâts  
40% de santé restante : +9 dégâts  
20%  de santé restante : +12 dégâts

**Remarque du sort « Rai solaire »** : Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.

**Remarque du sort « Marque du champion »** : \*Prend en compte l''AM

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-lumiere';
UPDATE page SET corps_md = 'La magie de la nécromancie est une magie spécialisée dans l''invocation et l''entrave. Héritée de la Déesse de la Vie et de la Mort, elle permet de manipuler les forces liées au trépas, aux âmes et aux non-morts.

Les utilisateurs de la nécromancie peuvent invoquer des squelettes, des zombis et d''autres serviteurs non-morts pour combattre à leurs côtés. Ils sont également capables d''affaiblir leurs ennemis, de perturber leur vitalité ou de leur faire de bons dégâts avec le poison.

Associée au deuil, une émotion liée à l''acceptation et à la fixation, la nécromancie rappelle que la mort fait partie du cycle naturel du monde. Si certains utilisent ce pouvoir pour guider les âmes vers leur jugement, d''autres choisissent d''exploiter les morts pour satisfaire leurs propres ambitions.

## Description physique

Les nécromanciens sont généralement plus minces que la moyenne, voire maigres pour les plus anciens, avec moins de formes. Une aura verte émane de leurs mains et ils possèdent des excroissances osseuses par endroits (coude, genou, épaule, phalanges, etc.).

## Données

- **Santé offert** : 5.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : VOLONTÉ
- **4ème barre** : Cette magie utilise la 4ème barre. Elle possède un maximum de 10 Âmes et la régénère de 1 par tour.
- **Résistance magique** : Nécromancie, Sang, Foudre
- **Résistance altération d''état** : Poison, Saignement, Paralysie
- **Vulnérabilité magique** : Glace, Eau
- **Vulnérabilité altération d''état** : Gel, Confusion
- **Magie non compatible** : Sang

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Permet d''avoir deux invocations au lieu d''une seule. Passe le sort animation de mort en IC (ICx2 si jamais il est déjà en IC) |
| Bi-magie | Permet d''avoir deux invocations au lieu d''une seule. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Tir d''âme | Attaque | 3 + 1 âme | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Tire une âme en direction de la cible. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1. |
| 1.0 | Animation de mort | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée. | 3.0 | 1.0 | / | Permet d''invoquer des non-morts |
| 1.0 | Mur d''os | Construction | 4 + 1 âme | 2.0 | 3 cases (+1/NM) | / | Invoque des murs d''os qui possèdent 10 PV chacun. |
| 1.0 | Corruption d''âme | Attaque/ Entrave | 2 âmes | 1 (+1/NM) | 1.0 | 2d6 dégâts | Si jet de vigueur raté = Inflige "poison 1" |
| 1.0 | Détection de vie | Amplification | 7 (–1/NM) + 1 âme | Soi-même | 100 mètres | / | Permet de voir distinctement les formes de vie (animaux et végétaux, ces derniers étant plus sombres) |
| 2.0 | Forces des âmes | Amplification (IC pour 3 NM) | 1 à 5 âmes | 0 (+1/NM) | 1.0 | 3 dégâts/1 âme | Permet d''augmenter sa puissance grâce aux âmes pour le prochain coup. (Maxi 5 âmes d''un coup) |
| 2.0 | Pieu d''os | Attaque | 5 + 2 âmes | 6 (+1/NM) | Cercle de 2 | 3d8 + 4 dégâts. | Invoque de pieu depuis le sol. Si jet de vigueur raté = Inflige poison 1 |
| 2.0 | Armure osseuse | Amplification (IC pour 3 NM) | 5 + 2 âmes | 4.0 | 1.0 | +2AP (+1/NM) | Augmente les AP ainsi que la résistance aux attaques de taille. Dure 3 tours |
| 2.0 | Détection de la mort | Amplification | 9 (–1/NM) + 2 âmes | Soi-même | 100 mètres | / | Permet de détecter distinctement les non-morts et les utilisateurs de la nécromancie. |
| 2.0 | Fer toxique | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie. |
| 3.0 | Seigneur des morts | Amplification   (IC pour 3 NM) | 10 + 3 âmes | 5 | 1 | / | Donne une amplification aux invocations alliés parmis une liste\*. Dure 3 tours. |
| 3.0 | Forge de ses morts | Construction<br>(IC pour 3 NM) | 9 + 2 âmes | Soi-même | 1.0 | / | Utilise des âmes pour créer des armes simples, 1 seule utilisation (+1 par NM). |
| 3.0 | Prison d''os | Construction | 9 + 3 âmes | 6 (+1/NM) | Carré 3x3 | / | Emprisonne chair comme âme. 20 santé. |
| 3.0 | Câlin putréfié | Attaque | 10 + 3 âmes | 3 (+1/NM) | 1.0 | 7d6 + 15 dégâts | Si jet de vigueur raté = Inflige Poison 1. |
| 4.0 | Âme sacrifice | Amplification | 20 + 4 âmes | 10 | 1 | +4 dégâts +2AP et AM/NPM invocation | Sacrifie l''invocation pour augmenter la puissance et défense d''un allié. Dure 3 tours. |
| 4.0 | Vague de cadavre | Attaque | 20 + 4 âmes | 4 (+1/NM) | Ligne de 5 cases | 6d6 + 10 dégâts | Si jet de vigueur raté = Inflige Empoisonné stade 1. |
| 4.0 | Éclatement mortuaire | Attaque/ Amplification<br>(Imparable) | 20 + 4 âmes | 6 | 1 | 6d6 + 20 dégâts | Cible un ennemi, le sort fait une éruption de 2 cases autour de lui, les invocations dans la zone ont un bonus de +5 dégâts à leur prochaine attaque. |
| 4.0 | Répar Os | Soin | 20 + 4 âmes | 1.0 | 1.0 | Soigne 6d6 (+7/NM) | Permet de soigner les os et chair. |
| 5.0 | Réanimation | Invocation | 45 (-3/NM) + 8 âmes | 1.0 | 1.0 | / | Permet de réanimer un corps mort et d’en garder le contrôle pendant 1h. |
| 5.0 | Résurrection noire | Soin | 35 (-2/NM) + 8 âmes | 5.0 | 1.0 | / | Revient sans PV, le {{chakra\|chakra}} est utilisé comme énergie. |
| 3.0 | Festin des âmes | Attaque | 10 + 4 âmes | Soi-même | 4 cibles | 3d6 dégâts par tour | Des âmes affamées attaquent les 4 ennemis les plus proches. Dure 2 tours (+1/NM). |
| 3.0 | Poison de masse | Entrave | 13 (-1/NM) | Soi-même | Cercle de 6 | Inflige poison stade 1 | Si jet de vigueur raté = Inflige Poison 1 à tous les ennemis dans la zone. |
| 3.0 | Plaie toxique | Attaque | 10 + 3 âmes | 6 | 1 | 6d6 + 12 dégâts | Si la cible souffre de poison : +8 dégâts et +1 tour de poison. |
| 3.0 | Venin corrosif | Amplification | 9 + 3 âmes | 1 | 1 | / | Le prochain sort de Nécromancie fera des dégâts considérés comme acide. |
| 4.0 | Purge | Attaque | 20 + 4 âmes | 5 (+1/NM) | 1 | 6d6 + 10 dégâts | Si la cible souffre de poison : +12 dégâts/stade de poison. Retire le poison après le sort. |
| 4.0 | Grenade caustique | Attaque | 20 + 4 âmes | 6.0 | Cercle de 3 | 6d6 + 35 dégâts | Si jet de vigueur raté = Inflige Poison 2 à toutes les cibles (3NM = Sauf alliés). |
| 4.0 | Cimetière ouvert | Météo | 18 + 4 âmes | Soi-même | Terrain | / | Invoque la météo "Purée de pois" pendant 3 tours (+1/NM). |
| 4.0 | Pestilance | Entrave | 20 + 4 âmes | Vue | 1 | / | La cible doit souffrir de poison : La cible emet une aura de 2 cases, ses alliés doivent faire un jet de vigueur sous peine de souffrir du même poison. |
| 5.0 | Déchirure verte | Attaque | 45 (-3/NM) + 8 âmes | 5.0 | 1.0 | 10d6 + 50 dégâts (+10/NM) | Une terrible attaque qui inflige de gros dégâts, Si jet de vigueur raté = Inflige poison 2. |
| 5.0 | Pandémie | Entrave | 40 + 8 âmes | Soi même | Cercle de 3 | 15 dégâts perce AM | Contamine toutes les créatures dans la zone avec Poison 1. À chaque tour, les créatures déjà empoisonnées augmentent leur stade de Poison. |

## Notes et commentaires des sorts

**Remarque du sort « Animation de mort »**

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.

**Note de la cellule « Effets secondaires » du sort « Détection de vie »**

Ce sort permet de changer de vision et de voir la vie grouiller autour de soi, la vie se montre sous forme de petite brume, il est possible de détecter de l''humanoïde au simple brin d''herbe.

Attention un simple mur empêche de voir à travers ce dernier.

**Note de la cellule « Effets secondaires » du sort « Fer toxique »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être empoisonné au stade 1

**Remarque du sort « Seigneur des morts »**

- +10 dégâts
- +6 AP
- +6 AM
- +10% de réussite aux jets
- +2 Vitesse
- 20% de chance de forcer un jet de vigueur/fermeté pour ne pas prendre l''altération d''état de l''élément lié niveau 1 à chaque attaque de l''invocation.

**Remarque du sort « Forge de ses morts »**

Cette arme est considérée comme Spectrale.  
Arme Spectrale = Peut toucher l''immatériel et ignore 50% des AP.

**Note de la cellule « Effets secondaires » du sort « Prison d''os »** : La prison d''os est Invulnérable à l''estoc, Résistant à la taille mais vulnérable à la frappe.

**Note de la cellule « Effets secondaires » du sort « Résurrection noire »** : Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.

**Remarque du sort « Venin corrosif »** : L''attaque en question ne détruira pas les armures ou arme comme pourrai le faire l''eau ou la terre.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-necromancie';
UPDATE page SET corps_md = 'La magie de la terre est une magie spécialisée dans la défense et le soutien. Héritée du Dieu de la Terre, une divinité patiente et loyale, elle puise sa force dans la roche, le métal, la flore et le sol lui-même.

Les utilisateurs de la terre peuvent provoquer des secousses, façonner la pierre et le métal, invoquer de puissants golems ou renforcer leur corps grâce à une armure minérale. Cette magie est également capable de soutenir ses alliés grâce aux propriétés curatives de certains sorts de la terre.

Associée à la détermination, une émotion liée à la ténacité et à l''obstination, la magie de la terre est souvent privilégiée par ceux qui avancent sans jamais céder, quelles que soient les difficultés qui se dressent devant eux.

## Description physique

Les utilisateurs de la Terre sont des personnes qui ont des tailles et une musculature plus haute que la moyenne (comme pour le sang), leurs corps possèdent de légers renforts de pierre un peu partout, les mèches sont brunes et les yeux d''un marron brillant lors de l''utilisation d''un sort.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : FORCE
- **Résistance magique** : Terre, Vent, Foudre
- **Résistance altération d''état** : Pétrification, Surdité, Paralysie
- **Vulnérabilité magique** : Feu, Sang
- **Vulnérabilité altération d''état** : Brûlure, Saignement

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | L''armure physique (AP) de base augmente de 25. |
| Bi-magie | L''armure physique (AP) de base augmente de 10. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Lance-pierre | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Terre. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1. |
| 1.0 | Tremblement | Attaque (Imparable) | 4.0 | 2 (+1/NM) | Cône | 1d6 dégâts (+2/NM) | Frappe le sol, oblige un jet de Stabilité/Réflexe aux cibles pour ne pas tomber. |
| 1.0 | Peau de pierre | Amplification (IC) | 4.0 | 1.0 | 1.0 | +2AP (+1AP/NM) | Augmente l''armure physique pendant 3 tours. Peut se cumuler avec Cuirasse de Roche. |
| 1.0 | Appel aux Golems | Invocation (IC pour 3 NM) | 6 par NPM de la créature invoquée | 3.0 | 1.0 | / | Permet d''invoquer des golems (voir invocation). Sort interdit aux familiers et aux invocations. |
| 1.0 | Racine soignante | Soin | 3.0 | 4.0 | 1.0 | 2d6 soin (+1d6/NM) | Soigne la cible mais doit être dans environnement lié à la terre pour fonctionner |
| 2.0 | Explosion rocheuse | Attaque | 7.0 | 3 (+1/NM) | Carré de 3 | 5d6 dégâts (+3/NM) | Une attaque de Terre de Zone. |
| 2.0 | Fer Raffiné | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Renforce l''arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre. |
| 2.0 | Arbre fertilisant | Invocation | 8.0 | 3.0 | Cercle de 3 | Soigne 2d6 (+2/NM) | Pose un arbre, soigne les alliés à 3 cases autour de lui. Possède 20 PV. Un seul à la fois. |
| 2.0 | Infection | Soin/Entrave (IC pour 3 NM) | 8.0 | 6.0 | 1.0 | 4 dégâts (+1/NM) / tour | Lance une graine qui va aspirer la santé de la cible et la donner au lanceur pendant 3 tours. Les dégâts de l''infection ne sont pas élémentaires. |
| 2.0 | Cuirasse de roche | Amplification (IC) | 7.0 | 1.0 | 1.0 | +4AP (+2AP/NM) | Augmente l''armure physique pendant 3 tours. Peut se cumuler avec Peau de Pierre. |
| 3.0 | Floraison parasitaire | Entrave | 13 | 5 | 1 | -3d8 chakra / tour | Retire du chakra à la cible pendant 4 tours. 3NM permet à la plante de retirer la barrière en même temps. |
| 3.0 | Frappe racine | Attaque | 14.0 | 6 (+1/NM) | 1.0 | 7d6 + 25 dégâts | Si jet de vigueur raté = -1 vitesse pour la cible pour 1 tour. |
| 3.0 | Pollen entravante | Entrave | 12 | Soi même | Croix de 1 (Cercle de 2 si 3NM) | / | Créer une zone autour du lanceur qui oblige ceux qui approche à faire un jet de vigueur, s''ils ratent, ils sont étourdi tant qu''ils sont dans la zone. |
| 3.0 | Enracinement | Soin/Entrave | 13.0 | Soi-même | Cercle de 2 (+1/NM) | 4d6 de soin/tour | Les ennemis dans la zone prennent 5 dégâts et perdent 2INI et 1 Vitesse tant qu''ils sont dans la zone. Le sort reste tant que le lanceur ne bouge pas. |
| 4.0 | Épine perforante | Attaque | 20 | 6 | 1 | 8d6 + 30 dégâts | Ignore 5AM. |
| 4.0 | Grenade Pétrifiante | Attaque | 23.0 | 7.0 | Cercle de 3 | 6d6 + 35 dégâts | Inflige des dégâts de zone de Terre. (3NM = Si jet de vigueur raté = Inflige pétrifié 1). |
| 4.0 | Pétale-bouclier | Protection | 26 (-2/NM) | 3 | 1 | / | Protége un allié pendant 2 tours maximum d''un coup physique qui peut mettre dans le coma. Si protége d''un coup fatal = Voir remarque\* |
| 4.0 | Floraison salvatrice | Soin | 20.0 | 4.0 | 1.0 | 4d6 (+1d/NM) soin/tour | Pose une fleur sur la cible qui va la soigner pendant 3 tours. Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet. |
| 5.0 | Terre Maudite | Attaque | 55 (-5/NM) | 7.0 | 1.0 | 10d6 + 80 dégâts | La cible qui rate son jet de vigueur encaisse une charge de Nécrose, au bout de 4 charges, la cible meurt. |
| 5.0 | Floraison carnivore | Invocation | 55 (-5/NM) | 4 | Cercle de 6 cases | 50 dégâts / tour | Invoque une plante géante qui attaque les ennemis sur son chemin, il reste 4 tours maximum et possède 70 santé. |
| 3.0 | Barrière rocheuse | Protection | 16.0 | 1.0 | 1.0 | Donne une protection | Confère une protection par-dessus la {{barriere\|barrière}} qui encaisse les coups inférieurs à 20 dégâts (+7/NM) |
| 3.0 | Alourdissement | Amplification/ Entrave (IC pour 3 NM) | 15.0 | 5.0 | 1.0 | -20% Réussite / +1D dégâts | Rend l''arme plus lourde et augmente ses dégâts. |
| 3.0 | Sable changeant | Construction | 10 par zone de 3x3 | 2 (+2/NM) | Variable | / | Permet de créer un terrain sur lequel il est difficile de bouger. |
| 3.0 | Rayon géode | Attaque | 12 | 7 | 1 | 20 dégâts (+3/NM) | Tire un rayon qui ignore l''AM. |
| 4.0 | Rouille | Attaque | 20.0 | 4 (+1/NM) | 1.0 | 8d6 dégâts d''acide | 50% de chance de retirer un cran solidité à un morceau d’armure ou une arme. |
| 4.0 | Gemmification | Amplification | 20 | 3 | 1 | -25% dégâts finaux physique | Réduit les dégâts physique subis pendant 2 tours.<br>3NM = réduit les dégâts de 50% au lieu de 25%. |
| 4.0 | Rédemption de Dimitri | Météo | 20.0 | Soi-même | Terrain | / | Invoque la météo "tempête de sable" pendant 3 tours (+1/NM). |
| 4.0 | Anti-Alliage | Amplification (IC pour 3 NM) | 23 | 2 | 1 | / | Reforce la peau et bloque l''effet secondaire des matériaux pendant 3 tours. Ne bloque leur bonus de dégâts. |
| 5.0 | Corps de Maverium | Amplification | 70 (-5/NM) | Soi-même | 1.0 | Invincible | Confère l''état « Corps de Maverium » pour 3 tours. |
| 5.0 | Morsure terrestre | Attaque (Inesquivable) | 55 (-5/NM) | 6.0 | 4x4 | 10d6 + 60 dégâts | Inflige de terribles dégâts perforants. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Racine soignante »** : L''environnement doit être majoritairement de Montagne, Forêt, Plaine, Caverne.

**Note de la cellule « Effets secondaires » du sort « Fer Raffiné »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être pétrifié au stade 1

**Note de la cellule « Effets secondaires » du sort « Frappe racine »** : Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.

**Remarque du sort « Pétale-bouclier »**

\*Met à 1 de santé et +20AP pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.

**Note de la cellule « Effets secondaires » du sort « Terre Maudite »** : La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.

**Remarque du sort « Floraison carnivore »** : Prend 2 fois plus de dégâts des sorts de feu ou de sang.

**Remarque du sort « Barrière rocheuse »**

Si jamais un coup physiques ou magiques est encaisser par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.

**Note de la cellule « Effets secondaires » du sort « Sable changeant »** : Le Terrain sable divise par 2 le déplacement, empêche le sprint et fait perdre un tour si jamais on saute.

**Note de la cellule « Effets secondaires » du sort « Corps de Maverium »** : Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.

## Textes des sorts de niveau 5

### Terre Maudite

> De la pierre naît la destruction,  
> De la terre jaillit la condamnation,  
> Que ce pieu porte en lui la marque d''un fléau,  
> Que la chair qu’il transperce pourrisse et se soumette,  
> Qu’à chaque coup, la mort se rapproche…  
> Et que Dimitri lui-même scelle votre destin !
>
> TERRE MAUDITE !

### Morsure terrestre

> Ô Dimitri, maître des montagnes et des abîmes,  
> Que ta volonté s’élève du sol et réclame son dû,  
> Que la pierre se dresse, impitoyable et implacable,  
> Qu’aucune chair, aucune armure ne résiste à ton courroux,  
> Que la terre s’ouvre, qu’elle enserre, qu’elle transperce,  
> Nul ne fuira l’étreinte de la roche...
>
> MORSURE TERRESTRE !

### Corps de Maverium

> Que ma chair devienne métal, que mon sang devienne acier,  
> Que le poids des montagnes coule dans mes veines,  
> Que nul coup, nulle magie ne puisse m’ébranler,  
> Que mon corps soit l’épreuve que nul ne brisera,  
> Par la volonté de Dimitri, je deviens son mur...
>
> CORPS DE MAVERIUM !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-la-terre';
UPDATE page SET corps_md = 'La magie de l’Arcane est l’essence pure et brute de la magie, une magie primordiale non liée aux éléments. Elle est malléable, semblable à une pâte à modeler que seuls les plus érudits savent sculpter à leur convenance. Contrairement aux autres formes de magie, l’Arcane ne possède ni faiblesses, ni résistances, la rendant d’une polyvalence absolue.

Les utilisateurs de l’Arcane sont souvent perçus comme des érudits ou des visionnaires, recherchant une compréhension totale de la magie elle-même. Bien qu’ils ne possèdent pas de spécialisations dans leur rôle, ils compensent par leur extrême adaptabilité, pouvant utiliser leurs sorts en fonction de l’ennemi ou du besoin du moment. Cette absence de limites fait de la magie de l’Arcane une des plus redoutables, mais aussi l’une des plus complexes à maîtriser. Ceux qui la dominent ne se reposent pas sur un seul atout, mais sur beaucoup de possibilités, faisant d’eux des combattants imprévisibles.

## Description physique

Les utilisateurs de l''arcane sont marqués surtout au niveau des cheveux et du corps, les cheveux possèdent des mèches de couleur argentée et le corps est parsemé de tatouages couleur argent qui deviennent blanc brillant aussi quand un sort est utilisé, plus il y a de puissance, plus les tatouages brillent.

## Explication

Chaque sort qui possède un coût en {{chakra|chakra}} "x/tour" ne possède pas de limite de tour et va consommer du {{chakra|chakra}} tant qu''il est actif. Le lanceur doit faire un jet de magie pour pouvoir réussir son sort (normal jusque-là) et une fois le sort lancé, le sort est maintenu tant que le lanceur le décide ou qu''il perd sa concentration. Il est possible de cumuler plusieurs fois le même sort ou alors de placer le même sort sur différentes cibles, le coût par tour en sera bien plus grand vu que tout se cumule.

Perdre son sort : Si jamais une attaque est encaissée, il est nécessaire de faire un jet de magie/concentration, si jamais il est raté, la concentration est perdue et tous les sorts qui étaient actifs s''arrêtent immédiatement.

Un sort qui possède la mention : XxN/tour, veut dire que le sort va coûter un certain nombre de {{chakra|chakra}} (X) par nombre d''applications qu''il y a eu (N) par tour.  
Exemple : J''ai posé sur 3 personnes différentes un sort qui coûte 3. Donc en 1 tour je vais consommer 9 {{chakra|chakra}}.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 10.0
- **Caractéristiques bonus** : INTELLIGENCE
- **Résistance magique** : Corruption
- **Résistance altération d''état** : Surcharge magique
- **Vulnérabilité magique** : Aucune
- **Vulnérabilité altération d''état** : Aucune
- **Magie non compatible** : Sang, Espace/Temps, Corruption

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Les sorts amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). |
| Bi-magie | Chaque tour, une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Boule de chakra | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Chakra. 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre surcharge magique 1. |
| 1.0 | Charge d''énergie | Amplification (IC pour 3 NM) | 2 pour 1 dégât supplémentaire | Soi-même | 1.0 | +X dégâts magiques | Dégâts magiques supplémentaires pour la prochaine attaque magique. |
| 1.0 | Rune arcane | Amplification<br>(IC x 1/NM) | 3 par tour et par cible | 3.0 | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |
| 1.0 | Claquement | Entrave (IC pour 3 NM) | 4.0 | 5.0 | 1.0 | 1d6 dégâts (+1/NM) | Si jet de fermeté raté = La cible ne peut utiliser de sorts pendant son tour. Ne peut être fait 2 fois de suite sur la même cible. |
| 1.0 | Forge-Magie | Construction (IC) | 2 par taille de l''arme créée | Soi-même | 1.0 | / | Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM) |
| 2.0 | Inhalation magique | Amplification | 5% santé par tour | Soi-même | 1.0 | +5% de {{chakra\|chakra}} | Aspire le chakra ambiant pour régénérer la réserve personnelle. |
| 2.0 | Souffle magique | Amplification | X | 2 (+1/NM) | Cône | Donne X {{chakra\|Chakra}} | Souffle du {{chakra\|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra\|chakra}} donné est divisé. |
| 2.0 | Échange | Soin | 2 pour 1 barrière | 1 (+1/NM) | 1.0 | / | Permet d''échanger son {{chakra\|chakra}} en {{barriere\|barrière}}. 2CK = 1BA (3CK = 2BA/3NM) |
| 2.0 | Fer brillant | Amplification (IC pour 3 NM) | 5 | 1 | 1 | +10 dégâts | Imprègne l''arme d''une énergie brillante. Dure 3 tours. |
| 2.0 | Vague déferlante | Attaque | 9.0 | 5.0 | 1.0 | 5d6 dégâts (+5/NM) | Peut être surchargé (15 {{chakra\|chakra}} en + = 1 dé en +) (maximum 45 {{chakra\|chakra}} en surcharge) |
| 3.0 | Mur de chakra | Construction | 13.0 | 3.0 | 8x2 | / | Bloque 40 (+10/NM) dégâts par tour pendant 3 tours, est détruit s''il prend plus en 1 tour. |
| 3.0 | Projectile arcanique | Attaque | \*4 / projectile | 10 | 1 | 2d6 dégâts/ projectile | Peut cibler une ou plusieurs cibles. Le bonus de dégâts du lanceur ne s''applique qu''une fois par cible touchée.  3NM = Ignore 50% de AM. |
| 3.0 | Rune arcane multiple | Amplification<br>(IC x 1/NM) | 8 par tour et par cible | Tous les alliés | 1.0 | +1 cran de résistance | Augmente la résistance d''une magie au choix. On ne peut pas cumuler la même résistance sur la même cible. |
| 3.0 | Champ gardien | Attaque/Soin | 12.0 | Soi-même | Cercle de 2 | Donne 2d6 + 3 {{barriere\|Barrière}} et 12 dégâts | Invoque un cercle qui va rendre de la {{barriere\|barrière}} aux alliés et infliger des dégâts aux ennemis (3 NM = les dégâts ignorent les AM). |
| 4.0 | Peau nacrée | Amplification<br>(IC x 1/NM) | 12 par tour et par cible | 3.0 | 1.0 | -20% dégâts magiques | Réduit les dégâts magiques finaux subis. |
| 4.0 | Pluie blanche | Amplification | 25% Chakra maximum | 3 (+1/NM) | Carré 4x4 | / | Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi autant de {{chakra\|chakra}} que dépensé. |
| 4.0 | Miroir des arcanes | Amplification | 20.0 | Soi-même | 1.0 | / | Permet de renvoyer le sortilège de l''agresseur, 3 utilisations. (3NM = Ne prend plus l''effet en question). |
| 4.0 | Lance d''éther | Attaque | 24 (-2/NM) | 20 | 1 | 7d6 + 35 dégâts | Une grosse attaque d''arcane. |
| 5.0 | Pâte de la trame | Amplification<br>(+1 utilisation/NM) | 12 par effet et par tour | 1 | 1 | / | Le lanceur donne un boost pour les sorts parmis une liste\*. Chaque boost maintenu augmente la consommation de chakra. |
| 5.0 | Planète chakratique | Attaque | 0.0 | Illimité | Carré 6x6 | X dégâts | Les dégâts correspondent aux CK donnés par le lanceur et alliés. 2CK (1CK/3NM) = 1 dégâts |
| 3.0 | Rupture d''armure | Entrave | 13 | 5 | 1 | / | Divise par 2 les AM de base de la cible pendant 3 tours. 3NM = Divise par 2 les AM de l''armure en plus. |
| 3.0 | Laser de chakra | Attaque | 12.0 | 7.0 | 1.0 | 20 dégâts (+3/NM) | Tire un rayon qui ignore l''AM. |
| 3.0 | Pillage défensif | Attaque | 16 (-2/NM) | 1.0 | 1.0 | 7d6 + 15 dégâts | Inflige des dégâts et permet de récupérer 25% des dégâts en {{barriere\|barrière}}. |
| 3.0 | Surdéchirure | Attaque/Entrave | 15 | 6 | 1 | 7d6 + 15 dégâts | Si jet de fermeté raté = Inflige surcharge magique .1 |
| 4.0 | Contre-sort | Entrave<br>(Réaction) | Variable selon le sort bloqué | 6 (+2/NM) | 1 | / | La lanceur bloque un sort ennemi lvl 1-4 le faisant passer de réussite à échec. Le coût correspond au sort qui a été bloqué. (1 fois par tour) |
| 4.0 | Effondrement terne | Attaque | 24 | 6 | 1 | 5d6 + 40 dégâts | Si jet de fermeté raté = Inflige surcharge magique 1. |
| 4.0 | Grenade de chakra | Attaque | 23.0 | 6 (+1/NM) | Cercle de 2 | 8d6 + 30 dégâts | Inflige des dégâts en Zone. |
| 4.0 | Foudre argenté | Attaque/Entrave | 20 | 6.0 | 1.0 | 3d10 dégâts (+10/NM) | Inflige de lourds dégâts.<br>Si jet de fermeté raté = Perd une résistance aléatoire pendant 1 tour. |
| 5.0 | Drain d''énergie | Entrave | 50.0 | Vue | 1.0 | Vole 5d10 (+1d/3NM) {{chakra\|chakra}} | Vole du {{chakra\|chakra}} aux ennemis visibles. Le {{chakra\|chakra}} récupéré est redistribué aux alliés |
| 5.0 | Cassage gris | Attaque | 55 (-5/NM) | 8 | 1 | 10d6 + 70 dégâts | Inflige de terribles dégâts d''arcane. Si jet de fermeté raté = Inflige surcharge magique 2. |

## Notes et commentaires des sorts

**Remarque du sort « Charge d''énergie »** : 30 {{chakra|chakra}} maximum en 1 fois

**Note de la cellule « Effets secondaires » du sort « Rune arcane »** : Ne se cumule avec "Rune Arcane multiple"

**Note de la cellule « Effets secondaires » du sort « Forge-Magie »**

Exemple :

Un caillou c''est taille 1  
Une dague c''est taille 2

Les bombes ne font pas les dégâts de zone.

**Remarque du sort « Projectile arcanique »**

L''AM est pris en compte pour chaque projectile.

\*Le coût augmente de 1 à chaque projectile envoyé sur l''action (le premier coute 4, le second coute 5, etc)

**Note de la cellule « Effets secondaires » du sort « Rune arcane multiple »** : Ne se cumule avec "Rune Arcane"

**Remarque du sort « Pâte de la trame »**

\*
- +15 dégâts magiques
- +3 portée avec les sorts
- +1 portée d''une zone
- Le CC d''une attaque oblige le jet de vigueur/fermeté pour ne pas prendre l''altération d''état lié au niveau 1

**Note de la cellule « Effets secondaires » du sort « Laser de chakra »** : Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.

**Remarque du sort « Pillage défensif »** : Le regain ne peut être effectif que si c''est la {{barriere|barrière}} ennemie qui est touchée.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

Niveau de Maîtrise (NM)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-larcane';
UPDATE page SET corps_md = 'La magie de l''eau est une magie polyvalente spécialisée dans le soin, les dégâts et l''entrave. Héritée de la Déesse de l''Eau, une divinité bienveillante, elle est capable aussi bien de protéger la vie que de déchaîner la puissance des flots.

Les utilisateurs de l''eau manipulent l''eau sous toutes ses formes, influencent les courants et peuvent même perturber les marées. Cette magie permet de soigner les blessures, d''entraver les adversaires ou de les frapper avec la force de l''eau. Elle est également utilisée pour la purification, l''irrigation et de nombreuses tâches du quotidien.

Associée à l''empathie, une émotion liée à la compassion et à l''abnégation, la magie de l''eau exige responsabilité et maîtrise, car une utilisation imprudente peut provoquer d''importants dégâts ou perturber l''équilibre naturel des eaux.

## Description physique

Les spécialistes de l''eau ont les mèches bleutées, très longues et mouillées en permanence, ont un corps plus esthétique que la moyenne, ce dernier transpire de l''eau tout le temps, les yeux sont bleu azur lors de l''utilisation d''un sort.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : SOCIAL
- **Résistance magique** : Eau, Feu, Nécromancie
- **Résistance altération d''état** : Confusion, Brûlure, Poison
- **Vulnérabilité magique** : Foudre, Sang
- **Vulnérabilité altération d''état** : Paralysie, Saignement

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | L''utilisateur du mode hyper est considéré comme une source d''eau pour lui et ses alliés.<br>La première attaque subie réduit ses dégâts finaux de 20%. |
| Bi-magie | L''utilisateur du mode hyper est considéré comme une source d''eau QUE pour lui.<br>La première attaque subie réduit ses dégâts finaux de 20%. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Bulle d''eau | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque d''Eau. 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre confusion 1. |
| 1.0 | Tir de flotte | Attaque | 4.0 | 11.0 | 1.0 | 2d4 dégâts (+2/NM) | Une attaque d''eau qui se tire en ligne uniquement. Bonus de +1D dégâts si utilisé à 4 cases de l''eau. |
| 1.0 | Mucus protecteur | Protection (IC) | 4.0 | 1.0 | 1.0 | -6 dégâts magiques (-2/NM) | Ignore des dégâts magiques. L''effet augmente de +4 si utilisé à 4 cases de l''eau. |
| 1.0 | Eau purifiante | Soin (IC pour 3 NM) | 3.0 | 1.0 | 1.0 | Soigne une altération d''état | Permet de soigner "Poison 1", "Brûlure 1", "Paralysie 1".<br>Soigne 4 santé si utilisé à 4 cases de l''eau. |
| 1.0 | Eau soignante | Soin | 4.0 | 1.0 | 1.0 | 2d6 (+4/NM) de soin | Une eau qui soigne les blessures, si un point d''eau est à 4 cases les Dés passent à 8 au lieu de 6. |
| 2.0 | Fer humide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme transpire de l''eau : pendant 3 tours, ses attaques infligent des dégâts d''eau. |
| 2.0 | Souffle hydraulique | Attaque/ Entrave (Imparable) | 7.0 | 3.0 | Cône | 5d6 dégâts (+3/NM) | Si jet de fermeté raté = Inflige confus. |
| 2.0 | Onde confusion | Entrave (IC pour 3 NM) | 9.0 | 4.0 | 1.0 | => | Jet de fermeté raté = Inflige "Confusion 1"<br>Jet de fermeté réussi = Inflige 4 dégâts perce AM |
| 2.0 | Barrière d''eau | Soin | 10.0 | Soi-même | 1.0 | / | Régénère 10% de la {{barriere\|barrière}} (+5% par Niveau de Maîtrise), +10 {{barriere\|barrière}} bonus si jamais fait à 4 cases de l''eau. |
| 2.0 | Ruisseau conciliant | Soin | 10.0 | Soi-même | Croix de 1 | 3d6 (+4/NM) de soin | Des petits courants d''eau qui viennent soigner. La zone devient un cercle si un point d''eau est à 4 cases. |
| 3.0 | Trombe d''eau | Attaque | 16 (-2/NM) | 5.0 | Carré de 3x3 | 7d6 + 15 dégâts | Une urne remplie d''eau se déverse sur la zone. Bonus de +15 dégâts si un point d''eau est à 2 cases. |
| 3.0 | Lame sous pression | Attaque | 16.0 | 1.0 | 3 cases horizontales devant (ou verticales/3NM) | 7d6 + 5 dégâts | Une lame faite d''eau sous pression tranche les adversaires. Ignore les AM quand un point d''eau est à 4 cases. |
| 3.0 | Crachat Acide | Attaque/ Entrave | 16.0 | 5.0 | 1.0 | 5d6 dégâts (+3/NM) d''acide | 50% de chance de retirer un cran solidité à un morceau d’armure ou une arme. |
| 3.0 | Courant salvateur | Placement | 16.0 | 6.0 | Ligne de 5 | Déplace la/les cible(s) | Place un un courant d''eau qui va déplacer les cibles dessus de 1(+1/NM) cases dans la direction décidée par le lanceur. |
| 4.0 | Fouet d''eau | Attaque | 20.0 | 4 (+2/NM) | 1.0 | 8d6 + 10 dégâts | Augmente de 5% la RC si à 4 cases d''un point d''eau. |
| 4.0 | Grenade Incapacitante | Attaque/ Entrave | 26.0 | 8.0 | Cercle de 3 | 8d6 + 35 dégâts | Inflige des dégâts de zone d''Eau.<br>(3NM = Si jet de fermeté raté = Inflige confus 1). |
| 4.0 | Geyser | Attaque | 24 | 6 | 1 | 8d6 + 35 dégâts | Si jet de stabilité/réflexe raté = Tombe au sol |
| 4.0 | Vortex | Placement | 20 (-2/NM) | 10 | Cercle de 4 | / | Attire les cibles en son centre. Inflige 10 dégâts perce AM si à 4 cases d''un point d''eau. |
| 5.0 | Torrent colérique | Attaque/ Entrave | 55 (-5/NM) | 20 | Ligne | 10d6 + 60 dégâts | Une attaque d''Eau en ligne qui touche tout sur son chemin. Si jet de stabilité/réflexe raté = Tombe au sol |
| 5.0 | Zone abyssal | Construction | 50 | Soi même | Terrain | / | Rempli le terrain d''eau, ce qui pousse à utiliser la vitesse de nage. Dure 3 tours (+1/NM) |
| 3.0 | Dorsale protectrice | Protection | 18 (-2/NM) | 1 | 1 | / | L''armure obtient une résistance à la frappe, avantage pour résister aux sorts de placement, réduit les dégâts de 10. Dure 3 tours. |
| 3.0 | Siphon vital | Attaque/Soin | 14 | 6 | 1 | 5d6 + 15 dégâts | Vampirise 25% des dégâts infligés à la santé. (50% au niveau 3 de maîtrise). |
| 3.0 | Rivière douce | Soin | 14 | 1 | 1 | 3d6 de soin (+8/NM) | Un sort de soin de l''eau. +3 portée si à 4 cases d''un point d''eau. |
| 3.0 | Eau Parfaite | Soin (IC pour 3 NM) | 14.0 | 1.0 | 1.0 | Soigne une altération d''état, +4d6 soin | Soigne toutes les altérations d''état liées à des éléments. |
| 4.0 | Laser hydraulique | Attaque | 26 (-2/NM) | 14 | 1 | 35 dégâts | Tire un rayon qui ignore l''AM. +10 dégâts si à 4 cases d''un point d''eau. |
| 4.0 | Dissolution | Amplification (IC pour 3 NM) | 20.0 | Soi-même | 1.0 | / | S''il est fait dans l''eau : totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Réduit de 10 les dégâts encaissés quand il est fait en dehors de l’eau. Dure 3 tours. |
| 4.0 | Crachin | Météo | 20.0 | Soi-même | Terrain | / | Invoque la météo "pluie" ou "pluie diluvienne" pour 3 tours (+1/NM). |
| 4.0 | Cascade apaisante | Soin | 26 (-2/NM) | 4.0 | 1.0 | 7d6 soin/tour | Régénération pendant 3 tours. +1 tour si utilisé à 4 cases de l''eau. Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet. |
| 5.0 | Larmes d''Océane | Entrave | 55 (-5/NM) | Soi-même | Terrain | / | (S''ajoute avec la météo pluie ou +) Empêche les Sorts Feu et Foudre d''être utilisés le temps de la météo. |
| 5.0 | Pitié d''Océane | Soin | 55 (-5/NM) | 2.0 | 1.0 | Sort la cible du coma. | Permet de ranimer un allié dans le coma en lui redonnant 1PV et 100% de sa {{barriere\|barrière}}. Donne 10PV près d''un point d''eau. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Fer humide »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être confus au stade 1

**Note de la cellule « Effets secondaires » du sort « Courant salvateur »**

Ne déclenche pas d''attaques d''opportunités

Soigne les alliés de 2d6 si un point d''eau est à 4 cases.

**Remarque du sort « Laser hydraulique »** : Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.

**Note de la cellule « Effets secondaires » du sort « Larmes d''Océane »**

Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.  
Le Don "Climatosceptique" ne peut pas contrer cet effet.  
Cet effet dure maximum 5 tours.

## Textes des sorts de niveau 5

### Torrent colérique

> Que l’eau cesse d’être douce et devienne une lame,  
> Que la pression des mers s’aligne dans mon bras,  
> Que le courant renverse tout ce qu’il traverse,  
> Que nul obstacle n’échappe à la Dame,  
> Et que la vague pure devienne un rayon destructeur…
>
> LASER HYDRAULIQUE !

### Larmes d''Océane

> Que la pluie porte le souffle sacré d’Océane,  
> Que chaque goutte étouffe les flammes les plus hautes,  
> Que le tonnerre lui-même perde sa voix sous son voile,  
> Que nul élément ne puisse contester sa souveraineté,  
> Et que le ciel se plie au règne immuable de Sa volonté…
>
> LARMES D’OCÉANE !

### Pitié d''Océane

> Ô Océane, que ta marée relève le corps brisé,  
> Que tes eaux referment ce que la douleur a ouvert,  
> Que la mer rende souffle à celui qui l’a perdu,  
> Que la {{barriere|barrière}} se reforme sous ton courant apaisant,  
> Et que ta bienveillance nous le ramène vers nous…
>
> PITIÉ D’OCÉANE !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-leau';
UPDATE page SET corps_md = 'La magie de l’Espace-Temps est une magie primordiale qui dicte les lois du mouvement et de la distance. Elle permet à ses utilisateurs de plier la réalité à leur volonté, ouvrant des brèches sur le terrain ou manipulant la position de leurs ennemis et alliés en un clin d’œil.

Les utilisateurs de l’Espace-Temps peuvent, à un niveau basique, créer des portails pour se déplacer rapidement entre deux points. Les plus puissants pratiquants de cette magie sont capables de manipuler l’espace autour de leurs adversaires, les téléportant contre leur gré, les envoyant dans des pièges ou les isolant de leurs alliés.

Bien qu’elle ne soit pas une magie de destruction directe, la magie de l’Espace-Temps est l’ultime outil tactique, rendant ses utilisateurs difficiles à approcher. Ne les sous-estimez jamais, ils ont toujours un coup d''avance par rapport à vous.

## Description physique

Les utilisateurs de l''Espace/Temps possèdent d''étranges bandages de momies couleur rose sur les mains, bras (jusqu''en bas du coude), pieds et jambes (jusqu''en bas du genou) et semblent être impossibles à enlever ou détruire, comme si c''était une seconde peau. Les mèches de cheveux sont roses.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 10.0
- **Caractéristiques bonus** : INTELLIGENCE
- **Résistance magique** : Espace/Temps
- **Résistance altération d''état** : Fatigue
- **Vulnérabilité magique** : Vide
- **Vulnérabilité altération d''état** : Enragé
- **Magie non compatible** : Sang, Arcane, Corruption, Vide

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Lorsqu''il subit une attaque/effet qui le bouge, il peut décider de bouger ou non.<br>(IC) Peut utiliser un sort de l''espace/temps capable de placement juste après une action, qui ne fera rien d''autre qu''un placement (1 fois/mode hyper). |
| Bi-magie | Il ne peut pas être bougé de sa position.<br>(IC) Peut utiliser un sort de l''espace/temps capable de placement juste après une action, qui ne fera rien d''autre qu''un placement (1 fois/mode hyper). |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Coup du sablier | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Temps. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1. |
| 1.0 | Téléportation | Placement (IC) | 5.0 | 5 (+1/NM) | 1.0 | / | Se téléporte symétriquement par rapport à la cible. |
| 1.0 | Portail | Placement (IC x 2) | 2.0 | 5 (+2/NM) | 1.0 | / | Invoque un portail. La liaison se fait selon l''ordre d''apparition des portails. |
| 1.0 | Substitution | Placement | 6.0 | 6 (+1/NM) | 1.0 | / | Permet d''échanger sa place par rapport à un objet de taille à peu près égale et qui n''est pas "indéplaçable" |
| 1.0 | Chute | Attaque | 5.0 | 6.0 | Carré 2x2 | 2d4 (+3/NM) dégâts | Invoque un mini portail en dessous d''un objet TP ou P et le fait tomber sur la cible. |
| 2.0 | Fer temporel | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d''espace-temps. |
| 2.0 | Faille chronique | Placement | 8 (-1/NM) | Vue | 1 | / | \[Se combine avec une attaque distance\] Envoie le projectile dans une faille qui va aller sur une cible aléatoire |
| 2.0 | Ralentissement | Entrave (IC) | 6 | 4 (+1/NM) | 1.0 | / | Si jet de Fermeté raté = -2 à la vitesse de la cible pour 3 tours. |
| 2.0 | Inversion | Placement (IC) | 10.0 | 8 (+2/NM) | 1.0 | / | Échange sa place avec celle de la cible |
| 2.0 | Main de la momie | Attaque/ Placement | 10 (-1/NM) | 6.0 | 1.0 | 5d6 dégâts (+3/NM) | Invoque une main géante en bandelette, téléporte la cible symétriquement par rapport au lanceur. (choix possible) |
| 3.0 | Spayon | Attaque | 15 | 4 (+2/NM) | 1 | 7d6 + 15 dégâts | Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1. |
| 3.0 | Espace relatif | Entrave (IC pour 3NM) | 15 | Soi même | Cercle de 2 | Malus de 25% | Ceux qui sont dans la zone impose un malus pour toucher à ceux qui tente de les attaquer à plus de 3 cases de distance. Dure 3 tours. |
| 3.0 | Portail Piégé | Placement/ Attaque | 15.0 | 6.0 | 1.0 | 7d6 + 15 dégâts | Permet d''invoquer un portail piégé qui est relié aux autres portails. (3NM = Pas de dégâts alliés) |
| 3.0 | Principe d''incertitude | Amplification | 15 | 4 | 1 | / | Donne une seule réaction qui permet de se téléporter de 2 cases après qu''une attaque hostile a touchée. Reste 3 tours tant qu''il n''est pas utilisé. |
| 4.0 | Vitesse relative | Entrave (IC pour 3 NM) | 23 | Soi même | Cercle de 6 | / | Créer une zone où les alliés ont +1 vitesse et +1IC. Les ennemis ont -1 vitesse et -2IC. Dure 3 tours. |
| 4.0 | Grenade distordue | Attaque/ Placement | 23.0 | 7.0 | Cercle de 2 (+1/3NM) | 8d6 + 20 dégâts | Téléporte symétriquement par rapport à la grenade toutes les cibles dans son rayon d''action. |
| 4.0 | Ancrage dimensionnel | Entrave (IC) | 22 (-2/NM) | 7 | 1 | / | Empêche la cible d''exploiter l''effet de placement de ses sorts pendant 2 tours. |
| 4.0 | Image diffuse | Amplification (IC pour 3 NM) | 10 par clone | Soi-même | Carré 4x4 | / | Invoque 1 ou 2 clones (+1/NM) passifs du lanceur. |
| 5.0 | Trou noir | Attaque | 55 (-5/NM) | 9.0 | Cercle de 3 | 10d6 + 60 dégâts | Attire les cibles vers le centre de l''attaque, impossible de lutter contre. |
| 5.0 | Distorsion | Entrave | 50 (-5/NM) | Vue | Terrain | / | Si jet de fermeté raté = Perd le tour.<br>Si jet de fermeté réussi = Étourdi pour 1 tour. |
| 3.0 | État antérieur | Amplification/ Entrave (IC) | 16 (-1/NM) | 4.0 | 1.0 | / | Remet l''objet à un état antérieur il y a 10 secondes ou 1 minute. |
| 3.0 | Tranche temps | Attaque<br>(Imparable/ Inesquivable) | 14.0 | 1.0 | 1.0 | 5d6 dégâts (+3/NM) | Inflige une blessure dans le passé à l''adversaire. |
| 3.0 | Vieillissement | Entrave | 13 (-1/NM) | 6.0 | 1.0 | / | Si jet de Fermeté raté = 1 croix sur la FORCE, PERCEPTION, AGILITÉ mais donne un bonus de 10% pour les tests d''intelligence et de volonté pendant 3 tours. |
| 3.0 | Horloge aspirante | Attaque/Soin | 14.0 | 6.0 | 1.0 | 7d6 dégâts | Vampirise 25% des dégâts infligés. (50% au niveau 3 de maîtrise), marche que sur les créatures vivantes. |
| 4.0 | Célérité | Amplification (IC pour 3 NM) | 23.0 | 4.0 | 1.0 | +1 action | Permet d''avoir une deuxième action pendant le tour, dure 3 tours. |
| 4.0 | Erreur ultérieur | Amplification (IC pour 3 NM) | 20 | 1 | 1 | / | Donne une seule réaction qui permet de relancer un jet d''attaque raté pour un allié/réussi pour un ennemi. Reste 3 tours tant qu''il n''est pas utilisé. |
| 4.0 | Téléport parfait | Placement | 20.0 | 20Km (+20/NM) | 1.0 | / | Permet de voyager sur de grandes distances. Les autres doivent toucher le lanceur pour être téléportés. |
| 4.0 | Vision déphasé | Attaque/Entrave | 21 | 14 | 1 | 3 x 2d6 dégâts | Tire un rayon qui ignore l''AM.<br>Si jet de fermeté raté = Impose un malus de 25% à ses jets d''attaque et de défense pendant 1 tour. |
| 5.0 | Prémonition | Attaque<br>(Imparable/ Inesquivable) | 50 (-5/NM) | Soi-même | 1.0 | 10d6 + 40 dégâts | Puissante attaque de temps arrivant avec une latence de deux tours, va frapper un adversaire au hasard. |
| 5.0 | Convergence | Amplification | 40 | 4 | 1 | / | Invoque un clone qui va reproduire les deux prochaines actions réussi à hauteur de 50% (100%/3NM) des effets. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Téléportation »**

Ne provoque pas d''attaque d''opportunité.

Ce sort permet également de contrer les ennemis qui voudraient se téléporter, pour que ça marche : il est nécessaire d’avoir le sort, de sacrifier une parade/esquive, de réussir un meilleur jet et que l’ennemi soit dans la portée du sort.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)

**Remarque du sort « Portail »** : Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du {{chakra|chakra}}.

**Note de la cellule « Effets secondaires » du sort « Fer temporel »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être fatigué au stade 1

**Note de la cellule « Effets secondaires » du sort « Inversion »**

Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contré par "Téléportation"

**Note de la cellule « Effets secondaires » du sort « Main de la momie »**

Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)

**Note de la cellule « Effets secondaires » du sort « Grenade distordue »** : Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.

**Note de la cellule « Effets secondaires » du sort « Image diffuse »**

Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.  
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.  
Si un clone prend un coup, il disparait.

**Note de la cellule « Effets secondaires » du sort « Distorsion »** : Perdre le tour ne signifie pas perdre sa posture.

**Note de la cellule « Effets secondaires » du sort « État antérieur »** : Pour les armures, il faut faire le sort sur CHAQUE morceau.

**Remarque du sort « Horloge aspirante »**

Si c''est la {{barriere|barrière}}, la {{barriere|barrière}} est vampirisée.  
Si c''est les points de vie, c''est les points de vie qui sont vampirisés

**Note de la cellule « Effets secondaires » du sort « Célérité »** : Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-lespace-temps';
UPDATE page SET corps_md = 'La magie de l''ombre est une magie spécialisée dans l''entrave. Héritée d''Umbro, le Dieu de l''Ombre et des intrigues, elle excelle dans l''affaiblissement des adversaires et la manipulation des situations à son avantage.

Les utilisateurs de l''ombre manipulent l''obscurité pour infliger de nombreux effets négatifs, perturber leurs ennemis ou même utiliser leur ombre pour attaquer. Cette magie est particulièrement redoutable pour contrôler le déroulement d''un affrontement et exploiter les zones plongées dans les ténèbres.

Associée à la prudence, une émotion liée à la clairvoyance et à la paranoïa, la magie de l''ombre est souvent mal perçue en raison de ses liens avec la discrétion, les complots et les activités criminelles, bien que tous ses utilisateurs ne suivent pas cette voie.

## Description physique

Les utilisateurs de l''ombre ont des cheveux généralement plus courts et des mèches mauves, les yeux violets lors d''une utilisation de sort. Certains possèdent des bracelets faits d''ombre violettes, d''autres possèdent des cornes de Chakra couleur mauve (plus clair pour les femelles et plus sombre pour les mâles) si la race possède des cornes physiques : c''est une aura ténébreuse violette qui les entoure ou alors une aura sombre émane de leur main et pied.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : PERCEPTION
- **Résistance magique** : Ombre
- **Résistance altération d''état** : Peur
- **Vulnérabilité magique** : Lumière
- **Vulnérabilité altération d''état** : Aveuglement

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Les sorts entraves deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). |
| Bi-magie | Chaque tour, une entrave est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Sphère Obscure | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque d''Ombre. 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre peur 1. |
| 1.0 | Perturbation | Attaque/ Entrave<br>(Imparable) | 3.0 | 6.0 | 1.0 | 2d4 dégâts | Si jet de fermeté raté = -10% (-10%/NM) à sa prochaine action |
| 1.0 | Marionnette de l''ombre | Invocation (IC pour 3 NM) | 5 par NPM de la créature invoquée. +10% Barrière | 3.0 | 1.0 | / | Permet d''animer sa propre ombre (voir invocation) |
| 1.0 | Brume mental | Entrave (IC pour 3 NM) | 4.0 | 6.0 | 1.0 | / | Si jet de fermeté raté = Met une croix dans 1 une caractéristique au choix de l’adversaire pendant 1 tour. |
| 1.0 | Pichenette | Entrave (IC) | 4.0 | 6.0 | 1.0 | -5 INI (-2/NM) | II : Diminue l''initiative de la cible à son prochain tour.<br>IG : Diminue l''initiative passivement du premier jet d''initiative ennemi. |
| 2.0 | Cri ébranleur | Attaque/ Entrave (Imparable) | 8.0 | 6.0 | Cône | 5d6 dégâts sonores (+3/NM) | Une attaque aux dégâts sonores qui inflige un malus de 10% au prochain test de la victime. |
| 2.0 | Manteau noir | Amplification (IC pour 3 NM) | 7 par NPM de la créature sacrifiée | Soi-même | 1.0 | Variable | Permet de sacrifier l''invocation de l''ombre pour avoir des bonus pendant 3 tours (voir invocation) |
| 2.0 | Lame d’ombre | Attaque/ Amplification | 9.0 | Soi-même | 1.0 | 3d6 dégâts | Créer 1 (+1/NM) lame(s) autour du lanceur, chaque lame va taper après une attaque du lanceur réussie. |
| 2.0 | Malédiction | Entrave (IC) | 7.0 | 3.0 | 1.0 | -1d de dégâts | Diminue les dégâts pendant 2 tours (+1/NM). |
| 2.0 | Fer obscur | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme se charge d''une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d''ombre. |
| 3.0 | Brouillard Obscur | Météo | 12.0 | Soi-même | Terrain | / | Invoque le brouillard obscur pour 3 tours (+1/NM). |
| 3.0 | Javelot lunaire | Attaque | 16 (-1/NM) | 12 | Ligne | 7d6 +15 dégâts | Une puissante attaque d''ombre. |
| 3.0 | Amplification sombre | Amplification (IC) (IC x 2 si 3NM) | 5 + 10% santé | 1.0 | 1.0 | +12 dégâts, +5% EC | Augmente dangereusement les dégâts pour 2 tours. (cumulable 2 fois) |
| 3.0 | Marque suintante | Entrave (IC pour 3 NM) | 12.0 | 3.0 | 1.0 | / | Empêche la cible de récupérer de la santé avec des sorts, dure 3 tours. |
| 4.0 | Rayon lunatique | Attaque/ Entrave | 22 (-2/NM) | 7 | 1.0 | 5d6 dégâts (+4/NM) | Fermeté raté = Inflige Peur 1 |
| 4.0 | Grenade fumigène | Attaque/ Entrave | 23.0 | 6.0 | Cercle de 3 | 6d6 + 35 dégâts | Inflige des dégâts de zone d''Ombre.<br>Si jet de vigueur raté = Malus de 25% pour tous les jets pour 1 tour (-10%/NM) |
| 4.0 | Défaite annoncée | Entrave (IC pour 3 NM) | 25.0 | Soi-même | Cercle de 10 | / | Malus de 8 dégâts, +5 à l''échec critique et augmente la consommation de CK de 5 aux ennemis. Dure 1 tour. |
| 4.0 | Régolithe | Entrave | 20 (-2/NM) | 5 | 1.0 | / | Fermeté réussi = Inflige Peur 2<br>Fermeté raté = Inflige Peur 3 |
| 5.0 | Chaîne de l''entrave | Entrave | 55 (-5/NM) | 6.0 | 1.0 | 20 dégâts perce AM/échec | Bloque totalement une cible. Chaque échec pour sortir de l''entrave du sort inflige des dégâts. Voir remarque |
| 5.0 | Frappe négative | Attaque/ Entrave | 55 (-5/NM) | 8.0 | 1.0 | 10d6 + 70 dégâts | Lance un rayon différent des autres, plus la santé est basse, plus les effets sont puissants (voir la liste en commentaire) |
| 3.0 | Grand bailleur | Attaque/ Entrave (Inesquivable) | 12 | 4 | Cône | 5d6 dégâts sonores (+6/NM) | Si jet de fermeté raté = Inflige somnolence 1 |
| 3.0 | Marchand de sable | Entrave<br>(IC) (IC x 2 si 3NM) | 10 | 6 | Cercle de 2 | / | Si jet de fermeté raté = Inflige somnolence 1 à ceux dans le cercle. |
| 3.0 | Cauchemar | Attaque | 14 | Vue | Illimité | 3d6 dégâts / niveau somnolence | Inflige des dégâts aux cilbes qui ont un niveau de somnolence. Ne touche pas les alliés avec 3NM. |
| 3.0 | Ombre Menaçante | Entrave (IC pour 3 NM) | 14.0 | Soi-même | Aux ennemis qui peuvent voir | / | L''ombre du lanceur grandit et prend une apparence cauchemardesque. Si jet de fermeté raté = Inflige Peur 1. |
| 4.0 | Trait somnoleur | Attaque | 20 (-2/NM) | 14 | 1 | 25 dégâts | Inflige +7 dégâts bonus par niveau de somnolence de la cible. Ignore l''AM. |
| 4.0 | Mauvaise nuit | Entrave | 22 (-2/NM) | 5 | 1 | +5 dégâts/niv somnolence encaissé | La cible doit souffrir de somnolence : Applique une marque qui fait qu''il prendra plus de dégâts des attaques tant qu''il souffre de l''altération d''état. |
| 4.0 | Croire aux rêves | Amplification (IC) | 20 | 3 | 1 | +10% à la réussite | Dure 1 tour (+1/NM). |
| 4.0 | Pire ami | Entrave (IC pour 3 NM) | 22.0 | Vue | 1.0 | / | Donne vie à l''ombre de la cible pour 6 tours et va attaquer qu''elle. Peut être décimé par une attaque de Lumière. |
| 5.0 | Armée de l''ombre | Attaque | 55 (-5/NM) | Illimité | Sur 4 ligne devant le lanceur | 4d10 + 60 dégâts | Ignore la défense partielle à 3NM. Les ennemis qui souffrent de somnolence prennent 10 dégâts/niveau de somnolence. |
| 5.0 | Prophétie | Amplification | 55 | 3 | 1 | / | Donne un avantage à tous les jets pendant 2 tours. Encaisse somnolence 2 à la fin. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Marionnette de l''ombre »** : Sort interdit aux familiers et aux invocations.

**Remarque du sort « Pichenette »**

II : Initiative individuelle  
IG : Initiative groupée

**Note de la cellule « Effets secondaires » du sort « Lame d’ombre »** : La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une

**Note de la cellule « Effets secondaires » du sort « Fer obscur »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Peur au stade 1

**Note de la cellule « Effets secondaires » du sort « Amplification sombre »** : EC = Échec critique

**Note de la cellule « Effets secondaires » du sort « Défaite annoncée »** : Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.

**Note de la cellule « Effets secondaires » du sort « Chaîne de l''entrave »**

La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :  
1re tentative : Réussite divisée par 2  
2e tentative : Réussite divisée par 1.5  
3e tentative : Réussite divisée par 1.25  
4e tentative : Score normal

Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.

**Note de la cellule « Effets secondaires » du sort « Frappe négative »**

Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts

**Note de la cellule « Effets secondaires » du sort « Ombre Menaçante »**

L''ombre reste 3 tours.

Le jet de fermeté se relance tous les débuts de tour.

**Note de la cellule « Effets secondaires » du sort « Pire ami »** : Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-de-lombre';
UPDATE page SET corps_md = 'La magie du feu est une magie offensive spécialisée dans les dégâts, l''entrave et le renforcement. Héritée du Dieu du Feu, une divinité chaotique, elle est réputée pour sa puissance destructrice et sa capacité à transformer son environnement.

Les utilisateurs du feu peuvent créer et manipuler les flammes sous de nombreuses formes. Ils sont capables d''embraser leurs ennemis, de contrôler la chaleur ou de renforcer armes et alliés grâce à une énergie brûlante. En dehors du combat, cette magie permet également d''allumer des foyers, chauffer des lieux ou alimenter certains travaux artisanaux.

Associée à l''ardeur, une émotion liée au courage et à la colère, la magie du feu reste difficile à maîtriser. Une utilisation imprudente peut rapidement devenir incontrôlable et provoquer d''importants dégâts collatéraux.

## Description physique

Les utilisateurs du feu ont certaines mèches rouges vif, les yeux rouges lors de l''utilisation d''un sort, possèdent des brûlures un peu partout sur le corps, leurs mains sont un peu calcinées (comme du bois brûlé encore chaud) et produisent du feu.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : SOCIAL
- **Résistance magique** : Feu, Glace, Terre
- **Résistance altération d''état** : Brûlure, Gel, Pétrification
- **Vulnérabilité magique** : Eau, Vent
- **Vulnérabilité altération d''état** : Confusion, Surdité

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | (Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/tour) |
| Bi-magie | (Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/3 tours) |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Boule de feu | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Feu. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1. |
| 1.0 | Cautérisation | Soin (IC pour 3 NM) | 3.0 | 1.0 | 1.0 | 2d6 soin | Permet de soigner un état de gel, confusion et saignement. |
| 1.0 | Aura chaude | Entrave (IC pour 3 NM) | 4.0 | Soi-même | Cercle de 3 | / | Inflige fatigue 1 aux ennemis dans la zone s''ils ratent leur jet de vigueur |
| 1.0 | Détection du feu | Amplification | 5 (-1/NM) | Variable | 100 mètres | / | Permet de détecter des sources de chaleur comme le feu ou bien un groupe d''êtres vivants. |
| 1.0 | Braise magique | Attaque/ Entrave<br>(Imparable) | 3.0 | 20.0 | Tous les ennemis visibles | 4 dégâts (+2/NM) | Permet de toucher tous les ennemis avec une braise faible, Coup critique = inflige brûlure 1. |
| 2.0 | Fer brûlant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu. |
| 2.0 | Étincelle | Attaque/ Entrave | 7.0 | Soi-même | Cercle de 2 | 3d6 dégâts (+1d6/NM) | Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise). |
| 2.0 | Regard ardent | Entrave | 7.0 | 4.0 | 1.0 | / | Si jet de vigueur raté = Inflige brûlure 1. Peut brûler des objets à portée. (3 NM = Inflige brûlure stade 2) |
| 2.0 | Fournaise | Attaque | 7.0 | 10.0 | Ligne | 4d6 dégâts (+3/NM) | Faire surgir des flammes du sol pour attaquer les ennemis sur la ligne d''attaque. Ne peut être fait que sur un sol. |
| 2.0 | Souffle chaud | Attaque<br>(Imparable) | 8.0 | 3.0 | Cône | 5d6 dégâts (+3/NM) | Si jet de vigueur raté = Inflige brûlure 1. |
| 3.0 | Frappe rageuse | Attaque | 14.0 | 4 (+1/NM) | 1.0 | 7d6 + 15 dégâts | Envoie une violente vague de flamme. |
| 3.0 | Diffusion | Entrave | 12.0 | Soi-même | Cercle de 6 (+1/NM) | / | Augmente la température ambiante pendant 4 tours. Inflige 20 dégâts fixes à tous ceux qui souffrent d''une brûlure (1 fois). |
| 3.0 | Marcheur exalté | Amplification | 12 (-2/NM) | 1.0 | 1.0 | / | Permet de marcher sur du feu ou de la lave. Les jambes possèdent 6AP/6AM mais impossible de porter une armure à cet endroit temporairement |
| 3.0 | Mur de flammes | Construction | 12.0 | 3 (+1/NM) | Ligne 9 cases | 15 - 30 - 15 | Ceux qui ne possèdent pas de résistance au Feu doivent faire un jet d''Athlétisme/Équilibre pour tenter de traverser. Dure 4 tours. |
| 4.0 | Bouffée infernale | Attaque<br>(Imparable) | 20.0 | 7.0 | Cône | 5d6 + 25 dégâts (+6/NM) | Un vrai lance-flamme craché par la gueule. , 10% de chance d''infliger brûlure 1. |
| 4.0 | Grenade incendiaire | Attaque/ Entrave | 23.0 | 6.0 | Cercle de 2 | 8d6 + 35 dégâts | Inflige des dégâts de zone de Feu. (Oblige le jet de vigueur pour ne pas prendre brûlure 2 à 3NM) |
| 4.0 | Zénith | Météo | 26 (-2/NM) | Soi-même | Terrain | / | Change la météo en Grand Soleil ou Canicule pendant 5 tours. |
| 4.0 | Rayon de fusion | Attaque | 28 (-2/NM) | 14 | 1 | 40 dégâts | Tire un rayon qui ignore l''AM. |
| 5.0 | Bûcher purifiant | Attaque | 50 + 25% PV | 0.0 | Croix de 3 | 10d6 + 90 dégâts (+10/NM) | Inflige de terribles dégâts de feu en zone. Si jet de vigueur raté = Inflige brûlure 2. |
| 5.0 | Météore éruptif | Attaque | 55 (-5/NM) | 8 | Cercle de 3 | 10d6 + 60 dégâts | Inflige de terribles dégâts de feu. Si jet de vigueur raté = Inflige brûlure 1 |
| 3.0 | Jet de cendre | Attaque/ Entrave | 14 | 4 | Cône | 7d6 dégâts (+4/NM) | Inflige un malus de -15% à l''adversaire pour sa prochaine attaque. +5% le malus si un tas de cendre est à côté des cibles. |
| 3.0 | Ruée cendreuse | Placement (IC) | 17 (-2/NM) | 5 | 1 | / | Permet de se téléporter à un endroit. La portée est doublé si un tas de cendre est ciblé. |
| 3.0 | Aspect cendreuse | Amplification | 12 | Soi même | 1 | / | Rend le lanceur insensible pour 2 tours (+1/NM). |
| 3.0 | Tas de cendre | Construction<br>(IC x1/NM) | 9 | 9 | 1 | / | Place un tas de cendre sur le terrain, possède 20 santé. Il peut être utile pour d''autres sorts. Maximum 4 à la fois sur le terrain. |
| 4.0 | Éruption grise | Attaque/ Placement | 22 | Vue | Cercle de 2 | 5d6 + 12 dégâts | Peut être fait que sur un tas de cendre = Inflige des dégâts sur une zone et repousse de 2 cases les cibles. 3NM = Ne touche pas les alliés. |
| 4.0 | Fumerolle | Attaque | 23 | 6 | 1 | 6d6 + 20 dégâts | Inflige un bonus de +10 dégâts par tas de cendre présent sur le terrain. |
| 4.0 | Suie concentrée | Amplification  (IC pour 3 NM) | 20 | 1 | 1 | +1 portée/tas de cendre | Augmente la portée des sorts du feu par tas de cendre présent sur le terrain. Dure 3 tours. |
| 4.0 | Combustion forte | Entrave | 25 (-2/NM) | 1.0 | 1.0 | / | Permet d''infliger brûlure 3 aux immunisés et de brûler ce qui ne peut l''être. Les petits objets brûlés deviennent des tas de cendre. |
| 5.0 | Bombe de cancer | Attaque | 55 (-5/NM) | 8 | Cercle de 3 | 10d6 + 60 dégâts | Ignore à 50% des AM des cibles qui sont à côté d''un tas de cendre. |
| 5.0 | Forteresse escarbille | Amplification | 40 (-5/NM) | Vue | Terrain | / | Les tas de cendre deviennent des colonnes infranchissable avec le double de santé, leur bonus sont doublés et riposte contre des assauts\*. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Fer brûlant »** : Si coup critique avec une arme sous ce sort, inflige brûlure au stade 1

**Remarque du sort « Rayon de fusion »** : Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.

**Remarque du sort « Aspect cendreuse »** : L''insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. Prendre un coup physique annule cet état.

**Remarque du sort « Forteresse escarbille »** : \*Force le jet de vigueur à un agresseur pour ne pas qu''il prenne "brûlure 2"

## Textes des sorts de niveau 5

### Bûcher purifiant

> Que mon sang devienne l’étincelle du jugement,  
> Que ma vie nourrisse la flamme qui consume l’impur,  
> Que la croix ardente s’ouvre sous mes pieds comme un autel,  
> Que chaque brasier dévoile la vérité dans la douleur,  
> Et que mon sacrifice réveille le feu absolu…
>
> BÛCHER PURIFIANT !

### Météore éruptif

> Que le ciel s’ouvre au courroux des flammes,  
> Que la voûte céleste s’embrase sous ma volonté,  
> Que la braise se condense en un cœur incandescent,  
> Qu’il chute comme un jugement ardent sur les vivants,  
> Et que nul ne puisse fuir l’ombre de sa chute…
>
> MÉTÉORE CRAMOISI !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-du-feu';
UPDATE page SET corps_md = 'La magie du sang est une magie spécialisée dans les dégâts. Héritée du Dieu de la Force, une divinité puissante et instinctive, elle repose sur l''utilisation de son propre sang pour déchaîner une force brute et implacable.

Les utilisateurs du sang sont capables d''amplifier leurs capacités physiques, d''accélérer leur régénération ou de transformer leur sang en arme. Cette magie privilégie l''offensive pure, permettant d''infliger de lourds dégâts tout en poussant le corps de son utilisateur au-delà de ses limites naturelles.

Associée à la passion, une émotion liée aussi bien à l''amour qu''à la haine, la magie du sang attire ceux qui vivent leurs émotions avec intensité et n''hésitent pas à tout donner pour atteindre leurs objectifs.

## Description physique

La magie du Sang marque beaucoup sur la taille et la musculature qui est plus élevée que la moyenne (comme pour la terre), les veines sont apparentes un peu partout et augmentent au fur et à mesure des niveaux de magie, les mèches des cheveux sont couleur bordeaux, les yeux sont bordeaux en combat.

## Données

- **Santé offerte** : 10.0
- **Chakra offert** : 0.0
- **Caractéristiques bonus** : FORCE
- **4ème barre** : Cette magie utilise la 4ème barre. Elle possède un maximum de 10 Sang et la régénère de 1 par tour.
- **Résistance magique** : Sang, Eau, Terre
- **Résistance altération d''état** : Saignement, Confusion, Pétrification
- **Vulnérabilité magique** : Glace, Nécromancie
- **Vulnérabilité altération d''état** : Gel, Poison
- **Magie non compatible** : Arcane, Espace/Temps, Corruption, Nécromancie

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Permet de récupérer 10 sang par tour au lieu de 1. |
| Bi-magie | Divise par 2 le coût en sang pour les sorts. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Boule de sang | Attaque | 3 + 1 Sang | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Sang. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre saignement 1. |
| 1.0 | Clou | Attaque | 2 + 2 Sang | 4.0 | 3x1 | 1d6 dégâts (+3/NM) | Si jet de vigueur raté = Inflige Saignement 1. |
| 1.0 | Marquage | Entrave (IC) | 2 Sang | 1 (+1/NM) | 1.0 | +1d de dégâts reçu | Si jet de vigueur/fermeté raté = Augmente les dégâts reçus par la cible en ajoutant un dé de dégâts supplémentaire pendant 1 tour. |
| 1.0 | Annulation | Entrave/ Soin | 2 Sang | 7.0 | 1.0 | / | Retire TOUS les effets négatifs et positifs sur la cible (3NM = que négatif pour allié, que positif pour ennemi) |
| 1.0 | Attirance | Placement (IC) (IC x 2 si 3NM) | 2 + 1 Sang | 10.0 | 1.0 | / | La cible est attirée de 3 cases vers le lanceur ne fonctionne qu''en ligne. |
| 2.0 | Sang durci | Amplification (IC pour 3 NM) | 2 + 3 Sang | Soi-même | 1.0 | / | +3AP/AM.  Dure 3 tours. |
| 2.0 | Fer sanglant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang. |
| 2.0 | Sang garde | Amplification (IC pour 3 NM) | 2 + 3 Sang | Soi-même | 1.0 | / | +10% aux jets de défense. Dure 3 tours. |
| 2.0 | Crachat bordeaux | Attaque | 4 + 3 Sang | 7 | 1 | 5d6 dégâts (+3/NM) | La cible doit souffrir d''un saignement = Oblige un jet de vigueur, si elle rate elle subit une fois les effets de l''altération d''état. |
| 2.0 | Sang gain | Amplification (IC pour 3 NM) | 2 + 3 Sang | Soi-même | 1.0 | / | +2 Vitesse. Dure 3 tours. |
| 3.0 | Saignée forcée | Attaque/ Entrave | 9 + 3 Sang | 3.0 | 1.0 | 7d6 + 15 dégâts (+3/NM) | Si jet de vigueur raté = Inflige un saignement particulier pendant 4 tours. |
| 3.0 | Marquage surchargé | Entrave (IC) | 11 + 3 Sang | 1 (+1/NM) | 1 | Variable | Inflige 4 dégâts neutre à la santé de la cible à chaque IC, action ou case de déplacement entrepris par cette dernière. Dure 1 tour. |
| 3.0 | Super hémoglobine | Amplification | 13 + 1 Sang | Soi même | 1 | / | Permet de récupérer 2 (3/3NM) de sang par tour au lieu de 1 pendant 3 tours. |
| 3.0 | Déflagration sanguine | Attaque | X Sang | Soi-même | Cercle de 5 | X sang x3 dégâts (x4/3NM) | Une explosion qui inflige des dégâts selon le nombre de Sang utilisé. Ne touche pas les alliés. |
| 4.0 | Damoclès | Attaque | 18 + 4 Sang | 8.0 | Ligne de 3 | 8d6 + 30 dégâts | Si jet de stabilité/réflexe raté = La cible tombe par terre, inflige 4d6 de contrecoup. (pas de contrecoup au niveau 3 de maîtrise) |
| 4.0 | Grenade à clous | Attaque | 23.0 | 6.0 | Cercle de 2 | 8d6 + 40 dégâts | Inflige des dégâts de zone de Sang. (3NM = Si jet de vigueur raté = Inflige saignement stade 2) |
| 4.0 | Fléau sanglant | Attaque<br>(Imparable) | 19 + 5 Sang | 5 | 1 | 8d6 + 20 dégâts | Si 3NM = Divise par 2 le malus pour viser une partie du corps. |
| 4.0 | Marquage déchirant | Entrave (IC pour 3NM) | 16 + 4 Sang | 4 | 1 | / | La cible doit souffrir d''un saignement = Applique une marque qui oblige un double soin pour stopper le saignement. Dure tout le combat. |
| 5.0 | Sang perfection | Amplification | 40 + 8 Sang | Soi-même | 1.0 | / | +15 dégâts, +5AP, +5AM, +2 Vitesse dure 2 tours (+1/NM). |
| 5.0 | Surtension sanguine | Attaque | 45 + 8 Sang | 8 | 1 | 10d6 + 90 dégâts | Inflige de terribles dégâts.<br>3NM = Oblige un jet de vigueur pour ne pas prendre Saignement 2. |
| 3.0 | Congestion | Amplification (IC pour 3 NM) | 8 + X Sang | 1 | 1 | +X dégâts | Augmente les dégâts infligés pendant 3 tours. 1 Sang = +1 dégât. |
| 3.0 | Morsure aspirante | Attaque/Soin | 12.0 | 1.0 | 1.0 | 5d6 dégâts | Aspire 25% des PV infligés et les convertit en PV. Ne marche que sur les créatures vivantes (50% au niveau 3 de maîtrise) |
| 3.0 | Coagulation | Construction | 10 + X Sang | 5 (+1/NM) | 3x1 | / | Permet de solidifier son sang pour en faire un obstacle capable de prendre X sang x10 dégâts maxi |
| 3.0 | Renfermement | Soin | 10 + 3 Sang | 4.0 | 1.0 | 3d6 de soin (+4/NM) / tour | Donne une régénération à un allié pendant 3 tours. Le lanceur doit réussir un jet de vigueur pour ne pas prendre saignement 1. |
| 4.0 | Prise de sang | Attaque/Soin | 20 + 5 Sang | 3 | 1 | 5d6 + 50 dégâts | Ce sort ne peut être fait que le lanceur est en dessous de 25% (50%/3NM) de santé. 25% des dégâts sont converti en santé. |
| 4.0 | Douleur partagée | Amplification (IC pour 3 NM) | 19 + 5 Sang | 4 | 1.0 | / | Prend la moitié des dégâts d''un allié ciblé pendant 3 tours. Redonne 1 sang tous les 15 dégâts encaissé. |
| 4.0 | Rage de guerre | Amplification | 21 (-2/NM) + 5 Sang | 4 | 1 | +10 dégâts infligés et reçu, +1 vitesse | Inflige également l''état "Folle de guerre"  à la cible. Dure 2 tours. |
| 4.0 | Perfusion | Soin (IC) | X Sang | 4.0 | 1.0 | 4 (+1/NM) soin pour 1 sang | Utilise du sang pour récupérer de la santé. L''inverse est possible aussi de sacrifier de la santé pour récupérer du sang. |
| 5.0 | Proportion démesurée | Amplification | 50 + 8 Sang | 5.0 | 1.0 | / | Augmente la taille d''un cran, +1 Force, +20 (+5/NM) aux dégâts physiques, +1 portée pour 3 tours. Jet de vigueur à la fin pour ne pas prendre fatigue 1. |
| 5.0 | Sacrifice | Soin | 45 | Soi-même | Cercle de 5 | / | Donne et réparti toute sa santé aux alliés dans la zone. Coma. (Garde 1 santé à 3NM) |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Annulation »**

- Inutile contre les infirmités, la fatigue physique, les croix.
- Ne marche pas sur les effets magie niveau 3 ou plus
- Soigne d''un cran les altérations d''états.

**Note de la cellule « Effets secondaires » du sort « Attirance »** : Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C''est le lanceur qui est attiré.

**Note de la cellule « Effets secondaires » du sort « Fer sanglant »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Saignement au stade 1

**Note de la cellule « Effets secondaires » du sort « Saignée forcée »** : Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.

**Remarque du sort « Marquage surchargé »** : Ignore les défenses.

**Remarque du sort « Marquage déchirant »** : 2 remède ou deux sorts de soin d''altération d''état sont nécessaire pour arrêter un saignement.

**Remarque du sort « Morsure aspirante »** : Ne marche pas si c''est la {{barriere|barrière}} qui encaisse le coup

**Note de la cellule « Effets secondaires » du sort « Coagulation »** : Le mur est fixé au sol.

**Note de la cellule « Effets secondaires » du sort « Renfermement »** : Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.

**Note de la cellule « Effets secondaires » du sort « Proportion démesurée »** : Le bonus en force casse les limites de la carac (oui oui, on peut monter à 6 de force temporairement)

## Textes des sorts de niveau 5

### Sang Perfection

> Que mon cœur s’emballe et que mes muscles hurlent,  
> Que ma lame frappe avant même que l’ennemi pense,  
> Que chaque battement m’arme, m’endurcisse, m’accélère,  
> Que Brock verse en moi sa fureur divine,  
> Car la perfection n’éclôt que dans la douleur...
>
> SANG PERFECTION !

### Proportion démesurée

> Que mes os se brisent pour mieux s’étirer,  
> Que ma chair se torde sous l’excès de puissance,  
> Que chaque pulsation m’élève au-dessus des autres,  
> Que ma force dépasse les lois du sang et de la chair,  
> Brock, libérez en moi l''excès...
>
> PROPORTION DÉMESURÉE !

### Sacrifice

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-du-sang';
UPDATE page SET corps_md = 'La magie du vent est une magie spécialisée dans le placement et les dégâts. Héritée de la Déesse du Vent, une divinité calme et éprise de liberté, elle excelle dans le contrôle des déplacements et la maîtrise du terrain.

Les utilisateurs du vent manipulent les courants d''air pour repousser, attirer ou déplacer leurs cibles. Ils peuvent créer des bourrasques, des tornades ou des tempêtes, dévier des projectiles et même utiliser les vents pour accélérer leurs déplacements ou prendre de la hauteur.

Associée à la liberté, une émotion liée à l''indépendance et à l''inconstance, la magie du vent est souvent privilégiée par ceux qui refusent les contraintes et cherchent à garder le contrôle de leurs mouvements comme de ceux de leurs adversaires.

## Description physique

Les spécialistes du Vent ont les cheveux mi-longs, mèches vert clair, les yeux vert clair lors de l''utilisation d''un sort, corps mince, leurs corps produisent un vent très léger, notamment au niveau des bras et jambes. Cette brise légère visible à l''œil nu est de couleur verte.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : AGILITÉ
- **Résistance magique** : Vent, Feu, Glace
- **Résistance altération d''état** : Surdité, Brûlure, Gel
- **Vulnérabilité magique** : Foudre, Terre
- **Vulnérabilité altération d''état** : Paralysie, Pétrification

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts qui va ignorer les AP et AM sur 8 cases de distance. Dégâts non élémentaires. |
| Bi-magie | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts sur 6 cases de distance. Dégâts non élémentaires. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Lame d''air | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Vent. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre surdité 1. |
| 1.0 | Vent couteau | Attaque<br>(Imparable) | 5.0 | 15.0 | Ligne | 2d4 dégâts (+3/NM) | Inflige des dégâts de vent sur toute la ligne. |
| 1.0 | Vents murmures | Invocation | 5.0 | 10km | 1.0 | / | Envoie un court message de 8 mots (+2/NM) maximum. |
| 1.0 | Force agile | Amplification (IC) | 5.0 | Soi-même | 1.0 | / | Permet d''ajouter son score d''Agilité en bonus de dégâts pour la prochaine attaque. 1NM = +3 dégâts |
| 1.0 | Propulsion | Placement (IC) | 6.0 | 10 (+2 / NM) | 1.0 | / | Fait un grand saut, inflige 1 dégât frappe pour 20kg. |
| 2.0 | Cri faible | Attaque<br>(Imparable) | 8.0 | 6.0 | Cône | 5d6 (+3/NM) dégâts sonores | Si jet de vigueur raté = Inflige surdité 1. |
| 2.0 | Éternuement | Attaque/ Placement | 7.0 | 1.0 | 1.0 | 5d6 dégâts | Éternue fort sur l''adversaire, permet de le faire reculer d''une case (+1/NM) en arrière. |
| 2.0 | Fer éolien | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent. |
| 2.0 | Feuille morte | Protection (IC) | 6.0 | 8 (+2/NM) | 1.0 | / | Permet de ralentir la chute d''une cible. |
| 2.0 | Recul forcé | Placement (IC) | 6.0 | 4.0 | 1.0 | / | Fait reculer la cible de 1 case (+1/NM). -1 case si la cible est grande. |
| 3.0 | Tornade | Attaque (Inesquivable) | 14.0 | 5 (+1/NM) | Cercle de 4 | 5d6 + 15 dégâts | Inflige des dégâts en zone. |
| 3.0 | Bourrasque | Attaque | 14.0 | 4.0 | Ligne horizontale de 9 devant le lanceur | 5d6 (+5/NM) dégâts | Permet d''infliger un bonus de 2d6 dégâts en intérieur. |
| 3.0 | Désarmer | Entrave | 12 | 3 (+1/NM) | 1.0 | / | Si jet de réflexe/stabilité raté = Désarme la cible |
| 3.0 | Vent changeant | Placement (IC pour 3 NM) | 14.0 | 12.0 | Rectangle de 2x6 | / | Les cibles dans la zone sont attirées ou poussées de 3 cases. |
| 4.0 | Courant écrasant | Attaque | 23 | 7 | Carré de 9 | 6d6 + 25 dégâts | Si jet de stabilité/réflexe raté = Divise par 2 la vitesse des cibles et clou au sol les créatures volante. Dure 2 tours. |
| 4.0 | Catapulte aérienne | Placement | 23 (-3/NM) | 12 | 1 | / | La cible est catapultée dans une direction et atterri sans encombre. |
| 4.0 | Allègement | Amplification (IC pour 3 NM) | 21 | 1.0 | 1.0 | +2 Vitesse | Augmente la vitesse pour 3 tours. Divise par deux le poids de la cible. |
| 4.0 | Tempête | Météo | 24 (-2/NM) | Soi-même | Terrain | / | Invoque la météo "Vent Violent" pendant 3 tours. |
| 5.0 | Danse de l''air | Amplification | 55 (-5/NM) | Soi-même | 1.0 | / | Permet au lanceur de voler pour le combat entier. Les jambes deviennent vaporeuses donc insensibles aux attaques |
| 5.0 | Explosif | Attaque<br>(Inesquivable) | 55 (-5/NM) | Soi-même | Cercle de 5 | 10d6 + 60 dégâts | Utilise son corps pour invoquer une puissante explosion. Diminue d''un cran la résistance au Vent. |
| 3.0 | Estoc hurlante | Attaque/ Placement | 12 | 3 (+1/NM) | 1.0 | 7d6 + 15 dégâts | Le lanceur se déplace jusqu''à sa cible. |
| 3.0 | Onde de choc | Attaque | 14 | 7 | La ligne entière | 5d6 + 15 dégâts sonores | Envoi une attaque qui fait une ligne entière et touche toutes les cibles à l''intérieur. |
| 3.0 | Grande inspiration | Amplification  (IC pour 3NM) | 14 | Soi même | 1 | +10 dégâts | Augmente les dégâts sonores pendant 3 tours. |
| 3.0 | Infrason | Entrave (IC pour 3NM) | 12 | 3 | 1 | / | La cible se retrouve dans l''incapacité de faire des réactions ou des attaques d''opportunité pendant 2 tours. |
| 4.0 | Grenade Explosive | Attaque | 23.0 | 7.0 | Cercle de 4 | 5d6 + 35 dégâts | Inflige des dégâts de zone de Vent. Inflige 2d6 dégâts (+1d6/NM) supplémentaires en intérieur. |
| 4.0 | Vibration | Attaque/ Entrave (Imparable) | 25 (-2/NM) | Soi-même | Cercle de 3 | 6d6 + 25 dégâts sonores | Incante une vibration insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité/réflexe raté = Tombe par terre. |
| 4.0 | Sonar | Amplification  (IC pour 3NM) | 20 | 1 | 1 | Insensible aux attaques discrète/<br>sournoise | Le bénéficiaire est capable de repérer des cibles à 20m même si elles sont cachés ou discrètes. Dure 3 tours. Annule les lignes de vue des sorts\*. |
| 4.0 | Écho | Placement (IC) | 22 (-2/NM) | Variable | 1 | / | Le lanceur peut se téléporter selon le point le plus loin de la dernière attaque qui a fait des dégâts sonores. |
| 5.0 | Silence absolu | Entrave | 55 (-5/NM) | 8 | 1 | / | Place la cible dans un silence absolu pendant 24h. Elle ne peut plus lancer de sort niveau 5 et communiquer. |
| 5.0 | Mégaphone | Attaque<br>(Imparable) | 55 (-5/NM) | 8 | Cône | 10d6 + 60 dégâts sonores | Si jet de vigueur raté = Inflige surdité niveau 3. |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Propulsion »** : Ne provoque pas d''attaque d''opportunité.

**Note de la cellule « Effets secondaires » du sort « Fer éolien »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être sourd au stade 1

**Note de la cellule « Effets secondaires » du sort « Feuille morte »** : Maximum 30m

**Remarque du sort « Recul forcé »** : Sans NM dedans, le sort ne peut pas reculé une cible grande. Et c''est maximum 1 pour cette même cible.

**Remarque du sort « Sonar »** : Ligne de vue : C''est le besoin de voir la cible pour la toucher dans la portée du sort. Ce sort permet d''attendre la cible malgré un obstacle. SAUF si cet obstacle ne possède pas de possibilité de faire passer le sort comme un mur sans trou.

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-du-vent';
UPDATE page SET corps_md = 'La magie du Vide est l’antithèse de l’Espace-Temps. Cette magie est une arme redoutable entre les mains de ceux qui cherchent à neutraliser leurs adversaires, car elle ne se contente pas d’affaiblir : elle interdit, elle prive, elle réduit à néant.

Les utilisateurs du Vide possèdent un don unique : ils sont capables de bloquer l’accès à la magie elle-même. En un instant, ils peuvent tisser un voile de néant autour d’un ennemi, lui interdisant l’usage de tout pouvoir pendant un court laps de temps. Face à eux, même les plus grands mages deviennent vulnérables. En plus de ça, elle est capable d''utiliser la puissante télékinésie, ce qui leur permet un petit contrôle sur le terrain.

Les porteurs de cette magie sont immédiatement reconnaissables à leurs yeux dont le blanc est entièrement teinté de noir, un signe de leur lien profond avec le néant. Ils sont perçus comme des êtres inquiétants et impénétrables, des entités silencieuses capables d’annuler toute opposition par une simple pensée.

## Description physique

Les utilisateurs du vide ont une pilosité blanche et possèdent une inversion au niveau des yeux, le blanc de l''œil devient noir.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 5.0
- **Caractéristiques bonus** : VOLONTÉ
- **Résistance magique** : Vide
- **Résistance altération d''état** : Enragé
- **Vulnérabilité magique** : Espace/Temps
- **Vulnérabilité altération d''état** : Fatigue
- **Magie non compatible** : Espace/Temps

## Capacité Mode Hyper

| Type | Effets |
| --- | --- |
| Mono-Magie | Impose un désavantage (jette 2d100, garde le moins bon) aux ennemis qui tentent des attaques contre lui. |
| Bi-magie | Impose un désavantage (jette 2d100, garde le moins bon) à la première attaque tentée contre lui. |

## Sorts

| Niveau | Nom | Type | Coût | Portée | Zone | D/S/B | Effets secondaires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Bulle de vide | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Vide. 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre enragé 1. |
| 1.0 | Télékinésie | Amplification (IC pour 3NM) | 4 par taille créée | Vue | 1.0 | Variable | Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour. |
| 1.0 | Silence | Entrave | 5.0 | 5 (+1/NM) | 1.0 | / | La cible ne peut utiliser de sorts pendant 2 tours. Malus de 60% si jamais il est fait sur une cible qui a déjà subi le sort. |
| 1.0 | Pression | Attaque/ Entrave<br>(Imparable) | 5.0 | 6.0 | Carré 4x4 | 2d4 dégâts (+2/NM) | Si jet d''athlétisme/équilibre raté =Les cibles perdent leur vitesse au prochain tour. |
| 1.0 | Injonction du vide | Placement (IC pour 3 NM) | 4 | 6.0 | Croix | / | Force un jet de Stabilité/Réflexe ; si les cibles le ratent, elles sont repoussées ou attirées d''une case. |
| 2.0 | Fer vide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide. |
| 2.0 | Bisou du vide | Entrave | 6 (-1/NM) | 6.0 | 1.0 | / | Inflige "enragé 1" à la cible. |
| 2.0 | Poing implosif | Attaque/ Placement | 8.0 | 4.0 | 1.0 | 5d6 dégâts (+3/NM) | Frappe du poing vers la cible qui est attirée d''une case, inflige 1d6 dégâts en plus si la cible est déjà au corps à corps du lanceur. |
| 2.0 | Lien mental | Amplification (IC pour 3 NM) | 4 par personne | 50 m | Vue | / | Permet de communiquer par la pensée. |
| 2.0 | Dissipation | Entrave/ Soin | 8.0 | 8.0 | 1.0 | / | Annule les effets positif et négatif d''une cible. (Un allié perd le négatif et un ennemi le positif pour 3NM) |
| 3.0 | Aspect vide | Amplification | 12.0 | Soi-même | 1.0 | / | Rend le lanceur intangible pour une attaque (+1/NM) |
| 3.0 | Invisibilité | Amplification | 13.0 | 1 (+1/NM) | 2 | / | Rend la cible invisible pendant 3 tours. |
| 3.0 | Lame du vide | Attaque | 13.0 | 20.0 | 4 cibles | 20 dégâts | Inflige des dégâts fixes à 4 ennemis visibles. (Ignore la BA pour 3NM) |
| 3.0 | Touché du vide | Attaque/Soin | 14.0 | 1.0 | 1.0 | 7d6 dégâts (+6/NM) | Vampirise 25% des dégâts, marche que sur les créatures vivantes. |
| 4.0 | Cadence défensive | Amplification  (IC pour 3NM) | 23 | 1 | 1 | / | Permet d''avoir +1 jet de défense pour les postures Neutre, Symbiose et Vigilence. Augmente le coup critique de la posture Défense de 5. Dure 4 tours. |
| 4.0 | Grenade implosive | Attaque/ Placement | 27.0 | 3.0 | Croix infini | 8d6 + 15 dégâts | Inflige de gros dégâts de Vide en zone, attire de 1 case (+1/NM) les victimes. |
| 4.0 | Intérieur solide | Amplification (IC) | 20 | Vue | 1 | / | Permet de résister à toute agression mentale. (3NM = Immunité au contrôle mental passif) |
| 4.0 | Leurre de rage | Attaque | 23 | 6 | 1 | 7d6 + 20 dégâts (+7/NM) | Inflige une frappe couplé à une moquerie.<br>Si jet fermeté raté = Inflige "Enragé 2" |
| 5.0 | Regard de Mora | Amplification /Entrave | 42 | Soi même | Terrain | / | Permet d''imposer une règle au sein du champ de bataille parmis une liste\* pendant 2 tours (+1/NM). |
| 5.0 | Marteau du vide | Attaque | 55 (-5/NM) | 1.0 | Croix de 2 | 10d6 + 70 dégâts | Inflige de terribles dégâts de vide sur une zone. |
| 3.0 | Sablier du vide | Invocation | 12.0 | 1.0 | Cercle de 5 | 4d6 dégâts (+6/NM) | Invoque un sablier qui aspire la santé des adversaires autour de lui et la retransmet au tour suivant aux alliés. Possède 20 PV. |
| 3.0 | Suppression | Entrave (IC pour 3NM) | 15 | 6 | 1 | / | Retire toutes les amplifcation de la cible et elle ne peut pas bénéficier d''amplification pendant 2 tours. |
| 3.0 | Flèche du rien | Attaque | 14 | 4 (+1/NM) | 1 | 7d6 + 15 dégâts | Une lourde attaque du vide. |
| 3.0 | Décret de représailles | Entrave | 15 | 3 (+1/NM) | 1 | / | Si la cible fait un sort durant son tour, il prend 15 dégâts non élémentaire. Dure 3 tours. |
| 4.0 | Aléa négatif | Entrave | 20.0 | Vue | 1.0 | / | Lance 1d20 : Inflige un effet aléatoire parmi une liste de 20 effets |
| 4.0 | Déni de classe | Entrave (IC pour 3NM) | 20 | 6 | 1 | / | La cible ne peut pas bénéficier de ses dons de classes pendant 2 tours. |
| 4.0 | Fissure de faiblesse | Attaque | 23 | 6 | 1 | 8d6 + 15 dégâts | Si jet fermeté raté = Annule les AM de base pendant 1 tour. |
| 4.0 | Mot du vide | Amplification | 23.0 | 1 (+1/NM) | 1.0 | / | La cible sera partiellement immatérielle. Impose un désavantage aux jets d''attaques des agresseurs. Dure 2 tours. |
| 5.0 | État zéro | Attaque/ Entrave | 42 | Soi-même | Terrain | 10d6 + 20 dégâts (+10/NM) | Indépendant de la défense : Supprime toutes les amplifications, entrave, protections, effets de sorts et constructions magiques dans la zone. |
| 5.0 | Extinction | Attaque/ Entrave | 55 (-5/NM) | 6 | 1 | 10d6 + 70 dégâts | Si jet fermeté raté = Sous l''effet du sort "Silence" |

## Notes et commentaires des sorts

**Note de la cellule « Effets secondaires » du sort « Télékinésie »**

La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets  
Magie 1 = taille 1 (1 kg maxi)  
Magie 2 = taille 2 (2 kg maxi)  
Magie 3 = taille 3 (3 kg maxi)  
Magie 4 = taille 4 (4 kg maxi)  
Magie 5 = taille 5 (5 kg maxi)

**Note de la cellule « Effets secondaires » du sort « Fer vide »** : Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Rage au stade 1

**Note de la cellule « Effets secondaires » du sort « Poing implosif »** : La cible est attirée d''une case seulement si elle rate totalement son jet de défense ou si elle est dans l''incapacité de se défendre.

**Note de la cellule « Effets secondaires » du sort « Dissipation »**

- Ne marche pas sur les effets magie niveau 4 ou plus
- Inutile contre les infirmités, la fatigue physique, les croix.
- Soigne d''un cran les altérations d''états.

**Note de la cellule « Effets secondaires » du sort « Aspect vide »** : L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.

**Remarque du sort « Touché du vide »**

Si c''est la {{barriere|barrière}}, la {{barriere|barrière}} est vampirisée.  
Si c''est les points de vie, c''est les points de vie qui sont vampirisés

**Remarque du sort « Regard de Mora »**

- Les alliés infligent +5 dégâts et les ennemis -10.
- Les alliés ont +10% chances de réussir, les ennemis -20%
- Les ennemis ne peuvent plus sortir des zones d''influences d''eux mêmes
- Les ennemis perdent un niveau de puissance magique
- Banni les invocations et empêches les sorts d''invocations
- Détruit les sorts "Construction" sur le terrain et empêche ces sorts d''être utilisé
- Une fois pendant le Regard, si un allié fait des 1 dans les dés de dégâts, il peut les relancer.

**Note de la cellule « Effets secondaires » du sort « Sablier du vide »** : Les ennemis peuvent se défendre contre le coup du sablier.

**Note de la cellule « Effets secondaires » du sort « Aléa négatif »**

3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.

RIEN N''EST ESQUIVABLE

1 : Inflige \*saignement 1  
2 : Met une croix en Force pour 1 tour  
3 : Inflige \*poison 1  
4 : Oblige un jet de vigueur ou fermeté (le meilleur), si raté : Perd le tour  
5 : Inflige \*brûlure 1  
6 : Met une croix en Perception pour 1 tour  
7 : Inflige le sort de l''ombre "Malédiction" pour 1 tour  
8 : Inflige \*surdité 1  
9 : Inflige \*paralysie 1  
10 : Met une croix en Volonté pour 1 tour  
11 : Inflige \*surcharge magique 1  
12 : Inflige \*peur 1  
13 : Inflige \*aveuglement 1  
14 : Met une croix en Intelligence pour 1 tour  
15 : Inflige \*enragé 1  
16 : Inflige gel 1  
17 : Inflige confusion 1  
18 : Met une croix en Agilité pour 1 tour  
19 : Retire tous les effets positifs de la cible  
20 : Inflige couardise

**Remarque du sort « Déni de classe »** : Ne retire pas le premier don niveau 10 des spécialisations

## Textes des sorts de niveau 5

### Marteau du Vide

> Que Sa volonté se condense en un bras de fer,  
> Que le silence absolu frappe tout ce qui respire,  
> Que l’air se fissure sous la puissance de mon poing,  
> Que chaque être dans la zone ploie sous l’écrasement,  
> Et puisse le Vide se déchaîner dans un fracas sans fin…
>
> MARTEAU DU VIDE !

### État zéro

> Que l’air lui-même se retire et que chaque souffle s’éteigne,  
> Que toute force s’évanouisse dans un néant sans fond,  
> Que les chants et incantations se brisent en silence,  
> Que la puissance des mages ne soit plus rien,  
> Et puisse l’univers se vider, jusqu’au dernier écho…
>
> ÉTAT ZÉRO !

## Légende

IC = Instant Cast  
Le sort ne consomme pas le  
Tour du joueur (sauf échec crit)

**Obtention des niveaux de maîtrise**

- **N** : Par Niveau
- **L** : Par Lecture
- **C** : Par Cadeau du MJ
' WHERE id = 'magies/magie-du-vide';
UPDATE page SET corps_md = '**MAGIE DIFFICILE À JOUER !!**

Le Potentiel Illimité, aussi appelé Absolu Incomplet ou Magie Universelle, est l’essence brute de la création et de la destruction. Elle est le point de départ de toutes les autres magies, un pouvoir si vaste et si versatile qu''il est impossible de l''égaler. Les rares élus qui en héritent détiennent le couteau suisse de la magie, capable de piocher dans toutes les magies pour lancer des sorts.

Cependant, un tel pouvoir a un prix. Contrairement aux autres magies qui façonnent le monde selon des règles définies, le Potentiel Illimité est un torrent d’énergie brute, si dévastateur que le corps mortel peine à en supporter la tension. Chaque utilisation épuise l’utilisateur bien plus rapidement qu’une magie ordinaire, usant sa chair et ses os comme un feu qui consume son propre combustible. En conséquence, les porteurs de cette magie sont physiquement vulnérables, recevant deux fois plus de dégâts physiques que les autres.

Le Potentiel Illimité est à la fois une bénédiction et une malédiction, offrant une puissance absolue mais incomplète, un pouvoir sans égal mais limité par la fragilité du corps humain.

## Description physique

Des yeux dorés/orange, ainsi que des mèches dorées. Le corps est parsemé de tatouages couleur orange qui deviennent dorés quand un sort est utilisé, plus il y a de puissance, plus les cicatrices brillent. Ils ont des physiques moins charnus que la plupart des gens et ils semblent tout le temps épuisés.

## Explication

Le principal intérêt repose sur sa versatilité, en effet cette magie pioche ses sorts dans toutes les magies existantes. Cette versatilité a un prix qui est de ne pouvoir atteindre que le niveau 3 de puissance magique maximum en plus d''être limité à peu de races.

- Humain, Nain, Elfe argenté, Forestier, Noir, Doré, Farfadet, Felfe, Hujin et Drakos sont les seuls qui peuvent l''avoir.
- Mono-magie uniquement.
- Classe unique = Archimage.
- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).
- État fatigue 1 en permanence (sans le malus aux dégâts).
- Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet.

## Données

- **Santé offerte** : 0.0
- **Chakra offert** : 15.0
- **Caractéristiques bonus** : AU CHOIX ou ALÉATOIRE
- **Résistance magique** : Aucune
- **Résistance altération d''état** : Aucune
- **Vulnérabilité magique** : Aucune
- **Vulnérabilité altération d''état** : Aucune

## Capacité Mode Hyper

- **Forme Complète** : Résistance à la magie et dégâts physiques neutre.
' WHERE id = 'magies/potentiel-illimite';

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 13. Table correction : la section « magie-v10 » de tools/sheets/corrections.json (trace miroir ; le dump est corrigé avant l'extracteur)
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vide', 'AU71', 'v', 'spécialisatino', 'spécialisation', 1, 'frappe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : description de la spécialisation CONTESTATION ; lettres interverties (décision R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Vide › AU71');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Nécromancie', 'M77', 'v', 'Amplfication', 'Amplification', 1, 'frappe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : type du sort Seigneur des morts ; « Amplification » est un type de sort (sort_type), le « i » manque (R10).', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › M77');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Nécromancie', 'M77', 'v', 'pour3 NM', 'pour 3 NM', 1, 'espace', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : type du sort Seigneur des morts : « IC pour 3 NM », l''écriture des autres types de sorts (l''espace manque ; sans elle, ic_nm_min ne se lit pas : data/schema.sql, CHECK de sort.ic_nm_min) (R10).', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › M77');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Altération détats', 'AV42', 'v', 'altérzation', 'altération', 1, 'frappe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : palier « Grande résistance » de la Peur, écrit « altération » dans « Magie Maverick V8 » (même cellule) ; un « z » en trop (R10).', 'annexes', 'Nouveauté mise à jour Décembre › Altération détats › AV42');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sang', 'AC102', 'v', 'de terrible dégâts', 'de terribles dégâts', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Surtension sanguine ; accord de « terribles » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC102');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Arcane', 'AT69', 'v', 'Imprégne l''arme', 'Imprègne l''arme', 1, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Fer brillant ; accent grave de « imprègne », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT69');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Arcane', 'BK107', 'v', 'de terrible dégâts', 'de terribles dégâts', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Cassage gris ; accord de « terribles » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Arcane › BK107');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vide', 'AC92', 'v', 'à tout agression', 'à toute agression', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Intérieur solide ; accord de « toute » avec « agression », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC92');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Feu', 'AC98', 'v', 'de terrible dégâts', 'de terribles dégâts', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Météore éruptif ; accord de « terribles » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Feu › AC98');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Eau', 'AC94', 'v', 'reflèxe', 'réflexe', 1, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Torrent colérique ; accents de « réflexe », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Eau › AC94');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Glace', 'BK86', 'note', 'disparait', 'disparaît', 2, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : note de cellule (remarque) du sort Prisme protecteur ; accent circonflexe de « disparaît », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK86');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Terre', 'AC77', 'v', 'si ils ratent', 's''ils ratent', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Pollen entravante ; élision de « si » devant « ils », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC77');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Terre', 'AC89', 'note', 'disparait', 'disparaît', 2, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : note de cellule (remarque) du sort Pétale-bouclier ; accent circonflexe de « disparaît », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC89');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vent', 'AC83', 'v', 'réfléxe', 'réflexe', 1, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Courant écrasant ; accents de « réflexe », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vent › AC83');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vent', 'BH74', 'v', 'dégâts sonore', 'dégâts sonores', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : dégâts, soins ou bonus du sort Onde de choc ; accord de « sonores » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vent › BH74');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vent', 'BK77', 'v', 'dégâts sonore', 'dégâts sonores', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Grande inspiration ; accord de « sonores » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vent › BK77');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vent', 'BK92', 'v', 'dégâts sonore', 'dégâts sonores', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Écho ; accord de « sonores » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vent › BK92');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Foudre', 'AC80', 'v', 'qui ne possède pas', 'qui ne possèdent pas', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Mur hertz ; accord du verbe avec « Ceux », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AC80');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Lumière', 'AC80', 'v', 'qui ne possède pas', 'qui ne possèdent pas', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Mur gamma ; accord du verbe avec « Ceux », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC80');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Lumière', 'BK71', 'v', 'altérations d''états', 'altérations d''état', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Sanctuaire protecteur ; « altérations d''état », l''écriture des règles, la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Lumière › BK71');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Ombre', 'BH71', 'v', 'dégâts sonore', 'dégâts sonores', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : dégâts, soins ou bonus du sort Grand bailleur ; accord de « sonores » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BH71');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Ombre', 'BK98', 'v', 'tout les jets', 'tous les jets', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Prophétie ; accord de « tous » avec « les jets », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK98');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sang', 'BK99', 'v', 'dégâts physique,', 'dégâts physiques,', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Proportion démesurée ; accord de « physiques » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK99');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'EspaceTemps', 'AC101', 'v', 'jet de Fermeté', 'jet de fermeté', 2, 'casse', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Distorsion ; « fermeté » en minuscule dans « jet de fermeté », l''écriture des autres sorts, la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC101');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Feu', 'AT54', 'v', 'de contre coup', 'de contrecoup', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Étincelle ; « contrecoup » en un mot, la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Feu › AT54');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Glace', 'BK89', 'v', 'dégâts magique', 'dégâts magiques', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Cape hivernale ; accord de « magiques » avec « dégâts », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK89');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Terre', 'BK89', 'v', 'tempête sable', 'tempête de sable', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Rédemption de Dimitri ; nom de la météo « Tempête de sable », la correction que la migration 0006 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK89');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Vent', 'AT63', 'v', 'Fait reculé la', 'Fait reculer la', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Recul Forcé ; infinitif après « fait », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT63');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Lumière', 'AC89', 'v', 'être aveugler au', 'être aveuglé au', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Grenade Flash ; participe passé après « être », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC89');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Ombre', 'BK95', 'v', 'qui souffre de', 'qui souffrent de', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : effets du sort Armée de l''Ombre ; accord du verbe avec « Les ennemis », la correction que la migration 0003 a faite sur le même texte du classeur V8 (registre 0117-magies-v10-specialisations.json, `coquilles_r10`) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens ; coquille candidate du plan, retenue par game-design le 2026-11-12).', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK95');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Eau', 'G94', 'v', 'Torrant', 'Torrent', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : nom du sort Torrent colérique (« torrent ») ; coquille (R10), le docx « MISE À JOUR - DÉCEMBRE » écrit « Torrent colérique » (réponse de game-design à la question 1 de tech-sources, 2026-11-12). Le sort est nouveau : son id suit le nom corrigé (`magies/magie-de-leau#sort:torrent-colerique`), figé dès sa création.', 'magies', 'Nouveauté mise à jour Décembre › Eau › G94');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'appeller', 'appeler', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; « appeler » ne prend qu’un « l » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'sont déblocable dès', 'sont débloquables dès', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; « débloquable » (de « débloquer »), accordé au sujet pluriel « Les spécialisations magiques » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'niveau 8 globale', 'niveau 8 global', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; « niveau global », comme la correction « niveau globale » → « niveau global » de la migration 0003 (0003-orthographe-magies.json) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'dans une état de', 'dans un état de', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; « état » est masculin (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'les emplacement de sort', 'les emplacements de sort', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; pluriel après « les » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'une béta', 'une bêta', 1, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; « bêta » prend un accent circonflexe (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Sommaire', 'AP1', 'v', 'trucs trop fort, pas assez clair, trop faible', 'trucs trop forts, pas assez clairs, trop faibles', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12) : cellule « CHOSES A SAVOIR », règle de magie `magies#regle:choses-a-savoir` (R236) ; adjectifs accordés au nom pluriel « trucs » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'magies', 'Nouveauté mise à jour Décembre › Sommaire › AP1');

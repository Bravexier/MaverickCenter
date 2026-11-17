-- 0103-r205-etat-gel : décision R205 (3) du propriétaire (2026-11-07, « Il faut écrire "Gel" ») : l'état s'appelle « Gel » dans tous les textes de
-- règles modifiables qui l'écrivaient « Gelé ». Migration de DONNÉES seules (sections 3, 6, 8 bis et 9 ; PRAGMA user_version 102 -> 103 ; dans
-- data/schema.sql, seuls les commentaires de magie_resistance et de sort.dsb_brut changent, ce dernier pour R205 (1)) ; rien ne va dans
-- historique_modification (la migration n'est pas une modification du site de dev). Registre avant/après : 0103-r205-etat-gel.json (`corrections`,
-- lu aussi par le rapprochement des classeurs, tools/sources/rapprocher.mjs, qui les défait : le classeur garde « Gelé »).
--   Motifs retenus (casse respectée) : « Gelé » mot entier (ni « Gelée », ni « Gelés ») -> « Gel » ; « gelé N » / « Gelé N » (un stade) -> « gel N » /
--   « Gel N ». Lignes : magie_resistance.cible_brut 5 (Glace, Nécromancie, Feu, Sang, Vent), monstre_rubrique.texte 83 (vulnérabilités,
--   résistances, immunités), accessoire_effet.libelle 1, maladie.effets 1, monstre_capacite_commune.description 3, classe_annexe.texte 1 et
--   classe_annexe_entree.effet 1 (Mage Bleu, « Attaque glaçante » ; l'entrée reste le morceau de sa ligne, R181), et la page classes/mage-bleu, dont le
--   corps est le rendu de ses tables (lib/corps-classes.mjs#corpsDeClasse, refait par le service quand classe_annexe change).
--   Puis ce qui dérive des rubriques : monstre_defense (lib/monstre-champs.mjs#valeursDeLaCarte : la cible écrite et normalize()), 77 cibles
--   « Gelé » / gele -> « Gel » / gel (les 6 autres rubriques écrivent plusieurs lignes « Mage : … » et n'ont pas de cibles typées).
--   Ne changent pas : l'identifiant de l'état (guide/liste-des-alterations-d-etat#etat:gel) ; le Codex et le lore (« Cœur Gelé ») ; les emplois
--   adjectivaux (« sol gelé », « os gelés », « destin gelé », « Souffle gelée », « Concentration gelée ») ; les gelées (ingrédients, butin) ; le sort
--   « Cerveau gelé » (nom, ids) et la remarque de Fer froid « pour ne pas être gelé au stade 1 » (et sa note de cellule, son commentaire orphelin) ;
--   historique_modification, note_version_ligne ; la citation « +1 Gelé » de R163 ; le corps des pages typées des magies, des accessoires et des
--   maladies (texte d'import pour la recherche, que le service ne refait pas depuis ces colonnes) ; « Pétrification », « Enragée », « Surcharge
--   magique » (même écart, hors décision).
-- La garde : chaque UPDATE est gardé par la valeur d'avant (entière, ou le fragment présent une seule fois) et doit changer exactement une ligne ;
-- monstre_defense exactement 77, et plus aucune cible `gele` ensuite. Une ligne que le site de dev aurait changée arrête la migration.


CREATE TEMP TABLE garde_0103 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));


-- magie_resistance.cible_brut

UPDATE magie_resistance SET cible_brut = 'Gel' WHERE magie_id = 'magies/magie-de-la-glace' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 1 AND cible_brut = 'Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('magie_resistance {"magie_id": "magies/magie-de-la-glace", "sens": "resistance", "cible_type": "etat", "rang": 1}', changes());
UPDATE magie_resistance SET cible_brut = 'Gel' WHERE magie_id = 'magies/magie-de-la-necromancie' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1 AND cible_brut = 'Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('magie_resistance {"magie_id": "magies/magie-de-la-necromancie", "sens": "vulnerabilite", "cible_type": "etat", "rang": 1}', changes());
UPDATE magie_resistance SET cible_brut = 'Gel' WHERE magie_id = 'magies/magie-du-feu' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 2 AND cible_brut = 'Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('magie_resistance {"magie_id": "magies/magie-du-feu", "sens": "resistance", "cible_type": "etat", "rang": 2}', changes());
UPDATE magie_resistance SET cible_brut = 'Gel' WHERE magie_id = 'magies/magie-du-sang' AND sens = 'vulnerabilite' AND cible_type = 'etat' AND rang = 1 AND cible_brut = 'Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('magie_resistance {"magie_id": "magies/magie-du-sang", "sens": "vulnerabilite", "cible_type": "etat", "rang": 1}', changes());
UPDATE magie_resistance SET cible_brut = 'Gel' WHERE magie_id = 'magies/magie-du-vent' AND sens = 'resistance' AND cible_type = 'etat' AND rang = 3 AND cible_brut = 'Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('magie_resistance {"magie_id": "magies/magie-du-vent", "sens": "resistance", "cible_type": "etat", "rang": 3}', changes());

-- monstre_rubrique.texte

UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison, Paralysie' WHERE monstre_id = 'monstres/blob-bordeaux#carte:blob-bordeaux' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-bordeaux#carte:blob-bordeaux", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison, Paralysie' WHERE monstre_id = 'monstres/blob-bordeaux#carte:blob-du-sang' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-bordeaux#carte:blob-du-sang", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison, Paralysie' WHERE monstre_id = 'monstres/blob-bordeaux#carte:blob-grenade' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-bordeaux#carte:blob-grenade", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Contrôle mentale, Saignement, Gel, Surdité' WHERE monstre_id = 'monstres/blob-cyan#carte:blob-cyan' AND rang = 9 AND texte = 'Contrôle mentale, Saignement, Gelé, Surdité';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-cyan#carte:blob-cyan", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Contrôle mentale, Saignement, Gel, Surdité' WHERE monstre_id = 'monstres/blob-cyan#carte:blob-de-la-glace' AND rang = 9 AND texte = 'Contrôle mentale, Saignement, Gelé, Surdité';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-cyan#carte:blob-de-la-glace", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Contrôle mentale, Saignement, Gel, Surdité' WHERE monstre_id = 'monstres/blob-cyan#carte:blob-menthe' AND rang = 9 AND texte = 'Contrôle mentale, Saignement, Gelé, Surdité';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-cyan#carte:blob-menthe", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/blob-vert-fonce#carte:blob-corossol' AND rang = 8 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-vert-fonce#carte:blob-corossol", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/blob-vert-fonce#carte:blob-de-la-necromancie' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-vert-fonce#carte:blob-de-la-necromancie", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/blob-vert-fonce#carte:blob-vert-fonce' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/blob-vert-fonce#carte:blob-vert-fonce", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gel' WHERE monstre_id = 'monstres/carcalanche#carte:carcalanche-du-blizzard' AND rang = 9 AND texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/carcalanche#carte:carcalanche-du-blizzard", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gel' WHERE monstre_id = 'monstres/carcalanche#carte:carcalanche-du-froid' AND rang = 9 AND texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/carcalanche#carte:carcalanche-du-froid", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gel' WHERE monstre_id = 'monstres/carcalanche#carte:carcalanche-du-givre' AND rang = 9 AND texte = 'Poison, Maladie, Couardise, Peur, Fatigue, Saignement, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/carcalanche#carte:carcalanche-du-givre", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/charcabe#carte:charcabe-brule' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/charcabe#carte:charcabe-brule", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/charcabe#carte:charcabe-carbonise' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/charcabe#carte:charcabe-carbonise", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/charcabe#carte:charcabe-vitrifie' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/charcabe#carte:charcabe-vitrifie", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Eau, Glace, Brûlure, Gel' WHERE monstre_id = 'monstres/collecteur#carte:collecteur' AND rang = 9 AND texte = 'Feu, Eau, Glace, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/collecteur#carte:collecteur", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Eau, Glace, Brûlure, Gel' WHERE monstre_id = 'monstres/collecteur#carte:collecteur-puissant' AND rang = 9 AND texte = 'Feu, Eau, Glace, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/collecteur#carte:collecteur-puissant", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Eau, Glace, Brûlure, Gel' WHERE monstre_id = 'monstres/collecteur#carte:collecteur-titan' AND rang = 9 AND texte = 'Feu, Eau, Glace, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/collecteur#carte:collecteur-titan", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/corbeau-agressif#carte:corbeau-agressif-du-feu' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/corbeau-agressif#carte:corbeau-agressif-du-feu", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/corbeau-agressif#carte:corbeau-agressif-noir' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/corbeau-agressif#carte:corbeau-agressif-noir", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Terre, Glace, Pétrification, Gel' WHERE monstre_id = 'monstres/corbeau-agressif#carte:corbeau-agressif-rouge' AND rang = 8 AND texte = 'Feu, Terre, Glace, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/corbeau-agressif#carte:corbeau-agressif-rouge", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Gel, Brûlure' WHERE monstre_id = 'monstres/crieur-osseux#carte:crieur-osseux' AND rang = 8 AND texte = 'Vent, Glace, Feu, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/crieur-osseux#carte:crieur-osseux", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Gel, Brûlure' WHERE monstre_id = 'monstres/crieur-osseux#carte:gueulard-osseux' AND rang = 8 AND texte = 'Vent, Glace, Feu, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/crieur-osseux#carte:gueulard-osseux", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Gel, Brûlure' WHERE monstre_id = 'monstres/crieur-osseux#carte:hurleur-osseux' AND rang = 8 AND texte = 'Vent, Glace, Feu, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/crieur-osseux#carte:hurleur-osseux", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison' WHERE monstre_id = 'monstres/fourbraise#carte:fourbraise-chevaleresse' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/fourbraise#carte:fourbraise-chevaleresse", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison' WHERE monstre_id = 'monstres/fourbraise#carte:fourbraise-soldat' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/fourbraise#carte:fourbraise-soldat", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Brûlure, Confusion, Surdité, Pétrification, Paralysie, Gel, Poison, Maladie' WHERE monstre_id = 'monstres/golem-dargile#carte:golem-dargile-iii' AND rang = 9 AND texte = 'Brûlure, Confusion, Surdité, Pétrification, Paralysie, Gelé, Poison, Maladie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-dargile#carte:golem-dargile-iii", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gel, Paralysie, Saignement' WHERE monstre_id = 'monstres/golem-de-bois#carte:golem-de-bois-i' AND rang = 7 AND texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gelé, Paralysie, Saignement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-bois#carte:golem-de-bois-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gel, Paralysie, Saignement' WHERE monstre_id = 'monstres/golem-de-bois#carte:golem-de-bois-ii' AND rang = 7 AND texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gelé, Paralysie, Saignement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-bois#carte:golem-de-bois-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gel, Paralysie, Saignement' WHERE monstre_id = 'monstres/golem-de-bois#carte:golem-de-bois-iii' AND rang = 7 AND texte = 'Feu, Glace, Foudre, Sang, Brûlure, Gelé, Paralysie, Saignement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-bois#carte:golem-de-bois-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Poison, Gel' WHERE monstre_id = 'monstres/golem-de-chair#carte:golem-de-chair-i' AND rang = 7 AND texte = 'Nécromancie, Glace, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-chair#carte:golem-de-chair-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Poison, Gel' WHERE monstre_id = 'monstres/golem-de-chair#carte:golem-de-chair-ii' AND rang = 7 AND texte = 'Nécromancie, Glace, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-chair#carte:golem-de-chair-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Poison, Gel' WHERE monstre_id = 'monstres/golem-de-chair#carte:golem-de-chair-iii' AND rang = 7 AND texte = 'Nécromancie, Glace, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-chair#carte:golem-de-chair-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Eau, Glace, Foudre, Confusion, Brûlure, Gel, Paralysie' WHERE monstre_id = 'monstres/golem-de-fer#carte:golem-de-fer-i' AND rang = 7 AND texte = 'Feu, Eau, Glace, Foudre, Confusion, Brûlure, Gelé, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-fer#carte:golem-de-fer-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Foudre, Confusion, Gel, Paralysie' WHERE monstre_id = 'monstres/golem-de-fer#carte:golem-de-fer-ii' AND rang = 7 AND texte = 'Eau, Glace, Foudre, Confusion, Gelé, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-fer#carte:golem-de-fer-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Foudre, Confusion, Gel, Paralysie' WHERE monstre_id = 'monstres/golem-de-fer#carte:golem-de-fer-iii' AND rang = 7 AND texte = 'Eau, Glace, Foudre, Confusion, Gelé, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-fer#carte:golem-de-fer-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Gel, Saignement, Poison' WHERE monstre_id = 'monstres/golem-de-glace#carte:golem-de-glace-i' AND rang = 9 AND texte = 'Glace, Gelé, Saignement, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-glace#carte:golem-de-glace-i", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Gel, Saignement, Poison' WHERE monstre_id = 'monstres/golem-de-glace#carte:golem-de-glace-ii' AND rang = 9 AND texte = 'Glace, Gelé, Saignement, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-glace#carte:golem-de-glace-ii", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Gel, Saignement, Poison' WHERE monstre_id = 'monstres/golem-de-glace#carte:golem-de-glace-iii' AND rang = 9 AND texte = 'Glace, Gelé, Saignement, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-glace#carte:golem-de-glace-iii", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Brûlure, Pétrification, Gel' WHERE monstre_id = 'monstres/golem-de-magma#carte:golem-de-magma-i' AND rang = 9 AND texte = 'Brûlure, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-magma#carte:golem-de-magma-i", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Brûlure, Pétrification, Gel' WHERE monstre_id = 'monstres/golem-de-magma#carte:golem-de-magma-ii' AND rang = 9 AND texte = 'Brûlure, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-magma#carte:golem-de-magma-ii", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Brûlure, Pétrification, Gel' WHERE monstre_id = 'monstres/golem-de-magma#carte:golem-de-magma-iii' AND rang = 9 AND texte = 'Brûlure, Pétrification, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-magma#carte:golem-de-magma-iii", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Nécromancie, Confusion, Gel, Poison' WHERE monstre_id = 'monstres/golem-de-pain#carte:golem-de-pain-i' AND rang = 7 AND texte = 'Eau, Glace, Nécromancie, Confusion, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-pain#carte:golem-de-pain-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Nécromancie, Confusion, Gel, Poison' WHERE monstre_id = 'monstres/golem-de-pain#carte:golem-de-pain-ii' AND rang = 7 AND texte = 'Eau, Glace, Nécromancie, Confusion, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-pain#carte:golem-de-pain-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Nécromancie, Confusion, Gel, Poison' WHERE monstre_id = 'monstres/golem-de-pain#carte:golem-de-pain-iii' AND rang = 7 AND texte = 'Eau, Glace, Nécromancie, Confusion, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-pain#carte:golem-de-pain-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Vide, Eau, Glace, Enragé, Confusion, Gel' WHERE monstre_id = 'monstres/golem-de-rouage#carte:golem-de-rouage-i' AND rang = 7 AND texte = 'Vide, Eau, Glace, Enragé, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-rouage#carte:golem-de-rouage-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Vide, Eau, Glace, Enragé, Confusion, Gel' WHERE monstre_id = 'monstres/golem-de-rouage#carte:golem-de-rouage-ii' AND rang = 7 AND texte = 'Vide, Eau, Glace, Enragé, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-rouage#carte:golem-de-rouage-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Vide, Eau, Glace, Enragé, Confusion, Gel' WHERE monstre_id = 'monstres/golem-de-rouage#carte:golem-de-rouage-iii' AND rang = 7 AND texte = 'Vide, Eau, Glace, Enragé, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-de-rouage#carte:golem-de-rouage-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Eau, Frappe, Gel, Confusion' WHERE monstre_id = 'monstres/golem-osseux#carte:golem-osseux-i' AND rang = 7 AND texte = 'Glace, Eau, Frappe, Gelé, Confusion';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-osseux#carte:golem-osseux-i", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Eau, Frappe, Gel, Confusion' WHERE monstre_id = 'monstres/golem-osseux#carte:golem-osseux-ii' AND rang = 7 AND texte = 'Glace, Eau, Frappe, Gelé, Confusion';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-osseux#carte:golem-osseux-ii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Glace, Eau, Frappe, Gel, Confusion' WHERE monstre_id = 'monstres/golem-osseux#carte:golem-osseux-iii' AND rang = 7 AND texte = 'Glace, Eau, Frappe, Gelé, Confusion';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/golem-osseux#carte:golem-osseux-iii", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gel' WHERE monstre_id = 'monstres/irapullum#carte:irapullum' AND rang = 7 AND texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/irapullum#carte:irapullum", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gel' WHERE monstre_id = 'monstres/irapullum#carte:irapullum-sanglant' AND rang = 7 AND texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/irapullum#carte:irapullum-sanglant", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gel' WHERE monstre_id = 'monstres/irapullum#carte:irapullum-vorace' AND rang = 7 AND texte = 'Feu, Nécromancie, Glace, Brûlure, Poison, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/irapullum#carte:irapullum-vorace", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/masse-empoisonneuse#carte:masse-empoisonneuse' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/masse-empoisonneuse#carte:masse-empoisonneuse", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison' WHERE monstre_id = 'monstres/moustique-bordeaux#carte:moustique-bordeaux' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/moustique-bordeaux#carte:moustique-bordeaux", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison' WHERE monstre_id = 'monstres/moustique-bordeaux#carte:moustique-du-sang' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/moustique-bordeaux#carte:moustique-du-sang", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Nécromancie, Glace, Gel, Poison' WHERE monstre_id = 'monstres/moustique-bordeaux#carte:moustique-sanguin' AND rang = 7 AND texte = 'Nécromancie, Glace, Gelé, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/moustique-bordeaux#carte:moustique-sanguin", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gel' || char(10) || 'Mage : Nécromancie, Poison' WHERE monstre_id = 'monstres/ogre#carte:ogre' AND rang = 9 AND texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gelé' || char(10) || 'Mage : Nécromancie, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gel, Brûlure, Paralysie' WHERE monstre_id = 'monstres/ogre#carte:ogre' AND rang = 10 AND texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gelé, Brûlure, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre", "rang": 10}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gel' || char(10) || 'Mage : Nécromancie, Poison' WHERE monstre_id = 'monstres/ogre#carte:ogre-abominable' AND rang = 9 AND texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gelé' || char(10) || 'Mage : Nécromancie, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre-abominable", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gel, Brûlure, Paralysie' WHERE monstre_id = 'monstres/ogre#carte:ogre-abominable' AND rang = 10 AND texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gelé, Brûlure, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre-abominable", "rang": 10}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gel' || char(10) || 'Mage : Nécromancie, Poison' WHERE monstre_id = 'monstres/ogre#carte:ogre-superieur' AND rang = 9 AND texte = 'Guerrier : Nécromancie, Feu, Glace, Poison, Brûlure, Gelé' || char(10) || 'Mage : Nécromancie, Poison';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre-superieur", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gel, Brûlure, Paralysie' WHERE monstre_id = 'monstres/ogre#carte:ogre-superieur' AND rang = 10 AND texte = 'Guerrier : Eau, Vent, Foudre, Confusion, Surdité, Paralysie' || char(10) || 'Mage : Glace, Feu, Foudre, Gelé, Brûlure, Paralysie';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/ogre#carte:ogre-superieur", "rang": 10}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gel, Estoc' WHERE monstre_id = 'monstres/os-du-froid#carte:os-du-blizzard' AND rang = 9 AND texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gelé, Estoc';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/os-du-froid#carte:os-du-blizzard", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gel, Estoc' WHERE monstre_id = 'monstres/os-du-froid#carte:os-du-froid' AND rang = 9 AND texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gelé, Estoc';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/os-du-froid#carte:os-du-froid", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gel, Estoc' WHERE monstre_id = 'monstres/os-du-froid#carte:os-du-givre' AND rang = 9 AND texte = 'Poison, Maladie, Enragé, Peur, Aveuglement, Fatigue, Saignement, Gelé, Estoc';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/os-du-froid#carte:os-du-givre", "rang": 9}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Glace, Terre, Lumière, Brûlure, Gel, Pétrification, Aveuglement' WHERE monstre_id = 'monstres/potirobuste#carte:potirobuste-sergent' AND rang = 8 AND texte = 'Feu, Glace, Terre, Lumière, Brûlure, Gelé, Pétrification, Aveuglement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/potirobuste#carte:potirobuste-sergent", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Feu, Glace, Terre, Lumière, Brûlure, Gel, Pétrification, Aveuglement' WHERE monstre_id = 'monstres/potirobuste#carte:potirobuste-soldat' AND rang = 8 AND texte = 'Feu, Glace, Terre, Lumière, Brûlure, Gelé, Pétrification, Aveuglement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/potirobuste#carte:potirobuste-soldat", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Lumière, Surdité, Gel, Brûlure, Aveuglement' WHERE monstre_id = 'monstres/potirodeur#carte:potirodeur-malin' AND rang = 8 AND texte = 'Vent, Glace, Feu, Lumière, Surdité, Gelé, Brûlure, Aveuglement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/potirodeur#carte:potirodeur-malin", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Lumière, Surdité, Gel, Brûlure, Aveuglement' WHERE monstre_id = 'monstres/potirodeur#carte:potirodeur-vicieux' AND rang = 8 AND texte = 'Vent, Glace, Feu, Lumière, Surdité, Gelé, Brûlure, Aveuglement';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/potirodeur#carte:potirodeur-vicieux", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/rat#carte:rat-gris' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/rat#carte:rat-gris", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/rat#carte:rat-noir' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/rat#carte:rat-noir", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Eau, Glace, Confusion, Gel' WHERE monstre_id = 'monstres/rat#carte:rat-putride' AND rang = 7 AND texte = 'Eau, Glace, Confusion, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/rat#carte:rat-putride", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Paralysie, Gel, Brûlure, Pétrification' WHERE monstre_id = 'monstres/soldat-de-fer#carte:general-de-fer' AND rang = 7 AND texte = 'Paralysie, Gelé, Brûlure, Pétrification';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/soldat-de-fer#carte:general-de-fer", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Paralysie, Gel, Brûlure, Pétrification' WHERE monstre_id = 'monstres/soldat-de-fer#carte:lieutenant-de-fer' AND rang = 7 AND texte = 'Paralysie, Gelé, Brûlure, Pétrification';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/soldat-de-fer#carte:lieutenant-de-fer", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Paralysie, Gel, Brûlure, Pétrification' WHERE monstre_id = 'monstres/soldat-de-fer#carte:soldat-de-fer' AND rang = 7 AND texte = 'Paralysie, Gelé, Brûlure, Pétrification';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/soldat-de-fer#carte:soldat-de-fer", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gel' WHERE monstre_id = 'monstres/squelette-mauvais#carte:squelette-mauvais-colerique' AND rang = 7 AND texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/squelette-mauvais#carte:squelette-mauvais-colerique", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gel' WHERE monstre_id = 'monstres/squelette-mauvais#carte:squelette-mauvais-determine' AND rang = 7 AND texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/squelette-mauvais#carte:squelette-mauvais-determine", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gel' WHERE monstre_id = 'monstres/squelette-mauvais#carte:squelette-mauvais-puissant' AND rang = 7 AND texte = 'Lumière, Terre, Feu, Glace, Pétrification, Brûlure, Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/squelette-mauvais#carte:squelette-mauvais-puissant", "rang": 7}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Surdité, Gel, Brûlure' WHERE monstre_id = 'monstres/zompi#carte:zompi' AND rang = 8 AND texte = 'Vent, Glace, Feu, Surdité, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/zompi#carte:zompi", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Surdité, Gel, Brûlure' WHERE monstre_id = 'monstres/zompi#carte:zompi-claqueur' AND rang = 8 AND texte = 'Vent, Glace, Feu, Surdité, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/zompi#carte:zompi-claqueur", "rang": 8}', changes());
UPDATE monstre_rubrique SET texte = 'Vent, Glace, Feu, Surdité, Gel, Brûlure' WHERE monstre_id = 'monstres/zompi#carte:zompiceps' AND rang = 8 AND texte = 'Vent, Glace, Feu, Surdité, Gelé, Brûlure';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_rubrique {"monstre_id": "monstres/zompi#carte:zompiceps", "rang": 8}', changes());

-- accessoire_effet.libelle

UPDATE accessoire_effet SET libelle = 'Résistance Glace et Gel' WHERE id = 'ressources/accessoires#effet:defense:15' AND libelle = 'Résistance Glace et Gelé';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('accessoire_effet {"id": "ressources/accessoires#effet:defense:15"}', changes());

-- maladie.effets

UPDATE maladie SET effets = '-20% de chance de résister à Gel.' WHERE id = 'ressources/maladie#maladie:alteratis-cyan' AND effets = '-20% de chance de résister à Gelé.';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('maladie {"id": "ressources/maladie#maladie:alteratis-cyan"}', changes());

-- monstre_capacite_commune.description

UPDATE monstre_capacite_commune SET description = 'L’arme de cette créature possède 30% de chance d’obliger un jet de vigueur à l’adversaire pour ne pas qu’il prenne “gel 1”. L’arme peut taper dans l’élément associé.' WHERE id = 'element-glace' AND description = 'L’arme de cette créature possède 30% de chance d’obliger un jet de vigueur à l’adversaire pour ne pas qu’il prenne “gelé 1”. L’arme peut taper dans l’élément associé.';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_capacite_commune {"id": "element-glace"}', changes());
UPDATE monstre_capacite_commune SET description = 'L’élément d’attaque de cette créature est la Glace avec 25% de chance d’obliger un jet de vigueur à la cible, si elle rate, elle prend “Gel 1”.' WHERE id = 'element-glace-2' AND description = 'L’élément d’attaque de cette créature est la Glace avec 25% de chance d’obliger un jet de vigueur à la cible, si elle rate, elle prend “Gelé 1”.';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_capacite_commune {"id": "element-glace-2"}', changes());
UPDATE monstre_capacite_commune SET description = 'L’arme de cette créature possède 30% de chance d’obliger un jet de vigueur à l’adversaire pour ne pas qu’il prenne “gel 1”. L’arme peut taper dans l’élément associé et ses sorts de glace infligent également un bonus de +3 aux dégâts.' WHERE id = 'element-glace-3' AND description = 'L’arme de cette créature possède 30% de chance d’obliger un jet de vigueur à l’adversaire pour ne pas qu’il prenne “gelé 1”. L’arme peut taper dans l’élément associé et ses sorts de glace infligent également un bonus de +3 aux dégâts.';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('monstre_capacite_commune {"id": "element-glace-3"}', changes());

-- classe_annexe.texte

UPDATE classe_annexe SET texte = replace(texte, 'prenne "gelé 1"', 'prenne "gel 1"') WHERE classe_id = 'classes/mage-bleu' AND rang = 9
  AND length(texte) - length(replace(texte, 'prenne "gelé 1"', '')) = length('prenne "gelé 1"');
INSERT INTO garde_0103 (quoi, lignes) VALUES ('classe_annexe {"classe_id": "classes/mage-bleu", "rang": 9}', changes());

-- classe_annexe_entree.effet

UPDATE classe_annexe_entree SET effet = 'La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "gel 1".' WHERE id = 'classes/mage-bleu#entree:glace:attaque-glacante' AND effet = 'La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "gelé 1".';
INSERT INTO garde_0103 (quoi, lignes) VALUES ('classe_annexe_entree {"id": "classes/mage-bleu#entree:glace:attaque-glacante"}', changes());

-- page.corps_md

UPDATE page SET corps_md = replace(corps_md, 'prenne "gelé 1"', 'prenne "gel 1"') WHERE id = 'classes/mage-bleu'
  AND length(corps_md) - length(replace(corps_md, 'prenne "gelé 1"', '')) = length('prenne "gelé 1"');
INSERT INTO garde_0103 (quoi, lignes) VALUES ('page {"id": "classes/mage-bleu"}', changes());

-- monstre_defense : les cibles des rubriques de défense (lib/monstre-champs.mjs#valeursDeLaCarte : cibles(), normalize()), « Gelé » -> « Gel »
UPDATE monstre_defense SET cible = 'Gel', cible_cle = 'gel' WHERE cible = 'Gelé' AND cible_cle = 'gele';
INSERT INTO garde_0103 (quoi, lignes, attendu) VALUES ('monstre_defense', changes(), 77);
INSERT INTO garde_0103 (quoi, lignes, attendu) SELECT 'monstre_defense : plus aucune cible gele', count(*), 0 FROM monstre_defense WHERE cible_cle = 'gele';

DROP TABLE garde_0103;

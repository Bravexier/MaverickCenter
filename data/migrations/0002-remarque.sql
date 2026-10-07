-- 0002 : colonne `remarque` (texte libre, vide par défaut) dans les tables d'entités, remplie avec les notes de cellule du classeur.
-- Additive : ADD COLUMN nullable, placée EN DERNIER dans schema.sql (voir docs/sql/conception.md §10.1). Une remarque réunit, dans l'ordre (`rang`), les notes et commentaires
-- de la ligne, séparés par une ligne vide ; la table `note_cellule` garde chaque note avec sa cellule d'origine et sa nature (note, commentaire résolu).

ALTER TABLE accessoire_effet ADD COLUMN remarque TEXT;
ALTER TABLE accessoire_emplacement ADD COLUMN remarque TEXT;
ALTER TABLE accessoire_propriete ADD COLUMN remarque TEXT;
ALTER TABLE affinite ADD COLUMN remarque TEXT;
ALTER TABLE amelioration_cadaverique ADD COLUMN remarque TEXT;
ALTER TABLE amelioration_equipement ADD COLUMN remarque TEXT;
ALTER TABLE arme ADD COLUMN remarque TEXT;
ALTER TABLE arme_elementaire ADD COLUMN remarque TEXT;
ALTER TABLE arme_famille ADD COLUMN remarque TEXT;
ALTER TABLE arme_type ADD COLUMN remarque TEXT;
ALTER TABLE armure ADD COLUMN remarque TEXT;
ALTER TABLE armure_elementaire ADD COLUMN remarque TEXT;
ALTER TABLE armure_emplacement ADD COLUMN remarque TEXT;
ALTER TABLE batiment ADD COLUMN remarque TEXT;
ALTER TABLE baton_magique ADD COLUMN remarque TEXT;
ALTER TABLE bouclier ADD COLUMN remarque TEXT;
ALTER TABLE bouclier_classe ADD COLUMN remarque TEXT;
ALTER TABLE bouclier_poids ADD COLUMN remarque TEXT;
ALTER TABLE capacite ADD COLUMN remarque TEXT;
ALTER TABLE caracteristique ADD COLUMN remarque TEXT;
ALTER TABLE classe ADD COLUMN remarque TEXT;
ALTER TABLE competence ADD COLUMN remarque TEXT;
ALTER TABLE constante_equipement ADD COLUMN remarque TEXT;
ALTER TABLE creature ADD COLUMN remarque TEXT;
ALTER TABLE creature_attaque ADD COLUMN remarque TEXT;
ALTER TABLE creature_capacite ADD COLUMN remarque TEXT;
ALTER TABLE dieu ADD COLUMN remarque TEXT;
ALTER TABLE echelle_relation ADD COLUMN remarque TEXT;
ALTER TABLE etat ADD COLUMN remarque TEXT;
ALTER TABLE ethnie ADD COLUMN remarque TEXT;
ALTER TABLE familier ADD COLUMN remarque TEXT;
ALTER TABLE fiole_verre ADD COLUMN remarque TEXT;
ALTER TABLE invocation ADD COLUMN remarque TEXT;
ALTER TABLE invocation_bloc ADD COLUMN remarque TEXT;
ALTER TABLE invocation_capacite_commune ADD COLUMN remarque TEXT;
ALTER TABLE machine_guerre ADD COLUMN remarque TEXT;
ALTER TABLE magie ADD COLUMN remarque TEXT;
ALTER TABLE maladie ADD COLUMN remarque TEXT;
ALTER TABLE materiau_arme ADD COLUMN remarque TEXT;
ALTER TABLE materiau_armure ADD COLUMN remarque TEXT;
ALTER TABLE meteo ADD COLUMN remarque TEXT;
ALTER TABLE metier ADD COLUMN remarque TEXT;
ALTER TABLE mode_hyper_effet ADD COLUMN remarque TEXT;
ALTER TABLE mode_super_objet ADD COLUMN remarque TEXT;
ALTER TABLE mode_texte ADD COLUMN remarque TEXT;
ALTER TABLE monnaie ADD COLUMN remarque TEXT;
ALTER TABLE niveau_alchimie ADD COLUMN remarque TEXT;
ALTER TABLE objet_depart ADD COLUMN remarque TEXT;
ALTER TABLE peuple ADD COLUMN remarque TEXT;
ALTER TABLE posture ADD COLUMN remarque TEXT;
ALTER TABLE race ADD COLUMN remarque TEXT;
ALTER TABLE recette ADD COLUMN remarque TEXT;
ALTER TABLE regle_constante ADD COLUMN remarque TEXT;
ALTER TABLE resistance_duo ADD COLUMN remarque TEXT;
ALTER TABLE resistance_magie ADD COLUMN remarque TEXT;
ALTER TABLE ressource ADD COLUMN remarque TEXT;
ALTER TABLE seuil_niveau ADD COLUMN remarque TEXT;
ALTER TABLE sort ADD COLUMN remarque TEXT;
ALTER TABLE specialite ADD COLUMN remarque TEXT;
ALTER TABLE type_don ADD COLUMN remarque TEXT;

UPDATE accessoire_effet SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'accessoire_effet' AND n.entite_id = accessoire_effet.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'accessoire_effet');
UPDATE arme SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'arme' AND n.entite_id = arme.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'arme');
UPDATE arme_elementaire SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'arme_elementaire' AND n.entite_id = arme_elementaire.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'arme_elementaire');
UPDATE capacite SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'capacite' AND n.entite_id = capacite.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'capacite');
UPDATE creature SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'creature' AND n.entite_id = creature.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'creature');
UPDATE maladie SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'maladie' AND n.entite_id = maladie.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'maladie');
UPDATE sort SET remarque = (SELECT group_concat(texte, char(10) || char(10)) FROM (SELECT trim(n.texte, char(32, 9, 10, 13)) AS texte FROM note_cellule n WHERE n.entite_table = 'sort' AND n.entite_id = sort.id ORDER BY n.rang))
  WHERE id IN (SELECT entite_id FROM note_cellule WHERE entite_table = 'sort');

-- 0046-armures-boucliers : la page « Armures » des Ressources est refaite comme celle des armes, avec les boucliers dans la même page (demandes du
-- propriétaire, 2026-10-15 : « Je souhaite faire la refonte de l'onglet armure, de la même manière que les Armes » ; « Les deux seront dans la page » ;
-- « Il faut aussi inclure ce fonctionnement pour les boucliers » ; « Pour les bouclier c'est forme + matière ») ; elle se modifie sur le site de dev.
-- Migration de STRUCTURE et de DONNÉES.
--   * Structure : la contrainte de note_version_ligne.domaine admet 'armures' (armures, pièces, boucliers, formes, poids et leurs améliorations dans les
--     notes de version : client/src/lib/notes-de-version.mjs#DOMAINES). SQLite ne modifie pas une contrainte : la table est refaite à l'identique, ses
--     lignes recopiées.
--   * Données : décision R76, « + matériaux » écrit dans l'effet des améliorations +2 et +4 des boucliers (« +4 AP + matériaux », « +8 AP + matériaux »)
--     compte 1 matériau, une unité de la matière du bouclier (« 1 matériau : comme les armures ») : cout_materiaux = 1 (le découpage
--     client/src/lib/armure-champs.mjs#analyserAmeliorationDeProtection le redonne). Le texte de l'effet et la ligne TOTAL du tableau (« 15500 ») restent
--     tels qu'écrits.
--   * Données : la page « Bouclier » n'est plus construite (ses liens du wiki mènent à l'onglet Boucliers : client/src/lib/metiers.mjs#adresseDePage) ;
--     le seul lien écrit à la main vers elle, dans le chapitre du guide « L'équipement » (« Voir les [boucliers](/ressources/bouclier/). »), mène à
--     l'onglet (/ressources/armures/#boucliers) : seule l'adresse change, le texte reste (la version portable, sans page 404, n'a pas de renvoi).

CREATE TABLE note_version_ligne_0046 (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),                    -- ordre d'affichage
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire', 'armes', 'composants', 'chronologie', 'mots-cles', 'armures')),
  groupe      TEXT    CHECK (groupe IS NULL OR length(groupe) > 0),
  entite      TEXT    NOT NULL CHECK (length(entite) > 0),
  champ       TEXT    CHECK (champ IS NULL OR length(champ) > 0),    -- libellé de la colonne (« Coût ») ; NULL : l'entité entière (ajoutée, retirée)
  nature      TEXT    NOT NULL CHECK (nature IN ('ajoute', 'retire', 'modifie')),
  avant       TEXT,
  apres       TEXT,
  sens        TEXT    NOT NULL CHECK (sens IN ('amelioration', 'affaiblissement', 'neutre')),
  parties     TEXT    CHECK (parties IS NULL OR (json_valid(parties) AND json_type(parties) = 'array')),
  table_nom   TEXT    CHECK (table_nom IS NULL OR (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*')),
  cle         TEXT    CHECK (cle IS NULL OR (json_valid(cle) AND json_type(cle) = 'object')),
  colonne     TEXT    CHECK (colonne IS NULL OR length(colonne) > 0),
  PRIMARY KEY (version, rang),
  CHECK (nature <> 'ajoute' OR avant IS NULL),                      -- ajouté : rien avant (l'entité, ou un champ qui n'existait pas)
  CHECK (nature <> 'retire' OR apres IS NULL),                      -- retiré : rien après
  CHECK (nature <> 'modifie' OR champ IS NOT NULL)                  -- modifié : un champ précis
) STRICT;

INSERT INTO note_version_ligne_0046 SELECT * FROM note_version_ligne;
DROP TABLE note_version_ligne;
ALTER TABLE note_version_ligne_0046 RENAME TO note_version_ligne;

UPDATE amelioration_equipement SET cout_materiaux = 1
WHERE cible = 'bouclier' AND niveau IN (2, 4) AND cout_materiaux IS NULL AND effet_brut LIKE '%+ matériaux%';

UPDATE page SET corps_md = replace(corps_md, '](/ressources/bouclier/)', '](/ressources/armures/#boucliers)')
WHERE id = 'guide/l-equipement' AND instr(corps_md, '](/ressources/bouclier/)') > 0;

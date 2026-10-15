-- 0040-composants : la page « Composants » des Ressources (demande du propriétaire, 2026-10-14 : « Il comprendra les tableaux des gemmes, des matériaux,
-- la monnaie, et l'ensemble des tables de l'onglet « Équipement inventaire ». […] chaque élément est modifiable en édition, supprimable, ajoutable »).
-- Migration de STRUCTURE seulement :
--   * la contrainte de note_version_ligne.domaine admet 'composants' (gemmes, matériaux, monnaies et objets de l'onglet « Équipement inventaire » dans
--     les notes de version : client/src/lib/notes-de-version.mjs#DOMAINES). SQLite ne modifie pas une contrainte : la table est refaite à l'identique,
--     ses lignes recopiées.

CREATE TABLE note_version_ligne_0040 (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),                    -- ordre d'affichage
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire', 'armes', 'composants')),
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

INSERT INTO note_version_ligne_0040 SELECT * FROM note_version_ligne;
DROP TABLE note_version_ligne;
ALTER TABLE note_version_ligne_0040 RENAME TO note_version_ligne;

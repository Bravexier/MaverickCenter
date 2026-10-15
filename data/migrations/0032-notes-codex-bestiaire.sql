-- 0032-notes-codex-bestiaire : les notes de version (page « Mise à jour ») listent aussi les pages du Codex et le bestiaire, qui se modifient sur le
-- site de dev comme les règles (demande du propriétaire, 2026-10-11 : « Exactement comme pour les pages des règles les pages du codex doivent pouvoir
-- être modifiées aussi. Cela inclut donc le Bestiaire, ainsi que la possibilité de créer / modifier / supprimer un monstre »).
-- Migration de STRUCTURE : la contrainte de note_version_ligne.domaine admet 'codex' et 'bestiaire' (client/src/lib/notes-de-version.mjs#DOMAINES).
-- SQLite ne modifie pas une contrainte : la table est refaite à l'identique, ses lignes recopiées telles quelles.

CREATE TABLE note_version_ligne_0032 (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),                    -- ordre d'affichage
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire')),
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

INSERT INTO note_version_ligne_0032 SELECT * FROM note_version_ligne;
DROP TABLE note_version_ligne;
ALTER TABLE note_version_ligne_0032 RENAME TO note_version_ligne;

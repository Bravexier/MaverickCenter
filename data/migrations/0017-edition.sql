-- 0017-edition : le journal des modifications faites depuis le site de dev (demande du propriétaire : les pages du guide, des races, des magies, des
-- classes et des métiers se modifient sur le site de dev, et toute donnée liée à la base la modifie en conséquence). Section 14 de data/schema.sql.
-- Migration de STRUCTURE seulement : deux tables nouvelles, VIDES dans data/rows (comme la section 13, elles ne vivent que dans la base vivante du
-- service, db/ de l'instance) ; le service y écrit chaque modification dans la même transaction que la modification elle-même
-- (docs/sql/conception.md §10.3, client/serveur/edition.mjs).

CREATE TABLE modification_lot (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  fait_le    TEXT    NOT NULL CHECK (fait_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  auteur_id  TEXT    REFERENCES utilisateur(id),
  page_id    TEXT    CHECK (page_id IS NULL OR length(page_id) > 0),
  resume     TEXT    NOT NULL CHECK (length(resume) > 0)
) STRICT;

CREATE TABLE modification (
  lot_id     TEXT    NOT NULL REFERENCES modification_lot(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  table_nom  TEXT    NOT NULL CHECK (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*'),
  cle        TEXT    NOT NULL CHECK (json_valid(cle) AND json_type(cle) = 'object'),
  operation  TEXT    NOT NULL CHECK (operation IN ('inserer', 'modifier', 'supprimer')),
  avant      TEXT    CHECK (avant IS NULL OR (json_valid(avant) AND json_type(avant) = 'object')),
  apres      TEXT    CHECK (apres IS NULL OR (json_valid(apres) AND json_type(apres) = 'object')),
  etat       TEXT    NOT NULL CHECK (etat IN ('en_attente', 'integree', 'conflit')),
  detail     TEXT,
  PRIMARY KEY (lot_id, rang),
  CHECK ((operation = 'inserer') = (avant IS NULL)),
  CHECK ((operation = 'supprimer') = (apres IS NULL)),
  CHECK ((etat = 'conflit') = (detail IS NOT NULL))
) STRICT;
CREATE INDEX modification_etat ON modification (etat);
CREATE INDEX modification_ligne ON modification (table_nom, cle);

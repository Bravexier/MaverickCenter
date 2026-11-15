-- 0128-lots-de-changements : les lots de changements déposés par les sessions et le plafond des numéros donnés (chantier « la base du site de dev
-- devient la source de vérité », R274, R275 ; docs/chantier-base-de-dev.md, lot 6 et garde-fou 11 : « Un numéro n'est jamais redonné, même par un lot
-- ou après une restauration »).
-- Migration de STRUCTURE seule (section 14 ; PRAGMA user_version 127 -> 128) : deux tables neuves, vides dans data/rows comme le journal ; rien ne va
-- dans historique_modification.
--   1. lot_de_changements : une proposition déposée (en-tête recopié, contenu tel que déposé), son dernier essai à blanc, puis son application, son
--      refus ou son annulation ; l'application et l'annulation citent chacune le lot du journal qu'elles ont écrit (modification_lot) ; l'application
--      garde son bilan (opérations écrites, valeurs changées entre-temps et non écrites, numéros donnés).
--   2. numero_donne : le plus haut numéro donné par table et colonne de clé entière, jamais diminué.
-- La base vivante n'est pas migrée mais reconstruite : les deux tables suivent le journal (lib/tables-de-la-base.mjs#TABLES_DU_JOURNAL).

CREATE TABLE lot_de_changements (
  id                TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- UUID tiré par le service
  depose_le         TEXT    NOT NULL CHECK (depose_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  titre             TEXT    NOT NULL CHECK (length(titre) > 0),            -- l'en-tête du lot (`contenu`), recopié au dépôt : le résumé au journal
  nature            TEXT    NOT NULL CHECK (nature IN ('source', 'decision', 'migration', 'code')),
                                                                           -- celle de modification_lot.nature, jamais 'saisie' (un lot n'est pas une
                                                                           -- saisie du site) ; recopiée de l'en-tête, comme `decision`
  decision          TEXT    CHECK (decision IS NULL OR (decision GLOB 'R[0-9]*' AND decision NOT GLOB 'R*[^0-9]*')),
                                                                           -- numéro de la décision appliquée (« R275 ») ; présent ssi nature = 'decision'
  auteur            TEXT    CHECK (auteur IS NULL OR length(auteur) > 0),  -- texte libre de l'en-tête ; NULL : non dit
  contenu           TEXT    NOT NULL CHECK (json_valid(contenu) AND json_type(contenu) = 'object'
                                   AND coalesce(json_type(contenu, '$.operations'), '') = 'array'),
                                                                           -- le lot tel que déposé (en-tête et operations)
  etat              TEXT    NOT NULL CHECK (etat IN ('propose', 'applique', 'refuse', 'annule')),
  essai             TEXT    CHECK (essai IS NULL OR (json_valid(essai) AND json_type(essai) = 'object')),
                                                                           -- le dernier essai à blanc (aperçu, contrôles) ; NULL : jamais essayé
  essaye_le         TEXT    CHECK (essaye_le IS NULL OR essaye_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  decide_le         TEXT    CHECK (decide_le IS NULL OR decide_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
                                                                           -- instant de l'application ou du refus ; NULL ssi etat = 'propose'
  lot_id            TEXT    REFERENCES modification_lot(id),               -- le lot du journal écrit à l'application ; présent ssi appliqué ou annulé
  verrous_ouverts   TEXT    CHECK (verrous_ouverts IS NULL OR (json_valid(verrous_ouverts) AND json_type(verrous_ouverts) = 'array'
                                   AND json_type(verrous_ouverts, '$[0]') IS NOT NULL)),
                                                                           -- les numéros « R… » que le propriétaire a accepté d'ouvrir au clic
                                                                           -- d'application ; NULL : aucun verrou ouvert
  annule_le         TEXT    CHECK (annule_le IS NULL OR annule_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  annulation_lot_id TEXT    REFERENCES modification_lot(id),               -- le lot du journal qui annule celui-ci ; présent ssi etat = 'annule'
  bilan             TEXT    CHECK (bilan IS NULL OR (json_valid(bilan) AND json_type(bilan) = 'object')),
                                                                           -- ce que l'application a fait : opérations écrites, valeurs changées
                                                                           -- entre-temps et non écrites (avec la valeur trouvée au clic), numéros
                                                                           -- donnés ; NULL ssi proposé ou refusé
  CHECK ((nature = 'decision') = (decision IS NOT NULL)),
  CHECK ((essai IS NULL) = (essaye_le IS NULL)),
  CHECK ((etat = 'propose') = (decide_le IS NULL)),
  CHECK ((etat IN ('applique', 'annule')) = (lot_id IS NOT NULL)),
  CHECK ((etat = 'annule') = (annule_le IS NOT NULL)),
  CHECK ((etat = 'annule') = (annulation_lot_id IS NOT NULL)),
  CHECK ((etat IN ('applique', 'annule')) = (bilan IS NOT NULL)),
  CHECK (verrous_ouverts IS NULL OR etat IN ('applique', 'annule')),
  CHECK (annulation_lot_id IS NULL OR annulation_lot_id <> lot_id),
  CHECK (essaye_le IS NULL OR essaye_le >= depose_le),
  CHECK (decide_le IS NULL OR decide_le >= depose_le),
  CHECK (annule_le IS NULL OR annule_le >= decide_le)
) STRICT;
CREATE UNIQUE INDEX lot_de_changements_lot ON lot_de_changements (lot_id);
CREATE UNIQUE INDEX lot_de_changements_annulation ON lot_de_changements (annulation_lot_id);

CREATE TABLE numero_donne (
  table_nom TEXT    NOT NULL CHECK (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*'),
  colonne   TEXT    NOT NULL CHECK (length(colonne) > 0 AND colonne NOT GLOB '*[^a-z0-9_]*'),
  plafond   INTEGER NOT NULL CHECK (plafond >= 0),
  PRIMARY KEY (table_nom, colonne)
) STRICT;

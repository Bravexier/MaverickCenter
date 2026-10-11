-- 0023-notes-de-version : la page « Mise à jour » (demande du propriétaire). Section 14 : le brouillon de la note de version du site de dev
-- (note_version_brouillon, vide dans data/rows comme le journal). Section 15 : les notes de version (note_version, note_version_ligne : ce que
-- chaque version livrée a changé, montré en production avec l'historique) et l'historique des modifications du site de dev une fois livrées
-- (historique_modification). Données : deux notes de version D'EXEMPLE en lorem ipsum (exemple = 1), demandées par le propriétaire tant qu'aucune
-- version n'a été livrée ; la première vraie mise à jour les retire (client/scripts/mise-a-jour-regles.mjs).

CREATE TABLE note_version_brouillon (
  id          INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  texte       TEXT,
  modifie_le  TEXT    CHECK (modifie_le IS NULL OR modifie_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  lot         TEXT    CHECK (lot IS NULL OR length(lot) > 0)
) STRICT;

CREATE TABLE note_version (
  version     TEXT    NOT NULL PRIMARY KEY CHECK (version GLOB '[0-9]*.[0-9]*' AND version NOT GLOB '*[^0-9.]*' AND version NOT GLOB '*.*.*'),
  publiee_le  TEXT    NOT NULL CHECK (publiee_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  depuis      TEXT    CHECK (depuis IS NULL OR (depuis GLOB '[0-9]*.[0-9]*' AND depuis NOT GLOB '*[^0-9.]*')),
  texte       TEXT,
  lot         TEXT    CHECK (lot IS NULL OR length(lot) > 0),
  exemple     INTEGER NOT NULL DEFAULT 0 CHECK (exemple IN (0, 1))
) STRICT;

CREATE TABLE note_version_ligne (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide')),
  groupe      TEXT    CHECK (groupe IS NULL OR length(groupe) > 0),
  entite      TEXT    NOT NULL CHECK (length(entite) > 0),
  champ       TEXT    CHECK (champ IS NULL OR length(champ) > 0),
  nature      TEXT    NOT NULL CHECK (nature IN ('ajoute', 'retire', 'modifie')),
  avant       TEXT,
  apres       TEXT,
  sens        TEXT    NOT NULL CHECK (sens IN ('amelioration', 'affaiblissement', 'neutre')),
  parties     TEXT    CHECK (parties IS NULL OR (json_valid(parties) AND json_type(parties) = 'array')),
  table_nom   TEXT    CHECK (table_nom IS NULL OR (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*')),
  cle         TEXT    CHECK (cle IS NULL OR (json_valid(cle) AND json_type(cle) = 'object')),
  colonne     TEXT    CHECK (colonne IS NULL OR length(colonne) > 0),
  PRIMARY KEY (version, rang),
  CHECK (nature <> 'ajoute' OR avant IS NULL),
  CHECK (nature <> 'retire' OR apres IS NULL),
  CHECK (nature <> 'modifie' OR champ IS NOT NULL)
) STRICT;

CREATE TABLE historique_modification (
  lot_id      TEXT    NOT NULL CHECK (length(lot_id) > 0),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  fait_le     TEXT    NOT NULL CHECK (fait_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  resume      TEXT    NOT NULL CHECK (length(resume) > 0),
  version     TEXT    REFERENCES note_version(version),              -- version qui l'a livrée ; NULL : rapatriée à la main (npm run db:appliquer-edition)
  table_nom   TEXT    NOT NULL CHECK (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*'),
  cle         TEXT    NOT NULL CHECK (json_valid(cle) AND json_type(cle) = 'object'),
  operation   TEXT    NOT NULL CHECK (operation IN ('inserer', 'modifier', 'supprimer')),
  avant       TEXT    CHECK (avant IS NULL OR (json_valid(avant) AND json_type(avant) = 'object')),
  apres       TEXT    CHECK (apres IS NULL OR (json_valid(apres) AND json_type(apres) = 'object')),
  PRIMARY KEY (lot_id, rang),
  CHECK ((operation = 'inserer') = (avant IS NULL)),
  CHECK ((operation = 'supprimer') = (apres IS NULL))
) STRICT;
CREATE INDEX historique_modification_ligne ON historique_modification (table_nom, cle);

INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES
  ('0.0', '2026-09-01', NULL, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. **Exemple** : cette note n''est pas une vraie version.', NULL, 1),
  ('0.1', '2026-10-01', '0.0', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

- Ut enim ad minim veniam, quis nostrud exercitation.
- Duis aute irure dolor in reprehenderit in voluptate.

*Exemple* : cette note n''est pas une vraie version, elle disparaîtra à la première mise à jour.', NULL, 1);

INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES
  ('0.0', 1, 'sorts', 'Lorem', 'Ipsum', 'Portée', 'modifie', '4', '5', 'amelioration', NULL, NULL, NULL, NULL),
  ('0.0', 2, 'metiers', NULL, 'Dolor', NULL, 'ajoute', NULL, 'Dolor', 'neutre', NULL, NULL, NULL, NULL),
  ('0.1', 1, 'sorts', 'Lorem', 'Ipsum', 'Coût', 'modifie', '6', '8 (-1/NM)', 'affaiblissement',
   '[{"partie":"valeur","avant":"6","apres":"8","sens":"affaiblissement"},{"partie":"nm","avant":null,"apres":"-1/NM","sens":"amelioration"}]', NULL, NULL, NULL),
  ('0.1', 2, 'sorts', 'Lorem', 'Ipsum', 'Portée', 'modifie', '6 (+1/NM)', '6', 'affaiblissement',
   '[{"partie":"nm","avant":"+1/NM","apres":null,"sens":"affaiblissement"}]', NULL, NULL, NULL),
  ('0.1', 3, 'sorts', 'Lorem', 'Dolor sit', 'Effets secondaires', 'modifie', 'Lorem ipsum dolor sit amet.', 'Lorem ipsum dolor sit amet. Consectetur adipiscing elit.', 'amelioration', NULL, NULL, NULL, NULL),
  ('0.1', 4, 'sorts', 'Amet', 'Consectetur', 'D/S/B', 'modifie', '7D6 + 15 dégâts', '6D6 + 20 dégâts', 'amelioration', NULL, NULL, NULL, NULL),
  ('0.1', 5, 'magies', 'Amet', 'Amet', 'Présentation', 'modifie', 'Sed ut perspiciatis unde omnis iste natus error.', 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem.', 'neutre', NULL, NULL, NULL, NULL),
  ('0.1', 6, 'classes', 'Adipiscing', 'Elit', 'Type', 'modifie', 'Réaction (3 fois/combat)', 'Réaction (2 fois/combat)', 'affaiblissement', NULL, NULL, NULL, NULL),
  ('0.1', 7, 'races', 'Tempor', 'Tempor', 'Santé de départ', 'modifie', '10', '12', 'amelioration', NULL, NULL, NULL, NULL),
  ('0.1', 8, 'metiers', NULL, 'Incididunt', NULL, 'ajoute', NULL, 'Incididunt', 'neutre', NULL, NULL, NULL, NULL),
  ('0.1', 9, 'guide', 'Labore', 'Dolore magna', 'Texte', 'modifie', 'Ut enim ad minim veniam.', 'Ut enim ad minim veniam, quis nostrud.', 'neutre', NULL, NULL, NULL, NULL);

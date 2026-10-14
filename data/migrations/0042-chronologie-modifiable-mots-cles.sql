-- 0042-chronologie-modifiable-mots-cles : la chronologie se modifie sur le site de dev, ses événements se rangent dans des catégories, et les mots-clés
-- deviennent un vocabulaire géré depuis /recherche/ (demandes du propriétaire, 2026-10-14 : « J'aimerais que la page puisse être modifiée […] supprimer une
-- page, ou en créer une nouvelle, lui attribuant une date », « supprimer / ajouter / modifier des mots clés. Une suppression d'un mot clé le supprimera de
-- tous les endroits qui le référencent », puis « Les mots clés sont trop nombreux et trop libres pour faire de vraies catégories stables. Le filtre sera donc
-- sous forme de liste déroulante sur un champ catégorie. On peut choisir plusieurs catégories pour chaque entrée, mais pas pour le filtre »).
-- Migration de STRUCTURE et de DONNÉES.
--   * mot_cle : le vocabulaire, rempli depuis page_tag (412 mots-clés). id = l'ancien tag_id ; libellé = l'écriture que montrait la vue `tag` (celle de la
--     page de plus petit (titre_cle, id) ; deux mots-clés avaient plusieurs écritures : « espace/temps », « altérations d'état ») ; libelle_cle = tag_id.
--   * page_tag : tag_id devient une clé étrangère vers mot_cle (ON DELETE CASCADE) ; la colonne `libelle` disparaît (l'écriture vit dans mot_cle).
--   * evenement_extrait (les blocs de description) : page_id devient facultatif (un bloc écrit sur le site de dev peut n'avoir aucun lien).
--   * categorie_chronologie, evenement_categorie : les catégories de la chronologie et celles de chaque événement (aucune à l'import : rien dans les sources
--     ne range les événements ; elles se créent sur le site de dev).
--   * La vue `tag` est remplacée par `v_mot_cle` ; la contrainte de note_version_ligne.domaine admet 'chronologie' et 'mots-cles'.
-- SQLite ne modifie pas une colonne ni une contrainte : les tables sont refaites, leurs lignes recopiées (la vue qui cite page_tag d'abord supprimée).

DROP VIEW tag;

CREATE TABLE mot_cle (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-'),
  libelle     TEXT    NOT NULL CHECK (length(libelle) > 0),
  libelle_cle TEXT    NOT NULL UNIQUE CHECK (length(libelle_cle) > 0 AND libelle_cle NOT GLOB '*[^a-z0-9-]*' AND libelle_cle NOT GLOB '*--*' AND libelle_cle NOT GLOB '-*' AND libelle_cle NOT GLOB '*-')
) STRICT;

INSERT INTO mot_cle (id, libelle, libelle_cle)
SELECT DISTINCT
  pt.tag_id,
  first_value(pt.libelle) OVER (PARTITION BY pt.tag_id ORDER BY p.titre_cle, p.id, pt.ordre),
  pt.tag_id
FROM page_tag pt JOIN page p ON p.id = pt.page_id;

CREATE TABLE page_tag_0042 (
  page_id TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  ordre   INTEGER NOT NULL CHECK (ordre >= 0),
  tag_id  TEXT    NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, ordre),
  UNIQUE (page_id, tag_id)
) STRICT;
INSERT INTO page_tag_0042 (page_id, ordre, tag_id) SELECT page_id, ordre, tag_id FROM page_tag;
DROP TABLE page_tag;
ALTER TABLE page_tag_0042 RENAME TO page_tag;
CREATE INDEX page_tag_tag ON page_tag (tag_id);

CREATE TABLE evenement_extrait_0042 (
  evenement_id TEXT    NOT NULL REFERENCES evenement(id),
  rang         INTEGER NOT NULL CHECK (rang >= 1),
  page_id      TEXT    REFERENCES page(id),
  section      TEXT    CHECK (section IS NULL OR length(section) > 0),
  texte        TEXT    NOT NULL CHECK (length(texte) > 0),
  date_brut    TEXT    CHECK (date_brut IS NULL OR instr(texte, date_brut) > 0),
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'chronologie'),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (evenement_id, rang),
  CHECK (page_id IS NOT NULL OR section IS NULL)
) STRICT, WITHOUT ROWID;
INSERT INTO evenement_extrait_0042 SELECT * FROM evenement_extrait;
DROP TABLE evenement_extrait;
ALTER TABLE evenement_extrait_0042 RENAME TO evenement_extrait;
CREATE INDEX evenement_extrait_page_fk ON evenement_extrait (page_id);

CREATE TABLE categorie_chronologie (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-' AND id <> 'sans-categorie'),
  libelle     TEXT    NOT NULL CHECK (length(libelle) > 0),
  libelle_cle TEXT    NOT NULL UNIQUE CHECK (length(libelle_cle) > 0 AND libelle_cle NOT GLOB '*[^a-z0-9-]*' AND libelle_cle NOT GLOB '*--*' AND libelle_cle NOT GLOB '-*' AND libelle_cle NOT GLOB '*-')
) STRICT;

CREATE TABLE evenement_categorie (
  evenement_id TEXT    NOT NULL REFERENCES evenement(id),
  categorie_id TEXT    NOT NULL REFERENCES categorie_chronologie(id) ON DELETE CASCADE,
  PRIMARY KEY (evenement_id, categorie_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX evenement_categorie_categorie ON evenement_categorie (categorie_id);

CREATE TABLE note_version_ligne_0042 (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire', 'armes', 'composants', 'chronologie', 'mots-cles')),
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
INSERT INTO note_version_ligne_0042 SELECT * FROM note_version_ligne;
DROP TABLE note_version_ligne;
ALTER TABLE note_version_ligne_0042 RENAME TO note_version_ligne;

CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.libelle_cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages
  FROM mot_cle m;

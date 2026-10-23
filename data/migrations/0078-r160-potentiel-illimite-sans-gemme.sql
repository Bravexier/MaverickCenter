-- 0078-r160-potentiel-illimite-sans-gemme : décision R160 du propriétaire (2026-10-23, docs/decisions-regles.md) : « Il est considéré comme une
-- magie à part, mais n'a pas d'élement propre. C'est une magie qui empreinte les sorts des autres magies. Il n'existe aucune gemme ni aucune piece
-- élémentaire du PI. » ; « La base refuse : la base elle-même interdit une gemme, un bâton ou une pièce élémentaire du PI : une migration ou une
-- édition du site de dev qui en ajoute une échoue, et un test l'épingle. » Migration de STRUCTURE seule : aucune ligne ne change.
--   * gemme, bois, baton_magique, arme_elementaire, armure_elementaire reçoivent une contrainte CHECK nommée <table>_sans_potentiel_illimite
--     (magie_id <> 'magies/potentiel-illimite') : SQL standard (docs/feuille-de-route.md, « SQL portable » ; ALTER TABLE … ADD CONSTRAINT en
--     PostgreSQL). SQLite n'ajoute pas de contrainte à une table existante : chacune est reconstruite (créée sous <table>_0078, lignes recopiées,
--     ancienne supprimée, renommée), mêmes colonnes dans le même ordre, mêmes identifiants. Les clés étrangères qui les citent
--     (armure_elementaire_effet, personnage, personnage_arme) visent leur nom et le retrouvent après le renommage.
--   * Index recréés : arme_elementaire_magie, armure_elementaire_magie. Vue v_objet_ceinture (lit baton_magique) supprimée puis recréée telle
--     quelle : SQLite refuse de renommer une table tant qu'une vue cite une table absente.
--   * bois : même garde-fou, bois_sans_potentiel_illimite (R160 étendue au bois par le propriétaire : « Oui, aucun bois du PI » ; « Même garde-fou
--     que les gemmes : la base refuse un bois du PI et le site de dev ne le propose plus. »). Aucune vue ni clé étrangère ne vise bois ; ses deux
--     index sont ceux de ses contraintes (clé primaire, UNIQUE), recréés avec elle.

DROP VIEW v_objet_ceinture;

-- gemme
CREATE TABLE gemme_0078 (
  ressource_id           TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  magie_id               TEXT    NOT NULL UNIQUE REFERENCES magie(id),   -- gemme « liée à une magie »
  prix_commune_brut      TEXT,  prix_commune_rf      INTEGER CHECK (prix_commune_rf IS NULL OR prix_commune_rf >= 0),   -- Bâton magique : gemme entière
  prix_raffinee_brut     TEXT,  prix_raffinee_rf     INTEGER CHECK (prix_raffinee_rf IS NULL OR prix_raffinee_rf >= 0),
  prix_parfaite_brut     TEXT,  prix_parfaite_rf     INTEGER CHECK (prix_parfaite_rf IS NULL OR prix_parfaite_rf >= 0),
  quart_commune_brut     TEXT,  quart_commune_rf     INTEGER CHECK (quart_commune_rf IS NULL OR quart_commune_rf >= 0),   -- Accessoires : quart de gemme
  quart_raffinee_brut    TEXT,  quart_raffinee_rf    INTEGER CHECK (quart_raffinee_rf IS NULL OR quart_raffinee_rf >= 0),
  quart_parfaite_brut    TEXT,  quart_parfaite_rf    INTEGER CHECK (quart_parfaite_rf IS NULL OR quart_parfaite_rf >= 0),
  origine                TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref             TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CONSTRAINT gemme_sans_potentiel_illimite CHECK (magie_id <> 'magies/potentiel-illimite')   -- R160 : aucune gemme du Potentiel Illimité
) STRICT;

INSERT INTO gemme_0078 (ressource_id, magie_id, prix_commune_brut, prix_commune_rf, prix_raffinee_brut, prix_raffinee_rf, prix_parfaite_brut, prix_parfaite_rf, quart_commune_brut, quart_commune_rf, quart_raffinee_brut, quart_raffinee_rf, quart_parfaite_brut, quart_parfaite_rf, origine, source_ref)
  SELECT ressource_id, magie_id, prix_commune_brut, prix_commune_rf, prix_raffinee_brut, prix_raffinee_rf, prix_parfaite_brut, prix_parfaite_rf, quart_commune_brut, quart_commune_rf, quart_raffinee_brut, quart_raffinee_rf, quart_parfaite_brut, quart_parfaite_rf, origine, source_ref FROM gemme;

DROP TABLE gemme;
ALTER TABLE gemme_0078 RENAME TO gemme;

-- bois
CREATE TABLE bois_0078 (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  magie_id      TEXT    NOT NULL UNIQUE REFERENCES magie(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CONSTRAINT bois_sans_potentiel_illimite CHECK (magie_id <> 'magies/potentiel-illimite')   -- R160 : aucun bois du Potentiel Illimité
) STRICT;

INSERT INTO bois_0078 (ressource_id, magie_id, origine, source_ref)
  SELECT ressource_id, magie_id, origine, source_ref FROM bois;

DROP TABLE bois;
ALTER TABLE bois_0078 RENAME TO bois;

-- baton_magique
CREATE TABLE baton_magique_0078 (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'ressources/baton-magique#baton:feu:2'
  magie_id      TEXT    NOT NULL REFERENCES magie(id),
  niveau        INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 3),
  bonus_brut    TEXT    NOT NULL,                     -- « Dégâts sort +6 », « ampli am = +2 am donné⏎protection = +5 dégâts bloqué »
  recette_id    TEXT    NOT NULL UNIQUE REFERENCES recette(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (magie_id, niveau),
  CONSTRAINT baton_magique_sans_potentiel_illimite CHECK (magie_id <> 'magies/potentiel-illimite')   -- R160 : aucun bâton du Potentiel Illimité
) STRICT;

INSERT INTO baton_magique_0078 (id, magie_id, niveau, bonus_brut, recette_id, origine, source_ref, remarque)
  SELECT id, magie_id, niveau, bonus_brut, recette_id, origine, source_ref, remarque FROM baton_magique;

DROP TABLE baton_magique;
ALTER TABLE baton_magique_0078 RENAME TO baton_magique;

-- arme_elementaire
CREATE TABLE arme_elementaire_0078 (
  id               TEXT    NOT NULL PRIMARY KEY,      -- 'ressources/pieces-elementaires#arme-elementaire:epee:sang'
  type_id          TEXT    NOT NULL REFERENCES arme_type(id),
  magie_id         TEXT    NOT NULL REFERENCES magie(id),   -- élément (en-tête de colonne SANG, ARCANE, … LUMIERE)
  colonne_brut     TEXT    NOT NULL,                  -- en-tête de colonne tel qu'écrit : « LUMIERE », « NÉCROMANCIE »
  nom              TEXT    NOT NULL CHECK (length(nom) > 0),                  -- « Épée de Sang »
  bonus_degats     INTEGER NOT NULL,                  -- 8 de « +8 Dégâts »
  element_brut     TEXT    NOT NULL,                  -- « Élément Sang », « Élément Nécomancie » (coquille conservée)
  capacite_nom     TEXT,                              -- « Sang explosif »
  capacite_mode    TEXT    CHECK (capacite_mode IN ('actif', 'passif', 'action')),   -- mot entre parenthèses
  capacite_texte   TEXT,
  capacite_brut    TEXT    NOT NULL,                  -- 4e ligne entière
  ordre            INTEGER NOT NULL CHECK (ordre >= 1),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (type_id, magie_id),
  CONSTRAINT arme_elementaire_sans_potentiel_illimite CHECK (magie_id <> 'magies/potentiel-illimite')   -- R160 : aucune arme élémentaire du Potentiel Illimité
) STRICT;

INSERT INTO arme_elementaire_0078 (id, type_id, magie_id, colonne_brut, nom, bonus_degats, element_brut, capacite_nom, capacite_mode, capacite_texte, capacite_brut, ordre, origine, source_ref, remarque)
  SELECT id, type_id, magie_id, colonne_brut, nom, bonus_degats, element_brut, capacite_nom, capacite_mode, capacite_texte, capacite_brut, ordre, origine, source_ref, remarque FROM arme_elementaire;

DROP TABLE arme_elementaire;
ALTER TABLE arme_elementaire_0078 RENAME TO arme_elementaire;

CREATE INDEX arme_elementaire_magie ON arme_elementaire (magie_id);

-- armure_elementaire
CREATE TABLE armure_elementaire_0078 (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'ressources/pieces-elementaires#armure-elementaire:leger:sang'
  categorie     TEXT    NOT NULL CHECK (categorie IN ('Vêtement', 'Léger', 'Intermédiaire', 'Lourd')),
  magie_id      TEXT    NOT NULL REFERENCES magie(id),
  colonne_brut  TEXT    NOT NULL,
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- « Garde coeur », « Tissu du saigneur »
  ap            INTEGER CHECK (ap IS NULL OR ap >= 0),   -- « 7.0 » -> 7
  am            INTEGER CHECK (am IS NULL OR am >= 0),
  effets_brut   TEXT    NOT NULL,                     -- cellule « Effet(s) » entière (lignes « - … »)
  ordre         INTEGER NOT NULL CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (categorie, magie_id),
  CONSTRAINT armure_elementaire_sans_potentiel_illimite CHECK (magie_id <> 'magies/potentiel-illimite')   -- R160 : aucune armure élémentaire du Potentiel Illimité
) STRICT;

INSERT INTO armure_elementaire_0078 (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque)
  SELECT id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque FROM armure_elementaire;

DROP TABLE armure_elementaire;
ALTER TABLE armure_elementaire_0078 RENAME TO armure_elementaire;

CREATE INDEX armure_elementaire_magie ON armure_elementaire (magie_id);

-- Vue : copiée de data/schema.sql

CREATE VIEW v_objet_ceinture AS
  SELECT p.famille AS famille, p.ressource_id AS ressource_id, CAST(NULL AS TEXT) AS baton_id
  FROM potion p
  UNION ALL
  SELECT 'contenant', r.id, CAST(NULL AS TEXT)
  FROM ressource r
  WHERE r.genre = 'materiel'
    AND (r.nom_cle LIKE '%carquois%' OR r.nom_cle LIKE '%sac-de-bombe%' OR r.nom_cle LIKE '%sac-de-pierre%')
  UNION ALL
  SELECT 'baton', CAST(NULL AS TEXT), b.id
  FROM baton_magique b;

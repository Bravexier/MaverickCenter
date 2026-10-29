-- 0083-r174-resistances-physiques : décision R174 du propriétaire (2026-10-29, docs/decisions-regles.md) : « Pour les défenses physiques, le mode
-- hyper se contente d'annuler malus passif du PI qui réduit de 1 toutes les défenses physiques. (il serai bien de rajouter les 3 type de physique dans
-- le tableau de résistance d'ailleurs : Estoc, Frappe, Taille) » ; « Oui, palier personnel ». Le Potentiel Illimité (toujours la magie innée, R176) a
-- un cran de moins contre chacun des trois types physiques, soit la Vulnérabilité (x2, resistance_palier, R155), comme un cran de magie.
--   * Structure : magie_resistance.cible_type admet 'physique', avec la colonne cible_physique ('estoc', 'taille', 'frappe' : le vocabulaire de
--     creature_attaque_type), ajoutée en dernier ; la contrainte de cohérence (exactement une cible renseignée, celle de cible_type) devient
--     magie_resistance_une_cible ; UNIQUE (magie_id, sens, cible_physique). SQLite ne change pas un CHECK : la table est reconstruite (créée sous
--     magie_resistance_0083, lignes recopiées, ancienne supprimée, renommée), mêmes colonnes dans le même ordre, la nouvelle en dernier. Aucune clé
--     étrangère ne la vise. Index recréés : magie_resistance_cible_magie, magie_resistance_cible_etat. Vues v_creature_resistance et
--     v_resistance_combinaison (lisent magie_resistance, cibles 'magie' seulement) supprimées puis recréées telles quelles : SQLite refuse de renommer
--     une table tant qu'une vue cite une table absente.
--   * Données : trois lignes du Potentiel Illimité, sens 'vulnerabilite', cible_type 'physique', rangs 1 à 3 (estoc, taille, frappe) ; cible_brut =
--     le texte de magie.explication (cellule A26 de l'onglet, orthographe de la migration 0003 : « dégâts physiques »), le même sur les trois lignes.
--     Aucune autre ligne ne change.

DROP VIEW v_creature_resistance;
DROP VIEW v_resistance_combinaison;

CREATE TABLE magie_resistance_0083 (
  magie_id        TEXT    NOT NULL REFERENCES magie(id),
  sens            TEXT    NOT NULL CHECK (sens IN ('resistance', 'vulnerabilite')),
  cible_type      TEXT    NOT NULL CHECK (cible_type IN ('magie', 'etat', 'physique')),
  rang            INTEGER NOT NULL CHECK (rang >= 1),
  cible_magie_id  TEXT    REFERENCES magie(id),
  cible_etat_id   TEXT    REFERENCES etat(id),
  cible_brut      TEXT    NOT NULL,
  origine         TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  cible_physique  TEXT    CHECK (cible_physique IN ('estoc', 'taille', 'frappe')),   -- 'physique' : type de dégâts physiques visé (R174)
  PRIMARY KEY (magie_id, sens, cible_type, rang),
  UNIQUE (magie_id, sens, cible_magie_id),
  UNIQUE (magie_id, sens, cible_etat_id),
  UNIQUE (magie_id, sens, cible_physique),
  -- exactement une cible renseignée, celle de cible_type
  CONSTRAINT magie_resistance_une_cible CHECK (
         (cible_type = 'magie'    AND cible_magie_id IS NOT NULL AND cible_etat_id  IS NULL AND cible_physique IS NULL)
      OR (cible_type = 'etat'     AND cible_etat_id  IS NOT NULL AND cible_magie_id IS NULL AND cible_physique IS NULL)
      OR (cible_type = 'physique' AND cible_physique IS NOT NULL AND cible_magie_id IS NULL AND cible_etat_id  IS NULL))
) STRICT, WITHOUT ROWID;

INSERT INTO magie_resistance_0083 (magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut, origine, source_ref, cible_physique)
  SELECT magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut, origine, source_ref, NULL FROM magie_resistance;

DROP TABLE magie_resistance;
ALTER TABLE magie_resistance_0083 RENAME TO magie_resistance;

CREATE INDEX magie_resistance_cible_magie ON magie_resistance (cible_magie_id, sens) WHERE cible_magie_id IS NOT NULL;

CREATE INDEX magie_resistance_cible_etat  ON magie_resistance (cible_etat_id, sens)  WHERE cible_etat_id  IS NOT NULL;

CREATE VIEW v_creature_resistance AS
  SELECT ca.creature_id AS creature_id, r.sens AS sens, r.sens_brut AS sens_brut, r.cible_type AS cible_type,
         r.cible_magie_id AS cible_magie_id, r.cible_etat_id AS cible_etat_id, r.cible_degat AS cible_degat,
         r.cible_brut AS cible_brut, 'capacite' AS provenance, ca.id AS source_id, ca.npm_min AS npm_min,
         NULL AS via_magie_id
    FROM creature_capacite_resistance r JOIN creature_capacite ca ON ca.id = r.capacite_id
  UNION ALL
  SELECT c.id, r.sens, r.sens_brut, r.cible_type, r.cible_magie_id, r.cible_etat_id, r.cible_degat, r.cible_brut,
         'commune', r.capacite_commune_id, NULL, NULL
    FROM invocation_resistance r
    JOIN invocation_capacite_commune k ON k.id = r.capacite_commune_id
    JOIN creature c ON c.invocation_id = k.invocation_id
  UNION ALL
  SELECT DISTINCT c.id, mr.sens, NULL, 'magie', mr.cible_magie_id, NULL, NULL, mr.cible_brut,
         'element', k.id, NULL, mr.magie_id
    FROM creature c
    JOIN invocation_capacite_commune k ON k.invocation_id = c.invocation_id AND k.nom_cle = 'elementaire'
    JOIN invocation_bloc_magie bm ON bm.bloc_id = c.bloc_id
    JOIN magie_resistance mr ON mr.magie_id = bm.magie_id AND mr.cible_type = 'magie';

CREATE VIEW v_resistance_combinaison AS
WITH cran AS (
  SELECT magie_id, cible_magie_id, CASE sens WHEN 'resistance' THEN 1 ELSE -1 END AS valeur
  FROM magie_resistance
  WHERE cible_type = 'magie'
),
somme AS (
  SELECT a.id AS magie_a_id, b.id AS magie_b_id, c.cible_magie_id, SUM(c.valeur) AS valeur
  FROM magie a
  JOIN magie b ON b.ordre > a.ordre
  JOIN cran c ON c.magie_id = a.id OR c.magie_id = b.id
  GROUP BY a.id, b.id, c.cible_magie_id
)
SELECT s.magie_a_id, s.magie_b_id, s.cible_magie_id, s.valeur, p.id AS palier_id
FROM somme s
JOIN resistance_palier p ON (p.valeur_min IS NULL OR s.valeur >= p.valeur_min) AND (p.valeur_max IS NULL OR s.valeur <= p.valeur_max);

-- R174 : la Surtension corporelle du Potentiel Illimité, un cran de moins à chacun des trois types physiques
INSERT INTO magie_resistance (magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut, origine, source_ref, cible_physique) VALUES ('magies/potentiel-illimite', 'vulnerabilite', 'physique', 1, NULL, NULL, 'Surtension corporelle (Vulnérabilité contre les dégâts physiques', 'magies', 'Magie Maverick V8 › Potentiel illimité (magie diffi › A26', 'estoc');
INSERT INTO magie_resistance (magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut, origine, source_ref, cible_physique) VALUES ('magies/potentiel-illimite', 'vulnerabilite', 'physique', 2, NULL, NULL, 'Surtension corporelle (Vulnérabilité contre les dégâts physiques', 'magies', 'Magie Maverick V8 › Potentiel illimité (magie diffi › A26', 'taille');
INSERT INTO magie_resistance (magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_brut, origine, source_ref, cible_physique) VALUES ('magies/potentiel-illimite', 'vulnerabilite', 'physique', 3, NULL, NULL, 'Surtension corporelle (Vulnérabilité contre les dégâts physiques', 'magies', 'Magie Maverick V8 › Potentiel illimité (magie diffi › A26', 'frappe');

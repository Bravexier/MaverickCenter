-- 0052-ceinture-carquois-vide : réponses du propriétaire du 2026-10-16 sur la ceinture de la fiche de personnage (décision R89). Migration de STRUCTURE.
--   « Règle spéciale pour les carquois et autre conteneur de projectiles : ils augmentent le maximum possible de la case quantité associée dans la
--   ceinture pour représenter les flèches / carreau d'arbalètes / billes de fronde, Bombes. Un Carquois à 0 est juste un carquois vide. »
-- La quantité d'un emplacement de ceinture admet donc 0 (un carquois, un sac de bombes ou de pierres vide ; la page n'en permet pas d'autre :
-- client/src/lib/fiche-moteur.mjs#minimumDeLEmplacement). SQLite ne modifie pas une contrainte : la table est refaite à l'identique, ses lignes
-- recopiées (elle est vide dans data/rows ; la base vivante du service reprend les siennes à sa reconstruction).

CREATE TABLE personnage_ceinture_0052 (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),   -- l'emplacement
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),
  quantite       INTEGER NOT NULL CHECK (quantite >= 0),          -- 0 : un carquois ou un sac de projectiles vide (décision R89)
  ressource_id   TEXT    REFERENCES ressource(id),
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

INSERT INTO personnage_ceinture_0052 SELECT * FROM personnage_ceinture;
DROP TABLE personnage_ceinture;
ALTER TABLE personnage_ceinture_0052 RENAME TO personnage_ceinture;

-- 0031-fiche-zones : la fiche de personnage refaite en quatre zones (demandes du propriétaire, maquette validée le 2026-10-11).
-- - Portrait : personnage.portrait (l'image réduite par la page, en data URL), portrait_x, portrait_y (centre du cadre carré dans l'image, de 0 à 1) et
--   portrait_zoom (de 1 à 4), pour la recadrer plus tard ; NULL = le logo. Colonnes placées en dernier.
-- - Ceinture : table personnage_ceinture, ses 3 emplacements d'objets rapides (guide « Fiche de personnage : Accessoires et Ceinture »).
-- - Postures : posture_effet.inconvenient, pour les lignes du tableau de la fiche (version 'fiche') : 1 = un inconvénient, en rouge sur la fiche,
--   0 = un avantage, en vert (décision R47 : les lignes que le propriétaire a encadrées en rouge sur une capture de la fiche) ; NULL pour les versions du guide.
-- Les tables des fiches restent vides dans data/rows (les fiches réelles vivent dans la base vivante du service, qui reçoit les nouvelles colonnes vides) ;
-- seules les lignes de posture_effet changent.

ALTER TABLE personnage ADD COLUMN portrait TEXT CHECK (portrait IS NULL OR (portrait GLOB 'data:image/*' AND length(portrait) <= 700000));
ALTER TABLE personnage ADD COLUMN portrait_x REAL CHECK (portrait_x IS NULL OR portrait_x BETWEEN 0 AND 1);
ALTER TABLE personnage ADD COLUMN portrait_y REAL CHECK (portrait_y IS NULL OR portrait_y BETWEEN 0 AND 1);
ALTER TABLE personnage ADD COLUMN portrait_zoom REAL CHECK (portrait_zoom IS NULL OR portrait_zoom BETWEEN 1 AND 4);

CREATE TABLE personnage_ceinture (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),
  quantite       INTEGER NOT NULL CHECK (quantite >= 1),
  ressource_id   TEXT    REFERENCES ressource(id),
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

ALTER TABLE posture_effet ADD COLUMN inconvenient INTEGER CHECK (inconvenient IS NULL OR inconvenient IN (0, 1));
UPDATE posture_effet SET inconvenient = 0 WHERE version = 'fiche';
-- Offensif : « Malus de 10% pour toucher une cible », « Esquive/Parade impossible » ; Défensif : « Divise par 2 les dégâts infligés (division AVANT
-- l'armure) » ; Neutre : « 2 esquives/parades par tour » ; Focus : « Esquive/Parade impossible » ; Vigilance : « 1 seule parade/esquive par tour » ;
-- Symbiose : « Impossible d'utiliser les armes ou objets », « 1 seule parade/esquive par tour », « Une seule magie active »
UPDATE posture_effet SET inconvenient = 1 WHERE version = 'fiche' AND (
     (posture_id = 'guide/postures#posture:offensif' AND rang IN (3, 4))
  OR (posture_id = 'guide/postures#posture:defensif' AND rang = 6)
  OR (posture_id = 'guide/postures#posture:neutre' AND rang = 2)
  OR (posture_id = 'guide/postures#posture:focus' AND rang = 4)
  OR (posture_id = 'guide/postures#posture:vigilance' AND rang = 6)
  OR (posture_id = 'guide/postures#posture:symbiose' AND rang IN (4, 5, 6)));

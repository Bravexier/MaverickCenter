-- 0130-types-des-attaques-de-monstre : le type de dégâts des attaques des cartes de monstre, lié au glossaire (décisions R288, R295, R298, R299,
-- R300, R301 du 2026-11-17 et du 2026-11-18). Migration de STRUCTURE seule : elle n'insère aucune ligne. Les types des attaques et les onze lignes
-- nouvelles de type_degats viennent d'un lot de changements déposé sur le site de dev (R291), un type n'étant posé que si le texte copié du doc le
-- nomme (R295, R300).
--   1. type_degats reconstruite (SQLite ne change pas un CHECK) : onze id de plus, les types que les attaques écrivent hors de la liste (R298 :
--      « ajoutés à la liste des types de dégâts (`type_degats`), chacun lié à la magie du même nom ») ; le CHECK fixe désormais la magie de chaque
--      id élémentaire (les trois de 0125 et les onze), NULL pour les autres. Les huit lignes en place sont recopiées telles quelles.
--   2. monstre_attaque_type : zéro, un ou plusieurs types par attaque (monstre_attaque), dans l'ordre écrit (R299) ; clé étrangère vers type_degats,
--      sans cascade (la carte retire les types de ses attaques avant de les supprimer ou de les refaire).

CREATE TABLE type_degats_0130 (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (id IN ('taille', 'estoc', 'frappe', 'physique', 'sonore', 'feu', 'eau', 'glace',
                                                         'foudre', 'lumiere', 'arcane', 'sang', 'terre', 'ombre', 'corruption',
                                                         'espace-temps', 'vide', 'vent', 'necromancie')),
  mot_cle_id  INTEGER REFERENCES mot_cle(id),
  magie_id    TEXT    REFERENCES magie(id),
  CHECK (magie_id IS (CASE id
    WHEN 'feu'          THEN 'magies/magie-du-feu'
    WHEN 'eau'          THEN 'magies/magie-de-leau'
    WHEN 'glace'        THEN 'magies/magie-de-la-glace'
    WHEN 'foudre'       THEN 'magies/magie-de-la-foudre'
    WHEN 'lumiere'      THEN 'magies/magie-de-la-lumiere'
    WHEN 'arcane'       THEN 'magies/magie-de-larcane'
    WHEN 'sang'         THEN 'magies/magie-du-sang'
    WHEN 'terre'        THEN 'magies/magie-de-la-terre'
    WHEN 'ombre'        THEN 'magies/magie-de-lombre'
    WHEN 'corruption'   THEN 'magies/magie-de-la-corruption'
    WHEN 'espace-temps' THEN 'magies/magie-de-lespace-temps'
    WHEN 'vide'         THEN 'magies/magie-du-vide'
    WHEN 'vent'         THEN 'magies/magie-du-vent'
    WHEN 'necromancie'  THEN 'magies/magie-de-la-necromancie'
  END)),
  CHECK (magie_id IS NULL OR mot_cle_id IS NULL)
) STRICT;

INSERT INTO type_degats_0130 (id, mot_cle_id, magie_id) SELECT id, mot_cle_id, magie_id FROM type_degats;

DROP TABLE type_degats;
ALTER TABLE type_degats_0130 RENAME TO type_degats;

CREATE TABLE monstre_attaque_type (
  monstre_id   TEXT    NOT NULL,
  attaque_rang INTEGER NOT NULL,
  rang         INTEGER NOT NULL CHECK (rang >= 1),
  type         TEXT    NOT NULL REFERENCES type_degats(id),
  libelle      TEXT    NOT NULL CHECK (length(libelle) > 0),
  PRIMARY KEY (monstre_id, attaque_rang, rang),
  UNIQUE (monstre_id, attaque_rang, type),
  FOREIGN KEY (monstre_id, attaque_rang) REFERENCES monstre_attaque(monstre_id, rang)
) STRICT, WITHOUT ROWID;

-- 0125-types-de-degats-et-magies-en-mots-cles : les types de dégâts et les magies liés aux mots-clés du glossaire (lot « liens glossaire : types de
-- dégâts et magies », 2026-11-14). Demande du propriétaire : « J'aimerai que tu fasse une passe dans tous les champs de la base de donnée. Tout les
-- liens communs j'aimerai que tu les lie aux mots clés (ceux du glossaire) Par exemple, les armes et armures référencera leur type ou résistance
-- (taille, estoc et frappe) via ce mot clé. De même pour les magies. », puis « Si ils existent! ». Ses choix (transmis par le leader-technique) :
-- (1) une petite table de référence des types de dégâts, avec mot_cle_id en clé étrangère, et une colonne magie.mot_cle_id ; les données et le format
-- des tables qui portent ces valeurs ne changent pas ; (2) seuls les champs à valeur fermée, types de dégâts et magies ; (3) une magie s'affiche par
-- son nom court avec l'infobulle de son mot-clé ; (4) feu, eau, glace d'une attaque de créature se lient à la magie du même nom. Une valeur sans
-- mot-clé reste sans lien : aucun mot-clé créé, aucune définition écrite.
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
-- Les mots-clés sont cités par leur id entier, figé (leur clé et leur libellé changent sur le site de dev) :
--   Frappe 439, Taille 440, Estoc 441 (créés sur le site de dev, lots du 2026-11-14 rapatriés) ; les 15 mots-clés des magies (208 à 221 et 291,
--   verrouillés, chacun avec l'adresse de la page de sa magie). « physique » et « sonore » n'ont ni mot-clé ni synonyme dans le glossaire : NULL.
--   1. magie.mot_cle_id (ADD COLUMN nullable, en dernier, sans cascade) et son index unique partiel magie_mot_cle ; rempli pour les 15 magies.
--   2. type_degats : une ligne par valeur fermée des colonnes de type de dégâts ; mot_cle_id pour taille, estoc, frappe ; magie_id pour feu, eau,
--      glace (la magie de creature_attaque_type.magie_id) ; ni l'un ni l'autre pour physique et sonore.

ALTER TABLE magie ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);

CREATE UNIQUE INDEX magie_mot_cle ON magie (mot_cle_id) WHERE mot_cle_id IS NOT NULL;

UPDATE magie SET mot_cle_id = CASE id
  WHEN 'magies/magie-de-la-corruption'  THEN 208
  WHEN 'magies/magie-de-la-foudre'      THEN 209
  WHEN 'magies/magie-de-la-glace'       THEN 210
  WHEN 'magies/magie-de-la-lumiere'     THEN 211
  WHEN 'magies/magie-de-la-necromancie' THEN 212
  WHEN 'magies/magie-de-la-terre'       THEN 213
  WHEN 'magies/magie-de-larcane'        THEN 214
  WHEN 'magies/magie-de-leau'           THEN 215
  WHEN 'magies/magie-de-lespace-temps'  THEN 216
  WHEN 'magies/magie-de-lombre'         THEN 217
  WHEN 'magies/magie-du-feu'            THEN 218
  WHEN 'magies/magie-du-sang'           THEN 219
  WHEN 'magies/magie-du-vent'           THEN 220
  WHEN 'magies/magie-du-vide'           THEN 221
  WHEN 'magies/potentiel-illimite'      THEN 291
END;

CREATE TABLE type_degats (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (id IN ('taille', 'estoc', 'frappe', 'physique', 'sonore', 'feu', 'eau', 'glace')),
  mot_cle_id  INTEGER REFERENCES mot_cle(id),
  magie_id    TEXT    REFERENCES magie(id),
  CHECK ((id IN ('feu', 'eau', 'glace')) = (magie_id IS NOT NULL)),
  CHECK (magie_id IS NULL OR mot_cle_id IS NULL)
) STRICT;

INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES
  ('taille',   440,  NULL),
  ('estoc',    441,  NULL),
  ('frappe',   439,  NULL),
  ('physique', NULL, NULL),
  ('sonore',   NULL, NULL),
  ('feu',      NULL, 'magies/magie-du-feu'),
  ('eau',      NULL, 'magies/magie-de-leau'),
  ('glace',    NULL, 'magies/magie-de-la-glace');

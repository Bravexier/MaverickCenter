-- 0092-rang-des-races : l'ordre du menu latéral des races et de la liste /races/ devient une donnée de la base (lot de l'édition des menus : demande
-- du propriétaire « En mode Edition il faut prévoir de pouvoir changer l'ordre des menu latéraux (par un glisser déposer) », réponses « Menu + liste
-- /races/ » et « /races/ suit, le reste figé » : le nouvel ordre vaut pour le menu latéral, la liste /races/ et le tableau des magies innées en bas de
-- /races/ ; la fiche et /magies/ gardent l'ordre du code. race.ordre, l'ordre de l'onglet « Race », n'est pas touché).
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. race.rang_liste, ajoutée en dernière colonne, nullable (NULL : race pas encore rangée, en fin de liste, par nom ; choix du leader-technique) :
--      la table race, citée par huit clés étrangères, n'est pas reconstruite, et une race créée par un lot du journal en attente (sans cette colonne)
--      se rejoue telle quelle. Pas UNIQUE : un réordonnancement renumérote plusieurs races dans un même lot.
--   2. Valeurs : les 27 places de la constante du code (ORDRE_DES_RACES de client/src/lib/race-kinds.mjs, l'ordre du propriétaire : les races pures,
--      puis les hybrides), de 1 à 27. Une race absente de cette liste (créée sur le site de dev) reste à NULL.

ALTER TABLE race ADD COLUMN rang_liste INTEGER CHECK (rang_liste IS NULL OR rang_liste >= 1);

UPDATE race SET rang_liste = CASE id
  -- pures
  WHEN 'races/humain'         THEN 1
  WHEN 'races/nain'           THEN 2
  WHEN 'races/elfe-forestier' THEN 3
  WHEN 'races/elfe-dore'      THEN 4
  WHEN 'races/elfe-argente'   THEN 5
  WHEN 'races/elfe-noir'      THEN 6
  WHEN 'races/farfadet'       THEN 7
  WHEN 'races/felfe'          THEN 8
  WHEN 'races/majin'          THEN 9
  WHEN 'races/hujin'          THEN 10
  WHEN 'races/drakos'         THEN 11
  WHEN 'races/lamia'          THEN 12
  WHEN 'races/mort-vivant'    THEN 13
  -- hybrides
  WHEN 'races/drassahthac'    THEN 14
  WHEN 'races/orios'          THEN 15
  WHEN 'races/fenrir'         THEN 16
  WHEN 'races/kitsune'        THEN 17
  WHEN 'races/olwman'         THEN 18
  WHEN 'races/rokh'           THEN 19
  WHEN 'races/namazu'         THEN 20
  WHEN 'races/minotaure'      THEN 21
  WHEN 'races/satyre'         THEN 22
  WHEN 'races/medusain'       THEN 23
  WHEN 'races/jackalope'      THEN 24
  WHEN 'races/marcass'        THEN 25
  WHEN 'races/anansi'         THEN 26
  WHEN 'races/goleois'        THEN 27
END;

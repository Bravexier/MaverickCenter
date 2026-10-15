-- 0047-objets-a-la-ceinture : la page « Objets à la ceinture » (menu Ressources ; demande du propriétaire, 2026-10-15 : « […] l'ensemble de tous les
-- objets que les joueurs peuvent placer à la ceinture dans le but de pouvoir les utiliser comme un IC. De plus il faut parler aussi des bâtons magiques »).
-- Décision R81 : la page liste toutes les potions (fioles, philtres, remèdes, alchimie primitive), toutes les huiles, les carquois, sacs de bombes et
-- sacs de pierres (que le guide oblige à mettre à la ceinture pour être utilisés) et les bâtons magiques ; décision R82 : pas le bouclier (son
-- emplacement est dans l'armure). Une vue, v_objet_ceinture, dit quels objets du catalogue la page liste (la liste du guide reste « non exhaustive ») :
-- elle suit les tables (une potion, un contenant ou un bâton ajouté, renommé ou supprimé y entre, change ou en sort) ; aucune ligne de data/rows ne change.

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

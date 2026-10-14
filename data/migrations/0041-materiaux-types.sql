-- 0041-materiaux-types : le type des matériaux (décision R62 ; demande du propriétaire, 2026-10-14 : « Il revient donc même pour ces matériaux d'avoir
-- un type différent en se basant sur l'armure (inutile pour l'arme, cela dit). Les types seront "Léger, Intermédiaire, Lourd" et "autres" pour tout ce
-- qui ne rentre pas dans ces catégories. La table des matériaux de l'onglet Composants devient désormais la seule source de vérité »).
-- Migration de STRUCTURE et de DONNÉES :
--   * table materiau (section 9) : une ligne par ressource de genre 'materiau' ;
--   * son type : celui de sa fiche d'armure (materiau_armure.type : 21 matières) ; « Autres » pour un matériau qui n'en a pas (l'Os, de la page des armes).

CREATE TABLE materiau (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  type          TEXT    NOT NULL CHECK (type IN ('Léger', 'Intermédiaire', 'Lourd', 'Autres')),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

INSERT INTO materiau (ressource_id, type, origine, source_ref)
SELECT r.id, coalesce(a.type, 'Autres'), r.origine, coalesce(a.source_ref, 'Décision R62 du propriétaire (2026-10-14) : « autres » pour ce qui ne rentre pas dans ces catégories')
FROM ressource r LEFT JOIN materiau_armure a ON a.ressource_id = r.id
WHERE r.genre = 'materiau';

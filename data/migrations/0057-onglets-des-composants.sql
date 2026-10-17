-- 0057-onglets-des-composants : la page « Composants » (/ressources/composants/) passe en onglets, un par tableau, comme la page « Équipement » ; chaque
-- onglet est une ligne de la base dont le titre et la note se modifient sur le site de dev (demande du propriétaire du 2026-10-17 : « Dans les composants
-- Il faudrait à l'image de la page d'équipement avoir des onglets pour chaque table. Il faudrait aussi qu'elles soient modifiables et directement liées
-- en base »). Migration de STRUCTURE et de DONNÉES.
--   * Structure : composant_onglet (id : l'ancre de l'onglet et l'id de son panneau, qui désigne aussi son tableau ; titre ; note facultative ; ordre).
--   * Données : les 16 tableaux de la page, dans l'ordre où elle les montrait ; titres et notes COPIÉS de ceux qu'elle écrivait
--     (client/src/components/composants/ComposantsPage.astro). Les tableaux sans note étaient rangés sous un titre de groupe (« Ingrédients
--     d’alchimie », « Produits non monétaires », « Équipement ») que la barre d'onglets n'a plus : leur note (un texte neuf, modifiable et qui peut
--     être vidé sur le site de dev) dit ce que le tableau rassemble — leur catégorie d'ingrédient, leur section de l'onglet « Équipement inventaire »
--     (client/src/lib/corps-composants.mjs) —, rien de plus.
-- Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev.

CREATE TABLE composant_onglet (
  id     TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-'),
  titre  TEXT    NOT NULL CHECK (length(titre) > 0),
  note   TEXT    CHECK (note IS NULL OR length(note) > 0),
  ordre  INTEGER NOT NULL CHECK (ordre >= 1)
) STRICT;

INSERT INTO composant_onglet (id, titre, note, ordre) VALUES
  ('monnaie', 'Monnaie', 'Chaque monnaie vaut un nombre de Ricken de fer, l’unité (CONVERTISSEUR de l’onglet « Équipement inventaire »).', 1),
  ('materiaux', 'Matériaux',
    'La référence des matériaux : nom, type (d’après l’armure), prix et effets sur une arme se modifient ici, les pages des armes et des armures les reprennent. La fabrication est la recette qui donne la matière.', 2),
  ('gemmes', 'Gemmes précieuses', 'Une gemme par magie. Le prix de la gemme entière (bâton magique) et celui d’un quart de gemme (accessoires), par qualité.', 3),
  ('bois', 'Bois des bâtons magiques', 'Un bois par magie (onglet « Bâton magique »).', 4),
  ('fruits', 'Fruits', 'Les ingrédients de type « Fruit » de la liste d’ingrédients (doc « Alchimie »).', 5),
  ('ingredients-solvant', 'Solvant', 'Ingrédients d’alchimie de la catégorie Solvant ; les fruits sont dans l’onglet Fruits.', 6),
  ('ingredients-essence', 'Essence', 'Ingrédients d’alchimie de la catégorie Essence ; les fruits sont dans l’onglet Fruits.', 7),
  ('ingredients-amplificateur', 'Amplificateur',
    'Ingrédients d’alchimie de la catégorie Amplificateur ; les fruits sont dans l’onglet Fruits.', 8),
  ('ingredients-catalyseur', 'Catalyseur',
    'Ingrédients d’alchimie de la catégorie Catalyseur ; les fruits sont dans l’onglet Fruits.', 9),
  ('ingredients-stabilisateur', 'Stabilisateur',
    'Ingrédients d’alchimie de la catégorie Stabilisateur ; les fruits sont dans l’onglet Fruits.', 10),
  ('objets-vegetaux', 'Végétaux', 'Produits non monétaires de l’onglet « Équipement inventaire » (VÉGÉTAUX).', 11),
  ('objets-animaux', 'Animaux', 'Produits non monétaires de l’onglet « Équipement inventaire » (ANIMAUX).', 12),
  ('objets-autres', 'Autres', 'Produits non monétaires de l’onglet « Équipement inventaire » (AUTRES).', 13),
  ('objets-matos-aventures', 'Matos aventures', 'Matériel de l’onglet « Équipement inventaire » (MATOS AVENTURES).', 14),
  ('objets-matos-fabrication', 'Matos fabrication', 'Matériel de l’onglet « Équipement inventaire » (MATOS FABRICATION).', 15),
  ('objets-matos-projectile', 'Matos projectile', 'Matériel de l’onglet « Équipement inventaire » (MATOS PROJECTILE).', 16);

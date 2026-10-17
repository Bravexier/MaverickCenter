-- data/rows/composant_onglet.sql : export déterministe, une instruction par ligne, triée par (id). NE PAS ÉDITER À LA MAIN.
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('bois', 'Bois des bâtons magiques', 'Un bois par magie (onglet « Bâton magique »).', 4);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('fruits', 'Fruits', 'Les ingrédients de type « Fruit » de la liste d’ingrédients (doc « Alchimie »).', 5);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('gemmes', 'Gemmes précieuses', 'Une gemme par magie. Le prix de la gemme entière (bâton magique) et celui d’un quart de gemme (accessoires), par qualité.', 3);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('ingredients-amplificateur', 'Amplificateur', 'Ingrédients d’alchimie de la catégorie Amplificateur ; les fruits sont dans l’onglet Fruits.', 8);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('ingredients-catalyseur', 'Catalyseur', 'Ingrédients d’alchimie de la catégorie Catalyseur ; les fruits sont dans l’onglet Fruits.', 9);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('ingredients-essence', 'Essence', 'Ingrédients d’alchimie de la catégorie Essence ; les fruits sont dans l’onglet Fruits.', 7);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('ingredients-solvant', 'Solvant', 'Ingrédients d’alchimie de la catégorie Solvant ; les fruits sont dans l’onglet Fruits.', 6);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('ingredients-stabilisateur', 'Stabilisateur', 'Ingrédients d’alchimie de la catégorie Stabilisateur ; les fruits sont dans l’onglet Fruits.', 10);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('materiaux', 'Matériaux', 'La référence des matériaux : nom, type (d’après l’armure), prix et effets sur une arme se modifient ici, les pages des armes et des armures les reprennent. La fabrication est la recette qui donne la matière.', 2);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('monnaie', 'Monnaie', 'Chaque monnaie vaut un nombre de Ricken de fer, l’unité (CONVERTISSEUR de l’onglet « Équipement inventaire »).', 1);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-animaux', 'Animaux', 'Produits non monétaires de l’onglet « Équipement inventaire » (ANIMAUX).', 12);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-autres', 'Autres', 'Produits non monétaires de l’onglet « Équipement inventaire » (AUTRES).', 13);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-matos-aventures', 'Matos aventures', 'Matériel de l’onglet « Équipement inventaire » (MATOS AVENTURES).', 14);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-matos-fabrication', 'Matos fabrication', 'Matériel de l’onglet « Équipement inventaire » (MATOS FABRICATION).', 15);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-matos-projectile', 'Matos projectile', 'Matériel de l’onglet « Équipement inventaire » (MATOS PROJECTILE).', 16);
INSERT INTO composant_onglet (id, titre, note, ordre) VALUES ('objets-vegetaux', 'Végétaux', 'Produits non monétaires de l’onglet « Équipement inventaire » (VÉGÉTAUX).', 11);

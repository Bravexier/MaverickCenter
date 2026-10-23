-- 0050-inventaire-ceinture : réponses du propriétaire du 2026-10-15 sur l'inventaire et la ceinture de la fiche de personnage (décisions R88, R89).
-- - Inventaire (R88 : « Le nombre d'emplacement dans l'inventaire dépends de la force du personnage » ; « La Force donne la place ») : une colonne =
--   12 lignes, la grille de la fiche auto (AA40:AY51) ; le sac normal, « deux colonnes complètes », fait 24 emplacements à Force 1 ; les sacs du guide
--   donnent les emplacements des Forces suivantes (+4 à Force 2, +8 à Force 3, +12 à Force 4), et « tout l'inventaire », les 4 colonnes de la grille, à
--   partir de Force 5. Une ligne = un emplacement, quelle que soit sa quantité.
-- - Ceinture (R89 : « on ne peux avoir que 3 exemplaires maxi à la ceinture ») : au plus 3 exemplaires du même objet par emplacement (le guide : « Les
--   objets sont dans la ceinture ne peuvent pas dépasser le nombre de 3 »).
-- Des constantes de regle_constante, que la fiche lit (lib/fiche-regles.mjs) ; aucune table ne change.

INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('inventaire.colonnes_de_depart', 2, 'colonnes', 'texte',
   'Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sacs à dos.',
   'guide/fiche-inventaire-sac-a-dos', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Inventaire/Sac à dos',
   'Décision R88 : la Force donne la place, sans sac à choisir ; à Force 1, les deux colonnes du sac normal (24 emplacements).'),
  ('inventaire.lignes_par_colonne', 12, 'lignes', 'formule', 'AA40:AA51', NULL, 'fiche', 'Fiche auto V15.2.2 › Personnage › AA40:AY51',
   'Décision R88 : une colonne de l''inventaire = 12 lignes, comme la grille de la fiche auto (et du modèle ordinateur).'),
  ('inventaire.colonnes_max', 4, 'colonnes', 'formule', 'AA40:AY51', NULL, 'fiche', 'Fiche auto V15.2.2 › Personnage › AA40:AY51',
   'Décision R88 : « tout l''inventaire » = les 4 colonnes de la grille (AA, AG, AN, AT), 48 emplacements.'),
  ('inventaire.emplacements_force_2', 4, 'emplacements', 'texte',
   'Grand sac à dos, permet d’avoir 4 emplacements supplémentaires |Demande 2 de Force.',
   'guide/fiche-inventaire-sac-a-dos', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Inventaire/Sac à dos',
   'Décision R88 : à Force 2, les emplacements du sac normal + 4 (28).'),
  ('inventaire.emplacements_force_3', 8, 'emplacements', 'texte',
   'Super sac à dos, permet d’avoir 8 emplacements supplémentaires |Demande 3 de Force.',
   'guide/fiche-inventaire-sac-a-dos', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Inventaire/Sac à dos',
   'Décision R88 : à Force 3, les emplacements du sac normal + 8 (32).'),
  ('inventaire.emplacements_force_4', 12, 'emplacements', 'texte',
   'Méga sac à dos, permet d’avoir 12 emplacements supplémentaires |Demande 4 de Force.',
   'guide/fiche-inventaire-sac-a-dos', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Inventaire/Sac à dos',
   'Décision R88 : à Force 4, les emplacements du sac normal + 12 (36).'),
  ('inventaire.force_tout_l_inventaire', 5, 'points', 'texte',
   'Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.',
   'guide/fiche-inventaire-sac-a-dos', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Inventaire/Sac à dos',
   'Décision R88 : à partir de Force 5, tout l''inventaire (inventaire.colonnes_max colonnes, 48 emplacements).'),
  ('ceinture.exemplaires_par_emplacement', 3, 'exemplaires', 'texte',
   'Les objets sont dans la ceinture ne peuvent pas dépasser le nombre de 3 (impossible de cumuler les objets à l''infini)',
   'guide/fiche-accessoires-et-ceinture', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Ceinture',
   'Décision R89 : au plus 3 exemplaires du même objet par emplacement de la ceinture (4 avec un don qui l''écrit) ; le bâton magique compte 1 ; un carquois ou un sac compte ses projectiles, jusqu''à sa contenance.');

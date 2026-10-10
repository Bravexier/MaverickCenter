-- 0016-maitrise-arme : bornes de la maîtrise d'une famille d'armes, pour la fiche de personnage (/fiche/), lues dans la base comme ses autres règles.
-- Migration de DONNÉES (aucun changement de structure : seule la version du schéma monte). Deux constantes de regle_constante, citées mot pour mot :
--   * 'maitrise_arme.des_sans_maitrise' = 1 : sans maîtrise, 1 dé de dégâts, et chaque point de maîtrise en ajoute un (guide « Fiche de personnage :
--     Maîtrise d'arme et Armes », Google Doc « Créer sa fiche de personnage ») ;
--   * 'maitrise_arme.des_max' = 5 : la fiche auto V15.2.2 propose, pour chacune des 11 familles d'armes, la liste « 1d » à « 5d » (validation des cases
--     Personnage!AI2:AI7 et AN2:AN6), soit 4 points de maîtrise au plus. Le propriétaire : « on ne peut pas avoir 5 points de maîtrise d'Arme. C'est 4 le
--     max (donc 5 dés) ».
-- personnage_maitrise_arme.des garde le nombre de DÉS (sa CHECK : 1 à 5), comme la fiche auto ; la page proposait 1 à 5 POINTS et les y écrivait tels quels.

INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('maitrise_arme.des_max', 5, 'dés', 'formule', '1d, 2d, 3d, 4d, 5d', NULL, 'fiche', 'Fiche auto V15.2.2 › Personnage › AI2:AI7, AN2:AN6 (liste de validation)', NULL),
  ('maitrise_arme.des_sans_maitrise', 1, 'dés', 'texte', 'Aucune maîtrise d''arme = 1d de dégâts, 1 point de maîtrise = 2d de dégâts',
   'guide/fiche-maitrise-darme-et-armes', 'fiche', 'Google Doc « Créer sa fiche de personnage » › Maîtrise d''arme', NULL);

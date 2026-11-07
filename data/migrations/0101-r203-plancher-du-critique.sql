-- 0101-r203-plancher-du-critique : décision R203 du propriétaire (2026-11-07, réponse à Q97 : « 1 est le plus bas possible »), suite de R180 et
-- R182. Migration de DONNÉES seules (section 2 ; PRAGMA user_version 100 -> 101 ; dans data/schema.sql, seul le commentaire de
-- personnage_sort.prepare_critique change) ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   La plage de réussite critique ne descend jamais sous « 1 à 1 » : un accessoire maudit « Augmente la réussite critique de 1%, peu importe le
--   jet » donne −1 % (R54), et plusieurs ramenaient la plage sous 1. Le plancher devient une constante de règle, à côté de critique.base et
--   critique.plafond (R180, migration 0087), lue par le moteur (lib/fiche-moteur.mjs), jamais écrite dans son code : critique.plancher = 1, le N
--   minimal de « 1 à N ». Sa phrase (`texte`) est celle que la page des critiques écrit à côté du plafond (guide/reussites-echecs-et-critiques,
--   page des constantes critique.base et critique.plafond depuis la migration 0091).
--   Le CHECK personnage_sort_prepare_critique_bornes (de 1 à 15) ne change pas : sa borne basse est ce plancher.
-- La garde : une ligne déjà présente sous cet id arrête la migration (clé primaire).

INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('critique.plancher', 1, '%', 'texte', 'ne descend jamais sous 1 à 1', 'guide/reussites-echecs-et-critiques', 'fiche', 'Décision R203 du propriétaire',
   'Plage minimale de la réussite critique (« 1 à N », N au moins 1), toutes sources ensemble : le bonus total est ramené pour que la plage garde au moins 1, même quand des accessoires maudits (−1 % chacun, R54) la feraient descendre plus bas.');

-- 0102-r204-description-de-calme : décision R204 du propriétaire (2026-11-07, réponse à B13 : « Prouesse est l'ancien nom de Calme. Il doit être
-- remplacer par Calme »), suite de R4. Migration de DONNÉES seules (section 2 ; PRAGMA user_version 101 -> 102 ; dans data/schema.sql, seul le
-- commentaire de competence.description change) ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   La page « Compétences » du guide décrit « *Prouesse (Volonté) :* Faire preuve de sang-froid dans les situations dangereuses. » ; Prouesse étant
--   l'ancien nom de Calme, cette phrase est la description de Calme, la seule des 30 compétences qui n'en avait pas (NULL). Elle est recopiée telle
--   que le guide l'écrit, italiques retirés, comme les 29 autres. La trace ecart_source « competence:calme:nom:… » (provenance, retirée à la 1.0)
--   reste ; « Prouesse » remplacé par « Calme » dans la page du guide passe par la migration 0104 (registre 0104-r198-r208-textes-du-guide.json,
--   R204), pas par cette migration.
-- La garde : seule une description encore vide est écrite (une migration rejouée ne change rien).

UPDATE competence SET description = 'Faire preuve de sang-froid dans les situations dangereuses.'
WHERE id = 'calme' AND description IS NULL;

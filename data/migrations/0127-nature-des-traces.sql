-- 0127-nature-des-traces : chaque trace du journal et de l'historique porte sa nature (chantier « la base du site de dev devient la source de vérité »,
-- R274, R275 ; docs/chantier-base-de-dev.md, lot 6 et garde-fou 11) : « Le journal et l'historique gagnent une colonne « nature » : saisie, source,
-- décision (avec son numéro), migration, code. »
-- Migration de STRUCTURE seule (sections 14 et 15 ; PRAGMA user_version 126 -> 127) ; rien ne va dans historique_modification.
--   1. nature (ADD COLUMN, en dernier, NOT NULL DEFAULT 'saisie') : 'saisie' = fait sur le site de dev ; 'source' = réimport d'une source ;
--      'decision' = application d'une décision du propriétaire ; 'migration' = changement de données du dépôt ; 'code' = recalcul après un changement
--      de code. Les lignes existantes prennent 'saisie' : ce sont toutes des saisies du site de dev (modification_lot est vide dans data/rows ; la base
--      vivante, reconstruite et non migrée, recopie ses lots sans la colonne, qui prend la même valeur par défaut).
--   2. decision (ADD COLUMN nullable, en dernier) : le numéro de la décision (« R275 » : « R » suivi de chiffres), présent si et seulement si
--      nature = 'decision'. La contrainte porte sur deux colonnes ; elle s'écrit sur la colonne, comme celles de modification_lot.resolu_par et
--      .resolution (un ADD COLUMN ne peut pas ajouter de CHECK de table ; SQLite contrôle la contrainte sur les lignes existantes).
-- historique_modification reprend les deux colonnes de son lot (même forme, mêmes contraintes ; sans clé étrangère, comme lot_id).

ALTER TABLE modification_lot ADD COLUMN nature TEXT NOT NULL DEFAULT 'saisie' CHECK (nature IN ('saisie', 'source', 'decision', 'migration', 'code'));
ALTER TABLE modification_lot ADD COLUMN decision TEXT CHECK ((nature = 'decision') = (decision IS NOT NULL) AND (decision IS NULL OR (decision GLOB 'R[0-9]*' AND decision NOT GLOB 'R*[^0-9]*')));

ALTER TABLE historique_modification ADD COLUMN nature TEXT NOT NULL DEFAULT 'saisie' CHECK (nature IN ('saisie', 'source', 'decision', 'migration', 'code'));
ALTER TABLE historique_modification ADD COLUMN decision TEXT CHECK ((nature = 'decision') = (decision IS NOT NULL) AND (decision IS NULL OR (decision GLOB 'R[0-9]*' AND decision NOT GLOB 'R*[^0-9]*')));

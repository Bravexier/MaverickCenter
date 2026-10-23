-- 0072-resolution-des-conflits : un lot du journal de l'édition en conflit se résout sur /mise-a-jour/ (site de dev seulement). Demande du propriétaire
-- du 2026-10-22 : « Après les listes de modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le
-- choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les deux. » Migration de STRUCTURE seule, additive (docs/sql/conception.md §10.1).
--   * modification_lot reçoit trois colonnes, NULL par défaut, en dernier :
--     - resolu_le : l'instant de la résolution (ISO 8601 UTC à la seconde, même forme que fait_le) ; NULL = pas résolu ;
--     - resolu_par : le lot normal du journal que le service écrit pour reprendre celui-ci (opérations saines, choix 1 et 3) ; NULL si le lot n'est
--       pas résolu, ou si tous les choix ont abandonné (rien à écrire) ; jamais le lot lui-même, et jamais sans resolu_le ;
--     - resolution : les choix faits, tableau JSON [{"rang": n, "colonne": "corps_md" | null, "choix": 1 | 2 | 3}], présent si et seulement si
--       resolu_le l'est ; la valeur saisie au choix 3 est dans le nouveau lot, pas ici.
--   * Ni table, ni état, ni CHECK nouveaux sur `modification` : les lignes d'un lot résolu restent 'conflit' avec leur detail, comme trace ; l'ancien
--     lot n'est jamais effacé.
--   * Pas d'index : petite table, lue par id (la clé étrangère vers elle-même ne sert qu'au contrôle ; les lots ne se suppriment qu'en entier, par la
--     livraison et le rapatriement).
-- Données : data/rows/modification_lot.sql est vide (section 14) : rien à convertir. La base vivante du site de dev n'est pas migrée mais refaite
-- (client/serveur/base-vivante.mjs#transferer) : les colonnes communes sont recopiées, les nouvelles valent NULL, et tout lot en conflit existant
-- devient « à résoudre ».

ALTER TABLE modification_lot ADD COLUMN resolu_le TEXT CHECK (resolu_le IS NULL OR resolu_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z');
ALTER TABLE modification_lot ADD COLUMN resolu_par TEXT REFERENCES modification_lot(id) CHECK (resolu_par IS NULL OR (resolu_le IS NOT NULL AND resolu_par <> id));
ALTER TABLE modification_lot ADD COLUMN resolution TEXT CHECK ((resolution IS NULL) = (resolu_le IS NULL) AND (resolution IS NULL OR (json_valid(resolution) AND json_type(resolution) = 'array')));

-- 0051-resistance-arcane-corruption : l'Arcane et la Corruption se résistent l'une à l'autre (décision R90 du propriétaire, 2026-10-16 : « Arcane
-- résiste de base à la corruption et corruption résite à l'arcane. »), comme le disent leurs listes dans « Magie Maverick V8 » (magie_resistance) ;
-- ni l'une ni l'autre ne résiste à elle-même, comme le voulait la matrice de la fiche auto (Magie!F2:S16), dont les règles sont ignorées (R87).
-- Migration de STRUCTURE et de DONNÉES. Aucune valeur lue par le site ne change : pages de magie, guide, fiche (resistancesDe) et combinaisons
-- (v_resistance_combinaison, R85) lisaient déjà magie_resistance.
--   * Structure : la table resistance_magie (la matrice de la fiche, 14 x 14, 210 lignes), gardée comme seconde lecture tant que la question était
--     ouverte et lue par aucune page, est retirée (son index avec elle), ainsi que les deux vues qui la comparaient aux listes de V8
--     (v_resistance_magie_lectures, v_resistance_ecart).
--   * Données : ses 5 écarts (ecart_source, entite_table = 'resistance_magie' : Arcane et Corruption face à elles-mêmes et à l'autre) partent avec
--     elle. Elle n'a jamais été modifiée par le site de dev (historique_modification) et n'a pas de note de cellule.

DELETE FROM ecart_source WHERE entite_table = 'resistance_magie';

DROP VIEW v_resistance_ecart;
DROP VIEW v_resistance_magie_lectures;
DROP TABLE resistance_magie;

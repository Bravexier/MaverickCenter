-- 0049-resistances-des-combinaisons : les résistances et faiblesses d'une combinaison de deux magies (bi-magie) ne sont plus recopiées de l'onglet
-- « Statistiques » de « Magie Maverick V8 » mais calculées depuis les listes de chaque magie (décisions du propriétaire du 2026-10-15, relevé
-- docs/sql/rapprochement-classeurs.md) :
--   R85 : « Le feu résiste à la terre. Donc normal que Feu + Nécro resitent. Les résistance/ faiblesses des deux magies se cumulent (ou s'annulent si
--         opposées) » ; « La table était limitée à 4 magies par ligne.. Il en faut une liste. » ;
--   R86 : « tu peux ignorer l'onglet "Statistiques" c'est des données mise à la main il y a longtemps. »
-- Migration de STRUCTURE et de DONNÉES.
--   * Structure : les tables resistance_duo (73 couples) et resistance_combinaison (431 lignes), tirées du tableau « Résistance Faiblesse » de l'onglet
--     et lues par aucune page, sont retirées (leurs index avec elles) ; la vue v_resistance_combinaison les remplace (data/schema.sql, section 12) : les
--     crans des deux magies (magie_resistance, cibles de type magie) s'additionnent, une ligne par couple non ordonné (magie_a_id : la première des deux
--     dans l'ordre des onglets, magie.ordre) et par magie cible dont la somme n'est pas nulle. Calculées ainsi, les 73 combinaisons du tableau sont
--     exactes, sauf Nécromancie + Feu, à qui manquait « Terre » (Statistiques!AN265) : la vue lui donne 5 résistances (Sang, Nécromancie, Feu, Terre,
--     Foudre), une grande vulnérabilité (Eau) et une vulnérabilité (Vent).
--   * Données : ce qui ne vivait que pour ces tables part avec elles : les 11 écarts (ecart_source) qui comparaient le tableau à la matrice de la fiche ;
--     la page « Statistiques : Résistance Faiblesse » (guide/statistiques-resistance-faiblesse), qui recopiait ce tableau et n'est plus produite par
--     l'importeur (tools/sheets/annexes-magie.py ne lit plus l'onglet), avec ses mots-clés, ses sources et la source « onglet « Statistiques » » que
--     plus aucune page ne cite ; la famille « annexes » ne cite plus l'onglet parmi ses sources. Aucune page ne mène à la page retirée ; ni elle ni ces
--     tables n'ont été modifiées par le site de dev (historique_modification).

DELETE FROM ecart_source WHERE entite_table IN ('resistance_duo', 'resistance_combinaison');

DROP TABLE resistance_combinaison;
DROP TABLE resistance_duo;

DELETE FROM page_tag WHERE page_id = 'guide/statistiques-resistance-faiblesse';
DELETE FROM page_source WHERE page_id = 'guide/statistiques-resistance-faiblesse';
DELETE FROM page WHERE id = 'guide/statistiques-resistance-faiblesse';
DELETE FROM source
WHERE id = 'ref:google-sheet-magie-maverick-v8-onglet-statistiques'
  AND NOT EXISTS (SELECT 1 FROM page_source p WHERE p.source_id = source.id);

UPDATE famille SET sources = 'Magie Maverick V8 (Altération détats, Météo, Mode Hyper (Magie)) ; Mode hyper et co'
WHERE id = 'annexes' AND sources = 'Magie Maverick V8 (Altération détats, Météo, Statistiques, Mode Hyper (Magie)) ; Mode hyper et co';

CREATE VIEW v_resistance_combinaison AS
WITH cran AS (
  SELECT magie_id, cible_magie_id, CASE sens WHEN 'resistance' THEN 1 ELSE -1 END AS valeur
  FROM magie_resistance
  WHERE cible_type = 'magie'
),
somme AS (
  SELECT a.id AS magie_a_id, b.id AS magie_b_id, c.cible_magie_id, SUM(c.valeur) AS valeur
  FROM magie a
  JOIN magie b ON b.ordre > a.ordre
  JOIN cran c ON c.magie_id = a.id OR c.magie_id = b.id
  GROUP BY a.id, b.id, c.cible_magie_id
)
SELECT magie_a_id, magie_b_id, cible_magie_id, valeur,
       CASE valeur WHEN 2 THEN 'grande_resistance' WHEN 1 THEN 'resistance'
                   WHEN -1 THEN 'vulnerabilite' WHEN -2 THEN 'grande_vulnerabilite' END AS palier_id
FROM somme
WHERE valeur <> 0;

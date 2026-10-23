-- 0072-r148-multiplicateurs-des-paliers-de-resistance : décision R148 du propriétaire du 2026-10-22 (question Q6 rouverte, docs/decisions-regles.md),
-- qui remplace R70 : « Il faut corriger les multiplicateurs. Grande résistance : divisé par 3 (pas 4) Grande faiblesse : multiplier par 3 (pas 4)
-- Sensibilité : multiplier par 4 (pas 8) ». Migration de DONNÉES seules (resistance_palier, section 4).
--   * 'grande_resistance' : multiplicateur 0.25 -> 1/3, effet_brut « dégâts subis ÷4 » -> « dégâts subis ÷3 » ;
--   * 'grande_vulnerabilite' (« Grande faiblesse » de la demande, libellé « Grande vulnérabilité » inchangé) : 4 -> 3, « x4 » -> « x3 » ;
--   * 'sensibilite' : 8 -> 4, « x8 » -> « x4 ».
-- Immunité (=0), Résistance (÷2) et Vulnérabilité (x2) ne changent pas, ni les identifiants, libellés, bornes et ordre ; source_ref n'est pas touché
-- (la provenance sera retirée à la 1.0). 1/3 est écrit 1.0 / 3 : le double le plus proche, que data/rows recopie sans perte (repr) ; le moteur de la
-- fiche divise par 3 plutôt que de multiplier par ce double (lib/fiche-moteur.mjs#degatsRecus : arrondi à l'inférieur du quotient exact, R98).
-- Chaque UPDATE est gardé par la valeur d'avant, et la garde refuse la migration si l'un ne change pas exactement une ligne. Les cartes du
-- bestiaire (monstre_rubrique : « Grande(s) Résistance(s) Dégâts ÷4 »…) suivent la même décision par la migration 0073. Rien ne va dans
-- historique_modification (la migration n'est pas une modification du site de dev ; resistance_palier est en lecture seule dans l'édition).

CREATE TEMP TABLE garde_0072 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL CHECK (lignes = 1));

UPDATE resistance_palier SET multiplicateur = 1.0 / 3, effet_brut = 'dégâts subis ÷3'
WHERE id = 'grande_resistance' AND multiplicateur = 0.25 AND effet_brut = 'dégâts subis ÷4';
INSERT INTO garde_0072 VALUES ('grande_resistance', changes());

UPDATE resistance_palier SET multiplicateur = 3.0, effet_brut = 'dégâts subis x3'
WHERE id = 'grande_vulnerabilite' AND multiplicateur = 4.0 AND effet_brut = 'dégâts subis x4';
INSERT INTO garde_0072 VALUES ('grande_vulnerabilite', changes());

UPDATE resistance_palier SET multiplicateur = 4.0, effet_brut = 'dégâts subis x4'
WHERE id = 'sensibilite' AND multiplicateur = 8.0 AND effet_brut = 'dégâts subis x8';
INSERT INTO garde_0072 VALUES ('sensibilite', changes());

DROP TABLE garde_0072;

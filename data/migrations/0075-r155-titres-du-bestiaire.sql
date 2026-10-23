-- 0075-r155-titres-du-bestiaire : décision R155 du propriétaire (docs/decisions-regles.md), étendue au bestiaire le 2026-10-22.
-- Question : « 47 cartes du bestiaire ont des titres repris tels quels du document du bestiaire : « Grande Résistance Dégâts ÷4 », « Double Résistance
-- Dégâts/Effets ÷4 », « Grande Vulnérabilité Dégâts x4 » ; trois écrivent déjà « x3 ». Faut-il les passer à ÷3 / x3, ou les laisser comme le document
-- les écrit ? » Réponse : « Oui là aussi c'est x3 et pas 4... ». Puis : « 1. « Double Résistance … ÷4 » (10 cartes) : faut-il le laisser à ÷4 ou le
-- passer à ÷3 ? 2. « Sensibilité Dégâts x8 » dans le texte des compétences des golems de verre I–III : faut-il la passer à x4 ? » Réponses : « 1. Pareil
-- remplace double résistance par Grande résistance » / « 2. Oui x4 aussi ». Migration de DONNÉES seules (section 8 bis) :
--   * monstre_rubrique 'grande_resistance', `titre` : « … Dégâts ÷4 » -> « … Dégâts ÷3 » (15 : 9 « Grande(s) Résistance(s) », 6 « Grande(s) résistance(s) ») ;
--   * monstre_rubrique 'grande_vulnerabilite', `titre` : « … Dégâts x4 » -> « … Dégâts x3 » (22 : 10 « Grande(s) Vulnérabilité(s) », 6 « Grande(s)
--     faiblesse(s) », 3 « Grande(s )Vulnérabilité(s) », 3 « Grande(s) vulnérabilité(s) ») ; les 3 titres déjà en « x3 » ne changent pas ;
--   * monstre_rubrique 'double_resistance' -> 'grande_resistance' (10 : Collecteur, Irapullum, Ogre, trois cartes chacun, et Masse empoisonneuse ; aucune
--     n'a déjà de rubrique 'grande_resistance'), `titre` : « Double(s) » -> « Grande(s) », « ÷4 » -> « ÷3 », le reste tel quel (« Dégâts/Effets ») ;
--     leurs cibles typées suivent (monstre_defense.sens 'double_resistance' -> 'grande_resistance', 16 lignes, mêmes rangs et cibles : le sens d'une
--     ligne de monstre_defense est la rubrique qui la liste, lib/monstre-champs.mjs) ;
--   * golems de verre I à III, rubrique 'competences' (rang 6), `texte` : le seul fragment « Sensibilité(s) Dégâts x8 » -> « Sensibilité(s) Dégâts x4 ».
-- Seul le multiplicateur (et « Double » -> « Grande ») change : chaque graphie du doc (majuscules, « faiblesse », l'espace de « Grande(s )Vulnérabilité(s) »)
-- reste telle quelle ; ni `rang` ni `source_ref` ne sont touchés. Chaque UPDATE ne touche que sa rubrique et sa valeur exacte d'avant, et la garde refuse
-- la migration s'il ne change pas exactement le nombre de lignes attendu. Rien ne va dans historique_modification (la migration n'est pas une modification
-- du site de dev ; aucune de ces lignes n'y figure).

CREATE TEMP TABLE garde_0075 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL, CHECK (lignes = attendu));

UPDATE monstre_rubrique SET titre = 'Grande(s) Résistance(s) Dégâts ÷3'
WHERE rubrique = 'grande_resistance' AND titre = 'Grande(s) Résistance(s) Dégâts ÷4';
INSERT INTO garde_0075 VALUES ('Grande(s) Résistance(s)', changes(), 9);

UPDATE monstre_rubrique SET titre = 'Grande(s) résistance(s) Dégâts ÷3'
WHERE rubrique = 'grande_resistance' AND titre = 'Grande(s) résistance(s) Dégâts ÷4';
INSERT INTO garde_0075 VALUES ('Grande(s) résistance(s)', changes(), 6);

UPDATE monstre_rubrique SET titre = 'Grande(s) Vulnérabilité(s) Dégâts x3'
WHERE rubrique = 'grande_vulnerabilite' AND titre = 'Grande(s) Vulnérabilité(s) Dégâts x4';
INSERT INTO garde_0075 VALUES ('Grande(s) Vulnérabilité(s)', changes(), 10);

UPDATE monstre_rubrique SET titre = 'Grande(s) faiblesse(s) Dégâts x3'
WHERE rubrique = 'grande_vulnerabilite' AND titre = 'Grande(s) faiblesse(s) Dégâts x4';
INSERT INTO garde_0075 VALUES ('Grande(s) faiblesse(s)', changes(), 6);

UPDATE monstre_rubrique SET titre = 'Grande(s )Vulnérabilité(s) Dégâts x3'
WHERE rubrique = 'grande_vulnerabilite' AND titre = 'Grande(s )Vulnérabilité(s) Dégâts x4';
INSERT INTO garde_0075 VALUES ('Grande(s )Vulnérabilité(s)', changes(), 3);

UPDATE monstre_rubrique SET titre = 'Grande(s) vulnérabilité(s) Dégâts x3'
WHERE rubrique = 'grande_vulnerabilite' AND titre = 'Grande(s) vulnérabilité(s) Dégâts x4';
INSERT INTO garde_0075 VALUES ('Grande(s) vulnérabilité(s)', changes(), 3);

UPDATE monstre_rubrique SET rubrique = 'grande_resistance', titre = 'Grande(s) Résistance(s) Dégâts ÷3'
WHERE rubrique = 'double_resistance' AND titre = 'Double(s) Résistance(s) Dégâts ÷4';
INSERT INTO garde_0075 VALUES ('Double(s) Résistance(s) Dégâts', changes(), 4);

UPDATE monstre_rubrique SET rubrique = 'grande_resistance', titre = 'Grande(s) Résistance(s) Dégâts/Effets ÷3'
WHERE rubrique = 'double_resistance' AND titre = 'Double(s) Résistance(s) Dégâts/Effets ÷4';
INSERT INTO garde_0075 VALUES ('Double(s) Résistance(s) Dégâts/Effets', changes(), 6);

UPDATE monstre_defense SET sens = 'grande_resistance'
WHERE sens = 'double_resistance';
INSERT INTO garde_0075 VALUES ('monstre_defense double_resistance', changes(), 16);

UPDATE monstre_rubrique SET texte = replace(texte, 'Sensibilité(s) Dégâts x8', 'Sensibilité(s) Dégâts x4')
WHERE monstre_id IN ('monstres/golem-de-verre#carte:golem-de-verre-i', 'monstres/golem-de-verre#carte:golem-de-verre-ii',
                     'monstres/golem-de-verre#carte:golem-de-verre-iii')
  AND rang = 6 AND rubrique = 'competences' AND instr(texte, 'Sensibilité(s) Dégâts x8') > 0;
INSERT INTO garde_0075 VALUES ('golems de verre x8', changes(), 3);

-- Plus aucun titre de résistance n'écrit l'ancien multiplicateur, plus aucune rubrique ni cible 'double_resistance', plus aucun « Dégâts x8 »
-- (une graphie oubliée refuse la migration).
INSERT INTO garde_0075 SELECT 'reste ÷4 / x4', count(*), 0 FROM monstre_rubrique
WHERE (rubrique = 'grande_resistance' AND titre LIKE '%÷4%') OR (rubrique = 'grande_vulnerabilite' AND titre LIKE '%x4%');
INSERT INTO garde_0075 SELECT 'reste double_resistance', (SELECT count(*) FROM monstre_rubrique WHERE rubrique = 'double_resistance')
  + (SELECT count(*) FROM monstre_defense WHERE sens = 'double_resistance'), 0;
INSERT INTO garde_0075 SELECT 'reste Dégâts x8', count(*), 0 FROM monstre_rubrique WHERE instr(texte, 'Dégâts x8') > 0 OR instr(titre, 'Dégâts x8') > 0;

DROP TABLE garde_0075;

-- data/rows/creature_effet.sql : export déterministe, une instruction par ligne, triée par (creature_id, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO creature_effet (creature_id, rang, libelle, nom, sort_id, texte, origine, source_ref) VALUES ('bestiaire/bete-de-lombre', 1, 'Effet "Manteau noir"', 'Manteau noir', 'magies/magie-de-lombre#sort:manteau-noir', '- +10 dégâts
- +1 Vitesse
- Récupère 10% de santé la nuit ou dans l''ombre
- Les attaques ignorent 3AP ou 3AM
- Confusion 1 sur le lanceur
- Folie de guerre sur le lanceur', 'bestiaire', 'Invocation › Marionette de lombre › S128:X128; S129:X135');
INSERT INTO creature_effet (creature_id, rang, libelle, nom, sort_id, texte, origine, source_ref) VALUES ('bestiaire/double-sombre', 1, 'Effet "Manteau noir"', 'Manteau noir', 'magies/magie-de-lombre#sort:manteau-noir', '- +6 dégâts
- Donne un bonus de 1d4 d''attaques sournoises (même si le lanceur n''a pas les attaques sournoises)', 'bestiaire', 'Invocation › Marionette de lombre › S70:X70; S71:X77');
INSERT INTO creature_effet (creature_id, rang, libelle, nom, sort_id, texte, origine, source_ref) VALUES ('bestiaire/executeur-lunaire', 1, 'Effet "Manteau noir"', 'Manteau noir', 'magies/magie-de-lombre#sort:manteau-noir', '- +8 dégâts
- Tous les sorts de l''ombre volent 2d6 chakra', 'bestiaire', 'Invocation › Marionette de lombre › S99:X99; S100:X106');
INSERT INTO creature_effet (creature_id, rang, libelle, nom, sort_id, texte, origine, source_ref) VALUES ('bestiaire/ombre-rampante', 1, 'Effet "Manteau noir"', 'Manteau noir', 'magies/magie-de-lombre#sort:manteau-noir', '- +2 dégâts
- Chaque attaque qui touche va imposer un malus de 5% au prochain jet de la cible.', 'bestiaire', 'Invocation › Marionette de lombre › S12:X12; S13:X19');
INSERT INTO creature_effet (creature_id, rang, libelle, nom, sort_id, texte, origine, source_ref) VALUES ('bestiaire/sihouetteur-obscur', 1, 'Effet "Manteau noir"', 'Manteau noir', 'magies/magie-de-lombre#sort:manteau-noir', '- +4 dégâts
- Permet d''avoir un avantage quand il faut être discret', 'bestiaire', 'Invocation › Marionette de lombre › S41:X41; S42:X48');

-- data/rows/etat_stade.sql : export déterministe, une instruction par ligne, triée par (etat_id, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:aggripe', 1, NULL, 'Impossible de bouger.
Un jet d''Athlétisme/Équilibre est nécessaire pour sortir de l''entrave.', 'annexes', 'Magie Maverick V8 › Altération détats › M68:AP72');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:aveuglement', 1, 1, '-20% pour tout test qui demande de toucher une cible pendant 2 tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M3:V7');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:aveuglement', 2, 2, '-50% pour tout test qui demande de toucher une cible pendant 2 tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W3:AF7');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:aveuglement', 3, 3, '-100% pour tout test qui demande de toucher une cible pendant 2 tours.

Les dégâts de sorts qui sont liés à la vision ne font aucun dégât.', 'annexes', 'Magie Maverick V8 › Altération détats › AG3:AP7');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:brulure', 1, 1, 'Inflige 10% de la santé Max 
pendant 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M8:V12');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:brulure', 2, 2, 'Inflige 10% de la santé Max
pendant 4 Tours', 'annexes', 'Magie Maverick V8 › Altération détats › W8:AF12');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:brulure', 3, 3, 'Inflige 10% de la santé Max
pendant 5 Tours.
Les dégâts des attaques physiques
de la victime sont divisés par 2', 'annexes', 'Magie Maverick V8 › Altération détats › AG8:AP12');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:coma', 1, 1, 'Le personnage est inconscient et doit faire 3 jets de survie s''il ne veut pas mourir.
Une réussite et le personnage est stabilisé, 3 échecs et c''est la MORT !', 'annexes', 'Magie Maverick V8 › Altération détats › M73:V77');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:coma', 2, 2, 'Si le personnage a atteint son négatif maximal (le négatif égal à ses pv max) il n''aura qu''un SEUL et UNIQUE jet de survie. S''il est raté c''est la MORT !', 'annexes', 'Magie Maverick V8 › Altération détats › W73:AF77');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:coma', 3, 3, 'Si le personnage a atteint son double négatif maximal, il est MORT.', 'annexes', 'Magie Maverick V8 › Altération détats › AG73:AP77');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:confusion', 1, 1, 'Lance 1d100 pour voir le comportement 
01-70 : Agit normalement.
71-80 : Passe son Tour
81-90 : Se frappe tout seul.
91-100 : Attaque la cible la plus proche
(Allié comme ennemi) 
Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M13:V17');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:confusion', 2, 2, 'Lance 1d100 pour voir le comportement 
01-50 : Agit normalement.
51-60 : Passe son Tour
61-80 : Se frappe tout seul.
81-100 : Attaque la cible la plus proche
(Allié comme ennemi) 
Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W13:AF17');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:confusion', 3, 3, 'Lance 1d100 pour voir le comportement 
01-20 : Agit normalement.
21-40 : Passe son Tour
41-60 : Se frappe tout seul.
61-100 : Attaque la cible la plus proche
(Allié comme ennemi) 
Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › AG13:AP17');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:couardise', 1, NULL, 'Impossible d''attaquer une cible qui a plus de santé. Force un jet de fermeté ou de calme à chaque tentative d''attaque ou d''entrave directe sur l''adversaire.
Dure 4 tours.
(Les boss et mini boss ne peuvent pas l''infliger)', 'annexes', 'Magie Maverick V8 › Altération détats › M78:AP82');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:enchevetre', 1, NULL, 'Ne peut pas se déplacer et l''assaillant non plus.
Les attaques physiques ont les dégâts divisés par 2.', 'annexes', 'Magie Maverick V8 › Altération détats › M83:AP87');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:enrage', 1, 1, '- La victime a un bonus de +3 dégâts.
-Malus de 10% pour toucher.
-Attaque la cible vivante la plus proche (alliée comme ennemie).
-Jet de fermeté pour retirer l''effet.
-S''arrête au bout de 4 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M18:V22');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:enrage', 2, 2, '- La victime a un bonus de +6 dégâts.
-Malus de 15% pour toucher.
-Attaque la cible vivante la plus proche (alliée comme ennemie).
-Jet de fermeté pour retirer l''effet.
-S''arrête au bout de 4 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W18:AF22');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:enrage', 3, 3, '- La victime a un bonus de +10 dégâts.
-Malus de 20% pour toucher.
-Attaque la cible vivante la plus proche (alliée comme ennemie).
-Jet de fermeté pour retirer l''effet.
-S''arrête au bout de 4 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › AG18:AP22');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:etourdi', 1, NULL, 'Impossible de faire le déplacement ET l''action dans le même tour. Les IC deviennent des actions.', 'annexes', 'Magie Maverick V8 › Altération détats › M88:AP92');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:fatigue', 1, 1, '-Impossible de Sprint.
- Malus de 5 à tous les dégâts.

Dure jusqu''au prochain Repos.', 'annexes', 'Magie Maverick V8 › Altération détats › M23:V27');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:fatigue', 2, 2, '-Impossible de Sprint.
- Croix en Force et en Agilité.
- Malus de 10 à tous les dégâts.

Dure jusqu''au prochain Repos.', 'annexes', 'Magie Maverick V8 › Altération détats › W23:AF27');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:fatigue', 3, 3, '-Impossible de Sprint.
- Croix à toutes les Caractéristiques.
- Malus de 15 à tous les dégâts.

Dure jusqu''au prochain Repos.', 'annexes', 'Magie Maverick V8 › Altération détats › AG23:AP27');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:folle-de-guerre', 1, NULL, '- Impossible d''attendre, doit avancer vers l''ennemi.
- Insensible à tout contrôle mental ou à la peur.', 'annexes', 'Magie Maverick V8 › Altération détats › M93:AP97');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:gel', 1, 1, '- Vitesse -1
-Inflige 5% de la santé max.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M28:V32');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:gel', 2, 2, '-Vitesse -1.
- Inflige 10% de la santé Max.
- Les dégâts des attaques magiques de la cible sont divisés par 2.
Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W28:AF32');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:gel', 3, 3, '-Vitesse -1.
- Inflige 15% de la santé Max.
- Les dégâts des attaques magiques de la cible sont divisés par 2.
Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › AG28:AP32');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:paralysie', 1, 1, '- Un jet de Vigueur est nécessaire
pour ne pas perdre 1 Tour.

Dure 2 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M33:V37');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:paralysie', 2, 2, '- Un jet de Vigueur est nécessaire
pour ne pas perdre 1 Tour.
- Vitesse divisée par 2.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W33:AF37');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:paralysie', 3, 3, '- Un jet de Vigueur est nécessaire pour ne pas perdre 1 Tour.
-  Vitesse divisée par 2.
- Le résultat d''initiative sera toujours 01.
Dure 4 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › AG33:AP37');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:petrifie', 1, 1, '- Croix à l''Agilité
-Vitesse divisée par 2

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M43:V47');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:petrifie', 2, 2, '- Impossibilité de bouger
-Ne peut utiliser que des sorts.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W43:AF47');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:petrifie', 3, 3, '- Impossibilité de bouger  et 
d''attaquer.

- Dure 3 Tours', 'annexes', 'Magie Maverick V8 › Altération détats › AG43:AP47');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:peur', 1, 1, '- Malus de 10% à tous les jets
(hors jet de calme)

Dure tant qu''un jet de Calme n''a
pas été réussi.', 'annexes', 'Magie Maverick V8 › Altération détats › M38:V42');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:peur', 2, 2, '- Malus de 20% à tous les jets
(hors jet de calme)

Dure tant qu''un jet de Calme n''a
pas été réussi.', 'annexes', 'Magie Maverick V8 › Altération détats › W38:AF42');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:peur', 3, 3, '- Malus de 25% à tous les jets
(hors jet de calme)

Dure tant qu''un jet de Calme n''a
pas été réussi.', 'annexes', 'Magie Maverick V8 › Altération détats › AG38:AP42');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:poison', 1, 1, '- Inflige 10% de la santé Max.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M48:V52');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:poison', 2, 2, '- Inflige 15% de la santé Max.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W48:AF52');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:poison', 3, 3, '- Inflige 20% de la santé Max.

Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › AG48:AP52');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:saignement', 1, 1, '- Inflige 5% de la santé Max
jusqu''au prochain bandage
étanche.', 'annexes', 'Magie Maverick V8 › Altération détats › M53:V57');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:saignement', 2, 2, '- Inflige 10% de la santé Max
jusqu''au prochain bandage
étanche.', 'annexes', 'Magie Maverick V8 › Altération détats › W53:AF57');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:saignement', 3, 3, '- Inflige 10% de la santé Max
jusqu''au prochain bandage
étanche.
- Croix à la Volonté.', 'annexes', 'Magie Maverick V8 › Altération détats › AG53:AP57');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:sans-defense', 1, NULL, 'Impossible de se défendre et demande un tour complet pour le retirer.
Les coups portés sur lui seront automatiquement des coups critiques.', 'annexes', 'Magie Maverick V8 › Altération détats › M98:AP102');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surcharge-magique', 1, 1, '-  Consomme  5% de la Barrière Max 
et du Chakra Max (3 Tours)

- Armure magique divisée par 2.', 'annexes', 'Magie Maverick V8 › Altération détats › M58:V62');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surcharge-magique', 2, 2, '- Consomme 10% de la Barrière Max 
et du Chakra Max (3 Tours)

- Armure magique divisée par 3.', 'annexes', 'Magie Maverick V8 › Altération détats › W58:AF62');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surcharge-magique', 3, 3, '- Consomme 15% de la Barrière Max
et du Chakra Max (3 Tours)

- Armure Magique divisée par 4.', 'annexes', 'Magie Maverick V8 › Altération détats › AG58:AP62');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surdite', 1, 1, '- Malus de 15% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.
- Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › M63:V67');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surdite', 2, 2, '- Malus de 20% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.
- Dure 3 Tours.', 'annexes', 'Magie Maverick V8 › Altération détats › W63:AF67');
INSERT INTO etat_stade (etat_id, rang, stade, effet, origine, source_ref) VALUES ('guide/liste-des-alterations-d-etat#etat:surdite', 3, 3, '- Malus de 30% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.
- Dure 3 Tours.
Les dégâts sonores ne fonctionnent plus sur la victime', 'annexes', 'Magie Maverick V8 › Altération détats › AG63:AP67');

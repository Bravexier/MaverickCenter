-- data/rows/note_cellule.sql : export déterministe, une instruction par ligne, triée par (entite_table, entite_id, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('accessoire_effet', 'ressources/accessoires#effet:attaque:12', 1, NULL, 'BK66', NULL, NULL, 'Il existe une situation où le changement de posture n''est pas possible, c''est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n''est plus possible le reste du tour.', 'equipement', 'Ressources et Craft › Accessoires › BK66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('accessoire_effet', 'ressources/accessoires#effet:autre:19', 1, NULL, 'ED80', NULL, NULL, 'Agib est l''ambassadeur de la richesse et Murge son gardien. Ce sont des marchands qui ont beaucoup de marchandises.', 'equipement', 'Ressources et Craft › Accessoires › ED80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('accessoire_effet', 'ressources/accessoires#effet:defense:12', 1, NULL, 'CI66', NULL, NULL, 'L''insensibilité est un état où AUCUN sortilège (positif ou négatif) ne peut toucher le lanceur. Prendre un coup physique annule cet état.', 'equipement', 'Ressources et Craft › Accessoires › CI66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('arme', 'ressources/armes#arme:bombes:bombe-percante', 1, NULL, 'QA6', NULL, NULL, 'Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. Ce n''est pas considéré comme un Canon d''artifice.', 'equipement', 'Ressources et Craft › Armes › QA6');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('arme_elementaire', 'ressources/pieces-elementaires#arme-elementaire:arbalete:vent', 1, NULL, 'CI64', NULL, NULL, '*
Si le carreau touche à 2 - 4 portée = Surdité 1

Si le carreau touche à 5 - 7 portée = Surdité 2

Si le carreau touche à 8 - 10 portée = Surdité 3', 'equipement', 'Ressources et Craft › Pièces élémentaires › CI64');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('arme_elementaire', 'ressources/pieces-elementaires#arme-elementaire:epee:terre', 1, NULL, 'CW8', NULL, NULL, 'Métal : Plus solide, elle ne peut pas perdre de cran de solidité

Pierre : Ignore 5 AP

Plante : Ignore 50% des AP des boucliers', 'equipement', 'Ressources et Craft › Pièces élémentaires › CW8');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('arme_elementaire', 'ressources/pieces-elementaires#arme-elementaire:hache:sang', 1, NULL, 'X29', NULL, NULL, 'Bras = Perd son arme ou bouclier
Jambe = Ne peut plus bouger', 'equipement', 'Ressources et Craft › Pièces élémentaires › X29');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/anansi-coup-dpatte', 1, 'effet', NULL, NULL, NULL, 'Le coup de pattes n''est compté qu''une fois. Le bimane ne peut faire en sorte que la patte tape deux fois dans le même tour.', 'classes', 'Classe Maverick V7 › Anansi › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/anansi-magie-patte', 1, 'effet', NULL, NULL, NULL, 'Arcane = Le coup de patte peut prendre en compte l''AM plutôt que l''AP

Nécromancie = Oblige le jet de vigueur à la cible pour ne pas prendre "poison 1"

Ombre = Impose un malus de 10% au prochain jet de la victime', 'classes', 'Classe Maverick V7 › Anansi › A43:F48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/anansi-piege-toile', 1, 'effet', NULL, NULL, NULL, 'La cible peut réussir un jet d''athlétisme/réflexe pour s''ôter de la toile.', 'classes', 'Classe Maverick V7 › Anansi › P11:U16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/anansi-pt-fragile', 1, 'effet', NULL, NULL, NULL, '*Dans le cas de l''Arcane, ce sera aléatoire parmi les autres magies qui existent.', 'classes', 'Classe Maverick V7 › Anansi › AE36:AJ41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/arbaletrier-agressivement', 1, 'effet', NULL, NULL, NULL, 'L''arbalète doit être rechargée.', 'classes', 'Classe Maverick V7 › Arbalètrier › H43:M48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/arbaletrier-carreau-dacier', 1, 'effet', NULL, NULL, NULL, 'L''obstacle doit être assez fin, les mj seront libres de décider.', 'classes', 'Classe Maverick V7 › Arbalètrier › P49:U54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/arbaletrier-charger', 1, 'effet', NULL, NULL, NULL, 'Ne marche le premier tour de jeu', 'classes', 'Classe Maverick V7 › Arbalètrier › X36:AC41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/archer-tir-soudain', 1, 'effet', NULL, NULL, NULL, 'Les attaques d''opportunité s''enclenchent quand l''ennemi sort de la zone d''influence.', 'classes', 'Classe Maverick V7 › Archer › X36:AC41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/bimane-bien-sen-servir', 1, 'effet', NULL, NULL, NULL, 'Attention, ce coup a 30% de chance d''abîmer les armes', 'classes', 'Classe Maverick V7 › Bimane › H43:M48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/bimane-frappe-fatiguante', 1, 'effet', NULL, NULL, NULL, 'L''état de fatigue ne se cumule pas si le coup est répété sur la même cible.

Si jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c''est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)', 'classes', 'Classe Maverick V7 › Bimane › P11:U16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/bimane-poigne-du-titan', 1, 'effet', NULL, NULL, NULL, 'Vous ne pouvez pas avoir deux armes à deux mains dans chaque main.', 'classes', 'Classe Maverick V7 › Bimane › A43:F48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/cuirasse-defensif', 1, 'effet', NULL, NULL, NULL, 'Ne marche pas si l''ennemi contre-attaque.', 'classes', 'Classe Maverick V7 › Cuirassé › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/flagelleur-plus-fort', 1, 'effet', NULL, NULL, NULL, 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire', 'classes', 'Classe Maverick V7 › Flagelleur › AE29:AJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/flagelleur-puni-moi', 1, 'effet', NULL, NULL, NULL, 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire', 'classes', 'Classe Maverick V7 › Flagelleur › X29:AC34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/maclier-frisbee', 1, 'effet', NULL, NULL, NULL, 'Si un adversaire fait une parade parfaite. Le bouclier s''arrête dans sa course.', 'classes', 'Classe Maverick V7 › Maclier › X29:AC34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/maclier-miroir', 1, 'effet', NULL, NULL, NULL, 'Un jet de parade doit être réussi', 'classes', 'Classe Maverick V7 › Maclier › X43:AC48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/maclier-parfait', 1, 'effet', NULL, NULL, NULL, 'Un jet de parade parfait doit être réussi', 'classes', 'Classe Maverick V7 › Maclier › AE43:AJ48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-bleu-mimetisme', 1, 'effet', NULL, NULL, NULL, 'Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.

La posture focus transforme ce don en IC.', 'classes', 'Classe Maverick V7 › Mage Bleu › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-deux-fois-plus', 1, 'effet', NULL, NULL, NULL, 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Les deux sorts doivent être différents.', 'classes', 'Classe Maverick V7 › Mage › X43:AC48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-rouge-double-coup', 1, 'effet', NULL, NULL, NULL, 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'classes', 'Classe Maverick V7 › Mage Rouge › P49:U54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-rouge-preparation', 1, 'effet', NULL, NULL, NULL, 'Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.

La posture focus transforme ce don en IC.

Le sort en question ne se met pas sur l''arme mais bien dans la main.', 'classes', 'Classe Maverick V7 › Mage Rouge › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-soin-etrange', 1, 'effet', NULL, NULL, NULL, 'Il est capable de soigner aussi les morts vivants.
*Sort d''attaque basique lvl 1 :
- Boule de sang
- Boule de chakra
- Boule sombre
- Coup du sablier
- Bulle de vide
- Tir d''âme
- Boule de feu
- Bulle d''eau
- Éclat glacé
- Lance-pierre
- Lame d''air
- Éclair
- Frappe lumineuse
- Sphère obscure', 'classes', 'Classe Maverick V7 › Mage › X29:AC34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-soin-similaire', 1, 'effet', NULL, NULL, NULL, 'Si jamais le lanceur est un mort vivant et qu''il soigne via la magie de la lumière, il récupère quand même la santé qu''il soigne.', 'classes', 'Classe Maverick V7 › Mage › AE43:AJ48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-toujours-plus', 1, 'effet', NULL, NULL, NULL, 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Peut lancer deux sorts de soin ou/et d''amplification en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.					
Les deux sorts doivent être différents.', 'classes', 'Classe Maverick V7 › Mage › A43:F48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-vert-brutale', 1, 'effet', NULL, NULL, NULL, 'Les sorts "fer"', 'classes', 'Classe Maverick V7 › Mage Vert › H29:M34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-vert-chargement', 1, 'effet', NULL, NULL, NULL, 'Permet de charger un sort d''attaque lvl1 ou lvl2 le premier tour et de l''utiliser en même temps que l''attaque de distance le tour suivant.

Il est nécessaire que le sort possède la portée pour toucher la cible, si le projectile va plus loin, le sort ne marche pas.

La posture focus transforme ce don en IC.', 'classes', 'Classe Maverick V7 › Mage Vert › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/mage-vert-double-coup', 1, 'effet', NULL, NULL, NULL, 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'classes', 'Classe Maverick V7 › Mage Vert › P49:U54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-ca-va-plus-vite', 1, 'effet', NULL, NULL, NULL, 'Rouge', 'classes', 'Classe Maverick V7 › Marcass › AE29:AJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-catapulte', 1, 'effet', NULL, NULL, NULL, 'Doit y avoir de la place derrière et en haut pour le faire ! Sinon sprotch...

L''ami doit être assez léger.', 'classes', 'Classe Maverick V7 › Marcass › H29:M34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-cest-meilleur', 1, 'effet', NULL, NULL, NULL, 'Vert foncé', 'classes', 'Classe Maverick V7 › Marcass › AE43:AJ48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-cest-plus-dur', 1, 'effet', NULL, NULL, NULL, 'Brun', 'classes', 'Classe Maverick V7 › Marcass › AE36:AJ41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-lance-totem', 1, 'effet', NULL, NULL, NULL, 'Si une cible réussit un jet de défense parfait, l''attaque est stoppée', 'classes', 'Classe Maverick V7 › Marcass › H43:M48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/marcass-totemiste', 1, 'effet', NULL, NULL, NULL, 'Terre : Réduit les dégâts encaissés de 4.

Feu : Augmente les dégâts infligés de 4. 

Nécromancie : Économise 1 chakra à chaque sort lancé.', 'classes', 'Classe Maverick V7 › Marcass › X36:AC41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/martiale-heros', 1, 'effet', NULL, NULL, NULL, 'Il existe une situation où le changement de posture n''est pas possible, c''est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n''est plus possible le reste du tour.', 'classes', 'Classe Maverick V7 › Martiale › D22:J27');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/minotaure-gigantisme', 1, 'effet', NULL, NULL, NULL, 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permission d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'classes', 'Classe Maverick V7 › Minotaure › H29:M34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/ocultomancien-climatosceptique', 1, 'effet', NULL, NULL, NULL, 'Sauf la zone vide', 'classes', 'Classe Maverick V7 › Ocultomancien › AE36:AJ41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/ocultomancien-econome', 1, 'effet', NULL, NULL, NULL, 'un sort de puissance 1 coûte 1 Chakra de moins, un sort de puissance 4 coûte 4 Chakra de moins, etc', 'classes', 'Classe Maverick V7 › Ocultomancien › P4:U9');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/ocultomancien-pilonnage', 1, 'effet', NULL, NULL, NULL, 'Ne brise pas l''immunité de la posture symbiose et du mode hyper', 'classes', 'Classe Maverick V7 › Ocultomancien › A29:F34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/orios-gigantisme', 1, 'effet', NULL, NULL, NULL, 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permission d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'classes', 'Classe Maverick V7 › Orios › H29:M34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/parleur-negociateur', 1, 'effet', NULL, NULL, NULL, 'Marche seulement si bien sûr le combat est théoriquement arrêtable. Il est pas impossible que l''ennemi soit impossible à raisonner, dans ce cas soyez prudent et demandez si le combat est arrêtable.', 'classes', 'Classe Maverick V7 › Parleur › P49:U54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/pugiliste-coup-de-paume', 1, 'effet', NULL, NULL, NULL, 'Demande de réussir un jet d''attaque, l''ennemi peut parer ou esquiver.', 'classes', 'Classe Maverick V7 › Pugiliste › P49:U54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/tueur-sournefice', 1, 'effet', NULL, NULL, NULL, 'Si bien sûr la cible n''est pas immunisée. Les golems sont immunisés aux altérations d''états qui ne sont pas leur faiblesse', 'classes', 'Classe Maverick V7 › Tueur › AE43:AJ48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('capacite', 'capacites/voleur-faussaire', 1, 'effet', NULL, NULL, NULL, 'La falsification de document est un jet d''artisanat qui demande Social + Intelligence', 'classes', 'Classe Maverick V7 › Voleur › A36:F41');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('creature', 'bestiaire/golem-de-rouage', 1, 'degats', 'G127', 'note', NULL, 'L''arbalécho est une arme étrange dont les bonus de dégâts ne rentrent pas dans la multiplication et la posture offensive met au max seulement le deuxième dé.', 'bestiaire', 'Invocation › Appel aux golems › G127');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('maladie', 'ressources/maladie#maladie:tetanos', 1, NULL, 'H39', NULL, NULL, 'Se traduit par une croix en Force et Agilité et Social.', 'craft', 'Ressources et Craft › Maladie › H39');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('page', 'ressources/equipement-inventaire', 1, NULL, 'A1', NULL, NULL, 'L''insensibilité est un état où AUCUN sortilège (positif ou négatif) ne peut toucher le lanceur. Prendre un coup physique annule cet état.', 'equipement', 'Ressources et Craft › Équipement inventaire › A1');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('page', 'ressources/equipement-inventaire', 2, NULL, 'A1', NULL, NULL, 'Un téléphone quoi', 'equipement', 'Ressources et Craft › Équipement inventaire › A1');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('page', 'ressources/equipement-inventaire', 3, NULL, 'A1', NULL, NULL, '1 fois par combat', 'equipement', 'Ressources et Craft › Équipement inventaire › A1');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:eau-en-innee', 1, 'texte', 'O30', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O30');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:foudre-en-innee', 1, 'texte', 'O34', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:lumiere-en-innee', 1, 'texte', 'O38', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O38');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:laser-noir', 1, 'effets', 'BJ37', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Magie Maverick V8 › Corruption › BJ37');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:mine-noire', 1, 'effets', 'BJ34', 'note', NULL, 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)', 'magies', 'Magie Maverick V8 › Corruption › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:petrole', 1, 'effets', 'BJ28', 'note', NULL, 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.', 'magies', 'Magie Maverick V8 › Corruption › BJ28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-magique', 1, 'effets', 'BJ55', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Magie Maverick V8 › Corruption › BJ55');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-physique', 1, 'effets', 'BJ58', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Magie Maverick V8 › Corruption › BJ58');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-simple', 1, 'effets', 'BJ10', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Magie Maverick V8 › Corruption › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouille-visible', 1, 'effets', 'BJ13', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Magie Maverick V8 › Corruption › BJ13');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:chargeur', 1, 'type', 'AT28', 'commentaire_resolu', NULL, 'Peut être lancé 3 fois dans le même tour.', 'magies', 'Magie Maverick V8 › Foudre › AT28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:colonne-tesla', 1, 'effets', 'BJ25', 'note', NULL, 'Paratonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)', 'magies', 'Magie Maverick V8 › Foudre › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:dysfonctionnement', 1, 'effets', 'BJ43', 'note', NULL, 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.', 'magies', 'Magie Maverick V8 › Foudre › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:dysfonctionnement', 2, 'effets', 'BJ43', 'commentaire_resolu', NULL, 'C''est un équivalent de "Confus" pour les créatures mécaniques.', 'magies', 'Magie Maverick V8 › Foudre › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:fer-foudroyant', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être paralysé au stade 1', 'magies', 'Magie Maverick V8 › Foudre › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:manteau-de-volt', 1, 'effets', 'BJ70', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être paralysé au stade 1', 'magies', 'Magie Maverick V8 › Foudre › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:execution-froide', 1, 'effets', 'BJ67', 'note', NULL, 'La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.', 'magies', 'Magie Maverick V8 › Glace › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:fer-froid', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être gelé au stade 1', 'magies', 'Magie Maverick V8 › Glace › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:gel-profond', 1, 'effets', 'BJ43', 'note', NULL, 'L''allié sera aussi dispensé de jet de survie pendant cet état.', 'magies', 'Magie Maverick V8 › Glace › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:lien-de-gel', 1, 'effets', 'BJ28', 'note', NULL, '3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...', 'magies', 'Magie Maverick V8 › Glace › BJ28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:mur-de-glace', 1, 'effets', 'BJ46', 'note', NULL, 'Invoque un mur.', 'magies', 'Magie Maverick V8 › Glace › BJ46');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:champ-de-force', 1, 'effets', 'BJ10', 'note', NULL, 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 chakra maximum', 'magies', 'Magie Maverick V8 › Lumière › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 1, 'effets', 'BJ43', 'note', NULL, 'Liste des amplifications :
- Permet d''encaisser le prochain sort d''ombre (sauf niveau 5)
- Immunise à la peur pendant 3 tours.
- Immunise aux effets négatifs pour le tour.
- Immunise contre les altérations d''état niveau 1 pour 2 tours', 'magies', 'Magie Maverick V8 › Lumière › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:croisade-lumineuse', 2, 'effets', 'BJ43', 'commentaire_resolu', NULL, 'Liste des amplifications :
- Permet d''encaisser le prochain sort d''ombre (sauf niveau 5)
- Immunise à la peur pendant 3 tours.
- Immunise aux effets négatifs pour le tour.
- Immunise contre les altérations d''état niveau 1 pour 2 tours', 'magies', 'Magie Maverick V8 › Lumière › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:energie-solaire', 1, 'effets', 'BJ25', 'note', NULL, '10% lors de neutre
20% lors de grand soleil.
25% lors de canicule.', 'magies', 'Magie Maverick V8 › Lumière › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:fer-lumineux', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1', 'magies', 'Magie Maverick V8 › Lumière › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:flash', 1, 'dsb', 'BG31', 'commentaire_resolu', NULL, 'Ce sort repose sur une existence des yeux, les créatures aveugles ne sont pas affectées par ce sort.', 'magies', 'Magie Maverick V8 › Lumière › BG31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:louange-daurora', 1, 'effets', 'BJ70', 'commentaire_resolu', NULL, 'Le sort peut être utilisé sur un allié qui n''est pas dans le coma.', 'magies', 'Magie Maverick V8 › Lumière › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 1, 'cout', 'AX7', 'commentaire_resolu', NULL, 'Niveau 1 : 3 CK + 1 âme
Niveau 2 : 6 CK + 2 âmes
Niveau 3 : 12 CK + 3 âmes
Niveau 4 : 24 CK + 4 âmes
Niveau 5 : 48 CK + 5 âmes', 'magies', 'Magie Maverick V8 › Nécromancie › AX7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 2, 'effets', 'BJ7', 'note', NULL, 'Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 3, 'effets', 'BJ7', 'commentaire_resolu', NULL, 'Pour voir les morts-vivants possibles https://maverick-jdr.fandom.com/fr/wiki/Mort-Vivant_(Invocation)

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:detection-de-vie', 1, 'effets', 'BJ16', 'note', NULL, 'Ce sort permet de changer de vision et de voir la vie grouiller autour de soi, la vie se montre sous forme de petite brume, il est possible de détecter de l''humanoïde au simple brin d''herbe. 

Attention un simple mur empêche de voir à travers ce dernier.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:fer-toxique', 1, 'effets', 'BJ31', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être empoisonné au stade 1', 'magies', 'Magie Maverick V8 › Nécromancie › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 1, 'effets', 'BJ43', 'note', NULL, 'Cette arme est considérée comme Spectrale.
Arme Spectrale = Peut toucher l''immatériel et ignore les AP.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 2, 'effets', 'BJ43', 'commentaire_resolu', NULL, 'Cette arme est considérée comme Spectrale.
Arme Spectrale = Peut toucher l''immatériel et ignore les PA.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:prison-dos', 1, 'effets', 'BJ40', 'note', NULL, 'La prison d''os est Invulnérable à l''estoc, Résistant à la taille mais vulnérable à la frappe.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:resurrection-noir', 1, 'effets', 'BJ70', 'note', NULL, 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:resurrection-noir', 2, 'effets', 'BJ70', 'commentaire_resolu', NULL, 'Est considéré comme mort tant que la cible n''a pas bu 1 fiole par jour sur 5 jours. Ou alors qu''une résurrection est appliquée sur lui.', 'magies', 'Magie Maverick V8 › Nécromancie › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:alourdissement', 1, 'effets', 'BJ37', 'commentaire_resolu', NULL, 'Équivalent à pétrifié 3 mais la victime ne peut pas prendre de dégâts sous le magma.', 'magies', 'Magie Maverick V8 › Terre › BJ37');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:appel-aux-golems', 1, 'effets', 'BJ13', 'commentaire_resolu', NULL, 'Pour voir les golems possibles 


Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.', 'magies', 'Magie Maverick V8 › Terre › BJ13');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:arbre-fertilisant', 1, 'effets', 'BJ25', 'commentaire_resolu', NULL, 'La cible doit être vivante.', 'magies', 'Magie Maverick V8 › Terre › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:barriere-rocheuse', 1, 'effets', 'BJ34', 'note', NULL, 'Si jamais un coup physique ou magique est encaissé par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.', 'magies', 'Magie Maverick V8 › Terre › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:barriere-rocheuse', 2, 'effets', 'BJ34', 'commentaire_resolu', NULL, 'Corps de pierre : Double les PA, diminue la vitesse de 1 et les adversaires ont +15% de chance avec un jet de défense.
Compatible avec Armure de roche et peau de pierre mais ils doivent avoir été lancés avant.', 'magies', 'Magie Maverick V8 › Terre › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:corps-de-maverium', 1, 'effets', 'BJ70', 'note', NULL, 'Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.', 'magies', 'Magie Maverick V8 › Terre › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:corps-de-maverium', 2, 'effets', 'BJ70', 'commentaire_resolu', NULL, 'Corps de Maverium permet d''ignorer tous les dégâts possibles quelle que soit leur puissance. Comme corps de pierre, tous les organes internes sont solidifiés et ne fonctionnent pas temporairement (comme un golem, pas besoin)', 'magies', 'Magie Maverick V8 › Terre › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:corps-de-maverium', 3, 'effets', 'BJ70', 'commentaire_resolu', NULL, 'Corps de Maverium : Invincible temporairement, diminue la vitesse de 1 et les adversaires ont +15% de chance avec un jet de défense.', 'magies', 'Magie Maverick V8 › Terre › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:cuirasse-de-roche', 1, 'effets', 'BJ31', 'commentaire_resolu', NULL, 'Peut se cumuler avec Peau de Pierre.', 'magies', 'Magie Maverick V8 › Terre › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:fer-raffine', 1, 'effets', 'BJ22', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être pétrifié au stade 1', 'magies', 'Magie Maverick V8 › Terre › BJ22');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:frappe-racine', 1, 'effets', 'BJ43', 'note', NULL, 'Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.', 'magies', 'Magie Maverick V8 › Terre › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:infection', 1, 'effets', 'BJ28', 'commentaire_resolu', NULL, 'Les dégâts de l''infection ne sont pas élémentaires', 'magies', 'Magie Maverick V8 › Terre › BJ28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:peau-de-pierre', 1, 'effets', 'BJ10', 'commentaire_resolu', NULL, 'Peut se cumuler avec Armure de Roche.', 'magies', 'Magie Maverick V8 › Terre › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:racine-soignante', 1, 'effets', 'BJ16', 'note', NULL, 'L''environnement doit être majoritairement de Montagne, Forêt, Plaine, Caverne.', 'magies', 'Magie Maverick V8 › Terre › BJ16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:sable-changeant', 1, 'effets', 'BJ40', 'note', NULL, 'Le Terrain sable divise par 2 le déplacement, empêche le sprint et fait perdre un tour si jamais on saute.', 'magies', 'Magie Maverick V8 › Terre › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:terre-maudite', 1, 'effets', 'BJ64', 'note', NULL, 'La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.', 'magies', 'Magie Maverick V8 › Terre › BJ64');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:charge-denergie', 1, 'effets', 'BJ7', 'note', NULL, '30 chakra maximum en 1 fois', 'magies', 'Magie Maverick V8 › Arcane › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:forge-magie', 1, 'effets', 'BJ16', 'note', NULL, 'Exemple : 

Un caillou c''est taille 1
Une dague c''est taille 2

Les bombes ne font pas les dégâts de zone.', 'magies', 'Magie Maverick V8 › Arcane › BJ16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:laser-de-chakra', 1, 'effets', 'BJ37', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Magie Maverick V8 › Arcane › BJ37');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:pillage-defensif', 1, 'effets', 'BJ40', 'note', NULL, 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.', 'magies', 'Magie Maverick V8 › Arcane › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane', 1, 'effets', 'BJ10', 'note', NULL, 'Ne se cumule avec "Rune Arcane multiple"', 'magies', 'Magie Maverick V8 › Arcane › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane-multiple', 1, 'effets', 'BJ43', 'note', NULL, 'Ne se cumule avec "Rune Arcane"', 'magies', 'Magie Maverick V8 › Arcane › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:courant-salvateur', 1, 'effets', 'BJ43', 'note', NULL, 'Ne déclenche pas d''attaques d''opportunités

Soigne les alliés de 2d6 si un point d''eau est à 4 cases.', 'magies', 'Magie Maverick V8 › Eau › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:dissolution', 1, 'effets', 'BJ55', 'commentaire_resolu', NULL, 'Totalement insensible aux dégâts physiques et magiques qui ne sont pas une vulnérabilité. Permet de bénéficier d''une invisibilité quand vous êtes dans l''eau.', 'magies', 'Magie Maverick V8 › Eau › BJ55');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:fer-humide', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être confus au stade 1', 'magies', 'Magie Maverick V8 › Eau › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:larmes-doceane', 1, 'effets', 'BJ67', 'note', NULL, 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatosceptique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.', 'magies', 'Magie Maverick V8 › Eau › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:celerite', 1, 'effets', 'BJ49', 'note', NULL, 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ49');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:celerite', 2, 'effets', 'BJ49', 'commentaire_resolu', NULL, 'Permet d''avoir 2 tours en 1, ça implique d''avoir 2 initiatives donc de jeter 2 fois un dé d''initiative.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ49');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:distorsion', 1, 'effets', 'BJ70', 'note', NULL, 'Perdre le tour ne signifie pas perdre sa posture.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:etat-anterieur', 1, 'effets', 'BJ34', 'note', NULL, 'Pour les armures, il faut faire le sort sur CHAQUE morceau.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:fer-temporel', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être fatigué au stade 1', 'magies', 'Magie Maverick V8 › TempsEspace › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:frappe-temporelle', 1, 'effets', 'BJ31', 'note', NULL, 'Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Magie Maverick V8 › TempsEspace › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:frappe-temporelle', 2, 'effets', 'BJ31', 'commentaire_resolu', NULL, 'Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:grenade-distordue', 1, 'effets', 'BJ52', 'note', NULL, 'Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ52');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:horloge-aspirante', 1, 'effets', 'BJ46', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Magie Maverick V8 › TempsEspace › BJ46');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:image-diffuse', 1, 'effets', 'BJ61', 'note', NULL, 'Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.
Si un clone prend un coup, il disparait.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ61');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:inversion', 1, 'effets', 'BJ28', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contré par "Téléportation"', 'magies', 'Magie Maverick V8 › TempsEspace › BJ28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:portail', 1, 'effets', 'BJ10', 'note', NULL, 'Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du chakra.', 'magies', 'Magie Maverick V8 › TempsEspace › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:teleport-parfait', 1, 'effets', 'BJ58', 'commentaire_resolu', NULL, 'Sert uniquement hors combat !', 'magies', 'Magie Maverick V8 › TempsEspace › BJ58');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:teleportation', 1, 'effets', 'BJ7', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Ce sort permet également de contrer les ennemis qui voudraient se téléporter, pour que ça marche : il est nécessaire d’avoir le sort, de sacrifier une parade/esquive, de réussir un meilleur jet et que l’ennemi soit dans la portée du sort.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Magie Maverick V8 › TempsEspace › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:amplification-sombre', 1, 'effets', 'BJ40', 'note', NULL, 'EC = Échec critique', 'magies', 'Magie Maverick V8 › Ombre › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:chaine-de-lentrave', 1, 'effets', 'BJ64', 'note', NULL, 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :
1re tentative : Réussite divisée par 2
2e tentative : Réussite divisée par 1.5
3e tentative : Réussite divisée par 1.25
4e tentative : Score normal

Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.', 'magies', 'Magie Maverick V8 › Ombre › BJ64');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:defaite-annoncee', 1, 'effets', 'BJ55', 'note', NULL, 'Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.', 'magies', 'Magie Maverick V8 › Ombre › BJ55');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:fer-obscur', 1, 'effets', 'BJ31', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Peur au stade 1', 'magies', 'Magie Maverick V8 › Ombre › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:frappe-negative', 1, 'effets', 'BJ70', 'note', NULL, 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts', 'magies', 'Magie Maverick V8 › Ombre › BJ70');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:lame-dombre', 1, 'effets', 'BJ25', 'note', NULL, 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une', 'magies', 'Magie Maverick V8 › Ombre › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:marionnette-de-lombre', 1, 'effets', 'BJ10', 'note', NULL, 'Sort interdit aux familiers et aux invocations.', 'magies', 'Magie Maverick V8 › Ombre › BJ10');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:ombre-menacante', 1, 'effets', 'BJ46', 'note', NULL, 'L''ombre reste 3 tours.

Le jet de fermeté se relance tous les débuts de tour.', 'magies', 'Magie Maverick V8 › Ombre › BJ46');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:pire-ami', 1, 'effets', 'BJ61', 'note', NULL, 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.', 'magies', 'Magie Maverick V8 › Ombre › BJ61');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:fer-brulant', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, inflige brûlure au stade 1', 'magies', 'Magie Maverick V8 › Feu › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:fer-brulant', 2, 'effets', 'BJ19', 'commentaire_resolu', NULL, 'Si 5 ou moins avec une arme sous ce sort, inflige brûlure au stade 1', 'magies', 'Magie Maverick V8 › Feu › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:rai-solaire', 1, 'effets', 'BJ58', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Magie Maverick V8 › Feu › BJ58');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:annulation', 1, 'effets', 'BJ13', 'note', NULL, '- Inutile contre les infirmités, la fatigue physique, les croix.
- Ne marche pas sur les effets magie niveau 3 ou plus
- Soigne d''un cran les altérations d''états.', 'magies', 'Magie Maverick V8 › Sang › BJ13');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:annulation', 2, 'effets', 'BJ13', 'commentaire_resolu', NULL, 'Inutile contre les infirmités, la fatigue, les croix, les altérations d''états.
Ne marche pas sur les effets magie niveau 3 ou plus', 'magies', 'Magie Maverick V8 › Sang › BJ13');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:attirance', 1, 'effets', 'BJ16', 'note', NULL, 'Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C''est le lanceur qui est attiré.', 'magies', 'Magie Maverick V8 › Sang › BJ16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:coagulation', 1, 'effets', 'BJ40', 'note', NULL, 'Le mur est fixé au sol.', 'magies', 'Magie Maverick V8 › Sang › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:coagulation', 2, 'effets', 'BJ40', 'commentaire_resolu', NULL, 'La cible doit saigner. La carapace est fixée au sol.', 'magies', 'Magie Maverick V8 › Sang › BJ40');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:fer-sanglant', 1, 'effets', 'BJ22', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Saignement au stade 1', 'magies', 'Magie Maverick V8 › Sang › BJ22');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:morsure-aspirante', 1, 'effets', 'BJ37', 'note', NULL, 'Ne marche pas si c''est la barrière qui encaisse le coup', 'magies', 'Magie Maverick V8 › Sang › BJ37');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:proportion-demesuree', 1, 'effets', 'BJ67', 'note', NULL, 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 6 de force temporairement)', 'magies', 'Magie Maverick V8 › Sang › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:proportion-demesuree', 2, 'effets', 'BJ67', 'commentaire_resolu', NULL, 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 7 de force temporairement)', 'magies', 'Magie Maverick V8 › Sang › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:renfermement', 1, 'effets', 'BJ43', 'note', NULL, 'Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.', 'magies', 'Magie Maverick V8 › Sang › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:saignee-forcee', 1, 'effets', 'BJ34', 'note', NULL, 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.', 'magies', 'Magie Maverick V8 › Sang › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:sang-garde', 1, 'effets', 'BJ25', 'commentaire_resolu', NULL, 'NB : Jet de défense désigne les jets d''Esquive ET de Parade', 'magies', 'Magie Maverick V8 › Sang › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:fer-eolien', 1, 'effets', 'BJ25', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être sourd au stade 1', 'magies', 'Magie Maverick V8 › Vent › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:feuille-morte', 1, 'effets', 'BJ28', 'note', NULL, 'Maximum 30m', 'magies', 'Magie Maverick V8 › Vent › BJ28');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:propulsion', 1, 'effets', 'BJ16', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.', 'magies', 'Magie Maverick V8 › Vent › BJ16');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:tornade', 1, 'effets', 'BJ43', 'note', NULL, 'Réussir à sortir vous fait prendre quand même 5d6 dégâts. Ne pas réussir à sortir vous fait voler et tomber par terre.', 'magies', 'Magie Maverick V8 › Vent › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:alea-negatif', 1, 'effets', 'BJ49', 'note', NULL, '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.

RIEN N''EST ESQUIVABLE

1 : Inflige *saignement 1
2 : Met une croix en Force pour 1 tour
3 : Inflige *poison 1
4 : Oblige un jet de vigueur ou fermeté (le meilleur), si raté : Perd le tour
5 : Inflige *brûlure 1
6 : Met une croix en Perception pour 1 tour
7 : Inflige le sort de l''ombre "Malédiction" pour 1 tour
8 : Inflige *surdité 1
9 : Inflige *paralysie 1
10 : Met une croix en Volonté pour 1 tour
11 : Inflige *surcharge magique 1
12 : Inflige *peur 1
13 : Inflige *aveuglement 1
14 : Met une croix en Intelligence pour 1 tour
15 : Inflige *enragé 1
16 : Inflige gel 1
17 : Inflige confusion 1
18 : Met une croix en Agilité pour 1 tour
19 : Retire tous les effets positifs de la cible
20 : Inflige couardise', 'magies', 'Magie Maverick V8 › Vide › BJ49');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:aspect-vide', 1, 'effets', 'BJ43', 'note', NULL, 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.', 'magies', 'Magie Maverick V8 › Vide › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:aspect-vide', 2, 'effets', 'BJ43', 'commentaire_resolu', NULL, 'L''équipement le devient aussi donc les attaques et sorts ne fonctionnent pas, SEULES les armes spectrales fonctionnent dans cet état.', 'magies', 'Magie Maverick V8 › Vide › BJ43');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:dissipation', 1, 'effets', 'BJ31', 'note', NULL, '- Ne marche pas sur les effets magie niveau 4 ou plus
- Inutile contre les infirmités, la fatigue physique, les croix.
- Soigne d''un cran les altérations d''états.', 'magies', 'Magie Maverick V8 › Vide › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:dissipation', 2, 'effets', 'BJ31', 'commentaire_resolu', NULL, 'Les buff niveau 5 ne peuvent pas être annulés par ce sort.', 'magies', 'Magie Maverick V8 › Vide › BJ31');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:fer-vide', 1, 'effets', 'BJ19', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Rage au stade 1', 'magies', 'Magie Maverick V8 › Vide › BJ19');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:metronome', 1, 'effets', 'BJ67', 'note', NULL, 'Ne peut pas être relancé.
Le mage noir et blanc peuvent le faire mais ça dépendra de la nature du premier sort.', 'magies', 'Magie Maverick V8 › Vide › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:metronome', 2, 'effets', 'BJ67', 'commentaire_resolu', NULL, 'Ne peut pas être relancé.', 'magies', 'Magie Maverick V8 › Vide › BJ67');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:poing-du-vide', 1, 'effets', 'BJ25', 'note', NULL, 'La cible est attirée d''une case seulement si elle rate totalement son jet de défense ou si elle est dans l''incapacité de se défendre.', 'magies', 'Magie Maverick V8 › Vide › BJ25');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:sablier-du-vide', 1, 'effets', 'BJ34', 'note', NULL, 'Les ennemis peuvent se défendre contre le coup du sablier.', 'magies', 'Magie Maverick V8 › Vide › BJ34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:telekinesie', 1, 'effets', 'BJ7', 'note', NULL, 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)', 'magies', 'Magie Maverick V8 › Vide › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:telekinesie', 2, 'effets', 'BJ7', 'commentaire_resolu', NULL, 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = TP
Magie 2 = P
Magie 3 = N
Magie 4 = G
Magie 5 = TG', 'magies', 'Magie Maverick V8 › Vide › BJ7');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:touche-du-vide', 1, 'effets', 'BJ46', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Magie Maverick V8 › Vide › BJ46');

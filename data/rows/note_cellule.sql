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
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:laser-noir', 1, 'effets', 'AC83', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:mine-noire', 1, 'effets', 'AC80', 'note', NULL, 'Elle peut se voir mais seulement avec un jet d''observation/distinction réussi en posture vigilance et seulement à portée de vue (Score de perception)', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:petrole', 1, 'effets', 'AT69', 'note', NULL, 'Bien entendu on est pas bloqué à vie, il est possible d''en sortir avec un jet d''athlétisme/équilibre, s''il est raté, il faut attendre le prochain tour pour réessayer. C''est juste le mouvement qui est bloqué, pas l''action évidemment.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT69');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-magique', 1, 'effets', 'BK98', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › BK98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-physique', 1, 'effets', 'BK101', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › BK101');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouillage-simple', 1, 'effets', 'AT51', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-corruption#sort:verrouille-visible', 1, 'effets', 'AT54', 'note', NULL, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.

Les verrouillages ne se cumulent pas.', 'magies', 'Nouveauté mise à jour Décembre › Corruption › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:colonne-tesla', 1, 'effets', 'AT57', 'note', NULL, 'Paratonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:dysfonctionnement', 1, 'effets', 'BK77', 'note', NULL, 'C''est un équivalent de "Confusion 3" pour les créatures mécaniques.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:fer-foudroyant', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être paralysé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:nerveux', 1, 'effets', 'AT45', 'note', NULL, 'II : Initiative individuelle
IG : Initiative groupée', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:plaque-miroir', 1, 'effets', 'BK74', 'note', NULL, 'Une plaque bloque qu''UN seul sort et disparaissent.

2 plaques à la fois maximum.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:rayonnement', 1, 'effets', 'AC98', 'note', NULL, 'BA = Barrière', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:repulsion-reflexe', 1, 'effets', 'BK86', 'note', NULL, 'Ne déclenche pas d''attaque d''opportunité sauf pour le bénéficiaire du sort.', 'magies', 'Nouveauté mise à jour Décembre › Foudre › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:turbine', 1, 'dsb', 'Z92', 'note', NULL, 'CE = Charge électrique
CK = Chakra', 'magies', 'Nouveauté mise à jour Décembre › Foudre › Z92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-foudre#sort:turbine', 2, 'effets', 'AC92', 'note', NULL, '1 seule charge par tour.
3 charges maximum cumulable

Une fois la ou les charges libérées, il faut relancer le sort pour recommencer', 'magies', 'Nouveauté mise à jour Décembre › Foudre › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:execution-froide', 1, 'effets', 'AC95', 'note', NULL, 'La victime ne peut rien faire dans cet état, il faut à tout prix que le lanceur rate un jet de concentration ou bien qu''il soit interrompu.
Dans le cas d''un boss qui se fait enfermer, il peut lutter contre avec des jets d''athlétisme, concentration, vigueur, etc... le mj a le choix. Le lanceur devra faire un meilleur jet que la cible pour ne pas qu''il sorte du cercueil.', 'magies', 'Nouveauté mise à jour Décembre › Glace › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:fer-froid', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être gelé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Glace › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:gel-profond', 1, 'effets', 'BK77', 'note', NULL, 'L''allié sera aussi dispensé de jet de survie pendant cet état.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:lien-de-gel', 1, 'effets', 'AT60', 'note', NULL, '3NM = Inflige 4 dégâts perce AM lors du lien de gel.

Le lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d''adversaires disponibles. La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté d''un autre qui a le lien de gel et ainsi de suite...', 'magies', 'Nouveauté mise à jour Décembre › Glace › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:mur-de-glace', 1, 'effets', 'BK80', 'note', NULL, 'Invoque un mur.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:prisme-protecteur', 1, 'effets', 'BK86', 'note', NULL, '*Met à 1 de santé et +20AM pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', 'magies', 'Nouveauté mise à jour Décembre › Glace › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-glace#sort:sublimation', 1, 'effets', 'AC80', 'note', NULL, 'Un état de gel est comme retirer "gel 1". Donc par extension, "gel 2" correspond à 2 états de gel, etc.', 'magies', 'Nouveauté mise à jour Décembre › Glace › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:champ-de-force', 1, 'effets', 'AT42', 'note', NULL, 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 chakra maximum', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:condamnation-solaire', 1, 'effets', 'AC86', 'note', NULL, '*Dure 2 tours
80% de santé restante : +3 dégâts
60% de santé restante : +6 dégâts
40% de santé restante : +9 dégâts
20%  de santé restante : +12 dégâts', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:energie-solaire', 1, 'effets', 'AT57', 'note', NULL, '10% lors de neutre
20% lors de grand soleil.
25% lors de canicule.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:fer-lumineux', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être aveuglé au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:marque-du-champion', 1, 'effets', 'BK77', 'note', NULL, '*Prend en compte l''AM', 'magies', 'Nouveauté mise à jour Décembre › Lumière › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:mur-gamma', 1, 'effets', 'AC80', 'note', NULL, 'Les non-morts prennent 2 fois plus de dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:rai-solaire', 1, 'effets', 'AC92', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-lumiere#sort:revelation', 1, 'effets', 'AC83', 'note', NULL, 'Il se comporte comme un soleil vis à vis des créatures sensible à la lumière.

Le brouillard obscur bloque son effet.', 'magies', 'Nouveauté mise à jour Décembre › Lumière › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 2, 'effets', 'AT45', 'note', NULL, 'Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:detection-de-vie', 1, 'effets', 'AT54', 'note', NULL, 'Ce sort permet de changer de vision et de voir la vie grouiller autour de soi, la vie se montre sous forme de petite brume, il est possible de détecter de l''humanoïde au simple brin d''herbe. 

Attention un simple mur empêche de voir à travers ce dernier.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:fer-toxique', 1, 'effets', 'AT69', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être empoisonné au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AT69');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 1, 'effets', 'AC80', 'note', NULL, 'Cette arme est considérée comme Spectrale.
Arme Spectrale = Peut toucher l''immatériel et ignore 50% des AP.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:prison-dos', 1, 'effets', 'AC83', 'note', NULL, 'La prison d''os est Invulnérable à l''estoc, Résistant à la taille mais vulnérable à la frappe.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:resurrection-noir', 1, 'effets', 'AC104', 'note', NULL, 'Est considérée comme morte tant que la cible n''a pas bu 1 super fiole de soin par jour sur 1 mois. Ou alors qu''une résurrection est appliquée sur lui.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC104');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:seigneur-des-morts', 1, 'effets', 'AC77', 'note', NULL, '- +10 dégâts
- +6 AP
- +6 AM
- +10% de réussite aux jets
- +2 Vitesse
- 20% de chance de forcer un jet de vigueur/fermeté pour ne pas prendre l''altération d''état de l''élément lié niveau 1 à chaque attaque de l''invocation.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › AC77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-necromancie#sort:venin-corrosif', 1, 'effets', 'BK86', 'note', NULL, 'L''attaque en question ne détruira pas les armures ou arme comme pourrai le faire l''eau ou la terre.', 'magies', 'Nouveauté mise à jour Décembre › Nécromancie › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:barriere-rocheuse', 1, 'effets', 'BK71', 'note', NULL, 'Si jamais un coup physiques ou magiques est encaisser par la protection, elle doit faire plus que la tolérance de cette dernière pour la briser.

Si elle fait moins, le coup est annulé et la protection se recharge pour le prochain coup

Si elle fait plus, la protection est brisée et l''intégralité du coup est encaissée.

Les AP ne sont pas comptées quand les dégâts sont faits à la protection.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK71');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:corps-de-maverium', 1, 'effets', 'BK95', 'note', NULL, 'Corps de Maverium : Tous les dégâts reçus sont réduits à 0 et les effets négatifs sur les protections ne fonctionnent pas.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:fer-raffine', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être pétrifié au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Terre › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:floraison-carnivore', 1, 'effets', 'AC98', 'note', NULL, 'Prend 2 fois plus de dégâts des sorts de feu ou de sang.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:frappe-racine', 1, 'effets', 'AC74', 'note', NULL, 'Demande un sol, un mur, un plafond ou toute autre surface où la racine peut sortir, sous l''eau ça marche mais pas dans le ciel.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:petale-bouclier', 1, 'effets', 'AC89', 'note', NULL, '*Met à 1 de santé et +20AP pendant 2 tours pour le bénéficiaire puis la protection disparaît.

Si au bout de 2 tours, la protection n''a pas protégée, elle disparaît.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:racine-soignante', 1, 'effets', 'AT48', 'note', NULL, 'L''environnement doit être majoritairement de Montagne, Forêt, Plaine, Caverne.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:sable-changeant', 1, 'effets', 'BK77', 'note', NULL, 'Le Terrain sable divise par 2 le déplacement, empêche le sprint et fait perdre un tour si jamais on saute.', 'magies', 'Nouveauté mise à jour Décembre › Terre › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-la-terre#sort:terre-maudite', 1, 'effets', 'AC95', 'note', NULL, 'La Nécrose ne disparaît que quand le lanceur est hors combat ou mort.', 'magies', 'Nouveauté mise à jour Décembre › Terre › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:charge-denergie', 1, 'effets', 'AT48', 'note', NULL, '30 chakra maximum en 1 fois', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:forge-magie', 1, 'effets', 'AT57', 'note', NULL, 'Exemple : 

Un caillou c''est taille 1
Une dague c''est taille 2

Les bombes ne font pas les dégâts de zone.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:laser-de-chakra', 1, 'effets', 'BK83', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › BK83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:pate-de-la-trame', 1, 'effets', 'AC104', 'note', NULL, '*
- +15 dégâts magiques
- +3 portée avec les sorts
- +1 portée d''une zone
- Le CC d''une attaque oblige le jet de vigueur/fermeté pour ne pas prendre l''altération d''état lié au niveau 1', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC104');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:pillage-defensif', 1, 'effets', 'BK86', 'note', NULL, 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.', 'magies', 'Nouveauté mise à jour Décembre › Arcane › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:projectile-arcanique', 1, 'effets', 'AC83', 'note', NULL, 'L''AM est pris en compte pour chaque projectile.

*Le coût augmente de 1 à chaque projectile envoyé sur l''action (le premier coute 4, le second coute 5, etc)
', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane', 1, 'effets', 'AT51', 'note', NULL, 'Ne se cumule avec "Rune Arcane multiple"', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-larcane#sort:rune-arcane-multiple', 1, 'effets', 'AC86', 'note', NULL, 'Ne se cumule avec "Rune Arcane"', 'magies', 'Nouveauté mise à jour Décembre › Arcane › AC86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:courant-salvateur', 1, 'effets', 'AC79', 'note', NULL, 'Ne déclenche pas d''attaques d''opportunités

Soigne les alliés de 2d6 si un point d''eau est à 4 cases.', 'magies', 'Nouveauté mise à jour Décembre › Eau › AC79');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:fer-humide', 1, 'effets', 'AT50', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être confus au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Eau › AT50');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:larmes-doceane', 1, 'effets', 'BK94', 'note', NULL, 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatosceptique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.', 'magies', 'Nouveauté mise à jour Décembre › Eau › BK94');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-leau#sort:laser-hydraulique', 1, 'effets', 'BK82', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Eau › BK82');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:celerite', 1, 'effets', 'BK86', 'note', NULL, 'Un boss qui a naturellement 2 tours, n''aura qu''un seul tour avec deux actions.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:distorsion', 1, 'effets', 'AC101', 'note', NULL, 'Perdre le tour ne signifie pas perdre sa posture.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC101');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:etat-anterieur', 1, 'effets', 'BK74', 'note', NULL, 'Pour les armures, il faut faire le sort sur CHAQUE morceau.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:fer-temporel', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être fatigué au stade 1', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:frappe-temporelle', 1, 'effets', 'AT66', 'note', NULL, 'Possible de le faire sur un allié, l''allié ne prendra pas les dégâts.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:grenade-distordue', 1, 'effets', 'AC89', 'note', NULL, 'Si le lanceur est dans la zone d''action de la grenade, il peut décider de ne pas être téléporté.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:horloge-aspirante', 1, 'effets', 'BK83', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › BK83');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:image-diffuse', 1, 'effets', 'AC95', 'note', NULL, 'Ces clones imitent le lanceur dans ses actions mais sans pour autant faire des dégâts ou des effets sur les autres.
Si jamais une attaque risque d''arriver sur le lanceur, cette attaque a 50% de chance d''atterrir sur un des clones.
Si un clone prend un coup, il disparait.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:inversion', 1, 'effets', 'AT63', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Il n’est pas possible d’échanger sa place avec une cible trop grosse.

Peut être contré par "Téléportation"', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:portail', 1, 'effets', 'AT45', 'note', NULL, 'Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du chakra.', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT45');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lespace-temps#sort:teleportation', 1, 'effets', 'AT42', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.

Ce sort permet également de contrer les ennemis qui voudraient se téléporter, pour que ça marche : il est nécessaire d’avoir le sort, de sacrifier une parade/esquive, de réussir un meilleur jet et que l’ennemi soit dans la portée du sort.

Si la case d''arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)', 'magies', 'Nouveauté mise à jour Décembre › EspaceTemps › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:amplification-sombre', 1, 'effets', 'AC77', 'note', NULL, 'EC = Échec critique', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:chaine-de-lentrave', 1, 'effets', 'AC95', 'note', NULL, 'La victime ne peut rien faire si ce n''est tenter un jet d''athlétisme/concentration/magie/équilibre pour sortir du sort, sauf que ses chances sont amoindries au début :
1re tentative : Réussite divisée par 2
2e tentative : Réussite divisée par 1.5
3e tentative : Réussite divisée par 1.25
4e tentative : Score normal

Un échec met fin au tour, une réussite libère la victime qui peut jouer normalement.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC95');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:defaite-annoncee', 1, 'effets', 'AC89', 'note', NULL, 'Les sorts Défaite annoncée et Explosion glorifique s''annulent mutuellement.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:fer-obscur', 1, 'effets', 'AT63', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Peur au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:frappe-negative', 1, 'effets', 'AC98', 'note', NULL, 'Donne un effet négatif selon la santé restante parmi les suivants (les effets sont cumulatifs) :

Santé à 100% = Oblige un jet de fermeté à la cible, si elle rate, elle prend peur 1.

Santé à 80% = Réduit d''un cran la résistance à l''ombre de la cible pour 1 tour.

Santé à 60% = Inflige Couardise

Santé à 40% = Ignore 50% des AM

Santé à 20% = Le sort inflige + 40 dégâts', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:lame-dombre', 1, 'effets', 'AT57', 'note', NULL, 'La lame fait partie de l''attaque qu''elle accompagne, l''adversaire n''a pas à faire une autre défense pour juste la lame. Les lames partent une par une', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:marionnette-de-lombre', 1, 'effets', 'AT42', 'note', NULL, 'Sort interdit aux familiers et aux invocations.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:ombre-menacante', 1, 'effets', 'BK80', 'note', NULL, 'L''ombre reste 3 tours.

Le jet de fermeté se relance tous les débuts de tour.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK80');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:pichenette', 1, 'effets', 'AT48', 'note', NULL, 'II : Initiative individuelle
IG : Initiative groupée', 'magies', 'Nouveauté mise à jour Décembre › Ombre › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-de-lombre#sort:pire-ami', 1, 'effets', 'BK92', 'note', NULL, 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de sa santé totale.', 'magies', 'Nouveauté mise à jour Décembre › Ombre › BK92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:aspect-cendreuse', 1, 'effets', 'BK77', 'note', NULL, 'L''insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. Prendre un coup physique annule cet état.', 'magies', 'Nouveauté mise à jour Décembre › Feu › BK77');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:fer-brulant', 1, 'effets', 'AT51', 'note', NULL, 'Si coup critique avec une arme sous ce sort, inflige brûlure au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Feu › AT51');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:forteresse-escarbille', 1, 'effets', 'BK98', 'note', NULL, '*Force le jet de vigueur à un agresseur pour ne pas qu''il prenne "brûlure 2"', 'magies', 'Nouveauté mise à jour Décembre › Feu › BK98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-feu#sort:rayon-de-fusion', 1, 'effets', 'AC92', 'note', NULL, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.', 'magies', 'Nouveauté mise à jour Décembre › Feu › AC92');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:annulation', 1, 'effets', 'AT49', 'note', NULL, '- Inutile contre les infirmités, la fatigue physique, les croix.
- Ne marche pas sur les effets magie niveau 3 ou plus
- Soigne d''un cran les altérations d''états.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT49');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:attirance', 1, 'effets', 'AT52', 'note', NULL, 'Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C''est le lanceur qui est attiré.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT52');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:coagulation', 1, 'effets', 'BK81', 'note', NULL, 'Le mur est fixé au sol.', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK81');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:fer-sanglant', 1, 'effets', 'AT58', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Saignement au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Sang › AT58');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-dechirant', 1, 'effets', 'AC96', 'note', NULL, '2 remède ou deux sorts de soin d''altération d''état sont nécessaire pour arrêter un saignement.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC96');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:marquage-surcharge', 1, 'effets', 'AC78', 'note', NULL, 'Ignore les défenses.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC78');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:morsure-aspirante', 1, 'effets', 'BK78', 'note', NULL, 'Ne marche pas si c''est la barrière qui encaisse le coup', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK78');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:proportion-demesuree', 1, 'effets', 'BK99', 'note', NULL, 'Le bonus en force casse les limites de la carac (oui oui, on peut monter à 6 de force temporairement)', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK99');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:renfermement', 1, 'effets', 'BK84', 'note', NULL, 'Vu que c''est une régénération, la santé récupérée par tour se détermine au premier jet.', 'magies', 'Nouveauté mise à jour Décembre › Sang › BK84');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-sang#sort:saignee-forcee', 1, 'effets', 'AC75', 'note', NULL, 'Saignement particulier = Saignement de stade 1 qui ne se soigne pas et qui se cumule pas avec le Saignement classique. N''augmente pas en intensité mais redémarre le nombre si répété.', 'magies', 'Nouveauté mise à jour Décembre › Sang › AC75');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:fer-eolien', 1, 'effets', 'AT57', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas être sourd au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT57');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:feuille-morte', 1, 'effets', 'AT60', 'note', NULL, 'Maximum 30m', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:propulsion', 1, 'effets', 'AT48', 'note', NULL, 'Ne provoque pas d''attaque d''opportunité.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT48');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:recul-force', 1, 'effets', 'AT63', 'note', NULL, 'Sans NM dedans, le sort ne peut pas reculé une cible grande. Et c''est maximum 1 pour cette même cible.', 'magies', 'Nouveauté mise à jour Décembre › Vent › AT63');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vent#sort:sonar', 1, 'effets', 'BK89', 'note', NULL, 'Ligne de vue : C''est le besoin de voir la cible pour la toucher dans la portée du sort. Ce sort permet d''attendre la cible malgré un obstacle. SAUF si cet obstacle ne possède pas de possibilité de faire passer le sort comme un mur sans trou.', 'magies', 'Nouveauté mise à jour Décembre › Vent › BK89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:alea-negatif', 1, 'effets', 'BK86', 'note', NULL, '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus.

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
20 : Inflige couardise', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK86');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:aspect-vide', 1, 'effets', 'AC74', 'note', NULL, 'L''équipement le devient aussi, les sorts et les attaques ne touchent pas, SEULES les armes spectrales fonctionnent dans cet état.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:deni-de-classe', 1, 'effets', 'BK89', 'note', NULL, 'Ne retire pas le premier don niveau 10 des spécialisations', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK89');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:dissipation', 1, 'effets', 'AT66', 'note', NULL, '- Ne marche pas sur les effets magie niveau 4 ou plus
- Inutile contre les infirmités, la fatigue physique, les croix.
- Soigne d''un cran les altérations d''états.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT66');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:fer-vide', 1, 'effets', 'AT54', 'note', NULL, 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Rage au stade 1', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT54');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:poing-du-vide', 1, 'effets', 'AT60', 'note', NULL, 'La cible est attirée d''une case seulement si elle rate totalement son jet de défense ou si elle est dans l''incapacité de se défendre.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT60');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:regard-de-mora', 1, 'effets', 'AC98', 'note', NULL, '- Les alliés infligent +5 dégâts et les ennemis -10.
- Les alliés ont +10% chances de réussir, les ennemis -20%
- Les ennemis ne peuvent plus sortir des zones d''influences d''eux mêmes
- Les ennemis perdent un niveau de puissance magique
- Banni les invocations et empêches les sorts d''invocations
- Détruit les sorts "Construction" sur le terrain et empêche ces sorts d''être utilisé
- Une fois pendant le Regard, si un allié fait des 1 dans les dés de dégâts, il peut les relancer.', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC98');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:sablier-du-vide', 1, 'effets', 'BK74', 'note', NULL, 'Les ennemis peuvent se défendre contre le coup du sablier.', 'magies', 'Nouveauté mise à jour Décembre › Vide › BK74');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:telekinesie', 1, 'effets', 'AT42', 'note', NULL, 'La taille de l''objet n''est pas infinie, il faut un certain niveau de magie pour certains objets
Magie 1 = taille 1 (1 kg maxi)
Magie 2 = taille 2 (2 kg maxi)
Magie 3 = taille 3 (3 kg maxi)
Magie 4 = taille 4 (4 kg maxi)
Magie 5 = taille 5 (5 kg maxi)', 'magies', 'Nouveauté mise à jour Décembre › Vide › AT42');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('sort', 'magies/magie-du-vide#sort:touche-du-vide', 1, 'effets', 'AC83', 'note', NULL, 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'magies', 'Nouveauté mise à jour Décembre › Vide › AC83');

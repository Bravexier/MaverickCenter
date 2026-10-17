-- data/rows/panneau_regles_bloc.sql : export déterministe, une instruction par ligne, triée par (panneau_id, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('accessoires', 1, 1, 0, NULL, 'Les accessoires vierges de tout effet ont un coût de 100 Ro et leur effet est déterminé quand le porteur PORTE l''accessoire en question, bien entendu il y a une probabilité que l''accessoire aléatoire devienne moins cher.

Les accessoires maudits ne peuvent pas être retirés que par un enchanteur auquel on ajoute le prix que l''accessoire devrait couter.

Si une malédiction arrive, on relance l''accessoire et l''effet sera l''opposé de ce que ça devrait être.

Un lingot permet de faire 2 montures d''anneau, 2 montures de collier, 2 montures de couronne, 2 montures de bracelets.

Bien entendu il faut que la qualité de la gemme soit au rendez-vous pour pouvoir faire des accessoires plus puissants :

- Gemme classique = Accessoire niveau 1 et 2
- Gemme raffinée = Accessoire niveau 3 et 4 (prix de la gemme raffinée = prix gemme classique x2 + 10 Ro)
- Gemme parfaite = Accessoire niveau 5 (prix de la gemme raffinée = prix gemme classique x4 + 30 Ro)

Chaque accessoire possède des morceaux de gemmes, ce sont des quarts de gemmes qui sont utilisées.

On ne peut pas avoir deux accessoires qui ont le même effet.

Dans le cas d''une malédiction, on relance les dés au début des étapes et l''effet sera le contraire de ce qui est indiqué à la base (exemple : +1 force devient -1 force)');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 1, 1, 0, NULL, 'Toutes les armes ont de base 2 crans de {{solidite|solidité}},  les armes de corps à corps non spécifiées n''ont que 1 de portée

Pour fabriquer une arme, il faut avoir un lingot , un peu de bois, un fourneau, une enclume et être le métier forgeron (le métier n''est pas obligatoire mais il est recommandé car il permet d''esquiver un énorme malus de 40% à la fabrication). Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.

Pour recycler ou reforger une arme, le métier de forgeron est INDISPENSABLE.

Le matériel choisi peut donner des bonus mais aussi le type d''arme forgée, tous les bonus se cumulent une fois l''arme forgée (exemple : Une claymore en cuivre donne un bonus aux dégâts de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5 aux dégâts)');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 2, 2, 1, NULL, '{{recharge-longue:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 3, 3, 1, NULL, '{{recharge-tres-longue:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 4, 4, 1, NULL, '{{mordhau:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 5, 5, 0, NULL, '**Les armes en bleu sont les armes possibles en arme de départ.**

***CAS PARTICULIERS :***');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 6, 6, 1, 'Dague', '- Divise par 2 le malus de l''ambidextrie avec ces armes, ce qui veut dire que si une dague est dans un lot d''ambidextrie, son malus sera de 10% si première arme et 20% si deuxième arme (contre 20% et 40%. Et bien entendu la division fonctionne en combinaison avec le bimane = donc 5% et 10% si on cumule les deux). Si vous utilisez une autre arme qu''une dague en ambidextrie, la dague elle aura cette règle appliquée mais pas l''autre arme.

- Un coup réussi à la dague impose un malus de 10% à la défense de l''adversaire (sauf la lame secrète qui lui inflige 20%).');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 7, 7, 1, 'Arme de jet', '- Permettre de lancer 2 armes de jet en échange du déplacement et action (ou utiliser 2 fois la fronde).');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 8, 8, 1, 'Comment déterminer le prix de votre arme ?', '1 Matériau + Le coût de l''arme + Particularité de l''arme = PRIX FINAL');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armures', 1, 1, 0, NULL, 'Une armure a besoin de 2 matériaux pour être fabriquée, des combinaisons sont donc possibles. Lors de la fabrication, les bonus donnés par un matériau s''ajoutent au deuxième (cuir + cuir = 4AP; Écailles + Bois = 8AP + 1AM)

Les armures uniformes ont leur catégorie la plus lourde.

Solidité : Nombre de mauvais coups qui peuvent être encaissés avant destruction.

Les Armes et Armures uniques ont 1 cran de solidité bonus.

Pour améliorer une arme ou armure, il faut faire toutes les étapes une à une, il n''est pas possible de sauter une étape.

\*Cran de solidité uni = Si un cran de solidité est perdu, c''est TOUTE l''armure qui est abimée.

Pour les Armures spécifiques, leur bonus de compétences repose sur le fait que l''armure a tous les morceaux, perdre un seul morceau de l''armure, le bonus compétence ne marche plus.');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('batons-magiques', 1, 1, 0, NULL, 'Les bâtons magiques sont des petits bâtons de bois sur lesquels se trouve une gemme précieuse sur le bout. Ces gemmes sont liées à des magies et donnent des bonus passifs pour les sorts. Il y a pas de limite magique pour les porter (un utilisateur du feu peut porter à sa ceinture un bâton de vent)

Ces objets peuvent être portés à la ceinture ou dans un emplacement d''arme pour que l''effet soit actif. Il n''est pas possible d''accumuler les bâtons magiques sur le même emplacement de ceinture ainsi que les mêmes effets même si c''est différents niveaux ou gemmes.  
Exemple : Impossible de cumuler un bâton magique 1 feu et un bâton magique foudre 2 car ils amplifient la même chose.

Le porteur agit ainsi comme une sorte de source d''énergie pour le bâton, sans ça, le bâton est inutilisable.');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('batons-magiques', 2, 2, 1, 'Comment fabriquer un bâton magique ?', 'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('boucliers', 1, 1, 0, NULL, 'Un bouclier a besoin d''autant de matériaux que sa classe indique (classe 4 = 4 matériaux) et bien entendu les bonus (sauf solidité) s''additionnent entre les matériaux.

Les matériaux n''ont pas les mêmes stats pour les boucliers par rapport aux armures.

Solidité : Nombre de mauvais coups qui être encaissé avant destruction.

Pour améliorer une arme ou armure, il faut faire toutes les étapes une à une, il n''est pas possible de sauter une étape.

Il existe 4 poids différents pour les boucliers, il est nécessaire d''avoir le score de Force ou plus pour le porter.

Pour fabriquer un matériau, un jet de FORCE + INTELLIGENCE est nécessaire.

Alors la question que vous pourriez poser c''est : »Mais du coup, vu qu''on peut mettre plusieurs matériaux dans les boucliers (sauf le bocle) est-ce qu''on mettre un peu tous les matériaux qu''on veut ? »  
Pour répondre c''est oui et non :

- Oui, il est possible de mélanger les matériaux pour faire des boucliers un peu uniques.
- Non, vous ne pouvez pas faire non plus n’importe quoi, il n''est pas possible de faire un bouclier avec plus de 3 matériaux différents. Donc les Écus et les pavois doivent avoir 3 matériaux maximum différents sinon ça ne marche pas.');

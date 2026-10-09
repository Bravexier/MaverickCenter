-- data/rows/invocation.sql : export déterministe, une instruction par ligne, triée par (id). NE PAS ÉDITER À LA MAIN.
INSERT INTO invocation (id, nom, nom_cle, ordre, bandeau, genre, sort_id, texte_general, tableau_titre, origine, source_ref, remarque) VALUES ('bestiaire/animation-des-morts', 'Animation des morts', 'animation-des-morts', 2, 'INVOCATION NON-MORT', 'non-mort', 'magies/magie-de-la-necromancie#sort:animation-de-mort', 'Il n''est possible d’avoir qu’une seule invocation à la fois en combat et par personnage (sauf le mode hyper de la nécromancie qui permet d''en avoir un deuxième). L''invocation reste pour une durée limitée sur le terrain avant de disparaître, les invocations n''ont pas de prérequis en termes d''environnement ou de matière, ils sont créés magiquement.

N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule exception : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieure et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.

Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.

Les invocations sont systématiquement en neutre (sauf contre-indication) et ne peuvent pas changer de posture.

Le principe est strictement le même que pour le sort « Appel aux golems », les non-morts invoqués seront différents si jamais un allié vient vous aider dans votre tâche.


▸ Toutes ces créatures ont ceci en capacité commune

- Non-Mort. Une créature non-mort est immunisée à la peur, à la couardise, à la fatigue, au poison, à la maladie. Les soins de lumière lui infligent des dégâts mais il a la possibilité de faire un jet de défense pour ne pas prendre les dégâts.

- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément (sauf capacité lui donnant autre chose). [Exemple. Celui du feu est résistant au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau]. Chaque attaque physique de leur part est une attaque élémentaire.

▸ Invoquer une créature double-magie

Pour pouvoir invoquer un non-mort double-magie, il faut posséder une seconde magie ou alors être à proximité d’un allié qui peut en échange d’un IC, infuser sa magie.', 'TABLEAU "AMÉLIORATION CADAVÉRIQUE"', 'bestiaire', 'Invocation › Animation des morts › AP1:BE2; AP3:BE38; AP40:BU40', NULL);
INSERT INTO invocation (id, nom, nom_cle, ordre, bandeau, genre, sort_id, texte_general, tableau_titre, origine, source_ref, remarque) VALUES ('bestiaire/appel-aux-golems', 'Appel aux golems', 'appel-aux-golems', 1, 'INVOCATION GOLEM', 'golem', 'magies/magie-de-la-terre#sort:appel-aux-golems', 'Il n''est possible d’avoir qu’une seule invocation à la fois en combat et par personnage (sauf le mode hyper de la nécromancie qui permet d''en avoir un deuxième). L''invocation reste pour une durée limitée sur le terrain avant de disparaître, les invocations n''ont pas de prérequis en termes d''environnement ou de matière, ils sont créés magiquement.

N’importe qui peut vous aider pour créer une invocation double magie, et ça ne lui consomme pas son tour et ne lui demande pas de jet mais 1 IC (si jamais il en avait encore quand il a fini son tour). Seule exception : le potentiel illimité ne peut pas faire d''invocation double élément tout seul, il lui faut de l''aide extérieure et il ne peut pas aider à faire une invocation double élément vu qu''il ne possède pas la bonne magie.

Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.

Les invocations sont systématiquement en neutre et ne peuvent pas changer de posture.

Il existe plusieurs versions de golems invocables, ça varie selon les magies de l''utilisateur de la Terre ou bien de l''aide d''un allié. Car en effet, un allié peut très bien influer sa propre magie dans votre sort "Appel aux golems".


▸ Toutes ces créatures ont ceci en capacité commune

- Inerte. Boost la volonté à 10, ce qui permet d''être immunisé au jet de volonté.

- Élémentaire. Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément. [Exemple. Celui du feu est résistant au Feu, Terre et Glace mais est vulnérable au Vent et à l''Eau]. Chaque attaque physique de leur part est une attaque élémentaire. (Le Golem d''Argile ne possède pas cette capacité)


▸ Invoquer une créature double-magie

Pour pouvoir invoquer un golem double-magie, il faut posséder une seconde magie ou alors être à proximité d’un allié qui peut en échange d’un IC, infuser sa magie.', NULL, 'bestiaire', 'Invocation › Appel aux golems › AJ1:AY2; AJ3:AY38', NULL);
INSERT INTO invocation (id, nom, nom_cle, ordre, bandeau, genre, sort_id, texte_general, tableau_titre, origine, source_ref, remarque) VALUES ('bestiaire/marionette-de-lombre', 'Marionette de lombre', 'marionette-de-lombre', 3, 'INVOCATION MARIONETTE', 'marionette', 'magies/magie-de-lombre#sort:marionnette-de-lombre', 'Il n''est possible d’avoir qu’une seule invocation à la fois en combat et par personnage (sauf le mode hyper de la nécromancie qui permet d''en avoir un deuxième). L''invocation reste pour une durée limitée sur le terrain avant de disparaître, les invocations n''ont pas de prérequis en termes d''environnement ou de matière, ils sont créés magiquement.

Chaque invocation possède des statistiques et des données qui varient selon la puissance mise dans l''invocation. Avoir le bon niveau de puissance magique permet d''avoir des invocations plus puissantes mais plus chères en coût. Bien entendu, seuls les utilisateurs d''une seule magie peuvent invoquer les créatures NPM 5.

Les invocations sont systématiquement en neutre et ne peuvent pas changer de posture.

Cette invocation demande de la barrière pour être invoquée, elle va piocher dans la barrière courante du lanceur, ce qui fait qu''il n''est pas obligatoire d''avoir beaucoup de barrière pour invoquer mais il en faut quand même un minimum. Quoi qu''il arrive, il prendra 1 minimum, même si le lanceur en possède que 1.', NULL, 'bestiaire', 'Invocation › Marionette de lombre › Z1:AO2; Z3:AO38', NULL);

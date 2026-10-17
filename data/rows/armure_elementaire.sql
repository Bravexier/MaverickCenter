-- data/rows/armure_elementaire.sql : export déterministe, une instruction par ligne, triée par (id). NE PAS ÉDITER À LA MAIN.
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:arcane', 'Intermédiaire', 'magies/magie-de-larcane', 'ARCANE', 'Carapace des concordances', 5, 15, '- +1 cran de résistance à la Corruption
- +4 dégâts avec les sorts d''Arcane
- Permet d''obtenir pendant 1 tour la résistance à la magie du dernier dégât magique reçu', 2, 'equipement', 'Ressources et Craft › Pièces élémentaires › AG121:AM127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:corruption', 'Intermédiaire', 'magies/magie-de-la-corruption', 'CORRUPTION', 'Carapace des divergences', 6, 14, '- +1 cran de résistance à l''Arcane
- +4 dégâts avec les sorts de Corruption
- Baisse d''un cran une résistance magique aléatoire du dernier assaillant pendant 1 tour.', 3, 'equipement', 'Ressources et Craft › Pièces élémentaires › AO121:AU127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:eau', 'Intermédiaire', 'magies/magie-de-leau', 'EAU', 'Carapace des mers', 8, 12, '- +1 cran de résistance à l''Eau
- +4 dégâts avec les sorts de l''Eau
- Permet de respirer sous l''eau pendant 1h, +2 cases de déplacement dans l''eau', 8, 'equipement', 'Ressources et Craft › Pièces élémentaires › CC121:CI127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:espace-temps', 'Intermédiaire', 'magies/magie-de-lespace-temps', 'ESPACE/TEMPS', 'Carapace des distorsions', 7, 13, '- +1 cran de résistance à l''Espace/Temps
- +4 dégâts avec les sorts de l''Espace/Temps
- Permet de relancer une esquive/parade si ce jet est raté (1 fois par combat)', 4, 'equipement', 'Ressources et Craft › Pièces élémentaires › AW121:BC127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:feu', 'Intermédiaire', 'magies/magie-du-feu', 'FEU', 'Carapace des flamboiements', 10, 10, '- +1 cran de résistance au Feu
- +4 dégâts avec les sorts de Feu
- Permet de marcher sur toutes les surfaces de feu sans prendre de dégâts et 2d8 dégâts de feu en réponse aux assaillants qui attaquent le corps.', 7, 'equipement', 'Ressources et Craft › Pièces élémentaires › BU121:CA127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:foudre', 'Intermédiaire', 'magies/magie-de-la-foudre', 'FOUDRE', 'Carapace des orages', 12, 8, '- +1 cran de résistance au Foudre
- +4 dégâts avec les sorts de Foudre
- (Choix possible) (actif) Invoque la météo "Orage" dès le début du combat. Dure 3 tours.', 12, 'equipement', 'Ressources et Craft › Pièces élémentaires › DI121:DO127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:glace', 'Intermédiaire', 'magies/magie-de-la-glace', 'GLACE', 'Carapace des glaciers', 4, 16, '- +1 cran de résistance à la Glace
- +4 dégâts avec les sorts de Glace
- Si la santé descend en dessous de 25% de santé max, l''armure réagit et redonne 25% de la barrière max (1 fois/combat)', 9, 'equipement', 'Ressources et Craft › Pièces élémentaires › CK121:CQ127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:lumiere', 'Intermédiaire', 'magies/magie-de-la-lumiere', 'LUMIÈRE', 'Carapace des éveils', 8, 12, '- +1 cran de résistance de la Lumière
- +4 dégâts avec les sorts de la Lumière
- Les sorts de soin ont un bonus de +7.', 13, 'equipement', 'Ressources et Craft › Pièces élémentaires › DQ121:DW127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:necromancie', 'Intermédiaire', 'magies/magie-de-la-necromancie', 'NÉCROMANCIE', 'Carapace des os', 8, 12, '- +1 cran de résistance à la Nécromancie
- +4 dégâts avec les sorts de Nécromancie
- À chaque attaque au corps à corps subie, l’armure libère une poussière d’os, infligeant 4 dégâts perce armure à l’assaillant.', 6, 'equipement', 'Ressources et Craft › Pièces élémentaires › BM121:BS127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:ombre', 'Intermédiaire', 'magies/magie-de-lombre', 'OMBRE', 'Carapace des songes', 12, 8, '- +1 cran de résistance de l''Ombre
- +4 dégâts avec les sorts de l''Ombre
- Si jamais le porteur prend un coup, il impose un malus de 10% au prochain jet de l''assaillant', 14, 'equipement', 'Ressources et Craft › Pièces élémentaires › DY121:EE127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:sang', 'Intermédiaire', 'magies/magie-du-sang', 'SANG', 'Carapace des châtiments', 14, 6, '- +1 cran de résistance au Sang
- +4 dégâts avec les sorts de Sang
- Se charge en sang tous les tours, au bout de 3 tours, permet de libérer une vague qui force le jet de vigueur à tous les ennemis à 3 cases du lanceur, s''ils ratent, ils prennent "saignement 1"', 1, 'equipement', 'Ressources et Craft › Pièces élémentaires › Y121:AE127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:terre', 'Intermédiaire', 'magies/magie-de-la-terre', 'TERRE', 'Carapace des rochers', 16, 4, '- +1 cran de résistance à la Terre
- +4 dégâts avec les sorts à la Terre
- Si la santé tombe en dessous de 50%, invoque la météo "Champ magnétique". Dure 3 tours.', 10, 'equipement', 'Ressources et Craft › Pièces élémentaires › CS121:CY127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:vent', 'Intermédiaire', 'magies/magie-du-vent', 'VENT', 'Carapace des mistrals', 10, 10, '- +1 cran de résistance au Vent
- +4 dégâts avec les sorts de Vent
- Augmente de 3 l''AM lors d''une météo venteuse ou après avoir subi un sort du Vent (dure 3 tours, non-cumulable)', 11, 'equipement', 'Ressources et Craft › Pièces élémentaires › DA121:DG127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:intermediaire:vide', 'Intermédiaire', 'magies/magie-du-vide', 'VIDE', 'Carapace des interdits', 13, 7, '- +1 cran de résistance au Vide
- +4 dégâts avec les sorts de Vide
- Applique l''effet du sort "dissipation" sur un assaillant, lui retirant un effet positif aléatoire.', 5, 'equipement', 'Ressources et Craft › Pièces élémentaires › BE121:BK127', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:arcane', 'Léger', 'magies/magie-de-larcane', 'ARCANE', 'Garde chakratique', 3, 7, '- +1 cran de résistance à la Corruption
- +6 dégâts avec les sorts d''Arcane
- Donne +25 Chakra max au porteur.', 2, 'equipement', 'Ressources et Craft › Pièces élémentaires › AG110:AM116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:corruption', 'Léger', 'magies/magie-de-la-corruption', 'CORRUPTION', 'Garde corrompue', 4, 6, '- +1 cran de résistance à l''Arcane
- +6 dégâts avec les sorts de Corruption
- L''armure donne 2 corruption à celui qui porte un coup au porteur (au cac uniquement)', 3, 'equipement', 'Ressources et Craft › Pièces élémentaires › AO110:AU116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:eau', 'Léger', 'magies/magie-de-leau', 'EAU', 'Garde pluie', 4, 6, '- +1 cran de résistance à l''Eau
- +6 dégâts avec les sorts de l''Eau
- (Choix possible) (actif) Invoque la météo "Pluie" ou "Pluie diluvienne" dès le début du combat. Dure 3 tours.', 8, 'equipement', 'Ressources et Craft › Pièces élémentaires › CC110:CI116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:espace-temps', 'Léger', 'magies/magie-de-lespace-temps', 'ESPACE/TEMPS', 'Garde horloge', 3, 7, '- +1 cran de résistance à l''Espace/Temps
- +6 dégâts avec les sorts de l''Espace/Temps
- (Réaction) Permet de faire revenir l''armure entière dans un état antérieur (récupération d''un cran de solidité) 1 fois par semaine', 4, 'equipement', 'Ressources et Craft › Pièces élémentaires › AW110:BC116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:feu', 'Léger', 'magies/magie-du-feu', 'FEU', 'Garde braise', 5, 5, '- +1 cran de résistance au Feu
- +6 dégâts avec les sorts de Feu
- Réduit de 1 la résistance au feu des ennemis dans un rayon de 3 cases (casse l''immunité)', 7, 'equipement', 'Ressources et Craft › Pièces élémentaires › BU110:CA116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:foudre', 'Léger', 'magies/magie-de-la-foudre', 'FOUDRE', 'Garde survoltée', 6, 4, '- +1 cran de résistance au Foudre
- +6 dégâts avec les sorts de Foudre
- Permet de lancer les sorts "Nerveux" et "Chargeur" sans avoir besoin de les mettre dans les emplacements de sorts.', 12, 'equipement', 'Ressources et Craft › Pièces élémentaires › DI110:DO116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:glace', 'Léger', 'magies/magie-de-la-glace', 'GLACE', 'Garde polaire', 2, 8, '- +1 cran de résistance à la Glace
- +6 dégâts avec les sorts de Glace
- Au bout de 3 coups subis, l''armure invoque au choix entre "Neige" ou "Tempête de neige"', 9, 'equipement', 'Ressources et Craft › Pièces élémentaires › CK110:CQ116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:lumiere', 'Léger', 'magies/magie-de-la-lumiere', 'LUMIÈRE', 'Garde éclatante', 4, 6, '- +1 cran de résistance de la Lumière
- +6 dégâts avec les sorts de la Lumière
- Le porteur obtient un champ de force qui bloque 10 dégâts au début de son tour pour chaque ennemi adjacent à lui', 13, 'equipement', 'Ressources et Craft › Pièces élémentaires › DQ110:DW116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:necromancie', 'Léger', 'magies/magie-de-la-necromancie', 'NÉCROMANCIE', 'Garde Carcasse', 3, 7, '- +1 cran de résistance à la Nécromancie
- +6 dégâts avec les sorts de Nécromancie
- Permet avec le sort "animation de mort" d''invoquer directement le Squelette venin au lieu du Zombi.', 6, 'equipement', 'Ressources et Craft › Pièces élémentaires › BM110:BS116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:ombre', 'Léger', 'magies/magie-de-lombre', 'OMBRE', 'Garde obscurcissante', 6, 4, '- +1 cran de résistance de l''Ombre
- +6 dégâts avec les sorts de l''Ombre
- Avantage sur les jets de Ruse (Sauf quand ça concerne le crochetage)', 14, 'equipement', 'Ressources et Craft › Pièces élémentaires › DY110:EE116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:sang', 'Léger', 'magies/magie-du-sang', 'SANG', 'Garde coeur', 7, 3, '- +1 cran de résistance au Sang
- +6 dégâts avec les sorts de Sang
- Si un coup encaissé inflige 25% ou plus de la santé max = Double AP et AM (armure+base) pour le prochain tour. (non cumulable)', 1, 'equipement', 'Ressources et Craft › Pièces élémentaires › Y110:AE116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:terre', 'Léger', 'magies/magie-de-la-terre', 'TERRE', 'Garde-terre', 8, 2, '- +1 cran de résistance à la Terre
- +6 dégâts avec les sorts à la Terre
- Permet avec le sort "invocation de golem" d''invoquer directement le Golem de verre au lieu du Golem de pain.', 10, 'equipement', 'Ressources et Craft › Pièces élémentaires › CS110:CY116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:vent', 'Léger', 'magies/magie-du-vent', 'VENT', 'Garde fœhn', 5, 5, '- +1 cran de résistance au Vent
- +6 dégâts avec les sorts de Vent
- (Choix possible) (actif) Invoque la météo "Vent Violent" dès le début du combat. Dure 3 tours.', 11, 'equipement', 'Ressources et Craft › Pièces élémentaires › DA110:DG116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:leger:vide', 'Léger', 'magies/magie-du-vide', 'VIDE', 'Garde privative', 7, 3, '- +1 cran de résistance au Vide
- +6 dégâts avec les sorts de Vide
- Si un sort est encaissé, bloque l''utilisation de ce sort pendant 1 tour.', 5, 'equipement', 'Ressources et Craft › Pièces élémentaires › BE110:BK116', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:arcane', 'Lourd', 'magies/magie-de-larcane', 'ARCANE', 'Rempart de l''origine', 10, 20, '- +1 cran de résistance à la Corruption
- +2 dégâts avec les sorts d''Arcane
- Sur une parade critique, renvoie l''intégralité du sort au lanceur', 2, 'equipement', 'Ressources et Craft › Pièces élémentaires › AG132:AM138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:corruption', 'Lourd', 'magies/magie-de-la-corruption', 'CORRUPTION', 'Rempart de la finalité', 11, 19, '- +1 cran de résistance à l''Arcane
- +2 dégâts avec les sorts de Corruption
- Un ennemi qui porte un coup au cac sur l''armure va changer aléatoirement de posture après son coup.', 3, 'equipement', 'Ressources et Craft › Pièces élémentaires › AO132:AU138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:eau', 'Lourd', 'magies/magie-de-leau', 'EAU', 'Rempart de l''océan', 12, 18, '- +1 cran de résistance à l''Eau
- +2 dégâts avec les sorts de l''Eau
- Permet de nager avec l''armure lourde, +4 dégâts physiques dans l''eau.', 8, 'equipement', 'Ressources et Craft › Pièces élémentaires › CC132:CI138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:espace-temps', 'Lourd', 'magies/magie-de-lespace-temps', 'ESPACE/TEMPS', 'Rempart de la faille', 10, 20, '- +1 cran de résistance à l''Espace/Temps
- +2 dégâts avec les sorts de l''Espace/Temps
- Lance 2 initiatives, garde le résultat au choix', 4, 'equipement', 'Ressources et Craft › Pièces élémentaires › AW132:BC138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:feu', 'Lourd', 'magies/magie-du-feu', 'FEU', 'Rempart de l''embraseur', 15, 15, '- +1 cran de résistance au Feu
- +2 dégâts avec les sorts de Feu
- Permet de récupérer 2d6 santé (ou chakra) lorsque l’on se trouve dans un endroit chaud ou durant les météos qui amplifient le feu.', 7, 'equipement', 'Ressources et Craft › Pièces élémentaires › BU132:CA138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:foudre', 'Lourd', 'magies/magie-de-la-foudre', 'FOUDRE', 'Rempart de la fulgurance', 18, 12, '- +1 cran de résistance au Foudre
- +2 dégâts avec les sorts de Foudre
- Si l''ennemi fait 90 ou plus sur son jet d''attaque avec une arme de corps à corps = Paralysie 1 non esquivable.', 12, 'equipement', 'Ressources et Craft › Pièces élémentaires › DI132:DO138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:glace', 'Lourd', 'magies/magie-de-la-glace', 'GLACE', 'Rempart de l''iceberg', 6, 24, '- +1 cran de résistance à la Glace
- +2 dégâts avec les sorts de Glace
- (Action) Crée un sol gelé sur 5 cases autour du lanceur, oblige un jet de Stabilité/Réflexe pour ne pas tomber et perdre son déplacement (sauf ceux de la glace)', 9, 'equipement', 'Ressources et Craft › Pièces élémentaires › CK132:CQ138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:lumiere', 'Lourd', 'magies/magie-de-la-lumiere', 'LUMIÈRE', 'Rempart de l''aube', 12, 18, '- +1 cran de résistance de la Lumière
- +2 dégâts avec les sorts de la Lumière
- Au bout de 3 coups subis, l''armure invoque la météo "Grand Soleil" . Dure 3 tours.', 13, 'equipement', 'Ressources et Craft › Pièces élémentaires › DQ132:DW138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:necromancie', 'Lourd', 'magies/magie-de-la-necromancie', 'NÉCROMANCIE', 'Rempart de l''âme', 15, 15, '- +1 cran de résistance à la Nécromancie
- +2 dégâts avec les sorts de Nécromancie
- Augmente de 2 le maximum d''âmes', 6, 'equipement', 'Ressources et Craft › Pièces élémentaires › BM132:BS138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:ombre', 'Lourd', 'magies/magie-de-lombre', 'OMBRE', 'Rempart de la nuit', 18, 12, '- +1 cran de résistance de l''Ombre
- +2 dégâts avec les sorts de l''Ombre
- Au bout de 3 coups subis, l''armure invoque la météo "Brouillard obscur" . Dure 3 tours.', 14, 'equipement', 'Ressources et Craft › Pièces élémentaires › DY132:EE138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:sang', 'Lourd', 'magies/magie-du-sang', 'SANG', 'Rempart de l''artère', 18, 12, '- +1 cran de résistance au Sang
- +2 dégâts avec les sorts de Sang
- Réduit de 1 tour les altérations d''états qui demandent la vigueur pour être contrées.', 1, 'equipement', 'Ressources et Craft › Pièces élémentaires › Y132:AE138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:terre', 'Lourd', 'magies/magie-de-la-terre', 'TERRE', 'Rempart de l''abîme', 24, 6, '- +1 cran de résistance à la Terre
- +2 dégâts avec les sorts à la Terre
- Quand un sort de la terre est réussi, l''AP de l''armure augmente de 3 pendant 1 tour (non cumulable)', 10, 'equipement', 'Ressources et Craft › Pièces élémentaires › CS132:CY138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:vent', 'Lourd', 'magies/magie-du-vent', 'VENT', 'Rempart de la rafale', 15, 15, '- +1 cran de résistance au Vent
- +2 dégâts avec les sorts de Vent
- Réduit de moitié les dégâts de chute et crée une explosion en zone de 3x3 lors d''un atterrissage faisant 2d8 de dégâts et repousse de 1 case si jet d''Athlétisme/Équilibre raté.', 11, 'equipement', 'Ressources et Craft › Pièces élémentaires › DA132:DG138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:lourd:vide', 'Lourd', 'magies/magie-du-vide', 'VIDE', 'Rempart de la connaissance', 20, 10, '- +1 cran de résistance au Vide
- +2 dégâts avec les sorts de Vide
- Si le porteur subit un coup critique, une "Zone Vide" se crée à 5 cases du lanceur pendant 1 tour.', 5, 'equipement', 'Ressources et Craft › Pièces élémentaires › BE132:BK138', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:arcane', 'Vêtement', 'magies/magie-de-larcane', 'ARCANE', 'Tissu du commencement', 0, 2, '- +1 cran de résistance à la Corruption
- +8 dégâts avec les sorts d''Arcane
- Si un ennemi arrive au CAC du porteur, invoque le sort "Champ gardien" pour un coût réduit de moitié (Réaction - 1 fois/tour)', 2, 'equipement', 'Ressources et Craft › Pièces élémentaires › AG99:AM105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:corruption', 'Vêtement', 'magies/magie-de-la-corruption', 'CORRUPTION', 'Tissu du témoin', 0, 2, '- +1 cran de résistance à l''Arcane
- +8 dégâts avec les sorts de Corruption
- Chaque attaque au corps à corps portée par le porteur va obliger la cible à fuir le porteur à hauteur de la moitié de son déplacement.', 3, 'equipement', 'Ressources et Craft › Pièces élémentaires › AO99:AU105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:eau', 'Vêtement', 'magies/magie-de-leau', 'EAU', 'Tissu du lac', 0, 2, '- +1 cran de résistance à l''Eau
- +8 dégâts avec les sorts de l''Eau
- Régénère 2d6 santé tous les 2 tours.', 8, 'equipement', 'Ressources et Craft › Pièces élémentaires › CC99:CI105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:espace-temps', 'Vêtement', 'magies/magie-de-lespace-temps', 'ESPACE/TEMPS', 'Tissu du paradoxe', 0, 2, '- +1 cran de résistance à l''Espace/Temps
- +8 dégâts avec les sorts de l''Espace/Temps
- Permet d''avoir une parade/esquive supplémentaire par tour (sauf en offensif)', 4, 'equipement', 'Ressources et Craft › Pièces élémentaires › AW99:BC105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:feu', 'Vêtement', 'magies/magie-du-feu', 'FEU', 'Tissu du chaud', 1, 1, '- +1 cran de résistance au Feu
- +8 dégâts avec les sorts de Feu
- Si l’ennemi est à une case, elle obligera un jet de vigueur à chaque tour, si jet raté inflige brûlure 2.', 7, 'equipement', 'Ressources et Craft › Pièces élémentaires › BU99:CA105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:foudre', 'Vêtement', 'magies/magie-de-la-foudre', 'FOUDRE', 'Tissu du foudroyant', 2, 0, '- +1 cran de résistance au Foudre
- +8 dégâts avec les sorts de Foudre
- Donne 4 initiative au prochain tour si un sort de foudre a été lancé ou tenté', 12, 'equipement', 'Ressources et Craft › Pièces élémentaires › DI99:DO105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:glace', 'Vêtement', 'magies/magie-de-la-glace', 'GLACE', 'Tissu du froid', 0, 2, '- +1 cran de résistance à la Glace
- +8 dégâts avec les sorts de Glace
- +1 cran de résistance au Feu et immunité à la brûlure', 9, 'equipement', 'Ressources et Craft › Pièces élémentaires › CK99:CQ105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:lumiere', 'Vêtement', 'magies/magie-de-la-lumiere', 'LUMIÈRE', 'Tissu du jour', 1, 1, '- +1 cran de résistance de la Lumière
- +8 dégâts avec les sorts de la Lumière
- Si un adversaire reste 2 tours ou plus sur une case adjacente du porteur, il prend "Aveuglement 3" (incontrable)', 13, 'equipement', 'Ressources et Craft › Pièces élémentaires › DQ99:DW105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:necromancie', 'Vêtement', 'magies/magie-de-la-necromancie', 'NÉCROMANCIE', 'Tissu du défunt', 0, 2, '- +1 cran de résistance à la Nécromancie
- +8 dégâts avec les sorts de Nécromancie
- Récupère 3 âmes par tour au lieu de 1.', 6, 'equipement', 'Ressources et Craft › Pièces élémentaires › BM99:BS105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:ombre', 'Vêtement', 'magies/magie-de-lombre', 'OMBRE', 'Tissu du crépuscule', 1, 1, '- +1 cran de résistance de l''Ombre
- +8 dégâts avec les sorts de l''Ombre
- Tous les dégâts qui sont infligés au porteur perdent 1d.', 14, 'equipement', 'Ressources et Craft › Pièces élémentaires › DY99:EE105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:sang', 'Vêtement', 'magies/magie-du-sang', 'SANG', 'Tissu du saigneur', 2, 0, '- +1 cran de résistance au Sang
- +8 dégâts avec les sorts de Sang
- Le maximum de sang augmente de 5.', 1, 'equipement', 'Ressources et Craft › Pièces élémentaires › Y99:AE105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:terre', 'Vêtement', 'magies/magie-de-la-terre', 'TERRE', 'Tissu du feuillage', 2, 0, '- +1 cran de résistance à la Terre
- +8 dégâts avec les sorts à la Terre
- Augmente l''AP, l''AM et les dégâts de 4 en forêt.', 10, 'equipement', 'Ressources et Craft › Pièces élémentaires › CS99:CY105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:vent', 'Vêtement', 'magies/magie-du-vent', 'VENT', 'Tissu du moulin', 1, 1, '- +1 cran de résistance au Vent
- +8 dégâts avec les sorts de Vent
- Les sorts de placement du Vent voient leur portée augmentée de 2.', 11, 'equipement', 'Ressources et Craft › Pièces élémentaires › DA99:DG105', NULL);
INSERT INTO armure_elementaire (id, categorie, magie_id, colonne_brut, nom, ap, am, effets_brut, ordre, origine, source_ref, remarque) VALUES ('ressources/pieces-elementaires#armure-elementaire:vetement:vide', 'Vêtement', 'magies/magie-du-vide', 'VIDE', 'Tissu du néant', 2, 0, '- +1 cran de résistance au Vide
- +8 dégâts avec les sorts de Vide
- (Action) Permet au porteur de devenir Insensible pendant 3 tours, aucun sort positif/négatif/offensif ne peut le toucher, prendre un coup physique annule l''effet.', 5, 'equipement', 'Ressources et Craft › Pièces élémentaires › BE99:BK105', NULL);

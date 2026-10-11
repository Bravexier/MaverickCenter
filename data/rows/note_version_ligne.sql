-- data/rows/note_version_ligne.sql : export déterministe, une instruction par ligne, triée par (version, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 1, 'sorts', 'Arcane', 'Foudre argentée', 'Nom', 'modifie', 'Foudre argenté', 'Foudre argentée', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:foudre-argente"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 2, 'sorts', 'Corruption', 'Verrouillage Visible', 'Nom', 'modifie', 'Verrouille Visible', 'Verrouillage Visible', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:verrouille-visible"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 3, 'sorts', 'Espace/Temps', 'Chute', 'Effets secondaires', 'modifie', 'Invoque un mini portail en dessous d''un objet TP ou P et la fait tomber sur la cible.', 'Invoque un mini portail en dessous d''un objet TP ou P et le fait tomber sur la cible.', 'neutre', '[{"partie":"valeur","avant":"Invoque un mini portail en dessous d''un objet TP ou P et la fait tomber sur la cible.","apres":"Invoque un mini portail en dessous d''un objet TP ou P et le fait tomber sur la cible.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lespace-temps#sort:chute"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 4, 'sorts', 'Vide', 'Toucher du Vide', 'Nom', 'modifie', 'Touché du Vide', 'Toucher du Vide', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vide#sort:touche-du-vide"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 5, 'sorts', 'Nécromancie', 'Vague de cadavres', 'Nom', 'modifie', 'Vague de cadavre', 'Vague de cadavres', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:vague-de-cadavre"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 6, 'sorts', 'Nécromancie', 'Vague de cadavres', 'Effets secondaires', 'modifie', 'Invoque une vague de cadavre qui va s’écraser sur l''ennemi. Si jet de vigueur raté = Inflige Empoisonné stade 1.', 'Invoque une vague de cadavres qui va s’écraser sur l''ennemi. Si jet de vigueur raté = Inflige Empoisonné stade 1.', 'neutre', '[{"partie":"valeur","avant":"Invoque une vague de cadavre qui va s’écraser sur l''ennemi.","apres":"Invoque une vague de cadavres qui va s’écraser sur l''ennemi.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:vague-de-cadavre"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 7, 'sorts', 'Nécromancie', 'Cimetière ouvert', 'Effets secondaires', 'modifie', 'Invoque la météo "Purée de poix" pendant 3 tours (+1/NM).', 'Invoque la météo "Purée de pois" pendant 3 tours (+1/NM).', 'neutre', '[{"partie":"valeur","avant":"Invoque la météo \"Purée de poix\" pendant 3 tours (+1/NM).","apres":"Invoque la météo \"Purée de pois\" pendant 3 tours (+1/NM).","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:cimetiere-ouvert"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 8, 'sorts', 'Nécromancie', 'Répar''Os', 'Nom', 'modifie', 'Répar Os', 'Répar''Os', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:repar-os"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 9, 'sorts', 'Nécromancie', 'Résurrection Noire', 'Nom', 'modifie', 'Résurrection Noir', 'Résurrection Noire', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:resurrection-noir"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 10, 'sorts', 'Eau', 'Onde de Confusion', 'Nom', 'modifie', 'Onde Confusion', 'Onde de Confusion', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-leau#sort:onde-confusion"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 11, 'sorts', 'Eau', 'Larmes d''Océane', 'Remarque', 'modifie', 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatospetique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.', 'Cette météo ne peut pas être retirée par les autres météos ou bien les effets de classes.
Le Don "Climatosceptique" ne peut pas contrer cet effet.
Cet effet dure maximum 5 tours.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-leau#sort:larmes-doceane"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 12, 'sorts', 'Terre', 'Lance-pierre', 'Nom', 'modifie', 'Lance Pierre', 'Lance-pierre', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-terre#sort:lance-pierre"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 13, 'sorts', 'Terre', 'Rédemption de Dimitri', 'Effets secondaires', 'modifie', 'Invoque la météo "tempête sable" ou "champ magnétique" pendant 3 tours (+1/NM).', 'Invoque la météo "tempête de sable" ou "champ magnétique" pendant 3 tours (+1/NM).', 'neutre', '[{"partie":"valeur","avant":"Invoque la météo \"tempête sable\" ou \"champ magnétique\" pendant 3 tours (+1/NM).","apres":"Invoque la météo \"tempête de sable\" ou \"champ magnétique\" pendant 3 tours (+1/NM).","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-terre#sort:redemption-de-dimitri"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 14, 'sorts', 'Vent', 'Estoc hurlant', 'Nom', 'modifie', 'Estoc hurlante', 'Estoc hurlant', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vent#sort:estoc-hurlante"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 15, 'sorts', 'Foudre', 'Colonne Tesla', 'Nom', 'modifie', 'Colonne tesla', 'Colonne Tesla', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-foudre#sort:colonne-tesla"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 16, 'sorts', 'Foudre', 'Colonne Tesla', 'Effets secondaires', 'modifie', 'Donne la propriété « para-tonnerre » à une cible.', 'Donne la propriété « paratonnerre » à une cible.', 'neutre', '[{"partie":"valeur","avant":"Donne la propriété « para-tonnerre » à une cible.","apres":"Donne la propriété « paratonnerre » à une cible.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-foudre#sort:colonne-tesla"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 17, 'sorts', 'Foudre', 'Colonne Tesla', 'Remarque', 'modifie', 'Para-tonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)', 'Paratonnerre : Attire les sorts de la foudre ou bien la foudre naturelle sur la cible (objet ou créature)', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-foudre#sort:colonne-tesla"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 18, 'sorts', 'Ombre', 'Brume mentale', 'Nom', 'modifie', 'Brume mental', 'Brume mentale', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lombre#sort:brume-mental"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 19, 'magies', 'Potentiel Illimité', 'Potentiel Illimité', 'Description physique', 'modifie', 'Des yeux dorés/oranges, ainsi que des mèches dorées. Le corps est parsemé de tatouages couleur orange qui deviennent dorés quand un sort est utilisé, plus il y a de puissance, plus les cicatrices brillent. Ils ont des physiques moins charnus que la plupart des gens et ils semblent tout le temps épuisés.', 'Des yeux dorés/orange, ainsi que des mèches dorées. Le corps est parsemé de tatouages couleur orange qui deviennent dorés quand un sort est utilisé, plus il y a de puissance, plus les cicatrices brillent. Ils ont des physiques moins charnus que la plupart des gens et ils semblent tout le temps épuisés.', 'neutre', NULL, 'magie', '{"id":"magies/potentiel-illimite"}', 'description_physique');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 20, 'classes', 'Guerrier', 'Guerrier', 'Présentation', 'modifie', 'Le Guerrier est un combattant aguerri, maître des armes tranchantes. Endurant et résistant, il excelle dans les affrontements de mêlée grâce à son équipement robuste et sa force. 

Son entraînement lui confère une meilleure maîtrise de ses armes, augmentant sa précision et ses dégâts. Face au danger, il reste inébranlable, totalement insensible à la couardise. Son rôle est d’être le premier en ligne, faire des trous dans les lignes ennemis.', 'Le Guerrier est un combattant aguerri, maître des armes tranchantes. Endurant et résistant, il excelle dans les affrontements de mêlée grâce à son équipement robuste et sa force. 

Son entraînement lui confère une meilleure maîtrise de ses armes, augmentant sa précision et ses dégâts. Face au danger, il reste inébranlable, totalement insensible à la couardise. Son rôle est d’être le premier en ligne, faire des trous dans les lignes ennemies.', 'neutre', NULL, 'classe', '{"id":"classes/guerrier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 21, 'classes', 'Guerrier', 'Guerrier', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, KDR Arme, torche, remède fatigue M,  pierre à aiguisé', 'P fiole rouge, KDR Arme, torche, remède fatigue M,  pierre à aiguiser', 'neutre', NULL, 'classe', '{"id":"classes/guerrier"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 22, 'classes', 'Guerrier', 'Spécialité ÉPÉISTE', 'Description', 'modifie', 'L''Épéiste est un maître des lames, ayant abandonné la hache pour perfectionner son art du combat rapide et précis. Grâce à son entraînement rigoureux, il manie épées et dagues avec une habileté mortelle.. Face à un adversaire unique, il excelle dans son domaine.

Sa discipline lui permet d’infliger des coups dévastateurs et d’exploiter les ouvertures dans la défense ennemie ou bien d''exploiter avec efficacité la technique du Mordhau, sans abîmé son épée. Adapté aux duels comme aux batailles rangées, il domine son opposant par la technique et l’anticipation.', 'L''Épéiste est un maître des lames, ayant abandonné la hache pour perfectionner son art du combat rapide et précis. Grâce à son entraînement rigoureux, il manie épées et dagues avec une habileté mortelle.. Face à un adversaire unique, il excelle dans son domaine.

Sa discipline lui permet d’infliger des coups dévastateurs et d’exploiter les ouvertures dans la défense ennemie ou bien d''exploiter avec efficacité la technique du Mordhau, sans abîmer son épée. Adapté aux duels comme aux batailles rangées, il domine son opposant par la technique et l’anticipation.', 'neutre', NULL, 'specialite', '{"id":"classes/guerrier#specialite:epeiste"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 23, 'classes', 'Guerrier', 'Don Contact', 'Effet', 'modifie', 'Donne +5% d''acquis au Compétence Arme Légère, Arme Lourde et augmente les dégâts de 3.', 'Donne +5% d''acquis aux Compétences Arme Légère, Arme Lourde et augmente les dégâts de 3.', 'neutre', NULL, 'capacite', '{"id":"capacites/guerrier-contact"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 24, 'classes', 'Guerrier', 'Don Brave', 'Effet', 'modifie', 'Totalement immunisé à l''atération d''état "Couardise"', 'Totalement immunisé à l''altération d''état "Couardise"', 'neutre', NULL, 'capacite', '{"id":"capacites/guerrier-brave"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 25, 'classes', 'Guerrier', 'Don MAÎTRE D''ARME › Maître d''arme', 'Effet', 'modifie', '+5% Armes légeres et lourde, +5 points de maîtrise d''arme à répartir (Pas plus de 2 points de maîtrise réparti dans la même catégorie), Maîtrise les armures lourdes.', '+5% Armes légères et lourdes, +5 points de maîtrise d''arme à répartir (Pas plus de 2 points de maîtrise répartis dans la même catégorie), Maîtrise les armures lourdes.', 'neutre', NULL, 'capacite', '{"id":"capacites/guerrier-maitre-darme"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 26, 'classes', 'Guerrier', 'Don MAÎTRE D''ARME › Contrecoup', 'Nom', 'modifie', 'Contre coup', 'Contrecoup', 'neutre', NULL, 'capacite', '{"id":"capacites/guerrier-contre-coup"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 27, 'classes', 'Guerrier', 'Don ÉPÉISTE › Tout ou rien', 'Effet', 'modifie', 'Augmente de +5% la réussite critique et les dégâts de +5 mais augmente de +5% l''echec critique. Dure un tour.', 'Augmente de +5% la réussite critique et les dégâts de +5 mais augmente de +5% l''échec critique. Dure un tour.', 'neutre', NULL, 'capacite', '{"id":"capacites/guerrier-tout-ou-rien"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 28, 'classes', 'Cuirassé', 'Cuirassé', 'Chose à savoir', 'modifie', 'PROTECTEUR : Le bouclier peut être utiliser comme arme, si jamais vous attaquez avec votre arme principal et que vous enchaîner avec le bouclier, ce dernier fera les dégâts minimum (même en offensif)', 'PROTECTEUR : Le bouclier peut être utilisé comme arme, si jamais vous attaquez avec votre arme principale et que vous enchaînez avec le bouclier, ce dernier fera les dégâts minimum (même en offensif)', 'neutre', NULL, 'classe', '{"id":"classes/cuirasse"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 29, 'classes', 'Cuirassé', 'Don PROTECTEUR › Protecteur', 'Effet', 'modifie', '+10% à la parade, +5% Arme lourde, Les boucliers sont considérés comme des Pugilats et inflige un bonus de 4 dégâts, 2 points de maîtrise à répartir.', '+10% à la parade, +5% Arme lourde, Les boucliers sont considérés comme des Pugilats et infligent un bonus de 4 dégâts, 2 points de maîtrise à répartir.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-protecteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 30, 'classes', 'Cuirassé', 'Don VINDICATIF › Vindicatif', 'Effet', 'modifie', '+5% à la Diplomatie, Intimidation, Arme Lourde. 2 points de maîtrise à répartir, L''armure lourde ne ralentie plus.', '+5% à la Diplomatie, Intimidation, Arme Lourde. 2 points de maîtrise à répartir, L''armure lourde ne ralentit plus.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-vindicatif"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 31, 'classes', 'Cuirassé', 'Don PROTECTEUR › Nanochakra', 'Effet', 'modifie', 'Chaque attaque ennemi bloquée completement permet de récupérer 1d8 santé.', 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-nanochakra"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 32, 'classes', 'Cuirassé', 'Don PROTECTEUR › NOPE !', 'Effet', 'modifie', 'Permet de faire un jet d''atlhétisme pour empêcher à une cible de lancer un sort alors qu''il est dans la zone d''influence.', 'Permet de faire un jet d''athlétisme pour empêcher à une cible de lancer un sort alors qu''il est dans la zone d''influence.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-nope"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 33, 'classes', 'Cuirassé', 'Don PROTECTEUR › Tu passes pas !', 'Nom', 'modifie', 'Tu passe pas !', 'Tu passes pas !', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-tu-passe-pas"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 34, 'classes', 'Cuirassé', 'Don PROTECTEUR › Muraille', 'Effet', 'modifie', 'Permet de bloquer complètement une attaque physique ou magique. Peut être utiliser dans le cas d''un jet raté (critique aussi)', 'Permet de bloquer complètement une attaque physique ou magique. Peut être utilisé dans le cas d''un jet raté (critique aussi)', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-muraille"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 35, 'classes', 'Cuirassé', 'Don VINDICATIF › Vendetta', 'Effet', 'modifie', '+5 au dégâts, +1 vitesse par allié au sol (max 3 accumulation). Les bonus partent quand les alliés reviennent.', '+5 aux dégâts, +1 vitesse par allié au sol (max 3 accumulations). Les bonus partent quand les alliés reviennent.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-vendetta"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 36, 'classes', 'Cuirassé', 'Don VINDICATIF › Dernier souffle', 'Effet', 'modifie', 'Quand un adversaire fait tomber les pv entre 0 et 5, contre attaque possible avec +10 aux dégâts.', 'Quand un adversaire fait tomber les pv entre 0 et 5, contre-attaque possible avec +10 aux dégâts.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-dernier-souffle"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 37, 'classes', 'Cuirassé', 'Don Égide', 'Nom', 'modifie', 'Egide', 'Égide', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-egide"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 38, 'classes', 'Cuirassé', 'Don Égide', 'Effet', 'modifie', 'Permet de survivre à 1 santé contre une attaque qui est censé vous mettre dans le coma.', 'Permet de survivre à 1 santé contre une attaque qui est censée vous mettre dans le coma.', 'neutre', NULL, 'capacite', '{"id":"capacites/cuirasse-egide"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 39, 'classes', 'Lancier', 'Lancier', 'Présentation', 'modifie', 'Le Lancier est un combattant méthodique, spécialiste des armes d’hast et de jet. Grace à son arme longue, il maintient ses adversaires à distance tout en profitant de sa mobilité pour se défendre et riposter. 

Son expertise lui permet d’attaquer avec précision, aussi bien en mêlée qu’à portée, sans perdre en efficacité. Grâce à son armure intermédiaire, il trouve un équilibre entre défense et vitesse, lui permettant d''exceller dans les combats prolongés. Il saura sanctionner ceux qui seront trop insolant contre lui.', 'Le Lancier est un combattant méthodique, spécialiste des armes d’hast et de jet. Grâce à son arme longue, il maintient ses adversaires à distance tout en profitant de sa mobilité pour se défendre et riposter. 

Son expertise lui permet d’attaquer avec précision, aussi bien en mêlée qu’à portée, sans perdre en efficacité. Grâce à son armure intermédiaire, il trouve un équilibre entre défense et vitesse, lui permettant d''exceller dans les combats prolongés. Il saura sanctionner ceux qui seront trop insolents contre lui.', 'neutre', NULL, 'classe', '{"id":"classes/lancier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 40, 'classes', 'Lancier', 'Spécialité MYRMIDON', 'Description', 'modifie', 'Le Myrmidon est un guerrier versatile. Grâce à son entraînement physique poussé, il se déplace avec fluidité sur le champ de bataille, bondissant sur ses ennemis pour des frappes précises et puissantes. 

Capable d’ignorer les potentiels boucliers adverse et d’exploiter chaque ouverture, il allie mobilité et agressivité. Son style de combat lui permet d’interrompre l’élan de ses adversaires et de riposter instantanément.', 'Le Myrmidon est un guerrier versatile. Grâce à son entraînement physique poussé, il se déplace avec fluidité sur le champ de bataille, bondissant sur ses ennemis pour des frappes précises et puissantes. 

Capable d’ignorer les potentiels boucliers adverses et d’exploiter chaque ouverture, il allie mobilité et agressivité. Son style de combat lui permet d’interrompre l’élan de ses adversaires et de riposter instantanément.', 'neutre', NULL, 'specialite', '{"id":"classes/lancier#specialite:myrmidon"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 41, 'classes', 'Lancier', 'Don Attaquant', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec des armes d''hast.
x = +2 dégâts/6 niveau de lancier.', 'Permet d''infliger 3+x dégâts avec des armes d''hast.
x = +2 dégâts/6 niveaux de lancier.', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-attaquant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 42, 'classes', 'Lancier', 'Don Anti-Contre', 'Effet', 'modifie', 'Permet d''annuler une contre attaque grâce à une arme à 2 de portée.', 'Permet d''annuler une contre-attaque grâce à une arme à 2 de portée.', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-anti-contre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 43, 'classes', 'Lancier', 'Don MAÎTRE D''HAST › Maître d''hast', 'Effet', 'modifie', '+2 point de maîtrise à répartir, +5% Arme Lourdes, +5% Stabilité, +5% Athlétisme, Peut porter une armure lourde.', '+2 points de maîtrise à répartir, +5% Arme Lourdes, +5% Stabilité, +5% Athlétisme, Peut porter une armure lourde.', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-maitre-dhast"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 44, 'classes', 'Lancier', 'Don MAÎTRE D''HAST › Tenir ...', 'Effet', 'modifie', 'Sacrifie son tour pour se mettre en position embuscade, permet d''attaquer une fois tous les ennenis qui rentre dans la zone. 2 PO', 'Sacrifie son tour pour se mettre en position embuscade, permet d''attaquer une fois tous les ennemis qui rentrent dans la zone. 2 PO', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-tenir"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 45, 'classes', 'Lancier', 'Don MAÎTRE D''HAST › ... ou charger ?', 'Effet', 'modifie', 'Permet d''attaquer après le sprint en ligne droite, inflige un bonus de +2 dégâts par case parcouru. L''armure ne ralenti pas lors de cette action.', 'Permet d''attaquer après le sprint en ligne droite, inflige un bonus de +2 dégâts par case parcourue. L''armure ne ralentit pas lors de cette action.', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-ou-charger"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 46, 'classes', 'Lancier', 'Don MAÎTRE D''HAST › ... Chargeur', 'Effet', 'modifie', 'Permet de faire +2 dégâts par cases parcourues en cas d''attaque charger sur monture.', 'Permet de faire +2 dégâts par case parcourue en cas d''attaque charger sur monture.', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-chargeur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 47, 'classes', 'Lancier', 'Don Riposte infinie', 'Nom', 'modifie', 'Riposte infini', 'Riposte infinie', 'neutre', NULL, 'capacite', '{"id":"capacites/lancier-riposte-infini"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 48, 'classes', 'Martiale', 'Martiale', 'Chose à savoir', 'modifie', 'Le gameplay de rage se retrouve aussi chez le Goleois, les effets positif et négatif se combine entre eux. Mais par contre la durée, elle, ne se cumule pas.', 'Le gameplay de rage se retrouve aussi chez le Goleois, les effets positif et négatif se combinent entre eux. Mais par contre la durée, elle, ne se cumule pas.', 'neutre', NULL, 'classe', '{"id":"classes/martiale"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 49, 'classes', 'Martiale', 'Martiale', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/martiale"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 50, 'classes', 'Martiale', 'Spécialité BERSERKER', 'Description', 'modifie', 'Le Berserker est un combattant sauvage qui canalise sa rage en une force destructrice inarrêtable. Contrairement aux autres guerriers, il peut prolonger son état de fureur par pure volonté, maintenant un état de combat frénétique plus longtemps. 

Chaque assaut renforce son élan, augmentant ses dégâts, sa vitesse ou sa résistance en fonction de sa frénésie. Insensible à la peur et au contrôle mental ou encore avoir une attaque de morsure du à cette quasi folie de guerre. Une fois déchaîné, il est à prendre au sérieux.', 'Le Berserker est un combattant sauvage qui canalise sa rage en une force destructrice inarrêtable. Contrairement aux autres guerriers, il peut prolonger son état de fureur par pure volonté, maintenant un état de combat frénétique plus longtemps. 

Chaque assaut renforce son élan, augmentant ses dégâts, sa vitesse ou sa résistance en fonction de sa frénésie. Insensible à la peur et au contrôle mental ou encore avoir une attaque de morsure du à cette quasi-folie de guerre. Une fois déchaîné, il est à prendre au sérieux.', 'neutre', NULL, 'specialite', '{"id":"classes/martiale#specialite:berserker"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 51, 'classes', 'Martiale', 'Don Rage', 'Effet', 'modifie', 'Active un pouvoir de rage qui augmente de +3 les dégâts et de +2 les dégâts subis pendant 3 tours + 1 tour tout les 5 niveaux de la classe', 'Active un pouvoir de rage qui augmente de +3 les dégâts et de +2 les dégâts subis pendant 3 tours + 1 tour tous les 5 niveaux de la classe', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-rage"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 52, 'classes', 'Martiale', 'Don HÉROS › Héros', 'Effet', 'modifie', '2 points de maîtrise à répartir, Peut porter les armures intermédiaire, Peut changer de posture tout le temps pendant son tour (demande un jet de calme à partir du deuxième changement)', '2 points de maîtrise à répartir, Peut porter les armures intermédiaires, Peut changer de posture tout le temps pendant son tour (demande un jet de calme à partir du deuxième changement)', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-heros"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 53, 'classes', 'Martiale', 'Don HÉROS › Matérialiste', 'Effet', 'modifie', '(Posture Symbiose)
Permet d''utilisé son arme dans cette posture et l''arme inflige les dégâts de la magie en symbiose.', '(Posture Symbiose)
Permet d''utiliser son arme dans cette posture et l''arme inflige les dégâts de la magie en symbiose.', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-materialiste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 54, 'classes', 'Martiale', 'Don BERSERKER › Rage prudente', 'Nom', 'modifie', 'Rage prudent', 'Rage prudente', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-rage-prudent"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 55, 'classes', 'Martiale', 'Don BERSERKER › Rage audacieuse', 'Nom', 'modifie', 'Rage audacieux', 'Rage audacieuse', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-rage-audacieux"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 56, 'classes', 'Martiale', 'Don BERSERKER › Rage audacieuse', 'Effet', 'modifie', '(Rage)
Augmente tout les dégâts de +5.', '(Rage)
Augmente tous les dégâts de +5.', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-rage-audacieux"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 57, 'classes', 'Martiale', 'Don HÉROS › Inéluctable', 'Effet', 'modifie', '(Posture Focus)
Ignore totalement les résistances aux dégâts physique (sauf immunité)', '(Posture Focus)
Ignore totalement les résistances aux dégâts physiques (sauf immunité)', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-ineluctable"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 58, 'classes', 'Martiale', 'Don HÉROS › Rose épineuse', 'Effet', 'modifie', '(Posture Défensif)
Permet d''effectuer des contres attaques en réussissant un jet de défense.', '(Posture Défensif)
Permet d''effectuer des contre-attaques en réussissant un jet de défense.', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-rose-epineuse"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 59, 'classes', 'Martiale', 'Don Force innée', 'Nom', 'modifie', 'Force inné', 'Force innée', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-force-inne"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 60, 'classes', 'Martiale', 'Don Force innée', 'Effet', 'modifie', '(Rage)
Converti sa caractéristique de Force x 3 en dégâts. (Ex : 3 de Force = +9 dégâts).', '(Rage)
Convertit sa caractéristique de Force x 3 en dégâts. (Ex : 3 de Force = +9 dégâts).', 'neutre', NULL, 'capacite', '{"id":"capacites/martiale-force-inne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 61, 'classes', 'Moine', 'Moine', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/moine"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 62, 'classes', 'Moine', 'Moine', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, P fiole jaune, KDR Arme, panacée mineur, corde (5m)', 'P fiole rouge, P fiole jaune, KDR Arme, panacée mineure, corde (5m)', 'neutre', NULL, 'classe', '{"id":"classes/moine"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 63, 'classes', 'Moine', 'Spécialité TEMPLIER', 'Description', 'modifie', 'Le Templier est un guerrier sacré, un rempart vivant dédié à l’ordre et à la justice. Protégé par son armure lourde et sa foi inébranlable, il traque les hérétiques et les ennemis de sa divinité avec une détermination innébranlable. 

Son entraînement lui permet d’exploiter les faiblesses des êtres bons ou mauvais selon ses croyances, renforçant ses frappes contre ceux qui s’opposent à son idéal. Maîtrisant les armes et armures comme un Guerrier, il combine puissance martiale et force psychologique pour dominer ses adversaires.', 'Le Templier est un guerrier sacré, un rempart vivant dédié à l’ordre et à la justice. Protégé par son armure lourde et sa foi inébranlable, il traque les hérétiques et les ennemis de sa divinité avec une détermination inébranlable. 

Son entraînement lui permet d’exploiter les faiblesses des êtres bons ou mauvais selon ses croyances, renforçant ses frappes contre ceux qui s’opposent à son idéal. Maîtrisant les armes et armures comme un Guerrier, il combine puissance martiale et force psychologique pour dominer ses adversaires.', 'neutre', NULL, 'specialite', '{"id":"classes/moine#specialite:templier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 64, 'classes', 'Moine', 'Don Reste en vie …', 'Effet', 'modifie', 'Les attaques infligent +2 de dégâts et sont capables d''être non-létaux.', 'Les attaques infligent +2 de dégâts et sont capables d''être non-létales.', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-reste-en-vie"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 65, 'classes', 'Moine', 'Don TEMPLIER › Templier', 'Effet', 'modifie', '+5% Intimidation, 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3). Maîtrise les 3 armures, les Bouclier 1 à 4, +2 points de maîtrise à répartir.', '+5% Intimidation, 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3). Maîtrise les 3 armures, les Boucliers 1 à 4, +2 points de maîtrise à répartir.', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-templier"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 66, 'classes', 'Moine', 'Don MOINE GUERRIER › Tu vivras …', 'Nom', 'modifie', 'Tu vivra …', 'Tu vivras …', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-tu-vivra"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 67, 'classes', 'Moine', 'Don TEMPLIER › … Menteur !', 'Effet', 'modifie', '+10% d''acquis à la compétences psychologie, le mensonge est plus facilement detectable.', '+10% d''acquis à la compétence psychologie, le mensonge est plus facilement détectable.', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-menteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 68, 'classes', 'Moine', 'Don MOINE GUERRIER › Prends ça …', 'Nom', 'modifie', 'Prend ça …', 'Prends ça …', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-prend-ca"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 69, 'classes', 'Moine', 'Don MOINE GUERRIER › … dans ta face !', 'Effet', 'modifie', 'Si la réussite est à 3 ou moins = Inflige 50% des pv actuel de l''adversaire. (choix possible)', 'Si la réussite est à 3 ou moins = Inflige 50% des pv actuels de l''adversaire. (choix possible)', 'neutre', NULL, 'capacite', '{"id":"capacites/moine-dans-ta-face"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 70, 'classes', 'Frappeur', 'Frappeur', 'Présentation', 'modifie', 'Le Frappeur est un expert des armes de frappe, spécialisé dans l’art de briser les défenses ennemies. Chaque coup qu’il porte à pour objectif de fissurer armures et os, rendant ses adversaires vulnérables aux assauts suivants. Il manie avec aisance masses, bâtons de combat ou même ses propres poings pour frapper avec force. 

Capable de sacrifier sa garde pour des frappes dévastatrices, il excelle dans les duels d’usure où sa puissance finit par l’emporter. Ne comptez pas trop sur votre armure contre un frappeur.', 'Le Frappeur est un expert des armes de frappe, spécialisé dans l’art de briser les défenses ennemies. Chaque coup qu’il porte a pour objectif de fissurer armures et os, rendant ses adversaires vulnérables aux assauts suivants. Il manie avec aisance masses, bâtons de combat ou même ses propres poings pour frapper avec force. 

Capable de sacrifier sa garde pour des frappes dévastatrices, il excelle dans les duels d’usure où sa puissance finit par l’emporter. Ne comptez pas trop sur votre armure contre un frappeur.', 'neutre', NULL, 'classe', '{"id":"classes/frappeur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 71, 'classes', 'Frappeur', 'Frappeur', 'Maîtrise des armes (une ligne « - » par maîtrise)', 'modifie', '- 2 maîtrise à répartir entre Masse, Pugilat, Bâton combat (1 maximum dans une seule)', '- 2 maîtrises à répartir entre Masse, Pugilat, Bâton combat (1 maximum dans une seule)', 'neutre', NULL, 'classe', '{"id":"classes/frappeur"}', 'maitrise_arme');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 72, 'classes', 'Frappeur', 'Frappeur', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/frappeur"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 73, 'classes', 'Frappeur', 'Spécialité CASSEUR', 'Description', 'modifie', 'Le Casseur est un spécialiste de la destruction des postures de combat, brisant l’équilibre et la concentration de ses adversaires avec des frappes calculées. Il ne se contente pas d’infliger des dégâts : chaque coup casse la posture de l''adversaire, le rendant totalement vulnérable contre d''autres ennemis potentiels.

Grâce à sa maîtrise des armes de frappe, il excelle contre les combattants les plus disciplinés, les réduisant à l’improvisation et à la vulnérabilité. Vous pensiez avoir une bonne stratégie ? Et bien pas contre lui.', 'Le Casseur est un spécialiste de la destruction des postures de combat, brisant l’équilibre et la concentration de ses adversaires avec des frappes calculées. Il ne se contente pas d’infliger des dégâts : chaque coup casse la posture de l''adversaire, le rendant totalement vulnérable contre d''autres ennemis potentiels.

Grâce à sa maîtrise des armes de frappe, il excelle contre les combattants les plus disciplinés, les réduisant à l’improvisation et à la vulnérabilité. Vous pensiez avoir une bonne stratégie ? Eh bien pas contre lui.', 'neutre', NULL, 'specialite', '{"id":"classes/frappeur#specialite:casseur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 74, 'classes', 'Frappeur', 'Don Passeur', 'Effet', 'modifie', 'Tout les dégâts de frappe perce 1d4 d''armure.', 'Tous les dégâts de frappe percent 1d4 d''armure.', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-passeur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 75, 'classes', 'Frappeur', 'Don Double Poing', 'Effet', 'modifie', 'Permet de sacrifier une parade pour infliger 50% de degat suplementaire sur 1 attaque (impossible en offensif)', 'Permet de sacrifier une parade pour infliger 50% de dégâts supplémentaires sur 1 attaque (impossible en offensif)', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-double-poing"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 76, 'classes', 'Frappeur', 'Don BRISEUR › Briseur', 'Effet', 'modifie', '2 point de maitrise a repartir, +10% Arme Lourde, +5% Vigueur, le perce armure passe à d6.', '2 points de maitrise à répartir, +10% Arme Lourde, +5% Vigueur, le perce armure passe à d6.', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-briseur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 77, 'classes', 'Frappeur', 'Don CASSEUR › Casseur', 'Effet', 'modifie', '2 point de maitrise a repartir, +10% Arme Lourde, +5% Fermeté.', '2 points de maitrise à répartir, +10% Arme Lourde, +5% Fermeté.', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-casseur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 78, 'classes', 'Frappeur', 'Don CASSEUR › Déconcentré', 'Nom', 'modifie', 'Deconcentré', 'Déconcentré', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-deconcentre"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 79, 'classes', 'Frappeur', 'Don CASSEUR › Déconcentré', 'Effet', 'modifie', '(Contre Focus) 
Inflige x dégâts supplémentaire et casse la posture* pour le tour.
x = Niveau Frappeur', '(Contre Focus) 
Inflige x dégâts supplémentaires et casse la posture* pour le tour.
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-deconcentre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 80, 'classes', 'Frappeur', 'Don BRISEUR › ... Sans-Frontière', 'Effet', 'modifie', 'Permet de repousser ou trainé un adversaire hors de la zone d''influence. Uniquement au corps à corps.', 'Permet de repousser ou trainer un adversaire hors de la zone d''influence. Uniquement au corps à corps.', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-sans-frontiere"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 81, 'classes', 'Frappeur', 'Don CASSEUR › Distracteur', 'Effet', 'modifie', '(Contre Vigilence)
Inflige x dégâts supplémentaire et casse la posture* pour le tour. 
x = Niveau Frappeur', '(Contre Vigilance)
Inflige x dégâts supplémentaires et casse la posture* pour le tour. 
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-distracteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 82, 'classes', 'Frappeur', 'Don CASSEUR › Asymbiotique', 'Effet', 'modifie', '(Contre Symbiose)
Inflige x dégâts supplémentaire et casse la posture* pour le tour. 
x = Niveau Frappeud', '(Contre Symbiose)
Inflige x dégâts supplémentaires et casse la posture* pour le tour. 
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-asymbiotique"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 83, 'classes', 'Frappeur', 'Don BRISEUR › Anti-Arme', 'Effet', 'modifie', 'La prochaine attaque va faire perdre un cran de solidité à l''arme de cible (si l''attaque réussi et même si l''adversaire fait une parade ou esquive partiel)', 'La prochaine attaque va faire perdre un cran de solidité à l''arme de cible (si l''attaque réussit et même si l''adversaire fait une parade ou esquive partielle)', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-anti-arme"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 84, 'classes', 'Frappeur', 'Don CASSEUR › Pareur', 'Effet', 'modifie', '(Contre Offensif)
Inflige x dégâts supplémentaire et casse la posture* pour le tour. 
x = Niveau Frappeur', '(Contre Offensif)
Inflige x dégâts supplémentaires et casse la posture* pour le tour. 
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-pareur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 85, 'classes', 'Frappeur', 'Don CASSEUR › Anormal', 'Effet', 'modifie', '(Contre Neutre)
Inflige x dégâts supplémentaire et casse la posture* pour le tour. 
x = Niveau Frappeur', '(Contre Neutre)
Inflige x dégâts supplémentaires et casse la posture* pour le tour. 
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-anormal"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 86, 'classes', 'Frappeur', 'Don BRISEUR › Anti-Carac', 'Effet', 'modifie', 'La prochaine attaque va infliger 1 croix a une caractéristique aléatoire qui va durer tout le combat.', 'La prochaine attaque va infliger 1 croix à une caractéristique aléatoire qui va durer tout le combat.', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-anti-carac"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 87, 'classes', 'Frappeur', 'Don BRISEUR › Anti-Armure', 'Effet', 'modifie', 'La prochaine attaque va faire perdre 2 cran de solidité au morceau d''armure qui va être touché (bouclier dans le cas d''une parade partiel ou réussi) (si l''attaque réussi et même si l''adversaire fait une esquive partiel)', 'La prochaine attaque va faire perdre 2 crans de solidité au morceau d''armure qui va être touché (bouclier dans le cas d''une parade partielle ou réussie) (si l''attaque réussit et même si l''adversaire fait une esquive partielle)', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-anti-armure"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 88, 'classes', 'Frappeur', 'Don CASSEUR › Perceur', 'Nom', 'modifie', 'Perçeur', 'Perceur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-perceur"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 89, 'classes', 'Frappeur', 'Don CASSEUR › Perceur', 'Effet', 'modifie', '(Contre Defensif)
Inflige x dégâts supplémentaire et casse la posture* pour le tour. 
x = Niveau Frappeur', '(Contre Défensif)
Inflige x dégâts supplémentaires et casse la posture* pour le tour. 
x = Niveau Frappeur', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-perceur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 90, 'classes', 'Frappeur', 'Don Douleur Amplifiée', 'Effet', 'modifie', 'Inflige 1 cran de faiblesse a une magie au choix sur un adversaire au corps a corps pendant 3 tours', 'Inflige 1 cran de faiblesse à une magie au choix sur un adversaire au corps à corps pendant 3 tours', 'neutre', NULL, 'capacite', '{"id":"capacites/frappeur-douleur-amplifiee"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 91, 'classes', 'Voleur', 'Voleur', 'Présentation', 'modifie', 'Le Voleur est un maître de la discrétion et de la ruse, frappant dans l’ombre avant de disparaître sans laisser de trace. Spécialiste des attaques discrète, il exploite chaque ouverture pour infliger des dégâts bonus.

Sa ruse et son ingéniosité lui permettent non seulement de contourner ses adversaires, mais aussi de crocheter les coffres, ouvrir les portes et déjouer les pièges. Mais bon … tout est légal tant qu’on ne fait pas attraper non ?', 'Le Voleur est un maître de la discrétion et de la ruse, frappant dans l’ombre avant de disparaître sans laisser de trace. Spécialiste des attaques discrètes, il exploite chaque ouverture pour infliger des dégâts bonus.

Sa ruse et son ingéniosité lui permettent non seulement de contourner ses adversaires, mais aussi de crocheter les coffres, ouvrir les portes et déjouer les pièges. Mais bon … tout est légal tant qu’on ne fait pas attraper non ?', 'neutre', NULL, 'classe', '{"id":"classes/voleur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 92, 'classes', 'Voleur', 'Voleur', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/voleur"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 93, 'classes', 'Voleur', 'Spécialité SABOTEUR', 'Description', 'modifie', 'Le Saboteur est un maître des pièges et des explosifs, transformant le champ de bataille en un terrain mortel pour ses ennemis. Grâce à sa maîtrise du sabotage, il pose discrètement de redoutables pièges capables de renverser un combat en un instant. 

Adaptable, il peut improviser avec les ressources à sa disposition. Mêmes ses bombes peuvent être mise à contribution, forçant l’ennemi à jouer la vigilance. Attention où vous marchez ! Un saboteur est peut être déjà passé sans que vous le sachiez.', 'Le Saboteur est un maître des pièges et des explosifs, transformant le champ de bataille en un terrain mortel pour ses ennemis. Grâce à sa maîtrise du sabotage, il pose discrètement de redoutables pièges capables de renverser un combat en un instant. 

Adaptable, il peut improviser avec les ressources à sa disposition. Même ses bombes peuvent être mises à contribution, forçant l’ennemi à jouer la vigilance. Attention où vous marchez ! Un saboteur est peut-être déjà passé sans que vous le sachiez.', 'neutre', NULL, 'specialite', '{"id":"classes/voleur#specialite:saboteur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 94, 'classes', 'Voleur', 'Don SABOTEUR › Saboteur', 'Effet', 'modifie', '+10% Sabotage, +5% Reflexe, 2 points de maîtrise à répartir', '+10% Sabotage, +5% Réflexe, 2 points de maîtrise à répartir', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-saboteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 95, 'classes', 'Voleur', 'Don SABOTEUR › MacGyver', 'Nom', 'modifie', 'McGyver', 'MacGyver', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-mcgyver"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 96, 'classes', 'Voleur', 'Don SABOTEUR › MacGyver', 'Effet', 'modifie', 'Permet de remplacer les ingrédients des 2 premiers pièges par des ingrédients a peu près équivalent.', 'Permet de remplacer les ingrédients des 2 premiers pièges par des ingrédients à peu près équivalents.', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-mcgyver"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 97, 'classes', 'Voleur', 'Don SABOTEUR › Bomberman', 'Effet', 'modifie', 'Les bombes peuvent être posé comme des pièges', 'Les bombes peuvent être posées comme des pièges', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-bomberman"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 98, 'classes', 'Voleur', 'Don CAMBRIOLEUR › Tu m''as pas vu', 'Nom', 'modifie', 'Tu m''a pas vu', 'Tu m''as pas vu', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-tu-ma-pas-vu"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 99, 'classes', 'Voleur', 'Don SABOTEUR › Grande ...', 'Effet', 'modifie', 'Le piège à une zone qui correspond à un cercle de 2.', 'Le piège a une zone qui correspond à un cercle de 2.', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-grande"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 100, 'classes', 'Voleur', 'Don SABOTEUR › ... Zone !', 'Effet', 'modifie', 'Le piège peut se déclancher dans une croix de 1.', 'Le piège peut se déclencher dans une croix de 1.', 'neutre', NULL, 'capacite', '{"id":"capacites/voleur-zone"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 101, 'classes', 'Tueur', 'Tueur', 'Présentation', 'modifie', 'Le Tueur est un mertrier opportuniste, spécialisé dans les attaques sournoises et les frappes précises. Il exploite les moments d’inattention pour infliger des dégâts dévastateurs, frappant là où ça fait le plus mal. 

Armé de son arme de prédilection qui peut être autant une arme de contact que distance. Capable de détourner l’attention de ses ennemis pour créer des ouvertures, il excelle dans les combats où la surprise est de mise. Ne perdez jamais de vue, vous pourriez le regrettez.', 'Le Tueur est un meurtrier opportuniste, spécialisé dans les attaques sournoises et les frappes précises. Il exploite les moments d’inattention pour infliger des dégâts dévastateurs, frappant là où ça fait le plus mal. 

Armé de son arme de prédilection qui peut être autant une arme de contact que distance. Capable de détourner l’attention de ses ennemis pour créer des ouvertures, il excelle dans les combats où la surprise est de mise. Ne perdez jamais de vue, vous pourriez le regretter.', 'neutre', NULL, 'classe', '{"id":"classes/tueur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 102, 'classes', 'Tueur', 'Tueur', 'Chose à savoir', 'modifie', '*Les dégâts sournois sont des dégâts bonus qui sont comptés quand l''attaque est faite sur une cible qui n''est pas attentive. Comme attaquer sur le flanc alors que la cible est face à face avec un adversaire ou plus simplement dans le dos. 
Ces dégâts ne peuvent pas être augmentés par un bonus, ne sont pas soumis à la posture offensif, n''est pas compté dans le coup critique, ne sont JAMAIS élémentaires et ne s''active que sur une seule attaque.', '*Les dégâts sournois sont des dégâts bonus qui sont comptés quand l''attaque est faite sur une cible qui n''est pas attentive. Comme attaquer sur le flanc alors que la cible est face à face avec un adversaire ou plus simplement dans le dos. 
Ces dégâts ne peuvent pas être augmentés par un bonus, ne sont pas soumis à la posture offensive, ne sont pas comptés dans le coup critique, ne sont JAMAIS élémentaires et ne s''activent que sur une seule attaque.', 'neutre', NULL, 'classe', '{"id":"classes/tueur"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 103, 'classes', 'Tueur', 'Tueur', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/tueur"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 104, 'classes', 'Tueur', 'Don Sournois', 'Effet', 'modifie', 'Bonus de 2d4 dégâts sournois* avec une arme de cac ou distance (selon la maîtrise d''arme). +2d4 dégâts tout les 5 niveaux de classe tueur.', 'Bonus de 2d4 dégâts sournois* avec une arme de cac ou distance (selon la maîtrise d''arme). +2d4 dégâts tous les 5 niveaux de classe tueur.', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-sournois"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 105, 'classes', 'Tueur', 'Don FLÉTRISSEUR › Pandémie', 'Effet', 'modifie', 'Les huiles appliquées sur l''arme dure deux coups de plus.', 'Les huiles appliquées sur l''arme durent deux coups de plus.', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-pandemie"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 106, 'classes', 'Tueur', 'Don FLÉTRISSEUR › Insistance', 'Effet', 'modifie', 'L''ennemi à un désavantage pour résister à une altération d''état dont il est vulnérable.', 'L''ennemi a un désavantage pour résister à une altération d''état dont il est vulnérable.', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-insistance"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 107, 'classes', 'Tueur', 'Don SICAIRE › Sournoplus', 'Effet', 'modifie', 'Les dégâts sournois augmente de 1d si la victime souffre d''une altération d''état.', 'Les dégâts sournois augmentent de 1d si la victime souffre d''une altération d''état.', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-sournoplus"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 108, 'classes', 'Tueur', 'Don FLÉTRISSEUR › Anticorps ...', 'Nom', 'modifie', 'Anti corps ...', 'Anticorps ...', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-anti-corps"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 109, 'classes', 'Tueur', 'Don FLÉTRISSEUR › ... inarrêtable', 'Nom', 'modifie', '... innarêtable', '... inarrêtable', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-innaretable"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 110, 'classes', 'Tueur', 'Don SICAIRE › Sournéfice', 'Remarque', 'modifie', 'Si bien sur la cible n''est pas immunisé. Les golems sont immunisé aux altérations d''états qui ne sont pas leur faiblesse', 'Si bien sûr la cible n''est pas immunisée. Les golems sont immunisés aux altérations d''états qui ne sont pas leur faiblesse', 'neutre', NULL, 'capacite', '{"id":"capacites/tueur-sournefice"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 111, 'classes', 'Mercenaire', 'Mercenaire', 'Présentation', 'modifie', 'Le Mercenaire est un combattant polyvalent, capable de s’adapter à n’importe quelle situation grâce à son expérience et son pragmatisme. Habile avec un large éventail d’armes et d’armures, il sait tirer parti de chaque outil à sa disposition pour s''adapter à une situation x ou y.

Son sens de la logitique lui permet de gérer son équipement sans contrainte, toujours prêt à vivre comme un nomade. Il ne suit aucun code autre que le sien, préférant l’efficacité brute aux idéaux rigides. Le plus offrant pourra profiter de ses talents.', 'Le Mercenaire est un combattant polyvalent, capable de s’adapter à n’importe quelle situation grâce à son expérience et son pragmatisme. Habile avec un large éventail d’armes et d’armures, il sait tirer parti de chaque outil à sa disposition pour s''adapter à une situation x ou y.

Son sens de la logistique lui permet de gérer son équipement sans contrainte, toujours prêt à vivre comme un nomade. Il ne suit aucun code autre que le sien, préférant l’efficacité brute aux idéaux rigides. Le plus offrant pourra profiter de ses talents.', 'neutre', NULL, 'classe', '{"id":"classes/mercenaire"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 112, 'classes', 'Mercenaire', 'Mercenaire', 'Maîtrise des armes (une ligne « - » par maîtrise)', 'modifie', '- 3 maîtrise à répartir sans dépasser 1 dans le même', '- 3 maîtrises à répartir sans dépasser 1 dans le même', 'neutre', NULL, 'classe', '{"id":"classes/mercenaire"}', 'maitrise_arme');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 113, 'classes', 'Mercenaire', 'Don Organisé', 'Effet', 'modifie', 'Permet d''utiliser n''importe quel sac quelque soit la Force ou les malus. Permet d''avoir 4 fois le même objet sur un emplacement de ceinture.', 'Permet d''utiliser n''importe quel sac quels que soient la Force ou les malus. Permet d''avoir 4 fois le même objet sur un emplacement de ceinture.', 'neutre', NULL, 'capacite', '{"id":"capacites/mercenaire-organise"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 114, 'classes', 'Mercenaire', 'Don CHASSEUR DE PRIMES › Cha de Drassah', 'Effet', 'modifie', 'Permet de relancé 1 fois un jet de butin et garder le meilleur.', 'Permet de relancer 1 fois un jet de butin et garder le meilleur.', 'neutre', NULL, 'capacite', '{"id":"capacites/mercenaire-cha-de-drassah"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 115, 'classes', 'Mercenaire', 'Don CHASSEUR DE PRIMES › Observateur', 'Effet', 'modifie', 'Un jet d''observation OU de distinction réussi permet de détecter les caches et les salles secrète.', 'Un jet d''observation OU de distinction réussi permet de détecter les caches et les salles secrètes.', 'neutre', NULL, 'capacite', '{"id":"capacites/mercenaire-observateur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 116, 'classes', 'Mercenaire', 'Don COMBATTANT LIBRE › Dur à cuire', 'Effet', 'modifie', 'Si au prise avec au moins 2 ennemis = -20% aux ennemi pour touché.', 'Si aux prises avec au moins 2 ennemis = -20% aux ennemis pour toucher.', 'neutre', NULL, 'capacite', '{"id":"capacites/mercenaire-dur-a-cuire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 117, 'classes', 'Mercenaire', 'Don Je te choisis !', 'Nom', 'modifie', 'Je te choisi !', 'Je te choisis !', 'neutre', NULL, 'capacite', '{"id":"capacites/mercenaire-je-te-choisi"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 118, 'classes', 'Pugiliste', 'Pugiliste', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, poudre de guérison, panacée mineur, KDR Arme, bandage', 'P fiole rouge, poudre de guérison, panacée mineure, KDR Arme, bandage', 'neutre', NULL, 'classe', '{"id":"classes/pugiliste"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 119, 'classes', 'Pugiliste', 'Spécialité LUTTEUR', 'Description', 'modifie', 'Le Lutteur est un guerrier du corps à corps, maîtrisant l’art des projections et des prises. Son style repose sur sa force physique et sa capacité à encaisser les coups tout en infligeant des dégâts accrus à ses adversaires. 

Son endurance exceptionnelle lui permet de combattre malgré la douleur, se nourrissant de la brutalité du combat. Ne le prennez pas à la légère, car lui ne le fera pas.', 'Le Lutteur est un guerrier du corps à corps, maîtrisant l’art des projections et des prises. Son style repose sur sa force physique et sa capacité à encaisser les coups tout en infligeant des dégâts accrus à ses adversaires. 

Son endurance exceptionnelle lui permet de combattre malgré la douleur, se nourrissant de la brutalité du combat. Ne le prenez pas à la légère, car lui ne le fera pas.', 'neutre', NULL, 'specialite', '{"id":"classes/pugiliste#specialite:lutteur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 120, 'classes', 'Pugiliste', 'Don Sci du CAC', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec les armes de pugilat.
x = +2 dégâts/6 niveau de pugiliste.', 'Permet d''infliger 3+x dégâts avec les armes de pugilat.
x = +2 dégâts/6 niveaux de pugiliste.', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-sci-du-cac"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 121, 'classes', 'Pugiliste', 'Don À deux Mains', 'Nom', 'modifie', 'A deux Main', 'À deux Mains', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-a-deux-main"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 122, 'classes', 'Pugiliste', 'Don COGNEUR › Cogneur', 'Effet', 'modifie', '+5% Arme lourde, +5% Reflexe, +5% Vigueur, +2 maîtrise Pugilat, Si l''adversaire fait 30cm de moins en taille le coup impose un jet de stabilité à l''adversaire pour ne pas qu''il tombe.', '+5% Arme lourde, +5% Réflexe, +5% Vigueur, +2 maîtrise Pugilat, Si l''adversaire fait 30cm de moins en taille le coup impose un jet de stabilité à l''adversaire pour ne pas qu''il tombe.', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-cogneur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 123, 'classes', 'Pugiliste', 'Don COGNEUR › Endurcissement', 'Effet', 'modifie', 'Permet de réduire les dégâts reçu de 4.', 'Permet de réduire les dégâts reçus de 4.', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-endurcissement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 124, 'classes', 'Pugiliste', 'Don LUTTEUR › Suplex', 'Nom', 'modifie', 'Suplexe', 'Suplex', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-suplexe"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 125, 'classes', 'Pugiliste', 'Don LUTTEUR › J''aime pas ta face', 'Effet', 'modifie', '+6 de dégâts sur un ennemi ciblé, mais les autres ennemis ont +5% pour toucher le lancuer.', '+6 de dégâts sur un ennemi ciblé, mais les autres ennemis ont +5% pour toucher le lanceur.', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-jaime-pas-ta-face"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 126, 'classes', 'Pugiliste', 'Don LUTTEUR › Rage folle', 'Effet', 'modifie', '+10 aux dégâts, insensible à la douleur et aux peurs, +5 dégâts reçu pendant 3 tour', '+10 aux dégâts, insensible à la douleur et aux peurs, +5 dégâts reçus pendant 3 tours', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-rage-folle"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 127, 'classes', 'Pugiliste', 'Don LUTTEUR › Coup pour coup', 'Effet', 'modifie', '(Posture Défense) Abandonne la parade/esquive pour une contre attaque à chaque coup.', '(Posture Défense) Abandonne la parade/esquive pour une contre-attaque à chaque coup.', 'neutre', NULL, 'capacite', '{"id":"capacites/pugiliste-coup-pour-coup"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 128, 'classes', 'Parleur', 'Parleur', 'Présentation', 'modifie', 'Le Parleur est un combattant dont l''arme est le verbe, utilisant son charisme pour manipuler ses adversaires plutôt que de les affronter directement. Capable de provoquer, d’intimider ou de convaincre, il influence les décisions et détourne l’attention en sa faveur. 

Ses compétences psychologiques lui permettent d’exploiter les faiblesses mentales de ses cibles, transformant chaque échange en une arme redoutable. Face aux créatures douées de conscience, il peut semer la discorde ou provoquer des réactions qui lui seront utile.', 'Le Parleur est un combattant dont l''arme est le verbe, utilisant son charisme pour manipuler ses adversaires plutôt que de les affronter directement. Capable de provoquer, d’intimider ou de convaincre, il influence les décisions et détourne l’attention en sa faveur. 

Ses compétences psychologiques lui permettent d’exploiter les faiblesses mentales de ses cibles, transformant chaque échange en une arme redoutable. Face aux créatures douées de conscience, il peut semer la discorde ou provoquer des réactions qui lui seront utiles.', 'neutre', NULL, 'classe', '{"id":"classes/parleur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 129, 'classes', 'Parleur', 'Parleur', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/parleur"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 130, 'classes', 'Parleur', 'Parleur', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, P fiole jaune, parchemin vierge (x3), plume à gravé, KDR Arme OU carquois N', 'P fiole rouge, P fiole jaune, parchemin vierge (x3), plume à graver, KDR Arme OU carquois N', 'neutre', NULL, 'classe', '{"id":"classes/parleur"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 131, 'classes', 'Parleur', 'Don BONIMENTEUR › Bonimenteur', 'Effet', 'modifie', '+7% Manipulation, Négociation, +2 points de maîtrise à répartir.
+5% chance reusite crit avec des Chaotiques', '+7% Manipulation, Négociation, +2 points de maîtrise à répartir.
+5% chance réussite crit avec des Chaotiques', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-bonimenteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 132, 'classes', 'Parleur', 'Don ÉLOQUENT › Éloquent', 'Nom', 'modifie', 'Eloquent', 'Éloquent', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-eloquent"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 133, 'classes', 'Parleur', 'Don ÉLOQUENT › Éloquent', 'Effet', 'modifie', '+7% Diplomatie, Intimidation, +2 points de maîtrise à répartir.
+5% chance reusite crit avec des Loyaux', '+7% Diplomatie, Intimidation, +2 points de maîtrise à répartir.
+5% chance réussite crit avec des Loyaux', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-eloquent"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 134, 'classes', 'Parleur', 'Don ÉLOQUENT › Provoc', 'Effet', 'modifie', 'Permet d''utiliser un jet de compétence social pour obligé l''adversaire a utiliser que des attaques pendant 3 tours.', 'Permet d''utiliser un jet de compétence social pour obliger l''adversaire à utiliser que des attaques pendant 3 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-provoc"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 135, 'classes', 'Parleur', 'Don ÉLOQUENT › Par ici !', 'Effet', 'modifie', 'Pendant 2 tours, tous les enemis voudront t''attaquer si leur jet de fermeté est raté.', 'Pendant 2 tours, tous les ennemis voudront t''attaquer si leur jet de fermeté est raté.', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-par-ici"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 136, 'classes', 'Parleur', 'Don BONIMENTEUR › Arnaqueur', 'Effet', 'modifie', 'Permet d''échanger un objet contre un autre au maximum un tier plus cher que ce que vous proposez. L''acheteur à le droit à un jet de Perception pour ne pas remarquer la supercherie.', 'Permet d''échanger un objet contre un autre au maximum un tiers plus cher que ce que vous proposez. L''acheteur a le droit à un jet de Perception pour ne pas remarquer la supercherie.', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-arnaqueur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 137, 'classes', 'Parleur', 'Don BONIMENTEUR › Fausse Réputation', 'Effet', 'modifie', 'Permet de faire croire qu''on a un accès au marché noir pour pouvoir y vendre et acheter (marche 1 fois toute les semaines)', 'Permet de faire croire qu''on a un accès au marché noir pour pouvoir y vendre et acheter (marche 1 fois toutes les semaines)', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-fausse-reputation"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 138, 'classes', 'Parleur', 'Don ÉLOQUENT › Patibulaire', 'Effet', 'modifie', 'Une apparence méchante qui pousse les autres a hésiter a vous attaquer (combat ou dialogue).', 'Une apparence méchante qui pousse les autres à hésiter à vous attaquer (combat ou dialogue).', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-patibulaire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 139, 'classes', 'Parleur', 'Don Négociateur', 'Remarque', 'modifie', 'Marche seulement si bien sur le combat est théoriquement arrêtable. Il est pas impossible que l''ennemi soit impossible à raisonner, dans ce cas soyez prudent et demander si le combat est arrêtable.', 'Marche seulement si bien sûr le combat est théoriquement arrêtable. Il est pas impossible que l''ennemi soit impossible à raisonner, dans ce cas soyez prudent et demandez si le combat est arrêtable.', 'neutre', NULL, 'capacite', '{"id":"capacites/parleur-negociateur"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 140, 'classes', 'Bimane', 'Bimane', 'Présentation', 'modifie', 'Le Bimane est un expert du combat à deux armes, enchaînant des attaques rapides et dévastatrices sans laisser de répit à ses adversaires. Grâce à sa maîtrise, il réduit considérablement les malus habituellement liés au maniement de deux armes, rendant ses frappes plus efficaces.

Son style repose sur une pression constante, infligeant des dégâts accrus et forçant ses ennemis à l’épuisement. Tachez de bien visé, ce serai dommage de toucher un allié avec la deuxième arme, hein ?', 'Le Bimane est un expert du combat à deux armes, enchaînant des attaques rapides et dévastatrices sans laisser de répit à ses adversaires. Grâce à sa maîtrise, il réduit considérablement les malus habituellement liés au maniement de deux armes, rendant ses frappes plus efficaces.

Son style repose sur une pression constante, infligeant des dégâts accrus et forçant ses ennemis à l’épuisement. Tâchez de bien viser, ce serait dommage de toucher un allié avec la deuxième arme, hein ?', 'neutre', NULL, 'classe', '{"id":"classes/bimane"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 141, 'classes', 'Bimane', 'Bimane', 'Maîtrise des armes (une ligne « - » par maîtrise)', 'modifie', '- 2 maîtrise à répartir dans les armes de corps à corps sans dépasser 1 dans le même', '- 2 maîtrises à répartir dans les armes de corps à corps sans dépasser 1 dans le même', 'neutre', NULL, 'classe', '{"id":"classes/bimane"}', 'maitrise_arme');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 142, 'classes', 'Bimane', 'Bimane', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, KDR Arme, pierre à aiguisé, P huile (magie innée), corde (5m)', 'P fiole rouge, KDR Arme, pierre à aiguiser, P huile (magie innée), corde (5m)', 'neutre', NULL, 'classe', '{"id":"classes/bimane"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 143, 'classes', 'Bimane', 'Spécialité RAVAGEUR', 'Description', 'modifie', 'Le Ravageur est un maître du combat à deux armes lourdes, combinant puissance et technique pour écraser ses adversaires. Contrairement aux autres guerriers, il réduit les malus liés à l’ambidextrie, rendant ses frappes plus fluides et dévastatrices. 

Son style repose sur des enchaînements brutaux. A force d''entraînement, il peut même manier une arme à deux mains dans une seule ou bien de faire une unique attaque avec les deux armes en même temps, amplifiant encore sa domination en combat. Car il y a jamais assez gros comme équipement.', 'Le Ravageur est un maître du combat à deux armes lourdes, combinant puissance et technique pour écraser ses adversaires. Contrairement aux autres guerriers, il réduit les malus liés à l’ambidextrie, rendant ses frappes plus fluides et dévastatrices. 

Son style repose sur des enchaînements brutaux. À force d''entraînement, il peut même manier une arme à deux mains dans une seule ou bien de faire une unique attaque avec les deux armes en même temps, amplifiant encore sa domination en combat. Car il y a jamais assez gros comme équipement.', 'neutre', NULL, 'specialite', '{"id":"classes/bimane#specialite:ravageur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 144, 'classes', 'Bimane', 'Don Doublette', 'Effet', 'modifie', 'Les malus pour toucher avec deux armes de CAC descend respectivement à 10% pour la première arme et 20% pour la seconde arme.', 'Les malus pour toucher avec deux armes de CAC descendent respectivement à 10% pour la première arme et 20% pour la seconde arme.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-doublette"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 145, 'classes', 'Bimane', 'Don Frappe fatigante', 'Nom', 'modifie', 'Frappe fatiguante', 'Frappe fatigante', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-frappe-fatiguante"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 146, 'classes', 'Bimane', 'Don FAUSSE PATTE › 2 Victimes', 'Effet', 'modifie', 'Permet de frapper une cible par arme (si elles sont à portées)', 'Permet de frapper une cible par arme (si elles sont à portée)', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-2-victimes"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 147, 'classes', 'Bimane', 'Don RAVAGEUR › Poigne ferme', 'Effet', 'modifie', '+4 AP lors d''une parade partiel avec deux armes.', '+4 AP lors d''une parade partielle avec deux armes.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-poigne-ferme"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 148, 'classes', 'Bimane', 'Don RAVAGEUR › Poigne du Titan', 'Effet', 'modifie', 'Permet d''utiliser une arme à deux mains comme une arme à une main. Ne fonctionne pas avec les armes qui demande 5 de force.', 'Permet d''utiliser une arme à deux mains comme une arme à une main. Ne fonctionne pas avec les armes qui demandent 5 de force.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-poigne-du-titan"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 149, 'classes', 'Bimane', 'Don RAVAGEUR › Poigne du Titan', 'Remarque', 'modifie', 'Vous ne pouvez pas avoir deux armes à deux mains dans chaque mains.', 'Vous ne pouvez pas avoir deux armes à deux mains dans chaque main.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-poigne-du-titan"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 150, 'classes', 'Bimane', 'Don RAVAGEUR › Bien s''en servir', 'Effet', 'modifie', 'Permet de faire un coup unique avec les deux armes. L''armure ennemi n''est pris en compte qu''une fois.', 'Permet de faire un coup unique avec les deux armes. L''armure ennemie n''est prise en compte qu''une fois.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-bien-sen-servir"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 151, 'classes', 'Bimane', 'Don RAVAGEUR › Bien s''en servir', 'Remarque', 'modifie', 'Attention, ce coup à 30% de chance d''abîmé les armes', 'Attention, ce coup a 30% de chance d''abîmer les armes', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-bien-sen-servir"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 152, 'classes', 'Bimane', 'Don FAUSSE PATTE › Vivacité', 'Effet', 'modifie', '+2 INI +5 dégats sur chaque arme pendant 2 Tours. Inflige l''état Fatigue 1 si répété.', '+2 INI +5 dégâts sur chaque arme pendant 2 Tours. Inflige l''état Fatigue 1 si répété.', 'neutre', NULL, 'capacite', '{"id":"capacites/bimane-vivacite"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 153, 'classes', 'Archer', 'Don GRAND ARCHER › Grand Archer', 'Effet', 'modifie', 'Permet d''utiliser l''arc de guerre géant, +7% Arc, +5% Arme légères OU lourdes, +2 points de maîtrise Arcs.', 'Permet d''utiliser l''arc de guerre géant, +7% Arc, +5% Armes légères OU lourdes, +2 points de maîtrise Arcs.', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-grand-archer"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 154, 'classes', 'Archer', 'Don TIREUR D''ÉLITE › Tireur d''élite', 'Effet', 'modifie', '2 portée max avec les armes à distances, +7% Arc, +5% Arme légères OU lourdes, +2 points de maîtrise Arcs', '2 portée max avec les armes à distance, +7% Arc, +5% Armes légères OU lourdes, +2 points de maîtrise Arcs', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-tireur-delite"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 155, 'classes', 'Archer', 'Don GRAND ARCHER › Coup puissant', 'Effet', 'modifie', 'Bonus de +4 dégâts avec un arc, ces dégâts sont garantie peu importe l''armure physique.', 'Bonus de +4 dégâts avec un arc, ces dégâts sont garantis peu importe l''armure physique.', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-coup-puissant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 156, 'classes', 'Archer', 'Don GRAND ARCHER › Tir soudain', 'Remarque', 'modifie', 'Les attaques d''opportunité s''enclanche quand l''ennemi sort de la zone d''influence.', 'Les attaques d''opportunité s''enclenchent quand l''ennemi sort de la zone d''influence.', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-tir-soudain"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 157, 'classes', 'Archer', 'Don TIREUR D''ÉLITE › Double Tir', 'Effet', 'modifie', 'Permet de tirer deux flèches différents en une action.', 'Permet de tirer deux flèches différentes en une action.', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-double-tir"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 158, 'classes', 'Archer', 'Don TIREUR D''ÉLITE › Tir vengeur', 'Effet', 'modifie', 'Lors du désangagement, si le jet de défense est réussi. Une contre attaque est possible.', 'Lors du désengagement, si le jet de défense est réussi. Une contre-attaque est possible.', 'neutre', NULL, 'capacite', '{"id":"capacites/archer-tir-vengeur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 159, 'classes', 'Arbalétrier', 'Arbalétrier', 'Présentation', 'modifie', 'L’Arbalétrier est un combattant à distance lourd, utilisant des arbalètes pour faire des trous dans les lignes ennemis sans pour autant être trop proche du danger. Précis et destructeur, il maximise l’impact de ses tirs en augmentant leurs dégâts et en perçant les armures ennemis.

Son arme ignore naturellement les défense physique et lui exploite au mieux cet avantage. Bien que fait pour la distance, sa lourde armure et sa maîtrise d''une arme de contact lui permet de se défendre quand son arbalète n''est plus utile.', 'L’Arbalétrier est un combattant à distance lourd, utilisant des arbalètes pour faire des trous dans les lignes ennemies sans pour autant être trop proche du danger. Précis et destructeur, il maximise l’impact de ses tirs en augmentant leurs dégâts et en perçant les armures ennemies.

Son arme ignore naturellement les défenses physiques et lui exploite au mieux cet avantage. Bien que fait pour la distance, sa lourde armure et sa maîtrise d''une arme de contact lui permettent de se défendre quand son arbalète n''est plus utile.', 'neutre', NULL, 'classe', '{"id":"classes/arbaletrier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 160, 'classes', 'Arbalétrier', 'Spécialité GRAND ARBALÉTRIER', 'Nom', 'modifie', 'GRAND ARBALETRIER', 'GRAND ARBALÉTRIER', 'neutre', NULL, 'specialite', '{"id":"classes/arbaletrier#specialite:grand-arbaletrier"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 161, 'classes', 'Arbalétrier', 'Don Anti-armure', 'Effet', 'modifie', 'Toutes les arbalètes perce 1AP en plus.', 'Toutes les arbalètes percent 1AP en plus.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-anti-armure"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 162, 'classes', 'Arbalétrier', 'Don BALISTE › Baliste', 'Effet', 'modifie', 'Peut utiliser la baliste portable, +2 points de maîtrise Arbalètes, +5% Arbalète, +5% Arme légères et lourdes.', 'Peut utiliser la baliste portable, +2 points de maîtrise Arbalètes, +5% Arbalète, +5% Armes légères et lourdes.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-baliste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 163, 'classes', 'Arbalétrier', 'Don GRAND ARBALÉTRIER › Grand arbalétrier', 'Nom', 'modifie', 'Grand arbalètrier', 'Grand arbalétrier', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-grand-arbaletrier"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 164, 'classes', 'Arbalétrier', 'Don GRAND ARBALÉTRIER › Grand arbalétrier', 'Effet', 'modifie', 'Maîtrise les boucliers classe 1 à 3, +2 points de maîtrise Arbalètes, +5% Arbalète, +5% Arme légères et lourdes.', 'Maîtrise les boucliers classe 1 à 3, +2 points de maîtrise Arbalètes, +5% Arbalète, +5% Armes légères et lourdes.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-grand-arbaletrier"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 165, 'classes', 'Arbalétrier', 'Don BALISTE › À table !', 'Nom', 'modifie', 'A table !', 'À table !', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-a-table"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 166, 'classes', 'Arbalétrier', 'Don BALISTE › À table !', 'Effet', 'modifie', 'L''ennemi à un malus de 10% à son jet de défense.', 'L''ennemi a un malus de 10% à son jet de défense.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-a-table"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 167, 'classes', 'Arbalétrier', 'Don GRAND ARBALÉTRIER › Choix ...', 'Effet', 'modifie', 'Choisi à l''acquisition du don une partie du corps qu''il pourra viser sans malus.', 'Choisit à l''acquisition du don une partie du corps qu''il pourra viser sans malus.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-choix"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 168, 'classes', 'Arbalétrier', 'Don GRAND ARBALÉTRIER › ... agressivement.', 'Remarque', 'modifie', 'L''arbalète doit être recharger.', 'L''arbalète doit être rechargée.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-agressivement"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 169, 'classes', 'Arbalétrier', 'Don Carreau d''acier', 'Remarque', 'modifie', 'L''obstacle doit être assez fin, les mj seront libre de décidé.', 'L''obstacle doit être assez fin, les mj seront libres de décider.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-carreau-dacier"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 170, 'classes', 'Lanceur', 'Lanceur', 'Arme de départ', 'modifie', '3* Armes de Jet Lourde
ou
5* Armes de Jet Léger
*munitions (fer)', '3* Armes de Jet Lourdes
ou
5* Armes de Jet Légères
*munitions (fer)', 'neutre', NULL, 'classe', '{"id":"classes/lanceur"}', 'arme_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 171, 'classes', 'Lanceur', 'Lanceur', 'Armure de départ', 'modifie', 'Armure de Cuir complet, Bouclier rond en bois', 'Armure de Cuir complète, Bouclier rond en bois', 'neutre', NULL, 'classe', '{"id":"classes/lanceur"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 172, 'classes', 'Lanceur', 'Don Oh hisse', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec une arme de jet.
x = +2 dégâts/6 niveau du lanceur.', 'Permet d''infliger 3+x dégâts avec une arme de jet.
x = +2 dégâts/6 niveaux du lanceur.', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-oh-hisse"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 173, 'classes', 'Lanceur', 'Don FANTASSIN › Fantassin', 'Effet', 'modifie', '+2 point de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +8% Arme Lourdes, Peut porter une armure intermédiaire.', '+2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +8% Arme Lourdes, Peut porter une armure intermédiaire.', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-fantassin"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 174, 'classes', 'Lanceur', 'Don JONGLEUR › Jongleur', 'Effet', 'modifie', '+2 point de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +10% Arme Légère, Peut faire un spectacle et gagner 1d20 Ro (dans la mesure du possible).', '+2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +10% Arme Légère, Peut faire un spectacle et gagner 1d20 Ro (dans la mesure du possible).', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-jongleur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 175, 'classes', 'Lanceur', 'Don JONGLEUR › ... Des Lames !', 'Effet', 'modifie', 'Peut lancer des objets tranchant ou perçant très près d''une cible pour l''effrayer.', 'Peut lancer des objets tranchants ou perçants très près d''une cible pour l''effrayer.', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-des-lames"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 176, 'classes', 'Lanceur', 'Don FANTASSIN › À deux mains', 'Nom', 'modifie', 'A deux mains', 'À deux mains', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-a-deux-mains"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 177, 'classes', 'Lanceur', 'Don FANTASSIN › À deux mains', 'Effet', 'modifie', 'Permet de faire reculé son adversaire de 4 cases.', 'Permet de faire reculer son adversaire de 4 cases.', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-a-deux-mains"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 178, 'classes', 'Lanceur', 'Don JONGLEUR › Maniement', 'Effet', 'modifie', 'Peut lancer 3 armes de jets légères jusqu''à 3 cibles différentes pendant son attaque. (3 jets de dés sont nécessaires)', 'Peut lancer 3 armes de jet légères jusqu''à 3 cibles différentes pendant son attaque. (3 jets de dés sont nécessaires)', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-maniement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 179, 'classes', 'Lanceur', 'Don Encore plus !', 'Effet', 'modifie', 'Permet d''aditionner les dés de maîtrise de l''arme de jet avec les dés de maîtrise de l''arme version cac', 'Permet d''additionner les dés de maîtrise de l''arme de jet avec les dés de maîtrise de l''arme version cac', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-encore-plus"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 180, 'classes', 'Grenadier', 'Grenadier', 'Armure de départ', 'modifie', 'Armure de Cuir complet', 'Armure de Cuir complète', 'neutre', NULL, 'classe', '{"id":"classes/grenadier"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 181, 'classes', 'Grenadier', 'Don ARTILLEUR › ... Zépérille', 'Effet', 'modifie', 'Sacrifie 1 parade/esquive pour augmenter ses chances de réussire de 10%.', 'Sacrifie 1 parade/esquive pour augmenter ses chances de réussir de 10%.', 'neutre', NULL, 'capacite', '{"id":"capacites/grenadier-zeperille"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 182, 'classes', 'Grenadier', 'Don ARTILLEUR › Renversant !', 'Effet', 'modifie', 'Les bombes ont 20+% de chance de forcer de le jet de stabilité/réflèxe pour ne pas tomber au sol.', 'Les bombes ont 20+% de chance de forcer de le jet de stabilité/réflexe pour ne pas tomber au sol.', 'neutre', NULL, 'capacite', '{"id":"capacites/grenadier-renversant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 183, 'classes', 'Grenadier', 'Don ARTILLEUR › Incroyable !', 'Effet', 'modifie', 'Le coup critique avec une bombe force 2 jets de vigueurs pour ne pas prendre Aveuglement 1 et Surdité 1.', 'Le coup critique avec une bombe force 2 jets de vigueur pour ne pas prendre Aveuglement 1 et Surdité 1.', 'neutre', NULL, 'capacite', '{"id":"capacites/grenadier-incroyable"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 184, 'classes', 'Grenadier', 'Don ARTILLEUR › Attends ...', 'Nom', 'modifie', 'Attend ...', 'Attends ...', 'neutre', NULL, 'capacite', '{"id":"capacites/grenadier-attend"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 185, 'classes', 'Grenadier', 'Don ARTILLEUR › ... j''arrive !', 'Effet', 'modifie', 'La prochaine bombe est innesquivable.', 'La prochaine bombe est inesquivable.', 'neutre', NULL, 'capacite', '{"id":"capacites/grenadier-jarrive"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 186, 'classes', 'Mage', 'Spécialité MAGE BLANC', 'Description', 'modifie', 'Le Mage Blanc est un maître de la guérison et de la protection, utilisant sa magie pour soigner et renforcer ses alliés. Son pouvoir lui permet de transformer ses sorts offensifs en soins, assurant le soutien pour le groupe en toute situation.

Capable de bénir des armes pour combattre les créatures impies, il excelle dans la défense et l''assistance, relançant des tentatives de survie et amplifiant ses sorts de soin. Disposant d''une des plus massif AM parmis les classes, il est un soutien idéal.', 'Le Mage Blanc est un maître de la guérison et de la protection, utilisant sa magie pour soigner et renforcer ses alliés. Son pouvoir lui permet de transformer ses sorts offensifs en soins, assurant le soutien pour le groupe en toute situation.

Capable de bénir des armes pour combattre les créatures impies, il excelle dans la défense et l''assistance, relançant des tentatives de survie et amplifiant ses sorts de soin. Disposant d''une des plus massives AM parmi les classes, il est un soutien idéal.', 'neutre', NULL, 'specialite', '{"id":"classes/mage#specialite:mage-blanc"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 187, 'classes', 'Mage', 'Don Puissance', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec un sort d''attaque.
x = +2 dégâts/6 niveau de Mage.', 'Permet d''infliger 3+x dégâts avec un sort d''attaque.
x = +2 dégâts/6 niveaux de Mage.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-puissance"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 188, 'classes', 'Mage', 'Don Méditation cool', 'Effet', 'modifie', 'Méditation et repos ne demande plus de jet de calme en situation de stress.', 'Méditation et repos ne demandent plus de jet de calme en situation de stress.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-meditation-cool"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 189, 'classes', 'Mage', 'Don MAGE BLANC › Soin étrange', 'Remarque', 'modifie', 'Il est capable de soigner aussi les morts vivants.
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
- Lance pierre
- Lame d''air
- Éclair
- Frappe lumineuse
- Sphère obscure', 'Il est capable de soigner aussi les morts vivants.
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
- Sphère obscure', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-soin-etrange"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 190, 'classes', 'Mage', 'Don MAGE BLANC › Laisse-moi faire', 'Nom', 'modifie', 'Laisse moi faire', 'Laisse-moi faire', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-laisse-moi-faire"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 191, 'classes', 'Mage', 'Don MAGE BLANC › Deux fois plus', 'Effet', 'modifie', 'Peut lancer deux sorts de soin ou/et d''amplification en 1 seul tour. Il est necessaire de réussir un jet de concentration entre les deux sorts.', 'Peut lancer deux sorts de soin ou/et d''amplification en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-deux-fois-plus"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 192, 'classes', 'Mage', 'Don MAGE BLANC › Deux fois plus', 'Remarque', 'modifie', 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Les deux sorts doivent être différents.', 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Les deux sorts doivent être différents.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-deux-fois-plus"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 193, 'classes', 'Mage', 'Don MAGE NOIR › Toujours plus', 'Effet', 'modifie', 'Peut lancer deux sorts d''attaque ou/et d''entrave en 1 seul tour. Il est necessaire de réussir un jet de concentration entre les deux sorts.', 'Peut lancer deux sorts d''attaque ou/et d''entrave en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-toujours-plus"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 194, 'classes', 'Mage', 'Don MAGE NOIR › Toujours plus', 'Remarque', 'modifie', 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Peut lancer deux sorts de soin ou/et d''amplification en 1 seul tour. Il est necessaire de réussir un jet de concentration entre les deux sorts.					
Les deux sorts doivent être différents.', 'Bien entendu qu''on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d''utiliser cette capacité.
Peut lancer deux sorts de soin ou/et d''amplification en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.					
Les deux sorts doivent être différents.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-toujours-plus"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 195, 'classes', 'Barde', 'Don DANSEUR › Danseur', 'Effet', 'modifie', '+2 dégâts, +1 maîtrise Dague, +6% armes légère, +5% Esquive.', '+2 dégâts, +1 maîtrise Dague, +6% arme légère, +5% Esquive.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-danseur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 196, 'classes', 'Barde', 'Don DANSEUR › Perroquet', 'Effet', 'modifie', 'Permet d''imiter une voix d''une autre personne, sous condition de l''avoir entendu avant.', 'Permet d''imiter une voix d''une autre personne, sous condition de l''avoir entendue avant.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-perroquet"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 197, 'classes', 'Barde', 'Don DANSEUR › Contournement', 'Effet', 'modifie', 'Annule une attaque d''opportunié pour se dégager.', 'Annule une attaque d''opportunité pour se dégager.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-contournement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 198, 'classes', 'Barde', 'Don MÉNESTREL › Ballade guerrière', 'Nom', 'modifie', 'Balade guerrière', 'Ballade guerrière', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-balade-guerriere"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 199, 'classes', 'Barde', 'Don MÉNESTREL › Ballade guerrière', 'Effet', 'modifie', '+3 dégâts, +2 ini et 1d8 santé temporaire pour tout les alliés pendant 3 tours.', '+3 dégâts, +2 ini et 1d8 santé temporaire pour tous les alliés pendant 3 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-balade-guerriere"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 200, 'classes', 'Barde', 'Don DANSEUR › Shrapnel', 'Effet', 'modifie', 'A la rupture de sa barrière le barde bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'À la rupture de sa barrière le barde bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-shrapnel"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 201, 'classes', 'Barde', 'Don DANSEUR › Marche lunaire', 'Effet', 'modifie', 'Glisse sur 3 cases, donne un boost de 10% à l''Esquive et de 10% à la provacation. Doit faire une provocation.', 'Glisse sur 3 cases, donne un boost de 10% à l''Esquive et de 10% à la provocation. Doit faire une provocation.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-marche-lunaire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 202, 'classes', 'Barde', 'Don DANSEUR › À bas les Badauds', 'Nom', 'modifie', 'A bas les Badauds', 'À bas les Badauds', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-a-bas-les-badauds"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 203, 'classes', 'Barde', 'Don DANSEUR › Bain de foule', 'Nom', 'modifie', 'Bain de foules', 'Bain de foule', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-bain-de-foules"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 204, 'classes', 'Mage Rouge', 'Mage Rouge', 'Chose à savoir', 'modifie', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéritiques. (Dans le cas si on choisi cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéristiques. (Dans le cas si on choisit cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'neutre', NULL, 'classe', '{"id":"classes/mage-rouge"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 205, 'classes', 'Mage Rouge', 'Mage Rouge', 'Armure de départ', 'modifie', 'Armure de Peau complet', 'Armure de Peau complète', 'neutre', NULL, 'classe', '{"id":"classes/mage-rouge"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 206, 'classes', 'Mage Rouge', 'Mage Rouge', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole verte, bâton magique lvl1, KDR Arme, torche, pierre à aiguisé', 'P fiole verte, bâton magique lvl1, KDR Arme, torche, pierre à aiguiser', 'neutre', NULL, 'classe', '{"id":"classes/mage-rouge"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 207, 'classes', 'Mage Rouge', 'Spécialité MAGE GRENAT', 'Description', 'modifie', 'Contrairement aux autres mages, le Mage Grenat ne se repose pas uniquement sur ses sorts, mais sur son arme qu’il transforme en canal de puissance. Chaque coup qu’il porte est imprégné de volonté, frappant avec une force supérieur contrairement aux autres mages.

Spécialisé dans un style de combat unique, il choisit une arme de prédilection qu’il perfectionne au fil du temps, augmentant sa puissance et brisant les défenses adverses. Grâce à ses capacités, il alterne entre attaques physiques, sorts et parfois une certaine tendence à empêcher l''adversaire de se défendre contre ses assauts plus que brutaux.', 'Contrairement aux autres mages, le Mage Grenat ne se repose pas uniquement sur ses sorts, mais sur son arme qu’il transforme en canal de puissance. Chaque coup qu’il porte est imprégné de volonté, frappant avec une force supérieure contrairement aux autres mages.

Spécialisé dans un style de combat unique, il choisit une arme de prédilection qu’il perfectionne au fil du temps, augmentant sa puissance et brisant les défenses adverses. Grâce à ses capacités, il alterne entre attaques physiques, sorts et parfois une certaine tendance à empêcher l''adversaire de se défendre contre ses assauts plus que brutaux.', 'neutre', NULL, 'specialite', '{"id":"classes/mage-rouge#specialite:mage-grenat"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 208, 'classes', 'Mage Rouge', 'Don MAGE GRENAT › Mage Grenat', 'Effet', 'modifie', '+2 point de maîtrise avec l''arme déterminé avant, +10% Arme légères OU lourdes, +5% Concentration, Maîtrise  les armures intermédiaire.', '+2 points de maîtrise avec l''arme déterminée avant, +10% Arme légères OU lourdes, +5% Concentration, Maîtrise  les armures intermédiaires.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-mage-grenat"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 209, 'classes', 'Mage Rouge', 'Don MAGE RUBIS › Mage Rubis', 'Effet', 'modifie', '+2 point de maîtrise avec l''arme déterminé avant, +10% Concentration, +5% Arme légères OU lourdes, Permet de sacrifié une parade/esquive pour sortir de la zone d''influence', '+2 points de maîtrise avec l''arme déterminée avant, +10% Concentration, +5% Arme légères OU lourdes, Permet de sacrifier une parade/esquive pour sortir de la zone d''influence', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-mage-rubis"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 210, 'classes', 'Mage Rouge', 'Don MAGE GRENAT › Ange rouge', 'Effet', 'modifie', 'Invoque des danseur(e)s fantomatiques de chakra pendant 1d4 +1 tour(s), inflige un malus de 10% pour touché et pour les jet de défense.', 'Invoque des danseur(e)s fantomatiques de chakra pendant 1d4 +1 tour(s), inflige un malus de 10% pour toucher et pour les jets de défense.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-ange-rouge"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 211, 'classes', 'Mage Rouge', 'Don MAGE RUBIS › Charge lente…', 'Effet', 'modifie', 'Les sorts offensif préparés infligent +5 dégâts.', 'Les sorts offensifs préparés infligent +5 dégâts.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-charge-lente"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 212, 'classes', 'Mage Rouge', 'Don MAGE RUBIS › … ou rapide', 'Effet', 'modifie', 'Les sorts offensif non préparés infligent +5 dégâts.', 'Les sorts offensifs non préparés infligent +5 dégâts.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-ou-rapide"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 213, 'classes', 'Mage Rouge', 'Don MAGE GRENAT › Favori', 'Effet', 'modifie', 'Choisi une arme en particulier et gagne +6 dégâts avec cette arme.', 'Choisit une arme en particulier et gagne +6 dégâts avec cette arme.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-favori"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 214, 'classes', 'Mage Rouge', 'Don MAGE RUBIS › Passeur', 'Effet', 'modifie', '(Posture Symbiose)
Les sorts offensif ignore l''AM de base', '(Posture Symbiose)
Les sorts offensifs ignorent l''AM de base', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-passeur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 215, 'classes', 'Mage Rouge', 'Don MAGE GRENAT › 1 des deux', 'Effet', 'modifie', 'Permet d''empêcher la cible d''esquiver ou parer l''arme ET le sort. Il doit choisir si il veux prendre le premier ou deuxième coup.', 'Permet d''empêcher la cible d''esquiver ou parer l''arme ET le sort. Il doit choisir s''il veut prendre le premier ou deuxième coup.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-1-des-deux"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 216, 'classes', 'Mage Rouge', 'Don Double coup', 'Effet', 'modifie', 'Permet de conserver un sort dans la main et l''activé à chaque coup au corps à corps infligé. S''annule quand il y a un changement de sort.', 'Permet de conserver un sort dans la main et l''activer à chaque coup au corps à corps infligé. S''annule quand il y a un changement de sort.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-double-coup"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 217, 'classes', 'Mage Rouge', 'Don Double coup', 'Remarque', 'modifie', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochain c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien a noter la réussite du sort pour ne pas le perdre.', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-double-coup"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 218, 'classes', 'Mage Bleu', 'Mage Bleu', 'Présentation', 'modifie', 'Le Mage Bleu est une classe particulière capable de mimé ses adversaires, de récupérer leurs avantages et de les retourner contre eux. Tout comme les autres mages colorés, il utilise sa volonté pour lancer ses sorts.

Il peut soit augmenter son savoir sur les monstres mais aussi d''avoir un compagnon familier et de ne faire plus qu''un avec ce dernier. Sa versatilité avec les dons des monstres permet de faire de lui un combattant difficile à anticipé.', 'Le Mage Bleu est une classe particulière capable de mimer ses adversaires, de récupérer leurs avantages et de les retourner contre eux. Tout comme les autres mages colorés, il utilise sa volonté pour lancer ses sorts.

Il peut soit augmenter son savoir sur les monstres mais aussi d''avoir un compagnon familier et de ne faire plus qu''un avec ce dernier. Sa versatilité avec les dons des monstres permet de faire de lui un combattant difficile à anticiper.', 'neutre', NULL, 'classe', '{"id":"classes/mage-bleu"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 219, 'classes', 'Mage Bleu', 'Mage Bleu', 'Chose à savoir', 'modifie', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéritiques. (Dans le cas si on choisi cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu).
Un potentiel illimité ne peut pas avoir cette classe.
Cette classe commence avec un gros familier.', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéristiques. (Dans le cas si on choisit cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu).
Un potentiel illimité ne peut pas avoir cette classe.
Cette classe commence avec un gros familier.', 'neutre', NULL, 'classe', '{"id":"classes/mage-bleu"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 220, 'classes', 'Mage Bleu', 'Mage Bleu', 'Arme de départ', 'modifie', 'Arme choisi en acier (x10 si arme de jet/bombe)', 'Arme choisie en acier (x10 si arme de jet/bombe)', 'neutre', NULL, 'classe', '{"id":"classes/mage-bleu"}', 'arme_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 221, 'classes', 'Mage Bleu', 'Don Mimétisme', 'Effet', 'modifie', 'Permet d''avoir un don parmi une liste possible de don lié à sa magie innée. (Ne peut pas être changé une fois choisi)', 'Permet d''avoir un don parmi une liste possible de dons lié à sa magie innée. (Ne peut pas être changé une fois choisi)', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-mimetisme"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 222, 'classes', 'Mage Bleu', 'Don MAGE SAPHIR › Mage saphir', 'Effet', 'modifie', '+7% de la compétence de l''arme choisie, +7% Concentration, +2 point de maîtrise avec l''arme déterminé avant.', '+7% de la compétence de l''arme choisie, +7% Concentration, +2 points de maîtrise avec l''arme déterminée avant.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-mage-saphir"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 223, 'classes', 'Mage Bleu', 'Don MAGE SAPHIR › Attention !', 'Effet', 'modifie', 'Si un monstre utilise une capacité offensif sur vous ou les alliés, chacun d''entre vous possède un bonus de +5% au jet pour l''eviter.', 'Si un monstre utilise une capacité offensive sur vous ou les alliés, chacun d''entre vous possède un bonus de +5% au jet pour l''éviter.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-attention"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 224, 'classes', 'Mage Bleu', 'Don DRESSEUR BLEU › Ultime sacrifice', 'Effet', 'modifie', 'Si la prochaine attaque subit va vous mettre dans le coma, votre familier va prendre le coup a votre place.', 'Si la prochaine attaque subie va vous mettre dans le coma, votre familier va prendre le coup à votre place.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-ultime-sacrifice"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 225, 'classes', 'Mage Bleu', 'Don DRESSEUR BLEU › Âme double', 'Effet', 'modifie', 'Votre magie ne blesse pas votre familier. Les sorts de soutien appliqués sur votre familier sont également appliqué sur vous et vice-versa.', 'Votre magie ne blesse pas votre familier. Les sorts de soutien appliqués sur votre familier sont également appliqués sur vous et vice-versa.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-ame-double"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 226, 'classes', 'Mage Bleu', 'Don MAGE SAPHIR › Contesté !', 'Effet', 'modifie', 'Si vous possèdez un don qui est identique à celui d''un monstre, vous pouvez annuler ses effets.', 'Si vous possédez un don qui est identique à celui d''un monstre, vous pouvez annuler ses effets.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-conteste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 227, 'classes', 'Mage Vert', 'Mage Vert', 'Chose à savoir', 'modifie', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéritiques. (Dans le cas si on choisi cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'Cette classe utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéristiques. (Dans le cas si on choisit cette classe en premier par rapport à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'neutre', NULL, 'classe', '{"id":"classes/mage-vert"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 228, 'classes', 'Mage Vert', 'Spécialité MAGE ÉMERAUDE', 'Nom', 'modifie', 'MAGE EMERAUDE', 'MAGE ÉMERAUDE', 'neutre', NULL, 'specialite', '{"id":"classes/mage-vert#specialite:mage-emeraude"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 229, 'classes', 'Mage Vert', 'Don MAGE ÉMERAUDE › Mage émeraude', 'Nom', 'modifie', 'Mage emeraude', 'Mage émeraude', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-mage-emeraude"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 230, 'classes', 'Mage Vert', 'Don MAGE ÉMERAUDE › Mage émeraude', 'Effet', 'modifie', '+2 point de maîtrise avec l''arme déterminé avant, +10% Concentration, +5% de la compétence de l''arme de départ*, +3 dégâts magique en posture focus.', '+2 points de maîtrise avec l''arme déterminée avant, +10% Concentration, +5% de la compétence de l''arme de départ*, +3 dégâts magiques en posture focus.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-mage-emeraude"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 231, 'classes', 'Mage Vert', 'Don MAGE JADE › Mage jade', 'Effet', 'modifie', '+2 point de maîtrise avec l''arme déterminé avant, +10% de la compétence de l''arme de départ*, +5% Concentration, Les projectiles perce 3AP en posture symbiose.', '+2 points de maîtrise avec l''arme déterminée avant, +10% de la compétence de l''arme de départ*, +5% Concentration, Les projectiles percent 3AP en posture symbiose.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-mage-jade"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 232, 'classes', 'Mage Vert', 'Don MAGE ÉMERAUDE › ... Brutale', 'Effet', 'modifie', '(Posture Focus)
Les enchantements d''armes sont augmenté de +2', '(Posture Focus)
Les enchantements d''armes sont augmentés de +2', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-brutale"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 233, 'classes', 'Mage Vert', 'Don MAGE JADE › Munition Spéciale', 'Effet', 'modifie', '(Posture Symbiose)
Permet d''utilisé l''arme a distance et tirer des projectiles fait en chakra, tape dans l''élément de la symbiose. Coûte 4 chakra.', '(Posture Symbiose)
Permet d''utiliser l''arme à distance et tirer des projectiles faits en chakra, tape dans l''élément de la symbiose. Coûte 4 chakra.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-munition-speciale"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 234, 'classes', 'Mage Vert', 'Don MAGE JADE › Meilleure attaque ...', 'Nom', 'modifie', 'Meilleur attaque ...', 'Meilleure attaque ...', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-meilleur-attaque"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 235, 'classes', 'Mage Vert', 'Don MAGE JADE › Meilleure attaque ...', 'Effet', 'modifie', '(Posture symbiose)
Le boost de dégâts magique de la posture est aussi appliqué à l''arme.', '(Posture symbiose)
Le boost de dégâts magiques de la posture est aussi appliqué à l''arme.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-meilleur-attaque"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 236, 'classes', 'Mage Vert', 'Don MAGE JADE › ... c''est la défense', 'Effet', 'modifie', '(Posture symbiose)
L''AM de Symbiose est Doublé', '(Posture symbiose)
L''AM de Symbiose est Doublée', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-cest-la-defense"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 237, 'classes', 'Mage Vert', 'Don Double coup', 'Effet', 'modifie', 'Permet de conserver un sort dans la main et l''activé à chaque coup à distance infligé. S''annule quand il y a un changement de sort.', 'Permet de conserver un sort dans la main et l''activer à chaque coup à distance infligé. S''annule quand il y a un changement de sort.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-double-coup"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 238, 'classes', 'Mage Vert', 'Don Double coup', 'Remarque', 'modifie', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochain c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien a noter la réussite du sort pour ne pas le perdre.', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-double-coup"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 239, 'classes', 'Clerc', 'Clerc', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole rouge, poudre de guérison, P fiole bordeaux, bâton magique lvl1, panacée mineur', 'P fiole rouge, poudre de guérison, P fiole bordeaux, bâton magique lvl1, panacée mineure', 'neutre', NULL, 'classe', '{"id":"classes/clerc"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 240, 'classes', 'Clerc', 'Spécialité ZÉLOTE', 'Description', 'modifie', 'Le Zélote est le bras armé de sa divinité, un fervent serviteur qui impose la volonté divine par le chakra et l''acier. Il combat avec une ferveur inébranlable, punissant les impies et purifiant le monde des forces impures.

Maître des haches, il peut bannir les créatures d''autres plans et infliger de terribles châtiments aux indécis et aux neutres. À son apogée, il invoque des figures saintes pour combattre à ses côtés, incarnant la justice divine en pleine bataille. Il est là pour punir ceux qui le mérite.', 'Le Zélote est le bras armé de sa divinité, un fervent serviteur qui impose la volonté divine par le chakra et l''acier. Il combat avec une ferveur inébranlable, punissant les impies et purifiant le monde des forces impures.

Maître des haches, il peut bannir les créatures d''autres plans et infliger de terribles châtiments aux indécis et aux neutres. À son apogée, il invoque des figures saintes pour combattre à ses côtés, incarnant la justice divine en pleine bataille. Il est là pour punir ceux qui le méritent.', 'neutre', NULL, 'specialite', '{"id":"classes/clerc#specialite:zelote"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 241, 'classes', 'Clerc', 'Don Proche', 'Effet', 'modifie', 'Augmente d''un cran la résistance à la magie inné et a son altération d''état.', 'Augmente d''un cran la résistance à la magie innée et à son altération d''état.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-proche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 242, 'classes', 'Clerc', 'Don Médi profonde', 'Effet', 'modifie', 'La méditation et le repos redonne +8 Chakra.', 'La méditation et le repos redonnent +8 Chakra.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-medi-profonde"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 243, 'classes', 'Clerc', 'Don SAINT COMBATTANT › Tends l''autre joue', 'Nom', 'modifie', 'Tend l''autre joue', 'Tends l''autre joue', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-tend-lautre-joue"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 244, 'classes', 'Clerc', 'Don ZÉLOTE › Comme un seul', 'Effet', 'modifie', 'La magie inné inflige +4 dégâts, +4 soins et donne 1 tour supplémentaire d''effet secondaire.', 'La magie innée inflige +4 dégâts, +4 soins et donne 1 tour supplémentaire d''effet secondaire.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-comme-un-seul"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 245, 'classes', 'Clerc', 'Don ZÉLOTE › Placebo', 'Effet', 'modifie', 'Réussir un jet de social lors d''un soin permet d''ajouté +5 au soin prodiguer.', 'Réussir un jet de social lors d''un soin permet d''ajouter +5 au soin prodigué.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-placebo"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 246, 'classes', 'Clerc', 'Don SAINT COMBATTANT › Lieu saint', 'Effet', 'modifie', 'Invoque une zone de 3 cases autour qui repousse les utilisateurs des magies ennemis (les magies efficace contre votre magie inné) Dure 3 tours.', 'Invoque une zone de 3 cases autour qui repousse les utilisateurs des magies ennemies (les magies efficaces contre votre magie innée) Dure 3 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-lieu-saint"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 247, 'classes', 'Clerc', 'Don SAINT COMBATTANT › Ange Beige', 'Effet', 'modifie', '(Posture Symbiose)
Invoque un Ange qui va soigné à hauteur de 25% de PV lorsque ceux ci tombe à 0. Sur soi uniquement.', '(Posture Symbiose)
Invoque un Ange qui va soigner à hauteur de 25% de PV lorsque ceux-ci tombent à 0. Sur soi uniquement.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-ange-beige"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 248, 'classes', 'Clerc', 'Don SAINT COMBATTANT › Ange Pourpre', 'Effet', 'modifie', '(Posture Symbiose)
Invoque un Ange qui va soigné 100% des Pv mais ceux ci vont fondre de 10% par tour. Sur soi uniquement.', '(Posture Symbiose)
Invoque un Ange qui va soigner 100% des Pv mais ceux-ci vont fondre de 10% par tour. Sur soi uniquement.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-ange-pourpre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 249, 'classes', 'Maclier', 'Maclier', 'Présentation', 'modifie', 'Le Maclier est un mage combattant qui allie la puissance du Chakra à l’imposante défense des grands boucliers. Sa technique unique lui permet de se protéger contre des attaques magiques normalement imparable tout en renforçant ses propres capacités défensives.

Capable de neutraliser certains sorts par la parade et d''influer ses sorts dans son bouclier, il excelle dans l’art de la riposte. Son style de combat repose sur une endurance exceptionnelle, absorbant les coups et détournant la puissance adverse pour mieux contre-attaquer.', 'Le Maclier est un mage combattant qui allie la puissance du Chakra à l’imposante défense des grands boucliers. Sa technique unique lui permet de se protéger contre des attaques magiques normalement imparables tout en renforçant ses propres capacités défensives.

Capable de neutraliser certains sorts par la parade et d''influer ses sorts dans son bouclier, il excelle dans l’art de la riposte. Son style de combat repose sur une endurance exceptionnelle, absorbant les coups et détournant la puissance adverse pour mieux contre-attaquer.', 'neutre', NULL, 'classe', '{"id":"classes/maclier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 250, 'classes', 'Maclier', 'Maclier', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'P fiole mauve, bâton magique lvl1, KDR Armure, lingot d''acier, panacée mineur', 'P fiole mauve, bâton magique lvl1, KDR Armure, lingot d''acier, panacée mineure', 'neutre', NULL, 'classe', '{"id":"classes/maclier"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 251, 'classes', 'Maclier', 'Don GRAND MACLIER › Frisbee', 'Effet', 'modifie', 'Permet de faire un mouvement de lancé avec le bouclier et inflige 3d6 dégâts à toutes les cibles dans la zone. Portée 6 en arc de cercle.', 'Permet de faire un mouvement de lancer avec le bouclier et inflige 3d6 dégâts à toutes les cibles dans la zone. Portée 6 en arc de cercle.', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-frisbee"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 252, 'classes', 'Maclier', 'Don ARCHICLIER › Le Centuple', 'Effet', 'modifie', '(Posture Défensif)
Les sorts influer dans le bouclier vont plus loin que la normal, +3 à la portée.', '(Posture Défensif)
Les sorts influer dans le bouclier vont plus loin que la normale, +3 à la portée.', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-le-centuple"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 253, 'classes', 'Maclier', 'Don GRAND MACLIER › Sacri-BA', 'Effet', 'modifie', 'Permet de sacrifié des PV et CK pour régénérer la Barrière.
(1 PV/CK = 1 Barrière)', 'Permet de sacrifier des PV et CK pour régénérer la Barrière.
(1 PV/CK = 1 Barrière)', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-sacri-ba"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 254, 'classes', 'Maclier', 'Don GRAND MACLIER › Sacri-PARM', 'Effet', 'modifie', 'Permet de sacrifié des PV et CK pour augmenter les AP ou la AM pour 1 tour.
(3 PV/CK = 1 PA ou RM)', 'Permet de sacrifier des PV et CK pour augmenter les AP ou l''AM pour 1 tour.
(3 PV/CK = 1 PA ou RM)', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-sacri-parm"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 255, 'classes', 'Maclier', 'Don GRAND MACLIER › Miroir …', 'Effet', 'modifie', 'Permet de renvoyé complètement un sortilège offensif (Le bouclier doit être de classe égale ou supérieur au niveau du sort)', 'Permet de renvoyer complètement un sortilège offensif (Le bouclier doit être de classe égale ou supérieure au niveau du sort)', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-miroir"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 256, 'classes', 'Maclier', 'Don ARCHICLIER › Prise alternative …', 'Nom', 'modifie', 'Prise alternatif …', 'Prise alternative …', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-prise-alternatif"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 257, 'classes', 'Maclier', 'Don ARCHICLIER › Prise alternative …', 'Effet', 'modifie', 'Quand un sort est encaisser, permet de choisir si ça va prendre en compte l''armure physique ou magique.', 'Quand un sort est encaissé, permet de choisir si ça va prendre en compte l''armure physique ou magique.', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-prise-alternatif"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 258, 'classes', 'Maclier', 'Don ARCHICLIER › … ou infini', 'Effet', 'modifie', 'Permet de parer tout les type d''impact avec le bouclier (Magique/Physique/ Immatériel).', 'Permet de parer tous les types d''impact avec le bouclier (Magique/Physique/ Immatériel).', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-ou-infini"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 259, 'classes', 'Maclier', 'Don GRAND MACLIER › … Parfait', 'Effet', 'modifie', 'Permet de renvoyé complètement un sortilège offensif (Le bouclier doit être de classe égale ou supérieur au niveau du sort ET en Maverium)', 'Permet de renvoyer complètement un sortilège offensif (Le bouclier doit être de classe égale ou supérieure au niveau du sort ET en Maverium)', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-parfait"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 260, 'classes', 'Ocultomancien', 'Ocultomancien', 'Présentation', 'modifie', 'Là où d’autres brûlent leur énergie sans compter, l’Occultomancien maîtrise l’art de la magie économe et raffinée. Chaque sort qu’il tisse est optimisé, pas d''énergie inutilement gaspiller.

Il perçoit les connexions invisibles entre son environnement et sa magie, exploitant les moindres éléments du décor pour renforcer son efficacité. Véritable stratège mystique, il ne domine pas la magie par la puissance, mais par l’intelligence, rendant chaque sort plus fluide et plus efficace.', 'Là où d’autres brûlent leur énergie sans compter, l’Ocultomancien maîtrise l’art de la magie économe et raffinée. Chaque sort qu’il tisse est optimisé, pas d''énergie inutilement gaspillée.

Il perçoit les connexions invisibles entre son environnement et sa magie, exploitant les moindres éléments du décor pour renforcer son efficacité. Véritable stratège mystique, il ne domine pas la magie par la puissance, mais par l’intelligence, rendant chaque sort plus fluide et plus efficace.', 'neutre', NULL, 'classe', '{"id":"classes/ocultomancien"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 261, 'classes', 'Ocultomancien', 'Ocultomancien', 'Chose à savoir', 'modifie', 'Le spécialiste permet d''avoir des résistances à des magies, ou alors avoir la possibilité de taper plus fort contre certaines magies, les altérations d''état ne sont pas concerner par ces capacités.', 'Le spécialiste permet d''avoir des résistances à des magies, ou alors avoir la possibilité de taper plus fort contre certaines magies, les altérations d''état ne sont pas concernées par ces capacités.', 'neutre', NULL, 'classe', '{"id":"classes/ocultomancien"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 262, 'classes', 'Ocultomancien', 'Spécialité MÉTÉOROLOGUE', 'Description', 'modifie', 'Le Météorologue manipule le climat à son avantage, transformant la météo en un outil stratégique redoutable. Qu’il amplifie les effets du temps ou neutralise ses malus, il dicte à quel sauce va être mangé ses adversaires.

Capable d’influencer les conditions météorologiques, il façonne la météo pour renforcer sa ou ses magies. À son apogée, il invoque des créatures liées aux éléments ou dicte les caprices du ciel, dominant ses ennemis par la force de la nature elle-même.', 'Le Météorologue manipule le climat à son avantage, transformant la météo en un outil stratégique redoutable. Qu’il amplifie les effets du temps ou neutralise ses malus, il dicte à quelle sauce vont être mangés ses adversaires.

Capable d’influencer les conditions météorologiques, il façonne la météo pour renforcer sa ou ses magies. À son apogée, il invoque des créatures liées aux éléments ou dicte les caprices du ciel, dominant ses ennemis par la force de la nature elle-même.', 'neutre', NULL, 'specialite', '{"id":"classes/ocultomancien#specialite:meteorologue"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 263, 'classes', 'Ocultomancien', 'Don MÉTÉOROLOGUE › Météorologue', 'Effet', 'modifie', 'La météo Neutre augmente ses dégâts magique de 4, +1 point de maîtrise.', 'La météo Neutre augmente ses dégâts magiques de 4, +1 point de maîtrise.', 'neutre', NULL, 'capacite', '{"id":"capacites/ocultomancien-meteorologue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 264, 'classes', 'Ocultomancien', 'Don SPÉCIALISTE › Adaptation', 'Effet', 'modifie', 'Réduit de 1 cran une vulnérabilité magique possédé en raison de la magie innée.', 'Réduit de 1 cran une vulnérabilité magique possédée en raison de la magie innée.', 'neutre', NULL, 'capacite', '{"id":"capacites/ocultomancien-adaptation"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 265, 'classes', 'Ocultomancien', 'Don MÉTÉOROLOGUE › Climatoégoïste', 'Effet', 'modifie', 'Les bonus de la météo ne profite qu''aux alliés et à soi-même.', 'Les bonus de la météo ne profitent qu''aux alliés et à soi-même.', 'neutre', NULL, 'capacite', '{"id":"capacites/ocultomancien-climatoegoiste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 266, 'classes', 'Flagelleur', 'Flagelleur', 'Présentation', 'modifie', 'Le Flagelleur puise sa force dans la souffrance, transformant ses blessures en une source de puissance infinie. Plus il est affaibli, plus ses coups gagnent en force, frappant ses ennemis avec une brutalité expodentielle.

Sans armure, il compte sur son endurance et sa capacité à se soigner en purifiant ses altérations d’état. Chaque cicatrice est une preuve de sa résistance. Il avance sur le champ de bataille avec une détermination frôlant la folie, inspirant l''hésitation sur ses ennemis.', 'Le Flagelleur puise sa force dans la souffrance, transformant ses blessures en une source de puissance infinie. Plus il est affaibli, plus ses coups gagnent en force, frappant ses ennemis avec une brutalité exponentielle.

Sans armure, il compte sur son endurance et sa capacité à se soigner en purifiant ses altérations d’état. Chaque cicatrice est une preuve de sa résistance. Il avance sur le champ de bataille avec une détermination frôlant la folie, inspirant l''hésitation sur ses ennemis.', 'neutre', NULL, 'classe', '{"id":"classes/flagelleur"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 267, 'classes', 'Flagelleur', 'Flagelleur', 'Chose à savoir', 'modifie', 'La spécialisation "Masochiste" utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéritiques. (Dans le cas si on choisi cette classe en premier à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'La spécialisation "Masochiste" utilise "Concentration" pour lancer ses sortilèges au lieu de "Magie" donc prudence dans la répartition des Caractéristiques. (Dans le cas si on choisit cette classe en premier à une autre classe magique, en deuxième ce changement n''a pas lieu)', 'neutre', NULL, 'classe', '{"id":"classes/flagelleur"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 268, 'classes', 'Flagelleur', 'Spécialité SADIQUE', 'Description', 'modifie', 'Le Sadique ne combat pas pour vaincre rapidement, mais pour voir ses ennemis souffrir lentement. Chaque altération d’état infligée prolonge son emprise sur ses victimes, les affaiblissant jusqu’à briser leur volonté.

Capable d’aggraver les malus et même de transférer ses propres altérations à ses adversaires, il fait de la mort lente son fer de lance au combat. Résister contre lui et vous apprendrez ce qu''est la vraie douleur.', 'Le Sadique ne combat pas pour vaincre rapidement, mais pour voir ses ennemis souffrir lentement. Chaque altération d’état infligée prolonge son emprise sur ses victimes, les affaiblissant jusqu’à briser leur volonté.

Capable d’aggraver les malus et même de transférer ses propres altérations à ses adversaires, il fait de la mort lente son fer de lance au combat. Résistez contre lui et vous apprendrez ce qu''est la vraie douleur.', 'neutre', NULL, 'specialite', '{"id":"classes/flagelleur#specialite:sadique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 269, 'classes', 'Flagelleur', 'Don Souffrance', 'Effet', 'modifie', 'Permet d''infliger 2 dégâts en plus tout les 10% de santé en moins.', 'Permet d''infliger 2 dégâts en plus tous les 10% de santé en moins.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-souffrance"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 270, 'classes', 'Flagelleur', 'Don Soin Revigorant', 'Effet', 'modifie', 'Permet de se soigner 2d8 et retirer une altération d''état. Ne peux être fait uniquement si une altération d''état est présente sur la cible.', 'Permet de se soigner 2d8 et retirer une altération d''état. Ne peut être fait uniquement si une altération d''état est présente sur la cible.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-soin-revigorant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 271, 'classes', 'Flagelleur', 'Don MASOCHISTE › Masochiste', 'Effet', 'modifie', 'La résistance magique permet de réduire les dégâts des altérations d''états, +2 points de maîtrise à répartir, la classe est concidérée comme magique.', 'La résistance magique permet de réduire les dégâts des altérations d''états, +2 points de maîtrise à répartir, la classe est considérée comme magique.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-masochiste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 272, 'classes', 'Flagelleur', 'Don SADIQUE › Dis mon nom !', 'Nom', 'modifie', 'Dit mon nom !', 'Dis mon nom !', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-dit-mon-nom"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 273, 'classes', 'Flagelleur', 'Don MASOCHISTE › Punis-moi ...', 'Nom', 'modifie', 'Puni-moi ...', 'Punis-moi ...', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-puni-moi"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 274, 'classes', 'Flagelleur', 'Don MASOCHISTE › Punis-moi ...', 'Remarque', 'modifie', 'Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire', 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-puni-moi"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 275, 'classes', 'Flagelleur', 'Don MASOCHISTE › ... plus fort !', 'Effet', 'modifie', 'Annule les faiblesses aux alétérations d''état lié à la magie innée.', 'Annule les faiblesses aux altérations d''état liées à la magie innée.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-plus-fort"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 276, 'classes', 'Flagelleur', 'Don MASOCHISTE › ... plus fort !', 'Remarque', 'modifie', 'Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire', 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-plus-fort"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 277, 'classes', 'Flagelleur', 'Don SADIQUE › Punition !', 'Effet', 'modifie', 'Diminue d''un cran la résistance aux altérations d''état lié à la magie innée au cible. (Si il est neutre ou plus bas, ça aggrave l''altération d''état)', 'Diminue d''un cran la résistance aux altérations d''état lié à la magie innée au cible. (S''il est neutre ou plus bas, ça aggrave l''altération d''état)', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-punition"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 278, 'classes', 'Flagelleur', 'Don SADIQUE › Para-Zith-va !', 'Effet', 'modifie', 'Permet de transférer une altération d''état subit vers une cible avec une attaque de contact (arme).', 'Permet de transférer une altération d''état subie vers une cible avec une attaque de contact (arme).', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-para-zith-va"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 279, 'classes', 'Flagelleur', 'Don MASOCHISTE › ... Encore plus !', 'Effet', 'modifie', 'Permet d''infliger x dégâts par altération d''état présent sur le masochiste.
x = +5 dégâts/ altération d''état.', 'Permet d''infliger x dégâts par altération d''état présente sur le masochiste.
x = +5 dégâts/ altération d''état.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-encore-plus"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 280, 'classes', 'Flagelleur', 'Don SADIQUE › Prescription', 'Effet', 'modifie', 'Si l''ennemi est résistant à l''altération d''état qui doit être infligée, cette résistance est annulé.', 'Si l''ennemi est résistant à l''altération d''état qui doit être infligée, cette résistance est annulée.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-prescription"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 281, 'classes', 'Flagelleur', 'Don SADIQUE › 50 Nuances ...', 'Effet', 'modifie', 'Permet d''infliger un altération aléatoire de stade 2. Cette compétence se lance en même tant qu''une attaque.', 'Permet d''infliger une altération aléatoire de stade 2. Cette compétence se lance en même temps qu''une attaque.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-50-nuances"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 282, 'classes', 'Flagelleur', 'Don Noyau-Dur !', 'Effet', 'modifie', 'Si une altération d''état était censé mettre dans le coma, l''altération d''état est retirée et soigne 6d10 santé.', 'Si une altération d''état était censée mettre dans le coma, l''altération d''état est retirée et soigne 6d10 santé.', 'neutre', NULL, 'capacite', '{"id":"capacites/flagelleur-noyau-dur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 283, 'classes', 'Orios', 'Orios', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'neutre', NULL, 'classe', '{"id":"classes/orios"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 284, 'classes', 'Orios', 'Spécialité VA-T-EN-GUERRE', 'Nom', 'modifie', 'VA-T-EN GUERRE', 'VA-T-EN-GUERRE', 'neutre', NULL, 'specialite', '{"id":"classes/orios#specialite:va-t-en-guerre"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 285, 'classes', 'Orios', 'Spécialité VA-T-EN-GUERRE', 'Description', 'modifie', 'Le Va-t-en guerre est un colosse de combat, un guerrier taillé pour l’affrontement direct et l’usage d’armes démesurées. Son style repose sur une force brute incomparable, montrant toute la supériorité des Orios sur le plan de la force.

Qu’il manie un immense arc de guerre avec ses seuls bras ou qu’il écrase ses ennemis sous des coups surpuissants, il impose sa présence sur le champ de bataille. Grâce à sa patience et sa puissance explosive, il attend le moment parfait pour frapper, pulvérisant ses adversaires sous des assauts inarrêtables.', 'Le Va-t-en-guerre est un colosse de combat, un guerrier taillé pour l’affrontement direct et l’usage d’armes démesurées. Son style repose sur une force brute incomparable, montrant toute la supériorité des Orios sur le plan de la force.

Qu’il manie un immense arc de guerre avec ses seuls bras ou qu’il écrase ses ennemis sous des coups surpuissants, il impose sa présence sur le champ de bataille. Grâce à sa patience et sa puissance explosive, il attend le moment parfait pour frapper, pulvérisant ses adversaires sous des assauts inarrêtables.', 'neutre', NULL, 'specialite', '{"id":"classes/orios#specialite:va-t-en-guerre"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 286, 'classes', 'Orios', 'Spécialité CHAMAN', 'Description', 'modifie', 'Le Chaman est un orios mystique, en harmonie avec les forces qui constitue les orios. Il puise dans l’énergie des forêts, de la pluie et du sang pour renforcer sa magie et celle de ses alliés.

Capable de canaliser les éléments, il manipule les forces du Sang, de l’Eau ou de la Terre pour amplifier ses sorts ou accroître la puissance de ses compagnons. Son lien profond avec les plus bas instincts des orios lui confère des avantages uniques, faisant de lui un maître du terrain et un catalyseur de force pure.', 'Le Chaman est un orios mystique, en harmonie avec les forces qui constituent les orios. Il puise dans l’énergie des forêts, de la pluie et du sang pour renforcer sa magie et celle de ses alliés.

Capable de canaliser les éléments, il manipule les forces du Sang, de l’Eau ou de la Terre pour amplifier ses sorts ou accroître la puissance de ses compagnons. Son lien profond avec les plus bas instincts des orios lui confère des avantages uniques, faisant de lui un maître du terrain et un catalyseur de force pure.', 'neutre', NULL, 'specialite', '{"id":"classes/orios#specialite:chaman"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 287, 'classes', 'Orios', 'Don Terreur du CAC', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec des dégâts de frappe.
x = +2 dégâts/6 niveau de orios.', 'Permet d''infliger 3+x dégâts avec des dégâts de frappe.
x = +2 dégâts/6 niveaux d''orios.', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-terreur-du-cac"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 288, 'classes', 'Orios', 'Don CHAMAN › Chaman', 'Effet', 'modifie', '+5% Magie et concentration, +5% Vigueur, +2 point de maîtrise à répartir, Maîtrise les Armures Intermédiaires, considérer comme classe magique', '+5% Magie et concentration, +5% Vigueur, +2 points de maîtrise à répartir, Maîtrise les Armures Intermédiaires, considérer comme classe magique', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-chaman"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 289, 'classes', 'Orios', 'Don VA-T-EN-GUERRE › Va-t-en-guerre', 'Nom', 'modifie', 'Va-t-en guerre', 'Va-t-en-guerre', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-va-t-en-guerre"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 290, 'classes', 'Orios', 'Don VA-T-EN-GUERRE › Va-t-en-guerre', 'Effet', 'modifie', '+5% Arme légères et lourdes, +5% Arc. Maîtrise les Armures Intermédiaires, 2 points de maîtrise à répartir.', '+5% Armes légères et lourdes, +5% Arc. Maîtrise les Armures Intermédiaires, 2 points de maîtrise à répartir.', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-va-t-en-guerre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 291, 'classes', 'Orios', 'Don VA-T-EN-GUERRE › Gigantisme', 'Remarque', 'modifie', 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permision d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permission d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-gigantisme"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 292, 'classes', 'Orios', 'Don VA-T-EN-GUERRE › Flèche géante', 'Effet', 'modifie', 'Les dégâts perforant de l''arc géant de guerre deviennent des dégâts de frappe contre des cibles plus petites que le porteur de l''arme.', 'Les dégâts perforants de l''arc géant de guerre deviennent des dégâts de frappe contre des cibles plus petites que le porteur de l''arme.', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-fleche-geante"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 293, 'classes', 'Orios', 'Don CHAMAN › Au poil', 'Effet', 'modifie', 'Les dégâts de Sang, d''Eau et Terre augmente +10', 'Les dégâts de Sang, d''Eau et Terre augmentent +10', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-au-poil"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 294, 'classes', 'Orios', 'Don VA-T-EN-GUERRE › Bandaison dure', 'Effet', 'modifie', 'Permet de faire un tir qui va ignorer la moitié des AP de la cible et infliger 1d de dégâts en plus. 50% de chance d''abîmé l''arme.', 'Permet de faire un tir qui va ignorer la moitié des AP de la cible et infliger 1d de dégâts en plus. 50% de chance d''abîmer l''arme.', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-bandaison-dure"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 295, 'classes', 'Orios', 'Don Super Force', 'Effet', 'modifie', 'Permet de résister à 2 malus lié à la Force.', 'Permet de résister à 2 malus liés à la Force.', 'neutre', NULL, 'capacite', '{"id":"capacites/orios-super-force"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 296, 'classes', 'Fenrir', 'Fenrir', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, pierre à aiguisé', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, pierre à aiguiser', 'neutre', NULL, 'classe', '{"id":"classes/fenrir"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 297, 'classes', 'Fenrir', 'Don BELLICISTE › Lame canine', 'Effet', 'modifie', 'Permet d''infliger x dégâts avec des dégâts de taille.
x = +2 dégâts/2 niveau de fenrir.', 'Permet d''infliger x dégâts avec des dégâts de taille.
x = +2 dégâts/2 niveaux de fenrir.', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-lame-canine"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 298, 'classes', 'Fenrir', 'Don BELLICISTE › Hurlement', 'Effet', 'modifie', 'Les alliés à 3 cases gagnent +4 à leur dégâts pendant 3 tours. Permet de donner des ordres précis à une créature canine alliée.', 'Les alliés à 3 cases gagnent +4 à leurs dégâts pendant 3 tours. Permet de donner des ordres précis à une créature canine alliée.', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-hurlement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 299, 'classes', 'Fenrir', 'Don GOUROU › Aura d''ombre', 'Effet', 'modifie', 'Permet d''annuler totalement une frappe de l’élément lumière, que ce soit dégâts ou effets secondaire', 'Permet d''annuler totalement une frappe de l’élément lumière, que ce soit dégâts ou effets secondaires', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-aura-dombre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 300, 'classes', 'Fenrir', 'Don BELLICISTE › Griffe sanglante', 'Nom', 'modifie', 'Griffe sanglant', 'Griffe sanglante', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-griffe-sanglant"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 301, 'classes', 'Fenrir', 'Don BELLICISTE › Griffe sanglante', 'Effet', 'modifie', 'Les armes tranchantes possède 20% de chance d''infliger saignement.', 'Les armes tranchantes possèdent 20% de chance d''infliger saignement.', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-griffe-sanglant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 302, 'classes', 'Kitsune', 'Kitsune', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, super carquois , remède gel mineur', 'Poudre de guérison, breuvage immonde, bloc dégoutant, super carquois , remède gel mineur', 'neutre', NULL, 'classe', '{"id":"classes/kitsune"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 303, 'classes', 'Kitsune', 'Spécialité DRUIDE', 'Description', 'modifie', 'Le Druide puise son pouvoir au plus profond de sa magie, manipulant le Feu, la Lumière ou le Vent avec aisance. Protecteur et guérisseur, il allège les souffrances tout en réduisant le coût de ses sorts élémentaires.

La connexion de sa race aux forces de la Lumière peut lui confèrer une vision claire à travers les illusions et une résistance aux attaques de l''ombre. À son apogée, il peut annuler des frappes ennemies et se téléporter à travers les flammes.', 'Le Druide puise son pouvoir au plus profond de sa magie, manipulant le Feu, la Lumière ou le Vent avec aisance. Protecteur et guérisseur, il allège les souffrances tout en réduisant le coût de ses sorts élémentaires.

La connexion de sa race aux forces de la Lumière peut lui conférer une vision claire à travers les illusions et une résistance aux attaques de l''ombre. À son apogée, il peut annuler des frappes ennemies et se téléporter à travers les flammes.', 'neutre', NULL, 'specialite', '{"id":"classes/kitsune#specialite:druide"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 304, 'classes', 'Kitsune', 'Don Renardo', 'Effet', 'modifie', 'Créer un renard fantomatique qui distrait ceux qui le voit, fait échouer les embuscades.', 'Créer un renard fantomatique qui distrait ceux qui le voient, fait échouer les embuscades.', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-renardo"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 305, 'classes', 'Kitsune', 'Don Sens aiguisés', 'Effet', 'modifie', '+2 à la zone de repérage et peut relancé le dé d''observation pour trouver les ennemis en mode discret ou camouflage', '+2 à la zone de repérage et peut relancer le dé d''observation pour trouver les ennemis en mode discret ou camouflage', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-sens-aiguises"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 306, 'classes', 'Kitsune', 'Don DRUIDE › Soin renforcé', 'Effet', 'modifie', 'Les sorts de soins ou fioles rouges/oranges/ mauves ont un bonus de +6 au soin.', 'Les sorts de soins ou fioles rouges/orange/ mauves ont un bonus de +6 au soin.', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-soin-renforce"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 307, 'classes', 'Kitsune', 'Don DRUIDE › Aura de lumière', 'Effet', 'modifie', 'Permet d''annuler totalement une frappe de l’élément ombre, que ce soit dégâts ou effets secondaire', 'Permet d''annuler totalement une frappe de l’élément ombre, que ce soit dégâts ou effets secondaires', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-aura-de-lumiere"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 308, 'classes', 'Kitsune', 'Don FRIPON › Dé pipé', 'Effet', 'modifie', 'Peut décidé du butin d''un ennemi au lieu de lancer le dé.', 'Peut décider du butin d''un ennemi au lieu de lancer le dé.', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-de-pipe"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 309, 'classes', 'Kitsune', 'Don FRIPON › Vive allure', 'Nom', 'modifie', 'Vif allure', 'Vive allure', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-vif-allure"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 310, 'classes', 'Kitsune', 'Don FRIPON › Tu m''vois pas !', 'Effet', 'modifie', 'Permet d''ignorer les attaques d’opportunités.', 'Permet d''ignorer les attaques d’opportunité.', 'neutre', NULL, 'capacite', '{"id":"capacites/kitsune-tu-mvois-pas"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 311, 'classes', 'Namazu', 'Namazu', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU Carquois N, canne à pêche', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU Carquois N, canne à pêche', 'neutre', NULL, 'classe', '{"id":"classes/namazu"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 312, 'classes', 'Namazu', 'Don Pointu', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec des dégâts d''estoc.
x = +2 dégâts/6 niveau de namazu.', 'Permet d''infliger 3+x dégâts avec des dégâts d''estoc.
x = +2 dégâts/6 niveaux de namazu.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-pointu"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 313, 'classes', 'Namazu', 'Don DEVIN › Eau pure', 'Effet', 'modifie', 'Les coûts pour les sortilèges de Eau, Sang et Ombre sont réduits de 4.', 'Les coûts pour les sortilèges d''Eau, Sang et Ombre sont réduits de 4.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-eau-pure"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 314, 'classes', 'Namazu', 'Don DEVIN › Branchie totale', 'Effet', 'modifie', 'Peut respirer dans une eau poluée à son paroxysme et les effets négatifs de l''eau sont annulés.', 'Peut respirer dans une eau polluée à son paroxysme et les effets négatifs de l''eau sont annulés.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-branchie-totale"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 315, 'classes', 'Namazu', 'Don DEVIN › Je mouille !', 'Effet', 'modifie', 'Utiliser de l''eau (naturel ou magique) permet de diviser par 2 le coût du prochain sort.', 'Utiliser de l''eau (naturelle ou magique) permet de diviser par 2 le coût du prochain sort.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-je-mouille"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 316, 'classes', 'Namazu', 'Don BATAILLEUR › Dent Infectée', 'Nom', 'modifie', 'Dent Infecté', 'Dent Infectée', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-dent-infecte"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 317, 'classes', 'Namazu', 'Don BATAILLEUR › Dent Infectée', 'Effet', 'modifie', 'La Morsure oblige un jet de vigeur à l''adversaire, si raté = Empoisonnement stade 2', 'La Morsure oblige un jet de vigueur à l''adversaire, si raté = Empoisonnement stade 2', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-dent-infecte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 318, 'classes', 'Namazu', 'Don BATAILLEUR › Dent d''acier', 'Effet', 'modifie', 'La Morsure à 25% de chance de retirer 1 point de solidité au morceau d''armure touché.', 'La Morsure a 25% de chance de retirer 1 point de solidité au morceau d''armure touché.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-dent-dacier"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 319, 'classes', 'Namazu', 'Don Roi des Eaux', 'Effet', 'modifie', '+8 dégâts, +1 à la vitesse, +4AP et +5% à tout les jets. Doit être dans l''eau.', '+8 dégâts, +1 à la vitesse, +4AP et +5% à tous les jets. Doit être dans l''eau.', 'neutre', NULL, 'capacite', '{"id":"capacites/namazu-roi-des-eaux"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 320, 'classes', 'Rokh', 'Rokh', 'Chose à savoir', 'modifie', 'Si une armure intermédaire ou lourde est portée, le vol est impossible.', 'Si une armure intermédiaire ou lourde est portée, le vol est impossible.', 'neutre', NULL, 'classe', '{"id":"classes/rokh"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 321, 'classes', 'Rokh', 'Rokh', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, super carquois, longue-vue', 'Poudre de guérison, breuvage immonde, bloc dégoutant, super carquois, longue-vue', 'neutre', NULL, 'classe', '{"id":"classes/rokh"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 322, 'classes', 'Rokh', 'Spécialité COLOMBE', 'Description', 'modifie', 'La Colombe est un rokh qui incarne la rapidité, la magie et la clairvoyance céleste. Maître du Vent, de la Foudre ou de la Lumière, elle réduit le coût de ses sorts et se déplace avec une aisance inégalée dans les airs.

Sa connexion aux tempêtes peut lui permet de canaliser la foudre pour se téléporter instantanément sur le champ de bataille. Grâce à sa vision perçante, elle peut détecte les points faibles ennemis. Insaisissable et baignée de lumière, elle domine le ciel comme un éclair lumineux.', 'La Colombe est un rokh qui incarne la rapidité, la magie et la clairvoyance céleste. Maître du Vent, de la Foudre ou de la Lumière, elle réduit le coût de ses sorts et se déplace avec une aisance inégalée dans les airs.

Sa connexion aux tempêtes peut lui permettre de canaliser la foudre pour se téléporter instantanément sur le champ de bataille. Grâce à sa vision perçante, elle peut détecter les points faibles ennemis. Insaisissable et baignée de lumière, elle domine le ciel comme un éclair lumineux.', 'neutre', NULL, 'specialite', '{"id":"classes/rokh#specialite:colombe"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 323, 'classes', 'Rokh', 'Don COLOMBE › Colombe', 'Effet', 'modifie', '+7% Magie, +7% Esquive, 2 points de maîtrise à réparti, considérer comme classe magique', '+7% Magie, +7% Esquive, 2 points de maîtrise à répartir, considérer comme classe magique', 'neutre', NULL, 'capacite', '{"id":"capacites/rokh-colombe"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 324, 'classes', 'Rokh', 'Don COLOMBE › Parafoudre', 'Effet', 'modifie', 'Augmente les chance de se prendre la foudre naturelle, dégâts divisés par 5.', 'Augmente les chances de se prendre la foudre naturelle, dégâts divisés par 5.', 'neutre', NULL, 'capacite', '{"id":"capacites/rokh-parafoudre"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 325, 'classes', 'Rokh', 'Don COLOMBE › Ciel Père', 'Effet', 'modifie', 'Les dégâts de Foudre, Vent et Lumière augmente de +10.', 'Les dégâts de Foudre, Vent et Lumière augmentent de +10.', 'neutre', NULL, 'capacite', '{"id":"capacites/rokh-ciel-pere"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 326, 'classes', 'Olwman', 'Olwman', 'Chose à savoir', 'modifie', 'Si une armure intermédaire ou lourde est portée, le vol est impossible.', 'Si une armure intermédiaire ou lourde est portée, le vol est impossible.', 'neutre', NULL, 'classe', '{"id":"classes/olwman"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 327, 'classes', 'Olwman', 'Olwman', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, super Carquois, parchemin gravé (sort magie innée)', 'Poudre de guérison, breuvage immonde, bloc dégoutant, super Carquois, parchemin gravé (sort magie innée)', 'neutre', NULL, 'classe', '{"id":"classes/olwman"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 328, 'classes', 'Olwman', 'Spécialité PAPE', 'Description', 'modifie', 'Le Pape est un olwman sage dont la perception dépasse celle des mortels. Sa vision à 360° ou sa clairvoyance lui permettent d’anticiper les dangers et d’atteindre les esprits intangibles.

Maître des éléments du Vent, de l’Ombre ou de l''Espace/Temps, il manipule le champ de bataille en influençant la vitesse et la position de ses adversaires. Lorsque le vent souffle, il se déplace avec une rapidité accru, et ses sorts déstabilisent ceux qui osent s’opposer à lui. Véritable architecte du combat, il façonne l’issue des affrontements par sa connaissance.', 'Le Pape est un olwman sage dont la perception dépasse celle des mortels. Sa vision à 360° ou sa clairvoyance lui permettent d’anticiper les dangers et d’atteindre les esprits intangibles.

Maître des éléments du Vent, de l’Ombre ou de l''Espace/Temps, il manipule le champ de bataille en influençant la vitesse et la position de ses adversaires. Lorsque le vent souffle, il se déplace avec une rapidité accrue, et ses sorts déstabilisent ceux qui osent s’opposer à lui. Véritable architecte du combat, il façonne l’issue des affrontements par sa connaissance.', 'neutre', NULL, 'specialite', '{"id":"classes/olwman#specialite:pape"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 329, 'classes', 'Olwman', 'Don PAPE › Acuité', 'Effet', 'modifie', 'Peut voir à 360°. Ce qui immunise aux attaques discrète et sournoises.', 'Peut voir à 360°. Ce qui immunise aux attaques discrètes et sournoises.', 'neutre', NULL, 'capacite', '{"id":"capacites/olwman-acuite"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 330, 'classes', 'Olwman', 'Don CHASSEUR › Fléau animal', 'Effet', 'modifie', 'Infligent +x dégâts contre les bêtes et hybrides animaux. 
x= +1 dégâts/2 niveau de olwman.', 'Infligent +x dégâts contre les bêtes et hybrides animaux. 
x= +1 dégâts/2 niveaux d''olwman.', 'neutre', NULL, 'capacite', '{"id":"capacites/olwman-fleau-animal"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 331, 'classes', 'Olwman', 'Don PAPE › Clairvoyance', 'Effet', 'modifie', 'Permet de toucher des créatures fantomatique avec des armes physiques.', 'Permet de toucher des créatures fantomatiques avec des armes physiques.', 'neutre', NULL, 'capacite', '{"id":"capacites/olwman-clairvoyance"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 332, 'classes', 'Olwman', 'Don CHASSEUR › Nocturne', 'Effet', 'modifie', 'Infligent +x dégâts la nuit. 
x= +2 dégâts/2 niveau de olwman.', 'Infligent +x dégâts la nuit. 
x= +2 dégâts/2 niveaux d''olwman.', 'neutre', NULL, 'capacite', '{"id":"capacites/olwman-nocturne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 333, 'classes', 'Olwman', 'Don CHASSEUR › Boucher', 'Effet', 'modifie', 'Permet d''obtenir Viande, Cuir, Chitine, ect... (1d4 pour chaque) en bonus sur un ennemi.', 'Permet d''obtenir Viande, Cuir, Chitine, etc... (1d4 pour chaque) en bonus sur un ennemi.', 'neutre', NULL, 'capacite', '{"id":"capacites/olwman-boucher"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 334, 'classes', 'Minotaure', 'Minotaure', 'Présentation', 'modifie', 'Similaire à l''Orios, le Minotaure est une force brute sur le champ de bataille, écrasant ses ennemis sous des frappes puissante. Chaque coup qu’il porte est un choc dévastateur, faisant trembler ceux qui osent l’affronter en duel.

Mais sa véritable force réside dans sa charge. Une fois lancé, il fonce droit sur sa cible, la percutant avant de l’enchaîner sous un assaut furieux. Que ce soit à mains nues ou avec une arme massive, il domine le combat par sa férocité et son impact écrasant.', 'Similaire à l''Orios, le Minotaure est une force brute sur le champ de bataille, écrasant ses ennemis sous des frappes puissantes. Chaque coup qu’il porte est un choc dévastateur, faisant trembler ceux qui osent l’affronter en duel.

Mais sa véritable force réside dans sa charge. Une fois lancé, il fonce droit sur sa cible, la percutant avant de l’enchaîner sous un assaut furieux. Que ce soit à mains nues ou avec une arme massive, il domine le combat par sa férocité et son impact écrasant.', 'neutre', NULL, 'classe', '{"id":"classes/minotaure"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 335, 'classes', 'Minotaure', 'Minotaure', 'Armure de départ', 'modifie', 'Armure de cuir complet (pas de vache hein ?)', 'Armure de cuir complète (pas de vache hein ?)', 'neutre', NULL, 'classe', '{"id":"classes/minotaure"}', 'armure_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 336, 'classes', 'Minotaure', 'Minotaure', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'neutre', NULL, 'classe', '{"id":"classes/minotaure"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 337, 'classes', 'Minotaure', 'Don Terreur du CAC', 'Effet', 'modifie', 'Permet d''infliger 3+x dégâts avec des dégâts de frappe.
x = +2 dégâts/6 niveau de minotaure.', 'Permet d''infliger 3+x dégâts avec des dégâts de frappe.
x = +2 dégâts/6 niveaux de minotaure.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-terreur-du-cac"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 338, 'classes', 'Minotaure', 'Don GLADIATEUR › Coup pointu', 'Effet', 'modifie', '+X dégâts avec les cornes et les sabots 
x = +2 dégâts/3 niveau de minotaure. Ignore les résistances des armures.', '+X dégâts avec les cornes et les sabots 
x = +2 dégâts/3 niveaux de minotaure. Ignore les résistances des armures.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-coup-pointu"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 339, 'classes', 'Minotaure', 'Don GLADIATEUR › Gigantisme', 'Remarque', 'modifie', 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permision d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'Bien entendu il est nécessaire d''avoir minimum 4 de force pour les porter : 
- Épée temple
- Claymore (qui devient une arme de force)
- Broyeur
- Hache de Bataille
- Bardiche
- Tronc
- Arc de guerre géant (là c''est juste une permission d''utiliser l''arme)
- Baliste portable (même chose que pour l''arc de guerre géant)', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-gigantisme"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 340, 'classes', 'Minotaure', 'Don GLADIATEUR › Fierté', 'Effet', 'modifie', '+6 AP si l''adversaire à une Force égale ou supérieure.', '+6 AP si l''adversaire a une Force égale ou supérieure.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-fierte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 341, 'classes', 'Minotaure', 'Don GLADIATEUR › Dominant', 'Effet', 'modifie', '+6 dégâts si l''adversaire à une Force égale ou inférieure.', '+6 dégâts si l''adversaire a une Force égale ou inférieure.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-dominant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 342, 'classes', 'Minotaure', 'Don GLADIATEUR › Parce QUE !', 'Nom', 'modifie', 'ParceQUE !', 'Parce QUE !', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-parceque"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 343, 'classes', 'Minotaure', 'Don MÉDIUM › Soif', 'Effet', 'modifie', 'Les dégâts de Sang, d''Ombre et Terre augmente +10.', 'Les dégâts de Sang, d''Ombre et Terre augmentent +10.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-soif"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 344, 'classes', 'Minotaure', 'Don Beuglement', 'Effet', 'modifie', 'Permet au début du combat d’obliger un jet de vigueur à l’équipe adverse, si ils ratent, ils prennent “peur 1”.', 'Permet au début du combat d’obliger un jet de vigueur à l’équipe adverse, s’ils ratent, ils prennent “peur 1”.', 'neutre', NULL, 'capacite', '{"id":"capacites/minotaure-beuglement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 345, 'classes', 'Satyre', 'Satyre', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, briquet', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, briquet', 'neutre', NULL, 'classe', '{"id":"classes/satyre"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 346, 'classes', 'Satyre', 'Spécialité ORACLE', 'Description', 'modifie', 'L’Oracle est un satyre troublant, oscillant entre sagesse et provocation, jouant avec l’esprit et les éléments. Son influence psychologique est telle qu’il peut manipuler le langage de ceux qui l’entourent, les plongeant dans une confusion inexplicable.

Puisant dans les forces de la Terre, du Feu ou de la Foudre, il amplifie ses dégâts à chaque coup reçu ou porté, transformant la souffrance en puissance. À son apogée, il peut stopper un combat temporairement, comme si il imposait une vision commune à tous.', 'L’Oracle est un satyre troublant, oscillant entre sagesse et provocation, jouant avec l’esprit et les éléments. Son influence psychologique est telle qu’il peut manipuler le langage de ceux qui l’entourent, les plongeant dans une confusion inexplicable.

Puisant dans les forces de la Terre, du Feu ou de la Foudre, il amplifie ses dégâts à chaque coup reçu ou porté, transformant la souffrance en puissance. À son apogée, il peut stopper un combat temporairement, comme s''il imposait une vision commune à tous.', 'neutre', NULL, 'specialite', '{"id":"classes/satyre#specialite:oracle"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 347, 'classes', 'Médusain', 'Médusain', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, canne à pêche', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, canne à pêche', 'neutre', NULL, 'classe', '{"id":"classes/medusain"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 348, 'classes', 'Médusain', 'Don Tentalongue', 'Effet', 'modifie', 'Les altérations d''états infligées par les tentacules dure 1 tour de plus.', 'Les altérations d''états infligées par les tentacules durent 1 tour de plus.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-tentalongue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 349, 'classes', 'Médusain', 'Don HOPLITE › Pointu', 'Effet', 'modifie', 'Les dégâts d''estoc augmente de +8.', 'Les dégâts d''estoc augmentent de +8.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-pointu"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 350, 'classes', 'Médusain', 'Don HOPLITE › Tentattaque', 'Effet', 'modifie', 'Arrache une tentacule pour la mettre sur l''arme et ainsi obliger un jet de vigueur à la cible pour ne prendre l''altération d''état.', 'Arrache un tentacule pour le mettre sur l''arme et ainsi obliger un jet de vigueur à la cible pour ne prendre l''altération d''état.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-tentattaque"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 351, 'classes', 'Médusain', 'Don AUGURE › Shrapnel', 'Effet', 'modifie', 'A la rupture de sa barrière le médusain bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'À la rupture de sa barrière le médusain bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-shrapnel"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 352, 'classes', 'Médusain', 'Don AUGURE › Fil conducteur', 'Effet', 'modifie', 'Les dégâts d''Eau et de Foudre augmente de 5 quand ils sont fait dans l''eau.', 'Les dégâts d''Eau et de Foudre augmentent de 5 quand ils sont faits dans l''eau.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-fil-conducteur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 353, 'classes', 'Médusain', 'Don HOPLITE › Passe bouclier', 'Effet', 'modifie', 'Les armes de jet ignorent les PA apporté par les boucliers.', 'Les armes de jet ignorent les PA apportés par les boucliers.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-passe-bouclier"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 354, 'classes', 'Médusain', 'Don AUGURE › Irukandji', 'Effet', 'modifie', 'Permet d''infliger un poison qui provoque une douleur si forte à une cible qu''elle est incapble d''agir pendant 2 tours.', 'Permet d''infliger un poison qui provoque une douleur si forte à une cible qu''elle est incapable d''agir pendant 2 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-irukandji"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 355, 'classes', 'Médusain', 'Don AUGURE › Abyssal', 'Effet', 'modifie', 'Les dégâts de Eau, Foudre et Lumière augmentent de +10.', 'Les dégâts d''Eau, Foudre et Lumière augmentent de +10.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-abyssal"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 356, 'classes', 'Jackalope', 'Jackalope', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (10m)', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (10m)', 'neutre', NULL, 'classe', '{"id":"classes/jackalope"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 357, 'classes', 'Jackalope', 'Spécialité ADEPTE', 'Description', 'modifie', 'L’Adepte est un érudit du combat, puisant dans les flux de la Terre, du Foudre et du Vide pour équilibrer sa puissance et ses connaissances.

Doté d’une perception mentale affinée, il capte ceux qui use et abuse de la communication par la pensée. Il peut également transformer des sorts en techniques non-létales, prouvant que la force réside autant dans la maîtrise que dans la puissance brute. Polyglotte du Vide, il brise les barrières de la compréhension, communiquant avec des entités que peu connaissent.', 'L’Adepte est un érudit du combat, puisant dans les flux de la Terre, du Foudre et du Vide pour équilibrer sa puissance et ses connaissances.

Doté d’une perception mentale affinée, il capte ceux qui usent et abusent de la communication par la pensée. Il peut également transformer des sorts en techniques non-létales, prouvant que la force réside autant dans la maîtrise que dans la puissance brute. Polyglotte du Vide, il brise les barrières de la compréhension, communiquant avec des entités que peu connaissent.', 'neutre', NULL, 'specialite', '{"id":"classes/jackalope#specialite:adepte"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 358, 'classes', 'Jackalope', 'Don Empressement', 'Effet', 'modifie', 'Donne un bonus de 1+x à l''initiative.
x = +1 INI/5 niveau de jackalope.', 'Donne un bonus de 1+x à l''initiative.
x = +1 INI/5 niveaux de jackalope.', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-empressement"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 359, 'classes', 'Jackalope', 'Don À la sieste !', 'Nom', 'modifie', 'A la sieste !', 'À la sieste !', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-a-la-sieste"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 360, 'classes', 'Jackalope', 'Don ADEPTE › Adepte', 'Effet', 'modifie', '+7% Magie OU Concentration, +7% Manipulation, 2 points de maîtrise à réparti, considérer comme classe magique', '+7% Magie OU Concentration, +7% Manipulation, 2 points de maîtrise à répartir, considérer comme classe magique', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-adepte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 361, 'classes', 'Jackalope', 'Don NINJA › Pattes fortes', 'Effet', 'modifie', 'Permet de lancer 2d100 sur la compétence Stabilité/Réfléxe et de garder le meilleur des deux résultats.', 'Permet de lancer 2d100 sur la compétence Stabilité/Réflexe et de garder le meilleur des deux résultats.', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-pattes-fortes"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 362, 'classes', 'Jackalope', 'Don ADEPTE › Indiscrétion', 'Effet', 'modifie', 'Permet de capter les liens mentaux fait par des utilisateurs du Vide.', 'Permet de capter les liens mentaux faits par des utilisateurs du Vide.', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-indiscretion"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 363, 'classes', 'Jackalope', 'Don NINJA › Élan', 'Effet', 'modifie', 'Permet de sprinter et d''enchaîner avec une action. (Les IC ne sont pas possible)', 'Permet de sprinter et d''enchaîner avec une action. (Les IC ne sont pas possibles)', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-elan"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 364, 'classes', 'Jackalope', 'Don NINJA › Survitaminé', 'Effet', 'modifie', 'Augmente de 50% les dégats physiques mais brise sa posture et perd son action pour le prochain tour.', 'Augmente de 50% les dégâts physiques mais brise sa posture et perd son action pour le prochain tour.', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-survitamine"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 365, 'classes', 'Jackalope', 'Don NINJA › Sursaut', 'Effet', 'modifie', 'Une esquive réussi permet de faire un grand saut et déjouer les attaques d''opportunité', 'Une esquive réussie permet de faire un grand saut et déjouer les attaques d''opportunité', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-sursaut"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 366, 'classes', 'Marcass', 'Marcass', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, KDR Armure', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, KDR Armure', 'neutre', NULL, 'classe', '{"id":"classes/marcass"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 367, 'classes', 'Marcass', 'Spécialité DÉVOT', 'Description', 'modifie', 'Le Dévot est un mage singulier, fusionnant sa foi et sa magie pour créer un lien profond avec les éléments et les forces mystiques. Son pouvoir dépend fortement de son apparence et des couleurs qu’il porte, lui conférant des bonus spécifiques en fonction de son affinité avec le Feu, la Terre ou la Nécromancie.

Il possède une relation unique avec les esprits et les morts, capable de se nourrir de la chair des défunts pour restaurer sa propre Barrière, un talent qui le rapproche des anciennes pratique de l''époque où les marcass étaient des esclaves. Son art du Totémisme lui permet d’ériger des sanctuaires de magie innée, offrant des avantages tactiques durables à lui et ses alliés.', 'Le Dévot est un mage singulier, fusionnant sa foi et sa magie pour créer un lien profond avec les éléments et les forces mystiques. Son pouvoir dépend fortement de son apparence et des couleurs qu’il porte, lui conférant des bonus spécifiques en fonction de son affinité avec le Feu, la Terre ou la Nécromancie.

Il possède une relation unique avec les esprits et les morts, capable de se nourrir de la chair des défunts pour restaurer sa propre Barrière, un talent qui le rapproche des anciennes pratiques de l''époque où les marcass étaient des esclaves. Son art du Totémisme lui permet d’ériger des sanctuaires de magie innée, offrant des avantages tactiques durables à lui et ses alliés.', 'neutre', NULL, 'specialite', '{"id":"classes/marcass#specialite:devot"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 368, 'classes', 'Marcass', 'Don Charge porcine', 'Effet', 'modifie', 'Permet d''avoir un bonus de +2 à la vitesse. Possible uniquement en ligne droite et si il y a une cible à l''arrivée.', 'Permet d''avoir un bonus de +2 à la vitesse. Possible uniquement en ligne droite et s''il y a une cible à l''arrivée.', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-charge-porcine"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 369, 'classes', 'Marcass', 'Don DÉVOT › Totémiste', 'Nom', 'modifie', 'Totemiste', 'Totémiste', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-totemiste"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 370, 'classes', 'Marcass', 'Don DÉVOT › Totémiste', 'Effet', 'modifie', 'Peut se creer un totem de sa magie innée qui donne un bonus de terrain pour lui et ces allié.
Dure 3 tours.', 'Peut se créer un totem de sa magie innée qui donne un bonus de terrain pour lui et ses alliés.
Dure 3 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-totemiste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 371, 'classes', 'Marcass', 'Don DÉVOT › Totémiste', 'Remarque', 'modifie', 'Terre : Réduit les dégâts encaissés de 4.

Feu : Augmente les dégâts infligés de 4. 

Nécromancie : Économise 1 chakra à chaque sorts lancés.', 'Terre : Réduit les dégâts encaissés de 4.

Feu : Augmente les dégâts infligés de 4. 

Nécromancie : Économise 1 chakra à chaque sort lancé.', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-totemiste"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 372, 'classes', 'Marcass', 'Don CANAILLE › Lance fétiche', 'Effet', 'modifie', 'Les échecs critiques sont réduit de 2 quand une lance est impliquée.', 'Les échecs critiques sont réduits de 2 quand une lance est impliquée.', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-lance-fetiche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 373, 'classes', 'Marcass', 'Don CANAILLE › Lance-totem', 'Remarque', 'modifie', 'Si une cible réussi un jet de défense parfait, l''attaque est stoppée', 'Si une cible réussit un jet de défense parfait, l''attaque est stoppée', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-lance-totem"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 374, 'classes', 'Anansi', 'Anansi', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, panacée mineur', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, panacée mineure', 'neutre', NULL, 'classe', '{"id":"classes/anansi"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 375, 'classes', 'Anansi', 'Don Coup d''patte', 'Effet', 'modifie', 'Chaque attaque de corps à corps sera suivi d''un coup de patte qui infligera 1d8 de dégâts. (Estoc pour les F, Frappe pour les M)', 'Chaque attaque de corps à corps sera suivie d''un coup de patte qui infligera 1d8 de dégâts. (Estoc pour les F, Frappe pour les M)', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-coup-dpatte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 376, 'classes', 'Anansi', 'Don Coup d''patte', 'Remarque', 'modifie', 'Le coup de pattes n''est compter qu''une fois. Le bimane ne peut faire en sorte que la patte tape deux fois dans le même tour.', 'Le coup de pattes n''est compté qu''une fois. Le bimane ne peut faire en sorte que la patte tape deux fois dans le même tour.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-coup-dpatte"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 377, 'classes', 'Anansi', 'Don Piège-toile', 'Remarque', 'modifie', 'La cible peut réussir un jet d''athlétisme/réfléxe pour s''oter de la toile.', 'La cible peut réussir un jet d''athlétisme/réflexe pour s''ôter de la toile.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-piege-toile"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 378, 'classes', 'Anansi', 'Don MARIONNETTISTE › Marionnettiste', 'Effet', 'modifie', '+7% Armes légères ou lourdes, +7% Stabilité ou Réflèxe, 2 points de maîtrise à répartir.', '+7% Armes légères ou lourdes, +7% Stabilité ou Réflexe, 2 points de maîtrise à répartir.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-marionnettiste"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 379, 'classes', 'Anansi', 'Don MARIONNETTISTE › Frappatte', 'Effet', 'modifie', 'Le coup de patte inflige 1d8 dégâts supplémentaire.', 'Le coup de patte inflige 1d8 dégâts supplémentaires.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-frappatte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 380, 'classes', 'Anansi', 'Don CEMIES › PT bond', 'Effet', 'modifie', 'Le piège-toile peut s''activer et bloquer un projectile ennemi si jamais ce dernier passe dans la zone du piège (jet de chance necessaire pour le bloquer)', 'Le piège-toile peut s''activer et bloquer un projectile ennemi si jamais ce dernier passe dans la zone du piège (jet de chance nécessaire pour le bloquer)', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-pt-bond"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 381, 'classes', 'Anansi', 'Don MARIONNETTISTE › Attention mygale !', 'Nom', 'modifie', 'Attention migale !', 'Attention mygale !', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-attention-migale"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 382, 'classes', 'Anansi', 'Don MARIONNETTISTE › Attention mygale !', 'Effet', 'modifie', 'Créer une fausse araignée et le jette sur la cible, cette dernière doit réussir un jet de Fermeté pour ne pas perdre son tour.', 'Crée une fausse araignée et la jette sur la cible, cette dernière doit réussir un jet de Fermeté pour ne pas perdre son tour.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-attention-migale"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 383, 'classes', 'Anansi', 'Don CEMIES › Multi-tâche', 'Nom', 'modifie', 'Multi-tache', 'Multi-tâche', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-multi-tache"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 384, 'classes', 'Anansi', 'Don CEMIES › PT fragile', 'Remarque', 'modifie', '*Dans le cas de l''Arcane, ce sera aléatoire parmi les autres magies qui existe.', '*Dans le cas de l''Arcane, ce sera aléatoire parmi les autres magies qui existent.', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-pt-fragile"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 385, 'classes', 'Anansi', 'Don CEMIES › Anticorps', 'Nom', 'modifie', 'Anti-corps', 'Anticorps', 'neutre', NULL, 'capacite', '{"id":"capacites/anansi-anti-corps"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 386, 'classes', 'Goleois', 'Goleois', 'Chose à savoir', 'modifie', 'Le gameplay de rage se retrouve aussi chez le Martiale, les effets positif et négatif se combine entre eux. Mais par contre la durée, elle, ne se cumule pas.

Un chant à la fois.', 'Le gameplay de rage se retrouve aussi chez le Martiale, les effets positif et négatif se combinent entre eux. Mais par contre la durée, elle, ne se cumule pas.

Un chant à la fois.', 'neutre', NULL, 'classe', '{"id":"classes/goleois"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 387, 'classes', 'Goleois', 'Goleois', 'Inventaire de départ (objets séparés par « , », « A OU B »)', 'modifie', 'Poudre de guérison, brevage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'Poudre de guérison, breuvage immonde, bloc dégoutant, KDR Arme OU carquois N, corde (5m)', 'neutre', NULL, 'classe', '{"id":"classes/goleois"}', 'inventaire_depart');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 388, 'classes', 'Goleois', 'Don Rage', 'Effet', 'modifie', 'Active un pouvoir de rage qui augmente de +3 les dégâts et de +2 les dégâts subis pendant 3 tours + 1 tour tout les 5 niveaux de la classe', 'Active un pouvoir de rage qui augmente de +3 les dégâts et de +2 les dégâts subis pendant 3 tours + 1 tour tous les 5 niveaux de la classe', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-rage"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 389, 'classes', 'Goleois', 'Don Ballade barbare', 'Nom', 'modifie', 'Balade barbare', 'Ballade barbare', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-balade-barbare"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 390, 'classes', 'Goleois', 'Don Ballade barbare', 'Effet', 'modifie', '+3 dégâts et 1d8 santé temporaire pour tout les alliés pendant 3 tours.', '+3 dégâts et 1d8 santé temporaire pour tous les alliés pendant 3 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-balade-barbare"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 391, 'classes', 'Goleois', 'Don SARONIDE › Saronide', 'Effet', 'modifie', '+7% Concentration OU Magie, +7% Stabilité. Concidérer comme une classe magique, 2 points de maîtrise à répartir.', '+7% Concentration OU Magie, +7% Stabilité. Considérer comme une classe magique, 2 points de maîtrise à répartir.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-saronide"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 392, 'classes', 'Goleois', 'Don SARONIDE › Chant .', 'Effet', 'modifie', 'Force un jet de vigueur aux ennemis, si ils ratent, ils sont étourdi pendant 2 tours.', 'Force un jet de vigueur aux ennemis, s''ils ratent, ils sont étourdis pendant 2 tours.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-chant-10"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 393, 'classes', 'Goleois', 'Don IRRÉDUCTIBLE › ... bec', 'Effet', 'modifie', '(Rage)
Si plus de 5 coups ont été pris pendant le combat = +8 dégâts jusqu''a la fin du combat', '(Rage)
Si plus de 5 coups ont été pris pendant le combat = +8 dégâts jusqu''à la fin du combat', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-bec"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 394, 'classes', 'Goleois', 'Don SARONIDE › Chant ..', 'Effet', 'modifie', 'Permet pendant 2 tours d''être immunisé aux attaques sournoise et discrète pour les alliés et le lanceur.', 'Permet pendant 2 tours d''être immunisé aux attaques sournoises et discrètes pour les alliés et le lanceur.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-chant-15"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 395, 'classes', 'Goleois', 'Don IRRÉDUCTIBLE › ... jaune', 'Effet', 'modifie', '(Rage)
Tant que la barrière est présente, les dégâts subit n''augmente pas.', '(Rage)
Tant que la barrière est présente, les dégâts subis n''augmentent pas.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 396, 'classes', 'Archimage', 'Archimage', 'Chose à savoir', 'modifie', 'Cette classe est unique au potentiel illimité, vous ne pouvez pas la prendre si vous n''êtes pas du potentiel illimité et est imposé quand vous êtes du potentiel illimité.', 'Cette classe est unique au potentiel illimité, vous ne pouvez pas la prendre si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.', 'neutre', NULL, 'classe', '{"id":"classes/archimage"}', 'chose_a_savoir');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 397, 'classes', 'Archimage', 'Don Création vivante', 'Effet', 'modifie', 'Double le nombre d''utilisation des créations d''arme magique et augmente leur dégat de X. (X = lniveau d''Archimage/5)', 'Double le nombre d''utilisation des créations d''arme magique et augmente leur dégât de X. (X = lniveau d''Archimage/5)', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-creation-vivante"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 398, 'classes', 'Archimage', 'Don Moissonneur', 'Effet', 'modifie', '(Barre d''âme débloquer) Permet de récolter des âmes jusqu''à +10 âmes', '(Barre d''âme débloquée) Permet de récolter des âmes jusqu''à +10 âmes', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-moissonneur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 399, 'classes', 'Archimage', 'Don Rituel Interdit', 'Effet', 'modifie', '(Barre de sang débloquer) Par un rituel, permet de sacrifier 1pv par sang, jusqu''à un maximum de +10 sang', '(Barre de sang débloquée) Par un rituel, permet de sacrifier 1pv par sang, jusqu''à un maximum de +10 sang', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-rituel-interdit"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 400, 'classes', 'Archimage', 'Don Pacte Noir', 'Nom', 'modifie', 'Pacte Noire', 'Pacte Noir', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-pacte-noire"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 401, 'classes', 'Archimage', 'Don Choix', 'Effet', 'modifie', 'Choisissez 2 magies auquelles vous allez être résistant.', 'Choisissez 2 magies auxquelles vous allez être résistant.', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-choix"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 402, 'classes', 'Archimage', 'Don Semi-complet', 'Nom', 'modifie', 'Semi complet', 'Semi-complet', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-semi-complet"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 403, 'races', 'Humain', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/humain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 404, 'races', 'Humain', 'Humain', 'Onglet de la race', 'ajoute', NULL, 'Humain', 'neutre', NULL, 'race_onglet', '{"race_id":"races/humain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 405, 'races', 'Humain', 'Don racial Adaptation humaine', 'Don racial', 'ajoute', NULL, 'Don racial Adaptation humaine', 'neutre', NULL, 'race_don', '{"id":"races/humain#don:humain-central"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 406, 'races', 'Humain', 'Don racial Homme du désert', 'Don racial', 'ajoute', NULL, 'Don racial Homme du désert', 'neutre', NULL, 'race_don', '{"id":"races/humain#don:humain-desertique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 407, 'races', 'Humain', 'Don racial Tempête sage', 'Don racial', 'ajoute', NULL, 'Don racial Tempête sage', 'neutre', NULL, 'race_don', '{"id":"races/humain#don:humain-tropical"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 408, 'races', 'Humain', 'Don racial Homme Blizzard', 'Don racial', 'ajoute', NULL, 'Don racial Homme Blizzard', 'neutre', NULL, 'race_don', '{"id":"races/humain#don:humain-toundra"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 409, 'races', 'Nain', 'Nain', 'Onglet de la race', 'ajoute', NULL, 'Nain', 'neutre', NULL, 'race_onglet', '{"race_id":"races/nain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 410, 'races', 'Nain', 'Don racial Londolor Est', 'Don racial', 'ajoute', NULL, 'Don racial Londolor Est', 'neutre', NULL, 'race_don', '{"id":"races/nain#don:londolor-est"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 411, 'races', 'Nain', 'Don racial Londolor Ouest', 'Don racial', 'ajoute', NULL, 'Don racial Londolor Ouest', 'neutre', NULL, 'race_don', '{"id":"races/nain#don:londolor-ouest"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 412, 'races', 'Nain', 'Don racial Londolor Centre (Ligne de partage)', 'Don racial', 'ajoute', NULL, 'Don racial Londolor Centre (Ligne de partage)', 'neutre', NULL, 'race_don', '{"id":"races/nain#don:londolor-centre-ligne-de-partage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 413, 'races', 'Nain', 'Nain', 'Magies innées', 'modifie', 'Potentiel Illimité, Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre', 'Potentiel Illimité, Arcane, Feu, Terre, Foudre', 'neutre', NULL, 'race_magie', '{"race_id":"races/nain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 414, 'races', 'Nain', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/nain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 415, 'races', 'Elfe forestier', 'Elfe forestier', 'Présentation', 'modifie', 'Les elfes des arbres, agile et rapide', 'Les elfes des arbres, agiles et rapides', 'neutre', NULL, 'race', '{"id":"races/elfe-forestier"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 416, 'races', 'Elfe forestier', 'Elfe forestier', 'Onglet de la race', 'ajoute', NULL, 'Elfe forestier', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-forestier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 417, 'races', 'Elfe forestier', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/elfe-forestier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 418, 'races', 'Elfe forestier', 'Don racial Forêt ou les villes des territoires Elfe forestier', 'Don racial', 'ajoute', NULL, 'Don racial Forêt ou les villes des territoires Elfe forestier', 'neutre', NULL, 'race_don', '{"id":"races/elfe-forestier#don:foret-ou-les-villes-des-territoires-elfe-forestier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 419, 'races', 'Elfe forestier', 'Don racial Urbain (tout le reste)', 'Don racial', 'ajoute', NULL, 'Don racial Urbain (tout le reste)', 'neutre', NULL, 'race_don', '{"id":"races/elfe-forestier#don:urbain-tout-le-reste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 420, 'races', 'Elfe doré', 'Elfe doré', 'Onglet de la race', 'ajoute', NULL, 'Elfe doré', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-dore"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 421, 'races', 'Elfe doré', 'Don racial Sang doré', 'Don racial', 'ajoute', NULL, 'Don racial Sang doré', 'neutre', NULL, 'race_don', '{"id":"races/elfe-dore#don:sang-dore"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 422, 'races', 'Elfe doré', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/elfe-dore"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 423, 'races', 'Elfe argenté', 'Elfe argenté', 'Présentation', 'modifie', 'Des elfes très fort en magie', 'Des elfes très forts en magie', 'neutre', NULL, 'race', '{"id":"races/elfe-argente"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 424, 'races', 'Elfe argenté', 'Elfe argenté', 'Onglet de la race', 'ajoute', NULL, 'Elfe argenté', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-argente"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 425, 'races', 'Elfe argenté', 'Don racial Territoire Elfes Argentés', 'Don racial', 'ajoute', NULL, 'Don racial Territoire Elfes Argentés', 'neutre', NULL, 'race_don', '{"id":"races/elfe-argente#don:territoire-elfes-argentes"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 426, 'races', 'Elfe argenté', 'Don racial Barrage Argenté', 'Don racial', 'ajoute', NULL, 'Don racial Barrage Argenté', 'neutre', NULL, 'race_don', '{"id":"races/elfe-argente#don:barrage-argente"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 427, 'races', 'Elfe argenté', 'Don racial Ailleurs', 'Don racial', 'ajoute', NULL, 'Don racial Ailleurs', 'neutre', NULL, 'race_don', '{"id":"races/elfe-argente#don:ailleurs"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 428, 'races', 'Elfe argenté', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/elfe-argente"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 429, 'races', 'Elfe noir', 'Elfe noir', 'Présentation', 'modifie', 'Les elfes à la peau noir ou blanche', 'Les elfes à la peau noire ou blanche', 'neutre', NULL, 'race', '{"id":"races/elfe-noir"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 430, 'races', 'Elfe noir', 'Elfe noir', 'Onglet de la race', 'ajoute', NULL, 'Elfe noir', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-noir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 431, 'races', 'Elfe noir', 'Don racial Sang corrompu', 'Don racial', 'ajoute', NULL, 'Don racial Sang corrompu', 'neutre', NULL, 'race_don', '{"id":"races/elfe-noir#don:elfe-charbon"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 432, 'races', 'Elfe noir', 'Don racial Sang purifié', 'Don racial', 'ajoute', NULL, 'Don racial Sang purifié', 'neutre', NULL, 'race_don', '{"id":"races/elfe-noir#don:elfe-sale"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 433, 'races', 'Elfe noir', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/elfe-noir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 434, 'races', 'Farfadet', 'Farfadet', 'Onglet de la race', 'ajoute', NULL, 'Farfadet', 'neutre', NULL, 'race_onglet', '{"race_id":"races/farfadet"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 435, 'races', 'Farfadet', 'Don racial Farfadet Médian (Forêts tempérées, centraux)', 'Don racial', 'ajoute', NULL, 'Don racial Farfadet Médian (Forêts tempérées, centraux)', 'neutre', NULL, 'race_don', '{"id":"races/farfadet#don:farfadet-median-forets-temperees-centraux"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 436, 'races', 'Farfadet', 'Don racial Farfadet Maritime (Forêts proches de l''eau)', 'Don racial', 'ajoute', NULL, 'Don racial Farfadet Maritime (Forêts proches de l''eau)', 'neutre', NULL, 'race_don', '{"id":"races/farfadet#don:farfadet-maritime-forets-proches-de-leau"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 437, 'races', 'Farfadet', 'Don racial Farfadet Amazone (Jungle)', 'Don racial', 'ajoute', NULL, 'Don racial Farfadet Amazone (Jungle)', 'neutre', NULL, 'race_don', '{"id":"races/farfadet#don:farfadet-amazone-jungle"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 438, 'races', 'Farfadet', 'Don racial Farfadet Alpin (Forêts montagneuses, taïga)', 'Don racial', 'ajoute', NULL, 'Don racial Farfadet Alpin (Forêts montagneuses, taïga)', 'neutre', NULL, 'race_don', '{"id":"races/farfadet#don:farfadet-alpin-forets-montagneuses-taiga"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 439, 'races', 'Farfadet', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/farfadet"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 440, 'races', 'Felfe', 'Felfe', 'Onglet de la race', 'ajoute', NULL, 'Felfe', 'neutre', NULL, 'race_onglet', '{"race_id":"races/felfe"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 441, 'races', 'Felfe', 'Don racial Sang féerique forêt', 'Don racial', 'ajoute', NULL, 'Don racial Sang féerique forêt', 'neutre', NULL, 'race_don', '{"id":"races/felfe#don:felfe-forestier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 442, 'races', 'Felfe', 'Don racial Sang féerique corrompu', 'Don racial', 'ajoute', NULL, 'Don racial Sang féerique corrompu', 'neutre', NULL, 'race_don', '{"id":"races/felfe#don:felfe-noir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 443, 'races', 'Felfe', 'Don racial Sang féerique brillant', 'Don racial', 'ajoute', NULL, 'Don racial Sang féerique brillant', 'neutre', NULL, 'race_don', '{"id":"races/felfe#don:felfe-argente"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 444, 'races', 'Felfe', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/felfe"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 445, 'races', 'Majin', 'Majin', 'Onglet de la race', 'ajoute', NULL, 'Majin', 'neutre', NULL, 'race_onglet', '{"race_id":"races/majin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 446, 'races', 'Majin', 'Don racial Renfermement', 'Don racial', 'ajoute', NULL, 'Don racial Renfermement', 'neutre', NULL, 'race_don', '{"id":"races/majin#don:renfermement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 447, 'races', 'Majin', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/majin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 448, 'races', 'Hujin', 'Hujin', 'Présentation', 'modifie', 'Le fruit de deux monde différent mais similaire', 'Le fruit de deux mondes différents mais similaires', 'neutre', NULL, 'race', '{"id":"races/hujin"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 449, 'races', 'Hujin', 'Hujin', 'Onglet de la race', 'ajoute', NULL, 'Hujin', 'neutre', NULL, 'race_onglet', '{"race_id":"races/hujin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 450, 'races', 'Hujin', 'Don racial Élasticité', 'Don racial', 'ajoute', NULL, 'Don racial Élasticité', 'neutre', NULL, 'race_don', '{"id":"races/hujin#don:elasticite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 451, 'races', 'Hujin', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/hujin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 452, 'races', 'Drakos', 'Drakos', 'Onglet de la race', 'ajoute', NULL, 'Drakos', 'neutre', NULL, 'race_onglet', '{"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 453, 'races', 'Drakos', 'Tableau des dons : en-tête 1', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 1', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/drakos","rang":1}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 454, 'races', 'Drakos', 'Tableau des dons : en-tête 2', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 2', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/drakos","rang":2}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 455, 'races', 'Drakos', 'Tableau des dons : en-tête 3', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 3', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/drakos","rang":3}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 456, 'races', 'Drakos', 'Tableau des dons : en-tête 4', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 4', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/drakos","rang":4}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 457, 'races', 'Drakos', 'Tableau des dons : ligne 1 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 1 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":1,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 458, 'races', 'Drakos', 'Tableau des dons : Potentiel illimité × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Potentiel illimité × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":1,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 459, 'races', 'Drakos', 'Tableau des dons : Potentiel illimité × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Potentiel illimité × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":1,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 460, 'races', 'Drakos', 'Tableau des dons : Potentiel illimité × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Potentiel illimité × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":1,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 461, 'races', 'Drakos', 'Tableau des dons : ligne 2 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 2 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":2,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 462, 'races', 'Drakos', 'Tableau des dons : Sang × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Sang × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":2,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 463, 'races', 'Drakos', 'Tableau des dons : Sang × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Sang × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":2,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 464, 'races', 'Drakos', 'Tableau des dons : Sang × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Sang × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":2,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 465, 'races', 'Drakos', 'Tableau des dons : ligne 3 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 3 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":3,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 466, 'races', 'Drakos', 'Tableau des dons : Arcane × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Arcane × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":3,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 467, 'races', 'Drakos', 'Tableau des dons : Arcane × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Arcane × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":3,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 468, 'races', 'Drakos', 'Tableau des dons : Arcane × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Arcane × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":3,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 469, 'races', 'Drakos', 'Tableau des dons : ligne 4 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 4 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":4,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 470, 'races', 'Drakos', 'Tableau des dons : Corruption × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Corruption × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":4,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 471, 'races', 'Drakos', 'Tableau des dons : Corruption × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Corruption × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":4,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 472, 'races', 'Drakos', 'Tableau des dons : Corruption × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Corruption × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":4,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 473, 'races', 'Drakos', 'Tableau des dons : ligne 5 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 5 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":5,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 474, 'races', 'Drakos', 'Tableau des dons : Temps/Espace × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Temps/Espace × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":5,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 475, 'races', 'Drakos', 'Tableau des dons : Temps/Espace × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Temps/Espace × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":5,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 476, 'races', 'Drakos', 'Tableau des dons : Temps/Espace × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Temps/Espace × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":5,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 477, 'races', 'Drakos', 'Tableau des dons : ligne 6 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 6 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":6,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 478, 'races', 'Drakos', 'Tableau des dons : Vide × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Vide × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":6,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 479, 'races', 'Drakos', 'Tableau des dons : Vide × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Vide × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":6,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 480, 'races', 'Drakos', 'Tableau des dons : Vide × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Vide × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":6,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 481, 'races', 'Drakos', 'Tableau des dons : ligne 7 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 7 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":7,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 482, 'races', 'Drakos', 'Tableau des dons : Nécromancie × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Nécromancie × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":7,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 483, 'races', 'Drakos', 'Tableau des dons : Nécromancie × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Nécromancie × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":7,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 484, 'races', 'Drakos', 'Tableau des dons : Nécromancie × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Nécromancie × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":7,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 485, 'races', 'Drakos', 'Tableau des dons : ligne 8 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 8 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":8,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 486, 'races', 'Drakos', 'Tableau des dons : Feu × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Feu × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":8,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 487, 'races', 'Drakos', 'Tableau des dons : Feu × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Feu × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":8,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 488, 'races', 'Drakos', 'Tableau des dons : Feu × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Feu × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":8,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 489, 'races', 'Drakos', 'Tableau des dons : ligne 9 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 9 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":9,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 490, 'races', 'Drakos', 'Tableau des dons : Eau × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Eau × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":9,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 491, 'races', 'Drakos', 'Tableau des dons : Eau × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Eau × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":9,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 492, 'races', 'Drakos', 'Tableau des dons : Eau × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Eau × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":9,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 493, 'races', 'Drakos', 'Tableau des dons : ligne 10 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 10 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":10,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 494, 'races', 'Drakos', 'Tableau des dons : Glace × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Glace × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":10,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 495, 'races', 'Drakos', 'Tableau des dons : Glace × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Glace × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":10,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 496, 'races', 'Drakos', 'Tableau des dons : Glace × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Glace × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":10,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 497, 'races', 'Drakos', 'Tableau des dons : ligne 11 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 11 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":11,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 498, 'races', 'Drakos', 'Tableau des dons : *Vent × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Vent × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":11,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 499, 'races', 'Drakos', 'Tableau des dons : *Vent × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Vent × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":11,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 500, 'races', 'Drakos', 'Tableau des dons : *Vent × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Vent × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":11,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 501, 'races', 'Drakos', 'Tableau des dons : ligne 12 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 12 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":12,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 502, 'races', 'Drakos', 'Tableau des dons : Foudre × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Foudre × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":12,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 503, 'races', 'Drakos', 'Tableau des dons : Foudre × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Foudre × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":12,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 504, 'races', 'Drakos', 'Tableau des dons : Foudre × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Foudre × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":12,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 505, 'races', 'Drakos', 'Tableau des dons : ligne 13 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 13 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":13,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 506, 'races', 'Drakos', 'Tableau des dons : *Terre × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Terre × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":13,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 507, 'races', 'Drakos', 'Tableau des dons : *Terre × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Terre × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":13,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 508, 'races', 'Drakos', 'Tableau des dons : *Terre × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : *Terre × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":13,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 509, 'races', 'Drakos', 'Tableau des dons : ligne 14 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 14 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":14,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 510, 'races', 'Drakos', 'Tableau des dons : Lumière × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Lumière × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":14,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 511, 'races', 'Drakos', 'Tableau des dons : Lumière × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Lumière × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":14,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 512, 'races', 'Drakos', 'Tableau des dons : Lumière × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Lumière × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":14,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 513, 'races', 'Drakos', 'Tableau des dons : ligne 15 × Magie innée', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 15 × Magie innée', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":15,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 514, 'races', 'Drakos', 'Tableau des dons : Ombre × AP/AM', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Ombre × AP/AM', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":15,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 515, 'races', 'Drakos', 'Tableau des dons : Ombre × Bonus compétence', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Ombre × Bonus compétence', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":3,"ligne":15,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 516, 'races', 'Drakos', 'Tableau des dons : Ombre × +1 cran de résistance', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : Ombre × +1 cran de résistance', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":4,"ligne":15,"race_id":"races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 517, 'races', 'Drakos', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/drakos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 518, 'races', 'Lamia', 'Lamia', 'Onglet de la race', 'ajoute', NULL, 'Lamia', 'neutre', NULL, 'race_onglet', '{"race_id":"races/lamia"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 519, 'races', 'Lamia', 'Don racial Écaille solide', 'Don racial', 'ajoute', NULL, 'Don racial Écaille solide', 'neutre', NULL, 'race_don', '{"id":"races/lamia#don:ecaille-solide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 520, 'races', 'Lamia', 'Lamia', 'Magies innées', 'modifie', 'Sang, Arcane, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre', 'Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre', 'neutre', NULL, 'race_magie', '{"race_id":"races/lamia"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 521, 'races', 'Lamia', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/lamia"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 522, 'races', 'Mort-vivant', 'Mort-vivant', 'Onglet de la race', 'ajoute', NULL, 'Mort-vivant', 'neutre', NULL, 'race_onglet', '{"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 523, 'races', 'Mort-vivant', 'Don racial Trompe-mort', 'Don racial', 'ajoute', NULL, 'Don racial Trompe-mort', 'neutre', NULL, 'race_don', '{"id":"races/mort-vivant#don:trompe-mort"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 524, 'races', 'Mort-vivant', 'Tableau des dons : en-tête 1', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 1', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/mort-vivant","rang":1}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 525, 'races', 'Mort-vivant', 'Tableau des dons : en-tête 2', 'En-tête du tableau', 'ajoute', NULL, 'Tableau des dons : en-tête 2', 'neutre', NULL, 'race_don_tableau_colonne', '{"race_id":"races/mort-vivant","rang":2}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 526, 'races', 'Mort-vivant', 'Tableau des dons : ligne 1 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 1 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":1,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 527, 'races', 'Mort-vivant', 'Tableau des dons : - Mort par saignement
- Noyé dans le sang × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort par saignement
- Noyé dans le sang × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":1,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 528, 'races', 'Mort-vivant', 'Tableau des dons : ligne 2 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 2 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":2,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 529, 'races', 'Mort-vivant', 'Tableau des dons : - Mort par brisement d''os
- Mort par empoisonnement × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort par brisement d''os
- Mort par empoisonnement × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":2,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 530, 'races', 'Mort-vivant', 'Tableau des dons : ligne 3 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 3 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":3,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 531, 'races', 'Mort-vivant', 'Tableau des dons : - Mort par vieillissement accéléré
- Mort proche d''une faille temporelle × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort par vieillissement accéléré
- Mort proche d''une faille temporelle × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":3,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 532, 'races', 'Mort-vivant', 'Tableau des dons : ligne 4 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 4 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":4,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 533, 'races', 'Mort-vivant', 'Tableau des dons : - Mort proche d''une faille temporelle
- Mort par la folie × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort proche d''une faille temporelle
- Mort par la folie × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":4,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 534, 'races', 'Mort-vivant', 'Tableau des dons : ligne 5 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 5 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":5,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 535, 'races', 'Mort-vivant', 'Tableau des dons : - Mort brûlé
- Mort dans le désert × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort brûlé
- Mort dans le désert × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":5,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 536, 'races', 'Mort-vivant', 'Tableau des dons : ligne 6 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 6 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":6,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 537, 'races', 'Mort-vivant', 'Tableau des dons : - Mort de froid
- Mort dans la neige × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort de froid
- Mort dans la neige × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":6,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 538, 'races', 'Mort-vivant', 'Tableau des dons : ligne 7 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 7 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":7,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 539, 'races', 'Mort-vivant', 'Tableau des dons : - Mort noyé
- Mort près de l''eau/dans l''eau × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort noyé
- Mort près de l''eau/dans l''eau × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":7,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 540, 'races', 'Mort-vivant', 'Tableau des dons : ligne 8 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 8 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":8,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 541, 'races', 'Mort-vivant', 'Tableau des dons : - Mort électrocuté
- Mort près d''un orage × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort électrocuté
- Mort près d''un orage × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":8,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 542, 'races', 'Mort-vivant', 'Tableau des dons : ligne 9 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 9 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":9,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 543, 'races', 'Mort-vivant', 'Tableau des dons : - Mort en altitude
- Mort sourd × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort en altitude
- Mort sourd × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":9,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 544, 'races', 'Mort-vivant', 'Tableau des dons : ligne 10 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 10 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":10,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 545, 'races', 'Mort-vivant', 'Tableau des dons : - Mort enterré vivant
- Mort pétrifié × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort enterré vivant
- Mort pétrifié × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":10,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 546, 'races', 'Mort-vivant', 'Tableau des dons : ligne 11 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 11 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":11,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 547, 'races', 'Mort-vivant', 'Tableau des dons : - Mort au soleil
- Mort aveuglé × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort au soleil
- Mort aveuglé × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":11,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 548, 'races', 'Mort-vivant', 'Tableau des dons : ligne 12 × Lieu de résurrection
Raison de la mort', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : ligne 12 × Lieu de résurrection
Raison de la mort', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":1,"ligne":12,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 549, 'races', 'Mort-vivant', 'Tableau des dons : - Mort à la lune
- Mort par trahison × Don', 'Case du tableau', 'ajoute', NULL, 'Tableau des dons : - Mort à la lune
- Mort par trahison × Don', 'neutre', NULL, 'race_don_tableau_cellule', '{"colonne":2,"ligne":12,"race_id":"races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 550, 'races', 'Mort-vivant', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/mort-vivant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 551, 'races', 'Drassah''thac', 'Drassah''thac', 'Onglet de la race', 'ajoute', NULL, 'Drassah''thac', 'neutre', NULL, 'race_onglet', '{"race_id":"races/drassahthac"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 552, 'races', 'Drassah''thac', 'Don racial Félin puissant', 'Don racial', 'ajoute', NULL, 'Don racial Félin puissant', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-est"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 553, 'races', 'Drassah''thac', 'Don racial Félin solide', 'Don racial', 'ajoute', NULL, 'Don racial Félin solide', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-ouest"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 554, 'races', 'Drassah''thac', 'Don racial Félin adapté', 'Don racial', 'ajoute', NULL, 'Don racial Félin adapté', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-nord"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 555, 'races', 'Drassah''thac', 'Don racial Félin rapide', 'Don racial', 'ajoute', NULL, 'Don racial Félin rapide', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-sud"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 556, 'races', 'Drassah''thac', 'Don racial Félin social', 'Don racial', 'ajoute', NULL, 'Don racial Félin social', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-centre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 557, 'races', 'Drassah''thac', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/drassahthac"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 558, 'races', 'Orios', 'Orios', 'Présentation', 'modifie', 'Les semi-ours, la force à l''état pure', 'Les semi-ours, la force à l''état pur', 'neutre', NULL, 'race', '{"id":"races/orios"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 559, 'races', 'Orios', 'Orios', 'Onglet de la race', 'ajoute', NULL, 'Orios', 'neutre', NULL, 'race_onglet', '{"race_id":"races/orios"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 560, 'races', 'Orios', 'Don racial Sang en innée', 'Don racial', 'ajoute', NULL, 'Don racial Sang en innée', 'neutre', NULL, 'race_don', '{"id":"races/orios#don:sang-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 561, 'races', 'Orios', 'Don racial Terre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Terre en innée', 'neutre', NULL, 'race_don', '{"id":"races/orios#don:terre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 562, 'races', 'Orios', 'Don racial Eau en innée', 'Don racial', 'ajoute', NULL, 'Don racial Eau en innée', 'neutre', NULL, 'race_don', '{"id":"races/orios#don:eau-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 563, 'races', 'Orios', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/orios"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 564, 'races', 'Fenrir', 'Fenrir', 'Présentation', 'modifie', 'Les semi-loups, bon partout', 'Les semi-loups, bons partout', 'neutre', NULL, 'race', '{"id":"races/fenrir"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 565, 'races', 'Fenrir', 'Fenrir', 'Onglet de la race', 'ajoute', NULL, 'Fenrir', 'neutre', NULL, 'race_onglet', '{"race_id":"races/fenrir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 566, 'races', 'Fenrir', 'Don racial Glace en innée', 'Don racial', 'ajoute', NULL, 'Don racial Glace en innée', 'neutre', NULL, 'race_don', '{"id":"races/fenrir#don:glace-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 567, 'races', 'Fenrir', 'Don racial Foudre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Foudre en innée', 'neutre', NULL, 'race_don', '{"id":"races/fenrir#don:foudre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 568, 'races', 'Fenrir', 'Don racial Ombre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Ombre en innée', 'neutre', NULL, 'race_don', '{"id":"races/fenrir#don:ombre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 569, 'races', 'Fenrir', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/fenrir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 570, 'races', 'Kitsune', 'Kitsune', 'Présentation', 'modifie', 'Les semi-renards, une race à la beauté et au narcisisme sans égal', 'Les semi-renards, une race à la beauté et au narcissisme sans égal', 'neutre', NULL, 'race', '{"id":"races/kitsune"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 571, 'races', 'Kitsune', 'Kitsune', 'Onglet de la race', 'ajoute', NULL, 'Kitsune', 'neutre', NULL, 'race_onglet', '{"race_id":"races/kitsune"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 572, 'races', 'Kitsune', 'Don racial Feu en innée', 'Don racial', 'ajoute', NULL, 'Don racial Feu en innée', 'neutre', NULL, 'race_don', '{"id":"races/kitsune#don:feu-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 573, 'races', 'Kitsune', 'Don racial Vent en innée', 'Don racial', 'ajoute', NULL, 'Don racial Vent en innée', 'neutre', NULL, 'race_don', '{"id":"races/kitsune#don:vent-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 574, 'races', 'Kitsune', 'Don racial Lumière en innée', 'Don racial', 'ajoute', NULL, 'Don racial Lumière en innée', 'neutre', NULL, 'race_don', '{"id":"races/kitsune#don:lumiere-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 575, 'races', 'Kitsune', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/kitsune"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 576, 'races', 'Olwman', 'Olwman', 'Présentation', 'modifie', 'Les semi-hibous, l''une des races capable de voler', 'Les semi-hibous, l''une des races capables de voler', 'neutre', NULL, 'race', '{"id":"races/olwman"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 577, 'races', 'Olwman', 'Olwman', 'Onglet de la race', 'ajoute', NULL, 'Olwman', 'neutre', NULL, 'race_onglet', '{"race_id":"races/olwman"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 578, 'races', 'Olwman', 'Don racial Espace/Temps en innée', 'Don racial', 'ajoute', NULL, 'Don racial Espace/Temps en innée', 'neutre', NULL, 'race_don', '{"id":"races/olwman#don:espace-temps-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 579, 'races', 'Olwman', 'Don racial Vent en innée', 'Don racial', 'ajoute', NULL, 'Don racial Vent en innée', 'neutre', NULL, 'race_don', '{"id":"races/olwman#don:vent-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 580, 'races', 'Olwman', 'Don racial Ombre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Ombre en innée', 'neutre', NULL, 'race_don', '{"id":"races/olwman#don:ombre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 581, 'races', 'Olwman', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/olwman"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 582, 'races', 'Rokh', 'Rokh', 'Onglet de la race', 'ajoute', NULL, 'Rokh', 'neutre', NULL, 'race_onglet', '{"race_id":"races/rokh"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 583, 'races', 'Rokh', 'Don racial Vent en innée', 'Don racial', 'ajoute', NULL, 'Don racial Vent en innée', 'neutre', NULL, 'race_don', '{"id":"races/rokh#don:vent-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 584, 'races', 'Rokh', 'Don racial Foudre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Foudre en innée', 'neutre', NULL, 'race_don', '{"id":"races/rokh#don:foudre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 585, 'races', 'Rokh', 'Don racial Lumière en innée', 'Don racial', 'ajoute', NULL, 'Don racial Lumière en innée', 'neutre', NULL, 'race_don', '{"id":"races/rokh#don:lumiere-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 586, 'races', 'Rokh', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/rokh"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 587, 'races', 'Namazu', 'Namazu', 'Onglet de la race', 'ajoute', NULL, 'Namazu', 'neutre', NULL, 'race_onglet', '{"race_id":"races/namazu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 588, 'races', 'Namazu', 'Don racial Sang en innée', 'Don racial', 'ajoute', NULL, 'Don racial Sang en innée', 'neutre', NULL, 'race_don', '{"id":"races/namazu#don:sang-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 589, 'races', 'Namazu', 'Don racial Ombre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Ombre en innée', 'neutre', NULL, 'race_don', '{"id":"races/namazu#don:ombre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 590, 'races', 'Namazu', 'Don racial Eau en innée', 'Don racial', 'ajoute', NULL, 'Don racial Eau en innée', 'neutre', NULL, 'race_don', '{"id":"races/namazu#don:eau-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 591, 'races', 'Namazu', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/namazu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 592, 'races', 'Minotaure', 'Minotaure', 'Onglet de la race', 'ajoute', NULL, 'Minotaure', 'neutre', NULL, 'race_onglet', '{"race_id":"races/minotaure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 593, 'races', 'Minotaure', 'Don racial Sang en innée', 'Don racial', 'ajoute', NULL, 'Don racial Sang en innée', 'neutre', NULL, 'race_don', '{"id":"races/minotaure#don:sang-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 594, 'races', 'Minotaure', 'Don racial Ombre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Ombre en innée', 'neutre', NULL, 'race_don', '{"id":"races/minotaure#don:ombre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 595, 'races', 'Minotaure', 'Don racial Terre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Terre en innée', 'neutre', NULL, 'race_don', '{"id":"races/minotaure#don:terre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 596, 'races', 'Minotaure', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/minotaure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 597, 'races', 'Satyre', 'Satyre', 'Présentation', 'modifie', 'Les semi-moutons, la personification du désir sexuel', 'Les semi-moutons, la personnification du désir sexuel', 'neutre', NULL, 'race', '{"id":"races/satyre"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 598, 'races', 'Satyre', 'Satyre', 'Onglet de la race', 'ajoute', NULL, 'Satyre', 'neutre', NULL, 'race_onglet', '{"race_id":"races/satyre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 599, 'races', 'Satyre', 'Don racial Terre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Terre en innée', 'neutre', NULL, 'race_don', '{"id":"races/satyre#don:terre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 600, 'races', 'Satyre', 'Don racial Foudre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Foudre en innée', 'neutre', NULL, 'race_don', '{"id":"races/satyre#don:foudre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 601, 'races', 'Satyre', 'Don racial Feu en innée', 'Don racial', 'ajoute', NULL, 'Don racial Feu en innée', 'neutre', NULL, 'race_don', '{"id":"races/satyre#don:feu-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 602, 'races', 'Satyre', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/satyre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 603, 'races', 'Médusain', 'Médusain', 'Onglet de la race', 'ajoute', NULL, 'Médusain', 'neutre', NULL, 'race_onglet', '{"race_id":"races/medusain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 604, 'races', 'Médusain', 'Don racial Eau en innée', 'Don racial', 'ajoute', NULL, 'Don racial Eau en innée', 'neutre', NULL, 'race_don', '{"id":"races/medusain#don:eau-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 605, 'races', 'Médusain', 'Don racial Foudre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Foudre en innée', 'neutre', NULL, 'race_don', '{"id":"races/medusain#don:foudre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 606, 'races', 'Médusain', 'Don racial Lumière en innée', 'Don racial', 'ajoute', NULL, 'Don racial Lumière en innée', 'neutre', NULL, 'race_don', '{"id":"races/medusain#don:lumiere-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 607, 'races', 'Médusain', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/medusain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 608, 'races', 'Jackalope', 'Jackalope', 'Onglet de la race', 'ajoute', NULL, 'Jackalope', 'neutre', NULL, 'race_onglet', '{"race_id":"races/jackalope"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 609, 'races', 'Jackalope', 'Don racial Terre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Terre en innée', 'neutre', NULL, 'race_don', '{"id":"races/jackalope#don:terre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 610, 'races', 'Jackalope', 'Don racial Foudre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Foudre en innée', 'neutre', NULL, 'race_don', '{"id":"races/jackalope#don:foudre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 611, 'races', 'Jackalope', 'Don racial Vide en innée', 'Don racial', 'ajoute', NULL, 'Don racial Vide en innée', 'neutre', NULL, 'race_don', '{"id":"races/jackalope#don:vide-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 612, 'races', 'Jackalope', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/jackalope"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 613, 'races', 'Marcass', 'Marcass', 'Présentation', 'modifie', 'Les semi-cochons, résistant et fort', 'Les semi-cochons, résistants et forts', 'neutre', NULL, 'race', '{"id":"races/marcass"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 614, 'races', 'Marcass', 'Marcass', 'Onglet de la race', 'ajoute', NULL, 'Marcass', 'neutre', NULL, 'race_onglet', '{"race_id":"races/marcass"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 615, 'races', 'Marcass', 'Don racial Terre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Terre en innée', 'neutre', NULL, 'race_don', '{"id":"races/marcass#don:terre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 616, 'races', 'Marcass', 'Don racial Feu en innée', 'Don racial', 'ajoute', NULL, 'Don racial Feu en innée', 'neutre', NULL, 'race_don', '{"id":"races/marcass#don:feu-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 617, 'races', 'Marcass', 'Don racial Nécromancie en innée', 'Don racial', 'ajoute', NULL, 'Don racial Nécromancie en innée', 'neutre', NULL, 'race_don', '{"id":"races/marcass#don:necromancie-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 618, 'races', 'Marcass', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/marcass"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 619, 'races', 'Anansi', 'Anansi', 'Présentation', 'modifie', 'Les semi-araignée, des grandes dames et des petits gaillard', 'Les semi-araignées, des grandes dames et des petits gaillards', 'neutre', NULL, 'race', '{"id":"races/anansi"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 620, 'races', 'Anansi', 'Anansi', 'Onglet de la race', 'ajoute', NULL, 'Anansi', 'neutre', NULL, 'race_onglet', '{"race_id":"races/anansi"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 621, 'races', 'Anansi', 'Don racial Arcane en innée', 'Don racial', 'ajoute', NULL, 'Don racial Arcane en innée', 'neutre', NULL, 'race_don', '{"id":"races/anansi#don:arcane-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 622, 'races', 'Anansi', 'Don racial Nécromancie en innée', 'Don racial', 'ajoute', NULL, 'Don racial Nécromancie en innée', 'neutre', NULL, 'race_don', '{"id":"races/anansi#don:necromancie-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 623, 'races', 'Anansi', 'Don racial Ombre en innée', 'Don racial', 'ajoute', NULL, 'Don racial Ombre en innée', 'neutre', NULL, 'race_don', '{"id":"races/anansi#don:ombre-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 624, 'races', 'Anansi', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/anansi"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 625, 'races', 'Goleois', 'Goleois', 'Présentation', 'modifie', 'Les semi-poulet, LA FRAAAAAAAANCE !!!', 'Les semi-poulets, LA FRAAAAAAAANCE !!!', 'neutre', NULL, 'race', '{"id":"races/goleois"}', 'presentation');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 626, 'races', 'Goleois', 'Goleois', 'Onglet de la race', 'ajoute', NULL, 'Goleois', 'neutre', NULL, 'race_onglet', '{"race_id":"races/goleois"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 627, 'races', 'Goleois', 'Don racial Glace en innée', 'Don racial', 'ajoute', NULL, 'Don racial Glace en innée', 'neutre', NULL, 'race_don', '{"id":"races/goleois#don:glace-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 628, 'races', 'Goleois', 'Don racial Lumière en innée', 'Don racial', 'ajoute', NULL, 'Don racial Lumière en innée', 'neutre', NULL, 'race_don', '{"id":"races/goleois#don:lumiere-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 629, 'races', 'Goleois', 'Don racial Sang en innée', 'Don racial', 'ajoute', NULL, 'Don racial Sang en innée', 'neutre', NULL, 'race_don', '{"id":"races/goleois#don:sang-en-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 630, 'races', 'Goleois', 'Capacité Mode Hyper', NULL, 'ajoute', NULL, 'Capacité Mode Hyper', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/goleois"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 631, 'metiers', NULL, 'Ange gardien', 'Nom', 'modifie', 'Ange-gardien', 'Ange gardien', 'neutre', NULL, 'metier', '{"id":"metiers/ange-gardien"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 632, 'metiers', NULL, 'Ange gardien', 'Description', 'modifie', 'Le nom pourrait faire croire à un métier compliqué mais il est plus simple qu’on ne le croit, il s’agit d’une personne qui raccompagne les gens ivre chez eux ou les gens qui auraient peur d’emprunter les rues la nuit. Il prend des risques pour protéger et accompagner.', 'Le nom pourrait faire croire à un métier compliqué mais il est plus simple qu’on ne le croit, il s’agit d’une personne qui raccompagne les gens ivres chez eux ou les gens qui auraient peur d’emprunter les rues la nuit. Il prend des risques pour protéger et accompagner.', 'neutre', NULL, 'metier', '{"id":"metiers/ange-gardien"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 633, 'metiers', NULL, 'Armurier', 'Description', 'modifie', 'L’armurier conçoit, entretient et répare les armures destinées aux soldats, mercenaires, chevaliers ou tout autres personnes pouvant se le permettre. Son travail exige force, précision et une compréhension fine des matériaux. Il est indispensable dans toute cité ou garnison soucieuse de sa protection.', 'L’armurier conçoit, entretient et répare les armures destinées aux soldats, mercenaires, chevaliers ou toutes autres personnes pouvant se le permettre. Son travail exige force, précision et une compréhension fine des matériaux. Il est indispensable dans toute cité ou garnison soucieuse de sa protection.', 'neutre', NULL, 'metier', '{"id":"metiers/armurier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 634, 'metiers', NULL, 'Armurier', 'Bonus', 'modifie', '+3% Parade, +1AP donné par les armures métalliques fabriquer', '+3% Parade, +1AP donné par les armures métalliques fabriquées', 'neutre', NULL, 'metier', '{"id":"metiers/armurier"}', 'bonus_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 635, 'metiers', NULL, 'Artisan', 'Bonus', 'modifie', 'Le malus de l’artisanat du à la non-spécialisation est réduit à 20% au lieu de 40%', 'Le malus de l’artisanat dû à la non-spécialisation est réduit à 20% au lieu de 40%', 'neutre', NULL, 'metier', '{"id":"metiers/artisan"}', 'bonus_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 636, 'metiers', NULL, 'Chasseur', 'Équipement supplémentaire', 'modifie', 'Arc ou Arbalète en acier (Arme)', 'Arc en acier (Arme) OU Arbalète en acier (Arme)', 'neutre', NULL, 'metier', '{"id":"metiers/chasseur"}', 'equipement_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 637, 'metiers', NULL, 'Chaudronnier', 'Description', 'modifie', 'Le chaudronnier travaille le métal, il est celui qui est capable de faire les différents alliages grâce aux minerais mais il est également celui qui s’occupe du chaudron de brai brouillant, très utilisé dans les châteaux pour la défense.', 'Le chaudronnier travaille le métal, il est celui qui est capable de faire les différents alliages grâce aux minerais mais il est également celui qui s’occupe du chaudron de brai bouillant, très utilisé dans les châteaux pour la défense.', 'neutre', NULL, 'metier', '{"id":"metiers/chaudronnier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 638, 'metiers', NULL, 'Chef cuisinier', 'Nom', 'modifie', 'Chef-cuisinier', 'Chef cuisinier', 'neutre', NULL, 'metier', '{"id":"metiers/chef-cuisinier"}', 'nom');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 639, 'metiers', NULL, 'Chef cuisinier', 'Description', 'modifie', 'Le chef-cuisinier dirige les cuisines et crée des plats raffinés ou nourrissants selon les moyens du lieu où il travaille. Il connaît les ingrédients, les saveurs et les méthodes de préparation les plus efficaces. Son savoir-faire fait de lui une figure incontournable des tavernes comme des palais.', 'Le chef cuisinier dirige les cuisines et crée des plats raffinés ou nourrissants selon les moyens du lieu où il travaille. Il connaît les ingrédients, les saveurs et les méthodes de préparation les plus efficaces. Son savoir-faire fait de lui une figure incontournable des tavernes comme des palais.', 'neutre', NULL, 'metier', '{"id":"metiers/chef-cuisinier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 640, 'metiers', NULL, 'Croisé', 'Description', 'modifie', 'Le croisé est un combattant engagé dans une cause religieuse, souvent envoyé loin de sa terre natale. Son devoir prime sur son confort, et il suit les ordres de ses supérieurs sans hésitation. Ses voyages sont marqués par les conflits et les épreuves spirituelles. Il existe différents rang militaires chez les croisés, il sera important de le déterminer car ça peut impliquer beaucoup de choses.', 'Le croisé est un combattant engagé dans une cause religieuse, souvent envoyé loin de sa terre natale. Son devoir prime sur son confort, et il suit les ordres de ses supérieurs sans hésitation. Ses voyages sont marqués par les conflits et les épreuves spirituelles. Il existe différents rangs militaires chez les croisés, il sera important de le déterminer car ça peut impliquer beaucoup de choses.', 'neutre', NULL, 'metier', '{"id":"metiers/croise"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 641, 'metiers', NULL, 'Fossoyeur', 'Équipement supplémentaire', 'modifie', 'Pelle OU faucille en acier (arme)', 'Pelle en acier (arme) OU Faucille en acier (arme)', 'neutre', NULL, 'metier', '{"id":"metiers/fossoyeur"}', 'equipement_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 642, 'metiers', NULL, 'Gladiateur', 'Équipement supplémentaire', 'modifie', 'Glaive lourd ou léger en acier (arme)', 'Glaive lourd en acier (arme) OU Glaive léger en acier (arme)', 'neutre', NULL, 'metier', '{"id":"metiers/gladiateur"}', 'equipement_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 643, 'metiers', NULL, 'Joaillier', 'Description', 'modifie', 'Le joaillier travaille les gemmes précieuses et est capable de les raffinées. Son œil exercé et sa minutie déterminent la valeur de ses créations. Les nobles et marchands riches recherchent souvent ses services.', 'Le joaillier travaille les gemmes précieuses et est capable de les raffiner. Son œil exercé et sa minutie déterminent la valeur de ses créations. Les nobles et marchands riches recherchent souvent ses services.', 'neutre', NULL, 'metier', '{"id":"metiers/joaillier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 644, 'metiers', NULL, 'Joaillier', 'Artisanat', 'modifie', 'Peut faire gemmes supérieur', 'Peut faire gemmes supérieures', 'neutre', NULL, 'metier', '{"id":"metiers/joaillier"}', 'artisanat_texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 645, 'metiers', NULL, 'Marchand', 'Description', 'modifie', 'Le marchand parcours routes et marchés pour acheter, vendre et échanger toutes sortes de biens. Sa réussite dépend de son sens du commerce, de sa capacité à négocier et de son réseau. Il relie les villages entre eux et fait circuler richesses et nouvelles.', 'Le marchand parcourt routes et marchés pour acheter, vendre et échanger toutes sortes de biens. Sa réussite dépend de son sens du commerce, de sa capacité à négocier et de son réseau. Il relie les villages entre eux et fait circuler richesses et nouvelles.', 'neutre', NULL, 'metier', '{"id":"metiers/marchand"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 646, 'metiers', NULL, 'Marin', 'Bonus', 'modifie', '+3% Orientation, +3% Vie de nature', '+3% Orientation, +3% Vie en nature', 'neutre', NULL, 'metier', '{"id":"metiers/marin"}', 'bonus_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 647, 'metiers', NULL, 'Maroquinier', 'Bonus', 'modifie', '+2% Esquive, +1AP donné par les armures cuir, peau, cellulose, corail, écaille fabriqués', '+2% Esquive, +1AP donné par les armures cuir, peau, cellulose, corail, écaille fabriquées', 'neutre', NULL, 'metier', '{"id":"metiers/maroquinier"}', 'bonus_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 648, 'metiers', NULL, 'Pâtissier', 'Description', 'modifie', 'Le pâtissier prépare desserts, viennoiseries et douceurs pour ceux qui sont aisés,les tavernes prestigieuses ou les banquets. Il maîtrise les techniques de cuisson, de décoration et de présentation pour créer des produits à la fois savoureux et esthétiques. Leur travail est souvent comparé à ceux d’un artiste, de ceux qui vénère Bauc.', 'Le pâtissier prépare desserts, viennoiseries et douceurs pour ceux qui sont aisés, les tavernes prestigieuses ou les banquets. Il maîtrise les techniques de cuisson, de décoration et de présentation pour créer des produits à la fois savoureux et esthétiques. Leur travail est souvent comparé à ceux d’un artiste, de ceux qui vénère Bauc.', 'neutre', NULL, 'metier', '{"id":"metiers/patissier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 649, 'metiers', NULL, 'Pâtissier', 'Artisanat', 'modifie', 'Fabriquer des douceurs, ces derniers peut redonner 5 barrière si consommé', 'Fabriquer des douceurs, ces dernières peuvent redonner 5 barrière si consommées', 'neutre', NULL, 'metier', '{"id":"metiers/patissier"}', 'artisanat_texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 650, 'metiers', NULL, 'Peintre', 'Caractéristique d’artisanat 1', 'ajoute', NULL, 'Perception', 'neutre', NULL, 'metier', '{"id":"metiers/peintre"}', 'test_carac_1_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 651, 'metiers', NULL, 'Peintre', 'Caractéristique d’artisanat 2', 'ajoute', NULL, 'Perception', 'neutre', NULL, 'metier', '{"id":"metiers/peintre"}', 'test_carac_2_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 652, 'metiers', NULL, 'Prostitué', 'Description', 'modifie', 'La prostituée offre ses services contre paiement, accueillant clients dans des établissements, des quartiers dédiés ou lors de déplacements. C’est un métier à risque et la quasi intégralité de ceux qui pratique ce métier ne l’ont pas fait volontairement.', 'La prostituée offre ses services contre paiement, accueillant clients dans des établissements, des quartiers dédiés ou lors de déplacements. C’est un métier à risque et la quasi-intégralité de ceux qui pratiquent ce métier ne l’ont pas fait volontairement.', 'neutre', NULL, 'metier', '{"id":"metiers/prostitue"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 653, 'metiers', NULL, 'Prostitué', 'Bonus', 'modifie', '+3% Manipulation, Survie', '+3% Manipulation, +3% Survie', 'neutre', NULL, 'metier', '{"id":"metiers/prostitue"}', 'bonus_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 654, 'metiers', NULL, 'Scribe', 'Artisanat', 'modifie', 'Peut créer des parchemin gravé et mettre des sorts dedans', 'Peut créer des parchemins gravés et mettre des sorts dedans', 'neutre', NULL, 'metier', '{"id":"metiers/scribe"}', 'artisanat_texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 655, 'metiers', NULL, 'Scribe', 'Caractéristique d’artisanat 1', 'ajoute', NULL, 'Social', 'neutre', NULL, 'metier', '{"id":"metiers/scribe"}', 'test_carac_1_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 656, 'metiers', NULL, 'Scribe', 'Caractéristique d’artisanat 2', 'ajoute', NULL, 'Intelligence', 'neutre', NULL, 'metier', '{"id":"metiers/scribe"}', 'test_carac_2_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 657, 'guide', 'Chapitre 1', 'Bienvenue dans Maverick', NULL, 'ajoute', NULL, 'Bienvenue dans Maverick', 'neutre', NULL, 'page', '{"id":"guide/bienvenue"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 658, 'guide', 'Chapitre 2', 'Le jeu de rôle, comment ça marche ?', NULL, 'ajoute', NULL, 'Le jeu de rôle, comment ça marche ?', 'neutre', NULL, 'page', '{"id":"guide/le-jeu-de-role"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 659, 'guide', 'Chapitre 3', 'L’univers', NULL, 'ajoute', NULL, 'L’univers', 'neutre', NULL, 'page', '{"id":"guide/l-univers"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 660, 'guide', 'Chapitre 4', 'Réussir une action', NULL, 'ajoute', NULL, 'Réussir une action', 'neutre', NULL, 'page', '{"id":"guide/reussir-une-action"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 661, 'guide', 'Chapitre 5', 'Créer son personnage', NULL, 'ajoute', NULL, 'Créer son personnage', 'neutre', NULL, 'page', '{"id":"guide/creer-son-personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 662, 'guide', 'Chapitre 6', 'Étape 1 : imaginer son personnage et choisir sa race', NULL, 'ajoute', NULL, 'Étape 1 : imaginer son personnage et choisir sa race', 'neutre', NULL, 'page', '{"id":"guide/choisir-sa-race"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 663, 'guide', 'Chapitre 7', 'Étape 2 : choisir ses magies', NULL, 'ajoute', NULL, 'Étape 2 : choisir ses magies', 'neutre', NULL, 'page', '{"id":"guide/choisir-ses-magies"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 664, 'guide', 'Chapitre 8', 'Étape 3 : choisir sa classe', NULL, 'ajoute', NULL, 'Étape 3 : choisir sa classe', 'neutre', NULL, 'page', '{"id":"guide/choisir-sa-classe"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 665, 'guide', 'Chapitre 9', 'Étape 4 : caractéristiques et compétences', NULL, 'ajoute', NULL, 'Étape 4 : caractéristiques et compétences', 'neutre', NULL, 'page', '{"id":"guide/caracteristiques-et-competences"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 666, 'guide', 'Chapitre 10', 'Étape 5 : ses premiers sorts', NULL, 'ajoute', NULL, 'Étape 5 : ses premiers sorts', 'neutre', NULL, 'page', '{"id":"guide/premiers-sorts"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 667, 'guide', 'Chapitre 11', 'Étape 6 : finaliser son personnage', NULL, 'ajoute', NULL, 'Étape 6 : finaliser son personnage', 'neutre', NULL, 'page', '{"id":"guide/finaliser-son-personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 668, 'guide', 'Chapitre 12', 'Le tour de jeu', NULL, 'ajoute', NULL, 'Le tour de jeu', 'neutre', NULL, 'page', '{"id":"guide/le-tour-de-jeu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 669, 'guide', 'Chapitre 13', 'Attaquer et se défendre', NULL, 'ajoute', NULL, 'Attaquer et se défendre', 'neutre', NULL, 'page', '{"id":"guide/attaquer-et-se-defendre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 670, 'guide', 'Chapitre 14', 'L’équipement', NULL, 'ajoute', NULL, 'L’équipement', 'neutre', NULL, 'page', '{"id":"guide/l-equipement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 671, 'guide', 'Chapitre 15', 'Les dégâts', NULL, 'ajoute', NULL, 'Les dégâts', 'neutre', NULL, 'page', '{"id":"guide/les-degats"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 672, 'guide', 'Chapitre 16', 'Les postures', NULL, 'ajoute', NULL, 'Les postures', 'neutre', NULL, 'page', '{"id":"guide/les-postures"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 673, 'guide', 'Chapitre 17', 'La magie en jeu', NULL, 'ajoute', NULL, 'La magie en jeu', 'neutre', NULL, 'page', '{"id":"guide/la-magie-en-jeu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 674, 'guide', 'Chapitre 18', 'Blessures et états', NULL, 'ajoute', NULL, 'Blessures et états', 'neutre', NULL, 'page', '{"id":"guide/blessures-et-etats"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 675, 'guide', 'Chapitre 19', 'La montée de niveau', NULL, 'ajoute', NULL, 'La montée de niveau', 'neutre', NULL, 'page', '{"id":"guide/la-montee-de-niveau"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 676, 'guide', 'Chapitre 20', 'Le Mode Hyper et le Mode Super', NULL, 'ajoute', NULL, 'Le Mode Hyper et le Mode Super', 'neutre', NULL, 'page', '{"id":"guide/le-mode-hyper"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 677, 'guide', 'Chapitre 21', 'S’entraîner et exercer un métier', NULL, 'ajoute', NULL, 'S’entraîner et exercer un métier', 'neutre', NULL, 'page', '{"id":"guide/s-entrainer-et-exercer-un-metier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 678, 'guide', 'Chapitre 22', 'Aide-mémoire', NULL, 'ajoute', NULL, 'Aide-mémoire', 'neutre', NULL, 'page', '{"id":"guide/aide-memoire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 679, 'guide', 'Chapitre 23', 'Lexique', NULL, 'ajoute', NULL, 'Lexique', 'neutre', NULL, 'page', '{"id":"guide/lexique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 680, 'guide', 'Chapitre 24', 'Les documents des règles', NULL, 'ajoute', NULL, 'Les documents des règles', 'neutre', NULL, 'page', '{"id":"guide/les-documents-des-regles"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 681, 'guide', 'Pages de référence', '« Campagne » ou « Scénario one shot » ?', 'Texte', 'modifie', 'Bien que ces termes peuvent se ressembler ils sont bien différents, selon ce que vous souhaitez faire il y a deux façon principales de jouer au jdr :

## Scénario One Shot

Traduit littéralement « Scénario en un coup » tout un programme donc, il s''agit d''une histoire qui se fait en une seule séance de jeu de rôle. Ce genre de partie est parfait pour s''exercer sur plein d''aspect du rôle de maître du jeu, pour prendre la température sur un début de campagne ou bien pour passer un bon moment avec des amis qui ne peuvent être là qu''un seul moment.

Une bonne longueur d''un scénario one shot peut aller de 1h30 à 4h, ce n''est qu''une moyenne car il faut prendre en compte l''histoire créer mais surtout le nombre de joueurs autour de la table.

Les scénarios one shot sont généralement des scénarios simples avec une fin fermée qui ne laisse aucune possibilité de suite.

Exemple :

- Une escorte de caravane
- Pourchasser un criminel qui s''est échappé de prison
- Tuer une créature qui détruit un village
- Une enquête sur une mort mystérieuse

Les idées ne manquent pas pour faire vivre une petite aventure aux joueurs. Cela reste assez conséquent en travail car il faut créer les pnj, le décor, les créatures qu''ils peuvent rencontrer, les objets qu''ils peuvent trouver, ect...

## Campagne

Une campagne est une histoire qui se déroule en plus ou moins de séances, il s''agit ni plus ni moins que d''une aventure qui commence à un point A et qui se finit à un point B.

Les façons de faire une campagne sont légions mais le plus simple consiste à préparer étapes par étapes ce qui va se passer dans votre histoire, les élément les plus importants se rassemble en les 5 questionnements : Qui ?, Quoi ?, Où ?, Comment ?, Pourquoi ? :

- *Qui :* Le(s) méchant(s) de l''histoire sur qui l''histoire va se reposer (ça peut très bien être un événement naturel qui doit être stoppé), les personnages des joueurs, les pnj qui pourront aider ou embêter ces derniers.
- *Quoi* : Que se passe t-il ? Quel événement malencontreux font qu''il y a cette histoire ?
- *Où* : Dessinez une carte ou utilisez la carte proposer par ce livre pour connaître le lieu où l''histoire se déroule.
- *Comment* : Comment l''antagoniste va perturber les joueurs ?
- *Pourquoi* : Pourquoi l''antagoniste fait tout ça et surtout, pourquoi les joueurs vont l''arrêter ? Il est toujours intéressant de mettre un petit lien entre le méchant et les joueurs, car c''est le méchant qui va créer le(s) héros.

Alors bien entendu, il n''est pas question de coucher au mot près ce qui va se dérouler à tel moment, n''oublions jamais que nous sommes dans un jeu de rôle, le maître du jeu est le metteur en scène et les joueurs sont les premiers rôles. Le mieux possible est d''écrire les grandes lignes, les chapitres, les situations et le décor et de laisser les joueurs décider comment ils vont faire pour passer à la suite. Il est tout à fait possible de laisser quelques indices pour les guider, mais ne jamais oublier que les joueurs font partie de l''écriture de l''histoire, ils ont leur mot à dire.

Dans tous les cas, le mieux à préparer à l''avance pour éviter de perdre du temps et d''angoisser pour rien, c''est une table de rencontre aléatoire, une table de butin possible et les pnj importants.

## Table de rencontre

Une table de rencontre permet de déterminer un événement aléatoire, ça peut être des monstres, une caravane marchande qui passe par là ou bien un lieu tranquille d''apparence, la seule limite c''est votre imagination.

Ce qui est conseillé est d''avoir au moins deux tables de rencontre : une table de rencontre passe partout qui correspond à peu près à l''environnement où circule les joueurs et une autre table qui est spécifique à votre histoire.

*Exemple :*

Vous faites une histoire qui parlerait d''un nécromancien maléfique qui veut monter une armée de mort-vivant. La table spécifique qui correspond à votre histoire sera des groupes de monstres spécifiquement morts-vivants, des nécromancien entrain de faire de mauvais rituels, des tombeaux profanés, etc...

## Table de butin

Une table de butin vous permet de déterminer quelles seront les récompenses que les joueurs auront après un combat, un énigme, dans un coffre, etc....

Soit on fait plusieurs tables selon la situation ou alors une seule et grosse table.

## Personnage non joueur important (PNJ)

Les PNJ sont un pilier d''une aventure, c''est eux qui permettent de faire avancer l''intrigue ou qui permettent d''ajouter de la cohérence dans le monde.

Ce qui est conseiller est de déterminer une liste de personnages importants avec :

- Fonction
- Utilité dans l''histoire
- Caractéristiques
- Magie(s)
- Classe(s)
- Nom

Après avoir une liste de pnj importante c''est bien, mais les joueurs aiment bien parler avec les passant ou ceux qui sont moins important, d''où le conseil d''avoir une liste de nom généré à l''avance ce qui permet de sortir un prénom sans perdre trop de temps ou casser le rythme.', 'Bien que ces termes puissent se ressembler ils sont bien différents, selon ce que vous souhaitez faire il y a deux façons principales de jouer au jdr :

## Scénario One Shot

Traduit littéralement « Scénario en un coup » tout un programme donc, il s''agit d''une histoire qui se fait en une seule séance de jeu de rôle. Ce genre de partie est parfait pour s''exercer sur plein d''aspects du rôle de maître du jeu, pour prendre la température sur un début de campagne ou bien pour passer un bon moment avec des amis qui ne peuvent être là qu''un seul moment.

Une bonne longueur d''un scénario one shot peut aller de 1h30 à 4h, ce n''est qu''une moyenne car il faut prendre en compte l''histoire créée mais surtout le nombre de joueurs autour de la table.

Les scénarios one shot sont généralement des scénarios simples avec une fin fermée qui ne laisse aucune possibilité de suite.

Exemple :

- Une escorte de caravane
- Pourchasser un criminel qui s''est échappé de prison
- Tuer une créature qui détruit un village
- Une enquête sur une mort mystérieuse

Les idées ne manquent pas pour faire vivre une petite aventure aux joueurs. Cela reste assez conséquent en travail car il faut créer les pnj, le décor, les créatures qu''ils peuvent rencontrer, les objets qu''ils peuvent trouver, etc...

## Campagne

Une campagne est une histoire qui se déroule en plus ou moins de séances, il s''agit ni plus ni moins que d''une aventure qui commence à un point A et qui se finit à un point B.

Les façons de faire une campagne sont légion mais le plus simple consiste à préparer étape par étape ce qui va se passer dans votre histoire, les éléments les plus importants se rassemblent en les 5 questionnements : Qui ?, Quoi ?, Où ?, Comment ?, Pourquoi ? :

- *Qui :* Le(s) méchant(s) de l''histoire sur qui l''histoire va se reposer (ça peut très bien être un événement naturel qui doit être stoppé), les personnages des joueurs, les pnj qui pourront aider ou embêter ces derniers.
- *Quoi* : Que se passe-t-il ? Quel événement malencontreux fait qu''il y a cette histoire ?
- *Où* : Dessinez une carte ou utilisez la carte proposée par ce livre pour connaître le lieu où l''histoire se déroule.
- *Comment* : Comment l''antagoniste va perturber les joueurs ?
- *Pourquoi* : Pourquoi l''antagoniste fait tout ça et surtout, pourquoi les joueurs vont l''arrêter ? Il est toujours intéressant de mettre un petit lien entre le méchant et les joueurs, car c''est le méchant qui va créer le(s) héros.

Alors bien entendu, il n''est pas question de coucher au mot près ce qui va se dérouler à tel moment, n''oublions jamais que nous sommes dans un jeu de rôle, le maître du jeu est le metteur en scène et les joueurs sont les premiers rôles. Le mieux possible est d''écrire les grandes lignes, les chapitres, les situations et le décor et de laisser les joueurs décider comment ils vont faire pour passer à la suite. Il est tout à fait possible de laisser quelques indices pour les guider, mais ne jamais oublier que les joueurs font partie de l''écriture de l''histoire, ils ont leur mot à dire.

Dans tous les cas, le mieux à préparer à l''avance pour éviter de perdre du temps et d''angoisser pour rien, c''est une table de rencontre aléatoire, une table de butin possible et les pnj importants.

## Table de rencontre

Une table de rencontre permet de déterminer un événement aléatoire, ça peut être des monstres, une caravane marchande qui passe par là ou bien un lieu tranquille d''apparence, la seule limite c''est votre imagination.

Ce qui est conseillé est d''avoir au moins deux tables de rencontre : une table de rencontre passe-partout qui correspond à peu près à l''environnement où circulent les joueurs et une autre table qui est spécifique à votre histoire.

*Exemple :*

Vous faites une histoire qui parlerait d''un nécromancien maléfique qui veut monter une armée de morts-vivants. La table spécifique qui correspond à votre histoire sera des groupes de monstres spécifiquement morts-vivants, des nécromanciens en train de faire de mauvais rituels, des tombeaux profanés, etc...

## Table de butin

Une table de butin vous permet de déterminer quelles seront les récompenses que les joueurs auront après un combat, une énigme, dans un coffre, etc....

Soit on fait plusieurs tables selon la situation ou alors une seule et grosse table.

## Personnage non joueur important (PNJ)

Les PNJ sont un pilier d''une aventure, c''est eux qui permettent de faire avancer l''intrigue ou qui permettent d''ajouter de la cohérence dans le monde.

Ce qui est conseillé est de déterminer une liste de personnages importants avec :

- Fonction
- Utilité dans l''histoire
- Caractéristiques
- Magie(s)
- Classe(s)
- Nom

Après avoir une liste de pnj importante c''est bien, mais les joueurs aiment bien parler avec les passants ou ceux qui sont moins importants, d''où le conseil d''avoir une liste de nom généré à l''avance ce qui permet de sortir un prénom sans perdre trop de temps ou casser le rythme.', 'neutre', NULL, 'page', '{"id":"guide/campagne-ou-scenario-one-shot"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 682, 'guide', 'Pages de référence', 'Alignement', 'Texte', 'modifie', 'Dans Maverick, l''alignement n''est pas fixe. Il évolue au cours de l''aventure selon les actions, les décisions et les paroles du personnage. C’est une sorte de suivi de la philosophie et de la moralité du personnage, ce score n’impose pas comment jouer le personnage mais comment il évolue.

Chaque personnage possède quatre scores :

- **L : Loyal**
- **C : Chaotique**
- **B : Bon**
- **M : Mauvais**

Ces scores évoluent indépendamment et permettent de déterminer l''alignement sur deux axes : Loi/Chaos et Bien/Mal.

Pour chaque axe, une différence de 5 points ou plus entre les deux scores détermine la tendance dominante. En dessous de 5 points de différence, le personnage est Neutre sur cet axe.

Ainsi, la combinaison des deux axes permet de déterminer l''un des neuf alignements (voir plus bas)

## Faire évoluer les scores

Lorsqu''une action ou une décision influence l''alignement, le MJ ajoute généralement 1 point au score correspondant.

Certaines actions particulièrement importantes peuvent exceptionnellement rapporter davantage de points. Le MJ reste libre de déterminer si une situation doit influencer l''alignement et quel score doit être modifié.

***Sa parole sera toujours loi concernant le don de point sur l’alignement.***

## Les 4 tendances

Les quatre scores d''alignement représentent deux axes indépendants.

Loi et Chaos déterminent la manière dont un personnage considère l''individu et le collectif. Bien et Mal déterminent la manière dont un personnage considère les autres et la valeur qu''il accorde à leur vie et à leur dignité.

### Loyal

La Loi représente l''importance accordée au collectif, à l''ordre et aux obligations qui lient les individus entre eux.

Un personnage Loyal considère qu''un groupe ou une société ne peut fonctionner correctement que si ses membres acceptent certaines règles et responsabilités. Il accorde de l''importance au devoir, à la hiérarchie, aux traditions, aux engagements, à l''honneur et à la confiance.

Un Loyal peut accepter de limiter sa liberté personnelle lorsque cela permet de préserver le groupe ou de respecter un principe auquel il s''est engagé.

La Loi ne signifie cependant pas nécessairement obéir aveuglément à toutes les règles. Un personnage peut considérer qu''une loi est injuste et chercher à la changer tout en restant profondément Loyal.

De même, posséder un code personnel ne suffit pas à rendre un personnage Loyal. Ce qui compte est la place qu''il accorde aux obligations, aux principes et au collectif par rapport à sa volonté personnelle.

### Chaotique

Le Chaos représente l''importance accordée à l''individu, à sa liberté et à son libre arbitre.

Un personnage Chaotique considère que chacun doit pouvoir choisir sa propre voie et refuse généralement qu''une autorité, une tradition ou un groupe décide à sa place de la manière dont il doit vivre.

Il accorde de l''importance à la liberté, à l''indépendance, à la spontanéité, à l''adaptation et à la remise en question des règles établies.

Un Chaotique peut respecter les règles, suivre un code personnel ou faire partie d''un groupe. Ce qui le caractérise est qu''il considère que sa liberté de choisir reste fondamentale et qu''une règle n''est pas nécessairement légitime simplement parce qu''elle existe.

Le Chaos ne signifie donc pas nécessairement désordre ou irresponsabilité. Un personnage Chaotique peut être réfléchi, discipliné et profondément attaché à ses propres principes.

### Bon

Le Bien représente la valeur accordée à la vie, à la dignité et au bien-être d''autrui.

Un personnage Bon se soucie des autres et cherche à limiter leur souffrance. Il peut faire preuve d''altruisme, de compassion, de générosité, de gentillesse et de charité.

Il est capable de faire des sacrifices personnels pour aider ou protéger les autres, même lorsque cela ne lui apporte aucun avantage.

Être Bon ne signifie cependant pas être incapable de faire du mal. Un personnage Bon peut combattre, punir ou même tuer lorsqu''il considère que cela est nécessaire pour protéger autrui.

Ce qui compte est notamment la valeur qu''il accorde aux autres et la nécessité de ses actes. Lorsqu''une solution moins préjudiciable permet d''atteindre le même objectif, un personnage Bon aura généralement tendance à la privilégier.

### Mauvais

Le Mal représente la priorité accordée à ses propres intérêts au détriment de la vie, de la dignité ou du bien-être des autres.

Un personnage Mauvais peut être égoïste, cruel, manipulateur, dominateur ou indifférent à la souffrance qu''il provoque. Il n''hésite pas à utiliser ou sacrifier les autres lorsque cela lui permet d''obtenir ce qu''il désire.

Faire du mal n''est cependant pas nécessairement un objectif en soi. Un personnage Mauvais peut être parfaitement calme, raisonnable et capable de coopération lorsqu''il y trouve son intérêt.

Les plus extrêmes peuvent au contraire prendre plaisir à la souffrance, à la destruction ou à la domination d''autrui.

Le Mal ne signifie donc pas nécessairement être violent ou cruel en permanence. Il se manifeste avant tout par la valeur que le personnage accorde aux autres lorsque leurs intérêts entrent en conflit avec les siens.

Bien, maintenant que nous avons vu les 4 tendances, maintenant on va expliquer les 9 combinaisons possible.', 'Dans Maverick, l''alignement n''est pas fixe. Il évolue au cours de l''aventure selon les actions, les décisions et les paroles du personnage. C’est une sorte de suivi de la philosophie et de la moralité du personnage, ce score n’impose pas comment jouer le personnage mais comment il évolue.

Chaque personnage possède quatre scores :

- **L : Loyal**
- **C : Chaotique**
- **B : Bon**
- **M : Mauvais**

Ces scores évoluent indépendamment et permettent de déterminer l''alignement sur deux axes : Loi/Chaos et Bien/Mal.

Pour chaque axe, une différence de 5 points ou plus entre les deux scores détermine la tendance dominante. En dessous de 5 points de différence, le personnage est Neutre sur cet axe.

Ainsi, la combinaison des deux axes permet de déterminer l''un des neuf alignements (voir plus bas)

## Faire évoluer les scores

Lorsqu''une action ou une décision influence l''alignement, le MJ ajoute généralement 1 point au score correspondant.

Certaines actions particulièrement importantes peuvent exceptionnellement rapporter davantage de points. Le MJ reste libre de déterminer si une situation doit influencer l''alignement et quel score doit être modifié.

***Sa parole sera toujours loi concernant le don de point sur l’alignement.***

## Les 4 tendances

Les quatre scores d''alignement représentent deux axes indépendants.

Loi et Chaos déterminent la manière dont un personnage considère l''individu et le collectif. Bien et Mal déterminent la manière dont un personnage considère les autres et la valeur qu''il accorde à leur vie et à leur dignité.

### Loyal

La Loi représente l''importance accordée au collectif, à l''ordre et aux obligations qui lient les individus entre eux.

Un personnage Loyal considère qu''un groupe ou une société ne peut fonctionner correctement que si ses membres acceptent certaines règles et responsabilités. Il accorde de l''importance au devoir, à la hiérarchie, aux traditions, aux engagements, à l''honneur et à la confiance.

Un Loyal peut accepter de limiter sa liberté personnelle lorsque cela permet de préserver le groupe ou de respecter un principe auquel il s''est engagé.

La Loi ne signifie cependant pas nécessairement obéir aveuglément à toutes les règles. Un personnage peut considérer qu''une loi est injuste et chercher à la changer tout en restant profondément Loyal.

De même, posséder un code personnel ne suffit pas à rendre un personnage Loyal. Ce qui compte est la place qu''il accorde aux obligations, aux principes et au collectif par rapport à sa volonté personnelle.

### Chaotique

Le Chaos représente l''importance accordée à l''individu, à sa liberté et à son libre arbitre.

Un personnage Chaotique considère que chacun doit pouvoir choisir sa propre voie et refuse généralement qu''une autorité, une tradition ou un groupe décide à sa place de la manière dont il doit vivre.

Il accorde de l''importance à la liberté, à l''indépendance, à la spontanéité, à l''adaptation et à la remise en question des règles établies.

Un Chaotique peut respecter les règles, suivre un code personnel ou faire partie d''un groupe. Ce qui le caractérise est qu''il considère que sa liberté de choisir reste fondamentale et qu''une règle n''est pas nécessairement légitime simplement parce qu''elle existe.

Le Chaos ne signifie donc pas nécessairement désordre ou irresponsabilité. Un personnage Chaotique peut être réfléchi, discipliné et profondément attaché à ses propres principes.

### Bon

Le Bien représente la valeur accordée à la vie, à la dignité et au bien-être d''autrui.

Un personnage Bon se soucie des autres et cherche à limiter leur souffrance. Il peut faire preuve d''altruisme, de compassion, de générosité, de gentillesse et de charité.

Il est capable de faire des sacrifices personnels pour aider ou protéger les autres, même lorsque cela ne lui apporte aucun avantage.

Être Bon ne signifie cependant pas être incapable de faire du mal. Un personnage Bon peut combattre, punir ou même tuer lorsqu''il considère que cela est nécessaire pour protéger autrui.

Ce qui compte est notamment la valeur qu''il accorde aux autres et la nécessité de ses actes. Lorsqu''une solution moins préjudiciable permet d''atteindre le même objectif, un personnage Bon aura généralement tendance à la privilégier.

### Mauvais

Le Mal représente la priorité accordée à ses propres intérêts au détriment de la vie, de la dignité ou du bien-être des autres.

Un personnage Mauvais peut être égoïste, cruel, manipulateur, dominateur ou indifférent à la souffrance qu''il provoque. Il n''hésite pas à utiliser ou sacrifier les autres lorsque cela lui permet d''obtenir ce qu''il désire.

Faire du mal n''est cependant pas nécessairement un objectif en soi. Un personnage Mauvais peut être parfaitement calme, raisonnable et capable de coopération lorsqu''il y trouve son intérêt.

Les plus extrêmes peuvent au contraire prendre plaisir à la souffrance, à la destruction ou à la domination d''autrui.

Le Mal ne signifie donc pas nécessairement être violent ou cruel en permanence. Il se manifeste avant tout par la valeur que le personnage accorde aux autres lorsque leurs intérêts entrent en conflit avec les siens.

Bien, maintenant que nous avons vu les 4 tendances, maintenant on va expliquer les 9 combinaisons possibles.', 'neutre', NULL, 'page', '{"id":"guide/alignement"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 683, 'guide', 'Pages de référence', 'Altérations d''états et Mode Hyper', 'Texte', 'modifie', '## Altérations d''états

Il s''agit d''un changement de condition auprès du joueur. Cela inflige des malus à la cible qui a plus qu''intérêt à rapidement s''en débarrasser. Il existe de nombreux types d''altérations d''états qu’on peut retrouver [ici](https://docs.google.com/spreadsheets/u/0/d/1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c/edit).

## Mode Hyper

Retrouvez les informations et les explications du monde hyper [ici](https://docs.google.com/spreadsheets/u/0/d/1lwALh1VKrIpgmEqX2MdYirKkPzGjSJXXDHtp2uYXO7w/edit).', '## Altérations d''états

Il s''agit d''un changement de condition auprès du joueur. Cela inflige des malus à la cible qui a plus qu''intérêt à rapidement s''en débarrasser. Il existe de nombreux types d''altérations d''états qu’on peut retrouver [ici](https://docs.google.com/spreadsheets/u/0/d/1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0/edit).

## Mode Hyper

Retrouvez les informations et les explications du monde hyper [ici](https://docs.google.com/spreadsheets/u/0/d/1AjQyT-IZMULq6FlgnmVmn2QiQ9AWhhbOgjr-COgMyMo/edit).', 'neutre', NULL, 'page', '{"id":"guide/alterations-d-etats-et-mode-hyper"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 684, 'guide', 'Pages de référence', 'Attaque et Défense', 'Texte', 'modifie', '## Attaque

Quand une attaque est prodiguée, un jet de D100 est nécessaire pour réussir l''action (il faut faire son score ou moins pour réussir).

**Cas particuliers :**

Lors d''une réussite critique (score au dé = 1 - 5), les dégâts de base seront doublés ! La défense doit faire une réussite critique supérieure pour réussir à bloquer un tel coup.

Lors d''un échec critique (score au dé = 96 - 100), la cible bénéficie d''une attaque d''opportunité ou bien peut désarmer la cible (si c’est possible), ou autre idée du mj.

## Défense

Lors d''une parade ou esquive, un jet de D100 est nécessaire pour réussir l''action mais deux condition doivent être réuni pour bloquer totalement l''attaque : doit réussir son jet de parade ou esquive ET doit faire un score égal ou meilleur que celui de l''attaquant !

Si le test de parade/esquive est réussi mais le score n''est pas meilleur que celui de l''attaquant : les dégâts finaux sont divisés par 2. Si jamais une parade est faite avec un bouclier, les AP ou AM du bouclier s''appliquent à ce moment-là.

Si le test de parade/esquive est raté malgré un meilleur score, le test est quand même échoué donc dégâts normaux.

**Cas particuliers :**

Lors d''une réussite critique, une contre-attaque est possible (dans la mesure du possible) ou une autre idée du MJ.

Lors d''un échec critique, les AP et AM ne sont pas pris en compte dans les dégâts et l''agresseur inflige un bonus de +8 dégâts ou une autre idée du MJ.

Lors d’une attaque de zone, l’Esquive à un malus de 5% par case parcouru pour échapper à l’attaque, le maximum de cases correspond à [[La Vitesse et la Portée|la vitesse]] du personnage (Un personnage à 4 de vitesse ne pourra pas esquiver une zone qui s’étend à 5 cases ou plus). La parade n’est pas concernée.

Encore par rapport aux attaques de zone, une personne ne peut pas protéger quelqu’un à côté d’elle si les deux sont dans l’attaque de zone, malgré la posture de défense.

## Localisation des dégâts

| **Zone touchée** | **Malus pour toucher** | **Effet** |
| :-: | :-: | :-: |
| **Tête** | -25% | Le coup inflige **+10 dégâts** |
| **Corps** | 0% | Aucun effet |
| **Bras droit** | -18% | **-15%** au prochain test d’attaque avec une arme |
| **Bras gauche** | -18% | **-5%** au prochain test (peu importe lequel) |
| **Jambe droite** | -12% | **-1 vitesse** au prochain tour |
| **Jambe gauche** | -12% | **-4 initiative** au prochain tour |

## Règles supplémentaires

- **Personnage gaucher :** les effets entre bras droit / bras gauche et jambe droite / jambe gauche sont **inversés**.
- **Humanoïde par défaut :** ce tableau est pensé pour les créatures humanoïdes.
- **Adaptation pour monstres :** n’hésite pas à réassigner certaines zones pour coller à l’anatomie de la créature.

  **Exemple :** pour un scorpion, la « tête » correspondait à sa **queue**, et donc le malus/effet s’y appliquaient.', '## Attaque

Quand une attaque est prodiguée, un jet de D100 est nécessaire pour réussir l''action (il faut faire son score ou moins pour réussir).

**Cas particuliers :**

Lors d''une réussite critique (score au dé = 1 - 5), les dégâts de base seront doublés ! La défense doit faire une réussite critique supérieure pour réussir à bloquer un tel coup.

Lors d''un échec critique (score au dé = 96 - 100), la cible bénéficie d''une attaque d''opportunité ou bien peut désarmer la cible (si c’est possible), ou autre idée du mj.

## Défense

Lors d''une parade ou esquive, un jet de D100 est nécessaire pour réussir l''action mais deux conditions doivent être réunies pour bloquer totalement l''attaque : doit réussir son jet de parade ou esquive ET doit faire un score égal ou meilleur que celui de l''attaquant !

Si le test de parade/esquive est réussi mais le score n''est pas meilleur que celui de l''attaquant : les dégâts finaux sont divisés par 2. Si jamais une parade est faite avec un bouclier, les AP ou AM du bouclier s''appliquent à ce moment-là.

Si le test de parade/esquive est raté malgré un meilleur score, le test est quand même échoué donc dégâts normaux.

**Cas particuliers :**

Lors d''une réussite critique, une contre-attaque est possible (dans la mesure du possible) ou une autre idée du MJ.

Lors d''un échec critique, les AP et AM ne sont pas pris en compte dans les dégâts et l''agresseur inflige un bonus de +8 dégâts ou une autre idée du MJ.

Lors d’une attaque de zone, l’Esquive a un malus de 5% par case parcourue pour échapper à l’attaque, le maximum de cases correspond à [[La Vitesse et la Portée|la vitesse]] du personnage (Un personnage à 4 de vitesse ne pourra pas esquiver une zone qui s’étend à 5 cases ou plus). La parade n’est pas concernée.

Encore par rapport aux attaques de zone, une personne ne peut pas protéger quelqu’un à côté d’elle si les deux sont dans l’attaque de zone, malgré la posture de défense.

## Localisation des dégâts

| **Zone touchée** | **Malus pour toucher** | **Effet** |
| :-: | :-: | :-: |
| **Tête** | -25% | Le coup inflige **+10 dégâts** |
| **Corps** | 0% | Aucun effet |
| **Bras droit** | -18% | **-15%** au prochain test d’attaque avec une arme |
| **Bras gauche** | -18% | **-5%** au prochain test (peu importe lequel) |
| **Jambe droite** | -12% | **-1 vitesse** au prochain tour |
| **Jambe gauche** | -12% | **-4 initiative** au prochain tour |

## Règles supplémentaires

- **Personnage gaucher :** les effets entre bras droit / bras gauche et jambe droite / jambe gauche sont **inversés**.
- **Humanoïde par défaut :** ce tableau est pensé pour les créatures humanoïdes.
- **Adaptation pour monstres :** n’hésite pas à réassigner certaines zones pour coller à l’anatomie de la créature.

  **Exemple :** pour un scorpion, la « tête » correspondait à sa **queue**, et donc le malus/effet s’y appliquaient.', 'neutre', NULL, 'page', '{"id":"guide/attaque-et-defense"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 685, 'guide', 'Pages de référence', 'Distance et voyage', 'Texte', 'modifie', 'Dans Maverick, il est possible de faire de long voyage et il est important de calculer le temps de voyage pour les joueurs.

Les cartes mis à jour possèdent leur échelle accessible et voici plusieurs tableaux qui peuvent donner une indication sur comment calculer les distances :

En moyenne les aventuriers à pied avec leur équipement se déplacent à 4 km/h et font des voyages de 8h, libre à vous de modifier les valeurs et de rester cohérent (genre si ils font 10h de voyage, ils n''auront moins ou pas de dé de repos). [[La Vitesse et la Portée|La vitesse]] avec une diligence peut monter à 10 km/h et avec des cheveux personnels 20 km/h en moyenne.

**Distance = 4 km/h × 8h × (modificateur de terrain) × (modificateur météo)**

| **Type de terrain** | **Description** | **Modificateur** |
| :-: | :-: | :-: |
| Route pavé | Route, voie, chemin entretenue | x1.0 |
| Plaine/prairie ouverte | Terrain stable | x0.9 |
| Forêt clairsemée/colline douce | Légères irrégularités | x0.8 |
| Forêt dense/terrain rocailleux | Obstacles fréquents | x0.6 |
| Montagne/neige légère/marécage | Terrain difficile, progression lente | x0.5 |
| Montagne escarpée/désert | Terrain très difficile | x0.4 |
| Zone extrême (neige profonde, lave) | Presque impraticable | x0.25 |

| **Météo** | **Modificateur** |
| :-: | :-: |
| Normal | x1.0 |
| Grand soleil | x0.9 |
| Canicule | x0.7 |
| Pluie | x0.85 |
| Pluie diluvienne | x0.6 |
| Neige | x0.8 |
| Tempête de neige | x0.4 |
| Vent violent | x0.7 |
| Brouillard | x0.85 |
| Purée de poix | x0.6 |
| Orage | x0.5 |

Je mettrai des exemples plus tard, faites moi y penser si je l’ai pas encore fait !', 'Dans Maverick, il est possible de faire de longs voyages et il est important de calculer le temps de voyage pour les joueurs.

Les cartes mises à jour possèdent leur échelle accessible et voici plusieurs tableaux qui peuvent donner une indication sur comment calculer les distances :

En moyenne les aventuriers à pied avec leur équipement se déplacent à 4 km/h et font des voyages de 8h, libre à vous de modifier les valeurs et de rester cohérent (genre s''ils font 10h de voyage, ils n''auront moins ou pas de dé de repos). [[La Vitesse et la Portée|La vitesse]] avec une diligence peut monter à 10 km/h et avec des cheveux personnels 20 km/h en moyenne.

**Distance = 4 km/h × 8h × (modificateur de terrain) × (modificateur météo)**

| **Type de terrain** | **Description** | **Modificateur** |
| :-: | :-: | :-: |
| Route pavée | Route, voie, chemin entretenue | x1.0 |
| Plaine/prairie ouverte | Terrain stable | x0.9 |
| Forêt clairsemée/colline douce | Légères irrégularités | x0.8 |
| Forêt dense/terrain rocailleux | Obstacles fréquents | x0.6 |
| Montagne/neige légère/marécage | Terrain difficile, progression lente | x0.5 |
| Montagne escarpée/désert | Terrain très difficile | x0.4 |
| Zone extrême (neige profonde, lave) | Presque impraticable | x0.25 |

| **Météo** | **Modificateur** |
| :-: | :-: |
| Normal | x1.0 |
| Grand soleil | x0.9 |
| Canicule | x0.7 |
| Pluie | x0.85 |
| Pluie diluvienne | x0.6 |
| Neige | x0.8 |
| Tempête de neige | x0.4 |
| Vent violent | x0.7 |
| Brouillard | x0.85 |
| Purée de pois | x0.6 |
| Orage | x0.5 |

Je mettrai des exemples plus tard, faites-moi y penser si je l’ai pas encore fait !', 'neutre', NULL, 'page', '{"id":"guide/distance-et-voyage"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 686, 'guide', 'Pages de référence', 'Donjon Pas bon', 'Texte', 'modifie', 'Parmi les nombreux lieux qui sont remplis de danger, les donjons sont certainement les plus mortels et ceux qui mettent à l’épreuve les aventuriers. Nous allons voir ici quelques conseils pour faire votre petit donjon idéal.

## Type de donjon

Évidemment, les donjons ne sont pas tous identiques, voici quelques types de donjons qui peuvent exister :

- Les structures naturelles

  Ce sont en général des cavernes naturelles qui abritent bon nombres de créatures qui apprécient ce genre de lieux, ce sont d’énormes labyrinthes aléatoires.

  On peut aussi imaginer que les forêts denses peuvent servir de donjon, les aventuriers qui perdent la route pourraient très bien finir dans des forêts.

  Ces lieux sont très peu piégés.

- Les structures occupés

  C’est un donjon qui est toujours utilisé. Il est occupé par des créatures intelligentes voir des factions entières, que ce soit les créateurs ou non.

  Cela peut être une maison, une tour, un château, un temple, une forteresse, une mine, etc…

  [[Les pièges]] peuvent être très nombreux.

- Les ruines

  C’est un peu l’inverse des structures occupées, ce sont des structures qui ont été laissées à l’abandon, à la merci de la nature Cela dit, ça n’empêche pas des factions ou alors des monstres de prendre possession des lieux.

  Cela peut être des tours effondrées, d''anciens châteaux, d''anciennes maisons, des forteresses abandonnées, etc..

  Les pièges peuvent être nombreux, mais en général ils sont en mauvais état ou alors ils ont été déjà déclenchés.

- Entrepôt

  Ce sont des lieux où se trouvent les trésors mais c’est également dans ces lieux où se trouvent le plus de pièges actifs, prêts à exterminer les aventuriers qui ne sont pas attentifs.

Tout ceci ne sont que des exemples, n’hésitez pas à être créatif !', 'Parmi les nombreux lieux qui sont remplis de danger, les donjons sont certainement les plus mortels et ceux qui mettent à l’épreuve les aventuriers. Nous allons voir ici quelques conseils pour faire votre petit donjon idéal.

## Type de donjon

Évidemment, les donjons ne sont pas tous identiques, voici quelques types de donjons qui peuvent exister :

- Les structures naturelles

  Ce sont en général des cavernes naturelles qui abritent bon nombre de créatures qui apprécient ce genre de lieux, ce sont d’énormes labyrinthes aléatoires.

  On peut aussi imaginer que les forêts denses peuvent servir de donjon, les aventuriers qui perdent la route pourraient très bien finir dans des forêts.

  Ces lieux sont très peu piégés.

- Les structures occupées

  C’est un donjon qui est toujours utilisé. Il est occupé par des créatures intelligentes voire des factions entières, que ce soit les créateurs ou non.

  Cela peut être une maison, une tour, un château, un temple, une forteresse, une mine, etc…

  [[Les pièges]] peuvent être très nombreux.

- Les ruines

  C’est un peu l’inverse des structures occupées, ce sont des structures qui ont été laissées à l’abandon, à la merci de la nature Cela dit, ça n’empêche pas des factions ou alors des monstres de prendre possession des lieux.

  Cela peut être des tours effondrées, d''anciens châteaux, d''anciennes maisons, des forteresses abandonnées, etc..

  Les pièges peuvent être nombreux, mais en général ils sont en mauvais état ou alors ils ont été déjà déclenchés.

- Entrepôt

  Ce sont des lieux où se trouvent les trésors mais c’est également dans ces lieux où se trouvent le plus de pièges actifs, prêts à exterminer les aventuriers qui ne sont pas attentifs.

Tout ceci ne sont que des exemples, n’hésitez pas à être créatif !', 'neutre', NULL, 'page', '{"id":"guide/donjon-pas-bon"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 687, 'guide', 'Pages de référence', 'En résumé', 'Texte', 'modifie', 'Il y a beaucoup de choses à prendre en compte pendant les combats dans Maverick, nous allons résumer le déroulement d’un tour.

- ***Début du combat***

  Le Maître du jeu commence à préparer tout ce qu’il lui faut pour noter les initiatives des joueurs et des ennemis. Préparer une battlemap si nécessaire.

- ***Initiative***

  Le Maître du Jeu déclare le début du tour. Chaque joueur lance un D20 pour déterminer son initiative. Le Maître du Jeu fait de même pour les PNJ et les ennemis. L’ordre du tour est établi du score le plus élevé au plus bas. À chaque début de tour, les initiatives sont relancées.

- ***Effets secondaires/[[Altérations d''états et Mode Hyper|Altérations d’états]]***

  Avant de faire quoi que ce soit, un personnage subit les effets qui s’appliquent en début de tour (ex. : poison, brûlure, ...).

- ***Choix posture***

  Dès que c’est le tour d’un joueur, il va devoir déclarer sa posture de combat avant de faire quoi que ce soit. Cette posture va en grande partie déterminer ce qu’il va pouvoir faire par la suite. Le Maître du jeu peut jouer avec les postures et il peut le dire de manière alambiquée pour que les joueurs essayent de comprendre la posture de leur adversaire.

- ***Déplacement***

  C’est bon, la posture est choisie il est temps de se déplacer sur le terrain, c’est votre vitesse qui détermine combien de case vous pouvez parcourir sur le tour. Il n’est pas obligatoire d’utiliser toutes ses cases de déplacement, il est possible de faire un déplacement partiel pour finir le déplacement un peu plus tard ou alors de ne pas bouger du tout pour garder le déplacement à plus tard.

- ***IC ou Action bonus***

  Vous pouvez réaliser des actions bonus avant de faire votre action, c’est maximum 3 par tour et jamais 2 fois le même (sauf contre indication).

- ***Action***

  C’est le moment de décider de votre action principale durant votre tour de jeu. Nombreuses sont les actions possibles comme attaquer avec votre arme, lancer un sort, utiliser un objet, sprinter ou même utiliser un quatrième IC.

- ***Déplacement 2***

  Il n’est pas impossible que vous n''ayez pas fait tout votre déplacement avant l’action voire pas du tout, il est possible de le faire après ce dernier.

- ***Fin de tour***

  Et voilà le tour du joueur où de l’ennemi est terminé, on passe au suivant.

- ***En dehors du tour et réaction.***

  Il est possible qu''en dehors de votre tour, vous puissiez faire des choses :

  - Comme vous défendre contre des assauts ennemis selon votre posture de combat.
  - Utilisez certaines capacités de votre classe qui sont catégorisées comme “réaction”.
  - Ou autre chose qui permettra une réaction.

Le MJ arbitre leur validité selon la situation.

Faites en sorte de garder cette section dans un coin de votre esprit ou à portée de main pour permettre au combat d’être fluide et perdre le moins de temps possible car comme vous le savez sûrement déjà, les combats dans un jdr peuvent être long.', 'Il y a beaucoup de choses à prendre en compte pendant les combats dans Maverick, nous allons résumer le déroulement d’un tour.

- ***Début du combat***

  Le Maître du jeu commence à préparer tout ce qu’il lui faut pour noter les initiatives des joueurs et des ennemis. Préparer une battlemap si nécessaire.

- ***Initiative***

  Le Maître du Jeu déclare le début du tour. Chaque joueur lance un D20 pour déterminer son initiative. Le Maître du Jeu fait de même pour les PNJ et les ennemis. L’ordre du tour est établi du score le plus élevé au plus bas. À chaque début de tour, les initiatives sont relancées.

- ***Effets secondaires/[[Altérations d''états et Mode Hyper|Altérations d’états]]***

  Avant de faire quoi que ce soit, un personnage subit les effets qui s’appliquent en début de tour (ex. : poison, brûlure, ...).

- ***Choix posture***

  Dès que c’est le tour d’un joueur, il va devoir déclarer sa posture de combat avant de faire quoi que ce soit. Cette posture va en grande partie déterminer ce qu’il va pouvoir faire par la suite. Le Maître du jeu peut jouer avec les postures et il peut le dire de manière alambiquée pour que les joueurs essayent de comprendre la posture de leur adversaire.

- ***Déplacement***

  C’est bon, la posture est choisie il est temps de se déplacer sur le terrain, c’est votre vitesse qui détermine combien de cases vous pouvez parcourir sur le tour. Il n’est pas obligatoire d’utiliser toutes ses cases de déplacement, il est possible de faire un déplacement partiel pour finir le déplacement un peu plus tard ou alors de ne pas bouger du tout pour garder le déplacement à plus tard.

- ***IC ou Action bonus***

  Vous pouvez réaliser des actions bonus avant de faire votre action, c’est maximum 3 par tour et jamais 2 fois le même (sauf contre-indication).

- ***Action***

  C’est le moment de décider de votre action principale durant votre tour de jeu. Nombreuses sont les actions possibles comme attaquer avec votre arme, lancer un sort, utiliser un objet, sprinter ou même utiliser un quatrième IC.

- ***Déplacement 2***

  Il n’est pas impossible que vous n''ayez pas fait tout votre déplacement avant l’action voire pas du tout, il est possible de le faire après ce dernier.

- ***Fin de tour***

  Et voilà le tour du joueur ou de l’ennemi est terminé, on passe au suivant.

- ***En dehors du tour et réaction.***

  Il est possible qu''en dehors de votre tour, vous puissiez faire des choses :

  - Comme vous défendre contre des assauts ennemis selon votre posture de combat.
  - Utiliser certaines capacités de votre classe qui sont catégorisées comme “réaction”.
  - Ou autre chose qui permettra une réaction.

Le MJ arbitre leur validité selon la situation.

Faites en sorte de garder cette section dans un coin de votre esprit ou à portée de main pour permettre au combat d’être fluide et perdre le moins de temps possible car comme vous le savez sûrement déjà, les combats dans un jdr peuvent être longs.', 'neutre', NULL, 'page', '{"id":"guide/en-resume-deroulement-d-un-tour"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 688, 'guide', 'Pages de référence', 'Fiche de personnage : Accessoires et Ceinture', 'Texte', 'modifie', '## Accessoires

6 emplacements pour y mettre des accessoires aux effets variés. Plus d’info dans “[Ressources et craft](https://docs.google.com/spreadsheets/u/0/d/12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA/edit)” et l’onglet “Accessoires”.

## Ceinture

La ceinture est un accessoire que tout le monde possède (sauf si vous avez les parties à l''air ... évidemment) qui possède 3 emplacements d''objets rapides. Ces emplacement permet l''utilisation d''objet en IC (ou 2 IC pour certains comme allumer un objet ou faire des soin physique) là où avant c''était une action complète, voici une petite liste non exhaustive des objets qui peuvent être mis sur la ceinture :

- Fiole de soin ou de poison, ce qui permet une - utilisation plus rapide de ces dernières
- Briquet ou objet pour allumer des autres objets
- Torche ou Lanterne
- Les différents kits comme celui de soin, du voleur, du saboteur, etc...
- Une corde
- Ou tout autre objets de petite taille qui pourrait se mettre sur la ceinture

Voyez avec votre mj pour voir quel objet pourrait se mettre sur votre ceinture, impossible de penser a absolument tout Attention il y a des choses à savoir :

Certains objets ne peuvent pas se mettre comme les armes (ils ont leur emplacement dédié)

Les objets sont dans la ceinture ne peuvent pas dépasser le nombre de 3 (impossible de cumuler les objets à l''infini)

Les carquois, sac de bombe ou sac de pierre DOIVENT être mis dans la ceinture pour être utilisé, vous pouvez mettre le nombre de flèche que peut contenir le carquois maximum', '## Accessoires

6 emplacements pour y mettre des accessoires aux effets variés. Plus d’info dans “[Ressources et craft](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit)” et l’onglet “Accessoires”.

## Ceinture

La ceinture est un accessoire que tout le monde possède (sauf si vous avez les parties à l''air ... évidemment) qui possède 3 emplacements d''objets rapides. Ces emplacements permettent l''utilisation d''objet en IC (ou 2 IC pour certains comme allumer un objet ou faire des soins physiques) là où avant c''était une action complète, voici une petite liste non exhaustive des objets qui peuvent être mis sur la ceinture :

- Fiole de soin ou de poison, ce qui permet une - utilisation plus rapide de ces dernières
- Briquet ou objet pour allumer des autres objets
- Torche ou Lanterne
- Les différents kits comme celui de soin, du voleur, du saboteur, etc...
- Une corde
- Ou tout autre objet de petite taille qui pourrait se mettre sur la ceinture

Voyez avec votre mj pour voir quel objet pourrait se mettre sur votre ceinture, impossible de penser à absolument tout Attention il y a des choses à savoir :

Certains objets ne peuvent pas se mettre comme les armes (ils ont leur emplacement dédié)

Les objets sont dans la ceinture ne peuvent pas dépasser le nombre de 3 (impossible de cumuler les objets à l''infini)

Les carquois, sac de bombe ou sac de pierre DOIVENT être mis dans la ceinture pour être utilisés, vous pouvez mettre le nombre de flèches que peut contenir le carquois maximum', 'neutre', NULL, 'page', '{"id":"guide/fiche-accessoires-et-ceinture"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 689, 'guide', 'Pages de référence', 'Fiche de personnage : Armure/Défense/Bouclier', 'Texte', 'modifie', 'C’est ici qu’on retrouve toutes les informations sur la défense du personnage.

**AP base** : Il s’agit de l’armure physique que possède naturellement un personnage, elle est déterminer si une race possède un bonus d’armure physique (exemple : Certains Drakos, Namazu, etc…) ou alors par un objet.

**AM base** : Il s’agit de l’armure magique que possède naturellement un personnage, elle est principalement déterminée si le personnage possède des classes magiques ou non. Chaque classe magique donne 4 AM. Certaines races peuvent en donner comme les Drakos ou les Marcass, ou alors certains objets magiques.

L''armure est divisé en 6 morceaux :

- T = Tête
- C = Corps
- BG = Bras Gauche
- BD = Bras Droit
- JG = Jambe Gauche
- JD = Jambe Droite

Elle possède également une Dur. (durabilité comme pour les armes)

**Bonus/Malus** : Cela correspond à des particularités, effets secondaires de l’armure mais aussi de son comportement contre les dégâts physiques (Estoc, Taille, Frappe), allez dans le document [Ressources et Craft](https://docs.google.com/spreadsheets/u/0/d/12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA/edit), et dans Armures pour plus d''informations.

Le Bouclier permet d’avoir des AP et AM en plus de votre armure mais pour qu’ils soient compté, ça implique une “Parade partiel”. Il peut être de différentes compositions, allez [ici](https://docs.google.com/spreadsheets/u/0/d/12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA/edit) pour plus d''informations.', 'C’est ici qu’on retrouve toutes les informations sur la défense du personnage.

**AP base** : Il s’agit de l’armure physique que possède naturellement un personnage, elle est déterminée si une race possède un bonus d’armure physique (exemple : Certains Drakos, Namazu, etc…) ou alors par un objet.

**AM base** : Il s’agit de l’armure magique que possède naturellement un personnage, elle est principalement déterminée si le personnage possède des classes magiques ou non. Chaque classe magique donne 4 AM. Certaines races peuvent en donner comme les Drakos ou les Marcass, ou alors certains objets magiques.

L''armure est divisée en 6 morceaux :

- T = Tête
- C = Corps
- BG = Bras Gauche
- BD = Bras Droit
- JG = Jambe Gauche
- JD = Jambe Droite

Elle possède également une Dur. (durabilité comme pour les armes)

**Bonus/Malus** : Cela correspond à des particularités, effets secondaires de l’armure mais aussi de son comportement contre les dégâts physiques (Estoc, Taille, Frappe), allez dans le document [Ressources et Craft](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit), et dans Armures pour plus d''informations.

Le Bouclier permet d’avoir des AP et AM en plus de votre armure mais pour qu’ils soient comptés, ça implique une “Parade partielle”. Il peut être de différentes compositions, allez [ici](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit) pour plus d''informations.', 'neutre', NULL, 'page', '{"id":"guide/fiche-armure-defense-bouclier"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 690, 'guide', 'Pages de référence', 'Fiche de personnage : Attributs', 'Texte', 'modifie', '**Santé** : Il s''agit du nombre de points de vie que possède le personnage, si ce score atteint 0 ou moins le personnage est considéré comme dans le coma et doit faire des jets de survie. Si jamais 3 jets de survie échouent, le personnage meurt. Un seul jet de survie réussi suffit à stabiliser le personnage. La santé est déterminée par plusieurs choses => La Race, la ou les Classes ainsi que de la Magie du Sang (si jamais vous avez cette magie)

**Âme/Sang** : Appelée aussi la 4ème barre, il s''agit d''un attribut qui ne concerne que les utilisateurs de la Nécromancie et de la Magie du Sang . Il s''agit d''une réserve qui doit être utilisée lors de l''utilisation de certains sortilèges. Cet attribut se recharge de 1 point par tour dans les combats. Il est fixé à 10 pour les deux.

**Chakra** : C''est le nombre de points de magie que possède le personnage, c''est ce qui permet de lancer des sortilèges, pas de chakra = pas de sortilèges. Le chakra est déterminé par plusieurs choses => La Race, la ou les Classes ainsi que les différentes magies.

La consommation de chakra est indiqué sur les sorts mais il y a des cas particuliers : L’Échec critique avec un sort consomme le double du coût, l’échec au jet pour utiliser un sort fait consommer la moitié du coût de base.

**Corruption** : Cet attribut un peu particulier possède le même taux que le Chakra et évolue en même temps que ce dernier. La corruption est un poison pour le lobe de chakra (un organe situé dans le cerveau).

Chaque point de corruption va empêcher l’utilisation du chakra, comme une substance parasite qui va prendre la place du chakra. Si la corruption atteint le seuil maximum, votre personnage a 2 semaines dans le jeu pour retirer au moins 1 point de corruption sinon il va mourir et se transformer en abomination de corruption.

Pour résumer : Vous avez par exemple 25 de chakra maximum, si jamais vous avez 2 points de corruption, vous ne pourrez pas monter au-delà de 23/25 car la corruption prend la place.

***PS : Ceux qui utilisent la magie de la corruption ne sont pas concernés par cette règle.***

**Barrière** : Il s''agit d''une seconde peau magique qui permet de protéger la chair. La barrière est en quelque sorte de la santé magique, son taux est déterminé par le total de chakra : [Chakra totale divisé par 2 = Barrière totale] (exemple : 20 Chakra = 10 Barrière). Il existe certaines classes/races qui offrent de la barrière. Par logique, plus vous avez de chakra, plus vous aurez de barrière. Ce qui fait que les mages ont des barrières colossales MAIS ... il existe des matériaux pour les armes qui sont capable de contrer cette peau magique comme le Mithril qui est capable de passer à travers la barrière, mais aussi le Maverium, qui lui, casse la barrière à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des barrière)

**Vitesse** : Il s''agit de l''attribut qui détermine le nombre de cases qu''un personnage peut parcourir le tour où il joue (plus détail [ici](https://maverick-jdr.fandom.com/fr/wiki/Combat))

**INI ou Initiative** : C''est la valeur qui détermine à quel moment vous allez commencer à jouer lors d''un combat. D20 car on lance ce dé pour l''initiative et le + ... est déterminé par l''Agilité

| **1 Agilité** | **2 Agilité** | **3 Agilité** | **4 Agilité** | **5 Agilité** (Atteignable uniquement avec la magie du Vent ou de la Foudre/Vent |
| :-: | :-: | :-: | :-: | :-: |
| -2 initiative | +0 initiative | +2 initiative | +4 initiative | +6 initiative |', '**Santé** : Il s''agit du nombre de points de vie que possède le personnage, si ce score atteint 0 ou moins le personnage est considéré comme dans le coma et doit faire des jets de survie. Si jamais 3 jets de survie échouent, le personnage meurt. Un seul jet de survie réussi suffit à stabiliser le personnage. La santé est déterminée par plusieurs choses => La Race, la ou les Classes ainsi que de la Magie du Sang (si jamais vous avez cette magie)

**Âme/Sang** : Appelée aussi la 4ème barre, il s''agit d''un attribut qui ne concerne que les utilisateurs de la Nécromancie et de la Magie du Sang . Il s''agit d''une réserve qui doit être utilisée lors de l''utilisation de certains sortilèges. Cet attribut se recharge de 1 point par tour dans les combats. Il est fixé à 10 pour les deux.

**Chakra** : C''est le nombre de points de magie que possède le personnage, c''est ce qui permet de lancer des sortilèges, pas de chakra = pas de sortilèges. Le chakra est déterminé par plusieurs choses => La Race, la ou les Classes ainsi que les différentes magies.

La consommation de chakra est indiquée sur les sorts mais il y a des cas particuliers : L’Échec critique avec un sort consomme le double du coût, l’échec au jet pour utiliser un sort fait consommer la moitié du coût de base.

**Corruption** : Cet attribut un peu particulier possède le même taux que le Chakra et évolue en même temps que ce dernier. La corruption est un poison pour le lobe de chakra (un organe situé dans le cerveau).

Chaque point de corruption va empêcher l’utilisation du chakra, comme une substance parasite qui va prendre la place du chakra. Si la corruption atteint le seuil maximum, votre personnage a 2 semaines dans le jeu pour retirer au moins 1 point de corruption sinon il va mourir et se transformer en abomination de corruption.

Pour résumer : Vous avez par exemple 25 de chakra maximum, si jamais vous avez 2 points de corruption, vous ne pourrez pas monter au-delà de 23/25 car la corruption prend la place.

***PS : Ceux qui utilisent la magie de la corruption ne sont pas concernés par cette règle.***

**Barrière** : Il s''agit d''une seconde peau magique qui permet de protéger la chair. La barrière est en quelque sorte de la santé magique, son taux est déterminé par le total de chakra : [Chakra total divisé par 2 = Barrière totale] (exemple : 20 Chakra = 10 Barrière). Il existe certaines classes/races qui offrent de la barrière. Par logique, plus vous avez de chakra, plus vous aurez de barrière. Ce qui fait que les mages ont des barrières colossales MAIS ... il existe des matériaux pour les armes qui sont capables de contrer cette peau magique comme le Mythril qui est capable de passer à travers la barrière, mais aussi le Maverium, qui lui, casse la barrière à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des barrières)

**Vitesse** : Il s''agit de l''attribut qui détermine le nombre de cases qu''un personnage peut parcourir le tour où il joue (plus détail [ici](https://maverick-jdr.fandom.com/fr/wiki/Combat))

**INI ou Initiative** : C''est la valeur qui détermine à quel moment vous allez commencer à jouer lors d''un combat. D20 car on lance ce dé pour l''initiative et le + ... est déterminé par l''Agilité

| **1 Agilité** | **2 Agilité** | **3 Agilité** | **4 Agilité** | **5 Agilité** (Atteignable uniquement avec la magie du Vent ou de la Foudre/Vent |
| :-: | :-: | :-: | :-: | :-: |
| -2 initiative | +0 initiative | +2 initiative | +4 initiative | +6 initiative |', 'neutre', NULL, 'page', '{"id":"guide/fiche-attributs"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 691, 'guide', 'Pages de référence', 'Fiche de personnage : Capacités/Dons', 'Titre', 'modifie', 'Fiche de personnage : Capacités/Don', 'Fiche de personnage : Capacités/Dons', 'neutre', NULL, 'page', '{"id":"guide/fiche-capacites-dons"}', 'titre');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 692, 'guide', 'Pages de référence', 'Fiche de personnage : Capacités/Dons', 'Texte', 'modifie', 'Il s''agit du tableau ou se trouve toutes les capacités spéciales de votre personnage, il se divise en 4 catégories :

- **BASE** : Cet emplacement unique est ici pour y inscrire soit méditation ou soit repos. Le don est trouvable dans la race.
- **RACE** : Cet emplacement unique est ici pour y inscrire le don raciale de votre race, voir [ici](https://docs.google.com/spreadsheets/u/0/d/1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4/edit) pour avoir la liste des races.
- **MÉTIER** : Cet emplacement est là pour noter le métier de votre personnage, les [métiers](https://docs.google.com/document/u/0/d/1ilcolQXx_MRTMKt6N2n243N8GU9HSajihMT_JNRDI14/edit) donnent des bonus divers et variés.
- **ENTRAÎNEMENT** : Cet emplacement est là pour noter tous les bonus relatifs à l''avancée des différents entraînements qu''aurait fait votre personnage. Vous ne pouvez monter que 15 compétences maximum grâce à cette case et à hauteur maximum 10% de bonus.

Lors d''un entraînement, un jet de D100 est lancé et selon le score vous montez plus ou moins votre compétence

| Valeur du dé | Bonus obtenu |
| :-: | :-: |
| 1-20 | 5% d''acquis |
| 21-40 | 4% d''acquis |
| 41-60 | 3% d''acquis |
| 61-80 | 2% d''acquis |
| 81-95 | 1% d''acquis |
| 96-100 | Entraînement raté ! |

Les entraînements peuvent être donner par des PNJ importants (aux mj de le décider) mais globalement par des entraîneurs dans les villes et villages contre une coquette somme d''or (déterminée par les mj)

- **CLASSES** : Ces 14 emplacements sont ici pour accueillir les dons offerts par les classes, voir [ici](https://maverick-jdr.fandom.com/fr/wiki/Classe) pour les classes.
- **ÉVÉVENEMENTS** : Ce sont des dons qui peuvent arriver sans prévenir, ils peuvent être négatifs ou positifs.

Les Dons possèdent 4 types :

- Passif : Don qui est toujours effectif.
- Actif : Le joueur doit déclarer le don pour que son effet fonctionne. (Activation immédiate), il n’y pas de limite sur le nombre d''actifs qui peuvent être activés.
- Action : Le joueur déclare ce don comme étant l’action de son tour.
- Réaction : Le joueur joue ces dons en dehors de son tour.', 'Il s''agit du tableau où se trouvent toutes les capacités spéciales de votre personnage, il se divise en 4 catégories :

- **BASE** : Cet emplacement unique est ici pour y inscrire soit méditation ou soit repos. Le don est trouvable dans la race.
- **RACE** : Cet emplacement unique est ici pour y inscrire le don racial de votre race, voir [ici](https://docs.google.com/spreadsheets/u/0/d/150Q6SJi4ft0oROtwT6snMAZUdWMVtkblxwYY9TqxV4Q/edit) pour avoir la liste des races.
- **MÉTIER** : Cet emplacement est là pour noter le métier de votre personnage, les [métiers](https://docs.google.com/document/u/0/d/1EK51ZTpXfzZNhRm-uINaRqkMz_RjBW0r-wir4pAg6uc/edit) donnent des bonus divers et variés.
- **ENTRAÎNEMENT** : Cet emplacement est là pour noter tous les bonus relatifs à l''avancée des différents entraînements qu''aurait faits votre personnage. Vous ne pouvez monter que 15 compétences maximum grâce à cette case et à hauteur maximum 10% de bonus.

Lors d''un entraînement, un jet de D100 est lancé et selon le score vous montez plus ou moins votre compétence

| Valeur du dé | Bonus obtenu |
| :-: | :-: |
| 1-20 | 5% d''acquis |
| 21-40 | 4% d''acquis |
| 41-60 | 3% d''acquis |
| 61-80 | 2% d''acquis |
| 81-95 | 1% d''acquis |
| 96-100 | Entraînement raté ! |

Les entraînements peuvent être donnés par des PNJ importants (aux mj de le décider) mais globalement par des entraîneurs dans les villes et villages contre une coquette somme d''or (déterminée par les mj)

- **CLASSES** : Ces 14 emplacements sont ici pour accueillir les dons offerts par les classes, voir [ici](https://maverick-jdr.fandom.com/fr/wiki/Classe) pour les classes.
- **ÉVÉNEMENTS** : Ce sont des dons qui peuvent arriver sans prévenir, ils peuvent être négatifs ou positifs.

Les Dons possèdent 4 types :

- Passif : Don qui est toujours effectif.
- Actif : Le joueur doit déclarer le don pour que son effet fonctionne. (Activation immédiate), il n’y pas de limite sur le nombre d''actifs qui peuvent être activés.
- Action : Le joueur déclare ce don comme étant l’action de son tour.
- Réaction : Le joueur joue ces dons en dehors de son tour.', 'neutre', NULL, 'page', '{"id":"guide/fiche-capacites-dons"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 693, 'guide', 'Pages de référence', 'Fiche de personnage : Caractéristiques', 'Texte', 'modifie', 'Il s''agit de l''endroit où on note les caractéristiques.

Les Caractéristiques sont le cœur des jets de dés dans Maverick, les valeurs pour n''importe quelle action dans ce jeu de rôle dépendent des caractéristiques des personnages ainsi que de la situation dans lequel on est confronté !

Les caractéristiques sur un personnage doivent faire un total de 14 points pour équilibrer les caractéristiques dans la mesure où il y aura toujours des bonus et des malus.

Les caractéristiques possèdent un minimum de 1 et un maximum de 4 de manière générale.

Les caractéristiques sont divisées en 6 catégories qui chacune est liée à 5 compétences.

Il est possible d’obtenir un point de caractéristique supplémentaire aux niveaux 5, 10 et 15 global.

La magie est tellement omniprésente dans Maverick qu’elle influence grande le physique des personnages, la magie innée offre un point de caractéristique en plus **(qui n’est pas compté dans les 14 points à répartir)** qui est déterminé selon la magie innée :

- FORCE : Sang, Terre
- PERCEPTION : Lumière, Ombre
- VOLONTÉ : Nécromancie, Vide
- SOCIAL : Feu, Eau
- INTELLIGENCE : Arcanique, Glace, Temps/Espace, Corruption
- AGILITÉ : Vent, Foudre

Le Potentiel Illimité détermine aléatoirement le bonus.

Le point donné par la magie permet d’atteindre 5 dans la caractéristique associée et un minimum de 2 dans la caractéristique associée. Il se note derrière en cochant la petite case bleue claire.

***!!! Seule la magie INNÉE va donner un bonus de 1 à une caractéristique !!!***', 'Il s''agit de l''endroit où on note les caractéristiques.

Les Caractéristiques sont le cœur des jets de dés dans Maverick, les valeurs pour n''importe quelle action dans ce jeu de rôle dépendent des caractéristiques des personnages ainsi que de la situation dans laquelle on est confronté !

Les caractéristiques sur un personnage doivent faire un total de 14 points pour équilibrer les caractéristiques dans la mesure où il y aura toujours des bonus et des malus.

Les caractéristiques possèdent un minimum de 1 et un maximum de 4 de manière générale.

Les caractéristiques sont divisées en 6 catégories qui chacune est liée à 5 compétences.

Il est possible d’obtenir un point de caractéristique supplémentaire aux niveaux 5, 10 et 15 global.

La magie est tellement omniprésente dans Maverick qu’elle influence grande le physique des personnages, la magie innée offre un point de caractéristique en plus **(qui n’est pas compté dans les 14 points à répartir)** qui est déterminé selon la magie innée :

- FORCE : Sang, Terre
- PERCEPTION : Lumière, Ombre
- VOLONTÉ : Nécromancie, Vide
- SOCIAL : Feu, Eau
- INTELLIGENCE : Arcanique, Glace, Temps/Espace, Corruption
- AGILITÉ : Vent, Foudre

Le Potentiel Illimité détermine aléatoirement le bonus.

Le point donné par la magie permet d’atteindre 5 dans la caractéristique associée et un minimum de 2 dans la caractéristique associée. Il se note derrière en cochant la petite case bleu clair.

***!!! Seule la magie INNÉE va donner un bonus de 1 à une caractéristique !!!***

Il existe des situations ou bien des altérations d''état qui sont capables de mettre des malus sur les caractéristiques, comme les maladies ou bien une mauvaise nuit, il se manifeste sur la fiche sous l''apparence de croix sous la caractéristique :

- 1 croix, malus de 20% pour tout test en rapport avec cette caractéristique.
- 2 croix, impossibilité d''utiliser les compétences liées à cette caractéristique.', 'neutre', NULL, 'page', '{"id":"guide/fiche-caracteristiques"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 694, 'guide', 'Pages de référence', 'Fiche de personnage : Classe', 'Texte', 'modifie', 'C''est là où sont notées les différents classes de votre personnages, plus d''infos sur les classes en elle même [ici](https://docs.google.com/spreadsheets/u/0/d/1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs/edit).

La Classe d''un personnage représente sa façon de se battre sur le champ de bataille, chaque classe possède son lot d''avantages qui lui permet d''être utile dans des situations bien précises ou bien de manière générale.

Les classes dites magique donnent 4AM chacune (donc si vous avez 2 classes magiques sur le personnages, vous en avez 8 juste avec ces classes)

Une classe possède un niveau qui lui est propre, qui augmente selon le niveau du personnage.

La Spécialité est un embranchement qui va être pris quand une classe atteint le niveau 10, plus de détails dans le documents des classes.

Quand on crée son personnage on peut :

- Soit commencer avec 1 seule classe, dans ce cas la classe montera de 2 niveaux à chaque fois que le joueur gagne un niveau de personnage. La seule classe commence au niveau 2.
- Soit commencer avec 2 classes, dans ce cas les classes évoluent en même temps de 1 niveau chacun à chaque montée de niveau du personnage. Les deux classes commencent au niveau 1.', 'C''est là où sont notées les différentes classes de votre personnage, plus d''infos sur les classes en elles-mêmes [ici](https://docs.google.com/spreadsheets/u/0/d/1Pyg4GSUlFrvNaTg3bi6uXlehg1MuRHmkyfPO6s5K72I/edit).

La Classe d''un personnage représente sa façon de se battre sur le champ de bataille, chaque classe possède son lot d''avantages qui lui permet d''être utile dans des situations bien précises ou bien de manière générale.

Les classes dites magiques donnent 4AM chacune (donc si vous avez 2 classes magiques sur le personnage, vous en avez 8 juste avec ces classes)

Une classe possède un niveau qui lui est propre, qui augmente selon le niveau du personnage.

La Spécialité est un embranchement qui va être pris quand une classe atteint le niveau 10, plus de détails dans le documents des classes.

Quand on crée son personnage on peut :

- Soit commencer avec 1 seule classe, dans ce cas la classe montera de 2 niveaux à chaque fois que le joueur gagne un niveau de personnage. La seule classe commence au niveau 2.
- Soit commencer avec 2 classes, dans ce cas les classes évoluent en même temps de 1 niveau chacune à chaque montée de niveau du personnage. Les deux classes commencent au niveau 1.', 'neutre', NULL, 'page', '{"id":"guide/fiche-classe"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 695, 'guide', 'Pages de référence', 'Fiche de personnage : Compétences', 'Texte', 'modifie', 'Il s''agit du tableau des compétences de votre personnage.

Les compétences sont des bonus aux caractéristiques qui viennent s''ajouter au score de [[Jet de dés|jet de dés]] quand la situation lui permet d''agir. Ces compétences ont un rapport direct avec le personnage et comment il agit selon les situations.

À la création d''un personnage, il y a 100 points à répartir dans les compétences et 20 points à chaque niveau supplémentaire, sauf les niveaux 5, 10, 15 et 20 où ce sera 40 points à répartir. 20 points peuvent être attribués à la compétence au choix parmi les 30 disponibles (au maximum) et vont dans la case Nat ou Naturel. Ce maximum augmente à 30 au niveau 5 global et maximum 40 au niveau 10 global.

Les bonus de race/classe/don/équipement vont dans la case Acquis (dans la limite de 5 par point de caractéristique de base = exemple si 5 de force, l’acquis maximum sera de 25)

Voici les compétences qui existent avec leurs caractéristiques associées :

*Arbalète (Perception) :* Une compétence liée aux armes qui tirent des carreaux.

*Arc (Force) :* Une compétence liée aux armes qui tirent des flèches.

*Arme Légère (Agilité) :* Une compétence liée à l’utilisation d’arme de catégorie légère.

*Arme Lourde (Force) :* Une compétence liée à l’utilisation d’arme de catégorie lourde.

*Athlétisme (Force) :* Utilisée lors de test où la force pure est mise à l''épreuve. (équivalent d’équilibre pour l’agilité)

*Concentration (Volonté) :* Permet de rester concentrer sur son sort (utilisé par les mage rouge, bleu et vert pour lancer leurs sorts).

*Connaissance (Intelligence) :* Une grande connaissance sur de vastes sujets.

*Distinction (Perception) :* L''art de voir les choses en profondeur, de sentir, d''écouter, de ressentir.

*Diplomatie (Social) :* Persuader sans violence, ni contrainte.

*Dressage (Social) :* Liée au dressage d''animaux ou monstres destinés à être des familiers.

*Équilibre (Agilité) :* L''art de garder l’équilibre dans différentes situations. (équivalent de athlétisme pour la force)

*Esquive (Agilité) :* Une compétence utile pour mieux éviter les coups qui peuvent être décisifs.

*Fermeté (Volonté) :* Mieux résister aux attaques mentales, aux attaques sur le psychique.

*Intimidation (Social) :* Persuader avec violence, sous la contrainte.

*Magie (Intelligence) :* La compétence liée aux sortilèges et la capacité à les lancer correctement.

*Manipulation (Social)* : L''art du mensonge, du sophisme, du détournement de regard et du déplacement de but.

*Médecine (Intelligence) :* Liée à tous les soins physiques que la magie ne peut soigner.

*Négociation (Social) :* Liée à l''art de négocier quelque chose.

*Observation (Perception) :* Utiliser sa vue pour bien connaître son environnement en général.

*Orientation (Perception) :* Pour bien lire une carte et ne pas se perdre.

*Parade (Force) :* Une compétence utilisée pour bloquer les coups avec une arme ou un bouclier.

*Prouesse (Volonté) :* Faire preuve de sang-froid dans les situations dangereuses.

*Psychologie (Intelligence) :* Permet de comprendre la psychologie de sa cible, déceler le mensonge dans le comportement et les paroles.

*Réflexe (Agilité) :* Laisser son corps agir de lui-même. (équivalent de stabilité pour la force)

*Ruse (Agilité) :* "Parfois, ne pas se battre est la meilleure des victoires"

*Sabotage (Perception) :* Créer des pièges, les désarmer ou même les retourner contre les ennemis.

*Stabilité (Force) :* Être capable de tenir sa position quand le sol tremble, porter une charge longtemps, ect. (équivalent de réflexe pour l’agilité)

*Survie (Volonté) :* "Le corps s’accroche à la vie, telle une sangsue sur une veine" cette compétence est utilisée dans le cas d''un coma.

*Vie en nature (Intelligence) :* Comprendre la nature, ses bienfaits.

*Vigueur (Volonté) :* Mieux résister aux [[Altérations d''états et Mode Hyper|altérations d''états]] physiques comme le poison, les maladies ou les brûlures', 'Il s''agit du tableau des compétences de votre personnage.

Les compétences sont des bonus aux caractéristiques qui viennent s''ajouter au score de [[Jet de dés|jet de dés]] quand la situation lui permet d''agir. Ces compétences ont un rapport direct avec le personnage et comment il agit selon les situations.

À la création d''un personnage, il y a 100 points à répartir dans les compétences et 20 points à chaque niveau supplémentaire, sauf les niveaux 5, 10, 15 et 20 où ce sera 40 points à répartir. 20 points peuvent être attribués à la compétence au choix parmi les 30 disponibles (au maximum) et vont dans la case Nat ou Naturel. Ce maximum augmente à 30 au niveau 5 global et maximum 40 au niveau 10 global.

Les bonus de race/classe/don/équipement vont dans la case Acquis (dans la limite de 5 par point de caractéristique de base = exemple si 5 de force, l’acquis maximum sera de 25)

Voici les compétences qui existent avec leurs caractéristiques associées :

*Arbalète (Perception) :* Une compétence liée aux armes qui tirent des carreaux.

*Arc (Force) :* Une compétence liée aux armes qui tirent des flèches.

*Arme Légère (Agilité) :* Une compétence liée à l’utilisation d’arme de catégorie légère.

*Arme Lourde (Force) :* Une compétence liée à l’utilisation d’arme de catégorie lourde.

*Athlétisme (Force) :* Utilisée lors de tests où la force pure est mise à l''épreuve. (équivalent d’équilibre pour l’agilité)

*Concentration (Volonté) :* Permet de rester concentré sur son sort (utilisé par les mages rouge, bleu et vert pour lancer leurs sorts).

*Connaissance (Intelligence) :* Une grande connaissance sur de vastes sujets.

*Distinction (Perception) :* L''art de voir les choses en profondeur, de sentir, d''écouter, de ressentir.

*Diplomatie (Social) :* Persuader sans violence, ni contrainte.

*Dressage (Social) :* Liée au dressage d''animaux ou monstres destinés à être des familiers.

*Équilibre (Agilité) :* L''art de garder l’équilibre dans différentes situations. (équivalent d’athlétisme pour la force)

*Esquive (Agilité) :* Une compétence utile pour mieux éviter les coups qui peuvent être décisifs.

*Fermeté (Volonté) :* Mieux résister aux attaques mentales, aux attaques sur le psychique.

*Intimidation (Social) :* Persuader avec violence, sous la contrainte.

*Magie (Intelligence) :* La compétence liée aux sortilèges et la capacité à les lancer correctement.

*Manipulation (Social)* : L''art du mensonge, du sophisme, du détournement de regard et du déplacement de but.

*Médecine (Intelligence) :* Liée à tous les soins physiques que la magie ne peut soigner.

*Négociation (Social) :* Liée à l''art de négocier quelque chose.

*Observation (Perception) :* Utiliser sa vue pour bien connaître son environnement en général.

*Orientation (Perception) :* Pour bien lire une carte et ne pas se perdre.

*Parade (Force) :* Une compétence utilisée pour bloquer les coups avec une arme ou un bouclier.

*Prouesse (Volonté) :* Faire preuve de sang-froid dans les situations dangereuses.

*Psychologie (Intelligence) :* Permet de comprendre la psychologie de sa cible, déceler le mensonge dans le comportement et les paroles.

*Réflexe (Agilité) :* Laisser son corps agir de lui-même. (équivalent de stabilité pour la force)

*Ruse (Agilité) :* "Parfois, ne pas se battre est la meilleure des victoires"

*Sabotage (Perception) :* Créer des pièges, les désarmer ou même les retourner contre les ennemis.

*Stabilité (Force) :* Être capable de tenir sa position quand le sol tremble, porter une charge longtemps, etc. (équivalent de réflexe pour l’agilité)

*Survie (Volonté) :* "Le corps s’accroche à la vie, telle une sangsue sur une veine" cette compétence est utilisée dans le cas d''un coma.

*Vie en nature (Intelligence) :* Comprendre la nature, ses bienfaits.

*Vigueur (Volonté) :* Mieux résister aux [[Altérations d''états et Mode Hyper|altérations d''états]] physiques comme le poison, les maladies ou les brûlures', 'neutre', NULL, 'page', '{"id":"guide/fiche-competences"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 696, 'guide', 'Pages de référence', 'Fiche de personnage : Expérience/Niveau global', 'Texte', 'modifie', 'Il s''agit de là où on note le total d''expérience accumulé par le personnage ainsi que son niveau global, nous allons voir ici en détail l’expérience nécessaire pour chaque niveaux et ce que ces derniers apportent :

| **Niveau** | **Xp nécessaire** | **Dons** |
| :-: | :-: | :-: |
| Niveau 1 | **0** | - 100 points de compétences<br>- Puissance magique niveau 1<br>- +2 Niveaux de classe |
| Niveau 2 | **200** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Mode Hyper débloqué ! |
| Niveau 3 | **550** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 4 | **950** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 2 |
| Niveau 5 | **1650** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +10 maximum naturel<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |
| Niveau 6 | **2450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 7 | **3850** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 8 | **5450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 3 |
| Niveau 9 | **8250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 10 | **11450** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- +10 maximum naturel<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux)<br>- Mode Hyper 100% débloqué !<br>- Méditation redonne 6d6 + 12 chakra/Repos redonne 6d4 + 12 santé et chakra |
| Niveau 11 | **17050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 12 | **23450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 4 |
| Niveau 13 | **34650** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 14 | **47450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 15 | **69850** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |
| Niveau 16 | **95450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 5 (non disponible pour les personnages avec une magie acquise) |
| Niveau 17 | **140250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 18 | **191450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 19 | **281050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 20 | **460250** | - 15 points d''attributs à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |

*Rappel : Le Niveau global détermine le(s) niveau(x) de classe(s) (plus de détails dans* [*classe*](https://maverick-jdr.fandom.com/fr/wiki/Classe)*) ainsi que le Niveau de Magie (plus de détails dans* [*Magie*](https://maverick-jdr.fandom.com/fr/wiki/Magie)*)*', 'Il s''agit de là où on note le total d''expérience accumulé par le personnage ainsi que son niveau global, nous allons voir ici en détail l’expérience nécessaire pour chaque niveau et ce que ces derniers apportent :

| **Niveau** | **Xp nécessaire** | **Dons** |
| :-: | :-: | :-: |
| Niveau 1 | **0** | - 100 points de compétences<br>- Puissance magique niveau 1<br>- +2 Niveaux de classe |
| Niveau 2 | **200** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Mode Hyper débloqué ! |
| Niveau 3 | **550** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 4 | **950** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 2 |
| Niveau 5 | **1650** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +10 maximum naturel<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |
| Niveau 6 | **2450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 7 | **3850** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 8 | **5450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 3 |
| Niveau 9 | **8250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 10 | **11450** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- +10 maximum naturel<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux)<br>- Mode Hyper 100% débloqué !<br>- Méditation redonne 6d6 + 12 chakra/Repos redonne 6d4 + 12 santé et chakra |
| Niveau 11 | **17050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 12 | **23450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 4 |
| Niveau 13 | **34650** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 14 | **47450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 15 | **69850** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |
| Niveau 16 | **95450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 5 (non disponible pour les personnages avec une magie acquise) |
| Niveau 17 | **140250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 18 | **191450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 19 | **281050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 20 | **460250** | - 15 points d''attributs à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 chakra OU 1d4 pour les deux) |

*Rappel : Le Niveau global détermine le(s) niveau(x) de classe(s) (plus de détails dans* [*classe*](https://maverick-jdr.fandom.com/fr/wiki/Classe)*) ainsi que le Niveau de Magie (plus de détails dans* [*Magie*](https://maverick-jdr.fandom.com/fr/wiki/Magie)*)*', 'neutre', NULL, 'page', '{"id":"guide/fiche-experience-niveau-global"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 697, 'guide', 'Pages de référence', 'Fiche de personnage : Inventaire/Sac à dos', 'Texte', 'modifie', 'L''inventaire est un peu votre sac à dos, le nombre d''emplacement est déterminé par la Force de votre personnage.

Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sac à dos.

- Grand sac à dos, permet d’avoir 4 emplacement supplémentaire |Demande 2 de Force.
- Super sac à dos, permet d’avoir 8 emplacement supplémentaire |Demande 3 de Force.
- Méga sac à dos, permet d’avoir 12 emplacement supplémentaire |Demande 4 de Force.
- Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.

L''inventaire de départ est déterminé par la Classe, allez voir directement les classes pour connaître votre inventaire de départ. Si jamais vous commencez avec 2 classes, prenez 5 objets parmi les 10 disponibles.', 'L''inventaire est un peu votre sac à dos, le nombre d''emplacements est déterminé par la Force de votre personnage.

Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sacs à dos.

- Grand sac à dos, permet d’avoir 4 emplacements supplémentaires |Demande 2 de Force.
- Super sac à dos, permet d’avoir 8 emplacements supplémentaires |Demande 3 de Force.
- Méga sac à dos, permet d’avoir 12 emplacements supplémentaires |Demande 4 de Force.
- Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.

L''inventaire de départ est déterminé par la Classe, allez voir directement les classes pour connaître votre inventaire de départ. Si jamais vous commencez avec 2 classes, prenez 5 objets parmi les 10 disponibles.', 'neutre', NULL, 'page', '{"id":"guide/fiche-inventaire-sac-a-dos"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 698, 'guide', 'Pages de référence', 'Fiche de personnage : Maîtrise d’arme et Armes', 'Texte', 'modifie', '## Maîtrise d’arme

Ce tableau correspond à ce que votre personnage maîtrise comme armes, plus il maîtrise une arme, plus il va infliger de dégâts.

Les maîtrises d’armes augmentent

Concrètement : Aucune maîtrise d''arme = 1d de dégâts, 1 point de maîtrise = 2d de dégâts, etc.... Chaque catégorie d''arme possède son dé de dégâts, toutes les dagues ferons le D6 et ainsi de suite. Plus de détails sur les armes [ici](https://docs.google.com/spreadsheets/u/0/d/12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA/edit).

## Armes

C''est ici qu''on trouve là on peut noter les différentes armes équipées, 2 maximum le reste va directement dans l''inventaire. Il est divisé en 5 informations :

- **Nom** : Pour le nom de l’arme.
- **Dégâts** : C’est l’endroit où on indique les dégâts qu’inflige les dégâts de l’arme, le nombre de dé + ainsi que tous les modificateurs de dégâts.
- **Po (Portée)** : C’est là où on note [[La Vitesse et la Portée|la portée]] atteignable par l’arme, la plupart des armes ont une portée de 1.
- **Effet(s) en plus** : C’est ici qu’on indique quand l’arme possède une particularité. Comme par exemple des dégâts supplémentaires selon la créature.
- **Solidité** : C’est le nombre de mauvais coups que peut encaisser l’arme avant de se briser.', '## Maîtrise d’arme

Ce tableau correspond à ce que votre personnage maîtrise comme armes, plus il maîtrise une arme, plus il va infliger de dégâts.

Les maîtrises d’armes augmentent

Concrètement : Aucune maîtrise d''arme = 1d de dégâts, 1 point de maîtrise = 2d de dégâts, etc.... Chaque catégorie d''arme possède son dé de dégâts, toutes les dagues feront le D6 et ainsi de suite. Plus de détails sur les armes [ici](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit).

## Armes

C''est ici qu''on trouve là on peut noter les différentes armes équipées, 2 maximum le reste va directement dans l''inventaire. Il est divisé en 5 informations :

- **Nom** : Pour le nom de l’arme.
- **Dégâts** : C’est l’endroit où on indique les dégâts qu’inflige les dégâts de l’arme, le nombre de dés + ainsi que tous les modificateurs de dégâts.
- **Po (Portée)** : C’est là où on note [[La Vitesse et la Portée|la portée]] atteignable par l’arme, la plupart des armes ont une portée de 1.
- **Effet(s) en plus** : C’est ici qu’on indique quand l’arme possède une particularité. Comme par exemple des dégâts supplémentaires selon la créature.
- **Solidité** : C’est le nombre de mauvais coups que peut encaisser l’arme avant de se briser.', 'neutre', NULL, 'page', '{"id":"guide/fiche-maitrise-darme-et-armes"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 699, 'guide', 'Pages de référence', 'Fiche de personnage : Personnage', 'Texte', 'modifie', 'Dans ce document, nous allons voir étape par étape comment créer sa fiche de personnage.

## Personnage

Le sommet de la fiche contient le carré "Personnage" il s''agit, ni plus ni moins, des information général de votre personnage, il se décompose comme ceci :

- **Nom** : Le nom complet de votre personnage.
- **Race** : La race de votre personnage parmi les 23 disponibles. Il faut également préciser l''ethnie de votre [race](https://docs.google.com/spreadsheets/u/0/d/1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4/edit) (si il y en a)
- **Origine** : Le lieu de naissance du personnage.
- **[[Alignement]]** : C''est ici qu''on note L''alignement ainsi que le score d''alignement (gauche = score Loyal/Chaos, droite = score Bon/Mauvais). Vous pouvez retrouver plus d''informations [ici](https://docs.google.com/document/u/0/d/1Xph3vnjwmZpBG3UHDyBBqZQdVUnMLVxEllK3vXUw598/edit).
- **Surnom** : Le surnom de votre personnage, souvent utilisé pour les noms de scène.
- **Magie innée** : C’est ici qu’on indique la magie innée du personnage, tout le monde en possède une. Certaines races possèdent des interdits au niveau des magies, donc prudence.
- **Magie acquise** : C’est ici qu’on note la seconde magie que possède le personnage, avoir une magie acquise n’est pas obligatoire contrairement à la magie innée. Attention, certaines magies ne peuvent pas se mélanger entre elles, aller [ici](https://docs.google.com/spreadsheets/u/0/d/1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c/edit) pour plus d’info.
- **Dieu inné** : Il s’agit de la divinité qui est reliée à la magie innée. Retrouvez les différents dieux [ici](https://maverick-jdr.fandom.com/fr/wiki/Divinit%C3%A9s).
- **Dieu choisi** : Il s’agit du dieu que le personnage a décidé de prier qui n’est pas l’inné. Cet emplacement peut très bien être vide.
- **Bourse** : Il existe 3 types de monnaies, quand un personnage est créé, lancer 1D20 et le score va correspondre à votre or de départ.', 'Dans ce document, nous allons voir étape par étape comment créer sa fiche de personnage.

## Personnage

Le sommet de la fiche contient le carré "Personnage" il s''agit, ni plus ni moins, des informations générales de votre personnage, il se décompose comme ceci :

- **Nom** : Le nom complet de votre personnage.
- **Race** : La race de votre personnage parmi les 23 disponibles. Il faut également préciser l''ethnie de votre [race](https://docs.google.com/spreadsheets/u/0/d/150Q6SJi4ft0oROtwT6snMAZUdWMVtkblxwYY9TqxV4Q/edit) (s''il y en a)
- **Origine** : Le lieu de naissance du personnage.
- **[[Alignement]]** : C''est ici qu''on note l''alignement ainsi que le score d''alignement (gauche = score Loyal/Chaos, droite = score Bon/Mauvais). Vous pouvez retrouver plus d''informations [ici](https://docs.google.com/document/u/0/d/17VxGUwjzEZWElwIYVaXvaaumqFM4yKnO1C7uhVyc9iM/edit).
- **Surnom** : Le surnom de votre personnage, souvent utilisé pour les noms de scène.
- **Magie innée** : C’est ici qu’on indique la magie innée du personnage, tout le monde en possède une. Certaines races possèdent des interdits au niveau des magies, donc prudence.
- **Magie acquise** : C’est ici qu’on note la seconde magie que possède le personnage, avoir une magie acquise n’est pas obligatoire contrairement à la magie innée. Attention, certaines magies ne peuvent pas se mélanger entre elles, aller [ici](https://docs.google.com/spreadsheets/u/0/d/1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0/edit) pour plus d’info.
- **Dieu inné** : Il s’agit de la divinité qui est reliée à la magie innée. Retrouvez les différents dieux [ici](https://maverick-jdr.fandom.com/fr/wiki/Divinit%C3%A9s).
- **Dieu choisi** : Il s’agit du dieu que le personnage a décidé de prier qui n’est pas l’inné. Cet emplacement peut très bien être vide.
- **Bourse** : Il existe 3 types de monnaies, quand un personnage est créé, lancer 1D20 et le score va correspondre à votre or de départ.', 'neutre', NULL, 'page', '{"id":"guide/fiche-personnage"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 700, 'guide', 'Pages de référence', 'Fiche de personnage : Tableau magie', 'Texte', 'modifie', 'Et voici là où vous inscrivez votre (vos) magie(s), cet espace semble vide d’indication mais laissez moi vous expliquer comment ça marche - Pour avoir des sorts il faut remplir certaines conditions qui sont au nombre de 4 :

- Avoir une magie innée. (condition par défaut remplie car vous en avez forcément une)
- Avoir une magie acquise.
- Avoir une classe magique.
- Avoir une seconde classe magique.

Quand vous remplissez une des conditions, vous avez 1 emplacement de sorts ! Mais il y a pas que ça, il y a aussi votre niveau de puissance magique qui est important, le niveau de puissance magique va multiplier le nombre d’emplacement de sorts que vous donne les conditions.

*Exemples :*

- *\*Vous avez une magie innée et une magie acquise mais pas de classe magique, vous êtes niveau 1 de puissance magique : Conclusion vous avez 2 emplacements de sorts.\**
- *\*Vous avez une magie innée et deux classes magiques, vous êtes niveau 3 de puissance magique : Conclusion vous avez 9 emplacements de sorts.\**

Plutôt simple, vous multipliez le nombre de conditions remplies par votre niveau de puissance magique de votre personnage et vous avez le nombre d’emplacement de sorts que votre personnage possède.

\*Quand vous avez 2 magies, vous n''avez pas accès aux sortilèges de niveaux 5, MAIS vous débloquerez tout de même les emplacements.

- Le reste correspond aux statistiques des sortilèges, voir [ici](https://docs.google.com/spreadsheets/u/0/d/1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c/edit) pour plus de détails.', 'Et voici là où vous inscrivez votre (vos) magie(s), cet espace semble vide d’indication mais laissez-moi vous expliquer comment ça marche - Pour avoir des sorts il faut remplir certaines conditions qui sont au nombre de 4 :

- Avoir une magie innée. (condition par défaut remplie car vous en avez forcément une)
- Avoir une magie acquise.
- Avoir une classe magique.
- Avoir une seconde classe magique.

Quand vous remplissez une des conditions, vous avez 1 emplacement de sorts ! Mais il y a pas que ça, il y a aussi votre niveau de puissance magique qui est important, le niveau de puissance magique va multiplier le nombre d’emplacements de sorts que vous donnent les conditions.

*Exemples :*

- *\*Vous avez une magie innée et une magie acquise mais pas de classe magique, vous êtes niveau 1 de puissance magique : Conclusion vous avez 2 emplacements de sorts.\**
- *\*Vous avez une magie innée et deux classes magiques, vous êtes niveau 3 de puissance magique : Conclusion vous avez 9 emplacements de sorts.\**

Plutôt simple, vous multipliez le nombre de conditions remplies par votre niveau de puissance magique de votre personnage et vous avez le nombre d’emplacements de sorts que votre personnage possède.

\*Quand vous avez 2 magies, vous n''avez pas accès aux sortilèges de niveau 5, MAIS vous débloquerez tout de même les emplacements.

- Le reste correspond aux statistiques des sortilèges, voir [ici](https://docs.google.com/spreadsheets/u/0/d/1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0/edit) pour plus de détails.', 'neutre', NULL, 'page', '{"id":"guide/fiche-tableau-magie"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 701, 'guide', 'Pages de référence', 'Fiche de personnage : Tableau Posture', 'Texte', 'modifie', 'Voici les postures de combats ! Ce sont des états où se trouve votre personnage ce qui implique des bonus et malus pendant le combat.

## Offensif

C''est la posture d''attaque par excellence, si on veut taper et faire beaucoup de dégâts c''est la posture idéale. Ses effets sont :

- **Dégâts maximum :** Armes ou Magie, les dégâts seront au minimum avec les bonus. [Exemple : 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts, les jets de dés ne sont pas a faire vu que c''est le maximum que l''on prend]
- **+5% à la réussite critique :** La réussite critique (ou coup critique) est de bas à 5 ou moins, grâce à la posture offensif, cette réussite critique monte à 10 ou moins.
- **Malus de 10% pour toucher une cible :** La posture diminue la chance que vous avez de toucher votre cible.
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Défensif

En opposition avec la posture offensive, la posture défensive est faite pour quelqu''un qui souhaite couvrir ses alliés ou bien se protéger de multiple assaut. Ses effets sont :

- **+2AP/AM :** L’armure physique et magique augmente quand cette posture est prise. Cela augmente de +2 tous les 4 niveaux global du personnage.
- **Parade/Esquive illimité :** Permet d''esquiver ou de parer tous les coups dans un tour MAIS chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.
- **Provocation :** Permet en échange d''un bon dialogue et d''un jet de diplomatie, intimidation ou manipulation réussi, d''obliger un adversaire à venir vous attaquer que vous pendant 1 tour.
- **Intervention :** Permet de parer/esquiver le coup à la place d''un allié adjacent.
- **+5% à la réussite critique avec une défense :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture défensive, cette réussite critique monte à 10 ou moins quand on esquive ou pare une attaque.
- **Divise les dégâts par 2 infligés :** Armes ou Magie, les dégâts infligés seront divisés par 2, cette division intervient AVANT le calcule de l’armure.

## Neutre

L''entre deux de la posture offensif et défensif, la posture neutre permet d''infliger les dégâts normaux en plus de bénéficier de parade ou esquive. Ses effets sont :

- **+5% pour un jet V ou S :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Social ou Volonté.
- **2 esquive/parade par tour :** Permet d''esquiver ou de parer deux fois par tour.

## Focus

Cette posture permet de rester concentré et permet une meilleure efficacité avec la magie. Ses effets sont :

- **+10% à la réussite :** Peut importe le type de jet, il bénéficie d’un bonus de 10% à la réussite.
- **-1 tour de charge :** Permet de retirer le tour de charge des sorts de niveau 5 de puissance et de retirer le tour de charge lors de certaines actions. Casse le tour de charge de la capacité "Préparation" du Mage Rouge et Vert.
- **Augmente le cran de dé de dégâts/soin :** Permet d’augmenter d’un cran la nature des dés qui seront lancés pour le sortilège (le D6 devient D8, etc…en sachant qu’il n’y pas plus haut que le D20)
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Vigilance

Cette posture permet d''être bien plus attentif à ce qu''il se passe autour de soi mais aussi dans le combat. Ses effets sont :

- **+5% pour un jet de Perception :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Perception.
- **+2 Initiative :** Permet d''avoir un bonus d''initiative de +2 lors du début de chaque tour.
- **Peut anticiper les actions adverses :** Permet grâce un jet d''observation/distinction d''avoir une info intéressante sur la prochaine action de l''adversaire, voir le mj pour ça.
- **Repérer un adversaire invisible devient un IC :** Permet à l’action “estimer la position d’un ennemi invisible ou discret” de devenir un IC.
- **Peut repérer 1d4 résistance/vulnérabilité :** Permet d’utiliser un IC pour détecter une résistance ou vulnérabilité aléatoire de l’ennemi.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.

## Symbiose

Cette posture étrange permet d''être en parfaite fusion avec sa magie, dans cette posture vous êtes presque comme un élémentaire. Il faut savoir que cette posture permet d''être meilleur avec sa magie mais dans le cas où vous êtes bi-magie, vous devez choisir une magie avec qui faire équipe et délaisser l''autre le temps de la posture. Ses effets sont :

- **+5 dégâts/soin avec une magie :** Permet d''infliger un bonus de dégâts de +6 ou alors un bonus de +5 avec un sort de soin. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **+4 AM :** Permet d''avoir une plus grande armure magique dans cette posture. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **Immunité à la magie de la symbiose :** La magie avec laquelle vous avez fait la symbiose vous envahit et vous devenez totalement immunisé à celle ci.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.
- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (la forgemagie est un sort qui permet de créer des armes faites de magie, donc c''est bon)
- **Une seule magie active :** Quand vous avez 2 magies, 1 de ses magies doit être désactiver temporairement, ainsi tout ses avantages et inconvénients sont annulés également.

## Mode Hyper

Voici le tableau où on rassemble les informations sur le [[Altérations d''états et Mode Hyper|mode hyper]] du personnage, allez [ici](https://docs.google.com/spreadsheets/u/0/d/1lwALh1VKrIpgmEqX2MdYirKkPzGjSJXXDHtp2uYXO7w/edit) pour en savoir davantage.', 'Voici les postures de combats ! Ce sont des états où se trouve votre personnage ce qui implique des bonus et malus pendant le combat.

## Offensif

C''est la posture d''attaque par excellence, si on veut taper et faire beaucoup de dégâts c''est la posture idéale. Ses effets sont :

- **Dégâts maximum :** Armes ou Magie, les dégâts seront au minimum avec les bonus. [Exemple : 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts, les jets de dés ne sont pas à faire vu que c''est le maximum que l''on prend]
- **+5% à la réussite critique :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture offensif, cette réussite critique monte à 10 ou moins.
- **Malus de 10% pour toucher une cible :** La posture diminue la chance que vous avez de toucher votre cible.
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Défensif

En opposition avec la posture offensive, la posture défensive est faite pour quelqu''un qui souhaite couvrir ses alliés ou bien se protéger de multiples assauts. Ses effets sont :

- **+2AP/AM :** L’armure physique et magique augmente quand cette posture est prise. Cela augmente de +2 tous les 4 niveaux globaux du personnage.
- **Parade/Esquive illimitée :** Permet d''esquiver ou de parer tous les coups dans un tour MAIS chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.
- **Provocation :** Permet en échange d''un bon dialogue et d''un jet de diplomatie, intimidation ou manipulation réussi, d''obliger un adversaire à venir vous attaquer que vous pendant 1 tour.
- **Intervention :** Permet de parer/esquiver le coup à la place d''un allié adjacent.
- **+5% à la réussite critique avec une défense :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture défensive, cette réussite critique monte à 10 ou moins quand on esquive ou pare une attaque.
- **Divise les dégâts par 2 infligés :** Armes ou Magie, les dégâts infligés seront divisés par 2, cette division intervient AVANT le calcul de l’armure.

## Neutre

L''entre-deux de la posture offensive et défensive, la posture neutre permet d''infliger les dégâts normaux en plus de bénéficier de parade ou esquive. Ses effets sont :

- **+5% pour un jet V ou S :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Social ou Volonté.
- **2 esquives/parades par tour :** Permet d''esquiver ou de parer deux fois par tour.

## Focus

Cette posture permet de rester concentré et permet une meilleure efficacité avec la magie. Ses effets sont :

- **+10% à la réussite :** Peu importe le type de jet, il bénéficie d’un bonus de 10% à la réussite.
- **-1 tour de charge :** Permet de retirer le tour de charge des sorts de niveau 5 de puissance et de retirer le tour de charge lors de certaines actions. Casse le tour de charge de la capacité "Préparation" du Mage Rouge et Vert.
- **Augmente le cran de dé de dégâts/soin :** Permet d’augmenter d’un cran la nature des dés qui seront lancés pour le sortilège (le D6 devient D8, etc… en sachant qu’il n’y pas plus haut que le D20)
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Vigilance

Cette posture permet d''être bien plus attentif à ce qu''il se passe autour de soi mais aussi dans le combat. Ses effets sont :

- **+5% pour un jet de Perception :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Perception.
- **+2 Initiative :** Permet d''avoir un bonus d''initiative de +2 lors du début de chaque tour.
- **Peut anticiper les actions adverses :** Permet grâce un jet d''observation/distinction d''avoir une info intéressante sur la prochaine action de l''adversaire, voir le mj pour ça.
- **Repérer un adversaire invisible devient un IC :** Permet à l’action “estimer la position d’un ennemi invisible ou discret” de devenir un IC.
- **Peut repérer 1d4 résistance/vulnérabilité :** Permet d’utiliser un IC pour détecter une résistance ou vulnérabilité aléatoire de l’ennemi.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.

## Symbiose

Cette posture étrange permet d''être en parfaite fusion avec sa magie, dans cette posture vous êtes presque comme un élémentaire. Il faut savoir que cette posture permet d''être meilleur avec sa magie mais dans le cas où vous êtes bi-magie, vous devez choisir une magie avec qui faire équipe et délaisser l''autre le temps de la posture. Ses effets sont :

- **+5 dégâts/soin avec une magie :** Permet d''infliger un bonus de dégâts de +6 ou alors un bonus de +5 avec un sort de soin. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **+4 AM :** Permet d''avoir une plus grande armure magique dans cette posture. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **Immunité à la magie de la symbiose :** La magie avec laquelle vous avez fait la symbiose vous envahit et vous devenez totalement immunisé à celle-ci.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.
- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (la forgemagie est un sort qui permet de créer des armes faites de magie, donc c''est bon)
- **Une seule magie active :** Quand vous avez 2 magies, 1 de ces magies doit être désactivée temporairement, ainsi tous ses avantages et inconvénients sont annulés également.

## Mode Hyper

Voici le tableau où on rassemble les informations sur le [[Altérations d''états et Mode Hyper|mode hyper]] du personnage, allez [ici](https://docs.google.com/spreadsheets/u/0/d/1AjQyT-IZMULq6FlgnmVmn2QiQ9AWhhbOgjr-COgMyMo/edit) pour en savoir davantage.', 'neutre', NULL, 'page', '{"id":"guide/fiche-tableau-posture"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 702, 'guide', 'Pages de référence', 'Fiche de personnage : Tableau Résistances/Faiblesses', 'Titre', 'modifie', 'Fiche de personnage : Tableau Résistance/Faiblesses', 'Fiche de personnage : Tableau Résistances/Faiblesses', 'neutre', NULL, 'page', '{"id":"guide/fiche-tableau-resistances-faiblesses"}', 'titre');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 703, 'guide', 'Pages de référence', 'Fiche de personnage : Tableau Résistances/Faiblesses', 'Texte', 'modifie', 'Ceci est le tableau où on va inscrire les résistances et faiblesses de votre personnage, tout est lié avec vos magie et tout est indiqué [ici](https://docs.google.com/spreadsheets/u/0/d/1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c/edit).

Ce que vous devez savoir c’est que les résistance et faiblesse communiquent ensemble : Deux vulnérabilité à la même magie entraîne une grande vulnérabilité et deux résistances à la même magie entraîne une grande résistance, etc …

Certains objets ou équipement peuvent faire modifier ces valeurs, soyez toujours à jour car les résistances et faiblesses pourraient être l’élément qui fait que votre personnage va survivre … ou pas.', 'Ceci est le tableau où on va inscrire les résistances et faiblesses de votre personnage, tout est lié avec vos magies et tout est indiqué [ici](https://docs.google.com/spreadsheets/u/0/d/1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0/edit).

Ce que vous devez savoir c’est que les résistances et faiblesses communiquent ensemble : Deux vulnérabilités à la même magie entraînent une grande vulnérabilité et deux résistances à la même magie entraînent une grande résistance, etc …

Certains objets ou équipements peuvent faire modifier ces valeurs, soyez toujours à jour car les résistances et faiblesses pourraient être l’élément qui fait que votre personnage va survivre … ou pas.', 'neutre', NULL, 'page', '{"id":"guide/fiche-tableau-resistances-faiblesses"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 704, 'guide', 'Pages de référence', 'Formule des dégâts', 'Texte', 'modifie', 'Il est important de bien prendre en compte cette formule lors du calcul des dégâts :

Dégâts finaux = **`[[[Dégâts du lanceur x Réussite critique (donc par 2) - Armure physique/Armure magique de la cible] ÷ Parade/Esquive partiel (donc par 2)]] ÷ Don qui divise les dégâts] x Résistance ou Faiblesse magique/physique`**

## Exemple 1

*Situation : Un adversaire me met un coup de masse d’arme et il va réussir. Il est en posture neutre. Je suis en posture neutre également. J’ai raté mon jet de défense. Mon armure possède 5AP et possède une résistance aux dégâts de frappe.*

1. La posture de l’ennemi ou la mienne n’implique aucun changement.
2. L’arme de l’ennemi inflige 2d10+2, résultat = 20 dégâts
3. Il n''a pas fait de coup critique, donc pas de multiplication par 2
4. Je possède une armure physique de 5, elle résiste aux dégâts de frappe donc elle double son capital de AP. Donc 20 - 10 = 10
5. J''ai échoué ma défense partielle donc pas de division par 2
6. Je n’ai pas de don qui divise les dégâts par 2
7. Pas besoin d’arrondir.
8. J''ai pris 10 points de dégâts !

## Exemple 2

*Situation : Un adversaire me met un coup de lance et il va réussir en critique. Il est en posture offensif. Je suis en posture défense. J’ai réussi un jet de défense en critique mais partielle (j’ai fait un critique aussi mais pas aussi fort que l''attaquant). Mon armure possède 7AP et est neutre contre les dégâts d’estoc.*

1. La posture de l’ennemi fait que ses dégâts seront au maximum.
2. L’arme de l’ennemi inflige 2d10+3, l''offensif font que les dégâts sont à 23.
3. Il a fait un coup critique, donc multiplication, on a un total de 46 dégâts.
4. Je possède une armure physique 7 et ma posture augmente les AP de 2, je dispose de 9 AP au total. Donc 46 - 9 = 37 dégâts
5. J''ai réussi ma défense partielle donc division par 2, on a un total de 16.5 dégâts
6. On arrondi à l''inférieur donc 16 dégâts.
7. Je n’ai pas de don qui divise les dégâts par 2
8. J''ai pris 16 points de dégâts !

## Exemple 3

*Situation : Je lance un sort de l’élément feu sur un adversaire, je réussi mon sort. Je suis en posture focus et lui en posture neutre. Il échoue sa défense. Il dispose d’une légère AM de 2. Il est vulnérable à l’élément feu.*

1. Ma posture fait que les dés de dégâts vont augmenter d’un cran.
2. Mon sort inflige normalement 2d6+2, mais la posture fait que les dégâts seront de 2d8+2, les dégâts seront à 12.
3. Pas de coup critique, donc pas de multiplication par 2
4. Il possède une armure magique de 2. Donc 12 - 2 = 10
5. Il a raté sa défense partielle donc pas de division
6. Il dispose d’une faiblesse à l’élément du Feu, on multiplie les dégâts par 2. donc 10 x 2 = 20
7. Il n’a pas de don qui divise les dégâts par 2
8. Il a pris 20 points de dégâts !', 'Il est important de bien prendre en compte cette formule lors du calcul des dégâts :

Dégâts finaux = **`[[[Dégâts du lanceur x Réussite critique (donc par 2) - Armure physique/Armure magique de la cible] ÷ Parade/Esquive partiel (donc par 2)]] ÷ Don qui divise les dégâts] x Résistance ou Faiblesse magique/physique`**

## Exemple 1

*Situation : Un adversaire me met un coup de masse d’arme et il va réussir. Il est en posture neutre. Je suis en posture neutre également. J’ai raté mon jet de défense. Mon armure possède 5AP et possède une résistance aux dégâts de frappe.*

1. La posture de l’ennemi ou la mienne n’implique aucun changement.
2. L’arme de l’ennemi inflige 2d10+2, résultat = 20 dégâts
3. Il n''a pas fait de coup critique, donc pas de multiplication par 2
4. Je possède une armure physique de 5, elle résiste aux dégâts de frappe donc elle double son capital d''AP. Donc 20 - 10 = 10
5. J''ai échoué ma défense partielle donc pas de division par 2
6. Je n’ai pas de don qui divise les dégâts par 2
7. Pas besoin d’arrondir.
8. J''ai pris 10 points de dégâts !

## Exemple 2

*Situation : Un adversaire me met un coup de lance et il va réussir en critique. Il est en posture offensif. Je suis en posture défense. J’ai réussi un jet de défense en critique mais partielle (j’ai fait un critique aussi mais pas aussi fort que l''attaquant). Mon armure possède 7AP et est neutre contre les dégâts d’estoc.*

1. La posture de l’ennemi fait que ses dégâts seront au maximum.
2. L’arme de l’ennemi inflige 2d10+3, l''offensif fait que les dégâts sont à 23.
3. Il a fait un coup critique, donc multiplication, on a un total de 46 dégâts.
4. Je possède une armure physique 7 et ma posture augmente les AP de 2, je dispose de 9 AP au total. Donc 46 - 9 = 37 dégâts
5. J''ai réussi ma défense partielle donc division par 2, on a un total de 18.5 dégâts
6. On arrondit à l''inférieur donc 18 dégâts.
7. Je n’ai pas de don qui divise les dégâts par 2
8. J''ai pris 18 points de dégâts !

## Exemple 3

*Situation : Je lance un sort de l’élément feu sur un adversaire, je réussis mon sort. Je suis en posture focus et lui en posture neutre. Il échoue sa défense. Il dispose d’une légère AM de 2. Il est vulnérable à l’élément feu.*

1. Ma posture fait que les dés de dégâts vont augmenter d’un cran.
2. Mon sort inflige normalement 2d6+2, mais la posture fait que les dégâts seront de 2d8+2, les dégâts seront à 12.
3. Pas de coup critique, donc pas de multiplication par 2
4. Il possède une armure magique de 2. Donc 12 - 2 = 10
5. Il a raté sa défense partielle donc pas de division
6. Il dispose d’une faiblesse à l’élément du Feu, on multiplie les dégâts par 2. Donc 10 x 2 = 20
7. Il n’a pas de don qui divise les dégâts par 2
8. Il a pris 20 points de dégâts !', 'neutre', NULL, 'page', '{"id":"guide/formule-des-degats"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 705, 'guide', 'Pages de référence', 'Guide pour MJ - Maverick', 'Texte', 'modifie', '*Bienvenue MJ ! Ici tu peux retrouver toutes les informations utiles pour Maverick JDR*

La carte de combat (ou Battlemap) est une carte où se déroule les combats pour avoir une vue d''ensemble aérienne de la situation en bataille, cela permet de dessiner les potentiels obstacles, connaître la distance précise d''une cible (grâce à son système de quadrillage).

Le MJ peut déployer la carte mais il peut ne pas la déployer si jamais il juge que le combat va être trop rapide.

## Sommaire

- *[[Formule des dégâts]]*
- *Les Actions et mouvement*
- *[[Les Actions et mouvements|IC ou Action rapide]]*
- *[[Attaque et Défense|Attaque et défense]]*
- *[[La Vitesse et la Portée|La vitesse]]*
- *La portée*
- *[[Postures]]*
- *[[Résistance/Faiblesse Magie|Résistance/Faiblesses magique]]*
- *[[Altérations d''états et Mode Hyper|Altérations d’états]]*
- *Mode Hyper*
- *[[Les situations avancées]]*
- *En résumé*
- *[[Un maître du Jeu|Maître du jeu, Conseils]]*
- *[[Donjon Pas bon|Donjon pas bon]]*
- *[[Alignement]]*', '*Bienvenue MJ ! Ici tu peux retrouver toutes les informations utiles pour Maverick JDR*

La carte de combat (ou Battlemap) est une carte où se déroulent les combats pour avoir une vue d''ensemble aérienne de la situation en bataille, cela permet de dessiner les potentiels obstacles, connaître la distance précise d''une cible (grâce à son système de quadrillage).

Le MJ peut déployer la carte mais il peut ne pas la déployer si jamais il juge que le combat va être trop rapide.

## Sommaire

- *[[Formule des dégâts]]*
- *Les Actions et mouvements*
- *[[Les Actions et mouvements|IC ou Action rapide]]*
- *[[Attaque et Défense|Attaque et défense]]*
- *[[La Vitesse et la Portée|La vitesse]]*
- *La portée*
- *[[Postures]]*
- *[[Résistance/Faiblesse Magie|Résistances/Faiblesses magique]]*
- *[[Altérations d''états et Mode Hyper|Altérations d’états]]*
- *Mode Hyper*
- *[[Les situations avancées]]*
- *En résumé*
- *[[Un maître du Jeu|Maître du jeu, Conseils]]*
- *[[Donjon Pas bon|Donjon pas bon]]*
- *[[Alignement]]*', 'neutre', NULL, 'page', '{"id":"guide/guide-pour-mj-maverick"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 706, 'guide', 'Pages de référence', 'Jet de dés', 'Texte', 'modifie', 'Comme expliqué plus haut, le jeu de rôle et notamment celui ci c''est beaucoup de jet de dés, il existe plusieurs façons de procéder à ça :

- Le maître du jeu gère tous les jet de dé y compris ceux des joueurs.
- Chacun gère ses propres jets, en sachant que les jets des joueurs sont toujours ouverts.

Le maître du jeu doit faire énormément de jet durant la partie étant donné qu''il gère les événements, les pnj, les ennemis, etc... Ce dernier peut faire tous ses jets ouverts pour ajouter un peu de piquant et laisser les dés décider de ce qui va se passer, ou bien il peut faire ses dés cachés ce qui lui permet un contrôle totale de ce qui se passe de son côté. Car oui n''oubliez pas que le MJ est seul maître à bord, le hasard c''est également lui, il peut très bien lancer les dés mais ne faire ça que pour le bruit.

En effet, un mj qui lance des dés peut faire peur car les joueurs sont incapable de savoir pourquoi et le résultat des dés.

## Le cas des réussites et échecs critiques

Vous savez globalement qu’il existe 4 types de résultats dans ce jeu de rôle : Réussite, Échec, Réussite critique et Échec critique. Nous allons nous attarder sur les deux derniers.

### Réussite critique

La réussite critique, dans sa définition la plus pure, correspond au fait de réussir une action de manière exceptionnelle. En raison de sa rareté, elle doit être récompensée de façon appropriée, par exemple :

- **Attaque** : double les dégâts infligés et oblige la cible à répondre par une réussite critique en défense (si elle en est capable).
- **Amplification / Soin / Entrave / Protection** : double la durée ou l’effet.
- **Défense** : permet de contre-attaquer ou de désarmer automatiquement l’adversaire.
- **Hors combat** : les effets sont laissés à l’imagination du MJ. Les situations sont trop nombreuses.

Cependant, il convient de faire attention à un piège fréquent : accorder une récompense systématique sous prétexte qu’il s’agit d’une réussite critique.

Certaines actions demeurent impossibles, quels que soient les efforts fournis. Dans certains cas, le MJ peut autoriser une tentative normalement irréalisable si celle-ci reste théoriquement possible, mais uniquement atteignable par une réussite critique.

Il peut également arriver que les joueurs invoquent la réussite critique pour justifier une action impossible. Dans cette situation, plusieurs approches sont possibles :

- **Refus clair** : le MJ rappelle que la réussite critique ne permet pas de tout accomplir.
- **Ouverture exceptionnelle** : le MJ autorise l’action, en assumant les conséquences que cela peut entraîner sur l’équilibre du jeu.
- **Résolution narrative** : le MJ laisse le joueur tenter, mais en cas de réussite critique, décrit en jeu pourquoi l’action échoue malgré tout, entraînant la perte du précieux coup critique. (réservé à ceux qui sont sadique). Ou alors récompenser malgré tout dans le cas d’un coup critique mais le mj regarde les conséquences qu’une telle réussite peut engendrer, voir exemple.

*Exemple* :

- *Votre joueur a réussi à séduire une sénatrice elfe noire, bravo à lui ! Mais est ce qu’il a pensé au fait que les elfes noirs sont une société matriarcale où les mâles n’ont pas leur mot à dire sur quoi que ce soit ? Surtout que vu que c’est une sénatrice, elle a un pouvoir politique écrasant ?*
- *Votre joueur a réussi à dompter un monstre, bravo à lui ! Mais est ce qu’il sait que ce monstre est une créature qui attaque sans prévenir certaines races humanoïdes et que c’est impossible de le raisonner quand il est parti ? Que s'' il y a un mort en pleine ville, il va falloir en payer les conséquences ? au mieux la prison, au pire la peine de mort ?*
- *Votre imagination est votre seule limite*

Le MJ reste seul juge de ce qui est possible, improbable ou impossible. Sa parole doit être respectée.

### Échec critique

L’échec critique, dans sa définition la plus pure, correspond au fait de foirer totalement une action, entraînant conséquence négative.

- **Attaque** : Abîme l’arme, attaque un allié par accident, double le coût en chakra, l’attaque revient vers le joueur, etc …
- **Amplification / Soin / Entrave / Protection** : le donne à l’ennemi, se trompe de sort.
- **Défense** : Défense totalement à 0, donne +8 aux dégâts pour l’ennemi.
- **Hors combat** : les effets sont laissés à l’imagination du MJ. Les situations sont trop nombreuses.

Évidemment, ce sont toujours des moments où le MJ peut se lâcher en ce qui concerne les conséquences mais il est important de rappeler qu’il ne faut pas être trop cruel tout le temps non plus. Il est mieux de faire des grosses conséquences de temps en temps que tout le temps, ça permet d’éviter de trop frustrer les joueurs.

Autre conseil, si jamais un joueurs fait trop d’échec et d’échec critique, autorisé lui un jet d’entraînement pour la compétence qui pose problème. C’est dans l’échec qu’on apprend à être meilleur. C’est pas une panacée mais ça permet de donner une collation qui pourrait faire la différence plus tard.

## Triche du mj ?

Rien n''empêche un mj de faire comme le souhaite mais bien entendu il ne s''agit pas de faire n''importe quoi, l''objectif est de donner un rythme à la situation, utiliser ce pouvoir de triche pour punir un joueur qui serait trop turbulent ou bien pour aider un joueur qui est dans une situation catastrophique.

## Le cas de la compétence « survie »

Comme expliqué dans les compétences et les [[Altérations d''états et Mode Hyper|altérations d''états]] (voir combat), le coma est une source de stress car la vie d''un personnage repose sur un jet de survie réussi, trop d''échec ou un échec critique peut être fatal.

Le mj peut laisser les joueurs faire leur jet de survie ou alors il peut faire lui-même les jet de survie et avoir la capacité de tricher pour leur bien, un échec critique n''est jamais loin.', 'Comme expliqué plus haut, le jeu de rôle et notamment celui-ci c''est beaucoup de jets de dés, il existe plusieurs façons de procéder à ça :

- Le maître du jeu gère tous les jets de dé y compris ceux des joueurs.
- Chacun gère ses propres jets, en sachant que les jets des joueurs sont toujours ouverts.

Le maître du jeu doit faire énormément de jets durant la partie étant donné qu''il gère les événements, les pnj, les ennemis, etc... Ce dernier peut faire tous ses jets ouverts pour ajouter un peu de piquant et laisser les dés décider de ce qui va se passer, ou bien il peut faire ses dés cachés ce qui lui permet un contrôle total de ce qui se passe de son côté. Car oui n''oubliez pas que le MJ est seul maître à bord, le hasard c''est également lui, il peut très bien lancer les dés mais ne faire ça que pour le bruit.

En effet, un mj qui lance des dés peut faire peur car les joueurs sont incapables de savoir pourquoi et le résultat des dés.

## Le cas des réussites et échecs critiques

Vous savez globalement qu’il existe 4 types de résultats dans ce jeu de rôle : Réussite, Échec, Réussite critique et Échec critique. Nous allons nous attarder sur les deux derniers.

### Réussite critique

La réussite critique, dans sa définition la plus pure, correspond au fait de réussir une action de manière exceptionnelle. En raison de sa rareté, elle doit être récompensée de façon appropriée, par exemple :

- **Attaque** : double les dégâts infligés et oblige la cible à répondre par une réussite critique en défense (si elle en est capable).
- **Amplification / Soin / Entrave / Protection** : double la durée ou l’effet.
- **Défense** : permet de contre-attaquer ou de désarmer automatiquement l’adversaire.
- **Hors combat** : les effets sont laissés à l’imagination du MJ. Les situations sont trop nombreuses.

Cependant, il convient de faire attention à un piège fréquent : accorder une récompense systématique sous prétexte qu’il s’agit d’une réussite critique.

Certaines actions demeurent impossibles, quels que soient les efforts fournis. Dans certains cas, le MJ peut autoriser une tentative normalement irréalisable si celle-ci reste théoriquement possible, mais uniquement atteignable par une réussite critique.

Il peut également arriver que les joueurs invoquent la réussite critique pour justifier une action impossible. Dans cette situation, plusieurs approches sont possibles :

- **Refus clair** : le MJ rappelle que la réussite critique ne permet pas de tout accomplir.
- **Ouverture exceptionnelle** : le MJ autorise l’action, en assumant les conséquences que cela peut entraîner sur l’équilibre du jeu.
- **Résolution narrative** : le MJ laisse le joueur tenter, mais en cas de réussite critique, décrit en jeu pourquoi l’action échoue malgré tout, entraînant la perte du précieux coup critique. (réservé à ceux qui sont sadiques). Ou alors récompenser malgré tout dans le cas d’un coup critique mais le mj regarde les conséquences qu’une telle réussite peut engendrer, voir exemple.

*Exemple* :

- *Votre joueur a réussi à séduire une sénatrice elfe noire, bravo à lui ! Mais est-ce qu’il a pensé au fait que les elfes noirs sont une société matriarcale où les mâles n’ont pas leur mot à dire sur quoi que ce soit ? Surtout que vu que c’est une sénatrice, elle a un pouvoir politique écrasant ?*
- *Votre joueur a réussi à dompter un monstre, bravo à lui ! Mais est-ce qu’il sait que ce monstre est une créature qui attaque sans prévenir certaines races humanoïdes et que c’est impossible de le raisonner quand il est parti ? Que s''il y a un mort en pleine ville, il va falloir en payer les conséquences ? au mieux la prison, au pire la peine de mort ?*
- *Votre imagination est votre seule limite*

Le MJ reste seul juge de ce qui est possible, improbable ou impossible. Sa parole doit être respectée.

### Échec critique

L’échec critique, dans sa définition la plus pure, correspond au fait de foirer totalement une action, entraînant conséquence négative.

- **Attaque** : Abîme l’arme, attaque un allié par accident, double le coût en chakra, l’attaque revient vers le joueur, etc …
- **Amplification / Soin / Entrave / Protection** : le donne à l’ennemi, se trompe de sort.
- **Défense** : Défense totalement à 0, donne +8 aux dégâts pour l’ennemi.
- **Hors combat** : les effets sont laissés à l’imagination du MJ. Les situations sont trop nombreuses.

Évidemment, ce sont toujours des moments où le MJ peut se lâcher en ce qui concerne les conséquences mais il est important de rappeler qu’il ne faut pas être trop cruel tout le temps non plus. Il est mieux de faire des grosses conséquences de temps en temps que tout le temps, ça permet d’éviter de trop frustrer les joueurs.

Autre conseil, si jamais un joueur fait trop d’échecs et d’échecs critiques, autorisez-lui un jet d’entraînement pour la compétence qui pose problème. C’est dans l’échec qu’on apprend à être meilleur. C’est pas une panacée mais ça permet de donner une collation qui pourrait faire la différence plus tard.

## Triche du mj ?

Rien n''empêche un mj de faire comme le souhaite mais bien entendu il ne s''agit pas de faire n''importe quoi, l''objectif est de donner un rythme à la situation, utiliser ce pouvoir de triche pour punir un joueur qui serait trop turbulent ou bien pour aider un joueur qui est dans une situation catastrophique.

## Le cas de la compétence « survie »

Comme expliqué dans les compétences et les [[Altérations d''états et Mode Hyper|altérations d''états]] (voir combat), le coma est une source de stress car la vie d''un personnage repose sur un jet de survie réussi, trop d''échecs ou un échec critique peut être fatal.

Le mj peut laisser les joueurs faire leur jet de survie ou alors il peut faire lui-même les jets de survie et avoir la capacité de tricher pour leur bien, un échec critique n''est jamais loin.', 'neutre', NULL, 'page', '{"id":"guide/jet-de-des"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 707, 'guide', 'Pages de référence', 'La Vitesse et la Portée', 'Texte', 'modifie', '## La Vitesse

Il existe deux types de vitesse : Vitesse terrestre et Vitesse de nage, qui peut varier selon les races.

Vous pouvez retrouver les vitesses des races [ici](https://docs.google.com/spreadsheets/u/0/d/1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4/edit).

Il existe des équipements, accessoires et sortilèges qui peuvent augmenter ou bien diminuer la vitesse.

Exemple : Les Armures de la catégorie "Lourd" retirent 1 point dans la vitesse et rends la vitesse de nage nulle (donc 0).

## La Portée

La portée d''une arme détermine le nombre de cases que parcourt le projectile, à savoir que les diagonales comptent pour 2 cases lors du calcul de la portée.', '## La Vitesse

Il existe deux types de vitesse : Vitesse terrestre et Vitesse de nage, qui peut varier selon les races.

Vous pouvez retrouver les vitesses des races [ici](https://docs.google.com/spreadsheets/u/0/d/150Q6SJi4ft0oROtwT6snMAZUdWMVtkblxwYY9TqxV4Q/edit).

Il existe des équipements, accessoires et sortilèges qui peuvent augmenter ou bien diminuer la vitesse.

Exemple : Les Armures de la catégorie "Lourd" retirent 1 point dans la vitesse et rendent la vitesse de nage nulle (donc 0).

## La Portée

La portée d''une arme détermine le nombre de cases que parcourt le projectile, à savoir que les diagonales comptent pour 2 cases lors du calcul de la portée.', 'neutre', NULL, 'page', '{"id":"guide/vitesse-et-portee"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 708, 'guide', 'Pages de référence', 'Les Actions et mouvements', 'Texte', 'modifie', 'En combat, le joueur peut faire un déplacement d''un nombre de case qui dépend de [[La Vitesse et la Portée|la vitesse]] de son personnage (race et armure vont influencer l''attribut en question) et faire son action.

Remarquez que l''inverse est également possible mais aussi de faire un déplacement léger suivi de l''action, pour terminer le tour en utilisant le reste de ses points de mouvement. Une case parcourue compte pour 1, la première diagonale aussi alors que les diagonales suivantes valent 2.

Concernant cette première diagonale : Quand on dit la “première”, on parle pas de la première case de déplacement par défaut mais bien de la première fois où on fait une diagonale lors du tour. Celà peut être refait à chaque nouveau tour.

Il existe un 3ème cas, si l''action est un échec critique au [[Jet de dés|jet de dés]], le MJ a le droit d''empêcher la fin du déplacement en lui décrivant une situation qui explique la raison de l''impossibilité de la finalité de l''action.

Le déplacement s''illustre par le mouvement du token du joueur sur la Battlemap. (Un dé du joueur par exemple) Le nombre de cases qui lui est possible de parcourir en 1 tour, le nombre de cases de déplacement est liée à la fois à la race du personnage mais aussi à l''armure portée.

Il est aussi possible de sprinter, ce qui permet de doubler la vitesse parcourue, mais le sprint est considéré comme une action à part entière, il est ainsi impossible d''attaquer après un sprint.

Certaines actions autres que l''attaque ou les sorts peuvent être amenés à prendre un tour :

- Boire quelque chose (IC si jamais l''objet est sur la ceinture).
- Sortir un objet de l''inventaire.
- Mettre des objets sur la ceinture (L''Action + 1 IC).
- Allumer quelque chose (2 IC si jamais le nécessaire est sur la ceinture).
- Soigner un personnage (2 IC si jamais le nécessaire est sur la ceinture).

Malgré tout, certaines actions peuvent être réalisé en sacrifiant le déplacement à la place de l''Action :

- Recharger une arme.
- Changer d''arme ou bien dégainer.
- Sortir ou entrer dans une zone.
- Se relever.
- ou autre, libre à votre imagination et au bon vouloir du MJ.

Et il existe des situations particulières qui vont dépendre d''un jet de dé :

Grimper sur quelque chose : Un jet est nécessaire (Athlétisme/Équilibre), si c''est réussi ça consomme juste le déplacement, si c''est un échec ça consomme déplacement ET action ou ça va vous faire tomber (Voir avec le MJ car c''est une situation qui peut changer selon beaucoup de critères).

Résumé : Il y a 5 types de situations possibles à faire pendant un tour.

Déplacement => Action => Fin du tour.

Déplacement partiel => Action => Déplacement partiel => Fin du tour.

Action => Déplacement => Fin du tour..

Sprint => Fin du tour.

Déplacement partiel => Échec Critique => Fin du tour.

## IC ou Action rapide

Certains sortilèges ou actions possèdent la mention "IC" ou "Action rapide", c''est pour indiquer que ce n''est pas considéré comme une action à part entière, donc quelque chose qui ne cassera pas le tour.

Dans le même tour, il est possible de faire 3 IC (jamais deux fois le même).

**Attention ! Les IC doivent toujours être réalisés avant l''action !**', 'En combat, le joueur peut faire un déplacement d''un nombre de cases qui dépend de [[La Vitesse et la Portée|la vitesse]] de son personnage (race et armure vont influencer l''attribut en question) et faire son action.

Remarquez que l''inverse est également possible mais aussi de faire un déplacement léger suivi de l''action, pour terminer le tour en utilisant le reste de ses points de mouvement. Une case parcourue compte pour 1, la première diagonale aussi alors que les diagonales suivantes valent 2.

Concernant cette première diagonale : Quand on dit la “première”, on parle pas de la première case de déplacement par défaut mais bien de la première fois où on fait une diagonale lors du tour. Cela peut être refait à chaque nouveau tour.

Il existe un 3ème cas, si l''action est un échec critique au [[Jet de dés|jet de dés]], le MJ a le droit d''empêcher la fin du déplacement en lui décrivant une situation qui explique la raison de l''impossibilité de la finalité de l''action.

Le déplacement s''illustre par le mouvement du token du joueur sur la Battlemap. (Un dé du joueur par exemple) Le nombre de cases qui lui est possible de parcourir en 1 tour, le nombre de cases de déplacement est lié à la fois à la race du personnage mais aussi à l''armure portée.

Il est aussi possible de sprinter, ce qui permet de doubler la vitesse parcourue, mais le sprint est considéré comme une action à part entière, il est ainsi impossible d''attaquer après un sprint.

Certaines actions autres que l''attaque ou les sorts peuvent être amenées à prendre un tour :

- Boire quelque chose (IC si jamais l''objet est sur la ceinture).
- Sortir un objet de l''inventaire.
- Mettre des objets sur la ceinture (L''Action + 1 IC).
- Allumer quelque chose (2 IC si jamais le nécessaire est sur la ceinture).
- Soigner un personnage (2 IC si jamais le nécessaire est sur la ceinture).

Malgré tout, certaines actions peuvent être réalisées en sacrifiant le déplacement à la place de l''Action :

- Recharger une arme.
- Changer d''arme ou bien dégainer.
- Sortir ou entrer dans une zone.
- Se relever.
- ou autre, libre à votre imagination et au bon vouloir du MJ.

Et il existe des situations particulières qui vont dépendre d''un jet de dé :

Grimper sur quelque chose : Un jet est nécessaire (Athlétisme/Équilibre), si c''est réussi ça consomme juste le déplacement, si c''est un échec ça consomme déplacement ET action ou ça va vous faire tomber (Voir avec le MJ car c''est une situation qui peut changer selon beaucoup de critères).

Résumé : Il y a 5 types de situations possibles à faire pendant un tour.

Déplacement => Action => Fin du tour.

Déplacement partiel => Action => Déplacement partiel => Fin du tour.

Action => Déplacement => Fin du tour..

Sprint => Fin du tour.

Déplacement partiel => Échec Critique => Fin du tour.

## IC ou Action rapide

Certains sortilèges ou actions possèdent la mention "IC" ou "Action rapide", c''est pour indiquer que ce n''est pas considéré comme une action à part entière, donc quelque chose qui ne cassera pas le tour.

Dans le même tour, il est possible de faire 3 IC (jamais deux fois le même).

**Attention ! Les IC doivent toujours être réalisés avant l''action !**', 'neutre', NULL, 'page', '{"id":"guide/actions-et-mouvements"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 709, 'guide', 'Pages de référence', 'Les pièges', 'Texte', 'modifie', 'Les pièges sont un danger plus ou moins répandu dans les donjons ou ailleurs. Ils ont pour objectif de protéger les objets de valeur ou arrêter les intrus.

## Types de pièges possible

Il existe 2 types de piège plus ou moins dangereux :

- Les pièges mécaniques sont certainement les plus nombreux qui dépendent d’un système mécanique pour être enclenchée comme des dalles, des cordes, un bruit, etc…
- Les pièges magiques sont des pièges plus rares qui s''enclenchent magiquement en arrivant d’une certaine zone ou alors quand il y a une magie bien précise présente chez les joueurs.

## Déclencheur

Les façons pour les pièges de se déclencher sont nombreux :

- *Espace.* Ce piège implique de se trouver sur une case bien précise, les capacités qui permettent de flotter ou de voler permettent d’esquiver ces pièges.
- *Proximité.* Le piège se déclenche quand la cible sera à une distance bien précise, pas besoin de zone bien précise contrairement au précédent.
- *Sonore.* Le piège se déclenche quand un bruit est suffisamment fort.
- *Contact.* C’est un piège qui se déclenche quand la cible entre en contact avec celui-ci.
- *Minuté.* C’est un piège qui possède un compteur et se déclenche quand le minuteur tombe à 0 (peut être réglé avec du temps réel ou en un nombre de tour, 1 tour de jeu = 10 secondes)
- *Rune.* Il s’agit d’un piège qui se déclenche s''il y a une magie qui est faible contre le sort qui est enfermé dans la rune. Il est possible que la rune ne s''enclenche pas car aucun intrus n’est vulnérable. Le sort pourrait être un malus comme un sort d’attaque.

*Exemples :*

- *Un joueur marche sur une dalle surélevée et il ne l’avait pas vu à cause d’un mauvais jet d’observation. Un trou dans le mur fait partir une flèche vers lui.*
- *Une rune est posée avec le sort Boule de Feu, un groupe d’intrus entre dans la pièce et l’un d’entre eux est de la Glace, il est donc vulnérable à la magie du feu, ainsi le piège se déclenche immédiatement sur lui.*', 'Les pièges sont un danger plus ou moins répandu dans les donjons ou ailleurs. Ils ont pour objectif de protéger les objets de valeur ou arrêter les intrus.

## Types de pièges possibles

Il existe 2 types de piège plus ou moins dangereux :

- Les pièges mécaniques sont certainement les plus nombreux qui dépendent d’un système mécanique pour être enclenchés comme des dalles, des cordes, un bruit, etc…
- Les pièges magiques sont des pièges plus rares qui s''enclenchent magiquement en arrivant d’une certaine zone ou alors quand il y a une magie bien précise présente chez les joueurs.

## Déclencheur

Les façons pour les pièges de se déclencher sont nombreuses :

- *Espace.* Ce piège implique de se trouver sur une case bien précise, les capacités qui permettent de flotter ou de voler permettent d’esquiver ces pièges.
- *Proximité.* Le piège se déclenche quand la cible sera à une distance bien précise, pas besoin de zone bien précise contrairement au précédent.
- *Sonore.* Le piège se déclenche quand un bruit est suffisamment fort.
- *Contact.* C’est un piège qui se déclenche quand la cible entre en contact avec celui-ci.
- *Minuté.* C’est un piège qui possède un compteur et se déclenche quand le minuteur tombe à 0 (peut être réglé avec du temps réel ou en un nombre de tours, 1 tour de jeu = 10 secondes)
- *Rune.* Il s’agit d’un piège qui se déclenche s''il y a une magie qui est faible contre le sort qui est enfermé dans la rune. Il est possible que la rune ne s''enclenche pas car aucun intrus n’est vulnérable. Le sort pourrait être un malus comme un sort d’attaque.

*Exemples :*

- *Un joueur marche sur une dalle surélevée et il ne l’avait pas vue à cause d’un mauvais jet d’observation. Un trou dans le mur fait partir une flèche vers lui.*
- *Une rune est posée avec le sort Boule de Feu, un groupe d’intrus entre dans la pièce et l’un d’entre eux est de la Glace, il est donc vulnérable à la magie du feu, ainsi le piège se déclenche immédiatement sur lui.*', 'neutre', NULL, 'page', '{"id":"guide/les-pieges"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 710, 'guide', 'Pages de référence', 'Les portes', 'Texte', 'modifie', '## De manière général

Dans un donjon, les portes sont des évènements à elles seules, il existe pleins de types de portes. Voici la façon de faire du créateur du jeu.

Les portes peuvent être dans de multiples matériaux mais les 3 grandes catégories de portes sont celles en bois, en fer et en pierre.

### Crocheter

Bien entendu les portes peuvent être verrouillées, certains aventuriers peuvent user de leur talent de “Ruse” ou “Sabotage” pour déverrouiller la porte, cependant certaines serrures sont plus ou moins difficiles à ouvrir. Tout comme les joueurs, les serrures possèdent un niveau, ce qui correspond à une difficultée, voici comment il est traduit :

Les serrures ont un niveau de maximum de 20 (comme les joueurs). Par niveau de la porte, le malus pour l’ouvrir est de 3% au jet de celui qui va tenter de l’ouvrir.

*Exemple : Une porte de niveau 10 va imposer un malus de 30% à celui qui tente de l’ouvrir, si celui qui va tenter d’ouvrir à 80% en ruse ou sabotage, il aura du coup 50% de chance de réussir.*

Si jamais vos joueurs ont raté leur jet, vous avez plusieurs options :

- L’échec traduit que la serrure ne peut pas être crochetée. (Celle que le créateur utilise)
- Vous pouvez laisser vos joueurs retenter plusieurs fois, jusqu’au moment où elle va se bloquer ou alors que le joueur détruit ses outils.
- Vous pouvez laisser vos joueurs retenter autant de fois qu’ils veulent mais le temps passe et des ennemis pourraient venir les embêter ou alors que les évènements de l’autre côté de la porte peuvent s’accélérer.
- Ou une autre idée que vous pourriez avoir.

*PS : Remarquez que ce principe de niveau pour les serrures peut s’appliquer aussi pour les coffres.*

### Enfoncer

Crocheter c’est bien, mais d’autres joueurs seront plus du genre à tenter de détruire pour passer. On reprend le même principe de difficulté que pour le crochetage mais cette fois avec la compétence “Athlétisme”.

Donc on reprend le principe de niveau des portes, sauf que cette fois il faut prendre en compte la matière de la porte :

- Bois

  Ce sont les portes les plus courantes et sont souvent renforcées avec des armatures en métal. Ce sont les plus fragiles dans le cas où on souhaite la détruire.

  Malus par niveau = 1%

- Fer

  Ce sont des portes bien plus solides que celles en bois, souvent utilisées pour protéger des zones sensibles ou des trésors.

  Malus par niveau = 3%

- Pierre

  Ces portes plus rares qui font parfois penser à des obstacles naturels sont très solides et sont quasiment inébranlable, parfois ces portes sont créées artificiellement et alimentées par la magie.

  Malus par niveau = 4%

Et comme pour le crochetage, les portes vont exiger des paliers d''athlétisme mais contrairement aux serrures, le matériau va avoir son importance.

### Détruire

Autre situation, vos joueurs ne veulent pas s’embêter à faire des jets qui pourraient leur coûter cher mais préfèrent utiliser leurs armes ou magies pour détruire directement la porte ? La solution est simple, mettez des points de vie à votre porte !

Encore une fois, on reprend le principe de niveau de porte ainsi que la matière de la porte et on lui attribue un certain nombre de santé selon son niveau :

- Bois : 10 santé par niveau, les dégâts d’estoc sont divisés par 2.
- Fer : 20 santé par niveau, les dégâts d’estoc ne marchent pas, les dégâts de taille sont divisés par 2.
- Pierre : 40 santé par niveau, les dégâts d’estoc et de taille ne marchent pas.

*Exemple :*

- *Une porte en bois de niveau 15 aura 150 santé.*
- *Une porte de fer de niveau 7 aura 140 santé.*
- *Une porte de pierre de niveau 12 aura 240 santé.*

## Les herses

Ce sont des sortes de barrières sous la forme de barreaux métalliques, de pieux en bois ou de pieux en pierre, le tout qui s’abaisse et parfois couplé avec la même chose mais horizontalement.

Ces obstacles ne sont pas crochetable, ils ne peuvent qu’être enfoncé ou détruit (leur santé correspond à ce qui a été vu avant)

## Les portes magiques

Ce sont des barrières ou des portes fragiles renforcées par de la magie.

Ces obstacles ne peuvent pas être enfoncés, cet obstacle répond magiquement à toutes attaques par un sort d’attaque (de votre choix), les joueurs pourront esquiver les ripostes de la porte.

Les portes magiques peuvent être crochetées ou détruites.', '## De manière générale

Dans un donjon, les portes sont des évènements à elles seules, il existe plein de types de portes. Voici la façon de faire du créateur du jeu.

Les portes peuvent être dans de multiples matériaux mais les 3 grandes catégories de portes sont celles en bois, en fer et en pierre.

### Crocheter

Bien entendu les portes peuvent être verrouillées, certains aventuriers peuvent user de leur talent de “Ruse” ou “Sabotage” pour déverrouiller la porte, cependant certaines serrures sont plus ou moins difficiles à ouvrir. Tout comme les joueurs, les serrures possèdent un niveau, ce qui correspond à une difficulté, voici comment il est traduit :

Les serrures ont un niveau de maximum de 20 (comme les joueurs). Par niveau de la porte, le malus pour l’ouvrir est de 3% au jet de celui qui va tenter de l’ouvrir.

*Exemple : Une porte de niveau 10 va imposer un malus de 30% à celui qui tente de l’ouvrir, si celui qui va tenter d’ouvrir a 80% en ruse ou sabotage, il aura du coup 50% de chance de réussir.*

Si jamais vos joueurs ont raté leur jet, vous avez plusieurs options :

- L’échec traduit que la serrure ne peut pas être crochetée. (Celle que le créateur utilise)
- Vous pouvez laisser vos joueurs retenter plusieurs fois, jusqu’au moment où elle va se bloquer ou alors que le joueur détruit ses outils.
- Vous pouvez laisser vos joueurs retenter autant de fois qu’ils veulent mais le temps passe et des ennemis pourraient venir les embêter ou alors que les évènements de l’autre côté de la porte peuvent s’accélérer.
- Ou une autre idée que vous pourriez avoir.

*PS : Remarquez que ce principe de niveau pour les serrures peut s’appliquer aussi pour les coffres.*

### Enfoncer

Crocheter c’est bien, mais d’autres joueurs seront plus du genre à tenter de détruire pour passer. On reprend le même principe de difficulté que pour le crochetage mais cette fois avec la compétence “Athlétisme”.

Donc on reprend le principe de niveau des portes, sauf que cette fois il faut prendre en compte la matière de la porte :

- Bois

  Ce sont les portes les plus courantes et sont souvent renforcées avec des armatures en métal. Ce sont les plus fragiles dans le cas où on souhaite la détruire.

  Malus par niveau = 1%

- Fer

  Ce sont des portes bien plus solides que celles en bois, souvent utilisées pour protéger des zones sensibles ou des trésors.

  Malus par niveau = 3%

- Pierre

  Ces portes plus rares qui font parfois penser à des obstacles naturels sont très solides et sont quasiment inébranlables, parfois ces portes sont créées artificiellement et alimentées par la magie.

  Malus par niveau = 4%

Et comme pour le crochetage, les portes vont exiger des paliers d''athlétisme mais contrairement aux serrures, le matériau va avoir son importance.

### Détruire

Autre situation, vos joueurs ne veulent pas s’embêter à faire des jets qui pourraient leur coûter cher mais préfèrent utiliser leurs armes ou magies pour détruire directement la porte ? La solution est simple, mettez des points de vie à votre porte !

Encore une fois, on reprend le principe de niveau de porte ainsi que la matière de la porte et on lui attribue un certain nombre de santé selon son niveau :

- Bois : 10 santé par niveau, les dégâts d’estoc sont divisés par 2.
- Fer : 20 santé par niveau, les dégâts d’estoc ne marchent pas, les dégâts de taille sont divisés par 2.
- Pierre : 40 santé par niveau, les dégâts d’estoc et de taille ne marchent pas.

*Exemple :*

- *Une porte en bois de niveau 15 aura 150 santé.*
- *Une porte de fer de niveau 7 aura 140 santé.*
- *Une porte de pierre de niveau 12 aura 240 santé.*

## Les herses

Ce sont des sortes de barrières sous la forme de barreaux métalliques, de pieux en bois ou de pieux en pierre, le tout qui s’abaisse et parfois couplé avec la même chose mais horizontalement.

Ces obstacles ne sont pas crochetables, ils ne peuvent qu’être enfoncés ou détruits (leur santé correspond à ce qui a été vu avant)

## Les portes magiques

Ce sont des barrières ou des portes fragiles renforcées par de la magie.

Ces obstacles ne peuvent pas être enfoncés, cet obstacle répond magiquement à toutes attaques par un sort d’attaque (de votre choix), les joueurs pourront esquiver les ripostes de la porte.

Les portes magiques peuvent être crochetées ou détruites.', 'neutre', NULL, 'page', '{"id":"guide/les-portes"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 711, 'guide', 'Pages de référence', 'Les situations avancées', 'Texte', 'modifie', '## La prise en tenaille

Si l''ennemi est encerclé par des joueurs ou PNJ allié au corps à corps à des cases opposés (Avant-arrière ou gauche-droite dans le cas de 2 joueurs qui pratique la tenaille), cela à pour effets :

- Avec 2 joueurs : +4 Dégâts.
- Avec 3 joueurs : +4 Dégâts supplémentaire
- Avec 4 joueurs : +5% à la réussite critique pour les alliés et -10% au jet de défense de la cible.

Bien entendu, les effets se cumulent.

## Le déplacement ou la sortie de la zone d''influence

Lorsqu''un personnage se déplace et entre dans la zone d''influence d''un adversaire (avant, arrière, gauche ou droite), puis souhaite la traverser, il permet à cet adversaire de réaliser une attaque d''opportunité.

Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une attaque gratuite contre lui.

## Les attaques discrètes

Selon comment une situation évolue, il vous est peut être venue à l''idée d''occire une cible discrètement, sans même qu''elle voit la mort arriver. C''est ce que l''on appelle une attaque discrète (à ne pas confondre avec **l’attaque sournoise** qui vient d’une classe). Cela se traduit par un dé supplémentaire lors de votre jet de dégâts si et seulement si vous êtes en posture discrète (par exemple, au lieu de faire 2d6 avec votre dague, on passe à 3d6). Il est nécessaire de réussir un jet de ruse et qu’aucun ennemi ne vous voit clairement (voir avec le mj). Le fait de passer en mode discret consomme 3IC (2 si le joueur est voleur).

À noter que lors d''une attaque discrète, la cible doit effectuer un jet d’Observation ou de Distinction. Si elle réussit à faire mieux que le jet de discrétion précédant, la discrétion est annulée et donc les dégâts bonus aussi. Concernant la zone de vision d’un ennemi, on peut utiliser leur perception comme échelle (1 point de Perception = 2 cases pour repérer quelqu’un de caché)

## Les attaques d''opportunité

Au delà des attaques classiques, il est possible d''avoir des occasions d''attaquer de manière plus gratuitement un adversaire, ces situations là correspondent à :

- Quand l''adversaire fait un échec critique à son attaque contre vous.
- Quand l''adversaire sort de votre zone d''influence (sauf quand c’est vous qui le forcez à sortir de votre zone).
- Quand une capacité d''une classe vous le permet.

Il n''est possible de prodiguée qu''une seule attaque d''opportunité par tour ET par joueur (sauf si vous avez un don qui permet d''en faire plus), ça veut donc dire qu''il est tout à fait possible que 2 joueurs ou plus qui sont sur le même ennemi peuvent très bien utiliser leur attaque d''opportunité sur lui si jamais il est possible de lui mettre un coup.

Lors d''une attaque d''opportunité, une action simple doit être faite, il n''est pas possible de faire des actions compliqué ou en dehors de l''attaque comme :

- Un sort non offensif
- Un sort niveau 5
- Une attaque qui demande des posture ou des figures trop complexe
- Se déplacer
- Boire une potion
- Dégainer une autre arme

ect …

Ce qui est possible dans l''attaque d''opportunité est :

- Une attaque classique avec une arme (déjà dégainer et en respectant [[La Vitesse et la Portée|la portée]] de l''arme)
- Un sort d''attaque

En clair, les attaques d''opportunités sont des occasions rares mais qui peuvent faire pencher la balance lors d''un affrontement, si bien entendu l''attaque d''opportunité est réussie.

La victime de l’attaque d’opportunité ne peut pas parer ou esquiver, **à moins d’être en posture défensive**.

## L’embuscade

Il est possible de ne pas savoir quoi faire durant un tour de jeu, et il est possible de consommer ce tour pour se mettre en position embuscade et attendre patiemment la venue d’un ennemi pour lui assigner une attaque d’opportunité.

De manière concrète, il y a 3 types d’embuscades :

- *Embuscade Arme de corps à corps :* Si la victime arrive dans une zone qui correspond à la Vitesse divisée par 2, le lanceur peut foncer directement sur l’adversaire et attaquer.
- *Embuscade Arme à distance :* Si la victime arrive dans la zone d’attaque qui correspond à la portée de l’arme, le projectile est tiré.
- *Embuscade Magie :* Comme pour les armes à distances, si la victime est à portée d’attaque, le sort est lancé.

**Choses à savoir :**

La victime peut esquiver ou parer le coup.

La posture de vigilance permet de contrer l’embuscade. Si la victime est en vigilance et qu’elle passe dans la zone d’effet, elle va annuler l’embuscade.

Pour activer l’embuscade, il faut consommer son action. La posture, le déplacement et les ic sont possible.

## Les boss et leurs postures

Les boss sont généralement de gros ennemis penser pour affronter une équipe 4 joueurs, en plus d’avoir bien plus de santé qu’un ennemi classique, ils ont quelques avantages en plus :

- Ils ont deux initiatives en un tour, Il faut donc lancer deux D20 pour eux quand un tour commence.
- Leur posture Neutre possède 4 parades/esquives au lieu de 2.
- Leurs postures Vigilance et Symbiose possède 3 parades/esquives au lieu d’une seule.

## Rater ses sortilèges

Cela arrive à tout le monde de rater des sorts, lors d’un échec d’un sort, la moitié du coût en chakra est quand même consommé. Si le nombre est impair, la règle de maverick dit “toujours arrondi à l’inférieur”

**Cas particuliers :**

Lors d’un échec critique, la consommation de chakra est doublé par défaut, après concernant les autres conséquences négatives … à vous de voir ;)

## Mordhau ou Demi épée

C''est un terme utilisé pour désigner une méthode de combat avec certaines armes de corps à corps (notamment les épées), qui consiste à prendre son arme par la lame et à taper avec le manche comme un sourd. Cela permet à certaines armes de pouvoir faire des dégâts de frappe alors qu''elles en sont incapable.

Bien entendu, cette technique avancée implique une prise de risque pour l''état de l''arme, utilisée une arme de cette façon fait que vous avez 30% de chance d''abîmer votre arme (lui faire perdre un cran de solidité).

*Exemple : Si vous faites plus de 70 dans votre jet d''attaque avec arme en mordhau, votre arme perd immédiatement un cran de solidité.*', '## La prise en tenaille

Si l''ennemi est encerclé par des joueurs ou PNJ alliés au corps à corps à des cases opposées (Avant-arrière ou gauche-droite dans le cas de 2 joueurs qui pratiquent la tenaille), cela a pour effets :

- Avec 2 joueurs : +4 Dégâts.
- Avec 3 joueurs : +4 Dégâts supplémentaires
- Avec 4 joueurs : +5% à la réussite critique pour les alliés et -10% au jet de défense de la cible.

Bien entendu, les effets se cumulent.

## Le déplacement ou la sortie de la zone d''influence

Lorsqu''un personnage se déplace et entre dans la zone d''influence d''un adversaire (avant, arrière, gauche ou droite), puis souhaite la traverser, il permet à cet adversaire de réaliser une attaque d''opportunité.

Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une attaque gratuite contre lui.

## Les attaques discrètes

Selon comment une situation évolue, il vous est peut-être venu à l''idée d''occire une cible discrètement, sans même qu''elle voie la mort arriver. C''est ce que l''on appelle une attaque discrète (à ne pas confondre avec **l’attaque sournoise** qui vient d’une classe). Cela se traduit par un dé supplémentaire lors de votre jet de dégâts si et seulement si vous êtes en posture discrète (par exemple, au lieu de faire 2d6 avec votre dague, on passe à 3d6). Il est nécessaire de réussir un jet de ruse et qu’aucun ennemi ne vous voie clairement (voir avec le mj). Le fait de passer en mode discret consomme 3IC (2 si le joueur est voleur).

À noter que lors d''une attaque discrète, la cible doit effectuer un jet d’Observation ou de Distinction. Si elle réussit à faire mieux que le jet de discrétion précédent, la discrétion est annulée et donc les dégâts bonus aussi. Concernant la zone de vision d’un ennemi, on peut utiliser leur perception comme échelle (1 point de Perception = 2 cases pour repérer quelqu’un de caché)

## Les attaques d''opportunité

Au-delà des attaques classiques, il est possible d''avoir des occasions d''attaquer de manière plus gratuitement un adversaire, ces situations là correspondent à :

- Quand l''adversaire fait un échec critique à son attaque contre vous.
- Quand l''adversaire sort de votre zone d''influence (sauf quand c’est vous qui le forcez à sortir de votre zone).
- Quand une capacité d''une classe vous le permet.

Il n''est possible de prodiguer qu''une seule attaque d''opportunité par tour ET par joueur (sauf si vous avez un don qui permet d''en faire plus), ça veut donc dire qu''il est tout à fait possible que 2 joueurs ou plus qui sont sur le même ennemi puissent très bien utiliser leur attaque d''opportunité sur lui si jamais il est possible de lui mettre un coup.

Lors d''une attaque d''opportunité, une action simple doit être faite, il n''est pas possible de faire des actions compliquées ou en dehors de l''attaque comme :

- Un sort non offensif
- Un sort niveau 5
- Une attaque qui demande des postures ou des figures trop complexes
- Se déplacer
- Boire une potion
- Dégainer une autre arme

etc …

Ce qui est possible dans l''attaque d''opportunité est :

- Une attaque classique avec une arme (déjà dégainée et en respectant [[La Vitesse et la Portée|la portée]] de l''arme)
- Un sort d''attaque

En clair, les attaques d''opportunités sont des occasions rares mais qui peuvent faire pencher la balance lors d''un affrontement, si bien entendu l''attaque d''opportunité est réussie.

La victime de l’attaque d’opportunité ne peut pas parer ou esquiver, **à moins d’être en posture défensive**.

## L’embuscade

Il est possible de ne pas savoir quoi faire durant un tour de jeu, et il est possible de consommer ce tour pour se mettre en position embuscade et attendre patiemment la venue d’un ennemi pour lui assigner une attaque d’opportunité.

De manière concrète, il y a 3 types d’embuscades :

- *Embuscade Arme de corps à corps :* Si la victime arrive dans une zone qui correspond à la Vitesse divisée par 2, le lanceur peut foncer directement sur l’adversaire et attaquer.
- *Embuscade Arme à distance :* Si la victime arrive dans la zone d’attaque qui correspond à la portée de l’arme, le projectile est tiré.
- *Embuscade Magie :* Comme pour les armes à distance, si la victime est à portée d’attaque, le sort est lancé.

**Choses à savoir :**

La victime peut esquiver ou parer le coup.

La posture de vigilance permet de contrer l’embuscade. Si la victime est en vigilance et qu’elle passe dans la zone d’effet, elle va annuler l’embuscade.

Pour activer l’embuscade, il faut consommer son action. La posture, le déplacement et les ic sont possibles.

## Les boss et leurs postures

Les boss sont généralement de gros ennemis pensés pour affronter une équipe 4 joueurs, en plus d’avoir bien plus de santé qu’un ennemi classique, ils ont quelques avantages en plus :

- Ils ont deux initiatives en un tour, il faut donc lancer deux D20 pour eux quand un tour commence.
- Leur posture Neutre possède 4 parades/esquives au lieu de 2.
- Leurs postures Vigilance et Symbiose possèdent 3 parades/esquives au lieu d’une seule.

## Rater ses sortilèges

Cela arrive à tout le monde de rater des sorts, lors d’un échec d’un sort, la moitié du coût en chakra est quand même consommé. Si le nombre est impair, la règle de Maverick dit “toujours arrondi à l’inférieur”

**Cas particuliers :**

Lors d’un échec critique, la consommation de chakra est doublée par défaut, après concernant les autres conséquences négatives … à vous de voir ;)

## Mordhau ou Demi-épée

C''est un terme utilisé pour désigner une méthode de combat avec certaines armes de corps à corps (notamment les épées), qui consiste à prendre son arme par la lame et à taper avec le manche comme un sourd. Cela permet à certaines armes de pouvoir faire des dégâts de frappe alors qu''elles en sont incapables.

Bien entendu, cette technique avancée implique une prise de risque pour l''état de l''arme, utiliser une arme de cette façon fait que vous avez 30% de chance d''abîmer votre arme (lui faire perdre un cran de solidité).

*Exemple : Si vous faites plus de 70 dans votre jet d''attaque avec arme en mordhau, votre arme perd immédiatement un cran de solidité.*', 'neutre', NULL, 'page', '{"id":"guide/situations-avancees"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 712, 'guide', 'Pages de référence', 'Liste des altérations d''état', 'Texte', 'modifie', '## Aveuglement

- **Magie Liée** : Lumière
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -20% pour tout test qui demande de toucher une cible pendant 2 tours. | -50% pour tout test qui demande de toucher une cible pendant 2 tours. | -100% pour tout test qui demande de toucher une cible pendant 2 tours.<br><br>Les dégâts de sorts qui sont lié à la vision ne font aucun dégât. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégâts lié à la vue fonctionne toujours
- **Grande vulnérabilité** : +5 dégâts par tour
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Effet négatif divisé par 2
- **Grande résistance** : 2 fois + de chances d''y résister

## Brûlure

- **Magie Liée** : Feu
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Inflige 10% de la santé Max<br>penant 3 Tours. | Inflige 10% de la santé Max<br>pendant 4 Tours | Inflige 10% de la santé Max<br>pendant 5 Tours.<br>Les dégats des attaques physiques<br>de la victime sont divisés par 2 |

**Résistances/Vulnérabilités**

- **Sensibilité** : dégats des attaques physiques,  divisé par 2 au stade 2.
- **Grande vulnérabilité** : 5% de dégats supplémentaire
- **Vulnérabilité** : 5% de dégats supplémentaire.
- **Résistances** : 5% de dégats en moins
- **Grande résistance** : Dure 1 Tour de moins.

## Confusion

- **Magie Liée** : Eau
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Lance 1d100 pour voir le comportement<br>01-70 : Agit normalement.<br>71-80 : Passe son Tour<br>81-90 : Se frappe tout seul.<br>91-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-50 : Agit normalement.<br>51-60 : Passe son Tour<br>61-80 : Se frappe tout seul.<br>81-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-20 : Agit normalement.<br>21-40 : Passe son Tour<br>41-60 : Se frappe tout seul.<br>61-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Grande vulnérabilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Vulnérabilité** : Jette deux dés 100 et prend le pire résultat
- **Résistances** : Jette deux dés 100 et prend le meilleur résultat
- **Grande résistance** : Permet de lancer un jet de chance si la cible à attaquer est un allié

## Enragé

- **Magie Liée** : Vide
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - La victime à un bonus de +3 dégats.<br>-Malus de 10% pour toucher.<br>-Attaque la cible vivant la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrete au bout de 4 Tours. | - La victime à un bonus de +6 dégats.<br>-Malus de 15% pour toucher.<br>-Attaque la cible vivant la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrete au bout de 4 Tours. | - La victime à un bonus de +10 dégats.<br>-Malus de 20% pour toucher.<br>-Attaque la cible vivant la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrete au bout de 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Jette deux d100 pour la femeté, prends le pire.
- **Grande vulnérabilité** : +1 Tour
- **Vulnérabilité** : Chaque coup infligé cause un contre-coup de 5 dégats dans les PV.
- **Résistances** : Jet de chance pour ne pas frapper un allié si c''est la cible la plus proche
- **Grande résistance** : Jette deux d100 pour la femeté, prends le meilleur.

## Fatigue

- **Magie Liée** : Temps/<br>Espace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -Impossible de Sprint.<br>- Malus de 5 à tout les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Spint.<br>- Croix en Force et en Agilité.<br>- Malus de 10 à tout les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Sprint.<br>- Croix à toutes les Caractéristiques.<br>- Malus de 15 à tout les dégâts.<br><br>Dure jusqu''au prochain Repos. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 met deux croix a toutes les caractéristiques.
- **Grande vulnérabilité** : Dure 2 Repos au lieu de 1.
- **Vulnérabilité** : Prends une croix supplémentaire aléatoire au stade 2.
- **Résistances** : Permet de choisir entre la Force ou l''Agilité pour le malus du stade 2
- **Grande résistance** : Le stade 3 met deux croix aléatoires au lieu d''une croix partout.

## Gel

- **Magie Liée** : Glace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Vitesse -1<br>-Infliuge 5% de la santé max.<br><br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 10% de la santé Max.<br>- Les dégats des attaques magiques de la cible sont divisé par 2.<br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 15% de la santé Max.<br>- Les dégats des attaques magiques de la cible sont divisé par 2.<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : -2 vitesse
- **Grande vulnérabilité** : Les dégats des attaques magiques sont divisées par 2 dès le Stade 1.
- **Vulnérabilité** : +1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : La vitesse n''est plus réduite.

## Paralysie

- **Magie Liée** : Foudre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br><br>Dure 2 Tours. | - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br>- Vitesse divisée par 2.<br><br>Dure 3 Tours. | - Un jet de Vigueur est nécessaire pour ne pas perdre 1 Tour.<br>-  Vitesse divisée par 2.<br>- Le resultat d''initiative sera toujours 01.<br>Dure 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Inflige 10% de la santé max à chaque échec.
- **Grande vulnérabilité** : Jette deux d100 pour la Vigueur, prends le pire.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Jette deux d100 pour la Vigueur, prends le meilleur.
- **Grande résistance** : - 1 Tour

## Peur

- **Magie Liée** : Ombre
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 10% a tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 20% a tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 25% a tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le malus s''applique au jet de Calme.
- **Grande vulnérabilité** : - 10% de chance de résister à l''altération.
- **Vulnérabilité** : - 5% a tous les jets
- **Résistances** : Divise par 2 l''effet négatif.
- **Grande résistance** : 2 fois plus de chance de résister à l''altérzation.

## Pétrifié

- **Magie Liée** : Terre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Croix à l''Agilité<br>-Vitesse divisée par 2<br><br>Dure 3 Tours. | - Impossibilité de bouger<br>-Ne peux utiliser que des sorts.<br><br>Dure 3 Tours. | - Impossibilité de bouger  et<br>d''attaquer.<br><br>- Dure 3 Tours |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 implique un jet de survie a chaque tour. Echec = mort.
- **Grande vulnérabilité** : Malus de 10% a tous les jets.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Le malus de vitesse passe a -1.
- **Grande résistance** : Le Stade 3 ne s''applique pas.

## Poison

- **Magie Liée** : Nécromancie
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 10% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 15% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 20% de la santé Max.<br><br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégats doublés.
- **Grande vulnérabilité** : 1 Tour d''effet supplémentaire.
- **Vulnérabilité** : 5% de dégats supplémentaires.
- **Résistances** : Dégats divisés par 2.
- **Grande résistance** : - 1 Tour.

## Saignement

- **Magie Liée** : Sang
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 5% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche.<br>- Croix à la Volonté. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégats doublés.
- **Grande vulnérabilité** : Croix à la Force.
- **Vulnérabilité** : 5% de dégats supplémentaires.
- **Résistances** : Dégats divisés par 2.
- **Grande résistance** : Dure que 3 Tours.

## Surcharge Magique

- **Magie Liée** : Arcane/<br>Corruption
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -  Consomme  5% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure magique divisée par 2. | - Consomme 10% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure magique divisée par 3. | - Consomme 15% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure Magique divisée par 4. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Croix à l''Intel et à la Volonté
- **Grande vulnérabilité** : Résistance Magique annulées
- **Vulnérabilité** : 5% de barrière et de chakra en moins.
- **Résistances** : - 1 Tour
- **Grande résistance** : La barrière n''est pas impacté

## Surdité

- **Magie Liée** : Vent
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 15% aux compétences : Athlétisme, Équilibre, Stabilité, Reflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 20% aux compétences : Athlétisme, Équilibre, Stabilité, Reflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 30% aux compétences : Athlétisme, Équilibre, Stabilité, Reflexe, Distinction, Orientation.<br>- Dure 3 Tours.<br>Les dégâts sonores ne fonctionnent plus sur la victime |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégats liés aux oreilles fonctionnent toujours.
- **Grande vulnérabilité** : Les échecs des jets stabilité/reflexe seront considérer comme EC.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : Les malus sont divisés par 2.

## Aggripé

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de bouger.<br>Un jet d''Athlétisme/Équilibre est nécessaire pour sortir de l''entrave. |

## Coma

- **Magie Liée** : /
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Le personnage est inconscient et doit faire 3 jet de survie si il ne veux pas mourir.<br>Une réussite et le personnage est stabilisé, 3 échecs et c''est la MORT ! | Si le personnage a atteint son négatif maximal (le négatif égal à ses pv max) il n''aura qu''un SEUL et UNIQUE jet de survie. Si il est raté c''est la MORT ! | Si le personnage a atteint son double négatif maximal, il est MORT. |

## Couardise

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible d''attaquer une cible qui a plus de santé. Force un jet de fermeté ou de calme a chaque tentative d''attaque ou d''entrave direct sur l''adversaire.<br>Dure 4 tours.<br>(Les boss et mini boss ne peuvent pas l''infliger) |

## Enchevêtré

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Ne peut pas se déplacer et l''assaillant non plus.<br>Les attaques physiques ont les dégâts divisés par 2. |

## Etourdi

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de faire le déplacement ET l''action dans le même tour. Les IC deviennent des actions. |

## Folle de Guerre

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| - Impossible d''attendre, doit avancer vers l''ennemi.<br>- Insensible à tout contrôle mentale ou à la peur. |

## Sans Défense

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de se défendre et demande un tour complet pour le retirer.<br>Les coups portées sur lui seront automatiquement des coups critiques. |', '## Aveuglement

- **Magie Liée** : Lumière
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -20% pour tout test qui demande de toucher une cible pendant 2 tours. | -50% pour tout test qui demande de toucher une cible pendant 2 tours. | -100% pour tout test qui demande de toucher une cible pendant 2 tours.<br><br>Les dégâts de sorts qui sont liés à la vision ne font aucun dégât. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégâts liés à la vue fonctionnent toujours
- **Grande vulnérabilité** : +5 dégâts par tour
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Effet négatif divisé par 2
- **Grande résistance** : 2 fois + de chances d''y résister

## Brûlure

- **Magie Liée** : Feu
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Inflige 10% de la santé Max<br>pendant 3 Tours. | Inflige 10% de la santé Max<br>pendant 4 Tours | Inflige 10% de la santé Max<br>pendant 5 Tours.<br>Les dégâts des attaques physiques<br>de la victime sont divisés par 2 |

**Résistances/Vulnérabilités**

- **Sensibilité** : dégâts des attaques physiques,  divisés par 2 au stade 2.
- **Grande vulnérabilité** : 5% de dégâts supplémentaires
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : 5% de dégâts en moins
- **Grande résistance** : Dure 1 Tour de moins.

## Confusion

- **Magie Liée** : Eau
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Lance 1d100 pour voir le comportement<br>01-70 : Agit normalement.<br>71-80 : Passe son Tour<br>81-90 : Se frappe tout seul.<br>91-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-50 : Agit normalement.<br>51-60 : Passe son Tour<br>61-80 : Se frappe tout seul.<br>81-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. | Lance 1d100 pour voir le comportement<br>01-20 : Agit normalement.<br>21-40 : Passe son Tour<br>41-60 : Se frappe tout seul.<br>61-100 : Attaque la cible la plus proche<br>(Allié comme ennemi)<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Grande vulnérabilité** : "Passe le tour" et "Attaque la cible la plus proche" se feront en offensif.
- **Vulnérabilité** : Jette deux dés 100 et prend le pire résultat
- **Résistances** : Jette deux dés 100 et prend le meilleur résultat
- **Grande résistance** : Permet de lancer un jet de chance si la cible à attaquer est un allié

## Enragé

- **Magie Liée** : Vide
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - La victime a un bonus de +3 dégâts.<br>-Malus de 10% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. | - La victime a un bonus de +6 dégâts.<br>-Malus de 15% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. | - La victime a un bonus de +10 dégâts.<br>-Malus de 20% pour toucher.<br>-Attaque la cible vivante la plus proche (alliée comme ennemie).<br>-Jet de fermeté pour retirer l''effet.<br>-S''arrête au bout de 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Jette deux d100 pour la fermeté, prends le pire.
- **Grande vulnérabilité** : +1 Tour
- **Vulnérabilité** : Chaque coup infligé cause un contre-coup de 5 dégâts dans les PV.
- **Résistances** : Jet de chance pour ne pas frapper un allié si c''est la cible la plus proche
- **Grande résistance** : Jette deux d100 pour la fermeté, prends le meilleur.

## Fatigue

- **Magie Liée** : Temps/<br>Espace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -Impossible de Sprint.<br>- Malus de 5 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Sprint.<br>- Croix en Force et en Agilité.<br>- Malus de 10 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. | -Impossible de Sprint.<br>- Croix à toutes les Caractéristiques.<br>- Malus de 15 à tous les dégâts.<br><br>Dure jusqu''au prochain Repos. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 met deux croix à toutes les caractéristiques.
- **Grande vulnérabilité** : Dure 2 Repos au lieu de 1.
- **Vulnérabilité** : Prends une croix supplémentaire aléatoire au stade 2.
- **Résistances** : Permet de choisir entre la Force ou l''Agilité pour le malus du stade 2
- **Grande résistance** : Le stade 3 met deux croix aléatoires au lieu d''une croix partout.

## Gel

- **Magie Liée** : Glace
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Vitesse -1<br>-Inflige 5% de la santé max.<br><br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 10% de la santé Max.<br>- Les dégâts des attaques magiques de la cible sont divisés par 2.<br>Dure 3 Tours. | -Vitesse -1.<br>- Inflige 15% de la santé Max.<br>- Les dégâts des attaques magiques de la cible sont divisés par 2.<br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : -2 vitesse
- **Grande vulnérabilité** : Les dégâts des attaques magiques sont divisés par 2 dès le Stade 1.
- **Vulnérabilité** : +1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : La vitesse n''est plus réduite.

## Paralysie

- **Magie Liée** : Foudre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br><br>Dure 2 Tours. | - Un jet de Vigueur est nécessaire<br>pour ne pas perdre 1 Tour.<br>- Vitesse divisée par 2.<br><br>Dure 3 Tours. | - Un jet de Vigueur est nécessaire pour ne pas perdre 1 Tour.<br>-  Vitesse divisée par 2.<br>- Le résultat d''initiative sera toujours 01.<br>Dure 4 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Inflige 10% de la santé max à chaque échec.
- **Grande vulnérabilité** : Jette deux d100 pour la Vigueur, prends le pire.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Jette deux d100 pour la Vigueur, prends le meilleur.
- **Grande résistance** : - 1 Tour

## Peur

- **Magie Liée** : Ombre
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 10% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 20% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. | - Malus de 25% à tous les jets<br>(hors jet de calme)<br><br>Dure tant qu''un jet de Calme n''a<br>pas été réussi. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le malus s''applique au jet de Calme.
- **Grande vulnérabilité** : - 10% de chance de résister à l''altération.
- **Vulnérabilité** : - 5% à tous les jets
- **Résistances** : Divise par 2 l''effet négatif.
- **Grande résistance** : 2 fois plus de chance de résister à l''altération.

## Pétrifié

- **Magie Liée** : Terre
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Croix à l''Agilité<br>-Vitesse divisée par 2<br><br>Dure 3 Tours. | - Impossibilité de bouger<br>-Ne peut utiliser que des sorts.<br><br>Dure 3 Tours. | - Impossibilité de bouger  et<br>d''attaquer.<br><br>- Dure 3 Tours |

**Résistances/Vulnérabilités**

- **Sensibilité** : Le stade 3 implique un jet de survie à chaque tour. Échec = mort.
- **Grande vulnérabilité** : Malus de 10% à tous les jets.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : Le malus de vitesse passe à -1.
- **Grande résistance** : Le Stade 3 ne s''applique pas.

## Poison

- **Magie Liée** : Nécromancie
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 10% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 15% de la santé Max.<br><br>Dure 3 Tours. | - Inflige 20% de la santé Max.<br><br>Dure 3 Tours. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégâts doublés.
- **Grande vulnérabilité** : 1 Tour d''effet supplémentaire.
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : Dégâts divisés par 2.
- **Grande résistance** : - 1 Tour.

## Saignement

- **Magie Liée** : Sang
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Inflige 5% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche. | - Inflige 10% de la santé Max<br>jusqu''au prochain bandage<br>étanche.<br>- Croix à la Volonté. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Dégâts doublés.
- **Grande vulnérabilité** : Croix à la Force.
- **Vulnérabilité** : 5% de dégâts supplémentaires.
- **Résistances** : Dégâts divisés par 2.
- **Grande résistance** : Dure que 3 Tours.

## Surcharge Magique

- **Magie Liée** : Arcane/<br>Corruption
- **Type** : Mental

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| -  Consomme  5% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure magique divisée par 2. | - Consomme 10% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure magique divisée par 3. | - Consomme 15% de la Barrière Max<br>et du Chakra Max (3 Tours)<br><br>- Armure Magique divisée par 4. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Croix à l''Intel et à la Volonté
- **Grande vulnérabilité** : Résistance Magique annulées
- **Vulnérabilité** : 5% de barrière et de chakra en moins.
- **Résistances** : - 1 Tour
- **Grande résistance** : La barrière n''est pas impactée

## Surdité

- **Magie Liée** : Vent
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| - Malus de 15% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 20% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.<br>- Dure 3 Tours. | - Malus de 30% aux compétences : Athlétisme, Équilibre, Stabilité, Réflexe, Distinction, Orientation.<br>- Dure 3 Tours.<br>Les dégâts sonores ne fonctionnent plus sur la victime |

**Résistances/Vulnérabilités**

- **Sensibilité** : Les dégâts liés aux oreilles fonctionnent toujours.
- **Grande vulnérabilité** : Les échecs des jets stabilité/réflexe seront considérés comme EC.
- **Vulnérabilité** : + 1 Tour
- **Résistances** : - 1 Tour
- **Grande résistance** : Les malus sont divisés par 2.

## Agrippé

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de bouger.<br>Un jet d''Athlétisme/Équilibre est nécessaire pour sortir de l''entrave. |

## Coma

- **Magie Liée** : /
- **Type** : Physique

| Stade 1 | Stade 2 | Stade 3 |
| --- | --- | --- |
| Le personnage est inconscient et doit faire 3 jets de survie s''il ne veut pas mourir.<br>Une réussite et le personnage est stabilisé, 3 échecs et c''est la MORT ! | Si le personnage a atteint son négatif maximal (le négatif égal à ses pv max) il n''aura qu''un SEUL et UNIQUE jet de survie. S''il est raté c''est la MORT ! | Si le personnage a atteint son double négatif maximal, il est MORT. |

## Couardise

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible d''attaquer une cible qui a plus de santé. Force un jet de fermeté ou de calme à chaque tentative d''attaque ou d''entrave directe sur l''adversaire.<br>Dure 4 tours.<br>(Les boss et mini boss ne peuvent pas l''infliger) |

## Enchevêtré

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Ne peut pas se déplacer et l''assaillant non plus.<br>Les attaques physiques ont les dégâts divisés par 2. |

## Étourdi

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de faire le déplacement ET l''action dans le même tour. Les IC deviennent des actions. |

## Folie de Guerre

- **Magie Liée** : /
- **Type** : Mental

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| - Impossible d''attendre, doit avancer vers l''ennemi.<br>- Insensible à tout contrôle mental ou à la peur. |

## Sans Défense

- **Magie Liée** : /
- **Type** : Physique

| Stades 1 à 3 (cellule fusionnée) |
| --- |
| Impossible de se défendre et demande un tour complet pour le retirer.<br>Les coups portés sur lui seront automatiquement des coups critiques. |', 'neutre', NULL, 'page', '{"id":"guide/liste-des-alterations-d-etat"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 713, 'guide', 'Pages de référence', 'Liste des effets mode hyper', 'Texte', 'modifie', '"Ne plus faire qu''un avec soi même"

## Qu''est ce que c''est ?

Le Mode Hyper est un état de surpuissance qui se débloque au niveau 2 de personnage.

Il s''agit d''un état où le personnage libère sa puissance cachée en lui, sa magie ne fait plus qu''un avec lui, l''aura magique déferle et ses attributs physiques changent énormément vu que sa magie l''envahi.

Activer le mode hyper ne demande aucun jet de dés et est considéré comme un Instant Cast.

## Fonctionnement

Pendant le mode hyper, le chakra est utilisé comme carburant pour le mode hyper, il est consommé à raison de 10% du Chakra max par tour. Cependant, il est impossible de consommer une fiole bleue (ou équivalent qui redonnerai du chakra), de faire une méditation ou bien de se reposer. Le chakra ne peut pas être régénéré pendant le mode hyper. Le mode hyper peut durer au maximum un nombre de tours équivalent au niveau global divisé par 2, même si il reste du chakra en réserve. Le mode hyper est très épuisant pour le corps et l''esprit.<br>
Il est utiliser à raison de 1 fois toutes les semaines vu qu''on parle d''un état qui épuise très rapidement le corps.

## Au delà des limites

Il est bien entendu possible de conserver son mode hyper même si la réserve de chakra est épuisée ou bien les tours passés, mais cela aura des conséquences sur le corps et l''esprit.

Maintenir le mode hyper au delà des limites aura pour conséquence une fois le mode hyper relâché :

- 1 tour supplémentaire : Brise les résistances magiques pendant 24h.
- 2 tours supplémentaires : Accentue les vulnérabilités pendant 24h. (donne 2 faiblesse aléatoire pour les magies d''Arcane, Corruption et Potentiel illimité)
- 3 tours supplémentaires : 3 croix caractéristiques aléatoires pendant 24h.
- 4 tours supplémentaires : Tombe dans le coma avec perte complète de la santé.
- 5 tours supplémentaires : Mode hyper désactivé, 50% de chance de mourir.

Le Mode Hyper ne peut être enclenché qu''une fois toutes les semaines dans le jeu, et qu''une seule créature sur le terrain ne peut activer son mode hyper pendant 1 combat, il existe des exceptions :

- Les zones où le chakra est tellement présent que le simple fait de respirer permet de récupérer la totalité de son chakra, ici tout le monde peut activer son mode hyper et cela sans consommer le chakra, mais la limite des 10 tours, elle, reste présente.
- Un objet magique qui permet d''activer son mode hyper en même temps que quelqu''un d''autre.
- Autorisation du MJ selon la situation.

## Mode Hyper 100%

Il s''agit d''un état plus puissant du Mode Hyper de base, dans cet état, le lanceur se concentre pour renfermer l''aura de chakra qui déferle en mode Hyper. Une fois scellée à l''intérieur de son corps, la puissance du lanceur est à son paroxysme.

L''appellation "100%" vient du fait que le lanceur est à pleine puissance tant que l''aura est enfouie en lui, ainsi de nouveaux bonus s''offrent à lui en 100% :

- Le Chakra ne s''évapore plus.
- Toutes les postures sont activées et ne possèdent plus d''inconvénients.
- Tous les sorts peuvent être surchargés (leur donnant 1d de dégâts en plus)
- Toutes les attaques physiques et magiques infligent +10 dégâts en plus du mode hyper d''avant.

En revanche, l''état 100% ne peut pas être conservé éternellement, il ne dure que 3 tours et après le lanceur revient dans le Mode Hyper normal, consommant au passage 75% de son Chakra Max (Prudence, si vous n''avez pas 75% de Chakra courant en réserve, le manque sera pris dans les PV).

Le Mode Hyper 100% n''est disponible qu''au niveau 10 de personnage.

## Effets selon la magie ou le type

| Magie/Type | Mono magie | Bi magie |
| --- | --- | --- |
| Général | Immunité à la magie innée | Très résistant aux deux magies |
| Général | Dégâts de la magie +15 | Dégâts de la magie +7 |
| Général | Dégâts physique +15 | Dégâts physique +15 |
| Général | Soin magique +15 | Soin magique +15 |
| Général | Consommation de chakra = 0 | Consommation de chakra = 0 |
| Potentiel illimité | Dégâts physique neutre, Résistance à la magie | Dégâts physique neutre, Résistance à la magie |
| Sang | Permet de récupérer 10 sang par tour au lieu de 1. | Divise par 2 le coût en sang pour les sorts. |
| Arcane | Les sorts amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |
| Corruption | Le chakra active directements les effets secondaires | Divise par 2 le cout en corruption des sorts. |
| Temps/Espace | Donne l''état "Célérité" (voir le sort lvl 4) pendant le mode hyper, le sort portail pase à ICx3 et le sort téléportation passe à ICx2. | Donne l''état "Image diffuse" (voir le sort lvl 4) pendant le mode hyper, les clones se recharge à hauteur de 1 par tour. |
| Vide | Impose un désavantage (jette 2d100, garde le moins bon) aux ennemis qui tente des attaques contre lui. | Impose un désavantage (jette 2d100, garde le moins bon)à la première attaque tenter contre lui. |
| Nécromancie | Permet d''avoir deux invocations au lieu d''un seul. Passe le sort animation de mort en IC (ICx2 si jamais il est déjà en ic) | Permet d''avoir deux invocations au lieu d''un seul. |
| Feu | (Réaction) Lors d''une agression, permet de répondre par une contre attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/tour) | (Réaction) Lors d''une agression, permet de répondre par une contre attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/3 tours) |
| Eau | L''utilisateur du mode hyper est considérer comme une source d''eau pour lui et ses alliés.<br>La première attaque subis réduit ses dégâts finaux de 20%. | L''utilisateur du mode hyper est considérer comme une source d''eau QUE pour lui.<br>La première attaque subis réduit ses dégâts finaux de 20%. |
| Glace | L''armure magique (AM) de base augmente de 25. | L''armure magique (AM) de base augmente de 10. |
| Terre | L''armure physique (AP) de base augmente de 25. | L''armure physique (AP) de base augmente de 10. |
| Vent | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts qui va ignorer les AP et AM sur 8 cases de distance. Dégâts non élémentaires. | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts sur 6 cases de distance. Dégâts non élémentaires. |
| Foudre | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts qui va ignorer les AM et AP. Dégâts non élémentaires. | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts. Dégâts non élémentaires. |
| Lumière | Les soins et les protections deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, un soin ou une protction est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |
| Ombre | Les sorts entraves deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, une entrave est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |

## Effets selon la race

| Race | Effet |
| --- | --- |
| Humain | 1d de dégâts en plus pour toutes les attaques produites, +2 à la Vitesse et les altérations d''états "peur", "fatigue" et "couardise" ne fonctionne pas." |
| Elfe forestier | Chaque test d''Agilité se fait à 95% et impossible d''imposer de malus dessus. |
| Elfe noir | Permet de synthétiser un poison unique sur l''arme principale, inflige "poison 1" pendant tout le monde hyper. L''ennemi doit faire un jet de vigueur tout les débuts de tour pour ne pas encaisser les dégâts. |
| Elfe argenté | Toutes les attaques magiques sont imparable. |
| Elfe doré | Les sorts infligent un stade au dessus de leur altération d''état. |
| Farfadet | Permet d''avoir accès à tout les sorts de votre/vos magies, qui correspond à votre niveau puissance magique et inférieur. |
| Felfe | Peut voler, les dégâts et soin magiques sont augmenté de 2d, ceux qui doivent faire des jets pour esquiver les effets secondaire des sorts ont leur score divisé par 2. |
| Nain | 2d de dégâts physiques en plus. Le sort malédiction ne marche. |
| Majin | La portée des attaques augmente de 2. |
| Hujin | Diminue d''un cran les dés des attaques physiques ou magiques subit |
| Drakos | (Action) Permet une attaque de souffle de l''élément de la magie innée, inflige 3d6/NPM dégâts et possède une portée de 4. Elle ne bénéficie pas des boost de dégats donner par le mode hyper ou autre (mais est influencée par les postures). Demande un jet qui est choisi entre toutes les compétences d''attaques disponible. |
| Mort-vivant | Régénère 20% de santé au début de son tour. |
| Orios | Chaque test de Force se fait à 95% et impossible d''imposer de malus dessus, immunisé aux peurs. |
| Drassah''thac | Permet de relancer un jet de dés (alliés, ennemis, soi même), peu importe la nature (2 fois/Mode Hyper). |
| Fenrir | Chaque test de Perception se fait à 95% et impossible d''imposer de malus dessus, impossible de prendre d''attaques surprises, cachées ou sournoise. |
| Kitsune | Choisi quand il commence le tour de jeu. |
| Olwman | Peut se déplacement gratuitement de 2 cases et ceux n''importe quand durant le tour. (1 fois par tour) |
| Rokh | Chaque attaque physique ou magique se suit d''un appel d''une [Element Innée] blanche [dégâts non élémentaire] qui inflige +1dx\* de dégâts en plus. \*le dégât est calqué sur le dégâts de l''arme ou du sort utilisé |
| Minotaure | Les coups avec les cornes ou sabots inflige 20% des PV actuelle à la cible (une seule fois par mode hyper). |
| Namazus | La prochaine attaque avec une arme inflige "saignement 1" pendant tout le mode hyper. L''ennemi doit faire un jet de vigueur tous les début de tour pour ne pas encaisser les dégâts. |
| Satyre | Impose un malus de 10% (augmente de 5% au niveau 10 globale) à tous les jets des ennemis dans un rayon de 5 cases ou moins. |
| Médusain | Chaque attaque physique va se suivre d''une tentacule qui touche la cible et lui inflige l''altération d''état malgré la protection. |
| Lamia | Permet de cracher un venin à 3PO qui est capable d''empoisonné et de paralysé pendant 3 tours, oblige 2 jet de vigueur pour résister au deux effets. |
| Jackalope | +3 Vitesse |
| Marcass | Les AP et AM naturels s’ajoutent à toute réduction de dégâts, quel que soit le type d’attaque. |
| Anansi | Les attaques vont obtenir une effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière a la cible \| Nécromancie= Inflige Poison 1 automatiquement \| Ombre = Réduit de 5 l''initiative de la cible toucher pour le prochaine tour |
| Goleois | Augmente les dégâts de tous les alliés de 5, le temps du mode hyper. |

*Le classeur « Magie Maverick V8 » contient, dans un onglet masqué, une autre liste des effets du mode hyper (page « Mode Hyper (Magie) ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*', '"Ne plus faire qu''un avec soi-même"

## Qu''est-ce que c''est ?

Le Mode Hyper est un état de surpuissance qui se débloque au niveau 2 de personnage.

Il s''agit d''un état où le personnage libère sa puissance cachée en lui, sa magie ne fait plus qu''un avec lui, l''aura magique déferle et ses attributs physiques changent énormément vu que sa magie l''envahit.

Activer le mode hyper ne demande aucun jet de dés et est considéré comme un Instant Cast.

## Fonctionnement

Pendant le mode hyper, le chakra est utilisé comme carburant pour le mode hyper, il est consommé à raison de 10% du Chakra max par tour. Cependant, il est impossible de consommer une fiole bleue (ou équivalent qui redonnerait du chakra), de faire une méditation ou bien de se reposer. Le chakra ne peut pas être régénéré pendant le mode hyper. Le mode hyper peut durer au maximum un nombre de tours équivalent au niveau global divisé par 2, même s''il reste du chakra en réserve. Le mode hyper est très épuisant pour le corps et l''esprit.<br>
Il est utilisé à raison de 1 fois toutes les semaines vu qu''on parle d''un état qui épuise très rapidement le corps.

## Au-delà des limites

Il est bien entendu possible de conserver son mode hyper même si la réserve de chakra est épuisée ou bien les tours passés, mais cela aura des conséquences sur le corps et l''esprit.

Maintenir le mode hyper au-delà des limites aura pour conséquence une fois le mode hyper relâché :

- 1 tour supplémentaire : Brise les résistances magiques pendant 24h.
- 2 tours supplémentaires : Accentue les vulnérabilités pendant 24h. (donne 2 faiblesses aléatoires pour les magies d''Arcane, Corruption et Potentiel illimité)
- 3 tours supplémentaires : 3 croix caractéristiques aléatoires pendant 24h.
- 4 tours supplémentaires : Tombe dans le coma avec perte complète de la santé.
- 5 tours supplémentaires : Mode hyper désactivé, 50% de chance de mourir.

Le Mode Hyper ne peut être enclenché qu''une fois toutes les semaines dans le jeu, et qu''une seule créature sur le terrain ne peut activer son mode hyper pendant 1 combat, il existe des exceptions :

- Les zones où le chakra est tellement présent que le simple fait de respirer permet de récupérer la totalité de son chakra, ici tout le monde peut activer son mode hyper et cela sans consommer le chakra, mais la limite des 10 tours, elle, reste présente.
- Un objet magique qui permet d''activer son mode hyper en même temps que quelqu''un d''autre.
- Autorisation du MJ selon la situation.

## Mode Hyper 100%

Il s''agit d''un état plus puissant du Mode Hyper de base, dans cet état, le lanceur se concentre pour renfermer l''aura de chakra qui déferle en mode Hyper. Une fois scellée à l''intérieur de son corps, la puissance du lanceur est à son paroxysme.

L''appellation "100%" vient du fait que le lanceur est à pleine puissance tant que l''aura est enfouie en lui, ainsi de nouveaux bonus s''offrent à lui en 100% :

- Le Chakra ne s''évapore plus.
- Toutes les postures sont activées et ne possèdent plus d''inconvénients.
- Tous les sorts peuvent être surchargés (leur donnant 1d de dégâts en plus)
- Toutes les attaques physiques et magiques infligent +10 dégâts en plus du mode hyper d''avant.

En revanche, l''état 100% ne peut pas être conservé éternellement, il ne dure que 3 tours et après le lanceur revient dans le Mode Hyper normal, consommant au passage 75% de son Chakra Max (Prudence, si vous n''avez pas 75% de Chakra courant en réserve, le manque sera pris dans les PV).

Le Mode Hyper 100% n''est disponible qu''au niveau 10 de personnage.

## Effets selon la magie ou le type

| Magie/Type | Mono magie | Bi magie |
| --- | --- | --- |
| Général | Immunité à la magie innée | Très résistant aux deux magies |
| Général | Dégâts de la magie +15 | Dégâts de la magie +7 |
| Général | Dégâts physiques +15 | Dégâts physiques +15 |
| Général | Soin magique +15 | Soin magique +15 |
| Général | Consommation de chakra = 0 | Consommation de chakra = 0 |
| Potentiel illimité | Dégâts physiques neutres, Résistance à la magie | Dégâts physiques neutres, Résistance à la magie |
| Sang | Permet de récupérer 10 sang par tour au lieu de 1. | Divise par 2 le coût en sang pour les sorts. |
| Arcane | Les sorts amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |
| Corruption | Le chakra active directement les effets secondaires | Divise par 2 le cout en corruption des sorts. |
| Temps/Espace | Donne l''état "Célérité" (voir le sort lvl 4) pendant le mode hyper, le sort portail passe à ICx3 et le sort téléportation passe à ICx2. | Donne l''état "Image diffuse" (voir le sort lvl 4) pendant le mode hyper, les clones se rechargent à hauteur de 1 par tour. |
| Vide | Impose un désavantage (jette 2d100, garde le moins bon) aux ennemis qui tentent des attaques contre lui. | Impose un désavantage (jette 2d100, garde le moins bon) à la première attaque tentée contre lui. |
| Nécromancie | Permet d''avoir deux invocations au lieu d''une seule. Passe le sort animation de mort en IC (ICx2 si jamais il est déjà en ic) | Permet d''avoir deux invocations au lieu d''une seule. |
| Feu | (Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/tour) | (Réaction) Lors d''une agression, permet de répondre par une contre-attaque magique de l''élément feu qui infligera 2d6/NPM dégâts. (1 fois/3 tours) |
| Eau | L''utilisateur du mode hyper est considéré comme une source d''eau pour lui et ses alliés.<br>La première attaque subie réduit ses dégâts finaux de 20%. | L''utilisateur du mode hyper est considéré comme une source d''eau QUE pour lui.<br>La première attaque subie réduit ses dégâts finaux de 20%. |
| Glace | L''armure magique (AM) de base augmente de 25. | L''armure magique (AM) de base augmente de 10. |
| Terre | L''armure physique (AP) de base augmente de 25. | L''armure physique (AP) de base augmente de 10. |
| Vent | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts qui va ignorer les AP et AM sur 8 cases de distance. Dégâts non élémentaires. | Chaque attaque physique libère une lame de vent blanche qui inflige 1d6/NPM de dégâts sur 6 cases de distance. Dégâts non élémentaires. |
| Foudre | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts qui va ignorer les AM et AP. Dégâts non élémentaires. | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 1d8/NPM de dégâts. Dégâts non élémentaires. |
| Lumière | Les soins et les protections deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, un soin ou une protection est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |
| Ombre | Les sorts entraves deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, une entrave est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |

## Effets selon la race

| Race | Effet |
| --- | --- |
| Humain | 1d de dégâts en plus pour toutes les attaques produites, +2 à la Vitesse et les altérations d''états "peur", "fatigue" et "couardise" ne fonctionnent pas." |
| Elfe forestier | Chaque test d''Agilité se fait à 95% et impossible d''imposer de malus dessus. |
| Elfe noir | Permet de synthétiser un poison unique sur l''arme principale, inflige "poison 1" pendant tout le monde hyper. L''ennemi doit faire un jet de vigueur tous les débuts de tour pour ne pas encaisser les dégâts. |
| Elfe argenté | Toutes les attaques magiques sont imparables. |
| Elfe doré | Les sorts infligent un stade au-dessus de leur altération d''état. |
| Farfadet | Permet d''avoir accès à tous les sorts de votre/vos magies, qui correspond à votre niveau puissance magique et inférieur. |
| Felfe | Peut voler, les dégâts et soins magiques sont augmentés de 2d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2. |
| Nain | 2d de dégâts physiques en plus. Le sort malédiction ne marche. |
| Majin | La portée des attaques augmente de 2. |
| Hujin | Diminue d''un cran les dés des attaques physiques ou magiques subies |
| Drakos | (Action) Permet une attaque de souffle de l''élément de la magie innée, inflige 3d6/NPM dégâts et possède une portée de 4. Elle ne bénéficie pas des boosts de dégâts donnés par le mode hyper ou autre (mais est influencée par les postures). Demande un jet qui est choisi entre toutes les compétences d''attaques disponibles. |
| Mort-vivant | Régénère 20% de santé au début de son tour. |
| Orios | Chaque test de Force se fait à 95% et impossible d''imposer de malus dessus, immunisé aux peurs. |
| Drassah''thac | Permet de relancer un jet de dés (alliés, ennemis, soi-même), peu importe la nature (2 fois/Mode Hyper). |
| Fenrir | Chaque test de Perception se fait à 95% et impossible d''imposer de malus dessus, impossible de prendre d''attaques surprises, cachées ou sournoises. |
| Kitsune | Choisit quand il commence le tour de jeu. |
| Olwman | Peut se déplacer gratuitement de 2 cases et ce n''importe quand durant le tour. (1 fois par tour) |
| Rokh | Chaque attaque physique ou magique se suit d''un appel d''une [Élément Innée] blanche [dégâts non élémentaires] qui inflige +1dx\* de dégâts en plus. \*le dégât est calqué sur le dégâts de l''arme ou du sort utilisé |
| Minotaure | Les coups avec les cornes ou sabots infligent 20% des PV actuels à la cible (une seule fois par mode hyper). |
| Namazus | La prochaine attaque avec une arme inflige "saignement 1" pendant tout le mode hyper. L''ennemi doit faire un jet de vigueur tous les débuts de tour pour ne pas encaisser les dégâts. |
| Satyre | Impose un malus de 10% (augmente de 5% au niveau 10 global) à tous les jets des ennemis dans un rayon de 5 cases ou moins. |
| Médusain | Chaque attaque physique va se suivre d''un tentacule qui touche la cible et lui inflige l''altération d''état malgré la protection. |
| Lamia | Permet de cracher un venin à 3PO qui est capable d''empoisonner et de paralyser pendant 3 tours, oblige 2 jets de vigueur pour résister aux deux effets. |
| Jackalope | +3 Vitesse |
| Marcass | Les AP et AM naturels s’ajoutent à toute réduction de dégâts, quel que soit le type d’attaque. |
| Anansi | Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière à la cible \| Nécromancie= Inflige Poison 1 automatiquement \| Ombre = Réduit de 5 l''initiative de la cible touchée pour le prochain tour |
| Goleois | Augmente les dégâts de tous les alliés de 5, le temps du mode hyper. |

*Le classeur « Magie Maverick V8 » contient, dans un onglet masqué, une autre liste des effets du mode hyper (page « Mode Hyper (Magie) ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*', 'neutre', NULL, 'page', '{"id":"guide/liste-des-effets-mode-hyper"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 714, 'guide', 'Pages de référence', 'Liste des effets mode super', 'Texte', 'modifie', '"Ne faire plus qu''un avec son objet"

## Qu''est ce que c''est ?

C''est un équivalent du mode hyper mais en moins puissant. Au lieu de faire une symbiose avec soi même, c''est une symbiose avec un objet légendaire ou enchanté comme une arme, une armure, ou autre. Comme pour le mode hyper, l''aura magique se déferle et les attributs magiques changent du à la magie mais aussi du à l''arme et à son "concept".

Il est nécessaire au porteur de l''arme de réussir à attendre une parfaite harmonie avec son objet pour ne faire plus qu''un avec ce dernier. Les maîtres du jeu seront seul juge de ça.

Tout comme le mode hyper, le mode super est limité dans le temps, au maximum un nombre de tours équivalent au niveau global divisé par 2. Contrairement au mode hyper, il n''y a pas de possibilité d''aller au delà des limites mais il est possible d''activer le mode super malgré que quelqu''un utilise son mode hyper ou super. Il est nécessaire d''attendre 1 semaine pour que le mode super soit de nouveau disponible (comme pour le mode hyper) et il est possible d''utiliser le mode hyper et super dans le même combat, pas en même temps.

## Bonus du Mode Super

Le mode super donne des bonus non négligeable au combat, il donne un bonus de +10 aux dégâts physique ainsi qu''un effet actif et passif selon l''objet avec lequel vous entrez en symbiose.

## Objets

| Objet | Effets mode super | Description/apparence |
| --- | --- | --- |
| 400.0 | Effet passif =<br>Effet actif = |  |
| Bardiche du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Bâton de la destruction | Effet passif =<br>Effet actif = |  |
| Champicer | Effet passif = Les 10 premiers dégâts de chaque tour sont annulé.<br>Effet actif = Permet de lancer une infection qui va pomper 1d4/NPM santé et chakra pendant 3 tours. (2 fois/combat) (non cumulable) | Le porteur va avoir des myriade de champignon sur tout le corps qui vont le protéger des premiers dégâts. |
| Croc du volcan | Effet passif =<br>Effet actif = |  |
| Excalibur/ Joyeuse | Effet passif = Réduit l''échec critique de 1%<br>Effet actif = Donne un boost de +5 à tout les dégâts des alliés pendant 2 tours. (2 fois/combat) | La peau du porteur va posséder les mêmes couleurs qu''excalibur ou de joyeuse, comme si il était l''arme. |
| Foudre étincellante | Effet passif = La cible qui se prend un coup de l''arme va voir son initiative réduit de 2 au prochain tour.<br>Effet actif = Permet de diffuser une électricité sur un cercle de 5 autour du lanceur qui infligera 1d8/NPM dégâts sur les ennemis et soignera de la même chose pour les alliées. (2 fois/combat) | Le porteur va être envahi d''une électricité blanche et brillante, comme si son armure était fait de cette même électricité. Le lanceur peut utiliser cette dernière pour attaquer ces ennemis et soigner ses alliés dans une attaque globale. |
| Guérriseur | Effet passif =<br>Effet actif = |  |
| Hache du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Lame-seuil | Effet passif =<br>Effet actif = |  |
| Lame de fer | Effet passif =<br>Effet actif = |  |
| Lance du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Selcalibur | Effet passif = +3AP base et +3AM base<br>Effet actif = Permet de lancer du sel sur l''adversaire, ce qui va réduire sa résistance à la Terre et à l''Eau de 1 cran pendant 2 tour. (2 fois/combat) | Le porteur de selcalibur voit son corps se recouvrir de plaque de sel solide ce qui augmente ses défenses, il est aussi capable de lancer du sel sur l''adversaire. |
| Soir-matin | Effet passif =<br>Effet actif = |  |
| Super gemme | Effet passif = Les dégâts de l''élément de la gemme augmente de +10 au lieu de +7.<br>Effet actif = Permet de lancer un sort un cran au dessus de la puissance magique actuelle pour un coût 50% plus chère (sort lvl 5 limité au mono magie) (1 fois/24h) | Le porteur fusionne avec la gemme temporairement pour exploiter sa pleine puissance. La super gemme sortira légèrement du dos de l''utilisateur. Les attributs physiques vont énormément changer et la chair va être temporairement de la même matière que la gemme à certains endroits. |', '"Ne faire plus qu''un avec son objet"

## Qu''est-ce que c''est ?

C''est un équivalent du mode hyper mais en moins puissant. Au lieu de faire une symbiose avec soi-même, c''est une symbiose avec un objet légendaire ou enchanté comme une arme, une armure, ou autre. Comme pour le mode hyper, l''aura magique se déferle et les attributs magiques changent dû à la magie mais aussi dû à l''arme et à son "concept".

Il est nécessaire au porteur de l''arme de réussir à attendre une parfaite harmonie avec son objet pour ne faire plus qu''un avec ce dernier. Les maîtres du jeu seront seuls juges de ça.

Tout comme le mode hyper, le mode super est limité dans le temps, au maximum un nombre de tours équivalent au niveau global divisé par 2. Contrairement au mode hyper, il n''y a pas de possibilité d''aller au-delà des limites mais il est possible d''activer le mode super malgré que quelqu''un utilise son mode hyper ou super. Il est nécessaire d''attendre 1 semaine pour que le mode super soit de nouveau disponible (comme pour le mode hyper) et il est possible d''utiliser le mode hyper et super dans le même combat, pas en même temps.

## Bonus du Mode Super

Le mode super donne des bonus non négligeables au combat, il donne un bonus de +10 aux dégâts physiques ainsi qu''un effet actif et passif selon l''objet avec lequel vous entrez en symbiose.

## Objets

| Objet | Effets mode super | Description/apparence |
| --- | --- | --- |
| 400.0 | Effet passif =<br>Effet actif = |  |
| Bardiche du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Bâton de la destruction | Effet passif =<br>Effet actif = |  |
| Champicer | Effet passif = Les 10 premiers dégâts de chaque tour sont annulés.<br>Effet actif = Permet de lancer une infection qui va pomper 1d4/NPM santé et chakra pendant 3 tours. (2 fois/combat) (non cumulable) | Le porteur va avoir des myriades de champignons sur tout le corps qui vont le protéger des premiers dégâts. |
| Croc du volcan | Effet passif =<br>Effet actif = |  |
| Excalibur/ Joyeuse | Effet passif = Réduit l''échec critique de 1%<br>Effet actif = Donne un boost de +5 à tous les dégâts des alliés pendant 2 tours. (2 fois/combat) | La peau du porteur va posséder les mêmes couleurs qu''Excalibur ou de Joyeuse, comme s''il était l''arme. |
| Foudre étincelante | Effet passif = La cible qui se prend un coup de l''arme va voir son initiative réduite de 2 au prochain tour.<br>Effet actif = Permet de diffuser une électricité sur un cercle de 5 autour du lanceur qui infligera 1d8/NPM dégâts sur les ennemis et soignera de la même chose pour les alliées. (2 fois/combat) | Le porteur va être envahi d''une électricité blanche et brillante, comme si son armure était faite de cette même électricité. Le lanceur peut utiliser cette dernière pour attaquer ses ennemis et soigner ses alliés dans une attaque globale. |
| Guérisseur | Effet passif =<br>Effet actif = |  |
| Hache du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Lame-seuil | Effet passif =<br>Effet actif = |  |
| Lame de fer | Effet passif =<br>Effet actif = |  |
| Lance du Bourreau déchiré | Effet passif =<br>Effet actif = |  |
| Selcalibur | Effet passif = +3AP base et +3AM base<br>Effet actif = Permet de lancer du sel sur l''adversaire, ce qui va réduire sa résistance à la Terre et à l''Eau de 1 cran pendant 2 tours. (2 fois/combat) | Le porteur de Selcalibur voit son corps se recouvrir de plaque de sel solide ce qui augmente ses défenses, il est aussi capable de lancer du sel sur l''adversaire. |
| Soir-matin | Effet passif =<br>Effet actif = |  |
| Super gemme | Effet passif = Les dégâts de l''élément de la gemme augmentent de +10 au lieu de +7.<br>Effet actif = Permet de lancer un sort un cran au-dessus de la puissance magique actuelle pour un coût 50% plus cher (sort lvl 5 limité au mono magie) (1 fois/24h) | Le porteur fusionne avec la gemme temporairement pour exploiter sa pleine puissance. La super gemme sortira légèrement du dos de l''utilisateur. Les attributs physiques vont énormément changer et la chair va être temporairement de la même matière que la gemme à certains endroits. |', 'neutre', NULL, 'page', '{"id":"guide/liste-des-effets-mode-super"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 715, 'guide', 'Pages de référence', 'Météo', 'Texte', 'modifie', '## Normal

**Description** : Une météo neutre offre un ciel dégagé parsemé de quelques nuages, où aucun élément ne prend le dessus. La magie y reste stable. Dans cet équilibre parfait, seuls le talent et l’expérience du combattant font la différence.

**Effet(s)**

- Aucun effet

## Grand Soleil

**Description** : Un grand soleil inonde le ciel d’une lumière éclatante, réchauffant l’air et éclairsisant fort bien la zone.

**Effet(s)**

- Élément Lumière = +6 dégâts, +6 Soin
- Élément Feu = +5 dégâts
- Élément Glace = -5 dégâts
- Élément Ombre = -5 Dégâts
- Avantage (lance 2d100 = gardez le meilleur résultat) sur les jets de méditation et de calme

## Canicule

**Description** : Une canicule écrasante s’abat sur le paysage, l’air brûlant rendant chaque souffle plus difficile. Sous cette chaleur oppressante, même les plus résistants peinent à maintenir leur énergie.

**Effet(s)**

- Élément Feu = +10 dégâts
- Élément Lumière = +5 dégâts, +5 Soin
- Élément Glace = -10 dégâts
- Élément Ombre = -5 dégâts
- Élément Vent = -5 dégâts
- Vigueur et Fermeté -5% (sauf les magies avantagées)

## Pluie

**Description** : Une pluie régulière tombe du ciel, rafraîchissant l’air et imbibant le sol d’humidité.

**Effet(s)**

- Élément Eau = +5 dégâts, +5 Soin
- Élément Terre = +2 dégâts
- Élément Glace = +2 dégâts
- Élément Foudre = -5 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -1

## Pluie diluvienne

**Description** : Une pluie diluvienne s’abat avec force, transformant le sol en bourbier et réduisant la visibilité. Le vent et l’humidité perturbent également les incantations, rendant tout affrontement plus chaotique.

**Effet(s)**

- Élément Eau = +10 dégâts
- Élément Terre = +5 dégâts
- Élément Foudre = -10 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -2

## Neige

**Description** : Une fine neige recouvre lentement le paysage, apportant un froid mordant et un silence feutré. Chaque pas devient plus difficile, rendant les déplacements plus lents et méthodiques.

**Effet(s)**

- Élément Glace  = +5 dégâts, +5 Soin
- Élément Eau = +2 dégâts
- Élément Ombre = +2 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Initiative -2 (sauf les magies avantagées)

## Tempête de neige

**Description** : Une tempête de neige déchaîne vents glacés et flocons cinglants, réduisant la visibilité à quelques mètres. Le blizzard rend les déplacements périlleux, exposant les imprudents à un destin gelé.

**Effet(s)**

- Élément Glace  = +10 dégâts
- Élément Ombre = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Initiative -3 (sauf les magies avantagées)
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)

## Vent violent

**Description** : Un vent violent balaie la zone, hurlant à travers les obstacles et rendant l’air instable. Les rafales imprévisibles mettent à l’épreuve même les combattants les plus aguerris

**Effet(s)**

- Élément Vent = +10 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Élément Glace = -5 dégâts
- Élément Terre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme à DISTANCE

## Brouillard

**Description** : Un brouillard dense enveloppe le paysage, noyant les formes dans un voile laiteux. Dans cette obscurité diffuse, seuls les plus rusés tirent avantage de l’incertitude ambiante.

**Effet(s)**

- Élément Nécromancie = +5 dégâts
- Élément Eau = +2 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 10% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Purée de poix

**Description** : Une purée de poix impénétrable noie le monde dans une obscurité quasi totale, étouffant sons et lumières. Seuls ceux dotés d’un sens aiguisé peuvent naviguer sans errer à l’aveugle.

**Effet(s)**

- Élément Nécromancie = +10 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 20% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Brouillard obscur

**Description** : Un brouillard obscur s’étend comme une ombre vivante, absorbant la lumière et troublant les sens. Dans cette nuit artificielle, la peur et l’incertitude deviennent des armes redoutables.

**Effet(s)**

- Élément Ombre = +5 dégâts
- Élément Lumière = -5 dégâts
- Les attaques ont un malus de 25% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Orage

**Description** : Un orage éclate, zébrant le ciel d’éclairs aveuglants tandis que le tonnerre gronde avec une puissance assourdissante. Chaque instant peut voir la fureur céleste frapper sans avertissement.

**Effet(s)**

- Élément Foudre = +10 dégâts
- Élément  Espace/Temps = +5 dégâts
- Élément Terre = -5 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Une foudre naturelle tombe tout les 2 tours, touche aléatoirement une cible (allié comme ennemi) qui inflige 20 de dégâts

## Champ magnétique

**Description** : Un champ magnétique invisible sature l’air d’une énergie étrange, troublant les flux magiques et les perceptions. Les boussoles s’affolent, et même les plus expérimentés peinent à comprendre où est la gauche et la droite.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Espace/Temps = +2 dégâts
- Élément Foudre = +2 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Portée maximum des armes à distance = +2

## Tempête de sable

**Description** : Une tempête de sable déchaîne des vents furieux, soulevant un mur de particules abrasives qui réentrent dans les vêtements et armures.  Chaque souffle est une lutte, et seuls les plus résistants parviennent à avancer sans faillir.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Vent = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)
- Inflige 1d6 dégâts (ignore les AM et AP) à tous le monde (sauf les magies avantagées)

## Lune de sang

**Description** : Une lune de sang s’élève dans le ciel, baignant le monde d’une lueur rouge inquiétante. Sous ce présage funeste, les instincts primaires s’éveillent, et la frontière entre chasseur et proie s’amenuise.

**Effet(s)**

- Élément Sang = +10 dégâts
- Élément Nécromancie = -5 dégâts
- Ceux qui ont la magie du Sang récupère 2 Sang au lieu de 1 par tour
- Les monstres et les vampires ont un bonus de +5 à tout leurs dégâts et +2 à l''initiative
- La rage de la classe "Martiale" et "Goleois" dure 1 tour de plus

## Éclipse

**Description** : Une éclipse plonge le monde dans une obscurité surnaturelle, où la lumière du soleil est totalement occultée. Ce phénomène étrange agit fort sur les magies d''Ombre et de Lumière.

**Effet(s)**

- Élément Ombre = (TOUR PAIR) +10 dégâts \| (TOUR IMPAIR) -10 dégâts
- Élément Glace = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Nécromancie = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Lumière = (TOUR PAIR) -10 dégâts \| (TOUR IMPAIR) +10 dégâts
- Élément Feu = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts
- Élément Sang = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts

## Crachin Blanc

**Description** : Un crachin blanc tombe doucement, enveloppant le monde d’une fine couche de chakra pure. Cette petite brume pousse le chakra des combattant à son paroxysme et permet d''énorme prouesse.

**Effet(s)**

- Magie Arcane = +5 dégâts
- Chakra illimité
- Le mode hyper n''est plus limité à un être sur le terrain
- Divise la corruption par 2

## Pluie pétrole

**Description** : Une pluie de pétrole tombe du ciel, noire et épaisse, recouvrant tout d’une couche glissante , infligeant de la corruption à tout le monde.

**Effet(s)**

- Magie Corruption = +5 dégâts
- Toutes les autres magies = -3 dégâts
- Lors du premier tour de la météo uniquement = -25% de chakra pour tout ceux qui ne sont pas de la Corruption
- +2 Corruption par tour

## Saccage temporel

**Description** : Un saccage temporel déchire le tissu de la réalité, distordant le temps et créant des décalages où passé, présent et futur s’entrelacent de façon chaotique. Les logiques de vitesse, portée et même initiative sont inversé dans ce chaos.

**Effet(s)**

- Élément Vide = +10 dégâts
- La magie de l''Espace/Temps ne fonctionne pas (soutien/attaque)
- La portée maximale des armes distance devient la minimale
- La vitesse sol et nage s''inverse (minimum 1 pour ceux qui ont un 0 quelque part)
- C''est l''initiative la plus basse qui commence à jouer et non la plus haute

## Zone vide

**Description** : Une zone vide s’étend, dénuée de toute énergie magique, où l’air semble étrangement calme et figé. Aucune magie ne fonctionne dans cette zone.

**Effet(s)**

- La Magie ne fonctionne pas.
- La Météo ne peut pas être modifié le temps de cette météo.
- Les armes aux dégâts magiques ne fonctionnent pas (effets et dégâts)
- Les armures magiques ne fonctionne pas (effets, AP et AM)', '## Normal

**Description** : Une météo neutre offre un ciel dégagé parsemé de quelques nuages, où aucun élément ne prend le dessus. La magie y reste stable. Dans cet équilibre parfait, seuls le talent et l’expérience du combattant font la différence.

**Effet(s)**

- Aucun effet

## Grand Soleil

**Description** : Un grand soleil inonde le ciel d’une lumière éclatante, réchauffant l’air et éclaircissant fort bien la zone.

**Effet(s)**

- Élément Lumière = +6 dégâts, +6 Soin
- Élément Feu = +5 dégâts
- Élément Glace = -5 dégâts
- Élément Ombre = -5 Dégâts
- Avantage (lance 2d100 = gardez le meilleur résultat) sur les jets de méditation et de calme

## Canicule

**Description** : Une canicule écrasante s’abat sur le paysage, l’air brûlant rendant chaque souffle plus difficile. Sous cette chaleur oppressante, même les plus résistants peinent à maintenir leur énergie.

**Effet(s)**

- Élément Feu = +10 dégâts
- Élément Lumière = +5 dégâts, +5 Soin
- Élément Glace = -10 dégâts
- Élément Ombre = -5 dégâts
- Élément Vent = -5 dégâts
- Vigueur et Fermeté -5% (sauf les magies avantagées)

## Pluie

**Description** : Une pluie régulière tombe du ciel, rafraîchissant l’air et imbibant le sol d’humidité.

**Effet(s)**

- Élément Eau = +5 dégâts, +5 Soin
- Élément Terre = +2 dégâts
- Élément Glace = +2 dégâts
- Élément Foudre = -5 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -1

## Pluie diluvienne

**Description** : Une pluie diluvienne s’abat avec force, transformant le sol en bourbier et réduisant la visibilité. Le vent et l’humidité perturbent également les incantations, rendant tout affrontement plus chaotique.

**Effet(s)**

- Élément Eau = +10 dégâts
- Élément Terre = +5 dégâts
- Élément Foudre = -10 dégâts
- Élément Nécromancie = -5 dégâts
- Portée maximum des armes à distance = -2

## Neige

**Description** : Une fine neige recouvre lentement le paysage, apportant un froid mordant et un silence feutré. Chaque pas devient plus difficile, rendant les déplacements plus lents et méthodiques.

**Effet(s)**

- Élément Glace  = +5 dégâts, +5 Soin
- Élément Eau = +2 dégâts
- Élément Ombre = +2 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Initiative -2 (sauf les magies avantagées)

## Tempête de neige

**Description** : Une tempête de neige déchaîne vents glacés et flocons cinglants, réduisant la visibilité à quelques mètres. Le blizzard rend les déplacements périlleux, exposant les imprudents à un destin gelé.

**Effet(s)**

- Élément Glace  = +10 dégâts
- Élément Ombre = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Initiative -3 (sauf les magies avantagées)
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)

## Vent violent

**Description** : Un vent violent balaie la zone, hurlant à travers les obstacles et rendant l’air instable. Les rafales imprévisibles mettent à l’épreuve même les combattants les plus aguerris

**Effet(s)**

- Élément Vent = +10 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Élément Glace = -5 dégâts
- Élément Terre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme à DISTANCE

## Brouillard

**Description** : Un brouillard dense enveloppe le paysage, noyant les formes dans un voile laiteux. Dans cette obscurité diffuse, seuls les plus rusés tirent avantage de l’incertitude ambiante.

**Effet(s)**

- Élément Nécromancie = +5 dégâts
- Élément Eau = +2 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 10% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Purée de pois

**Description** : Une purée de pois impénétrable noie le monde dans une obscurité quasi totale, étouffant sons et lumières. Seuls ceux dotés d’un sens aiguisé peuvent naviguer sans errer à l’aveugle.

**Effet(s)**

- Élément Nécromancie = +10 dégâts
- Élément Lumière = -5 dégâts
- Élément Sang = -5 dégâts
- Les attaques ont un malus de 20% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Brouillard obscur

**Description** : Un brouillard obscur s’étend comme une ombre vivante, absorbant la lumière et troublant les sens. Dans cette nuit artificielle, la peur et l’incertitude deviennent des armes redoutables.

**Effet(s)**

- Élément Ombre = +5 dégâts
- Élément Lumière = -5 dégâts
- Les attaques ont un malus de 25% au jet si la cible n''est pas au corps à corps (sauf les magies avantagées)

## Orage

**Description** : Un orage éclate, zébrant le ciel d’éclairs aveuglants tandis que le tonnerre gronde avec une puissance assourdissante. Chaque instant peut voir la fureur céleste frapper sans avertissement.

**Effet(s)**

- Élément Foudre = +10 dégâts
- Élément  Espace/Temps = +5 dégâts
- Élément Terre = -5 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Une foudre naturelle tombe tous les 2 tours, touche aléatoirement une cible (allié comme ennemi) qui inflige 20 de dégâts

## Champ magnétique

**Description** : Un champ magnétique invisible sature l’air d’une énergie étrange, troublant les flux magiques et les perceptions. Les boussoles s’affolent, et même les plus expérimentés peinent à comprendre où est la gauche et la droite.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Espace/Temps = +2 dégâts
- Élément Foudre = +2 dégâts
- Élément Vent = -5 dégâts
- Élément Eau = -5 dégâts
- Portée maximum des armes à distance = +2

## Tempête de sable

**Description** : Une tempête de sable déchaîne des vents furieux, soulevant un mur de particules abrasives qui réentrent dans les vêtements et armures.  Chaque souffle est une lutte, et seuls les plus résistants parviennent à avancer sans faillir.

**Effet(s)**

- Élément Terre = +10 dégâts
- Élément Vent = +5 dégâts
- Élément Feu = -5 dégâts
- Élément Foudre = -5 dégâts
- Chaque case qui vous sépare de votre cible vous impose un malus de 5% à votre jet d''attaque avec votre arme ou votre sort (sauf les magies avantagées)
- Inflige 1d6 dégâts (ignore les AM et AP) à tout le monde (sauf les magies avantagées)

## Lune de sang

**Description** : Une lune de sang s’élève dans le ciel, baignant le monde d’une lueur rouge inquiétante. Sous ce présage funeste, les instincts primaires s’éveillent, et la frontière entre chasseur et proie s’amenuise.

**Effet(s)**

- Élément Sang = +10 dégâts
- Élément Nécromancie = -5 dégâts
- Ceux qui ont la magie du Sang récupèrent 2 Sang au lieu de 1 par tour
- Les monstres et les vampires ont un bonus de +5 à tous leurs dégâts et +2 à l''initiative
- La rage de la classe "Martiale" et "Goleois" dure 1 tour de plus

## Éclipse

**Description** : Une éclipse plonge le monde dans une obscurité surnaturelle, où la lumière du soleil est totalement occultée. Ce phénomène étrange agit fort sur les magies d''Ombre et de Lumière.

**Effet(s)**

- Élément Ombre = (TOUR PAIR) +10 dégâts \| (TOUR IMPAIR) -10 dégâts
- Élément Glace = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Nécromancie = (TOUR PAIR) +5 dégâts \| (TOUR IMPAIR) -5 dégâts
- Élément Lumière = (TOUR PAIR) -10 dégâts \| (TOUR IMPAIR) +10 dégâts
- Élément Feu = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts
- Élément Sang = (TOUR PAIR) -5 dégâts \| (TOUR IMPAIR) +5 dégâts

## Crachin Blanc

**Description** : Un crachin blanc tombe doucement, enveloppant le monde d’une fine couche de chakra pure. Cette petite brume pousse le chakra des combattants à son paroxysme et permet d''énormes prouesses.

**Effet(s)**

- Magie Arcane = +5 dégâts
- Chakra illimité
- Le mode hyper n''est plus limité à un être sur le terrain
- Divise la corruption par 2

## Pluie pétrole

**Description** : Une pluie de pétrole tombe du ciel, noire et épaisse, recouvrant tout d’une couche glissante , infligeant de la corruption à tout le monde.

**Effet(s)**

- Magie Corruption = +5 dégâts
- Toutes les autres magies = -3 dégâts
- Lors du premier tour de la météo uniquement = -25% de chakra pour tous ceux qui ne sont pas de la Corruption
- +2 Corruption par tour

## Saccage temporel

**Description** : Un saccage temporel déchire le tissu de la réalité, distordant le temps et créant des décalages où passé, présent et futur s’entrelacent de façon chaotique. Les logiques de vitesse, portée et même initiative sont inversées dans ce chaos.

**Effet(s)**

- Élément Vide = +10 dégâts
- La magie de l''Espace/Temps ne fonctionne pas (soutien/attaque)
- La portée maximale des armes distance devient la minimale
- La vitesse sol et nage s''inverse (minimum 1 pour ceux qui ont un 0 quelque part)
- C''est l''initiative la plus basse qui commence à jouer et non la plus haute

## Zone vide

**Description** : Une zone vide s’étend, dénuée de toute énergie magique, où l’air semble étrangement calme et figé. Aucune magie ne fonctionne dans cette zone.

**Effet(s)**

- La Magie ne fonctionne pas.
- La Météo ne peut pas être modifiée le temps de cette météo.
- Les armes aux dégâts magiques ne fonctionnent pas (effets et dégâts)
- Les armures magiques ne fonctionnent pas (effets, AP et AM)', 'neutre', NULL, 'page', '{"id":"guide/meteo"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 716, 'guide', 'Pages de référence', 'Mode Hyper (Magie)', 'Texte', 'modifie', '*Onglet masqué du classeur d''origine.*

*Le classeur « Mode hyper et co » contient une autre liste des effets du mode hyper (page « Liste des effets mode hyper ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*

## Avantages de base

+10 Dégâts Physique, +10 Soins, La consommation de Chakra passe à 0

| Mono magie | Bi magie |
| --- | --- |
| +10 dégâts de l''élément de la magie. Immunité à la magie en question | +5 dégâts de l''élément des deux magie. Très résistant aux deux magies en question |

## Effets par magie seule

| Magie | Effet |
| --- | --- |
| Sang | Sang infini (limite d''utilisation en 1 tour = 10). |
| Arcane | Quand une arme est forgée, elle ne se casse plus au premier coup et inflige un bonus de +15 aux dégâts, les armes peuvent être forgées même si vous n''avez pas le sort. |
| Corruption | Quand une arme est forgée, elle ne se casse plus au premier coup et inflige un bonus de +15 aux dégâts, les armes peuvent être forgées même si vous n''avez pas le sort. |
| Temps/Espace | Donne l''état "Célérité" pendant le mode hyper et le sort portail passe à 4 IC (Instant Cast). |
| Nécromancie | Permet d''invoquer 2 morts vivants au lieu d''un seul. |
| Vide | Le corps devient partiellement immatériel, oblige le jet d''un dé de chance pour voir si le coup passe ou traverse complètement la cible. |
| Feu | Un bouclier de feu apparaît et empêche d''approcher tout en infligeant 3d8 de dégâts de feu à toute créature assez folle pour approcher. |
| Eau | Boire l''eau produite par un mage d''eau en Mode Hyper soigne 3d6/niveau de magie et retire l''effet poison. |
| Glace | Double la résistance magique totale (bonus compris). |
| Terre | Double les points d''armure totale (bonus compris). |
| Vent | Chaque attaque physique libère une lame de vent blanche qui inflige 2d6 de dégâts/niveau de magie sur 8 cases de distance. Dégâts non élémentaire. |
| Foudre | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 3d6 de dégâts/niveau de magie. Dégâts non élémentaire. |
| Lumière | Les soins deviennent des IC (Instant Cast) et sont au maximum de leur effet. |
| Ombre | Les effets négatifs sont doublés. |

## Effets par combinaison de deux magies

| Magies | Effet |
| --- | --- |
| Sang + Vide | La pression sanguine augmente -2 INI pour les ennemis et +2 pour les alliés le temps du monde hyper |
| Sang + Feu | Le sang boue et double les effets de rage et l''ajoute si nécéssaire |
| Sang + Eau | Soigne de 2d8 tout les alliés sauf soi même par tour et inflige saignements aux adversaires |
| Sang + Glace | Le sang gèle donnant +8 en RM et immunise contre le saignement et l''empoisonnement |
| Sang + Terre | Le Fer contenu dans le sang se solidie pour donner +8 PA et +8 dégats aux armes utilisant la caractéristique Force |
| Sang + Vent | Vous projettez votre propre sang sur les yeux de vos ennemis inflige l''état Aveuglement et invoque 1d4 d''oiseaux charognards qui cibleront vos ennemis |
| Sang + Foudre | Le sang s''électrise chaque déplacement est un sprint sans jet et permet d''effectuer une action |
| Sang + Lumière | Votre sang brille et vous immunise aux altérations d''état |
| Sang + Ombre | L''ombre des ennemis les trahissent et les les poignardent : Inflige 1d8 + Saignement |
| Arcane + Vide | Rend les armes éthérées et ignorent les PA" |
| Arcane + Nécromancie | Permet d''invoquer un ou des zombinox (voir catégorie invocation dans bestiaire) |
| Arcane + Feu | Un feu pur et inflige brûlure aux ennemis |
| Arcane + Eau | Boire l''eau produite par un utilisateur d''eau en Mode Hyper rend du Chakra (3d6/niveau de magie) |
| Arcane + Glace | Une armure de glace pure de 8RM qui a 50% de renvoyer les sorts à l''envoyeur |
| Arcane + Terre | Une terre pure est invoquée et une plante carnivore y pousse |
| Arcane + Vent | Un vent pur et tranchant qui fait reculer les ennemis et inflige 2d8 de dégâts |
| Arcane + Foudre | Un orage pur s''abat sur les annemis et inflige 3d6/par niveau de magie sur le Chakra" |
| Arcane + Lumière | Une lumière pure qui inflige l''état confus aux ennemis |
| Arcane + Ombre | Une ombre pure prend votre apparence et vous accompagne" |
| Temps/Espace + Nécromancie | Permet d''invoquer une ou des momies (voir catégorie invocation dans bestiaire) |
| Temps/Espace + Feu | Déplace une pluie d''astéroïde de taille aléatoire sur le champ de bataille sur une zone de 5x5. 2d8 de dégâts |
| Temps/Espace + Eau | Une eau étrange va rajeunir temporairement les alliés et ennemis ajoutant respectivement +1 et -1 aux stats |
| Temps/Espace + Glace | Invoque le souvenir d''une ère glaciale qui force un jet de vigueur au ennemis, si ils ratent leur jet, Gel pendant 3 tours. |
| Temps/Espace + Terre | Un séisme est invoqué et force un jet de Stabilité aux adversaires sinon 2d8 de dgéâts et passe leur tour. |
| Temps/Espace + Vent | Une zone de 5x5 est invoquée où la gravité passe à 0" |
| Temps/Espace + Foudre | Un orage apparaît temporairement et vous avez le choix sur quel impact de foudre vous voulez vous téléportez |
| Temps/Espace + Lumière | Un allié ou vous même reprenez le même état corporel d''avant le combat |
| Temps/Espace + Ombre | Vos adversaires revivent les traumatismes de leur enfance et gagne l''état Peur |
| Vide + Nécromancie | Permet d''invoquer un ou des fantômes (voir catégorie invocation dans bestiaire) |
| Vide + Feu | Les attaques de Feu sont invisibles et applique un malus de 30% pour esquiver ces dernières |
| Vide + Eau | Vous pouvez nager dans le sol avec une grande aisance (+2 Vitesse dans cette "Eau") |
| Vide + Glace | Sur une ligne de 9 cases, créer une barrière de glace de 80 PV et reflète la lumière comme un miroir |
| Vide + Terre | Détériore l''arme d''un ennemi à 1 cran de solidité. Si l''arme n''a qu''à cran l''arme est détruite |
| Vide + Vent | Sur une zone de 5x5 crée un appel d''air qui attire tout le monde vers vous |
| Vide + Foudre | À chaque attaque magique vous vous téléporter devant la cible |
| Vide + Lumière | Un ennemi (sauf "Innerte") vous adule et se joint à votre équipe |
| Vide + Ombre | Les ennemis n''ont plus d''ombre et sont rejetés par le soleil. 10 dégâts par tour d''exposition au soleil (Doublé si Grand Soleil) |
| Nécromancie + Feu | Permet d''invoquer un ou des embrasés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Eau | Permet d''invoquer un ou des noyés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Glace | Permet d''invoquer un ou des os froid (voir catégorie invocation dans bestiaire) |
| Nécromancie + Terre | Permet d''invoquer un ou des squelettes de pierre (voir catégorie invocation dans bestiaire) |
| Nécromancie + Vent | Permet d''invoquer un ou des zompis (voir catégorie invocation dans bestiaire) |
| Nécromancie + Foudre | Permet d''invoquer un ou des réanimés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Lumière | Permet d''invoquer un ou des squelettes rayonnants (voir catégorie invocation dans bestiaire) |
| Nécromancie + Ombre | Permet d''invoquer un ou des zombis obscurs (voir catégorie invocation dans bestiaire) |
| Feu + Eau | Invoque Brouillard pendant l''Hyper et les attaques d''eau inflige l''étât brûlure |
| Feu + Glace | Les sorts boule deviennent des grenade de glace sèche qui infligent Brûlure stade 2 |
| Feu + Terre | Sur une zone de 5x5 le sol devient magmatique et inflige 3d6 à chaque tour ou case traversée |
| Feu + Vent | Vous êtes l''oeil d''une tornade de feu de 3x3. Chaque agression à votre encontre inflige l''état "Brûlure" |
| Feu + Foudre | Un rayon de plasma désintègre 1d2 membres de tout les adversaires présents devant vous (sauf Rempart Fragile) |
| Feu + Lumière | Un feu sacré qui fait 4d8 à un mort-vivant (2d8 pour un vivant) |
| Feu + Ombre | Une flamme noire saute sur un ennemi ciblé affligeant Brûlure et Malédiction jusqu''à que vous changiez de cible |
| Eau + Glace | Une plaque de verglas de 5x5 apparaît et force un jet de stabilité à -x0% (x = Dizaine = nombre de cases traversée)  à chaque déplacement |
| Eau + Terre | Un ennemi se change en arbre infligeant Pétrification stade 2 |
| Eau + Vent | Un siphon destructeur réuni tout les ennemis à un point choisi et inflige 2d8 de dégâts |
| Eau + Foudre | Chaque attaque d''eau à 50% de chance de paralyser |
| Eau + Lumière | Tout les alliés régénèrent 50% de leur barrière |
| Eau + Ombre | Une créature des abysse apparaît à vos cotés |
| Glace + Terre | La permaglace vous recouvre et vous octroie +4 PA +4 RM et vous permet d''être neutre au feu au lieu d''être très vulnérable |
| Glace + Vent | 1d10 de stalactites de glaces seront projetés sur vos ennemis faisant chacun 2d6 de dégâts |
| Glace + Foudre | Invoque 4 piliers de glace connectés par des traits d''électricité. Franchir les barrières infligent 3d6 de dégats |
| Glace + Lumière | Une armure de glace lumineuse de +8 RM vous recouvre et applique un malus de -20% à chaque agression |
| Glace + Ombre | L''ombre des ennemis grelotte et inflige l''étât Gel |
| Terre + Vent | 4 boucliers de terre de 50PV flottent autour de vous |
| Terre + Foudre | Le sol se magnétise et attire armes, armures et boucliers en métal (-1 Vitesse si l''arme dégainée est en métal, pour une armure en métal et -pour un bouclier en métal) |
| Terre + Lumière | Craque le sol et des racines soignes les alliés de 50PV |
| Terre + Ombre | Aspire 2d8 de PV à tout ennemi terrestre |
| Vent + Foudre | Un mini orage apparaît au dessus de chaque ennemi infligeant 10  dégâts par tour |
| Vent + Lumière | Booste tout les jets des alliés de 10% |
| Vent + Ombre | Malus de 10% à tout les jets ennemis |
| Foudre + Lumière | Supprime 50% de la barrière des ennemis |
| Foudre + Ombre | Chaque attaque ponctionnera également le chakra avec les mêmes dégâts |
| Lumière + Ombre | Invoque la météo Éclipse |

## Commentaire de cellule

- **Vide + Nécromancie** (cellule M43) : Sous cette forme, Il est impossible de faire des dégâts physiques et seuls les armes spectrales sont utilisables ainsi que les sorts.

*Commentaire joint à la cellule dans le classeur d''origine, marqué comme résolu.*', '*Onglet masqué du classeur d''origine.*

*Le classeur « Mode hyper et co » contient une autre liste des effets du mode hyper (page « Liste des effets mode hyper ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*

## Avantages de base

+10 Dégâts Physiques, +10 Soins, La consommation de Chakra passe à 0

| Mono magie | Bi magie |
| --- | --- |
| +10 dégâts de l''élément de la magie. Immunité à la magie en question | +5 dégâts de l''élément des deux magies. Très résistant aux deux magies en question |

## Effets par magie seule

| Magie | Effet |
| --- | --- |
| Sang | Sang infini (limite d''utilisation en 1 tour = 10). |
| Arcane | Quand une arme est forgée, elle ne se casse plus au premier coup et inflige un bonus de +15 aux dégâts, les armes peuvent être forgées même si vous n''avez pas le sort. |
| Corruption | Quand une arme est forgée, elle ne se casse plus au premier coup et inflige un bonus de +15 aux dégâts, les armes peuvent être forgées même si vous n''avez pas le sort. |
| Temps/Espace | Donne l''état "Célérité" pendant le mode hyper et le sort portail passe à 4 IC (Instant Cast). |
| Nécromancie | Permet d''invoquer 2 morts-vivants au lieu d''un seul. |
| Vide | Le corps devient partiellement immatériel, oblige le jet d''un dé de chance pour voir si le coup passe ou traverse complètement la cible. |
| Feu | Un bouclier de feu apparaît et empêche d''approcher tout en infligeant 3d8 de dégâts de feu à toute créature assez folle pour approcher. |
| Eau | Boire l''eau produite par un mage d''eau en Mode Hyper soigne 3d6/niveau de magie et retire l''effet poison. |
| Glace | Double la résistance magique totale (bonus compris). |
| Terre | Double les points d''armure totale (bonus compris). |
| Vent | Chaque attaque physique libère une lame de vent blanche qui inflige 2d6 de dégâts/niveau de magie sur 8 cases de distance. Dégâts non élémentaires. |
| Foudre | Toutes les attaques physiques de contact sont enchaînées d''un éclair blanc qui inflige 3d6 de dégâts/niveau de magie. Dégâts non élémentaires. |
| Lumière | Les soins deviennent des IC (Instant Cast) et sont au maximum de leur effet. |
| Ombre | Les effets négatifs sont doublés. |

## Effets par combinaison de deux magies

| Magies | Effet |
| --- | --- |
| Sang + Vide | La pression sanguine augmente -2 INI pour les ennemis et +2 pour les alliés le temps du monde hyper |
| Sang + Feu | Le sang bout et double les effets de rage et l''ajoute si nécessaire |
| Sang + Eau | Soigne de 2d8 tous les alliés sauf soi-même par tour et inflige saignements aux adversaires |
| Sang + Glace | Le sang gèle donnant +8 en RM et immunise contre le saignement et l''empoisonnement |
| Sang + Terre | Le Fer contenu dans le sang se solidifie pour donner +8 PA et +8 dégâts aux armes utilisant la caractéristique Force |
| Sang + Vent | Vous projetez votre propre sang sur les yeux de vos ennemis inflige l''état Aveuglement et invoque 1d4 d''oiseaux charognards qui cibleront vos ennemis |
| Sang + Foudre | Le sang s''électrise chaque déplacement est un sprint sans jet et permet d''effectuer une action |
| Sang + Lumière | Votre sang brille et vous immunise aux altérations d''état |
| Sang + Ombre | L''ombre des ennemis les trahissent et les les poignardent : Inflige 1d8 + Saignement |
| Arcane + Vide | Rend les armes éthérées et ignorent les PA" |
| Arcane + Nécromancie | Permet d''invoquer un ou des zombinox (voir catégorie invocation dans bestiaire) |
| Arcane + Feu | Un feu pur et inflige brûlure aux ennemis |
| Arcane + Eau | Boire l''eau produite par un utilisateur d''eau en Mode Hyper rend du Chakra (3d6/niveau de magie) |
| Arcane + Glace | Une armure de glace pure de 8RM qui a 50% de renvoyer les sorts à l''envoyeur |
| Arcane + Terre | Une terre pure est invoquée et une plante carnivore y pousse |
| Arcane + Vent | Un vent pur et tranchant qui fait reculer les ennemis et inflige 2d8 de dégâts |
| Arcane + Foudre | Un orage pur s''abat sur les ennemis et inflige 3d6/par niveau de magie sur le Chakra" |
| Arcane + Lumière | Une lumière pure qui inflige l''état confus aux ennemis |
| Arcane + Ombre | Une ombre pure prend votre apparence et vous accompagne" |
| Temps/Espace + Nécromancie | Permet d''invoquer une ou des momies (voir catégorie invocation dans bestiaire) |
| Temps/Espace + Feu | Déplace une pluie d''astéroïdes de taille aléatoire sur le champ de bataille sur une zone de 5x5. 2d8 de dégâts |
| Temps/Espace + Eau | Une eau étrange va rajeunir temporairement les alliés et ennemis ajoutant respectivement +1 et -1 aux stats |
| Temps/Espace + Glace | Invoque le souvenir d''une ère glaciale qui force un jet de vigueur aux ennemis, s''ils ratent leur jet, Gel pendant 3 tours. |
| Temps/Espace + Terre | Un séisme est invoqué et force un jet de Stabilité aux adversaires sinon 2d8 de dégâts et passe leur tour. |
| Temps/Espace + Vent | Une zone de 5x5 est invoquée où la gravité passe à 0" |
| Temps/Espace + Foudre | Un orage apparaît temporairement et vous avez le choix sur quel impact de foudre vous voulez vous téléporter |
| Temps/Espace + Lumière | Un allié ou vous-même reprenez le même état corporel d''avant le combat |
| Temps/Espace + Ombre | Vos adversaires revivent les traumatismes de leur enfance et gagnent l''état Peur |
| Vide + Nécromancie | Permet d''invoquer un ou des fantômes (voir catégorie invocation dans bestiaire) |
| Vide + Feu | Les attaques de Feu sont invisibles et appliquent un malus de 30% pour esquiver ces dernières |
| Vide + Eau | Vous pouvez nager dans le sol avec une grande aisance (+2 Vitesse dans cette "Eau") |
| Vide + Glace | Sur une ligne de 9 cases, crée une barrière de glace de 80 PV et reflète la lumière comme un miroir |
| Vide + Terre | Détériore l''arme d''un ennemi à 1 cran de solidité. Si l''arme n''a qu''à cran l''arme est détruite |
| Vide + Vent | Sur une zone de 5x5 crée un appel d''air qui attire tout le monde vers vous |
| Vide + Foudre | À chaque attaque magique vous vous téléportez devant la cible |
| Vide + Lumière | Un ennemi (sauf "Inerte") vous adule et se joint à votre équipe |
| Vide + Ombre | Les ennemis n''ont plus d''ombre et sont rejetés par le soleil. 10 dégâts par tour d''exposition au soleil (Doublé si Grand Soleil) |
| Nécromancie + Feu | Permet d''invoquer un ou des embrasés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Eau | Permet d''invoquer un ou des noyés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Glace | Permet d''invoquer un ou des os froids (voir catégorie invocation dans bestiaire) |
| Nécromancie + Terre | Permet d''invoquer un ou des squelettes de pierre (voir catégorie invocation dans bestiaire) |
| Nécromancie + Vent | Permet d''invoquer un ou des zompis (voir catégorie invocation dans bestiaire) |
| Nécromancie + Foudre | Permet d''invoquer un ou des réanimés (voir catégorie invocation dans bestiaire) |
| Nécromancie + Lumière | Permet d''invoquer un ou des squelettes rayonnants (voir catégorie invocation dans bestiaire) |
| Nécromancie + Ombre | Permet d''invoquer un ou des zombis obscurs (voir catégorie invocation dans bestiaire) |
| Feu + Eau | Invoque Brouillard pendant l''Hyper et les attaques d''eau infligent l''état brûlure |
| Feu + Glace | Les sorts boule deviennent des grenades de glace sèche qui infligent Brûlure stade 2 |
| Feu + Terre | Sur une zone de 5x5 le sol devient magmatique et inflige 3d6 à chaque tour ou case traversée |
| Feu + Vent | Vous êtes l''oeil d''une tornade de feu de 3x3. Chaque agression à votre encontre inflige l''état "Brûlure" |
| Feu + Foudre | Un rayon de plasma désintègre 1d2 membres de tous les adversaires présents devant vous (sauf Rempart Fragile) |
| Feu + Lumière | Un feu sacré qui fait 4d8 à un mort-vivant (2d8 pour un vivant) |
| Feu + Ombre | Une flamme noire saute sur un ennemi ciblé affligeant Brûlure et Malédiction jusqu''à que vous changiez de cible |
| Eau + Glace | Une plaque de verglas de 5x5 apparaît et force un jet de stabilité à -x0% (x = Dizaine = nombre de cases traversées)  à chaque déplacement |
| Eau + Terre | Un ennemi se change en arbre infligeant Pétrification stade 2 |
| Eau + Vent | Un siphon destructeur réunit tous les ennemis à un point choisi et inflige 2d8 de dégâts |
| Eau + Foudre | Chaque attaque d''eau a 50% de chance de paralyser |
| Eau + Lumière | Tous les alliés régénèrent 50% de leur barrière |
| Eau + Ombre | Une créature des abysses apparaît à vos côtés |
| Glace + Terre | La permaglace vous recouvre et vous octroie +4 PA +4 RM et vous permet d''être neutre au feu au lieu d''être très vulnérable |
| Glace + Vent | 1d10 de stalactites de glaces seront projetées sur vos ennemis faisant chacune 2d6 de dégâts |
| Glace + Foudre | Invoque 4 piliers de glace connectés par des traits d''électricité. Franchir les barrières inflige 3d6 de dégâts |
| Glace + Lumière | Une armure de glace lumineuse de +8 RM vous recouvre et applique un malus de -20% à chaque agression |
| Glace + Ombre | L''ombre des ennemis grelotte et inflige l''état Gel |
| Terre + Vent | 4 boucliers de terre de 50PV flottent autour de vous |
| Terre + Foudre | Le sol se magnétise et attire armes, armures et boucliers en métal (-1 Vitesse si l''arme dégainée est en métal, pour une armure en métal et -pour un bouclier en métal) |
| Terre + Lumière | Craque le sol et des racines soignent les alliés de 50PV |
| Terre + Ombre | Aspire 2d8 de PV à tout ennemi terrestre |
| Vent + Foudre | Un mini orage apparaît au-dessus de chaque ennemi infligeant 10  dégâts par tour |
| Vent + Lumière | Booste tous les jets des alliés de 10% |
| Vent + Ombre | Malus de 10% à tous les jets ennemis |
| Foudre + Lumière | Supprime 50% de la barrière des ennemis |
| Foudre + Ombre | Chaque attaque ponctionnera également le chakra avec les mêmes dégâts |
| Lumière + Ombre | Invoque la météo Éclipse |

## Commentaire de cellule

- **Vide + Nécromancie** (cellule M43) : Sous cette forme, il est impossible de faire des dégâts physiques et seules les armes spectrales sont utilisables ainsi que les sorts.

*Commentaire joint à la cellule dans le classeur d''origine, marqué comme résolu.*', 'neutre', NULL, 'page', '{"id":"guide/mode-hyper-magie"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 717, 'guide', 'Pages de référence', 'Postures', 'Texte', 'modifie', 'Dans un combat, il existe de nombreuse postures qui vont influencer votre façon de jouer, il en existe 6 avec des effets propres :

## Offensif

C''est la posture d''attaque par excellence, si on veut taper et faire beaucoup de dégâts c''est la posture idéale. Ses effets sont :

- **Dégâts maximum :** Armes ou Magie, les dégâts seront au minimum avec les bonus. [Exemple : 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts, les jets de dés ne sont pas a faire vu que c''est le maximum que l''on prend]
- **+5% à la réussite critique :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture offensif, cette réussite critique monte à 10 ou moins.
- **Malus de 10% pour toucher une cible :** La posture diminue la chance que vous avez de toucher votre cible.
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Défensif

En opposition avec la posture offensive, la posture défensive est faite pour quelqu''un qui souhaite couvrir ses alliés ou bien se protéger de multiple assaut. Ses effets sont :

- **+2AP/AM :** L’armure physique et magique augmente quand cette posture est prise. Cela augmente de +2 tous les 4 niveaux global du personnage.
- **Parade/Esquive illimité :** Permet d''esquiver ou de parer tous les coups dans un tour MAIS dès que le nombre de parade/esquive est au delà de deux = chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.
- **Provocation :** Permet en échange d''un bon dialogue ou d''un jet de diplomatie, intimidation ou manipulation réussi, d''obliger un adversaire à venir vous attaquer que vous pendant 1 tour.
- **Intervention :** Permet de parer/esquiver le coup à la place d''un allié adjacent.
- **+5% à la réussite critique avec une défense :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture défensive, cette réussite critique monte à 10 ou moins quand on esquive ou pare une attaque.
- **Divise les dégâts par 2 infligés :** Armes ou Magie, les dégâts infligés seront divisés par 2, cette division intervient AVANT le calcule de l’armure.

## Neutre

L''entre deux de la posture offensif et défensif, la posture neutre permet d''infliger les dégâts normaux en plus de bénéficier de parade ou esquive. Ses effets sont :

- **+5% pour un jet V ou S :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Social ou Volonté.
- **2 esquive/parade par tour :** Permet d''esquiver ou de parer deux fois par tour.

## Focus

Cette posture permet de rester concentré et permet une meilleure efficacité avec la magie. Ses effets sont :

- **+10% à la réussite :** Peut importe le type de jet, il bénéficie d’un bonus de 10% à la réussite.
- **-1 tour de charge :** Permet de retirer le tour de charge des sorts de niveau 5 de puissance et de retirer le tour de charge lors de certaines actions. Casse le tour de charge de la capacité "Préparation" du Mage Rouge et Vert.
- **Augmente le cran de dé de dégâts/soin :** Permet d’augmenter d’un cran la nature des dés qui seront lancés pour le sortilèges (le D6 devient D8, etc…en sachant qu’il n’y pas plus haut que le D20)
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Vigilance

Cette posture permet d''être bien plus attentif à ce qu''il se passe autour de soi mais aussi dans le combat. Ses effets sont :

- **+5% pour un jet de Perception :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Perception.
- **+2 Initiative :** Permet d''avoir un bonus d''initiative de +2 lors du début de chaque tour.
- **Peut anticiper les actions adverses :** Permet grâce un jet d''observation d''avoir une info intéressante sur la prochaine action de l''adversaire, voir le mj pour ça.
- **Repérer un adversaire invisible devient un IC :** Permet à l’action “estimer la position d’un ennemi invisible ou discret” de devenir un IC.
- **Peut repérer 1d4 résistance/vulnérabilité :** Permet d’utiliser un IC pour détecter une résistance ou vulnérabilité aléatoire de l’ennemi.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.

## Symbiose

Cette posture étrange permet d''être en parfaite fusion avec sa magie, dans cette posture vous êtes presque comme un élémentaire. Il faut savoir que cette posture permet d''être meilleur avec sa magie mais dans le cas où vous êtes bi-magie, vous devez choisir une magie avec qui faire équipe et délaisser l''autre le temps de la posture. Ses effets sont :

- **+5 dégâts/soin avec une magie :** Permet d''infliger un bonus de dégâts de +5 ou alors un bonus de +5 avec un sort de soin. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **+4 AM :** Permet d''avoir une plus grande armure magique dans cette posture. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **Immunité à la magie de la symbiose :** La magie avec laquelle vous avez fait la symbiose vous envahit et vous devenez totalement immunisé à celle ci.
- **+1 tour d''effet pour les effets secondaires avec des tours :** Si votre sortilège possède un effet qui dure sur plusieurs tours, la posture permet d''ajouter 1 tour gratuitement.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.
- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (“Forgemagie”, “Forge de ses morts”, Bâton magique et les parchemins ne sont pas interdit)
- **Une seule magie active :** Quand vous avez 2 magies, 1 de ses magies doit être désactiver temporairement, ainsi tout ses avantages et inconvénients sont annulés également.', 'Dans un combat, il existe de nombreuses postures qui vont influencer votre façon de jouer, il en existe 6 avec des effets propres :

## Offensif

C''est la posture d''attaque par excellence, si on veut taper et faire beaucoup de dégâts c''est la posture idéale. Ses effets sont :

- **Dégâts maximum :** Armes ou Magie, les dégâts seront au minimum avec les bonus. [Exemple : 2d6+2 de dégâts en offensif fera automatiquement 14 dégâts, les jets de dés ne sont pas à faire vu que c''est le maximum que l''on prend]
- **+5% à la réussite critique :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture offensive, cette réussite critique monte à 10 ou moins.
- **Malus de 10% pour toucher une cible :** La posture diminue la chance que vous avez de toucher votre cible.
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Défensif

En opposition avec la posture offensive, la posture défensive est faite pour quelqu''un qui souhaite couvrir ses alliés ou bien se protéger de multiples assauts. Ses effets sont :

- **+2AP/AM :** L’armure physique et magique augmente quand cette posture est prise. Cela augmente de +2 tous les 4 niveaux globaux du personnage.
- **Parade/Esquive illimitée :** Permet d''esquiver ou de parer tous les coups dans un tour MAIS dès que le nombre de parade/esquive est au-delà de deux = chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.
- **Provocation :** Permet en échange d''un bon dialogue ou d''un jet de diplomatie, intimidation ou manipulation réussi, d''obliger un adversaire à venir vous attaquer que vous pendant 1 tour.
- **Intervention :** Permet de parer/esquiver le coup à la place d''un allié adjacent.
- **+5% à la réussite critique avec une défense :** La réussite critique (ou coup critique) est de base à 5 ou moins, grâce à la posture défensive, cette réussite critique monte à 10 ou moins quand on esquive ou pare une attaque.
- **Divise les dégâts par 2 infligés :** Armes ou Magie, les dégâts infligés seront divisés par 2, cette division intervient AVANT le calcul de l’armure.

## Neutre

L''entre-deux de la posture offensive et défensive, la posture neutre permet d''infliger les dégâts normaux en plus de bénéficier de parade ou esquive. Ses effets sont :

- **+5% pour un jet V ou S :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Social ou Volonté.
- **2 esquives/parades par tour :** Permet d''esquiver ou de parer deux fois par tour.

## Focus

Cette posture permet de rester concentré et permet une meilleure efficacité avec la magie. Ses effets sont :

- **+10% à la réussite :** Peu importe le type de jet, il bénéficie d’un bonus de 10% à la réussite.
- **-1 tour de charge :** Permet de retirer le tour de charge des sorts de niveau 5 de puissance et de retirer le tour de charge lors de certaines actions. Casse le tour de charge de la capacité "Préparation" du Mage Rouge et Vert.
- **Augmente le cran de dé de dégâts/soin :** Permet d’augmenter d’un cran la nature des dés qui seront lancés pour le sortilèges (le D6 devient D8, etc… en sachant qu’il n’y pas plus haut que le D20)
- **Esquive/Parade impossible :** Pas besoin d''expliquer, la posture vous empêche d''esquiver ou de parer une agression ennemie.

## Vigilance

Cette posture permet d''être bien plus attentif à ce qu''il se passe autour de soi mais aussi dans le combat. Ses effets sont :

- **+5% pour un jet de Perception :** Permet d''avoir un bonus de 5% à tout jet impliquant la caractéristique Perception.
- **+2 Initiative :** Permet d''avoir un bonus d''initiative de +2 lors du début de chaque tour.
- **Peut anticiper les actions adverses :** Permet grâce un jet d''observation d''avoir une info intéressante sur la prochaine action de l''adversaire, voir le mj pour ça.
- **Repérer un adversaire invisible devient un IC :** Permet à l’action “estimer la position d’un ennemi invisible ou discret” de devenir un IC.
- **Peut repérer 1d4 résistance/vulnérabilité :** Permet d’utiliser un IC pour détecter une résistance ou vulnérabilité aléatoire de l’ennemi.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.

## Symbiose

Cette posture étrange permet d''être en parfaite fusion avec sa magie, dans cette posture vous êtes presque comme un élémentaire. Il faut savoir que cette posture permet d''être meilleur avec sa magie mais dans le cas où vous êtes bi-magie, vous devez choisir une magie avec qui faire équipe et délaisser l''autre le temps de la posture. Ses effets sont :

- **+5 dégâts/soin avec une magie :** Permet d''infliger un bonus de dégâts de +5 ou alors un bonus de +5 avec un sort de soin. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **+4 AM :** Permet d''avoir une plus grande armure magique dans cette posture. Cela augmente de +2 tous les niveaux de puissance magique (le premier niveau ne compte pas)
- **Immunité à la magie de la symbiose :** La magie avec laquelle vous avez fait la symbiose vous envahit et vous devenez totalement immunisé à celle-ci.
- **+1 tour d''effet pour les effets secondaires avec des tours :** Si votre sortilège possède un effet qui dure sur plusieurs tours, la posture permet d''ajouter 1 tour gratuitement.
- **Une seule parade/esquive par tour :** Permet d''esquiver ou de parer une fois par tour.
- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (“Forgemagie”, “Forge de ses morts”, Bâton magique et les parchemins ne sont pas interdits)
- **Une seule magie active :** Quand vous avez 2 magies, 1 de ces magies doit être désactivée temporairement, ainsi tous ses avantages et inconvénients sont annulés également.', 'neutre', NULL, 'page', '{"id":"guide/postures"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.2', 718, 'guide', 'Pages de référence', 'Résistance/Faiblesse Magie', 'Texte', 'modifie', 'A la manière de beaucoup d''univers, il existe une relation entre les différentes magies, certaines sont efficace sur certaines, d''autre sont moins efficaces et ainsi de suite, voici la table :

| Cible \ Attaque | Arcane | Sang | Espace Temps | Vide | Nécromancie | Glace | Feu | Foudre | Eau | Vent | Terre | Ombre | Lumière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Arcane | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Sang | x1 | x0,5 | x1 | x1 | x0,5 | x0,5 | x1 | x1 | x2 | x1 | x2 | x1 | x1 |
| Temps Espace | x1 | x1 | x0,5 | x2 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Vide | x1 | x1 | x2 | x0,5 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Nécromancie | x1 | x2 | x1 | x1 | x0,5 | x0,5 | x1 | x2 | x0,5 | x1 | x1 | x1 | x1 |
| Glace | x1 | x2 | x1 | x1 | x2 | x0,5 | x0,5 | x1 | x1 | x0,5 | x1 | x1 | x1 |
| Feu | x1 | x1 | x1 | x1 | x1 | x2 | x0,5 | x1 | x0,5 | x0,5 | x2 | x1 | x1 |
| Foudre | x1 | x1 | x1 | x1 | x0,5 | x1 | x1 | x0,5 | x2 | x2 | x0,5 | x1 | x1 |
| Eau | x1 | x0,5 | x1 | x1 | x2 | x1 | x2 | x0,5 | x0,5 | x1 | x1 | x1 | x1 |
| Vent | x1 | x1 | x1 | x1 | x1 | x2 | x2 | x0,5 | x1 | x0,5 | x0,5 | x1 | x1 |
| Terre | x1 | x0,5 | x1 | x1 | x1 | x1 | x0,5 | x2 | x1 | x2 | x0,5 | x1 | x1 |
| Ombre | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x0,5 | x2 |
| Lumière | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x2 | x0,5 |

*Table présente sous forme d''image dans le Google Doc source, transcrite ici cellule par cellule.*

Chaque magie possède ses efficacités, ses résistances et ses vulnérabilités propre d''une manière générale mais il faut savoir :

- La magie Arcane possède qu’une seule résistance et c’est contre les sorts de la corruption, et vice versa.
- Le duo Ombre/Lumière fonctionne en dualité, ils sont efficaces mutuellement et résistent à eux même.
- Le duo Vide/Espace Temps fonctionne en dualité, ils sont efficaces mutuellement et résistent à eux même.

Quand vous êtes touché par un élément dont vous êtes vulnérable, vous prenez 2 fois plus de dégâts. Et inversement quand vous êtes résistant, vous prenez 2 fois moins de dégâts.', 'À la manière de beaucoup d''univers, il existe une relation entre les différentes magies, certaines sont efficaces sur certaines, d''autres sont moins efficaces et ainsi de suite, voici la table :

| Cible \ Attaque | Arcane | Sang | Espace Temps | Vide | Nécromancie | Glace | Feu | Foudre | Eau | Vent | Terre | Ombre | Lumière |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Arcane | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Sang | x1 | x0,5 | x1 | x1 | x0,5 | x0,5 | x1 | x1 | x2 | x1 | x2 | x1 | x1 |
| Temps Espace | x1 | x1 | x0,5 | x2 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Vide | x1 | x1 | x2 | x0,5 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 |
| Nécromancie | x1 | x2 | x1 | x1 | x0,5 | x0,5 | x1 | x2 | x0,5 | x1 | x1 | x1 | x1 |
| Glace | x1 | x2 | x1 | x1 | x2 | x0,5 | x0,5 | x1 | x1 | x0,5 | x1 | x1 | x1 |
| Feu | x1 | x1 | x1 | x1 | x1 | x2 | x0,5 | x1 | x0,5 | x0,5 | x2 | x1 | x1 |
| Foudre | x1 | x1 | x1 | x1 | x0,5 | x1 | x1 | x0,5 | x2 | x2 | x0,5 | x1 | x1 |
| Eau | x1 | x0,5 | x1 | x1 | x2 | x1 | x2 | x0,5 | x0,5 | x1 | x1 | x1 | x1 |
| Vent | x1 | x1 | x1 | x1 | x1 | x2 | x2 | x0,5 | x1 | x0,5 | x0,5 | x1 | x1 |
| Terre | x1 | x0,5 | x1 | x1 | x1 | x1 | x0,5 | x2 | x1 | x2 | x0,5 | x1 | x1 |
| Ombre | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x0,5 | x2 |
| Lumière | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x1 | x2 | x0,5 |

*Table présente sous forme d''image dans le Google Doc source, transcrite ici cellule par cellule.*

Chaque magie possède ses efficacités, ses résistances et ses vulnérabilités propres d''une manière générale mais il faut savoir :

- La magie Arcane possède qu’une seule résistance et c’est contre les sorts de la corruption, et vice versa.
- Le duo Ombre/Lumière fonctionne en dualité, ils sont efficaces mutuellement et résistent à eux-mêmes.
- Le duo Vide/Espace Temps fonctionne en dualité, ils sont efficaces mutuellement et résistent à eux-mêmes.

Quand vous êtes touché par un élément dont vous êtes vulnérable, vous prenez 2 fois plus de dégâts. Et inversement quand vous êtes résistant, vous prenez 2 fois moins de dégâts.', 'neutre', NULL, 'page', '{"id":"guide/resistance-faiblesse-magie"}', 'corps_md');

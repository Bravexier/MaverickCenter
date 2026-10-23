-- data/rows/note_version_ligne.sql : export déterministe, une instruction par ligne, triée par (version, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 1, 'guide', 'Chapitre 3', 'L’univers', 'Texte', 'modifie', '## Un monde de magie

Maverick est un monde médiéval-fantasy où vivent [27 races](/races/), des plus familières aux plus exotiques. Chacune a son histoire, ses avantages, ses dons et sa façon de voir les autres peuples.

La magie y est omniprésente, au point que **tout être vivant naît imprégné de l’une des 15 formes de magie**. Cette magie, dite *innée*, est directement héritée de l’un de ses parents, sauf si un dieu intervient. Elle marque jusqu’au corps : la magie innée donne un point de caractéristique en plus (voir [le choix des magies](/guide/choisir-ses-magies/)).

Chaque magie est reliée à une divinité, le *dieu inné* de ceux qui la portent (son nom est sous celui de la magie) :

<!-- guide:magies -->

Les magies ne s’entendent pas toutes entre elles : certaines sont efficaces contre d’autres, d’autres résistent, et certaines ne peuvent pas être réunies chez un même personnage. La [carte des magies](/magies/) montre ces relations.

## Le Codex

L’histoire du monde, sa mythologie, ses lieux et ses factions seront rassemblés dans le [Codex](/lore/). **Il est encore en cours d’écriture** : pour l’instant, on y trouve les [[Relations entre les races|relations entre les peuples]].', '## Un monde de magie

Maverick est un monde médiéval-fantasy où vivent [27 races](/races/), des plus familières aux plus exotiques. Chacune a son histoire, ses avantages, ses dons et sa façon de voir les autres peuples.

La magie y est omniprésente, au point que **tout être vivant naît imprégné de l’une des 15 formes de magie**. Cette magie, dite *innée*, est directement héritée de l’un de ses parents, sauf si un dieu intervient. Elle marque jusqu’au corps : la magie innée donne un point de caractéristique en plus (voir [le choix des magies](/guide/choisir-ses-magies/)).

Chaque magie est reliée à une divinité, le *dieu inné* de ceux qui la portent (son nom est sous celui de la magie) :

<!-- guide:magies -->

Les magies ne s’entendent pas toutes entre elles : certaines sont efficaces contre d’autres, d’autres résistent, et certaines ne peuvent pas être réunies chez un même personnage. La [carte des magies](/magies/) montre ces relations.

## Le Codex

L’histoire du monde, sa mythologie, ses lieux et ses factions sont rassemblés dans le [[Codex]] : [[Origine du monde|l’origine du monde]], [[Les Divinités|les divinités]], [[Temples/Cultes/Guildes|les temples, cultes et guildes]], [[Les races non-jouable|les races non jouables]], [[Les Civilisations|les civilisations]], [[Les Outils Légendaires, Uniques|les outils légendaires]] et un [[Glossaire|glossaire]] des termes du jeu. On y trouve aussi les [[Relations entre les races|relations entre les peuples]].', 'neutre', NULL, 'page', '{"id":"guide/l-univers"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 2, 'codex', NULL, '116 pages du Codex', NULL, 'ajoute', NULL, '116 pages du Codex', 'neutre', NULL, 'page', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 3, 'bestiaire', NULL, '144 espèces', NULL, 'ajoute', NULL, '144 espèces', 'neutre', NULL, 'monstre_espece', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 4, 'bestiaire', NULL, '311 monstres', NULL, 'ajoute', NULL, '311 monstres', 'neutre', NULL, 'monstre', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 5, 'bestiaire', NULL, '469 capacités de monstre', NULL, 'ajoute', NULL, '469 capacités de monstre', 'neutre', NULL, 'monstre_capacite_commune', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 6, 'bestiaire', NULL, '1762 capacités sur les cartes', NULL, 'ajoute', NULL, '1762 capacités sur les cartes', 'neutre', NULL, 'monstre_capacite', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 7, 'bestiaire', NULL, '32 valeurs de capacité propres à une carte', NULL, 'ajoute', NULL, '32 valeurs de capacité propres à une carte', 'neutre', NULL, 'monstre_capacite_valeur', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 8, 'bestiaire', 'Ottar', 'Ottar', 'Groupe d’espèces', 'ajoute', NULL, 'Ottar', 'neutre', NULL, 'monstre_groupe', '{"id":"monstres/ottar"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 9, 'chronologie', NULL, '74 événements de la chronologie', NULL, 'ajoute', NULL, '74 événements de la chronologie', 'neutre', NULL, 'evenement', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 10, 'chronologie', NULL, '183 descriptions d’événements', NULL, 'ajoute', NULL, '183 descriptions d’événements', 'neutre', NULL, 'evenement_extrait', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.3', 11, 'mots-cles', NULL, '412 mots-clés', NULL, 'ajoute', NULL, '412 mots-clés', 'neutre', NULL, 'mot_cle', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 1, 'sorts', 'Sang', 'Boule de sang', 'Coût', 'modifie', '3 + 1 Sang', '3', 'neutre', '[{"partie":"valeur","avant":"3 + 1 Sang","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:boule-de-sang"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 2, 'sorts', 'Sang', 'Boule de sang', 'Coût secondaire', 'ajoute', NULL, '1 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:boule-de-sang"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 3, 'sorts', 'Sang', 'Clou', 'Coût', 'modifie', '3 + 2 Sang', '3', 'neutre', '[{"partie":"valeur","avant":"3 + 2 Sang","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:clou"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 4, 'sorts', 'Sang', 'Clou', 'Coût secondaire', 'ajoute', NULL, '2 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:clou"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 5, 'sorts', 'Sang', 'Marquage', 'Coût', 'modifie', '2 Sang', '0', 'neutre', '[{"partie":"valeur","avant":"2 Sang","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:marquage"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 6, 'sorts', 'Sang', 'Marquage', 'Coût secondaire', 'ajoute', NULL, '2 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:marquage"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 7, 'sorts', 'Sang', 'Annulation', 'Coût', 'modifie', '2 Sang', '0', 'neutre', '[{"partie":"valeur","avant":"2 Sang","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:annulation"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 8, 'sorts', 'Sang', 'Annulation', 'Coût secondaire', 'ajoute', NULL, '2 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:annulation"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 9, 'sorts', 'Sang', 'Attirance', 'Coût', 'modifie', '2 + 1 Sang', '2', 'neutre', '[{"partie":"valeur","avant":"2 + 1 Sang","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:attirance"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 10, 'sorts', 'Sang', 'Attirance', 'Coût secondaire', 'ajoute', NULL, '1 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:attirance"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 11, 'sorts', 'Sang', 'Sang Durci', 'Coût', 'modifie', '2 + 3 Sang', '2', 'neutre', '[{"partie":"valeur","avant":"2 + 3 Sang","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:sang-durci"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 12, 'sorts', 'Sang', 'Sang Durci', 'Coût secondaire', 'ajoute', NULL, '3 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:sang-durci"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 13, 'sorts', 'Sang', 'Fer Sanglant', 'Effets secondaires', 'modifie', 'Le sang sur la lame ne sèche pas, permet de taper dans l''élément sang pendant 3 tours.', 'Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang.', 'neutre', '[{"partie":"valeur","avant":"Le sang sur la lame ne sèche pas, permet de taper dans l''élément sang pendant 3 tours.","apres":"Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:fer-sanglant"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 14, 'sorts', 'Sang', 'Sang Garde', 'Coût', 'modifie', '2 + 3 Sang', '2', 'neutre', '[{"partie":"valeur","avant":"2 + 3 Sang","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:sang-garde"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 15, 'sorts', 'Sang', 'Sang Garde', 'Coût secondaire', 'ajoute', NULL, '3 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:sang-garde"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 16, 'sorts', 'Sang', 'Sang Magie', 'Coût', 'modifie', '2 + 3 Sang', '2', 'neutre', '[{"partie":"valeur","avant":"2 + 3 Sang","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:sang-magie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 17, 'sorts', 'Sang', 'Sang Magie', 'Coût secondaire', 'ajoute', NULL, '3 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:sang-magie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 18, 'sorts', 'Sang', 'Sang Gain', 'Coût', 'modifie', '2 + 3 Sang', '2', 'neutre', '[{"partie":"valeur","avant":"2 + 3 Sang","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:sang-gain"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 19, 'sorts', 'Sang', 'Sang Gain', 'Coût secondaire', 'ajoute', NULL, '3 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:sang-gain"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 20, 'sorts', 'Sang', 'Saignée forcée', 'Coût', 'modifie', '9 + 4 Sang', '9', 'neutre', '[{"partie":"valeur","avant":"9 + 4 Sang","apres":"9","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:saignee-forcee"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 21, 'sorts', 'Sang', 'Saignée forcée', 'Coût secondaire', 'ajoute', NULL, '4 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:saignee-forcee"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 22, 'sorts', 'Sang', 'Morsure aspirante', 'Remarque', 'modifie', 'Ne marche pas si c''est la barrière qui encaisse le coup', 'Ne marche pas si c''est la {{barriere|barrière}} qui encaisse le coup', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:morsure-aspirante"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 23, 'sorts', 'Sang', 'Coagulation', 'Coût', 'modifie', '10 + X Sang', '10', 'neutre', '[{"partie":"valeur","avant":"10 + X Sang","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:coagulation"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 24, 'sorts', 'Sang', 'Coagulation', 'Coût secondaire', 'ajoute', NULL, 'X Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:coagulation"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 25, 'sorts', 'Sang', 'Renfermement', 'Coût', 'modifie', '10 + 4 Sang', '10', 'neutre', '[{"partie":"valeur","avant":"10 + 4 Sang","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:renfermement"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 26, 'sorts', 'Sang', 'Renfermement', 'Coût secondaire', 'ajoute', NULL, '4 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:renfermement"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 27, 'sorts', 'Sang', 'Déflagration sanguine', 'Coût', 'modifie', 'X Sang', '0', 'neutre', '[{"partie":"valeur","avant":"X Sang","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:deflagration-sanguine"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 28, 'sorts', 'Sang', 'Déflagration sanguine', 'Coût secondaire', 'ajoute', NULL, 'X Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:deflagration-sanguine"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 29, 'sorts', 'Sang', 'Damoclès', 'Coût', 'modifie', '18 + 5 Sang', '18', 'neutre', '[{"partie":"valeur","avant":"18 + 5 Sang","apres":"18","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:damocles"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 30, 'sorts', 'Sang', 'Damoclès', 'Coût secondaire', 'ajoute', NULL, '5 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:damocles"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 31, 'sorts', 'Sang', 'Douleur partagée', 'Coût', 'modifie', '20 + 5 Sang', '20', 'neutre', '[{"partie":"valeur","avant":"20 + 5 Sang","apres":"20","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:douleur-partagee"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 32, 'sorts', 'Sang', 'Douleur partagée', 'Coût secondaire', 'ajoute', NULL, '5 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:douleur-partagee"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 33, 'sorts', 'Sang', 'Autel Sanglant', 'Coût', 'modifie', '18 + 6 Sang', '18', 'neutre', '[{"partie":"valeur","avant":"18 + 6 Sang","apres":"18","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:autel-sanglant"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 34, 'sorts', 'Sang', 'Autel Sanglant', 'Coût secondaire', 'ajoute', NULL, '6 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:autel-sanglant"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 35, 'sorts', 'Sang', 'Perfusion', 'Coût', 'modifie', 'Variable', '0', 'neutre', '[{"partie":"valeur","avant":"Variable","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:perfusion"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 36, 'sorts', 'Sang', 'Perfusion', 'Coût secondaire', 'ajoute', NULL, 'X Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:perfusion"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 37, 'sorts', 'Sang', 'Sang Perfection', 'Coût', 'modifie', '40 + 10 Sang', '40', 'neutre', '[{"partie":"valeur","avant":"40 + 10 Sang","apres":"40","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:sang-perfection"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 38, 'sorts', 'Sang', 'Sang Perfection', 'Coût secondaire', 'ajoute', NULL, '10 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:sang-perfection"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 39, 'sorts', 'Sang', 'Proportion démesurée', 'Coût', 'modifie', '60 + 10 Sang', '60', 'neutre', '[{"partie":"valeur","avant":"60 + 10 Sang","apres":"60","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-sang#sort:proportion-demesuree"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 40, 'sorts', 'Sang', 'Proportion démesurée', 'Coût secondaire', 'ajoute', NULL, '10 Sang', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-sang#sort:proportion-demesuree"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 41, 'sorts', 'Arcane', 'Charge d''énergie', 'Coût', 'modifie', '2=1 dégâts', '2', 'neutre', '[{"partie":"valeur","avant":"2=1 dégâts","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:charge-denergie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 42, 'sorts', 'Arcane', 'Charge d''énergie', 'Coût secondaire', 'ajoute', NULL, 'Pour 1 dégât supplémentaire', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:charge-denergie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 43, 'sorts', 'Arcane', 'Charge d''énergie', 'Remarque', 'modifie', '30 chakra maximum en 1 fois', '30 {{chakra|chakra}} maximum en 1 fois', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:charge-denergie"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 44, 'sorts', 'Arcane', 'Rune Arcane', 'Coût', 'modifie', '3xN/tour', '3', 'neutre', '[{"partie":"valeur","avant":"3xN/tour","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:rune-arcane"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 45, 'sorts', 'Arcane', 'Rune Arcane', 'Coût secondaire', 'ajoute', NULL, 'Par tour et par cible', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:rune-arcane"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 46, 'sorts', 'Arcane', 'Forge-Magie', 'Coût', 'modifie', '2/taille', '2', 'neutre', '[{"partie":"valeur","avant":"2/taille","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:forge-magie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 47, 'sorts', 'Arcane', 'Forge-Magie', 'Coût secondaire', 'ajoute', NULL, 'Par taille de l''arme créée', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:forge-magie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 48, 'sorts', 'Arcane', 'Inhalation magique', 'Coût', 'modifie', '5% santé/tour', '0', 'neutre', '[{"partie":"valeur","avant":"5% santé/tour","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:inhalation-magique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 49, 'sorts', 'Arcane', 'Inhalation magique', 'Coût secondaire', 'ajoute', NULL, '5% santé par tour', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:inhalation-magique"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 50, 'sorts', 'Arcane', 'Inhalation magique', 'D/S/B', 'modifie', '+5% de chakra', '+5% de {{chakra|chakra}}', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:inhalation-magique"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 51, 'sorts', 'Arcane', 'Souffle magique', 'Coût', 'modifie', 'Choix', 'X', 'neutre', '[{"partie":"valeur","avant":"Choix","apres":"X","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:souffle-magique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 52, 'sorts', 'Arcane', 'Souffle magique', 'D/S/B', 'modifie', 'Donne X Chakra', 'Donne X {{chakra|Chakra}}', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:souffle-magique"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 53, 'sorts', 'Arcane', 'Souffle magique', 'Effets secondaires', 'modifie', 'Souffle du chakra pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le chakra donné est divisé.', 'Souffle du {{chakra|chakra}} pour en donner une quantité au choix à la ou aux cibles. S''il y a plusieurs cibles, le {{chakra|chakra}} donné est divisé.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:souffle-magique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 54, 'sorts', 'Arcane', 'Échange', 'Coût', 'modifie', 'Choix', '2', 'neutre', '[{"partie":"valeur","avant":"Choix","apres":"2","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:echange"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 55, 'sorts', 'Arcane', 'Échange', 'Coût secondaire', 'ajoute', NULL, 'Pour 1 barrière', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:echange"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 56, 'sorts', 'Arcane', 'Échange', 'Effets secondaires', 'modifie', 'Permet d''échanger son chakra en barrière. 2CK = 1BA (3CK = 2BA/3NM)', 'Permet d''échanger son {{chakra|chakra}} en {{barriere|barrière}}. 2CK = 1BA (3CK = 2BA/3NM)', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:echange"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 57, 'sorts', 'Arcane', 'Vision magique', 'Coût', 'modifie', '8xN/heure', '8', 'neutre', '[{"partie":"valeur","avant":"8xN/heure","apres":"8","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:vision-magique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 58, 'sorts', 'Arcane', 'Vision magique', 'Coût secondaire', 'ajoute', NULL, 'Par jour', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:vision-magique"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 59, 'sorts', 'Arcane', 'Vague déferlante', 'Effets secondaires', 'modifie', 'Peut être surchargé (15 chakra en + = 1 dé en +) (maximum 75 chakra en surcharge)', 'Peut être surchargé (15 {{chakra|chakra}} en + = 1 dé en +) (maximum 75 {{chakra|chakra}} en surcharge)', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:vague-deferlante"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 60, 'sorts', 'Arcane', 'Laser de chakra', 'Effets secondaires', 'modifie', 'Ignore totalement les AP, AM et la barrière.', 'Ignore totalement les AP, AM et la {{barriere|barrière}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:laser-de-chakra"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 61, 'sorts', 'Arcane', 'Pillage défensif', 'Effets secondaires', 'modifie', 'Inflige des dégâts et permet de récupérer 25% des dégâts en barrière.', 'Inflige des dégâts et permet de récupérer 25% des dégâts en {{barriere|barrière}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:pillage-defensif"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 62, 'sorts', 'Arcane', 'Pillage défensif', 'Remarque', 'modifie', 'Le regain ne peut être effectif que si c''est la barrière ennemie qui est touchée.', 'Le regain ne peut être effectif que si c''est la {{barriere|barrière}} ennemie qui est touchée.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:pillage-defensif"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 63, 'sorts', 'Arcane', 'Rune Arcane multiple', 'Coût', 'modifie', '10xN/tour', '10', 'neutre', '[{"partie":"valeur","avant":"10xN/tour","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:rune-arcane-multiple"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 64, 'sorts', 'Arcane', 'Rune Arcane multiple', 'Coût secondaire', 'ajoute', NULL, 'Par tour et par cible', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:rune-arcane-multiple"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 65, 'sorts', 'Arcane', 'Champ Gardien', 'D/S/B', 'modifie', 'Donne 2d6 + 3 Barrière et 12 dégâts', 'Donne 2d6 + 3 {{barriere|Barrière}} et 12 dégâts', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:champ-gardien"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 66, 'sorts', 'Arcane', 'Champ Gardien', 'Effets secondaires', 'modifie', 'Invoque un cercle qui va rendre de la barrière aux alliés et infliger des dégâts aux ennemis (3 NM = les dégâts ignorent les AM).', 'Invoque un cercle qui va rendre de la {{barriere|barrière}} aux alliés et infliger des dégâts aux ennemis (3 NM = les dégâts ignorent les AM).', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:champ-gardien"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 67, 'sorts', 'Arcane', 'Peau de Chakra', 'Coût', 'modifie', '13xN/tour', '13', 'neutre', '[{"partie":"valeur","avant":"13xN/tour","apres":"13","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:peau-de-chakra"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 68, 'sorts', 'Arcane', 'Peau de Chakra', 'Coût secondaire', 'ajoute', NULL, 'Par tour et par cible', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:peau-de-chakra"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 69, 'sorts', 'Arcane', 'Pluie de Chakra', 'Coût', 'modifie', '25%', 'N/A', 'neutre', '[{"partie":"valeur","avant":"25%","apres":"N/A","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:pluie-de-chakra"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 70, 'sorts', 'Arcane', 'Pluie de Chakra', 'Coût secondaire', 'ajoute', NULL, '25% Chakra maximum', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:pluie-de-chakra"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 71, 'sorts', 'Arcane', 'Pluie de Chakra', 'Effets secondaires', 'modifie', 'Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur chakra.', 'Fait pleuvoir une pluie blanche brillante au-dessus des alliés, leur redonnant ainsi 25% de leur {{chakra|chakra}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:pluie-de-chakra"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 72, 'sorts', 'Arcane', 'Drain d''énergie', 'D/S/B', 'modifie', 'Vole 4d10 (+1d/3NM) chakra', 'Vole 4d10 (+1d/3NM) {{chakra|chakra}}', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:drain-denergie"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 73, 'sorts', 'Arcane', 'Drain d''énergie', 'Effets secondaires', 'modifie', 'Vole du chakra aux ennemis visibles. Le chakra récupéré est redistribué aux alliés', 'Vole du {{chakra|chakra}} aux ennemis visibles. Le {{chakra|chakra}} récupéré est redistribué aux alliés', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:drain-denergie"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 74, 'sorts', 'Arcane', 'Voile Chakratique', 'Coût', 'modifie', '15% santé/tour', '0', 'neutre', '[{"partie":"valeur","avant":"15% santé/tour","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-larcane#sort:voile-chakratique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 75, 'sorts', 'Arcane', 'Voile Chakratique', 'Coût secondaire', 'ajoute', NULL, '15% santé par tour', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:voile-chakratique"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 76, 'sorts', 'Arcane', 'Voile Chakratique', 'Effets secondaires', 'modifie', 'Permet au Chakra de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM.', 'Permet au {{chakra|Chakra}} de prendre le rôle de la Santé. Le coût en santé passe à 10% si 3NM.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-larcane#sort:voile-chakratique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 77, 'sorts', 'Corruption', 'Boule sombre', 'Effets secondaires', 'modifie', 'Si CR : +1d de dégâts.', 'Si {{cr|CR}} : +1d de dégâts.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:boule-sombre"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 78, 'sorts', 'Corruption', 'Tir d''huile', 'Effets secondaires', 'modifie', 'Si CR : Inflige 3 corruption.', 'Si {{cr|CR}} : Inflige 3 {{corruption|corruption}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:tir-dhuile"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 79, 'sorts', 'Corruption', 'Verrouillage Simple', 'Effets secondaires', 'modifie', 'Dure 2 tours (+1/NM)
Si CR : Le changement de posture est aléatoire.', 'Dure 2 tours (+1/NM)
Si {{cr|CR}} : Le changement de posture est aléatoire.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:verrouillage-simple"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 80, 'sorts', 'Corruption', 'Verrouillage Visible', 'Effets secondaires', 'modifie', 'Dure 2 tours (+1/NM)
Si CR : Le changement de posture est aléatoire.', 'Dure 2 tours (+1/NM)
Si {{cr|CR}} : Le changement de posture est aléatoire.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:verrouille-visible"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 81, 'sorts', 'Corruption', 'Retrait', 'D/S/B', 'modifie', '2d6 cr (+1d/NM)', '2d6 {{cr|CR}} (+1d/NM)', 'neutre', '[{"partie":"valeur","avant":"2d6 cr","apres":"2d6 CR","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-corruption#sort:retrait"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 82, 'sorts', 'Corruption', 'Retrait', 'Effets secondaires', 'modifie', 'Retire de la corruption d''une cible pour la mettre dans la réserve.', 'Retire de la {{corruption|corruption}} d''une cible pour la mettre dans la réserve.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:retrait"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 83, 'sorts', 'Corruption', 'Aiguisage magique', 'Effets secondaires', 'modifie', 'Permet d''augmenter la réussite critique de 2% au prochain sort.
Si CR : Bonus de +5 dégâts en plus.', 'Permet d''augmenter la réussite critique de 2% au prochain sort.
Si {{cr|CR}} : Bonus de +5 dégâts en plus.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:aiguisage-magique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 84, 'sorts', 'Corruption', 'Fer corrompu', 'Effets secondaires', 'modifie', 'Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de corruption.', 'Imprègne l''arme d''une énergie mauvaise : pendant 3 tours, chacune de ses attaques inflige 5 points de {{corruption|corruption}} à la cible.', 'neutre', '[{"partie":"valeur","avant":"Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de corruption.","apres":"Imprègne l''arme d''une énergie mauvaise : pendant 3 tours, chacune de ses attaques inflige 5 points de corruption à la cible.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-corruption#sort:fer-corrompu"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 85, 'sorts', 'Corruption', 'Souffle noir', 'D/S/B', 'modifie', 'Retire du 2d10 de chakra à la cible', 'Retire du 2d10 de {{chakra|chakra}} à la cible', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:souffle-noir"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 86, 'sorts', 'Corruption', 'Souffle noir', 'Effets secondaires', 'modifie', 'Si CR : Inflige 2d6 de corruption en plus.', 'Si {{cr|CR}} : Inflige 2d6 de {{corruption|corruption}} en plus.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:souffle-noir"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 87, 'sorts', 'Corruption', 'Pétrole', 'Effets secondaires', 'modifie', 'Pose une zone qui ralentit ceux qui sont dedans. Capable de brûler.
Si CR : Bloque entièrement les cibles.', 'Pose une zone qui ralentit ceux qui sont dedans. Capable de brûler.
Si {{cr|CR}} : Bloque entièrement les cibles.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:petrole"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 88, 'sorts', 'Corruption', 'Vague déferlante', 'Effets secondaires', 'modifie', 'Peut être surchargé (15 chakra en + = 1 dé en +) (maximum 75 chakra en surcharge)
Si CR = Ignore 50% de l''AM.', 'Peut être surchargé (15 {{chakra|chakra}} en + = 1 dé en +) (maximum 75 {{chakra|chakra}} en surcharge)
Si {{cr|CR}} = Ignore 50% de l''AM.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:vague-deferlante"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 89, 'sorts', 'Corruption', 'Mine noire', 'Effets secondaires', 'modifie', 'Pose une mine qui explose quand une cible touche la zone. Ne se voit pas.
Si CR : Inflige 10 corruption', 'Pose une mine qui explose quand une cible touche la zone. Ne se voit pas.
Si {{cr|CR}} : Inflige 10 {{corruption|corruption}}', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:mine-noire"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 90, 'sorts', 'Corruption', 'Laser noir', 'Effets secondaires', 'modifie', 'Ignore totalement les AM et la barrière. Augmente la réussite critique de 1%/NM. 
Si CR : La cible a -20% pour le jet de défense', 'Ignore totalement les AM et la {{barriere|barrière}}. Augmente la réussite critique de 1%/NM. 
Si {{cr|CR}} : La cible a -20% pour le jet de défense', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:laser-noir"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 91, 'sorts', 'Corruption', 'Fouet ténébreux', 'Effets secondaires', 'modifie', 'Si jet de fermeté raté : Inflige 3 (+2/NM) corruption.
Si CR : Fait reculer la cible de 1 case.', 'Si jet de fermeté raté : Inflige 3 (+2/NM) {{corruption|corruption}}.
Si {{cr|CR}} : Fait reculer la cible de 1 case.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:fouet-tenebreux"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 92, 'sorts', 'Corruption', 'Plaie suintante', 'D/S/B', 'modifie', 'Bloque la barrière', 'Bloque la {{barriere|barrière}}', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:plaie-suintante"}', 'dsb_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 93, 'sorts', 'Corruption', 'Plaie suintante', 'Effets secondaires', 'modifie', 'Si jet de fermeté raté : Empêche la régénération de la barrière pour 3 tours.
Si CR : L''inflige automatiquement.', 'Si jet de fermeté raté : Empêche la régénération de la {{barriere|barrière}} pour 3 tours.
Si {{cr|CR}} : L''inflige automatiquement.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:plaie-suintante"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 94, 'sorts', 'Corruption', 'Aura de frayeur', 'Effets secondaires', 'modifie', 'Dure 3 tours. Si jet de Calme raté = Impossibilité pour la cible d''approcher. Si CR : Ceux qui ratent le jet fuient.', 'Dure 3 tours. Si jet de Calme raté = Impossibilité pour la cible d''approcher. Si {{cr|CR}} : Ceux qui ratent le jet fuient.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:aura-de-frayeur"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 95, 'sorts', 'Corruption', 'Pour moi !', 'Effets secondaires', 'modifie', 'Si CR : Retire un effet positif de la cible et le transforme en 1d10 barrière pour le lanceur.', 'Si {{cr|CR}} : Retire un effet positif de la cible et le transforme en 1d10 {{barriere|barrière}} pour le lanceur.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:pour-moi"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 96, 'sorts', 'Corruption', 'Grenade Collante', 'Effets secondaires', 'modifie', 'Explose dans 1 tour, inflige d''énormes dégâts de zone. (3NM = La grenade colle la cible)
Si CR : Le sort est inesquivable.', 'Explose dans 1 tour, inflige d''énormes dégâts de zone. (3NM = La grenade colle la cible)
Si {{cr|CR}} : Le sort est inesquivable.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:grenade-collante"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 97, 'sorts', 'Corruption', 'Verrouillage Magique', 'Effets secondaires', 'modifie', 'Dure 2 tours (+1/NM)
Si CR : Le changement de posture est aléatoire.', 'Dure 2 tours (+1/NM)
Si {{cr|CR}} : Le changement de posture est aléatoire.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:verrouillage-magique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 98, 'sorts', 'Corruption', 'Verrouillage Physique', 'Effets secondaires', 'modifie', 'Dure 2 tours (+1/NM)
Si CR : Le changement de posture est aléatoire.', 'Dure 2 tours (+1/NM)
Si {{cr|CR}} : Le changement de posture est aléatoire.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:verrouillage-physique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 99, 'sorts', 'Corruption', 'Pluie huileuse', 'Coût', 'modifie', '50% CR max', '0', 'neutre', '[{"partie":"valeur","avant":"50% CR max","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-corruption#sort:pluie-huileuse"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 100, 'sorts', 'Corruption', 'Pluie huileuse', 'Coût secondaire', 'ajoute', NULL, '50% corruption', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:pluie-huileuse"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 101, 'sorts', 'Corruption', 'Une tu meurs', 'Effets secondaires', 'modifie', 'Inflige une blessure qui va infliger des dégâts pendant 3 tours.
Si CR : Ignore la barrière.', 'Inflige une blessure qui va infliger des dégâts pendant 3 tours.
Si {{cr|CR}} : Ignore la {{barriere|barrière}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:une-tu-meurs"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 102, 'sorts', 'Corruption', 'Sapeur', 'Coût', 'modifie', 'x CR', '0', 'neutre', '[{"partie":"valeur","avant":"x CR","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-corruption#sort:sapeur"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 103, 'sorts', 'Corruption', 'Sapeur', 'Coût secondaire', 'ajoute', NULL, 'X Corruption', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:sapeur"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 104, 'sorts', 'Corruption', 'Sapeur', 'Effets secondaires', 'modifie', 'Donne autant de corruption à la cible que la réserve actuelle de corruption.', 'Donne autant de {{corruption|corruption}} à la cible que la réserve actuelle de {{corruption|corruption}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:sapeur"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 105, 'sorts', 'Corruption', 'Eau noire', 'Effets secondaires', 'modifie', 'Baisse d''un cran les résistances magiques pendant 3 tours.
Si CR : Les retire complètement', 'Baisse d''un cran les résistances magiques pendant 3 tours.
Si {{cr|CR}} : Les retire complètement', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-corruption#sort:eau-noire"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 106, 'sorts', 'Espace/Temps', 'Portail', 'Remarque', 'modifie', 'Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du chakra.', 'Maximum 4 portails reliés entre eux à la fois, pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du {{chakra|chakra}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lespace-temps#sort:portail"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 107, 'sorts', 'Espace/Temps', 'Fer Temporel', 'Effets secondaires', 'modifie', 'Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours.', 'Rend l''arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d''espace-temps.', 'neutre', '[{"partie":"valeur","avant":"Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours.","apres":"Rend l''arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d''espace-temps.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lespace-temps#sort:fer-temporel"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 108, 'sorts', 'Espace/Temps', 'Horloge aspirante', 'Remarque', 'modifie', 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'Si c''est la {{barriere|barrière}}, la {{barriere|barrière}} est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lespace-temps#sort:horloge-aspirante"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 109, 'sorts', 'Espace/Temps', 'Image diffuse', 'Coût', 'modifie', '10/Clones', '10', 'neutre', '[{"partie":"valeur","avant":"10/Clones","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lespace-temps#sort:image-diffuse"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 110, 'sorts', 'Espace/Temps', 'Image diffuse', 'Coût secondaire', 'ajoute', NULL, 'Par clone', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lespace-temps#sort:image-diffuse"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 111, 'sorts', 'Vide', 'Télékinésie', 'Coût', 'modifie', '4/taille', '4', 'neutre', '[{"partie":"valeur","avant":"4/taille","apres":"4","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-vide#sort:telekinesie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 112, 'sorts', 'Vide', 'Télékinésie', 'Coût secondaire', 'ajoute', NULL, 'Par taille créée', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vide#sort:telekinesie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 113, 'sorts', 'Vide', 'Fer Vide', 'Effets secondaires', 'modifie', 'Rend l''arme transparente, tape dans l''élément Vide pendant 3 tours.', 'Rend l''arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide.', 'neutre', '[{"partie":"valeur","avant":"Rend l''arme transparente, tape dans l''élément Vide pendant 3 tours.","apres":"Rend l''arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-vide#sort:fer-vide"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 114, 'sorts', 'Vide', 'Lien mental', 'Coût', 'modifie', '3/perso', '3', 'neutre', '[{"partie":"valeur","avant":"3/perso","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-vide#sort:lien-mental"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 115, 'sorts', 'Vide', 'Lien mental', 'Coût secondaire', 'ajoute', NULL, 'Par personne', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vide#sort:lien-mental"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 116, 'sorts', 'Vide', 'Toucher du Vide', 'Remarque', 'modifie', 'Si c''est la barrière, la barrière est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'Si c''est la {{barriere|barrière}}, la {{barriere|barrière}} est vampirisée.
Si c''est les points de vie, c''est les points de vie qui sont vampirisés', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vide#sort:touche-du-vide"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 117, 'sorts', 'Vide', 'Métronome', 'Coût', 'modifie', 'Variable', 'N/A', 'neutre', '[{"partie":"valeur","avant":"Variable","apres":"N/A","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-vide#sort:metronome"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 118, 'sorts', 'Vide', 'Métronome', 'Coût secondaire', 'ajoute', NULL, 'Aléatoire', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-vide#sort:metronome"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 119, 'sorts', 'Nécromancie', 'Tir d''âme', 'Coût', 'modifie', '3 + 1 âme', '3', 'neutre', '[{"partie":"valeur","avant":"3 + 1 âme","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:tir-dame"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 120, 'sorts', 'Nécromancie', 'Tir d''âme', 'Coût secondaire', 'ajoute', NULL, '1 âme', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:tir-dame"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 121, 'sorts', 'Nécromancie', 'Animation de mort', 'Coût', 'modifie', '5 + 1 âme (xNPM de créature)', '5', 'neutre', '[{"partie":"valeur","avant":"5 + 1 âme (xNPM de créature)","apres":"5","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:animation-de-mort"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 122, 'sorts', 'Nécromancie', 'Animation de mort', 'Coût secondaire', 'ajoute', NULL, 'Par NPM de la créature invoquée. +1 Âme par NPM de la créature invoquée.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:animation-de-mort"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 123, 'sorts', 'Nécromancie', 'Animation de mort', 'Effets secondaires', 'modifie', 'Permet d''invoquer des non-morts (voir invocation)', 'Permet d''invoquer des non-morts', 'neutre', '[{"partie":"valeur","avant":"Permet d''invoquer des non-morts (voir invocation)","apres":"Permet d''invoquer des non-morts","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:animation-de-mort"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 124, 'sorts', 'Nécromancie', 'Animation de mort', 'Remarque', 'modifie', 'Niveau 1 : 3 CK + 1 âme
Niveau 2 : 6 CK + 2 âmes
Niveau 3 : 12 CK + 3 âmes
Niveau 4 : 24 CK + 4 âmes
Niveau 5 : 48 CK + 5 âmes

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.

Pour voir les morts-vivants possibles https://maverick-jdr.fandom.com/fr/wiki/Mort-Vivant_(Invocation)

Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.', 'Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l''invoquer.

Les familiers et invocations ne peuvent pas utiliser ce sort.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:animation-de-mort"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 125, 'sorts', 'Nécromancie', 'Mur d''os', 'Coût', 'modifie', '4 + 1 âme', '4', 'neutre', '[{"partie":"valeur","avant":"4 + 1 âme","apres":"4","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:mur-dos"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 126, 'sorts', 'Nécromancie', 'Mur d''os', 'Coût secondaire', 'ajoute', NULL, '1 âme', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:mur-dos"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 127, 'sorts', 'Nécromancie', 'Corruption d''âme', 'Coût', 'modifie', '2 âmes', '0', 'neutre', '[{"partie":"valeur","avant":"2 âmes","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:corruption-dame"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 128, 'sorts', 'Nécromancie', 'Corruption d''âme', 'Coût secondaire', 'ajoute', NULL, '2 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:corruption-dame"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 129, 'sorts', 'Nécromancie', 'Détection de vie', 'Coût', 'modifie', '7 (–1/NM) + 1 âme', '7 (–1/NM)', 'neutre', '[{"partie":"valeur","avant":"7 + 1 âme","apres":"7","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:detection-de-vie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 130, 'sorts', 'Nécromancie', 'Détection de vie', 'Coût secondaire', 'ajoute', NULL, '1 âme', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:detection-de-vie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 131, 'sorts', 'Nécromancie', 'Forces des âmes', 'Coût', 'modifie', '1 âme pour +3 dégâts', '0', 'neutre', '[{"partie":"valeur","avant":"1 âme pour +3 dégâts","apres":"0","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:forces-des-ames"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 132, 'sorts', 'Nécromancie', 'Forces des âmes', 'Coût secondaire', 'ajoute', NULL, '1 à 5 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:forces-des-ames"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 133, 'sorts', 'Nécromancie', 'Pieu d''os', 'Coût', 'modifie', '7 + 2 âmes', '7', 'neutre', '[{"partie":"valeur","avant":"7 + 2 âmes","apres":"7","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:pieu-dos"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 134, 'sorts', 'Nécromancie', 'Pieu d''os', 'Coût secondaire', 'ajoute', NULL, '2 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:pieu-dos"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 135, 'sorts', 'Nécromancie', 'Armure d''os', 'Coût', 'modifie', '5 + 2 âmes', '5', 'neutre', '[{"partie":"valeur","avant":"5 + 2 âmes","apres":"5","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:armure-dos"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 136, 'sorts', 'Nécromancie', 'Armure d''os', 'Coût secondaire', 'ajoute', NULL, '2 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:armure-dos"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 137, 'sorts', 'Nécromancie', 'Détection de la mort', 'Coût', 'modifie', '10 (–1/NM) + 2 âmes', '10 (–1/NM)', 'neutre', '[{"partie":"valeur","avant":"10 + 2 âmes","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:detection-de-la-mort"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 138, 'sorts', 'Nécromancie', 'Détection de la mort', 'Coût secondaire', 'ajoute', NULL, '2 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:detection-de-la-mort"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 139, 'sorts', 'Nécromancie', 'Fer Toxique', 'Effets secondaires', 'modifie', 'L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours.', 'L''arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie.', 'neutre', '[{"partie":"valeur","avant":"L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours.","apres":"L''arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:fer-toxique"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 140, 'sorts', 'Nécromancie', 'Festin des âmes', 'Coût', 'modifie', '12 + 6 âmes', '12', 'neutre', '[{"partie":"valeur","avant":"12 + 6 âmes","apres":"12","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:festin-des-ames"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 141, 'sorts', 'Nécromancie', 'Festin des âmes', 'Coût secondaire', 'ajoute', NULL, '6 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:festin-des-ames"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 142, 'sorts', 'Nécromancie', 'Prison d''os', 'Coût', 'modifie', '12 + 3 âmes', '12', 'neutre', '[{"partie":"valeur","avant":"12 + 3 âmes","apres":"12","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:prison-dos"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 143, 'sorts', 'Nécromancie', 'Prison d''os', 'Coût secondaire', 'ajoute', NULL, '3 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:prison-dos"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 144, 'sorts', 'Nécromancie', 'Forge de ses morts', 'Coût', 'modifie', '9 + 2 âmes', '9', 'neutre', '[{"partie":"valeur","avant":"9 + 2 âmes","apres":"9","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:forge-de-ses-morts"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 145, 'sorts', 'Nécromancie', 'Forge de ses morts', 'Coût secondaire', 'ajoute', NULL, '2 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:forge-de-ses-morts"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 146, 'sorts', 'Nécromancie', 'Câlin putréfié', 'Coût', 'modifie', '13 + 3 âmes', '13', 'neutre', '[{"partie":"valeur","avant":"13 + 3 âmes","apres":"13","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:calin-putrefie"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 147, 'sorts', 'Nécromancie', 'Câlin putréfié', 'Coût secondaire', 'ajoute', NULL, '3 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:calin-putrefie"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 148, 'sorts', 'Nécromancie', 'Amélioration Cadavérique', 'Coût', 'modifie', '20 + 4 âmes', '20', 'neutre', '[{"partie":"valeur","avant":"20 + 4 âmes","apres":"20","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:amelioration-cadaverique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 149, 'sorts', 'Nécromancie', 'Amélioration Cadavérique', 'Coût secondaire', 'ajoute', NULL, '4 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:amelioration-cadaverique"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 150, 'sorts', 'Nécromancie', 'Vague de cadavres', 'Coût', 'modifie', '20 + 4 âmes', '20', 'neutre', '[{"partie":"valeur","avant":"20 + 4 âmes","apres":"20","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:vague-de-cadavre"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 151, 'sorts', 'Nécromancie', 'Vague de cadavres', 'Coût secondaire', 'ajoute', NULL, '4 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:vague-de-cadavre"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 152, 'sorts', 'Nécromancie', 'Grenade caustique', 'Coût', 'modifie', '25 + 4 âmes', '25', 'neutre', '[{"partie":"valeur","avant":"25 + 4 âmes","apres":"25","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:grenade-caustique"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 153, 'sorts', 'Nécromancie', 'Grenade caustique', 'Coût secondaire', 'ajoute', NULL, '4 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:grenade-caustique"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 154, 'sorts', 'Nécromancie', 'Cimetière ouvert', 'Coût', 'modifie', '18 + 4 âmes', '18', 'neutre', '[{"partie":"valeur","avant":"18 + 4 âmes","apres":"18","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:cimetiere-ouvert"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 155, 'sorts', 'Nécromancie', 'Cimetière ouvert', 'Coût secondaire', 'ajoute', NULL, '4 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:cimetiere-ouvert"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 156, 'sorts', 'Nécromancie', 'Répar''Os', 'Coût', 'modifie', '20 + 5 âmes', '20', 'neutre', '[{"partie":"valeur","avant":"20 + 5 âmes","apres":"20","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:repar-os"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 157, 'sorts', 'Nécromancie', 'Répar''Os', 'Coût secondaire', 'ajoute', NULL, '5 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:repar-os"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 158, 'sorts', 'Nécromancie', 'Réanimation', 'Coût', 'modifie', '45 (-2/NM) + 10 âmes', '45 (-2/NM)', 'neutre', '[{"partie":"valeur","avant":"45 + 10 âmes","apres":"45","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:reanimation"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 159, 'sorts', 'Nécromancie', 'Réanimation', 'Coût secondaire', 'ajoute', NULL, '10 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:reanimation"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 160, 'sorts', 'Nécromancie', 'Résurrection Noire', 'Coût', 'modifie', '35 (-2/NM) + 10 âmes', '35 (-2/NM)', 'neutre', '[{"partie":"valeur","avant":"35 + 10 âmes","apres":"35","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-necromancie#sort:resurrection-noir"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 161, 'sorts', 'Nécromancie', 'Résurrection Noire', 'Coût secondaire', 'ajoute', NULL, '10 âmes', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:resurrection-noir"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 162, 'sorts', 'Nécromancie', 'Résurrection Noire', 'Effets secondaires', 'modifie', 'Revient sans PV, le chakra est utilisé comme énergie.', 'Revient sans PV, le {{chakra|chakra}} est utilisé comme énergie.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-necromancie#sort:resurrection-noir"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 163, 'sorts', 'Feu', 'Fer brûlant', 'Effets secondaires', 'modifie', 'Chauffe le métal à blanc, l''arme inflige l''élément Feu pendant 3 tours.', 'Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu.', 'neutre', '[{"partie":"valeur","avant":"Chauffe le métal à blanc, l''arme inflige l''élément Feu pendant 3 tours.","apres":"Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-feu#sort:fer-brulant"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 164, 'sorts', 'Feu', 'Bûcher purifiant', 'Coût', 'modifie', '50 + 20% PV', '50', 'neutre', '[{"partie":"valeur","avant":"50 + 20% PV","apres":"50","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-feu#sort:bucher-purifiant"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 165, 'sorts', 'Feu', 'Bûcher purifiant', 'Coût secondaire', 'ajoute', NULL, '20% PV', 'neutre', NULL, 'sort', '{"id":"magies/magie-du-feu#sort:bucher-purifiant"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 166, 'sorts', 'Eau', 'Fer Humide', 'Effets secondaires', 'modifie', 'L''arme transpire de l''eau, tape dans l''élément Eau pendant 3 tours.', 'L''arme transpire de l''eau : pendant 3 tours, ses attaques infligent des dégâts d''eau.', 'neutre', '[{"partie":"valeur","avant":"L''arme transpire de l''eau, tape dans l''élément Eau pendant 3 tours.","apres":"L''arme transpire de l''eau : pendant 3 tours, ses attaques infligent des dégâts d''eau.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-leau#sort:fer-humide"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 167, 'sorts', 'Eau', 'Barrière d''eau', 'Effets secondaires', 'modifie', 'Régénère 10% de la barrière (+5% par Niveau de Maîtrise), +10 barrière bonus si jamais fait à 4 cases de l''eau.', 'Régénère 10% de la {{barriere|barrière}} (+5% par Niveau de Maîtrise), +10 {{barriere|barrière}} bonus si jamais fait à 4 cases de l''eau.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-leau#sort:barriere-deau"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 168, 'sorts', 'Eau', 'Pitié d''Océane', 'Effets secondaires', 'modifie', 'Permet de ranimer un allié dans le coma en lui redonnant 1PV et 100% de sa barrière. Donne 10PV près d''un point d''eau.', 'Permet de ranimer un allié dans le coma en lui redonnant 1PV et 100% de sa {{barriere|barrière}}. Donne 10PV près d''un point d''eau.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-leau#sort:pitie-doceane"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 169, 'sorts', 'Eau', 'Pitié d''Océane', 'Texte du sort (niveau 5)', 'modifie', 'Ô Océane, que ta marée relève le corps brisé,
Que tes eaux referment ce que la douleur a ouvert,
Que la mer rende souffle à celui qui l’a perdu,
Que la barrière se reforme sous ton courant apaisant,
Et que ta bienveillance nous le ramène vers nous…

PITIÉ D’OCÉANE !', 'Ô Océane, que ta marée relève le corps brisé,
Que tes eaux referment ce que la douleur a ouvert,
Que la mer rende souffle à celui qui l’a perdu,
Que la {{barriere|barrière}} se reforme sous ton courant apaisant,
Et que ta bienveillance nous le ramène vers nous…

PITIÉ D’OCÉANE !', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-leau#sort:pitie-doceane"}', 'texte_niveau5');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 170, 'sorts', 'Glace', 'Sculpteur glacé', 'Coût', 'modifie', '3 / Taille', '3', 'neutre', '[{"partie":"valeur","avant":"3 / Taille","apres":"3","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-glace#sort:sculpteur-glace"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 171, 'sorts', 'Glace', 'Sculpteur glacé', 'Coût secondaire', 'ajoute', NULL, 'Par taille créée', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-glace#sort:sculpteur-glace"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 172, 'sorts', 'Glace', 'Fer froid', 'Effets secondaires', 'modifie', 'Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours.', 'Refroidit l''arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace.', 'neutre', '[{"partie":"valeur","avant":"Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours.","apres":"Refroidit l''arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-glace#sort:fer-froid"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 173, 'sorts', 'Glace', 'Exécution froide', 'Coût', 'modifie', '20/tour', '20', 'neutre', '[{"partie":"valeur","avant":"20/tour","apres":"20","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-glace#sort:execution-froide"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 174, 'sorts', 'Glace', 'Exécution froide', 'Coût secondaire', 'ajoute', NULL, 'Par tour', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-glace#sort:execution-froide"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 175, 'sorts', 'Terre', 'Appel aux Golems', 'Coût', 'modifie', '6 (xNP de créature)', '6', 'neutre', '[{"partie":"valeur","avant":"6 (xNP de créature)","apres":"6","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-terre#sort:appel-aux-golems"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 176, 'sorts', 'Terre', 'Appel aux Golems', 'Coût secondaire', 'ajoute', NULL, 'Par NPM de la créature invoquée', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-terre#sort:appel-aux-golems"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 177, 'sorts', 'Terre', 'Fer Raffiné', 'Effets secondaires', 'modifie', 'Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours.', 'Renforce l''arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre.', 'neutre', '[{"partie":"valeur","avant":"Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours.","apres":"Renforce l''arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-terre#sort:fer-raffine"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 178, 'sorts', 'Terre', 'Barrière rocheuse', 'Effets secondaires', 'modifie', 'Confère une protection par-dessus la barrière qui encaisse les coups inférieurs à 20 dégâts (+7/NM)', 'Confère une protection par-dessus la {{barriere|barrière}} qui encaisse les coups inférieurs à 20 dégâts (+7/NM)', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-terre#sort:barriere-rocheuse"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 179, 'sorts', 'Terre', 'Sable changeant', 'Coût', 'modifie', '10/3x3', '10', 'neutre', '[{"partie":"valeur","avant":"10/3x3","apres":"10","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-terre#sort:sable-changeant"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 180, 'sorts', 'Terre', 'Sable changeant', 'Coût secondaire', 'ajoute', NULL, 'Par zone de 3x3', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-terre#sort:sable-changeant"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 181, 'sorts', 'Vent', 'Fer éolien', 'Effets secondaires', 'modifie', 'L''arme crache du vent, tape dans l''élément Vent pendant 3 tours.', 'L''arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent.', 'neutre', '[{"partie":"valeur","avant":"L''arme crache du vent, tape dans l''élément Vent pendant 3 tours.","apres":"L''arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-du-vent#sort:fer-eolien"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 182, 'sorts', 'Foudre', 'Fer Foudroyant', 'Effets secondaires', 'modifie', 'Charge l''arme en électricité, tape dans l''élément foudre pendant 3 tours.', 'Charge l''arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre.', 'neutre', '[{"partie":"valeur","avant":"Charge l''arme en électricité, tape dans l''élément foudre pendant 3 tours.","apres":"Charge l''arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-foudre#sort:fer-foudroyant"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 183, 'sorts', 'Foudre', 'Orage Violet', 'Effets secondaires', 'modifie', 'Une attaque surpuissante de foudre qui tape en zone. 15% des dégâts se répercutent dans le chakra.', 'Une attaque surpuissante de foudre qui tape en zone. 15% des dégâts se répercutent dans le {{chakra|chakra}}.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-foudre#sort:orage-violet"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 184, 'sorts', 'Lumière', 'Champ de Force', 'Effets secondaires', 'modifie', 'Bloque 10 dégâts (+5/NM) (peut être surchargé en chakra +2 dégâts/chakra).', 'Bloque 10 dégâts (+5/NM) (peut être surchargé en {{chakra|chakra}} +2 dégâts/{{chakra|chakra}}).', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-lumiere#sort:champ-de-force"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 185, 'sorts', 'Lumière', 'Champ de Force', 'Remarque', 'modifie', 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 chakra maximum', 'Le champ de force reste tant qu''aucun coup n''a été pris. Il disparaît après l''attaque ennemie. Il va réduire les dégâts AVANT l''armure.

La surcharge peut être amplifiée avec 20 {{chakra|chakra}} maximum', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-lumiere#sort:champ-de-force"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 186, 'sorts', 'Lumière', 'Fer Lumineux', 'Effets secondaires', 'modifie', 'Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours.', 'Rend l''arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière.', 'neutre', '[{"partie":"valeur","avant":"Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours.","apres":"Rend l''arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-la-lumiere#sort:fer-lumineux"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 187, 'sorts', 'Lumière', 'Énergie Solaire', 'Effets secondaires', 'modifie', 'Permet de récupérer *10% de barrière lors des météos de soleil.', 'Permet de récupérer *10% de {{barriere|barrière}} lors des météos de soleil.', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-la-lumiere#sort:energie-solaire"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 188, 'sorts', 'Ombre', 'Marionnette de l''ombre', 'Coût', 'modifie', '5 + 10% BA (xNPM de créature)', '5', 'neutre', '[{"partie":"valeur","avant":"5 + 10% BA (xNPM de créature)","apres":"5","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lombre#sort:marionnette-de-lombre"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 189, 'sorts', 'Ombre', 'Marionnette de l''ombre', 'Coût secondaire', 'ajoute', NULL, 'Par NPM de la créature invoquée. +10% Barrière', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lombre#sort:marionnette-de-lombre"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 190, 'sorts', 'Ombre', 'Manteau noir', 'Coût', 'modifie', '7 (xNP de créature)', '7', 'neutre', '[{"partie":"valeur","avant":"7 (xNP de créature)","apres":"7","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lombre#sort:manteau-noir"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 191, 'sorts', 'Ombre', 'Manteau noir', 'Coût secondaire', 'ajoute', NULL, 'Par NPM de la créature sacrifiée', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lombre#sort:manteau-noir"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 192, 'sorts', 'Ombre', 'Fer Obscur', 'Effets secondaires', 'modifie', 'L''arme se charge d''une énergie sombre, tape dans l''élément ombre pendant 3 tours.', 'L''arme se charge d''une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d''ombre.', 'neutre', '[{"partie":"valeur","avant":"L''arme se charge d''une énergie sombre, tape dans l''élément ombre pendant 3 tours.","apres":"L''arme se charge d''une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d''ombre.","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lombre#sort:fer-obscur"}', 'effets');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 193, 'sorts', 'Ombre', 'Amplification sombre', 'Coût', 'modifie', '5 + 10% santé', '5', 'neutre', '[{"partie":"valeur","avant":"5 + 10% santé","apres":"5","sens":"neutre"}]', 'sort', '{"id":"magies/magie-de-lombre#sort:amplification-sombre"}', 'cout_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 194, 'sorts', 'Ombre', 'Amplification sombre', 'Coût secondaire', 'ajoute', NULL, '10% santé', 'neutre', NULL, 'sort', '{"id":"magies/magie-de-lombre#sort:amplification-sombre"}', 'cout_secondaire');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 195, 'magies', 'Arcane', 'Arcane', 'Explication', 'modifie', 'Chaque sort qui possède un coût en chakra "x/tour" ne possède pas de limite de tour et va consommer du chakra tant qu''il est actif. Le lanceur doit faire un jet de magie pour pouvoir réussir son sort (normal jusque-là) et une fois le sort lancé, le sort est maintenu tant que le lanceur le décide ou qu''il perd sa concentration. Il est possible de cumuler plusieurs fois le même sort ou alors de placer le même sort sur différentes cibles, le coût par tour en sera bien plus grand vu que tout se cumule.

Perdre son sort : Si jamais une attaque est encaissée, il est nécessaire de faire un jet de magie/concentration, si jamais il est raté, la concentration est perdue et tous les sorts qui étaient actifs s''arrêtent immédiatement.

Un sort qui possède la mention : XxN/tour, veut dire que le sort va coûter un certain nombre de chakra (X) par nombre d''applications qu''il y a eu (N) par tour.
Exemple : J''ai posé sur 3 personnes différentes un sort qui coûte 3. Donc en 1 tour je vais consommer 9 chakra.', 'Chaque sort qui possède un coût en {{chakra|chakra}} "x/tour" ne possède pas de limite de tour et va consommer du {{chakra|chakra}} tant qu''il est actif. Le lanceur doit faire un jet de magie pour pouvoir réussir son sort (normal jusque-là) et une fois le sort lancé, le sort est maintenu tant que le lanceur le décide ou qu''il perd sa concentration. Il est possible de cumuler plusieurs fois le même sort ou alors de placer le même sort sur différentes cibles, le coût par tour en sera bien plus grand vu que tout se cumule.

Perdre son sort : Si jamais une attaque est encaissée, il est nécessaire de faire un jet de magie/concentration, si jamais il est raté, la concentration est perdue et tous les sorts qui étaient actifs s''arrêtent immédiatement.

Un sort qui possède la mention : XxN/tour, veut dire que le sort va coûter un certain nombre de {{chakra|chakra}} (X) par nombre d''applications qu''il y a eu (N) par tour.
Exemple : J''ai posé sur 3 personnes différentes un sort qui coûte 3. Donc en 1 tour je vais consommer 9 {{chakra|chakra}}.', 'neutre', NULL, 'magie', '{"id":"magies/magie-de-larcane"}', 'explication');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 196, 'magies', 'Corruption', 'Capacité Mode Hyper (Bi-magie)', 'Effet', 'modifie', 'Divise par 2 le coût en corruption des sorts.', 'Divise par 2 le coût en {{corruption|corruption}} des sorts.', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_magie:magies/magie-de-la-corruption:bi"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 197, 'magies', 'Corruption', 'Capacité Mode Hyper (Mono-Magie)', 'Effet', 'modifie', 'Le chakra active directement les effets secondaires', 'Le {{chakra|chakra}} active directement les effets secondaires', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_magie:magies/magie-de-la-corruption:mono"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 198, 'magies', 'Corruption', 'Corruption', 'Explication', 'modifie', 'L''utilisateur de la corruption est un combattant qui fait énormément de dégâts et utilise énormément d''entrave. Il utilise le Chakra et la Corruption comme un système de vases communicants.

Chaque sort demande du chakra, à chaque utilisation d''un sort, le coût en chakra se transfère dans la corruption (si un sort coûte 4, vous obtenez 4 corruption), il est possible d''utiliser cette réserve de corruption pour lancer les mêmes sorts mais avec des effets supplémentaires mais il faut consommer le double du coût en corruption (si le sort coûte 4, il vous faut 8 corruption). Bien entendu ceux qui sont de la corruption sont totalement immunisés à l''effet négatif du trop-plein de corruption (qui est la transformation en abomination solvité, donc une mort du personnage) mais prudence, car quand on est gavé de corruption cela se voit physiquement sur le personnage et la corruption reste une magie mal vue.

Attention, si le chakra permet d''obtenir de la corruption, l''inverse ne se fait pas. Et la corruption n''empiète pas dans l''espace du chakra.', 'L''utilisateur de la corruption est un combattant qui fait énormément de dégâts et utilise énormément d''entrave. Il utilise le {{chakra|Chakra}} et la {{corruption|Corruption}} comme un système de vases communicants.

Chaque sort demande du {{chakra|chakra}}, à chaque utilisation d''un sort, le coût en {{chakra|chakra}} se transfère dans la {{corruption|corruption}} (si un sort coûte 4, vous obtenez 4 {{corruption|corruption}}), il est possible d''utiliser cette réserve de {{corruption|corruption}} pour lancer les mêmes sorts mais avec des effets supplémentaires mais il faut consommer le double du coût en {{corruption|corruption}} (si le sort coûte 4, il vous faut 8 {{corruption|corruption}}). Bien entendu ceux qui sont de la corruption sont totalement immunisés à l''effet négatif du trop-plein de {{corruption|corruption}} (qui est la transformation en abomination, donc une mort du personnage) mais prudence, car quand on est gavé de {{corruption|corruption}} cela se voit physiquement sur le personnage et la corruption reste une magie mal vue.

Attention, si le {{chakra|chakra}} permet d''obtenir de la {{corruption|corruption}}, l''inverse ne se fait pas. Et, comme pour tous, chaque point de {{corruption|corruption}} empêche de récupérer un point de {{chakra|chakra}} : c''est en gros la même réserve, remplie avec autre chose.', 'neutre', NULL, 'magie', '{"id":"magies/magie-de-la-corruption"}', 'explication');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 199, 'classes', 'Arbalétrier', 'Don BALISTE › Pré-mythril', 'Effet', 'modifie', 'Un carreau spécial qui ignore complètement la barrière de la cible.', 'Un carreau spécial qui ignore complètement la {{barriere|barrière}} de la cible.', 'neutre', NULL, 'capacite', '{"id":"capacites/arbaletrier-pre-mythril"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 200, 'classes', 'Lanceur', 'Don JONGLEUR › Jongleur Magique', 'Effet', 'modifie', 'Permet d''utiliser les sorts de Fer Élémentaire sur toutes les armes de jet du même type en votre possession.', 'Permet d''utiliser les {{sort-fer|sorts de Fer Élémentaire}} sur toutes les armes de jet du même type en votre possession.', 'neutre', NULL, 'capacite', '{"id":"capacites/lanceur-jongleur-magique"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 201, 'classes', 'Mage', 'Don MAGE NOIR › Magibalisme', 'Effet', 'modifie', 'Permet de récupérer 25% de Chakra après avoir mis hors combat un adversaire.', 'Permet de récupérer 25% de {{chakra|Chakra}} après avoir mis hors combat un adversaire.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-magibalisme"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 202, 'classes', 'Barde', 'Don DANSEUR › Shrapnel', 'Effet', 'modifie', 'À la rupture de sa barrière le barde bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'À la rupture de sa {{barriere|barrière}} le barde bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-shrapnel"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 203, 'classes', 'Barde', 'Don Chant double', 'Effet', 'modifie', 'Double les sorts utilisés pendant son tour. Mais double le cout en chakra.', 'Double les sorts utilisés pendant son tour. Mais double le cout en {{chakra|chakra}}.', 'neutre', NULL, 'capacite', '{"id":"capacites/barde-chant-double"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 204, 'classes', 'Mage Rouge', 'Spécialité MAGE RUBIS', 'Description', 'modifie', 'Le Mage Rubis repousse les limites de la puissance magique en concentrant son énergie pour frapper plus fort que n’importe quel autre mage de mêlée. Chaque sort qu’il lance, qu’il soit préparé ou instantané, gagne en intensité, écrasant les adversaires.

Sa magie brute lui permet de briser les barrières ou d’ignorer l’armure magique. Capable d’associer sa magie à son arme ou de déclencher des sorts directement par la tête, il est une volonté implacable, où chaque coup porte toute la détermination de sa mission.', 'Le Mage Rubis repousse les limites de la puissance magique en concentrant son énergie pour frapper plus fort que n’importe quel autre mage de mêlée. Chaque sort qu’il lance, qu’il soit préparé ou instantané, gagne en intensité, écrasant les adversaires.

Sa magie brute lui permet de briser les {{barriere|barrières}} ou d’ignorer l’armure magique. Capable d’associer sa magie à son arme ou de déclencher des sorts directement par la tête, il est une volonté implacable, où chaque coup porte toute la détermination de sa mission.', 'neutre', NULL, 'specialite', '{"id":"classes/mage-rouge#specialite:mage-rubis"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 205, 'classes', 'Mage Rouge', 'Don MAGE RUBIS › Destructeur', 'Effet', 'modifie', '(Posture Focus)
Dégâts à la barrière avec la magie = x2', '(Posture Focus)
Dégâts à la {{barriere|barrière}} avec la magie = x2', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-destructeur"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 206, 'classes', 'Mage Rouge', 'Don Double coup', 'Remarque', 'modifie', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le {{chakra|chakra}} à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-rouge-double-coup"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 207, 'classes', 'Mage Bleu', 'Don DRESSEUR BLEU › Animagie', 'Effet', 'modifie', 'Vous pouvez utiliser le chakra de votre familier pour vos propres sorts ou l''inverse.', 'Vous pouvez utiliser le {{chakra|chakra}} de votre familier pour vos propres sorts ou l''inverse.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-bleu-animagie"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 208, 'classes', 'Mage Vert', 'Spécialité MAGE ÉMERAUDE', 'Description', 'modifie', 'Le Mage Émeraude ne se contente pas de tirer, il perfectionne chaque coup en exploitant la posture Focus. Maître de son arme et de sa volonté, il canalise son énergie pour transformer chaque projectile en un tir quasi imparable.

Grâce à son expertise, il renforce l’impact des sorts "fer", perce les résistances magiques et ajuste sa visée pour atteindre des points faibles.', 'Le Mage Émeraude ne se contente pas de tirer, il perfectionne chaque coup en exploitant la posture Focus. Maître de son arme et de sa volonté, il canalise son énergie pour transformer chaque projectile en un tir quasi imparable.

Grâce à son expertise, il renforce l’impact des {{sort-fer|sorts "fer"}}, perce les résistances magiques et ajuste sa visée pour atteindre des points faibles.', 'neutre', NULL, 'specialite', '{"id":"classes/mage-vert#specialite:mage-emeraude"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 209, 'classes', 'Mage Vert', 'Don MAGE ÉMERAUDE › ... Brutale', 'Remarque', 'modifie', 'Les sorts "fer"', 'Les {{sort-fer|sorts "fer"}}', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-brutale"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 210, 'classes', 'Mage Vert', 'Don MAGE JADE › À l''aise', 'Effet', 'modifie', 'Le sort influé aura toujours au minimum un Niveau de Maîtrise.', 'Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-a-laise"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 211, 'classes', 'Mage Vert', 'Don MAGE JADE › Munition Spéciale', 'Effet', 'modifie', '(Posture Symbiose)
Permet d''utiliser l''arme à distance et tirer des projectiles faits en chakra, tape dans l''élément de la symbiose. Coûte 4 chakra.', '(Posture Symbiose)
Permet d''utiliser l''arme à distance et tirer des projectiles faits en chakra, tape dans l''élément de la symbiose. Coûte 4 {{chakra|chakra}}.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-munition-speciale"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 212, 'classes', 'Mage Vert', 'Don Double coup', 'Remarque', 'modifie', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le chakra à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'Dans le cas d''un critique, ce sera que pour le premier coup, les prochains c''est fixé à 40 de réussite.
Consomme le {{chakra|chakra}} à chaque sort.

Pensez bien à noter la réussite du sort pour ne pas le perdre.', 'neutre', NULL, 'capacite', '{"id":"capacites/mage-vert-double-coup"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 213, 'classes', 'Clerc', 'Clerc', 'Présentation', 'modifie', 'Dévoué à sa divinité, le Clerc canalise sa foi pour se protéger et guider ses alliés. Son lien sacré avec sa magie et divinité lui confère une résistance accrue à sa propre magie et lui permet de se rapprocher des volontés divines.

Armé de haches ou de masses consacrées, il équilibre force physique et puissance spirituelle, régénérant mieux son Chakra par la méditation. Inébranlable face aux forces obscures, il se tient prêt à défendre son culte et à abattre les hérétiques d’un coup béni.', 'Dévoué à sa divinité, le Clerc canalise sa foi pour se protéger et guider ses alliés. Son lien sacré avec sa magie et divinité lui confère une résistance accrue à sa propre magie et lui permet de se rapprocher des volontés divines.

Armé de haches ou de masses consacrées, il équilibre force physique et puissance spirituelle, régénérant mieux son {{chakra|Chakra}} par la méditation. Inébranlable face aux forces obscures, il se tient prêt à défendre son culte et à abattre les hérétiques d’un coup béni.', 'neutre', NULL, 'classe', '{"id":"classes/clerc"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 214, 'classes', 'Clerc', 'Don Médi profonde', 'Effet', 'modifie', 'La méditation et le repos redonnent +8 Chakra.', 'La méditation et le repos redonnent +8 {{chakra|Chakra}}.', 'neutre', NULL, 'capacite', '{"id":"capacites/clerc-medi-profonde"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 215, 'classes', 'Maclier', 'Spécialité GRAND MACLIER', 'Description', 'modifie', 'Le Grand Maclier est un protecteur légendaire, maniant son bouclier comme personne. Capable de frapper plusieurs adversaires ou de bénir ses alliés.

Il sacrifie son propre Chakra et sa Santé pour régénérer sa barrière ou amplifier ses défenses, repoussant sans relâche les assauts adverses. Il est capable de renvoyer intégralement les sorts offensifs, convertissant chaque assaut adversaire en une chance de contre-attaque et affirmant sa domination sur le champ de bataille.', 'Le Grand Maclier est un protecteur légendaire, maniant son bouclier comme personne. Capable de frapper plusieurs adversaires ou de bénir ses alliés.

Il sacrifie son propre {{chakra|Chakra}} et sa Santé pour régénérer sa {{barriere|barrière}} ou amplifier ses défenses, repoussant sans relâche les assauts adverses. Il est capable de renvoyer intégralement les sorts offensifs, convertissant chaque assaut adversaire en une chance de contre-attaque et affirmant sa domination sur le champ de bataille.', 'neutre', NULL, 'specialite', '{"id":"classes/maclier#specialite:grand-maclier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 216, 'classes', 'Maclier', 'Don GRAND MACLIER › Frisbee', 'Type (« Actif (1 fois/combat) »)', 'modifie', 'Action (Coût 10 Chakra)', 'Action (Coût 10 {{chakra|Chakra}})', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-frisbee"}', 'type_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 217, 'classes', 'Maclier', 'Don GRAND MACLIER › Sacri-BA', 'Effet', 'modifie', 'Permet de sacrifier des PV et CK pour régénérer la Barrière.
(1 PV/CK = 1 Barrière)', 'Permet de sacrifier des PV et CK pour régénérer la {{barriere|Barrière}}.
(1 PV/CK = 1 {{barriere|Barrière}})', 'neutre', NULL, 'capacite', '{"id":"capacites/maclier-sacri-ba"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 218, 'classes', 'Ocultomancien', 'Don Économe', 'Effet', 'modifie', 'Le coût en Chakra d''un sort est réduit d''un montant égal à son niveau de puissance.', 'Le coût en {{chakra|Chakra}} d''un sort est réduit d''un montant égal à son niveau de puissance.', 'neutre', NULL, 'capacite', '{"id":"capacites/ocultomancien-econome"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 219, 'classes', 'Ocultomancien', 'Don Économe', 'Remarque', 'modifie', 'un sort de puissance 1 coûte 1 Chakra de moins, un sort de puissance 4 coûte 4 Chakra de moins, etc', 'un sort de puissance 1 coûte 1 {{chakra|Chakra}} de moins, un sort de puissance 4 coûte 4 {{chakra|Chakra}} de moins, etc', 'neutre', NULL, 'capacite', '{"id":"capacites/ocultomancien-econome"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 220, 'classes', 'Fenrir', 'Don GOUROU › Rayon Lune', 'Effet', 'modifie', 'Régénère 25% de la barrière la nuit.', 'Régénère 25% de la {{barriere|barrière}} la nuit.', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-rayon-lune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 221, 'classes', 'Fenrir', 'Don BELLICISTE › Suçage', 'Effet', 'modifie', 'Infliger 2d8 avec la morsure permet de récupérer 20% des dégâts infligés en santé. (Si c''est la barrière, ça ne marche pas)', 'Infliger 2d8 avec la morsure permet de récupérer 20% des dégâts infligés en santé. (Si c''est la {{barriere|barrière}}, ça ne marche pas)', 'neutre', NULL, 'capacite', '{"id":"capacites/fenrir-sucage"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 222, 'classes', 'Médusain', 'Spécialité HOPLITE', 'Description', 'modifie', 'L’Hoplite est un médusain discipliné, spécialiste des armes d’estoc et des techniques défensives. Son style de combat repose sur des frappes précises et une défense inébranlable, exploitant la puissance de son épaisse barrière pour encaisser les assauts les plus brutaux.

Armé de sa lance et de son bouclier, il repousse les attaques ennemies et ignore la protection de leurs boucliers. Capable d’absorber les dégâts physiques ou magiques, il transforme chaque affrontement en une vraie épreuve d’endurance.', 'L’Hoplite est un médusain discipliné, spécialiste des armes d’estoc et des techniques défensives. Son style de combat repose sur des frappes précises et une défense inébranlable, exploitant la puissance de son épaisse {{barriere|barrière}} pour encaisser les assauts les plus brutaux.

Armé de sa lance et de son bouclier, il repousse les attaques ennemies et ignore la protection de leurs boucliers. Capable d’absorber les dégâts physiques ou magiques, il transforme chaque affrontement en une vraie épreuve d’endurance.', 'neutre', NULL, 'specialite', '{"id":"classes/medusain#specialite:hoplite"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 223, 'classes', 'Médusain', 'Don AUGURE › Shrapnel', 'Effet', 'modifie', 'À la rupture de sa barrière le médusain bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'À la rupture de sa {{barriere|barrière}} le médusain bondit en arrière pendant qu''une explosion de magie se produit. (Limite max 30 dégâts)', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-shrapnel"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 224, 'classes', 'Médusain', 'Don HOPLITE › Barrière résistante', 'Effet', 'modifie', 'La barrière prend deux fois moins de dégâts physiques.', 'La {{barriere|barrière}} prend deux fois moins de dégâts physiques.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-barriere-resistante"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 225, 'classes', 'Médusain', 'Don HOPLITE › Barrière isolante', 'Effet', 'modifie', 'La barrière prend deux fois moins de dégâts magiques.', 'La {{barriere|barrière}} prend deux fois moins de dégâts magiques.', 'neutre', NULL, 'capacite', '{"id":"capacites/medusain-barriere-isolante"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 226, 'classes', 'Jackalope', 'Don Serein', 'Effet', 'modifie', 'Le repos donne toujours le maximum de Santé et Chakra et n''a plus besoin de jet de calme pour le faire.', 'Le repos donne toujours le maximum de Santé et {{chakra|Chakra}} et n''a plus besoin de jet de calme pour le faire.', 'neutre', NULL, 'capacite', '{"id":"capacites/jackalope-serein"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 227, 'classes', 'Marcass', 'Spécialité DÉVOT', 'Description', 'modifie', 'Le Dévot est un mage singulier, fusionnant sa foi et sa magie pour créer un lien profond avec les éléments et les forces mystiques. Son pouvoir dépend fortement de son apparence et des couleurs qu’il porte, lui conférant des bonus spécifiques en fonction de son affinité avec le Feu, la Terre ou la Nécromancie.

Il possède une relation unique avec les esprits et les morts, capable de se nourrir de la chair des défunts pour restaurer sa propre Barrière, un talent qui le rapproche des anciennes pratiques de l''époque où les marcass étaient des esclaves. Son art du Totémisme lui permet d’ériger des sanctuaires de magie innée, offrant des avantages tactiques durables à lui et ses alliés.', 'Le Dévot est un mage singulier, fusionnant sa foi et sa magie pour créer un lien profond avec les éléments et les forces mystiques. Son pouvoir dépend fortement de son apparence et des couleurs qu’il porte, lui conférant des bonus spécifiques en fonction de son affinité avec le Feu, la Terre ou la Nécromancie.

Il possède une relation unique avec les esprits et les morts, capable de se nourrir de la chair des défunts pour restaurer sa propre {{barriere|Barrière}}, un talent qui le rapproche des anciennes pratiques de l''époque où les marcass étaient des esclaves. Son art du Totémisme lui permet d’ériger des sanctuaires de magie innée, offrant des avantages tactiques durables à lui et ses alliés.', 'neutre', NULL, 'specialite', '{"id":"classes/marcass#specialite:devot"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 228, 'classes', 'Marcass', 'Don DÉVOT › Nécrophage', 'Effet', 'modifie', 'Peut manger de la viande de mort sans avoir de malus pour se soigner de 3d8 barrière.
(se cumule avec Recyclage)', 'Peut manger de la viande de mort sans avoir de malus pour se soigner de 3d8 {{barriere|barrière}}.
(se cumule avec Recyclage)', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-necrophage"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 229, 'classes', 'Marcass', 'Don DÉVOT › Totémiste', 'Remarque', 'modifie', 'Terre : Réduit les dégâts encaissés de 4.

Feu : Augmente les dégâts infligés de 4. 

Nécromancie : Économise 1 chakra à chaque sort lancé.', 'Terre : Réduit les dégâts encaissés de 4.

Feu : Augmente les dégâts infligés de 4. 

Nécromancie : Économise 1 {{chakra|chakra}} à chaque sort lancé.', 'neutre', NULL, 'capacite', '{"id":"capacites/marcass-totemiste"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 230, 'classes', 'Goleois', 'Don IRRÉDUCTIBLE › Plumes ...', 'Effet', 'modifie', 'Abattre un ennemi redonne 10% de la barrière max.', 'Abattre un ennemi redonne 10% de la {{barriere|barrière}} max.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-plumes"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 231, 'classes', 'Goleois', 'Don IRRÉDUCTIBLE › ... jaune', 'Effet', 'modifie', '(Rage)
Tant que la barrière est présente, les dégâts subis n''augmentent pas.', '(Rage)
Tant que la {{barriere|barrière}} est présente, les dégâts subis n''augmentent pas.', 'neutre', NULL, 'capacite', '{"id":"capacites/goleois-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 232, 'classes', 'Archimage', 'Archimage', 'Présentation', 'modifie', 'L’Archimage est la quintessence du pouvoir arcanique, un être qui transcende les limites des mortels pour maîtriser tous les aspects de la magie. Réservée aux individus au Potentiel Illimité, cette classe offre un accès inégalé à la puissance magique. Au plus haut niveau, certains d''entre eux peuvent même exploiter le sang, âme ou corruption.', 'L’Archimage est la quintessence du pouvoir arcanique, un être qui transcende les limites des mortels pour maîtriser tous les aspects de la magie. Réservée aux individus au Potentiel Illimité, cette classe offre un accès inégalé à la puissance magique. Au plus haut niveau, certains d''entre eux peuvent même exploiter le sang, âme ou {{corruption|corruption}}.', 'neutre', NULL, 'classe', '{"id":"classes/archimage"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 233, 'classes', 'Archimage', 'Don Pacte Noir', 'Effet', 'modifie', 'Permet d''utiliser la corruption accumulée pour lancer des sorts de corruption.', 'Permet d''utiliser la {{corruption|corruption}} accumulée pour lancer des sorts de corruption.', 'neutre', NULL, 'capacite', '{"id":"capacites/archimage-pacte-noire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 234, 'races', 'Humain', 'Humain', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/humain"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 235, 'races', 'Nain', 'Nain', 'Présentation générale', 'modifie', 'Une race humanoïde dont la particularité est d''être petite en taille par rapport aux Humains ou Elfes Forestiers.

Ce sont d''excellents combattants au corps-à-corps, le tout avec un capital de santé plus élevé que la moyenne en dépit d''un capital de chakra bien plus faible et d''une limitation des magies qui leur sont possibles d''avoir de manière innée.

Cette race fait partie des 3 premières à être arrivées dans le monde avec les Humains et les Elfes Dorés.', 'Une race humanoïde dont la particularité est d''être petite en taille par rapport aux Humains ou Elfes Forestiers.

Ce sont d''excellents combattants au corps-à-corps, le tout avec un capital de santé plus élevé que la moyenne en dépit d''un capital de {{chakra|chakra}} bien plus faible et d''une limitation des magies qui leur sont possibles d''avoir de manière innée.

Cette race fait partie des 3 premières à être arrivées dans le monde avec les Humains et les Elfes Dorés.', 'neutre', NULL, 'race_onglet', '{"race_id":"races/nain"}', 'description_generale');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 236, 'races', 'Nain', 'Nain', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/nain"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 237, 'races', 'Elfe forestier', 'Elfe forestier', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-forestier"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 238, 'races', 'Elfe doré', 'Elfe doré', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-dore"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 239, 'races', 'Elfe argenté', 'Elfe argenté', 'Présentation générale', 'modifie', 'Les descendants les plus proches des Elfes Dorés, ce sont les êtres qui sont le plus reliés à la magie.

Il s''agit d''humanoïdes qui ont un excellent taux de Chakra et font partie des meilleurs mages de Maverick, au détriment de la force physique.

Cette race est apparue pour la première fois en l''an -100, après un "accident".', 'Les descendants les plus proches des Elfes Dorés, ce sont les êtres qui sont le plus reliés à la magie.

Il s''agit d''humanoïdes qui ont un excellent taux de {{chakra|Chakra}} et font partie des meilleurs mages de Maverick, au détriment de la force physique.

Cette race est apparue pour la première fois en l''an -100, après un "accident".', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-argente"}', 'description_generale');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 240, 'races', 'Elfe argenté', 'Elfe argenté', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-argente"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 241, 'races', 'Elfe argenté', 'Don racial Territoire Elfes Argentés', 'Don', 'modifie', '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Barrière.', '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 {{barriere|Barrière}}.', 'neutre', NULL, 'race_don', '{"id":"races/elfe-argente#don:territoire-elfes-argentes"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 242, 'races', 'Elfe argenté', 'Don racial Ailleurs', 'Don', 'modifie', '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Chakra.', '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 {{chakra|Chakra}}.', 'neutre', NULL, 'race_don', '{"id":"races/elfe-argente#don:ailleurs"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 243, 'races', 'Elfe noir', 'Elfe noir', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/elfe-noir"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 244, 'races', 'Elfe noir', 'Don racial Sang corrompu', 'Don', 'modifie', '- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec.
- Inflige 1 corruption à chacune des attaques qui touche (armes ou magies)', '- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec.
- Inflige 1 {{corruption|corruption}} à chacune des attaques qui touche (armes ou magies)', 'neutre', NULL, 'race_don', '{"id":"races/elfe-noir#don:elfe-charbon"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 245, 'races', 'Elfe noir', 'Don racial Sang purifié', 'Don', 'modifie', '- +10% à tous les tests d''artisanat.
- Chaque soin (physique, magique, sort, objet) soigne 1 point de corruption', '- +10% à tous les tests d''artisanat.
- Chaque soin (physique, magique, sort, objet) soigne 1 point de {{corruption|corruption}}', 'neutre', NULL, 'race_don', '{"id":"races/elfe-noir#don:elfe-sale"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 246, 'races', 'Farfadet', 'Farfadet', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/farfadet"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 247, 'races', 'Felfe', 'Felfe', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/felfe"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 248, 'races', 'Majin', 'Majin', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/majin"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 249, 'races', 'Hujin', 'Hujin', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/hujin"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 250, 'races', 'Drakos', 'Drakos', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/drakos"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 251, 'races', 'Lamia', 'Lamia', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/lamia"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 252, 'races', 'Mort-vivant', 'Mort-vivant', 'Avantages', 'modifie', 'Accès à toutes les classes, accès à toutes les magies, un sommeil complet régénère complètement la santé en plus de la barrière.', 'Accès à toutes les classes, accès à toutes les magies, un sommeil complet régénère complètement la santé en plus de la {{barriere|barrière}}.', 'neutre', NULL, 'race_onglet', '{"race_id":"races/mort-vivant"}', 'avantages');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 253, 'races', 'Mort-vivant', 'Mort-vivant', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/mort-vivant"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 254, 'races', 'Drassah''thac', 'Drassah''thac', 'Don de base', 'modifie', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/drassahthac"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 255, 'races', 'Drassah''thac', 'Don racial Félin adapté', 'Don', 'modifie', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- 1 cran de résistance au gel et à la brûlure.', '- +1 santé, +1 {{chakra|chakra}}
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- 1 cran de résistance au gel et à la brûlure.', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-nord"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 256, 'races', 'Drassah''thac', 'Don racial Félin rapide', 'Don', 'modifie', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +1 vitesse.', '- +1 santé, +1 {{chakra|chakra}}
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +1 vitesse.', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-sud"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 257, 'races', 'Drassah''thac', 'Don racial Félin social', 'Don', 'modifie', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +5% Diplomatie et Manipulation en acquis.', '- +1 santé, +1 {{chakra|chakra}}
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +5% Diplomatie et Manipulation en acquis.', 'neutre', NULL, 'race_don', '{"id":"races/drassahthac#don:drassahthac-centre"}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 258, 'races', 'Orios', 'Orios', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/orios"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 259, 'races', 'Fenrir', 'Fenrir', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/fenrir"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 260, 'races', 'Kitsune', 'Kitsune', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/kitsune"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 261, 'races', 'Olwman', 'Olwman', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/olwman"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 262, 'races', 'Rokh', 'Rokh', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/rokh"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 263, 'races', 'Namazu', 'Namazu', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/namazu"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 264, 'races', 'Minotaure', 'Minotaure', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/minotaure"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 265, 'races', 'Satyre', 'Satyre', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/satyre"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 266, 'races', 'Médusain', 'Médusain', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/medusain"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 267, 'races', 'Jackalope', 'Jackalope', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/jackalope"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 268, 'races', 'Marcass', 'Marcass', 'Avantages', 'modifie', 'Barrière bonus, Classe possible : Marcass.', '{{barriere|Barrière}} bonus, Classe possible : Marcass.', 'neutre', NULL, 'race_onglet', '{"race_id":"races/marcass"}', 'avantages');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 269, 'races', 'Marcass', 'Marcass', 'Inconvénients', 'modifie', 'Taux de Chakra bas, magie Terre, Feu ou Nécromancie en innée, la Force a un minimum de 2.', 'Taux de {{chakra|Chakra}} bas, magie Terre, Feu ou Nécromancie en innée, la Force a un minimum de 2.', 'neutre', NULL, 'race_onglet', '{"race_id":"races/marcass"}', 'inconvenients');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 270, 'races', 'Marcass', 'Marcass', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/marcass"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 271, 'races', 'Anansi', 'Anansi', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/anansi"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 272, 'races', 'Anansi', 'Capacité Mode Hyper', 'Effet', 'modifie', 'Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière à la cible | Nécromancie= Inflige Poison 1 automatiquement | Ombre = Réduit de 5 l''initiative de la cible touchée pour le prochain tour', 'Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 {{barriere|barrière}} à la cible | Nécromancie= Inflige Poison 1 automatiquement | Ombre = Réduit de 5 l''initiative de la cible touchée pour le prochain tour', 'neutre', NULL, 'mode_hyper_effet', '{"id":"onglet_race:races/anansi"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 273, 'races', 'Goleois', 'Goleois', 'Don de base', 'modifie', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et {{chakra|chakra}} (jet de calme en stress)).', 'neutre', NULL, 'race_onglet', '{"race_id":"races/goleois"}', 'don_base');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 274, 'metiers', NULL, 'Brasseur', 'Artisanat', 'modifie', 'Fabriquer de l’alcool, ce dernier peut redonner 5 chakra si consommé', 'Fabriquer de l’alcool, ce dernier peut redonner 5 {{chakra|chakra}} si consommé', 'neutre', NULL, 'metier', '{"id":"metiers/brasseur"}', 'artisanat_texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 275, 'metiers', NULL, 'Pâtissier', 'Artisanat', 'modifie', 'Fabriquer des douceurs, ces dernières peuvent redonner 5 barrière si consommées', 'Fabriquer des douceurs, ces dernières peuvent redonner 5 {{barriere|barrière}} si consommées', 'neutre', NULL, 'metier', '{"id":"metiers/patissier"}', 'artisanat_texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 276, 'guide', 'Découvrir', 'Bienvenue dans Maverick', 'Texte', 'modifie', '## MaverickJDR ?

C’est un univers médiéval-fantasy où la magie est omniprésente. On y retrouve des figures familières comme les [[races/humain|humains]], les elfes ou les [[races/nain|nains]]… mais aussi des peuples plus exotiques tels que les [[races/orios|Orios]], les [[races/drassahthac|Drassah’thac]] ou encore les [[races/drakos|Drakos]].

Vous incarnez les personnages centraux de fabuleuses histoires, et surtout, vos actions ont un véritable impact sur le monde qui vous entoure. Les dangers seront nombreux, mais vous aurez les moyens et le courage de les affronter !

MaverickJDR est un jeu de rôle complet, mais pensé pour rester simple et accessible. Peu importe votre expérience : que vous soyez vétéran du jeu de rôle ou que vous n’y ayez jamais joué, vous pouvez plonger sans difficulté dans Maverick.

L’activité JDR se fait principalement sur le Discord officiel : <https://discord.gg/GMGBnjzfMk>.

## Sommaire

Ce guide est fait pour ceux qui découvrent Maverick, et même le jeu de rôle. Il se lit comme un livre, une page après l’autre : les flèches de part et d’autre du texte (ou les touches ← et → du clavier, ou un glissement du doigt sur téléphone) tournent les pages, et les numéros en bas de page mènent directement à un chapitre. Chaque partie a sa couleur.

<!-- guide:sommaire -->', '## MaverickJDR ?

C’est un univers médiéval-fantasy où la magie est omniprésente. On y retrouve des figures familières comme les [[races/humain|humains]], les elfes ou les [[races/nain|nains]]… mais aussi des peuples plus exotiques tels que les [[races/orios|Orios]], les [[races/drassahthac|Drassah’thac]] ou encore les [[races/drakos|Drakos]].

Vous incarnez les personnages centraux de fabuleuses histoires, et surtout, vos actions ont un véritable impact sur le monde qui vous entoure. Les dangers seront nombreux, mais vous aurez les moyens et le courage de les affronter !

MaverickJDR est un jeu de rôle complet, mais pensé pour rester simple et accessible. Peu importe votre expérience : que vous soyez vétéran du jeu de rôle ou que vous n’y ayez jamais joué, vous pouvez plonger sans difficulté dans Maverick.

Ses races, ses magies et ses classes vous attendent dans [[guide/l-univers|L’univers]].

L’activité JDR se fait principalement sur le Discord officiel : <https://discord.gg/GMGBnjzfMk>.

Le Discord, la page Tipeee du jeu et l’annonce de notre prochaine rencontre IRL sont réunis [sur la page d’accueil](/#lien-discord).

## Le jeu de rôle, comment ça marche ?

Un jeu de rôle, c’est une histoire que l’on raconte ensemble, en parlant. Le maître du jeu en est le metteur en scène et les joueurs en sont les premiers rôles : ils font partie de l’écriture de l’histoire, ils ont leur mot à dire.

### Qui fait quoi ?

- **Le maître du jeu (MJ)** raconte l’histoire. Il pose le monde, décrit ce que vivent les personnages et joue tous ceux qu’ils croisent, les personnages non joueurs (PNJ), ainsi que les monstres. Il est aussi le juge de la partie : il décide de ce qui est possible, improbable ou impossible, en restant impartial.
- **Chaque joueur** incarne son personnage : il dit ce que celui-ci fait, ce qu’il dit, ce qu’il tente.
- **La fiche de personnage** réunit tout ce que le personnage sait faire : ses caractéristiques et ses compétences, ses dons, sa magie, son équipement. [[guide/creer-son-personnage|Créer son personnage]] explique comment la remplir.

### Comment avance une partie ?

Autour d’une vraie table comme sur le Discord, une partie avance comme une conversation :

1. Le MJ décrit la situation.
2. Les joueurs posent leurs questions.
3. Chacun annonce comment réagit son personnage.
4. Si l’issue est incertaine, on lance les dés.
5. Le MJ interprète l’action et le jet, puis décrit ce qui en découle.

Et l’on recommence, jusqu’au bout de l’aventure. D’une partie à l’autre, les personnages gagnent de l’expérience et montent de niveau ([[guide/la-montee-de-niveau|La montée de niveau]]). Pour trouver une table, voyez [[guide/rejoindre-une-partie|Rejoindre une partie]].

Voici à quoi cela ressemble :

> **MJ** : La nuit tombe quand vous arrivez aux portes de la ville. Un garde vous arrête : plus personne n’entre à cette heure.
>
> **Joueuse de la barde** : Ma barde lui propose de lui jouer un air pour égayer sa garde, s’il nous laisse passer.
>
> **MJ** : Il hésite… Fais un jet de Diplomatie.
>
> **Joueuse de la barde** : J’ai 50 en Diplomatie, et le dé fait 34 : c’est réussi !
>
> **MJ** : Le garde écoute la chanson jusqu’au bout, puis vous ouvre la petite porte.

Demander son chemin à un passant ne demande aucun jet : l’issue est certaine. Convaincre un garde d’ouvrir une porte fermée, si.

### Lire les dés

Un dé s’écrit avec un **D** (ou un **d**) suivi de son nombre de faces ; le nombre écrit devant dit combien de dés lancer :

- **D100** : un nombre de 1 à 100, le dé de presque toutes les actions. Il faut faire son score ou moins pour réussir. Le score d’une compétence vaut dix fois sa caractéristique, plus ses points naturels et acquis : avec 3 en Social et 20 points en Diplomatie, la barde de l’exemple a 50. De 1 à 5, c’est une réussite critique ; de 96 à 100, un échec critique ([[guide/reussir-une-action|Réussir une action]]).
- **1D20** : un dé à 20 faces. On le lance par exemple pour l’initiative, qui dit qui joue en premier pendant un combat.
- **2d6+2** : deux dés à 6 faces, additionnés, plus 2. Les dégâts et les soins s’écrivent ainsi, avec des dés de 4 à 20 faces.

Selon la table, chacun lance ses propres dés, ou le MJ les lance tous ; quand chacun lance les siens, ceux des joueurs se font toujours à découvert. Le MJ, lui, peut garder les siens secrets.', 'neutre', NULL, 'page', '{"id":"guide/bienvenue"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 277, 'guide', 'Découvrir', 'Le jeu de rôle, comment ça marche ?', NULL, 'retire', 'Le jeu de rôle, comment ça marche ?', NULL, 'neutre', NULL, 'page', '{"id":"guide/le-jeu-de-role"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 278, 'guide', 'Découvrir', 'L’univers', 'Texte', 'modifie', '## Un monde de magie

Maverick est un monde médiéval-fantasy où vivent [27 races](/races/), des plus familières aux plus exotiques. Chacune a son histoire, ses avantages, ses dons et sa façon de voir les autres peuples.

La magie y est omniprésente, au point que **tout être vivant naît imprégné de l’une des 15 formes de magie**. Cette magie, dite *innée*, est directement héritée de l’un de ses parents, sauf si un dieu intervient. Elle marque jusqu’au corps : la magie innée donne un point de caractéristique en plus (voir [le choix des magies](/guide/choisir-ses-magies/)).

Chaque magie est reliée à une divinité, le *dieu inné* de ceux qui la portent (son nom est sous celui de la magie) :

<!-- guide:magies -->

Les magies ne s’entendent pas toutes entre elles : certaines sont efficaces contre d’autres, d’autres résistent, et certaines ne peuvent pas être réunies chez un même personnage. La [carte des magies](/magies/) montre ces relations.

## Le Codex

L’histoire du monde, sa mythologie, ses lieux et ses factions sont rassemblés dans le [[Codex]] : [[Origine du monde|l’origine du monde]], [[Les Divinités|les divinités]], [[Temples/Cultes/Guildes|les temples, cultes et guildes]], [[Les races non-jouable|les races non jouables]], [[Les Civilisations|les civilisations]], [[Les Outils Légendaires, Uniques|les outils légendaires]] et un [[Glossaire|glossaire]] des termes du jeu. On y trouve aussi les [[Relations entre les races|relations entre les peuples]].', 'Maverick est un monde médiéval-fantasy où vivent [27 races](/races/), des plus familières aux plus exotiques. Chacune a son histoire, ses avantages, ses dons et sa façon de voir les autres peuples.

## Les races

Les races se partagent en deux familles : les races **pures** et les races **hybrides**. Une race hybride a sa propre classe, la *classe raciale*, qui porte son nom ; seul le Drassah’thac, hybride lui aussi, n’en a pas. La plupart se divisent encore en **ethnies**, comme le Felfe Forestier ou l’Orios de Sang.

La page de chaque race raconte son histoire et donne ses avantages, ses inconvénients, ses dons et les magies qu’elle peut porter. Elle dit aussi comment ses peuples voient les autres, et comment les autres les voient ([[Relations entre les races|les relations entre les peuples]]).

## Les magies

La magie y est omniprésente, au point que **tout être vivant naît imprégné de l’une des 15 formes de magie**. Cette magie, dite *innée*, est directement héritée de l’un de ses parents, sauf si un dieu intervient. Elle marque jusqu’au corps : la magie innée donne un point de caractéristique en plus (voir [[guide/creer-son-personnage|la création du personnage]]).

Chaque magie est liée à une divinité (deux pour l’Espace/Temps), le **dieu inné** de ceux qui la portent. Voici les quinze magies, chacune avec son ou ses dieux :

<!-- guide:magies -->

En plus de sa magie innée, un personnage peut apprendre une seconde magie, dite *acquise*. Elle n’a rien d’obligatoire, et toutes les magies ne se mélangent pas. Les races ont aussi leurs interdits : toutes n’ont pas accès à toutes les magies.

Les magies ont enfin leurs forces et leurs faiblesses les unes face aux autres. La plupart résistent à certaines et en craignent d’autres : touché par une magie à laquelle on est vulnérable, on prend deux fois plus de dégâts ; par une magie à laquelle on résiste, deux fois moins. L’Ombre et la Lumière vont par paire, tout comme le Vide et l’Espace/Temps : chacune est efficace contre l’autre et résiste à elle-même. L’Arcane et la Corruption ne sont vulnérables à aucune magie, et leur seule résistance à une magie est l’une contre l’autre. Le Potentiel Illimité, lui, n’a ni résistance ni vulnérabilité. La [carte des magies](/magies/) montre toutes ces relations.

## Les classes

Reste à savoir comment le personnage se bat : c’est sa **classe**. Chaque classe a ses avantages, utiles dans des situations bien précises ou de manière générale. Les [classes](/classes/) se rangent en cinq catégories : physiques au corps à corps, physiques à distance, magiques, raciales (celles des races hybrides) et spéciales. Les classes magiques protègent aussi contre la magie : chacune donne 4 points d’armure magique.

Une classe a son propre niveau, qui monte avec celui du personnage. À chaque palier, elle lui apporte de nouveaux dons, et au niveau 10, il choisit sa **spécialité**, un embranchement de la classe. On peut commencer avec une seule classe ou avec deux.

## L’histoire du monde

Le passé de Maverick, ses dieux, ses lieux et ses factions sont réunis dans le [[Codex]] : [[Origine du monde|l’origine du monde]], [[Les Divinités|les divinités]], [[Temples/Cultes/Guildes|les temples, cultes et guildes]], [[Les Civilisations|les civilisations]], [[Les races non-jouable|les races qu’on ne joue pas]] mais qui comptent dans le monde, [[Les Outils Légendaires, Uniques|les armes et objets légendaires]], et un [[Glossaire|glossaire]] des termes du jeu. La [chronologie](/chronologie/) en retrace les grands événements, date après date, et le [bestiaire](/bestiaire/) présente les monstres que l’on peut y croiser.', 'neutre', NULL, 'page', '{"id":"guide/l-univers"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 279, 'guide', 'Découvrir', 'Créer son personnage', 'Texte', 'modifie', 'Créer un personnage, c’est remplir sa **fiche de personnage**. Pas d’inquiétude : on la remplit dans l’ordre, une étape à la fois, et chaque étape tient sur une page.

## Ce que contient la fiche

- **Personnage** : nom, surnom, race, origine, alignement, magies, dieux et bourse.
- **Classe** et **expérience** : la ou les classes du personnage, son niveau et l’expérience accumulée.
- **Attributs** : santé, chakra, barrière, vitesse, initiative…
- **Caractéristiques** et **compétences** : les scores de tous les jets de dés.
- **Dons** : ce que le personnage sait faire de particulier, grâce à sa race, sa classe, son métier ou ses entraînements.
- **Armes, armure, accessoires, ceinture et inventaire** : son équipement.
- **Magie**, **résistances et faiblesses**, **postures** et **Mode Hyper** : sa magie et ce qui sert en combat.

## Les six étapes

1. **Imaginer son personnage et choisir sa race.**
2. **Choisir ses magies** : une magie innée, et peut-être une magie acquise.
3. **Choisir sa classe**, ou ses deux classes.
4. **Répartir les caractéristiques et les compétences.**
5. **Choisir ses premiers sorts.**
6. **Finaliser** : calculer les attributs, noter les dons, l’équipement et la bourse.

Chaque étape se termine par un encadré **Sur votre fiche** : ce qu’il faut y noter avant de passer à la suite.

## Quatre personnages pour nous accompagner

Pour voir chaque étape appliquée, nous suivons la création de quatre personnages, prêts à partir à l’aventure ensemble :

<!-- guide:fil-rouge -->

Ils montrent quatre façons de jouer : se battre à distance, mêler les armes et la magie, encaisser les coups au corps à corps, soutenir le groupe par la musique et les sorts.', 'Créer un personnage, c’est remplir sa **fiche de personnage**. Elle se remplit dans l’ordre, en six étapes, toutes décrites sur cette page : chaque étape s’appuie sur les choix des précédentes. La [fiche de personnage](/fiche/) du site suit le même chemin : elle fait les calculs à votre place et surligne les choix qui restent à faire.

## Ce que contient la fiche

- **Le personnage** : son nom, son surnom, sa race, son origine, son alignement, ses magies, ses dieux et sa bourse.
- **La classe et l’expérience** : sa ou ses classes, son niveau et l’expérience qu’il a accumulée.
- **Les attributs** : santé, {{chakra|chakra}}, {{barriere|barrière}}, vitesse, initiative…
- **Les caractéristiques et les compétences** : les scores de tous ses jets de dés.
- **Les dons** : ce que lui apportent sa race, sa classe, son métier, ses entraînements.
- **L’équipement** : ses armes, son armure, son bouclier, ses accessoires, sa ceinture et son inventaire.
- **La magie et le combat** : ses sorts, ses résistances et ses faiblesses, ses postures et son Mode Hyper.

## Quatre personnages pour exemple

Pour voir chaque étape en pratique, suivons la création de quatre personnages :

<!-- guide:fil-rouge -->

Ils montrent quatre façons de se battre : harceler l’ennemi de loin à l’arc, mêler le combat rapproché et la magie, manier les armes tranchantes, façonner le combat par la musique et les sorts.

## Étape 1 : imaginer son personnage et choisir sa race

### Qui est votre personnage ?

Avant les chiffres, une idée. D’où vient votre personnage, que cherche-t-il, comment se comporte-t-il ? Quelques mots suffisent : le reste viendra en jouant. Sur la fiche, il lui faut :

- un **nom** complet, et un **surnom** s’il en a un (souvent celui qu’il utilise sur scène) ;
- une **origine** : son lieu de naissance.

### Sa race

Maverick compte [27 races](/races/), pures ou hybrides, et la plupart se divisent en **ethnies** : précisez celle de votre personnage s’il y en a. La race fixe son point de départ :

- sa **santé** et son **{{chakra|chakra}}** de départ, et parfois un bonus de **{{barriere|barrière}}** ;
- sa **vitesse**, sur terre et à la nage ;
- ses **avantages** et ses **inconvénients** ;
- son **don de base**, *Méditation* ou *Repos*, qui lui permet de récupérer du {{chakra|chakra}} (ou de la santé et du {{chakra|chakra}}) plusieurs fois par jour ;
- ses **dons de race**, et ceux de son ethnie ;
- les **magies innées** qui lui sont ouvertes : toutes les races n’ont pas accès à toutes les magies ;
- pour une race hybride, sa **classe raciale** (le Drassah’thac n’en a pas).

La page de chaque race donne tout cela, avec son histoire et le regard que ses peuples portent sur les autres. Lisez celles qui vous attirent : la race compte autant pour le caractère du personnage que pour ses chiffres.

<!-- guide:fil-rouge-race -->

> **Sur votre fiche** : le nom, le surnom, l’origine, la race et l’ethnie. Le don de base va dans la case **Base** des dons, le don de race dans la case **Race**. Gardez sous la main la santé et le {{chakra|chakra}} de la race : ils serviront à l’étape 6.

## Étape 2 : choisir ses magies

### La magie innée

Tout le monde possède une **magie innée** : elle est obligatoire, et c’est la race qui dit lesquelles sont possibles. Elle relie le personnage à son **dieu inné**, la divinité de cette magie (l’Espace/Temps en a deux). S’il prie un autre dieu, c’est son **dieu choisi** ; cette case peut très bien rester vide.

La magie innée marque aussi le corps : elle donne **+1** dans une caractéristique, qui dépend de la magie. Seule la magie innée donne ce point. Il ne compte pas dans ceux que vous répartirez à l’étape 4 ; il permet d’atteindre 5 dans cette caractéristique et y garantit au moins 2. La plupart des magies apportent aussi du {{chakra|chakra}}, certaines de la santé :

<!-- guide:magie-bonus -->

### La magie acquise

Un personnage peut aussi posséder une **seconde magie**, dite *acquise*. Elle n’est pas obligatoire, et elle a ses limites :

- certaines magies ne peuvent pas se mélanger : la page de chaque magie donne celles qui ne lui sont pas compatibles ;
- le [[Potentiel Illimité]] et la [[Magie de la Corruption|Corruption]] ne se marient avec aucune autre magie, sauf la Corruption de l’Elfe Noir Charbon et du Felfe Noir ;
- la Lamia n’a qu’une magie, l’innée ;
- avec deux magies, les sorts les plus puissants, ceux du niveau 5, restent fermés.

Pour un premier personnage, prudence avec le Potentiel Illimité : sa page le dit difficile à jouer.

### Résistances et faiblesses

La plupart des magies **résistent** à certaines magies et sont **vulnérables** à d’autres : leurs pages et la [carte des magies](/magies/) les donnent. L’Arcane et la Corruption ne sont vulnérables à aucune magie, et leur seule résistance à une magie est l’une contre l’autre ; le Potentiel Illimité n’a ni résistance ni vulnérabilité. Touché par une magie à laquelle il est vulnérable, un personnage prend deux fois plus de dégâts ; s’il y résiste, deux fois moins. Avec deux magies, leurs listes s’additionnent : deux vulnérabilités à la même magie font une grande vulnérabilité, deux résistances une grande résistance, et une résistance et une vulnérabilité s’annulent. Certains objets changent aussi ces valeurs : tenez ce tableau à jour, il peut décider de la survie de votre personnage.

### Nos quatre personnages

<!-- guide:fil-rouge-magie -->

> **Sur votre fiche** : la magie innée et, s’il y en a une, la magie acquise ; le dieu inné, et le dieu choisi s’il y en a un ; le +1 de la magie innée, en cochant la petite case bleu clair de sa caractéristique ; les résistances et les faiblesses dans leur tableau.

## Étape 3 : choisir sa classe

La classe, c’est la façon de se battre du personnage. Les [classes](/classes/) se rangent en cinq catégories : physiques au corps à corps, physiques à distance, magiques, raciales et spéciales. Une classe donne :

- de la **santé**, du **{{chakra|chakra}}** et de la **{{barriere|barrière}}** de départ ;
- des **maîtrises d’armes** : les armes que le personnage sait manier dès le départ, nommées par la classe ou à choisir ;
- les **armures** et les **boucliers** qu’il sait porter ;
- son **équipement de départ** : des armes, le plus souvent une armure, parfois un bouclier, et un inventaire de cinq objets, que donne la page de la classe ;
- des **dons**, gagnés aux niveaux 1, 5, 10, 15 et 20 de la classe. Au niveau 10, on choisit aussi une **spécialité**, un embranchement de la classe.

Chaque **classe magique** donne en plus 4 points d’armure magique (AM) : deux classes magiques en donnent 8. La seconde spécialité des classes raciales et du [[classes/flagelleur|Flagelleur]] en donne aussi 4, une fois atteint le niveau 10 de la classe : son don de ce niveau la fait considérer comme une classe magique. La page de chaque classe dit tout le reste.

Le Potentiel Illimité a ses propres règles : en magie innée, il impose l’Archimage comme première classe (une classe réservée à lui seul), et il ne peut jamais prendre le Mage Bleu.

### Une ou deux classes : le biclassage

Chaque classe a son propre niveau, qui monte avec celui du personnage. À la création, deux chemins :

- **Une seule classe** : elle commence au niveau 2 et gagne 2 niveaux à chaque niveau du personnage. Arrivée au niveau 20, elle s’arrête : au niveau 11 du personnage, une seconde classe est prise automatiquement, et c’est elle qui reçoit la suite.
- **Deux classes** : elles commencent chacune au niveau 1 et gagnent chacune 1 niveau à chaque niveau du personnage. L’inventaire de départ se compose alors de 5 objets choisis parmi les 10 des deux classes.

Au niveau 20 du personnage, tout le monde a donc deux classes au niveau 20 : seule la progression change. Une seule classe monte plus vite au début ; deux classes donnent plus de choix tout de suite.

### Nos quatre personnages

<!-- guide:fil-rouge-classe -->

> **Sur votre fiche** : la ou les classes et leur niveau. Les maîtrises d’armes se notent à l’étape 4 ; les armes, l’armure, le bouclier et l’inventaire de départ à l’étape 6.

## Étape 4 : répartir caractéristiques et compétences

### Les caractéristiques

Les six caractéristiques, **Force**, **Volonté**, **Intelligence**, **Perception**, **Social** et **Agilité**, sont le cœur de tous les jets de dés : chacune compte dix fois dans le score de ses cinq compétences (voir [[guide/reussir-une-action|Réussir une action]]).

- À la création, on répartit **exactement 14 points** entre les six.
- Une caractéristique vaut au moins 1 et, en règle générale, au plus 4.
- Le +1 de la magie innée s’y ajoute (étape 2) : c’est lui qui permet d’atteindre 5.
- Un point de plus se gagne aux niveaux 5, 10 et 15 du personnage.

Pensez à ce que votre personnage fera le plus souvent : un guerrier frappe (Force), une barde charme son public (Social), un mage rouge se concentre sur ses sorts (Volonté)…

### Les compétences

Les compétences disent ce que le personnage sait faire. Il y en a trente, cinq par caractéristique :

<!-- guide:competences -->

- À la création, on répartit **exactement 100 points** entre les compétences.
- Ils vont dans la case **Nat.** (naturel), **20 au plus** par compétence. Ce maximum passe à 30 au niveau 5 du personnage, puis à 40 au niveau 10.
- La case **Acquis** ne se répartit pas : elle additionne ce que donnent l’entraînement, les dons de la race, de l’ethnie et de la classe, l’armure, le métier et les accessoires (la fiche du site la calcule). Elle ne dépasse pas 5 par point de la caractéristique, le +1 de la magie innée compris : avec 4 en Force, pas plus de 20 d’acquis dans une compétence de Force. Un don peut toutefois relever ce plafond.

Pour lancer ses sorts, on se sert de la compétence *Magie* (Intelligence) ; les mages rouge, bleu et vert, eux, utilisent *Concentration* (Volonté). Lisez la page de votre classe avant de répartir vos points.

### Les maîtrises d’armes

Plus le personnage maîtrise une catégorie d’arme, plus il fait de dégâts avec elle : sans maîtrise, l’arme lance 1 dé ; avec 1 point de maîtrise, 2 dés, jusqu’à 4 points au plus par catégorie, donc 5 dés. Les points de toutes les sources s’additionnent, jusqu’à ce plafond ; au-delà, la fiche le signale, et les points en trop ne donnent pas de dé. Chaque catégorie a son dé, que suivent la plupart de ses armes (dagues D6, épées D10, arcs D8, arbalètes D12) ; certaines armes écrivent le leur : l’épée courte lance des D8 (voir les [armes](/ressources/equipement/#armes)). Les maîtrises de départ sont celles de la classe : notez celles qu’elle nomme, choisissez celles qui sont « au choix ». Certains dons en ajoutent plus tard.

> **Sur votre fiche** : la valeur de chaque caractéristique ; les points naturels des compétences ; les maîtrises d’armes.

## Étape 5 : choisir ses premiers sorts

Tout le monde a une magie innée, donc tout le monde a au moins un sort. Le nombre de sorts dépend de deux choses : des **conditions** que remplit le personnage et de sa **puissance magique**.

### Les emplacements de sorts

Chacune de ces quatre conditions donne un emplacement de sort :

1. avoir une magie innée (toujours remplie) ;
2. avoir une magie acquise ;
3. avoir une classe magique ;
4. avoir une seconde classe magique.

Le nombre de conditions remplies est ensuite **multiplié par la puissance magique**. Elle vaut 1 au niveau 1 du personnage, puis augmente avec les niveaux ([[guide/la-montee-de-niveau|La montée de niveau]]). Il n’y a jamais d’emplacement en plus.

*Exemples : une magie innée et une magie acquise, sans classe magique, en puissance magique 1 : 2 emplacements. Une magie innée et deux classes magiques, en puissance magique 3 : 3 × 3 = 9 emplacements.*

<!-- guide:fil-rouge-sorts -->

### Choisir ses sorts

Les sorts se trouvent sur la page de chaque [magie](/magies/), rangés par **niveau de puissance magique** (NPM), de 1 à 5 : un sort n’est accessible que si la puissance magique du personnage atteint son NPM. Chaque sort indique son coût en {{chakra|chakra}}, et parfois un coût secondaire (des âmes, du Sang…), sa portée, ses dégâts ou son effet.

Avec deux magies, les sorts du niveau 5 restent fermés, même quand la puissance magique les atteint ; leurs emplacements, eux, s’ouvrent quand même.

> **Sur votre fiche** : dans le tableau de magie, un sort par emplacement, avec ce qu’en dit sa page.

## Étape 6 : finaliser son personnage

Tous les choix sont faits : il reste à en tirer les chiffres et à remplir les dernières cases.

### Les attributs

Les attributs se calculent à partir de la race, de la ou des classes et des magies :

- **Santé** (les points de vie) : celle de la race, de la ou des classes et des magies qui en offrent. À 0 ou moins, le personnage tombe dans le coma et doit faire des jets de survie : un seul réussi le stabilise, trois ratés et il meurt.
- **{{chakra}}** (les points de magie, que dépensent les sorts) : celui de la race, de la ou des classes et des magies. À court de {{chakra|chakra}}, on peut quand même en dépenser : chaque point qui manque coûte 2 points de santé.
- **{{barriere}}** : une seconde peau magique, qui protège la chair. Elle vaut la moitié du {{chakra|chakra}}, plus les bonus de la race et de la classe. Le mythril la traverse, et le maverium la brise à son contact.
- **{{corruption}}** : son maximum est celui du {{chakra|chakra}}. La {{corruption|corruption}} est un poison du {{chakra|chakra}} : chaque point de {{corruption|corruption}} prend la place d’un point de {{chakra|chakra}}. Si elle atteint son maximum, le personnage a deux semaines, dans le jeu, pour en retirer au moins un point ; sinon il meurt et devient une abomination. Seuls ceux qui ont la Corruption en magie innée ou acquise ne risquent pas cette mort, mais la {{corruption|corruption}} prend aussi la place de leur {{chakra|chakra}}. Le Potentiel Illimité, même s’il peut s’en servir, peut en mourir s’il en cumule trop.
- **Âme** ou **Sang**, la « 4ᵉ barre » : seulement pour la Nécromancie et la magie du Sang. C’est une réserve de 10 points que demandent certains sorts, et qui se recharge de 1 point par tour en combat.
- **Vitesse** : celle de la race, sur terre et à la nage, en cases par tour. Une armure de la catégorie « Lourd » retire 1 point de vitesse et rend la vitesse de nage nulle (0).
- **Armure de base** : l’armure physique (AP) et l’armure magique (AM) que le personnage a sans rien porter. Certaines races en donnent, et chaque classe magique donne 4 AM.
- **Initiative** : elle dit quand le personnage joue en combat. C’est 1D20, plus un bonus qui dépend de l’Agilité :

<!-- guide:initiative -->

Certaines ethnies ajoutent un bonus de santé, de {{chakra|chakra}}, de {{barriere|barrière}}, d’armure ou de vitesse. À partir du niveau 2, chaque niveau donne aussi des points à répartir entre la santé et le {{chakra|chakra}} ([[guide/la-montee-de-niveau|La montée de niveau]]).

<!-- guide:fil-rouge-attributs -->

### Les dons

La fiche range les dons du personnage dans plusieurs cases :

- **Base** : *Méditation* ou *Repos*, donné par la race ;
- **Race** : le don de race ;
- **Métier** : un [métier](/metiers/) se choisit à la création ou plus tard dans l’aventure, et donne des bonus ([[Règles des métiers]]) ;
- **Entraînement** : les compétences que le personnage fait progresser en s’entraînant, au fil du jeu ([[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]) ;
- **Classes** : les dons gagnés aux niveaux de classe ;
- **Événements** : des dons, bons ou mauvais, qui peuvent arriver sans prévenir.

Chaque don est de l’un de ces quatre types :

<!-- guide:types-de-don -->

### L’équipement et la bourse

- **Les armes** : les armes de départ sont celles de la classe (voir sa page). Deux armes au plus sont équipées ; les autres vont dans l’inventaire.
- **L’armure et le bouclier** : ceux de la classe, si elle en donne. Une armure se porte entière ; chacune de ses six parties (casque, torse, bras gauche, bras droit, jambe gauche, jambe droite) a sa propre {{solidite|solidité}}, qui baisse quand elle s’abîme, sauf une armure à **cran de solidité uni**, qui n’en a qu’une ([[guide/l-equipement|L’équipement]]).
- **Les accessoires** : six emplacements, sur la tête, au cou, aux poignets et aux doigts, pour des objets aux effets variés.
- **Le sac** : la Force dit combien d’emplacements il a, de 24 avec 1 en Force à 48 dès 5 en Force ; chaque emplacement porte un objet et sa quantité. L’inventaire de départ est celui de la ou des classes (étape 3), plus les objets de départ du métier s’il en prend un à la création.
- **La ceinture** : tout le monde en a une, avec trois emplacements pour des objets à portée de main (fioles, carquois, bâtons magiques…), qui s’utilisent en une [[guide/le-tour-de-jeu|action rapide (IC)]] au lieu d’une action entière. Un emplacement prend au plus 3 exemplaires du même objet. Les carquois et les sacs de bombes ou de pierres doivent y être pour servir ; le bouclier, lui, n’y va pas.
- **La bourse** : il existe trois monnaies, le Ricken de fer, le Ricken d’or et la Pierre précieuse. À la création, lancez 1D20 : le résultat est votre or de départ.

### L’alignement

L’alignement décrit la morale du personnage. Il n’est pas choisi une fois pour toutes : il évolue au fil de l’aventure, selon ses actes, ses décisions et ses paroles. Le MJ en tient les quatre scores, Loyal, Chaotique, Bon et Mauvais ([[Alignement]]).

> **Sur votre fiche** : les attributs ; les dons dans leurs cases ; les armes, l’armure, le bouclier, les accessoires, l’inventaire et la ceinture ; l’or de départ. Votre personnage est prêt : il ne lui manque qu’une table, et [[guide/rejoindre-une-partie|Rejoindre une partie]] vous dit où la trouver.', 'neutre', NULL, 'page', '{"id":"guide/creer-son-personnage"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 280, 'guide', 'Découvrir', 'Étape 1 : imaginer son personnage et choisir sa race', NULL, 'retire', 'Étape 1 : imaginer son personnage et choisir sa race', NULL, 'neutre', NULL, 'page', '{"id":"guide/choisir-sa-race"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 281, 'guide', 'Découvrir', 'Étape 2 : choisir ses magies', NULL, 'retire', 'Étape 2 : choisir ses magies', NULL, 'neutre', NULL, 'page', '{"id":"guide/choisir-ses-magies"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 282, 'guide', 'Découvrir', 'Étape 3 : choisir sa classe', NULL, 'retire', 'Étape 3 : choisir sa classe', NULL, 'neutre', NULL, 'page', '{"id":"guide/choisir-sa-classe"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 283, 'guide', 'Découvrir', 'Étape 4 : caractéristiques et compétences', NULL, 'retire', 'Étape 4 : caractéristiques et compétences', NULL, 'neutre', NULL, 'page', '{"id":"guide/caracteristiques-et-competences"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 284, 'guide', 'Découvrir', 'Étape 5 : ses premiers sorts', NULL, 'retire', 'Étape 5 : ses premiers sorts', NULL, 'neutre', NULL, 'page', '{"id":"guide/premiers-sorts"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 285, 'guide', 'Découvrir', 'Étape 6 : finaliser son personnage', NULL, 'retire', 'Étape 6 : finaliser son personnage', NULL, 'neutre', NULL, 'page', '{"id":"guide/finaliser-son-personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 286, 'guide', 'Découvrir', 'Rejoindre une partie', NULL, 'ajoute', NULL, 'Rejoindre une partie', 'neutre', NULL, 'page', '{"id":"guide/rejoindre-une-partie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 287, 'guide', 'Les bases', 'Réussir une action', 'Texte', 'modifie', 'Presque toutes les actions incertaines se jouent de la même façon : **on lance un D100, et il faut faire son score ou moins.**

## Le score

Quand le MJ demande un jet, il nomme une compétence : *Diplomatie* pour convaincre, *Athlétisme* pour escalader, *Observation* pour repérer un détail… Chaque compétence a un **score**, noté en pourcentage sur la fiche :

> **score = 10 × la caractéristique liée + les points naturels + les points acquis**

- La **caractéristique** (Force, Volonté, Intelligence, Perception, Social ou Agilité) vaut le plus souvent de 1 à 4 ; le point offert par la magie innée compte.
- Les points **naturels** sont ceux que vous répartissez à la création et à chaque niveau.
- Les points **acquis** viennent de l’entraînement, de la race, de la classe, des dons ou de l’équipement.

*Exemple : la barde a 3 en Social et 20 points naturels en Diplomatie. Son score est de 3 × 10 + 20 = 50 %. Elle réussit si le D100 donne 50 ou moins.*

## Les critiques

- **De 1 à 5 : réussite critique.** L’action réussit de façon exceptionnelle. En attaque, les dégâts sont doublés ; pour un soin ou une protection, l’effet ou la durée est doublé ; hors combat, le MJ décide de la récompense.
- **De 96 à 100 : échec critique.** L’action rate de façon spectaculaire : une arme qui s’abîme, un allié touché par erreur, un sort qui coûte deux fois plus de chakra… Le MJ décide des conséquences.

Une réussite critique ne rend pas tout possible : le MJ reste seul juge de ce qui peut ou non réussir.

## Bonus et malus

La situation peut rendre une action plus facile ou plus difficile : le score gagne ou perd alors quelques points de pourcentage avant le jet. Par exemple :

- une serrure de niveau 10 impose un malus de 30 % à celui qui tente de la crocheter ;
- certaines postures de combat donnent +5 % à certains jets, ou −10 % pour toucher sa cible ;
- une maladie ou une mauvaise nuit peut mettre une **croix** sous une caractéristique : −20 % à tous les tests qui lui sont liés ; avec deux croix, ses compétences ne sont plus utilisables.

Pour aller plus loin, la page [[Jet de dés]] détaille les critiques du point de vue du MJ.', 'Dès que l’issue d’une action est incertaine (toucher un ennemi, crocheter une serrure, désarmer un piège, convaincre quelqu’un…), le MJ demande un jet de dés. Presque toujours, il se joue de la même façon : **on lance un D100, et l’action réussit si le résultat est égal ou inférieur à son score.**

## Le jet

1. Le MJ nomme la **compétence** qui sert : *Observation* pour repérer un détail, *Athlétisme* pour enfoncer une porte, *Ruse* ou *Sabotage* pour crocheter une serrure, *Diplomatie* pour persuader sans violence…
2. La situation peut ajouter un **bonus** ou un **malus** au score (voir « Bonus et malus » plus bas).
3. Vous lancez le D100 : **égal ou inférieur au score, c’est réussi ; au-dessus, c’est raté.**

### Qui lance les dés ?

Chaque table choisit sa façon de faire : soit le MJ fait tous les jets, ceux des joueurs compris ; soit chacun lance les siens, et ceux des joueurs se font alors toujours à découvert. Le MJ, lui, peut lancer les siens à découvert ou en cachette : il garde ainsi la main sur ce qui se passe de son côté.

## Le score

Chaque compétence a un **score**, en pourcentage, noté sur la fiche de personnage :

> **Score = 10 × la caractéristique + les points naturels + les points acquis**

- **La caractéristique.** Chaque compétence dépend de l’une des six caractéristiques : Force, Volonté, Intelligence, Perception, Social ou Agilité. Une caractéristique vaut de 1 à 4 en règle générale ; le point offert par la magie innée s’y ajoute et permet d’atteindre 5.
- **Les points naturels.** Ce sont ceux que vous répartissez vous-même entre les compétences, à la création du personnage puis à chaque niveau (voir [[guide/creer-son-personnage|Créer son personnage]] et [[guide/la-montee-de-niveau|La montée de niveau]]).
- **Les points acquis.** Ils ne se répartissent pas, ils se gagnent : par l’entraînement, par les dons de la race, de l’ethnie et de la classe, par l’armure portée, le métier et les accessoires (voir [[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]). La [fiche de personnage](/fiche/) du site les additionne pour vous. En règle générale, ils ne dépassent pas **5 par point de la caractéristique**, le point de la magie innée compris : avec 5 en Volonté, pas plus de 25 points acquis dans une compétence de Volonté. Un don peut relever ce plafond.

*Exemple : un personnage a 3 en Perception, 15 points naturels et 5 points acquis en Observation. Son score d’Observation est de 3 × 10 + 15 + 5 = 50 % : il réussit sur un résultat de 50 ou moins.*

## Les quatre résultats

Un jet a quatre issues : la **réussite**, l’**échec**, la **réussite critique** et l’**échec critique**. Les deux dernières sont rares, et elles comptent.

### La réussite critique : de 1 à 5

L’action réussit de façon exceptionnelle, et mérite une récompense à sa mesure :

- **en attaque**, les dégâts de base sont doublés, et la cible ne peut bloquer le coup que par une réussite critique meilleure que celle de l’attaquant ;
- **pour une amplification, un soin, une entrave ou une protection**, la durée ou l’effet est doublé ;
- **en défense**, le personnage peut contre-attaquer ou désarmer son adversaire ;
- **hors combat**, le MJ décide de ce qu’elle apporte : les situations sont trop nombreuses pour une règle.

Certaines postures de combat élargissent la réussite critique : la posture offensive pour attaquer, la posture défensive pour parer ou esquiver (le détail est dans [[guide/les-postures|Les postures]]). Prendre un ennemi en tenaille à quatre donne aussi +5 % de réussite critique aux alliés.

Une réussite critique ne rend pas tout possible : certaines actions restent impossibles, quels que soient les efforts. Le MJ peut toutefois laisser tenter une action normalement irréalisable, mais encore possible en théorie : elle ne réussira alors que sur une réussite critique. Il reste seul juge de ce qui est possible, improbable ou impossible.

### L’échec critique : de 96 à 100

L’action rate complètement, et cela coûte quelque chose :

- **en attaque**, l’arme s’abîme, un allié est touché par accident, le sort coûte deux fois plus de {{chakra|chakra}}, l’attaque se retourne contre son auteur… ; la cible peut aussi en profiter pour une attaque d’opportunité, ou pour désarmer l’attaquant ;
- **pour une amplification, un soin, une entrave ou une protection**, l’effet profite à l’ennemi, ou le personnage se trompe de sort ;
- **en défense**, la défense tombe à zéro : l’armure ne compte pas, et l’adversaire ajoute +8 à ses dégâts ;
- **hors combat**, le MJ décide des conséquences.

C’est aussi dans l’échec qu’on apprend : à un joueur qui enchaîne les échecs dans une compétence, le MJ peut accorder un jet d’entraînement pour elle.

## Bonus et malus

La situation peut rendre une action plus facile ou plus difficile : le score gagne ou perd alors des points avant le jet. Quelques cas que les règles chiffrent :

- **une serrure (ou un coffre) à crocheter** : −3 % par niveau de la serrure, qui va jusqu’au niveau 20 ;
- **une porte à enfoncer**, avec l’*Athlétisme* : par niveau de la porte, −1 % en bois, −3 % en fer, −4 % en pierre ;
- **viser la tête, un bras ou une jambe** plutôt que le corps : un malus pour toucher, propre à la zone visée (voir le tableau « Localisation des dégâts » de [[guide/attaque-et-defense|Attaque et Défense]]) ;
- **une croix sous une caractéristique** : un malus à tous les jets de cette caractéristique (voir « Les croix » plus bas) ;
- **la posture de combat** : certaines donnent un bonus à des jets, d’autres un malus pour toucher (voir [[guide/les-postures|Les postures]]).

*Exemple : une serrure de niveau 10 impose −30 % à qui veut la crocheter : avec 80 % en Ruse, il ne lui reste que 50 % de chances.*

### Les croix

Une blessure grave, un traumatisme, une maladie ou même une mauvaise nuit peuvent mettre une **croix** sous une caractéristique (la fiche a deux cases pour cela sous chacune) :

- **une croix** : −20 % à tout jet lié à cette caractéristique ;
- **deux croix** : la caractéristique n’est plus utilisable, ni aucune de ses compétences.

## Pour aller plus loin

- Les coups visés, la défense et les cas particuliers du combat : [[guide/attaquer-et-se-defendre|Attaquer et se défendre]].
- Les réussites et les échecs critiques du point de vue du MJ : [[guide/jet-de-des|Jet de dés]].
- Serrures, portes et herses : [[guide/les-portes|Les portes]].', 'neutre', NULL, 'page', '{"id":"guide/reussir-une-action"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 288, 'guide', 'Les bases', 'Le tour de jeu', 'Texte', 'modifie', 'Hors combat, on joue en conversation libre. Quand un combat commence, le jeu se découpe en **tours** : chacun agit à son tour, dans un ordre précis. Le MJ peut alors sortir une **carte de combat** (*battlemap*), quadrillée, pour placer les personnages et mesurer les distances.

## Le déroulement d’un tour

1. **Initiative.** Au début de chaque tour, chaque joueur lance 1D20 et ajoute le bonus d’initiative de son personnage ; le MJ fait de même pour les PNJ et les ennemis. On joue du plus haut score au plus bas. Les initiatives se relancent à chaque tour.
2. **Effets de début de tour.** Avant d’agir, le personnage subit ce qui le frappe en début de tour : poison, brûlure…
3. **Posture.** Il déclare sa posture de combat (offensive, défensive…), qui décide en grande partie de ce qu’il pourra faire (voir [les postures](/guide/les-postures/)).
4. **Déplacement.** Il parcourt jusqu’à autant de cases que sa vitesse. Il n’est pas obligé de tout utiliser : il peut garder une partie de son déplacement pour après son action.
5. **Actions rapides (IC).** Il peut faire jusqu’à trois actions rapides, jamais deux fois la même, **toujours avant son action**.
6. **Action.** Son action principale : attaquer, lancer un sort, utiliser un objet, sprinter, ou faire une quatrième action rapide.
7. **Fin du déplacement**, s’il en reste, puis **fin du tour** : on passe au suivant.

En dehors de son tour, un personnage peut encore **réagir** : se défendre contre une attaque (selon sa posture), ou utiliser un don de type *réaction*. Le MJ juge de ce qui est possible.

## Se déplacer

- Une case parcourue compte pour 1. La première diagonale du tour compte aussi pour 1, les suivantes pour 2.
- **Sprinter** double la distance parcourue, mais le sprint est une action : impossible d’attaquer ensuite.
- Certaines actions se font à la place du déplacement : recharger une arme, changer d’arme ou dégainer, entrer ou sortir d’une zone, se relever…
- Grimper demande un jet d’Athlétisme ou d’Équilibre : réussi, il ne coûte que le déplacement ; raté, il coûte aussi l’action, ou fait tomber (au MJ d’en décider).

## Les actions rapides (IC)

Certains sorts et certaines actions portent la mention **IC** (*Instant Cast*) ou « action rapide » : ils ne prennent pas l’action du tour. Boire une potion rangée à la ceinture en est une, par exemple ; la même potion sortie du sac prend toute l’action.

## En résumé

Un tour peut ressembler à l’un de ces enchaînements :

- déplacement → action → fin du tour ;
- un peu de déplacement → action → le reste du déplacement → fin du tour ;
- action → déplacement → fin du tour ;
- sprint → fin du tour ;
- un peu de déplacement → échec critique → fin du tour (le MJ peut alors empêcher la fin du déplacement).

Le détail est dans [[Les Actions et mouvements]] et [[En résumé|le résumé du tour]] du guide pour MJ.', 'En combat, le temps se découpe en **tours** : chacun agit à son tour, dans l’ordre de l’initiative, puis un nouveau tour commence. Ce qu’on fait pendant le sien tient en quelques étapes, toujours les mêmes.

Pour suivre le combat, le MJ peut déployer une **carte de combat** (*battlemap*) : une carte quadrillée vue de haut, où il dessine les obstacles et où l’on compte les distances en cases. Chaque personnage y a son pion (un dé du joueur, par exemple). Si le MJ juge que le combat sera rapide, il peut s’en passer.

## Le déroulement d’un tour

Au début du combat, le MJ prépare de quoi noter les initiatives de tous, joueurs et ennemis, et la carte s’il en faut une. Puis chaque tour suit ces étapes :

1. **L’initiative.** Le MJ annonce le début du tour. Chaque joueur lance 1D20 et ajoute le bonus d’initiative de son personnage, qui vient de son Agilité (le tableau est dans [[guide/creer-son-personnage|Créer son personnage]]) ; le MJ fait de même pour les PNJ et les ennemis. On joue du plus haut résultat au plus bas. Les initiatives se relancent **à chaque tour**.
2. **Les effets de début de tour.** Avant de faire quoi que ce soit, le personnage dont c’est le tour subit ce qui le frappe en début de tour : poison, brûlure… (voir [[guide/blessures-et-etats|Blessures et états]]).
3. **La posture.** Il déclare sa posture de combat. Elle décide en grande partie de ce qu’il pourra faire ensuite : attaquer plus fort, se défendre, se concentrer sur sa magie… (voir [[guide/les-postures|Les postures]]). Le MJ, lui, peut annoncer celle de ses ennemis à demi-mot, pour laisser les joueurs la deviner.
4. **Le déplacement.** Il parcourt autant de cases que sa vitesse le permet, ou moins : rien ne l’oblige à tout utiliser, et il peut en garder pour après son action, ou ne pas bouger du tout.
5. **Les actions rapides (IC).** Il peut en faire jusqu’à trois, jamais deux fois la même, et **toujours avant son action**.
6. **L’action.** C’est l’action principale de son tour : attaquer avec son arme, lancer un sort, utiliser un objet, sprinter, utiliser un don de type *Action*, ou faire une quatrième action rapide.
7. **La fin du déplacement.** S’il lui reste du déplacement, il peut l’utiliser maintenant.
8. **La fin du tour.** On passe au suivant.

Quelques effets changent l’initiative : la posture de vigilance donne un bonus d’initiative au début de chaque tour (voir [[guide/les-postures|Les postures]]), et un coup reçu à la jambe gauche en fait perdre au tour suivant (voir le tableau « Localisation des dégâts » de [[guide/attaque-et-defense|Attaque et Défense]]). Les boss, eux, ont deux initiatives par tour : on lance deux D20 pour eux.

## Hors de son tour : réagir

Ce n’est pas parce que ce n’est pas son tour qu’un personnage ne peut rien faire. Il peut :

- se défendre contre les attaques, autant de fois que sa posture le lui permet (voir [[guide/attaquer-et-se-defendre|Attaquer et se défendre]]) ;
- utiliser un don de type *Réaction*, un don qui se joue justement en dehors de son tour ;
- profiter d’une attaque d’opportunité, quand l’occasion se présente ;
- ou réagir autrement, si la situation le permet.

Le MJ juge de ce qui est valable selon la situation.

## Se déplacer

### Compter les cases

- La **vitesse** dit combien de cases le personnage parcourt en un tour. Il en a deux : sa vitesse sur terre et sa vitesse de nage. Elles viennent de sa race, puis l’équipement, les accessoires et les sorts peuvent les augmenter ou les diminuer : une armure de la catégorie *Lourd*, par exemple, retire 1 point de vitesse et rend la vitesse de nage nulle.
- Une case parcourue compte pour 1. La **première diagonale** du tour compte aussi pour 1, les suivantes pour 2. La « première » est la première fois du tour où le personnage se déplace en diagonale, pas forcément sa première case ; elle revient à chaque nouveau tour.

*Exemple : avec 4 de vitesse, deux diagonales et une case droite font 1 + 2 + 1 = 4 : le compte est bon. Une troisième diagonale aurait coûté 2 cases de plus.*

Attention, la **portée** d’une arme ne se compte pas de la même façon : pour elle, chaque diagonale vaut 2 cases.

### Sprinter

Sprinter double la distance parcourue, mais le sprint est une action à part entière : impossible d’attaquer après un sprint.

### Agir à la place de son déplacement

Certaines actions se font en sacrifiant son déplacement plutôt que son action :

- recharger une arme ;
- changer d’arme, ou dégainer ;
- entrer dans une zone, ou en sortir ;
- se relever ;
- ou autre chose encore, selon l’imagination de chacun et l’accord du MJ.

Une arme à {{recharge-longue|recharge longue}} se recharge avec l’action **ou** le déplacement, une arme à {{recharge-tres-longue|recharge très longue}} avec l’action **et** le déplacement.

### Grimper

Grimper sur quelque chose demande un jet d’*Athlétisme* ou d’*Équilibre*. Réussi, il ne coûte que le déplacement. Raté, il coûte le déplacement **et** l’action, ou bien le personnage tombe : c’est au MJ d’en décider, car cela dépend beaucoup de la situation.

### Les zones d’influence

Les cases devant un adversaire, derrière lui, à sa gauche et à sa droite forment sa **zone d’influence**. Entrer dans la zone d’influence d’un adversaire puis la traverser lui permet une attaque d’opportunité ; la quitter lui permet une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité (voir [[guide/situations-avancees|Les situations avancées]]).

## Les actions rapides (IC)

Certains sorts et certaines actions portent la mention **IC** (*Instant Cast*) ou « action rapide » : ce n’est pas une action à part entière, cela ne casse pas le tour. Un sort IC, par exemple, ne consomme pas le tour du joueur, sauf sur un échec critique.

- On en fait **trois par tour au plus**, et jamais deux fois la même, sauf mention contraire.
- Elles se font **toujours avant l’action**.
- L’action du tour peut servir à en faire une quatrième.

Ce sont souvent les objets qui coûtent du temps, et la ceinture en fait gagner (voir [[guide/l-equipement|L’équipement]]) :

- **boire** quelque chose : toute l’action, ou une action rapide si la fiole est à la ceinture ;
- **allumer** quelque chose, **soigner** un personnage : toute l’action, ou deux actions rapides si le nécessaire est à la ceinture ;
- **sortir un objet du sac** : toute l’action ;
- **mettre des objets à la ceinture** : l’action, plus une action rapide.

D’autres choses se font en actions rapides : passer en mode discret pour une attaque discrète en coûte trois (deux pour un voleur), et la posture de vigilance fait une action rapide d’estimer la position d’un ennemi invisible ou discret.

## Cinq façons d’enchaîner un tour

Le Doc « Guide pour MJ » compte cinq façons d’enchaîner un tour ; les actions rapides, elles, se glissent toujours avant l’action :

- déplacement → action → fin du tour ;
- une partie du déplacement → action → le reste du déplacement → fin du tour ;
- action → déplacement → fin du tour ;
- sprint → fin du tour ;
- une partie du déplacement → échec critique → fin du tour : sur un échec critique, le MJ peut empêcher la fin du déplacement, en décrivant ce qui l’en empêche.

Le Doc « Guide pour MJ » détaille tout cela dans [[guide/actions-et-mouvements|Les actions et mouvements]], [[guide/en-resume-deroulement-d-un-tour|le résumé du tour]] et [[guide/vitesse-et-portee|La vitesse et la portée]], parmi les [Règles avancées](/regles/avancees/) ; sa page d’accueil, [[guide/guide-pour-mj-maverick|Guide pour MJ - Maverick]], en donne le sommaire.', 'neutre', NULL, 'page', '{"id":"guide/le-tour-de-jeu"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 289, 'guide', 'Les bases', 'Attaquer et se défendre', 'Texte', 'modifie', '## Attaquer

Une attaque est un jet de D100 : il faut faire son score ou moins dans la compétence de l’arme (*Arme légère*, *Arme lourde*, *Arc*, *Arbalète*…) ou, pour un sort, dans la compétence qui sert à le lancer.

- **Réussite critique (1 à 5)** : les dégâts sont doublés, et la cible ne peut bloquer le coup que par une réussite critique meilleure.
- **Échec critique (96 à 100)** : la cible peut riposter par une attaque d’opportunité, ou désarmer l’attaquant, ou autre chose selon le MJ.

La **portée** d’une arme est le nombre de cases que parcourt le projectile ; pour la portée, chaque diagonale compte pour 2 cases.

## Se défendre

Attaqué, le personnage peut tenter une **parade** (avec une arme ou un bouclier, compétence *Parade*) ou une **esquive** (compétence *Esquive*), si sa posture le permet. C’est aussi un jet de D100 :

| Résultat de la défense | Effet |
| --- | --- |
| Jet réussi **et** résultat égal ou meilleur que celui de l’attaquant | Le coup est entièrement bloqué. |
| Jet réussi, mais moins bon que celui de l’attaquant | **Défense partielle** : les dégâts sont divisés par 2. Avec un bouclier, son armure (AP ou AM) compte à ce moment. |
| Jet raté | Dégâts normaux. |

- **Réussite critique en défense** : une contre-attaque est possible, ou autre chose selon le MJ.
- **Échec critique en défense** : l’armure ne compte pas, et l’attaquant ajoute +8 aux dégâts (ou autre chose selon le MJ).
- Contre une **attaque de zone**, l’esquive perd 5 % par case à parcourir pour sortir de la zone, sans pouvoir dépasser sa vitesse ; la parade n’est pas concernée. On ne peut pas protéger un voisin pris dans la même zone.

Combien de fois peut-on parer ou esquiver par tour ? Cela dépend de la posture : aucune en posture offensive, deux en neutre, sans limite en défensive… (voir [les postures](/guide/les-postures/)).

## Viser une partie du corps

Par défaut, on frappe le corps. Viser ailleurs est plus difficile, mais a un effet :

| Zone touchée | Malus pour toucher | Effet |
| --- | --- | --- |
| Tête | −25 % | le coup inflige +10 dégâts |
| Corps | 0 % | aucun |
| Bras droit | −18 % | −15 % au prochain test d’attaque avec une arme |
| Bras gauche | −18 % | −5 % au prochain test (quel qu’il soit) |
| Jambe droite | −12 % | −1 de vitesse au prochain tour |
| Jambe gauche | −12 % | −4 d’initiative au prochain tour |

Pour un personnage gaucher, les effets des côtés droit et gauche sont inversés. Ce tableau vaut pour les humanoïdes : pour un monstre, le MJ adapte les zones à sa forme.

Prises en tenaille, attaques d’opportunité, attaques discrètes, embuscades… : ces cas plus rares sont dans [[Les situations avancées]].', 'Un coup se joue en deux jets de D100 : celui de l’attaquant pour toucher, puis, si sa posture le lui permet, celui de la cible pour se défendre. Si le coup passe, il reste à compter les dégâts (voir [[guide/les-degats|Les dégâts]]).

## Attaquer

### Le jet d’attaque

L’attaquant lance un D100 et doit faire son score ou moins dans la compétence qui sert à l’attaque :

- **avec une arme**, la compétence de l’arme, que donne la colonne *Compétence* de la page des [armes](/ressources/equipement/#armes) : *Arme Légère* (Agilité), *Arme Lourde* (Force), *Arc* (Force) ou *Arbalète* (Perception) ; certaines armes en écrivent deux (Lourde / Légère, Arc / Légère) ;
- **avec un sort**, la compétence *Magie* (Intelligence) ; les mages rouge, bleu et vert lancent les leurs avec *Concentration* (Volonté).

Deux résultats sortent de l’ordinaire :

- **Réussite critique (1 à 5)** : les dégâts de base sont doublés, et la cible ne peut bloquer le coup que par une réussite critique meilleure que celle de l’attaquant.
- **Échec critique (96 à 100)** : la cible peut riposter par une attaque d’opportunité, ou désarmer l’attaquant si c’est possible ; le MJ peut aussi en décider autrement.

### La portée

La **portée** d’une arme est le nombre de cases que parcourt son projectile ; pour la compter, chaque diagonale vaut 2 cases. Chaque arme écrit la sienne ; une arme qui n’en écrit pas a une portée de 1.

### Une arme dans chaque main

Avec une arme de mêlée dans chaque main, chaque attaque subit un malus :

- **−20 %** pour la main directrice (l’arme 1 de la fiche), **−40 %** pour la main secondaire ;
- ce malus est divisé par deux pour la main qui tient une dague, et divisé par deux pour un personnage de la classe [[classes/bimane|Bimane]] ; les deux se cumulent.

*Exemple : un Bimane qui tient une épée et une dague attaque à −10 % de chaque main.*

Cela ne vaut que pour deux armes de mêlée : l’arc, l’arbalète, les armes de jet et les bombes n’y entrent pas.

### Quelques armes à part

- **La dague** : un coup réussi à la dague impose un malus de 10 % à la défense de l’adversaire (20 % avec la lame secrète).
- **Les armes de jet** : on peut en lancer deux en sacrifiant son déplacement et son action (ou utiliser deux fois la fronde).
- **Le {{mordhau}}** : prendre son arme par la lame pour frapper avec le manche donne des dégâts de frappe à une arme qui n’en fait pas, au risque de l’abîmer (voir [[guide/l-equipement|L’équipement]]).

## Se défendre

### Parer ou esquiver

Attaquée, la cible peut tenter :

- une **parade**, avec son arme ou son bouclier : compétence *Parade* (Force) ;
- une **esquive** : compétence *Esquive* (Agilité).

C’est un jet de D100, possible seulement si sa posture le permet et qu’il lui reste des défenses pour le tour. Pour bloquer entièrement le coup, deux conditions : **réussir son jet, et faire un résultat égal ou meilleur que celui de l’attaquant.**

| Résultat de la défense | Ce qui se passe |
| --- | --- |
| Réussie, et égale ou meilleure que l’attaque | Le coup est entièrement bloqué. |
| Réussie, mais moins bonne que l’attaque | **Défense partielle** : les dégâts finaux sont divisés par 2. Si c’est une parade au bouclier, ses AP ou son AM comptent à ce moment-là. |
| Ratée, même avec un meilleur résultat que l’attaque | La défense échoue : les dégâts sont entiers. |

Là encore, les critiques changent tout :

- **Réussite critique en défense** : une contre-attaque est possible, ou désarmer l’adversaire ; le MJ peut aussi imaginer autre chose. La posture défensive l’élargit (voir [[guide/les-postures|Les postures]]).
- **Échec critique en défense** : l’AP et l’AM de la cible ne comptent pas, et l’attaquant ajoute +8 à ses dégâts (ou autre chose, au choix du MJ).

### Combien de défenses par tour ?

Cela dépend de la posture du moment : certaines n’en permettent aucune, d’autres un nombre limité par tour, et la posture défensive les permet sans limite, mais chaque défense y fait baisser la réussite de la suivante : dès la première selon le Doc « Créer sa fiche de personnage », au-delà de deux selon le [[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]. Les chiffres de chaque posture sont dans [[guide/les-postures|Les postures]].

La posture défensive permet aussi l’**intervention** : parer ou esquiver le coup à la place d’un allié adjacent.

Les boss, pensés pour affronter une équipe de quatre joueurs, ont plus de parades et d’esquives que les autres en posture neutre, de vigilance ou de symbiose (voir [[guide/situations-avancees|Les situations avancées]]).

### Les attaques de zone

- Pour esquiver une attaque de zone, il faut en sortir : l’Esquive perd 5 % par case à parcourir, et l’on ne peut pas parcourir plus de cases que sa vitesse. Un personnage qui a 4 de vitesse ne peut donc pas esquiver une zone qui s’étend sur 5 cases ou plus.
- La parade n’est pas concernée.
- Quand deux personnages sont pris dans la même zone, l’un ne peut pas protéger l’autre, même en posture défensive.

## Viser une partie du corps

Viser la tête, un bras ou une jambe plutôt que le corps est plus difficile : chaque zone a son malus pour toucher. En échange, le coup y porte un effet en plus, propre à la zone ; le corps, lui, n’a ni malus ni effet. Le malus et l’effet de chaque zone sont dans le tableau « Localisation des dégâts » de [[guide/attaque-et-defense|Attaque et Défense]].

- Pour un personnage gaucher, les effets du côté droit et du côté gauche sont inversés.
- Ce tableau est pensé pour les humanoïdes : face à un monstre, le MJ peut en réattribuer les zones selon son anatomie (pour un scorpion, la « tête » peut être sa queue).

## Les situations qui changent la donne

Le détail de chacune est dans [[guide/situations-avancees|Les situations avancées]].

- **La prise en tenaille.** Un ennemi encerclé au corps à corps par des alliés placés sur des cases opposées (devant et derrière, ou à gauche et à droite) est en tenaille : à deux, +4 aux dégâts ; à trois, encore +4 ; à quatre, en plus, +5 % de réussite critique pour les alliés et −10 % au jet de défense de la cible. Les effets se cumulent.
- **L’attaque d’opportunité.** Une attaque offerte quand un adversaire rate son attaque contre vous sur un échec critique, quand il sort de votre zone d’influence (sauf si c’est vous qui l’y forcez), ou quand un don de votre classe le permet. Une seule par tour et par joueur, sauf don qui en permet plus. Ce doit être une action simple : un coup avec une arme déjà dégainée et à portée, ou un sort d’attaque ; pas de sort qui n’attaque pas, de sort de niveau 5, de déplacement, de potion ni d’arme à dégainer. Sa victime ne peut ni parer ni esquiver, sauf en posture défensive.
- **L’attaque discrète.** Frapper une cible qui ne vous voit pas venir ajoute un dé aux dégâts (2d6 à la dague deviennent 3d6). Il faut passer en mode discret (trois actions rapides, deux pour un [[classes/voleur|voleur]]), réussir un jet de *Ruse*, et qu’aucun ennemi ne vous voie clairement. La cible tente alors un jet d’*Observation* ou de *Distinction* : si elle fait mieux que votre jet de discrétion, la discrétion est perdue, et le dé en plus avec elle. À ne pas confondre avec l’attaque sournoise, qui vient d’une classe.
- **L’embuscade.** Vous consommez l’action de votre tour pour attendre un ennemi, et lui porter une attaque d’opportunité dès qu’il entre dans la zone voulue : à une distance égale à la vitesse divisée par 2 avec une arme de corps à corps (on fonce alors sur lui), à la portée de l’arme avec une arme à distance, à la portée du sort avec la magie. Posture, déplacement et actions rapides restent possibles pendant ce tour. Contrairement aux autres attaques d’opportunité, la victime d’une embuscade peut parer ou esquiver ; et la posture de vigilance déjoue l’embuscade.', 'neutre', NULL, 'page', '{"id":"guide/attaquer-et-se-defendre"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 290, 'guide', 'Les bases', 'L’équipement', 'Texte', 'modifie', '## Les armes

Un personnage a au plus **deux armes** en main ; les autres vont dans l’inventaire. Pour chacune, la fiche note :

- ses **dégâts** : un nombre de dés qui dépend de la maîtrise (sans maîtrise 1 dé, avec 1 point de maîtrise 2 dés…), plus les bonus ;
- sa **portée** (le plus souvent 1 case) ;
- ses **effets en plus**, comme des dégâts supplémentaires contre certaines créatures ;
- sa **solidité** : le nombre de mauvais coups qu’elle encaisse avant de se briser.

Chaque catégorie d’arme a son dé de dégâts : dagues d6, épées d10, masses d10, haches d10, armes d’hast d10, pugilat d6 à d10, bâton de combat d8, armes de jet d6, bombes d6, arcs d8, arbalètes d12. Le détail est dans les [armes](/ressources/armes/).

## L’armure

L’armure retire des points aux dégâts reçus (voir [les dégâts](/guide/les-degats/)) :

- l’**armure physique (AP)** protège des armes ;
- l’**armure magique (AM)** protège des sorts.

Le personnage a une **AP et une AM de base** (de sa race, de ses classes magiques ou d’un objet), auxquelles s’ajoute l’armure portée, pièce par pièce, sur **six parties du corps** : la tête (T), le corps (C), le bras gauche (BG), le bras droit (BD), la jambe gauche (JG) et la jambe droite (JD). L’armure a aussi une **durabilité**.

Ses **bonus et malus** disent comment elle encaisse les trois types de dégâts physiques : l’estoc, la taille et la frappe. Une armure qui résiste aux dégâts de frappe, par exemple, compte deux fois ses AP contre un coup de masse. Une armure de catégorie **lourde** retire 1 point de vitesse et empêche de nager ; chaque classe dit quelles armures elle sait porter. Le détail est dans les [armures](/ressources/armures/).

## Le bouclier

Le bouclier ajoute ses AP et son AM à celles de l’armure, mais seulement lors d’une **défense partielle** (voir [Attaquer et se défendre](/guide/attaquer-et-se-defendre/)). Les boucliers sont rangés par classe, de 1 à 5 : chaque classe de personnage dit jusqu’où elle sait les porter. Voir les [boucliers](/ressources/bouclier/).

## Les accessoires

Six emplacements pour des accessoires aux effets variés (voir les [accessoires](/ressources/accessoires/)).

## La ceinture

Tout le monde a une ceinture, avec **trois emplacements d’objets rapides**. Un objet à la ceinture s’utilise en action rapide (IC), ou en deux pour allumer quelque chose ou soigner, au lieu de prendre toute l’action : une fiole de soin ou de poison, un briquet, une torche, une corde, un kit… Les armes n’y vont pas, elles ont leurs emplacements ; les carquois, sacs de bombes ou de pierres doivent, eux, être à la ceinture pour servir.

## L’inventaire et le sac à dos

Le nombre d’emplacements de l’inventaire dépend de la Force du personnage. Il commence avec un sac à dos normal, soit deux colonnes d’inventaire ; de plus grands sacs en ajoutent :

| Sac à dos | Emplacements | Force demandée |
| --- | --- | --- |
| Grand sac | +4 | 2 |
| Super sac | +8 | 3 |
| Méga sac | +12 | 4 |
| Ultra sac | tout l’inventaire | 5 |', 'Tout l’équipement du jeu est sur la page [Équipement](/ressources/equipement/) : les armes, les armures, les boucliers, les objets de ceinture et les accessoires, avec leurs prix, leurs matériaux et leurs améliorations. Les matériaux eux-mêmes sont sur la page [Composants](/ressources/composants/). Cette page explique comment se servir de tout cela.

## Les armes

### Ce que note la fiche

Un personnage a au plus **deux armes équipées** ; les autres vont dans son sac. Pour chacune, la fiche note :

- son **nom** ;
- ses **dégâts** : des dés, plus un bonus ;
- sa **portée** : le nombre de cases que parcourt son projectile, 1 pour une arme qui n’en écrit pas ;
- ses **effets en plus** : une particularité de l’arme, comme des dégâts supplémentaires contre certaines créatures ;
- sa **{{solidite|solidité}}**.

Sur la page des [armes](/ressources/equipement/#armes), les armes écrites en bleu sont celles qui peuvent être une arme de départ.

### Les dégâts d’une arme

- **Le nombre de dés** vient de la maîtrise que le personnage a de la catégorie de l’arme : 1 dé sans maîtrise, 1 de plus par point de maîtrise, jusqu’à 4 points au plus par catégorie, donc 5 dés. Les points de toutes les sources s’additionnent, jusqu’à ce plafond ; au-delà, la fiche le signale, et les points en trop ne donnent pas de dé. Les armes de monstres, réservées aux monstres, ne se maîtrisent pas.
- **Le dé** est celui de l’arme, le plus souvent celui de sa catégorie : D6 pour les dagues, D10 pour les épées, D8 pour les arcs, D12 pour les arbalètes… Au pugilat, il dépend de la Force : D6 avec 1 ou 2, D8 avec 3 ou 4, D10 avec 5.
- **Le bonus** additionne celui de l’arme, celui de son matériau (le fer, par défaut) et celui de son amélioration.

*Exemple : un espadon en titane amélioré à +5 inflige D10 + 29 avec un seul dé : D10 + 10 de l’espadon, + 9 du titane, + 10 de l’amélioration.*

### Améliorer une arme

Une arme s’améliore de +1 à +10, une étape après l’autre : impossible d’en sauter une. Chaque niveau donne le bonus de dégâts qu’il écrit (+2 au +1, jusqu’à +20 au +10) et, à partir du +5, un cran de solidité de plus (deux au +10). Chaque étape se paie en RO, certaines aussi avec une unité du matériau de l’arme.

Le prix d’une arme forgée additionne le coût de l’arme, une unité de son matériau et le coût de chaque étape d’amélioration ; les matériaux s’achètent ou se fournissent. *Exemple : l’espadon en titane +5 revient à 620 RO et 3 unités de titane, ou à 1 220 RO si l’on achète aussi le titane.*

### La solidité d’une arme

- La {{solidite|solidité}} est le nombre de mauvais coups qu’une arme peut encaisser avant de casser.
- Elle additionne les crans de l’arme, de son matériau (la fonte en retire un, le bronze et le titane en ajoutent un…) et de son amélioration, sans jamais descendre sous 1.
- À 0, l’arme est cassée : inutilisable jusqu’à sa réparation. Un kit de réparation d’arme lui rend un cran de solidité (usage unique).
- Se battre en {{mordhau}} (l’arme prise par la lame, on frappe avec le manche) permet à certaines armes, notamment les épées, de faire des dégâts de frappe, mais l’arme a alors 30 % de risque de s’abîmer : au-delà de 70 au jet d’attaque, elle perd un cran de solidité.

Pour se battre avec une arme dans chaque main, voir [[guide/attaquer-et-se-defendre|Attaquer et se défendre]].

## L’armure

### L’AP et l’AM

L’armure retire des points aux dégâts reçus (voir [[guide/les-degats|Les dégâts]]) :

- l’**armure physique (AP)** protège des armes ;
- l’**armure magique (AM)** protège des sorts.

L’AP et l’AM d’un personnage additionnent :

- son **AP et son AM de base** : une AP de base vient de la race (certains Drakos ou Namazu, par exemple) ou d’un objet ; l’AM de base vient surtout des classes magiques, **4 AM par classe magique** (la seconde spécialité des classes raciales et du Flagelleur en donne aussi 4, à partir du niveau 10 de la classe : son don de ce niveau la fait considérer comme une classe magique), et parfois de la race (les Drakos ou les Marcass) ou d’objets magiques ;
- ce que donnent ses **accessoires** ;
- l’**armure portée**, avec son amélioration.

Le bouclier compte à part (voir plus bas), et la posture défensive ajoute de l’AP et de l’AM (voir [[guide/les-postures|Les postures]]).

### Une armure, deux matériaux

- Une armure se fabrique et se porte **entière** : on ne la fabrique plus pièce par pièce.
- Elle est faite de deux matériaux, dont les bonus s’additionnent : cuir et cuir donnent 4 AP, écailles et bois 8 AP et 1 AM. La grille de l’onglet [Armures](/ressources/equipement/#armures) donne chaque combinaison : sa catégorie (léger, intermédiaire ou lourd), son AP et son AM, sa {{solidite|solidité}}, et les coups auxquels elle résiste ou contre lesquels elle est faible.
- Son prix : 10 RO de fabrication, plus 6 unités de chacun de ses deux matériaux, au prix de la page Composants (12 unités pour une armure d’un seul matériau). *Exemple : l’armure Cuir/Peau coûte 10 + 6 × 2 + 6 × 1 = 28 RO.* Avec ses propres matériaux, il ne reste que les 10 RO.
- Les armures particulières (vêtements, cottes de mailles, armures de familiers…) ont leur propre prix, pour l’armure entière, et s’améliorent comme les autres.
- Une armure de la catégorie *Lourd* retire 1 point de vitesse et rend la vitesse de nage nulle.

### Le poids qu’on peut porter

- Chaque armure a un poids, sa catégorie : *Vêtement*, *Léger*, *Intermédiaire* ou *Lourd*. Un personnage porte une armure de son **poids portable** ou plus légère, jamais plus lourde : la fiche ne lui propose que celles-là, armures élémentaires comprises.
- Ce poids est celui de la **maîtrise d’armures** de ses classes, sur leur page (voir [les classes](/classes/)) : légères seulement, jusqu’aux intermédiaires, ou jusqu’aux lourdes ; pour un personnage bi-classé, la plus large des deux. Le [[classes/mage|Mage]], le [[classes/mage-vert|Mage Vert]] et l’[[classes/ocultomancien|Ocultomancien]] n’y citent qu’un bouclier, le [[classes/flagelleur|Flagelleur]] écrit « Aucun » et l’[[classes/archimage|Archimage]] « Comment ça une armure ? » : ils ne portent que des vêtements.
- Un **don** débloqué qui écrit un poids le relève : « Maîtrise les armures intermédiaires », « Peut porter une armure lourde »… Le Templier, qui « Maîtrise les 3 armures », va jusqu’aux lourdes.
- Le **Nain** porte une catégorie de plus, dons compris : rien devient léger, léger devient intermédiaire, intermédiaire devient lourd. La **Lamia** peut porter une armure légère même si sa classe l’interdit.
- Jamais plus lourd que *Lourd*. Un personnage dont la magie innée est le **Potentiel Illimité** ne porte jamais d’armure lourde, même si sa classe le permet.
- Une armure devenue trop lourde, parce qu’une classe ou un don a changé, est retirée de la fiche et notée, datée, dans ses notes.
- Les armures de familier sont à part : elles ne se portent pas sur une fiche de personnage, et serviront aux fiches de familier.

### Résister aux coups

Chaque armure se comporte à sa façon contre les trois types de dégâts physiques : l’**estoc**, la **taille** et la **frappe**.

- Contre un type de dégâts auquel elle **résiste**, ses AP comptent double.
- Contre un type de dégâts auquel elle est **faible**, ses AP comptent moitié.
- Un « x2 » double l’effet : ses AP comptent quatre fois, ou pour un quart.
- Seul le résultat final des dégâts s’arrondit.

*Exemple : un coup de masse fait 20 dégâts à un personnage dont l’armure a 5 AP et résiste à la frappe. Ses AP comptent pour 10 : il prend 20 − 10 = 10 dégâts.*

### Les six parties de l’armure

- La {{solidite|solidité}} d’une armure est le nombre de mauvais coups qu’elle peut encaisser avant de casser. Cassée n’est pas forcément détruite : une armure à 0 se répare.
- Elle se compte partie par partie : le casque, le torse, le bras gauche, le bras droit, la jambe gauche et la jambe droite. Chacune a sa solidité du moment, de 0 (cassée) au maximum de l’armure, c’est-à-dire sa solidité et les crans de son amélioration : une armure peut donc casser à certains endroits seulement.
- Chaque partie compte, contre une attaque qui la vise, l’AP et l’AM de l’armure, ou 0 quand elle est cassée : seuls l’AP et l’AM de l’armure tombent à 0, le reste (la base, les accessoires, la posture) demeure. Une attaque qui ne vise aucune partie touche le torse, sauf indication contraire du MJ.
- Chaque partie se répare à part, avec un métier adapté et le matériau. Un kit de réparation d’armure suffit, lui, sans matériau : il rend un cran de solidité à l’ensemble de l’armure, à chacune de ses parties.
- Une armure à **cran de solidité uni** n’a qu’une solidité : si elle perd un cran, c’est toute l’armure qui est abîmée. À 0, toutes ses parties sont cassées, et elle ne donne plus aucun de ses effets, bonus comme malus, jusqu’à sa réparation ; le poids d’une armure lourde, lui, demeure.
- Les armures spécifiques qui donnent un bonus de compétence (robe de mage, tenue du Flagelleur, armure montagne) ont un cran de solidité uni : elles n’ont pas de morceaux à perdre, et cassées, elles perdent leur bonus de compétence comme leurs autres effets.

### Améliorer son armure

Une armure s’améliore de +1 à +5, toujours entière, une étape après l’autre. Chaque niveau donne l’AP et l’AM qu’il écrit, +2 au +1, jusqu’à +10 au +5, et un cran de solidité de plus à partir du +4. Les prix sont dans l’onglet Armures.

## Les pièces élémentaires

Posée sur une arme, une armure ou un vêtement, une [[ressources/pieces-elementaires|pièce élémentaire]] le transforme pour toujours en un équipement chargé de la magie de la pièce. Ses bonus d’origine sont perdus, remplacés par ceux de l’élément.

### L’armure transformée

- Quels que soient son matériau, son amélioration et son état, cassée ou non, l’armure **devient l’armure élémentaire** de la magie de la pièce et de son poids : *Vêtement*, *Léger*, *Intermédiaire* ou *Lourd*. Seul le poids compte. Chacune des 14 magies a ses quatre armures élémentaires ; le Potentiel Illimité n’a pas de pièce élémentaire.
- Elle perd tout ce qu’elle avait : l’AP, l’AM, les résistances ou faiblesses aux coups de l’armure d’origine, et son amélioration. Elle **repart sans amélioration** : seuls comptent l’AP, l’AM et les effets de l’armure élémentaire, puis ceux de sa nouvelle amélioration.
- Elle s’améliore de +1 à +5, avec les gemmes de sa magie (le rubis pour le Feu, le saphir pour l’Eau…), selon le tableau de la page [[ressources/pieces-elementaires|Pièces élémentaires]] : +2 AP et AM au +1, jusqu’à +10 au +5. Chaque étape se paie à son tour : passer de 0 à +2 coûte 2 gemmes communes, puis 2 gemmes raffinées.
- Sa {{solidite|solidité}} est de **4 crans**, plus un au +4 et un autre au +5. Elle se compte sur les **six parties**, comme celle de toute armure : chacune de 0 au maximum.
- Il faut posséder sa magie pour la porter : la fiche ne propose que les armures élémentaires de la magie innée et de la magie acquise du personnage, dans la même liste que les autres armures et jusqu’à son poids portable, avec l’amélioration qu’elles ont déjà. Une armure élémentaire dont le personnage n’a plus la magie est retirée de la fiche et notée, datée, dans ses notes.
- Portée, elle donne le **cran de résistance** qu’écrivent ses effets : +1 cran à sa magie, tel qu’écrit (l’armure de l’Arcane le donne à la Corruption, celle de la Corruption à l’Arcane) ; le Vêtement de Glace, *Tissu du froid*, donne aussi +1 cran au Feu et l’immunité à la Brûlure. La fiche les compte dans son tableau « Résistances et faiblesses » : ils s’additionnent aux crans des magies du personnage et à ceux de ses accessoires, et une immunité écrite l’emporte. Seule l’armure portée compte ; elle les donne même quand ses parties sont à 0, et même quand sa magie est celle que la posture de symbiose laisse inactive. Ses autres effets (sur les ennemis, pour un temps, selon la situation) et son amélioration ne donnent aucune résistance.
- Les armures de familier ne se transforment pas.

### L’arme transformée

Une arme devient l’arme élémentaire de sa famille et de la magie (tout arc et le Sang donnent l’Arc de Sang) : elle a le dé et la portée de son type et +8 aux dégâts, et elle perd tout le reste, son bonus, son dé, sa portée, son matériau et son amélioration (décision R167). Une arme élémentaire a une {{solidite|solidité}} de 4 crans, plus les crans de la ligne d’amélioration choisie : 5 du +5 au +9, 6 au +10 (décision R167).

## Le bouclier

- Un bouclier, c’est **une forme et une matière**. La forme est sa classe, de 1 à 5 : Bocle, Targe, Bouclier Rond, Écu et Pavois. La matière donne sa {{solidite|solidité}}.
- La plupart des classes de personnage disent, dans leur maîtrise d’armures, jusqu’à quelle classe de bouclier elles savent porter ; d’autres n’en citent aucune.
- Ses AP et son AM s’ajoutent à ceux de l’armure, mais **seulement lors d’une parade partielle** (voir [[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- Son **poids** demande une Force minimum : 1 pour un bouclier léger, 2 pour un moyen, 3 pour un lourd, 4 pour un très lourd. Il faut au moins ce score de Force pour le porter.
- Il s’améliore de +1 à +5 : l’AP du niveau choisi, de +2 au +1 à +10 au +5, un cran de solidité dès le +1 et un second au +5.
- À 0 de {{solidite|solidité}}, le bouclier est cassé : ses AP et son AM ne comptent plus.
- Le bouclier ne va pas à la ceinture : il a son emplacement dans l’armure.

Tous les boucliers, avec leur poids et leur prix, sont dans l’onglet [Boucliers](/ressources/equipement/#boucliers).

## Les accessoires

- Un personnage a **six emplacements** d’accessoires : le chef (la tête), le collier, deux bracelets et deux bagues.
- Chaque accessoire porte un effet de la table des accessoires : le générateur de l’onglet [Accessoires](/ressources/equipement/#accessoires) en tire un aux dés, étape par étape. Deux accessoires ne peuvent pas avoir le même effet.
- La fiche compte leurs effets : un point de caractéristique (sans dépasser 4 ni les limites de la race), des points acquis dans une compétence au choix de la caractéristique visée, des dégâts, de l’armure…
- Un accessoire **maudit** a l’effet contraire de celui qui est écrit : +1 en Force devient −1 en Force. Il ne peut être retiré que par un enchanteur, contre le prix que l’accessoire devrait coûter. Une malédiction qui tombe en tirant un accessoire le rend maudit, et l’on refait le tirage à partir de l’étape 2, au même emplacement ; une seconde malédiction le détruit.

## La ceinture

Tout le monde a une ceinture. Elle a **trois emplacements** d’objets rapides : un objet rangé à la ceinture s’utilise en une action rapide (IC), ou en deux pour allumer quelque chose ou faire des soins physiques, là où il faudrait sinon toute l’action.

Voici quelques objets qui peuvent y aller (la liste n’est pas complète, voyez avec votre MJ) : une fiole de soin ou de poison, un briquet ou de quoi allumer, une torche ou une lanterne, un kit (de soin, du voleur, du saboteur…), une corde, ou tout autre petit objet.

- Les **carquois**, les **sacs de bombes** et les **sacs de pierres** doivent être à la ceinture pour servir.
- Les **armes** n’y vont pas, elles ont leurs propres emplacements ; le **bouclier** non plus, le sien est dans l’armure.
- Un emplacement contient au plus **3 exemplaires du même objet**, ou 4 avec un don qui le permet (comme *Organisé*, du [[classes/mercenaire|Mercenaire]]). Un **bâton magique** y compte pour un seul objet. Un **carquois** ou un sac compte ses projectiles, autant qu’il peut en contenir.
- Un objet mis à la ceinture quitte le sac, et y revient quand on le range. En combat, mettre des objets à la ceinture coûte l’action et une action rapide.
- Un **bâton magique** donne ses effets tant qu’il est porté, à la ceinture ou dans un emplacement d’arme ; deux bâtons qui amplifient la même chose ne se cumulent pas.

## Le sac

- La place du sac dépend de la Force du personnage : **24 emplacements** avec 1 en Force, **28** avec 2, **32** avec 3, **36** avec 4, et **48**, tout l’inventaire, à partir de 5. Le don *Organisé* du Mercenaire donne les 48 emplacements, quelle que soit la Force.
- Une ligne du sac est un emplacement, quel que soit le nombre d’objets qu’elle compte.
- L’inventaire de départ vient de la classe : sa page le donne. Avec deux classes dès le départ, on prend 5 objets parmi les 10 proposés.
- En combat, sortir un objet du sac prend toute l’action (voir [[guide/le-tour-de-jeu|Le tour de jeu]]).

Le texte des règles d’où vient cette page : [[guide/fiche-maitrise-darme-et-armes|Maîtrise d’arme et Armes]], [[guide/fiche-armure-defense-bouclier|Armure/Défense/Bouclier]], [[guide/fiche-accessoires-et-ceinture|Accessoires et Ceinture]] et [[guide/fiche-inventaire-sac-a-dos|Inventaire/Sac à dos]].', 'neutre', NULL, 'page', '{"id":"guide/l-equipement"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 291, 'guide', 'Les bases', 'Les dégâts', 'Texte', 'modifie', 'Quand une attaque touche, les dégâts se calculent toujours dans le même ordre :

> **Dégâts finaux = [ ( dégâts de l’attaque × 2 si réussite critique − armure de la cible ) ÷ 2 si défense partielle ÷ 2 si un don divise les dégâts ] × résistance ou faiblesse**

1. **La posture** peut changer les dés : en offensive, les dégâts sont au maximum ; en focus, les dés de sort montent d’un cran (le d6 devient d8…).
2. **On lance les dégâts** de l’arme ou du sort.
3. **Réussite critique** : on multiplie par 2.
4. **On retire l’armure** de la cible : AP contre une arme, AM contre un sort.
5. **Défense partielle** : on divise par 2.
6. **Don qui divise les dégâts** : on divise par 2.
7. **Résistance ou faiblesse** : × 2 si la cible est vulnérable, ÷ 2 si elle résiste.
8. **On arrondit à l’inférieur.**

## Trois exemples

**Un coup de masse, sans critique.** L’ennemi frappe à la masse (2d10+2) et touche ; les deux combattants sont en posture neutre ; je rate ma défense. Mon armure a 5 AP et résiste aux dégâts de frappe.

- Les dés donnent 20 dégâts ; pas de critique.
- Mon armure résiste à la frappe : ses AP comptent double, 10. Reste 20 − 10 = **10 dégâts**.

**Un coup de lance critique.** L’ennemi, en posture offensive, frappe à la lance (2d10+3) et fait un critique. Je suis en posture défensive (+2 AP) et je fais moi aussi un critique, moins bon que le sien : défense partielle. Mon armure a 7 AP.

- Posture offensive : dégâts au maximum, 23. Critique : × 2, 46.
- Armure : 7 + 2 = 9 AP. Reste 46 − 9 = 37.
- Défense partielle : 37 ÷ 2 = 18,5, arrondi à **18 dégâts**.

**Un sort de feu.** Je lance un sort de feu (2d6+2) en posture focus et je réussis ; la cible, en posture neutre, rate sa défense. Elle a 2 AM et elle est vulnérable au feu.

- Posture focus : les d6 deviennent des d8. Les dés donnent 12.
- Armure : 12 − 2 = 10.
- Faiblesse au feu : 10 × 2 = **20 dégâts**.

Le guide pour MJ détaille la formule et ses exemples : [[Formule des dégâts]].', 'Un coup a touché, et la cible n’a pas su l’arrêter entièrement (voir [[guide/attaquer-et-se-defendre|Attaquer et se défendre]]). Reste à savoir ce qu’il lui coûte. Arme ou sort, le calcul se fait toujours dans le même ordre.

## La formule

> **Dégâts finaux = [ ( dégâts de l’attaque × 2 si réussite critique ÷ 2 si l’attaquant est en posture défensive − armure de la cible ) ÷ 2 si défense partielle ÷ 2 si un don divise les dégâts ] × résistance ou faiblesse**

## Le calcul, étape par étape

1. **La posture de l’attaquant règle les dés.** En posture offensive, les dégâts sont au maximum et l’on ne lance pas les dés : 2d6+2 font 14, 6d6+4 font 40. En posture focus, les dés de dégâts des sorts montent d’un cran : D4, D6, D8, D10, D12, puis D20, jamais au-delà.
2. **On lance les dés** de l’arme ou du sort, et l’on ajoute leurs bonus.
3. **Réussite critique de l’attaquant** : les dégâts sont multipliés par 2.
4. **Attaquant en posture défensive** : ses dégâts sont divisés par 2, avant de retirer l’armure. Cette posture divise les dégâts que l’on inflige, pas ceux que l’on reçoit.
5. **On retire l’armure de la cible** : son armure physique (AP) contre une arme, son armure magique (AM) contre un sort.
6. **Défense partielle** (une parade ou une esquive réussie, mais moins bonne que l’attaque) : on divise par 2.
7. **Un don qui divise les dégâts** : on divise encore par 2.
8. **Résistance ou faiblesse de la cible à la magie du coup** : on multiplie par la valeur de son palier (voir plus bas) ; contre un coup physique, c’est l’armure qui réagit à son type (étape 5).
9. **On arrondit à l’inférieur**, une seule fois, à la fin. Le résultat ne descend jamais sous 0.

## L’armure de la cible

L’AP et l’AM d’un personnage additionnent sa base (race, ethnie, 4 AM par classe magique, et 4 pour la seconde spécialité d’une classe raciale ou du Flagelleur), ses accessoires et l’armure qu’il porte, avec son amélioration (voir [[guide/l-equipement|L’équipement]]). Trois choses peuvent s’y ajouter ou la changer au moment du coup :

- **sa posture** : la posture défensive ajoute de l’AP et de l’AM, la symbiose de l’AM (voir [[guide/les-postures|Les postures]]) ;
- **son bouclier** : ses AP et son AM ne comptent que sur une parade partielle faite avec lui ;
- **un échec critique en défense** : son AP et son AM ne comptent pas du tout, et l’attaquant ajoute +8 à ses dégâts (ou autre chose, au choix du MJ).

Contre un coup physique, l’armure portée réagit aussi à son type, **estoc**, **taille** ou **frappe** : contre un type auquel elle résiste, ses AP comptent double ; contre un type auquel elle est faible, ils comptent moitié ; un « x2 » double cet effet (quatre fois, ou un quart). L’onglet [Armures](/ressources/equipement/#armures) donne les résistances et les faiblesses de chaque armure. Une armure transformée par une pièce élémentaire perd celles de l’armure d’origine.

## Résistances et faiblesses

Chaque magie résiste à certaines magies et craint certaines autres : la page de chaque [magie](/magies/) les donne, et le tableau [Relations entre magies](/magies/#relations) les réunit toutes. Une cible prend deux fois plus de dégâts d’une magie à laquelle elle est vulnérable, et deux fois moins d’une magie à laquelle elle résiste.

Les résistances et les faiblesses se comptent en crans, qui s’additionnent : chaque résistance à une magie en ajoute un, chaque faiblesse en retire un. Un personnage à deux magies cumule ainsi celles de ses deux magies : deux résistances à la même magie font une grande résistance, deux faiblesses une grande vulnérabilité, et une résistance et une faiblesse s’annulent. L’Arcane et la Corruption résistent l’une à l’autre. Certains objets et équipements changent aussi ces crans : un accessoire de résistance, ou l’armure élémentaire portée, qui donne un cran de résistance à sa magie (voir [[guide/l-equipement|L’équipement]]).

Le tableau « Résistances et faiblesses » de la [fiche de personnage](/fiche/) donne chaque palier avec son effet sur les dégâts subis, et y range les magies de votre personnage : il fait le compte pour vous.

## Trois exemples

Les trois exemples du [[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]], refaits pas à pas.

**Un coup de masse.** L’ennemi frappe à la masse (2d10+2) et réussit ; tout le monde est en posture neutre ; je rate ma défense. Mon armure a 5 AP et résiste aux dégâts de frappe.

- Ni la posture de l’ennemi ni la mienne ne changent quoi que ce soit. Les dés donnent 20 ; pas de critique.
- Mon armure résiste à la frappe : ses 5 AP comptent double. 20 − 10 = 10.
- Pas de défense partielle, pas de don, rien à arrondir : je prends **10 dégâts**.

**Un coup de lance critique.** L’ennemi, en posture offensive, frappe à la lance (2d10+3) et fait une réussite critique. Je suis en posture défensive ; je fais moi aussi une réussite critique en défense, mais moins bonne que la sienne : c’est une défense partielle. Mon armure a 7 AP et ne réagit pas à l’estoc.

- Posture offensive : les dégâts sont au maximum, 23. Réussite critique : 23 × 2 = 46.
- Ma posture défensive ajoute 2 AP (du niveau 1 au niveau 4) : 7 + 2 = 9. 46 − 9 = 37.
- Défense partielle : 37 ÷ 2 = 18,5, arrondi à **18 dégâts**.

**Un sort de feu.** Je lance un sort de feu (2d6+2) en posture focus et je le réussis. La cible, en posture neutre, rate sa défense ; elle a 2 AM et elle est vulnérable au feu.

- Posture focus : les D6 deviennent des D8, et le sort fait 2d8+2. Les dés donnent 12.
- 12 − 2 AM = 10.
- Pas de défense partielle ni de don. Vulnérabilité au feu : 10 × 2 = **20 dégâts**.

## Ce qui ajoute des dégâts

D’autres règles ajoutent des dégâts à l’attaque :

- **viser la tête** : +10 dégâts, au prix de −25 % pour toucher ;
- **la prise en tenaille** : +4 dégâts à deux alliés, +4 encore à trois ;
- **l’attaque discrète** : un dé de dégâts en plus (2d6 deviennent 3d6) ;
- **le Mode Hyper** : +15 aux dégâts physiques, et +15 aux dégâts de la magie (+7 pour un personnage à deux magies) ;
- **la symbiose** : un bonus aux dégâts des sorts de sa magie.

Le détail est dans [[guide/attaquer-et-se-defendre|Attaquer et se défendre]], [[guide/le-mode-hyper|Le Mode Hyper]] et [[guide/les-postures|Les postures]].

## Et la barrière ?

La {{barriere|barrière}} est une seconde peau magique qui protège la chair : une sorte de santé magique, qui vaut la moitié du {{chakra|chakra}} total (plus ce qu’offrent certaines races et classes). Plus un personnage a de {{chakra|chakra}}, plus sa {{barriere|barrière}} est grande ; mais certains matériaux d’arme la contrent, comme le **Mythril**, qui passe à travers, ou le **Maverium**, qui la brise à son contact, si colossale soit-elle. Une arme de **Laiton**, elle, fait des dégâts doublés contre la {{barriere|barrière}} (voir l’onglet [Matériaux](/ressources/composants/#materiaux) des composants).

## La fiche fait le calcul

Sur la [fiche de personnage](/fiche/), le bloc Armure affiche l’AP et l’AM totaux du personnage et calcule les dégâts qu’il reçoit : saisissez les dégâts du coup (critique compris) et leur type, cochez « Dégâts réduits » pour une défense partielle, « Au bouclier » ou « Don ÷ 2 » s’il y a lieu, et la fiche fait le reste.

Le texte d’origine de la formule et de ses exemples : [[guide/formule-des-degats|Formule des dégâts]] et [[guide/resistance-faiblesse-magie|Résistance/Faiblesse Magie]].', 'neutre', NULL, 'page', '{"id":"guide/les-degats"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 292, 'guide', 'Les bases', 'Les postures', 'Texte', 'modifie', 'Au début de son tour, avant tout le reste, chaque personnage déclare sa **posture**. Elle donne des avantages et des inconvénients jusqu’à son prochain tour : c’est le choix tactique le plus important du combat. Le MJ peut annoncer celle des ennemis de façon détournée, pour que les joueurs la devinent.

## Le tableau des postures

Le tableau de la fiche de personnage (survolez le nom d’une posture pour sa description) :

<!-- guide:postures -->

## Laquelle choisir ?

- **Offensif** : pour frapper fort. Dégâts au maximum et critiques plus fréquents, mais on touche moins bien et on ne peut ni parer ni esquiver.
- **Défensif** : pour tenir et protéger. Plus d’armure, des défenses sans limite (chaque défense au-delà de la deuxième perd 10 %), on peut défendre un allié voisin ou forcer un ennemi à nous attaquer ; mais nos dégâts sont divisés par 2.
- **Neutre** : l’entre-deux. Dégâts normaux, deux défenses par tour.
- **Focus** : pour la magie. +10 % de réussite, de meilleurs dés de sorts, plus de tour de charge pour les sorts de niveau 5 ; mais aucune défense.
- **Vigilance** : pour observer. Meilleure initiative et perception, on anticipe l’adversaire et on repère ses résistances ; une seule défense par tour.
- **Symbiose** : pour ne faire qu’un avec sa magie. Plus de dégâts magiques et d’armure magique, immunité à sa magie ; mais ni arme ni objet (sauf ceux faits de magie), une seule magie active et une seule défense par tour.

Le détail de chaque effet est dans [[Postures]].', 'Une **posture** est l’état dans lequel votre personnage aborde le combat. Il en existe six, et chacune a ses avantages et ses inconvénients : frapper plus fort, mieux se protéger, servir sa magie…

## Déclarer sa posture

- Au début de son tour, une fois subis les effets du début du tour (poison, brûlure…), chaque personnage **déclare sa posture, avant de faire quoi que ce soit d’autre** (voir [[guide/le-tour-de-jeu|Le tour de jeu]]).
- Ce choix décide en grande partie de ce qu’il pourra faire ensuite : attaquer, lancer ses sorts, mais aussi se défendre quand ce n’est pas son tour, car c’est sa posture qui dit combien de fois il peut parer ou esquiver.
- Le MJ joue aussi des postures pour ses ennemis. Il peut les annoncer à demi-mot, pour laisser les joueurs deviner à quoi ils ont affaire.

## Les six postures

Le tableau de la fiche de personnage (survolez le nom d’une posture pour la décrire) :

<!-- guide:postures -->

## Chaque posture en détail

### Offensif

La posture de l’attaque : pour frapper et faire le plus de dégâts possible.

- **Dégâts au maximum**, avec les armes comme avec les sorts : on ne lance pas les dés, on prend leur maximum. 2d6+2 font 14 ; 6d6+4 font 40.
- **Réussite critique à 10 ou moins** au lieu de 5.
- *Inconvénient* : **−10 % pour toucher la cible**. Sur la fiche, ce malus s’applique aux compétences d’attaque : *Arc*, *Arbalète*, *Arme Légère*, *Arme Lourde* et *Magie*.
- *Inconvénient* : **ni parade ni esquive**.

### Défensif

À l’opposé de l’offensive : pour couvrir ses alliés ou tenir face à de nombreux assauts.

- **Plus d’armure** : +2 AP et +2 AM, et 2 de plus tous les 4 niveaux globaux. Soit +2 du niveau 1 au niveau 4, +4 du 5 au 8, +6 du 9 au 12, +8 du 13 au 16 et +10 du 17 au 20.
- **Parades et esquives sans limite** : autant de défenses qu’il y a de coups, mais chacune fait baisser de 10 % la réussite de la suivante. Le Doc « Créer sa fiche de personnage » compte ce malus dès la première défense ; le [[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]] seulement au-delà de deux.
- **Provocation** : en échange d’un bon dialogue et d’un jet réussi de *Diplomatie*, d’*Intimidation* ou de *Manipulation*, un adversaire est obligé de n’attaquer que vous pendant 1 tour. (Le Doc « Guide pour MJ » se contente du dialogue **ou** du jet.)
- **Intervention** : parer ou esquiver un coup à la place d’un allié adjacent. Ce n’est pas possible si vous êtes tous les deux pris dans la même attaque de zone.
- **Réussite critique à 10 ou moins** quand vous parez ou esquivez.
- **Contre une attaque d’opportunité**, seule la posture défensive permet de parer ou d’esquiver.
- *Inconvénient* : **vos dégâts sont divisés par 2**, avec les armes comme avec la magie. La division se fait avant de retirer l’armure de la cible (voir [[guide/les-degats|Les dégâts]]).

### Neutre

L’entre-deux : des dégâts normaux, et de quoi se défendre.

- **+5 % aux jets de Social et de Volonté** : à tout jet qui fait appel à l’une de ces deux caractéristiques.
- *Inconvénient* : **deux parades ou esquives par tour**.

### Focus

La concentration : pour une magie plus efficace.

- **+10 % à la réussite**, quel que soit le jet.
- **Plus de tour de charge** : les sorts de niveau 5 se lancent sans tour de charge (voir [[guide/la-magie-en-jeu|La magie en jeu]]), comme certaines actions. La posture casse aussi le tour de charge de la capacité *Préparation* du Mage Rouge et Vert.
- **Des dés plus forts** pour les dégâts et les soins des sorts : chaque dé monte d’un cran, D4, D6, D8, D10, D12, puis D20, jamais au-delà.
- *Inconvénient* : **ni parade ni esquive**.

### Vigilance

L’attention : pour voir venir, autour de soi comme dans le combat.

- **+5 % aux jets de Perception**.
- **+2 à l’initiative**, au début de chaque tour.
- **Anticiper l’adversaire** : un jet d’*Observation* (ou de *Distinction*, d’après le Doc « Créer sa fiche de personnage ») donne une information utile sur sa prochaine action ; voyez avec le MJ.
- **Repérer un ennemi invisible** : estimer la position d’un ennemi invisible ou discret devient une action rapide (IC).
- **Repérer 1d4 résistance/vulnérabilité**, comme l’écrivent les deux documents : une action rapide (IC) permet de détecter une résistance ou une vulnérabilité de l’ennemi, prise au hasard.
- **Déjouer une embuscade** : un personnage en vigilance qui entre dans la zone d’une embuscade l’annule (voir [[guide/situations-avancees|Les situations avancées]]).
- *Inconvénient* : **une seule parade ou esquive par tour**.

### Symbiose

Une posture étrange : le personnage fusionne avec sa magie et devient presque un élémentaire. Avec deux magies, il en choisit une pour faire équipe et délaisse l’autre le temps de la posture.

- **+5 aux dégâts et aux soins** des sorts de sa magie, et 2 de plus par niveau de puissance magique au-delà du premier : +5 au premier niveau, puis +7, +9, +11, et +13 au cinquième, qu’un personnage à deux magies n’atteint pas.
- **+4 AM**, et 2 de plus par niveau de puissance magique au-delà du premier : +4, puis +6, +8, +10 et +12.
- **Immunité à la magie de la symbiose** : elle vous envahit, et vous y devenez totalement immunisé.
- Le Doc « Guide pour MJ » ajoute **un tour d’effet gratuit** aux effets de vos sorts qui durent plusieurs tours ; le Doc « Créer sa fiche de personnage » ne le dit pas.
- *Inconvénient* : **ni armes ni objets**, sauf la Forgemagie (un sort qui crée des armes faites de magie) ; les bâtons magiques restent permis ; le Doc « Guide pour MJ » permet aussi la « Forge de ses morts » et les parchemins.
- Exception (décision R167) : l’arme élémentaire de la magie de la symbiose reste utilisable et reçoit le bonus de dégâts de la posture ; les autres armes restent interdites (décision R112).
- *Inconvénient* : **une seule parade ou esquive par tour**.
- *Inconvénient* : **une seule magie active** : avec deux magies, l’autre est désactivée le temps de la posture, et tous ses avantages et ses inconvénients avec elle.

## Les boss

Les boss, pensés pour affronter une équipe de quatre joueurs, se défendent davantage : **quatre** parades ou esquives par tour en posture neutre, **trois** en vigilance et en symbiose.

## Le Mode Hyper 100 %

À partir du niveau 10, le Mode Hyper 100 % **active toutes les postures à la fois, sans aucun de leurs inconvénients**, pendant 3 tours (voir [[guide/le-mode-hyper|Le Mode Hyper]]).

## Sur la fiche

Sur la [fiche de personnage](/fiche/), cochez la posture du moment : la fiche recalcule ce qu’elle chiffre, les scores des compétences, l’initiative, l’AP et l’AM, et les dégâts des armes et des sorts.

Le texte d’origine des postures : [[guide/postures|Postures]] (Doc « Guide pour MJ ») et [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).', 'neutre', NULL, 'page', '{"id":"guide/les-postures"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 293, 'guide', 'Les bases', 'La magie en jeu', 'Texte', 'modifie', '## Lancer un sort

Lancer un sort, c’est un jet de D100 dans la compétence *Magie* (certaines classes en utilisent une autre : le mage rouge lance ses sorts avec *Concentration*). Le sort coûte le chakra indiqué sur sa page :

- **réussi** : le coût normal ;
- **raté** : la moitié du coût, arrondie à l’inférieur ;
- **échec critique** : le double du coût, et d’autres ennuis au choix du MJ.

À court de chakra, le personnage peut quand même lancer son sort : il paie ce qui manque avec sa santé, **2 points de santé pour 1 point de chakra**. C’est le tarif de tout chakra dépensé sans l’avoir, quelle qu’en soit la raison. Certains sorts sont des **IC** (*Instant Cast*) : ils ne prennent pas l’action du tour. Les sorts de la nécromancie et de la magie du sang puisent en plus dans la 4ᵉ barre, l’âme ou le sang.

## Les sorts de niveau 5

Les sorts les plus puissants demandent un **tour de charge** : on les charge avec l’action d’un tour et on les lance avec celle du tour suivant, sur un seul jet de magie. Si un ennemi touche le lanceur entre-temps, un jet de *Concentration* est nécessaire pour ne pas perdre la charge. La posture **Focus** retire ce tour de charge.

## Les niveaux de maîtrise (NM)

Un sort se renforce avec ses **niveaux de maîtrise** : à chaque NM (ou à partir d’un certain nombre), son coût baisse, ses dégâts ou sa durée augmentent, il devient IC… La page de chaque sort indique ce que lui apporte chaque NM, par exemple « −5/NM » à côté de son coût.

Un NM s’obtient de trois façons :

- **par niveau** : un NM pour un sort à chaque niveau du personnage, à partir du niveau 2 ;
- **par lecture** d’un livre de sort ;
- **en cadeau du MJ**.

Un sort a au plus **3 NM**, quelle que soit leur origine : un livre n’en donne qu’un par sort, lié à ce sort, et un cadeau du MJ ne dépasse jamais ce plafond.

## Résistances et faiblesses

Les dégâts d’un sort comptent double contre une cible vulnérable à sa magie, et moitié moins contre une cible qui y résiste (voir [Les dégâts](/guide/les-degats/)). La posture **Vigilance** permet de repérer une résistance ou une vulnérabilité d’un ennemi.', 'Tout personnage a au moins une magie, et donc au moins un sort : comment les choisir est expliqué dans [[guide/creer-son-personnage|Créer son personnage]]. Cette page explique comment s’en servir en partie.

## Lire un sort

Les sorts de chaque magie sont sur sa page (voir [les magies](/magies/)), un tableau par niveau de puissance magique (NPM), de 1 à 5. Pour chaque sort, on y lit :

- son **type** : attaque, soin, entrave, amplification, protection, placement, invocation… La même colonne dit aussi si le sort est IC, imparable ou inesquivable ;
- son **coût** en {{chakra|chakra}}, et parfois un **coût secondaire** : des âmes pour la Nécromancie, du Sang pour la magie du Sang, ou autre chose encore, comme une part de la santé ;
- sa **portée**, sa **zone**, ses **dégâts** ou ses **soins** ;
- ses **effets**, qui s’ouvrent sous sa ligne.

Certaines magies ont aussi leurs propres règles, dans la section « Explication » de leur page : l’Arcane, la Corruption et le Potentiel Illimité.

## Lancer un sort

Lancer un sort, c’est un jet de D100 dans la compétence *Magie* (Intelligence) : réussi si le résultat est égal ou inférieur à son score (voir [[guide/reussir-une-action|Réussir une action]]). Les mages rouge, bleu et vert lancent les leurs avec *Concentration* (Volonté).

- **Réussite critique** : un sort d’attaque double ses dégâts, et la cible ne peut l’arrêter que par une réussite critique meilleure ; un sort d’amplification, de soin, d’entrave ou de protection double sa durée ou son effet.
- **Échec critique** : le sort coûte le double, et le MJ peut ajouter d’autres ennuis : le sort profite à l’ennemi, le personnage se trompe de sort, l’attaque se retourne contre lui…

## Ce que coûte un sort

Le coût en {{chakra|chakra}} écrit sur le sort se paie selon le résultat du jet :

| Résultat du jet | Ce qui est dépensé |
| --- | --- |
| Réussite | le coût du sort |
| Échec | la moitié du coût, arrondie à l’inférieur |
| Échec critique | le double du coût |

*Exemple : un sort qui coûte 7 de {{chakra|chakra}} en dépense 7 s’il réussit, 3 s’il rate (la moitié de 7, 3,5, arrondie à 3), et 14 sur un échec critique.*

### À court de chakra

Un personnage qui n’a plus assez de {{chakra|chakra}} peut quand même lancer son sort : il paie ce qui manque avec sa santé, à raison de **2 points de santé pour 1 point de {{chakra|chakra}}**. C’est le tarif de tout {{chakra|chakra}} dépensé sans l’avoir, en Mode Hyper ou non.

*Exemple : il reste 3 de {{chakra|chakra}} au personnage, et son sort en coûte 7. Il dépense ses 3 points, et les 4 qui manquent lui coûtent 8 points de santé.*

En Mode Hyper, les sorts ne coûtent plus de {{chakra|chakra}}, mais le mode lui-même en brûle 10 % du maximum à chaque tour (voir [[guide/le-mode-hyper|Le Mode Hyper]]).

### La quatrième barre

La Nécromancie et la magie du Sang ont une réserve à elles, la **quatrième barre** : les âmes pour la Nécromancie, le Sang pour la magie du Sang. Elle est de 10, se recharge de 1 par tour en combat, et paie le coût en âmes ou en Sang de leurs sorts. Les fioles vertes foncées de l’alchimie en rendent aussi.

### La corruption

Pour la plupart des personnages, la {{corruption|corruption}} est un poison mortel ; pour tous, chaque point prend la place d’un point de {{chakra|chakra}} (voir [[guide/blessures-et-etats|Blessures et états]]).

Les mages de la Corruption s’en servent au contraire comme d’une réserve. À chaque sort, son coût en {{chakra|chakra}} passe dans leur {{corruption|corruption}} : un sort qui coûte 4 leur donne 4 de {{corruption|corruption}}. Ils peuvent ensuite puiser dans cette réserve pour lancer les mêmes sorts avec des effets en plus, en payant le double du coût en {{corruption|corruption}} (8 pour un sort à 4). Les effets marqués « Si {{cr}} » sont ceux d’un sort lancé ainsi, en utilisant la {{corruption|corruption}}. Ailleurs, dans les dégâts, soins ou {{barriere|barrière}} d’un sort (D/S/B) ou dans ses effets, « N {{cr}} » fait monter la {{corruption|corruption}} de la cible, sauf le sort de soin Retrait, qui en retire ; dans un coût, c’est la {{corruption|corruption}} à dépenser. L’inverse ne marche pas : la {{corruption|corruption}} ne redonne jamais de {{chakra|chakra}}. Et, comme pour tous, chaque point de {{corruption|corruption}} empêche de récupérer un point de {{chakra|chakra}} : c’est en gros la même réserve, remplie avec autre chose ; seule la mort au maximum leur est épargnée, s’ils ont la Corruption en magie innée ou acquise. Le Potentiel Illimité, même s’il peut s’en servir, peut en mourir s’il en cumule trop.

## Les sorts IC

Un sort **IC** (*Instant Cast*) ne consomme pas le tour du joueur, sauf sur un échec critique : c’est une action rapide (voir [[guide/le-tour-de-jeu|Le tour de jeu]]). Beaucoup de sorts le deviennent à 3 NM : leur type porte alors la mention « IC pour 3 NM ».

## Les sorts de niveau 5

Les sorts du cinquième niveau de puissance sont si puissants qu’ils demandent un **tour de charge** :

1. Au premier tour, l’action sert à charger le sort ; c’est là qu’on fait le jet pour le lancer, le seul du sort.
2. Au tour suivant, l’action sert à le lancer. Entre-temps, le lanceur peut se défendre si sa posture le permet, se déplacer et même changer de posture avant de lancer son sort ; mais il doit le lancer : s’il n’est pas interrompu, pas d’action rapide ce tour-là.
3. Si un ennemi le touche pendant la charge, il fait un jet de *Concentration* pour la garder. S’il la perd, il garde l’action de son prochain tour, mais la moitié du coût en {{chakra|chakra}} est perdue.

La posture **Focus** supprime ce tour de charge (voir [[guide/les-postures|Les postures]]). Un sort de niveau 5 ne peut pas servir d’attaque d’opportunité, et un personnage qui a deux magies n’a pas accès aux sorts de niveau 5.

## Les niveaux de maîtrise (NM)

Un sort se renforce avec ses **niveaux de maîtrise**, de 0 à 3. Ce que chaque NM lui apporte est écrit sur le sort lui-même, à côté de la valeur qu’il change, dans le tableau de sa magie :

- « (-5/NM) » à côté du coût : le coût baisse de 5 à chaque NM ;
- « (+1d6/NM) » à côté des dégâts : un dé de plus à chaque NM ;
- « 3 NM = … », « IC pour 3 NM » : un effet qui ne vient qu’à 3 NM.

*Exemple : la Boule de feu, un sort de feu du premier niveau, coûte 4 de {{chakra|chakra}} et fait 2d6 dégâts (+1d6/NM) : 3d6 à 1 NM, 4d6 à 2 NM, 5d6 à 3 NM. À 3 NM, elle gagne aussi un effet : sur un coup critique, la cible doit réussir un jet de Vigueur pour ne pas prendre Brûlure 1.*

### Gagner des NM

Un NM s’obtient de trois façons :

- **par niveau** : à chaque niveau, à partir du niveau 2, le personnage gagne un NM à placer sur le sort de son choix, et il peut le réaffecter librement ;
- **par la lecture d’un livre de sort** : le livre donne un NM à un sort précis, qui lui reste lié ; si le personnage retire ce sort de sa liste, le NM attend qu’il le reprenne. Lire le livre demande un jet par niveau de puissance du sort, un par jour au plus (voir [[ressources/livre-parchemin|Livres et parchemins]]) ;
- **en cadeau du MJ**.

Un sort a au plus **3 NM**, quelle que soit leur origine :

- les NM gagnés par niveau ne dépassent jamais le niveau global moins 1 sur un même sort (1 au niveau 2, 2 au niveau 3) ;
- un livre ne donne qu’un NM par sort ;
- un cadeau du MJ ne fait jamais dépasser les 3 NM.

Sur la [fiche de personnage](/fiche/), le livre lu se note dans l’entraînement, et le tableau des sorts compte les NM de chaque origine.

## Ce qui aide votre magie

- **Les postures** : le Focus donne +10 % à la réussite et des dés plus forts, la symbiose un bonus aux dégâts et aux soins de sa magie, l’offensive des dégâts au maximum (voir [[guide/les-postures|Les postures]]).
- **Les bâtons magiques** : portés à la ceinture ou dans un emplacement d’arme, ils donnent des bonus passifs aux sorts, quelle que soit la magie de leur porteur. Deux bâtons qui amplifient la même chose ne se cumulent pas, même de niveaux ou de gemmes différents. Ils sont dans l’onglet [Bâtons magiques](/ressources/equipement/#batons-magiques) de l’équipement.
- **Les parchemins** : un parchemin porte un sort, que l’on peut lancer si l’on a la bonne magie et la bonne puissance magique. Il coûte le {{chakra|chakra}} du sort, et ne sert qu’une fois.
- **Les dons, les accessoires et l’armure élémentaire** : la fiche de personnage recalcule pour vous le coût, la portée et les dégâts ou les soins de chaque sort, avec tout ce qui les change, posture comprise.
- **Le Mode Hyper** : plus de dégâts et de soins, et des effets propres à chaque magie (voir [[guide/le-mode-hyper|Le Mode Hyper]]).

## Résistances et faiblesses

Chaque magie résiste à certaines magies et craint certaines autres, et la plupart sont liées à une altération d’état : leur page le dit. Contre une cible vulnérable à sa magie, un sort fait deux fois plus de dégâts ; contre une cible qui y résiste, deux fois moins (le détail des paliers est dans [[guide/les-degats|Les dégâts]]). La posture **Vigilance** permet de repérer une résistance ou une vulnérabilité d’un ennemi, prise au hasard.

## Les créatures invoquées

Certains sorts invoquent des créatures : les morts de l’Animation de mort (Nécromancie), les golems de l’Appel aux Golems (Terre), les marionnettes de la Marionnette de l’ombre (Ombre). Leurs cartes sont dans l’onglet des créatures invoquées du [bestiaire](/bestiaire/). Elles n’ont pas d’échelle de puissance (EP) comme les monstres : celles qui ont un rang l’ont en niveau de puissance magique, de NPM 1 à NPM 5.

Pour aller plus loin : [[guide/situations-avancees|Les situations avancées]] (« Rater ses sortilèges ») et [[guide/la-montee-de-niveau|La montée de niveau]].', 'neutre', NULL, 'page', '{"id":"guide/la-magie-en-jeu"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 294, 'guide', 'Les bases', 'Blessures et états', 'Texte', 'modifie', '## Le coma et les jets de survie

Quand sa santé tombe à 0 ou moins, le personnage est **dans le coma**. Il doit faire des **jets de survie** (compétence *Survie*) : un seul jet réussi suffit à le stabiliser ; trois jets ratés, et il meurt. Un échec critique peut être fatal. Certains MJ font eux-mêmes ces jets, pour garder la main sur le destin des personnages.

## Les altérations d’état

Poison, brûlure, peur, fatigue… Une **altération d’état** change la condition du personnage et lui inflige des malus : mieux vaut s’en débarrasser vite. Beaucoup agissent au **début du tour**, avant que le personnage n’agisse. Certaines compétences aident à y résister : *Vigueur* contre les maux du corps (poison, maladie, brûlure), *Fermeté* contre les attaques de l’esprit.

Presque chaque magie est liée à une altération d’état, et beaucoup de sorts en provoquent. La liste complète, avec les effets de chaque stade, est dans [[Liste des altérations d''état]].

## Récupérer

- Le **don de base** de la race, *Méditation* ou *Repos*, se prend comme action, plusieurs fois par jour : la méditation rend du chakra, le repos de la santé et du chakra. Au niveau 10, ils deviennent plus efficaces (6d6 + 12 de chakra pour la méditation, 6d4 + 12 de santé et de chakra pour le repos).
- Les **potions** et remèdes de l’[alchimie](/ressources/alchimie/) soignent, rendent du chakra ou guérissent une altération.
- Certains **sorts** soignent ou protègent, notamment ceux de la lumière et de l’eau.

Attention : la **corruption** empêche de remonter son chakra au maximum, et le **Mode Hyper** interdit de récupérer du chakra tant qu’il dure.', 'Un personnage peut perdre sa santé, sa {{barriere|barrière}} et son {{chakra|chakra}}, tomber dans le coma, ou subir une altération d’état qui le gêne pendant plusieurs tours. Voici ce qui lui arrive alors, et comment s’en remettre.

## Le coma et les jets de survie

Quand la santé d’un personnage tombe à 0 ou moins, il est **dans le coma** : il est inconscient et doit faire des **jets de survie**, avec la compétence *Survie* (Volonté).

- **Un seul jet réussi** suffit à le stabiliser.
- **Trois jets ratés**, et il meurt. Un échec critique peut lui aussi être fatal.
- Si sa santé est descendue jusqu’à son **négatif maximal** (l’opposé de sa santé maximum : −30 pour 30 de santé), il n’a droit qu’à **un seul jet** de survie : raté, il meurt.
- À **deux fois ce négatif maximal**, il meurt sur le coup.

Le MJ peut laisser les joueurs lancer eux-mêmes leurs jets de survie, ou les faire à leur place.

Pour tirer un personnage du coma, l’alchimie a ses **fioles beiges** : la petite stabilise la cible, la moyenne la sort du coma, remonte sa santé à 0 et lui rend 1d8 de santé, les plus grosses davantage. La plus puissante, l’ultime fiole beige, ressuscite même une cible morte depuis une semaine au plus. La compétence *Médecine*, enfin, sert à tous les soins physiques que la magie ne peut pas faire.

## Les altérations d’état

Une **altération d’état** change la condition d’un personnage : poison, brûlure, peur, paralysie… Elle lui inflige des malus, et il a tout intérêt à s’en débarrasser vite.

- Ce qui frappe **au début du tour** (le poison, la brûlure…) se subit avant de faire quoi que ce soit (voir [[guide/le-tour-de-jeu|Le tour de jeu]]).
- Il en existe vingt, **physiques** ou **mentales**. La plupart ont **trois stades**, de plus en plus forts : le poison, par exemple, inflige 10 % de la santé maximum au stade 1, 15 % au stade 2 et 20 % au stade 3, et dure 3 tours. Les autres (Agrippé, Couardise, Enchevêtré, Étourdi, Folie de Guerre, Sans Défense) ont un seul effet, quel que soit le stade.
- Chaque magie, sauf le Potentiel Illimité, est **liée à une altération** : Aveuglement (Lumière), Brûlure (Feu), Confusion (Eau), Enragé (Vide), Fatigue (Espace/Temps), Gel (Glace), Paralysie (Foudre), Peur (Ombre), Pétrifié (Terre), Poison (Nécromancie), Saignement (Sang), Surcharge Magique (Arcane et Corruption), Surdité (Vent). Beaucoup de sorts infligent des altérations.
- **Résister** : la compétence *Vigueur* (Volonté) aide contre les altérations physiques, comme le poison, les maladies ou les brûlures ; la compétence *Fermeté* (Volonté) contre les attaques de l’esprit. Certaines altérations disent quel jet leur échappe ou y met fin : un jet de *Vigueur* pour ne pas perdre son tour à la paralysie, de *Fermeté* pour sortir de la rage d’Enragé, de *Calme* pour chasser la peur.
- **Résistances et vulnérabilités** : être résistant ou vulnérable à une altération en change l’effet. La résistance au poison divise ses dégâts par 2, la sensibilité les double ; la vulnérabilité au gel le fait durer un tour de plus.
- Certaines altérations mettent des **croix** sous des caractéristiques : la fatigue au stade 2 en met une en Force et une en Agilité, le saignement au stade 3 une en Volonté. Une croix retire 20 % à tous les jets de la caractéristique, deux la rendent inutilisable (voir [[guide/reussir-une-action|Réussir une action]]).

Le détail de chaque altération, stade par stade, est dans [[guide/liste-des-alterations-d-etat|la liste des altérations d’état]] ; sur la page d’une magie, le nom d’une altération montre ses effets au survol.

## Les maladies

Les maladies (le botulisme bleu, la fièvre des marais, le tétanos…) se contractent et se soignent chacune à leur façon : la page [[ressources/maladie|Maladie]] donne leurs effets, comment on les attrape, leur temps d’incubation, leur soin et sa durée. Une maladie, comme une mauvaise nuit, peut aussi valoir une croix sous une caractéristique.

## La corruption

La {{corruption|corruption}} est un poison pour le lobe de chakra, un organe situé dans le cerveau. Son maximum est celui du {{chakra|chakra}}, et elle augmente avec lui.

- Chaque point de {{corruption|corruption}} **prend la place d’un point de {{chakra|chakra}}** : avec 25 de {{chakra|chakra}} maximum et 2 points de {{corruption|corruption}}, le personnage ne remonte pas au-delà de 23 sur 25.
- Si la {{corruption|corruption}} atteint son maximum, le personnage a **deux semaines** dans le jeu pour en retirer au moins un point. Sinon, il meurt et se transforme en abomination.
- Les **fioles noires** de l’alchimie soignent la {{corruption|corruption}} (aux mages de la Corruption, elles en donnent).
- Le repos et la méditation n’ont aucun effet sur la {{corruption|corruption}}.
- Seuls ceux qui ont la Corruption en magie innée ou acquise ne risquent pas cette mort : pour eux, c’est une réserve qu’ils remplissent en lançant leurs sorts (voir [[guide/la-magie-en-jeu|La magie en jeu]]). Mais elle prend aussi la place de leur {{chakra|chakra}} : c’est en gros la même réserve, remplie avec autre chose.
- Le Potentiel Illimité, même s’il peut s’en servir, peut en mourir s’il en cumule trop.

## Récupérer

### Le don de base : Méditation ou Repos

Chaque race a un **don de base**, Méditation ou Repos (sa page le dit : voir [les races](/races/)). C’est une **action**, possible **trois fois par jour** ; sous le stress, elle demande un jet de *Calme*.

- **Méditation** : récupère 3d6 + 6 de {{chakra|chakra}}.
- **Repos** : récupère 2d4 + 4 de santé et de {{chakra|chakra}}.

Au niveau 10, ils deviennent plus forts : la Méditation rend 6d6 + 12 de {{chakra|chakra}}, le Repos 6d4 + 12 de santé et de {{chakra|chakra}}.

### Les potions

L’[[ressources/alchimie|alchimie]] fabrique de quoi se remettre sur pied, de la petite fiole, la plus simple, à l’ultime, la plus puissante :

- les **fioles** : rouge pour la santé, bleue pour le {{chakra|chakra}}, jaune pour la {{barriere|barrière}}, mauve, orange ou verte pour deux à la fois, multicolore pour tout ; bordeaux et blanche régénèrent la santé ou le {{chakra|chakra}} à chaque tour pendant 3 tours (l’ultime en augmente plutôt le maximum, une fois par personnage) ;
- les **remèdes**, un pour chacune des treize altérations liées à une magie : le mineur la réduit d’un cran, le majeur de deux, le parfait la soigne entièrement ; les **panacées** font de même, sur les altérations d’état en général ;
- l’**alchimie primitive** : elle rend de la santé, du {{chakra|chakra}} ou de la {{barriere|barrière}}, mais laisse une croix sous une caractéristique pendant 2 tours.

En combat, boire prend toute l’action ; une fiole rangée à la ceinture se boit en une action rapide (IC). Toutes les potions sont dans l’onglet [Consommables](/ressources/equipement/#ceinture-consommables) de la ceinture, avec leur prix.

### Les sorts

Beaucoup de magies ont des sorts de soin, la Lumière et l’Eau surtout. Chaque page de magie les donne.

### Attention au Mode Hyper

Pendant le Mode Hyper, le {{chakra|chakra}} ne se régénère pas : impossible de boire une fiole bleue (ou ce qui rendrait du {{chakra|chakra}}), de méditer ou de se reposer. Et le garder au-delà de ses limites se paie : une fois le mode relâché, après quatre tours de trop, le personnage tombe dans le coma, sa santé entièrement perdue (voir [[guide/le-mode-hyper|Le Mode Hyper]]).', 'neutre', NULL, 'page', '{"id":"guide/blessures-et-etats"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 295, 'guide', 'Les bases', 'La montée de niveau', 'Texte', 'modifie', 'Au fil des aventures, le personnage gagne de l’**expérience** (XP). Son **niveau global**, de 1 à 20, dépend de l’expérience accumulée : il fixe le niveau de ses classes et sa puissance magique.

## Le tableau de progression

Chaque ligne donne l’expérience nécessaire pour atteindre le niveau, et ce qu’il apporte.

<!-- guide:niveaux -->

## À retenir

- **Compétences** : 100 points à la création, puis 20 par niveau et 40 aux niveaux 5, 10, 15 et 20. Le maximum naturel d’une compétence passe de 20 à 30 au niveau 5, puis à 40 au niveau 10.
- **Caractéristiques** : un point de plus à répartir aux niveaux 5, 10 et 15.
- **Attributs** : 15 points à répartir entre la santé et le chakra à chaque niveau à partir du 2, et un dé d’attributs bonus aux niveaux 5, 10, 15 et 20.
- **Classes** : 2 niveaux de classe par niveau global, sur une seule classe ou sur les deux (voir [le biclassage](/guide/choisir-sa-classe/#une-ou-deux-classes--le-biclassage)).
- **Magie** : un niveau de maîtrise pour un sort à chaque niveau à partir du 2 ; la puissance magique passe à 2, 3, 4 et 5 aux niveaux 4, 8, 12 et 16 (le niveau 5 n’est pas accessible avec une magie acquise).
- **Mode Hyper** : débloqué au niveau 2, à 100 % au niveau 10 (voir [[Liste des effets mode hyper]]).', 'Au fil de ses aventures, le personnage accumule de l’**expérience** (XP). Son total d’expérience fixe son **niveau global**, de 1 à 20 : dès qu’il atteint l’expérience demandée pour un niveau, il y passe. Le niveau global règle à son tour le niveau de ses classes et sa puissance magique, et dit ce que le personnage a à répartir.

Sur la [fiche de personnage](/fiche/) du site, il suffit de noter l’expérience : le niveau suit, et la jauge d’XP montre le chemin parcouru jusqu’au niveau suivant.

## Le tableau de progression

Chaque ligne donne l’expérience nécessaire pour atteindre le niveau, et tout ce que ce niveau apporte.

<!-- guide:niveaux -->

## Ce que chaque niveau apporte

Le tableau donne les chiffres, niveau par niveau ; voici ce qu’ils veulent dire et comment s’en servir.

### Des points de compétences

Chaque niveau apporte de nouveaux points de compétences (colonne « Points de compétences »), qui s’ajoutent à ceux de la création. Ils vont dans la case **Nat.** (naturel) des compétences, et se répartissent exactement : aucun ne se garde pour plus tard.

Une compétence ne reçoit pas plus de **20 points naturels**. Ce **maximum naturel** augmente aux niveaux où la colonne « Et aussi » l’indique.

### Un point de caractéristique de plus

Aux niveaux où la colonne « Et aussi » indique une caractéristique à répartir, le personnage gagne un point de caractéristique de plus, à répartir dans les limites habituelles des caractéristiques (voir l’étape 4 de [[guide/creer-son-personnage|Créer son personnage]]). Le total de ses caractéristiques, 14 à la création, augmente d’autant ; le point offert par la magie innée n’y est pas compté. Comme à la création, ce total doit tomber juste.

### De la santé et du chakra

Chaque nouveau niveau donne des **points d’attributs** (colonne « Points d’attributs »), à répartir comme vous le voulez entre la **santé** et le **{{chakra|chakra}}**. À certains niveaux s’y ajoute un **dé d’attributs bonus**, que la colonne « Et aussi » décrit.

Sur la fiche du site, ces gains se notent en **deux totaux** : la santé gagnée et le {{chakra|chakra}} gagné depuis le niveau 1. À côté, la fiche rappelle le **total à saisir** : la somme des points d’attributs des niveaux atteints, et, dès qu’un dé bonus a été atteint, la plage de ce que les dés peuvent donner en plus. Un total qui n’y correspond pas est signalé.

### Des niveaux de classe

Chaque classe a son propre niveau, qui suit le niveau global. Tout dépend du choix fait à la création (section « Une ou deux classes : le biclassage » de [[guide/creer-son-personnage|Créer son personnage]]) :

- **Une seule classe** : elle commence au niveau 2 et gagne **2 niveaux** à chaque niveau global. Elle atteint donc le niveau 20 au niveau global 10 et s’y arrête. Au niveau global 11, le personnage prend automatiquement une **seconde classe**, qui reçoit la suite : elle commence au niveau 2 et gagne à son tour 2 niveaux à chaque niveau global.
- **Deux classes** : elles commencent chacune au niveau 1, et gagnent chacune **1 niveau** à chaque niveau global.

Au niveau global 20, tout personnage a donc deux classes au niveau 20 : seul le chemin pour y arriver change.

Les dons d’une classe se gagnent aux niveaux **1, 5, 10, 15 et 20 de cette classe** (certains sont à choisir), et sa **spécialité**, l’embranchement de la classe, se choisit quand elle atteint le **niveau 10**. Chaque page de [classe](/classes/) dit lesquels.

*Exemple : un personnage d’une seule classe est au niveau de classe 10 dès son niveau global 5 : il y choisit sa spécialité. Avec deux classes, il faut attendre le niveau global 10 pour que chacune y arrive.*

### Des progrès en magie

- **Des niveaux de maîtrise (NM)**, aux niveaux qu’indique la colonne « Niveau de maîtrise d’un sort » : chacun se place sur l’un de ses sorts pour le renforcer (ce qu’apporte un NM est écrit sur chaque sort). Un sort n’a jamais plus de **3 NM**, quelle que soit leur origine : les livres de sort et le MJ peuvent aussi en donner (voir [[guide/la-magie-en-jeu|La magie en jeu]]).
- **La puissance magique**, qui augmente aux niveaux qu’indique la colonne « Et aussi ». Elle dit jusqu’à quel niveau de sort (NPM) le personnage peut lancer, et elle multiplie ses emplacements de sorts : chaque condition remplie (avoir une magie innée, une magie acquise, une classe magique, une seconde classe magique) donne autant d’emplacements que la puissance magique.
- **Avec une magie acquise**, les sorts de NPM 5 restent fermés ; les emplacements de ce palier, eux, s’ouvrent quand même.

*Exemple : avec une magie innée et une classe magique, deux conditions sont remplies : le personnage a deux fois autant d’emplacements de sorts que sa puissance magique, soit 6 emplacements à la puissance magique 3. Il n’y a jamais d’emplacement en plus.*

### Le Mode Hyper, la Méditation et le Repos

La colonne « Et aussi » dit encore quand s’ouvrent le **Mode Hyper** et le **Mode Hyper 100 %** (voir [[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]]), et quand le don de base, **Méditation** ou **Repos**, rend davantage, avec ses dés.

## Pour aller plus loin

- Gagner des points d’acquis sans attendre le niveau suivant : [[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]].
- Le tableau tel que l’écrit le document des règles : [[guide/fiche-experience-niveau-global|Fiche de personnage : Expérience/Niveau global]].', 'neutre', NULL, 'page', '{"id":"guide/la-montee-de-niveau"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 296, 'guide', 'Les bases', 'S’entraîner et exercer un métier', 'Texte', 'modifie', 'Les niveaux ne sont pas la seule façon de progresser : un personnage peut aussi s’entraîner, et exercer un métier.

## S’entraîner

Un entraînement se donne auprès d’un entraîneur, dans une ville ou un village, contre une coquette somme d’or ; un PNJ important peut aussi en offrir un, si le MJ le décide. On lance un D100, et le résultat donne des points d’**acquis** dans la compétence travaillée :

<!-- guide:entrainement -->

L’entraînement a ses limites : il ne peut améliorer que **15 compétences** au plus, et de **10 %** au plus chacune. Les bonus se notent dans la case **Entraînement** des dons.

Un personnage qui enchaîne les échecs dans une compétence peut aussi se voir offrir un jet d’entraînement par le MJ : c’est dans l’échec qu’on apprend.

## Exercer un métier

Un métier se choisit à la création du personnage ou plus tard, au fil de l’aventure ; il se note dans la case **Métier** des dons. Selon le métier, il peut apporter :

- un **avantage** sur un jet de compétence, quand le métier s’applique (un mineur s’oriente mieux dans une grotte) ;
- des **points d’acquis** : 6 % en tout, pas plus de 3 % dans une même compétence (jusqu’à 9 % si le métier ne donne rien d’autre) ;
- des **objets** en plus dans l’inventaire, voire une arme ;
- parfois un bonus d’**attribut** ;
- l’**artisanat** : seul le bon métier permet de fabriquer un objet. La réussite dépend de deux caractéristiques réunies.

Les bonus d’un métier évitent autant que possible le combat. Tous les métiers sont dans le [tableau des métiers](/metiers/), et leurs règles dans [[Règles des métiers]].', 'Les niveaux ne sont pas la seule façon de progresser. Entre deux niveaux, un personnage peut **s’entraîner** pour améliorer une compétence ; et son **métier** lui donne, tout au long de l’aventure, un savoir-faire que les autres n’ont pas.

## S’entraîner

### Trouver un entraîneur

Les entraînements se donnent surtout auprès d’**entraîneurs**, dans les villes et les villages, contre une coquette somme d’or dont le MJ fixe le montant. Un **PNJ important** peut aussi entraîner le personnage, si le MJ le décide.

C’est aussi dans l’échec qu’on apprend : à un joueur qui accumule les échecs et les échecs critiques dans une compétence, le MJ peut accorder un jet d’entraînement pour elle.

### Le jet d’entraînement

Un entraînement porte sur une compétence. On lance un D100 : plus le résultat est bas, plus la compétence progresse, et ce qu’elle gagne s’ajoute à ses points d’**acquis**. Un résultat trop haut, et l’entraînement est raté.

<!-- guide:entrainement -->

### Ses limites

L’entraînement a ses limites : il ne fait progresser que **15 compétences** au plus, et chacune de **10 %** au plus. Ses gains se notent dans la case **Entraînement** des dons, compétence par compétence.

*Exemple : un personnage a déjà gagné 8 % d’acquis en Esquive en s’entraînant. L’entraînement ne peut plus lui apporter que 2 % dans cette compétence.*

Comme tout l’acquis, ces points comptent dans le score de la compétence (voir [[guide/reussir-une-action|Réussir une action]]). Et l’acquis entier (entraînement, dons, armure, métier et accessoires réunis) ne dépasse pas **5 par point de la caractéristique**, le +1 de la magie innée compris, sauf don qui relève ce maximum.

### L’entraînement sur la fiche du site

Sur la [fiche de personnage](/fiche/) du site, chaque entraînement est une ligne du bloc « Entraînement », parmi les dons : une compétence et ses points, de 0 à 10. La fiche les ajoute d’elle-même à l’acquis de la compétence, et signale, sans rien bloquer, ce qui dépasse les limites. Le même bloc garde aussi :

- les **livres de sort** lus : chacun donne un niveau de maîtrise (NM) au sort qu’il enseigne, un seul par sort (voir [[guide/la-magie-en-jeu|La magie en jeu]]) ;
- en texte libre, les **dons évènementiels** et ce que le MJ accorde.

## Exercer un métier

Un métier se choisit à la création du personnage, ou plus tard, au cours d’une aventure. Il se note dans la case **Métier** des dons. Tous les métiers sont dans le [tableau des métiers](/metiers/) : ce que chacun donne, ce qu’il permet de fabriquer, son équipement de départ et, sous sa ligne, sa description.

### Ce qu’apporte un métier

Selon le métier :

- **un avantage sur un jet**, quand le métier s’applique à la situation. *Exemple : en explorant une caverne, un mineur fait son jet d’Orientation avec un avantage.*
- **des points d’acquis** dans une ou plusieurs compétences : l’astronome gagne +3 % en Orientation et +3 % en Observation. Quand le métier laisse le choix (le forgeron : +3 % en *Arme Lourde* ou en *Arme Légère*), on choisit la compétence sur sa fiche.
- **un bonus d’attribut** : à l’initiative, à la vitesse au sol pour le sprint ou à la vitesse de nage.
- **des objets de départ**, ajoutés à l’inventaire à la création du personnage : un kit de réparation d’arme et un maillet en fer pour le forgeron, une longue-vue pour l’astronome. Quand le métier propose un objet ou un autre, on en choisit un.
- **l’artisanat**, pour certains métiers seulement (voir plus bas).

Le bonus d’acquis d’un métier compte, comme tout l’acquis, dans le maximum d’acquis de la compétence (voir « Ses limites », plus haut). Le maximum l’emporte, et ce n’est pas une erreur : un libraire (+6 % en Connaissance) qui n’a que 1 en Intelligence, magie innée comprise, n’en garde que 5.

### L’artisanat

Fabriquer un objet demande le bon métier. Les colonnes « Artisanat » et « Caractéristiques » du [tableau des métiers](/metiers/) disent ce que chaque métier fabrique, et avec quelles **deux caractéristiques**.

La réussite dépend de ces deux caractéristiques réunies : la **compétence d’artisanat** vaut **10 × la première + 10 × la seconde**, le +1 de la magie innée compris.

*Exemples : un sculpteur (Force + Intelligence) qui a 3 en Force et 2 en Intelligence a 3 × 10 + 2 × 10 = 50 %. Un joaillier (Perception + Intelligence) qui a 5 en Intelligence et 4 en Perception a 5 × 10 + 4 × 10 = 90 %.*

Chaque caractéristique d’artisanat qui porte une croix lui retire 20 % ; deux croix sur l’une d’elles la rendent inutilisable (voir les croix dans [[guide/reussir-une-action|Réussir une action]]). Les matériaux et ce qu’on en tire : [Artisanat](/regles/artisanat/) et [Composants](/ressources/composants/).

### Le métier sur la fiche du site

Sur la fiche du site, choisir un métier fait tout cela d’un coup : ses bonus d’acquis s’ajoutent aux compétences (un « +N » à côté), ses bonus d’attribut à l’initiative ou aux vitesses, ses objets entrent dans l’inventaire, et la compétence d’artisanat s’affiche, déjà calculée. Ce qui reste à choisir, une compétence ou un objet, se choisit sous le métier.

### Les repères du document des métiers

Le document des métiers accompagne ses métiers de repères sur leurs bonus, que le joueur et le MJ peuvent garder en tête s’ils en discutent :

- des bonus d’acquis cohérents avec le métier : **6 %** à répartir en tout, pas plus de **3 %** dans une même compétence, et jusqu’à **9 %** si le métier ne donne rien d’autre ;
- le moins possible d’avantages en combat ;
- de l’équilibre : ni trop de bonus, ni trop peu, d’autant qu’ils ne servent pas tout le temps.

Et, quoi qu’il arrive, le MJ a toujours raison. Les règles complètes : [[Règles des métiers]].', 'neutre', NULL, 'page', '{"id":"guide/s-entrainer-et-exercer-un-metier"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 297, 'guide', 'Les bases', 'Aide-mémoire', 'Texte', 'modifie', '## Réussir une action

- On lance un **D100** : il faut faire **son score ou moins**.
- **Score** = 10 × la caractéristique + les points naturels + les points acquis.
- **1 à 5** : réussite critique. **96 à 100** : échec critique.

## Le tour de combat

1. Initiative : 1D20 + le bonus d’Agilité, relancée à chaque tour.
2. Les effets de début de tour (poison, brûlure…).
3. La posture.
4. Le déplacement (on peut en garder pour après l’action).
5. Jusqu’à 3 actions rapides (IC), jamais deux fois la même, toujours avant l’action.
6. L’action : attaque, sort, objet, sprint ou quatrième IC.
7. La fin du déplacement, puis le tour suivant.

## Se défendre

- Jet réussi **et** égal ou meilleur que l’attaquant : coup bloqué.
- Jet réussi mais moins bon : **dégâts ÷ 2** (le bouclier compte).
- Jet raté : dégâts normaux.

## Les dégâts

> [ ( dégâts × 2 si critique − armure ) ÷ 2 si défense partielle ÷ 2 si un don divise ] × 2 si faiblesse, ÷ 2 si résistance — arrondi à l’inférieur.

## La magie

- Sort réussi : son coût ; raté : la moitié ; échec critique : le double.
- Plus assez de chakra, quelle qu’en soit la raison : 2 points de santé par point de chakra manquant.
- Mode Hyper : les sorts ne coûtent plus de chakra, mais le mode en brûle 10 % du maximum par tour.
- Emplacements de sorts = conditions remplies (magie innée, magie acquise, classe magique, seconde classe magique) × puissance magique.

## Les attributs à la création

- Santé = race + classe(s) + magies.
- Chakra = race + classe(s) + magies.
- Barrière = chakra ÷ 2 (arrondi à l’inférieur) + bonus de race et de classe.
- Chaque classe magique : +4 AM.

## Le coma

À 0 de santé ou moins : jets de survie. Un réussi stabilise ; trois ratés, la mort.', 'Les règles des [bases](/regles/), réduites à l’essentiel, pour les retrouver d’un coup d’œil pendant une partie. Chaque rubrique renvoie à la page qui l’explique ; les tableaux chiffrés (les postures, l’initiative, les niveaux) restent sur leur page.

## Réussir une action

- On lance un **D100** : un résultat **égal ou inférieur au score**, c’est réussi.
- **Score** = 10 × la caractéristique + les points naturels + les points acquis.
- **1 à 5** : réussite critique. **96 à 100** : échec critique.
- Les points acquis ne dépassent pas **5 par point de la caractéristique**, le +1 de la magie innée compris, sauf don qui relève ce plafond.
- **Une croix** sous une caractéristique : −20 % à tous ses jets. **Deux croix** : ni elle ni ses compétences ne sont plus utilisables.

Le détail : [[guide/reussir-une-action|Réussir une action]].

## Le tour de combat

1. **L’initiative** : 1D20 + le bonus d’initiative que donne l’Agilité, relancée à chaque tour ; on joue du plus haut résultat au plus bas.
2. **Les effets du début du tour** : poison, brûlure…
3. **La posture**, déclarée avant tout le reste.
4. **Le déplacement** : tout, une partie ou rien ; on peut en garder pour après l’action.
5. **Les actions rapides (IC)** : trois au plus, jamais deux fois la même, toujours avant l’action.
6. **L’action** : attaquer, lancer un sort, utiliser un objet, sprinter, utiliser un don de type *Action*, ou faire une quatrième action rapide.
7. **La fin du déplacement**, puis on passe au suivant.

- **Compter les cases** : une case vaut 1 ; la première diagonale du tour vaut 1, les suivantes 2. Pour la portée d’une arme, chaque diagonale vaut 2.
- **Sprinter** double la distance parcourue, mais c’est l’action du tour : pas d’attaque après.
- **À la place du déplacement** : recharger, changer d’arme ou dégainer, entrer dans une zone ou en sortir, se relever.
- **Les objets** : boire prend l’action (une action rapide si la fiole est à la ceinture) ; allumer quelque chose ou soigner, l’action (deux actions rapides si le nécessaire est à la ceinture) ; sortir un objet du sac, l’action ; mettre des objets à la ceinture, l’action et une action rapide.
- **Hors de son tour** : se défendre autant que sa posture le permet, jouer un don de type *Réaction*, saisir une attaque d’opportunité.

Le détail : [[guide/le-tour-de-jeu|Le tour de jeu]] ; pour le MJ, [[guide/en-resume-deroulement-d-un-tour|le résumé du tour]] du [[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]].

## Attaquer

- Un D100 dans la compétence de l’arme (*Arme Légère*, *Arme Lourde*, *Arc* ou *Arbalète*), ou en *Magie* pour un sort (en *Concentration* pour les mages rouge, bleu et vert).
- **Réussite critique** : les dégâts de base sont doublés, et la cible ne bloque le coup que par une réussite critique meilleure.
- **Échec critique** : la cible peut riposter par une attaque d’opportunité, ou désarmer l’attaquant.
- **Une arme de mêlée dans chaque main** : −20 % pour la main directrice, −40 % pour la main secondaire ; ce malus est divisé par deux pour la main qui tient une dague, et par deux pour un Bimane, les deux se cumulant.
- **Viser la tête, un bras ou une jambe** : un malus pour toucher et un effet en plus, propres à la zone (voir le tableau « Localisation des dégâts » de [[guide/attaque-et-defense|Attaque et Défense]]).
- **La prise en tenaille** (des alliés sur des cases opposées) : +4 aux dégâts à deux, +4 encore à trois ; à quatre, en plus, +5 % de réussite critique pour les alliés et −10 % au jet de défense de la cible.
- **L’attaque discrète** : un dé de dégâts en plus.
- **L’attaque d’opportunité** : une par tour et par joueur (sauf don qui en permet plus), et seulement une action simple (une arme déjà dégainée et à portée, ou un sort d’attaque) ; sa victime ne peut parer ou esquiver qu’en posture défensive.

Les situations particulières : [[guide/situations-avancees|Les situations avancées]].

## Se défendre

Une **parade** (*Parade*, Force) ou une **esquive** (*Esquive*, Agilité), si la posture le permet et qu’il reste des défenses pour le tour :

| Résultat de la défense | Ce qui se passe |
| --- | --- |
| Réussie, et égale ou meilleure que l’attaque | Le coup est bloqué. |
| Réussie, mais moins bonne que l’attaque | **Défense partielle** : les dégâts sont divisés par 2 ; si c’est une parade au bouclier, ses AP et son AM comptent : c’est le seul cas où ils comptent. |
| Ratée | Les dégâts sont entiers. |

- **Réussite critique en défense** : contre-attaquer, ou désarmer l’adversaire.
- **Échec critique en défense** : ni l’AP ni l’AM ne comptent, et l’attaquant ajoute +8 à ses dégâts.
- **Une attaque de zone** s’esquive en en sortant : −5 % à l’Esquive par case à parcourir, et pas plus de cases que sa vitesse. La parade n’est pas concernée.

Le détail : [[guide/attaquer-et-se-defendre|Attaquer et se défendre]].

## Les dégâts

> **Dégâts finaux = [ ( dégâts × 2 si réussite critique ÷ 2 si l’attaquant est en posture défensive − armure de la cible ) ÷ 2 si défense partielle ÷ 2 si un don divise les dégâts ] × résistance ou faiblesse**

1. La posture de l’attaquant : en posture offensive, les dés sont à leur maximum ; en posture focus, les dés des sorts montent d’un cran.
2. Les dés, plus leurs bonus.
3. × 2 sur une réussite critique.
4. ÷ 2 si l’attaquant est en posture défensive.
5. − l’AP de la cible contre une arme, son AM contre un sort.
6. ÷ 2 sur une défense partielle.
7. ÷ 2 si un don divise les dégâts.
8. × la résistance ou la faiblesse de la cible à la magie du coup.
9. On arrondit à l’inférieur, une seule fois, à la fin ; jamais sous 0.

- **L’armure contre un coup physique** (estoc, taille ou frappe) : ses AP comptent double contre un type auquel elle résiste, moitié contre un type auquel elle est faible ; un « x2 » double cet effet.
- **Les magies** : deux fois plus de dégâts d’une magie à laquelle on est vulnérable, deux fois moins d’une magie à laquelle on résiste. Les résistances et les faiblesses s’additionnent : une résistance et une faiblesse à la même magie s’annulent.
- **Ce qui ajoute des dégâts** : la tête visée, la prise en tenaille, l’attaque discrète, le Mode Hyper, la posture de symbiose.

Le détail : [[guide/les-degats|Les dégâts]] ; le texte d’origine : [[guide/formule-des-degats|Formule des dégâts]].

## Les postures

Chacun déclare sa posture au début de son tour, avant tout le reste. Elle dit aussi s’il pourra parer ou esquiver, et combien de fois.

- **Offensif** : des dégâts au maximum et une réussite critique élargie ; un malus pour toucher, ni parade ni esquive.
- **Défensif** : plus d’AP et d’AM ; des défenses sans limite, de plus en plus difficiles ; la Provocation et l’Intervention ; une réussite critique élargie en défense ; c’est la seule posture qui permet de parer ou d’esquiver une attaque d’opportunité. En échange, les dégâts que l’on inflige sont divisés par 2.
- **Neutre** : un bonus aux jets de Social et de Volonté ; un nombre limité de défenses.
- **Focus** : un bonus à la réussite de tous les jets, plus de tour de charge, des dés de sorts plus forts ; ni parade ni esquive.
- **Vigilance** : un bonus en Perception et à l’initiative ; anticiper l’adversaire ; en action rapide, estimer la position d’un ennemi invisible ou discret, ou repérer une résistance ou une vulnérabilité de l’ennemi, prise au hasard ; déjouer une embuscade ; un nombre limité de défenses.
- **Symbiose** : un bonus aux dégâts et aux soins des sorts de sa magie, de l’AM en plus, l’immunité à cette magie ; ni armes ni objets (la Forgemagie et les bâtons magiques restent permis, et l’arme élémentaire de sa magie, qui reçoit le bonus de dégâts de la posture : décision R167), une seule magie active, un nombre limité de défenses.

Les chiffres de chaque posture sont dans le tableau de [[guide/les-postures|Les postures]].

## La magie

| Résultat du jet de sort | Ce qui est dépensé |
| --- | --- |
| Réussite | le coût du sort |
| Échec | la moitié du coût, arrondie à l’inférieur |
| Échec critique | le double du coût |

- **Lancer un sort** : un D100 en *Magie* (en *Concentration* pour les mages rouge, bleu et vert).
- **À court de {{chakra|chakra}}**, en Mode Hyper ou non : 2 points de santé par point de {{chakra|chakra}} manquant.
- **Un sort IC** ne consomme pas le tour, sauf sur un échec critique.
- **Un sort de niveau 5** demande un tour de charge : on le charge, et l’on fait son jet, au premier tour ; on le lance au second. Touché pendant la charge, le lanceur fait un jet de *Concentration* pour la garder ; s’il la perd, la moitié du coût est perdue. La posture Focus supprime ce tour de charge ; un personnage à deux magies n’a pas accès à ces sorts.
- **Les NM** : 3 au plus sur un sort, qu’ils viennent des niveaux, d’un livre de sort ou du MJ.
- **Les emplacements de sorts** : chaque condition remplie (une magie innée, une magie acquise, une classe magique, une seconde classe magique) en donne autant que la puissance magique ; jamais d’emplacement en plus.
- **La quatrième barre** (les âmes de la Nécromancie, le Sang de la magie du Sang) : 10 points, qui se rechargent de 1 par tour en combat.
- **Les mages de la Corruption** : le coût de leurs sorts passe dans leur {{corruption|corruption}} ; lancer un sort en puisant dans cette réserve (ses effets « Si {{cr}} ») coûte le double en {{corruption|corruption}}.

Le détail : [[guide/la-magie-en-jeu|La magie en jeu]].

## Blessures et récupération

- **Le coma** : à 0 de santé ou moins. Jets de *Survie* : un seul réussi stabilise, trois ratés et c’est la mort. Au négatif maximal (l’opposé de la santé maximum), un seul jet ; à deux fois ce négatif, la mort sur le coup.
- **Les altérations d’état** : celles du début du tour frappent avant que l’on agisse. *Vigueur* aide contre les altérations physiques, *Fermeté* contre les attaques de l’esprit.
- **La {{corruption|corruption}}** : son maximum est celui du {{chakra|chakra}}, et chaque point prend la place d’un point de {{chakra|chakra}}. À son maximum, il reste deux semaines dans le jeu pour en retirer un point, sinon c’est la mort ; seuls ceux qui ont la Corruption en magie innée ou acquise ne risquent pas cette mort (le Potentiel Illimité, même s’il peut s’en servir, peut en mourir s’il en cumule trop). Ni le repos ni la méditation ne la font baisser.
- **Le don de base** : une action, trois fois par jour, avec un jet de *Calme* sous le stress. *Méditation* rend 3d6 + 6 de {{chakra|chakra}}, *Repos* 2d4 + 4 de santé et de {{chakra|chakra}} ; tous deux rendent davantage plus tard (voir le tableau de [[guide/la-montee-de-niveau|La montée de niveau]]).
- **En Mode Hyper**, le {{chakra|chakra}} ne se récupère pas : ni fiole bleue, ni méditation, ni repos.

Le détail : [[guide/blessures-et-etats|Blessures et états]].

## L’équipement

- **Les armes** : deux équipées au plus. Sans maîtrise de sa catégorie, une arme lance 1 dé de dégâts, et chaque point de maîtrise en ajoute un, jusqu’à 4 points au plus par catégorie, donc 5 dés. Les points de toutes les sources s’additionnent, jusqu’à ce plafond ; au-delà, la fiche le signale, et les points en trop ne donnent pas de dé. Le dé est celui de l’arme ; le bonus additionne celui de l’arme, de son matériau et de son amélioration.
- **La {{solidite|solidité}}** : à 0, l’objet est cassé. Une arme cassée est inutilisable jusqu’à sa réparation (un kit de réparation d’arme lui rend un cran) ; un bouclier cassé ne compte plus ses AP ni son AM. Une armure a une solidité par partie (le casque, le torse, chaque bras, chaque jambe), sauf une armure à cran de solidité uni, qui n’en a qu’une : une partie cassée ne compte plus l’AP ni l’AM de l’armure et se répare à part, avec un métier adapté et le matériau ; un kit de réparation d’armure, sans matériau, rend un cran à toute l’armure. Cassée, une armure à cran uni ne donne plus aucun de ses effets, bonus comme malus ; le poids d’une armure lourde, lui, demeure. Une armure élémentaire a 4 crans, plus un au +4 et un autre au +5, sur ses six parties.
- **L’AP et l’AM** : la base (race, ethnie, 4 AM par classe magique, l’Archimage comprise, et 4 AM pour la seconde spécialité d’une classe raciale ou du Flagelleur), les accessoires, l’armure portée et son amélioration ; la posture défensive en ajoute. Une armure de la catégorie *Lourd* retire 1 point de vitesse et rend la vitesse de nage nulle.
- **Le poids portable** (*Vêtement*, *Léger*, *Intermédiaire* ou *Lourd*) : la maîtrise d’armures la plus large de ses classes (aucune, donc des vêtements, pour le Mage, le Mage Vert, l’Ocultomancien, le Flagelleur et l’Archimage), relevée par les dons débloqués qui écrivent un poids ; une catégorie de plus pour le Nain, dons compris ; au moins *Léger* pour la Lamia ; jamais plus que *Lourd*, et jamais *Lourd* pour un Potentiel Illimité inné. La fiche ne propose que les armures jusqu’à ce poids ; une armure trop lourde en est retirée et notée.
- **L’armure élémentaire** : une pièce élémentaire transforme l’armure, quelle qu’elle soit, en l’armure élémentaire de sa magie et de son poids ; elle perd tout et repart sans amélioration (+1 à +5, avec les gemmes de sa magie). Elle ne se porte qu’avec sa magie, innée ou acquise. Portée, elle donne son cran de résistance à sa magie, tel qu’écrit (celle de l’Arcane à la Corruption, celle de la Corruption à l’Arcane ; le Vêtement de Glace aussi au Feu, avec l’immunité à la Brûlure), que la fiche compte avec les autres crans. Les armures de familier ne se portent pas sur une fiche de personnage.
- **Le bouclier** : une forme et une matière ; ses AP et son AM ne comptent que sur une parade partielle faite avec lui, et son poids demande une Force minimum.
- **Les accessoires** : six emplacements (le chef, le collier, deux bracelets, deux bagues) ; un accessoire maudit a l’effet contraire de celui qui est écrit.
- **La ceinture** : trois emplacements, au plus 3 exemplaires du même objet dans chacun (4 avec le don *Organisé*) ; les carquois et les sacs de bombes ou de pierres doivent y être pour servir ; ni les armes ni le bouclier n’y vont.
- **Le sac** : 24 emplacements avec 1 en Force, 28 avec 2, 32 avec 3, 36 avec 4, et 48 à partir de 5 (48 avec le don *Organisé*, quelle que soit la Force) ; une ligne du sac est un emplacement, quelle que soit sa quantité.

Le détail : [[guide/l-equipement|L’équipement]].

## Les attributs à la création

- **La santé** : celle de la race, de la ou des classes, et des magies qui en offrent.
- **Le {{chakra|chakra}}** : celui de la race, de la ou des classes, et des magies.
- **La {{barriere|barrière}}** : la moitié du {{chakra|chakra}}, plus les bonus de la race et de la classe.
- **La {{corruption|corruption}}** : son maximum est celui du {{chakra|chakra}}.
- **L’armure de base** : celle que donne la race, s’il y en a, et 4 AM par classe magique (l’Archimage en est une).
- **L’initiative** : 1D20 + un bonus qui dépend de l’Agilité.
- Certaines ethnies ajoutent de la santé, du {{chakra|chakra}}, de la {{barriere|barrière}}, de l’armure ou de la vitesse.
- **Les caractéristiques** : exactement 14 points, de 1 à 4 dans chacune en règle générale ; le +1 de la magie innée permet d’atteindre 5.
- **Les compétences** : exactement 100 points, et pas plus de 20 points naturels dans une compétence à la création.

Le détail : [[guide/creer-son-personnage|Créer son personnage]].

## Progresser

- **L’expérience** (XP) fixe le niveau global, de 1 à 20. Chaque nouveau niveau apporte des points de compétences et des points d’attributs à répartir entre la santé et le {{chakra|chakra}}, et certains niveaux davantage : le tableau de [[guide/la-montee-de-niveau|La montée de niveau]] les donne tous.
- **Une seule classe** : elle commence au niveau 2 et gagne 2 niveaux par niveau global jusqu’au niveau 20, qu’elle atteint au niveau global 10 ; au niveau global 11, une seconde classe est prise automatiquement et reçoit la suite. **Deux classes** : chacune commence au niveau 1 et gagne 1 niveau par niveau global.
- **Les dons d’une classe** se gagnent aux niveaux 1, 5, 10, 15 et 20 de la classe ; sa spécialité se choisit à son niveau 10.
- **S’entraîner** : un D100 par entraînement, d’autant plus profitable que le résultat est bas ; 15 compétences au plus, et 10 % au plus pour chacune.
- **Un métier** : des bonus d’acquis ou d’attribut, des objets de départ et, pour certains, l’artisanat, dont la compétence vaut 10 × la première caractéristique du métier + 10 × la seconde.

Le détail : [[guide/la-montee-de-niveau|La montée de niveau]] et [[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]].

## Le Mode Hyper

- **Dès le niveau 2.** Il s’active en action rapide, sans jet, une fois par semaine dans le jeu ; dans un combat, une seule créature peut l’activer, sauf exceptions.
- **Ce qu’il donne** : +15 aux dégâts physiques, +15 aux dégâts de la magie (+7 avec deux magies), +15 aux soins magiques, des sorts qui ne coûtent plus de {{chakra|chakra}} ; avec une seule magie, l’immunité à sa magie innée, et avec deux, une très forte résistance à ses deux magies ; et les effets propres à ses magies et à sa race.
- **Ce qu’il coûte** : 10 % du {{chakra|chakra}} maximum à chaque tour, sans pouvoir en récupérer ; il dure au plus le niveau global divisé par 2, en tours.
- **Au-delà des limites**, une fois le mode relâché, selon les tours en trop : 1, les résistances magiques brisées pendant 24 h ; 2, les vulnérabilités accentuées pendant 24 h ; 3, trois croix au hasard pendant 24 h ; 4, le coma et toute la santé perdue ; 5, le mode se désactive, avec une chance sur deux de mourir.
- **Le Mode Hyper 100 %**, dès le niveau 10 : pendant 3 tours, toutes les postures sans leurs inconvénients, des sorts surchargés d’un dé de dégâts, +10 dégâts à toutes les attaques ; revenir au Mode Hyper coûte ensuite 75 % du {{chakra|chakra}} maximum.
- **Le Mode Super** : une symbiose avec un objet légendaire ou enchanté, qui donne +10 aux dégâts physiques et les effets de l’objet.

Le détail : [[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]].', 'neutre', NULL, 'page', '{"id":"guide/aide-memoire"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 298, 'guide', 'Les bases', 'Lexique', 'Texte', 'modifie', '- **Acquis** : les points d’une compétence gagnés par l’entraînement, la race, la classe, les dons ou l’équipement.
- **AM** (armure magique) : ce qui retire des points aux dégâts des sorts.
- **AP** (armure physique) : ce qui retire des points aux dégâts des armes.
- **Âme / Sang** : la « 4ᵉ barre » des utilisateurs de la nécromancie et de la magie du sang, que dépensent certains de leurs sorts.
- **Attributs** : santé, chakra, barrière, corruption, vitesse, initiative…
- **Barrière** : une seconde peau magique, sorte de santé magique ; elle vaut la moitié du chakra.
- **Battlemap** : la carte quadrillée sur laquelle se joue un combat.
- **Caractéristiques** : Force, Volonté, Intelligence, Perception, Social et Agilité.
- **Chakra** : les points de magie, que dépensent les sorts ; à court de chakra, on paie 2 points de santé par point manquant.
- **Classe magique** : une classe qui donne +4 AM et un emplacement de sort.
- **Compétence** : un savoir-faire (Diplomatie, Esquive, Magie…), lié à une caractéristique.
- **Corruption** : un poison du chakra, qui en prend la place.
- **D100, D20, d6…** : un dé à 100, 20, 6… faces. « 2d6+2 » : deux dés à six faces, plus 2.
- **Défense partielle** : une parade ou une esquive réussie, mais moins bonne que l’attaque ; les dégâts sont divisés par 2.
- **Dieu inné** : la divinité de la magie innée du personnage.
- **Don** : une capacité particulière, de type passif, actif, action ou réaction.
- **Échec critique** : un résultat de 96 à 100 au D100.
- **Emplacement de sort** : la place d’un sort connu sur la fiche.
- **Ethnie** : une variante d’une race (Felfe forestier, Orios de Sang…).
- **IC** (*Instant Cast*), ou action rapide : une action qui ne prend pas l’action du tour ; trois au plus par tour.
- **Initiative** : ce qui fixe l’ordre de jeu en combat (1D20 + un bonus d’Agilité).
- **Magie acquise** : une seconde magie, facultative.
- **Magie innée** : la magie de naissance, héritée de l’un des parents.
- **Maîtrise d’arme** : le savoir-faire avec une catégorie d’arme ; chaque point ajoute un dé de dégâts.
- **MJ** : le maître du jeu.
- **Mode Hyper** : un état de surpuissance, ouvert au niveau 2.
- **Naturel** (Nat.) : les points de compétence que l’on répartit soi-même.
- **NM** (niveau de maîtrise) : ce qui renforce un sort.
- **NPM** (niveau de puissance magique) : le palier d’un sort, de 1 à 5.
- **Parade** / **Esquive** : bloquer un coup / l’éviter.
- **PJ** : un personnage joueur. **PNJ** : un personnage non joueur, joué par le MJ.
- **Posture** : l’attitude de combat choisie au début de chaque tour.
- **Puissance magique** : le niveau de magie du personnage, de 1 à 5 ; elle ouvre les paliers de sorts.
- **Race pure** / **race hybride** : les deux familles de races ; une race hybride a sa classe raciale.
- **Réussite critique** : un résultat de 1 à 5 au D100.
- **Spécialité** : l’embranchement d’une classe, choisi à son niveau 10.
- **Tour de charge** : le tour passé à préparer un sort de niveau 5.
- **Vitesse** : le nombre de cases parcourues en un tour.
- **XP** : les points d’expérience, qui font monter le niveau global.', 'Les mots et les abréviations du jeu, rangés dans l’ordre alphabétique. Chaque définition renvoie à la page qui en parle. Celles du glossaire du site sont reprises telles quelles, et la page [Recherche](/recherche/) les réunit toutes. Les noms de l’univers (dieux, lieux, factions…) sont dans le [[Glossaire]] du Codex.

## A

- **Acquis** : les points d’une compétence qui ne se répartissent pas, mais se gagnent : par l’entraînement, les dons de la race, de l’ethnie et de la classe, l’armure portée, le métier et les accessoires, et la fiche de personnage du site les additionne. En règle générale, ils ne dépassent pas 5 par point de la caractéristique, le +1 de la magie innée compris ([[guide/reussir-une-action|Réussir une action]]).
- **Action** : l’action principale du tour, qui sert à attaquer, à lancer un sort, à utiliser un objet, à sprinter, à utiliser un don de type *Action* ou à faire une quatrième action rapide ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Action rapide** : voir *IC*.
- **Alignement** : la morale du personnage. Il évolue au fil de l’aventure, selon ses actes, ses décisions et ses paroles, et le MJ en tient les quatre scores : Loyal, Chaotique, Bon et Mauvais ([[Alignement]]).
- **Altération d’état** : un changement de la condition d’un personnage (poison, brûlure, peur, paralysie…) qui lui inflige des malus, souvent pendant plusieurs tours. Il en existe vingt, physiques ou mentales, et la plupart ont trois stades, de plus en plus forts ([[guide/blessures-et-etats|Blessures et états]]).
- **AM** (armure magique) : les points que l’armure retire aux dégâts des sorts. L’AM vient de la race, de l’ethnie, des classes magiques (4 chacune : voir *Classe magique*), des accessoires et de l’armure portée ([[guide/l-equipement|L’équipement]]).
- **Âme**, **Sang** : la quatrième barre des utilisateurs de la Nécromancie (les âmes) et de la magie du Sang (le Sang). C’est une réserve de 10 points, qui se recharge de 1 par tour en combat et que demandent certains de leurs sorts ([[guide/la-magie-en-jeu|La magie en jeu]]).
- **Amélioration** : le niveau d’une arme (de +1 à +10), d’une armure ou d’un bouclier (de +1 à +5). Le niveau choisi donne le bonus qu’il écrit, qui est déjà le total : +10 aux dégâts pour une arme +5, +10 AP et +10 AM pour une armure +5, +10 AP pour un bouclier +5. On paie toutes les étapes, une à une, sans en sauter aucune. Les crans de {{solidite|solidité}} : pour une arme, +1 du +5 au +9 et +2 au +10 ; pour une armure, +1 au +4 comme au +5 ; pour un bouclier, les crans s’additionnent, +1 du +1 au +4 et +2 au +5 ([[guide/l-equipement|L’équipement]]).
- **AP** (armure physique) : les points que l’armure retire aux dégâts des armes. Contre un coup d’estoc, de taille ou de frappe, l’armure portée les compte double ou moitié, selon qu’elle y résiste ou y est faible ([[guide/les-degats|Les dégâts]]).
- **Artisanat** : fabriquer des objets, ce que seuls certains métiers permettent : il faut le bon métier. La compétence d’artisanat vaut 10 × la première caractéristique du métier + 10 × la seconde ([[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]).
- **Attaque d’opportunité** : une attaque offerte hors de son tour, quand un adversaire rate son attaque contre vous sur un échec critique, quand il sort de votre zone d’influence (sauf si c’est vous qui l’en faites sortir), ou quand un don le permet. Une seule par tour et par joueur, sauf don qui en permet plus, et seulement une action simple ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Attaque discrète** : frapper une cible qui ne vous voit pas venir, pour un dé de dégâts en plus. À ne pas confondre avec l’attaque sournoise, qui vient d’une classe ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Attaque gratuite** : l’attaque que permet un adversaire qui quitte votre zone d’influence. Le [[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]] range aussi ce cas parmi les attaques d’opportunité (voir *Attaque d’opportunité* et *Zone d’influence*).
- **Attributs** : les valeurs de base du personnage (santé, {{chakra|chakra}}, {{barriere|barrière}}, {{corruption|corruption}}, vitesse, initiative, armure de base), et la quatrième barre pour la Nécromancie et la magie du Sang ([[guide/creer-son-personnage|Créer son personnage]]).

## B

- {{barriere:}} Abrégée BA, elle vaut la moitié du {{chakra|chakra}} total, plus les bonus de la race et de la classe. Certains matériaux d’arme la contrent : le Mythril passe à travers, le Maverium la brise à son contact ([[guide/les-degats|Les dégâts]]). Le [[Glossaire]] du Codex précise qu’elle prend les coups avant la santé, sauf contre-indication.
- **Battlemap** : voir *Carte de combat*.
- **Biclassage** : avoir deux classes. On peut commencer avec deux classes, chacune au niveau 1 et gagnant 1 niveau par niveau global ; avec une seule, qui commence au niveau 2 et en gagne 2 par niveau global jusqu’au niveau 20, qu’elle atteint au niveau global 10, une seconde classe est prise automatiquement au niveau global 11 et reçoit la suite. Au niveau global 20, tout personnage a donc deux classes au niveau 20 ([[guide/creer-son-personnage|Créer son personnage]]).
- **Boss** : un ennemi pensé pour affronter une équipe de quatre joueurs. Il a deux initiatives par tour, et plus de parades et d’esquives que les autres dans certaines postures ([[guide/situations-avancees|Les situations avancées]]).
- **Bouclier** : une forme, sa classe de 1 à 5 (Bocle, Targe, Bouclier Rond, Écu, Pavois), et une matière, qui donne sa solidité. Ses AP et son AM ne comptent que sur une parade partielle faite avec lui, et son poids demande une Force minimum ([[guide/l-equipement|L’équipement]]).

## C

- **Campagne** : une aventure en plusieurs séances, qui part d’un point A pour arriver à un point B ; les joueurs y font partie de l’écriture de l’histoire. Voir aussi *One shot* ([[guide/rejoindre-une-partie|Rejoindre une partie]]).
- **Caractéristiques** : les six valeurs de base du personnage, Force, Volonté, Intelligence, Perception, Social et Agilité, de 1 à 4 en règle générale (5 avec le +1 de la magie innée). Chacune compte dix fois dans le score de ses cinq compétences ([[guide/creer-son-personnage|Créer son personnage]]).
- **Carte de combat** (*battlemap*) : une carte quadrillée vue de haut, où le MJ dessine les obstacles d’un combat et où l’on compte les distances en cases. Il peut s’en passer pour un combat rapide ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Ceinture** : trois emplacements pour des objets à portée de main (fioles, carquois, bâtons magiques…), qui s’utilisent en une action rapide au lieu d’une action entière ; au plus 3 exemplaires du même objet dans chacun ([[guide/l-equipement|L’équipement]]).
- {{chakra:}} Abrégé CK, il compte les points de magie du personnage, que dépensent ses sorts, et vient de la race, de la ou des classes et des magies ([[guide/la-magie-en-jeu|La magie en jeu]]).
- **Classe** : la façon de se battre du personnage. Elle a son propre niveau, et lui donne de la santé, du {{chakra|chakra}} et de la {{barriere|barrière}}, des maîtrises d’armes et d’armures, un équipement de départ et des dons. Les [classes](/classes/) se rangent en cinq catégories : physiques au corps à corps, physiques à distance, magiques, raciales et spéciales.
- **Classe magique** : une classe de la catégorie des classes magiques ; l’[[classes/archimage|Archimage]], rangée dans les classes spéciales, en est une aussi. Elle donne 4 AM et compte comme une condition pour les emplacements de sorts. La seconde spécialité de chaque classe raciale, et celle du [[classes/flagelleur|Flagelleur]], donne elle aussi 4 AM ([les classes](/classes/)).
- **Classe raciale** : la classe propre à une race hybride, qui porte son nom. Le Drassah’thac, hybride, n’en a pas.
- **Coma** : l’état d’un personnage dont la santé tombe à 0 ou moins. Inconscient, il fait des jets de *Survie* : un seul réussi le stabilise, trois ratés et il meurt ([[guide/blessures-et-etats|Blessures et états]]).
- **Compétence** : un savoir-faire lié à une caractéristique (*Diplomatie*, *Esquive*, *Magie*…), avec son score. Il y en a trente, cinq par caractéristique ([[guide/creer-son-personnage|Créer son personnage]]).
- {{corruption:}} Voir [[guide/blessures-et-etats|Blessures et états]].
- **Coût secondaire** : ce qu’un sort coûte en plus de son {{chakra|chakra}} (des âmes pour la Nécromancie, du Sang pour la magie du Sang, ou autre chose encore, comme une part de la santé) ([[guide/la-magie-en-jeu|La magie en jeu]]).
- {{cr:}} Voir [[guide/la-magie-en-jeu|La magie en jeu]].
- **Créature invoquée** : une créature appelée par un sort. Ce sont les morts de l’Animation de mort (Nécromancie), les golems de l’Appel aux Golems (Terre), les marionnettes de la Marionnette de l’ombre (Ombre). Elle n’a pas d’échelle de puissance : son rang est un NPM ([le bestiaire](/bestiaire/)).
- **Croix** : une marque sous une caractéristique, laissée par une blessure grave, un traumatisme, une maladie, une mauvaise nuit ou certaines altérations d’état. Une croix retire 20 % à tous les jets de la caractéristique ; deux la rendent inutilisable, elle et ses compétences ([[guide/reussir-une-action|Réussir une action]]).

## D

- **D100, D20, d6…** : un dé à 100, 20, 6… faces. Le nombre écrit devant dit combien de dés lancer, et ce qui suit le « + » s’ajoute : « 2d6+2 », ce sont deux dés à six faces, additionnés, plus 2 ([[guide/bienvenue|Bienvenue dans Maverick]]).
- **Défense partielle** : une parade ou une esquive réussie, mais moins bonne que l’attaque. Les dégâts sont divisés par 2. Si c’est une *parade partielle* faite au bouclier, ses AP et son AM comptent : c’est le seul cas où ils comptent ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Dégâts** : ce que perd la cible d’un coup réussi, en santé ou en {{barriere|barrière}}, une fois retirée son armure ([[guide/les-degats|Les dégâts]]).
- **Dieu inné**, **dieu choisi** : le dieu inné est la divinité de la magie innée du personnage (l’Espace/Temps en a deux) ; le dieu choisi, facultatif, est celui qu’il décide de prier (le Glossaire du Codex le nomme *dieu acquis*).
- **Don** : une capacité particulière, donnée par la race, par la classe ou par les événements de l’aventure. Un don est *passif* (toujours effectif), *actif* (à déclarer pour que son effet fonctionne), d’*action* (il prend l’action du tour) ou de *réaction* (il se joue en dehors de son tour) ([[guide/creer-son-personnage|Créer son personnage]]).
- **Don de base** : le don que donne la race, *Méditation* (pour récupérer du {{chakra|chakra}}) ou *Repos* (pour récupérer de la santé et du {{chakra|chakra}}) ; une action, trois fois par jour ([[guide/blessures-et-etats|Blessures et états]]).

## E

- **Échec critique** : un résultat de 96 à 100 au D100. L’action rate complètement, et cela coûte quelque chose : un sort au double de son coût, une défense où l’armure ne compte plus… ([[guide/reussir-une-action|Réussir une action]]).
- **Embuscade** : consommer l’action de son tour pour attendre un ennemi, et lui porter une attaque d’opportunité dès qu’il entre dans la zone voulue. La posture de vigilance la déjoue ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Emplacement de sort** : la place d’un sort sur la fiche. Chaque condition remplie (une magie innée, une magie acquise, une classe magique, une seconde classe magique) en donne autant que la puissance magique ([[guide/creer-son-personnage|Créer son personnage]]).
- **Entraînement** : un jet de D100 qui fait gagner des points d’acquis dans une compétence, auprès d’un entraîneur ou d’un PNJ important. Il ne fait progresser que 15 compétences au plus, et chacune de 10 % au plus ([[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]).
- **EP** (échelle de puissance) : la classification indicative de la puissance d’un monstre, que donne sa carte du [bestiaire](/bestiaire/). Les créatures invoquées n’en ont pas.
- **Esquive** : éviter un coup, avec la compétence *Esquive* (Agilité). Voir aussi *Parade* et *Défense partielle*.
- **Ethnie** : une variante d’une race, comme le Felfe Forestier ou l’Orios de Sang, qui peut avoir ses propres dons et bonus ([les races](/races/)).

## F

- **Faiblesse** : voir *Résistance*.

## I

- **IC** (*Instant Cast*), ou **action rapide** (le Doc « Guide pour MJ » dit aussi *action bonus*) : une action qui ne prend pas l’action du tour. Trois au plus par tour, jamais deux fois la même, toujours avant l’action ; un sort IC ne consomme pas le tour, sauf sur un échec critique ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Initiative** (INI) : ce qui fixe l’ordre de jeu en combat. À chaque tour, chacun lance 1D20 et ajoute un bonus qui dépend de son Agilité ; on joue du plus haut résultat au plus bas ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Intervention** : en posture défensive, parer ou esquiver un coup à la place d’un allié adjacent ([[guide/les-postures|Les postures]]).

## M

- **Magie acquise** : une seconde magie, facultative. Toutes les magies ne se mélangent pas, et avec deux magies, les sorts de niveau 5 restent fermés ([[guide/creer-son-personnage|Créer son personnage]]).
- **Magie innée** : la magie de naissance, héritée de l’un des parents, sauf si un dieu intervient ; tout le monde en a une. Elle donne +1 dans une caractéristique et relie le personnage à son dieu inné ([[guide/l-univers|L’univers]]).
- **Maîtrise d’arme** : le savoir-faire avec une catégorie d’arme. Sans maîtrise, l’arme lance 1 dé de dégâts ; chaque point de maîtrise en ajoute un, jusqu’à 4 points au plus par catégorie, donc 5 dés. Les points de toutes les sources s’additionnent, jusqu’à ce plafond ; au-delà, la fiche le signale, et les points en trop ne donnent pas de dé ([[guide/l-equipement|L’équipement]]).
- **Métier** : un savoir-faire choisi à la création ou plus tard dans l’aventure. Il donne des bonus d’acquis ou d’attribut, des objets de départ et, pour certains, l’artisanat ([les métiers](/metiers/)).
- **MJ** (maître du jeu) : celui qui raconte l’histoire, joue les PNJ et les monstres, et juge de ce qui est possible, improbable ou impossible ([[guide/un-maitre-du-jeu|Un maître du Jeu]]).
- **Mode Hyper** : l’état de surpuissance qui s’ouvre au niveau 2 : pour quelques tours, une fois par semaine, la magie du personnage ne fait plus qu’un avec lui. Le Mode Hyper 100 %, plus puissant encore, s’ouvre au niveau 10 ([[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]]).
- **Mode Super** : un équivalent moins puissant du Mode Hyper : une symbiose avec un objet légendaire ou enchanté ([[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]]).
- **Monnaies** : le Ricken de fer (RF), le Ricken d’or (RO) et la Pierre précieuse (PP). 1 RO = 100 RF, et 1 PP = 1 000 RO.
- {{mordhau:}} Voir [[guide/l-equipement|L’équipement]].

## N

- **Naturel** (Nat.) : les points de compétence que l’on répartit soi-même, à la création (100 points, 20 au plus dans une compétence) puis à chaque niveau ([[guide/creer-son-personnage|Créer son personnage]]).
- **Négatif maximal** : l’opposé de la santé maximum (−30 pour 30 de santé). Un personnage dans le coma qui y descend n’a droit qu’à un seul jet de survie, et à deux fois ce négatif, il meurt sur le coup ([[guide/blessures-et-etats|Blessures et états]]).
- **Niveau de classe** : le niveau propre à chaque classe, qui suit le niveau global. La classe donne ses dons à ses niveaux 1, 5, 10, 15 et 20, et sa spécialité à son niveau 10 ([[guide/la-montee-de-niveau|La montée de niveau]]).
- **Niveau global** : le niveau du personnage, de 1 à 20, que fixe son total d’expérience. Il règle le niveau de ses classes et sa puissance magique ([[guide/la-montee-de-niveau|La montée de niveau]]).
- **NM** (niveau de maîtrise) : ce qui renforce un sort, de 0 à 3 NM ; ce que chacun lui apporte est écrit sur le sort. Il se gagne par niveau, par la lecture d’un livre de sort ou en cadeau du MJ ([[guide/la-magie-en-jeu|La magie en jeu]]).
- **NPM** (niveau de puissance magique) : le niveau d’un sort, de 1 à 5. Un sort n’est accessible que si la puissance magique du personnage atteint son NPM ; la page de chaque [magie](/magies/) range ses sorts par NPM.

## O

- **One shot** (scénario) : une histoire jouée en une seule séance, avec une fin fermée, qui ne laisse pas de suite. Voir aussi *Campagne* ([[guide/rejoindre-une-partie|Rejoindre une partie]]).

## P

- **Parade** : bloquer un coup avec son arme ou son bouclier, avec la compétence *Parade* (Force). Voir aussi *Esquive* et *Défense partielle*.
- **Pièce élémentaire** : une pièce qui, posée sur une arme, une armure ou un vêtement, le transforme pour toujours en un équipement chargé de sa magie ; les bonus d’origine sont perdus ([[ressources/pieces-elementaires|Pièces élémentaires]]).
- **PJ**, **PNJ** : un personnage joueur, celui qu’incarne un joueur ; un personnage non joueur, que joue le MJ, comme tous ceux que croisent les personnages.
- **Portée** (PO) : la distance qu’un sort ou une action peut atteindre. Celle d’une arme est le nombre de cases que parcourt son projectile, 1 pour une arme qui n’en écrit pas ; chaque diagonale y compte pour 2 cases ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Posture** : l’attitude de combat que l’on déclare au début de son tour. Il en existe six : Offensif, Défensif, Neutre, Focus, Vigilance et Symbiose ([[guide/les-postures|Les postures]]).
- **Prétiré** : une fiche de personnage créée sur le site, visible de tous ; la liste des [personnages](/personnages/) les réunit.
- **Puissance magique** : le niveau de magie du personnage, de 1 à 5, qui augmente avec son niveau global. Elle dit jusqu’à quel NPM il peut lancer des sorts, et multiplie ses emplacements de sorts ([[guide/la-montee-de-niveau|La montée de niveau]]).

## R

- **Race pure**, **race hybride** : les deux familles de races. Une race hybride a sa classe raciale, sauf le Drassah’thac ([[guide/l-univers|L’univers]]).
- **RC** : voir *Réussite critique*.
- {{recharge-longue:}} Une propriété de certaines [armes](/ressources/equipement/#armes).
- {{recharge-tres-longue:}} Une propriété de certaines [armes](/ressources/equipement/#armes).
- **Remède** : une potion contre une altération d’état. Le mineur la réduit d’un cran, le majeur de deux, le parfait la soigne entièrement ([[guide/blessures-et-etats|Blessures et états]]).
- **Résistance**, **faiblesse** (ou vulnérabilité) : ce qui fait prendre deux fois moins de dégâts d’une magie, ou deux fois plus. Elles se comptent en crans qui s’additionnent : deux résistances à la même magie font une grande résistance, deux faiblesses une grande vulnérabilité, une résistance et une faiblesse s’annulent. L’armure, elle, résiste ou est faible à des types de coups physiques ([[guide/les-degats|Les dégâts]]).
- **Réussite critique** (RC) : un résultat de 1 à 5 au D100. L’action réussit de façon exceptionnelle : en attaque, les dégâts de base sont doublés ([[guide/reussir-une-action|Réussir une action]]).

## S

- **Santé** : les points de vie du personnage. À 0 ou moins, il tombe dans le coma ([[guide/blessures-et-etats|Blessures et états]]).
- **Score** : le pourcentage de réussite d’une compétence, qui vaut 10 × la caractéristique + les points naturels + les points acquis. Il faut faire son score ou moins au D100 pour réussir ([[guide/reussir-une-action|Réussir une action]]).
- {{solidite:}} Elle compte les mauvais coups (un coup critique, le coup d’un adversaire très fort…) qu’un équipement peut encaisser. Une armure en a une par partie (le casque, le torse, chaque bras, chaque jambe), sauf une armure à cran de solidité uni, qui n’en a qu’une ([[guide/l-equipement|L’équipement]]).
- **Spécialité** : l’embranchement d’une classe, qui se choisit quand elle atteint le niveau 10 ; la page de la classe en donne les dons ([les classes](/classes/)).
- **Sprint** : doubler la distance parcourue pendant son tour. C’est l’action du tour : impossible d’attaquer après un sprint ([[guide/le-tour-de-jeu|Le tour de jeu]]).

## T

- **Tenaille** (prise en) : un ennemi encerclé au corps à corps par des alliés placés sur des cases opposées ; chaque allié de plus donne un avantage, jusqu’à quatre ([[guide/attaquer-et-se-defendre|Attaquer et se défendre]]).
- **Tour** : en combat, le temps se découpe en tours ; chacun agit à son tour, dans l’ordre de l’initiative, puis un nouveau tour commence ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Tour de charge** : le tour passé à charger un sort de niveau 5 avant de le lancer. La posture Focus le supprime ([[guide/la-magie-en-jeu|La magie en jeu]]).

## V

- **Vitesse** : le nombre de cases que le personnage parcourt en un tour. Il en a deux, sur terre et à la nage : celles de sa race, que l’équipement, les accessoires et les sorts peuvent changer ([[guide/le-tour-de-jeu|Le tour de jeu]]).
- **Vulnérabilité** : voir *Résistance*.

## X

- **XP** : les points d’expérience. Leur total fixe le niveau global ([[guide/la-montee-de-niveau|La montée de niveau]]).

## Z

- **Zone d’influence** : les cases devant un adversaire, derrière lui, à sa gauche et à sa droite. Y entrer puis la traverser lui permet une attaque d’opportunité ; la quitter, une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité ([[guide/le-tour-de-jeu|Le tour de jeu]]).', 'neutre', NULL, 'page', '{"id":"guide/lexique"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 299, 'guide', 'Règles avancées', 'Fiche de personnage : Armure/Défense/Bouclier', 'Texte', 'modifie', 'C’est ici qu’on retrouve toutes les informations sur la défense du personnage.

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

Le Bouclier permet d’avoir des AP et AM en plus de votre armure mais pour qu’ils soient comptés, ça implique une “Parade partielle”. Il peut être de différentes compositions, allez [ici](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit) pour plus d''informations.', 'C’est ici qu’on retrouve toutes les informations sur la défense du personnage.

**AP base** : Il s’agit de l’armure physique que possède naturellement un personnage, elle est déterminée si une race possède un bonus d’armure physique (exemple : Certains Drakos, Namazu, etc…) ou alors par un objet.

**AM base** : Il s’agit de l’armure magique que possède naturellement un personnage, elle est principalement déterminée si le personnage possède des classes magiques ou non. Chaque classe magique donne 4 AM. Certaines races peuvent en donner comme les Drakos ou les Marcass, ou alors certains objets magiques.

L''armure est divisée en 6 morceaux :

- T = Tête
- C = Corps
- BG = Bras Gauche
- BD = Bras Droit
- JG = Jambe Gauche
- JD = Jambe Droite

Elle possède également une Dur. ({{solidite|solidité}} comme pour les armes)

**Bonus/Malus** : Cela correspond à des particularités, effets secondaires de l’armure mais aussi de son comportement contre les dégâts physiques (Estoc, Taille, Frappe), allez dans le document [Ressources et Craft](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit), et dans Armures pour plus d''informations.

Le Bouclier permet d’avoir des AP et AM en plus de votre armure mais pour qu’ils soient comptés, ça implique une “Parade partielle”. Il peut être de différentes compositions, allez [ici](https://docs.google.com/spreadsheets/u/0/d/1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw/edit) pour plus d''informations.', 'neutre', NULL, 'page', '{"id":"guide/fiche-armure-defense-bouclier"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 300, 'guide', 'Règles avancées', 'Fiche de personnage : Attributs', 'Texte', 'modifie', '**Santé** : Il s''agit du nombre de points de vie que possède le personnage, si ce score atteint 0 ou moins le personnage est considéré comme dans le coma et doit faire des jets de survie. Si jamais 3 jets de survie échouent, le personnage meurt. Un seul jet de survie réussi suffit à stabiliser le personnage. La santé est déterminée par plusieurs choses => La Race, la ou les Classes ainsi que de la Magie du Sang (si jamais vous avez cette magie)

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
| -2 initiative | +0 initiative | +2 initiative | +4 initiative | +6 initiative |', '**Santé** : Il s''agit du nombre de points de vie que possède le personnage, si ce score atteint 0 ou moins le personnage est considéré comme dans le coma et doit faire des jets de survie. Si jamais 3 jets de survie échouent, le personnage meurt. Un seul jet de survie réussi suffit à stabiliser le personnage. La santé est déterminée par plusieurs choses => La Race, la ou les Classes ainsi que de la Magie du Sang (si jamais vous avez cette magie)

**Âme/Sang** : Appelée aussi la 4ème barre, il s''agit d''un attribut qui ne concerne que les utilisateurs de la Nécromancie et de la Magie du Sang . Il s''agit d''une réserve qui doit être utilisée lors de l''utilisation de certains sortilèges. Cet attribut se recharge de 1 point par tour dans les combats. Il est fixé à 10 pour les deux.

**{{chakra}}** : C''est le nombre de points de magie que possède le personnage, c''est ce qui permet de lancer des sortilèges, pas de {{chakra|chakra}} = pas de sortilèges. Le {{chakra|chakra}} est déterminé par plusieurs choses => La Race, la ou les Classes ainsi que les différentes magies.

La consommation de {{chakra|chakra}} est indiquée sur les sorts mais il y a des cas particuliers : L’Échec critique avec un sort consomme le double du coût, l’échec au jet pour utiliser un sort fait consommer la moitié du coût de base.

**{{corruption}}** : Cet attribut un peu particulier a le même maximum que le {{chakra}} et évolue en même temps que ce dernier. La {{corruption|corruption}} est un poison pour le lobe de chakra (un organe situé dans le cerveau).

Chaque point de {{corruption|corruption}} va empêcher l’utilisation du {{chakra|chakra}}, comme une substance parasite qui va prendre la place du {{chakra|chakra}}. Si la {{corruption|corruption}} atteint le seuil maximum, votre personnage a 2 semaines dans le jeu pour retirer au moins 1 point de {{corruption|corruption}} sinon il va mourir et se transformer en abomination.

Pour résumer : Vous avez par exemple 25 de {{chakra|chakra}} maximum, si jamais vous avez 2 points de {{corruption|corruption}}, vous ne pourrez pas monter au-delà de 23/25 car la {{corruption|corruption}} prend la place.

***PS : Seuls ceux qui ont la corruption en magie innée ou acquise ne meurent pas au seuil maximum, mais la corruption prend aussi la place de leur chakra. Le Potentiel Illimité, même s''il peut l''utiliser, peut en mourir s''il en cumule trop.***

**{{barriere}}** : Il s''agit d''une seconde peau magique qui permet de protéger la chair. La {{barriere|barrière}} est en quelque sorte de la santé magique, son taux est déterminé par le total de {{chakra|chakra}} : [{{chakra}} total divisé par 2 = {{barriere}} totale] (exemple : 20 {{chakra}} = 10 {{barriere}}). Il existe certaines classes/races qui offrent de la {{barriere|barrière}}. Par logique, plus vous avez de {{chakra|chakra}}, plus vous aurez de {{barriere|barrière}}. Ce qui fait que les mages ont des {{barriere|barrières}} colossales MAIS ... il existe des matériaux pour les armes qui sont capables de contrer cette peau magique comme le Mythril qui est capable de passer à travers la {{barriere|barrière}}, mais aussi le Maverium, qui lui, casse la {{barriere|barrière}} à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des {{barriere|barrières}})

**Vitesse** : Il s''agit de l''attribut qui détermine le nombre de cases qu''un personnage peut parcourir le tour où il joue (plus détail [ici](https://maverick-jdr.fandom.com/fr/wiki/Combat))

**INI ou Initiative** : C''est la valeur qui détermine à quel moment vous allez commencer à jouer lors d''un combat. D20 car on lance ce dé pour l''initiative et le + ... est déterminé par l''Agilité

| **1 Agilité** | **2 Agilité** | **3 Agilité** | **4 Agilité** | **5 Agilité** (Atteignable uniquement avec la magie du Vent ou de la Foudre/Vent |
| :-: | :-: | :-: | :-: | :-: |
| -2 initiative | +0 initiative | +2 initiative | +4 initiative | +6 initiative |', 'neutre', NULL, 'page', '{"id":"guide/fiche-attributs"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 301, 'guide', 'Règles avancées', 'Fiche de personnage : Expérience/Niveau global', 'Texte', 'modifie', 'Il s''agit de là où on note le total d''expérience accumulé par le personnage ainsi que son niveau global, nous allons voir ici en détail l’expérience nécessaire pour chaque niveau et ce que ces derniers apportent :

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
| Niveau 5 | **1650** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +10 maximum naturel<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 {{chakra\|chakra}} OU 1d4 pour les deux) |
| Niveau 6 | **2450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 7 | **3850** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 8 | **5450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 3 |
| Niveau 9 | **8250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 10 | **11450** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- +10 maximum naturel<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 {{chakra\|chakra}} OU 1d4 pour les deux)<br>- Mode Hyper 100% débloqué !<br>- Méditation redonne 6d6 + 12 {{chakra\|chakra}}/Repos redonne 6d4 + 12 santé et {{chakra\|chakra}} |
| Niveau 11 | **17050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 12 | **23450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 4 |
| Niveau 13 | **34650** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 14 | **47450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 15 | **69850** | - 15 points d''attributs à répartir<br>- +1 Caractéristique à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 {{chakra\|chakra}} OU 1d4 pour les deux) |
| Niveau 16 | **95450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Puissance magique niveau 5 (non disponible pour les personnages avec une magie acquise) |
| Niveau 17 | **140250** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 18 | **191450** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 19 | **281050** | - 15 points d''attributs à répartir<br>- 20 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort |
| Niveau 20 | **460250** | - 15 points d''attributs à répartir<br>- 40 points de compétences<br>- +2 Niveaux de classe<br>- 1 Niveau de maîtrise pour un sort<br>- Dé d''attributs bonus (1d8 santé OU 1d8 {{chakra\|chakra}} OU 1d4 pour les deux) |

*Rappel : Le Niveau global détermine le(s) niveau(x) de classe(s) (plus de détails dans* [*classe*](https://maverick-jdr.fandom.com/fr/wiki/Classe)*) ainsi que le Niveau de Magie (plus de détails dans* [*Magie*](https://maverick-jdr.fandom.com/fr/wiki/Magie)*)*', 'neutre', NULL, 'page', '{"id":"guide/fiche-experience-niveau-global"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 302, 'guide', 'Règles avancées', 'Jet de dés', 'Texte', 'modifie', 'Comme expliqué plus haut, le jeu de rôle et notamment celui-ci c''est beaucoup de jets de dés, il existe plusieurs façons de procéder à ça :

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

Le mj peut laisser les joueurs faire leur jet de survie ou alors il peut faire lui-même les jets de survie et avoir la capacité de tricher pour leur bien, un échec critique n''est jamais loin.', 'Comme expliqué plus haut, le jeu de rôle et notamment celui-ci c''est beaucoup de jets de dés, il existe plusieurs façons de procéder à ça :

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

- **Attaque** : Abîme l’arme, attaque un allié par accident, double le coût en {{chakra|chakra}}, l’attaque revient vers le joueur, etc …
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
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 303, 'guide', 'Règles avancées', 'Le Mode Hyper et le Mode Super', 'Texte', 'modifie', '## Qu’est-ce que c’est ?

Le **Mode Hyper** est un état de surpuissance, qui s’ouvre au **niveau 2** du personnage : sa magie l’envahit, son aura déferle et son corps change. L’activer ne demande aucun jet : c’est une action rapide (IC).

## Ce qu’il donne

Avec une seule magie, le personnage est immunisé à sa magie innée ; avec deux, il devient très résistant aux deux. Dans les deux cas :

| | Une magie | Deux magies |
| --- | --- | --- |
| Dégâts physiques | +15 | +15 |
| Dégâts de la magie | +15 | +7 |
| Soins magiques | +15 | +15 |
| Coût des sorts en chakra | 0 | 0 |

S’y ajoutent un effet propre à chaque magie et un autre propre à chaque race : voir [[Liste des effets mode hyper]].

## Ce qu’il coûte, et ses limites

- Les sorts ne coûtent plus de chakra, mais le Mode Hyper lui-même en brûle **10 % du maximum par tour**, et le chakra ne peut pas être récupéré tant qu’il dure (ni fiole, ni méditation, ni repos).
- Sans assez de chakra, le personnage peut quand même en dépenser : il paie ce qui manque avec sa santé, **2 points de santé pour 1 point de chakra** (en Mode Hyper ou non).
- Il dure au plus **le niveau global divisé par 2** en tours.
- Il ne s’utilise **qu’une fois par semaine** (dans le jeu), et une seule créature peut l’activer par combat, sauf exception (lieu saturé de chakra, objet magique, accord du MJ).
- On peut le prolonger au-delà de ces limites, mais le corps le paie une fois le mode relâché : résistances brisées, vulnérabilités accentuées, croix sur les caractéristiques, coma… et, à cinq tours de trop, une chance sur deux de mourir.

## Le Mode Hyper 100 %

Au **niveau 10**, le personnage peut renfermer son aura pour atteindre sa pleine puissance pendant **3 tours** : le chakra ne s’évapore plus, toutes les postures sont actives et sans inconvénients, chaque sort peut être surchargé (un dé de dégâts en plus) et toutes les attaques font +10 dégâts de plus. Ensuite, il revient au Mode Hyper normal en dépensant **75 % de son chakra maximum** ; s’il ne les a pas, il paie ce qui manque avec sa santé, comme toujours : **2 points de santé pour 1 point de chakra**.

## Le Mode Super

C’est un équivalent moins puissant du Mode Hyper : une symbiose, non pas avec soi-même, mais avec un **objet légendaire ou enchanté**. Il faut atteindre une parfaite harmonie avec l’objet, et le MJ en est seul juge. Il donne +10 aux dégâts physiques, plus un effet passif et un effet actif propres à l’objet. Il dure au plus le niveau global divisé par 2 en tours, revient au bout d’une semaine, et ne peut pas être prolongé ; il peut s’activer même si quelqu’un d’autre est déjà en Mode Hyper ou Super. Voir [[Liste des effets mode super]].', '> « Ne plus faire qu’un avec soi-même. »

Le **Mode Hyper** est un état de surpuissance, qui s’ouvre au **niveau 2** du personnage. Le personnage libère alors la puissance cachée en lui : sa magie ne fait plus qu’un avec lui, son aura magique déferle, et son apparence change profondément sous l’effet de la magie qui l’envahit.

## L’activer

- L’activer ne demande **aucun jet de dés** : c’est une action rapide, un *Instant Cast* (IC ; voir [[guide/le-tour-de-jeu|Le tour de jeu]]).
- Il ne s’active qu’**une fois par semaine**, dans le jeu : c’est un état qui épuise très vite le corps et l’esprit.
- Dans un même combat, **une seule créature** peut activer son Mode Hyper.

Cette dernière règle a ses exceptions :

- les lieux où le chakra est si présent que respirer suffit à récupérer tout son {{chakra|chakra}} : là, tout le monde peut activer son Mode Hyper, et sans même consommer de {{chakra|chakra}} ; mais la limite des 10 tours, elle, reste présente ;
- un objet magique qui permet de l’activer en même temps que quelqu’un d’autre (parmi les effets d’[accessoires](/ressources/equipement/#accessoires) : « Permet d’avoir son mode hyper en même temps qu’un autre ») ;
- l’accord du MJ, selon la situation.

Une météo lève aussi cette limite : sous le Crachin Blanc, le Mode Hyper n’est plus réservé à un seul être sur le terrain (voir [[guide/meteo|Météo]]).

## Ce qu’il donne

Avec une seule magie, le personnage devient **immunisé à sa magie innée** ; avec deux, il devient **très résistant à ses deux magies**. Dans les deux cas, tant que dure le Mode Hyper :

- ses dégâts physiques gagnent **+15** ;
- les dégâts de sa magie gagnent **+15** avec une seule magie, **+7** avec deux ;
- ses soins magiques gagnent **+15** ;
- ses sorts ne coûtent **plus de {{chakra|chakra}}**.

S’y ajoutent des effets propres au personnage :

- celui de **chacune de ses magies**, qui n’est pas le même selon qu’il a une seule magie ou deux : il est sur la page de chaque [magie](/magies/), sous « Capacité Mode Hyper » ;
- celui de **sa race** : il est sur la page de chaque [race](/races/), sous « Capacité Mode Hyper », avec son nom (l’Adrénaline de l’Humain, par exemple).

La page de chaque magie et de chaque race donne l’effet écrit dans son onglet. La [[guide/liste-des-effets-mode-hyper|Liste des effets mode hyper]] donne, elle, ceux du classeur du Mode Hyper, magie par magie et race par race ; les deux ne disent pas toujours la même chose.

## Ce qu’il coûte

- Le Mode Hyper se nourrit de {{chakra|chakra}} : il en brûle **10 % du maximum à chaque tour**.
- Tant qu’il dure, le {{chakra|chakra}} ne se récupère pas : ni fiole bleue (ni rien d’autre qui en redonne), ni méditation, ni repos.
- Il dure au plus **le niveau global divisé par 2**, en tours, même s’il reste du {{chakra|chakra}} en réserve. Un effet d’accessoire y ajoute un tour (pas au Mode Hyper 100 %).

*Exemple : un personnage de niveau 8, qui a 60 de {{chakra|chakra}} au maximum, en perd 6 à chaque tour de Mode Hyper, pendant 4 tours au plus ; ses sorts, eux, ne lui coûtent rien pendant ce temps.*

À court de {{chakra|chakra}}, en Mode Hyper ou non, on peut toujours en dépenser : chaque point qui manque se paie de **2 points de santé**.

## Au-delà des limites

On peut garder son Mode Hyper au-delà de ses limites, quand la réserve de {{chakra|chakra}} est épuisée ou que les tours sont passés. Mais le corps et l’esprit le paient, une fois le mode relâché. Selon le nombre de tours en trop :

1. **1 tour** : ses résistances magiques sont brisées pendant 24 h.
2. **2 tours** : ses vulnérabilités sont accentuées pendant 24 h (pour les magies de l’Arcane, de la Corruption et du Potentiel Illimité : 2 faiblesses aléatoires).
3. **3 tours** : 3 croix sur des caractéristiques tirées au hasard, pendant 24 h (une croix retire 20 % aux jets de sa caractéristique ; voir [[guide/reussir-une-action|Réussir une action]]).
4. **4 tours** : il tombe dans le coma, et perd toute sa santé (voir [[guide/blessures-et-etats|Blessures et états]]).
5. **5 tours** : le Mode Hyper se désactive, et il a une chance sur deux de mourir.

## Le Mode Hyper 100 %

Dès le **niveau 10**, le personnage peut aller plus loin. Il se concentre pour renfermer en lui l’aura qui déferle en Mode Hyper : une fois scellée dans son corps, sa puissance est à son comble. D’où le nom : il est à pleine puissance tant que l’aura reste enfouie. Pendant ce temps :

- le {{chakra|chakra}} ne s’évapore plus ;
- toutes les postures sont actives, et perdent leurs inconvénients (voir [[guide/les-postures|Les postures]]) ;
- chaque sort peut être surchargé, ce qui lui donne un dé de dégâts de plus ;
- toutes les attaques, physiques et magiques, font **+10 dégâts**, en plus de ceux du Mode Hyper.

Cet état ne dure que **3 tours**. Le personnage revient ensuite au Mode Hyper normal, et cela lui coûte **75 % de son {{chakra|chakra}} maximum**. S’il ne les a plus en réserve, il paie ce qui manque avec sa santé, comme toujours : **2 points de santé pour 1 point de {{chakra|chakra}}**.

*Exemple : avec 80 de {{chakra|chakra}} au maximum, sortir du Mode Hyper 100 % en coûte 60. S’il ne lui en reste que 40, les 20 qui manquent lui coûtent 40 points de santé.*

## Le Mode Super

> « Ne faire plus qu’un avec son objet. »

Le **Mode Super** est un équivalent moins puissant du Mode Hyper. Au lieu d’une symbiose avec soi-même, c’est une symbiose avec un **objet légendaire ou enchanté** : une arme, une armure ou autre. L’aura magique déferle de la même façon, et le personnage change, sous l’effet de sa magie mais aussi de l’objet et de son « concept ».

Pour y entrer, le porteur doit atteindre une parfaite harmonie avec son objet : le MJ en est seul juge.

Le Mode Super donne **+10 aux dégâts physiques**, plus un **effet passif** et un **effet actif** propres à l’objet : voir la [[guide/liste-des-effets-mode-super|Liste des effets mode super]], où certains objets n’ont pas d’effet écrit. Plusieurs de ces objets sont présentés dans le Codex : [[lore/les-outils-legendaires-uniques|Les Outils Légendaires, Uniques]].

Ses limites ressemblent à celles du Mode Hyper, avec quelques différences :

- il dure au plus **le niveau global divisé par 2**, en tours, et ne se prolonge jamais au-delà ;
- il faut attendre **une semaine** pour qu’il soit de nouveau disponible ;
- il peut s’activer même si quelqu’un d’autre est déjà en Mode Hyper ou en Mode Super ;
- le Mode Hyper et le Mode Super peuvent servir dans le même combat, mais pas en même temps.

## Sur la fiche du site

Sur la [fiche de personnage](/fiche/) du site, le Mode Hyper apparaît à côté des postures dès le niveau 2, avec ses effets de base, celui de chacune de vos magies et celui de votre race ; le Mode Hyper 100 % s’y ajoute au niveau 10. Ils y sont donnés pour lecture.

Le classeur des magies garde, dans un onglet masqué, une autre liste des effets du Mode Hyper, aux valeurs différentes ([[guide/mode-hyper-magie|Mode Hyper (Magie)]]) : cette liste ne compte pas, ce sont les valeurs données plus haut (+15, et +7 avec deux magies) qui valent.', 'neutre', NULL, 'page', '{"id":"guide/le-mode-hyper"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 304, 'guide', 'Règles avancées', 'Les situations avancées', 'Texte', 'modifie', '## La prise en tenaille

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

Cela arrive à tout le monde de rater des sorts, lors d’un échec d’un sort, la moitié du coût en {{chakra|chakra}} est quand même consommé. Si le nombre est impair, la règle de Maverick dit “toujours arrondi à l’inférieur”

**Cas particuliers :**

Lors d’un échec critique, la consommation de {{chakra|chakra}} est doublée par défaut, après concernant les autres conséquences négatives … à vous de voir ;)

## Mordhau ou Demi-épée

C''est un terme utilisé pour désigner une méthode de combat avec certaines armes de corps à corps (notamment les épées), qui consiste à prendre son arme par la lame et à taper avec le manche comme un sourd. Cela permet à certaines armes de pouvoir faire des dégâts de frappe alors qu''elles en sont incapables.

Bien entendu, cette technique avancée implique une prise de risque pour l''état de l''arme, utiliser une arme de cette façon fait que vous avez 30% de chance d''abîmer votre arme (lui faire perdre un cran de solidité).

*Exemple : Si vous faites plus de 70 dans votre jet d''attaque avec arme en mordhau, votre arme perd immédiatement un cran de solidité.*', 'neutre', NULL, 'page', '{"id":"guide/situations-avancees"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 305, 'guide', 'Règles avancées', 'Liste des altérations d''état', 'Texte', 'modifie', '## Aveuglement

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
| Impossible de se défendre et demande un tour complet pour le retirer.<br>Les coups portés sur lui seront automatiquement des coups critiques. |', '## Aveuglement

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
| -  Consomme  5% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure magique divisée par 2. | - Consomme 10% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure magique divisée par 3. | - Consomme 15% de la {{barriere}} Max<br>et du {{chakra}} Max (3 Tours)<br><br>- Armure Magique divisée par 4. |

**Résistances/Vulnérabilités**

- **Sensibilité** : Croix à l''Intel et à la Volonté
- **Grande vulnérabilité** : Résistance Magique annulées
- **Vulnérabilité** : 5% de {{barriere|barrière}} et de {{chakra|chakra}} en moins.
- **Résistances** : - 1 Tour
- **Grande résistance** : La {{barriere|barrière}} n''est pas impactée

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
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 306, 'guide', 'Règles avancées', 'Liste des effets mode hyper', 'Texte', 'modifie', '"Ne plus faire qu''un avec soi-même"

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

*Le classeur « Magie Maverick V8 » contient, dans un onglet masqué, une autre liste des effets du mode hyper (page « Mode Hyper (Magie) ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*', '"Ne plus faire qu''un avec soi-même"

## Qu''est-ce que c''est ?

Le Mode Hyper est un état de surpuissance qui se débloque au niveau 2 de personnage.

Il s''agit d''un état où le personnage libère sa puissance cachée en lui, sa magie ne fait plus qu''un avec lui, l''aura magique déferle et ses attributs physiques changent énormément vu que sa magie l''envahit.

Activer le mode hyper ne demande aucun jet de dés et est considéré comme un Instant Cast.

## Fonctionnement

Pendant le mode hyper, le {{chakra|chakra}} est utilisé comme carburant pour le mode hyper, il est consommé à raison de 10% du {{chakra}} max par tour. Cependant, il est impossible de consommer une fiole bleue (ou équivalent qui redonnerait du {{chakra|chakra}}), de faire une méditation ou bien de se reposer. Le {{chakra|chakra}} ne peut pas être régénéré pendant le mode hyper. Le mode hyper peut durer au maximum un nombre de tours équivalent au niveau global divisé par 2, même s''il reste du {{chakra|chakra}} en réserve. Le mode hyper est très épuisant pour le corps et l''esprit.<br>
Il est utilisé à raison de 1 fois toutes les semaines vu qu''on parle d''un état qui épuise très rapidement le corps.

## Au-delà des limites

Il est bien entendu possible de conserver son mode hyper même si la réserve de {{chakra|chakra}} est épuisée ou bien les tours passés, mais cela aura des conséquences sur le corps et l''esprit.

Maintenir le mode hyper au-delà des limites aura pour conséquence une fois le mode hyper relâché :

- 1 tour supplémentaire : Brise les résistances magiques pendant 24h.
- 2 tours supplémentaires : Accentue les vulnérabilités pendant 24h. (donne 2 faiblesses aléatoires pour les magies d''Arcane, Corruption et Potentiel illimité)
- 3 tours supplémentaires : 3 croix caractéristiques aléatoires pendant 24h.
- 4 tours supplémentaires : Tombe dans le coma avec perte complète de la santé.
- 5 tours supplémentaires : Mode hyper désactivé, 50% de chance de mourir.

Le Mode Hyper ne peut être enclenché qu''une fois toutes les semaines dans le jeu, et qu''une seule créature sur le terrain ne peut activer son mode hyper pendant 1 combat, il existe des exceptions :

- Les zones où le chakra est tellement présent que le simple fait de respirer permet de récupérer la totalité de son {{chakra|chakra}}, ici tout le monde peut activer son mode hyper et cela sans consommer le {{chakra|chakra}}, mais la limite des 10 tours, elle, reste présente.
- Un objet magique qui permet d''activer son mode hyper en même temps que quelqu''un d''autre.
- Autorisation du MJ selon la situation.

## Mode Hyper 100%

Il s''agit d''un état plus puissant du Mode Hyper de base, dans cet état, le lanceur se concentre pour renfermer l''aura de chakra qui déferle en mode Hyper. Une fois scellée à l''intérieur de son corps, la puissance du lanceur est à son paroxysme.

L''appellation "100%" vient du fait que le lanceur est à pleine puissance tant que l''aura est enfouie en lui, ainsi de nouveaux bonus s''offrent à lui en 100% :

- Le {{chakra}} ne s''évapore plus.
- Toutes les postures sont activées et ne possèdent plus d''inconvénients.
- Tous les sorts peuvent être surchargés (leur donnant 1d de dégâts en plus)
- Toutes les attaques physiques et magiques infligent +10 dégâts en plus du mode hyper d''avant.

En revanche, l''état 100% ne peut pas être conservé éternellement, il ne dure que 3 tours et après le lanceur revient dans le Mode Hyper normal, consommant au passage 75% de son {{chakra}} Max (Prudence, si vous n''avez pas 75% de {{chakra}} courant en réserve, le manque sera pris dans les PV).

Le Mode Hyper 100% n''est disponible qu''au niveau 10 de personnage.

## Effets selon la magie ou le type

| Magie/Type | Mono magie | Bi magie |
| --- | --- | --- |
| Général | Immunité à la magie innée | Très résistant aux deux magies |
| Général | Dégâts de la magie +15 | Dégâts de la magie +7 |
| Général | Dégâts physiques +15 | Dégâts physiques +15 |
| Général | Soin magique +15 | Soin magique +15 |
| Général | Consommation de {{chakra\|chakra}} = 0 | Consommation de {{chakra\|chakra}} = 0 |
| Potentiel illimité | Dégâts physiques neutres, Résistance à la magie | Dégâts physiques neutres, Résistance à la magie |
| Sang | Permet de récupérer 10 sang par tour au lieu de 1. | Divise par 2 le coût en sang pour les sorts. |
| Arcane | Les sorts amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). | Chaque tour, une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |
| Corruption | Le {{chakra\|chakra}} active directement les effets secondaires | Divise par 2 le cout en {{corruption\|corruption}} des sorts. |
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
| Anansi | Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 {{barriere\|barrière}} à la cible \| Nécromancie= Inflige Poison 1 automatiquement \| Ombre = Réduit de 5 l''initiative de la cible touchée pour le prochain tour |
| Goleois | Augmente les dégâts de tous les alliés de 5, le temps du mode hyper. |

*Le classeur « Magie Maverick V8 » contient, dans un onglet masqué, une autre liste des effets du mode hyper (page « Mode Hyper (Magie) ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*', 'neutre', NULL, 'page', '{"id":"guide/liste-des-effets-mode-hyper"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 307, 'guide', 'Règles avancées', 'Liste des effets mode super', 'Texte', 'modifie', '"Ne faire plus qu''un avec son objet"

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
| Super gemme | Effet passif = Les dégâts de l''élément de la gemme augmentent de +10 au lieu de +7.<br>Effet actif = Permet de lancer un sort un cran au-dessus de la puissance magique actuelle pour un coût 50% plus cher (sort lvl 5 limité au mono magie) (1 fois/24h) | Le porteur fusionne avec la gemme temporairement pour exploiter sa pleine puissance. La super gemme sortira légèrement du dos de l''utilisateur. Les attributs physiques vont énormément changer et la chair va être temporairement de la même matière que la gemme à certains endroits. |', '"Ne faire plus qu''un avec son objet"

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
| Champicer | Effet passif = Les 10 premiers dégâts de chaque tour sont annulés.<br>Effet actif = Permet de lancer une infection qui va pomper 1d4/NPM santé et {{chakra\|chakra}} pendant 3 tours. (2 fois/combat) (non cumulable) | Le porteur va avoir des myriades de champignons sur tout le corps qui vont le protéger des premiers dégâts. |
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
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 308, 'guide', 'Règles avancées', 'Météo', 'Texte', 'modifie', '## Normal

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
- Les armures magiques ne fonctionnent pas (effets, AP et AM)', '## Normal

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
- {{chakra}} illimité
- Le mode hyper n''est plus limité à un être sur le terrain
- Divise la {{corruption|corruption}} par 2

## Pluie pétrole

**Description** : Une pluie de pétrole tombe du ciel, noire et épaisse, recouvrant tout d’une couche glissante , infligeant de la {{corruption|corruption}} à tout le monde.

**Effet(s)**

- Magie Corruption = +5 dégâts
- Toutes les autres magies = -3 dégâts
- Lors du premier tour de la météo uniquement = -25% de {{chakra|chakra}} pour tous ceux qui ne sont pas de la Corruption
- +2 {{corruption}} par tour

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
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 309, 'guide', 'Règles avancées', 'Mode Hyper (Magie)', 'Texte', 'modifie', '*Onglet masqué du classeur d''origine.*

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

*Commentaire joint à la cellule dans le classeur d''origine, marqué comme résolu.*', '*Onglet masqué du classeur d''origine.*

*Le classeur « Mode hyper et co » contient une autre liste des effets du mode hyper (page « Liste des effets mode hyper ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*

## Avantages de base

+10 Dégâts Physiques, +10 Soins, La consommation de {{chakra}} passe à 0

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
| Arcane + Eau | Boire l''eau produite par un utilisateur d''eau en Mode Hyper rend du {{chakra}} (3d6/niveau de magie) |
| Arcane + Glace | Une armure de glace pure de 8RM qui a 50% de renvoyer les sorts à l''envoyeur |
| Arcane + Terre | Une terre pure est invoquée et une plante carnivore y pousse |
| Arcane + Vent | Un vent pur et tranchant qui fait reculer les ennemis et inflige 2d8 de dégâts |
| Arcane + Foudre | Un orage pur s''abat sur les ennemis et inflige 3d6/par niveau de magie sur le {{chakra}}" |
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
| Eau + Lumière | Tous les alliés régénèrent 50% de leur {{barriere\|barrière}} |
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
| Foudre + Lumière | Supprime 50% de la {{barriere\|barrière}} des ennemis |
| Foudre + Ombre | Chaque attaque ponctionnera également le {{chakra\|chakra}} avec les mêmes dégâts |
| Lumière + Ombre | Invoque la météo Éclipse |

## Commentaire de cellule

- **Vide + Nécromancie** (cellule M43) : Sous cette forme, il est impossible de faire des dégâts physiques et seules les armes spectrales sont utilisables ainsi que les sorts.

*Commentaire joint à la cellule dans le classeur d''origine, marqué comme résolu.*', 'neutre', NULL, 'page', '{"id":"guide/mode-hyper-magie"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 310, 'guide', 'Règles avancées', 'Statistiques : Résistance Faiblesse', NULL, 'retire', 'Statistiques : Résistance Faiblesse', NULL, 'neutre', NULL, 'page', '{"id":"guide/statistiques-resistance-faiblesse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 311, 'codex', NULL, 'Glossaire', 'Texte', 'modifie', 'Ce glossaire réunit les termes techniques et spécifiques du système et univers Maverick. Il est destiné à faciliter la lecture et l''utilisation du jeu, en regroupant les définitions en un seul endroit.

***Acquis.*** Valeur de compétence bonus donné par tout ce qui n’a pas de rapport à la monter de niveau (classe, race, équipement, …)

***Altération d’état.*** État temporaire où le personnage subit des malus ou des dégâts.

***Ambassadeurs.*** Ce sont des créations directes des Dieux. Ils sont conçus pour incarner la volonté divine et représenter leur créateur auprès des mortels et du monde matériel.

***AM (Armure Magique).*** Valeur qui réduit les dégâts des sortilèges subis.

***AP (Armure Physique).*** Valeur qui réduit les dégâts des armes subis.

***Attributs.*** Liste des données basiques et primaires du personnage : santé, chakra, barrière, etc…

***Barrière (BA).*** Seconde barre de santé dont la valeur dépend du chakra. Prend les coups avant la santé sauf contre indication.

***Bestiaire.*** Liste de créatures officielles de l’univers.

***Caractéristiques.*** Valeur de base représentant les capacités innées d’un personnage (ex : Force, Agilité, Intelligence…). Elles influencent en partie le taux de réussite d’un jet.

***Chakra (CK).*** Énergie qui permet d’utiliser la magie et lancer des sorts, pas de chakra \= pas de sorts.

***Classe.*** Le rôle principal d’un personnage. Détermine ses capacités, son style de combat, ses armes et l’armure qu’il peut porter. Les personnages peuvent en avoir deux.

***Compétence.*** Spécialisation ou savoir-faire lié à une caractéristique. Utilisée pour les jets de dés

***Corruption**.* Énergie parasite qui envahi le lobe à chakra, peut entraîner la mort si surdose.

***Coût**.* Ressource nécessaire pour utiliser un sort (chakra, âme, etc…)

***Critique**.* Résultat exceptionnel positif (1 \- 5\) ou négatif (96 \- 100\) sur le jet dés, pouvant entraîner de lourdes conséquences.

***Dégâts.*** Perte de points de santé ou barrière subie après une attaque.

***Dieu acquis.*** Divinité que le personnage choisit ou sert volontairement. Peut offrir des bonus ou une orientation magique.

***Dieu inné.*** Divinité naturellement liée au personnage dès sa naissance. Il est déterminé par sa magie innée.

***Don.*** **C**apacité spéciale donnée par une classe, une race ou alors par la force des évènements.

***Échelle de puissance.*** Classification indicative de la puissance d’un monstre.

***Effet secondaire.*** Conséquence secondaire d’un sort. Peut être positif ou négatif.

***Gardien.*** Le Gardien est une figure d’élite, choisie par un dieu ou un ambassadeur pour défendre et représenter son temple. Il est le plus haut grade parmi les croisés d’un temple.

***IC (action bonus).*** Instant Cast. Petite action rapide utilisable avant l’action principale. Maximum 3 différentes par tour.

***Initiative.*** Jet effectué en début de tour pour déterminer l’ordre d’action (D20 \+ modificateur selon l’agilité).

***Invocation.*** Appel magique d’une créature, ça peut être des golems ou des non-morts.

***Magie.*** Pouvoir surnaturel qui exploite le chakra pour permettre des prouesses comme lancer des sorts. La magie possède de nombreuses formes et chaque personnage va naître avec une magie.

***Mode Hyper.*** État de surpuissance qui se débloque au niveau 2 de personnage. Le personnage ne fait plus qu’un avec son être et libère sa vraie puissance.

***Nat (Naturel).*** Valeur de compétence qui représente le savoir faire du personnage, va de pair avec les caractéristiques pour déterminer les chances de réussir une action.

***NPM.*** Niveau de Puissance Magique.

***PO (portée).*** Distance minimum et maximale à laquelle un sort ou une action peut atteindre sa cible.

***Posture.*** Attitude de combat adoptée au début d’un tour. Influence les actions possibles, les bonus et les malus.

***Race.*** Origine biologique et culturelle d’un personnage. Influence ses attributs de départ, ses capacités raciales et son affinité magique.

***Réaction.*** Action spéciale réalisable en dehors de son tour. Déclenchée par une condition (ex : posture ou capacité de classe).

***Résistance / Faiblesse magique.*** Modificateur indiquant si une créature encaisse mieux (résistance) ou moins bien(faiblesse) un élément magique.

***Remède.*** Potion qui permet de soigner les altérations d’état.

***Ricken.*** Unité de monnaie utilisée dans l’univers de Maverick.

***Santé.*** Représente le nombre de dégâts que peut encaisser un personnage avant de tomber dans le coma. Si elle tombe à 0, le personnage est dans le coma et en danger de mort.

***Solidité.*** Valeur défensive d’un objet ou d’une armure. Détermine le nombre de mauvais coups qu’elle peut encaisser (ex : coup critique, coup de la part d’un adversaire très fort, etc…)

***Sprint.*** Action spéciale permettant de doubler son déplacement. Le sprint est considéré à partir du moment où la vitesse d’un personnage est dépassée.

***Super caverne.*** Caverne très grande en termes de superficie avec une hauteur au plafond significative. Lieu où on retrouve des forêts, des météos, un faux ciel.

***Temple.*** Lieu sacré dédié à une divinité. Fonctionne comme des nations indépendantes ou cité-état.

***Type (magie).*** Catégorie à laquelle appartient un sort (attaque, soin, entrave…)

***Type (dégâts arme).*** Type de dégâts que peuvent faire les armes : Taille, Estoc, Frappe.

***Vitesse.*** Nombre de cases qu’un personnage peut parcourir durant son tour de jeu. Déterminée par ses stats.

***Zone.*** Valeur qui détermine où le sort/attaque fait effet.', 'Ce glossaire réunit les termes techniques et spécifiques du système et univers Maverick. Il est destiné à faciliter la lecture et l''utilisation du jeu, en regroupant les définitions en un seul endroit.

***Acquis.*** Valeur de compétence bonus donné par tout ce qui n’a pas de rapport à la monter de niveau (classe, race, équipement, …)

***Altération d’état.*** État temporaire où le personnage subit des malus ou des dégâts.

***Ambassadeurs.*** Ce sont des créations directes des Dieux. Ils sont conçus pour incarner la volonté divine et représenter leur créateur auprès des mortels et du monde matériel.

***AM (Armure Magique).*** Valeur qui réduit les dégâts des sortilèges subis.

***AP (Armure Physique).*** Valeur qui réduit les dégâts des armes subis.

***Attributs.*** Liste des données basiques et primaires du personnage : santé, {{chakra|chakra}}, {{barriere|barrière}}, etc…

***{{barriere}} (BA).*** Seconde barre de santé dont la valeur dépend du {{chakra|chakra}}. Prend les coups avant la santé sauf contre indication.

***Bestiaire.*** Liste de créatures officielles de l’univers.

***Caractéristiques.*** Valeur de base représentant les capacités innées d’un personnage (ex : Force, Agilité, Intelligence…). Elles influencent en partie le taux de réussite d’un jet.

***{{chakra}} (CK).*** Énergie qui permet d’utiliser la magie et lancer des sorts, pas de {{chakra|chakra}} \= pas de sorts.

***Classe.*** Le rôle principal d’un personnage. Détermine ses capacités, son style de combat, ses armes et l’armure qu’il peut porter. Les personnages peuvent en avoir deux.

***Compétence.*** Spécialisation ou savoir-faire lié à une caractéristique. Utilisée pour les jets de dés

***{{corruption}}**.* Énergie parasite qui envahit le lobe à chakra, peut entraîner la mort si surdose.

***Coût**.* Ressource nécessaire pour utiliser un sort ({{chakra|chakra}}, âme, etc…)

***Critique**.* Résultat exceptionnel positif (1 \- 5\) ou négatif (96 \- 100\) sur le jet dés, pouvant entraîner de lourdes conséquences.

***Dégâts.*** Perte de points de santé ou {{barriere|barrière}} subie après une attaque.

***Dieu acquis.*** Divinité que le personnage choisit ou sert volontairement. Peut offrir des bonus ou une orientation magique.

***Dieu inné.*** Divinité naturellement liée au personnage dès sa naissance. Il est déterminé par sa magie innée.

***Don.*** **C**apacité spéciale donnée par une classe, une race ou alors par la force des évènements.

***Échelle de puissance.*** Classification indicative de la puissance d’un monstre.

***Effet secondaire.*** Conséquence secondaire d’un sort. Peut être positif ou négatif.

***Gardien.*** Le Gardien est une figure d’élite, choisie par un dieu ou un ambassadeur pour défendre et représenter son temple. Il est le plus haut grade parmi les croisés d’un temple.

***IC (action bonus).*** Instant Cast. Petite action rapide utilisable avant l’action principale. Maximum 3 différentes par tour.

***Initiative.*** Jet effectué en début de tour pour déterminer l’ordre d’action (D20 \+ modificateur selon l’agilité).

***Invocation.*** Appel magique d’une créature, ça peut être des golems ou des non-morts.

***Magie.*** Pouvoir surnaturel qui exploite le {{chakra|chakra}} pour permettre des prouesses comme lancer des sorts. La magie possède de nombreuses formes et chaque personnage va naître avec une magie.

***Mode Hyper.*** État de surpuissance qui se débloque au niveau 2 de personnage. Le personnage ne fait plus qu’un avec son être et libère sa vraie puissance.

***Nat (Naturel).*** Valeur de compétence qui représente le savoir faire du personnage, va de pair avec les caractéristiques pour déterminer les chances de réussir une action.

***NPM.*** Niveau de Puissance Magique.

***PO (portée).*** Distance minimum et maximale à laquelle un sort ou une action peut atteindre sa cible.

***Posture.*** Attitude de combat adoptée au début d’un tour. Influence les actions possibles, les bonus et les malus.

***Race.*** Origine biologique et culturelle d’un personnage. Influence ses attributs de départ, ses capacités raciales et son affinité magique.

***Réaction.*** Action spéciale réalisable en dehors de son tour. Déclenchée par une condition (ex : posture ou capacité de classe).

***Résistance / Faiblesse magique.*** Modificateur indiquant si une créature encaisse mieux (résistance) ou moins bien(faiblesse) un élément magique.

***Remède.*** Potion qui permet de soigner les altérations d’état.

***Ricken.*** Unité de monnaie utilisée dans l’univers de Maverick.

***Santé.*** Représente le nombre de dégâts que peut encaisser un personnage avant de tomber dans le coma. Si elle tombe à 0, le personnage est dans le coma et en danger de mort.

***Solidité.*** Valeur défensive d’un objet ou d’une armure. Détermine le nombre de mauvais coups qu’elle peut encaisser (ex : coup critique, coup de la part d’un adversaire très fort, etc…)

***Sprint.*** Action spéciale permettant de doubler son déplacement. Le sprint est considéré à partir du moment où la vitesse d’un personnage est dépassée.

***Super caverne.*** Caverne très grande en termes de superficie avec une hauteur au plafond significative. Lieu où on retrouve des forêts, des météos, un faux ciel.

***Temple.*** Lieu sacré dédié à une divinité. Fonctionne comme des nations indépendantes ou cité-état.

***Type (magie).*** Catégorie à laquelle appartient un sort (attaque, soin, entrave…)

***Type (dégâts arme).*** Type de dégâts que peuvent faire les armes : Taille, Estoc, Frappe.

***Vitesse.*** Nombre de cases qu’un personnage peut parcourir durant son tour de jeu. Déterminée par ses stats.

***Zone.*** Valeur qui détermine où le sort/attaque fait effet.', 'neutre', NULL, 'page', '{"id":"lore/glossaire"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 312, 'codex', NULL, 'Londolor', 'Texte', 'modifie', '## Présentation générale

Le Royaume Nain, ou Londolor, est une nation montagneuse divisée naturellement entre trois immensités rocheuses : l’Ouest, l’Est et le Centre. Les nains y dominent d’immenses citadelles souterraines, des tunnels qui serpentent dans la pierre depuis des millénaires, et d’anciennes mines si profondes qu’elles frôlent l’inconnu.

Si la nation est réputée pour sa technologie avancée, ses forges légendaires et ses métaux rares, elle est aussi minée par une tension ancestrale entre l’Ouest et l’Est. Seule la royauté, fondée sur un lignage calculé et rigoureusement maintenu, est parvenue au fil des ères à unir ces deux pôles. Les minotaures, libérés du joug elfique noir par les nains, constituent aujourd’hui un pilier de la société, reconnus, intégrés et pleinement citoyens.

## Informations officielles

* **Population totale :** environ 600 000 habitants
* **Capitale :** variable – se déplace entre l’Ouest et l’Est en fonction de l’équilibre politique
* **Groupes dominants :** Nains majoritaires, forte présence minotaure
* **Organisation :** Royaume à monarchie forte lorsque les deux pôles sont unis
* **Territoires officiels :**

  * Londolor Ouest
  * Londolor Est
  * Londolor Centre (territoire non-royal car trop dangereux)

## Histoire

Les nains ont bâti leur civilisation dans les entrailles de montagnes gigantesques, façonnant un empire souterrain où technologie, architecture et art de la forge se mêlent depuis des siècles. Pourtant, l’histoire de Londolor est marquée par des guerres internes répétées entre l’Ouest et l’Est, deux visions opposées de la société naine : l’une technocrate et démocrate, l’autre marchande et élitiste.

En l’an 200, lors d’une guerre contre les elfes noirs, les nains libèrent entièrement le peuple minotaure. Ce geste fondateur entraîne une alliance durable : les minotaures promettent leur force de travail et leur loyauté en échange de conditions de vie dignes et, surtout, d’une solution à leur stérilité. Après 160 années de recherches et d’efforts titanesques, les nains parviennent en l’an 360 à rendre les minotaures fertiles. Ce succès marque leur intégration totale dans la société naine.

La région centrale, surnommée la Ligne de Partage ou les Mille Mines, demeure l’un des lieux les plus dangereux du monde souterrain. Des chariots suspendus ont été déployés pour relier Est et Ouest, mais ces routes restent périlleuses, traversant des zones de maladies, d’éboulements, de monstres et de bandes armées.

## Géographie et Environnement

Le Royaume de Londolor se développe au cœur d’une chaîne montagneuse colossale qui domine la région et qui constitue l’écrin naturel de la civilisation naine. Les terres sont divisées en trois zones distinctes : l’Ouest, le Centre et l’Est. L’Ouest est une région presque entièrement souterraine où les nains ont façonné un réseau tentaculaire de galeries, de salles titanesques et de cités enfouies. Le Centre, appelé la Ligne de Partage ou les Mille Mines, forme une zone de fractures brutales, d’abîmes et de cavernes instables où abondent créatures hostiles, maladies obscures et richesses minérales inestimables. Enfin, l’Est s’ouvre vers l’extérieur grâce à un immense port, offrant aux nains un accès privilégié aux routes maritimes.

Londolor est un royaume où la pierre et le métal dominent entièrement l’environnement. Les nains ont façonné des montagnes entières pour en extraire minerais rares, métaux précieux et gemmes profondes. Grâce au Gardien de la Terre, certaines zones souterraines ont été transformées en forêts et plaines capables de produire des cultures limitées, bien que ces dernières restent insuffisantes pour nourrir la totalité du peuple nain. L’atmosphère générale oscille entre paysages minéraux monumentaux, villes souterraines dont l’architecture défie la logique, et lieux dangereux où les couloirs s’effondrent, où les mines s’ouvrent sur l’inconnu, et où les monstres rodent dans l’obscurité.

## Société et Culture

La société naine repose sur des valeurs de travail, de tradition, d’héritage et de maîtrise technique. Les nains accordent une importance sacrée au savoir-faire artisanal, qu’il s’agisse de forge, de minage, de taille de pierre ou d’ingénierie mécanique. Les habitants de l’Ouest se définissent par leur austérité, leur discipline et leur attachement à la technocratie démocratique où le pouvoir circule par tirage au sort. Les habitants de l’Est, à l’inverse, sont marqués par la richesse, la flamboyance et une hiérarchie sociale dominée par les marchands et les magnats du commerce.

Depuis la libération du peuple minotaure et leur intégration progressive, la culture naine s’est profondément transformée. Les minotaures occupent désormais des postes officiels, militaires et artisanaux, devenant un pilier de la société de Londolor. Leur force physique et leur sens de l’honneur ont renforcé les traditions guerrières naines et enrichi les lignages du royaume.

Bien que la culture naine puisse sembler rigide, elle se révèle étonnamment adaptable. Les nains cultivent un sens profond de l''humour grinçant, une fierté inébranlable et un goût pour les défis, que ce soit dans la forge, l’exploration ou la guerre. Chaque clan, chaque famille et chaque cité conserve ses propres coutumes, chants, concours d’artisanat et rites dédiés au travail bien fait. La bière et les tavernes occupent également une place centrale dans la vie sociale, particulièrement à l’Ouest où la production de houblon est l’une des rares activités agricoles majeures.

## Organisation Politique

La structure politique de Londolor est particulière, car elle dépend de l’équilibre entre l’Ouest et l’Est. Lorsque le royaume est uni, il est dirigé par une monarchie forte fondée sur un lignage strictement défini et calculé, garantissant la stabilité entre les deux pôles. Cette unité n’est jamais acquise et repose sur la capacité de la royauté à maintenir la cohésion entre deux systèmes politiques radicalement opposés.

Londolor Ouest fonctionne comme une technocratie démocrate. Le pouvoir y est exercé par un conseil populaire renouvelé chaque mois par tirage au sort, garantissant une rotation permanente des responsabilités. Cette organisation confère une grande stabilité interne, car elle repose sur l’idée que chaque citoyen doit contribuer à la gestion collective.

Londolor Est adopte un fonctionnement très différent : un système oligarchique dominé par les riches familles marchandes. Le pouvoir économique y dicte la politique, et la réussite matérielle est considérée comme la preuve de la compétence et de la valeur d’un individu. L’influence de l’Est sur le commerce international, notamment via son gigantesque port, renforce ce modèle inégalitaire.

Quant à Londolor Centre, la région ne possède pas de gouvernement propre. C’est un territoire semi-sauvage où seules quelques villes survivent, fortifiées contre l''extérieur. Elles servent principalement de points relais entre Ouest et Est, assurant une continuité vitale mais fragile.

## Religion

La religion naine se distingue par sa sobriété et son pragmatisme. Les nains ne sont pas un peuple particulièrement spirituel, mais leur magie innée limitée à quatre domaines — Foudre, Feu, Arcane et Terre — a orienté leur dévotion vers les divinités qui incarnent ces mêmes forces. Ces quatre dieux occupent une place essentielle dans leur vie quotidienne, chacun correspondant à un pan fondamental de la culture de Londolor.

**Volt, dieu de la Foudre**, est de loin la divinité la plus vénérée par les nains. Son apparence naine renforce l’attachement du peuple à ce dieu qui incarne l’ingénierie, l’énergie, l’invention et la magie technologique. Il représente la puissance créative et l’étincelle qui ranime la forge ou donne souffle aux machines.

**Séraphin, dieu du Feu**, est révéré comme le Seigneur de la Forge. Les forgerons, armuriers et artisans du métal placent leurs prières en lui, espérant que sa chaleur sacrée leur confère un talent inégalé. Le feu, pour les nains, est un symbole de transformation, de discipline et de création.

**Mirada, déesse de l’Arcane**, est connue parmi les nains sous le nom de Dame Bâtisseuse. Elle incarne la fertilité, la magie constructive, la créativité et l’ingéniosité féminine. Les architectes, ingénieurs, inventeurs et maîtres des runes voient en elle la source de leur inspiration.

**Dimitri, dieu de la Terre**, est honoré comme le Père des Montagnes. Il symbolise la stabilité, la force, la résilience et la protection du sol. Les nains reconnaissent en lui celui qui a permis l’existence des forêts souterraines et qui bénit leurs mines.

Cette quadrilogie divine structure toute la spiritualité naine. Bien que les nains ne se tournent vers les dieux que dans les moments importants ou rituels, leur respect pour ces quatre forces est indiscutable et profondément enraciné dans leurs traditions.

## Économie et ressources

**Ouest :**

* Richesse minérale immense
* Métaux rares (mythril, vif-argent, maverium)
* Alliages industriels perfectionnés
* Exportation de bière naine réputée mondialement

**Est :**

* Mines profondes, dont un immense gisement d’or découvert en l’an 14
* Grand port international
* Forte activité commerciale
* Exploitation minière intensive

**Centre :**

* Trésors anciens
* Mines abandonnées ou maudites
* Risques constants
* Lieu prisé par les chasseurs de trésors, mais qui deviennent souvent leur tombeau. ainsi alimentant les trésors dans une sorte de boucle infinie.

## Villes majeures

### Londolor Ouest

**Krönen-Phiesfburg**\
C''est la plus grosse ville des nains de l’ouest, c’est là où se trouve toutes les merveilles technologiques qu’ils ont réussi à faire. C’est une ville très tentaculaire qui possède de nombreuses galeries et de très grandes salles qui représente la fierté des nains de l’ouest de faire les choses en grand malgré leur petite taille.

**Pasedenburg**\
La deuxième plus grosse ville des nains de l’ouest mais aussi nommée la ville verte car c’est où se trouve le plus de ferme. On y cultive notamment du houblon pour y faire la fameuse bière naine. Les cultures ont pu augmenter notamment grâce à lrich Bruckmann (Gardien de la Terre) qui a mis au point les forêts souterraines pour la ville. Mais ça reste insuffisant pour nourrir tout le monde.

**Greizau**\
La ville-forge des nains de l’ouest, cette ville est proche des profondeur d’un volcan, la lave est exploité pour pouvoir raffiné tous les minerais en lingot utilisable. Cette façon de faire industriel permet de fabriquer une quantité conséquente d’alliage. C’est également là bas qu’on retrouve des infrastructures assez avancées pour y raffiner les minerais les plus rares comme le mythril, le vif argent et le maverium.

### Londolor Est

**Düsselbol**\
C''est la plus grosse ville des nains de l’est, c’est la ville qui représente l’avidité d’une partie des nains. C’est une merveille d’architecture et particulièrement opulent dans son décor, il montre bien la richesse de l’est des montagnes. Il y a une vraie séparation de la population entre ceux qui ont de l’argent et ceux qui en ont pas assez pour prétendre à une classe sociale forte.

**Neuberk**\
La deuxième plus grosse ville des nains de l’est mais aussi l’un des plus gros ports au monde. C’est en grande partie ce qui explique leur grande richesse, devenir un point de passage pour ceux qui font des longs voyages en bâteau entre l’ouest et l’est. Situé au nord des montagnes de l’est, nombreux sont les bâteau qui ont besoin d’aller sur place pour le ravitaillement, ayant flairé une occasion en or, vous pouvez trouver quasiment tout les services et marchandise pour votre bâteau, il suffit de payer un peu d’or pour y rester quelques jours et vous pourrez repartir dans de bonnes conditions.

**Löffin**\
La ville-mine des nains de l’est, c’est ici qu’ils récoltent une grosse partie de leur minerais qui fait en partie leur richesse. Mais certaines galeries sont trop profondes et ont débouché sur le centre qui est rempli de danger, nombreuses sont les mines condamnées car trop dangereuses.

C’est en l’an 14 qu’ils découvrent un grand gisement d’or qui va leur permettre d’augmenter encore plus leur richesse, le jour de la découverte de ce gisement, la royauté avait associé les nains de l’est et de l’ouest pour y creuser le plus efficacement possible.

### Londolor Centre

**Wand**\
La plus grosse ville de Londolor centre, un lieu de calme dans le danger que représente la Ligne de partage. Ses immenses murailles et ses formidables défenses font de cette ville une forteresse quasiment imprenable. Les monstres attaquent toujours la ville dans l’espoir de détruire les habitants mais ils résistent toujours.

**Schwimmende Insel**\
Seconde grosse ville de la Ligne de partage et située au sud, cette ville est connue pour être sur une île qui flotte au-dessus d’un véritable abîme sans fin, que l’on nomme l’*abysse de la surface*. Cette île flottait naturellement mais avec le poids de la ville il a fallu trouver une solution pour qu’elle ne tombe pas, les habitants sur place ont trouvé une solution qui est toujours un secret aujourd’hui.

**Barrière**\
La troisième grosse ville de la Ligne de partage et située au nord des montagnes, cette ville est réputée pour avoir un immense dôme de protection qui empêche les monstres d’approcher. Ce dernier rappelle énormément le principe de la barrière. Grâce à cette protection, ils n’ont pas de mur d’enceinte, juste une douve.

## Armée

* Armée robuste, parfaitement adaptée à la défense et aux combats souterrains.
* Armée naine hautement équipée technologiquement.
* Régiment d’élite minotaure, réputé pour sa force brutale et son courage.
* Défenses souterraines complexes, tunnels fortifiés, portes solides.
* Corps de défense spécialisés dans les mines et les galeries profondes.
* Les golems fabriqués par les nains qui servent d’outils militaires mais aussi pour les mines : On retrouve en majorité les golems de fer, foudre, mine et argile.
* Ouest : Armée fondée sur le civisme militaire.
* Est : Armée financée par les guildes et riches, souvent cosmopolite.
* Il existe un régiment spécial, le seul accord qui a su tenir avec le temps entre l’Ouest et l’Est, qui lui a pour rôle de contenir la brume noire et les créatures qui tentent de sortir de Londolor Centre. Ce régiment est en contact avec les 3 grosses villes de Londolor Centre et les aide en cas de besoin.

## Diplomatie

* Londolor Ouest
  * Bonnes relations avec les nations humaines, avec lesquelles il mène un commerce régulier et souvent équitable.
  * Tensions vives avec les nations elfiques, sans pour autant entraîner de guerre ouverte
  * Engagé dans une guerre totale contre les elfes noirs dans les sous-sols du monde, qu’il considère comme une menace ancestrale.

* Londolor Est
  * Adopte une approche diplomatique bien plus agressive.
  * Commerce avec les humains, marqué par des stratégies commerciales dures, parfois considérées comme prédatrices.
  * Avec les elfes forestiers, les échanges sont nombreux mais toujours perçus comme injustes par ces derniers, tant les marchands nains imposent leurs conditions.
  * A conclu un accord commercial solide avec l’Empire Argenté, devenant un fournisseur privilégié des elfes argentés.
  * Il est également en guerre contre la nation humaine de Xendown pour la possession de territoires stratégiques.
  * Avec les autres peuples, les relations restent neutres, mais souvent teintées d’opportunisme.

## Problèmes internes

* Guerre froide permanente entre Ouest et Est.
* Menace d’une dépendance alimentaire constante.
* Déstabilisation des mines de Londolor Centre.
* Menaces constantes de monstres et abominations.
* Inégalités sociales extrêmes dans l’Est.
* Risque de guerre civile si la royauté faiblit.

## Éléments remarquables

* L’intégration unique et historique du peuple minotaure.
* Les chariots suspendus traversant la Ligne de Partage.
* Greizau, l’une des plus grandes forges du monde.
* Schwimmende Insel, la ville flottante au-dessus de l’Abysse de la Surface.
* La découverte de l’or en l’an 14, tournant économique majeur.
* La technocratie démocrate de l’Ouest : unique au monde.', '## Présentation générale

Le Royaume Nain, ou Londolor, est une nation montagneuse divisée naturellement entre trois immensités rocheuses : l’Ouest, l’Est et le Centre. Les nains y dominent d’immenses citadelles souterraines, des tunnels qui serpentent dans la pierre depuis des millénaires, et d’anciennes mines si profondes qu’elles frôlent l’inconnu.

Si la nation est réputée pour sa technologie avancée, ses forges légendaires et ses métaux rares, elle est aussi minée par une tension ancestrale entre l’Ouest et l’Est. Seule la royauté, fondée sur un lignage calculé et rigoureusement maintenu, est parvenue au fil des ères à unir ces deux pôles. Les minotaures, libérés du joug elfique noir par les nains, constituent aujourd’hui un pilier de la société, reconnus, intégrés et pleinement citoyens.

## Informations officielles

* **Population totale :** environ 600 000 habitants
* **Capitale :** variable – se déplace entre l’Ouest et l’Est en fonction de l’équilibre politique
* **Groupes dominants :** Nains majoritaires, forte présence minotaure
* **Organisation :** Royaume à monarchie forte lorsque les deux pôles sont unis
* **Territoires officiels :**

  * Londolor Ouest
  * Londolor Est
  * Londolor Centre (territoire non-royal car trop dangereux)

## Histoire

Les nains ont bâti leur civilisation dans les entrailles de montagnes gigantesques, façonnant un empire souterrain où technologie, architecture et art de la forge se mêlent depuis des siècles. Pourtant, l’histoire de Londolor est marquée par des guerres internes répétées entre l’Ouest et l’Est, deux visions opposées de la société naine : l’une technocrate et démocrate, l’autre marchande et élitiste.

En l’an 200, lors d’une guerre contre les elfes noirs, les nains libèrent entièrement le peuple minotaure. Ce geste fondateur entraîne une alliance durable : les minotaures promettent leur force de travail et leur loyauté en échange de conditions de vie dignes et, surtout, d’une solution à leur stérilité. Après 160 années de recherches et d’efforts titanesques, les nains parviennent en l’an 360 à rendre les minotaures fertiles. Ce succès marque leur intégration totale dans la société naine.

La région centrale, surnommée la Ligne de Partage ou les Mille Mines, demeure l’un des lieux les plus dangereux du monde souterrain. Des chariots suspendus ont été déployés pour relier Est et Ouest, mais ces routes restent périlleuses, traversant des zones de maladies, d’éboulements, de monstres et de bandes armées.

## Géographie et Environnement

Le Royaume de Londolor se développe au cœur d’une chaîne montagneuse colossale qui domine la région et qui constitue l’écrin naturel de la civilisation naine. Les terres sont divisées en trois zones distinctes : l’Ouest, le Centre et l’Est. L’Ouest est une région presque entièrement souterraine où les nains ont façonné un réseau tentaculaire de galeries, de salles titanesques et de cités enfouies. Le Centre, appelé la Ligne de Partage ou les Mille Mines, forme une zone de fractures brutales, d’abîmes et de cavernes instables où abondent créatures hostiles, maladies obscures et richesses minérales inestimables. Enfin, l’Est s’ouvre vers l’extérieur grâce à un immense port, offrant aux nains un accès privilégié aux routes maritimes.

Londolor est un royaume où la pierre et le métal dominent entièrement l’environnement. Les nains ont façonné des montagnes entières pour en extraire minerais rares, métaux précieux et gemmes profondes. Grâce au Gardien de la Terre, certaines zones souterraines ont été transformées en forêts et plaines capables de produire des cultures limitées, bien que ces dernières restent insuffisantes pour nourrir la totalité du peuple nain. L’atmosphère générale oscille entre paysages minéraux monumentaux, villes souterraines dont l’architecture défie la logique, et lieux dangereux où les couloirs s’effondrent, où les mines s’ouvrent sur l’inconnu, et où les monstres rodent dans l’obscurité.

## Société et Culture

La société naine repose sur des valeurs de travail, de tradition, d’héritage et de maîtrise technique. Les nains accordent une importance sacrée au savoir-faire artisanal, qu’il s’agisse de forge, de minage, de taille de pierre ou d’ingénierie mécanique. Les habitants de l’Ouest se définissent par leur austérité, leur discipline et leur attachement à la technocratie démocratique où le pouvoir circule par tirage au sort. Les habitants de l’Est, à l’inverse, sont marqués par la richesse, la flamboyance et une hiérarchie sociale dominée par les marchands et les magnats du commerce.

Depuis la libération du peuple minotaure et leur intégration progressive, la culture naine s’est profondément transformée. Les minotaures occupent désormais des postes officiels, militaires et artisanaux, devenant un pilier de la société de Londolor. Leur force physique et leur sens de l’honneur ont renforcé les traditions guerrières naines et enrichi les lignages du royaume.

Bien que la culture naine puisse sembler rigide, elle se révèle étonnamment adaptable. Les nains cultivent un sens profond de l''humour grinçant, une fierté inébranlable et un goût pour les défis, que ce soit dans la forge, l’exploration ou la guerre. Chaque clan, chaque famille et chaque cité conserve ses propres coutumes, chants, concours d’artisanat et rites dédiés au travail bien fait. La bière et les tavernes occupent également une place centrale dans la vie sociale, particulièrement à l’Ouest où la production de houblon est l’une des rares activités agricoles majeures.

## Organisation Politique

La structure politique de Londolor est particulière, car elle dépend de l’équilibre entre l’Ouest et l’Est. Lorsque le royaume est uni, il est dirigé par une monarchie forte fondée sur un lignage strictement défini et calculé, garantissant la stabilité entre les deux pôles. Cette unité n’est jamais acquise et repose sur la capacité de la royauté à maintenir la cohésion entre deux systèmes politiques radicalement opposés.

Londolor Ouest fonctionne comme une technocratie démocrate. Le pouvoir y est exercé par un conseil populaire renouvelé chaque mois par tirage au sort, garantissant une rotation permanente des responsabilités. Cette organisation confère une grande stabilité interne, car elle repose sur l’idée que chaque citoyen doit contribuer à la gestion collective.

Londolor Est adopte un fonctionnement très différent : un système oligarchique dominé par les riches familles marchandes. Le pouvoir économique y dicte la politique, et la réussite matérielle est considérée comme la preuve de la compétence et de la valeur d’un individu. L’influence de l’Est sur le commerce international, notamment via son gigantesque port, renforce ce modèle inégalitaire.

Quant à Londolor Centre, la région ne possède pas de gouvernement propre. C’est un territoire semi-sauvage où seules quelques villes survivent, fortifiées contre l''extérieur. Elles servent principalement de points relais entre Ouest et Est, assurant une continuité vitale mais fragile.

## Religion

La religion naine se distingue par sa sobriété et son pragmatisme. Les nains ne sont pas un peuple particulièrement spirituel, mais leur magie innée limitée à quatre domaines — Foudre, Feu, Arcane et Terre — a orienté leur dévotion vers les divinités qui incarnent ces mêmes forces. Ces quatre dieux occupent une place essentielle dans leur vie quotidienne, chacun correspondant à un pan fondamental de la culture de Londolor.

**Volt, dieu de la Foudre**, est de loin la divinité la plus vénérée par les nains. Son apparence naine renforce l’attachement du peuple à ce dieu qui incarne l’ingénierie, l’énergie, l’invention et la magie technologique. Il représente la puissance créative et l’étincelle qui ranime la forge ou donne souffle aux machines.

**Séraphin, dieu du Feu**, est révéré comme le Seigneur de la Forge. Les forgerons, armuriers et artisans du métal placent leurs prières en lui, espérant que sa chaleur sacrée leur confère un talent inégalé. Le feu, pour les nains, est un symbole de transformation, de discipline et de création.

**Mirada, déesse de l’Arcane**, est connue parmi les nains sous le nom de Dame Bâtisseuse. Elle incarne la fertilité, la magie constructive, la créativité et l’ingéniosité féminine. Les architectes, ingénieurs, inventeurs et maîtres des runes voient en elle la source de leur inspiration.

**Dimitri, dieu de la Terre**, est honoré comme le Père des Montagnes. Il symbolise la stabilité, la force, la résilience et la protection du sol. Les nains reconnaissent en lui celui qui a permis l’existence des forêts souterraines et qui bénit leurs mines.

Cette quadrilogie divine structure toute la spiritualité naine. Bien que les nains ne se tournent vers les dieux que dans les moments importants ou rituels, leur respect pour ces quatre forces est indiscutable et profondément enraciné dans leurs traditions.

## Économie et ressources

**Ouest :**

* Richesse minérale immense
* Métaux rares (mythril, vif-argent, maverium)
* Alliages industriels perfectionnés
* Exportation de bière naine réputée mondialement

**Est :**

* Mines profondes, dont un immense gisement d’or découvert en l’an 14
* Grand port international
* Forte activité commerciale
* Exploitation minière intensive

**Centre :**

* Trésors anciens
* Mines abandonnées ou maudites
* Risques constants
* Lieu prisé par les chasseurs de trésors, mais qui deviennent souvent leur tombeau. ainsi alimentant les trésors dans une sorte de boucle infinie.

## Villes majeures

### Londolor Ouest

**Krönen-Phiesfburg**\
C''est la plus grosse ville des nains de l’ouest, c’est là où se trouve toutes les merveilles technologiques qu’ils ont réussi à faire. C’est une ville très tentaculaire qui possède de nombreuses galeries et de très grandes salles qui représente la fierté des nains de l’ouest de faire les choses en grand malgré leur petite taille.

**Pasedenburg**\
La deuxième plus grosse ville des nains de l’ouest mais aussi nommée la ville verte car c’est où se trouve le plus de ferme. On y cultive notamment du houblon pour y faire la fameuse bière naine. Les cultures ont pu augmenter notamment grâce à lrich Bruckmann (Gardien de la Terre) qui a mis au point les forêts souterraines pour la ville. Mais ça reste insuffisant pour nourrir tout le monde.

**Greizau**\
La ville-forge des nains de l’ouest, cette ville est proche des profondeur d’un volcan, la lave est exploité pour pouvoir raffiné tous les minerais en lingot utilisable. Cette façon de faire industriel permet de fabriquer une quantité conséquente d’alliage. C’est également là bas qu’on retrouve des infrastructures assez avancées pour y raffiner les minerais les plus rares comme le mythril, le vif argent et le maverium.

### Londolor Est

**Düsselbol**\
C''est la plus grosse ville des nains de l’est, c’est la ville qui représente l’avidité d’une partie des nains. C’est une merveille d’architecture et particulièrement opulent dans son décor, il montre bien la richesse de l’est des montagnes. Il y a une vraie séparation de la population entre ceux qui ont de l’argent et ceux qui en ont pas assez pour prétendre à une classe sociale forte.

**Neuberk**\
La deuxième plus grosse ville des nains de l’est mais aussi l’un des plus gros ports au monde. C’est en grande partie ce qui explique leur grande richesse, devenir un point de passage pour ceux qui font des longs voyages en bâteau entre l’ouest et l’est. Situé au nord des montagnes de l’est, nombreux sont les bâteau qui ont besoin d’aller sur place pour le ravitaillement, ayant flairé une occasion en or, vous pouvez trouver quasiment tout les services et marchandise pour votre bâteau, il suffit de payer un peu d’or pour y rester quelques jours et vous pourrez repartir dans de bonnes conditions.

**Löffin**\
La ville-mine des nains de l’est, c’est ici qu’ils récoltent une grosse partie de leur minerais qui fait en partie leur richesse. Mais certaines galeries sont trop profondes et ont débouché sur le centre qui est rempli de danger, nombreuses sont les mines condamnées car trop dangereuses.

C’est en l’an 14 qu’ils découvrent un grand gisement d’or qui va leur permettre d’augmenter encore plus leur richesse, le jour de la découverte de ce gisement, la royauté avait associé les nains de l’est et de l’ouest pour y creuser le plus efficacement possible.

### Londolor Centre

**Wand**\
La plus grosse ville de Londolor centre, un lieu de calme dans le danger que représente la Ligne de partage. Ses immenses murailles et ses formidables défenses font de cette ville une forteresse quasiment imprenable. Les monstres attaquent toujours la ville dans l’espoir de détruire les habitants mais ils résistent toujours.

**Schwimmende Insel**\
Seconde grosse ville de la Ligne de partage et située au sud, cette ville est connue pour être sur une île qui flotte au-dessus d’un véritable abîme sans fin, que l’on nomme l’*abysse de la surface*. Cette île flottait naturellement mais avec le poids de la ville il a fallu trouver une solution pour qu’elle ne tombe pas, les habitants sur place ont trouvé une solution qui est toujours un secret aujourd’hui.

**Barrière**\
La troisième grosse ville de la Ligne de partage et située au nord des montagnes, cette ville est réputée pour avoir un immense dôme de protection qui empêche les monstres d’approcher. Ce dernier rappelle énormément le principe de la {{barriere|barrière}}. Grâce à cette protection, ils n’ont pas de mur d’enceinte, juste une douve.

## Armée

* Armée robuste, parfaitement adaptée à la défense et aux combats souterrains.
* Armée naine hautement équipée technologiquement.
* Régiment d’élite minotaure, réputé pour sa force brutale et son courage.
* Défenses souterraines complexes, tunnels fortifiés, portes solides.
* Corps de défense spécialisés dans les mines et les galeries profondes.
* Les golems fabriqués par les nains qui servent d’outils militaires mais aussi pour les mines : On retrouve en majorité les golems de fer, foudre, mine et argile.
* Ouest : Armée fondée sur le civisme militaire.
* Est : Armée financée par les guildes et riches, souvent cosmopolite.
* Il existe un régiment spécial, le seul accord qui a su tenir avec le temps entre l’Ouest et l’Est, qui lui a pour rôle de contenir la brume noire et les créatures qui tentent de sortir de Londolor Centre. Ce régiment est en contact avec les 3 grosses villes de Londolor Centre et les aide en cas de besoin.

## Diplomatie

* Londolor Ouest
  * Bonnes relations avec les nations humaines, avec lesquelles il mène un commerce régulier et souvent équitable.
  * Tensions vives avec les nations elfiques, sans pour autant entraîner de guerre ouverte
  * Engagé dans une guerre totale contre les elfes noirs dans les sous-sols du monde, qu’il considère comme une menace ancestrale.

* Londolor Est
  * Adopte une approche diplomatique bien plus agressive.
  * Commerce avec les humains, marqué par des stratégies commerciales dures, parfois considérées comme prédatrices.
  * Avec les elfes forestiers, les échanges sont nombreux mais toujours perçus comme injustes par ces derniers, tant les marchands nains imposent leurs conditions.
  * A conclu un accord commercial solide avec l’Empire Argenté, devenant un fournisseur privilégié des elfes argentés.
  * Il est également en guerre contre la nation humaine de Xendown pour la possession de territoires stratégiques.
  * Avec les autres peuples, les relations restent neutres, mais souvent teintées d’opportunisme.

## Problèmes internes

* Guerre froide permanente entre Ouest et Est.
* Menace d’une dépendance alimentaire constante.
* Déstabilisation des mines de Londolor Centre.
* Menaces constantes de monstres et abominations.
* Inégalités sociales extrêmes dans l’Est.
* Risque de guerre civile si la royauté faiblit.

## Éléments remarquables

* L’intégration unique et historique du peuple minotaure.
* Les chariots suspendus traversant la Ligne de Partage.
* Greizau, l’une des plus grandes forges du monde.
* Schwimmende Insel, la ville flottante au-dessus de l’Abysse de la Surface.
* La découverte de l’or en l’an 14, tournant économique majeur.
* La technocratie démocrate de l’Ouest : unique au monde.', 'neutre', NULL, 'page', '{"id":"lore/londolor"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 313, 'codex', NULL, 'Mirada', 'Texte', 'modifie', '*Déesse primordiale du chakra*

Une ravissante elfe dorée qui est à l''origine du chakra tel qu''on le connaît aujourd''hui. Après les élémentaires, le chakra existait toujours mais sous une forme trop chaotique et dangereuse, la déesse est arrivée pour façonner le chakra sous une forme exploitable pour tous. Elle est la base de la magie de l''Arcane et indirectement de la Corruption.

## Présentation générale

Mirada est la personnification de la Magie elle-même — sa source, son flux et sa volonté. Créatrice du chakra sous sa forme exploitable, elle incarne l’esprit d’équilibre et de compréhension universelle. Son influence s’étend à tous ceux qui cherchent à maîtriser les arts mystiques ou à comprendre les lois cachées du monde. Les mortels la voient comme une divinité à la fois maternelle et insondable, bienveillante dans son savoir, mais dont la puissance dépasse toute compréhension humaine.

## Informations officielles

* **Titres :** La Grande Magicienne, La Reine Blanche, Le Grand Prisme
* **Thèmes :** Magie, Esprit, Chakra
* **Domaines :** Magie, Intelligence, Esprit
* **Alignement :** Chaotique neutre
* **Arme :** Bâton
* **Instrument de musique :** Harpe
* **Ambassadeur actuel :** Inconnu

## Histoire

Lors de la création primordiale, le chakra — essence brute de la magie — existait déjà, mais demeurait inaccessible aux êtres inférieurs car totalement chaotique et contrôlé par les élémentaires. Mirada, émue par la fragilité des formes de vie émergentes face aux titans qu’étaient les élémentaires, décida de remodeler cette énergie pour la rendre manipulable par tous les mortels.

Cette décision, guidée par la compassion et la curiosité, provoqua un profond désaccord avec Brock, dieu de la Force, qui voyait dans ce don un danger pour l’équilibre des races naissantes. Il jugeait que la puissance devait d’abord venir du corps avant l’esprit. Leur querelle s’étendit au-delà des cieux, opposant leurs fidèles dans des sortes de petits conflits partout dans le monde.

Malgré cette opposition, Mirada ne cessa jamais d’aimer ses “enfants”, considérant chaque utilisateur de magie comme un éclat du grand prisme qu’elle représente.

## Apparence

Mirada se manifeste sous la forme d’une Elfe dorée d’une beauté éclatante et d’une grâce sans égale. Son port est humble, ses gestes mesurés, et son regard empli d’une douceur tranquille. Contrairement à la plupart des elfes, souvent hautains, elle ne laisse transparaître aucune arrogance. Son corps mince et élancé est parcouru de cicatrices lumineuses, semblables à des tatouages, qui s’illuminent d’un blanc pur lorsque sa puissance magique s’accroît. Ses longs cheveux lisses tombent en cascade sur ses épaules, et son aura dégage une harmonie si parfaite que certains mortels prétendent entendre la musique des sphères lorsqu’elle se manifeste.

## Suivants

Mirada est vénérée par tous ceux qui cherchent la connaissance, la maîtrise ou la compréhension du chakra :

* **Professeurs et érudits**, qui enseignent la structure de la magie.
* **Mages et archimages**, qui honorent la source de tout ce que permet le chakra.
* **Utilisateurs du Potentiel illimité**, qui voient en elle la clef de leur ascension.
* **Utilisateurs de la magie de l’Arcane**, qui voient en elle leur mère spirituelle.

Ses fidèles considèrent la pratique magique comme un acte sacré et méditatif. Ils recherchent la perfection du contrôle, la symbiose entre l’esprit et le flux du monde.

## Outils divins

* **Le Tome Universel :** Permet à son porteur d’utiliser tout sort existant sans coût en chakra ni malus, en puisant directement dans la trame de la Magie pure. C’est l’un des artefacts les plus convoités par les mages du monde.', '*Déesse primordiale du chakra*

Une ravissante elfe dorée qui est à l''origine du chakra tel qu''on le connaît aujourd''hui. Après les élémentaires, le chakra existait toujours mais sous une forme trop chaotique et dangereuse, la déesse est arrivée pour façonner le chakra sous une forme exploitable pour tous. Elle est la base de la magie de l''Arcane et indirectement de la Corruption.

## Présentation générale

Mirada est la personnification de la Magie elle-même — sa source, son flux et sa volonté. Créatrice du chakra sous sa forme exploitable, elle incarne l’esprit d’équilibre et de compréhension universelle. Son influence s’étend à tous ceux qui cherchent à maîtriser les arts mystiques ou à comprendre les lois cachées du monde. Les mortels la voient comme une divinité à la fois maternelle et insondable, bienveillante dans son savoir, mais dont la puissance dépasse toute compréhension humaine.

## Informations officielles

* **Titres :** La Grande Magicienne, La Reine Blanche, Le Grand Prisme
* **Thèmes :** Magie, Esprit, Chakra
* **Domaines :** Magie, Intelligence, Esprit
* **Alignement :** Chaotique neutre
* **Arme :** Bâton
* **Instrument de musique :** Harpe
* **Ambassadeur actuel :** Inconnu

## Histoire

Lors de la création primordiale, le chakra — essence brute de la magie — existait déjà, mais demeurait inaccessible aux êtres inférieurs car totalement chaotique et contrôlé par les élémentaires. Mirada, émue par la fragilité des formes de vie émergentes face aux titans qu’étaient les élémentaires, décida de remodeler cette énergie pour la rendre manipulable par tous les mortels.

Cette décision, guidée par la compassion et la curiosité, provoqua un profond désaccord avec Brock, dieu de la Force, qui voyait dans ce don un danger pour l’équilibre des races naissantes. Il jugeait que la puissance devait d’abord venir du corps avant l’esprit. Leur querelle s’étendit au-delà des cieux, opposant leurs fidèles dans des sortes de petits conflits partout dans le monde.

Malgré cette opposition, Mirada ne cessa jamais d’aimer ses “enfants”, considérant chaque utilisateur de magie comme un éclat du grand prisme qu’elle représente.

## Apparence

Mirada se manifeste sous la forme d’une Elfe dorée d’une beauté éclatante et d’une grâce sans égale. Son port est humble, ses gestes mesurés, et son regard empli d’une douceur tranquille. Contrairement à la plupart des elfes, souvent hautains, elle ne laisse transparaître aucune arrogance. Son corps mince et élancé est parcouru de cicatrices lumineuses, semblables à des tatouages, qui s’illuminent d’un blanc pur lorsque sa puissance magique s’accroît. Ses longs cheveux lisses tombent en cascade sur ses épaules, et son aura dégage une harmonie si parfaite que certains mortels prétendent entendre la musique des sphères lorsqu’elle se manifeste.

## Suivants

Mirada est vénérée par tous ceux qui cherchent la connaissance, la maîtrise ou la compréhension du chakra :

* **Professeurs et érudits**, qui enseignent la structure de la magie.
* **Mages et archimages**, qui honorent la source de tout ce que permet le chakra.
* **Utilisateurs du Potentiel illimité**, qui voient en elle la clef de leur ascension.
* **Utilisateurs de la magie de l’Arcane**, qui voient en elle leur mère spirituelle.

Ses fidèles considèrent la pratique magique comme un acte sacré et méditatif. Ils recherchent la perfection du contrôle, la symbiose entre l’esprit et le flux du monde.

## Outils divins

* **Le Tome Universel :** Permet à son porteur d’utiliser tout sort existant sans coût en {{chakra|chakra}} ni malus, en puisant directement dans la trame de la Magie pure. C’est l’un des artefacts les plus convoités par les mages du monde.', 'neutre', NULL, 'page', '{"id":"lore/mirada"}', 'corps_md');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 314, 'bestiaire', 'Amblypyge noir', 'Amblypyge de corruption › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'L’Amplypyge de corruption est la forme la plus sublime de son espèce, il est capable de corrompre ses ennemis plus efficacement mais également d’affaiblir très lentement leur chakra et barrière.', 'L’Amplypyge de corruption est la forme la plus sublime de son espèce, il est capable de corrompre ses ennemis plus efficacement mais également d’affaiblir très lentement leur {{chakra|chakra}} et {{barriere|barrière}}.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/amblypyge-noir#carte:amblypyge-de-corruption","rang":10}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 315, 'bestiaire', 'Amblypyge noir', 'Amblypyge noir › butin 288-300 (Ennemi simple)', 'Butin possible', 'modifie', 'Inflige 10 corruption', 'Inflige 10 {{corruption|corruption}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"ennemi_simple","espece_id":"monstres/amblypyge-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 316, 'bestiaire', 'Amblypyge noir', 'Amblypyge noir › butin 288-300 (Mini-boss)', 'Butin possible', 'modifie', 'Inflige 20 corruption', 'Inflige 20 {{corruption|corruption}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"mini_boss","espece_id":"monstres/amblypyge-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 317, 'bestiaire', 'Amblypyge noir', 'Amblypyge noir › butin 288-300 (Boss)', 'Butin possible', 'modifie', 'Inflige 40 corruption', 'Inflige 40 {{corruption|corruption}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"boss","espece_id":"monstres/amblypyge-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 318, 'bestiaire', 'Blob blanc', 'Blob de l’Arcane › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce blob s’est imposé comme le chef des blobs argents, il possède un pêcher mature et ce dernier lui régénère lentement son chakra au fur et à mesure du temps.', 'Ce blob s’est imposé comme le chef des blobs argents, il possède un pêcher mature et ce dernier lui régénère lentement son {{chakra|chakra}} au fur et à mesure du temps.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/blob-blanc#carte:blob-de-larcane","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 319, 'bestiaire', 'Blob blanc', 'Blob blanc › butin 288-300 (Ennemi simple)', 'Butin possible', 'modifie', 'Bloque la régénération de chakra pour 1 tour', 'Bloque la régénération de {{chakra|chakra}} pour 1 tour', 'neutre', NULL, 'monstre_butin', '{"categorie":"ennemi_simple","espece_id":"monstres/blob-blanc","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 320, 'bestiaire', 'Blob blanc', 'Blob blanc › butin 288-300 (Mini-boss)', 'Butin possible', 'modifie', 'Bloque la régénération de chakra pour le prochain combat', 'Bloque la régénération de {{chakra|chakra}} pour le prochain combat', 'neutre', NULL, 'monstre_butin', '{"categorie":"mini_boss","espece_id":"monstres/blob-blanc","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 321, 'bestiaire', 'Blob blanc', 'Blob blanc › butin 288-300 (Boss)', 'Butin possible', 'modifie', 'Bloque la régénération de chakra pour 24h', 'Bloque la régénération de {{chakra|chakra}} pour 24h', 'neutre', NULL, 'monstre_butin', '{"categorie":"boss","espece_id":"monstres/blob-blanc","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 322, 'bestiaire', 'Blob bleu', 'Blob bleu', 'Description', 'modifie', 'Le Blob bleu est apprécié pour sa belle couleur, on le retrouve près des lacs ou de la mer. Sa chair bleue est indispensable pour la fiole bleue qui redonne chakra. Sa gelée est également un terrain idéal pour la pousse de certaines plantes liées à l’eau comme par exemple le prunier.', 'Le Blob bleu est apprécié pour sa belle couleur, on le retrouve près des lacs ou de la mer. Sa chair bleue est indispensable pour la fiole bleue qui redonne {{chakra|chakra}}. Sa gelée est également un terrain idéal pour la pousse de certaines plantes liées à l’eau comme par exemple le prunier.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/blob-bleu"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 323, 'bestiaire', 'Blob bleu', 'Blob bleu › butin 288-300 (Ennemi simple)', 'Butin possible', 'modifie', 'Perte de 25% du chakra', 'Perte de 25% du {{chakra|chakra}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"ennemi_simple","espece_id":"monstres/blob-bleu","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 324, 'bestiaire', 'Blob bleu', 'Blob bleu › butin 288-300 (Mini-boss)', 'Butin possible', 'modifie', 'Perte de 50% du chakra', 'Perte de 50% du {{chakra|chakra}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"mini_boss","espece_id":"monstres/blob-bleu","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 325, 'bestiaire', 'Blob bleu', 'Blob bleu › butin 288-300 (Boss)', 'Butin possible', 'modifie', 'Perte de 75% du chakra', 'Perte de 75% du {{chakra|chakra}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"boss","espece_id":"monstres/blob-bleu","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 326, 'bestiaire', 'Blob jaune', 'Blob jaune', 'Description', 'modifie', 'Le blob jaune, qui est associé au citron et à la foudre, se trouve dans les zones où la foudre tombe, sa chair jaune acide en bouche est lié à la barrière et permet de fabriquer la fiole jaune.', 'Le blob jaune, qui est associé au citron et à la foudre, se trouve dans les zones où la foudre tombe, sa chair jaune acide en bouche est lié à la {{barriere|barrière}} et permet de fabriquer la fiole jaune.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/blob-jaune"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 327, 'bestiaire', 'Blob jaune', 'Blob de la Foudre › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce blob jaune avec un beau citronnier sur le corps possède une barrière colossale pour son échelle de puissance. Il sera nécessaire d’être vigilant car sa barrière ne tombera pas aussi facilement.', 'Ce blob jaune avec un beau citronnier sur le corps possède une {{barriere|barrière}} colossale pour son échelle de puissance. Il sera nécessaire d’être vigilant car sa {{barriere|barrière}} ne tombera pas aussi facilement.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/blob-jaune#carte:blob-de-la-foudre","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 328, 'bestiaire', 'Blob jaune', 'Blob jaune › butin 288-300 (Ennemi simple)', 'Butin possible', 'modifie', 'Perte de 25% de la barrière', 'Perte de 25% de la {{barriere|barrière}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"ennemi_simple","espece_id":"monstres/blob-jaune","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 329, 'bestiaire', 'Blob jaune', 'Blob jaune › butin 288-300 (Mini-boss)', 'Butin possible', 'modifie', 'Perte de 50% de la barrière', 'Perte de 50% de la {{barriere|barrière}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"mini_boss","espece_id":"monstres/blob-jaune","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 330, 'bestiaire', 'Blob jaune', 'Blob jaune › butin 288-300 (Boss)', 'Butin possible', 'modifie', 'Perte de 75% de la barrière', 'Perte de 75% de la {{barriere|barrière}}', 'neutre', NULL, 'monstre_butin', '{"categorie":"boss","espece_id":"monstres/blob-jaune","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 331, 'bestiaire', 'Blob noir', 'Blob noir › butin 288-300 (Ennemi simple)', 'Butin possible', 'modifie', 'Bloque la régénération de barrière pour 1 tour', 'Bloque la régénération de {{barriere|barrière}} pour 1 tour', 'neutre', NULL, 'monstre_butin', '{"categorie":"ennemi_simple","espece_id":"monstres/blob-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 332, 'bestiaire', 'Blob noir', 'Blob noir › butin 288-300 (Mini-boss)', 'Butin possible', 'modifie', 'Bloque la régénération de barrière pour le prochain combat', 'Bloque la régénération de {{barriere|barrière}} pour le prochain combat', 'neutre', NULL, 'monstre_butin', '{"categorie":"mini_boss","espece_id":"monstres/blob-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 333, 'bestiaire', 'Blob noir', 'Blob noir › butin 288-300 (Boss)', 'Butin possible', 'modifie', 'Bloque la régénération de barrière pour 24h', 'Bloque la régénération de {{barriere|barrière}} pour 24h', 'neutre', NULL, 'monstre_butin', '{"categorie":"boss","espece_id":"monstres/blob-noir","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 334, 'bestiaire', 'Carcalanche', 'Carcalanche du froid › Dégâts', 'Texte de la rubrique', 'modifie', 'Grandes griffes – 4d10 dégâts de taille/estoc
Souffle gelée - 4d6 + 8 dégâts de glace (Cône de 4 cases|5 chakra)', 'Grandes griffes – 4d10 dégâts de taille/estoc
Souffle gelée - 4d6 + 8 dégâts de glace (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/carcalanche#carte:carcalanche-du-froid","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 335, 'bestiaire', 'Carcalanche', 'Carcalanche du givre › Dégâts', 'Texte de la rubrique', 'modifie', 'Grandes griffes – 4d10 + 8 dégâts de taille/estoc
Souffle gelée - 4d6 + 16 dégâts de glace (Cône de 4 cases|5 chakra)', 'Grandes griffes – 4d10 + 8 dégâts de taille/estoc
Souffle gelée - 4d6 + 16 dégâts de glace (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/carcalanche#carte:carcalanche-du-givre","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 336, 'bestiaire', 'Carcalanche', 'Carcalanche du blizzard › Dégâts', 'Texte de la rubrique', 'modifie', 'Grandes griffes – 4d10 + 16 dégâts de taille/estoc
Souffle gelée - 4d6 + 24 dégâts de glace (Cône de 4 cases|5 chakra)', 'Grandes griffes – 4d10 + 16 dégâts de taille/estoc
Souffle gelée - 4d6 + 24 dégâts de glace (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/carcalanche#carte:carcalanche-du-blizzard","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 337, 'bestiaire', 'Charcabé', 'Charcabé carbonisé › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ces versions carbonisées sont capables de surcharger leurs sortilèges pour les rendre encore plus puissants mais ils consomment bien trop de chakra.', 'Ces versions carbonisées sont capables de surcharger leurs sortilèges pour les rendre encore plus puissants mais ils consomment bien trop de {{chakra|chakra}}.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/charcabe#carte:charcabe-carbonise","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 338, 'bestiaire', 'Criquet Thaumivore', 'Criquet Thaumivore', 'Description', 'modifie', 'Le Criquet Thaumivore est un insecte de grande taille, atteignant en moyenne 50 centimètres de long, reconnaissable à son corps élancé et à ses pattes arrière puissantes, capables de bonds impressionnants. Sa carapace chitineuse présente des reflets ternes parcourus de veines blanches. Ses mandibules, larges et dentelées, sont spécialement adaptées pour broyer des tissus imprégnés de chakra.
Prédateur spécialisé, le Criquet Thaumivore se nourrit presque exclusivement de matière magique vivante, ce qui en fait l’ennemi naturel de nombreuses créatures végétales chakratiques. Il est notamment le principal prédateur des Herbes Folles, dont il raffole pour leur chair à la fois végétale et saturée de chakra. Lorsqu’il mord une proie, sa morsure est capable d’aspirer le chakra circulant dans le corps de sa victime, affaiblissant rapidement les êtres magiques ou les lanceurs de sorts.
L’énergie ainsi absorbée n’est pas dissipée immédiatement : le criquet peut la cumuler dans son corps, ce qui le rend progressivement plus rapide, plus fort et plus difficile à atteindre. Lorsqu’il atteint une surcharge, il libère brutalement cette énergie sous la forme d’une attaque concentrée, souvent un bond dévastateur. Naturellement peu agressif, le Criquet Thaumivore évite les affrontements inutiles. Cependant, lorsqu’il est privé trop longtemps de végétaux magiques, il entre dans un état de frénésie instable, devenant imprévisible et capable d’attaquer des proies bien plus grandes que lui, y compris des humanoïdes.', 'Le Criquet Thaumivore est un insecte de grande taille, atteignant en moyenne 50 centimètres de long, reconnaissable à son corps élancé et à ses pattes arrière puissantes, capables de bonds impressionnants. Sa carapace chitineuse présente des reflets ternes parcourus de veines blanches. Ses mandibules, larges et dentelées, sont spécialement adaptées pour broyer des tissus imprégnés de chakra.
Prédateur spécialisé, le Criquet Thaumivore se nourrit presque exclusivement de matière magique vivante, ce qui en fait l’ennemi naturel de nombreuses créatures végétales chakratiques. Il est notamment le principal prédateur des Herbes Folles, dont il raffole pour leur chair à la fois végétale et saturée de chakra. Lorsqu’il mord une proie, sa morsure est capable d’aspirer le {{chakra|chakra}} circulant dans le corps de sa victime, affaiblissant rapidement les êtres magiques ou les lanceurs de sorts.
L’énergie ainsi absorbée n’est pas dissipée immédiatement : le criquet peut la cumuler dans son corps, ce qui le rend progressivement plus rapide, plus fort et plus difficile à atteindre. Lorsqu’il atteint une surcharge, il libère brutalement cette énergie sous la forme d’une attaque concentrée, souvent un bond dévastateur. Naturellement peu agressif, le Criquet Thaumivore évite les affrontements inutiles. Cependant, lorsqu’il est privé trop longtemps de végétaux magiques, il entre dans un état de frénésie instable, devenant imprévisible et capable d’attaquer des proies bien plus grandes que lui, y compris des humanoïdes.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/criquet-thaumivore"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 339, 'bestiaire', 'Criquet Thaumivore', 'Criquet Thaumivore jeune › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce gros criquet est vif et possède une morsure capable de vider le chakra en plus de faire des dégâts, il va naturellement aller en direction de ceux qui ont le plus de chakra en réserve pour pouvoir s’en repaître.', 'Ce gros criquet est vif et possède une morsure capable de vider le {{chakra|chakra}} en plus de faire des dégâts, il va naturellement aller en direction de ceux qui ont le plus de {{chakra|chakra}} en réserve pour pouvoir s’en repaître.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/criquet-thaumivore#carte:criquet-thaumivore-jeune","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 340, 'bestiaire', 'Criquet Thaumivore', 'Gros Criquet Thaumivore › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Il a bien mangé celui-là ! Avec ses 80 cm en moyenne et sa plus grosse réserve de chakra, ses amplifications sont plus fortes.', 'Il a bien mangé celui-là ! Avec ses 80 cm en moyenne et sa plus grosse réserve de {{chakra|chakra}}, ses amplifications sont plus fortes.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/criquet-thaumivore#carte:gros-criquet-thaumivore","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 341, 'bestiaire', 'Criquet Thaumivore', 'Criquet Thaumivore géant › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Certaine la forme la plus rare du criquet qu’on retrouve plus souvent dans la forêt colossale. Sa morsure absorbe encore plus de chakra et ses amplifications sont encore plus forte.', 'Certaine la forme la plus rare du criquet qu’on retrouve plus souvent dans la forêt colossale. Sa morsure absorbe encore plus de {{chakra|chakra}} et ses amplifications sont encore plus forte.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/criquet-thaumivore#carte:criquet-thaumivore-geant","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 342, 'bestiaire', 'Élémentaire de la Nécromancie', 'Élémentaire de la Nécromancie › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'C’est un véritable rouleau compresseur, il va invoquer à la chaîne des non-morts différents pour pouvoir combattre ceux qui le menacent. La stratégie repose sur tuer rapidement ses invocations pour l’épuiser et le tuer à la longue.

N’essayez pas de l’atteindre directement, sa cage d’os est trop épaisse pour lui mettre le moindre coup.
(Oui sa barrière ne sert à rien)', 'C’est un véritable rouleau compresseur, il va invoquer à la chaîne des non-morts différents pour pouvoir combattre ceux qui le menacent. La stratégie repose sur tuer rapidement ses invocations pour l’épuiser et le tuer à la longue.

N’essayez pas de l’atteindre directement, sa cage d’os est trop épaisse pour lui mettre le moindre coup.
(Oui sa {{barriere|barrière}} ne sert à rien)', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/elementaire-de-la-necromancie#carte:elementaire-de-la-necromancie","rang":10}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 343, 'bestiaire', 'Élémentaire de l’Arcane', 'Élémentaire de l’Arcane', 'Description', 'modifie', 'L’Élémentaire d’Arcane possède une apparence presque parfaite, comme une représentation idéalisée d’un être humain à laquelle il manquerait quelque chose d’essentiel. Son corps ressemble à une sculpture brillante gris argenté, lisse et dépourvue du moindre détail superflu. Sans visage, sans expression et sans véritables pieds ni chevilles, il flotte silencieusement au-dessus du sol, comme s’il refusait de suivre les règles physiques imposées au reste du monde.
Sa particularité est sa capacité à entrer en résonance avec le chakra de ses adversaires. Plus une cible possède une réserve importante, plus l’Élémentaire devient dangereux face à elle. Il exploite directement l’énergie de ses ennemis pour renforcer ses attaques, augmentant sa puissance à mesure qu’il ressent une présence magique importante. Les mages, prêtres et autres utilisateurs intensifs du chakra deviennent ainsi ses cibles favorites, leur propre force se transformant progressivement en avantage pour lui.
Mais sa capacité la plus inquiétante réside dans son contrôle de l’énergie adverse. Lorsqu’un ennemi utilise son chakra et perd le contrôle de sa propre magie, l’Élémentaire provoque une résonance destructrice où une partie de l’énergie consommée se retourne contre son utilisateur et le blesse. Il est également capable de forcer une consommation accrue de chakra, épuisant rapidement ses victimes. Les plus puissants de son espèce poussent cette logique encore plus loin : ils peuvent injecter leur propre chakra dans leurs ennemis, nourrissant artificiellement leurs réserves uniquement pour amplifier davantage leur propre puissance. Face à un Élémentaire d’Arcane, disposer d’une immense réserve de chakra cesse d’être un avantage… et devient parfois une condamnation.', 'L’Élémentaire d’Arcane possède une apparence presque parfaite, comme une représentation idéalisée d’un être humain à laquelle il manquerait quelque chose d’essentiel. Son corps ressemble à une sculpture brillante gris argenté, lisse et dépourvue du moindre détail superflu. Sans visage, sans expression et sans véritables pieds ni chevilles, il flotte silencieusement au-dessus du sol, comme s’il refusait de suivre les règles physiques imposées au reste du monde.
Sa particularité est sa capacité à entrer en résonance avec le {{chakra|chakra}} de ses adversaires. Plus une cible possède une réserve importante, plus l’Élémentaire devient dangereux face à elle. Il exploite directement l’énergie de ses ennemis pour renforcer ses attaques, augmentant sa puissance à mesure qu’il ressent une présence magique importante. Les mages, prêtres et autres utilisateurs intensifs du chakra deviennent ainsi ses cibles favorites, leur propre force se transformant progressivement en avantage pour lui.
Mais sa capacité la plus inquiétante réside dans son contrôle de l’énergie adverse. Lorsqu’un ennemi utilise son {{chakra|chakra}} et perd le contrôle de sa propre magie, l’Élémentaire provoque une résonance destructrice où une partie de l’énergie consommée se retourne contre son utilisateur et le blesse. Il est également capable de forcer une consommation accrue de {{chakra|chakra}}, épuisant rapidement ses victimes. Les plus puissants de son espèce poussent cette logique encore plus loin : ils peuvent injecter leur propre {{chakra|chakra}} dans leurs ennemis, nourrissant artificiellement leurs réserves uniquement pour amplifier davantage leur propre puissance. Face à un Élémentaire d’Arcane, disposer d’une immense réserve de {{chakra|chakra}} cesse d’être un avantage… et devient parfois une condamnation.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/elementaire-de-larcane"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 344, 'bestiaire', 'Élémentaire de l’Arcane', 'Élémentaire de l’Arcane › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'L’anti mage par excellence, cet élémentaire fait vibrer le chakra de ses ennemis et malheur à ceux qui l''utilisent mal. Il est capable de faire des ravages contre ceux qui stocke beaucoup de chakra en eux.

Et même si vous pensez être à l’abri en vidant votre réserve de chakra, les plus forts sont capables de vous redonner du chakra.', 'L’anti mage par excellence, cet élémentaire fait vibrer le {{chakra|chakra}} de ses ennemis et malheur à ceux qui l''utilisent mal. Il est capable de faire des ravages contre ceux qui stocke beaucoup de {{chakra|chakra}} en eux.

Et même si vous pensez être à l’abri en vidant votre réserve de {{chakra|chakra}}, les plus forts sont capables de vous redonner du {{chakra|chakra}}.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/elementaire-de-larcane#carte:elementaire-de-larcane","rang":12}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 345, 'bestiaire', 'Fourbraise', 'Fourbraise ouvrière › Dégâts', 'Texte de la rubrique', 'modifie', 'Morsure - 2d10 + 2 dégâts d’estoc
Souffle chaud - 3d6 dégâts de feu (Cône de 4 cases|5 chakra)', 'Morsure - 2d10 + 2 dégâts d’estoc
Souffle chaud - 3d6 dégâts de feu (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/fourbraise#carte:fourbraise-ouvriere","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 346, 'bestiaire', 'Fourbraise', 'Fourbraise soldat › Dégâts', 'Texte de la rubrique', 'modifie', 'Morsure - 2d10 + 4 dégâts d’estoc
Souffle chaud - 3d6 + 3 dégâts de feu (Cône de 4 cases|5 chakra)', 'Morsure - 2d10 + 4 dégâts d’estoc
Souffle chaud - 3d6 + 3 dégâts de feu (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/fourbraise#carte:fourbraise-soldat","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 347, 'bestiaire', 'Fourbraise', 'Fourbraise Chevaleresse › Dégâts', 'Texte de la rubrique', 'modifie', 'Morsure - 2d10 + 8 dégâts d’estoc
Souffle chaud - 3d6 + 6 dégâts de feu (Cône de 4 cases|5 chakra)', 'Morsure - 2d10 + 8 dégâts d’estoc
Souffle chaud - 3d6 + 6 dégâts de feu (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/fourbraise#carte:fourbraise-chevaleresse","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 348, 'bestiaire', 'Fulgurâme', 'Fulgurâme tonnerre › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'La version tonnerre est capable d’exploiter son chakra pour augmenter son agilité à des fins défensives, il sera très difficile de l’attendre tellement il est vif. Il dispose d’une armure qui mélange cellulose et fer.', 'La version tonnerre est capable d’exploiter son {{chakra|chakra}} pour augmenter son agilité à des fins défensives, il sera très difficile de l’attendre tellement il est vif. Il dispose d’une armure qui mélange cellulose et fer.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/fulgurame#carte:fulgurame-tonnerre","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 349, 'bestiaire', 'Golem d’arcane', 'Golem d’arcane I › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce golem raffiné est connu pour avoir un corps fantomatique et est donc immunisé à tout assaut physique contre lui, il est recommandé d’utiliser la magie, des armes sous un sort “fer”, une arme élémentaire ou bien une arme en vif argent.
Ce golem est conscient de sa condition de fantôme et se concentrera sur ceux qui peuvent le toucher.
Il semble posséder une arme qui fait beaucoup penser à la crosse d’argent, l’arme des croisés du temple de l’arcane.', 'Ce golem raffiné est connu pour avoir un corps fantomatique et est donc immunisé à tout assaut physique contre lui, il est recommandé d’utiliser la magie, des armes sous un {{sort-fer|sort “fer”}}, une arme élémentaire ou bien une arme en vif argent.
Ce golem est conscient de sa condition de fantôme et se concentrera sur ceux qui peuvent le toucher.
Il semble posséder une arme qui fait beaucoup penser à la crosse d’argent, l’arme des croisés du temple de l’arcane.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-darcane#carte:golem-darcane-i","rang":9}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 350, 'bestiaire', 'Golem de corail', 'Golem de corail I › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 dégâts de frappe
Souffle hydraulique - 4d6 + 8 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 dégâts de frappe
Souffle hydraulique - 4d6 + 8 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail#carte:golem-de-corail-i","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 351, 'bestiaire', 'Golem de corail', 'Golem de corail I › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce golem très particulier possède la capacité de faire un souffle hydraulique sur ses ennemis mais c’est sa barrière qui semble en permanence se recharger.
Il dispose de beaucoup de résistance élémentaire et il n’est pas inquiété par les dégâts d’estoc vu qu’il est immunité à ces derniers, il ne dispose pas de faiblesse aux dégâts de frappe comme les squelettes car sa composition lui permet de ne pas l’être.', 'Ce golem très particulier possède la capacité de faire un souffle hydraulique sur ses ennemis mais c’est sa {{barriere|barrière}} qui semble en permanence se recharger.
Il dispose de beaucoup de résistance élémentaire et il n’est pas inquiété par les dégâts d’estoc vu qu’il est immunité à ces derniers, il ne dispose pas de faiblesse aux dégâts de frappe comme les squelettes car sa composition lui permet de ne pas l’être.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail#carte:golem-de-corail-i","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 352, 'bestiaire', 'Golem de corail', 'Golem de corail II › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail#carte:golem-de-corail-ii","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 353, 'bestiaire', 'Golem de corail', 'Golem de corail III › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail#carte:golem-de-corail-iii","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 354, 'bestiaire', 'Golem de corail', 'Golem de corail I › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 dégâts de frappe
Souffle hydraulique - 4d6 + 8 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 dégâts de frappe
Souffle hydraulique - 4d6 + 8 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail-2#carte:golem-de-corail-i","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 355, 'bestiaire', 'Golem de corail', 'Golem de corail I › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'Ce golem très particulier possède la capacité de faire un souffle hydraulique sur ses ennemis mais c’est sa barrière qui semble en permanence se recharger.
Il dispose de beaucoup de résistance élémentaire et il n’est pas inquiété par les dégâts d’estoc vu qu’il est immunité à ces derniers, il ne dispose pas de faiblesse aux dégâts de frappe comme les squelettes car sa composition lui permet de ne pas l’être.', 'Ce golem très particulier possède la capacité de faire un souffle hydraulique sur ses ennemis mais c’est sa {{barriere|barrière}} qui semble en permanence se recharger.
Il dispose de beaucoup de résistance élémentaire et il n’est pas inquiété par les dégâts d’estoc vu qu’il est immunité à ces derniers, il ne dispose pas de faiblesse aux dégâts de frappe comme les squelettes car sa composition lui permet de ne pas l’être.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail-2#carte:golem-de-corail-i","rang":11}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 356, 'bestiaire', 'Golem de corail', 'Golem de corail II › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail-2#carte:golem-de-corail-ii","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 357, 'bestiaire', 'Golem de corail', 'Golem de corail III › Dégâts', 'Texte de la rubrique', 'modifie', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 chakra)', 'Poing – 4d10 + 8 dégâts de frappe
Souffle hydraulique - 4d6 + 16 dégâts d''eau (Cône de 4 cases|5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-corail-2#carte:golem-de-corail-iii","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 358, 'bestiaire', 'Golem de maverium', 'Golem de maverium › TACTIQUE COMBAT', 'Texte de la rubrique', 'modifie', 'L’ultime golem qui existe dans ce monde, il est totalement imperméable aux chakra et il est capable de réduire les barrières en poussière d’une simple pichenette. C''est une véritable épreuve de force pure ou la magie n’a pas sa place.', 'L’ultime golem qui existe dans ce monde, il est totalement imperméable aux chakra et il est capable de réduire les {{barriere|barrières}} en poussière d’une simple pichenette. C''est une véritable épreuve de force pure ou la magie n’a pas sa place.', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-maverium#carte:golem-de-maverium","rang":9}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 359, 'bestiaire', 'Golem de verre', 'Golem de verre I › Compétence(s) secondaire(s)', 'Texte de la rubrique', 'modifie', '+5% Arme lourde, +5% Parade, +5% Stabilité

Sensibilité(s) Dégâts x8
Son', '+5% Arme lourde, +5% Parade, +5% Stabilité

Sensibilité(s) Dégâts x4
Son', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-verre#carte:golem-de-verre-i","rang":6}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 360, 'bestiaire', 'Golem de verre', 'Golem de verre II › Compétence(s) secondaire(s)', 'Texte de la rubrique', 'modifie', '+10% Arme lourde, +10% Parade, +10% Stabilité

Sensibilité(s) Dégâts x8
Son', '+10% Arme lourde, +10% Parade, +10% Stabilité

Sensibilité(s) Dégâts x4
Son', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-verre#carte:golem-de-verre-ii","rang":6}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 361, 'bestiaire', 'Golem de verre', 'Golem de verre III › Compétence(s) secondaire(s)', 'Texte de la rubrique', 'modifie', '+10% Arme lourde, +10% Parade, +10% Stabilité

Sensibilité(s) Dégâts x8
Son', '+10% Arme lourde, +10% Parade, +10% Stabilité

Sensibilité(s) Dégâts x4
Son', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/golem-de-verre#carte:golem-de-verre-iii","rang":6}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 362, 'bestiaire', 'Main blanche', 'Main blanche › Dégâts', 'Texte de la rubrique', 'modifie', '[Non métamorphosé] Poing – 4d10 dégâts de frappe
[Non métamorphosé] Magie brute - 4d10 dégâts neutre (coût 9 chakra)', '[Non métamorphosé] Poing – 4d10 dégâts de frappe
[Non métamorphosé] Magie brute - 4d10 dégâts neutre (coût 9 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/main-blanche#carte:main-blanche","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 363, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › POTENTIEL ILLIMITÉ', 'Texte du bloc', 'modifie', 'DESCRIPTION
Un énorme tatouage sur le dos et le torse apparaît, le symbole de l’absolu complètement déformé. Les tatouages orange brillent d’une couleur dérangeante.
Compétence
+7% à toutes les compétences
Don
Carapace déformée. N’est plus vulnérable aux dégâts physiques.

Grimoire déformé. A accès aux sorts de son niveau mais ne peut pas les utiliser deux fois de suite dans le même tour.

Rituel souillé. Capable d’utiliser les sorts sang, nécromancie et corruption sans la 4ème barre mais augmente de 50% le coût chakra.

Semi-complet. Peut utiliser les sorts de lvl4 de puissance (si il a le niveau)', 'DESCRIPTION
Un énorme tatouage sur le dos et le torse apparaît, le symbole de l’absolu complètement déformé. Les tatouages orange brillent d’une couleur dérangeante.
Compétence
+7% à toutes les compétences
Don
Carapace déformée. N’est plus vulnérable aux dégâts physiques.

Grimoire déformé. A accès aux sorts de son niveau mais ne peut pas les utiliser deux fois de suite dans le même tour.

Rituel souillé. Capable d’utiliser les sorts sang, nécromancie et corruption sans la 4ème barre mais augmente de 50% le coût {{chakra|chakra}}.

Semi-complet. Peut utiliser les sorts de lvl4 de puissance (si il a le niveau)', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":1}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 364, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › CORRUPTION', 'Texte du bloc', 'modifie', 'DESCRIPTION
Les marques de corruption vont briller d''une lumière particulièrement désagréable et libérer de la corruption quasiment liquide. Sa peau devient progressivement noire.
Compétence mono magie
Compétence bi-magie
+15% compétence d’intelligence
+7% compétence d’intelligence
Don
Don mono-magie
Pollution. Chaque attaque qui touche oblige un jet de vigueur qui donne ces effets pendant 2 tours =
- Si réussite : diminue aléatoirement une résistance.
- Si échec : aggrave une vulnérabilité aléatoirement.
(Dans le cas de l''arcane et corruption, ça ne fonctionne pas)

Cicatrices pétrolières. Chaque attaque réussit empêche la cible de récupérer de la barrière pendant 1 tour.
Poison Noir. Les attaques de cette créature ajoutent 10% des dégâts infligés en corruption.

Contestation. Chaque malus qui lui est infligé deviendra un bonus.', 'DESCRIPTION
Les marques de corruption vont briller d''une lumière particulièrement désagréable et libérer de la corruption quasiment liquide. Sa peau devient progressivement noire.
Compétence mono magie
Compétence bi-magie
+15% compétence d’intelligence
+7% compétence d’intelligence
Don
Don mono-magie
Pollution. Chaque attaque qui touche oblige un jet de vigueur qui donne ces effets pendant 2 tours =
- Si réussite : diminue aléatoirement une résistance.
- Si échec : aggrave une vulnérabilité aléatoirement.
(Dans le cas de l''arcane et corruption, ça ne fonctionne pas)

Cicatrices pétrolières. Chaque attaque réussit empêche la cible de récupérer de la {{barriere|barrière}} pendant 1 tour.
Poison Noir. Les attaques de cette créature ajoutent 10% des dégâts infligés en {{corruption|corruption}}.

Contestation. Chaque malus qui lui est infligé deviendra un bonus.', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":4}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 365, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › ESPACE/TEMPS', 'Texte du bloc', 'modifie', 'DESCRIPTION
Les bandages des mains et pieds se développent et sont présents sur tout le corps.
Compétence mono magie
Compétence bi-magie
+15% compétence d’intelligence
+7% compétence d’intelligence
Don
Don mono-magie
Diagonale incohérente. Les diagonales comptent pour 1 case de déplacement au lieu de 2.

En tête. L''une des initiatives de cette créature sera toujours au dessus de toutes les autres (Joueurs compris)

25h. Cette créature est capable d''utiliser un sortilège du Temps et de l''Espace qui est capable de placement, ce sort n''infligera aucun dégâts ni aucun effet secondaire, juste elle fera son effet de déplacement. Cette action peut se faire avant ou après le tour réel de la créature. (Ne demande pas de chakra)

Redémarrage. Permet de relancer un échec (hors échec critique) (réaction 1 fois/3 tours)', 'DESCRIPTION
Les bandages des mains et pieds se développent et sont présents sur tout le corps.
Compétence mono magie
Compétence bi-magie
+15% compétence d’intelligence
+7% compétence d’intelligence
Don
Don mono-magie
Diagonale incohérente. Les diagonales comptent pour 1 case de déplacement au lieu de 2.

En tête. L''une des initiatives de cette créature sera toujours au dessus de toutes les autres (Joueurs compris)

25h. Cette créature est capable d''utiliser un sortilège du Temps et de l''Espace qui est capable de placement, ce sort n''infligera aucun dégâts ni aucun effet secondaire, juste elle fera son effet de déplacement. Cette action peut se faire avant ou après le tour réel de la créature. (Ne demande pas de {{chakra|chakra}})

Redémarrage. Permet de relancer un échec (hors échec critique) (réaction 1 fois/3 tours)', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":5}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 366, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › VIDE', 'Texte du bloc', 'modifie', 'DESCRIPTION
Son torse entier est vide ainsi que ses yeux.
Compétence mono magie
Compétence bi-magie
+15% compétence de volonté
+7% compétence de volonté
Don
Don mono-magie
Corps vide. Le torse de cette créature est totalement invulnérable aux dégâts.

Lévitation. N''est pas affecté par les effets qui impliquent le sol.
Attaque vide. L''attaque de cette créature bloque l''utilisation de la magie de la victime pour 1 tour.

Migraine chakratique. Les ennemis à 3 cases autour de la créature voient leur coût en chakra augmenter de 25% pour leur sort.', 'DESCRIPTION
Son torse entier est vide ainsi que ses yeux.
Compétence mono magie
Compétence bi-magie
+15% compétence de volonté
+7% compétence de volonté
Don
Don mono-magie
Corps vide. Le torse de cette créature est totalement invulnérable aux dégâts.

Lévitation. N''est pas affecté par les effets qui impliquent le sol.
Attaque vide. L''attaque de cette créature bloque l''utilisation de la magie de la victime pour 1 tour.

Migraine chakratique. Les ennemis à 3 cases autour de la créature voient leur coût en {{chakra|chakra}} augmenter de 25% pour leur sort.', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":6}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 367, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › FEU', 'Texte du bloc', 'modifie', 'DESCRIPTION
La moitié du corps est complètement brûlé et crache des flammes très brûlantes en permanence.
Compétence mono magie
Compétence bi-magie
+15% compétence de force
+7% compétence de force
Don
Don mono-magie
Moteur thermique. Cette créature absorbe les dégâts de l’élément feu, si une attaque de feu est tenté sur lui, ses dégâts augmente de 5 et sa vitesse de 1 pendant 2 tours.

Jet de Magma. Cette créature lance du magma et diminue de 2 la résistance au Feu de la cible.
Déflagration. Sacrifie les AP ou AM pour les ajouter à ses dégâts pendant 2 tours.

Crache feu. Contre 3IC, cette créature peut cracher une gerbe de flamme qui va à 3 PO en ligne droite et touché toutes les créatures dans la zone, inflige 3d6 dégâts. Coût 5 chakra.', 'DESCRIPTION
La moitié du corps est complètement brûlé et crache des flammes très brûlantes en permanence.
Compétence mono magie
Compétence bi-magie
+15% compétence de force
+7% compétence de force
Don
Don mono-magie
Moteur thermique. Cette créature absorbe les dégâts de l’élément feu, si une attaque de feu est tenté sur lui, ses dégâts augmente de 5 et sa vitesse de 1 pendant 2 tours.

Jet de Magma. Cette créature lance du magma et diminue de 2 la résistance au Feu de la cible.
Déflagration. Sacrifie les AP ou AM pour les ajouter à ses dégâts pendant 2 tours.

Crache feu. Contre 3IC, cette créature peut cracher une gerbe de flamme qui va à 3 PO en ligne droite et touché toutes les créatures dans la zone, inflige 3d6 dégâts. Coût 5 {{chakra|chakra}}.', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":8}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 368, 'bestiaire', '“Presque-Ottar”', '“Presque-Ottar” › OMBRE', 'Texte du bloc', 'modifie', 'DESCRIPTION
L''aura d''ombre est surdéveloppé et les attributs de l’ombre sont totalement exagérés.
Compétence mono magie
Compétence bi-magie
+15% compétence de perception
+7% compétence de perception
Don
Don mono-magie
Destructeur. 25% des dégâts des attaques sont infligés également au Chakra.

Dégénérer des ténèbres. Impose un malus de 10% aux jets de parade/esquive/fermeté/vigueur aux ennemis à 2 cases.

Chat noir. Les malus dure deux fois plus longtemps.

Attaque maudite. La prochaine attaque réussi appliquera l''effet "malédiction" sur l''ennemi pendant 1 tour.', 'DESCRIPTION
L''aura d''ombre est surdéveloppé et les attributs de l’ombre sont totalement exagérés.
Compétence mono magie
Compétence bi-magie
+15% compétence de perception
+7% compétence de perception
Don
Don mono-magie
Destructeur. 25% des dégâts des attaques sont infligés également au {{chakra|Chakra}}.

Dégénérer des ténèbres. Impose un malus de 10% aux jets de parade/esquive/fermeté/vigueur aux ennemis à 2 cases.

Chat noir. Les malus dure deux fois plus longtemps.

Attaque maudite. La prochaine attaque réussi appliquera l''effet "malédiction" sur l''ennemi pendant 1 tour.', 'neutre', NULL, 'monstre_espece_bloc', '{"espece_id":"monstres/presque-ottar","rang":15}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 369, 'bestiaire', 'Ottar Grande prêtresse', 'Ottar Grande prêtresse', 'Description', 'modifie', 'Créature exclusivement féminine issue de prêtresses, croisées ou religieuses dont la foi ou la quête de savoir a implosé en un fanatisme absolu. Drapée de haillons religieux et d’un voile monstrueux couvert d''yeux et de glyphes vivants pour cacher son propre visage monstrueux, elle se croit l’incarnation d’une volonté divine.

L’Ottar Grande Prêtresse ne combat pas par la force brute mais par l’influence : ses chants sacrés altèrent l’esprit, forçant ses victimes à s’entretuer ou à se prosterner, tandis qu’elle invoque des manifestations d’ombres et de lumière pour frapper à distance. Plus le combat dure, plus elle se nourrit du désespoir et du chakra de ses cibles.
Elle n’est pas atteignable physiquement ou magiquement, il est nécessaire de trouver ce qui fait que sa foi est autant concentrer, un objet sur elle ou bien une personne, la détruire la rendrait vulnérable.

Comme d’autres ottars, il est capable de dissimuler son effondrement chakratique pour rester discret.

Prophétesse déchue, la Grande Prêtresse ne guide plus : elle asservit les âmes et brise les esprits. Le tout avec une vision déformé de sa divinité.', 'Créature exclusivement féminine issue de prêtresses, croisées ou religieuses dont la foi ou la quête de savoir a implosé en un fanatisme absolu. Drapée de haillons religieux et d’un voile monstrueux couvert d''yeux et de glyphes vivants pour cacher son propre visage monstrueux, elle se croit l’incarnation d’une volonté divine.

L’Ottar Grande Prêtresse ne combat pas par la force brute mais par l’influence : ses chants sacrés altèrent l’esprit, forçant ses victimes à s’entretuer ou à se prosterner, tandis qu’elle invoque des manifestations d’ombres et de lumière pour frapper à distance. Plus le combat dure, plus elle se nourrit du désespoir et du {{chakra|chakra}} de ses cibles.
Elle n’est pas atteignable physiquement ou magiquement, il est nécessaire de trouver ce qui fait que sa foi est autant concentrer, un objet sur elle ou bien une personne, la détruire la rendrait vulnérable.

Comme d’autres ottars, il est capable de dissimuler son effondrement chakratique pour rester discret.

Prophétesse déchue, la Grande Prêtresse ne guide plus : elle asservit les âmes et brise les esprits. Le tout avec une vision déformé de sa divinité.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/ottar-grande-pretresse"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 370, 'bestiaire', 'Potironcier', 'Potironcier', 'Description', 'modifie', 'Le Potironcier est une incarnation érudite des mystérieux Potimen, ces épouvantails animés à tête de potiron creusé dont l’intérieur brûle d’une flamme colorée. Son corps de paille est dissimulé sous une longue cape sombre qui ondule au vent des champs qu’il protège. À l’intérieur de sa tête blanche sculptée danse une flamme blanche éclatante, pure et stable, symbole de sa maîtrise de la magie de l’Arcane et de la Lumière.
Comme tous les siens, le Potironcier garde les immenses champs de blé et attaque sans hésitation les intrus. Pourtant, à la fin de l’été et au début de l’automne, lui et ses semblables suspendent toute hostilité pour laisser place à la récolte géante. Nul ne sait pourquoi cette trêve saisonnière existe, ni quelle volonté mystérieuse régit leur comportement.
Contrairement au Potirobuste, il ne mise pas sur la force physique mais sur une réserve de Chakra conséquente qu’il canalise avec précision. Comparable à un Mage et un Ocultomancien, il dissimule sous sa cape un bâton magique de l’arcane qu’il utilise pour projeter des sorts. Ses attaques magiques sont précises, tranchantes et méthodiques, frappant à distance avec une froide détermination.', 'Le Potironcier est une incarnation érudite des mystérieux Potimen, ces épouvantails animés à tête de potiron creusé dont l’intérieur brûle d’une flamme colorée. Son corps de paille est dissimulé sous une longue cape sombre qui ondule au vent des champs qu’il protège. À l’intérieur de sa tête blanche sculptée danse une flamme blanche éclatante, pure et stable, symbole de sa maîtrise de la magie de l’Arcane et de la Lumière.
Comme tous les siens, le Potironcier garde les immenses champs de blé et attaque sans hésitation les intrus. Pourtant, à la fin de l’été et au début de l’automne, lui et ses semblables suspendent toute hostilité pour laisser place à la récolte géante. Nul ne sait pourquoi cette trêve saisonnière existe, ni quelle volonté mystérieuse régit leur comportement.
Contrairement au Potirobuste, il ne mise pas sur la force physique mais sur une réserve de {{chakra|Chakra}} conséquente qu’il canalise avec précision. Comparable à un Mage et un Ocultomancien, il dissimule sous sa cape un bâton magique de l’arcane qu’il utilise pour projeter des sorts. Ses attaques magiques sont précises, tranchantes et méthodiques, frappant à distance avec une froide détermination.', 'neutre', NULL, 'monstre_espece', '{"id":"monstres/potironcier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 371, 'bestiaire', 'Velue', 'Velue › Dégâts', 'Texte de la rubrique', 'modifie', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% chakra)', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/velue#carte:velue","rang":4}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 372, 'bestiaire', 'Velue', 'Velue supérieur › Dégâts', 'Texte de la rubrique', 'modifie', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% chakra)', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/velue#carte:velue-superieur","rang":4}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 373, 'bestiaire', 'Velue', 'Velue abominable › Dégâts', 'Texte de la rubrique', 'modifie', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% chakra)', 'Se fier au dégâts moyen dans le tableau de l’introduction.

Arme de la créature :
EP 1 - 10 : Morsure, Griffe, Pics, Queue
EP 2 - 10 : Souffle élémentaire (1-6 po) (coût : 10% {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/velue#carte:velue-abominable","rang":4}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 374, 'bestiaire', 'Voromorphe', 'Voromorphe jeune › Dégâts', 'Texte de la rubrique', 'modifie', 'Griffes – 4d10 dégâts de taille.
Morsure – 4d10 dégâts d’estoc.
Souffle voro - 4d10 dégâts élémentaire (5 PO|Ligne|Coûte 5 chakra)', 'Griffes – 4d10 dégâts de taille.
Morsure – 4d10 dégâts d’estoc.
Souffle voro - 4d10 dégâts élémentaire (5 PO|Ligne|Coûte 5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/voromorphe#carte:voromorphe-jeune","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 375, 'bestiaire', 'Voromorphe', 'Voromorphe adulte › Dégâts', 'Texte de la rubrique', 'modifie', 'Griffes – 4d10 + 8 dégâts de taille.
Morsure – 4d10 + 8 dégâts d’estoc.
Souffle voro - 4d10 + 8 dégâts élémentaire (5 PO|Ligne|Coûte 5 chakra)', 'Griffes – 4d10 + 8 dégâts de taille.
Morsure – 4d10 + 8 dégâts d’estoc.
Souffle voro - 4d10 + 8 dégâts élémentaire (5 PO|Ligne|Coûte 5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/voromorphe#carte:voromorphe-adulte","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 376, 'bestiaire', 'Voromorphe', 'Voromorphe apex › Dégâts', 'Texte de la rubrique', 'modifie', 'Griffes – 4d10 + 16 dégâts de taille.
Morsure – 4d10 + 16 dégâts d’estoc.
Souffle voro - 4d10 + 16 dégâts élémentaire (5 PO|Ligne|Coûte 5 chakra)', 'Griffes – 4d10 + 16 dégâts de taille.
Morsure – 4d10 + 16 dégâts d’estoc.
Souffle voro - 4d10 + 16 dégâts élémentaire (5 PO|Ligne|Coûte 5 {{chakra|chakra}})', 'neutre', NULL, 'monstre_rubrique', '{"monstre_id":"monstres/voromorphe#carte:voromorphe-apex","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 377, 'bestiaire', 'Capacités de monstre', 'Adaptation élémentaire', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature ne possède pas la même forme selon l’environnement où on la rencontre, chaque environnement peut être associé à une magie, et lui donne différents bonus :
Sang = Élément sang, +7 dégâts avec les armes, 7AP/3AM
Arcane = Élément arcane, +7 dégâts avec le souffle, 2AP/8AM
Corruption = Élément corruption, les attaques infligent 4 corruption, 2AP/8AM
Espace/Temps = Élément espace/temps, les diagonales compte pour 1 case de déplacement, 4AP/6AM
Nécromancie = Élément sang, résistance aux dégâts d’estoc, 7AP/3AM
Feu = Élément feu, infligent brûlure 2 avec le souffle, 5AP/5AM
Eau = Élément eau, régénère 5 barrière au début de chaque tour, 4AP/6AM
Glace = Élément glace, malus de 3 à l’initiative aux ennemis à 2 cases, 0AP/10AM
Terre = Élément terre, si santé en dessous de 25% = peut projeter des éclat de pierre sur un rayon de 4 cases qui infligent 4d10 dégâts, 10AP/0AM
Vent = Élément vent, inflige des dégâts sonore avec le souffle, 4AP/6AM
Foudre = Élément foudre, possède une plaque miroir qui peut absorber un sort niveau 3, cette plaque réapparaît tous les 3 tours, 6AP/4AM
Lumière = Élément lumière, régénère 5 santé au début de chaque tour, 5AP/5AM
Ombre = Élément ombre, chaque attaques infligent un malus de 10% au prochain jet de la victime, 5AP/5AM', 'Cette créature ne possède pas la même forme selon l’environnement où on la rencontre, chaque environnement peut être associé à une magie, et lui donne différents bonus :
Sang = Élément sang, +7 dégâts avec les armes, 7AP/3AM
Arcane = Élément arcane, +7 dégâts avec le souffle, 2AP/8AM
Corruption = Élément corruption, les attaques infligent 4 {{corruption|corruption}}, 2AP/8AM
Espace/Temps = Élément espace/temps, les diagonales compte pour 1 case de déplacement, 4AP/6AM
Nécromancie = Élément sang, résistance aux dégâts d’estoc, 7AP/3AM
Feu = Élément feu, infligent brûlure 2 avec le souffle, 5AP/5AM
Eau = Élément eau, régénère 5 {{barriere|barrière}} au début de chaque tour, 4AP/6AM
Glace = Élément glace, malus de 3 à l’initiative aux ennemis à 2 cases, 0AP/10AM
Terre = Élément terre, si santé en dessous de 25% = peut projeter des éclat de pierre sur un rayon de 4 cases qui infligent 4d10 dégâts, 10AP/0AM
Vent = Élément vent, inflige des dégâts sonore avec le souffle, 4AP/6AM
Foudre = Élément foudre, possède une plaque miroir qui peut absorber un sort niveau 3, cette plaque réapparaît tous les 3 tours, 6AP/4AM
Lumière = Élément lumière, régénère 5 santé au début de chaque tour, 5AP/5AM
Ombre = Élément ombre, chaque attaques infligent un malus de 10% au prochain jet de la victime, 5AP/5AM', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"adaptation-elementaire"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 378, 'bestiaire', 'Capacités de monstre', 'Anti-barrière', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'L’arme de cette créature possède la même propriété que le maverium, il casse la barrière au moindre dégâts infligés.', 'L’arme de cette créature possède la même propriété que le maverium, il casse la {{barriere|barrière}} au moindre dégâts infligés.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"anti-barriere"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 379, 'bestiaire', 'Capacités de monstre', 'Blessure chakratique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature exploite le chakra de ses adversaire à son avantage, elle obtient un bonus de 1 dégât à ses attaques par 5 chakra courant dans la réserve de sa cible. Quand ses ennemis utilisent du chakra, si leur score de réussite est au dessus de 75, ils perdent le quart du coût en chakra du sort en santé (minimum 1 santé).', 'Cette créature exploite le {{chakra|chakra}} de ses adversaire à son avantage, elle obtient un bonus de 1 dégât à ses attaques par 5 {{chakra|chakra}} courant dans la réserve de sa cible. Quand ses ennemis utilisent du {{chakra|chakra}}, si leur score de réussite est au dessus de 75, ils perdent le quart du coût en {{chakra|chakra}} du sort en santé (minimum 1 santé).', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"blessure-chakratique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 380, 'bestiaire', 'Capacités de monstre', 'Brûlure chakratique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Tant qu’elle est sur le terrain, cette créature augmente les coûts en chakra de 50% pour ses ennemis.', 'Tant qu’elle est sur le terrain, cette créature augmente les coûts en {{chakra|chakra}} de 50% pour ses ennemis.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"brulure-chakratique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 381, 'bestiaire', 'Capacités de monstre', 'Cadeau chakratique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature peut donner une partie de son chakra à une cible. (3 fois/combat)', 'Cette créature peut donner une partie de son {{chakra|chakra}} à une cible. (3 fois/combat)', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"cadeau-chakratique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 382, 'bestiaire', 'Capacités de monstre', 'Charge chakratique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Quand la réserve de chakra atteint 100%, peut faire une charge sur une cible dont la portée correspond au sprint de la créature. Une fois cette attaque faite, la réserve de chakra retombe à 0.', 'Quand la réserve de {{chakra|chakra}} atteint 100%, peut faire une charge sur une cible dont la portée correspond au sprint de la créature. Une fois cette attaque faite, la réserve de {{chakra|chakra}} retombe à 0.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"charge-chakratique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 383, 'bestiaire', 'Capacités de monstre', 'Chargement bleu (chargement-bleu)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature possède une réserve de chakra vide qui peut se remplir par un moyen x. Quand elle atteint certains seuil de réserve, elle débloque des passif qui se cumule entre eux :
20% de chakra = +{3} Initiative
40% de chakra = +{5} aux dégâts
60% de chakra = +{1} vitesse
80% de chakra = +{6} AM
100% de chakra = Débloque le don “” et DOIT le faire dès que possible.', 'Cette créature possède une réserve de {{chakra|chakra}} vide qui peut se remplir par un moyen x. Quand elle atteint certains seuil de réserve, elle débloque des passif qui se cumule entre eux :
20% de {{chakra|chakra}} = +{3} Initiative
40% de {{chakra|chakra}} = +{5} aux dégâts
60% de {{chakra|chakra}} = +{1} vitesse
80% de {{chakra|chakra}} = +{6} AM
100% de {{chakra|chakra}} = Débloque le don “” et DOIT le faire dès que possible.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"chargement-bleu"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 384, 'bestiaire', 'Capacités de monstre', 'Chargement bleu (chargement-bleu-2)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature possède une réserve de chakra vide qui peut se remplir par un moyen x. Quand elle atteint certains seuil de réserve, elle débloque des passif qui se cumule entre eux :
20% de chakra = +2 Initiative
40% de chakra = +3 aux dégâts
60% de chakra = +10% Esquive
80% de chakra = +4 AM
100% de chakra = Débloque le don “” et DOIT le faire dès que possible.', 'Cette créature possède une réserve de {{chakra|chakra}} vide qui peut se remplir par un moyen x. Quand elle atteint certains seuil de réserve, elle débloque des passif qui se cumule entre eux :
20% de {{chakra|chakra}} = +2 Initiative
40% de {{chakra|chakra}} = +3 aux dégâts
60% de {{chakra|chakra}} = +10% Esquive
80% de {{chakra|chakra}} = +4 AM
100% de {{chakra|chakra}} = Débloque le don “” et DOIT le faire dès que possible.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"chargement-bleu-2"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 385, 'bestiaire', 'Capacités de monstre', 'Crache feu', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Contre 3IC, cette créature peut cracher une gerbe de flamme qui va à 3 PO en ligne droite et touché toutes les créatures dans la zone, inflige 3d6 dégâts. Coûte 5 chakra.', 'Contre 3IC, cette créature peut cracher une gerbe de flamme qui va à 3 PO en ligne droite et touché toutes les créatures dans la zone, inflige 3d6 dégâts. Coûte 5 {{chakra|chakra}}.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"crache-feu"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 386, 'bestiaire', 'Capacités de monstre', 'Cuisson absolue', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'La peau de cette créature réagit aux éléments qu’on lui inflige, changeant sa peau et lui donne des propriétés. Cet état dure 3 tours tant qu’un autre élément n’est pas utilisé pour le remplacer, au bout de 3 tours, il redevient neutre. Utiliser un élément contraire à celui actif enclenche une “contre-cuisson”, l’effet de contre cuisson peut être esquiver ou parer s’il inflige des dégâts (sauf contre indication).
Voir le tableau plus bas.

Élément
Effets/Description
Résistance Vulnérabilité
Sang
Miche sacrificielle
Élément Sang

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Folle de guerre

+12 dégâts mais perd 5% de sa santé max à chaque coup réussi ou raté.

Si touché par faiblesse :
Un nuage mauvais est invoqué, pendant 1 tour, les soins prodigués sont divisés par 2.
Résistance : Sang

Vulnérabilité : Nécromancie
Arcane
Pain blanc
Élément Arcane

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Renvoi à hauteur de 25% des effets du sort de l’adversaire (l’agresseur peut se défendre contre cette contre attaque si c’est possible)

+2 AM

Si touché par faiblesse :
Une explosion se produit, force les ennemis un jet de fermeté, si ils ratent : Perd 3d10 chakra.
Résistance : Arcane

Vulnérabilité : Corruption
Corruption
Pain noir
Élément Corruption

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Possède une aura négative de 2 cases de rayon, les ennemis à l’intérieur ont un malus de 5% à tout leur jets.

+2 AP

Si touché par faiblesse :
Une explosion noire se produit, inflige autant de corruption que le dernier sort subi à coûté en chakra.
Résistance : Corruption

Vulnérabilité : Arcane
Espace/Temps
Cuisson instable
Élément Espace/Temps

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1.

Possède une esquive/parade supplémentaire peu importe la posture

+2 INI

Si touché par faiblesse :
Une implosion se produit, annule toutes amplifications positives et négatives sur tout le monde.
Résistance : Espace/Temps

Vulnérabilité :
Vide
Vide
Cuisson creuse
Élément Vide

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Dégâts divisé par 2

Ses armes ignorent les défenses ennemies.

Si touché par faiblesse :
Ses deux initiatives seront en premier et dernier quoi qu’il arrive pour le prochain tour.
Résistance : Vide

Vulnérabilité : Espace/Temps
Nécromancie
Miche moisie
Élément Nécromancie

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+5 AP

Draine la santé de ses ennemis à hauteur de 10% des dégâts infligés.

-6 dégâts

Si touché par faiblesse :
Une onde choc retentit sur le terrain et inflige 10 dégâts de sang perce AM et force un jet de vigueur à ceux qui sont touchés, s''ils ratent : Malus de 20% au prochain test pour éviter une altération d’état.
Résistance : Nécromancie

Vulnérabilité : Sang
Feu
Caramélisation
Élément Feu

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+3 dégâts

+2 AP

Si touché par faiblesse :
(Défense impossible) Invoque un nuage sur le terrain pendant 1 tour, inflige 10 dégâts de glace perce AM aux ennemis et impose un malus de 10% pour toucher une cible.
Résistance : Feu

Vulnérabilité : Glace
Eau
Croûte imbibé
Élément Eau

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

La régénération lui donne 15 santé au lieu de 10.

+5 AM

-3 Initiative

Si touché par faiblesse :
Provoque un violent arc électrique autour de lui, inflige 20 dégâts de foudre dans un rayon de 6 cases autour et force un jet de vigueur, si c’est raté : Bloque le sprint pour le prochain tour.
Résistance : Eau

Vulnérabilité : Foudre
Glace
Congélation
Élément Glace

40% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+10 AM

-1 vitesse

Si touché par faiblesse :
(Défense impossible)
Produit une poussée autour du golem qui inflige 10 dégâts de feu perce AM et repousse de 4 cases les cibles à 1-2 cases de lui.
Résistance : Glace

Vulnérabilité : Feu
Terre
Levain rustique
Élément Terre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+5 dégâts

+10 AP

-1 Vitesse

Si touché par faiblesse :
Explosion de fragments de croûte de pain, inflige 20 dégâts de taille/vent à tous les ennemis dans un rayon de 6 cases.
Résistance : Terre

Vulnérabilité : Vent
Vent
Levain actif
Élément Vent

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+1 Vitesse

Si touché par faiblesse :
Provoque une onde de choc, inflige 10 dégâts de terre perce AM et force un jet de stabilité/réflexe pour ne pas tomber au sol.
Résistance : Vent

Vulnérabilité : Terre
Foudre
Croûte électrique
Élément Foudre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+3 dégâts

+10 Initiative

Si touché par faiblesse :

Résistance : Foudre

Vulnérabilité : Eau
Lumière
Dorure sacré
Élément Lumière

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Annule 5 dégâts d’une attaque encaissée, cette réduction se recharge après chaque attaque et elle n’est pas affectée par les attaques qui ignorent les défenses.

Si touché par faiblesse :
Toute la lumière se libère d’un coup, forçant un jet de vigueur aux ennemis qui le voit, ceux qui rate encaissent aveuglement 2 pendant 2 tours.
Résistance : Lumière

Vulnérabilité : Ombre
Ombre
Dorure maudite
Élément Ombre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

L’attaque de cette créature possède l’effet du sort “Malédiction” de la magie de l’ombre et l’impose pour 1 tour à la victime.

Si touché par faiblesse :
L’ombre de la créature se manifeste le temps d’une attaque et va frapper l’ennemi le plus proche avec les mêmes dégâts que le golem.
Résistance : Ombre

Vulnérabilité : Lumière
Neutre
(c’est de le cas où il n’a pas subi de dégâts magique encore)

Aucune propriété
Résistant à tous les dégâts physiques', 'La peau de cette créature réagit aux éléments qu’on lui inflige, changeant sa peau et lui donne des propriétés. Cet état dure 3 tours tant qu’un autre élément n’est pas utilisé pour le remplacer, au bout de 3 tours, il redevient neutre. Utiliser un élément contraire à celui actif enclenche une “contre-cuisson”, l’effet de contre cuisson peut être esquiver ou parer s’il inflige des dégâts (sauf contre indication).
Voir le tableau plus bas.

Élément
Effets/Description
Résistance Vulnérabilité
Sang
Miche sacrificielle
Élément Sang

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Folle de guerre

+12 dégâts mais perd 5% de sa santé max à chaque coup réussi ou raté.

Si touché par faiblesse :
Un nuage mauvais est invoqué, pendant 1 tour, les soins prodigués sont divisés par 2.
Résistance : Sang

Vulnérabilité : Nécromancie
Arcane
Pain blanc
Élément Arcane

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Renvoi à hauteur de 25% des effets du sort de l’adversaire (l’agresseur peut se défendre contre cette contre attaque si c’est possible)

+2 AM

Si touché par faiblesse :
Une explosion se produit, force les ennemis un jet de fermeté, si ils ratent : Perd 3d10 {{chakra|chakra}}.
Résistance : Arcane

Vulnérabilité : Corruption
Corruption
Pain noir
Élément Corruption

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Possède une aura négative de 2 cases de rayon, les ennemis à l’intérieur ont un malus de 5% à tout leur jets.

+2 AP

Si touché par faiblesse :
Une explosion noire se produit, inflige autant de {{corruption|corruption}} que le dernier sort subi à coûté en {{chakra|chakra}}.
Résistance : Corruption

Vulnérabilité : Arcane
Espace/Temps
Cuisson instable
Élément Espace/Temps

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1.

Possède une esquive/parade supplémentaire peu importe la posture

+2 INI

Si touché par faiblesse :
Une implosion se produit, annule toutes amplifications positives et négatives sur tout le monde.
Résistance : Espace/Temps

Vulnérabilité :
Vide
Vide
Cuisson creuse
Élément Vide

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Dégâts divisé par 2

Ses armes ignorent les défenses ennemies.

Si touché par faiblesse :
Ses deux initiatives seront en premier et dernier quoi qu’il arrive pour le prochain tour.
Résistance : Vide

Vulnérabilité : Espace/Temps
Nécromancie
Miche moisie
Élément Nécromancie

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+5 AP

Draine la santé de ses ennemis à hauteur de 10% des dégâts infligés.

-6 dégâts

Si touché par faiblesse :
Une onde choc retentit sur le terrain et inflige 10 dégâts de sang perce AM et force un jet de vigueur à ceux qui sont touchés, s''ils ratent : Malus de 20% au prochain test pour éviter une altération d’état.
Résistance : Nécromancie

Vulnérabilité : Sang
Feu
Caramélisation
Élément Feu

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+3 dégâts

+2 AP

Si touché par faiblesse :
(Défense impossible) Invoque un nuage sur le terrain pendant 1 tour, inflige 10 dégâts de glace perce AM aux ennemis et impose un malus de 10% pour toucher une cible.
Résistance : Feu

Vulnérabilité : Glace
Eau
Croûte imbibé
Élément Eau

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

La régénération lui donne 15 santé au lieu de 10.

+5 AM

-3 Initiative

Si touché par faiblesse :
Provoque un violent arc électrique autour de lui, inflige 20 dégâts de foudre dans un rayon de 6 cases autour et force un jet de vigueur, si c’est raté : Bloque le sprint pour le prochain tour.
Résistance : Eau

Vulnérabilité : Foudre
Glace
Congélation
Élément Glace

40% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+10 AM

-1 vitesse

Si touché par faiblesse :
(Défense impossible)
Produit une poussée autour du golem qui inflige 10 dégâts de feu perce AM et repousse de 4 cases les cibles à 1-2 cases de lui.
Résistance : Glace

Vulnérabilité : Feu
Terre
Levain rustique
Élément Terre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+5 dégâts

+10 AP

-1 Vitesse

Si touché par faiblesse :
Explosion de fragments de croûte de pain, inflige 20 dégâts de taille/vent à tous les ennemis dans un rayon de 6 cases.
Résistance : Terre

Vulnérabilité : Vent
Vent
Levain actif
Élément Vent

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+1 Vitesse

Si touché par faiblesse :
Provoque une onde de choc, inflige 10 dégâts de terre perce AM et force un jet de stabilité/réflexe pour ne pas tomber au sol.
Résistance : Vent

Vulnérabilité : Terre
Foudre
Croûte électrique
Élément Foudre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

+3 dégâts

+10 Initiative

Si touché par faiblesse :

Résistance : Foudre

Vulnérabilité : Eau
Lumière
Dorure sacré
Élément Lumière

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

Annule 5 dégâts d’une attaque encaissée, cette réduction se recharge après chaque attaque et elle n’est pas affectée par les attaques qui ignorent les défenses.

Si touché par faiblesse :
Toute la lumière se libère d’un coup, forçant un jet de vigueur aux ennemis qui le voit, ceux qui rate encaissent aveuglement 2 pendant 2 tours.
Résistance : Lumière

Vulnérabilité : Ombre
Ombre
Dorure maudite
Élément Ombre

20% de chance de forcer un jet de vigueur aux ennemis pour ne pas prendre l’altération d’état de la magie stade 1

L’attaque de cette créature possède l’effet du sort “Malédiction” de la magie de l’ombre et l’impose pour 1 tour à la victime.

Si touché par faiblesse :
L’ombre de la créature se manifeste le temps d’une attaque et va frapper l’ennemi le plus proche avec les mêmes dégâts que le golem.
Résistance : Ombre

Vulnérabilité : Lumière
Neutre
(c’est de le cas où il n’a pas subi de dégâts magique encore)

Aucune propriété
Résistant à tous les dégâts physiques', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"cuisson-absolue"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 387, 'bestiaire', 'Capacités de monstre', 'Élément aléatoire', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature peut être de différentes formes et possède un bonus différent selon la magie auquel il est relié. Et avec tout ça, une de ses armes* naturelles est capable d''infliger l’élément relié.
Sang = Force le jet de vigueur/fermeté à chaque attaque réussi pour empêcher le marquage
Arcane = Retire 1d6 chakra à la cible
Corruption = Inflige 4 corruption a chaque attaque réussi
Espace/Temps = Retire 1 vitesse à la cible pour son prochain tour à chaque attaque réussi
Vide = Force le jet de vigueur/fermeté à chaque attaque réussi pour empêcher le silence
Nécromancie = Pose une charge de nécrose, au bout de 5 charges, la cible tombe dans le coma
Feu = Bonus de +3 aux dégâts
Eau = Soigne une altération d’état à chaque début de tour
Glace = Double l’AM
Terre = Double l’AP
Vent = +1 Vitesse
Foudre = +5 INI
Lumière = Régénère 5 santé au début de chaque tour
Ombre = Attaque sournoise', 'Cette créature peut être de différentes formes et possède un bonus différent selon la magie auquel il est relié. Et avec tout ça, une de ses armes* naturelles est capable d''infliger l’élément relié.
Sang = Force le jet de vigueur/fermeté à chaque attaque réussi pour empêcher le marquage
Arcane = Retire 1d6 {{chakra|chakra}} à la cible
Corruption = Inflige 4 {{corruption|corruption}} a chaque attaque réussi
Espace/Temps = Retire 1 vitesse à la cible pour son prochain tour à chaque attaque réussi
Vide = Force le jet de vigueur/fermeté à chaque attaque réussi pour empêcher le silence
Nécromancie = Pose une charge de nécrose, au bout de 5 charges, la cible tombe dans le coma
Feu = Bonus de +3 aux dégâts
Eau = Soigne une altération d’état à chaque début de tour
Glace = Double l’AM
Terre = Double l’AP
Vent = +1 Vitesse
Foudre = +5 INI
Lumière = Régénère 5 santé au début de chaque tour
Ombre = Attaque sournoise', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"element-aleatoire"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 388, 'bestiaire', 'Capacités de monstre', 'Encrier', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Chaque tir réussi a {5}% d’appliquer 2d6 points de corruption et réduit de {5}% les jets pour résister à une altération d''état.', 'Chaque tir réussi a {5}% d’appliquer 2d6 points de {{corruption|corruption}} et réduit de {5}% les jets pour résister à une altération d''état.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"encrier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 389, 'bestiaire', 'Capacités de monstre', 'Explosion noire', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Si cette créature perd 25% de sa santé max alors qu’il n’est pas enflammé, il libère de la matière partout autour de lui, obligeant un jet de parade/esquive avec un malus de 20% à tous ceux présent sur le terrain. Inflige 2d6 de corruption et 30 dégâts neutre (réduisible par l’AM).', 'Si cette créature perd 25% de sa santé max alors qu’il n’est pas enflammé, il libère de la matière partout autour de lui, obligeant un jet de parade/esquive avec un malus de 20% à tous ceux présent sur le terrain. Inflige 2d6 de {{corruption|corruption}} et 30 dégâts neutre (réduisible par l’AM).', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"explosion-noire"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 390, 'bestiaire', 'Capacités de monstre', 'Forme météo+ (forme-meteo-plus)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature possède une structure particulière qui fait qu’elle se modifier selon la météo, elle possède également 10% de chance de forcer un jet de vigueur/fermeté à son adversaire pour ne pas qu’il encaisse l’altération d’état lié à son/ses élément(s) :
Neutre : +10 dégâts avec les armes
Grand soleil : Élément Lumière, les soins ennemis sont réduits au lieu d’être amplifiés.
Canicule : Élément Feu, malus de 20% pour esquiver les brûlures.
Pluie : Élément Eau, +20% de chance en plus d’infliger “confusion 1”.
Pluie diluvienne : Élément Eau, la météo inflige 2d6 dégâts non élémentaire au début de chaque tour.
Neige : Élément Glace, double l’AM.
Tempête de neige : Élément Glace, triple l’AM.
Vent violent : Élément Vent, +2 vitesse et INI.
Brouillard : Élément Nécromancie, malus de 10% aux ennemis pour toucher la créature.
Purée de pois : Élément Nécromancie, malus de 20% aux ennemis pour toucher la créature.
Brouillard obscur : Élément Ombre, pose l’effet du sort “malédiction” pendant un tour sur la cible après une attaque réussi.
Orage : Élément Foudre et Espace/Temps, +20% de chance en plus d’infliger “paralysie 1”.
Champ magnétique : Élément Foudre et Terre, double l’AP.
Tempête de sable : Élément Vent et Terre, double l’AP.
Lune de sang : Élément Sang, la créature peut faire les sorts “Sang” en IC sans jet et sans coût (sauf le Sang perfection)
Éclipse : Élément Lumière et Ombre, les magies désavantagées sont tout simplement désactivées.
Crachin blanc : Élément Arcane, chaque attaque brûlera 2d6 chakra à la cible.
Pluie pétrole : Élément Corruption, chaque attaque inflige 2d4 corruption.
Saccage temporel : Élément Vide, au début de chaque tour - un ennemi aléatoire va voir sa magie désactivée.', 'Cette créature possède une structure particulière qui fait qu’elle se modifier selon la météo, elle possède également 10% de chance de forcer un jet de vigueur/fermeté à son adversaire pour ne pas qu’il encaisse l’altération d’état lié à son/ses élément(s) :
Neutre : +10 dégâts avec les armes
Grand soleil : Élément Lumière, les soins ennemis sont réduits au lieu d’être amplifiés.
Canicule : Élément Feu, malus de 20% pour esquiver les brûlures.
Pluie : Élément Eau, +20% de chance en plus d’infliger “confusion 1”.
Pluie diluvienne : Élément Eau, la météo inflige 2d6 dégâts non élémentaire au début de chaque tour.
Neige : Élément Glace, double l’AM.
Tempête de neige : Élément Glace, triple l’AM.
Vent violent : Élément Vent, +2 vitesse et INI.
Brouillard : Élément Nécromancie, malus de 10% aux ennemis pour toucher la créature.
Purée de pois : Élément Nécromancie, malus de 20% aux ennemis pour toucher la créature.
Brouillard obscur : Élément Ombre, pose l’effet du sort “malédiction” pendant un tour sur la cible après une attaque réussi.
Orage : Élément Foudre et Espace/Temps, +20% de chance en plus d’infliger “paralysie 1”.
Champ magnétique : Élément Foudre et Terre, double l’AP.
Tempête de sable : Élément Vent et Terre, double l’AP.
Lune de sang : Élément Sang, la créature peut faire les sorts “Sang” en IC sans jet et sans coût (sauf le Sang perfection)
Éclipse : Élément Lumière et Ombre, les magies désavantagées sont tout simplement désactivées.
Crachin blanc : Élément Arcane, chaque attaque brûlera 2d6 {{chakra|chakra}} à la cible.
Pluie pétrole : Élément Corruption, chaque attaque inflige 2d4 {{corruption|corruption}}.
Saccage temporel : Élément Vide, au début de chaque tour - un ennemi aléatoire va voir sa magie désactivée.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"forme-meteo-plus"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 391, 'bestiaire', 'Capacités de monstre', 'Immatériel', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature est naturellement immunisée aux dégâts physiques (armes) , seules la magie, une arme spectrale ou une arme sous l’effet d’un sort “fer” peuvent la toucher.', 'Cette créature est naturellement immunisée aux dégâts physiques (armes) , seules la magie, une arme spectrale ou une arme sous l’effet d’un {{sort-fer|sort “fer”}} peuvent la toucher.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"immateriel"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 392, 'bestiaire', 'Capacités de monstre', 'Lame foudroyante', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', '(IC) En échange de 5 chakra, la prochaine attaque physique au contact libère une foudre qui inflige 1d8 dégâts qui va ignorer l’AM et l’AP de la cible.', '(IC) En échange de 5 {{chakra|chakra}}, la prochaine attaque physique au contact libère une foudre qui inflige 1d8 dégâts qui va ignorer l’AM et l’AP de la cible.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"lame-foudroyante"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 393, 'bestiaire', 'Capacités de monstre', 'Larmes du paria', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Quand la créature tombe en dessous de 50% de santé = Pétrolier passe à 7 corruption, chaque attaque au contact subit force l''assaillant un jet de fermeté pour ne pas prendre "surcharge magique 1".', 'Quand la créature tombe en dessous de 50% de santé = Pétrolier passe à 7 {{corruption|corruption}}, chaque attaque au contact subit force l''assaillant un jet de fermeté pour ne pas prendre "surcharge magique 1".', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"larmes-du-paria"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 394, 'bestiaire', 'Capacités de monstre', 'Laser de fer (laser-de-fer)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Tire tous les trois tours un laser qui passe à travers toutes les protections physiques, magiques, la barrière. Il est parable et esquivable. Ceci est un IC.', 'Tire tous les trois tours un laser qui passe à travers toutes les protections physiques, magiques, la {{barriere|barrière}}. Il est parable et esquivable. Ceci est un IC.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"laser-de-fer"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 395, 'bestiaire', 'Capacités de monstre', 'Laser de fer+ (laser-de-fer-plus)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Tire tous les deux tours un laser qui passe à travers toutes les protections physiques, magiques, la barrière. Il est parable et esquivable. Ceci est un IC.', 'Tire tous les deux tours un laser qui passe à travers toutes les protections physiques, magiques, la {{barriere|barrière}}. Il est parable et esquivable. Ceci est un IC.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"laser-de-fer-plus"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 396, 'bestiaire', 'Capacités de monstre', 'Laser de fer++ (laser-de-fer-plus-plus)', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Tire tous les tours un laser qui passe à travers toutes les protections physiques, magiques, la barrière. Il est parable et esquivable. Ceci est un IC.', 'Tire tous les tours un laser qui passe à travers toutes les protections physiques, magiques, la {{barriere|barrière}}. Il est parable et esquivable. Ceci est un IC.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"laser-de-fer-plus-plus"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 397, 'bestiaire', 'Capacités de monstre', 'Morsure aspirante bleue', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'La morsure de cette créature est capable d’aspirer le chakra de sa victime à hauteur de {25}% par rapport aux dégâts infligés avec l’attaque.', 'La morsure de cette créature est capable d’aspirer le {{chakra|chakra}} de sa victime à hauteur de {25}% par rapport aux dégâts infligés avec l’attaque.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"morsure-aspirante-bleue"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 398, 'bestiaire', 'Capacités de monstre', 'Mourir peut attendre', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature n’a que la moitié de sa santé qu’elle est censée avoir. Quand elle tombe en dessous de 0 santé, elle sombre dans une mort temporaire qui ne dure qu’un tour, à la fin de ce dernier, elle revient avec toute sa santé et barrière. La deuxième mort est fatale par contre.', 'Cette créature n’a que la moitié de sa santé qu’elle est censée avoir. Quand elle tombe en dessous de 0 santé, elle sombre dans une mort temporaire qui ne dure qu’un tour, à la fin de ce dernier, elle revient avec toute sa santé et {{barriere|barrière}}. La deuxième mort est fatale par contre.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"mourir-peut-attendre"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 399, 'bestiaire', 'Capacités de monstre', 'Nécrophage', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Manger de la viande de cadavre redonne 3d8 barrière.', 'Manger de la viande de cadavre redonne 3d8 {{barriere|barrière}}.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"necrophage"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 400, 'bestiaire', 'Capacités de monstre', 'Pétrolier', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Chaque attaque qui touche inflige 5 corruption.', 'Chaque attaque qui touche inflige 5 {{corruption|corruption}}.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"petrolier"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 401, 'bestiaire', 'Capacités de monstre', 'Poison noir', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Chaque attaque de cette créature infligent de la corruption à hauteur de 10% des dégâts infligés (minimum 1 corruption infligé)', 'Chaque attaque de cette créature infligent de la {{corruption|corruption}} à hauteur de 10% des dégâts infligés (minimum 1 {{corruption|corruption}} infligé)', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"poison-noir"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 402, 'bestiaire', 'Capacités de monstre', 'Rayon Lune', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Régénère 25% de la barrière la nuit. (Action 2 fois/nuit)', 'Régénère 25% de la {{barriere|barrière}} la nuit. (Action 2 fois/nuit)', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"rayon-lune"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 403, 'bestiaire', 'Capacités de monstre', 'Réflexe éclair', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', '(IC) En échange de 5 chakra, augmente son prochain jet de défense de 10%.', '(IC) En échange de 5 {{chakra|chakra}}, augmente son prochain jet de défense de 10%.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"reflexe-eclair"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 404, 'bestiaire', 'Capacités de monstre', 'Régénération magique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature récupère 5 chakra au début de son tour.', 'Cette créature récupère 5 {{chakra|chakra}} au début de son tour.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"regeneration-magique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 405, 'bestiaire', 'Capacités de monstre', 'Réparation', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature récupère 2d6 barrière au début de son tour.', 'Cette créature récupère 2d6 {{barriere|barrière}} au début de son tour.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"reparation"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 406, 'bestiaire', 'Capacités de monstre', 'Serviteur toxique', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature n’attaque pas directement, elle se cache derrière une cage d’os indestructible et lance ses invocations contre ses ennemis, elle peut en invoquer 4 à la fois, sans jet, a accès à toutes les invocations de la nécromancie et les remplace le tour après leur mort. Une fois qu’une invocation est tuée, la santé qu’elle possédait sera infligée contre la santé du boss (pas sa barrière). Il peut lancer les invocations selon son niveau de puissance magique.', 'Cette créature n’attaque pas directement, elle se cache derrière une cage d’os indestructible et lance ses invocations contre ses ennemis, elle peut en invoquer 4 à la fois, sans jet, a accès à toutes les invocations de la nécromancie et les remplace le tour après leur mort. Une fois qu’une invocation est tuée, la santé qu’elle possédait sera infligée contre la santé du boss (pas sa {{barriere|barrière}}). Il peut lancer les invocations selon son niveau de puissance magique.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"serviteur-toxique"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 407, 'bestiaire', 'Capacités de monstre', 'Suçon', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Chaque attaque redonne de la santé ou de la barrière (selon ce qui est touché) à hauteur de 50% des dégâts infligés.', 'Chaque attaque redonne de la santé ou de la {{barriere|barrière}} (selon ce qui est touché) à hauteur de 50% des dégâts infligés.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"sucon"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 408, 'bestiaire', 'Capacités de monstre', 'Super barrière', 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', 'modifie', 'Cette créature possède une barrière qui correspond à son chakra.', 'Cette créature possède une {{barriere|barrière}} qui correspond à son {{chakra|chakra}}.', 'neutre', NULL, 'monstre_capacite_commune', '{"id":"super-barriere"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 409, 'armes', 'BÂTON DE COMBAT', 'Crosse d''argent', 'Effet (dégâts, portée, solidité, origine… : les colonnes en sont tirées)', 'modifie', 'Dégâts frappe, portée 1-2, permet de sacrifier 10 Chakra pour augmenter la réussite de la prochaine attaque de 5%, +6 dégâts, Facture Temple de l''Arcane', 'Dégâts frappe, portée 1-2, permet de sacrifier 10 {{chakra|Chakra}} pour augmenter la réussite de la prochaine attaque de 5%, +6 dégâts, Facture Temple de l''Arcane', 'neutre', NULL, 'arme', '{"id":"ressources/armes#arme:baton-de-combat:crosse-dargent"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 410, 'armes', 'BÂTON DE COMBAT', 'Crosse d''argent', 'Description', 'modifie', 'Arme régulière du Temple de l''Arcane, cette crosse assez puissante permet d''exploiter son chakra pour augmenter les chances de réussite.', 'Arme régulière du Temple de l''Arcane, cette crosse assez puissante permet d''exploiter son {{chakra|chakra}} pour augmenter les chances de réussite.', 'neutre', NULL, 'arme', '{"id":"ressources/armes#arme:baton-de-combat:crosse-dargent"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 411, 'armes', 'BÂTON DE COMBAT', 'Croc d''Obsidienne', 'Effet (dégâts, portée, solidité, origine… : les colonnes en sont tirées)', 'modifie', 'Dégâts frappe, portée 1-2, permet de sacrifier 10 Corruption pour augmenter la réussite de la prochaine attaque de 5%, +6 dégâts, Facture Temple Noir', 'Dégâts frappe, portée 1-2, permet de sacrifier 10 {{corruption|Corruption}} pour augmenter la réussite de la prochaine attaque de 5%, +6 dégâts, Facture Temple Noir', 'neutre', NULL, 'arme', '{"id":"ressources/armes#arme:baton-de-combat:croc-obsidien"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 412, 'armes', 'BÂTON DE COMBAT', 'Croc d''Obsidienne', 'Description', 'modifie', 'Arme régulière du Temple noir, ce bâton qui a la forme d''un croc permet de sacrifier de la corruption pour augmenter les chances de réussite.', 'Arme régulière du Temple noir, ce bâton qui a la forme d''un croc permet de sacrifier de la {{corruption|corruption}} pour augmenter les chances de réussite.', 'neutre', NULL, 'arme', '{"id":"ressources/armes#arme:baton-de-combat:croc-obsidien"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 413, 'armes', 'BOMBES', 'Bombe perçante', 'Remarque', 'retire', 'Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. Ce n''est pas considéré comme un Canon d''artifice.', NULL, 'neutre', NULL, 'arme', '{"id":"ressources/armes#arme:bombes:bombe-percante"}', 'remarque');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 414, 'armures', 'Bocle', 'Bocle Acier', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:acier"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 415, 'armures', 'Bocle', 'Bocle Argent', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 416, 'armures', 'Bocle', 'Bocle Bois', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:bois"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 417, 'armures', 'Bocle', 'Bocle Bronze', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:bronze"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 418, 'armures', 'Bocle', 'Bocle Cellulose', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:cellulose"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 419, 'armures', 'Bocle', 'Bocle Chitine', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:chitine"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 420, 'armures', 'Bocle', 'Bocle Corail', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:corail"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 421, 'armures', 'Bocle', 'Bocle Corne', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:corne-os"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 422, 'armures', 'Bocle', 'Bocle Cuir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:cuir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 423, 'armures', 'Bocle', 'Bocle Cuivre', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:cuivre"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 424, 'armures', 'Bocle', 'Bocle Écailles', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:ecailles"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 425, 'armures', 'Bocle', 'Bocle Fer', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:fer"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 426, 'armures', 'Bocle', 'Bocle Fer Noir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:fer-noir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 427, 'armures', 'Bocle', 'Bocle Fonte', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:fonte"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 428, 'armures', 'Bocle', 'Bocle Laiton', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:laiton"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 429, 'armures', 'Bocle', 'Bocle Maverium', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:maverium"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 430, 'armures', 'Bocle', 'Bocle Mythril', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:mythril"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 431, 'armures', 'Bocle', 'Bocle Or', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:or"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 432, 'armures', 'Bocle', 'Bocle Titane', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:titane"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 433, 'armures', 'Bocle', 'Bocle Vif-Argent', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bocle:vif-argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 434, 'armures', 'Targe', 'Targe Acier', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:acier"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 435, 'armures', 'Targe', 'Targe Argent', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 436, 'armures', 'Targe', 'Targe Bois', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:bois"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 437, 'armures', 'Targe', 'Targe Bronze', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:bronze"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 438, 'armures', 'Targe', 'Targe Cellulose', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:cellulose"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 439, 'armures', 'Targe', 'Targe Chitine', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:chitine"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 440, 'armures', 'Targe', 'Targe Corail', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:corail"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 441, 'armures', 'Targe', 'Targe Corne', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:corne-os"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 442, 'armures', 'Targe', 'Targe Cuir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:cuir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 443, 'armures', 'Targe', 'Targe Cuivre', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:cuivre"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 444, 'armures', 'Targe', 'Targe Écailles', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:ecailles"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 445, 'armures', 'Targe', 'Targe Fer', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:fer"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 446, 'armures', 'Targe', 'Targe Fer Noir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:fer-noir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 447, 'armures', 'Targe', 'Targe Fonte', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:fonte"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 448, 'armures', 'Targe', 'Targe Laiton', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:laiton"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 449, 'armures', 'Targe', 'Targe Maverium', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:maverium"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 450, 'armures', 'Targe', 'Targe Mythril', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:mythril"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 451, 'armures', 'Targe', 'Targe Or', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:or"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 452, 'armures', 'Targe', 'Targe Titane', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:titane"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 453, 'armures', 'Targe', 'Targe Vif-Argent', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:targe:vif-argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 454, 'armures', 'Bouclier Rond', 'Bouclier Rond Acier', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:acier"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 455, 'armures', 'Bouclier Rond', 'Bouclier Rond Argent', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 456, 'armures', 'Bouclier Rond', 'Bouclier Rond Bois', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:bois"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 457, 'armures', 'Bouclier Rond', 'Bouclier Rond Bronze', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:bronze"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 458, 'armures', 'Bouclier Rond', 'Bouclier Rond Cellulose', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:cellulose"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 459, 'armures', 'Bouclier Rond', 'Bouclier Rond Chitine', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:chitine"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 460, 'armures', 'Bouclier Rond', 'Bouclier Rond Corail', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:corail"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 461, 'armures', 'Bouclier Rond', 'Bouclier Rond Corne', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:corne-os"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 462, 'armures', 'Bouclier Rond', 'Bouclier Rond Cuir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:cuir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 463, 'armures', 'Bouclier Rond', 'Bouclier Rond Cuivre', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:cuivre"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 464, 'armures', 'Bouclier Rond', 'Bouclier Rond Écailles', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:ecailles"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 465, 'armures', 'Bouclier Rond', 'Bouclier Rond Fer', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:fer"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 466, 'armures', 'Bouclier Rond', 'Bouclier Rond Fer Noir', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:fer-noir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 467, 'armures', 'Bouclier Rond', 'Bouclier Rond Fonte', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:fonte"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 468, 'armures', 'Bouclier Rond', 'Bouclier Rond Laiton', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:laiton"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 469, 'armures', 'Bouclier Rond', 'Bouclier Rond Maverium', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:maverium"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 470, 'armures', 'Bouclier Rond', 'Bouclier Rond Mythril', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:mythril"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 471, 'armures', 'Bouclier Rond', 'Bouclier Rond Or', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:or"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 472, 'armures', 'Bouclier Rond', 'Bouclier Rond Titane', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:titane"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 473, 'armures', 'Bouclier Rond', 'Bouclier Rond Vif-Argent', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:bouclier-rond:vif-argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 474, 'armures', 'Écu', 'Écu Acier', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:acier"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 475, 'armures', 'Écu', 'Écu Argent', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 476, 'armures', 'Écu', 'Écu Bois', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:bois"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 477, 'armures', 'Écu', 'Écu Bronze', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:bronze"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 478, 'armures', 'Écu', 'Écu Cellulose', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:cellulose"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 479, 'armures', 'Écu', 'Écu Chitine', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:chitine"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 480, 'armures', 'Écu', 'Écu Corail', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:corail"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 481, 'armures', 'Écu', 'Écu Corne', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:corne-os"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 482, 'armures', 'Écu', 'Écu Cuir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:cuir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 483, 'armures', 'Écu', 'Écu Cuivre', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:cuivre"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 484, 'armures', 'Écu', 'Écu Écailles', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:ecailles"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 485, 'armures', 'Écu', 'Écu Fer', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:fer"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 486, 'armures', 'Écu', 'Écu Fer Noir', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:fer-noir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 487, 'armures', 'Écu', 'Écu Fonte', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:fonte"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 488, 'armures', 'Écu', 'Écu Laiton', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:laiton"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 489, 'armures', 'Écu', 'Écu Maverium', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:maverium"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 490, 'armures', 'Écu', 'Écu Mythril', 'Poids', 'ajoute', NULL, 'Lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:mythril"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 491, 'armures', 'Écu', 'Écu Or', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:or"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 492, 'armures', 'Écu', 'Écu Titane', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:titane"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 493, 'armures', 'Écu', 'Écu Vif-Argent', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:ecu:vif-argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 494, 'armures', 'Pavois', 'Pavois Acier', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:acier"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 495, 'armures', 'Pavois', 'Pavois Argent', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 496, 'armures', 'Pavois', 'Pavois Bois', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:bois"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 497, 'armures', 'Pavois', 'Pavois Bronze', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:bronze"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 498, 'armures', 'Pavois', 'Pavois Cellulose', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:cellulose"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 499, 'armures', 'Pavois', 'Pavois Chitine', 'Poids', 'ajoute', NULL, 'Moyen', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:chitine"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 500, 'armures', 'Pavois', 'Pavois Corail', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:corail"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 501, 'armures', 'Pavois', 'Pavois Corne', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:corne-os"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 502, 'armures', 'Pavois', 'Pavois Cuir', 'Poids', 'ajoute', NULL, 'Léger', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:cuir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 503, 'armures', 'Pavois', 'Pavois Cuivre', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:cuivre"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 504, 'armures', 'Pavois', 'Pavois Écailles', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:ecailles"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 505, 'armures', 'Pavois', 'Pavois Fer', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:fer"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 506, 'armures', 'Pavois', 'Pavois Fer Noir', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:fer-noir"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 507, 'armures', 'Pavois', 'Pavois Fonte', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:fonte"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 508, 'armures', 'Pavois', 'Pavois Laiton', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:laiton"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 509, 'armures', 'Pavois', 'Pavois Maverium', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:maverium"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 510, 'armures', 'Pavois', 'Pavois Mythril', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:mythril"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 511, 'armures', 'Pavois', 'Pavois Or', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:or"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 512, 'armures', 'Pavois', 'Pavois Titane', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:titane"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 513, 'armures', 'Pavois', 'Pavois Vif-Argent', 'Poids', 'ajoute', NULL, 'Très lourd', 'neutre', NULL, 'bouclier', '{"id":"ressources/bouclier#bouclier:pavoi:vif-argent"}', 'poids_id');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 514, 'armures', 'Améliorations de bouclier', 'Amélioration +1', 'Coût en RO (bouclier)', 'modifie', '500', '50', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:1"}', 'cout_ro');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 515, 'armures', 'Améliorations de bouclier', 'Amélioration +2', 'Coût en RO (bouclier)', 'modifie', '1000', '100', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:2"}', 'cout_ro');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 516, 'armures', 'Améliorations de bouclier', 'Amélioration +2', 'Coût en matériaux (bouclier : 1 matériau de sa matière, décision R76)', 'modifie', 'Non', 'Oui', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:2"}', 'cout_materiaux');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 517, 'armures', 'Améliorations de bouclier', 'Amélioration +3', 'Coût en RO (bouclier)', 'modifie', '2000', '200', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:3"}', 'cout_ro');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 518, 'armures', 'Améliorations de bouclier', 'Amélioration +4', 'Coût en RO (bouclier)', 'modifie', '4000', '400', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:4"}', 'cout_ro');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 519, 'armures', 'Améliorations de bouclier', 'Amélioration +4', 'Coût en matériaux (bouclier : 1 matériau de sa matière, décision R76)', 'modifie', 'Non', 'Oui', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:4"}', 'cout_materiaux');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 520, 'armures', 'Améliorations de bouclier', 'Amélioration +5', 'Coût en RO (bouclier)', 'modifie', '8000', '800', 'neutre', NULL, 'amelioration_equipement', '{"id":"ressources/bouclier#amelioration:bouclier:5"}', 'cout_ro');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 521, 'equipement', NULL, '5 panneaux de règles', NULL, 'ajoute', NULL, '5 panneaux de règles', 'neutre', NULL, 'panneau_regles', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 522, 'equipement', 'Ceinture › Fioles', 'Méga fiole beige', 'Effet', 'modifie', 'Soigne le coma, remonte la santé à 0 et donne 100% de santé', 'Soigne le coma et donne 100% de santé', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-beige#potion:mega-fiole-beige"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 523, 'equipement', 'Ceinture › Fioles', 'Petite fiole blanche', 'Effet', 'modifie', 'Régénère 5 chakra chaque tour. Dure 3 tours', 'Régénère 5 {{chakra|chakra}} chaque tour. Dure 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-blanche#potion:petite-fiole-blanche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 524, 'equipement', 'Ceinture › Fioles', 'Fiole blanche moyenne', 'Effet', 'modifie', 'Régénère 10 chakra chaque tour. Dure 3 tours', 'Régénère 10 {{chakra|chakra}} chaque tour. Dure 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-blanche#potion:fiole-blanche-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 525, 'equipement', 'Ceinture › Fioles', 'Super fiole blanche', 'Effet', 'modifie', 'Régénère 20 chakra chaque tour. Dure 3 tours', 'Régénère 20 {{chakra|chakra}} chaque tour. Dure 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-blanche#potion:super-fiole-blanche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 526, 'equipement', 'Ceinture › Fioles', 'Méga fiole blanche', 'Effet', 'modifie', 'Régénère 40 chakra chaque tour. Dure 3 tours', 'Régénère 40 {{chakra|chakra}} chaque tour. Dure 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-blanche#potion:mega-fiole-blanche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 527, 'equipement', 'Ceinture › Fioles', 'Ultime fiole blanche', 'Effet', 'modifie', 'Augmente la chakra maximum de 10 (une fois par personnage)', 'Augmente la {{chakra|chakra}} maximum de 10 (une fois par personnage)', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-blanche#potion:ultime-fiole-blanche"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 528, 'equipement', 'Ceinture › Fioles', 'Petite fiole bleue', 'Effet', 'modifie', 'Récupère 2d8 + 5 chakra', 'Récupère 2d8 + 5 {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-bleue#potion:petite-fiole-bleue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 529, 'equipement', 'Ceinture › Fioles', 'Fiole bleue moyenne', 'Effet', 'modifie', 'Récupère 3d8 + 10 chakra', 'Récupère 3d8 + 10 {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-bleue#potion:fiole-bleue-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 530, 'equipement', 'Ceinture › Fioles', 'Super fiole bleue', 'Effet', 'modifie', 'Récupère 4d8 + 20 chakra', 'Récupère 4d8 + 20 {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-bleue#potion:super-fiole-bleue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 531, 'equipement', 'Ceinture › Fioles', 'Méga fiole bleue', 'Effet', 'modifie', 'Récupère 5d8 + 40 chakra', 'Récupère 5d8 + 40 {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-bleue#potion:mega-fiole-bleue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 532, 'equipement', 'Ceinture › Fioles', 'Ultime fiole bleue', 'Effet', 'modifie', 'Récupère 100% de chakra', 'Récupère 100% de {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-bleue#potion:ultime-fiole-bleue"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 533, 'equipement', 'Ceinture › Fioles', 'Petite fiole jaune', 'Effet', 'modifie', 'Récupère 2d8 + 5 barrière', 'Récupère 2d8 + 5 {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-jaune#potion:petite-fiole-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 534, 'equipement', 'Ceinture › Fioles', 'Fiole jaune moyenne', 'Effet', 'modifie', 'Récupère 3d8 + 10 barrière', 'Récupère 3d8 + 10 {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-jaune#potion:fiole-jaune-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 535, 'equipement', 'Ceinture › Fioles', 'Super fiole jaune', 'Effet', 'modifie', 'Récupère 4d8 + 20 barrière', 'Récupère 4d8 + 20 {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-jaune#potion:super-fiole-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 536, 'equipement', 'Ceinture › Fioles', 'Méga fiole jaune', 'Effet', 'modifie', 'Récupère 5d8 + 40 barrière', 'Récupère 5d8 + 40 {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-jaune#potion:mega-fiole-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 537, 'equipement', 'Ceinture › Fioles', 'Ultime fiole jaune', 'Effet', 'modifie', 'Récupère 100% de barrière', 'Récupère 100% de {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-jaune#potion:ultime-fiole-jaune"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 538, 'equipement', 'Ceinture › Fioles', 'Petite fiole mauve', 'Effet', 'modifie', 'Récupère 2d8 + 5 santé et chakra', 'Récupère 2d8 + 5 santé et {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-mauve#potion:petite-fiole-mauve"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 539, 'equipement', 'Ceinture › Fioles', 'Fiole mauve moyenne', 'Effet', 'modifie', 'Récupère 3d8 + 10 santé et chakra', 'Récupère 3d8 + 10 santé et {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-mauve#potion:fiole-mauve-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 540, 'equipement', 'Ceinture › Fioles', 'Super fiole mauve', 'Effet', 'modifie', 'Récupère 4d8 + 20 santé et chakra', 'Récupère 4d8 + 20 santé et {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-mauve#potion:super-fiole-mauve"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 541, 'equipement', 'Ceinture › Fioles', 'Méga fiole mauve', 'Effet', 'modifie', 'Récupère 5d8 + 40 santé et chakra', 'Récupère 5d8 + 40 santé et {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-mauve#potion:mega-fiole-mauve"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 542, 'equipement', 'Ceinture › Fioles', 'Ultime fiole mauve', 'Effet', 'modifie', 'Récupère 100% de santé et chakra', 'Récupère 100% de santé et {{chakra|chakra}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-mauve#potion:ultime-fiole-mauve"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 543, 'equipement', 'Ceinture › Fioles', 'Petite fiole multicolore', 'Effet', 'modifie', 'Redonne 2d8 + 5 santé, chakra et barrière
Redonne 2 de la 4ème barre
Soigne 2d8 corruption
Augmente l’AM et l’AP de base de 3 pendant 3 tours
Augmente l’initiative de 2 pendant 3 tours', 'Redonne 2d8 + 5 santé, {{chakra|chakra}} et {{barriere|barrière}}
Redonne 2 de la 4ème barre
Soigne 2d8 {{corruption|corruption}}
Augmente l’AM et l’AP de base de 3 pendant 3 tours
Augmente l’initiative de 2 pendant 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-multicolore#potion:petite-fiole-multicolore"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 544, 'equipement', 'Ceinture › Fioles', 'Fiole multicolore moyenne', 'Effet', 'modifie', 'Redonne 3d8 + 10 santé, chakra et barrière
Redonne 4 de la 4ème barre
Soigne 3d8 + 5 corruption
Augmente l’AM et l’AP de base de 5 pendant 3 tours
Augmente l’initiative de 5 pendant 3 tours', 'Redonne 3d8 + 10 santé, {{chakra|chakra}} et {{barriere|barrière}}
Redonne 4 de la 4ème barre
Soigne 3d8 + 5 {{corruption|corruption}}
Augmente l’AM et l’AP de base de 5 pendant 3 tours
Augmente l’initiative de 5 pendant 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-multicolore#potion:fiole-multicolore-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 545, 'equipement', 'Ceinture › Fioles', 'Super fiole multicolore', 'Effet', 'modifie', 'Redonne 4d8 + 20 santé, chakra et barrière
Redonne 7 de la 4ème barre
Soigne 4d8 + 10 corruption
Augmente l’AM et l’AP de base de 7 pendant 3 tours
Augmente la vitesse de 1 pendant 3 tours', 'Redonne 4d8 + 20 santé, {{chakra|chakra}} et {{barriere|barrière}}
Redonne 7 de la 4ème barre
Soigne 4d8 + 10 {{corruption|corruption}}
Augmente l’AM et l’AP de base de 7 pendant 3 tours
Augmente la vitesse de 1 pendant 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-multicolore#potion:super-fiole-multicolore"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 546, 'equipement', 'Ceinture › Fioles', 'Méga fiole multicolore', 'Effet', 'modifie', 'Redonne 5d8 + 40 santé, chakra et barrière
Redonne 10 de la 4ème barre
Soigne 5d8 + 15 corruption
Augmente l’AM et l’AP de base de 10 pendant 3 tours
Augmente la vitesse de 1 et l’INI de 2 pendant 3 tours', 'Redonne 5d8 + 40 santé, {{chakra|chakra}} et {{barriere|barrière}}
Redonne 10 de la 4ème barre
Soigne 5d8 + 15 {{corruption|corruption}}
Augmente l’AM et l’AP de base de 10 pendant 3 tours
Augmente la vitesse de 1 et l’INI de 2 pendant 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-multicolore#potion:mega-fiole-multicolore"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 547, 'equipement', 'Ceinture › Fioles', 'Ultime fiole multicolore', 'Effet', 'modifie', 'Redonne 100% santé, chakra et barrière
Redonne 100% de la 4ème barre
Soigne 100% corruption
Augmente l’AM et l’AP de base de 12 pendant 3 tours
Augmente la vitesse de 2 et l’INI de 5 pendant 3 tours', 'Redonne 100% santé, {{chakra|chakra}} et {{barriere|barrière}}
Redonne 100% de la 4ème barre
Soigne 100% {{corruption|corruption}}
Augmente l’AM et l’AP de base de 12 pendant 3 tours
Augmente la vitesse de 2 et l’INI de 5 pendant 3 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-multicolore#potion:ultime-fiole-multicolore"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 548, 'equipement', 'Ceinture › Fioles', 'Petite fiole noire', 'Effet', 'modifie', 'Soigne 2d8 + 5 corruption
Donne 2d8 + 5 corruption à ceux de la corruption', 'Soigne 2d8 + 5 {{corruption|corruption}}
Donne 2d8 + 5 {{corruption|corruption}} à ceux de la corruption', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-noire#potion:petite-fiole-noire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 549, 'equipement', 'Ceinture › Fioles', 'Fiole noire moyenne', 'Effet', 'modifie', 'Soigne 3d8 + 7 corruption
Donne 3d8 + 7 corruption à ceux de la corruption', 'Soigne 3d8 + 7 {{corruption|corruption}}
Donne 3d8 + 7 {{corruption|corruption}} à ceux de la corruption', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-noire#potion:fiole-noire-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 550, 'equipement', 'Ceinture › Fioles', 'Super fiole noire', 'Effet', 'modifie', 'Soigne 4d8 + 10 corruption
Donne 4d8 + 10 corruption à ceux de la corruption', 'Soigne 4d8 + 10 {{corruption|corruption}}
Donne 4d8 + 10 {{corruption|corruption}} à ceux de la corruption', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-noire#potion:super-fiole-noire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 551, 'equipement', 'Ceinture › Fioles', 'Méga fiole noire', 'Effet', 'modifie', 'Soigne 5d8 + 15 corruption
Donne 5d8 + 15 corruption à ceux de la corruption', 'Soigne 5d8 + 15 {{corruption|corruption}}
Donne 5d8 + 15 {{corruption|corruption}} à ceux de la corruption', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-noire#potion:mega-fiole-noire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 552, 'equipement', 'Ceinture › Fioles', 'Ultime fiole noire', 'Effet', 'modifie', 'Soigne 100% corruption
Donne 100% corruption à ceux de la corruption', 'Soigne 100% {{corruption|corruption}}
Donne 100% {{corruption|corruption}} à ceux de la corruption', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-noire#potion:ultime-fiole-noire"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 553, 'equipement', 'Ceinture › Fioles', 'Petite fiole orange', 'Effet', 'modifie', 'Récupère 2d8 + 5 santé et barrière', 'Récupère 2d8 + 5 santé et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-orange#potion:petite-fiole-orange"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 554, 'equipement', 'Ceinture › Fioles', 'Fiole orange moyenne', 'Effet', 'modifie', 'Récupère 3d8 + 10 santé et barrière', 'Récupère 3d8 + 10 santé et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-orange#potion:fiole-orange-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 555, 'equipement', 'Ceinture › Fioles', 'Super fiole orange', 'Effet', 'modifie', 'Récupère 4d8 + 20 santé et barrière', 'Récupère 4d8 + 20 santé et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-orange#potion:super-fiole-orange"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 556, 'equipement', 'Ceinture › Fioles', 'Méga fiole orange', 'Effet', 'modifie', 'Récupère 5d8 + 40 santé et barrière', 'Récupère 5d8 + 40 santé et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-orange#potion:mega-fiole-orange"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 557, 'equipement', 'Ceinture › Fioles', 'Ultime fiole orange', 'Effet', 'modifie', 'Récupère 100% de santé et barrière', 'Récupère 100% de santé et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-orange#potion:ultime-fiole-orange"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 558, 'equipement', 'Ceinture › Fioles', 'Petite fiole verte', 'Effet', 'modifie', 'Récupère 2d8 + 5 chakra et barrière', 'Récupère 2d8 + 5 {{chakra|chakra}} et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-verte#potion:petite-fiole-verte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 559, 'equipement', 'Ceinture › Fioles', 'Fiole verte moyenne', 'Effet', 'modifie', 'Récupère 3d8 + 10 chakra et barrière', 'Récupère 3d8 + 10 {{chakra|chakra}} et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-verte#potion:fiole-verte-moyenne"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 560, 'equipement', 'Ceinture › Fioles', 'Super fiole verte', 'Effet', 'modifie', 'Récupère 4d8 + 20 chakra et barrière', 'Récupère 4d8 + 20 {{chakra|chakra}} et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-verte#potion:super-fiole-verte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 561, 'equipement', 'Ceinture › Fioles', 'Méga fiole verte', 'Effet', 'modifie', 'Récupère 5d8 + 40 chakra et barrière', 'Récupère 5d8 + 40 {{chakra|chakra}} et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-verte#potion:mega-fiole-verte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 562, 'equipement', 'Ceinture › Fioles', 'Ultime fiole verte', 'Effet', 'modifie', 'Récupère 100% de chakra et barrière', 'Récupère 100% de {{chakra|chakra}} et {{barriere|barrière}}', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/fiole-verte#potion:ultime-fiole-verte"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 563, 'equipement', 'Ceinture › Alchimie primitive', 'Bloc dégoûtant', 'Effet', 'modifie', '- Redonne 15 barrière
- 1 croix au social pendant 2 tours', '- Redonne 15 {{barriere|barrière}}
- 1 croix au social pendant 2 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/alchimie-primitive#potion:bloc-degoutant"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 564, 'equipement', 'Ceinture › Alchimie primitive', 'Breuvage immonde', 'Effet', 'modifie', '- Redonne 15 chakra
- 1 croix à la volonté pendant 2 tours', '- Redonne 15 {{chakra|chakra}}
- 1 croix à la volonté pendant 2 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/alchimie-primitive#potion:breuvage-immonde"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 565, 'equipement', 'Ceinture › Alchimie primitive', 'Bloc étrange', 'Effet', 'modifie', '- Redonne 35 barrière
- 1 croix au social pendant 2 tours', '- Redonne 35 {{barriere|barrière}}
- 1 croix au social pendant 2 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/alchimie-primitive#potion:bloc-etrange"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 566, 'equipement', 'Ceinture › Alchimie primitive', 'Breuvage amer', 'Effet', 'modifie', '- Redonne 35 chakra
- 1 croix à la volonté pendant 2 tours', '- Redonne 35 {{chakra|chakra}}
- 1 croix à la volonté pendant 2 tours', 'neutre', NULL, 'potion', '{"ressource_id":"ressources/alchimie-primitive#potion:breuvage-amer"}', 'effet');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 567, 'composants', NULL, '16 onglets de la page « Composants »', NULL, 'ajoute', NULL, '16 onglets de la page « Composants »', 'neutre', NULL, 'composant_onglet', '{}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 568, 'composants', 'Matériaux', 'Mythril', 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', 'modifie', 'Dégâts +8 pour l''arme
Passe barrière', 'Dégâts +8 pour l''arme
Passe {{barriere|barrière}}', 'neutre', NULL, 'materiau_arme', '{"ressource_id":"ressources/armures#materiau:mythril"}', 'effet_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 569, 'composants', 'Matériaux', 'Fer noir', 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', 'modifie', 'Dégâts +3 pour l''arme
1d4 de corruption à chaque coup qui touche', 'Dégâts +3 pour l''arme
1d4 de {{corruption|corruption}} à chaque coup qui touche', 'neutre', NULL, 'materiau_arme', '{"ressource_id":"ressources/armures#materiau:fer-noir"}', 'effet_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 570, 'composants', 'Matériaux', 'Laiton', 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', 'modifie', 'Dégâts +7 pour l''arme
dégâts doublés contre la barrière', 'Dégâts +7 pour l''arme
dégâts doublés contre la {{barriere|barrière}}', 'neutre', NULL, 'materiau_arme', '{"ressource_id":"ressources/armures#materiau:laiton"}', 'effet_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 571, 'composants', 'Matériaux', 'Maverium', 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', 'modifie', 'Dégâts +10 pour l''arme
Casse barrière', 'Dégâts +10 pour l''arme
Casse {{barriere|barrière}}', 'neutre', NULL, 'materiau_arme', '{"ressource_id":"ressources/armures#materiau:maverium"}', 'effet_brut');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 572, 'composants', 'Matos › MATOS AVENTURES', 'Lanterne blanche', 'Description', 'modifie', 'Lanterne magique produisant une flamme blanche au contact du chakra, consommant 2 points de chakra par heure.', 'Lanterne magique produisant une flamme blanche au contact du chakra, consommant 2 points de {{chakra|chakra}} par heure.', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:lanterne-blanche"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 573, 'composants', 'Matos › MATOS AVENTURES', 'Torche blanche', 'Description', 'modifie', 'Torche magique produisant une flamme blanche au contact du chakra, consommant 2 points de chakra par heure.', 'Torche magique produisant une flamme blanche au contact du chakra, consommant 2 points de {{chakra|chakra}} par heure.', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:torche-blanche"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 574, 'composants', 'Matos › MATOS FABRICATION', 'Fiole en verre (Petite)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:fiole-en-verre-petite"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 575, 'composants', 'Matos › MATOS FABRICATION', 'Fiole en verre (Moyenne)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:fiole-en-verre-moyen"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 576, 'composants', 'Matos › MATOS FABRICATION', 'Fiole en verre (Super)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:fiole-en-verre-super"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 577, 'composants', 'Matos › MATOS FABRICATION', 'Fiole en verre (Méga)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:fiole-en-verre-mega"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 578, 'composants', 'Matos › MATOS FABRICATION', 'Kit d''alchimiste (Novice)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:kit-dalchimiste-novice"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 579, 'composants', 'Matos › MATOS FABRICATION', 'Kit d''alchimiste (Apprenti)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:kit-dalchimiste-apprenti"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 580, 'composants', 'Matos › MATOS FABRICATION', 'Kit d''alchimiste (Avancé)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:kit-dalchimiste-avance"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 581, 'composants', 'Matos › MATOS FABRICATION', 'Kit d''alchimiste (Expert)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:kit-dalchimiste-expert"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 582, 'composants', 'Matos › MATOS FABRICATION', 'Kit d''alchimiste (Maître)', 'Description', 'modifie', 'https://docs.google.com/document/d/1Lv6pMUx4aaVUTot2tYFl17de1FtxmVbJUlnBXo0J20s/edit?usp=sharing', 'https://docs.google.com/document/d/1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k/edit?usp=sharing', 'neutre', NULL, 'ressource', '{"id":"ressources/equipement-inventaire#materiel:kit-dalchimiste-maitre"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 583, 'chronologie', NULL, 'Les trois premières races', NULL, 'retire', 'Les trois premières races', NULL, 'neutre', NULL, 'evenement', '{"id":"trois-premieres-races"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 584, 'chronologie', NULL, 'Ère des Élémentaires', NULL, 'ajoute', NULL, 'Ère des Élémentaires', 'neutre', NULL, 'evenement', '{"id":"ere-des-elementaires"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 585, 'chronologie', NULL, 'Ère des Dieux', NULL, 'ajoute', NULL, 'Ère des Dieux', 'neutre', NULL, 'evenement', '{"id":"ere-des-dieux"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 586, 'chronologie', NULL, 'Naissance des premiers mortels', NULL, 'ajoute', NULL, 'Naissance des premiers mortels', 'neutre', NULL, 'evenement', '{"id":"naissance-des-premiers-mortels"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 587, 'chronologie', NULL, 'Naissance des Drassah''thac', 'Titre', 'modifie', 'Apparition des Drassah''thac', 'Naissance des Drassah''thac', 'neutre', NULL, 'evenement', '{"id":"drassahthac"}', 'titre');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 588, 'chronologie', NULL, 'Apparition de Joyeuse', NULL, 'ajoute', NULL, 'Apparition de Joyeuse', 'neutre', NULL, 'evenement', '{"id":"apparition-de-joyeuse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 589, 'chronologie', 'Arrivés des Lamias', 'Arrivés des Lamias › description 2', 'Description', 'modifie', 'Cette race extraplanaire est apparue la première fois en l''an 51.', 'Arrivées d''une autre dimension via une faille temporelle, cette race exclusivement femelle par incompréhension ont attaqué sans prévenir les premiers qu''elles ont vu et il s''agissait de l''Empire humain.

Sans surprise elles ont perdues mais l''Empire humain a chercher la conversation et à comprendre d''où elles viennent.

Après beaucoup de conversation avec l''impératrice des lamias de l''époque, un accord de paix fût signé et les lamias deviennent des résidentes permanent sur l''île œuf, situé entre Erisia et Mrode.

La reproduction est possible pour elles mais seulement avec les humains et l''enfant à naître est toujours une lamia, ce qui assure la race d''exister quoi qu''il arrive.', 'neutre', NULL, 'evenement_extrait', '{"evenement_id":"lamias","rang":2}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 590, 'chronologie', 'Arrivés des Lamias', 'Arrivés des Lamias › description 3', NULL, 'retire', 'Arrivés des Lamias › description 3', NULL, 'neutre', NULL, 'evenement_extrait', '{"evenement_id":"lamias","rang":3}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 591, 'chronologie', '"Accord du Sable"', '"Accord du Sable" › description 1', 'Description', 'modifie', '"Accord du Sable" (An 230\) (Désert Doré)', 'Avant l’époque actuelle, le Désert Doré était divisé entre quatre grandes nations majeures : Mhada, Chamma, Minkambo et Krihyo.

Durant plusieurs siècles, ces quatre puissances passèrent leur temps à s’affronter. Les raisons variaient constamment : conquêtes territoriales, ressources, différences idéologiques, ambitions politiques ou simples rivalités historiques. Les guerres étaient si fréquentes qu’elles finirent par devenir une composante normale du continent.

Au fil du temps, les territoires gagnèrent en taille et en complexité. Plus les nations s’étendaient, plus leur administration devenait difficile. Les pertes humaines augmentaient sans cesse, les économies s’épuisaient et les populations vivaient dans un état de conflit quasi permanent.

Un événement inattendu changea finalement l’histoire du continent.

Les quatre dirigeants des grandes nations moururent durant une même période historique. Bien qu’ils ne soient pas morts exactement au même moment, leurs décès furent suffisamment rapprochés pour provoquer une crise politique majeure dans chacune des nations. On soupçonne que les coupables des meurtres soient lié à un culte du Dieu du Feu, d’autre parle du Dieu de la Guerre.

Leurs héritiers, portant alors les noms des grandes capitales, décidèrent de se rencontrer afin de trouver une solution définitive aux guerres qui déchiraient le continent. Cette rencontre donna naissance à un événement historique majeur : Les Accords du Sable.

Durant les discussions, de nombreuses propositions furent formulées, mais une idée finit par l’emporter sur toutes les autres : l’abolition totale des armées.

Le raisonnement semblait simple : "Sans armée, aucune guerre ne pourrait exister."

Les Accords furent signés en quatre exemplaires parfaitement identiques, chacun conservé par une des quatre capitales.

“Qu’est ce qui pourrait mal se passer ?” c’était les mots prononcés par le scribe qui a fait les 4 exemplaires des Accords. Cette phrase, prononcée avec beaucoup d''ironie, a raisonné comme une prophétie dans la pièce. Si seulement les 4 dirigeants avaient saisie ce qu’il voulait dire …

Car les choses ont tourné au cauchemar …

Privé de forces militaires capables de maintenir l’ordre, le Désert Doré entra progressivement dans une période aujourd’hui connue comme l’Âge du Grand Banditisme. Les routes commerciales devinrent dangereuses. Les villes et villages furent pillés. Les caravanes disparurent. Aucun territoire n’était épargné.

Dix années après les Accords du Sable, les dirigeants se réunirent à nouveau afin de résoudre le problème.

Cependant, aucun ne souhaitait reconnaître publiquement que l’abolition des armées avait été une erreur. Incapable de reconnaître leur faute, de peur de perdre tout crédibilité comme dirigeant, une nouvelle proposition fut alors formulée : "On a beaucoup de ressources et d’argent. Et si on attirait les différentes guilde de mercenaires vers nous ? "

L’idée fut acceptée. Ce choix marqua le début d’un nouvel âge.

Des guildes venues du monde entier commencèrent à affluer vers le continent. Certaines étaient composées de quelques hommes seulement ; d’autres étaient de véritables armées privées. En échange d’or, elles protégeaient les routes, éliminaient les bandits et sécurisaient les territoires.

Les résultats furent immédiats.

Mais un nouveau problème apparut.

Les guildes commencèrent à accumuler richesse, influence et reconnaissance politique. Des terres furent offertes aux plus méritantes. Certaines reçurent des villes entières pour récompenser leurs services. Donc en plus d’avoir un pouvoir économique, ces guildes peuvent avoir du poids dans les décisions politiques.

Puis arriva l’inévitable.

Les plus grandes guildes déclarèrent leur indépendance. Les anciennes nations n’avaient aucune force suffisante pour les arrêter.

La colère fût très grande au sein des populations et les familles dirigeantes historiques des 4 géants ont été détruites entièrement, des assassins ont mis fin à la lignée entière de ces familles. Aujourd’hui, on ne sait toujours pas qui est responsable de ces meurtres : le peuple qui a demandé justice ? Certaines guildes assez puissantes pour organiser ça ? De l’ingérence étrangère ?

Quoi qu’il en soit, les Accords du Sable furent finalement abandonnés, et les capitales furent contraintes de reconstituer leurs armées. Cependant, il était déjà trop tard.

Aujourd’hui, le Désert Doré est morcelé en une multitude de territoires indépendants où chaque grande ville peut suivre ses propres lois, sa propre culture et ses propres intérêts.', 'neutre', NULL, 'evenement_extrait', '{"evenement_id":"accord-du-sable","rang":1}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 592, 'chronologie', 'Fin de l''empire humain', 'Fin de l''empire humain › description 1', 'Description', 'modifie', 'Fin de l''empire humain (An 1138\)', 'Malgré sa toute-puissance et sa remarquable capacité de résilience dans le temps, l’Empire humain finit par s’effondrer en l’an 1138. Cette chute, loin d’être le résultat d’un simple affaiblissement, serait liée à un vaste complot impliquant une coalition secrète, aujourd’hui connue sous le nom de Groupement Dombourien, ainsi que plusieurs nations d’autres peuples, parmi lesquelles figure notamment l’Empire argenté.

Les conspirateurs parviennent à s’emparer de Dombourg, capitale impériale, et à en chasser la famille impériale, détentrice de Joyeuse. La prise de la capitale marque un tournant décisif dans l’histoire humaine : privée de son centre de pouvoir et de sa dynastie régnante, l’autorité impériale se désagrège.

Les territoires qui composaient autrefois l’Empire humain proclament alors leur indépendance. L’immense ensemble impérial se fragmente en une multitude de puissances désormais libres de déterminer leur propre avenir.

Toutefois, la disparition de l’Empire ne signifie pas que son héritage est abandonné. Les nouveaux détenteurs des vestiges de son pouvoir nourrissent l’ambition de reconquérir les territoires perdus. Mais cette entreprise s’annonce difficile : de nombreux anciens royaumes demeurent profondément loyaux envers l’Empire et pourraient s’opposer à ceux qui prétendent désormais en recueillir les restes.', 'neutre', NULL, 'evenement_extrait', '{"evenement_id":"fin-de-l-empire-humain","rang":1}', 'texte');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 593, 'mots-cles', NULL, '4ème barre', NULL, 'retire', '4ème barre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"4eme-barre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 594, 'mots-cles', NULL, 'abréviations', NULL, 'retire', 'abréviations', NULL, 'neutre', NULL, 'mot_cle', '{"id":"abreviations"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 595, 'mots-cles', NULL, 'accessoires', NULL, 'retire', 'accessoires', NULL, 'neutre', NULL, 'mot_cle', '{"id":"accessoires"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 596, 'mots-cles', NULL, 'acquis', NULL, 'retire', 'acquis', NULL, 'neutre', NULL, 'mot_cle', '{"id":"acquis"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 597, 'mots-cles', NULL, 'action', NULL, 'retire', 'action', NULL, 'neutre', NULL, 'mot_cle', '{"id":"action"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 598, 'mots-cles', NULL, 'action rapide', NULL, 'retire', 'action rapide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"action-rapide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 599, 'mots-cles', NULL, 'adepte', NULL, 'retire', 'adepte', NULL, 'neutre', NULL, 'mot_cle', '{"id":"adepte"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 600, 'mots-cles', NULL, 'agilité', NULL, 'retire', 'agilité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"agilite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 601, 'mots-cles', NULL, 'aide', NULL, 'retire', 'aide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"aide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 602, 'mots-cles', NULL, 'aide-mémoire', NULL, 'retire', 'aide-mémoire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"aide-memoire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 603, 'mots-cles', NULL, 'alchimie', NULL, 'retire', 'alchimie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alchimie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 604, 'mots-cles', NULL, 'alchimie primitive', NULL, 'retire', 'alchimie primitive', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alchimie-primitive"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 605, 'mots-cles', NULL, 'alignement', NULL, 'retire', 'alignement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alignement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 606, 'mots-cles', NULL, 'altération', NULL, 'retire', 'altération', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alteration"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 607, 'mots-cles', NULL, 'altérations d’état', NULL, 'retire', 'altérations d’état', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alterations-detat"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 608, 'mots-cles', NULL, 'altérations d''états', NULL, 'retire', 'altérations d''états', NULL, 'neutre', NULL, 'mot_cle', '{"id":"alterations-detats"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 609, 'mots-cles', NULL, 'am', NULL, 'retire', 'am', NULL, 'neutre', NULL, 'mot_cle', '{"id":"am"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 610, 'mots-cles', NULL, 'âme', NULL, 'retire', 'âme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ame"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 611, 'mots-cles', NULL, 'amélioration', NULL, 'retire', 'amélioration', NULL, 'neutre', NULL, 'mot_cle', '{"id":"amelioration"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 612, 'mots-cles', NULL, 'amplificateur', NULL, 'retire', 'amplificateur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"amplificateur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 613, 'mots-cles', NULL, 'amuseur', NULL, 'retire', 'amuseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"amuseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 614, 'mots-cles', NULL, 'anansi', NULL, 'retire', 'anansi', NULL, 'neutre', NULL, 'mot_cle', '{"id":"anansi"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 615, 'mots-cles', NULL, 'ap', NULL, 'retire', 'ap', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ap"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 616, 'mots-cles', NULL, 'arbalètrier', NULL, 'retire', 'arbalètrier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"arbaletrier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 617, 'mots-cles', NULL, 'arcane', NULL, 'retire', 'arcane', NULL, 'neutre', NULL, 'mot_cle', '{"id":"arcane"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 618, 'mots-cles', NULL, 'archer', NULL, 'retire', 'archer', NULL, 'neutre', NULL, 'mot_cle', '{"id":"archer"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 619, 'mots-cles', NULL, 'archiclier', NULL, 'retire', 'archiclier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"archiclier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 620, 'mots-cles', NULL, 'archimage', NULL, 'retire', 'archimage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"archimage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 621, 'mots-cles', NULL, 'arme', NULL, 'retire', 'arme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"arme"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 622, 'mots-cles', NULL, 'armes', NULL, 'retire', 'armes', NULL, 'neutre', NULL, 'mot_cle', '{"id":"armes"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 623, 'mots-cles', NULL, 'armure', NULL, 'retire', 'armure', NULL, 'neutre', NULL, 'mot_cle', '{"id":"armure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 624, 'mots-cles', NULL, 'armure magique', NULL, 'retire', 'armure magique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"armure-magique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 625, 'mots-cles', NULL, 'armure physique', NULL, 'retire', 'armure physique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"armure-physique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 626, 'mots-cles', NULL, 'armures', NULL, 'retire', 'armures', NULL, 'neutre', NULL, 'mot_cle', '{"id":"armures"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 627, 'mots-cles', NULL, 'artilleur', NULL, 'retire', 'artilleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"artilleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 628, 'mots-cles', NULL, 'artisanat', NULL, 'retire', 'artisanat', NULL, 'neutre', NULL, 'mot_cle', '{"id":"artisanat"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 629, 'mots-cles', NULL, 'athlétisme', NULL, 'retire', 'athlétisme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"athletisme"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 630, 'mots-cles', NULL, 'attaque', NULL, 'retire', 'attaque', NULL, 'neutre', NULL, 'mot_cle', '{"id":"attaque"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 631, 'mots-cles', NULL, 'attaque de zone', NULL, 'retire', 'attaque de zone', NULL, 'neutre', NULL, 'mot_cle', '{"id":"attaque-de-zone"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 632, 'mots-cles', NULL, 'attaque discrète', NULL, 'retire', 'attaque discrète', NULL, 'neutre', NULL, 'mot_cle', '{"id":"attaque-discrete"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 633, 'mots-cles', NULL, 'attaque d''opportunité', NULL, 'retire', 'attaque d''opportunité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"attaque-dopportunite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 634, 'mots-cles', NULL, 'attributs', NULL, 'retire', 'attributs', NULL, 'neutre', NULL, 'mot_cle', '{"id":"attributs"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 635, 'mots-cles', NULL, 'augure', NULL, 'retire', 'augure', NULL, 'neutre', NULL, 'mot_cle', '{"id":"augure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 636, 'mots-cles', NULL, 'aveuglement', NULL, 'retire', 'aveuglement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"aveuglement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 637, 'mots-cles', NULL, 'baliste', NULL, 'retire', 'baliste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"baliste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 638, 'mots-cles', NULL, 'barde', NULL, 'retire', 'barde', NULL, 'neutre', NULL, 'mot_cle', '{"id":"barde"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 639, 'mots-cles', NULL, 'Barrière', 'Mot-clé', 'modifie', 'barrière', 'Barrière', 'neutre', NULL, 'mot_cle', '{"id":"barriere"}', 'libelle');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 640, 'mots-cles', NULL, 'Barrière', 'Définition', 'ajoute', NULL, 'Manifestation physique dérivée du {{chakra|Chakra}} d''un individu. Elle agit comme une seconde peau invisible protégeant le corps de blessures.', 'neutre', NULL, 'mot_cle', '{"id":"barriere"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 641, 'mots-cles', NULL, 'batailleur', NULL, 'retire', 'batailleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"batailleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 642, 'mots-cles', NULL, 'bâton magique', NULL, 'retire', 'bâton magique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"baton-magique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 643, 'mots-cles', NULL, 'battlemap', NULL, 'retire', 'battlemap', NULL, 'neutre', NULL, 'mot_cle', '{"id":"battlemap"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 644, 'mots-cles', NULL, 'belliciste', NULL, 'retire', 'belliciste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"belliciste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 645, 'mots-cles', NULL, 'berserker', NULL, 'retire', 'berserker', NULL, 'neutre', NULL, 'mot_cle', '{"id":"berserker"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 646, 'mots-cles', NULL, 'biclassage', NULL, 'retire', 'biclassage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"biclassage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 647, 'mots-cles', NULL, 'bimane', NULL, 'retire', 'bimane', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bimane"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 648, 'mots-cles', NULL, 'bloc', NULL, 'retire', 'bloc', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bloc"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 649, 'mots-cles', NULL, 'bois', NULL, 'retire', 'bois', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bois"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 650, 'mots-cles', NULL, 'bombardier', NULL, 'retire', 'bombardier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bombardier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 651, 'mots-cles', NULL, 'bon', NULL, 'retire', 'bon', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bon"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 652, 'mots-cles', NULL, 'bonimenteur', NULL, 'retire', 'bonimenteur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bonimenteur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 653, 'mots-cles', NULL, 'bonus', NULL, 'retire', 'bonus', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bonus"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 654, 'mots-cles', NULL, 'bonus/malus', NULL, 'retire', 'bonus/malus', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bonus-malus"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 655, 'mots-cles', NULL, 'boss', NULL, 'retire', 'boss', NULL, 'neutre', NULL, 'mot_cle', '{"id":"boss"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 656, 'mots-cles', NULL, 'bouclier', NULL, 'retire', 'bouclier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bouclier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 657, 'mots-cles', NULL, 'bourse', NULL, 'retire', 'bourse', NULL, 'neutre', NULL, 'mot_cle', '{"id":"bourse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 658, 'mots-cles', NULL, 'breuvage', NULL, 'retire', 'breuvage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"breuvage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 659, 'mots-cles', NULL, 'briseur', NULL, 'retire', 'briseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"briseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 660, 'mots-cles', NULL, 'brûlure', NULL, 'retire', 'brûlure', NULL, 'neutre', NULL, 'mot_cle', '{"id":"brulure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 661, 'mots-cles', NULL, 'cambrioleur', NULL, 'retire', 'cambrioleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"cambrioleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 662, 'mots-cles', NULL, 'campagne', NULL, 'retire', 'campagne', NULL, 'neutre', NULL, 'mot_cle', '{"id":"campagne"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 663, 'mots-cles', NULL, 'canaille', NULL, 'retire', 'canaille', NULL, 'neutre', NULL, 'mot_cle', '{"id":"canaille"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 664, 'mots-cles', NULL, 'capacités', NULL, 'retire', 'capacités', NULL, 'neutre', NULL, 'mot_cle', '{"id":"capacites"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 665, 'mots-cles', NULL, 'caractéristiques', NULL, 'retire', 'caractéristiques', NULL, 'neutre', NULL, 'mot_cle', '{"id":"caracteristiques"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 666, 'mots-cles', NULL, 'carte de combat', NULL, 'retire', 'carte de combat', NULL, 'neutre', NULL, 'mot_cle', '{"id":"carte-de-combat"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 667, 'mots-cles', NULL, 'casseur', NULL, 'retire', 'casseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"casseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 668, 'mots-cles', NULL, 'catalyseur', NULL, 'retire', 'catalyseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"catalyseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 669, 'mots-cles', NULL, 'ceinture', NULL, 'retire', 'ceinture', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ceinture"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 670, 'mots-cles', NULL, 'cemies', NULL, 'retire', 'cemies', NULL, 'neutre', NULL, 'mot_cle', '{"id":"cemies"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 671, 'mots-cles', NULL, 'Chakra', 'Mot-clé', 'modifie', 'chakra', 'Chakra', 'neutre', NULL, 'mot_cle', '{"id":"chakra"}', 'libelle');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 672, 'mots-cles', NULL, 'Chakra', 'Définition', 'ajoute', NULL, 'Énergie consommée lors de l''utilisation de magie. Quand le chakra est épuisé, la santé est consommée à la hauteur de 2 points pour un de Chakra.', 'neutre', NULL, 'mot_cle', '{"id":"chakra"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 673, 'mots-cles', NULL, 'chaman', NULL, 'retire', 'chaman', NULL, 'neutre', NULL, 'mot_cle', '{"id":"chaman"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 674, 'mots-cles', NULL, 'chaos', NULL, 'retire', 'chaos', NULL, 'neutre', NULL, 'mot_cle', '{"id":"chaos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 675, 'mots-cles', NULL, 'chaotique', NULL, 'retire', 'chaotique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"chaotique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 676, 'mots-cles', NULL, 'chasseur', NULL, 'retire', 'chasseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"chasseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 677, 'mots-cles', NULL, 'chasseur de primes', NULL, 'retire', 'chasseur de primes', NULL, 'neutre', NULL, 'mot_cle', '{"id":"chasseur-de-primes"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 678, 'mots-cles', NULL, 'civilisation', NULL, 'retire', 'civilisation', NULL, 'neutre', NULL, 'mot_cle', '{"id":"civilisation"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 679, 'mots-cles', NULL, 'classe magique', NULL, 'retire', 'classe magique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"classe-magique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 680, 'mots-cles', NULL, 'classes', NULL, 'retire', 'classes', NULL, 'neutre', NULL, 'mot_cle', '{"id":"classes"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 681, 'mots-cles', NULL, 'classes magiques', NULL, 'retire', 'classes magiques', NULL, 'neutre', NULL, 'mot_cle', '{"id":"classes-magiques"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 682, 'mots-cles', NULL, 'clerc', NULL, 'retire', 'clerc', NULL, 'neutre', NULL, 'mot_cle', '{"id":"clerc"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 683, 'mots-cles', NULL, 'cogneur', NULL, 'retire', 'cogneur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"cogneur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 684, 'mots-cles', NULL, 'colombe', NULL, 'retire', 'colombe', NULL, 'neutre', NULL, 'mot_cle', '{"id":"colombe"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 685, 'mots-cles', NULL, 'coma', NULL, 'retire', 'coma', NULL, 'neutre', NULL, 'mot_cle', '{"id":"coma"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 686, 'mots-cles', NULL, 'combat', NULL, 'retire', 'combat', NULL, 'neutre', NULL, 'mot_cle', '{"id":"combat"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 687, 'mots-cles', NULL, 'combattant libre', NULL, 'retire', 'combattant libre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"combattant-libre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 688, 'mots-cles', NULL, 'compétences', NULL, 'retire', 'compétences', NULL, 'neutre', NULL, 'mot_cle', '{"id":"competences"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 689, 'mots-cles', NULL, 'confusion', NULL, 'retire', 'confusion', NULL, 'neutre', NULL, 'mot_cle', '{"id":"confusion"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 690, 'mots-cles', NULL, 'construction', NULL, 'retire', 'construction', NULL, 'neutre', NULL, 'mot_cle', '{"id":"construction"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 691, 'mots-cles', NULL, 'conteur', NULL, 'retire', 'conteur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"conteur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 692, 'mots-cles', NULL, 'Corruption', 'Mot-clé', 'modifie', 'corruption', 'Corruption', 'neutre', NULL, 'mot_cle', '{"id":"corruption"}', 'libelle');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 693, 'mots-cles', NULL, 'Corruption', 'Définition', 'ajoute', NULL, 'Poison du chakra : chaque point de corruption prend la place d''un point de chakra, jusqu''au maximum du chakra ; le repos et la méditation ne la font pas baisser. Au maximum, le personnage a deux semaines pour en retirer un point, sinon il meurt et devient une abomination. Seuls ceux qui ont la Corruption en magie innée ou acquise ne risquent pas cette mort : pour eux, c''est la réserve où passe le chakra de leurs sorts. Le Potentiel Illimité, même s''il peut s''en servir, peut en mourir s''il en cumule trop.', 'neutre', NULL, 'mot_cle', '{"id":"corruption"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 694, 'mots-cles', NULL, 'CR', NULL, 'ajoute', NULL, 'CR', 'neutre', NULL, 'mot_cle', '{"id":"cr"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 695, 'mots-cles', NULL, 'créateur', NULL, 'retire', 'créateur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"createur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 696, 'mots-cles', NULL, 'création de personnage', NULL, 'retire', 'création de personnage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"creation-de-personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 697, 'mots-cles', NULL, 'créature', NULL, 'retire', 'créature', NULL, 'neutre', NULL, 'mot_cle', '{"id":"creature"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 698, 'mots-cles', NULL, 'crocheter', NULL, 'retire', 'crocheter', NULL, 'neutre', NULL, 'mot_cle', '{"id":"crocheter"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 699, 'mots-cles', NULL, 'cuirassé', NULL, 'retire', 'cuirassé', NULL, 'neutre', NULL, 'mot_cle', '{"id":"cuirasse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 700, 'mots-cles', NULL, 'd100', NULL, 'retire', 'd100', NULL, 'neutre', NULL, 'mot_cle', '{"id":"d100"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 701, 'mots-cles', NULL, 'danseur', NULL, 'retire', 'danseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"danseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 702, 'mots-cles', NULL, 'déclencheur', NULL, 'retire', 'déclencheur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"declencheur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 703, 'mots-cles', NULL, 'défense', NULL, 'retire', 'défense', NULL, 'neutre', NULL, 'mot_cle', '{"id":"defense"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 704, 'mots-cles', NULL, 'défense partielle', NULL, 'retire', 'défense partielle', NULL, 'neutre', NULL, 'mot_cle', '{"id":"defense-partielle"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 705, 'mots-cles', NULL, 'défensif', NULL, 'retire', 'défensif', NULL, 'neutre', NULL, 'mot_cle', '{"id":"defensif"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 706, 'mots-cles', NULL, 'dégâts', NULL, 'retire', 'dégâts', NULL, 'neutre', NULL, 'mot_cle', '{"id":"degats"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 707, 'mots-cles', NULL, 'demi épée', NULL, 'retire', 'demi épée', NULL, 'neutre', NULL, 'mot_cle', '{"id":"demi-epee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 708, 'mots-cles', NULL, 'démo', NULL, 'retire', 'démo', NULL, 'neutre', NULL, 'mot_cle', '{"id":"demo"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 709, 'mots-cles', NULL, 'déplacement', NULL, 'retire', 'déplacement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"deplacement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 710, 'mots-cles', NULL, 'dés', NULL, 'retire', 'dés', NULL, 'neutre', NULL, 'mot_cle', '{"id":"des"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 711, 'mots-cles', NULL, 'détruire', NULL, 'retire', 'détruire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"detruire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 712, 'mots-cles', NULL, 'devin', NULL, 'retire', 'devin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"devin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 713, 'mots-cles', NULL, 'dévot', NULL, 'retire', 'dévot', NULL, 'neutre', NULL, 'mot_cle', '{"id":"devot"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 714, 'mots-cles', NULL, 'diagonale', NULL, 'retire', 'diagonale', NULL, 'neutre', NULL, 'mot_cle', '{"id":"diagonale"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 715, 'mots-cles', NULL, 'dieu', NULL, 'retire', 'dieu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"dieu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 716, 'mots-cles', NULL, 'dieu choisi', NULL, 'retire', 'dieu choisi', NULL, 'neutre', NULL, 'mot_cle', '{"id":"dieu-choisi"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 717, 'mots-cles', NULL, 'dieu inné', NULL, 'retire', 'dieu inné', NULL, 'neutre', NULL, 'mot_cle', '{"id":"dieu-inne"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 718, 'mots-cles', NULL, 'diligence', NULL, 'retire', 'diligence', NULL, 'neutre', NULL, 'mot_cle', '{"id":"diligence"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 719, 'mots-cles', NULL, 'divinité', NULL, 'retire', 'divinité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"divinite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 720, 'mots-cles', NULL, 'documents', NULL, 'retire', 'documents', NULL, 'neutre', NULL, 'mot_cle', '{"id":"documents"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 721, 'mots-cles', NULL, 'donjon', NULL, 'retire', 'donjon', NULL, 'neutre', NULL, 'mot_cle', '{"id":"donjon"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 722, 'mots-cles', NULL, 'dons', NULL, 'retire', 'dons', NULL, 'neutre', NULL, 'mot_cle', '{"id":"dons"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 723, 'mots-cles', NULL, 'dresseur bleu', NULL, 'retire', 'dresseur bleu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"dresseur-bleu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 724, 'mots-cles', NULL, 'druide', NULL, 'retire', 'druide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"druide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 725, 'mots-cles', NULL, 'durabilité', NULL, 'retire', 'durabilité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"durabilite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 726, 'mots-cles', NULL, 'eau', NULL, 'retire', 'eau', NULL, 'neutre', NULL, 'mot_cle', '{"id":"eau"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 727, 'mots-cles', NULL, 'échec critique', NULL, 'retire', 'échec critique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"echec-critique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 728, 'mots-cles', NULL, 'éloquent', NULL, 'retire', 'éloquent', NULL, 'neutre', NULL, 'mot_cle', '{"id":"eloquent"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 729, 'mots-cles', NULL, 'embuscade', NULL, 'retire', 'embuscade', NULL, 'neutre', NULL, 'mot_cle', '{"id":"embuscade"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 730, 'mots-cles', NULL, 'emplacements de sorts', NULL, 'retire', 'emplacements de sorts', NULL, 'neutre', NULL, 'mot_cle', '{"id":"emplacements-de-sorts"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 731, 'mots-cles', NULL, 'enfoncer', NULL, 'retire', 'enfoncer', NULL, 'neutre', NULL, 'mot_cle', '{"id":"enfoncer"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 732, 'mots-cles', NULL, 'enragé', NULL, 'retire', 'enragé', NULL, 'neutre', NULL, 'mot_cle', '{"id":"enrage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 733, 'mots-cles', NULL, 'entraînement', NULL, 'retire', 'entraînement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"entrainement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 734, 'mots-cles', NULL, 'entrepôt', NULL, 'retire', 'entrepôt', NULL, 'neutre', NULL, 'mot_cle', '{"id":"entrepot"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 735, 'mots-cles', NULL, 'épéiste', NULL, 'retire', 'épéiste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"epeiste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 736, 'mots-cles', NULL, 'équipement', NULL, 'retire', 'équipement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"equipement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 737, 'mots-cles', NULL, 'équipement de départ', NULL, 'retire', 'équipement de départ', NULL, 'neutre', NULL, 'mot_cle', '{"id":"equipement-de-depart"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 738, 'mots-cles', NULL, 'erisia', NULL, 'retire', 'erisia', NULL, 'neutre', NULL, 'mot_cle', '{"id":"erisia"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 739, 'mots-cles', NULL, 'espace/temps', NULL, 'retire', 'espace/temps', NULL, 'neutre', NULL, 'mot_cle', '{"id":"espace-temps"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 740, 'mots-cles', NULL, 'esquive', NULL, 'retire', 'esquive', NULL, 'neutre', NULL, 'mot_cle', '{"id":"esquive"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 741, 'mots-cles', NULL, 'essence', NULL, 'retire', 'essence', NULL, 'neutre', NULL, 'mot_cle', '{"id":"essence"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 742, 'mots-cles', NULL, 'ethnie', NULL, 'retire', 'ethnie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ethnie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 743, 'mots-cles', NULL, 'expérience', NULL, 'retire', 'expérience', NULL, 'neutre', NULL, 'mot_cle', '{"id":"experience"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 744, 'mots-cles', NULL, 'fabrication', NULL, 'retire', 'fabrication', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fabrication"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 745, 'mots-cles', NULL, 'faction', NULL, 'retire', 'faction', NULL, 'neutre', NULL, 'mot_cle', '{"id":"faction"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 746, 'mots-cles', NULL, 'faiblesse', NULL, 'retire', 'faiblesse', NULL, 'neutre', NULL, 'mot_cle', '{"id":"faiblesse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 747, 'mots-cles', NULL, 'faiblesses', NULL, 'retire', 'faiblesses', NULL, 'neutre', NULL, 'mot_cle', '{"id":"faiblesses"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 748, 'mots-cles', NULL, 'familier', NULL, 'retire', 'familier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"familier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 749, 'mots-cles', NULL, 'fantassin', NULL, 'retire', 'fantassin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fantassin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 750, 'mots-cles', NULL, 'fatigue', NULL, 'retire', 'fatigue', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fatigue"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 751, 'mots-cles', NULL, 'fausse patte', NULL, 'retire', 'fausse patte', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fausse-patte"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 752, 'mots-cles', NULL, 'fenrir', NULL, 'retire', 'fenrir', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fenrir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 753, 'mots-cles', NULL, 'feu', NULL, 'retire', 'feu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"feu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 754, 'mots-cles', NULL, 'fiche de personnage', NULL, 'retire', 'fiche de personnage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fiche-de-personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 755, 'mots-cles', NULL, 'fin de tour', NULL, 'retire', 'fin de tour', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fin-de-tour"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 756, 'mots-cles', NULL, 'fiole', NULL, 'retire', 'fiole', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fiole"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 757, 'mots-cles', NULL, 'flagelleur', NULL, 'retire', 'flagelleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"flagelleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 758, 'mots-cles', NULL, 'flétrisseur', NULL, 'retire', 'flétrisseur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fletrisseur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 759, 'mots-cles', NULL, 'focus', NULL, 'retire', 'focus', NULL, 'neutre', NULL, 'mot_cle', '{"id":"focus"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 760, 'mots-cles', NULL, 'force', NULL, 'retire', 'force', NULL, 'neutre', NULL, 'mot_cle', '{"id":"force"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 761, 'mots-cles', NULL, 'force créatrice', NULL, 'retire', 'force créatrice', NULL, 'neutre', NULL, 'mot_cle', '{"id":"force-creatrice"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 762, 'mots-cles', NULL, 'force destructrice', NULL, 'retire', 'force destructrice', NULL, 'neutre', NULL, 'mot_cle', '{"id":"force-destructrice"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 763, 'mots-cles', NULL, 'forgeron', NULL, 'retire', 'forgeron', NULL, 'neutre', NULL, 'mot_cle', '{"id":"forgeron"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 764, 'mots-cles', NULL, 'formule des dégâts', NULL, 'retire', 'formule des dégâts', NULL, 'neutre', NULL, 'mot_cle', '{"id":"formule-des-degats"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 765, 'mots-cles', NULL, 'formules', NULL, 'retire', 'formules', NULL, 'neutre', NULL, 'mot_cle', '{"id":"formules"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 766, 'mots-cles', NULL, 'foudre', NULL, 'retire', 'foudre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"foudre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 767, 'mots-cles', NULL, 'frappeur', NULL, 'retire', 'frappeur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"frappeur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 768, 'mots-cles', NULL, 'fripon', NULL, 'retire', 'fripon', NULL, 'neutre', NULL, 'mot_cle', '{"id":"fripon"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 769, 'mots-cles', NULL, 'galopin', NULL, 'retire', 'galopin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"galopin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 770, 'mots-cles', NULL, 'gaucher', NULL, 'retire', 'gaucher', NULL, 'neutre', NULL, 'mot_cle', '{"id":"gaucher"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 771, 'mots-cles', NULL, 'gel', NULL, 'retire', 'gel', NULL, 'neutre', NULL, 'mot_cle', '{"id":"gel"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 772, 'mots-cles', NULL, 'gemme', NULL, 'retire', 'gemme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"gemme"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 773, 'mots-cles', NULL, 'glace', NULL, 'retire', 'glace', NULL, 'neutre', NULL, 'mot_cle', '{"id":"glace"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 774, 'mots-cles', NULL, 'gladiateur', NULL, 'retire', 'gladiateur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"gladiateur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 775, 'mots-cles', NULL, 'glossaire', NULL, 'retire', 'glossaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"glossaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 776, 'mots-cles', NULL, 'golem', NULL, 'retire', 'golem', NULL, 'neutre', NULL, 'mot_cle', '{"id":"golem"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 777, 'mots-cles', NULL, 'goleois', NULL, 'retire', 'goleois', NULL, 'neutre', NULL, 'mot_cle', '{"id":"goleois"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 778, 'mots-cles', NULL, 'gourou', NULL, 'retire', 'gourou', NULL, 'neutre', NULL, 'mot_cle', '{"id":"gourou"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 779, 'mots-cles', NULL, 'grand arbaletrier', NULL, 'retire', 'grand arbaletrier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"grand-arbaletrier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 780, 'mots-cles', NULL, 'grand archer', NULL, 'retire', 'grand archer', NULL, 'neutre', NULL, 'mot_cle', '{"id":"grand-archer"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 781, 'mots-cles', NULL, 'grand maclier', NULL, 'retire', 'grand maclier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"grand-maclier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 782, 'mots-cles', NULL, 'grenadier', NULL, 'retire', 'grenadier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"grenadier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 783, 'mots-cles', NULL, 'guerrier', NULL, 'retire', 'guerrier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"guerrier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 784, 'mots-cles', NULL, 'guide', NULL, 'retire', 'guide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"guide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 785, 'mots-cles', NULL, 'héros', NULL, 'retire', 'héros', NULL, 'neutre', NULL, 'mot_cle', '{"id":"heros"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 786, 'mots-cles', NULL, 'herses', NULL, 'retire', 'herses', NULL, 'neutre', NULL, 'mot_cle', '{"id":"herses"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 787, 'mots-cles', NULL, 'hirondelle', NULL, 'retire', 'hirondelle', NULL, 'neutre', NULL, 'mot_cle', '{"id":"hirondelle"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 788, 'mots-cles', NULL, 'histoire', NULL, 'retire', 'histoire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"histoire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 789, 'mots-cles', NULL, 'hoplite', NULL, 'retire', 'hoplite', NULL, 'neutre', NULL, 'mot_cle', '{"id":"hoplite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 790, 'mots-cles', NULL, 'huile', NULL, 'retire', 'huile', NULL, 'neutre', NULL, 'mot_cle', '{"id":"huile"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 791, 'mots-cles', NULL, 'ic', NULL, 'retire', 'ic', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ic"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 792, 'mots-cles', NULL, 'ingrédient', NULL, 'retire', 'ingrédient', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ingredient"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 793, 'mots-cles', NULL, 'initiative', NULL, 'retire', 'initiative', NULL, 'neutre', NULL, 'mot_cle', '{"id":"initiative"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 794, 'mots-cles', NULL, 'intelligence', NULL, 'retire', 'intelligence', NULL, 'neutre', NULL, 'mot_cle', '{"id":"intelligence"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 795, 'mots-cles', NULL, 'intervention', NULL, 'retire', 'intervention', NULL, 'neutre', NULL, 'mot_cle', '{"id":"intervention"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 796, 'mots-cles', NULL, 'introduction', NULL, 'retire', 'introduction', NULL, 'neutre', NULL, 'mot_cle', '{"id":"introduction"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 797, 'mots-cles', NULL, 'inventaire', NULL, 'retire', 'inventaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"inventaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 798, 'mots-cles', NULL, 'inventaire de départ', NULL, 'retire', 'inventaire de départ', NULL, 'neutre', NULL, 'mot_cle', '{"id":"inventaire-de-depart"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 799, 'mots-cles', NULL, 'invocation', NULL, 'retire', 'invocation', NULL, 'neutre', NULL, 'mot_cle', '{"id":"invocation"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 800, 'mots-cles', NULL, 'irréductible', NULL, 'retire', 'irréductible', NULL, 'neutre', NULL, 'mot_cle', '{"id":"irreductible"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 801, 'mots-cles', NULL, 'jackalope', NULL, 'retire', 'jackalope', NULL, 'neutre', NULL, 'mot_cle', '{"id":"jackalope"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 802, 'mots-cles', NULL, 'jet de dés', NULL, 'retire', 'jet de dés', NULL, 'neutre', NULL, 'mot_cle', '{"id":"jet-de-des"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 803, 'mots-cles', NULL, 'jeu de rôle', NULL, 'retire', 'jeu de rôle', NULL, 'neutre', NULL, 'mot_cle', '{"id":"jeu-de-role"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 804, 'mots-cles', NULL, 'jongleur', NULL, 'retire', 'jongleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"jongleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 805, 'mots-cles', NULL, 'joueur', NULL, 'retire', 'joueur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"joueur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 806, 'mots-cles', NULL, 'juge', NULL, 'retire', 'juge', NULL, 'neutre', NULL, 'mot_cle', '{"id":"juge"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 807, 'mots-cles', NULL, 'kit', NULL, 'retire', 'kit', NULL, 'neutre', NULL, 'mot_cle', '{"id":"kit"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 808, 'mots-cles', NULL, 'kitsune', NULL, 'retire', 'kitsune', NULL, 'neutre', NULL, 'mot_cle', '{"id":"kitsune"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 809, 'mots-cles', NULL, 'lanceur', NULL, 'retire', 'lanceur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"lanceur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 810, 'mots-cles', NULL, 'lancier', NULL, 'retire', 'lancier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"lancier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 811, 'mots-cles', NULL, 'lexique', NULL, 'retire', 'lexique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"lexique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 812, 'mots-cles', NULL, 'livre', NULL, 'retire', 'livre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"livre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 813, 'mots-cles', NULL, 'localisation', NULL, 'retire', 'localisation', NULL, 'neutre', NULL, 'mot_cle', '{"id":"localisation"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 814, 'mots-cles', NULL, 'loi', NULL, 'retire', 'loi', NULL, 'neutre', NULL, 'mot_cle', '{"id":"loi"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 815, 'mots-cles', NULL, 'loyal', NULL, 'retire', 'loyal', NULL, 'neutre', NULL, 'mot_cle', '{"id":"loyal"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 816, 'mots-cles', NULL, 'lumière', NULL, 'retire', 'lumière', NULL, 'neutre', NULL, 'mot_cle', '{"id":"lumiere"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 817, 'mots-cles', NULL, 'lutteur', NULL, 'retire', 'lutteur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"lutteur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 818, 'mots-cles', NULL, 'machine de guerre', NULL, 'retire', 'machine de guerre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"machine-de-guerre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 819, 'mots-cles', NULL, 'maclier', NULL, 'retire', 'maclier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maclier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 820, 'mots-cles', NULL, 'mage', NULL, 'retire', 'mage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 821, 'mots-cles', NULL, 'mage blanc', NULL, 'retire', 'mage blanc', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-blanc"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 822, 'mots-cles', NULL, 'mage bleu', NULL, 'retire', 'mage bleu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-bleu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 823, 'mots-cles', NULL, 'mage emeraude', NULL, 'retire', 'mage emeraude', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-emeraude"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 824, 'mots-cles', NULL, 'mage grenat', NULL, 'retire', 'mage grenat', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-grenat"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 825, 'mots-cles', NULL, 'mage jade', NULL, 'retire', 'mage jade', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-jade"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 826, 'mots-cles', NULL, 'mage noir', NULL, 'retire', 'mage noir', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-noir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 827, 'mots-cles', NULL, 'mage rouge', NULL, 'retire', 'mage rouge', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-rouge"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 828, 'mots-cles', NULL, 'mage rubis', NULL, 'retire', 'mage rubis', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-rubis"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 829, 'mots-cles', NULL, 'mage saphir', NULL, 'retire', 'mage saphir', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-saphir"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 830, 'mots-cles', NULL, 'mage vert', NULL, 'retire', 'mage vert', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mage-vert"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 831, 'mots-cles', NULL, 'magie', NULL, 'retire', 'magie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"magie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 832, 'mots-cles', NULL, 'magie acquise', NULL, 'retire', 'magie acquise', NULL, 'neutre', NULL, 'mot_cle', '{"id":"magie-acquise"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 833, 'mots-cles', NULL, 'magie innée', NULL, 'retire', 'magie innée', NULL, 'neutre', NULL, 'mot_cle', '{"id":"magie-innee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 834, 'mots-cles', NULL, 'maison', NULL, 'retire', 'maison', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maison"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 835, 'mots-cles', NULL, 'maître d''arme', NULL, 'retire', 'maître d''arme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maitre-darme"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 836, 'mots-cles', NULL, 'maître d''hast', NULL, 'retire', 'maître d''hast', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maitre-dhast"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 837, 'mots-cles', NULL, 'maître du jeu', NULL, 'retire', 'maître du jeu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maitre-du-jeu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 838, 'mots-cles', NULL, 'maîtrise d’arme', NULL, 'retire', 'maîtrise d’arme', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maitrise-darme"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 839, 'mots-cles', NULL, 'maladie', NULL, 'retire', 'maladie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"maladie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 840, 'mots-cles', NULL, 'malédiction', NULL, 'retire', 'malédiction', NULL, 'neutre', NULL, 'mot_cle', '{"id":"malediction"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 841, 'mots-cles', NULL, 'marcass', NULL, 'retire', 'marcass', NULL, 'neutre', NULL, 'mot_cle', '{"id":"marcass"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 842, 'mots-cles', NULL, 'marionette', NULL, 'retire', 'marionette', NULL, 'neutre', NULL, 'mot_cle', '{"id":"marionette"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 843, 'mots-cles', NULL, 'marionnettiste', NULL, 'retire', 'marionnettiste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"marionnettiste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 844, 'mots-cles', NULL, 'martiale', NULL, 'retire', 'martiale', NULL, 'neutre', NULL, 'mot_cle', '{"id":"martiale"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 845, 'mots-cles', NULL, 'masochiste', NULL, 'retire', 'masochiste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"masochiste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 846, 'mots-cles', NULL, 'matériaux', NULL, 'retire', 'matériaux', NULL, 'neutre', NULL, 'mot_cle', '{"id":"materiaux"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 847, 'mots-cles', NULL, 'mauvais', NULL, 'retire', 'mauvais', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mauvais"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 848, 'mots-cles', NULL, 'méditation', NULL, 'retire', 'méditation', NULL, 'neutre', NULL, 'mot_cle', '{"id":"meditation"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 849, 'mots-cles', NULL, 'médium', NULL, 'retire', 'médium', NULL, 'neutre', NULL, 'mot_cle', '{"id":"medium"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 850, 'mots-cles', NULL, 'médusain', NULL, 'retire', 'médusain', NULL, 'neutre', NULL, 'mot_cle', '{"id":"medusain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 851, 'mots-cles', NULL, 'ménestrel', NULL, 'retire', 'ménestrel', NULL, 'neutre', NULL, 'mot_cle', '{"id":"menestrel"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 852, 'mots-cles', NULL, 'mercenaire', NULL, 'retire', 'mercenaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mercenaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 853, 'mots-cles', NULL, 'météo', NULL, 'retire', 'météo', NULL, 'neutre', NULL, 'mot_cle', '{"id":"meteo"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 854, 'mots-cles', NULL, 'météorologue', NULL, 'retire', 'météorologue', NULL, 'neutre', NULL, 'mot_cle', '{"id":"meteorologue"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 855, 'mots-cles', NULL, 'minotaure', NULL, 'retire', 'minotaure', NULL, 'neutre', NULL, 'mot_cle', '{"id":"minotaure"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 856, 'mots-cles', NULL, 'minuté', NULL, 'retire', 'minuté', NULL, 'neutre', NULL, 'mot_cle', '{"id":"minute"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 857, 'mots-cles', NULL, 'mode hyper', NULL, 'retire', 'mode hyper', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mode-hyper"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 858, 'mots-cles', NULL, 'mode hyper 100%', NULL, 'retire', 'mode hyper 100%', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mode-hyper-100"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 859, 'mots-cles', NULL, 'mode super', NULL, 'retire', 'mode super', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mode-super"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 860, 'mots-cles', NULL, 'modificateur', NULL, 'retire', 'modificateur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"modificateur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 861, 'mots-cles', NULL, 'moine', NULL, 'retire', 'moine', NULL, 'neutre', NULL, 'mot_cle', '{"id":"moine"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 862, 'mots-cles', NULL, 'moine guerrier', NULL, 'retire', 'moine guerrier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"moine-guerrier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 863, 'mots-cles', NULL, 'monnaie', NULL, 'retire', 'monnaie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"monnaie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 864, 'mots-cles', NULL, 'monture', NULL, 'retire', 'monture', NULL, 'neutre', NULL, 'mot_cle', '{"id":"monture"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 865, 'mots-cles', NULL, 'Mordhau', 'Mot-clé', 'modifie', 'mordhau', 'Mordhau', 'neutre', NULL, 'mot_cle', '{"id":"mordhau"}', 'libelle');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 866, 'mots-cles', NULL, 'Mordhau', 'Définition', 'ajoute', NULL, 'Avec certaines armes de corps à corps (notamment les épées), prendre l''arme par la lame et frapper avec le manche. Elle peut ainsi faire des dégâts de frappe alors qu''elle en est incapable, mais a 30 % de chance de perdre un cran de solidité (exemple : plus de 70 au jet d''attaque).', 'neutre', NULL, 'mot_cle', '{"id":"mordhau"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 867, 'mots-cles', NULL, 'mrode', NULL, 'retire', 'mrode', NULL, 'neutre', NULL, 'mot_cle', '{"id":"mrode"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 868, 'mots-cles', NULL, 'multicolore', NULL, 'retire', 'multicolore', NULL, 'neutre', NULL, 'mot_cle', '{"id":"multicolore"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 869, 'mots-cles', NULL, 'myrmidon', NULL, 'retire', 'myrmidon', NULL, 'neutre', NULL, 'mot_cle', '{"id":"myrmidon"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 870, 'mots-cles', NULL, 'namazu', NULL, 'retire', 'namazu', NULL, 'neutre', NULL, 'mot_cle', '{"id":"namazu"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 871, 'mots-cles', NULL, 'naturel', NULL, 'retire', 'naturel', NULL, 'neutre', NULL, 'mot_cle', '{"id":"naturel"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 872, 'mots-cles', NULL, 'nécromancie', NULL, 'retire', 'nécromancie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"necromancie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 873, 'mots-cles', NULL, 'neutre', NULL, 'retire', 'neutre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"neutre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 874, 'mots-cles', NULL, 'ninja', NULL, 'retire', 'ninja', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ninja"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 875, 'mots-cles', NULL, 'niveau', NULL, 'retire', 'niveau', NULL, 'neutre', NULL, 'mot_cle', '{"id":"niveau"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 876, 'mots-cles', NULL, 'niveau global', NULL, 'retire', 'niveau global', NULL, 'neutre', NULL, 'mot_cle', '{"id":"niveau-global"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 877, 'mots-cles', NULL, 'niveaux de maîtrise', NULL, 'retire', 'niveaux de maîtrise', NULL, 'neutre', NULL, 'mot_cle', '{"id":"niveaux-de-maitrise"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 878, 'mots-cles', NULL, 'nm', NULL, 'retire', 'nm', NULL, 'neutre', NULL, 'mot_cle', '{"id":"nm"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 879, 'mots-cles', NULL, 'non-mort', NULL, 'retire', 'non-mort', NULL, 'neutre', NULL, 'mot_cle', '{"id":"non-mort"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 880, 'mots-cles', NULL, 'objets', NULL, 'retire', 'objets', NULL, 'neutre', NULL, 'mot_cle', '{"id":"objets"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 881, 'mots-cles', NULL, 'objets rapides', NULL, 'retire', 'objets rapides', NULL, 'neutre', NULL, 'mot_cle', '{"id":"objets-rapides"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 882, 'mots-cles', NULL, 'ocultomancien', NULL, 'retire', 'ocultomancien', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ocultomancien"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 883, 'mots-cles', NULL, 'offensif', NULL, 'retire', 'offensif', NULL, 'neutre', NULL, 'mot_cle', '{"id":"offensif"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 884, 'mots-cles', NULL, 'olwman', NULL, 'retire', 'olwman', NULL, 'neutre', NULL, 'mot_cle', '{"id":"olwman"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 885, 'mots-cles', NULL, 'ombre', NULL, 'retire', 'ombre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ombre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 886, 'mots-cles', NULL, 'oracle', NULL, 'retire', 'oracle', NULL, 'neutre', NULL, 'mot_cle', '{"id":"oracle"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 887, 'mots-cles', NULL, 'origine', NULL, 'retire', 'origine', NULL, 'neutre', NULL, 'mot_cle', '{"id":"origine"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 888, 'mots-cles', NULL, 'orios', NULL, 'retire', 'orios', NULL, 'neutre', NULL, 'mot_cle', '{"id":"orios"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 889, 'mots-cles', NULL, 'outil légendaire', NULL, 'retire', 'outil légendaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"outil-legendaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 890, 'mots-cles', NULL, 'panacée', NULL, 'retire', 'panacée', NULL, 'neutre', NULL, 'mot_cle', '{"id":"panacee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 891, 'mots-cles', NULL, 'pape', NULL, 'retire', 'pape', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pape"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 892, 'mots-cles', NULL, 'parade', NULL, 'retire', 'parade', NULL, 'neutre', NULL, 'mot_cle', '{"id":"parade"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 893, 'mots-cles', NULL, 'paralysie', NULL, 'retire', 'paralysie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"paralysie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 894, 'mots-cles', NULL, 'parchemin', NULL, 'retire', 'parchemin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"parchemin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 895, 'mots-cles', NULL, 'parleur', NULL, 'retire', 'parleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"parleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 896, 'mots-cles', NULL, 'parties du corps', NULL, 'retire', 'parties du corps', NULL, 'neutre', NULL, 'mot_cle', '{"id":"parties-du-corps"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 897, 'mots-cles', NULL, 'perception', NULL, 'retire', 'perception', NULL, 'neutre', NULL, 'mot_cle', '{"id":"perception"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 898, 'mots-cles', NULL, 'personnage', NULL, 'retire', 'personnage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"personnage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 899, 'mots-cles', NULL, 'personnages fil rouge', NULL, 'retire', 'personnages fil rouge', NULL, 'neutre', NULL, 'mot_cle', '{"id":"personnages-fil-rouge"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 900, 'mots-cles', NULL, 'pétrification', NULL, 'retire', 'pétrification', NULL, 'neutre', NULL, 'mot_cle', '{"id":"petrification"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 901, 'mots-cles', NULL, 'pétrifié', NULL, 'retire', 'pétrifié', NULL, 'neutre', NULL, 'mot_cle', '{"id":"petrifie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 902, 'mots-cles', NULL, 'peuples', NULL, 'retire', 'peuples', NULL, 'neutre', NULL, 'mot_cle', '{"id":"peuples"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 903, 'mots-cles', NULL, 'peur', NULL, 'retire', 'peur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"peur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 904, 'mots-cles', NULL, 'philtre', NULL, 'retire', 'philtre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"philtre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 905, 'mots-cles', NULL, 'pièce élémentaire', NULL, 'retire', 'pièce élémentaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"piece-elementaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 906, 'mots-cles', NULL, 'pièges', NULL, 'retire', 'pièges', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pieges"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 907, 'mots-cles', NULL, 'pièges magiques', NULL, 'retire', 'pièges magiques', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pieges-magiques"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 908, 'mots-cles', NULL, 'pièges mécaniques', NULL, 'retire', 'pièges mécaniques', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pieges-mecaniques"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 909, 'mots-cles', NULL, 'pnj', NULL, 'retire', 'pnj', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pnj"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 910, 'mots-cles', NULL, 'poison', NULL, 'retire', 'poison', NULL, 'neutre', NULL, 'mot_cle', '{"id":"poison"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 911, 'mots-cles', NULL, 'portée', NULL, 'retire', 'portée', NULL, 'neutre', NULL, 'mot_cle', '{"id":"portee"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 912, 'mots-cles', NULL, 'portes', NULL, 'retire', 'portes', NULL, 'neutre', NULL, 'mot_cle', '{"id":"portes"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 913, 'mots-cles', NULL, 'portes magiques', NULL, 'retire', 'portes magiques', NULL, 'neutre', NULL, 'mot_cle', '{"id":"portes-magiques"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 914, 'mots-cles', NULL, 'posture', NULL, 'retire', 'posture', NULL, 'neutre', NULL, 'mot_cle', '{"id":"posture"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 915, 'mots-cles', NULL, 'potentiel illimité', NULL, 'retire', 'potentiel illimité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"potentiel-illimite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 916, 'mots-cles', NULL, 'potion', NULL, 'retire', 'potion', NULL, 'neutre', NULL, 'mot_cle', '{"id":"potion"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 917, 'mots-cles', NULL, 'poudre de guérison', NULL, 'retire', 'poudre de guérison', NULL, 'neutre', NULL, 'mot_cle', '{"id":"poudre-de-guerison"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 918, 'mots-cles', NULL, 'primordial', NULL, 'retire', 'primordial', NULL, 'neutre', NULL, 'mot_cle', '{"id":"primordial"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 919, 'mots-cles', NULL, 'progression', NULL, 'retire', 'progression', NULL, 'neutre', NULL, 'mot_cle', '{"id":"progression"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 920, 'mots-cles', NULL, 'protecteur', NULL, 'retire', 'protecteur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"protecteur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 921, 'mots-cles', NULL, 'provocation', NULL, 'retire', 'provocation', NULL, 'neutre', NULL, 'mot_cle', '{"id":"provocation"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 922, 'mots-cles', NULL, 'pugiliste', NULL, 'retire', 'pugiliste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"pugiliste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 923, 'mots-cles', NULL, 'puissance magique', NULL, 'retire', 'puissance magique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"puissance-magique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 924, 'mots-cles', NULL, 'race non jouable', NULL, 'retire', 'race non jouable', NULL, 'neutre', NULL, 'mot_cle', '{"id":"race-non-jouable"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 925, 'mots-cles', NULL, 'ravageur', NULL, 'retire', 'ravageur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ravageur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 926, 'mots-cles', NULL, 'réaction', NULL, 'retire', 'réaction', NULL, 'neutre', NULL, 'mot_cle', '{"id":"reaction"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 927, 'mots-cles', NULL, 'Recharge longue', NULL, 'ajoute', NULL, 'Recharge longue', 'neutre', NULL, 'mot_cle', '{"id":"recharge-longue"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 928, 'mots-cles', NULL, 'Recharge très longue', NULL, 'ajoute', NULL, 'Recharge très longue', 'neutre', NULL, 'mot_cle', '{"id":"recharge-tres-longue"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 929, 'mots-cles', NULL, 'régénération', NULL, 'retire', 'régénération', NULL, 'neutre', NULL, 'mot_cle', '{"id":"regeneration"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 930, 'mots-cles', NULL, 'relations', NULL, 'retire', 'relations', NULL, 'neutre', NULL, 'mot_cle', '{"id":"relations"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 931, 'mots-cles', NULL, 'remède', NULL, 'retire', 'remède', NULL, 'neutre', NULL, 'mot_cle', '{"id":"remede"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 932, 'mots-cles', NULL, 'repos', NULL, 'retire', 'repos', NULL, 'neutre', NULL, 'mot_cle', '{"id":"repos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 933, 'mots-cles', NULL, 'résistance', NULL, 'retire', 'résistance', NULL, 'neutre', NULL, 'mot_cle', '{"id":"resistance"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 934, 'mots-cles', NULL, 'résumé', NULL, 'retire', 'résumé', NULL, 'neutre', NULL, 'mot_cle', '{"id":"resume"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 935, 'mots-cles', NULL, 'réussite critique', NULL, 'retire', 'réussite critique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"reussite-critique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 936, 'mots-cles', NULL, 'rokh', NULL, 'retire', 'rokh', NULL, 'neutre', NULL, 'mot_cle', '{"id":"rokh"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 937, 'mots-cles', NULL, 'ruines', NULL, 'retire', 'ruines', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ruines"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 938, 'mots-cles', NULL, 'rune', NULL, 'retire', 'rune', NULL, 'neutre', NULL, 'mot_cle', '{"id":"rune"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 939, 'mots-cles', NULL, 'ruse', NULL, 'retire', 'ruse', NULL, 'neutre', NULL, 'mot_cle', '{"id":"ruse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 940, 'mots-cles', NULL, 'sabotage', NULL, 'retire', 'sabotage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sabotage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 941, 'mots-cles', NULL, 'saboteur', NULL, 'retire', 'saboteur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"saboteur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 942, 'mots-cles', NULL, 'sac à dos', NULL, 'retire', 'sac à dos', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sac-a-dos"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 943, 'mots-cles', NULL, 'sadique', NULL, 'retire', 'sadique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sadique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 944, 'mots-cles', NULL, 'saignement', NULL, 'retire', 'saignement', NULL, 'neutre', NULL, 'mot_cle', '{"id":"saignement"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 945, 'mots-cles', NULL, 'saint combattant', NULL, 'retire', 'saint combattant', NULL, 'neutre', NULL, 'mot_cle', '{"id":"saint-combattant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 946, 'mots-cles', NULL, 'sang', NULL, 'retire', 'sang', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sang"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 947, 'mots-cles', NULL, 'santé', NULL, 'retire', 'santé', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sante"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 948, 'mots-cles', NULL, 'saronide', NULL, 'retire', 'saronide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"saronide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 949, 'mots-cles', NULL, 'satyre', NULL, 'retire', 'satyre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"satyre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 950, 'mots-cles', NULL, 'scénario one shot', NULL, 'retire', 'scénario one shot', NULL, 'neutre', NULL, 'mot_cle', '{"id":"scenario-one-shot"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 951, 'mots-cles', NULL, 'serrures', NULL, 'retire', 'serrures', NULL, 'neutre', NULL, 'mot_cle', '{"id":"serrures"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 952, 'mots-cles', NULL, 'sicaire', NULL, 'retire', 'sicaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sicaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 953, 'mots-cles', NULL, 'siège', NULL, 'retire', 'siège', NULL, 'neutre', NULL, 'mot_cle', '{"id":"siege"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 954, 'mots-cles', NULL, 'social', NULL, 'retire', 'social', NULL, 'neutre', NULL, 'mot_cle', '{"id":"social"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 955, 'mots-cles', NULL, 'soin', NULL, 'retire', 'soin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"soin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 956, 'mots-cles', NULL, 'Solidité', 'Mot-clé', 'modifie', 'solidité', 'Solidité', 'neutre', NULL, 'mot_cle', '{"id":"solidite"}', 'libelle');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 957, 'mots-cles', NULL, 'Solidité', 'Définition', 'ajoute', NULL, 'État de l''équipement. Une Solidité à 0 rend l''objet inutilisable et exige une réparation à l''aide d''un kit de réparation, ou d''une compétence d''artisanat adaptée ainsi que du même matériau que l''objet.', 'neutre', NULL, 'mot_cle', '{"id":"solidite"}', 'description');
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 958, 'mots-cles', NULL, 'solvant', NULL, 'retire', 'solvant', NULL, 'neutre', NULL, 'mot_cle', '{"id":"solvant"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 959, 'mots-cles', NULL, 'Sort fer', NULL, 'ajoute', NULL, 'Sort fer', 'neutre', NULL, 'mot_cle', '{"id":"sort-fer"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 960, 'mots-cles', NULL, 'Sort grenade', NULL, 'ajoute', NULL, 'Sort grenade', 'neutre', NULL, 'mot_cle', '{"id":"sort-grenade"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 961, 'mots-cles', NULL, 'sort raté', NULL, 'retire', 'sort raté', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sort-rate"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 962, 'mots-cles', NULL, 'sorts', NULL, 'retire', 'sorts', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sorts"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 963, 'mots-cles', NULL, 'sources', NULL, 'retire', 'sources', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sources"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 964, 'mots-cles', NULL, 'spécialiste', NULL, 'retire', 'spécialiste', NULL, 'neutre', NULL, 'mot_cle', '{"id":"specialiste"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 965, 'mots-cles', NULL, 'spécialité', NULL, 'retire', 'spécialité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"specialite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 966, 'mots-cles', NULL, 'sprint', NULL, 'retire', 'sprint', NULL, 'neutre', NULL, 'mot_cle', '{"id":"sprint"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 967, 'mots-cles', NULL, 'stabilisateur', NULL, 'retire', 'stabilisateur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"stabilisateur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 968, 'mots-cles', NULL, 'structures naturelles', NULL, 'retire', 'structures naturelles', NULL, 'neutre', NULL, 'mot_cle', '{"id":"structures-naturelles"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 969, 'mots-cles', NULL, 'structures occupées', NULL, 'retire', 'structures occupées', NULL, 'neutre', NULL, 'mot_cle', '{"id":"structures-occupees"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 970, 'mots-cles', NULL, 'surcharge magique', NULL, 'retire', 'surcharge magique', NULL, 'neutre', NULL, 'mot_cle', '{"id":"surcharge-magique"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 971, 'mots-cles', NULL, 'surdité', NULL, 'retire', 'surdité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"surdite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 972, 'mots-cles', NULL, 'surnom', NULL, 'retire', 'surnom', NULL, 'neutre', NULL, 'mot_cle', '{"id":"surnom"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 973, 'mots-cles', NULL, 'survie', NULL, 'retire', 'survie', NULL, 'neutre', NULL, 'mot_cle', '{"id":"survie"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 974, 'mots-cles', NULL, 'symbiose', NULL, 'retire', 'symbiose', NULL, 'neutre', NULL, 'mot_cle', '{"id":"symbiose"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 975, 'mots-cles', NULL, 'table de butin', NULL, 'retire', 'table de butin', NULL, 'neutre', NULL, 'mot_cle', '{"id":"table-de-butin"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 976, 'mots-cles', NULL, 'table de rencontre', NULL, 'retire', 'table de rencontre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"table-de-rencontre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 977, 'mots-cles', NULL, 'templier', NULL, 'retire', 'templier', NULL, 'neutre', NULL, 'mot_cle', '{"id":"templier"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 978, 'mots-cles', NULL, 'tenaille', NULL, 'retire', 'tenaille', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tenaille"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 979, 'mots-cles', NULL, 'terrain', NULL, 'retire', 'terrain', NULL, 'neutre', NULL, 'mot_cle', '{"id":"terrain"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 980, 'mots-cles', NULL, 'terre', NULL, 'retire', 'terre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"terre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 981, 'mots-cles', NULL, 'tête', NULL, 'retire', 'tête', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tete"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 982, 'mots-cles', NULL, 'tireur d''élite', NULL, 'retire', 'tireur d''élite', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tireur-delite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 983, 'mots-cles', NULL, 'tour', NULL, 'retire', 'tour', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tour"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 984, 'mots-cles', NULL, 'tour de charge', NULL, 'retire', 'tour de charge', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tour-de-charge"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 985, 'mots-cles', NULL, 'triche', NULL, 'retire', 'triche', NULL, 'neutre', NULL, 'mot_cle', '{"id":"triche"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 986, 'mots-cles', NULL, 'tueur', NULL, 'retire', 'tueur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"tueur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 987, 'mots-cles', NULL, 'univers', NULL, 'retire', 'univers', NULL, 'neutre', NULL, 'mot_cle', '{"id":"univers"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 988, 'mots-cles', NULL, 'universelle', NULL, 'retire', 'universelle', NULL, 'neutre', NULL, 'mot_cle', '{"id":"universelle"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 989, 'mots-cles', NULL, 'va-t-en guerre', NULL, 'retire', 'va-t-en guerre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"va-t-en-guerre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 990, 'mots-cles', NULL, 'vent', NULL, 'retire', 'vent', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vent"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 991, 'mots-cles', NULL, 'vide', NULL, 'retire', 'vide', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vide"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 992, 'mots-cles', NULL, 'vigilance', NULL, 'retire', 'vigilance', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vigilance"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 993, 'mots-cles', NULL, 'vindicatif', NULL, 'retire', 'vindicatif', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vindicatif"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 994, 'mots-cles', NULL, 'vitesse', NULL, 'retire', 'vitesse', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vitesse"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 995, 'mots-cles', NULL, 'vitesse de nage', NULL, 'retire', 'vitesse de nage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vitesse-de-nage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 996, 'mots-cles', NULL, 'vitesse terrestre', NULL, 'retire', 'vitesse terrestre', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vitesse-terrestre"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 997, 'mots-cles', NULL, 'vocabulaire', NULL, 'retire', 'vocabulaire', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vocabulaire"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 998, 'mots-cles', NULL, 'voleur', NULL, 'retire', 'voleur', NULL, 'neutre', NULL, 'mot_cle', '{"id":"voleur"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 999, 'mots-cles', NULL, 'volonté', NULL, 'retire', 'volonté', NULL, 'neutre', NULL, 'mot_cle', '{"id":"volonte"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 1000, 'mots-cles', NULL, 'voyage', NULL, 'retire', 'voyage', NULL, 'neutre', NULL, 'mot_cle', '{"id":"voyage"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 1001, 'mots-cles', NULL, 'vulnérabilité', NULL, 'retire', 'vulnérabilité', NULL, 'neutre', NULL, 'mot_cle', '{"id":"vulnerabilite"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 1002, 'mots-cles', NULL, 'zélote', NULL, 'retire', 'zélote', NULL, 'neutre', NULL, 'mot_cle', '{"id":"zelote"}', NULL);
INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne) VALUES ('0.4', 1003, 'mots-cles', NULL, 'zone d''influence', NULL, 'retire', 'zone d''influence', NULL, 'neutre', NULL, 'mot_cle', '{"id":"zone-dinfluence"}', NULL);

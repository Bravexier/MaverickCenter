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

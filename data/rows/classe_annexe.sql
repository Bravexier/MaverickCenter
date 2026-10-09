-- data/rows/classe_annexe.sql : export déterministe, une instruction par ligne, triée par (classe_id, rang). NE PAS ÉDITER À LA MAIN.
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 1, 'SANG', 'sang', 'magies/magie-du-sang', '(Passif) Téméraire. Diminue de 5% le malus pour toucher une cible de la posture offensive.
(Passif) Régénération. Récupère 1d4 santé chaque début de tour. (ne marche pas quand coma).
(Actif 2 fois/combat) Attaque saignante. La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "saignement 1".
(Action 1 fois/combat) Rage de sang. Excite les alliés, leur donnant la capacité de faire +6 dégâts contre les cibles qui ont un état de saignement pendant 4 tours.', 'classes', 'Classe Maverick V7 › Mage Bleu › A58:AR62');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 2, 'ARCANE', 'arcane', 'magies/magie-de-larcane', '(Passif) Rechargement. Récupère 1d4 chakra chaque début de tour. (ne marche pas quand coma).
(Passif) Rune immédiate. Obtient une résistance à l''élément du dernier sort subi pour un tour. (non cumulable)
(Réaction 2 fois/combat) Miroir partiel. Renvoi à hauteur de 25% des effets du sort de l’adversaire (l’agresseur peut se défendre contre cette contre-attaque si c’est possible)', 'classes', 'Classe Maverick V7 › Mage Bleu › A63:AR67');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 3, 'CORRUPTION', 'corruption', 'magies/magie-de-la-corruption', '(Passif) Science du critique. Cette créature a +2 à la réussite critique et à l’échec critique.
(Passif) Éponge à corruption. Peut soigner une cible de 1d4 corruption si elle est à côté.
(Actif 2 fois/combat) Pollution. L''attaque avec l''arme va diminuer pendant un tour une résistance magique aléatoire.
(Passif) Pétronage. La vitesse augmente de +1 sur un terrain marécageux.', 'classes', 'Classe Maverick V7 › Mage Bleu › A68:AR72');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 4, 'ESPACE/TEMPS', 'espace-temps', 'magies/magie-de-lespace-temps', '(Actif 1 fois/combat) 25h. Cette créature est capable d’utiliser un sortilège de l’Espace/Temps qui est capable de placement, le sort ne fera rien d’autre que l’effet de placement.
(Passif) Couple extrémité. Tours impairs = +4 Initiative | Tours pairs = -4 Initiative.
(Passif) Double. Tous les 3 tours, un clone de la créature apparait et a 50% de chance de prendre la prochaine agression à la place de l''original.', 'classes', 'Classe Maverick V7 › Mage Bleu › A73:AR77');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 5, 'VIDE', 'vide', 'magies/magie-du-vide', '(Passif) Attaque dissipante. Tous les 3 tours, l’attaque de cette créature inflige l’effet du sort “dissipation” de la magie du vide.
(Passif) Maître du silence. Cette créature ne peut pas subir les sorts ou effets qui empêchent d’utiliser la magie.
(Passif) Esprit solide. Avantage sur les jets contre la couardise ou le contrôle mental.
(Passif) Totem du vide. Les ennemis à 2 cases autour de la créature ont un malus de 10% à tous les jets qui impliquent la volonté.', 'classes', 'Classe Maverick V7 › Mage Bleu › A78:AR82');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 6, 'NÉCROMANCIE', 'necromancie', 'magies/magie-de-la-necromancie', '(Passif) Squelettique. Augmente d''un cran la résistance aux dégâts d''estoc des armures. Être sans armure donne 2AP base.
(Actif 2 fois/combat) Attaque poison. La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "poison 1".
(Passif) Chair de mort. Avantage sur les jets contre le poison ou le contrôle mental.
(Passif) Attrape-moi !. Augmente les jets de défense de 2% par créature empoisonnée sur le terrain.', 'classes', 'Classe Maverick V7 › Mage Bleu › A83:AR87');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 7, 'FEU', 'feu', 'magies/magie-du-feu', '(Passif) Moteur thermique. Si un dégât de l''élément feu est encaissé, les dégâts augmentent de +3 et la vitesse de 1 pendant 2 tours.
(Passif) Déflagration. Sacrifie les AP ou AM pour les ajouter à ses dégâts pendant 2 tours.
(Passif) Éponge à soin. Obtient un bonus de +4 à chaque soin obtenu (magique ou potion).
(Passif) Sang de feu. Sur les terrains ou météos où le feu est avantagé : +3 dégâts, +1 AP. Sur les terrains ou météos où le feu est désavantagé : -3 dégâts, -1 AP', 'classes', 'Classe Maverick V7 › Mage Bleu › A88:AR92');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 8, 'EAU', 'eau', 'magies/magie-de-leau', '(Passif) Gluant. Augmente d''un cran la résistance aux dégâts de frappe des armures mais augmente la faiblesse à la foudre.
(Passif) Réparation. Récupère 1d4 barrière chaque début de tour. (ne marche pas quand coma).
(Passif) Aisance marine. +1 vitesse dans l''eau.
(Passif) Mucus. Annule les 4 premiers dégâts magiques encaissés. Se recharge tous les débuts de tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A93:AR97');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 9, 'GLACE', 'glace', 'magies/magie-de-la-glace', '(Actif 2 fois/combat) Attaque glaçante. La prochaine attaque réussie obligera le jet de vigueur à l''adversaire pour ne pas qu''il prenne "gelé 1".
(Passif) Neige permanente. Quand la météo neige est invoquée, elle perdurera tant que personne ne la change.
(Passif) Peau froide. +2 AM de base.
(Passif) Pas de la neige. Ignore totalement les malus des terrains liés à la neige/glace.', 'classes', 'Classe Maverick V7 › Mage Bleu › A98:AR102');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 10, 'TERRE', 'terre', 'magies/magie-de-la-terre', '(Passif) Racine. Tant qu''il est sur de la terre, cette créature récupère 3 santé au début de son tour.
(Passif) Grimpeur. Avantage sur le jet pour grimper un mur.
(Passif) Peau dure. +2 AP de base.
(Passif] Sujet épineux. En posture de défense, cette créature inflige 4 dégâts lors d''une parade parfaite.', 'classes', 'Classe Maverick V7 › Mage Bleu › A103:AR107');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 11, 'VENT', 'vent', 'magies/magie-du-vent', '(Passif) Charge sans peur. Permet d''avoir un bonus de +4 au jet d''initiative.
(Action) Crache spore. Crache des spores qui obligent toutes les créatures à 2 cases de lui de réussir un jet de vigueur, si elles ratent, elles sont "étourdies" pendant 1 tour.
(Passif) Chute douce. Dégâts de chute divisés par 2 (AVANT L''ARMURE).
(Passif) Courant rapide. Si cette créature termine son tour sans ennemi adjacent à lui = +2 INI pour le prochain tour.', 'classes', 'Classe Maverick V7 › Mage Bleu › A108:AR112');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 12, 'FOUDRE', 'foudre', 'magies/magie-de-la-foudre', '(Passif) Paratonnerre. Attire les sorts de la foudre ou bien la foudre naturelle sur lui-même. (S''il est dans la portée du sort)
(Passif) Pied véloce. +1 vitesse au sol en cas de météo “orage” ou “champ magnétique”.
(Passif) Dynamo. Gagne +3 dégâts de foudre (cumulable 3 fois) pour la prochaine action lorsque la foudre magique ou naturelle le touche.
(Passif) Prédateur cinétique. Si cette créature a parcouru 4 cases ou plus en ligne droite pour atteindre sa cible = +5% à la réussite de sa prochaine attaque.', 'classes', 'Classe Maverick V7 › Mage Bleu › A113:AR117');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 13, 'LUMIERE', 'lumiere', 'magies/magie-de-la-lumiere', '(Passif) Force solaire. Augmente tous les dégâts de +5 (+7 en grand soleil) mais prend 10% de la santé max en dégâts à chaque fin de tour.
(Réaction 1 fois/tour) Lumière de force. Permet d''annuler 5 dégâts d''une attaque encaissée.
(Passif) Soin non-mort. Cette créature est capable de soigner les non-morts et morts-vivants avec la magie de la lumière.
(Passif) Lanterne sur bâton. Cette créature dévoile les ennemis invisibles ou discrets dans un rayon de 2 cases autour de lui.', 'classes', 'Classe Maverick V7 › Mage Bleu › A118:AR122');
INSERT INTO classe_annexe (classe_id, rang, libelle, libelle_cle, magie_id, texte, origine, source_ref) VALUES ('classes/mage-bleu', 14, 'OMBRE', 'ombre', 'magies/magie-de-lombre', '(Actif 2 fois/combat) Attaque maudite. La prochaine attaque réussie appliquera l''effet "malédiction" sur l''ennemi pendant 1 tour.
(Passif) Vision nocturne partielle. Annule les malus dus à l''obscurité.
(Passif) Mantelet des ténèbres. Impose un malus de 10% aux jets de parade/esquive aux ennemis à 1 case.
(Passif) Obscurité avantageuse. Cette créature est avantagée dans le noir, il impose un malus de 5% à tous les jets hostiles envers lui et toutes ses attaques ont un bonus de 4.', 'classes', 'Classe Maverick V7 › Mage Bleu › A123:AR127');

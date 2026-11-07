-- 0104-r198-r208-textes-du-guide : décisions R198 à R208 du propriétaire (réponses du 2026-11-07, docs/decisions-regles.md), suite des migrations
-- 0101 à 0103 : les TEXTES de nos pages du guide, des mots-clés et des corps de pages typées. Migration de DONNÉES seules (sections 1 et 3 ;
-- PRAGMA user_version 103 -> 104 ; rien d'autre ne change dans data/schema.sql) ; rien ne va dans historique_modification (la migration n'est pas une
-- modification du site de dev). Registre avant/après : 0104-r198-r208-textes-du-guide.json (`textes`, une entrée par remplacement ; pas sous
-- `corrections` : ce ne sont pas des corrections d'un classeur, et le rapprochement les hériterait aux lignes de la page).
--   * R198 (postures) : guide/les-postures (durée « tant qu'on n'en change pas », malus du Défensif au-delà de deux, Provocation « dialogue ou
--     jet », Focus « Préparation (Mage Rouge) et Chargement (Mage Vert) », Vigilance : Observation seule, 1d4 résistances ou vulnérabilités ;
--     Symbiose : plus de tour d'effet gratuit, on ne peut que lancer des sorts, parchemins permis et effets passifs actifs comme R112) ;
--     guide/attaquer-et-se-defendre (Défensif), guide/le-tour-de-jeu (durée), guide/resistances-et-faiblesses (1d4). L'« anticipation en IC » de
--     la fiche auto (G3, à confirmer) n'est pas écrite.
--   * R199 : guide/les-degats (bonus fixes à l'étape 2, doublés par la réussite critique), guide/attaquer-et-se-defendre (dégâts doublés bonus
--     compris, résultat plus bas = meilleur, exemple 30 / 25, arme à deux compétences au choix du joueur), quitter la zone d'influence ouvre une
--     attaque d'opportunité (guide/deplacement-ou-sortie-de-la-zone-d-influence, guide/prise-en-tenaille-et-zone-d-influence, mot-clé
--     zone-dinfluence). Le mot-clé attaque-gratuite garde son identifiant (identifiants figés) : aucune balise ni étiquette ne l'employait ; sa
--     définition renvoie à {{attaque-dopportunite}}, sans adresse (une seconde adresse /regles/les-attaques-d-opportunite/ rendrait ambigu un lien
--     saisi vers cette page : lib/mots-cles-liens.mjs#motsClesDeLAdresse).
--   * R200 (Mode Hyper) : guide/le-mode-hyper (zone saturée : durée limitée par le niveau ; 10 % à la fin du tour du joueur ; ⌊niveau ÷ 2⌋ avec
--     l'exemple du niveau 9 ; chakra épuisé payé en santé, 3 par point, sans la barrière ; phrase de l'onglet masqué retirée, P9) ;
--     guide/liste-des-effets-mode-super (arrondi).
--   * R201 (barrière) : mot-clé barriere (prend les coups avant la santé, dit comme règle du jeu ; moitié du chakra arrondie à l'inférieur ; la
--     première phrase, écrite par le site de dev, ne change pas), guide/finaliser-son-personnage et guide/les-degats (arrondie à l'inférieur).
--   * R202 : guide/finaliser-son-personnage (or de départ en Ricken d'or, RO), guide/la-montee-de-niveau (XP au jugement du MJ), mot-clé
--     classe-magique (la seconde spécialité compte aussi comme condition d'emplacement de sort).
--   * R203 : guide/reussites-echecs-et-critiques, « ne descend jamais sous 1 à 1 » à côté du plafond (la phrase de la constante
--     critique.plancher, migration 0101).
--   * R204 : « Prouesse » -> « Calme » dans la page copiée guide/fiche-competences (exception voulue par le propriétaire).
--   * R205 (3) : « Gelé » -> « Gel » dans les corps des pages typées que la 0103 laissait (magies de la Glace, de la Nécromancie, du Feu, du Sang,
--     du Vent ; ressources/accessoires ; ressources/maladie), mêmes motifs ; « Cerveau gelé », « gelé au stade 1 » (Fer froid), « sol gelé »
--     et le Codex restent.
--   * R207 : guide/equipement-et-butin (les trois dés du butin s'additionnent ; {{maroquinier}} au lieu du « travailleur du cuir ») ; mots-clés
--     maroquinier et armurier créés, l'adresse de leur métier (/metiers/#metier-<slug>, comme forgeron et couturier).
--   * R208 : guide/exercer-un-metier (l'avantage d'un métier, c'est le MJ qui le décide).
--   Inchangés : les copies de source (guide/fiche-* sauf R204, guide/formule-des-degats, guide/attaque-et-defense, le texte copié de
--   guide/reussites-echecs-et-critiques, guide/les-attaques-d-opportunite, le Codex lore/*, ressources/pieces-elementaires), posture_effet,
--   mode_hyper_effet, mode_texte, ecart_source, historique_modification, note_version_ligne.
-- La garde : chaque UPDATE ne remplace qu'un fragment présent une seule fois dans la valeur d'avant, et doit changer exactement une ligne. Une valeur
-- que le site de dev aurait réécrite arrête la migration. Les deux mots-clés créés : une ligne déjà présente l'arrête aussi (clé primaire).


CREATE TEMP TABLE garde_0104 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));


-- page.corps_md

-- guide/les-postures (R198 (6))
UPDATE page SET corps_md = replace(corps_md, '- Au début de son tour, une fois subis les effets du début du tour (poison, brûlure…), chaque personnage **déclare sa posture, avant de faire quoi que ce soit d’autre** (voir {{le-tour-de-jeu}}).',
  '- **On garde sa posture tant qu’on n’en change pas.** C’est au début de son tour, une fois subis les effets du début du tour (poison, brûlure…), et avant de faire quoi que ce soit d’autre, qu’un personnage prend sa posture ou en change (voir {{le-tour-de-jeu}}).')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- Au début de son tour, une fois subis les effets du début du tour (poison, brûlure…), chaque personnage **déclare sa posture, avant de faire quoi que ce soit d’autre** (voir {{le-tour-de-jeu}}).', '')) = length('- Au début de son tour, une fois subis les effets du début du tour (poison, brûlure…), chaque personnage **déclare sa posture, avant de faire quoi que ce soit d’autre** (voir {{le-tour-de-jeu}}).');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (6)', changes());

-- guide/les-postures (R198 (1))
UPDATE page SET corps_md = replace(corps_md, '- **Parades et esquives sans limite** : autant de défenses qu’il y a de coups, mais chacune fait baisser de 10 % la réussite de la suivante. Le Doc « Créer sa fiche de personnage » compte ce malus dès la première défense ; le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}} seulement au-delà de deux.',
  '- **Parades et esquives sans limite** : autant de défenses qu’il y a de coups, mais au-delà de deux parades ou esquives, chacune fait baisser de 10 % la réussite de la suivante.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- **Parades et esquives sans limite** : autant de défenses qu’il y a de coups, mais chacune fait baisser de 10 % la réussite de la suivante. Le Doc « Créer sa fiche de personnage » compte ce malus dès la première défense ; le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}} seulement au-delà de deux.', '')) = length('- **Parades et esquives sans limite** : autant de défenses qu’il y a de coups, mais chacune fait baisser de 10 % la réussite de la suivante. Le Doc « Créer sa fiche de personnage » compte ce malus dès la première défense ; le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}} seulement au-delà de deux.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (1)', changes());

-- guide/les-postures (R198 (2))
UPDATE page SET corps_md = replace(corps_md, '- **Provocation** : en échange d’un bon dialogue et d’un jet réussi de *Diplomatie*, d’*Intimidation* ou de *Manipulation*, un adversaire est obligé de n’attaquer que vous pendant 1 tour. (Le Doc « Guide pour MJ » se contente du dialogue **ou** du jet.)',
  '- **Provocation** : en échange d’un bon dialogue ou d’un jet réussi de *Diplomatie*, d’*Intimidation* ou de *Manipulation*, un adversaire est obligé de n’attaquer que vous pendant 1 tour.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- **Provocation** : en échange d’un bon dialogue et d’un jet réussi de *Diplomatie*, d’*Intimidation* ou de *Manipulation*, un adversaire est obligé de n’attaquer que vous pendant 1 tour. (Le Doc « Guide pour MJ » se contente du dialogue **ou** du jet.)', '')) = length('- **Provocation** : en échange d’un bon dialogue et d’un jet réussi de *Diplomatie*, d’*Intimidation* ou de *Manipulation*, un adversaire est obligé de n’attaquer que vous pendant 1 tour. (Le Doc « Guide pour MJ » se contente du dialogue **ou** du jet.)');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (2)', changes());

-- guide/les-postures (R198 (5))
UPDATE page SET corps_md = replace(corps_md, 'La posture casse aussi le tour de charge de la capacité *Préparation* du Mage Rouge et Vert.',
  'La posture casse aussi le tour de charge des capacités *Préparation* (Mage Rouge) et *Chargement* (Mage Vert).')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, 'La posture casse aussi le tour de charge de la capacité *Préparation* du Mage Rouge et Vert.', '')) = length('La posture casse aussi le tour de charge de la capacité *Préparation* du Mage Rouge et Vert.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (5)', changes());

-- guide/les-postures (R198 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Anticiper l’adversaire** : un jet d’*Observation* (ou de *Distinction*, d’après le Doc « Créer sa fiche de personnage ») donne une information utile sur sa prochaine action ; voyez avec le MJ.',
  '- **Anticiper l’adversaire** : un jet d’*Observation* donne une information utile sur sa prochaine action ; voyez avec le MJ.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- **Anticiper l’adversaire** : un jet d’*Observation* (ou de *Distinction*, d’après le Doc « Créer sa fiche de personnage ») donne une information utile sur sa prochaine action ; voyez avec le MJ.', '')) = length('- **Anticiper l’adversaire** : un jet d’*Observation* (ou de *Distinction*, d’après le Doc « Créer sa fiche de personnage ») donne une information utile sur sa prochaine action ; voyez avec le MJ.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (3)', changes());

-- guide/les-postures (R198 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Repérer 1d4 résistance/vulnérabilité**, comme l’écrivent les deux documents : une action rapide (IC) permet de détecter une résistance ou une vulnérabilité de l’ennemi, prise au hasard.',
  '- **Repérer 1d4 résistances ou vulnérabilités** : une action rapide (IC) permet de détecter 1d4 résistances ou vulnérabilités de l’ennemi.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- **Repérer 1d4 résistance/vulnérabilité**, comme l’écrivent les deux documents : une action rapide (IC) permet de détecter une résistance ou une vulnérabilité de l’ennemi, prise au hasard.', '')) = length('- **Repérer 1d4 résistance/vulnérabilité**, comme l’écrivent les deux documents : une action rapide (IC) permet de détecter une résistance ou une vulnérabilité de l’ennemi, prise au hasard.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (3)', changes());

-- guide/les-postures (R198 (4))
UPDATE page SET corps_md = replace(corps_md, '- Le Doc « Guide pour MJ » ajoute **un tour d’effet gratuit** aux effets de vos sorts qui durent plusieurs tours ; le Doc « Créer sa fiche de personnage » ne le dit pas.' || char(10) || '',
  '')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- Le Doc « Guide pour MJ » ajoute **un tour d’effet gratuit** aux effets de vos sorts qui durent plusieurs tours ; le Doc « Créer sa fiche de personnage » ne le dit pas.' || char(10) || '', '')) = length('- Le Doc « Guide pour MJ » ajoute **un tour d’effet gratuit** aux effets de vos sorts qui durent plusieurs tours ; le Doc « Créer sa fiche de personnage » ne le dit pas.' || char(10) || '');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (4)', changes());

-- guide/les-postures (R198 (4), R112)
UPDATE page SET corps_md = replace(corps_md, '- *Inconvénient* : **ni armes ni objets**, sauf la Forgemagie (un sort qui crée des armes faites de magie) ; les bâtons magiques restent permis ; le Doc « Guide pour MJ » permet aussi la « Forge de ses morts » et les parchemins.',
  '- *Inconvénient* : **ni armes ni objets** : on ne peut que lancer des sorts, et la Forgemagie (qui crée des armes faites de magie) et la « Forge de ses morts » en sont. Les parchemins restent permis, et les effets passifs restent actifs : accessoires, bâtons magiques, armure et bouclier portés.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- *Inconvénient* : **ni armes ni objets**, sauf la Forgemagie (un sort qui crée des armes faites de magie) ; les bâtons magiques restent permis ; le Doc « Guide pour MJ » permet aussi la « Forge de ses morts » et les parchemins.', '')) = length('- *Inconvénient* : **ni armes ni objets**, sauf la Forgemagie (un sort qui crée des armes faites de magie) ; les bâtons magiques restent permis ; le Doc « Guide pour MJ » permet aussi la « Forge de ses morts » et les parchemins.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-postures : R198 (4), R112', changes());

-- guide/attaquer-et-se-defendre (R198 (1))
UPDATE page SET corps_md = replace(corps_md, 'et la posture défensive les permet sans limite, mais chaque défense y fait baisser la réussite de la suivante : dès la première selon le Doc « Créer sa fiche de personnage », au-delà de deux selon le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}}.',
  'et la posture défensive les permet sans limite, mais au-delà de deux parades ou esquives, chaque défense y fait baisser la réussite de la suivante.')
  WHERE id = 'guide/attaquer-et-se-defendre' AND length(corps_md) - length(replace(corps_md, 'et la posture défensive les permet sans limite, mais chaque défense y fait baisser la réussite de la suivante : dès la première selon le Doc « Créer sa fiche de personnage », au-delà de deux selon le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}}.', '')) = length('et la posture défensive les permet sans limite, mais chaque défense y fait baisser la réussite de la suivante : dès la première selon le Doc « Créer sa fiche de personnage », au-delà de deux selon le {{guide-pour-mj-maverick|Doc « Guide pour MJ »}}.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/attaquer-et-se-defendre : R198 (1)', changes());

-- guide/le-tour-de-jeu (R198 (6))
UPDATE page SET corps_md = replace(corps_md, 'Il déclare sa posture de combat. Elle décide en grande partie',
  'Il prend sa posture de combat, ou change celle qu’il avait : on garde sa posture tant qu’on n’en change pas. Elle décide en grande partie')
  WHERE id = 'guide/le-tour-de-jeu' AND length(corps_md) - length(replace(corps_md, 'Il déclare sa posture de combat. Elle décide en grande partie', '')) = length('Il déclare sa posture de combat. Elle décide en grande partie');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-tour-de-jeu : R198 (6)', changes());

-- guide/resistances-et-faiblesses (R198 (3))
UPDATE page SET corps_md = replace(corps_md, 'La posture **Vigilance** permet de repérer une résistance ou une vulnérabilité d’un ennemi, prise au hasard.',
  'La posture **Vigilance** permet de repérer 1d4 résistances ou vulnérabilités d’un ennemi.')
  WHERE id = 'guide/resistances-et-faiblesses' AND length(corps_md) - length(replace(corps_md, 'La posture **Vigilance** permet de repérer une résistance ou une vulnérabilité d’un ennemi, prise au hasard.', '')) = length('La posture **Vigilance** permet de repérer une résistance ou une vulnérabilité d’un ennemi, prise au hasard.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/resistances-et-faiblesses : R198 (3)', changes());

-- guide/les-degats (R199 (4))
UPDATE page SET corps_md = replace(corps_md, '2. **On lance les dés** de l’arme ou du sort, et l’on ajoute leurs bonus.',
  '2. **On lance les dés** de l’arme ou du sort, et l’on ajoute leurs bonus, ainsi que les bonus fixes de dégâts : viser la tête (+10), la tenaille (+4), le +8 d’un échec critique en défense, le Mode Hyper… Ils comptent avec les dégâts de base.')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, '2. **On lance les dés** de l’arme ou du sort, et l’on ajoute leurs bonus.', '')) = length('2. **On lance les dés** de l’arme ou du sort, et l’on ajoute leurs bonus.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-degats : R199 (4)', changes());

-- guide/les-degats (R199 (4))
UPDATE page SET corps_md = replace(corps_md, 'D’autres règles ajoutent des dégâts à l’attaque :',
  'D’autres règles ajoutent des dégâts à l’attaque. Ils comptent avec les dégâts de base (étape 2) : une réussite critique les double donc aussi.')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, 'D’autres règles ajoutent des dégâts à l’attaque :', '')) = length('D’autres règles ajoutent des dégâts à l’attaque :');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-degats : R199 (4)', changes());

-- guide/attaquer-et-se-defendre (R199 (4))
UPDATE page SET corps_md = replace(corps_md, '- **Réussite critique (1 à 5)** : les dégâts de base sont doublés,',
  '- **Réussite critique (1 à 5)** : les dégâts de l’attaque, bonus compris, sont doublés,')
  WHERE id = 'guide/attaquer-et-se-defendre' AND length(corps_md) - length(replace(corps_md, '- **Réussite critique (1 à 5)** : les dégâts de base sont doublés,', '')) = length('- **Réussite critique (1 à 5)** : les dégâts de base sont doublés,');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/attaquer-et-se-defendre : R199 (4)', changes());

-- guide/attaquer-et-se-defendre (R199 (2))
UPDATE page SET corps_md = replace(corps_md, 'certaines armes en écrivent deux (Lourde / Légère, Arc / Légère) ;',
  'certaines armes en écrivent deux (Lourde / Légère, Arc / Légère) : le joueur choisit alors celle des deux qui sert ;')
  WHERE id = 'guide/attaquer-et-se-defendre' AND length(corps_md) - length(replace(corps_md, 'certaines armes en écrivent deux (Lourde / Légère, Arc / Légère) ;', '')) = length('certaines armes en écrivent deux (Lourde / Légère, Arc / Légère) ;');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/attaquer-et-se-defendre : R199 (2)', changes());

-- guide/attaquer-et-se-defendre (R199 (1))
UPDATE page SET corps_md = replace(corps_md, 'Pour bloquer entièrement le coup, deux conditions : **réussir son jet, et faire un résultat égal ou meilleur que celui de l’attaquant.**' || char(10) || '' || char(10) || '| Résultat de la défense | Ce qui se passe |' || char(10) || '| --- | --- |' || char(10) || '| Réussie, et égale ou meilleure que l’attaque | Le coup est entièrement bloqué. |' || char(10) || '| Réussie, mais moins bonne que l’attaque | **Défense partielle** : les dégâts finaux sont divisés par 2. Si c’est une parade au bouclier, ses AP ou son AM comptent à ce moment-là. |' || char(10) || '| Ratée, même avec un meilleur résultat que l’attaque | La défense échoue : les dégâts sont entiers. |',
  'Pour bloquer entièrement le coup, deux conditions : **réussir son jet, et faire un résultat égal ou inférieur à celui de l’attaquant.** Au D100, un meilleur résultat est un résultat plus bas.' || char(10) || '' || char(10) || '*Exemple : l’attaquant touche avec un résultat de 30. La cible réussit sa parade avec un résultat de 25 : 25 est plus bas que 30, le coup est entièrement bloqué.*' || char(10) || '' || char(10) || '| Résultat de la défense | Ce qui se passe |' || char(10) || '| --- | --- |' || char(10) || '| Réussie, avec un résultat égal ou inférieur à celui de l’attaque | Le coup est entièrement bloqué. |' || char(10) || '| Réussie, mais avec un résultat supérieur à celui de l’attaque | **Défense partielle** : les dégâts finaux sont divisés par 2. Si c’est une parade au bouclier, ses AP ou son AM comptent à ce moment-là. |' || char(10) || '| Ratée, même avec un résultat inférieur à celui de l’attaque | La défense échoue : les dégâts sont entiers. |')
  WHERE id = 'guide/attaquer-et-se-defendre' AND length(corps_md) - length(replace(corps_md, 'Pour bloquer entièrement le coup, deux conditions : **réussir son jet, et faire un résultat égal ou meilleur que celui de l’attaquant.**' || char(10) || '' || char(10) || '| Résultat de la défense | Ce qui se passe |' || char(10) || '| --- | --- |' || char(10) || '| Réussie, et égale ou meilleure que l’attaque | Le coup est entièrement bloqué. |' || char(10) || '| Réussie, mais moins bonne que l’attaque | **Défense partielle** : les dégâts finaux sont divisés par 2. Si c’est une parade au bouclier, ses AP ou son AM comptent à ce moment-là. |' || char(10) || '| Ratée, même avec un meilleur résultat que l’attaque | La défense échoue : les dégâts sont entiers. |', '')) = length('Pour bloquer entièrement le coup, deux conditions : **réussir son jet, et faire un résultat égal ou meilleur que celui de l’attaquant.**' || char(10) || '' || char(10) || '| Résultat de la défense | Ce qui se passe |' || char(10) || '| --- | --- |' || char(10) || '| Réussie, et égale ou meilleure que l’attaque | Le coup est entièrement bloqué. |' || char(10) || '| Réussie, mais moins bonne que l’attaque | **Défense partielle** : les dégâts finaux sont divisés par 2. Si c’est une parade au bouclier, ses AP ou son AM comptent à ce moment-là. |' || char(10) || '| Ratée, même avec un meilleur résultat que l’attaque | La défense échoue : les dégâts sont entiers. |');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/attaquer-et-se-defendre : R199 (1)', changes());

-- guide/deplacement-ou-sortie-de-la-zone-d-influence (R199 (3))
UPDATE page SET corps_md = replace(corps_md, 'Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une attaque gratuite contre lui.',
  'Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une {{attaque-dopportunite|attaque d''opportunité}} contre lui, avec ses limites.')
  WHERE id = 'guide/deplacement-ou-sortie-de-la-zone-d-influence' AND length(corps_md) - length(replace(corps_md, 'Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une attaque gratuite contre lui.', '')) = length('Si un personnage souhaite quitter une zone d''influence, l''adversaire peut effectuer une attaque gratuite contre lui.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/deplacement-ou-sortie-de-la-zone-d-influence : R199 (3)', changes());

-- guide/prise-en-tenaille-et-zone-d-influence (R199 (3))
UPDATE page SET corps_md = replace(corps_md, 'la quitter lui permet une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité (voir {{attaque-dopportunite|Les attaques d''opportunité}}).',
  'la quitter aussi, avec les limites de toute attaque d’opportunité (voir {{attaque-dopportunite|Les attaques d''opportunité}}).')
  WHERE id = 'guide/prise-en-tenaille-et-zone-d-influence' AND length(corps_md) - length(replace(corps_md, 'la quitter lui permet une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité (voir {{attaque-dopportunite|Les attaques d''opportunité}}).', '')) = length('la quitter lui permet une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité (voir {{attaque-dopportunite|Les attaques d''opportunité}}).');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/prise-en-tenaille-et-zone-d-influence : R199 (3)', changes());

-- guide/le-mode-hyper (R200 (2))
UPDATE page SET corps_md = replace(corps_md, 'et sans même consommer de {{chakra|chakra}} ; mais la limite des 10 tours, elle, reste présente ;',
  'et sans même consommer de {{chakra|chakra}} ; mais sa durée, elle, reste limitée par le niveau (voir « Ce qu’il coûte ») ;')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, 'et sans même consommer de {{chakra|chakra}} ; mais la limite des 10 tours, elle, reste présente ;', '')) = length('et sans même consommer de {{chakra|chakra}} ; mais la limite des 10 tours, elle, reste présente ;');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (2)', changes());

-- guide/le-mode-hyper (R200 (3))
UPDATE page SET corps_md = replace(corps_md, '- Le Mode Hyper se nourrit de {{chakra|chakra}} : il en brûle **10 % du maximum à chaque tour**.',
  '- Le Mode Hyper se nourrit de {{chakra|chakra}} : il en brûle **10 % du maximum à chaque tour**, à la fin du tour du joueur.')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, '- Le Mode Hyper se nourrit de {{chakra|chakra}} : il en brûle **10 % du maximum à chaque tour**.', '')) = length('- Le Mode Hyper se nourrit de {{chakra|chakra}} : il en brûle **10 % du maximum à chaque tour**.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (3)', changes());

-- guide/le-mode-hyper (R200 (1))
UPDATE page SET corps_md = replace(corps_md, '- Il dure au plus **le niveau global divisé par 2**, en tours,',
  '- Il dure au plus **le niveau global divisé par 2, arrondi à l’inférieur**, en tours,')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, '- Il dure au plus **le niveau global divisé par 2**, en tours,', '')) = length('- Il dure au plus **le niveau global divisé par 2**, en tours,');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (1)', changes());

-- guide/le-mode-hyper (R200 (1))
UPDATE page SET corps_md = replace(corps_md, 'pendant 4 tours au plus ; ses sorts, eux, ne lui coûtent rien pendant ce temps.*',
  'pendant 4 tours au plus ; ses sorts, eux, ne lui coûtent rien pendant ce temps. Au niveau 9, il durerait aussi 4 tours au plus : 9 ÷ 2 = 4,5, arrondi à 4.*')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, 'pendant 4 tours au plus ; ses sorts, eux, ne lui coûtent rien pendant ce temps.*', '')) = length('pendant 4 tours au plus ; ses sorts, eux, ne lui coûtent rien pendant ce temps.*');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (1)', changes());

-- guide/le-mode-hyper (R200 (3), R186)
UPDATE page SET corps_md = replace(corps_md, 'chaque point qui manque se paie de **3 points de santé**.',
  'chaque point qui manque se paie de **3 points de santé**. Il en va de même des 10 % que le Mode Hyper brûle à la fin du tour : si le {{chakra|chakra}} est épuisé, ce qui manque se paie en santé, 3 points par point de {{chakra|chakra}}, sans toucher la {{barriere|barrière}}.')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, 'chaque point qui manque se paie de **3 points de santé**.', '')) = length('chaque point qui manque se paie de **3 points de santé**.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (3), R186', changes());

-- guide/le-mode-hyper (R200 (5))
UPDATE page SET corps_md = replace(corps_md, '' || char(10) || '' || char(10) || 'Le classeur des magies garde, dans un onglet masqué, une autre liste des effets du Mode Hyper, aux valeurs différentes : cette liste ne compte pas, ce sont les valeurs données plus haut (+15, et +7 avec deux magies) qui valent.' || char(10) || '',
  '' || char(10) || '')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, '' || char(10) || '' || char(10) || 'Le classeur des magies garde, dans un onglet masqué, une autre liste des effets du Mode Hyper, aux valeurs différentes : cette liste ne compte pas, ce sont les valeurs données plus haut (+15, et +7 avec deux magies) qui valent.' || char(10) || '', '')) = length('' || char(10) || '' || char(10) || 'Le classeur des magies garde, dans un onglet masqué, une autre liste des effets du Mode Hyper, aux valeurs différentes : cette liste ne compte pas, ce sont les valeurs données plus haut (+15, et +7 avec deux magies) qui valent.' || char(10) || '');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/le-mode-hyper : R200 (5)', changes());

-- guide/liste-des-effets-mode-super (R200 (1))
UPDATE page SET corps_md = replace(corps_md, 'au maximum un nombre de tours équivalent au niveau global divisé par 2.',
  'au maximum un nombre de tours équivalent au niveau global divisé par 2, arrondi à l''inférieur.')
  WHERE id = 'guide/liste-des-effets-mode-super' AND length(corps_md) - length(replace(corps_md, 'au maximum un nombre de tours équivalent au niveau global divisé par 2.', '')) = length('au maximum un nombre de tours équivalent au niveau global divisé par 2.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/liste-des-effets-mode-super : R200 (1)', changes());

-- guide/finaliser-son-personnage (R201 (2))
UPDATE page SET corps_md = replace(corps_md, 'Elle vaut la moitié du {{chakra|chakra}}, plus les bonus de la race et de la classe.',
  'Elle vaut la moitié du {{chakra|chakra}}, arrondie à l’inférieur, plus les bonus de la race et de la classe.')
  WHERE id = 'guide/finaliser-son-personnage' AND length(corps_md) - length(replace(corps_md, 'Elle vaut la moitié du {{chakra|chakra}}, plus les bonus de la race et de la classe.', '')) = length('Elle vaut la moitié du {{chakra|chakra}}, plus les bonus de la race et de la classe.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/finaliser-son-personnage : R201 (2)', changes());

-- guide/les-degats (R201 (2))
UPDATE page SET corps_md = replace(corps_md, 'qui vaut la moitié du {{chakra|chakra}} total (plus ce qu’offrent certaines races et classes)',
  'qui vaut la moitié du {{chakra|chakra}} total, arrondie à l’inférieur (plus ce qu’offrent certaines races et classes)')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, 'qui vaut la moitié du {{chakra|chakra}} total (plus ce qu’offrent certaines races et classes)', '')) = length('qui vaut la moitié du {{chakra|chakra}} total (plus ce qu’offrent certaines races et classes)');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/les-degats : R201 (2)', changes());

-- guide/finaliser-son-personnage (R202 (6))
UPDATE page SET corps_md = replace(corps_md, 'À la création, lancez 1D20 : le résultat est votre or de départ.',
  'À la création, lancez 1D20 : le résultat est votre or de départ, en Ricken d’or (RO).')
  WHERE id = 'guide/finaliser-son-personnage' AND length(corps_md) - length(replace(corps_md, 'À la création, lancez 1D20 : le résultat est votre or de départ.', '')) = length('À la création, lancez 1D20 : le résultat est votre or de départ.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/finaliser-son-personnage : R202 (6)', changes());

-- guide/la-montee-de-niveau (R202 (8))
UPDATE page SET corps_md = replace(corps_md, 'et dit ce que le personnage a à répartir.' || char(10) || '',
  'et dit ce que le personnage a à répartir. L’expérience que rapporte une aventure n’a pas de valeur prédéfinie : c’est le MJ qui la décide.' || char(10) || '')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, 'et dit ce que le personnage a à répartir.' || char(10) || '', '')) = length('et dit ce que le personnage a à répartir.' || char(10) || '');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : R202 (8)', changes());

-- guide/reussites-echecs-et-critiques (R203)
UPDATE page SET corps_md = replace(corps_md, 'Mais **la réussite critique ne dépasse jamais 1 à 15, toutes sources ensemble** (posture, score, dons, sorts, armes, accessoires, tenaille).',
  'Mais **la réussite critique ne dépasse jamais 1 à 15, toutes sources ensemble** (posture, score, dons, sorts, armes, accessoires, tenaille). À l’autre bout, elle **ne descend jamais sous 1 à 1**, même quand des accessoires maudits la réduisent.')
  WHERE id = 'guide/reussites-echecs-et-critiques' AND length(corps_md) - length(replace(corps_md, 'Mais **la réussite critique ne dépasse jamais 1 à 15, toutes sources ensemble** (posture, score, dons, sorts, armes, accessoires, tenaille).', '')) = length('Mais **la réussite critique ne dépasse jamais 1 à 15, toutes sources ensemble** (posture, score, dons, sorts, armes, accessoires, tenaille).');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/reussites-echecs-et-critiques : R203', changes());

-- guide/fiche-competences (R204)
UPDATE page SET corps_md = replace(corps_md, '*Prouesse (Volonté) :*',
  '*Calme (Volonté) :*')
  WHERE id = 'guide/fiche-competences' AND length(corps_md) - length(replace(corps_md, '*Prouesse (Volonté) :*', '')) = length('*Prouesse (Volonté) :*');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/fiche-competences : R204', changes());

-- magies/magie-de-la-glace (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Résistance altération d''état** : Gelé, Poison, Saignement',
  '- **Résistance altération d''état** : Gel, Poison, Saignement')
  WHERE id = 'magies/magie-de-la-glace' AND length(corps_md) - length(replace(corps_md, '- **Résistance altération d''état** : Gelé, Poison, Saignement', '')) = length('- **Résistance altération d''état** : Gelé, Poison, Saignement');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page magies/magie-de-la-glace : R205 (3)', changes());

-- magies/magie-de-la-necromancie (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Vulnérabilité altération d''état** : Gelé, Confusion',
  '- **Vulnérabilité altération d''état** : Gel, Confusion')
  WHERE id = 'magies/magie-de-la-necromancie' AND length(corps_md) - length(replace(corps_md, '- **Vulnérabilité altération d''état** : Gelé, Confusion', '')) = length('- **Vulnérabilité altération d''état** : Gelé, Confusion');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page magies/magie-de-la-necromancie : R205 (3)', changes());

-- magies/magie-du-feu (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Résistance altération d''état** : Brûlure, Gelé, Pétrification',
  '- **Résistance altération d''état** : Brûlure, Gel, Pétrification')
  WHERE id = 'magies/magie-du-feu' AND length(corps_md) - length(replace(corps_md, '- **Résistance altération d''état** : Brûlure, Gelé, Pétrification', '')) = length('- **Résistance altération d''état** : Brûlure, Gelé, Pétrification');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page magies/magie-du-feu : R205 (3)', changes());

-- magies/magie-du-sang (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '- **Vulnérabilité altération d''état** : Gelé, Poison',
  '- **Vulnérabilité altération d''état** : Gel, Poison')
  WHERE id = 'magies/magie-du-sang' AND length(corps_md) - length(replace(corps_md, '- **Vulnérabilité altération d''état** : Gelé, Poison', '')) = length('- **Vulnérabilité altération d''état** : Gelé, Poison');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page magies/magie-du-sang : R205 (3)', changes());

-- magies/magie-du-vent (R205 (3))
UPDATE page SET corps_md = replace(corps_md, 'altération d''état** : Surdité, Brûlure, Gelé',
  'altération d''état** : Surdité, Brûlure, Gel')
  WHERE id = 'magies/magie-du-vent' AND length(corps_md) - length(replace(corps_md, 'altération d''état** : Surdité, Brûlure, Gelé', '')) = length('altération d''état** : Surdité, Brûlure, Gelé');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page magies/magie-du-vent : R205 (3)', changes());

-- ressources/accessoires (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '| Résistance Glace et Gelé |',
  '| Résistance Glace et Gel |')
  WHERE id = 'ressources/accessoires' AND length(corps_md) - length(replace(corps_md, '| Résistance Glace et Gelé |', '')) = length('| Résistance Glace et Gelé |');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page ressources/accessoires : R205 (3)', changes());

-- ressources/maladie (R205 (3))
UPDATE page SET corps_md = replace(corps_md, '**Effets** : -20% de chance de résister à Gelé.',
  '**Effets** : -20% de chance de résister à Gel.')
  WHERE id = 'ressources/maladie' AND length(corps_md) - length(replace(corps_md, '**Effets** : -20% de chance de résister à Gelé.', '')) = length('**Effets** : -20% de chance de résister à Gelé.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page ressources/maladie : R205 (3)', changes());

-- guide/equipement-et-butin (R207 (8))
UPDATE page SET corps_md = replace(corps_md, 'Le butin se joue sur le résultat de **3D100** : plus le score est bas, plus la découverte est fabuleuse.',
  'Le butin se joue sur le résultat de **3D100**, les trois dés additionnés : plus le total est bas, plus la découverte est fabuleuse.')
  WHERE id = 'guide/equipement-et-butin' AND length(corps_md) - length(replace(corps_md, 'Le butin se joue sur le résultat de **3D100** : plus le score est bas, plus la découverte est fabuleuse.', '')) = length('Le butin se joue sur le résultat de **3D100** : plus le score est bas, plus la découverte est fabuleuse.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/equipement-et-butin : R207 (8)', changes());

-- guide/equipement-et-butin (R207 (9))
UPDATE page SET corps_md = replace(corps_md, 'travailleur du cuir ou {{couturier|couturier}}',
  '{{maroquinier|maroquinier}} ou {{couturier|couturier}}')
  WHERE id = 'guide/equipement-et-butin' AND length(corps_md) - length(replace(corps_md, 'travailleur du cuir ou {{couturier|couturier}}', '')) = length('travailleur du cuir ou {{couturier|couturier}}');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/equipement-et-butin : R207 (9)', changes());

-- guide/exercer-un-metier (R208 (6))
UPDATE page SET corps_md = replace(corps_md, '- **un avantage sur un jet**, quand le métier s’applique à la situation.',
  '- **un avantage sur un jet**, quand le métier s’applique à la situation : c’est le MJ qui le décide.')
  WHERE id = 'guide/exercer-un-metier' AND length(corps_md) - length(replace(corps_md, '- **un avantage sur un jet**, quand le métier s’applique à la situation.', '')) = length('- **un avantage sur un jet**, quand le métier s’applique à la situation.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('page guide/exercer-un-metier : R208 (6)', changes());

-- mot_cle.description

-- zone-dinfluence (R199 (3))
UPDATE mot_cle SET description = replace(description, 'Y entrer puis la traverser lui permet une attaque d’opportunité ; la quitter, une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité.',
  'Y entrer puis la traverser, ou la quitter, lui permet une {{attaque-dopportunite|attaque d’opportunité}}, avec ses limites.')
  WHERE id = 'zone-dinfluence' AND length(description) - length(replace(description, 'Y entrer puis la traverser lui permet une attaque d’opportunité ; la quitter, une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité.', '')) = length('Y entrer puis la traverser lui permet une attaque d’opportunité ; la quitter, une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('mot_cle zone-dinfluence : R199 (3)', changes());

-- attaque-gratuite (R199 (3))
UPDATE mot_cle SET description = replace(description, 'L’attaque que permet un adversaire qui quitte votre zone d’influence. Le Doc « Guide pour MJ » range aussi ce cas parmi les attaques d’opportunité (voir {{attaque-dopportunite|Attaque d’opportunité}} et {{zone-dinfluence|Zone d’influence}}).',
  'L’attaque que permet un adversaire qui quitte votre {{zone-dinfluence|zone d’influence}} : c’est une {{attaque-dopportunite|attaque d’opportunité}}, avec ses limites.')
  WHERE id = 'attaque-gratuite' AND length(description) - length(replace(description, 'L’attaque que permet un adversaire qui quitte votre zone d’influence. Le Doc « Guide pour MJ » range aussi ce cas parmi les attaques d’opportunité (voir {{attaque-dopportunite|Attaque d’opportunité}} et {{zone-dinfluence|Zone d’influence}}).', '')) = length('L’attaque que permet un adversaire qui quitte votre zone d’influence. Le Doc « Guide pour MJ » range aussi ce cas parmi les attaques d’opportunité (voir {{attaque-dopportunite|Attaque d’opportunité}} et {{zone-dinfluence|Zone d’influence}}).');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('mot_cle attaque-gratuite : R199 (3)', changes());

-- barriere (R201)
UPDATE mot_cle SET description = replace(description, 'elle vaut la moitié du {{chakra|chakra}} total, plus les bonus de la race et de la classe.',
  'elle vaut la moitié du {{chakra|chakra}} total, arrondie à l’inférieur, plus les bonus de la race et de la classe. Sauf indication contraire, elle prend les coups avant la santé.')
  WHERE id = 'barriere' AND length(description) - length(replace(description, 'elle vaut la moitié du {{chakra|chakra}} total, plus les bonus de la race et de la classe.', '')) = length('elle vaut la moitié du {{chakra|chakra}} total, plus les bonus de la race et de la classe.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('mot_cle barriere : R201', changes());

-- barriere (R201 (1))
UPDATE mot_cle SET description = replace(description, ' Le Glossaire du Codex précise qu’elle prend les coups avant la santé, sauf contre-indication.',
  '')
  WHERE id = 'barriere' AND length(description) - length(replace(description, ' Le Glossaire du Codex précise qu’elle prend les coups avant la santé, sauf contre-indication.', '')) = length(' Le Glossaire du Codex précise qu’elle prend les coups avant la santé, sauf contre-indication.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('mot_cle barriere : R201 (1)', changes());

-- classe-magique (R202 (3))
UPDATE mot_cle SET description = replace(description, 'La seconde spécialité de chaque classe raciale, et celle du Flagelleur, donne elle aussi 4 AM.',
  'La seconde spécialité de chaque classe raciale, et celle du Flagelleur, compte elle aussi comme classe magique : elle donne 4 AM et compte comme une condition pour les emplacements de sorts.')
  WHERE id = 'classe-magique' AND length(description) - length(replace(description, 'La seconde spécialité de chaque classe raciale, et celle du Flagelleur, donne elle aussi 4 AM.', '')) = length('La seconde spécialité de chaque classe raciale, et celle du Flagelleur, donne elle aussi 4 AM.');
INSERT INTO garde_0104 (quoi, lignes) VALUES ('mot_cle classe-magique : R202 (3)', changes());

-- nouveaux mots-clés (R207) : un métier, comme forgeron et couturier (adresse lib/metiers.mjs#cheminDePage)
INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, couleur, url) VALUES ('maroquinier', 'Maroquinier', 'maroquinier', NULL, NULL, NULL, '/metiers/#metier-maroquinier');
INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, couleur, url) VALUES ('armurier', 'Armurier', 'armurier', NULL, NULL, NULL, '/metiers/#metier-armurier');

-- plus aucune balise ni étiquette du mot-clé attaque-gratuite n'existait : il reste, pour la définition qui renvoie à l'attaque d'opportunité
INSERT INTO garde_0104 (quoi, lignes, attendu) SELECT 'page : plus aucune « attaque gratuite » dans un texte du guide', count(*), 0 FROM page WHERE id LIKE 'guide/%' AND corps_md LIKE '%attaque gratuite%';

DROP TABLE garde_0104;

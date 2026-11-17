-- 0090-lexique-en-mots-cles : le Lexique du guide devient des mots-clés du glossaire, « CR » rejoint « Corruption », et la page « Lexique » est retirée.
-- Demande du propriétaire (2026-11-05) : « Supprime la page lexique. Toutes les informations comprises dedans doivent être converties en mot-clés. En
-- cas de doublon de de mot, compare et fusionne les deux descriptions si cohérentes. Il faudra ajuster la base de donnée et la table liée pour ajouter
-- la colonne "abréviation". Il faudra aussi ajuster les balises {{}} pour qu'elle puissent reconnaitre aussi bien l'abréviation que le mot complet. »
-- Ses réponses du même jour : CR et Corruption, « Fusionner dans Corruption » ; la page citée à la fin d'une définition, « Retirer la référence » ; puis
-- les questions Q-A à Q-J de la conversion et E1 à E5 sur les dés : décision R183 (docs/decisions-regles.md), textes de la liste de game-design.
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. mot_cle.abreviation (ADD COLUMN nullable, en dernier) : l'abréviation telle que l'entrée l'écrit, une par mot-clé, NULL sinon. Qu'elle soit sans
--      ambiguïté pour la ref d'une balise (normalize(abreviation) n'est ni un id, ni un libelle_cle, ni l'abréviation d'un autre mot-clé ; l'id de son
--      propre mot-clé est permis : « RF » de `rf`) passe par normalize() (lib/text.mjs), qu'un CHECK ne lit pas : client/scripts/db-check.mjs le
--      contrôle. La vue v_mot_cle la donne (refaite, en dernier).
--   2. Une entrée du Lexique = un mot-clé : libellé = le mot de l'entrée (majuscule initiale), id = normalize(libellé) ; une entrée qui donne son
--      abréviation (« **AM** (armure magique) », « **Initiative** (INI) ») prend le mot complet en libellé et l'abréviation telle qu'écrite ;
--      « **RC** : voir *Réussite critique* » n'est que l'abréviation de « Réussite critique » (pas de mot-clé). Un renvoi vers un synonyme
--      (« Action rapide », « Battlemap », « Faiblesse », « Vulnérabilité »), le second terme d'une entrée double (« Sang », « Dieu choisi »,
--      « Personnage non joueur ») et le complément d'un en-tête (R183 (6) : « Action bonus », « Prise en tenaille », « Scénario one shot ») sont des
--      mots-clés dont la définition est le renvoi, balisé (« Voir {{carte-de-combat|Carte de combat}}. ») ; pas de mot-clé « race hybride » (R183 (5),
--      Q-B) : c'est l'étiquette que le site crée pour ranger une race hybride (lib/race-kinds.mjs#TAG_RACE_HYBRIDE). Définition = celle de l'entrée,
--      en texte de case (lib/mots-cles-balises.mjs) : gras et italique retirés, la page citée entre parenthèses retirée
--      (« ([[guide/le-tour-de-jeu|Le tour de jeu]]) »), un lien dans la phrase gardé en son texte affiché (« Le [[Glossaire]] du Codex précise »), les
--      balises déjà écrites gardées, les renvois « voir *X* » vers une autre entrée balisés (même texte affiché), et la majuscule au premier mot,
--      rien d'autre (R183 (8), Q-F). Selon R183 :
--      - « Race pure, race hybride » et « Résistance, faiblesse (ou vulnérabilité) » ouvrent leur définition par l'en-tête de l'entrée (5, Q-A) ;
--      - « PJ, PNJ » : `personnage-joueur` (« Personnage joueur », PJ) et le renvoi `personnage-non-joueur` (« Personnage non joueur », PNJ) (7, Q-D) ;
--      - « Monnaies » : un mot-clé par monnaie, à l'id de la table `monnaie` (`rf`, `ro`, `pp`), sans mot-clé « Monnaies » (9, Q-H) ;
--      - « D100, D20, d6… » : `des` (« Dés »), le texte du propriétaire, sans note (Q-L : « Non, sans note »), puis l'exemple du Lexique
--        (10, E1, E2, E5).
--   3. Une entrée qui doublait un mot-clé (« {{barriere:}} », « {{chakra:}} »… dans le Lexique, ou même libelle_cle : « Classe », « Métier ») : l'id
--      reste ; la définition existante, puis ce que le Lexique ajoute (une définition NULL prend celle du Lexique ; « Voir [[page]]. »,
--      tout ce que le Lexique écrivait de « Corruption », « CR » et « Mordhau », n'ajoute rien). Les libellés `classe` et `metier` prennent leur
--      majuscule, « Classe » et « Métier » (R183 (8), Q-G ; libelle_cle inchangé). Solidité : « La solidité compte les mauvais coups… » (R183 (4), Q-I).
--   4. « CR » fusionné dans « Corruption » : la définition de `corruption`, puis celle de `cr`, dont la première phrase devient « CR, dans les tableaux
--      de sorts, désigne la corruption. » (R183 (3), Q-I) ; « CR » devient l'abréviation de `corruption`. Les
--      balises qui citaient `cr` le citent (comme lib/mots-cles-balises.mjs#reciblerLeMotCle, le texte affiché gardé : « {{cr|CR}} » →
--      « {{corruption|CR}} », « {{cr}} » d'un texte mis en forme, qui montrait « CR », → « {{corruption|CR}} ») : 43 balises, dans 3 pages, 19 effets
--      de sort et 1 D/S/B ; les étiquettes (page_tag, sort_mot_cle) le suivraient, sans doublon (aucune aujourd'hui) ; puis `cr` est retiré du
--      vocabulaire (un id n'est jamais réutilisé).
--   5. La page « Lexique » (guide/lexique, famille docs) est supprimée avec ses lignes d'import (page_source), les sources qu'elle seule citait et ses
--      liens (table dérivée, refaite par db:build), retirés d'abord : une migration s'applique clés étrangères coupées (tools/db/maverick.py#migrer),
--      sans cascade. Aucune autre ligne ne la cite (ni alias, ni mot-clé de page, ni lien vers elle). Les lignes de historique_modification qui la
--      citent restent : c'est l'historique.
--   6. Le « 1d30 » de l'accessoire « Jet de dé » n° 5 devient « 1d100 » (R183 (10) : 30 n'est pas un nombre de faces de la liste ; réponses du
--      propriétaire : « À corriger », puis « 1d100 ») : accessoire_effet.libelle et sa copie dans la ligne du tableau de la page ressources/accessoires.

-- 1. L'abréviation
ALTER TABLE mot_cle ADD COLUMN abreviation TEXT CHECK (abreviation IS NULL OR length(abreviation) > 0);

DROP VIEW v_mot_cle;
CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.libelle_cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description,                                                         -- la définition du glossaire (migration 0056 ; NULL : pas encore décrit)
    m.abreviation                                                          -- l'abréviation (migration 0090 ; NULL : aucune)
  FROM mot_cle m;

-- 2. Les mots-clés nouveaux (entrées du Lexique et renvois), dans l’ordre du Lexique
INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation) VALUES
  ('acquis', 'Acquis', 'acquis',
   'Les points d’une compétence qui ne se répartissent pas, mais se gagnent : par l’entraînement, les dons de la race, de l’ethnie et de la classe, l’armure portée, le métier et les accessoires, et la fiche de personnage du site les additionne. En règle générale, ils ne dépassent pas 5 par point de la caractéristique, le +1 de la magie innée compris.', NULL),
  ('action', 'Action', 'action',
   'L’action principale du tour, qui sert à attaquer, à lancer un sort, à utiliser un objet, à sprinter, à utiliser un don de type Action ou à faire une quatrième action rapide.', NULL),
  ('action-rapide', 'Action rapide', 'action-rapide',
   'Voir {{instant-cast|IC}}.', NULL),
  ('alignement', 'Alignement', 'alignement',
   'La morale du personnage. Il évolue au fil de l’aventure, selon ses actes, ses décisions et ses paroles, et le MJ en tient les quatre scores : Loyal, Chaotique, Bon et Mauvais.', NULL),
  ('alteration-detat', 'Altération d’état', 'alteration-detat',
   'Un changement de la condition d’un personnage (poison, brûlure, peur, paralysie…) qui lui inflige des malus, souvent pendant plusieurs tours. Il en existe vingt, physiques ou mentales, et la plupart ont trois stades, de plus en plus forts.', NULL),
  ('armure-magique', 'Armure magique', 'armure-magique',
   'Les points que l’armure retire aux dégâts des sorts. L’AM vient de la race, de l’ethnie, des classes magiques (4 chacune : voir {{classe-magique|Classe magique}}), des accessoires et de l’armure portée.', 'AM'),
  ('ame', 'Âme', 'ame',
   'La quatrième barre des utilisateurs de la Nécromancie (les âmes) et de la magie du Sang (le Sang). C’est une réserve de 10 points, qui se recharge de 1 par tour en combat et que demandent certains de leurs sorts.', NULL),
  ('sang', 'Sang', 'sang',
   'Voir {{ame|Âme}}.', NULL),
  ('amelioration', 'Amélioration', 'amelioration',
   'Le niveau d’une arme (de +1 à +10), d’une armure ou d’un bouclier (de +1 à +5). Le niveau choisi donne le bonus qu’il écrit, qui est déjà le total : +10 aux dégâts pour une arme +5, +10 AP et +10 AM pour une armure +5, +10 AP pour un bouclier +5. On paie toutes les étapes, une à une, sans en sauter aucune. Les crans de {{solidite|solidité}} : pour une arme, +1 du +5 au +9 et +2 au +10 ; pour une armure, +1 au +4 comme au +5 ; pour un bouclier, les crans s’additionnent, +1 du +1 au +4 et +2 au +5.', NULL),
  ('armure-physique', 'Armure physique', 'armure-physique',
   'Les points que l’armure retire aux dégâts des armes. Contre un coup d’estoc, de taille ou de frappe, l’armure portée les compte double ou moitié, selon qu’elle y résiste ou y est faible.', 'AP'),
  ('artisanat', 'Artisanat', 'artisanat',
   'Fabriquer des objets, ce que seuls certains métiers permettent : il faut le bon métier. La compétence d’artisanat vaut 10 × la première caractéristique du métier + 10 × la seconde.', NULL),
  ('attaque-dopportunite', 'Attaque d’opportunité', 'attaque-dopportunite',
   'Une attaque offerte hors de son tour, quand un adversaire rate son attaque contre vous sur un échec critique, quand il sort de votre zone d’influence (sauf si c’est vous qui l’en faites sortir), ou quand un don le permet. Une seule par tour et par joueur, sauf don qui en permet plus, et seulement une action simple.', NULL),
  ('attaque-discrete', 'Attaque discrète', 'attaque-discrete',
   'Frapper une cible qui ne vous voit pas venir, pour un dé de dégâts en plus. À ne pas confondre avec l’attaque sournoise, qui vient d’une classe.', NULL),
  ('attaque-gratuite', 'Attaque gratuite', 'attaque-gratuite',
   'L’attaque que permet un adversaire qui quitte votre zone d’influence. Le Doc « Guide pour MJ » range aussi ce cas parmi les attaques d’opportunité (voir {{attaque-dopportunite|Attaque d’opportunité}} et {{zone-dinfluence|Zone d’influence}}).', NULL),
  ('attributs', 'Attributs', 'attributs',
   'Les valeurs de base du personnage (santé, {{chakra|chakra}}, {{barriere|barrière}}, {{corruption|corruption}}, vitesse, initiative, armure de base), et la quatrième barre pour la Nécromancie et la magie du Sang.', NULL),
  ('battlemap', 'Battlemap', 'battlemap',
   'Voir {{carte-de-combat|Carte de combat}}.', NULL),
  ('biclassage', 'Biclassage', 'biclassage',
   'Avoir deux classes. On peut commencer avec deux classes, chacune au niveau 1 et gagnant 1 niveau par niveau global ; avec une seule, qui commence au niveau 2 et en gagne 2 par niveau global jusqu’au niveau 20, qu’elle atteint au niveau global 10, une seconde classe est prise automatiquement au niveau global 11 et reçoit la suite. Au niveau global 20, tout personnage a donc deux classes au niveau 20.', NULL),
  ('boss', 'Boss', 'boss',
   'Un ennemi pensé pour affronter une équipe de quatre joueurs. Il a deux initiatives par tour, et plus de parades et d’esquives que les autres dans certaines postures.', NULL),
  ('bouclier', 'Bouclier', 'bouclier',
   'Une forme, sa classe de 1 à 5 (Bocle, Targe, Bouclier Rond, Écu, Pavois), et une matière, qui donne sa solidité. Ses AP et son AM ne comptent que sur une parade partielle faite avec lui, et son poids demande une Force minimum.', NULL),
  ('campagne', 'Campagne', 'campagne',
   'Une aventure en plusieurs séances, qui part d’un point A pour arriver à un point B ; les joueurs y font partie de l’écriture de l’histoire. Voir aussi {{one-shot|One shot}}.', NULL),
  ('caracteristiques', 'Caractéristiques', 'caracteristiques',
   'Les six valeurs de base du personnage, Force, Volonté, Intelligence, Perception, Social et Agilité, de 1 à 4 en règle générale (5 avec le +1 de la magie innée). Chacune compte dix fois dans le score de ses cinq compétences.', NULL),
  ('carte-de-combat', 'Carte de combat', 'carte-de-combat',
   'Une carte quadrillée vue de haut, où le MJ dessine les obstacles d’un combat et où l’on compte les distances en cases. Il peut s’en passer pour un combat rapide.', NULL),
  ('ceinture', 'Ceinture', 'ceinture',
   'Trois emplacements pour des objets à portée de main (fioles, carquois, bâtons magiques…), qui s’utilisent en une action rapide au lieu d’une action entière ; au plus 3 exemplaires du même objet dans chacun.', NULL),
  ('classe-magique', 'Classe magique', 'classe-magique',
   'Une classe de la catégorie des classes magiques ; l’Archimage, rangée dans les classes spéciales, en est une aussi. Elle donne 4 AM et compte comme une condition pour les emplacements de sorts. La seconde spécialité de chaque classe raciale, et celle du Flagelleur, donne elle aussi 4 AM.', NULL),
  ('classe-raciale', 'Classe raciale', 'classe-raciale',
   'La classe propre à une race hybride, qui porte son nom. Le Drassah’thac, hybride, n’en a pas.', NULL),
  ('coma', 'Coma', 'coma',
   'L’état d’un personnage dont la santé tombe à 0 ou moins. Inconscient, il fait des jets de Survie : un seul réussi le stabilise, trois ratés et il meurt.', NULL),
  ('competence', 'Compétence', 'competence',
   'Un savoir-faire lié à une caractéristique (Diplomatie, Esquive, Magie…), avec son score. Il y en a trente, cinq par caractéristique.', NULL),
  ('cout-secondaire', 'Coût secondaire', 'cout-secondaire',
   'Ce qu’un sort coûte en plus de son {{chakra|chakra}} (des âmes pour la Nécromancie, du Sang pour la magie du Sang, ou autre chose encore, comme une part de la santé).', NULL),
  ('creature-invoquee', 'Créature invoquée', 'creature-invoquee',
   'Une créature appelée par un sort. Ce sont les morts de l’Animation de mort (Nécromancie), les golems de l’Appel aux Golems (Terre), les marionnettes de la Marionnette de l’ombre (Ombre). Elle n’a pas d’échelle de puissance : son rang est un NPM.', NULL),
  ('croix', 'Croix', 'croix',
   'Une marque sous une caractéristique, laissée par une blessure grave, un traumatisme, une maladie, une mauvaise nuit ou certaines altérations d’état. Une croix retire 20 % à tous les jets de la caractéristique ; deux la rendent inutilisable, elle et ses compétences.', NULL),
  ('des', 'Dés', 'des',
   'La formule exacte est XDY+Z. X = Nombre de dés à lancer. Y = Nombre de faces du (des) dé(s). Il peut valoir 2 4 6 8 10 12 20 ou 100. Z = Bonus ou Malus à ajouter au résultat du dé. Le nombre écrit devant dit combien de dés lancer, et ce qui suit le « + » s’ajoute : « 2d6+2 », ce sont deux dés à six faces, additionnés, plus 2.', NULL),
  ('defense-partielle', 'Défense partielle', 'defense-partielle',
   'Une parade ou une esquive réussie, mais moins bonne que l’attaque. Les dégâts sont divisés par 2. Si c’est une parade partielle faite au bouclier, ses AP et son AM comptent : c’est le seul cas où ils comptent.', NULL),
  ('degats', 'Dégâts', 'degats',
   'Ce que perd la cible d’un coup réussi, en santé ou en {{barriere|barrière}}, une fois retirée son armure.', NULL),
  ('dieu-inne', 'Dieu inné', 'dieu-inne',
   'Le dieu inné est la divinité de la magie innée du personnage (l’Espace/Temps en a deux) ; le dieu choisi, facultatif, est celui qu’il décide de prier (le Glossaire du Codex le nomme dieu acquis).', NULL),
  ('dieu-choisi', 'Dieu choisi', 'dieu-choisi',
   'Voir {{dieu-inne|Dieu inné}}.', NULL),
  ('don', 'Don', 'don',
   'Une capacité particulière, donnée par la race, par la classe ou par les événements de l’aventure. Un don est passif (toujours effectif), actif (à déclarer pour que son effet fonctionne), d’action (il prend l’action du tour) ou de réaction (il se joue en dehors de son tour).', NULL),
  ('don-de-base', 'Don de base', 'don-de-base',
   'Le don que donne la race, Méditation (pour récupérer du {{chakra|chakra}}) ou Repos (pour récupérer de la santé et du {{chakra|chakra}}) ; une action, trois fois par jour.', NULL),
  ('echec-critique', 'Échec critique', 'echec-critique',
   'Un résultat de 96 à 100 au D100. L’action rate complètement, et cela coûte quelque chose : un sort au double de son coût, une défense où l’armure ne compte plus…', NULL),
  ('embuscade', 'Embuscade', 'embuscade',
   'Consommer l’action de son tour pour attendre un ennemi, et lui porter une attaque d’opportunité dès qu’il entre dans la zone voulue. La posture de vigilance la déjoue.', NULL),
  ('emplacement-de-sort', 'Emplacement de sort', 'emplacement-de-sort',
   'La place d’un sort sur la fiche. Chaque condition remplie (une magie innée, une magie acquise, une classe magique, une seconde classe magique) en donne autant que la puissance magique.', NULL),
  ('entrainement', 'Entraînement', 'entrainement',
   'Un jet de D100 qui fait gagner des points d’acquis dans une compétence, auprès d’un entraîneur ou d’un PNJ important. Il ne fait progresser que 15 compétences au plus, et chacune de 10 % au plus.', NULL),
  ('echelle-de-puissance', 'Échelle de puissance', 'echelle-de-puissance',
   'La classification indicative de la puissance d’un monstre, que donne sa carte du bestiaire. Les créatures invoquées n’en ont pas.', 'EP'),
  ('esquive', 'Esquive', 'esquive',
   'Éviter un coup, avec la compétence Esquive (Agilité). Voir aussi {{parade|Parade}} et {{defense-partielle|Défense partielle}}.', NULL),
  ('ethnie', 'Ethnie', 'ethnie',
   'Une variante d’une race, comme le Felfe Forestier ou l’Orios de Sang, qui peut avoir ses propres dons et bonus.', NULL),
  ('faiblesse', 'Faiblesse', 'faiblesse',
   'Voir {{resistance|Résistance}}.', NULL),
  ('instant-cast', 'Instant Cast', 'instant-cast',
   'Une action qui ne prend pas l’action du tour. Trois au plus par tour, jamais deux fois la même, toujours avant l’action ; un sort IC ne consomme pas le tour, sauf sur un échec critique.', 'IC'),
  ('action-bonus', 'Action bonus', 'action-bonus',
   'Voir {{instant-cast|IC}}.', NULL),
  ('initiative', 'Initiative', 'initiative',
   'Ce qui fixe l’ordre de jeu en combat. À chaque tour, chacun lance 1D20 et ajoute un bonus qui dépend de son Agilité ; on joue du plus haut résultat au plus bas.', 'INI'),
  ('intervention', 'Intervention', 'intervention',
   'En posture défensive, parer ou esquiver un coup à la place d’un allié adjacent.', NULL),
  ('magie-acquise', 'Magie acquise', 'magie-acquise',
   'Une seconde magie, facultative. Toutes les magies ne se mélangent pas, et avec deux magies, les sorts de niveau 5 restent fermés.', NULL),
  ('magie-innee', 'Magie innée', 'magie-innee',
   'La magie de naissance, héritée de l’un des parents, sauf si un dieu intervient ; tout le monde en a une. Elle donne +1 dans une caractéristique et relie le personnage à son dieu inné.', NULL),
  ('maitrise-darme', 'Maîtrise d’arme', 'maitrise-darme',
   'Le savoir-faire avec une catégorie d’arme. Sans maîtrise, l’arme lance 1 dé de dégâts ; chaque point de maîtrise en ajoute un, jusqu’à 4 points au plus par catégorie, donc 5 dés. Les points de toutes les sources s’additionnent, jusqu’à ce plafond ; au-delà, la fiche le signale, et les points en trop ne donnent pas de dé.', NULL),
  ('maitre-du-jeu', 'Maître du jeu', 'maitre-du-jeu',
   'Celui qui raconte l’histoire, joue les PNJ et les monstres, et juge de ce qui est possible, improbable ou impossible.', 'MJ'),
  ('mode-hyper', 'Mode Hyper', 'mode-hyper',
   'L’état de surpuissance qui s’ouvre au niveau 2 : pour quelques tours, une fois par semaine, la magie du personnage ne fait plus qu’un avec lui. Le Mode Hyper 100 %, plus puissant encore, s’ouvre au niveau 10.', NULL),
  ('mode-super', 'Mode Super', 'mode-super',
   'Un équivalent moins puissant du Mode Hyper : une symbiose avec un objet légendaire ou enchanté.', NULL),
  ('rf', 'Ricken de fer', 'ricken-de-fer',
   'Monnaies : le Ricken de fer (RF), le Ricken d’or (RO) et la Pierre précieuse (PP). 1 RO = 100 RF.', 'RF'),
  ('ro', 'Ricken d’or', 'ricken-dor',
   'Monnaies : le Ricken de fer (RF), le Ricken d’or (RO) et la Pierre précieuse (PP). 1 RO = 100 RF, et 1 PP = 1 000 RO.', 'RO'),
  ('pp', 'Pierre précieuse', 'pierre-precieuse',
   'Monnaies : le Ricken de fer (RF), le Ricken d’or (RO) et la Pierre précieuse (PP). 1 PP = 1 000 RO.', 'PP'),
  ('naturel', 'Naturel', 'naturel',
   'Les points de compétence que l’on répartit soi-même, à la création (100 points, 20 au plus dans une compétence) puis à chaque niveau.', 'Nat.'),
  ('negatif-maximal', 'Négatif maximal', 'negatif-maximal',
   'L’opposé de la santé maximum (−30 pour 30 de santé). Un personnage dans le coma qui y descend n’a droit qu’à un seul jet de survie, et à deux fois ce négatif, il meurt sur le coup.', NULL),
  ('niveau-de-classe', 'Niveau de classe', 'niveau-de-classe',
   'Le niveau propre à chaque classe, qui suit le niveau global. La classe donne ses dons à ses niveaux 1, 5, 10, 15 et 20, et sa spécialité à son niveau 10.', NULL),
  ('niveau-global', 'Niveau global', 'niveau-global',
   'Le niveau du personnage, de 1 à 20, que fixe son total d’expérience. Il règle le niveau de ses classes et sa puissance magique.', NULL),
  ('niveau-de-maitrise', 'Niveau de maîtrise', 'niveau-de-maitrise',
   'Ce qui renforce un sort, de 0 à 3 NM ; ce que chacun lui apporte est écrit sur le sort. Il se gagne par niveau, par la lecture d’un livre de sort ou en cadeau du MJ.', 'NM'),
  ('niveau-de-puissance-magique', 'Niveau de puissance magique', 'niveau-de-puissance-magique',
   'Le niveau d’un sort, de 1 à 5. Un sort n’est accessible que si la puissance magique du personnage atteint son NPM ; la page de chaque magie range ses sorts par NPM.', 'NPM'),
  ('one-shot', 'One shot', 'one-shot',
   'Une histoire jouée en une seule séance, avec une fin fermée, qui ne laisse pas de suite. Voir aussi {{campagne|Campagne}}.', NULL),
  ('scenario-one-shot', 'Scénario one shot', 'scenario-one-shot',
   'Voir {{one-shot|One shot}}.', NULL),
  ('parade', 'Parade', 'parade',
   'Bloquer un coup avec son arme ou son bouclier, avec la compétence Parade (Force). Voir aussi {{esquive|Esquive}} et {{defense-partielle|Défense partielle}}.', NULL),
  ('piece-elementaire', 'Pièce élémentaire', 'piece-elementaire',
   'Une pièce qui, posée sur une arme, une armure ou un vêtement, le transforme pour toujours en un équipement chargé de sa magie ; les bonus d’origine sont perdus.', NULL),
  ('personnage-joueur', 'Personnage joueur', 'personnage-joueur',
   'Un personnage joueur, celui qu’incarne un joueur ; un personnage non joueur, que joue le MJ, comme tous ceux que croisent les personnages.', 'PJ'),
  ('personnage-non-joueur', 'Personnage non joueur', 'personnage-non-joueur',
   'Voir {{personnage-joueur|Personnage joueur}}.', 'PNJ'),
  ('portee', 'Portée', 'portee',
   'La distance qu’un sort ou une action peut atteindre. Celle d’une arme est le nombre de cases que parcourt son projectile, 1 pour une arme qui n’en écrit pas ; chaque diagonale y compte pour 2 cases.', 'PO'),
  ('posture', 'Posture', 'posture',
   'L’attitude de combat que l’on déclare au début de son tour. Il en existe six : Offensif, Défensif, Neutre, Focus, Vigilance et Symbiose.', NULL),
  ('pretire', 'Prétiré', 'pretire',
   'Une fiche de personnage créée sur le site, visible de tous ; la liste des personnages les réunit.', NULL),
  ('puissance-magique', 'Puissance magique', 'puissance-magique',
   'Le niveau de magie du personnage, de 1 à 5, qui augmente avec son niveau global. Elle dit jusqu’à quel NPM il peut lancer des sorts, et multiplie ses emplacements de sorts.', NULL),
  ('race-pure', 'Race pure', 'race-pure',
   'Race pure, race hybride : les deux familles de races. Une race hybride a sa classe raciale, sauf le Drassah’thac.', NULL),
  ('remede', 'Remède', 'remede',
   'Une potion contre une altération d’état. Le mineur la réduit d’un cran, le majeur de deux, le parfait la soigne entièrement.', NULL),
  ('resistance', 'Résistance', 'resistance',
   'Résistance, faiblesse (ou vulnérabilité) : ce qui fait prendre deux fois moins de dégâts d’une magie, ou deux fois plus. Elles se comptent en crans qui s’additionnent : deux résistances à la même magie font une grande résistance, deux faiblesses une grande vulnérabilité, une résistance et une faiblesse s’annulent. L’armure, elle, résiste ou est faible à des types de coups physiques.', NULL),
  ('reussite-critique', 'Réussite critique', 'reussite-critique',
   'Un résultat de 1 à 5 au D100, que des bonus élargissent (posture, score au-delà de 95 %, dons, sorts…), jamais au-delà de 1 à 15. L’action réussit de façon exceptionnelle : en attaque, les dégâts de base sont doublés.', 'RC'),
  ('sante', 'Santé', 'sante',
   'Les points de vie du personnage. À 0 ou moins, il tombe dans le coma.', NULL),
  ('score', 'Score', 'score',
   'Le pourcentage de réussite d’une compétence, qui vaut 10 × la caractéristique + les points naturels + les points acquis. Il faut faire son score ou moins au D100 pour réussir.', NULL),
  ('specialite', 'Spécialité', 'specialite',
   'L’embranchement d’une classe, qui se choisit quand elle atteint le niveau 10 ; la page de la classe en donne les dons.', NULL),
  ('sprint', 'Sprint', 'sprint',
   'Doubler la distance parcourue pendant son tour. C’est l’action du tour : impossible d’attaquer après un sprint.', NULL),
  ('tenaille', 'Tenaille', 'tenaille',
   'Un ennemi encerclé au corps à corps par des alliés placés sur des cases opposées ; chaque allié de plus donne un avantage, jusqu’à quatre.', NULL),
  ('prise-en-tenaille', 'Prise en tenaille', 'prise-en-tenaille',
   'Voir {{tenaille|Tenaille}}.', NULL),
  ('tour', 'Tour', 'tour',
   'En combat, le temps se découpe en tours ; chacun agit à son tour, dans l’ordre de l’initiative, puis un nouveau tour commence.', NULL),
  ('tour-de-charge', 'Tour de charge', 'tour-de-charge',
   'Le tour passé à charger un sort de niveau 5 avant de le lancer. La posture Focus le supprime.', NULL),
  ('vitesse', 'Vitesse', 'vitesse',
   'Le nombre de cases que le personnage parcourt en un tour. Il en a deux, sur terre et à la nage : celles de sa race, que l’équipement, les accessoires et les sorts peuvent changer.', NULL),
  ('vulnerabilite', 'Vulnérabilité', 'vulnerabilite',
   'Voir {{resistance|Résistance}}.', NULL),
  ('points-dexperience', 'Points d’expérience', 'points-dexperience',
   'Les points d’expérience. Leur total fixe le niveau global.', 'XP'),
  ('zone-dinfluence', 'Zone d’influence', 'zone-dinfluence',
   'Les cases devant un adversaire, derrière lui, à sa gauche et à sa droite. Y entrer puis la traverser lui permet une attaque d’opportunité ; la quitter, une attaque gratuite, que le Doc « Guide pour MJ » range aussi parmi les attaques d’opportunité.', NULL);

-- 3. Les entrées du Lexique qui doublaient un mot-clé (même libelle_cle, ou « {{id:}} » dans le Lexique) : l’id reste ; la définition existante,
--    puis ce que le Lexique ajoute, joints par une espace (une définition NULL prend celle du Lexique) ; l’abréviation que l’entrée écrit.
UPDATE mot_cle SET description = description || ' ' || 'Abrégée BA, elle vaut la moitié du {{chakra|chakra}} total, plus les bonus de la race et de la classe. Certains matériaux d’arme la contrent : le Mythril passe à travers, le Maverium la brise à son contact. Le Glossaire du Codex précise qu’elle prend les coups avant la santé, sauf contre-indication.', abreviation = 'BA' WHERE id = 'barriere';
UPDATE mot_cle SET description = description || ' ' || 'Abrégé CK, il compte les points de magie du personnage, que dépensent ses sorts, et vient de la race, de la ou des classes et des magies.', abreviation = 'CK' WHERE id = 'chakra';
UPDATE mot_cle SET libelle = 'Classe', description = 'La façon de se battre du personnage. Elle a son propre niveau, et lui donne de la santé, du {{chakra|chakra}} et de la {{barriere|barrière}}, des maîtrises d’armes et d’armures, un équipement de départ et des dons. Les classes se rangent en cinq catégories : physiques au corps à corps, physiques à distance, magiques, raciales et spéciales.' WHERE id = 'classe';
UPDATE mot_cle SET description = description || ' ' || 'CR, dans les tableaux de sorts, désigne la corruption. « Si CR » : si le sort est lancé en utilisant la corruption. Dans les dégâts, soins ou barrière (D/S/B) ou les effets, « N CR » fait monter la corruption de la cible (le sort de soin Retrait en retire) ; dans le coût, c''est la corruption à dépenser.', abreviation = 'CR' WHERE id = 'corruption';
UPDATE mot_cle SET libelle = 'Métier', description = 'Un savoir-faire choisi à la création ou plus tard dans l’aventure. Il donne des bonus d’acquis ou d’attribut, des objets de départ et, pour certains, l’artisanat.' WHERE id = 'metier';
UPDATE mot_cle SET description = description || ' ' || 'Une propriété de certaines armes.' WHERE id = 'recharge-longue';
UPDATE mot_cle SET description = description || ' ' || 'Une propriété de certaines armes.' WHERE id = 'recharge-tres-longue';
UPDATE mot_cle SET description = description || ' ' || 'La solidité compte les mauvais coups (un coup critique, le coup d’un adversaire très fort…) qu’un équipement peut encaisser. Une armure en a une par partie (le casque, le torse, chaque bras, chaque jambe), sauf une armure à cran de solidité uni, qui n’en a qu’une.' WHERE id = 'solidite';

-- 4. « CR » rejoint « Corruption » (sa définition et son abréviation : ci-dessus). Les balises : seules ces trois colonnes en ont (texte mis en forme :
--    page.corps_md, où une ligne de tableau écrit « \| » ; texte de case : sort.effets, sort.dsb_brut).
UPDATE page SET corps_md = replace(replace(replace(replace(corps_md,
    '{{cr\|', '{{corruption\|'), '{{cr|', '{{corruption|'), '{{cr}}', '{{corruption|CR}}'), '{{cr:}}', '{{corruption:}}')
  WHERE instr(corps_md, '{{cr') > 0;
UPDATE sort SET effets = replace(effets, '{{cr|', '{{corruption|') WHERE instr(effets, '{{cr|') > 0;
UPDATE sort SET dsb_brut = replace(dsb_brut, '{{cr|', '{{corruption|') WHERE instr(dsb_brut, '{{cr|') > 0;
UPDATE page_tag SET tag_id = 'corruption'
  WHERE tag_id = 'cr' AND page_id NOT IN (SELECT t.page_id FROM page_tag t WHERE t.tag_id = 'corruption');
DELETE FROM page_tag WHERE tag_id = 'cr';
UPDATE sort_mot_cle SET mot_cle_id = 'corruption'
  WHERE mot_cle_id = 'cr' AND sort_id NOT IN (SELECT s.sort_id FROM sort_mot_cle s WHERE s.mot_cle_id = 'corruption');
DELETE FROM sort_mot_cle WHERE mot_cle_id = 'cr';
DELETE FROM mot_cle WHERE id = 'cr';

-- 5. La page « Lexique »
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id = 'guide/lexique')
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id <> 'guide/lexique');
DELETE FROM page_source WHERE page_id = 'guide/lexique';
DELETE FROM lien WHERE page_id = 'guide/lexique' OR cible_page_id = 'guide/lexique';
DELETE FROM page WHERE id = 'guide/lexique';

-- 6. Le dé de l'accessoire « Jet de dé » n° 5 (R183 (10))
UPDATE accessoire_effet SET libelle = replace(libelle, '(1d30)', '(1d100)')
  WHERE id = 'ressources/accessoires#effet:jet-de-de:5' AND instr(libelle, '(1d30)') > 0;
UPDATE page SET corps_md = replace(corps_md, '| Permet de relancer une fois un test de compétence (1d30) (ne peut être changé) (1 fois/jour) |',
    '| Permet de relancer une fois un test de compétence (1d100) (ne peut être changé) (1 fois/jour) |')
  WHERE id = 'ressources/accessoires';

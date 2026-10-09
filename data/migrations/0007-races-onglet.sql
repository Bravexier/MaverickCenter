-- 0007-races-onglet : contenu de l'onglet de chaque race (classeur « Les races ») dans des tables typées, pour que les pages de race soient rendues
-- depuis la base comme les pages de magie (décisions R12 et R13 du propriétaire, docs/decisions-regles.md). Migration de structure ET de données.
--   * race_onglet : une ligne par race (présentation, histoire, description, valeurs de départ de l'onglet, avantages, inconvénients, don de base) ;
--   * race_don : dons raciaux (une ligne par ethnie du tableau de l'onglet, ou le don unique de la race) ; la note de cellule d'un don est dans `remarque` ;
--   * race_don_tableau_colonne / _ligne / _cellule : le tableau en panneaux de l'onglet (Drakos, Mort-vivant), cellule par cellule ;
--   * race_magie_onglet : magies innées que l'onglet limite explicitement (« en inné uniquement » : le Nain, décision R11) ;
--   * mode_hyper_effet : colonne `nom` (nom de la capacité quand la source en donne un) et la version 'onglet_race' (27 lignes) ;
--   * v_regard_peuple : la matrice des relations lue dans le sens tranché (R12 : la case (ligne A, colonne B) dit comment A voit B).
-- Les lignes sont tirées des pages races/<slug> (écrites par tools/sheets/races.py depuis les onglets, puis corrigées par 0005 et 0006) par tools/db/races_onglet.py,
-- qui réécrit chaque section lue avec le code de l'importeur et exige la page à l'identique : rien n'est interprété ni complété.

ALTER TABLE mode_hyper_effet ADD COLUMN nom TEXT;

CREATE TABLE race_onglet (
  race_id              TEXT    NOT NULL PRIMARY KEY REFERENCES race(id),
  onglet               TEXT    NOT NULL UNIQUE CHECK (length(onglet) > 0),
  description_generale TEXT    NOT NULL CHECK (length(description_generale) > 0),
  histoire             TEXT    NOT NULL CHECK (length(histoire) > 0),
  description          TEXT    CHECK (description IS NULL OR length(description) > 0),
  sante_depart         INTEGER NOT NULL,
  chakra_depart        INTEGER NOT NULL,
  barriere_bonus       INTEGER NOT NULL,
  vitesse_sol          INTEGER NOT NULL,
  vitesse_nage         INTEGER NOT NULL,
  avantages            TEXT    NOT NULL CHECK (length(avantages) > 0),
  inconvenients        TEXT    NOT NULL CHECK (length(inconvenients) > 0),
  don_base             TEXT    NOT NULL CHECK (length(don_base) > 0),
  dons_rubrique        TEXT    CHECK (dons_rubrique IN ('Type', 'Condition d''origine', 'Magie innée')),
  dons_rubrique_nom    TEXT    CHECK (dons_rubrique_nom IS NULL OR length(dons_rubrique_nom) > 0),
  dons_rubrique_don    TEXT    CHECK (dons_rubrique_don IS NULL OR length(dons_rubrique_don) > 0),
  dons_tableau_titre   TEXT    CHECK (dons_tableau_titre IS NULL OR length(dons_tableau_titre) > 0),
  origine              TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref           TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK ((dons_rubrique IS NULL) = (dons_rubrique_don IS NULL)),
  CHECK (dons_rubrique_nom IS NULL OR dons_rubrique IS NOT NULL)
) STRICT, WITHOUT ROWID;

CREATE TABLE race_don (
  id          TEXT    NOT NULL PRIMARY KEY,
  race_id     TEXT    NOT NULL REFERENCES race_onglet(race_id),
  slug        TEXT    NOT NULL CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '*--*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  forme       TEXT    NOT NULL CHECK (forme IN ('ethnie', 'unique')),
  etiquette   TEXT    CHECK (etiquette IS NULL OR length(etiquette) > 0),
  nom         TEXT    CHECK (nom IS NULL OR length(nom) > 0),
  texte       TEXT    NOT NULL CHECK (length(texte) > 0),
  ethnie_id   TEXT    REFERENCES ethnie(id),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque    TEXT,
  UNIQUE (race_id, slug),
  UNIQUE (race_id, rang),
  CHECK (id = race_id || '#don:' || slug),
  CHECK ((forme = 'ethnie') = (etiquette IS NOT NULL)),
  CHECK (forme = 'ethnie' OR nom IS NOT NULL)
) STRICT;

CREATE INDEX race_don_ethnie ON race_don (ethnie_id) WHERE ethnie_id IS NOT NULL;

CREATE TABLE race_don_tableau_colonne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  libelle    TEXT    NOT NULL CHECK (length(libelle) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE TABLE race_don_tableau_ligne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  ethnie_id  TEXT    REFERENCES ethnie(id),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_ligne_ethnie ON race_don_tableau_ligne (ethnie_id) WHERE ethnie_id IS NOT NULL;

CREATE TABLE race_don_tableau_cellule (
  race_id    TEXT    NOT NULL,
  ligne      INTEGER NOT NULL,
  colonne    INTEGER NOT NULL,
  valeur     TEXT    NOT NULL CHECK (length(valeur) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, ligne, colonne),
  FOREIGN KEY (race_id, ligne) REFERENCES race_don_tableau_ligne (race_id, rang),
  FOREIGN KEY (race_id, colonne) REFERENCES race_don_tableau_colonne (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_cellule_colonne_fk ON race_don_tableau_cellule (race_id, colonne);

CREATE TABLE race_magie_onglet (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  nom_brut   TEXT    NOT NULL CHECK (length(nom_brut) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, magie_id),
  UNIQUE (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_magie_onglet_magie ON race_magie_onglet (magie_id);

CREATE VIEW v_regard_peuple AS
  SELECT r.ligne_peuple_id AS peuple_id, r.colonne_peuple_id AS vu_peuple_id, r.echelle_id, e.ordre AS echelle_ordre
  FROM relation_peuple r JOIN echelle_relation e ON e.id = r.echelle_id;

-- race_onglet : 27 ligne(s)
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/anansi', 'Anansi', 'Une race mêlant araignée et humain, c''est une race majoritairement femelle. C''est une race qui use bien de son agilité au combat, les plus expérimentés dans leur art unique peuvent utiliser leurs pattes d''araignée comme des armes.

Les Anansis sont reliées à la magie de l''Arcane, la magie de la Nécromancie et la magie de l''Ombre.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Cette race, longtemps restée discrète, a commencé à investir les villes humaines afin d’y établir des commerces de textile, notamment grâce à leur soie, réputée pour sa qualité exceptionnelle.
Selon certaines rumeurs douteuses, ils seraient à l’origine un petit village dont les habitants avaient pour hobby la couture et l’élevage d’araignées afin de récolter leur soie. Cependant, une malédiction aurait frappé le village, fusionnant tous ses habitants avec leurs animaux d’élevage. Ce phénomène provoqua une grande panique pendant plusieurs années, mais avec le temps, les Anansis se regroupèrent en tribus et réussirent à prospérer lentement mais sûrement.

Il existe 4 types de peuple d''Anansi dans le monde :

- Les urbains : Bien qu''elles soient assez intimidantes dû aux pattes d''araignées, elles suscitent la curiosité des autres. Elles sont de très bonnes tisseuses et couturières, on les retrouve très souvent dans les métiers qui concernent le textile.

- Les tribus de l''Arcane : Nommées les "Couturières blanches", comme les Anansi est la seule race à avoir eu les faveurs de la grande déesse de la Magie, un culte autour d''elle s''est créé avec un peuple qui affectionne tout particulièrement les tatouages ainsi que les beaux vêtements dans le style de la déesse de l''Arcane. Leur talent pour la couture est inégalé. Reconnaissables à leurs pattes de couleur argentée avec des taches blanches.

- Les tribus de la Nécromancie : Bénies par la grâce d’Evravonie, elles sont également nommées "Tisseuses de Vie et de Mort". Reconnaissables à leurs pattes de couleur vert foncé et aux petites excroissances osseuses harmonieusement disposées sur leur corps, elles sont sans doute la race la plus zélée à la déesse de la Mort. Une rumeur prétend d’ailleurs qu’elles croient que la déesse elle-même posséderait une forme semi-araignée, à leur image. Elles occupent une place particulière au sein de la Chapelle des Os, où elles sont celles qui produisent le tissu utilisé pour les tenues utilisées pour les rites funéraires.

- Les tribus de l''Ombre : Nommés "Veuve noire" ou "Veuf sombre" et reconnaissables par leurs pattes d''une couleur mauve avec des petites taches noires, il s''agit de la tribu d''Anansi qui contient le plus de représentants mâles (sans pour autant dépasser les femelles), de nature mauvais, ces Anansis sont des chasseurs nés qui sont capables d''exploiter totalement leur agilité et leur discrétion naturelle pour assassiner leurs adversaires sans aucune difficulté. Les tribus peuvent être comparées à des "guides d''assassins", n''hésitant pas à offrir leur servir pour l''assassinat. Ces Anansi sont particulièrement adorateurs de l''aspect intrigue du Dieu de l''Ombre.', 'Les Anansis sont des humanoïdes-araignées, possèdent un corps humain, avec des jambes humaines mais avec des pattes d''araignées dans le dos.

Au-delà de ça, ils sont assez différents selon le sexe, voici les descriptions :

Femelle

Elles sont majoritaires dans leur race, elles sont de grandes humanoïdes entre 2m00 à 2m25 en moyenne, malgré leur grande taille, elles sont assez légères, une moyenne de 80 kg. Elles possèdent des sortes de petites marques en dessous des yeux qui font penser à une autre paire d''yeux. Elles ont deux paires de pattes d''araignées longues et fines comme des lances, ces dernières partent du dos. Leurs cheveux sont longs et lisses.

Mâle

Minoritaires au sein de leur race, les mâles sont bien plus petits que les femelles, mesurant en moyenne entre 1m55 et 1m70. Malgré leur taille réduite, leur poids reste équivalent à celui des femelles. Comme elles, ils possèdent de petites marques sous les yeux, évoquant une seconde paire de pupilles. Leurs deux paires de pattes d’araignée rappellent davantage celles des mygales : plus épaisses, moins longues et couvertes d''une pilosité plutôt abondante. De manière générale, les mâles ont une pilosité plus marquée que la moyenne, avec des cheveux naturellement plus ébouriffés, bien qu’ils ne développent pas une barbe aussi fournie que les nains.

D''une manière générale, les mâles sont plus petits mais trapus et les femelles plus grandes et fines. Les femelles placent une grande importance à leur taille, c''est une source de fierté chez elles.

Les femelles affectionnent les beaux vêtements et les robes, elles ont un besoin d''être raffinées dans leur tenue et leur posture. Les mâles n''ont pas ces préoccupations, ces derniers préfèrent les vêtements pratiques.

La couleur des yeux majoritaire chez les Anansis sont : Argenté, Vert foncé et Mauve

Culture : Colombie', 12, 8, 0, 4, 3, 'Classe possible : Anansi.', 'Magie Arcane, Ombre et Nécromancie en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Anansi › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/drakos', 'Drakos', 'Un sang-mêlé de Dragon et d''Humain, il est impossible d''expliquer comment ce mélange est possible. Les Drakos sont de bons combattants au corps-à-corps et de bons mages, ils possèdent la polyvalence des humains pour la magie. Leur sang partiellement dragon leur permet de vivre jusqu''à 150 ans.

Le premier drakos est apparu en l''an 100, c''était un Drakos de la terre issu d''une relation entre un Dragon de la terre et une humaine.', 'Bien que peu nombreux si on les compare avec les Humains ou les Elfes, les Drakos ne possèdent pas de ville ou de pays consacrée à un culte du Drakos, les Drakos sont des nomades qui vont ici et là, offrant leurs services au plus offrants.

Les Drakos issus du mélange Dragon/Humain ne connaissent pas le principe de Fratrie, car lors de l''accouchement, la mère (Humaine ou Dragonne) ne survivra pas à l''accouchement. Quand une humaine/dragonne est enceinte d''un hybride, elle sait déjà que sa vie s''arrêtera quand elle l''aura mis au monde. Ce sont souvent les Dragonnes qui mettent au monde, car un Dragon peut vivre très longtemps, mais est aussi condamné à sombrer dans la folie due à la puissance qui ne fait que grandir au fur et à mesure de l''âge.

Chaque Drakos issu du mélange possède un deuxième nom de famille qui est entre le prénom et le nom de famille et celui-ci est "Dragoon", un héritage des Dragons et une façon pour eux de les reconnaître comme leurs dignes héritiers, même si cette vision est encore discutée au sein des Dragons.

Cela dit, les Drakos qui se reproduisent entre eux ou avec des humains n''ont pas de problème avec la mort en couches et peuvent avoir plusieurs enfants comme les humains.', 'Un Drakos adulte mesure en moyenne entre 1m80 et 2m10, ils sont très grands de manière naturelle, que ce soit chez les mâles ou les femelles.

Le poids moyen d''un Drakos est de 110kg pour les mâles et 90kg pour les femelles, ce sont les écailles qui les rendent aussi lourds.

La plupart des drakos ont des yeux dont la couleur est liée à leur magie innée, mais certains peuvent avoir des couleurs de yeux comme les humains, les 3 couleurs qu''on retrouve le plus sont : Vert, Bleu et Marron.

Ils possèdent des écailles sur tout le corps, mais pas sur la tête entière, les écailles s''arrêtent au niveau des joues. La couleur des écailles dépend de la magie innée du Drakos.

Leurs oreilles peuvent être soit humaines, soit draconiques, ça dépend des individus.

Ils ont une queue, des pattes de dragon à la place des pieds, des griffes combinées aux doigts.

Les cornes des Drakos varient selon la magie, mais d''une manière générale, les femelles possèdent des cornes un peu plus fines que les mâles. (à magie égale)

Les Drakos possèdent des ailes qui se développent et peuvent être utilisées au bout d''un moment, c''est le dernier attribut draconique que les Drakos développent lorsqu''ils arrivent à maturité, bien que ces ailes ne puissent pas être utilisées pour voler comme un oiseau, mais plus planer et faire des grands sauts.

*Note : Les Drakos de la Terre sont totalement dépourvus d''ailes, mais possèdent une masse musculaire plus importante, une queue bien plus épaisse et puissante. Les Drakos du Vent possèdent deux paires d''ailes dans le dos, ce qui leur permet de pouvoir naturellement voler contrairement aux autres.

Culture : Variable selon la zone de départ', 13, 10, 0, 4, 3, 'Accès à toutes les classes, accès à toutes les magies, peut planer avec ses ailes', 'La magie innée va déterminer la couleur des écailles draconiques et des particularités du don racial.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, 'Écaille draconique', 'races', 'Les races › Drakos › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/drassahthac', 'Drassah''thac', 'Race hybride entre humain et félin, ils viennent de la Déesse de la Chance, Drassah. Il en existe 5 types, Gouttière, Lynx, Tigre, Lion et Léopard.

Ce sont des combattants étranges qui sont capables d''utiliser la Chance pour influencer leurs attaques. Ce sont des joueurs qui jouent tout le temps avec le hasard. Comment reconnaître un Drassah''thac en bonne santé ? Il parie tout le temps.

Ce sont les premiers hybrides animaux à être apparus et ceux en l''an -450.', 'Ce sont les premiers hybrides animaux à avoir existé, ils sont arrivés peu après les humains, elfes et nains. Les Drassah''thac contrairement aux autres hybrides animaux qui vont suivre, ils ont accès à toutes les magies.

Les Drassah''thac ont un conflit millénaire avec les Elfes Forestiers pour des raisons qui ont été oubliées au fur et à mesure du temps, se déclarant la guerre par principe, sinon avec les autres races, les relations sont au beau fixe.', 'Les Drassah''thac sont très proches des humains anatomiquement parlant, à la taille adulte, ils mesurent en moyenne entre 1m60 et 1m90.

Le poids moyen d''un Drassah''thac est de 60kg, il peut varier selon la forme de félin choisie.

Ils possèdent les oreilles de félin, la fourrure d''un félin qui varie de couleur selon l''habitat naturel, fourrure qui est présente sur le dos, les bras, les jambes, les cheveux sont généralement plus longs.

Les Drassah''thac possèdent 5 variantes de leur race :

- Ceux de l''est (culture Asie) possèdent des attributs de tigre. Plus massifs avec un caractère assez bouillant pour la plupart.

- Ceux de l''ouest (culture Afrique) sont de féroces guerriers avec un sens de l''honneur assez poussé, ils sont très appréciés pour leur côté bon vivant et fêtard.

- Ceux du nord (culture Nordique) ressemblent fort à des lynx. Plus petits, mais leur fourrure est parfaitement adaptée aux grands froids, mais aussi aux grosses chaleurs, un véritable isolant thermique qui leur permet de mieux résister à certaines altérations d''états.

- Surnommés les "grands coureurs" ceux du sud (culture Afrique) sont typés léopard et ont tendance à être de meilleurs coureurs que leurs homologues des autres régions (à pas grand-chose).

- Ceux du centre (culture Européenne) sont à poils courts et combinent un peu tout ce qu''on peut retrouver chez les autres variantes, ils sont généralement un peu plus petits.', 9, 9, 0, 5, 5, 'Accès à toutes les magies, accès à toutes les classes.', 'Aucun.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Type', 'Nom', 'Don', NULL, 'races', 'Les races › Drassah''thac › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/elfe-argente', 'Elfe Argenté', 'Les descendants les plus proches des Elfes Dorés, ce sont les êtres qui sont le plus reliés à la magie.

Il s''agit d''humanoïdes qui ont un excellent taux de Chakra et font partie des meilleurs mages de Maverick, au détriment de la force physique.

Cette race est apparue pour la première fois en l''an -100, après un "accident".', 'Tout comme les forestiers et les noirs, ils ont été des esclaves des dorés. Leur origine reste encore assez inconnue, mais on parle d''une expérience qui aura mal tourné qui a changé une partie des elfes dorés en elfe argenté. Malgré leur statut d''esclave, les elfes argentés devenaient très nombreux et ont pu réussir à créer une mutinerie avec l''aide des elfes noirs et forestiers. Après une guerre fratricide, les elfes argentés ont réussi à libérer leur chaîne et celle des autres.

Malgré cet événement, les 3 elfes se détestent surtout qu''au fur et à mesure du temps, les argentés ont commencé à penser comme les dorés et à devenir des suprémacistes. Une partie des argentés se sont rebellés contre cette tendance suprémaciste, mais garde la mauvaise réputation de leur race proche des elfes dorés.', 'Un elfe argenté adulte mesure en moyenne 1,85 mètre, ce qui en fait les elfes les plus grands en moyenne. Leur poids moyen se situe autour de 75 kg.

Comme tous les elfes, ils possèdent des oreilles pointues. Celles des elfes argentés sont particulièrement longues, similaires à celles des elfes dorés. Chez les femelles, elles sont dressées, tandis que chez les mâles, elles sont légèrement tombantes. Hormis cela, les différences entre les deux sexes restent classiques et concernent principalement les cheveux, la forme du visage ou encore la morphologie.

Les elfes argentés présentent trois couleurs d’yeux principales : beige, argent et bleu. Leur peau ainsi que leurs cheveux sont naturellement d’une teinte argentée pâle, caractéristique de leur lignée.

Les variations de couleur sont extrêmement rares chez les individus de sang pur. Lorsqu’un elfe argenté possède des yeux ou des cheveux d’une autre couleur, cela indique généralement un métissage avec une autre race.

Culture : Rome antique/Grèce antique', 3, 14, 0, 5, 4, 'Accès à toutes les magies', 'La Force a un maximum de 2, l''Intelligence est au minimum à 3.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Condition d''origine', NULL, 'Don', NULL, 'races', 'Les races › Elfe Argenté › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/elfe-dore', 'Elfe Doré', 'Les elfes dorés comptent parmi les premières races à avoir foulé les terres de Maverick, aux côtés des Humains et des Nains. Leur arrivée ne s’est toutefois pas faite sans violence, marquant les débuts d’une cohabitation difficile entre les peuples.

Ils se distinguent par une peau beige lumineuse, tirant presque vers le doré. Grands et élancés, ils possèdent une affinité exceptionnelle avec la magie, faisant d’eux les plus puissants utilisateurs de leur époque.

Aujourd’hui, cette race est considérée comme **éteinte**, et son utilisation est donc soumise à des conditions strictes pour les joueurs. Malgré cela, elle demeure l’une des trois races fondatrices du monde, aux côtés des Humains et des Nains.', 'Cette race est apparue en même temps que les Humains et les Nains, chacun avait leur portion de territoire et personne ne venait empiéter sur l''autre. Mais une idéologie suprématiste est venue s''ancrer profondément chez les elfes dorés, cette idée que la magie est à la base de tout et vu qu''ils la maîtrisent le mieux, donc ils sont un peuple élu des dieux et doivent dominer les autres races qui sont inférieures. Nombreux sont les conflits entre les différentes races, les nombreux coups dans le dos qu''ont fait les elfes dorés pour que les uns et autres s''entre-déchirent pour mieux affaiblir les proies et les attaquer dans le dos par la suite, tels des vautours.

Cette race a donné naissance à 3 branches de lui-même, les Elfes Forestiers, les Elfes Noirs et les Elfes Argentés, ces derniers étaient les plus proches de leur capacité magique alors que les autres étaient bien plus physiques et endurants. Malgré leur cousinage, les elfes dorés n''ont pas hésité une seule seconde à réduire en esclavage les 3 elfes. Et dans l''ombre, une grosse rébellion s''organisa pour combattre l''oppresseur ... L''origine de ces elfes ? Les forestiers, c''est une évolution naturelle, les elfes noirs étaient des condamnés à mort (voir les elfes noirs pour en savoir plus) et les argentés seraient issus d''un accident, mais qui est toujours un secret aujourd''hui.

En l''An 50, un elfe argenté du nom de Notox Casus organisait une mutinerie, il a failli être tué, mais a pu continuer malgré tout son organisation et c''est en l''an 215 que les elfes dorés furent tous bannis par le Héros Argenté, ce même Notox Casus.

Les joueurs qui souhaitent jouer un Elfe Doré, vous devez être dans la période -450 à 200. Sinon ce n''est pas possible.', 'Un elfe doré mesure en moyenne 1m80, pour un poids moyen de 70kg, ils sont plutôt maigrichons, mais possèdent d''énormes pouvoirs magiques, ça explique le fait qu''il possède naturellement des veines couleur blanche à certains endroits.

Les 3 couleurs principales de yeux pour les elfes dorés sont : Doré, Argent et Rouge.

Ils possèdent des oreilles identiques à celles des elfes argentés. Elles sont dressées pour les mâles et un peu tombantes pour les femelles.

Culture : Grèce antique', 4, 13, 3, 5, 4, 'Accès à toutes les magies.', 'Aucun.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Les races › Elfe Doré › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/elfe-forestier', 'Elfe forestier', 'L''une des races descendantes des Elfes Dorés, c''est une race qui est naturellement avantagée avec la magie.

Les elfes forestiers sont de bons combattants d''agilité et aussi de bons mages.

Cette race est apparue pour la première fois en l''an -50, c''est une lente évolution des elfes dorés dans le milieu forestier.', 'L''une des branches qu''ont engendrées les Elfes Dorés, il s''agit d''Elfes dorés qui ont lentement évolué dans les milieux forestiers, d''où le nom d''Elfes Forestiers. Ils ont été pendant un temps esclaves de leurs ancêtres quand l''empire doré existait, le jour où les elfes dorés ont disparu, les forestiers ont gagné leur liberté et ont conquis les forêts.

Ce sont des populations assez ouvertes avec les autres races, notamment les humains avec qui ils ont établi énormément de routes commerciales.', 'Les elfes forestiers ressemblent beaucoup aux humains d''une manière globale, mais possèdent quelques différences : une pilosité beaucoup moins marquée, des cheveux plus lisses et des oreilles pointues un peu plus longues que celles des humains.

Les sexes possèdent leurs petites caractéristiques :

Mâle

Les mâles peuvent avoir une légère barbe, mais cela reste plutôt rare. Ils ont un peu plus de muscles, mais la différence est minime, car c''est une race élancée à la base. Leurs oreilles sont plus abaissées que celles des femelles. Ils sont très légèrement plus grands que les femelles.

Femelle

Les femelles sont dépourvues de pilosité, à l''exception de leurs cheveux, qui sont un signe de prestige et de fierté chez elles. Leurs oreilles sont plus dressées que celles des mâles.

D''une manière générale, les femelles et les mâles ont peu de différence physique contrairement aux humains où c''est bien plus marqué.

Les 3 couleurs principales de yeux pour les elfes forestiers sont : Vert, Doré, Marron

La couleur de la peau ne varie pas énormément étant donné que les elfes restent dans les forêts, il garde un ton assez clair avec la même couleur de base que les humains, bien que leurs tons ne changent pas de manière aussi poussée que les humains.

Culture : Rome antique', 7, 13, 0, 5, 5, 'Accès à toutes les classes, accès à toutes les magies.', 'La Force à un maximum de 3, l''Agilité à un minimum de 3.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Condition d''origine', NULL, 'Don', NULL, 'races', 'Les races › Elfe forestier › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/elfe-noir', 'Elfe Noir', 'L''une des races descendantes des Elfes Dorés, ce sont des elfes soit à la peau noire comme le charbon ou blanche comme le sel. Ce sont de bons combattants d''une manière générale.

Ces Elfes sont de profonds esclavagistes et l''esclavage fait partie de leur culture, ils ont des coutumes, une façon de vivre et un style vestimentaire qui est celle des Romains. Bien que leur tendance esclavagiste diminue avec le temps.

Cette race est apparue pour la première fois en l''an 12, après une fuite possible grâce au démon d''eau noire.', 'Les Elfes Charbon, reconnaissables à leur peau noire profonde, sont issus d’elfes dorés corrompus. Cette corruption est à l’origine de leur apparence si particulière. Toutefois, certains d’entre eux sont parvenus à se libérer de cette influence, devenant ainsi des elfes à la peau blanche immaculée, comparée au sel. Ces derniers sont appelés Elfes Salés.

Les Elfes Charbon considèrent ces individus comme des hérésies vivantes et des traîtres, indignes de leur condition, et cherchent activement à les éliminer.

Comme les Elfes Forestiers et les Elfes Argentés à leurs débuts, les Elfes Charbon furent réduits en esclavage par les elfes dorés. Dans la région de Rase, ils étaient notamment contraints d’extraire pierre et minerais dans des conditions extrêmes.

À l’origine, les Elfes Charbon étaient des elfes dorés condamnés à mort pour trahison, déshonneur ou crimes graves. Leur sentence consistait à être exposés à une corruption létale, jusqu’à ce que mort s’ensuive.

Cependant, un être supérieur intervint et en sauva une partie en échange de leur service : Eaunoire, premier ambassadeur déchu de l’Eau.

Les Elfes Salés, parfois appelés elfes noirs albinos, sont d’anciens Elfes Charbon ayant été purifiés de cette corruption. Leur peau devient alors blanche, presque irréelle. Malgré cette libération, leur existence demeure tragique : ils sont mal vus par les Elfes Charbon, qui les considèrent comme des traîtres, et continuent bien souvent de vivre sous une épée de Damoclès.', 'Un elfe noir adulte mesure en moyenne entre 1m60 et 1m90. Ils sont moins grands en moyenne que leurs homologues forestiers.

Le poids moyen d''un elfe noir est de 65kg. Ils sont un peu plus lourds que leurs homologues forestiers.

Au-delà de leur couleur de peau, la grosse différence par rapport aux autres races d''elfes, c’est leurs oreilles qui sont un peu plus longues que celles des forestiers, mais plus courtes que celles des elfes argentés, elles sont également comme dentelées sur la base, ce qui rappelle une scie.

Les 3 couleurs principales de yeux pour les elfes noirs sont : Rouge, Mauve et Gris.

Leurs cheveux sont en majorité de couleur blanche, mais il existe des cas d''elfe noir aux cheveux parfaitement noirs, ils sont à peu près 10%.

Culture : Rome antique', 8, 12, 0, 5, 5, 'Accès à toutes les classes, accès à toutes les magies, avantages sur le jet pour esquiver un état de poison.', 'Aucun', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Type', 'Nom', 'Don', NULL, 'races', 'Les races › Elfe Noir › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/farfadet', 'Farfadet', 'Une race d''humanoïde possédant de grandes ailes de papillon qui peuvent varier selon leur environnement.

Ils ont un grand potentiel en ce qui concerne la magie, ayant accès à toutes les magies possibles y compris le potentiel illimité.

Ils sont arrivés peu après les humains, les elfes dorés et les nains, mais sont toujours restés cachés.', 'Les farfadets sont apparus quelque temps après les trois premières races de Maverick, et furent les premiers à explorer les cieux du monde.

Les farfadets sont extrêmement rares, du moins hors de leurs territoires. Ils sont une race assez secrète, souvent cachée dans les forêts, vivant dans la cime des arbres. Même s''ils sont discrets, ils restent tout de même très courtois avec les autres races lorsque celles-ci s''aventurent sur leur territoire. Mais en réalité, il faut observer du côté des îles flottantes de Maverick où se trouvent leurs plus grosses villes, leurs ailes qui leur permettent de voler leur ont permis de conquérir les cieux.', 'Les farfadets mesurent en moyenne entre 1m30 et 1m60, même si certaines magies comme le sang ou la terre peuvent influencer leur taille. Ils ne possèdent que peu de pilosité sur le corps. De longues oreilles pointues. Bien qu’ils soient plus petits que les felfes leurs ailes sont plus grandes et plus fortes ce qui leur permet de voler comme bon leur semble. Ils aiment les vêtements légers et ont un faible pour les bijoux de tête tels que les broches, les tiares ou les couronnes par exemple.

Ils pèsent en moyenne 50 kg, et leur musculature n’est pas très développée, cela peut changer suivant les magies.

Les 3 couleurs principales des yeux pour les farfadets sont : vert, or et bleu.

Les farfadets amazones vivent dans les forêts xériques et tropicales, leur peau est légèrement halée et ils possèdent des ailes de cigales.

Les farfadets maritimes vivent dans les forêts proches des mers et océans, ils possèdent des ailes de libellules.

Les farfadets médians sont les plus communs, ils vivent dans les forêts sempervirentes et décidues, ils possèdent des ailes de papillons.

Les farfadets alpins vivent dans les forêts denses de conifères et de feuillus, ils possèdent des ailes d’hétérocères.

Culture: Florale', 4, 14, 2, 4, 2, 'Accès à toutes les magies, peut voler.', 'La Force à un maximum de 3.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Condition d''origine', NULL, 'Don', NULL, 'races', 'Les races › Farfadet › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/felfe', 'Felfe', 'Un hybride entre Elfe et Grande fée, leur apparence peut grandement varier selon les parents, mais tous sont gracieux et agiles, mais également de santé fragile.

Ils sont apparus en l''an 80, une belle union taboue entre une grande fée et un elfe argenté.', 'L’origine des felfes demeure incertaine, et nul ne sait avec certitude qui fut le premier de leur espèce. Selon une légende ancienne, leur naissance remonterait à l’union secrète entre le dirigeant des Elfes Argentés de l’époque et la grande reine des Farfadets. De cette relation serait née la première felfe : une femelle à la peau argentée.

Les deux autres variantes seraient apparues plus tard, issues d’unions similaires entre elfes et farfadets, donnant naissance à une descendance hybride aux caractéristiques variées.

Les felfes sont aujourd’hui présents à travers tout le monde. Ils ne possèdent pas de nation propre, vivant au sein des sociétés elfiques ou farfadet, où ils sont généralement acceptés comme des membres à part entière.', 'Un Felfe adulte mesure en moyenne entre 1m40 et 1m70, c''est une race qui est petite en taille en plus d''être assez frêle.

Le poids moyen d''un Felfe est de 50kg, ce sont des créatures humanoïdes plutôt légères.

Ils possèdent des ailes des fées (ailes de papillons) qui ne leur permettent pas de voler (sauf en mode hyper). Il existe 3 variantes de felfes qui ont leur petite subtilité au niveau de l''apparence :

- Les felfes forestiers possèdent une peau beige, une carrure plutôt élancée ainsi que les oreilles des elfes forestiers, la couleur de cheveux principale est le blond ainsi que ses différents tons. Les couleurs d''yeux principales sont : Vert, Doré, Marron.

- Les felfes noirs ont la peau noire, une carrure un peu plus équilibrée ainsi que les oreilles des elfes noirs, la couleur de cheveux principale est le gris dans les tons foncés. Les couleurs d''yeux principales sont : Rouge, Mauve et Gris. Une légende parle de l''existence de felfes noirs à la peau blanche comme les salés, mais ça n''a jamais été prouvé officiellement, la raison officielle est qu''ils sont tellement rares qu''on les considère comme inexistants.

- Les felfes argentés ont la peau argentée, une carrure très frêle ainsi que les oreilles des elfes argentés, la couleur de cheveux principale est le gris dans les tons clairs. Les couleurs d''yeux principales sont : Beige, Argent et Bleu.

Culture : Rome antique', 2, 13, 5, 5, 3, 'Accès à toutes les magies.', 'La Force à un maximum de 2.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Type', 'Nom', 'Don', NULL, 'races', 'Les races › Felfe › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/fenrir', 'Fenrir', 'Race Hybride entre Humain et Loup.

Cette race est très belliqueuse pour la plupart quand il s''agit de territoire ou de terrain de chasse, énormément de conflits avec les Kitsunes et les Namazu notamment.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Ce sont les troisièmes hybrides animaux à être apparus sur Maverick. Selon la légende, les Fenrirs sont une création du Dieu de la Foudre, Volt. Dans des temps immémoriaux, les humains vivaient eux aussi en tribus et les braves loups cherchaient refuge lors des plus terribles hivers. Au départ méfiants, les humains ont accueilli les canidés dans leurs villages. Au fil des siècles, ils sont devenus dociles et devinrent ce que l''on appelle aujourd''hui des chiens. Mais pas tous les loups ne s''étaient soumis aux humains, certains ont choisi de rester en meutes, de rester sauvages, d''autres étaient envieux mais hésitants. Ils souhaitaient vivre la vie des paisibles chiens, sans renoncer à leur vie sauvage, et c''est là que le dieu de la Foudre tenta l''expérience : il métamorphosa plusieurs couples de ces loups admiratifs en ce que l''on appelle aujourd''hui des Fenrirs. On ignore bien évidemment quelles furent les intentions de Volt, mais ainsi soit-il. Les Fenrirs sont nés en -400 et sont maintenant ceux qui vivent en tribus.

Évidemment comme tous les hybrides animaux, les Fenrirs sont divisés en plusieurs catégories de sociétés :

- Les Urbains : Des travailleurs acharnés, mais aussi des gros buveurs et de bons bagarreurs. Ils vivent très souvent en petites communautés de Fenrir au regard de leur magie innée. Dans la plupart des villes, ils possèdent souvent un petit quartier rien qu''à eux, sans rester solitaires, loin de là ! Ils aiment aider leurs prochains, certains pensent que cela fait partie de leur nature. Excepté les Drassah''thac et Kitsunes, trop souvent malhonnêtes envers eux et manquant de sens de l''honneur selon leur dire.

- Les Fenrirs Glace : De fervents défenseurs de Celsius. Ils prient l''Impératrice des glaces, celle qui a sauvé les demi-canidés des hivers polaires. Ils priorisent le combat à mains nues auquel leurs griffes aiguisées sont bien sûr au programme. On pourrait les penser froids et distants, mais ce sont les plus chaleureux et soudés entre eux. Étant très proches de leur déesse, ils sont également adeptes de la magie, mais à leur manière. En effet, les enchanteurs gravent leurs armures, armes et accessoires de symboles cunéiformes appelés runes. Ce n’est en revanche pas des incantations ésotériques, mais un simple alphabet.

- Les Fenrirs Foudre : Les premiers Fenrir à voir le jour. Fils et filles de Volt, ce sont des explorateurs accomplis, mais un peu trop pressés sur les bords. Ils adorent découvrir le monde qui les entoure et inventer de nouvelles technologies. Certains d''entre eux partent se former auprès des nains, à qui leur dieu a tant offert et récompensé. Ils furent les premiers à trouver un intérêt plus poussé au cuivre et à ses alliages. Leurs forgerons sont donc tout naturellement spécialisés à la fabrication d''équipements de ces métaux. Nomades et rarement unis sous une même tribu, on retrouve ces dernières principalement à Mrode, les nomades voyagent un peu partout dans le monde.

- Les Fenrirs Ombre : De véritables loups solitaires, mais aussi de grands chasseurs nocturnes. C''est en partie à eux qu''on doit les multiples guerres de territoires contre les Orios, car partager un terrain de chasse est inconcevable dans cette tribu. Les gourous de l''Ombre prient la Lune et son prince : Umbro, auquel ils célèbrent chaque nouvelle lune, symbole de changement. Ce sont de brillants astronomes qui ne se limitent pas qu''à l''étude de la lune. On retrouve leurs tribus en hauteur, près des flancs de montagne et des plateaux. Ils installent leur campement dans les plus sombres grottes.', 'Les Fenrirs sont très proches des humains anatomiquement parlant, à la taille adulte, ils mesurent en moyenne entre 1m60 et 1m90. Ils possèdent les oreilles de loup, la fourrure d''un loup qui varie de couleur selon l''habitat naturel, fourrure qui est présente sur le dos, les bras, les jambes, les cheveux sont généralement plus longs.

Mâle

Les mâles sont un peu plus costauds physiquement parlant que les femelles, ils ont plus de fourrures au niveau du corps.

Femelle

Les femelles sont moins épaisses, mais possèdent plus de fourrure au niveau des membres, notamment les jambes.

D''une manière globale, les deux sexes n’ont quasiment aucun écart de taille, juste le poids un peu plus élevé des mâles dû à leur physique un peu plus grand (70kg en moyenne).

Les 3 couleurs principales de yeux pour les Fenrir sont : Turquoise, Jaune, Mauve.

Culture : Viking', 13, 7, 0, 5, 4, 'La Perception est obligatoirement à 2 minimum, Classe possible : Fenrir.', 'Magie Glace, Ombre et Foudre en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Fenrir › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/goleois', 'Goleois', 'Race hybride entre humain et poulet.

C''est une race physiquement avantagée par rapport aux autres. Les Goleois sont reliés à la magie de la Glace, du Sang et de la Lumière.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Cette race, a commencé à investir les villes humaines notamment remarqué pour leur force physique plutôt grande qui pourrait être comparée sans trop de soucis à celle des Orios et Minotaures. Leur origine est assez inconnue mais on parlerait d''une secte d''humains qui aura subi une terrible malédiction mais dans leur malheur, ils ont réussi à transformer cette dernière en force et se sont transformés en les êtres que nous connaissons aujourd''hui.

Il existe 4 types de peuple de Goleois dans le monde :

- Les urbains : Les Goleois urbains sont ceux qui ont choisi de s’installer durablement dans les cités humaines. Leur force physique impressionnante en fait des travailleurs très recherchés : les mâles excellent dans les métiers demandant puissance et endurance, comme la construction, le transport ou la sécurité. Les femelles, réputées pour leur calme et leur instinct protecteur, s’orientent souvent vers les professions liées à l’enfance, aux soins ou aux petits élevages urbains.

- Les tribus de la Glace : Les Goleois de Glace se distinguent par un plumage pâle, souvent d’un blanc immaculé, qui tranche avec leur silhouette vigoureuse. On les retrouve principalement dans les régions froides, où leur lien naturel avec la magie de la Glace se manifeste pleinement. Profondément dévoués à Celsius, ils consacrent une grande partie de leur vie à la pratique d’arts martiaux stricts et exigeants. Bien que les étrangers les qualifient volontiers de « barbares », ces Goleois sont en réalité des individus disciplinés, respectueux et organisés, rappelant dans leurs traditions l’ordre et la rigueur du Temple de la Glace.

- Les tribus du Sang : Les Goleois de Sang sont réputés pour être les plus massifs, les plus robustes et les plus imprévisibles de leur espèce le tout avec un plumage sombre. Leur culture tribale repose presque entièrement sur la force brute : chaque interaction, chaque décision, chaque ascension sociale se gagne par l’épreuve du combat. Ils recherchent constamment l’affrontement, et défient régulièrement les tribus Marcass et Orios, qui acceptent volontiers ces duels rituels. Dévoués au dieu de la Force, ils vénèrent la puissance physique comme une vertu sacrée. Dans ces tribus, ceux qui ne parviennent pas à démontrer une force suffisante sont souvent persécutés ou relégués, car faiblesse et honneur ne peuvent y coexister.

- Les tribus de la Lumière : Les Goleois de la Lumière se reconnaissent par leur plumage mêlant clair et sombre. Un trait mystérieux marque leurs tribus : les femelles y sont nettement plus nombreuses que les mâles, sans que personne ne comprenne réellement pourquoi. Qu’ils soient hommes ou femmes, tous partagent un profond sens du soin, de la compassion et de la retenue. Dévoués à la magie de la Lumière, ils privilégient le soutien, la guérison et la médiation, et ne lèvent jamais la main sans raison valable. Leur sagesse et leur douceur contrastent fortement avec la réputation turbulente des autres lignées goleoises, faisant d’eux des médiateurs naturels dans les conflits entre tribus.', 'Les Goleois sont une race hybride mêlant traits humains et caractéristiques aviaires proches du coq. Leur silhouette est globalement humanoïde, mais marquée par une morphologie puissante et des éléments clairement inspirés de la volaille. Les Goleois possèdent un torse et des bras humains, mais particulièrement développés : leur musculature est dense, compacte, taillée pour la puissance et l’explosivité.
Leurs jambes sont entièrement aviaires à partir du genou. Elles se terminent par des pattes de poule massives, écailleuses, équipées de griffes épaisses et redoutables.
Une large partie de leur corps est recouverte partiellement de plumage, dont la densité varie selon les individus et les lignées. Sur les bras : des plumes longues et souples encadrent l’arrière des biceps et des avant-bras. Cheveux : Comme pour les Rokh et Olwman, ils ont des poils et plumes entremêlés. Queue : une longue queue plumée, lourde et expressive, descend dans le dos. Elle est plus large, plus brillante et plus volumineuse chez les mâles.

Mâle

Les mâles sont plus massifs, possèdent une queue bien plus grande et ont un plumage légèrement plus sombre. La chevelure forme naturellement une crête dressée, souvent vive en couleur, rappelant celle d’un coq.

Femelle

Les femelles sont moins massives, possèdent une queue plus courte mais qui reste bien garnie et ont un plumage légèrement plus clair. Les cheveux sont plus doux et plus longs, retombant dans le dos. Leur crête est discrète, parfois seulement suggérée par des plumes plus rigides au sommet du crâne.

Les 3 couleurs principales de yeux pour les goleois sont : Cyan, Bordeaux, Beige.

Culture : France', 15, 5, 0, 6, 3, 'Classe possible : Goleois, Les pieds font des dégâts d''estoc', 'Magie de Glace, Lumière et Sang en innée, ne peut pas voler', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Type', 'Nom', 'Don', NULL, 'races', 'Les races › Goleois › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/hujin', 'Hujin', 'Issus de l''union interdite entre Humain et Majin, les Hujins sont le fruit d''une potentielle entente entre l''Empire Humain et l''Empire Majin.

Les Hujins possèdent un corps remarquablement élastique, ce qui leur permet de taper plus loin. Ils sont bons dans tous les domaines.

Le premier Hujin est arrivé en l''an 40, une belle histoire d''amour entre une majin et un humain qui a fini dans le sang.', 'Le premier Hujin est né sur le sol de Maverick d''un père Humain et d''une mère Majin, il s''est vite remarqué par les scientifiques de Maverick qui ne savaient pas ce qu''il était. Il s''est fait d''abord maltraiter par les Elfes Argentés et Noirs, jusqu''à se faire récupérer par les Humains, et là tout se déroulait bien mieux.

Suite à tout ça, les Hujins ont été reconnus comme race hybride stable par la plupart des races.', 'Un Hujin adulte mesure en moyenne entre 1m50 et 1m90.

Le poids moyen d''un Hujin est de 70kg.

Étant une race hybride, ils ont 6 couleurs principales pour les yeux qui sont : Noir, Doré, Rouge, Marron, Vert et Bleu.

La peau des Hujins possède les mêmes propriétés que la peau des humains. Une peau qui va changer de ton selon l’ensoleillement de l''habitat, bien qu''aujourd''hui, il n''y ait pas de Hujin presque pâle ou bien presque sombre recensés.

Ils ont aussi quelques détails de Majin, notamment la queue (qui peut ne pas être là), une base de corne et à certains endroits vitaux, il y a quelques écailles.

Culture : Japon féodale/Humaine', 10, 10, 0, 4, 4, 'Accès à toutes les classes, accès à toutes les magies.', 'Aucun.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Les races › Hujin › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/humain', 'Humain', 'Race majoritaire dans le monde de Maverick, une légende dirait que ce sont les premiers êtres humanoïdes à être apparus sur cette terre.

Les humains ont un grand potentiel d''adaptation, ce qui leur permet de maîtriser toutes les magies et classes, ce sont également eux qui ont les plus gros changements physiques quand ils deviennent de plus en plus puissants.

Cette race fait partie des 3 premières à être arrivées dans le monde avec les Nains et les Elfes Dorés.', 'Race majoritaire dans le monde de Maverick, une légende dirait que ce sont les premiers êtres humanoïdes à être apparus sur cette terre.

Les humains ont un grand potentiel d''adaptation, ce qui leur permet de maîtriser toutes les magies et classes, ce sont également eux qui ont les plus gros changements physiques quand ils deviennent de plus en plus puissants.', 'Un humain adulte mesure en moyenne entre 1m50 et 1m90. À noter que certaines magies, notamment celles du Sang et de la Terre peuvent influencer la taille moyenne des individus.

Entre les sexes, les différences sont marquées, notamment au niveau de la taille et de la corpulence. D''une manière générale, les mâles sont un peu plus grands et possèdent 10 % de muscles en plus, tandis que les femelles sont bien plus souples. Pour le poids, on a une moyenne de 70kg, ce dernier varie beaucoup selon plein de critères comme la taille, mais aussi la magie.

Les 3 couleurs principales de yeux pour les humains sont : Vert, Bleu et Marron.

La couleur de la peau possède une grande variété de tons mais provient d''une seule couleur, elle varie selon les zones géographiques et selon l''intensité de la lumière du soleil. Plus le soleil est puissant, plus la peau sera sombre, plus le soleil sera faible, plus la peau sera claire. Mais la peau varie aussi selon la magie de l''utilisateur, plus le niveau de puissance est élevé, plus la peau va varier.

- Les humains centraux sont ceux qui se trouvent dans les zones tempérées comme Erisia, ils sont adaptés à toutes les saisons et encaissent moins d''effet négatif que les autres, mais de manière plus globale.

- Les humains désertiques sont des humains à la peau sombre soumis aux aléas et aux caprices du désert, ce qui les rend parfaitement adaptés aux météos Soleil, Canicule, mais aussi à la terrible tempête de sable. Ils ne sont pas ralentis non plus quand le sol devient du sable.

- Les humains tropicaux à la peau sont soumis aux plus grandes pluies et tempêtes qui existent de manière naturelle, ils savent parfaitement comment gérer la pluie ainsi que le vent ce qui les rend totalement immunisés à leurs effets négatifs. Ils ne sont pas ralentis par les sols boueux.

- Les humains de la toundra à la peau très blanche sont parfaitement adaptés à la colère de la neige et du manque de soleil, ils sont totalement immunisés à la neige, mais aussi des brouillards naturels. Ils ne craignent pas les terrains neigeux.

Culture : Variable selon la zone de départ', 10, 10, 0, 4, 4, 'Accès à toutes les classes, accès à toutes les magies.', 'Aucun.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Type', 'Nom', 'Don', NULL, 'races', 'Les races › Humain › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/jackalope', 'Jackalope', 'Une race hybride entre humains et lapin, cette race a pour origine le Dieu-artiste de la Débauche Bauc.

Les Jackalopes sont reliés à la magie de la Terre, à la magie de la Foudre et à la magie du Vide.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Race humain lapin à l''origine du Dieu de la débauche, Bauc. Après l''arrivée des Satyres, Bauc voulait un peuple qui représente bien mieux sa passion pour l''art, les Jackalopes sont nés avec un talent naturel pour l''art.

Malheureusement cette race possède une santé fragile ainsi qu''une durée de vie de 50 ans, ils vivent et vieillissent deux fois plus rapidement qu''un humain normal. Ce talent naturel et cette inspiration plus poussée intéressent énormément le Gardien du Savoir, Mora qui les a bénis de la magie du Vide, une partie des jackalopes semblent croire que Mora est leur créateur et lui voue un culte qui s''approche du zélotisme.

Les Jackalopes sont divisés en 3 catégories :

- Les Urbains : Ils ont abandonné définitivement leurs camarades tribaux pour aller exercer leurs différents arts dans les villages et villes. Ils sont appréciés pour ça justement.

- Les Jackalopes Terre et Foudre : Conscients de leur lien avec le Dieu de la débauche, ils exploitent leur art pour rendre hommage à leur créateur.

- Les Jackalopes Vide : Ceux qui ont renié Bauc pour Mora, ils sont particulièrement zélotes envers lui et offrent leur talent pour faire de nombreux dons pour le Dieu du Savoir, notamment en réalisant des livres de savoir.', 'Cette race est aussi grande que les humains et légèrement plus légère.

Ils possèdent des jambes taillées pour la course et le saut comme des vrais lapins, la queue du lapin, de grandes oreilles très sensibles, un petit nez, des vibrisses au niveau des joues, un corps plutôt fin.

Grâce à leur physique très élancé, ils sont capables de sauter haut mais aussi loin. Ils sont également très rapides.

Culture :', 5, 12, 3, 6, 2, 'Classe possible : Jackalope.', 'Magie Terre, Foudre ou Vide en innée, la Volonté a un maximum de 3.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Jackalope › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/kitsune', 'Kitsune', 'Une race hybride entre humains et renard, le point de départ de la race est une abomination d''humain/renard. Mais un jour, les dieux finirent par éprouver de la pitié pour ces êtres. Ils leur accordèrent alors la capacité de s’adapter, leur permettant de retrouver une apparence majoritairement humaine, tout en conservant certains attributs de renard.

Les Kitsunes sont réputés pour leur grande agilité au combat, ainsi que pour leur grâce naturelle. Très attachés à leur apparence, ils font souvent preuve de fierté, voire d’un certain orgueil.
Apparu avec tous les autres animaux hybrides dans les ans -400 à -350.', 'Nous parlons d''une époque où les kitsunes un culte d''humains ayant subi une malédiction d''origine encore inconnue, les transformant en une abomination d''humain/renard. Mais un jour, les dieux ont eu pitié des kitsunes et les ont permis de s''adapter et de récupérer leur apparence humaine. Le premier d''entre eux nommé "le Grand Druide" aurait vu 3 dieux dans une vision, Séraphin, Aurora et Eoline. Persuadés, que c''est un signe divin, les kitsunes vouent un culte envers ces 3 dieux qui sont considérés comme les créateurs des kitsunes tels qu''on les connaît aujourd''hui.

Comme pour les autres hybrides animales, il existe 2 types de kitsunes :

- Les Urbains : Comme pour les autres hybrides animales qui ne sont pas dans des tribus, ce sont les plus ouverts d''esprit et les plus propres sur eux, même s’ils ont gardé ce côté arrogant et orgueilleux qui fait le caractère de cette race.

- Les Tribaux : Les Kitsunes tribaux quant à eux ont les poils beaucoup moins lisses et ont un tempérament plus isolationniste, pour eux, ils sont le centre du monde et les autres créatures sont d''étranges êtres incompréhensibles aussi bien de la langue que du physique, les Kitsunes urbains eux sont perçus comme des Hérétiques et ennemis des 3 dieux.

Les Kitsunes tribaux élisent également leur chef selon les 3 représentants sacrés des Dieux que sont l''Archidiacre de la Lumière, Émissaire du Feu et Pontife du Vent. Une fois rassemblés lors du Rituel de la Lune, les 3 représentants de par leur droit divin vont désigner le nouveau chef. Ils sont sous la doctrine du mandat céleste.', 'Les Kitsunes sont très proches des humains anatomiquement parlant, à la taille adulte, ils mesurent en moyenne 1m65. Ils possèdent les oreilles de renard, la fourrure d''un renard qui varie de couleur selon l''habitat naturel, fourrure qui est présente sur le dos, les bras, les jambes, les cheveux sont généralement plus longs. Ils ont la queue de renard très épaisse.

Mâle

Les mâles sont un peu plus costauds physiquement parlant que les femelles, ils ont plus de fourrures au niveau du corps.

Femelle

Les femelles sont moins épaisses, mais possèdent plus de fourrure au niveau des membres, notamment les jambes.

D''une manière globale, les deux sexes n’ont quasiment aucun écart de taille, juste le poids un peu plus élevé des mâles dû à leur physique un peu plus grand (65kg en moyenne).

Les 3 couleurs principales de yeux pour les kitsunes sont : Beige, Rouge, Vert.

Culture : Chine', 8, 12, 0, 5, 3, 'L''Agilité est obligatoirement à 2 minimum, Classe possible : Kitsune.', 'Magie Feu, Vent ou Lumière en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Kitsune › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/lamia', 'Lamia', 'Race hybride entre humaine et serpent, cette race exclusivement femelle a des origines toujours inconnues aujourd''hui. Majoritairement pacifique, ça ne les empêche d''être parfois belliqueuses quand il faut.

Cette race extraplanaire est apparue la première fois en l''an 51.

Cette race n''est pas une hybride animale, c''est autre chose encore.', 'Elles sont arrivées grâce à une faille temporelle, depuis elles ont su se trouver un territoire et s''adapter à leur nouvel environnement. Elles sont divisées en 8 clans dénommés "Maison" avec chacune leur particularité, leur spécialité et leur dirigeante.

- Maison ICHETACA | Nom dirigeante : Flaminia | Magie : Feu | Économie : Culture d''épices | Domaine JO : Lutte, Mordhau, Blob-Ball

- Maison ATL | Nom dirigeante : Necahual | Magie : Eau | Économie : Eau gazeuse, pêche | Domaine JO : Natation, Volley, Rame

- Maison IHUICATI | Nom dirigeante : Zeltzin | Magie : Vent | Économie : ??? | Domaine JO : Tir à l''arc, Javelot

- Maison TLALLI | Nom dirigeante : Ambre | Magie : Terre | Économie : Pierres précieuses, Minage, l''ambre | Domaine JO : Haltérophilie, Marathon, Pugilat

- Maison TLALOC | Nom dirigeante : Wattson | Magie : Foudre | Économie : Forge | Domaine JO : Courses, Attire-Foudre

- Maison XIHUTI | Nom dirigeante : Skadi | Magie : Glace | Économie : Chasse, Bois | Domaine JO : Gluse, bataille de boules de neige, Balace

- Maison CITLALI | Nom dirigeante : Lux | Magie : Lumière | Économie : Hôpital | Domaine JO : Tir, Fer à cheval, jeu du miroir

- Maison MEZTLI | Nom dirigeante : Sophia | Magie : Ombre | Économie : Casino | Domaine JO : Poker, les 6 dés 6, jeu de miroir

Comme vous pouvez le constater, les jeux olympiques ont été créés par les lamias à la base pour régler les conflits internes à la race mais ils se sont progressivement ouverts à toutes les races et ainsi organisé une gigantesque fête qui dure 3 mois et ceux tout 5 ans. Les Jo spécifiques à la race peuvent se faire n''importe quand alors que les JO ouverts c''est tous les 5 ans.', 'Complètement humaines de la tête jusqu''en dessous du nombril et totalement faites de serpent jusqu''au bout de la queue, les lamias sont des créatures à sang froid et doivent être particulièrement attentives sur leur température corporelle pour être toujours en pleine forme. Elles sont très sensibles aux changements de température.

La partie dorsale de la queue est couverte par des plumes aux couleurs vives (qui changent selon la magie) et la partie ventrale est composée d''écaille sombre, leur visage ont des traits typiquement asiatiques, selon les individus écailles et plumes peuvent être présentes sur les bras, la base du cou voire même le dos.

Étant donné leur nature divine selon leurs écrits les plus vieux, cette race ne peut pas changer d''apparence à cause de défaut génétique (Pas de plume, pas d''écaille, défaut visage, manque un bras, etc...), c''est littéralement impossible.

Culture : Aztèque', 12, 8, 0, 4, 4, 'Vision thermique, peut porter une armure légère même si la classe l''interdit.', 'Sang Froid, Une seule magie autorisé.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Les races › Lamia › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/majin', 'Majin', 'Les Majins, sont des humanoïdes qui ressemblent énormément aux Humains, avec une peau plus rosée, un peu plus écailleuse, des cornes ainsi qu''une fine queue. Cette race a pour origine dans ce que l''on nomme la dimension "Enfer" ou bien Kcirevam.

Ils ont la particularité de n''être pas très solides, mais de refermer leurs blessures en un temps record, en plus d''avoir les mêmes avantages que les humains concernant les classes et les magies.

Cette race est arrivée dans leur monde d''origine en -39.', 'C''est une race plutôt jeune si on les compare avec les Humains, les Majins sont proches des humains fondamentalement parlant, car leur créatrice est une humaine à la base, Emanon, prétendante du trône de l''Ambassadeur de l''Absolu.

La race n''a pas eu beaucoup d’événements notables, en plus du fait qu''on ne sait pas trop ce qui s''est passé chez eux.

Les Majins ont réussi à créer un premier grand portail en l''an 450 en direction de Maverick et ainsi fut connue la première grande immigration des Majins vers les contrées humaines.', 'Un majin adulte mesure en moyenne entre 1m50 et 1m90. À noter que certaines magies, notamment celles du Sang et de la Terre peuvent influencer la taille moyenne des individus.

D''une manière générale, les mâles sont un peu plus grands et possèdent 10 % de muscles en plus, tandis que les femelles sont bien plus souples. Pour le poids, on a une moyenne de 70kg, ce dernier varie beaucoup selon plein de critères comme la taille, mais aussi la magie.

Les 3 couleurs principales de yeux pour les majins sont : Noir, Doré, Rouge

La couleur de peau possède de grandes variations, tout comme les humains, mais la couleur de base n''est pas la même, c''est une couleur assez rosée. Leur corps est également plus élastique que celui des autres.

Possédant des cornes au niveau du front, ces cornes font en moyenne 15cm de haut. Chez les mâles, elles sont bien plus dressées que celles des femelles.

Possède une queue dont le bout varie selon le sexe du Majin, une pointe de flèche pour les mâles, une pointe de flèche dont les bords sont plus arrondis pour les femelles.

Culture : Japon féodal', 8, 10, 0, 4, 4, 'Accès à toutes les classes, accès à toutes les magies.', 'La Volonté a un maximum de 3.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Les races › Majin › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/marcass', 'Marcass', 'Une race hybride entre humains et cochon, cette race a une origine qui a été perdue depuis fort longtemps, elle a un passé d''esclave.

Cette race bien portante et aux attributs de cochon possède une bonne force physique et est la seule race hybride animale à avoir un lien avec Evravonie, la déesse de la mort.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Race humanoïde à l’apparence porcine et à l’origine mystérieuse, les Marcass ont longtemps été réduits en esclavage total par les Elfes Dorés.

Utilisés comme chair à canon, ils étaient envoyés en masse sur les champs de bataille, sous le prétexte que mourir au combat leur garantirait le salut dans l’au-delà. Sacrifiés par groupes entiers pour une cause qui n’était pas la leur, ils furent presque entièrement anéantis.

Un seul survécut…

Combat après combat, témoin impuissant de la mort de ses frères et sœurs, Grutard se forgea une réputation. À chaque victoire, sa légende grandissait, tout comme sa haine envers les Elfes Dorés. Lorsqu’il devint trop dangereux pour ses maîtres, ces derniers tentèrent de l’éliminer.

Mais au cœur de l’effondrement de l’Empire doré, Grutard osa les défier… et survécut.

Son acte de rébellion inspira d’autres Marcass. Ensemble, ils parvinrent à fuir leurs tortionnaires, trouvant refuge dans le désert doré.

Marqués par leur histoire, les Marcass ont développé un sens de la communauté extrêmement fort. Malgré la présence de trois grandes affinités magiques en leur sein, ils ne se divisent pas en tribus et restent unis. Leur faible nombre — conséquence du contrôle imposé autrefois par les Elfes Dorés — renforce encore cette cohésion.

Aujourd’hui, les Marcass sont dispersés à travers le monde. Ils se sont intégrés dans diverses sociétés, notamment en milieu urbain, où on les retrouve fréquemment dans les tavernes, les cuisines, le mercenariat ou encore la sécurité.', 'Ils sont un peu plus grands que les humains, ils ont un gros ventre gras dû à leur génétique, des oreilles tombantes de cochon, un nez relevé qui fait fort penser à un groin, une queue en tire-bouchon, un visage rond, des canines inférieures proéminentes, une très légère fourrure, une peau claire (bronzé pour ceux du feu), les pieds sont des sabots.

Les Marcass ont une taille moyenne de 1m80.

Ils ont une force physique plus que correcte sans pour autant égaler la force physique des Orios ou des Minotaures, ils restent plus forts que des humains ou des fenrirs.

Les mâles possèdent peu de cheveux mais beaucoup de barbe.

Culture : Mongole', 12, 3, 5, 4, 4, 'Barrière bonus, Classe possible : Marcass.', 'Taux de Chakra bas, magie Terre, Feu ou Nécromancie en innée, la Force a un minimum de 2.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Marcass › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/medusain', 'Médusain', 'Race Hybride entre Humain et Méduse

Cette race aquatique particulière est reliée à la magie de l''Eau, de la Foudre et de la Lumière.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Au tout début, les Médusains n’étaient autres que des humains nomades voyageant dans tout Maverick pour parler de leurs histoires et partager avec d’autres peuples leur foi envers leurs trois divinités : Océane la déesse de l’eau, Volt le dieu de la foudre et Aurora la déesse de la lumière. Hélas lors de l’un de leurs voyages, ils se mirent à dos Séraphe dieu de la guerre ; la raison de cette colère est aujourd’hui encore totalement inconnue de tous, sauf des chefs spirituels de chacune des quatre sociétés médusaines : Les urbains, les Médusains de la foudre, les Médusains de la lumière et les Médusains de l’eau.

Face à cette colère, les nomades furent presque totalement éradiqués des terres de Maverick. Océane, face à cette violence et aux appels à l’aide de son peuple, décida d’intervenir : elle transforma les survivants en mi-homme mi-méduse et leur donna refuge dans ses océans, notamment dans une ville sous-marine se situant dans les Eaux froides.

- Les urbains : Allant de la sagesse, au soin et à l’invention, on les retrouve souvent dans l''humanitaire, toujours prêts à aider et soutenir les plus démunis. Ils agissent toujours avec bonté et attention envers les autres peuples, très protecteurs avec leur semblable.

- Les tribus de l’eau : Des protecteurs nés ayant toujours de bonnes intentions. Quand il s''agit de porter assistance aux plus démunis ou de défendre la veuve et l''orphelin, ce sont les premiers sur le coup. Ce sont des tribus qui préfèrent rester loin des conflits et choisissant plutôt de partager leur savoir et aider leur prochain. Ils sont sous la protection de leur chef spirituel qui est reconnu pour sa sagesse.

- Les tribus de la foudre : Souvent connus sous le nom de « scientifique foudroyant », les Médusains de la foudre sont pour la majorité des scientifiques qui ne cessent de chercher des réponses à travers les yeux de leurs créations. Ces tribus sont sous la protection de leur chef spirituel qui est choisi selon le résultat d’une épreuve mettant en scène leur intellect qui se déroule tous les six ans.

- Les tribus de la lumière : Souvent présents en tant que médecin ou infirmiers, ils sont très volontaires et aiment soigner ceux dans le besoin ; il sont n''est donc pas rare de les retrouver sur les terrains de conflit pour soigner les blessés. Ces tribus choisissent leur chef spirituel selon sa puissance.

Les Médusains sont un peuple plutôt discret, qui évitent en général de se retrouver en conflit avec d’autres races.', 'Les Médusains sont très proches des humains anatomiquement parlant, à la taille adulte, un Médusain moyen mesure entre 1m60 et 1m90.

Le poids moyen d''un médusain est de 60kg, ils sont assez chétifs mais ça les empêche pas de garder une certaine souplesse.

Cette race est assez particulière au niveau de son apparence, les cheveux sont totalement absents et à la place, ils arborent un chapeau de méduse accompagné de nombreux tentacules qui pendent. Elle possède le contrôle de ces tentacules et peuvent avoir des effets négatifs contre des potentielles menaces. Le "chapeau" est fait en gélatine et peut se régénérer très rapidement, formant un casque naturel. Au-delà de ça elle possède des sortes de boules de gélatine qui font comme un gros collier au niveau du buste et autour du cou. Elle est particulièrement fragile à cause d''une peau qui est bien plus fine qu''une peau humaine.

Culture : Australie', 3, 10, 7, 4, 8, 'Classe possible : Médusain.', 'Magie Eau, Lumière et Foudre en innée, la Force a un maximum de 3.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Médusain › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/minotaure', 'Minotaure', 'Une race hybride entre humains et bovin, cette race a une origine alchimique à la base.

Les Minotaures sont reliés à la magie du Sang, à la magie de l''Ombre ou à la magie de la Terre.

Apparu en l''an -50, contrairement aux autres hybrides animales, c''est une création alchimique.', 'Créés par les Elfes Dorés afin de servir d’esclaves pour les travaux manuels, les Minotaures ont longtemps vécu sous la domination de leurs créateurs. Ils parvinrent un temps à fuir, mais furent rapidement capturés et de nouveau réduits en esclavage, cette fois par les Elfes Charbon.

Ce n’est qu’à la suite d’une guerre de territoire entre les Nains et les Elfes Charbon que leur destin changea. Les Nains libérèrent les Minotaures de leurs chaînes et leur offrirent refuge. Depuis lors, les deux peuples cohabitent étroitement : les Minotaures apportent leur force de travail dans les mines et les galeries, tandis que les Nains cherchent à améliorer leurs conditions de vie.

L’un des plus grands accomplissements de cette alliance fut atteint en l’an 360, lorsque les Nains parvinrent à résoudre un problème majeur : l’absence de reproduction naturelle chez les Minotaures. Jusqu’alors dépendants de procédés alchimiques, ils purent enfin voir apparaître les premières femelles de leur espèce. Dès lors, la race minotaure devint autonome et capable de se reproduire naturellement. Les relations entre Nains et Minotaures sont depuis restées solides et bienveillantes.

Les Minotaures, tout comme les Orios, sont considérés comme des races bénies par le dieu de la Force, en raison de leur puissance physique exceptionnelle. Il n’est pas rare de voir ces deux peuples s’affronter lors de compétitions amicales visant à déterminer « le plus fort », notamment lors des épreuves de force pure des Jeux lamias.

Contrairement à d’autres races, les Minotaures ne possèdent pas de tribus barbares qui leur sont propres. Ils s’intègrent généralement au sein des tribus d’autres peuples, en particulier celles des Orios, avec lesquelles ils entretiennent des liens étroits.', 'Les Minotaures sont d’imposants humanoïdes, comparables en taille aux Orios. Leur anatomie mêle traits humanoïdes et caractéristiques bovines : ils possèdent des sabots, des pattes puissantes, ainsi que des cornes particulièrement solides, parfaitement adaptées au combat. Chez les mâles, ces cornes sont généralement plus grandes et plus développées que chez les femelles.

Leur corps est massif et musclé, conçu pour la force et l’endurance. Un poil court recouvre une grande partie de leur corps, notamment le dos, une portion du torse, les bras et les pattes.

Les femelles, apparues plus tard dans l’histoire de la race, présentent des caractéristiques physiques distinctives. Leur morphologie est adaptée à leurs attributs mammaires plus massifs en moyenne par rapport aux autres races et une structure dorsale renforcée, leur permettant de supporter ce poids sans entraver leur mobilité.

Culture : Allemagne', 20, 1, 0, 5, 3, 'Les cornes et sabots sont des armes naturelles de frappe et d''estoc, Classe possible : Minotaure.', 'La Force est obligatoirement à 3 minimum, Magie Sang, Ombre ou Terre en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Minotaure › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/mort-vivant', 'Mort-vivant', 'Une race particulière et rare qui s''est relevée de sa tombe pour accomplir ses objectifs les plus profonds. Contrairement aux Non-Morts (qui sont basiquement des monstres limités intellectuellement), les morts-vivants sont des personnes mortes assez récemment, mais, leur volonté de vivre ou leur objectif était si fort qu''Evravonie en personne leur donna une seconde chance et renvoya leur âme dans leur corps de mort. Ce cas de figure n''est possible que quand la personne est morte "trop tôt", si la personne est morte de vieillesse, cette résurrection est impossible "naturellement."

Cette race existe depuis que les autres races existent, on ne connaît pas l''identité du premier mort-vivant.', 'Les Morts-Vivants sont loin d''être nouveaux, ils existent depuis l''apparition de la magie et de l''influence d''Evravonie. Seulement, de par leur nature de cadavre ambulant, ils sont rejetés de la plupart des sociétés, il est assez rare qu''un peuple accepte que de telles créatures se promènent dans les rues. Les morts-vivants pour la plupart se cachent dans les bas-fonds des villes ou bien cachent leur apparence morte par le déguisement.

Chaque mort-vivant possède la conscience, la morale et la magie innée qu''il avait quand il était vivant. (Faites bien attention de respecter ça quand vous faites un lore poussé avec votre personnage, car votre vivant avait une magie innée et sa version mort-vivant a forcément la même. Et quand vous déterminez une magie innée à votre mort-vivant et que vous déclarez une race de vivant, vérifiez bien que l''ancienne race est compatible avec votre magie innée de mort-vivant)

Le temps de vie d''un mort-vivant est très élevé, il avoisine les 300 ans, on considère une naissance de mort-vivant au moment où il se relève de sa tombe, en revanche ... Il ne bouge pas physiquement parlant, il garde son apparence, tant bien entendu qu''il mange suffisamment. Oui, les morts-vivants mangent en moyenne 3 fois plus que les autres races, sauter des repas pour eux, c''est prendre le risque que leur peau se détériore plus rapidement.', 'C''est aussi diversifié que les races, au dépend de ce qu''était la personne morte, son physique va varier, mais tout en perdant les attributs qui faisaient de lui son vivant.

Exemples :

- Un Ancien Elfe sera plus leste et élancé, mais perdra ses oreilles et une partie de sa chevelure.
- Un Ancien Orios sera plus massif et grand, mais perdra sa queue, ses oreilles et sa fourrure.
- Un Ancien Drakos sera plus grand et aura encore sa queue, mais perdra ses ailes et toutes ses écailles.
- Une Ancienne Lamia aura encore son corps de serpent, mais va perdre 80% de ses écailles et plumes (les écailles restantes ne protègent pas)

Tous les avantages qu''ils avaient en étant vivants ne sont plus, il en garde des vestiges

Cela dit les morts-vivants ont des traits exclusifs à eux :

- La peau plus grise ou décolorée.
- Le blanc de l''œil qui devient rouge (dans le cas d''un utilisateur du vide, c''est son iris qui devient parfaitement rouge)

Culture : Variable selon la race quand il était vivant', 12, 10, 0, 4, 4, 'Accès à toutes les classes, accès à toutes les magies, un sommeil complet régénère complètement la santé en plus de la barrière.', 'La Volonté est obligatoirement à 4, le Social est obligatoirement à 1, les Soins de la Lumière infligent des dégâts, doit énormément manger (3 fois plus qu''un vivant) , les fioles rouges, mauves et oranges infligent des dégâts.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Les races › Mort-vivant › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/nain', 'Nain', 'Une race humanoïde dont la particularité est d''être petite en taille par rapport aux Humains ou Elfes Forestiers.

Ce sont d''excellents combattants au corps-à-corps, le tout avec un capital de santé plus élevé que la moyenne en dépit d''un capital de chakra bien plus faible et d''une limitation des magies qui leur sont possibles d''avoir de manière innée.

Cette race fait partie des 3 premières à être arrivées dans le monde avec les Humains et les Elfes Dorés.', 'Arrivés peu après les Humains et les Elfes Dorés, les Nains ont rapidement trouvé leur place au sein des montagnes et des cavernes. Leur petite taille, particulièrement adaptée à l’exploration d’espaces étroits, leur a permis de s’y installer efficacement. Cela ne les a toutefois jamais empêchés de voir les choses en grand, fondant d’immenses cités creusées à même la roche.

Marchands, forgerons, joailliers et mineurs par nature, quand on voit un nain, c''est le terme "d''artisan" qui vient à l''esprit.

Ce sont également les Nains qui, en l’an 280, libérèrent les Minotaures de la tyrannie des Elfes Charbon. Malgré cet acte, les relations entre les deux peuples ne se sont jamais véritablement apaisées.', 'Un Nain adulte mesure en moyenne entre 1m00 et 1m40, ce sont les humanoïdes les plus petits. Il possède une pilosité très développée notamment chez les mâles, les femelles ne possèdent pas de barbe, bien que parfois un petit duvet pousse sur ces dernières.

Le poids moyen d''un nain est de 80kg, malgré leur taille, ils sont trapus et costauds.

Les 3 couleurs principales de yeux pour les nains sont : Marron, Vert, Jaune.

La couleur de la peau est de couleur claire et ne varie pas beaucoup entre les individus.

Le point d''origine des Nains sont les montagnes de Londolor situé dans Erisia, ce qui a conduit à la naissance de 3 ethnies de nains : Ouest, Est et Centre

- Ceux de l''Ouest sont de formidables artisans qui disposent d''un physique plus musclé avec une peau un peu plus sombre, sûrement dû à l''exposition quasiment permanente des forges et autres mines.

- Ceux de l''Est sont des commerçants dans l''âme et disposent d''un physique plus gras avec une peau plus claire.

- Ceux du centre ont un physique un peu plus maigre que ceux de l''ouest avec une peau qui tourne un peu vers le gris. Les dangers de la Ligne de partage ont amélioré leur résistance.

Culture : Allemagne', 16, 4, 0, 3, 3, 'Les armures lourdes ne les ralentissent pas, accès à toutes les classes.', 'Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).', 'Condition d''origine', NULL, 'Don', NULL, 'races', 'Les races › Nain › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/namazu', 'Namazus', 'Une race hybride entre humain et requin, ces êtres sont de nature aventurière, ils écument les 7 mers à la recherche de gloire, de trésor et de frisson. Ce sont d''excellents combattants qui aiment se battre tout comme les Orios, il n''est pas rare de voir des Namazu dans des équipages de pirates ou de marins, voire même de les commander.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'C''est une race qui existe suite à une malédiction comme la plupart des hybrides animales, les membres d''une secte d''adorateurs d''Océane se sont fait maudire par Anna la Déesse de la Fortune pour des raisons encore obscures, ces derniers sont devenus des monstres mi-humains mi-requins, assoiffés de sang et totalement aveugles. Océane leur a permis de conserver une formes humaines hybrides requins, ce qui leur permet d''être les plus à l''aise dans l''eau, Brock a calmé leur soif de sang et Umbro leur a redonné la vue qu''ils avaient perdue. Suite à ça, on retrouve plusieurs sociétés de Namazu :

- Les Urbains : Les Namazus qui sont nés dans les grandes villes ou alors ceux qui ont rejeter des tribus, on les retrouve bien entendu en majorité dans les villes portuaires et dans des métiers qui ont un rapport avec l''eau. Étonnamment, beaucoup travaillent dans des moulins à eau, loin des côtes.

- Les Tribus du Sang : Ceux qui vouent un culte à Brock sont les les tribus du sang, ce sont de féroces guerriers et de redoutables pillards, ils aiment le combat mais ne sont pas forcément réputés pour leur loyauté au combat comme pourraient l''être les Orios et les Minotaures. Ce sont des pirates cruels et particulièrement brutaux. Piller les corps après chaque combat est leur second passe-temps favori, ils sont responsables de la plupart des bateaux disparus en haute mer puisqu''ils coulent systématiquement les navires qu''ils viennent de nettoyer du sang de leurs ennemis.

- Les Tribus de l''Ombre : Des pirates particulièrement vicieux car ils sont réputés pour être des assassins particulièrement rusés et très bons tireurs à l''arme à feu. Ils ne sont pas aussi belliqueux que leurs homologues du sang, ils sont bien plus intéressés par les trésors qu''ils peuvent trouver en arpentant les 7 mers ou en volant discrètement les navires qui ne sont pas les leurs. D''ailleurs... telles des hyènes, ça arrive assez souvent qu''ils volent le butin des tribus du sang après leur combat.

- Les Tribus de l''Eau : Contrairement à ce qu''on pourrait croire, la plupart des tribus namazus de l''eau sont des pacifiques et de grands explorateurs des mers, ils sont connus pour avoir de très bons outils pour cartographier les océans ainsi que les profondeurs. Mais ils ne sont pas à sous-estimer, ils sont très zélotes et fidèles envers Océane qu''ils considèrent comme la créatrice des Namazus. Chacune de leurs actions est toujours bénie au nom d''Océane, la fille des eaux. Donc gare à celui qui manquera de respect à Océane, des formidables guerriers marins seront à ses trousses.', 'Les Namazus sont des humains avec des attributs de requins, ils possèdent une nageoire dorsale, des branchies, des oreilles en formes de nageoires ainsi qu''une peau un peu écailleuse par endroit. Ils sont assez maigres pour la plupart, sauf bien entendu ceux du sang qui ont un physique bien plus épais.

Il n''y pas de différence notable entre les sexes, on retrouve juste les mêmes différences que chez les humains (cheveux, morphologie, etc...)

La taille moyenne d''un namazu est de 1m70

Le poids moyen d''un Namazu est de 65kg.

Les 3 couleurs principales de yeux pour les namazus sont : Bordeaux, Mauve, Eau.

Culture : Espagne', 12, 8, 0, 4, 8, 'Armure naturelle de 3AP, Classe possible : Namazus.', 'Magie Eau, Ombre ou Sang en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Namazus › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/olwman', 'Olwman', 'Une race hybride entre humain et hibou, ce sont des créatures qui affectionnent les endroits perchés mais aussi les tours dans les montagnes, là où ils peuvent se consacrer au savoir et à la connaissance.

C''est une race pour la plupart pacifique qui joue souvent le rôle de coursier de nuit, mais cette race avait déjà eu des soucis avec d''autres races hybrides, notamment les Namazu ainsi que les Rokhs, guerre de territoire et de chasse.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'Les Origines de cette race sont très mystérieuses, on parle d''Umbro mais aussi de Notix dans leurs origines étant donné qu''ils peuvent posséder cette magie de manière innée, mais aussi pour leur côté très raffiné et aussi leur soif de savoir.

Tribus ou bien urbains, les olwmans possèdent tous une doctrine qu''ils s''efforcent de respecter à la lettre : "Respecte tes aînés peu importe leur race mais encore plus si cet aîné sait plus de choses que toi". En effet, les olwman sont naturellement attirés par la connaissance et le savoir et ont bâti leur culture autour de ça. Dans les tribus d''olwmans, le chef de la colonie est toujours un olwman très âgé qui sait beaucoup de choses, car chez les olwman, être âgé signifie être plus sage et intelligent, ce n''est pas un hasard d''ailleurs que la majorité des chefs de tribus sont des olwman qui sont innés de la magie de l''Espace/Temps, vu qu''ils peuvent vivre plus longtemps grâce à cette magie, donc ils sont portés en respect par les Olwmans. Au-delà de ça, ils ont des manières raffinées, des saveurs raffinées ils aiment bien la bonne nourriture, qui font un peu penser à comment se comporte le Dieu de l''Ombre Umbro.', 'C''est une race assez petite pour la plupart des individus, pas plus de 1m60 en moyenne, ils sont également très légers avec un petit 50kg en moyenne, leur anatomie particulière et le fait qu''ils sont capables de voler avec leurs propres ailes font que cette race se doit d''être légère en poids. Comme dit précédemment, les Olwmans sont tous capables de voler car leurs ailes sont aussi leurs bras, leurs mains font grandement penser à des serres et ils possèdent des plumes presque partout sur leur corps (cheveux, bras, dos, un peu sur les jambes). Leurs pieds sont des serres très acérées qui peuvent utilisé comme des pieds pour marcher. Comme tous les hybrides animaux, ils ont la tête humaine. Comme ce sont des demi-hiboux, ils possèdent des aigrettes à la place des sourcils.

Le plumage des olwmans est sombre (noir, marron, etc...)

Mâle

Femelle

Les 3 couleurs principales de yeux pour les olwmans sont : Rose, Mauve, Vert.

Culture : Angleterre', 8, 12, 0, 6, 0, 'Peut voler, Classe possible : Olwman.', 'Magie Vent, Ombre et Temps/Espace en innée, ne peut pas nager.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Olwman › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/orios', 'Orios', 'Race hybride entre humain et ours, l''origine de cette race est assez obscure.

Ce sont des puissants combattants qui aiment se battre même si la plupart des Orios sont plutôt pacifiques au niveau des relations entre les différentes races. Les Orios sont reliés à la magie de la Terre, la magie de l''Eau et la magie du Sang.

Cette race est arrivée en -430, peu de temps après les premiers humains.', 'Ce sont les deuxièmes hybrides animaux à être apparus sur Maverick. Des rumeurs disent que les Orios sont une création du Dieu de la Force, Brock. D''autres parlent d''une secte vénérant ce même dieu, le dieu aurait accordé sa bénédiction sur la secte entière et les aurait changés en Orios. Ce sont les plus crédibles car les Orios font partie des races qui possèdent la plus grande force naturelle qui existe, seuls les minotaures peuvent les égaler.

Évidemment, comme tous les hybrides animaux, les Orios sont divisés en plusieurs catégories de sociétés :

- Les Urbains : De véritables forces de la nature, on les retrouve dans globalement tous les métiers qui demandent une paire de gros bras et sont appréciés pour leur talent pour travailler le bois, la menuiserie, la taille de pierre, le déménagement, la logistique, maçonnerie, etc ... Bref, on les retrouve un peu partout là où la force est utile.

- Les Orios Sang : Grands guerriers honorables pour certains, redoutables barbares pour d''autres, les Orios qui vénèrent celui qu''ils appellent "Père Ours" sont de puissants guerriers où la force prime, bien entendu dans leur société, le plus fort dirige et doit en permanence imposer sa force envers ceux qui souhaitent prendre sa place. Bien qu''ils aient l''air très effrayants avec leur physique particulièrement développé, ils ne sont pas aussi brutaux que ça pour la plupart. On les retrouve principalement dans les plaines.

- Les Orios Terre : Surnommés les Ouvriers de Dimitri, les Orios de la Terre sont un peuple de puissants orios qui entretiennent les forêts ou les grands plateaux où la pierre abonde, ils sont parfaitement capables de se défendre, car ils sont bien plus ingénieux que leur homologue du Sang. Le chef des tribus de la terre est désigné selon son expérience dans les travaux manuels comme la maçonnerie, la taille de pierre ou la menuiserie, cela dépend des tribus. On les retrouve principalement au cœur des forêts et surplombant les plateaux rocheux.

- Les Orios Eau : Pierre précieuse et poissons, voilà ce qui définit les tribus d''Orios de l''eau, ce sont des joailliers qui recherchent de belles pierres précieuses dans les rivières, fleuves, torrents, ruisseaux, etc ... Et au-delà de ça, ils sont d''excellents pêcheurs, que ce soit avec l''outil ou à la main. Ce sont des pacifiques qui accueillent avec plaisir les étrangers dans leur clan tant qu''ils ne sont pas menaçants. Ce sont de redoutables guerriers malgré tout, pas autant que leur homologue de la terre ou du sang, mais ils n''hésiteront pas à défendre leur clan ou la parole de leur mère à tous, Océane. On les retrouve près des points d''eau douce.', 'Les Orios sont comme les humains, mais en plus grand, en moyenne un Orios adulte mesure en moyenne 1m80 et avec les bonnes magies, ça peut grimper à 2m30, même si ça reste rare. Il possède les oreilles d''ours, la fourrure d''un ours qui varie de couleur selon l''habitat naturel, fourrure qui est présente sur le dos, les bras, les jambes, les cheveux sont généralement plus longs, sourcils plus épais en général.

Mâle

Les mâles ont beaucoup de fourrure, notamment au niveau du dos et des bras. Ils sont naturellement très musclés et possèdent 15 % de muscles en plus par rapport aux femelles. Le poids moyen d''un mâle adulte est de 100 kg. Leur barbe reste assez développée, mais pas autant qu''on pourrait le croire. Les magies de Terre et de Sang les marquent énormément, se manifestant par davantage de plaques de terre ou de veines saillantes par rapport aux autres races.

Femelle

Les femelles sont moins musclées que les mâles, mais elles restent plus puissantes physiquement que de nombreux mâles d''autres races. Leurs oreilles sont légèrement plus petites, leur pilosité moins importante, mais elles possèdent plus de fourrure au niveau du ventre et des jambes. Elles ont également une poitrine légèrement plus volumineuse que celle des humaines.

Les 3 couleurs principales de yeux pour les orios sont : Marron, Bordeaux, Bleu.

Culture : Canada', 20, 1, 0, 4, 5, 'Les griffes sont des armes naturelles de taille, Classe possible : Orios.', 'Magie Terre, Eau et Sang en innée, l''Agilité a 3 maximum, La Force est obligatoirement à 3 minimum.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Orios › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/rokh', 'Rokh', 'Une race hybride entre humain et aigle, ce sont des créatures qui vivent en petite communauté dans les montagnes perchées, là où c''est accessible pour les créatures ailées. Ils sont très reliés à la foudre et sont même capables d’appeler cette magie en cas de besoin, certaines théories disent que cette race a pour origine Volt, le dieu de la Foudre.

C''est une race pour la plupart pacifique qui joue souvent le rôle de coursier.

Apparu avec tous les autres animaux hybrides autres dans les ans -400 à -350..', 'Selon la légende, cette race fut créée par le Dieu de la Foudre Volt, d''où leur affinité particulière avec la foudre et le fait qu''il est le plus souvent prié par rapport aux deux autres dieux des Rokh que sont Aurora et Eoline. Rien de sûr et peu importe, les Rokhs existent et ne comptent pas s''éteindre de sitôt. Cette race possède une culture Amérindienne et affectionne tout ce qui est peinture corporelle et tatouages.

Il existe deux types de Rokh dans le monde :

- Les Rokhs Tribaux, ce sont des Rokhs qui s''organisent en tribu un peu partout dans le monde, c''est assez simple, mais les dirigeants sont un cercle de 5 individus dominé par un Chef, on reconnaît facilement les grades grâce à des tatouages en forme de trait sur le front, le dirigeant de la tribu en possède 5 et les différents membres du cercle en possèdent 4. Dans les tribus, chaque membre possède des traits sur le front, chacun a une symbolique : 1 trait = Naissance, 2 traits = Adulte, 3 traits = Parent et Marié(e), 4 traits = Membre du Cercle, 5 traits = Guide de la colonie. Les tribus ne se mélangent pas trop avec les autres tribus ou bien les urbains, mais les rencontres entre aventuriers et locaux sont assez fréquentes et permettent des échanges de savoir.

- Les Rokhs Urbains, ce sont des Rokhs qui vivent tout simplement hors des tribus, ils gardent des bases de leur culture rokh, mais c''est juste une base. Ils sont généralement les coursiers de la journée et gèrent les transports aériens, avec des ailes c''est plus simple.

Ils ont beau être différents, pourtant les deux types de Rokhs ont gardé une tradition qu''ils partagent avec les Olwmans, c''est que la ponte des œufs doit se faire toujours sur le sommet de volcan endormi de l''Île Œuf qui selon des rumeurs le point d''origine des premiers Rokhs et Olwmans.

Eh oui ! Les Rokhs pondent des œufs pour donner naissance, la première moitié du temps, le bébé est dans le ventre de sa mère et la seconde moitié, la mère va pondre l''œuf qui contient le futur enfant. Malgré la résistance de l''œuf, la prudence est de mise, car il suffit d''une cassure pour que l''enfant meure à cause de maladie ou d''infection.', 'C''est une race assez petite pour la plupart des individus, pas plus de 1m60 en moyenne, ils sont également très légers avec un petit 60kg en moyenne, leur anatomie particulière et le fait qu''ils sont capables de voler avec leurs propres ailes font que cette race se doit d''être légère en poids.

Il y a une petite différence entre les sexes au-delà des éléments communs aux humains : Les femelles sont plus grandes en taille que les mâles.

Comme dit précédemment, les Rokhs sont tous capables de voler car leurs ailes sont aussi leurs bras, leurs mains font grandement penser à des serres et ils possèdent des plumes presque partout sur leur corps (cheveux, bras, dos, un peu sur les jambes). Leurs pieds sont des serres très acérées qui peuvent utilisé comme des pieds pour marcher. Comme tous les hybrides animaux, ils ont la tête humaine.

Le plumage des rokhs est clair (blanc, marron, etc...)

Les 3 couleurs principales de yeux pour les rokh sont : Vert, Jaune, Beige.

Culture : Amérindien', 9, 11, 0, 6, 0, 'Peut voler naturellement, Classe possible : Rokh.', 'Magie Vent, Foudre ou Lumière en innée, ne peut pas nager.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Rokh › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/satyre', 'Satyre', 'Une race hybride entre humains et bélier (brebis pour les femelles), cette race a pour origine le Dieu de la Débauche Bauc qui est lui-même un Satyre.

Apparu avec tous les autres hybrides animaux dans les ans -400 à -350.', 'La cinquième race hybride animale est née d’une manière particulièrement atypique. À l’origine, le premier satyre ne fut nul autre que Bauc, dieu de la débauche et des arts.

Lorsque vint le temps de créer les premiers ambassadeurs — les fils et filles des dieux — Bauc façonna un être à son image : charismatique, séduisant et animé des mêmes passions que lui. « Tu es ma plus grande sculpture », déclara-t-il. Cet être, nommé Soleil, aspirait à suivre les traces de son créateur : « Je ferai comme mon créateur : je sculpterai, mais à la manière des mortels. »

Soleil se rendit alors dans la plus grande maison de plaisirs du monde mortel. Cinquante femmes s’y présentèrent, et toutes furent touchées par la grâce de l’ambassadeur de la débauche. Elles partageaient trois affinités magiques : le Feu, la Foudre et la Terre. Bien que la magie innée du demi-dieu demeure inconnue, de ces unions naquirent les premiers satyres.

Depuis lors, les satyres perpétuent l’héritage de leur origine : ils incarnent la débauche et les plaisirs, apportant légèreté et insouciance dans le monde des mortels.

Bien que liés à trois magies innées distinctes, les satyres ne se structurent pas en grands peuples tribaux, contrairement à la plupart des hybrides animaux. En raison des circonstances de leur naissance, ils sont aujourd’hui majoritairement urbains.

Un aspect particulièrement intéressant de cette race réside dans la présence de deux grandes philosophies de vie, aux comportements radicalement opposés : d’un côté, certains satyres embrassent pleinement leur héritage et vivent dans la débauche et le libertinage, fidèles à l’essence même de leur origine divine. De l’autre, certains adoptent une voie totalement opposée. Ils font preuve d’une fidélité inébranlable envers la personne qu’ils ont choisie, développant des liens profonds et exclusifs, presque sacrés.

Ces deux visions coexistent au sein de la race, sans qu’aucune ne soit considérée comme dominante, reflétant ainsi la dualité inhérente à leur nature.', 'Le poids moyen d''un Satyre est de 70kg.

Les satyres sont des humanoïdes de taille similaires aux humains. Deux cornes de chèvres ornent leur crâne, une laine douce et soyeuse parcourt en partie leur corps : leur cou, leur poitrine, le haut de leur dos, leurs bras et leurs jambes sont concernés, le reste est de peau. La laine sur leur poitrine forme d''ailleurs un motif de coeur, chez les femelles, cette laine forme également une brassière au niveau des seins. Leurs pieds sont des sabots, ils sont également plantigrades.

Les 3 couleurs principales de yeux pour les satyres sont : Marron, Jaune, Rouge.

Culture : Italie', 11, 9, 0, 5, 4, 'Classe possible : Satyre.', 'Magie Terre, Foudre ou Feu en innée.', 'Repos (Action 3 fois/jour) (Permet de récupérer 2d4 + 4 santé et chakra (jet de calme en stress)).', 'Magie innée', NULL, 'Don', NULL, 'races', 'Les races › Satyre › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)');

-- race_don : 70 ligne(s)
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/anansi#don:arcane-en-innee', 'races/anansi', 'arcane-en-innee', 1, 'ethnie', 'Arcane en innée', NULL, '- Jette deux dés pour tout jet qui concerne les murs (escalade, connaissance, etc) et garde le meilleur.
- 1 cran de résistance sur une magie aléatoire (sauf arcane et corruption) et son altération d''état.', 'races/anansi#ethnie:anansi-darcane', 'races', 'Les races › Anansi › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/anansi#don:necromancie-en-innee', 'races/anansi', 'necromancie-en-innee', 2, 'ethnie', 'Nécromancie en innée', NULL, '- Jette deux dés pour tout jet qui concerne les murs (escalade, connaissance, etc) et garde le meilleur.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/anansi#ethnie:anansi-de-necromancie', 'races', 'Les races › Anansi › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/anansi#don:ombre-en-innee', 'races/anansi', 'ombre-en-innee', 3, 'ethnie', 'Ombre en innée', NULL, '- Jette deux dés pour tout jet qui concerne les murs (escalade, connaissance, etc) et garde le meilleur.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/anansi#ethnie:anansi-dombre', 'races', 'Les races › Anansi › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/drassahthac#don:drassahthac-est', 'races/drassahthac', 'drassahthac-est', 1, 'ethnie', 'Drassah''thac Est', 'Félin puissant', '- +2 santé.
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +1 aux dégâts avec les armes, qui augmente de +1 tous les 5 niveaux globaux.', 'races/drassahthac#ethnie:drassahthac-est', 'races', 'Les races › Drassah''thac › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/drassahthac#don:drassahthac-ouest', 'races/drassahthac', 'drassahthac-ouest', 2, 'ethnie', 'Drassah''thac Ouest', 'Félin solide', '- +2 santé.
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +3 AP.', 'races/drassahthac#ethnie:drassahthac-ouest', 'races', 'Les races › Drassah''thac › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/drassahthac#don:drassahthac-nord', 'races/drassahthac', 'drassahthac-nord', 3, 'ethnie', 'Drassah''thac Nord', 'Félin adapté', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- 1 cran de résistance au gel et à la brûlure.', 'races/drassahthac#ethnie:drassahthac-nord', 'races', 'Les races › Drassah''thac › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/drassahthac#don:drassahthac-sud', 'races/drassahthac', 'drassahthac-sud', 4, 'ethnie', 'Drassah''thac Sud', 'Félin rapide', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +1 vitesse.', 'races/drassahthac#ethnie:drassahthac-sud', 'races', 'Les races › Drassah''thac › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/drassahthac#don:drassahthac-centre', 'races/drassahthac', 'drassahthac-centre', 5, 'ethnie', 'Drassah''thac Centre', 'Félin social', '- +1 santé, +1 chakra
- Les contrôles mentaux ont deux fois moins d''effets, durent deux fois moins longtemps.
- +5% Diplomatie et Manipulation en acquis.', 'races/drassahthac#ethnie:drassahthac-centre', 'races', 'Les races › Drassah''thac › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-argente#don:territoire-elfes-argentes', 'races/elfe-argente', 'territoire-elfes-argentes', 1, 'ethnie', 'Territoire Elfes Argentés', NULL, '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Barrière.', 'races/elfe-argente#ethnie:elfe-argente-suppremaciste', 'races', 'Les races › Elfe Argenté › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-argente#don:barrage-argente', 'races/elfe-argente', 'barrage-argente', 2, 'ethnie', 'Barrage Argenté', NULL, '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Santé.', 'races/elfe-argente#ethnie:elfe-argente-barrage-argente', 'races', 'Les races › Elfe Argenté › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-argente#don:ailleurs', 'races/elfe-argente', 'ailleurs', 3, 'ethnie', 'Ailleurs', NULL, '- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Chakra.', 'races/elfe-argente#ethnie:elfe-argente-autre', 'races', 'Les races › Elfe Argenté › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-dore#don:sang-dore', 'races/elfe-dore', 'sang-dore', 1, 'unique', NULL, 'Sang doré', 'Les dégâts de sorts, les soins, les dégâts d''altération d''états gagnent un bonus de +3.', 'races/elfe-dore#ethnie:elfe-dore', 'races', 'Les races › Elfe Doré › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-forestier#don:foret-ou-les-villes-des-territoires-elfe-forestier', 'races/elfe-forestier', 'foret-ou-les-villes-des-territoires-elfe-forestier', 1, 'ethnie', 'Forêt ou les villes des territoires Elfe forestier', NULL, '- +5% à tout test d''Agilité
- Le matériau BOIS a ses effets triplés (3AP/AM au lieu de 1AP/AM) (Armure ou Bouclier)', 'races/elfe-forestier#ethnie:elfe-forestier-foret', 'races', 'Les races › Elfe forestier › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-forestier#don:urbain-tout-le-reste', 'races/elfe-forestier', 'urbain-tout-le-reste', 2, 'ethnie', 'Urbain (tout le reste)', NULL, '- +5% à tout test d''Agilité
- +1% de réussite critique à tous les jets tant que le personnage est en milieu urbain', 'races/elfe-forestier#ethnie:elfe-forestier-urbain', 'races', 'Les races › Elfe forestier › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-noir#don:elfe-charbon', 'races/elfe-noir', 'elfe-charbon', 1, 'ethnie', 'Elfe Charbon', 'Sang corrompu', '- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec.
- Inflige 1 corruption à chacune des attaques qui touche (armes ou magies)', 'races/elfe-noir#ethnie:elfe-noir-charbon', 'races', 'Les races › Elfe Noir › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/elfe-noir#don:elfe-sale', 'races/elfe-noir', 'elfe-sale', 2, 'ethnie', 'Elfe Salé', 'Sang purifié', '- +10% à tous les tests d''artisanat.
- Chaque soin (physique, magique, sort, objet) soigne 1 point de corruption', 'races/elfe-noir#ethnie:elfe-noir-sale', 'races', 'Les races › Elfe Noir › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/farfadet#don:farfadet-median-forets-temperees-centraux', 'races/farfadet', 'farfadet-median-forets-temperees-centraux', 1, 'ethnie', 'Farfadet Médian (Forêts tempérées, centraux)', NULL, 'Magie, Concentration, Orientation, Stabilité OU Réflexe = 5% d''acquis.', 'races/farfadet#ethnie:farfadet-median', 'races', 'Les races › Farfadet › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/farfadet#don:farfadet-maritime-forets-proches-de-leau', 'races/farfadet', 'farfadet-maritime-forets-proches-de-leau', 2, 'ethnie', 'Farfadet Maritime (Forêts proches de l''eau)', NULL, '- Augmente d''un cran les dés des soins magiques (D6 passe à D8 etc...)
- +6% Médecine acquis', 'races/farfadet#ethnie:farfadet-maritime', 'races', 'Les races › Farfadet › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/farfadet#don:farfadet-amazone-jungle', 'races/farfadet', 'farfadet-amazone-jungle', 3, 'ethnie', 'Farfadet Amazone (Jungle)', NULL, '- Avantage sur les jets qui impliquent les altérations d''états qui demandent le jet de vigueur pour être esquivé.
- +6% Vigueur acquis', 'races/farfadet#ethnie:farfadet-amazone', 'races', 'Les races › Farfadet › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/farfadet#don:farfadet-alpin-forets-montagneuses-taiga', 'races/farfadet', 'farfadet-alpin-forets-montagneuses-taiga', 4, 'ethnie', 'Farfadet Alpin (Forêts montagneuses, taïga)', NULL, '- Avantage sur les jets qui impliquent les altérations d''états qui demandent le jet de fermeté pour être esquivé.
- +6% Fermeté acquis', 'races/farfadet#ethnie:farfadet-alpin', 'races', 'Les races › Farfadet › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/felfe#don:felfe-forestier', 'races/felfe', 'felfe-forestier', 1, 'ethnie', 'Felfe Forestier', 'Sang féerique forêt', 'Magie, Concentration, Esquive, Ruse = 5% d''acquis.', 'races/felfe#ethnie:felfe-forestier', 'races', 'Les races › Felfe › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/felfe#don:felfe-noir', 'races/felfe', 'felfe-noir', 2, 'ethnie', 'Felfe Noir', 'Sang féerique corrompu', '- Magie, Concentration, Survie = 5% d''acquis.
- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec.', 'races/felfe#ethnie:felfe-noir', 'races', 'Les races › Felfe › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/felfe#don:felfe-argente', 'races/felfe', 'felfe-argente', 3, 'ethnie', 'Felfe Argenté', 'Sang féerique brillant', '- Magie, Concentration, Survie = 5% d''acquis.
- +1 aux dégâts magiques, qui augmente de +1 tous les 5 niveaux globaux.', 'races/felfe#ethnie:felfe-argente', 'races', 'Les races › Felfe › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/fenrir#don:glace-en-innee', 'races/fenrir', 'glace-en-innee', 1, 'ethnie', 'Glace en innée', NULL, '- Distinction, Observation et Magie = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/fenrir#ethnie:fenrir-de-glace', 'races', 'Les races › Fenrir › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/fenrir#don:foudre-en-innee', 'races/fenrir', 'foudre-en-innee', 2, 'ethnie', 'Foudre en innée', NULL, '- Distinction, Observation et Réflexe = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/fenrir#ethnie:fenrir-de-foudre', 'races', 'Les races › Fenrir › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/fenrir#don:ombre-en-innee', 'races/fenrir', 'ombre-en-innee', 3, 'ethnie', 'Ombre en innée', NULL, '- Distinction, Observation et Sabotage = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/fenrir#ethnie:fenrir-dombre', 'races', 'Les races › Fenrir › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/goleois#don:glace-en-innee', 'races/goleois', 'glace-en-innee', 1, 'ethnie', 'Glace en innée', NULL, '- Si la santé tombe à 0 ou en dessous, permet de tenir 1 tour avant de tomber dans le coma. Coma si la santé est à son maximum négatif. Soin impossible pendant le tour.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/goleois#ethnie:goleois-de-glace', 'races', 'Les races › Goleois › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/goleois#don:lumiere-en-innee', 'races/goleois', 'lumiere-en-innee', 2, 'ethnie', 'Lumière en innée', NULL, '- Si la santé tombe à 0 ou en dessous, permet de tenir 1 tour avant de tomber dans le coma. Coma si la santé est à son maximum négatif. Soin impossible pendant le tour.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/goleois#ethnie:goleois-de-lumiere', 'races', 'Les races › Goleois › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/goleois#don:sang-en-innee', 'races/goleois', 'sang-en-innee', 3, 'ethnie', 'Sang en innée', NULL, '- Si la santé tombe à 0 ou en dessous, permet de tenir 1 tour avant de tomber dans le coma. Coma si la santé est à son maximum négatif. Soin impossible pendant le tour.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/goleois#ethnie:goleois-de-sang', 'races', 'Les races › Goleois › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/hujin#don:elasticite', 'races/hujin', 'elasticite', 1, 'unique', NULL, 'Élasticité', 'La portée des attaques augmente de 1.', 'races/hujin#ethnie:hujin', 'races', 'Les races › Hujin › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/humain#don:humain-central', 'races/humain', 'humain-central', 1, 'ethnie', 'Humain Central', 'Adaptation humaine', '- 10% de compétence en acquis à répartir au choix.
- Les météos et terrains ont leurs effets négatifs divisés par 2.', 'races/humain#ethnie:humain-central', 'races', 'Les races › Humain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/humain#don:humain-desertique', 'races/humain', 'humain-desertique', 2, 'ethnie', 'Humain Désertique', 'Homme du désert', '- Survie, Athlétisme et Fermeté = 5% en acquis.
- Les météos Grand Soleil, Canicule, Tempête de Sable, Champ Magnétique et les terrains liés à eux n''ont aucun effet négatif.', 'races/humain#ethnie:humain-desertique', 'races', 'Les races › Humain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/humain#don:humain-tropical', 'races/humain', 'humain-tropical', 3, 'ethnie', 'Humain Tropical', 'Tempête sage', '- Survie, Observation et Stabilité (OU Réflexe) = 5% en acquis.
- Les météos Pluie, Pluie diluvienne, Orage, Vent violent et les terrains liés à eux n''ont aucun effet négatif.', 'races/humain#ethnie:humain-tropical', 'races', 'Les races › Humain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/humain#don:humain-toundra', 'races/humain', 'humain-toundra', 4, 'ethnie', 'Humain Toundra', 'Homme Blizzard', '- Survie, Vie en nature et Vigueur = 5% en acquis.
- Les météos Neige, Tempête de neige, Brouillard, Purée de pois et les terrains liés à eux n''ont aucun effet négatif.', 'races/humain#ethnie:humain-toundra', 'races', 'Les races › Humain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/jackalope#don:terre-en-innee', 'races/jackalope', 'terre-en-innee', 1, 'ethnie', 'Terre en innée', NULL, '- Permet de faire des grands sauts de 4m de haut (+2 au niveau 10)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/jackalope#ethnie:jackalope-terre', 'races', 'Les races › Jackalope › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/jackalope#don:foudre-en-innee', 'races/jackalope', 'foudre-en-innee', 2, 'ethnie', 'Foudre en innée', NULL, '- Permet de faire des grands sauts de 4m de haut (+2 au niveau 10)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/jackalope#ethnie:jackalope-foudre', 'races', 'Les races › Jackalope › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/jackalope#don:vide-en-innee', 'races/jackalope', 'vide-en-innee', 3, 'ethnie', 'Vide en innée', NULL, '- Permet de faire des grands sauts de 4m de haut (+2 au niveau 10)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/jackalope#ethnie:jackalope-vide', 'races', 'Les races › Jackalope › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/kitsune#don:feu-en-innee', 'races/kitsune', 'feu-en-innee', 1, 'ethnie', 'Feu en innée', NULL, '- Ruse, Réflexe et Manipulation = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/kitsune#ethnie:kitsune-feu', 'races', 'Les races › Kitsune › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/kitsune#don:vent-en-innee', 'races/kitsune', 'vent-en-innee', 2, 'ethnie', 'Vent en innée', NULL, '- Ruse, Réflexe et Équilibre = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/kitsune#ethnie:kitsune-vent', 'races', 'Les races › Kitsune › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/kitsune#don:lumiere-en-innee', 'races/kitsune', 'lumiere-en-innee', 3, 'ethnie', 'Lumière en innée', NULL, '- Ruse, Réflexe et Distinction = 5% en acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/kitsune#ethnie:kitsune-lumiere', 'races', 'Les races › Kitsune › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/lamia#don:ecaille-solide', 'races/lamia', 'ecaille-solide', 1, 'unique', NULL, 'Écaille solide', 'Possède 2AP permanents au niveau des jambes et un autre endroit au choix, qui augmente de +2 tous les 5 niveaux globaux.', 'races/lamia#ethnie:lamia', 'races', 'Les races › Lamia › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/majin#don:renfermement', 'races/majin', 'renfermement', 1, 'unique', NULL, 'Renfermement', 'Une fois la stabilisation réussie, remonte la santé à 0 puis récupère 2d6 pv', 'races/majin#ethnie:majin', 'races', 'Les races › Majin › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/marcass#don:terre-en-innee', 'races/marcass', 'terre-en-innee', 1, 'ethnie', 'Terre en innée', NULL, '- +2 Armure magique (+2 tous les 5 niveaux)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/marcass#ethnie:marcass-terre', 'races', 'Les races › Marcass › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/marcass#don:feu-en-innee', 'races/marcass', 'feu-en-innee', 2, 'ethnie', 'Feu en innée', NULL, '- +2 Armure magique (+2 tous les 5 niveaux)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/marcass#ethnie:marcass-feu', 'races', 'Les races › Marcass › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/marcass#don:necromancie-en-innee', 'races/marcass', 'necromancie-en-innee', 3, 'ethnie', 'Nécromancie en innée', NULL, '- +2 Armure magique (+2 tous les 5 niveaux)
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/marcass#ethnie:marcass-necromancie', 'races', 'Les races › Marcass › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/medusain#don:eau-en-innee', 'races/medusain', 'eau-en-innee', 1, 'ethnie', 'Eau en innée', NULL, '- Si une attaque de CAC est encaissée, un tentacule touche l''agresseur et lui inflige Poison 1 pendant 1 tour s''il ne porte pas d''armure là où le tentacule touche.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/medusain#ethnie:medusain-eau', 'races', 'Les races › Médusain › O30', 'Jet de vigueur pour esquiver l''altération d''état');
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/medusain#don:foudre-en-innee', 'races/medusain', 'foudre-en-innee', 2, 'ethnie', 'Foudre en innée', NULL, '- Si une attaque de CAC est encaissée, un tentacule touche l''agresseur et lui inflige Paralysie 1 pendant 1 tour s''il ne porte pas d''armure là où le tentacule touche.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/medusain#ethnie:medusain-foudre', 'races', 'Les races › Médusain › O34', 'Jet de vigueur pour esquiver l''altération d''état');
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/medusain#don:lumiere-en-innee', 'races/medusain', 'lumiere-en-innee', 3, 'ethnie', 'Lumière en innée', NULL, '- Si une attaque de CAC est encaissée, un tentacule touche l''agresseur et lui inflige Brûlure 1 pendant 1 tour s''il ne porte pas d''armure là où le tentacule touche.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/medusain#ethnie:medusain-lumiere', 'races', 'Les races › Médusain › O38', 'Jet de vigueur pour esquiver l''altération d''état');
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/minotaure#don:sang-en-innee', 'races/minotaure', 'sang-en-innee', 1, 'ethnie', 'Sang en innée', NULL, '- Cette créature ne subit aucun dégât de recul avec toute attaque de charge
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/minotaure#ethnie:minotaure-sang', 'races', 'Les races › Minotaure › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/minotaure#don:ombre-en-innee', 'races/minotaure', 'ombre-en-innee', 2, 'ethnie', 'Ombre en innée', NULL, '- Cette créature ne subit aucun dégât de recul avec toute attaque de charge
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/minotaure#ethnie:minotaure-dombre', 'races', 'Les races › Minotaure › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/minotaure#don:terre-en-innee', 'races/minotaure', 'terre-en-innee', 3, 'ethnie', 'Terre en innée', NULL, '- Cette créature ne subit aucun dégât de recul avec toute attaque de charge
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/minotaure#ethnie:minotaure-de-terre', 'races', 'Les races › Minotaure › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/mort-vivant#don:trompe-mort', 'races/mort-vivant', 'trompe-mort', 1, 'unique', NULL, 'Trompe-mort', 'Immunisé contre le poison et la maladie. Son acquis max en Social est augmenté de +20 et un petit plus de selon les conditions de la mort, voir tableau ci-dessous.', NULL, 'races', 'Les races › Mort-vivant › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/nain#don:londolor-est', 'races/nain', 'londolor-est', 1, 'ethnie', 'Londolor Est', NULL, '- Peut porter une catégorie supérieure d''armure selon les classes [aucun => léger, léger => intermédiaire, intermédiaire => lourde]
- +5% Négociation en acquis.', 'races/nain#ethnie:nain-est', 'races', 'Les races › Nain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/nain#don:londolor-ouest', 'races/nain', 'londolor-ouest', 2, 'ethnie', 'Londolor Ouest', NULL, '- Peut porter une catégorie supérieure d''armure selon les classes [aucun => léger, léger => intermédiaire, intermédiaire => lourde]
- +5% à chaque test lié à l''artisanat.', 'races/nain#ethnie:nain-ouest', 'races', 'Les races › Nain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/nain#don:londolor-centre-ligne-de-partage', 'races/nain', 'londolor-centre-ligne-de-partage', 3, 'ethnie', 'Londolor Centre (Ligne de partage)', NULL, '- Peut porter une catégorie supérieure d''armure selon les classes [aucun => léger, léger => intermédiaire, intermédiaire => lourde]
- +5% Vigueur en acquis.', 'races/nain#ethnie:nain-ligne-de-partage', 'races', 'Les races › Nain › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/namazu#don:sang-en-innee', 'races/namazu', 'sang-en-innee', 1, 'ethnie', 'Sang en innée', NULL, '- Intimidation, Calme et Athlétisme = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/namazu#ethnie:namazu-sang', 'races', 'Les races › Namazus › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/namazu#don:ombre-en-innee', 'races/namazu', 'ombre-en-innee', 2, 'ethnie', 'Ombre en innée', NULL, '- Intimidation, Calme et Orientation = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/namazu#ethnie:namazu-ombre', 'races', 'Les races › Namazus › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/namazu#don:eau-en-innee', 'races/namazu', 'eau-en-innee', 3, 'ethnie', 'Eau en innée', NULL, '- Intimidation, Calme et Dressage = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/namazu#ethnie:namazu-eau', 'races', 'Les races › Namazus › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/olwman#don:espace-temps-en-innee', 'races/olwman', 'espace-temps-en-innee', 1, 'ethnie', 'Espace/Temps en innée', NULL, '- Concentration, Connaissance et Médecine = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/olwman#ethnie:olwman-espace-temps', 'races', 'Les races › Olwman › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/olwman#don:vent-en-innee', 'races/olwman', 'vent-en-innee', 2, 'ethnie', 'Vent en innée', NULL, '- Concentration, Connaissance et Réflexe = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/olwman#ethnie:olwman-vent', 'races', 'Les races › Olwman › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/olwman#don:ombre-en-innee', 'races/olwman', 'ombre-en-innee', 3, 'ethnie', 'Ombre en innée', NULL, '- Concentration, Connaissance et Observation = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/olwman#ethnie:olwman-ombre', 'races', 'Les races › Olwman › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/orios#don:sang-en-innee', 'races/orios', 'sang-en-innee', 1, 'ethnie', 'Sang en innée', NULL, '- +2 aux dégâts avec les armes, qui augmente de +2 tous les 5 niveaux globaux.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/orios#ethnie:orios-de-sang', 'races', 'Les races › Orios › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/orios#don:terre-en-innee', 'races/orios', 'terre-en-innee', 2, 'ethnie', 'Terre en innée', NULL, '- +2 aux dégâts avec les armes, qui augmente de +2 tous les 5 niveaux globaux.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/orios#ethnie:orios-de-terre', 'races', 'Les races › Orios › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/orios#don:eau-en-innee', 'races/orios', 'eau-en-innee', 3, 'ethnie', 'Eau en innée', NULL, '- +2 aux dégâts avec les armes, qui augmente de +2 tous les 5 niveaux globaux.
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/orios#ethnie:orios-deau', 'races', 'Les races › Orios › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/rokh#don:vent-en-innee', 'races/rokh', 'vent-en-innee', 1, 'ethnie', 'Vent en innée', NULL, '- Négociation, Diplomatie et Ruse = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/rokh#ethnie:rokh-vent', 'races', 'Les races › Rokh › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/rokh#don:foudre-en-innee', 'races/rokh', 'foudre-en-innee', 2, 'ethnie', 'Foudre en innée', NULL, '- Négociation, Diplomatie et Réflexe = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/rokh#ethnie:rokh-foudre', 'races', 'Les races › Rokh › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/rokh#don:lumiere-en-innee', 'races/rokh', 'lumiere-en-innee', 3, 'ethnie', 'Lumière en innée', NULL, '- Négociation, Diplomatie et Observation = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/rokh#ethnie:rokh-lumiere', 'races', 'Les races › Rokh › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/satyre#don:terre-en-innee', 'races/satyre', 'terre-en-innee', 1, 'ethnie', 'Terre en innée', NULL, '- Diplomatie, Psychologie, Athlétisme = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/satyre#ethnie:satyre-terre', 'races', 'Les races › Satyre › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/satyre#don:foudre-en-innee', 'races/satyre', 'foudre-en-innee', 2, 'ethnie', 'Foudre en innée', NULL, '- Diplomatie, Psychologie, Réflexe = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/satyre#ethnie:satyre-foudre', 'races', 'Les races › Satyre › Don R (Race)', NULL);
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/satyre#don:feu-en-innee', 'races/satyre', 'feu-en-innee', 3, 'ethnie', 'Feu en innée', NULL, '- Diplomatie, Psychologie, Dressage = 5% d''acquis
- 1 cran de résistance en plus à la magie innée et son altération d''état.', 'races/satyre#ethnie:satyre-feu', 'races', 'Les races › Satyre › Don R (Race)', NULL);

-- race_don_tableau_colonne : 6 ligne(s)
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/drakos', 1, 'Magie innée', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/drakos', 2, 'AP/AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/drakos', 3, 'Bonus compétence', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/drakos', 4, '+1 cran de résistance', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/mort-vivant', 1, 'Lieu de résurrection
Raison de la mort', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_colonne (race_id, rang, libelle, origine, source_ref) VALUES ('races/mort-vivant', 2, 'Don', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');

-- race_don_tableau_ligne : 27 ligne(s)
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 1, 'races/drakos#ethnie:drakos-orange', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 2, 'races/drakos#ethnie:drakos-bordeau', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 3, 'races/drakos#ethnie:drakos-gris', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 4, 'races/drakos#ethnie:drakos-noir', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 5, 'races/drakos#ethnie:drakos-rose', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 6, 'races/drakos#ethnie:drakos-blanc', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 7, 'races/drakos#ethnie:drakos-vert-fonce', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 8, 'races/drakos#ethnie:drakos-rouge', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 9, 'races/drakos#ethnie:drakos-bleu', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 10, 'races/drakos#ethnie:drakos-cyan', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 11, 'races/drakos#ethnie:drakos-vert', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 12, 'races/drakos#ethnie:drakos-jaune', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 13, 'races/drakos#ethnie:drakos-brun', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 14, 'races/drakos#ethnie:drakos-beige', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/drakos', 15, 'races/drakos#ethnie:drakos-mauve', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 1, 'races/mort-vivant#ethnie:mort-vivant-sang', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 2, 'races/mort-vivant#ethnie:mort-vivant-necrotique', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 3, 'races/mort-vivant#ethnie:mort-vivant-espace-temps', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 4, 'races/mort-vivant#ethnie:mort-vivant-vide', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 5, 'races/mort-vivant#ethnie:mort-vivant-feu', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 6, 'races/mort-vivant#ethnie:mort-vivant-glace', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 7, 'races/mort-vivant#ethnie:mort-vivant-eau', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 8, 'races/mort-vivant#ethnie:mort-vivant-foudre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 9, 'races/mort-vivant#ethnie:mort-vivant-vent', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 10, 'races/mort-vivant#ethnie:mort-vivant-terre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 11, 'races/mort-vivant#ethnie:mort-vivant-lumiere', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_ligne (race_id, rang, ethnie_id, origine, source_ref) VALUES ('races/mort-vivant', 12, 'races/mort-vivant#ethnie:mort-vivant-ombre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');

-- race_don_tableau_cellule : 84 ligne(s)
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 1, 1, 'Potentiel illimité', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 1, 2, '1AP/1AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 1, 3, '5% parmi les autres', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 1, 4, 'Au choix parmi les autres', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 2, 1, 'Sang', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 2, 2, '4AP/0AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 2, 3, '5% Athlétisme', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 2, 4, 'Saignement', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 3, 1, 'Arcane', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 3, 2, '0AP/4AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 3, 3, '5% Psychologie', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 3, 4, 'Surcharge magique', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 4, 1, 'Corruption', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 4, 2, '0AP/4AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 4, 3, '5% Manipulation', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 4, 4, 'Surcharge magique', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 5, 1, 'Temps/Espace', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 5, 2, '1AP/3AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 5, 3, '5% Connaissance', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 5, 4, 'Fatigue', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 6, 1, 'Vide', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 6, 2, '1AP/3AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 6, 3, '5% Fermeté', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 6, 4, 'Enragé', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 7, 1, 'Nécromancie', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 7, 2, '3AP/1AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 7, 3, '5% Vigueur', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 7, 4, 'Poison', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 8, 1, 'Feu', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 8, 2, '4AP/0AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 8, 3, '5% Intimidation', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 8, 4, 'Brûlure', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 9, 1, 'Eau', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 9, 2, '1AP/3AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 9, 3, '5% Diplomatie', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 9, 4, 'Confusion', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 10, 1, 'Glace', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 10, 2, '0AP/4AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 10, 3, '5% Calme', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 10, 4, 'Gel', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 11, 1, '*Vent', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 11, 2, '2AP/2AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 11, 3, '5% Ruse', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 11, 4, 'Surdité', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 12, 1, 'Foudre', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 12, 2, '3AP/1AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 12, 3, '5% Réflexe', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 12, 4, 'Paralysie', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 13, 1, '*Terre', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 13, 2, '4AP/2AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 13, 3, '5% Stabilité', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 13, 4, 'Pétrification', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 14, 1, 'Lumière', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 14, 2, '2AP/2AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 14, 3, '5% Observation', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 14, 4, 'Aveuglement', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 15, 1, 'Ombre', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 15, 2, '2AP/2AM', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 15, 3, '5% Sabotage', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/drakos', 15, 4, 'Peur', 'races', 'Les races › Drakos › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 1, 1, '- Mort par saignement
- Noyé dans le sang', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 1, 2, '- Résistance à la magie du Sang
- Vulnérabilité à la magie de la Nécromancie', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 2, 1, '- Mort par brisement d''os
- Mort par empoisonnement', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 2, 2, '- Résistance à la magie de la Nécromancie
- Vulnérabilité à la magie du Sang', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 3, 1, '- Mort par vieillissement accéléré
- Mort proche d''une faille temporelle', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 3, 2, '- Résistance à la magie de l''Espace/Temps
- Vulnérabilité à la magie du Vide', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 4, 1, '- Mort proche d''une faille temporelle
- Mort par la folie', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 4, 2, '- Résistance à la magie du Vide
- Vulnérabilité à la magie de l''Espace/Temps', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 5, 1, '- Mort brûlé
- Mort dans le désert', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 5, 2, '- Résistance à la magie du Feu
- Vulnérabilité à la magie de la Glace', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 6, 1, '- Mort de froid
- Mort dans la neige', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 6, 2, '- Résistance à la magie de la Glace
- Vulnérabilité à la magie du Feu', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 7, 1, '- Mort noyé
- Mort près de l''eau/dans l''eau', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 7, 2, '- Résistance à la magie de l''Eau
- Vulnérabilité à la magie de la Foudre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 8, 1, '- Mort électrocuté
- Mort près d''un orage', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 8, 2, '- Résistance à la magie de la Foudre
- Vulnérabilité à la magie de l''Eau', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 9, 1, '- Mort en altitude
- Mort sourd', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 9, 2, '- Résistance à la magie du Vent
- Vulnérabilité à la magie de la Terre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 10, 1, '- Mort enterré vivant
- Mort pétrifié', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 10, 2, '- Résistance à la magie de la Terre
- Vulnérabilité à la magie du Vent', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 11, 1, '- Mort au soleil
- Mort aveuglé', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 11, 2, '- Résistance à la magie de la Lumière
- Vulnérabilité à la magie de l''Ombre', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 12, 1, '- Mort à la lune
- Mort par trahison', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');
INSERT INTO race_don_tableau_cellule (race_id, ligne, colonne, valeur, origine, source_ref) VALUES ('races/mort-vivant', 12, 2, '- Résistance à la magie de l''Ombre
- Vulnérabilité à la magie de la Lumière', 'races', 'Les races › Mort-vivant › Don R (Race), tableau');

-- race_magie_onglet : 44 ligne(s)
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/anansi', 'magies/magie-de-larcane', 1, 'Arcane', 'races', 'Les races › Anansi › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/anansi', 'magies/magie-de-lombre', 2, 'Ombre', 'races', 'Les races › Anansi › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/anansi', 'magies/magie-de-la-necromancie', 3, 'Nécromancie', 'races', 'Les races › Anansi › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/fenrir', 'magies/magie-de-la-glace', 1, 'Glace', 'races', 'Les races › Fenrir › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/fenrir', 'magies/magie-de-lombre', 2, 'Ombre', 'races', 'Les races › Fenrir › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/fenrir', 'magies/magie-de-la-foudre', 3, 'Foudre', 'races', 'Les races › Fenrir › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/goleois', 'magies/magie-de-la-glace', 1, 'Glace', 'races', 'Les races › Goleois › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/goleois', 'magies/magie-de-la-lumiere', 2, 'Lumière', 'races', 'Les races › Goleois › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/goleois', 'magies/magie-du-sang', 3, 'Sang', 'races', 'Les races › Goleois › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/jackalope', 'magies/magie-de-la-terre', 1, 'Terre', 'races', 'Les races › Jackalope › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/jackalope', 'magies/magie-de-la-foudre', 2, 'Foudre', 'races', 'Les races › Jackalope › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/jackalope', 'magies/magie-du-vide', 3, 'Vide', 'races', 'Les races › Jackalope › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/kitsune', 'magies/magie-du-feu', 1, 'Feu', 'races', 'Les races › Kitsune › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/kitsune', 'magies/magie-du-vent', 2, 'Vent', 'races', 'Les races › Kitsune › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/kitsune', 'magies/magie-de-la-lumiere', 3, 'Lumière', 'races', 'Les races › Kitsune › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/marcass', 'magies/magie-de-la-terre', 1, 'Terre', 'races', 'Les races › Marcass › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/marcass', 'magies/magie-du-feu', 2, 'Feu', 'races', 'Les races › Marcass › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/marcass', 'magies/magie-de-la-necromancie', 3, 'Nécromancie', 'races', 'Les races › Marcass › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/medusain', 'magies/magie-de-leau', 1, 'Eau', 'races', 'Les races › Médusain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/medusain', 'magies/magie-de-la-lumiere', 2, 'Lumière', 'races', 'Les races › Médusain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/medusain', 'magies/magie-de-la-foudre', 3, 'Foudre', 'races', 'Les races › Médusain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/minotaure', 'magies/magie-du-sang', 1, 'Sang', 'races', 'Les races › Minotaure › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/minotaure', 'magies/magie-de-lombre', 2, 'Ombre', 'races', 'Les races › Minotaure › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/minotaure', 'magies/magie-de-la-terre', 3, 'Terre', 'races', 'Les races › Minotaure › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/nain', 'magies/magie-du-feu', 1, 'Feu', 'races', 'Les races › Nain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/nain', 'magies/magie-de-la-terre', 2, 'Terre', 'races', 'Les races › Nain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/nain', 'magies/magie-de-la-foudre', 3, 'Foudre', 'races', 'Les races › Nain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/nain', 'magies/magie-de-larcane', 4, 'Arcane', 'races', 'Les races › Nain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/nain', 'magies/potentiel-illimite', 5, 'Potentiel Illimité', 'races', 'Les races › Nain › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/namazu', 'magies/magie-de-leau', 1, 'Eau', 'races', 'Les races › Namazus › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/namazu', 'magies/magie-de-lombre', 2, 'Ombre', 'races', 'Les races › Namazus › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/namazu', 'magies/magie-du-sang', 3, 'Sang', 'races', 'Les races › Namazus › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/olwman', 'magies/magie-du-vent', 1, 'Vent', 'races', 'Les races › Olwman › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/olwman', 'magies/magie-de-lombre', 2, 'Ombre', 'races', 'Les races › Olwman › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/olwman', 'magies/magie-de-lespace-temps', 3, 'Espace/Temps', 'races', 'Les races › Olwman › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/orios', 'magies/magie-de-la-terre', 1, 'Terre', 'races', 'Les races › Orios › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/orios', 'magies/magie-de-leau', 2, 'Eau', 'races', 'Les races › Orios › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/orios', 'magies/magie-du-sang', 3, 'Sang', 'races', 'Les races › Orios › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/rokh', 'magies/magie-du-vent', 1, 'Vent', 'races', 'Les races › Rokh › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/rokh', 'magies/magie-de-la-foudre', 2, 'Foudre', 'races', 'Les races › Rokh › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/rokh', 'magies/magie-de-la-lumiere', 3, 'Lumière', 'races', 'Les races › Rokh › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/satyre', 'magies/magie-de-la-terre', 1, 'Terre', 'races', 'Les races › Satyre › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/satyre', 'magies/magie-de-la-foudre', 2, 'Foudre', 'races', 'Les races › Satyre › Inconvénient(s)');
INSERT INTO race_magie_onglet (race_id, magie_id, rang, nom_brut, origine, source_ref) VALUES ('races/satyre', 'magies/magie-du-feu', 3, 'Feu', 'races', 'Les races › Satyre › Inconvénient(s)');

-- mode_hyper_effet : 27 ligne(s)
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/anansi', 'onglet_race', 'race', 26, 'Anansi', NULL, NULL, 'races/anansi', NULL, NULL, 'Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière à la cible | Nécromancie= Inflige Poison 1 automatiquement | Ombre = Réduit de 5 l''initiative de la cible touchée pour le prochain tour', NULL, 'races', 'Les races › Anansi › Capacité Mode Hyper', NULL, 'Toile suprême');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/drakos', 'onglet_race', 'race', 11, 'Drakos', NULL, NULL, 'races/drakos', NULL, NULL, '(Action) Permet une attaque de souffle de l''élément de la magie innée, inflige 3d6/NPM dégâts et possède une portée de 4. Elle ne bénéficie pas des boosts de dégâts donnés par le mode hyper ou autre (mais est influencée par les postures). Demande un jet qui est choisi entre toutes les compétences d''attaques disponibles.', NULL, 'races', 'Les races › Drakos › Capacité Mode Hyper', NULL, 'Souffle de l''aîné');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/drassahthac', 'onglet_race', 'race', 14, 'Drassah''thac', NULL, NULL, 'races/drassahthac', NULL, NULL, 'Permet de relancer un jet de dés (alliés, ennemis, soi-même), peu importe la nature (2 fois/Mode Hyper).', NULL, 'races', 'Les races › Drassah''thac › Capacité Mode Hyper', NULL, 'Super Chance');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/elfe-argente', 'onglet_race', 'race', 4, 'Elfe Argenté', NULL, NULL, 'races/elfe-argente', NULL, NULL, 'Tous les sortilèges d''attaques sont imparables.', NULL, 'races', 'Les races › Elfe Argenté › Capacité Mode Hyper', NULL, 'Sang argenté');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/elfe-dore', 'onglet_race', 'race', 5, 'Elfe Doré', NULL, NULL, 'races/elfe-dore', NULL, NULL, 'Les sorts infligent un stade au-dessus de leur altération d''état.', NULL, 'races', 'Les races › Elfe Doré › Capacité Mode Hyper', NULL, 'Sang altérant');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/elfe-forestier', 'onglet_race', 'race', 2, 'Elfe forestier', NULL, NULL, 'races/elfe-forestier', NULL, NULL, 'Chaque test d''Agilité se fait à 95% et impossible d''imposer de malus dessus.', NULL, 'races', 'Les races › Elfe forestier › Capacité Mode Hyper', NULL, 'Souplesse Elfique');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/elfe-noir', 'onglet_race', 'race', 3, 'Elfe Noir', NULL, NULL, 'races/elfe-noir', NULL, NULL, 'Permet de synthétiser un poison unique sur l''arme principale, inflige "poison 1" pendant tout le mode hyper. L''ennemi doit faire un jet de vigueur tous les débuts de tour pour ne pas encaisser les dégâts.', NULL, 'races', 'Les races › Elfe Noir › Capacité Mode Hyper', NULL, 'Sang du condamné');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/farfadet', 'onglet_race', 'race', 6, 'Farfadet', NULL, NULL, 'races/farfadet', NULL, NULL, 'Permet d''avoir accès à tous les sorts de votre/vos magies, qui correspond à votre niveau puissance magique et inférieur.', NULL, 'races', 'Les races › Farfadet › Capacité Mode Hyper', NULL, 'Mémoire infinie');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/felfe', 'onglet_race', 'race', 7, 'Felfe', NULL, NULL, 'races/felfe', NULL, NULL, 'Peut voler, les dégâts et soins magiques sont augmentés de 2d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2.', NULL, 'races', 'Les races › Felfe › Capacité Mode Hyper', NULL, 'Surpuissance magique');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/fenrir', 'onglet_race', 'race', 15, 'Fenrir', NULL, NULL, 'races/fenrir', NULL, NULL, 'Chaque test de Perception se fait à 95% et impossible d''imposer de malus dessus, impossible de prendre d''attaques surprises, cachées ou sournoises.', NULL, 'races', 'Les races › Fenrir › Capacité Mode Hyper', NULL, 'Truffe ultime');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/goleois', 'onglet_race', 'race', 27, 'Goleois', NULL, NULL, 'races/goleois', NULL, NULL, 'Augmente les dégâts de tous les alliés de 5, le temps du mode hyper.', NULL, 'races', 'Les races › Goleois › Capacité Mode Hyper', NULL, 'Digne chef');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/hujin', 'onglet_race', 'race', 10, 'Hujin', NULL, NULL, 'races/hujin', NULL, NULL, 'Diminue d''un cran les dés des attaques physiques ou magiques subies', NULL, 'races', 'Les races › Hujin › Capacité Mode Hyper', NULL, 'Gomme à mâcher');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/humain', 'onglet_race', 'race', 1, 'Humain', NULL, NULL, 'races/humain', NULL, NULL, '1d de dégâts en plus pour toutes les attaques produites, +2 à la Vitesse et les altérations d''états "peur", "fatigue" et "couardise" ne fonctionnent pas."', NULL, 'races', 'Les races › Humain › Capacité Mode Hyper', NULL, 'Adrénaline');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/jackalope', 'onglet_race', 'race', 24, 'Jackalope', NULL, NULL, 'races/jackalope', NULL, NULL, '+3 Vitesse', NULL, 'races', 'Les races › Jackalope › Capacité Mode Hyper', NULL, 'Super Vitesse');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/kitsune', 'onglet_race', 'race', 16, 'Kitsune', NULL, NULL, 'races/kitsune', NULL, NULL, 'Choisit quand il commence le tour de jeu.', NULL, 'races', 'Les races › Kitsune › Capacité Mode Hyper', NULL, 'Prioritaire');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/lamia', 'onglet_race', 'race', 23, 'Lamia', NULL, NULL, 'races/lamia', NULL, NULL, '(Action) Permet de cracher un venin à 3PO qui est capable d''empoisonné 2 et de paralysé 2 pendant 3 tours, oblige 2 jets de vigueur pour résister aux deux effets.', NULL, 'races', 'Les races › Lamia › Capacité Mode Hyper', NULL, 'Jet de Venin');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/majin', 'onglet_race', 'race', 9, 'Majin', NULL, NULL, 'races/majin', NULL, NULL, 'La portée des attaques augmente de 2.', NULL, 'races', 'Les races › Majin › Capacité Mode Hyper', NULL, 'Grande élasticité');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/marcass', 'onglet_race', 'race', 25, 'Marcass', NULL, NULL, 'races/marcass', NULL, NULL, 'Les AP et AM naturels s’ajoutent à toute réduction de dégâts, quel que soit le type d’attaque.', NULL, 'races', 'Les races › Marcass › Capacité Mode Hyper', NULL, 'Corps isolant');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/medusain', 'onglet_race', 'race', 22, 'Médusain', NULL, NULL, 'races/medusain', NULL, NULL, 'Chaque attaque physique va se suivre d''un tentacule qui touche la cible et lui inflige l''altération d''état malgré la protection.', NULL, 'races', 'Les races › Médusain › Capacité Mode Hyper', NULL, 'Méga tentacule');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/minotaure', 'onglet_race', 'race', 20, 'Minotaure', NULL, NULL, 'races/minotaure', NULL, NULL, 'Les coups avec les cornes ou sabots infligent 20% de la santé actuelle à la cible (une seule fois par mode hyper).', NULL, 'races', 'Les races › Minotaure › Capacité Mode Hyper', NULL, 'Mégacorne');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/mort-vivant', 'onglet_race', 'race', 12, 'Mort-vivant', NULL, NULL, 'races/mort-vivant', NULL, NULL, 'Régénère 20% de santé au début de son tour.', NULL, 'races', 'Les races › Mort-vivant › Capacité Mode Hyper', NULL, 'Super santé');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/nain', 'onglet_race', 'race', 8, 'Nain', NULL, NULL, 'races/nain', NULL, NULL, '2d de dégâts physiques en plus. Le sort malédiction ne marche pas.', NULL, 'races', 'Les races › Nain › Capacité Mode Hyper', NULL, 'Petit mais costaud');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/namazu', 'onglet_race', 'race', 19, 'Namazus', NULL, NULL, 'races/namazu', NULL, NULL, 'La prochaine attaque avec une arme inflige "saignement 1" pendant tout le mode hyper. L''ennemi doit faire un jet de vigueur tous les débuts de tour pour ne pas encaisser les dégâts.', NULL, 'races', 'Les races › Namazus › Capacité Mode Hyper', NULL, 'Saignement de la mer');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/olwman', 'onglet_race', 'race', 17, 'Olwman', NULL, NULL, 'races/olwman', NULL, NULL, 'Peut se déplacer gratuitement de 2 cases et ce n''importe quand durant le tour. (1 fois par tour)', NULL, 'races', 'Les races › Olwman › Capacité Mode Hyper', NULL, 'Déplacement fluide');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/orios', 'onglet_race', 'race', 13, 'Orios', NULL, NULL, 'races/orios', NULL, NULL, 'Chaque test de Force se fait à 95% et impossible d''imposer de malus dessus, immunisé aux peurs.', NULL, 'races', 'Les races › Orios › Capacité Mode Hyper', NULL, 'Force de l''Ours');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/rokh', 'onglet_race', 'race', 18, 'Rokh', NULL, NULL, 'races/rokh', NULL, NULL, 'Chaque attaque physique ou magique se suit d''un appel d''une [Élément Innée] blanche [dégâts non élémentaires] qui inflige +1dx* de dégâts en plus. *le dégât est calqué sur le dégâts de l''arme ou du sort utilisé', NULL, 'races', 'Les races › Rokh › Capacité Mode Hyper', NULL, 'Colère du ciel');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/satyre', 'onglet_race', 'race', 21, 'Satyre', NULL, NULL, 'races/satyre', NULL, NULL, 'Impose un malus de 10% (augmente de 5% au niveau 10 global) à tous les jets des ennemis dans un rayon de 5 cases ou moins.', NULL, 'races', 'Les races › Satyre › Capacité Mode Hyper', NULL, 'Laine entravante');

-- page_entite : 70 ligne(s)
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/anansi#don:arcane-en-innee', 'races/anansi', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/anansi#don:necromancie-en-innee', 'races/anansi', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/anansi#don:ombre-en-innee', 'races/anansi', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/drassahthac#don:drassahthac-est', 'races/drassahthac', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/drassahthac#don:drassahthac-ouest', 'races/drassahthac', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/drassahthac#don:drassahthac-nord', 'races/drassahthac', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/drassahthac#don:drassahthac-sud', 'races/drassahthac', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/drassahthac#don:drassahthac-centre', 'races/drassahthac', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-argente#don:territoire-elfes-argentes', 'races/elfe-argente', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-argente#don:barrage-argente', 'races/elfe-argente', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-argente#don:ailleurs', 'races/elfe-argente', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-dore#don:sang-dore', 'races/elfe-dore', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-forestier#don:foret-ou-les-villes-des-territoires-elfe-forestier', 'races/elfe-forestier', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-forestier#don:urbain-tout-le-reste', 'races/elfe-forestier', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-noir#don:elfe-charbon', 'races/elfe-noir', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/elfe-noir#don:elfe-sale', 'races/elfe-noir', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/farfadet#don:farfadet-median-forets-temperees-centraux', 'races/farfadet', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/farfadet#don:farfadet-maritime-forets-proches-de-leau', 'races/farfadet', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/farfadet#don:farfadet-amazone-jungle', 'races/farfadet', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/farfadet#don:farfadet-alpin-forets-montagneuses-taiga', 'races/farfadet', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/felfe#don:felfe-forestier', 'races/felfe', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/felfe#don:felfe-noir', 'races/felfe', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/felfe#don:felfe-argente', 'races/felfe', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/fenrir#don:glace-en-innee', 'races/fenrir', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/fenrir#don:foudre-en-innee', 'races/fenrir', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/fenrir#don:ombre-en-innee', 'races/fenrir', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/goleois#don:glace-en-innee', 'races/goleois', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/goleois#don:lumiere-en-innee', 'races/goleois', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/goleois#don:sang-en-innee', 'races/goleois', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/hujin#don:elasticite', 'races/hujin', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/humain#don:humain-central', 'races/humain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/humain#don:humain-desertique', 'races/humain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/humain#don:humain-tropical', 'races/humain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/humain#don:humain-toundra', 'races/humain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/jackalope#don:terre-en-innee', 'races/jackalope', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/jackalope#don:foudre-en-innee', 'races/jackalope', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/jackalope#don:vide-en-innee', 'races/jackalope', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/kitsune#don:feu-en-innee', 'races/kitsune', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/kitsune#don:vent-en-innee', 'races/kitsune', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/kitsune#don:lumiere-en-innee', 'races/kitsune', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/lamia#don:ecaille-solide', 'races/lamia', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/majin#don:renfermement', 'races/majin', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/marcass#don:terre-en-innee', 'races/marcass', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/marcass#don:feu-en-innee', 'races/marcass', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/marcass#don:necromancie-en-innee', 'races/marcass', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/medusain#don:eau-en-innee', 'races/medusain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/medusain#don:foudre-en-innee', 'races/medusain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/medusain#don:lumiere-en-innee', 'races/medusain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/minotaure#don:sang-en-innee', 'races/minotaure', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/minotaure#don:ombre-en-innee', 'races/minotaure', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/minotaure#don:terre-en-innee', 'races/minotaure', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/mort-vivant#don:trompe-mort', 'races/mort-vivant', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/nain#don:londolor-est', 'races/nain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/nain#don:londolor-ouest', 'races/nain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/nain#don:londolor-centre-ligne-de-partage', 'races/nain', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/namazu#don:sang-en-innee', 'races/namazu', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/namazu#don:ombre-en-innee', 'races/namazu', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/namazu#don:eau-en-innee', 'races/namazu', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/olwman#don:espace-temps-en-innee', 'races/olwman', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/olwman#don:vent-en-innee', 'races/olwman', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/olwman#don:ombre-en-innee', 'races/olwman', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/orios#don:sang-en-innee', 'races/orios', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/orios#don:terre-en-innee', 'races/orios', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/orios#don:eau-en-innee', 'races/orios', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/rokh#don:vent-en-innee', 'races/rokh', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/rokh#don:foudre-en-innee', 'races/rokh', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/rokh#don:lumiere-en-innee', 'races/rokh', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/satyre#don:terre-en-innee', 'races/satyre', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/satyre#don:foudre-en-innee', 'races/satyre', 0, 'races');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/satyre#don:feu-en-innee', 'races/satyre', 0, 'races');

-- note_cellule : 3 ligne(s)
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:eau-en-innee', 1, 'texte', 'O30', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O30');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:foudre-en-innee', 1, 'texte', 'O34', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O34');
INSERT INTO note_cellule (entite_table, entite_id, rang, champ, cellule, nature, repond_a, texte, origine, source_ref) VALUES ('race_don', 'races/medusain#don:lumiere-en-innee', 1, 'texte', 'O38', 'note', NULL, 'Jet de vigueur pour esquiver l''altération d''état', 'races', 'Les races › Médusain › O38');

-- 0056-glossaire-et-panneaux-de-regles : les mots-clés deviennent un glossaire, et les règles en tête des onglets de /ressources/equipement/ deviennent
-- des panneaux modifiables (demandes du propriétaire du 2026-10-16). Migration de STRUCTURE et de DONNÉES.
--   1. Glossaire (refonte complète des mots-clés) : un mot-clé est une entrée de glossaire, son id, son texte (libellé) et une description ; dans
--      les textes, une balise explicite le met en gras avec sa définition en infobulle, une seconde l'écrit en « mode complet » (nom et définition
--      séparés d'un « : »). Réponses du propriétaire : marquage explicite, jamais de repérage automatique ; sur tout le site ; les mots-clés actuels
--      sont retirés des pages. Syntaxe (rendue par le site) : « {{id}} » (gras et infobulle), « {{id|texte}} » (un autre texte affiché), « {{id:}} »
--      (mode complet) ; ce ne sont pas des clés étrangères (data/schema.sql, commentaire de mot_cle).
--      * Structure : mot_cle.description (TEXT, NULL ou non vide, en dernier : la définition, texte simple ; NULL = pas encore décrit, convention
--        « absent = NULL ») ; la vue v_mot_cle la donne (refaite, la colonne en dernier).
--      * Données : le vocabulaire ne garde que les mots-clés dont le site se sert pour ranger ses pages (client/src/lib/mots-cles.mjs#MOTS_CLES_PROTEGES :
--        cac, distance, magique, hybride, hybride-animal, speciale, race-hybride (pas encore dans la base), capacite-de-classe, classe, race, metier,
--        codex) et ceux du glossaire. Les autres (400 sur 412) quittent les pages puis le vocabulaire : page_tag d'abord, parce que migrer()
--        (tools/db/maverick.py) exécute la migration clés étrangères coupées (PRAGMA foreign_keys = OFF) : le ON DELETE CASCADE de page_tag ne
--        jouerait pas, et ses lignes resteraient orphelines (foreign_key_check refuserait la migration). Les ordres des autres lignes ne changent
--        pas (un trou reste). « demi-épée » part avec eux (la définition de Mordhau le nomme). Leurs ids pourront resservir (data/schema.sql).
--      * Glossaire : « mordhau » (gardé avec sa page, guide/situations-avancees ; libellé « Mordhau ») reçoit un RÉSUMÉ du texte de la page « Armes »
--        (« *Mordhau ou Demi-épée* = C'est un terme utilisé pour désigner une méthode de combat […] votre arme perd immédiatement un cran de
--        solidité. ») : demande du propriétaire, « il faudra résumer le texte du Mordhau inutilement trop long » ; rien n'y est ajouté ni déduit
--        (résumé relu par gardien-des-regles ; l'exemple reste un exemple). Deux mots-clés créés, leur définition copiée de la même page sans
--        les astérisques : « Recharge longue », « Recharge très longue ». Les 11 autres mots-clés gardés n'ont pas de définition (NULL).
--      Les importeurs ne créent plus de mot-clé (tools/db/maverick.py#mot_cle) : le vocabulaire est celui du site de dev.
--   2. Panneaux de règles : plus de chapeau (la première phrase répétée au-dessus du panneau replié) ; le titre et le contenu du panneau se modifient
--      sur le site de dev ; le contenu peut comprendre des tuiles génériques, insérables et modifiables en mode modification ; pour les armes, en
--      tuiles : les définitions de Recharge longue, Recharge très longue, Mordhau, et les cas particuliers Dague et Arme de jet.
--      * Structure : panneau_regles (un par onglet : son id est l'ancre de l'onglet, son titre, la page dont le texte se lit) et panneau_regles_bloc (ses
--        blocs dans l'ordre de lecture : du texte, ou une tuile au titre facultatif ; Markdown des pages, balises du glossaire comprises).
--      * Données : le texte des blocs est COPIÉ tel quel (espaces doubles compris, et les deux espaces d'un retour à la ligne forcé, écrits avant
--        « || char(10) ») des règles que le site affichait, tirées du corps de la page par client/src/lib/armes-db.mjs#reglesDeLaPage (introduction
--        et prix), armures-db.mjs#reglesDeLaPage (Armures, Bouclier), batons-db.mjs (introduction, fabrication) et accessoires-db.mjs#reglesDeLaPage ;
--        chaque texte se lit mot pour mot dans page.corps_md, qui ne change pas (la trace de l'import, pour la recherche) ; celui des Armures est
--        donc celui d'après la migration 0055 (décision R95, « Suppression de la création par pièces » : ses paragraphes sur la fabrication des
--        morceaux d'armure ne sont plus dans le corps de la page). Seuls les titres des
--        panneaux et des tuiles sont écrits ici : ceux des tuiles sont les intitulés de la page (« **Dague** », « **Arme de jet** », « ## COMMENT
--        DÉTERMINER LE PRIX DE VOTRE ARME ? », « ## COMMENT FABRIQUER UN BÂTON MAGIQUE ? »), en minuscules. Les tuiles Recharge longue, Recharge
--        très longue et Mordhau ne sont que la balise du mot-clé en mode complet (« {{recharge-longue:}} ») : la définition vit dans le glossaire.
--   3. Notes de version : la contrainte de note_version_ligne.domaine admet 'equipement' (les panneaux de règles). SQLite ne modifie pas une
--      contrainte : la table est refaite à l'identique, ses lignes recopiées (comme 0043, 0046).
-- Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev (aucune ligne de l'historique ne cite mot_cle ni
-- page_tag aujourd'hui).

-- 1. Glossaire ----------------------------------------------------------------------------------------------------------------------------------------

ALTER TABLE mot_cle ADD COLUMN description TEXT CHECK (description IS NULL OR length(description) > 0);

DELETE FROM page_tag WHERE tag_id IN (
  SELECT id FROM mot_cle WHERE libelle_cle NOT IN ('cac', 'distance', 'magique', 'hybride', 'hybride-animal', 'speciale', 'race-hybride',
    'capacite-de-classe', 'classe', 'race', 'metier', 'codex', 'mordhau'));

DELETE FROM mot_cle WHERE libelle_cle NOT IN ('cac', 'distance', 'magique', 'hybride', 'hybride-animal', 'speciale', 'race-hybride',
  'capacite-de-classe', 'classe', 'race', 'metier', 'codex', 'mordhau');

UPDATE mot_cle SET libelle = 'Mordhau',
  description = 'Ou demi-épée. Avec certaines armes de corps à corps (notamment les épées), prendre l''arme par la lame et frapper avec le manche. '
    || 'Elle peut ainsi faire des dégâts de frappe alors qu''elle en est incapable, mais a 30 % de chance de perdre un cran de solidité '
    || '(exemple : plus de 70 au jet d''attaque).'
WHERE id = 'mordhau';

INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES
  ('recharge-longue', 'Recharge longue', 'recharge-longue', 'Doit utiliser son action ou son mouvement pour recharger.'),
  ('recharge-tres-longue', 'Recharge très longue', 'recharge-tres-longue', 'Doit utiliser son action ET son mouvement pour recharger.');

DROP VIEW v_mot_cle;
CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.libelle_cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description
  FROM mot_cle m;

-- 2. Panneaux de règles -------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE panneau_regles (
  id      TEXT NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-'),
  titre   TEXT NOT NULL CHECK (length(titre) > 0),
  page_id TEXT NOT NULL REFERENCES page(id)
) STRICT;

CREATE INDEX panneau_regles_page_fk ON panneau_regles (page_id);

CREATE TABLE panneau_regles_bloc (
  panneau_id TEXT    NOT NULL REFERENCES panneau_regles(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  ordre      INTEGER NOT NULL CHECK (ordre >= 1),
  tuile      INTEGER NOT NULL CHECK (tuile IN (0, 1)),
  titre      TEXT    CHECK (titre IS NULL OR length(titre) > 0),
  texte      TEXT    NOT NULL CHECK (length(texte) > 0),
  PRIMARY KEY (panneau_id, rang),
  CHECK (tuile = 1 OR titre IS NULL)
) STRICT, WITHOUT ROWID;

CREATE INDEX panneau_regles_bloc_ordre ON panneau_regles_bloc (panneau_id, ordre);

INSERT INTO panneau_regles (id, titre, page_id) VALUES
  ('armes', 'Règles des armes : fabrication, recharge, mordhau, cas particuliers, prix', 'ressources/armes'),
  ('armures', 'Règles des armures : matériaux, pièces, solidité, améliorations', 'ressources/armures'),
  ('boucliers', 'Règles des boucliers : classes, matériaux, poids, améliorations', 'ressources/bouclier'),
  ('batons-magiques', 'Règles des bâtons magiques : port, cumul, fabrication', 'ressources/baton-magique'),
  ('accessoires', 'Règles des accessoires : prix, malédiction, montures, qualité des gemmes', 'ressources/accessoires');

-- Les blocs : rang = ordre = la place de lecture ; une ligne du texte par ligne du fichier, les retours à la ligne en char(10) : les deux espaces
-- d'un retour à la ligne forcé restent ainsi dans la chaîne, avant « ' || char(10) », et la migration n'a pas d'espace en fin de ligne (qu'un
-- éditeur retirerait).
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 1, 1, 0, NULL,
  'Toutes les armes ont de base 2 crans de solidité,  les armes de corps à corps non spécifiées n''ont que 1 de portée' || char(10) || char(10) ||
  'Pour fabriquer une arme, il faut avoir un lingot , un peu de bois, un fourneau, une enclume et être le métier forgeron (le métier n''est pas obligatoire mais il est recommandé car il permet d''esquiver un énorme malus de 40% à la fabrication). Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.' || char(10) || char(10) ||
  'Pour recycler ou reforger une arme, le métier de forgeron est INDISPENSABLE.' || char(10) || char(10) ||
  'Le matériel choisi peut donner des bonus mais aussi le type d''arme forgée, tous les bonus se cumulent une fois l''arme forgée (exemple : Une claymore en cuivre donne un bonus aux dégâts de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5 aux dégâts)');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 2, 2, 1, NULL,
  '{{recharge-longue:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 3, 3, 1, NULL,
  '{{recharge-tres-longue:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 4, 4, 1, NULL,
  '{{mordhau:}}');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 5, 5, 0, NULL,
  '**Les armes en bleu sont les armes possibles en arme de départ.**' || char(10) || char(10) ||
  '***CAS PARTICULIERS :***');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 6, 6, 1, 'Dague',
  '- Divise par 2 le malus de l''ambidextrie avec ces armes, ce qui veut dire que si une dague est dans un lot d''ambidextrie, son malus sera de 10% si première arme et 20% si deuxième arme (contre 20% et 40%. Et bien entendu la division fonctionne en combinaison avec le bimane = donc 5% et 10% si on cumule les deux). Si vous utilisez une autre arme qu''une dague en ambidextrie, la dague elle aura cette règle appliquée mais pas l''autre arme.' || char(10) || char(10) ||
  '- Un coup réussi à la dague impose un malus de 10% à la défense de l''adversaire (sauf la lame secrète qui lui inflige 20%).');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 7, 7, 1, 'Arme de jet',
  '- Permettre de lancer 2 armes de jet en échange du déplacement et action (ou utiliser 2 fois la fronde).');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armes', 8, 8, 1, 'Comment déterminer le prix de votre arme ?',
  '1 Matériau + Le coût de l''arme + Particularité de l''arme = PRIX FINAL');

INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('armures', 1, 1, 0, NULL,
  'Une armure a besoin de 2 matériaux pour être fabriquée, des combinaisons sont donc possibles. Lors de la fabrication, les bonus donnés par un matériau s''ajoutent au deuxième (cuir + cuir = 4AP; Écailles + Bois = 8AP + 1AM)' || char(10) || char(10) ||
  'Les armures uniformes ont leur catégorie la plus lourde.' || char(10) || char(10) ||
  'Solidité : Nombre de mauvais coups qui peuvent être encaissés avant destruction.' || char(10) || char(10) ||
  'Les Armes et Armures uniques ont 1 cran de solidité bonus.' || char(10) || char(10) ||
  'Pour améliorer une arme ou armure, il faut faire toutes les étapes une à une, il n''est pas possible de sauter une étape.' || char(10) || char(10) ||
  '\*Cran de solidité uni = Si un cran de solidité est perdu, c''est TOUTE l''armure qui est abimée.' || char(10) || char(10) ||
  'Pour les Armures spécifiques, leur bonus de compétences repose sur le fait que l''armure a tous les morceaux, perdre un seul morceau de l''armure, le bonus compétence ne marche plus.');

INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('boucliers', 1, 1, 0, NULL,
  'Un bouclier a besoin d''autant de matériaux que sa classe indique (classe 4 = 4 matériaux) et bien entendu les bonus (sauf solidité) s''additionnent entre les matériaux.' || char(10) || char(10) ||
  'Les matériaux n''ont pas les mêmes stats pour les boucliers par rapport aux armures.' || char(10) || char(10) ||
  'Solidité : Nombre de mauvais coups qui être encaissé avant destruction.' || char(10) || char(10) ||
  'Pour améliorer une arme ou armure, il faut faire toutes les étapes une à une, il n''est pas possible de sauter une étape.' || char(10) || char(10) ||
  'Il existe 4 poids différents pour les boucliers, il est nécessaire d''avoir le score de Force ou plus pour le porter.' || char(10) || char(10) ||
  'Pour fabriquer un matériau, un jet de FORCE + INTELLIGENCE est nécessaire.' || char(10) || char(10) ||
  'Alors la question que vous pourriez poser c''est : »Mais du coup, vu qu''on peut mettre plusieurs matériaux dans les boucliers (sauf le bocle) est-ce qu''on mettre un peu tous les matériaux qu''on veut ? »  ' || char(10) ||
  'Pour répondre c''est oui et non :' || char(10) || char(10) ||
  '- Oui, il est possible de mélanger les matériaux pour faire des boucliers un peu uniques.' || char(10) ||
  '- Non, vous ne pouvez pas faire non plus n’importe quoi, il n''est pas possible de faire un bouclier avec plus de 3 matériaux différents. Donc les Écus et les pavois doivent avoir 3 matériaux maximum différents sinon ça ne marche pas.');

INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('batons-magiques', 1, 1, 0, NULL,
  'Les bâtons magiques sont des petits bâtons de bois sur lesquels se trouve une gemme précieuse sur le bout. Ces gemmes sont liées à des magies et donnent des bonus passifs pour les sorts. Il y a pas de limite magique pour les porter (un utilisateur du feu peut porter à sa ceinture un bâton de vent)' || char(10) || char(10) ||
  'Ces objets peuvent être portés à la ceinture ou dans un emplacement d''arme pour que l''effet soit actif. Il n''est pas possible d''accumuler les bâtons magiques sur le même emplacement de ceinture ainsi que les mêmes effets même si c''est différents niveaux ou gemmes.  ' || char(10) ||
  'Exemple : Impossible de cumuler un bâton magique 1 feu et un bâton magique foudre 2 car ils amplifient la même chose.' || char(10) || char(10) ||
  'Le porteur agit ainsi comme une sorte de source d''énergie pour le bâton, sans ça, le bâton est inutilisable.');
INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('batons-magiques', 2, 2, 1, 'Comment fabriquer un bâton magique ?',
  'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge');

INSERT INTO panneau_regles_bloc (panneau_id, rang, ordre, tuile, titre, texte) VALUES ('accessoires', 1, 1, 0, NULL,
  'Les accessoires vierges de tout effet ont un coût de 100 Ro et leur effet est déterminé quand le porteur PORTE l''accessoire en question, bien entendu il y a une probabilité que l''accessoire aléatoire devienne moins cher.' || char(10) || char(10) ||
  'Les accessoires maudits ne peuvent pas être retirés que par un enchanteur auquel on ajoute le prix que l''accessoire devrait couter.' || char(10) || char(10) ||
  'Si une malédiction arrive, on relance l''accessoire et l''effet sera l''opposé de ce que ça devrait être.' || char(10) || char(10) ||
  'Un lingot permet de faire 2 montures d''anneau, 2 montures de collier, 2 montures de couronne, 2 montures de bracelets.' || char(10) || char(10) ||
  'Bien entendu il faut que la qualité de la gemme soit au rendez-vous pour pouvoir faire des accessoires plus puissants :' || char(10) || char(10) ||
  '- Gemme classique = Accessoire niveau 1 et 2' || char(10) ||
  '- Gemme raffinée = Accessoire niveau 3 et 4 (prix de la gemme raffinée = prix gemme classique x2 + 10 Ro)' || char(10) ||
  '- Gemme parfaite = Accessoire niveau 5 (prix de la gemme raffinée = prix gemme classique x4 + 30 Ro)' || char(10) || char(10) ||
  'Chaque accessoire possède des morceaux de gemmes, ce sont des quarts de gemmes qui sont utilisées.' || char(10) || char(10) ||
  'On ne peut pas avoir deux accessoires qui ont le même effet.' || char(10) || char(10) ||
  'Dans le cas d''une malédiction, on relance les dés au début des étapes et l''effet sera le contraire de ce qui est indiqué à la base (exemple : +1 force devient -1 force)');
-- 3. Notes de version ---------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE note_version_ligne_0056 (
  version     TEXT    NOT NULL REFERENCES note_version(version) ON DELETE CASCADE,
  rang        INTEGER NOT NULL CHECK (rang >= 1),                    -- ordre d'affichage
  domaine     TEXT    NOT NULL CHECK (domaine IN ('sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire', 'armes', 'composants', 'chronologie', 'mots-cles', 'armures', 'equipement')),
  groupe      TEXT    CHECK (groupe IS NULL OR length(groupe) > 0),
  entite      TEXT    NOT NULL CHECK (length(entite) > 0),
  champ       TEXT    CHECK (champ IS NULL OR length(champ) > 0),    -- libellé de la colonne (« Coût ») ; NULL : l'entité entière (ajoutée, retirée)
  nature      TEXT    NOT NULL CHECK (nature IN ('ajoute', 'retire', 'modifie')),
  avant       TEXT,
  apres       TEXT,
  sens        TEXT    NOT NULL CHECK (sens IN ('amelioration', 'affaiblissement', 'neutre')),
  parties     TEXT    CHECK (parties IS NULL OR (json_valid(parties) AND json_type(parties) = 'array')),
  table_nom   TEXT    CHECK (table_nom IS NULL OR (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*')),
  cle         TEXT    CHECK (cle IS NULL OR (json_valid(cle) AND json_type(cle) = 'object')),
  colonne     TEXT    CHECK (colonne IS NULL OR length(colonne) > 0),
  PRIMARY KEY (version, rang),
  CHECK (nature <> 'ajoute' OR avant IS NULL),                      -- ajouté : rien avant (l'entité, ou un champ qui n'existait pas)
  CHECK (nature <> 'retire' OR apres IS NULL),                      -- retiré : rien après
  CHECK (nature <> 'modifie' OR champ IS NOT NULL)                  -- modifié : un champ précis
) STRICT;

INSERT INTO note_version_ligne_0056 SELECT * FROM note_version_ligne;
DROP TABLE note_version_ligne;
ALTER TABLE note_version_ligne_0056 RENAME TO note_version_ligne;

-- 0006-orthographe-noms : correction des « noms à trancher » (décision du propriétaire, R10 complétée : « corriger en gardant le sens le plus probable ;
-- pour un nom propre écrit de plusieurs façons, la graphie majoritaire l'emporte »). Suite de 0003 (sorts et magies) et 0005 (toute la base).
-- Migration de STRUCTURE et de DONNÉES.
--   * Structure : les identifiants sont GELÉS (feuille de route : « une page renommée garde son identifiant »). Sept tables contraignaient l'id à
--     « préfixe || nom_cle » (sort, classe, invocation, invocation_capacite_commune, creature, creature_attaque, creature_capacite) : un nom corrigé y
--     aurait changé l'identifiant, donc l'adresse de la page et toutes les références. Ces tables sont reconstruites sans cette contrainte (même colonnes,
--     mêmes index, vues qui les lisent recréées à l'identique) ; l'id garde la clé du nom à l'import.
--   * Données : chaque nom est corrigé PARTOUT où il est écrit (titres, noms typés, textes, Markdown des pages, notes de cellule, cibles des [[liens]]),
--     mot entier et casse respectée, puis sa clé (`X_cle` = normalize(X)) est recalculée. Rien n'est touché dans les identifiants, les slugs, les tables
--     de trace (source, ecart_source, alias, étiquettes, commentaires orphelins), ni dans l'écriture de la source gardée comme trace
--     (accessoire_effet.gemmes_brut, accessoire_effet_gemme.nom_source, ethnie.race_brut, creature_capacite_sort.sort_nom_brut « Veilliessement »),
--     ni dans les citations « telles quelles » de la fiche V15.2.2 (tableaux des écarts des races).
-- Le détail (cellule, avant, après, nombre, nature, raison) et les clés recalculées sont dans 0006-orthographe-noms.json ; les noms gardés tels quels,
-- avec leur raison, dans docs/sql/orthographe-a-valider.md.

-- ----- Structure : identifiants gelés -----
DROP VIEW "v_capacite_exclusive";
DROP VIEW "v_classe_capacite";
DROP VIEW "v_creature_meme_bloc";
DROP VIEW "v_creature_cout_invocation";
DROP VIEW "v_creature_sort";
DROP VIEW "v_creature_resistance";
DROP VIEW "v_creature_magie";
CREATE TABLE sort__0006 (
  id                    TEXT    NOT NULL PRIMARY KEY,   -- '<magie.id>#sort:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006)
  magie_id              TEXT    NOT NULL REFERENCES magie(id),
  nom                   TEXT    NOT NULL CHECK (length(nom) > 0),               -- espaces insécables remplacés par des espaces (identifiant)
  nom_cle               TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),               -- normalize(nom) comme text.mjs : 'boule-de-sang' ; recherche d'un sort par son nom
  niveau                INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 5),   -- colonne « Niveau » : niveau de PUISSANCE du sort
                                                        -- (palier 1 à 5), à ne pas confondre avec le niveau de maîtrise (NM, 0 à 3)
  ordre                 INTEGER NOT NULL CHECK (ordre >= 1),   -- rang dans la table de l'onglet (1 à 23) ; l'ordre de lecture
  -- Type ------------------------------------------------------------------------------------------------------------
  type_brut             TEXT    NOT NULL,               -- « Amplification (IC pour 3 NM) », « Attaque\n(Imparable) »… tel qu'écrit
  ic_direct             INTEGER NOT NULL CHECK (ic_direct IN (0, 1)),   -- 1 = le type contient « (IC) » (Instant Cast, voir legende_sort)
  ic_nm_min             INTEGER CHECK (ic_nm_min BETWEEN 1 AND 3),      -- N de « IC pour N NM » : niveau de maîtrise qui rend le sort IC
  imparable             INTEGER NOT NULL CHECK (imparable IN (0, 1)),   -- le type contient « imparable » (insensible à la casse)
  inesquivable          INTEGER NOT NULL CHECK (inesquivable IN (0, 1)),   -- le type contient « inesquivable »
  -- Coût (colonne « Coût ») : le nombre seul est la consommation de chakra (guide/fiche-attributs : « La consommation de chakra
  -- est indiqué sur les sorts » ; « + 3 Sang » ajoute une consommation de la 4ème barre)
  cout_brut             TEXT    NOT NULL,               -- « 3 + 1 Sang », « 55 (-5/NM) », « X Sang », « Variable »…
  cout_chakra           INTEGER CHECK (cout_chakra >= 0),   -- partie chakra quand la forme est « N », « N (-k/NM) », « N + … Sang/âme(s) » ; sinon NULL
  cout_ressource        TEXT    CHECK (cout_ressource IN ('sang', 'ame')),   -- ressource de la 4ème barre citée dans le coût
  cout_ressource_valeur INTEGER CHECK (cout_ressource_valeur >= 0),          -- sa quantité ; NULL si « X » ou absente
  -- Portée (colonne « Portée »)
  portee_brut           TEXT    NOT NULL,               -- « 6 », « Soi même », « 5 (+1/NM) », « Vue »…
  portee_nature         TEXT    NOT NULL CHECK (portee_nature IN ('nombre', 'soi', 'vue', 'illimitee', 'variable', 'autre')),
  portee_valeur         INTEGER CHECK (portee_valeur >= 0),   -- valeur de base quand portee_nature = 'nombre' (unité non écrite dans la cellule :
                                                              -- des cases, cf. guide/vitesse-et-portee pour les armes)
  -- Zone (colonne « Zone »)
  zone_brut             TEXT    NOT NULL,               -- « 1 », « Cercle de 5 », « 3x1 », « Carré 4x4 », « Cône »…
  zone_forme            TEXT    NOT NULL CHECK (zone_forme IN ('unique', 'cercle', 'ligne', 'cone', 'carre', 'rectangle', 'croix',
                                                               'terrain', 'cibles', 'vue', 'variable', 'autre')),
                                                        -- 'unique' = « 1 » (une seule case/cible) ; 'rectangle' = « NxM » ou « Rectangle … » ;
                                                        -- 'autre' = texte non reconnu (voir zone_brut)
  zone_taille           INTEGER CHECK (zone_taille >= 0),   -- premier nombre de « Cercle de N », « Ligne de N », « Carré … N », « Croix de N », « N cibles »
  -- Dégâts / Soin / Bonus (colonne « D/S/B »)
  dsb_brut              TEXT,                           -- NULL quand la cellule vaut « / » (la fiche la traite comme vide)
  -- Effets
  effets                TEXT,                           -- colonne « Effets secondaires » (jamais vide dans les 322 sorts)
  texte_niveau5         TEXT,                           -- texte du pied d'onglet (« Textes des sorts de niveau 5 ») titré du nom de ce sort ;
                                                        -- NULL quand l'onglet n'en porte pas (ou quand le titre est sans texte)
  origine               TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref            TEXT    NOT NULL CHECK (length(source_ref) > 0), -- « Magie Maverick V8 › Sang › AL4:BR6 »
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  -- Colonnes ajoutées par la migration 0004 (une colonne ajoutée va en dernier) : le mode séparé du type, et les bonus de niveau de maîtrise (NM)
  mode_brut             TEXT,                           -- le MODE du sort : ce qui est entre parenthèses dans la colonne « Type » (« IC pour 3 NM », « Imparable », « IC » puis « IC x 2 si 3NM » à la ligne) ;
                                                        -- NULL quand le type n'a pas de parenthèses. Le TYPE (attaque, entrave…) est dans sort_type, le mode dans sort_mode (valeur de base)
                                                        -- et sort_bonus_maitrise (condition de NM)
  bonus_maitrise        TEXT,                           -- les bonus de NM du sort, une ligne par bonus, « <Colonne> : <passage de la cellule> » (« Coût : -5/NM », « Effets : Dure 2 tours (+1/NM) »),
                                                        -- dans l'ordre de lecture ; NULL quand le sort n'écrit aucun NM. Recopie lisible de sort_bonus_maitrise (db:check et les tests contrôlent l'accord)
  UNIQUE (magie_id, ordre),
  UNIQUE (magie_id, nom),
  -- le typé suit toujours le brut (la valeur typée n'est jamais une valeur saisie : tools/db/magies.py et db:check recalculent avec le même analyseur)
  CHECK (imparable = (instr(lower(type_brut), 'imparable') > 0)),
  CHECK (inesquivable = (instr(lower(type_brut), 'inesquivable') > 0)),
  CHECK (ic_direct = (instr(type_brut, '(IC)') > 0)),
  CHECK ((ic_nm_min IS NULL) = (instr(lower(replace(type_brut, char(10), ' ')), 'ic pour ') = 0)),
  CHECK (ic_nm_min IS NULL OR instr(lower(replace(type_brut, char(10), ' ')), 'ic pour ' || ic_nm_min) > 0),
  CHECK (cout_chakra IS NULL OR (substr(cout_brut, 1, length(CAST(cout_chakra AS TEXT))) = CAST(cout_chakra AS TEXT)
                                 AND substr(cout_brut || ' ', length(CAST(cout_chakra AS TEXT)) + 1, 1) NOT GLOB '[0-9]')),
  CHECK (cout_ressource IS NULL OR (cout_ressource = 'sang' AND instr(cout_brut, 'Sang') > 0) OR (cout_ressource = 'ame' AND instr(cout_brut, 'âme') > 0)),
  CHECK (portee_valeur IS NULL OR (substr(portee_brut, 1, length(CAST(portee_valeur AS TEXT))) = CAST(portee_valeur AS TEXT)
                                   AND substr(portee_brut || ' ', length(CAST(portee_valeur AS TEXT)) + 1, 1) NOT GLOB '[0-9]')),
  CHECK (texte_niveau5 IS NULL OR niveau = 5),
  CHECK ((portee_nature = 'nombre') = (portee_valeur IS NOT NULL)),
  CHECK (cout_ressource_valeur IS NULL OR cout_ressource IS NOT NULL)
) STRICT;
INSERT INTO "sort__0006" ("id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", "cout_ressource", "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise") SELECT "id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", "cout_ressource", "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise" FROM "sort";
DROP TABLE "sort";
ALTER TABLE "sort__0006" RENAME TO "sort";
CREATE INDEX sort_magie_niveau ON sort (magie_id, niveau, ordre);
CREATE INDEX sort_nom_cle      ON sort (nom_cle);
CREATE INDEX sort_niveau       ON sort (niveau);
CREATE INDEX sort_cout_chakra  ON sort (cout_chakra) WHERE cout_chakra IS NOT NULL;
CREATE INDEX sort_zone_forme   ON sort (zone_forme);
CREATE INDEX sort_portee       ON sort (portee_nature, portee_valeur);
CREATE TABLE classe__0006 (
  id                 TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page (entité typée qui a SA page)
  nom                TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom de l'onglet = nom dans le Sommaire (« Cuirassé », « Orios »). Le titre de la page
                                                 -- des 13 classes « Hybride Animal » ajoute « (classe) » (page.titre) : ce suffixe n'est pas ici.
  nom_cle            TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),    -- normalize(nom) : 'cuirasse', 'mage-bleu' ; sert aux jointures par nom avec les autres domaines
  categorie_id       TEXT    NOT NULL REFERENCES categorie_classe(id),   -- colonne du Sommaire où la classe est listée
  ordre              INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),         -- rang dans le Sommaire : catégories de gauche à droite, puis de haut en bas
  -- « Don de départ » (A2:F5) : trois nombres entiers par onglet. La fiche auto les lit comme « PV / Chakra / Barrière LVL 1 »
  -- (BDD!K30, K32, K34) : voir la requête n° 6 du domaine classes dans queries.json (« apport à un niveau donné »). Aucune autre valeur par niveau n'existe.
  sante_depart       INTEGER NOT NULL CHECK (sante_depart >= 0),
  chakra_depart      INTEGER NOT NULL CHECK (chakra_depart >= 0),
  barriere_depart    INTEGER NOT NULL CHECK (barriere_depart >= 0),
  -- Blocs de départ, cellule telle qu'écrite (retours à la ligne et « - » de liste conservés).
  maitrise_arme      TEXT,                       -- « Maîtrise Arme » : A7 (bloc A7:F9), liste à tirets telle qu'écrite (décomposée dans classe_maitrise_arme)
  maitrise_armure    TEXT,                       -- « Maîtrise Armures » : A11 (bloc A11:F13) telle qu'écrite (« - Légère à Intermédiaire\n- Bouclier classe 1 à 5 », « Aucun »…) ;
                                                 -- décomposée dans classe_maitrise_armure
  bouclier_classe_max INTEGER CHECK (bouclier_classe_max >= 1),   -- = max(classe_maitrise_armure.classe_max) (db:check le contrôle) ; dernier nombre de la ligne « Bouclier [de] classe N [à M] » ;
                                                 -- NULL = pas de ligne bouclier (la source n'y accorde alors aucune classe de bouclier)
  inventaire_depart  TEXT,                       -- « Inventaire de départ » : G3, cinq objets séparés par des virgules (détail : classe_objet_depart)
  arme_depart        TEXT,                       -- « Arme de départ » : G7 (« Arme en acier selon la maîtrise »)
  armure_depart      TEXT,                       -- « Armure de départ » : G11
  chose_a_savoir     TEXT,                       -- bloc « CHOSE A SAVOIR » (colonne Z) : note libre de règle ; NULL = bloc absent OU intitulé sans texte (Bimane)
  chose_a_savoir_lien TEXT,                      -- hyperlien externe attaché à la cellule du texte (Mage Bleu!Z3 : classeur des familiers) ; NULL = aucun
  description_titre  TEXT,                       -- titre du texte de présentation de la classe (AM1) : « Description Guerrier »
  description       TEXT,                        -- texte de présentation (AM2). NULL : Anansi, Goleois (titre sans texte), Grenadier (pas de zone de description)
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0), -- onglet + zones lues (départ, à savoir, description) + cellule du Sommaire
  remarque TEXT    -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;
INSERT INTO "classe__0006" ("id", "nom", "nom_cle", "categorie_id", "ordre", "sante_depart", "chakra_depart", "barriere_depart", "maitrise_arme", "maitrise_armure", "bouclier_classe_max", "inventaire_depart", "arme_depart", "armure_depart", "chose_a_savoir", "chose_a_savoir_lien", "description_titre", "description", "origine", "source_ref", "remarque") SELECT "id", "nom", "nom_cle", "categorie_id", "ordre", "sante_depart", "chakra_depart", "barriere_depart", "maitrise_arme", "maitrise_armure", "bouclier_classe_max", "inventaire_depart", "arme_depart", "armure_depart", "chose_a_savoir", "chose_a_savoir_lien", "description_titre", "description", "origine", "source_ref", "remarque" FROM "classe";
DROP TABLE "classe";
ALTER TABLE "classe__0006" RENAME TO "classe";
CREATE INDEX classe_categorie ON classe (categorie_id, ordre);
CREATE TABLE invocation__0006 (
  id            TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page d'introduction de l'onglet
  nom           TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom de l'onglet = titre de la page : 'Appel aux golems', « Marionnette de l'ombre » (onglet « Marionette de lombre », nom corrigé par 0006)
  nom_cle       TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),    -- normalize(nom)
  ordre         INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang de l'onglet dans le classeur
  bandeau       TEXT    NOT NULL,           -- bandeau de l'onglet (AJ1, AP1, Z1) : 'INVOCATION GOLEM', 'INVOCATION NON-MORT'
  genre         TEXT    NOT NULL CHECK (genre IN ('golem', 'non-mort', 'marionette')),
                                            -- mot qui suit « INVOCATION » dans le bandeau, en minuscules (tag de page actuel)
  sort_id       TEXT    REFERENCES sort(id),
                                            -- sort (domaine magies) qui invoque ces créatures. Le classeur ne porte AUCUNE clé :
                                            -- rapprochement explicite de l'importeur (3 lignes, SORT_INVOCATION) justifié par
                                            -- les effets des sorts (« voir invocation ») et par le texte de l'onglet (« le sort
                                            -- « Appel aux golems » »). NULL = rapprochement non établi.
  texte_general TEXT,                       -- texte général de l'onglet (AJ3, AP3, Z3), tel qu'écrit, paragraphes séparés par une ligne vide
  tableau_titre TEXT,                       -- titre du tableau posé à droite des cartes (AP40 de « Animation des morts » : « TABLEAU "AMELIORATION CADAVERIQUE" »),
                                            -- NULL = aucun. Le CONTENU de ce tableau (13 lignes) est la table amelioration_cadaverique du domaine magies : le même
                                            -- tableau figure dans les deux classeurs (identité vérifiée à l'import) ; une seule copie, pas de doublon ici.
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT    -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;
INSERT INTO "invocation__0006" ("id", "nom", "nom_cle", "ordre", "bandeau", "genre", "sort_id", "texte_general", "tableau_titre", "origine", "source_ref", "remarque") SELECT "id", "nom", "nom_cle", "ordre", "bandeau", "genre", "sort_id", "texte_general", "tableau_titre", "origine", "source_ref", "remarque" FROM "invocation";
DROP TABLE "invocation";
ALTER TABLE "invocation__0006" RENAME TO "invocation";
CREATE INDEX invocation_sort ON invocation (sort_id) WHERE sort_id IS NOT NULL;
CREATE TABLE invocation_capacite_commune__0006 (
  id            TEXT    NOT NULL PRIMARY KEY,         -- '<invocation.id>#commune:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006)
  invocation_id TEXT    NOT NULL REFERENCES invocation(id),
  rang          INTEGER NOT NULL CHECK (rang >= 1),   -- ordre dans la liste
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- « Inerte », « Non-Mort », « Élémentaire » : jusqu'au premier « . »
  nom_cle       TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                     -- normalize(nom) : 'inerte', 'non-mort', 'elementaire'
  texte         TEXT    NOT NULL,                     -- le reste de l'élément
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (invocation_id, rang),
  UNIQUE (invocation_id, nom_cle)
) STRICT;
INSERT INTO "invocation_capacite_commune__0006" ("id", "invocation_id", "rang", "nom", "nom_cle", "texte", "origine", "source_ref", "remarque") SELECT "id", "invocation_id", "rang", "nom", "nom_cle", "texte", "origine", "source_ref", "remarque" FROM "invocation_capacite_commune";
DROP TABLE "invocation_capacite_commune";
ALTER TABLE "invocation_capacite_commune__0006" RENAME TO "invocation_capacite_commune";
CREATE TABLE creature__0006 (
  id            TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page (entité typée qui a SA page)
  nom           TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom de la carte (D1 / T1) = titre de la page ; orthographe corrigée par 0006 (l'id garde la clé d'origine)
  nom_cle       TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),    -- normalize(nom) : 'golem-de-magma' ; jointures par nom avec les autres domaines
  invocation_id TEXT    NOT NULL REFERENCES invocation(id),
  bloc_id       TEXT    NOT NULL,           -- bloc de marge (combinaison de magies ou palier EP) ; FK composite plus bas
  rang          INTEGER NOT NULL CHECK (rang IN (1, 2)),   -- 1 = carte de gauche, 2 = carte de droite du bloc (2 seulement en onglets « duo »)
  description   TEXT,                       -- cellule de description (D3 / T3) ; NULL = absente
  -- Santé / Chakra / Barrière : ligne « Santé » de la carte. `*_forme` dit la forme du texte, `*_valeur` le nombre quand il y en a un.
  --   'fixe'                : un nombre (« 10.0 » -> brut '10', valeur 10)
  --   'par_npm'             : « 20/NPM » -> valeur 20 (le nombre écrit devant « /NPM »)
  --   'selon_chakra'        : « Selon le chakra » (barrière des poupées et de certains non-morts) -> valeur NULL
  --   'pct_barriere_lanceur': « 10% de la barrière courant du lanceur » (marionettes) -> valeur 10
  sante_brut    TEXT    NOT NULL,
  sante_forme   TEXT    NOT NULL CHECK (sante_forme IN ('fixe', 'par_npm')),
  sante_valeur  INTEGER NOT NULL CHECK (sante_valeur >= 0),
  chakra_brut   TEXT,                       -- NULL : pas de ligne « Chakra » (onglet Marionette)
  chakra_forme  TEXT    CHECK (chakra_forme IN ('fixe', 'par_npm')),
  chakra_valeur INTEGER CHECK (chakra_valeur >= 0),
  barriere_brut TEXT,
  barriere_forme TEXT   CHECK (barriere_forme IN ('fixe', 'par_npm', 'selon_chakra', 'pct_barriere_lanceur')),
  barriere_valeur INTEGER CHECK (barriere_valeur >= 0),
  -- Défense (ligne « Défense ») : trois écritures dans la source.
  --   'separee' : « 3/NPM Armure Physique | 3 Armure Magique » (une valeur par armure, « /NPM » facultatif sur chacune)
  --   'commune' : « 2 Armure Physique et Magique/NPM » (UN nombre pour les deux ; le suffixe « /NPM » éventuel est écrit une
  --               seule fois, après « Magique » : les deux colonnes *_par_npm sont alors renseignées de la même façon, lecture
  --               « il vaut pour les deux » à confirmer, voir design.md §12)
  defense_brut  TEXT,
  defense_forme TEXT    CHECK (defense_forme IN ('separee', 'commune')),
  armure_physique        INTEGER CHECK (armure_physique >= 0),
  armure_physique_par_npm INTEGER CHECK (armure_physique_par_npm IN (0, 1)),
  armure_magique         INTEGER CHECK (armure_magique >= 0),
  armure_magique_par_npm  INTEGER CHECK (armure_magique_par_npm IN (0, 1)),
  -- Vitesse (ligne « Vitesse ») : « 4 cases sol / 8 cases nage » (« case » ou « cases » selon la cellule, unité = cases)
  vitesse_brut  TEXT,
  vitesse_sol   INTEGER CHECK (vitesse_sol >= 0),
  vitesse_nage  INTEGER CHECK (vitesse_nage >= 0),
  -- FPVSIA (ligne « FPVSIA ») : la cellule entière ; les six nombres sont dans creature_caracteristique, les bonus entre
  -- parenthèses dans creature_bonus_npm.
  fpvsia_brut   TEXT,
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0), -- « Invocation › Appel aux golems › D1:R28 » (la carte entière)
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (bloc_id, rang),
  FOREIGN KEY (bloc_id, invocation_id) REFERENCES invocation_bloc (id, invocation_id),
  CHECK ((chakra_brut IS NULL) = (chakra_forme IS NULL)),
  CHECK ((chakra_valeur IS NULL) = (chakra_forme IS NULL)),
  CHECK ((barriere_brut IS NULL) = (barriere_forme IS NULL)),
  CHECK ((barriere_valeur IS NULL) = (barriere_forme IS NULL OR barriere_forme = 'selon_chakra')),
  CHECK ((defense_brut IS NULL) = (defense_forme IS NULL)),
  CHECK ((defense_forme IS NULL) = (armure_physique IS NULL) AND (defense_forme IS NULL) = (armure_magique IS NULL)
     AND (defense_forme IS NULL) = (armure_physique_par_npm IS NULL) AND (defense_forme IS NULL) = (armure_magique_par_npm IS NULL)),
  CHECK ((vitesse_brut IS NULL) = (vitesse_sol IS NULL) AND (vitesse_brut IS NULL) = (vitesse_nage IS NULL))
) STRICT;
INSERT INTO "creature__0006" ("id", "nom", "nom_cle", "invocation_id", "bloc_id", "rang", "description", "sante_brut", "sante_forme", "sante_valeur", "chakra_brut", "chakra_forme", "chakra_valeur", "barriere_brut", "barriere_forme", "barriere_valeur", "defense_brut", "defense_forme", "armure_physique", "armure_physique_par_npm", "armure_magique", "armure_magique_par_npm", "vitesse_brut", "vitesse_sol", "vitesse_nage", "fpvsia_brut", "origine", "source_ref", "remarque") SELECT "id", "nom", "nom_cle", "invocation_id", "bloc_id", "rang", "description", "sante_brut", "sante_forme", "sante_valeur", "chakra_brut", "chakra_forme", "chakra_valeur", "barriere_brut", "barriere_forme", "barriere_valeur", "defense_brut", "defense_forme", "armure_physique", "armure_physique_par_npm", "armure_magique", "armure_magique_par_npm", "vitesse_brut", "vitesse_sol", "vitesse_nage", "fpvsia_brut", "origine", "source_ref", "remarque" FROM "creature";
DROP TABLE "creature";
ALTER TABLE "creature__0006" RENAME TO "creature";
CREATE INDEX creature_invocation ON creature (invocation_id);
CREATE INDEX creature_sante      ON creature (sante_valeur);
CREATE INDEX creature_vitesse    ON creature (vitesse_sol, vitesse_nage);
CREATE INDEX creature_bloc_invocation_fk ON creature (bloc_id, invocation_id);
CREATE TABLE creature_attaque__0006 (
  id          TEXT    NOT NULL PRIMARY KEY,           -- '<creature.id>#attaque:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) ; '…~2' pour une attaque écrite deux fois à l'identique (Golem d'ombre)
  creature_id TEXT    NOT NULL REFERENCES creature(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),     -- ligne dans la cellule « Dégâts » (position : n'entre pas dans l'identifiant)
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),                       -- avant le premier « - » : « Poing », « Arbalécho », « L'arme du lanceur »
  nom_cle     TEXT    NOT NULL CHECK (length(nom_cle) > 0 AND nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),   -- normalize(nom)
  occurrence  INTEGER NOT NULL CHECK (occurrence >= 1),       -- n° d'apparition de ce nom dans la cellule : 1, sauf attaque écrite deux fois
  brut        TEXT    NOT NULL,
  formule_brut TEXT   NOT NULL,                       -- avant « dégâts » : « 1d10/NPM », « 1d10+2/NPM », « (1d4/NPM)x1d4 », « 6d6 »
  des_nombre  INTEGER CHECK (des_nombre >= 1),        -- « 1d10+2/NPM » -> 1 ; NULL si la formule n'est pas « NdM[+K][/NPM] »
  des_faces   INTEGER CHECK (des_faces >= 2),         --                    10
  bonus_fixe  INTEGER CHECK (bonus_fixe >= 0),        --                    2 (NULL si pas de « +K »)
  par_npm     INTEGER NOT NULL CHECK (par_npm IN (0, 1)),   -- 1 si « /NPM » est écrit dans la formule OU juste après le type (« 1d6 dégâts d'eau/NPM »)
  type_brut   TEXT,                                   -- ce qui suit « dégâts » hors parenthèses, sans « /NPM » final : « de taille/estoc » ; NULL = aucun
  precisions  TEXT,                                   -- parenthèses telles qu'écrites : « (portée 1-8) », « (4Po-Cône) (5 chakra) », « (sans type) »
  portee_min  INTEGER CHECK (portee_min >= 0),        -- « portée 4-18 », « Portée 1 - 6 », « Po = 1 - 8 » ; NULL pour « 2Po-Cône » (ambigu)
  portee_max  INTEGER CHECK (portee_max >= 0),
  cout_chakra INTEGER CHECK (cout_chakra >= 0),       -- « (5 chakra) »
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0), -- plage de la cellule « Dégâts » (G11:R12)
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (creature_id, rang),
  UNIQUE (creature_id, nom_cle, occurrence),
  CHECK ((des_nombre IS NULL) = (des_faces IS NULL)),
  CHECK (bonus_fixe IS NULL OR des_nombre IS NOT NULL),
  CHECK ((portee_min IS NULL) = (portee_max IS NULL)),
  CHECK (portee_min IS NULL OR portee_min <= portee_max)
) STRICT;
INSERT INTO "creature_attaque__0006" ("id", "creature_id", "rang", "nom", "nom_cle", "occurrence", "brut", "formule_brut", "des_nombre", "des_faces", "bonus_fixe", "par_npm", "type_brut", "precisions", "portee_min", "portee_max", "cout_chakra", "origine", "source_ref", "remarque") SELECT "id", "creature_id", "rang", "nom", "nom_cle", "occurrence", "brut", "formule_brut", "des_nombre", "des_faces", "bonus_fixe", "par_npm", "type_brut", "precisions", "portee_min", "portee_max", "cout_chakra", "origine", "source_ref", "remarque" FROM "creature_attaque";
DROP TABLE "creature_attaque";
ALTER TABLE "creature_attaque__0006" RENAME TO "creature_attaque";
CREATE INDEX creature_attaque_nom ON creature_attaque (nom_cle);
CREATE TABLE creature_capacite__0006 (
  id          TEXT    NOT NULL PRIMARY KEY,           -- '<creature.id>#capacite:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) ; '…#capacite:sort-supplementaire:npm3' quand le nom se répète à un autre NPM
  creature_id TEXT    NOT NULL REFERENCES creature(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),     -- ordre des paragraphes
  npm_min     INTEGER CHECK (npm_min BETWEEN 1 AND 5),   -- préfixe « (NPM 3) » : niveau de puissance magique à partir duquel la capacité s'ajoute ; NULL = capacité de base
  etiquette   TEXT,                                   -- « [Non enflammé] » (Golem de pétrole, NPM 3) : sans les crochets ; NULL = aucune
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),                       -- jusqu'au premier « . » : « Bouclier de feu », « Lanceur de sorts », « Annule 12 »
  nom_cle     TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                       -- normalize(nom)
  texte       TEXT    NOT NULL,                       -- le reste du paragraphe, retours à la ligne conservés
  donnees     TEXT    CHECK (donnees IS NULL OR (json_valid(donnees) AND json_type(donnees) = 'object')),
                                                      -- liste numérotée « 1. … 8. … » du texte (Golem de chair, « Forme changeante ») :
                                                      -- {"elements":[{"rang":1,"texte":"Muscles difformes : +2 Force, …"},…]} ; NULL = aucune
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0), -- plage de la cellule « Capacité(s) » (G19:R28)
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (creature_id, rang),
  CHECK (length(nom_cle) > 0)
) STRICT;
INSERT INTO "creature_capacite__0006" ("id", "creature_id", "rang", "npm_min", "etiquette", "nom", "nom_cle", "texte", "donnees", "origine", "source_ref", "remarque") SELECT "id", "creature_id", "rang", "npm_min", "etiquette", "nom", "nom_cle", "texte", "donnees", "origine", "source_ref", "remarque" FROM "creature_capacite";
DROP TABLE "creature_capacite";
ALTER TABLE "creature_capacite__0006" RENAME TO "creature_capacite";
CREATE INDEX creature_capacite_nom ON creature_capacite (nom_cle);
CREATE INDEX creature_capacite_npm ON creature_capacite (npm_min) WHERE npm_min IS NOT NULL;
CREATE VIEW v_creature_magie AS
  SELECT creature_id, magie_id, MAX(lien = 'marge') AS dans_marge, MAX(lien = 'sort') AS par_sort
  FROM (
    SELECT c.id AS creature_id, bm.magie_id AS magie_id, 'marge' AS lien
      FROM creature c JOIN invocation_bloc_magie bm ON bm.bloc_id = c.bloc_id
    UNION ALL
    SELECT c.id, s.magie_id, 'sort'
      FROM creature c JOIN invocation i ON i.id = c.invocation_id JOIN sort s ON s.id = i.sort_id
  )
  GROUP BY creature_id, magie_id;
CREATE VIEW v_creature_resistance AS
  SELECT ca.creature_id AS creature_id, r.sens AS sens, r.sens_brut AS sens_brut, r.cible_type AS cible_type,
         r.cible_magie_id AS cible_magie_id, r.cible_etat_id AS cible_etat_id, r.cible_degat AS cible_degat,
         r.cible_brut AS cible_brut, 'capacite' AS provenance, ca.id AS source_id, ca.npm_min AS npm_min,
         NULL AS via_magie_id
    FROM creature_capacite_resistance r JOIN creature_capacite ca ON ca.id = r.capacite_id
  UNION ALL
  SELECT c.id, r.sens, r.sens_brut, r.cible_type, r.cible_magie_id, r.cible_etat_id, r.cible_degat, r.cible_brut,
         'commune', r.capacite_commune_id, NULL, NULL
    FROM invocation_resistance r
    JOIN invocation_capacite_commune k ON k.id = r.capacite_commune_id
    JOIN creature c ON c.invocation_id = k.invocation_id
  UNION ALL
  SELECT DISTINCT c.id, mr.sens, NULL, 'magie', mr.cible_magie_id, NULL, NULL, mr.cible_brut,
         'element', k.id, NULL, mr.magie_id
    FROM creature c
    JOIN invocation_capacite_commune k ON k.invocation_id = c.invocation_id AND k.nom_cle = 'elementaire'
    JOIN invocation_bloc_magie bm ON bm.bloc_id = c.bloc_id
    JOIN magie_resistance mr ON mr.magie_id = bm.magie_id AND mr.cible_type = 'magie';
CREATE VIEW v_creature_sort AS
  SELECT ca.creature_id AS creature_id, ca.id AS capacite_id, ca.nom AS capacite, ca.npm_min AS npm_min,
         cs.rang AS rang, cs.sort_nom_brut AS sort_nom_brut, cs.sort_id AS sort_id
  FROM creature_capacite_sort cs JOIN creature_capacite ca ON ca.id = cs.capacite_id;
CREATE VIEW v_creature_cout_invocation AS
  SELECT c.id AS creature_id, i.id AS invocation_id, s.id AS sort_id, s.nom AS sort_nom,
         s.cout_brut AS cout_brut, s.cout_chakra AS cout_chakra, s.cout_ressource AS cout_ressource,
         s.cout_ressource_valeur AS cout_ressource_valeur, b.ep AS ep
  FROM creature c
  JOIN invocation i ON i.id = c.invocation_id
  JOIN invocation_bloc b ON b.id = c.bloc_id
  JOIN sort s ON s.id = i.sort_id;
CREATE VIEW v_creature_meme_bloc AS
  SELECT a.id AS creature_id, b.id AS autre_creature_id
  FROM creature a JOIN creature b ON b.bloc_id = a.bloc_id AND b.id <> a.id;
CREATE VIEW v_classe_capacite AS
  SELECT k.classe_id, c.nom AS classe, k.specialite_id, s.rang AS specialite_rang, s.nom AS specialite, k.niveau, k.nature, k.ligne, k.rang,
         k.id AS capacite_id, k.nom, k.type, k.type_brut, k.limite_nombre, k.limite_periode, k.effet
  FROM capacite k
  JOIN classe c ON c.id = k.classe_id
  LEFT JOIN specialite s ON s.id = k.specialite_id;
CREATE VIEW v_capacite_exclusive AS
  SELECT a.id AS capacite_id, b.id AS autre_id
  FROM capacite a
  JOIN capacite b ON b.classe_id = a.classe_id AND b.ligne = a.ligne AND b.nature = a.nature AND b.id <> a.id
  WHERE a.nature <> 'classe'
    AND (a.nature = 'specialite' OR COALESCE(a.specialite_id, '') = COALESCE(b.specialite_id, ''));

-- ----- Données : noms corrigés -----
-- page bestiaire/appel-aux-golems corps_md [grammaire] ×1 : « Poupée corrompu » -> « Poupée corrompue » (Accord avec « poupée » (féminin).)
-- page bestiaire/appel-aux-golems corps_md [grammaire] ×1 : « Poupée sacré » -> « Poupée sacrée » (Accord avec « poupée » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'corrompu', 'corrompue'), 'sacré', 'sacrée') WHERE "id" = 'bestiaire/appel-aux-golems';
-- page bestiaire/bete-de-lombre corps_md [orthographe] ×2 : « Folle de guerre » -> « Folie de guerre » (Nom d'état : « folie de guerre » (« folle » est un adjectif sans nom).)
-- page bestiaire/bete-de-lombre corps_md [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace("corps_md", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre'), '
Folle ', '
Folie '), 'Folle', 'Folie') WHERE "id" = 'bestiaire/bete-de-lombre';
-- page bestiaire/double-sombre corps_md [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/double-sombre';
-- page bestiaire/executeur-lunaire corps_md [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/executeur-lunaire';
-- page bestiaire/golem-de-chair corps_md [grammaire] ×1 : « Taille disproportionné » -> « Taille disproportionnée » (Accord avec « taille » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'disproportionné', 'disproportionnée') WHERE "id" = 'bestiaire/golem-de-chair';
-- page bestiaire/golem-de-foudre corps_md [grammaire] ×1 : « Brume Noir » -> « Brume Noire » (Accord avec « brume » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Noir', 'Noire') WHERE "id" = 'bestiaire/golem-de-foudre';
-- page bestiaire/golem-de-lumiere corps_md [grammaire] ×1 : « Poupée sacré » -> « Poupée sacrée » (Accord avec « poupée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'sacré', 'sacrée') WHERE "id" = 'bestiaire/golem-de-lumiere';
-- page bestiaire/golem-de-petrole corps_md [grammaire] ×1 : « Poupée corrompu » -> « Poupée corrompue » (Accord avec « poupée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'corrompu', 'corrompue') WHERE "id" = 'bestiaire/golem-de-petrole';
-- page bestiaire/golem-de-sable corps_md [orthographe] ×1 : « tempête sable » -> « tempête de sable » (« tempête de sable », comme ailleurs dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", ' sable”', ' de sable”') WHERE "id" = 'bestiaire/golem-de-sable';
-- page bestiaire/goule corps_md [grammaire] ×1 : « des Mort-Vivant » -> « des Morts-Vivants » (Pluriel après « des » : les deux éléments du nom composé s'accordent.)
-- page bestiaire/goule corps_md [grammaire] ×1 : « Radiation corrompu » -> « Radiation corrompue » (Accord avec « radiation » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Mort', 'Morts'), 'Vivant', 'Vivants'), ' corrompu.', ' corrompue.') WHERE "id" = 'bestiaire/goule';
-- page bestiaire/marionette-de-lombre corps_md [orthographe] ×1 : « MARIONETTE » -> « MARIONNETTE » (« marionnette » prend deux n.)
-- page bestiaire/marionette-de-lombre corps_md [frappe] ×1 : « Sihouetteur » -> « Silhouetteur » (Dérivé de « silhouette » (forme du texte de la créature).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'MARIONETTE', 'MARIONNETTE'), 'Sihouetteur', 'Silhouetteur') WHERE "id" = 'bestiaire/marionette-de-lombre';
-- page bestiaire/marionette-de-lombre titre [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "titre" = replace(replace("titre", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/marionette-de-lombre';
-- page bestiaire/momie corps_md [frappe] ×1 : « Veilliessement » -> « Vieillissement » (Lettres inversées : « vieillissement » (sort de l'Espace/Temps).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Veilliessement', 'Vieilliessement'), 'Vieilliessement', 'Vieillissement') WHERE "id" = 'bestiaire/momie';
-- page bestiaire/ombre-rampante corps_md [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/ombre-rampante';
-- page bestiaire/poupee-arcanique corps_md [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'argenté', 'argentée') WHERE "id" = 'bestiaire/poupee-arcanique';
-- page bestiaire/poupee-corrompu titre [grammaire] ×1 : « Poupée corrompu » -> « Poupée corrompue » (Accord avec « poupée » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'corrompu', 'corrompue') WHERE "id" = 'bestiaire/poupee-corrompu';
-- page bestiaire/poupee-de-glaise corps_md [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'bestiaire/poupee-de-glaise';
-- page bestiaire/poupee-necrotique corps_md [ponctuation] ×1 : « Répar Os » -> « Répar'Os » (Même forme que les autres noms de la série (« Destruc'Os », « Fractur'Os »).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Répar Os', 'Répar''Os') WHERE "id" = 'bestiaire/poupee-necrotique';
-- page bestiaire/poupee-sacre titre [grammaire] ×1 : « Poupée sacré » -> « Poupée sacrée » (Accord avec « poupée » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'sacré', 'sacrée') WHERE "id" = 'bestiaire/poupee-sacre';
-- page bestiaire/poupee-terrestre corps_md [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'bestiaire/poupee-terrestre';
-- page bestiaire/reanime corps_md [orthographe] ×1 : « Para-tonnerre » -> « Paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Para-tonnerre', 'Paratonnerre') WHERE "id" = 'bestiaire/reanime';
-- page bestiaire/sihouetteur-obscur corps_md [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/sihouetteur-obscur';
-- page bestiaire/sihouetteur-obscur titre [frappe] ×1 : « Sihouetteur » -> « Silhouetteur » (Dérivé de « silhouette » (forme du texte de la créature).)
UPDATE "page" SET "titre" = replace("titre", 'Sihouetteur', 'Silhouetteur') WHERE "id" = 'bestiaire/sihouetteur-obscur';
-- page bestiaire/squamique corps_md [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", ' argenté.', ' argentée.') WHERE "id" = 'bestiaire/squamique';
-- page bestiaire/squelette-de-pierre corps_md [grammaire] ×1 : « Épée osseuse lié » -> « Épée osseuse liée » (Accord avec « épée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'lié', 'liée') WHERE "id" = 'bestiaire/squelette-de-pierre';
-- page bestiaire/temposs corps_md [grammaire] ×1 : « Arme distordu » -> « Arme distordue » (Accord avec « arme » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'distordu', 'distordue') WHERE "id" = 'bestiaire/temposs';
-- page bestiaire/zombinox corps_md [grammaire] ×1 : « Tu ne passe pas » -> « Tu ne passes pas » (2e personne du singulier : « tu passes ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'passe', 'passes') WHERE "id" = 'bestiaire/zombinox';
-- page capacites/anansi-anti-corps titre [orthographe] ×1 : « Anti-corps » -> « Anticorps » (Le nom s'écrit en un mot : « anticorps ».)
UPDATE "page" SET "titre" = replace("titre", 'Anti-corps', 'Anticorps') WHERE "id" = 'capacites/anansi-anti-corps';
-- page capacites/anansi-attention-migale titre [orthographe] ×1 : « Attention migale » -> « Attention mygale » (L'araignée s'écrit « mygale ».)
UPDATE "page" SET "titre" = replace("titre", 'migale', 'mygale') WHERE "id" = 'capacites/anansi-attention-migale';
-- page capacites/archimage-pacte-noire titre [grammaire] ×1 : « Pacte Noire » -> « Pacte Noir » (« pacte » est masculin.)
UPDATE "page" SET "titre" = replace("titre", 'Noire', 'Noir') WHERE "id" = 'capacites/archimage-pacte-noire';
-- page capacites/barde-bain-de-foules titre [grammaire] ×1 : « Bain de foules » -> « Bain de foule » (Expression figée « bain de foule ».)
UPDATE "page" SET "titre" = replace("titre", 'foules', 'foule') WHERE "id" = 'capacites/barde-bain-de-foules';
-- page capacites/barde-balade-guerriere titre [orthographe] ×1 : « Balade guerrière » -> « Ballade guerrière » (Chant : « ballade » (« balade » est une promenade).)
UPDATE "page" SET "titre" = replace("titre", 'Balade', 'Ballade') WHERE "id" = 'capacites/barde-balade-guerriere';
-- page capacites/bimane-frappe-fatiguante titre [orthographe] ×1 : « Frappe fatiguante » -> « Frappe fatigante » (L'adjectif s'écrit « fatigant(e) » (le participe est « fatiguant »).)
UPDATE "page" SET "titre" = replace("titre", 'fatiguante', 'fatigante') WHERE "id" = 'capacites/bimane-frappe-fatiguante';
-- page capacites/clerc-tend-lautre-joue titre [grammaire] ×1 : « Tend l'autre joue » -> « Tends l'autre joue » (Impératif de « tendre » à la 2e personne : « tends ».)
UPDATE "page" SET "titre" = replace("titre", 'Tend', 'Tends') WHERE "id" = 'capacites/clerc-tend-lautre-joue';
-- page capacites/cuirasse-tu-passe-pas titre [grammaire] ×1 : « Tu passe pas » -> « Tu passes pas » (2e personne du singulier : « tu passes ».)
UPDATE "page" SET "titre" = replace("titre", 'passe', 'passes') WHERE "id" = 'capacites/cuirasse-tu-passe-pas';
-- page capacites/fenrir-griffe-sanglant titre [grammaire] ×1 : « Griffe sanglant » -> « Griffe sanglante » (Accord avec « griffe » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'sanglant', 'sanglante') WHERE "id" = 'capacites/fenrir-griffe-sanglant';
-- page capacites/flagelleur-dit-mon-nom titre [grammaire] ×1 : « Dit mon nom » -> « Dis mon nom » (Impératif de « dire » à la 2e personne : « dis ».)
UPDATE "page" SET "titre" = replace("titre", 'Dit', 'Dis') WHERE "id" = 'capacites/flagelleur-dit-mon-nom';
-- page capacites/flagelleur-puni-moi titre [grammaire] ×1 : « Puni-moi » -> « Punis-moi » (Impératif de « punir » à la 2e personne : « punis ».)
UPDATE "page" SET "titre" = replace("titre", 'Puni', 'Punis') WHERE "id" = 'capacites/flagelleur-puni-moi';
-- page capacites/frappeur-asymbiotique corps_md [frappe] ×1 : « Frappeud » -> « Frappeur » (Nom de la classe : « Frappeur ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Frappeud', 'Frappeur') WHERE "id" = 'capacites/frappeur-asymbiotique';
-- page capacites/frappeur-distracteur corps_md [orthographe] ×1 : « Vigilence » -> « Vigilance » (Le nom s'écrit « vigilance ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Vigilence', 'Vigilance') WHERE "id" = 'capacites/frappeur-distracteur';
-- page capacites/frappeur-distracteur resume [orthographe] ×1 : « Vigilence » -> « Vigilance » (Le nom s'écrit « vigilance ».)
UPDATE "page" SET "resume" = replace("resume", 'Vigilence', 'Vigilance') WHERE "id" = 'capacites/frappeur-distracteur';
-- page capacites/goleois-balade-barbare titre [orthographe] ×1 : « Balade barbare » -> « Ballade barbare » (Chant : « ballade » (« balade » est une promenade).)
UPDATE "page" SET "titre" = replace("titre", 'Balade', 'Ballade') WHERE "id" = 'capacites/goleois-balade-barbare';
-- page capacites/grenadier-attend titre [grammaire] ×1 : « Attend ... » -> « Attends ... » (Impératif de « attendre » à la 2e personne : « attends ».)
UPDATE "page" SET "titre" = replace("titre", 'Attend', 'Attends') WHERE "id" = 'capacites/grenadier-attend';
-- page capacites/guerrier-contre-coup titre [orthographe] ×1 : « Contre coup » -> « Contrecoup » (Le nom s'écrit en un mot : « contrecoup ».)
UPDATE "page" SET "titre" = replace("titre", 'Contre coup', 'Contrecoup') WHERE "id" = 'capacites/guerrier-contre-coup';
-- page capacites/kitsune-vif-allure titre [grammaire] ×1 : « Vif allure » -> « Vive allure » (« allure » est féminin : « à vive allure ».)
UPDATE "page" SET "titre" = replace("titre", 'Vif', 'Vive') WHERE "id" = 'capacites/kitsune-vif-allure';
-- page capacites/lancier-riposte-infini titre [grammaire] ×1 : « Riposte infini » -> « Riposte infinie » (Accord avec « riposte » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'infini', 'infinie') WHERE "id" = 'capacites/lancier-riposte-infini';
-- page capacites/maclier-prise-alternatif titre [grammaire] ×1 : « Prise alternatif » -> « Prise alternative » (Accord avec « prise » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'alternatif', 'alternative') WHERE "id" = 'capacites/maclier-prise-alternatif';
-- page capacites/mage-soin-etrange corps_md [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'capacites/mage-soin-etrange';
-- page capacites/mage-vert-meilleur-attaque titre [grammaire] ×1 : « Meilleur attaque » -> « Meilleure attaque » (Accord avec « attaque » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'Meilleur', 'Meilleure') WHERE "id" = 'capacites/mage-vert-meilleur-attaque';
-- page capacites/martiale-force-inne titre [grammaire] ×1 : « Force inné » -> « Force innée » (Accord avec « force » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'inné', 'innée') WHERE "id" = 'capacites/martiale-force-inne';
-- page capacites/martiale-rage-audacieux titre [grammaire] ×1 : « Rage audacieux » -> « Rage audacieuse » (Accord avec « rage » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'audacieux', 'audacieuse') WHERE "id" = 'capacites/martiale-rage-audacieux';
-- page capacites/martiale-rage-prudent titre [grammaire] ×1 : « Rage prudent » -> « Rage prudente » (Accord avec « rage » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'prudent', 'prudente') WHERE "id" = 'capacites/martiale-rage-prudent';
-- page capacites/mercenaire-je-te-choisi titre [grammaire] ×1 : « Je te choisi » -> « Je te choisis » (Présent de « choisir » à la 1re personne : « je choisis ».)
UPDATE "page" SET "titre" = replace("titre", 'choisi', 'choisis') WHERE "id" = 'capacites/mercenaire-je-te-choisi';
-- page capacites/minotaure-parceque titre [ponctuation] ×1 : « ParceQUE » -> « Parce QUE » (Locution en deux mots (les capitales du cri sont gardées).)
UPDATE "page" SET "titre" = replace("titre", 'ParceQUE', 'Parce QUE') WHERE "id" = 'capacites/minotaure-parceque';
-- page capacites/moine-prend-ca titre [grammaire] ×1 : « Prend ça » -> « Prends ça » (Impératif de « prendre » à la 2e personne : « prends ».)
UPDATE "page" SET "titre" = replace("titre", 'Prend', 'Prends') WHERE "id" = 'capacites/moine-prend-ca';
-- page capacites/moine-tu-vivra titre [grammaire] ×1 : « Tu vivra » -> « Tu vivras » (Futur de « vivre » à la 2e personne : « tu vivras ».)
UPDATE "page" SET "titre" = replace("titre", 'vivra', 'vivras') WHERE "id" = 'capacites/moine-tu-vivra';
-- page capacites/namazu-dent-infecte titre [grammaire] ×1 : « Dent Infecté » -> « Dent Infectée » (Accord avec « dent » (féminin).)
UPDATE "page" SET "titre" = replace("titre", 'Infecté', 'Infectée') WHERE "id" = 'capacites/namazu-dent-infecte';
-- page capacites/pugiliste-a-deux-main titre [grammaire] ×1 : « A deux Main » -> « À deux Mains » (Préposition « à » accentuée et pluriel après « deux ».)
UPDATE "page" SET "titre" = replace(replace("titre", 'A', 'À'), 'Main', 'Mains') WHERE "id" = 'capacites/pugiliste-a-deux-main';
-- page capacites/pugiliste-suplexe titre [orthographe] ×1 : « Suplexe » -> « Suplex » (La prise de catch s'écrit « suplex ».)
UPDATE "page" SET "titre" = replace("titre", 'Suplexe', 'Suplex') WHERE "id" = 'capacites/pugiliste-suplexe';
-- page capacites/tueur-anti-corps titre [orthographe] ×1 : « Anti corps » -> « Anticorps » (Le nom s'écrit en un mot : « anticorps ».)
UPDATE "page" SET "titre" = replace("titre", 'Anti corps', 'Anticorps') WHERE "id" = 'capacites/tueur-anti-corps';
-- page capacites/tueur-innaretable titre [orthographe] ×1 : « innarêtable » -> « inarrêtable » (« inarrêtable » : un n, deux r.)
UPDATE "page" SET "titre" = replace("titre", 'innarêtable', 'inarrêtable') WHERE "id" = 'capacites/tueur-innaretable';
-- page capacites/voleur-mcgyver titre [orthographe] ×1 : « McGyver » -> « MacGyver » (Le personnage de série s'écrit « MacGyver ».)
UPDATE "page" SET "titre" = replace("titre", 'McGyver', 'MacGyver') WHERE "id" = 'capacites/voleur-mcgyver';
-- page capacites/voleur-tu-ma-pas-vu titre [grammaire] ×1 : « Tu m'a pas vu » -> « Tu m'as pas vu » (Verbe avoir à la 2e personne : « tu as ».)
UPDATE "page" SET "titre" = replace("titre", '''a ', '''as ') WHERE "id" = 'capacites/voleur-tu-ma-pas-vu';
-- page classes/anansi corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
-- page classes/anansi corps_md [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'brevage', 'breuvage'), 'mineur', 'mineure') WHERE "id" = 'classes/anansi';
-- page classes/bimane corps_md [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'aiguisé', 'aiguiser') WHERE "id" = 'classes/bimane';
-- page classes/clerc corps_md [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'mineur', 'mineure') WHERE "id" = 'classes/clerc';
-- page classes/fenrir corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
-- page classes/fenrir corps_md [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'brevage', 'breuvage'), 'aiguisé', 'aiguiser') WHERE "id" = 'classes/fenrir';
-- page classes/frappeur corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'complet', 'complète') WHERE "id" = 'classes/frappeur';
-- page classes/goleois corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/goleois';
-- page classes/grenadier corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'complet', 'complète') WHERE "id" = 'classes/grenadier';
-- page classes/guerrier corps_md [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'aiguisé', 'aiguiser') WHERE "id" = 'classes/guerrier';
-- page classes/jackalope corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
-- page classes/jackalope corps_md [harmonisation] ×1 : « Jacklope » -> « Jackalope » (La classe s'appelle « Jackalope » (titre et texte de la page).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Jacklope', 'Jackalope'), 'brevage', 'breuvage') WHERE "id" = 'classes/jackalope';
-- page classes/kitsune corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/kitsune';
-- page classes/lanceur corps_md [grammaire] ×1 : « Armes de Jet Léger » -> « Armes de Jet Légères » (Accord avec « armes » (féminin pluriel).)
-- page classes/lanceur corps_md [grammaire] ×1 : « Armes de Jet Lourde » -> « Armes de Jet Lourdes » (Accord avec « armes » (féminin pluriel).)
-- page classes/lanceur corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Lourde', 'Lourdes'), 'Léger', 'Légères'), 'complet', 'complète') WHERE "id" = 'classes/lanceur';
-- page classes/maclier corps_md [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'mineur', 'mineure') WHERE "id" = 'classes/maclier';
-- page classes/mage-bleu corps_md [accent] ×1 : « LUMIERE » -> « LUMIÈRE » (Accent conservé en majuscule (cf. « NÉCROMANCIE »).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'LUMIERE', 'LUMIÈRE') WHERE "id" = 'classes/mage-bleu';
-- page classes/mage-rouge corps_md [grammaire] ×1 : « Armure de Peau complet » -> « Armure de Peau complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page classes/mage-rouge corps_md [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'aiguisé', 'aiguiser'), 'complet', 'complète') WHERE "id" = 'classes/mage-rouge';
-- page classes/marcass corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/marcass';
-- page classes/martiale corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'complet', 'complète') WHERE "id" = 'classes/martiale';
-- page classes/medusain corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/medusain';
-- page classes/mercenaire corps_md [grammaire] ×1 : « Chasseur de Prime » -> « Chasseur de Primes » (Le titre de section et le texte écrivent « Chasseur de Primes ».)
UPDATE "page" SET "corps_md" = replace("corps_md", ' Prime
', ' Primes
') WHERE "id" = 'classes/mercenaire';
-- page classes/minotaure corps_md [grammaire] ×1 : « Armure de cuir complet » -> « Armure de cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page classes/minotaure corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'brevage', 'breuvage'), 'complet', 'complète') WHERE "id" = 'classes/minotaure';
-- page classes/moine corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page classes/moine corps_md [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'mineur', 'mineure'), 'complet', 'complète') WHERE "id" = 'classes/moine';
-- page classes/namazu corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/namazu';
-- page classes/ocultomancien corps_md [frappe] ×1 : « Métérologue » -> « Météorologue » (Lettre manquante : « météorologue » (titre de section et texte).)
-- page classes/ocultomancien corps_md [harmonisation] ×1 : « Occultomancien » -> « Ocultomancien » (Graphie majoritaire du nom de la classe (48 « Ocultomancien » contre 3).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Occultomancien', 'Ocultomancien'), 'Métérologue', 'Météorologue') WHERE "id" = 'classes/ocultomancien';
-- page classes/ocultomancien resume [harmonisation] ×1 : « Occultomancien » -> « Ocultomancien » (Graphie majoritaire du nom de la classe (48 « Ocultomancien » contre 3).)
UPDATE "page" SET "resume" = replace("resume", 'Occultomancien', 'Ocultomancien') WHERE "id" = 'classes/ocultomancien';
-- page classes/olwman corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/olwman';
-- page classes/orios corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/orios';
-- page classes/parleur corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page classes/parleur corps_md [grammaire] ×1 : « plume à gravé » -> « plume à graver » (Infinitif après « à » : « plume à graver ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'gravé', 'graver'), 'complet', 'complète') WHERE "id" = 'classes/parleur';
-- page classes/pugiliste corps_md [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'mineur', 'mineure') WHERE "id" = 'classes/pugiliste';
-- page classes/rokh corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/rokh';
-- page classes/satyre corps_md [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'brevage', 'breuvage') WHERE "id" = 'classes/satyre';
-- page classes/tueur corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'complet', 'complète') WHERE "id" = 'classes/tueur';
-- page classes/voleur corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'complet', 'complète') WHERE "id" = 'classes/voleur';
-- page guide/distance-et-voyage corps_md [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'poix', 'pois') WHERE "id" = 'guide/distance-et-voyage';
-- page guide/fiche-armure-defense-bouclier corps_md [grammaire] ×1 : « Parade partiel » -> « Parade partielle » (Accord avec « parade » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'partiel', 'partielle') WHERE "id" = 'guide/fiche-armure-defense-bouclier';
-- page guide/fiche-attributs corps_md [harmonisation] ×1 : « Mithril » -> « Mythril » (Graphie majoritaire de la base : « Mythril ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Mithril', 'Mythril') WHERE "id" = 'guide/fiche-attributs';
-- page guide/fiche-capacites-dons titre [grammaire] ×1 : « Capacités/Don » -> « Capacités/Dons » (Pluriel parallèle à « Capacités ».)
UPDATE "page" SET "titre" = replace("titre", 'Don', 'Dons') WHERE "id" = 'guide/fiche-capacites-dons';
-- page guide/fiche-tableau-resistances-faiblesses titre [grammaire] ×1 : « Résistance/Faiblesses » -> « Résistances/Faiblesses » (Même nombre pour les deux termes (le texte parle des « résistances et faiblesses »).)
UPDATE "page" SET "titre" = replace("titre", 'Résistance', 'Résistances') WHERE "id" = 'guide/fiche-tableau-resistances-faiblesses';
-- page guide/guide-pour-mj-maverick corps_md [grammaire] ×1 : « Les Actions et mouvement » -> « Les Actions et mouvements » (La page liée s'appelle « Les Actions et mouvements ».)
-- page guide/guide-pour-mj-maverick corps_md [grammaire] ×1 : « Résistance/Faiblesses » -> « Résistances/Faiblesses » (Même nombre pour les deux termes (le texte parle des « résistances et faiblesses »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", ' mouvement*', ' mouvements*'), '|Résistance/', '|Résistances/') WHERE "id" = 'guide/guide-pour-mj-maverick';
-- page guide/liste-des-alterations-d-etat corps_md [orthographe] ×1 : « Aggripé » -> « Agrippé » (« agripper » : un g, deux p.)
-- page guide/liste-des-alterations-d-etat corps_md [orthographe] ×1 : « Folle de Guerre » -> « Folie de Guerre » (Nom d'état : « folie de guerre » (« folle » est un adjectif sans nom).)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Aggripé', 'Agripé'), 'Agripé', 'Agrippé'), 'Folle', 'Folie') WHERE "id" = 'guide/liste-des-alterations-d-etat';
-- page guide/liste-des-effets-mode-super corps_md [orthographe] ×1 : « Foudre étincellante » -> « Foudre étincelante » (« étincelant » prend un seul l.)
-- page guide/liste-des-effets-mode-super corps_md [orthographe] ×1 : « Guérriseur » -> « Guérisseur » (« guérisseur » : un r, deux s.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'étincellante', 'étincelante'), 'Guérriseur', 'Guérisseur') WHERE "id" = 'guide/liste-des-effets-mode-super';
-- page guide/meteo corps_md [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
-- page guide/meteo corps_md [orthographe] ×1 : « purée de poix » -> « purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", ' poix
', ' pois
'), 'poix', 'pois') WHERE "id" = 'guide/meteo';
-- page guide/mode-hyper-magie corps_md [orthographe] ×1 : « Innerte » -> « Inerte » (« inerte » : un seul n.)
-- page guide/mode-hyper-magie corps_md [grammaire] ×1 : « des os froid » -> « des os froids » (Pluriel après « des ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Innerte', 'Inerte'), 'froid', 'froids') WHERE "id" = 'guide/mode-hyper-magie';
-- page lore/relations-entre-les-races corps_md [orthographe] ×72 : « Supprémaciste » -> « Suprémaciste » (« suprémaciste » prend un seul p.)
-- page lore/relations-entre-les-races corps_md [frappe] ×72 : « Marcass Ubain » -> « Marcass Urbain » (Lettre manquante, comme les autres peuples « … Urbain ».)
-- page lore/relations-entre-les-races corps_md [phrase] ×1 : « recopiés tels qu'écrits, y compris « Elfe Argenté Suprémaciste », « Jackalope Feu » et « Marcass Urbain » : rien n'y est corrigé. Seuls les retours à la ligne et les espaces multiples d'une étiquette sont ramenés à une espace. » -> « recopiés tels qu'écrits. Seuls les retours à la ligne et les espaces multiples d'une étiquette sont ramenés à une espace, et deux fautes d'orthographe y sont corrigées : « Elfe Argenté Suprémaciste » et « Marcass Urbain ». » (La page disait que rien n'était corrigé dans les étiquettes ; deux le sont désormais.)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'écrits, y compris « Elfe Argenté Supprémaciste », « Jackalope Feu » et « Marcass Ubain » : rien n''y est corrigé', 'écrits'), ' espace.', ' espace, et deux fautes d''orthographe y sont corrigées : « Elfe Argenté Suprémaciste » et « Marcass Urbain ».'), 'é : Elfe Argenté Supprémaciste, Elfe Argenté Ba', 'é : Elfe Argenté Suprémaciste, Elfe Argenté Ba'), 's Ubain

', 's Urbain

'), ', Marcass Ubain
- **Accep', ', Marcass Urbain
- **Accep'), 'nnemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Humain D', 'nnemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Humain D'), 'e Terre, Marcass Ubain
- **Neutre** : E', 'e Terre, Marcass Urbain
- **Neutre** : E'), 'Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Humain Tr', 'Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Humain Tr') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'omancie, Marcass Ubain
- **Neutre** : E', 'omancie, Marcass Urbain
- **Neutre** : E'), 'e** : Elfe Argenté Supprémaciste, Elfe Doré

## Hum', 'e** : Elfe Argenté Suprémaciste, Elfe Doré

## Hum'), 'ure, Marcass Ubain
- **Neutre**', 'ure, Marcass Urbain
- **Neutre**'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## E', '* : Elfe Argenté Suprémaciste, Elfe Doré

## E'), 'n, Marcass Terre, Marcass Ubain
- **Neutre** : Humain Dés', 'n, Marcass Terre, Marcass Urbain
- **Neutre** : Humain Dés'), 'n, Elfe Argenté Supprémaciste, Elfe Argenté B', 'n, Elfe Argenté Suprémaciste, Elfe Argenté B'), ' Médusain Urbain, Jackalope Urbain, Marcass Ubain
- **Neutre** : Humain Désertique, Humain To', ' Médusain Urbain, Jackalope Urbain, Marcass Urbain
- **Neutre** : Humain Désertique, Humain To'), 'on, Elfe Argenté Supprémaciste, Elfe Doré

## E', 'on, Elfe Argenté Suprémaciste, Elfe Doré

## E') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ' Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Ennemie** : Elfe Forestier Forêt, Elfe N', ' Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Ennemie** : Elfe Forestier Forêt, Elfe N'), 't, Elfe Noir Salé, Elfe Argenté Supprémaciste, Elfe Argenté Barrage argenté, ', 't, Elfe Noir Salé, Elfe Argenté Suprémaciste, Elfe Argenté Barrage argenté, '), 's Nécromancie, Marcass Ubain
- **Ennemie** : Elfe A', 's Nécromancie, Marcass Urbain
- **Ennemie** : Elfe A'), ': Elfe Argenté Supprémaciste, Elfe Argenté ', ': Elfe Argenté Suprémaciste, Elfe Argenté '), ' Supprémaciste ', ' Suprémaciste '), ' Supprémaciste
', ' Suprémaciste
'), 're Terre, Satyre Urbain, Médusain Urbain, Jackalope Feu, Jackalope Terre, Jackalope Vide, Jackalope Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Haine** : Felfe Forestier, Felfe Noir, Orios Sang
- **Ennemie** : Elfe Forestier Forêt, Elfe Forestier Urbain, Elfe Noir Charbon, Elfe Noir Salé, Elfe Argenté B', 're Terre, Satyre Urbain, Médusain Urbain, Jackalope Feu, Jackalope Terre, Jackalope Vide, Jackalope Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Haine** : Felfe Forestier, Felfe Noir, Orios Sang
- **Ennemie** : Elfe Forestier Forêt, Elfe Forestier Urbain, Elfe Noir Charbon, Elfe Noir Salé, Elfe Argenté B'), 'romancie, Marcass Ubain
- **Haine** : Fel', 'romancie, Marcass Urbain
- **Haine** : Fel') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ', Elfe Argenté Supprémaciste, Elfe Doré, Mi', ', Elfe Argenté Suprémaciste, Elfe Doré, Mi'), ' Urbain, Marcass Ubain
- **Évitée** : N', ' Urbain, Marcass Urbain
- **Évitée** : N'), ' Elfe Argenté Supprémaciste, Elfe Doré, M', ' Elfe Argenté Suprémaciste, Elfe Doré, M'), 'rcass Ubain
- **E', 'rcass Urbain
- **E'), 'Argenté Supprémaciste, Elfe A', 'Argenté Suprémaciste, Elfe A'), ' Marcass Terre, Marcass Ubain
- **Neutre** : Humain D', ' Marcass Terre, Marcass Urbain
- **Neutre** : Humain D'), 'rbon, Elfe Argenté Supprémaciste, Elfe Doré, Nain E', 'rbon, Elfe Argenté Suprémaciste, Elfe Doré, Nain E'), 's Terre, Marcass Ubain
- **Neutre** : H', 's Terre, Marcass Urbain
- **Neutre** : H') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ' Elfe Argenté Supprémaciste, Elfe Doré, N', ' Elfe Argenté Suprémaciste, Elfe Doré, N'), ' Nécromancie, Marcass Ubain
- **Évitée** : Elfe A', ' Nécromancie, Marcass Urbain
- **Évitée** : Elfe A'), 'on, Elfe Argenté Supprémaciste, Elfe Doré

## M', 'on, Elfe Argenté Suprémaciste, Elfe Doré

## M'), 'ckalope Urbain, Marcass Ubain
- **Évitée** : Humain C', 'ckalope Urbain, Marcass Urbain
- **Évitée** : Humain C'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## H', '* : Elfe Argenté Suprémaciste, Elfe Doré

## H'), 'cass Terre, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe N', 'cass Terre, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe N'), '** : Elfe Argenté Supprémaciste, Elfe Doré

## Mo', '** : Elfe Argenté Suprémaciste, Elfe Doré

## Mo'), ' Marcass Terre, Marcass Ubain
- **Évitée** : Humain C', ' Marcass Terre, Marcass Urbain
- **Évitée** : Humain C') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'ie** : Elfe Argenté Supprémaciste, Elfe Doré

## Drak', 'ie** : Elfe Argenté Suprémaciste, Elfe Doré

## Drak'), ' Urbain, Marcass Ubain
- **Neutre** : E', ' Urbain, Marcass Urbain
- **Neutre** : E'), 'é, Elfe Argenté Supprémaciste, Elfe Doré

## ', 'é, Elfe Argenté Suprémaciste, Elfe Doré

## '), 'bain, Satyre Feu, Satyre Foudre, Satyre Terre, Médusain Urbain, Jackalope Urbain, Marcass Ubain
- **Neutre** : Humain Central, Humain Désertique, Humain Tropical, Humain Toundra, Elfe N', 'bain, Satyre Feu, Satyre Foudre, Satyre Terre, Médusain Urbain, Jackalope Urbain, Marcass Urbain
- **Neutre** : Humain Central, Humain Désertique, Humain Tropical, Humain Toundra, Elfe N'), 'nemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Felfe N', 'nemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Felfe N'), ' Satyre Feu, Satyre Foudre, Satyre Terre, Médusain Urbain, Jackalope Urbain, Marcass Ubain
- **Neutre** : Humain Central, Humain Désertique, Humain Tropical, Humain Toundra, E', ' Satyre Feu, Satyre Foudre, Satyre Terre, Médusain Urbain, Jackalope Urbain, Marcass Urbain
- **Neutre** : Humain Central, Humain Désertique, Humain Tropical, Humain Toundra, E'), 'e** : Elfe Argenté Supprémaciste, Elfe Doré

## Fel', 'e** : Elfe Argenté Suprémaciste, Elfe Doré

## Fel'), 'ckalope Urbain, Marcass Ubain
- **Neutre** : Humain C', 'ckalope Urbain, Marcass Urbain
- **Neutre** : Humain C') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '** : Elfe Argenté Supprémaciste, Elfe Doré

## Or', '** : Elfe Argenté Suprémaciste, Elfe Doré

## Or'), 'ckalope Urbain, Marcass Ubain
- **Évitée** : Humain D', 'ckalope Urbain, Marcass Urbain
- **Évitée** : Humain D'), ' **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir Ombre, K', ' **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir Ombre, K'), 'ss Nécromancie, Marcass Ubain
- **Neutre** : Humain D', 'ss Nécromancie, Marcass Urbain
- **Neutre** : Humain D'), ' **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir Glace, F', ' **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir Glace, F'), 'u, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Humain Toundra, ', 'u, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Humain Toundra, '), 'mie** : Elfe Argenté Supprémaciste, Elfe Doré, Olwman V', 'mie** : Elfe Argenté Suprémaciste, Elfe Doré, Olwman V'), ' Urbain, Marcass Ubain
- **Neutre** : M', ' Urbain, Marcass Urbain
- **Neutre** : M') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Drassah''thac C', '
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Drassah''thac C'), 'n, Marcass Ubain
- **Neutre', 'n, Marcass Urbain
- **Neutre'), '
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Drassah''thac N', '
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Drassah''thac N'), ' Marcass Terre, Marcass Ubain
- **Évitée** : Humain D', ' Marcass Terre, Marcass Urbain
- **Évitée** : Humain D'), '
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Drassah''thac S', '
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Drassah''thac S'), 'omancie, Marcass Ubain
- **Évitée** : H', 'omancie, Marcass Urbain
- **Évitée** : H'), '
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Drassah''thac E', '
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Drassah''thac E'), 'ass Feu, Marcass Ubain
- **Évitée** : E', 'ass Feu, Marcass Urbain
- **Évitée** : E') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '* : Elfe Argenté Supprémaciste, Elfe Doré

## D', '* : Elfe Argenté Suprémaciste, Elfe Doré

## D'), 'u, Marcass Ubain
- **Évitée', 'u, Marcass Urbain
- **Évitée'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## F', '* : Elfe Argenté Suprémaciste, Elfe Doré

## F'), 'ckalope Vide, Marcass Ubain
- **Haine** : Orios T', 'ckalope Vide, Marcass Urbain
- **Haine** : Orios T'), 'ie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios S', 'ie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios S'), 'ckalope Vide, Marcass Ubain
- **Haine** : Orios S', 'ckalope Vide, Marcass Urbain
- **Haine** : Orios S'), 'ie
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios Eau, Orios Te', 'ie
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios Eau, Orios Te'), 'de, Marcass Ubain
- **Haine**', 'de, Marcass Urbain
- **Haine**') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '*Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir Glace,', '*Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir Glace,'), 'e, Marcass Nécromancie, Marcass Ubain
- **Haine** : Orios Eau, Orios ', 'e, Marcass Nécromancie, Marcass Urbain
- **Haine** : Orios Eau, Orios '), '* : Elfe Argenté Supprémaciste, Elfe Doré

## K', '* : Elfe Argenté Suprémaciste, Elfe Doré

## K'), 'a, Jackalope Urbain, Marcass Ubain
- **Évitée** : Humain Toundr', 'a, Jackalope Urbain, Marcass Urbain
- **Évitée** : Humain Toundr'), 'Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios Eau, F', 'Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios Eau, F'), 'a, Jackalope Urbain, Marcass Ubain
- **Évitée** : Elfe Noir Cha', 'a, Jackalope Urbain, Marcass Urbain
- **Évitée** : Elfe Noir Cha'), 'erre
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios Terre, Fenrir F', 'erre
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios Terre, Fenrir F'), 're, Marcass Ubain
- **Évitée*', 're, Marcass Urbain
- **Évitée*') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'n
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir Ombre, Olwm', 'n
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir Ombre, Olwm'), ' Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage argenté, M', ' Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage argenté, M'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## O', '* : Elfe Argenté Suprémaciste, Elfe Doré

## O'), 'n Urbain, Marcass Nécromancie, Marcass Ubain
- **Haine** : Nain Ouest, Nain Est, Na', 'n Urbain, Marcass Nécromancie, Marcass Urbain
- **Haine** : Nain Ouest, Nain Est, Na'), '**Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios Terre, F', '**Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios Terre, F'), 'dre, Médusain Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Haine** : Orios Terre, Orios Sang, Jackalope Feu, Jackalope Terre, Jackalo', 'dre, Médusain Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Haine** : Orios Terre, Orios Sang, Jackalope Feu, Jackalope Terre, Jackalo'), 'n
- **Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Kitsune Lumière, R', 'n
- **Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Kitsune Lumière, R'), 'cass Terre, Marcass Nécromancie, Marcass Ubain
- **Haine** : Orios Terre, Orios Sang, J', 'cass Terre, Marcass Nécromancie, Marcass Urbain
- **Haine** : Orios Terre, Orios Sang, J') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ' Elfe Argenté Supprémaciste, Elfe Doré, J', ' Elfe Argenté Suprémaciste, Elfe Doré, J'), 'a, Marcass Ubain
- **Évitée', 'a, Marcass Urbain
- **Évitée'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## R', '* : Elfe Argenté Suprémaciste, Elfe Doré

## R'), 'romancie, Marcass Ubain
- **Haine** : Nai', 'romancie, Marcass Urbain
- **Haine** : Nai'), '**Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios Terre, S', '**Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios Terre, S'), 'rcass Nécromancie, Marcass Ubain
- **Haine** : Orios Eau, K', 'rcass Nécromancie, Marcass Urbain
- **Haine** : Orios Eau, K'), 'ie** : Elfe Argenté Supprémaciste, Elfe Doré, Orios T', 'ie** : Elfe Argenté Suprémaciste, Elfe Doré, Orios T'), 'mancie, Marcass Ubain
- **Haine** : N', 'mancie, Marcass Urbain
- **Haine** : N') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'mie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir O', 'mie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir O'), ' Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage argenté, N', ' Urbain, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage argenté, N'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## N', '* : Elfe Argenté Suprémaciste, Elfe Doré

## N'), 'u, Marcass Ubain
- **Haine*', 'u, Marcass Urbain
- **Haine*'), ': Elfe Argenté Supprémaciste, Elfe Doré, Or', ': Elfe Argenté Suprémaciste, Elfe Doré, Or'), ' Nécromancie, Marcass Ubain
- **Haine** : Orios U', ' Nécromancie, Marcass Urbain
- **Haine** : Orios U'), 'mie** : Elfe Argenté Supprémaciste, Elfe Doré, Fenrir F', 'mie** : Elfe Argenté Suprémaciste, Elfe Doré, Fenrir F'), 'Marcass Nécromancie, Marcass Ubain
- **Haine** : Orios Terre, R', 'Marcass Nécromancie, Marcass Urbain
- **Haine** : Orios Terre, R') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ' Elfe Argenté Supprémaciste, Elfe Doré, K', ' Elfe Argenté Suprémaciste, Elfe Doré, K'), 'e, Jackalope Vide, Jackalope Urbain, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe Argen', 'e, Jackalope Vide, Jackalope Urbain, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe Argen'), '** : Elfe Argenté Supprémaciste, Elfe Doré

## Mi', '** : Elfe Argenté Suprémaciste, Elfe Doré

## Mi'), ' Jackalope Urbain, Marcass Ubain
- **Évitée** : Elfe Noir S', ' Jackalope Urbain, Marcass Urbain
- **Évitée** : Elfe Noir S'), ', Elfe Argenté Supprémaciste, Elfe Doré

##', ', Elfe Argenté Suprémaciste, Elfe Doré

##'), ' Nécromancie, Marcass Ubain
- **Haine** : Orios T', ' Nécromancie, Marcass Urbain
- **Haine** : Orios T'), ' Elfe Argenté Supprémaciste, Elfe Doré, F', ' Elfe Argenté Suprémaciste, Elfe Doré, F'), 'n Urbain, Marcass Feu, Marcass Nécromancie, Marcass Ubain
- **Haine** : Orios Eau, Orios Terre, Kitsune Vent,', 'n Urbain, Marcass Feu, Marcass Nécromancie, Marcass Urbain
- **Haine** : Orios Eau, Orios Terre, Kitsune Vent,') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'nnemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Satyre T', 'nnemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Satyre T'), 'omancie, Marcass Ubain
- **Haine** : Ol', 'omancie, Marcass Urbain
- **Haine** : Ol'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## S', '* : Elfe Argenté Suprémaciste, Elfe Doré

## S'), 'a, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage arge', 'a, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage arge'), '*Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Médusain E', '*Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Médusain E'), 're, Marcass Ubain
- **Haine**', 're, Marcass Urbain
- **Haine**'), '*Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Médusain F', '*Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Médusain F'), 'mancie, Marcass Ubain
- **Haine** : O', 'mancie, Marcass Urbain
- **Haine** : O') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '*Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Médusain L', '*Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Médusain L'), 'rcass Ubain
- **H', 'rcass Urbain
- **H'), '** : Elfe Argenté Supprémaciste, Elfe Doré

## Mé', '** : Elfe Argenté Suprémaciste, Elfe Doré

## Mé'), 'n, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage arge', 'n, Marcass Feu, Marcass Terre, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbon, Elfe Argenté Barrage arge'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## L', '* : Elfe Argenté Suprémaciste, Elfe Doré

## L'), 'u, Marcass Nécromancie, Marcass Ubain
- **Évitée** : Elfe Noir Charbo', 'u, Marcass Nécromancie, Marcass Urbain
- **Évitée** : Elfe Noir Charbo'), '**Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Jackalope F', '**Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Jackalope F'), ' Urbain, Marcass Ubain
- **Évitée** : H', ' Urbain, Marcass Urbain
- **Évitée** : H') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '**Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Jackalope T', '**Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Jackalope T'), 'de, Jackalope Urbain, Marcass Ubain
- **Évitée** : Elfe Noir Char', 'de, Jackalope Urbain, Marcass Urbain
- **Évitée** : Elfe Noir Char'), '* : Elfe Argenté Supprémaciste, Elfe Doré

## J', '* : Elfe Argenté Suprémaciste, Elfe Doré

## J'), 'n, Marcass Ubain
- **Évitée', 'n, Marcass Urbain
- **Évitée'), 'lfe Argenté Supprémaciste, Elfe Doré,', 'lfe Argenté Suprémaciste, Elfe Doré,'), 'rcass Ubain
- **É', 'rcass Urbain
- **É'), 'Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Marcass F', 'Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Marcass F'), 'u, Marcass Nécromancie, Marcass Ubain
- **Neutre** : Humain Central, ', 'u, Marcass Nécromancie, Marcass Urbain
- **Neutre** : Humain Central, ') WHERE "id" = 'lore/relations-entre-les-races';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Marcass T', 'Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Marcass T'), 'ie, Marcass Ubain
- **Neutre*', 'ie, Marcass Urbain
- **Neutre*'), 'Ennemie** : Elfe Argenté Supprémaciste, Elfe Doré

## Marcass N', 'Ennemie** : Elfe Argenté Suprémaciste, Elfe Doré

## Marcass N'), 'rcass Ubain
- **N', 'rcass Urbain
- **N'), 'Elfe Argenté Supprémaciste, Elfe Doré

', 'Elfe Argenté Suprémaciste, Elfe Doré

'), ' Ubain ', ' Urbain '), 'Ubain', 'Urbain'), 'Supprémaciste', 'Suprémaciste') WHERE "id" = 'lore/relations-entre-les-races';
-- page magies/magie-de-la-corruption corps_md [orthographe] ×2 : « Verrouille Visible » -> « Verrouillage Visible » (Les trois autres sorts de la série s'appellent « Verrouillage … ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", '| Verrouille V', '| Verrouillage V'), 'Verrouille', 'Verrouillage') WHERE "id" = 'magies/magie-de-la-corruption';
-- page magies/magie-de-la-foudre corps_md [orthographe] ×1 : « Para-tonnerre » -> « Paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
-- page magies/magie-de-la-foudre corps_md [orthographe] ×1 : « para-tonnerre » -> « paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
-- page magies/magie-de-la-foudre corps_md [casse] ×2 : « Colonne tesla » -> « Colonne Tesla » (« Tesla » est un nom propre (Nikola Tesla).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace("corps_md", 'e tesla |', 'e Tesla |'), 'para-tonnerre', 'paratonnerre'), 'tesla', 'Tesla'), 'Para-tonnerre', 'Paratonnerre') WHERE "id" = 'magies/magie-de-la-foudre';
-- page magies/magie-de-la-necromancie corps_md [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
-- page magies/magie-de-la-necromancie corps_md [ponctuation] ×1 : « Répar Os » -> « Répar'Os » (Même forme que les autres noms de la série (« Destruc'Os », « Fractur'Os »).)
-- page magies/magie-de-la-necromancie corps_md [grammaire] ×3 : « Résurrection Noir » -> « Résurrection Noire » (Accord avec « résurrection » (féminin).)
-- page magies/magie-de-la-necromancie corps_md [grammaire] ×1 : « Vague de cadavre » -> « Vague de cadavres » (Une vague de plusieurs cadavres : complément au pluriel.)
-- page magies/magie-de-la-necromancie corps_md [grammaire] ×1 : « vague de cadavre » -> « vague de cadavres » (Une vague de plusieurs cadavres : complément au pluriel.)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace("corps_md", 'e cadavre |', 'e cadavres |'), ' cadavre ', ' cadavres '), 'poix', 'pois'), 'Répar Os', 'Répar''Os'), 'n Noir |', 'n Noire |'), ' sort « Résurrection Noir »** : Est considérée', ' sort « Résurrection Noire »** : Est considérée'), ' Noir ', ' Noire ') WHERE "id" = 'magies/magie-de-la-necromancie';
-- page magies/magie-de-la-terre corps_md [orthographe] ×1 : « Lance Pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
-- page magies/magie-de-la-terre corps_md [orthographe] ×1 : « tempête sable » -> « tempête de sable » (« tempête de sable », comme ailleurs dans la même page.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Lance Pierre', 'Lance-pierre'), ' sable"', ' de sable"') WHERE "id" = 'magies/magie-de-la-terre';
-- page magies/magie-de-larcane corps_md [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", ' argenté ', ' argentée ') WHERE "id" = 'magies/magie-de-larcane';
-- page magies/magie-de-leau corps_md [harmonisation] ×1 : « Climatospetique » -> « Climatosceptique » (Nom du don de l'Ocultomancien, écrit « Climatosceptique » (climat + sceptique).)
-- page magies/magie-de-leau corps_md [orthographe] ×1 : « Onde Confusion » -> « Onde de Confusion » (Nom du sort complété (« onde de confusion »).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Onde', 'Onde de'), 'Climatospetique', 'Climatosceptique') WHERE "id" = 'magies/magie-de-leau';
-- page magies/magie-de-lombre corps_md [grammaire] ×1 : « Brume mental » -> « Brume mentale » (Accord avec « brume » (féminin).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'mental', 'mentale') WHERE "id" = 'magies/magie-de-lombre';
-- page magies/magie-du-vent corps_md [grammaire] ×1 : « Estoc hurlante » -> « Estoc hurlant » (« estoc » est masculin.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'hurlante', 'hurlant') WHERE "id" = 'magies/magie-du-vent';
-- page magies/magie-du-vide corps_md [orthographe] ×2 : « Touché du Vide » -> « Toucher du Vide » (Le nom du contact est « le toucher » (« touché » est le participe).)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", '| Touché d', '| Toucher d'), 'Touché', 'Toucher') WHERE "id" = 'magies/magie-du-vide';
-- page metiers/marin corps_md [orthographe] ×1 : « Vie de nature » -> « Vie en nature » (La compétence s'appelle « Vie en nature » dans les autres métiers.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'e de n', 'e en n') WHERE "id" = 'metiers/marin';
-- page races/drakos corps_md [orthographe] ×2 : « Drakos Bordeau » -> « Drakos Bordeaux » (La couleur s'écrit « bordeaux ».)
-- page races/drakos corps_md [frappe] ×3 : « Tempe/Espace » -> « Temps/Espace » (« Temps » (magie Espace/Temps).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace("corps_md", ' Bordeau ', ' Bordeaux '), '
| Tempe/Es', '
| Temps/Es'), ' Bordeau
', ' Bordeaux
'), '« Tempe/E', '« Temps/E'), 'Tempe', 'Temps') WHERE "id" = 'races/drakos';
-- page races/drassahthac corps_md [orthographe] ×1 : « Goutière » -> « Gouttière » (« gouttière » prend deux t.)
-- page races/drassahthac corps_md [harmonisation] ×6 : « Drassah'Thac » -> « Drassah'thac » (Graphie majoritaire de la race : « Drassah'thac » (402 contre 6).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace("corps_md", 'Goutière', 'Gouttière'), 'ah''Thac en', 'ah''thac en'), 'h''Thac c', 'h''thac c'), 'h''Thac o', 'h''thac o'), 'h''Thac s', 'h''thac s'), 'h''Thac e', 'h''thac e'), 'Thac', 'thac') WHERE "id" = 'races/drassahthac';
-- page races/elfe-argente corps_md [orthographe] ×2 : « Supprémaciste » -> « Suprémaciste » (« suprémaciste » prend un seul p.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", ' Supprémaciste ', ' Suprémaciste '), 'Supprémaciste', 'Suprémaciste') WHERE "id" = 'races/elfe-argente';
-- page races/elfe-forestier corps_md [grammaire] ×1 : « elfes dorée » -> « elfes dorés » (Accord avec « elfes » (masculin pluriel), comme la race des Elfes Dorés.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'dorée', 'dorés') WHERE "id" = 'races/elfe-forestier';
-- page races/humain corps_md [grammaire] ×1 : « Elfes Dorées » -> « Elfes Dorés » (Accord avec « elfes » (masculin pluriel).)
-- page races/humain corps_md [orthographe] ×2 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Dorées', 'Dorés'), 'Les météos Neige, Tempête de neige, Brouillard, Purée de poix et les terrains liés à eux n''ont aucun effet négatif.

*', 'Les météos Neige, Tempête de neige, Brouillard, Purée de pois et les terrains liés à eux n''ont aucun effet négatif.

*'), 'poix', 'pois') WHERE "id" = 'races/humain';
-- page races/kitsune corps_md [harmonisation] ×1 : « kistunes » -> « kitsunes » (Lettres inversées : la race s'écrit « kitsunes » partout ailleurs.)
-- page races/kitsune corps_md [grammaire] ×1 : « Les Kitsune tribaux » -> « Les Kitsunes tribaux » (Pluriel du nom de la race, écrit « Kitsunes » ailleurs sur la page.)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'kistunes', 'kitsunes'), 's Kitsune t', 's Kitsunes t') WHERE "id" = 'races/kitsune';
-- page races/marcass corps_md [grammaire] ×1 : « des Minotaure » -> « des Minotaures » (Pluriel du nom de la race après « des ».)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Minotaure', 'Minotaures') WHERE "id" = 'races/marcass';
-- page races/medusain corps_md [grammaire] ×1 : « Eaux froide » -> « Eaux froides » (Accord avec « eaux » (féminin pluriel).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'froide', 'froides') WHERE "id" = 'races/medusain';
-- page races/nain corps_md [grammaire] ×1 : « Elfes Dorées » -> « Elfes Dorés » (Accord avec « elfes » (masculin pluriel).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Dorées', 'Dorés') WHERE "id" = 'races/nain';
-- page races/olwman corps_md [harmonisation] ×2 : « owlmans » -> « olwmans » (Graphie majoritaire de la race : « Olwman ».)
-- page races/olwman corps_md [harmonisation] ×1 : « Rocks » -> « Rokhs » (Graphie majoritaire de la race : « Rokhs ».)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Rocks', 'Rokhs'), ' owlmans ', ' olwmans '), 'owlmans', 'olwmans') WHERE "id" = 'races/olwman';
-- page races/rokh corps_md [harmonisation] ×2 : « Rocks » -> « Rokhs » (Graphie majoritaire de la race : « Rokhs ».)
-- page races/rokh corps_md [harmonisation] ×1 : « des rocks » -> « des Rokhs » (Graphie majoritaire de la race : « Rokhs ».)
-- page races/rokh corps_md [harmonisation] ×1 : « culture rock » -> « culture rokh » (Graphie majoritaire de la race : « Rokh ».)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace("corps_md", 'rocks', 'Rokhs'), 'rock', 'rokh'), 's Rocks e', 's Rokhs e'), 'Rocks', 'Rokhs') WHERE "id" = 'races/rokh';
-- page ressources/accessoires corps_md [frappe] ×5 : « Diament » -> « Diamant » (« diamant ».)
-- page ressources/accessoires corps_md [orthographe] ×2 : « Emmeraude » -> « Émeraude » (Un seul m, accent sur la majuscule : « Émeraude ».)
-- page ressources/accessoires corps_md [frappe] ×2 : « Gyspe » -> « Gypse » (Lettres inversées : « gypse ».)
-- page ressources/accessoires corps_md [orthographe] ×20 : « Onix » -> « Onyx » (La pierre s'écrit « onyx ».)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", '5 | Gyspe + M', '5 | Gypse + M'), 'amant rose ou + Onix | À calculer |
', 'amant rose ou + Onyx | À calculer |
'), '5 | Emmeraude + T', '5 | Émeraude + T'), 'Gyspe', 'Gypse'), 'u + Onix | À', 'u + Onyx | À'), 'Emmeraude', 'Émeraude'), '4 | Onix + G', '4 | Onyx + G'), 'e + Onix | 3', 'e + Onyx | 3') WHERE "id" = 'ressources/accessoires';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'u 2 | Perle + Onix | 49 Ro |
| 1', 'u 2 | Perle + Onyx | 49 Ro |
| 1'), 'le + Onix | 10', 'le + Onyx | 10'), 'e + Onix | 1', 'e + Onyx | 1'), ' 5 | Perle + Onix | 244 Ro |

', ' 5 | Perle + Onyx | 244 Ro |

'), 'ze + Diament rose', 'ze + Diamant rose'), 't + Onix | 1', 't + Onyx | 1'), '5 | Onix + R', '5 | Onyx + R'), 'e + Onix | 2', 'e + Onyx | 2') WHERE "id" = 'ressources/accessoires';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 's | Niveau 3 | Onix + Onix | 144 R', 's | Niveau 3 | Onyx + Onix | 144 R'), 'yx + Onix | 14', 'yx + Onyx | 14'), '2 | Onix + O', '2 | Onyx + O'), '+ Diament r', '+ Diamant r'), 'veau 2 | Diament rose + É', 'veau 2 | Diamant rose + É'), '3 | Onix + O', '3 | Onyx + O'), 'x + Onix | 1', 'x + Onyx | 1'), '2 | Diament ros', '2 | Diamant ros') WHERE "id" = 'ressources/accessoires';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace("corps_md", 'e + Onix | 4', 'e + Onyx | 4'), '+ Onix |', '+ Onyx |'), 'Diament', 'Diamant'), '| Onix +', '| Onyx +'), 'Onix', 'Onyx') WHERE "id" = 'ressources/accessoires';
-- page ressources/alchimie-liste-ingredients corps_md [grammaire] ×1 : « Champignon bleue » -> « Champignon bleu » (Accord avec « champignon » (masculin).)
-- page ressources/alchimie-liste-ingredients corps_md [grammaire] ×1 : « Coeur abyssale » -> « Coeur abyssal » (Accord avec « cœur » (masculin).)
-- page ressources/alchimie-liste-ingredients corps_md [grammaire] ×1 : « Coeur spatio-temporelle » -> « Coeur spatio-temporel » (Accord avec « cœur » (masculin).)
-- page ressources/alchimie-liste-ingredients corps_md [orthographe] ×2 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
-- page ressources/alchimie-liste-ingredients corps_md [grammaire] ×1 : « Gelée verte foncé » -> « Gelée vert foncé » (Couleur composée « vert foncé » : invariable (cf. « Champignon vert foncé »).)
-- page ressources/alchimie-liste-ingredients corps_md [grammaire] ×1 : « Herbe verte foncé » -> « Herbe vert foncé » (Couleur composée « vert foncé » : invariable (cf. « Champignon vert foncé »).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace("corps_md", 'n bleue |', 'n bleu |'), 'ée cyante | ', 'ée cyan | '), 'ée verte fo', 'ée vert fo'), 'abyssale', 'abyssal'), 'cyante', 'cyan'), 'e verte f', 'e vert f'), 'temporelle', 'temporel') WHERE "id" = 'ressources/alchimie-liste-ingredients';
-- page ressources/alchimie-liste-ingredients titre [grammaire] ×1 : « Liste d’ingrédient » -> « Liste d’ingrédients » (Pluriel : la page liste plusieurs ingrédients.)
UPDATE "page" SET "titre" = replace("titre", 'ingrédient', 'ingrédients') WHERE "id" = 'ressources/alchimie-liste-ingredients';
-- page ressources/armes corps_md [orthographe] ×1 : « Croc Obsidien » -> « Croc d'Obsidienne » (« obsidien » n'existe pas : le croc est en obsidienne (nom féminin).)
-- page ressources/armes corps_md [grammaire] ×1 : « Étendard déchirée » -> « Étendard déchiré » (Accord avec « étendard » (masculin).)
-- page ressources/armes corps_md [grammaire] ×1 : « Grèves cloutés » -> « Grèves cloutées » (Accord avec « grèves » (féminin pluriel).)
-- page ressources/armes corps_md [grammaire] ×1 : « les médusain » -> « les médusains » (Pluriel du nom de peuple après « les ».)
-- page ressources/armes corps_md [harmonisation] ×1 : « Origine Rock » -> « Origine Rokh » (Graphie majoritaire de la race : « Rokh » (la description dit « Cette arme Rokh »).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace("corps_md", 'Rock', 'Rokh'), 'médusain', 'médusains'), 'cloutés', 'cloutées'), 'Obsidien', 'd''Obsidien'), 'Obsidien', 'Obsidienne'), 'déchirée', 'déchiré') WHERE "id" = 'ressources/armes';
-- page ressources/armures corps_md [frappe] ×1 : « Celloluse » -> « Cellulose » (Lettres inversées : « cellulose ».)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Peau complet » -> « Armure de Peau complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Acier complet » -> « Armure Acier complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Argent complet » -> « Armure Argent complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Bronze complet » -> « Armure Bronze complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Corne/Os complet » -> « Armure Corne/Os complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Cuivre complet » -> « Armure Cuivre complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Bois complet » -> « Armure de Bois complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Cellulose complet » -> « Armure de Cellulose complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Chitine complet » -> « Armure de Chitine complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure de Corail complet » -> « Armure de Corail complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Écailles complet » -> « Armure Écailles complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Fer complet » -> « Armure Fer complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Fer Noir complet » -> « Armure Fer Noir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Fonte complet » -> « Armure Fonte complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Laiton complet » -> « Armure Laiton complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Maverium complet » -> « Armure Maverium complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Mythril complet » -> « Armure Mythril complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Or complet » -> « Armure Or complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Titane complet » -> « Armure Titane complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [grammaire] ×1 : « Armure Vif Argent complet » -> « Armure Vif Argent complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
-- page ressources/armures corps_md [orthographe] ×1 : « Souffre » -> « Soufre » (Le minéral s'écrit « soufre » (« souffre » est le verbe souffrir).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'Souffre', 'Soufre'), 'u complet |', 'u complète |'), 'uir complet | 3', 'uir complète | 3'), 'is complet | ', 'is complète | '), 'se complet | ', 'se complète | '), 'Celloluse', 'Cellulose'), 'ail complet | 1', 'ail complète | 1'), 'ine complet | 1', 'ine complète | 1') WHERE "id" = 'ressources/armures';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'l complet |', 'l complète |'), 'Fer complet | 1', 'Fer complète | 1'), 'er complet | ', 'er complète | '), 'ir complet | ', 'ir complète | '), 'Os complet | ', 'Os complète | '), 're complet | ', 're complète | '), 's complet |', 's complète |'), 'ent complet | 3', 'ent complète | 3') WHERE "id" = 'ressources/armures';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace("corps_md", 't complet |', 't complète |'), 'te complet | ', 'te complète | '), 'ze complet | ', 'ze complète | '), 'n complet |', 'n complète |'), 'r complet |', 'r complète |'), 'e complet |', 'e complète |'), ' complet ', ' complète ') WHERE "id" = 'ressources/armures';
-- page ressources/baton-magique corps_md [orthographe] ×1 : « Mancelinier » -> « Mancenillier » (L'arbre toxique s'écrit « mancenillier ».)
-- page ressources/baton-magique corps_md [orthographe] ×1 : « Onix » -> « Onyx » (La pierre s'écrit « onyx ».)
UPDATE "page" SET "corps_md" = replace(replace("corps_md", 'Onix', 'Onyx'), 'Mancelinier', 'Mancenillier') WHERE "id" = 'ressources/baton-magique';
-- page ressources/bouclier corps_md [orthographe] ×22 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
-- page ressources/bouclier corps_md [orthographe] ×1 : « Souffre » -> « Soufre » (Le minéral s'écrit « soufre » (« souffre » est le verbe souffrir).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'Souffre', 'Soufre'), '| Pavoi |', '| Pavois |'), ' Pavoi
', ' Pavois
'), 'r | Pavoi Cui', 'r | Pavois Cui'), ' | Pavoi Bo', ' | Pavois Bo'), ' | Pavoi Ce', ' | Pavois Ce'), 'l | Pavoi Cor', 'l | Pavois Cor'), ' | Pavoi Ch', ' | Pavois Ch') WHERE "id" = 'ressources/bouclier';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", ' | Pavoi My', ' | Pavois My'), 'er | Pavoi Fer ', 'er | Pavois Fer '), ' | Pavoi Ac', ' | Pavois Ac'), ' | Pavoi Fe', ' | Pavois Fe'), ' | Pavoi Co', ' | Pavois Co'), '| Pavoi C', '| Pavois C'), '| Pavoi É', '| Pavois É'), '| Pavoi V', '| Pavois V') WHERE "id" = 'ressources/bouclier';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace("corps_md", '| Pavoi A', '| Pavois A'), '| Pavoi F', '| Pavois F'), '| Pavoi B', '| Pavois B'), '| Pavoi L', '| Pavois L'), '| Pavoi O', '| Pavois O'), '| Pavoi T', '| Pavois T'), ' Pavoi ', ' Pavois ') WHERE "id" = 'ressources/bouclier';
-- page ressources/equipement-inventaire corps_md [grammaire] ×1 : « 1kg de oeuf, 20 oeufs » -> « 1kg d'oeufs, 20 oeufs » (Élision obligatoire et même nombre que « 20 oeufs ».)
-- page ressources/equipement-inventaire corps_md [grammaire] ×1 : « Fiole en verre (Moyen) » -> « Fiole en verre (Moyenne) » (Accord avec « fiole » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'de oeuf', 'd''oeuf'), '''oeuf,', '''oeufs,'), 'Moyen', 'Moyenne') WHERE "id" = 'ressources/equipement-inventaire';
-- page ressources/familiers corps_md [orthographe] ×1 : « techtonique » -> « tectonique » (« tectonique » s'écrit sans h.)
UPDATE "page" SET "corps_md" = replace("corps_md", 'techtonique', 'tectonique') WHERE "id" = 'ressources/familiers';
-- page ressources/fiole-cyante corps_md [orthographe] ×5 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace("corps_md", 'te fiole cyante |  |  |
', 'te fiole cyan |  |  |
'), 'e cyante m', 'e cyan m'), 'r fiole cyante |  |  |', 'r fiole cyan |  |  |'), 'a fiole cyante |  |  |', 'a fiole cyan |  |  |'), 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante';
-- page ressources/fiole-cyante titre [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "page" SET "titre" = replace("titre", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante';
-- page ressources/fiole-verte-fonce titre [grammaire] ×1 : « Fiole verte foncé » -> « Fiole verte foncée » (Même accord que les autres objets de la page (« fiole verte foncée »).)
UPDATE "page" SET "titre" = replace("titre", 'foncé', 'foncée') WHERE "id" = 'ressources/fiole-verte-fonce';
-- page ressources/huile-hemophile corps_md [grammaire] ×1 : « Huile Hémophilie » -> « Huile Hémophile » (Le titre et les objets de la page s'appellent « huile hémophile » (adjectif).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Hémophilie', 'Hémophile') WHERE "id" = 'ressources/huile-hemophile';
-- page ressources/huile-hemophile resume [grammaire] ×1 : « Huile Hémophilie » -> « Huile Hémophile » (Le titre et les objets de la page s'appellent « huile hémophile » (adjectif).)
UPDATE "page" SET "resume" = replace("resume", 'Hémophilie', 'Hémophile') WHERE "id" = 'ressources/huile-hemophile';
-- page ressources/livre-parchemin corps_md [grammaire] ×1 : « 1kg de oeuf, 20 oeufs » -> « 1kg d'oeufs, 20 oeufs » (Élision obligatoire et même nombre que « 20 oeufs ».)
-- page ressources/livre-parchemin corps_md [frappe] ×1 : « Pachemin » -> « Parchemin » (Lettre manquante : « parchemin ».)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'Pachemin', 'Parchemin'), 'de oeuf', 'd''oeuf'), '''oeuf,', '''oeufs,') WHERE "id" = 'ressources/livre-parchemin';
-- page ressources/livre-parchemin titre [ponctuation] ×1 : « LivreParchemin » -> « Livre/Parchemin » (Deux mots collés (sections « Livre » et « Parchemin »), comme « Machine de Guerre/Siège ».)
UPDATE "page" SET "titre" = replace("titre", 'LivreParchemin', 'Livre/Parchemin') WHERE "id" = 'ressources/livre-parchemin';
-- page ressources/machine-de-guerresiege titre [ponctuation] ×1 : « Machine de GuerreSiège » -> « Machine de Guerre/Siège » (Deux mots collés (« Guerre » et « Siège »).)
UPDATE "page" SET "titre" = replace("titre", 'GuerreSiège', 'Guerre/Siège') WHERE "id" = 'ressources/machine-de-guerresiege';
-- page ressources/maladie corps_md [grammaire] ×1 : « Altératis Brune » -> « Altératis Brun » (Les autres Altératis portent une couleur au masculin (Bleu, Vert).)
UPDATE "page" SET "corps_md" = replace("corps_md", 'Brune', 'Brun') WHERE "id" = 'ressources/maladie';
-- page ressources/objets-de-depart-des-classes corps_md [orthographe] ×1 : « Brevage » -> « Breuvage » (« breuvage » s'écrit -eu-.)
-- page ressources/objets-de-depart-des-classes corps_md [grammaire] ×1 : « huile hémophilie » -> « huile hémophile » (Le titre et les objets de la page s'appellent « huile hémophile » (adjectif).)
-- page ressources/objets-de-depart-des-classes corps_md [grammaire] ×1 : « Panacée mineur » -> « Panacée mineure » (Accord avec « panacée » (féminin).)
-- page ressources/objets-de-depart-des-classes corps_md [grammaire] ×1 : « Pierre à aiguisé » -> « Pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
-- page ressources/objets-de-depart-des-classes corps_md [grammaire] ×1 : « Plume à gravé » -> « Plume à graver » (Infinitif après « à » : « plume à graver ».)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace("corps_md", 'Brevage', 'Breuvage'), 'e mineur |', 'e mineure |'), 'aiguisé', 'aiguiser'), 'à gravé |', 'à graver |'), 'hémophilie', 'hémophile') WHERE "id" = 'ressources/objets-de-depart-des-classes';
-- page ressources/panacee corps_md [grammaire] ×1 : « Panacée majeur » -> « Panacée majeure » (Accord avec « panacée » (féminin).)
-- page ressources/panacee corps_md [grammaire] ×1 : « Panacée mineur » -> « Panacée mineure » (Accord avec « panacée » (féminin).)
-- page ressources/panacee corps_md [grammaire] ×1 : « Panacée parfait » -> « Panacée parfaite » (Accord avec « panacée » (féminin).)
UPDATE "page" SET "corps_md" = replace(replace(replace("corps_md", 'mineur', 'mineure'), 'majeur', 'majeure'), 'parfait', 'parfaite') WHERE "id" = 'ressources/panacee';
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Absentisme » -> « Absentéisme » (Le mot s'écrit « absentéisme ».)
-- page ressources/pieces-elementaires corps_md [grammaire] ×1 : « Carapace des flamboiement » -> « Carapace des flamboiements » (Pluriel après « des ».)
-- page ressources/pieces-elementaires corps_md [grammaire] ×1 : « Charge éolien » -> « Charge éolienne » (Accord avec « charge » (féminin).)
-- page ressources/pieces-elementaires corps_md [frappe] ×2 : « Comdamnation » -> « Condamnation » (Frappe : « condamnation ».)
-- page ressources/pieces-elementaires corps_md [grammaire] ×1 : « Concentration gelé » -> « Concentration gelée » (Accord avec « concentration » (féminin).)
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Entrave frigorifière » -> « Entrave frigorifique » (« frigorifière » n'existe pas : « frigorifique ».)
-- page ressources/pieces-elementaires corps_md [frappe] ×1 : « Espace/Yemps » -> « Espace/Temps » (Frappe dans le nom de la magie Espace/Temps.)
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Exanguination » -> « Exsanguination » (Le mot s'écrit « exsanguination ».)
-- page ressources/pieces-elementaires corps_md [accent] ×9 : « LUMIERE » -> « LUMIÈRE » (Accent conservé en majuscule (cf. « NÉCROMANCIE »).)
-- page ressources/pieces-elementaires corps_md [frappe] ×1 : « Mélallomorphique » -> « Métallomorphique » (Frappe : « métal » + « morphique ».)
-- page ressources/pieces-elementaires corps_md [grammaire] ×1 : « Neutralité forcé » -> « Neutralité forcée » (Accord avec « neutralité » (féminin).)
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Onde glacière » -> « Onde glaciaire » (« glacière » est un nom ; l'adjectif est « glaciaire ».)
-- page ressources/pieces-elementaires corps_md [grammaire] ×1 : « Pichenette pointu » -> « Pichenette pointue » (Accord avec « pichenette » (féminin).)
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Poussé d'air » -> « Poussée d'air » (Le nom est « poussée » (féminin).)
-- page ressources/pieces-elementaires corps_md [orthographe] ×1 : « Suriken » -> « Shuriken » (« shuriken » (cf. « Shuriken de Vent »).)
-- page ressources/pieces-elementaires corps_md [casse] ×1 : « Colonne tesla » -> « Colonne Tesla » (« Tesla » est un nom propre (Nikola Tesla).)
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'Mélallomorphique', 'Métallomorphique'), '|
| LUMIERE | É', '|
| LUMIÈRE | É'), 'é forcé (', 'é forcée ('), '|
| LUMIERE | D', '|
| LUMIÈRE | D'), 'Yemps', 'Temps'), 'glacière', 'glaciaire'), '|
| LUMIERE | M', '|
| LUMIÈRE | M'), '|
| LUMIERE | H', '|
| LUMIÈRE | H') WHERE "id" = 'ressources/pieces-elementaires';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'n gelé (', 'n gelée ('), 'Poussé', 'Poussée'), '|
| LUMIERE | L', '|
| LUMIÈRE | L'), 'Exanguination', 'Exsanguination'), 'éolien', 'éolienne'), '|
| LUMIERE | G', '|
| LUMIÈRE | G'), '|
| LUMIERE | B', '|
| LUMIÈRE | B'), 'Absentisme', 'Absentéisme') WHERE "id" = 'ressources/pieces-elementaires';
UPDATE "page" SET "corps_md" = replace(replace(replace(replace(replace(replace(replace(replace("corps_md", 'tesla', 'Tesla'), '. |
| LUMIERE | Arc', '. |
| LUMIÈRE | Arc'), 'ément Sang | Comdamnation (passif) : L', 'ément Sang | Condamnation (passif) : L'), 'frigorifière', 'frigorifique'), 'LUMIERE', 'LUMIÈRE'), 'pointu', 'pointue'), 'Comdamnation', 'Condamnation'), 'Suriken', 'Shuriken') WHERE "id" = 'ressources/pieces-elementaires';
UPDATE "page" SET "corps_md" = replace("corps_md", 'flamboiement', 'flamboiements') WHERE "id" = 'ressources/pieces-elementaires';
-- arme ressources/armes#arme:arme-de-monstres:etendard-dechiree nom [grammaire] ×1 : « Étendard déchirée » -> « Étendard déchiré » (Accord avec « étendard » (masculin).)
UPDATE "arme" SET "nom" = replace("nom", 'déchirée', 'déchiré') WHERE "id" = 'ressources/armes#arme:arme-de-monstres:etendard-dechiree';
-- arme ressources/armes#arme:arme-de-monstres:etendard-dechiree nom_brut [grammaire] ×1 : « Étendard déchirée » -> « Étendard déchiré » (Accord avec « étendard » (masculin).)
UPDATE "arme" SET "nom_brut" = replace("nom_brut", 'déchirée', 'déchiré') WHERE "id" = 'ressources/armes#arme:arme-de-monstres:etendard-dechiree';
-- arme ressources/armes#arme:baton-de-combat:croc-obsidien nom [orthographe] ×1 : « Croc Obsidien » -> « Croc d'Obsidienne » (« obsidien » n'existe pas : le croc est en obsidienne (nom féminin).)
UPDATE "arme" SET "nom" = replace(replace("nom", 'Obsidien', 'd''Obsidien'), 'Obsidien', 'Obsidienne') WHERE "id" = 'ressources/armes#arme:baton-de-combat:croc-obsidien';
-- arme ressources/armes#arme:baton-de-combat:croc-obsidien nom_brut [orthographe] ×1 : « Croc Obsidien » -> « Croc d'Obsidienne » (« obsidien » n'existe pas : le croc est en obsidienne (nom féminin).)
UPDATE "arme" SET "nom_brut" = replace(replace("nom_brut", 'Obsidien', 'd''Obsidien'), 'Obsidien', 'Obsidienne') WHERE "id" = 'ressources/armes#arme:baton-de-combat:croc-obsidien';
-- arme ressources/armes#arme:hache:tomahawk effet [harmonisation] ×1 : « Origine Rock » -> « Origine Rokh » (Graphie majoritaire de la race : « Rokh » (la description dit « Cette arme Rokh »).)
UPDATE "arme" SET "effet" = replace("effet", 'Rock', 'Rokh') WHERE "id" = 'ressources/armes#arme:hache:tomahawk';
-- arme ressources/armes#arme:hache:tomahawk provenance [harmonisation] ×1 : « Rock » -> « Rokh » (Graphie majoritaire de la race : « Rokh ».)
UPDATE "arme" SET "provenance" = replace("provenance", 'Rock', 'Rokh') WHERE "id" = 'ressources/armes#arme:hache:tomahawk';
-- arme ressources/armes#arme:lance-arme-dhast:lance-shotel description [grammaire] ×1 : « les médusain » -> « les médusains » (Pluriel du nom de peuple après « les ».)
UPDATE "arme" SET "description" = replace("description", 'médusain', 'médusains') WHERE "id" = 'ressources/armes#arme:lance-arme-dhast:lance-shotel';
-- arme ressources/armes#arme:pugilat:greves-cloutes nom [grammaire] ×1 : « Grèves cloutés » -> « Grèves cloutées » (Accord avec « grèves » (féminin pluriel).)
UPDATE "arme" SET "nom" = replace("nom", 'cloutés', 'cloutées') WHERE "id" = 'ressources/armes#arme:pugilat:greves-cloutes';
-- arme ressources/armes#arme:pugilat:greves-cloutes nom_brut [grammaire] ×1 : « Grèves cloutés » -> « Grèves cloutées » (Accord avec « grèves » (féminin pluriel).)
UPDATE "arme" SET "nom_brut" = replace("nom_brut", 'cloutés', 'cloutées') WHERE "id" = 'ressources/armes#arme:pugilat:greves-cloutes';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:glace capacite_brut [orthographe] ×1 : « Entrave frigorifière » -> « Entrave frigorifique » (« frigorifière » n'existe pas : « frigorifique ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'frigorifière', 'frigorifique') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:glace capacite_nom [orthographe] ×1 : « Entrave frigorifière » -> « Entrave frigorifique » (« frigorifière » n'existe pas : « frigorifique ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'frigorifière', 'frigorifique') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:ombre capacite_brut [grammaire] ×1 : « Pichenette pointu » -> « Pichenette pointue » (Accord avec « pichenette » (féminin).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'pointu', 'pointue') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:ombre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:ombre capacite_nom [grammaire] ×1 : « Pichenette pointu » -> « Pichenette pointue » (Accord avec « pichenette » (féminin).)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'pointu', 'pointue') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:ombre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:sang capacite_brut [frappe] ×1 : « Comdamnation » -> « Condamnation » (Frappe : « condamnation ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Comdamnation', 'Condamnation') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arbalete:sang capacite_nom [frappe] ×1 : « Comdamnation » -> « Condamnation » (Frappe : « condamnation ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Comdamnation', 'Condamnation') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arbalete:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arc:foudre capacite_brut [casse] ×1 : « Colonne tesla » -> « Colonne Tesla » (« Tesla » est un nom propre (Nikola Tesla).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'tesla', 'Tesla') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arc:foudre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arc:foudre capacite_texte [casse] ×1 : « Colonne tesla » -> « Colonne Tesla » (« Tesla » est un nom propre (Nikola Tesla).)
UPDATE "arme_elementaire" SET "capacite_texte" = replace("capacite_texte", 'tesla', 'Tesla') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arc:foudre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arc:necromancie capacite_brut [orthographe] ×1 : « Absentisme » -> « Absentéisme » (Le mot s'écrit « absentéisme ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Absentisme', 'Absentéisme') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arc:necromancie';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arc:necromancie capacite_nom [orthographe] ×1 : « Absentisme » -> « Absentéisme » (Le mot s'écrit « absentéisme ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Absentisme', 'Absentéisme') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arc:necromancie';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-de-jet:eau nom [orthographe] ×1 : « Suriken » -> « Shuriken » (« shuriken » (cf. « Shuriken de Vent »).)
UPDATE "arme_elementaire" SET "nom" = replace("nom", 'Suriken', 'Shuriken') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-de-jet:eau';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-de-jet:sang capacite_brut [frappe] ×1 : « Comdamnation » -> « Condamnation » (Frappe : « condamnation ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Comdamnation', 'Condamnation') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-de-jet:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-de-jet:sang capacite_nom [frappe] ×1 : « Comdamnation » -> « Condamnation » (Frappe : « condamnation ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Comdamnation', 'Condamnation') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-de-jet:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-dhast:glace capacite_brut [grammaire] ×1 : « Concentration gelé » -> « Concentration gelée » (Accord avec « concentration » (féminin).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'gelé', 'gelée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-dhast:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-dhast:glace capacite_nom [grammaire] ×1 : « Concentration gelé » -> « Concentration gelée » (Accord avec « concentration » (féminin).)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'gelé', 'gelée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-dhast:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-dhast:vent capacite_brut [orthographe] ×1 : « Poussé d'air » -> « Poussée d'air » (Le nom est « poussée » (féminin).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Poussé', 'Poussée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-dhast:vent';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:arme-dhast:vent capacite_nom [orthographe] ×1 : « Poussé d'air » -> « Poussée d'air » (Le nom est « poussée » (féminin).)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Poussé', 'Poussée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:arme-dhast:vent';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:dague:arcane capacite_brut [grammaire] ×1 : « Neutralité forcé » -> « Neutralité forcée » (Accord avec « neutralité » (féminin).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'forcé', 'forcée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:dague:arcane';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:dague:arcane capacite_nom [grammaire] ×1 : « Neutralité forcé » -> « Neutralité forcée » (Accord avec « neutralité » (féminin).)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'forcé', 'forcée') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:dague:arcane';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:epee:terre capacite_brut [frappe] ×1 : « Mélallomorphique » -> « Métallomorphique » (Frappe : « métal » + « morphique ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Mélallomorphique', 'Métallomorphique') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:epee:terre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:epee:terre capacite_nom [frappe] ×1 : « Mélallomorphique » -> « Métallomorphique » (Frappe : « métal » + « morphique ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Mélallomorphique', 'Métallomorphique') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:epee:terre';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:masse:espace-temps capacite_brut [frappe] ×1 : « Espace/Yemps » -> « Espace/Temps » (Frappe dans le nom de la magie Espace/Temps.)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Yemps', 'Temps') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:masse:espace-temps';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:masse:espace-temps capacite_texte [frappe] ×1 : « Espace/Yemps » -> « Espace/Temps » (Frappe dans le nom de la magie Espace/Temps.)
UPDATE "arme_elementaire" SET "capacite_texte" = replace("capacite_texte", 'Yemps', 'Temps') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:masse:espace-temps';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:masse:glace capacite_brut [orthographe] ×1 : « Onde glacière » -> « Onde glaciaire » (« glacière » est un nom ; l'adjectif est « glaciaire ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'glacière', 'glaciaire') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:masse:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:masse:glace capacite_nom [orthographe] ×1 : « Onde glacière » -> « Onde glaciaire » (« glacière » est un nom ; l'adjectif est « glaciaire ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'glacière', 'glaciaire') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:masse:glace';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:pugilat:sang capacite_brut [orthographe] ×1 : « Exanguination » -> « Exsanguination » (Le mot s'écrit « exsanguination ».)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'Exanguination', 'Exsanguination') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:pugilat:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:pugilat:sang capacite_nom [orthographe] ×1 : « Exanguination » -> « Exsanguination » (Le mot s'écrit « exsanguination ».)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'Exanguination', 'Exsanguination') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:pugilat:sang';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:pugilat:vent capacite_brut [grammaire] ×1 : « Charge éolien » -> « Charge éolienne » (Accord avec « charge » (féminin).)
UPDATE "arme_elementaire" SET "capacite_brut" = replace("capacite_brut", 'éolien', 'éolienne') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:pugilat:vent';
-- arme_elementaire ressources/pieces-elementaires#arme-elementaire:pugilat:vent capacite_nom [grammaire] ×1 : « Charge éolien » -> « Charge éolienne » (Accord avec « charge » (féminin).)
UPDATE "arme_elementaire" SET "capacite_nom" = replace("capacite_nom", 'éolien', 'éolienne') WHERE "id" = 'ressources/pieces-elementaires#arme-elementaire:pugilat:vent';
-- armure ressources/armures#armure:armure-acier-complet nom [grammaire] ×1 : « Armure Acier complet » -> « Armure Acier complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-acier-complet';
-- armure ressources/armures#armure:armure-argent-complet nom [grammaire] ×1 : « Armure Argent complet » -> « Armure Argent complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-argent-complet';
-- armure ressources/armures#armure:armure-bronze-complet nom [grammaire] ×1 : « Armure Bronze complet » -> « Armure Bronze complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-bronze-complet';
-- armure ressources/armures#armure:armure-celloluse-acier nom [frappe] ×1 : « Celloluse » -> « Cellulose » (Lettres inversées : « cellulose ».)
UPDATE "armure" SET "nom" = replace("nom", 'Celloluse', 'Cellulose') WHERE "id" = 'ressources/armures#armure:armure-celloluse-acier';
-- armure ressources/armures#armure:armure-corne-os-complet nom [grammaire] ×1 : « Armure Corne/Os complet » -> « Armure Corne/Os complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-corne-os-complet';
-- armure ressources/armures#armure:armure-cuivre-complet nom [grammaire] ×1 : « Armure Cuivre complet » -> « Armure Cuivre complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-cuivre-complet';
-- armure ressources/armures#armure:armure-de-bois-complet nom [grammaire] ×1 : « Armure de Bois complet » -> « Armure de Bois complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-bois-complet';
-- armure ressources/armures#armure:armure-de-cellulose-complet nom [grammaire] ×1 : « Armure de Cellulose complet » -> « Armure de Cellulose complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-cellulose-complet';
-- armure ressources/armures#armure:armure-de-chitine-complet nom [grammaire] ×1 : « Armure de Chitine complet » -> « Armure de Chitine complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-chitine-complet';
-- armure ressources/armures#armure:armure-de-corail-complet nom [grammaire] ×1 : « Armure de Corail complet » -> « Armure de Corail complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-corail-complet';
-- armure ressources/armures#armure:armure-de-cuir-complet nom [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-cuir-complet';
-- armure ressources/armures#armure:armure-de-peau-complet nom [grammaire] ×1 : « Armure de Peau complet » -> « Armure de Peau complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-de-peau-complet';
-- armure ressources/armures#armure:armure-ecailles-complet nom [grammaire] ×1 : « Armure Écailles complet » -> « Armure Écailles complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-ecailles-complet';
-- armure ressources/armures#armure:armure-fer-complet nom [grammaire] ×1 : « Armure Fer complet » -> « Armure Fer complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-fer-complet';
-- armure ressources/armures#armure:armure-fer-noir-complet nom [grammaire] ×1 : « Armure Fer Noir complet » -> « Armure Fer Noir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-fer-noir-complet';
-- armure ressources/armures#armure:armure-fonte-complet nom [grammaire] ×1 : « Armure Fonte complet » -> « Armure Fonte complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-fonte-complet';
-- armure ressources/armures#armure:armure-laiton-complet nom [grammaire] ×1 : « Armure Laiton complet » -> « Armure Laiton complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-laiton-complet';
-- armure ressources/armures#armure:armure-maverium-complet nom [grammaire] ×1 : « Armure Maverium complet » -> « Armure Maverium complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-maverium-complet';
-- armure ressources/armures#armure:armure-mythril-complet nom [grammaire] ×1 : « Armure Mythril complet » -> « Armure Mythril complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-mythril-complet';
-- armure ressources/armures#armure:armure-or-complet nom [grammaire] ×1 : « Armure Or complet » -> « Armure Or complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-or-complet';
-- armure ressources/armures#armure:armure-titane-complet nom [grammaire] ×1 : « Armure Titane complet » -> « Armure Titane complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-titane-complet';
-- armure ressources/armures#armure:armure-vif-argent-complet nom [grammaire] ×1 : « Armure Vif Argent complet » -> « Armure Vif Argent complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "armure" SET "nom" = replace("nom", 'complet', 'complète') WHERE "id" = 'ressources/armures#armure:armure-vif-argent-complet';
-- armure_elementaire ressources/pieces-elementaires#armure-elementaire:intermediaire:feu nom [grammaire] ×1 : « Carapace des flamboiement » -> « Carapace des flamboiements » (Pluriel après « des ».)
UPDATE "armure_elementaire" SET "nom" = replace("nom", 'flamboiement', 'flamboiements') WHERE "id" = 'ressources/pieces-elementaires#armure-elementaire:intermediaire:feu';
-- bouclier ressources/bouclier#bouclier:pavoi:acier nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:acier';
-- bouclier ressources/bouclier#bouclier:pavoi:argent nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:argent';
-- bouclier ressources/bouclier#bouclier:pavoi:bois nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:bois';
-- bouclier ressources/bouclier#bouclier:pavoi:bronze nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:bronze';
-- bouclier ressources/bouclier#bouclier:pavoi:cellulose nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:cellulose';
-- bouclier ressources/bouclier#bouclier:pavoi:chitine nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:chitine';
-- bouclier ressources/bouclier#bouclier:pavoi:corail nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:corail';
-- bouclier ressources/bouclier#bouclier:pavoi:corne-os nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:corne-os';
-- bouclier ressources/bouclier#bouclier:pavoi:cuir nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:cuir';
-- bouclier ressources/bouclier#bouclier:pavoi:cuivre nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:cuivre';
-- bouclier ressources/bouclier#bouclier:pavoi:ecailles nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:ecailles';
-- bouclier ressources/bouclier#bouclier:pavoi:fer nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:fer';
-- bouclier ressources/bouclier#bouclier:pavoi:fer-noir nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:fer-noir';
-- bouclier ressources/bouclier#bouclier:pavoi:fonte nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:fonte';
-- bouclier ressources/bouclier#bouclier:pavoi:laiton nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:laiton';
-- bouclier ressources/bouclier#bouclier:pavoi:maverium nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:maverium';
-- bouclier ressources/bouclier#bouclier:pavoi:mythril nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:mythril';
-- bouclier ressources/bouclier#bouclier:pavoi:or nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:or';
-- bouclier ressources/bouclier#bouclier:pavoi:titane nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:titane';
-- bouclier ressources/bouclier#bouclier:pavoi:vif-argent nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'ressources/bouclier#bouclier:pavoi:vif-argent';
-- bouclier_classe pavoi nom [orthographe] ×1 : « Pavoi » -> « Pavois » (Le grand bouclier s'écrit « pavois » (invariable), comme dans le texte de la page.)
UPDATE "bouclier_classe" SET "nom" = replace("nom", 'Pavoi', 'Pavois') WHERE "id" = 'pavoi';
-- capacite capacites/anansi-anti-corps nom [orthographe] ×1 : « Anti-corps » -> « Anticorps » (Le nom s'écrit en un mot : « anticorps ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Anti-corps', 'Anticorps') WHERE "id" = 'capacites/anansi-anti-corps';
-- capacite capacites/anansi-attention-migale nom [orthographe] ×1 : « Attention migale » -> « Attention mygale » (L'araignée s'écrit « mygale ».)
UPDATE "capacite" SET "nom" = replace("nom", 'migale', 'mygale') WHERE "id" = 'capacites/anansi-attention-migale';
-- capacite capacites/archimage-pacte-noire nom [grammaire] ×1 : « Pacte Noire » -> « Pacte Noir » (« pacte » est masculin.)
UPDATE "capacite" SET "nom" = replace("nom", 'Noire', 'Noir') WHERE "id" = 'capacites/archimage-pacte-noire';
-- capacite capacites/barde-bain-de-foules nom [grammaire] ×1 : « Bain de foules » -> « Bain de foule » (Expression figée « bain de foule ».)
UPDATE "capacite" SET "nom" = replace("nom", 'foules', 'foule') WHERE "id" = 'capacites/barde-bain-de-foules';
-- capacite capacites/barde-balade-guerriere nom [orthographe] ×1 : « Balade guerrière » -> « Ballade guerrière » (Chant : « ballade » (« balade » est une promenade).)
UPDATE "capacite" SET "nom" = replace("nom", 'Balade', 'Ballade') WHERE "id" = 'capacites/barde-balade-guerriere';
-- capacite capacites/bimane-frappe-fatiguante nom [orthographe] ×1 : « Frappe fatiguante » -> « Frappe fatigante » (L'adjectif s'écrit « fatigant(e) » (le participe est « fatiguant »).)
UPDATE "capacite" SET "nom" = replace("nom", 'fatiguante', 'fatigante') WHERE "id" = 'capacites/bimane-frappe-fatiguante';
-- capacite capacites/clerc-tend-lautre-joue nom [grammaire] ×1 : « Tend l'autre joue » -> « Tends l'autre joue » (Impératif de « tendre » à la 2e personne : « tends ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Tend', 'Tends') WHERE "id" = 'capacites/clerc-tend-lautre-joue';
-- capacite capacites/cuirasse-tu-passe-pas nom [grammaire] ×1 : « Tu passe pas » -> « Tu passes pas » (2e personne du singulier : « tu passes ».)
UPDATE "capacite" SET "nom" = replace("nom", 'passe', 'passes') WHERE "id" = 'capacites/cuirasse-tu-passe-pas';
-- capacite capacites/fenrir-griffe-sanglant nom [grammaire] ×1 : « Griffe sanglant » -> « Griffe sanglante » (Accord avec « griffe » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'sanglant', 'sanglante') WHERE "id" = 'capacites/fenrir-griffe-sanglant';
-- capacite capacites/flagelleur-dit-mon-nom nom [grammaire] ×1 : « Dit mon nom » -> « Dis mon nom » (Impératif de « dire » à la 2e personne : « dis ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Dit', 'Dis') WHERE "id" = 'capacites/flagelleur-dit-mon-nom';
-- capacite capacites/flagelleur-puni-moi nom [grammaire] ×1 : « Puni-moi » -> « Punis-moi » (Impératif de « punir » à la 2e personne : « punis ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Puni', 'Punis') WHERE "id" = 'capacites/flagelleur-puni-moi';
-- capacite capacites/frappeur-asymbiotique effet [frappe] ×1 : « Frappeud » -> « Frappeur » (Nom de la classe : « Frappeur ».)
UPDATE "capacite" SET "effet" = replace("effet", 'Frappeud', 'Frappeur') WHERE "id" = 'capacites/frappeur-asymbiotique';
-- capacite capacites/frappeur-distracteur effet [orthographe] ×1 : « Vigilence » -> « Vigilance » (Le nom s'écrit « vigilance ».)
UPDATE "capacite" SET "effet" = replace("effet", 'Vigilence', 'Vigilance') WHERE "id" = 'capacites/frappeur-distracteur';
-- capacite capacites/goleois-balade-barbare nom [orthographe] ×1 : « Balade barbare » -> « Ballade barbare » (Chant : « ballade » (« balade » est une promenade).)
UPDATE "capacite" SET "nom" = replace("nom", 'Balade', 'Ballade') WHERE "id" = 'capacites/goleois-balade-barbare';
-- capacite capacites/grenadier-attend nom [grammaire] ×1 : « Attend ... » -> « Attends ... » (Impératif de « attendre » à la 2e personne : « attends ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Attend', 'Attends') WHERE "id" = 'capacites/grenadier-attend';
-- capacite capacites/guerrier-contre-coup nom [orthographe] ×1 : « Contre coup » -> « Contrecoup » (Le nom s'écrit en un mot : « contrecoup ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Contre coup', 'Contrecoup') WHERE "id" = 'capacites/guerrier-contre-coup';
-- capacite capacites/kitsune-vif-allure nom [grammaire] ×1 : « Vif allure » -> « Vive allure » (« allure » est féminin : « à vive allure ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Vif', 'Vive') WHERE "id" = 'capacites/kitsune-vif-allure';
-- capacite capacites/lancier-riposte-infini nom [grammaire] ×1 : « Riposte infini » -> « Riposte infinie » (Accord avec « riposte » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'infini', 'infinie') WHERE "id" = 'capacites/lancier-riposte-infini';
-- capacite capacites/maclier-prise-alternatif nom [grammaire] ×1 : « Prise alternatif » -> « Prise alternative » (Accord avec « prise » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'alternatif', 'alternative') WHERE "id" = 'capacites/maclier-prise-alternatif';
-- capacite capacites/mage-soin-etrange remarque [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "capacite" SET "remarque" = replace("remarque", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'capacites/mage-soin-etrange';
-- capacite capacites/mage-vert-meilleur-attaque nom [grammaire] ×1 : « Meilleur attaque » -> « Meilleure attaque » (Accord avec « attaque » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'Meilleur', 'Meilleure') WHERE "id" = 'capacites/mage-vert-meilleur-attaque';
-- capacite capacites/martiale-force-inne nom [grammaire] ×1 : « Force inné » -> « Force innée » (Accord avec « force » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'inné', 'innée') WHERE "id" = 'capacites/martiale-force-inne';
-- capacite capacites/martiale-rage-audacieux nom [grammaire] ×1 : « Rage audacieux » -> « Rage audacieuse » (Accord avec « rage » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'audacieux', 'audacieuse') WHERE "id" = 'capacites/martiale-rage-audacieux';
-- capacite capacites/martiale-rage-prudent nom [grammaire] ×1 : « Rage prudent » -> « Rage prudente » (Accord avec « rage » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'prudent', 'prudente') WHERE "id" = 'capacites/martiale-rage-prudent';
-- capacite capacites/mercenaire-je-te-choisi nom [grammaire] ×1 : « Je te choisi » -> « Je te choisis » (Présent de « choisir » à la 1re personne : « je choisis ».)
UPDATE "capacite" SET "nom" = replace("nom", 'choisi', 'choisis') WHERE "id" = 'capacites/mercenaire-je-te-choisi';
-- capacite capacites/minotaure-parceque nom [ponctuation] ×1 : « ParceQUE » -> « Parce QUE » (Locution en deux mots (les capitales du cri sont gardées).)
UPDATE "capacite" SET "nom" = replace("nom", 'ParceQUE', 'Parce QUE') WHERE "id" = 'capacites/minotaure-parceque';
-- capacite capacites/moine-prend-ca nom [grammaire] ×1 : « Prend ça » -> « Prends ça » (Impératif de « prendre » à la 2e personne : « prends ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Prend', 'Prends') WHERE "id" = 'capacites/moine-prend-ca';
-- capacite capacites/moine-tu-vivra nom [grammaire] ×1 : « Tu vivra » -> « Tu vivras » (Futur de « vivre » à la 2e personne : « tu vivras ».)
UPDATE "capacite" SET "nom" = replace("nom", 'vivra', 'vivras') WHERE "id" = 'capacites/moine-tu-vivra';
-- capacite capacites/namazu-dent-infecte nom [grammaire] ×1 : « Dent Infecté » -> « Dent Infectée » (Accord avec « dent » (féminin).)
UPDATE "capacite" SET "nom" = replace("nom", 'Infecté', 'Infectée') WHERE "id" = 'capacites/namazu-dent-infecte';
-- capacite capacites/pugiliste-a-deux-main nom [grammaire] ×1 : « A deux Main » -> « À deux Mains » (Préposition « à » accentuée et pluriel après « deux ».)
UPDATE "capacite" SET "nom" = replace(replace("nom", 'A', 'À'), 'Main', 'Mains') WHERE "id" = 'capacites/pugiliste-a-deux-main';
-- capacite capacites/pugiliste-suplexe nom [orthographe] ×1 : « Suplexe » -> « Suplex » (La prise de catch s'écrit « suplex ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Suplexe', 'Suplex') WHERE "id" = 'capacites/pugiliste-suplexe';
-- capacite capacites/tueur-anti-corps nom [orthographe] ×1 : « Anti corps » -> « Anticorps » (Le nom s'écrit en un mot : « anticorps ».)
UPDATE "capacite" SET "nom" = replace("nom", 'Anti corps', 'Anticorps') WHERE "id" = 'capacites/tueur-anti-corps';
-- capacite capacites/tueur-innaretable nom [orthographe] ×1 : « innarêtable » -> « inarrêtable » (« inarrêtable » : un n, deux r.)
UPDATE "capacite" SET "nom" = replace("nom", 'innarêtable', 'inarrêtable') WHERE "id" = 'capacites/tueur-innaretable';
-- capacite capacites/voleur-mcgyver nom [orthographe] ×1 : « McGyver » -> « MacGyver » (Le personnage de série s'écrit « MacGyver ».)
UPDATE "capacite" SET "nom" = replace("nom", 'McGyver', 'MacGyver') WHERE "id" = 'capacites/voleur-mcgyver';
-- capacite capacites/voleur-tu-ma-pas-vu nom [grammaire] ×1 : « Tu m'a pas vu » -> « Tu m'as pas vu » (Verbe avoir à la 2e personne : « tu as ».)
UPDATE "capacite" SET "nom" = replace("nom", '''a ', '''as ') WHERE "id" = 'capacites/voleur-tu-ma-pas-vu';
-- classe classes/anansi inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
-- classe classes/anansi inventaire_depart [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe" SET "inventaire_depart" = replace(replace("inventaire_depart", 'brevage', 'breuvage'), 'mineur', 'mineure') WHERE "id" = 'classes/anansi';
-- classe classes/bimane inventaire_depart [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'aiguisé', 'aiguiser') WHERE "id" = 'classes/bimane';
-- classe classes/clerc inventaire_depart [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'mineur', 'mineure') WHERE "id" = 'classes/clerc';
-- classe classes/fenrir inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
-- classe classes/fenrir inventaire_depart [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe" SET "inventaire_depart" = replace(replace("inventaire_depart", 'brevage', 'breuvage'), 'aiguisé', 'aiguiser') WHERE "id" = 'classes/fenrir';
-- classe classes/frappeur armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/frappeur';
-- classe classes/goleois inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/goleois';
-- classe classes/grenadier armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/grenadier';
-- classe classes/guerrier inventaire_depart [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'aiguisé', 'aiguiser') WHERE "id" = 'classes/guerrier';
-- classe classes/jackalope description_titre [harmonisation] ×1 : « Jacklope » -> « Jackalope » (La classe s'appelle « Jackalope » (titre et texte de la page).)
UPDATE "classe" SET "description_titre" = replace("description_titre", 'Jacklope', 'Jackalope') WHERE "id" = 'classes/jackalope';
-- classe classes/jackalope inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/jackalope';
-- classe classes/kitsune inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/kitsune';
-- classe classes/lanceur arme_depart [grammaire] ×1 : « Armes de Jet Léger » -> « Armes de Jet Légères » (Accord avec « armes » (féminin pluriel).)
-- classe classes/lanceur arme_depart [grammaire] ×1 : « Armes de Jet Lourde » -> « Armes de Jet Lourdes » (Accord avec « armes » (féminin pluriel).)
UPDATE "classe" SET "arme_depart" = replace(replace("arme_depart", 'Lourde', 'Lourdes'), 'Léger', 'Légères') WHERE "id" = 'classes/lanceur';
-- classe classes/lanceur armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/lanceur';
-- classe classes/maclier inventaire_depart [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'mineur', 'mineure') WHERE "id" = 'classes/maclier';
-- classe classes/mage-rouge armure_depart [grammaire] ×1 : « Armure de Peau complet » -> « Armure de Peau complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/mage-rouge';
-- classe classes/mage-rouge inventaire_depart [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'aiguisé', 'aiguiser') WHERE "id" = 'classes/mage-rouge';
-- classe classes/marcass inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/marcass';
-- classe classes/martiale armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/martiale';
-- classe classes/medusain inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/medusain';
-- classe classes/minotaure armure_depart [grammaire] ×1 : « Armure de cuir complet » -> « Armure de cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/minotaure';
-- classe classes/minotaure inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/minotaure';
-- classe classes/moine armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/moine';
-- classe classes/moine inventaire_depart [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'mineur', 'mineure') WHERE "id" = 'classes/moine';
-- classe classes/namazu inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/namazu';
-- classe classes/ocultomancien description [harmonisation] ×1 : « Occultomancien » -> « Ocultomancien » (Graphie majoritaire du nom de la classe (48 « Ocultomancien » contre 3).)
UPDATE "classe" SET "description" = replace("description", 'Occultomancien', 'Ocultomancien') WHERE "id" = 'classes/ocultomancien';
-- classe classes/olwman inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/olwman';
-- classe classes/orios inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/orios';
-- classe classes/parleur armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/parleur';
-- classe classes/parleur inventaire_depart [grammaire] ×1 : « plume à gravé » -> « plume à graver » (Infinitif après « à » : « plume à graver ».)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'gravé', 'graver') WHERE "id" = 'classes/parleur';
-- classe classes/pugiliste inventaire_depart [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'mineur', 'mineure') WHERE "id" = 'classes/pugiliste';
-- classe classes/rokh inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/rokh';
-- classe classes/satyre inventaire_depart [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe" SET "inventaire_depart" = replace("inventaire_depart", 'brevage', 'breuvage') WHERE "id" = 'classes/satyre';
-- classe classes/tueur armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/tueur';
-- classe classes/voleur armure_depart [grammaire] ×1 : « Armure de Cuir complet » -> « Armure de Cuir complète » (Accord avec « armure » (féminin), comme « Armure Complète » dans la même page.)
UPDATE "classe" SET "armure_depart" = replace("armure_depart", 'complet', 'complète') WHERE "id" = 'classes/voleur';
-- classe_annexe classes/mage-bleu 13 libelle [accent] ×1 : « LUMIERE » -> « LUMIÈRE » (Accent conservé en majuscule (cf. « NÉCROMANCIE »).)
UPDATE "classe_annexe" SET "libelle" = replace("libelle", 'LUMIERE', 'LUMIÈRE') WHERE "classe_id" = 'classes/mage-bleu' AND "rang" = 13;
-- classe_objet_depart classes/anansi 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/anansi' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/anansi 5 1 texte [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'mineur', 'mineure') WHERE "classe_id" = 'classes/anansi' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/bimane 3 1 texte [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'aiguisé', 'aiguiser') WHERE "classe_id" = 'classes/bimane' AND "rang" = 3 AND "option" = 1;
-- classe_objet_depart classes/clerc 5 1 texte [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'mineur', 'mineure') WHERE "classe_id" = 'classes/clerc' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/fenrir 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/fenrir' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/fenrir 5 1 texte [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'aiguisé', 'aiguiser') WHERE "classe_id" = 'classes/fenrir' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/goleois 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/goleois' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/guerrier 5 1 texte [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'aiguisé', 'aiguiser') WHERE "classe_id" = 'classes/guerrier' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/jackalope 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/jackalope' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/kitsune 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/kitsune' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/maclier 5 1 texte [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'mineur', 'mineure') WHERE "classe_id" = 'classes/maclier' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/mage-rouge 5 1 texte [grammaire] ×1 : « pierre à aiguisé » -> « pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'aiguisé', 'aiguiser') WHERE "classe_id" = 'classes/mage-rouge' AND "rang" = 5 AND "option" = 1;
-- classe_objet_depart classes/marcass 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/marcass' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/medusain 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/medusain' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/minotaure 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/minotaure' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/moine 4 1 texte [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'mineur', 'mineure') WHERE "classe_id" = 'classes/moine' AND "rang" = 4 AND "option" = 1;
-- classe_objet_depart classes/namazu 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/namazu' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/olwman 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/olwman' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/orios 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/orios' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/parleur 4 1 texte [grammaire] ×1 : « plume à gravé » -> « plume à graver » (Infinitif après « à » : « plume à graver ».)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'gravé', 'graver') WHERE "classe_id" = 'classes/parleur' AND "rang" = 4 AND "option" = 1;
-- classe_objet_depart classes/pugiliste 3 1 texte [grammaire] ×1 : « panacée mineur » -> « panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'mineur', 'mineure') WHERE "classe_id" = 'classes/pugiliste' AND "rang" = 3 AND "option" = 1;
-- classe_objet_depart classes/rokh 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/rokh' AND "rang" = 2 AND "option" = 1;
-- classe_objet_depart classes/satyre 2 1 texte [orthographe] ×1 : « brevage » -> « breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "classe_objet_depart" SET "texte" = replace("texte", 'brevage', 'breuvage') WHERE "classe_id" = 'classes/satyre' AND "rang" = 2 AND "option" = 1;
-- creature bestiaire/golem-de-chair description [grammaire] ×1 : « Taille disproportionné » -> « Taille disproportionnée » (Accord avec « taille » (féminin).)
UPDATE "creature" SET "description" = replace("description", 'disproportionné', 'disproportionnée') WHERE "id" = 'bestiaire/golem-de-chair';
-- creature bestiaire/goule description [grammaire] ×1 : « des Mort-Vivant » -> « des Morts-Vivants » (Pluriel après « des » : les deux éléments du nom composé s'accordent.)
UPDATE "creature" SET "description" = replace(replace("description", 'Mort', 'Morts'), 'Vivant', 'Vivants') WHERE "id" = 'bestiaire/goule';
-- creature bestiaire/poupee-corrompu nom [grammaire] ×1 : « Poupée corrompu » -> « Poupée corrompue » (Accord avec « poupée » (féminin).)
UPDATE "creature" SET "nom" = replace("nom", 'corrompu', 'corrompue') WHERE "id" = 'bestiaire/poupee-corrompu';
-- creature bestiaire/poupee-sacre nom [grammaire] ×1 : « Poupée sacré » -> « Poupée sacrée » (Accord avec « poupée » (féminin).)
UPDATE "creature" SET "nom" = replace("nom", 'sacré', 'sacrée') WHERE "id" = 'bestiaire/poupee-sacre';
-- creature bestiaire/sihouetteur-obscur nom [frappe] ×1 : « Sihouetteur » -> « Silhouetteur » (Dérivé de « silhouette » (forme du texte de la créature).)
UPDATE "creature" SET "nom" = replace("nom", 'Sihouetteur', 'Silhouetteur') WHERE "id" = 'bestiaire/sihouetteur-obscur';
-- creature_attaque bestiaire/squelette-de-pierre#attaque:epee-osseuse-lie brut [grammaire] ×1 : « Épée osseuse lié » -> « Épée osseuse liée » (Accord avec « épée » (féminin).)
UPDATE "creature_attaque" SET "brut" = replace("brut", 'lié', 'liée') WHERE "id" = 'bestiaire/squelette-de-pierre#attaque:epee-osseuse-lie';
-- creature_attaque bestiaire/squelette-de-pierre#attaque:epee-osseuse-lie nom [grammaire] ×1 : « Épée osseuse lié » -> « Épée osseuse liée » (Accord avec « épée » (féminin).)
UPDATE "creature_attaque" SET "nom" = replace("nom", 'lié', 'liée') WHERE "id" = 'bestiaire/squelette-de-pierre#attaque:epee-osseuse-lie';
-- creature_capacite bestiaire/bete-de-lombre#capacite:folle-de-guerre nom [orthographe] ×1 : « Folle de guerre » -> « Folie de guerre » (Nom d'état : « folie de guerre » (« folle » est un adjectif sans nom).)
UPDATE "creature_capacite" SET "nom" = replace("nom", 'Folle', 'Folie') WHERE "id" = 'bestiaire/bete-de-lombre#capacite:folle-de-guerre';
-- creature_capacite bestiaire/golem-de-foudre#capacite:anti-brumeux:npm3 texte [grammaire] ×1 : « Brume Noir » -> « Brume Noire » (Accord avec « brume » (féminin).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'Noir', 'Noire') WHERE "id" = 'bestiaire/golem-de-foudre#capacite:anti-brumeux:npm3';
-- creature_capacite bestiaire/golem-de-sable#capacite:forcareno:npm5 texte [orthographe] ×1 : « tempête sable » -> « tempête de sable » (« tempête de sable », comme ailleurs dans la même page.)
UPDATE "creature_capacite" SET "texte" = replace("texte", ' sable”', ' de sable”') WHERE "id" = 'bestiaire/golem-de-sable#capacite:forcareno:npm5';
-- creature_capacite bestiaire/goule#capacite:radiation-corrompu:npm3 nom [grammaire] ×1 : « Radiation corrompu » -> « Radiation corrompue » (Accord avec « radiation » (féminin).)
UPDATE "creature_capacite" SET "nom" = replace("nom", 'corrompu', 'corrompue') WHERE "id" = 'bestiaire/goule#capacite:radiation-corrompu:npm3';
-- creature_capacite bestiaire/momie#capacite:sort-supplementaire:npm5 texte [frappe] ×1 : « Veilliessement » -> « Vieillissement » (Lettres inversées : « vieillissement » (sort de l'Espace/Temps).)
UPDATE "creature_capacite" SET "texte" = replace(replace("texte", 'Veilliessement', 'Vieilliessement'), 'Vieilliessement', 'Vieillissement') WHERE "id" = 'bestiaire/momie#capacite:sort-supplementaire:npm5';
-- creature_capacite bestiaire/poupee-arcanique#capacite:sort-supplementaire:npm5 texte [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'argenté', 'argentée') WHERE "id" = 'bestiaire/poupee-arcanique#capacite:sort-supplementaire:npm5';
-- creature_capacite bestiaire/poupee-de-glaise#capacite:lanceur-de-sorts texte [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'bestiaire/poupee-de-glaise#capacite:lanceur-de-sorts';
-- creature_capacite bestiaire/poupee-necrotique#capacite:sort-supplementaire:npm5 texte [ponctuation] ×1 : « Répar Os » -> « Répar'Os » (Même forme que les autres noms de la série (« Destruc'Os », « Fractur'Os »).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'Répar Os', 'Répar''Os') WHERE "id" = 'bestiaire/poupee-necrotique#capacite:sort-supplementaire:npm5';
-- creature_capacite bestiaire/poupee-terrestre#capacite:lanceur-de-sorts texte [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'Lance pierre', 'Lance-pierre') WHERE "id" = 'bestiaire/poupee-terrestre#capacite:lanceur-de-sorts';
-- creature_capacite bestiaire/reanime#capacite:para-tonnerre:npm3 nom [orthographe] ×1 : « Para-tonnerre » -> « Paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
UPDATE "creature_capacite" SET "nom" = replace("nom", 'Para-tonnerre', 'Paratonnerre') WHERE "id" = 'bestiaire/reanime#capacite:para-tonnerre:npm3';
-- creature_capacite bestiaire/squamique#capacite:sort-supplementaire:npm5 texte [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "creature_capacite" SET "texte" = replace("texte", 'argenté', 'argentée') WHERE "id" = 'bestiaire/squamique#capacite:sort-supplementaire:npm5';
-- creature_capacite bestiaire/temposs#capacite:arme-distordu nom [grammaire] ×1 : « Arme distordu » -> « Arme distordue » (Accord avec « arme » (féminin).)
UPDATE "creature_capacite" SET "nom" = replace("nom", 'distordu', 'distordue') WHERE "id" = 'bestiaire/temposs#capacite:arme-distordu';
-- creature_capacite bestiaire/zombinox#capacite:tu-ne-passe-pas:npm5 nom [grammaire] ×1 : « Tu ne passe pas » -> « Tu ne passes pas » (2e personne du singulier : « tu passes ».)
UPDATE "creature_capacite" SET "nom" = replace("nom", 'passe', 'passes') WHERE "id" = 'bestiaire/zombinox#capacite:tu-ne-passe-pas:npm5';
-- creature_capacite_sort bestiaire/poupee-arcanique#capacite:sort-supplementaire:npm5 1 sort_nom_brut [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "creature_capacite_sort" SET "sort_nom_brut" = replace("sort_nom_brut", 'argenté', 'argentée') WHERE "capacite_id" = 'bestiaire/poupee-arcanique#capacite:sort-supplementaire:npm5' AND "rang" = 1;
-- creature_capacite_sort bestiaire/poupee-de-glaise#capacite:lanceur-de-sorts 1 sort_nom_brut [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "creature_capacite_sort" SET "sort_nom_brut" = replace("sort_nom_brut", 'Lance pierre', 'Lance-pierre') WHERE "capacite_id" = 'bestiaire/poupee-de-glaise#capacite:lanceur-de-sorts' AND "rang" = 1;
-- creature_capacite_sort bestiaire/poupee-necrotique#capacite:sort-supplementaire:npm5 1 sort_nom_brut [ponctuation] ×1 : « Répar Os » -> « Répar'Os » (Même forme que les autres noms de la série (« Destruc'Os », « Fractur'Os »).)
UPDATE "creature_capacite_sort" SET "sort_nom_brut" = replace("sort_nom_brut", 'Répar Os', 'Répar''Os') WHERE "capacite_id" = 'bestiaire/poupee-necrotique#capacite:sort-supplementaire:npm5' AND "rang" = 1;
-- creature_capacite_sort bestiaire/poupee-terrestre#capacite:lanceur-de-sorts 1 sort_nom_brut [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "creature_capacite_sort" SET "sort_nom_brut" = replace("sort_nom_brut", 'Lance pierre', 'Lance-pierre') WHERE "capacite_id" = 'bestiaire/poupee-terrestre#capacite:lanceur-de-sorts' AND "rang" = 1;
-- creature_capacite_sort bestiaire/squamique#capacite:sort-supplementaire:npm5 1 sort_nom_brut [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "creature_capacite_sort" SET "sort_nom_brut" = replace("sort_nom_brut", 'argenté', 'argentée') WHERE "capacite_id" = 'bestiaire/squamique#capacite:sort-supplementaire:npm5' AND "rang" = 1;
-- creature_effet bestiaire/bete-de-lombre 1 texte [orthographe] ×1 : « Folle de guerre » -> « Folie de guerre » (Nom d'état : « folie de guerre » (« folle » est un adjectif sans nom).)
UPDATE "creature_effet" SET "texte" = replace("texte", 'Folle', 'Folie') WHERE "creature_id" = 'bestiaire/bete-de-lombre' AND "rang" = 1;
-- dieu atheiste nom [orthographe] ×1 : « Athéiste » -> « Athée » (La forme usuelle est « athée ».)
UPDATE "dieu" SET "nom" = replace("nom", 'Athéiste', 'Athée') WHERE "id" = 'atheiste';
-- etat guide/liste-des-alterations-d-etat#etat:aggripe nom [orthographe] ×1 : « Aggripé » -> « Agrippé » (« agripper » : un g, deux p.)
UPDATE "etat" SET "nom" = replace(replace("nom", 'Aggripé', 'Agripé'), 'Agripé', 'Agrippé') WHERE "id" = 'guide/liste-des-alterations-d-etat#etat:aggripe';
-- etat guide/liste-des-alterations-d-etat#etat:folle-de-guerre nom [orthographe] ×1 : « Folle de Guerre » -> « Folie de Guerre » (Nom d'état : « folie de guerre » (« folle » est un adjectif sans nom).)
UPDATE "etat" SET "nom" = replace("nom", 'Folle', 'Folie') WHERE "id" = 'guide/liste-des-alterations-d-etat#etat:folle-de-guerre';
-- ethnie races/drakos#ethnie:drakos-bordeau nom [orthographe] ×1 : « Drakos Bordeau » -> « Drakos Bordeaux » (La couleur s'écrit « bordeaux ».)
UPDATE "ethnie" SET "nom" = replace("nom", 'Bordeau', 'Bordeaux') WHERE "id" = 'races/drakos#ethnie:drakos-bordeau';
-- ethnie races/elfe-argente#ethnie:elfe-argente-suppremaciste nom [orthographe] ×1 : « Supprémaciste » -> « Suprémaciste » (« suprémaciste » prend un seul p.)
UPDATE "ethnie" SET "nom" = replace("nom", 'Supprémaciste', 'Suprémaciste') WHERE "id" = 'races/elfe-argente#ethnie:elfe-argente-suppremaciste';
-- ethnie races/humain#ethnie:humain-toundra descriptif [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "ethnie" SET "descriptif" = replace("descriptif", 'poix', 'pois') WHERE "id" = 'races/humain#ethnie:humain-toundra';
-- familier ressources/familiers#familier:petit:herisson-brun description [orthographe] ×1 : « techtonique » -> « tectonique » (« tectonique » s'écrit sans h.)
UPDATE "familier" SET "description" = replace("description", 'techtonique', 'tectonique') WHERE "id" = 'ressources/familiers#familier:petit:herisson-brun';
-- invocation bestiaire/marionette-de-lombre bandeau [orthographe] ×1 : « MARIONETTE » -> « MARIONNETTE » (« marionnette » prend deux n.)
UPDATE "invocation" SET "bandeau" = replace("bandeau", 'MARIONETTE', 'MARIONNETTE') WHERE "id" = 'bestiaire/marionette-de-lombre';
-- invocation bestiaire/marionette-de-lombre nom [orthographe] ×1 : « Marionette de lombre » -> « Marionnette de l'ombre » (« marionnette » prend deux n ; apostrophe de « l'ombre » (nom du sort : « Marionnette de l'ombre »).)
UPDATE "invocation" SET "nom" = replace(replace("nom", 'Marionette', 'Marionnette'), 'lombre', 'l''ombre') WHERE "id" = 'bestiaire/marionette-de-lombre';
-- maladie ressources/maladie#maladie:alteratis-brune nom [grammaire] ×1 : « Altératis Brune » -> « Altératis Brun » (Les autres Altératis portent une couleur au masculin (Bleu, Vert).)
UPDATE "maladie" SET "nom" = replace("nom", 'Brune', 'Brun') WHERE "id" = 'ressources/maladie#maladie:alteratis-brune';
-- meteo guide/meteo#meteo:puree-de-poix description [orthographe] ×1 : « purée de poix » -> « purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "meteo" SET "description" = replace("description", 'poix', 'pois') WHERE "id" = 'guide/meteo#meteo:puree-de-poix';
-- meteo guide/meteo#meteo:puree-de-poix nom [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "meteo" SET "nom" = replace("nom", 'poix', 'pois') WHERE "id" = 'guide/meteo#meteo:puree-de-poix';
-- metier metiers/marin bonus_brut [orthographe] ×1 : « Vie de nature » -> « Vie en nature » (La compétence s'appelle « Vie en nature » dans les autres métiers.)
UPDATE "metier" SET "bonus_brut" = replace("bonus_brut", 'de', 'en') WHERE "id" = 'metiers/marin';
-- metier_bonus metiers/marin 2 1 cible [orthographe] ×1 : « Vie de nature » -> « Vie en nature » (La compétence s'appelle « Vie en nature » dans les autres métiers.)
UPDATE "metier_bonus" SET "cible" = replace("cible", 'de', 'en') WHERE "metier_id" = 'metiers/marin' AND "rang" = 2 AND "option" = 1;
-- metier_bonus metiers/marin 2 1 texte [orthographe] ×1 : « Vie de nature » -> « Vie en nature » (La compétence s'appelle « Vie en nature » dans les autres métiers.)
UPDATE "metier_bonus" SET "texte" = replace("texte", 'de', 'en') WHERE "metier_id" = 'metiers/marin' AND "rang" = 2 AND "option" = 1;
-- mode_hyper_effet magie_masque:duo:magies/magie-de-la-necromancie+magies/magie-de-la-glace effet [grammaire] ×1 : « des os froid » -> « des os froids » (Pluriel après « des ».)
UPDATE "mode_hyper_effet" SET "effet" = replace("effet", 'froid', 'froids') WHERE "id" = 'magie_masque:duo:magies/magie-de-la-necromancie+magies/magie-de-la-glace';
-- mode_hyper_effet magie_masque:duo:magies/magie-du-vide+magies/magie-de-la-lumiere effet [orthographe] ×1 : « Innerte » -> « Inerte » (« inerte » : un seul n.)
UPDATE "mode_hyper_effet" SET "effet" = replace("effet", 'Innerte', 'Inerte') WHERE "id" = 'magie_masque:duo:magies/magie-du-vide+magies/magie-de-la-lumiere';
-- mode_super_objet guide/liste-des-effets-mode-super#objet:foudre-etincellante nom [orthographe] ×1 : « Foudre étincellante » -> « Foudre étincelante » (« étincelant » prend un seul l.)
UPDATE "mode_super_objet" SET "nom" = replace("nom", 'étincellante', 'étincelante') WHERE "id" = 'guide/liste-des-effets-mode-super#objet:foudre-etincellante';
-- mode_super_objet guide/liste-des-effets-mode-super#objet:guerriseur nom [orthographe] ×1 : « Guérriseur » -> « Guérisseur » (« guérisseur » : un r, deux s.)
UPDATE "mode_super_objet" SET "nom" = replace("nom", 'Guérriseur', 'Guérisseur') WHERE "id" = 'guide/liste-des-effets-mode-super#objet:guerriseur';
-- note_cellule capacite capacites/mage-soin-etrange 1 texte [orthographe] ×1 : « Lance pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "note_cellule" SET "texte" = replace("texte", 'Lance pierre', 'Lance-pierre') WHERE "entite_table" = 'capacite' AND "entite_id" = 'capacites/mage-soin-etrange' AND "rang" = 1;
-- note_cellule sort magies/magie-de-la-foudre#sort:colonne-tesla 1 texte [orthographe] ×1 : « Para-tonnerre » -> « Paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
UPDATE "note_cellule" SET "texte" = replace("texte", 'Para-tonnerre', 'Paratonnerre') WHERE "entite_table" = 'sort' AND "entite_id" = 'magies/magie-de-la-foudre#sort:colonne-tesla' AND "rang" = 1;
-- note_cellule sort magies/magie-de-leau#sort:larmes-doceane 1 texte [harmonisation] ×1 : « Climatospetique » -> « Climatosceptique » (Nom du don de l'Ocultomancien, écrit « Climatosceptique » (climat + sceptique).)
UPDATE "note_cellule" SET "texte" = replace("texte", 'Climatospetique', 'Climatosceptique') WHERE "entite_table" = 'sort' AND "entite_id" = 'magies/magie-de-leau#sort:larmes-doceane' AND "rang" = 1;
-- objet_depart ressources/objets-de-depart-des-classes#objet:brevage-immonde nom [orthographe] ×1 : « Brevage » -> « Breuvage » (« breuvage » s'écrit -eu-.)
UPDATE "objet_depart" SET "nom" = replace("nom", 'Brevage', 'Breuvage') WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:brevage-immonde';
-- objet_depart ressources/objets-de-depart-des-classes#objet:p-huile-hemophile description [grammaire] ×1 : « huile hémophilie » -> « huile hémophile » (Le titre et les objets de la page s'appellent « huile hémophile » (adjectif).)
UPDATE "objet_depart" SET "description" = replace("description", 'hémophilie', 'hémophile') WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:p-huile-hemophile';
-- objet_depart ressources/objets-de-depart-des-classes#objet:panacee-mineur nom [grammaire] ×1 : « Panacée mineur » -> « Panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "objet_depart" SET "nom" = replace("nom", 'mineur', 'mineure') WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:panacee-mineur';
-- objet_depart ressources/objets-de-depart-des-classes#objet:pierre-a-aiguise nom [grammaire] ×1 : « Pierre à aiguisé » -> « Pierre à aiguiser » (Infinitif après « à » : « pierre à aiguiser ».)
UPDATE "objet_depart" SET "nom" = replace("nom", 'aiguisé', 'aiguiser') WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:pierre-a-aiguise';
-- objet_depart ressources/objets-de-depart-des-classes#objet:plume-a-grave nom [grammaire] ×1 : « Plume à gravé » -> « Plume à graver » (Infinitif après « à » : « plume à graver ».)
UPDATE "objet_depart" SET "nom" = replace("nom", 'gravé', 'graver') WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:plume-a-grave';
-- peuple lore/relations-entre-les-races#peuple:elfe-argente-suppremaciste nom [orthographe] ×1 : « Supprémaciste » -> « Suprémaciste » (« suprémaciste » prend un seul p.)
UPDATE "peuple" SET "nom" = replace("nom", 'Supprémaciste', 'Suprémaciste') WHERE "id" = 'lore/relations-entre-les-races#peuple:elfe-argente-suppremaciste';
-- peuple lore/relations-entre-les-races#peuple:marcass-ubain nom [frappe] ×1 : « Marcass Ubain » -> « Marcass Urbain » (Lettre manquante, comme les autres peuples « … Urbain ».)
UPDATE "peuple" SET "nom" = replace("nom", 'Ubain', 'Urbain') WHERE "id" = 'lore/relations-entre-les-races#peuple:marcass-ubain';
-- recette ressources/armures#recette:materiau:or texte_brut [orthographe] ×1 : « Souffre » -> « Soufre » (Le minéral s'écrit « soufre » (« souffre » est le verbe souffrir).)
UPDATE "recette" SET "texte_brut" = replace("texte_brut", 'Souffre', 'Soufre') WHERE "id" = 'ressources/armures#recette:materiau:or';
-- recette ressources/fiole-cyante#recette:fiole-cyante:1 nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "recette" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#recette:fiole-cyante:1';
-- recette ressources/fiole-verte-fonce#recette:fiole-verte-fonce:1 nom [grammaire] ×1 : « Fiole verte foncé » -> « Fiole verte foncée » (Même accord que les autres objets de la page (« fiole verte foncée »).)
UPDATE "recette" SET "nom" = replace("nom", 'foncé', 'foncée') WHERE "id" = 'ressources/fiole-verte-fonce#recette:fiole-verte-fonce:1';
-- recette ressources/fiole-verte-fonce#recette:fiole-verte-fonce:2 nom [grammaire] ×1 : « Fiole verte foncé » -> « Fiole verte foncée » (Même accord que les autres objets de la page (« fiole verte foncée »).)
UPDATE "recette" SET "nom" = replace("nom", 'foncé', 'foncée') WHERE "id" = 'ressources/fiole-verte-fonce#recette:fiole-verte-fonce:2';
-- recette_ingredient ressources/armures#recette:materiau:or 3 1 texte [orthographe] ×1 : « Souffre » -> « Soufre » (Le minéral s'écrit « soufre » (« souffre » est le verbe souffrir).)
UPDATE "recette_ingredient" SET "texte" = replace("texte", 'Souffre', 'Soufre') WHERE "recette_id" = 'ressources/armures#recette:materiau:or' AND "rang" = 3 AND "option" = 1;
-- ressource ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-abyssale nom [grammaire] ×1 : « Coeur abyssale » -> « Coeur abyssal » (Accord avec « cœur » (masculin).)
UPDATE "ressource" SET "nom" = replace("nom", 'abyssale', 'abyssal') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-abyssale';
-- ressource ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-spatio-temporelle nom [grammaire] ×1 : « Coeur spatio-temporelle » -> « Coeur spatio-temporel » (Accord avec « cœur » (masculin).)
UPDATE "ressource" SET "nom" = replace("nom", 'temporelle', 'temporel') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-spatio-temporelle';
-- ressource ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-cyante';
-- ressource ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-verte-fonce nom [grammaire] ×1 : « Herbe verte foncé » -> « Herbe vert foncé » (Couleur composée « vert foncé » : invariable (cf. « Champignon vert foncé »).)
UPDATE "ressource" SET "nom" = replace("nom", 'verte', 'vert') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-verte-fonce';
-- ressource ressources/alchimie-liste-ingredients#ingredient:essence:champignon-bleue nom [grammaire] ×1 : « Champignon bleue » -> « Champignon bleu » (Accord avec « champignon » (masculin).)
UPDATE "ressource" SET "nom" = replace("nom", 'bleue', 'bleu') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:champignon-bleue';
-- ressource ressources/alchimie-liste-ingredients#ingredient:essence:gelee-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:gelee-cyante';
-- ressource ressources/alchimie-liste-ingredients#ingredient:essence:gelee-verte-fonce nom [grammaire] ×1 : « Gelée verte foncé » -> « Gelée vert foncé » (Couleur composée « vert foncé » : invariable (cf. « Champignon vert foncé »).)
UPDATE "ressource" SET "nom" = replace("nom", 'verte', 'vert') WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:gelee-verte-fonce';
-- ressource ressources/armures#mentionne:souffre nom [orthographe] ×1 : « Souffre » -> « Soufre » (Le minéral s'écrit « soufre » (« souffre » est le verbe souffrir).)
UPDATE "ressource" SET "nom" = replace("nom", 'Souffre', 'Soufre') WHERE "id" = 'ressources/armures#mentionne:souffre';
-- ressource ressources/baton-magique#bois:mancelinier nom [orthographe] ×1 : « Mancelinier » -> « Mancenillier » (L'arbre toxique s'écrit « mancenillier ».)
UPDATE "ressource" SET "nom" = replace("nom", 'Mancelinier', 'Mancenillier') WHERE "id" = 'ressources/baton-magique#bois:mancelinier';
-- ressource ressources/baton-magique#gemme:onix nom [orthographe] ×1 : « Onix » -> « Onyx » (La pierre s'écrit « onyx ».)
UPDATE "ressource" SET "nom" = replace("nom", 'Onix', 'Onyx') WHERE "id" = 'ressources/baton-magique#gemme:onix';
-- ressource ressources/equipement-inventaire#materiel:fiole-en-verre-moyen nom [grammaire] ×1 : « Fiole en verre (Moyen) » -> « Fiole en verre (Moyenne) » (Accord avec « fiole » (féminin).)
UPDATE "ressource" SET "nom" = replace("nom", 'Moyen', 'Moyenne') WHERE "id" = 'ressources/equipement-inventaire#materiel:fiole-en-verre-moyen';
-- ressource ressources/equipement-inventaire#produit:1kg-de-oeuf-20-oeuf nom [grammaire] ×1 : « 1kg de oeuf, 20 oeuf » -> « 1kg d'oeufs, 20 oeufs » (Élision obligatoire (« d'oeufs ») et pluriel après « 20 ».)
UPDATE "ressource" SET "nom" = replace(replace(replace("nom", 'de oeuf', 'd''oeuf'), '''oeuf,', '''oeufs,'), ' oeuf', ' oeufs') WHERE "id" = 'ressources/equipement-inventaire#produit:1kg-de-oeuf-20-oeuf';
-- ressource ressources/fiole-cyante#potion:fiole-cyante-moyenne nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#potion:fiole-cyante-moyenne';
-- ressource ressources/fiole-cyante#potion:mega-fiole-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#potion:mega-fiole-cyante';
-- ressource ressources/fiole-cyante#potion:petite-fiole-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#potion:petite-fiole-cyante';
-- ressource ressources/fiole-cyante#potion:super-fiole-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#potion:super-fiole-cyante';
-- ressource ressources/fiole-cyante#potion:ultime-fiole-cyante nom [orthographe] ×1 : « cyante » -> « cyan » (« cyante » n'existe pas : « cyan » est un adjectif invariable (la page écrit « Fioles Cyan »).)
UPDATE "ressource" SET "nom" = replace("nom", 'cyante', 'cyan') WHERE "id" = 'ressources/fiole-cyante#potion:ultime-fiole-cyante';
-- ressource ressources/panacee#potion:panacee-majeur nom [grammaire] ×1 : « Panacée majeur » -> « Panacée majeure » (Accord avec « panacée » (féminin).)
UPDATE "ressource" SET "nom" = replace("nom", 'majeur', 'majeure') WHERE "id" = 'ressources/panacee#potion:panacee-majeur';
-- ressource ressources/panacee#potion:panacee-mineur nom [grammaire] ×1 : « Panacée mineur » -> « Panacée mineure » (Accord avec « panacée » (féminin).)
UPDATE "ressource" SET "nom" = replace("nom", 'mineur', 'mineure') WHERE "id" = 'ressources/panacee#potion:panacee-mineur';
-- ressource ressources/panacee#potion:panacee-parfait nom [grammaire] ×1 : « Panacée parfait » -> « Panacée parfaite » (Accord avec « panacée » (féminin).)
UPDATE "ressource" SET "nom" = replace("nom", 'parfait', 'parfaite') WHERE "id" = 'ressources/panacee#potion:panacee-parfait';
-- sort magies/magie-de-la-corruption#sort:verrouille-visible nom [orthographe] ×1 : « Verrouille Visible » -> « Verrouillage Visible » (Les trois autres sorts de la série s'appellent « Verrouillage … ».)
UPDATE "sort" SET "nom" = replace("nom", 'Verrouille', 'Verrouillage') WHERE "id" = 'magies/magie-de-la-corruption#sort:verrouille-visible';
-- sort magies/magie-de-la-foudre#sort:colonne-tesla effets [orthographe] ×1 : « para-tonnerre » -> « paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
UPDATE "sort" SET "effets" = replace("effets", 'para-tonnerre', 'paratonnerre') WHERE "id" = 'magies/magie-de-la-foudre#sort:colonne-tesla';
-- sort magies/magie-de-la-foudre#sort:colonne-tesla nom [casse] ×1 : « Colonne tesla » -> « Colonne Tesla » (« Tesla » est un nom propre (Nikola Tesla).)
UPDATE "sort" SET "nom" = replace("nom", 'tesla', 'Tesla') WHERE "id" = 'magies/magie-de-la-foudre#sort:colonne-tesla';
-- sort magies/magie-de-la-foudre#sort:colonne-tesla remarque [orthographe] ×1 : « Para-tonnerre » -> « Paratonnerre » (Le nom s'écrit en un mot : « paratonnerre ».)
UPDATE "sort" SET "remarque" = replace("remarque", 'Para-tonnerre', 'Paratonnerre') WHERE "id" = 'magies/magie-de-la-foudre#sort:colonne-tesla';
-- sort magies/magie-de-la-necromancie#sort:cimetiere-ouvert bonus_maitrise [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "sort" SET "bonus_maitrise" = replace("bonus_maitrise", 'poix', 'pois') WHERE "id" = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
-- sort magies/magie-de-la-necromancie#sort:cimetiere-ouvert effets [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "sort" SET "effets" = replace("effets", 'poix', 'pois') WHERE "id" = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
-- sort magies/magie-de-la-necromancie#sort:repar-os nom [ponctuation] ×1 : « Répar Os » -> « Répar'Os » (Même forme que les autres noms de la série (« Destruc'Os », « Fractur'Os »).)
UPDATE "sort" SET "nom" = replace("nom", 'Répar Os', 'Répar''Os') WHERE "id" = 'magies/magie-de-la-necromancie#sort:repar-os';
-- sort magies/magie-de-la-necromancie#sort:resurrection-noir nom [grammaire] ×1 : « Résurrection Noir » -> « Résurrection Noire » (Accord avec « résurrection » (féminin).)
UPDATE "sort" SET "nom" = replace("nom", 'Noir', 'Noire') WHERE "id" = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
-- sort magies/magie-de-la-necromancie#sort:vague-de-cadavre effets [grammaire] ×1 : « vague de cadavre » -> « vague de cadavres » (Une vague de plusieurs cadavres : complément au pluriel.)
UPDATE "sort" SET "effets" = replace("effets", 'cadavre', 'cadavres') WHERE "id" = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
-- sort magies/magie-de-la-necromancie#sort:vague-de-cadavre nom [grammaire] ×1 : « Vague de cadavre » -> « Vague de cadavres » (Une vague de plusieurs cadavres : complément au pluriel.)
UPDATE "sort" SET "nom" = replace("nom", 'cadavre', 'cadavres') WHERE "id" = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
-- sort magies/magie-de-la-terre#sort:lance-pierre nom [orthographe] ×1 : « Lance Pierre » -> « Lance-pierre » (Nom composé « lance-pierre » (trait d'union).)
UPDATE "sort" SET "nom" = replace("nom", 'Lance Pierre', 'Lance-pierre') WHERE "id" = 'magies/magie-de-la-terre#sort:lance-pierre';
-- sort magies/magie-de-la-terre#sort:redemption-de-dimitri effets [orthographe] ×1 : « tempête sable » -> « tempête de sable » (« tempête de sable », comme ailleurs dans la même page.)
UPDATE "sort" SET "effets" = replace("effets", 'tempête', 'tempête de') WHERE "id" = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
-- sort magies/magie-de-larcane#sort:foudre-argente nom [grammaire] ×1 : « Foudre argenté » -> « Foudre argentée » (Accord avec « foudre » (féminin).)
UPDATE "sort" SET "nom" = replace("nom", 'argenté', 'argentée') WHERE "id" = 'magies/magie-de-larcane#sort:foudre-argente';
-- sort magies/magie-de-leau#sort:larmes-doceane remarque [harmonisation] ×1 : « Climatospetique » -> « Climatosceptique » (Nom du don de l'Ocultomancien, écrit « Climatosceptique » (climat + sceptique).)
UPDATE "sort" SET "remarque" = replace("remarque", 'Climatospetique', 'Climatosceptique') WHERE "id" = 'magies/magie-de-leau#sort:larmes-doceane';
-- sort magies/magie-de-leau#sort:onde-confusion nom [orthographe] ×1 : « Onde Confusion » -> « Onde de Confusion » (Nom du sort complété (« onde de confusion »).)
UPDATE "sort" SET "nom" = replace("nom", 'Onde', 'Onde de') WHERE "id" = 'magies/magie-de-leau#sort:onde-confusion';
-- sort magies/magie-de-lombre#sort:brume-mental nom [grammaire] ×1 : « Brume mental » -> « Brume mentale » (Accord avec « brume » (féminin).)
UPDATE "sort" SET "nom" = replace("nom", 'mental', 'mentale') WHERE "id" = 'magies/magie-de-lombre#sort:brume-mental';
-- sort magies/magie-du-vent#sort:estoc-hurlante nom [grammaire] ×1 : « Estoc hurlante » -> « Estoc hurlant » (« estoc » est masculin.)
UPDATE "sort" SET "nom" = replace("nom", 'hurlante', 'hurlant') WHERE "id" = 'magies/magie-du-vent#sort:estoc-hurlante';
-- sort magies/magie-du-vide#sort:touche-du-vide nom [orthographe] ×1 : « Touché du Vide » -> « Toucher du Vide » (Le nom du contact est « le toucher » (« touché » est le participe).)
UPDATE "sort" SET "nom" = replace("nom", 'Touché', 'Toucher') WHERE "id" = 'magies/magie-du-vide#sort:touche-du-vide';
-- sort_bonus_maitrise magies/magie-de-la-necromancie#sort:cimetiere-ouvert effets 1 contexte [orthographe] ×1 : « Purée de poix » -> « Purée de pois » (Expression « purée de pois » (brouillard épais) ; « poix » est la résine.)
UPDATE "sort_bonus_maitrise" SET "contexte" = replace("contexte", 'poix', 'pois') WHERE "sort_id" = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert' AND "champ" = 'effets' AND "rang" = 1;
-- specialite classes/mercenaire#specialite:chasseur-de-primes description_titre [grammaire] ×1 : « Chasseur de Prime » -> « Chasseur de Primes » (Le titre de section et le texte écrivent « Chasseur de Primes ».)
UPDATE "specialite" SET "description_titre" = replace("description_titre", 'Prime', 'Primes') WHERE "id" = 'classes/mercenaire#specialite:chasseur-de-primes';
-- specialite classes/ocultomancien#specialite:meteorologue description_titre [frappe] ×1 : « Métérologue » -> « Météorologue » (Lettre manquante : « météorologue » (titre de section et texte).)
UPDATE "specialite" SET "description_titre" = replace("description_titre", 'Métérologue', 'Météorologue') WHERE "id" = 'classes/ocultomancien#specialite:meteorologue';

-- Clés de nom recalculées (normalize du nom corrigé) ; les identifiants ne changent pas.
UPDATE "arme" SET "nom_cle" = 'etendard-dechire' WHERE "id" = 'ressources/armes#arme:arme-de-monstres:etendard-dechiree' AND "nom_cle" = 'etendard-dechiree';
UPDATE "arme" SET "nom_cle" = 'croc-dobsidienne' WHERE "id" = 'ressources/armes#arme:baton-de-combat:croc-obsidien' AND "nom_cle" = 'croc-obsidien';
UPDATE "arme" SET "nom_cle" = 'greves-cloutees' WHERE "id" = 'ressources/armes#arme:pugilat:greves-cloutes' AND "nom_cle" = 'greves-cloutes';
UPDATE "armure" SET "nom_cle" = 'armure-acier-complete' WHERE "id" = 'ressources/armures#armure:armure-acier-complet' AND "nom_cle" = 'armure-acier-complet';
UPDATE "armure" SET "nom_cle" = 'armure-argent-complete' WHERE "id" = 'ressources/armures#armure:armure-argent-complet' AND "nom_cle" = 'armure-argent-complet';
UPDATE "armure" SET "nom_cle" = 'armure-bronze-complete' WHERE "id" = 'ressources/armures#armure:armure-bronze-complet' AND "nom_cle" = 'armure-bronze-complet';
UPDATE "armure" SET "nom_cle" = 'armure-cellulose-acier' WHERE "id" = 'ressources/armures#armure:armure-celloluse-acier' AND "nom_cle" = 'armure-celloluse-acier';
UPDATE "armure" SET "nom_cle" = 'armure-corne-os-complete' WHERE "id" = 'ressources/armures#armure:armure-corne-os-complet' AND "nom_cle" = 'armure-corne-os-complet';
UPDATE "armure" SET "nom_cle" = 'armure-cuivre-complete' WHERE "id" = 'ressources/armures#armure:armure-cuivre-complet' AND "nom_cle" = 'armure-cuivre-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-bois-complete' WHERE "id" = 'ressources/armures#armure:armure-de-bois-complet' AND "nom_cle" = 'armure-de-bois-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-cellulose-complete' WHERE "id" = 'ressources/armures#armure:armure-de-cellulose-complet' AND "nom_cle" = 'armure-de-cellulose-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-chitine-complete' WHERE "id" = 'ressources/armures#armure:armure-de-chitine-complet' AND "nom_cle" = 'armure-de-chitine-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-corail-complete' WHERE "id" = 'ressources/armures#armure:armure-de-corail-complet' AND "nom_cle" = 'armure-de-corail-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-cuir-complete' WHERE "id" = 'ressources/armures#armure:armure-de-cuir-complet' AND "nom_cle" = 'armure-de-cuir-complet';
UPDATE "armure" SET "nom_cle" = 'armure-de-peau-complete' WHERE "id" = 'ressources/armures#armure:armure-de-peau-complet' AND "nom_cle" = 'armure-de-peau-complet';
UPDATE "armure" SET "nom_cle" = 'armure-ecailles-complete' WHERE "id" = 'ressources/armures#armure:armure-ecailles-complet' AND "nom_cle" = 'armure-ecailles-complet';
UPDATE "armure" SET "nom_cle" = 'armure-fer-complete' WHERE "id" = 'ressources/armures#armure:armure-fer-complet' AND "nom_cle" = 'armure-fer-complet';
UPDATE "armure" SET "nom_cle" = 'armure-fer-noir-complete' WHERE "id" = 'ressources/armures#armure:armure-fer-noir-complet' AND "nom_cle" = 'armure-fer-noir-complet';
UPDATE "armure" SET "nom_cle" = 'armure-fonte-complete' WHERE "id" = 'ressources/armures#armure:armure-fonte-complet' AND "nom_cle" = 'armure-fonte-complet';
UPDATE "armure" SET "nom_cle" = 'armure-laiton-complete' WHERE "id" = 'ressources/armures#armure:armure-laiton-complet' AND "nom_cle" = 'armure-laiton-complet';
UPDATE "armure" SET "nom_cle" = 'armure-maverium-complete' WHERE "id" = 'ressources/armures#armure:armure-maverium-complet' AND "nom_cle" = 'armure-maverium-complet';
UPDATE "armure" SET "nom_cle" = 'armure-mythril-complete' WHERE "id" = 'ressources/armures#armure:armure-mythril-complet' AND "nom_cle" = 'armure-mythril-complet';
UPDATE "armure" SET "nom_cle" = 'armure-or-complete' WHERE "id" = 'ressources/armures#armure:armure-or-complet' AND "nom_cle" = 'armure-or-complet';
UPDATE "armure" SET "nom_cle" = 'armure-titane-complete' WHERE "id" = 'ressources/armures#armure:armure-titane-complet' AND "nom_cle" = 'armure-titane-complet';
UPDATE "armure" SET "nom_cle" = 'armure-vif-argent-complete' WHERE "id" = 'ressources/armures#armure:armure-vif-argent-complet' AND "nom_cle" = 'armure-vif-argent-complet';
UPDATE "capacite" SET "nom_cle" = 'anticorps' WHERE "id" = 'capacites/anansi-anti-corps' AND "nom_cle" = 'anti-corps';
UPDATE "capacite" SET "nom_cle" = 'attention-mygale' WHERE "id" = 'capacites/anansi-attention-migale' AND "nom_cle" = 'attention-migale';
UPDATE "capacite" SET "nom_cle" = 'pacte-noir' WHERE "id" = 'capacites/archimage-pacte-noire' AND "nom_cle" = 'pacte-noire';
UPDATE "capacite" SET "nom_cle" = 'bain-de-foule' WHERE "id" = 'capacites/barde-bain-de-foules' AND "nom_cle" = 'bain-de-foules';
UPDATE "capacite" SET "nom_cle" = 'ballade-guerriere' WHERE "id" = 'capacites/barde-balade-guerriere' AND "nom_cle" = 'balade-guerriere';
UPDATE "capacite" SET "nom_cle" = 'frappe-fatigante' WHERE "id" = 'capacites/bimane-frappe-fatiguante' AND "nom_cle" = 'frappe-fatiguante';
UPDATE "capacite" SET "nom_cle" = 'tends-lautre-joue' WHERE "id" = 'capacites/clerc-tend-lautre-joue' AND "nom_cle" = 'tend-lautre-joue';
UPDATE "capacite" SET "nom_cle" = 'tu-passes-pas' WHERE "id" = 'capacites/cuirasse-tu-passe-pas' AND "nom_cle" = 'tu-passe-pas';
UPDATE "capacite" SET "nom_cle" = 'griffe-sanglante' WHERE "id" = 'capacites/fenrir-griffe-sanglant' AND "nom_cle" = 'griffe-sanglant';
UPDATE "capacite" SET "nom_cle" = 'dis-mon-nom' WHERE "id" = 'capacites/flagelleur-dit-mon-nom' AND "nom_cle" = 'dit-mon-nom';
UPDATE "capacite" SET "nom_cle" = 'punis-moi' WHERE "id" = 'capacites/flagelleur-puni-moi' AND "nom_cle" = 'puni-moi';
UPDATE "capacite" SET "nom_cle" = 'ballade-barbare' WHERE "id" = 'capacites/goleois-balade-barbare' AND "nom_cle" = 'balade-barbare';
UPDATE "capacite" SET "nom_cle" = 'attends' WHERE "id" = 'capacites/grenadier-attend' AND "nom_cle" = 'attend';
UPDATE "capacite" SET "nom_cle" = 'contrecoup' WHERE "id" = 'capacites/guerrier-contre-coup' AND "nom_cle" = 'contre-coup';
UPDATE "capacite" SET "nom_cle" = 'vive-allure' WHERE "id" = 'capacites/kitsune-vif-allure' AND "nom_cle" = 'vif-allure';
UPDATE "capacite" SET "nom_cle" = 'riposte-infinie' WHERE "id" = 'capacites/lancier-riposte-infini' AND "nom_cle" = 'riposte-infini';
UPDATE "capacite" SET "nom_cle" = 'prise-alternative' WHERE "id" = 'capacites/maclier-prise-alternatif' AND "nom_cle" = 'prise-alternatif';
UPDATE "capacite" SET "nom_cle" = 'meilleure-attaque' WHERE "id" = 'capacites/mage-vert-meilleur-attaque' AND "nom_cle" = 'meilleur-attaque';
UPDATE "capacite" SET "nom_cle" = 'force-innee' WHERE "id" = 'capacites/martiale-force-inne' AND "nom_cle" = 'force-inne';
UPDATE "capacite" SET "nom_cle" = 'rage-audacieuse' WHERE "id" = 'capacites/martiale-rage-audacieux' AND "nom_cle" = 'rage-audacieux';
UPDATE "capacite" SET "nom_cle" = 'rage-prudente' WHERE "id" = 'capacites/martiale-rage-prudent' AND "nom_cle" = 'rage-prudent';
UPDATE "capacite" SET "nom_cle" = 'je-te-choisis' WHERE "id" = 'capacites/mercenaire-je-te-choisi' AND "nom_cle" = 'je-te-choisi';
UPDATE "capacite" SET "nom_cle" = 'parce-que' WHERE "id" = 'capacites/minotaure-parceque' AND "nom_cle" = 'parceque';
UPDATE "capacite" SET "nom_cle" = 'prends-ca' WHERE "id" = 'capacites/moine-prend-ca' AND "nom_cle" = 'prend-ca';
UPDATE "capacite" SET "nom_cle" = 'tu-vivras' WHERE "id" = 'capacites/moine-tu-vivra' AND "nom_cle" = 'tu-vivra';
UPDATE "capacite" SET "nom_cle" = 'dent-infectee' WHERE "id" = 'capacites/namazu-dent-infecte' AND "nom_cle" = 'dent-infecte';
UPDATE "capacite" SET "nom_cle" = 'a-deux-mains' WHERE "id" = 'capacites/pugiliste-a-deux-main' AND "nom_cle" = 'a-deux-main';
UPDATE "capacite" SET "nom_cle" = 'suplex' WHERE "id" = 'capacites/pugiliste-suplexe' AND "nom_cle" = 'suplexe';
UPDATE "capacite" SET "nom_cle" = 'anticorps' WHERE "id" = 'capacites/tueur-anti-corps' AND "nom_cle" = 'anti-corps';
UPDATE "capacite" SET "nom_cle" = 'inarretable' WHERE "id" = 'capacites/tueur-innaretable' AND "nom_cle" = 'innaretable';
UPDATE "capacite" SET "nom_cle" = 'macgyver' WHERE "id" = 'capacites/voleur-mcgyver' AND "nom_cle" = 'mcgyver';
UPDATE "capacite" SET "nom_cle" = 'tu-mas-pas-vu' WHERE "id" = 'capacites/voleur-tu-ma-pas-vu' AND "nom_cle" = 'tu-ma-pas-vu';
UPDATE "creature" SET "nom_cle" = 'poupee-corrompue' WHERE "id" = 'bestiaire/poupee-corrompu' AND "nom_cle" = 'poupee-corrompu';
UPDATE "creature" SET "nom_cle" = 'poupee-sacree' WHERE "id" = 'bestiaire/poupee-sacre' AND "nom_cle" = 'poupee-sacre';
UPDATE "creature" SET "nom_cle" = 'silhouetteur-obscur' WHERE "id" = 'bestiaire/sihouetteur-obscur' AND "nom_cle" = 'sihouetteur-obscur';
UPDATE "creature_attaque" SET "nom_cle" = 'epee-osseuse-liee' WHERE "id" = 'bestiaire/squelette-de-pierre#attaque:epee-osseuse-lie' AND "nom_cle" = 'epee-osseuse-lie';
UPDATE "creature_capacite" SET "nom_cle" = 'folie-de-guerre' WHERE "id" = 'bestiaire/bete-de-lombre#capacite:folle-de-guerre' AND "nom_cle" = 'folle-de-guerre';
UPDATE "creature_capacite" SET "nom_cle" = 'radiation-corrompue' WHERE "id" = 'bestiaire/goule#capacite:radiation-corrompu:npm3' AND "nom_cle" = 'radiation-corrompu';
UPDATE "creature_capacite" SET "nom_cle" = 'paratonnerre' WHERE "id" = 'bestiaire/reanime#capacite:para-tonnerre:npm3' AND "nom_cle" = 'para-tonnerre';
UPDATE "creature_capacite" SET "nom_cle" = 'arme-distordue' WHERE "id" = 'bestiaire/temposs#capacite:arme-distordu' AND "nom_cle" = 'arme-distordu';
UPDATE "creature_capacite" SET "nom_cle" = 'tu-ne-passes-pas' WHERE "id" = 'bestiaire/zombinox#capacite:tu-ne-passe-pas:npm5' AND "nom_cle" = 'tu-ne-passe-pas';
UPDATE "invocation" SET "nom_cle" = 'marionnette-de-lombre' WHERE "id" = 'bestiaire/marionette-de-lombre' AND "nom_cle" = 'marionette-de-lombre';
UPDATE "maladie" SET "nom_cle" = 'alteratis-brun' WHERE "id" = 'ressources/maladie#maladie:alteratis-brune' AND "nom_cle" = 'alteratis-brune';
UPDATE "metier_bonus" SET "cible_cle" = 'vie-en-nature' WHERE "metier_id" = 'metiers/marin' AND "rang" = 2 AND "option" = 1 AND "cible_cle" = 'vie-de-nature';
UPDATE "objet_depart" SET "nom_cle" = 'breuvage-immonde' WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:brevage-immonde' AND "nom_cle" = 'brevage-immonde';
UPDATE "objet_depart" SET "nom_cle" = 'panacee-mineure' WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:panacee-mineur' AND "nom_cle" = 'panacee-mineur';
UPDATE "objet_depart" SET "nom_cle" = 'pierre-a-aiguiser' WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:pierre-a-aiguise' AND "nom_cle" = 'pierre-a-aiguise';
UPDATE "objet_depart" SET "nom_cle" = 'plume-a-graver' WHERE "id" = 'ressources/objets-de-depart-des-classes#objet:plume-a-grave' AND "nom_cle" = 'plume-a-grave';
UPDATE "page" SET "titre_cle" = 'marionnette-de-lombre' WHERE "id" = 'bestiaire/marionette-de-lombre' AND "titre_cle" = 'marionette-de-lombre';
UPDATE "page" SET "titre_cle" = 'poupee-corrompue' WHERE "id" = 'bestiaire/poupee-corrompu' AND "titre_cle" = 'poupee-corrompu';
UPDATE "page" SET "titre_cle" = 'poupee-sacree' WHERE "id" = 'bestiaire/poupee-sacre' AND "titre_cle" = 'poupee-sacre';
UPDATE "page" SET "titre_cle" = 'silhouetteur-obscur' WHERE "id" = 'bestiaire/sihouetteur-obscur' AND "titre_cle" = 'sihouetteur-obscur';
UPDATE "page" SET "titre_cle" = 'anticorps-anansi' WHERE "id" = 'capacites/anansi-anti-corps' AND "titre_cle" = 'anti-corps-anansi';
UPDATE "page" SET "titre_cle" = 'attention-mygale-anansi' WHERE "id" = 'capacites/anansi-attention-migale' AND "titre_cle" = 'attention-migale-anansi';
UPDATE "page" SET "titre_cle" = 'pacte-noir-archimage' WHERE "id" = 'capacites/archimage-pacte-noire' AND "titre_cle" = 'pacte-noire-archimage';
UPDATE "page" SET "titre_cle" = 'bain-de-foule-barde' WHERE "id" = 'capacites/barde-bain-de-foules' AND "titre_cle" = 'bain-de-foules-barde';
UPDATE "page" SET "titre_cle" = 'ballade-guerriere-barde' WHERE "id" = 'capacites/barde-balade-guerriere' AND "titre_cle" = 'balade-guerriere-barde';
UPDATE "page" SET "titre_cle" = 'frappe-fatigante-bimane' WHERE "id" = 'capacites/bimane-frappe-fatiguante' AND "titre_cle" = 'frappe-fatiguante-bimane';
UPDATE "page" SET "titre_cle" = 'tends-lautre-joue-clerc' WHERE "id" = 'capacites/clerc-tend-lautre-joue' AND "titre_cle" = 'tend-lautre-joue-clerc';
UPDATE "page" SET "titre_cle" = 'tu-passes-pas-cuirasse' WHERE "id" = 'capacites/cuirasse-tu-passe-pas' AND "titre_cle" = 'tu-passe-pas-cuirasse';
UPDATE "page" SET "titre_cle" = 'griffe-sanglante-fenrir' WHERE "id" = 'capacites/fenrir-griffe-sanglant' AND "titre_cle" = 'griffe-sanglant-fenrir';
UPDATE "page" SET "titre_cle" = 'dis-mon-nom-flagelleur' WHERE "id" = 'capacites/flagelleur-dit-mon-nom' AND "titre_cle" = 'dit-mon-nom-flagelleur';
UPDATE "page" SET "titre_cle" = 'punis-moi-flagelleur' WHERE "id" = 'capacites/flagelleur-puni-moi' AND "titre_cle" = 'puni-moi-flagelleur';
UPDATE "page" SET "titre_cle" = 'ballade-barbare-goleois' WHERE "id" = 'capacites/goleois-balade-barbare' AND "titre_cle" = 'balade-barbare-goleois';
UPDATE "page" SET "titre_cle" = 'attends-grenadier' WHERE "id" = 'capacites/grenadier-attend' AND "titre_cle" = 'attend-grenadier';
UPDATE "page" SET "titre_cle" = 'contrecoup-guerrier' WHERE "id" = 'capacites/guerrier-contre-coup' AND "titre_cle" = 'contre-coup-guerrier';
UPDATE "page" SET "titre_cle" = 'vive-allure-kitsune' WHERE "id" = 'capacites/kitsune-vif-allure' AND "titre_cle" = 'vif-allure-kitsune';
UPDATE "page" SET "titre_cle" = 'riposte-infinie-lancier' WHERE "id" = 'capacites/lancier-riposte-infini' AND "titre_cle" = 'riposte-infini-lancier';
UPDATE "page" SET "titre_cle" = 'prise-alternative-maclier' WHERE "id" = 'capacites/maclier-prise-alternatif' AND "titre_cle" = 'prise-alternatif-maclier';
UPDATE "page" SET "titre_cle" = 'meilleure-attaque-mage-vert' WHERE "id" = 'capacites/mage-vert-meilleur-attaque' AND "titre_cle" = 'meilleur-attaque-mage-vert';
UPDATE "page" SET "titre_cle" = 'force-innee-martiale' WHERE "id" = 'capacites/martiale-force-inne' AND "titre_cle" = 'force-inne-martiale';
UPDATE "page" SET "titre_cle" = 'rage-audacieuse-martiale' WHERE "id" = 'capacites/martiale-rage-audacieux' AND "titre_cle" = 'rage-audacieux-martiale';
UPDATE "page" SET "titre_cle" = 'rage-prudente-martiale' WHERE "id" = 'capacites/martiale-rage-prudent' AND "titre_cle" = 'rage-prudent-martiale';
UPDATE "page" SET "titre_cle" = 'je-te-choisis-mercenaire' WHERE "id" = 'capacites/mercenaire-je-te-choisi' AND "titre_cle" = 'je-te-choisi-mercenaire';
UPDATE "page" SET "titre_cle" = 'parce-que-minotaure' WHERE "id" = 'capacites/minotaure-parceque' AND "titre_cle" = 'parceque-minotaure';
UPDATE "page" SET "titre_cle" = 'prends-ca-moine' WHERE "id" = 'capacites/moine-prend-ca' AND "titre_cle" = 'prend-ca-moine';
UPDATE "page" SET "titre_cle" = 'tu-vivras-moine' WHERE "id" = 'capacites/moine-tu-vivra' AND "titre_cle" = 'tu-vivra-moine';
UPDATE "page" SET "titre_cle" = 'dent-infectee-namazu' WHERE "id" = 'capacites/namazu-dent-infecte' AND "titre_cle" = 'dent-infecte-namazu';
UPDATE "page" SET "titre_cle" = 'a-deux-mains-pugiliste' WHERE "id" = 'capacites/pugiliste-a-deux-main' AND "titre_cle" = 'a-deux-main-pugiliste';
UPDATE "page" SET "titre_cle" = 'suplex-pugiliste' WHERE "id" = 'capacites/pugiliste-suplexe' AND "titre_cle" = 'suplexe-pugiliste';
UPDATE "page" SET "titre_cle" = 'anticorps-tueur' WHERE "id" = 'capacites/tueur-anti-corps' AND "titre_cle" = 'anti-corps-tueur';
UPDATE "page" SET "titre_cle" = 'inarretable-tueur' WHERE "id" = 'capacites/tueur-innaretable' AND "titre_cle" = 'innaretable-tueur';
UPDATE "page" SET "titre_cle" = 'macgyver-voleur' WHERE "id" = 'capacites/voleur-mcgyver' AND "titre_cle" = 'mcgyver-voleur';
UPDATE "page" SET "titre_cle" = 'tu-mas-pas-vu-voleur' WHERE "id" = 'capacites/voleur-tu-ma-pas-vu' AND "titre_cle" = 'tu-ma-pas-vu-voleur';
UPDATE "page" SET "titre_cle" = 'fiche-de-personnage-capacites-dons' WHERE "id" = 'guide/fiche-capacites-dons' AND "titre_cle" = 'fiche-de-personnage-capacites-don';
UPDATE "page" SET "titre_cle" = 'fiche-de-personnage-tableau-resistances-faiblesses' WHERE "id" = 'guide/fiche-tableau-resistances-faiblesses' AND "titre_cle" = 'fiche-de-personnage-tableau-resistance-faiblesses';
UPDATE "page" SET "titre_cle" = 'liste-dingredients' WHERE "id" = 'ressources/alchimie-liste-ingredients' AND "titre_cle" = 'liste-dingredient';
UPDATE "page" SET "titre_cle" = 'fiole-cyan' WHERE "id" = 'ressources/fiole-cyante' AND "titre_cle" = 'fiole-cyante';
UPDATE "page" SET "titre_cle" = 'fiole-verte-foncee' WHERE "id" = 'ressources/fiole-verte-fonce' AND "titre_cle" = 'fiole-verte-fonce';
UPDATE "page" SET "titre_cle" = 'livre-parchemin' WHERE "id" = 'ressources/livre-parchemin' AND "titre_cle" = 'livreparchemin';
UPDATE "page" SET "titre_cle" = 'machine-de-guerre-siege' WHERE "id" = 'ressources/machine-de-guerresiege' AND "titre_cle" = 'machine-de-guerresiege';
UPDATE "peuple" SET "nom_cle" = 'elfe-argente-supremaciste' WHERE "id" = 'lore/relations-entre-les-races#peuple:elfe-argente-suppremaciste' AND "nom_cle" = 'elfe-argente-suppremaciste';
UPDATE "peuple" SET "nom_cle" = 'marcass-urbain' WHERE "id" = 'lore/relations-entre-les-races#peuple:marcass-ubain' AND "nom_cle" = 'marcass-ubain';
UPDATE "ressource" SET "nom_cle" = 'coeur-abyssal' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-abyssale' AND "nom_cle" = 'coeur-abyssale';
UPDATE "ressource" SET "nom_cle" = 'coeur-spatio-temporel' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:coeur-spatio-temporelle' AND "nom_cle" = 'coeur-spatio-temporelle';
UPDATE "ressource" SET "nom_cle" = 'herbe-cyan' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-cyante' AND "nom_cle" = 'herbe-cyante';
UPDATE "ressource" SET "nom_cle" = 'herbe-vert-fonce' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:amplificateur:herbe-verte-fonce' AND "nom_cle" = 'herbe-verte-fonce';
UPDATE "ressource" SET "nom_cle" = 'champignon-bleu' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:champignon-bleue' AND "nom_cle" = 'champignon-bleue';
UPDATE "ressource" SET "nom_cle" = 'gelee-cyan' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:gelee-cyante' AND "nom_cle" = 'gelee-cyante';
UPDATE "ressource" SET "nom_cle" = 'gelee-vert-fonce' WHERE "id" = 'ressources/alchimie-liste-ingredients#ingredient:essence:gelee-verte-fonce' AND "nom_cle" = 'gelee-verte-fonce';
UPDATE "ressource" SET "nom_cle" = 'soufre' WHERE "id" = 'ressources/armures#mentionne:souffre' AND "nom_cle" = 'souffre';
UPDATE "ressource" SET "nom_cle" = 'mancenillier' WHERE "id" = 'ressources/baton-magique#bois:mancelinier' AND "nom_cle" = 'mancelinier';
UPDATE "ressource" SET "nom_cle" = 'onyx' WHERE "id" = 'ressources/baton-magique#gemme:onix' AND "nom_cle" = 'onix';
UPDATE "ressource" SET "nom_cle" = 'fiole-en-verre-moyenne' WHERE "id" = 'ressources/equipement-inventaire#materiel:fiole-en-verre-moyen' AND "nom_cle" = 'fiole-en-verre-moyen';
UPDATE "ressource" SET "nom_cle" = '1kg-doeufs-20-oeufs' WHERE "id" = 'ressources/equipement-inventaire#produit:1kg-de-oeuf-20-oeuf' AND "nom_cle" = '1kg-de-oeuf-20-oeuf';
UPDATE "ressource" SET "nom_cle" = 'fiole-cyan-moyenne' WHERE "id" = 'ressources/fiole-cyante#potion:fiole-cyante-moyenne' AND "nom_cle" = 'fiole-cyante-moyenne';
UPDATE "ressource" SET "nom_cle" = 'mega-fiole-cyan' WHERE "id" = 'ressources/fiole-cyante#potion:mega-fiole-cyante' AND "nom_cle" = 'mega-fiole-cyante';
UPDATE "ressource" SET "nom_cle" = 'petite-fiole-cyan' WHERE "id" = 'ressources/fiole-cyante#potion:petite-fiole-cyante' AND "nom_cle" = 'petite-fiole-cyante';
UPDATE "ressource" SET "nom_cle" = 'super-fiole-cyan' WHERE "id" = 'ressources/fiole-cyante#potion:super-fiole-cyante' AND "nom_cle" = 'super-fiole-cyante';
UPDATE "ressource" SET "nom_cle" = 'ultime-fiole-cyan' WHERE "id" = 'ressources/fiole-cyante#potion:ultime-fiole-cyante' AND "nom_cle" = 'ultime-fiole-cyante';
UPDATE "ressource" SET "nom_cle" = 'panacee-majeure' WHERE "id" = 'ressources/panacee#potion:panacee-majeur' AND "nom_cle" = 'panacee-majeur';
UPDATE "ressource" SET "nom_cle" = 'panacee-mineure' WHERE "id" = 'ressources/panacee#potion:panacee-mineur' AND "nom_cle" = 'panacee-mineur';
UPDATE "ressource" SET "nom_cle" = 'panacee-parfaite' WHERE "id" = 'ressources/panacee#potion:panacee-parfait' AND "nom_cle" = 'panacee-parfait';
UPDATE "sort" SET "nom_cle" = 'verrouillage-visible' WHERE "id" = 'magies/magie-de-la-corruption#sort:verrouille-visible' AND "nom_cle" = 'verrouille-visible';
UPDATE "sort" SET "nom_cle" = 'reparos' WHERE "id" = 'magies/magie-de-la-necromancie#sort:repar-os' AND "nom_cle" = 'repar-os';
UPDATE "sort" SET "nom_cle" = 'resurrection-noire' WHERE "id" = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND "nom_cle" = 'resurrection-noir';
UPDATE "sort" SET "nom_cle" = 'vague-de-cadavres' WHERE "id" = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre' AND "nom_cle" = 'vague-de-cadavre';
UPDATE "sort" SET "nom_cle" = 'foudre-argentee' WHERE "id" = 'magies/magie-de-larcane#sort:foudre-argente' AND "nom_cle" = 'foudre-argente';
UPDATE "sort" SET "nom_cle" = 'onde-de-confusion' WHERE "id" = 'magies/magie-de-leau#sort:onde-confusion' AND "nom_cle" = 'onde-confusion';
UPDATE "sort" SET "nom_cle" = 'brume-mentale' WHERE "id" = 'magies/magie-de-lombre#sort:brume-mental' AND "nom_cle" = 'brume-mental';
UPDATE "sort" SET "nom_cle" = 'estoc-hurlant' WHERE "id" = 'magies/magie-du-vent#sort:estoc-hurlante' AND "nom_cle" = 'estoc-hurlante';
UPDATE "sort" SET "nom_cle" = 'toucher-du-vide' WHERE "id" = 'magies/magie-du-vide#sort:touche-du-vide' AND "nom_cle" = 'touche-du-vide';

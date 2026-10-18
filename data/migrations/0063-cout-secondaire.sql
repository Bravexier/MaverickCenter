-- 0063-cout-secondaire : le coût d'un sort en deux colonnes, « Coût » et « Coût secondaire » (décision R105 du propriétaire, 2026-10-18 : « Il faudra
-- désormais séparer le cout avec une seconde colonne cout secondaire. Le cout n'aura qu'une valeur chiffrée, celle du Chakra. Sauf si marquée X. Le cout
-- secondaire lui abritera le 2e cout du sort s'il y en a, le cout en âme pour la magie nécromancie, le sang pour la magie du sang. »).
-- Migration de STRUCTURE et de DONNÉES.
--   * Structure : la colonne sort.cout_secondaire (en dernier) ; le CHECK de cout_ressource lit la ressource de la 4ème barre dans le coût secondaire
--     (il la lisait dans cout_brut) : la table est reconstruite (mêmes colonnes, mêmes index), et les trois vues qui la lisent recréées à l'identique,
--     v_creature_cout_invocation avec cout_secondaire en dernière colonne.
--   * Données : les coûts dont le classeur écrivait les deux parties dans une seule case et qui se répartissent sans doute possible
--     (lib/sort-cout.mjs#repartirLeCout) : « N + M Sang », « N + M âme(s) » (avec l'expression de NM du chakra : « 10 (–1/NM) + 2 âmes »),
--     « 50 + 20% PV », « 5 + 10% santé » ; « 2 Sang », « X Sang », « 2 âmes » (le sort ne consomme pas de chakra : son coût est « 0 », lecture à confirmer, question S0). Les colonnes typées
--     suivent (cout_chakra, cout_ressource, cout_ressource_valeur : lib/sort-analyse.mjs#analyserCout) ; rien d'autre ne change, ni les expressions de
--     NM (sort_bonus_maitrise : elles restent dans « Coût »), ni le corps Markdown des pages de magie, qui garde le coût en une case (« 3 + 1 Sang »,
--     lib/corps-magies.mjs). Le détail, et les 26 sorts dont le coût attend la décision du propriétaire (ils gardent l'écriture du classeur), sont dans
--     0063-cout-secondaire.json ; leurs questions dans docs/sql/a-valider.md, « Coût secondaire des sorts ».
-- Rien ne va dans historique_modification : la migration n'est pas une modification du site de dev.
DROP VIEW "v_creature_magie";
DROP VIEW "v_creature_cout_invocation";
DROP VIEW "v_personnage_controle";
CREATE TABLE sort__0063 (
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
  -- Coût, en deux colonnes (décision R105 du propriétaire, migration 0063 : « séparer le cout avec une seconde colonne cout secondaire ») : « Coût »
  -- (cout_brut) n'a que la consommation de chakra, un nombre (guide/fiche-attributs : « La consommation de chakra est indiqué sur les sorts »), ou « X »,
  -- et « 0 » pour un sort qui n'en consomme pas (lecture à confirmer : docs/sql/a-valider.md, S0) ; « Coût secondaire » (cout_secondaire, en dernière colonne)
  -- le second coût du sort (la 4ème barre : âmes de la Nécromancie, Sang ; « 20% PV »…). Le classeur les écrivait dans une seule case (« 3 + 1 Sang ») :
  -- lib/sort-cout.mjs#repartirLeCout. Les coûts que le propriétaire doit encore trancher gardent l'écriture du classeur (docs/sql/a-valider.md, « Coût
  -- secondaire des sorts »).
  cout_brut             TEXT    NOT NULL,               -- « 3 », « 55 (-5/NM) », « 0 » ; en attente de décision : « 3xN/tour », « Variable »…
  cout_chakra           INTEGER CHECK (cout_chakra >= 0),   -- la consommation de chakra quand la forme est « N » ou « N (-k/NM) » ; sinon NULL
  cout_ressource        TEXT    CHECK (cout_ressource IN ('sang', 'ame')),   -- ressource de la 4ème barre quand le coût secondaire est « M Sang » ou « M âme(s) »
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
  -- Colonne ajoutée par la migration 0063 (décision R105) : la colonne « Coût secondaire » des tables de sorts. Elle n'écrit pas d'expression de NM (le
  -- bonus de NM du coût est dans « Coût » : sort_bonus_maitrise n'a pas de champ pour elle, le service et db:check refusent un NM ici)
  cout_secondaire       TEXT    CHECK (cout_secondaire IS NULL OR (length(cout_secondaire) > 0 AND cout_secondaire = trim(cout_secondaire))),   -- « 1 Sang », « 2 âmes », « X Sang », « 20% PV » ; NULL = pas de second coût
  UNIQUE (magie_id, ordre),
  UNIQUE (magie_id, nom),
  -- le typé suit toujours le brut (la valeur typée n'est jamais une valeur saisie : le service la recalcule avec lib/sort-analyse.mjs, que
  -- test/sort-analyse.test.mjs rejoue sur toute la base ; db:check refait le coût, analyserCout)
  CHECK (imparable = (instr(lower(type_brut), 'imparable') > 0)),
  CHECK (inesquivable = (instr(lower(type_brut), 'inesquivable') > 0)),
  CHECK (ic_direct = (instr(type_brut, '(IC)') > 0)),
  CHECK ((ic_nm_min IS NULL) = (instr(lower(replace(type_brut, char(10), ' ')), 'ic pour ') = 0)),
  CHECK (ic_nm_min IS NULL OR instr(lower(replace(type_brut, char(10), ' ')), 'ic pour ' || ic_nm_min) > 0),
  CHECK (cout_chakra IS NULL OR (substr(cout_brut, 1, length(CAST(cout_chakra AS TEXT))) = CAST(cout_chakra AS TEXT)
                                 AND substr(cout_brut || ' ', length(CAST(cout_chakra AS TEXT)) + 1, 1) NOT GLOB '[0-9]')),
  CHECK (cout_ressource IS NULL OR (cout_ressource = 'sang' AND instr(coalesce(cout_secondaire, ''), 'Sang') > 0)
                                OR (cout_ressource = 'ame' AND instr(coalesce(cout_secondaire, ''), 'âme') > 0)),
  CHECK (portee_valeur IS NULL OR (substr(portee_brut, 1, length(CAST(portee_valeur AS TEXT))) = CAST(portee_valeur AS TEXT)
                                   AND substr(portee_brut || ' ', length(CAST(portee_valeur AS TEXT)) + 1, 1) NOT GLOB '[0-9]')),
  CHECK (texte_niveau5 IS NULL OR niveau = 5),
  CHECK ((portee_nature = 'nombre') = (portee_valeur IS NOT NULL)),
  CHECK (cout_ressource_valeur IS NULL OR cout_ressource IS NOT NULL)
) STRICT;

-- les sorts sans second coût, recopiés tels quels (une ressource de la 4ème barre restée ici ferait refuser la ligne par le CHECK de cout_ressource)
INSERT INTO "sort__0063" ("id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", "cout_ressource", "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise", "cout_secondaire") SELECT "id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", "cout_ressource", "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise", NULL FROM "sort" WHERE id NOT IN (
  'magies/magie-du-sang#sort:boule-de-sang',
  'magies/magie-du-sang#sort:clou',
  'magies/magie-du-sang#sort:marquage',
  'magies/magie-du-sang#sort:annulation',
  'magies/magie-du-sang#sort:attirance',
  'magies/magie-du-sang#sort:sang-durci',
  'magies/magie-du-sang#sort:sang-garde',
  'magies/magie-du-sang#sort:sang-magie',
  'magies/magie-du-sang#sort:sang-gain',
  'magies/magie-du-sang#sort:saignee-forcee',
  'magies/magie-du-sang#sort:coagulation',
  'magies/magie-du-sang#sort:renfermement',
  'magies/magie-du-sang#sort:deflagration-sanguine',
  'magies/magie-du-sang#sort:damocles',
  'magies/magie-du-sang#sort:douleur-partagee',
  'magies/magie-du-sang#sort:autel-sanglant',
  'magies/magie-du-sang#sort:sang-perfection',
  'magies/magie-du-sang#sort:proportion-demesuree',
  'magies/magie-de-la-necromancie#sort:tir-dame',
  'magies/magie-de-la-necromancie#sort:mur-dos',
  'magies/magie-de-la-necromancie#sort:corruption-dame',
  'magies/magie-de-la-necromancie#sort:detection-de-vie',
  'magies/magie-de-la-necromancie#sort:pieu-dos',
  'magies/magie-de-la-necromancie#sort:armure-dos',
  'magies/magie-de-la-necromancie#sort:detection-de-la-mort',
  'magies/magie-de-la-necromancie#sort:festin-des-ames',
  'magies/magie-de-la-necromancie#sort:prison-dos',
  'magies/magie-de-la-necromancie#sort:forge-de-ses-morts',
  'magies/magie-de-la-necromancie#sort:calin-putrefie',
  'magies/magie-de-la-necromancie#sort:amelioration-cadaverique',
  'magies/magie-de-la-necromancie#sort:vague-de-cadavre',
  'magies/magie-de-la-necromancie#sort:grenade-caustique',
  'magies/magie-de-la-necromancie#sort:cimetiere-ouvert',
  'magies/magie-de-la-necromancie#sort:repar-os',
  'magies/magie-de-la-necromancie#sort:reanimation',
  'magies/magie-de-la-necromancie#sort:resurrection-noir',
  'magies/magie-du-feu#sort:bucher-purifiant',
  'magies/magie-de-lombre#sort:amplification-sombre');
-- les 38 sorts dont le coût se répartit, puis leurs deux coûts et leurs colonnes typées (lib/sort-cout.mjs#repartirLeCout, lib/sort-analyse.mjs#analyserCout)
INSERT INTO "sort__0063" ("id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", "cout_ressource", "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise", "cout_secondaire") SELECT "id", "magie_id", "nom", "nom_cle", "niveau", "ordre", "type_brut", "ic_direct", "ic_nm_min", "imparable", "inesquivable", "cout_brut", "cout_chakra", NULL AS "cout_ressource", NULL AS "cout_ressource_valeur", "portee_brut", "portee_nature", "portee_valeur", "zone_brut", "zone_forme", "zone_taille", "dsb_brut", "effets", "texte_niveau5", "origine", "source_ref", "remarque", "mode_brut", "bonus_maitrise", NULL FROM "sort" WHERE id IN (
  'magies/magie-du-sang#sort:boule-de-sang',
  'magies/magie-du-sang#sort:clou',
  'magies/magie-du-sang#sort:marquage',
  'magies/magie-du-sang#sort:annulation',
  'magies/magie-du-sang#sort:attirance',
  'magies/magie-du-sang#sort:sang-durci',
  'magies/magie-du-sang#sort:sang-garde',
  'magies/magie-du-sang#sort:sang-magie',
  'magies/magie-du-sang#sort:sang-gain',
  'magies/magie-du-sang#sort:saignee-forcee',
  'magies/magie-du-sang#sort:coagulation',
  'magies/magie-du-sang#sort:renfermement',
  'magies/magie-du-sang#sort:deflagration-sanguine',
  'magies/magie-du-sang#sort:damocles',
  'magies/magie-du-sang#sort:douleur-partagee',
  'magies/magie-du-sang#sort:autel-sanglant',
  'magies/magie-du-sang#sort:sang-perfection',
  'magies/magie-du-sang#sort:proportion-demesuree',
  'magies/magie-de-la-necromancie#sort:tir-dame',
  'magies/magie-de-la-necromancie#sort:mur-dos',
  'magies/magie-de-la-necromancie#sort:corruption-dame',
  'magies/magie-de-la-necromancie#sort:detection-de-vie',
  'magies/magie-de-la-necromancie#sort:pieu-dos',
  'magies/magie-de-la-necromancie#sort:armure-dos',
  'magies/magie-de-la-necromancie#sort:detection-de-la-mort',
  'magies/magie-de-la-necromancie#sort:festin-des-ames',
  'magies/magie-de-la-necromancie#sort:prison-dos',
  'magies/magie-de-la-necromancie#sort:forge-de-ses-morts',
  'magies/magie-de-la-necromancie#sort:calin-putrefie',
  'magies/magie-de-la-necromancie#sort:amelioration-cadaverique',
  'magies/magie-de-la-necromancie#sort:vague-de-cadavre',
  'magies/magie-de-la-necromancie#sort:grenade-caustique',
  'magies/magie-de-la-necromancie#sort:cimetiere-ouvert',
  'magies/magie-de-la-necromancie#sort:repar-os',
  'magies/magie-de-la-necromancie#sort:reanimation',
  'magies/magie-de-la-necromancie#sort:resurrection-noir',
  'magies/magie-du-feu#sort:bucher-purifiant',
  'magies/magie-de-lombre#sort:amplification-sombre');
UPDATE sort__0063 SET cout_brut = '3', cout_secondaire = '1 Sang', cout_chakra = 3, cout_ressource = 'sang', cout_ressource_valeur = 1
  WHERE id = 'magies/magie-du-sang#sort:boule-de-sang' AND cout_brut = '3 + 1 Sang';   -- Sang › Boule de sang : « 3 + 1 Sang »
UPDATE sort__0063 SET cout_brut = '3', cout_secondaire = '2 Sang', cout_chakra = 3, cout_ressource = 'sang', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-du-sang#sort:clou' AND cout_brut = '3 + 2 Sang';   -- Sang › Clou : « 3 + 2 Sang »
UPDATE sort__0063 SET cout_brut = '0', cout_secondaire = '2 Sang', cout_chakra = 0, cout_ressource = 'sang', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-du-sang#sort:marquage' AND cout_brut = '2 Sang';   -- Sang › Marquage : « 2 Sang »
UPDATE sort__0063 SET cout_brut = '0', cout_secondaire = '2 Sang', cout_chakra = 0, cout_ressource = 'sang', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-du-sang#sort:annulation' AND cout_brut = '2 Sang';   -- Sang › Annulation : « 2 Sang »
UPDATE sort__0063 SET cout_brut = '2', cout_secondaire = '1 Sang', cout_chakra = 2, cout_ressource = 'sang', cout_ressource_valeur = 1
  WHERE id = 'magies/magie-du-sang#sort:attirance' AND cout_brut = '2 + 1 Sang';   -- Sang › Attirance : « 2 + 1 Sang »
UPDATE sort__0063 SET cout_brut = '2', cout_secondaire = '3 Sang', cout_chakra = 2, cout_ressource = 'sang', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-du-sang#sort:sang-durci' AND cout_brut = '2 + 3 Sang';   -- Sang › Sang Durci : « 2 + 3 Sang »
UPDATE sort__0063 SET cout_brut = '2', cout_secondaire = '3 Sang', cout_chakra = 2, cout_ressource = 'sang', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-du-sang#sort:sang-garde' AND cout_brut = '2 + 3 Sang';   -- Sang › Sang Garde : « 2 + 3 Sang »
UPDATE sort__0063 SET cout_brut = '2', cout_secondaire = '3 Sang', cout_chakra = 2, cout_ressource = 'sang', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-du-sang#sort:sang-magie' AND cout_brut = '2 + 3 Sang';   -- Sang › Sang Magie : « 2 + 3 Sang »
UPDATE sort__0063 SET cout_brut = '2', cout_secondaire = '3 Sang', cout_chakra = 2, cout_ressource = 'sang', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-du-sang#sort:sang-gain' AND cout_brut = '2 + 3 Sang';   -- Sang › Sang Gain : « 2 + 3 Sang »
UPDATE sort__0063 SET cout_brut = '9', cout_secondaire = '4 Sang', cout_chakra = 9, cout_ressource = 'sang', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-du-sang#sort:saignee-forcee' AND cout_brut = '9 + 4 Sang';   -- Sang › Saignée forcée : « 9 + 4 Sang »
UPDATE sort__0063 SET cout_brut = '10', cout_secondaire = 'X Sang', cout_chakra = 10, cout_ressource = 'sang', cout_ressource_valeur = NULL
  WHERE id = 'magies/magie-du-sang#sort:coagulation' AND cout_brut = '10 + X Sang';   -- Sang › Coagulation : « 10 + X Sang »
UPDATE sort__0063 SET cout_brut = '10', cout_secondaire = '4 Sang', cout_chakra = 10, cout_ressource = 'sang', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-du-sang#sort:renfermement' AND cout_brut = '10 + 4 Sang';   -- Sang › Renfermement : « 10 + 4 Sang »
UPDATE sort__0063 SET cout_brut = '0', cout_secondaire = 'X Sang', cout_chakra = 0, cout_ressource = 'sang', cout_ressource_valeur = NULL
  WHERE id = 'magies/magie-du-sang#sort:deflagration-sanguine' AND cout_brut = 'X Sang';   -- Sang › Déflagration sanguine : « X Sang »
UPDATE sort__0063 SET cout_brut = '18', cout_secondaire = '5 Sang', cout_chakra = 18, cout_ressource = 'sang', cout_ressource_valeur = 5
  WHERE id = 'magies/magie-du-sang#sort:damocles' AND cout_brut = '18 + 5 Sang';   -- Sang › Damoclès : « 18 + 5 Sang »
UPDATE sort__0063 SET cout_brut = '20', cout_secondaire = '5 Sang', cout_chakra = 20, cout_ressource = 'sang', cout_ressource_valeur = 5
  WHERE id = 'magies/magie-du-sang#sort:douleur-partagee' AND cout_brut = '20 + 5 Sang';   -- Sang › Douleur partagée : « 20 + 5 Sang »
UPDATE sort__0063 SET cout_brut = '18', cout_secondaire = '6 Sang', cout_chakra = 18, cout_ressource = 'sang', cout_ressource_valeur = 6
  WHERE id = 'magies/magie-du-sang#sort:autel-sanglant' AND cout_brut = '18 + 6 Sang';   -- Sang › Autel Sanglant : « 18 + 6 Sang »
UPDATE sort__0063 SET cout_brut = '40', cout_secondaire = '10 Sang', cout_chakra = 40, cout_ressource = 'sang', cout_ressource_valeur = 10
  WHERE id = 'magies/magie-du-sang#sort:sang-perfection' AND cout_brut = '40 + 10 Sang';   -- Sang › Sang Perfection : « 40 + 10 Sang »
UPDATE sort__0063 SET cout_brut = '60', cout_secondaire = '10 Sang', cout_chakra = 60, cout_ressource = 'sang', cout_ressource_valeur = 10
  WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree' AND cout_brut = '60 + 10 Sang';   -- Sang › Proportion démesurée : « 60 + 10 Sang »
UPDATE sort__0063 SET cout_brut = '3', cout_secondaire = '1 âme', cout_chakra = 3, cout_ressource = 'ame', cout_ressource_valeur = 1
  WHERE id = 'magies/magie-de-la-necromancie#sort:tir-dame' AND cout_brut = '3 + 1 âme';   -- Nécromancie › Tir d'âme : « 3 + 1 âme »
UPDATE sort__0063 SET cout_brut = '4', cout_secondaire = '1 âme', cout_chakra = 4, cout_ressource = 'ame', cout_ressource_valeur = 1
  WHERE id = 'magies/magie-de-la-necromancie#sort:mur-dos' AND cout_brut = '4 + 1 âme';   -- Nécromancie › Mur d'os : « 4 + 1 âme »
UPDATE sort__0063 SET cout_brut = '0', cout_secondaire = '2 âmes', cout_chakra = 0, cout_ressource = 'ame', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-de-la-necromancie#sort:corruption-dame' AND cout_brut = '2 âmes';   -- Nécromancie › Corruption d'âme : « 2 âmes »
UPDATE sort__0063 SET cout_brut = '7 (–1/NM)', cout_secondaire = '1 âme', cout_chakra = 7, cout_ressource = 'ame', cout_ressource_valeur = 1
  WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie' AND cout_brut = '7 (–1/NM) + 1 âme';   -- Nécromancie › Détection de vie : « 7 (–1/NM) + 1 âme »
UPDATE sort__0063 SET cout_brut = '7', cout_secondaire = '2 âmes', cout_chakra = 7, cout_ressource = 'ame', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-de-la-necromancie#sort:pieu-dos' AND cout_brut = '7 + 2 âmes';   -- Nécromancie › Pieu d'os : « 7 + 2 âmes »
UPDATE sort__0063 SET cout_brut = '5', cout_secondaire = '2 âmes', cout_chakra = 5, cout_ressource = 'ame', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-de-la-necromancie#sort:armure-dos' AND cout_brut = '5 + 2 âmes';   -- Nécromancie › Armure d'os : « 5 + 2 âmes »
UPDATE sort__0063 SET cout_brut = '10 (–1/NM)', cout_secondaire = '2 âmes', cout_chakra = 10, cout_ressource = 'ame', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort' AND cout_brut = '10 (–1/NM) + 2 âmes';   -- Nécromancie › Détection de la mort : « 10 (–1/NM) + 2 âmes »
UPDATE sort__0063 SET cout_brut = '12', cout_secondaire = '6 âmes', cout_chakra = 12, cout_ressource = 'ame', cout_ressource_valeur = 6
  WHERE id = 'magies/magie-de-la-necromancie#sort:festin-des-ames' AND cout_brut = '12 + 6 âmes';   -- Nécromancie › Festin des âmes : « 12 + 6 âmes »
UPDATE sort__0063 SET cout_brut = '12', cout_secondaire = '3 âmes', cout_chakra = 12, cout_ressource = 'ame', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-de-la-necromancie#sort:prison-dos' AND cout_brut = '12 + 3 âmes';   -- Nécromancie › Prison d'os : « 12 + 3 âmes »
UPDATE sort__0063 SET cout_brut = '9', cout_secondaire = '2 âmes', cout_chakra = 9, cout_ressource = 'ame', cout_ressource_valeur = 2
  WHERE id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts' AND cout_brut = '9 + 2 âmes';   -- Nécromancie › Forge de ses morts : « 9 + 2 âmes »
UPDATE sort__0063 SET cout_brut = '13', cout_secondaire = '3 âmes', cout_chakra = 13, cout_ressource = 'ame', cout_ressource_valeur = 3
  WHERE id = 'magies/magie-de-la-necromancie#sort:calin-putrefie' AND cout_brut = '13 + 3 âmes';   -- Nécromancie › Câlin putréfié : « 13 + 3 âmes »
UPDATE sort__0063 SET cout_brut = '20', cout_secondaire = '4 âmes', cout_chakra = 20, cout_ressource = 'ame', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique' AND cout_brut = '20 + 4 âmes';   -- Nécromancie › Amélioration Cadavérique : « 20 + 4 âmes »
UPDATE sort__0063 SET cout_brut = '20', cout_secondaire = '4 âmes', cout_chakra = 20, cout_ressource = 'ame', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre' AND cout_brut = '20 + 4 âmes';   -- Nécromancie › Vague de cadavres : « 20 + 4 âmes »
UPDATE sort__0063 SET cout_brut = '25', cout_secondaire = '4 âmes', cout_chakra = 25, cout_ressource = 'ame', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-de-la-necromancie#sort:grenade-caustique' AND cout_brut = '25 + 4 âmes';   -- Nécromancie › Grenade caustique : « 25 + 4 âmes »
UPDATE sort__0063 SET cout_brut = '18', cout_secondaire = '4 âmes', cout_chakra = 18, cout_ressource = 'ame', cout_ressource_valeur = 4
  WHERE id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert' AND cout_brut = '18 + 4 âmes';   -- Nécromancie › Cimetière ouvert : « 18 + 4 âmes »
UPDATE sort__0063 SET cout_brut = '20', cout_secondaire = '5 âmes', cout_chakra = 20, cout_ressource = 'ame', cout_ressource_valeur = 5
  WHERE id = 'magies/magie-de-la-necromancie#sort:repar-os' AND cout_brut = '20 + 5 âmes';   -- Nécromancie › Répar'Os : « 20 + 5 âmes »
UPDATE sort__0063 SET cout_brut = '45 (-2/NM)', cout_secondaire = '10 âmes', cout_chakra = 45, cout_ressource = 'ame', cout_ressource_valeur = 10
  WHERE id = 'magies/magie-de-la-necromancie#sort:reanimation' AND cout_brut = '45 (-2/NM) + 10 âmes';   -- Nécromancie › Réanimation : « 45 (-2/NM) + 10 âmes »
UPDATE sort__0063 SET cout_brut = '35 (-2/NM)', cout_secondaire = '10 âmes', cout_chakra = 35, cout_ressource = 'ame', cout_ressource_valeur = 10
  WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir' AND cout_brut = '35 (-2/NM) + 10 âmes';   -- Nécromancie › Résurrection Noire : « 35 (-2/NM) + 10 âmes »
UPDATE sort__0063 SET cout_brut = '50', cout_secondaire = '20% PV', cout_chakra = 50, cout_ressource = NULL, cout_ressource_valeur = NULL
  WHERE id = 'magies/magie-du-feu#sort:bucher-purifiant' AND cout_brut = '50 + 20% PV';   -- Feu › Bûcher purifiant : « 50 + 20% PV »
UPDATE sort__0063 SET cout_brut = '5', cout_secondaire = '10% santé', cout_chakra = 5, cout_ressource = NULL, cout_ressource_valeur = NULL
  WHERE id = 'magies/magie-de-lombre#sort:amplification-sombre' AND cout_brut = '5 + 10% santé';   -- Ombre › Amplification sombre : « 5 + 10% santé »
-- garde : les 38 coûts sont répartis (une écriture d'avant qui ne serait plus celle du registre laisserait sa ligne sans coût secondaire ni ressource) ;
-- sinon, le CHECK de cette table temporaire fait refuser toute la migration (« CHECK constraint failed: couts_repartis = 38 »)
CREATE TEMP TABLE garde_0063 (couts_repartis INTEGER NOT NULL CHECK (couts_repartis = 38));
INSERT INTO garde_0063 SELECT count(*) FROM sort__0063 WHERE cout_secondaire IS NOT NULL;
DROP TABLE garde_0063;
DROP TABLE "sort";
ALTER TABLE "sort__0063" RENAME TO "sort";
CREATE INDEX sort_magie_niveau ON sort (magie_id, niveau, ordre);     -- « tous les sorts d'une magie triés par palier »
CREATE INDEX sort_nom_cle      ON sort (nom_cle);                                     -- « le sort Boule de feu » (plusieurs magies possibles)
CREATE INDEX sort_niveau       ON sort (niveau);
CREATE INDEX sort_cout_chakra  ON sort (cout_chakra) WHERE cout_chakra IS NOT NULL;   -- « sorts qui coûtent <= N »
CREATE INDEX sort_zone_forme   ON sort (zone_forme);                                  -- « sorts de zone »
CREATE INDEX sort_portee       ON sort (portee_nature, portee_valeur);
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
CREATE VIEW v_creature_cout_invocation AS
  SELECT c.id AS creature_id, i.id AS invocation_id, s.id AS sort_id, s.nom AS sort_nom,
         s.cout_brut AS cout_brut, s.cout_chakra AS cout_chakra, s.cout_ressource AS cout_ressource,
         s.cout_ressource_valeur AS cout_ressource_valeur, b.npm AS npm, s.cout_secondaire AS cout_secondaire
  FROM creature c
  JOIN invocation i ON i.id = c.invocation_id
  JOIN invocation_bloc b ON b.id = c.bloc_id
  JOIN sort s ON s.id = i.sort_id;
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Race et magie innée : toute fiche en a une (jusqu'à la migration 0038, une contrainte de la table pour toute fiche hors brouillon)
  SELECT p.id, 'race_manquante', NULL
  FROM personnage p
  WHERE p.race_id IS NULL
  UNION ALL
  SELECT p.id, 'magie_innee_manquante', NULL
  FROM personnage p
  WHERE p.magie_innee_id IS NULL
  UNION ALL
  -- Classe réservée à une magie innée, qui l'impose en classe 1 (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décision R23)
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  SELECT p.id, 'classe_imposee', c.id
  FROM personnage p
  JOIN classe c ON c.magie_innee_id = p.magie_innee_id
  JOIN personnage_classe pc ON pc.personnage_id = p.id AND pc.rang = 1
  WHERE pc.classe_id <> c.id
  UNION ALL
  -- Classe que ferme la magie innée, à tous les rangs (classe.magie_innee_exclue_id ; le Mage Bleu et le Potentiel Illimité, décision R25)
  SELECT pc.personnage_id, 'classe_exclue', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_exclue_id = p.magie_innee_id
  UNION ALL
  -- Magie innée accessible à la race : matrice « Accessibilité Magie » (R8), sauf liste de l'onglet de la race qui prime (R11)
  SELECT p.id, 'magie_innee_inaccessible', p.magie_innee_id
  FROM personnage p
  WHERE p.race_id IS NOT NULL AND p.magie_innee_id IS NOT NULL
    AND CASE WHEN EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id)
             THEN NOT EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id AND o.magie_id = p.magie_innee_id)
             ELSE NOT EXISTS (SELECT 1 FROM race_magie rm WHERE rm.race_id = p.race_id AND rm.magie_id = p.magie_innee_id AND rm.accessible = 1)
        END
  UNION ALL
  -- Magies incompatibles entre elles (bloc « Magie non compatible » des onglets de magie)
  SELECT p.id, 'magies_incompatibles', p.magie_innee_id || ' / ' || p.magie_acquise_id
  FROM personnage p
  JOIN v_magie_incompatible i ON i.a = p.magie_innee_id AND i.b = p.magie_acquise_id
  UNION ALL
  -- Mono-magie (décision R15) : pas de magie acquise avec une magie mono-magie, sauf ethnie citée par magie_ethnie_secondaire, que la magie
  -- mono-magie soit l'innée ou l'acquise (décision R20 : l'Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption)
  SELECT p.id, 'mono_magie', m.id
  FROM personnage p
  JOIN magie m ON m.mono_magie = 1 AND m.id IN (p.magie_innee_id, p.magie_acquise_id)
  WHERE p.magie_acquise_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM magie_ethnie_secondaire s WHERE s.magie_id = m.id AND s.ethnie_id = p.ethnie_id)
  UNION ALL
  -- Race à une seule magie (race.mono_magie ; la Lamia, décision R28) : pas de magie acquise
  SELECT p.id, 'race_mono_magie', p.magie_acquise_id
  FROM personnage p JOIN race r ON r.id = p.race_id
  WHERE r.mono_magie = 1 AND p.magie_acquise_id IS NOT NULL
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2). Sans race ou sans magie
  -- innée, rien à comparer : race_manquante, magie_innee_manquante le disent (migration 0038)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id <> p.magie_innee_id
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
  UNION ALL
  SELECT pc.personnage_id, 'caracteristique_hors_bornes', pc.caracteristique_id || ' = ' || pc.base
  FROM personnage_caracteristique pc
  JOIN personnage p ON p.id = pc.personnage_id
  JOIN v_race_carac_borne b ON b.race_id = p.race_id AND b.caracteristique_id = pc.caracteristique_id
  WHERE pc.base < b.minimum OR pc.base > b.maximum
  UNION ALL
  SELECT n.personnage_id, 'caracteristiques_total', (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) || ' / ' || s.valeur
  FROM v_personnage_niveau n
  JOIN seuil_niveau s ON s.regle = 'caracteristiques_total'
   AND s.niveau_min = (SELECT MAX(t.niveau_min) FROM seuil_niveau t WHERE t.regle = 'caracteristiques_total' AND t.niveau_min <= n.niveau_global)
  WHERE EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id)
    AND (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) <> s.valeur
  UNION ALL
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3)
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  -- Entraînement (décision R104) : 15 compétences au plus (« Vous ne pouvez monter que 15 compétences maximum »), 10 points au plus chacune (« à hauteur
  -- maximum 10% de bonus » ; une ligne à 0 ne monte rien) ; l'Acquis, lui, se calcule (le plafond de 5 par point de caractéristique est appliqué par la page)
  SELECT pe.personnage_id, 'entrainement_competences', COUNT(*) || ' / ' || (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  FROM personnage_entrainement pe
  WHERE pe.competence_id IS NOT NULL AND pe.valeur > 0
  GROUP BY pe.personnage_id
  HAVING COUNT(*) > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  UNION ALL
  SELECT pe.personnage_id, 'entrainement_valeur', pe.competence_id || ' = ' || pe.valeur
  FROM personnage_entrainement pe
  WHERE pe.valeur > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.bonus_max_pct')
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
  UNION ALL
  -- Gains de niveau (décision R73) : santé + chakra gagnés (personnage.gains_sante, gains_chakra) = les points d'attributs des niveaux atteints
  -- (v_niveau.points_attributs_cumul : 15 par niveau à partir du 2), plus le dé bonus de chaque niveau atteint qui en donne un, entre son plus petit
  -- et son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max : 1 et 8) ; au niveau 1, rien. Détail : « total / à saisir », ou
  -- « total / minimum à maximum » quand un dé est atteint
  SELECT n.personnage_id, 'gains_niveau', (p.gains_sante + p.gains_chakra) || ' / ' || (v.points_attributs_cumul + v.de_attributs_min_cumul)
         || CASE WHEN v.de_attributs_max_cumul > v.de_attributs_min_cumul THEN ' à ' || (v.points_attributs_cumul + v.de_attributs_max_cumul) ELSE '' END
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.gains_sante + p.gains_chakra NOT BETWEEN v.points_attributs_cumul + v.de_attributs_min_cumul
                                               AND v.points_attributs_cumul + v.de_attributs_max_cumul
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n
  WHERE n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
  UNION ALL
  SELECT pc.personnage_id, 'specialite_trop_tot', pc.specialite_id
  FROM personnage_classe pc JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  WHERE pc.specialite_id IS NOT NULL
    AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END < 10
  UNION ALL
  -- Dons choisis : d'une classe du personnage, de sa spécialité s'ils en dépendent, jamais deux options exclusives ensemble
  SELECT pk.personnage_id, 'capacite_hors_classe', pk.capacite_id
  FROM personnage_capacite pk JOIN capacite c ON c.id = pk.capacite_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = pk.personnage_id AND pc.classe_id = c.classe_id
                      AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id))
  UNION ALL
  SELECT a.personnage_id, 'capacites_exclusives', a.capacite_id || ' / ' || b.capacite_id
  FROM personnage_capacite a
  JOIN v_capacite_exclusive x ON x.capacite_id = a.capacite_id
  JOIN personnage_capacite b ON b.personnage_id = a.personnage_id AND b.capacite_id = x.autre_id
  WHERE a.capacite_id < b.capacite_id
  UNION ALL
  -- Sorts : d'une magie du personnage (le Potentiel Illimité « pioche ses sorts dans toutes les magies existantes », son Explication) ;
  -- NPM au plus la puissance magique du niveau (niveau_global : niveau 16 pour la 5, décision R16), le palier dont la note dit « non disponible pour
  -- les personnages avec une magie acquise » ne comptant pas pour eux. NM (décision R26) : au plus 3 sur un sort, toutes origines comprises ; ceux de niveau
  -- (hors livre et cadeau du MJ) au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du
  -- MJ (décision R24)
  SELECT ps.personnage_id, 'sort_hors_magie', ps.sort_id
  FROM personnage_sort ps JOIN sort s ON s.id = ps.sort_id JOIN personnage p ON p.id = ps.personnage_id
  WHERE s.magie_id <> COALESCE(p.magie_innee_id, '') AND s.magie_id <> COALESCE(p.magie_acquise_id, '')
    AND COALESCE(p.magie_innee_id, '') <> 'magies/potentiel-illimite'
  UNION ALL
  SELECT ps.personnage_id, 'sort_puissance', ps.sort_id || ' : NPM ' || s.niveau
  FROM personnage_sort ps
  JOIN sort s ON s.id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE s.niveau > (SELECT MAX(g.puissance_magique) FROM niveau_global g
                    WHERE g.niveau <= n.niveau_global AND (p.magie_acquise_id IS NULL OR g.puissance_magique_note IS NULL))
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_plafond', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps
  WHERE ps.niveau_maitrise > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_max')
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau)
  FROM personnage_sort ps JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global')
  UNION ALL
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / ' || v.niveaux_maitrise_cumul
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE (SELECT SUM(ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul
  UNION ALL
  -- Bouclier (décision R96) : une forme et une matière ; la matière, l'amélioration ou la solidité n'existent qu'avec la forme, et la forme attend sa matière
  SELECT p.id, 'bouclier_manquant', COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT))
  FROM personnage p
  WHERE p.bouclier_classe_id IS NULL AND COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT)) IS NOT NULL
  UNION ALL
  SELECT p.id, 'bouclier_matiere_manquante', p.bouclier_classe_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NULL
  UNION ALL
  -- la forme et la matière désignent un bouclier de la liste (table bouclier) : un couple que l'onglet Boucliers n'écrit pas est signalé
  SELECT p.id, 'bouclier_inconnu', p.bouclier_classe_id || ' + ' || p.bouclier_materiau_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = p.bouclier_classe_id AND b.materiau_id = p.bouclier_materiau_id)
  UNION ALL
  -- Posture Symbiose (décision R100) : sa magie est la magie innée ou la magie acquise du personnage, pas le Potentiel Illimité (question Q15)
  SELECT p.id, 'symbiose_magie', p.symbiose_magie_id
  FROM personnage p
  WHERE p.symbiose_magie_id IS NOT NULL
    AND (p.symbiose_magie_id = 'magies/potentiel-illimite' OR p.symbiose_magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, '')))
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45)
  SELECT pm.personnage_id, 'maitrise_arme_exclue', pm.arme_famille_id
  FROM personnage_maitrise_arme pm JOIN arme_famille f ON f.id = pm.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_elementaire_id
  WHERE ae.cible <> 'arme_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'élément de l’armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'bouclier : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.bouclier_amelioration_id
  WHERE ae.cible <> 'bouclier'
  UNION ALL
  -- Armure (décision R95) : une amélioration ou un élément d'armure n'existe qu'avec l'armure ; une partie n'a de solidité que si l'armure l'a (la seule
  -- « armure-complete » d'une armure à solidité unifiée, armure.solidite_uni = 1 ; les six autres sinon)
  SELECT p.id, 'armure_manquante', COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id)
  FROM personnage p
  WHERE p.armure_id IS NULL AND COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id) IS NOT NULL
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE a.id IS NULL OR (COALESCE(a.solidite_uni, 0) = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;

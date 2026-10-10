-- ====================================================================================================================
-- Maverick Center : schéma UNIQUE de la base de données  (SQLite >= 3.45 : tables STRICT, FTS5, fonctions de fenêtre)
-- ====================================================================================================================
-- La base est une COPIE RECONSTRUITE : la source de vérité reste les Google Sheets / Docs (propriété d'un tiers). `npm run db:build` fabrique
-- le fichier .db (jamais commité) à partir de CE fichier + data/rows/<table>.sql (export texte déterministe, commité) + les tables dérivées.
--
-- Conventions (design.md §2 les détaille)
--   * Noms en français, singulier, snake_case, ASCII sans accent (termes universels en anglais : id, slug). `nom` = libellé court, `titre` = titre de page.
--   * Clés primaires TEXT lisibles et STABLES entre deux imports (jamais d'auto-incrément) : une page = '<type>/<slug>' ; une entité qui a SA page
--     réutilise l'id de la page ; une sous-entité = '<id de la page>#<sorte>:<slug>' ; un référentiel garde sa clé courte ('force', 'ro', 'epee').
--     Exceptions assumées : clés numériques naturelles (niveau_global.niveau, initiative_agilite.agilite…) : le nombre EST la clé.
--   * Tables STRICT, clés étrangères (PRAGMA foreign_keys = ON à CHAQUE connexion : SQLite ne le mémorise pas), CHECK pour les énumérations,
--     index sur toute colonne servant de filtre.
--   * Absent = NULL. Jamais de valeur par défaut inventée : l'importeur écrit toujours explicitement ce qu'il sait.
--   * Texte conservé tel que dans la source ; colonne typée (INTEGER, REAL, énumération) seulement si la forme est sans ambiguïté, sinon NULL et la
--     colonne `*_brut` fait foi. `*_cle` = normalize() de client/src/lib/text.mjs (clé de recherche et de jointure par nom).
--   * Listes courtes : table de liaison (rang = position 1-based dans la liste du parent ; `ordre` = position d'une entité dans sa liste d'origine).
--     Structure irrégulière : colonne JSON (json_valid en CHECK) : seule page.donnees en a besoin aujourd'hui.
--   * Provenance : toute table importée a `origine` (famille d'importeur, FK vers `famille`) et `source_ref` (« classeur › onglet › plage »).
--   * Tables DÉRIVÉES : précédées de `-- @derivee <commande>` ; absentes de data/rows/. Vues : toujours à jour.
--   * SQL PORTABLE (docs/feuille-de-route.md : une bascule vers PostgreSQL doit rester possible) : seuls STRICT / WITHOUT ROWID, GLOB dans quelques CHECK,
--     json_valid / json_type, instr, FTS5 (tables dérivées), group_concat (une vue) et PRAGMA sont propres à SQLite ; design.md §10.4 donne leur équivalent. L'export de lignes est du INSERT standard.
-- ====================================================================================================================

PRAGMA user_version = 17;   -- version du schéma ; data/rows/VERSION porte la même (voir design.md §10 : migrations)

-- ====================================================================================================================
-- 0. FAMILLES D'IMPORT
-- Registre des importeurs. Toute ligne importée porte `origine` = l'id d'une famille : « supprime et réimporte cette famille » =
-- DELETE FROM <chaque table qui a une colonne origine> WHERE origine = :famille, dans une transaction (design.md, §4).
-- Une famille citée par une autre (une magie renommée que le bestiaire cite) se réimporte AVEC elle : session('magies', 'bestiaire', …).
-- ====================================================================================================================

CREATE TABLE famille (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z_]*'),   -- 'magies', 'classes', 'docs', 'docs_typees'…
  libelle    TEXT    NOT NULL UNIQUE,
  importeur  TEXT,                                   -- script qui écrit la famille (tools/…) ; NULL = saisie directe (docs, exemple)
  sources    TEXT,                                   -- classeurs / Docs d'origine, en clair
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1)    -- rang de livraison des importeurs (design.md §11). PAS un ordre de dépendance : fiche, annexes, magies, classes et races
                                                    -- se citent mutuellement (noyau des règles) et se réimportent ENSEMBLE (design.md §4.2)
) STRICT;

-- ====================================================================================================================
-- 1. PAGES, LIENS, MOTS-CLÉS, SOURCES (couche générique)
-- Une page = un fichier client/src/content/wiki/<type>/<slug>.md d'aujourd'hui. `corps_md` est conservé octet pour octet : les pages restent
-- affichables ; pour une entité typée, les tables typées font référence (le Markdown n'est qu'une présentation).
-- ====================================================================================================================

-- Registre des catégories du wiki : reprend client/src/lib/types.mjs (aujourd'hui une constante JavaScript).
-- Les 10 clés existent même quand aucune page n'y est encore rangée (cartes).
CREATE TABLE type_page (
  id            TEXT    NOT NULL PRIMARY KEY,        -- clé = nom de dossier : 'races', 'guide', 'metiers'…
  libelle       TEXT    NOT NULL,                    -- 'Races', 'Ressources & craft'     (types.mjs : label)
  singulier     TEXT    NOT NULL,                    -- 'Race', 'Ressource'                (types.mjs : singular)
  salon_discord TEXT    NOT NULL,                    -- salon source dans « L'univers de Maverick » (types.mjs : discord)
  description   TEXT    NOT NULL,                    -- phrase d'accueil                   (types.mjs : blurb)
  ordre         INTEGER NOT NULL UNIQUE CHECK (ordre >= 1)             -- rang d'affichage (ordre de déclaration dans types.mjs)
) STRICT;

-- Une page du wiki = un fichier client/src/content/wiki/<type>/<slug>.md d'aujourd'hui.
CREATE TABLE page (
  id         TEXT NOT NULL PRIMARY KEY,              -- '<type>/<slug>' ; identique à l'id de la collection Astro
  type       TEXT NOT NULL REFERENCES type_page(id),
  slug       TEXT NOT NULL CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*'
                                  AND slug NOT GLOB '*--*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'),
                                                     -- ASCII minuscule + tirets (URL) ; garantit normalize(slug) = slug
  titre      TEXT NOT NULL CHECK (length(titre) > 0),                                   -- frontmatter `title`
  titre_cle  TEXT NOT NULL CHECK (titre_cle NOT GLOB '*[^a-z0-9-]*' AND titre_cle NOT GLOB '*--*' AND titre_cle NOT GLOB '-*' AND titre_cle NOT GLOB '*-'),                          -- normalize(titre) (text.mjs) : clé de tri et de comparaison.
                                                     -- Calculée par l'importeur ; client/scripts/db-derive.mjs refuse la base si elle diffère.
  resume     TEXT,                                   -- frontmatter `summary` ; NULL = absent de la source
  donnees    TEXT CHECK (donnees IS NULL OR (json_valid(donnees) AND json_type(donnees) = 'object')),
                                                     -- clés de frontmatter autres que title/aliases/tags/summary/sources/status
                                                     -- (aujourd'hui magies_innees, nom_court, resiste_a… posées par l'import),
                                                     -- telles quelles : objet JSON, ordre du fichier ; NULL = aucune.
                                                     -- Transitoire : les tables typées des domaines (races, magies) font référence.
  corps_md   TEXT NOT NULL,                          -- corps Markdown, octet pour octet. Le fichier .md ajoute seulement
                                                     -- la ligne vide qui suit l'en-tête (présente dans les 330 pages).
  statut     TEXT NOT NULL CHECK (statut IN ('example', 'draft', 'verified')),   -- frontmatter `status` (valeurs de zod)
  origine    TEXT NOT NULL REFERENCES famille(id) CHECK (length(origine) > 0),  -- clé de l'importeur : docs, magies, classes, races, bestiaire,
                                                     -- equipement, craft, annexes ; 'exemple' pour les fixtures de démo
  source_ref TEXT CHECK (source_ref IS NULL OR length(source_ref) > 0),   -- provenance fine, lisible : « Google Sheet « Magie Maverick V8 », onglet « Feu » ».
                                                     -- NULL quand la source n'en cite aucune (pages d'exemple).
  CHECK (id = type || '/' || slug)
) STRICT;

CREATE INDEX page_type_titre ON page (type, titre_cle);   -- liste d'une catégorie triée par titre

CREATE INDEX page_titre_cle  ON page (titre_cle);         -- recherche d'une page par son titre normalisé

CREATE INDEX page_slug       ON page (slug);              -- recherche d'une page par son slug (vue cle_page)

CREATE INDEX page_statut     ON page (statut);            -- masquer les pages d'exemple, lister les « verified »

CREATE INDEX page_origine    ON page (origine);           -- « supprime et réimporte cette famille »

-- Alias d'une page (frontmatter `aliases`) : autres noms utilisables dans [[ ]]. `texte` garde l'écriture d'origine ;
-- `cle` est sa forme normalisée (casse, accents, apostrophes ignorés), celle qui sert à retrouver la page (vue cle_page).
CREATE TABLE alias (
  page_id TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  ordre   INTEGER NOT NULL CHECK (ordre >= 0),       -- rang dans la liste `aliases:` (0 = premier) : l'ordre est conservé
  texte   TEXT    NOT NULL CHECK (length(texte) > 0),
  cle     TEXT    NOT NULL CHECK (cle NOT GLOB '*[^a-z0-9-]*' AND cle NOT GLOB '*--*' AND cle NOT GLOB '-*' AND cle NOT GLOB '*-'),                          -- normalize(texte), calculé par l'importeur ; client/scripts/db-derive.mjs le vérifie
  PRIMARY KEY (page_id, ordre),
  UNIQUE (page_id, texte)
) STRICT;

CREATE INDEX alias_cle   ON alias (cle);

CREATE INDEX alias_texte ON alias (texte);

-- Mots-clés d'une page (frontmatter `tags`). tag_id = normalize(libelle) : c'est la clé de l'URL /tags/<tag_id>/ (les
-- écritures « espace/temps », « espace temps » et « espace-temps » sont UN seul mot-clé). Il n'y a pas de table `tag` :
-- les mots-clés n'ont aucun attribut dans les sources, ils se déduisent de page_tag (voir la vue `tag` plus bas),
-- donc ni orphelin à nettoyer après une réimportation, ni règle d'écriture à maintenir.
CREATE TABLE page_tag (
  page_id TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  ordre   INTEGER NOT NULL CHECK (ordre >= 0),       -- rang dans la liste `tags:`
  tag_id  TEXT    NOT NULL CHECK (length(tag_id) > 0),   -- normalize(libelle), calculé par l'importeur ; client/scripts/db-derive.mjs le vérifie
  libelle TEXT    NOT NULL,                          -- écriture sur CETTE page (conserve la source sans perte)
  PRIMARY KEY (page_id, ordre),
  UNIQUE (page_id, tag_id)
) STRICT;

CREATE INDEX page_tag_tag ON page_tag (tag_id);      -- /tags/<id>/ : toutes les pages d'un mot-clé

-- Provenance au niveau de la page : une entrée de frontmatter `sources` = une ligne (texte exact).
-- Deux natures : une URL (https://docs.google.com/…) ou un libellé (« Google Sheet « Invocation », onglet « Appel aux golems » »).
-- L'appariement libellé <-> URL n'est PAS dans la source (un libellé peut précéder plusieurs URL) : il n'est pas déduit.
-- Les colonnes genre, google_id, fichier et onglets ne sont que des extraits mécaniques du texte, jamais une interprétation.
CREATE TABLE source (
  id           TEXT NOT NULL PRIMARY KEY,            -- 'google-doc:<id>' | 'google-sheet:<id>' | 'url:<url>' | 'ref:<normalize(texte)>'
  nature       TEXT NOT NULL CHECK (nature IN ('url', 'libelle')),
  texte        TEXT NOT NULL UNIQUE,                 -- entrée exacte de `sources:`
  url          TEXT CHECK ((nature = 'url') = (url IS NOT NULL)),    -- = texte pour une URL, NULL sinon
  genre        TEXT CHECK (genre IN ('doc', 'sheet')),               -- « Google Doc » / « Google Sheet », ou /document/d/ / /spreadsheets/d/
  google_id    TEXT,                                 -- identifiant du fichier Google extrait de l'URL (clé `id` de sources/sources.json)
  fichier      TEXT,                                 -- titre du fichier cité par « Google Doc|Sheet « … » », sinon NULL
  onglets      TEXT CHECK (onglets IS NULL OR json_valid(onglets)),  -- liste JSON des onglets cités (« onglet(s) « … » »), sinon NULL
  CHECK (google_id IS NULL OR genre IS NOT NULL)
) STRICT;

CREATE INDEX source_google ON source (google_id) WHERE google_id IS NOT NULL;

CREATE INDEX source_fichier ON source (fichier) WHERE fichier IS NOT NULL;

CREATE TABLE page_source (
  page_id   TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  ordre     INTEGER NOT NULL CHECK (ordre >= 0),     -- rang dans la liste `sources:`
  source_id TEXT    NOT NULL REFERENCES source(id),
  PRIMARY KEY (page_id, ordre),
  UNIQUE (page_id, source_id)
) STRICT;

CREATE INDEX page_source_source ON page_source (source_id);

-- Lien page -> entité typée. Chaque importeur de domaine écrit ses lignes (test de complétude : db:check). Convention d'id : l'entité qui a SA
-- page réutilise l'id de la page (principale = 1) ; une sous-entité a l'id '<id de la page qui la contient>#<sorte>:<slug>' (principale = 0).
-- `entite_table` n'est pas une clé étrangère (SQLite ne vise pas une table variable) : db:check vérifie que (entite_table, entite_id) existe.
CREATE TABLE page_entite (
  entite_table TEXT    NOT NULL CHECK (length(entite_table) > 0 AND entite_table NOT GLOB '*[^a-z_]*'),   -- 'magie', 'sort', 'classe', 'race'…
  entite_id    TEXT    NOT NULL CHECK (length(entite_id) > 0),
  page_id      TEXT    NOT NULL REFERENCES page(id),   -- sans CASCADE : les lignes se balaient par `origine` (design.md §4.2)
  principale   INTEGER NOT NULL CHECK (principale IN (0, 1)),   -- 1 = la page EST cette entité ; 0 = la page la contient
  origine      TEXT    NOT NULL REFERENCES famille(id),
  PRIMARY KEY (entite_table, entite_id)
) STRICT;
CREATE INDEX page_entite_page ON page_entite (page_id);
CREATE INDEX page_entite_id   ON page_entite (entite_id);
CREATE UNIQUE INDEX page_entite_principale ON page_entite (page_id) WHERE principale = 1;   -- au plus une entité principale par page

-- ====================================================================================================================
-- 2. RÈGLES DE LA FICHE : caractéristiques, compétences, niveaux, constantes, postures (famille « fiche »)
-- Ce que le générateur de fiche lit : `npm run db:export-rules` (design.md, §8) en tire client/src/data/rules.json par des SELECT simples.
-- ====================================================================================================================

-- Les six caractéristiques (Personnage!B18:R19). Valeurs de base, bornes et bonus : voir regle_constante, seuil_niveau et,
-- pour les restrictions par race, race_restriction_carac / v_race_carac_borne (domaine races).
CREATE TABLE caracteristique (
  id         TEXT    NOT NULL PRIMARY KEY,
  nom        TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                       -- « Force » (étiquette de la fiche)
  lettre     TEXT    NOT NULL UNIQUE CHECK (lettre GLOB '[A-Z]'),   -- suffixe des compétences : « Arc (F) » : F V I P S A
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),    -- ordre de la fiche : Force, Volonté, Intelligence, Perception, Social, Agilité
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Les 30 compétences : 5 par caractéristique (Personnage!B22:B36 et O22:O36). « Nat. » et « Acquis » sont saisis par le joueur :
-- ils ne sont pas des données de règle (plafonds : seuil_niveau 'competence_naturel_max' et regle_constante
-- 'competence.acquis_max_par_point_caracteristique').
CREATE TABLE competence (
  id                 TEXT    NOT NULL PRIMARY KEY,          -- normalize(nom) : 'arme-lourde'
  nom                TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),               -- libellé de la fiche sans le suffixe : « Arme Lourde »
  caracteristique_id TEXT    NOT NULL REFERENCES caracteristique(id),
  ordre              INTEGER NOT NULL UNIQUE CHECK (ordre BETWEEN 1 AND 30),   -- ordre de la fiche (blocs de 5 par caractéristique)
  libelle_fiche      TEXT    NOT NULL UNIQUE,               -- « Arme Lourde (F) » tel qu'écrit dans la cellule
  description        TEXT,                                  -- phrase du guide « Compétences » (italiques retirés, [[liens]] conservés) ;
                                                            -- NULL quand le guide ne décrit pas cette compétence (Calme : le guide écrit « Prouesse »,
                                                            -- voir ecart_source)
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

CREATE INDEX competence_caracteristique ON competence (caracteristique_id, ordre);

-- Table « Expérience / Niveau global » du guide, une ligne par niveau, recoupée avec BDD!G2:H21 (même 20 paliers).
-- Les colonnes typées sont les « Dons » du guide ; NULL = le guide n'écrit pas ce don à ce niveau (pas « 0 »). Pour les cumuls
-- et les valeurs de la fiche à un niveau donné : vue v_niveau.
CREATE TABLE niveau_global (
  niveau                      INTEGER NOT NULL PRIMARY KEY CHECK (niveau BETWEEN 1 AND 20),
  xp_min                      INTEGER NOT NULL UNIQUE CHECK (xp_min >= 0),   -- « Xp nécessaire » = BDD!G « Palier XP » ; niveau = dernier palier <= XP (VLOOKUP approché)
  points_competences          INTEGER CHECK (points_competences > 0),         -- « 100 points de compétences » (niveau 1), 20, ou 40 aux niveaux 5, 10, 15, 20
  points_attributs            INTEGER CHECK (points_attributs > 0),           -- « 15 points d'attributs à répartir »
  caracteristiques_a_repartir INTEGER CHECK (caracteristiques_a_repartir > 0),-- « +1 Caractéristique à répartir » (niveaux 5, 10, 15)
  maximum_naturel_bonus       INTEGER CHECK (maximum_naturel_bonus > 0),      -- « +10 maximum naturel » (niveaux 5 et 10)
  niveaux_classe              INTEGER CHECK (niveaux_classe > 0),             -- « +2 Niveaux de classe »
  niveaux_maitrise            INTEGER CHECK (niveaux_maitrise > 0),           -- « 1 Niveau de maîtrise pour un sort »
  puissance_magique           INTEGER CHECK (puissance_magique BETWEEN 1 AND 5),   -- « Puissance magique niveau N » obtenue à ce niveau (version du GUIDE : 5 au niveau 16)
  puissance_magique_note      TEXT,                                           -- parenthèse du guide : « non disponible pour les personnages avec une magie acquise »
  de_attributs_bonus          TEXT,                                           -- « 1d8 santé OU 1d8 chakra OU 1d4 pour les deux » (niveaux 5, 10, 15, 20), texte du guide
  dons_brut                   TEXT    NOT NULL,                               -- cellule « Dons » telle qu'écrite (les <br> sont conservés)
  origine                     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref                  TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Déblocages écrits dans la colonne « Dons » qui ne sont pas des quantités : mode hyper (niveau 2), mode hyper 100 % et
-- récupération par Méditation / Repos (niveau 10). `code` est un vocabulaire fermé : le chargeur s'arrête devant une ligne inconnue.
CREATE TABLE niveau_deblocage (
  niveau     INTEGER NOT NULL REFERENCES niveau_global(niveau),
  rang       INTEGER NOT NULL CHECK (rang >= 1),             -- rang du don dans la cellule
  code       TEXT    NOT NULL CHECK (code IN ('mode_hyper', 'mode_hyper_100', 'meditation_repos')),
  texte      TEXT    NOT NULL,                               -- ligne du guide, sans le tiret : « Mode Hyper débloqué ! »
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (niveau, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX niveau_deblocage_code ON niveau_deblocage (code, niveau);

-- Valeurs par palier de niveau global lues dans les formules de la fiche (BDD!K28, K36, AK2:AK6) : « à partir du niveau
-- `niveau_min` (inclus), la valeur est `valeur` ». Le chargeur lit la FORMULE (IF imbriqués) ; elle est recopiée dans `formule`.
--   valeur au niveau N = valeur de la ligne de plus grand niveau_min <= N (voir v_niveau).
--   regle 'caracteristiques_total'    : total des 6 bases à répartir (BDD!K36, « Caractéristiques Max ») : 14, 15, 16, 17
--   regle 'competence_naturel_max'    : plafond de la colonne « Nat. » de chaque compétence (BDD!K28, « Maximum naturel ») : 20, 30, 40
--   regle 'puissance_magique_max'     : niveau de puissance magique maximal de la FEUILLE (BDD!AK2:AK6) : 1, 2, 3, 4, 5.
--                                       Le guide dit 16 pour le niveau 5 de puissance, la feuille 17 (voir ecart_source).
CREATE TABLE seuil_niveau (
  regle      TEXT    NOT NULL CHECK (regle IN ('caracteristiques_total', 'competence_naturel_max', 'puissance_magique_max')),
  niveau_min INTEGER NOT NULL CHECK (niveau_min BETWEEN 1 AND 20),
  valeur     INTEGER NOT NULL,
  condition  TEXT    CHECK (condition IN ('sans_magie_acquise')),   -- puissance 5 : « AND(W8>16, S3="") » : refusée avec une magie acquise
  libelle    TEXT    NOT NULL,                               -- étiquette de la cellule dans la fiche : « Caractéristiques Max »
  formule    TEXT    NOT NULL,                               -- cellule et formule d'origine
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  PRIMARY KEY (regle, niveau_min)
) STRICT, WITHOUT ROWID;

-- Constantes chiffrées de règle. Une ligne = une phrase d'un texte de règle (nature 'texte' : page du guide ou cellule de texte d'un
-- classeur, `texte` = la phrase telle qu'écrite) ou un facteur écrit dans une formule de la fiche (nature 'formule', `texte` = le
-- fragment de formule). Le chargeur vérifie que `texte` figure bien dans la cellule ou la page citée. Les règles qui restent du
-- texte sont dans les pages (corps_md).
CREATE TABLE regle_constante (
  id         TEXT    NOT NULL PRIMARY KEY,                   -- 'caracteristique.base_min', 'competence.acquis_max_par_point_caracteristique'…
  valeur     INTEGER NOT NULL,
  unite      TEXT,                                           -- 'points', '%', 'tours'… ; NULL si le nombre n'a pas d'unité propre
  nature     TEXT    NOT NULL CHECK (nature IN ('texte', 'formule')),
  texte      TEXT    NOT NULL,                               -- la phrase, ou le fragment de formule, tels qu'écrits
  page_id    TEXT    REFERENCES page(id),                    -- page qui présente la phrase (nature 'texte') ; NULL pour une formule
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('fiche', 'annexes')),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((nature = 'texte') = (page_id IS NOT NULL))
) STRICT;

CREATE INDEX regle_constante_page ON regle_constante (page_id) WHERE page_id IS NOT NULL;

-- Table d'entraînement (guide « Capacités/Don » : un D100 donne un bonus d'Acquis). Une ligne = une plage de dé.
CREATE TABLE entrainement_palier (
  de_min           INTEGER NOT NULL PRIMARY KEY CHECK (de_min BETWEEN 1 AND 100),
  de_max           INTEGER NOT NULL CHECK (de_max BETWEEN 1 AND 100),
  bonus_acquis_pct INTEGER CHECK (bonus_acquis_pct > 0),     -- « 5% d'acquis » -> 5 ; NULL quand l'entraînement est raté
  rate             INTEGER NOT NULL CHECK (rate IN (0, 1)),  -- 1 = « Entraînement raté ! »
  valeur_brut      TEXT    NOT NULL,                         -- « 1-20 »
  resultat_brut    TEXT    NOT NULL,                         -- « 5% d'acquis »
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK (de_min <= de_max),
  CHECK ((bonus_acquis_pct IS NULL) = (rate = 1))
) STRICT;

-- Bonus d'initiative selon l'Agilité (guide « Attributs » : « D20 + … »). L'Agilité 5 n'est atteignable qu'avec une magie précise.
CREATE TABLE initiative_agilite (
  agilite    INTEGER NOT NULL PRIMARY KEY CHECK (agilite BETWEEN 1 AND 5),
  bonus      INTEGER NOT NULL,                               -- « -2 initiative » -> -2 ; « +0 initiative » -> 0
  note       TEXT,                                           -- parenthèse de l'en-tête : « Atteignable uniquement avec la magie du Vent ou de la Foudre/Vent »
  bonus_brut TEXT    NOT NULL,                               -- « -2 initiative »
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Les quatre types de don (guide « Capacités/Don »). Le domaine classes écrit capacite.type avec les mêmes clés
-- (+ 'variable', qui n'est pas dans le guide) ; une clé étrangère pourra les relier.
CREATE TABLE type_don (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (id IN ('passif', 'actif', 'action', 'reaction')),
  nom        TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                        -- « Réaction »
  definition TEXT    NOT NULL,                               -- phrase du guide après les deux-points
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- ▸ POSTURES DE COMBAT
-- Six postures. Trois textes coexistent : le tableau de la fiche (Personnage!BA16:BR25, versions courtes), la page « Tableau Posture »
-- du Google Doc de la fiche et la page « Postures » du guide MJ. Ils diffèrent par endroits (voir ecart_source).
CREATE TABLE posture (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (id GLOB 'guide/postures#posture:*'),
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                       -- « Offensif » (titre de la page « Postures »)
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),    -- ordre de la page « Postures »
  libelle_fiche TEXT  NOT NULL UNIQUE,                       -- libellé du tableau de la fiche : « OFFENSIF », « DEFENSIF »
  description TEXT    NOT NULL,                              -- paragraphe de présentation de la page « Postures » (avant « Ses effets sont : »)
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

CREATE TABLE posture_effet (
  posture_id TEXT    NOT NULL REFERENCES posture(id),
  version    TEXT    NOT NULL CHECK (version IN ('fiche', 'guide_fiche', 'guide_mj')),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  intitule   TEXT,                                           -- partie en gras du guide : « +5% à la réussite critique » ; NULL pour la version 'fiche' (une ligne de texte)
  texte      TEXT    NOT NULL,                               -- version 'fiche' : la ligne sans le tiret ; versions guide : l'explication après « : »
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (posture_id, version, rang),
  CHECK ((version = 'fiche') = (intitule IS NULL))
) STRICT, WITHOUT ROWID;

-- ====================================================================================================================
-- 3. MAGIES ET SORTS (famille « magies »)
-- id d'une magie = id de sa page ; id d'un sort = '<id de la magie>#sort:<slug du nom>'. Les dieux (`dieu`) sont dans la section 5.
-- ====================================================================================================================

-- MAGIE : une ligne par onglet de magie (15 : Potentiel Illimité + 14 magies)
CREATE TABLE magie (
  id                    TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page (entité typée qui a SA page)
  nom                   TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom court tel qu'écrit dans les listes de résistances et d'incompatibilités :
                                                    -- 'Sang', 'Espace/Temps', 'Potentiel Illimité' (onglet « Magie » de la fiche)
  nom_cle               TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),    -- normalize(nom) comme text.mjs : 'sang', 'espace-temps', 'potentiel-illimite'
  onglet                TEXT    NOT NULL,           -- nom exact de l'onglet du classeur V8 (le dump tronque 'Potentiel illimité (magie diffi')
  ordre                 INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang de l'onglet dans le classeur (1 = Potentiel illimité)
  banniere              TEXT,                       -- texte d'avertissement de la bannière d'en-tête (Potentiel : « MAGIE DIFFICILE A JOUER !! »)
  description           TEXT,                       -- texte d'introduction (A4), paragraphes séparés par des lignes vides
  description_physique  TEXT,                       -- bloc « Description physique »
  explication           TEXT,                       -- bloc « Explication » (Arcane, Corruption, Potentiel Illimité seulement)
  sante_offerte         INTEGER CHECK (sante_offerte >= 0),   -- « Santé offert » (valeurs entières dans la source)
  chakra_offert         INTEGER CHECK (chakra_offert >= 0),   -- « Chakra offert »
  caracteristique_id    TEXT    REFERENCES caracteristique(id),   -- « Caractéritiques bonus » reconnue ; NULL pour « AU CHOIX ou ALEATOIRE »
  caracteristique_brut  TEXT,                       -- cellule telle qu'écrite (« FORCE », « AU CHOIX ou ALEATOIRE »)
  barre4_ressource      TEXT    CHECK (barre4_ressource IN ('sang', 'ame')),   -- ressource de la « 4ème barre » (Sang, Nécromancie) ; NULL = pas de 4ème barre
  barre4_texte          TEXT,                       -- cellule « 4ème barre » telle qu'écrite
  barre4_max            INTEGER,                    -- « maximum de 10 Sang » : extrait du texte ci-dessus (NULL si la forme ne correspond pas)
  barre4_regen          INTEGER,                    -- « la régénère de 1 par tour » : idem
  incompatibilite_note  TEXT,                       -- bloc « Magie non compatible » quand ce n'est PAS une liste de noms de magies (Corruption : phrase de la source,
                                                    -- gardée comme trace : la page affiche « Mono-magie uniquement », voir mono_magie)
  origine               TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref            TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  mono_magie            INTEGER NOT NULL CHECK (mono_magie IN (0, 1)),   -- 1 = « Mono-magie uniquement » : ne se combine avec aucune autre magie, sauf pour les
                                                    -- ethnies de magie_ethnie_secondaire (décision R15 du propriétaire : Potentiel Illimité et Corruption ; migration 0010)
  CHECK ((barre4_ressource IS NULL) = (barre4_texte IS NULL))
) STRICT;

CREATE INDEX magie_caracteristique ON magie (caracteristique_id) WHERE caracteristique_id IS NOT NULL;

-- Rôles de la magie (bloc « ROLES » : trois cellules, de gauche à droite). `rang` = position dans l'onglet ; la source ne dit
-- pas que le premier rôle est « principal » : ne pas l'interpréter.
CREATE TABLE magie_role (
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
  role       TEXT    NOT NULL CHECK (role IN ('degats', 'renforcement', 'soin', 'entrave', 'placement', 'invocation')),
  role_brut  TEXT    NOT NULL,                      -- écriture de la source (« DÉGATS »)
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_id, rang),
  UNIQUE (magie_id, role)
) STRICT, WITHOUT ROWID;

CREATE INDEX magie_role_role ON magie_role (role);

-- Résistances et vulnérabilités de la magie (4 blocs de l'onglet : « Résistance magique », « Vulnérabilité magique »,
-- « Résistance altération d'état », « Vulnérabilité altération d'état » ; « Aucune » = aucune ligne).
-- Une ligne = un nom de la liste, dans l'ordre de la source (rang).
--   cible_type = 'magie' : cible_magie_id renseigné (liste de noms de magies).
--   cible_type = 'etat'  : cible_etat_id renseigné. La source écrit « Gelé » et « Pétrification » là où la liste des
--                          altérations dit « Gel » et « Pétrifié » : le rapprochement est fait par l'importeur (table
--                          d'alias explicite) ; cible_brut garde l'écriture d'origine.
-- Les lignes 'etat' sont, d'après la fiche (spécification resist.total-etat), l'image des lignes 'magie' par la colonne
-- « Magie Liée » de la liste des altérations ; elles sont conservées parce que la source les écrit.
CREATE TABLE magie_resistance (
  magie_id        TEXT    NOT NULL REFERENCES magie(id),
  sens            TEXT    NOT NULL CHECK (sens IN ('resistance', 'vulnerabilite')),
  cible_type      TEXT    NOT NULL CHECK (cible_type IN ('magie', 'etat')),
  rang            INTEGER NOT NULL CHECK (rang >= 1),
  cible_magie_id  TEXT    REFERENCES magie(id),
  cible_etat_id   TEXT    REFERENCES etat(id),
  cible_brut      TEXT    NOT NULL,
  origine         TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_id, sens, cible_type, rang),
  UNIQUE (magie_id, sens, cible_magie_id),
  UNIQUE (magie_id, sens, cible_etat_id),
  CHECK ((cible_type = 'magie' AND cible_magie_id IS NOT NULL AND cible_etat_id IS NULL)
      OR (cible_type = 'etat'  AND cible_etat_id  IS NOT NULL AND cible_magie_id IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX magie_resistance_cible_magie ON magie_resistance (cible_magie_id, sens) WHERE cible_magie_id IS NOT NULL;

CREATE INDEX magie_resistance_cible_etat  ON magie_resistance (cible_etat_id, sens)  WHERE cible_etat_id  IS NOT NULL;

-- Magies qu'on ne peut pas combiner. Une ligne = « magie_id cite autre_magie_id » dans sa liste d'incompatibilités, telle
-- que la source la porte (donc dirigée) : la liste structurée de l'onglet V8 quand il y en a une (Sang, Arcane, Espace/Temps,
-- Vide, Nécromancie), sinon la colonne « Incompatible » de la fiche (`Magie!T`) : Corruption (l'onglet V8 n'a qu'une phrase, voir
-- magie.incompatibilite_note), Potentiel Illimité (pas de bloc) et les 8 magies élémentaires/lumière/ombre (pas de bloc :
-- elles ne citent que Potentiel Illimité). Les 15 listes de la fiche sont symétriques (22 paires) : la vue v_magie_incompatible
-- donne la relation symétrique, c'est elle qu'il faut interroger (une paire citée d'un seul côté compte dans les deux sens).
CREATE TABLE magie_incompatibilite (
  magie_id        TEXT NOT NULL REFERENCES magie(id),
  autre_magie_id  TEXT NOT NULL REFERENCES magie(id),
  origine         TEXT NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref      TEXT NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_id, autre_magie_id),
  CHECK (magie_id <> autre_magie_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX magie_incompatibilite_autre ON magie_incompatibilite (autre_magie_id);

-- Ethnies pour lesquelles une magie secondaire reste possible malgré les incompatibilités (fiche `Magie!U5`, colonne
-- « Magie secondaire si Race » : « Elfe Noir Charbon, Elfe Noir Salé, Felfe Noir » pour Corruption). `ethnie_brut` est le nom écrit ;
-- `ethnie_id` l'ethnie rapprochée (les noms de la source se résolvent exactement : « Felfe Noir » = races/felfe#ethnie:felfe-noir).
-- L'Elfe Noir Salé de la cellule est une erreur (décision R15 du propriétaire, comme le dit la phrase de l'onglet : « Seuls les Elfes noirs (Charbon)
-- et les Felfes noirs ») : sa ligne est retirée par la migration 0010.
CREATE TABLE magie_ethnie_secondaire (
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  ethnie_id  TEXT    NOT NULL REFERENCES ethnie(id),   -- ethnie de la table `ethnie` (domaine races)
  ethnie_brut TEXT   NOT NULL,                         -- nom écrit dans la cellule
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_id, rang),
  UNIQUE (magie_id, ethnie_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE magie_dieu (
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  dieu_id    TEXT    NOT NULL REFERENCES dieu(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),    -- ordre d'écriture dans la cellule (« Notix & Capse » : 1 et 2)
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_id, dieu_id),
  UNIQUE (magie_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX magie_dieu_dieu ON magie_dieu (dieu_id);

-- Tableau « AMELIORATION CADAVERIQUE » de la Nécromancie (13 lignes : nom, effet). Le nom est celui d'une amélioration
-- d'invocation ; le lien avec le bestiaire (invocations « Zombi », « Momie »…) n'est pas dans la source : non modélisé.
CREATE TABLE amelioration_cadaverique (
  id         TEXT    NOT NULL PRIMARY KEY,          -- '<magie.id>#amelioration:<slug du nom>'
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),    -- ordre du tableau : colonne de gauche (D) puis de droite (T), de haut en bas
  nom        TEXT    NOT NULL CHECK (length(nom) > 0),
  effet      TEXT    NOT NULL,
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (magie_id, rang),
  UNIQUE (magie_id, nom)
) STRICT;

-- SORT : une ligne par sort de la table des sorts (14 magies x 23 sorts = 322 ; Potentiel Illimité n'a pas de table propre :
-- il pioche dans les 14 autres, règle de la fiche, hors de ce domaine)
CREATE TABLE sort (
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

CREATE INDEX sort_magie_niveau ON sort (magie_id, niveau, ordre);     -- « tous les sorts d'une magie triés par palier »

CREATE INDEX sort_nom_cle      ON sort (nom_cle);                                     -- « le sort Boule de feu » (plusieurs magies possibles)

CREATE INDEX sort_niveau       ON sort (niveau);

CREATE INDEX sort_cout_chakra  ON sort (cout_chakra) WHERE cout_chakra IS NOT NULL;   -- « sorts qui coûtent <= N »

CREATE INDEX sort_zone_forme   ON sort (zone_forme);                                  -- « sorts de zone »

CREATE INDEX sort_portee       ON sort (portee_nature, portee_valeur);

-- Types d'un sort : « Attaque/ Entrave (Imparable) » = deux types. Les parenthèses sont retirées avant de couper sur « / ».
-- `libelle` garde l'écriture d'origine (« Entave » pour deux sorts : faute de frappe de la source, rapprochée de 'entrave').
CREATE TABLE sort_type (
  sort_id    TEXT    NOT NULL REFERENCES sort(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  type       TEXT    NOT NULL CHECK (type IN ('attaque', 'entrave', 'soin', 'amplification', 'placement', 'invocation',
                                             'construction', 'protection', 'meteo', 'aleatoire')),
  libelle    TEXT    NOT NULL,
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, rang),
  UNIQUE (sort_id, type)
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_type_type ON sort_type (type);

-- Mode d'un sort : ce que la colonne « Type » écrit entre parenthèses (« Amplification (IC) », « Attaque\n(Imparable) »), séparé du TYPE (sort_type : attaque, entrave…).
-- Valeur de BASE seulement : « IC », « Imparable », « Inesquivable », « IC x 2 », « IC x 3 ». Un mode qui dépend d'un niveau de maîtrise (« IC pour 3 NM », « IC x 2 si 3NM »,
-- « IC x 1/NM ») est un bonus de maîtrise : voir sort_bonus_maitrise (champ 'type'). `libelle` garde l'écriture d'origine ; `fois` = N de « IC x N » (NULL sinon).
-- Rien n'est déduit : « IC x 2 » n'est pas expliqué par la source, sa valeur est seulement typée.
CREATE TABLE sort_mode (
  sort_id    TEXT    NOT NULL REFERENCES sort(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  mode       TEXT    NOT NULL CHECK (mode IN ('ic', 'imparable', 'inesquivable')),
  libelle    TEXT    NOT NULL CHECK (length(libelle) > 0),
  fois       INTEGER CHECK (fois >= 2),
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, rang),
  UNIQUE (sort_id, mode),
  CHECK (fois IS NULL OR mode = 'ic')
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_mode_mode ON sort_mode (mode);

-- Bonus de niveau de maîtrise (NM) d'un sort : chaque renforcement que les cellules du classeur écrivent, quelle que soit la colonne. Un sort cumule 3 NM au plus ; il est renforcé
-- à chaque NM ou quand il atteint un palier (en général 3 NM) : devenir IC, coût en chakra qui baisse, portée, zone, dégâts / soins / barrière, effet secondaire en plus.
-- Trois natures :
--   'par_nm'  : « (+1d6/NM) », « (-5/NM) », « (+1d/3NM) », « 1%/NM », « IC x 1/NM » : increment_brut = ce qui précède la barre (« +1d6 », « -5 »), pas_nm = 1 (« /NM ») ou 3 (« /3NM »),
--             increment_entier = l'entier signé quand l'incrément en est un (-5, +2 ; « –1 » avec tiret demi-cadratin = -1) ;
--   'palier'  : « 3NM = Sur un coup critique… », « IC pour 3 NM », « … à 3NM », « … au niveau 3 de maîtrise » : seuil_nm = N, l'effet vaut à partir de N NM ;
--   'texte'   : une mention de NM qui n'est ni l'un ni l'autre (« Les NM sont utiles pour le sort aléatoire ») : rien de typé.
-- Rien n'est calculé : `texte_brut` est l'expression recopiée de la cellule, `contexte` le passage de la cellule qui dit ce qu'elle modifie (« Dure 2 tours (+1/NM) » ;
-- identique à texte_brut quand la colonne le dit déjà : « -5/NM » dans un coût). Les valeurs typées ne sont posées que quand l'écriture est sans ambiguïté.
-- Les sorts sans NM écrit n'ont aucune ligne. v_sort_bonus_au_nm donne ce qui s'applique à un niveau de maîtrise donné (0 à 3).
-- Remplace sort_progression_nm (migration 0004) : même contenu, désormais exhaustif (champs type et remarque, natures complétées).
CREATE TABLE sort_bonus_maitrise (
  sort_id          TEXT    NOT NULL REFERENCES sort(id),
  champ            TEXT    NOT NULL CHECK (champ IN ('type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque')),   -- colonne de la source où l'expression est écrite
  rang             INTEGER NOT NULL CHECK (rang >= 1),     -- ordre d'apparition dans la cellule
  nature           TEXT    NOT NULL CHECK (nature IN ('par_nm', 'palier', 'texte')),
  texte_brut       TEXT    NOT NULL CHECK (length(texte_brut) > 0),    -- l'expression de NM, exacte : « +1d6/NM », « 3NM = Croix 1x1 », « IC pour 3 NM »
  contexte         TEXT    NOT NULL CHECK (length(contexte) > 0),      -- le passage de la cellule qui la contient et dit ce qu'elle modifie
  increment_brut   TEXT,
  increment_entier INTEGER,
  pas_nm           INTEGER CHECK (pas_nm IN (1, 3)),
  seuil_nm         INTEGER CHECK (seuil_nm BETWEEN 1 AND 3),
  origine          TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, champ, rang),
  CHECK (instr(contexte, texte_brut) > 0),
  CHECK ((nature = 'par_nm'  AND increment_brut IS NOT NULL AND pas_nm IS NOT NULL AND seuil_nm IS NULL)
      OR (nature = 'palier'  AND seuil_nm IS NOT NULL AND increment_brut IS NULL AND increment_entier IS NULL AND pas_nm IS NULL)
      OR (nature = 'texte'   AND seuil_nm IS NULL AND increment_brut IS NULL AND increment_entier IS NULL AND pas_nm IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_bonus_maitrise_champ ON sort_bonus_maitrise (champ, nature);

-- Sort <-> altération d'état. INDEX DÉRIVÉ DU TEXTE (la source n'a pas de colonne « états ») : l'importeur ne retient que les
-- tournures explicites, et `relation` redit la tournure, pas une règle :
--   'inflige' : « Inflige / infliger / Rend la cible / État « … » <état> [n] » ;
--   'prend'   : « pour ne pas prendre / ne pas être <état> [n] » (état subi en cas d'échec du jet ; qui le subit — la cible ou
--               le lanceur — se lit dans l'extrait) ;
--   'soigne'  : « soigner [un état de] <état>, <état>… ».
-- `extrait` donne la phrase d'où la ligne est tirée, `forme_trouvee` le mot rapproché de l'état (table d'alias de l'importeur).
-- Non exhaustif : une mention libre (« Coma. », « lien de gel », « Peur 3 pour la cible ») n'est pas retenue.
CREATE TABLE sort_etat (
  sort_id        TEXT    NOT NULL REFERENCES sort(id),
  etat_id        TEXT    NOT NULL REFERENCES etat(id),
  relation       TEXT    NOT NULL CHECK (relation IN ('inflige', 'prend', 'soigne')),
  rang           INTEGER NOT NULL CHECK (rang >= 1),    -- occurrence dans le sort (un même état peut revenir : stade 1 puis stade 2)
  stade          INTEGER CHECK (stade BETWEEN 1 AND 3), -- nombre qui suit le nom (« brûlure 2 », « gel 1 »), sinon NULL
  champ          TEXT    NOT NULL CHECK (champ IN ('type', 'cout', 'zone', 'dsb', 'effets')),
  forme_trouvee  TEXT    NOT NULL,
  extrait        TEXT    NOT NULL,
  origine        TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, etat_id, relation, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_etat_etat ON sort_etat (etat_id, relation);

-- Fils de commentaires du Sommaire ancrés en A1 : commentaires de cellules supprimées, sans sort identifiable (certains portent
-- des textes de règle). Conservés tels quels, sans rattachement inventé.
CREATE TABLE commentaire_orphelin (
  id         TEXT    NOT NULL PRIMARY KEY,           -- 'magies#commentaire-orphelin:<empreinte>' ; '…~2' si le même texte figure dans deux fils (6 cas)
                                                             -- (le rang du fil dans le .xlsx n'entre pas dans l'identifiant)
  empreinte  TEXT    NOT NULL CHECK (length(empreinte) = 12 AND empreinte NOT GLOB '*[^0-9a-f]*'),
                                                             -- 12 premiers caractères hexadécimaux de sha256(texte en UTF-8) ; db:check la recalcule
  occurrence INTEGER NOT NULL CHECK (occurrence >= 1),       -- n° d'apparition de ce texte parmi les fils : 1, sauf texte répété
  onglet     TEXT    NOT NULL,
  cellule    TEXT    NOT NULL,
  resolu     INTEGER NOT NULL CHECK (resolu IN (0, 1)),
  texte      TEXT    NOT NULL,
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  UNIQUE (empreinte, occurrence),
  CHECK (id = 'magies#commentaire-orphelin:' || empreinte || CASE WHEN occurrence > 1 THEN '~' || occurrence ELSE '' END)
) STRICT;

-- Légende commune des 14 tables de sorts (identique dans chaque onglet) : « IC = Instant Cast » et les trois modes d'obtention
-- d'un niveau de maîtrise (N, L, C).
CREATE TABLE legende_sort (
  code        TEXT NOT NULL PRIMARY KEY,             -- 'IC', 'N', 'L', 'C', 'NM'
  groupe      TEXT NOT NULL CHECK (groupe IN ('type', 'obtention_nm', 'abreviation')),
  libelle     TEXT NOT NULL,                         -- « Instant Cast », « Par Niveau »…
  description TEXT,                                  -- complément de la source (IC : « Le sort ne consomme pas le Tour du joueur… »)
  origine     TEXT NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref  TEXT NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Règles de magie qui valent pour toutes les magies (Sommaire!A31 : « Règle spéciale pour sort niveau 5 »).
CREATE TABLE regle_magie (
  id           TEXT    NOT NULL PRIMARY KEY,         -- 'magies#regle:<slug du titre>' ('magies#regle:regle-speciale-pour-sort-niveau-5')
  titre        TEXT    NOT NULL,                     -- début du texte jusqu'à « : »
  niveau_sort  INTEGER CHECK (niveau_sort BETWEEN 1 AND 5),   -- niveau de sort concerné quand le titre le dit
  texte        TEXT    NOT NULL,                     -- cellule entière, telle qu'écrite
  origine      TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- ====================================================================================================================
-- 4. ANNEXES DES MAGIES : états, résistances, météo, modes hyper et super (famille « annexes »)
-- Altérations d'état (`etat` : id 'guide/liste-des-alterations-d-etat#etat:<slug>', visé par les autres domaines), résistances, météo, modes.
-- ====================================================================================================================

-- Les 6 paliers de la fiche (Personnage!BA2:BA12) : une valeur de résistance V (somme des crans) donne un palier.
-- V >= 3 immunité, 2 grande résistance, 1 résistance, -1 vulnérabilité, -2 grande vulnérabilité, V <= -3 sensibilité ; V = 0 : neutre
-- (aucune ligne). Les bornes sont lues dans les formules BI2:BI12 (BDD!V > 2, = 2, = 1, = -1, = -2, < -2).
CREATE TABLE resistance_palier (
  id             TEXT    NOT NULL PRIMARY KEY CHECK (id IN ('immunite', 'grande_resistance', 'resistance', 'vulnerabilite', 'grande_vulnerabilite', 'sensibilite')),
  libelle        TEXT    NOT NULL UNIQUE,                    -- « Grande résistance »
  valeur_min     INTEGER,                                    -- V >= valeur_min ; NULL = pas de borne basse
  valeur_max     INTEGER,                                    -- V <= valeur_max ; NULL = pas de borne haute
  multiplicateur REAL    NOT NULL CHECK (multiplicateur >= 0),   -- « dégâts subits ÷4 » -> 0.25 ; « =0 » -> 0 ; « x8 » -> 8
  effet_brut     TEXT    NOT NULL,                           -- « dégâts subits ÷4 »
  ordre          INTEGER NOT NULL UNIQUE CHECK (ordre >= 1), -- ordre d'affichage de la fiche (immunité en premier)
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK (valeur_min IS NOT NULL OR valeur_max IS NOT NULL),
  CHECK (valeur_min IS NULL OR valeur_max IS NULL OR valeur_min <= valeur_max)
) STRICT;

-- Matrice de résistance de la FICHE (Magie!F2:S16) : 15 magies du personnage (lignes) x 14 magies qui attaquent (colonnes).
-- valeur = +1 résistance d'un cran, -1 vulnérabilité d'un cran, 0 neutre (la source écrit 0 : conservé). Ces valeurs alimentent
-- BDD!S (magie innée) et BDD!T (magie acquise), qui s'additionnent (règle déduite par la spécification : l'export du classeur ne
-- contient pas la formule). Le domaine magies porte les listes du classeur V8 (magie_resistance) : elles diffèrent pour Arcane et
-- Corruption (voir v_resistance_ecart et ecart_source).
CREATE TABLE resistance_magie (
  magie_id         TEXT    NOT NULL REFERENCES magie(id),    -- magie du personnage : celle qui résiste ou est vulnérable
  attaque_magie_id TEXT    NOT NULL REFERENCES magie(id),    -- magie de l'attaque subie (en-tête de colonne F1:S1)
  valeur           INTEGER NOT NULL CHECK (valeur IN (-1, 0, 1)),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  PRIMARY KEY (magie_id, attaque_magie_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX resistance_magie_attaque ON resistance_magie (attaque_magie_id, valeur);

-- Tableau « Résistance Faiblesse » de l'onglet Statistiques du classeur V8 : les 73 couples de magies qu'il traite (ordre de l'onglet,
-- magie A puis magie B telles que la source les écrit : « Sang + Vide » et non « Vide + Sang »). Un couple peut n'avoir aucune ligne dans
-- resistance_combinaison (Lumière + Ombre : « AUCUNE » aux quatre paliers) : d'où cette table.
CREATE TABLE resistance_duo (
  magie_a_id TEXT    NOT NULL REFERENCES magie(id),
  magie_b_id TEXT    NOT NULL REFERENCES magie(id),
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),     -- rang du couple dans le tableau (1 = Sang + Vide)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  PRIMARY KEY (magie_a_id, magie_b_id),
  CHECK (magie_a_id <> magie_b_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX resistance_duo_b ON resistance_duo (magie_b_id, magie_a_id);   -- « tous les couples qui contiennent la magie X » (X en seconde position)

-- Les magies de chaque palier pour un couple. « AUCUNE » n'a pas de ligne. « D.Résistance » / « D.Faiblesse » (« D. » n'est pas
-- développé par la source) sont rattachés aux paliers « grande résistance » / « grande vulnérabilité » : le chargeur vérifie cette
-- lecture en recalculant les 73 couples depuis resistance_magie (V = somme des deux lignes) ; les écarts sont dans ecart_source.
CREATE TABLE resistance_combinaison (
  magie_a_id     TEXT    NOT NULL,
  magie_b_id     TEXT    NOT NULL,
  palier_id      TEXT    NOT NULL REFERENCES resistance_palier(id),
  rang           INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 4),    -- position dans la ligne du palier (colonnes T, Y, AD, AI)
  cible_magie_id TEXT    NOT NULL REFERENCES magie(id),
  palier_brut    TEXT    NOT NULL CHECK (palier_brut IN ('D.Résistance', 'Résistance', 'Faiblesse', 'D.Faiblesse')),
  cible_brut     TEXT    NOT NULL,                                 -- « Temps/Espace » : écriture de la source
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (magie_a_id, magie_b_id, palier_id, rang),
  UNIQUE (magie_a_id, magie_b_id, cible_magie_id),
  FOREIGN KEY (magie_a_id, magie_b_id) REFERENCES resistance_duo (magie_a_id, magie_b_id),
  CHECK (palier_id IN ('grande_resistance', 'resistance', 'vulnerabilite', 'grande_vulnerabilite'))
) STRICT, WITHOUT ROWID;

CREATE INDEX resistance_combinaison_cible ON resistance_combinaison (cible_magie_id, palier_id);

CREATE INDEX resistance_combinaison_b     ON resistance_combinaison (magie_b_id, magie_a_id);

CREATE INDEX resistance_combinaison_palier ON resistance_combinaison (palier_id);

-- ▸ ALTÉRATIONS D'ÉTAT (classeur V8, onglet « Altération détats » : 20 blocs de 5 lignes)
CREATE TABLE etat (
  id              TEXT    NOT NULL PRIMARY KEY CHECK (id GLOB 'guide/liste-des-alterations-d-etat#etat:*'),
  nom             TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                   -- « Pétrifié », « Surcharge Magique » (retours à la ligne de la cellule remplacés par une espace)
  ordre           INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),    -- ordre de l'onglet
  type            TEXT    NOT NULL CHECK (type IN ('physique', 'mental')),
  type_brut       TEXT    NOT NULL,                          -- « Physique », « Mental »
  magie_liee_brut TEXT,                                      -- cellule « Magie Liée » sur une ligne : « Temps/ Espace », « Arcane/ Corruption » ; NULL pour « / »
  origine         TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

CREATE INDEX etat_type ON etat (type);

-- Magie(s) liée(s) d'une altération : 13 altérations sur 20 en ont (Surcharge Magique : deux, Arcane et Corruption).
-- Les 7 autres ont « / » dans la source et aucune ligne ici.
CREATE TABLE etat_magie (
  etat_id    TEXT    NOT NULL REFERENCES etat(id),
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 2),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (etat_id, magie_id),
  UNIQUE (etat_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX etat_magie_magie ON etat_magie (magie_id);

-- Effet d'une altération par stade (colonnes « Stade 1 », « Stade 2 », « Stade 3 »). Pour 6 altérations la source fusionne les trois
-- colonnes en une seule cellule : une ligne, stade NULL (la source ne distingue pas de stade). Texte tel que dans la cellule.
CREATE TABLE etat_stade (
  etat_id    TEXT    NOT NULL REFERENCES etat(id),
  rang       INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
  stade      INTEGER CHECK (stade BETWEEN 1 AND 3),          -- NULL = cellule fusionnée sur les trois stades
  effet      TEXT    NOT NULL,
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (etat_id, rang),
  CHECK (CASE WHEN stade IS NULL THEN rang = 1 ELSE stade = rang END)
) STRICT, WITHOUT ROWID;

-- Effet d'une altération selon la résistance ou la vulnérabilité de la cible (colonnes AQ / AV : une paire « libellé / effet » par
-- ligne du bloc). Les paliers sont ceux de resistance_palier (« Résistances » de la source = 'resistance'). Une paire dont l'effet
-- est vide dans la source n'a pas de ligne.
CREATE TABLE etat_palier (
  etat_id      TEXT    NOT NULL REFERENCES etat(id),
  palier_id    TEXT    NOT NULL REFERENCES resistance_palier(id),
  libelle_brut TEXT    NOT NULL,                             -- « Résistances », « Grande vulnérabilité »
  effet        TEXT    NOT NULL,
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (etat_id, palier_id),
  CHECK (palier_id <> 'immunite')
) STRICT, WITHOUT ROWID;

CREATE INDEX etat_palier_palier ON etat_palier (palier_id);

-- ▸ MÉTÉO (classeur V8, onglet « Météo » : une entrée de 7 lignes par météo)
CREATE TABLE meteo (
  id          TEXT    NOT NULL PRIMARY KEY CHECK (id GLOB 'guide/meteo#meteo:*'),
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                       -- « Pluie diluvienne »
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  description TEXT    NOT NULL,
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Effets d'une météo : une ligne « - … » de la cellule « Effet(s) » = une ligne. Pour la forme « Élément X = +N dégâts, +M Soin » (ou « Magie X = … »)
-- les colonnes typées sont renseignées (élément = magie, bonus signés) ; la forme « (TOUR PAIR) +10 dégâts | (TOUR IMPAIR) -10 dégâts »
-- (Éclipse) remplit les deux colonnes par tour. Toute autre ligne reste du texte (type 'autre'), y compris « Toutes les autres magies = -3 dégâts ».
CREATE TABLE meteo_effet (
  meteo_id           TEXT    NOT NULL REFERENCES meteo(id),
  rang               INTEGER NOT NULL CHECK (rang >= 1),
  type               TEXT    NOT NULL CHECK (type IN ('element', 'autre')),
  texte              TEXT    NOT NULL,                       -- la ligne, sans le tiret : « Élément Lumière = +6 dégâts, +6 Soin »
  element_magie_id   TEXT    REFERENCES magie(id),           -- type 'element' : la magie visée
  element_brut       TEXT,                                   -- « Espace/Temps » tel qu'écrit après « Élément » ou « Magie »
  degats             INTEGER,                                -- « +6 dégâts » -> 6 ; « -5 dégâts » -> -5 ; NULL si la ligne n'en dit pas
  soin               INTEGER,                                -- « +6 Soin » -> 6
  degats_tour_pair   INTEGER,                                -- « (TOUR PAIR) +10 dégâts » -> 10 (Éclipse)
  degats_tour_impair INTEGER,                                -- « (TOUR IMPAIR) -10 dégâts » -> -10
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (meteo_id, rang),
  CHECK ((type = 'element') = (element_magie_id IS NOT NULL)),
  CHECK ((type = 'element') = (element_brut IS NOT NULL)),
  CHECK (type = 'element' OR (degats IS NULL AND soin IS NULL AND degats_tour_pair IS NULL AND degats_tour_impair IS NULL)),
  CHECK (type = 'autre' OR degats IS NOT NULL OR soin IS NOT NULL OR degats_tour_pair IS NOT NULL),
  CHECK ((degats_tour_pair IS NULL) = (degats_tour_impair IS NULL)),
  CHECK (degats_tour_pair IS NULL OR (degats IS NULL AND soin IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX meteo_effet_element ON meteo_effet (element_magie_id, degats) WHERE element_magie_id IS NOT NULL;

-- Textes d'explication du classeur « Mode hyper et co » (Mode Hyper!AA1, AA14, AA30 ; Mode Super!AI1) : cellule entière, telle quelle.
-- Les chiffres qu'ils contiennent (niveau 2, 10 %, durée = niveau ÷ 2…) sont aussi dans regle_constante.
CREATE TABLE mode_texte (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (instr(id, '#texte:') > 0),   -- '<page>#texte:<normalize(intitule)>' (db:check recalcule la fin)
  mode       TEXT    NOT NULL CHECK (mode IN ('hyper', 'super')),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  intitule   TEXT    NOT NULL,                               -- première ligne de la cellule : « Au delà des limites »
  texte      TEXT    NOT NULL,                               -- cellule entière
  page_id    TEXT    NOT NULL REFERENCES page(id),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (mode, rang),
  CHECK (substr(id, 1, length(page_id) + 7) = page_id || '#texte:')
) STRICT;

CREATE INDEX mode_texte_page ON mode_texte (page_id);

-- « Au delà des limites » (Mode Hyper!AA14) : conséquences d'un mode hyper maintenu N tours de plus, une fois relâché.
CREATE TABLE mode_hyper_depassement (
  tours      INTEGER NOT NULL PRIMARY KEY CHECK (tours BETWEEN 1 AND 5),   -- « 3 tours supplémentaires » -> 3
  tours_brut TEXT    NOT NULL,                               -- « 3 tours supplémentaires »
  effet      TEXT    NOT NULL,                               -- « 3 croix caractéristiques aléatoires pendant 24h. »
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Mode super : objets légendaires ou enchantés (Mode Super!A3:T59). Cellule « Effets mode super » = « Effet passif = … / Effet actif = … » ;
-- la partie après le « = » est NULL quand elle est vide dans la source (10 objets sur 15 n'ont encore aucun effet écrit).
CREATE TABLE mode_super_objet (
  id           TEXT    NOT NULL PRIMARY KEY CHECK (id GLOB 'guide/liste-des-effets-mode-super#objet:*'),
  nom          TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                      -- colonne « Objet » : « Excalibur/ Joyeuse » ; le premier est la cellule numérique 400.0, conservée telle quelle
  ordre        INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  effet_passif TEXT,
  effet_actif  TEXT,
  effets_brut  TEXT    NOT NULL,                             -- cellule « Effets mode super » entière
  description  TEXT,                                         -- colonne « Description/apparence »
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'annexes'),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Effets du mode hyper. Plusieurs lectures du même sujet coexistent et ne disent pas toujours la même chose ; elles sont TOUTES conservées, une
-- ligne par (version, cible), et la requête choisit sa version (aucune source ne dit laquelle prévaut, voir ecart_source) :
--   version 'classeur_modes' : classeur « Mode hyper et co », onglet Mode Hyper (général, 15 magies mono / bi, 27 races) ;
--   version 'magie_masque'   : classeur V8, onglet masqué « Mode Hyper (Magie) » (14 magies seules + 73 couples + « Avantages de base ») ;
--   version 'onglet_magie'   : classeur V8, bloc « Capacité Mode Hyper » de chaque onglet de magie (15 magies : mono, bi ou forme complète) ;
--   version 'fiche'          : fiche auto V15.2.2 : Magie!V2:W16 (15 magies mono / bi), Personnage!BI32 (« Effets de base »), Race!W (races) ;
--   version 'onglet_race'    : classeur « Les races », bloc « Capacité Mode Hyper » de l'onglet de chaque race (décision du propriétaire : PRIME
--                              sur 'fiche' pour les races ; migration 0007, `nom` = nom de la capacité, `libelle` = nom de l'onglet).
--   portee 'general' : effet commun (libelle = « Général » ou le titre de l'encadré) ; 'magie' : une magie ; 'duo' : un couple de magies
--   (version 'magie_masque') ; 'race' : une race (variante NULL : la source n'en distingue pas).
--   variante 'mono' / 'bi' : colonnes « Mono magie » / « Bi magie » ; 'mono_et_bi' : cellule fusionnée sur les deux ; 'forme_complete' : Potentiel
--   Illimité (« Forme Complète ») ; le couple d'une version 'magie_masque' est une variante 'bi'. `variante_brut` : libellé de colonne écrit.
CREATE TABLE mode_hyper_effet (
  id            TEXT    NOT NULL PRIMARY KEY,                -- general : 'classeur_modes:general:2:mono' ; magie : 'classeur_modes:magies/magie-du-sang:mono' ;
                                                             -- duo : 'magie_masque:duo:magies/magie-du-sang+magies/magie-du-feu' ; race : 'fiche:races/humain'
  version       TEXT    NOT NULL CHECK (version IN ('classeur_modes', 'magie_masque', 'onglet_magie', 'fiche', 'onglet_race')),
  portee        TEXT    NOT NULL CHECK (portee IN ('general', 'magie', 'duo', 'race')),
  rang          INTEGER NOT NULL CHECK (rang >= 1),          -- rang de la cible dans la source au sein de (version, portee) : mono et bi d'une même magie ont le même rang
  libelle       TEXT    NOT NULL,                            -- cible telle qu'écrite : « Général », « Temps/Espace », « Sang + Vide », « Namazus »
  magie_id      TEXT    REFERENCES magie(id),
  magie2_id     TEXT    REFERENCES magie(id),                -- portee 'duo' : seconde magie du couple (ordre de la source)
  race_id       TEXT    REFERENCES race(id),
  variante      TEXT    CHECK (variante IN ('mono', 'bi', 'mono_et_bi', 'forme_complete')),
  variante_brut TEXT,                                        -- libellé de colonne : « Mono-Magie », « Bi-magie », « Forme Complète » ; NULL si la source n'en écrit pas
  effet         TEXT    NOT NULL,                            -- cellule telle quelle
  commentaire   TEXT,                                        -- commentaire de cellule du .xlsx (absent du dump JSON)
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('annexes', 'magies', 'races')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  -- Colonne ajoutée par la migration 0007 (une colonne ajoutée va en dernier)
  nom           TEXT,                                        -- nom de la capacité quand la source en écrit un (version 'onglet_race' : « Sang du condamné ») ; NULL sinon
  CHECK ((portee = 'general' AND magie_id IS NULL AND magie2_id IS NULL AND race_id IS NULL)
      OR (portee = 'magie'   AND magie_id IS NOT NULL AND magie2_id IS NULL AND race_id IS NULL)
      OR (portee = 'duo'     AND magie_id IS NOT NULL AND magie2_id IS NOT NULL AND race_id IS NULL)
      OR (portee = 'race'    AND race_id IS NOT NULL AND magie_id IS NULL AND magie2_id IS NULL)),
  CHECK ((portee = 'race') = (variante IS NULL)),
  CHECK (portee <> 'duo' OR (COALESCE(variante, '') = 'bi' AND version = 'magie_masque')),
  CHECK (portee <> 'race' OR version IN ('classeur_modes', 'fiche', 'onglet_race')),
  CHECK (version <> 'onglet_magie' OR portee = 'magie')
) STRICT;
CREATE UNIQUE INDEX mode_hyper_effet_rang ON mode_hyper_effet (version, portee, rang, variante) WHERE variante IS NOT NULL;
CREATE UNIQUE INDEX mode_hyper_effet_rang_race ON mode_hyper_effet (version, portee, rang) WHERE variante IS NULL;
CREATE INDEX mode_hyper_effet_magie ON mode_hyper_effet (magie_id, version, variante) WHERE magie_id IS NOT NULL;
CREATE INDEX mode_hyper_effet_magie2 ON mode_hyper_effet (magie2_id) WHERE magie2_id IS NOT NULL;
CREATE INDEX mode_hyper_effet_race  ON mode_hyper_effet (race_id) WHERE race_id IS NOT NULL;
CREATE INDEX mode_hyper_effet_version ON mode_hyper_effet (version, portee, rang);

-- ====================================================================================================================
-- 5. DIEUX
-- Une seule table `dieu` (28 noms : la liste « Dieu choisi » de la fiche + la colonne « Dieux » de la feuille Magie). `magie_dieu` (section 3) relie un dieu à sa magie.
-- ====================================================================================================================

-- Noms de la liste déroulante « Dieu choisi » (Personnage!S5, 26 valeurs) et de la colonne « Dieux » de la feuille Magie (X2:X29).
-- Les sources ne disent pas quelles entrées sont des divinités (« Pas de Dieu choisi », « Agnostique »… figurent dans les deux listes) :
-- aucune classification n'est ajoutée. Le dieu inné d'une magie est dans magie_dieu (domaine magies).
CREATE TABLE dieu (
  id               TEXT    NOT NULL PRIMARY KEY,
  nom              TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),
  ordre_choix      INTEGER UNIQUE CHECK (ordre_choix >= 1),   -- rang dans la liste S5 ; NULL = absent de cette liste (Eirnn, Onir)
  dans_liste_magie INTEGER NOT NULL CHECK (dans_liste_magie IN (0, 1)),   -- 1 = figure dans Magie!X2:X29 (« Notix & Capse » compte pour deux)
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'fiche'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- ====================================================================================================================
-- 6. CLASSES, SPÉCIALITÉS, CAPACITÉS (famille « classes »)
-- id d'une classe = id de sa page ; id d'une capacité = id de SA page ('capacites/<classe>-<nom>') : une page par capacité, une ligne par page.
-- ====================================================================================================================

-- CATÉGORIES DU SOMMAIRE
-- Les six en-têtes de colonne du Sommaire (A1, C1, E1, G1, I1, K1) : « Classe Physique Corps à Corps », « Classe Physique
-- Distance », « Classe Magique », « Classe Hybride », « Classe Hybride Animal », « Classe spéciale ».
CREATE TABLE categorie_classe (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- normalize(libelle)
  libelle    TEXT    NOT NULL UNIQUE,                               -- en-tête du Sommaire, tel quel
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),            -- rang de la colonne dans le Sommaire (1 = la plus à gauche)
  note       TEXT,                                                  -- texte posé sous la liste des classes de la catégorie (Sommaire!E10 pour « Classe Magique »)
  am_base    INTEGER CHECK (am_base >= 0),                          -- « Octroie 4 AM de base par classe magique » -> 4 ; NULL = la note n'en dit rien.
                                                                    -- Extrait du texte de `note` uniquement ; la fiche auto applique une liste de classes écrite
                                                                    -- en dur (BDD!H40) qui diffère : voir design.md §12, points ouverts.
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK (am_base IS NULL OR note IS NOT NULL)
) STRICT;

-- CLASSE : une ligne par onglet de classe (39)
CREATE TABLE classe (
  id                 TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page (entité typée qui a SA page)
  nom                TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom de l'onglet = nom dans le Sommaire (« Cuirassé », « Orios ») = titre de la page.
                                                 -- Les 13 classes « Hybride Animal » portent le nom de leur race, sans suffixe (migration 0009).
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
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  magie_innee_id     TEXT    REFERENCES magie(id)   -- magie innée qui RÉSERVE et IMPOSE la classe : sans elle on ne prend pas la classe, avec elle la classe est
                                                 -- la classe 1. Archimage : Potentiel Illimité (« CHOSE A SAVOIR » de son onglet, décision R23, migration 0015) ;
                                                 -- NULL pour les autres classes. Contrôlé par v_personnage_controle (classe_reservee, classe_imposee)
) STRICT;

CREATE INDEX classe_categorie ON classe (categorie_id, ordre);   -- « les classes d'une catégorie »

CREATE UNIQUE INDEX classe_magie_innee ON classe (magie_innee_id) WHERE magie_innee_id IS NOT NULL;   -- une magie innée impose au plus une classe

-- SPÉCIALITÉ : deux par classe, choisies au niveau de classe 10
-- Onglet normal : bannières en majuscules de la ligne 17 (A17 = rang 1, X17 = rang 2) ; description = titre + texte dans la zone AM.
-- Archimage (pas de bannières) : les deux cartouches « Lvl 10 » J18 (Élémentaliste) et U18 (Occultiste), que la fiche auto
-- lit comme spécialités (BDD!I2, I3 : Archimage!L18, W18) ; pas de description.
CREATE TABLE specialite (
  id                TEXT    NOT NULL PRIMARY KEY,
  classe_id         TEXT    NOT NULL REFERENCES classe(id),
  rang              INTEGER NOT NULL CHECK (rang >= 1),   -- 1 = bannière de gauche (A17), 2 = bannière de droite (X17)
  nom               TEXT    NOT NULL CHECK (length(nom) > 0),                     -- telle qu'écrite dans la bannière (« ÉPÉISTE », « MAÎTRE D'ARME ») ; Archimage : nom du cartouche
  nom_cle           TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                     -- normalize(nom)
  description_titre TEXT,                                 -- « Description Épéiste »
  description       TEXT,                                 -- NULL : titre sans texte (Tueur, Archer/Grand Archer, Mage Bleu, Anansi, Goleois) ou pas de zone
  origine           TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref        TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (classe_id, rang),
  UNIQUE (classe_id, nom_cle),
  UNIQUE (id, classe_id),                                 -- cible de la clé étrangère composite de capacite
  CHECK (substr(id, 1, length(classe_id) + 12) = classe_id || '#specialite:')
) STRICT;

-- CAPACITÉ (aptitude) : une ligne par page `capacites/<slug>` (660). Une aptitude du classeur = cellule « Lvl N » + nom + bloc d'effet + cellule de type.
-- Les choix « l'un OU l'autre » ne sont pas un attribut : ils se lisent dans la mise en page (view v_capacite_exclusive) :
--   nature = 'classe'     : colonne P de l'onglet (Lvl 1, Lvl 5, Lvl 20) ; specialite_id NULL ; reçue sans choix.
--   nature = 'specialite' : le cartouche « Lvl 10 » qui porte le nom de la spécialité ; les DEUX cartouches sont sur la même ligne et s'excluent.
--   nature = 'choix'      : les colonnes d'aptitudes (Lvl 10, 15, 20). Onglet normal : deux colonnes sous chaque bannière (specialite_id renseignée),
--                           côte à côte sur la même ligne : l'une OU l'autre. Archimage : groupes de 2 ou 3 colonnes sans spécialité (specialite_id NULL),
--                           y compris les deux cartouches « Lvl 10 » (Élémentaliste, Occultiste : règle du site, capacites.mjs ; la fiche V15.2.2 les lit
--                           comme des spécialités, d'où les deux lignes `specialite` de l'Archimage, sans capacité rattachée).
--   ligne = ligne de la cellule « Lvl N » dans l'onglet (ordre de haut en bas) ; rang = position de gauche à droite sur la ligne, parmi les capacités
--   du même groupe (même specialite_id ; NULL = sans spécialité). « Niveau de classe >= N » est la lecture de la fiche, le classeur ne l'écrit pas.
-- Cinq capacités sont écrites mot pour mot dans deux classes (Contre-attaque, Rage, Gigantisme, Glissade, Sang contrôlé) : deux lignes, deux pages ;
-- la vue v_capacite_partagee les retrouve.
CREATE TABLE capacite (
  id             TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- 'capacites/anansi-anti-corps'
  classe_id      TEXT    NOT NULL REFERENCES classe(id),
  specialite_id  TEXT,
  niveau         INTEGER NOT NULL CHECK (niveau >= 1),               -- N de « Lvl N »
  nature         TEXT    NOT NULL CHECK (nature IN ('classe', 'specialite', 'choix')),
  ligne          INTEGER NOT NULL CHECK (ligne >= 1),
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),                                   -- tel qu'écrit : « Contact », « Puni-moi ... », « ... plus fort ! »
  nom_cle        TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                                   -- normalize(nom) ; NON unique (noms portés par des effets différents) ; '' si aucun caractère ASCII
  type           TEXT    CHECK (type IN ('passif', 'actif', 'action', 'reaction', 'variable')),
                                                                     -- premier mot de type_brut, sans accent ni casse. Vocabulaire du guide : Passif, Actif, Action, Réaction (type_don)
  type_brut      TEXT,                                               -- cellule de type telle qu'écrite : « Actif (2 fois/combat) », « Réaction (1/combat) »
  limite_nombre  INTEGER CHECK (limite_nombre >= 0),                 -- N de « (N fois/période) » ou « (N/période) » ; NULL pour toute autre forme
  limite_periode TEXT,                                               -- période de cette limite, minuscules (« combat », « 24h », « jour », « tour »…) ; NULL avec limite_nombre
  effet          TEXT,                                               -- bloc d'effet, texte libre (retours à la ligne et listes « - » conservés)
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0), -- plage de l'aptitude dans l'onglet : « Classe Maverick V7 › Guerrier › P4:U9 »
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  FOREIGN KEY (specialite_id, classe_id) REFERENCES specialite (id, classe_id),   -- la spécialité est bien celle de la classe (inactif si NULL)
  CHECK (nature <> 'classe' OR specialite_id IS NULL),
  CHECK (nature <> 'specialite' OR specialite_id IS NOT NULL),
  CHECK ((limite_nombre IS NULL) = (limite_periode IS NULL)),
  CHECK (limite_nombre IS NULL OR type_brut IS NOT NULL)
) STRICT;
-- Un emplacement physique = une seule capacité (l'expression remplace NULL par '' : UNIQUE ignore les NULL).
CREATE UNIQUE INDEX capacite_emplacement ON capacite (classe_id, ligne, COALESCE(specialite_id, ''), rang);
CREATE INDEX capacite_niveau     ON capacite (classe_id, niveau, ligne, rang);   -- « capacités d'une classe au niveau N »
CREATE INDEX capacite_ligne      ON capacite (classe_id, ligne);                 -- choix exclusifs : même ligne
CREATE INDEX capacite_specialite ON capacite (specialite_id) WHERE specialite_id IS NOT NULL;
CREATE INDEX capacite_nom_cle    ON capacite (nom_cle);
CREATE INDEX capacite_type       ON capacite (type);
CREATE INDEX capacite_limite     ON capacite (limite_periode, limite_nombre) WHERE limite_nombre IS NOT NULL;

-- OBJETS DE DÉPART
-- Glossaire « OBJETS DES INVENTAIRES DE DEPART » (Sommaire!A21, une grande cellule : un objet par paragraphe, « nom : description »).
-- Rangé aussi dans la page ressources/objets-de-depart-des-classes (dont les objets sont les sous-entités).
CREATE TABLE objet_depart (
  id          TEXT    NOT NULL PRIMARY KEY,
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),                          -- « P fiole rouge », « KDR Arme », « Corde (5-10m) »
  nom_cle     TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                   -- normalize(nom)
  description TEXT    NOT NULL,
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang dans la cellule du glossaire
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK (instr(id, '#objet:') > 0)
) STRICT;

-- Inventaire de départ : une ligne par objet de la cellule « Inventaire de départ » (G3), dans l'ordre. Le texte de chaque
-- objet est conservé tel qu'écrit (« P fiole rouge », « corde (5m) », « Bandage (x3) ») : les noms ne sont pas normalisés
-- dans le classeur. « A OU B » (« KDR Arme OU carquois N ») est écrit par la source : une ligne par option (option 1, 2).
-- objet_depart_id n'est renseigné que si le texte de l'option, sans un éventuel suffixe « (xN) », est le nom d'un objet du
-- glossaire (casse, accents et tirets ignorés) ; sinon NULL (« corde (5m) » : le glossaire dit « Corde (5-10m) »).
CREATE TABLE classe_objet_depart (
  classe_id        TEXT    NOT NULL REFERENCES classe(id),
  rang             INTEGER NOT NULL CHECK (rang >= 1),   -- position dans la liste de la cellule (1 à 5)
  option           INTEGER NOT NULL CHECK (option >= 1), -- 1 sauf pour « A OU B » (A = 1, B = 2)
  texte            TEXT    NOT NULL,
  objet_depart_id  TEXT    REFERENCES objet_depart(id),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (classe_id, rang, option)
) STRICT, WITHOUT ROWID;

CREATE INDEX classe_objet_depart_objet ON classe_objet_depart (objet_depart_id) WHERE objet_depart_id IS NOT NULL;

-- MAÎTRISES DE DÉPART : cellules « Maîtrise Arme » (A7:F9) et « Maîtrise Armures » (A11:F13) de l'onglet de la classe.
-- `classe.maitrise_arme` / `classe.maitrise_armure` gardent la cellule TELLE QU'ÉCRITE (liste à tirets) ; chaque ligne de la liste est une ligne de
-- ces deux tables. Règle d'or : une colonne typée n'est remplie que pour une forme SANS AMBIGUÏTÉ (même analyseur à l'import et dans db:check :
-- tools/db/classes_maitrise.py) ; une ligne qui ne ressemble à aucune forme reconnue garde son texte (`brut`) et le reste est NULL.
-- Aucun ordre « Légère < Intermédiaire < Lourde » n'est écrit ici : seules les bornes écrites sont stockées (« Légère à Lourde »).
-- `arme_depart`, `armure_depart` (« Arme en acier selon la maîtrise », « Armure de Peau, Bocle cuir ») restent du texte : ce sont des phrases de règle
-- qui dépendent d'autres cellules, pas des listes (design.md §12).
CREATE TABLE classe_maitrise_armure (
  classe_id  TEXT    NOT NULL REFERENCES classe(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),               -- position dans la liste (1 = première ligne)
  brut       TEXT    NOT NULL CHECK (length(brut) > 0),        -- la ligne sans son tiret de liste : « Légère à Intermédiaire », « Bouclier classe 1 à 5 »
  objet      TEXT    CHECK (objet IN ('armure', 'bouclier')),  -- NULL = forme non reconnue (« Aucun », « Comment ça une armure ? »)
  poids_min  TEXT    CHECK (poids_min IN ('Légère', 'Intermédiaire', 'Lourde')),   -- armure : bornes écrites ; « Légère » seul = min et max
  poids_max  TEXT    CHECK (poids_max IN ('Légère', 'Intermédiaire', 'Lourde')),
  classe_min INTEGER CHECK (classe_min BETWEEN 1 AND 5),       -- bouclier : « Bouclier classe 1 à 3 » ; « Bouclier de classe 1 » = 1 à 1
  classe_max INTEGER CHECK (classe_max BETWEEN 1 AND 5),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),  -- « Classe Maverick V7 › Guerrier › A11:F13 »
  PRIMARY KEY (classe_id, rang),
  -- `IS` et non `=` : objet NULL (forme non reconnue) doit refuser toute valeur typée (NULL = 'armure' vaut NULL et ferait passer le CHECK)
  CHECK ((objet IS 'armure') = (poids_min IS NOT NULL AND poids_max IS NOT NULL)),
  CHECK ((objet IS 'bouclier') = (classe_min IS NOT NULL AND classe_max IS NOT NULL)),
  CHECK ((poids_min IS NULL) = (poids_max IS NULL) AND (classe_min IS NULL) = (classe_max IS NULL)),     -- deux bornes ou aucune
  CHECK (classe_min IS NULL OR classe_min <= classe_max)
) STRICT, WITHOUT ROWID;

CREATE INDEX classe_maitrise_armure_objet ON classe_maitrise_armure (objet, poids_max, classe_max);

CREATE TABLE classe_maitrise_arme (
  classe_id  TEXT    NOT NULL REFERENCES classe(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),               -- position dans la liste (1 = première ligne)
  brut       TEXT    NOT NULL CHECK (length(brut) > 0),        -- la ligne sans son tiret de liste : « 1 maîtrise Épée », « 1 maîtrise au choix (sauf Épée) »
  forme      TEXT    CHECK (forme IN ('nommee', 'au_choix', 'repartie')),
                                                               -- nommee = « N maîtrise <arme> » ; au_choix = « … au choix » ; repartie = « N maîtrise à répartir … » ;
                                                               -- NULL = la ligne ne commence pas par « N maîtrise(s) »
  nombre     INTEGER CHECK (nombre >= 1),                      -- N de « N maîtrise(s) »
  arme       TEXT,                                             -- forme nommee : l'arme telle qu'écrite (« Épée », « Hast », « Arme Jet ») ; NULL sinon
  arme_cle   TEXT    CHECK (arme_cle IS NULL OR (arme_cle NOT GLOB '*[^a-z0-9-]*' AND arme_cle NOT GLOB '*--*' AND arme_cle NOT GLOB '-*' AND arme_cle NOT GLOB '*-')),
                                                               -- normalize(arme) : se joint à arme_type.id quand l'écriture est celle du référentiel (« epee »,
                                                               -- « arc ») ; « Hast » ne se joint pas à « arme-dhast » : rien n'est rapproché à la place de la source
  categorie  TEXT    CHECK (categorie IN ('contact', 'distance')),   -- forme au_choix : « arme contact au choix », « arme à distance au choix »
  sauf       TEXT,                                             -- forme au_choix : « (sauf épée) » -> « épée » (tel qu'écrit)
  sauf_cle   TEXT    CHECK (sauf_cle IS NULL OR (sauf_cle NOT GLOB '*[^a-z0-9-]*' AND sauf_cle NOT GLOB '*--*' AND sauf_cle NOT GLOB '-*' AND sauf_cle NOT GLOB '*-')),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),  -- « Classe Maverick V7 › Guerrier › A7:F9 »
  PRIMARY KEY (classe_id, rang),
  -- `IS` et non `=` : forme NULL (ligne qui ne commence pas par « N maîtrise(s) ») doit refuser toute valeur typée
  CHECK ((forme IS NULL) = (nombre IS NULL)),
  CHECK ((forme IS 'nommee') = (arme IS NOT NULL)),
  CHECK ((arme IS NULL) = (arme_cle IS NULL)),
  CHECK (categorie IS NULL OR forme IS 'au_choix'),
  CHECK (sauf IS NULL OR forme IS 'au_choix'),
  CHECK ((sauf IS NULL) = (sauf_cle IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX classe_maitrise_arme_arme ON classe_maitrise_arme (arme_cle) WHERE arme_cle IS NOT NULL;

-- TABLEAU LIBRE D'UN ONGLET
-- Tableau sans titre sous les aptitudes de Mage Bleu (A58:AR127, 14 lignes de 5 rangées : libellé en A, texte en G). Chaque libellé est un
-- nom de magie en majuscules (SANG, ESPACE/TEMPS, NÉCROMANCIE…) et chaque texte une ou plusieurs lignes « (Passif) Nom. Effet. ».
-- Le classeur ne donne pas de titre à ce tableau : rien n'est déduit de son rôle. `magie_id` est le rapprochement par nom (les 14 se résolvent).
CREATE TABLE classe_annexe (
  classe_id    TEXT    NOT NULL REFERENCES classe(id),
  rang         INTEGER NOT NULL CHECK (rang >= 1),       -- ligne du tableau, de haut en bas
  libelle      TEXT    NOT NULL,
  libelle_cle  TEXT    NOT NULL CHECK (libelle_cle NOT GLOB '*[^a-z0-9-]*' AND libelle_cle NOT GLOB '*--*' AND libelle_cle NOT GLOB '-*' AND libelle_cle NOT GLOB '*-'),
  magie_id     TEXT    REFERENCES magie(id),             -- magie dont le nom est le libellé (normalize) ; NULL si aucune
  texte        TEXT    NOT NULL,
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'classes'),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (classe_id, rang),
  UNIQUE (classe_id, libelle_cle)
) STRICT, WITHOUT ROWID;

CREATE INDEX classe_annexe_libelle ON classe_annexe (libelle_cle);

-- ====================================================================================================================
-- 7. RACES, ETHNIES, ACCESSIBILITÉS (famille « races »)
-- id d'une race = id de sa page ; id d'une ethnie = '<id de la race>#ethnie:<slug>'. Les valeurs de départ viennent de la fiche V15.2.2 ;
-- l'onglet de la race du classeur « Les races » PRIME (décision du propriétaire) : l'importeur races le lira au lot 4 (écarts dans ecart_source).
-- ====================================================================================================================

-- RACE : une ligne par race (27 dans les cinq onglets du classeur ; le guide dit « 23 disponibles », voir design.md §12)
CREATE TABLE race (
  id              TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page 'races/<slug>'
  nom             TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- « Race » col. A, identique dans les 5 onglets, l'index et le titre de la page : 'Elfe noir', « Drassah'thac »
  ordre           INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang dans l'onglet « Race » (1 = Humain) : c'est l'ordre d'affichage de la fiche
  presentation    TEXT,                       -- phrase de présentation du classeur « Les races » (première feuille, col. B) ; NULL si absente
  -- Valeurs de départ (onglet « Race », col. B à F, H, I). La source les écrit en flottant (10.0) : entiers.
  sante           INTEGER,                    -- « Santé » : PV de départ apportés par la race
  chakra_depart   INTEGER,                    -- « Chakra départ »
  barriere_bonus  INTEGER,                    -- « Barrière bonus » (s'ajoute à la moitié du chakra : règle de la fiche, hors de cette table)
  vitesse_terre   INTEGER,                    -- « Vitesse sur terre » (unité non écrite dans la cellule)
  vitesse_nage    INTEGER,                    -- « Vitesse de Nage » ; 0 pour Olwman et Rokh (leur « Divers » dit « ne peut pas nager »)
  ap              INTEGER,                    -- « AP » : armure physique naturelle de la race (0 partout sauf Namazu)
  am              INTEGER,                    -- « AM » : armure magique naturelle de la race (0 partout)
  divers          TEXT,                       -- « Divers » (col. G) : texte libre d'information, jamais lu par une formule de la fiche. 13 races.
                                              -- Non typé : « Peut voler » et « Ne peut pas voler » y cohabitent, aucune recherche par LIKE n'est fiable.
  -- Don de base (col. V « Don base », une cellule « Nom/Type/Effets » que la fiche découpe sur « / »)
  don_base_brut   TEXT,                       -- cellule entière, telle qu'écrite
  don_base_nom    TEXT,                       -- 1re partie : 'Méditation' ou 'Repos'
  don_base_type   TEXT,                       -- 2e partie : 'Action'
  don_base_effets TEXT,                       -- 3e partie : 'Permet de récupérer 2d6 chakra (jet de calme en stress).' (texte, non analysé)
  origine         TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0), -- « Fiche auto V15.2.2 › Race › A3:W3 ; Les races › première feuille › A2:B2 »
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((don_base_nom IS NULL) = (don_base_type IS NULL) AND (don_base_nom IS NULL) = (don_base_effets IS NULL)),
  CHECK (don_base_nom IS NULL OR don_base_brut IS NOT NULL)
) STRICT;

CREATE INDEX race_sante          ON race (sante);

CREATE INDEX race_chakra_depart  ON race (chakra_depart);

CREATE INDEX race_barriere_bonus ON race (barriere_bonus);

CREATE INDEX race_vitesse_terre  ON race (vitesse_terre);

CREATE INDEX race_vitesse_nage   ON race (vitesse_nage);            -- « races dont la vitesse de nage est >= N »

CREATE INDEX race_ap             ON race (ap);

CREATE INDEX race_am             ON race (am);

CREATE INDEX race_don_base_nom   ON race (don_base_nom);

-- RACE_RESTRICTION_CARAC : restrictions de caractéristique d'une race (onglet « Race », 6 paires de colonnes
-- « < ou > » / « Restrictions <caractéristique> »). Une ligne par restriction RENSEIGNÉE : 17 lignes pour 13 races
-- (les 14 autres races n'ont rien : pas de ligne, donc aucune restriction). Remplace 12 colonnes presque toujours vides.
CREATE TABLE race_restriction_carac (
  race_id            TEXT    NOT NULL REFERENCES race(id),
  caracteristique_id TEXT    NOT NULL REFERENCES caracteristique(id),
  operateur          TEXT    NOT NULL CHECK (operateur IN ('<', '>', '=')),   -- cellule « < ou > » : les trois textes de la source
  valeur             INTEGER NOT NULL,         -- cellule « Restrictions <caractéristique> » (4.0 -> 4)
  origine            TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),         -- « Fiche auto V15.2.2 › Race › J3:K3 »
  PRIMARY KEY (race_id, caracteristique_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_restriction_carac_carac ON race_restriction_carac (caracteristique_id, operateur, valeur);

-- ETHNIE : une ligne par ligne de l'onglet « Bonus Race » (96) : sous-race, origine ou variété d'une race
-- (« Elfe Noir Charbon », « Drakos Rouge », « Mort-Vivant Eau », « Orios de Terre »…). La clé de la source est le nom (col. B).
CREATE TABLE ethnie (
  id          TEXT    NOT NULL PRIMARY KEY,   -- '<race.id>#ethnie:<slug>'
  race_id     TEXT    NOT NULL REFERENCES race(id),   -- race de rattachement, déduite de la col. A (« Race ») après rapprochement des noms
  slug        TEXT    NOT NULL CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*'
                                      AND slug NOT GLOB '*--*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'),   -- normalize(nom)
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),   -- col. B (sans en-tête dans la source) : valeur que le joueur choisit dans la fiche
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),        -- rang de la ligne dans l'onglet (ligne 2 = 1) ; ordre d'affichage
  libelle     TEXT,                   -- col. C « Nom », telle qu'écrite ('Adaptation humaine', 'Sang corrompu', 'Terre ' avec son espace final) ;
                                      -- NULL pour Elfe Doré, Majin, Hujin, Lamia (cellule vide). Pour 14 races c'est le nom de la magie innée liée.
  magie_id    TEXT    REFERENCES magie(id),   -- magie dont le nom est `libelle` (comparaison sans casse, sans accent, sans espace parasite) ;
                                              -- NULL sinon. La fiche s'en sert pour imposer l'ethnie par la magie innée choisie (BDD!X2).
  descriptif  TEXT,                   -- col. D « Descriptif », texte multiligne tel qu'écrit (puces « - » comprises) ; seule description de l'effet
  race_brut   TEXT    NOT NULL,       -- col. A « Race » telle qu'écrite : 'Felfle' (coquille), 'Satyre ' (espace final), 'Elfe Forestier' (casse).
                                      -- Conservée pour que les anomalies de la source restent visibles (voir design.md §12, points ouverts).
  -- Bonus chiffrés (col. I à N) : dans le classeur ce sont des FORMULES qui extraient du descriptif le premier « N santé », « N chakra »,
  -- « N barrière », « N AP », « N AM », « N vitesse ». Valeurs en cache reprises telles quelles (texte '3' -> 3). NULL = pas de mot clé
  -- (cellule vide), 0 = « 0 AM » écrit dans le descriptif. Le texte du descriptif contient d'autres bonus que la formule ne lit pas.
  bonus_pv       INTEGER,
  bonus_chakra   INTEGER,
  bonus_barriere INTEGER,
  bonus_ap       INTEGER,
  bonus_am       INTEGER,
  bonus_vitesse  INTEGER,
  origine     TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0), -- « Fiche auto V15.2.2 › Bonus Race › A6:N6 »
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (race_id, slug),
  CHECK (id = race_id || '#ethnie:' || slug)
) STRICT;

CREATE INDEX ethnie_race_ordre     ON ethnie (race_id, ordre);       -- « ethnies d'une race » dans l'ordre de la fiche

CREATE INDEX ethnie_magie          ON ethnie (magie_id) WHERE magie_id IS NOT NULL;

CREATE INDEX ethnie_bonus_pv       ON ethnie (bonus_pv)       WHERE bonus_pv       IS NOT NULL;

CREATE INDEX ethnie_bonus_chakra   ON ethnie (bonus_chakra)   WHERE bonus_chakra   IS NOT NULL;

CREATE INDEX ethnie_bonus_barriere ON ethnie (bonus_barriere) WHERE bonus_barriere IS NOT NULL;

CREATE INDEX ethnie_bonus_ap       ON ethnie (bonus_ap)       WHERE bonus_ap       IS NOT NULL;

CREATE INDEX ethnie_bonus_am       ON ethnie (bonus_am)       WHERE bonus_am       IS NOT NULL;

CREATE INDEX ethnie_bonus_vitesse  ON ethnie (bonus_vitesse)  WHERE bonus_vitesse  IS NOT NULL;

-- Résistances d'une ethnie (col. E/F = résistance 1, G/H = résistance 2 : un nom et une valeur). Le nom est soit une magie
-- (« Sang », « Espace/Temps »), soit une altération d'état (« Brûlure », « Surcharge magique », « Pétrification ») : `cible_type`
-- le dit, et la clé étrangère correspondante est renseignée. `valeur` est le nombre de crans écrit dans la cellule (+1 = un cran
-- de résistance, -1 = un cran de vulnérabilité : les Mort-Vivant ont +1 à une magie et -1 à la magie opposée).
-- 78 lignes : 65 ethnies ont au moins une résistance, dont 13 en ont deux (12 Mort-Vivant et Drassah'thac Nord). Drakos Orange (« résistance à l'altération
-- choisie parmi toutes ») et Anansi d'Arcane (« sur une magie aléatoire ») n'ont rien de codé : pas de ligne, le choix reste dans le descriptif.
CREATE TABLE ethnie_resistance (
  ethnie_id       TEXT    NOT NULL REFERENCES ethnie(id),
  rang            INTEGER NOT NULL CHECK (rang IN (1, 2)),   -- 1 = colonnes E/F, 2 = colonnes G/H
  cible_type      TEXT    NOT NULL CHECK (cible_type IN ('magie', 'etat')),
  cible_magie_id  TEXT    REFERENCES magie(id),
  cible_etat_id   TEXT    REFERENCES etat(id),   -- rapprochement explicite fait par l'importeur : « Pétrification » = l'état « Pétrifié »
  cible_brut      TEXT    NOT NULL,              -- nom tel qu'écrit dans la cellule
  valeur          INTEGER NOT NULL,              -- 1.0 -> 1, -1.0 -> -1
  origine         TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),              -- « Fiche auto V15.2.2 › Bonus Race › E27:F27 »
  PRIMARY KEY (ethnie_id, rang),
  CHECK ((cible_type = 'magie' AND cible_magie_id IS NOT NULL AND cible_etat_id IS NULL)
      OR (cible_type = 'etat'  AND cible_etat_id  IS NOT NULL AND cible_magie_id IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX ethnie_resistance_magie  ON ethnie_resistance (cible_magie_id, valeur) WHERE cible_magie_id IS NOT NULL;

CREATE INDEX ethnie_resistance_etat   ON ethnie_resistance (cible_etat_id, valeur)  WHERE cible_etat_id  IS NOT NULL;

-- RACE_CLASSE : matrice « Accessibilité de Classe » : 27 races x 39 classes = 1 053 lignes (712 à 1, 341 à 0).
-- 26 classes générales (colonnes B à AA) + 13 classes raciales (AB à AN). La légende 0/1 n'est pas écrite dans le classeur :
-- 1 = accessible est la lecture de la source (le « 1 » d'Orios sur la classe Orios et le « Classe possible : Orios » de Race!G14 la confirment).
-- AUCUNE formule du classeur ne lit cet onglet (donnée d'information) ; voir design.md §12 pour ses contradictions avec la fiche.
CREATE TABLE race_classe (
  race_id     TEXT    NOT NULL REFERENCES race(id),
  classe_id   TEXT    NOT NULL REFERENCES classe(id),   -- classe de la colonne, rapprochée par son nom d'en-tête (normalize(« Mage Bleu ») = 'mage-bleu')
  ordre       INTEGER NOT NULL CHECK (ordre >= 1),      -- rang de la colonne dans la matrice (B = 1 ... AN = 39) : ordre des classes de la fiche
  accessible  INTEGER NOT NULL CHECK (accessible IN (0, 1)),
  valeur_brut TEXT    NOT NULL,                         -- valeur de la cellule telle qu'écrite : '1' ou '0' (le dump la porte en 1.0 / 0.0)
  origine     TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),                         -- « Fiche auto V15.2.2 › Accessibilité de Classe › AB2 »
  PRIMARY KEY (race_id, classe_id),
  UNIQUE (race_id, ordre),
  CHECK (valeur_brut IN ('0', '1') AND accessible = CAST(valeur_brut AS INTEGER))
) STRICT, WITHOUT ROWID;

CREATE INDEX race_classe_classe ON race_classe (classe_id, accessible);   -- « races qui peuvent prendre la classe X »

-- RACE_MAGIE : matrice « Accessibilité Magie » : 27 races x 15 magies = 405 lignes (245 à 1, 160 à 0). Une case corrigée par le propriétaire :
-- Lamia × Corruption, à 0 dans la fiche (E24), vaut 1 (décision R22, migration 0013 ; source_ref le dit).
-- Selon les formules de la fiche, elle ne restreint que la magie INNÉE (BDD!D2 -> liste de Personnage!S2) ; la liste des magies
-- acquises ne la lit pas. Elle remplace le champ de frontmatter `magies_innees` des pages de race.
CREATE TABLE race_magie (
  race_id     TEXT    NOT NULL REFERENCES race(id),
  magie_id    TEXT    NOT NULL REFERENCES magie(id),   -- magie de la colonne, rapprochée par son nom d'en-tête (« Espace/Temps », « Potentiel Illimité »)
  ordre       INTEGER NOT NULL CHECK (ordre >= 1),     -- rang de la colonne dans la matrice (B = 1 ... P = 15) : la fiche liste les magies dans cet ordre
  accessible  INTEGER NOT NULL CHECK (accessible IN (0, 1)),
  valeur_brut TEXT    NOT NULL,                        -- '1' ou '0' (le dump : 1.0 / 0.0)
  origine     TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),                        -- « Fiche auto V15.2.2 › Accessibilité Magie › C2 »
  PRIMARY KEY (race_id, magie_id),
  UNIQUE (race_id, ordre),
  CHECK (valeur_brut IN ('0', '1') AND accessible = CAST(valeur_brut AS INTEGER))
) STRICT, WITHOUT ROWID;

CREATE INDEX race_magie_magie ON race_magie (magie_id, accessible);       -- « races qui peuvent avoir la magie M comme magie innée »

-- ▸ CONTENU DE L'ONGLET DE LA RACE : classeur « Les races », un onglet par race (migration 0007). Décision R13 du propriétaire : l'onglet est la SOURCE ; la fiche
-- V15.2.2 (tables race, ethnie, race_restriction_carac…) en est un dérivé fait à la main, pas toujours à jour, dont les écarts ne sont plus affichés. Les pages
-- de race du site sont rendues depuis ces tables (lib/races-db.mjs). Textes tels qu'écrits : paragraphes séparés par une ligne vide, retours à la ligne et
-- puces « - » conservés ; un nombre n'est typé que s'il est écrit en chiffres. Lignes tirées des pages races/<slug> par tools/db/races_onglet.py (preuve :
-- chaque section se réécrit à l'identique avec le code de tools/sheets/races.py, l'importeur qui a lu les onglets).
-- RACE_ONGLET : une ligne par race.
CREATE TABLE race_onglet (
  race_id              TEXT    NOT NULL PRIMARY KEY REFERENCES race(id),
  onglet               TEXT    NOT NULL UNIQUE CHECK (length(onglet) > 0),            -- nom de l'onglet : « Elfe Noir », « Namazus »
  description_generale TEXT    NOT NULL CHECK (length(description_generale) > 0),     -- description générale (A4)
  histoire             TEXT    NOT NULL CHECK (length(histoire) > 0),                 -- « HISTOIRE » (AK3)
  description          TEXT    CHECK (description IS NULL OR length(description) > 0),   -- « DESCRIPTION » (AK30) : physique et culture, un bloc pour toute la race
  -- « DONNÉES » : valeurs de départ de l'onglet (elles priment sur race.sante, race.chakra_depart… de la fiche)
  sante_depart         INTEGER NOT NULL,                       -- « Santé de départ »
  chakra_depart        INTEGER NOT NULL,                       -- « Chakra de départ »
  barriere_bonus       INTEGER NOT NULL,                       -- « Barrière bonus »
  vitesse_sol          INTEGER NOT NULL,                       -- « Vitesse Sol/Nage » : première valeur
  vitesse_nage         INTEGER NOT NULL,                       -- « Vitesse Sol/Nage » : seconde valeur
  avantages            TEXT    NOT NULL CHECK (length(avantages) > 0),       -- « Avantage(s) »
  inconvenients        TEXT    NOT NULL CHECK (length(inconvenients) > 0),   -- « Inconvénient(s) »
  don_base             TEXT    NOT NULL CHECK (length(don_base) > 0),        -- « Don B (Base) »
  -- En-têtes du tableau des ethnies du bloc « Don R (Race) » (NULL : pas de tableau d'ethnies, la race a un don unique ou un tableau en panneaux)
  dons_rubrique        TEXT    CHECK (dons_rubrique IN ('Type', 'Condition d''origine', 'Magie innée')),   -- 1re colonne : ce qui distingue l'ethnie
  dons_rubrique_nom    TEXT    CHECK (dons_rubrique_nom IS NULL OR length(dons_rubrique_nom) > 0),          -- colonne du nom du don (« Nom ») ; NULL si absente
  dons_rubrique_don    TEXT    CHECK (dons_rubrique_don IS NULL OR length(dons_rubrique_don) > 0),          -- colonne du don (« Don »)
  dons_tableau_titre   TEXT    CHECK (dons_tableau_titre IS NULL OR length(dons_tableau_titre) > 0),        -- nom écrit sur le tableau en panneaux (Drakos : « Écaille draconique »)
  origine              TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref           TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK ((dons_rubrique IS NULL) = (dons_rubrique_don IS NULL)),
  CHECK (dons_rubrique_nom IS NULL OR dons_rubrique IS NOT NULL)
) STRICT, WITHOUT ROWID;

-- RACE_DON : dons raciaux de l'onglet, dans son ordre. forme 'ethnie' = une ligne du tableau des ethnies (étiquette = 1re colonne : « Elfe Charbon »,
-- « Londolor Est », « Eau en innée ») ; 'unique' = le don de toute la race, sans tableau (Elfe doré, Majin, Hujin, Lamia, et « Trompe-mort » du Mort-vivant).
-- Les ethnies de l'onglet ne portent pas le nom des sous-races de la fiche : `ethnie_id` est la correspondance explicite de l'importeur (ETHNIE_FICHE).
CREATE TABLE race_don (
  id          TEXT    NOT NULL PRIMARY KEY,                    -- '<race_id>#don:<slug>'
  race_id     TEXT    NOT NULL REFERENCES race_onglet(race_id),
  slug        TEXT    NOT NULL CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '*--*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'),   -- normalize(etiquette) ou, pour un don unique, normalize(nom)
  rang        INTEGER NOT NULL CHECK (rang >= 1),              -- ordre de l'onglet
  forme       TEXT    NOT NULL CHECK (forme IN ('ethnie', 'unique')),
  etiquette   TEXT    CHECK (etiquette IS NULL OR length(etiquette) > 0),   -- 1re colonne du tableau des ethnies (retours à la ligne réduits à une espace) ; NULL pour un don unique
  nom         TEXT    CHECK (nom IS NULL OR length(nom) > 0),               -- nom du don (« Sang corrompu ») ; NULL quand l'onglet n'en écrit pas
  texte       TEXT    NOT NULL CHECK (length(texte) > 0),                   -- le don, tel qu'écrit
  ethnie_id   TEXT    REFERENCES ethnie(id),                                -- sous-race de la fiche qui lui correspond ; NULL = aucune (Trompe-mort)
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (race_id, slug),
  UNIQUE (race_id, rang),
  CHECK (id = race_id || '#don:' || slug),
  CHECK ((forme = 'ethnie') = (etiquette IS NOT NULL)),
  CHECK (forme = 'ethnie' OR nom IS NOT NULL)
) STRICT;

CREATE INDEX race_don_ethnie ON race_don (ethnie_id) WHERE ethnie_id IS NOT NULL;

-- RACE_DON_TABLEAU_* : le tableau en panneaux du bloc « Don R (Race) » (Drakos : magie innée -> AP/AM, bonus de compétence, cran de résistance ;
-- Mort-vivant : lieu de résurrection / raison de la mort -> don), cellule par cellule. Une race en a au plus un ; son titre est race_onglet.dons_tableau_titre.
CREATE TABLE race_don_tableau_colonne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  libelle    TEXT    NOT NULL CHECK (length(libelle) > 0),        -- en-tête tel qu'écrit (« Lieu de résurrection\nRaison de la mort »)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE TABLE race_don_tableau_ligne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  ethnie_id  TEXT    REFERENCES ethnie(id),                      -- sous-race de la fiche qui correspond à la ligne (« Drakos Rouge » pour Feu)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_ligne_ethnie ON race_don_tableau_ligne (ethnie_id) WHERE ethnie_id IS NOT NULL;

CREATE TABLE race_don_tableau_cellule (
  race_id    TEXT    NOT NULL,
  ligne      INTEGER NOT NULL,
  colonne    INTEGER NOT NULL,
  valeur     TEXT    NOT NULL CHECK (length(valeur) > 0),         -- texte de la cellule tel qu'écrit (puces « - » et retours à la ligne conservés)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, ligne, colonne),
  FOREIGN KEY (race_id, ligne) REFERENCES race_don_tableau_ligne (race_id, rang),
  FOREIGN KEY (race_id, colonne) REFERENCES race_don_tableau_colonne (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_cellule_colonne_fk ON race_don_tableau_cellule (race_id, colonne);

-- RACE_MAGIE_ONGLET : magies innées que l'onglet de la race limite explicitement (ligne « Inconvénient(s) » : « Magie du Feu, Terre, Foudre, Arcane,
-- Potentiel illimité en inné uniquement »), dans l'ordre où il les cite. Quand une race en a, cette liste PRIME sur la matrice race_magie (décision R11 :
-- le Nain) ; sinon la matrice fait foi (décision R8). Les 13 races hybrides citent les trois mêmes magies que la matrice.
CREATE TABLE race_magie_onglet (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  nom_brut   TEXT    NOT NULL CHECK (length(nom_brut) > 0),       -- nom de la magie dans la liste de l'importeur (« Potentiel Illimité »)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, magie_id),
  UNIQUE (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_magie_onglet_magie ON race_magie_onglet (magie_id);

-- ▸ RELATIONS ENTRE PEUPLES : classeur « Les races », onglet « Relation entre les races » (page lore/relations-entre-les-races).
-- Matrice carrée de 69 peuples en lignes et en colonnes ; chaque case porte un niveau de l'échelle (de « Même peuple » à « Ennemie »). La matrice n'est
-- PAS symétrique. SENS (décision R12 du propriétaire) : la case (ligne A, colonne B) dit comment A voit B ; la légende de l'onglet (« Verticale = Comment le
-- peuple voit les autres », « Horizontale = Comment le peuple est vu par les autres ») vise les étiquettes. Les colonnes gardent les noms de l'axe
-- (ligne = étiquette de gauche, colonne = étiquette du haut) ; la vue v_regard_peuple les nomme « qui voit qui ».
CREATE TABLE echelle_relation (
  id         TEXT    NOT NULL PRIMARY KEY,                   -- normalize(libelle) : 'meme-peuple', 'alliee', 'appreciee', 'acceptee', 'neutre', 'evitee', 'haine', 'ennemie'
  libelle    TEXT    NOT NULL UNIQUE,                        -- « Même peuple », « Alliée »… tel qu'écrit
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),     -- ordre de l'onglet, de gauche à droite : du plus favorable au plus défavorable
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Un peuple = une étiquette de l'onglet (« Elfe Forestier Forêt », « Humain Central »…) : recopiée telle qu'écrite (coquilles comprises : « Supprémaciste »).
CREATE TABLE peuple (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (instr(id, '#peuple:') > 0),   -- 'lore/relations-entre-les-races#peuple:elfe-noir-charbon'
  nom        TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),
  nom_cle    TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),                                          -- normalize(nom)
  ordre      INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),                       -- rang de l'étiquette dans l'onglet (1 à 69)
  race_id    TEXT    REFERENCES race(id),                                      -- rapprochement INFORMATIF : l'unique race dont le titre commence le nom ; NULL sinon
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;
CREATE INDEX peuple_race ON peuple (race_id) WHERE race_id IS NOT NULL;

CREATE TABLE relation_peuple (
  ligne_peuple_id   TEXT    NOT NULL REFERENCES peuple(id),                    -- étiquette de GAUCHE de la case : le peuple qui voit (R12)
  colonne_peuple_id TEXT    NOT NULL REFERENCES peuple(id),                    -- étiquette du HAUT de la case : le peuple vu (R12)
  echelle_id        TEXT    NOT NULL REFERENCES echelle_relation(id),
  origine           TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref        TEXT    NOT NULL CHECK (length(source_ref) > 0),                                          -- « Les races › Relation entre les races › E23:H26 »
  PRIMARY KEY (ligne_peuple_id, colonne_peuple_id)
) STRICT, WITHOUT ROWID;
CREATE INDEX relation_peuple_colonne ON relation_peuple (colonne_peuple_id, echelle_id);
CREATE INDEX relation_peuple_echelle ON relation_peuple (echelle_id);

-- ====================================================================================================================
-- 8. BESTIAIRE : invocations et créatures (famille « bestiaire »)
-- id d'une créature = id de sa page ; blocs, capacités et attaques : '<id de la créature ou de l'invocation>#<sorte>:<clé>'.
-- ====================================================================================================================

-- INVOCATION : une ligne par onglet du classeur (3)
-- Une « invocation » est un TYPE de créatures qu'un sort permet d'invoquer : golems (Appel aux golems), non-morts
-- (Animation des morts), marionettes d'ombre (Marionette de lombre).
CREATE TABLE invocation (
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

CREATE INDEX invocation_sort ON invocation (sort_id) WHERE sort_id IS NOT NULL;

-- Capacités communes d'une invocation : la liste « ▸ Toutes ces créatures ont ceci en capacité commune » du texte général
-- (golems : Inerte, Élémentaire ; non-morts : Non-Mort, Élémentaire). Une ligne = un élément de la liste « - Nom. Texte ».
-- Reconstruction : '- ' || nom || '. ' || texte = l'élément de liste de texte_general.
CREATE TABLE invocation_capacite_commune (
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

-- Résistances / vulnérabilités / immunités écrites dans une capacité COMMUNE (aujourd'hui : « Non-Mort » : immunisée à la peur, à la
-- couardise, à la fatigue, au poison, à la maladie). INDEX DÉRIVÉ DU TEXTE par une table explicite de l'importeur (RESISTANCES_COMMUNES) :
-- `extrait` est la tournure exacte de la capacité (contrôlée à l'import : elle doit figurer dans `texte`). La règle « Élémentaire »
-- n'est PAS ici : elle se déduit de la magie de la créature (vue v_creature_resistance).
-- Les lignes s'appliquent à CHAQUE créature de l'invocation (vue v_creature_resistance).
CREATE TABLE invocation_resistance (
  capacite_commune_id TEXT    NOT NULL REFERENCES invocation_capacite_commune(id),
  rang                INTEGER NOT NULL CHECK (rang >= 1),
  sens                TEXT    NOT NULL CHECK (sens IN ('resistance', 'vulnerabilite', 'immunite', 'sensibilite')),
  sens_brut           TEXT    NOT NULL,       -- mot de la source : « immunisée », « résistante », « faiblesse », « sensibilité »…
  cible_type          TEXT    NOT NULL CHECK (cible_type IN ('magie', 'etat', 'degat', 'autre')),
  cible_magie_id      TEXT    REFERENCES magie(id),   -- 'magie' : « résistante contre le Feu »
  cible_etat_id       TEXT    REFERENCES etat(id),    -- 'etat'  : « faiblesse contre la paralysie »
  cible_degat         TEXT    CHECK (cible_degat IN ('physique', 'frappe', 'taille', 'estoc', 'sonore')),   -- 'degat' : « aux attaques d'estoc »
  cible_brut          TEXT    NOT NULL,       -- la cible comme écrite (« la peur », « Acide », « maladie »)
  extrait             TEXT    NOT NULL,       -- tournure exacte de la capacité d'où la ligne est tirée
  origine             TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref          TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (capacite_commune_id, rang),
  CHECK ((cible_type = 'magie' AND cible_magie_id IS NOT NULL AND cible_etat_id IS NULL     AND cible_degat IS NULL)
      OR (cible_type = 'etat'  AND cible_etat_id  IS NOT NULL AND cible_magie_id IS NULL    AND cible_degat IS NULL)
      OR (cible_type = 'degat' AND cible_degat    IS NOT NULL AND cible_magie_id IS NULL    AND cible_etat_id IS NULL)
      OR (cible_type = 'autre' AND cible_magie_id IS NULL     AND cible_etat_id IS NULL     AND cible_degat IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX invocation_resistance_cible ON invocation_resistance (sens, cible_type, cible_magie_id, cible_etat_id, cible_degat);

-- BLOC : une ligne de marge du classeur (A13:C16, A42:C45…) = une combinaison de magies avec ses deux créatures
-- Onglets « Appel aux golems » (15 blocs) et « Animation des morts » (14) : la marge dit la ou les magies (« Terre Mono »,
-- « Terre + Sang », « Nécromancie + Espace/Temps »), la carte de gauche et celle de droite sont les deux créatures du bloc.
-- Onglet « Marionette de lombre » (5 blocs) : la marge est un palier « EP1 » à « EP5 », UNE créature par bloc.
CREATE TABLE invocation_bloc (
  id            TEXT    NOT NULL PRIMARY KEY,         -- '<invocation.id>#bloc:<cle>'
  invocation_id TEXT    NOT NULL REFERENCES invocation(id),
  rang          INTEGER NOT NULL CHECK (rang >= 1),   -- ordre des blocs dans l'onglet (de haut en bas)
  cle           TEXT    NOT NULL CHECK (cle NOT GLOB '*[^a-z0-9-]*' AND cle NOT GLOB '*--*' AND cle NOT GLOB '-*' AND cle NOT GLOB '*-'),                     -- normalize(marge_brut) : 'terre-feu', 'terre-mono', 'ep3'
  marge_brut    TEXT    NOT NULL,                     -- libellé de marge, espaces compactés : 'Terre + Sang', 'Terre Mono', 'EP1'
  ep            INTEGER CHECK (ep BETWEEN 1 AND 5),   -- N de « EPN » (onglet Marionette seulement). Le sigle EP n'est défini nulle part
                                                      -- dans le classeur : conservé tel quel, sans traduction.
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (invocation_id, rang),
  UNIQUE (invocation_id, cle),
  UNIQUE (id, invocation_id),                          -- clé visée par creature (bloc et invocation cohérents)
  CHECK (id = invocation_id || '#bloc:' || cle)
) STRICT;

-- Magies de la marge d'un bloc, dans l'ordre d'écriture. « Terre Mono » = une ligne ; « Terre + Feu » = deux lignes ;
-- « Terre + Terre » = deux lignes identiques (double magie de la même magie : pas d'UNIQUE sur magie_id). Le classeur dit que
-- l'utilisateur de la Terre (resp. de la Nécromancie) lance le sort et que la seconde magie vient de lui ou d'un allié : la
-- première magie de la marge est donc celle du sort (vérifié à l'import contre invocation.sort_id).
-- Aucune ligne pour l'onglet Marionette (marge « EPN »).
CREATE TABLE invocation_bloc_magie (
  bloc_id    TEXT    NOT NULL REFERENCES invocation_bloc(id),
  rang       INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 2),
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  magie_brut TEXT    NOT NULL,                       -- écriture dans la marge : 'Terre', 'Espace/Temps' (sans « Mono »)
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (bloc_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX invocation_bloc_magie_magie ON invocation_bloc_magie (magie_id);

-- CREATURE : une ligne par carte (63 = 30 golems/poupées + 28 non-morts + 5 marionettes)
CREATE TABLE creature (
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

CREATE INDEX creature_invocation ON creature (invocation_id);

CREATE INDEX creature_sante      ON creature (sante_valeur);          -- « santé >= N » (valeur écrite : voir sante_forme)

CREATE INDEX creature_vitesse    ON creature (vitesse_sol, vitesse_nage);

-- Ligne facultative « ressource supplémentaire » de la carte (D9 + ligne suivante : Sang, Corruption, Âme) : 3 poupées seulement.
CREATE TABLE creature_ressource (
  creature_id TEXT    NOT NULL REFERENCES creature(id),
  ressource   TEXT    NOT NULL CHECK (ressource IN ('sang', 'corruption', 'ame')),   -- normalize(libelle)
  libelle     TEXT    NOT NULL,                       -- « Sang », « Corruption », « Âme » tel qu'écrit
  brut        TEXT    NOT NULL,                       -- « 10 » ou « 10/NPM »
  forme       TEXT    NOT NULL CHECK (forme IN ('fixe', 'par_npm')),
  valeur      INTEGER NOT NULL CHECK (valeur >= 0),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (creature_id, ressource)
) STRICT, WITHOUT ROWID;

-- Les six nombres de la cellule FPVSIA, dans l'ordre d'écriture (rang 1 à 6). Le classeur n'explicite pas le sigle : l'importeur lit
-- F, P, V, S, I, A comme Force, Perception, Volonté, Social, Intelligence, Agilité (constante FPVSIA_ORDRE). Indices dans la source :
-- l'ordre « 1 Force, 2 Perception, 3 Volonté, 4 Social, 5 Intelligence, 6 Agilité » de la table des accessoires, la capacité commune
-- des golems « Inerte. Boost la volonté à 10 » (3e nombre = 10 pour les 30 golems/poupées), et les bonus « +1 Force au niveau 2
-- magique » toujours posés sur une caractéristique de valeur supérieure à 1 (contrôle à l'import). À confirmer par le propriétaire
-- (design.md §12, points ouverts) : en cas d'erreur, seule la constante de l'importeur change, pas le schéma.
CREATE TABLE creature_caracteristique (
  creature_id        TEXT    NOT NULL REFERENCES creature(id),
  caracteristique_id TEXT    NOT NULL REFERENCES caracteristique(id),   -- domaine fiche : 'force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'
  rang               INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 6),     -- position dans la cellule
  valeur             INTEGER NOT NULL CHECK (valeur >= 0),
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (creature_id, caracteristique_id),
  UNIQUE (creature_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX creature_caracteristique_valeur ON creature_caracteristique (caracteristique_id, valeur);

-- Bonus écrits entre parenthèses après les six nombres : « (+1 Force au niveau 2 magique, +1 Force au niveau 4 magique) ».
-- Une ligne par « +N <caractéristique(s)> au niveau M magique ». `niveau_magique` est le M écrit (la capacité écrit « NPM M » : même
-- échelle probable, non dite). `caracteristique_id` n'est renseigné que si la cible est UNE caractéristique ; « Force/Agilité »
-- (Zombinox, Embrasé) reste dans cible_brut avec caracteristique_id NULL : le classeur ne dit pas « l'une ou l'autre » ou « les deux ».
CREATE TABLE creature_bonus_npm (
  creature_id        TEXT    NOT NULL REFERENCES creature(id),
  rang               INTEGER NOT NULL CHECK (rang >= 1),
  niveau_magique     INTEGER NOT NULL CHECK (niveau_magique BETWEEN 1 AND 5),
  increment          INTEGER NOT NULL,                 -- « +1 » -> 1
  cible_brut         TEXT    NOT NULL,                 -- « Force », « Force/Agilité »
  caracteristique_id TEXT    REFERENCES caracteristique(id),
  texte_brut         TEXT    NOT NULL,                 -- fragment exact : « +1 Force au niveau 2 magique »
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (creature_id, rang)
) STRICT, WITHOUT ROWID;

-- ATTAQUES : ligne « Dégâts » de la carte, une ligne de texte par attaque
-- « Poing - 1d10/NPM dégâts de frappe », « Canon magma - 1d10/NPM dégâts de frappe/feu (portée 4-18|zone 2x2|Coûte 10% de santé) ».
-- `brut` = la ligne entière (reconstruction : nom || ' - ' || reste ; contrôlée à l'import). Les colonnes typées ne sont remplies que
-- pour les formes sans ambiguïté ; `precisions` garde TOUTES les parenthèses (zone, cône, coût en santé, « 2Po-Cône »…).
CREATE TABLE creature_attaque (
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

-- Types de dégâts d'une attaque : « de taille/estoc » = deux lignes ; « de frappe/feu » = frappe + feu. Aucune ligne si la ligne
-- n'a pas de type (« 6d6 dégâts », « (sans type) »). Les vocabulaires physique (frappe, taille, estoc) et élémentaire (feu, eau,
-- glace : lié à la magie du même nom) sont ceux du classeur ; « sonore » n'est ni l'un ni l'autre.
CREATE TABLE creature_attaque_type (
  attaque_id TEXT    NOT NULL REFERENCES creature_attaque(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  type       TEXT    NOT NULL CHECK (type IN ('frappe', 'taille', 'estoc', 'sonore', 'feu', 'eau', 'glace')),
  libelle    TEXT    NOT NULL,                       -- écriture d'origine du mot
  magie_id   TEXT    REFERENCES magie(id),           -- magie du même nom pour feu / eau / glace
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (attaque_id, rang),
  UNIQUE (attaque_id, type),
  CHECK ((type IN ('feu', 'eau', 'glace')) = (magie_id IS NOT NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX creature_attaque_type_type ON creature_attaque_type (type);

CREATE INDEX creature_attaque_nom ON creature_attaque (nom_cle);

-- CAPACITÉS : cellule « Capacité(s) », un paragraphe (séparé par une ligne vide) = une capacité
-- Forme du paragraphe : « [(NPM n) ][[étiquette] ]Nom. Texte ». Reconstruction exacte :
--   ['(NPM ' || npm_min || ') '] || ['[' || etiquette || '] '] || nom || '. ' || texte   (contrôlée à l'import)
CREATE TABLE creature_capacite (
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

CREATE INDEX creature_capacite_nom ON creature_capacite (nom_cle);

CREATE INDEX creature_capacite_npm ON creature_capacite (npm_min) WHERE npm_min IS NOT NULL;

-- Sorts cités par une capacité « Lanceur de sorts » (« avec les niveaux de maîtrises maximum : Boule de feu, Cautérisation ») ou
-- « Sort supplémentaire » (« obtient de nouveaux sorts en plus des autres : … »). Une ligne par nom de la liste.
-- sort_id = le sort de la table `sort` (domaine magies) de même nom (normalize) parmi les sorts des magies du bloc ; NULL (et
-- sort_nom_brut seul) quand aucun ne porte ce nom : 6 cas sur 105 (« Boule de foudre » pour « Boules de foudre », « Veilliessement »…)
-- sont laissés NULL : rapprocher serait deviner (voir design.md §12). Le niveau de maîtrise « maximum » n'est pas stocké : il est
-- dans le texte de la capacité.
CREATE TABLE creature_capacite_sort (
  capacite_id   TEXT    NOT NULL REFERENCES creature_capacite(id),
  rang          INTEGER NOT NULL CHECK (rang >= 1),
  sort_nom_brut TEXT    NOT NULL,                     -- nom écrit dans la liste
  sort_id       TEXT    REFERENCES sort(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (capacite_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX creature_capacite_sort_sort ON creature_capacite_sort (sort_id) WHERE sort_id IS NOT NULL;

-- Résistances / vulnérabilités / immunités déclarées par le texte d'une capacité de la créature (« Fait de verre. Cette créature est
-- résisantante contre le Feu, Terre… », « Gluant… faiblesse contre la paralysie », « Squelettique. … immunisée aux attaques d'estoc »).
-- INDEX DÉRIVÉ DU TEXTE par une table explicite de l'importeur (RESISTANCES_CAPACITES) : `extrait` est la tournure exacte, contrôlée à
-- l'import (elle doit figurer dans le texte de la capacité). NON exhaustif : les résistances chiffrées (« la moitié des dégâts… »,
-- « 4 fois moins de dégâts de foudre ») et dynamiques (« une résistance à l'élément du dernier sort subi ») restent dans le texte.
-- `sens` : 'sensibilite' est gardé distinct de 'vulnerabilite' (le classeur des états distingue « Sensibilité » et « Vulnérabilité »).
CREATE TABLE creature_capacite_resistance (
  capacite_id    TEXT    NOT NULL REFERENCES creature_capacite(id),
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  sens           TEXT    NOT NULL CHECK (sens IN ('resistance', 'vulnerabilite', 'immunite', 'sensibilite')),
  sens_brut      TEXT    NOT NULL,                    -- « résisantante » (coquille conservée), « immunisée », « faiblesse », « sensibilité »…
  cible_type     TEXT    NOT NULL CHECK (cible_type IN ('magie', 'etat', 'degat', 'autre')),
  cible_magie_id TEXT    REFERENCES magie(id),
  cible_etat_id  TEXT    REFERENCES etat(id),
  cible_degat    TEXT    CHECK (cible_degat IN ('physique', 'frappe', 'taille', 'estoc', 'sonore')),
  cible_brut     TEXT    NOT NULL,
  extrait        TEXT    NOT NULL,
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (capacite_id, rang),
  CHECK ((cible_type = 'magie' AND cible_magie_id IS NOT NULL AND cible_etat_id IS NULL     AND cible_degat IS NULL)
      OR (cible_type = 'etat'  AND cible_etat_id  IS NOT NULL AND cible_magie_id IS NULL    AND cible_degat IS NULL)
      OR (cible_type = 'degat' AND cible_degat    IS NOT NULL AND cible_magie_id IS NULL    AND cible_etat_id IS NULL)
      OR (cible_type = 'autre' AND cible_magie_id IS NULL     AND cible_etat_id IS NULL     AND cible_degat IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX creature_capacite_resistance_cible ON creature_capacite_resistance (sens, cible_type, cible_magie_id, cible_etat_id, cible_degat);

-- AUTRES BLOCS DE LA CARTE
-- Panneau « Effet "Manteau noir" » de la carte des marionettes (S12 / S13 : libellé puis texte) : les bonus que procure la créature
-- quand on la sacrifie avec le sort « Manteau noir » (domaine magies : « Permet de sacrifier l'invocation de l'ombre pour avoir des
-- bonus pendant 3 tours (voir invocation) »). sort_id = le sort de la magie de l'invocation dont le nom est celui des guillemets.
CREATE TABLE creature_effet (
  creature_id TEXT    NOT NULL REFERENCES creature(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  libelle     TEXT    NOT NULL,                       -- « Effet "Manteau noir" » tel qu'écrit
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),                       -- ce qui est entre guillemets : « Manteau noir »
  sort_id     TEXT    REFERENCES sort(id),            -- le sort de ce nom dans la magie du sort d'invocation ; NULL si introuvable
  texte       TEXT    NOT NULL,                       -- « - +2 dégâts\n- Chaque attaque qui touche… »
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'bestiaire'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (creature_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX creature_effet_sort ON creature_effet (sort_id) WHERE sort_id IS NOT NULL;

-- ====================================================================================================================
-- 9. ÉQUIPEMENT, RESSOURCES, CRAFT, MÉTIERS (familles « equipement », « craft », « docs_typees »)
-- Un catalogue unique `ressource` (tout ce qui a un nom et un prix) + une table de détail par genre ; id = '<id de la page>#<sorte>:<slug>'.
-- ====================================================================================================================

-- Monnaies de l'onglet « Équipement inventaire » (MONNAIE A3:D7 et CONVERTISSEUR A12:D16).
CREATE TABLE monnaie (
  id                  TEXT    NOT NULL PRIMARY KEY,   -- abréviation en minuscules : 'rf', 'ro', 'pp'
  nom                 TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),        -- « Ricken de fer », « Ricken d'or », « Pierre précieuse »
  abreviation         TEXT    NOT NULL UNIQUE,        -- « RF », « RO », « PP »
  valeur_rf           INTEGER NOT NULL CHECK (valeur_rf >= 1),   -- valeur en RF : 1 / 100 / 100 000. Le RF est l'unité du CONVERTISSEUR (valeur 1 par définition)
  convertisseur_brut  TEXT,                           -- ligne du CONVERTISSEUR telle qu'écrite (« 1 RO : 100 RF ») ; NULL pour le RF (aucune ligne)
  origine             TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref          TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Constantes chiffrées que la source écrit dans ses textes de règles et dont le modèle a besoin (« Toutes les armes ont de base 2 cran de
-- solidité », « Chaque ingrédient indiqué dans une recette représente deux unités »…). Une ligne = une phrase de la source ; `valeur` est le
-- nombre de cette phrase (le chargeur vérifie que la phrase est bien dans la cellule ou la page). Les autres règles restent du texte
-- (corps_md des pages).
CREATE TABLE constante_equipement (
  id          TEXT    NOT NULL PRIMARY KEY,           -- 'arme.solidite_base', 'alchimie.unites_par_ingredient'…
  valeur      INTEGER NOT NULL,
  unite       TEXT,                                   -- 'crans', '%', 'unites', 'materiaux' ; NULL si le nombre n'a pas d'unité propre
  texte       TEXT    NOT NULL,                       -- la phrase de la source, telle qu'écrite
  page_id     TEXT    NOT NULL REFERENCES page(id),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Niveaux de difficulté des recettes d'alchimie : Novice < Apprenti < Avancé < Expert < Maître (colonne « Niveau » des potions et
-- table des kits : « Faire les recettes novice / apprentis ou moins / avancées ou moins… »). L'ordre est celui de la table des kits.
CREATE TABLE niveau_alchimie (
  id          TEXT    NOT NULL PRIMARY KEY,           -- 'novice', 'apprenti', 'avance', 'expert', 'maitre'
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                -- « Novice », « Apprenti », « Avancé », « Expert », « Maître »
  rang        INTEGER NOT NULL UNIQUE CHECK (rang >= 1),   -- 1 = Novice
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Affinités alchimiques (colonne « Affinité » des listes d'ingrédients et cellules des tables « Recette »). Une affinité composée
-- (« Santé + Chakra ») est UNE affinité : elle a sa propre ligne, dont la clé est l'ensemble de ses composantes, triées
-- (« Barrière + Chakra » des ingrédients et « Chakra + Barrière » d'une recette désignent donc la même ligne).
CREATE TABLE affinite (
  id              TEXT    NOT NULL PRIMARY KEY,       -- composantes normalisées, triées, jointes par '+' : 'sante', 'chakra+sante', 'regeneration-chakra', '4eme-barre', 'espace-temps'
  libelle         TEXT    NOT NULL,                   -- première écriture rencontrée (ordre des listes d'ingrédients) : « Santé + Chakra »
  nb_composantes  INTEGER NOT NULL CHECK (nb_composantes >= 1),
  origine         TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Familles d'armes = bandeaux de l'onglet « Armes » (12 : ÉPÉES - D10, DAGUES - D6, … ARME DE MONSTRES). Une arme est listée sous UN
-- bandeau ; les armes à deux catégories (Crochet grappin, Étendard de guerre…) apparaissent sous deux bandeaux, avec deux lignes distinctes.
CREATE TABLE arme_famille (
  id            TEXT    NOT NULL PRIMARY KEY,         -- slug du nom du bandeau : 'epees', 'masse-marteau', 'lance-arme-dhast', 'arme-de-monstres'
  libelle_brut  TEXT    NOT NULL,                     -- bandeau complet tel qu'écrit : « ARME DE JET - D6 [Un matériau permet d'en faire 10 sauf pour la fronde qui elle est unique] »
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- partie avant « - » : « ARME DE JET »
  de_brut       TEXT,                                 -- dé(s) écrit(s) après « - » : « D10 », « D6/D8/D10 » ; NULL pour ARME DE MONSTRES (renvoi à la catégorie d'arme)
  note_brut     TEXT,                                 -- le reste du bandeau sans ses parenthèses ni crochets : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », « Disponible en l'an 150 » ; NULL sinon
  cout_libelle  TEXT    NOT NULL,                     -- en-tête de la colonne de coût du bandeau : « Coût » (Épées) ou « Coût en plus/moins » ; « … (unité) » : coût d'une pièce de munition ou de bombe
  ordre         INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang du bandeau de gauche à droite
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Types d'armes = table BDD!AD2:AF14 de la fiche automatique (13 types) : dé de dégâts et portée par défaut. C'est le « type » que la
-- fiche lit (première ligne de la cellule Catégorie : « Épée / Arme Lourde » -> Épée). Dé du Pugilat : il dépend de la Force
-- (D6 jusqu'à 2, D8 à 3-4, D10 à 5 : bandeau PUGILAT de l'onglet Armes) : `de` est NULL et la règle est dans `de_regle`.
CREATE TABLE arme_type (
  id            TEXT    NOT NULL PRIMARY KEY,         -- slug : 'epee', 'arme-dhast', 'arme-dhast-baton', 'masse-hache', 'baton-de-combat'
  nom           TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),              -- écriture de la fiche : « Épée », « Bâton de Combat », « Arme d'Hast/Baton »
  de            TEXT    CHECK (de IS NULL OR de GLOB 'D[0-9]*'),   -- « D10 » ; NULL pour le Pugilat
  de_faces      INTEGER CHECK (de_faces IS NULL OR de_faces >= 2),   -- 10
  de_regle      TEXT,                                 -- règle du dé quand il n'est pas fixe (Pugilat), recopiée du bandeau
  portee_min    INTEGER NOT NULL CHECK (portee_min >= 0),   -- portée par défaut (« 1-2 » -> 1)
  portee_max    INTEGER NOT NULL CHECK (portee_max >= portee_min),
  portee_brut   TEXT    NOT NULL,                     -- « 1-2 »
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((de IS NULL) = (de_faces IS NULL)),
  CHECK ((de IS NULL) = (de_regle IS NOT NULL))
) STRICT;

-- ▸ CATALOGUE : RESSOURCES
-- Tout ce qui porte un nom et un prix dans les listes de la source et peut entrer dans une recette ou en sortir : matériaux, gemmes,
-- bois, ingrédients d'alchimie, potions, matériel, produits non monétaires, parchemins, livres, kits, matériaux de construction.
-- Genre 'mentionne' : nom rencontré UNIQUEMENT dans le texte d'une recette (« minerais de fer », « Bas Fourneau ») : la source n'en
-- dit rien d'autre ; la ligne existe pour que « les recettes qui utilisent X » se joigne par clé et non par LIKE.
CREATE TABLE ressource (
  id           TEXT    NOT NULL PRIMARY KEY,          -- '<page>#<sorte>:<slug>', sorte ∈ materiau, gemme, bois, ingredient, potion, produit, materiel, parchemin, livre, kit, materiau-construction, mentionne ;
                                                      -- ingrédients : '<page>#ingredient:<catégorie>:<slug>' (« Gelée orange » existe en Essence ET en Stabilisateur) ; un matériau a l'id de la page Armures (ou Armes pour « Os »)
  genre        TEXT    NOT NULL CHECK (genre IN ('materiau', 'gemme', 'bois', 'ingredient_alchimie', 'potion', 'produit', 'materiel',
                                                'parchemin', 'livre', 'kit_alchimie', 'materiau_construction', 'mentionne')),
  section      TEXT,                                  -- rubrique de la source : 'VEGETAUX', 'MATOS AVENTURES', 'Essence', 'PARCHEMIN'… ; NULL si la liste n'en a pas
  nom          TEXT    NOT NULL CHECK (length(nom) > 0),   -- tel qu'écrit (espaces de bord retirés)
  nom_cle      TEXT    NOT NULL CHECK (length(nom_cle) > 0),   -- normalize(nom) : clé de jointure par nom
  description  TEXT,                                  -- colonne « Description » quand la liste en a une ; NULL sinon
  prix_brut    TEXT,                                  -- « 100 RF / 1 RO », « 2 Ro », « 0,6 Ro » ; NULL si la source n'en donne pas
  prix_rf      INTEGER CHECK (prix_rf IS NULL OR prix_rf >= 0),   -- voir règles communes ; 0,6 Ro = 60
  page_id      TEXT    NOT NULL REFERENCES page(id),  -- page du wiki où la ressource est définie
  ordre        INTEGER CHECK (ordre IS NULL OR ordre >= 1),       -- rang dans sa liste (de haut en bas)
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK (prix_rf IS NULL OR prix_brut IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX ressource_genre_section_cle ON ressource (genre, COALESCE(section, ''), nom_cle);

CREATE INDEX ressource_nom_cle ON ressource (nom_cle);

CREATE INDEX ressource_page    ON ressource (page_id);

CREATE INDEX ressource_prix    ON ressource (prix_rf) WHERE prix_rf IS NOT NULL;

-- Matériau d'arme : onglet Armes › MATERIAUX (14 matières ; effet = « Dégâts +N pour l'arme » puis lignes d'effets secondaires).
CREATE TABLE materiau_arme (
  ressource_id      TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  prix_brut         TEXT    NOT NULL,                 -- colonne « Prix matériaux » de CET onglet (peut différer de ressource.prix_brut : « 100 RF / 10 RO » ici, « 1 000 RF / 10 RO » dans Armures)
  prix_rf           INTEGER CHECK (prix_rf IS NULL OR prix_rf >= 0),
  effet_brut        TEXT    NOT NULL,                 -- cellule « Effets » entière
  bonus_degats      INTEGER,                          -- N de « Dégâts +N pour l'arme » ; NULL pour « rien de particulier » (Fer)
  cran_solidite     INTEGER,                          -- ±N de « ±N cran de solidité » ; NULL si la ligne est absente
  effet_secondaire  TEXT,                             -- lignes de l'effet autres que le bonus et le cran (« 1d4 de corruption a chaque coup qui touche ») ; NULL si aucune
  ordre             INTEGER NOT NULL CHECK (ordre >= 1),
  origine           TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref        TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

CREATE INDEX materiau_arme_bonus ON materiau_arme (bonus_degats);

-- Matériau d'armure : « Fiches des matières de la grille » (en-têtes de colonne de l'onglet Armures, 21 matières).
CREATE TABLE materiau_armure (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  type          TEXT    NOT NULL CHECK (type IN ('Léger', 'Intermédiaire', 'Lourd')),
  prix          REAL    CHECK (prix IS NULL OR prix >= 0),   -- « Prix : 1,5 » -> 1.5 ; l'unité n'est pas écrite dans la fiche (RO d'après le recoupement avec « Prix matériaux », à confirmer)
  prix_brut     TEXT,
  stats_brut    TEXT    NOT NULL,                     -- « +2AP +4AM »
  ap            INTEGER,                              -- N de « +NAP » ; NULL si « AP » n'est pas écrit (la fiche compte 0)
  am            INTEGER,
  solidite      INTEGER NOT NULL CHECK (solidite >= 0),
  ordre         INTEGER NOT NULL CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

CREATE INDEX materiau_armure_type ON materiau_armure (type);

-- Matériau de bouclier : « Fiches des matières pour boucliers » (20 matières : pas de Peau). « Les matériaux n'ont pas les mêmes stats pour les boucliers par rapport aux armures. »
CREATE TABLE materiau_bouclier (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  prix          REAL    CHECK (prix IS NULL OR prix >= 0),
  prix_brut     TEXT,
  stats_brut    TEXT    NOT NULL,
  ap            INTEGER,
  am            INTEGER,
  solidite      INTEGER NOT NULL CHECK (solidite >= 0),
  ordre         INTEGER NOT NULL CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Gemmes précieuses (14, une par magie) : onglet Bâton magique (prix de la gemme entière) et onglet Accessoires (prix d'un QUART de gemme,
-- « Chaque accessoire possède des morceaux de gemmes, ce sont des quarts de gemmes »). Qualités : commune (= « normal » / « classique »),
-- raffinée, parfaite (= « Prix (Parfait) » / « parfaite »).
CREATE TABLE gemme (
  ressource_id           TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  magie_id               TEXT    NOT NULL UNIQUE REFERENCES magie(id),   -- gemme « liée à une magie »
  prix_commune_brut      TEXT,  prix_commune_rf      INTEGER CHECK (prix_commune_rf IS NULL OR prix_commune_rf >= 0),   -- Bâton magique : gemme entière
  prix_raffinee_brut     TEXT,  prix_raffinee_rf     INTEGER CHECK (prix_raffinee_rf IS NULL OR prix_raffinee_rf >= 0),
  prix_parfaite_brut     TEXT,  prix_parfaite_rf     INTEGER CHECK (prix_parfaite_rf IS NULL OR prix_parfaite_rf >= 0),
  quart_commune_brut     TEXT,  quart_commune_rf     INTEGER CHECK (quart_commune_rf IS NULL OR quart_commune_rf >= 0),   -- Accessoires : quart de gemme
  quart_raffinee_brut    TEXT,  quart_raffinee_rf    INTEGER CHECK (quart_raffinee_rf IS NULL OR quart_raffinee_rf >= 0),
  quart_parfaite_brut    TEXT,  quart_parfaite_rf    INTEGER CHECK (quart_parfaite_rf IS NULL OR quart_parfaite_rf >= 0),
  origine                TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref             TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Bois pour bâton magique (14, un par magie) : onglet Bâton magique › MATERIAUX NECESSAIRE PAR MAGIE (Bois : Matière, Description, Prix).
CREATE TABLE bois (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  magie_id      TEXT    NOT NULL UNIQUE REFERENCES magie(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Ingrédients d'alchimie (Google Doc « Alchimie » › Liste d'ingrédient : 5 tables Solvant, Essence, Amplificateur, Catalyseur, Stabilisateur).
CREATE TABLE ingredient_alchimie (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  categorie     TEXT    NOT NULL CHECK (categorie IN ('solvant', 'essence', 'amplificateur', 'catalyseur', 'stabilisateur')),
  type_brut     TEXT    NOT NULL,                     -- colonne « Type » : « Fruit (majeur) », « Minerai/Organe (majeur) », « Liquide »
  type          TEXT    NOT NULL,                     -- sans la mention « (majeur) » : « Fruit »
  majeur        INTEGER NOT NULL CHECK (majeur IN (0, 1)),   -- 1 si « (majeur) » : « utiles pour faire les potions ultimes » (sixième emplacement « Amplificateur majeur »)
  affinite_brut TEXT    NOT NULL,                     -- colonne « Affinité » : « Santé + Chakra »
  affinite_id   TEXT    NOT NULL REFERENCES affinite(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK (majeur = 0 OR categorie = 'amplificateur')
) STRICT;

CREATE INDEX ingredient_alchimie_aff ON ingredient_alchimie (affinite_id, categorie, majeur);

-- Potions (une ligne par palier : « Petite fiole rouge », « Grande huile givrante »…). Le prix est dans ressource.prix_*.
CREATE TABLE potion (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  famille       TEXT    NOT NULL CHECK (famille IN ('fiole', 'huile', 'philtre', 'remede', 'primitive')),   -- famille de la recette (solvant : Fiole, Huile, Philtre, Remède ; sans solvant : alchimie primitive)
  rang          INTEGER NOT NULL CHECK (rang >= 1),   -- rang du palier dans la page (1 = premier tableau Prix/Niveau/Effet)
  niveau_id     TEXT    NOT NULL REFERENCES niveau_alchimie(id),   -- colonne « Niveau »
  effet         TEXT    NOT NULL,                     -- colonne « Effet », lignes séparées par des retours à la ligne
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

CREATE INDEX potion_famille ON potion (famille, niveau_id);

-- État d'altération cité par l'effet d'une potion : « Inflige gel 1 » (huiles) ou « Réduit d'un cran la brûlure » (remèdes).
CREATE TABLE potion_etat (
  ressource_id  TEXT    NOT NULL REFERENCES ressource(id),
  etat_id       TEXT    NOT NULL REFERENCES etat(id),
  action        TEXT    NOT NULL CHECK (action IN ('inflige', 'reduit', 'soigne')),   -- « Inflige … », « Réduit … cran(s) », « Soigne totalement … »
  valeur        INTEGER CHECK (valeur IS NULL OR valeur >= 1),   -- niveau infligé (« gel 1 » -> 1) ou nombre de crans retirés (« deux crans » -> 2) ; NULL pour « Soigne totalement »
  texte         TEXT    NOT NULL,                     -- fragment de l'effet analysé
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (ressource_id, etat_id, action)
) STRICT, WITHOUT ROWID;

CREATE INDEX potion_etat_etat ON potion_etat (etat_id, action);

-- Kits d'alchimie du Doc (table « Kit d'alchimie | Prix | Permet … »). Les kits de l'onglet « Équipement inventaire » (MATOS FABRICATION)
-- ont d'autres noms et d'autres prix : ce sont d'autres ressources (genre 'materiel').
CREATE TABLE kit_alchimie (
  ressource_id  TEXT    NOT NULL PRIMARY KEY REFERENCES ressource(id),
  niveau_id     TEXT    NOT NULL REFERENCES niveau_alchimie(id),   -- niveau cité par « Permet … » : « Faire les recettes avancées ou moins » -> avance
  permet_brut   TEXT    NOT NULL,
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Types de fioles de verre du Doc (table « Type de fiole en verre | Niveau | Nombre d'ingrédient »).
CREATE TABLE fiole_verre (
  id                    TEXT    NOT NULL PRIMARY KEY, -- 'ressources/alchimie#fiole-verre:petite-fiole'
  nom                   TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),      -- « Petite fiole »
  niveau_brut           TEXT    NOT NULL,             -- « Novice », « Expert, Maître »
  nb_ingredients_brut   TEXT    NOT NULL,             -- « 2 ingrédients », « 5 ou plus ingrédients »
  nb_ingredients_min    INTEGER NOT NULL CHECK (nb_ingredients_min >= 1),   -- premier nombre du texte
  nb_ingredients_ou_plus INTEGER NOT NULL CHECK (nb_ingredients_ou_plus IN (0, 1)),   -- 1 si « ou plus »
  ordre                 INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine               TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref            TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Une recette = une façon d'obtenir un ou plusieurs produits.
--   genre 'materiau'      : « Fabrication (Pour obtenir une matière) » de l'onglet Armures (la table de l'onglet Bouclier est identique
--                           mot pour mot : pas de seconde ligne) ;
--   genre 'alchimie'      : table « Recette » d'une page de potions (une ligne de la table = une variante) ; `famille` obligatoire ;
--   genre 'baton_magique' : « 1 Gemme <qualité> + 1 bois [magie] » d'un niveau de bâton (onglet Bâton magique).
CREATE TABLE recette (
  id            TEXT    NOT NULL PRIMARY KEY,         -- alchimie : '<page>#recette:<slug nom>:<variante>' ; matériaux : '…#recette:materiau:<matière>' ; bâtons : '…#recette:<magie>:<niveau>'
  genre         TEXT    NOT NULL CHECK (genre IN ('materiau', 'alchimie', 'baton_magique')),
  famille       TEXT    CHECK (famille IN ('fiole', 'huile', 'philtre', 'remede', 'primitive')),
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- libellé de la source (titre de page ou de section, matière, « Sang › Niveau 1 »)
  variante      INTEGER CHECK (variante IS NULL OR variante >= 1),   -- alchimie : numéro de la ligne de la table « Recette » (1 s'il n'y en a qu'une) ; NULL pour les autres genres
  page_id       TEXT    NOT NULL REFERENCES page(id),
  texte_brut    TEXT,                                 -- recette telle qu'écrite quand c'est une phrase (« 10 minerais de fer + 1 charbon + Bas Fourneau »)
  produit_brut  TEXT,                                 -- produit tel qu'écrit quand il n'a pas de ligne ressource (« Bâton élémentaire vierge »)
  test_brut     TEXT,                                 -- test d'artisanat écrit pour CETTE recette : « Test de Volonté + Intelligence » ; NULL si la source le rattache au métier
  test_carac_1_id TEXT  REFERENCES caracteristique(id),
  test_carac_2_id TEXT  REFERENCES caracteristique(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((genre = 'alchimie') = (famille IS NOT NULL)),
  CHECK ((test_carac_1_id IS NULL) = (test_carac_2_id IS NULL)),
  CHECK (test_carac_1_id IS NULL OR test_brut IS NOT NULL)
) STRICT;

CREATE INDEX recette_genre ON recette (genre, famille);

CREATE INDEX recette_page  ON recette (page_id);

-- Produits d'une recette (une page de potions : tous les paliers Petite … Ultime ; un matériau : lui-même).
CREATE TABLE recette_produit (
  recette_id    TEXT    NOT NULL REFERENCES recette(id) ON DELETE CASCADE,
  ressource_id  TEXT    NOT NULL REFERENCES ressource(id),
  ordre         INTEGER NOT NULL CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (recette_id, ressource_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX recette_produit_ressource ON recette_produit (ressource_id);

-- Éléments d'une recette. `rang` = position (emplacement d'alchimie, ou terme séparé par « + » d'une phrase) ; `option` = alternative
-- (« A ou B » : une ligne par option, comme classe_objet_depart). Deux formes, exclusives :
--   * ressource_id : un élément nommé (« 10 minerais de fer », « Herbe rouge (Ingrédient précis) », « 1 gemme commune ») ;
--   * affinite_id  : exigence d'un emplacement d'alchimie (« Essence : Santé ») : n'importe quel ingrédient de la catégorie et de
--                    l'affinité (vue v_ingredient_possible).
-- Alchimie : « Chaque ingrédient indiqué dans une recette représente deux unités de cet ingrédient » (règle du Doc, non recopiée
-- dans chaque ligne : quantite NULL).
CREATE TABLE recette_ingredient (
  recette_id    TEXT    NOT NULL REFERENCES recette(id) ON DELETE CASCADE,
  rang          INTEGER NOT NULL CHECK (rang >= 1),
  option        INTEGER NOT NULL CHECK (option >= 1),
  texte         TEXT    NOT NULL,                     -- fragment exact de la source
  role          TEXT    CHECK (role IN ('solvant', 'essence', 'amplificateur', 'catalyseur', 'stabilisateur', 'amplificateur_majeur')),
  emplacement   TEXT,                                 -- en-tête de colonne tel qu'écrit (« Amplificateur 1 », « Amplificateur majeur ») ; alchimie seulement
  quantite      INTEGER CHECK (quantite IS NULL OR quantite >= 1),   -- « 10 » de « 10 minerais de fer » ; NULL si aucun nombre n'est écrit (« Bas Fourneau »)
  unite         TEXT    CHECK (unite IN ('L', 'kg')),                -- « 2L acide » -> 2, 'L'
  qualite       TEXT    CHECK (qualite IN ('commune', 'raffinee', 'parfaite')),   -- gemmes des bâtons
  ressource_id  TEXT    REFERENCES ressource(id),
  affinite_id   TEXT    REFERENCES affinite(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (recette_id, rang, option),
  CHECK ((ressource_id IS NULL) <> (affinite_id IS NULL)),
  CHECK (affinite_id IS NULL OR role IS NOT NULL OR emplacement IS NOT NULL)
) STRICT, WITHOUT ROWID;

CREATE INDEX recette_ingredient_ressource ON recette_ingredient (ressource_id) WHERE ressource_id IS NOT NULL;

CREATE INDEX recette_ingredient_affinite  ON recette_ingredient (affinite_id, role) WHERE affinite_id IS NOT NULL;

-- Bâtons magiques (onglet Bâton magique › « Bonus passifs » : 14 magies x 3 niveaux). La source ne leur donne pas de nom propre.
CREATE TABLE baton_magique (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'ressources/baton-magique#baton:feu:2'
  magie_id      TEXT    NOT NULL REFERENCES magie(id),
  niveau        INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 3),
  bonus_brut    TEXT    NOT NULL,                     -- « Dégâts sort +6 », « ampli am = +2 am donné⏎protection = +5 dégâts bloqué »
  recette_id    TEXT    NOT NULL UNIQUE REFERENCES recette(id),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (magie_id, niveau)
) STRICT;

-- Métiers (Google Doc « MÉTIER » : une page par métier, 72). `bonus_brut`, `artisanat_brut`, `equipement_brut`, `avantage_brut` sont les
-- quatre champs de la page, tels qu'écrits (liens [[…]] et échappements Markdown retirés).
CREATE TABLE metier (
  id                 TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- id de la page : 'metiers/forgeron'
  nom                TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),         -- titre de la page : « Éleveur (choix animal) »
  nom_cle            TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),         -- normalize(nom)
  description        TEXT    NOT NULL,                -- « Description du métier »
  bonus_brut         TEXT    NOT NULL,                -- « Bonus » : « +3% Arme lourde OU Arme légère »
  artisanat_brut     TEXT    NOT NULL,                -- « Artisanat possible » entier : « Peut faire des armes métalliques [FORCE  + VOLONTÉ] »
  peut_fabriquer     INTEGER NOT NULL CHECK (peut_fabriquer IN (0, 1)),   -- 0 si « Artisanat possible : Rien »
  artisanat_texte    TEXT,                            -- partie avant le crochet : « Peut faire des armes métalliques » ; NULL si « Rien »
  test_brut          TEXT,                            -- contenu du crochet : « FORCE  + VOLONTÉ », « PERCEPTION x2 », « Artisanat SOCIAL + INTELLIGENCE » ; NULL si aucun
  test_carac_1_id    TEXT    REFERENCES caracteristique(id),   -- renseignées seulement pour la forme exacte « CARAC + CARAC »
  test_carac_2_id    TEXT    REFERENCES caracteristique(id),
  equipement_brut    TEXT    NOT NULL,                -- « Équipement supplémentaire possible » : « Kit de réparation d'arme, Maillet en fer » ; « Rien »
  avantage_brut      TEXT,                            -- « Avantage possible » ; NULL si vide (Artisan)
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((test_carac_1_id IS NULL) = (test_carac_2_id IS NULL)),
  CHECK (test_carac_1_id IS NULL OR test_brut IS NOT NULL),
  CHECK ((peut_fabriquer = 0) = (artisanat_texte IS NULL))
) STRICT;

CREATE INDEX metier_peut_fabriquer ON metier (peut_fabriquer);

-- Bonus d'un métier : le champ « Bonus » découpé sur les virgules suivies d'un signe (« +3% Esquive, +3% Réflexe » -> 2 rangs ;
-- « Diplomatie OU Intimidation » -> 2 options du même rang). `valeur`/`unite`/`cible` ne sont renseignés que pour la forme
-- « +N% Cible » ou « +N Cible » ; tout autre fragment garde son texte et valeur NULL. `cible_cle` = normalize(cible) : se joint aux
-- compétences et attributs du domaine fiche par nom, sans clé étrangère entre domaines.
CREATE TABLE metier_bonus (
  metier_id   TEXT    NOT NULL REFERENCES metier(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  option      INTEGER NOT NULL CHECK (option >= 1),
  texte       TEXT    NOT NULL,                       -- fragment exact
  valeur      INTEGER,                                -- 3 de « +3% Esquive »
  unite       TEXT    CHECK (unite IN ('%')),         -- '%' si le nombre est suivi de « % » ; NULL sinon (« +1 INI »)
  cible       TEXT,                                   -- « Esquive », « Arme lourde », « INI »
  cible_cle   TEXT CHECK (cible_cle IS NULL OR (cible_cle NOT GLOB '*[^a-z0-9-]*' AND cible_cle NOT GLOB '*--*' AND cible_cle NOT GLOB '-*' AND cible_cle NOT GLOB '*-')),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (metier_id, rang, option),
  CHECK ((valeur IS NULL) = (cible IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX metier_bonus_cible ON metier_bonus (cible_cle) WHERE cible_cle IS NOT NULL;

-- Familles de recettes qu'un métier dit pouvoir fabriquer : le champ « Artisanat possible » cite « fioles », « philtres », « remèdes »,
-- « huiles », « alchimie primitive ». Seuls ces cinq mots désignent une famille de recettes de la base ; les autres artisanats
-- (« armes métalliques », « lingots »…) restent dans metier.artisanat_texte.
CREATE TABLE metier_recette_famille (
  metier_id   TEXT    NOT NULL REFERENCES metier(id),
  famille     TEXT    NOT NULL CHECK (famille IN ('fiole', 'huile', 'philtre', 'remede', 'primitive')),
  mot_source  TEXT    NOT NULL,                       -- mot repéré dans le champ : « fioles », « alchimie primitive »
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (metier_id, famille)
) STRICT, WITHOUT ROWID;

CREATE INDEX metier_recette_famille_famille ON metier_recette_famille (famille);

-- Une ligne par arme listée (161 : 147 + 14 armes de monstres). Les colonnes typées sont extraites des clauses du texte d'effet
-- (séparées par des virgules ou des retours à la ligne) ; une clause qui n'a pas exactement la forme attendue n'est pas interprétée
-- (« +4 dégâts estoc » n'est PAS un bonus de dégâts : il ne vaut que pour l'estoc). Effet à plusieurs modes (« Ouvert = … » / « Fermé = … »,
-- « Une main = … » / « Deux main = … ») : une valeur n'est retenue que si TOUS les modes la donnent (Éventail : NULL, écart consigné).
-- L'effet complet reste dans `effet`.
CREATE TABLE arme (
  id               TEXT    NOT NULL PRIMARY KEY,      -- 'ressources/armes#arme:<famille>:<slug du nom>'
  famille_id       TEXT    NOT NULL REFERENCES arme_famille(id),   -- bandeau sous lequel la ligne est écrite
  type_id          TEXT    NOT NULL REFERENCES arme_type(id),      -- 1re ligne de la cellule Catégorie (« Épée »)
  nom              TEXT    NOT NULL CHECK (length(nom) > 0),                  -- cellule Nom sans la mention de mains : « Flamberge »
  nom_cle          TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  nom_brut         TEXT    NOT NULL,                  -- cellule Nom entière : « Flamberge⏎(deux mains) »
  mains            TEXT    CHECK (mains IN ('une', 'deux', 'une_ou_deux')),   -- « (une main) », « (deux mains) », « (une ou deux mains) » ; NULL si non écrit
  categorie_brut   TEXT    NOT NULL,                  -- cellule Catégorie entière : « Épée⏎Arme Lourde »
  competence_brut  TEXT,                              -- 2e ligne de la Catégorie : « Arme Lourde », « Arme Lourde/Légère », « Arc », « Arc / Arme Légère »
  cout_brut        TEXT,                              -- colonne « Coût » / « Coût en plus/moins » : « 10 Ro » ; NULL pour les armes de monstres
  cout_ro          INTEGER CHECK (cout_ro IS NULL OR cout_ro >= 0),   -- N de « N Ro »
  effet            TEXT,                              -- colonne « Effet » entière ; NULL pour les armes de monstres
  description      TEXT,                              -- colonne « Description »
  de               TEXT    CHECK (de IS NULL OR de GLOB 'D[0-9]*'),   -- dé de l'arme : « D8 au lieu du D10 » / « tape dans le D6 » de l'effet, sinon dé du type ; NULL pour le Pugilat (selon la Force)
  de_faces         INTEGER CHECK (de_faces IS NULL OR de_faces >= 2),
  de_source        TEXT    CHECK (de_source IN ('effet', 'type')),
  portee_min       INTEGER CHECK (portee_min IS NULL OR portee_min >= 0),   -- portée ÉCRITE dans l'effet (« 1 - 7 portée », « portée 1-2 », « la portée est de 2-3 ») ; NULL = non écrite : voir v_arme
  portee_max       INTEGER,
  bonus_degats     INTEGER,                           -- clause « +N dégâts » / « -N dégâts » ; NULL si absente (la fiche compte 0)
  ignore_ap        INTEGER CHECK (ignore_ap IS NULL OR ignore_ap >= 0),     -- clause « ignore N AP » (« ignore N PA » dans la source) ; NULL si absente ou conditionnelle
  recharge         TEXT    CHECK (recharge IN ('longue', 'tres_longue')),
  solidite_fixee   INTEGER,                           -- « 1 seul cran / point de solidité » -> 1 (les armes ont 2 crans de base, règle générale de l'onglet)
  solidite_delta   INTEGER,                           -- « -1 cran de solidité » / « +1 cran de solidité »
  provenance_mot   TEXT    CHECK (provenance_mot IN ('Origine', 'Facture')),    -- « Origine Majin » / « Facture Fenrir »
  provenance       TEXT,                              -- « Majin », « Temple du Sang », « inconnue »
  depart_possible  INTEGER NOT NULL CHECK (depart_possible IN (0, 1)),   -- 1 : nom sur fond bleu dans la source (« Les armes en bleu sont les armes possible en arme de départ »)
  ordre            INTEGER NOT NULL CHECK (ordre >= 1),   -- rang dans le bandeau
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (famille_id, nom_cle),
  CHECK ((de IS NULL) = (de_source IS NULL)),
  CHECK ((de IS NULL) = (de_faces IS NULL)),
  CHECK ((portee_min IS NULL) = (portee_max IS NULL)),
  CHECK (portee_max IS NULL OR portee_max >= portee_min),
  CHECK ((provenance_mot IS NULL) = (provenance IS NULL))
) STRICT;

CREATE INDEX arme_type_bonus ON arme (type_id, bonus_degats);

CREATE INDEX arme_famille_ordre ON arme (famille_id, ordre);

CREATE INDEX arme_nom_cle    ON arme (nom_cle);

CREATE INDEX arme_cout       ON arme (cout_ro) WHERE cout_ro IS NOT NULL;

-- Types de dégâts de l'arme : première clause « Dégâts taille/estoc » (ou « dégâts de frappe » des bombes) -> 1 ligne par type.
-- Les armes dont la clause n'a pas la forme attendue ou dont les modes divergent (Éventail : taille ouvert, estoc fermé) n'ont pas de ligne.
CREATE TABLE arme_degats (
  arme_id       TEXT    NOT NULL REFERENCES arme(id),
  type_degats   TEXT    NOT NULL CHECK (type_degats IN ('taille', 'estoc', 'frappe')),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (arme_id, type_degats)
) STRICT, WITHOUT ROWID;

CREATE INDEX arme_degats_type ON arme_degats (type_degats);

-- Minimums de caractéristique cités par l'effet : « 4 de Force minimum », « 3 de Force et Agilité minimum », « 5 d'Agilité obligatoire ».
-- Pas de ligne = aucun minimum écrit (la fiche compte 1). Pour 5 armes la fiche lit 1 en Agilité alors que le texte dit 2 à 5 :
-- la valeur du texte est conservée, l'écart est dans ecart_source.
CREATE TABLE arme_prerequis (
  arme_id             TEXT    NOT NULL REFERENCES arme(id),
  caracteristique_id  TEXT    NOT NULL REFERENCES caracteristique(id),
  minimum             INTEGER NOT NULL CHECK (minimum >= 1),
  exigence            TEXT    CHECK (exigence IN ('minimum', 'obligatoire', 'nécessaire')),   -- mot écrit après la caractéristique ; NULL si aucun
  texte               TEXT    NOT NULL,               -- clause exacte
  origine             TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref          TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (arme_id, caracteristique_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX arme_prerequis_carac ON arme_prerequis (caracteristique_id, minimum);

-- Armes élémentaires (onglet Pièces élémentaires : 11 types d'armes x 14 éléments). La cellule contient 4 lignes :
-- nom / « +8 Dégâts » / « Élément X » / capacité « Nom (mode) : texte ».
CREATE TABLE arme_elementaire (
  id               TEXT    NOT NULL PRIMARY KEY,      -- 'ressources/pieces-elementaires#arme-elementaire:epee:sang'
  type_id          TEXT    NOT NULL REFERENCES arme_type(id),
  magie_id         TEXT    NOT NULL REFERENCES magie(id),   -- élément (en-tête de colonne SANG, ARCANE, … LUMIERE)
  colonne_brut     TEXT    NOT NULL,                  -- en-tête de colonne tel qu'écrit : « LUMIERE », « NÉCROMANCIE »
  nom              TEXT    NOT NULL CHECK (length(nom) > 0),                  -- « Épée de Sang »
  bonus_degats     INTEGER NOT NULL,                  -- 8 de « +8 Dégâts »
  element_brut     TEXT    NOT NULL,                  -- « Élément Sang », « Élément Nécomancie » (coquille conservée)
  capacite_nom     TEXT,                              -- « Sang explosif »
  capacite_mode    TEXT    CHECK (capacite_mode IN ('actif', 'passif', 'action')),   -- mot entre parenthèses
  capacite_texte   TEXT,
  capacite_brut    TEXT    NOT NULL,                  -- 4e ligne entière
  ordre            INTEGER NOT NULL CHECK (ordre >= 1),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (type_id, magie_id)
) STRICT;

CREATE INDEX arme_elementaire_magie ON arme_elementaire (magie_id);

-- Emplacements d'armure = onglet Armures › FABRICATION (« Armure | Coût ») : Armure Complète, Casque, Torse, Bras Gauche, Bras Droit,
-- Jambe Gauche, Jambe Droit (coquille de la source), Bouclier. La source ne donne pas d'AP/AM par emplacement : une armure a UNE valeur
-- (la fiche la recopie sur les six pièces) ; seul le coût de fabrication varie par pièce.
CREATE TABLE armure_emplacement (
  id          TEXT    NOT NULL PRIMARY KEY,           -- 'armure-complete', 'casque', 'torse', 'bras-gauche', 'bras-droit', 'jambe-gauche', 'jambe-droit', 'bouclier'
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                -- tel qu'écrit : « Jambe Droit »
  cout_brut   TEXT    NOT NULL,                       -- « 150 RF / 1,5 RO », « 250 RF / Classe »
  cout_rf     INTEGER CHECK (cout_rf IS NULL OR cout_rf >= 0),   -- NULL pour « 250 RF / Classe » (dépend de la classe)
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Armures : 231 combinaisons de deux matières (grille matière x matière de l'onglet Armures) + 11 armures particulières
-- (vêtements, cottes de mailles, armure montagne, armures de familiers).
CREATE TABLE armure (
  id               TEXT    NOT NULL PRIMARY KEY,      -- 'ressources/armures#armure:peau-peau', '…#armure:cuir-peau', '…#armure:tenue-du-flagelleur'
  sorte            TEXT    NOT NULL CHECK (sorte IN ('combinaison', 'particuliere')),
  nom              TEXT    NOT NULL CHECK (length(nom) > 0),                  -- « Armure Cuir/Peau », « Cotte de maille (Fer) »
  nom_cle          TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  materiau_ligne_id    TEXT REFERENCES ressource(id), -- combinaison : matière en tête de ligne de la grille
  materiau_colonne_id  TEXT REFERENCES ressource(id), -- combinaison : matière en tête de colonne
  type             TEXT    NOT NULL CHECK (type IN ('Vêtement', 'Léger', 'Intermédiaire', 'Lourd', 'Familier')),
  prix             REAL    CHECK (prix IS NULL OR prix >= 0),   -- « Prix : 2 050 » -> 2050.0 ; « ???? » -> NULL ; unité non écrite
  prix_brut        TEXT,
  stats_brut       TEXT    NOT NULL,                  -- « +10AP +14AM », « Aucune »
  ap               INTEGER,                           -- N de « +NAP » ; NULL si AP n'est pas écrit (« Aucune » aussi) : la fiche compte 0
  am               INTEGER,
  solidite         INTEGER NOT NULL CHECK (solidite >= 0),
  solidite_uni     INTEGER CHECK (solidite_uni IN (1)),   -- 1 pour « Solidité uni : N » (« Si un cran de solidité est perdu, c'est TOUTE l'armure qui est abîmée ») ; NULL pour « Solidité : N »
  resistance_brut  TEXT,                              -- « x2 Frappe », « Taille » ; NULL pour les armures particulières
  faiblesse_brut   TEXT,
  effet            TEXT,                              -- « Effet : … » des armures particulières (« Aucun », « Rien » conservés)
  ordre            INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((sorte = 'combinaison') = (materiau_ligne_id IS NOT NULL)),
  CHECK ((sorte = 'combinaison') = (materiau_colonne_id IS NOT NULL))
) STRICT;

CREATE INDEX armure_type        ON armure (type);

CREATE INDEX armure_ap_am       ON armure (ap, am);

CREATE INDEX armure_nom_cle     ON armure (nom_cle);

CREATE INDEX armure_materiaux   ON armure (materiau_ligne_id, materiau_colonne_id) WHERE materiau_ligne_id IS NOT NULL;

-- Résistances et faiblesses d'une armure : « Résistance : x2 Frappe », « Faiblesse : Estoc/Frappe » -> une ligne par type de dégâts.
-- Le sens de « x2 » n'est pas défini par la source : le multiplicateur est conservé tel quel.
CREATE TABLE armure_degats (
  armure_id       TEXT    NOT NULL REFERENCES armure(id),
  sens            TEXT    NOT NULL CHECK (sens IN ('resistance', 'vulnerabilite')),   -- même vocabulaire que magie_resistance
  sens_brut       TEXT    NOT NULL,                       -- « Résistance » / « Faiblesse » tel qu'écrit dans la fiche d'armure
  type_degats     TEXT    NOT NULL CHECK (type_degats IN ('taille', 'estoc', 'frappe')),
  multiplicateur  INTEGER CHECK (multiplicateur IS NULL OR multiplicateur >= 2),   -- 2 de « x2 » ; NULL si non écrit
  origine         TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (armure_id, sens, type_degats)
) STRICT, WITHOUT ROWID;

CREATE INDEX armure_degats_type ON armure_degats (sens, type_degats);

-- Armures élémentaires (onglet Pièces élémentaires : 4 catégories x 14 éléments = 56) : vêtement, armure légère, intermédiaire, lourde.
CREATE TABLE armure_elementaire (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'ressources/pieces-elementaires#armure-elementaire:leger:sang'
  categorie     TEXT    NOT NULL CHECK (categorie IN ('Vêtement', 'Léger', 'Intermédiaire', 'Lourd')),
  magie_id      TEXT    NOT NULL REFERENCES magie(id),
  colonne_brut  TEXT    NOT NULL,
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- « Garde coeur », « Tissu du saigneur »
  ap            INTEGER CHECK (ap IS NULL OR ap >= 0),   -- « 7.0 » -> 7
  am            INTEGER CHECK (am IS NULL OR am >= 0),
  effets_brut   TEXT    NOT NULL,                     -- cellule « Effet(s) » entière (lignes « - … »)
  ordre         INTEGER NOT NULL CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (categorie, magie_id)
) STRICT;

CREATE INDEX armure_elementaire_magie ON armure_elementaire (magie_id);

CREATE TABLE armure_elementaire_effet (
  armure_elementaire_id  TEXT    NOT NULL REFERENCES armure_elementaire(id),
  rang                  INTEGER NOT NULL CHECK (rang >= 1),
  texte                  TEXT    NOT NULL,            -- une ligne « - … » sans le tiret
  origine                TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref             TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (armure_elementaire_id, rang)
) STRICT, WITHOUT ROWID;

-- Classes de boucliers (onglet Bouclier › « Classes de boucliers » : Bocle, Targe, Bouclier Rond, Écu, Pavoi).
CREATE TABLE bouclier_classe (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'bocle', 'targe', 'bouclier-rond', 'ecu', 'pavoi'
  nom           TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),
  classe        INTEGER NOT NULL UNIQUE CHECK (classe BETWEEN 1 AND 5),   -- « Catégorie : Classe 4 » : un bouclier de classe 4 demande 4 matériaux
  prix          REAL    NOT NULL CHECK (prix >= 0),   -- « Prix : 2,5 » (unité non écrite ; « Coût (RO) : 2,5 / Classe » dans FABRICATION)
  prix_brut     TEXT    NOT NULL,
  categorie_brut TEXT   NOT NULL,
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Poids de boucliers (onglet Bouclier, liste « Léger / Moyen / Lourd / Très lourd » sous la mention « A refaire » : « il est necessaire d'avoir le score de Force ou plus »).
CREATE TABLE bouclier_poids (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'leger', 'moyen', 'lourd', 'tres-lourd'
  nom           TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),
  force_min     INTEGER NOT NULL CHECK (force_min >= 1),
  force_brut    TEXT    NOT NULL,                     -- « 1 de Force minimum »
  ordre         INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Boucliers préfabriqués (100 : 5 classes x 20 matériaux). La source ne relie pas les poids aux classes : aucun lien n'est déduit.
CREATE TABLE bouclier (
  id            TEXT    NOT NULL PRIMARY KEY,         -- 'ressources/bouclier#bouclier:ecu:fer-noir'
  classe_id     TEXT    NOT NULL REFERENCES bouclier_classe(id),
  materiau_id   TEXT    NOT NULL REFERENCES ressource(id),
  nom           TEXT    NOT NULL CHECK (length(nom) > 0),                     -- « Bocle Corne » (sic : la matière s'écrit Corne/Os ailleurs)
  prix          REAL    CHECK (prix IS NULL OR prix >= 0),   -- NULL si « Prix : » est vide (Bouclier Rond Argent)
  prix_brut     TEXT,
  defense_brut  TEXT    NOT NULL,                     -- « +20AP +25AM »
  ap            INTEGER,
  am            INTEGER,
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (classe_id, materiau_id)
) STRICT;

CREATE INDEX bouclier_materiau ON bouclier (materiau_id);

CREATE INDEX bouclier_ap_am    ON bouclier (ap, am);

-- Améliorations (+1 à +10) : armes (Armes), armures (Armures), boucliers (Bouclier), armes et armures élémentaires (Pièces élémentaires).
-- Les coûts sont écrits « 20 RO », « 1 Matériel + 50 RO », « 100 + 1 Matériau », « 100.0 », « 2 gemmes communes », « 1 pièce élémentaire »,
-- les effets « +2 dégâts », « +10 dégâts, +1 cran de solidité », « +4 AP/AM », « +2 AP, +1 cran de solidité ».
CREATE TABLE amelioration_equipement (
  id                     TEXT    NOT NULL PRIMARY KEY,   -- '<page>#amelioration:<cible>:<niveau>'
  cible                  TEXT    NOT NULL CHECK (cible IN ('arme', 'armure', 'bouclier', 'arme_elementaire', 'armure_elementaire')),
  niveau                 INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 10),
  cout_brut              TEXT    NOT NULL,
  cout_ro                INTEGER CHECK (cout_ro IS NULL OR cout_ro >= 0),    -- montant en RO écrit dans le coût ; NULL si le coût n'en contient pas
  cout_materiaux         INTEGER CHECK (cout_materiaux IS NULL OR cout_materiaux >= 1),   -- nombre de « Matériel(s) » / « Matériau(x) »
  cout_gemmes            INTEGER CHECK (cout_gemmes IS NULL OR cout_gemmes >= 1),
  cout_gemmes_qualite    TEXT    CHECK (cout_gemmes_qualite IN ('commune', 'raffinee', 'parfaite')),
  cout_pieces_elementaires INTEGER CHECK (cout_pieces_elementaires IS NULL OR cout_pieces_elementaires >= 1),
  effet_brut             TEXT    NOT NULL,
  bonus_degats           INTEGER,
  bonus_ap               INTEGER,
  bonus_am               INTEGER,
  bonus_cran             INTEGER,                        -- crans de solidité gagnés (« +2 cran de solidité » -> 2)
  page_id                TEXT    NOT NULL REFERENCES page(id),
  origine                TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref             TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (cible, niveau),
  CHECK ((cout_gemmes IS NULL) = (cout_gemmes_qualite IS NULL))
) STRICT;

-- Ligne « TOTAL » de chaque tableau d'améliorations, telle qu'écrite (« 5 matériaux + 1520 RO ») ; celui des armures élémentaires est vide dans la source.
CREATE TABLE amelioration_total (
  cible       TEXT    NOT NULL PRIMARY KEY CHECK (cible IN ('arme', 'armure', 'bouclier', 'arme_elementaire', 'armure_elementaire')),
  total_brut  TEXT,
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Étape 1 de la création (1d4) : emplacement de l'accessoire.
CREATE TABLE accessoire_emplacement (
  id          TEXT    NOT NULL PRIMARY KEY,           -- 'tete', 'collier', 'anneau', 'bracelet'
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                -- « Tête », « Collier », « Anneau », « Bracelet »
  jet         INTEGER NOT NULL UNIQUE CHECK (jet BETWEEN 1 AND 4),   -- résultat du 1d4
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Étape 2 (1d100) : propriété de l'accessoire. 8 plages : 1-5 Caractéristique, 6-20 Compétence, 21-35 Attributs, 36-50 Attaque,
-- 51-66 Défense, 67-80 Jet de dé, 81-95 Autre, 96-100 Malédiction.
CREATE TABLE accessoire_propriete (
  id          TEXT    NOT NULL PRIMARY KEY,           -- 'caracteristique', 'competence', 'attributs', 'attaque', 'defense', 'jet-de-de', 'autre', 'malediction'
  nom         TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),                -- « Caractéristique », « Jet de dé »
  jet_min     INTEGER NOT NULL CHECK (jet_min BETWEEN 1 AND 100),
  jet_max     INTEGER NOT NULL CHECK (jet_max BETWEEN jet_min AND 100),
  ordre       INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
) STRICT;

-- Étape 3 : effets possibles, par propriété (« SI CARACTERISTIQUE / COMPETENCE / ATTRIBUTS / ATTAQUE / DÉFENSE / JET DE DÉS / AUTRE »).
-- Caractéristique : 6 lignes (1d6). Compétence : 6 caractéristiques x 4 niveaux (1d6 puis 1d20 « bonus d'acquis » 1-5 %, 6-10 %…).
-- Autres : 20 lignes (1d20), dont la ligne « MALÉDICTION » (jet 10) et quelques lignes vides.
CREATE TABLE accessoire_effet (
  id                   TEXT    NOT NULL PRIMARY KEY,  -- 'ressources/accessoires#effet:attributs:5', '…#effet:caracteristique:force', '…#effet:competence:force:2'
  propriete_id         TEXT    NOT NULL REFERENCES accessoire_propriete(id),
  jet                  INTEGER NOT NULL CHECK (jet >= 1),   -- résultat du dé de la table (1d6 ou 1d20)
  libelle              TEXT,                          -- cellule « Effet » : « +25 Santé », « Force », « Compétence F » ; NULL si la ligne est vide dans la source
  caracteristique_id   TEXT    REFERENCES caracteristique(id),   -- propriétés Caractéristique et Compétence : caractéristique tirée au 1d6
  niveau               INTEGER CHECK (niveau IS NULL OR niveau BETWEEN 1 AND 5),   -- « Niveau 4 » -> 4 ; NULL si « Niveau ? » ou vide
  niveau_brut          TEXT,
  bonus_min            INTEGER,                       -- compétence : « 6% -10% » -> 6
  bonus_max            INTEGER,                       -- compétence : -> 10
  gemmes_brut          TEXT,                          -- « Grenat + Malachite », « Onix + Grenat/Malachite » ; NULL si vide
  prix_brut            TEXT,                          -- « 189 Ro », « A calculer », « ? »
  prix_ro              INTEGER CHECK (prix_ro IS NULL OR prix_ro >= 0),   -- N de « N Ro » ; NULL pour « A calculer » / « ? »
  malediction          INTEGER NOT NULL CHECK (malediction IN (0, 1)),   -- 1 pour la ligne « MALÉDICTION »
  bonus_valeur         INTEGER,                       -- Attributs : N de « +N Santé / Barrière / Chakra / Initiative / Vitesse »
  bonus_cible          TEXT    CHECK (bonus_cible IN ('Santé', 'Barrière', 'Chakra', 'Initiative', 'Vitesse')),
  ordre                INTEGER NOT NULL CHECK (ordre >= 1),
  origine              TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref           TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((bonus_valeur IS NULL) = (bonus_cible IS NULL)),
  CHECK ((bonus_min IS NULL) = (bonus_max IS NULL)),
  -- identifiant : l'entier final est une valeur ÉCRITE dans la source, pas un rang (insérer une ligne ne le décale pas) : résultat du dé (colonne « Jet »),
  -- « Niveau N » pour une compétence, caractéristique pour la propriété Caractéristique
  CHECK (substr(id, instr(id, '#effet:') + 7, length(propriete_id) + 1) = propriete_id || ':'),
  CHECK (CASE propriete_id WHEN 'caracteristique' THEN caracteristique_id IS NOT NULL AND id LIKE '%:' || caracteristique_id
                           WHEN 'competence' THEN caracteristique_id IS NOT NULL AND niveau IS NOT NULL AND id LIKE '%:' || caracteristique_id || ':' || niveau
                           ELSE id LIKE '%:' || jet END)
) STRICT;

CREATE UNIQUE INDEX accessoire_effet_cle ON accessoire_effet (propriete_id, COALESCE(caracteristique_id, ''), jet, COALESCE(niveau, 0));

CREATE INDEX accessoire_effet_propriete ON accessoire_effet (propriete_id, jet);

CREATE INDEX accessoire_effet_carac     ON accessoire_effet (caracteristique_id) WHERE caracteristique_id IS NOT NULL;

CREATE INDEX accessoire_effet_bonus     ON accessoire_effet (bonus_cible, bonus_valeur) WHERE bonus_cible IS NOT NULL;

-- Gemmes d'un effet d'accessoire (« Grenat + Malachite » : 2 rangs ; « Grenat/Malachite » ou « Turquoise ou + Perle ou … » : options d'un même rang).
-- `nom_source` = écriture de la source ; les coquilles (Gyspe, Emmeraude, Diament rose, Onyx) sont rapprochées du nom de gemme
-- (liste fermée du chargeur, chaque rapprochement est dans ecart_source).
CREATE TABLE accessoire_effet_gemme (
  effet_id     TEXT    NOT NULL REFERENCES accessoire_effet(id),
  rang         INTEGER NOT NULL CHECK (rang >= 1),
  option       INTEGER NOT NULL CHECK (option >= 1),
  gemme_id     TEXT    NOT NULL REFERENCES ressource(id),
  nom_source   TEXT    NOT NULL,
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (effet_id, rang, option)
) STRICT, WITHOUT ROWID;

CREATE INDEX accessoire_effet_gemme_gemme ON accessoire_effet_gemme (gemme_id);

-- Montures d'accessoires (onglet Accessoires › Monture : 5 niveaux ; « Un lingot permet de faire 2 montures d'anneau, 2 de collier… »).
CREATE TABLE accessoire_monture (
  niveau        INTEGER NOT NULL PRIMARY KEY CHECK (niveau BETWEEN 1 AND 5),
  materiau_id   TEXT    NOT NULL REFERENCES ressource(id),   -- « Fer », « Argent », « Bronze », « Or », « Mythril »
  prix_brut     TEXT    NOT NULL,                     -- « 5 Ro »
  prix_ro       INTEGER CHECK (prix_ro IS NULL OR prix_ro >= 0),
  effet_brut    TEXT    NOT NULL,                     -- « Petit effet » … « Effet suprème »
  origine       TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

-- Familiers (onglet Familiers : petits familiers, gros familiers, montures).
CREATE TABLE familier (
  id           TEXT    NOT NULL PRIMARY KEY,          -- 'ressources/familiers#familier:petit:chat'
  categorie    TEXT    NOT NULL CHECK (categorie IN ('petit', 'gros', 'monture')),
  nom          TEXT    NOT NULL CHECK (length(nom) > 0),
  nom_cle      TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  effet_brut   TEXT,                                  -- colonne « Effet » (petits familiers seulement) entière
  description  TEXT    NOT NULL,
  ordre        INTEGER NOT NULL CHECK (ordre >= 1),
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (categorie, nom_cle)
) STRICT;

CREATE INDEX familier_nom_cle ON familier (nom_cle);

-- Effets d'un petit familier : une ligne « - … » de la cellule « Effet » = une ligne.
CREATE TABLE familier_effet (
  familier_id  TEXT    NOT NULL REFERENCES familier(id),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  texte        TEXT    NOT NULL,                      -- sans le tiret : « +5% Vie en nature »
  origine      TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (familier_id, rang)
) STRICT, WITHOUT ROWID;

-- Bâtiments standard (onglet Maison › BATIMENT STANDARD). Les matériaux de construction (Bois, Pierre, Brique) sont des ressources
-- (genre 'materiau_construction').
CREATE TABLE batiment (
  id               TEXT    NOT NULL PRIMARY KEY,      -- 'ressources/maison#batiment:manoir'
  nom              TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),
  surface_brut     TEXT    NOT NULL,                  -- « 600 mètres² »
  surface_m2       INTEGER CHECK (surface_m2 IS NULL OR surface_m2 > 0),
  materiaux_brut   TEXT    NOT NULL,                  -- « 80 000 kg »
  materiaux_kg     INTEGER CHECK (materiaux_kg IS NULL OR materiaux_kg > 0),
  prix_brut        TEXT    NOT NULL,                  -- « 40 000 - 50 000 Ro »
  prix_min_ro      INTEGER CHECK (prix_min_ro IS NULL OR prix_min_ro >= 0),
  prix_max_ro      INTEGER CHECK (prix_max_ro IS NULL OR prix_max_ro >= 0),
  description      TEXT    NOT NULL,
  ordre            INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),
  origine          TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  CHECK ((prix_min_ro IS NULL) = (prix_max_ro IS NULL)),
  CHECK (prix_max_ro IS NULL OR prix_max_ro >= prix_min_ro)
) STRICT;

-- Machines de guerre et de siège (onglet « Machine de GuerreSiège » : ATTAQUE AU SOL, ATTAQUE AU MUR, DEFENSE AU SOL).
CREATE TABLE machine_guerre (
  id             TEXT    NOT NULL PRIMARY KEY,        -- 'ressources/machine-de-guerresiege#machine:attaque-au-sol:belier'
  categorie      TEXT    NOT NULL CHECK (categorie IN ('attaque_sol', 'attaque_mur', 'defense_sol')),
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),
  description    TEXT    NOT NULL,
  effet          TEXT    NOT NULL,
  degats         INTEGER CHECK (degats IS NULL OR degats >= 0),         -- N de « N dégâts » / « N points de dégâts » quand l'effet n'en cite qu'un seul
  points_de_vie  INTEGER CHECK (points_de_vie IS NULL OR points_de_vie >= 0),   -- N de « Possède N points de vie »
  ordre          INTEGER NOT NULL CHECK (ordre >= 1),
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (categorie, nom)
) STRICT;

CREATE INDEX machine_guerre_degats ON machine_guerre (degats) WHERE degats IS NOT NULL;

-- Maladies : onglet « Maladie » (une ligne par maladie) et gabarit « Maladie V2 » (une seule maladie, Fièvre des marais, avec des champs en plus).
CREATE TABLE maladie (
  id                  TEXT    NOT NULL PRIMARY KEY,   -- 'ressources/maladie#maladie:botulisme-bleu', 'ressources/fievre-des-marais#maladie:fievre-des-marais'
  version             TEXT    NOT NULL CHECK (version IN ('liste', 'v2')),
  nom                 TEXT    NOT NULL CHECK (length(nom) > 0),
  nom_cle             TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  effets              TEXT,                           -- champ « Effets » entier (retours à la ligne conservés)
  nature              TEXT,
  lieu_contraction    TEXT,                           -- « Où le contracter ? »
  incubation_brut     TEXT,                           -- « 24h à 72h », « 72 heures »
  incubation_h_min    INTEGER CHECK (incubation_h_min IS NULL OR incubation_h_min >= 0),   -- heures, seulement pour « Nh » / « N heures » / « Nh à Mh »
  incubation_h_max    INTEGER,
  soin_methode_brut   TEXT,                           -- champ « Méthode de soin » entier
  temps_soin_brut     TEXT,                           -- champ « Temps de soin » entier
  conseil             TEXT,                           -- gabarit V2 : champ « Conseil »
  description         TEXT,                           -- gabarit V2 : cellule A5 entière (description, symptômes, puis les trois lignes « Race … : »)
  race_plus_sensible  TEXT,                           -- gabarit V2 : ligne « Race plus sensible : X » de A5 (X tel qu'écrit : « Aucune ») ; NULL hors V2
  race_resistante     TEXT,
  race_immunisee      TEXT,
  ordre               INTEGER NOT NULL CHECK (ordre >= 1),
  origine             TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref          TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  UNIQUE (version, nom_cle),
  CHECK ((incubation_h_min IS NULL) = (incubation_h_max IS NULL))
) STRICT;

CREATE INDEX maladie_nom_cle ON maladie (nom_cle);

-- Listes du champ « Méthode de contraction » et « Méthode de soin » (lignes « - … » ou texte unique).
CREATE TABLE maladie_methode (
  maladie_id  TEXT    NOT NULL REFERENCES maladie(id),
  sorte       TEXT    NOT NULL CHECK (sorte IN ('contraction', 'soin')),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  texte       TEXT    NOT NULL,
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (maladie_id, sorte, rang)
) STRICT, WITHOUT ROWID;

-- ====================================================================================================================
-- 10. TRANSVERSAL : notes de cellule et écarts entre sources
-- Deux tables génériques adressées par (entite_table, entite_id), comme page_entite : toute entité retrouve ses notes et ses écarts en une requête.
-- ====================================================================================================================

-- Notes et commentaires de cellule du classeur (lus dans le .xlsx : le dump JSON les porte dans `note` et `threads`) rattachés à l'entité qu'ils commentent.
--   nature : 'note' = note héritée (xl/comments) ; 'commentaire' / 'commentaire_resolu' = fil de commentaires (non résolu / résolu) ;
--            'reponse' = réponse dans un fil (`repond_a` = rang du commentaire qui ouvre le fil, dans la même entité) ;
--            'evenement' = « Marquée comme fermée » / « Rouverte » (trace du fil, pas du contenu) ; NULL = la source ne le dit pas.
-- `rang` = ordre dans l'entité (notes d'abord, puis fils, une réponse suit son commentaire) ; `champ` = colonne de la source qui porte la note
-- (sort : 'effets', 'cout'…) ; `cellule` = adresse A1 de la cellule commentée quand elle est connue. Les noms d'auteurs et les dates ne sont pas lus.
-- entite_table / entite_id : comme page_entite, sans clé étrangère (db:check).
CREATE TABLE note_cellule (
  entite_table TEXT    NOT NULL CHECK (length(entite_table) > 0 AND entite_table NOT GLOB '*[^a-z_]*'),
  entite_id    TEXT    NOT NULL,
  rang         INTEGER NOT NULL CHECK (rang >= 1),
  champ        TEXT,
  cellule      TEXT,
  nature       TEXT    CHECK (nature IN ('note', 'commentaire', 'commentaire_resolu', 'reponse', 'evenement')),
  repond_a     INTEGER CHECK (repond_a >= 1),             -- rang du commentaire parent (nature = 'reponse' / 'evenement')
  texte        TEXT    NOT NULL,
  origine      TEXT    NOT NULL REFERENCES famille(id),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),                       -- « Magie Maverick V8 › Sang › BJ13 »
  PRIMARY KEY (entite_table, entite_id, rang),
  CHECK ((nature IN ('reponse', 'evenement')) = (repond_a IS NOT NULL)),
  CHECK (repond_a IS NULL OR repond_a < rang),
  FOREIGN KEY (entite_table, entite_id, repond_a) REFERENCES note_cellule (entite_table, entite_id, rang)
) STRICT, WITHOUT ROWID;
CREATE INDEX note_cellule_nature ON note_cellule (nature) WHERE nature IS NOT NULL;

-- Écarts constatés entre deux sources, ou anomalies d'une source (coquille, prix incohérent, forme non reconnue). AUCUNE correction n'est
-- appliquée : la valeur retenue reste dans la colonne typée de l'entité, l'autre est ici avec sa source. Calculés par l'importeur, jamais saisis.
--   source_a = la source dont la valeur est dans la table typée ; source_b = l'autre source, NULL pour une anomalie interne à source_a.
--   `id` est la clé naturelle écrite en clair (CHECK) : entite_table:entite_id:champ:nature:source_a[:source_b].
CREATE TABLE ecart_source (
  id           TEXT    NOT NULL PRIMARY KEY,
  entite_table TEXT    NOT NULL CHECK (length(entite_table) > 0 AND entite_table NOT GLOB '*[^a-z_]*'),
  entite_id    TEXT    NOT NULL,
  champ        TEXT    NOT NULL,                             -- colonne ou notion concernée
  nature       TEXT    NOT NULL CHECK (nature IN ('valeur_differente', 'texte_different', 'nom_different', 'valeur_absente', 'calcul_different',
                                                  'coquille_rapprochee', 'prix_incoherent', 'doublon_de_nom', 'ecart_entre_onglets',
                                                  'ecart_avec_fiche', 'forme_non_reconnue', 'conflit_entre_sources')),
  source_a     TEXT    NOT NULL,                             -- 'fiche', 'guide', 'v8', 'modes', 'statistiques', 'ressources_craft'…
  valeur_a     TEXT,
  source_b     TEXT,
  valeur_b     TEXT,
  detail       TEXT    NOT NULL,
  origine      TEXT    NOT NULL REFERENCES famille(id),
  source_ref   TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK (id = entite_table || ':' || entite_id || ':' || champ || ':' || nature || ':' || source_a || COALESCE(':' || source_b, ''))
) STRICT, WITHOUT ROWID;
CREATE INDEX ecart_source_entite ON ecart_source (entite_table, entite_id);
CREATE INDEX ecart_source_nature ON ecart_source (nature);

-- Corrections de coquilles et de fautes d'orthographe : TRACE MIROIR du registre versionné `tools/sheets/corrections.json` (décision du propriétaire :
-- le registre est la source, il est appliqué au dump AVANT les extracteurs par `tools/sheets/corriger-dump.py` ; les colonnes typées, les *_brut et les
-- index plein texte portent donc déjà le texte corrigé). La table n'est jamais saisie à la main : l'importeur de la famille qui lit le dump la remplit
-- (`Famille.corrections(registre)`, `origine` = cette famille) et elle est effacée / recréée avec elle. Elle permet de répondre « qu'a-t-on corrigé,
-- où, pourquoi, et quel était le texte d'origine ? » sans rouvrir le classeur. Colonnes alignées sur le registre.
--   dump        = section du registre (classes-v7, magie-v8, les-races, les-races-annexes, fiche-auto-v15, ressources-craft, invocation, mode-hyper, races-index)
--   champ       = 'v' (valeur de la cellule) ou 'note' (note de la cellule) ; occurrences = nombre de remplacements attendus dans la cellule.
-- Garde-fous (db:check) : `avant` ne figure plus dans une table typée dont la `source_ref` couvre la cellule ; les chiffres, dés et signes de `avant` et `apres`
-- sont identiques (une correction n'est jamais une règle).
CREATE TABLE correction (
  dump          TEXT    NOT NULL CHECK (length(dump) > 0 AND dump NOT GLOB '*[^a-z0-9-]*'),
  classeur      TEXT    NOT NULL,                          -- libellé du classeur : « Classe Maverick V7 »
  onglet        TEXT    NOT NULL,
  cellule       TEXT    NOT NULL CHECK (cellule GLOB '[A-Z]*[0-9]' AND cellule NOT GLOB '*[^A-Z0-9]*' AND cellule NOT GLOB '*[0-9][A-Z]*' AND cellule NOT GLOB '[A-Z]*[A-Z]0*'),
  champ         TEXT    NOT NULL DEFAULT 'v' CHECK (champ IN ('v', 'note')),
  avant         TEXT    NOT NULL CHECK (length(avant) > 0),   -- extrait EXACT de la source
  apres         TEXT    NOT NULL,
  occurrences   INTEGER NOT NULL DEFAULT 1 CHECK (occurrences >= 1),
  nature        TEXT    NOT NULL CHECK (nature IN ('orthographe', 'accent', 'grammaire', 'ponctuation', 'casse', 'espace', 'frappe')),
  note          TEXT    NOT NULL CHECK (length(note) > 0), -- pourquoi (le propriétaire confirme / la bannière dit…)
  origine       TEXT    NOT NULL REFERENCES famille(id),   -- famille dont l'importeur lit le dump corrigé
  source_ref    TEXT    NOT NULL CHECK (length(source_ref) > 0),                          -- « Classe Maverick V7 › Mercenaire › AC22 » (même forme que les autres source_ref)
  PRIMARY KEY (dump, onglet, cellule, champ, avant),
  CHECK (avant <> apres)
) STRICT, WITHOUT ROWID;
CREATE INDEX correction_origine ON correction (origine);

-- ====================================================================================================================
-- 11. TABLES DÉRIVÉES (jamais exportées dans data/rows/, recalculées par `npm run db:build`)
-- Une table dérivée est précédée d'une ligne `-- @derivee <commande>` : l'export les ignore et le build les remplit après le chargement des lignes.
-- ====================================================================================================================

-- @derivee client/scripts/db-derive.mjs
-- Chaque occurrence de [[cible|ancre]] du corps (hors blocs ``` et `code`), dans l'ordre du texte.
CREATE TABLE lien (
  page_id       TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,   -- page qui contient le lien
  position      INTEGER NOT NULL CHECK (position >= 0),                    -- rang de l'occurrence dans le corps (0 = première)
  cible         TEXT    NOT NULL,                    -- texte avant « | » (ou tout le contenu), rogné : 'Jet de dés', 'races/elfe'
  ancre         TEXT    NOT NULL,                    -- texte affiché : après « | », sinon la cible
  etat          TEXT    NOT NULL CHECK (etat IN ('resolu', 'introuvable', 'ambigu')),
  cible_page_id TEXT    REFERENCES page(id) ON DELETE CASCADE,            -- renseigné seulement si etat = 'resolu'
  PRIMARY KEY (page_id, position),
  CHECK ((etat = 'resolu') = (cible_page_id IS NOT NULL))
) STRICT;

CREATE INDEX lien_cible ON lien (cible_page_id) WHERE cible_page_id IS NOT NULL;   -- rétroliens

CREATE INDEX lien_etat  ON lien (etat) WHERE etat <> 'resolu';                      -- « pages à créer »

-- @derivee client/scripts/db-derive.mjs
-- Pages candidates d'un lien ambigu (les pages qui portent la même clé).
CREATE TABLE lien_candidat (
  page_id          TEXT    NOT NULL,
  position         INTEGER NOT NULL,
  candidat_page_id TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, position, candidat_page_id),
  FOREIGN KEY (page_id, position) REFERENCES lien (page_id, position) ON DELETE CASCADE
) STRICT;

-- @derivee client/scripts/db-derive.mjs
-- Recherche plein texte. Accents et casse ignorés ; l'apostrophe sépare deux mots (« l'alchimiste » = « l » + « alchimiste »).
-- Colonnes : titre, alias (écritures séparées par des retours à la ligne), tag (libellés), resume, texte (corps sans
-- Markdown : [[a|b]] -> b, caractères # > * _ ` | retirés — même nettoyage que search-index.json.ts, sans la coupe à 4000).
-- Pondération conseillée (reprend search.mjs : titre 6, alias 5, mots-clés 4, résumé 2, texte 1) :
--     ORDER BY bm25(page_fts, 0, 6, 5, 4, 2, 1)       -- le 0 = page_id (colonne non indexée)
CREATE VIRTUAL TABLE page_fts USING fts5(
  page_id UNINDEXED, titre, alias, tag, resume, texte,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- @derivee data/derive.sql
-- Recherche plein texte de TOUTES les entités typées (sorts, capacités, ethnies, créatures, armes, états…) : une seule table, un seul MATCH.
-- Colonnes : nom, contexte (parent ou rubrique : magie d'un sort, classe d'une capacité, race d'une ethnie…), texte (le reste). Accents et casse
-- ignorés ; l'apostrophe sépare deux mots. Pondération conseillée : ORDER BY bm25(entite_fts, 0, 0, 6, 2, 1).
CREATE VIRTUAL TABLE entite_fts USING fts5(
  entite_table UNINDEXED, entite_id UNINDEXED, nom, contexte, texte,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ====================================================================================================================
-- 12. VUES (toujours à jour : rien à recalculer)
-- ====================================================================================================================

-- Index de résolution des [[liens]] = buildIndex() de wikilinks.mjs : toute clé normalisée -> pages qui la portent
-- (slug, titre ou alias). Une clé qui mène à plusieurs pages = nom ambigu. Les clés vides sont écartées comme dans le site.
-- Retrouver une page à partir d'un nom saisi :  WHERE cle = normalize(saisie)  (normalize = text.mjs, côté application).
CREATE VIEW cle_page AS
  SELECT slug      AS cle, id      AS page_id, 'slug'  AS nature FROM page  WHERE slug <> ''
  UNION
  SELECT titre_cle AS cle, id      AS page_id, 'titre' AS nature FROM page  WHERE titre_cle <> ''
  UNION
  SELECT cle       AS cle, page_id AS page_id, 'alias' AS nature FROM alias WHERE cle <> '';

-- Graphe de pages tel que le calcule wiki.ts : paires (depuis, vers) distinctes, liens résolus, sans lien d'une page vers elle-même.
--   liens sortants d'une page P : WHERE depuis_page_id = P ;   rétroliens (« Mentionnée par ») : WHERE vers_page_id = P
CREATE VIEW lien_page AS
  SELECT DISTINCT page_id AS depuis_page_id, cible_page_id AS vers_page_id
  FROM lien
  WHERE etat = 'resolu' AND cible_page_id <> page_id;

-- « Pages à créer » : [[liens]] sans page (introuvables) ou ambigus. wiki.ts les compte tous les deux comme non résolus.
CREATE VIEW lien_a_creer AS
  SELECT page_id, position, cible, ancre, etat FROM lien WHERE etat <> 'resolu';

-- Dictionnaire des mots-clés, déduit de page_tag. Libellé d'affichage = écriture de la page de plus petit (titre_cle, id)
-- qui porte le mot-clé : une règle fixe, reproductible par n'importe quel importeur ou client.
CREATE VIEW tag AS
  SELECT DISTINCT
    pt.tag_id AS id,
    first_value(pt.libelle) OVER (PARTITION BY pt.tag_id ORDER BY p.titre_cle, p.id, pt.ordre) AS libelle,
    count(*) OVER (PARTITION BY pt.tag_id) AS nb_pages
  FROM page_tag pt JOIN page p ON p.id = pt.page_id;

-- Relation d'incompatibilité symétrique : (a, b) est présent dans les deux sens dès que l'un des deux cite l'autre.
CREATE VIEW v_magie_incompatible AS
  SELECT magie_id AS a, autre_magie_id AS b FROM magie_incompatibilite
  UNION
  SELECT autre_magie_id AS a, magie_id AS b FROM magie_incompatibilite;

-- Les bonus de maîtrise d'un sort À UN NIVEAU DE MAÎTRISE DONNÉ (nm = 0, 1, 2, 3) : une ligne par (bonus, nm). `applications` = combien de fois le bonus s'applique :
--   par_nm : nm / pas_nm (arrondi vers le bas : « (+1/NM) » vaut 0, 1, 2, 3 fois ; « (+1d/3NM) » vaut 0 puis 1 à 3 NM), à multiplier par increment_brut ;
--   palier : 1 si nm atteint seuil_nm, sinon 0 ; texte : NULL (rien de typé). C'est la lecture littérale de l'écriture « /NM », « /3NM », « 3NM = » : rien d'autre n'est calculé.
-- « Quel est ce sort à N NM ? » : SELECT * FROM v_sort_bonus_au_nm WHERE sort_id = ? AND nm = ? AND applications <> 0.
CREATE VIEW v_sort_bonus_au_nm AS
  SELECT b.sort_id, n.nm, b.champ, b.rang, b.nature, b.texte_brut, b.contexte, b.increment_brut, b.increment_entier,
         CASE b.nature
           WHEN 'par_nm' THEN n.nm / b.pas_nm
           WHEN 'palier' THEN CASE WHEN n.nm >= b.seuil_nm THEN 1 ELSE 0 END
         END AS applications
  FROM sort_bonus_maitrise b
  CROSS JOIN (SELECT 0 AS nm UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) n;

-- Bornes de saisie d'une caractéristique selon la race, telles que la fiche les calcule (BDD!K2:K24) :
--   '>' est strict (« > 2 » = au moins 3), '<' est strict (« < 4 » = au plus 3), '=' fixe la valeur ;
--   le minimum ne descend jamais sous 1 et le maximum ne monte jamais au-dessus de 4 (« minimum de 1 et maximum de 4 de
--   manière générale », guide/fiche-caracteristiques) ; sans restriction : 1 à 4.
-- La vue produit une ligne par (race, caracteristique) : 27 x 6 = 162. Les bornes portent sur la BASE saisie, avant le bonus de la
-- magie innée (règle de la fiche, hors de ce domaine). operateur/valeur sont NULL quand la race n'a pas de restriction.
CREATE VIEW v_race_carac_borne AS
  SELECT r.id AS race_id, c.id AS caracteristique_id, rr.operateur, rr.valeur,
         MAX(1, CASE rr.operateur WHEN '>' THEN rr.valeur + 1 WHEN '=' THEN rr.valeur ELSE 0 END) AS minimum,
         MIN(4, CASE rr.operateur WHEN '<' THEN rr.valeur - 1 WHEN '=' THEN rr.valeur ELSE 4 END) AS maximum
  FROM race r
  CROSS JOIN caracteristique c
  LEFT JOIN race_restriction_carac rr ON rr.race_id = r.id AND rr.caracteristique_id = c.id;

-- Vues « seulement les 1 » : évitent l'erreur classique d'oublier `accessible = 1` (les lignes à 0 existent aussi).
CREATE VIEW v_race_classe_accessible AS
  SELECT race_id, classe_id, ordre FROM race_classe WHERE accessible = 1;

CREATE VIEW v_race_magie_accessible AS
  SELECT race_id, magie_id, ordre FROM race_magie WHERE accessible = 1;

-- Regard d'un peuple sur un autre (décision R12 : la case (ligne A, colonne B) de « Relation entre les races » dit comment A voit B).
-- « Comment les Elfes Noirs Charbon voient-ils les autres ? » : WHERE peuple_id = ? ; « Comment sont-ils vus ? » : WHERE vu_peuple_id = ?.
-- echelle_ordre : 1 = Même peuple, 2 = Alliée … 8 = Ennemie (du plus favorable au plus défavorable).
CREATE VIEW v_regard_peuple AS
  SELECT r.ligne_peuple_id AS peuple_id, r.colonne_peuple_id AS vu_peuple_id, r.echelle_id, e.ordre AS echelle_ordre
  FROM relation_peuple r JOIN echelle_relation e ON e.id = r.echelle_id;

-- Magies d'une créature : celles de la marge de son bloc (« Terre + Feu » -> Terre et Feu) ET celle du sort qui invoque son
-- invocation (Terre pour tous les golems, Nécromancie pour les non-morts, Ombre pour les marionettes, dont la marge « EPN »
-- ne nomme aucune magie). Une ligne par (créature, magie) ; dans_marge / par_sort disent d'où vient le lien.
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

-- Résistances, vulnérabilités, immunités et sensibilités d'une créature, toutes provenances confondues (une ligne par fait) :
--   provenance 'capacite' : écrit dans une capacité de la créature (creature_capacite_resistance) ; source_id = capacite.id
--   provenance 'commune'  : écrit dans une capacité commune de son invocation (invocation_resistance) ; source_id = capacité commune
--   provenance 'element'  : règle « Élémentaire » des capacités communes (« Chaque créature possède la/les résistances magiques ainsi
--                           que la/les vulnérabilités magiques de son élément ») appliquée à CHAQUE magie de la marge du bloc, avec
--                           les listes de la table magie_resistance (cible_type 'magie' seulement) ; via_magie_id = la magie d'où vient
--                           la ligne. NE FAIT PAS la synthèse de deux magies : pour « Terre + Feu » on a les lignes de Terre ET
--                           celles de Feu, éventuellement contradictoires (Terre vulnérable au Feu, Feu résistante au Feu) ;
--                           le classeur ne dit pas comment on les combine (design.md §12, points ouverts). Seules les invocations
--                           dont les capacités communes nomment « Élémentaire » sont concernées (pas les marionettes).
-- PRIORITÉ : la source n'en donne une que pour les non-morts (« Élémentaire … (sauf capacité lui donnant autre chose) »). Une capacité
-- peut contredire la règle (Golem de verre : « résisantante contre le Feu » alors que la Terre est vulnérable au Feu) : les lignes
-- de provenance 'capacite' sont plus précises que celles de provenance 'element' ; le consommateur choisit (design.md §12, points ouverts).
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

-- Sorts que peut lancer une créature (capacités « Lanceur de sorts » et « Sort supplémentaire »).
CREATE VIEW v_creature_sort AS
  SELECT ca.creature_id AS creature_id, ca.id AS capacite_id, ca.nom AS capacite, ca.npm_min AS npm_min,
         cs.rang AS rang, cs.sort_nom_brut AS sort_nom_brut, cs.sort_id AS sort_id
  FROM creature_capacite_sort cs JOIN creature_capacite ca ON ca.id = cs.capacite_id;

-- Coût d'invocation : il n'est PAS sur la carte, il est écrit sur le SORT qui invoque (colonne « Coût » : « 6 (xNP de créature) »,
-- « 5 + 1 âme (xNPM de créature) », « 5 + 10% BA (xNPM de créature) »). Les commentaires du sort (table note_cellule, entité sort)) précisent que « chaque niveau de puissance de la créature invoqué double de le coût précédent ».
CREATE VIEW v_creature_cout_invocation AS
  SELECT c.id AS creature_id, i.id AS invocation_id, s.id AS sort_id, s.nom AS sort_nom,
         s.cout_brut AS cout_brut, s.cout_chakra AS cout_chakra, s.cout_ressource AS cout_ressource,
         s.cout_ressource_valeur AS cout_ressource_valeur, b.ep AS ep
  FROM creature c
  JOIN invocation i ON i.id = c.invocation_id
  JOIN invocation_bloc b ON b.id = c.bloc_id
  JOIN sort s ON s.id = i.sort_id;

-- « Autre créature du bloc » (ligne de la page actuelle) : la ou les autres cartes du même bloc.
CREATE VIEW v_creature_meme_bloc AS
  SELECT a.id AS creature_id, b.id AS autre_creature_id
  FROM creature a JOIN creature b ON b.bloc_id = a.bloc_id AND b.id <> a.id;

-- Arme avec les valeurs « effectives » : portée écrite dans l'effet, sinon portée par défaut du type (BDD!AF de la fiche) ;
-- solidité de l'arme nue (2 crans de base, règle de l'onglet, corrigée par « 1 seul cran » / « ±1 cran » de l'effet : sans matériau ni amélioration) ;
-- libellés de famille et de type.
CREATE VIEW v_arme AS
  SELECT a.id, a.nom, f.nom AS famille, t.nom AS type, a.competence_brut, a.mains, a.cout_ro,
         a.de, a.de_faces, COALESCE(a.bonus_degats, 0) AS bonus_degats_ou_0,
         a.bonus_degats,
         COALESCE(a.portee_min, t.portee_min) AS portee_min_effective,
         COALESCE(a.portee_max, t.portee_max) AS portee_max_effective,
         CASE WHEN a.portee_min IS NULL THEN 'type' ELSE 'effet' END AS portee_source,
         COALESCE(a.solidite_fixee, k.valeur + COALESCE(a.solidite_delta, 0)) AS solidite_sans_composition,
         a.ignore_ap, a.recharge, a.provenance, a.depart_possible, a.effet
  FROM arme a
  JOIN arme_famille f ON f.id = a.famille_id
  JOIN arme_type t ON t.id = a.type_id
  CROSS JOIN (SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base') k;

-- Ingrédients qui conviennent à un emplacement d'alchimie : même catégorie et même affinité ; l'emplacement « Amplificateur majeur »
-- n'accepte que les ingrédients marqués « (majeur) », les autres emplacements « Amplificateur » que les non-majeurs (règle du Doc :
-- « Certains ingrédients possèdent la mention (majeur), ils sont utiles pour faire les potions ultimes »). C'est une LECTURE de la
-- source, pas une donnée : la vue peut être supprimée sans perte.
CREATE VIEW v_ingredient_possible AS
  SELECT ri.recette_id, ri.rang, ri.option, ri.role, ri.affinite_id, i.ressource_id
  FROM recette_ingredient ri
  JOIN ingredient_alchimie i
    ON i.affinite_id = ri.affinite_id
   AND i.categorie = CASE ri.role WHEN 'amplificateur_majeur' THEN 'amplificateur' ELSE ri.role END
   AND i.majeur = CASE ri.role WHEN 'amplificateur_majeur' THEN 1 ELSE 0 END
  WHERE ri.affinite_id IS NOT NULL;

-- « Recettes qui utilisent la ressource X » : ressource citée par son nom dans la recette (via = 'nommee') ou ingrédient d'alchimie
-- qui répond à l'exigence d'un emplacement (via = 'affinite').
CREATE VIEW v_ressource_recette AS
  SELECT ri.ressource_id, ri.recette_id, 'nommee' AS via
  FROM recette_ingredient ri
  WHERE ri.ressource_id IS NOT NULL
  UNION
  SELECT p.ressource_id, p.recette_id, 'affinite' AS via
  FROM v_ingredient_possible p;

-- Recettes d'un métier : par famille citée dans « Artisanat possible » (alchimie seulement, voir metier_recette_famille).
CREATE VIEW v_metier_recette AS
  SELECT m.id AS metier_id, m.nom AS metier, r.id AS recette_id, r.nom AS recette, r.famille, r.variante, m.test_brut
  FROM metier_recette_famille mf
  JOIN metier m ON m.id = mf.metier_id
  JOIN recette r ON r.genre = 'alchimie' AND r.famille = mf.famille;

-- Potions avec leur niveau, leur prix et leurs recettes (une ligne par potion et variante de recette de sa page).
CREATE VIEW v_potion AS
  SELECT r.id AS ressource_id, r.nom, p.famille, p.rang, n.nom AS niveau, n.rang AS niveau_rang,
         r.prix_brut, r.prix_rf, p.effet
  FROM potion p
  JOIN ressource r ON r.id = p.ressource_id
  JOIN niveau_alchimie n ON n.id = p.niveau_id;

-- Arme forgée dans un matériau : « tous les bonus se cumulent une fois l'arme forgée (exemple : une claymore en cuivre donne un bonus aux
-- dégâts de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5) » (Armes!A1). Une ligne par couple (arme, matériau).
-- Seuls les bonus de dégâts s'additionnent ici : la source ne dit pas comment se combinent les crans de solidité d'une arme à effet
-- de solidité et d'un matériau.
CREATE VIEW v_arme_composee AS
  SELECT a.id AS arme_id, a.nom AS arme, r.id AS materiau_id, r.nom AS materiau,
         COALESCE(a.bonus_degats, 0) + COALESCE(m.bonus_degats, 0) AS bonus_degats_total,
         m.effet_secondaire AS effet_materiau
  FROM arme a
  CROSS JOIN materiau_arme m
  JOIN ressource r ON r.id = m.ressource_id;

-- Une armure sur chacune de ses six pièces (Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droit) : lecture de la fiche, qui recopie
-- l'AP, l'AM et la solidité de l'armure choisie sur les six pièces. La source ne donne PAS de valeur propre à une pièce : cette vue ne
-- stocke rien et n'invente rien ; elle disparaîtra le jour où la source en donnera.
CREATE VIEW v_armure_piece AS
  SELECT a.id AS armure_id, a.nom AS armure, e.id AS emplacement_id, e.nom AS emplacement, a.ap, a.am, a.solidite
  FROM armure a
  CROSS JOIN armure_emplacement e
  WHERE e.id NOT IN ('armure-complete', 'bouclier');

-- Le moteur de la fiche, niveau par niveau : cumuls des dons du guide et valeurs par palier de la fiche.
--   *_cumul : somme des dons des niveaux <= niveau (un don NULL compte 0 dans la SOMME : c'est un calcul, pas une donnée)
--   caracteristiques_total / competence_naturel_max / puissance_magique_max_feuille : seuil_niveau (formules de la fiche)
--   puissance_magique_max_guide : plus haute puissance écrite par le guide aux niveaux <= niveau
CREATE VIEW v_niveau AS
SELECT n.niveau,
       n.xp_min,
       (SELECT MIN(s.xp_min) - 1 FROM niveau_global s WHERE s.niveau = n.niveau + 1) AS xp_max,
       SUM(COALESCE(n.points_competences, 0))          OVER w AS points_competences_cumul,
       SUM(COALESCE(n.points_attributs, 0))            OVER w AS points_attributs_cumul,
       SUM(COALESCE(n.caracteristiques_a_repartir, 0)) OVER w AS caracteristiques_a_repartir_cumul,
       SUM(COALESCE(n.maximum_naturel_bonus, 0))       OVER w AS maximum_naturel_bonus_cumul,
       SUM(COALESCE(n.niveaux_classe, 0))              OVER w AS niveaux_classe_cumul,
       SUM(COALESCE(n.niveaux_maitrise, 0))            OVER w AS niveaux_maitrise_cumul,
       SUM(CASE WHEN n.de_attributs_bonus IS NULL THEN 0 ELSE 1 END) OVER w AS des_attributs_cumul,
       (SELECT s.valeur FROM seuil_niveau s WHERE s.regle = 'caracteristiques_total'
         AND s.niveau_min <= n.niveau ORDER BY s.niveau_min DESC LIMIT 1) AS caracteristiques_total,
       (SELECT s.valeur FROM seuil_niveau s WHERE s.regle = 'competence_naturel_max'
         AND s.niveau_min <= n.niveau ORDER BY s.niveau_min DESC LIMIT 1) AS competence_naturel_max,
       (SELECT s.valeur FROM seuil_niveau s WHERE s.regle = 'puissance_magique_max'
         AND s.niveau_min <= n.niveau ORDER BY s.niveau_min DESC LIMIT 1) AS puissance_magique_max_feuille,
       MAX(n.puissance_magique) OVER w AS puissance_magique_max_guide
FROM niveau_global n
WINDOW w AS (ORDER BY n.niveau ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW);

-- Compétences avec leur caractéristique : le moteur n'a pas à joindre.
CREATE VIEW v_competence AS
SELECT c.id, c.nom, c.ordre, c.libelle_fiche, c.description,
       k.id AS caracteristique_id, k.nom AS caracteristique, k.lettre
FROM competence c JOIN caracteristique k ON k.id = c.caracteristique_id;

-- Les deux LECTURES de la matrice « magie A résiste à magie B » côte à côte (le propriétaire n'a pas tranché laquelle fait foi, design.md §12.2) :
--   valeur_fiche = resistance_magie (matrice de la fiche, 14 x 14, utilisée par rules.json) ;
--   valeur_v8    = magie_resistance (listes « résiste à / vulnérable à » du classeur V8, affichées par les pages des magies).
-- Une paire absente d'une lecture vaut 0 (neutre) : les listes V8 ne citent que les magies qui résistent ou qui sont vulnérables. Une seule
-- requête répond à « que disent les deux lectures ? » ; `concordant = 0` donne les écarts (v_resistance_ecart).
CREATE VIEW v_resistance_magie_lectures AS
WITH v8 AS (
  SELECT magie_id, cible_magie_id AS attaque_magie_id, CASE sens WHEN 'resistance' THEN 1 ELSE -1 END AS valeur
  FROM magie_resistance WHERE cible_type = 'magie'
),
paires AS (
  SELECT magie_id, attaque_magie_id FROM resistance_magie
  UNION SELECT magie_id, attaque_magie_id FROM v8
)
SELECT p.magie_id, p.attaque_magie_id,
       COALESCE(f.valeur, 0) AS valeur_fiche,
       COALESCE(v.valeur, 0) AS valeur_v8,
       (COALESCE(f.valeur, 0) = COALESCE(v.valeur, 0)) AS concordant
FROM paires p
LEFT JOIN resistance_magie f ON f.magie_id = p.magie_id AND f.attaque_magie_id = p.attaque_magie_id
LEFT JOIN v8 v ON v.magie_id = p.magie_id AND v.attaque_magie_id = p.attaque_magie_id;

-- Lignes où la matrice de la fiche et les listes du classeur V8 ne disent pas la même chose. Vide quand les deux lectures concordent.
CREATE VIEW v_resistance_ecart AS
  SELECT magie_id, attaque_magie_id, valeur_fiche, valeur_v8 FROM v_resistance_magie_lectures WHERE concordant = 0;

-- Les cinq LECTURES du mode hyper (mode_hyper_effet.version) sur une même ligne : une ligne par cible (magie, couple de magies ou race) et variante.
-- Chaque colonne est le texte de la source, NULL quand cette source ne dit rien de cette cible ; `nb_textes` = nombre de textes distincts (1 = les
-- sources concordent). Les effets « généraux » n'ont pas de clé commune entre les sources : ils restent dans mode_hyper_effet.
CREATE VIEW v_mode_hyper_lectures AS
SELECT portee, COALESCE(magie_id, race_id) AS cible_id, magie2_id, variante,
       MAX(CASE version WHEN 'classeur_modes' THEN effet END) AS classeur_modes,
       MAX(CASE version WHEN 'magie_masque'   THEN effet END) AS magie_masque,
       MAX(CASE version WHEN 'onglet_magie'   THEN effet END) AS onglet_magie,
       MAX(CASE version WHEN 'fiche'          THEN effet END) AS fiche,
       MAX(CASE version WHEN 'onglet_race'    THEN effet END) AS onglet_race,
       count(*) AS nb_lectures, count(DISTINCT effet) AS nb_textes
FROM mode_hyper_effet
WHERE portee <> 'general'
GROUP BY portee, COALESCE(magie_id, race_id), magie2_id, variante;

-- Une capacité par ligne avec sa classe et sa spécialité à plat : la vue à interroger pour « toutes les capacités d'une classe au niveau N ».
-- specialite / specialite_rang sont NULL pour les capacités de classe (nature 'classe') et pour les choix de l'Archimage.
CREATE VIEW v_classe_capacite AS
  SELECT k.classe_id, c.nom AS classe, k.specialite_id, s.rang AS specialite_rang, s.nom AS specialite, k.niveau, k.nature, k.ligne, k.rang,
         k.id AS capacite_id, k.nom, k.type, k.type_brut, k.limite_nombre, k.limite_periode, k.effet
  FROM capacite k
  JOIN classe c ON c.id = k.classe_id
  LEFT JOIN specialite s ON s.id = k.specialite_id;

-- Choix exclusifs, lus dans la mise en page (règle du propriétaire, client/src/lib/capacites.mjs) : deux capacités sont des alternatives quand
-- elles sont côte à côte sur la même ligne de l'onglet : deux colonnes sous la même bannière (nature 'choix'), les deux cartouches de spécialité
-- (nature 'specialite'), les trois colonnes de l'Archimage (specialite_id NULL). La relation est symétrique : une ligne par sens.
CREATE VIEW v_capacite_exclusive AS
  SELECT a.id AS capacite_id, b.id AS autre_id
  FROM capacite a
  JOIN capacite b ON b.classe_id = a.classe_id AND b.ligne = a.ligne AND b.nature = a.nature AND b.id <> a.id
  WHERE a.nature <> 'classe'
    AND (a.nature = 'specialite' OR COALESCE(a.specialite_id, '') = COALESCE(b.specialite_id, ''));

-- Capacités écrites à l'identique (nom, type, effet, note de cellule) à plusieurs endroits : une ligne par contenu.
CREATE VIEW v_capacite_partagee AS
  SELECT nom, COALESCE(type_brut, '') AS type_brut, COALESCE(effet, '') AS effet, count(*) AS nb_emplacements, min(id) AS premiere_id
  FROM (SELECT k.*, COALESCE((SELECT group_concat(n.texte, char(10)) FROM note_cellule n
                              WHERE n.entite_table = 'capacite' AND n.entite_id = k.id), '') AS note FROM capacite k)
  GROUP BY nom, COALESCE(type_brut, ''), COALESCE(effet, ''), note
  HAVING count(*) > 1;

-- ====================================================================================================================
-- INDEX DES CLÉS ÉTRANGÈRES (hors `origine`) : toute clé étrangère se filtre par un index (convention « index sur toute colonne servant de filtre »).
-- Les clés étrangères clairsemées ont un index partiel « WHERE col IS NOT NULL » (reconnu par l'API). `origine` n'est pas indexée : design.md §4.2.
-- ====================================================================================================================

CREATE INDEX accessoire_monture_materiau_fk ON accessoire_monture (materiau_id);

CREATE INDEX amelioration_equipement_page_fk ON amelioration_equipement (page_id);

CREATE INDEX armure_materiau_colonne_fk ON armure (materiau_colonne_id) WHERE materiau_colonne_id IS NOT NULL;

CREATE INDEX capacite_specialite_classe_fk ON capacite (specialite_id, classe_id) WHERE specialite_id IS NOT NULL;

CREATE INDEX classe_annexe_magie_fk ON classe_annexe (magie_id) WHERE magie_id IS NOT NULL;

CREATE INDEX constante_equipement_page_fk ON constante_equipement (page_id);

CREATE INDEX creature_bloc_invocation_fk ON creature (bloc_id, invocation_id);

CREATE INDEX creature_attaque_type_magie_fk ON creature_attaque_type (magie_id) WHERE magie_id IS NOT NULL;

CREATE INDEX creature_bonus_npm_caracteristique_fk ON creature_bonus_npm (caracteristique_id) WHERE caracteristique_id IS NOT NULL;

CREATE INDEX creature_capacite_resistance_cible_etat_fk ON creature_capacite_resistance (cible_etat_id) WHERE cible_etat_id IS NOT NULL;

CREATE INDEX creature_capacite_resistance_cible_magie_fk ON creature_capacite_resistance (cible_magie_id) WHERE cible_magie_id IS NOT NULL;

CREATE INDEX invocation_resistance_cible_etat_fk ON invocation_resistance (cible_etat_id) WHERE cible_etat_id IS NOT NULL;

CREATE INDEX invocation_resistance_cible_magie_fk ON invocation_resistance (cible_magie_id) WHERE cible_magie_id IS NOT NULL;

CREATE INDEX kit_alchimie_niveau_fk ON kit_alchimie (niveau_id);

CREATE INDEX lien_candidat_candidat_page_fk ON lien_candidat (candidat_page_id);

CREATE INDEX magie_ethnie_secondaire_ethnie_fk ON magie_ethnie_secondaire (ethnie_id);

CREATE INDEX metier_test_carac_2_fk ON metier (test_carac_2_id) WHERE test_carac_2_id IS NOT NULL;

CREATE INDEX metier_test_carac_1_fk ON metier (test_carac_1_id) WHERE test_carac_1_id IS NOT NULL;

CREATE INDEX note_cellule_entite_table_entite_repond_a_fk ON note_cellule (entite_table, entite_id, repond_a);

CREATE INDEX potion_niveau_fk ON potion (niveau_id);

CREATE INDEX recette_test_carac_2_fk ON recette (test_carac_2_id) WHERE test_carac_2_id IS NOT NULL;

CREATE INDEX recette_test_carac_1_fk ON recette (test_carac_1_id) WHERE test_carac_1_id IS NOT NULL;

-- ====================================================================================================================
-- 13. PERSONNAGES : les vraies fiches (joueurs et prétirés), les groupes de jeu et la visibilité (saisie, jamais importée ; migration 0011)
-- Une fiche = les CHOIX du joueur, rangés comme sur la « Fiche personnage Maverick Auto V15.2.2 » (onglet Personnage, cellules citées) ; tout ce
-- que la fiche CALCULE (niveau global, niveaux de classe, santé, chakra, barrière, initiative, totaux de compétences, résistances…) est recalculé
-- depuis les règles de la base et n'est jamais stocké : une règle corrigée corrige toutes les fiches. Les vues v_personnage_niveau et
-- v_personnage_controle en donnent la première part ; le reste viendra du moteur pur (client/src/lib/, docs/feuille-de-route.md).
-- Qui voit quelle fiche (demande du propriétaire) : v_personnage_visible ; les groupes de jeu (one-shot ou campagne) : groupe, groupe_membre.
-- Ces tables n'ont ni `origine` ni `source_ref` (rien n'est importé) ni `remarque` (réservée aux entités des classeurs) ; data/rows/ les garde VIDES :
-- les fiches réelles vivent dans la base du serveur, pas dans git (docs/character-generator.md, « Fiches dans la base »).
-- Instants : texte ISO 8601 en UTC ('2026-10-09T14:03:00Z'), portable tel quel vers PostgreSQL.
-- ====================================================================================================================

-- Personne qui se connecte au site. Connexion par Discord à la 1.0 (docs/feuille-de-route.md, « Authentification ») : on ne garde que l'identifiant
-- Discord (immuable) et le nom d'affichage, jamais de mot de passe ni de jeton. Un compte local de secours (administrateur) n'a pas d'identifiant Discord.
-- Tout utilisateur connecté est lecteur ; les autres rôles sont dans utilisateur_role.
CREATE TABLE utilisateur (
  id             TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- identifiant stable du site, jamais réutilisé
  discord_id     TEXT    UNIQUE CHECK (discord_id IS NULL OR (length(discord_id) > 0 AND discord_id NOT GLOB '*[^0-9]*')),   -- « snowflake » Discord ; NULL = compte local de secours
  nom_affichage  TEXT    NOT NULL CHECK (length(nom_affichage) > 0),
  cree_le        TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;

-- Rôles d'un utilisateur, cumulables (la correspondance rôle Discord -> rôle du site est une configuration, pas une donnée) :
-- 'mj' = maître du jeu (le « groupe MJ » : cible de la visibilité 'mj' d'une fiche), 'editeur' = modifie les règles (phase 2), 'admin' = voit et gère tout.
CREATE TABLE utilisateur_role (
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('mj', 'editeur', 'admin')),
  PRIMARY KEY (utilisateur_id, role)
) STRICT, WITHOUT ROWID;

CREATE INDEX utilisateur_role_role ON utilisateur_role (role);   -- « tous les MJ », « tous les administrateurs »

-- Une fiche de personnage : le haut de l'onglet Personnage (identité, magies, alignement, bourse, expérience) et les choix uniques.
-- Deux natures (demande du propriétaire) : la fiche d'un JOUEUR, qu'il crée pour son personnage (visible de lui seul et des administrateurs, sauf ce
-- qu'il ouvre : visibilité, partage, inscription dans un groupe), et le PRÉTIRÉ, qui n'appartient à personne et que tout le monde voit.
CREATE TABLE personnage (
  id                    TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- identifiant stable, jamais réutilisé (un personnage renommé le garde)
  nature                TEXT    NOT NULL CHECK (nature IN ('joueur', 'pretire')),
  proprietaire_id       TEXT    REFERENCES utilisateur(id),   -- joueur qui l'a créée ; NULL exactement pour un prétiré
  visibilite            TEXT    NOT NULL CHECK (visibilite IN ('privee', 'mj', 'tous')),
                                                    -- qui la voit EN PLUS du propriétaire, des administrateurs, des membres des groupes où elle est inscrite
                                                    -- et des utilisateurs désignés (personnage_partage) : 'privee' personne d'autre, 'mj' tous les MJ,
                                                    -- 'tous' tout utilisateur connecté (toujours le cas d'un prétiré) ; calcul : v_personnage_visible
  statut                TEXT    NOT NULL CHECK (statut IN ('brouillon', 'valide', 'archive')),   -- 'valide' : v_personnage_controle doit être vide pour elle
  nom                   TEXT    NOT NULL CHECK (length(nom) > 0),   -- « NOM » (F1)
  surnom                TEXT,                         -- « Surnom » (P1)
  lieu_origine          TEXT,                         -- « Lieu origine » (F3)
  race_id               TEXT    REFERENCES race(id),  -- « RACE » (I2) ; NULL tant que le brouillon ne l'a pas choisie
  ethnie_id             TEXT    REFERENCES ethnie(id),   -- don racial de la ligne « R » (C40, onglet « Bonus Race ») : l'ethnie, de la race choisie
  magie_innee_id        TEXT    REFERENCES magie(id), -- « Magie inn » (S2)
  magie_acquise_id      TEXT    REFERENCES magie(id), -- « Magie acq » (S3) ; NULL = pas de magie acquise (facultative, guide « Personnage »)
  caracteristique_magie_id TEXT REFERENCES caracteristique(id),   -- point de caractéristique de la magie innée quand elle ne le fixe pas
                                                    -- (magie.caracteristique_id NULL : Potentiel Illimité, « AU CHOIX ou ALEATOIRE ») ; NULL sinon
  dieu_choisi_id        TEXT    REFERENCES dieu(id),  -- « Dieu choisi » (S5) ; le dieu inné se déduit de la magie innée (magie_dieu), il n'est pas stocké
  metier_id             TEXT    REFERENCES metier(id),   -- don de la ligne « M » (C41, « Métier ? ») ; NULL = sans métier
  mode_classe           TEXT    NOT NULL CHECK (mode_classe IN ('mono', 'bi')),   -- « Mono classe » / « Bi classe » (BDD!K26) : figé à la création
                                                    -- (la fiche le fige dès 201 XP) ; règle de progression : décision R2
  xp                    INTEGER NOT NULL CHECK (xp >= 0),   -- « TOTAL XP » (S11) ; le niveau global s'en déduit (v_personnage_niveau)
  alignement_loyal      INTEGER NOT NULL CHECK (alignement_loyal >= 0),       -- scores L, C, B, M (L5:O5, guide « Alignement ») ;
  alignement_chaotique  INTEGER NOT NULL CHECK (alignement_chaotique >= 0),   -- le libellé (« Neutre Pur »…, I4) se calcule
  alignement_bon        INTEGER NOT NULL CHECK (alignement_bon >= 0),
  alignement_mauvais    INTEGER NOT NULL CHECK (alignement_mauvais >= 0),
  bourse_pp             INTEGER NOT NULL CHECK (bourse_pp >= 0),   -- « Bourse » : Précieuse (I6), Or (N6), Fer (T6) = monnaie 'pp', 'ro', 'rf'
  bourse_ro             INTEGER NOT NULL CHECK (bourse_ro >= 0),
  bourse_rf             INTEGER NOT NULL CHECK (bourse_rf >= 0),
  ambidextrie           INTEGER NOT NULL CHECK (ambidextrie IN (0, 1)),   -- case « Ambidextrie » (AU8)
  bouclier_classe_id    TEXT    REFERENCES bouclier_classe(id),   -- « Nom Bouclier » (AA26) ; ses matériaux : personnage_bouclier_materiau
  -- État en jeu (valeurs courantes ; les maximums se calculent). NULL = non suivi (au maximum).
  sante_actuelle        INTEGER,
  chakra_actuel         INTEGER CHECK (chakra_actuel IS NULL OR chakra_actuel >= 0),
  barriere_actuelle     INTEGER CHECK (barriere_actuelle IS NULL OR barriere_actuelle >= 0),
  corruption            INTEGER CHECK (corruption IS NULL OR corruption >= 0),   -- « Corruption » (K15), guide « Attributs »
  barre4_actuelle       INTEGER CHECK (barre4_actuelle IS NULL OR barre4_actuelle >= 0),   -- Sang / Âme, la « 4ème barre » (A15:F15)
  notes                 TEXT,                         -- « NOTE » (BA53)
  evenements            TEXT,                         -- « ÉVÉNEMENTS » (B71)
  cree_le               TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  modifie_le            TEXT    NOT NULL CHECK (modifie_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z' AND modifie_le >= cree_le),
  CHECK ((nature = 'pretire') = (proprietaire_id IS NULL)),   -- un prétiré n'est à personne ; la fiche d'un joueur a son propriétaire
  CHECK (nature = 'joueur' OR visibilite = 'tous'),           -- « Les prétirés sont visibles par tous »
  CHECK (magie_acquise_id IS NULL OR magie_acquise_id <> magie_innee_id),
  CHECK (statut = 'brouillon' OR (race_id IS NOT NULL AND magie_innee_id IS NOT NULL))
) STRICT;

CREATE INDEX personnage_proprietaire ON personnage (proprietaire_id) WHERE proprietaire_id IS NOT NULL;   -- « mes personnages »

-- Utilisateurs à qui le propriétaire montre sa fiche en plus de sa visibilité (« un utilisateur spécifique », plusieurs possibles).
CREATE TABLE personnage_partage (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  PRIMARY KEY (personnage_id, utilisateur_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_partage_utilisateur ON personnage_partage (utilisateur_id);   -- « les fiches qu'on m'a montrées »

-- Classes du personnage : « CLASSE » 1 (A9) et 2 (A11), chacune avec sa spécialité (I9, I11 : choisie au niveau de classe 10). Les niveaux de classe
-- se déduisent de l'XP et du mode (v_personnage_niveau), ils ne sont pas stockés.
CREATE TABLE personnage_classe (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang IN (1, 2)),
  classe_id      TEXT    NOT NULL REFERENCES classe(id),
  specialite_id  TEXT,                                -- NULL tant qu'elle n'est pas choisie
  PRIMARY KEY (personnage_id, rang),
  UNIQUE (personnage_id, classe_id),
  FOREIGN KEY (specialite_id, classe_id) REFERENCES specialite (id, classe_id)   -- une spécialité de CETTE classe
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_classe_classe ON personnage_classe (classe_id);

-- Valeur de base de chaque caractéristique (E18, M18, U18, E19, M19, U19), choisie dans les bornes de la race (v_race_carac_borne) ; le total suit
-- seuil_niveau 'caracteristiques_total' (décision R3 : exactement). Le point de la magie innée (G18…) et les bonus d'accessoires se calculent.
CREATE TABLE personnage_caracteristique (
  personnage_id      TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  caracteristique_id TEXT    NOT NULL REFERENCES caracteristique(id),
  base               INTEGER NOT NULL CHECK (base >= 1),
  croix              INTEGER NOT NULL CHECK (croix BETWEEN 0 AND 2),   -- croix sous la caractéristique (cases H18, I18…), décision R19 : handicap ou malus
                                                    -- (blessure grave, trauma, maladie, mauvaise nuit) ; 1 = −20 % à tout test de la caractéristique,
                                                    -- 2 = ses compétences ne sont plus utilisables (regle_constante 'competence.croix_1_malus', 'competence.croix_2_malus')
  PRIMARY KEY (personnage_id, caracteristique_id)
) STRICT, WITHOUT ROWID;

-- Points de compétence : « Nat. » (naturel, budget de niveau_global, plafond seuil_niveau 'competence_naturel_max') et « Acquis » (bonus de race,
-- classe, don, équipement, entraînement : au plus 5 par point de caractéristique de base, guide « Compétences »). Le total (K22…) se calcule.
-- Compétence absente = 0 et 0.
CREATE TABLE personnage_competence (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  competence_id  TEXT    NOT NULL REFERENCES competence(id),
  naturel        INTEGER NOT NULL CHECK (naturel >= 0),
  acquis         INTEGER NOT NULL CHECK (acquis >= 0),
  PRIMARY KEY (personnage_id, competence_id)
) STRICT, WITHOUT ROWID;

-- Gains d'attributs à chaque niveau global à partir du 2 : les points d'attributs (niveau_global.points_attributs, 15) répartis entre santé et chakra
-- (la fiche compte F14 + M14 : BDD!K40), et le dé bonus des niveaux qui en donnent un (niveau_global.de_attributs_bonus : « 1d8 santé OU 1d8 chakra
-- OU 1d4 pour les deux »). La fiche ajoute tout à la main dans la formule de F14/M14 (« +0 ») : ici chaque gain est daté par son niveau.
CREATE TABLE personnage_progression (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  niveau         INTEGER NOT NULL REFERENCES niveau_global(niveau) CHECK (niveau >= 2),
  points_sante   INTEGER NOT NULL CHECK (points_sante >= 0),
  points_chakra  INTEGER NOT NULL CHECK (points_chakra >= 0),
  de_choix       TEXT    CHECK (de_choix IN ('sante', 'chakra', 'les_deux')),   -- NULL = pas de dé à ce niveau
  de_resultat    INTEGER CHECK (de_resultat >= 1),   -- résultat du dé, ajouté à la santé, au chakra, ou aux deux (« 1d4 pour les deux »)
  PRIMARY KEY (personnage_id, niveau),
  CHECK ((de_choix IS NULL) = (de_resultat IS NULL))
) STRICT, WITHOUT ROWID;

-- Dons de classe choisis (lignes « CLASSE 1 » / « CLASSE 2 », C43:L67) : seulement ceux qui demandent un CHOIX (v_capacite_exclusive : options d'une
-- même ligne, une spécialité contre l'autre, paliers de l'Archimage). Les dons sans alternative se déduisent de la classe, du niveau et de la spécialité.
CREATE TABLE personnage_capacite (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  capacite_id    TEXT    NOT NULL REFERENCES capacite(id),
  PRIMARY KEY (personnage_id, capacite_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_capacite_capacite ON personnage_capacite (capacite_id);

-- « LISTE DE SORTS » (AA55:AY74) : sorts de la magie innée ou acquise, avec leur niveau de maîtrise (« NM », AY ; au plus niveau global − 1, BDD!BB6).
-- Type, coût, portée, zone et effets se lisent dans `sort`.
CREATE TABLE personnage_sort (
  personnage_id    TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  sort_id          TEXT    NOT NULL REFERENCES sort(id),
  rang             INTEGER NOT NULL CHECK (rang >= 1),   -- ligne de la liste sur la fiche
  niveau_maitrise  INTEGER NOT NULL CHECK (niveau_maitrise >= 0),
  PRIMARY KEY (personnage_id, sort_id),
  UNIQUE (personnage_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX personnage_sort_sort ON personnage_sort (sort_id);

-- « Maîtrise d'armes » (AA2:AV7) : nombre de dés (1d à 5d) par famille d'armes. Famille absente = pas de maîtrise (1d). Chaque point de maîtrise
-- ajoute un dé : 4 points au plus (regle_constante 'maitrise_arme.des_sans_maitrise' et 'maitrise_arme.des_max', migration 0016).
CREATE TABLE personnage_maitrise_arme (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  arme_famille_id TEXT    NOT NULL REFERENCES arme_famille(id),
  des             INTEGER NOT NULL CHECK (des BETWEEN 1 AND 5),
  PRIMARY KEY (personnage_id, arme_famille_id)
) STRICT, WITHOUT ROWID;

-- « ARMES » (AA9:AY18) : deux emplacements, chacun une arme du catalogue, sa composition (matériau), ses améliorations et son élément.
CREATE TABLE personnage_arme (
  personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang                         INTEGER NOT NULL CHECK (rang IN (1, 2)),   -- arme 1 (AA10) ou 2 (AN10)
  arme_id                      TEXT    NOT NULL REFERENCES arme(id),
  materiau_id                  TEXT    REFERENCES materiau_arme(ressource_id),   -- « Composition » (AE10)
  amelioration_id              TEXT    REFERENCES amelioration_equipement(id),   -- « Amélioration » (AI13) : cible 'arme'
  arme_elementaire_id          TEXT    REFERENCES arme_elementaire(id),          -- « Elément » (AI16)
  amelioration_elementaire_id  TEXT    REFERENCES amelioration_equipement(id),   -- amélioration de la pièce élémentaire (AI18) : cible 'arme_elementaire'
  effet_en_plus                TEXT,                                             -- « Effet en plus » (AA12), texte libre
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

-- « ARMURE / DÉFENSE » (AA19:AX23) : une pièce par emplacement (armure complète, ou casque, torse, bras, jambes).
CREATE TABLE personnage_armure (
  personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  emplacement_id               TEXT    NOT NULL REFERENCES armure_emplacement(id),
  armure_id                    TEXT    NOT NULL REFERENCES armure(id),              -- « Nom Armure » (AD21)
  amelioration_id              TEXT    REFERENCES amelioration_equipement(id),      -- cible 'armure'
  armure_elementaire_id        TEXT    REFERENCES armure_elementaire(id),           -- « Elément » (AQ21)
  amelioration_elementaire_id  TEXT    REFERENCES amelioration_equipement(id),      -- cible 'armure_elementaire'
  PRIMARY KEY (personnage_id, emplacement_id)
) STRICT, WITHOUT ROWID;

-- Matériaux du bouclier (AF26, AJ26, AN26 et leurs quantités AH27, AL27, AP27) : au plus trois, la somme des quantités ne dépasse pas la classe
-- du bouclier (validation de AL27 : « La somme des quantités de matériaux ne doit pas dépasser la… »).
CREATE TABLE personnage_bouclier_materiau (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
  materiau_id    TEXT    NOT NULL REFERENCES materiau_bouclier(ressource_id),
  quantite       INTEGER NOT NULL CHECK (quantite >= 1),
  PRIMARY KEY (personnage_id, rang),
  UNIQUE (personnage_id, materiau_id)
) STRICT, WITHOUT ROWID;

-- « ACCESSOIRES » (AA28:AY37) : Chef, Collier, Bracelet 1 et 2, Bague 1 et 2, Ceinture, Autre. Chacun porte un effet de la table des accessoires
-- (propriété en AD29…, effet en AA30…), sa valeur tirée quand l'effet est une fourchette, et la case « Malédiction » (AD31…).
CREATE TABLE personnage_accessoire (
  personnage_id       TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  emplacement         TEXT    NOT NULL CHECK (emplacement IN ('chef', 'collier', 'bracelet-1', 'bracelet-2', 'bague-1', 'bague-2', 'ceinture', 'autre')),
  nom                 TEXT,                           -- nom donné à l'objet
  accessoire_effet_id TEXT    REFERENCES accessoire_effet(id),   -- NULL = effet hors table (texte libre ci-dessous)
  valeur              INTEGER,                        -- valeur tirée dans [bonus_min, bonus_max] de l'effet ; NULL si l'effet n'a pas de fourchette
  texte               TEXT,                           -- effet tel qu'écrit sur la fiche quand il n'est pas dans la table
  maudit              INTEGER NOT NULL CHECK (maudit IN (0, 1)),
  PRIMARY KEY (personnage_id, emplacement),
  CHECK (accessoire_effet_id IS NOT NULL OR texte IS NOT NULL)
) STRICT, WITHOUT ROWID;

-- « INVENTAIRE | SAC » (AA39:AY…) : une ligne par objet ; `ressource_id` quand l'objet est au catalogue, sinon le nom seul.
CREATE TABLE personnage_inventaire (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  nom            TEXT    NOT NULL CHECK (length(nom) > 0),
  quantite       INTEGER NOT NULL CHECK (quantite >= 1),
  ressource_id   TEXT    REFERENCES ressource(id),
  PRIMARY KEY (personnage_id, rang)
) STRICT, WITHOUT ROWID;

-- Groupe de jeu : la table d'un one-shot (« OS ») ou d'une campagne. Ses membres voient les fiches qui y sont inscrites.
CREATE TABLE groupe (
  id       TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  nom      TEXT    NOT NULL CHECK (length(nom) > 0),
  nature   TEXT    NOT NULL CHECK (nature IN ('one_shot', 'campagne')),
  cree_le  TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;

-- Membres d'un groupe et fiche inscrite (demande du propriétaire) : un joueur peut être dans plusieurs groupes et avoir plusieurs fiches, mais n'inscrit
-- qu'UNE fiche par groupe : une ligne par (groupe, membre), et inscrire une autre fiche remplace `personnage_id` (la précédente est désinscrite).
-- La fiche inscrite devient visible de tous les membres du groupe, et d'eux seuls : ses autres fiches restent cachées (v_personnage_visible).
-- On inscrit sa propre fiche ou un prétiré (v_groupe_controle).
CREATE TABLE groupe_membre (
  groupe_id       TEXT    NOT NULL REFERENCES groupe(id) ON DELETE CASCADE,
  utilisateur_id  TEXT    NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  role            TEXT    NOT NULL CHECK (role IN ('mj', 'joueur')),   -- MJ de la table ou joueur
  personnage_id   TEXT    REFERENCES personnage(id) ON DELETE SET NULL,   -- fiche inscrite ; NULL = aucune (membre qui n'a pas encore inscrit de fiche, MJ)
  rejoint_le      TEXT    NOT NULL CHECK (rejoint_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  PRIMARY KEY (groupe_id, utilisateur_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX groupe_membre_utilisateur ON groupe_membre (utilisateur_id);   -- « mes groupes »

CREATE INDEX groupe_membre_personnage ON groupe_membre (personnage_id) WHERE personnage_id IS NOT NULL;   -- « où cette fiche est inscrite »

-- Niveau global et niveaux de classe d'un personnage. Niveau global = plus haut niveau dont l'XP minimale est atteinte (Personnage!W8 :
-- VLOOKUP(S11; BDD!G2:H21; 2; 1)). Niveaux de classe : décision R2 (« un "monoclasse" choisit automatiquement sa 2e classe au niveau 11 ») :
-- mono-classe : classe 1 = min(20, 2 × niveau global), classe 2 = 2 × niveau global − classe 1 ; bi-classe : chacune = niveau global (G9, G11).
CREATE VIEW v_personnage_niveau AS
  SELECT p.id AS personnage_id, n.niveau AS niveau_global,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 20 ELSE 2 * n.niveau END AS niveau_classe_1,
         CASE WHEN p.mode_classe = 'bi' THEN n.niveau WHEN 2 * n.niveau > 20 THEN 2 * n.niveau - 20 ELSE 0 END AS niveau_classe_2
  FROM personnage p
  JOIN niveau_global n ON n.niveau = (SELECT MAX(g.niveau) FROM niveau_global g WHERE g.xp_min <= p.xp);

-- Qui voit quelle fiche (demande du propriétaire) : une ligne par (fiche, utilisateur, motif) ; un utilisateur voit une fiche s'il a au moins une ligne.
-- Motifs : 'proprietaire' ; 'admin' (toutes les fiches) ; 'tous' (visibilité 'tous', donc tout prétiré) ; 'mj' (visibilité 'mj' : utilisateurs de rôle
-- 'mj') ; 'groupe' (membres du groupe `groupe_id` où la fiche est inscrite) ; 'partage' (utilisateur désigné par le propriétaire).
CREATE VIEW v_personnage_visible AS
  SELECT p.id AS personnage_id, p.proprietaire_id AS utilisateur_id, 'proprietaire' AS motif, NULL AS groupe_id
  FROM personnage p WHERE p.proprietaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'admin', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE r.role = 'admin'
  UNION ALL
  SELECT p.id, u.id, 'tous', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE p.visibilite = 'tous'
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'mj', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE p.visibilite = 'mj' AND r.role = 'mj'
  UNION ALL
  SELECT i.personnage_id, m.utilisateur_id, 'groupe', i.groupe_id
  FROM groupe_membre i JOIN groupe_membre m ON m.groupe_id = i.groupe_id
  WHERE i.personnage_id IS NOT NULL
  UNION ALL
  SELECT s.personnage_id, s.utilisateur_id, 'partage', NULL
  FROM personnage_partage s;

-- Contrôle des inscriptions dans les groupes : une ligne par anomalie (vide = conforme). Un membre inscrit sa propre fiche ou un prétiré.
CREATE VIEW v_groupe_controle AS
  SELECT m.groupe_id, m.utilisateur_id, 'fiche_d_un_autre' AS regle, m.personnage_id AS detail
  FROM groupe_membre m JOIN personnage p ON p.id = m.personnage_id
  WHERE p.nature = 'joueur' AND p.proprietaire_id <> m.utilisateur_id;

-- Contrôle d'une fiche : une ligne par règle enfreinte (vide = fiche conforme pour ces règles). `regle` est une clé stable ; `detail` dit quoi.
-- Seules des règles écrites dans la base sont vérifiées (matrices de la fiche, onglets, guide, décisions R2, R3, R8, R11, R15, R16, R20, R23) ; ce qui
-- demande le moteur (bonus de classe, d'équipement, nombre de sorts, plafond de NPM du Potentiel Illimité) n'est pas ici. Une fiche 'brouillon' peut
-- avoir des lignes, une fiche 'valide' non (test).
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
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
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE p.race_id IS NULL OR e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id IS NOT NULL AND (p.magie_innee_id IS NULL OR e.magie_id <> p.magie_innee_id)
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
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
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3) ; acquis au plus 5 par point de caractéristique de base
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.statut <> 'brouillon'
    AND COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  SELECT pco.personnage_id, 'competence_acquis_max', pco.competence_id || ' = ' || pco.acquis
  FROM personnage_competence pco
  JOIN competence co ON co.id = pco.competence_id
  JOIN personnage_caracteristique pca ON pca.personnage_id = pco.personnage_id AND pca.caracteristique_id = co.caracteristique_id
  WHERE pco.acquis > pca.base * (SELECT r.valeur FROM regle_constante r WHERE r.id = 'competence.acquis_max_par_point_caracteristique')
  UNION ALL
  -- Progression : un gain par niveau atteint (2 à niveau global), points d'attributs exacts (R3), dé seulement aux niveaux qui en donnent un
  SELECT pp.personnage_id, 'progression_niveau_non_atteint', CAST(pp.niveau AS TEXT)
  FROM personnage_progression pp JOIN v_personnage_niveau n ON n.personnage_id = pp.personnage_id
  WHERE pp.niveau > n.niveau_global
  UNION ALL
  SELECT n.personnage_id, 'progression_manquante', CAST(g.niveau AS TEXT)
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN niveau_global g ON g.niveau BETWEEN 2 AND n.niveau_global
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_progression pp WHERE pp.personnage_id = n.personnage_id AND pp.niveau = g.niveau)
  UNION ALL
  SELECT pp.personnage_id, 'progression_points', pp.niveau || ' : ' || (pp.points_sante + pp.points_chakra) || ' / ' || COALESCE(g.points_attributs, 0)
  FROM personnage_progression pp JOIN niveau_global g ON g.niveau = pp.niveau
  WHERE pp.points_sante + pp.points_chakra <> COALESCE(g.points_attributs, 0)
  UNION ALL
  SELECT pp.personnage_id, 'progression_de', CAST(pp.niveau AS TEXT)
  FROM personnage_progression pp JOIN niveau_global g ON g.niveau = pp.niveau
  WHERE (pp.de_choix IS NULL) <> (g.de_attributs_bonus IS NULL)
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n JOIN personnage p ON p.id = n.personnage_id
  WHERE p.statut <> 'brouillon' AND n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n JOIN personnage p ON p.id = n.personnage_id
  WHERE p.statut <> 'brouillon'
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
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
  -- les personnages avec une magie acquise » ne comptant pas pour eux ; NM au plus niveau global − 1 (BDD!BB6) ; total des NM au plus les NM gagnés
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
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global')
  UNION ALL
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / ' || v.niveaux_maitrise_cumul
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE (SELECT SUM(ps.niveau_maitrise) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul
  UNION ALL
  -- Bouclier : des matériaux seulement avec un bouclier, quantités au plus la classe du bouclier (validation de Personnage!AL27)
  SELECT p.id, 'bouclier_quantite', SUM(m.quantite) || ' / ' || COALESCE(MAX(bc.classe), 0)
  FROM personnage p
  JOIN personnage_bouclier_materiau m ON m.personnage_id = p.id
  LEFT JOIN bouclier_classe bc ON bc.id = p.bouclier_classe_id
  GROUP BY p.id
  HAVING SUM(m.quantite) > COALESCE(MAX(bc.classe), 0)
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
  SELECT pa.personnage_id, 'amelioration_cible', pa.emplacement_id || ' : ' || ae.id
  FROM personnage_armure pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.emplacement_id || ' : ' || ae.id
  FROM personnage_armure pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;

-- ====================================================================================================================
-- 14. ÉDITION : le journal des modifications faites depuis le site de dev (saisie, jamais importée ; migration 0017)
-- Demande du propriétaire : sur le site de dev (serveur de test, service lancé avec MAVERICK_EDITION=1), les pages du guide, des races, des magies,
-- des classes et des métiers se modifient en place. Le service écrit chaque modification dans la base vivante ET dans ce journal, dans la même
-- transaction (docs/sql/conception.md §10.3) : une ligne par ligne de table touchée (dérivées comprises), avec ses valeurs avant et après. Le journal
-- sert à trois choses : rejouer les modifications quand une livraison refait la base vivante (client/serveur/edition-journal.mjs), montrer sur les
-- pages statiques ce qui a changé depuis leur construction, et rapatrier les modifications dans data/rows (`npm run db:appliquer-edition`).
-- Comme la section 13, ces tables n'ont ni `origine`, ni `source_ref`, ni `remarque`, et data/rows les garde VIDES. Instants : ISO 8601 en UTC.
-- ====================================================================================================================

-- Un enregistrement fait depuis une page (le bouton de confirmation) : toutes ses modifications passent ou aucune.
CREATE TABLE modification_lot (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),   -- UUID tiré par le service
  fait_le    TEXT    NOT NULL CHECK (fait_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  auteur_id  TEXT    REFERENCES utilisateur(id),                     -- NULL avant la connexion Discord (1.0) : quiconque ouvre le site de dev
  page_id    TEXT    CHECK (page_id IS NULL OR length(page_id) > 0), -- page d'où l'enregistrement est fait (« races/elfe-noir ») ; sans clé étrangère :
                                                                     -- une page créée par l'édition peut ne pas encore être dans les règles livrées
  resume     TEXT    NOT NULL CHECK (length(resume) > 0)             -- « Métier Forgeron : bonus_brut » : ce que le service a fait, lisible
) STRICT;

-- Une ligne de table touchée par un lot. `cle` = la clé primaire de la ligne ({"id": "metiers/forgeron"}) ; `avant` / `apres` = les colonnes
-- modifiées (toute la ligne pour une insertion ou une suppression). État : 'en_attente' (dans la base vivante, pas encore dans data/rows),
-- 'integree' (les règles livrées la contiennent déjà : elle est revenue par git), 'conflit' (les règles livrées ont changé la ligne autrement :
-- elle n'est pas rejouée, `detail` dit pourquoi).
CREATE TABLE modification (
  lot_id     TEXT    NOT NULL REFERENCES modification_lot(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),                     -- ordre d'application dans le lot
  table_nom  TEXT    NOT NULL CHECK (length(table_nom) > 0 AND table_nom NOT GLOB '*[^a-z0-9_]*'),
  cle        TEXT    NOT NULL CHECK (json_valid(cle) AND json_type(cle) = 'object'),
  operation  TEXT    NOT NULL CHECK (operation IN ('inserer', 'modifier', 'supprimer')),
  avant      TEXT    CHECK (avant IS NULL OR (json_valid(avant) AND json_type(avant) = 'object')),
  apres      TEXT    CHECK (apres IS NULL OR (json_valid(apres) AND json_type(apres) = 'object')),
  etat       TEXT    NOT NULL CHECK (etat IN ('en_attente', 'integree', 'conflit')),
  detail     TEXT,                                                   -- raison d'un conflit ; NULL sinon
  PRIMARY KEY (lot_id, rang),
  CHECK ((operation = 'inserer') = (avant IS NULL)),
  CHECK ((operation = 'supprimer') = (apres IS NULL)),
  CHECK ((etat = 'conflit') = (detail IS NOT NULL))
) STRICT;
CREATE INDEX modification_etat ON modification (etat);
CREATE INDEX modification_ligne ON modification (table_nom, cle);

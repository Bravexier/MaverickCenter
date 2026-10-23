-- 0081-r167-armes-elementaires : les armes élémentaires (décision R167 du propriétaire, 2026-10-23 ; cahier des charges de game-design). Migration de
-- STRUCTURE et de DONNÉES. Chaque partie a sa garde : une table temporaire dont le CHECK fait refuser toute la migration si les lignes ne sont pas
-- celles attendues (comme 0069) ; client/test/db-armes-elementaires.test.mjs épingle ensuite le résultat. Écrite d'abord sous le numéro 0077 (la décision
-- sous le numéro R159, puis R164), renumérotée après les migrations 0077 (arme_famille.nom_lecture, décision R159 : familles renommées ou créées sur le
-- site de dev), 0078 (décision R160 : arme_elementaire reconstruite sous sa contrainte arme_elementaire_sans_potentiel_illimite, que celle-ci ne touche
-- pas), 0079 (décision R164 : l'étiquette « Sort fer », sort_mot_cle 'sort-fer', par laquelle se reconnaissent les sorts « Fer » : rien ici) et 0080
-- (décision R165 : l'armure élémentaire de la fiche, v_personnage_controle refaite, que celle-ci recrée avec ses règles d'armure ; la constante
-- 'piece_elementaire.solidite_base' = 4, « Chaque pièce élémentaire possède 4 crans de solidité/durabilité », qui donne aussi la solidité de base
-- d'une arme élémentaire : 4 + les crans de la ligne d'amélioration fondue des armes). Les cibles 'armure_elementaire' d'amelioration_equipement
-- (leur propre tableau) sont recopiées telles quelles.
--   1. Le tableau d'amélioration des armes fondu (« il faudrai mélanger les deux tableaux d'amélioration (dans la DB uniquement) pour avoir
--      "Niveau|Coût matériel|Coût élémentaire| effet" ») : les dix lignes de cible 'arme' (Armes › O35:T53, ids gardés) reçoivent le coût élémentaire des
--      dix lignes 'arme_elementaire' du même niveau (Pièces élémentaires › A60:F78) : cout_elementaire_brut (le coût écrit), cout_gemmes,
--      cout_gemmes_qualite, cout_pieces_elementaires, et la plage citée dans source_ref ; puis les lignes 'arme_elementaire' partent avec leurs liens
--      page_entite (la page « Pièces élémentaires » garde son tableau, du Markdown). Garde : les effets écrits et typés (effet_brut, bonus_degats,
--      bonus_ap, bonus_am, bonus_cran) sont les mêmes niveau par niveau, et aucune remarque, note de cellule ni écart ne vise les lignes fondues.
--      La table est reconstruite (la cible 'arme_elementaire' quitte son CHECK ; CHECK « coût élémentaire ssi arme »). amelioration_total garde ses deux
--      lignes d'arme : 'arme' (coût matériel) et 'arme_elementaire' (coût élémentaire, B80:F80, contrôle du cumul).
--   2. Les types élémentaires (arme_elementaire_type) : les 11 en-têtes de type de l'onglet Pièces élémentaires (Q8 à Q78), avec ce qu'ils écrivent pour
--      toutes les armes du type : « ignore 4 AP » (Arbalète, Q64) et « Ces armes sont que en un exemplaire » (Arme de jet Q71, Bombe Q78), la mention
--      de ces deux en-têtes dans la forme de la page (orthographe de 0005) ; en-tête brut gardé tel qu'écrit. La compétence de l'arme élémentaire, au
--      choix du porteur (arme_elementaire_type_competence ; réponse du propriétaire consignée sous R167 : « Mêlée / arme de jets / bombes  => Légère /
--      Lourde Arc => Arc / Légère Arbalète => Arbalète »). Le type physique (arme_elementaire_type_degats ; R167 : « Les deux. Exactement pour les
--      sorts de "Fer". Estoc + Feu pour un arc de feu par exemple. », le type de la magie étant arme_elementaire.magie_id) : le plus fréquent dans les armes
--      de la famille, posé par la décision (« Épée = Taille, Dague = Estoc+Taille, Masse = Frappe, Hache = Taille, Lance = Estoc, Pugilat = Frappe, Arme
--      de jet = Estoc » ; Bâton de combat Frappe, Arc et Arbalète Estoc ; Bombe : « Au choix » entre Estoc, Frappe et Taille, d'où
--      arme_elementaire_type.type_degats_au_choix).
--   3. La famille → le type élémentaire (arme_famille.type_elementaire_id, ajoutée après nom_lecture ; « la transformation suit la famille sous laquelle
--      l'arme est listée ») : les 11 familles maîtrisables de l'import, par leur identifiant (figé : un renommage du site ne change rien) ; ARME DE
--      MONSTRES : NULL (aucun élément proposé, question Q49) ; une famille créée sur le site de dev (R159 ; repérée par son insertion dans
--      historique_modification) : NULL, elle n'a aucune arme élémentaire (R167 : « Aucune »).
--   4. Section 13 (data/rows garde les tables des fiches vides) : personnage_arme reconstruite, un seul modèle d'arme (une arme du catalogue avec son
--      matériau, ou une arme élémentaire sans matériau ; un seul niveau d'amélioration, cible 'arme') ; amelioration_elementaire_id disparaît. La base
--      vivante convertit ses fiches (serveur/base-vivante.mjs : LIGNES_ECARTEES et COLONNES_CONVERTIES, convertirLesArmesDAvant). Nouvelle colonne
--      type_degats_choisi : le type physique choisi d'une bombe élémentaire (R167, « Au choix »). v_personnage_controle : amelioration_cible n'a plus que
--      la cible 'arme' ; nouvelles règles arme_elementaire_hors_magie et arme_type_degats_choisi.

DROP VIEW v_personnage_controle;


-- 1. Le tableau d'amélioration des armes fondu

CREATE TEMP TABLE garde_0081_ameliorations (
  niveaux         INTEGER NOT NULL CHECK (niveaux = 10),   -- les niveaux 1 à 10, une ligne 'arme' et une 'arme_elementaire' chacun
  memes_effets    INTEGER NOT NULL CHECK (memes_effets = 10),
  sans_remarque   INTEGER NOT NULL CHECK (sans_remarque = 10),
  traces          INTEGER NOT NULL CHECK (traces = 0)
);
INSERT INTO garde_0081_ameliorations
SELECT count(*),
       count(*) FILTER (WHERE a.effet_brut = e.effet_brut AND a.bonus_degats IS e.bonus_degats AND a.bonus_ap IS e.bonus_ap AND a.bonus_am IS e.bonus_am
                              AND a.bonus_cran IS e.bonus_cran),
       count(*) FILTER (WHERE e.remarque IS NULL),
       (SELECT count(*) FROM note_cellule n WHERE n.entite_table = 'amelioration_equipement' AND n.entite_id IN
          (SELECT id FROM amelioration_equipement WHERE cible = 'arme_elementaire'))
       + (SELECT count(*) FROM ecart_source x WHERE x.entite_table = 'amelioration_equipement' AND x.entite_id IN
          (SELECT id FROM amelioration_equipement WHERE cible = 'arme_elementaire'))
FROM amelioration_equipement a
JOIN amelioration_equipement e ON e.cible = 'arme_elementaire' AND e.niveau = a.niveau
WHERE a.cible = 'arme' AND a.niveau BETWEEN 1 AND 10;
DROP TABLE garde_0081_ameliorations;

CREATE TABLE amelioration_equipement_0081 (
  id                     TEXT    NOT NULL PRIMARY KEY,   -- '<page>#amelioration:<cible>:<niveau>'
  cible                  TEXT    NOT NULL CHECK (cible IN ('arme', 'armure', 'bouclier', 'armure_elementaire')),
  niveau                 INTEGER NOT NULL CHECK (niveau BETWEEN 1 AND 10),
  cout_brut              TEXT    NOT NULL,               -- le coût écrit ; d'une arme : le coût matériel (« 1 Matériel + 50 RO »)
  cout_ro                INTEGER CHECK (cout_ro IS NULL OR cout_ro >= 0),    -- montant en RO écrit dans le coût ; NULL si le coût n'en contient pas
  cout_materiaux         INTEGER CHECK (cout_materiaux IS NULL OR cout_materiaux >= 1),   -- nombre de « Matériel(s) » / « Matériau(x) »
  -- gemmes et pièce élémentaire : du coût élémentaire (cout_elementaire_brut) pour une arme, du coût (cout_brut) pour une armure élémentaire
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
  cout_elementaire_brut  TEXT    CHECK (cout_elementaire_brut IS NULL OR length(cout_elementaire_brut) > 0),   -- d'une arme (et d'elle seule) : le coût
                                                         -- élémentaire tel qu'écrit dans l'onglet Pièces élémentaires (« 2 gemmes communes », « 1 pièce élémentaire »)
  UNIQUE (cible, niveau),
  CHECK ((cout_gemmes IS NULL) = (cout_gemmes_qualite IS NULL)),
  CHECK ((cible = 'arme') = (cout_elementaire_brut IS NOT NULL))
) STRICT;

INSERT INTO amelioration_equipement_0081 (id, cible, niveau, cout_brut, cout_ro, cout_materiaux, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires,
                                          effet_brut, bonus_degats, bonus_ap, bonus_am, bonus_cran, page_id, origine, source_ref, remarque, cout_elementaire_brut)
SELECT a.id, a.cible, a.niveau, a.cout_brut, a.cout_ro, a.cout_materiaux,
       CASE WHEN a.cible = 'arme' THEN e.cout_gemmes ELSE a.cout_gemmes END,
       CASE WHEN a.cible = 'arme' THEN e.cout_gemmes_qualite ELSE a.cout_gemmes_qualite END,
       CASE WHEN a.cible = 'arme' THEN e.cout_pieces_elementaires ELSE a.cout_pieces_elementaires END,
       a.effet_brut, a.bonus_degats, a.bonus_ap, a.bonus_am, a.bonus_cran, a.page_id, a.origine,
       CASE WHEN a.cible = 'arme' THEN a.source_ref || ' ; ' || e.source_ref ELSE a.source_ref END,
       a.remarque,
       CASE WHEN a.cible = 'arme' THEN e.cout_brut END
FROM amelioration_equipement a
LEFT JOIN amelioration_equipement e ON a.cible = 'arme' AND e.cible = 'arme_elementaire' AND e.niveau = a.niveau
WHERE a.cible <> 'arme_elementaire';

DELETE FROM page_entite WHERE entite_table = 'amelioration_equipement'
  AND entite_id IN (SELECT id FROM amelioration_equipement WHERE cible = 'arme_elementaire');

DROP TABLE amelioration_equipement;
ALTER TABLE amelioration_equipement_0081 RENAME TO amelioration_equipement;

CREATE INDEX amelioration_equipement_page_fk ON amelioration_equipement (page_id);


-- 2. Les types élémentaires (en-têtes de type de l'onglet Pièces élémentaires)

CREATE TABLE arme_elementaire_type (
  type_id            TEXT    NOT NULL PRIMARY KEY REFERENCES arme_type(id),
  entete_brut        TEXT    NOT NULL CHECK (length(entete_brut) > 0),   -- l'en-tête tel qu'écrit (« que en », « revienne » de la source gardés)
  ignore_ap          INTEGER CHECK (ignore_ap IS NULL OR ignore_ap >= 0),   -- « ignore N AP » de l'en-tête (Arbalète, Q64 : 4), comme arme.ignore_ap ; NULL sinon
  exemplaire_unique  INTEGER NOT NULL CHECK (exemplaire_unique IN (0, 1)),   -- 1 : « Ces armes sont que en un exemplaire » (Arme de jet Q71, Bombe Q78 ;
                                                    -- R167 : en un seul exemplaire, sans coût à l'unité) ; 0 : l'en-tête ne le dit pas
  mention            TEXT    CHECK (mention IS NULL OR length(mention) > 0),   -- la mention de l'en-tête que la page des armes affiche, dans la forme de la page
                                                    -- « Pièces élémentaires » (orthographe corrigée par la migration 0005) : « Ces armes sont qu'en un exemplaire et
                                                    -- reviennent toujours dans la main du lanceur (sauf EC) » (Arme de jet, Bombe) ; rien n'en est calculé ; NULL sinon
  ordre              INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang de l'en-tête, de haut en bas
  origine            TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref         TEXT    NOT NULL CHECK (length(source_ref) > 0),   -- « Ressources et Craft › Pièces élémentaires › Q64 »
  -- types physiques de l'arme (arme_elementaire_type_degats, décision R167, pas l'en-tête) : 0, tous ceux du type s'appliquent (Dague : Estoc et Taille) ;
  -- 1, le porteur en choisit un seul (Bombe : « Au choix » entre Estoc, Frappe et Taille ; le choix est personnage_arme.type_degats_choisi)
  type_degats_au_choix INTEGER NOT NULL CHECK (type_degats_au_choix IN (0, 1)),
  CHECK (mention IS NULL OR exemplaire_unique = 1)
) STRICT;

INSERT INTO arme_elementaire_type (type_id, entete_brut, ignore_ap, exemplaire_unique, mention, ordre, origine, source_ref, type_degats_au_choix) VALUES
  ('epee', 'ÉPÉE', NULL, 0, NULL, 1, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q8', 0),
  ('dague', 'DAGUE', NULL, 0, NULL, 2, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q15', 0),
  ('masse', 'MASSE', NULL, 0, NULL, 3, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q22', 0),
  ('hache', 'HACHE', NULL, 0, NULL, 4, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q29', 0),
  ('arme-dhast', 'ARME D''HAST' || char(10) || '(Portée : 1-2)', NULL, 0, NULL, 5, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q36', 0),
  ('pugilat', 'PUGILAT', NULL, 0, NULL, 6, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q43', 0),
  ('baton-de-combat', 'BÂTON DE COMBAT' || char(10) || '(Portée : 1-2)', NULL, 0, NULL, 7, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q50', 0),
  ('arc', 'ARC' || char(10) || '(Portée : 2-10)', NULL, 0, NULL, 8, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q57', 0),
  ('arbalete', 'ARBALETE' || char(10) || '(Portée : 2-10, ignore 4 AP)', 4, 0, NULL, 9, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q64', 0),
  ('arme-de-jet', 'ARME DE JET' || char(10) || '(Ces armes sont que en un exemplaire et revienne toujours dans la main du lanceur (sauf EC))', NULL, 1, 'Ces armes sont qu''en un exemplaire et reviennent toujours dans la main du lanceur (sauf EC)', 10, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q71', 0),
  ('bombe', 'BOMBE' || char(10) || '(Ces armes sont que en un exemplaire et revienne toujours dans la main du lanceur (sauf EC))', NULL, 1, 'Ces armes sont qu''en un exemplaire et reviennent toujours dans la main du lanceur (sauf EC)', 11, 'equipement', 'Ressources et Craft › Pièces élémentaires › Q78', 1);

-- Compétence d'une arme élémentaire, au choix du porteur parmi celles de son type (décision R167 : « l'arme s'adapte au porteur » ; réponse du
-- propriétaire, migration 0081 : « Mêlée / arme de jets / bombes  => Légère / Lourde Arc => Arc / Légère Arbalète => Arbalète ») : les 7 types de mêlée,
-- l'arme de jet et la bombe, Arme légère ou Arme lourde ; l'arc, Arc ou Arme légère ; l'arbalète, Arbalète seule. Une ligne par compétence possible ;
-- rien n'est lu dans arme.competence_brut de l'arme d'origine (elle perd tout).
CREATE TABLE arme_elementaire_type_competence (
  type_id        TEXT    NOT NULL REFERENCES arme_elementaire_type(type_id),
  competence_id  TEXT    NOT NULL REFERENCES competence(id) CHECK (competence_id IN ('arme-legere', 'arme-lourde', 'arc', 'arbalete')),
  PRIMARY KEY (type_id, competence_id)
) STRICT, WITHOUT ROWID;

-- Type physique d'une arme élémentaire (décision R167 : « Les deux. Exactement pour les sorts de "Fer". Estoc + Feu pour un arc de feu par exemple. » :
-- le type physique de sa famille et celui de sa magie, arme_elementaire.magie_id, qui n'est pas ici). Le type physique de chaque type élémentaire est le
-- plus fréquent dans les armes de sa famille (arme_degats ; réponse du propriétaire au choix « Le plus fréquent » : « Épée = Taille, Dague = Estoc+Taille,
-- Masse = Frappe, Hache = Taille, Lance = Estoc, Pugilat = Frappe, Arme de jet = Estoc » ; Bâton de combat Frappe, Arc et Arbalète Estoc, le seul de leurs
-- armes ; Bombe : « Au choix »), posé par la décision, jamais recalculé depuis arme_degats. Une ligne par type physique possible ; s'appliquent-ils tous
-- (Dague) ou le porteur en choisit-il un (Bombe) : arme_elementaire_type.type_degats_au_choix.
CREATE TABLE arme_elementaire_type_degats (
  type_id        TEXT    NOT NULL REFERENCES arme_elementaire_type(type_id),
  type_degats    TEXT    NOT NULL CHECK (type_degats IN ('taille', 'estoc', 'frappe')),   -- comme arme_degats.type_degats
  origine        TEXT    NOT NULL REFERENCES famille(id) CHECK (origine IN ('equipement', 'craft', 'docs_typees')),
  source_ref     TEXT    NOT NULL CHECK (length(source_ref) > 0),   -- « Décision R167 du propriétaire (2026-10-23) »
  PRIMARY KEY (type_id, type_degats)
) STRICT, WITHOUT ROWID;
INSERT INTO arme_elementaire_type_degats (type_id, type_degats, origine, source_ref) VALUES
  ('epee', 'taille', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('dague', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('dague', 'taille', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('masse', 'frappe', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('hache', 'taille', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('arme-dhast', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('pugilat', 'frappe', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('baton-de-combat', 'frappe', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('arc', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('arbalete', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('arme-de-jet', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('bombe', 'estoc', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('bombe', 'frappe', 'equipement', 'Décision R167 du propriétaire (2026-10-23)'),
  ('bombe', 'taille', 'equipement', 'Décision R167 du propriétaire (2026-10-23)');

INSERT INTO arme_elementaire_type_competence (type_id, competence_id)
SELECT t.type_id, c.id FROM arme_elementaire_type t
JOIN competence c ON c.id IN (CASE t.type_id WHEN 'arc' THEN 'arc' WHEN 'arbalete' THEN 'arbalete' ELSE 'arme-lourde' END,
                              CASE t.type_id WHEN 'arbalete' THEN 'arbalete' ELSE 'arme-legere' END);

CREATE TEMP TABLE garde_0081_types (
  types         INTEGER NOT NULL CHECK (types = 11),
  complets      INTEGER NOT NULL CHECK (complets = 11),        -- chaque type a ses 14 armes élémentaires, une par magie autre que le Potentiel Illimité
  competences   INTEGER NOT NULL CHECK (competences = 21),     -- 9 types × (légère, lourde) + arc (arc, légère) + arbalète (arbalète)
  physiques     INTEGER NOT NULL CHECK (physiques = 11),       -- chaque type a au moins un type physique
  au_choix      INTEGER NOT NULL CHECK (au_choix = 1)          -- la Bombe seule, et elle offre trois types
);
INSERT INTO garde_0081_types
SELECT count(*), count(*) FILTER (WHERE (SELECT count(DISTINCT ae.magie_id) FROM arme_elementaire ae WHERE ae.type_id = t.type_id) = 14),
       (SELECT count(*) FROM arme_elementaire_type_competence),
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM arme_elementaire_type_degats d WHERE d.type_id = t.type_id)),
       count(*) FILTER (WHERE t.type_degats_au_choix = 1 AND t.type_id = 'bombe'
                          AND (SELECT count(*) FROM arme_elementaire_type_degats d WHERE d.type_id = t.type_id) = 3)
         - count(*) FILTER (WHERE t.type_degats_au_choix = 1 AND t.type_id <> 'bombe')
FROM arme_elementaire_type t;
DROP TABLE garde_0081_types;


-- 3. La famille → le type élémentaire

ALTER TABLE arme_famille ADD COLUMN type_elementaire_id TEXT  REFERENCES arme_elementaire_type(type_id) CHECK (type_elementaire_id IS NULL OR maitrisable = 1);

UPDATE arme_famille SET type_elementaire_id = CASE id
  WHEN 'epees' THEN 'epee' WHEN 'dagues' THEN 'dague' WHEN 'masse-marteau' THEN 'masse' WHEN 'hache' THEN 'hache'
  WHEN 'lance-arme-dhast' THEN 'arme-dhast' WHEN 'baton-de-combat' THEN 'baton-de-combat' WHEN 'arc' THEN 'arc' WHEN 'arbalete' THEN 'arbalete'
  WHEN 'arme-de-jet' THEN 'arme-de-jet' WHEN 'pugilat' THEN 'pugilat' WHEN 'bombes' THEN 'bombe' END;

CREATE TEMP TABLE garde_0081_familles (
  importees             INTEGER NOT NULL CHECK (importees = 12),             -- les 12 familles de l'import (les bandeaux de l'onglet Armes)
  importees_typees      INTEGER NOT NULL CHECK (importees_typees = 11),      -- les 11 maîtrisables de l'import, chacune son type
  importees_sans_type   INTEGER NOT NULL CHECK (importees_sans_type = 1),    -- la seule non maîtrisable (ARME DE MONSTRES), et elle seule
  types_distincts       INTEGER NOT NULL CHECK (types_distincts = 11),
  creees_typees         INTEGER NOT NULL CHECK (creees_typees = 0)           -- une famille créée sur le site de dev (R159) : aucune (R167)
);
INSERT INTO garde_0081_familles
SELECT count(*) FILTER (WHERE c.id IS NULL),
       count(*) FILTER (WHERE c.id IS NULL AND f.maitrisable = 1 AND f.type_elementaire_id IS NOT NULL),
       count(*) FILTER (WHERE c.id IS NULL AND f.type_elementaire_id IS NULL AND f.maitrisable = 0),
       count(DISTINCT f.type_elementaire_id),
       count(*) FILTER (WHERE c.id IS NOT NULL AND f.type_elementaire_id IS NOT NULL)
FROM arme_famille f
LEFT JOIN (SELECT DISTINCT json_extract(h.cle, '$.id') AS id FROM historique_modification h
           WHERE h.table_nom = 'arme_famille' AND h.operation = 'inserer') c ON c.id = f.id;
DROP TABLE garde_0081_familles;


-- 4. Section 13 : un seul modèle d'arme dans les fiches

CREATE TEMP TABLE garde_0081_fiches (
  armes  INTEGER NOT NULL CHECK (armes = 0)   -- data/rows garde les tables des fiches vides : la base vivante a sa conversion
);
INSERT INTO garde_0081_fiches SELECT count(*) FROM personnage_arme;
DROP TABLE garde_0081_fiches;

CREATE TABLE personnage_arme_0081 (
  personnage_id                TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  rang                         INTEGER NOT NULL CHECK (rang IN (1, 2)),   -- arme 1 (AA10) ou 2 (AN10)
  arme_id                      TEXT    REFERENCES arme(id),                      -- arme du catalogue (« Nom » AA10) ; NULL pour une arme élémentaire
  materiau_id                  TEXT    REFERENCES materiau_arme(ressource_id),   -- « Composition » (AE10) : d'une arme du catalogue seulement
  amelioration_id              TEXT    REFERENCES amelioration_equipement(id),   -- « Amélioration » (AI13) : le niveau, cible 'arme', pour l'une ou l'autre arme
  arme_elementaire_id          TEXT    REFERENCES arme_elementaire(id),          -- l'arme élémentaire (« Élément » AI17 de la fiche auto) ; NULL pour une arme du catalogue
  effet_en_plus                TEXT,                                             -- « Effet en plus » (AA12), texte libre
  -- Durabilité du moment (« Solidité » AK17, AX17 du modèle ordinateur ; décision R74, migration 0045) : de 0 (l'arme est cassée) au maximum de
  -- l'arme (calculé par la page, pas ici) : arme du catalogue, celui de l'arme forgée (arme + matériau + amélioration, au moins 1 : R51) ; arme
  -- élémentaire, piece_elementaire.solidite_base de constante_equipement + crans de la ligne d'amélioration (R167) ; NULL = à son maximum
  durabilite                   INTEGER CHECK (durabilite >= 0),
  -- Type physique choisi d'une arme élémentaire dont le porteur choisit le type (arme_elementaire_type.type_degats_au_choix = 1 : la Bombe, décision R167,
  -- « Au choix » entre Estoc, Frappe et Taille) ; NULL = pas de choix (seul le type de la magie compte). Un choix sur une autre arme élémentaire ou hors
  -- des types qu'offre son type élémentaire (arme_elementaire_type_degats) est signalé (v_personnage_controle, arme_type_degats_choisi), pas refusé
  type_degats_choisi           TEXT    CHECK (type_degats_choisi IN ('taille', 'estoc', 'frappe')),
  PRIMARY KEY (personnage_id, rang),
  CHECK ((arme_id IS NULL) <> (arme_elementaire_id IS NULL)),                    -- exactement l'une des deux
  CHECK (materiau_id IS NULL OR arme_id IS NOT NULL),                            -- pas de matériau sur une arme élémentaire
  CHECK (type_degats_choisi IS NULL OR arme_elementaire_id IS NOT NULL)          -- pas de type choisi sur une arme du catalogue
) STRICT, WITHOUT ROWID;

DROP TABLE personnage_arme;
ALTER TABLE personnage_arme_0081 RENAME TO personnage_arme;

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
  -- au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du MJ (décision R24). Depuis la
  -- décision R118 (migration 0066), les NM du MJ sont ceux de la fiche (personnage.nm_mj), pas d'un sort : les NM d'un sort sans celui de son livre
  -- comptent, au plus niveau global − 1 plus les NM du MJ sur un sort, au plus les NM gagnés plus ceux du MJ en tout (tant qu'un niveau donne un NM, la
  -- seconde règle implique la première, qui nomme le sort)
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
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - ps.nm_livre)
  FROM personnage_sort ps
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - ps.nm_livre > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global') + p.nm_mj
  UNION ALL
  -- NM gagnés : ceux des niveaux (v_niveau.niveaux_maitrise_cumul), plus ceux qu'écrit un don acquis (« Gagne 4 niveaux de maîtrise (NM). » de
  -- l'Ocultomancien : capacite_nm_gagne, v_personnage_don_acquis ; décision R154, migration 0076), plus ceux du MJ ; sort_nm_max ne les lit pas.
  -- Détail : « comptés / des niveaux », puis « + N des dons » et « + N du MJ » quand il y en a
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - ps.nm_livre) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / '
         || v.niveaux_maitrise_cumul || CASE WHEN d.nm > 0 THEN ' + ' || d.nm || ' des dons' ELSE '' END
         || CASE WHEN p.nm_mj > 0 THEN ' + ' || p.nm_mj || ' du MJ' ELSE '' END
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global JOIN personnage p ON p.id = n.personnage_id
  JOIN (SELECT q.id AS personnage_id, COALESCE((SELECT SUM(g.nm) FROM v_personnage_don_acquis a JOIN capacite_nm_gagne g ON g.capacite_id = a.capacite_id
                                                WHERE a.personnage_id = q.id), 0) AS nm
        FROM personnage q) d ON d.personnage_id = n.personnage_id
  WHERE (SELECT SUM(ps.niveau_maitrise - ps.nm_livre) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul + d.nm + p.nm_mj
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
  -- Maîtrises d'armes (décisions R148 à R151, migration 0076) : chaque point à choisir d'une source acquise (v_personnage_maitrise_part) a sa famille
  -- (personnage_maitrise_choix), parmi les options de sa part ; une ligne de choix relève d'une seule de ces règles : sur une famille sans maîtrise,
  -- maitrise_arme_exclue (ARME DE MONSTRES, R45) ; sinon, d'une source qui n'est plus acquise ou d'un point qu'elle n'a pas, maitrise_source_perdue ;
  -- sinon, hors des options, maitrise_hors_choix. Détail d'une ligne de choix : « source : point = famille ».
  -- Point sans famille (R148) : détail « source = nombre de points à choisir » ; l'accessoire « Un point de maîtrise d'arme » sans famille (R151),
  -- « accessoire:<emplacement> = 1 »
  SELECT a.personnage_id, 'maitrise_a_choisir', a.source_id || ' = ' || (a.points - (SELECT count(*) FROM personnage_maitrise_choix ch
                                                 WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points))
  FROM v_personnage_maitrise_part a
  WHERE a.genre = 'choix'
    AND (SELECT count(*) FROM personnage_maitrise_choix ch WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points) < a.points
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_a_choisir', 'accessoire:' || pa.emplacement || ' = ' || e.valeur
  FROM personnage_accessoire pa JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  WHERE pa.arme_famille_id IS NULL
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45),
  -- ni par un choix ni par l'accessoire (« accessoire:<emplacement> : 1 = famille »)
  SELECT ch.personnage_id, 'maitrise_arme_exclue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_arme_exclue', 'accessoire:' || pa.emplacement || ' : 1 = ' || pa.arme_famille_id
  FROM personnage_accessoire pa
  JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  JOIN arme_famille f ON f.id = pa.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  -- Choix d'une source perdue (classe changée, spécialité perdue, niveau baissé, don à choix retiré) ou d'un point que sa part n'a pas : la page retire
  -- ces choix (comme acquisChoixValables), la base les signale
  SELECT ch.personnage_id, 'maitrise_source_perdue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM v_personnage_maitrise_part a WHERE a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix'
                      AND ch.rang <= a.points)
  UNION ALL
  -- Famille qui n'est pas une option de la part (Ménestrel : les quatre familles à distance, R151 ; « sauf », R138 ; catégorie, R127)
  SELECT ch.personnage_id, 'maitrise_hors_choix', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch
  JOIN arme_famille f ON f.id = ch.arme_famille_id
  JOIN v_personnage_maitrise_part a ON a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix' AND ch.rang <= a.points
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM maitrise_arme_part_famille o WHERE o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id)
  UNION ALL
  -- Limite écrite par famille (R150 : Maître d'arme 2, Combattant libre 3, lignes Bimane, Frappeur, Mercenaire 1 ; « catégorie » = famille, seuls les
  -- points de cette source comptent) ; sans limite écrite, la même famille peut revenir. Détail : « source : famille = points / limite »
  SELECT a.personnage_id, 'maitrise_meme_famille', a.source_id || ' : ' || ch.arme_famille_id || ' = ' || COUNT(*) || ' / ' || a.limite_famille
  FROM v_personnage_maitrise_part a
  JOIN personnage_maitrise_choix ch ON ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points
  JOIN maitrise_arme_part_famille o ON o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id
  WHERE a.genre = 'choix' AND a.limite_famille IS NOT NULL
  GROUP BY a.personnage_id, a.source_id, a.limite_famille, ch.arme_famille_id
  HAVING COUNT(*) > a.limite_famille
  UNION ALL
  -- Plafond (R149) : 4 points au plus par famille (maitrise_arme.des_max − maitrise_arme.des_sans_maitrise), les sources additionnées ; au-delà, signalé
  -- sans rien refuser, les points en trop ne donnent pas de dé. Détail : « famille = points / plafond »
  SELECT m.personnage_id, 'maitrise_plafond', m.arme_famille_id || ' = ' || m.points || ' / ' || m.points_comptes
  FROM v_personnage_maitrise_arme m
  WHERE m.points > m.points_comptes
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet ; celle d'une arme, du catalogue ou élémentaire, est une ligne du tableau fondu des armes
  -- (cible 'arme' : décision R167, migration 0081)
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  -- Arme élémentaire d'une magie que le personnage n'a ni en innée ni en acquise (page « Pièces élémentaires » : « il est nécessaire de posséder la magie
  -- pour utiliser les armes ou les armures » ; décision R167 : « les armes élémentaires de ses magies (innée et acquise, sans le Potentiel Illimité) »,
  -- le Potentiel Illimité n'en ouvre aucune autre) : signalée, jamais refusée. Détail : « rang : arme élémentaire »
  SELECT pa.personnage_id, 'arme_elementaire_hors_magie', pa.rang || ' : ' || ael.id
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN personnage p ON p.id = pa.personnage_id
  WHERE ael.magie_id <> COALESCE(p.magie_innee_id, '') AND ael.magie_id <> COALESCE(p.magie_acquise_id, '')
  UNION ALL
  -- Type physique choisi (personnage_arme.type_degats_choisi ; décision R167, Bombe : « Au choix » entre Estoc, Frappe et Taille) sur une arme élémentaire
  -- dont le type ne se choisit pas (arme_elementaire_type.type_degats_au_choix = 0), ou hors des types qu'offre son type élémentaire
  -- (arme_elementaire_type_degats) : signalé, jamais refusé (une arme du catalogue, elle, le refuse : CHECK). Détail : « rang : type choisi »
  SELECT pa.personnage_id, 'arme_type_degats_choisi', pa.rang || ' : ' || pa.type_degats_choisi
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN arme_elementaire_type t ON t.type_id = ael.type_id
  WHERE pa.type_degats_choisi IS NOT NULL
    AND (t.type_degats_au_choix = 0
         OR NOT EXISTS (SELECT 1 FROM arme_elementaire_type_degats d WHERE d.type_id = t.type_id AND d.type_degats = pa.type_degats_choisi))
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure élémentaire : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'bouclier : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.bouclier_amelioration_id
  WHERE ae.cible <> 'bouclier'
  UNION ALL
  -- Armure (décisions R95, R165) : une armure, de base ou élémentaire, jamais les deux (armure_double ; détail « armure / armure élémentaire ») ; une
  -- amélioration n'existe qu'avec son armure (armure_manquante) ; jamais une armure « Familier » (armure_familier) ; une armure élémentaire d'une
  -- magie innée ou acquise du personnage (armure_magie_absente ; le Potentiel Illimité n'en a pas) ; une partie n'a de solidité que si l'armure
  -- l'a (armure_partie_hors_armure) : une armure élémentaire a ses six parties, jamais « armure-complete » ; une armure de base à solidité unifiée
  -- (armure.solidite_uni = 1) n'a que « armure-complete », les autres les six parties (sans armure, toute partie est signalée ; une armure élémentaire
  -- compte comme une armure sans cran uni). Une fiche qui porte les deux armures est jugée sur l'élémentaire.
  SELECT p.id, 'armure_double', p.armure_id || ' / ' || p.armure_elementaire_id
  FROM personnage p
  WHERE p.armure_id IS NOT NULL AND p.armure_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_id
  FROM personnage p
  WHERE p.armure_id IS NULL AND p.armure_amelioration_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_elementaire_id
  FROM personnage p
  WHERE p.armure_elementaire_id IS NULL AND p.armure_amelioration_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_familier', p.armure_id
  FROM personnage p JOIN armure a ON a.id = p.armure_id
  WHERE a.type = 'Familier'
  UNION ALL
  SELECT p.id, 'armure_magie_absente', p.armure_elementaire_id
  FROM personnage p JOIN armure_elementaire e ON e.id = p.armure_elementaire_id
  WHERE e.magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, ''))
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE (p.armure_elementaire_id IS NULL AND a.id IS NULL)
     OR (CASE WHEN p.armure_elementaire_id IS NOT NULL THEN 0 ELSE COALESCE(a.solidite_uni, 0) END = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;

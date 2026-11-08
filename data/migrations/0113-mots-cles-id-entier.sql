-- 0113-mots-cles-id-entier : identifiant entier, clé et catégories des mots-clés (lot « mots-clés : ID entier, clé, catégories », 2026-11-08). Demande
-- du propriétaire : « 1) ID devrait être un nombre ou un GUID. 2) Libelle ne devrai pas être unique. 3) Il faudrai rajouter la colonne Category […]
-- 4) Libelle_cle devrai être renommée Key. Le contenu de key serai un slug de (libelle_categories). Il faudra rajouter la table Keyword_category qui
-- liste toutes les catégories possibles de mots clés. (ID + libelle) La colonne Category des Keyword serai une liste des ID. » Réponses du propriétaire
-- (transmises par le leader-technique) : un entier auto-incrémenté ; noms français mot_cle, categorie_mot_cle, cle ; les balises et les adresses
-- citent la clé, qui suit le libellé et les catégories ; clé = slug du libellé, suivi des slugs des seules catégories qui distinguent des homonymes
-- (« namazu-race », « namazu-classe ») ; les 13 « X (classe) » (R191) redeviennent « X » avec la catégorie Classe ; catégories vides au départ, sauf
-- Classe pour ces 13 ; les catégories, dans l'ordre (ids 1 à 9), puis « Métier » et « Bestiaire » (10, 11), ajoutées par le propriétaire. Table de
-- liaison mot_cle_categorie : choix du leader-technique.
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. categorie_mot_cle (id entier, libellé, libelle_cle = normalize) et ses 11 lignes.
--   2. mot_cle reconstruite : id entier, 1 à 367 pour les 367 mots-clés de la version 110 (avant les migrations 0111 et 0112 de dev), dans l'ordre
--      binaire de l'ancien id texte, ids que le code avait déjà figés (lib/mots-cles-proteges.mjs) ; puis 368 à 407 pour les 40 mots-clés que ces deux
--      migrations ont ajoutés (liste ci-dessous, dans l'ordre binaire de leur id) ; correspondance complète : registre 0113-mots-cles-id-entier.json ; `cle` à la place de libelle_cle ; libellé sans UNIQUE ; monnaie_id (en
--      dernier) = l'ancien id quand c'était celui d'une monnaie (rf, ro, pp : R183, un mot-clé de monnaie se reconnaissait à cet id).
--      Les 13 libellés « X (classe) » perdent leur suffixe. La clé de chacun, par la règle (tools/db/maverick.py#cles_des_mots_cles) : sans homonyme,
--      normalize(libelle) ; les 13 paires race / classe raciale sont homonymes, la classe a {Classe}, la race aucune catégorie (un homonyme sans
--      catégorie propre, que le propriétaire refuse à la saisie et à db:check, mais admis dans cet état intermédiaire : la migration d'assignation des
--      catégories du même lot le rend conforme ; lecture littérale, consigne du leader-technique), d'où « x-classe » et « x ». Pour les 407, c'est exactement l'ancien libelle_cle
--      (« orios-classe » = l'ancien normalize de « Orios (classe) », « pierre-precieuse » pour l'ancien id « pp ») : `cle` le reprend, et le test le
--      recalcule par la règle.
--   3. mot_cle_categorie : Classe pour les 13 classes raciales, rien d'autre.
--   4. page_tag.tag_id et sort_mot_cle.mot_cle_id deviennent l'id entier (tables reconstruites, lignes recopiées par la correspondance).
--   5. mot_cle_ancienne_cle : les anciens ids texte qui ne sont pas la nouvelle clé mènent à leur mot-clé : pp, rf, ro, et les trois que les
--      migrations 0111 et 0112 de dev ont renommés ou créés sous un autre libellé (« attaque-et-defense » -> se-defendre, « attaquer-et-se-defendre »
--      -> attaquer, « reussites-echecs-et-critiques » -> reussites-echecs-critiques).
--   6. Textes : les balises qui citent un ancien id qui n'est pas la nouvelle clé la citent sous la nouvelle (registre, `textes`) : à la version
--      112, seules celles des trois mots-clés de dev, toutes dans page.corps_md ; aucune « {{pp…}} », « {{rf…}} », « {{ro…}} », et aucune ailleurs.
--      Le texte affiché ne change pas (« {{x}} » montre le libellé). Les autres anciens ids sont leur clé : leurs balises restent.
--   7. historique_modification : la trace d'une ligne de mot_cle, de page_tag ou de sort_mot_cle nomme le mot-clé par son id entier (clé de la ligne,
--      colonnes id, tag_id, mot_cle_id de `avant` et `apres`), et la colonne libelle_cle y devient cle : sans cela, une ligne que le site a créée ou
--      modifiée ne se retrouve plus (colonne STRICT INTEGER) et l'état d'import (lib/historique-site.mjs) la perd. Les valeurs ne changent pas. Un
--      ancien id absent de la base (« cr », fondu dans « corruption » par la migration 0090) reste tel quel. Les notes de version (section 15) ne
--      sont pas touchées.
-- Les vues : v_mot_cle refaite (`cle` à la place de libelle_cle).

DROP VIEW v_mot_cle;

-- 1. Les catégories
CREATE TABLE categorie_mot_cle (
  id          INTEGER NOT NULL PRIMARY KEY CHECK (id >= 1),
  libelle     TEXT    NOT NULL UNIQUE CHECK (length(libelle) > 0),
  libelle_cle TEXT    NOT NULL UNIQUE CHECK (length(libelle_cle) > 0 AND libelle_cle NOT GLOB '*[^a-z0-9-]*' AND libelle_cle NOT GLOB '*--*' AND libelle_cle NOT GLOB '-*' AND libelle_cle NOT GLOB '*-')
) STRICT;

INSERT INTO categorie_mot_cle (id, libelle, libelle_cle) VALUES
  (1, 'Règles', 'regles'),
  (2, 'Magie', 'magie'),
  (3, 'Race', 'race'),
  (4, 'Combat', 'combat'),
  (5, 'Fiche de personnage', 'fiche-de-personnage'),
  (6, 'Classe', 'classe'),
  (7, 'Équipement', 'equipement'),
  (8, 'Événement', 'evenement'),
  (9, 'Objet légendaire', 'objet-legendaire'),
  (10, 'Métier', 'metier'),
  (11, 'Bestiaire', 'bestiaire');

-- 2. Les mots-clés, numérotés dans l'ordre de leur ancien id
CREATE TABLE mot_cle_0113 (
  id          INTEGER NOT NULL PRIMARY KEY CHECK (id >= 1),
  libelle     TEXT    NOT NULL CHECK (length(libelle) > 0),
  cle         TEXT    NOT NULL UNIQUE CHECK (length(cle) > 0 AND cle NOT GLOB '*[^a-z0-9-]*' AND cle NOT GLOB '*--*' AND cle NOT GLOB '-*' AND cle NOT GLOB '*-'),
  description TEXT    CHECK (description IS NULL OR length(description) > 0),
  abreviation TEXT    CHECK (abreviation IS NULL OR length(abreviation) > 0),
  couleur     TEXT    CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-')),
  url         TEXT    CHECK (url IS NULL OR (url GLOB '/*' AND url NOT GLOB '//*' AND url NOT GLOB '*[^!-~]*' AND instr(url, '\') = 0)),
  verrou      INTEGER NOT NULL DEFAULT 0 CHECK (verrou IN (0,1)),
  monnaie_id  TEXT    UNIQUE REFERENCES monnaie(id) ON DELETE SET NULL
) STRICT;

INSERT INTO mot_cle_0113 (id, libelle, cle, description, abreviation, couleur, url, verrou, monnaie_id)
SELECT row_number() OVER (ORDER BY m.id IN (
         'agilite', 'ambidextrie', 'arbalete', 'arc', 'arme-legere', 'arme-lourde', 'athletisme', 'calme', 'concentration',
         'connaissance', 'diplomatie', 'distinction', 'dressage', 'equilibre', 'fermete', 'force', 'intelligence', 'intimidation',
         'jet-dattaque', 'jet-de-defense', 'localisation-des-degats', 'magie-competence', 'manipulation', 'medecine', 'meilleur-resultat',
         'negociation', 'observation', 'orientation', 'perception', 'psychologie', 'reflexe', 'reussites-echecs-et-critiques',
         'ruse', 'sabotage', 'social', 'stabilite', 'survie', 'vie-en-nature', 'vigueur', 'volonte'), m.id),
       CASE WHEN m.libelle GLOB '* (classe)' THEN substr(m.libelle, 1, length(m.libelle) - length(' (classe)')) ELSE m.libelle END,
       m.libelle_cle, m.description, m.abreviation, m.couleur, m.url, m.verrou,
       (SELECT mo.id FROM monnaie mo WHERE mo.id = m.id)
FROM mot_cle m;

-- 5. La correspondance : d'abord tous les anciens ids (pour recopier les liaisons et les traces), réduite à la fin aux clés quittées
CREATE TABLE mot_cle_ancienne_cle (
  cle        TEXT    NOT NULL PRIMARY KEY CHECK (length(cle) > 0 AND cle NOT GLOB '*[^a-z0-9-]*' AND cle NOT GLOB '*--*' AND cle NOT GLOB '-*' AND cle NOT GLOB '*-'),
  mot_cle_id INTEGER NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

INSERT INTO mot_cle_ancienne_cle (cle, mot_cle_id)
SELECT m.id, n.id FROM mot_cle m JOIN mot_cle_0113 n ON n.cle = m.libelle_cle;

-- 3. Les catégories des 13 classes raciales
CREATE TABLE mot_cle_categorie (
  mot_cle_id   INTEGER NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE,
  categorie_id INTEGER NOT NULL REFERENCES categorie_mot_cle(id) ON DELETE RESTRICT,
  PRIMARY KEY (mot_cle_id, categorie_id)
) STRICT, WITHOUT ROWID;

INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id)
SELECT a.mot_cle_id, (SELECT c.id FROM categorie_mot_cle c WHERE c.libelle_cle = 'classe')
FROM mot_cle m JOIN mot_cle_ancienne_cle a ON a.cle = m.id
WHERE m.libelle GLOB '* (classe)';

-- 4. Les liaisons
CREATE TABLE page_tag_0113 (
  page_id TEXT    NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  ordre   INTEGER NOT NULL CHECK (ordre >= 0),
  tag_id  INTEGER NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, ordre),
  UNIQUE (page_id, tag_id)
) STRICT;

INSERT INTO page_tag_0113 (page_id, ordre, tag_id)
SELECT t.page_id, t.ordre, a.mot_cle_id FROM page_tag t JOIN mot_cle_ancienne_cle a ON a.cle = t.tag_id;

CREATE TABLE sort_mot_cle_0113 (
  sort_id     TEXT    NOT NULL REFERENCES sort(id),
  mot_cle_id  INTEGER NOT NULL REFERENCES mot_cle(id),
  PRIMARY KEY (sort_id, mot_cle_id)
) STRICT, WITHOUT ROWID;

INSERT INTO sort_mot_cle_0113 (sort_id, mot_cle_id)
SELECT s.sort_id, a.mot_cle_id FROM sort_mot_cle s JOIN mot_cle_ancienne_cle a ON a.cle = s.mot_cle_id;

-- 7. Les traces : l'id entier du mot-clé, et `cle` à la place de libelle_cle
UPDATE historique_modification
SET cle = json_set(cle, '$.id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.cle, '$.id')))
WHERE table_nom = 'mot_cle' AND json_type(cle, '$.id') = 'text'
  AND json_extract(cle, '$.id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET avant = json_set(avant, '$.id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.avant, '$.id')))
WHERE table_nom = 'mot_cle' AND json_type(avant, '$.id') = 'text'
  AND json_extract(avant, '$.id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET apres = json_set(apres, '$.id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.apres, '$.id')))
WHERE table_nom = 'mot_cle' AND json_type(apres, '$.id') = 'text'
  AND json_extract(apres, '$.id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET avant = json_set(json_remove(avant, '$.libelle_cle'), '$.cle', json_extract(avant, '$.libelle_cle'))
WHERE table_nom = 'mot_cle' AND json_type(avant, '$.libelle_cle') IS NOT NULL;

UPDATE historique_modification
SET apres = json_set(json_remove(apres, '$.libelle_cle'), '$.cle', json_extract(apres, '$.libelle_cle'))
WHERE table_nom = 'mot_cle' AND json_type(apres, '$.libelle_cle') IS NOT NULL;

UPDATE historique_modification
SET avant = json_set(avant, '$.tag_id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.avant, '$.tag_id')))
WHERE table_nom = 'page_tag' AND json_type(avant, '$.tag_id') = 'text'
  AND json_extract(avant, '$.tag_id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET apres = json_set(apres, '$.tag_id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.apres, '$.tag_id')))
WHERE table_nom = 'page_tag' AND json_type(apres, '$.tag_id') = 'text'
  AND json_extract(apres, '$.tag_id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET cle = json_set(cle, '$.mot_cle_id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.cle, '$.mot_cle_id')))
WHERE table_nom = 'sort_mot_cle' AND json_type(cle, '$.mot_cle_id') = 'text'
  AND json_extract(cle, '$.mot_cle_id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET avant = json_set(avant, '$.mot_cle_id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.avant, '$.mot_cle_id')))
WHERE table_nom = 'sort_mot_cle' AND json_type(avant, '$.mot_cle_id') = 'text'
  AND json_extract(avant, '$.mot_cle_id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

UPDATE historique_modification
SET apres = json_set(apres, '$.mot_cle_id', (SELECT a.mot_cle_id FROM mot_cle_ancienne_cle a WHERE a.cle = json_extract(historique_modification.apres, '$.mot_cle_id')))
WHERE table_nom = 'sort_mot_cle' AND json_type(apres, '$.mot_cle_id') = 'text'
  AND json_extract(apres, '$.mot_cle_id') IN (SELECT a.cle FROM mot_cle_ancienne_cle a);

-- Les tables reconstruites prennent leur nom
DROP TABLE page_tag;
DROP TABLE sort_mot_cle;
DROP TABLE mot_cle;
ALTER TABLE mot_cle_0113 RENAME TO mot_cle;
ALTER TABLE page_tag_0113 RENAME TO page_tag;
ALTER TABLE sort_mot_cle_0113 RENAME TO sort_mot_cle;

CREATE INDEX page_tag_tag ON page_tag (tag_id);
CREATE INDEX sort_mot_cle_mot_cle ON sort_mot_cle (mot_cle_id);
CREATE INDEX mot_cle_categorie_categorie ON mot_cle_categorie (categorie_id);
CREATE INDEX mot_cle_ancienne_cle_mot_cle ON mot_cle_ancienne_cle (mot_cle_id);

-- 5. (fin) Seules restent les clés quittées : l'ancien id qui n'est pas la nouvelle clé
DELETE FROM mot_cle_ancienne_cle WHERE cle = (SELECT m.cle FROM mot_cle m WHERE m.id = mot_cle_ancienne_cle.mot_cle_id);

-- 6. Les balises des anciens ids qui ne sont pas la nouvelle clé (formes « {{x}} », « {{x|… », « {{x\|… », « {{x:}} »)
UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{attaque-et-defense}}', '{{se-defendre}}'), '{{attaque-et-defense|', '{{se-defendre|'), '{{attaque-et-defense\|', '{{se-defendre\|'), '{{attaque-et-defense:}}', '{{se-defendre:}}')
WHERE instr(corps_md, '{{attaque-et-defense') > 0;
UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{attaquer-et-se-defendre}}', '{{attaquer}}'), '{{attaquer-et-se-defendre|', '{{attaquer|'), '{{attaquer-et-se-defendre\|', '{{attaquer\|'), '{{attaquer-et-se-defendre:}}', '{{attaquer:}}')
WHERE instr(corps_md, '{{attaquer-et-se-defendre') > 0;
UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{reussites-echecs-et-critiques}}', '{{reussites-echecs-critiques}}'), '{{reussites-echecs-et-critiques|', '{{reussites-echecs-critiques|'), '{{reussites-echecs-et-critiques\|', '{{reussites-echecs-critiques\|'), '{{reussites-echecs-et-critiques:}}', '{{reussites-echecs-critiques:}}')
WHERE instr(corps_md, '{{reussites-echecs-et-critiques') > 0;

CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description,                                                         -- la définition du glossaire (migration 0056 ; NULL : pas encore décrit)
    m.abreviation,                                                         -- l'abréviation (migration 0090 ; NULL : aucune)
    m.couleur,                                                             -- la référence de couleur (migration 0098 ; NULL : aucune)
    m.url                                                                  -- l'adresse interne où mène le mot-clé (migration 0098 ; NULL : aucune)
  FROM mot_cle m;

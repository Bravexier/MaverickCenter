-- 0115-mots-cles-synonymes : les synonymes des mots-clés (décision R233, lot « mots-clés : ID entier, clé, catégories, synonymes », 2026-11-08).
-- Demande du propriétaire : « Il faudra aussi prévoir plieurs labelles secondaires pour les cas des tages avec des synonymes (exemple : Action bonus /
-- Action rapide / Instant Cast) » ; réponses : S5 « Les fusionner » ; S7 « Un synonyme » (l'abréviation devient un synonyme parmi d'autres) ;
-- S4 « Non, unique » ; S6 « Oui, protégés ».
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. mot_cle_synonyme (id entier, mot-clé, écriture, écriture normalisée unique, ordre).
--   2. Les 20 abréviations de mot_cle.abreviation deviennent le premier synonyme (ordre 0) de leur mot-clé, ids 1 à 20 dans l'ordre de l'id du
--      mot-clé (AM, AP, BA, CK, CR, EP, INI, IC, MJ, Nat., NM, NPM, PJ, PNJ, XP, PO, PP, RC, RF, RO). Leur écriture normalisée est
--      lower(replace(abreviation, '.', '')), égale à normalize() pour ces 20 écritures de lettres ASCII et d'un point (le test le vérifie ; le CHECK de
--      libelle_cle refuserait toute autre). La table monnaie et monnaie.abreviation ne changent pas (R233 (7)).
--   3. « Action bonus » (id 6) et « Action rapide » (id 7) sont fondus dans « Instant Cast » (id 163) (R233 (5)) : leurs libellés deviennent ses
--      synonymes, après « IC » (ordres 1 et 2, ids 21 et 22 ; écriture normalisée = leur clé). Leurs clés vont dans mot_cle_ancienne_cle vers 163 (une
--      balise d'un ancien lot du journal, une ancienne adresse mènent à Instant Cast), comme les clés qu'ils auraient quittées. Ce qui les cite est
--      reporté sur 163 : étiquettes de page (page_tag : la première des deux sur une page qui ne porte pas déjà 163, à sa place ; les autres
--      retirées), étiquettes de sort (sort_mot_cle), catégories (mot_cle_categorie) ; à la version 114, ils n'en ont aucune. Leurs balises
--      citent Instant Cast (registre, `textes`) : « {{x|texte}} » et « {{x\|texte}} » gardent leur texte, « {{x}} » affiche le synonyme
--      (« {{instant-cast|Action rapide}} », R233 (2)), « {{x:}} » devient « {{instant-cast:}} ». À la version 114, une seule, dans page.corps_md
--      (guide/attaquer-et-se-defendre, écrite par la migration 0112 de dev) ; aucune ailleurs (leurs propres définitions, « Voir
--      {{instant-cast|IC}}. », partent avec eux). Puis les deux lignes sont supprimées ; leurs dépendants sont retirés explicitement (la
--      migration s'exécute clés étrangères suspendues, sans cascade). Le registre 0115-mots-cles-synonymes.json garde leur fiche pour le rejeu.
--   4. mot_cle perd la colonne abreviation (ALTER TABLE … DROP COLUMN) ; la vue v_mot_cle est refaite sans elle.
-- Traces : aucune ligne de historique_modification ne contient « abreviation », ne nomme le mot-clé 6 ou 7 (clé, tag_id, mot_cle_id), ni ne cite
-- « action-bonus » ou « action-rapide » (requêtes à la version 114) : aucune n'est à traduire.

DROP VIEW v_mot_cle;

-- 1. Les synonymes
CREATE TABLE mot_cle_synonyme (
  id          INTEGER NOT NULL PRIMARY KEY CHECK (id >= 1),
  mot_cle_id  INTEGER NOT NULL REFERENCES mot_cle(id) ON DELETE CASCADE,
  libelle     TEXT    NOT NULL CHECK (length(libelle) > 0),
  libelle_cle TEXT    NOT NULL UNIQUE CHECK (length(libelle_cle) > 0 AND libelle_cle NOT GLOB '*[^a-z0-9-]*' AND libelle_cle NOT GLOB '*--*' AND libelle_cle NOT GLOB '-*' AND libelle_cle NOT GLOB '*-'),
  ordre       INTEGER NOT NULL CHECK (ordre >= 0)
) STRICT;
CREATE INDEX mot_cle_synonyme_mot_cle ON mot_cle_synonyme (mot_cle_id, ordre);

-- 2. Les abréviations, premier synonyme de leur mot-clé
INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre)
SELECT row_number() OVER (ORDER BY m.id), m.id, m.abreviation, lower(replace(m.abreviation, '.', '')), 0
FROM mot_cle m WHERE m.abreviation IS NOT NULL;

-- 3. Action bonus et Action rapide, fondus dans Instant Cast
INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre)
SELECT (SELECT coalesce(max(s.id), 0) FROM mot_cle_synonyme s) + row_number() OVER (ORDER BY m.id), 163, m.libelle, m.cle,
       (SELECT coalesce(max(s.ordre), -1) FROM mot_cle_synonyme s WHERE s.mot_cle_id = 163) + row_number() OVER (ORDER BY m.id)
FROM mot_cle m WHERE m.id IN (6, 7);

UPDATE mot_cle_ancienne_cle SET mot_cle_id = 163 WHERE mot_cle_id IN (6, 7);
INSERT INTO mot_cle_ancienne_cle (cle, mot_cle_id) SELECT m.cle, 163 FROM mot_cle m WHERE m.id IN (6, 7);

UPDATE page_tag SET tag_id = 163
WHERE tag_id IN (6, 7)
  AND NOT EXISTS (SELECT 1 FROM page_tag t WHERE t.page_id = page_tag.page_id
                  AND (t.tag_id = 163 OR (t.tag_id IN (6, 7) AND t.ordre < page_tag.ordre)));
DELETE FROM page_tag WHERE tag_id IN (6, 7);

INSERT OR IGNORE INTO sort_mot_cle (sort_id, mot_cle_id) SELECT s.sort_id, 163 FROM sort_mot_cle s WHERE s.mot_cle_id IN (6, 7);
DELETE FROM sort_mot_cle WHERE mot_cle_id IN (6, 7);

INSERT OR IGNORE INTO mot_cle_categorie (mot_cle_id, categorie_id) SELECT 163, c.categorie_id FROM mot_cle_categorie c WHERE c.mot_cle_id IN (6, 7);
DELETE FROM mot_cle_categorie WHERE mot_cle_id IN (6, 7);

UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{action-bonus}}', '{{instant-cast|Action bonus}}'), '{{action-bonus|', '{{instant-cast|'), '{{action-bonus\|', '{{instant-cast\|'), '{{action-bonus:}}', '{{instant-cast:}}')
WHERE instr(corps_md, '{{action-bonus') > 0;
UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{action-rapide}}', '{{instant-cast|Action rapide}}'), '{{action-rapide|', '{{instant-cast|'), '{{action-rapide\|', '{{instant-cast\|'), '{{action-rapide:}}', '{{instant-cast:}}')
WHERE instr(corps_md, '{{action-rapide') > 0;

DELETE FROM mot_cle WHERE id IN (6, 7);

-- 4. La colonne abreviation retirée, la vue refaite
ALTER TABLE mot_cle DROP COLUMN abreviation;

CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description,                                                         -- la définition du glossaire (migration 0056 ; NULL : pas encore décrit)
    m.couleur,                                                             -- la référence de couleur (migration 0098 ; NULL : aucune)
    m.url                                                                  -- l'adresse interne où mène le mot-clé (migration 0098 ; NULL : aucune)
  FROM mot_cle m;

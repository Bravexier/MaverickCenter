-- 0095-retrait-liste-des-effets-mode-hyper : la page « Liste des effets mode hyper » (guide/liste-des-effets-mode-hyper, famille annexes) est retirée,
-- à la demande du propriétaire (2026-11-06, mot pour mot : « En fait https://dev.maverick-jdr.com/regles/le-mode-hyper/ Fait doublon avec
-- https://dev.maverick-jdr.com/regles/liste-des-effets-mode-hyper/ Supprime la liste. Dans le mode hyper rajoute un tableau qui liste les diffents bonus
-- des magie et des races en récupérant directement l'information depuis la DB. ») ; décision R187. Son adresse mène à la page 404 (R185 (6)).
-- Migration de SCHÉMA (mode_texte reconstruite : son dernier CHECK) et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une
-- modification du site de dev). Les lignes de historique_modification et de note_version_ligne qui citent la page restent : c'est l'historique.
--   1. Les textes et les constantes du classeur « Mode hyper et co » restent, rattachés à guide/le-mode-hyper, texte et valeurs inchangés :
--      mode_texte (Mode Hyper!AA1:BL12, AA14:BL28, AA30:BL43) garde ses trois ids « guide/liste-des-effets-mode-hyper#texte:… » (identifiants figés :
--      le registre 0005-orthographe-base.json les cite) ; son CHECK d'id admet cette seule exception (table reconstruite, lignes recopiées).
--      Leurs trois lignes page_entite (principale = 0) suivent ; regle_constante : les douze constantes mode_hyper.* et mode_hyper_100.*.
--      mode_hyper_effet ne change pas.
--   2. Le corps de guide/le-mode-hyper, section « Ce qu’il donne » : de la phrase qui renvoyait à la Liste, seule la première reste (méthode R184 (5) :
--      retirer le seul bout devenu faux), suivie du marqueur du tableau tiré de la base (<!-- guide:mode-hyper -->, lib/guide.mjs#BLOCS). C'était le seul
--      lien écrit vers la Liste dans la base.
--   3. La page retirée : ses lignes d'import (page_source ; aucune source ne devient orpheline : les trois sont citées par d'autres pages), son entrée du
--      menu latéral « Les combats » (rang 17 ; les entrées suivantes remontent d'une place, rangs 1 à 19) et ses liens (tables dérivées, refaites par
--      db:build), retirés d'abord : une migration s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans cascade.
-- Chaque UPDATE est gardé (texte d'avant, ou page d'avant) : rejouée sur son propre résultat, la migration ne change rien.

-- 1. mode_texte reconstruite (CHECK de l'id), lignes recopiées, la page qui les présente devient guide/le-mode-hyper
CREATE TABLE mode_texte_0095 (
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
  CHECK (substr(id, 1, length(page_id) + 7) = page_id || '#texte:'
      OR (page_id = 'guide/le-mode-hyper' AND id GLOB 'guide/liste-des-effets-mode-hyper#texte:*'))
) STRICT;
INSERT INTO mode_texte_0095 (id, mode, rang, intitule, texte, page_id, origine, source_ref, remarque)
  SELECT id, mode, rang, intitule, texte,
         CASE WHEN page_id = 'guide/liste-des-effets-mode-hyper' THEN 'guide/le-mode-hyper' ELSE page_id END,
         origine, source_ref, remarque
  FROM mode_texte;
DROP TABLE mode_texte;
ALTER TABLE mode_texte_0095 RENAME TO mode_texte;
CREATE INDEX mode_texte_page ON mode_texte (page_id);

UPDATE page_entite SET page_id = 'guide/le-mode-hyper'
  WHERE entite_table = 'mode_texte' AND page_id = 'guide/liste-des-effets-mode-hyper';
UPDATE regle_constante SET page_id = 'guide/le-mode-hyper' WHERE page_id = 'guide/liste-des-effets-mode-hyper';

-- 2. Le corps de guide/le-mode-hyper
UPDATE page SET corps_md = replace(corps_md,
  'La page de chaque magie et de chaque race donne l’effet écrit dans son onglet. La [[guide/liste-des-effets-mode-hyper|Liste des effets mode hyper]] donne, elle, ceux du classeur du Mode Hyper, magie par magie et race par race ; les deux ne disent pas toujours la même chose.',
  'La page de chaque magie et de chaque race donne l’effet écrit dans son onglet.' || char(10) || char(10) || '<!-- guide:mode-hyper -->')
WHERE id = 'guide/le-mode-hyper'
  AND instr(corps_md, 'La page de chaque magie et de chaque race donne l’effet écrit dans son onglet. La [[guide/liste-des-effets-mode-hyper|Liste des effets mode hyper]] donne, elle, ceux du classeur du Mode Hyper, magie par magie et race par race ; les deux ne disent pas toujours la même chose.') > 0;

-- 3. La page retirée
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id = 'guide/liste-des-effets-mode-hyper')
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id <> 'guide/liste-des-effets-mode-hyper');
DELETE FROM page_source WHERE page_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM alias WHERE page_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM page_tag WHERE page_id = 'guide/liste-des-effets-mode-hyper';

-- Le menu de son onglet sans trou : les entrées qui la suivent remontent d'une place (même ordre). Calculé AVANT le retrait de l'entrée, qui n'est pas
-- modifiée : le résultat ne dépend pas de l'ordre dans lequel SQLite parcourt les lignes.
UPDATE regles_onglet_entree
  SET rang = rang - (SELECT count(*) FROM regles_onglet_entree x
                     WHERE x.onglet_id = regles_onglet_entree.onglet_id AND x.page_id = 'guide/liste-des-effets-mode-hyper' AND x.rang < regles_onglet_entree.rang)
  WHERE onglet_id IN (SELECT onglet_id FROM regles_onglet_entree WHERE page_id = 'guide/liste-des-effets-mode-hyper')
    AND (page_id IS NULL OR page_id <> 'guide/liste-des-effets-mode-hyper');
DELETE FROM regles_onglet_entree WHERE page_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM lien_candidat WHERE candidat_page_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM lien WHERE page_id = 'guide/liste-des-effets-mode-hyper' OR cible_page_id = 'guide/liste-des-effets-mode-hyper';
DELETE FROM page WHERE id = 'guide/liste-des-effets-mode-hyper';

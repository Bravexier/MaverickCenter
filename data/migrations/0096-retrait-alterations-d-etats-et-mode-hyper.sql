-- 0096-retrait-alterations-d-etats-et-mode-hyper : la page « Altérations d'états et Mode Hyper » (guide/alterations-d-etats-et-mode-hyper, famille
-- docs, onglet « Mécaniques générales ») est retirée, à la demande du propriétaire (2026-11-06, mot pour mot : « L'onglet suivant est à retirer
-- https://dev.maverick-jdr.com/regles/alterations-d-etats-et-mode-hyper/ »). C'était un aiguillage (deux sections renvoyant à des classeurs Google),
-- en doublon avec « Altérations d’états » (guide/alterations-d-etats), « Liste des altérations d'état » et « Le Mode Hyper » (guide/le-mode-hyper).
-- Son adresse mène à la page 404 (R185 (6), lib/livres.mjs#PAGES_SUPPRIMEES).
-- Migration de DONNÉES seules ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev). Les lignes de
-- historique_modification et de note_version_ligne qui citent la page restent : c'est l'historique.
--   1. Les cinq liens écrits vers elle visent la page existante qui traite leur sujet, par son id ; le texte affiché (après « | ») et le reste du texte
--      ne changent pas : « altérations d'états » (guide/fiche-competences, Vigueur ; competence vigueur, description ; guide/jet-de-des, « Le cas de la
--      compétence survie » ; sommaire de guide/guide-pour-mj-maverick) → guide/alterations-d-etats ; « mode hyper » (guide/fiche-tableau-posture)
--      → guide/le-mode-hyper.
--   2. La page retirée : ses lignes d'import (page_source ; aucune source ne devient orpheline : ses deux sources sont citées par d'autres pages), ses
--      deux alias (« Altérations d'états », « Mode Hyper » : retirés, reportés sur aucune autre page), son entrée du menu latéral « Mécaniques
--      générales » (rang 9 ; les entrées suivantes remontent d'une place) et ses liens (tables dérivées, refaites par db:build), retirés d'abord : une
--      migration s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans cascade.
-- Chaque UPDATE est gardé (texte d'avant) : rejouée sur son propre résultat, la migration ne change rien.

-- 1. Les cinq liens
UPDATE page SET corps_md = replace(corps_md,
  '[[Altérations d''états et Mode Hyper|altérations d''états]]', '[[guide/alterations-d-etats|altérations d''états]]')
WHERE id IN ('guide/fiche-competences', 'guide/jet-de-des')
  AND instr(corps_md, '[[Altérations d''états et Mode Hyper|altérations d''états]]') > 0;
UPDATE competence SET description = replace(description,
  '[[Altérations d''états et Mode Hyper|altérations d''états]]', '[[guide/alterations-d-etats|altérations d''états]]')
WHERE id = 'vigueur'
  AND instr(description, '[[Altérations d''états et Mode Hyper|altérations d''états]]') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '[[Altérations d''états et Mode Hyper|Altérations d’états]]', '[[guide/alterations-d-etats|Altérations d’états]]')
WHERE id = 'guide/guide-pour-mj-maverick'
  AND instr(corps_md, '[[Altérations d''états et Mode Hyper|Altérations d’états]]') > 0;
UPDATE page SET corps_md = replace(corps_md,
  '[[Altérations d''états et Mode Hyper|mode hyper]]', '[[guide/le-mode-hyper|mode hyper]]')
WHERE id = 'guide/fiche-tableau-posture'
  AND instr(corps_md, '[[Altérations d''états et Mode Hyper|mode hyper]]') > 0;

-- 2. La page retirée
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id = 'guide/alterations-d-etats-et-mode-hyper')
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id <> 'guide/alterations-d-etats-et-mode-hyper');
DELETE FROM page_source WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM alias WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM page_tag WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper';

-- Le menu de son onglet sans trou : les entrées qui la suivent remontent d'une place (même ordre). Calculé AVANT le retrait de l'entrée, qui n'est pas
-- modifiée : le résultat ne dépend pas de l'ordre dans lequel SQLite parcourt les lignes.
UPDATE regles_onglet_entree
  SET rang = rang - (SELECT count(*) FROM regles_onglet_entree x
                     WHERE x.onglet_id = regles_onglet_entree.onglet_id AND x.page_id = 'guide/alterations-d-etats-et-mode-hyper'
                       AND x.rang < regles_onglet_entree.rang)
  WHERE onglet_id IN (SELECT onglet_id FROM regles_onglet_entree WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper')
    AND (page_id IS NULL OR page_id <> 'guide/alterations-d-etats-et-mode-hyper');
DELETE FROM regles_onglet_entree WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM lien_candidat WHERE candidat_page_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM lien WHERE page_id = 'guide/alterations-d-etats-et-mode-hyper' OR cible_page_id = 'guide/alterations-d-etats-et-mode-hyper';
DELETE FROM page WHERE id = 'guide/alterations-d-etats-et-mode-hyper';

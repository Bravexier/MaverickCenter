-- 0094-retrait-pages-doublons-des-combats : trois pages de l'onglet « Les combats » retirées, à la demande du propriétaire (2026-11-06, mot pour mot :
-- « Il y a 4 pages à supprimer car inutile ou doublon. * Postures * Les boss et leurs postures * Le mode hyper * Mode super ») ; la quatrième,
-- « Le Mode Hyper » (guide/le-mode-hyper), reste (R187 : c'est la « Liste des effets mode hyper » qui est retirée, migration 0095) ; 0094 n'y touche
-- pas (ni sa page, ni ses liens, ni son entrée de menu).
-- Migration de DONNÉES seules ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. Les pages retirées (famille docs, leurs adresses mènent à la page 404) et la page qui reprend leur contenu :
--      guide/postures (« Postures », transcription du Doc « Guide pour MJ ») : guide/les-postures ;
--      guide/les-boss-et-leurs-postures (« Les boss et leurs postures ») : guide/les-postures (intertitre « Les boss ») et guide/initiative ;
--      guide/le-mode-super (« Mode Super ») : guide/liste-des-effets-mode-super.
--      Avec elles : leurs lignes d'import (page_source ; aucune source ne devient orpheline), l'alias « Les boss et leurs postures », leurs
--      entrées du menu latéral (regles_onglet_entree) et leurs liens (table dérivée, refaite par db:build), retirés d'abord : une migration
--      s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans cascade. Le menu « Les combats » se resserre : les entrées qui
--      suivaient une page retirée remontent d'autant, dans le même ordre (rangs 1 à 20). Les lignes de historique_modification et de note_version_ligne qui les citent restent : c'est l'historique.
--   2. Les postures (identifiants figés) : posture, posture_effet, posture_critique et leurs écarts d'import gardent leurs ids
--      « guide/postures#posture:… ». Leurs six lignes page_entite (principale = 0) sont rattachées à guide/les-postures, qui affiche leur tableau
--      (bloc <!-- guide:postures -->) : l'onglet DB y mène, et la page qui les montre reste protégée par sa clé étrangère.
--   3. Les liens écrits vers elles :
--      guide/les-postures : la phrase finale ne cite plus que « Tableau Posture » ;
--      guide/attaquer-et-se-defendre : « (voir Les boss et leurs postures) » mène à guide/les-postures (un [[…#ancre]] n'est pas résolu par
--      lib/wikilinks-resolution.mjs#resolve : le lien vise la page, sans ancre) ;
--      guide/guide-pour-mj-maverick : son sommaire, transcrit du Doc, écrit « [[Postures]] » (par le titre) ; le texte copié ne change pas,
--      « Postures » devient un alias de guide/les-postures (comme « Résistance/Faiblesse Magie » à la migration 0091).
-- Chaque UPDATE est gardé par le texte d'avant (instr) : rejouée sur une base où le site de dev a réécrit la phrase, la migration ne la change pas ;
-- rejouée sur son propre résultat, elle ne change rien (l'alias n'est ajouté qu'une fois).

-- 3. Les liens écrits vers les pages retirées
UPDATE page SET corps_md = replace(corps_md,
  'Le texte d’origine des postures : [[guide/postures|Postures]] (Doc « Guide pour MJ ») et [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).',
  'Le texte d’origine des postures : [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).')
WHERE id = 'guide/les-postures'
  AND instr(corps_md, 'Le texte d’origine des postures : [[guide/postures|Postures]] (Doc « Guide pour MJ ») et [[guide/fiche-tableau-posture|Tableau Posture]] (Doc « Créer sa fiche de personnage »).') > 0;

UPDATE page SET corps_md = replace(corps_md,
  '(voir [[guide/les-boss-et-leurs-postures|Les boss et leurs postures]])',
  '(voir [[guide/les-postures|Les postures]])')
WHERE id = 'guide/attaquer-et-se-defendre'
  AND instr(corps_md, '(voir [[guide/les-boss-et-leurs-postures|Les boss et leurs postures]])') > 0;

INSERT INTO alias (page_id, ordre, texte, cle)
  SELECT 'guide/les-postures', suivant, 'Postures', 'postures'
  FROM (SELECT coalesce(max(ordre) + 1, 0) AS suivant FROM alias WHERE page_id = 'guide/les-postures')
  WHERE NOT EXISTS (SELECT 1 FROM alias WHERE page_id = 'guide/les-postures' AND texte = 'Postures');

-- 2. Les postures, rattachées à la page qui les affiche
UPDATE page_entite SET page_id = 'guide/les-postures' WHERE entite_table = 'posture' AND page_id = 'guide/postures';

-- 1. Les trois pages retirées
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'))
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id NOT IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'));
DELETE FROM page_source WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM alias WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM page_tag WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');

-- Le menu de leur onglet sans trou : chaque autre entrée descend d'autant de places qu'il y a de pages retirées avant elle (même ordre). Calculé AVANT
-- le retrait des entrées, qui ne sont pas modifiées : le résultat ne dépend pas de l'ordre dans lequel SQLite parcourt les lignes.
UPDATE regles_onglet_entree
  SET rang = rang - (SELECT count(*) FROM regles_onglet_entree x
                     WHERE x.onglet_id = regles_onglet_entree.onglet_id AND x.page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super') AND x.rang < regles_onglet_entree.rang)
  WHERE onglet_id IN (SELECT onglet_id FROM regles_onglet_entree WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'))
    AND (page_id IS NULL OR page_id NOT IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super'));
DELETE FROM regles_onglet_entree WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM lien_candidat WHERE candidat_page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM lien WHERE page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super') OR cible_page_id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');
DELETE FROM page WHERE id IN ('guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super');


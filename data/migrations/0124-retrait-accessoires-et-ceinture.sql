-- 0124-retrait-accessoires-et-ceinture : la page « Accessoires et Ceinture » (guide/fiche-accessoires-et-ceinture, famille docs, rang 11 du menu
-- « Fiche de personnage ») est retirée dans « Inventaire/Sac à dos » (guide/fiche-inventaire-sac-a-dos), décision R272 du propriétaire (2026-11-14 :
-- « Cette page doit être supprimé. Tout lien qui revois vers cette page doit renvoyer vers https://dev.maverick-jdr.com/regles/fiche-inventaire-sac-a-dos/ » ;
-- réponses « Tout déplacer (Recommandé) » et « L'adresse (URL) »).
-- Migration de DONNÉES seules (sections 1 et 2 ; PRAGMA user_version 123 -> 124) ; rien ne va dans historique_modification (la migration n'est pas une
-- modification du site de dev). Les lignes de historique_modification et de note_version_ligne qui citent la page restent : c'est l'historique (0122).
-- Registre : 0124-retrait-accessoires-et-ceinture.json (`valeurs`, `fusion`, `textes`, `mots_cles_modifies`, `pages_retirees`).
-- Le corps des deux pages n'a jamais été modifié sur le site de dev (historique_modification : leurs titres et leurs rangs seuls, 2026-11-06 et
-- 2026-11-08) : le texte déplacé est celui de la base, qui est celui du site.
--   1. guide/fiche-inventaire-sac-a-dos : son texte, inchangé, puis TOUT le texte de guide/fiche-accessoires-et-ceinture tel quel (aucun mot changé :
--      règle d'or), son intertitre « ## Accessoires » marqué de l'ancre figée {#accessoires} (lib/ancres-figees.mjs, égale au slug du texte, comme
--      la 0100), « ## Ceinture {#ceinture} » gardé (lib/ceinture-db.mjs#ANCRE_DE_LA_REFERENCE). Titre, résumé, alias, sources, statut inchangés.
--   2. La constante de R89 (regle_constante ceinture.exemplaires_par_emplacement) cite la page de l'inventaire, où se lit désormais sa section.
--   3. Le mot-clé « Fiche de personnage : Accessoires et Ceinture » (id 136, clé fiche-de-personnage-accessoires-et-ceinture, verrouillé) est fondu
--      dans « Fiche de personnage : Inventaire/Sac à dos » (139), comme la 0122 (serveur/edition-chronologie.mjs#fusionner) : ses balises citent la
--      cible, le texte affiché inchangé (« {{x|texte}} », « {{x\|texte}} » gardent leur texte, « {{x}} » affiche son libellé, « {{x:}} » devient
--      « {{cible:}} ») ; à la version 123, une seule, « {{fiche-de-personnage-accessoires-et-ceinture|Accessoires et Ceinture}} » dans
--      guide/l-equipement (dont le texte affiché ne change pas : db:check refuse une balise qui ne vise pas un mot-clé par sa clé courante). Sa clé
--      devient une clé quittée de la cible (mot_cle_ancienne_cle) ; ses catégories (5, 7 : la cible a les mêmes) sont retirées ; il n'a ni synonyme,
--      ni clé quittée, ni étiquette de page ou de sort. Puis il est supprimé. Entrée de la 0124 à ajouter dans serveur/edition.mjs#FUSIONS_DE_MIGRATION.
--   4. Le mot-clé 139 mène à /regles/inventaire-sac-a-dos/ : adresse de la page de l'inventaire (R272, exception aux adresses figées comme R228,
--      migration 0111) que lui donne lib/livres.mjs#ADRESSES_RENOMMEES_DU_GUIDE ; l'id et le slug de la page ne changent pas (comme la 0111 pour
--      guide/liste-des-effets-mode-super). Aucun autre texte de la base (hors historique) ne cite /regles/fiche-inventaire-sac-a-dos/ ni
--      /regles/fiche-accessoires-et-ceinture/ ; les anciennes adresses sont renvoyées par lib/livres.mjs.
--   5. La page retirée (son id n'est pas réutilisé) et ses lignes : 1 alias (le titre écrit par le site), 2 page_source (les deux sources sont aussi
--      celles de l'inventaire : aucune ne devient orpheline), son entrée du menu « Fiche de personnage » (rang 11, 10 à l'import : le site l'a
--      déplacée ; les autres gardent leur rang, comme à la 0122 : rang n'est ni UNIQUE ni continu), ses liens dérivés. Retirés d'abord : une
--      migration s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans cascade.
-- La garde : chaque écriture doit toucher le nombre de lignes attendu ; un texte ou une valeur que le site de dev aurait changé arrête la migration.

CREATE TEMP TABLE garde_0124 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- 1. Le texte déplacé (calculé avant le retrait de la page) : « ## Accessoires » en tête du corps retiré reçoit son ancre figée
INSERT INTO garde_0124 (quoi, lignes)
  SELECT 'corps de guide/fiche-accessoires-et-ceinture : « ## Accessoires » en tête, « ## Ceinture {#ceinture} » une fois', count(*) FROM page
  WHERE id = 'guide/fiche-accessoires-et-ceinture' AND substr(corps_md, 1, 15) = '## Accessoires' || char(10)
    AND length(corps_md) - length(replace(corps_md, char(10) || '## Ceinture {#ceinture}' || char(10), '')) = length(char(10) || '## Ceinture {#ceinture}' || char(10))
    AND instr(corps_md, '{#accessoires}') = 0;
UPDATE page SET corps_md = rtrim(corps_md, char(10)) || char(10) || char(10) || '## Accessoires {#accessoires}' ||
  substr((SELECT corps_md FROM page WHERE id = 'guide/fiche-accessoires-et-ceinture'), 15)
WHERE id = 'guide/fiche-inventaire-sac-a-dos' AND instr(corps_md, '{#accessoires}') = 0 AND instr(corps_md, '{#ceinture}') = 0
  AND instr(corps_md, char(10) || '#') = 0 AND substr(corps_md, 1, 1) <> '#'
  AND EXISTS (SELECT 1 FROM page WHERE id = 'guide/fiche-accessoires-et-ceinture');
INSERT INTO garde_0124 (quoi, lignes) VALUES ('page.corps_md guide/fiche-inventaire-sac-a-dos : sections Accessoires et Ceinture ajoutées', changes());
INSERT INTO garde_0124 (quoi, lignes) SELECT 'intertitre ## Accessoires {#accessoires}', count(*) FROM page
  WHERE id = 'guide/fiche-inventaire-sac-a-dos' AND instr(corps_md, char(10) || '## Accessoires {#accessoires}' || char(10)) > 0;
INSERT INTO garde_0124 (quoi, lignes) SELECT 'intertitre ## Ceinture {#ceinture}', count(*) FROM page
  WHERE id = 'guide/fiche-inventaire-sac-a-dos' AND instr(corps_md, char(10) || '## Ceinture {#ceinture}' || char(10)) > 0;

-- 2. La constante de R89
UPDATE regle_constante SET page_id = 'guide/fiche-inventaire-sac-a-dos'
WHERE id = 'ceinture.exemplaires_par_emplacement' AND page_id = 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('regle_constante ceinture.exemplaires_par_emplacement : page_id -> guide/fiche-inventaire-sac-a-dos', changes());
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('regle_constante : aucune autre ne cite la page', (SELECT count(*) FROM regle_constante WHERE page_id = 'guide/fiche-accessoires-et-ceinture'), 0);

-- 3. « Fiche de personnage : Accessoires et Ceinture » fondu dans « Fiche de personnage : Inventaire/Sac à dos »
INSERT INTO garde_0124 (quoi, lignes)
  VALUES ('mot_cle 136 (fiche-de-personnage-accessoires-et-ceinture) et 139 (fiche-de-personnage-inventaire-sac-a-dos) présents',
          (SELECT count(*) FROM mot_cle WHERE (id = 136 AND cle = 'fiche-de-personnage-accessoires-et-ceinture') OR (id = 139 AND cle = 'fiche-de-personnage-inventaire-sac-a-dos')) - 1);
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('mot_cle 136 : ni synonyme, ni étiquette de page ou de sort', (SELECT count(*) FROM mot_cle_synonyme WHERE mot_cle_id = 136)
          + (SELECT count(*) FROM page_tag WHERE tag_id = 136) + (SELECT count(*) FROM sort_mot_cle WHERE mot_cle_id = 136), 0);

UPDATE mot_cle_ancienne_cle SET mot_cle_id = 139 WHERE mot_cle_id = 136;
INSERT INTO mot_cle_ancienne_cle (cle, mot_cle_id) SELECT m.cle, 139 FROM mot_cle m WHERE m.id = 136;
INSERT INTO garde_0124 (quoi, lignes) VALUES ('mot_cle_ancienne_cle fiche-de-personnage-accessoires-et-ceinture -> 139', changes());
DELETE FROM mot_cle_categorie WHERE mot_cle_id = 136;

UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{fiche-de-personnage-accessoires-et-ceinture}}', '{{fiche-de-personnage-inventaire-sac-a-dos|Fiche de personnage : Accessoires et Ceinture}}'),
    '{{fiche-de-personnage-accessoires-et-ceinture|', '{{fiche-de-personnage-inventaire-sac-a-dos|'),
    '{{fiche-de-personnage-accessoires-et-ceinture\|', '{{fiche-de-personnage-inventaire-sac-a-dos\|'),
    '{{fiche-de-personnage-accessoires-et-ceinture:}}', '{{fiche-de-personnage-inventaire-sac-a-dos:}}')
WHERE instr(corps_md, '{{fiche-de-personnage-accessoires-et-ceinture') > 0 AND id <> 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('page.corps_md : balise de fiche-de-personnage-accessoires-et-ceinture reciblée (guide/l-equipement)', changes());
INSERT INTO garde_0124 (quoi, lignes) SELECT 'guide/l-equipement : la balise reciblée, son texte gardé', count(*) FROM page
  WHERE id = 'guide/l-equipement' AND instr(corps_md, '{{fiche-de-personnage-inventaire-sac-a-dos|Accessoires et Ceinture}}') > 0;
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('page.corps_md : plus aucune balise de fiche-de-personnage-accessoires-et-ceinture',
          (SELECT count(*) FROM page WHERE instr(corps_md, '{{fiche-de-personnage-accessoires-et-ceinture') > 0 AND id <> 'guide/fiche-accessoires-et-ceinture'), 0);
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('mot_cle.description : aucune balise de fiche-de-personnage-accessoires-et-ceinture',
          (SELECT count(*) FROM mot_cle WHERE instr(description, '{{fiche-de-personnage-accessoires-et-ceinture') > 0), 0);

DELETE FROM mot_cle WHERE id = 136;
INSERT INTO garde_0124 (quoi, lignes) VALUES ('mot_cle 136 supprimé', changes());

-- 4. L'adresse de la page de l'inventaire (R272)
UPDATE mot_cle SET url = '/regles/inventaire-sac-a-dos/' WHERE id = 139 AND url = '/regles/fiche-inventaire-sac-a-dos/';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('mot_cle 139 : url -> /regles/inventaire-sac-a-dos/', changes());
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('mot_cle : aucun ne mène aux anciennes adresses', (SELECT count(*) FROM mot_cle
          WHERE url GLOB '/regles/fiche-accessoires-et-ceinture/*' OR url GLOB '/regles/fiche-inventaire-sac-a-dos/*'), 0);

-- 5. La page retirée
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id = 'guide/fiche-accessoires-et-ceinture';
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id = 'guide/fiche-accessoires-et-ceinture')
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id <> 'guide/fiche-accessoires-et-ceinture');
INSERT INTO garde_0124 (quoi, lignes, attendu) VALUES ('source : aucune n''était citée par la seule page retirée', changes(), 0);
DELETE FROM page_source WHERE page_id = 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes, attendu) VALUES ('page_source de la page', changes(), 2);
DELETE FROM alias WHERE page_id = 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('alias de la page', changes());
DELETE FROM page_tag WHERE page_id = 'guide/fiche-accessoires-et-ceinture';
DELETE FROM page_entite WHERE page_id = 'guide/fiche-accessoires-et-ceinture';
-- son entrée du menu : les autres gardent leur rang (ni UNIQUE ni continu, comme à la 0122 et sur le site de dev)
DELETE FROM regles_onglet_entree WHERE page_id = 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('regles_onglet_entree page:guide/fiche-accessoires-et-ceinture', changes());
INSERT INTO garde_0124 (quoi, lignes, attendu)
  VALUES ('regles_onglet : aucun ne s''ouvre sur la page', (SELECT count(*) FROM regles_onglet WHERE ouverture_page_id = 'guide/fiche-accessoires-et-ceinture'), 0);
DELETE FROM lien_candidat WHERE candidat_page_id = 'guide/fiche-accessoires-et-ceinture';
DELETE FROM lien WHERE page_id = 'guide/fiche-accessoires-et-ceinture' OR cible_page_id = 'guide/fiche-accessoires-et-ceinture';
DELETE FROM page WHERE id = 'guide/fiche-accessoires-et-ceinture';
INSERT INTO garde_0124 (quoi, lignes) VALUES ('page guide/fiche-accessoires-et-ceinture', changes());

DROP TABLE garde_0124;

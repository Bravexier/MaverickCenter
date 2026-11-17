-- 0122-retrait-la-montee-de-niveau : la page « La montée de niveau » (guide/la-montee-de-niveau, famille docs, première entrée et page d'ouverture de
-- l'onglet « Exploration ») est retirée, en doublon de « Fiche de personnage : Expérience/Niveau global » (guide/fiche-experience-niveau-global),
-- à la demande du propriétaire (2026-11-13, mot pour mot : « Supprime juste le doublon. »). Le tableau de la page gardée n'est pas touché (le
-- propriétaire le refait sur le site de dev).
-- Migration de DONNÉES seules (sections 1 et 2 ; PRAGMA user_version 121 -> 122) ; rien ne va dans historique_modification (la migration n'est pas
-- une modification du site de dev). Les lignes de historique_modification et de note_version_ligne qui citent la page restent : c'est l'historique.
-- Registre : 0122-retrait-la-montee-de-niveau.json (`valeurs` : les deux valeurs reportées ; `fusion` : le mot-clé fondu ; `textes` : les balises reciblées ;
-- `page_source_supprimees`, `sources_supprimees`).
-- Réponses du propriétaire (2026-11-13) :
--   1. L'onglet « Exploration » s'ouvre sur « Équipement et butin » (guide/equipement-et-butin, entrée de l'onglet).
--   2. La constante de la décision R225 (regle_constante potentiel_illimite.sante_max_par_niveau) cite la page gardée.
--   3. Le mot-clé « La montée de niveau » (id 172, clé la-montee-de-niveau, verrouillé) est fondu dans « Fiche de personnage : Expérience/Niveau
--      global » (id 138, clé fiche-de-personnage-experience-niveau-global), qui mène déjà à la page gardée (réponse du propriétaire : « Le fondre dans
--      l'autre »). Comme une fusion du site de dev (serveur/edition-chronologie.mjs#fusionner) : ses balises citent la cible, « {{la-montee-de-niveau}} »
--      affichant son libellé (« {{fiche-de-personnage-experience-niveau-global|La montée de niveau}} »), « {{x|texte}} » et « {{x\|texte}} » gardant
--      leur texte, « {{x:}} » devenant « {{cible:}} » ; à la version 121, cinq balises sans texte, une par page, dans page.corps_md (guide/bienvenue,
--      guide/finaliser-son-personnage, guide/la-magie-en-jeu, guide/premiers-sorts, guide/reussir-une-action), aucune ailleurs. Sa clé devient une
--      clé quittée de la cible (mot_cle_ancienne_cle) ; ses catégories sont retirées (une fusion du site ne les transmet pas) ; il n'a ni synonyme,
--      ni clé quittée, ni étiquette de page ou de sort. Son adresse (la page retirée) n'est pas reprise : la cible a la sienne. Puis il est supprimé.
--      Le rejeu d'un lot du journal noté avant la migration (guide/bienvenue en a quatre qui portent la balise) lit ses balises reciblées de la même
--      façon : entrée de la 0122 dans serveur/edition.mjs#FUSIONS_DE_MIGRATION.
--   4. La page retirée : ses cinq lignes d'import (page_source), la source qu'elle seule citait (« Décisions du propriétaire R2, R3, R16, R26, R27, R44
--      et R73 »), son entrée du menu « Exploration » (rang 1) et ses liens (tables dérivées, refaites par db:build), retirés d'abord : une migration
--      s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans cascade. Ni alias, ni étiquette, ni écart d'import, ni note de cellule.
--      Les entrées suivantes du menu gardent leur rang (2 à 11) : rang n'est ni UNIQUE ni continu (le site de dev laisse le même trou quand il
--      supprime une page des Règles, serveur/edition-plan.mjs) ; le menu se lit par rang, puis id.
-- La garde : chaque écriture doit toucher le nombre de lignes attendu ; une valeur que le site de dev aurait changée arrête la migration.

CREATE TEMP TABLE garde_0122 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- 1. L'ouverture de l'onglet « Exploration »
UPDATE regles_onglet SET ouverture_page_id = 'guide/equipement-et-butin'
WHERE id = 'exploration' AND ouverture_page_id = 'guide/la-montee-de-niveau'
  AND EXISTS (SELECT 1 FROM regles_onglet_entree e WHERE e.onglet_id = 'exploration' AND e.page_id = 'guide/equipement-et-butin');
INSERT INTO garde_0122 (quoi, lignes) VALUES ('regles_onglet exploration : ouverture_page_id -> guide/equipement-et-butin', changes());

-- 2. La constante de R225
UPDATE regle_constante SET page_id = 'guide/fiche-experience-niveau-global'
WHERE id = 'potentiel_illimite.sante_max_par_niveau' AND page_id = 'guide/la-montee-de-niveau';
INSERT INTO garde_0122 (quoi, lignes) VALUES ('regle_constante potentiel_illimite.sante_max_par_niveau : page_id -> guide/fiche-experience-niveau-global', changes());
INSERT INTO garde_0122 (quoi, lignes, attendu)
  VALUES ('regle_constante : aucune autre ne cite la page', (SELECT count(*) FROM regle_constante WHERE page_id = 'guide/la-montee-de-niveau'), 0);

-- 3. « La montée de niveau » fondu dans « Fiche de personnage : Expérience/Niveau global »
INSERT INTO garde_0122 (quoi, lignes)
  VALUES ('mot_cle 172 (la-montee-de-niveau) et 138 (fiche-de-personnage-experience-niveau-global) présents',
          (SELECT count(*) FROM mot_cle WHERE (id = 172 AND cle = 'la-montee-de-niveau') OR (id = 138 AND cle = 'fiche-de-personnage-experience-niveau-global')) - 1);
INSERT INTO garde_0122 (quoi, lignes, attendu)
  VALUES ('mot_cle 172 : ni synonyme, ni étiquette de page ou de sort', (SELECT count(*) FROM mot_cle_synonyme WHERE mot_cle_id = 172)
          + (SELECT count(*) FROM page_tag WHERE tag_id = 172) + (SELECT count(*) FROM sort_mot_cle WHERE mot_cle_id = 172), 0);

UPDATE mot_cle_ancienne_cle SET mot_cle_id = 138 WHERE mot_cle_id = 172;
INSERT INTO mot_cle_ancienne_cle (cle, mot_cle_id) SELECT m.cle, 138 FROM mot_cle m WHERE m.id = 172;
INSERT INTO garde_0122 (quoi, lignes) VALUES ('mot_cle_ancienne_cle la-montee-de-niveau -> 138', changes());
DELETE FROM mot_cle_categorie WHERE mot_cle_id = 172;

UPDATE page SET corps_md =
  replace(replace(replace(replace(corps_md,
    '{{la-montee-de-niveau}}', '{{fiche-de-personnage-experience-niveau-global|La montée de niveau}}'),
    '{{la-montee-de-niveau|', '{{fiche-de-personnage-experience-niveau-global|'),
    '{{la-montee-de-niveau\|', '{{fiche-de-personnage-experience-niveau-global\|'),
    '{{la-montee-de-niveau:}}', '{{fiche-de-personnage-experience-niveau-global:}}')
WHERE instr(corps_md, '{{la-montee-de-niveau') > 0 AND id <> 'guide/la-montee-de-niveau';
INSERT INTO garde_0122 (quoi, lignes, attendu) VALUES ('page.corps_md : balises de la-montee-de-niveau reciblées', changes(), 5);
INSERT INTO garde_0122 (quoi, lignes, attendu)
  VALUES ('page.corps_md : plus aucune balise de la-montee-de-niveau', (SELECT count(*) FROM page WHERE instr(corps_md, '{{la-montee-de-niveau') > 0 AND id <> 'guide/la-montee-de-niveau'), 0);
INSERT INTO garde_0122 (quoi, lignes, attendu)
  VALUES ('mot_cle.description : aucune balise de la-montee-de-niveau', (SELECT count(*) FROM mot_cle WHERE instr(description, '{{la-montee-de-niveau') > 0), 0);

DELETE FROM mot_cle WHERE id = 172;
INSERT INTO garde_0122 (quoi, lignes) VALUES ('mot_cle 172 supprimé', changes());
INSERT INTO garde_0122 (quoi, lignes, attendu)
  VALUES ('mot_cle : aucun ne mène à la page retirée', (SELECT count(*) FROM mot_cle WHERE url GLOB '/regles/la-montee-de-niveau/*'), 0);

-- 4. La page retirée
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id = 'guide/la-montee-de-niveau';
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id = 'guide/la-montee-de-niveau')
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id <> 'guide/la-montee-de-niveau');
INSERT INTO garde_0122 (quoi, lignes) VALUES ('source : la seule que la page citait', changes());
DELETE FROM page_source WHERE page_id = 'guide/la-montee-de-niveau';
INSERT INTO garde_0122 (quoi, lignes, attendu) VALUES ('page_source de la page', changes(), 5);
DELETE FROM alias WHERE page_id = 'guide/la-montee-de-niveau';
DELETE FROM page_tag WHERE page_id = 'guide/la-montee-de-niveau';
DELETE FROM regles_onglet_entree WHERE page_id = 'guide/la-montee-de-niveau';
INSERT INTO garde_0122 (quoi, lignes) VALUES ('regles_onglet_entree page:guide/la-montee-de-niveau', changes());
DELETE FROM lien_candidat WHERE candidat_page_id = 'guide/la-montee-de-niveau';
DELETE FROM lien WHERE page_id = 'guide/la-montee-de-niveau' OR cible_page_id = 'guide/la-montee-de-niveau';
DELETE FROM page WHERE id = 'guide/la-montee-de-niveau';
INSERT INTO garde_0122 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau', changes());

DROP TABLE garde_0122;

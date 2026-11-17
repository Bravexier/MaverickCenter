-- Migration 0123 : fusion des pages d'alignement, demande du propriétaire (2026-11-13), mot pour mot : « Les pages https://dev.maverick-jdr.com/regles/alignement/
-- et https://dev.maverick-jdr.com/regles/les-neuf-alignements/ font doublon. Réunis toutes les informations dans la page /regles/alignement/ Liste les 9
-- allignements sous forme de tableau (ou de tuile) à onglet ou chaque onglet a la couleur de l'alignement. Crée les mots-clés qui vont avec. »
-- Migration de DONNÉES seules (section 1 ; PRAGMA user_version 122 -> 123) ; rien ne va dans historique_modification. Registre :
-- 0123-fusion-pages-alignement.json (`textes` : le corps réécrit, fragment ; `mots_cles_crees` ; `mots_cles_modifies` ; `pages_retirees`).
-- Écrite après le rapatriement du journal du site de dev (124 lots, 2026-11-06 -> 2026-11-13) et la 0122 (retrait de « La montée de niveau ») : le texte des neuf alignements est celui du site.
--   1. guide/alignement (« Alignement ») : son texte, inchangé, puis l'intertitre « ## Les neuf alignements {#les-neuf-alignements} », puis TOUT le texte
--      de guide/les-neuf-alignements tel quel (aucun mot changé : règle d'or), ses neuf « ## <Alignement> » descendus en « ### <Alignement> {#<ancre>} ».
--      Ancres figées (lib/ancres-figees.mjs) égales au slug du texte : les mots-clés y mènent. Les deux balises {{les-neuf-alignements}} restent.
--      Titre, résumé, alias, sources et statut de la page inchangés.
--   2. guide/les-neuf-alignements retirée (famille docs ; son id n'est pas réutilisé) avec ses lignes : 8 alias (ses titres de section), 2 page_source
--      (sources partagées, aucune ne devient orpheline), son entrée du menu « Fiche de personnage » (regles_onglet_entree page:guide/les-neuf-alignements ;
--      les autres entrées gardent leur rang, comme à la 0122), ses liens dérivés. Retirés d'abord : une migration s'applique clés étrangères coupées
--      (tools/db/maverick.py#migrer), sans cascade. Son ancienne adresse est renvoyée vers /regles/alignement/#les-neuf-alignements par lib/livres.mjs.
--   3. Mot-clé 192 « Les neuf alignements » : id et clé figés, son adresse devient /regles/alignement/#les-neuf-alignements.
--   4. Neuf mots-clés, un par alignement (ids 421 à 429, les suivants libres après le journal rapatrié : le site a créé 417 à 420) : libellé = le
--      titre de sa section, clé R232 (normalize, aucun homonyme), adresse /regles/alignement/#<ancre>, verrou 1 (R219 (1)), catégorie Règles (1, comme
--      « Alignement », 10), couleur « alignement:<id> » de la palette (lib/caracteristiques-postures.mjs#COULEURS_ALIGNEMENTS), définition = la première
--      phrase du premier paragraphe de sa section, recopiée telle quelle.
-- La garde : chaque écriture doit toucher le nombre de lignes attendu ; un texte que le site de dev aurait réécrit (intertitre renommé, page déjà
-- fusionnée) arrête la migration.

CREATE TEMP TABLE garde_0123 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- 1. Le corps fusionné (calculé avant le retrait de la page) ; les neuf intertitres doivent y être devenus des ### à ancre.
UPDATE page SET corps_md = rtrim(corps_md, char(10)) || char(10) || char(10) || '## Les neuf alignements {#les-neuf-alignements}' || char(10) || char(10) ||
  replace(replace(replace(replace(replace(replace(replace(replace(replace((SELECT corps_md FROM page WHERE id = 'guide/les-neuf-alignements'), char(10) || '## Loyal Bon' || char(10), char(10) || '### Loyal Bon {#loyal-bon}' || char(10)), char(10) || '## Loyal Neutre' || char(10), char(10) || '### Loyal Neutre {#loyal-neutre}' || char(10)), char(10) || '## Loyal Mauvais' || char(10), char(10) || '### Loyal Mauvais {#loyal-mauvais}' || char(10)), char(10) || '## Neutre Bon' || char(10), char(10) || '### Neutre Bon {#neutre-bon}' || char(10)), char(10) || '## Neutre' || char(10), char(10) || '### Neutre {#neutre}' || char(10)), char(10) || '## Neutre Mauvais' || char(10), char(10) || '### Neutre Mauvais {#neutre-mauvais}' || char(10)), char(10) || '## Chaotique Bon' || char(10), char(10) || '### Chaotique Bon {#chaotique-bon}' || char(10)), char(10) || '## Chaotique Neutre' || char(10), char(10) || '### Chaotique Neutre {#chaotique-neutre}' || char(10)), char(10) || '## Chaotique Mauvais' || char(10), char(10) || '### Chaotique Mauvais {#chaotique-mauvais}' || char(10))
WHERE id = 'guide/alignement' AND instr(corps_md, '{#les-neuf-alignements}') = 0
  AND EXISTS (SELECT 1 FROM page WHERE id = 'guide/les-neuf-alignements');
INSERT INTO garde_0123 (quoi, lignes) VALUES ('page.corps_md guide/alignement : fusion', changes());

INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Loyal Bon', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Loyal Bon {#loyal-bon}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Loyal Neutre', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Loyal Neutre {#loyal-neutre}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Loyal Mauvais', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Loyal Mauvais {#loyal-mauvais}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Neutre Bon', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Neutre Bon {#neutre-bon}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Neutre', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Neutre {#neutre}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Neutre Mauvais', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Neutre Mauvais {#neutre-mauvais}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Chaotique Bon', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Chaotique Bon {#chaotique-bon}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Chaotique Neutre', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Chaotique Neutre {#chaotique-neutre}' || char(10)) > 0;
INSERT INTO garde_0123 (quoi, lignes) SELECT 'intertitre Chaotique Mauvais', count(*) FROM page WHERE id = 'guide/alignement' AND instr(corps_md, char(10) || '### Chaotique Mauvais {#chaotique-mauvais}' || char(10)) > 0;

-- 2. La page retirée et ses lignes
INSERT INTO garde_0123 (quoi, lignes, attendu) SELECT 'alias de guide/les-neuf-alignements', count(*), 8 FROM alias WHERE page_id = 'guide/les-neuf-alignements';
DELETE FROM alias WHERE page_id = 'guide/les-neuf-alignements';
DELETE FROM page_tag WHERE page_id = 'guide/les-neuf-alignements';
DELETE FROM page_entite WHERE page_id = 'guide/les-neuf-alignements';
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id = 'guide/les-neuf-alignements';
DELETE FROM source
  WHERE id IN (SELECT source_id FROM page_source WHERE page_id = 'guide/les-neuf-alignements')
    AND id NOT IN (SELECT source_id FROM page_source WHERE page_id <> 'guide/les-neuf-alignements');
DELETE FROM page_source WHERE page_id = 'guide/les-neuf-alignements';
-- son entrée du menu : les autres gardent leur rang (ni UNIQUE ni continu, comme à la 0122 et sur le site de dev)
DELETE FROM regles_onglet_entree WHERE page_id = 'guide/les-neuf-alignements';
INSERT INTO garde_0123 (quoi, lignes) VALUES ('entrée du menu page:guide/les-neuf-alignements', changes());
DELETE FROM lien_candidat WHERE candidat_page_id = 'guide/les-neuf-alignements';
DELETE FROM lien WHERE page_id = 'guide/les-neuf-alignements' OR cible_page_id = 'guide/les-neuf-alignements';
DELETE FROM page WHERE id = 'guide/les-neuf-alignements';
INSERT INTO garde_0123 (quoi, lignes) VALUES ('page guide/les-neuf-alignements', changes());

-- 3. Le mot-clé 192 mène à l'intertitre
UPDATE mot_cle SET url = '/regles/alignement/#les-neuf-alignements' WHERE id = 192 AND url = '/regles/les-neuf-alignements/';
INSERT INTO garde_0123 (quoi, lignes) VALUES ('mot_cle 192 : url', changes());

-- 4. Les neuf mots-clés des alignements

INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (421, 'Loyal Bon', 'loyal-bon', 'Le Loyal Bon cherche à faire le bien tout en accordant une grande importance à l’ordre, au devoir et au collectif.', 'alignement:loyal-bon', '/regles/alignement/#loyal-bon', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (421, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (422, 'Loyal Neutre', 'loyal-neutre', 'Le Loyal Neutre accorde la priorité à l’ordre, au devoir et au fonctionnement du collectif, sans que le Bien ou le Mal ne constitue nécessairement sa principale préoccupation.', 'alignement:loyal-neutre', '/regles/alignement/#loyal-neutre', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (422, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (423, 'Loyal Mauvais', 'loyal-mauvais', 'Le Loyal Mauvais cherche à satisfaire ses propres intérêts tout en s’appuyant sur l’ordre, la hiérarchie et les règles.', 'alignement:loyal-mauvais', '/regles/alignement/#loyal-mauvais', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (423, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (424, 'Neutre Bon', 'neutre-bon', 'Le Neutre Bon cherche avant tout à faire le bien et à protéger les autres, sans accorder une importance particulière à l’ordre ou à la liberté.', 'alignement:neutre-bon', '/regles/alignement/#neutre-bon', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (424, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (425, 'Neutre', 'neutre', 'Le Neutre ne place aucune des quatre tendances au-dessus des autres.', 'alignement:neutre', '/regles/alignement/#neutre', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (425, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (426, 'Neutre Mauvais', 'neutre-mauvais', 'Le Neutre Mauvais place ses propres intérêts au-dessus de ceux des autres, sans attachement particulier à l’ordre ou au chaos.', 'alignement:neutre-mauvais', '/regles/alignement/#neutre-mauvais', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (426, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (427, 'Chaotique Bon', 'chaotique-bon', 'Le Chaotique Bon cherche à faire le bien tout en accordant une grande importance à la liberté et au libre arbitre.', 'alignement:chaotique-bon', '/regles/alignement/#chaotique-bon', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (427, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (428, 'Chaotique Neutre', 'chaotique-neutre', 'Le Chaotique Neutre place la liberté individuelle au-dessus de l’ordre et des contraintes imposées par le collectif.', 'alignement:chaotique-neutre', '/regles/alignement/#chaotique-neutre', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (428, 1);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou) VALUES (429, 'Chaotique Mauvais', 'chaotique-mauvais', 'Le Chaotique Mauvais place sa liberté et ses propres désirs au-dessus de toute considération pour les autres.', 'alignement:chaotique-mauvais', '/regles/alignement/#chaotique-mauvais', 1);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (429, 1);

DROP TABLE garde_0123;

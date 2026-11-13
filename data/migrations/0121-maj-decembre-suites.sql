-- Migration 0121 : suites de la mise à jour de Décembre (décisions R254 (3), R255 (7), R258 (4) et (7), R268, R259, R264, R265, R266 ; suite de R239).
-- Migration de DONNÉES seules (sections 1, 5 bis, 6, 7, 8, 8 bis, 9 ; PRAGMA user_version 120 -> 121) ; rien ne va dans historique_modification.
-- Registre : 0121-maj-decembre-suites.json (`corrections` : graphies, lues par tools/sources/rapprocher.mjs comme de l'orthographe ; `cles` : clés recalculées ;
-- `textes` : textes réécrits ou balisés ; `mots_cles` ; `evenements`). Générée par un script du lot (hors dépôt) depuis la base à la version 120.
--   - R258 (4) : le mot-clé « Sort fer » (332) n'écrit aucun nombre de sorts : rien à changer.
--   - materiau_arme.ressource_id « ressources/armures#materiau:<nom> » n'est pas une anomalie : un matériau est une seule ressource (table ressource),
--     définie sur la page où sa liste la décrit (13 matériaux sont aussi des matériaux d'armure ; l'Os, seul matériau d'arme, sur ressources/armes).
--   - R266 : exception explicite à « un texte copié d'une source n'est pas réécrit », limitée à ses trois graphies ; ids, clés et adresses inchangés.
-- La garde : chaque UPDATE doit toucher une ligne, et un fragment remplacé doit y être écrit le nombre de fois attendu (toutes ses occurrences de la
-- cellule) ; une valeur que le site de dev aurait réécrite arrête la migration.

CREATE TEMP TABLE garde_0121 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 1. R254 (3) : le « CHOSE A SAVOIR » de l'Archimage s'arrête après « si vous n'êtes pas du potentiel illimité » (classe et corps de sa page).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE classe SET chose_a_savoir = replace(chose_a_savoir, 'si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.', 'si vous n''êtes pas du potentiel illimité.')
  WHERE id = 'classes/archimage' AND length(chose_a_savoir) - length(replace(chose_a_savoir, 'si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.', '')) = 1 * length('si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('classe.chose_a_savoir {"id": "classes/archimage"} : si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité. -> si vous n''êtes pas du potentiel illimité.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.', 'si vous n''êtes pas du potentiel illimité.')
  WHERE id = 'classes/archimage' AND length(corps_md) - length(replace(corps_md, 'si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.', '')) = 1 * length('si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "classes/archimage"} : si vous n''êtes pas du potentiel illimité et est imposée quand vous êtes du potentiel illimité. -> si vous n''êtes pas du potentiel illimité.', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 2. R255 (7) : graphies des dons du Boxeur. « Posture inébran » -> « Posture inébranlable » (id et adresse inchangés, clés recalculées) ;
--    Boupact « divise par 2 l'AP donné » ; « d'AP+AM » ; « altérations d'état » (dons du Boxeur seuls). Le don, son résumé et le corps de sa page.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE capacite SET nom = replace(nom, 'Posture inébran', 'Posture inébranlable')
  WHERE id = 'capacites/boxeur-posture-inebran' AND length(nom) - length(replace(nom, 'Posture inébran', '')) = 1 * length('Posture inébran');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.nom {"id": "capacites/boxeur-posture-inebran"} : Posture inébran -> Posture inébranlable', changes(), 1);
UPDATE page SET titre = replace(titre, 'Posture inébran (Boxeur)', 'Posture inébranlable (Boxeur)')
  WHERE id = 'capacites/boxeur-posture-inebran' AND length(titre) - length(replace(titre, 'Posture inébran (Boxeur)', '')) = 1 * length('Posture inébran (Boxeur)');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.titre {"id": "capacites/boxeur-posture-inebran"} : Posture inébran (Boxeur) -> Posture inébranlable (Boxeur)', changes(), 1);
UPDATE capacite SET nom_cle = 'posture-inebranlable' WHERE id = 'capacites/boxeur-posture-inebran' AND nom_cle = 'posture-inebran';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.nom_cle : posture-inebranlable', changes(), 1);
UPDATE page SET titre_cle = 'posture-inebranlable-boxeur' WHERE id = 'capacites/boxeur-posture-inebran' AND titre_cle = 'posture-inebran-boxeur';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.titre_cle : posture-inebranlable-boxeur', changes(), 1);
UPDATE capacite SET effet = replace(effet, 'divise par 2 donné', 'divise par 2 l''AP donné')
  WHERE id = 'capacites/boxeur-boupact' AND length(effet) - length(replace(effet, 'divise par 2 donné', '')) = 1 * length('divise par 2 donné');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.effet {"id": "capacites/boxeur-boupact"} : divise par 2 donné -> divise par 2 l''AP donné', changes(), 1);
UPDATE page SET resume = replace(resume, 'divise par 2 donné', 'divise par 2 l''AP donné')
  WHERE id = 'capacites/boxeur-boupact' AND length(resume) - length(replace(resume, 'divise par 2 donné', '')) = 1 * length('divise par 2 donné');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "capacites/boxeur-boupact"} : divise par 2 donné -> divise par 2 l''AP donné', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'divise par 2 donné', 'divise par 2 l''AP donné')
  WHERE id = 'capacites/boxeur-boupact' AND length(corps_md) - length(replace(corps_md, 'divise par 2 donné', '')) = 1 * length('divise par 2 donné');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "capacites/boxeur-boupact"} : divise par 2 donné -> divise par 2 l''AP donné', changes(), 1);
UPDATE capacite SET effet = replace(effet, 'de AP+AM', 'd''AP+AM')
  WHERE id = 'capacites/boxeur-bouclier-dattaque' AND length(effet) - length(replace(effet, 'de AP+AM', '')) = 1 * length('de AP+AM');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.effet {"id": "capacites/boxeur-bouclier-dattaque"} : de AP+AM -> d''AP+AM', changes(), 1);
UPDATE page SET resume = replace(resume, 'de AP+AM', 'd''AP+AM')
  WHERE id = 'capacites/boxeur-bouclier-dattaque' AND length(resume) - length(replace(resume, 'de AP+AM', '')) = 1 * length('de AP+AM');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "capacites/boxeur-bouclier-dattaque"} : de AP+AM -> d''AP+AM', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'de AP+AM', 'd''AP+AM')
  WHERE id = 'capacites/boxeur-bouclier-dattaque' AND length(corps_md) - length(replace(corps_md, 'de AP+AM', '')) = 1 * length('de AP+AM');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "capacites/boxeur-bouclier-dattaque"} : de AP+AM -> d''AP+AM', changes(), 1);
UPDATE capacite SET effet = replace(effet, 'altérations d''états', 'altérations d''état')
  WHERE id = 'capacites/boxeur-endurouille' AND length(effet) - length(replace(effet, 'altérations d''états', '')) = 1 * length('altérations d''états');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.effet {"id": "capacites/boxeur-endurouille"} : altérations d''états -> altérations d''état', changes(), 1);
UPDATE page SET resume = replace(resume, 'altérations d''états', 'altérations d''état')
  WHERE id = 'capacites/boxeur-endurouille' AND length(resume) - length(replace(resume, 'altérations d''états', '')) = 1 * length('altérations d''états');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "capacites/boxeur-endurouille"} : altérations d''états -> altérations d''état', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'altérations d''états', 'altérations d''état')
  WHERE id = 'capacites/boxeur-endurouille' AND length(corps_md) - length(replace(corps_md, 'altérations d''états', '')) = 1 * length('altérations d''états');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "capacites/boxeur-endurouille"} : altérations d''états -> altérations d''état', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 3. R10 (coquille signalée par R268) : « (armes) , » -> « (armes), » dans « Immatériel » : la capacité commune des monstres et sa copie chez le
--    Fantôme et le Golem d'arcane (capacité et page), avant que le mot-clé Immatériel en reprenne le texte.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE monstre_capacite_commune SET description = replace(description, '(armes) ,', '(armes),')
  WHERE id = 'immateriel' AND length(description) - length(replace(description, '(armes) ,', '')) = 1 * length('(armes) ,');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('monstre_capacite_commune.description {"id": "immateriel"} : (armes) , -> (armes),', changes(), 1);
UPDATE creature_capacite SET texte = replace(texte, '(armes) ,', '(armes),')
  WHERE id = 'bestiaire/fantome#capacite:immateriel' AND length(texte) - length(replace(texte, '(armes) ,', '')) = 1 * length('(armes) ,');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('creature_capacite.texte {"id": "bestiaire/fantome#capacite:immateriel"} : (armes) , -> (armes),', changes(), 1);
UPDATE creature_capacite SET texte = replace(texte, '(armes) ,', '(armes),')
  WHERE id = 'bestiaire/golem-darcane#capacite:immateriel' AND length(texte) - length(replace(texte, '(armes) ,', '')) = 1 * length('(armes) ,');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('creature_capacite.texte {"id": "bestiaire/golem-darcane#capacite:immateriel"} : (armes) , -> (armes),', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '(armes) ,', '(armes),')
  WHERE id = 'bestiaire/fantome' AND length(corps_md) - length(replace(corps_md, '(armes) ,', '')) = 1 * length('(armes) ,');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "bestiaire/fantome"} : (armes) , -> (armes),', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '(armes) ,', '(armes),')
  WHERE id = 'bestiaire/golem-darcane' AND length(corps_md) - length(replace(corps_md, '(armes) ,', '')) = 1 * length('(armes) ,');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "bestiaire/golem-darcane"} : (armes) , -> (armes),', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 4. R266 : trois graphies du lore de Décembre, partout (Codex et onglets 21 et 22 compris), hors traces d'édition (historique_modification,
--    note_version_ligne) : « Dieu de la Terre », « Super Gemme » (pluriel « Super Gemmes »), « Mort Fertile ». Ni id, ni clé, ni adresse ne change
--    (lore/super-gemme, mot-clé super-gemme, guide/liste-des-effets-mode-super#objet:super-gemme). Exception explicite et limitée à la règle d'or.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE page SET resume = replace(resume, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'bestiaire/poupee-terrestre' AND length(resume) - length(replace(resume, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "bestiaire/poupee-terrestre"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'bestiaire/poupee-terrestre' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "bestiaire/poupee-terrestre"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE creature SET description = replace(description, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'bestiaire/poupee-terrestre' AND length(description) - length(replace(description, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('creature.description {"id": "bestiaire/poupee-terrestre"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE monstre_espece SET description = replace(description, 'dieu de la terre', 'Dieu de la Terre')
  WHERE id = 'monstres/elementaire-de-la-terre' AND length(description) - length(replace(description, 'dieu de la terre', '')) = 1 * length('dieu de la terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('monstre_espece.description {"id": "monstres/elementaire-de-la-terre"} : dieu de la terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'lore/camnau' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 3 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/camnau"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'lore/eoline' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/eoline"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'lore/foret-colossale' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 3 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/foret-colossale"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'lore/londolor' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/londolor"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'dieu de la Terre', 'Dieu de la Terre')
  WHERE id = 'lore/temple-de-la-terre' AND length(corps_md) - length(replace(corps_md, 'dieu de la Terre', '')) = 1 * length('dieu de la Terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/temple-de-la-terre"} : dieu de la Terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET resume = replace(resume, 'Dieu de la terre', 'Dieu de la Terre')
  WHERE id = 'lore/dimitri' AND length(resume) - length(replace(resume, 'Dieu de la terre', '')) = 1 * length('Dieu de la terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "lore/dimitri"} : Dieu de la terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Dieu de la terre', 'Dieu de la Terre')
  WHERE id = 'lore/dimitri' AND length(corps_md) - length(replace(corps_md, 'Dieu de la terre', '')) = 1 * length('Dieu de la terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/dimitri"} : Dieu de la terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Dieu de la terre', 'Dieu de la Terre')
  WHERE id = 'lore/les-divinites' AND length(corps_md) - length(replace(corps_md, 'Dieu de la terre', '')) = 1 * length('Dieu de la terre');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/les-divinites"} : Dieu de la terre -> Dieu de la Terre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Mort fertile', 'Mort Fertile')
  WHERE id = 'lore/foret-colossale' AND length(corps_md) - length(replace(corps_md, 'Mort fertile', '')) = 1 * length('Mort fertile');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/foret-colossale"} : Mort fertile -> Mort Fertile', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'super gemme', 'Super Gemme')
  WHERE id = 'lore/super-gemme' AND length(corps_md) - length(replace(corps_md, 'super gemme', '')) = 2 * length('super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "lore/super-gemme"} : super gemme -> Super Gemme', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Super gemme', 'Super Gemme')
  WHERE id = 'guide/liste-des-effets-mode-super' AND length(corps_md) - length(replace(corps_md, 'Super gemme', '')) = 1 * length('Super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "guide/liste-des-effets-mode-super"} : Super gemme -> Super Gemme', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'super gemme', 'Super Gemme')
  WHERE id = 'guide/liste-des-effets-mode-super' AND length(corps_md) - length(replace(corps_md, 'super gemme', '')) = 1 * length('super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "guide/liste-des-effets-mode-super"} : super gemme -> Super Gemme', changes(), 1);
UPDATE mode_super_objet SET nom = replace(nom, 'Super gemme', 'Super Gemme')
  WHERE id = 'guide/liste-des-effets-mode-super#objet:super-gemme' AND length(nom) - length(replace(nom, 'Super gemme', '')) = 1 * length('Super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('mode_super_objet.nom {"id": "guide/liste-des-effets-mode-super#objet:super-gemme"} : Super gemme -> Super Gemme', changes(), 1);
UPDATE mode_super_objet SET description = replace(description, 'super gemme', 'Super Gemme')
  WHERE id = 'guide/liste-des-effets-mode-super#objet:super-gemme' AND length(description) - length(replace(description, 'super gemme', '')) = 1 * length('super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('mode_super_objet.description {"id": "guide/liste-des-effets-mode-super#objet:super-gemme"} : super gemme -> Super Gemme', changes(), 1);
UPDATE race_onglet SET description_generale = replace(description_generale, 'super-gemme', 'Super Gemme')
  WHERE race_id = 'races/gemidien' AND length(description_generale) - length(replace(description_generale, 'super-gemme', '')) = 1 * length('super-gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('race_onglet.description_generale {"race_id": "races/gemidien"} : super-gemme -> Super Gemme', changes(), 1);
UPDATE race_onglet SET histoire = replace(histoire, 'supers-gemmes', 'Super Gemmes')
  WHERE race_id = 'races/gemidien' AND length(histoire) - length(replace(histoire, 'supers-gemmes', '')) = 2 * length('supers-gemmes');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('race_onglet.histoire {"race_id": "races/gemidien"} : supers-gemmes -> Super Gemmes', changes(), 1);
UPDATE race_onglet SET histoire = replace(histoire, 'Super gemme', 'Super Gemme')
  WHERE race_id = 'races/gemidien' AND length(histoire) - length(replace(histoire, 'Super gemme', '')) = 1 * length('Super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('race_onglet.histoire {"race_id": "races/gemidien"} : Super gemme -> Super Gemme', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'super-gemme', 'Super Gemme')
  WHERE id = 'races/gemidien' AND length(corps_md) - length(replace(corps_md, 'super-gemme', '')) = 1 * length('super-gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "races/gemidien"} : super-gemme -> Super Gemme', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'supers-gemmes', 'Super Gemmes')
  WHERE id = 'races/gemidien' AND length(corps_md) - length(replace(corps_md, 'supers-gemmes', '')) = 2 * length('supers-gemmes');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "races/gemidien"} : supers-gemmes -> Super Gemmes', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Super gemme', 'Super Gemme')
  WHERE id = 'races/gemidien' AND length(corps_md) - length(replace(corps_md, 'Super gemme', '')) = 1 * length('Super gemme');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "races/gemidien"} : Super gemme -> Super Gemme', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 5. R258 (7), R268 : sept mots-clés sans adresse ni couleur, non verrouillés (R219 (5)), ids suivants (serveur/edition-mots-cles.mjs#idSuivant :
--    410 à 416). Catégorie Bestiaire (11) pour les types de créatures et la capacité Immatériel ; Combat (4) pour Désarmement et Avantage.
--    Infobulles de R268 : Immatériel et Non-mort reprennent le texte de leur capacité commune (après la section 3) ; Bête, Mécanique, Démon : NULL.
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (410, 'Non-mort', 'non-mort', (SELECT description FROM monstre_capacite_commune WHERE id = 'non-mort'), NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (410, 11);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (411, 'Bête', 'bete', NULL, NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (411, 11);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (412, 'Mécanique', 'mecanique', NULL, NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (412, 11);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (413, 'Démon', 'demon', NULL, NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (413, 11);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (414, 'Immatériel', 'immateriel', (SELECT description FROM monstre_capacite_commune WHERE id = 'immateriel'), NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (414, 11);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (415, 'Désarmement', 'desarmement', 'Tout sort, don ou capacité qui fait perdre son arme au porteur.', NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (415, 4);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (416, 'Avantage', 'avantage', 'On lance deux fois le même jet et on ignore le jet le plus défavorable au lanceur.', NULL, NULL, 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (416, 4);
INSERT INTO garde_0121 (quoi, lignes, attendu) SELECT 'Non-mort et Immatériel : le texte de leur capacité', count(*), 2 FROM mot_cle m
  JOIN monstre_capacite_commune c ON c.id = m.cle WHERE m.id IN (410, 414) AND m.description = c.description AND instr(c.description, ' ,') = 0;

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 6. R258 (7) : balises des notions dans les effets secondaires des matériaux d'armes (effet_brut et effet_secondaire) et dans le tableau de la
--    page ressources/armes. Le texte n'est pas réécrit (texte affiché identique) ; aucun calcul (R128, R241 (3)). Le Laiton garde « inertes » en texte
--    (aucun mot-clé « Inerte »).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'contre les non-morts.', 'contre les {{non-mort|non-morts}}.')
  WHERE ressource_id = 'ressources/armures#materiau:argent' AND length(effet_brut) - length(replace(effet_brut, 'contre les non-morts.', '')) = 1 * length('contre les non-morts.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armures#materiau:argent"} : contre les non-morts. -> contre les {{non-mort|non-morts}}.', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'contre les non-morts.', 'contre les {{non-mort|non-morts}}.')
  WHERE ressource_id = 'ressources/armures#materiau:argent' AND length(effet_secondaire) - length(replace(effet_secondaire, 'contre les non-morts.', '')) = 1 * length('contre les non-morts.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armures#materiau:argent"} : contre les non-morts. -> contre les {{non-mort|non-morts}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'contre les non-morts.', 'contre les {{non-mort\|non-morts}}.')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'contre les non-morts.', '')) = 1 * length('contre les non-morts.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : contre les non-morts. -> contre les {{non-mort\|non-morts}}.', changes(), 1);
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'contre les bêtes.', 'contre les {{bete|bêtes}}.')
  WHERE ressource_id = 'ressources/armes#materiau:os' AND length(effet_brut) - length(replace(effet_brut, 'contre les bêtes.', '')) = 1 * length('contre les bêtes.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armes#materiau:os"} : contre les bêtes. -> contre les {{bete|bêtes}}.', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'contre les bêtes.', 'contre les {{bete|bêtes}}.')
  WHERE ressource_id = 'ressources/armes#materiau:os' AND length(effet_secondaire) - length(replace(effet_secondaire, 'contre les bêtes.', '')) = 1 * length('contre les bêtes.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armes#materiau:os"} : contre les bêtes. -> contre les {{bete|bêtes}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'contre les bêtes.', 'contre les {{bete\|bêtes}}.')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'contre les bêtes.', '')) = 1 * length('contre les bêtes.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : contre les bêtes. -> contre les {{bete\|bêtes}}.', changes(), 1);
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'créatures mécaniques ou inertes', 'créatures {{mecanique|mécaniques}} ou inertes')
  WHERE ressource_id = 'ressources/armures#materiau:laiton' AND length(effet_brut) - length(replace(effet_brut, 'créatures mécaniques ou inertes', '')) = 1 * length('créatures mécaniques ou inertes');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armures#materiau:laiton"} : créatures mécaniques ou inertes -> créatures {{mecanique|mécaniques}} ou inertes', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'créatures mécaniques ou inertes', 'créatures {{mecanique|mécaniques}} ou inertes')
  WHERE ressource_id = 'ressources/armures#materiau:laiton' AND length(effet_secondaire) - length(replace(effet_secondaire, 'créatures mécaniques ou inertes', '')) = 1 * length('créatures mécaniques ou inertes');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armures#materiau:laiton"} : créatures mécaniques ou inertes -> créatures {{mecanique|mécaniques}} ou inertes', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'créatures mécaniques ou inertes', 'créatures {{mecanique\|mécaniques}} ou inertes')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'créatures mécaniques ou inertes', '')) = 1 * length('créatures mécaniques ou inertes');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : créatures mécaniques ou inertes -> créatures {{mecanique\|mécaniques}} ou inertes', changes(), 1);
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'contre les démons.', 'contre les {{demon|démons}}.')
  WHERE ressource_id = 'ressources/armures#materiau:or' AND length(effet_brut) - length(replace(effet_brut, 'contre les démons.', '')) = 1 * length('contre les démons.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armures#materiau:or"} : contre les démons. -> contre les {{demon|démons}}.', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'contre les démons.', 'contre les {{demon|démons}}.')
  WHERE ressource_id = 'ressources/armures#materiau:or' AND length(effet_secondaire) - length(replace(effet_secondaire, 'contre les démons.', '')) = 1 * length('contre les démons.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armures#materiau:or"} : contre les démons. -> contre les {{demon|démons}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'contre les démons.', 'contre les {{demon\|démons}}.')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'contre les démons.', '')) = 1 * length('contre les démons.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : contre les démons. -> contre les {{demon\|démons}}.', changes(), 1);
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'les êtres immatériels.', 'les êtres {{immateriel|immatériels}}.')
  WHERE ressource_id = 'ressources/armures#materiau:vif-argent' AND length(effet_brut) - length(replace(effet_brut, 'les êtres immatériels.', '')) = 1 * length('les êtres immatériels.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armures#materiau:vif-argent"} : les êtres immatériels. -> les êtres {{immateriel|immatériels}}.', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'les êtres immatériels.', 'les êtres {{immateriel|immatériels}}.')
  WHERE ressource_id = 'ressources/armures#materiau:vif-argent' AND length(effet_secondaire) - length(replace(effet_secondaire, 'les êtres immatériels.', '')) = 1 * length('les êtres immatériels.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armures#materiau:vif-argent"} : les êtres immatériels. -> les êtres {{immateriel|immatériels}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'les êtres immatériels.', 'les êtres {{immateriel\|immatériels}}.')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'les êtres immatériels.', '')) = 1 * length('les êtres immatériels.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : les êtres immatériels. -> les êtres {{immateriel\|immatériels}}.', changes(), 1);
UPDATE materiau_arme SET effet_brut = replace(effet_brut, 'Avantage contre les effets de désarmement.', '{{avantage|Avantage}} contre les {{desarmement|effets de désarmement}}.')
  WHERE ressource_id = 'ressources/armures#materiau:titane' AND length(effet_brut) - length(replace(effet_brut, 'Avantage contre les effets de désarmement.', '')) = 1 * length('Avantage contre les effets de désarmement.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_brut {"ressource_id": "ressources/armures#materiau:titane"} : Avantage contre les effets de désarmement. -> {{avantage|Avantage}} contre les {{desarmement|effets de désarmement}}.', changes(), 1);
UPDATE materiau_arme SET effet_secondaire = replace(effet_secondaire, 'Avantage contre les effets de désarmement.', '{{avantage|Avantage}} contre les {{desarmement|effets de désarmement}}.')
  WHERE ressource_id = 'ressources/armures#materiau:titane' AND length(effet_secondaire) - length(replace(effet_secondaire, 'Avantage contre les effets de désarmement.', '')) = 1 * length('Avantage contre les effets de désarmement.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('materiau_arme.effet_secondaire {"ressource_id": "ressources/armures#materiau:titane"} : Avantage contre les effets de désarmement. -> {{avantage|Avantage}} contre les {{desarmement|effets de désarmement}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Avantage contre les effets de désarmement.', '{{avantage\|Avantage}} contre les {{desarmement\|effets de désarmement}}.')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'Avantage contre les effets de désarmement.', '')) = 1 * length('Avantage contre les effets de désarmement.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "ressources/armes"} : Avantage contre les effets de désarmement. -> {{avantage\|Avantage}} contre les {{desarmement\|effets de désarmement}}.', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 7. R259 : « Anti-barrière » prend le nouvel effet du Maverium, « Pré-mythril » celui du Mythril : le texte de l'option retenue (le propriétaire
--    n'en a pas écrit), « barrière » balisé comme dans l'ancien texte. Le don, son résumé et le corps de sa page.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE monstre_capacite_commune SET description = 'L''arme de la créature a la nouvelle propriété du Maverium : +1 dé de dégâts contre une cible qui n''a pas ou plus de {{barriere|barrière}}.'
  WHERE id = 'anti-barriere' AND description = 'L’arme de cette créature possède la même propriété que le maverium, il casse la {{barriere|barrière}} au moindre dégâts infligés.';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('monstre_capacite_commune.description {"id": "anti-barriere"} : R259', changes(), 1);
UPDATE capacite SET effet = 'Le carreau a la nouvelle propriété du Mythril : +1 dé de dégâts s''il touche une {{barriere|barrière}}.'
  WHERE id = 'capacites/arbaletrier-pre-mythril' AND effet = 'Un carreau spécial qui ignore complètement la {{barriere|barrière}} de la cible.';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('capacite.effet {"id": "capacites/arbaletrier-pre-mythril"} : R259', changes(), 1);
UPDATE page SET resume = 'Le carreau a la nouvelle propriété du Mythril : +1 dé de dégâts s''il touche une {{barriere|barrière}}.'
  WHERE id = 'capacites/arbaletrier-pre-mythril' AND resume = 'Un carreau spécial qui ignore complètement la {{barriere|barrière}} de la cible.';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.resume {"id": "capacites/arbaletrier-pre-mythril"} : R259', changes(), 1);
UPDATE page SET corps_md = 'Le carreau a la nouvelle propriété du Mythril : +1 dé de dégâts s''il touche une {{barriere|barrière}}.
'
  WHERE id = 'capacites/arbaletrier-pre-mythril' AND corps_md = 'Un carreau spécial qui ignore complètement la {{barriere|barrière}} de la cible.
';
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "capacites/arbaletrier-pre-mythril"} : R259', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 8. R264 : l'apparition des Gémidiens (an 70) et celle des Fongoïdes (an 80), sur le modèle de « Apparition des Felfes » (felfes) : un extrait
--    copié de la section Présentation de la page de la race (texte de l'onglet, tel quel), date_brut contenu dans le texte ; rang suivant (79, 80) ;
--    ni catégorie ni portée. source_ref : la provenance qu'écrit tools/chronologie/chronologie.mjs#provenance pour une page de race.
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO evenement (id, rang, titre, titre_cle, epoque, annee, annee_fin, portee, lieu, origine, source_ref) VALUES ('gemidiens', 79, 'Apparition des Gémidiens', 'apparition-des-gemidiens', 'datee', 70, NULL, NULL, NULL, 'chronologie', 'Les races › Gémidien › Présentation');
INSERT INTO evenement_extrait (evenement_id, rang, page_id, section, texte, date_brut, origine, source_ref) VALUES ('gemidiens', 1, 'races/gemidien', 'Présentation', 'Cette race est apparu la première fois en 70.', 'en 70', 'chronologie', 'Les races › Gémidien › Présentation');
INSERT INTO garde_0121 (quoi, lignes, attendu) SELECT 'R264 : extrait de races/gemidien dans sa section Présentation', count(*), 1 FROM page
  WHERE id = 'races/gemidien' AND instr(substr(corps_md, instr(corps_md, '## Présentation')), 'Cette race est apparu la première fois en 70.') > 0;
INSERT INTO evenement (id, rang, titre, titre_cle, epoque, annee, annee_fin, portee, lieu, origine, source_ref) VALUES ('fongoides', 80, 'Apparition des Fongoïdes', 'apparition-des-fongoides', 'datee', 80, NULL, NULL, NULL, 'chronologie', 'Les races › Fongoïde › Présentation');
INSERT INTO evenement_extrait (evenement_id, rang, page_id, section, texte, date_brut, origine, source_ref) VALUES ('fongoides', 1, 'races/fongoide', 'Présentation', 'Selon la lignée première, cette race est apparu sous la forme humanoïde la première fois en l''an 80.', 'en l''an 80', 'chronologie', 'Les races › Fongoïde › Présentation');
INSERT INTO garde_0121 (quoi, lignes, attendu) SELECT 'R264 : extrait de races/fongoide dans sa section Présentation', count(*), 1 FROM page
  WHERE id = 'races/fongoide' AND instr(substr(corps_md, instr(corps_md, '## Présentation')), 'Selon la lignée première, cette race est apparu sous la forme humanoïde la première fois en l''an 80.') > 0;

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 9. R265 : page du Fongoïde, un lien vers lore/dimitri sur « Dieu de la Terre » (description_generale) et un renvoi vers lore/champicer sur
--    « Premier Champignon » (histoire, première occurrence) : balises des mots-clés à adresse dimitri (91) et champicer (61), aucun mot changé.
--    Le corps de la page redit l'onglet (lib/corps-races.mjs#corpsDeRaceCreee).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE race_onglet SET description_generale = replace(description_generale, 'le Dieu de la Terre s''est', 'le {{dimitri|Dieu de la Terre}} s''est')
  WHERE race_id = 'races/fongoide' AND length(description_generale) - length(replace(description_generale, 'le Dieu de la Terre s''est', '')) = 1 * length('le Dieu de la Terre s''est');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('race_onglet.description_generale {"race_id": "races/fongoide"} : le Dieu de la Terre s''est -> le {{dimitri|Dieu de la Terre}} s''est', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'le Dieu de la Terre s''est', 'le {{dimitri|Dieu de la Terre}} s''est')
  WHERE id = 'races/fongoide' AND length(corps_md) - length(replace(corps_md, 'le Dieu de la Terre s''est', '')) = 1 * length('le Dieu de la Terre s''est');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "races/fongoide"} : le Dieu de la Terre s''est -> le {{dimitri|Dieu de la Terre}} s''est', changes(), 1);
UPDATE race_onglet SET histoire = replace(histoire, 'l''époque du Premier Champignon.', 'l''époque du {{champicer|Premier Champignon}}.')
  WHERE race_id = 'races/fongoide' AND length(histoire) - length(replace(histoire, 'l''époque du Premier Champignon.', '')) = 1 * length('l''époque du Premier Champignon.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('race_onglet.histoire {"race_id": "races/fongoide"} : l''époque du Premier Champignon. -> l''époque du {{champicer|Premier Champignon}}.', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'l''époque du Premier Champignon.', 'l''époque du {{champicer|Premier Champignon}}.')
  WHERE id = 'races/fongoide' AND length(corps_md) - length(replace(corps_md, 'l''époque du Premier Champignon.', '')) = 1 * length('l''époque du Premier Champignon.');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "races/fongoide"} : l''époque du Premier Champignon. -> l''époque du {{champicer|Premier Champignon}}.', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 10. Suite de R239 (1) : guide/l-univers et guide/choisir-sa-race comptent les races (29 depuis la migration 0120) ; seul le nombre change.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE page SET corps_md = replace(corps_md, '**27 races**', '**29 races**')
  WHERE id = 'guide/l-univers' AND length(corps_md) - length(replace(corps_md, '**27 races**', '')) = 1 * length('**27 races**');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "guide/l-univers"} : **27 races** -> **29 races**', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '{{race|27 races}}', '{{race|29 races}}')
  WHERE id = 'guide/choisir-sa-race' AND length(corps_md) - length(replace(corps_md, '{{race|27 races}}', '')) = 1 * length('{{race|27 races}}');
INSERT INTO garde_0121 (quoi, lignes, attendu) VALUES ('page.corps_md {"id": "guide/choisir-sa-race"} : {{race|27 races}} -> {{race|29 races}}', changes(), 1);

DROP TABLE garde_0121;

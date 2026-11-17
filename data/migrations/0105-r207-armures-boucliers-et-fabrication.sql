-- 0105-r207-armures-boucliers-et-fabrication : décision R207 du propriétaire (réponses du 2026-11-07, docs/decisions-regles.md), points (1) et (3).
-- Migration de DONNÉES (sections 1, 9 ; PRAGMA user_version 104 -> 105 ; dans data/schema.sql, seuls des commentaires changent) ; rien ne va dans
-- historique_modification (la migration n'est pas une modification du site de dev). Registre avant/après : 0105-r207-armures-boucliers-et-fabrication.json
-- (`valeurs` : les cellules changées ; `textes` : les fragments remplacés ; pas sous `corrections`, que le rapprochement des classeurs lit comme des
-- corrections d'orthographe : ce sont des valeurs voulues, que tools/sources/ignorer/ressources-et-craft.json range dans ses `voulus`).
--   * (1) E6 : le type, l'AP, l'AM et le prix des armures de la grille et des boucliers se calculent d'après les matériaux (« D'après les matériaux
--     (+ cout de fabrication pour le prix) ») ; les valeurs du classeur qui s'en écartent sont des fautes.
--       - armure (sorte 'combinaison', 231) : type = le plus lourd des deux matériaux (materiau_armure.type) ; AP et AM = la somme de ceux des deux
--         matériaux (R75 ; un NULL compte 0, une somme nulle reste NULL) ; prix = « Armure Complète » (armure_emplacement 'armure-complete', 10 RO) +
--         6 x prix du matériau 1 + 6 x prix du matériau 2 (R93 ; prix de la ressource, R62). Écarts : l'AP ou l'AM de 6 armures (Bois/Fonte,
--         Chitine/Corne, Mythril/Cuivre, Cuivre/Vif Argent, Écailles/Titane, Or/Titane), la défense écrite `stats_brut` refaite comme le service
--         (lib/armure-champs.mjs#defenseEcrite) ; aucun écart de type. Le prix de 18 armures s'écarte aussi de la formule (celles que R93 nomme) : il
--         n'est PAS écrit ici (hors des écarts listés par la décision ; registre : `prix_d_armure_hors_formule`), la page le calcule déjà (R93).
--       - bouclier (100) : AP et AM = classe x AP ou AM du matériau (materiau_bouclier) : aucun écart ; prix = classe x prix du matériau + 2,5 RO x
--         classe (« Coût (RO) : 2,5 / Classe », armure_emplacement 'bouclier' « 250 RF / Classe ») : 10 prix changent (Bouclier Rond Bois et Argent,
--         jusqu'ici sans prix ; Pavois Argent, Bronze, Corne, Écailles, Fer Noir ; Targe Bronze, Mythril, Titane), `prix_brut` écrit comme la source
--         (« 112,5 »).
--       - le corps des pages ressources/armures et ressources/bouclier (recherche) suit, ligne par ligne (lib/corps-armures.mjs#corpsDesArmuresApres).
--       - constante_equipement 'armure.unites_par_materiau' (6) : le seul nombre de ces formules qui n'était qu'au code (lib/armure-forge.mjs) ; les 10 RO
--         et les 2,5 RO par classe sont déjà des données (armure_emplacement, modifiables sur le site de dev).
--     La solidité n'entre pas dans E6 : rien n'y change.
--   * (3) Tests de fabrication : le Doc « MÉTIER » fait foi. Les 42 recettes de bâton magique (Enchanteur) : « Test de Perception + Volonté »
--     (test_brut, test_carac_1_id, test_carac_2_id) et la phrase de la page ressources/baton-magique ; le panneau de règles « Armes » (Armes!A1,
--     Forgeron) et le corps de ressources/armes : « Force et Volonté ». Les 21 recettes de matériau (« FORCE + INTELLIGENCE », métier non dit) et les
--     traces ecart_source des deux métiers ne changent pas.
--   Les corps de ressources/baton-magique et de ressources/armes ont été modifiés par le site de dev (balises, lignes d'armes) : seul le fragment de la
--   décision est remplacé, le reste de ce que le site a écrit est gardé.
-- La garde : chaque UPDATE est gardé par la valeur d'avant (entière, ou le fragment présent une seule fois) et doit changer exactement une ligne (42 pour
-- les recettes). Une valeur que le site de dev aurait réécrite arrête la migration.


CREATE TEMP TABLE garde_0105 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- (1) E6, armures de la grille : l'AP ou l'AM de 6 armures = la somme de ceux des deux matériaux (R75) ; la défense écrite en est refaite
-- (lib/armure-champs.mjs#defenseEcrite), comme le service

UPDATE armure SET ap = 16, am = 1, stats_brut = '+16AP +1AM' WHERE id = 'ressources/armures#armure:armure-bois-fonte' AND ap = 17 AND am = 1 AND stats_brut = '+17AP +1AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-bois-fonte : AP/AM', changes(), 1);
UPDATE armure SET ap = 13, am = 1, stats_brut = '+13AP +1AM' WHERE id = 'ressources/armures#armure:armure-chitine-corne' AND ap = 13 AND am = 2 AND stats_brut = '+13AP +2AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-chitine-corne : AP/AM', changes(), 1);
UPDATE armure SET ap = 10, am = 16, stats_brut = '+10AP +16AM' WHERE id = 'ressources/armures#armure:armure-mythril-cuivre' AND ap = 12 AND am = 16 AND stats_brut = '+12AP +16AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-mythril-cuivre : AP/AM', changes(), 1);
UPDATE armure SET ap = 12, am = 16, stats_brut = '+12AP +16AM' WHERE id = 'ressources/armures#armure:armure-cuivre-vif-argent' AND ap = 16 AND am = 10 AND stats_brut = '+16AP +10AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-cuivre-vif-argent : AP/AM', changes(), 1);
UPDATE armure SET ap = 21, am = 15, stats_brut = '+21AP +15AM' WHERE id = 'ressources/armures#armure:armure-ecailles-titane' AND ap = 21 AND am = 13 AND stats_brut = '+21AP +13AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-ecailles-titane : AP/AM', changes(), 1);
UPDATE armure SET ap = 25, am = 12, stats_brut = '+25AP +12AM' WHERE id = 'ressources/armures#armure:armure-or-titane' AND ap = 25 AND am = 13 AND stats_brut = '+25AP +13AM';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('armure ressources/armures#armure:armure-or-titane : AP/AM', changes(), 1);

-- (1) E6, boucliers : le prix de 10 boucliers = classe x prix du matériau + 2,5 x classe (« Coût (RO) : 2,5 / Classe »)

UPDATE bouclier SET prix = 112.5, prix_brut = '112,5' WHERE id = 'ressources/bouclier#bouclier:bouclier-rond:argent' AND prix IS NULL AND prix_brut IS NULL;
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:bouclier-rond:argent : prix', changes(), 1);
UPDATE bouclier SET prix = 12, prix_brut = '12' WHERE id = 'ressources/bouclier#bouclier:bouclier-rond:bois' AND prix = 10.5 AND prix_brut = '10,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:bouclier-rond:bois : prix', changes(), 1);
UPDATE bouclier SET prix = 187.5, prix_brut = '187,5' WHERE id = 'ressources/bouclier#bouclier:pavoi:argent' AND prix = 197.5 AND prix_brut = '197,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:pavoi:argent : prix', changes(), 1);
UPDATE bouclier SET prix = 437.5, prix_brut = '437,5' WHERE id = 'ressources/bouclier#bouclier:pavoi:bronze' AND prix = 442.5 AND prix_brut = '442,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:pavoi:bronze : prix', changes(), 1);
UPDATE bouclier SET prix = 162.5, prix_brut = '162,5' WHERE id = 'ressources/bouclier#bouclier:pavoi:corne-os' AND prix = 172.5 AND prix_brut = '172,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:pavoi:corne-os : prix', changes(), 1);
UPDATE bouclier SET prix = 412.5, prix_brut = '412,5' WHERE id = 'ressources/bouclier#bouclier:pavoi:ecailles' AND prix = 424.5 AND prix_brut = '424,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:pavoi:ecailles : prix', changes(), 1);
UPDATE bouclier SET prix = 187.5, prix_brut = '187,5' WHERE id = 'ressources/bouclier#bouclier:pavoi:fer-noir' AND prix = 197.5 AND prix_brut = '197,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:pavoi:fer-noir : prix', changes(), 1);
UPDATE bouclier SET prix = 175, prix_brut = '175' WHERE id = 'ressources/bouclier#bouclier:targe:bronze' AND prix = 172.5 AND prix_brut = '172,5';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:targe:bronze : prix', changes(), 1);
UPDATE bouclier SET prix = 405, prix_brut = '405' WHERE id = 'ressources/bouclier#bouclier:targe:mythril' AND prix = 404 AND prix_brut = '404';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:targe:mythril : prix', changes(), 1);
UPDATE bouclier SET prix = 405, prix_brut = '405' WHERE id = 'ressources/bouclier#bouclier:targe:titane' AND prix = 404 AND prix_brut = '404';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('bouclier ressources/bouclier#bouclier:targe:titane : prix', changes(), 1);

-- le corps des pages ressources/armures et ressources/bouclier (recherche) : la ligne de chaque armure ou bouclier changé (lib/corps-armures.mjs)

UPDATE page SET corps_md = replace(corps_md, '| Bois | Fonte | Armure Bois/Fonte | 259 | Lourd | +17AP +1AM | 1 | x2 Taille | x2 Frappe |', '| Bois | Fonte | Armure Bois/Fonte | 259 | Lourd | +16AP +1AM | 1 | x2 Taille | x2 Frappe |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Bois | Fonte | Armure Bois/Fonte | 259 | Lourd | +17AP +1AM | 1 | x2 Taille | x2 Frappe |', '')) = length('| Bois | Fonte | Armure Bois/Fonte | 259 | Lourd | +17AP +1AM | 1 | x2 Taille | x2 Frappe |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Bois | Fonte | Armure Bois/Fonte | 259 | Lourd | +17AP +1A', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Chitine | Corne/Os | Armure Chitine/Corne | 280 | Intermédiaire | +13AP +2AM | 3 |  | Estoc |', '| Chitine | Corne/Os | Armure Chitine/Corne | 280 | Intermédiaire | +13AP +1AM | 3 |  | Estoc |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Chitine | Corne/Os | Armure Chitine/Corne | 280 | Intermédiaire | +13AP +2AM | 3 |  | Estoc |', '')) = length('| Chitine | Corne/Os | Armure Chitine/Corne | 280 | Intermédiaire | +13AP +2AM | 3 |  | Estoc |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Chitine | Corne/Os | Armure Chitine/Corne | 280 | Interméd', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Mythril | Cuivre | Armure Mythril/Cuivre | 1 450 | Intermédiaire | +12AP +16AM | 3 | Estoc/Taille | x2 Frappe |', '| Mythril | Cuivre | Armure Mythril/Cuivre | 1 450 | Intermédiaire | +10AP +16AM | 3 | Estoc/Taille | x2 Frappe |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Mythril | Cuivre | Armure Mythril/Cuivre | 1 450 | Intermédiaire | +12AP +16AM | 3 | Estoc/Taille | x2 Frappe |', '')) = length('| Mythril | Cuivre | Armure Mythril/Cuivre | 1 450 | Intermédiaire | +12AP +16AM | 3 | Estoc/Taille | x2 Frappe |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Mythril | Cuivre | Armure Mythril/Cuivre | 1 450 | Intermé', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Cuivre | Vif Argent | Armure Cuivre/Vif Argent | 2 050 | Intermédiaire | +16AP +10AM | 3 | Estoc/Taille | x2 Frappe |', '| Cuivre | Vif Argent | Armure Cuivre/Vif Argent | 2 050 | Intermédiaire | +12AP +16AM | 3 | Estoc/Taille | x2 Frappe |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Cuivre | Vif Argent | Armure Cuivre/Vif Argent | 2 050 | Intermédiaire | +16AP +10AM | 3 | Estoc/Taille | x2 Frappe |', '')) = length('| Cuivre | Vif Argent | Armure Cuivre/Vif Argent | 2 050 | Intermédiaire | +16AP +10AM | 3 | Estoc/Taille | x2 Frappe |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Cuivre | Vif Argent | Armure Cuivre/Vif Argent | 2 050 | I', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Écailles | Titane | Armure Écailles/Titane | 1 690 | Lourd | +21AP +13AM | 4 | Taille/Frappe | x2 Estoc |', '| Écailles | Titane | Armure Écailles/Titane | 1 690 | Lourd | +21AP +15AM | 4 | Taille/Frappe | x2 Estoc |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Écailles | Titane | Armure Écailles/Titane | 1 690 | Lourd | +21AP +13AM | 4 | Taille/Frappe | x2 Estoc |', '')) = length('| Écailles | Titane | Armure Écailles/Titane | 1 690 | Lourd | +21AP +13AM | 4 | Taille/Frappe | x2 Estoc |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Écailles | Titane | Armure Écailles/Titane | 1 690 | Lourd', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Or | Titane | Armure Or/Titane | 1 810 | Lourd | +25AP +13AM | 3 | Frappe | Estoc |', '| Or | Titane | Armure Or/Titane | 1 810 | Lourd | +25AP +12AM | 3 | Frappe | Estoc |') WHERE id = 'ressources/armures' AND length(corps_md) - length(replace(corps_md, '| Or | Titane | Armure Or/Titane | 1 810 | Lourd | +25AP +13AM | 3 | Frappe | Estoc |', '')) = length('| Or | Titane | Armure Or/Titane | 1 810 | Lourd | +25AP +13AM | 3 | Frappe | Estoc |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/armures : | Or | Titane | Armure Or/Titane | 1 810 | Lourd | +25AP +13', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Mythril | Targe Mythril | 404 | +8AP +10AM |', '| Mythril | Targe Mythril | 405 | +8AP +10AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Mythril | Targe Mythril | 404 | +8AP +10AM |', '')) = length('| Mythril | Targe Mythril | 404 | +8AP +10AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Mythril | Targe Mythril | 404 | +8AP +10AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Bronze | Targe Bronze | 172,5 | +6AP +6AM |', '| Bronze | Targe Bronze | 175 | +6AP +6AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Bronze | Targe Bronze | 172,5 | +6AP +6AM |', '')) = length('| Bronze | Targe Bronze | 172,5 | +6AP +6AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Bronze | Targe Bronze | 172,5 | +6AP +6AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Titane | Targe Titane | 404 | +14AP +8AM |', '| Titane | Targe Titane | 405 | +14AP +8AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Titane | Targe Titane | 404 | +14AP +8AM |', '')) = length('| Titane | Targe Titane | 404 | +14AP +8AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Titane | Targe Titane | 404 | +14AP +8AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Bois | Bouclier Rond Bois | 10,5 | +3AP +3AM |', '| Bois | Bouclier Rond Bois | 12 | +3AP +3AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Bois | Bouclier Rond Bois | 10,5 | +3AP +3AM |', '')) = length('| Bois | Bouclier Rond Bois | 10,5 | +3AP +3AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Bois | Bouclier Rond Bois | 10,5 | +3AP +3AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Argent | Bouclier Rond Argent |  | +15AP |', '| Argent | Bouclier Rond Argent | 112,5 | +15AP |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Argent | Bouclier Rond Argent |  | +15AP |', '')) = length('| Argent | Bouclier Rond Argent |  | +15AP |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Argent | Bouclier Rond Argent |  | +15AP |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Fer Noir | Pavois Fer Noir | 197,5 | +10AP +5AM |', '| Fer Noir | Pavois Fer Noir | 187,5 | +10AP +5AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Fer Noir | Pavois Fer Noir | 197,5 | +10AP +5AM |', '')) = length('| Fer Noir | Pavois Fer Noir | 197,5 | +10AP +5AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Fer Noir | Pavois Fer Noir | 197,5 | +10AP +5AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Corne/Os | Pavois Corne | 172,5 | +20AP |', '| Corne/Os | Pavois Corne | 162,5 | +20AP |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Corne/Os | Pavois Corne | 172,5 | +20AP |', '')) = length('| Corne/Os | Pavois Corne | 172,5 | +20AP |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Corne/Os | Pavois Corne | 172,5 | +20AP |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Écailles | Pavois Écailles | 424,5 | +20AP +20AM |', '| Écailles | Pavois Écailles | 412,5 | +20AP +20AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Écailles | Pavois Écailles | 424,5 | +20AP +20AM |', '')) = length('| Écailles | Pavois Écailles | 424,5 | +20AP +20AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Écailles | Pavois Écailles | 424,5 | +20AP +20AM |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Argent | Pavois Argent | 197,5 | +25AP |', '| Argent | Pavois Argent | 187,5 | +25AP |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Argent | Pavois Argent | 197,5 | +25AP |', '')) = length('| Argent | Pavois Argent | 197,5 | +25AP |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Argent | Pavois Argent | 197,5 | +25AP |', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Bronze | Pavois Bronze | 442,5 | +15AP +15AM |', '| Bronze | Pavois Bronze | 437,5 | +15AP +15AM |') WHERE id = 'ressources/bouclier' AND length(corps_md) - length(replace(corps_md, '| Bronze | Pavois Bronze | 442,5 | +15AP +15AM |', '')) = length('| Bronze | Pavois Bronze | 442,5 | +15AP +15AM |');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page ressources/bouclier : | Bronze | Pavois Bronze | 442,5 | +15AP +15AM |', changes(), 1);

-- (3) les 42 recettes de bâton magique : test de Perception + Volonté (Doc « MÉTIER » : Enchanteur [PERCEPTION + VOLONTÉ])

UPDATE recette SET test_brut = 'Test de Perception + Volonté', test_carac_1_id = 'perception', test_carac_2_id = 'volonte' WHERE genre = 'baton_magique' AND test_brut = 'Test de Volonté + Intelligence' AND test_carac_1_id = 'volonte' AND test_carac_2_id = 'intelligence';
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('recette baton_magique : Perception + Volonté', changes(), 42);

-- (3) la phrase de la page Bâton magique, le panneau de règles « Armes » (Armes!A1) et le corps de la page Armes (recherche)

UPDATE page SET corps_md = replace(corps_md, 'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge', 'Morceau du bon bois + La bonne gemme + Test de Perception + Volonté = Bâton élémentaire vierge') WHERE id = 'ressources/baton-magique' AND length(corps_md) - length(replace(corps_md, 'Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge', '')) = length('Morceau du bon bois + La bonne gemme + Test de Volonté + Intelligence = Bâton élémentaire vierge');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page {"id":"ressources/baton-magique"} : R207 (3) : Enchanteur', changes(), 1);
UPDATE panneau_regles_bloc SET texte = replace(texte, 'Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.', 'Les caractéristiques Force et Volonté seront utilisées lors du test d''artisanat.') WHERE panneau_id = 'armes' AND rang = 1 AND length(texte) - length(replace(texte, 'Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.', '')) = length('Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('panneau_regles_bloc {"panneau_id":"armes","rang":1} : R207 (3) : Forgeron', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.', 'Les caractéristiques Force et Volonté seront utilisées lors du test d''artisanat.') WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, 'Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.', '')) = length('Les caractéristiques Force et Intelligence seront utilisées lors du test d''artisanat.');
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('page {"id":"ressources/armes"} : R207 (3) : Forgeron', changes(), 1);

-- la constante des 6 unités de chaque matériau d'une armure (R93, reprise par R207 (1)) : seul nombre de la formule qui n'était qu'au code
-- (lib/armure-forge.mjs#UNITES_PAR_MATERIAU) ; les 10 RO sont armure_emplacement « armure-complete », les 2,5 RO par classe armure_emplacement « bouclier »

INSERT INTO constante_equipement (id, valeur, unite, texte, page_id, origine, source_ref, remarque) VALUES ('armure.unites_par_materiau', 6, 'unites', 'le prix est toujours de 6 unités d''un matériau 1, et 6 d''un matériau 2', 'ressources/armures', 'equipement', 'Décision R93 du propriétaire ; décision R207 (1)', NULL);
INSERT INTO garde_0105 (quoi, lignes, attendu) VALUES ('constante_equipement armure.unites_par_materiau', changes(), 1);

DROP TABLE garde_0105;

-- 0079-r164-sorts-fer : décision R164 du propriétaire du 2026-10-23 (réponses aux questions Q49 à Q56, et la correction du propriétaire sur Fer
-- corrompu, docs/decisions-regles.md), sur le modèle de la 0067 (R114, « Sort grenade »). Migration de DONNÉES seules (sections 1, 3 et 8 ;
-- PRAGMA user_version 78 -> 79 ; dans data/schema.sql, seul le commentaire de sort_mot_cle change) :
--   1. le mot-clé « Sort fer » du glossaire (id `sort-fer` = normalize(libelle), comme tout mot-clé à sa création), défini par le propriétaire
--      « Type de sort d'amélioration qui s'applique sur une arme. » (Q49 ; le libellé proposé n'est pas contredit) ; le site s'en sert (la fiche
--      reconnaît les sorts fer à leur étiquette, jamais à leur nom : « ... Brutale », +2 dégâts en posture Focus, Q51) : il est protégé
--      (client/src/lib/mots-cles.mjs#MOTS_CLES_PROTEGES ; refus 409 de client/serveur/edition-chronologie.mjs#verifierNonProtege, et de
--      #verifierSansSort tant qu'il étiquette un sort) ;
--   2. l'étiquette « Sort fer » (sort_mot_cle) sur les 13 sorts « Fer… » de la décision, Fer corrompu compris (« Les 13, Fer corrompu inclus ») : un
--      par magie sauf l'Arcane et le Potentiel Illimité, les 13 sorts de la table `sort` dont le nom commence par « Fer », cités par leur id (figé :
--      0006). Un id absent arrête la migration (clé étrangère contrôlée avant le COMMIT), et la garde refuse un sort « Fer… » resté sans étiquette ;
--   3. l'effet (sort.effets) des 13 sorts :
--      * 12, réécrits « en une formulation plus naturelle que « tape dans l'élément … » » (Q50) et validés tels quels (Q54) : la phrase d'ambiance
--        d'origine, puis « : pendant 3 tours, ses attaques infligent des dégâts de [élément]. » ;
--      * Fer corrompu, après la correction du propriétaire (« le Fer corrompu le change PAS le type de dégâts. Pas de type Corruption ça reste les
--        dégâts physique de l'arme. Par contre on reste sur le +5 de corruption sur la cible à la place ») et sa réponse à Q56 (« Chaque attaque,
--        3 tours ») : les dégâts de l'arme restent physiques, et chacune de ses attaques inflige 5 points de corruption à la cible pendant 3 tours.
--        C'est la seule de ces cases que le site de dev a modifiée (lot du 2026-10-18 : la balise « 5 points de {{corruption|corruption}} », R103,
--        R140) : R164 demande de réécrire l'effet, la migration ÉCRASE donc cette valeur venue du site, en gardant sa balise sur le même mot, sous la
--        même forme (texte de case : {{id|texte}}) ; rien d'autre n'est balisé. historique_modification ne change pas (la migration n'est pas une
--        modification du site de dev) : la valeur d'import qu'il garde (lib/historique-site.mjs#valeurDImport) est l'effet d'avant le lot du site.
--      Apostrophe droite, la convention de sort.effets (Fer froid passe de « l’arme » à « l'arme »).
--      Ce qui dérive de l'effet suit, comme le service d'édition le refait quand il change (serveur/edition.mjs, SORT.deriver) : la ligne du sort dans
--      le tableau « ## Sorts » de la page de sa magie (lib/corps-magies.mjs#corpsDeMagieApres : seule la case « Effets » change, « \| » dans la
--      balise) ; ni sort_bonus_maitrise ni sort_etat (aucun des 26 textes, avant comme après, n'écrit d'expression de NM ni d'altération d'état :
--      lib/sort-analyse.mjs#bonusDeMaitrise, lib/sort-etats.mjs#etatsDuTexte), ni la colonne bonus_maitrise. L'index de recherche est refait par
--      db:derive. Ne changent pas : le D/S/B « +8 dégâts », le type, le coût, la portée, la remarque et les notes de cellule (coups critiques).
--   Chaque UPDATE est gardé par la valeur d'avant, et la garde refuse la migration s'il ne change pas exactement une ligne. Les cellules du classeur
--   « Magie Maverick V8 » gardent l'effet d'origine : entrées `voulus` de tools/sources/ignorer/magie-maverick-v8.json.
--   4. Le mot-clé balisé dans les textes qui parlent de ces sorts (R164, « Oui, tous ») : ici, les trois que le site de dev ne modifie pas (comme
--      la 0058 pour « Solidité »), sous la forme canonique de leur colonne (lib/mots-cles-balises.mjs), les mots écrits gardés tels quels,
--      guillemets compris ; l'expression entière est balisée (le libellé a deux mots, comme « {{recharge-longue|recharge longue}} ») :
--        * « Immatériel » du Fantôme et du Golem d'arcane (créatures invoquées, creature_capacite.texte, texte de case : « un {{sort-fer|sort “fer”}} »),
--          et leur paragraphe dans le corps de la page de la créature (bestiaire/fantome, bestiaire/golem-darcane), qui l'écrit à l'identique ;
--        * la page « Pièces élémentaires » (ressources/pieces-elementaires, Markdown, ligne de liste : « Les {{sort-fer|sorts "fer"}} sont… ») ;
--      registre 0079-r164-sorts-fer.json (`corrections` : le rapprochement d'un classeur défait ces balises, comme les corrections d'orthographe).
--      Les cinq autres (note de « ... Brutale », description de Mage Émeraude, « Jongleur Magique », la capacité commune « Immatériel », la rubrique
--      tactique du Golem d'arcane I) passent par le service du site de dev (client/scripts/baliser-mot-cle.mjs, entrée tools/glossaire/sort-fer.json),
--      journal rapatrié dans data/rows et historique_modification. Les noms des 13 sorts ne sont jamais balisés.

CREATE TEMP TABLE garde_0079 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- 1. Le mot-clé « Sort fer »
INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('sort-fer', 'Sort fer', 'sort-fer',
  'Type de sort d''amélioration qui s''applique sur une arme.');

-- 2. Les 13 étiquettes (ids figés, 0006 ; vérifiés dans data/rows/sort.sql)
INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES
  ('magies/magie-de-la-corruption#sort:fer-corrompu', 'sort-fer'),
  ('magies/magie-de-la-foudre#sort:fer-foudroyant', 'sort-fer'),
  ('magies/magie-de-la-glace#sort:fer-froid', 'sort-fer'),
  ('magies/magie-de-la-lumiere#sort:fer-lumineux', 'sort-fer'),
  ('magies/magie-de-la-necromancie#sort:fer-toxique', 'sort-fer'),
  ('magies/magie-de-la-terre#sort:fer-raffine', 'sort-fer'),
  ('magies/magie-de-leau#sort:fer-humide', 'sort-fer'),
  ('magies/magie-de-lespace-temps#sort:fer-temporel', 'sort-fer'),
  ('magies/magie-de-lombre#sort:fer-obscur', 'sort-fer'),
  ('magies/magie-du-feu#sort:fer-brulant', 'sort-fer'),
  ('magies/magie-du-sang#sort:fer-sanglant', 'sort-fer'),
  ('magies/magie-du-vent#sort:fer-eolien', 'sort-fer'),
  ('magies/magie-du-vide#sort:fer-vide', 'sort-fer');

-- 3. Les 13 effets réécrits (R164, Q54 : « Valider tels quels »), chacun gardé par sa valeur d'avant ; puis sa ligne du tableau « ## Sorts » de la page
--    de sa magie (lib/corps-magies.mjs#corpsDeMagieApres, comme le service la refait), gardée de même
-- Fer corrompu (correction du propriétaire et Q56)
UPDATE sort SET effets = 'Imprègne l''arme d''une énergie mauvaise : pendant 3 tours, chacune de ses attaques inflige 5 points de {{corruption|corruption}} à la cible.'
WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu' AND effets = 'Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de {{corruption|corruption}}.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer corrompu', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer corrompu | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de {{corruption\|corruption}}. |',
  '| 2.0 | Fer corrompu | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Imprègne l''arme d''une énergie mauvaise : pendant 3 tours, chacune de ses attaques inflige 5 points de {{corruption\|corruption}} à la cible. |')
WHERE id = 'magies/magie-de-la-corruption' AND instr(corps_md, '| 2.0 | Fer corrompu | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Imprègne l''arme d''une énergie mauvaise. Inflige 5 points de {{corruption\|corruption}}. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer corrompu', changes());
-- Fer Foudroyant
UPDATE sort SET effets = 'Charge l''arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre.'
WHERE id = 'magies/magie-de-la-foudre#sort:fer-foudroyant' AND effets = 'Charge l''arme en électricité, tape dans l''élément foudre pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Foudroyant', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Foudroyant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Charge l''arme en électricité, tape dans l''élément foudre pendant 3 tours. |',
  '| 2.0 | Fer Foudroyant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Charge l''arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre. |')
WHERE id = 'magies/magie-de-la-foudre' AND instr(corps_md, '| 2.0 | Fer Foudroyant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Charge l''arme en électricité, tape dans l''élément foudre pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Foudroyant', changes());
-- Fer froid
UPDATE sort SET effets = 'Refroidit l''arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace.'
WHERE id = 'magies/magie-de-la-glace#sort:fer-froid' AND effets = 'Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer froid', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer froid | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours. |',
  '| 2.0 | Fer froid | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Refroidit l''arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace. |')
WHERE id = 'magies/magie-de-la-glace' AND instr(corps_md, '| 2.0 | Fer froid | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Refroidit l’arme au point de la rendre gelée, tape dans l''élément glace pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer froid', changes());
-- Fer Lumineux
UPDATE sort SET effets = 'Rend l''arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière.'
WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux' AND effets = 'Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Lumineux', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Lumineux | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours. |',
  '| 2.0 | Fer Lumineux | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière. |')
WHERE id = 'magies/magie-de-la-lumiere' AND instr(corps_md, '| 2.0 | Fer Lumineux | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme parfaitement lumineuse, tape dans l''élément lumière pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Lumineux', changes());
-- Fer Toxique
UPDATE sort SET effets = 'L''arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie.'
WHERE id = 'magies/magie-de-la-necromancie#sort:fer-toxique' AND effets = 'L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Toxique', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Toxique | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours. |',
  '| 2.0 | Fer Toxique | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie. |')
WHERE id = 'magies/magie-de-la-necromancie' AND instr(corps_md, '| 2.0 | Fer Toxique | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme suinte une matière toxique, tape dans l''élément Nécromancie pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Toxique', changes());
-- Fer Raffiné
UPDATE sort SET effets = 'Renforce l''arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre.'
WHERE id = 'magies/magie-de-la-terre#sort:fer-raffine' AND effets = 'Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Raffiné', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Raffiné | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours. |',
  '| 2.0 | Fer Raffiné | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Renforce l''arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre. |')
WHERE id = 'magies/magie-de-la-terre' AND instr(corps_md, '| 2.0 | Fer Raffiné | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Renforce l''arme avec un métal raffiné, tape dans l''élément terre pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Raffiné', changes());
-- Fer Humide
UPDATE sort SET effets = 'L''arme transpire de l''eau : pendant 3 tours, ses attaques infligent des dégâts d''eau.'
WHERE id = 'magies/magie-de-leau#sort:fer-humide' AND effets = 'L''arme transpire de l''eau, tape dans l''élément Eau pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Humide', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Humide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme transpire de l''eau, tape dans l''élément Eau pendant 3 tours. |',
  '| 2.0 | Fer Humide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme transpire de l''eau : pendant 3 tours, ses attaques infligent des dégâts d''eau. |')
WHERE id = 'magies/magie-de-leau' AND instr(corps_md, '| 2.0 | Fer Humide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme transpire de l''eau, tape dans l''élément Eau pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Humide', changes());
-- Fer Temporel
UPDATE sort SET effets = 'Rend l''arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d''espace-temps.'
WHERE id = 'magies/magie-de-lespace-temps#sort:fer-temporel' AND effets = 'Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Temporel', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Temporel | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours. |',
  '| 2.0 | Fer Temporel | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d''espace-temps. |')
WHERE id = 'magies/magie-de-lespace-temps' AND instr(corps_md, '| 2.0 | Fer Temporel | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme rose et noire, tape dans l''élément Temps/Espace pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Temporel', changes());
-- Fer Obscur
UPDATE sort SET effets = 'L''arme se charge d''une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d''ombre.'
WHERE id = 'magies/magie-de-lombre#sort:fer-obscur' AND effets = 'L''arme se charge d''une énergie sombre, tape dans l''élément ombre pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Obscur', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Obscur | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme se charge d''une énergie sombre, tape dans l''élément ombre pendant 3 tours. |',
  '| 2.0 | Fer Obscur | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme se charge d''une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d''ombre. |')
WHERE id = 'magies/magie-de-lombre' AND instr(corps_md, '| 2.0 | Fer Obscur | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme se charge d''une énergie sombre, tape dans l''élément ombre pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Obscur', changes());
-- Fer brûlant
UPDATE sort SET effets = 'Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu.'
WHERE id = 'magies/magie-du-feu#sort:fer-brulant' AND effets = 'Chauffe le métal à blanc, l''arme inflige l''élément Feu pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer brûlant', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer brûlant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Chauffe le métal à blanc, l''arme inflige l''élément Feu pendant 3 tours. |',
  '| 2.0 | Fer brûlant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu. |')
WHERE id = 'magies/magie-du-feu' AND instr(corps_md, '| 2.0 | Fer brûlant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Chauffe le métal à blanc, l''arme inflige l''élément Feu pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer brûlant', changes());
-- Fer Sanglant
UPDATE sort SET effets = 'Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang.'
WHERE id = 'magies/magie-du-sang#sort:fer-sanglant' AND effets = 'Le sang sur la lame ne sèche pas, permet de taper dans l''élément sang pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Sanglant', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Sanglant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Le sang sur la lame ne sèche pas, permet de taper dans l''élément sang pendant 3 tours. |',
  '| 2.0 | Fer Sanglant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang. |')
WHERE id = 'magies/magie-du-sang' AND instr(corps_md, '| 2.0 | Fer Sanglant | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Le sang sur la lame ne sèche pas, permet de taper dans l''élément sang pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Sanglant', changes());
-- Fer éolien
UPDATE sort SET effets = 'L''arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent.'
WHERE id = 'magies/magie-du-vent#sort:fer-eolien' AND effets = 'L''arme crache du vent, tape dans l''élément Vent pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer éolien', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer éolien | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme crache du vent, tape dans l''élément Vent pendant 3 tours. |',
  '| 2.0 | Fer éolien | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent. |')
WHERE id = 'magies/magie-du-vent' AND instr(corps_md, '| 2.0 | Fer éolien | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | L''arme crache du vent, tape dans l''élément Vent pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer éolien', changes());
-- Fer Vide
UPDATE sort SET effets = 'Rend l''arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide.'
WHERE id = 'magies/magie-du-vide#sort:fer-vide' AND effets = 'Rend l''arme transparente, tape dans l''élément Vide pendant 3 tours.';
INSERT INTO garde_0079 (quoi, lignes) VALUES ('effets Fer Vide', changes());
UPDATE page SET corps_md = replace(corps_md,
  '| 2.0 | Fer Vide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme transparente, tape dans l''élément Vide pendant 3 tours. |',
  '| 2.0 | Fer Vide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide. |')
WHERE id = 'magies/magie-du-vide' AND instr(corps_md, '| 2.0 | Fer Vide | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | Rend l''arme transparente, tape dans l''élément Vide pendant 3 tours. |') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Fer Vide', changes());

-- 4. Les balises des trois textes que le site de dev ne modifie pas (une occurrence chacun)
UPDATE creature_capacite SET texte = replace(texte, 'sort “fer”', '{{sort-fer|sort “fer”}}')
WHERE id IN ('bestiaire/fantome#capacite:immateriel', 'bestiaire/golem-darcane#capacite:immateriel') AND instr(texte, 'sort “fer”') > 0
  AND instr(texte, '{{') = 0;
INSERT INTO garde_0079 (quoi, lignes, attendu) VALUES ('Immatériel des créatures', changes(), 2);
UPDATE page SET corps_md = replace(corps_md, 'une arme sous l’effet d’un sort “fer” peuvent la toucher', 'une arme sous l’effet d’un {{sort-fer|sort “fer”}} peuvent la toucher')
WHERE id IN ('bestiaire/fantome', 'bestiaire/golem-darcane') AND instr(corps_md, 'une arme sous l’effet d’un sort “fer” peuvent la toucher') > 0;
INSERT INTO garde_0079 (quoi, lignes, attendu) VALUES ('pages des créatures', changes(), 2);
UPDATE page SET corps_md = replace(corps_md, '- Les sorts "fer" sont utilisables sur les armes élémentaires', '- Les {{sort-fer|sorts "fer"}} sont utilisables sur les armes élémentaires')
WHERE id = 'ressources/pieces-elementaires' AND instr(corps_md, '- Les sorts "fer" sont utilisables sur les armes élémentaires') > 0;
INSERT INTO garde_0079 (quoi, lignes) VALUES ('page Pièces élémentaires', changes());
INSERT INTO garde_0079 SELECT 'balises des créatures et de leurs pages', (SELECT count(*) FROM creature_capacite WHERE instr(texte, '{{sort-fer|') > 0)
  + (SELECT count(*) FROM page WHERE id IN ('bestiaire/fantome', 'bestiaire/golem-darcane') AND instr(corps_md, '{{sort-fer|') > 0), 4;

-- Aucun sort « Fer… » sans l'étiquette, aucune étiquette ailleurs
INSERT INTO garde_0079 SELECT 'sorts Fer sans étiquette', count(*), 0 FROM sort s
WHERE s.nom LIKE 'Fer %' AND NOT EXISTS (SELECT 1 FROM sort_mot_cle e WHERE e.sort_id = s.id AND e.mot_cle_id = 'sort-fer');
INSERT INTO garde_0079 SELECT 'étiquettes sort-fer', count(*), 13 FROM sort_mot_cle WHERE mot_cle_id = 'sort-fer';

DROP TABLE garde_0079;

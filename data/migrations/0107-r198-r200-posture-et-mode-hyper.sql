-- 0107-r198-r200-posture-et-mode-hyper : décisions R198 (6) et R200 (3) du propriétaire (réponses du 2026-11-07, docs/decisions-regles.md), deux textes
-- que la 0104 (0104-r198-r208-textes-du-guide) n'avait pas repris, demandés par game-design. Migration de DONNÉES seules (section 1 ; PRAGMA
-- user_version 106 -> 107 ; rien d'autre ne change dans data/schema.sql) ; rien ne va dans historique_modification (la migration n'est pas une
-- modification du site de dev). Registre avant/après : 0107-r198-r200-posture-et-mode-hyper.json (`textes`, comme celui de la 0104 : pas sous
-- `corrections`, ce ne sont pas des corrections d'un classeur).
--   * R198 (6) : la définition du mot-clé posture (un texte du site, pas une copie) ne dit plus qu'on la « déclare » à chaque tour : on garde sa posture
--     tant qu'on n'en change pas (même formulation que guide/les-postures et guide/le-tour-de-jeu, 0104).
--   * R200 (3) : guide/la-magie-en-jeu, le Mode Hyper brûle 10 % du chakra maximum à la fin de chaque tour du joueur ; la phrase du manque payé en
--     santé (R186) ne change pas.
-- La garde : chaque UPDATE ne remplace qu'un fragment présent une seule fois dans la valeur d'avant, et doit changer exactement une ligne. Une valeur
-- que le site de dev aurait réécrite arrête la migration.


CREATE TEMP TABLE garde_0107 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- mot_cle.description posture (R198 (6))
UPDATE mot_cle SET description = replace(description, 'que l’on déclare au début de son tour.',
  'que l’on prend ou change au début de son tour : on garde sa posture tant qu’on n’en change pas.')
  WHERE id = 'posture' AND length(description) - length(replace(description, 'que l’on déclare au début de son tour.', '')) = length('que l’on déclare au début de son tour.');
INSERT INTO garde_0107 (quoi, lignes) VALUES ('mot_cle posture : R198 (6)', changes());

-- page.corps_md guide/la-magie-en-jeu (R200 (3))
UPDATE page SET corps_md = replace(corps_md, 'en brûle 10 % du maximum à chaque tour',
  'en brûle 10 % du maximum à la fin de chaque tour du joueur')
  WHERE id = 'guide/la-magie-en-jeu' AND length(corps_md) - length(replace(corps_md, 'en brûle 10 % du maximum à chaque tour', '')) = length('en brûle 10 % du maximum à chaque tour');
INSERT INTO garde_0107 (quoi, lignes) VALUES ('page guide/la-magie-en-jeu : R200 (3)', changes());

DROP TABLE garde_0107;

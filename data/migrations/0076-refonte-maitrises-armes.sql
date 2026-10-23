-- 0076-refonte-maitrises-armes : refonte des maîtrises d'armes de la fiche de personnage (décisions R148 à R154 du propriétaire, 2026-10-22 ; cahier des
-- charges de game-design, variante A « Bloc des sources »). Migration de STRUCTURE et de DONNÉES.
--   * Les sources de maîtrise en données (R148, R150, R151), section 6 : maitrise_arme_part (ce que donne chaque ligne de classe_maitrise_arme et chaque
--     don, en parts : une famille imposée, des points à choisir avec leur limite écrite, ou la famille suivie de la maîtrise au choix de la classe),
--     maitrise_arme_part_famille (les options de chaque part à choisir, jamais ARME DE MONSTRES : R45) et capacite_nm_gagne (les NM de sorts qu'écrit un
--     don, R154). Lignes écrites par client/src/lib/maitrise-arme.mjs (lireLigneDeClasse, lireDon, nmGagnesDuDon) rejoué sur toute la base, que
--     test/maitrise-arme-sources.test.mjs rejoue à son tour : 147 parts (66 de lignes de classe, 81 de 77 dons), 952 options, 1 don à NM gagnés.
--   * L'accessoire « Un point de maîtrise d'arme » (R151) : sa famille se choisit dans la fiche (accessoire_effet_cible.choix = 1 ;
--     personnage_accessoire.arme_famille_id, colonne de 0037).
--   * Section 13 (data/rows garde les tables des fiches vides) : personnage_maitrise_arme disparaît (R148 : plus rien ne se saisit par famille ; la base
--     vivante convertit ses fiches, R153 : serveur/base-vivante.mjs) ; personnage_maitrise_choix garde la famille de chaque point à choisir ;
--     personnage_acquis_choix perd arme_famille_id et son index (R152 : l'arme du bonus est la famille de la maîtrise au choix de la classe), table
--     reconstruite (une colonne sous clé étrangère ne se retire pas par DROP COLUMN).
--   * Vues : v_personnage_don_acquis (miroir de lib/fiche-moteur.mjs#donsAcquis), v_personnage_maitrise_part (les parts des sources acquises),
--     v_personnage_maitrise_arme (les points et les dés de chaque famille, R149) ; v_personnage_controle : maitrise_a_choisir, maitrise_hors_choix,
--     maitrise_meme_famille, maitrise_plafond, maitrise_source_perdue, maitrise_arme_exclue réécrite (R45), sorts_nm_total avec les NM des dons (R154).

DROP VIEW v_personnage_controle;


-- Section 6 : les sources de maîtrise d'arme (R148 à R151, R154)

CREATE TABLE maitrise_arme_part (
  source_id       TEXT    NOT NULL CHECK (length(source_id) > 0),   -- capacite.id pour un don ; '<classe_id>#maitrise-arme:<rang de la ligne>' pour une ligne de
                                                                    -- classe (lib/maitrise-arme.mjs#idDeSourceDeClasse) : l'identifiant que la fiche enregistre
  rang            INTEGER NOT NULL CHECK (rang >= 1),               -- rang de la part dans le texte de la source
  capacite_id     TEXT    REFERENCES capacite(id) ON DELETE CASCADE,   -- la source est un don ; NULL pour une ligne de classe
  classe_id       TEXT,                                             -- la source est une ligne de classe_maitrise_arme (classe_id, classe_rang) ; NULL pour un don
  classe_rang     INTEGER,
  genre           TEXT    NOT NULL CHECK (genre IN ('imposee', 'choix', 'suit')),
  points          INTEGER NOT NULL CHECK (points <> 0),             -- points de la part, signés (le −1 de l'Épéiste, R151) ; toujours > 0 pour une part à choisir
  arme_famille_id TEXT    REFERENCES arme_famille(id),              -- la famille imposée ('imposee' seulement ; jamais ARME DE MONSTRES, R45 : test)
  limite_famille  INTEGER CHECK (limite_famille >= 1),              -- 'choix' : au plus N points de la part sur une même famille, quand la source l'écrit (R150)
  PRIMARY KEY (source_id, rang),
  FOREIGN KEY (classe_id, classe_rang) REFERENCES classe_maitrise_arme (classe_id, rang) ON DELETE CASCADE,
  CHECK ((capacite_id IS NULL) <> (classe_id IS NULL)),             -- un don ou une ligne de classe, jamais les deux ni aucun
  CHECK ((classe_id IS NULL) = (classe_rang IS NULL)),
  CHECK (capacite_id IS NULL OR source_id = capacite_id),
  CHECK (classe_id IS NULL OR source_id = classe_id || '#maitrise-arme:' || classe_rang),
  CHECK ((genre = 'imposee') = (arme_famille_id IS NOT NULL)),
  CHECK (genre = 'choix' OR limite_famille IS NULL),
  CHECK (genre <> 'choix' OR points > 0),
  CHECK (genre <> 'suit' OR capacite_id IS NOT NULL)                -- seul un don suit la maîtrise au choix de sa classe
) STRICT, WITHOUT ROWID;

CREATE INDEX maitrise_arme_part_capacite ON maitrise_arme_part (capacite_id) WHERE capacite_id IS NOT NULL;   -- « les parts d'un don » (dons acquis)

CREATE INDEX maitrise_arme_part_classe ON maitrise_arme_part (classe_id, classe_rang) WHERE classe_id IS NOT NULL;   -- « les parts des lignes d'une classe »

CREATE INDEX maitrise_arme_part_arme_famille ON maitrise_arme_part (arme_famille_id) WHERE arme_famille_id IS NOT NULL;

CREATE TABLE maitrise_arme_part_famille (
  source_id       TEXT    NOT NULL,
  rang            INTEGER NOT NULL,
  arme_famille_id TEXT    NOT NULL REFERENCES arme_famille(id),
  PRIMARY KEY (source_id, rang, arme_famille_id),
  FOREIGN KEY (source_id, rang) REFERENCES maitrise_arme_part (source_id, rang) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX maitrise_arme_part_famille_arme ON maitrise_arme_part_famille (arme_famille_id);

CREATE TABLE capacite_nm_gagne (
  capacite_id  TEXT    NOT NULL PRIMARY KEY REFERENCES capacite(id) ON DELETE CASCADE,
  nm           INTEGER NOT NULL CHECK (nm >= 1)
) STRICT, WITHOUT ROWID;

-- lignes écrites par le lecteur (lib/maitrise-arme.mjs) rejoué sur la base de dev en version 73

INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES
  ('capacites/anansi-cemies', 1, 'capacites/anansi-cemies', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/anansi-marionnettiste', 1, 'capacites/anansi-marionnettiste', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/arbaletrier-baliste', 1, 'capacites/arbaletrier-baliste', NULL, NULL, 'imposee', 2, 'arbalete', NULL),
  ('capacites/arbaletrier-grand-arbaletrier', 1, 'capacites/arbaletrier-grand-arbaletrier', NULL, NULL, 'imposee', 2, 'arbalete', NULL),
  ('capacites/archer-grand-archer', 1, 'capacites/archer-grand-archer', NULL, NULL, 'imposee', 2, 'arc', NULL),
  ('capacites/archer-tireur-delite', 1, 'capacites/archer-tireur-delite', NULL, NULL, 'imposee', 2, 'arc', NULL),
  ('capacites/archimage-elementaliste', 1, 'capacites/archimage-elementaliste', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/archimage-occultiste', 1, 'capacites/archimage-occultiste', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/barde-danseur', 1, 'capacites/barde-danseur', NULL, NULL, 'imposee', 1, 'dagues', NULL),
  ('capacites/barde-menestrel', 1, 'capacites/barde-menestrel', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/bimane-fausse-patte', 1, 'capacites/bimane-fausse-patte', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/bimane-ravageur', 1, 'capacites/bimane-ravageur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/clerc-saint-combattant', 1, 'capacites/clerc-saint-combattant', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/clerc-zelote', 1, 'capacites/clerc-zelote', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/cuirasse-protecteur', 1, 'capacites/cuirasse-protecteur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/cuirasse-vindicatif', 1, 'capacites/cuirasse-vindicatif', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/fenrir-belliciste', 1, 'capacites/fenrir-belliciste', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/fenrir-gourou', 1, 'capacites/fenrir-gourou', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/flagelleur-masochiste', 1, 'capacites/flagelleur-masochiste', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/flagelleur-sadique', 1, 'capacites/flagelleur-sadique', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/frappeur-briseur', 1, 'capacites/frappeur-briseur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/frappeur-casseur', 1, 'capacites/frappeur-casseur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/goleois-irreductible', 1, 'capacites/goleois-irreductible', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/goleois-saronide', 1, 'capacites/goleois-saronide', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/grenadier-artilleur', 1, 'capacites/grenadier-artilleur', NULL, NULL, 'imposee', 2, 'bombes', NULL),
  ('capacites/grenadier-bombardier', 1, 'capacites/grenadier-bombardier', NULL, NULL, 'imposee', 2, 'bombes', NULL),
  ('capacites/guerrier-epeiste', 1, 'capacites/guerrier-epeiste', NULL, NULL, 'imposee', 2, 'epees', NULL),
  ('capacites/guerrier-epeiste', 2, 'capacites/guerrier-epeiste', NULL, NULL, 'imposee', 1, 'dagues', NULL),
  ('capacites/guerrier-epeiste', 3, 'capacites/guerrier-epeiste', NULL, NULL, 'suit', -1, NULL, NULL),
  ('capacites/guerrier-maitre-darme', 1, 'capacites/guerrier-maitre-darme', NULL, NULL, 'choix', 5, NULL, 2),
  ('capacites/jackalope-adepte', 1, 'capacites/jackalope-adepte', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/jackalope-ninja', 1, 'capacites/jackalope-ninja', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/kitsune-druide', 1, 'capacites/kitsune-druide', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/kitsune-fripon', 1, 'capacites/kitsune-fripon', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/lanceur-fantassin', 1, 'capacites/lanceur-fantassin', NULL, NULL, 'imposee', 2, 'arme-de-jet', NULL),
  ('capacites/lanceur-fantassin', 2, 'capacites/lanceur-fantassin', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/lanceur-jongleur', 1, 'capacites/lanceur-jongleur', NULL, NULL, 'imposee', 2, 'arme-de-jet', NULL),
  ('capacites/lanceur-jongleur', 2, 'capacites/lanceur-jongleur', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/lancier-maitre-dhast', 1, 'capacites/lancier-maitre-dhast', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/lancier-myrmidon', 1, 'capacites/lancier-myrmidon', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/maclier-archiclier', 1, 'capacites/maclier-archiclier', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/maclier-grand-maclier', 1, 'capacites/maclier-grand-maclier', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/mage-bleu-mage-saphir', 1, 'capacites/mage-bleu-mage-saphir', NULL, NULL, 'suit', 2, NULL, NULL),
  ('capacites/mage-mage-blanc', 1, 'capacites/mage-mage-blanc', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/mage-mage-noir', 1, 'capacites/mage-mage-noir', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/mage-rouge-mage-grenat', 1, 'capacites/mage-rouge-mage-grenat', NULL, NULL, 'suit', 2, NULL, NULL),
  ('capacites/mage-rouge-mage-rubis', 1, 'capacites/mage-rouge-mage-rubis', NULL, NULL, 'suit', 2, NULL, NULL),
  ('capacites/mage-vert-mage-emeraude', 1, 'capacites/mage-vert-mage-emeraude', NULL, NULL, 'suit', 2, NULL, NULL),
  ('capacites/mage-vert-mage-jade', 1, 'capacites/mage-vert-mage-jade', NULL, NULL, 'suit', 2, NULL, NULL),
  ('capacites/marcass-canaille', 1, 'capacites/marcass-canaille', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/marcass-devot', 1, 'capacites/marcass-devot', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/martiale-berserker', 1, 'capacites/martiale-berserker', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/martiale-heros', 1, 'capacites/martiale-heros', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/medusain-augure', 1, 'capacites/medusain-augure', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/medusain-hoplite', 1, 'capacites/medusain-hoplite', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'capacites/mercenaire-chasseur-de-primes', NULL, NULL, 'choix', 5, NULL, NULL),
  ('capacites/mercenaire-combattant-libre', 1, 'capacites/mercenaire-combattant-libre', NULL, NULL, 'choix', 5, NULL, 3),
  ('capacites/minotaure-gladiateur', 1, 'capacites/minotaure-gladiateur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/minotaure-medium', 1, 'capacites/minotaure-medium', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/moine-moine-guerrier', 1, 'capacites/moine-moine-guerrier', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/moine-templier', 1, 'capacites/moine-templier', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/namazu-batailleur', 1, 'capacites/namazu-batailleur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/namazu-devin', 1, 'capacites/namazu-devin', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/ocultomancien-meteorologue', 1, 'capacites/ocultomancien-meteorologue', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/ocultomancien-specialiste', 1, 'capacites/ocultomancien-specialiste', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/olwman-chasseur', 1, 'capacites/olwman-chasseur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/olwman-pape', 1, 'capacites/olwman-pape', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/orios-chaman', 1, 'capacites/orios-chaman', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/orios-va-t-en-guerre', 1, 'capacites/orios-va-t-en-guerre', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/parleur-bonimenteur', 1, 'capacites/parleur-bonimenteur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/parleur-eloquent', 1, 'capacites/parleur-eloquent', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/pugiliste-cogneur', 1, 'capacites/pugiliste-cogneur', NULL, NULL, 'imposee', 2, 'pugilat', NULL),
  ('capacites/pugiliste-lutteur', 1, 'capacites/pugiliste-lutteur', NULL, NULL, 'imposee', 2, 'pugilat', NULL),
  ('capacites/rokh-colombe', 1, 'capacites/rokh-colombe', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/rokh-hirondelle', 1, 'capacites/rokh-hirondelle', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/satyre-galopin', 1, 'capacites/satyre-galopin', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/satyre-oracle', 1, 'capacites/satyre-oracle', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/tueur-fletrisseur', 1, 'capacites/tueur-fletrisseur', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/tueur-sicaire', 1, 'capacites/tueur-sicaire', NULL, NULL, 'choix', 1, NULL, NULL),
  ('capacites/voleur-cambrioleur', 1, 'capacites/voleur-cambrioleur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('capacites/voleur-saboteur', 1, 'capacites/voleur-saboteur', NULL, NULL, 'choix', 2, NULL, NULL),
  ('classes/anansi#maitrise-arme:1', 1, NULL, 'classes/anansi', 1, 'imposee', 1, 'dagues', NULL),
  ('classes/anansi#maitrise-arme:2', 1, NULL, 'classes/anansi', 2, 'choix', 1, NULL, NULL),
  ('classes/arbaletrier#maitrise-arme:1', 1, NULL, 'classes/arbaletrier', 1, 'imposee', 1, 'arbalete', NULL),
  ('classes/arbaletrier#maitrise-arme:2', 1, NULL, 'classes/arbaletrier', 2, 'choix', 1, NULL, NULL),
  ('classes/archer#maitrise-arme:1', 1, NULL, 'classes/archer', 1, 'imposee', 1, 'arc', NULL),
  ('classes/archer#maitrise-arme:2', 1, NULL, 'classes/archer', 2, 'choix', 1, NULL, NULL),
  ('classes/archimage#maitrise-arme:1', 1, NULL, 'classes/archimage', 1, 'choix', 1, NULL, NULL),
  ('classes/archimage#maitrise-arme:2', 1, NULL, 'classes/archimage', 2, 'imposee', 1, 'baton-de-combat', NULL),
  ('classes/barde#maitrise-arme:1', 1, NULL, 'classes/barde', 1, 'choix', 1, NULL, NULL),
  ('classes/barde#maitrise-arme:2', 1, NULL, 'classes/barde', 2, 'imposee', 1, 'dagues', NULL),
  ('classes/bimane#maitrise-arme:1', 1, NULL, 'classes/bimane', 1, 'choix', 2, NULL, 1),
  ('classes/clerc#maitrise-arme:1', 1, NULL, 'classes/clerc', 1, 'imposee', 1, 'masse-marteau', NULL),
  ('classes/clerc#maitrise-arme:2', 1, NULL, 'classes/clerc', 2, 'choix', 1, NULL, NULL),
  ('classes/cuirasse#maitrise-arme:1', 1, NULL, 'classes/cuirasse', 1, 'imposee', 1, 'lance-arme-dhast', NULL),
  ('classes/cuirasse#maitrise-arme:2', 1, NULL, 'classes/cuirasse', 2, 'choix', 1, NULL, NULL),
  ('classes/fenrir#maitrise-arme:1', 1, NULL, 'classes/fenrir', 1, 'imposee', 1, 'epees', NULL),
  ('classes/fenrir#maitrise-arme:2', 1, NULL, 'classes/fenrir', 2, 'choix', 1, NULL, NULL),
  ('classes/flagelleur#maitrise-arme:1', 1, NULL, 'classes/flagelleur', 1, 'imposee', 1, 'masse-marteau', NULL),
  ('classes/flagelleur#maitrise-arme:2', 1, NULL, 'classes/flagelleur', 2, 'choix', 1, NULL, NULL),
  ('classes/frappeur#maitrise-arme:1', 1, NULL, 'classes/frappeur', 1, 'choix', 2, NULL, 1),
  ('classes/goleois#maitrise-arme:1', 1, NULL, 'classes/goleois', 1, 'imposee', 1, 'pugilat', NULL),
  ('classes/goleois#maitrise-arme:2', 1, NULL, 'classes/goleois', 2, 'choix', 1, NULL, NULL),
  ('classes/grenadier#maitrise-arme:1', 1, NULL, 'classes/grenadier', 1, 'imposee', 1, 'bombes', NULL),
  ('classes/grenadier#maitrise-arme:2', 1, NULL, 'classes/grenadier', 2, 'choix', 1, NULL, NULL),
  ('classes/guerrier#maitrise-arme:1', 1, NULL, 'classes/guerrier', 1, 'imposee', 1, 'epees', NULL),
  ('classes/guerrier#maitrise-arme:2', 1, NULL, 'classes/guerrier', 2, 'choix', 1, NULL, NULL),
  ('classes/jackalope#maitrise-arme:1', 1, NULL, 'classes/jackalope', 1, 'imposee', 1, 'epees', NULL),
  ('classes/jackalope#maitrise-arme:2', 1, NULL, 'classes/jackalope', 2, 'choix', 1, NULL, NULL),
  ('classes/kitsune#maitrise-arme:1', 1, NULL, 'classes/kitsune', 1, 'imposee', 1, 'arc', NULL),
  ('classes/kitsune#maitrise-arme:2', 1, NULL, 'classes/kitsune', 2, 'choix', 1, NULL, NULL),
  ('classes/lanceur#maitrise-arme:1', 1, NULL, 'classes/lanceur', 1, 'imposee', 1, 'arme-de-jet', NULL),
  ('classes/lanceur#maitrise-arme:2', 1, NULL, 'classes/lanceur', 2, 'choix', 1, NULL, NULL),
  ('classes/lancier#maitrise-arme:1', 1, NULL, 'classes/lancier', 1, 'imposee', 1, 'lance-arme-dhast', NULL),
  ('classes/lancier#maitrise-arme:2', 1, NULL, 'classes/lancier', 2, 'imposee', 1, 'arme-de-jet', NULL),
  ('classes/maclier#maitrise-arme:1', 1, NULL, 'classes/maclier', 1, 'choix', 1, NULL, NULL),
  ('classes/mage#maitrise-arme:1', 1, NULL, 'classes/mage', 1, 'choix', 1, NULL, NULL),
  ('classes/mage#maitrise-arme:2', 1, NULL, 'classes/mage', 2, 'imposee', 1, 'baton-de-combat', NULL),
  ('classes/mage-bleu#maitrise-arme:1', 1, NULL, 'classes/mage-bleu', 1, 'choix', 1, NULL, NULL),
  ('classes/mage-rouge#maitrise-arme:1', 1, NULL, 'classes/mage-rouge', 1, 'choix', 1, NULL, NULL),
  ('classes/mage-vert#maitrise-arme:1', 1, NULL, 'classes/mage-vert', 1, 'choix', 1, NULL, NULL),
  ('classes/marcass#maitrise-arme:1', 1, NULL, 'classes/marcass', 1, 'imposee', 1, 'hache', NULL),
  ('classes/marcass#maitrise-arme:2', 1, NULL, 'classes/marcass', 2, 'choix', 1, NULL, NULL),
  ('classes/martiale#maitrise-arme:1', 1, NULL, 'classes/martiale', 1, 'choix', 1, NULL, NULL),
  ('classes/medusain#maitrise-arme:1', 1, NULL, 'classes/medusain', 1, 'imposee', 1, 'arme-de-jet', NULL),
  ('classes/medusain#maitrise-arme:2', 1, NULL, 'classes/medusain', 2, 'choix', 1, NULL, NULL),
  ('classes/mercenaire#maitrise-arme:1', 1, NULL, 'classes/mercenaire', 1, 'choix', 3, NULL, 1),
  ('classes/minotaure#maitrise-arme:1', 1, NULL, 'classes/minotaure', 1, 'imposee', 1, 'masse-marteau', NULL),
  ('classes/minotaure#maitrise-arme:2', 1, NULL, 'classes/minotaure', 2, 'choix', 1, NULL, NULL),
  ('classes/moine#maitrise-arme:1', 1, NULL, 'classes/moine', 1, 'imposee', 1, 'baton-de-combat', NULL),
  ('classes/moine#maitrise-arme:2', 1, NULL, 'classes/moine', 2, 'choix', 1, NULL, NULL),
  ('classes/namazu#maitrise-arme:1', 1, NULL, 'classes/namazu', 1, 'imposee', 1, 'lance-arme-dhast', NULL),
  ('classes/namazu#maitrise-arme:2', 1, NULL, 'classes/namazu', 2, 'choix', 1, NULL, NULL),
  ('classes/ocultomancien#maitrise-arme:1', 1, NULL, 'classes/ocultomancien', 1, 'choix', 1, NULL, NULL),
  ('classes/olwman#maitrise-arme:1', 1, NULL, 'classes/olwman', 1, 'imposee', 1, 'arbalete', NULL),
  ('classes/olwman#maitrise-arme:2', 1, NULL, 'classes/olwman', 2, 'choix', 1, NULL, NULL),
  ('classes/orios#maitrise-arme:1', 1, NULL, 'classes/orios', 1, 'imposee', 1, 'pugilat', NULL),
  ('classes/orios#maitrise-arme:2', 1, NULL, 'classes/orios', 2, 'choix', 1, NULL, NULL),
  ('classes/parleur#maitrise-arme:1', 1, NULL, 'classes/parleur', 1, 'choix', 1, NULL, NULL),
  ('classes/pugiliste#maitrise-arme:1', 1, NULL, 'classes/pugiliste', 1, 'imposee', 1, 'pugilat', NULL),
  ('classes/rokh#maitrise-arme:1', 1, NULL, 'classes/rokh', 1, 'imposee', 1, 'arc', NULL),
  ('classes/rokh#maitrise-arme:2', 1, NULL, 'classes/rokh', 2, 'choix', 1, NULL, NULL),
  ('classes/satyre#maitrise-arme:1', 1, NULL, 'classes/satyre', 1, 'imposee', 1, 'baton-de-combat', NULL),
  ('classes/satyre#maitrise-arme:2', 1, NULL, 'classes/satyre', 2, 'choix', 1, NULL, NULL),
  ('classes/tueur#maitrise-arme:1', 1, NULL, 'classes/tueur', 1, 'choix', 1, NULL, NULL),
  ('classes/voleur#maitrise-arme:1', 1, NULL, 'classes/voleur', 1, 'imposee', 1, 'dagues', NULL),
  ('classes/voleur#maitrise-arme:2', 1, NULL, 'classes/voleur', 2, 'choix', 1, NULL, NULL);

INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES
  ('capacites/anansi-cemies', 1, 'arbalete'),
  ('capacites/anansi-cemies', 1, 'arc'),
  ('capacites/anansi-cemies', 1, 'arme-de-jet'),
  ('capacites/anansi-cemies', 1, 'baton-de-combat'),
  ('capacites/anansi-cemies', 1, 'bombes'),
  ('capacites/anansi-cemies', 1, 'dagues'),
  ('capacites/anansi-cemies', 1, 'epees'),
  ('capacites/anansi-cemies', 1, 'hache'),
  ('capacites/anansi-cemies', 1, 'lance-arme-dhast'),
  ('capacites/anansi-cemies', 1, 'masse-marteau'),
  ('capacites/anansi-cemies', 1, 'pugilat'),
  ('capacites/anansi-marionnettiste', 1, 'arbalete'),
  ('capacites/anansi-marionnettiste', 1, 'arc'),
  ('capacites/anansi-marionnettiste', 1, 'arme-de-jet'),
  ('capacites/anansi-marionnettiste', 1, 'baton-de-combat'),
  ('capacites/anansi-marionnettiste', 1, 'bombes'),
  ('capacites/anansi-marionnettiste', 1, 'dagues'),
  ('capacites/anansi-marionnettiste', 1, 'epees'),
  ('capacites/anansi-marionnettiste', 1, 'hache'),
  ('capacites/anansi-marionnettiste', 1, 'lance-arme-dhast'),
  ('capacites/anansi-marionnettiste', 1, 'masse-marteau'),
  ('capacites/anansi-marionnettiste', 1, 'pugilat'),
  ('capacites/archimage-elementaliste', 1, 'baton-de-combat'),
  ('capacites/archimage-elementaliste', 1, 'dagues'),
  ('capacites/archimage-elementaliste', 1, 'epees'),
  ('capacites/archimage-elementaliste', 1, 'hache'),
  ('capacites/archimage-elementaliste', 1, 'lance-arme-dhast'),
  ('capacites/archimage-elementaliste', 1, 'masse-marteau'),
  ('capacites/archimage-elementaliste', 1, 'pugilat'),
  ('capacites/archimage-occultiste', 1, 'arbalete'),
  ('capacites/archimage-occultiste', 1, 'arc'),
  ('capacites/archimage-occultiste', 1, 'arme-de-jet'),
  ('capacites/archimage-occultiste', 1, 'bombes'),
  ('capacites/barde-menestrel', 1, 'arbalete'),
  ('capacites/barde-menestrel', 1, 'arc'),
  ('capacites/barde-menestrel', 1, 'arme-de-jet'),
  ('capacites/barde-menestrel', 1, 'bombes'),
  ('capacites/bimane-fausse-patte', 1, 'arbalete'),
  ('capacites/bimane-fausse-patte', 1, 'arc'),
  ('capacites/bimane-fausse-patte', 1, 'arme-de-jet'),
  ('capacites/bimane-fausse-patte', 1, 'baton-de-combat'),
  ('capacites/bimane-fausse-patte', 1, 'bombes'),
  ('capacites/bimane-fausse-patte', 1, 'dagues'),
  ('capacites/bimane-fausse-patte', 1, 'epees'),
  ('capacites/bimane-fausse-patte', 1, 'hache'),
  ('capacites/bimane-fausse-patte', 1, 'lance-arme-dhast'),
  ('capacites/bimane-fausse-patte', 1, 'masse-marteau'),
  ('capacites/bimane-fausse-patte', 1, 'pugilat'),
  ('capacites/bimane-ravageur', 1, 'arbalete'),
  ('capacites/bimane-ravageur', 1, 'arc'),
  ('capacites/bimane-ravageur', 1, 'arme-de-jet'),
  ('capacites/bimane-ravageur', 1, 'baton-de-combat'),
  ('capacites/bimane-ravageur', 1, 'bombes'),
  ('capacites/bimane-ravageur', 1, 'dagues'),
  ('capacites/bimane-ravageur', 1, 'epees'),
  ('capacites/bimane-ravageur', 1, 'hache'),
  ('capacites/bimane-ravageur', 1, 'lance-arme-dhast'),
  ('capacites/bimane-ravageur', 1, 'masse-marteau'),
  ('capacites/bimane-ravageur', 1, 'pugilat'),
  ('capacites/clerc-saint-combattant', 1, 'arbalete'),
  ('capacites/clerc-saint-combattant', 1, 'arc'),
  ('capacites/clerc-saint-combattant', 1, 'arme-de-jet'),
  ('capacites/clerc-saint-combattant', 1, 'baton-de-combat'),
  ('capacites/clerc-saint-combattant', 1, 'bombes'),
  ('capacites/clerc-saint-combattant', 1, 'dagues'),
  ('capacites/clerc-saint-combattant', 1, 'epees'),
  ('capacites/clerc-saint-combattant', 1, 'hache'),
  ('capacites/clerc-saint-combattant', 1, 'lance-arme-dhast'),
  ('capacites/clerc-saint-combattant', 1, 'masse-marteau'),
  ('capacites/clerc-saint-combattant', 1, 'pugilat'),
  ('capacites/clerc-zelote', 1, 'arbalete'),
  ('capacites/clerc-zelote', 1, 'arc'),
  ('capacites/clerc-zelote', 1, 'arme-de-jet'),
  ('capacites/clerc-zelote', 1, 'baton-de-combat'),
  ('capacites/clerc-zelote', 1, 'bombes'),
  ('capacites/clerc-zelote', 1, 'dagues'),
  ('capacites/clerc-zelote', 1, 'epees'),
  ('capacites/clerc-zelote', 1, 'hache'),
  ('capacites/clerc-zelote', 1, 'lance-arme-dhast'),
  ('capacites/clerc-zelote', 1, 'masse-marteau'),
  ('capacites/clerc-zelote', 1, 'pugilat'),
  ('capacites/cuirasse-protecteur', 1, 'arbalete'),
  ('capacites/cuirasse-protecteur', 1, 'arc'),
  ('capacites/cuirasse-protecteur', 1, 'arme-de-jet'),
  ('capacites/cuirasse-protecteur', 1, 'baton-de-combat'),
  ('capacites/cuirasse-protecteur', 1, 'bombes'),
  ('capacites/cuirasse-protecteur', 1, 'dagues'),
  ('capacites/cuirasse-protecteur', 1, 'epees'),
  ('capacites/cuirasse-protecteur', 1, 'hache'),
  ('capacites/cuirasse-protecteur', 1, 'lance-arme-dhast'),
  ('capacites/cuirasse-protecteur', 1, 'masse-marteau'),
  ('capacites/cuirasse-protecteur', 1, 'pugilat'),
  ('capacites/cuirasse-vindicatif', 1, 'arbalete'),
  ('capacites/cuirasse-vindicatif', 1, 'arc'),
  ('capacites/cuirasse-vindicatif', 1, 'arme-de-jet'),
  ('capacites/cuirasse-vindicatif', 1, 'baton-de-combat'),
  ('capacites/cuirasse-vindicatif', 1, 'bombes'),
  ('capacites/cuirasse-vindicatif', 1, 'dagues'),
  ('capacites/cuirasse-vindicatif', 1, 'epees'),
  ('capacites/cuirasse-vindicatif', 1, 'hache'),
  ('capacites/cuirasse-vindicatif', 1, 'lance-arme-dhast'),
  ('capacites/cuirasse-vindicatif', 1, 'masse-marteau'),
  ('capacites/cuirasse-vindicatif', 1, 'pugilat'),
  ('capacites/fenrir-belliciste', 1, 'arbalete'),
  ('capacites/fenrir-belliciste', 1, 'arc'),
  ('capacites/fenrir-belliciste', 1, 'arme-de-jet'),
  ('capacites/fenrir-belliciste', 1, 'baton-de-combat'),
  ('capacites/fenrir-belliciste', 1, 'bombes'),
  ('capacites/fenrir-belliciste', 1, 'dagues'),
  ('capacites/fenrir-belliciste', 1, 'epees'),
  ('capacites/fenrir-belliciste', 1, 'hache'),
  ('capacites/fenrir-belliciste', 1, 'lance-arme-dhast'),
  ('capacites/fenrir-belliciste', 1, 'masse-marteau'),
  ('capacites/fenrir-belliciste', 1, 'pugilat'),
  ('capacites/fenrir-gourou', 1, 'arbalete'),
  ('capacites/fenrir-gourou', 1, 'arc'),
  ('capacites/fenrir-gourou', 1, 'arme-de-jet'),
  ('capacites/fenrir-gourou', 1, 'baton-de-combat'),
  ('capacites/fenrir-gourou', 1, 'bombes'),
  ('capacites/fenrir-gourou', 1, 'dagues'),
  ('capacites/fenrir-gourou', 1, 'epees'),
  ('capacites/fenrir-gourou', 1, 'hache'),
  ('capacites/fenrir-gourou', 1, 'lance-arme-dhast'),
  ('capacites/fenrir-gourou', 1, 'masse-marteau'),
  ('capacites/fenrir-gourou', 1, 'pugilat'),
  ('capacites/flagelleur-masochiste', 1, 'arbalete'),
  ('capacites/flagelleur-masochiste', 1, 'arc'),
  ('capacites/flagelleur-masochiste', 1, 'arme-de-jet'),
  ('capacites/flagelleur-masochiste', 1, 'baton-de-combat'),
  ('capacites/flagelleur-masochiste', 1, 'bombes'),
  ('capacites/flagelleur-masochiste', 1, 'dagues'),
  ('capacites/flagelleur-masochiste', 1, 'epees'),
  ('capacites/flagelleur-masochiste', 1, 'hache'),
  ('capacites/flagelleur-masochiste', 1, 'lance-arme-dhast'),
  ('capacites/flagelleur-masochiste', 1, 'masse-marteau'),
  ('capacites/flagelleur-masochiste', 1, 'pugilat'),
  ('capacites/flagelleur-sadique', 1, 'arbalete'),
  ('capacites/flagelleur-sadique', 1, 'arc'),
  ('capacites/flagelleur-sadique', 1, 'arme-de-jet'),
  ('capacites/flagelleur-sadique', 1, 'baton-de-combat'),
  ('capacites/flagelleur-sadique', 1, 'bombes'),
  ('capacites/flagelleur-sadique', 1, 'dagues'),
  ('capacites/flagelleur-sadique', 1, 'epees'),
  ('capacites/flagelleur-sadique', 1, 'hache'),
  ('capacites/flagelleur-sadique', 1, 'lance-arme-dhast'),
  ('capacites/flagelleur-sadique', 1, 'masse-marteau'),
  ('capacites/flagelleur-sadique', 1, 'pugilat'),
  ('capacites/frappeur-briseur', 1, 'arbalete'),
  ('capacites/frappeur-briseur', 1, 'arc'),
  ('capacites/frappeur-briseur', 1, 'arme-de-jet'),
  ('capacites/frappeur-briseur', 1, 'baton-de-combat'),
  ('capacites/frappeur-briseur', 1, 'bombes'),
  ('capacites/frappeur-briseur', 1, 'dagues'),
  ('capacites/frappeur-briseur', 1, 'epees'),
  ('capacites/frappeur-briseur', 1, 'hache'),
  ('capacites/frappeur-briseur', 1, 'lance-arme-dhast'),
  ('capacites/frappeur-briseur', 1, 'masse-marteau'),
  ('capacites/frappeur-briseur', 1, 'pugilat'),
  ('capacites/frappeur-casseur', 1, 'arbalete'),
  ('capacites/frappeur-casseur', 1, 'arc'),
  ('capacites/frappeur-casseur', 1, 'arme-de-jet'),
  ('capacites/frappeur-casseur', 1, 'baton-de-combat'),
  ('capacites/frappeur-casseur', 1, 'bombes'),
  ('capacites/frappeur-casseur', 1, 'dagues'),
  ('capacites/frappeur-casseur', 1, 'epees'),
  ('capacites/frappeur-casseur', 1, 'hache'),
  ('capacites/frappeur-casseur', 1, 'lance-arme-dhast'),
  ('capacites/frappeur-casseur', 1, 'masse-marteau'),
  ('capacites/frappeur-casseur', 1, 'pugilat'),
  ('capacites/goleois-irreductible', 1, 'arbalete'),
  ('capacites/goleois-irreductible', 1, 'arc'),
  ('capacites/goleois-irreductible', 1, 'arme-de-jet'),
  ('capacites/goleois-irreductible', 1, 'baton-de-combat'),
  ('capacites/goleois-irreductible', 1, 'bombes'),
  ('capacites/goleois-irreductible', 1, 'dagues'),
  ('capacites/goleois-irreductible', 1, 'epees'),
  ('capacites/goleois-irreductible', 1, 'hache'),
  ('capacites/goleois-irreductible', 1, 'lance-arme-dhast'),
  ('capacites/goleois-irreductible', 1, 'masse-marteau'),
  ('capacites/goleois-irreductible', 1, 'pugilat'),
  ('capacites/goleois-saronide', 1, 'arbalete'),
  ('capacites/goleois-saronide', 1, 'arc'),
  ('capacites/goleois-saronide', 1, 'arme-de-jet'),
  ('capacites/goleois-saronide', 1, 'baton-de-combat'),
  ('capacites/goleois-saronide', 1, 'bombes'),
  ('capacites/goleois-saronide', 1, 'dagues'),
  ('capacites/goleois-saronide', 1, 'epees'),
  ('capacites/goleois-saronide', 1, 'hache'),
  ('capacites/goleois-saronide', 1, 'lance-arme-dhast'),
  ('capacites/goleois-saronide', 1, 'masse-marteau'),
  ('capacites/goleois-saronide', 1, 'pugilat'),
  ('capacites/guerrier-maitre-darme', 1, 'arbalete'),
  ('capacites/guerrier-maitre-darme', 1, 'arc'),
  ('capacites/guerrier-maitre-darme', 1, 'arme-de-jet'),
  ('capacites/guerrier-maitre-darme', 1, 'baton-de-combat'),
  ('capacites/guerrier-maitre-darme', 1, 'bombes'),
  ('capacites/guerrier-maitre-darme', 1, 'dagues'),
  ('capacites/guerrier-maitre-darme', 1, 'epees'),
  ('capacites/guerrier-maitre-darme', 1, 'hache'),
  ('capacites/guerrier-maitre-darme', 1, 'lance-arme-dhast'),
  ('capacites/guerrier-maitre-darme', 1, 'masse-marteau'),
  ('capacites/guerrier-maitre-darme', 1, 'pugilat'),
  ('capacites/jackalope-adepte', 1, 'arbalete'),
  ('capacites/jackalope-adepte', 1, 'arc'),
  ('capacites/jackalope-adepte', 1, 'arme-de-jet'),
  ('capacites/jackalope-adepte', 1, 'baton-de-combat'),
  ('capacites/jackalope-adepte', 1, 'bombes'),
  ('capacites/jackalope-adepte', 1, 'dagues'),
  ('capacites/jackalope-adepte', 1, 'epees'),
  ('capacites/jackalope-adepte', 1, 'hache'),
  ('capacites/jackalope-adepte', 1, 'lance-arme-dhast'),
  ('capacites/jackalope-adepte', 1, 'masse-marteau'),
  ('capacites/jackalope-adepte', 1, 'pugilat'),
  ('capacites/jackalope-ninja', 1, 'arbalete'),
  ('capacites/jackalope-ninja', 1, 'arc'),
  ('capacites/jackalope-ninja', 1, 'arme-de-jet'),
  ('capacites/jackalope-ninja', 1, 'baton-de-combat'),
  ('capacites/jackalope-ninja', 1, 'bombes'),
  ('capacites/jackalope-ninja', 1, 'dagues'),
  ('capacites/jackalope-ninja', 1, 'epees'),
  ('capacites/jackalope-ninja', 1, 'hache'),
  ('capacites/jackalope-ninja', 1, 'lance-arme-dhast'),
  ('capacites/jackalope-ninja', 1, 'masse-marteau'),
  ('capacites/jackalope-ninja', 1, 'pugilat'),
  ('capacites/kitsune-druide', 1, 'arbalete'),
  ('capacites/kitsune-druide', 1, 'arc'),
  ('capacites/kitsune-druide', 1, 'arme-de-jet'),
  ('capacites/kitsune-druide', 1, 'baton-de-combat'),
  ('capacites/kitsune-druide', 1, 'bombes'),
  ('capacites/kitsune-druide', 1, 'dagues'),
  ('capacites/kitsune-druide', 1, 'epees'),
  ('capacites/kitsune-druide', 1, 'hache'),
  ('capacites/kitsune-druide', 1, 'lance-arme-dhast'),
  ('capacites/kitsune-druide', 1, 'masse-marteau'),
  ('capacites/kitsune-druide', 1, 'pugilat'),
  ('capacites/kitsune-fripon', 1, 'arbalete'),
  ('capacites/kitsune-fripon', 1, 'arc'),
  ('capacites/kitsune-fripon', 1, 'arme-de-jet'),
  ('capacites/kitsune-fripon', 1, 'baton-de-combat'),
  ('capacites/kitsune-fripon', 1, 'bombes'),
  ('capacites/kitsune-fripon', 1, 'dagues'),
  ('capacites/kitsune-fripon', 1, 'epees'),
  ('capacites/kitsune-fripon', 1, 'hache'),
  ('capacites/kitsune-fripon', 1, 'lance-arme-dhast'),
  ('capacites/kitsune-fripon', 1, 'masse-marteau'),
  ('capacites/kitsune-fripon', 1, 'pugilat'),
  ('capacites/lanceur-fantassin', 2, 'baton-de-combat'),
  ('capacites/lanceur-fantassin', 2, 'dagues'),
  ('capacites/lanceur-fantassin', 2, 'epees'),
  ('capacites/lanceur-fantassin', 2, 'hache'),
  ('capacites/lanceur-fantassin', 2, 'lance-arme-dhast'),
  ('capacites/lanceur-fantassin', 2, 'masse-marteau'),
  ('capacites/lanceur-fantassin', 2, 'pugilat'),
  ('capacites/lanceur-jongleur', 2, 'baton-de-combat'),
  ('capacites/lanceur-jongleur', 2, 'dagues'),
  ('capacites/lanceur-jongleur', 2, 'epees'),
  ('capacites/lanceur-jongleur', 2, 'hache'),
  ('capacites/lanceur-jongleur', 2, 'lance-arme-dhast'),
  ('capacites/lanceur-jongleur', 2, 'masse-marteau'),
  ('capacites/lanceur-jongleur', 2, 'pugilat'),
  ('capacites/lancier-maitre-dhast', 1, 'arbalete'),
  ('capacites/lancier-maitre-dhast', 1, 'arc'),
  ('capacites/lancier-maitre-dhast', 1, 'arme-de-jet'),
  ('capacites/lancier-maitre-dhast', 1, 'baton-de-combat'),
  ('capacites/lancier-maitre-dhast', 1, 'bombes'),
  ('capacites/lancier-maitre-dhast', 1, 'dagues'),
  ('capacites/lancier-maitre-dhast', 1, 'epees'),
  ('capacites/lancier-maitre-dhast', 1, 'hache'),
  ('capacites/lancier-maitre-dhast', 1, 'lance-arme-dhast'),
  ('capacites/lancier-maitre-dhast', 1, 'masse-marteau'),
  ('capacites/lancier-maitre-dhast', 1, 'pugilat'),
  ('capacites/lancier-myrmidon', 1, 'arbalete'),
  ('capacites/lancier-myrmidon', 1, 'arc'),
  ('capacites/lancier-myrmidon', 1, 'arme-de-jet'),
  ('capacites/lancier-myrmidon', 1, 'baton-de-combat'),
  ('capacites/lancier-myrmidon', 1, 'bombes'),
  ('capacites/lancier-myrmidon', 1, 'dagues'),
  ('capacites/lancier-myrmidon', 1, 'epees'),
  ('capacites/lancier-myrmidon', 1, 'hache'),
  ('capacites/lancier-myrmidon', 1, 'lance-arme-dhast'),
  ('capacites/lancier-myrmidon', 1, 'masse-marteau'),
  ('capacites/lancier-myrmidon', 1, 'pugilat'),
  ('capacites/maclier-archiclier', 1, 'arbalete'),
  ('capacites/maclier-archiclier', 1, 'arc'),
  ('capacites/maclier-archiclier', 1, 'arme-de-jet'),
  ('capacites/maclier-archiclier', 1, 'baton-de-combat'),
  ('capacites/maclier-archiclier', 1, 'bombes'),
  ('capacites/maclier-archiclier', 1, 'dagues'),
  ('capacites/maclier-archiclier', 1, 'epees'),
  ('capacites/maclier-archiclier', 1, 'hache'),
  ('capacites/maclier-archiclier', 1, 'lance-arme-dhast'),
  ('capacites/maclier-archiclier', 1, 'masse-marteau'),
  ('capacites/maclier-archiclier', 1, 'pugilat'),
  ('capacites/maclier-grand-maclier', 1, 'arbalete'),
  ('capacites/maclier-grand-maclier', 1, 'arc'),
  ('capacites/maclier-grand-maclier', 1, 'arme-de-jet'),
  ('capacites/maclier-grand-maclier', 1, 'baton-de-combat'),
  ('capacites/maclier-grand-maclier', 1, 'bombes'),
  ('capacites/maclier-grand-maclier', 1, 'dagues'),
  ('capacites/maclier-grand-maclier', 1, 'epees'),
  ('capacites/maclier-grand-maclier', 1, 'hache'),
  ('capacites/maclier-grand-maclier', 1, 'lance-arme-dhast'),
  ('capacites/maclier-grand-maclier', 1, 'masse-marteau'),
  ('capacites/maclier-grand-maclier', 1, 'pugilat'),
  ('capacites/mage-mage-blanc', 1, 'arbalete'),
  ('capacites/mage-mage-blanc', 1, 'arc'),
  ('capacites/mage-mage-blanc', 1, 'arme-de-jet'),
  ('capacites/mage-mage-blanc', 1, 'baton-de-combat'),
  ('capacites/mage-mage-blanc', 1, 'bombes'),
  ('capacites/mage-mage-blanc', 1, 'dagues'),
  ('capacites/mage-mage-blanc', 1, 'epees'),
  ('capacites/mage-mage-blanc', 1, 'hache'),
  ('capacites/mage-mage-blanc', 1, 'lance-arme-dhast'),
  ('capacites/mage-mage-blanc', 1, 'masse-marteau'),
  ('capacites/mage-mage-blanc', 1, 'pugilat'),
  ('capacites/mage-mage-noir', 1, 'arbalete'),
  ('capacites/mage-mage-noir', 1, 'arc'),
  ('capacites/mage-mage-noir', 1, 'arme-de-jet'),
  ('capacites/mage-mage-noir', 1, 'baton-de-combat'),
  ('capacites/mage-mage-noir', 1, 'bombes'),
  ('capacites/mage-mage-noir', 1, 'dagues'),
  ('capacites/mage-mage-noir', 1, 'epees'),
  ('capacites/mage-mage-noir', 1, 'hache'),
  ('capacites/mage-mage-noir', 1, 'lance-arme-dhast'),
  ('capacites/mage-mage-noir', 1, 'masse-marteau'),
  ('capacites/mage-mage-noir', 1, 'pugilat'),
  ('capacites/marcass-canaille', 1, 'arbalete'),
  ('capacites/marcass-canaille', 1, 'arc'),
  ('capacites/marcass-canaille', 1, 'arme-de-jet'),
  ('capacites/marcass-canaille', 1, 'baton-de-combat'),
  ('capacites/marcass-canaille', 1, 'bombes'),
  ('capacites/marcass-canaille', 1, 'dagues'),
  ('capacites/marcass-canaille', 1, 'epees'),
  ('capacites/marcass-canaille', 1, 'hache'),
  ('capacites/marcass-canaille', 1, 'lance-arme-dhast'),
  ('capacites/marcass-canaille', 1, 'masse-marteau'),
  ('capacites/marcass-canaille', 1, 'pugilat'),
  ('capacites/marcass-devot', 1, 'arbalete'),
  ('capacites/marcass-devot', 1, 'arc'),
  ('capacites/marcass-devot', 1, 'arme-de-jet'),
  ('capacites/marcass-devot', 1, 'baton-de-combat'),
  ('capacites/marcass-devot', 1, 'bombes'),
  ('capacites/marcass-devot', 1, 'dagues'),
  ('capacites/marcass-devot', 1, 'epees'),
  ('capacites/marcass-devot', 1, 'hache'),
  ('capacites/marcass-devot', 1, 'lance-arme-dhast'),
  ('capacites/marcass-devot', 1, 'masse-marteau'),
  ('capacites/marcass-devot', 1, 'pugilat'),
  ('capacites/martiale-berserker', 1, 'arbalete'),
  ('capacites/martiale-berserker', 1, 'arc'),
  ('capacites/martiale-berserker', 1, 'arme-de-jet'),
  ('capacites/martiale-berserker', 1, 'baton-de-combat'),
  ('capacites/martiale-berserker', 1, 'bombes'),
  ('capacites/martiale-berserker', 1, 'dagues'),
  ('capacites/martiale-berserker', 1, 'epees'),
  ('capacites/martiale-berserker', 1, 'hache'),
  ('capacites/martiale-berserker', 1, 'lance-arme-dhast'),
  ('capacites/martiale-berserker', 1, 'masse-marteau'),
  ('capacites/martiale-berserker', 1, 'pugilat'),
  ('capacites/martiale-heros', 1, 'arbalete'),
  ('capacites/martiale-heros', 1, 'arc'),
  ('capacites/martiale-heros', 1, 'arme-de-jet'),
  ('capacites/martiale-heros', 1, 'baton-de-combat'),
  ('capacites/martiale-heros', 1, 'bombes'),
  ('capacites/martiale-heros', 1, 'dagues'),
  ('capacites/martiale-heros', 1, 'epees'),
  ('capacites/martiale-heros', 1, 'hache'),
  ('capacites/martiale-heros', 1, 'lance-arme-dhast'),
  ('capacites/martiale-heros', 1, 'masse-marteau'),
  ('capacites/martiale-heros', 1, 'pugilat'),
  ('capacites/medusain-augure', 1, 'arbalete'),
  ('capacites/medusain-augure', 1, 'arc'),
  ('capacites/medusain-augure', 1, 'arme-de-jet'),
  ('capacites/medusain-augure', 1, 'baton-de-combat'),
  ('capacites/medusain-augure', 1, 'bombes'),
  ('capacites/medusain-augure', 1, 'dagues'),
  ('capacites/medusain-augure', 1, 'epees'),
  ('capacites/medusain-augure', 1, 'hache'),
  ('capacites/medusain-augure', 1, 'lance-arme-dhast'),
  ('capacites/medusain-augure', 1, 'masse-marteau'),
  ('capacites/medusain-augure', 1, 'pugilat'),
  ('capacites/medusain-hoplite', 1, 'arbalete'),
  ('capacites/medusain-hoplite', 1, 'arc'),
  ('capacites/medusain-hoplite', 1, 'arme-de-jet'),
  ('capacites/medusain-hoplite', 1, 'baton-de-combat'),
  ('capacites/medusain-hoplite', 1, 'bombes'),
  ('capacites/medusain-hoplite', 1, 'dagues'),
  ('capacites/medusain-hoplite', 1, 'epees'),
  ('capacites/medusain-hoplite', 1, 'hache'),
  ('capacites/medusain-hoplite', 1, 'lance-arme-dhast'),
  ('capacites/medusain-hoplite', 1, 'masse-marteau'),
  ('capacites/medusain-hoplite', 1, 'pugilat'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'arbalete'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'arc'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'arme-de-jet'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'baton-de-combat'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'bombes'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'dagues'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'epees'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'hache'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'lance-arme-dhast'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'masse-marteau'),
  ('capacites/mercenaire-chasseur-de-primes', 1, 'pugilat'),
  ('capacites/mercenaire-combattant-libre', 1, 'arbalete'),
  ('capacites/mercenaire-combattant-libre', 1, 'arc'),
  ('capacites/mercenaire-combattant-libre', 1, 'arme-de-jet'),
  ('capacites/mercenaire-combattant-libre', 1, 'baton-de-combat'),
  ('capacites/mercenaire-combattant-libre', 1, 'bombes'),
  ('capacites/mercenaire-combattant-libre', 1, 'dagues'),
  ('capacites/mercenaire-combattant-libre', 1, 'epees'),
  ('capacites/mercenaire-combattant-libre', 1, 'hache'),
  ('capacites/mercenaire-combattant-libre', 1, 'lance-arme-dhast'),
  ('capacites/mercenaire-combattant-libre', 1, 'masse-marteau'),
  ('capacites/mercenaire-combattant-libre', 1, 'pugilat'),
  ('capacites/minotaure-gladiateur', 1, 'arbalete'),
  ('capacites/minotaure-gladiateur', 1, 'arc'),
  ('capacites/minotaure-gladiateur', 1, 'arme-de-jet'),
  ('capacites/minotaure-gladiateur', 1, 'baton-de-combat'),
  ('capacites/minotaure-gladiateur', 1, 'bombes'),
  ('capacites/minotaure-gladiateur', 1, 'dagues'),
  ('capacites/minotaure-gladiateur', 1, 'epees'),
  ('capacites/minotaure-gladiateur', 1, 'hache'),
  ('capacites/minotaure-gladiateur', 1, 'lance-arme-dhast'),
  ('capacites/minotaure-gladiateur', 1, 'masse-marteau'),
  ('capacites/minotaure-gladiateur', 1, 'pugilat'),
  ('capacites/minotaure-medium', 1, 'arbalete'),
  ('capacites/minotaure-medium', 1, 'arc'),
  ('capacites/minotaure-medium', 1, 'arme-de-jet'),
  ('capacites/minotaure-medium', 1, 'baton-de-combat'),
  ('capacites/minotaure-medium', 1, 'bombes'),
  ('capacites/minotaure-medium', 1, 'dagues'),
  ('capacites/minotaure-medium', 1, 'epees'),
  ('capacites/minotaure-medium', 1, 'hache'),
  ('capacites/minotaure-medium', 1, 'lance-arme-dhast'),
  ('capacites/minotaure-medium', 1, 'masse-marteau'),
  ('capacites/minotaure-medium', 1, 'pugilat'),
  ('capacites/moine-moine-guerrier', 1, 'arbalete'),
  ('capacites/moine-moine-guerrier', 1, 'arc'),
  ('capacites/moine-moine-guerrier', 1, 'arme-de-jet'),
  ('capacites/moine-moine-guerrier', 1, 'baton-de-combat'),
  ('capacites/moine-moine-guerrier', 1, 'bombes'),
  ('capacites/moine-moine-guerrier', 1, 'dagues'),
  ('capacites/moine-moine-guerrier', 1, 'epees'),
  ('capacites/moine-moine-guerrier', 1, 'hache'),
  ('capacites/moine-moine-guerrier', 1, 'lance-arme-dhast'),
  ('capacites/moine-moine-guerrier', 1, 'masse-marteau'),
  ('capacites/moine-moine-guerrier', 1, 'pugilat'),
  ('capacites/moine-templier', 1, 'arbalete'),
  ('capacites/moine-templier', 1, 'arc'),
  ('capacites/moine-templier', 1, 'arme-de-jet'),
  ('capacites/moine-templier', 1, 'baton-de-combat'),
  ('capacites/moine-templier', 1, 'bombes'),
  ('capacites/moine-templier', 1, 'dagues'),
  ('capacites/moine-templier', 1, 'epees'),
  ('capacites/moine-templier', 1, 'hache'),
  ('capacites/moine-templier', 1, 'lance-arme-dhast'),
  ('capacites/moine-templier', 1, 'masse-marteau'),
  ('capacites/moine-templier', 1, 'pugilat'),
  ('capacites/namazu-batailleur', 1, 'arbalete'),
  ('capacites/namazu-batailleur', 1, 'arc'),
  ('capacites/namazu-batailleur', 1, 'arme-de-jet'),
  ('capacites/namazu-batailleur', 1, 'baton-de-combat'),
  ('capacites/namazu-batailleur', 1, 'bombes'),
  ('capacites/namazu-batailleur', 1, 'dagues'),
  ('capacites/namazu-batailleur', 1, 'epees'),
  ('capacites/namazu-batailleur', 1, 'hache'),
  ('capacites/namazu-batailleur', 1, 'lance-arme-dhast'),
  ('capacites/namazu-batailleur', 1, 'masse-marteau'),
  ('capacites/namazu-batailleur', 1, 'pugilat'),
  ('capacites/namazu-devin', 1, 'arbalete'),
  ('capacites/namazu-devin', 1, 'arc'),
  ('capacites/namazu-devin', 1, 'arme-de-jet'),
  ('capacites/namazu-devin', 1, 'baton-de-combat'),
  ('capacites/namazu-devin', 1, 'bombes'),
  ('capacites/namazu-devin', 1, 'dagues'),
  ('capacites/namazu-devin', 1, 'epees'),
  ('capacites/namazu-devin', 1, 'hache'),
  ('capacites/namazu-devin', 1, 'lance-arme-dhast'),
  ('capacites/namazu-devin', 1, 'masse-marteau'),
  ('capacites/namazu-devin', 1, 'pugilat'),
  ('capacites/ocultomancien-meteorologue', 1, 'arbalete'),
  ('capacites/ocultomancien-meteorologue', 1, 'arc'),
  ('capacites/ocultomancien-meteorologue', 1, 'arme-de-jet'),
  ('capacites/ocultomancien-meteorologue', 1, 'baton-de-combat'),
  ('capacites/ocultomancien-meteorologue', 1, 'bombes'),
  ('capacites/ocultomancien-meteorologue', 1, 'dagues'),
  ('capacites/ocultomancien-meteorologue', 1, 'epees'),
  ('capacites/ocultomancien-meteorologue', 1, 'hache'),
  ('capacites/ocultomancien-meteorologue', 1, 'lance-arme-dhast'),
  ('capacites/ocultomancien-meteorologue', 1, 'masse-marteau'),
  ('capacites/ocultomancien-meteorologue', 1, 'pugilat'),
  ('capacites/ocultomancien-specialiste', 1, 'arbalete'),
  ('capacites/ocultomancien-specialiste', 1, 'arc'),
  ('capacites/ocultomancien-specialiste', 1, 'arme-de-jet'),
  ('capacites/ocultomancien-specialiste', 1, 'baton-de-combat'),
  ('capacites/ocultomancien-specialiste', 1, 'bombes'),
  ('capacites/ocultomancien-specialiste', 1, 'dagues'),
  ('capacites/ocultomancien-specialiste', 1, 'epees'),
  ('capacites/ocultomancien-specialiste', 1, 'hache'),
  ('capacites/ocultomancien-specialiste', 1, 'lance-arme-dhast'),
  ('capacites/ocultomancien-specialiste', 1, 'masse-marteau'),
  ('capacites/ocultomancien-specialiste', 1, 'pugilat'),
  ('capacites/olwman-chasseur', 1, 'arbalete'),
  ('capacites/olwman-chasseur', 1, 'arc'),
  ('capacites/olwman-chasseur', 1, 'arme-de-jet'),
  ('capacites/olwman-chasseur', 1, 'baton-de-combat'),
  ('capacites/olwman-chasseur', 1, 'bombes'),
  ('capacites/olwman-chasseur', 1, 'dagues'),
  ('capacites/olwman-chasseur', 1, 'epees'),
  ('capacites/olwman-chasseur', 1, 'hache'),
  ('capacites/olwman-chasseur', 1, 'lance-arme-dhast'),
  ('capacites/olwman-chasseur', 1, 'masse-marteau'),
  ('capacites/olwman-chasseur', 1, 'pugilat'),
  ('capacites/olwman-pape', 1, 'arbalete'),
  ('capacites/olwman-pape', 1, 'arc'),
  ('capacites/olwman-pape', 1, 'arme-de-jet'),
  ('capacites/olwman-pape', 1, 'baton-de-combat'),
  ('capacites/olwman-pape', 1, 'bombes'),
  ('capacites/olwman-pape', 1, 'dagues'),
  ('capacites/olwman-pape', 1, 'epees'),
  ('capacites/olwman-pape', 1, 'hache'),
  ('capacites/olwman-pape', 1, 'lance-arme-dhast'),
  ('capacites/olwman-pape', 1, 'masse-marteau'),
  ('capacites/olwman-pape', 1, 'pugilat'),
  ('capacites/orios-chaman', 1, 'arbalete'),
  ('capacites/orios-chaman', 1, 'arc'),
  ('capacites/orios-chaman', 1, 'arme-de-jet'),
  ('capacites/orios-chaman', 1, 'baton-de-combat'),
  ('capacites/orios-chaman', 1, 'bombes'),
  ('capacites/orios-chaman', 1, 'dagues'),
  ('capacites/orios-chaman', 1, 'epees'),
  ('capacites/orios-chaman', 1, 'hache'),
  ('capacites/orios-chaman', 1, 'lance-arme-dhast'),
  ('capacites/orios-chaman', 1, 'masse-marteau'),
  ('capacites/orios-chaman', 1, 'pugilat'),
  ('capacites/orios-va-t-en-guerre', 1, 'arbalete'),
  ('capacites/orios-va-t-en-guerre', 1, 'arc'),
  ('capacites/orios-va-t-en-guerre', 1, 'arme-de-jet'),
  ('capacites/orios-va-t-en-guerre', 1, 'baton-de-combat'),
  ('capacites/orios-va-t-en-guerre', 1, 'bombes'),
  ('capacites/orios-va-t-en-guerre', 1, 'dagues'),
  ('capacites/orios-va-t-en-guerre', 1, 'epees'),
  ('capacites/orios-va-t-en-guerre', 1, 'hache'),
  ('capacites/orios-va-t-en-guerre', 1, 'lance-arme-dhast'),
  ('capacites/orios-va-t-en-guerre', 1, 'masse-marteau'),
  ('capacites/orios-va-t-en-guerre', 1, 'pugilat'),
  ('capacites/parleur-bonimenteur', 1, 'arbalete'),
  ('capacites/parleur-bonimenteur', 1, 'arc'),
  ('capacites/parleur-bonimenteur', 1, 'arme-de-jet'),
  ('capacites/parleur-bonimenteur', 1, 'baton-de-combat'),
  ('capacites/parleur-bonimenteur', 1, 'bombes'),
  ('capacites/parleur-bonimenteur', 1, 'dagues'),
  ('capacites/parleur-bonimenteur', 1, 'epees'),
  ('capacites/parleur-bonimenteur', 1, 'hache'),
  ('capacites/parleur-bonimenteur', 1, 'lance-arme-dhast'),
  ('capacites/parleur-bonimenteur', 1, 'masse-marteau'),
  ('capacites/parleur-bonimenteur', 1, 'pugilat'),
  ('capacites/parleur-eloquent', 1, 'arbalete'),
  ('capacites/parleur-eloquent', 1, 'arc'),
  ('capacites/parleur-eloquent', 1, 'arme-de-jet'),
  ('capacites/parleur-eloquent', 1, 'baton-de-combat'),
  ('capacites/parleur-eloquent', 1, 'bombes'),
  ('capacites/parleur-eloquent', 1, 'dagues'),
  ('capacites/parleur-eloquent', 1, 'epees'),
  ('capacites/parleur-eloquent', 1, 'hache'),
  ('capacites/parleur-eloquent', 1, 'lance-arme-dhast'),
  ('capacites/parleur-eloquent', 1, 'masse-marteau'),
  ('capacites/parleur-eloquent', 1, 'pugilat'),
  ('capacites/rokh-colombe', 1, 'arbalete'),
  ('capacites/rokh-colombe', 1, 'arc'),
  ('capacites/rokh-colombe', 1, 'arme-de-jet'),
  ('capacites/rokh-colombe', 1, 'baton-de-combat'),
  ('capacites/rokh-colombe', 1, 'bombes'),
  ('capacites/rokh-colombe', 1, 'dagues'),
  ('capacites/rokh-colombe', 1, 'epees'),
  ('capacites/rokh-colombe', 1, 'hache'),
  ('capacites/rokh-colombe', 1, 'lance-arme-dhast'),
  ('capacites/rokh-colombe', 1, 'masse-marteau'),
  ('capacites/rokh-colombe', 1, 'pugilat'),
  ('capacites/rokh-hirondelle', 1, 'arbalete'),
  ('capacites/rokh-hirondelle', 1, 'arc'),
  ('capacites/rokh-hirondelle', 1, 'arme-de-jet'),
  ('capacites/rokh-hirondelle', 1, 'baton-de-combat'),
  ('capacites/rokh-hirondelle', 1, 'bombes'),
  ('capacites/rokh-hirondelle', 1, 'dagues'),
  ('capacites/rokh-hirondelle', 1, 'epees'),
  ('capacites/rokh-hirondelle', 1, 'hache'),
  ('capacites/rokh-hirondelle', 1, 'lance-arme-dhast'),
  ('capacites/rokh-hirondelle', 1, 'masse-marteau'),
  ('capacites/rokh-hirondelle', 1, 'pugilat'),
  ('capacites/satyre-galopin', 1, 'arbalete'),
  ('capacites/satyre-galopin', 1, 'arc'),
  ('capacites/satyre-galopin', 1, 'arme-de-jet'),
  ('capacites/satyre-galopin', 1, 'baton-de-combat'),
  ('capacites/satyre-galopin', 1, 'bombes'),
  ('capacites/satyre-galopin', 1, 'dagues'),
  ('capacites/satyre-galopin', 1, 'epees'),
  ('capacites/satyre-galopin', 1, 'hache'),
  ('capacites/satyre-galopin', 1, 'lance-arme-dhast'),
  ('capacites/satyre-galopin', 1, 'masse-marteau'),
  ('capacites/satyre-galopin', 1, 'pugilat'),
  ('capacites/satyre-oracle', 1, 'arbalete'),
  ('capacites/satyre-oracle', 1, 'arc'),
  ('capacites/satyre-oracle', 1, 'arme-de-jet'),
  ('capacites/satyre-oracle', 1, 'baton-de-combat'),
  ('capacites/satyre-oracle', 1, 'bombes'),
  ('capacites/satyre-oracle', 1, 'dagues'),
  ('capacites/satyre-oracle', 1, 'epees'),
  ('capacites/satyre-oracle', 1, 'hache'),
  ('capacites/satyre-oracle', 1, 'lance-arme-dhast'),
  ('capacites/satyre-oracle', 1, 'masse-marteau'),
  ('capacites/satyre-oracle', 1, 'pugilat'),
  ('capacites/tueur-fletrisseur', 1, 'arbalete'),
  ('capacites/tueur-fletrisseur', 1, 'arc'),
  ('capacites/tueur-fletrisseur', 1, 'arme-de-jet'),
  ('capacites/tueur-fletrisseur', 1, 'baton-de-combat'),
  ('capacites/tueur-fletrisseur', 1, 'bombes'),
  ('capacites/tueur-fletrisseur', 1, 'dagues'),
  ('capacites/tueur-fletrisseur', 1, 'epees'),
  ('capacites/tueur-fletrisseur', 1, 'hache'),
  ('capacites/tueur-fletrisseur', 1, 'lance-arme-dhast'),
  ('capacites/tueur-fletrisseur', 1, 'masse-marteau'),
  ('capacites/tueur-fletrisseur', 1, 'pugilat'),
  ('capacites/tueur-sicaire', 1, 'arbalete'),
  ('capacites/tueur-sicaire', 1, 'arc'),
  ('capacites/tueur-sicaire', 1, 'arme-de-jet'),
  ('capacites/tueur-sicaire', 1, 'baton-de-combat'),
  ('capacites/tueur-sicaire', 1, 'bombes'),
  ('capacites/tueur-sicaire', 1, 'dagues'),
  ('capacites/tueur-sicaire', 1, 'epees'),
  ('capacites/tueur-sicaire', 1, 'hache'),
  ('capacites/tueur-sicaire', 1, 'lance-arme-dhast'),
  ('capacites/tueur-sicaire', 1, 'masse-marteau'),
  ('capacites/tueur-sicaire', 1, 'pugilat'),
  ('capacites/voleur-cambrioleur', 1, 'arbalete'),
  ('capacites/voleur-cambrioleur', 1, 'arc'),
  ('capacites/voleur-cambrioleur', 1, 'arme-de-jet'),
  ('capacites/voleur-cambrioleur', 1, 'baton-de-combat'),
  ('capacites/voleur-cambrioleur', 1, 'bombes'),
  ('capacites/voleur-cambrioleur', 1, 'dagues'),
  ('capacites/voleur-cambrioleur', 1, 'epees'),
  ('capacites/voleur-cambrioleur', 1, 'hache'),
  ('capacites/voleur-cambrioleur', 1, 'lance-arme-dhast'),
  ('capacites/voleur-cambrioleur', 1, 'masse-marteau'),
  ('capacites/voleur-cambrioleur', 1, 'pugilat'),
  ('capacites/voleur-saboteur', 1, 'arbalete'),
  ('capacites/voleur-saboteur', 1, 'arc'),
  ('capacites/voleur-saboteur', 1, 'arme-de-jet'),
  ('capacites/voleur-saboteur', 1, 'baton-de-combat'),
  ('capacites/voleur-saboteur', 1, 'bombes'),
  ('capacites/voleur-saboteur', 1, 'dagues'),
  ('capacites/voleur-saboteur', 1, 'epees'),
  ('capacites/voleur-saboteur', 1, 'hache'),
  ('capacites/voleur-saboteur', 1, 'lance-arme-dhast'),
  ('capacites/voleur-saboteur', 1, 'masse-marteau'),
  ('capacites/voleur-saboteur', 1, 'pugilat'),
  ('classes/anansi#maitrise-arme:2', 1, 'arbalete'),
  ('classes/anansi#maitrise-arme:2', 1, 'arc'),
  ('classes/anansi#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/anansi#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/anansi#maitrise-arme:2', 1, 'bombes'),
  ('classes/anansi#maitrise-arme:2', 1, 'epees'),
  ('classes/anansi#maitrise-arme:2', 1, 'hache'),
  ('classes/anansi#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/anansi#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/anansi#maitrise-arme:2', 1, 'pugilat'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'dagues'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'epees'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'hache'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/arbaletrier#maitrise-arme:2', 1, 'pugilat'),
  ('classes/archer#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/archer#maitrise-arme:2', 1, 'dagues'),
  ('classes/archer#maitrise-arme:2', 1, 'epees'),
  ('classes/archer#maitrise-arme:2', 1, 'hache'),
  ('classes/archer#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/archer#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/archer#maitrise-arme:2', 1, 'pugilat'),
  ('classes/archimage#maitrise-arme:1', 1, 'arbalete'),
  ('classes/archimage#maitrise-arme:1', 1, 'arc'),
  ('classes/archimage#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/archimage#maitrise-arme:1', 1, 'bombes'),
  ('classes/barde#maitrise-arme:1', 1, 'arbalete'),
  ('classes/barde#maitrise-arme:1', 1, 'arc'),
  ('classes/barde#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/barde#maitrise-arme:1', 1, 'bombes'),
  ('classes/bimane#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/bimane#maitrise-arme:1', 1, 'dagues'),
  ('classes/bimane#maitrise-arme:1', 1, 'epees'),
  ('classes/bimane#maitrise-arme:1', 1, 'hache'),
  ('classes/bimane#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/bimane#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/bimane#maitrise-arme:1', 1, 'pugilat'),
  ('classes/clerc#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/clerc#maitrise-arme:2', 1, 'dagues'),
  ('classes/clerc#maitrise-arme:2', 1, 'epees'),
  ('classes/clerc#maitrise-arme:2', 1, 'hache'),
  ('classes/clerc#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/clerc#maitrise-arme:2', 1, 'pugilat'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'dagues'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'epees'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'hache'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/cuirasse#maitrise-arme:2', 1, 'pugilat'),
  ('classes/fenrir#maitrise-arme:2', 1, 'arbalete'),
  ('classes/fenrir#maitrise-arme:2', 1, 'arc'),
  ('classes/fenrir#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/fenrir#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/fenrir#maitrise-arme:2', 1, 'bombes'),
  ('classes/fenrir#maitrise-arme:2', 1, 'dagues'),
  ('classes/fenrir#maitrise-arme:2', 1, 'hache'),
  ('classes/fenrir#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/fenrir#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/fenrir#maitrise-arme:2', 1, 'pugilat'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'dagues'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'epees'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'hache'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/flagelleur#maitrise-arme:2', 1, 'pugilat'),
  ('classes/frappeur#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/frappeur#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/frappeur#maitrise-arme:1', 1, 'pugilat'),
  ('classes/goleois#maitrise-arme:2', 1, 'arbalete'),
  ('classes/goleois#maitrise-arme:2', 1, 'arc'),
  ('classes/goleois#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/goleois#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/goleois#maitrise-arme:2', 1, 'bombes'),
  ('classes/goleois#maitrise-arme:2', 1, 'dagues'),
  ('classes/goleois#maitrise-arme:2', 1, 'epees'),
  ('classes/goleois#maitrise-arme:2', 1, 'hache'),
  ('classes/goleois#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/goleois#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/grenadier#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/grenadier#maitrise-arme:2', 1, 'dagues'),
  ('classes/grenadier#maitrise-arme:2', 1, 'epees'),
  ('classes/grenadier#maitrise-arme:2', 1, 'hache'),
  ('classes/grenadier#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/grenadier#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/grenadier#maitrise-arme:2', 1, 'pugilat'),
  ('classes/guerrier#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/guerrier#maitrise-arme:2', 1, 'dagues'),
  ('classes/guerrier#maitrise-arme:2', 1, 'hache'),
  ('classes/guerrier#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/guerrier#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/guerrier#maitrise-arme:2', 1, 'pugilat'),
  ('classes/jackalope#maitrise-arme:2', 1, 'arbalete'),
  ('classes/jackalope#maitrise-arme:2', 1, 'arc'),
  ('classes/jackalope#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/jackalope#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/jackalope#maitrise-arme:2', 1, 'bombes'),
  ('classes/jackalope#maitrise-arme:2', 1, 'dagues'),
  ('classes/jackalope#maitrise-arme:2', 1, 'hache'),
  ('classes/jackalope#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/jackalope#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/jackalope#maitrise-arme:2', 1, 'pugilat'),
  ('classes/kitsune#maitrise-arme:2', 1, 'arbalete'),
  ('classes/kitsune#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/kitsune#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/kitsune#maitrise-arme:2', 1, 'bombes'),
  ('classes/kitsune#maitrise-arme:2', 1, 'dagues'),
  ('classes/kitsune#maitrise-arme:2', 1, 'epees'),
  ('classes/kitsune#maitrise-arme:2', 1, 'hache'),
  ('classes/kitsune#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/kitsune#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/kitsune#maitrise-arme:2', 1, 'pugilat'),
  ('classes/lanceur#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/lanceur#maitrise-arme:2', 1, 'dagues'),
  ('classes/lanceur#maitrise-arme:2', 1, 'epees'),
  ('classes/lanceur#maitrise-arme:2', 1, 'hache'),
  ('classes/lanceur#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/lanceur#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/lanceur#maitrise-arme:2', 1, 'pugilat'),
  ('classes/maclier#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/maclier#maitrise-arme:1', 1, 'dagues'),
  ('classes/maclier#maitrise-arme:1', 1, 'epees'),
  ('classes/maclier#maitrise-arme:1', 1, 'hache'),
  ('classes/maclier#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/maclier#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/maclier#maitrise-arme:1', 1, 'pugilat'),
  ('classes/mage#maitrise-arme:1', 1, 'arbalete'),
  ('classes/mage#maitrise-arme:1', 1, 'arc'),
  ('classes/mage#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/mage#maitrise-arme:1', 1, 'bombes'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'arbalete'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'arc'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'bombes'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'dagues'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'epees'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'hache'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/mage-bleu#maitrise-arme:1', 1, 'pugilat'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'dagues'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'epees'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'hache'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/mage-rouge#maitrise-arme:1', 1, 'pugilat'),
  ('classes/mage-vert#maitrise-arme:1', 1, 'arbalete'),
  ('classes/mage-vert#maitrise-arme:1', 1, 'arc'),
  ('classes/mage-vert#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/mage-vert#maitrise-arme:1', 1, 'bombes'),
  ('classes/marcass#maitrise-arme:2', 1, 'arbalete'),
  ('classes/marcass#maitrise-arme:2', 1, 'arc'),
  ('classes/marcass#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/marcass#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/marcass#maitrise-arme:2', 1, 'bombes'),
  ('classes/marcass#maitrise-arme:2', 1, 'dagues'),
  ('classes/marcass#maitrise-arme:2', 1, 'epees'),
  ('classes/marcass#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/marcass#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/marcass#maitrise-arme:2', 1, 'pugilat'),
  ('classes/martiale#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/martiale#maitrise-arme:1', 1, 'dagues'),
  ('classes/martiale#maitrise-arme:1', 1, 'epees'),
  ('classes/martiale#maitrise-arme:1', 1, 'hache'),
  ('classes/martiale#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/martiale#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/martiale#maitrise-arme:1', 1, 'pugilat'),
  ('classes/medusain#maitrise-arme:2', 1, 'arbalete'),
  ('classes/medusain#maitrise-arme:2', 1, 'arc'),
  ('classes/medusain#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/medusain#maitrise-arme:2', 1, 'bombes'),
  ('classes/medusain#maitrise-arme:2', 1, 'dagues'),
  ('classes/medusain#maitrise-arme:2', 1, 'epees'),
  ('classes/medusain#maitrise-arme:2', 1, 'hache'),
  ('classes/medusain#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/medusain#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/medusain#maitrise-arme:2', 1, 'pugilat'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'arbalete'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'arc'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'bombes'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'dagues'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'epees'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'hache'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/mercenaire#maitrise-arme:1', 1, 'pugilat'),
  ('classes/minotaure#maitrise-arme:2', 1, 'arbalete'),
  ('classes/minotaure#maitrise-arme:2', 1, 'arc'),
  ('classes/minotaure#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/minotaure#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/minotaure#maitrise-arme:2', 1, 'bombes'),
  ('classes/minotaure#maitrise-arme:2', 1, 'dagues'),
  ('classes/minotaure#maitrise-arme:2', 1, 'epees'),
  ('classes/minotaure#maitrise-arme:2', 1, 'hache'),
  ('classes/minotaure#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/minotaure#maitrise-arme:2', 1, 'pugilat'),
  ('classes/moine#maitrise-arme:2', 1, 'dagues'),
  ('classes/moine#maitrise-arme:2', 1, 'epees'),
  ('classes/moine#maitrise-arme:2', 1, 'hache'),
  ('classes/moine#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/moine#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/moine#maitrise-arme:2', 1, 'pugilat'),
  ('classes/namazu#maitrise-arme:2', 1, 'arbalete'),
  ('classes/namazu#maitrise-arme:2', 1, 'arc'),
  ('classes/namazu#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/namazu#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/namazu#maitrise-arme:2', 1, 'bombes'),
  ('classes/namazu#maitrise-arme:2', 1, 'dagues'),
  ('classes/namazu#maitrise-arme:2', 1, 'epees'),
  ('classes/namazu#maitrise-arme:2', 1, 'hache'),
  ('classes/namazu#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/namazu#maitrise-arme:2', 1, 'pugilat'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'arbalete'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'arc'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'bombes'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'dagues'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'epees'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'hache'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/ocultomancien#maitrise-arme:1', 1, 'pugilat'),
  ('classes/olwman#maitrise-arme:2', 1, 'arc'),
  ('classes/olwman#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/olwman#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/olwman#maitrise-arme:2', 1, 'bombes'),
  ('classes/olwman#maitrise-arme:2', 1, 'dagues'),
  ('classes/olwman#maitrise-arme:2', 1, 'epees'),
  ('classes/olwman#maitrise-arme:2', 1, 'hache'),
  ('classes/olwman#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/olwman#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/olwman#maitrise-arme:2', 1, 'pugilat'),
  ('classes/orios#maitrise-arme:2', 1, 'arbalete'),
  ('classes/orios#maitrise-arme:2', 1, 'arc'),
  ('classes/orios#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/orios#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/orios#maitrise-arme:2', 1, 'bombes'),
  ('classes/orios#maitrise-arme:2', 1, 'dagues'),
  ('classes/orios#maitrise-arme:2', 1, 'epees'),
  ('classes/orios#maitrise-arme:2', 1, 'hache'),
  ('classes/orios#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/orios#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/parleur#maitrise-arme:1', 1, 'arbalete'),
  ('classes/parleur#maitrise-arme:1', 1, 'arc'),
  ('classes/parleur#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/parleur#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/parleur#maitrise-arme:1', 1, 'bombes'),
  ('classes/parleur#maitrise-arme:1', 1, 'dagues'),
  ('classes/parleur#maitrise-arme:1', 1, 'epees'),
  ('classes/parleur#maitrise-arme:1', 1, 'hache'),
  ('classes/parleur#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/parleur#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/parleur#maitrise-arme:1', 1, 'pugilat'),
  ('classes/rokh#maitrise-arme:2', 1, 'arbalete'),
  ('classes/rokh#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/rokh#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/rokh#maitrise-arme:2', 1, 'bombes'),
  ('classes/rokh#maitrise-arme:2', 1, 'dagues'),
  ('classes/rokh#maitrise-arme:2', 1, 'epees'),
  ('classes/rokh#maitrise-arme:2', 1, 'hache'),
  ('classes/rokh#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/rokh#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/rokh#maitrise-arme:2', 1, 'pugilat'),
  ('classes/satyre#maitrise-arme:2', 1, 'arbalete'),
  ('classes/satyre#maitrise-arme:2', 1, 'arc'),
  ('classes/satyre#maitrise-arme:2', 1, 'arme-de-jet'),
  ('classes/satyre#maitrise-arme:2', 1, 'bombes'),
  ('classes/satyre#maitrise-arme:2', 1, 'dagues'),
  ('classes/satyre#maitrise-arme:2', 1, 'epees'),
  ('classes/satyre#maitrise-arme:2', 1, 'hache'),
  ('classes/satyre#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/satyre#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/satyre#maitrise-arme:2', 1, 'pugilat'),
  ('classes/tueur#maitrise-arme:1', 1, 'arbalete'),
  ('classes/tueur#maitrise-arme:1', 1, 'arc'),
  ('classes/tueur#maitrise-arme:1', 1, 'arme-de-jet'),
  ('classes/tueur#maitrise-arme:1', 1, 'baton-de-combat'),
  ('classes/tueur#maitrise-arme:1', 1, 'bombes'),
  ('classes/tueur#maitrise-arme:1', 1, 'dagues'),
  ('classes/tueur#maitrise-arme:1', 1, 'epees'),
  ('classes/tueur#maitrise-arme:1', 1, 'hache'),
  ('classes/tueur#maitrise-arme:1', 1, 'lance-arme-dhast'),
  ('classes/tueur#maitrise-arme:1', 1, 'masse-marteau'),
  ('classes/tueur#maitrise-arme:1', 1, 'pugilat'),
  ('classes/voleur#maitrise-arme:2', 1, 'baton-de-combat'),
  ('classes/voleur#maitrise-arme:2', 1, 'epees'),
  ('classes/voleur#maitrise-arme:2', 1, 'hache'),
  ('classes/voleur#maitrise-arme:2', 1, 'lance-arme-dhast'),
  ('classes/voleur#maitrise-arme:2', 1, 'masse-marteau'),
  ('classes/voleur#maitrise-arme:2', 1, 'pugilat');

INSERT INTO capacite_nm_gagne (capacite_id, nm) VALUES
  ('capacites/ocultomancien-maitrise', 4);

-- R151 : la famille du point de maîtrise de l'accessoire se choisit dans la fiche
UPDATE accessoire_effet_cible SET choix = 1 WHERE cible = 'maitrise_arme';

-- Section 13 : un choix de famille par point à choisir (R148) ; plus de dés saisis par famille

CREATE TABLE personnage_maitrise_choix (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  source          TEXT    NOT NULL CHECK (length(source) > 0),   -- maitrise_arme_part.source_id (sans clé étrangère)
  rang            INTEGER NOT NULL CHECK (rang >= 1),            -- le numéro du point dans la part à choisir de la source (de 1 à ses points)
  arme_famille_id TEXT    NOT NULL REFERENCES arme_famille(id),  -- la famille choisie pour ce point
  PRIMARY KEY (personnage_id, source, rang)
) STRICT, WITHOUT ROWID;

DROP TABLE personnage_maitrise_arme;

-- R152 : personnage_acquis_choix sans arme_famille_id (reconstruite ; les autres colonnes et la clé ne changent pas)
DROP INDEX personnage_acquis_choix_arme;

CREATE TABLE personnage_acquis_choix_0076 (
  personnage_id   TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  source          TEXT    NOT NULL CHECK (length(source) > 0),
  rang            INTEGER NOT NULL CHECK (rang >= 1),
  competence_id   TEXT    NOT NULL REFERENCES competence(id),
  valeur          INTEGER CHECK (valeur >= 1),
  PRIMARY KEY (personnage_id, source, rang, competence_id)
) STRICT, WITHOUT ROWID;

INSERT INTO personnage_acquis_choix_0076 (personnage_id, source, rang, competence_id, valeur)
  SELECT personnage_id, source, rang, competence_id, valeur FROM personnage_acquis_choix;

DROP TABLE personnage_acquis_choix;
ALTER TABLE personnage_acquis_choix_0076 RENAME TO personnage_acquis_choix;

-- Vues : copiées de data/schema.sql

CREATE VIEW v_personnage_don_acquis AS
  SELECT pc.personnage_id, pc.rang AS classe_rang, pc.classe_id, c.id AS capacite_id
  FROM personnage_classe pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN capacite c ON c.classe_id = pc.classe_id
  WHERE CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END >= 1
    AND c.niveau <= CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END
    AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id)
    AND (c.nature <> 'choix' OR EXISTS (SELECT 1 FROM personnage_capacite k WHERE k.personnage_id = pc.personnage_id AND k.capacite_id = c.id));

CREATE VIEW v_personnage_maitrise_part AS
  SELECT pc.personnage_id, m.source_id, m.rang, pc.rang AS classe_rang, pc.classe_id, m.capacite_id, m.genre, m.points, m.arme_famille_id, m.limite_famille
  FROM personnage_classe pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN maitrise_arme_part m ON m.classe_id = pc.classe_id
  WHERE CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END >= 1
  UNION ALL
  SELECT d.personnage_id, m.source_id, m.rang, d.classe_rang, d.classe_id, m.capacite_id, m.genre, m.points, m.arme_famille_id, m.limite_famille
  FROM v_personnage_don_acquis d
  JOIN maitrise_arme_part m ON m.capacite_id = d.capacite_id;

CREATE VIEW v_personnage_maitrise_arme AS
  WITH choisis AS (
    SELECT a.personnage_id, a.source_id, ch.rang, ch.arme_famille_id
    FROM v_personnage_maitrise_part a
    JOIN personnage_maitrise_choix ch ON ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points
    JOIN maitrise_arme_part_famille o ON o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id
    WHERE a.genre = 'choix'
  ),
  apports AS (
    SELECT a.personnage_id, a.arme_famille_id, a.points
    FROM v_personnage_maitrise_part a
    WHERE a.genre = 'imposee'
    UNION ALL
    SELECT c.personnage_id, c.arme_famille_id, 1
    FROM choisis c
    UNION ALL
    SELECT a.personnage_id, c.arme_famille_id, a.points
    FROM v_personnage_maitrise_part a
    JOIN classe_maitrise_arme l ON l.classe_id = a.classe_id AND l.forme = 'au_choix'
    JOIN choisis c ON c.personnage_id = a.personnage_id AND c.source_id = l.classe_id || '#maitrise-arme:' || l.rang AND c.rang = 1
    WHERE a.genre = 'suit'
    UNION ALL
    SELECT pa.personnage_id, pa.arme_famille_id, CASE WHEN pa.maudit = 1 THEN -e.valeur ELSE e.valeur END
    FROM personnage_accessoire pa
    JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
    JOIN arme_famille f ON f.id = pa.arme_famille_id AND f.maitrisable = 1
  ),
  sommes AS (
    SELECT personnage_id, arme_famille_id, CASE WHEN SUM(points) > 0 THEN SUM(points) ELSE 0 END AS points
    FROM apports
    GROUP BY personnage_id, arme_famille_id
  ),
  bornes AS (
    SELECT (SELECT r.valeur FROM regle_constante r WHERE r.id = 'maitrise_arme.des_sans_maitrise') AS sans,
           (SELECT r.valeur FROM regle_constante r WHERE r.id = 'maitrise_arme.des_max')
             - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'maitrise_arme.des_sans_maitrise') AS plafond
  )
  SELECT s.personnage_id, s.arme_famille_id, s.points,
         CASE WHEN s.points > b.plafond THEN b.plafond ELSE s.points END AS points_comptes,
         b.sans + CASE WHEN s.points > b.plafond THEN b.plafond ELSE s.points END AS des
  FROM sommes s CROSS JOIN bornes b;

CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Race et magie innée : toute fiche en a une (jusqu'à la migration 0038, une contrainte de la table pour toute fiche hors brouillon)
  SELECT p.id, 'race_manquante', NULL
  FROM personnage p
  WHERE p.race_id IS NULL
  UNION ALL
  SELECT p.id, 'magie_innee_manquante', NULL
  FROM personnage p
  WHERE p.magie_innee_id IS NULL
  UNION ALL
  -- Classe réservée à une magie innée, qui l'impose en classe 1 (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décision R23)
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  SELECT p.id, 'classe_imposee', c.id
  FROM personnage p
  JOIN classe c ON c.magie_innee_id = p.magie_innee_id
  JOIN personnage_classe pc ON pc.personnage_id = p.id AND pc.rang = 1
  WHERE pc.classe_id <> c.id
  UNION ALL
  -- Classe que ferme la magie innée, à tous les rangs (classe.magie_innee_exclue_id ; le Mage Bleu et le Potentiel Illimité, décision R25)
  SELECT pc.personnage_id, 'classe_exclue', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_exclue_id = p.magie_innee_id
  UNION ALL
  -- Magie innée accessible à la race : matrice « Accessibilité Magie » (R8), sauf liste de l'onglet de la race qui prime (R11)
  SELECT p.id, 'magie_innee_inaccessible', p.magie_innee_id
  FROM personnage p
  WHERE p.race_id IS NOT NULL AND p.magie_innee_id IS NOT NULL
    AND CASE WHEN EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id)
             THEN NOT EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id AND o.magie_id = p.magie_innee_id)
             ELSE NOT EXISTS (SELECT 1 FROM race_magie rm WHERE rm.race_id = p.race_id AND rm.magie_id = p.magie_innee_id AND rm.accessible = 1)
        END
  UNION ALL
  -- Magies incompatibles entre elles (bloc « Magie non compatible » des onglets de magie)
  SELECT p.id, 'magies_incompatibles', p.magie_innee_id || ' / ' || p.magie_acquise_id
  FROM personnage p
  JOIN v_magie_incompatible i ON i.a = p.magie_innee_id AND i.b = p.magie_acquise_id
  UNION ALL
  -- Mono-magie (décision R15) : pas de magie acquise avec une magie mono-magie, sauf ethnie citée par magie_ethnie_secondaire, que la magie
  -- mono-magie soit l'innée ou l'acquise (décision R20 : l'Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption)
  SELECT p.id, 'mono_magie', m.id
  FROM personnage p
  JOIN magie m ON m.mono_magie = 1 AND m.id IN (p.magie_innee_id, p.magie_acquise_id)
  WHERE p.magie_acquise_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM magie_ethnie_secondaire s WHERE s.magie_id = m.id AND s.ethnie_id = p.ethnie_id)
  UNION ALL
  -- Race à une seule magie (race.mono_magie ; la Lamia, décision R28) : pas de magie acquise
  SELECT p.id, 'race_mono_magie', p.magie_acquise_id
  FROM personnage p JOIN race r ON r.id = p.race_id
  WHERE r.mono_magie = 1 AND p.magie_acquise_id IS NOT NULL
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2). Sans race ou sans magie
  -- innée, rien à comparer : race_manquante, magie_innee_manquante le disent (migration 0038)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id <> p.magie_innee_id
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
  UNION ALL
  SELECT pc.personnage_id, 'caracteristique_hors_bornes', pc.caracteristique_id || ' = ' || pc.base
  FROM personnage_caracteristique pc
  JOIN personnage p ON p.id = pc.personnage_id
  JOIN v_race_carac_borne b ON b.race_id = p.race_id AND b.caracteristique_id = pc.caracteristique_id
  WHERE pc.base < b.minimum OR pc.base > b.maximum
  UNION ALL
  SELECT n.personnage_id, 'caracteristiques_total', (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) || ' / ' || s.valeur
  FROM v_personnage_niveau n
  JOIN seuil_niveau s ON s.regle = 'caracteristiques_total'
   AND s.niveau_min = (SELECT MAX(t.niveau_min) FROM seuil_niveau t WHERE t.regle = 'caracteristiques_total' AND t.niveau_min <= n.niveau_global)
  WHERE EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id)
    AND (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) <> s.valeur
  UNION ALL
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3)
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  -- Entraînement (décision R104) : 15 compétences au plus (« Vous ne pouvez monter que 15 compétences maximum »), 10 points au plus chacune (« à hauteur
  -- maximum 10% de bonus » ; une ligne à 0 ne monte rien) ; l'Acquis, lui, se calcule (le plafond de 5 par point de caractéristique est appliqué par la page)
  SELECT pe.personnage_id, 'entrainement_competences', COUNT(*) || ' / ' || (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  FROM personnage_entrainement pe
  WHERE pe.competence_id IS NOT NULL AND pe.valeur > 0
  GROUP BY pe.personnage_id
  HAVING COUNT(*) > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  UNION ALL
  SELECT pe.personnage_id, 'entrainement_valeur', pe.competence_id || ' = ' || pe.valeur
  FROM personnage_entrainement pe
  WHERE pe.valeur > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.bonus_max_pct')
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
  UNION ALL
  -- Gains de niveau (décision R73) : santé + chakra gagnés (personnage.gains_sante, gains_chakra) = les points d'attributs des niveaux atteints
  -- (v_niveau.points_attributs_cumul : 15 par niveau à partir du 2), plus le dé bonus de chaque niveau atteint qui en donne un, entre son plus petit
  -- et son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max : 1 et 8) ; au niveau 1, rien. Détail : « total / à saisir », ou
  -- « total / minimum à maximum » quand un dé est atteint
  SELECT n.personnage_id, 'gains_niveau', (p.gains_sante + p.gains_chakra) || ' / ' || (v.points_attributs_cumul + v.de_attributs_min_cumul)
         || CASE WHEN v.de_attributs_max_cumul > v.de_attributs_min_cumul THEN ' à ' || (v.points_attributs_cumul + v.de_attributs_max_cumul) ELSE '' END
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.gains_sante + p.gains_chakra NOT BETWEEN v.points_attributs_cumul + v.de_attributs_min_cumul
                                               AND v.points_attributs_cumul + v.de_attributs_max_cumul
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n
  WHERE n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
  UNION ALL
  SELECT pc.personnage_id, 'specialite_trop_tot', pc.specialite_id
  FROM personnage_classe pc JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  WHERE pc.specialite_id IS NOT NULL
    AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END < 10
  UNION ALL
  -- Dons choisis : d'une classe du personnage, de sa spécialité s'ils en dépendent, jamais deux options exclusives ensemble
  SELECT pk.personnage_id, 'capacite_hors_classe', pk.capacite_id
  FROM personnage_capacite pk JOIN capacite c ON c.id = pk.capacite_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = pk.personnage_id AND pc.classe_id = c.classe_id
                      AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id))
  UNION ALL
  SELECT a.personnage_id, 'capacites_exclusives', a.capacite_id || ' / ' || b.capacite_id
  FROM personnage_capacite a
  JOIN v_capacite_exclusive x ON x.capacite_id = a.capacite_id
  JOIN personnage_capacite b ON b.personnage_id = a.personnage_id AND b.capacite_id = x.autre_id
  WHERE a.capacite_id < b.capacite_id
  UNION ALL
  -- Sorts : d'une magie du personnage (le Potentiel Illimité « pioche ses sorts dans toutes les magies existantes », son Explication) ;
  -- NPM au plus la puissance magique du niveau (niveau_global : niveau 16 pour la 5, décision R16), le palier dont la note dit « non disponible pour
  -- les personnages avec une magie acquise » ne comptant pas pour eux. NM (décision R26) : au plus 3 sur un sort, toutes origines comprises ; ceux de niveau
  -- au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du MJ (décision R24). Depuis la
  -- décision R118 (migration 0066), les NM du MJ sont ceux de la fiche (personnage.nm_mj), pas d'un sort : les NM d'un sort sans celui de son livre
  -- comptent, au plus niveau global − 1 plus les NM du MJ sur un sort, au plus les NM gagnés plus ceux du MJ en tout (tant qu'un niveau donne un NM, la
  -- seconde règle implique la première, qui nomme le sort)
  SELECT ps.personnage_id, 'sort_hors_magie', ps.sort_id
  FROM personnage_sort ps JOIN sort s ON s.id = ps.sort_id JOIN personnage p ON p.id = ps.personnage_id
  WHERE s.magie_id <> COALESCE(p.magie_innee_id, '') AND s.magie_id <> COALESCE(p.magie_acquise_id, '')
    AND COALESCE(p.magie_innee_id, '') <> 'magies/potentiel-illimite'
  UNION ALL
  SELECT ps.personnage_id, 'sort_puissance', ps.sort_id || ' : NPM ' || s.niveau
  FROM personnage_sort ps
  JOIN sort s ON s.id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE s.niveau > (SELECT MAX(g.puissance_magique) FROM niveau_global g
                    WHERE g.niveau <= n.niveau_global AND (p.magie_acquise_id IS NULL OR g.puissance_magique_note IS NULL))
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_plafond', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps
  WHERE ps.niveau_maitrise > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_max')
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - ps.nm_livre)
  FROM personnage_sort ps
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - ps.nm_livre > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global') + p.nm_mj
  UNION ALL
  -- NM gagnés : ceux des niveaux (v_niveau.niveaux_maitrise_cumul), plus ceux qu'écrit un don acquis (« Gagne 4 niveaux de maîtrise (NM). » de
  -- l'Ocultomancien : capacite_nm_gagne, v_personnage_don_acquis ; décision R154, migration 0076), plus ceux du MJ ; sort_nm_max ne les lit pas.
  -- Détail : « comptés / des niveaux », puis « + N des dons » et « + N du MJ » quand il y en a
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - ps.nm_livre) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) || ' / '
         || v.niveaux_maitrise_cumul || CASE WHEN d.nm > 0 THEN ' + ' || d.nm || ' des dons' ELSE '' END
         || CASE WHEN p.nm_mj > 0 THEN ' + ' || p.nm_mj || ' du MJ' ELSE '' END
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global JOIN personnage p ON p.id = n.personnage_id
  JOIN (SELECT q.id AS personnage_id, COALESCE((SELECT SUM(g.nm) FROM v_personnage_don_acquis a JOIN capacite_nm_gagne g ON g.capacite_id = a.capacite_id
                                                WHERE a.personnage_id = q.id), 0) AS nm
        FROM personnage q) d ON d.personnage_id = n.personnage_id
  WHERE (SELECT SUM(ps.niveau_maitrise - ps.nm_livre) FROM personnage_sort ps WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul + d.nm + p.nm_mj
  UNION ALL
  -- Bouclier (décision R96) : une forme et une matière ; la matière, l'amélioration ou la solidité n'existent qu'avec la forme, et la forme attend sa matière
  SELECT p.id, 'bouclier_manquant', COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT))
  FROM personnage p
  WHERE p.bouclier_classe_id IS NULL AND COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT)) IS NOT NULL
  UNION ALL
  SELECT p.id, 'bouclier_matiere_manquante', p.bouclier_classe_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NULL
  UNION ALL
  -- la forme et la matière désignent un bouclier de la liste (table bouclier) : un couple que l'onglet Boucliers n'écrit pas est signalé
  SELECT p.id, 'bouclier_inconnu', p.bouclier_classe_id || ' + ' || p.bouclier_materiau_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = p.bouclier_classe_id AND b.materiau_id = p.bouclier_materiau_id)
  UNION ALL
  -- Posture Symbiose (décision R100) : sa magie est la magie innée ou la magie acquise du personnage, pas le Potentiel Illimité (question Q15)
  SELECT p.id, 'symbiose_magie', p.symbiose_magie_id
  FROM personnage p
  WHERE p.symbiose_magie_id IS NOT NULL
    AND (p.symbiose_magie_id = 'magies/potentiel-illimite' OR p.symbiose_magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, '')))
  UNION ALL
  -- Maîtrises d'armes (décisions R148 à R151, migration 0076) : chaque point à choisir d'une source acquise (v_personnage_maitrise_part) a sa famille
  -- (personnage_maitrise_choix), parmi les options de sa part ; une ligne de choix relève d'une seule de ces règles : sur une famille sans maîtrise,
  -- maitrise_arme_exclue (ARME DE MONSTRES, R45) ; sinon, d'une source qui n'est plus acquise ou d'un point qu'elle n'a pas, maitrise_source_perdue ;
  -- sinon, hors des options, maitrise_hors_choix. Détail d'une ligne de choix : « source : point = famille ».
  -- Point sans famille (R148) : détail « source = nombre de points à choisir » ; l'accessoire « Un point de maîtrise d'arme » sans famille (R151),
  -- « accessoire:<emplacement> = 1 »
  SELECT a.personnage_id, 'maitrise_a_choisir', a.source_id || ' = ' || (a.points - (SELECT count(*) FROM personnage_maitrise_choix ch
                                                 WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points))
  FROM v_personnage_maitrise_part a
  WHERE a.genre = 'choix'
    AND (SELECT count(*) FROM personnage_maitrise_choix ch WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points) < a.points
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_a_choisir', 'accessoire:' || pa.emplacement || ' = ' || e.valeur
  FROM personnage_accessoire pa JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  WHERE pa.arme_famille_id IS NULL
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45),
  -- ni par un choix ni par l'accessoire (« accessoire:<emplacement> : 1 = famille »)
  SELECT ch.personnage_id, 'maitrise_arme_exclue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_arme_exclue', 'accessoire:' || pa.emplacement || ' : 1 = ' || pa.arme_famille_id
  FROM personnage_accessoire pa
  JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  JOIN arme_famille f ON f.id = pa.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  -- Choix d'une source perdue (classe changée, spécialité perdue, niveau baissé, don à choix retiré) ou d'un point que sa part n'a pas : la page retire
  -- ces choix (comme acquisChoixValables), la base les signale
  SELECT ch.personnage_id, 'maitrise_source_perdue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM v_personnage_maitrise_part a WHERE a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix'
                      AND ch.rang <= a.points)
  UNION ALL
  -- Famille qui n'est pas une option de la part (Ménestrel : les quatre familles à distance, R151 ; « sauf », R138 ; catégorie, R127)
  SELECT ch.personnage_id, 'maitrise_hors_choix', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch
  JOIN arme_famille f ON f.id = ch.arme_famille_id
  JOIN v_personnage_maitrise_part a ON a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix' AND ch.rang <= a.points
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM maitrise_arme_part_famille o WHERE o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id)
  UNION ALL
  -- Limite écrite par famille (R150 : Maître d'arme 2, Combattant libre 3, lignes Bimane, Frappeur, Mercenaire 1 ; « catégorie » = famille, seuls les
  -- points de cette source comptent) ; sans limite écrite, la même famille peut revenir. Détail : « source : famille = points / limite »
  SELECT a.personnage_id, 'maitrise_meme_famille', a.source_id || ' : ' || ch.arme_famille_id || ' = ' || COUNT(*) || ' / ' || a.limite_famille
  FROM v_personnage_maitrise_part a
  JOIN personnage_maitrise_choix ch ON ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points
  JOIN maitrise_arme_part_famille o ON o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id
  WHERE a.genre = 'choix' AND a.limite_famille IS NOT NULL
  GROUP BY a.personnage_id, a.source_id, a.limite_famille, ch.arme_famille_id
  HAVING COUNT(*) > a.limite_famille
  UNION ALL
  -- Plafond (R149) : 4 points au plus par famille (maitrise_arme.des_max − maitrise_arme.des_sans_maitrise), les sources additionnées ; au-delà, signalé
  -- sans rien refuser, les points en trop ne donnent pas de dé. Détail : « famille = points / plafond »
  SELECT m.personnage_id, 'maitrise_plafond', m.arme_famille_id || ' = ' || m.points || ' / ' || m.points_comptes
  FROM v_personnage_maitrise_arme m
  WHERE m.points > m.points_comptes
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_elementaire_id
  WHERE ae.cible <> 'arme_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'élément de l’armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'bouclier : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.bouclier_amelioration_id
  WHERE ae.cible <> 'bouclier'
  UNION ALL
  -- Armure (décision R95) : une amélioration ou un élément d'armure n'existe qu'avec l'armure ; une partie n'a de solidité que si l'armure l'a (la seule
  -- « armure-complete » d'une armure à solidité unifiée, armure.solidite_uni = 1 ; les six autres sinon)
  SELECT p.id, 'armure_manquante', COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id)
  FROM personnage p
  WHERE p.armure_id IS NULL AND COALESCE(p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id) IS NOT NULL
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE a.id IS NULL OR (COALESCE(a.solidite_uni, 0) = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;

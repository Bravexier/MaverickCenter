-- 0004-bonus-maitrise : bonus de niveau de maîtrise (NM) des sorts, mode séparé du type.
-- Migration de structure ET de données.
--   * sort.bonus_maitrise : colonne « Bonus Maîtrise » (une ligne par bonus : « Coût : -5/NM »), NULL pour les 3 sorts qui n'écrivent aucun NM ;
--   * sort_bonus_maitrise : le même contenu, typé (par_nm / palier / texte), EXHAUSTIF : remplace sort_progression_nm (qui ne retenait que deux formes dans cinq colonnes) ;
--   * sort.mode_brut et sort_mode : le MODE (ce que la colonne « Type » écrit entre parenthèses : IC, Imparable, Inesquivable) séparé du TYPE (sort_type) ;
--   * v_sort_bonus_au_nm : ce qui s'applique à un niveau de maîtrise donné (0 à 3), pour la fiche de personnage.
-- Rien n'est interprété : chaque ligne recopie une expression exacte de la cellule du sort (texte_brut) et le passage qui dit ce qu'elle modifie (contexte) ;
-- les valeurs typées ne sont posées que quand l'écriture est sans ambiguïté (les quelques lectures prudentes d'expressions ambiguës sont listées dans docs/sql/a-valider.md).
-- Extraction faite deux fois indépendamment (un extracteur déterministe et une relecture cellule par cellule), puis contrôlée : chaque expression est une sous-chaîne exacte de sa cellule, chaque mention de NM
-- de chacune des sept colonnes de texte est couverte (client/test/maitrise-sorts.test.mjs). Le détail ligne par ligne est dans 0004-bonus-maitrise.json.

ALTER TABLE sort ADD COLUMN mode_brut TEXT;
ALTER TABLE sort ADD COLUMN bonus_maitrise TEXT;

CREATE TABLE sort_mode (
  sort_id    TEXT    NOT NULL REFERENCES sort(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  mode       TEXT    NOT NULL CHECK (mode IN ('ic', 'imparable', 'inesquivable')),
  libelle    TEXT    NOT NULL CHECK (length(libelle) > 0),
  fois       INTEGER CHECK (fois >= 2),
  origine    TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, rang),
  UNIQUE (sort_id, mode),
  CHECK (fois IS NULL OR mode = 'ic')
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_mode_mode ON sort_mode (mode);

CREATE TABLE sort_bonus_maitrise (
  sort_id          TEXT    NOT NULL REFERENCES sort(id),
  champ            TEXT    NOT NULL CHECK (champ IN ('type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque')),   -- colonne de la source où l'expression est écrite
  rang             INTEGER NOT NULL CHECK (rang >= 1),     -- ordre d'apparition dans la cellule
  nature           TEXT    NOT NULL CHECK (nature IN ('par_nm', 'palier', 'texte')),
  texte_brut       TEXT    NOT NULL CHECK (length(texte_brut) > 0),    -- l'expression de NM, exacte : « +1d6/NM », « 3NM = Croix 1x1 », « IC pour 3 NM »
  contexte         TEXT    NOT NULL CHECK (length(contexte) > 0),      -- le passage de la cellule qui la contient et dit ce qu'elle modifie
  increment_brut   TEXT,
  increment_entier INTEGER,
  pas_nm           INTEGER CHECK (pas_nm IN (1, 3)),
  seuil_nm         INTEGER CHECK (seuil_nm BETWEEN 1 AND 3),
  origine          TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref       TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (sort_id, champ, rang),
  CHECK (instr(contexte, texte_brut) > 0),
  CHECK ((nature = 'par_nm'  AND increment_brut IS NOT NULL AND pas_nm IS NOT NULL AND seuil_nm IS NULL)
      OR (nature = 'palier'  AND seuil_nm IS NOT NULL AND increment_brut IS NULL AND increment_entier IS NULL AND pas_nm IS NULL)
      OR (nature = 'texte'   AND seuil_nm IS NULL AND increment_brut IS NULL AND increment_entier IS NULL AND pas_nm IS NULL))
) STRICT, WITHOUT ROWID;

CREATE INDEX sort_bonus_maitrise_champ ON sort_bonus_maitrise (champ, nature);

-- Modes de base (colonne « Type » : IC, Imparable, Inesquivable, IC x N)
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:retrait', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Corruption › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Corruption › AL34:BR36');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:contact-de-volt', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Foudre › AL7:BR9');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:affutage', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Foudre › AL10:BR12');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:chargeur', 1, 'ic', 'IC x 3', 3, 'magies', 'Magie Maverick V8 › Foudre › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:souffle-electrique', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Foudre › AL31:BR33');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:eclair-en-chaine', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Foudre › AL49:BR51');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:peau-verglacee', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Glace › AL13:BR15');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:rafraichissement', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Glace › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:souffle-glacial', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Glace › AL22:BR24');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cuirasse-arctique', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Glace › AL31:BR33');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:lance-de-givre', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Glace › AL49:BR51');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:vitamine', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Lumière › AL13:BR15');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:benediction', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Lumière › AL22:BR24');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:panneau-solaire', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Lumière › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:poussiere-detoile', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Lumière › AL58:BR60');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:tremblement', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Terre › AL7:BR9');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:peau-de-pierre', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Terre › AL10:BR12');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:cuirasse-de-roche', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Terre › AL31:BR33');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:morsure-terrestre', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Terre › AL67:BR69');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:forge-magie', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Arcane › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:vision-magique', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Arcane › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-leau#sort:mucus-protecteur', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Eau › AL10:BR12');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-leau#sort:souffle-hydraulique', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Eau › AL22:BR24');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:teleportation', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL7:BR9');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:portail', 1, 'ic', 'IC x 2', 2, 'magies', 'Magie Maverick V8 › TempsEspace › AL10:BR12');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ralentissement', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL25:BR27');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:inversion', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:etat-anterieur', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL34:BR36');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:tranche-temps', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL37:BR39');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:tranche-temps', 2, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL37:BR39');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:premonition', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL67:BR69');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:premonition', 2, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL67:BR69');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:perturbation', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Ombre › AL7:BR9');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:pichenette', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Ombre › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:cri-ebranleur', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Ombre › AL19:BR21');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:malediction', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Ombre › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:amplification-sombre', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Ombre › AL40:BR42');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-feu#sort:braise-magique', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Feu › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-feu#sort:souffle-chaud', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Feu › AL31:BR33');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-feu#sort:mur-de-flammes', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Feu › AL34:BR36');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bouffee-infernale', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Feu › AL49:BR51');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Sang › AL10:BR12');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:attirance', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Sang › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:autel-sanglant', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Sang › AL58:BR60');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-sang#sort:perfusion', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Sang › AL61:BR63');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vent-couteau', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL7:BR9');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:force-agile', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Vent › AL13:BR15');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:propulsion', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Vent › AL16:BR18');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:cri-faible', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL19:BR21');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:feuille-morte', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Vent › AL28:BR30');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:recul-force', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Vent › AL31:BR33');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL43:BR45');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 2, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL43:BR45');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vibration', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL52:BR54');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:explosif', 1, 'inesquivable', 'Inesquivable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL67:BR69');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vent#sort:megaphone', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vent › AL70:BR72');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vide#sort:pression', 1, 'imparable', 'Imparable', NULL, 'magies', 'Magie Maverick V8 › Vide › AL13:BR15');
INSERT INTO sort_mode (sort_id, rang, mode, libelle, fois, origine, source_ref) VALUES ('magies/magie-du-vide#sort:esprit-solide', 1, 'ic', 'IC', NULL, 'magies', 'Magie Maverick V8 › Vide › AL55:BR57');

-- Bonus de niveau de maîtrise : une ligne par expression de NM écrite dans une cellule du sort
-- boule-de-sang : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre saignement 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:boule-de-sang', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:boule-de-sang', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre saignement 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre saignement 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL4:BR6');
-- clou : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:clou', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL7:BR9');
-- marquage : dsb « +1d/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:marquage', 'dsb', 1, 'par_nm', '+1d/3NM', '+1d/3NM', '+1d', NULL, 3, NULL, 'magies', 'Magie Maverick V8 › Sang › AL10:BR12');
-- annulation : effets « 3NM = que négatif pour allié, que positif pour ennemi »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:annulation', 'effets', 1, 'palier', '3NM = que négatif pour allié, que positif pour ennemi', '3NM = que négatif pour allié, que positif pour ennemi', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL13:BR15');
-- attirance : type « IC x 2 si 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:attirance', 'type', 1, 'palier', 'IC x 2 si 3NM', 'IC x 2 si 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL16:BR18');
-- sang-durci : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-durci', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL19:BR21');
-- fer-sanglant : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:fer-sanglant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL22:BR24');
-- sang-garde : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-garde', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL25:BR27');
-- sang-magie : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-magie', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL28:BR30');
-- sang-gain : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-gain', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL31:BR33');
-- saignee-forcee : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:saignee-forcee', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL34:BR36');
-- morsure-aspirante : effets « au niveau 3 de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:morsure-aspirante', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', '50% au niveau 3 de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL37:BR39');
-- coagulation : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:coagulation', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL40:BR42');
-- renfermement : dsb « +4/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:renfermement', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL43:BR45');
-- deflagration-sanguine : dsb « x4/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:deflagration-sanguine', 'dsb', 1, 'par_nm', 'x4/3NM', 'x4/3NM', 'x4', NULL, 3, NULL, 'magies', 'Magie Maverick V8 › Sang › AL46:BR48');
-- damocles : effets « au niveau 3 de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:damocles', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', 'pas de contrecoup au niveau 3 de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL49:BR51');
-- douleur-partagee : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:douleur-partagee', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL52:BR54');
-- grenade-a-clous : effets « 3NM = Si jet de vigueur raté = Inflige saignement stade 2 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:grenade-a-clous', 'effets', 1, 'palier', '3NM = Si jet de vigueur raté = Inflige saignement stade 2', '3NM = Si jet de vigueur raté = Inflige saignement stade 2', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL55:BR57');
-- autel-sanglant : dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:autel-sanglant', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL58:BR60');
-- perfusion : dsb « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:perfusion', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL61:BR63');
-- sang-perfection : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sang-perfection', 'effets', 1, 'par_nm', '+1/NM', 'dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL64:BR66');
-- proportion-demesuree : effets « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:proportion-demesuree', 'effets', 1, 'par_nm', '+5/NM', '+15 (+5/NM) aux dégâts physiques', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Sang › AL67:BR69');
-- sacrifice : effets « à 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-sang#sort:sacrifice', 'effets', 1, 'palier', 'à 3NM', 'Garde 1 santé à 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Sang › AL70:BR72');
-- boule-de-chakra : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre surcharge magique 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:boule-de-chakra', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:boule-de-chakra', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre surcharge magique 1', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre surcharge magique 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL4:BR6');
-- charge-denergie : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:charge-denergie', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL7:BR9');
-- rune-arcane : type « IC x 1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:rune-arcane', 'type', 1, 'par_nm', 'IC x 1/NM', 'IC x 1/NM', 'IC x 1', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL10:BR12');
-- claquement : type « IC pour 3 NM » ; dsb « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:claquement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL13:BR15');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:claquement', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL13:BR15');
-- forge-magie : effets « +1 utilisation/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:forge-magie', 'effets', 1, 'par_nm', '+1 utilisation/NM', 'Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM)', '+1 utilisation', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL16:BR18');
-- souffle-magique : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:souffle-magique', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL22:BR24');
-- echange : portee « +1/NM » ; effets « 3CK = 2BA/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:echange', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL25:BR27');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:echange', 'effets', 1, 'palier', '3CK = 2BA/3NM', '2CK = 1BA (3CK = 2BA/3NM)', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL25:BR27');
-- vague-deferlante : dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:vague-deferlante', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL31:BR33');
-- mur-de-chakra : effets « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:mur-de-chakra', 'effets', 1, 'par_nm', '+10/NM', 'Bloque 40 (+10/NM) dégâts par tour pendant 3 tours', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL34:BR36');
-- laser-de-chakra : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:laser-de-chakra', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL37:BR39');
-- pillage-defensif : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:pillage-defensif', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL40:BR42');
-- rune-arcane-multiple : type « IC x 1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:rune-arcane-multiple', 'type', 1, 'par_nm', 'IC x 1/NM', 'IC x 1/NM', 'IC x 1', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL43:BR45');
-- champ-gardien : effets « 3 NM = les dégâts ignorent les AM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:champ-gardien', 'effets', 1, 'palier', '3 NM = les dégâts ignorent les AM', '3 NM = les dégâts ignorent les AM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL46:BR48');
-- peau-de-chakra : type « IC x 1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:peau-de-chakra', 'type', 1, 'par_nm', 'IC x 1/NM', 'IC x 1/NM', 'IC x 1', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL49:BR51');
-- pluie-de-chakra : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:pluie-de-chakra', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL52:BR54');
-- grenade-de-chakra : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:grenade-de-chakra', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL55:BR57');
-- miroir-magique : type « IC pour 3 NM » ; effets « 3 NM = Ne prend plus l'effet en question »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:miroir-magique', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL58:BR60');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:miroir-magique', 'effets', 1, 'palier', '3 NM = Ne prend plus l''effet en question', '3 NM = Ne prend plus l''effet en question', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL58:BR60');
-- foudre-argente : dsb « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:foudre-argente', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL61:BR63');
-- drain-denergie : dsb « +1d/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:drain-denergie', 'dsb', 1, 'par_nm', '+1d/3NM', '+1d/3NM', '+1d', NULL, 3, NULL, 'magies', 'Magie Maverick V8 › Arcane › AL64:BR66');
-- voile-chakratique : effets « si 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:voile-chakratique', 'effets', 1, 'palier', 'si 3NM', 'Le coût en santé passe à 10% si 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL67:BR69');
-- planete-chakratique : effets « 1CK/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-larcane#sort:planete-chakratique', 'effets', 1, 'palier', '1CK/3NM', '2CK (1CK/3NM) = 1 dégâts', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Arcane › AL70:BR72');
-- boule-sombre : dsb « +1d6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:boule-sombre', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL4:BR6');
-- tir-dhuile : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:tir-dhuile', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL7:BR9');
-- verrouillage-simple : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:verrouillage-simple', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL10:BR12');
-- verrouille-visible : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:verrouille-visible', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL13:BR15');
-- retrait : dsb « +1d/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:retrait', 'dsb', 1, 'par_nm', '+1d/NM', '+1d/NM', '+1d', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL16:BR18');
-- aiguisage-magique : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:aiguisage-magique', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL19:BR21');
-- fer-corrompu : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:fer-corrompu', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL22:BR24');
-- souffle-noir : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:souffle-noir', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL25:BR27');
-- petrole : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:petrole', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL28:BR30');
-- vague-deferlante : dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:vague-deferlante', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL31:BR33');
-- mine-noire : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:mine-noire', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL34:BR36');
-- laser-noir : effets « 1%/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:laser-noir', 'effets', 1, 'par_nm', '1%/NM', 'Augmente la réussite critique de 1%/NM', '1%', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL37:BR39');
-- fouet-tenebreux : effets « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:fouet-tenebreux', 'effets', 1, 'par_nm', '+2/NM', 'Inflige 3 (+2/NM) corruption', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL40:BR42');
-- plaie-suintante : type « IC pour 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:plaie-suintante', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL43:BR45');
-- aura-de-frayeur : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:aura-de-frayeur', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL46:BR48');
-- grenade-collante : effets « 3NM = La grenade colle la cible »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:grenade-collante', 'effets', 1, 'palier', '3NM = La grenade colle la cible', '3NM = La grenade colle la cible', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Corruption › AL52:BR54');
-- verrouillage-magique : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:verrouillage-magique', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL55:BR57');
-- verrouillage-physique : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:verrouillage-physique', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL58:BR60');
-- pluie-huileuse : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:pluie-huileuse', 'effets', 1, 'par_nm', '+1/NM', 'Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL61:BR63');
-- une-tu-meurs : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:une-tu-meurs', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL64:BR66');
-- sapeur : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:sapeur', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL67:BR69');
-- eau-noire : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-corruption#sort:eau-noire', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Corruption › AL70:BR72');
-- coup-du-sablier : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:coup-du-sablier', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:coup-du-sablier', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL4:BR6');
-- teleportation : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:teleportation', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL7:BR9');
-- portail : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:portail', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL10:BR12');
-- substitution : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:substitution', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL13:BR15');
-- chute : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:chute', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL16:BR18');
-- fer-temporel : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:fer-temporel', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL19:BR21');
-- faille-temporelle : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:faille-temporelle', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL22:BR24');
-- ralentissement : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:ralentissement', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL25:BR27');
-- inversion : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:inversion', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL28:BR30');
-- frappe-temporelle : cout « -1/NM » ; dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:frappe-temporelle', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL31:BR33');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:frappe-temporelle', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL31:BR33');
-- etat-anterieur : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:etat-anterieur', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL34:BR36');
-- tranche-temps : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:tranche-temps', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL37:BR39');
-- vieillissement : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:vieillissement', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL40:BR42');
-- portail-piege : effets « 3NM = Pas de dégâts alliés »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:portail-piege', 'effets', 1, 'palier', '3NM = Pas de dégâts alliés', '3NM = Pas de dégâts alliés', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL43:BR45');
-- horloge-aspirante : effets « au niveau 3 de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:horloge-aspirante', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', '50% au niveau 3 de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL46:BR48');
-- celerite : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:celerite', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL49:BR51');
-- grenade-distordue : zone « +1/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:grenade-distordue', 'zone', 1, 'par_nm', '+1/3NM', '+1/3NM', '+1', 1, 3, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL52:BR54');
-- double-action : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:double-action', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL55:BR57');
-- teleport-parfait : portee « +20/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:teleport-parfait', 'portee', 1, 'par_nm', '+20/NM', '+20/NM', '+20', 20, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL58:BR60');
-- image-diffuse : type « IC pour 3 NM » ; effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:image-diffuse', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › TempsEspace › AL61:BR63');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:image-diffuse', 'effets', 1, 'par_nm', '+1/NM', 'Invoque 1 ou 2 clones (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL61:BR63');
-- trou-noir : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:trou-noir', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL64:BR66');
-- premonition : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:premonition', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL67:BR69');
-- distorsion : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lespace-temps#sort:distorsion', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › TempsEspace › AL70:BR72');
-- bulle-de-vide : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre enragé 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:bulle-de-vide', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:bulle-de-vide', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre enragé 1', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre enragé 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL4:BR6');
-- telekinesie : type « IC pour 3NM » ; effets « au niveau 3 de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:telekinesie', 'type', 1, 'palier', 'IC pour 3NM', 'IC pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL7:BR9');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:telekinesie', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', 'Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL7:BR9');
-- silence : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:silence', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL10:BR12');
-- pression : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:pression', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL13:BR15');
-- injonction-du-vide : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:injonction-du-vide', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL16:BR18');
-- fer-vide : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:fer-vide', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL19:BR21');
-- bisou-du-vide : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:bisou-du-vide', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL22:BR24');
-- poing-du-vide : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:poing-du-vide', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL25:BR27');
-- lien-mental : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:lien-mental', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL28:BR30');
-- dissipation : effets « pour 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:dissipation', 'effets', 1, 'palier', 'pour 3NM', 'Un allié perd le négatif et un ennemi le positif pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL31:BR33');
-- sablier-du-vide : dsb « +6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:sablier-du-vide', 'dsb', 1, 'par_nm', '+6/NM', '+6/NM', '+6', 6, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL34:BR36');
-- invisibilite : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:invisibilite', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL37:BR39');
-- lame-du-vide : effets « pour 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:lame-du-vide', 'effets', 1, 'palier', 'pour 3NM', 'Ignore les AM et BA pour 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL40:BR42');
-- aspect-vide : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:aspect-vide', 'effets', 1, 'par_nm', '+1/NM', 'Rend le lanceur intangible pour une attaque (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL43:BR45');
-- touche-du-vide : dsb « +6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:touche-du-vide', 'dsb', 1, 'par_nm', '+6/NM', '+6/NM', '+6', 6, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL46:BR48');
-- alea-negatif : remarque « 3NM = les altérations d'états sont 1 cran au-dessus et les croix durent 1 tour de plus »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:alea-negatif', 'remarque', 1, 'palier', '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus', '3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL49:BR51');
-- grenade-implosive : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:grenade-implosive', 'effets', 1, 'par_nm', '+1/NM', 'attire de 1 case (+1/NM) les victimes', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL52:BR54');
-- esprit-solide : effets « 3NM = Immunité au contrôle mental passif »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:esprit-solide', 'effets', 1, 'palier', '3NM = Immunité au contrôle mental passif', '3NM = Immunité au contrôle mental passif', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vide › AL55:BR57');
-- saccage-temporel : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:saccage-temporel', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL58:BR60');
-- mot-du-vide : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:mot-du-vide', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL61:BR63');
-- anti-magie : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:anti-magie', 'effets', 1, 'par_nm', '+1/NM', 'Pose la météo Zone Vide pendant 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL64:BR66');
-- metronome : effets « Les NM sont utiles pour le sort aléatoire »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:metronome', 'effets', 1, 'texte', 'Les NM sont utiles pour le sort aléatoire', 'Les NM sont utiles pour le sort aléatoire', NULL, NULL, NULL, NULL, 'magies', 'Magie Maverick V8 › Vide › AL67:BR69');
-- marteau-du-vide : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vide#sort:marteau-du-vide', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Vide › AL70:BR72');
-- tir-dame : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:tir-dame', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:tir-dame', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL4:BR6');
-- animation-de-mort : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:animation-de-mort', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL7:BR9');
-- mur-dos : zone « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:mur-dos', 'zone', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL10:BR12');
-- corruption-dame : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:corruption-dame', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL13:BR15');
-- detection-de-vie : cout « –1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:detection-de-vie', 'cout', 1, 'par_nm', '–1/NM', '–1/NM', '–1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL16:BR18');
-- forces-des-ames : type « IC pour 3 NM » ; portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forces-des-ames', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL19:BR21');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forces-des-ames', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL19:BR21');
-- pieu-dos : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:pieu-dos', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL22:BR24');
-- armure-dos : type « IC pour 3 NM » ; dsb « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:armure-dos', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL25:BR27');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:armure-dos', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL25:BR27');
-- detection-de-la-mort : cout « –1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:detection-de-la-mort', 'cout', 1, 'par_nm', '–1/NM', '–1/NM', '–1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL28:BR30');
-- fer-toxique : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:fer-toxique', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL31:BR33');
-- festin-des-ames : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:festin-des-ames', 'effets', 1, 'par_nm', '+1/NM', 'Dure 2 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL34:BR36');
-- poison-de-masse : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:poison-de-masse', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL37:BR39');
-- prison-dos : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:prison-dos', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL40:BR42');
-- forge-de-ses-morts : type « IC pour 3 NM » ; effets « +1 par NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL43:BR45');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:forge-de-ses-morts', 'effets', 1, 'par_nm', '+1 par NM', '1 seule utilisation (+1 par NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL43:BR45');
-- calin-putrefie : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:calin-putrefie', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL46:BR48');
-- amelioration-cadaverique : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:amelioration-cadaverique', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL49:BR51');
-- vague-de-cadavre : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:vague-de-cadavre', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL52:BR54');
-- grenade-caustique : effets « 3NM = Sauf alliés »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:grenade-caustique', 'effets', 1, 'palier', '3NM = Sauf alliés', 'Inflige Empoisonné stade 2 à toutes les cibles (3NM = Sauf alliés)', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Nécromancie › AL55:BR57');
-- cimetiere-ouvert : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:cimetiere-ouvert', 'effets', 1, 'par_nm', '+1/NM', 'Invoque la météo "Purée de poix" pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL58:BR60');
-- repar-os : dsb « +7/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:repar-os', 'dsb', 1, 'par_nm', '+7/NM', '+7/NM', '+7', 7, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL61:BR63');
-- dechirure : cout « -5/NM » ; dsb « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:dechirure', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL64:BR66');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:dechirure', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL64:BR66');
-- reanimation : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:reanimation', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL67:BR69');
-- resurrection-noir : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-necromancie#sort:resurrection-noir', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Nécromancie › AL70:BR72');
-- boule-de-feu : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:boule-de-feu', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:boule-de-feu', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL4:BR6');
-- cauterisation : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:cauterisation', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL7:BR9');
-- aura-chaude : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:aura-chaude', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL10:BR12');
-- detection-du-feu : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:detection-du-feu', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL13:BR15');
-- braise-magique : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:braise-magique', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL16:BR18');
-- fer-brulant : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:fer-brulant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL19:BR21');
-- etincelle : dsb « +1d4/NM » ; effets « au Niveau 3 de Maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:etincelle', 'dsb', 1, 'par_nm', '+1d4/NM', '+1d4/NM', '+1d4', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL22:BR24');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:etincelle', 'effets', 1, 'palier', 'au Niveau 3 de Maîtrise', 'Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise)', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL22:BR24');
-- regard-ardent : effets « 3 NM = Inflige brûlure stade 2 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:regard-ardent', 'effets', 1, 'palier', '3 NM = Inflige brûlure stade 2', '3 NM = Inflige brûlure stade 2', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL25:BR27');
-- fournaise : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:fournaise', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL28:BR30');
-- souffle-chaud : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:souffle-chaud', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL31:BR33');
-- mur-de-flammes : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:mur-de-flammes', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL34:BR36');
-- diffusion : zone « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:diffusion', 'zone', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL37:BR39');
-- marcheur-exalte : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:marcheur-exalte', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL40:BR42');
-- frappe-rageuse : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:frappe-rageuse', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL43:BR45');
-- bouclier-de-feu : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bouclier-de-feu', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL46:BR48');
-- bouffee-infernale : dsb « +6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bouffee-infernale', 'dsb', 1, 'par_nm', '+6/NM', '+6/NM', '+6', 6, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL49:BR51');
-- grenade-incendiaire : effets « à 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:grenade-incendiaire', 'effets', 1, 'palier', 'à 3NM', 'Oblige le jet de vigueur pour ne pas prendre brûlure 2 à 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Feu › AL52:BR54');
-- zenith : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:zenith', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL55:BR57');
-- rai-solaire : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:rai-solaire', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL58:BR60');
-- combustion-forte : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:combustion-forte', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL61:BR63');
-- pluie-chaude : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:pluie-chaude', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL64:BR66');
-- meteore-cramoisi : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:meteore-cramoisi', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL67:BR69');
-- bucher-purifiant : dsb « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-feu#sort:bucher-purifiant', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Feu › AL70:BR72');
-- bulle-deau : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre confusion 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:bulle-deau', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:bulle-deau', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre confusion 1', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre confusion 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL4:BR6');
-- tir-de-flotte : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:tir-de-flotte', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL7:BR9');
-- mucus-protecteur : dsb « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:mucus-protecteur', 'dsb', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL10:BR12');
-- eau-purifiante : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-purifiante', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL13:BR15');
-- eau-soignante : dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-soignante', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL16:BR18');
-- fer-humide : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:fer-humide', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL19:BR21');
-- souffle-hydraulique : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:souffle-hydraulique', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL22:BR24');
-- onde-confusion : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:onde-confusion', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL25:BR27');
-- barriere-deau : effets « +5% par Niveau de Maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:barriere-deau', 'effets', 1, 'par_nm', '+5% par Niveau de Maîtrise', 'Régénère 10% de la barrière (+5% par Niveau de Maîtrise)', '+5%', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL28:BR30');
-- ruisseau-conciliant : dsb « +6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:ruisseau-conciliant', 'dsb', 1, 'par_nm', '+6/NM', '+6/NM', '+6', 6, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL31:BR33');
-- trombe-deau : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:trombe-deau', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL34:BR36');
-- lame-sous-pression : zone « ou verticales/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:lame-sous-pression', 'zone', 1, 'palier', 'ou verticales/3NM', '3 cases horizontales devant (ou verticales/3NM)', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL37:BR39');
-- crachat-acide : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:crachat-acide', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL40:BR42');
-- courant-salvateur : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:courant-salvateur', 'effets', 1, 'par_nm', '+1/NM', 'déplacer les cibles dessus de 1(+1/NM) cases', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL43:BR45');
-- eau-parfaite : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:eau-parfaite', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL46:BR48');
-- fouet-deau : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:fouet-deau', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL49:BR51');
-- grenade-incapacitante : effets « 3NM = Si jet de fermeté raté = Inflige confus 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:grenade-incapacitante', 'effets', 1, 'palier', '3NM = Si jet de fermeté raté = Inflige confus 1', '3NM = Si jet de fermeté raté = Inflige confus 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL52:BR54');
-- dissolution : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:dissolution', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Eau › AL55:BR57');
-- crachin : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:crachin', 'effets', 1, 'par_nm', '+1/NM', 'pour 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL58:BR60');
-- cascade-apaisante : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:cascade-apaisante', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL61:BR63');
-- laser-hydraulique : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:laser-hydraulique', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL64:BR66');
-- larmes-doceane : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:larmes-doceane', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL67:BR69');
-- pitie-doceane : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-leau#sort:pitie-doceane', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Eau › AL70:BR72');
-- eclat-glace : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:eclat-glace', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:eclat-glace', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL4:BR6');
-- tir-de-givre : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:tir-de-givre', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL7:BR9');
-- sculpteur-glace : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:sculpteur-glace', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL10:BR12');
-- peau-verglacee : dsb « +1AM/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:peau-verglacee', 'dsb', 1, 'par_nm', '+1AM/NM', '+1AM/NM', '+1AM', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL13:BR15');
-- rafraichissement : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:rafraichissement', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL16:BR18');
-- fer-froid : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:fer-froid', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL19:BR21');
-- souffle-glacial : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:souffle-glacial', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL22:BR24');
-- cerveau-gele : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cerveau-gele', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL25:BR27');
-- lien-de-gel : remarque « 3NM = Inflige 4 dégâts perce AM lors du lien de gel »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:lien-de-gel', 'remarque', 1, 'palier', '3NM = Inflige 4 dégâts perce AM lors du lien de gel', '3NM = Inflige 4 dégâts perce AM lors du lien de gel', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL28:BR30');
-- cuirasse-arctique : dsb « +2AM/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cuirasse-arctique', 'dsb', 1, 'par_nm', '+2AM/NM', '+2AM/NM', '+2AM', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL31:BR33');
-- avalanche : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:avalanche', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL34:BR36');
-- stalactite : effets « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:stalactite', 'effets', 1, 'par_nm', '+2/NM', '+4 (+2/NM) dégâts quand il neige', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL37:BR39');
-- prison-boreale : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:prison-boreale', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL40:BR42');
-- gel-profond : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:gel-profond', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL43:BR45');
-- mur-de-glace : effets « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:mur-de-glace', 'effets', 1, 'par_nm', '+10/NM', 'Encaisse un total de 40 points de dégâts (+10/NM)', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL46:BR48');
-- lance-de-givre : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:lance-de-givre', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL49:BR51');
-- grenade-cryogenique : effets « Si jet de vigueur raté = Inflige gel 1/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:grenade-cryogenique', 'effets', 1, 'palier', 'Si jet de vigueur raté = Inflige gel 1/3NM', 'Si jet de vigueur raté = Inflige gel 1/3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL52:BR54');
-- danse-de-celsius : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:danse-de-celsius', 'effets', 1, 'par_nm', '+1/NM', 'pour 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL55:BR57');
-- cape-hivernale : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:cape-hivernale', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL58:BR60');
-- pergelisol : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:pergelisol', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Glace › AL61:BR63');
-- frappe-de-celsius : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:frappe-de-celsius', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL64:BR66');
-- execution-froide : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:execution-froide', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL67:BR69');
-- rayon-polaire : dsb « +10/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-glace#sort:rayon-polaire', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Glace › AL70:BR72');
-- lance-pierre : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:lance-pierre', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:lance-pierre', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL4:BR6');
-- tremblement : portee « +1/NM » ; dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:tremblement', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL7:BR9');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:tremblement', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL7:BR9');
-- peau-de-pierre : dsb « +1AP/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:peau-de-pierre', 'dsb', 1, 'par_nm', '+1AP/NM', '+1AP/NM', '+1AP', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL10:BR12');
-- appel-aux-golems : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:appel-aux-golems', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL13:BR15');
-- racine-soignante : dsb « +1d6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:racine-soignante', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL16:BR18');
-- explosion-rocheuse : portee « +1/NM » ; dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:explosion-rocheuse', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL19:BR21');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:explosion-rocheuse', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL19:BR21');
-- fer-raffine : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:fer-raffine', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL22:BR24');
-- arbre-fertilisant : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:arbre-fertilisant', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL25:BR27');
-- infection : type « IC pour 3 NM » ; dsb « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:infection', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL28:BR30');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:infection', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL28:BR30');
-- cuirasse-de-roche : dsb « +2AP/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:cuirasse-de-roche', 'dsb', 1, 'par_nm', '+2AP/NM', '+2AP/NM', '+2AP', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL31:BR33');
-- barriere-rocheuse : effets « +7/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:barriere-rocheuse', 'effets', 1, 'par_nm', '+7/NM', 'encaisse les coups inférieurs à 20 dégâts (+7/NM)', '+7', 7, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL34:BR36');
-- alourdissement : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:alourdissement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL37:BR39');
-- sable-changeant : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:sable-changeant', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL40:BR42');
-- frappe-racine : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:frappe-racine', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL43:BR45');
-- enracinement : zone « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:enracinement', 'zone', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL46:BR48');
-- rouille : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:rouille', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL49:BR51');
-- grenade-petrifiante : effets « 3NM = Si jet de vigueur raté = Inflige pétrifié 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:grenade-petrifiante', 'effets', 1, 'palier', '3NM = Si jet de vigueur raté = Inflige pétrifié 1', '3NM = Si jet de vigueur raté = Inflige pétrifié 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL52:BR54');
-- anti-mythril : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:anti-mythril', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Terre › AL55:BR57');
-- redemption-de-dimitri : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:redemption-de-dimitri', 'effets', 1, 'par_nm', '+1/NM', 'pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL58:BR60');
-- floraison-salvatrice : dsb « +1d/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:floraison-salvatrice', 'dsb', 1, 'par_nm', '+1d/NM', '+1d/NM', '+1d', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL61:BR63');
-- terre-maudite : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:terre-maudite', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL64:BR66');
-- morsure-terrestre : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:morsure-terrestre', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL67:BR69');
-- corps-de-maverium : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-terre#sort:corps-de-maverium', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Terre › AL70:BR72');
-- lame-dair : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre surdité 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:lame-dair', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:lame-dair', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre surdité 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre surdité 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vent › AL4:BR6');
-- vent-couteau : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vent-couteau', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL7:BR9');
-- vents-murmures : effets « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vents-murmures', 'effets', 1, 'par_nm', '+2/NM', 'Envoie un court message de 8 mots (+2/NM) maximum', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL10:BR12');
-- force-agile : effets « 1NM = +3 dégâts »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:force-agile', 'effets', 1, 'palier', '1NM = +3 dégâts', '1NM = +3 dégâts', NULL, NULL, NULL, 1, 'magies', 'Magie Maverick V8 › Vent › AL13:BR15');
-- propulsion : portee « +2 / NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:propulsion', 'portee', 1, 'par_nm', '+2 / NM', '+2 / NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL16:BR18');
-- cri-faible : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:cri-faible', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL19:BR21');
-- eternuement : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:eternuement', 'effets', 1, 'par_nm', '+1/NM', 'permet de le faire reculer d''une case (+1/NM) en arrière', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL22:BR24');
-- fer-eolien : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:fer-eolien', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vent › AL25:BR27');
-- feuille-morte : portee « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:feuille-morte', 'portee', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL28:BR30');
-- recul-force : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:recul-force', 'effets', 1, 'par_nm', '+1/NM', 'Fait reculer la cible de 1 case (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL31:BR33');
-- estoc-hurlante : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:estoc-hurlante', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL34:BR36');
-- bourrasque : dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:bourrasque', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL37:BR39');
-- desarmer : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:desarmer', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL40:BR42');
-- tornade : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tornade', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL43:BR45');
-- vent-changeant : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vent-changeant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vent › AL46:BR48');
-- grenade-explosive : effets « +1d6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:grenade-explosive', 'effets', 1, 'par_nm', '+1d6/NM', 'Inflige 2d6 dégâts (+1d6/NM) supplémentaires en intérieur', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL49:BR51');
-- vibration : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:vibration', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL52:BR54');
-- allegement : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:allegement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Vent › AL55:BR57');
-- grande-vitesse : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:grande-vitesse', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL58:BR60');
-- tempete : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:tempete', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL61:BR63');
-- danse-de-lair : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:danse-de-lair', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL64:BR66');
-- explosif : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:explosif', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL67:BR69');
-- megaphone : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-du-vent#sort:megaphone', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Vent › AL70:BR72');
-- eclair : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre paralysie 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:eclair', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:eclair', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre paralysie 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre paralysie 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL4:BR6');
-- contact-de-volt : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:contact-de-volt', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL7:BR9');
-- affutage : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:affutage', 'effets', 1, 'par_nm', '+1/NM', 'augmenter la réussite critique de 2% (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL10:BR12');
-- nerveux : type « IC pour 3 NM » ; dsb « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:nerveux', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL13:BR15');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:nerveux', 'dsb', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL13:BR15');
-- tazeur : dsb « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:tazeur', 'dsb', 1, 'par_nm', '+2/NM', '+2/NM', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL16:BR18');
-- fer-foudroyant : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:fer-foudroyant', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL19:BR21');
-- reflexe-eclair : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:reflexe-eclair', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL22:BR24');
-- colonne-tesla : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:colonne-tesla', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL25:BR27');
-- chargeur : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:chargeur', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL28:BR30');
-- souffle-electrique : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:souffle-electrique', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL31:BR33');
-- boules-de-foudre : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:boules-de-foudre', 'effets', 1, 'par_nm', '+1/NM', '1 boule (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL34:BR36');
-- foudre-rouge : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:foudre-rouge', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL37:BR39');
-- plaque-miroir : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:plaque-miroir', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL40:BR42');
-- dysfonctionnement : type « IC pour 3 NM » ; effets « +1 tour/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:dysfonctionnement', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL43:BR45');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:dysfonctionnement', 'effets', 1, 'par_nm', '+1 tour/NM', 'agit de manière incohérente pendant 1 tour (+1 tour/NM)', '+1 tour', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL43:BR45');
-- vitesse-ampere : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:vitesse-ampere', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL46:BR48');
-- eclair-en-chaine : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:eclair-en-chaine', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL49:BR51');
-- colere-de-volt : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:colere-de-volt', 'effets', 1, 'par_nm', '+1/NM', 'Invoque l''orage pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL52:BR54');
-- grenade-paralysante : effets « 3NM = Si jet de vigueur raté = Inflige paralysie 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:grenade-paralysante', 'effets', 1, 'palier', '3NM = Si jet de vigueur raté = Inflige paralysie 1', '3NM = Si jet de vigueur raté = Inflige paralysie 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL55:BR57');
-- armure-conductrice : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:armure-conductrice', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Foudre › AL58:BR60');
-- cercle-electrique : dsb « +7/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:cercle-electrique', 'dsb', 1, 'par_nm', '+7/NM', '+7/NM', '+7', 7, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL61:BR63');
-- orage-violet : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:orage-violet', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL64:BR66');
-- fulguration : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:fulguration', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL67:BR69');
-- manteau-de-volt : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-foudre#sort:manteau-de-volt', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Foudre › AL70:BR72');
-- frappe-lumineuse : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre aveuglement 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:frappe-lumineuse', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:frappe-lumineuse', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre aveuglement 1', '3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre aveuglement 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL4:BR6');
-- inspiration-celeste : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:inspiration-celeste', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL7:BR9');
-- champ-de-force : effets « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:champ-de-force', 'effets', 1, 'par_nm', '+5/NM', 'Bloque 10 dégâts (+5/NM)', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL10:BR12');
-- vitamine : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:vitamine', 'effets', 1, 'par_nm', '+1/NM', 'Permet d''infliger un bonus de +2 (+1/NM) dégâts pendant 2 tours', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL13:BR15');
-- premier-soin : dsb « +1d6/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:premier-soin', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL16:BR18');
-- fer-lumineux : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:fer-lumineux', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL19:BR21');
-- benediction : dsb « +1d/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:benediction', 'dsb', 1, 'par_nm', '+1d/3NM', '+1d/3NM', '+1d', NULL, 3, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL22:BR24');
-- energie-solaire : zone « 3NM = Croix 1x1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:energie-solaire', 'zone', 1, 'palier', '3NM = Croix 1x1', '3NM = Croix 1x1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL25:BR27');
-- panneau-solaire : effets « 3NM permet de le faire sur 2 alliés »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:panneau-solaire', 'effets', 1, 'palier', '3NM permet de le faire sur 2 alliés', 'Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés)', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL28:BR30');
-- flash : portee « +1/NM » ; dsb « +5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:flash', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL31:BR33');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:flash', 'dsb', 1, 'par_nm', '+5/NM', '+5/NM', '+5', 5, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL31:BR33');
-- photon : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:photon', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL34:BR36');
-- recouvrer : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:recouvrer', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL37:BR39');
-- rayon-daurora : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:rayon-daurora', 'effets', 1, 'par_nm', '+1/NM', 'Invoque le grand soleil pendant 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL40:BR42');
-- croisade-lumineuse : effets « si 3 niveaux de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:croisade-lumineuse', 'effets', 1, 'palier', 'si 3 niveaux de maîtrise', '2 boosts si 3 niveaux de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL43:BR45');
-- operation : dsb « +10/NM » ; effets « 3 NM = Soigne une croix en carac »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:operation', 'dsb', 1, 'par_nm', '+10/NM', '+10/NM', '+10', 10, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL46:BR48');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:operation', 'effets', 1, 'palier', '3 NM = Soigne une croix en carac', '3 NM = Soigne une croix en carac', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL46:BR48');
-- explosion-glorifique : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:explosion-glorifique', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL49:BR51');
-- regeneration : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:regeneration', 'effets', 1, 'par_nm', '+1/NM', 'Dure 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL52:BR54');
-- grenade-flash : effets « 3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:grenade-flash', 'effets', 1, 'palier', '3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1', '3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Lumière › AL55:BR57');
-- poussiere-detoile : portee « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:poussiere-detoile', 'portee', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL58:BR60');
-- cercle-de-soin : zone « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:cercle-de-soin', 'zone', 1, 'par_nm', '+1/NM', '+1/NM', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL61:BR63');
-- resurrection : dsb « +12/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:resurrection', 'dsb', 1, 'par_nm', '+12/NM', '+12/NM', '+12', 12, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL64:BR66');
-- lance-sacree : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:lance-sacree', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL67:BR69');
-- louange-daurora : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-la-lumiere#sort:louange-daurora', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Lumière › AL70:BR72');
-- sphere-obscure : dsb « +1d6/NM » ; effets « 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre peur 1 »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:sphere-obscure', 'dsb', 1, 'par_nm', '+1d6/NM', '+1d6/NM', '+1d6', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL4:BR6');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:sphere-obscure', 'effets', 1, 'palier', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre peur 1', '3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre peur 1', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL4:BR6');
-- perturbation : effets « -10%/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:perturbation', 'effets', 1, 'par_nm', '-10%/NM', 'Si jet de fermeté raté = -10% (-10%/NM) à sa prochaine action', '-10%', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL7:BR9');
-- marionnette-de-lombre : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marionnette-de-lombre', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL10:BR12');
-- brume-mental : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:brume-mental', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL13:BR15');
-- pichenette : effets « +2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:pichenette', 'effets', 1, 'par_nm', '+2/NM', 'Réduit de 5 l''initiative de l’adversaire pour le prochain tour. (+2/NM)', '+2', 2, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL16:BR18');
-- cri-ebranleur : dsb « +3/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:cri-ebranleur', 'dsb', 1, 'par_nm', '+3/NM', '+3/NM', '+3', 3, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL19:BR21');
-- manteau-noir : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:manteau-noir', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL22:BR24');
-- lame-dombre : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:lame-dombre', 'effets', 1, 'par_nm', '+1/NM', 'Créer 1 (+1/NM) lame(s)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL25:BR27');
-- malediction : dsb « -1d/3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:malediction', 'dsb', 1, 'par_nm', '-1d/3NM', '-1d/3NM', '-1d', NULL, 3, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL28:BR30');
-- fer-obscur : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:fer-obscur', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL31:BR33');
-- brouillard-obscur : effets « +1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:brouillard-obscur', 'effets', 1, 'par_nm', '+1/NM', 'Invoque le brouillard obscur pour 3 tours (+1/NM)', '+1', 1, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL34:BR36');
-- javelot-sombre : cout « -1/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:javelot-sombre', 'cout', 1, 'par_nm', '-1/NM', '-1/NM', '-1', -1, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL37:BR39');
-- amplification-sombre : type « IC x 2 si 3NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:amplification-sombre', 'type', 1, 'palier', 'IC x 2 si 3NM', 'IC x 2 si 3NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL40:BR42');
-- marque-suintante : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:marque-suintante', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL43:BR45');
-- ombre-menacante : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:ombre-menacante', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL46:BR48');
-- rayon-negatif : cout « -2/NM » ; dsb « +4/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL49:BR51');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:rayon-negatif', 'dsb', 1, 'par_nm', '+4/NM', '+4/NM', '+4', 4, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL49:BR51');
-- grenade-fumigene : effets « -10%/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:grenade-fumigene', 'effets', 1, 'par_nm', '-10%/NM', 'Malus de 25% pour tous les jets pour 1 tour (-10%/NM)', '-10%', NULL, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL52:BR54');
-- defaite-annoncee : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:defaite-annoncee', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL55:BR57');
-- goudron : cout « -2/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:goudron', 'cout', 1, 'par_nm', '-2/NM', '-2/NM', '-2', -2, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL58:BR60');
-- pire-ami : type « IC pour 3 NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:pire-ami', 'type', 1, 'palier', 'IC pour 3 NM', 'IC pour 3 NM', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL61:BR63');
-- chaine-de-lentrave : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:chaine-de-lentrave', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL64:BR66');
-- armee-de-lombre : cout « -5/NM » ; effets « au niveau 3 de maîtrise »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:armee-de-lombre', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL67:BR69');
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:armee-de-lombre', 'effets', 1, 'palier', 'au niveau 3 de maîtrise', 'Ignore l''esquive/parade partielle au niveau 3 de maîtrise', NULL, NULL, NULL, 3, 'magies', 'Magie Maverick V8 › Ombre › AL67:BR69');
-- frappe-negative : cout « -5/NM »
INSERT INTO sort_bonus_maitrise (sort_id, champ, rang, nature, texte_brut, contexte, increment_brut, increment_entier, pas_nm, seuil_nm, origine, source_ref) VALUES ('magies/magie-de-lombre#sort:frappe-negative', 'cout', 1, 'par_nm', '-5/NM', '-5/NM', '-5', -5, 1, NULL, 'magies', 'Magie Maverick V8 › Ombre › AL70:BR72');

-- Colonnes de la table des sorts : mode (texte entre parenthèses du type) et bonus de maîtrise (lignes de sort_bonus_maitrise)
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort SET mode_brut = 'Inesquivable' WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire';
UPDATE sort SET mode_brut = 'IC pour 3NM' WHERE id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:nerveux';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort SET mode_brut = 'IC x 3' WHERE id = 'magies/magie-de-la-foudre#sort:chargeur';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
UPDATE sort SET mode_brut = 'Inesquivable' WHERE id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort SET mode_brut = 'Inesquivable' WHERE id = 'magies/magie-de-la-glace#sort:lance-de-givre';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:cape-hivernale';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-lumiere#sort:vitamine';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-lumiere#sort:benediction';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:infection';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:alourdissement';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:anti-mythril';
UPDATE sort SET mode_brut = 'Inesquivable' WHERE id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort SET mode_brut = 'IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-larcane#sort:forge-magie';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-larcane#sort:vision-magique';
UPDATE sort SET mode_brut = 'IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
UPDATE sort SET mode_brut = 'IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:peau-de-chakra';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-larcane#sort:miroir-magique';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:eau-purifiante';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:eau-parfaite';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort SET mode_brut = 'IC x 2' WHERE id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lespace-temps#sort:ralentissement';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
UPDATE sort SET mode_brut = 'Imparable/ Inesquivable' WHERE id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:celerite';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:double-action';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort SET mode_brut = 'Imparable/ Inesquivable' WHERE id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lombre#sort:pichenette';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-de-lombre#sort:malediction';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort SET mode_brut = 'IC
IC x 2 si 3NM' WHERE id = 'magies/magie-de-lombre#sort:amplification-sombre';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:pire-ami';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:fer-brulant';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-feu#sort:mur-de-flammes';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-sang#sort:marquage';
UPDATE sort SET mode_brut = 'IC
IC x 2 si 3NM' WHERE id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-durci';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-garde';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-magie';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-gain';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:douleur-partagee';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-sang#sort:autel-sanglant';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-vent#sort:feuille-morte';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-vent#sort:recul-force';
UPDATE sort SET mode_brut = 'Inesquivable/ Imparable' WHERE id = 'magies/magie-du-vent#sort:tornade';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-vent#sort:vibration';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:allegement';
UPDATE sort SET mode_brut = 'Inesquivable' WHERE id = 'magies/magie-du-vent#sort:explosif';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-vent#sort:megaphone';
UPDATE sort SET mode_brut = 'IC pour 3NM' WHERE id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort SET mode_brut = 'Imparable' WHERE id = 'magies/magie-du-vide#sort:pression';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:injonction-du-vide';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort SET mode_brut = 'IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:lien-mental';
UPDATE sort SET mode_brut = 'IC' WHERE id = 'magies/magie-du-vide#sort:esprit-solide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre saignement 1' WHERE id = 'magies/magie-du-sang#sort:boule-de-sang';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-du-sang#sort:clou';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d/3NM' WHERE id = 'magies/magie-du-sang#sort:marquage';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = que négatif pour allié, que positif pour ennemi' WHERE id = 'magies/magie-du-sang#sort:annulation';
UPDATE sort SET bonus_maitrise = 'Type : IC x 2 si 3NM' WHERE id = 'magies/magie-du-sang#sort:attirance';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-durci';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:fer-sanglant';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-garde';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-magie';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:sang-gain';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-sang#sort:saignee-forcee';
UPDATE sort SET bonus_maitrise = 'Effets : 50% au niveau 3 de maîtrise' WHERE id = 'magies/magie-du-sang#sort:morsure-aspirante';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-sang#sort:coagulation';
UPDATE sort SET bonus_maitrise = 'D/S/B : +4/NM' WHERE id = 'magies/magie-du-sang#sort:renfermement';
UPDATE sort SET bonus_maitrise = 'D/S/B : x4/3NM' WHERE id = 'magies/magie-du-sang#sort:deflagration-sanguine';
UPDATE sort SET bonus_maitrise = 'Effets : pas de contrecoup au niveau 3 de maîtrise' WHERE id = 'magies/magie-du-sang#sort:damocles';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-sang#sort:douleur-partagee';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Si jet de vigueur raté = Inflige saignement stade 2' WHERE id = 'magies/magie-du-sang#sort:grenade-a-clous';
UPDATE sort SET bonus_maitrise = 'D/S/B : +5/NM' WHERE id = 'magies/magie-du-sang#sort:autel-sanglant';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1/NM' WHERE id = 'magies/magie-du-sang#sort:perfusion';
UPDATE sort SET bonus_maitrise = 'Effets : dure 2 tours (+1/NM)' WHERE id = 'magies/magie-du-sang#sort:sang-perfection';
UPDATE sort SET bonus_maitrise = 'Effets : +15 (+5/NM) aux dégâts physiques' WHERE id = 'magies/magie-du-sang#sort:proportion-demesuree';
UPDATE sort SET bonus_maitrise = 'Effets : Garde 1 santé à 3NM' WHERE id = 'magies/magie-du-sang#sort:sacrifice';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre surcharge magique 1' WHERE id = 'magies/magie-de-larcane#sort:boule-de-chakra';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-larcane#sort:charge-denergie';
UPDATE sort SET bonus_maitrise = 'Type : IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:rune-arcane';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
D/S/B : +1/NM' WHERE id = 'magies/magie-de-larcane#sort:claquement';
UPDATE sort SET bonus_maitrise = 'Effets : Permet de créer une catégorie d''arme à usage unique à l''aide de chakra pur. (+1 utilisation/NM)' WHERE id = 'magies/magie-de-larcane#sort:forge-magie';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-larcane#sort:souffle-magique';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM
Effets : 2CK = 1BA (3CK = 2BA/3NM)' WHERE id = 'magies/magie-de-larcane#sort:echange';
UPDATE sort SET bonus_maitrise = 'D/S/B : +5/NM' WHERE id = 'magies/magie-de-larcane#sort:vague-deferlante';
UPDATE sort SET bonus_maitrise = 'Effets : Bloque 40 (+10/NM) dégâts par tour pendant 3 tours' WHERE id = 'magies/magie-de-larcane#sort:mur-de-chakra';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-larcane#sort:laser-de-chakra';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-larcane#sort:pillage-defensif';
UPDATE sort SET bonus_maitrise = 'Type : IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:rune-arcane-multiple';
UPDATE sort SET bonus_maitrise = 'Effets : 3 NM = les dégâts ignorent les AM' WHERE id = 'magies/magie-de-larcane#sort:champ-gardien';
UPDATE sort SET bonus_maitrise = 'Type : IC x 1/NM' WHERE id = 'magies/magie-de-larcane#sort:peau-de-chakra';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-larcane#sort:pluie-de-chakra';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-larcane#sort:grenade-de-chakra';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
Effets : 3 NM = Ne prend plus l''effet en question' WHERE id = 'magies/magie-de-larcane#sort:miroir-magique';
UPDATE sort SET bonus_maitrise = 'D/S/B : +10/NM' WHERE id = 'magies/magie-de-larcane#sort:foudre-argente';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d/3NM' WHERE id = 'magies/magie-de-larcane#sort:drain-denergie';
UPDATE sort SET bonus_maitrise = 'Effets : Le coût en santé passe à 10% si 3NM' WHERE id = 'magies/magie-de-larcane#sort:voile-chakratique';
UPDATE sort SET bonus_maitrise = 'Effets : 2CK (1CK/3NM) = 1 dégâts' WHERE id = 'magies/magie-de-larcane#sort:planete-chakratique';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM' WHERE id = 'magies/magie-de-la-corruption#sort:boule-sombre';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-de-la-corruption#sort:tir-dhuile';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-simple';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-corruption#sort:verrouille-visible';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d/NM' WHERE id = 'magies/magie-de-la-corruption#sort:retrait';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:fer-corrompu';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-corruption#sort:souffle-noir';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:petrole';
UPDATE sort SET bonus_maitrise = 'D/S/B : +5/NM' WHERE id = 'magies/magie-de-la-corruption#sort:vague-deferlante';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-corruption#sort:mine-noire';
UPDATE sort SET bonus_maitrise = 'Effets : Augmente la réussite critique de 1%/NM' WHERE id = 'magies/magie-de-la-corruption#sort:laser-noir';
UPDATE sort SET bonus_maitrise = 'Effets : Inflige 3 (+2/NM) corruption' WHERE id = 'magies/magie-de-la-corruption#sort:fouet-tenebreux';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3NM' WHERE id = 'magies/magie-de-la-corruption#sort:plaie-suintante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-corruption#sort:aura-de-frayeur';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = La grenade colle la cible' WHERE id = 'magies/magie-de-la-corruption#sort:grenade-collante';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-magique';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-physique';
UPDATE sort SET bonus_maitrise = 'Effets : Pose la météo "Pluie pétrole" pendant 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-corruption#sort:pluie-huileuse';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-corruption#sort:une-tu-meurs';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-corruption#sort:sapeur';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-corruption#sort:eau-noire';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre fatigue 1' WHERE id = 'magies/magie-de-lespace-temps#sort:coup-du-sablier';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:teleportation';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:portail';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:substitution';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:chute';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:fer-temporel';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:faille-temporelle';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:ralentissement';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:inversion';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM
D/S/B : +3/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:frappe-temporelle';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:etat-anterieur';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:tranche-temps';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:vieillissement';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Pas de dégâts alliés' WHERE id = 'magies/magie-de-lespace-temps#sort:portail-piege';
UPDATE sort SET bonus_maitrise = 'Effets : 50% au niveau 3 de maîtrise' WHERE id = 'magies/magie-de-lespace-temps#sort:horloge-aspirante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:celerite';
UPDATE sort SET bonus_maitrise = 'Zone : +1/3NM' WHERE id = 'magies/magie-de-lespace-temps#sort:grenade-distordue';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lespace-temps#sort:double-action';
UPDATE sort SET bonus_maitrise = 'Portée : +20/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:teleport-parfait';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
Effets : Invoque 1 ou 2 clones (+1/NM)' WHERE id = 'magies/magie-de-lespace-temps#sort:image-diffuse';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:trou-noir';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:premonition';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-lespace-temps#sort:distorsion';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre enragé 1' WHERE id = 'magies/magie-du-vide#sort:bulle-de-vide';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3NM
Effets : Permet au niveau 3 de maîtrise de soulever un objet et l''envoyer dans le même tour' WHERE id = 'magies/magie-du-vide#sort:telekinesie';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vide#sort:silence';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-du-vide#sort:pression';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:injonction-du-vide';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:fer-vide';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-du-vide#sort:bisou-du-vide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-vide#sort:poing-du-vide';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vide#sort:lien-mental';
UPDATE sort SET bonus_maitrise = 'Effets : Un allié perd le négatif et un ennemi le positif pour 3NM' WHERE id = 'magies/magie-du-vide#sort:dissipation';
UPDATE sort SET bonus_maitrise = 'D/S/B : +6/NM' WHERE id = 'magies/magie-du-vide#sort:sablier-du-vide';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vide#sort:invisibilite';
UPDATE sort SET bonus_maitrise = 'Effets : Ignore les AM et BA pour 3NM' WHERE id = 'magies/magie-du-vide#sort:lame-du-vide';
UPDATE sort SET bonus_maitrise = 'Effets : Rend le lanceur intangible pour une attaque (+1/NM)' WHERE id = 'magies/magie-du-vide#sort:aspect-vide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +6/NM' WHERE id = 'magies/magie-du-vide#sort:touche-du-vide';
UPDATE sort SET bonus_maitrise = 'Remarque : 3NM = les altérations d''états sont 1 cran au-dessus et les croix durent 1 tour de plus' WHERE id = 'magies/magie-du-vide#sort:alea-negatif';
UPDATE sort SET bonus_maitrise = 'Effets : attire de 1 case (+1/NM) les victimes' WHERE id = 'magies/magie-du-vide#sort:grenade-implosive';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Immunité au contrôle mental passif' WHERE id = 'magies/magie-du-vide#sort:esprit-solide';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-vide#sort:saccage-temporel';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vide#sort:mot-du-vide';
UPDATE sort SET bonus_maitrise = 'Effets : Pose la météo Zone Vide pendant 2 tours (+1/NM)' WHERE id = 'magies/magie-du-vide#sort:anti-magie';
UPDATE sort SET bonus_maitrise = 'Effets : Les NM sont utiles pour le sort aléatoire' WHERE id = 'magies/magie-du-vide#sort:metronome';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-du-vide#sort:marteau-du-vide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre poison 1' WHERE id = 'magies/magie-de-la-necromancie#sort:tir-dame';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:animation-de-mort';
UPDATE sort SET bonus_maitrise = 'Zone : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:mur-dos';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:corruption-dame';
UPDATE sort SET bonus_maitrise = 'Coût : –1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-vie';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:forces-des-ames';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:pieu-dos';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
D/S/B : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:armure-dos';
UPDATE sort SET bonus_maitrise = 'Coût : –1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:detection-de-la-mort';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-necromancie#sort:fer-toxique';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 2 tours (+1/NM)' WHERE id = 'magies/magie-de-la-necromancie#sort:festin-des-ames';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:poison-de-masse';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:prison-dos';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
Effets : 1 seule utilisation (+1 par NM)' WHERE id = 'magies/magie-de-la-necromancie#sort:forge-de-ses-morts';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:calin-putrefie';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:vague-de-cadavre';
UPDATE sort SET bonus_maitrise = 'Effets : Inflige Empoisonné stade 2 à toutes les cibles (3NM = Sauf alliés)' WHERE id = 'magies/magie-de-la-necromancie#sort:grenade-caustique';
UPDATE sort SET bonus_maitrise = 'Effets : Invoque la météo "Purée de poix" pendant 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-necromancie#sort:cimetiere-ouvert';
UPDATE sort SET bonus_maitrise = 'D/S/B : +7/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:repar-os';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM
D/S/B : +10/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:dechirure';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:reanimation';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-la-necromancie#sort:resurrection-noir';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1' WHERE id = 'magies/magie-du-feu#sort:boule-de-feu';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:cauterisation';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:aura-chaude';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-du-feu#sort:detection-du-feu';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-du-feu#sort:braise-magique';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-feu#sort:fer-brulant';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d4/NM
Effets : Inflige 2d6 de contrecoup (-1d6 au Niveau 3 de Maîtrise)' WHERE id = 'magies/magie-du-feu#sort:etincelle';
UPDATE sort SET bonus_maitrise = 'Effets : 3 NM = Inflige brûlure stade 2' WHERE id = 'magies/magie-du-feu#sort:regard-ardent';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-feu#sort:fournaise';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-feu#sort:souffle-chaud';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-feu#sort:mur-de-flammes';
UPDATE sort SET bonus_maitrise = 'Zone : +1/NM' WHERE id = 'magies/magie-du-feu#sort:diffusion';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-feu#sort:marcheur-exalte';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-feu#sort:frappe-rageuse';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-feu#sort:bouclier-de-feu';
UPDATE sort SET bonus_maitrise = 'D/S/B : +6/NM' WHERE id = 'magies/magie-du-feu#sort:bouffee-infernale';
UPDATE sort SET bonus_maitrise = 'Effets : Oblige le jet de vigueur pour ne pas prendre brûlure 2 à 3NM' WHERE id = 'magies/magie-du-feu#sort:grenade-incendiaire';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-feu#sort:zenith';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-feu#sort:rai-solaire';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-feu#sort:combustion-forte';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-feu#sort:pluie-chaude';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-du-feu#sort:meteore-cramoisi';
UPDATE sort SET bonus_maitrise = 'D/S/B : +10/NM' WHERE id = 'magies/magie-du-feu#sort:bucher-purifiant';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre confusion 1' WHERE id = 'magies/magie-de-leau#sort:bulle-deau';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-de-leau#sort:tir-de-flotte';
UPDATE sort SET bonus_maitrise = 'D/S/B : -2/NM' WHERE id = 'magies/magie-de-leau#sort:mucus-protecteur';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:eau-purifiante';
UPDATE sort SET bonus_maitrise = 'D/S/B : +5/NM' WHERE id = 'magies/magie-de-leau#sort:eau-soignante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:fer-humide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-leau#sort:souffle-hydraulique';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:onde-confusion';
UPDATE sort SET bonus_maitrise = 'Effets : Régénère 10% de la barrière (+5% par Niveau de Maîtrise)' WHERE id = 'magies/magie-de-leau#sort:barriere-deau';
UPDATE sort SET bonus_maitrise = 'D/S/B : +6/NM' WHERE id = 'magies/magie-de-leau#sort:ruisseau-conciliant';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-leau#sort:trombe-deau';
UPDATE sort SET bonus_maitrise = 'Zone : 3 cases horizontales devant (ou verticales/3NM)' WHERE id = 'magies/magie-de-leau#sort:lame-sous-pression';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-leau#sort:crachat-acide';
UPDATE sort SET bonus_maitrise = 'Effets : déplacer les cibles dessus de 1(+1/NM) cases' WHERE id = 'magies/magie-de-leau#sort:courant-salvateur';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:eau-parfaite';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-de-leau#sort:fouet-deau';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Si jet de fermeté raté = Inflige confus 1' WHERE id = 'magies/magie-de-leau#sort:grenade-incapacitante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-leau#sort:dissolution';
UPDATE sort SET bonus_maitrise = 'Effets : pour 3 tours (+1/NM)' WHERE id = 'magies/magie-de-leau#sort:crachin';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-leau#sort:cascade-apaisante';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-leau#sort:laser-hydraulique';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-leau#sort:larmes-doceane';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-leau#sort:pitie-doceane';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre gel 1' WHERE id = 'magies/magie-de-la-glace#sort:eclat-glace';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-glace#sort:tir-de-givre';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:sculpteur-glace';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1AM/NM' WHERE id = 'magies/magie-de-la-glace#sort:peau-verglacee';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-glace#sort:rafraichissement';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:fer-froid';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-glace#sort:souffle-glacial';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:cerveau-gele';
UPDATE sort SET bonus_maitrise = 'Remarque : 3NM = Inflige 4 dégâts perce AM lors du lien de gel' WHERE id = 'magies/magie-de-la-glace#sort:lien-de-gel';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2AM/NM' WHERE id = 'magies/magie-de-la-glace#sort:cuirasse-arctique';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-glace#sort:avalanche';
UPDATE sort SET bonus_maitrise = 'Effets : +4 (+2/NM) dégâts quand il neige' WHERE id = 'magies/magie-de-la-glace#sort:stalactite';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-la-glace#sort:prison-boreale';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-glace#sort:gel-profond';
UPDATE sort SET bonus_maitrise = 'Effets : Encaisse un total de 40 points de dégâts (+10/NM)' WHERE id = 'magies/magie-de-la-glace#sort:mur-de-glace';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-la-glace#sort:lance-de-givre';
UPDATE sort SET bonus_maitrise = 'Effets : Si jet de vigueur raté = Inflige gel 1/3NM' WHERE id = 'magies/magie-de-la-glace#sort:grenade-cryogenique';
UPDATE sort SET bonus_maitrise = 'Effets : pour 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-glace#sort:danse-de-celsius';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:cape-hivernale';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-glace#sort:pergelisol';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-glace#sort:frappe-de-celsius';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-glace#sort:execution-froide';
UPDATE sort SET bonus_maitrise = 'D/S/B : +10/NM' WHERE id = 'magies/magie-de-la-glace#sort:rayon-polaire';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre pétrifié 1' WHERE id = 'magies/magie-de-la-terre#sort:lance-pierre';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM
D/S/B : +2/NM' WHERE id = 'magies/magie-de-la-terre#sort:tremblement';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1AP/NM' WHERE id = 'magies/magie-de-la-terre#sort:peau-de-pierre';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:appel-aux-golems';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM' WHERE id = 'magies/magie-de-la-terre#sort:racine-soignante';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM
D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-terre#sort:explosion-rocheuse';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:fer-raffine';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-de-la-terre#sort:arbre-fertilisant';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
D/S/B : +1/NM' WHERE id = 'magies/magie-de-la-terre#sort:infection';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2AP/NM' WHERE id = 'magies/magie-de-la-terre#sort:cuirasse-de-roche';
UPDATE sort SET bonus_maitrise = 'Effets : encaisse les coups inférieurs à 20 dégâts (+7/NM)' WHERE id = 'magies/magie-de-la-terre#sort:barriere-rocheuse';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:alourdissement';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-de-la-terre#sort:sable-changeant';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-terre#sort:frappe-racine';
UPDATE sort SET bonus_maitrise = 'Zone : +1/NM' WHERE id = 'magies/magie-de-la-terre#sort:enracinement';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-terre#sort:rouille';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Si jet de vigueur raté = Inflige pétrifié 1' WHERE id = 'magies/magie-de-la-terre#sort:grenade-petrifiante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-terre#sort:anti-mythril';
UPDATE sort SET bonus_maitrise = 'Effets : pendant 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-terre#sort:redemption-de-dimitri';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d/NM' WHERE id = 'magies/magie-de-la-terre#sort:floraison-salvatrice';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-terre#sort:terre-maudite';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-terre#sort:morsure-terrestre';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-terre#sort:corps-de-maverium';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre surdité 1' WHERE id = 'magies/magie-du-vent#sort:lame-dair';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-vent#sort:vent-couteau';
UPDATE sort SET bonus_maitrise = 'Effets : Envoie un court message de 8 mots (+2/NM) maximum' WHERE id = 'magies/magie-du-vent#sort:vents-murmures';
UPDATE sort SET bonus_maitrise = 'Effets : 1NM = +3 dégâts' WHERE id = 'magies/magie-du-vent#sort:force-agile';
UPDATE sort SET bonus_maitrise = 'Portée : +2 / NM' WHERE id = 'magies/magie-du-vent#sort:propulsion';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-du-vent#sort:cri-faible';
UPDATE sort SET bonus_maitrise = 'Effets : permet de le faire reculer d''une case (+1/NM) en arrière' WHERE id = 'magies/magie-du-vent#sort:eternuement';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:fer-eolien';
UPDATE sort SET bonus_maitrise = 'Portée : +2/NM' WHERE id = 'magies/magie-du-vent#sort:feuille-morte';
UPDATE sort SET bonus_maitrise = 'Effets : Fait reculer la cible de 1 case (+1/NM)' WHERE id = 'magies/magie-du-vent#sort:recul-force';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vent#sort:estoc-hurlante';
UPDATE sort SET bonus_maitrise = 'D/S/B : +5/NM' WHERE id = 'magies/magie-du-vent#sort:bourrasque';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vent#sort:desarmer';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-du-vent#sort:tornade';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:vent-changeant';
UPDATE sort SET bonus_maitrise = 'Effets : Inflige 2d6 dégâts (+1d6/NM) supplémentaires en intérieur' WHERE id = 'magies/magie-du-vent#sort:grenade-explosive';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-vent#sort:vibration';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-du-vent#sort:allegement';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-vent#sort:grande-vitesse';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-du-vent#sort:tempete';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-du-vent#sort:danse-de-lair';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-du-vent#sort:explosif';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-du-vent#sort:megaphone';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre paralysie 1' WHERE id = 'magies/magie-de-la-foudre#sort:eclair';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-de-la-foudre#sort:contact-de-volt';
UPDATE sort SET bonus_maitrise = 'Effets : augmenter la réussite critique de 2% (+1/NM)' WHERE id = 'magies/magie-de-la-foudre#sort:affutage';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
D/S/B : +1/NM' WHERE id = 'magies/magie-de-la-foudre#sort:nerveux';
UPDATE sort SET bonus_maitrise = 'D/S/B : +2/NM' WHERE id = 'magies/magie-de-la-foudre#sort:tazeur';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:fer-foudroyant';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:reflexe-eclair';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:colonne-tesla';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-la-foudre#sort:chargeur';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-la-foudre#sort:souffle-electrique';
UPDATE sort SET bonus_maitrise = 'Effets : 1 boule (+1/NM)' WHERE id = 'magies/magie-de-la-foudre#sort:boules-de-foudre';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-foudre#sort:foudre-rouge';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:plaque-miroir';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM
Effets : agit de manière incohérente pendant 1 tour (+1 tour/NM)' WHERE id = 'magies/magie-de-la-foudre#sort:dysfonctionnement';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:vitesse-ampere';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-foudre#sort:eclair-en-chaine';
UPDATE sort SET bonus_maitrise = 'Effets : Invoque l''orage pendant 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-foudre#sort:colere-de-volt';
UPDATE sort SET bonus_maitrise = 'Effets : 3NM = Si jet de vigueur raté = Inflige paralysie 1' WHERE id = 'magies/magie-de-la-foudre#sort:grenade-paralysante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-foudre#sort:armure-conductrice';
UPDATE sort SET bonus_maitrise = 'D/S/B : +7/NM' WHERE id = 'magies/magie-de-la-foudre#sort:cercle-electrique';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-foudre#sort:orage-violet';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-foudre#sort:fulguration';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-la-foudre#sort:manteau-de-volt';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre aveuglement 1' WHERE id = 'magies/magie-de-la-lumiere#sort:frappe-lumineuse';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:inspiration-celeste';
UPDATE sort SET bonus_maitrise = 'Effets : Bloque 10 dégâts (+5/NM)' WHERE id = 'magies/magie-de-la-lumiere#sort:champ-de-force';
UPDATE sort SET bonus_maitrise = 'Effets : Permet d''infliger un bonus de +2 (+1/NM) dégâts pendant 2 tours' WHERE id = 'magies/magie-de-la-lumiere#sort:vitamine';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:premier-soin';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:fer-lumineux';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d/3NM' WHERE id = 'magies/magie-de-la-lumiere#sort:benediction';
UPDATE sort SET bonus_maitrise = 'Zone : 3NM = Croix 1x1' WHERE id = 'magies/magie-de-la-lumiere#sort:energie-solaire';
UPDATE sort SET bonus_maitrise = 'Effets : Régénère des PV pendant 3 tours. (3NM permet de le faire sur 2 alliés)' WHERE id = 'magies/magie-de-la-lumiere#sort:panneau-solaire';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM
D/S/B : +5/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:flash';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:photon';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:recouvrer';
UPDATE sort SET bonus_maitrise = 'Effets : Invoque le grand soleil pendant 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-lumiere#sort:rayon-daurora';
UPDATE sort SET bonus_maitrise = 'Effets : 2 boosts si 3 niveaux de maîtrise' WHERE id = 'magies/magie-de-la-lumiere#sort:croisade-lumineuse';
UPDATE sort SET bonus_maitrise = 'D/S/B : +10/NM
Effets : 3 NM = Soigne une croix en carac' WHERE id = 'magies/magie-de-la-lumiere#sort:operation';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-la-lumiere#sort:explosion-glorifique';
UPDATE sort SET bonus_maitrise = 'Effets : Dure 3 tours (+1/NM)' WHERE id = 'magies/magie-de-la-lumiere#sort:regeneration';
UPDATE sort SET bonus_maitrise = 'Effets : 3 NM = oblige un jet de vigueur pour ne pas être aveuglé au stade 1' WHERE id = 'magies/magie-de-la-lumiere#sort:grenade-flash';
UPDATE sort SET bonus_maitrise = 'Portée : +1/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:poussiere-detoile';
UPDATE sort SET bonus_maitrise = 'Zone : +1/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:cercle-de-soin';
UPDATE sort SET bonus_maitrise = 'D/S/B : +12/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:resurrection';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:lance-sacree';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-la-lumiere#sort:louange-daurora';
UPDATE sort SET bonus_maitrise = 'D/S/B : +1d6/NM
Effets : 3NM = Sur un coup critique, force le jet de fermeté pour ne pas prendre peur 1' WHERE id = 'magies/magie-de-lombre#sort:sphere-obscure';
UPDATE sort SET bonus_maitrise = 'Effets : Si jet de fermeté raté = -10% (-10%/NM) à sa prochaine action' WHERE id = 'magies/magie-de-lombre#sort:perturbation';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:marionnette-de-lombre';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:brume-mental';
UPDATE sort SET bonus_maitrise = 'Effets : Réduit de 5 l''initiative de l’adversaire pour le prochain tour. (+2/NM)' WHERE id = 'magies/magie-de-lombre#sort:pichenette';
UPDATE sort SET bonus_maitrise = 'D/S/B : +3/NM' WHERE id = 'magies/magie-de-lombre#sort:cri-ebranleur';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:manteau-noir';
UPDATE sort SET bonus_maitrise = 'Effets : Créer 1 (+1/NM) lame(s)' WHERE id = 'magies/magie-de-lombre#sort:lame-dombre';
UPDATE sort SET bonus_maitrise = 'D/S/B : -1d/3NM' WHERE id = 'magies/magie-de-lombre#sort:malediction';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:fer-obscur';
UPDATE sort SET bonus_maitrise = 'Effets : Invoque le brouillard obscur pour 3 tours (+1/NM)' WHERE id = 'magies/magie-de-lombre#sort:brouillard-obscur';
UPDATE sort SET bonus_maitrise = 'Coût : -1/NM' WHERE id = 'magies/magie-de-lombre#sort:javelot-sombre';
UPDATE sort SET bonus_maitrise = 'Type : IC x 2 si 3NM' WHERE id = 'magies/magie-de-lombre#sort:amplification-sombre';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:marque-suintante';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:ombre-menacante';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM
D/S/B : +4/NM' WHERE id = 'magies/magie-de-lombre#sort:rayon-negatif';
UPDATE sort SET bonus_maitrise = 'Effets : Malus de 25% pour tous les jets pour 1 tour (-10%/NM)' WHERE id = 'magies/magie-de-lombre#sort:grenade-fumigene';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:defaite-annoncee';
UPDATE sort SET bonus_maitrise = 'Coût : -2/NM' WHERE id = 'magies/magie-de-lombre#sort:goudron';
UPDATE sort SET bonus_maitrise = 'Type : IC pour 3 NM' WHERE id = 'magies/magie-de-lombre#sort:pire-ami';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-lombre#sort:chaine-de-lentrave';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM
Effets : Ignore l''esquive/parade partielle au niveau 3 de maîtrise' WHERE id = 'magies/magie-de-lombre#sort:armee-de-lombre';
UPDATE sort SET bonus_maitrise = 'Coût : -5/NM' WHERE id = 'magies/magie-de-lombre#sort:frappe-negative';

-- Remplacée par sort_bonus_maitrise (mêmes lignes, plus celles que l'index ne retenait pas)
DROP TABLE sort_progression_nm;

-- Lecture « à N NM » (0 à 3)
CREATE VIEW v_sort_bonus_au_nm AS
  SELECT b.sort_id, n.nm, b.champ, b.rang, b.nature, b.texte_brut, b.contexte, b.increment_brut, b.increment_entier,
         CASE b.nature
           WHEN 'par_nm' THEN n.nm / b.pas_nm
           WHEN 'palier' THEN CASE WHEN n.nm >= b.seuil_nm THEN 1 ELSE 0 END
         END AS applications
  FROM sort_bonus_maitrise b
  CROSS JOIN (SELECT 0 AS nm UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) n;

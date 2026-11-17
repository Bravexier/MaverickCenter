-- 0084-r172-mode-hyper-activable : décision R172 du propriétaire (docs/decisions-regles.md) : « Je veux aussi que tu rende la tuile de mode hyper
-- activable ou non ce qui comme pour les posture, calcule alors les dégâts, les résistances. Ainsi que le mode hyper 100% (activable que quand le mode
-- hyper l'est déjà) » ; « Oui, compteur manuel » (une fois par semaine). Migration de STRUCTURE (section 13 seulement : data/rows garde les tables des
-- fiches vides).
--   * personnage.mode_hyper, personnage.mode_hyper_100 : deux cases (0/1, 0 par défaut : aucune fiche existante n'est en Mode Hyper), comme
--     personnage.posture_id l'état du moment enregistré avec la fiche ; le Mode Hyper 100 % n'est actif qu'avec le Mode Hyper (contrainte nommée
--     personnage_mode_hyper_100_avec_mode_hyper). Les niveaux qui les débloquent (2 et 10) restent des règles lues par le moteur, pas une contrainte.
--   * personnage.mode_hyper_semaine : les utilisations qui restent dans la semaine (entier >= 0) ; NULL = non suivi, au maximum (convention des jauges
--     du moment, sante_actuelle…), la valeur de toute fiche existante.
--   ADD COLUMN, en dernier, dans cet ordre (le CHECK de mode_hyper_100 lit mode_hyper) ; aucune vue ne change.

ALTER TABLE personnage ADD COLUMN mode_hyper            INTEGER NOT NULL DEFAULT 0 CHECK (mode_hyper IN (0, 1));
ALTER TABLE personnage ADD COLUMN mode_hyper_100        INTEGER NOT NULL DEFAULT 0 CHECK (mode_hyper_100 IN (0, 1))
                          CONSTRAINT personnage_mode_hyper_100_avec_mode_hyper CHECK (mode_hyper_100 = 0 OR mode_hyper = 1);
ALTER TABLE personnage ADD COLUMN mode_hyper_semaine    INTEGER CHECK (mode_hyper_semaine IS NULL OR mode_hyper_semaine >= 0);

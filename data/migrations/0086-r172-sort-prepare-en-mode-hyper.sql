-- 0086-r172-sort-prepare-en-mode-hyper : décision R172 du propriétaire (docs/decisions-regles.md), lot F : « un sort préparé pendant le Mode Hyper
-- 100 % reste "préparé au 100 %", même après la sortie du 100 % » (« Aussi le +15/+7 »), et réponse à Q82 (docs/sql/a-valider.md) : un sort préparé
-- pendant le Mode Hyper normal garde lui aussi son +15 (ou +7) une fois le Mode Hyper terminé (« Oui : 2d6+20 »). La posture de préparation
-- (personnage_sort.prepare_posture_id, R115) ne peut dire ni « en Mode Hyper » ni « au 100 % » : il faut deux colonnes, calquées sur
-- personnage.mode_hyper et mode_hyper_100 (migration 0084). Migration de STRUCTURE (section 13 seulement : data/rows garde les tables des fiches
-- vides ; la base vivante d'un serveur est reconstruite, pas migrée).
--   * personnage_sort.prepare_hyper : 1 = le sort préparé l'a été pendant le Mode Hyper ; il garde le +15 (ou +7) du Mode Hyper. Seulement sur le
--     sort préparé (contrainte nommée personnage_sort_prepare_hyper_avec_prepare).
--   * personnage_sort.prepare_cent : 1 = il l'a été pendant le Mode Hyper 100 % ; il garde en plus le cumul des postures sans inconvénients et le
--     +10 du 100 %. Seulement sur un sort préparé en Mode Hyper (contrainte nommée personnage_sort_prepare_cent_avec_prepare_hyper), donc préparé.
--   Dans les deux cas jusqu'au lancer, à « Lâcher le sort » ou à une nouvelle préparation (R115) : « Lâcher le sort » les remet à 0 avec prepare,
--   une nouvelle préparation les réécrit selon le moment. 0 par défaut : aucun sort préparé existant ne l'a été en Mode Hyper.
--   ADD COLUMN, en dernier, dans cet ordre (le CHECK de prepare_cent lit prepare_hyper) ; aucune vue ni aucun index ne change.

ALTER TABLE personnage_sort ADD COLUMN prepare_hyper INTEGER NOT NULL DEFAULT 0 CHECK (prepare_hyper IN (0, 1))
                          CONSTRAINT personnage_sort_prepare_hyper_avec_prepare CHECK (prepare_hyper = 0 OR prepare = 1);
ALTER TABLE personnage_sort ADD COLUMN prepare_cent  INTEGER NOT NULL DEFAULT 0 CHECK (prepare_cent IN (0, 1))
                          CONSTRAINT personnage_sort_prepare_cent_avec_prepare_hyper CHECK (prepare_cent = 0 OR prepare_hyper = 1);

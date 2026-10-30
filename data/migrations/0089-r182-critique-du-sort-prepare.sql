-- 0089-r182-critique-du-sort-prepare : décision R182 du propriétaire (docs/decisions-regles.md, 2026-10-30), suite de R180 (réussite critique, migration
-- 0087), réponses à Q90 et Q91 (docs/sql/a-valider.md). Migration de STRUCTURE et de DONNÉES. Les pages du guide (« Réussir une action » : l'échec
-- critique au-delà de 95 %, Q89 ; « La magie en jeu » : le sort préparé) sont passées par db:sync-pages.
--   * personnage_sort.prepare_critique (Q91 : « c'est le critique au moment de la préparation qui va taper quand le sort est relaché ») : l'entier N de
--     « Réussite critique : 1 à N (figée à la préparation) », la plage de critique de Concentration au moment de la préparation (posture, score du
--     moment et sources permanentes de R180), enregistrée à la préparation ; NULL tant qu'elle n'est pas notée. Comme prepare_jet, seulement sur le
--     sort préparé (contrainte nommée personnage_sort_prepare_critique_avec_prepare). Bornes : de 1, le bas de la plage « 1 à N » (N ≥ 1 : un
--     accessoire maudit retire de la réussite critique, R180 et R54, et Concentration peut n'avoir que 1 à 4), à 15 ('critique.plafond'), contrainte
--     nommée personnage_sort_prepare_critique_bornes. Un CHECK ne lit pas une autre table : le plafond y est écrit, et
--     test/db-r182-critique-du-sort-prepare.test.mjs vérifie qu'il est celui de regle_constante (une constante changée demande une migration qui
--     change la contrainte). Pas de trigger : le schéma n'en a aucun (SQL portable, en-tête de data/schema.sql), et la base vivante d'un
--     serveur est reconstruite depuis le schéma, pas migrée. ADD COLUMN nullable, en dernier ; aucune fiche existante ne change (NULL : rien n'est
--     recalculé après coup). Section 13 : data/rows garde la table vide.
--   * posture_critique : « Sci du Crit » (« (Posture Offensif) Augmente la réussite critique de +5%. ») ne compte plus dans le total, il est seulement
--     mentionné sur la fiche (Q90 : « Tout jet d'attaque au corps à corps », armes de contact seulement ; il dépend de l'arme utilisée, R128). Les six
--     lignes 'don_de_posture' (choix provisoire de R180) sont retirées, et la valeur sort du CHECK de `bonus` : la table est reconstruite (créée sous
--     posture_critique_0089, lignes 'posture' recopiées, ancienne supprimée, renommée), mêmes colonnes dans le même ordre. Aucune clé étrangère, vue ni
--     index ne la vise. Les huit lignes 'posture' (Offensif sur six jets, Défensif sur Esquive et Parade, R180 (4) confirmé par R182 (2)) ne changent pas.

-- 1. La plage de critique figée du sort préparé
ALTER TABLE personnage_sort ADD COLUMN prepare_critique INTEGER
                          CONSTRAINT personnage_sort_prepare_critique_avec_prepare CHECK (prepare_critique IS NULL OR prepare = 1)
                          CONSTRAINT personnage_sort_prepare_critique_bornes CHECK (prepare_critique IS NULL OR prepare_critique BETWEEN 1 AND 15);

-- 2. Sci du Crit sort du total : plus de bonus 'don_de_posture'
CREATE TABLE posture_critique_0089 (
  posture_id    TEXT NOT NULL REFERENCES posture(id),
  bonus         TEXT NOT NULL CHECK (bonus IN ('posture')),
  competence_id TEXT NOT NULL REFERENCES competence(id),
  PRIMARY KEY (posture_id, bonus, competence_id)
) STRICT, WITHOUT ROWID;

INSERT INTO posture_critique_0089 (posture_id, bonus, competence_id)
  SELECT posture_id, bonus, competence_id FROM posture_critique WHERE bonus = 'posture';

DROP TABLE posture_critique;
ALTER TABLE posture_critique_0089 RENAME TO posture_critique;

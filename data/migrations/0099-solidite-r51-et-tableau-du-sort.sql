-- 0099-solidite-r51-et-tableau-du-sort : deux défauts du code (lot « Défauts du code », demande du propriétaire). Migration de STRUCTURE et de DONNÉES ;
-- rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. v_arme.solidite_sans_composition applique le plancher de la décision R51 (« Oui il faut les cumuler mais il est impossible de descendre à moins
--      de 1. », 2026-10-13) : la vue donnait base + delta, ou la valeur fixée, sans plancher, quand le moteur (lib/arme-champs.mjs#durabiliteDeLArme)
--      borne les deux à 1. Écrit en CASE (SQL portable : pas de MAX scalaire). Aucune arme de data/rows ne change de valeur (aucune n'est sous 1) : le
--      plancher ne joue qu'après une modification du site de dev (crans ou base de l'onglet).
--   2. invocation.tableau_sort_id, ajoutée en dernière colonne, nullable, clé étrangère vers sort(id) : le sort dont le tableau est aussi celui de
--      l'invocation (décision R130), jusqu'ici retrouvé par le nom écrit entre guillemets dans tableau_titre (lib/bestiaire-db.mjs#tableauxDesSorts) ;
--      un renommage du sort sur le site de dev coupait le lien en silence. CHECK : pas de sort sans titre de tableau. Index partiel, comme invocation_sort
--      (clé étrangère clairsemée, docs/sql/conception.md). La table invocation, citée par plusieurs clés étrangères, n'est pas reconstruite.
--      Valeur : la résolution du code au moment de la migration (nom entre guillemets de « TABLEAU "AMÉLIORATION CADAVÉRIQUE" », normalisé, cherché
--      par nom_cle dans la magie du sort de l'invocation) : une seule invocation a un tableau, « Animation des morts », qui donne le sort
--      « Amélioration cadavérique » de la Nécromancie. L'id est écrit tel quel (le SQL n'a ni l'expression régulière ni normalize() du code) ; la
--      garde (même magie que le sort de l'invocation, titre présent) laisse NULL si les lignes ne sont plus celles du lot.

DROP VIEW v_arme;

CREATE VIEW v_arme AS
  SELECT a.id, a.nom, f.nom AS famille, t.nom AS type, a.competence_brut, a.mains, a.cout_ro,
         a.de, a.de_faces, COALESCE(a.bonus_degats, 0) AS bonus_degats_ou_0,
         a.bonus_degats,
         COALESCE(a.portee_min, t.portee_min) AS portee_min_effective,
         COALESCE(a.portee_max, t.portee_max) AS portee_max_effective,
         CASE WHEN a.portee_min IS NULL THEN 'type' ELSE 'effet' END AS portee_source,
         CASE WHEN COALESCE(a.solidite_fixee, k.valeur + COALESCE(a.solidite_delta, 0)) < 1 THEN 1
              ELSE COALESCE(a.solidite_fixee, k.valeur + COALESCE(a.solidite_delta, 0)) END AS solidite_sans_composition,
         a.ignore_ap, a.recharge, a.provenance, a.depart_possible, a.effet
  FROM arme a
  JOIN arme_famille f ON f.id = a.famille_id
  JOIN arme_type t ON t.id = a.type_id
  CROSS JOIN (SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base') k;

ALTER TABLE invocation ADD COLUMN tableau_sort_id TEXT REFERENCES sort(id) CHECK (tableau_sort_id IS NULL OR tableau_titre IS NOT NULL);
CREATE INDEX invocation_tableau_sort ON invocation (tableau_sort_id) WHERE tableau_sort_id IS NOT NULL;

UPDATE invocation
SET tableau_sort_id = 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique'
WHERE id = 'bestiaire/animation-des-morts'
  AND tableau_titre IS NOT NULL
  AND EXISTS (SELECT 1 FROM sort t JOIN sort s ON s.magie_id = t.magie_id
              WHERE t.id = 'magies/magie-de-la-necromancie#sort:amelioration-cadaverique' AND s.id = invocation.sort_id);

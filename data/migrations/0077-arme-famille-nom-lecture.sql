-- 0077-arme-famille-nom-lecture : le nom de lecture figé des familles d'armes (décision R159 du propriétaire, 2026-10-23). Migration de STRUCTURE et
-- de DONNÉES.
--   * Le site de dev pourra renommer une famille d'armes et en créer une (R159). Les « sauf » des maîtrises au choix et les lignes nommées
--     (« 1 maîtrise Épée », « (sauf épée) ») se lisent par le nom de la famille (client/src/lib/maitrise-arme.mjs#famillesDuNom ; R138, R151) : un
--     renommage les casserait. arme_famille.nom_lecture garde le nom du bandeau à l'import (ou le nom de création d'une famille créée sur le site),
--     jamais modifié ensuite ; le lecteur le lira en plus de `nom`.
--   * ADD COLUMN, en dernier : un NOT NULL par ADD COLUMN exige un DEFAULT non NULL, qui resterait dans le schéma (une famille créée sans nom de
--     lecture recevrait ce défaut sans erreur). La colonne reste donc nullable, sous un CHECK qui refuse le texte vide ; la garde ci-dessous refuse
--     toute la migration si une famille reste sans nom de lecture, et client/test/db-arme-famille-nom-lecture.test.mjs tient l'invariant ensuite.
--   * Une table reconstruite (NOT NULL dans le CREATE) demanderait de refaire ses quatre vues (v_arme, v_personnage_maitrise_part,
--     v_personnage_maitrise_arme, v_personnage_controle) : écarté, comme pour `categorie` (0069).

ALTER TABLE arme_famille ADD COLUMN nom_lecture TEXT CHECK (nom_lecture IS NULL OR length(nom_lecture) > 0);

-- les 12 familles de l'import (aucune n'a été renommée ni créée par le site : historique_modification n'a aucune ligne d'arme_famille)
UPDATE arme_famille SET nom_lecture = nom;

-- garde : les 12 familles, chacune avec un nom de lecture égal à son nom ; une famille de plus ou de moins, ou un nom de lecture absent, et le CHECK de
-- cette table temporaire fait refuser toute la migration
CREATE TEMP TABLE garde_0077 (
  familles   INTEGER NOT NULL CHECK (familles = 12),
  accordees  INTEGER NOT NULL CHECK (accordees = 12)
);
INSERT INTO garde_0077 SELECT count(*), count(*) FILTER (WHERE nom_lecture IS NOT NULL AND nom_lecture = nom) FROM arme_famille;
DROP TABLE garde_0077;

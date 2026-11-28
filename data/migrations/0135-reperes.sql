-- 0135-reperes : la table des repères (chantier 4 des mots-clés, « le retrait des colonnes » : docs/chantier-retrait-des-colonnes.md, §2 et §7, étape
-- « PR A »). Migration de STRUCTURE seule : elle crée une table VIDE et n'écrit aucune ligne. Les repères viennent plus tard par un lot de changements
-- déposé sur le site de dev (client/scripts/lot-des-reperes.mjs).
--   repere : l'élément d'un mot-clé qui n'a ni page ni sort (une rubrique, une page calculée, une section de page, une notion dont le nom attend un
--   arbitrage). Une ligne par mot-clé (mot_cle_id est la clé primaire), supprimée avec lui (ON DELETE CASCADE). `nom`, `adresse`, `definition`, `couleur`
--   et `icone` portent les contraintes de mot_cle.libelle, url, description, couleur et icone, recopiées telles quelles.
-- Rien ne lit encore cette table : les colonnes de mot_cle font toujours foi et ne changent pas.

CREATE TABLE repere (
  mot_cle_id INTEGER NOT NULL PRIMARY KEY REFERENCES mot_cle(id) ON DELETE CASCADE,
  nom        TEXT    NOT NULL CHECK (length(nom) > 0),
  adresse    TEXT    CHECK (adresse IS NULL OR (adresse GLOB '/*' AND adresse NOT GLOB '//*' AND adresse NOT GLOB '*[^!-~]*' AND instr(adresse, '\') = 0)),
  definition TEXT    CHECK (definition IS NULL OR length(definition) > 0),
  couleur    TEXT    CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-')),
  icone      TEXT    CHECK (icone IS NULL OR (icone GLOB '[a-z]*:[a-z0-9]*' AND icone NOT GLOB '*[^a-z0-9:-]*' AND icone NOT GLOB '*[^a-z]*:*' AND icone NOT GLOB '*:*:*' AND icone NOT GLOB '*--*' AND icone NOT GLOB '*-'))
) STRICT;

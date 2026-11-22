-- 0131-ancrage-mots-cles : la structure de l'ancrage des mots-clés (décision R309, « les mots-clés au centre » : une page, un sort, un type de sort = un
-- mot-clé). Migration de STRUCTURE seule : elle ne pose aucun mot-clé. Les ancres (et les mots-clés qu'elles exigent) viennent plus tard par des lots de
-- changements déposés sur le site de dev.
--   1. page.mot_cle_id et sort.mot_cle_id : le mot-clé que la ligne ancre, NULL tant qu'elle n'est pas ancrée. Clé étrangère sans cascade : un mot-clé
--      ancré ne se supprime pas. Colonnes ajoutées en dernier (ADD COLUMN) ; un index UNIQUE partiel garantit qu'un mot-clé ancre au plus une page,
--      au plus un sort (les lignes à NULL ne se comparent pas).
--   2. type_sort : une ligne par code du CHECK de sort_type.type, chacune avec son mot-clé (NULL au départ), même index UNIQUE partiel. Une page ET un
--      type de sort peuvent porter le même mot-clé (R309 : Météo), d'où trois index séparés et non une unicité commune.
-- Les dix codes recopiés sont ceux de sort_type (un code, pas un texte de règle).

ALTER TABLE page ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);

CREATE UNIQUE INDEX page_ancre_mot_cle ON page (mot_cle_id) WHERE mot_cle_id IS NOT NULL;

ALTER TABLE sort ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);

CREATE UNIQUE INDEX sort_ancre_mot_cle ON sort (mot_cle_id) WHERE mot_cle_id IS NOT NULL;

CREATE TABLE type_sort (
  id         TEXT    NOT NULL PRIMARY KEY CHECK (id IN ('attaque', 'entrave', 'soin', 'amplification', 'placement', 'invocation',
                                                       'construction', 'protection', 'meteo', 'aleatoire')),
  mot_cle_id INTEGER REFERENCES mot_cle(id)
) STRICT, WITHOUT ROWID;

CREATE UNIQUE INDEX type_sort_ancre_mot_cle ON type_sort (mot_cle_id) WHERE mot_cle_id IS NOT NULL;

INSERT INTO type_sort (id) VALUES ('attaque'), ('entrave'), ('soin'), ('amplification'), ('placement'), ('invocation'), ('construction'), ('protection'), ('meteo'), ('aleatoire');

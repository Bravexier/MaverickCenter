-- 0136-retrait-des-colonnes-du-mot-cle : le mot-clé ne porte plus ni nom, ni adresse, ni définition, ni couleur, ni icône (chantier 4 des mots-clés,
-- « le retrait des colonnes » : docs/chantier-retrait-des-colonnes.md, §1 à §3 et §7, étape « PR B »). Ces cinq valeurs se lisent désormais sur
-- l'ÉLÉMENT du mot-clé : sa page (page.mot_cle_id), sinon son sort (sort.mot_cle_id), sinon son repère (repere, migration 0135).
-- Elle ne porte aucun texte : elle recopie des valeurs d'une colonne à l'autre, puis retire les colonnes. Elle ne perd rien, sur toute base :
--   * un mot-clé de page : son nom est le titre de la page, son adresse celle de la page (calculée : lib/adresses-db.mjs), et sa définition, sa
--     couleur et son icône passent sur la page (colonnes nouvelles page.definition, page.couleur, page.icone, mêmes contraintes que celles du repère) ;
--   * un mot-clé de sort (sans page) : son nom est celui du sort, son adresse la place du sort dans la page de sa magie, et sa définition, sa couleur
--     et son icône passent sur le sort (colonnes nouvelles sort.definition, sort.couleur, sort.icone, mêmes contraintes ; décision R309 (14) et (17) :
--     elles se corrigent sur l'élément, par un lot) ;
--   * tout autre mot-clé garde ses cinq valeurs dans son repère : celui qu'il a déjà est réaligné sur les colonnes, qui font foi jusqu'ici, et
--     celui qui n'en a pas en reçoit un. Sur une base dont aucune page n'est ancrée (la copie du dépôt), chaque mot-clé garde donc son nom dans
--     un repère.
-- Un repère ne double jamais une page ou un sort : celui d'un mot-clé qui en a un est retiré (il n'en était que la copie).
-- La table mot_cle est refaite (mot_cle__0136, recopiée, puis renommée) plutôt que réduite par DROP COLUMN : retirer la dernière colonne (icone)
-- échoue sur un SQLite ancien (3.40, celui de tools/db/migrer.py sur un poste) quand un commentaire du CREATE TABLE enregistré porte une virgule
-- (« error in table mot_cle after drop column »), et ce texte diffère d'une base à l'autre. Les clés étrangères sont suspendues par qui l'applique.
-- La vue v_mot_cle, qui lisait les colonnes, est retirée d'abord et refaite sur l'élément, sans l'adresse (celle d'une page ne se calcule pas en SQL).

DROP VIEW v_mot_cle;

ALTER TABLE page ADD COLUMN definition TEXT CHECK (definition IS NULL OR length(definition) > 0);

ALTER TABLE page ADD COLUMN couleur TEXT CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-'));

ALTER TABLE page ADD COLUMN icone TEXT CHECK (icone IS NULL OR (icone GLOB '[a-z]*:[a-z0-9]*' AND icone NOT GLOB '*[^a-z0-9:-]*' AND icone NOT GLOB '*[^a-z]*:*' AND icone NOT GLOB '*:*:*' AND icone NOT GLOB '*--*' AND icone NOT GLOB '*-'));

-- la définition, la couleur et l'icône d'un mot-clé de page passent sur sa page
UPDATE page SET
  definition = (SELECT m.description FROM mot_cle m WHERE m.id = page.mot_cle_id),
  couleur    = (SELECT m.couleur     FROM mot_cle m WHERE m.id = page.mot_cle_id),
  icone      = (SELECT m.icone       FROM mot_cle m WHERE m.id = page.mot_cle_id)
WHERE mot_cle_id IS NOT NULL;

ALTER TABLE sort ADD COLUMN definition TEXT CHECK (definition IS NULL OR length(definition) > 0);

ALTER TABLE sort ADD COLUMN couleur TEXT CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-'));

ALTER TABLE sort ADD COLUMN icone TEXT CHECK (icone IS NULL OR (icone GLOB '[a-z]*:[a-z0-9]*' AND icone NOT GLOB '*[^a-z0-9:-]*' AND icone NOT GLOB '*[^a-z]*:*' AND icone NOT GLOB '*:*:*' AND icone NOT GLOB '*--*' AND icone NOT GLOB '*-'));

-- celles d'un mot-clé de sort passent sur son sort (la page l'emporte : un mot-clé qui a les deux les a déjà sur sa page)
UPDATE sort SET
  definition = (SELECT m.description FROM mot_cle m WHERE m.id = sort.mot_cle_id),
  couleur    = (SELECT m.couleur     FROM mot_cle m WHERE m.id = sort.mot_cle_id),
  icone      = (SELECT m.icone       FROM mot_cle m WHERE m.id = sort.mot_cle_id)
WHERE mot_cle_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM page p WHERE p.mot_cle_id = sort.mot_cle_id);

-- pas de repère pour un mot-clé qui a une page ou un sort
DELETE FROM repere
WHERE mot_cle_id IN (SELECT p.mot_cle_id FROM page p WHERE p.mot_cle_id IS NOT NULL)
   OR mot_cle_id IN (SELECT s.mot_cle_id FROM sort s WHERE s.mot_cle_id IS NOT NULL);

-- les repères qui restent reprennent les colonnes du mot-clé, qui font foi jusqu'à cette migration
UPDATE repere SET
  nom        = (SELECT m.libelle     FROM mot_cle m WHERE m.id = repere.mot_cle_id),
  adresse    = (SELECT m.url         FROM mot_cle m WHERE m.id = repere.mot_cle_id),
  definition = (SELECT m.description FROM mot_cle m WHERE m.id = repere.mot_cle_id),
  couleur    = (SELECT m.couleur     FROM mot_cle m WHERE m.id = repere.mot_cle_id),
  icone      = (SELECT m.icone       FROM mot_cle m WHERE m.id = repere.mot_cle_id);

-- tout mot-clé sans page, sans sort et sans repère reçoit le sien
INSERT INTO repere (mot_cle_id, nom, adresse, definition, couleur, icone)
  SELECT m.id, m.libelle, m.url, m.description, m.couleur, m.icone
  FROM mot_cle m
  WHERE NOT EXISTS (SELECT 1 FROM page p WHERE p.mot_cle_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM sort s WHERE s.mot_cle_id = m.id)
    AND NOT EXISTS (SELECT 1 FROM repere r WHERE r.mot_cle_id = m.id)
  ORDER BY m.id;

CREATE TABLE mot_cle__0136 (
  id          INTEGER NOT NULL PRIMARY KEY CHECK (id >= 1),
  cle         TEXT    NOT NULL UNIQUE CHECK (length(cle) > 0 AND cle NOT GLOB '*[^a-z0-9-]*' AND cle NOT GLOB '*--*' AND cle NOT GLOB '-*' AND cle NOT GLOB '*-'),
  verrou      INTEGER NOT NULL DEFAULT 0 CHECK (verrou IN (0,1)),
  monnaie_id  TEXT    UNIQUE REFERENCES monnaie(id) ON DELETE SET NULL
) STRICT;

INSERT INTO mot_cle__0136 (id, cle, verrou, monnaie_id)
  SELECT id, cle, verrou, monnaie_id FROM mot_cle ORDER BY id;

DROP TABLE mot_cle;

ALTER TABLE mot_cle__0136 RENAME TO mot_cle;

CREATE VIEW v_mot_cle AS
  SELECT m.id, m.cle,
    coalesce(p.titre, s.nom, r.nom) AS libelle,
    CASE WHEN p.id IS NOT NULL THEN p.definition WHEN s.id IS NOT NULL THEN s.definition ELSE r.definition END AS description,
    CASE WHEN p.id IS NOT NULL THEN p.couleur WHEN s.id IS NOT NULL THEN s.couleur ELSE r.couleur END AS couleur,
    CASE WHEN p.id IS NOT NULL THEN p.icone WHEN s.id IS NOT NULL THEN s.icone ELSE r.icone END AS icone,
    m.verrou, m.monnaie_id,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages
  FROM mot_cle m
    LEFT JOIN page p ON p.mot_cle_id = m.id
    LEFT JOIN sort s ON s.mot_cle_id = m.id
    LEFT JOIN repere r ON r.mot_cle_id = m.id;

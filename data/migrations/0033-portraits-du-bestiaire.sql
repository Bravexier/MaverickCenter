-- 0033-portraits-du-bestiaire : le portrait d'un monstre (une carte) et d'une espèce (la carte d'une espèce qui n'a pas encore de carte de combat), comme
-- celui de la fiche de personnage (demande du propriétaire, 2026-10-13 : « En mode édition, il sera possible d'enregistrer le portrait de la même manière
-- que dans la feuille de personnage » ; migration 0031 pour la fiche). Migration de STRUCTURE : quatre colonnes placées en dernier dans monstre et dans
-- monstre_espece, les mêmes que personnage : portrait (l'image réduite par la page, en data URL de 700 000 caractères au plus), portrait_x, portrait_y
-- (centre du cadre carré dans l'image, de 0 à 1) et portrait_zoom (de 1 à 4) ; NULL = le logo. Aucune ligne ne change (aucun portrait à l'import).

ALTER TABLE monstre_espece ADD COLUMN portrait TEXT CHECK (portrait IS NULL OR (portrait GLOB 'data:image/*' AND length(portrait) <= 700000));
ALTER TABLE monstre_espece ADD COLUMN portrait_x REAL CHECK (portrait_x IS NULL OR portrait_x BETWEEN 0 AND 1);
ALTER TABLE monstre_espece ADD COLUMN portrait_y REAL CHECK (portrait_y IS NULL OR portrait_y BETWEEN 0 AND 1);
ALTER TABLE monstre_espece ADD COLUMN portrait_zoom REAL CHECK (portrait_zoom IS NULL OR portrait_zoom BETWEEN 1 AND 4);
ALTER TABLE monstre ADD COLUMN portrait TEXT CHECK (portrait IS NULL OR (portrait GLOB 'data:image/*' AND length(portrait) <= 700000));
ALTER TABLE monstre ADD COLUMN portrait_x REAL CHECK (portrait_x IS NULL OR portrait_x BETWEEN 0 AND 1);
ALTER TABLE monstre ADD COLUMN portrait_y REAL CHECK (portrait_y IS NULL OR portrait_y BETWEEN 0 AND 1);
ALTER TABLE monstre ADD COLUMN portrait_zoom REAL CHECK (portrait_zoom IS NULL OR portrait_zoom BETWEEN 1 AND 4);

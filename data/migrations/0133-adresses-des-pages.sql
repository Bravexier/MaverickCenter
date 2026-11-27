-- 0133-adresses-des-pages : la structure de « l'adresse d'une page suit son titre » (décision R316). Migration de STRUCTURE seule : elle n'écrit aucune ligne
-- et ne change l'adresse d'aucune page. Les adresses et les anciennes adresses sont écrites plus tard par le service, au renommage d'une page.
--   1. page.slug_adresse : le dernier segment de l'adresse de la page quand il ne se tire plus de son identifiant. NULL = l'adresse est celle d'aujourd'hui
--      (tirée de l'identifiant). Même forme que page.slug. Colonne ajoutée en dernier (ADD COLUMN). L'identifiant d'une page ne change jamais.
--   2. page_ancienne_adresse : une ligne par ancienne adresse d'une page, relative à la racine du site, sans barre initiale (« capacites/anansi-anti-corps/ »,
--      « metiers/#metier-forgeron »), supprimée avec sa page. Même idée que mot_cle_ancienne_cle. Pas d'index unique entre pages en base : SQL ne connaît pas
--      les deux adresses d'une page ni le préfixe d'une page du guide, l'unicité des adresses est un contrôle du contenu (service et db:check).

ALTER TABLE page ADD COLUMN slug_adresse TEXT CHECK (slug_adresse IS NULL OR (length(slug_adresse) > 0 AND slug_adresse NOT GLOB '*[^a-z0-9-]*'
                                                                              AND slug_adresse NOT GLOB '*--*' AND slug_adresse NOT GLOB '-*' AND slug_adresse NOT GLOB '*-'));

CREATE TABLE page_ancienne_adresse (
  adresse TEXT NOT NULL PRIMARY KEY CHECK (length(adresse) > 0 AND adresse NOT GLOB '/*' AND (adresse GLOB '*/' OR adresse GLOB '*#*')),
  page_id TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX page_ancienne_adresse_page ON page_ancienne_adresse (page_id);

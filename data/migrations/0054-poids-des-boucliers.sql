-- 0054-poids-des-boucliers : le poids de chaque bouclier préfabriqué (demande du propriétaire du 2026-10-16 : « En ce qui concerne le poids base toi
-- sur la couleur du tableau d'orignie et affiche le dans le résultat final » (sic) ; décision R92). Migration de STRUCTURE et de DONNÉES.
--   * Structure : bouclier.poids_id (REFERENCES bouclier_poids), et son index. NULL = la case du bouclier n'a pas de couleur dans la source.
--   * Données : dans l'onglet « Bouclier » du classeur ORIGINAL « Ressources et Craft » (décision R83 : les originaux font foi), la liste des poids
--     (B35 Léger, B37 Moyen, B39 Lourd, B41 Très lourd : « 1 de Force minimum »…) colore chaque nom de poids, et chaque case de bouclier de la grille
--     (« Bocle Cuir / Prix : 4,5 / Défense : +1AP ») porte l'une de ces quatre couleurs de fond : vert #93c47d Léger, jaune #ffd966 Moyen, orange
--     #f6b26b Lourd, rouge #e06666 Très lourd. L'instantané du classeur (sources/raw/classeurs/, texte seul) ne porte pas les couleurs : elles ont
--     été lues par l'API Google Sheets le 2026-10-16 et sont consignées, case par case, dans 0054-poids-des-boucliers.json (registre de la migration,
--     comparé à la base par client/test/boucliers-poids.test.mjs). 37 boucliers légers, 12 moyens, 21 lourds, 30 très lourds : les 100.
--     Rien n'est déduit : un bouclier sans couleur resterait NULL (il n'y en a pas).

ALTER TABLE bouclier ADD COLUMN poids_id TEXT REFERENCES bouclier_poids(id);
CREATE INDEX bouclier_par_poids ON bouclier (poids_id);

-- 37 boucliers
UPDATE bouclier SET poids_id = 'leger' WHERE id IN (
  'ressources/bouclier#bouclier:bocle:acier',
  'ressources/bouclier#bouclier:bocle:bois',
  'ressources/bouclier#bouclier:bocle:cellulose',
  'ressources/bouclier#bouclier:bocle:chitine',
  'ressources/bouclier#bouclier:bocle:corail',
  'ressources/bouclier#bouclier:bocle:corne-os',
  'ressources/bouclier#bouclier:bocle:cuir',
  'ressources/bouclier#bouclier:bocle:cuivre',
  'ressources/bouclier#bouclier:bocle:ecailles',
  'ressources/bouclier#bouclier:bocle:fer',
  'ressources/bouclier#bouclier:bocle:fer-noir',
  'ressources/bouclier#bouclier:bocle:mythril',
  'ressources/bouclier#bouclier:bocle:vif-argent',
  'ressources/bouclier#bouclier:bouclier-rond:bois',
  'ressources/bouclier#bouclier:bouclier-rond:cellulose',
  'ressources/bouclier#bouclier:bouclier-rond:chitine',
  'ressources/bouclier#bouclier:bouclier-rond:corail',
  'ressources/bouclier#bouclier:bouclier-rond:cuir',
  'ressources/bouclier#bouclier:ecu:bois',
  'ressources/bouclier#bouclier:ecu:cellulose',
  'ressources/bouclier#bouclier:ecu:chitine',
  'ressources/bouclier#bouclier:ecu:corail',
  'ressources/bouclier#bouclier:ecu:cuir',
  'ressources/bouclier#bouclier:pavoi:bois',
  'ressources/bouclier#bouclier:pavoi:cellulose',
  'ressources/bouclier#bouclier:pavoi:corail',
  'ressources/bouclier#bouclier:pavoi:cuir',
  'ressources/bouclier#bouclier:targe:acier',
  'ressources/bouclier#bouclier:targe:bois',
  'ressources/bouclier#bouclier:targe:cellulose',
  'ressources/bouclier#bouclier:targe:chitine',
  'ressources/bouclier#bouclier:targe:corail',
  'ressources/bouclier#bouclier:targe:corne-os',
  'ressources/bouclier#bouclier:targe:cuir',
  'ressources/bouclier#bouclier:targe:fer',
  'ressources/bouclier#bouclier:targe:fer-noir',
  'ressources/bouclier#bouclier:targe:mythril'
);

-- 12 boucliers
UPDATE bouclier SET poids_id = 'moyen' WHERE id IN (
  'ressources/bouclier#bouclier:bocle:argent',
  'ressources/bouclier#bouclier:bocle:laiton',
  'ressources/bouclier#bouclier:bouclier-rond:acier',
  'ressources/bouclier#bouclier:bouclier-rond:corne-os',
  'ressources/bouclier#bouclier:bouclier-rond:fer',
  'ressources/bouclier#bouclier:bouclier-rond:fer-noir',
  'ressources/bouclier#bouclier:bouclier-rond:mythril',
  'ressources/bouclier#bouclier:pavoi:chitine',
  'ressources/bouclier#bouclier:targe:argent',
  'ressources/bouclier#bouclier:targe:cuivre',
  'ressources/bouclier#bouclier:targe:ecailles',
  'ressources/bouclier#bouclier:targe:vif-argent'
);

-- 21 boucliers
UPDATE bouclier SET poids_id = 'lourd' WHERE id IN (
  'ressources/bouclier#bouclier:bocle:bronze',
  'ressources/bouclier#bouclier:bocle:fonte',
  'ressources/bouclier#bouclier:bocle:maverium',
  'ressources/bouclier#bouclier:bocle:or',
  'ressources/bouclier#bouclier:bocle:titane',
  'ressources/bouclier#bouclier:bouclier-rond:argent',
  'ressources/bouclier#bouclier:bouclier-rond:cuivre',
  'ressources/bouclier#bouclier:bouclier-rond:ecailles',
  'ressources/bouclier#bouclier:bouclier-rond:laiton',
  'ressources/bouclier#bouclier:bouclier-rond:vif-argent',
  'ressources/bouclier#bouclier:ecu:acier',
  'ressources/bouclier#bouclier:ecu:corne-os',
  'ressources/bouclier#bouclier:ecu:fer',
  'ressources/bouclier#bouclier:ecu:fer-noir',
  'ressources/bouclier#bouclier:ecu:mythril',
  'ressources/bouclier#bouclier:targe:bronze',
  'ressources/bouclier#bouclier:targe:fonte',
  'ressources/bouclier#bouclier:targe:laiton',
  'ressources/bouclier#bouclier:targe:maverium',
  'ressources/bouclier#bouclier:targe:or',
  'ressources/bouclier#bouclier:targe:titane'
);

-- 30 boucliers
UPDATE bouclier SET poids_id = 'tres-lourd' WHERE id IN (
  'ressources/bouclier#bouclier:bouclier-rond:bronze',
  'ressources/bouclier#bouclier:bouclier-rond:fonte',
  'ressources/bouclier#bouclier:bouclier-rond:maverium',
  'ressources/bouclier#bouclier:bouclier-rond:or',
  'ressources/bouclier#bouclier:bouclier-rond:titane',
  'ressources/bouclier#bouclier:ecu:argent',
  'ressources/bouclier#bouclier:ecu:bronze',
  'ressources/bouclier#bouclier:ecu:cuivre',
  'ressources/bouclier#bouclier:ecu:ecailles',
  'ressources/bouclier#bouclier:ecu:fonte',
  'ressources/bouclier#bouclier:ecu:laiton',
  'ressources/bouclier#bouclier:ecu:maverium',
  'ressources/bouclier#bouclier:ecu:or',
  'ressources/bouclier#bouclier:ecu:titane',
  'ressources/bouclier#bouclier:ecu:vif-argent',
  'ressources/bouclier#bouclier:pavoi:acier',
  'ressources/bouclier#bouclier:pavoi:argent',
  'ressources/bouclier#bouclier:pavoi:bronze',
  'ressources/bouclier#bouclier:pavoi:corne-os',
  'ressources/bouclier#bouclier:pavoi:cuivre',
  'ressources/bouclier#bouclier:pavoi:ecailles',
  'ressources/bouclier#bouclier:pavoi:fer',
  'ressources/bouclier#bouclier:pavoi:fer-noir',
  'ressources/bouclier#bouclier:pavoi:fonte',
  'ressources/bouclier#bouclier:pavoi:laiton',
  'ressources/bouclier#bouclier:pavoi:maverium',
  'ressources/bouclier#bouclier:pavoi:mythril',
  'ressources/bouclier#bouclier:pavoi:or',
  'ressources/bouclier#bouclier:pavoi:titane',
  'ressources/bouclier#bouclier:pavoi:vif-argent'
);

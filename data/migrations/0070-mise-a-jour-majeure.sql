-- 0070-mise-a-jour-majeure : demande du propriétaire du 2026-10-22 (« rajouter une option à coté de l'actuel "Mise à jour en préparation : VX.Y+1"
-- (uniquement en dev) cocher une case (avec confirmation) pour que la prochaine mise à jour deviennet "Mise à jour en préparation : VX+1.0 (juste dans
-- la préparation le bouton "effectuer la mise à jour" reste le seul déclencheur majeur) »). Migration de STRUCTURE (section 14 seulement : data/rows
-- garde le brouillon vide).
--   * note_version_brouillon.majeure : la case de la note en préparation (1 : cochée, la prochaine mise à jour est la version X+1.0, sa PR de
--     livraison dev → master porte [V: X+1] ; NULL : décochée). Elle vit avec le champ libre : figée dans le lot par « Effectuer la mise à jour »,
--     décochée quand la ligne est vidée par la livraison du lot (client/serveur/notes-de-version.mjs, base-vivante.mjs#viderBrouillonLivre).
--     Colonne nullable (migration additive) : une base vivante refaite par une version d'avant 0070 ne la perd sans bloquer que vide (NULL).

ALTER TABLE note_version_brouillon ADD COLUMN majeure INTEGER CHECK (majeure IS NULL OR majeure = 1);

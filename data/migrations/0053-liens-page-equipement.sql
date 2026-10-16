-- 0053-liens-page-equipement : les pages « Armes », « Armures » (avec les Boucliers), « Bâton magique » et « Accessoires » des Ressources sont fusionnées
-- dans une seule page « Équipement » à cinq onglets, /ressources/equipement/ (ancres #armes, #armures, #boucliers, #batons-magiques, #accessoires ;
-- demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule onglet : "Equipement" A l'instar de "Armure et bouclier"
-- les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les bâtons magiques du coup qui auront mieux leur place ici » ;
-- « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires »). Migration de DONNÉES.
--   Les pages ressources/armes, ressources/armures, ressources/bouclier, ressources/baton-magique et ressources/accessoires ne sont plus construites ;
--   leurs [[liens]] du wiki mènent aux onglets (client/src/lib/metiers.mjs#adresseDePage) et la page 404 renvoie leurs anciennes adresses, mais la
--   version portable n'a pas de page 404. Les liens Markdown écrits à la main vers elles (aujourd'hui dans les chapitres du guide « L'équipement » et
--   « Caractéristiques et compétences » : page.corps_md, ni résumé ni autre table) mènent donc aux onglets : seule l'adresse change, le texte du lien
--   reste. Le lien vers l'onglet Boucliers, que la migration 0046 avait fait mener à /ressources/armures/#boucliers, suit. Les motifs « bouclier » et
--   « baton-magique » ne trouvent rien aujourd'hui (par prudence). Chaque motif finit par « ) » : « ](/ressources/armures/) » ne prend pas
--   « ](/ressources/armures/#boucliers) », et l'ordre des remplacements n'y change rien. Les traces (historique_modification) ne sont pas touchées.

UPDATE page SET corps_md = replace(corps_md, '](/ressources/armures/#boucliers)', '](/ressources/equipement/#boucliers)')
WHERE instr(corps_md, '](/ressources/armures/#boucliers)') > 0;

UPDATE page SET corps_md = replace(corps_md, '](/ressources/bouclier/)', '](/ressources/equipement/#boucliers)')
WHERE instr(corps_md, '](/ressources/bouclier/)') > 0;

UPDATE page SET corps_md = replace(corps_md, '](/ressources/armes/)', '](/ressources/equipement/#armes)')
WHERE instr(corps_md, '](/ressources/armes/)') > 0;

UPDATE page SET corps_md = replace(corps_md, '](/ressources/armures/)', '](/ressources/equipement/#armures)')
WHERE instr(corps_md, '](/ressources/armures/)') > 0;

UPDATE page SET corps_md = replace(corps_md, '](/ressources/baton-magique/)', '](/ressources/equipement/#batons-magiques)')
WHERE instr(corps_md, '](/ressources/baton-magique/)') > 0;

UPDATE page SET corps_md = replace(corps_md, '](/ressources/accessoires/)', '](/ressources/equipement/#accessoires)')
WHERE instr(corps_md, '](/ressources/accessoires/)') > 0;

-- 0019-liens-familiers-prototype : le site ne renvoie plus aux classeurs Google « Familiers » et « Prototype » (demande du propriétaire : « Retire tout lien
-- de "prototype" et "famillier" », « les google doc associés »). Migration de DONNÉES (aucun changement de structure : seule la version du schéma monte).
-- Le classeur « Familiers » (copie 1Xhj8DINY6…, registre 0014-sources-copies-drive.json) n'était cité que par deux hyperliens de cellule, repris tels quels :
-- - Mage Bleu!Z3 (« CHOSE A SAVOIR ») : la colonne classe.chose_a_savoir_lien et la ligne « Lien hypertexte attaché à la cellule Z3… » de sa page ;
-- - onglet « Familiers » de « Ressources et Craft », U3 : la ligne « Lien hypertexte attaché à la cellule U3… » de la page ressources/familiers et la phrase
--   qui portait le lien, « Ici pour les fiches : Familiers » (sans son lien, elle ne renvoie plus à rien).
-- Le classeur « Prototype » n'est cité par aucune ligne de la base : il quitte seulement la page des archives (client/src/lib/archives.mjs, DOCUMENTS_RETIRES).
-- L'onglet « Familiers » du classeur « Ressources et Craft » n'est pas le classeur « Familiers » : ses sources restent. Les extracteurs suivent
-- (tools/sheets/classes.py, LINKS_REMOVED ; tools/sheets/divers-craft.py, LINKED_TAILS_REMOVED).

UPDATE classe SET chose_a_savoir_lien = NULL
WHERE id = 'classes/mage-bleu' AND chose_a_savoir_lien = 'https://docs.google.com/spreadsheets/u/0/d/1Xhj8DINY6NlufeHSUnB_mHYyPXEvSBOno32wWZXOEBk/edit';

UPDATE page SET corps_md = replace(corps_md, char(10) || char(10)
  || '*Lien hypertexte attaché à la cellule Z3 dans le classeur d''origine :* <https://docs.google.com/spreadsheets/u/0/d/1Xhj8DINY6NlufeHSUnB_mHYyPXEvSBOno32wWZXOEBk/edit>', '')
WHERE id = 'classes/mage-bleu';

UPDATE page SET corps_md = replace(corps_md, char(10) || char(10) || 'Ici pour les fiches : Familiers' || char(10) || char(10)
  || '*Lien hypertexte attaché à la cellule U3 dans le classeur d''origine :* <https://docs.google.com/spreadsheets/d/1Xhj8DINY6NlufeHSUnB_mHYyPXEvSBOno32wWZXOEBk/edit?usp=sharing>', '')
WHERE id = 'ressources/familiers';

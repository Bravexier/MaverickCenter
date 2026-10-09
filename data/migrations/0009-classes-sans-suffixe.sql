-- 0009-classes-sans-suffixe : « (classe) » retiré du titre des 13 classes raciales (catégorie « Classe Hybride Animal »), à la demande du propriétaire :
-- « Il faut que le (classe) soit supprimé de partout (même de la base) ». Migration de DONNÉES (aucun changement de structure : seule la version du schéma
-- monte). Le titre d'une classe raciale est désormais le nom de l'onglet, comme celui de toutes les autres classes (« Orios ») ; sa clé `titre_cle` est
-- recalculée (normalize, text.mjs). Les identifiants et les adresses ne changent pas (classes/orios), ni les tables typées (classe.nom n'a jamais porté le
-- suffixe). La race et sa classe raciale portent le même nom : un lien [[Orios]] reste ambigu comme avant (la clé « orios » était déjà le slug des deux
-- pages) ; on lève l'ambiguïté par le chemin, [[races/orios]] ou [[classes/orios]]. Le suffixe n'apparaissait nulle part ailleurs dans la base.

UPDATE page SET titre = 'Anansi', titre_cle = 'anansi' WHERE id = 'classes/anansi' AND titre = 'Anansi (classe)' AND titre_cle = 'anansi-classe';
UPDATE page SET titre = 'Fenrir', titre_cle = 'fenrir' WHERE id = 'classes/fenrir' AND titre = 'Fenrir (classe)' AND titre_cle = 'fenrir-classe';
UPDATE page SET titre = 'Goleois', titre_cle = 'goleois' WHERE id = 'classes/goleois' AND titre = 'Goleois (classe)' AND titre_cle = 'goleois-classe';
UPDATE page SET titre = 'Jackalope', titre_cle = 'jackalope' WHERE id = 'classes/jackalope' AND titre = 'Jackalope (classe)' AND titre_cle = 'jackalope-classe';
UPDATE page SET titre = 'Kitsune', titre_cle = 'kitsune' WHERE id = 'classes/kitsune' AND titre = 'Kitsune (classe)' AND titre_cle = 'kitsune-classe';
UPDATE page SET titre = 'Marcass', titre_cle = 'marcass' WHERE id = 'classes/marcass' AND titre = 'Marcass (classe)' AND titre_cle = 'marcass-classe';
UPDATE page SET titre = 'Médusain', titre_cle = 'medusain' WHERE id = 'classes/medusain' AND titre = 'Médusain (classe)' AND titre_cle = 'medusain-classe';
UPDATE page SET titre = 'Minotaure', titre_cle = 'minotaure' WHERE id = 'classes/minotaure' AND titre = 'Minotaure (classe)' AND titre_cle = 'minotaure-classe';
UPDATE page SET titre = 'Namazu', titre_cle = 'namazu' WHERE id = 'classes/namazu' AND titre = 'Namazu (classe)' AND titre_cle = 'namazu-classe';
UPDATE page SET titre = 'Olwman', titre_cle = 'olwman' WHERE id = 'classes/olwman' AND titre = 'Olwman (classe)' AND titre_cle = 'olwman-classe';
UPDATE page SET titre = 'Orios', titre_cle = 'orios' WHERE id = 'classes/orios' AND titre = 'Orios (classe)' AND titre_cle = 'orios-classe';
UPDATE page SET titre = 'Rokh', titre_cle = 'rokh' WHERE id = 'classes/rokh' AND titre = 'Rokh (classe)' AND titre_cle = 'rokh-classe';
UPDATE page SET titre = 'Satyre', titre_cle = 'satyre' WHERE id = 'classes/satyre' AND titre = 'Satyre (classe)' AND titre_cle = 'satyre-classe';

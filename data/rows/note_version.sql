-- data/rows/note_version.sql : export déterministe, une instruction par ligne, triée par (version). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.2', '2026-10-11', '0.1', 'La mise en ligne du serveur live de Maverick.

Import initial depuis les sources historiques.', '16ad95e7-af87-40a7-aba4-f78ee3cf32d7', 0);
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.3', '2026-10-15', '0.2', 'Éléments généraux :
Renforcement general des pages,
Mise en place de clean code automatique par Claude Code.
Mise au propre de certaines donné et import du Codex et Bestiaire des Google doc', '093efaee-6be3-4c99-811d-d03f4f12c325', 0);
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.4', '2026-10-24', '0.3', '-Refonte technique de l''API vers un model REST avec CRUD sur chaque élément de la base.
-Ajout d''un outil de Debug 
-Mode édition étendu à la chronologie et ajout des catégories.
-Prise en charge de l''import / export de fiche de personnages existantes.
-Ajout de la gestion des armes et armure élémentaires dans la fiche de personnage. Intégré aux equipements.
-Corrections esthétiques mineurs dans de nombreuses fiches.
-Correctifs de multiples règles mal implémentées ou ambigues.
-Réorganisation des menus
-Refonte du système de Mots-clés (création de nouveaux mots clés encore à prévoir)', '0612c920-f6b3-461d-a036-9c404066f10c', 0);

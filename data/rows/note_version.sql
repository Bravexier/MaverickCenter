-- data/rows/note_version.sql : export déterministe, une instruction par ligne, triée par (version). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.2', '2026-10-11', '0.1', 'La mise en ligne du serveur live de Maverick.

Import initial depuis les sources historiques.', '16ad95e7-af87-40a7-aba4-f78ee3cf32d7', 0);
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.3', '2026-10-15', '0.2', 'Éléments généraux :
Renforcement general des pages,
Mise en place de clean code automatique par Claude Code.
Mise au propre de certaines donné et import du Codex et Bestiaire des Google doc', '093efaee-6be3-4c99-811d-d03f4f12c325', 0);

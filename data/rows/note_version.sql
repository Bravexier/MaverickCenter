-- data/rows/note_version.sql : export déterministe, une instruction par ligne, triée par (version). NE PAS ÉDITER À LA MAIN.
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.0', '2026-09-01', NULL, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. **Exemple** : cette note n''est pas une vraie version.', NULL, 1);
INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('0.1', '2026-10-01', '0.0', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

- Ut enim ad minim veniam, quis nostrud exercitation.
- Duis aute irure dolor in reprehenderit in voluptate.

*Exemple* : cette note n''est pas une vraie version, elle disparaîtra à la première mise à jour.', NULL, 1);

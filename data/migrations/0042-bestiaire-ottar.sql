-- Décision R64 du propriétaire (2026-10-14) : « Il faudrait également regrouper tous les Ottar (et le presqu'Ottar) sous la même espèce d'Ottar,
-- dont la description était auparavant perdue dans la mauvaise fiche (aujourd'hui supprimée) ». Un groupe d'espèces « Ottar » (titre « Ottar (explication) »
-- du doc, ligne 22728 ; sa description : les quatre paragraphes qui le suivent, tels qu'écrits), et les 22 espèces qui le suivent dont le nom contient
-- « Ottar » : le Presque-Ottar et les 21 Ottar. Aucun identifiant, aucune espèce, aucune carte ne change ; rien n'est déduit (ni type, ni catégorie, ni
-- échelle). La tactique de l'Os du blizzard, où le texte était collé, n'est pas touchée ici : le propriétaire l'en a retiré sur le site de dev (modification
-- en attente de la prochaine mise à jour). Écrite d'après l'écart entre la base et l'extraction (tools/bestiaire/extraire.mjs, TITRE_GROUPE).
CREATE TABLE monstre_groupe (
  id          TEXT    NOT NULL PRIMARY KEY,
  nom         TEXT    NOT NULL CHECK (length(nom) > 0),
  nom_cle     TEXT    NOT NULL CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),
  description TEXT,
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'monstres'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0)
) STRICT;

ALTER TABLE monstre_espece ADD COLUMN groupe_id TEXT REFERENCES monstre_groupe(id);

INSERT INTO monstre_groupe (id, nom, nom_cle, description, origine, source_ref) VALUES ('monstres/ottar', 'Ottar', 'ottar', 'Les Ottars ont été des êtres humanoïdes de tout horizon sans histoire pour la plupart, mais un jour, un tragique événement les ont profondément affecté au point que leur chakra s''est totalement effondré sur lui-même et dégénéré.

Selon les situations, les évènements, le sexe, les races, l''ottar peut être différent, mais dans tout les cas il s''agit d''abominations chakratiques qui n''aspire que la destruction, où il est nécessaire de détruire le plus rapidement possible avant qu''il ne fasse trop de dégâts.

L’effondrement chakratique peut être ressenti par tout le monde, il est facile de reconnaître un ottar quand il fait face, bien que certains soient capables de se cacher aux yeux de tous.

Se transformer en Ottar reste extrêmement rare, il faut que l''évènement soit très grave pour la personne et la santé mentale doit être particulièrement faible. (les joueurs peuvent le devenir mais ça doit être discuté avec le mj et le créateur si jamais il y a doute sur le concept de l''Ottar visé)', 'monstres', 'Bestiaire 2.0 › lignes 22728-22738');

UPDATE monstre_espece SET groupe_id = 'monstres/ottar' WHERE id IN (
  'monstres/presque-ottar',
  'monstres/ottar-amoureux',
  'monstres/ottar-chariot',
  'monstres/ottar-diable',
  'monstres/ottar-etoile',
  'monstres/ottar-empereur',
  'monstres/ottar-force',
  'monstres/ottar-fou',
  'monstres/ottar-grande-pretresse',
  'monstres/ottar-imperatrice',
  'monstres/ottar-isole',
  'monstres/ottar-justice',
  'monstres/ottar-jugement',
  'monstres/ottar-lune',
  'monstres/ottar-magicien',
  'monstres/ottar-monde',
  'monstres/ottar-mort',
  'monstres/ottar-pendu',
  'monstres/ottar-roue-du-destin',
  'monstres/ottar-soleil',
  'monstres/ottar-temperence',
  'monstres/ottar-tour'
);

-- Décision R65 du propriétaire (2026-10-14) : « Il faudra faire la distinction entre la description de l'espèce, et celle de la créature elle-même. Je
-- te laisse faire l'arbitrage. Les deux sont affichés dans le même endroit, l'espèce en premier, l'individu dans un second temps (si présent, séparés
-- par un retour à la ligne.) » La description de l'espèce est celle de son groupe (`monstre_groupe`, les Ottar : décision R64), sinon celle de
-- `monstre_espece` ; celle de la créature, celle d'une espèce d'un groupe (chaque Ottar), sinon celle de sa carte : cette colonne, que le doc n'écrit
-- pas (NULL partout) et que le site de dev modifie.
ALTER TABLE monstre ADD COLUMN description TEXT;

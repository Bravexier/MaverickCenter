-- 0132-connexion-discord : la table utilisateur prête pour la connexion par Discord (décision R310 du 2026-11-27 ; feuille de route E7 : « Le
-- compte local que prévoyait la table `utilisateur` (`discord_id` NULL) n'a plus d'usage et se retire à la réalisation »). Migration de STRUCTURE
-- seule : elle n'écrit aucune valeur.
--   1. utilisateur reconstruite (SQLite ne rend pas une colonne NOT NULL) : discord_id devient obligatoire (plus de compte local) ; cinq colonnes
--      en dernier, ce que R310 (5) garde : niveau (R310 (2), recalculé à chaque connexion), avatar_url, banniere_url, serveur_rejoint_le
--      (`joined_at` du membre), derniere_connexion_le. Ni e-mail, ni jeton, ni rôles Discord bruts (R310 (5)).
--   2. Aucun compte n'existe : rien n'écrit la table hors des tests (aucune connexion avant ce lot). Une ligne existante n'a ni niveau, ni avatar,
--      ni date de connexion, et rien ne permet de les déduire : la recopie leur donne NULL, donc toute ligne fait ÉCHOUER la migration (contrainte
--      NOT NULL, transaction annulée, base intacte) plutôt que de perdre un compte et ses fiches ou d'inventer ses valeurs.
--   3. La vue v_personnage_visible lit la table : SQLite refuse de renommer la table neuve tant qu'une vue cite la table retirée. Elle est retirée
--      puis recréée À L'IDENTIQUE (corps de la migration 0038, inchangé : sa correspondance avec les quatre niveaux relève d'E8).
--   Les clés étrangères vers utilisateur (utilisateur_role, personnage, personnage_partage, groupe_membre, modification_lot) visent le nom de la
--   table : elles suivent la table reconstruite sans être réécrites (clés étrangères suspendues pendant la migration, contrôlées avant le COMMIT).

DROP VIEW v_personnage_visible;

CREATE TABLE utilisateur_0132 (
  id                     TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  discord_id             TEXT    NOT NULL UNIQUE CHECK (length(discord_id) > 0 AND discord_id NOT GLOB '*[^0-9]*'),
  nom_affichage          TEXT    NOT NULL CHECK (length(nom_affichage) > 0),
  cree_le                TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  niveau                 TEXT    NOT NULL CHECK (niveau IN ('observateur', 'joueur', 'mj', 'createur')),
  avatar_url             TEXT    NOT NULL CHECK (avatar_url GLOB 'https://cdn.discordapp.com/?*'),
  banniere_url           TEXT    CHECK (banniere_url IS NULL OR banniere_url GLOB 'https://cdn.discordapp.com/?*'),
  serveur_rejoint_le     TEXT    CHECK (serveur_rejoint_le IS NULL OR serveur_rejoint_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  derniere_connexion_le  TEXT    NOT NULL CHECK (derniere_connexion_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;

INSERT INTO utilisateur_0132 (id, discord_id, nom_affichage, cree_le, niveau, avatar_url, banniere_url, serveur_rejoint_le, derniere_connexion_le)
  SELECT id, discord_id, nom_affichage, cree_le, NULL, NULL, NULL, NULL, NULL FROM utilisateur;

DROP TABLE utilisateur;
ALTER TABLE utilisateur_0132 RENAME TO utilisateur;

CREATE VIEW v_personnage_visible AS
  SELECT p.id AS personnage_id, p.proprietaire_id AS utilisateur_id, 'proprietaire' AS motif, NULL AS groupe_id
  FROM personnage p WHERE p.proprietaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'admin', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE r.role = 'admin'
  UNION ALL
  SELECT p.id, u.id, 'tous', NULL
  FROM personnage p CROSS JOIN utilisateur u WHERE p.visibilite = 'tous'
  UNION ALL
  SELECT p.id, r.utilisateur_id, 'mj', NULL
  FROM personnage p CROSS JOIN utilisateur_role r WHERE p.visibilite = 'mj' AND r.role = 'mj'
  UNION ALL
  SELECT i.personnage_id, m.utilisateur_id, 'groupe', i.groupe_id
  FROM groupe_membre i JOIN groupe_membre m ON m.groupe_id = i.groupe_id
  WHERE i.personnage_id IS NOT NULL
  UNION ALL
  SELECT s.personnage_id, s.utilisateur_id, 'partage', NULL
  FROM personnage_partage s;

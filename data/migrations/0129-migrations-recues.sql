-- 0129-migrations-recues : la table qui note ce que la base a reçu (chantier « la base du site de dev devient la source de vérité », R274, R275 ;
-- docs/chantier-base-de-dev.md, lot 7 : « Une table note ce que la base a reçu »).
-- Migration de STRUCTURE seule (section 14 ; PRAGMA user_version 128 -> 129) : une table neuve, sans texte de règle ni donnée de contenu, vide dans
-- data/rows (la base du dépôt ne « reçoit » rien : chaque base vivante remplit la sienne) ; rien ne va dans historique_modification.
--   migration_recue : une ligne par migration data/migrations/NNNN-<nom>.sql reçue par CETTE base — son numéro, son fichier, l'empreinte sha256 du
--   fichier SQL reçu, l'instant, le mode (« reconstruction » : base refaite depuis le dépôt à cette version ; « sur_place » : appliquée par le
--   service à la base en place) et la version du site qui l'a appliquée.
-- La table est « propre au site » (lib/tables-de-la-base.mjs#TABLES_DU_JOURNAL) : jamais dans un extrait ni un paquet ; la base vivante la recopie
-- à la reconstruction comme le journal (serveur/base-vivante.mjs#TABLES_VIVANTES).

CREATE TABLE migration_recue (
  numero          INTEGER NOT NULL PRIMARY KEY CHECK (numero >= 1),        -- le NNNN du fichier (« 129 » pour 0129-…)
  fichier         TEXT    NOT NULL CHECK (fichier GLOB '[0-9][0-9][0-9][0-9]-?*.sql' AND fichier NOT GLOB '*[^a-z0-9.-]*'
                                          AND CAST(substr(fichier, 1, 4) AS INTEGER) = numero),
                                                                           -- nom du fichier dans data/migrations/ (« 0129-migrations-recues.sql »)
  empreinte       TEXT    NOT NULL CHECK (length(empreinte) = 64 AND empreinte NOT GLOB '*[^0-9a-f]*'),
                                                                           -- sha256 du fichier SQL reçu, octets tels quels, en hexadécimal minuscule :
                                                                           -- une migration fusionnée ne se modifie plus, un écart se voit
  recue_le        TEXT    NOT NULL CHECK (recue_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
  mode            TEXT    NOT NULL CHECK (mode IN ('reconstruction', 'sur_place')),
                                                                           -- 'reconstruction' : base refaite depuis le dépôt à une version qui la
                                                                           -- contient ; 'sur_place' : appliquée par le service à la base en place
  version_du_site TEXT    CHECK (version_du_site IS NULL OR (version_du_site GLOB '[0-9]*.[0-9]*.[0-9]*'
                                 AND version_du_site NOT GLOB '*[^0-9.]*' AND version_du_site NOT GLOB '*.*.*.*'))
                                                                           -- version X.Y.Z du site qui l'a reçue (client/package.json) ; NULL : non dite
) STRICT;

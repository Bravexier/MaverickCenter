---
name: zone-fiches-base
description: "Section 13 de data/schema.sql : tables des fiches de personnages (personnage, personnage_*), utilisateurs, groupes, vues v_personnage_*, v_groupe_controle ; rien de calculé stocké, visibilité, retraits R42. À charger avant de lire, modifier ou relire ces tables, leurs migrations ou leurs tests."
paths: ["data/migrations/0011-personnages.sql", "data/migrations/0074-refonte-maitrises-armes.sql", "data/migrations/0031-fiche-zones.sql", "data/migrations/0038-personnage-sans-statut.sql", "data/migrations/0045-gains-entrainement-durabilite.sql", "data/migrations/0055-armure-une-armure-six-parties.sql", "data/migrations/0060-fiche-bouclier-accessoires.sql", "data/migrations/0062-fiche-entrainement-acquis.sql", "data/migrations/0066-nm-mj-fiche.sql", "data/migrations/0067-grenades-sort-prepare-arme-choisie.sql", "data/migrations/0069-armes-a-distance-resistance-du-drakos-orange.sql", "data/migrations/0071-sort-prepare-resistances-a-une-magie.sql", "client/serveur/fiches-retraits.mjs", "client/test/personnages-db.test.mjs", "client/test/serveur-fiches-retraits.test.mjs", "client/test/fiche-format-retirees.test.mjs", "docs/character-generator.md"]
user-invocable: false
---
# Fiches de personnages dans la base (section 13)

## Fichiers
- Tables et vues : section 13 de `data/schema.sql` (migration `0011-personnages`, puis 0031, 0038, 0045, 0055, 0060, 0062, 0066, 0067, 0069, 0071, 0074).
- Retraits R42 : `client/serveur/fiches-retraits.mjs` (`RETRAITS`) ; texte de la ligne : `client/src/lib/fiche-format.mjs#ligneDeRetrait`.
- Format JSON d'une fiche, `TABLES_FICHES`, `PARTIES_DE_FICHE`, `HORS_FICHE`, `TABLES_RETIREES`, `COLONNES_RETIREES` : `client/src/lib/fiche-format.mjs` (le service et la base vivante : skill `zone-service`).
- Calculs de la fiche à partir de ces choix : skill `zone-fiche`. Écrire une migration : skill `ecrire-une-migration`.

## À lire
- `docs/character-generator.md`, « Fiches dans la base » : principe, R42, joueurs, prétirés, groupes et visibilité, tableau des tables (cellule de la fiche auto pour chacune), vues.
- `docs/serveur.md`, « La base vivante (`db/`) » et « Fiches de personnage (R42) ».
- `docs/sql/a-valider.md` §3 : bugs de la fiche auto relevés (non reproduits) et questions.

## Invariants
- Les tables gardent les choix du joueur (race, ethnie, magies, classes, caractéristiques de base et croix (R19), points de compétences, gains de niveau, dons à choix, sorts et NM, équipement), la cellule de la fiche auto V15.2.2 citée en commentaire.
- Rien de ce que la fiche calcule n'est stocké (niveaux, santé, totaux…) : une règle corrigée corrige toutes les fiches.
- Les tables restent vides dans `data/rows`. Les fiches réelles vivent dans la base vivante du service (`db/` de l'instance), jamais dans git ni dans `/donnees/maverick.db`.
- Une fiche ne garde que des identifiants de règles : un élément modifié ou renommé ne touche pas les fiches.
- Plus de statut brouillon / validé / archivé (demande du propriétaire, migration `0038-personnage-sans-statut`) : toute fiche est contrôlée, même inachevée (race et magie innée manquantes comprises), et rien n'empêche de l'enregistrer. La colonne disparue est dans `COLONNES_RETIREES` (`fiche-format.mjs`) : la base vivante la perd sans bloquer, et un JSON qui la porte encore est lu sans elle.
- `v_personnage_controle` : une ligne par règle enfreinte, vide pour une fiche conforme. Toute règle ajoutée à la vue a son libellé dans `lib/fiche-controles.mjs` (skill `zone-fiche`).
- Une table ajoutée, retirée ou une clé étrangère de plus vers `metier`, `specialite`, `capacite`, `sort` ou `arme` : suivre les listes de `fiche-format.mjs` et `RETRAITS` (skill `zone-service`).

## Colonnes et tables à connaître
- Gains de niveau : deux totaux, `personnage.gains_sante` et `gains_chakra` (R73, migration `0045-gains-entrainement-durabilite` : plus de table `personnage_progression`), contrôlés par la règle `gains_niveau` (15 points par niveau à partir du 2, plus 1 à 8 par dé atteint : `niveau_global.de_attributs_min`, `de_attributs_max`, cumuls de `v_niveau`).
- Entraînement : des lignes de `personnage_entrainement` (R104, migration 0062 ; le texte libre `personnage.entrainement` de R71 est retiré). Choix d'acquis des dons : `personnage_acquis_choix` ; l'arme du bonus « de l'arme choisie » (R119) est la famille de la maîtrise au choix de la classe (R152 : `arme_famille_id` retirée par 0074).
- `personnage_arme.durabilite` (R74 : NULL = à son maximum, 0 = cassée).
- Armure dans `personnage` (`armure_id`, `armure_amelioration_id`, `armure_elementaire_id`, `armure_amelioration_elementaire_id`) et `personnage_armure_partie` (R95 : la solidité du moment d'une partie abîmée ; sans ligne, à son maximum).
- Sort préparé dans `personnage_sort` (`prepare`, `prepare_jet`, `prepare_posture_id`), un seul par fiche (R115, migration 0067).
- Résistance au choix : `personnage_resistance_choix`, une altération d'une ligne de tableau de race (R124, migration 0069) ou une magie au choix ou tirée d'un don (`magie_id`, R137, migration 0071 ; l'une ou l'autre).
- NM du MJ pour toute la fiche : `personnage.nm_mj` (R118, migration 0066). NM gagnés d'un don acquis : `capacite_nm_gagne` × `v_personnage_don_acquis`, comptés par `sorts_nm_total` (R154, migration 0074 ; `sort_nm_max` ne les lit pas).

## Maîtrises d'armes (décisions R148 à R154, migration 0074)
- Plus rien ne se saisit par famille : `personnage_maitrise_arme` est retirée. Une ligne de `personnage_maitrise_choix` par point à choisir : `source` (id du don, ou `<classe>#maitrise-arme:<rang>` : `lib/maitrise-arme.mjs#idDeSourceDeClasse`, sans clé étrangère), `rang` (le numéro du point dans la part à choisir de la source), `arme_famille_id`.
- Les règles, section 6 : `maitrise_arme_part` (parts `imposee`, `choix` avec `limite_famille` écrite, `suit`), `maitrise_arme_part_famille` (options), `capacite_nm_gagne`. Écrites par le lecteur `lib/maitrise-arme.mjs` ; `test/maitrise-arme-sources.test.mjs` le rejoue sur toute la base : un texte de don ou de ligne de classe modifié demande de réécrire ces lignes.
- Vues : `v_personnage_don_acquis` (miroir de `donsAcquis`), `v_personnage_maitrise_part` (parts des sources acquises), `v_personnage_maitrise_arme` (`points` au moins 0, `points_comptes` au plus 4, `des`, constantes `maitrise_arme.*` ; jamais un 4 écrit).
- Règles de `v_personnage_controle` : `maitrise_a_choisir` (« source = points à choisir » ; l'accessoire : `accessoire:<emplacement>`), `maitrise_hors_choix` et `maitrise_source_perdue` (« source : point = famille »), `maitrise_meme_famille` (limites écrites seulement, R150 : « source : famille = points / limite »), `maitrise_plafond` (R149 : « famille = points / 4 », signalé, jamais refusé), `maitrise_arme_exclue` (R45). Une ligne de choix relève d'une seule règle : exclue, puis source perdue, puis hors choix.
- L'accessoire « Un point de maîtrise d'arme » : `accessoire_effet_cible.choix = 1`, sa famille dans `personnage_accessoire.arme_famille_id` ; ±1, maudit −1 (R54).
- Format JSON : clé `maitrise_choix` (`PARTIES_DE_FICHE`) ; `personnage_maitrise_arme` dans `TABLES_RETIREES` (`maitrises_armes`), `personnage_acquis_choix.arme_famille_id` dans `COLONNES_RETIREES`. Les fiches d'avant (base vivante, JSON reçu) : une ligne datée, aucun choix posé (R153 : skill `zone-service`, « Conversions en place »).

## Visibilité et groupes (demande du propriétaire)
- Fiche de joueur : visible de lui seul et des administrateurs, ouvrable à des utilisateurs désignés (`personnage_partage`), à tous les MJ ou à tous. Prétiré : à personne, visible par tous.
- Groupes de jeu (one-shot, campagne : `groupe`, `groupe_membre`) : une fiche inscrite par membre et par groupe, visible des membres de ce groupe.
- Rôles cumulables `mj`, `editeur`, `admin` (`utilisateur_role`).
- Qui voit quoi : `v_personnage_visible` ; inscriptions : `v_groupe_controle`. Niveaux : `v_personnage_niveau` (R2).

## Retraits (décision R42)
- Un don, une spécialité (avec ses dons choisis), un sort ou un métier (et une arme : R52) supprimé des règles est retiré des fiches : sur le site de dev, dans le lot ; à la livraison, à la reconstruction de la base vivante, après le rejeu.
- Une ligne datée par élément s'ajoute à la fin de `notes` (`lib/fiche-format.mjs#ligneDeRetrait`).
- Ces écritures se font en SQL direct (`serveur/fiches-retraits.mjs`), jamais par le rédacteur du journal `w`, qui refuse la section 13 (`TABLES_INTERDITES` de `serveur/edition-journal.mjs`). Rien des fiches ne va au journal, dans `data/rows` ni dans le résumé d'un lot.
- Une race, une classe ou une magie disparue bloque toujours la reconstruction, y compris par un don, une spécialité ou un sort qui en relève (non retiré).

## Tests
- `test/personnages-db.test.mjs` : écrit dans une copie de la base (contrôles de `v_personnage_controle`, visibilité, groupes, maîtrises d'armes R148 à R154 ; `maitrisesDeClasseChoisies` pose les maîtrises au choix après un changement de classe).
- `test/maitrise-arme-sources.test.mjs` : rejeu du lecteur sur `maitrise_arme_part`, `maitrise_arme_part_famille`, `capacite_nm_gagne`.
- `test/serveur-fiches-retraits.test.mjs` (R42), `test/fiche-format-retirees.test.mjs` (tables et colonnes retirées), `test/tables-de-la-base.test.mjs`.

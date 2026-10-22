# Remplissage de la base

La base SQLite (`var/maverick.db`, jamais commitée) est une **copie reconstruite** : elle sort de `data/schema.sql` (structure) et de `data/rows/` (les lignes,
une instruction `INSERT` par ligne, triées, un fichier par table : un diff git est lisible). Aucune IA n'intervient : tout est déterministe.

```bash
cd client
npm run db:build         # schéma + lignes + tables dérivées (liens, plein texte) -> var/maverick.db, environ 3 s
npm run db:check         # contrôles d'intégrité (clés, entités rattachées aux pages, trace des corrections…) : code 1 au moindre problème
npm run db:pages-check   # les pages de data/rows sont-elles celles des .md ?
npm run db:sync-pages    # remet à jour data/rows depuis les .md (contenu des pages existantes), puis commiter
```

## Ce qui est rempli

Pages (991), magies et sorts, annexes des magies, règles de la fiche, classes et capacités, races, bestiaire, équipement et craft, notes de cellule, écarts
entre sources, trace des corrections orthographiques : voir [`structure.md`](structure.md) pour les tables, `npm run db:build` pour les comptes.

## Qui met quoi à jour

| Donnée | Mise à jour | Garde |
| --- | --- | --- |
| Contenu des **pages** (titre, résumé, corps, mots-clés, sources) | `npm run db:sync-pages` depuis les `.md` fabriqués (modifiés à la main ou réécrits par un extracteur) | `client/test/db-donnees.test.mjs` échoue si `data/rows` n'est plus celui des `.md` |
| **Lignes typées** (sorts, capacités, races, créatures, armes…) | ⚠️ lignes validées en séance, produites par des chargeurs de **prototype** qui lisaient les classeurs ; ils ne sont pas dans le dépôt | aucune : si un classeur change, ces lignes ne bougent pas tant que l'importeur de la famille n'est pas porté |
| **Monstres du « Bestiaire 2.0 »** (tables `monstre_*`, famille `monstres`) | `tools/bestiaire/extraire.mjs` relit l'export texte du doc (`sources/raw/bestiaire-2-0.txt`) ; une nouvelle version du doc = un nouvel export puis une migration ([`../bestiaire.md`](../bestiaire.md)) | `client/test/bestiaire-extraction.test.mjs` échoue si la base n'est plus l'extraction de l'export |
| **Chronologie** (tables `evenement`, `evenement_extrait`, famille `chronologie`) | le registre `tools/chronologie/evenements.json` (extraits repérés dans les pages du Codex et des races), résolu par `tools/chronologie/chronologie.mjs --sql` en une migration ([`../chronologie.md`](../chronologie.md)) ; un nouvel export du Codex : `--verifier` dit les extraits à reprendre | `client/test/chronologie.test.mjs` échoue si la base n'est plus le registre résolu sur les pages d'import |
| **Ajout ou retrait d'une page** `docs` ou `exemple` | à la main : créer ou supprimer le `.md` puis `db:sync-pages` | idem |
| **Ajout ou retrait d'une autre page** (magie, classe, race…) | importeur de sa famille (lots 4 à 10 de [`conception.md`](conception.md) §11) | `db:sync-pages` refuse et le dit |

Autrement dit : ajouter ou modifier du texte de page est couvert ; **réimporter un classeur modifié dans les tables typées demande de porter l'importeur
correspondant** (travail par famille, le plus gros chantier restant). Le site tire de la base **toutes ses pages** (fichiers `.md` fabriqués au build, voir ci-dessous) et l'onglet **DB** (explorateur de données).

## Pourquoi `data/rows` est commité

C'est la seule persistance versionnée de la base : elle rend le contenu relisible dans git, reconstruit la base en quelques secondes sans accès à Google, et
sert de référence aux importeurs à venir (un importeur porté doit redonner ses lignes octet pour octet, ou chaque différence s'explique). Les fichiers sont
protégés par `.gitattributes` (`eol=lf`). En cas de conflit git dans `data/rows`, on relance l'importeur ou `db:sync-pages`, jamais de résolution à la main.

## Explorateur de données du site (`/donnees/`)

Le site affiche toutes les tables et vues de la base, en lecture seule : `/donnees/` (liste par domaine, avec le nombre de lignes) et `/donnees/<table>/` (colonnes, type,
description du schéma, puis toutes les lignes avec filtre et tri). Une valeur absente est marquée ∅. Une clé étrangère est un lien vers la ligne de l'autre table ; une ligne
qui a sa page dans le wiki porte un lien ↗. La table `page` n'affiche que la longueur du texte : le texte intégral est dans le wiki.

- **Au build, sans étape préalable** : `src/lib/donnees.mjs` construit la base dans un dossier temporaire avec `db-build.mjs` et `db-derive.mjs` (les mêmes scripts que `npm run db:build`,
  environ 3 s), puis la lit avec `node:sqlite`. `HIDE_EXAMPLES=1` retire les pages d'exemple. Le build doit donc se lancer dans un dépôt complet (`data/` présent) : c'est le cas de la CI,
  de `livraison.yml` (après chaque fusion : les installateurs) et de `deploy/build.sh`.
- **Logique testée** (`client/test/donnees.test.mjs`) : ancres uniques et sans collision pour chaque ligne de chaque table, chaque lien de clé étrangère mène à une ligne qui existe,
  un sort renvoie à sa magie, une capacité à sa page. Les gabarits Astro (`src/pages/donnees/`) ne contiennent que des boucles.
- **Poids** : environ 15 Mo de HTML (la plus grosse page, `relation_peuple`, fait 2,8 Mo avant compression).

## Les pages du wiki viennent de la base

Les fichiers `client/src/content/wiki/<type>/<slug>.md` **ne sont plus dans git** (ignorés) : `npm run db:export-pages` les fabrique depuis `data/rows` (environ 3 s), automatiquement avant
`npm run dev`, `npm run build` et `npm test` (scripts `pre…`) et au début de `tools/build-artifact.mjs`. Le site, les liens `[[…]]` et les extracteurs `tools/sheets/*.py` les lisent donc comme avant.
Le format écrit est le sous-ensemble YAML des importeurs (`src/lib/pages-db.mjs`) ; les pages de magies sont écrites octet pour octet comme leur importeur les écrit. Au moment de la bascule, le
site construit avec ces fichiers fabriqués était identique (`diff -r`, 1 527 pages) à celui construit avec les anciens `.md` committés.

Un `.md` fabriqué qu'on modifie est écrasé au prochain `db:export-pages` tant que `db:sync-pages` n'a pas recopié la modification dans `data/rows`.

## Changer le schéma : `npm run db:migrate`

Un changement de structure se fait par une **migration** `data/migrations/NNNN-<nom>.sql` (additive : nouvelle table, `ADD COLUMN` facultatif ; cassante : avec le SQL explicite) : modifier `data/schema.sql`
(nouvelle colonne **en dernier**, `PRAGMA user_version` + 1), écrire la migration, puis **avant de commiter** `npm run db:migrate -- ../data/migrations/NNNN-<nom>.sql` (dans `client/`). Il transforme les lignes
déjà commitées, sans accéder aux classeurs : reconstruit la base de la version précédente (schéma du dernier commit), exécute la migration, vérifie que le schéma obtenu est exactement `data/schema.sql`,
et réécrit `data/rows` avec la nouvelle version. Voir `docs/sql/conception.md` §10.1. Migrations en place : `0002-remarque.sql` (nouvelle colonne), `0003-orthographe-magies.sql` (migration de **données** : seules les lignes changent, avec un registre `.json` des corrections ; la version du schéma monte quand même d'un cran),
`0004-bonus-maitrise.sql` (structure et données : colonnes `sort.mode_brut` et `sort.bonus_maitrise`, tables `sort_mode` et `sort_bonus_maitrise` qui remplace `sort_progression_nm`, vue `v_sort_bonus_au_nm`, registre `.json`),
`0005-orthographe-base.sql` (données : passe complète d'orthographe sur toute la base, registre `.json`),
`0006-orthographe-noms.sql` (structure et données : les sept tables qui dérivaient l'id du nom sont reconstruites sans cette contrainte, puis les noms à trancher sont corrigés partout et leurs clés recalculées ; registre `.json`), `0007-races-onglet.sql` (structure et données : contenu de l'onglet de chaque race,
tables `race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, colonne `mode_hyper_effet.nom` et version `onglet_race`, vue `v_regard_peuple` ; écrite par `tools/db/races_onglet.py --ecrire`
depuis les pages de race, `--verifier` contrôle que les tables sont toujours celles des pages), `0008-dons-de-classe.sql` (données : le type de page `capacites` s'affiche « Dons de classe »,
singulier « Don », dans `type_page` ; ids, adresses et table `capacite` inchangés), `0009-classes-sans-suffixe.sql` (données : « (classe) » retiré du titre des 13 classes raciales, clés de titre recalculées), `0010-mono-magie.sql` (structure et données, décision R15 :
colonne `magie.mono_magie`, 1 pour le Potentiel Illimité et la Corruption, table `magie` reconstruite ; l'Elfe Noir Salé retiré des ethnies de la Corruption), `0011-personnages.sql` (structure et données : tables des fiches de personnages, des groupes de jeu et des rôles, section 13, vides dans `data/rows` ; vues `v_personnage_niveau`,
`v_personnage_visible`, `v_groupe_controle` et `v_personnage_controle` ; trois constantes de la fiche dans `regle_constante` : voir `docs/character-generator.md`, « Fiches dans la base »), `0012-eaunoire.sql` (données, décision R21 :
la déesse de la Corruption s'appelle « Eaunoire », dans `dieu.nom` et la phrase de l'Elfe noir, page et onglet ; identifiant `demon-deau-noire` inchangé), `0013-lamia-corruption.sql` (données, décision R22 :
la Lamia a la Corruption en magie innée, case E24 de la matrice `race_magie` et page de la Lamia, front matter et section « Magies accessibles »), `0014-sources-copies-drive.sql`
(données : les documents Google cités pointent sur leurs copies du Drive du propriétaire, registre `0014-sources-copies-drive.json` ; la table `source`, dont l'id dérive de
l'identifiant Google, est réécrite avec ses renvois `page_source`, ainsi que les liens du corps des pages, du Mage Bleu et des ressources d'Alchimie ; voir `docs/sources.md`),
`0015-archimage-potentiel-illimite.sql` (structure et données, décision R23 : colonne `classe.magie_innee_id` en dernier par `ADD COLUMN`, avec son index partiel unique, Potentiel Illimité
pour l'Archimage d'après son « CHOSE A SAVOIR » ; règles `classe_reservee` et `classe_imposee` de `v_personnage_controle`), `0016-maitrise-arme.sql`
(données : constantes `maitrise_arme.des_sans_maitrise` (1 dé, guide) et `maitrise_arme.des_max` (5 dés, liste « 1d » à « 5d » de la fiche auto) : 4 points de maîtrise au plus),
`0017-edition.sql` (structure : journal des modifications faites depuis le site de dev, section 14, tables vides dans `data/rows`), `0018-nm-excedentaires.sql`
(structure, décision R24 : la règle `sorts_nm_total` quitte `v_personnage_controle`, plus de NM que ceux gagnés est permis),
`0019-liens-familiers-prototype.sql` (données, demande du propriétaire : plus aucun lien vers les classeurs « Familiers » et « Prototype » ; l'hyperlien « CHOSE A SAVOIR » du Mage Bleu,
`classe.chose_a_savoir_lien` et sa ligne dans la page, et celui de la page `ressources/familiers` avec la phrase qui le portait sont retirés ; la page `/archives/` ne montre plus ces classeurs), `0020-mage-bleu-potentiel-illimite.sql`
(structure et données, décision R25 : colonne `classe.magie_innee_exclue_id`, Potentiel Illimité pour le Mage Bleu d'après son « CHOSE A SAVOIR » ; règle `classe_exclue`),
`0021-nm-plafond.sql` (structure et données, décision R26 : colonnes `personnage_sort.nm_livre` et `nm_cadeau`, constante `sort.nm_max` = 3 et sa phrase dans le guide ; règles `sort_nm_plafond`, `sort_nm_max` et `sorts_nm_total` sur les NM de niveau).
`0022-lamia-une-seule-magie.sql` (structure et données, décision R28 : colonne `race.mono_magie`, à 1 pour la Lamia seule — « Une seule magie autorisé », inconvénients de son onglet —, table reconstruite comme `magie` en 0010 ; règle `race_mono_magie` de `v_personnage_controle`).
`0026-acquis-caracteristique-totale.sql` (structure, décision R41 : la règle `competence_acquis_max` de `v_personnage_controle` compte la caractéristique totale, le +1 de la magie innée compris).
`0027-posture-du-moment.sql` (structure, demande du propriétaire : colonne `personnage.posture_id`, la posture du moment, choisie parmi les six de `posture`).
`0028-note-0-2-import-initial.sql` (données, demande du propriétaire : la note de la V0.2 ne liste plus ses modifications — `note_version_ligne` de la V0.2 retirées — et son
texte dit « Import initial depuis les sources historiques » au lieu de « Pour le moment en V0.2 » ; `historique_modification` reste).

## La colonne `remarque`

Chaque table d'entités (les 59 tables que visent `page_entite`, `note_cellule` et `ecart_source`, hors `page`) a une colonne `remarque` : texte libre, **vide par défaut**. Les notes de cellule des classeurs y sont
recopiées dans la ligne qu'elles commentent (sorts, capacités, armes, armes élémentaires, effets d'accessoire, créatures, maladies) ; plusieurs notes sur une ligne sont réunies, séparées par une ligne vide. La table
`note_cellule` garde chaque note avec sa cellule d'origine et sa nature (note ou commentaire résolu). `npm run db:check` vérifie qu'aucune note n'est absente de la remarque de sa ligne. La remarque est dans le plein
texte des entités et dans l'explorateur de l'onglet DB.

## L'onglet DB

`/donnees/` (onglet **DB** du site) : toutes les tables et vues, ligne par ligne. `/donnees/maverick.db` : la base SQLite elle-même, en téléchargement, pour la déboguer avec un outil externe
(DB Browser for SQLite, `sqlite3`). La version portable (page claude.ai) n'embarque pas ce fichier.

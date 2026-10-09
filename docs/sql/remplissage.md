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
  de `livraison.yml` (après chaque fusion : le site avant la 1.0, les installateurs ensuite) et de `deploy/build.sh`.
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
colonne `magie.mono_magie`, 1 pour le Potentiel Illimité et la Corruption, table `magie` reconstruite ; l'Elfe Noir Salé retiré des ethnies de la Corruption), `0011-personnages.sql` (structure et données : tables des fiches de personnages, section 13, vides dans `data/rows` ; vues `v_personnage_niveau` et
`v_personnage_controle` ; trois constantes de la fiche dans `regle_constante` : voir `docs/character-generator.md`, « Fiches dans la base »).

## La colonne `remarque`

Chaque table d'entités (les 60 tables que visent `page_entite`, `note_cellule` et `ecart_source`, hors `page`) a une colonne `remarque` : texte libre, **vide par défaut**. Les notes de cellule des classeurs y sont
recopiées dans la ligne qu'elles commentent (sorts, capacités, armes, armes élémentaires, effets d'accessoire, créatures, maladies) ; plusieurs notes sur une ligne sont réunies, séparées par une ligne vide. La table
`note_cellule` garde chaque note avec sa cellule d'origine et sa nature (note ou commentaire résolu). `npm run db:check` vérifie qu'aucune note n'est absente de la remarque de sa ligne. La remarque est dans le plein
texte des entités et dans l'explorateur de l'onglet DB.

## L'onglet DB

`/donnees/` (onglet **DB** du site) : toutes les tables et vues, ligne par ligne. `/donnees/maverick.db` : la base SQLite elle-même, en téléchargement, pour la déboguer avec un outil externe
(DB Browser for SQLite, `sqlite3`). La version portable (page claude.ai) n'embarque pas ce fichier.

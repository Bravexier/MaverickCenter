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
| Contenu des **pages** (titre, résumé, corps, mots-clés, sources) | `npm run db:sync-pages` depuis les `.md` | `client/test/db-donnees.test.mjs` échoue si `data/rows` n'est plus celui des `.md` |
| **Lignes typées** (sorts, capacités, races, créatures, armes…) | ⚠️ lignes validées en séance, produites par des chargeurs de **prototype** qui lisaient les classeurs ; ils ne sont pas dans le dépôt | aucune : si un classeur change, ces lignes ne bougent pas tant que l'importeur de la famille n'est pas porté |
| **Ajout ou retrait d'une page** | importeur de sa famille (lots 4 à 10 de [`conception.md`](conception.md) §11) | `db:sync-pages` refuse et le dit |

Autrement dit : ajouter ou modifier du texte de page est couvert ; **réimporter un classeur modifié dans les tables typées demande de porter l'importeur
correspondant** (travail par famille, le plus gros chantier restant). Le site lit la base **pour l'explorateur de données** (ci-dessous) ; ses pages du wiki viennent toujours des `.md`.

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
  de `publish-site.yml` (qui republie aussi quand `data/**` change) et de `deploy/build.sh`.
- **Logique testée** (`client/test/donnees.test.mjs`) : ancres uniques et sans collision pour chaque ligne de chaque table, chaque lien de clé étrangère mène à une ligne qui existe,
  un sort renvoie à sa magie, une capacité à sa page. Les gabarits Astro (`src/pages/donnees/`) ne contiennent que des boucles.
- **Poids** : environ 15 Mo de HTML (la plus grosse page, `relation_peuple`, fait 2,8 Mo avant compression).

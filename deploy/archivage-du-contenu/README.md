# Archivage de ce qui sort du dépôt (lot 12)

Deux scripts, **éteints** : ils ne font rien hors du jour J du lot 12 (`docs/chantier-base-de-dev.md`, « Le jour J du lot 12 »). Ils ne sont pas livrés par l'installateur et ne touchent pas à `deploy/installateur/sauvegarde/`.

| Script | Rôle |
| --- | --- |
| `archiver.sh` | Depuis un commit donné (jamais l'arbre de travail), une archive par catégorie : lignes des tables, migrations de données (avec `--avec-mixtes`, les migrations qui mêlent structure et données, à part), exports des sources. Un manifeste par archive (chemin, taille, sha256), le commit source et la date. Avec `--publications` (ou `--publications-seules`), les fichiers des publications GitHub et leur sha256. |
| `verifier.sh` | Relit une archive contre ses manifestes (sha256, nombre de fichiers, commit). Code de sortie non nul au moindre écart. Lecture seule. |

## Garde-fous

- `--jour-j` est obligatoire ; sans lui, refus (code 2).
- La destination (`--vers`) est un dossier **existant**, donné à chaque appel, **hors de tout dépôt git** (par exemple `/srv/maverick-archives`). Aucun défaut.
- Le clone (`--depot`) n'est que lu : `git archive` et `git ls-tree` lisent le commit, rien n'y est écrit. Le clone doit être posé sur le commit (`git -C <clone> checkout --detach <commit>`) : c'est l'outil de liste du commit (`client/scripts/lister-ce-qui-sort.mjs`, node ≥ 22.13) qui range chaque migration dans sa catégorie, avec les règles de l'inventaire (`docs/lot-12-inventaire.md`).
- Réseau : seulement `gh api` en lecture (GET), avec `GH_TOKEN` dans l'environnement. Les arguments qui écriraient sur GitHub sont refusés avant l'appel.
- Une archive existante n'est jamais réécrite ; une archive qui échoue à sa propre vérification est déclarée inutilisable.

## Ce que l'on obtient

```
<vers>/contenu-<commit>-<date>/
  ARCHIVE.txt              commit, date du commit, date de l'archivage, catégories
  SHA256SUMS               les archives, les manifestes et ARCHIVE.txt
  rows.tar.gz              + rows.manifeste
  migrations-donnees.tar.gz  + migrations-donnees.manifeste
  sources-raw.tar.gz       + sources-raw.manifeste
  (migrations-mixtes.tar.gz + .manifeste, avec --avec-mixtes)
<vers>/publications-<date>/
  <étiquette>/<fichier>    un dossier par publication
  releases.tsv             toutes les publications (id, étiquette, pré-publication, brouillon, nombre de fichiers, date)
  releases.json            la réponse complète de l'API (titres, descriptions : de quoi reposer une publication)
  publications.manifeste   sha256, taille, étiquette/fichier, id de la publication, sha256 annoncé par GitHub ou non
```

Les archives sont des `tar.gz` ordinaires : `tar -xzf rows.tar.gz -C <dossier>` restitue les fichiers aux chemins du dépôt (`data/rows/…`, `data/migrations/…`, `sources/raw/…`).

## Lire les exports archivés (sessions de Claude)

L'archive n'est qu'un instantané daté : les originaux Google font foi (R83) et se lisent par les connecteurs Google. Pour relire un export archivé, dépaqueter `sources-raw.tar.gz` dans un dossier de travail, jamais dans le dépôt.

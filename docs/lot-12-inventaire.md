# Lot 12 — inventaire de ce qui sort du dépôt

> Mesure datée, régénérée à la demande par le lot 12 ; aucune autre PR n'a à la régénérer. Fichier écrit par `scripts/inventaire-sortie-du-contenu.mjs` seul : ne pas l'éditer à la main.
> Le plan du chantier est dans `docs/chantier-base-de-dev.md`.

<!-- inventaire-lot-12:debut -->
#### Lot 12 — inventaire de ce qui sort (mesuré)

Produit par `cd client && node scripts/inventaire-sortie-du-contenu.mjs --ecrire-docs` (`--verifier` : dit si cette section est périmée, code 0 ; `--strict` : code 1 ; la sortie complète, avec fichier:ligne de chaque lecteur, est dans `var/inventaire-sortie/`). Rien ne sort encore : on mesure.

Mesure du 2026-11-19, commit `c2749bd3`, 1765 fichiers suivis. <!--v-->

**Chiffres de tête**

- **35 852 634 octets (35,9 Mo)** sortent de l'arbre (lignes, anciennes migrations de données, exports des sources).
- **292 fichiers** sortent.
- **295 fichiers suivis** les lisent encore (dont 224 hors documentation et consignes).
- Si les migrations qui mêlent DDL et données sortaient aussi (voir plus bas) : **+9 018 545 octets (9,0 Mo)**, **+114 fichiers**.

| Catégorie | Chemins | Fichiers | Octets |
| --- | --- | ---: | ---: |
| Lignes des tables | `data/rows/` | 221 | 23 178 778 |
| Anciennes migrations de données (.sql et leur registre .json) | `data/migrations/ (celles sans DDL)` | 32 | 3 157 893 |
| Exports des sources Google | `sources/raw/` | 39 | 9 515 963 |
| **Total** | | **292** | **35 852 634** |
| Anciennes publications (GitHub Releases, hors de l'arbre) | 312 publications dont 308 pré-publications | 312 assets | 10 427 326 824 (10,4 Go) | <!--v-->

Migrations de données : 25 `.sql` sans DDL (nature « données » de `controler-les-migrations-lib.mjs#analyserUneMigration`) et 7 registres `.json` de ces migrations. Restent : 104 migrations de structure, dont **88 mêlent DDL et instructions de données** (114 fichiers avec leurs registres, 9,0 Mo, non comptés ci-dessus : `analyserUneMigration` les classe « structure » dès qu'il y a un DDL ; 152 fichiers les citent par leur nom), et 26 registres de migration de structure. Restent aussi `sources/sources.json` (manifeste), `sources/tipeee/` (instantané livré avec le site) et `sources/discord/` (vide).

**Qui les lit encore** (fichiers suivis, hors les catégories qui sortent ; un fichier compte une fois par colonne ; motifs et faux positifs : `client/scripts/inventaire-sortie-du-contenu-lib.mjs#MOTIFS`)

| Famille | Fichiers | `data/rows` | Migrations de données (par nom) | `sources/raw` | Exemples |
| --- | ---: | ---: | ---: | ---: | --- |
| Code du site (`client/src`) | 15 | 12 | 3 | 0 | `client/src/content.config.ts`, `client/src/lib/archives.mjs`, `client/src/lib/contenu-fourni.mjs`, … |
| Service (`client/serveur`) | 14 | 14 | 0 | 0 | `client/serveur/api.mjs`, `client/serveur/base-vivante.mjs`, `client/serveur/comparaison-de-sites.mjs`, … |
| Scripts (`client/scripts`) | 25 | 25 | 0 | 1 | `client/scripts/autolink.mjs`, `client/scripts/baliser-mot-cle.mjs`, `client/scripts/controler-le-contenu-ecrit-lib.mjs`, … |
| Outils (`tools/`) | 24 | 13 | 7 | 8 | `tools/bestiaire/extraire.mjs`, `tools/build-artifact.mjs`, `tools/chronologie/chronologie.mjs`, … |
| Tests (`client/test`) | 137 | 116 | 24 | 10 | `client/test/aide-base-d-import.mjs`, `client/test/aide-base-de-depart.mjs`, `client/test/aide-maitrise-arme.mjs`, … |
| CI (`.github`) | 2 | 2 | 0 | 0 | `.github/workflows/ci.yml`, `.github/workflows/mise-a-jour.yml` |
| Hébergement (`deploy`) | 2 | 2 | 0 | 2 | `deploy/installateur/README.md`, `deploy/installateur/kit.mjs` |
| Documentation (`docs`) | 25 | 22 | 13 | 12 | `docs/api.md`, `docs/bestiaire.md`, `docs/chantier-base-de-dev.md`, … |
| Consignes (`.claude`, `CLAUDE.md`) | 46 | 35 | 7 | 12 | `.claude/agents/explorateur.md`, `.claude/agents/leader-technique.md`, `.claude/agents/tech-db.md`, … |
| Autres (`data/`, `api/`, configuration…) | 5 | 4 | 2 | 3 | `.gitattributes`, `.gitignore`, `data/pages-d-exemple.sql`, … |
| **Total** | **295** | | | | |

Dans `client/test/` : 113 fichiers de test et 24 aides, dont 5 fichiers déjà déclarés « lit le dépôt par nature » (`essai-mecanique-tests.mjs#LIT_LE_DEPOT_PAR_NATURE`). Les 108 autres fichiers de test citent un de ces chemins sans être déclarés dans `LIT_LE_DEPOT_PAR_NATURE` : à trier un à un au lot 12.

Références notées mais non comptées : 184 fichiers citent le dossier `data/migrations/` (il reste, pour la structure), 24 le manifeste `sources/sources.json` (reste), 21 `sources/tipeee/` (reste), 4 `sources/discord/`, 7 les publications GitHub (les nouvelles restent) ; 37 fichiers n'atteignent `data/rows` que par une commande ou un module (`db:build`, `db:sync-pages`, `pages_md`…).

Cette section se périme à chaque copie de `data/rows` et à chaque changement des fichiers qui citent ces chemins ; `--verifier` informe, `--strict` n'est branché nulle part : le lot 12 la régénère à la demande, aucune autre PR n'a à le faire.

Faux positifs connus :
- `rows-join` attrape aussi `join(tmp, 'rows')` : une copie de travail nommée `rows` (tests, mise à jour), pas `data/rows` lui-même.
- `rows-chemin` attrape les commentaires, la documentation et les expressions régulières qui nomment `data/rows` sans le lire (le contrôle du contenu écrit à la main, par exemple).
- `sources-raw-join` attrape `join(x, 'raw')` de toute origine ; `sources-classeurs` attrape `'classeurs'` entre guillemets (autre mot, autre dossier possible).
- `migrations-nom` ne voit qu'un nom cité en toutes lettres (`0113-mots-cles`) : une migration citée par son seul numéro, ou un nom reconstruit, lui échappe.
- `migrations-dossier` : le dossier `data/migrations/` reste (les migrations de structure) ; ses lecteurs ne sont pas comptés.
- `publications-releases` attrape tout `/releases` (les nouvelles publications restent) : ses lecteurs ne sont pas comptés.
<!-- inventaire-lot-12:fin -->

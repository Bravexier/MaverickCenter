# Flux Git : branches, versions et livraisons

Règles fixées par le propriétaire du projet. Le code qui les applique est dans `tools/flux-git/` (règles pures dans `regles.mjs`, testées par
`client/test/flux-git.test.mjs`) et dans trois workflows : `garde-branches.yml`, `livraison.yml`, `ci.yml`.

## Les branches

| Branche | Rôle | Créée depuis | Fusionnée dans |
| --- | --- | --- | --- |
| `master` | production : le site réellement utilisé | — | — |
| `dev` | intégration : ce qui sera livré | — | `master` (livraison) |
| `feature/<nom>` | une évolution | `dev` uniquement | `dev` |
| `hotfix/<nom>` | une correction urgente de la production | `master` uniquement | `master` |

**Aucune autre branche ne peut être créée** (ni `main`, ni `develop`, ni `claude/…`, ni `dev/…`). Une PR vers `master` ne peut venir que de `dev`
ou d'une `hotfix/<nom>` ; une PR vers `dev` que d'une `feature/<nom>`.

### Comment c'est garanti

- **À la création** (`garde-branches.yml`, job `creation-de-branche`) : une branche poussée sur GitHub dont le nom n'est pas permis, ou qui ne part pas
  de la bonne branche, est **supprimée aussitôt**. Le travail n'est pas perdu : il reste dans le dépôt local qui l'a poussée (le résumé du job donne le commit).
  Cette garde n'agit que si `master` et `dev` existent toutes les deux (avant, le flux n'est pas en place). Limite : c'est un workflow, lu dans le
  commit de la branche créée ; une branche créée depuis un commit antérieur à ce flux n'est pas contrôlée à sa création.
- **Toutes les 6 heures** (job `balayage-des-branches`, lancé depuis la branche par défaut, donc sans cette limite ; aussi à la demande :
  *Actions → Garde des branches → Run workflow*) : toutes les branches du dépôt sont contrôlées. Nom interdit et contenu déjà dans `dev` ou `master`
  → supprimée. Nom interdit avec du travail non fusionné, ou `feature`/`hotfix` au mauvais point de départ → signalée (passage en rouge, avec la
  liste), jamais supprimée : on ne détruit pas de travail.
- **À chaque PR** (job `regles-de-branches`) : source permise pour la cible, bon point de départ, version de `client/package.json` non modifiée à la main
  (elle est tenue par le bot), et, pour une livraison, `master` déjà refusionnée dans `dev`.
- **Par GitHub lui-même** (règles importables, `.github/rulesets/`) : création limitée à `feature/**` et `hotfix/**`, `master` et `dev` non supprimables,
  modifiées seulement par PR avec les checks `client`, `character-service`, `regles-de-branches`, `controle-des-migrations`, `controle-du-contenu-ecrit` (R282) et `gel-des-fusions` (R305) verts. Voir « Mise en place ».

« Créée depuis » se déduit des commits, dans le sens qui compte pour la production : une `hotfix/<nom>` ne doit rien contenir de `dev` ni d'une
`feature/…` qui ne soit déjà dans `master` (sinon du travail non livré partirait en production) ; une `feature/<nom>` ne doit rien contenir d'une
`hotfix/…` pas encore fusionnée dans `master`. Une `feature` peut en revanche contenir `master` : `dev` la reçoit de toute façon, c'est ainsi qu'on résout
une refusion en conflit (voir plus bas). Une `feature` créée depuis `master` est donc indiscernable d'une `feature` partie de `dev` qui aurait fusionné
`master` : elle passe, sans conséquence.

## Les versions

Une seule version, `X.Y.Z`, dans `client/package.json` (et `package-lock.json`) ; le site l'affiche en pied de page (`VX.Y.Z` sur le serveur de
test, `VX.Y` sur le serveur normal : l'étiquette de sa livraison). Le bot (`livraison.yml`, job `Version`)
la tient après chaque fusion ; **personne ne la change à la main**.

| Fusion | `dev` | `master` |
| --- | --- | --- |
| `feature/<nom>` → `dev` | `X.Y.Z` → `X.Y.Z+1` | inchangée |
| `dev` → `master` (livraison) | `X.Y.Z` → `X.Y+1.0` | `X.Y.Z` → `X.Y+1.0` |
| `dev` → `master` avec **`[V: X+1]`** dans le titre ou la description de la PR | `X.Y.Z` → `X+1.0.0` | `X.Y.Z` → `X+1.0.0` |
| `hotfix/<nom>` → `master` | `master` y est refusionnée, puis `X.Y.Z` → `X.Y.Z+1` | inchangée |

Exemple : `master` et `dev` en `0.1.25` ; deux features → `dev` `0.1.27` ; livraison → les deux en `0.2.0` ; une feature → `dev` `0.2.1` ;
un hotfix → `master` reste `0.2.0`, `dev` reçoit le correctif et passe en `0.2.2` ; livraison `[V: X+1]` → les deux en `1.0.0`.

**Chaque nouvelle version est étiquetée** (tag Git, demande du propriétaire : retrouver une version sans passer par le numéro de commit). Le bot pose
l'étiquette sur le commit qui porte la version, dans la même poussée que lui : **`VX.Y.Z` sur `dev`** (`V0.1.75`), **`VX.Y` sur `master`**
(`V0.2` : `master` ne change de version qu'à une livraison, toujours en `X.Y.0`). Un hotfix ne change pas la version de `master`, donc pas
d'étiquette de version sur `master` (seulement celle de son installateur, ci-dessous) ; `dev`, elle, reçoit la sienne.
Après une livraison où `dev` rejoint `master` en avance rapide, le même commit porte `VX.Y` et `VX.Y.0`. Une étiquette déjà posée ailleurs (à la main)
n'est jamais déplacée : le bot le signale dans son résumé et continue. Retrouver une version : `git fetch --tags origin`, puis
`git switch --detach V0.1.75`, `git log V0.2..V0.2.3`, ou la page *Tags* de GitHub. Toutes les étiquettes commencent par un **`V` majuscule**,
installateurs compris : deux étiquettes qui ne diffèrent que par la casse (`V0.2.0` et `v0.2.0`) se confondent dans un clone Windows ou macOS.
Les versions d'avant cette règle n'ont pas d'étiquette : leurs commits « chore: version v0.1.N » restent le repère.

Après une livraison, `dev` rejoint `master` (avance rapide, ou fusion si `dev` a bougé entre-temps). Après un hotfix, `master` est refusionnée dans `dev`.
Si cette refusion est en conflit (le hotfix et `dev` ont modifié les mêmes lignes), le bot ne touche pas `dev` et le signale (son passage finit en
rouge, l'installateur de production du hotfix est quand même publié) ; la refusion se fait alors par une `feature/<nom>` créée
depuis `dev`, dans laquelle on fusionne `master` et résout les conflits, puis une PR vers `dev`. Seuls les conflits sur la ligne de version se
résolvent seuls. Même chose si le hotfix modifie `.github/workflows/` et que le bot n'a pas de `BOT_TOKEN` avec la permission *Workflows*.

**Toutes les PR vers `dev` et `master` se fusionnent par « Create a merge commit »** (ni *squash* ni *rebase*) : le bot et les contrôles s'appuient sur
l'historique des fusions (une refusion faite par *squash* laisserait `master` hors de `dev`, et la livraison suivante serait refusée).

**Une `feature/<nom>` ou `hotfix/<nom>` en conflit avec sa base se rebase, on n'y fusionne jamais la base** (demande du propriétaire) :
`git fetch --prune origin`, `git rebase origin/dev` (ou `origin/master`), résoudre, puis `git fetch --prune origin` et `git push --force-with-lease origin <branche>` (`-u` au premier push) : le push forcé de sa propre branche après un rebase est toujours autorisé (choix du propriétaire, 2026-10-29), jamais sur `dev`, `master` ni la branche d'un autre, jamais `--force` ou `-f` seuls ; sans `--force-if-includes`, forme absente de la liste autorisée de `.claude/settings.json`. La PR n'est fusionnée qu'une fois
sans conflit et la CI verte. Seule exception, la refusion de `master` dans `dev` décrite plus haut : elle doit rester une fusion (le bot vérifie que
`master` est dans l'historique de `dev`).

**Juste après le dernier commit, et avant chaque push, on se remet à jour sur la base, par défaut** (demande du propriétaire ; skill
`resoudre-un-conflit`) : `git fetch --prune origin` ; si `origin/dev` (ou `origin/master` pour un hotfix) a bougé depuis le départ de la branche
(`git merge-base --is-ancestor origin/dev HEAD` échoue), `git rebase` sur elle, résoudre les conflits aussitôt, donner le recouvrement
sans rien lancer (`npm run test:cible -- --apres-rebase --liste` dans `client/` : fichiers que la base a changés et que le lot touche aussi, plus
`--fichiers` pour un conflit résolu à la main ; skill `choisir-les-tests`) ; s'il n'est pas vide, `tech-qualite` passe ce seul jeu (`--avant <pointe
d'avant le rebase>`), un seul passage de tests par lot (demande du propriétaire), puis pousser (`git fetch --prune origin` puis `git push --force-with-lease origin <branche>` si la branche était déjà poussée, même règle que ci-dessus). Même sans conflit : la PR est ainsi
toujours testée sur la base du moment. Une PR ouverte se corrige ensuite automatiquement jusqu'à sa fusion (CI rouge, conflit, revue ; skill
`corriger-une-pr`).

**Ordre de passage** (skill `publier-une-branche`, « L'ordre de passage ») : parmi les PR ouvertes vers `dev` dont les fichiers se recoupent, le
numéro croissant ; une PR sans recouvrement n'attend personne. Seule exception : une demande explicite et urgente du propriétaire fait passer une PR
en tête. La session principale impose l'ordre par un commentaire sur chaque PR concernée. À son tour, chaque PR fait un seul rebase sur `dev` à jour,
puis le recouvrement (`--apres-rebase --liste`, passé par `tech-qualite` s'il n'est pas vide), le push, la CI et la fusion ; pas de rebase « pour suivre `dev` » pendant l'attente.

**L'état de la branche en une commande** (lecture seule, après `git fetch --prune origin`) : `node tools/flux-git/etat-branche.mjs [--base <réf>] [--json]`
dit l'avance et le retard sur la base, les commits de `origin/<branche>` absents en local, si un rebase est nécessaire ou interdit (branche de
refusion), chaque conflit en cours classé selon la table du skill `resoudre-un-conflit` (règles : `tools/flux-git/etat-regles.mjs`), les migrations
dont la base a pris le numéro, et le recouvrement (celui de `npm run test:cible -- --apres-rebase`).

Plusieurs fusions rapprochées sont traitées chacune à leur tour par le bot (il relit les branches et recommence si une autre fusion est passée
entre-temps). Relancer un passage déjà fait (*Re-run*) ne refait rien : le bot reconnaît la PR à ses commits « (PR #n) » et s'arrête ; pour republier
une branche, *Actions → Version et livraison → Run workflow*.

## Ce qui est publié : serveur normal et serveur de test, un script d'installation par fusion

La solution est hébergée sur le serveur de [`deploy/vps/`](../deploy/vps/README.md) (le NAS est temporaire). Après chaque fusion, le job
`Installateur` construit le site et publie un **installateur** (`deploy/installateur/`) : un script `.sh` autonome qui contient le site et l'installe
sur l'hôte, sans téléchargement ni jeton. Il est publié comme *release* GitHub du dépôt (publique comme lui depuis le 2026-10-14). Le bot choisit
seul ce qu'il publie (`livrableDe`, `tools/flux-git/regles.mjs`) ; le job `Site`, qui publiait le site unique sur la branche **`site`** que suit le
paquet du NAS (`deploy/README.md`, `update-site.sh`), ne tourne plus : cette branche n'avance plus.

| Fusion dans | Installateur | Étiquette (release) |
| --- | --- | --- |
| `dev` (feature, ou refusion après livraison ou hotfix) | **test** | `VX.Y.Z` : l'étiquette de version de `dev` elle-même (publiée en pré-version) |
| `master` (livraison) | **normal** (production) | `VX.Y` : l'étiquette de version de `master` elle-même |
| `master` (hotfix : même version) | **normal** (production) | `VX.Y-hotfix.N` |

Deux serveurs, deux formes d'étiquette, sans suffixe (décision du propriétaire, 2026-10-11 : le serveur de `dev` **est** le serveur de test, il
n'y a pas de version « de test » à part) : trois nombres pour `dev`, deux pour `master`. `mise-a-jour.sh` reconnaît les livraisons de son
serveur à cette forme. Seule la toute première livraison de test s'est appelée `V0.2.0-test`.

- **Serveur de test** (`maverick-center-test`, port 8081, bandeau « Serveur de dev » sur chaque page — il renvoie à la page « Mise à jour », qui
  liste les modifications en cours —, `[TEST]` dans le titre de l'onglet).
  Une installation **ne vide ni ne remplace jamais sa base** (dossier `db/`, décision R274 : la base du site de dev fait foi, ses saisies
  n'existent nulle part ailleurs) ; `mise-a-jour.sh` refuse en outre une livraison plus ancienne que celle installée. La copie de la base du serveur
  normal (dossier `db/` de l'instance de production ; avec `sqlite3`, chaque base SQLite est copiée par `.backup`, donc cohérente même si la
  production écrit) ne se fait que sur demande (`--copier-base-prod`), dans un `db/` vide. Rien de ce qui est fait en test ne revient en
  production par la base : les modifications des règles y vont par la page « Mise à jour ».
- **Serveur normal** : le site réellement utilisé (`maverick-center`, port 8080). Une installation remplace le site, **jamais la base vivante** (`db/`).

Quand elle est demandée, la copie est faite par l'installateur, sur le serveur, au moment où il s'exécute : GitHub n'a pas accès à la base de production, et elle ne passe jamais par GitHub.
Elle ne quitte le serveur que par la sauvegarde automatique de nuit (décision R275), **chiffrée**, vers un stockage d'un autre fournisseur que l'hébergeur, dont le propriétaire
garde la clé (`deploy/vps/README.md`, « Sauvegardes »). La base vivante (`db/`) est celle du service des personnages ([`serveur.md`](serveur.md)) : les prétirés, puis, avec la
connexion Discord, les utilisateurs et leurs fiches ; la base des règles du site (`/donnees/`), elle, est reconstruite depuis `data/rows` à chaque version.
La mise à jour automatique de chaque instance est `mise-a-jour.sh`. Détails : [`deploy/installateur/README.md`](../deploy/installateur/README.md).
Republier une branche sans changer sa version : *Actions → Version et livraison → Run workflow* (une étiquette `…-rebuild.N`).

**La 1.0 reste le signal du propriétaire** : l'ouverture à tout le Discord (et non plus aux seuls MJ et administrateurs), avec la connexion par
Discord (identification et utilisateurs, voir [`feuille-de-route.md`](feuille-de-route.md)) ; on y passe par une livraison `dev` → `master`
portant `[V: X+1]`, à la demande du propriétaire : à la main, ou par la case « Version majeure » de la page « Mise à jour » du site de dev (plus bas).

## Règles des migrations (lot 7)

Lot 7 du chantier « la base du site de dev devient la source de vérité » (R274, R275 ; plan : `docs/chantier-base-de-dev.md`). Le job `controle-des-migrations` de `ci.yml` les fait respecter à chaque PR (et à chaque push sur `master` ou `dev`) ; `npm run db:controler-migrations -- --base origin/dev` les lance à la main, depuis `client/` (`--resume <fichier.md>` ajoute le bilan à un fichier, `--sans-essai` ne passe que les règles). Code : `client/scripts/controler-les-migrations*.mjs` ; test : `scripts-controler-les-migrations`. Sortie 0 (admis), 1 (une règle violée : le fichier, la règle, quoi faire), 2 (dépôt, base de comparaison ou outil illisible, erreur inattendue).

Les fichiers de `data/migrations/` sont comparés à ceux de `git merge-base <base> HEAD` (la base est la branche visée sur une PR, le commit d'avant sur un push, sinon le premier parent), l'arbre étant celui du dossier de travail :

- **`figee`.** Une migration fusionnée (`.sql` ou registre `.json`) ne se modifie plus, ne se renomme pas, ne se supprime pas. Une migration ne s'annule pas : on en écrit une autre. **`numero`** : une migration nouvelle prend un numéro après la dernière fusionnée et après la version du `data/schema.sql` de la base (le plancher, quand des migrations mixtes sont sorties du dépôt : `docs/chantier-base-de-dev.md`, « Les lecteurs des migrations mixtes »), un fichier par numéro. **`interdit`** : ni `BEGIN`, `COMMIT`, `ROLLBACK` ni `PRAGMA` (le service ouvre la transaction).
- **`structure`** (numéros > 0129). Une migration qui porte du DDL (`CREATE`, `ALTER`, `DROP`) est « de structure » : son DML ne déplace ou ne recopie que des colonnes (`INSERT … SELECT`, `UPDATE … SET colonne = expression de colonnes`), et ses littéraux sont des codes (`^[a-z0-9_.-]{1,40}$`, comme `'migration'`), des identifiants à `/` (`'races/x'`, minuscules, 80 caractères au plus), des chemins JSON (`'$.nom'`, `'$[0].x'`), des formats de `strftime` (`'%Y-%m-%dT%H:%M:%SZ'`), des nombres, `NULL` ou `''`. Deux définitions remplissent pourtant des lignes et suivent la même règle : `ALTER TABLE … ADD COLUMN … DEFAULT '<texte>'` (toutes les lignes existantes) et `CREATE TABLE … AS SELECT '<texte>'`. Les littéraux des autres définitions (`CHECK`, `DEFAULT` d'un `CREATE TABLE` neuf, vues, déclencheurs) ne comptent pas. Du texte de règle avec du DDL : refus, à scinder en deux migrations (la structure, puis les données). Une migration sans DDL est « de données » : permise, signalée dans le résumé (« cesse à la bascule du lot 8 »).
- **`renommage`.** `ALTER TABLE … RENAME TO` et `RENAME COLUMN` exigent, dans la même migration, un `UPDATE` de `modification` (le journal), `historique_modification`, `lot_de_changements` et `numero_donne`, qui cite l'ancien et le nouveau nom : ces tables gardent des noms de tables et de colonnes. Une table recopiée sous un nom provisoire puis renommée (`x__NNNN`) n'est pas un renommage.
- **`base-remplie`.** La base de la version dont part la PR est reconstruite (`git archive` de `data/schema.sql` et `data/rows`, `db-build`) et remplie (`scripts/base-remplie-lib.mjs` : fiches, journal, historique, lot déposé, plafond de numéro), puis les migrations nouvelles lui sont appliquées par `appliquerSurPlace`, le code du service, sur une copie jetable. Sont refusés : un schéma obtenu différent de `data/schema.sql`, une clé étrangère rompue, une ligne retirée des fiches, du journal, de l'historique ou des notes de version, une table de ces classes retirée. Sans migration nouvelle, la base n'est pas reconstruite. **Vers `master`** (PR ou push), le job ne passe que les règles (`--sans-essai`) : la base de `master` est ancienne, et son `data/rows` a changé hors migrations depuis, de sorte que le rejeu des migrations y refuserait à tort ; chaque migration a déjà été essayée sur `dev`.

Le résumé du job (`$GITHUB_STEP_SUMMARY`) donne, par migration nouvelle : sa nature, par table les lignes ajoutées, retirées et modifiées, et le nombre de tables à l'empreinte inchangée (liste repliée). Le job est à part, parallèle aux autres : il lui faut l'historique complet (`fetch-depth: 0`) et aucun paquet npm.

## Contenu écrit à la main (lot 8)

Garde-fou 12 du chantier (`docs/chantier-base-de-dev.md`) : une fois la base du site de dev devenue la source, le contenu n'entre plus dans le dépôt que par le
workflow de mise à jour. Job `controle-du-contenu-ecrit` de `ci.yml`, sur chaque PR ; code : `client/scripts/controler-le-contenu-ecrit.mjs` (lecture du dépôt)
et `controler-le-contenu-ecrit-lib.mjs` (règles pures) ; test : `scripts-controler-le-contenu-ecrit`. Sortie 0 (éteint, ou rien de refusé), 1 (un refus : la règle
et quoi faire), 2 (usage ou dépôt illisible).

- **Interrupteur** : `tools/flux-git/bascule-1.json`, `{ "actif": false }`. Il se lit dans **`origin/dev`**, jamais dans la PR contrôlée : la PR qui le passe à
  `true` passe elle-même (dev l'a encore à `false`), et une PR ne peut pas s'en exempter en l'éteignant dans sa branche. Éteint (ou fichier absent), le job passe
  vert sans rien lire d'autre et le résumé le dit.
- **`ecrit-a-la-main`** (PR vers `dev` qui change `data/rows/`) : chaque commit de la PR qui touche `data/rows/` doit être celui du workflow de mise à jour —
  branche `feature/mise-a-jour-regles-…`, auteur et commiteur `github-actions[bot]`, une ligne `Lot : <uuid>` ou `Copie : <uuid>`, rien hors de `data/rows/`.
  Les commits sont lus de la base de la PR à sa tête (`github.event.pull_request.head.sha`), une fusion comparée à son premier parent. Limite : l'identité
  d'un commit se déclare ; le contrôle arrête l'erreur et l'oubli, pas une falsification voulue. **Exception** : une PR qui ajoute une migration de
  **structure** peut changer `data/rows/<t>.sql`, seulement pour les tables que ses migrations nomment (`CREATE`, `ALTER`, `DROP TABLE <t>`, les deux noms
  d'un renommage, la cible d'un `INSERT … SELECT` : `tablesDeLaStructure`), plus `data/rows/VERSION` (`schema_version`, réécrit par `tools/db/maverick.py#exporter`
  à chaque changement de schéma) ; et, **si l'une renomme** une table ou une colonne, les tables qui gardent des noms (`modification`, `historique_modification`,
  `lot_de_changements`, `numero_donne` : la règle `renommage` oblige la migration à les réécrire). `fichiersDeLaStructure` ; sans migration de structure
  (ou avec une migration de données seule), ni `VERSION` ni ces tables ne passent, et le refus nomme les fichiers. Toute autre table reste refusée. Ce contrôle ne juge que les noms : l'égalité
  exacte de l'export est déjà prouvée par `controle-des-migrations` (base remplie migrée), qui est obligatoire (R282).
- **`donnees`** (PR vers `dev`) : une migration ajoutée sans DDL (`controler-les-migrations-lib.mjs#analyserUneMigration`) est refusée ; la structure reste.
- **`correctif-urgent`** (PR `hotfix/<nom>` vers `master`) : rien dans `data/rows/`, `data/migrations/` ni `data/schema.sql`. La livraison `dev` → `master`
  n'est pas concernée. Sous l'interrupteur de la bascule 2, aussi rien dans `data/paquet.json` (« Ce que GitHub publie avec la bascule 2 »).

Le jour de la bascule : une PR vers `dev` passe `actif` à `true`. Le job est un check requis (R282), comme `controle-des-migrations` : il figure dans
`.github/rulesets/` (`dev.json`, `master.json`) et dans `CHECKS_REQUIS` de `client/scripts/mise-a-jour-github.mjs`, et un refus arrête la fusion. Les deux jobs
tournent sur toute PR vers `dev` et `master` (`pull_request` sans filtre de branche ni de chemin dans `ci.yml`), y compris les PR « Lot : » et « Copie : »
du workflow de mise à jour et la livraison `dev` → `master`. Après une modification des fichiers de règles, les réimporter sur GitHub (GitHub ne les lit pas).

## Gel des fusions pendant une mise à jour (lot 11)

Garde-fou 16 de la bascule 2. Job `gel-des-fusions` de `ci.yml`, sur chaque PR vers `dev` et `master` ; code : `client/scripts/gel-des-fusions.mjs` (lit le dépôt et l'API de GitHub, jeton en lecture) et `gel-des-fusions-lib.mjs` (règles pures) ; test : `gel-des-fusions`.
- **Interrupteur** : `tools/flux-git/bascule-2.json`, clé **`gel_des_fusions`** (`true` depuis le jour J), lue dans `origin/dev` comme `bascule-1.json`. Éteint (clé ou fichier absent) : vert, sans appeler GitHub. Le même fichier porte une seconde clé indépendante, `actif` (« Ce que GitHub publie avec la bascule 2 ») : le jour J on allume `gel_des_fusions` d'abord (pendant la répétition), puis `actif`.
- **Allumé** : rouge tant qu'un run du workflow `mise-a-jour.yml` n'est pas fini (en file, en cours, en attente ; un run de plus de 8 h est ignoré). Le message dit le run (numéro, adresse), depuis quand, et le geste : relancer ce job (« Re-run ») quand la mise à jour est finie. Sont exemptées les deux fusions que ce workflow fait lui-même : sa branche `feature/mise-a-jour-regles-…` vers `dev` et la livraison `dev` → `master`. GitHub illisible alors que l'interrupteur est allumé : le job échoue (on ne devine pas qu'aucune mise à jour ne tourne).
- Le job **est un check requis** depuis le jour J de la bascule 2 (R305) : `.github/rulesets/` (`dev.json`, `master.json`) et `CHECKS_REQUIS` de `mise-a-jour-github.mjs` (test `mise-a-jour-github` : les trois disent la même liste). Les fusions du workflow lui-même le passent vert. Après une modification des fichiers de règles, les réimporter sur GitHub (`gh api -X PUT …`, geste du propriétaire).

## Ce que GitHub publie avec la bascule 2 (lot 11, PR 4 et PR 5b)

Interrupteur : la clé `actif` de `tools/flux-git/bascule-2.json` (le gel des fusions a la sienne, `gel_des_fusions`, indépendante), lue dans `origin/dev` (`tools/flux-git/bascule-2.mjs`). **Éteint, rien ne change** : le job `Site` (branche NAS, déjà inactif), le job `Installateur` et le contrôle du contenu écrit sont ceux d'avant. Code, tests et gestes : `docs/serveur.md`, « Bascule 2 : préparation », « PR 4 » et « PR 5b ».
- **Allumé, le job `Installateur` de test ne publie plus de pages** : il ne construit pas le site (`npm run build`) et lance `fabriquer.mjs --kit . --kit-seul` (le service et le kit ; l'atelier du site de dev fabrique les pages). Le job `Site` est sauté.
- **Allumé, l'installateur de production est lui aussi un « kit seul »** (PR 5b) : `fabriquer.mjs --mode prod --kit . --kit-seul`, sans pages ni service ; il pose le kit dans `<production>/activation/kit/` et lance `activer.sh`, qui fabrique les pages et le service depuis le paquet. Il **refuse**, avant toute écriture, une production sans le fichier `activation-par-paquet` (geste : `sudo touch /srv/maverick-center/activation-par-paquet`, ou remettre `actif` à `false`) ; la note de la livraison GitHub le dit. Un correctif urgent (`VX.Y-hotfix.N`) ou une régénération lance `activer.sh --correctif`. Éteint, la livraison de production a le même comportement qu'avant. Si GitHub a livré et que la production a refusé : `sudo bash /srv/maverick-center/activer.sh --reprendre` après avoir corrigé la cause (ou une nouvelle livraison) ; la page Mise à jour du site de dev lit le rapport de `activer.sh` (`activation_production`).
- **Le commit de lot** (workflow `mise-a-jour.yml`) porte alors `data/paquet.json` : l'identité du lot (lot, version, empreinte du paquet, structure, commit du code, date ; aucun contenu), en plus de la copie `data/rows` qui reste le secours jusqu'au lot 12. Le commit n'est jamais vide : plus de « Rien à livrer ». Le job `controle-du-contenu-ecrit` l'admet seulement dans un commit « Lot : » ou « Copie : » du workflow (règle `paquet-a-la-main`) ; la règle `correctif-urgent` refuse un `hotfix/*` qui le porte, en plus de « ni contenu ni structure ».
- **Le correctif urgent ne porte que du code.** Son activation en production est celle de `activer.sh --correctif` (PR 5a), lancé par l'installateur de production kit seul : le dernier paquet activé est recontrôlé avec le nouveau kit.
- **Le jour J** : le fichier `activation-par-paquet` de la production posé d'abord (`sudo touch /srv/maverick-center/activation-par-paquet`), puis une PR vers `dev` passe `actif` à `true` (après `gel_des_fusions`), comme pour la bascule 1 ; le premier kit seul de production est la livraison `dev` → `master` suivante. Retour arrière : une PR qui le repasse à `false` (la livraison de production suivante est de nouveau complète).

## Contenu lu par les tests (lot 10)

R278 (« Oui, pour les tests seulement ») : les tests et le build de la CI lisent le contenu du **site de dev**, pas la copie du dépôt. Le dépôt ne le garde pas.

Deux secrets de dépôt :
- **`MAVERICK_EXTRAIT_CLE`** : une clé de lecture du site de dev, envoyée dans `X-Maverick-Cle` ;
- **`MAVERICK_CONTENU_CHIFFREMENT`** : une phrase secrète qui chiffre l'extrait entre deux jobs. Le dépôt est public : un artefact en clair donnerait toute la base à
  tout compte GitHub.

- **Job `extrait-du-site-de-dev`**, node: seulement, sans `npm` ; `timeout-minutes: 15`. C'est le seul job qui reçoit la clé. Le runner reçoit tous les secrets d'un
  job dès son début, et une étape d'un même job (npm, tests de la PR) pourrait lire sa mémoire (CVE-2025-30066) : seul un job à part isole la clé.
  - Il tire par `git archive` le `client/` de **`dev`** (la branche de base) sous `$RUNNER_TEMP`, et exécute ce `db-extrait.mjs`-là.
  - Trois essais. Chaque essai est borné par `timeout 180` et par `MAVERICK_EXTRAIT_DELAI` (le délai de chaque demande dans `db-extrait.mjs`, 300 s par défaut). Une erreur
    réseau, un 5xx ou un délai dépassé donne un nouvel essai ; pas sur un 401 ni un 403. L'étape a `timeout-minutes: 12` et `continue-on-error`.
  - L'extrait est chiffré : `openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:MAVERICK_CONTENU_CHIFFREMENT`, phrase jamais en argument. Le clair est
    effacé, et **seul le fichier chiffré** part en artefact `contenu-du-site-de-dev-chiffre`, gardé un jour (`retention-days: 1`).
  - Sorties : `disponible`, `raison` (la cause du repli), `date` (date de l'extrait, version du site, structure) et `sha256` (celui du clair, qui n'est pas un secret).
- **Job `client`** : il attend l'extrait (`needs`), et tourne quelle que soit l'issue de ce job (`!cancelled()`). Après `npm ci` :
  - `telechargement` récupère l'artefact chiffré ;
  - `dechiffrement` est la seule étape qui reçoit un secret, la phrase, dans son `env:`. Elle déchiffre sous `$RUNNER_TEMP/contenu/`, hors de l'arbre suivi, et compare
    le sha256 du clair à celui du job de l'extrait ;
  - `contenu`, sans secret, pose `MAVERICK_CONTENU` pour tout le job (`npm test` et ses `pre`, les builds, les tests du site construit). Elle écrit dans le résumé
    « Contenu lu par les tests et le build : site de dev, extrait du <date> ».
  - Le contenu fourni est préparé comme en local (`docs/serveur.md`, « Fabriquer le site depuis un fichier de contenu ») : une migration ajoutée par la PR est appliquée
    à la copie ; un site de dev en avance sur la branche fait échouer les tests avec « Rebasez la branche sur dev ».
  - Le site de dev n'a pas les pages d'exemple (fixtures, `statut = 'example'`) : la copie de travail reçoit celles du dépôt, `data/pages-d-exemple.sql`, sauf pour
    `HIDE_EXAMPLES=1` (`docs/serveur.md`, « Pages d'exemple »). Ce fichier, hors de `data/rows/`, n'est pas du contenu : le contrôle `controle-du-contenu-ecrit` ne le vise pas, et
    il reste quand `data/rows` sortira (lot 12). Il se refait par `node scripts/db-pages-d-exemple.mjs`, depuis `data/rows` ; `test/pages-d-exemple.test.mjs` l'y compare.
  - Ces étapes ne sont pas des contrôles : `CONTROLES_DE_LA_CI` (`scripts/mise-a-jour-github.mjs`) les ignore.
- **Repli** : la branche visée n'est pas `dev` (PR vers `master` ou push sur `master` : la production a sa propre structure) ; un des deux secrets manque (PR d'un fork, ou
  secrets pas encore créés) ; le site reste injoignable après les essais, délai compris ; le téléchargement ou le déchiffrement échoue ; ou le sha256 diffère.
  - Le job `client` lit alors la copie du dépôt (`data/rows`, que le workflow tient égale au site de dev jusqu'au lot 12).
  - Il émet un `::warning::` et écrit dans le résumé « Contenu lu par les tests et le build : copie du dépôt (data/rows) : <raison> ». Le résumé dit toujours lequel a été lu.
  - Aucune clé ni phrase dans les journaux, aucun `set -x`.
- **Chaque nuit sur `dev`** (`schedule` de `ci.yml`, 03 h 23 UTC ; `dev` est la branche par défaut) : l'extrait et le job `client` tournent sur le contenu du jour, sans PR ni fusion ; les autres jobs (`controle-des-migrations`, `simulation-de-mise-a-jour`, `character-service`) sont sautés (`github.event_name != 'schedule'`). Le site de dev change sans que le code bouge : sans cela, un test qui fige un état du contenu ne tombe qu'à la PR suivante (run 44320300043). Un test qui lit `data/rows` par nature le fait explicitement (`data/rows` dans l'arbre, ni `MAVERICK_CONTENU` dans ses processus ni wiki fabriqué depuis l'extrait) ; la passe D de l'essai mécanique (`docs/essai-mecanique-des-tests.md`) reproduit ce que voit la CI pour ces fichiers.
  - **Issue de la nuit** (job `issue-ci-nocturne`, sur le seul `schedule`, après l'extrait et `client`, `!cancelled()` ; `scripts/ci-nocturne-issue.mjs`) : une nuit rouge ouvre une issue unique, titre fixe « CI nocturne en échec », label `ci-nocturne`, ou réécrit son corps et y ajoute un commentaire si elle est déjà ouverte. Le corps donne la date, le lien du run, les jobs et étapes en échec, et les tests en échec lus dans le TAP du journal (emplacement et nom seulement, jamais le message d'erreur ; noms nettoyés, bornés et rendus en code : ni @mention ni lien). La première nuit verte la ferme avec un commentaire ; un run annulé ou sauté ne change rien. Seul ce job a `issues: write` (avec `actions: read`, `contents: read`) ; il ne reçoit aucun secret du site de dev et ne lance pas `npm`. Aucune correction automatique.
- **Ce qui ne change pas** : `simulation-de-mise-a-jour` et le job `preparer` de `mise-a-jour.yml` contrôlent `data/rows` qu'ils viennent d'écrire depuis un lot, sans aucun secret.
  La base de référence de la production (`scripts/db-reference.mjs`) se lit toujours dans git (les `data/rows` de master), `MAVERICK_CONTENU` posée ou non : `site-html` garde son contrôle.
- **Mise en place** (par le propriétaire) : créer les deux secrets de dépôt. *Settings → Secrets and variables → Actions → New repository secret* :
  - `MAVERICK_EXTRAIT_CLE`, valeur : une clé de lecture du site de dev (`docs/serveur.md`, « Accès au site de dev ») ;
  - `MAVERICK_CONTENU_CHIFFREMENT`, valeur : une longue phrase aléatoire, qui ne sert qu'à cela.

  Sans l'un des deux, la CI reste sur le repli.
- **Limite connue** : sur `pull_request`, GitHub lit le `ci.yml` de la PR. Une PR de ce dépôt qui modifierait ces jobs pourrait donc lire les secrets (les PR d'un fork ne les
  reçoivent pas). La relecture d'une PR qui touche `ci.yml` garde ce point. La phrase de chiffrement est au job `client`, où tourne le code de la PR : elle ne protège l'extrait
  que de l'artefact public, pas de ce code, qui lit de toute façon le contenu en clair. Comme R278 l'a accepté, des morceaux du contenu peuvent apparaître dans le compte rendu d'un test.

## Au quotidien

```bash
# Une évolution
git fetch --prune origin && git switch -c feature/carte-du-monde origin/dev
# … commits …
git push -u origin feature/carte-du-monde        # puis PR feature/carte-du-monde → dev

# Une correction urgente de la production
git fetch --prune origin && git switch -c hotfix/lien-casse origin/master
git push -u origin hotfix/lien-casse             # puis PR hotfix/lien-casse → master

# Une livraison : PR dev → master (ajouter [V: X+1] au titre pour une version majeure)
# Toutes les fusions : « Create a merge commit »
```

`--prune` : les anciennes branches `dev/…` ont été supprimées pour créer `dev` ; un clone qui garde leurs références (`origin/dev/…`) ne peut pas
recevoir `origin/dev` tant qu'il ne les a pas oubliées (`git fetch --prune origin`, une fois suffit ; ou `git config fetch.prune true`).

Mettre une `feature` à jour : la rebaser sur `origin/dev`. Mettre une `hotfix` à jour : la rebaser sur `origin/master`, jamais sur `dev` ni sur une
`feature` (refusé). On n'y fusionne jamais la base (seule exception : la refusion de `master` dans `dev`, plus haut).

**Après la fusion, le bot supprime la branche sur GitHub** (`feature/<nom>` ou `hotfix/<nom>`, jamais `dev`), une fois son passage terminé sans erreur,
et seulement si elle pointe encore sur le commit fusionné : une branche qui a reçu des commits depuis est gardée (avertissement dans le passage).
Une hotfix dont la refusion a échoué reste aussi, pour la reprendre. Une suite de travail repart d'une nouvelle branche. En local : `git fetch --prune origin`
oublie la branche distante, `git branch -d feature/<nom>` supprime la copie locale (Git refuse si elle contient du travail non fusionné).
L'option GitHub « Automatically delete head branches » n'est pas nécessaire (elle supprimerait aussi `dev` après une livraison si `dev` n'était ni
protégée ni la branche par défaut).

**Une mise à jour des règles depuis le site de dev** (page « Mise à jour », bouton « Effectuer la mise à jour » ; [`docs/serveur.md`](serveur.md),
« Mise à jour ») : le workflow `mise-a-jour.yml` fait au nom du propriétaire du jeton `MISE_A_JOUR_TOKEN` ce qu'on ferait à la main — une branche
`feature/mise-a-jour-regles-<date>` partie de `dev` avec les modifications du site et la note de version (préparée et contrôlée par le job
`preparer`, sans aucun secret), sa PR vers `dev` fusionnée par commit de fusion quand la CI est verte (job `livrer`, étape « Fusion dans dev » ; si
`dev` a bougé, le commit est rejoué sur le nouveau `dev` par un rebase textuel — un conflit arrête tout —, jamais fusionné avec lui), puis la PR de
livraison `dev` → `master`, fusionnée de même (étape « Livraison vers master » ; son titre porte `[V: X+1]` seulement si la case « Version
majeure » de la page était cochée quand le lot a été figé : la livraison fait alors la `X+1.0.0`). Les bots font ensuite leur travail habituel
(versions, étiquettes, installateurs). Une seule mise à jour à la fois attend sa livraison : tant que celle d'un autre lot est dans `dev` sans être
sur `master`, le workflow refuse d'en commencer une autre. Avec la base source (marqueur `db/source`, lot 8 ; `docs/serveur.md`, « Mise à jour depuis la
base source (lot 8) »), le lot est un paquet SQLite dont le job `preparer` tire `data/rows`, et que le job `livrer` réexporte (Python, sans npm) pour exiger que
chaque `data/rows/*.sql` du commit en soit la copie octet pour octet ; « Copier vers le dépôt » (entrée `copie`) n'ouvre que la PR vers
`dev` (commit « Copie : <id> », jamais « Lot : ») : son contenu part en production avec la livraison `dev` → `master` suivante.

## Mise en place (une seule fois, par le propriétaire)

Déjà fait : `master` et `dev` existent (en `0.1.25`), `dev` est la branche par défaut, `main` et les anciennes branches de travail sont
supprimées. `develop` (ancienne tentative, entièrement fusionnée) sera supprimée par le premier balayage. Garder `site` : le paquet du NAS la suit
(elle n'avance plus).

1. **Dans chaque clone existant** : `git fetch --prune origin` une fois (voir « Au quotidien »).
2. **Jeton du bot** (seulement quand les règles de l'étape 3 sont réellement appliquées) : le bot pousse directement les incréments de version sur
   `master` et `dev` ; une fois ces branches protégées, le jeton par défaut des workflows ne le peut plus. Créer un jeton *fine-grained*
   (*Settings → Developer settings → Fine-grained tokens*), limité à ce dépôt, permissions *Contents : Read and write* **et** *Workflows : Read and
   write* (sans elle, une refusion qui touche `.github/workflows/` est refusée), et l'enregistrer comme secret **`BOT_TOKEN`** (*Settings → Secrets and
   variables → Actions*). Les poussées du bot se font alors au nom du propriétaire du jeton, qui doit être administrateur du dépôt (exemption des
   règles). **S'il a une date d'expiration**, la noter et le renouveler avant (un jeton expiré arrête versions et publications, les serveurs cessent
   d'être mis à jour) ; supprimer le secret fait revenir au jeton par défaut.
3. **Règles GitHub** : *Settings → Rules → Rulesets → New ruleset → Import a ruleset*, une fois pour chaque fichier de `.github/rulesets/` :
   `master.json`, `dev.json` (PR obligatoire, checks verts, ni suppression ni réécriture, fusion par commit de fusion ; exemption :
   administrateurs, pour le bot) et `noms-de-branches.json` (création limitée à `feature/**` et `hotfix/**`, plus `site` pour le bot, sans exemption).
   **Vérifier qu'elles s'appliquent vraiment** : dans *Settings → Rules → Rulesets*, chaque règle doit être *Active* et sans bandeau ; dans l'onglet
   *Branches*, `master` et `dev` doivent porter la mention *Protected* ; et une poussée directe sur `dev` doit être refusée.
   Sur un dépôt **privé**, GitHub n'applique ces règles qu'avec un abonnement payant (GitHub Pro pour un compte personnel) : sans lui, l'import
   réussit mais un bandeau indique qu'elles ne seront pas appliquées (« won't be enforced… »), et les branches restent non protégées. Les
   workflows restent alors la seule protection : suppression des branches non conformes (à la création et au balayage), check rouge sur une PR
   non conforme, ni version ni publication pour une fusion hors règles ; ils n'empêchent ni une fusion ni une poussée directe. Dans ce cas, **ne
   pas créer `BOT_TOKEN`** : le jeton par défaut des workflows suffit tant que les branches ne sont pas protégées.
4. **Serveur** : le serveur normal et le serveur de test, posés par leurs installateurs, pas à pas dans [`deploy/vps/README.md`](../deploy/vps/README.md).
5. **Mises à jour depuis le site de dev** : secret **`MISE_A_JOUR_TOKEN`** (jeton *fine-grained* d'un administrateur, ce dépôt seulement,
   *Contents*, *Pull requests* et *Workflows* en lecture et écriture) ; le jeton par défaut ne suffit pas, car une PR qu'il ouvre ne lance pas la
   CI et une fusion qu'il fait ne lance pas `livraison.yml`. Seul le job `livrer` du workflow le reçoit, et n'y tournent ni npm ni dépendance
   (le job `preparer`, qui lance `npm ci` et les tests, n'a aucun secret). Le serveur de test a son propre jeton, permission *Actions* seulement
   ([`deploy/vps/README.md`](../deploy/vps/README.md), « Page Mise à jour »). Comme pour `BOT_TOKEN` : s'il a une date d'expiration, le renouveler avant ; sans date, le révoquer et le refaire au moindre doute (*Developer settings → Fine-grained tokens → Revoke*).
6. **Vérifier les bots** : après la première fusion d'une `feature/<nom>` dans `dev`, *Actions → Version et livraison* doit montrer les jobs
   `Version` (commit « chore: version vX.Y.Z … » sur `dev`), `Installateur` (la *release* `VX.Y.Z` du serveur de test) et `Supprimer la branche
   fusionnée`.

## Sessions Claude Code

Une session travaille sur une `feature/<nom>` créée depuis `dev` (ou une `hotfix/<nom>` depuis `master`) et ouvre sa PR vers cette branche. Les noms
de branche que l'environnement propose parfois (`claude/…`, `dev/…`) sont refusés : `dev/…` ne peut même pas exister à côté de la branche `dev`
(Git ne peut pas avoir à la fois `dev` et `dev/xxx`), et `claude/…` serait supprimée par la garde. Le `<nom>` décrit l'évolution ou le correctif
demandé (`feature/npm5-info-apres-titre`), jamais un nom aléatoire proposé par l'environnement (`feature/awesome-pascal-…`) : la session renomme
sa branche avant le premier push (demande du propriétaire).

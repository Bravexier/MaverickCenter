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
  modifiées seulement par PR avec les checks `client`, `character-service` et `regles-de-branches` verts. Voir « Mise en place ».

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
d'étiquette de version sur `master` (seulement celle de son installateur à partir de la 0.2.0, ci-dessous) ; `dev`, elle, reçoit la sienne.
Après une livraison où `dev` rejoint `master` en avance rapide, le même commit porte `VX.Y` et `VX.Y.0`. Une étiquette déjà posée ailleurs (à la main)
n'est jamais déplacée : le bot le signale dans son résumé et continue. Retrouver une version : `git fetch --tags origin`, puis
`git switch --detach V0.1.75`, `git log V0.2..V0.2.3`, ou la page *Tags* de GitHub. Toutes les étiquettes commencent par un **`V` majuscule**,
installateurs compris : deux étiquettes qui ne diffèrent que par la casse (`V0.2.0` et `v0.2.0`) se confondent dans un clone Windows ou macOS.
Les versions d'avant cette règle n'ont pas d'étiquette : leurs commits « chore: version v0.1.N » restent le repère.

Après une livraison, `dev` rejoint `master` (avance rapide, ou fusion si `dev` a bougé entre-temps). Après un hotfix, `master` est refusionnée dans `dev`.
Si cette refusion est en conflit (le hotfix et `dev` ont modifié les mêmes lignes), le bot ne touche pas `dev` et le signale (son passage finit en
rouge, l'installateur de production du hotfix est quand même publié à partir de la 0.2.0) ; la refusion se fait alors par une `feature/<nom>` créée
depuis `dev`, dans laquelle on fusionne `master` et résout les conflits, puis une PR vers `dev`. Seuls les conflits sur la ligne de version se
résolvent seuls. Même chose si le hotfix modifie `.github/workflows/` et que le bot n'a pas de `BOT_TOKEN` avec la permission *Workflows*.

**Toutes les PR vers `dev` et `master` se fusionnent par « Create a merge commit »** (ni *squash* ni *rebase*) : le bot et les contrôles s'appuient sur
l'historique des fusions (une refusion faite par *squash* laisserait `master` hors de `dev`, et la livraison suivante serait refusée).

**Une `feature/<nom>` ou `hotfix/<nom>` en conflit avec sa base se rebase, on n'y fusionne jamais la base** (demande du propriétaire) :
`git fetch --prune origin`, `git rebase origin/dev` (ou `origin/master`), résoudre, puis `git push --force-with-lease`. La PR n'est fusionnée qu'une fois
sans conflit et la CI verte. Seule exception, la refusion de `master` dans `dev` décrite plus haut : elle doit rester une fusion (le bot vérifie que
`master` est dans l'historique de `dev`).

**Avant chaque push, on se remet à jour sur la base, par défaut** (demande du propriétaire) : `git fetch --prune origin` ; si `origin/dev` (ou
`origin/master` pour un hotfix) a bougé depuis le départ de la branche (`git merge-base --is-ancestor origin/dev HEAD` échoue), `git rebase` sur elle,
relancer les contrôles que le rebase touche, puis pousser (`git push --force-with-lease` si la branche était déjà poussée). Même sans conflit : la PR
est ainsi toujours testée sur la base du moment.

Plusieurs fusions rapprochées sont traitées chacune à leur tour par le bot (il relit les branches et recommence si une autre fusion est passée
entre-temps). Relancer un passage déjà fait (*Re-run*) ne refait rien : le bot reconnaît la PR à ses commits « (PR #n) » et s'arrête ; pour republier
une branche, *Actions → Version et livraison → Run workflow*.

## Ce qui est publié : le site unique, puis deux serveurs dès la 0.2.0

**La première version hébergée est la 0.2.0** (`PREMIERE_VERSION_HEBERGEE` dans `tools/flux-git/regles.mjs`, décision du propriétaire du 2026-10-10) :
le duo serveur normal / serveur de test est mis à l'essai en 0.Y, avec le serveur de [`deploy/vps/`](../deploy/vps/README.md), avant la connexion
par Discord. Le bot choisit seul d'après la version (`livrableDe`) ; la première livraison `dev` → `master` (0.1.x → 0.2.0) produit les deux premiers
installateurs. **La 1.0 reste le signal du propriétaire** : l'ouverture à tout le Discord (et non plus aux seuls MJ et administrateurs), avec la
connexion par Discord (identification et utilisateurs, voir [`feuille-de-route.md`](feuille-de-route.md)) ; on y passe par une livraison `dev` →
`master` portant `[V: X+1]`, à la demande du propriétaire.

### Avant la 0.2.0 (versions 0.1.x) : le fonctionnement d'avant, un seul site

Pas de serveur normal ni de serveur de test. Après chaque fusion qui change `dev` (une feature, la refusion après une livraison ou un hotfix),
le job `Site` reconstruit le site depuis `dev` (sans les pages d'exemple) et le publie sur la branche **`site`** ; le NAS la suit avec sa propre
installation, comme aujourd'hui (`deploy/`, `update-site.sh` toutes les 5 minutes ; un NAS déjà installé garde sa copie, nommée `update-nas.sh`). Les versions
suivent les règles ci-dessus ; une livraison `dev` → `master` ne fait que les versions (et `dev`, qui la reçoit, republie le site). Rien n'est à changer sur le NAS.
Le serveur de test du VPS (`dev.maverick-jdr.com`) suit la même branche avec le même script en attendant la 0.2.0 :
[`deploy/vps/README.md`](../deploy/vps/README.md), « Avant la 0.2.0 ».

### À partir de la 0.2.0 : serveur normal et serveur de test, un script d'installation par fusion

La solution est alors hébergée (le NAS est temporaire ; le serveur : [`deploy/vps/`](../deploy/vps/README.md)). Après chaque fusion, le job
`Installateur` construit le site et publie un **installateur** (`deploy/installateur/`) : un script `.sh` autonome qui contient le site et l'installe
sur l'hôte, sans téléchargement ni jeton. Il est publié comme *release* GitHub du dépôt (privée comme lui). La branche `site` n'est plus mise à jour.

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
  À chaque installation, **sa base est remplacée par une copie de celle du serveur normal prise à cet instant** (dossier `db/` de l'instance de
  production ; avec `sqlite3`, chaque base SQLite est copiée par `.backup`, donc cohérente même si la production écrit). Rien de ce qui est fait en
  test ne revient en production.
- **Serveur normal** : le site réellement utilisé (`maverick-center`, port 8080). Une installation remplace le site, **jamais la base vivante** (`db/`).

La copie est faite par l'installateur, sur le serveur, au moment où il s'exécute : GitHub n'a pas accès à la base de production, et elle ne doit pas
quitter le serveur. La base vivante (`db/`) est celle du service des personnages ([`serveur.md`](serveur.md)) : les prétirés dès avant la 1.0, puis les
utilisateurs et leurs fiches ; la base des règles du site (`/donnees/`), elle, est reconstruite
depuis `data/rows` à chaque version.

**Le premier jour hébergé (0.2.0)** : sur l'hôte, lancer l'installateur `V0.2` (serveur normal), puis `V0.2.0-test` (serveur de test, qui copie sa base) ;
la mise à jour automatique de chaque instance est `mise-a-jour.sh`. Le NAS n'est pas touché (sa branche `site` cesse simplement d'avancer).
Un serveur de test posé par `V0.2.0-test` ne cherche que des étiquettes « -test » : il faut y lancer **une fois à la main** l'installateur de
test suivant (`VX.Y.Z`), qui apporte le `mise-a-jour.sh` d'aujourd'hui ; les mises à jour redeviennent ensuite automatiques.
Détails : [`deploy/installateur/README.md`](../deploy/installateur/README.md). Republier une branche sans changer sa version :
*Actions → Version et livraison → Run workflow* (le site avant la 0.2.0, une étiquette `…-rebuild.N` ensuite).

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

Mettre une `feature` à jour : y fusionner `origin/dev`. Mettre une `hotfix` à jour : y fusionner `origin/master`, jamais `dev` ni une `feature` (refusé).

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
livraison `dev` → `master`, fusionnée de même (étape « Livraison vers master » ; jamais `[V: X+1]`). Les bots font ensuite leur travail habituel
(versions, étiquettes, installateurs). Une seule mise à jour à la fois attend sa livraison : tant que celle d'un autre lot est dans `dev` sans être
sur `master`, le workflow refuse d'en commencer une autre.

## Mise en place (une seule fois, par le propriétaire)

Déjà fait : `master` et `dev` existent (en `0.1.25`), `dev` est la branche par défaut, `main` et les anciennes branches de travail sont
supprimées. `develop` (ancienne tentative, entièrement fusionnée) sera supprimée par le premier balayage. Garder `site` : le NAS la suit jusqu'à la 1.0.

1. **Dans chaque clone existant** : `git fetch --prune origin` une fois (voir « Au quotidien »).
2. **Jeton du bot** (seulement quand les règles de l'étape 3 sont réellement appliquées) : le bot pousse directement les incréments de version sur
   `master` et `dev` ; une fois ces branches protégées, le jeton par défaut des workflows ne le peut plus. Créer un jeton *fine-grained*
   (*Settings → Developer settings → Fine-grained tokens*), limité à ce dépôt, permissions *Contents : Read and write* **et** *Workflows : Read and
   write* (sans elle, une refusion qui touche `.github/workflows/` est refusée), et l'enregistrer comme secret **`BOT_TOKEN`** (*Settings → Secrets and
   variables → Actions*). Les poussées du bot se font alors au nom du propriétaire du jeton, qui doit être administrateur du dépôt (exemption des
   règles). **S'il a une date d'expiration**, la noter et le renouveler avant (un jeton expiré arrête versions et publications, le NAS cesse d'être mis à
   jour) ; supprimer le secret fait revenir au jeton par défaut.
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
4. **Serveur** : rien sur le NAS (il suit toujours la branche `site`, avec sa propre installation). Dès la 0.2.0, voir « Le premier jour hébergé » ci-dessus.
5. **Mises à jour depuis le site de dev** : secret **`MISE_A_JOUR_TOKEN`** (jeton *fine-grained* d'un administrateur, ce dépôt seulement,
   *Contents*, *Pull requests* et *Workflows* en lecture et écriture) ; le jeton par défaut ne suffit pas, car une PR qu'il ouvre ne lance pas la
   CI et une fusion qu'il fait ne lance pas `livraison.yml`. Seul le job `livrer` du workflow le reçoit, et n'y tournent ni npm ni dépendance
   (le job `preparer`, qui lance `npm ci` et les tests, n'a aucun secret). Le serveur de test a son propre jeton, permission *Actions* seulement
   ([`deploy/vps/README.md`](../deploy/vps/README.md), « Page Mise à jour »). Comme pour `BOT_TOKEN` : s'il a une date d'expiration, le renouveler avant ; sans date, le révoquer et le refaire au moindre doute (*Developer settings → Fine-grained tokens → Revoke*).
6. **Vérifier les bots** : après la première fusion d'une `feature/<nom>` dans `dev`, *Actions → Version et livraison* doit montrer les jobs
   `Version` (commit « chore: version v0.1.26 … » sur `dev`), `Site (avant la 1.0)` (branche `site` republiée) et `Supprimer la branche fusionnée`.

## Sessions Claude Code

Une session travaille sur une `feature/<nom>` créée depuis `dev` (ou une `hotfix/<nom>` depuis `master`) et ouvre sa PR vers cette branche. Les noms
de branche que l'environnement propose parfois (`claude/…`, `dev/…`) sont refusés : `dev/…` ne peut même pas exister à côté de la branche `dev`
(Git ne peut pas avoir à la fois `dev` et `dev/xxx`), et `claude/…` serait supprimée par la garde. Le `<nom>` décrit l'évolution ou le correctif
demandé (`feature/npm5-info-apres-titre`), jamais un nom aléatoire proposé par l'environnement (`feature/awesome-pascal-…`) : la session renomme
sa branche avant le premier push (demande du propriétaire).

## Minutes GitHub Actions

Le dépôt est privé : chaque job consomme des minutes du compte (quota de l'abonnement, puis budget payant ; un job est arrondi à la minute
supérieure). Le 2026-10-14, quota épuisé et budget à 0 $, toute la CI a été bloquée. Demande du propriétaire : économiser. Depuis :

- `ci.yml` tourne sur chaque PR et sur `master` après une fusion, **plus sur `dev`** (la PR vient d'être testée ; le commit de version ne change
  que des numéros) ; un nouveau push sur une PR annule le passage en cours de l'ancien commit ;
- l'installateur de `livraison.yml` ne relance plus `npm test` (build et `--verifier` de l'installateur seulement).

Une PR avec un seul push coûte ainsi environ 25 minutes au lieu de 75. Le risque accepté : deux PR vertes chacune, fusionnées l'une après
l'autre, peuvent se casser ensemble sans que `dev` le signale ; la PR suivante (rebasée sur `dev`) le montre alors.

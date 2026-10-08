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

Une seule version, `X.Y.Z`, dans `client/package.json` (et `package-lock.json`) ; le site l'affiche en pied de page. Le bot (`livraison.yml`, job `Version`)
la tient après chaque fusion ; **personne ne la change à la main**.

| Fusion | `dev` | `master` |
| --- | --- | --- |
| `feature/<nom>` → `dev` | `X.Y.Z` → `X.Y.Z+1` | inchangée |
| `dev` → `master` (livraison) | `X.Y.Z` → `X.Y+1.0` | `X.Y.Z` → `X.Y+1.0` |
| `dev` → `master` avec **`[V: X+1]`** dans le titre ou la description de la PR | `X.Y.Z` → `X+1.0.0` | `X.Y.Z` → `X+1.0.0` |
| `hotfix/<nom>` → `master` | `master` y est refusionnée, puis `X.Y.Z` → `X.Y.Z+1` | inchangée |

Exemple : `master` et `dev` en `0.1.25` ; deux features → `dev` `0.1.27` ; livraison → les deux en `0.2.0` ; une feature → `dev` `0.2.1` ;
un hotfix → `master` reste `0.2.0`, `dev` reçoit le correctif et passe en `0.2.2` ; livraison `[V: X+1]` → les deux en `1.0.0`.

Après une livraison, `dev` rejoint `master` (avance rapide, ou fusion si `dev` a bougé entre-temps). Après un hotfix, `master` est refusionnée dans `dev`.
Si cette refusion est en conflit (le hotfix et `dev` ont modifié les mêmes lignes), le bot ne pousse rien et le signale ; la refusion se fait alors par une
`feature/<nom>` créée depuis `dev`, dans laquelle on fusionne `master` et résout les conflits, puis une PR vers `dev`. Seuls les conflits sur la ligne de
version se résolvent seuls.

## Les livraisons : un script d'installation par fusion

Après chaque fusion, le job `Installateur` construit le site (sans les pages d'exemple) et publie un **installateur** : un script `.sh` autonome qui contient
le site et l'installe sur le serveur, sans téléchargement ni jeton. Il est publié comme *release* GitHub du dépôt (privée comme lui) :

| Fusion dans | Installateur | Étiquette (release) |
| --- | --- | --- |
| `dev` (feature, ou refusion après livraison ou hotfix) | **test** | `vX.Y.Z-test` (pré-version) |
| `master` (livraison) | **production** | `vX.Y.Z` |
| `master` (hotfix : même version) | **production** | `vX.Y.Z-hotfix.N` |

- **Mode test** : serveur d'essai (`maverick-center-test`, port 8081, bandeau « Serveur de test » sur chaque page, `[TEST]` dans le titre de l'onglet).
  À chaque installation, **sa base est remplacée par une copie de celle de la production prise à cet instant** (dossier `db/` de l'instance de production ;
  avec `sqlite3`, chaque base SQLite est copiée par `.backup`, donc cohérente même si la production écrit). Rien de ce qui est fait en test ne revient en production.
- **Mode production** : le site réellement utilisé (`maverick-center`, port 8080). Une installation remplace le site, **jamais la base vivante** (`db/`).

La copie est faite par l'installateur, sur le serveur, au moment où il s'exécute : GitHub n'a pas accès à la base de production, et elle ne doit pas quitter
le serveur. **Aujourd'hui, la production n'a pas encore de base vivante** : la base du site (`/donnees/`) est reconstruite depuis `data/rows` à chaque version.
Le dossier `db/` de la production est donc vide, et la copie de test aussi, jusqu'à ce qu'un service (édition, fiches de personnages, voir
`feuille-de-route.md`) y écrive ; le mécanisme est en place et testé pour ce moment-là.

Installer, mettre à jour, automatiser : [`deploy/README.md`](../deploy/README.md). Régénérer l'installateur d'une branche sans changer sa version :
*Actions → Version et livraison → Run workflow* (étiquette `…-rebuild.N`).

## Au quotidien

```bash
# Une évolution
git fetch origin && git switch -c feature/carte-du-monde origin/dev
# … commits …
git push -u origin feature/carte-du-monde        # puis PR feature/carte-du-monde → dev

# Une correction urgente de la production
git fetch origin && git switch -c hotfix/lien-casse origin/master
git push -u origin hotfix/lien-casse             # puis PR hotfix/lien-casse → master

# Une livraison : PR dev → master (ajouter [V: X+1] au titre pour une version majeure), fusion par « Create a merge commit »
```

Mettre une `feature` à jour : y fusionner `origin/dev`. Mettre une `hotfix` à jour : y fusionner `origin/master`, jamais `dev` ni une `feature` (refusé).

## Mise en place (une seule fois, par le propriétaire)

Déjà fait : `master` et `dev` existent, en `0.1.25`.

1. **Branche par défaut → `dev`** (*Settings → General → Default branch*) : les clones et les nouvelles sessions partent de `dev`.
   Puis supprimer les branches qui n'ont plus de rôle : `main` (identique à `master`), `develop` et `feature/branch-strategy-master-develop`
   (première tentative, remplacée par ce flux), et `site` une fois le NAS passé aux installateurs (étape 4).
2. **Jeton du bot** : le bot pousse directement les incréments de version sur `master` et `dev`. Dès que ces branches sont protégées (étape 3), le jeton
   par défaut des workflows ne le peut plus. Créer un jeton *fine-grained* (*Settings → Developer settings → Fine-grained tokens*), limité à ce dépôt,
   permission *Contents : Read and write*, et l'enregistrer comme secret **`BOT_TOKEN`** (*Settings → Secrets and variables → Actions*).
   Les poussées du bot se font alors au nom du propriétaire du jeton, qui doit être administrateur du dépôt (exemption des règles de l'étape 3).
3. **Règles GitHub** : *Settings → Rules → Rulesets → New ruleset → Import a ruleset*, une fois pour chaque fichier de `.github/rulesets/` :
   `master.json`, `dev.json` (PR obligatoire, checks verts, ni suppression ni réécriture ; exemption : administrateurs, pour le bot) et
   `noms-de-branches.json` (création limitée à `feature/**` et `hotfix/**`, sans exemption).
   Attention : sur un dépôt **privé**, GitHub n'applique ces règles qu'avec un abonnement payant (GitHub Pro pour un compte personnel). Sans lui,
   les gardes des workflows restent actives (suppression des branches non conformes, check rouge sur une PR non conforme, aucune version ni
   installateur pour une fusion hors règles) mais n'empêchent ni une fusion ni une poussée directe.
4. **Serveur** : remplacer l'ancienne mise à jour (branche `site`) par les installateurs, voir [`deploy/README.md`](../deploy/README.md),
   « Passer de l'ancienne mise à jour ».

## Sessions Claude Code

Une session travaille sur une `feature/<nom>` créée depuis `dev` (ou une `hotfix/<nom>` depuis `master`) et ouvre sa PR vers cette branche. Les noms
de branche que l'environnement propose parfois (`claude/…`, `dev/…`) sont refusés : `dev/…` ne peut même pas exister à côté de la branche `dev`
(Git ne peut pas avoir à la fois `dev` et `dev/xxx`), et `claude/…` serait supprimée par la garde.

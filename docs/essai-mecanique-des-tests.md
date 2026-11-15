# Essai mécanique des tests (lot 10, premier temps)

Mesure faite le 2026-11-15 sur `origin/dev` (v0.4.94), sans modifier un test, un module du site ni une donnée. Script : `client/scripts/essai-mecanique-tests.mjs` (usage en tête). Tri par fichier : `docs/essai-mecanique-des-tests.json` (`--trier --ecrire-docs`).

## Méthode

Chaque fichier de `client/test/` est lancé seul, deux fois, avec `MAVERICK_CONTENU=<fichier SQLite>` (`lib/contenu-fourni.mjs`) :
- **A, le vrai contenu** : l'extrait de la base construite depuis `data/rows` (`fabriquerExtrait`). Vérifie le branchement.
- **B, un contenu différent** : le même extrait, dont les **noms** (`nom`, `titre`, `libelle`, `intitule`) et les **textes libres** (`description`, `texte`, `corps_md`, `effet`, `remarque`… : 26 colonnes) sont remplacés par des valeurs factices (« Nom factice <table> <n> », « Texte factice… »). Identifiants, clés de jointure, `*_brut`, formules, types, JSON `donnees`, liens entre lignes et structure restent ; les `*_cle` sont recalculées par `normalize()`. 123 tables, 14 431 lignes. Restent telles quelles : `evenement_extrait` (un CHECK exige que `texte` contienne `date_brut`), `alias`, `source`, `mot_cle_synonyme` et les tables du journal.

Deux réglages ont été nécessaires pour A, sans toucher aux tests : fabriquer `client/src/content/wiki/` (`npm run db:export-pages`, absent d'une copie neuve), et retirer du contenu la vue `extrait_meta` (voir « Surprises »).

## Les trois comptes (444 fichiers)

| Catégorie | Fichiers |
| --- | ---: |
| Passe sur les deux contenus | 176 |
| **Casse sur le contenu différent** (passe sur le vrai) | **212** |
| Ne lit pas le contenu (passe sur les deux, aucune marque de lecture) | 56 |
| Casse sur le vrai contenu | 0 |

« Ne lit pas le contenu » vient d'une lecture statique des importations (transitives). Sur les 176 qui passent, **173 lisent aussi le dépôt en direct** (`data/rows`, `data/migrations`, Python, `db-build`, `content/wiki`) : leur réussite sur B ne prouve rien, ils lisent encore le vrai contenu par un autre chemin que la variable.

## Familles de cause des 212 (classement par règles sur le premier message d'erreur : approché)

| Famille | Fichiers | Réglable d'un coup ? |
| --- | ---: | --- |
| Valeur, liste ou comptage attendus qui ont changé | 70 | non : un par un |
| Un nom ou un texte du contenu comparé tel quel | 57 | par famille de tables |
| Fiche de personnage et moteur (échec sans message) | 41 | par famille : la fiche lit noms et textes de règles |
| Ligne cherchée par son nom ou son titre, absente | 12 | oui, en cherchant par identifiant |
| Règle lue dans un texte (puces d'effets, notes, relecture) | 13 | non : se contrôle sur le vrai contenu |
| Structure du corps Markdown (sections, balises) | 8 | oui : un corps de gabarit |
| Autre | 11 | un par un |

Sur les 161 fichiers qui utilisent `aide-base-d-import`, **131 cassent** sur B et 30 passent ; sur les 40 qui lancent Python, 22 cassent.

## Le second chemin (`aide-base-d-import`)

Il passe **déjà** par `cheminBase()`, donc par `MAVERICK_CONTENU` : les 161 fichiers se branchent en un seul endroit, et passent sur le vrai contenu fourni (A). L'extrait garde `historique_modification`, donc l'état d'import se reconstruit. Deux restes lisent encore le dépôt : `data/migrations/*.json` (réécritures des migrations) et `test/fixtures/lots-avant-*.json`.

Ce qui ne se branche pas, c'est la **nature** de ces tests : ils épinglent le texte que l'import a écrit, donc le vrai contenu ; sur un contenu factice ils cassent (131/161). Il faut les trier : (a) un contrôle de **cohérence du vrai contenu**, qui tourne sur le serveur (R275) ; (b) un test de **fonctionnement** qui reçoit son contenu d'un jeu d'essai. La demande : une décision par famille de tables, puis brancher `aide-base-d-import` sur un contenu d'essai (même schéma, identifiants stables) au lieu du vrai.

## Reste à faire, en lots

1. **S : branchement propre.** Retirer (ou tolérer) la vue `extrait_meta` à l'ouverture d'un contenu fourni (8 fichiers) ; fabriquer `content/wiki` depuis le contenu fourni (aujourd'hui depuis `data/rows`).
2. **M : un jeu d'essai commun**, aux identifiants stables, qui remplace le vrai pour GitHub ; l'essai B en est le prototype.
3. **M : les familles réglables d'un coup** (~80 fichiers : lignes cherchées par nom, corps Markdown, noms comparés).
4. **L : les 131 tests d'état d'import**, famille par famille, avec la décision du propriétaire (contrôle du vrai contenu sur le serveur, ou invariant sur le jeu d'essai).
5. **L : fiche et moteur (41)**, les 70 « valeurs attendues », puis Python (22).

Estimation : environ 130 fichiers demanderont un vrai travail, 80 se règlent par famille, 232 n'ont rien à faire (56 ne lisent pas le contenu, 176 passent déjà, sous réserve du chemin direct ci-dessus).

## Surprises

- 232 fichiers passent sans changement, mais 173 lisent le dépôt par un autre chemin que la variable.
- Un contenu fourni est un **extrait** : sa vue `extrait_meta` fait échouer 8 fichiers sur le vrai contenu même.
- Le dossier fabriqué `content/wiki` n'est pas couvert par `MAVERICK_CONTENU` : 18 fichiers échouent sans lui, et il porte le vrai contenu.
- Durée cumulée des deux passes : environ 66 minutes de processeur, sur 4 cœurs.

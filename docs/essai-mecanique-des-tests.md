# Essai mécanique des tests (lot 10, premier temps)

Mesure faite le 2026-11-15 sur `origin/dev` (v0.4.94 ; le tri est refait sur v0.4.95, les fichiers arrivés depuis ne sont pas mesurés), sans modifier un test, un module du site ni une donnée. Script : `client/scripts/essai-mecanique-tests.mjs` (usage en tête). Tri par fichier : `docs/essai-mecanique-des-tests.json` (`--trier --ecrire-docs`).

## Méthode

Chaque fichier de `client/test/` est lancé seul, deux fois, avec `MAVERICK_CONTENU=<fichier SQLite>` (`lib/contenu-fourni.mjs`) :
- **A, le vrai contenu** : l'extrait de la base construite depuis `data/rows` (`fabriquerExtrait`). Vérifie le branchement.
- **B, un contenu différent** : le même extrait, dont les **noms** (`nom`, `titre`, `libelle`, `intitule`) et les **textes libres** (`description`, `texte`, `corps_md`, `effet`, `remarque`… : 26 colonnes) sont remplacés par des valeurs factices (« Nom factice <table> <n> », « Texte factice… »). Identifiants, clés de jointure, `*_brut`, formules, types, JSON `donnees`, liens entre lignes et structure restent ; les `*_cle` sont recalculées par `normalize()`. 123 tables, 14 431 lignes. Restent telles quelles : `evenement_extrait` (un CHECK exige que `texte` contienne `date_brut`), `alias`, `source`, `mot_cle_synonyme` et les tables du journal.

Deux réglages ont été nécessaires pour A, sans toucher aux tests : fabriquer `client/src/content/wiki/` (`npm run db:export-pages`, absent d'une copie neuve), et retirer du contenu la vue `extrait_meta` (voir « Surprises »).

## Les trois comptes (444 fichiers)

| Catégorie | Fichiers |
| --- | ---: |
| Passe sur les deux contenus | 177 |
| **Casse sur le contenu différent** (passe sur le vrai) | **212** |
| Ne lit pas le contenu (passe sur les deux, aucune marque de lecture) | 55 |
| Casse sur le vrai contenu | 0 |

« Ne lit pas le contenu » vient d'une lecture statique des importations (transitives). Sur les 177 qui passent, **173 lisent aussi le dépôt en direct** (`data/rows`, `data/migrations`, Python, `db-build`, `content/wiki`) : leur réussite sur B ne prouve rien, ils lisent encore le vrai contenu par un autre chemin que la variable.

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

1. **S : branchement propre.** Fait (lot 10) : la vue `extrait_meta` est retirée de la copie de travail (`lib/contenu-fourni.mjs#preparerLaCopie`), et `content/wiki` se fabrique depuis le contenu fourni (`db-export-pages`) ; voir « Passe C et variantes ».
2. **M : un jeu d'essai commun**, aux identifiants stables, qui remplace le vrai pour GitHub ; l'essai B en est le prototype.
3. **M : les familles réglables d'un coup** (~80 fichiers : lignes cherchées par nom, corps Markdown, noms comparés).
4. **L : les 131 tests d'état d'import**, famille par famille, avec la décision du propriétaire (contrôle du vrai contenu sur le serveur, ou invariant sur le jeu d'essai).
5. **L : fiche et moteur (41)**, les 70 « valeurs attendues », puis Python (22).

Estimation : environ 130 fichiers demanderont un vrai travail, 80 se règlent par famille, 232 n'ont rien à faire (55 ne lisent pas le contenu, 177 passent déjà, sous réserve du chemin direct ci-dessus).

## Passe C et variantes (lot 10, 2026-11-18)

La passe C lance chaque fichier de test sur l'extrait du site de dev (`var/extrait/maverick-dev.db`), dans une copie jetable de l'arbre **sans** `data/rows/*.sql` (`scripts/essai-mecanique-tests.mjs --passe C`). Premier passage : **58 fichiers sur 486 en échec**, en cinq familles.

- **F1, pages d'exemple absentes** (le site de dev n'en a pas) : la copie de travail d'un contenu qui n'en a aucune reçoit celles du dépôt (`data/pages-d-exemple.sql`, `scripts/db-pages-d-exemple.mjs`). `adresses-db`, `db-liens-en-mots-cles`, `db-r184-plan-des-regles`, `donnees`, `livres`, `mots-cles-liens`, `serveur-edition-liens-rompus`, `serveur-edition-mots-cles-liens`, `serveur-mise-a-jour-production` passent depuis.
- **F2, une base ou des lignes de départ reconstruites depuis `data/rows`** par une aide ou un test (`db-build`, copie de `data/rows`). Réglé par une aide commune, `test/aide-base-de-depart.mjs` : sans `MAVERICK_CONTENU`, rien ne change ; avec, `baseDeDepart()` prend une copie du contenu fourni préparée par la voie de `ouvrirBase` (`preparerLeContenu`, tables calculées vidées : une base non dérivée), et `rowsDeDepart()` l'export de cette copie (`tools/db/exporter.py`, une fois par processus). Branchées : `aide-structure-sur-place.mjs#baseDesRegles`, `aide-mots-cles.mjs#reglesAvecDesMotsClesDEssai`, et les copies de `data/rows` des tests de rapatriement et de mise à jour (`copieSansNoteEnAttente(…, { rows: rowsDeDepart() })`). Les 22 fichiers branchés passent C et restent verts sans la variable (les 3 autres de la liste de départ, `mots-cles-liens` et les deux `serveur-edition-*-liens*`, ne cassaient que sur F1), ainsi que `bascule-constat`, qui n'avait que `baseDesRegles` contre lui.
- **F3, l'ancien circuit**, qui écrit ou relit `data/rows` par nature (`db:build`, `db:sync-pages`, `db:appliquer-edition`, mise à jour et copie vers le dépôt, simulation) ;
- **F4, les invariants « table des fiches vide dans `data/rows` »** ;
- **F5, les outils Python** qui relisent `data/rows` (`codex.py --verifier`, `races_onglet.py --verifier`).

**Ce qui lit encore le dépôt, et pourquoi.** F3, F4 et F5 sont déclarées dans `LIT_LE_DEPOT_PAR_NATURE` (`scripts/essai-mecanique-tests.mjs`) : fichier, famille, raison en une ligne, tests concernés. Le tri de C les range dans une rubrique « lit le dépôt par nature, jusqu'au lot 12 » (quand `data/rows` quitte le dépôt et que l'ancien circuit est retiré), à part des échecs inattendus ; un fichier classé qui passe C y est signalé, à retirer de la liste. `test/essai-mecanique.test.mjs` vérifie que chaque nom existe dans `client/test/`. Ils sont 22 : 14 en F3 (dont `pages-d-exemple`, test 1, voulu : le fichier des pages d'exemple est comparé à `data/rows`, dont il est tiré ; `baliser-mot-cle`, tests 3, 7 et 8, sur une copie de `data/rows` ; et `contenu-fourni`, test 2, voulu : sans la variable, le build exige `data/rows`), 6 en F4, 2 en F5. `baliser-mot-cle` y est une exception temporaire : il copie `data/rows` en direct, et son module est tenu par une autre session ; il sera converti par `aide-base-de-depart` ensuite. `db-r182-critique-du-sort-prepare` en est sorti : sa lecture de `data/rows/posture_critique.sql` doublait celle de la base.

**Après ce lot**, les passes C et V1 complètes ne font échouer que les 22 fichiers classés par nature.

**Contrôles d'une passe (`--passe <P> --controles`, P = C, V1 à V5).** Les tests du site construit échappent aux passes fichier par fichier : une copie jetable n'a pas de `dist/`. `--controles` lance dans la copie, sous `MAVERICK_CONTENU` = le contenu de la passe, les contrôles du job preparer (`mise-a-jour-github.mjs#CONTROLES`, donc le job client de `ci.yml`) :
- le build, puis chaque test du site construit, à part : un test sauté ou vide est rouge ;
- le build de test et le bandeau, l'installateur, puis le build de production et ses deux tests, et l'artefact.

`npm test` reste à la passe elle-même. `db:build` et `db:check` (`CONTROLES_PAR_NATURE`) sont notés à part et ne la rendent pas rouge. Sur C (2026-11-18) : au vert en 205 s, 24 tests du site lancés, aucun test sauté (`races-html` : 15 passés).

**Variantes.** V1 (icônes posées sur des mots-clés de genres variés) a trouvé une valeur figée : `db-0116-icone-des-mots-cles`, « lui seul a une icône ». V1 laisse maintenant la trace de ses saisies : le test vérifie à l'import que chaque mot-clé d'une monnaie a l'icône de sa monnaie, et lui seul, et lit aussi dans la migration qu'elle n'en pose qu'à eux. Il passe V1.

**Des variantes fidèles au site.** Les passes complètes V2 et V3 trouvaient 24 fichiers qui passaient C et cassaient sur une variante (18 sur V2, 6 sur V3). Tous venaient de variantes infidèles (c), aucun d'un défaut du code :
- **Aucune trace.** Une saisie du site laisse sa trace dans `historique_modification`, et l'état d'import la défait ; les variantes écrivaient sans trace. Chacune note désormais ses écritures comme le journal (`essai-variantes.mjs#journalDeLaVariante` : nature `saisie`, version NULL, la ligne entière pour une insertion ou une suppression, les colonnes changées pour une modification). Réglés ainsi : `bestiaire-extraction`, `db-0121-maj-decembre-suites`, `sources-rapprochement`.
- **V2 renommait une magie**, ce que le site ne permet pas : `magie.nom` n'est pas modifiable (`lib/edition-modele.mjs#TABLES.magie`), et un test peut alors lire une magie par son nom (`tests-conventions`). V2 renomme désormais un sort **par le service** (`serveur/edition.mjs#enregistrer` : validations, dérivations, journal), puis verse le journal dans l'historique et vide les tables du journal, comme l'extrait (`serveur/historique.mjs#historiser`). Les 18 fichiers de V2 passent. L'ancien renommage d'une magie reste une variante à part, **V5** (écriture directe, avec sa trace) : elle est hors des voies du site aujourd'hui, et le tri la range à part (« informative, ne bloque rien », `PASSES_INFORMATIVES`). La preuve qu'aucune voie du site ne renomme une magie est `test/serveur-edition-nom-de-magie.test.mjs` : le service refuse `magie.nom`, le titre de la page d'une magie (seules les pages du guide et du Codex ont un titre modifiable) et tout alias (ni table du modèle, ni entité).
- **V3 copiait une ligne en écriture directe**, sans ses filles ni le corps de la page qui la montre, et au-delà de ce que le service permet (une troisième spécialité). V3 crée maintenant chaque ligne **par le service** (opération `creer`, valeurs tirées de la dernière ligne de la table) : un refus est noté, jamais forcé (la spécialité : `SPECIALITES_MAX`). Réglés : `arme-champs`, `chronologie`, puis, sur la passe complète, `capacites-content` (test 4), `corps-armes` (test 1) et `serveur-edition-armes` (test 4).
- **`corps-classes`, test 4.** Le test exigeait un don pour chaque spécialité ; or le site peut créer une spécialité avant ses dons. Il le vérifie maintenant à l'import ; sur l'état courant, une spécialité est une bannière si et seulement si elle a un don.

`races-html` (tableau des magies innées) lit maintenant dans la base les noms de ses en-têtes et le nombre de ses colonnes. La couleur d'une magie reste tirée de son nom (`lib/palette-css.mjs#classeDeMagie`, `lib/sort-format.mjs#cleDeMagieConnue`). Le site ne peut pas la renommer, mais un renommage par l'import ou par une migration ferait perdre la couleur : à tirer de l'identifiant (proposition à tech-front).

## Surprises

- 232 fichiers passent sans changement, mais 173 lisent le dépôt par un autre chemin que la variable.
- Un contenu fourni est un **extrait** : sa vue `extrait_meta` fait échouer 8 fichiers sur le vrai contenu même.
- Le dossier fabriqué `content/wiki` n'est pas couvert par `MAVERICK_CONTENU` : 18 fichiers échouent sans lui, et il porte le vrai contenu.
- Durée cumulée des deux passes : environ 66 minutes de processeur, sur 4 cœurs.

## Annexe : les listes (pour la suite ; le détail par fichier est dans le fichier JSON)

Noms de fichiers sans `.test.mjs`. Le fichier JSON porte la catégorie, la famille et ce que chaque fichier lit.

### Les trois tas

#### Cassent sur le contenu factice (212)

`accessoire-champs`, `accessoires-db`, `aide-base-d-import`, `alchimie-couleurs`, `arme-champs`, `armes-elementaires-db`, `armes-elementaires-rendu`, `armes-materiau-par-defaut`, `armure-elementaire-donnees`, `armures-e6`, `baliser-mot-cle`, `bestiaire-db`, `bestiaire-echelles`, `bestiaire-extraction`, `boucliers-poids`, `boxeur-bouclier`, `capacites-content`, `caracteristiques-postures`, `ceinture-db`, `chronologie`, `classe-champs`, `classes-dons`, `classes-notes`, `classes-sans-suffixe`, `codex`, `corps-armes`, `corps-armures`, `corps-classes`, `corps-composants`, `corps-magies`, `corps-metiers`, `corps-potions`, `corps-races`, `creature-npm`, `db-0100-ancres-figees-des-intertitres`, `db-0111-relecture-des-regles`, `db-0113-mots-cles-id-entier`, `db-0114-categories-assignees`, `db-0117-magies-v10-specialisations`, `db-0118-specialisation-de-la-fiche`, `db-0119-classes-materiaux-d12`, `db-0120-races-fongoide-gemidien`, `db-0121-maj-decembre-suites`, `db-0122-retrait-la-montee-de-niveau`, `db-0123-fusion-pages-alignement`, `db-0124-retrait-accessoires-et-ceinture`, `db-0126-onglets-de-l-alignement`, `db-appliquer-edition-familles`, `db-appliquer-edition`, `db-arme-famille-nom-lecture`, `db-armes-elementaires`, `db-lexique-en-mots-cles`, `db-liens-en-mots-cles`, `db-pages-du-site`, `db-r174-resistances-physiques`, `db-r180-reussite-critique`, `db-r181-dons-variables`, `db-r182-critique-du-sort-prepare`, `db-r184-plan-des-regles`, `db-r198-r208-textes-du-guide`, `db-r203-r204-r205`, `db-r207-armures-et-fabrication`, `db-r209-bestiaire`, `db-r231-attaquer-et-se-defendre`, `db-remarque`, `db-retrait-alterations-d-etats-et-mode-hyper`, `db-retrait-liste-des-effets-mode-hyper`, `db-retrait-pages-doublons-des-combats`, `degats-texte`, `donnees`, `eaunoire`, `edition-liens-des-valeurs`, `edition-rendu`, `epreuve-lots-0122-0124`, `equipement-craft-notes`, `equipement`, `etat-ancre`, `fiche-accessoires`, `fiche-acquis`, `fiche-actions-passifs`, `fiche-arme-choisie`, `fiche-armes-elementaires`, `fiche-armes-tri`, `fiche-armure-cassee`, `fiche-armure-elementaire`, `fiche-armure`, `fiche-bouclier-defense`, `fiche-ceinture-inventaire`, `fiche-critique-sort-prepare`, `fiche-critique`, `fiche-degats-recus`, `fiche-dons-variables`, `fiche-durabilite`, `fiche-familles-creees`, `fiche-flagelleur`, `fiche-format-retirees`, `fiche-grenades-et-sort-prepare`, `fiche-invocations`, `fiche-liens-glossaire`, `fiche-listes-infobulles`, `fiche-maitrises`, `fiche-maj-decembre-suites`, `fiche-mode-hyper-r187`, `fiche-mode-hyper`, `fiche-moteur`, `fiche-postures-sorts`, `fiche-refonte`, `fiche-regles`, `fiche-resistances-armure-elementaire`, `fiche-resistances-physiques`, `fiche-sante-potentiel`, `fiche-sorts-fer`, `fiche-tableur-aller-retour`, `fiche-tableur-export`, `fiche-tableur-import`, `fiche-tableur-noms-d-avant`, `fiche-tableur-noms-renommes-par-migration`, `fiche-tableur-page`, `glossaire-filtre`, `guide-mode-hyper`, `guide`, `liens-familiers-prototype`, `limite-texte`, `livres`, `lots-rendu-service`, `magie-fleches`, `magies-notes`, `magies-page`, `magies-specialisations`, `maitrise-arme-sources`, `maitrise-arme`, `maitrise-sorts`, `markdown-edition`, `markdown-sur`, `metier-champs`, `metiers`, `mise-a-jour-regles`, `monnaies`, `mots-cles-balises`, `mots-cles-cles`, `mots-cles-des-valeurs`, `mots-cles-liens`, `mots-cles-r195`, `nav`, `orthographe-base`, `orthographe-magies`, `orthographe-noms`, `palette-css`, `panneaux-regles`, `personnages-db`, `plan-des-regles-db`, `potentiel-illimite`, `potion-etats`, `r188-npm-potentiel-illimite-base`, `r188-r189-npm-et-grimoire`, `r236-fiche-specialisations`, `race-relations`, `races-detail-content`, `races-magies-content`, `races-magies-innees-liste`, `races-onglet`, `resistance-combinaison`, `resistance-texte`, `ressources-registre`, `serveur-api-v1`, `serveur-api`, `serveur-armure-elementaire`, `serveur-base-vivante-empreinte-logique`, `serveur-base-vivante`, `serveur-debug-tables`, `serveur-dons-obtenus`, `serveur-edition-armes`, `serveur-edition-armures`, `serveur-edition-bestiaire`, `serveur-edition-classes`, `serveur-edition-composants`, `serveur-edition-conflits-maitrises`, `serveur-edition-conflits`, `serveur-edition-consommables`, `serveur-edition-corps`, `serveur-edition-derivations`, `serveur-edition-fiches`, `serveur-edition-fusion`, `serveur-edition-guide`, `serveur-edition-journal`, `serveur-edition-lots-annulation`, `serveur-edition-lots-mot-cle`, `serveur-edition-lots`, `serveur-edition-magies`, `serveur-edition-maitrises`, `serveur-edition-mots-cles-liens`, `serveur-edition-panneaux`, `serveur-edition-plan`, `serveur-edition-races`, `serveur-edition-rapatriement`, `serveur-edition-regles-du-don`, `serveur-edition-rejeu-corps`, `serveur-edition-rejeu-gel`, `serveur-edition-rejeu-liens`, `serveur-edition-rejeu-metiers`, `serveur-edition-rejeu-resistances`, `serveur-edition`, `serveur-poids-portable`, `sort-analyse`, `sort-cout-secondaire`, `sort-etats`, `sorts-fer`, `sources-copies`, `sources-rapprochement`, `suppressions-d11`, `tables-de-la-base`, `valeurs-fermees-rendu`

#### Passent sur les deux (177)

`accessoires-generateur`, `accessoires-html`, `accueil-html`, `adresses-db`, `ancres-figees`, `annexes-magie-notes`, `api-doc`, `archives`, `arme-forge`, `armes-de-famille`, `armes-edition`, `armes-effets-a-part`, `armes-filtres`, `armes-html`, `armes-menus`, `armure-champs`, `armures-html`, `autolink`, `bestiaire-html`, `bestiaire-pages-html`, `ceinture-html`, `chronologie-editeur`, `chronologie-html`, `chronologie-rendu`, `citations-db`, `classe-dons-rendu`, `classes-html`, `comparaison-de-sites`, `composants-html`, `composants-onglets`, `conflits-rendu`, `conflits-suit-le-don`, `contenu-fourni`, `controles-du-contenu`, `corrections`, `db-0099-solidite-et-tableau-du-sort`, `db-0115-mots-cles-synonymes`, `db-0116-icone-des-mots-cles`, `db-0125-types-de-degats-et-magies`, `db-0127-nature-des-traces`, `db-0128-lots-de-changements`, `db-0129-migrations-recues`, `db-appliquer-edition-traces-0113`, `db-derive-recherche`, `db-donnees`, `db-extrait`, `db-index-retires`, `db-journal-resolution`, `db-r172-mode-hyper-activable`, `db-r172-sort-prepare-en-mode-hyper`, `db-r173-compteurs-d-actions`, `db-rang-des-races`, `db-schema`, `debug-metriques`, `debug-schema`, `debug-structure`, `deploy-acces`, `deploy-sauvegardes-installer`, `deploy-volume`, `diff-replie`, `dons-edition`, `dons-variable-formulaire`, `edition-annonces`, `edition-composants-ajout`, `edition-mots-cles`, `edition-panneaux`, `edition-races-liens-magies`, `edition-saisies`, `equipement-html`, `fabrication-depuis-contenu`, `fiche-html`, `flux-git-etat`, `fusion-trois-voies`, `glossaire-balisage`, `glossaire-html`, `glossaire-tableau`, `guide-html`, `guide-sans-chapitres`, `historique-site`, `icones-degats-et-magies`, `importeurs-etiquettes`, `infobulles`, `installateur-essai-de-structure`, `installateur`, `instructions-claude`, `invocations-notes`, `lamia-corruption`, `libelles-de-la-base`, `lot-de-changements-annulation`, `lot-de-changements-numeros`, `lot-de-changements`, `lots-rendu`, `magie-non-compatible`, `magie-relations`, `magies-html`, `markdown-rendu`, `materiaux-couleurs`, `mentions-des-mots-cles`, `metiers-html`, `migrer-normaliseur`, `mise-a-jour-etat-production`, `mise-a-jour-github`, `mise-a-jour-simulation`, `mise-a-jour`, `mots-cles-liens-rendu`, `mots-cles-python`, `mots-cles-r223`, `mots-cles-vivants-liens`, `mots-cles-vivants`, `mutation`, `notes-de-version-sens`, `notes-de-version`, `onglets-markdown`, `ordre-des-menus`, `pages-db`, `pages-protegees`, `personnages-armure-elementaire`, `personnages-liste`, `personnages-livre-de-sort`, `portrait`, `r160-potentiel-illimite-sans-gemme`, `race-kinds`, `races-html`, `recherche-mots-cles`, `recherche-script`, `scripts-controler-les-migrations`, `serveur-acces-routes`, `serveur-attestation`, `serveur-classeur`, `serveur-edition-ancres-figees`, `serveur-edition-annonces`, `serveur-edition-chronologie`, `serveur-edition-colonnes-figees`, `serveur-edition-don-variable-fiches`, `serveur-edition-don-variable`, `serveur-edition-liens-rompus`, `serveur-edition-mots-cles-cles`, `serveur-edition-mots-cles-fusion`, `serveur-edition-mots-cles-icone`, `serveur-edition-mots-cles-references`, `serveur-edition-nature-des-traces`, `serveur-edition-numeros`, `serveur-edition-pages-regles`, `serveur-edition-r160`, `serveur-edition-rejeu-capacites`, `serveur-edition-rejeu-fantomes`, `serveur-edition-rejeu-fusions`, `serveur-edition-rejeu-ids`, `serveur-edition-suppression-forcee`, `serveur-edition-verrou`, `serveur-essai-dans-l-ombre`, `serveur-essai-de-structure`, `serveur-extrait`, `serveur-fiches-retraits`, `serveur-livraison`, `serveur-maintenance`, `serveur-metriques-bornes`, `serveur-metriques-disque`, `serveur-metriques-http`, `serveur-metriques-sauvegardes`, `serveur-metriques`, `serveur-mise-a-jour-etats`, `serveur-mise-a-jour-production`, `serveur-notes-de-version`, `serveur-specialisations-magie`, `serveur-structure-sur-place-reconstruction`, `serveur-structure-sur-place`, `serveur-tipeee`, `sheets-api-to-json`, `site-html`, `sort-bonus-contexte`, `tableaux`, `tests-cibles`, `texte-en-place-barres`, `texte-en-place-mots-cles`, `wikilinks`, `xlsx-to-json`

#### Ne lisent pas le contenu (55)

`acces-navigateur`, `accessoires-script`, `aide-faux-dom`, `armes-script`, `armure-forge`, `armures-tri`, `batons-script`, `bestiaire-filtres`, `capacites`, `chronologie-filtre`, `class-groups`, `classe-magique`, `debug-balise`, `debug-metriques-sauvegardes`, `debug-page`, `decisions-index`, `defilement`, `deploy-sauvegardes`, `deploy-vps`, `dossiers-temporaires`, `durcissement`, `edition-tous-ecrans`, `fiche-controles`, `fiche-modele`, `fiche-retraits-texte`, `fiche-tiroir-clavier`, `flux-git`, `gabarits-sources`, `galerie`, `google-sheets`, `journal-du-service`, `liste-choix-script`, `liste-choix`, `metiers-tri`, `mise-a-jour-conflits`, `mise-a-jour-lots`, `mise-a-jour-script`, `monnaies-html`, `onglets-script`, `pieces-elementaires-script`, `pose-unique`, `search`, `serveur-acces`, `serveur-edition-corps-refus`, `skills-ecarts`, `sort-maitrise`, `sources-tipeee`, `tableur-ecriture`, `tableur-lecture`, `tableur-mesure`, `tipeee-script`, `tipeee`, `update-site`, `xml-mini`, `zip`

### Les familles de cause des 212

#### valeur-attendue (70)

`accessoire-champs`, `alchimie-couleurs`, `arme-champs`, `armes-elementaires-rendu`, `baliser-mot-cle`, `capacites-content`, `ceinture-db`, `codex`, `corps-armures`, `corps-classes`, `corps-metiers`, `corps-potions`, `corps-races`, `db-0100-ancres-figees-des-intertitres`, `db-0117-magies-v10-specialisations`, `db-0118-specialisation-de-la-fiche`, `db-0119-classes-materiaux-d12`, `db-0121-maj-decembre-suites`, `db-0122-retrait-la-montee-de-niveau`, `db-0124-retrait-accessoires-et-ceinture`, `db-0126-onglets-de-l-alignement`, `db-appliquer-edition`, `db-armes-elementaires`, `db-pages-du-site`, `db-r174-resistances-physiques`, `db-r181-dons-variables`, `db-r198-r208-textes-du-guide`, `db-r207-armures-et-fabrication`, `db-r231-attaquer-et-se-defendre`, `db-retrait-alterations-d-etats-et-mode-hyper`, `degats-texte`, `donnees`, `edition-liens-des-valeurs`, `edition-rendu`, `equipement-craft-notes`, `equipement`, `etat-ancre`, `glossaire-filtre`, `guide`, `magies-page`, `magies-specialisations`, `maitrise-arme-sources`, `maitrise-arme`, `maitrise-sorts`, `markdown-edition`, `markdown-sur`, `metier-champs`, `mots-cles-balises`, `mots-cles-cles`, `races-magies-innees-liste`, `resistance-texte`, `serveur-api-v1`, `serveur-base-vivante-empreinte-logique`, `serveur-debug-tables`, `serveur-edition-bestiaire`, `serveur-edition-classes`, `serveur-edition-conflits-maitrises`, `serveur-edition-conflits`, `serveur-edition-derivations`, `serveur-edition-guide`, `serveur-edition-lots-annulation`, `serveur-edition-lots`, `serveur-edition-maitrises`, `serveur-edition-plan`, `serveur-edition-rejeu-gel`, `serveur-edition-rejeu-liens`, `serveur-edition-rejeu-metiers`, `serveur-edition`, `sort-etats`, `valeurs-fermees-rendu`

#### nom-ou-texte-compare (57)

`accessoires-db`, `armes-elementaires-db`, `bestiaire-db`, `bestiaire-echelles`, `bestiaire-extraction`, `boucliers-poids`, `caracteristiques-postures`, `classe-champs`, `classes-dons`, `classes-notes`, `classes-sans-suffixe`, `corps-magies`, `db-0113-mots-cles-id-entier`, `db-0114-categories-assignees`, `db-0123-fusion-pages-alignement`, `db-lexique-en-mots-cles`, `db-liens-en-mots-cles`, `db-r182-critique-du-sort-prepare`, `db-r184-plan-des-regles`, `db-r203-r204-r205`, `db-r209-bestiaire`, `db-remarque`, `db-retrait-pages-doublons-des-combats`, `eaunoire`, `fiche-format-retirees`, `guide-mode-hyper`, `liens-familiers-prototype`, `livres`, `lots-rendu-service`, `magie-fleches`, `metiers`, `mise-a-jour-regles`, `monnaies`, `nav`, `panneaux-regles`, `plan-des-regles-db`, `potentiel-illimite`, `potion-etats`, `race-relations`, `races-detail-content`, `races-magies-content`, `races-onglet`, `resistance-combinaison`, `ressources-registre`, `serveur-api`, `serveur-armure-elementaire`, `serveur-base-vivante`, `serveur-dons-obtenus`, `serveur-edition-journal`, `serveur-edition-panneaux`, `serveur-edition-races`, `serveur-edition-regles-du-don`, `serveur-edition-rejeu-resistances`, `sort-analyse`, `sort-cout-secondaire`, `sorts-fer`, `suppressions-d11`

#### fiche-moteur (41)

`fiche-accessoires`, `fiche-acquis`, `fiche-actions-passifs`, `fiche-arme-choisie`, `fiche-armes-elementaires`, `fiche-armure-cassee`, `fiche-armure-elementaire`, `fiche-armure`, `fiche-bouclier-defense`, `fiche-ceinture-inventaire`, `fiche-critique-sort-prepare`, `fiche-critique`, `fiche-degats-recus`, `fiche-dons-variables`, `fiche-durabilite`, `fiche-familles-creees`, `fiche-flagelleur`, `fiche-grenades-et-sort-prepare`, `fiche-invocations`, `fiche-liens-glossaire`, `fiche-listes-infobulles`, `fiche-maitrises`, `fiche-maj-decembre-suites`, `fiche-mode-hyper-r187`, `fiche-mode-hyper`, `fiche-moteur`, `fiche-postures-sorts`, `fiche-refonte`, `fiche-regles`, `fiche-resistances-armure-elementaire`, `fiche-resistances-physiques`, `fiche-sante-potentiel`, `fiche-sorts-fer`, `fiche-tableur-aller-retour`, `fiche-tableur-export`, `fiche-tableur-import`, `fiche-tableur-noms-d-avant`, `fiche-tableur-noms-renommes-par-migration`, `fiche-tableur-page`, `r188-r189-npm-et-grimoire`, `r236-fiche-specialisations`

#### regle-lue-dans-un-texte (13)

`aide-base-d-import`, `armes-materiau-par-defaut`, `db-0111-relecture-des-regles`, `db-0120-races-fongoide-gemidien`, `db-arme-famille-nom-lecture`, `fiche-armes-tri`, `magies-notes`, `mots-cles-des-valeurs`, `mots-cles-r195`, `palette-css`, `r188-npm-potentiel-illimite-base`, `serveur-edition-fusion`, `sources-copies`

#### ligne-absente (12)

`chronologie`, `creature-npm`, `db-r180-reussite-critique`, `db-retrait-liste-des-effets-mode-hyper`, `orthographe-base`, `orthographe-magies`, `orthographe-noms`, `personnages-db`, `serveur-edition-consommables`, `serveur-edition-mots-cles-liens`, `sources-rapprochement`, `tables-de-la-base`

#### autre (11)

`armure-elementaire-donnees`, `armures-e6`, `boxeur-bouclier`, `db-appliquer-edition-familles`, `epreuve-lots-0122-0124`, `limite-texte`, `mots-cles-liens`, `serveur-edition-corps`, `serveur-edition-lots-mot-cle`, `serveur-edition-rapatriement`, `serveur-poids-portable`

#### corps-markdown (8)

`corps-armes`, `corps-composants`, `serveur-edition-armes`, `serveur-edition-armures`, `serveur-edition-composants`, `serveur-edition-fiches`, `serveur-edition-magies`, `serveur-edition-rejeu-corps`

### Les 173 fichiers qui passent et lisent le dépôt en direct, et ce qu'ils lisent

Lecture statique (importations transitives de client/test et client/src, sans `lib/donnees.mjs` ni `lib/contenu-fourni.mjs` qui obéissent à la variable) : chaque motif est un endroit du dépôt ou un outil qui lit le contenu sans passer par la variable. `data/rows` et `rows` : le dossier des lignes ; `maverick.py`, `tools/db`, `db-build`, `python` : la reconstruction de la base par les outils ; `data/migrations` : les migrations et leurs registres ; `MAVERICK_ROOT` : la racine du dépôt ; `content/wiki` : le dossier de pages fabriqué depuis `data/rows`. Un motif ne prouve pas qu'une lecture a lieu, seulement qu'elle est possible par ce chemin.

| Motif lu | Fichiers |
| --- | ---: |
| `data/migrations` | 155 |
| `data/rows` | 145 |
| `tools/db` | 138 |
| `maverick.py` | 135 |
| `content/wiki` | 91 |
| `db-build` | 52 |
| `python3?['"`]` | 25 |
| `['"`]rows['"`]` | 24 |
| `MAVERICK_ROOT` | 2 |

Par fichier (motifs lus) :

- `accessoires-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `accueil-html` : data/migrations
- `adresses-db` : data/migrations, content/wiki, data/rows, tools/db, maverick.py
- `ancres-figees` : content/wiki, data/migrations, tools/db, maverick.py
- `annexes-magie-notes` : content/wiki, python3?['"`], data/migrations, tools/db, maverick.py, data/rows
- `api-doc` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `archives` : data/migrations
- `arme-forge` : data/migrations, data/rows, tools/db, maverick.py
- `armes-de-famille` : tools/db, maverick.py, data/migrations, data/rows
- `armes-edition` : data/rows, tools/db, maverick.py, data/migrations
- `armes-effets-a-part` : data/migrations, data/rows, tools/db, maverick.py
- `armes-filtres` : tools/db, maverick.py, data/migrations
- `armes-html` : data/rows, ['"`]rows['"`], db-build, data/migrations, tools/db, maverick.py, content/wiki
- `armes-menus` : data/migrations, data/rows, tools/db, maverick.py
- `armure-champs` : tools/db, maverick.py, data/migrations
- `armures-html` : data/rows, ['"`]rows['"`], db-build, content/wiki, data/migrations, tools/db, maverick.py
- `autolink` : content/wiki, tools/db
- `bestiaire-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `bestiaire-pages-html` : tools/db, maverick.py, data/migrations, data/rows
- `ceinture-html` : data/migrations, tools/db, maverick.py, data/rows
- `chronologie-editeur` : data/migrations, tools/db, maverick.py, data/rows
- `chronologie-html` : data/migrations, data/rows, tools/db, maverick.py
- `chronologie-rendu` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `citations-db` : data/migrations, tools/db, maverick.py, data/rows
- `classe-dons-rendu` : tools/db, maverick.py, data/migrations, data/rows
- `classes-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `comparaison-de-sites` : data/rows
- `composants-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `composants-onglets` : data/rows, tools/db, maverick.py, data/migrations
- `conflits-rendu` : data/rows, tools/db, maverick.py, data/migrations
- `conflits-suit-le-don` : data/rows
- `contenu-fourni` : data/rows, ['"`]rows['"`], MAVERICK_ROOT, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `controles-du-contenu` : db-build, data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `corrections` : python3?['"`]
- `db-0099-solidite-et-tableau-du-sort` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-0115-mots-cles-synonymes` : tools/db, maverick.py, python3?['"`], data/migrations, data/rows
- `db-0116-icone-des-mots-cles` : data/migrations, data/rows
- `db-0125-types-de-degats-et-magies` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-0127-nature-des-traces` : data/migrations
- `db-0128-lots-de-changements` : data/rows, data/migrations
- `db-0129-migrations-recues` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `db-appliquer-edition-traces-0113` : ['"`]rows['"`], db-build, python3?['"`], data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `db-derive-recherche` : data/rows, db-build
- `db-donnees` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations
- `db-extrait` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `db-index-retires` : tools/db, maverick.py, data/migrations
- `db-journal-resolution` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `db-r172-mode-hyper-activable` : data/rows, data/migrations
- `db-r172-sort-prepare-en-mode-hyper` : data/rows, data/migrations
- `db-r173-compteurs-d-actions` : data/rows, data/migrations
- `db-rang-des-races` : data/migrations, data/rows
- `db-schema` : data/rows, tools/db, python3?['"`]
- `debug-metriques` : data/rows, tools/db, maverick.py, data/migrations
- `debug-schema` : data/rows
- `debug-structure` : tools/db, maverick.py, data/migrations
- `deploy-acces` : content/wiki, data/rows, data/migrations
- `deploy-sauvegardes-installer` : content/wiki, data/rows, data/migrations
- `deploy-volume` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `diff-replie` : data/rows
- `dons-edition` : data/rows, tools/db, maverick.py, data/migrations
- `dons-variable-formulaire` : data/rows, tools/db, maverick.py, data/migrations
- `edition-annonces` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `edition-composants-ajout` : data/migrations, data/rows, tools/db, maverick.py, content/wiki
- `edition-mots-cles` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `edition-panneaux` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `edition-races-liens-magies` : data/migrations, tools/db, maverick.py, data/rows, content/wiki
- `edition-saisies` : data/migrations, tools/db, maverick.py, data/rows
- `equipement-html` : data/rows, tools/db, maverick.py, data/migrations
- `fabrication-depuis-contenu` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, MAVERICK_ROOT
- `fiche-html` : data/migrations, data/rows, tools/db, maverick.py, content/wiki
- `flux-git-etat` : data/rows, data/migrations
- `fusion-trois-voies` : data/rows, tools/db, maverick.py, data/migrations
- `glossaire-balisage` : tools/db, maverick.py, data/migrations
- `glossaire-html` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `glossaire-tableau` : data/migrations, tools/db, maverick.py, data/rows
- `guide-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `guide-sans-chapitres` : tools/db, maverick.py, data/migrations, data/rows, content/wiki
- `historique-site` : data/rows
- `icones-degats-et-magies` : tools/db, maverick.py, data/migrations
- `importeurs-etiquettes` : tools/db, python3?['"`]
- `infobulles` : tools/db, maverick.py, data/migrations
- `installateur-essai-de-structure` : data/migrations, content/wiki, data/rows
- `installateur` : content/wiki, data/rows, data/migrations
- `instructions-claude` : db-build
- `invocations-notes` : content/wiki, python3?['"`], data/migrations, data/rows, tools/db, maverick.py
- `lamia-corruption` : data/migrations, tools/db, content/wiki, data/rows, maverick.py
- `libelles-de-la-base` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements-annulation` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements-numeros` : data/rows, tools/db, maverick.py, data/migrations
- `lot-de-changements` : data/rows, tools/db, maverick.py, data/migrations
- `lots-rendu` : data/rows
- `magie-non-compatible` : data/migrations, tools/db, maverick.py
- `magies-html` : tools/db, maverick.py, data/migrations, data/rows, content/wiki
- `markdown-rendu` : content/wiki, data/migrations, tools/db, maverick.py
- `mentions-des-mots-cles` : tools/db, maverick.py, data/migrations, data/rows
- `metiers-html` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `migrer-normaliseur` : tools/db, maverick.py, python3?['"`]
- `mise-a-jour-etat-production` : data/rows
- `mise-a-jour-github` : data/rows, ['"`]rows['"`], db-build, tools/db, python3?['"`], data/migrations, maverick.py, content/wiki
- `mise-a-jour-simulation` : data/rows, db-build, ['"`]rows['"`], python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `mise-a-jour` : content/wiki, data/rows, data/migrations
- `mots-cles-liens-rendu` : tools/db, maverick.py, data/migrations, data/rows
- `mots-cles-python` : tools/db, maverick.py, python3?['"`], data/migrations
- `mots-cles-r223` : content/wiki, data/migrations, tools/db, maverick.py, data/rows
- `mots-cles-vivants-liens` : data/migrations, tools/db, maverick.py
- `mots-cles-vivants` : data/migrations, tools/db, maverick.py
- `mutation` : data/migrations, data/rows, tools/db, maverick.py, db-build
- `notes-de-version-sens` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `notes-de-version` : tools/db, maverick.py, data/migrations, data/rows, db-build
- `onglets-markdown` : content/wiki, data/migrations, tools/db, maverick.py, db-build, data/rows
- `ordre-des-menus` : data/rows, tools/db, maverick.py, data/migrations, content/wiki
- `pages-db` : content/wiki, data/rows, tools/db, maverick.py, python3?['"`], data/migrations
- `pages-protegees` : data/migrations, data/rows, tools/db, maverick.py
- `personnages-armure-elementaire` : data/rows, data/migrations
- `personnages-liste` : data/rows
- `personnages-livre-de-sort` : data/rows, data/migrations
- `portrait` : tools/db, maverick.py, data/migrations, data/rows
- `r160-potentiel-illimite-sans-gemme` : data/rows, data/migrations
- `race-kinds` : data/rows
- `races-html` : tools/db, content/wiki, data/rows, maverick.py, data/migrations
- `recherche-mots-cles` : tools/db, maverick.py, data/migrations, data/rows
- `recherche-script` : tools/db, maverick.py, data/migrations
- `scripts-controler-les-migrations` : data/rows, data/migrations, db-build, tools/db, maverick.py, ['"`]rows['"`]
- `serveur-acces-routes` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-attestation` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-classeur` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-edition-ancres-figees` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-annonces` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-chronologie` : data/rows, ['"`]rows['"`], db-build, python3?['"`], tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-colonnes-figees` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-don-variable-fiches` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-don-variable` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-liens-rompus` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-edition-mots-cles-cles` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-mots-cles-fusion` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-mots-cles-icone` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-mots-cles-references` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-edition-nature-des-traces` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-numeros` : data/rows, data/migrations, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-pages-regles` : data/rows, ['"`]rows['"`], db-build, tools/db, python3?['"`], data/migrations, content/wiki, maverick.py
- `serveur-edition-r160` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-edition-rejeu-capacites` : data/rows, data/migrations, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-rejeu-fantomes` : data/rows, ['"`]rows['"`], db-build, tools/db, maverick.py, data/migrations, content/wiki, python3?['"`]
- `serveur-edition-rejeu-fusions` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-rejeu-ids` : data/migrations, data/rows, tools/db, maverick.py, content/wiki, db-build
- `serveur-edition-suppression-forcee` : data/rows, ['"`]rows['"`], db-build, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-edition-verrou` : data/migrations, data/rows, tools/db, maverick.py, content/wiki, db-build
- `serveur-essai-dans-l-ombre` : tools/db, maverick.py, data/migrations, data/rows, db-build, content/wiki
- `serveur-essai-de-structure` : tools/db, maverick.py, data/migrations, data/rows, db-build, content/wiki
- `serveur-extrait` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-fiches-retraits` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-livraison` : data/migrations, tools/db, maverick.py
- `serveur-maintenance` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-metriques-bornes` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-metriques-disque` : tools/db, maverick.py, data/migrations, data/rows, content/wiki, db-build
- `serveur-metriques-http` : data/rows, tools/db, maverick.py, data/migrations, content/wiki, db-build
- `serveur-metriques-sauvegardes` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-metriques` : data/rows, tools/db, maverick.py, data/migrations
- `serveur-mise-a-jour-etats` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-mise-a-jour-production` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-notes-de-version` : data/rows, ['"`]rows['"`], db-build, python3?['"`], data/migrations, tools/db, maverick.py, content/wiki
- `serveur-specialisations-magie` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `serveur-structure-sur-place-reconstruction` : data/rows, db-build, tools/db, maverick.py, data/migrations, content/wiki
- `serveur-structure-sur-place` : maverick.py, data/migrations, data/rows, db-build, tools/db, content/wiki
- `serveur-tipeee` : data/migrations, tools/db, maverick.py, data/rows, content/wiki, db-build
- `sheets-api-to-json` : python3?['"`]
- `site-html` : data/rows, data/migrations, tools/db, maverick.py, ['"`]rows['"`], db-build, content/wiki
- `sort-bonus-contexte` : data/rows, data/migrations, tools/db, maverick.py, content/wiki
- `tests-cibles` : content/wiki, data/rows, ['"`]rows['"`], db-build, data/migrations
- `texte-en-place-barres` : data/migrations, tools/db, maverick.py
- `texte-en-place-mots-cles` : data/migrations, tools/db, maverick.py
- `wikilinks` : content/wiki, data/migrations
- `xlsx-to-json` : python3?['"`]

S'y ajoutent 0 fichiers rangés « ne lit pas le contenu » qui lisent le dépôt en direct sans toucher à `lib/donnees` : .

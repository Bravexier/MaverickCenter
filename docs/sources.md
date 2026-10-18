# Sources de Maverick JDR

Les règles et le lore vivent hors du dépôt : un serveur Discord et des Google Docs/Sheets.
Le manifeste machine-lisible est [`sources/sources.json`](../sources/sources.json) ; ce document explique comment s'en servir.

## Discord — « L'univers de Maverick »

- Serveur : ID `374464159254839298`, invitation <https://discord.gg/GMGBnjzfMk>
- Les salons du groupe contiennent, pour la plupart, des liens vers les Google Docs ci-dessous.

| Salon | Catégorie du wiki (`client/src/content/wiki/…`) |
| --- | --- |
| `codex-maverick` | — (salon d'entrée) |
| `lien-pour-races` | `races` |
| `lien-pour-guide` | `guide` |
| `lien-pour-magies` | `magies` |
| `lien-pour-classes` | `classes` |
| `lien-pour-bestiaire` | `bestiaire` |
| `lien-pour-ressources-craft` | `ressources` |
| `lien-pour-métier` | `metiers` |
| `lore-bestiaire-codex` | `lore` |
| `cartes` | `cartes` |

### Récupérer le contenu Discord

Une session Claude Code cloud n'a **pas** accès à Discord (hôtes bloqués par la politique réseau de l'environnement)
et aucun connecteur Discord n'était disponible dans le registre au moment de la mise en place. Options :

1. **Export local** avec [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter) : exporter chaque salon
   en JSON dans `sources/discord/<salon>.json`, puis committer. Aucune clé à partager avec un outil tiers.
2. **Bot dédié** : créer un bot (portail développeur Discord), l'inviter en lecture seule sur le serveur
   (permissions *View Channel* + *Read Message History*, intent *Message Content*) et lui faire exporter les salons.

> Ne pas utiliser le jeton d'un compte personnel (« self-bot ») : c'est contraire aux conditions d'utilisation de Discord
> et ce jeton donne accès à tout le compte.

## Tipeee — « Maverick JDR »

- Page : <https://fr.tipeee.com/maverickjdr> (donnée par le propriétaire avec son plan du 2026-10-16), écrite par le créateur du jeu.
- Lue le **2026-10-18** par l'API publique `https://api.tipeee.com/v2.0/projects/maverickjdr` (la page est rendue en JavaScript) ; aucun instantané
  gardé dans `sources/` (la page change : contreparties, montants).
- Ce qu'en tire le site : la présentation du lien Tipeee de la page Liens (`client/src/lib/livres.mjs#LIENS`) — un « chapeau virtuel » pour soutenir
  le projet, ce qu'on y découvre (informations inédites, aperçus exclusifs, petites fiches de conseils pour les MJ en herbe), le soutien à plusieurs
  paliers et le nom inscrit sur le mur des donateurs du Discord et dans les futurs livres. Ni le pseudonyme du créateur ni les montants des paliers ne
  sont repris. **Texte à faire valider par le propriétaire** (`docs/sql/a-valider.md` §6).

## Google Docs / Sheets

12 documents distincts (le doc `1vn5Tq11…` avait été cité deux fois), listés dans `sources/sources.json`
avec `"type": null` — **à classer** après lecture (renseigner `type` et `title`).

**Copies du propriétaire (2026-10-10).** L'ancien mainteneur des documents est parti : ils ont été copiés dans le Drive du propriétaire du projet
(dossier « Maverick JDR »), et le manifeste, les extracteurs `tools/sheets/*.py` et la base (migration `0014-sources-copies-drive`, registre `.json`)
citent désormais ces copies ; dans le manifeste, `original` garde l'URL d'origine. Une copie garde le titre et les identifiants d'onglets (`gid`)
de l'original : les libellés « Google Sheet « … », onglet « … » » restent justes. Les documents `1CwDq…` (« CODEX Maverick ») et `1vn5Tq11…`
(« Bestiaire 2.0 »), hors de portée du Drive du propriétaire lors de la migration, n'ont pas été copiés par elle ; le propriétaire les a copiés le 2026-10-11
(`1tH-T9k…` et `1WWCm…`, hors registre ; `original` garde l'adresse d'origine). Le CODEX fait les pages du Codex (export dans `sources/raw/`, voir
[`codex.md`](codex.md)) ; l'export texte du Bestiaire est dans `sources/raw/bestiaire-2-0.txt` (connecteur Google Drive d'une session cloud) et
`tools/bestiaire/extraire.mjs` en tire les monstres (voir [`bestiaire.md`](bestiaire.md)). Le site ne renvoie plus
aux classeurs « Familiers » et « Prototype » (demande du propriétaire, migration `0019-liens-familiers-prototype`) : leurs copies restent dans le Drive,
mais ni la base ni la page des archives ne les citent. Pour que l'export et les liens du site marchent pour tous, les copies doivent être
partagées comme les originaux (« tous les utilisateurs disposant du lien », lecture). La fiche auto corrigée (V1.2), qui lit ces copies : `docs/fiche-auto.md`.

**Les originaux font foi (décision R83 du propriétaire, 2026-10-15).** Les classeurs d'origine (ceux de l'ancien mainteneur) sont toujours tenus
à jour (Magie V8 et Les races modifiés le 2026-10-12, une grosse mise à jour annoncée pour la fin d'octobre) ; les copies du 2026-10-10 ne le sont pas, et
le compte Google connecté aux sessions cloud ne les voit pas. La vérification des tables et les mises à jour lisent donc les **originaux** ; les copies
restent une trace (registre de la migration 0014). Voir « Rapprochement d'un classeur » plus bas.

Export automatique, à lancer **depuis une machine qui a accès à Google** (documents partagés en
« Toute personne disposant du lien ») :

```bash
node tools/import-gdocs.mjs --dry-run      # liste les URLs d'export
node tools/import-gdocs.mjs                # télécharge dans sources/raw/ (.md pour les docs, .csv pour les sheets)
node tools/import-gdocs.mjs --only <id>    # un seul document
```

- Un Sheet à plusieurs onglets : ajouter chaque `gid` d'onglet dans `gids` (visible dans l'URL `…?gid=123`).
- Document privé : l'export échoue avec « document privé ou introuvable ». Passer le partage en lecture par lien,
  ou connecter les connecteurs *Google Drive / Docs / Sheets* dans claude.ai.
- Depuis une session cloud, autoriser `docs.google.com` dans *Network access* de l'environnement (c'est l'hôte refusé
  par le proxy lors du premier essai). Les exports Google pouvant rediriger vers un autre domaine
  (`*.googleusercontent.com`), l'ajouter si le téléchargement échoue encore ; ce point n'a pas pu être vérifié.

Les fichiers de `sources/raw/` et `sources/discord/` sont du matériau brut, **pas** du contenu publié :
le wiki ne lit que `client/src/content/wiki/`. Ne les committez que si le dépôt reste privé.

### Ancien wiki Fandom

`https://maverick-jdr.fandom.com/fr/wiki/Wiki_Maverick` : l'ancien wiki du jeu. **Il n'est pas à jour** (le jeu a évolué depuis) : source de dernier rang, jamais prioritaire sur les
classeurs, le guide ou une décision du propriétaire ; ce qu'il dit de différent se liste en écart, rien n'est tranché en silence ; ce qu'il est seul à dire se cite avec son URL et le
statut `draft`. Exception : `https://maverick-jdr.fandom.com/fr/wiki/Progression`, dont le propriétaire du projet indique que le **tableau de progression est encore à jour** et qu'il
fait foi pour les budgets de points (décision R3 de `docs/decisions-regles.md`). Il n'est pas encore importé : depuis une session cloud l'hôte
`maverick-jdr.fandom.com` est bloqué par la politique réseau de l'environnement (à ajouter aux domaines autorisés, comme pour Discord et Google). Le contenu importé irait dans
`sources/raw/` et ses règles dans la base (`data/rows`, tables `niveau_global` et `seuil_niveau`) avec cette URL en source ; tant qu'il n'est pas lu, les budgets suivent le guide et la fiche, signalés « à confirmer ».

### Google Sheets (classeurs de règles)

Les classeurs (magies, classes, ressources & craft, invocations, mode hyper, « Fiche auto », index des races) ne se
convertissent pas proprement en Markdown directement : cellules fusionnées, onglets cachés, formules, listes déroulantes.
Le chemin utilisé est en deux temps, rejouable :

1. **Classeur → JSON uniforme** : `python3 -I tools/sheets/xlsx_to_json.py <classeur.xlsx|.csv> <sortie.json>`
   (dépendance : `openpyxl` pour les `.xlsx`). Le JSON garde les valeurs en cache, les formules, les plages fusionnées
   et les validations de données ; seules les cellules non vides sont conservées. Le classeur est traité comme une
   donnée non fiable : rien n'y est jamais exécuté.
2. **JSON → pages Markdown** : un extracteur déterministe par famille de pages, `tools/sheets/<famille>.py`
   (bibliothèque standard uniquement), qui écrit `client/src/content/wiki/<catégorie>/<slug>.md` avec
   `status: draft` et une entrée `sources:` qui désigne l'onglet d'origine. Ces `.md` sont un dossier de travail (fabriqué depuis la base
   par `npm run db:export-pages`, ignoré par git) : après l'extracteur, `npm run db:sync-pages` recopie les pages modifiées dans `data/rows`, qui est ce qu'on commite.

Obtenir les données d'un classeur, par ordre de préférence :

1. **Connecteur Google Sheets** (session Claude, autorisation « Sheets » complète) : `get_spreadsheet` avec `includeGridData`,
   une plage `'<onglet>'!A1:ZZ<n>` par onglet voulu et le masque de champs `sheets.properties.title`, `sheets.merges`,
   `sheets.data.rowData.values.formattedValue`, `sheets.data.rowData.values.hyperlink` et **`sheets.data.rowData.values.note`** ; la
   réponse (souvent sauvegardée dans un fichier par l'outil) est convertie par
   `python3 -I tools/sheets/sheets_api_to_json.py <réponse.json> <sortie.json>`. Seules les valeurs affichées sont lues (pas de
   formules) ; c'est la voie des classeurs trop lourds pour l'export (« Les races », ≈ 34 Mo). Ne pas omettre `note` : les notes de
   cellule (le petit commentaire jaune d'une cellule) précisent parfois une règle (« Jet de vigueur pour esquiver l'altération
   d'état » sur les dons du Médusain) et, sans ce champ, elles disparaissent du dump sans aucun signal ; le contrôle de couverture
   des extracteurs compare les pages au dump et ne peut pas les retrouver. Elles sont écrites dans le dump (`note`) et rendues
   par l'extracteur qui sait où les placer (`tools/sheets/races.py` : tableau des ethnies) ou refusées s'il ne le sait pas.
2. **Export `.xlsx`** : *Fichier > Télécharger > Microsoft Excel*, ou `download_file_content` du connecteur Google Drive avec le type
   d'export xlsx ; Google plafonne l'export à 10 Mo. Conserve les formules, les listes déroulantes et les commentaires.
   `xlsx_to_json.py` lit aussi les commentaires de cellule, directement dans le XML du classeur (`tools/sheets/xlsx_comments.py`, bibliothèque
   standard) : les **notes** vont dans le champ `note` de la cellule (texte verbatim), les **fils de commentaires** de Google (menu
   « Commentaire », distincts de la note) dans le champ `threads` (`[{text, done?, replies?}]`, sans auteurs ni dates). openpyxl ne garde
   qu'un commentaire par cellule et perd ceux des cellules fusionnées : il n'est pas utilisé pour cela. Les extracteurs `classes.py`, `magies.py`,
   `annexes-magie.py`, `equipement.py`, `divers-craft.py` et `invocations.py` rendent notes et fils sur les pages (sous un titre « Note de la cellule … » ou
   « Commentaire résolu de la cellule … » ; une capacité de classe porte sa note en ligne, « Note de cellule : … ») et leur `--verifier` recompte chaque note depuis le dump : une note absente, dupliquée, tronquée ou
   déplacée fait échouer la vérification. Un dump produit sans les notes (ancien convertisseur) est refusé par `invocations.py` au lieu d'effacer
   les notes déjà écrites (`--accepter-notes-retirees` pour une suppression voulue). Le fil de 26 commentaires ancré en `Sommaire!A1` du classeur
   de magie n'est rattaché à aucune page (listé par `annexes-magie.py`). `corriger-dump.py` corrige le champ `note`, pas encore `threads`.

**Coquilles et fautes d'orthographe** : les classeurs en contiennent (« Chasseur prime » pour « Chasseur de primes ») et le propriétaire du
projet demande de les corriger. Une correction n'est jamais faite dans une page générée (la prochaine importation l'écraserait) mais dans le
registre versionné `tools/sheets/corrections.json` : une ligne par correction, adressée à une cellule (onglet, adresse A1, texte avant / après,
nature, raison). Entre l'étape 1 et l'étape 2, on applique le registre au dump :
`python3 -I tools/sheets/corriger-dump.py appliquer --ledger tools/sheets/corrections.json --dump <classes-v7.json> --out <classes-v7.corrige.json>`
(la section du registre est le nom du dump sans `.json`), puis on passe le dump corrigé aux extracteurs et à leurs `--verifier`. L'outil refuse
une correction périmée (la source a changé), redondante (la source est déjà corrigée : retirer la ligne), qui change un chiffre, un dé, un
signe ou plus qu'un mot : cela ne serait plus une faute mais une règle, donc une question pour le propriétaire.
`corriger-dump.py verifier-registre` contrôle le registre seul (testé par `client/test/corrections.test.mjs`).

Les JSON intermédiaires et les `.xlsx` ne font pas partie du dépôt : ils se régénèrent à partir des classeurs. Exception : l'**instantané** de chaque
classeur rapproché (`sources/raw/classeurs/`, plus bas), qui est la référence d'une mise à jour et doit donc être gardé.
Les extracteurs sont relançables, mais **ils écrasent les pages qu'ils génèrent** : retoucher une page à la main
puis relancer l'extracteur perd la retouche. Passer le statut en `verified` une fois la page relue, et ne plus
relancer l'extracteur sur ces pages.

### Rapprochement d'un classeur (dans les deux sens)

Demande du propriétaire (2026-10-15) : s'assurer que chaque classeur est intégré dans les tables **dans tous les sens**, puis appliquer à la demande les
mises à jour du classeur ; ses réponses sont la décision **R83** (`docs/decisions-regles.md`). Outils : `tools/sources/` ; test :
`client/test/sources-rapprochement.test.mjs`. L'outil vit jusqu'à la 1.0 : il lit la provenance des lignes (`source_ref`), que le propriétaire
retirera alors (`docs/feuille-de-route.md`, réponses du 2026-10-16) ; d'ici là, une référence incomplète n'est pas réparée.

1. **Instantané** du classeur original : `download_file_content` du connecteur Google Drive avec l'export
   `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (la réponse, trop grande pour la conversation, est enregistrée dans un fichier : son
   champ `content` est le `.xlsx` en base64), puis `python3 -I tools/sheets/xlsx_to_json.py <classeur.xlsx> <dump.json>` et
   `node --no-warnings tools/sources/instantane.mjs <dump.json> sources/raw/classeurs/<classeur>.json` (forme stable : une cellule par ligne, fusions et
   validations triées, un diff git montre exactement les cellules changées). Un classeur de plus de 10 Mo (« Les races ») passe par `get_spreadsheet` (voir
   plus haut). L'instantané est inscrit dans `sources/raw/classeurs/registre.json` (identifiant Drive, date de dernière modification lue dans le Drive,
   empreinte de l'export, état `rapproche` ou `en_cours`).
2. **Rapprochement** : `node --no-warnings tools/sources/rapprocher.mjs --classeur "<titre>" --dump sources/raw/classeurs/<classeur>.json
   --registre tools/sources/ignorer/<classeur>.json [--sortie <rapport.md>] [--json]` (base : `var/maverick.db`, depuis `npm run db:build`). La base est
   lue dans son **état d'import** (`lib/historique-site.mjs#lignesDImport`) : une ligne supprimée par le site de dev compte encore, une ligne qu'il a créée
   ne compte pas, une colonne qu'il a modifiée vaut sa valeur d'import (le site est la source de ce qu'il modifie : ce n'est pas un écart). Il vérifie :
   - **base → classeur** : chaque ligne typée lit, dans les cellules que cite son `source_ref`, chacun de ses textes et nombres, une fois défaites les
     corrections d'orthographe des migrations (tout `data/migrations/*.json` qui a une liste `corrections` ; celles de la ligne, et celles des lignes dont
     elle a été tirée : ligne visée par une clé étrangère, entité d'une note, page de l'entité) et appliqué `tools/sheets/corrections.json`. Une ligne qui
     cite aussi un autre classeur se lit dans les deux instantanés ; si l'autre source n'en a pas (un Google Doc), ce qui ne se lit pas est « à relire »
     (listé, pas compté). Une colonne typée qui a sa `*_brut` se contrôle par elle ; une énumération (`CHECK … IN (…)`) n'est pas comparée ;
   - **classeur → base** : chaque cellule non vide est citée par au moins une ligne ou rangée dans le registre (`regles`) ; et **chaque mot d'une cellule
     citée** se lit dans les valeurs des lignes qui la citent (libellés des lignes visées par leurs clés étrangères compris, jamais leurs identifiants ni
     leur provenance) : sinon le classeur dit quelque chose que la base n'a pas ;
   - **notes et fils de commentaires** : les mêmes dans le classeur et dans `note_cellule` (et `commentaire_orphelin`).
   Une colonne modifiée par le site de dev **et** dont la cellule a changé (ou une ligne supprimée par le site dont la cellule a changé) est un
   **conflit** : présenté avec les deux valeurs, jamais tranché sans le propriétaire (R83) ; sa réponse s'inscrit dans le registre (`conflits`).
   Le registre d'un classeur, `tools/sources/ignorer/<classeur>.json` (forme décrite en tête de `rapprocher.mjs` ; une section inconnue est une
   erreur), ne contient que des entrées **justifiées** (une `raison` chacune) : `regles` (cellules qu'aucune ligne ne cite : titres, statistiques d'usage,
   consignes de navigation ; `nom_d_onglet` pour une bannière qui écrit le nom de son onglet), `libelles` (intitulés de mise en page d'une cellule citée,
   bornés par un motif de la cellule : « Lvl » de « Lvl 5 »), `copies` (plage qui recopie une autre plage, de ce classeur ou d'un autre : vérifiée à
   chaque passage, un écart dès qu'elle diverge), `derivees` (colonnes que l'import calcule, avec le test qui les garantit), `voulus` (écart voulu hors
   des registres d'orthographe : décision R…, migration de données), `commentaires` (commentaires du classeur que l'import écarte), `conflits`. Une
   entrée qui ne couvre plus rien est un écart (à retirer). Jamais une cellule qui porte une règle, un chiffre de jeu ou du lore pour faire baisser le
   compte. Le test fait échouer la CI au moindre écart d'un classeur `rapproche`, avec le relevé complet.

   **Ce que « 0 écart » garantit, et ce qu'il ne garantit pas.** Le contrôle est **par ligne**, pas par colonne : un `source_ref` cite les cellules
   d'une ligne de la base, pas la case de chaque colonne. Un nombre de la ligne est accepté s'il se lit dans n'importe laquelle de ses cellules, un
   morceau de texte s'il y est contenu, un mot d'une cellule s'il est dans n'importe laquelle des colonnes de la ligne. « 0 écart » veut donc dire : tout
   le classeur est dans la base, et toute la base dans le classeur. Il ne voit pas une valeur changée en une autre que la ligne écrit déjà ailleurs (la
   barrière d'une classe passée de 1 à 5, quand la même classe écrit « Bouclier classe 1 à 5 »), des nombres permutés, ni un ajout fait de mots que la
   ligne contient déjà. Une formule se lit comme un texte (sans ses blancs), une liste de validation par ses choix écrits (sur une saisie vide), jamais
   par la plage qu'elle cite. Il ne voit pas non plus une donnée portée par la **mise en forme** d'une cellule, que l'instantané (texte, note, fil)
   ne garde pas : le poids d'un bouclier est la couleur de fond de sa case dans l'onglet « Bouclier » (décision R92, `bouclier.poids_id`, entrée
   `derivees` du registre) ; sa référence case par case est `data/migrations/0054-poids-des-boucliers.json`, et une mise à jour du classeur relit les
   couleurs avec le connecteur Google Sheets de la session (`includeGridData`, `effectiveFormat.backgroundColor`), jamais depuis l'instantané. **Pour
   une mise à jour, c'est le diff des instantanés qui fait foi** (étape 3), case par case.
3. **Mise à jour du classeur** (à la demande du propriétaire, jamais d'office) : un nouvel instantané (étape 1), puis
   `node --no-warnings tools/sources/rapprocher.mjs --classeur "<titre>" --dump <nouvel instantané> --avant sources/raw/classeurs/<classeur>.json
   [--sortie <changements.md>]` : chaque cellule changée (valeur, note, fil), avant et après, et les lignes de la base qui la citent, avec ce que le site
   de dev leur a fait (« modifiée par le site : conflit possible »). Cette liste est présentée au propriétaire ; une fois validée, une migration
   (`ingenieur-donnees`) applique les changements, l'instantané remplace l'ancien, le rapprochement (étape 2) repasse à 0 et le registre suit. Une règle
   nouvelle ou changée suit la règle d'or : citée, jamais déduite.

État (2026-10-15) : « Classe Maverick V7 » et « Invocation » rapprochés, 0 écart (V7 : 1 228 lignes typées, 3 964 cellules non vides, 43 notes,
270 cellules ignorées ; Invocation : 1 128 lignes, 1 207 cellules, le tableau des améliorations cadavériques déclaré comme copie de celui de
« Magie Maverick V8 »). Les cinq autres sont enregistrés `en_cours` (instantané gardé, écarts relevés dans `docs/sql/rapprochement-classeurs.md`).

## De la source au wiki

1. Importer/exporter les sources (ci-dessus).
2. Lire chaque document, renseigner `type` dans `sources/sources.json`.
3. Rédiger les pages du wiki ([guide de contenu](content-guide.md)) en citant la source dans `sources:`.
4. Remplir la base (`data/rows`, [`sql/remplissage.md`](sql/remplissage.md)) à partir des tableaux de règles (races, classes, magies…) : la fiche de
   personnage ([`character-generator.md`](character-generator.md)) les lit dans `/fiche/regles.json`, tiré de la base au build.
5. Supprimer les pages `status: example`.

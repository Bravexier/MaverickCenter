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

## Google Docs / Sheets

12 documents distincts (le doc `1vn5Tq11…` avait été cité deux fois), listés dans `sources/sources.json`
avec `"type": null` — **à classer** après lecture (renseigner `type` et `title`).

**Copies du propriétaire (2026-10-10).** L'ancien mainteneur des documents est parti : ils ont été copiés dans le Drive du propriétaire du projet
(dossier « Maverick JDR »), et le manifeste, les extracteurs `tools/sheets/*.py` et la base (migration `0014-sources-copies-drive`, registre `.json`)
citent désormais ces copies ; dans le manifeste, `original` garde l'URL d'origine. Une copie garde le titre et les identifiants d'onglets (`gid`)
de l'original : les libellés « Google Sheet « … », onglet « … » » restent justes. Le document `1vn5Tq11…` (« Bestiaire 2.0 ») est hors de portée du
Drive du propriétaire (ni partagé avec lui, ni trouvé par recherche) : il n'a pas été copié et reste sur l'original (`note`), qui s'ouvre avec son lien ;
son titre est celui de la page Google (relevé le 2026-10-11). « CODEX Maverick » (`1CwDq…`), laissé lui aussi sur l'original par la migration, a été copié
par le propriétaire le 2026-10-11 (`1tH-T9k…`, `original` garde l'adresse d'origine) : son export est dans `sources/raw/` et il fait les pages du Codex
(voir [`codex.md`](codex.md)). Le site ne renvoie plus
aux classeurs « Familiers » et « Prototype » (demande du propriétaire, migration `0019-liens-familiers-prototype`) : leurs copies restent dans le Drive,
mais ni la base ni la page des archives ne les citent. Pour que l'export et les liens du site marchent pour tous, les copies doivent être
partagées comme les originaux (« tous les utilisateurs disposant du lien », lecture). La fiche auto corrigée (V1.2), qui lit ces copies : `docs/fiche-auto.md`.

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

Les JSON intermédiaires et les `.xlsx` ne font pas partie du dépôt : ils se régénèrent à partir des classeurs.
Les extracteurs sont relançables, mais **ils écrasent les pages qu'ils génèrent** : retoucher une page à la main
puis relancer l'extracteur perd la retouche. Passer le statut en `verified` une fois la page relue, et ne plus
relancer l'extracteur sur ces pages.

## De la source au wiki

1. Importer/exporter les sources (ci-dessus).
2. Lire chaque document, renseigner `type` dans `sources/sources.json`.
3. Rédiger les pages du wiki ([guide de contenu](content-guide.md)) en citant la source dans `sources:`.
4. Remplir la base (`data/rows`, [`sql/remplissage.md`](sql/remplissage.md)) à partir des tableaux de règles (races, classes, magies…) : la fiche de
   personnage ([`character-generator.md`](character-generator.md)) les lit dans `/fiche/regles.json`, tiré de la base au build.
5. Supprimer les pages `status: example`.

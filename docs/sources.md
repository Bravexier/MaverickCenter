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
   `status: draft` et une entrée `sources:` qui désigne l'onglet d'origine.

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
   **Limite connue** : `xlsx_to_json.py` ne lit pas les commentaires et notes de cellule (openpyxl : `cell.comment`) ; plusieurs
   classeurs en portent (classes, magies, équipement, invocations) et leurs extracteurs ne les importent donc pas encore.

Les JSON intermédiaires et les `.xlsx` ne font pas partie du dépôt : ils se régénèrent à partir des classeurs.
Les extracteurs sont relançables, mais **ils écrasent les pages qu'ils génèrent** : retoucher une page à la main
puis relancer l'extracteur perd la retouche. Passer le statut en `verified` une fois la page relue, et ne plus
relancer l'extracteur sur ces pages.

## De la source au wiki

1. Importer/exporter les sources (ci-dessus).
2. Lire chaque document, renseigner `type` dans `sources/sources.json`.
3. Rédiger les pages du wiki ([guide de contenu](content-guide.md)) en citant la source dans `sources:`.
4. Remplir [`rules.json`](character-generator.md) à partir des tableaux de règles (races, classes, magies…).
5. Supprimer les pages `status: example`.

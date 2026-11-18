---
name: zone-mots-cles-balisage
description: "Baliser un mot dans tous les textes : outil baliser-mot-cle, entrées tools/glossaire/*.json (Chakra, Barrière, Corruption et CR, Sort fer), exclusions, rapport, migration 0079. À charger avant de lire, modifier ou relire cet outil, ses entrées ou leurs tests."
paths: ["client/scripts/baliser-mot-cle.mjs", "client/src/lib/glossaire-balisage.mjs", "tools/glossaire/**", "client/test/baliser-mot-cle.test.mjs", "client/test/glossaire-balisage.test.mjs", "client/test/sorts-fer.test.mjs", "data/migrations/0079-*"]
user-invocable: false
---
# Baliser un mot dans tous les textes

## Fichiers
- Outil : `client/scripts/baliser-mot-cle.mjs`, `lib/glossaire-balisage.mjs` ; entrées `tools/glossaire/chakra-barriere.json`, `tools/glossaire/corruption.json`, `tools/glossaire/sort-fer.json`.
- Les balises, leur forme canonique et le glossaire : skill `zone-mots-cles`.

## À lire
- `docs/content-guide.md`, « Baliser un mot dans tous les textes » (mots collés, textes non touchés) et « Seulement là où il est pertinent ».

## Choix du propriétaire
- Chakra et Barrière, puis seulement là où il est pertinent : Corruption et « CR » (R103, R140 : « CR » balisé partout où il s'écrit).
- « Sort fer » (R164, « Oui, tous ») : dans les huit textes qui parlent des sorts fer, jamais sur le nom d'un des 13 sorts. Une expression de deux mots se balise entière, guillemets compris (`{{sort-fer|sorts "fer"}}`, `{{sort-fer|sort “fer”}}`, `{{sort-fer|sorts de Fer Élémentaire}}`), comme `{{recharge-longue|recharge longue}}`.

## Invariants
- L'outil retrouve le mot-clé d'une entrée par la règle d'une balise (`motCleDeLaRef` : clé, libellé d'un seul mot-clé, synonyme), le crée sinon, et écrit sa clé dans les balises (`{{clé}}`, `{{clé|texte}}`).
- L'entrée « CR » de `corruption.json` vise `corruption` par `"libelle": "Corruption"` (`cr` y est fondu, R183 (3) ; « CR » en est un synonyme).
- `sort-fer.json` pose les cinq textes que le site de dev modifie ; les trois autres (« Immatériel » du Fantôme et du Golem d'arcane, page « Pièces élémentaires ») viennent de la migration 0079 (registre `corrections` de `0079-r164-sorts-fer.json`).
- L'outil n'écrit jamais `data/rows` (R274, R291) et refuse `--appliquer` (code 2). Il part d'une copie de l'extrait du jour du site de dev (`--base`, défaut `var/extrait/maverick-dev.db`, `npm run db:extrait` ; `--rows` pour les tests) et écrit un lot `maverick-lot/1` (`--lot`, `--nature` obligatoire, `--decision R…` si nature `decision`, `--titre` facultatif ; `lotDesChangements`, via `epreuve-des-lots.mjs#lotDeLaDifference`, contrôlé par `controlerLeLot`). Ce lot se propose au site de dev (`POST /api/edition/lots/`, skill `modifier-une-page-wiki`). `--journal` est facultatif.
- Le lot porte les insertions de mots-clés en tête (sinon l'essai à blanc refuse les textes qui citent la clé), jamais les colonnes dérivées (`serveur/edition.mjs#colonneDerivee`, refaites par le service). Une `remarque` qui recopie la note d'une cellule (`note_cellule`) n'est pas balisée (contrôle « la note … ne figure pas dans la remarque », `serveur/controles-du-contenu.mjs`). Nature `decision` avec son R… (R164 pour `sort-fer.json`), sinon `code`.
- Les balises déjà posées du mot, celles de la main comprises, sont retirées puis reposées (`sansLesBalisesDuMot`) ; le rapport liste chaque balise retirée ou nouvelle.
- Jamais balisé : un nom de la base, un contexte exclu de l'entrée (nom propre du Codex, autre sens du mot), un texte hors du balisage (`horsDe` : récit du Codex et de la chronologie, sauf `sauf`), un code, un lien, un titre de section, un intitulé en gras seul sur sa ligne.

## Tests
- `baliser-mot-cle.test.mjs`, `glossaire-balisage.test.mjs`, `sorts-fer.test.mjs`. « lot depuis un extrait du site de dev : accepté entier par l'essai à blanc… » (dans `baliser-mot-cle.test.mjs`) épingle le lot.

---
name: sources-rapprochement
description: "Rapprochement des classeurs originaux et de la base (R83) : instantanés sources/raw/classeurs/, tools/sources/ (rapprocher.mjs, instantane.mjs, registres ignorer/), mise à jour d'un classeur, tools/import-gdocs.mjs ; instantané Tipeee sources/tipeee/ (tools/sources/tipeee.mjs). À charger avant de lire, modifier ou relire ces outils, registres ou leur test."
paths: ["tools/sources/**", "sources/raw/classeurs/**", "client/test/sources-rapprochement.test.mjs", "tools/import-gdocs.mjs", "sources/sources.json", "docs/sql/rapprochement-classeurs.md", "sources/tipeee/**", "client/test/sources-tipeee.test.mjs"]
user-invocable: false
---
# Rapprochement des classeurs

## Fichiers
- `tools/sources/instantane.mjs` : l'instantané d'un classeur ORIGINAL, une cellule par ligne, dans `sources/raw/classeurs/<classeur>.json` ; registre
  `sources/raw/classeurs/registre.json` (identifiant Drive, date de modification, empreinte, état `rapproche` ou `en_cours`).
- `tools/sources/rapprocher.mjs` : compare l'instantané à la base dans les deux sens ; `--avant <ancien instantané>` pour une mise à jour. La forme du registre
  est décrite en tête du fichier.
- `tools/sources/ignorer/<classeur>.json` : registre justifié par classeur.
- `client/test/sources-rapprochement.test.mjs` : essais sur la base d'import (voir Tests).
- `tools/import-gdocs.mjs` : export des Google Docs/Sheets listés dans `sources/sources.json` (`--dry-run`, `--only <id>`), depuis une machine qui a accès à Google.
- `docs/sql/rapprochement-classeurs.md` : écarts relevés.
- `tools/sources/tipeee.mjs` : l'instantané de la partie « Bienvenue » de Tipeee, `sources/tipeee/bienvenue.json` (`{ url, lu_le, paragraphes }`), tiré
  par le module pur du site `client/src/lib/tipeee.mjs` ; `--verifier`, `--depuis <reponse.json>`. Test : `client/test/sources-tipeee.test.mjs`.

## À lire
- `docs/sources.md`, « Rapprochement d'un classeur (dans les deux sens) » : instantané, rapprochement, limites, mise à jour, état.
- `docs/sources.md`, « Google Docs / Sheets », « Google Sheets (classeurs de règles) » : `import-gdocs.mjs`, connecteurs, notes de cellule.
- `docs/decisions-regles.md`, R83.
- Défaire l'orthographe des migrations : skill `base-orthographe`. Base dans son état d'import : skill `base-sqlite` (`lib/historique-site.mjs`).

## Invariants
- Décision R83 : les classeurs originaux font foi (les copies de la migration 0014 restent une trace). Un écart est listé, jamais appliqué d'office : le
  propriétaire relit la liste et demande lui-même d'appliquer. Une valeur modifiée des deux côtés (site de dev et classeur) est un conflit, demandé au
  propriétaire à chaque fois, sa réponse inscrite dans `conflits`.
- Un écart voulu d'une colonne numérique s'écrit en texte (`voulus`, « 17 » -> « 16 ») : l'outil admet l'`apres` si la cellule écrit l'`avant`, pour cette colonne seulement (R207 : AP calculé).
- Tout `data/migrations/*.json` dont la clé `corrections` est entièrement en texte (`avant` et `apres` en chaînes) est défait comme de l'orthographe (`registresDOrthographe`) : voulu pour la 0103 (« Gel », R205). Une migration dont les valeurs ne sont pas des corrections d'un classeur les écrit sous `textes` ou `valeurs` (skill `base-sqlite`).
- La base est lue dans son état d'import (`lignesDImport`) : le site de dev est la source de ce qu'il modifie, ce n'est pas un écart.
  - Un écart « pour mémoire » (casse seule, ligne à relire dans une source sans instantané) n'est jamais un conflit, même sur une ligne supprimée ou une colonne modifiée par le site.
  - Une ligne supprimée par le site, sans cellule changée, n'est jamais un écart (listée dans `site.supprimees`) ; une cellule vraiment changée sur une telle ligne reste un conflit (R83).
  - Le libellé d'une ligne visée par une clé étrangère (« Évitée » pour `echelle_id`) se lit à l'import quand la colonne visée est sa clé primaire (`rapprocher.mjs`, `libellesDe`).
- Dans les deux sens : chaque ligne typée se lit dans ses cellules (orthographe des migrations défaite) ; chaque cellule non vide est citée ou ignorée avec sa
  raison, et chacun de ses mots se lit dans la base ; notes de cellule et fils de commentaires comparés à `note_cellule` (et `commentaire_orphelin`).
  Une valeur de la base à balises du glossaire se lit sans elles (R233, `texteSansBalises`) ; un texte changé derrière ses balises reste un écart.
- Le registre d'un classeur ne contient que des entrées justifiées (une `raison` chacune), dans les sections `regles`, `libelles`, `copies`, `derivees`,
  `voulus`, `commentaires`, `conflits`. Une section inconnue est une erreur.
- Le test exige 0 écart pour un classeur `rapproche`.
- Le contrôle est par ligne, pas par colonne : il ne voit pas une valeur changée en une autre que la ligne écrit déjà ailleurs, des nombres permutés, ni une
  donnée portée par la mise en forme (le poids d'un bouclier, R92, se relit par le connecteur Google Sheets, jamais depuis l'instantané). Pour une mise à jour,
  c'est le diff des instantanés qui fait foi, case par case. Limites : `docs/sources.md`.
- Une mise à jour du classeur se fait à la demande du propriétaire, jamais d'office : nouvel instantané, `rapprocher.mjs --avant` (chaque cellule changée et
  les lignes qu'elle touche), liste validée par le propriétaire, migration ; l'instantané remplace l'ancien et le rapprochement repasse à 0.
- L'instantané d'un classeur rapproché est gardé dans le dépôt (référence d'une mise à jour) ; les autres JSON intermédiaires et `.xlsx` ne le sont pas.
- L'outil vit jusqu'à la 1.0 : il lit la provenance (`source_ref`), retirée ensuite. Une référence incomplète n'est pas réparée.
- Une règle nouvelle ou changée suit la règle d'or : citée, jamais déduite.
- Tipeee (réponses du propriétaire du 2026-10-22 : « La partie « Bienvenue » », « En direct par le serveur » ; `docs/sources.md`, « Tipeee ») :
  l'outil et le service (`client/serveur/tipeee.mjs`, skill `zone-service-sorties`) tirent le texte par le MÊME module pur, jamais par un découpage à eux ;
  texte seul, copié sans correction ni réécriture. L'instantané n'est réécrit que si les paragraphes changent (sinon ni diff ni date bougée), et
  rien n'est écrit si la partie manque. Il est livré avec le site (`serveur/livraison.mjs#FICHIERS_JOINTS`) : forme stable et fins de ligne LF
  (`.gitattributes`), contrôlées par `--verifier` et le test.

## Tests
- `client/test/sources-rapprochement.test.mjs` : les essais qui changent une cellule ou une ligne partent de la base d'import (`baseDImport`, `cheminDImport` de `test/aide-base-d-import.mjs`) ; une ligne réécrite par le site transformerait l'écart attendu en conflit.
- `client/test/sources-tipeee.test.mjs` (l'outil Tipeee et l'instantané versionné ; l'extraction : `tipeee.test.mjs`).

---
name: sources-rapprochement
description: "Rapprochement des classeurs originaux et de la base (R83) : instantanés sources/raw/classeurs/, tools/sources/ (rapprocher.mjs, instantane.mjs, registres ignorer/), mise à jour d'un classeur, tools/import-gdocs.mjs. À charger avant de lire, modifier ou relire ces outils, registres ou leur test."
paths: ["tools/sources/**", "sources/raw/classeurs/**", "client/test/sources-rapprochement.test.mjs", "tools/import-gdocs.mjs", "sources/sources.json", "docs/sql/rapprochement-classeurs.md"]
user-invocable: false
---
# Rapprochement des classeurs

## Fichiers
- `tools/sources/instantane.mjs` : l'instantané d'un classeur ORIGINAL, une cellule par ligne, dans `sources/raw/classeurs/<classeur>.json` ; registre
  `sources/raw/classeurs/registre.json` (identifiant Drive, date de modification, empreinte, état `rapproche` ou `en_cours`).
- `tools/sources/rapprocher.mjs` : compare l'instantané à la base dans les deux sens ; `--avant <ancien instantané>` pour une mise à jour. La forme du registre
  est décrite en tête du fichier.
- `tools/sources/ignorer/<classeur>.json` : registre justifié par classeur.
- `client/test/sources-rapprochement.test.mjs`.
- `tools/import-gdocs.mjs` : export des Google Docs/Sheets listés dans `sources/sources.json` (`--dry-run`, `--only <id>`), depuis une machine qui a accès à Google.
- `docs/sql/rapprochement-classeurs.md` : écarts relevés.

## À lire
- `docs/sources.md`, « Rapprochement d'un classeur (dans les deux sens) » : instantané, rapprochement, limites, mise à jour, état.
- `docs/sources.md`, « Google Docs / Sheets », « Google Sheets (classeurs de règles) » : `import-gdocs.mjs`, connecteurs, notes de cellule.
- `docs/decisions-regles.md`, R83.
- Défaire l'orthographe des migrations : skill `base-orthographe`. Base dans son état d'import : skill `base-sqlite` (`lib/historique-site.mjs`).

## Invariants
- Décision R83 : les classeurs originaux font foi (les copies de la migration 0014 restent une trace). Un écart est listé, jamais appliqué d'office : le
  propriétaire relit la liste et demande lui-même d'appliquer. Une valeur modifiée des deux côtés (site de dev et classeur) est un conflit, demandé au
  propriétaire à chaque fois, sa réponse inscrite dans `conflits`.
- La base est lue dans son état d'import (`lignesDImport`) : le site de dev est la source de ce qu'il modifie, ce n'est pas un écart.
- Dans les deux sens : chaque ligne typée se lit dans ses cellules (orthographe des migrations défaite) ; chaque cellule non vide est citée ou ignorée avec sa
  raison, et chacun de ses mots se lit dans la base ; notes de cellule et fils de commentaires comparés à `note_cellule` (et `commentaire_orphelin`).
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

## Tests
- `client/test/sources-rapprochement.test.mjs`.

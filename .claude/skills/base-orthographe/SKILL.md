---
name: base-orthographe
description: "Orthographe corrigée dans la base par migrations de données (0003, 0005, 0006) et leurs registres .json : ce qui n'est jamais corrigé, clés X_cle recalculées, identifiant jamais changé. À charger avant de lire, modifier ou relire une correction d'orthographe, un nom ou leurs tests."
paths: ["data/migrations/0003-orthographe-magies.*", "data/migrations/0005-orthographe-base.*", "data/migrations/0006-orthographe-noms.*", "client/test/orthographe-*.test.mjs", "docs/sql/orthographe-a-valider.md", "tools/sheets/corrections.json", "tools/sheets/corriger-dump.py", "client/test/corrections.test.mjs"]
user-invocable: false
---
# Orthographe de la base

## Fichiers
- `data/migrations/0003-orthographe-magies.sql` + `.json` : sorts, magies et leurs tables dérivées (500 corrections).
- `data/migrations/0005-orthographe-base.sql` + `.json` : toute la base (pages, classes, capacités, races, bestiaire, équipement, guides, lore et tables
  typées ; 2 247 corrections relues deux fois, 56 noms à clé inchangée).
- `data/migrations/0006-orthographe-noms.sql` + `.json` : les noms (741 occurrences, 147 clés recalculées).
- `docs/sql/orthographe-a-valider.md` : les points en attente du propriétaire.

## À lire
- `docs/sql/orthographe-a-valider.md` (en tête : ce que chaque migration a fait, puis les phrases en attente).
- `docs/sql/conception.md`, « Fait (migration 0006) » : les sept tables qui ne dérivent plus l'id du nom.
- Corrections faites dans un dump de classeur avant extraction (`tools/sheets/corrections.json`, `corriger-dump.py`) : `docs/sources.md`, « Coquilles et
  fautes d'orthographe ».
- Écrire une nouvelle migration de données : skill `ecrire-une-migration`.

## Invariants
- L'orthographe se corrige dans la base, par une migration de données avec son registre `.json` et son test. Jamais dans une page fabriquée.
- Décision R10 : corriger, jamais un chiffre ni le sens d'une règle. Une correction qui demande d'ajouter, retirer ou remplacer un mot, ou de choisir entre deux
  lectures, est une question au propriétaire (`docs/sql/orthographe-a-valider.md`).
- Une phrase corrigée l'est partout où elle est écrite : page, résumé, tables typées, extraits, notes de cellule.
- Jamais corrigé : les citations « telles quelles » de la fiche V15.2.2 (tableaux des écarts des races), `source`, `ecart_source`, `alias`, `page_tag`,
  `commentaire_orphelin` (empreinte de son texte), une adresse ou un lien.
- L'écriture de la source gardée comme trace n'est pas corrigée : `gemmes_brut`, `nom_source`, `race_brut`.
- Un nom corrigé l'est partout (titres, noms typés, textes, cibles des `[[liens]]`) et sa clé `X_cle` est recalculée.
- Son identifiant ne change jamais. Depuis 0006, aucune table ne dérive plus l'id du nom : sort, classe, invocation, créature et leurs attaques et capacités
  gardent la clé du nom d'origine ; une page renommée garde son adresse.
- Le rapprochement des classeurs défait ces corrections avant de comparer (tout `data/migrations/*.json` qui a une liste `corrections` :
  skill `sources-rapprochement`). Un registre garde donc sa forme.

## Choix du propriétaire
- Noms (0006) : sens le plus probable ; pour un nom propre écrit de plusieurs façons, la graphie majoritaire l'emporte.

## Tests
- `client/test/orthographe-magies.test.mjs`, `orthographe-base.test.mjs`, `orthographe-noms.test.mjs`.
- `client/test/corrections.test.mjs` : `tools/sheets/corriger-dump.py` et son registre (une ligne par cellule ; refus de ce qui changerait un chiffre, un signe ou plus qu'un mot).
- Les tests qui citent un texte de la base (notes de cellule « texte intégral ») suivent ces corrections ; leurs entrées synthétiques (qui imitent le
  classeur) gardent le texte d'origine.

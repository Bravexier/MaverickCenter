---
name: interroger-la-base
description: "Lire la base SQLite de Maverick en lecture seule (construire var/maverick.db, requêtes node ou python, valeur d'import, schéma et vues) pour répondre à une question de règle, de lore ou de données. À charger avant toute requête SQL d'analyse."
user-invocable: false
---

# Interroger la base (lecture seule)

## Préparer

`var/maverick.db` (à la racine du dépôt, ignorée par git) est construite depuis `data/rows`. Le scratchpad est partagé entre agents, et `db:build` commence par effacer sa sortie : chaque agent qui construit une base le fait donc sous un nom à lui.

1. **Si elle est à jour**, on la lit telle quelle : elle existe, et `find data/rows -newer var/maverick.db` (depuis la racine) ne renvoie rien.
2. **Sinon**, on construit sa propre copie sous un nom unique, sans toucher à `var/maverick.db`. Depuis `client/` : `F=$(mktemp -p <scratchpad> base-XXXXXX.db) && node --no-warnings scripts/db-build.mjs --out "$F" && node --no-warnings scripts/db-derive.mjs "$F"`. On interroge ensuite `$F`.
3. **Si `node_modules` manque**, un analyste ne lance pas `npm ci`, que d'autres agents pourraient lancer en même temps. Il rend un rapport « bloqué », ou lit `data/rows` par `Grep`.

## Lire

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('var/maverick.db',{readOnly:true});console.table(db.prepare(process.argv[1]).all())" "SELECT id, nom FROM magie"
python3 -I -c "import sqlite3,sys;c=sqlite3.connect('file:var/maverick.db?mode=ro',uri=True);[print(r) for r in c.execute(sys.argv[1])]" "SELECT count(*) FROM sort"
```

- **Toujours en lecture seule** (`readOnly: true`, `?mode=ro`). On n'écrit jamais dans une base, ni dans `data/rows` : une donnée se change par l'équipe technique.
- **Où chercher.** La structure de chaque table et de chaque vue est dans `data/schema.sql` : son en-tête donne les conventions, et chaque table a un commentaire. Les mêmes informations sont lisibles dans `docs/sql/structure.md`. Les sections du schéma suivent les domaines : 2 fiche, 3 magies, 4 annexes, 5 dieux, 5 bis chronologie, 6 classes, 7 races, 8 et 8 bis bestiaire, 9 équipement.
- **Valeur d'origine.** Une valeur modifiée sur le site de dev diffère de l'import. La valeur d'import se lit dans `historique_modification`, ou par `client/src/lib/historique-site.mjs`.
- **Lectures sans base.** `data/rows/<table>.sql` (des `INSERT`) se lit aussi par `Grep` sans construire la base.
- **Ce que la base ne contient jamais.** Les tables des fiches de personnages (section 13) et du journal (section 14) sont vides dans `data/rows`. On ne lit jamais la base vivante d'un serveur. Les modifications faites sur le site de dev et pas encore rapatriées ne se voient donc pas : le rapport le dit quand cela peut changer la réponse.
- **Preuve dans le rapport.** Donner la requête et son résultat (ou les premières lignes et le compte).

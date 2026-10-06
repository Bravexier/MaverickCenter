# Générateur de fiche de personnage

Page : `client/src/pages/generateur.astro` · moteur : `client/src/lib/character.mjs` · règles : `client/src/data/rules.json`.

Le moteur ne contient **aucune règle de Maverick** : tout vient de `rules.json`. Les données actuelles sont des
exemples (`meta.status: "example"` → bandeau d'avertissement sur la page). Remplacer ce fichier par les vraies règles
suffit à changer le comportement du générateur.

## Schéma de `rules.json`

| Clé | Contenu |
| --- | --- |
| `meta` | `status` (`example` affiche le bandeau), `version` (inscrite dans les fiches exportées), `note` |
| `attributes[]` | `{ id, label }` — les caractéristiques |
| `creation` | `base` (valeur de départ), `pool` (points à répartir), `max` (valeur maximale **avant** bonus) |
| `limits` | `classes` et `magies` : nombre maximal de choix (1 = bouton radio de fait) |
| `races[]` | `{ id, name, wiki?, modifiers?, traits? }` |
| `classes[]` | idem + `allowedRaces?` (ids de races ; absent = toutes) |
| `magies[]` | `{ id, name, wiki?, allowedClasses? }` (au moins une des classes listées doit être choisie ; absent = libre) |
| `derived[]` | `{ id, label, base?, add? }` → valeur = `base + Σ(caractéristique finale × coefficient)` |

- `modifiers` : `{ "idCaracteristique": bonus }`, cumulés entre la race et les classes.
- `wiki` : id d'une page (`"races/elfe"`) — le nom devient un lien dans la fiche.
- `traits` : textes listés sur la fiche pour la race et les classes choisies.

Caractéristique finale = `creation.base` + points dépensés + bonus de race/classes.

## Brancher les vraies règles

1. Lire les documents sources ([sources.md](sources.md)) et créer les pages du wiki correspondantes.
2. Éditer `rules.json` : attributs, coût/réserve de création, races, classes, magies, valeurs dérivées.
3. Mettre `meta.status` à `"verified"` et changer `meta.version`.
4. `cd client && npm test` : `rules.test.mjs` vérifie les ids uniques, les références de modificateurs/restrictions
   et que chaque `wiki` pointe vers une page existante.
5. Supprimer les pages et entrées `example`.

## Ce que le moteur ne gère pas (encore)

Compétences, équipement, jets de dés, niveaux/expérience, coûts de points non linéaires, bonus conditionnels,
formules arbitraires. Si les règles de Maverick en ont besoin, étendre `character.mjs` **avec des tests**
(`client/test/character.test.mjs`) plutôt que d'évaluer des formules libres venant des données.

## Fiches exportées

« Exporter » produit `{ format: "maverick-character", version: 1, rules: <meta.version>, character: {…} }`.
À l'import (et au chargement du `localStorage`), la fiche est nettoyée par `sanitize` : ids inconnus retirés,
choix incompatibles retirés en cascade (race → classes → magies), limites respectées.

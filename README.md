# Maverick Center

Outils autour de **Maverick JDR** : un wiki dont les pages sont reliées par mots-clés, et un générateur de fiche de personnage.
Le contenu du jeu vient d'un serveur Discord et de Google Docs (voir [docs/sources.md](docs/sources.md)).

> ⚠️ Le contenu actuel du wiki et de `rules.json` est de la **démonstration** (`status: example`), pas les règles de Maverick.
> Il sera remplacé par l'import des sources.

## Démarrage

Prérequis : Node.js ≥ 22.12.

```bash
cd client
npm install
npm run dev      # http://localhost:4321
npm test         # tests unitaires
npm run build    # site statique dans client/dist/
```

## Ce que contient le site

- **Wiki** (`/wiki/`) : une catégorie par salon Discord (races, classes, magies, bestiaire, ressources & craft, métiers, guide, lore, cartes).
  Les pages se relient avec `[[Titre]]` ; chaque page affiche ses rétroliens, ses mots-clés (`/tags/`) et est trouvable par la recherche (`/recherche/`).
- **Générateur de fiche** (`/generateur/`) : race, classes, magies, répartition de points, valeurs dérivées ; sauvegarde automatique
  dans le navigateur, export/import JSON, impression/PDF. Les règles sont des **données** (`client/src/data/rules.json`).

## Documentation

- [Sources (Discord, Google Docs) et import](docs/sources.md)
- [Écrire des pages du wiki](docs/content-guide.md)
- [Schéma des règles du générateur](docs/character-generator.md)
- [CLAUDE.md](CLAUDE.md) — contexte pour les sessions Claude Code

## Structure

```
client/   site Astro (wiki + générateur)
sources/  manifeste des sources et contenu brut importé
tools/    scripts d'import
docs/     documentation
api/      services de personnages d'origine (voir ci-dessous)
```

### Services `api/` (existant)

Deux implémentations équivalentes d'une API CRUD de personnages, avec un fichier JSON comme base : `api/character-service`
(Node.js sans dépendance, `npm start` / `npm test`, port 3000) et `api/dotnet-character-service` (ASP.NET Core, `dotnet run`, port 5000).
Le site ne les utilise pas pour l'instant : les fiches sont stockées dans le navigateur.

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

- **Wiki** : une catégorie par salon Discord (races, classes, magies, bestiaire, ressources & craft, métiers, guide, lore, cartes), à la racine du site
  (`/races/`, `/races/nain/`…) ; index alphabétique de toutes les pages : `/pages/`.
  Les pages se relient avec `[[Titre]]` ; chaque page affiche ses rétroliens, ses mots-clés (`/tags/`) et est trouvable par la recherche (`/recherche/`).
- **Générateur de fiche** (`/generateur/`) : race, classes, magies, répartition de points, valeurs dérivées ; sauvegarde automatique
  dans le navigateur, export/import JSON, impression/PDF. Les règles sont des **données** (`client/src/data/rules.json`).

## Branches, versions et livraisons

`master` est la production, `dev` l'intégration ; on ne crée que des `feature/<nom>` (depuis `dev`) et des `hotfix/<nom>` (depuis `master`).
Après chaque fusion, un bot tient la version (`X.Y.Z`). Avant la 1.0, le site unique est reconstruit depuis `dev` (branche `site`) ;
à partir de la 1.0 (connexion Discord), chaque fusion produit un script d'installation : **serveur de test** pour `dev` (il copie la base du
serveur normal à l'installation), **serveur normal** pour `master`. Voir [docs/flux-git.md](docs/flux-git.md).

## Héberger le site (NAS, Docker)

`./deploy/build.sh` construit le site à montrer et produit `deploy/maverick-center-nas.zip` : site statique + `docker-compose.yml` + configuration
nginx protégée par mot de passe. Après chaque fusion dans `dev`, GitHub republie le site sur la branche `site` et le NAS la récupère
automatiquement (`deploy/update-nas.sh`). Voir [deploy/README.md](deploy/README.md). À partir de la 1.0, la solution est hébergée et installée par des
installateurs autonomes : [deploy/installateur/README.md](deploy/installateur/README.md).

Pour une page privée claude.ai (une simple adresse à ouvrir) : `node tools/build-artifact.mjs --out <dossier>` produit la version portable
(liens relatifs, sans fichier JS/CSS externe) et les listes de fichiers à publier.

## Documentation

- [Sources (Discord, Google Docs) et import](docs/sources.md)
- [Flux Git : branches, versions, livraisons](docs/flux-git.md)
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

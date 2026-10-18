# Maverick Center

Outils autour de **Maverick JDR** : un wiki dont les pages sont reliées par mots-clés, et la fiche de personnage.
Le contenu du jeu vient d'un serveur Discord et de Google Docs (voir [docs/sources.md](docs/sources.md)).

> ⚠️ Les pages `status: example` du wiki sont de la **démonstration**, pas les règles de Maverick (`HIDE_EXAMPLES=1` les retire).
> Tout le reste vient des sources importées (voir [docs/sources.md](docs/sources.md)).

## Démarrage

Prérequis : Node.js ≥ 22.12.

```bash
cd client
npm install
npm run dev      # http://localhost:4321
npm run serveur  # (autre terminal) service des personnages, que `npm run dev` relaie sous /api/
npm test         # tests unitaires
npm run build    # site statique dans client/dist/ (avec le service, dans dist/_serveur/)
```

## Ce que contient le site

- **Wiki** : une catégorie par salon Discord (races, classes, magies, bestiaire, ressources & craft, métiers, guide, lore, cartes), à la racine du site
  (`/races/`, `/races/nain/`…) ; index alphabétique de toutes les pages : `/pages/`.
  Les pages se relient avec `[[Titre]]` ; chaque page affiche ses rétroliens, ses mots-clés (`/tags/<mot-clé>/`) et est trouvable par la recherche (`/recherche/`,
  qui liste aussi tous les mots-clés).
- **Accueil** : un texte de bienvenue et le défilement des images de la **galerie** (`/galeries/`, en construction : le logo seul) ;
  **Archives** (`/archives/`) : les Google Docs, Sheets et l'ancien wiki qui ont servi de source, avec leurs liens.
- **Guide** : « Découvrir » (`/decouvrir/`), une page par entrée du menu — Bienvenue, L'univers, Créer son personnage, Rejoindre une partie, puis
  les liens (Discord, Tipeee) et l'encart « Notre prochaine rencontre IRL » —, pour découvrir le jeu même sans jamais avoir joué à un JDR et créer
  son personnage ; « Les bases » (`/regles/`), les « Règles avancées » (`/regles/avancees/`) et le « Guide du MJ » (`/mj/`) en sommaires ; chaque page
  se lit seule ; quatre personnages fil rouge sont créés étape par étape. Les tableaux (progression, postures, compétences…) sont tirés de la base. Le
  plan est dans `client/src/lib/livres.mjs`.
- **Fiche de personnage** (`/fiche/`) : créer et modifier un prétiré étape par étape (race, magies, classes, caractéristiques, compétences, sorts,
  progression, dons, équipement), les valeurs calculées au fil de la saisie et contrôlées par la base ; téléchargement en tableur (.xlsx au modèle
  de la fiche V15.2.2), export vers Google Sheets, import d'un .xlsx ou d'une feuille Google partagée par lien (fiche auto comprise).
  **Personnages** (`/personnages/`) : tous les prétirés, avec filtres et tri par colonne. Voir [docs/character-generator.md](docs/character-generator.md).

## Mode client / serveur

Le site se lit en pages statiques ; ce qu'on y **écrit** passe par le **service des personnages** (`client/serveur/`, Node sans dépendance), livré avec
le site et servi par nginx sous `/api/`. Il enregistre les prétirés dans la base vivante de l'instance (`db/`), qu'il refait sans perdre de fiche
quand les règles changent. Voir [docs/serveur.md](docs/serveur.md).

## Branches, versions et livraisons

`master` est la production, `dev` l'intégration ; on ne crée que des `feature/<nom>` (depuis `dev`) et des `hotfix/<nom>` (depuis `master`).
Après chaque fusion, un bot tient la version (`X.Y.Z`). Avant la 1.0, le site unique est reconstruit depuis `dev` (branche `site`) ;
à partir de la 1.0 (connexion Discord), chaque fusion produit un script d'installation : **serveur de test** pour `dev` (il copie la base du
serveur normal à l'installation), **serveur normal** pour `master`. Voir [docs/flux-git.md](docs/flux-git.md).

## Héberger le site (NAS, Docker)

`./deploy/build.sh` construit le site à montrer et produit `deploy/maverick-center-nas.zip` : site + `docker-compose.yml` (nginx et le service des
personnages) + configuration nginx protégée par mot de passe. Après chaque fusion dans `dev`, GitHub republie le site sur la branche `site` et le NAS la récupère
automatiquement (`deploy/update-site.sh`). Voir [deploy/README.md](deploy/README.md). À partir de la 1.0, la solution est hébergée et installée par des
installateurs autonomes : [deploy/installateur/README.md](deploy/installateur/README.md).

Pour une page privée claude.ai (une simple adresse à ouvrir) : `node tools/build-artifact.mjs --out <dossier>` produit la version portable
(liens relatifs, sans fichier JS/CSS externe) et les listes de fichiers à publier.

## Documentation

- [Sources (Discord, Google Docs) et import](docs/sources.md)
- [Flux Git : branches, versions, livraisons](docs/flux-git.md)
- [Écrire des pages du wiki](docs/content-guide.md)
- [Fiche de personnage et fiches dans la base](docs/character-generator.md)
- [Mode client / serveur : le service des personnages](docs/serveur.md)
- [CLAUDE.md](CLAUDE.md) — contexte pour les sessions Claude Code

## Structure

```
client/   site Astro (wiki + générateur) et service des personnages (client/serveur/)
sources/  manifeste des sources et contenu brut importé
tools/    scripts d'import
docs/     documentation
api/      services de personnages d'origine, non utilisés (voir ci-dessous)
```

### Services `api/` (existant)

Deux implémentations équivalentes d'une API CRUD de personnages, avec un fichier JSON comme base : `api/character-service`
(Node.js sans dépendance, `npm start` / `npm test`, port 3000) et `api/dotnet-character-service` (ASP.NET Core, `dotnet run`, port 5000).
Le site ne les utilise pas : son service est `client/serveur/` ([docs/serveur.md](docs/serveur.md)).

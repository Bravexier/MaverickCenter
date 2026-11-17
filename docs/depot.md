# Le dépôt : structure, commandes, sources, vision

Descriptif sorti de `CLAUDE.md` le 2026-11-12 pour alléger le contexte de chaque agent. Les règles restent dans `CLAUDE.md` ; on lit ce document quand on a besoin d'une adresse ou d'une commande.

## Structure

| Chemin | Rôle |
| --- | --- |
| `client/` | Le site Astro 7 statique (wiki, fiche, outils) : `src/pages`, `components`, `layouts`, `styles`, `scripts` (navigateur), `lib` (modules purs, sans navigateur ni Astro) |
| `client/serveur/` | Le service Node (sans paquet npm) : personnages `/api/`, édition du site de dev, API REST `/api/v1/` (dev seulement), mise à jour, métriques (`docs/serveur.md`, `docs/api.md`) |
| `client/src/content/wiki/` | Pages du wiki **fabriquées** depuis `data/rows` par `npm run db:export-pages` (avant `dev`, `build`, `test`), ignorées par git (skill `modifier-une-page-wiki`) |
| `client/scripts/` | Scripts `db:*` et de mise à jour |
| `client/test/` | Tests `node:test` (`npm test`) |
| `data/schema.sql`, `data/migrations/`, `data/rows/` | La base SQLite : schéma (skill `base-sqlite`), migrations, lignes versionnées (jamais modifiées à la main) |
| `tools/` | Importeurs et extracteurs (`sheets/`, `bestiaire/`, `chronologie/`, `docs/`, `sources/`), outils de la base (`db/`), flux Git (`flux-git/`), version portable (`build-artifact.mjs`) |
| `sources/` | Manifeste et exports bruts des sources |
| `deploy/` | Hébergement NAS et VPS (fichiers en LF) |
| `.github/` | CI, garde des branches, livraison, mise à jour |
| `docs/` | La documentation : `content-guide.md`, `serveur.md`, `api.md`, `character-generator.md`, `bestiaire.md`, `chronologie.md`, `codex.md`, `sources.md`, `flux-git.md`, `feuille-de-route.md`, `sql/` |
| `.claude/` | Agents (`agents/`) et skills (`skills/`) |
| `api/` | Services CRUD de personnages d'avant le site (Node sans dépendance + .NET), inutilisés : le service actif est `client/serveur/`. Ne pas les modifier sans demande |

**Avant de toucher une zone du site, charger son skill.** Chaque zone a le sien (`zone-…`, `ui-…`, `site-…`, `base-…`, `sources-…`, liste dans `docs/equipe.md`). Il porte les invariants et les choix du propriétaire que les tests épinglent.
Le skill d'une zone n'est proposé qu'après la lecture d'un fichier de cette zone (champ `paths`). Avant, pour un brief ou une analyse, on lit directement `.claude/skills/<nom>/SKILL.md`.

## Commandes (depuis `client/`, Node ≥ 22.12)

```bash
npm install
npm run dev        # http://localhost:4321 — relancer après l'ajout d'un NOUVEAU fichier de contenu
npm run serveur    # le service (http://127.0.0.1:8787/api/, base vivante dans var/serveur/) : `npm run dev` lui transmet /api/
npm run build      # build statique dans dist/ ; un [[lien]] cassé produit un avertissement [wikilinks]
npm test           # tests (unitaires, service, règles de la base, site construit si dist/ existe)
npm run db:build   # var/maverick.db depuis data/rows ; puis db:check, db:pages-check, db:doc, db:migrate, db:sync-pages
HIDE_EXAMPLES=1 npm run build   # version à montrer, sans les pages `status: example`
```

Déploiement sous un sous-chemin : `SITE_BASE=/MaverickCenter/ SITE_URL=https://… npm run build`.

## Accès aux sources

- **Réseau.** Depuis une session cloud, Discord et `docs.google.com` sont bloqués par la politique réseau (le propriétaire peut les autoriser dans les paramètres de l'environnement), et aucun connecteur Discord n'existe. Ne jamais utiliser un jeton Discord personnel (alternatives : `docs/sources.md`).
- **Copies et originaux.** Les documents Google cités sont des copies dans le Drive du propriétaire, mais **les originaux font foi** pour vérifier une table ou appliquer une mise à jour (R83). Ils se lisent par les connecteurs Google de la session (`tech-sources`).
- **Exports bruts.** Ils sont dans `sources/raw/` et `sources/discord/`. La fiche auto corrigée V1.2 est décrite dans `docs/fiche-auto.md`.

## Vision à long terme

Le site doit devenir une source rapide et navigable des règles et du lore. Ensuite, il doit permettre de modifier sorts, dons, classes et races pour remplacer à terme les Google Docs et Sheets. Enfin, il doit simuler des combats pour juger l'équilibrage.

Le NAS est temporaire. `docs/feuille-de-route.md` fixe les exigences : identifiants stables, SQL portable, modifications historisées, règles en données, moteur pur partagé, rien de propre au NAS hors de `deploy/`. Les évolutions voulues y sont numérotées **E1 à E12**, avec leurs questions.

La provenance des données (`famille`, colonnes `origine` et `source_ref`) sera retirée à la 1.0 (décision du propriétaire) : n'y rien investir, ne pas réparer les références incomplètes.

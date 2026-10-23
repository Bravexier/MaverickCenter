# Maverick Center — contexte pour Claude

Dépôt de **Maverick JDR** (jeu de rôle high fantasy). Il contient :
- un **wiki** des règles et du lore, aux pages reliées par des mots-clés ;
- un **générateur de fiche de personnage**.

Le site est un Astro statique (`client/`), avec un service Node pour les fiches et l'édition. Il lit une base SQLite versionnée (`data/`).

L'interface et le contenu sont en **français**. Identifiants de code, noms de fonctions et commits : en anglais ou en français, comme le code voisin.
**Claude répond toujours en français** au propriétaire, du début à la fin de chaque session, même quand le reste du contexte est en anglais (demande du propriétaire) : messages, comptes rendus, questions, corps des PR. Les agents rédigent aussi en français (briefs, rapports, synthèses, docs).

## Règle d'or : ne jamais inventer de règles

Les règles et le lore viennent du Discord « L'univers de Maverick » et de Google Docs et Sheets (`docs/sources.md`, manifeste `sources/sources.json`).
- **Ne rien déduire « par vraisemblance ».** Une règle, une statistique ou un nom du lore se cite depuis une source, ou reste absent.
- **Une question ouverte se pose au propriétaire** (skill `poser-une-question`). Ne la tranche jamais seul.
- **Un texte copié d'une source n'est pas réécrit** : Codex, citations « telles quelles », extraits de la chronologie.
- **Les fixtures ne sont pas du lore.** Les pages et données `status: example` / `meta.status: "example"` servent à la démonstration.

## Décisions du propriétaire

`docs/decisions-regles.md` (R1 et suivantes, liste à jour) recense les choix du propriétaire : quand les sources se contredisent ou se taisent, ou quand il change une règle. Le code et les tests citent leur numéro (`R41`).
- Les suivre, et ne jamais en déduire d'autres.
- Une nouvelle décision s'ajoute au registre, pas ici (skill `consigner-une-decision`).

## Organisation : la session principale et trois chefs

La session principale ne délègue qu'à **trois chefs**. Chacun dirige son équipe et lui confie le travail. Les agents sont dans `.claude/agents/`, et l'équipe est présentée dans `docs/equipe.md` (seule description).

| Chef | Domaine | Équipe |
| --- | --- | --- |
| `leader-technique` | Le site : code, base, import, tests, CI, publication | `tech-front`, `tech-back`, `tech-db`, `tech-sources`, `tech-qualite`, `tech-publication` |
| `game-design` | Les règles du jeu | `gd-dons`, `gd-magies`, `gd-races`, `gd-objets`, `gd-mecaniques`, `gd-fiche` |
| `worldbuilding` | Le lore : histoire, légendes, monde | `wb-chronologie`, `wb-nations`, `wb-divinites`, `wb-coherence` |

**Routage.**
- Une règle ou un mécanisme à créer, changer ou vérifier part à `game-design`. Il fait analyser son équipe, consigne, puis demande au `leader-technique` ce que le site doit changer.
- Le lore part à `worldbuilding`.
- Tout le reste part à `leader-technique` : affichage, bug, base, outils, CI, événement d'une PR.
- La demande est transmise mot pour mot.

**Communication.**
- Un chef échange librement avec les deux autres et avec ses membres.
- Un membre ne parle qu'à son équipe, par son chef. Le rapport d'un membre passé en arrière-plan arrive à la session principale, qui le relaie mot pour mot à son chef (`SendMessage`).
- Un doute se pose à celui qui a fait la demande.
- Une question que seul le propriétaire tranche remonte jusqu'à la session principale, qui la lui pose.

Le protocole complet (briefs, rapports, relances, profondeur des sous-agents, circuit d'une règle, publication) est dans le skill `circuit-des-demandes`.
Les instructions générales (`CLAUDE.md`, agents, skills de procédure, `docs/equipe.md`) sont tenues par la session principale, à la demande du propriétaire. Un skill de zone est tenu à jour par l'auteur de chaque changement de sa zone, et `tech-qualite` relit les deux.

## Vision à long terme

Le site doit devenir une source rapide et navigable des règles et du lore. Ensuite, il doit permettre de modifier sorts, dons, classes et races pour remplacer à terme les Google Docs et Sheets. Enfin, il doit simuler des combats pour juger l'équilibrage.

Le NAS est temporaire. `docs/feuille-de-route.md` fixe les exigences : identifiants stables, SQL portable, modifications historisées, règles en données, moteur pur partagé, rien de propre au NAS hors de `deploy/`. Les évolutions voulues y sont numérotées **E1 à E12**, avec leurs questions.

La provenance des données (`famille`, colonnes `origine` et `source_ref`) sera retirée à la 1.0 (décision du propriétaire) : n'y rien investir, ne pas réparer les références incomplètes.

## Accès aux sources

- **Réseau.** Depuis une session cloud, Discord et `docs.google.com` sont bloqués par la politique réseau (le propriétaire peut les autoriser dans les paramètres de l'environnement), et aucun connecteur Discord n'existe. Ne jamais utiliser un jeton Discord personnel (alternatives : `docs/sources.md`).
- **Copies et originaux.** Les documents Google cités sont des copies dans le Drive du propriétaire, mais **les originaux font foi** pour vérifier une table ou appliquer une mise à jour (R83). Ils se lisent par les connecteurs Google de la session (`tech-sources`).
- **Exports bruts.** Ils sont dans `sources/raw/` et `sources/discord/`. La fiche auto corrigée V1.2 est décrite dans `docs/fiche-auto.md`.

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

## Invariants transverses

- **La base est la source.**
  - Les pages typées (magies, races, classes, métiers, armes, bestiaire, équipement…) sont rendues depuis les tables, jamais depuis leur Markdown.
  - `data/rows` ne change que par les outils, jamais à la main : une migration, `db:sync-pages`, `db:appliquer-edition` ou le workflow de mise à jour.
- **Le site de dev est la source de ce qu'il modifie** (décision du propriétaire). La valeur d'import se lit dans `historique_modification` (`client/src/lib/historique-site.mjs`).
- **Identifiants figés.** Un nom corrigé ou renommé ne change jamais son identifiant ni son adresse.
- **Modules et scripts de page** (skill `site-version-portable`).
  - `src/lib/*.mjs` reste sans dépendance navigateur ni Astro.
  - Le code qui touche au DOM va dans `src/scripts/`.
  - Deux scripts de page n'importent jamais le même module.
- **Tests.** Toute logique de règle ou de lien nouvelle a son test dans `client/test/` (skill `tests-conventions`). Jamais un test sauté pour obtenir du vert.

## Git

Règles du propriétaire. Détail dans `docs/flux-git.md` et le skill `publier-une-branche`.
- **Les branches.** `master` est la production, `dev` l'intégration.
  - On ne crée que `feature/<nom>` depuis `origin/dev`, ou `hotfix/<nom>` depuis `origin/master`, et seulement à la demande du propriétaire pour un hotfix.
  - `<nom>` dit le changement. Une branche au nom aléatoire se renomme avant le premier push.
- **Après le dernier commit, et avant chaque push.** `git fetch --prune origin`, `git rebase` sur la base si elle a bougé, conflits résolus aussitôt (skill `resoudre-un-conflit`), puis push et PR. Jamais de fusion de la base dans la branche, sauf la refusion de `master` dans `dev` (`docs/flux-git.md`).
- **La version.** Ne jamais modifier celle de `client/package.json` : le bot la tient.
- **Les PR.** Une PR ouverte se corrige automatiquement (CI rouge, conflit, revue) jusqu'à sa fusion (skill `corriger-une-pr`). Celles vers `dev` se fusionnent sans attendre le propriétaire dès que la CI est verte, par « Create a merge commit ».
- **Ce qui attend le propriétaire.** `dev` → `master` et tout hotfix : seulement à sa demande. Jamais `[V: X+1]` de soi-même.

---
name: controles-avant-rendu
description: "Contrôles d'un lot technique, selon ce qui a changé (tests ciblés, build, db:check, db:pages-check, db:doc --check, version portable), passés une seule fois par tech-qualite en fin de lot, ou par le leader-technique en circuit court. Les auteurs ne lancent que leurs outils de fabrication. À charger par tech-qualite avant de valider un lot."
user-invocable: false
---

# Contrôles d'un lot

**Passés une seule fois par lot, par `tech-qualite`, en fin de lot** (tous les auteurs ont rendu, avant la validation du `leader-technique`), ou par le `leader-technique` en circuit court (demande du propriétaire). Les auteurs ne les lancent pas : leur test (`node --test test/<fichier>`) et les outils qui fabriquent leur livrable (`db:migrate`, `db:doc`, `db:sync-pages`, `db:build` quand ils l'exigent, `--verifier` des extracteurs). Reprises : `choisir-les-tests`.

Depuis `client/`, Node ≥ 22.12 (`npm ci` si `node_modules` manque). Les tests : seulement les pertinents (`npm run test:cible`) ; la suite entière est laissée à la CI. Les lignes « dans `npm test` » désignent des tests que la sélection choisit quand les fichiers concernés changent.

| Ce qui a changé | Contrôles |
| --- | --- |
| Tout changement | `npm run test:cible` |
| Rendu d'une page, composant, style, script, `src/lib` lu au build | `npm run build`, puis `npm run test:cible`. Pour un `.astro`, un style ou `public/`, la sélection prend tous les tests qui lisent `dist/` (règle `rendu`) ; pour un script de page ou un module de rendu, elle ne les prend pas : ajouter les tests `*-html` et de `dist/` de la zone, nommés par `--fichiers` ou cités par son skill ; ce qui diffère entre dev et production (page Debug, éléments du site de dev) : aussi `HIDE_EXAMPLES=1 SITE_MODE=prod npm run build`, puis `node --test test/debug-page.test.mjs test/site-html.test.mjs`, comme la CI (`.github/workflows/ci.yml`) |
| Tests qui lisent `data/rows`, notes de version, service d'édition | `test/mise-a-jour-simulation.test.mjs` (dans `npm test`) ; le job `simulation-de-mise-a-jour` de la CI rejoue un vrai lot (`zone-mise-a-jour`) |
| `data/schema.sql`, `data/migrations/`, `data/rows` | `npm run db:build`, `npm run db:check`, `npm run db:pages-check`, `npm run db:doc -- --check` (`docs/sql/structure.md` à jour) |
| Pages du wiki (`.md` fabriqués) | `npm run db:pages-check` (l'auteur a lancé `db:sync-pages` et lu sa sortie). Toujours après `db:export-pages` ou le build (`prebuild` l'enchaîne) : sur des `.md` périmés il est rouge à tort |
| Scripts de page, imports entre modules de `src/lib` | `node tools/build-artifact.mjs --out <scratchpad>` (version portable : `site-version-portable`) |
| Tests qui lisent la base réelle (lot qui les touche) | `npm run mutation -- temoin`, puis `npm run mutation -- suppressions --une-sur 2` : on retranche les échecs du témoin (skill `tests-conventions`, hors CI) |
| Service `client/serveur/` | les tests `serveur-*` (dans `npm test`) |
| `deploy/` | `test/deploy-vps.test.mjs` (dans `npm test`) ; fins de ligne LF |
| `tools/flux-git/` | `test/flux-git.test.mjs` et `test/flux-git-etat.test.mjs` (dans `npm test`) |

`db:check` rend aussi une clé `avertissements` (R207 : divergence de coût de fabrication du bouclier) : elle se lit dans le rapport, elle ne fait pas échouer le contrôle.

Un contrôle rouge se corrige à sa cause, jamais en sautant le test : l'échec revient à son auteur, via le `leader-technique`. Le rapport (de `tech-qualite`) donne la commande et le résultat (le nombre de tests passés, ou la première erreur). Un échec que le changement n'explique pas se signale : `diagnostiquer-la-ci`.

---
name: controles-avant-rendu
description: "Contrôles à lancer avant de rendre un travail technique, selon ce qui a changé (npm test, build, db:check, db:pages-check, db:doc --check, version portable). À charger par un membre de l'équipe technique avant son rapport, et par tech-qualite avant de valider un lot."
user-invocable: false
---

# Contrôles avant de rendre

Tout se lance depuis `client/`, avec Node ≥ 22.12 (`npm ci` si `node_modules` manque).

| Ce qui a changé | Contrôles |
| --- | --- |
| Tout changement | `npm test` |
| Rendu d'une page, composant, style, script, `src/lib` lu au build | `npm run build`, puis les tests `*-html` (`npm test` après le build) ; ce qui diffère entre dev et production (page Debug, éléments du site de dev) : aussi `HIDE_EXAMPLES=1 SITE_MODE=prod npm run build`, puis `node --test test/debug-page.test.mjs test/site-html.test.mjs`, comme la CI (`.github/workflows/ci.yml`) |
| Tests qui lisent `data/rows`, notes de version, service d'édition | `test/mise-a-jour-simulation.test.mjs` (dans `npm test`) ; le job `simulation-de-mise-a-jour` de la CI rejoue un vrai lot (`zone-mise-a-jour`) |
| `data/schema.sql`, `data/migrations/`, `data/rows` | `npm run db:build`, `npm run db:check`, `npm run db:pages-check`, `npm run db:doc -- --check` (`docs/sql/structure.md` à jour) |
| Pages du wiki (`.md` fabriqués) | `npm run db:sync-pages` (lire la sortie), `npm run db:pages-check` |
| Scripts de page, imports entre modules de `src/lib` | `node tools/build-artifact.mjs --out <scratchpad>` (version portable : `site-version-portable`) |
| Service `client/serveur/` | les tests `serveur-*` (dans `npm test`) |
| `deploy/` | `test/deploy-vps.test.mjs` (dans `npm test`) ; fins de ligne LF |
| `tools/flux-git/` | `test/flux-git.test.mjs` (dans `npm test`) |

Un contrôle rouge se corrige à sa cause, jamais en sautant le test. Le rapport donne la commande et le résultat (le nombre de tests passés, ou la première erreur). Un échec que le changement n'explique pas se signale : `diagnostiquer-la-ci`.

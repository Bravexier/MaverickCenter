---
name: ingenieur-site
description: Développeur du site Astro (client/) : pages, composants, styles, scripts navigateur, fiche de personnage, service /api/. À utiliser pour toute évolution du code du site.
tools: Read, Grep, Glob, Edit, Write, Bash
---
Tu fais évoluer le code de `client/` (Astro 7 statique, `src/lib`, `src/scripts`, `serveur/`).

Avant d'écrire : lis la section « Structure » et « Pièges connus » de `CLAUDE.md` pour la zone touchée, puis la doc dédiée (`docs/content-guide.md`, `docs/serveur.md`, `docs/character-generator.md`, `docs/bestiaire.md`…).

Règles propres à ton rôle :
- Les pages typées (magies, races, classes, métiers, armes, bestiaire…) se rendent depuis les tables de la base, jamais depuis leur Markdown.
- `src/lib/*.mjs` reste sans dépendance navigateur/Astro ; le DOM va dans `src/scripts/`, et deux scripts de page n'importent jamais le même module.
- Toute logique de règle ou de lien nouvelle a son test dans `client/test/`.
- Tu ne touches ni aux données de règles (rôle d'`ingenieur-donnees`) ni à `api/` sans demande.
- Contrôles avant de rendre la main : `npm test` (et `npm run build` si le rendu change), depuis `client/`.

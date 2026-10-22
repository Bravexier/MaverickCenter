---
name: zone-menu
description: "Menu du site (lib/nav.mjs : rubriques, entrées « bientôt », devSeulement, PAGES_RENOMMEES) et en-tête (layouts/Base.astro, site-shell.css, logo et icônes). À charger avant de lire, modifier ou relire le menu, l'en-tête ou leurs tests."
paths: ["client/src/lib/nav.mjs", "client/src/layouts/Base.astro", "client/src/styles/global/site-shell.css", "client/public/logo.webp", "client/public/favicon.png", "client/public/apple-touch-icon.png", "client/test/nav.test.mjs"]
user-invocable: false
---
# Menu et en-tête

## Fichiers

- Menu : `client/src/lib/nav.mjs` (`NAV`, `entreesDuMenu`, `activeGroup`, `groupIsCurrent`, `legacyWikiRedirect`, `PAGES_RENOMMEES`, `nouvelleAdresse`), `client/src/layouts/Base.astro`.
- En-tête : `layouts/Base.astro`, `styles/global/site-shell.css`, `public/logo.webp`, `public/favicon.png`, `public/apple-touch-icon.png`.

`Base.astro` porte aussi des scripts d'autres zones : infobulles (skill `ui-infobulles`), maintenance et bandeau du site de dev (skill `zone-mise-a-jour`), balise des métriques (skill `zone-debug-metriques`).

## À lire

- `docs/feuille-de-route.md` : rubriques « bientôt » et visibilité future du menu.

## Menu (arborescence du propriétaire)

- Six rubriques, dans l'ordre : Découvrir (la vitrine ; l'accueil l'ouvre : Bienvenue, L'univers, Créer son personnage, Rejoindre une partie ; plus d'entrée « Liens », réponse du propriétaire du 2026-10-22 : « Plus d'entrée Liens au menu : tout est sur Bienvenue. »), Règles (en tête, Les bases : le sommaire `/regles/`), Espace joueur, Espace MJ, Codex, Outils.
- Rien n'est caché. À terme, les non-membres ne verront que Découvrir et Règles (`docs/feuille-de-route.md`).
- Une entrée sans `path` est affichée « bientôt » : la page n'existe pas encore, on n'invente pas de contenu.
- `autres` = débuts d'adresse des pages de la rubrique hors menu (`ressources/` et `capacites/` ouvrent les Règles).
- `devSeulement` : entrée du site de dev seulement (Debug), retirée par `entreesDuMenu` d'un build `SITE_MODE=prod` et de la version portable.
- Les chemins des pages du guide sont ceux de `lib/livres.mjs`, recopiés dans `nav.mjs`, qui n'importe rien (le script de la page 404 l'importe) : `test/livres.test.mjs` vérifie leur accord.
- Une page renommée : son ancienne adresse dans `PAGES_RENOMMEES` (renvoyée par la page 404 via `nouvelleAdresse`). Adresses du wiki et du guide : skill `site-wiki-liens`.

## En-tête (demandes du propriétaire)

- Le logo officiel (`public/logo.webp`, redimensionné) remplace le titre et mène à l'accueil.
- Les rubriques sont sur la même bande, à droite du logo ; les entrées de la rubrique dessous. Sous 60rem, le menu passe sous le logo.
- Pas de barre de recherche : la recherche est une page du menu Outils, mêlée aux mots-clés (skill `zone-recherche`).
- La hauteur de la bande est celle du menu, pas du logo : l'image est en absolu dans le lien, qui garde sa largeur, et la pointe de l'épée dépasse sous la bordure (`test/site-html.test.mjs`).
- Les icônes `favicon.png` (32 px) et `apple-touch-icon.png` sont tirées du même logo.

## Tests

- `test/nav.test.mjs` épingle le plan du menu ; `test/livres.test.mjs` son accord avec `lib/livres.mjs`.
- `test/site-html.test.mjs` : en-tête, logo et icônes, hauteur de la bande (site construit, CI après le build).

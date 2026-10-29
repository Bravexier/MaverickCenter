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

`Base.astro` porte aussi des scripts d'autres zones : infobulles (skill `ui-infobulles`), maintenance (skill `zone-maintenance`) et bandeau du site de dev (skill `zone-mise-a-jour`), balise des métriques (skill `zone-debug-metriques`).

## À lire

- `docs/feuille-de-route.md` : rubriques « bientôt » et visibilité future du menu.

## Menu (arborescence du propriétaire)

- Sept rubriques, dans l'ordre (clé) :
  - Règles (`regles`, la vitrine, l'accueil l'ouvre) : Découvrir (`/decouvrir/`), L'univers, Créer son personnage, Rejoindre une partie, puis Les bases (`/regles/`) et Règles avancées. Plus d'entrée « Liens » : tout est sur l'accueil (demande du propriétaire).
  - Personnage (`personnage`) : Races, Magies, Classes, Métiers.
  - Équipement (`equipement`) : une entrée par onglet de la page Équipement (libellé et ancre de `ONGLETS_DE_L_EQUIPEMENT`, `ressources/equipement/#armes`…), puis Artisanat et Livres & Parchemins. Plus d'entrée unique « Équipement » (skill `zone-equipement`).
  - Espace joueur, Espace MJ, Codex, Outils.
- Plus d'entrée « Pièces élémentaires » : sa page reste dans la base, en attente de la réponse du propriétaire sur son contenu.
- Rien n'est caché. À terme, les non-membres ne verront que « les 2 premiers onglets » (formulé ainsi par le propriétaire : ne pas nommer les rubriques ; `docs/feuille-de-route.md`).
- Une page ouvre la rubrique dont une entrée (sans son ancre) ou un début d'adresse `autres` est le plus long début de son adresse (`activeGroup`, `groupIsCurrent`) : `/regles/artisanat/` ouvre l'Équipement, pas les Règles de `/regles/`. Une seule rubrique est courante.
- Une entrée sans `path` est affichée « bientôt » : la page n'existe pas encore, on n'invente pas de contenu.
- `autres` = débuts d'adresse des pages de la rubrique hors menu (`capacites/` ouvre le Personnage, `ressources/` l'Équipement).
- `devSeulement` : entrée du site de dev seulement (Debug), retirée par `entreesDuMenu` d'un build `SITE_MODE=prod` et de la version portable.
- Les chemins des pages du guide sont ceux de `lib/livres.mjs`, recopiés dans `nav.mjs`, qui n'importe rien (le script de la page 404 l'importe) : `test/livres.test.mjs` vérifie leur accord.
- Une page renommée : son ancienne adresse dans `PAGES_RENOMMEES` (renvoyée par la page 404 via `nouvelleAdresse`). Adresses du wiki et du guide : skill `site-wiki-liens`.

## En-tête (demandes du propriétaire)

- Le logo officiel (`public/logo.webp`, redimensionné) remplace le titre et mène à l'accueil.
- Les rubriques sont sur la même bande, à droite du logo ; les entrées de la rubrique dessous. Sous 60rem, le menu passe sous le logo.
- Pas de barre de recherche : la recherche est une page du menu Outils, mêlée aux mots-clés (skill `zone-recherche`).
- La hauteur de la bande est celle du menu, pas du logo : l'image est en absolu dans le lien, qui garde sa largeur, et la pointe de l'épée dépasse sous la bordure (`test/site-html.test.mjs`).
- Le bandeau du site de dev (`.bandeau-test` de `site-shell.css`) lit les jetons `--bandeau-dev` et `--texte-sur-fonce` (skill `ui-couleurs-theme`).
- Les icônes `favicon.png` (32 px) et `apple-touch-icon.png` sont tirées du même logo.

## Tests

- `test/nav.test.mjs` épingle le plan du menu ; `test/livres.test.mjs` son accord avec `lib/livres.mjs`.
- `test/site-html.test.mjs` : en-tête, logo et icônes, hauteur de la bande (site construit, CI après le build).

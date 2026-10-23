---
name: zone-maintenance
description: "Maintenance pendant une mise à jour : annonce partagée (serveur/maintenance.mjs, dossier MAVERICK_MAINTENANCE), page /maintenance/, script de chaque page, retour. À charger avant de lire, modifier ou relire ce code."
paths: ["client/serveur/maintenance.mjs", "client/src/pages/maintenance.astro", "client/src/scripts/maintenance.mjs", "client/src/lib/maintenance-retour.mjs", "client/src/styles/maintenance/**", "client/test/serveur-maintenance.test.mjs"]
user-invocable: false
---
# Maintenance pendant une mise à jour

La page « Mise à jour » et le workflow qui lancent la maintenance : skill `zone-mise-a-jour`. Dossier partagé et conteneurs : skill `zone-hebergement`.

## Fichiers
- `serveur/maintenance.mjs` (`annonceDuLancement`, `etatDeMaintenance`, `DUREE_MAX_MAINTENANCE`), `pages/maintenance.astro`, `scripts/maintenance.mjs`, `lib/maintenance-retour.mjs`, `styles/maintenance/` ; script en ligne de `layouts/Base.astro`.

## À lire
- `docs/serveur.md`, « Maintenance pendant une mise à jour » : qui publie l'annonce, qui la lit, le script de chaque page, `/maintenance/`, les garde-fous, la mise en place du dossier partagé.

## Choix du propriétaire
- Maintenance en cours (demande du propriétaire) : une vraie mise à jour lancée, les deux sites partent vers `/maintenance/` (menus grisés et inertes, « En travaux, merci de revenir dans quelques minutes »), et chaque serveur rouvre indépendamment dès qu'il a sa nouvelle version.

## Invariants
- Maintenance, « terminé » pour un serveur : la version qui tourne (celle du service, lue au démarrage) atteint la version cible X.Y du lot. Le serveur de test passe par la version de dev qui porte le lot, encore en maintenance.
- L'annonce ne vient que d'une vraie mise à jour (`envoi` → `termine`), jamais d'une simulation ni de `manuel` (la page « Mise à jour » doit rester ouverte pour en donner les valeurs). Le service du site de dev la publie (lot, version cible) dans le dossier partagé (`MAVERICK_MAINTENANCE`, le `maintenance/` du serveur normal monté dans les deux instances) ; la production la lit et n'écrit rien.
- Échec, annulation, « Lever la maintenance » ou 4 h (`DUREE_MAX_MAINTENANCE`) retirent l'annonce.
- La minuterie du site de dev suit le run et republie l'annonce : personne n'est sur ses pages, qui renvoient vers `/maintenance/`.
- Le script de chaque page (`Base.astro`, demande `/api/maintenance/`) est en ligne (aucun module partagé), absent de la version portable et de `/maintenance/`. `lib/maintenance-retour.mjs` ne ramène qu'à une page de ce site.
- Les feuilles de `/maintenance/` n'écrivent aucune couleur (`test/palette-css.test.mjs`).

## Tests
- `serveur-maintenance` ; `test/site-html.test.mjs` exécute le script de maintenance de chaque page dans un faux navigateur et vérifie que `/maintenance/` n'a ni `style=` ni feuille de palette.

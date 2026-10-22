---
name: ui-defilement
description: "Défilement sur tout le site : au bout d'un panneau, la molette fait défiler la page ; pas d'overscroll-behavior vertical ni d'écouteur wheel bloquant hors des exceptions de test/defilement.test.mjs ; panneau remis en haut. À charger avant de toucher au défilement d'un panneau."
paths: ["client/test/defilement.test.mjs", "client/src/styles/global/infobulles.css", "client/src/styles/debug/schema.css", "client/src/styles/chronologie/chronologie.css", "client/src/styles/armes/armes.css", "client/src/styles/armures/armures.css", "client/src/styles/bestiaire/bestiaire.css", "client/src/scripts/portrait.mjs", "client/src/scripts/debug-schema.mjs", "client/src/scripts/bestiaire.mjs"]
user-invocable: false
---
# Défilement

Au bout du défilement d'un panneau de la page (fiche d'une arme, d'une armure, carte d'un monstre, encart d'un accessoire…), la molette fait défiler la page entière. Demande du propriétaire : « Il faut que ce problème ne se reproduise nulle part ».

## À lire
- `docs/content-guide.md`, « Armes » et « Armures et boucliers » (la molette passe à la page au bout du panneau).
- `docs/bestiaire.md`, paragraphe « Défilement » (tableau et carte, défilement d'abord de la page).

## Invariants
- Jamais d'`overscroll-behavior` qui retient l'axe vertical (`contain` ou `none`), en CSS ou posé par un script.
- Jamais d'écouteur `wheel` qui empêche la molette.
- Exceptions admises, chacune listée avec sa raison dans `client/test/defilement.test.mjs` :
  - une surcouche posée par-dessus la page (bulle, fenêtre modale, tiroir, panneau en plein écran d'un écran étroit), reconnue à son fichier, son `@media` et son sélecteur exacts (liste `SURCOUCHES` : bulle de `styles/global/infobulles.css`, fenêtre de `styles/debug/schema.css`, tiroir de `styles/chronologie/chronologie.css`, plein écran étroit de `styles/armes/armes.css`, `styles/armures/armures.css` et `styles/bestiaire/bestiaire.css`) ;
  - un écouteur justifié (liste `ECOUTEURS`) : zoom du portrait (`scripts/portrait.mjs`) et du schéma (`scripts/debug-schema.mjs`), défilement d'abord de la page du bestiaire (`scripts/bestiaire.mjs`).
- Une nouvelle exception s'inscrit dans le test avec sa raison ; sinon elle n'existe pas.
- `overscroll-behavior-x` / `-inline` (glissement horizontal) n'est pas concerné.
- Un panneau toujours affiché qui passe à un autre objet (arme, armure, bouclier, carte de monstre) remonte en haut : `scrollTo({ top: 0 })` (`scripts/armes.mjs`, `scripts/armures.mjs`) ou `scrollTop = 0` (`scripts/bestiaire.mjs`).

## Tests
- `client/test/defilement.test.mjs` : lit toutes les sources de `client/src/` (feuilles, styles en ligne, scripts) et compare aux listes `SURCOUCHES` et `ECOUTEURS`.

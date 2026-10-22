---
name: ui-defilement
description: "Défilement sur tout le site : au bout d'un panneau, la molette fait défiler la page ; pas d'overscroll-behavior vertical ni d'écouteur wheel bloquant hors des exceptions de test/defilement.test.mjs ; panneau remis en haut ; aucun glissement du doigt, retour arrière au glissement horizontal empêché (html, feuille globale). À charger avant de toucher au défilement d'un panneau."
paths: ["client/test/defilement.test.mjs", "client/src/styles/global/base.css", "client/src/styles/global/infobulles.css", "client/src/styles/debug/schema.css", "client/src/styles/chronologie/chronologie.css", "client/src/styles/armes/armes.css", "client/src/styles/armures/armures.css", "client/src/styles/bestiaire/bestiaire.css", "client/src/scripts/portrait.mjs", "client/src/scripts/debug-schema.mjs", "client/src/scripts/bestiaire.mjs"]
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
- `overscroll-behavior-x` / `-inline` (glissement horizontal) n'est pas concerné par la règle de la molette.
- Glissement du doigt (réponses du propriétaire du 2026-10-22 : « Le slide du doigt devrai faire changer d'onglet », puis « Laisse tomber. Trop de cas spécifiques compliquées. Supprime juste le swipe. ») :
  - aucun sur le site : jamais d'écouteur `touchmove`, `touchend` ni `touchcancel` (un `touchstart` seul, qui annonce un appui, reste permis : le chargement anticipé de « Exporter » de la fiche) ;
  - le retour arrière du navigateur au glissement horizontal est empêché pour tout le site, une seule fois : `html { overscroll-behavior-x: none; }` dans `styles/global/base.css` (l'axe horizontal seul) ; aucune autre source ne la pose sur `html` ;
  - sur iOS, le geste qui part du bord de l'écran est celui du système : aucune règle CSS ne le bloque (écrit dans `docs/content-guide.md` et `docs/chronologie.md`) ;
  - le défilement natif d'une piste au doigt (carrousel de l'accueil, `overscroll-behavior-x: contain` de sa piste) n'est pas un glissement du doigt.
- Un panneau toujours affiché qui passe à un autre objet (arme, armure, bouclier, carte de monstre) remonte en haut : `scrollTo({ top: 0 })` (`scripts/armes.mjs`, `scripts/armures.mjs`) ou `scrollTop = 0` (`scripts/bestiaire.mjs`).

## Tests
- `client/test/defilement.test.mjs` : lit toutes les sources de `client/src/` (feuilles, styles en ligne, scripts) et compare aux listes `SURCOUCHES` et `ECOUTEURS` ; il épingle aussi l'absence de glissement du doigt et la règle de `html`.
- `client/test/site-html.test.mjs` : la règle dans la feuille globale construite, sur toutes les pages (site construit).

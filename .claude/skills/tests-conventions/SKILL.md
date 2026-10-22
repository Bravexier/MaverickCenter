---
name: tests-conventions
description: "Règles d'écriture des tests du projet (client/test/, node:test) — un test par logique nouvelle, valeurs d'import lues dans l'historique, notes de version en attente, tests du service, tests du site construit. Préchargé par l'équipe technique ; à charger avant d'écrire ou de corriger un test."
user-invocable: false
---

# Conventions des tests

- **Un test par logique.** Toute logique de règle ou de lien nouvelle a son test dans `client/test/` (`node:test`, `npm test`). Une décision appliquée est épinglée par un test qui cite son numéro (`R41`).
- **Le site de dev est la source de ce qu'il modifie** (décision du propriétaire).
  - Un test qui épingle une valeur de l'import (effectif, texte cité, liste du classeur) la lit par `client/src/lib/historique-site.mjs` (`valeurDImport`, `lignesDImport`, `effectifDImport`, table `historique_modification`).
  - L'état courant, lui, se contrôle par des invariants de cohérence, jamais par la valeur figée de l'import.
- **Tests du service.** Ils lisent l'état avant d'écrire et prennent des noms absents de la base (`docs/serveur.md`, « Mise à jour »).
- **Note de version en attente.** Un test qui lit `data/rows` doit tenir avec une note en attente de livraison (pendant une mise à jour, ou sur `dev` avant la livraison). Pour cela, il :
  - applique un lot à une copie sans elle (`test/aide-mise-a-jour.mjs#copieSansNoteEnAttente`) ;
  - écrit une note à une version libre (`versionLibre`) ;
  - saute la section 15 quand il balaie tout le texte de la base (`lib/notes-de-version.mjs#TABLES_DES_NOTES`).
- **Site construit.** Les tests `*-html.test.mjs` contrôlent le site construit (`dist/`). Ils se sautent sans `dist/`, et la CI les lance après le build : lancer `npm run build` avant eux quand le rendu change.
- **Textes balisés.** Un test qui compare un texte « tel qu'écrit » à une sortie qui retire les balises du glossaire lit ce texte sans elles (`texteSansBalises`), ou rend ses balises comme le middleware (`htmlAvecMotsCles`) (`zone-mots-cles`).
- **Vocabulaire.** Les tests du vocabulaire créent leurs mots-clés d'essai (`test/aide-mots-cles.mjs`).
- **Base d'essai.** Un test écrit dans une copie de la base, jamais dans `var/maverick.db` ni dans `data/rows`.
- **Jamais** sauter, désactiver ni mettre en quarantaine un test pour obtenir du vert.

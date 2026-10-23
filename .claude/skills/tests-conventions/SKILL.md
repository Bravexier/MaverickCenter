---
name: tests-conventions
description: "Règles d'écriture des tests du projet (client/test/, node:test) — un test par logique nouvelle, valeurs d'import lues dans l'historique, notes de version en attente, tests du service, tests du site construit. Préchargé par l'équipe technique ; à charger avant d'écrire ou de corriger un test."
user-invocable: false
---

# Conventions des tests

- **Un test par logique.** Toute logique de règle ou de lien nouvelle a son test dans `client/test/` (`node:test`). Ce qui se lance après, c'est la sélection pertinente, pas la suite entière : skill `choisir-les-tests`. Une décision appliquée est épinglée par un test qui cite son numéro (`R41`).
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
- **Dossiers temporaires.** Un test fait le ménage quand il a fini, même en cas d'échec (demande du propriétaire, 2026-10-23). Ses dossiers et fichiers temporaires (copies de base, exports, faux dépôts) viennent de `test/aide-dossier-temporaire.mjs` :
  - `dossierTemporaire(prefixe, { t })` le supprime à la fin du test `t` (contexte d'un test, ou de `beforeEach` pour un dossier par cas) ;
  - sans `t`, il est supprimé à la sortie du processus du fichier, après ses hooks `after` ;
  - `fichierTemporaire(nom, prefixe, options)` donne un chemin dans un dossier neuf, `dans` place le dossier sous un autre ;
  - `variablesTemporaires(dossier)` donne le dossier de l'aide à un script, un outil ou un service lancé par le test (`TMPDIR`).
  - Le garde-fou `test/dossiers-temporaires.test.mjs` refuse dans `client/test/` tout `mkdtemp`, `os.tmpdir()`, chemin `/tmp`, `/var/tmp` ou `/dev/shm`, lecture de `TMPDIR` (destructuration comprise), `tempfile` dans un `.py` ou `mktemp` dans un `.sh` hors de l'aide. Une exception s'y inscrit avec sa raison.
  - Un fichier qui crée beaucoup de copies (`serveur-base-vivante`) en prend un dossier par cas.
- **Jamais** sauter, désactiver ni mettre en quarantaine un test pour obtenir du vert.

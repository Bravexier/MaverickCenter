---
name: site-version-portable
description: "Modules de src/lib sans dépendance navigateur/Astro, code DOM dans src/scripts, jamais deux scripts de page qui importent le même module ; version portable claude.ai (tools/build-artifact.mjs). À charger avant de lire, modifier ou relire un module de lib, un script de page ou build-artifact."
paths: ["tools/build-artifact.mjs", "client/src/scripts/*.mjs", "client/src/lib/accessoires-generateur.mjs", "client/src/lib/arme-forge.mjs", "client/src/lib/armes-filtres.mjs", "client/src/lib/armure-forge.mjs", "client/src/lib/armures-tri.mjs", "client/src/lib/bestiaire-filtres.mjs", "client/src/lib/creature-npm.mjs", "client/src/lib/debug-journaux.mjs", "client/src/lib/debug-metriques.mjs", "client/src/lib/debug-schema.mjs", "client/src/lib/degats-texte.mjs", "client/src/lib/fiche-controles.mjs", "client/src/lib/fiche-format.mjs", "client/src/lib/fiche-moteur.mjs", "client/src/lib/fiche-tableur-cases.mjs", "client/src/lib/fiche-tableur-export.mjs", "client/src/lib/fiche-tableur-import.mjs", "client/src/lib/google-sheets.mjs", "client/src/lib/liste-choix.mjs", "client/src/lib/maintenance-retour.mjs", "client/src/lib/monnaies.mjs", "client/src/lib/notes-de-version-rendu.mjs", "client/src/lib/personnages-liste.mjs", "client/src/lib/portrait.mjs", "client/src/lib/recherche-mots-cles.mjs", "client/src/lib/search.mjs", "client/src/lib/sort-cout.mjs", "client/src/lib/sort-maitrise.mjs", "client/src/lib/tableur-ecriture.mjs", "client/src/lib/tableur-lecture.mjs", "client/src/lib/tableur-mesure.mjs", "client/src/lib/text.mjs", "client/src/lib/xml-mini.mjs", "client/src/lib/zip.mjs", "client/src/lib/tipeee.mjs", "client/src/lib/conflits-rendu.mjs"]
user-invocable: false
---
# Modules, scripts de page et version portable

## Fichiers

- `client/src/lib/*.mjs` : la logique pure, partagée par le build, le service et le navigateur.
- `client/src/scripts/` : le code qui touche au DOM d'une page (`fiche.mjs`, `personnages.mjs`…).
- `tools/build-artifact.mjs` : la version « portable » du site (liens relatifs, CSS et JS en ligne), publiée comme page privée claude.ai. Le détail est dans le commentaire de tête du script.

## Invariants

- `src/lib/*.mjs` reste sans dépendance navigateur ni Astro. `text.mjs`, `search.mjs`, `fiche-moteur.mjs`, `fiche-format.mjs`, `personnages-liste.mjs`, `liste-choix.mjs` sont importés côté navigateur. `wikilinks.mjs` utilise `node:fs` et ne doit pas l'être.
- Un module qu'un script de page de `src/scripts/*.mjs` importe, directement ou par un autre module, est importé côté navigateur.
- Le code qui touche au DOM d'une page va dans `src/scripts/`, jamais dans `src/lib/`.
- Deux scripts de page ne doivent jamais importer le même module : Vite en ferait un module partagé, que la version portable refuse (`tools/build-artifact.mjs` lève « importe un autre module : inlining impossible » ; la CI construit la version portable, `.github/workflows/ci.yml`). Plusieurs tests de zone épinglent les imports de leur script (par exemple `test/armes-html.test.mjs`, `test/recherche-mots-cles.test.mjs`) ; les exceptions et règles d'import propres à une zone sont dans son skill.
- Un composant partagé (par exemple `components/Onglets.astro`, skill `ui-onglets`) se réutilise comme composant, pas comme module importé par deux scripts. Un script de page sans import peut être posé par un composant partagé entre deux pages (`scripts/pieces-elementaires.mjs`, posé par `components/equipement/PiecesElementaires.astro` sur Armes et Armures) : Astro l'écrit alors en ligne.
- `lib/tipeee.mjs` n'est importé que par `scripts/tipeee.mjs` (l'accueil ; aussi par le service et le build) ; `lib/conflits-rendu.mjs` (et `lib/notes-de-version-rendu.mjs`) que par `scripts/mise-a-jour.mjs`, qui n'importe ni `lib/edition-modele.mjs` ni `lib/markdown-edition.mjs` (la chaîne de l'édition les importe), ni `lib/libelles-de-la-base.mjs` (il importe `TABLES` : les noms des tables et colonnes viennent du service) ; son graphe d'imports est épinglé par `test/mise-a-jour-conflits.test.mjs`.

## Publication claude.ai

Commande : `node tools/build-artifact.mjs --out <dossier>`. Elle impose :

- `HIDE_EXAMPLES=1` (sans les pages de démonstration) ;
- liens relatifs, avec `index.html` explicite pour un lien de répertoire ;
- accueil écrit en fragment (sans `<html>`, `<head>`, `<body>`) : `<dossier>/main.html`, le reste dans `<dossier>/files/` ;
- aucun script ni CSS externe (CSS en ligne par `INLINE_CSS=1`, scripts mis en ligne ; un script qui en importe un autre est refusé) ;
- ni impression ni téléchargement : les boutons Télécharger, Exporter et Importer (en ligne) de la fiche sont masqués, Importer (PC) reste ;
- au plus 255 fichiers par publication : le script écrit des listes `batch-N.json` (250 fichiers au plus chacune).

Ce que la version portable n'emporte pas (le service `_serveur/`, l'édition, la page Debug, le script de maintenance…) est dit dans le skill de chaque zone (skill `zone-service`, skill `zone-edition`, skill `zone-debug-metriques`, skill `zone-mise-a-jour`).

## Tests

- La CI lance `node ../tools/build-artifact.mjs --out "$RUNNER_TEMP/artifact"` (`.github/workflows/ci.yml`).

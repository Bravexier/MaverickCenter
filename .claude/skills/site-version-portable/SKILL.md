---
name: site-version-portable
description: "Modules de src/lib sans dépendance navigateur/Astro, code DOM dans src/scripts, jamais deux scripts de page qui importent le même module ; version portable claude.ai (tools/build-artifact.mjs). À charger avant de lire, modifier ou relire un module de lib, un script de page ou build-artifact."
paths: ["tools/build-artifact.mjs", "client/src/scripts/*.mjs", "client/src/lib/accessoires-generateur.mjs", "client/src/lib/arme-forge.mjs", "client/src/lib/armes-filtres.mjs", "client/src/lib/armure-forge.mjs", "client/src/lib/armures-tri.mjs", "client/src/lib/bestiaire-filtres.mjs", "client/src/lib/creature-npm.mjs", "client/src/lib/debug-atelier.mjs", "client/src/lib/debug-atelier-page.mjs", "client/src/lib/debug-journaux.mjs", "client/src/lib/debug-metriques.mjs", "client/src/lib/debug-schema.mjs", "client/src/lib/debug-structure.mjs", "client/src/lib/degats-texte.mjs", "client/src/lib/fiche-controles.mjs", "client/src/lib/fiche-copie.mjs", "client/src/lib/fiche-format.mjs", "client/src/lib/fiche-moteur.mjs", "client/src/lib/fiche-tableur-cases.mjs", "client/src/lib/fiche-tableur-export.mjs", "client/src/lib/fiche-tableur-import.mjs", "client/src/lib/google-sheets.mjs", "client/src/lib/liste-choix.mjs", "client/src/lib/maintenance-retour.mjs", "client/src/lib/monnaies.mjs", "client/src/lib/notes-de-version-rendu.mjs", "client/src/lib/personnages-liste.mjs", "client/src/lib/portrait.mjs", "client/src/lib/recherche-mots-cles.mjs", "client/src/lib/search.mjs", "client/src/lib/sort-cout.mjs", "client/src/lib/sort-maitrise.mjs", "client/src/lib/tableur-ecriture.mjs", "client/src/lib/tableur-lecture.mjs", "client/src/lib/tableur-mesure.mjs", "client/src/lib/text.mjs", "client/src/lib/xml-mini.mjs", "client/src/lib/zip.mjs", "client/src/lib/tipeee.mjs", "client/src/lib/conflits-rendu.mjs", "client/src/lib/lots-rendu.mjs"]
user-invocable: false
---
# Modules, scripts de page et version portable

## Fichiers

- `client/src/lib/*.mjs` : la logique pure, partagée par le build, le service et le navigateur.
- `client/src/scripts/` : le code qui touche au DOM d'une page (`fiche.mjs`, `personnages.mjs`…).
- `tools/build-artifact.mjs` : la version « portable » du site (liens relatifs, CSS et JS en ligne), publiée comme page privée claude.ai. Le détail est dans le commentaire de tête du script.

## Invariants

- `src/lib/*.mjs` reste sans dépendance navigateur ni Astro. `text.mjs`, `search.mjs`, `fiche-moteur.mjs`, `fiche-format.mjs`, `fiche-copie.mjs` (pur ; seulement `scripts/fiche.mjs`, qui en a la règle de « Copier le prétiré », R320), `personnages-liste.mjs` (qui a la sienne), `liste-choix.mjs` sont importés côté navigateur, comme `adresses-renommees.mjs` (sans import : `Base.astro` l'écrit dans `#adresses-renommees`, la chaîne de l'édition l'installe une fois ; jamais deux lectures mêlées côté service). `wikilinks.mjs` utilise `node:fs` et ne doit pas l'être ; `wikilinks-remark.mjs` et `markdown-rendu.mjs` (purs) sont importés par la chaîne de l'édition, absente du portable.
- Un module qu'un script de page de `src/scripts/*.mjs` importe, directement ou par un autre module, est importé côté navigateur.
- Le code qui touche au DOM d'une page va dans `src/scripts/`, jamais dans `src/lib/`.
- Deux scripts de page ne doivent jamais importer le même module : Vite en ferait un module partagé, que la version portable refuse (`tools/build-artifact.mjs` lève « importe un autre module : inlining impossible » ; la CI construit la version portable, `.github/workflows/ci.yml`). Plusieurs tests de zone épinglent les imports de leur script (par exemple `test/armes-html.test.mjs`, `test/recherche-mots-cles.test.mjs`) ; les exceptions et règles d'import propres à une zone sont dans son skill.
- Deux scripts de page partagent une donnée par un contrat de données, jamais par un module commun : une propriété globale et un événement sur `document` (`scripts/compte.mjs` publie la réponse de `GET /api/moi/` dans `window.maverickMoi` et `maverick:moi`, que `scripts/personnages.mjs` lit ou attend, puis le niveau vu du menu dans `window.maverickNiveau` et `maverick:niveau`, que lit le script en ligne de `components/MenuDuSite.astro`). Forme admise, qui ne contrevient pas à la règle précédente.
- Un composant partagé (par exemple `components/Onglets.astro`, skill `ui-onglets`) se réutilise comme composant, pas comme module importé par deux scripts. Un script de page sans import peut être posé par un composant partagé entre deux pages (`scripts/pieces-elementaires.mjs`, posé par `components/equipement/PiecesElementaires.astro` sur Armes et Armures) : Astro l'écrit alors en ligne.
- `lib/tipeee.mjs` n'est importé que par `scripts/tipeee.mjs` (l'accueil ; aussi par le service et le build) ; `lib/conflits-rendu.mjs`, `lib/lots-rendu.mjs` (et `lib/notes-de-version-rendu.mjs`) que par `scripts/mise-a-jour.mjs` (`conflits-rendu.mjs` recopie donc la règle de `fauteDeFormeDeLUrl` sans l'importer), qui n'importe ni `lib/edition-modele.mjs` ni `lib/markdown-edition.mjs` (la chaîne de l'édition les importe), ni `lib/libelles-de-la-base.mjs` (il importe `TABLES` : les noms des tables et colonnes viennent du service) ; son graphe d'imports (4 modules : `conflits-rendu`, `diff-replie`, `lots-rendu`, `notes-de-version-rendu`) est épinglé par `test/mise-a-jour-conflits.test.mjs`. `scripts/glossaire.mjs` n'importe que `lib/glossaire-filtre.mjs`, qui n'importe rien (skill `zone-glossaire`).
- `scripts/acces.mjs` (accès au site de dev, R310) n'importe rien ; `components/Acces.astro` le pose depuis `layouts/Base.astro`, dans `<head>` avant les scripts de page, et il enveloppe `fetch` pour les adresses `/api/` de même origine : sur un refus, il montre un avis (plus de fenêtre). Il recopie les libellés de niveau de `lib/compte.mjs` ; `test/acces-navigateur.test.mjs` vérifie l'accord. Absent de la version portable (skill `zone-service`).
- Le bouton « Copier le prétiré » (R320) exige un compte : `#fiche-copier` reste caché dans la version portable, qui n'en a pas (`test/copie-du-pretire.test.mjs`).
- `scripts/compte.mjs` (le compte, `/profil/`, `/connexion/` ; skill `zone-menu`) est le seul à importer `lib/compte.mjs`, et lui aussi est absent de la version portable : `tools/build-artifact.mjs` ignore `profil/` et `connexion/`. Test : `test/compte.test.mjs`.
- `components/MenuDuSite.astro` et `components/MenuDuProfil.astro` ont chacun un script en ligne, sans import ; `lib/menu-rendu.mjs` n'est lu qu'au build (jamais par un script de page). La version portable ne pose que `MenuDuProfil` (le petit menu Glossaire et Recherche, sans lien vers `/profil/` ni Debug) et n'a que le menu d'un Observateur : rubriques et entrées à `niveau` retirées au build (`entreesVisibles(..., { sansNiveau })`). Skill `zone-menu`.
- `lib/debug-atelier-page.mjs` n'est importé que par `scripts/debug-atelier.mjs` ; `lib/debug-atelier.mjs` l'est par ce script et par le service (`serveur/atelier.mjs`), jamais par un autre script de page.
- `lib/debug-structure.mjs` est un module pur, importé seulement par `scripts/debug-structure.mjs`, troisième script de la page Debug (avec `debug.mjs` et `debug-schema.mjs` : skill `zone-debug-metriques`).
- `lib/valeurs-fermees-rendu.mjs` (les types de dégâts et les magies en balises du glossaire, skill `zone-mots-cles`) est pur (sans dépendance navigateur ni Astro) ; aucun script de page ne l'importe lui-même, il n'atteint le navigateur que par les rendus partagés (`armes-rendu.mjs` importé par `scripts/edition/armes.mjs`, `edition-rendu.mjs` par `editeur.mjs`), dans la chaîne de l'édition absente du portable.

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

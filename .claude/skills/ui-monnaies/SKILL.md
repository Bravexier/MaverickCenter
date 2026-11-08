---
name: ui-monnaies
description: "Monnaies en icônes partout (R61, R63) : lib/monnaies.mjs, plugin remark lib/markdown-monnaies.mjs, styles/global/monnaies.css (.piece), montant décomposé PP / RO / RF, data-montant et data-monnaie. À charger avant de lire, modifier ou relire un affichage de prix ou de monnaie."
paths: ["client/src/lib/monnaies.mjs", "client/src/lib/markdown-monnaies.mjs", "client/src/styles/global/monnaies.css", "client/test/monnaies.test.mjs", "client/test/monnaies-html.test.mjs"]
user-invocable: false
---
# Monnaies en icônes

## Fichiers
- `client/src/lib/monnaies.mjs` : `htmlAvecMonnaies`, `htmlDeMontant`, `htmlDePiece`, `morceauxDeMonnaie`, `MONNAIES_DU_JEU`. PP diamant, RO pièce d'or, RF pièce de fer trouée ; nom et valeur en infobulle.
- `client/src/styles/global/monnaies.css` : les dessins ; `.piece` est l'icône (`display: inline-block`).
- `client/src/lib/markdown-monnaies.mjs` : plugin remark pour le Markdown.

## À lire
- `docs/decisions-regles.md`, R61, R63 (et R79 : prix sans monnaie écrite des armures et boucliers, des RO par exception).
- `docs/content-guide.md`, « Composants » (Monnaie) et « Armures et boucliers » (tuiles des fiches).

## Choix du propriétaire
- R61 : dans toutes les tables, les abréviations deviennent des icônes. Les valeurs ne se modifient pas (`MONNAIES_DU_JEU`, comparées à la base). R219 (3) : l'onglet Monnaie est figé, plus aucune monnaie ne se crée, ne se modifie (abréviation comprise) ni ne se supprime sur le site (skill `zone-composants`).
- R63 : partout, texte courant compris, les abréviations deviennent des icônes, et un montant s'affiche décomposé dans les trois monnaies : « 1245,5 » RO affiché « 1 [PP] 245 [RO] 50 [RF] ». Affichage seulement : le texte de la base ne change pas.

## Où c'est appliqué
- Rendus des tables : armes, accessoires, composants, bourse de la fiche.
- Markdown : `lib/markdown-monnaies.mjs`, sur tout le texte sauf liens et code. Dans un tableau, une colonne dont l'en-tête écrit l'unité (« Coût(RO) ») lit ses nombres seuls comme des montants.
- Glossaire (R63, R183 (9)) : le titre d'une bulle (`mots-cles-balises.mjs#htmlDuNomDuMotCle`) montre le libellé suivi de l'icône du mot-clé (`mot_cle.icone`, R235 : RF, RO, PP ; skill `zone-mots-cles`), sans « (RO) » ; sa définition, le texte affiché d'une balise (`{{RO}}`), le mode complet et les bulles passent par `htmlAvecMonnaies` (`htmlDeLaBalise`). Un montant écrit dans une balise se décompose comme ailleurs (R183 (12), « Décomposer comme ailleurs » : `{{prix-fixe|1245,5 RO}}` → « 1 [PP] 245 [RO] 50 [RF] », écriture d'origine dans `data-montant`) ; une conversion écrite ne se décompose pas ; dans un attribut, c'est le texte simple. Même nom dans la pastille et la définition rendue de `/recherche/` (`htmlDeLaPastille`, `htmlDeLaDefinition`, rendues au build : `scripts/recherche.mjs` les recopie, sans importer `monnaies.mjs`) ; le Glossaire montre l'icône seule, dans sa première colonne (R235 (2), `htmlDeLaLigneDuGlossaire`).
- Le plugin est déclaré dans `client/astro.config.mjs` ET `client/src/lib/guide-rendu.ts` (et dans `test/markdown-edition.test.mjs`) : les trois restent d'accord.

## Invariants
- Un montant décomposé garde son écriture d'origine dans `data-montant`, une icône seule dans `data-monnaie` : `lib/markdown-edition.mjs` les relit tels qu'écrits.
- « 100 RF / 1 RO » (même somme) n'en fait qu'un.
- Une conversion (« 1 PP = 1 000 RO ») ne se décompose pas.
- Un nombre sans monnaie écrite reste un nombre (exception R79 : skill `zone-armures`).
- Le passage Markdown garde une balise du glossaire (« {{clé|10 RO}} ») entière, rien n'y est lu (`morceauxDeMonnaie`, sans importer `mots-cles-balises.mjs`) ; la monnaie de son texte affiché est rendue après, par `htmlDeLaBalise`.
- Un script de page n'importe pas `monnaies.mjs` (ce serait un module partagé entre scripts de page : skill `site-version-portable`), sauf `src/scripts/accessoires.mjs`, le seul à l'importer (prix calculés et prix écrit du niveau d'une compétence ; testé).
- La page des armes décompose par `lib/arme-forge.mjs#piecesDuMontant` (même calcul, testé) avec les icônes de ses `<template data-armes-piece>`. `lib/armure-forge.mjs` a aussi un `piecesDuMontant` pour la page des armures.
- `.piece` est une classe globale : ne jamais nommer ainsi une autre classe (une ligne de tableau ainsi nommée s'écrase).

## Tests
- `client/test/monnaies.test.mjs`, `client/test/monnaies-html.test.mjs`, `client/test/markdown-edition.test.mjs`, `client/test/armure-forge.test.mjs`, `client/test/accessoires-html.test.mjs`.

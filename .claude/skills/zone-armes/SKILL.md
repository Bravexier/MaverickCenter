---
name: zone-armes
description: "Onglet Armes de /ressources/equipement/ : tableaux par famille tirés des tables arme, materiau_arme, amelioration_equipement ; arme-champs, arme forgée (R49, R51), filtres, création et suppression sur le site de dev (R52), corps Markdown. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/armes-db.mjs", "client/src/lib/arme-champs.mjs", "client/src/lib/armes-rendu.mjs", "client/src/lib/arme-forge.mjs", "client/src/lib/armes-filtres.mjs", "client/src/lib/corps-armes.mjs", "client/src/lib/materiaux-couleurs.mjs", "client/src/components/armes/**", "client/src/scripts/armes.mjs", "client/src/styles/armes/**", "client/serveur/edition-armes.mjs", "client/src/scripts/edition/armes.mjs", "client/test/arme*.test.mjs", "client/test/corps-armes.test.mjs", "client/test/serveur-edition-armes.test.mjs", "client/test/materiaux-couleurs.test.mjs"]
user-invocable: false
---
# Armes

## Fichiers
- Lecture : `lib/armes-db.mjs` ; découpage de l'effet : `lib/arme-champs.mjs` (`COMPETENCES_PAR_ECRITURE`) ; arme forgée : `lib/arme-forge.mjs` ; filtres : `lib/armes-filtres.mjs`.
- Rendu : `components/armes/ArmesPage.astro` (dans `components/equipement/EquipementPage.astro`), `TableauArmes.astro`, cellules `lib/armes-rendu.mjs` (`htmlDeLigneDArme`, `avecPhraseDesArmesDeDepart`), CSS `styles/armes/armes.css`.
- Script de page : `src/scripts/armes.mjs`. Corps Markdown : `lib/corps-armes.mjs`. Couleurs des matériaux : `lib/materiaux-couleurs.mjs`.
- Site de dev : service `serveur/edition-armes.mjs`, extension `src/scripts/edition/armes.mjs`.
- Page et onglets, panneau de règles : skill `zone-equipement`.

## À lire
- `docs/content-guide.md`, « Armes (onglet Armes de `/ressources/equipement/`) » (colonnes, compétence, filtre, panneau de l'arme, mode modification).
- `docs/serveur.md`, « Édition » ; décisions R45, R48 à R52, R62, R91 dans `docs/decisions-regles.md`.

## Invariants
- Rendue depuis les tables (`arme`, `materiau_arme`, `amelioration_equipement`) par `ArmesPage.astro`, jamais depuis son Markdown ; pas de tableau Markdown. Ses règles sont le panneau de règles `armes` (migration 0056 ; skill `zone-equipement`).
- Les colonnes tirées de l'effet (dégâts, types, portée, durabilité, origine, effets supplémentaires) viennent de `lib/arme-champs.mjs`, qui refait aussi les colonnes typées, `arme_degats` et `arme_prerequis` à chaque modification. `test/arme-champs.test.mjs` le rejoue sur toute la base : un changement du découpage doit redonner la base, sinon migration.
- Les cellules sont les rendus de `lib/armes-rendu.mjs` (via `edition-rendu.mjs#RENDUS`, comme les métiers) et portent en `data-…` les valeurs de l'arme forgée, que le script relit à chaque sélection.
- `src/scripts/armes.mjs` n'importe que `lib/arme-forge.mjs` et `lib/armes-filtres.mjs`, qu'aucun autre script de page n'importe (testé).
- Une arme = deux `<tr>` (`htmlDeLigneDArme`) : `tr.arme` (les colonnes) et `tr.arme-suite` (ses effets, juste après, cachée si vide). Ce qui touche une arme (survol, choix, filtre, ajout ou retrait en mode modification) touche les deux.
- Le corps Markdown de la page suit les tables ligne à ligne (`lib/corps-armes.mjs`, service et `recalculerLesPages`) : une ligne introuvable refuse le lot.
- Le filtre lit `data-competences` des lignes, pose la classe `est-filtree` ; rien en mode modification ni sans JavaScript.
- Échap ne ferme l'arme ouverte que si l'onglet Armes est affiché.
- Au bout du défilement du panneau de l'arme, la molette passe à la page (skill `ui-defilement`).
- La fiche de l'arme décompose le coût par `arme-forge.mjs#piecesDuMontant` et les icônes de ses `<template data-armes-piece>`, sans importer `monnaies.mjs` (skill `ui-monnaies`).

## Choix du propriétaire
- Un tableau repliable par famille, sans les armes de monstres (R45). Colonnes : Nom (description en infobulle), Compétence, Type, Dégâts, Type de dégâts, Portée (1 par défaut, R50), Solidité (le mot-clé du glossaire, définition en infobulle), Origine ; les effets supplémentaires sur une seconde ligne.
- Armes de départ : ligne en bleu, infobulle « Arme de départ ». Remarque : étoile ★ et infobulle ; vidée, elle part (R91).
- Compétence (R48) : `COMPETENCES_PAR_ECRITURE`, Arc et Arbalète à part, couleur de la caractéristique de la table `competence`. La pastille et le bouton du filtre portent la classe de la première caractéristique et la classe de second rang de la seconde, ou de la même (`palette-css.mjs#classesDeDeuxCaracteristiques`, skill `ui-couleurs`), jamais un style ; `armes.css` lit `--couleur`, `--couleur-2`, `--couleur-texte` ; `ArmesPage.astro` émet les seconds rangs des caractéristiques (`cssDesSecondsRangs('caracteristique')`). `armes-rendu.mjs` importe la palette : `scripts/armes.mjs` ne l'importe pas (il ne lit que `data-competences`) ; seuls les scripts de l'éditeur du site de dev, hors version portable, l'emportent (par `armes-rendu.mjs`, `edition-rendu.mjs` ou `composants-rendu.mjs` : skill `ui-couleurs`).
- Filtre par compétence (Lourde, Légère, Arc, Arbalète) et « Arme de départ » (`armes-filtres.mjs`, `?competence=`, `?depart=1`) ; une arme reste si l'une de ses compétences est choisie.
- Panneau de règles de l'onglet : tuiles Recharge longue, Recharge très longue et Mordhau (chacune la balise du mot-clé en mode complet, `{{recharge-longue:}}`), Dague, Arme de jet, prix. Les blocs gardent la mise en forme de la cellule A1 du classeur (italique, gras). « Les armes en bleu… » prend le bleu des armes de départ sur le HTML de son bloc (`lib/armes-rendu.mjs#avecPhraseDesArmesDeDepart`, classe `armes__phrase-depart`, aussi dans la surcouche du site de dev).
- Panneau de l'arme toujours affiché à côté, de la largeur de celui des armures. Cliquer une arme y remplit sa fiche : un seul cadre réduit, Fermer dedans ; trois tuiles (Dégâts, Solidité, Coût) dont le détail du calcul est l'infobulle (`[data-armes-bulles]`, hors du panneau qui défile) ; puis effets, description, origine.
- Dessous : matériaux (toute la ligne dans la couleur du matériau, `lib/materiaux-couleurs.mjs`, couleurs lues dans l'onglet « Armes » du classeur ; effets sur une ligne « +7 | … ») et améliorations (sans ligne Total).
- Arme forgée (R49, R51, `arme-forge.mjs`) : dégâts = dé + bonus de l'arme, du matériau et du niveau ; durabilité au moins 1 ; coût. État dans l'adresse : `?arme=…&materiau=…&amelioration=N`.
- Site de dev : tout se modifie sauf les matériaux, en lecture (leur seule source est la page Composants, R62 ; skill `zone-composants`). Pas de sélection en mode modification.
- Une arme se crée et se supprime (R52) : ligne `htmlDeLigneDArme` (la même pour la page construite et l'éditeur), ajoutée à la fin du tableau de sa famille et du corps Markdown ; supprimée, elle quitte les fiches (`serveur/fiches-retraits.mjs#RETRAITS`, note datée ; skill `zone-fiches-base`).
- Le nom d'un matériau d'arme est `ressource.nom` (partagé) : renommé, il change aussi dans les cases des tableaux des pages Armures et Bouclier (`corpsAvecMateriauRenomme`), pas dans les noms d'armures composés.
- La fiche de personnage calcule les mêmes dégâts (`degatsDArme`) : skill `zone-fiche`.

## Tests
- `test/arme-champs.test.mjs` (découpages rejoués sur toute la base), `corps-armes.test.mjs`, `arme-forge.test.mjs` (Espadon en titane +5 = D10+29, 620 RO et 3 titanes ou 1 220 RO), `armes-filtres.test.mjs`, `serveur-edition-armes.test.mjs`, `armes-html.test.mjs` (site construit), `materiaux-couleurs.test.mjs` (chaque matériau d'arme de la base a sa couleur, aucune clé ne vise un matériau absent).

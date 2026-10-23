---
name: ui-onglets
description: "Onglets partagés du site (components/Onglets.astro, motif « tabs » de l'ARIA) : HTML attendu, posé une fois par page, panneau fermé caché sous html.js, adresse et liens qui ouvrent l'onglet, évènements onglets:brancher et onglets:ouvrir. À charger avant de lire, modifier ou relire des onglets."
paths: ["client/src/components/Onglets.astro", "client/test/onglets-script.test.mjs"]
user-invocable: false
---
# Onglets

Un seul composant d'onglets pour tout le site. Son en-tête décrit le HTML attendu.

## Fichiers
- `client/src/components/Onglets.astro` : la classe `js` posée sur `<html>` et le script des onglets.
- Il est posé par : `classes/ClasseDons.astro` (spécialités d'une classe), `magie/SortsDuPotentiel.astro` (magies du Potentiel Illimité), `bestiaire/Bestiaire.astro`, `equipement/EquipementPage.astro` (avec, dans l'onglet Armes, les deux menus des familles d'armes : `armes/ArmesPage.astro` ; les sous-onglets de la ceinture et, dans Consommables, les onglets des familles : `ceinture/CeinturePanneau.astro`), `accessoires/AccessoiresPage.astro` (tableaux d'effets), `composants/ComposantsPage.astro`, `pages/fiche/index.astro` (zone IV).
- L'apparence des onglets est dans la feuille de chaque page.

## HTML attendu
- Un groupe `[data-onglets]` dont les onglets `.onglet` sont des liens vers leur panneau (`href="#id-du-panneau"`).
- L'onglet ouvert au départ porte `is-active`, de même que son panneau. La valeur de `data-onglets`, si elle est donnée, nomme la liste d'onglets.
- Le script pose les rôles ARIA (motif « tabs » : flèches gauche et droite, Début, Fin) ; les flèches, Début et Fin sautent un onglet `hidden` (une famille d'armes que le filtre vide).
- Choisir un onglet (clic, clavier) écrit son ancre dans l'adresse, sauf dans un groupe `data-onglets-sans-adresse` (les menus des armes : décision de la session principale, l'onglet choisi n'est pas écrit).
- Le script prend tous les `.onglet` d'un groupe, sous-groupes compris : un groupe dont un panneau contient des sous-onglets se limite à sa barre (page Équipement, dont la Ceinture, ses Consommables et les Accessoires ont leurs propres groupes : trois niveaux Équipement › Ceinture › Consommables).

## Invariants
- À poser une fois par page, avant les onglets : un seul script pour toute la page, que le build écrit dans la page.
- C'est un composant, pas un module importé : la version portable refuse un script qui en importe un autre (skill `site-version-portable`).
- Sans JavaScript, les onglets sont de simples liens et les panneaux se suivent. Le CSS de la page ne cache un panneau fermé que sous `html.js`, classe posée avant l'affichage (pas de saut de mise en page au chargement).
- Une adresse (au chargement, retour arrière) ou un lien de la page vers un panneau ou un élément qu'il contient ouvre son onglet. Des onglets dans un panneau d'onglet (sous-onglets de la ceinture, familles des consommables) : un lien vers un élément d'un sous-onglet ouvre tous les niveaux qui le contiennent.
- Des onglets dessinés après le chargement (mode modification, D11 : `src/scripts/edition/classes.mjs`) se branchent par l'évènement `onglets:brancher`, envoyé sur leur groupe ou un élément qui le contient. Aucun module n'est partagé entre les deux scripts.
- Un script de page ouvre l'onglet d'un panneau, ou d'un élément qu'il contient, par l'évènement `onglets:ouvrir` envoyé sur cet élément (`src/scripts/accessoires.mjs` : la propriété choisie ; `src/scripts/composants.mjs` et `src/scripts/armes.mjs` : si l'onglet ouvert n'a plus de ligne trouvée, le premier qui en a), sans toucher à l'adresse ni faire défiler la page. Avec `detail.dans` (un élément), seuls les groupes dont les panneaux sont dans cet élément s'ouvrent, pas les niveaux au-dessus (`src/scripts/armes.mjs` : l'onglet de la famille d'une arme, sans changer l'onglet de la page).
- Ce que chaque page fait de ses onglets (ordre, ancres, identifiants uniques) : le skill de sa zone (par exemple skill `zone-equipement`, skill `zone-composants`, skill `zone-classes`).

## Tests
- `test/equipement-html.test.mjs` : le script posé une fois sur la page Équipement, la barre de la page qui n'a que ses onglets, la liste des groupes.
- `test/onglets-script.test.mjs` : le script tel que le build l'écrit, dans un faux navigateur (groupe sans adresse, onglet caché sauté, `detail.dans`, adresse `#famille-…` sur deux niveaux ; site construit).
- Les tests du site construit des pages qui en ont (`classes-html`, `magies-html`, `equipement-html`, `armes-html`, `composants-html`, `fiche-html`, `accessoires-html`, `ceinture-html`, `bestiaire-html`) contrôlent leurs onglets.

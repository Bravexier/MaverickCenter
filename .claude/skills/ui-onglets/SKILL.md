---
name: ui-onglets
description: "Onglets partagés du site (components/Onglets.astro, motif « tabs » de l'ARIA) : HTML attendu, posé une fois par page, panneau fermé caché sous html.js, adresse et liens qui ouvrent l'onglet, évènements onglets:brancher (ré-entrant) et onglets:ouvrir, groupes `::: onglets` écrits dans un texte (R277). À charger avant de lire, modifier ou relire des onglets."
paths: ["client/src/components/Onglets.astro", "client/src/components/SupportDuMarkdown.astro", "client/src/lib/markdown-onglets.mjs", "client/src/lib/onglets-groupe.mjs", "client/src/lib/pose-unique.mjs", "client/src/scripts/edition/onglets.mjs", "client/src/styles/guide/onglets.css", "client/test/onglets-script.test.mjs", "client/test/onglets-markdown.test.mjs", "client/test/pose-unique.test.mjs"]
user-invocable: false
---
# Onglets

Un seul composant d'onglets pour tout le site. Son en-tête décrit le HTML attendu.

## Fichiers
- `client/src/components/Onglets.astro` : la classe `js` posée sur `<html>` et le script des onglets.
- Il est posé par : `classes/ClasseDons.astro` (spécialités d'une classe), `magie/SortsDuPotentiel.astro` (magies du Potentiel Illimité), `bestiaire/Bestiaire.astro`, `equipement/EquipementPage.astro`, qui le pose sur chacune des cinq pages de l'équipement (plus de barre d'onglets de page ni de groupe « Équipement ») avec, selon la page, les sous-onglets de la Ceinture et, dans Consommables, les onglets des familles (`ceinture/CeinturePanneau.astro`), les tableaux d'effets des Accessoires (`accessoires/AccessoiresPage.astro`), `composants/ComposantsPage.astro`, `pages/fiche/index.astro` (zone IV), `components/SupportDuMarkdown.astro` (les groupes `::: onglets` écrits dans un texte, ci-dessous).
- L'apparence des onglets est dans la feuille de chaque page ; celle des groupes écrits : `styles/guide/onglets.css`.

## HTML attendu
- Un groupe `[data-onglets]` dont les onglets `.onglet` sont des liens vers leur panneau (`href="#id-du-panneau"`).
- L'onglet ouvert au départ porte `is-active`, de même que son panneau. La valeur de `data-onglets`, si elle est donnée, nomme la liste d'onglets.
- Le script pose les rôles ARIA (motif « tabs » : flèches gauche et droite, Début, Fin) ; les flèches, Début et Fin sautent un onglet `hidden`.
- Choisir un onglet (clic, clavier) écrit son ancre dans l'adresse (demande du propriétaire : « On peut retenir l'onglet ouvert #epee par exemple »). Un groupe `data-onglets-sans-adresse` n'écrit pas l'onglet choisi : l'option reste (documentée en tête du composant, testée), sans usage aujourd'hui ; elle est relue à chaque choix.
- Le script prend tous les `.onglet` d'un groupe, sous-groupes compris : un groupe dont un panneau contient des sous-onglets se limite à sa barre (page Ceinture : deux niveaux Ceinture › Consommables).

## Invariants
- À poser une fois par page, avant les onglets : un seul script pour toute la page, que le build écrit dans la page. La règle passe par `lib/pose-unique.mjs#poserUneFois(Astro.locals, clé)`, partagé par `Onglets.astro` (script `js` en ligne) et `SupportDuMarkdown.astro` (feuille) : un groupe `::: onglets` dans un panneau de règles ou une page qui a déjà ses onglets ne pose rien deux fois (Astro ne dédouble que le script d'un même composant). Test : `test/pose-unique.test.mjs`.
- C'est un composant, pas un module importé : la version portable refuse un script qui en importe un autre (skill `site-version-portable`).
- Sans JavaScript, les onglets sont de simples liens et les panneaux se suivent. Le CSS de la page ne cache un panneau fermé que sous `html.js`, classe posée avant l'affichage (pas de saut de mise en page au chargement).
- Une adresse (au chargement, retour arrière) ou un lien de la page vers un panneau ou un élément qu'il contient ouvre son onglet. Des onglets dans un panneau d'onglet (sous-onglets de la Ceinture, familles des consommables) : un lien vers un élément d'un sous-onglet ouvre tous les niveaux qui le contiennent.
- Des onglets dessinés après le chargement (mode modification, D11 : `src/scripts/edition/classes.mjs`) se branchent par l'évènement `onglets:brancher`, envoyé sur leur groupe ou un élément qui le contient. Aucun module n'est partagé entre les deux scripts.
- `brancher` est ré-entrant : un groupe déjà branché qui reçoit `onglets:brancher` reprend ses onglets du moment (rôles ARIA, panneaux, ordre des flèches) ; les onglets ajoutés reçoivent leurs écouteurs, jamais deux fois ceux qui les avaient (`WeakSet`) ; l'onglet ouvert reste (classe `is-active`). Un groupe dont un onglet n'a pas encore son panneau n'est pas (re)branché.
- Un script de page ouvre l'onglet d'un panneau, ou d'un élément qu'il contient, par l'évènement `onglets:ouvrir` envoyé sur cet élément (`src/scripts/accessoires.mjs` : la propriété choisie ; `src/scripts/composants.mjs` : si l'onglet ouvert n'a plus de ligne trouvée, le premier qui en a), sans toucher à l'adresse ni faire défiler la page. Avec `detail.dans` (un élément), seuls les groupes dont les panneaux sont dans cet élément s'ouvrent, pas les niveaux au-dessus : l'option reste, sans usage aujourd'hui, comme `data-onglets-sans-adresse`.
- Ce que chaque page fait de ses onglets (ordre, ancres, identifiants uniques) : le skill de sa zone (par exemple skill `zone-equipement`, skill `zone-composants`, skill `zone-classes`).

## Onglets écrits dans un texte (R277)
- Un groupe `::: onglets` … `:::`, un `###` par onglet, `{couleur:<valeur>}` facultatif (valeur de la liste du glossaire : skill `ui-couleurs`) : syntaxe et rendu dans `lib/markdown-onglets.mjs` (plugin) et `lib/onglets-groupe.mjs` (disposition, classes, `htmlDuGroupe` pour l'aperçu de l'éditeur) ; la syntaxe est un choix technique de l'équipe, pas du propriétaire. `docs/content-guide.md`, « Des onglets et des couleurs dans un texte ».
- Disposition de la barre : `colonnesDeLaBarre(n)` (`data-colonnes`) : n colonnes si n ≤ 4, sinon 3 si n est multiple de 3, sinon 4 (R277 (4) : une rangée de 4 pour les tendances).
- `components/SupportDuMarkdown.astro` pose, pour les textes que la page rend, le composant `Onglets`, la feuille et les classes de couleur écrites, seulement si le texte a un groupe ou une couleur (plus `PageDuGuide`). Classes `onglets-md*`, `data-onglets-md` sur le groupe.
- Un panneau prend l'ancre figée comme `id`, son intertitre `titre-<ancre>` ; sans ancre, `onglet-<slug>`.
- Aperçu de l'édition : le clic passe par `scripts/edition/onglets.mjs#brancherLesOnglets`, qui pose `html.js` et la feuille (le script partagé n'est pas toujours sur la page). La barre est `data-ed-ignorer`, refaite d'après les panneaux (skill `zone-edition`).

## Tests
- `test/onglets-markdown.test.mjs` : plugin, disposition de la barre, ids, aller-retour de l'éditeur, plugin déclaré dans chaque chaîne Markdown.
- `test/equipement-html.test.mjs` : le script posé une fois sur chacune des cinq pages de l'équipement, la liste des groupes de chaque page (aucun sur Armes, Armures et Boucliers).
- `test/onglets-script.test.mjs` : le script tel que le build l'écrit, dans un faux navigateur (clic et flèche qui écrivent l'ancre, option sans adresse, chargement par `#famille-…` sur une page d'essai à deux niveaux, onglet caché sauté, `detail.dans`, re-branchement d'un groupe ; site construit).
- Les tests du site construit des pages qui en ont (`classes-html`, `magies-html`, `equipement-html`, `composants-html`, `fiche-html`, `accessoires-html`, `ceinture-html`, `bestiaire-html`, `guide-html`) contrôlent leurs onglets.

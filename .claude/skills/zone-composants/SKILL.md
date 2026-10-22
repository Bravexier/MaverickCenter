---
name: zone-composants
description: "Page /ressources/composants/ : un onglet par tableau (composant_onglet), monnaie, matériaux (seule source, R62), gemmes, bois, ingrédients d'alchimie, objets de l'inventaire, recherche, édition et corps des pages suivi. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/composants-db.mjs", "client/src/lib/composants-rendu.mjs", "client/src/lib/composants-champs.mjs", "client/src/lib/corps-composants.mjs", "client/src/components/composants/**", "client/src/pages/ressources/composants.astro", "client/src/scripts/composants.mjs", "client/src/styles/composants/**", "client/serveur/edition-composants.mjs", "client/src/scripts/edition/composants.mjs", "client/test/composants-*.test.mjs", "client/test/corps-composants.test.mjs", "client/test/serveur-edition-composants.test.mjs"]
user-invocable: false
---
# Composants

## Fichiers
- Page : `client/src/pages/ressources/composants.astro`, `components/composants/ComposantsPage.astro` (pose `components/Onglets.astro` une fois : skill `ui-onglets`), CSS `styles/composants/`.
- Lecture : `lib/composants-db.mjs` (`TABLEAUX_DES_COMPOSANTS`, `ongletsDeLaPage`) ; lignes : `lib/composants-rendu.mjs` ; champs tirés : `lib/composants-champs.mjs` (`conversionsDe`, `prixEnRf`).
- Corps Markdown des pages qui écrivent ces composants : `lib/corps-composants.mjs`.
- Recherche : `src/scripts/composants.mjs`.
- Édition : `serveur/edition-composants.mjs`, `src/scripts/edition/composants.mjs`.
- Tables : `monnaie`, `ressource` (genres), `materiau`, `materiau_arme`, `recette`, `gemme`, `bois`, `ingredient_alchimie`, `composant_onglet`.

## À lire
- `docs/content-guide.md`, « Composants (`/ressources/composants/`) : tout ce qui sert à fabriquer sans être consommé » : contenu de chaque tableau, onglets, recherche, mode modification, pages dont le corps suit.

## Invariants
- Tout ce qui sert à fabriquer sans être consommé (demande du propriétaire) ; rendu depuis les tables, sans page du wiki. Potions, livres et parchemins n'y sont pas.
- Un onglet par tableau : chaque onglet est une ligne de `composant_onglet` (migration `0057-onglets-des-composants`) ; son id est l'ancre de l'onglet et l'id du panneau `section.composants-panneau`, qui désigne son tableau de `TABLEAUX_DES_COMPOSANTS` ; titre, note, ordre.
- Un tableau sans onglet ou un onglet sans tableau arrête le build (`ongletsDeLaPage`).
- Titre et note d'un onglet se modifient sur le site de dev ; ni création ni suppression d'onglet.
- Chaque tableau passe par le gabarit commun (`Tableau.astro`) : skill `ui-tableaux`.
- Matériaux : seule source (R62, migration `0041-materiaux-types`, table `materiau`, type Léger / Intermédiaire / Lourd / Autres). Nom, type, prix et effets sur une arme ne se modifient qu'ici ; armes et armures les lisent (skill `zone-armes`, skill `zone-armures`). « Autres » est refusé pour un matériau d'armure.
- La fabrication d'une matière (table `recette` de genre `materiau`) est en lecture ; elle vient du tableau MATÉRIAUX retiré de la page Équipement.
- Valeurs des monnaies non modifiables, ni l'abréviation du RF, du RO et de la PP (R61) ; le RF vaut 1 et ne se supprime pas.
- Gemme et bois : une par magie à l'ajout. Leur ligne (`composant composant--magie`) et leur pastille (`comp-magie`) portent la classe de la magie (`couleur-magie-<id>`, `lib/palette-css.mjs`, skill `ui-couleurs`), jamais un style ; `styles/composants/composants.css` en tire le filet et `--mag` (teinte des infobulles de la ligne). Le même HTML sert au mode modification (`lib/composants-rendu.mjs`).
- Un composant ne se supprime que si rien d'autre ne le cite (le bouton grisé dit pourquoi).
- Un objet supprimé reste dans l'inventaire ou la ceinture des fiches sous son nom, avec une note datée (R60, `serveur/fiches-retraits.mjs#OBJETS_AU_CATALOGUE`).
- Ce qui est tiré d'une case est recalculé par le service (prix en RF, ligne du CONVERTISSEUR, type et marque majeur, affinité).
- Le corps des pages qui écrivent ces composants suit, case par case (`corps-composants.mjs`) ; le nom d'un matériau renommé passe aussi par `lib/corps-armes.mjs#corpsAvecMateriauRenomme`.
- Notes de version : domaine des composants (migration `0040-composants`).
- Prix en icônes de monnaie et montants décomposés (R61, R63) : skill `ui-monnaies`.

## Choix du propriétaire
- Un onglet par tableau, comme la page Équipement, modifiables et liés en base.
- Monnaie avec ses conversions vers les plus petites ; table des fruits à part, puis une table par catégorie d'ingrédient ; les six tableaux de l'onglet « Équipement inventaire ».
- Recherche sur toutes les lignes, le nombre trouvé dans chaque onglet.
- Au menu : première page de Règles › Artisanat (skill `zone-menu`).

## Tests
- `client/test/serveur-edition-composants.test.mjs`, `corps-composants.test.mjs`, `composants-onglets.test.mjs`, `composants-html.test.mjs` (site construit).

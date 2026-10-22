---
name: zone-ceinture
description: "Onglet Ceinture de /ressources/equipement/ : vue v_objet_ceinture (R81, R82), sous-onglets Consommables (et ses onglets par famille), Carquois, Bâtons magiques, couleurs du site (règle des potions), édition des potions (potion, potion_etat), prix des bâtons. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/ceinture-db.mjs", "client/src/lib/ceinture-rendu.mjs", "client/src/lib/alchimie-couleurs.mjs", "client/src/lib/batons-*.mjs", "client/src/lib/corps-potions.mjs", "client/src/lib/potion-etats.mjs", "client/src/components/ceinture/**", "client/src/scripts/batons.mjs", "client/src/styles/ceinture/**", "client/serveur/edition-consommables.mjs", "client/test/ceinture-*.test.mjs", "client/test/alchimie-couleurs.test.mjs", "client/test/batons-script.test.mjs", "client/test/corps-potions.test.mjs", "client/test/potion-etats.test.mjs", "client/test/serveur-edition-consommables.test.mjs"]
user-invocable: false
---
# Ceinture

## Fichiers
- Lecture : `client/src/lib/ceinture-db.mjs` (`FAMILLES_DE_LA_CEINTURE`), `lib/batons-db.mjs` (`prixDuBaton`).
- Rendu : `lib/ceinture-rendu.mjs` (`htmlDeLigneDePotion`, `ancreDePotions`, `texteSurCouleur`, `RENDUS_DE_LA_CEINTURE`), `lib/batons-rendu.mjs`.
- Couleurs : `lib/alchimie-couleurs.mjs` (la règle des potions : `couleurDePotion`, `COULEURS_DES_AFFINITES`, `NUANCES_DES_NIVEAUX`), qui lit `lib/attributs-couleurs.mjs`, `sort-format.mjs#couleurDeMagieConnue` et `lib/caracteristiques-postures.mjs` (skill `ui-couleurs`) ; les bâtons, `couleurDeMagie`.
- Gabarit : `components/ceinture/CeinturePanneau.astro`, `BatonsMagiques.astro` ; CSS `styles/ceinture/ceinture.css`.
- Curseur des bâtons : `src/scripts/batons.mjs` (sans import).
- Édition des potions : `serveur/edition-consommables.mjs` (`ressourcesParGenre`), `lib/potion-etats.mjs`, `lib/corps-potions.mjs`.
- Ordre des sous-onglets : `lib/equipement.mjs#SOUS_ONGLETS_DE_LA_CEINTURE` (skill `zone-equipement`).

## À lire
- `docs/content-guide.md`, « Ceinture (onglet Ceinture de `/ressources/equipement/`) » et « Bâtons magiques (sous-onglet Bâtons magiques de la ceinture) » : objets listés, sous-onglets, couleurs, mode modification (tableau des cases saisies), bâtons.
- `docs/serveur.md`, ligne « Consommables de la ceinture » du tableau de l'édition.
- Les 3 emplacements de ceinture de la fiche : `docs/character-generator.md`, « Ceinture », et skill `zone-fiche`.

## Invariants
- Quels objets : la vue `v_objet_ceinture` (migration `0047-objets-a-la-ceinture`) : toutes les potions et huiles, les carquois, sacs de bombes et sacs de pierres, les bâtons magiques (R81). Une vue, pas une table : elle suit les tables. La liste du guide reste « non exhaustive ».
- Le bouclier n'en est pas : son emplacement est dans l'armure (R82).
- La fiche se sert de la vue pour reconnaître bâtons et carquois (maximum, contenance) ; ses 3 emplacements prennent n'importe quel objet du sac (R89).
- Rendu depuis la base, dans `section.equipement-panneau#ceinture` : règles de la ceinture repliées (section « La ceinture » de `guide/l-equipement`, et en dépliable la section « Ceinture » de la page de référence), puis trois sous-onglets dans l'ordre de `SOUS_ONGLETS_DE_LA_CEINTURE` (groupe `data-onglets="Ceinture"`, panneaux `section.ceinture-panneau`).
- Consommables (`#ceinture-consommables`) : un second niveau d'onglets, un par famille, Fioles, Remèdes, Philtres, Huiles, Alchimie primitive, dans cet ordre (`FAMILLES_DE_LA_CEINTURE` ; groupe `data-onglets="Consommables"`, barre `nav.ceinture-familles`, panneaux `section.ceinture-famille#objets-<famille>`, Fioles ouvert au départ, cachés sous `html.js` seulement) ; dans chacun, un tableau par page de potion, deux ou trois côte à côte (`.tableaux--cote-a-cote`, skill `ui-tableaux`), titre en lien, ancre `#potions-<page>`.
- Carquois (`#ceinture-carquois`) : carquois et sacs, en lien vers « Composants », où ils se modifient (skill `zone-composants`).
- Bâtons magiques (`#batons-magiques`, l'ancre de l'ancien onglet) : son panneau de règles (introduction, fabrication en tuile ; skill `zone-equipement`), une ligne par magie, sans colonne Magie ; Gemme (la pastille `.acc-gemme` des accessoires, sans ligne pour sa qualité) et Bois en lien vers « Composants », chacun avec son infobulle (description, prix, le lien) ; Niveau au curseur de 1 à 3 ; Effet et Prix du niveau choisi.
- Prix d'un bâton = matériaux de la recette (gemme de la qualité du niveau + bois) : la source n'écrit pas de prix du bâton (`prixDuBaton`, null si l'un manque). Aucun coût de fabrication ajouté.
- Plus de recherche ni de script de la ceinture, sauf le curseur des bâtons.
- Couleur de chaque ligne = une couleur du site, jamais une couleur relevée ligne par ligne ni écrite en dur (aucun hex dans les fichiers de l'onglet : `test/alchimie-couleurs.test.mjs`). Une potion : la règle `couleurDePotion` — l'affinité de l'essence de la première variante de sa recette (attribut → `attributs-couleurs.mjs`, magie → couleur de la magie, autre → `COULEURS_DES_AFFINITES`, ajoutées d'après le Doc « Alchimie » : la fiole de l'affinité au niveau Avancé) ; essence Démon (philtres) → la caractéristique que l'effet nomme (« compétences de Force », `caracteristiqueDesCompetences`, nom exact seulement) ; Anti → neutre ; puis la nuance du niveau d'alchimie (`NUANCES_DES_NIVEAUX`). Un bâton : la couleur de sa magie sur le site. Carquois et sacs sans couleur. Texte le plus lisible (`texteSurCouleur`). Repère visuel sans valeur de règle. Une couleur ajoutée ne double jamais une règle qui existe (attribut, magie).
- Monnaies en icônes (skill `ui-monnaies`).
- Édition sur le site de dev, consommables seulement, sauf les champs calculés (demande du propriétaire) : d'une potion, le nom et le prix (sa `ressource` ; prix en RF recalculé), le niveau et l'effet (table `potion`), par l'éditeur commun (`data-ed` de `htmlDeLigneDePotion`, rendus `RENDUS_DE_LA_CEINTURE`).
- L'effet modifié refait `potion_etat` par `lib/potion-etats.mjs` (la règle de l'import, rejouée sur toute la base).
- Le tableau du palier dans la page de la potion suit (`lib/corps-potions.mjs`, aussi au rejeu).
- `ressourcesParGenre` : une ressource potion à ce service, les autres aux composants. Notes de version dans le domaine `equipement`.
- En lecture : la couleur de la ligne, la valeur en RF, le titre et le résumé d'un groupe (la page de la potion), les carquois et sacs, les bâtons. Ni création ni suppression.
- L'ancienne page `/ressources/objets-a-la-ceinture/` n'est plus construite : son adresse mène à `#ceinture` (`lib/nav.mjs#PAGES_RENOMMEES`), plus d'entrée au menu.

## Choix du propriétaire
- Onglet « Ceinture » dans la page Équipement, des sous-onglets plutôt qu'une recherche, ordre Consommables / Carquois / Bâtons magiques.
- Tableaux des consommables à deux ou trois côte à côte.
- Consommables en second niveau d'onglets (2026-10-22 : « Oui »).
- « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; « Privilégé la lisibilité » (2026-10-22) : remplace la reprise des couleurs des tableaux de la source (2026-10-16).
- Bâtons : toute la ligne dans la couleur de la magie, pas de colonne Magie, infobulles vers la gemme et le bois, curseur de niveau, colonne Prix.

## Tests
- `client/test/ceinture-db.test.mjs` (essence et couleur de chaque potion), `alchimie-couleurs.test.mjs` (la règle, les nuances, aucune couleur en dur), `ceinture-html.test.mjs` (site construit : onglets des familles, couleurs), `batons-script.test.mjs`.
- `serveur-edition-consommables.test.mjs` (service, rejeu, API), `corps-potions.test.mjs`, `potion-etats.test.mjs` ; `edition-rendu.test.mjs` compare chaque case modifiable au site construit.

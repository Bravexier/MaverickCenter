---
name: ui-tableaux
description: "Gabarit commun des tableaux (components/Tableau.astro, styles/global/tableaux.css, .tableau, .table-donnees, .ligne-couleur) et noms des classes CSS globales. À charger avant de lire, modifier ou relire un tableau de règles ou sa feuille de page."
paths: ["client/src/components/Tableau.astro", "client/src/styles/global/tableaux.css", "client/test/tableaux.test.mjs"]
user-invocable: false
---
# Tableaux : gabarit commun

Tous les tableaux de règles suivent un seul gabarit (demande du propriétaire : « uniformiser tous les tableaux sous le même template commun »).

## Fichiers
- `client/src/components/Tableau.astro` : écrit le HTML du gabarit (cadre, titre, compte, note, zone qui défile, `<table>` ; slots `titre`, `outils`, `avant`, `apres`). Son en-tête décrit les props.
- `client/src/styles/global/tableaux.css` : la présentation, chargée sur toutes les pages.
- `client/test/tableaux.test.mjs`.

## À lire
- `docs/content-guide.md`, « Tableaux : un gabarit commun à tout le site » (cadre, table, densités, ligne colorée, plusieurs tableaux, teinte, qui emploie le composant, exceptions).

## Le gabarit
- Cadre `.tableau` : titre repliable (`<summary>`) ou `<hN>`, `.tableau__nom`, `.tableau__compte`, `.tableau__note`.
- Zone qui défile : `.tableau__defile`, ou le cadre lui-même `.tableau--defile`.
- Table `.table-donnees` : en-têtes en petites capitales sur fond teinté, filets entre lignes ; densités `--serree` et `--aeree`.
- Ligne colorée : `tr.ligne-couleur` avec `--ligne-fond` (la couleur) et `--ligne-texte` (le texte de sa classe), posés par une classe de la palette (potions de la ceinture : `couleur-potion-…` ; bâtons : la feuille de la page les tire de `couleur-magie-…` ; matériaux des armes : `couleur-materiau-…` ; skill `ui-couleurs`). Recette, celle des tuiles `.carac` de `fiche.css` (demande du propriétaire : « Je ne veux plus de ligne entièrement colorées de la couleur de la magie. Je péfèrerai une bordure ou un fond plus transparent de la même manière sont soint faites les tuiles de caractéristiques et de compétences dans la fiche de personnage ») :
  - fond `color-mix(--ligne-fond 12%, var(--surface))`, 20 % au survol ;
  - filet `color-mix(--ligne-fond 60%, var(--border))` dessus et dessous ;
  - liseré `--ligne-lisere` à gauche de la première case : 4 px de la couleur pleine, bordé d'1 px tiré de `--ligne-texte` (35 %), pour qu'une couleur proche du fond (le Vide) se voie ;
  - texte du thème (`--text`) : la couleur pleine ne reste qu'aux pastilles.
  - Réponses du propriétaire à la mise en œuvre : « Fond teinté + liseré (Recommandé) » (pas de bordure seule) ; même style pour les accessoires colorés par niveau (« Oui, même style (Recommandé) »), les matériaux des armes et les potions de Vide, qui remplacent la ligne pleine (« Oui, les deux (Recommandé) »). `.pmat__nom` (armures) est une case seule, pas une ligne : elle reste en couleur pleine.
- Plusieurs tableaux : `.tableaux` (l'un sous l'autre) ou `.tableaux--cote-a-cote` (autant par rangée que la largeur minimale `--tableau-largeur` le permet : 26rem par défaut, 30rem pour les potions de la ceinture, soit 2 ou 3).
- Teinte : `--tab`, `--tab-soft`, `--tab-line`, posée par la page sur son conteneur ; sinon l'accent du site.
- `bloc` du composant : les classes de la page (`armes-famille`, `armes-famille__compte`…) posées à côté de celles du gabarit ; scripts, tests et feuille de page s'y accrochent.
- Les tableaux Markdown (`.prose`) prennent le même gabarit.
- À part : les matrices des magies (`/magies/`, `/races/`), le butin d'une carte de monstre et les tableaux de saisie (fiche, Debug, DB).

## Invariants
- Un tableau de règles nouveau passe par `components/Tableau.astro` ou pose `.tableau` et `.table-donnees`.
- La feuille d'une page ne garde que ce qui lui est propre (largeurs de colonnes, couleurs, lignes sélectionnables). Elle ne recopie jamais la présentation des en-têtes ni des cases.
- La table, ses cases et la zone qui défile sont sous `:where()` : une règle de page les précise sans surenchère, quel que soit l'ordre des feuilles. Ne pas retirer ce `:where()`.
- `.tableau`, `.tableaux`, `.table-donnees` et `.ligne-couleur` sont des classes globales.

## Classes CSS globales
- Avant de nommer une classe de page, chercher son nom dans `styles/global/` (ex. `.piece` : skill `ui-monnaies`).

## Tests
- `client/test/tableaux.test.mjs` : gabarit chargé partout, sous `:where()` ; refuse un `thead th` en petites capitales hors du gabarit ; la ligne colorée (fond 12 %/20 %, filet, `--ligne-lisere`, texte du thème, même teinte que `.carac`, texte du thème à 4,5:1 sur chaque teinte des magies, matériaux et niveaux dans les deux thèmes) ; aucune règle de `styles/` ne pose la couleur pleine en fond d'une ligne (`tr`, `> *`) ; sur le site construit, refuse un tableau sans `table-donnees` ni zone qui défile.

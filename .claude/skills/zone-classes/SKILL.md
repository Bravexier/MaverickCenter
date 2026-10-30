---
name: zone-classes
description: "Liste /classes/ (5 colonnes de pastilles), pages de classe rendues depuis les tables (classe, specialite, capacite, v_capacite_exclusive), dons de classe (type capacites), spécialités en onglets, choix exclusifs. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/class-groups.mjs", "client/src/lib/classes-db.mjs", "client/src/lib/classes.ts", "client/src/lib/classe-*.mjs", "client/src/lib/capacites.mjs", "client/src/lib/dons-edition.mjs", "client/src/lib/corps-classes.mjs", "client/src/components/classes/**", "client/src/styles/classe/**", "client/test/class*.test.mjs", "client/test/capacites*.test.mjs", "client/test/dons-edition.test.mjs", "client/test/corps-classes.test.mjs", "tools/sheets/classes.py", "data/migrations/0008-dons-de-classe*", "data/migrations/0009-classes-sans-suffixe*"]
user-invocable: false
---
# Classes et dons de classe

## Fichiers
- Liste `/classes/` : `client/src/lib/class-groups.mjs` (`CLASS_GROUPS`, `CLASS_OVERRIDES`, `CLASS_COLORS`, `groupeDeCouleur`, `classColor`), `components/classes/ClassesPastilles.astro`, CSS `styles/classe/liste.css` (`?raw`).
- Page d'une classe : `lib/classes-db.mjs` (lecture des tables), `components/classes/ClassePage.astro` (avec `ClasseDons`, `ChoixDeDons`, `DonCarte`), CSS `client/src/styles/classe/` inséré par `ClassePage.astro` (`?raw`).
- Disposition des dons : `lib/classe-dons.mjs#plateauDeDons` ; rendu pur partagé avec le mode modification : `lib/classe-dons-rendu.mjs` sur `lib/classe-assemblage.mjs`.
- Dons (type `capacites`) : `lib/capacites.mjs` (`choix_exclusif_avec`, `checkSelection`), `lib/dons-edition.mjs` (`donneesDeDon`, D11).
- +4 AM d'une classe magique : `lib/classe-magique.mjs` (`CLASSE_MAGIQUE_HORS_CATEGORIE`).
- Onglets : `components/Onglets.astro` (partagé avec les magies et l'équipement ; skill `ui-onglets`).
- Import : `tools/sheets/classes.py` ; corps Markdown tenu d'accord : `lib/corps-classes.mjs` (skill `zone-edition`).

## À lire
- `docs/content-guide.md`, « Liste des classes (`/classes/`) ».
- `docs/content-guide.md`, « Pages de classe : un gabarit commun, alimenté par la base ».
- `docs/content-guide.md`, « Dons de classe (type `capacites`) » (champs du frontmatter, règle des choix, dons créés sur le site de dev, bonus +4 AM).
- `docs/decisions-regles.md` : R6 (l'Archimage est une classe magique), R7 (+4 AM des classes raciales).

## Invariants
- Une page de classe est rendue depuis la base, jamais depuis son `.md` (recherche et `[[liens]]` seulement). Aucun tableau Markdown. Pour changer une classe ou un don, on change la base (site de dev ou migration) : modifier le `.md` fabriqué n'a plus d'effet sur la page.
- Une page (fiche) `capacites/<classe>-<nom>` par don.
- Les « capacités » s'affichent « Dons » (demande du propriétaire), mais le type reste `capacites`, la table `capacite` et les ids `capacites/<classe>-<nom>` ne changent pas. Le libellé est dans `type_page` (migration `0008-dons-de-classe`), que `db:check` compare à `client/src/lib/types.mjs`.
- Les dons suivent la disposition de l'onglet (`plateauDeDons`). Les choix sont ceux de la vue `v_capacite_exclusive`, encadrés avec « ou », options côte à côte ; le test vérifie que disposition et vue coïncident.
- Règle des choix : les dons d'une même ligne de l'onglet s'excluent (`choix_exclusif_avec`, symétrique) ; une spécialité exclut l'autre et tous ses dons ; un don seul sur sa ligne est reçu sans choix. L'Archimage n'a pas de spécialité mais des groupes de 2 ou 3 dons par palier.
- Spécialités en onglets (script `components/Onglets.astro`) : le premier à gauche, le second à droite. Un lien `#don-…` ouvre le bon onglet. Sans JavaScript, tout est affiché.
- Le +4 AM d'une classe raciale se lit dans le texte du don de niveau 10 de sa 2ᵉ spécialité (« considérer comme classe magique ») ; le site lit cette phrase, il ne devine pas la spécialité (R7).
- Le CSS (`client/src/styles/classe/`) est inséré par `ClassePage.astro` en `?raw`, seulement.
- Une page construite avant une création ou une suppression de don est redessinée par le mode modification avec le même HTML (`classe-dons-rendu.mjs`, testé contre le site construit).

## Choix du propriétaire
- `/classes/` : 5 colonnes côte à côte, une par catégorie, dans cet ordre : Physiques Mêlée, Physiques Distance, Magiques, Raciales, Spéciales, d'après les tags posés par l'import (catégorie du Sommaire du classeur). Chaque classe est une pastille sur le modèle de la carte des magies, pas de tableau.
- « Raciales » = « Classe Hybride Animal » ; « Spéciales » = « Classe Hybride » + « Classe spéciale ». Le Parleur (classé mêlée dans le classeur) est volontairement sous « Spéciales » (`CLASS_OVERRIDES`, décision du propriétaire).
- Chaque colonne a la couleur de sa catégorie ; le résumé de la page est en infobulle (`Infobulles.astro`, skill `ui-infobulles`).
- « (classe) » est supprimé de partout, base comprise (migration `0009-classes-sans-suffixe`) : une classe raciale porte le nom de sa race (titre « Orios », page `classes/orios`). `tools/sheets/classes.py` n'ajoute plus de suffixe. `[[classes/orios]]` / `[[races/orios]]` lèvent l'ambiguïté d'un lien.
- Couleur de la page d'après la catégorie de `/classes/` (`classColor`) : rouge mêlée, vert distance, bleu magiques, violet raciales, jaune spéciales. Repère visuel sans valeur de règle. La valeur reste dans `CLASS_COLORS` ; la colonne de `/classes/`, la page d'une classe, la fiche et la page d'une classe créée posent la classe de la catégorie (`couleur-classe-<clé>`, `palette-css.mjs#classeDeCategorie`, `classeDUneClasse` par `groupeDeCouleur` ; famille d'une zone `classe`, émise par `ClassesPastilles.astro` et `ClassePage.astro`), que `styles/classe/base.css` et `liste.css` lisent en `--cla` (`var(--couleur)`) et `--cla-texte` (`var(--couleur-texte)`), jamais un style (skill `ui-couleurs`). Le texte blanc de la bannière et des onglets de spécialité est le jeton `--texte-sur-fonce`, le noir de ses dérivées `--fond-banniere` (`styles/global/base.css`).
- L'étiquette du type d'un don porte `couleur-don-<id>` (`classeDeTypeDeDon`, `lib/genres-couleurs.mjs`, famille `don`), lue en `--couleur` par `styles/classe/dons.css` ; `ClassePage.astro` émet `cssDesFamilles(['classe', 'don'])`.
- Annexe du Mage Bleu : le tableau de l'onglet est découpé en 54 entrées (`classe_annexe_entree`, R181 : la liste des dons « Variable » de la fiche, skills `base-sqlite` et `zone-fiches-base`) ; R67 reste, ce tableau est à part des capacités de monstre communes.
- Annexe d'une classe (« Tableau de l'onglet », Mage Bleu) : une entrée liée à une magie porte `annexe-classe__carte--magie` et la classe de la magie (`couleur-magie-<id>`, `lib/palette-css.mjs`) ; son filet lit `--couleur` (`styles/classe/page.css`), jamais un style.

## Voisins
- Fiche de personnage (choix de classe, dons débloqués, R23, R25) : skill `zone-fiche`. Mode modification des classes, spécialités et dons (D11) : skill `zone-edition`. Lien entre une race hybride et sa classe raciale : skill `zone-races`.

## Tests
- `client/test/classes-html.test.mjs` : site construit (pastilles, classes des catégories et leur feuille, infobulles ; CI après le build).
- `class-groups.test.mjs`, `classes-dons.test.mjs`, `classe-dons-rendu.test.mjs`, `classe-magique.test.mjs`, `classe-champs.test.mjs`, `classes-notes.test.mjs`, `classes-sans-suffixe.test.mjs`.
- `capacites-content.test.mjs` (règle des choix rejouée sur les pages de l'import), `capacites.test.mjs`, `dons-edition.test.mjs`, `corps-classes.test.mjs`, `serveur-edition-classes.test.mjs`, `serveur-edition-rejeu-capacites.test.mjs`.

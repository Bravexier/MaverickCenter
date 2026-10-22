---
name: zone-accessoires
description: "Onglet Accessoires de /ressources/equipement/ : générateur d'accessoire rendu depuis les tables accessoire_*, gemme, tirages au dé, malédiction et destruction (R94), gemmes au choix, prix, encart, couleurs des niveaux. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/accessoires-db.mjs", "client/src/lib/accessoires-generateur.mjs", "client/src/components/accessoires/**", "client/src/scripts/accessoires.mjs", "client/src/styles/accessoires/**", "client/test/accessoires-*.test.mjs"]
user-invocable: false
---
# Accessoires : le générateur d'accessoire

## Fichiers
- Lecture des tables : `client/src/lib/accessoires-db.mjs` (`chargerAccessoires`, `titreDeCompetence`).
- Logique pure du générateur : `client/src/lib/accessoires-generateur.mjs` (`tirerUnAccessoire`, `apresUnJet`, `etatDeMalediction`, `noteDeMalediction`, `gemmesAuChoix`, `gemmesCochees`, `prixDeLAccessoire`, `bonusBorne`, `effetDuBonus`, `bonusDeLAdresse`, `COULEURS_DES_NIVEAUX`).
- Gabarit : `components/accessoires/AccessoiresPage.astro`, `GemmesDeLEffet.astro` ; CSS `styles/accessoires/accessoires.css`.
- Script de page : `src/scripts/accessoires.mjs` (encart, dés, curseur d'acquis `reglerLAcquis`, état dans l'adresse).
- Tables : `accessoire_emplacement`, `accessoire_propriete`, `accessoire_effet`, `accessoire_effet_gemme`, `gemme`, `accessoire_monture`.
- Onglet posé dans la page Équipement : skill `zone-equipement` ; panneau de règles de l'onglet : skill `zone-equipement` (« Panneaux de règles »).

## À lire
- `docs/content-guide.md`, « Accessoires (onglet Accessoires de `/ressources/equipement/`) : le générateur d'accessoire » : tableaux, dés, transitions de malédiction, encart, gemmes au choix, adresse, couleurs, rendu sans JavaScript. Tout le détail y est.
- Effets des accessoires sur la fiche (R54, `accessoire_effet_cible`, `lib/accessoire-champs.mjs` et son test) : skill `zone-fiche`.

## Invariants
- Rendu depuis les tables, jamais depuis le Markdown de la page : seules les consignes écrites sous chaque étape s'affichent ; les règles sont le panneau de règles de l'onglet, déplié au départ.
- Non modifiable sur le site de dev, sauf son panneau de règles.
- Malédiction (R94, `tirerUnAccessoire`, testé) : l'accessoire devient maudit et on relance depuis l'étape 2 avec le même emplacement (l'étape 1 n'est tirée qu'une fois) ; une seconde malédiction le détruit, sans troisième tirage.
- Chaque jet, de « Tirer un accessoire » comme du dé d'un tableau, passe par `apresUnJet` : le dé de l'étape 1, ou un dé jeté sur un accessoire détruit, commence un nouvel accessoire ; le dé de l'étape 2 retire un effet MALÉDICTION choisi. Un accessoire détruit ne revient jamais.
- Un clic n'est jamais un jet : il ne commence pas d'accessoire, et une ligne de malédiction cliquée rend maudit, jamais détruit.
- « Détruit » ne tient que tant que la propriété ou l'effet choisi est une malédiction (`etatDeMalediction`).
- Rien n'est inversé ni calculé par une malédiction : l'encart le dit (`noteDeMalediction`). Le texte des règles de la source n'est pas réécrit.
- État dans l'adresse (`?emplacement=…&propriete=…&effet=…&acquis=…&monture=…&gemmes=…&maudit=1&detruit=1`), lu tel quel, sans transition à la lecture ; `detruit=1` n'est retenu qu'avec une malédiction choisie et implique `maudit`.
- Gemmes au choix : deux en tout (`gemmesAuChoix`), cochées dans la ligne de l'effet ou dans l'encart, un seul état ; le prix se calcule alors (`prixDeLAccessoire` : quarts à la qualité du niveau + monture).
- Compétence : `titreDeCompetence` n'est qu'un affichage, `accessoire_effet.libelle` ne change pas (la fiche et le tableur s'en servent). Le bonus d'acquis, au curseur, au dé ou saisi, est borné aux plages écrites (`bonusBorne`) et en donne le niveau, la couleur et le prix, donc l'effet (`effetDuBonus`).
- Pas de dé sur la table des Montures (demande du propriétaire).
- Seul ce script de page importe `lib/monnaies.mjs` (avec `lib/accessoires-generateur.mjs`) : testé par `test/accessoires-html.test.mjs` (skill `ui-monnaies`).

## Choix du propriétaire
- Un générateur à la place d'un tableau Markdown, présenté comme la page des armes : explication, tableaux, encart à côté qui décrit l'accessoire choisi.
- Un tableau par étape ; l'étape 3, un tableau par propriété, chacun dans son onglet (`components/Onglets.astro`, skill `ui-onglets`).
- Compétence en une ligne par compétence (« Compétence Force »), bonus d'acquis au curseur, au dé ou saisi.
- Chaque tableau des étapes a une case au dé qui tire une ligne.
- Lignes d'effet, montures et encart dans la couleur de leur niveau (`COULEURS_DES_NIVEAUX`, celles de l'onglet) ; gemmes dans la couleur de leur magie, avec une infobulle ; pas de tableau des gemmes. La pastille `.acc-gemme` est partagée avec le sous-onglet Bâtons magiques (skill `zone-ceinture`) : elle porte la classe de sa magie (`couleur-magie-<id>`, `accessoires-db.mjs` : `classe` de chaque gemme, plus de `couleur` ni de `texte` ; skill `ui-couleurs`), que l'encart copie avec elle (`outerHTML`), et `equipement.css` lit `--couleur` / `--couleur-texte` ; son infobulle porte `bulle--gemme` et la même classe (`accessoires.css` en tire `--mag`). Aucune couleur de gemme en style. Les couleurs des niveaux (`--niv`, `COULEURS_DES_NIVEAUX`) restent en style jusqu'à leur lot.

## Tests
- `client/test/accessoires-generateur.test.mjs`, `accessoires-db.test.mjs` (tables complètes, prix écrits recomposés), `accessoires-html.test.mjs` (site construit), `accessoires-script.test.mjs` (faux navigateur : malédiction, R94).

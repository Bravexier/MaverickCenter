---
name: zone-accessoires
description: "Onglet Accessoires de /ressources/equipement/ : générateur d'accessoire rendu depuis les tables accessoire_*, gemme, tirages au dé, malédiction et destruction (R94), gemmes au choix, prix, encart, couleurs des niveaux. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/accessoires-db.mjs", "client/src/lib/accessoires-generateur.mjs", "client/src/lib/accessoires-couleurs.mjs", "client/src/components/accessoires/**", "client/src/scripts/accessoires.mjs", "client/src/styles/accessoires/**", "client/test/accessoires-*.test.mjs"]
user-invocable: false
---
# Accessoires : le générateur d'accessoire

## Fichiers
- Lecture des tables : `client/src/lib/accessoires-db.mjs` (`chargerAccessoires`, `titreDeCompetence`).
- Logique pure du générateur : `client/src/lib/accessoires-generateur.mjs` (`tirerUnAccessoire`, `apresUnJet`, `etatDeMalediction`, `noteDeMalediction`, `gemmesAuChoix`, `gemmesCochees`, `prixDeLAccessoire`, `bonusBorne`, `effetDuBonus`, `bonusDeLAdresse`) ; sans couleur.
- Couleurs des niveaux : `client/src/lib/accessoires-couleurs.mjs` (`COULEURS_DES_NIVEAUX`, sans import), lues par `lib/palette-css.mjs` (famille `niveau`, `classeDeNiveau` ; skill `ui-couleurs`).
- Gabarit : `components/accessoires/AccessoiresPage.astro`, `GemmesDeLEffet.astro` ; CSS `styles/accessoires/accessoires.css`.
- Script de page : `src/scripts/accessoires.mjs` (encart, dés, curseur d'acquis `reglerLAcquis`, état dans l'adresse).
- Tables : `accessoire_emplacement`, `accessoire_propriete`, `accessoire_effet`, `accessoire_effet_gemme`, `gemme`, `accessoire_monture`.
- Onglet posé dans la page Équipement : skill `zone-equipement` ; panneau de règles de l'onglet : skill `zone-equipement` (« Panneaux de règles »).

## À lire
- `docs/content-guide.md`, « Accessoires (onglet Accessoires de `/ressources/equipement/`) : le générateur d'accessoire » : tableaux, dés, transitions de malédiction, encart, gemmes au choix, adresse, couleurs, rendu sans JavaScript. Tout le détail y est.
- Effets des accessoires sur la fiche (R54, `accessoire_effet_cible`, `lib/accessoire-champs.mjs` et son test) : skill `zone-fiche-equipement`.

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
- Seul ce script de page importe `lib/monnaies.mjs` (avec `lib/accessoires-generateur.mjs`) : testé par `test/accessoires-html.test.mjs` (skill `ui-monnaies`). Il n'importe ni la palette ni `lib/accessoires-couleurs.mjs`, qu'aucun script de page n'importe (testé).
- Couleur d'un niveau : la classe `couleur-niveau-<n>` (jamais un style ni `--niv`), posée par le gabarit sur la pastille du niveau, la ligne d'un effet, d'une compétence ou d'une monture (rien pour un niveau absent : « Niveau ? », ligne vide) ; la feuille des cinq classes est émise par `AccessoiresPage.astro` seul (`cssDesFamilles(['niveau'])`). Le script la reprend par `classList` : celle de la ligne de l'effet choisi dans l'encart (`couleursDe`, `poserCouleurs` ; aucune si l'effet n'a pas de niveau, si l'accessoire est détruit ou s'il n'y a rien), celle du niveau du bonus d'acquis sur une ligne de compétence (`classe` de chaque entrée de `data-niveaux`). `accessoires.css` ne lit `--couleur` / `--couleur-texte` que sous `[class*='couleur-niveau-']` (une gemme porte la classe de sa magie), sauf `.bulle--gemme`.

## Choix du propriétaire
- Un générateur à la place d'un tableau Markdown, présenté comme la page des armes : explication, tableaux, encart à côté qui décrit l'accessoire choisi.
- Un tableau par étape ; l'étape 3, un tableau par propriété, chacun dans son onglet (`components/Onglets.astro`, skill `ui-onglets`).
- Compétence en une ligne par compétence (« Compétence Force »), bonus d'acquis au curseur, au dé ou saisi.
- Chaque tableau des étapes a une case au dé qui tire une ligne.
- Lignes d'effet, de compétence et de monture, et encart, dans la couleur de leur niveau (`COULEURS_DES_NIVEAUX`, celles de l'onglet), au style des autres tableaux : « Oui, même style (Recommandé) » (2026-10-29 ; recette du skill `ui-tableaux`, variables `--acc-teinte`, `--acc-filet`, `--acc-lisere`) :
  - ligne : fond teinté à 12 % (20 % au survol ou choisie), filet, liseré à gauche, texte du thème ; jet en texte adouci (`--text` mêlé à `--muted`) ; curseur de l'acquis en `--text`, case saisie sur `--surface` bordée du filet ; ni voile de blanc ni texte de la classe ; choisie : le liseré `--acc` devant celui du niveau ;
  - encart (`.acc-produit`) : fond teinté à 8 %, cadre de la couleur mêlée aux filets (60 %), liseré de 4 px, intitulés en jetons du thème ;
  - pastille du niveau (`.acc-ligne__niveau` dans les lignes d'effet et de monture, niveau d'une compétence réécrit par le script, légende de l'étape 3) : couleur pleine et texte de la classe, bordée d'un trait tiré de `--text` (« Garder les deux (Recommandé) », 2026-10-29).
- Gemmes dans la couleur de leur magie, avec une infobulle ; pas de tableau des gemmes. La pastille `.acc-gemme` est partagée avec le sous-onglet Bâtons magiques (skill `zone-ceinture`) : elle porte la classe de sa magie (`couleur-magie-<id>`, `accessoires-db.mjs` : `classe` de chaque gemme, plus de `couleur` ni de `texte` ; skill `ui-couleurs`), que l'encart copie avec elle (`outerHTML`), et `equipement.css` lit `--couleur` / `--couleur-texte` ; son infobulle porte `bulle--gemme` et la même classe (`accessoires.css` en tire `--mag`). Aucune couleur de gemme en style.
- Violet du maudit, en jetons du thème : `--maudit` (la référence, lue par le cadre pointillé de l'encart maudit), `--maudit-texte` (le violet en texte sur le fond de la page, `#a86ec0` en sombre), `--maudit-choisi` (celui d'une ligne « MALÉDICTION » choisie, `.acc tr.acc-ligne--malediction[data-choix]:not([class*='couleur-niveau-']).est-choisi > *`, et du mot « Maudit » sur l'encart teinté) : en sombre encore éclairci par `color-mix(in srgb, var(--maudit-texte) 80%, #fff)`, environ `#b98bcd`, 4,8:1 sur la ligne choisie, 4,5:1 au moins sur les cinq niveaux de l'encart ; inchangé en clair ; `--ombre-encart`. Réponses du propriétaire : « Plus clair en sombre (Recommandé) » et « Plus clair sur la ligne choisie (Recommandé) » (2026-10-23), puis « Garder les deux (Recommandé) » (2026-10-29), « Maudit » en `--maudit-choisi` à la place du violet assombri. Survol d'une ligne sans niveau : noir de mélange ; `accessoires.css` n'écrit aucune couleur, hors le noir et le blanc de mélange d'un `color-mix`.

## Tests
- `client/test/accessoires-generateur.test.mjs` (dont la règle des couleurs et leur classe), `accessoires-db.test.mjs` (tables complètes, prix écrits recomposés), `accessoires-html.test.mjs` (site construit : classes des niveaux, feuille émise), `accessoires-script.test.mjs` (faux navigateur : malédiction, R94 ; classes de niveau reprises par la ligne et l'encart).
- Couleurs : `test/palette-css.test.mjs` (règles de `accessoires.css`, teinte, filet, liseré et texte du thème des lignes, contraste du texte et du texte adouci sur chaque teinte dans les deux thèmes, « Maudit » sur l'encart, jetons, fichiers sans couleur écrite), `test/site-html.test.mjs` (aucune couleur de niveau en style ni `--niv` sur le site construit).

---
name: zone-glossaire
description: "Page Glossaire /regles/glossaire/ (menu Règles) : tableau des mots-clés (R234, htmlDeLaLigneDuGlossaire), filtres texte et catégorie, et gestion du vocabulaire en mode modification (mots-clés, synonymes, catégories, icône, lien, couleur). À charger avant de lire, modifier ou relire cette page, son script, ses modules ou leurs tests."
paths: ["client/src/pages/regles/glossaire.astro", "client/src/scripts/glossaire.mjs", "client/src/lib/glossaire-{filtre,couleurs}.mjs", "client/src/styles/glossaire/**", "client/src/scripts/edition/mots-cles.mjs", "client/src/lib/mots-cles-edition.mjs", "client/test/glossaire-{filtre,html,tableau}.test.mjs", "client/test/edition-mots-cles.test.mjs"]
user-invocable: false
---
# Glossaire (`/regles/glossaire/`)

## Fichiers
- Page : `pages/regles/glossaire.astro` (le gabarit `components/Tableau.astro`), `styles/glossaire/glossaire.css` ; filtres : `src/scripts/glossaire.mjs` et `lib/glossaire-filtre.mjs` ; couleurs proposées : `lib/glossaire-couleurs.mjs#choixDesCouleurs` (lu au build).
- Une ligne : `lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire` (`COLONNES_DU_GLOSSAIRE`, `pagesDesMentions`, `libellesDesCategories`) ; colonne Lien : `lib/mots-cles-db.mjs#pagesDesLiens`.
- Gestion (site de dev) : extension `src/scripts/edition/mots-cles.mjs`, fonctions pures `lib/mots-cles-edition.mjs` (`operationsDuVocabulaire`, `operationsDesListes`, `synonymesSaisis`, `examinerLesRenommages`, `categoriesDistinctes`, `ecrituresDesCibles`, `cibleSaisie`, `optionsDeCouleur`, `couleurDuCercle`, `valeurDeCouleur`), saisie d'une couleur `editeur.mjs#controleDeCouleur`. Service : skill `zone-mots-cles-service` (`GET /api/edition/mots-cles/` rend `{ motsCles, categories, css }`).
- Balises et tables : skill `zone-mots-cles` ; adresse et couleur : skill `zone-mots-cles-liens` ; `/recherche/` : skill `zone-recherche` ; le gabarit : skill `ui-tableaux` ; l'entrée du menu : skill `zone-menu`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) », paragraphes « Le Glossaire » et « Gérer le vocabulaire ».
- `docs/serveur.md`, « Édition des règles (site de dev) », ligne « Mots-clés » du tableau.

## Choix du propriétaire
- Une page seule, « Glossaire » au menu Règles après Exploration (Q6) ; toute la gestion du vocabulaire y est (Q7) : `/recherche/` ne fait plus que chercher.
- Le tableau (R234) montre **tous** les mots-clés, au style des autres tableaux. Un `<tbody>` par mot-clé : une ligne de cinq colonnes, une colonne étroite « Icône » en premier, avec l'icône seule (`td.glossaire-mot__icone`, R235 (2)), puis « Mot-clé / Catégories / Lien / Pages » (R234 (6)) ; puis une sous-ligne `colspan=5` (`COLONNES_DU_GLOSSAIRE.length`) pour la définition (R234 (3) ; balises rendues, monnaies en icônes, R63). Un mot-clé coloré a le liseré de sa couleur sur ses deux lignes (`tr.ligne-couleur` et sa classe, comme les armes : R234 (1)).
- Colonne Mot-clé : le libellé seul, sans icône (R233 (9)), puis « Aussi appelé » (R233 (8)), sans l'abréviation de sa propre monnaie (R234 (8)). Catégories : leurs libellés dans l'ordre de l'id. Lien : le titre de la page où mène l'adresse (R234 (2), T5), sinon l'adresse brute en lien ; le titre vient de `pagesDesLiens` au build, de `titre_du_lien` et `page_du_lien` du service sur le site de dev.
- Colonne Pages : un menu `<details>` des pages qui mentionnent le mot-clé (R196 : étiquettes et balises, une ligne par page), réduit aux pages où l'on peut aller, et son total ne compte qu'elles (R234 (3), « Seulement les pages »). Le menu des mentions du mode modification les garde toutes (R196, R223 : `endroitsDesMentions`). Jamais de lien vers l'adresse du mot-clé dans ce menu (Q12).
- Deux filtres qui se combinent (R234 (4)) : le texte (libellé, synonymes, définition, sans casse ni accents ; `?q=` le remplit, le Lexique y renvoie) et la catégorie, avec « Sans catégorie » (`SANS_CATEGORIE`, `value="sans"` : les mots-clés à classer, R234 (7)).
- Gestion « en mode édition seulement », dans la ligne (R234 (5), T6) : icône (un choix dans `ed.listes.icones`, R235), libellé, synonymes (un par ligne, `synonymesSaisis`), catégories en cases à cocher, lien, couleur, définition, la balise à copier (`{{clé}}`), « Fusionner dans… », « Supprimer ». Au-dessus du tableau : « + Ajouter un mot-clé » et la gestion des catégories (création, renommage, suppression d'une catégorie vide, `suppressionDeCategorieOfferte` ; R232 (5)).
- Un mot-clé ne se supprime que si rien ne le mentionne (R196) : chaque ligne a le menu de ses mentions (`details.ed-mot-cle__mentions`) et « Supprimer » n'est offert que pour une liste vide (`suppressionOfferte`). Sinon, « Suppression forcée » (R223, plus bas).
- La couleur se choisit par deux sélecteurs (Q3, Q4) : la liste des couleurs du site, familles groupées, chaque couleur nommée par son élément de référence, et un cercle (`<input type="color">`) qui donne `#rrggbb`. Enregistrée en `famille:id` ou `#rrggbb` ; vidée, NULL. Une valeur que la liste n'a pas reste montrée, jamais perdue.

## Invariants
- Le même HTML de ligne au build et dans l'extension (`htmlDeLaLigneDuGlossaire`).
- La page et l'extension ne se parlent que par l'évènement `glossaire:mots-cles` (`detail.gestion` : le tableau de gestion est affiché ; `detail.categories` : `[{ id, libelle }]`, pour refaire la liste du filtre) et le contrat `tbody[data-id][data-cle]` (`data-id` : l'id entier), avec `data-n`, `data-libelle`, `data-synonymes` et `data-categories` (JSON), `data-definition`, `data-url`, `data-couleur`, absents sans valeur. Le filtre relit le tableau à l'évènement.
- `scripts/glossaire.mjs` n'importe que `lib/glossaire-filtre.mjs`, qui n'importe rien : `normaliser` recopie `text.mjs#normalize` (`glossaire-filtre.test.mjs` les compare).
- Le formulaire de création reçoit `liste` et `choix` de chaque champ (`champsDeCreation`) : le choix de l'icône lit la liste `icones` de `GET /api/edition/listes/`.
- Le navigateur n'importe jamais la palette : la page donne les couleurs proposées en `data-couleurs` et émet la feuille des familles d'une zone (`cssDesFamilles(FAMILLES_DES_ZONES)`).
- Aucun id de la page ne commence par `mot-cle-` (les bulles du glossaire).
- Un libellé n'est plus unique (R232 (4)) : `examinerLesRenommages` admet deux homonymes quand chacun a une catégorie propre (`categoriesDistinctes`), sinon propose la fusion ; « Fusionner dans… » propose la clé d'une cible dont le libellé est partagé (`ecrituresDesCibles`, `cibleSaisie`).
- Mot-clé verrouillé (R218, R219 (4), (7)) : en mode modification seulement, la ligne porte `data-verrou` et un cadenas, ses champs, son icône (R235 (5)) et ses synonymes sont désactivés avec `INFOBULLE_DU_VERROU` pour raison, ni « Supprimer » ni « Fusionner dans… » ; ses catégories restent actives (R232 (11)) ; il reste une cible de fusion (`ciblesDeFusion`), sauf pour une source qui a des synonymes (R233 (11)), et garde son menu des mentions. Le Glossaire n'écrit jamais `verrou`.
- La fusion vers une cible verrouillée est permise (R219 (4)) ; le refus R222 (1) (`details.mots_cles_verrouilles`) s'affiche comme tout refus du lot.
- Suppression forcée (R223) : « Forcer la suppression » n'est offert que si les mentions ne sont pas vides, que le mot-clé n'est pas verrouillé et que `refus_du_forcage` est null (`forcageOffert`) ; sinon une note « Suppression forcée impossible » donne la raison (`raisonSansForcage`). Les forcées partent avec `forcer: true` ; la confirmation compte les mentions (`ceQueRemplaceLeForcage`). Verrouillé : ni bouton, ni note.
- Ordre d'un lot (`operationsDuVocabulaire`) : fusions, suppressions, suppressions forcées, `categories_mot_cle` (avant les renommages : un homonyme a déjà ses catégories distinctives), renommages et autres champs, `synonymes_mot_cle` (après : un synonyme peut prendre une écriture libérée), catégories supprimées. Un refus du service (400 ou 409, avec `champ`) s'affiche comme tout refus du lot.

## Tests
- `glossaire-filtre` (texte, catégorie, « Sans catégorie »), `glossaire-tableau` (colonnes, sous-ligne, lien, menu des pages, liseré), `edition-mots-cles` (l'extension dans un faux navigateur ; R223 compris), `mots-cles-liens-rendu` (la ligne).
- `glossaire-html` (site construit : menu, tableau, `data-couleurs`, Lexique renvoyé, `/recherche/` sans gestion).

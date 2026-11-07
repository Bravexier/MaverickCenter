---
name: zone-glossaire
description: "Page Glossaire /regles/glossaire/ (menu Règles) : liste filtrable de tous les mots-clés, ligne htmlDeLaLigneDuGlossaire, et gestion du vocabulaire en mode modification (créer, renommer, fusionner, supprimer ; définition, abréviation, lien, couleur). À charger avant de lire, modifier ou relire cette page, son script, ses modules ou leurs tests."
paths: ["client/src/pages/regles/glossaire.astro", "client/src/scripts/glossaire.mjs", "client/src/lib/glossaire-{filtre,couleurs}.mjs", "client/src/styles/glossaire/**", "client/src/scripts/edition/mots-cles.mjs", "client/src/lib/mots-cles-edition.mjs", "client/test/glossaire-{filtre,html}.test.mjs", "client/test/edition-mots-cles.test.mjs"]
user-invocable: false
---
# Glossaire (`/regles/glossaire/`)

## Fichiers
- Page : `pages/regles/glossaire.astro`, `styles/glossaire/glossaire.css` ; filtre : `src/scripts/glossaire.mjs` et `lib/glossaire-filtre.mjs` ; couleurs proposées : `lib/glossaire-couleurs.mjs#choixDesCouleurs` (lu au build).
- Une ligne : `lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire`.
- Gestion du vocabulaire (site de dev) : extension `src/scripts/edition/mots-cles.mjs`, fonctions pures `lib/mots-cles-edition.mjs` (`operationsDuVocabulaire`, `optionsDeCouleur`, `couleurDuCercle`, `valeurDeCouleur`), saisie d'une couleur `editeur.mjs#controleDeCouleur` ; service : `serveur/edition-chronologie.mjs` (`vocabulaireEtFeuille` : `GET /api/edition/mots-cles/` rend `{ motsCles, css }`, chaque mot-clé avec `verrou` et `mentions`).
- Balises, verrou et refus du service : skill `zone-mots-cles` ; adresse et couleur d'un mot-clé : skill `zone-mots-cles-liens` ; `/recherche/` : skill `zone-recherche` ; l'entrée du menu : skill `zone-menu`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) », paragraphes « Le Glossaire » et « Gérer le vocabulaire ».
- `docs/serveur.md`, « Édition des règles (site de dev) », ligne « Mots-clés » du tableau.

## Choix du propriétaire
- Une page seule, « Glossaire » au menu Règles après Exploration (Q6) ; toute la gestion du vocabulaire y est (Q7) : `/recherche/` ne fait plus que chercher.
- La liste montre **tous** les mots-clés, avec ou sans définition : la pastille de sa couleur, son libellé (un lien quand il a une adresse), son abréviation, sa définition (balises rendues, monnaies en icônes, R63), le nombre de ses pages, un lien vers leur liste `/recherche/?mot-cle=<id>`, jamais vers l'adresse du mot-clé (Q12).
- Gestion « en mode édition seulement » : créer (avec définition, abréviation, lien et couleur), renommer, fusionner, supprimer ; la balise à copier à côté de chaque mot-clé.
- Un mot-clé ne se supprime que si rien ne le mentionne (R196, qui abandonne la cascade) : le service refuse en 409 avec `mentions` (`lib/mentions-des-mots-cles.mjs`, skill `zone-mots-cles`). R196 (2) : chaque mot-clé a un menu déroulant des endroits qui le mentionnent (`details.ed-mot-cle__mentions`, depuis `mentions` de la route), et « Supprimer » n'est offert que pour une liste vide (`lib/mots-cles-edition.mjs#suppressionOfferte`).
- La couleur se choisit par deux sélecteurs (Q3, Q4) : la liste des couleurs du site, toutes les familles de la palette groupées, chaque couleur nommée par son élément de référence (« Feu », « Chakra », « Mythril »), et un cercle (`<input type="color">`) qui donne `#rrggbb`. Enregistrée en `famille:id` ou `#rrggbb` ; vidée, NULL. Une valeur que la liste n'a pas reste montrée, jamais perdue.

## Invariants
- Le même HTML de ligne au build et dans l'extension (`htmlDeLaLigneDuGlossaire`).
- La page et l'extension ne se parlent que par l'évènement `glossaire:mots-cles` (`detail.gestion` : la liste de gestion est affichée) et le contrat `li[data-id][data-cle][data-n][data-libelle]`, plus `data-abreviation`, `data-definition`, `data-url`, `data-couleur` quand le mot-clé en a. Le filtre relit la liste à l'évènement.
- `scripts/glossaire.mjs` n'importe que `lib/glossaire-filtre.mjs`, qui n'importe rien : `normaliser` recopie `text.mjs#normalize` (`glossaire-filtre.test.mjs` les compare). Le filtre lit libellé, abréviation et définition (balises lues comme leur texte), sans casse ni accents ; `?q=` le remplit (le Lexique y renvoie avec sa requête).
- Le navigateur n'importe jamais la palette : la page donne les couleurs proposées en `data-couleurs` et émet la feuille des familles d'une zone (`cssDesFamilles(FAMILLES_DES_ZONES)`) pour les pastilles et la liste.
- Aucun id de la page ne commence par `mot-cle-` (les bulles du glossaire).
- Mot-clé verrouillé (R218, R219 (4), (7) ; `verrou` = 1, skill `zone-mots-cles`) : en mode modification seulement, la ligne porte `li[data-verrou]` et un cadenas, tous ses champs sont désactivés avec `INFOBULLE_DU_VERROU` (`lib/mots-cles-edition.mjs`) pour raison, ni « Supprimer » ni « Fusionner dans… » ; il reste une cible de fusion (`ciblesDeFusion`) et garde son menu des mentions. Hors du mode modification, rien ne le montre. Le Glossaire n'écrit jamais `verrou`.
- La fusion vers une cible verrouillée est permise (R219 (4)). Seul le cas R222 (1) est refusé : la source est citée par une balise de la définition d'un verrouillé, celle de la cible comprise. Le service répond alors 409 avec la liste des verrouillés en cause (`details.mots_cles_verrouilles`). Le Glossaire ne le prévoit pas : le refus s'affiche comme tout refus du lot.
- Le mot-clé verrouillé qu'une page vise reste protégé : la page ne se supprime pas et l'adresse n'est jamais vidée (R221, skill `zone-mots-cles`).
- Ordre d'un lot du vocabulaire : fusions, suppressions, puis renommages (`operationsDuVocabulaire`) ; un refus du service (400 ou 409, avec `champ`) s'affiche comme tout refus du lot.

## Tests
- `glossaire-filtre.test.mjs`, `edition-mots-cles.test.mjs` (l'extension dans un faux navigateur), `mots-cles-liens-rendu.test.mjs` (la ligne).
- `glossaire-html.test.mjs` (site construit : menu, liste, `data-couleurs`, Lexique renvoyé, `/recherche/` sans gestion).

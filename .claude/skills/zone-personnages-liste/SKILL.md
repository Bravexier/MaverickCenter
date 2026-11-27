---
name: zone-personnages-liste
description: "Recherche des personnages (/personnages/, « Personnages » de l'Espace joueur) : filtres, liste à 6 colonnes triable en trois sections, ligne entière en lien vers la fiche, bordure aux couleurs des magies, réglages « Visible par » et « Ranger au compte ». À charger avant de lire, modifier ou relire cette page, son script, son module ou ses tests."
paths: ["client/src/pages/personnages.astro", "client/src/scripts/personnages.mjs", "client/src/lib/personnages-liste.mjs", "client/src/styles/personnages/**", "client/test/personnages-liste.test.mjs", "client/test/personnages-fiches-de-joueur.test.mjs"]
user-invocable: false
---
# Recherche des personnages (`/personnages/`)

## Fichiers

- `pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs`, `styles/personnages/`.
- La fiche elle-même : skill `zone-fiche`. Le service qui sert les fiches et leur portrait : skill `zone-service`.

## À lire

- `docs/character-generator.md`, « La page `/personnages/` ».

## La page (« Personnages » de l'Espace joueur)

- Filtres, puis une liste de 6 colonnes seulement : portrait, nom, race, magies (« Innée, Acquise »), classes, niveau (demande du propriétaire).
- Classes : par rang, chacune suivie de sa spécialité entre parenthèses s'il en a une, « Guerrier (Épéiste), Mage » : la classe telle que la base la donne, la spécialité avec juste une majuscule et le reste en minuscules (`lib/personnages-liste.mjs#casseDeSpecialite`, demande du propriétaire) ; la base et la fiche gardent leur casse, le tri ignore la casse (`#classesDe`, résumé `GET /api/personnages/` : `classes[].classe`, `classes[].specialite`).
- Triée par chaque colonne sauf le portrait.
- Toute la ligne est le lien vers la fiche, bordée de la couleur de la magie innée, en dégradé vers l'acquise en bi-magie : la page pose au build les classes de la palette de chaque magie (`data-couleurs` : `[classe, classe de second rang]`, `lib/palette-css.mjs#classesDeDeuxMagies`), le script pose sur la ligne `perso--magie`, la classe de l'innée et la classe de second rang de l'acquise (`classesDeBordure`), jamais une couleur ; `liste.css` en tire `--magie-1`, `--magie-2` (skill `ui-couleurs`). Le module, importé par le navigateur, n'importe pas la palette.
- Trois sections (R318) : « Mes personnages » (les fiches `a_moi`, ancre `#mes-personnages`), Prétirés, Fiches des joueurs (celles des autres, avec le nom de leur propriétaire) : `sectionsDeLaListe`. Le tri et les filtres valent dans chaque section.
- Le portrait vient de `GET /api/personnages/<id>/portrait/`.
- Filtres et tri dans l'adresse.
- Ni phrase d'introduction ni bouton de création.
- Les réglages sont sous la ligne, jamais dans le lien (un menu ne se met pas dans un lien) ; le service reste juge de chaque droit (R318) :
  - « Visible par » (`VISIBILITES` : Tous (Joueurs et +), MJ (MJ et Créateur), Privé (Utilisateur et Créateur)) : sur une fiche de joueur seulement, à soi ou en Créateur (`peutRegler`). `optionsDeVisibilite` : « MJ » n'est choisissable que d'une session MJ ou Créateur, mais une fiche déjà en « mj » l'affiche.
  - « Ranger au compte » : Créateur seul (`peutRanger`) ; les comptes viennent de `GET /api/utilisateurs/` (`comptesRangeables`, sans le propriétaire actuel).
  - Le niveau vient de la réponse que `scripts/compte.mjs` publie (`window.maverickMoi` / `maverick:moi`, `niveauDeLaSession` ; skill `zone-menu`) : le script ne fait aucune requête `/api/moi/`. La liste s'affiche sans attendre ce niveau ; sans niveau lisible, aucun réglage. Un échec dit toujours que rien n'a changé (`messageDEchec`).
- `scripts/personnages.mjs` n'importe jamais `lib/compte.mjs` (seul `scripts/compte.mjs` l'importe : skill `site-version-portable`) ; `LIBELLES_DE_NIVEAU` en est recopié, le test vérifie l'accord.
- `lib/personnages-liste.mjs` est importé côté navigateur : sans dépendance navigateur ni Astro (skill `site-version-portable`).

## Tests

- `test/personnages-liste.test.mjs` ; `test/personnages-fiches-de-joueur.test.mjs` (R318 : sections, réglages, messages).

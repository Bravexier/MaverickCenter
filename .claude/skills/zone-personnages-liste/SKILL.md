---
name: zone-personnages-liste
description: "Recherche des personnages (/personnages/, entrée « Personnages prétirés » du Jeu, ancre `#pretires`) : filtres, liste à 6 colonnes triable en trois sections, ligne entière en lien vers la fiche, bordure aux couleurs des magies, réglages « Visible par » et « Ranger au compte ». À charger avant de lire, modifier ou relire cette page, son script, son module ou ses tests."
paths: ["client/src/pages/personnages.astro", "client/src/scripts/personnages.mjs", "client/src/lib/personnages-liste.mjs", "client/src/styles/personnages/**", "client/test/personnages-liste.test.mjs", "client/test/personnages-fiches-de-joueur.test.mjs", "client/test/copie-du-pretire.test.mjs"]
user-invocable: false
---
# Recherche des personnages (`/personnages/`)

## Fichiers

- `pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs`, `styles/personnages/`.
- La fiche elle-même : skill `zone-fiche`. Le service qui sert les fiches et leur portrait : skill `zone-service`.

## À lire

- `docs/character-generator.md`, « La page `/personnages/` ».

## La page

- Entrée « Personnages prétirés » du Jeu (R319), qui mène à `personnages/#pretires`, la section Prétirés (R320 (4)) ; « Mes personnages » du menu du profil mène à `personnages/#mes-personnages` (skill `zone-menu`).
- Filtres, puis une liste de 6 colonnes seulement : portrait, nom, race, magies (« Innée, Acquise »), classes, niveau (demande du propriétaire).
- Classes : par rang, chacune suivie de sa spécialité entre parenthèses s'il en a une, « Guerrier (Épéiste), Mage » : la classe telle que la base la donne, la spécialité avec juste une majuscule et le reste en minuscules (`lib/personnages-liste.mjs#casseDeSpecialite`, demande du propriétaire) ; la base et la fiche gardent leur casse, le tri ignore la casse (`#classesDe`, résumé `GET /api/personnages/` : `classes[].classe`, `classes[].specialite`).
- Triée par chaque colonne sauf le portrait.
- Toute la ligne est le lien vers la fiche, bordée de la couleur de la magie innée, en dégradé vers l'acquise en bi-magie : la page pose au build les classes de la palette de chaque magie (`data-couleurs` : `[classe, classe de second rang]`, `lib/palette-css.mjs#classesDeDeuxMagies`), le script pose sur la ligne `perso--magie`, la classe de l'innée et la classe de second rang de l'acquise (`classesDeBordure`), jamais une couleur ; `liste.css` en tire `--magie-1`, `--magie-2` (skill `ui-couleurs`). Le module, importé par le navigateur, n'importe pas la palette.
- Trois sections (R318) : « Mes personnages » (les fiches `a_moi`, ancre `#mes-personnages`), Prétirés, Fiches des joueurs (celles des autres, avec le nom de leur propriétaire) : `sectionsDeLaListe`. Le tri et les filtres valent dans chaque section.
- Le portrait vient de `GET /api/personnages/<id>/portrait/`.
- Filtres et tri dans l'adresse.
- Ni phrase d'introduction ni bouton de création : « Copier le prétiré » (R320) est un réglage de ligne, ci-dessous.
- Les réglages sont sous la ligne, jamais dans le lien (un menu ne se met pas dans un lien) ; le service reste juge de chaque droit (R318) :
  - « Visible par » (`VISIBILITES` : Tous (Joueurs et +), MJ (MJ et Créateur), Privé (Utilisateur et Créateur)) : sur une fiche de joueur seulement, à soi ou en Créateur (`peutRegler`). `optionsDeVisibilite` : « MJ » n'est choisissable que d'une session MJ ou Créateur, mais une fiche déjà en « mj » l'affiche.
  - « Copier le prétiré » (R320), sous chaque prétiré : le bouton suit `peutCopier` (Joueur et plus), sans tenir compte du site de dev, comme les autres réglages (au dev, un MJ le voit et reçoit le refus de la porte) ; `POST /api/personnages/<id>/copie/` puis redirection vers `/fiche/?id=<copie>` (`adresseDeLaCopie`). Grisé pendant l'appel, même si la liste est redessinée ; un refus le dit, rien n'est copié. Le service reste juge (403, 400). Le 403 de la porte nomme le niveau lu dans `niveau_requis` de la réponse (`phraseDeLaPorte`, identique dans `lib/personnages-liste.mjs` et `lib/fiche-copie.mjs` ; accord épinglé par `copie-du-pretire.test.mjs`).
  - « Ranger au compte » : Créateur seul (`peutRanger`) ; les comptes viennent de `GET /api/utilisateurs/` (`comptesRangeables`, sans le propriétaire actuel).
  - Le niveau vient de la réponse que `scripts/compte.mjs` publie (`window.maverickMoi` / `maverick:moi`, `niveauDeLaSession` ; skill `zone-menu`) : le script ne fait aucune requête `/api/moi/`. La liste s'affiche sans attendre ce niveau ; sans niveau lisible, aucun réglage. Un échec dit toujours que rien n'a changé (`messageDEchec`).
- `scripts/personnages.mjs` n'importe jamais `lib/compte.mjs` (seul `scripts/compte.mjs` l'importe : skill `site-version-portable`) ; `LIBELLES_DE_NIVEAU` en est recopié, le test vérifie l'accord.
- `lib/personnages-liste.mjs` est importé côté navigateur : sans dépendance navigateur ni Astro, et seul module importé par `scripts/personnages.mjs` (skill `site-version-portable`). La fiche a sa copie de la règle de copie (`lib/fiche-copie.mjs`, skill `zone-fiche`).

## Tests

- `test/personnages-liste.test.mjs` ; `test/personnages-fiches-de-joueur.test.mjs` (R318 : sections, réglages, messages) ; `test/copie-du-pretire.test.mjs` (R320 : bouton, règle, accord avec la fiche).

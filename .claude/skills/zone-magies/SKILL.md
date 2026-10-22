---
name: zone-magies
description: "Pages de magie (/magies/<magie>/) rendues depuis les tables, tableaux de sorts par NPM, coût et coût secondaire, carte /magies/ et ses relations, Potentiel Illimité en onglets, créatures invoquées en infobulle, niveaux de maîtrise (NM). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/magies-db.mjs", "client/src/lib/magies.ts", "client/src/lib/magie-*.mjs", "client/src/lib/sort-analyse.mjs", "client/src/lib/sort-cout.mjs", "client/src/lib/sort-etats.mjs", "client/src/lib/sort-format.mjs", "client/src/lib/sort-maitrise.mjs", "client/src/lib/potentiel-illimite.mjs", "client/src/lib/corps-magies.mjs", "client/src/components/magie/**", "client/src/styles/magie/**", "client/test/magie*.test.mjs", "client/test/sort-analyse.test.mjs", "client/test/sort-cout-secondaire.test.mjs", "client/test/sort-etats.test.mjs", "client/test/sort-maitrise.test.mjs", "client/test/maitrise-sorts.test.mjs", "client/test/potentiel-illimite.test.mjs", "client/test/corps-magies.test.mjs", "tools/sheets/magies.py", "tools/sheets/annexes-magie.py"]
user-invocable: false
---
# Pages de magie, sorts et niveaux de maîtrise

## Fichiers
- Lecture de la base : `client/src/lib/magies-db.mjs`, `lib/magies.ts` (`ordreDesMagies`).
- Couleurs des magies : la valeur dans `lib/sort-format.mjs#COULEURS_DES_MAGIES`, le rendu par les classes de la palette (`lib/palette-css.mjs` : `classeDeMagie`, `classesDeDeuxMagies` ; skill `ui-couleurs`).
- Mise en forme pure : `lib/sort-format.mjs` ; coût : `lib/sort-cout.mjs` ; NM : `lib/sort-maitrise.mjs`.
- Relations : `lib/magie-relations.mjs` (`entriesAvecRelationsDeLaBase`), `lib/magie-fleches.mjs`, `lib/magie-non-compatible.mjs`.
- Potentiel Illimité : `lib/potentiel-illimite.mjs` (`NPM_MAX_DU_POTENTIEL`), `components/magie/SortsDuPotentiel.astro`, `styles/magie/potentiel.css`.
- Gabarit : `components/magie/MagiePage.astro` (avec `MagieSorts`, `TableauNpm`, `LigneDeSort`, `SortDetail`, `MagieAffinites`, `MagieEtats`, `SortsInteractifs`, `Info`, `EtatPastille`).
- Carte de `/magies/` : `components/magie/MagiesConstellation.astro` (`styles/magie/orbit.css`), tableau dessous : `components/magie/TableauRelationsMagies.astro`.
- CSS : `client/src/styles/magie/*.css` (base, page, sorts, sort-detail, tooltips, creatures, responsive, print, orbit, potentiel, tableaux).
- Corps Markdown tenu d'accord avec les tables : `lib/corps-magies.mjs` (skill `zone-edition`).
- Import : `tools/sheets/magies.py` ; pages des annexes des magies (altérations d'état, météo, modes hyper et super, dans `guide/`) : `tools/sheets/annexes-magie.py`.

## À lire
- `docs/content-guide.md`, « Pages de magie : un gabarit commun, alimenté par la base » (tables lues, bannière, tableaux, panneau d'un sort, carte de `/magies/`, Potentiel Illimité).
- `docs/content-guide.md`, « Niveaux de maîtrise (NM) des sorts » et « Champs structurés (races et magies) ».
- `docs/bestiaire.md` pour la carte d'une créature au NPM (R130) ; skill `zone-bestiaire`.

## Invariants
- Une page de magie est rendue depuis les tables typées (`magie`, `sort`, `invocation`…), jamais depuis son `.md`. Le `.md` ne sert qu'à la recherche et aux `[[liens]]`. Pour changer une magie ou un sort, on change la base.
- La remarque d'un sort (note de cellule) est `sort.remarque`. La table `note_cellule` n'est qu'une trace : ne jamais la lire.
- Le CSS est inséré par `MagiePage.astro` en `?raw`. Ne pas le mettre dans `global.css` ni l'importer : Astro l'attacherait à toutes les pages de la route `[type]/[slug]`.
- Le tableau des relations sous la carte lit les mêmes relations dans la base (`entriesAvecRelationsDeLaBase`) : pages de magie et tableau n'ont qu'une source.
- Un seul gabarit de tableau de sorts sur tout le site : `components/magie/TableauNpm.astro` (une magie, un NPM ; ligne `LigneDeSort.astro` ; comportement au clic `SortsInteractifs.astro`, une fois par page).
- Le panneau d'un sort s'ouvre sous sa ligne (clic ou `#sort-<slug>`). Sans JavaScript, tout est affiché.
- Les bulles des pastilles d'état ne contiennent que des `<span>` : un bloc fermerait le `<p>` qui porte la pastille. Seule exception : la carte d'une créature invoquée (`<div class="bulle bulle--carte">`), hors de tout paragraphe. Système de bulles : skill `ui-infobulles`.
- Le nom d'une créature invoquée est un bouton, jamais un lien (le toucher ne pourrait pas le suivre), dans la liste des créatures comme dans « Manteau noir ».
- Carte de `/magies/` : relations au survol ou au focus clavier par `:focus-visible`, pas `:focus-within` (un clic laissait les relations affichées au retour arrière). Aucun trait au repos.
- Disposition de la carte : aucun trait ni boucle sous une autre pastille, aucune pastille qui en touche une autre ; vérifier ces conditions avant de déplacer une pastille (testé). C'est de la mise en page, pas un classement de règle.
- Potentiel Illimité : ids préfixés du nom court de la magie (`magie.nom_cle`) : `#sort-feu-boule-de-feu`, `#npm-feu-1`, `#sorts-feu`, car deux magies peuvent avoir un sort du même nom.
- Onglets : `components/Onglets.astro`, partagé avec les spécialités des classes (skill `ui-onglets`). C'est un composant, pas un module importé : la version portable refuse un script qui en importe un autre (skill `site-version-portable`).
- Mise en forme seulement, jamais de règle ajoutée ; le texte des cellules n'est jamais réécrit.
- Niveaux de maîtrise : ne rien calculer ni déduire d'une expression de NM, sauf dans le tableau des sorts de la fiche (`valeurAuNm`, demande du propriétaire : la valeur à N NM seulement quand l'écriture n'est qu'un calcul ; sinon le bonus appliqué est écrit, ou l'expression reste). Les pages de magie montrent toujours l'expression en pastille.
- `sort_bonus_maitrise` : une ligne par expression de NM écrite dans une cellule, exhaustive, typée seulement quand l'écriture est sans ambiguïté. `sort.bonus_maitrise` (« Bonus Maîtrise ») en est la recopie lisible.
- Mode séparé du type : `sort_mode` + `sort.mode_brut` (IC, imparable, inesquivable) ; `sort_type` = le type. Un mode qui dépend d'un NM est un bonus de maîtrise (`champ = 'type'`).
- `v_sort_bonus_au_nm` et `lib/sort-maitrise.mjs` donnent la même lecture « à N NM » en SQL et en JavaScript.

## Choix du propriétaire
- Un tableau par niveau de puissance magique (NPM), détails d'un sort sous sa ligne ; pas de colonne Maîtrise : l'expression de NM d'une cellule (« (-5/NM) ») est une pastille `.nm` à sa place, à côté de la valeur (`marquerBonus`) ; celle du type suit les types et le mode ; `sansBonus` donne la valeur de base.
- Coût en deux champs (décisions R105, R106, migrations `0063-cout-secondaire` et `0065-couts-des-sorts-tranches`, `lib/sort-cout.mjs`) : « Coût » (le chakra, « X », « 0 » ou « N/A ») et « Coût secondaire » (âmes, Sang, ou une précision : « Par tour et par cible », « Pour 1 barrière »…). Le second n'a pas de colonne : il s'écrit sous le coût dans sa case, plus discret, comme sur la fiche.
- Panneau d'un sort : remarque et texte du sort dans le même cadre « Effets » que les effets secondaires ; les altérations d'état sont des pastilles dans le texte (`morceauxAvecEtats`, d'après `sort_etat`) avec infobulle (`Infobulles.astro`).
- La carte du bestiaire d'une créature invoquée est son infobulle : `CarteInvoquee.astro` en mode `bulle`, sans lien ni identifiant, une par créature et par page dans `.cartes-creatures`, CSS commun `styles/bestiaire/carte.css` ; `data-placement="cote"` la pose à côté du nom, `data-fermer-au-toucher` la ferme d'un appui dedans ; hauteur bornée pour ne pas cacher le nom, défilement au clavier ; pas de lien « Bestiaire » à côté.
- Le nom d'une créature est sur la couleur de sa magie, en dégradé de la première à la seconde quand il en a deux : le bouton porte `creature__bouton--magie`, la classe de la première et la classe de second rang de la seconde (de la même s'il n'y en a qu'une), dont `styles/magie/creatures.css` tire `--creature-1`, `--creature-2` ; sans magie, la couleur de la page.
- Couleur de la page, d'un onglet et d'un panneau du Potentiel Illimité, des tableaux de `/magies/` et `/races/`, des pastilles de la carte : la classe de la magie (`couleur-magie-<id>`), jamais un style ; `styles/magie/base.css` en tire `--mag` et `--mag-texte` (sans repli écrit ; bannière : la couleur mêlée au noir pur). Carte : un trait porte la classe de sa première magie, la classe de second rang de la seconde et `seconde-<magie>` ; le survol (règles écrites par `MagiesConstellation.astro`) lui fait lire `--couleur` ou `--couleur-2`. Aucune couleur écrite dans les fichiers de la zone (`test/palette-css.test.mjs`).
- Curseur « Cartes au NPM » au-dessus des créatures d'une invocation, pour toutes les cartes de la page ; améliorations d'« Amélioration cadavérique » selon l'invocation sacrifiée (décision R130, `lib/bestiaire-db.mjs#tableauxDesSorts`).
- Pas de légende, pas de source citée (ni par sort, ni en pied de page), pas de liste des lanceurs sur ces pages.
- Encart de l'altération d'état liée (`etat_magie`) entre la présentation et les résistances (`MagieEtats.astro`).
- « Magie non compatible » sans le Potentiel Illimité ; « Mono-magie uniquement » pour une magie `magie.mono_magie` (Potentiel Illimité, Corruption excepté Elfe Noir Charbon et Felfe Noir : décision R15, migration `0010-mono-magie`, `lib/magie-non-compatible.mjs`).
- Un (+) à côté de « Capacité Mode Hyper » au lieu du lien en texte.
- « Disponibilité par race » : une seule liste, dans l'ordre de `/races/` (`ORDRE_DES_RACES`), sans les races qui n'ont pas la magie.
- Potentiel Illimité (pas de sorts à lui) : 14 onglets, un par autre magie, avec ses tableaux du NPM 1 au NPM 4 (NPM 3 d'après son Explication, NPM 4 avec le don « Semi-complet » de l'Archimage niveau 20).
- Carte de `/magies/` : relations au survol d'une magie seulement (grand écran) ; un trait par magie liée, épée au bout de la magie vulnérable, bouclier au bout de celle qui résiste, boucle pour « résiste à elle-même » ; pas d'infobulle sur la carte ; légende sur une ligne ; Potentiel Illimité au centre, disposition symétrique.
- Tableau des relations sous la carte : sans ligne ni colonne pour le Potentiel Illimité ; magies dans l'ordre du classeur et dans leur couleur, sans défilement horizontal (`styles/magie/tableaux.css`).

## Tests
- `client/test/magies-html.test.mjs` : site construit (ids, `aria-*`, bulles, éléments retirés, disposition de la carte) ; se saute sans `dist/`, la CI le lance après le build.
- `magies-page.test.mjs` (mise en forme, `sort-format.mjs`), `magie-fleches.test.mjs`, `magie-relations.test.mjs`, `magie-non-compatible.test.mjs`, `potentiel-illimite.test.mjs`.
- `maitrise-sorts.test.mjs` (accord SQL / JavaScript, `valeurAuNm` sur tous les sorts de 0 à 3 NM), `sort-maitrise.test.mjs`, `sort-cout-secondaire.test.mjs`, `sort-analyse.test.mjs`, `sort-etats.test.mjs`, `corps-magies.test.mjs`.

# Écrire des pages du wiki

Une page = un fichier Markdown `client/src/content/wiki/<catégorie>/<slug>.md`.

> **Ces fichiers ne sont plus dans git** : ils sont fabriqués depuis la base (`data/rows`) par `npm run db:export-pages`, lancé automatiquement avant `dev`, `build` et `test`.
> Pour modifier une page : éditer son `.md` fabriqué, puis `npm run db:sync-pages` (dans `client/`) et commiter `data/rows`. Pour créer ou supprimer une page à la main, c'est possible
> pour les familles `docs` (provenance « Google Doc … ») et `exemple` (`status: example`) ; pour les autres (magies, classes, races…), l'importeur de la famille crée ses pages.
> `npm run autolink -- --write` modifie les `.md` fabriqués : le faire suivre d'un `npm run db:sync-pages`. Voir `docs/sql/remplissage.md`.
Les catégories sont définies dans `client/src/lib/types.mjs` (`races`, `classes`, `magies`, `bestiaire`, `ressources`,
`metiers`, `guide`, `lore`, `cartes`) ; chacune correspond à un salon Discord.

```markdown
---
title: Elfe sylvestre          # obligatoire
aliases: [Elfes des bois]       # autres noms, utilisables dans [[ ]]
tags: [peuple, forêt]           # pages /tags/<mot-clé>/
summary: Une phrase de résumé.  # affichée dans les listes et la recherche
sources: [Discord #lien-pour-races, https://docs.google.com/document/d/…]
status: draft                   # example | draft | verified
---

Texte en Markdown. Un [[Mage]] ou une [[Magie du feu|magie ardente]] sont des liens vers d'autres pages.
```

## Champs structurés (races et magies)

L'import des classeurs pose, en plus des champs ci-dessus, des listes **structurées** que le site exploite pour relier les pages
(`client/src/lib/magie-relations.mjs`) ; un champ absent veut dire « la source ne donne pas de liste », une liste vide « Aucune » :

| Page | Champ | Contenu |
| --- | --- | --- |
| race | `magies_innees: ["Sang", "Eau"]` | magies innées possibles, noms courts, ordre du classeur (onglet « Accessibilité Magie »), sauf exception (voir plus bas) |
| magie | `nom_court: "Espace/Temps"` | nom de la magie dans ces listes (comparé sans casse ni accents) |
| magie | `resiste_a`, `vulnerable_a`, `incompatible_avec` | « Résistance magique », « Vulnérabilité magique », « Magie non compatible » du bloc « Données » (une phrase libre n'est jamais transformée en liste : la clé est omise) |

Le site en tire : le bloc « Magies innées disponibles » d'une race, « Disponibilité par race » d'une magie, le tableau des magies innées en bas de
`/wiki/races/`, celui des relations entre magies sous la carte de `/wiki/magies/`, et le rangement des races. (Les résistances, vulnérabilités et incompatibilités affichées sur une page de magie viennent de la base,
voir « Pages de magie » plus bas.)
`test/races-magies-content.test.mjs` vérifie ces champs sur le contenu réel (noms existants, concordance avec le texte de la page, effectifs).

**Priorité entre les sources d'une race** : l'onglet de la race dans le classeur « Les races » (histoire, présentation, avantages et
inconvénients, don de base, ethnies, mode Hyper) prime sur la « Fiche personnage Maverick Auto V15.2.2 » quand les deux divergent
(la fiche est en retard par endroits : don de base, mode Hyper, statistiques du Drakos, magies innées du Nain…). **Décision R13** : l'onglet est la source,
la fiche n'en est qu'un dérivé fait à la main ; la page de race (rendue depuis la base, voir « Pages de race » plus bas) n'affiche plus que l'onglet. Ce qui suit
décrit le Markdown que l'importeur `tools/sheets/races.py` écrit encore (le corps de la page, qui ne sert plus qu'à la recherche et aux `[[liens]]`) : il liste,
dans « Écarts avec la fiche de personnage V15.2.2 », ce que la fiche dit de différent.
Les écarts listés couvrent les valeurs de départ, le don de base, le mode Hyper, les magies innées, les ethnies, et aussi les écarts de texte libre :
une restriction de caractéristique (l'onglet du Majin dit « La Volonté a un maximum de 3 », la colonne « Restrictions Volonté » de la fiche dit « > 2.0 »),
« Accès à toutes les classes / à toutes les magies » ou « Une seule magie autorisé » contre le nombre de 1 des matrices de la fiche (la matrice reste affichée
telle quelle, sans interprétation ; le propriétaire du projet a précisé que ces phrases de l'onglet sont des erreurs de copier-coller, la plupart des races
pures ayant bien toutes les magies mais avec des ratés possibles : la matrice de la fiche est retenue et la page le dit), et les phrases du « Divers » de la fiche que l'onglet ne dit pas. Les sections « Classes accessibles » et « Magies accessibles »
viennent des matrices de la fiche et le disent en introduction. Les notes de cellule de l'onglet (Médusain : « Jet de vigueur pour esquiver l'altération
d'état » sur ses trois dons) sont conservées sous la cellule ; elles n'existent dans le dump que si le masque de champs du connecteur contient `note`
(`docs/sources.md`).

**Exception du Nain** : la matrice « Accessibilité Magie » de la fiche lui donne les 15 magies, mais l'onglet « Nain » du classeur « Les races » limite
sa magie innée à Potentiel Illimité, Arcane, Feu, Terre et Foudre (« Inconvénient(s) : … en inné uniquement »). Cette limitation est une décision du
propriétaire du projet (l'onglet de la race prime sur la fiche), fondée sur la lecture directe de l'onglet « Nain » (le classeur « Les races » est trop lourd
pour l'export .xlsx : le connecteur Google Sheets le lit onglet par onglet, voir `docs/sources.md`, et la page cite cet onglet dans `sources`) : elle est écrite
en clair dans `tools/sheets/races.py` (`RACE_DETAIL_OVERRIDES`), signalée dans le rapport du script, vérifiée par `--verifier` et mentionnée sur la page. Le Nain reste une
race pure (pas de classe raciale). Si le classeur de la fiche est corrigé, retirer l'exception : le script refuse une exception devenue redondante.

**Races pures et hybrides** : une race est hybride quand elle a sa propre classe raciale (une classe « Hybride Animal » qui porte son nom,
`lib/race-kinds.mjs`) ; les données confirment que ces 13 races ont exactement 3 magies innées. S'y ajoute le Drassah'thac, race hybride sans classe raciale
et aux 14 magies innées (décision R14, `HYBRIDES_SANS_CLASSE_RACIALE`). Les 13 races pures en ont 13 ou plus, sauf le Nain (5 magies innées d'après son onglet,
voir l'exception ci-dessus).

**Liste des races** (`/wiki/races/`, `components/RaceList.astro`) : deux colonnes côte à côte, races pures à gauche et hybrides à droite, l'une sous l'autre sur un
écran étroit. L'ordre est celui du propriétaire (`ORDRE_DES_RACES` dans `lib/race-kinds.mjs`, différent de l'ordre de l'onglet « Race » de la fiche) ; une race
absente de cette liste vient après les autres, par titre. Seules les races hybrides montrent leur classe raciale et leurs magies innées ; ni les magies innées des
races pures ni les magies qu'une race ne peut pas avoir n'y sont listées (demande du propriétaire) : la page de la race et le tableau du bas de page les donnent.

**Tableaux des magies** (demande du propriétaire, qui remplacent l'ancienne page `/wiki/races-et-magies/`, supprimée) : en bas de `/wiki/races/`, les magies innées
de chaque race (`components/magie/TableauMagiesInnees.astro`, lignes rangées comme les deux listes) ; sous la carte de `/wiki/magies/`, les relations entre
magies (`TableauRelationsMagies.astro`). Les magies y sont dans l'ordre du classeur (`magie.ordre`, `ordreDesMagies` de `lib/magies.ts`) et dans leur couleur
(`couleurDeMagie`) : colonnes teintées et une pastille de la couleur par magie innée, lignes teintées pour les relations. En-têtes verticaux et largeur fixe
(`styles/magie/tableaux.css`, inséré en `?raw`) : les deux tableaux tiennent sans barre de défilement horizontale, du téléphone (360 px) à la largeur du site.


## Pages de magie : un gabarit commun, alimenté par la base

Les 15 pages de `/wiki/magies/<magie>/` ne sont **pas** rendues depuis leur Markdown : `components/MagiePage.astro` (avec `MagieSorts`, `SortDetail`, `MagieAffinites`) affiche les lignes
des tables typées de la base, lues par `client/src/lib/magies-db.mjs` : `magie`, `magie_role`, `magie_resistance`, `etat`, `v_magie_incompatible`, `magie_ethnie_secondaire`, `mode_hyper_effet`,
`sort`, `sort_type`, `sort_mode`, `sort_bonus_maitrise`, `sort_etat`, `etat`, `etat_magie`, `etat_stade`, `invocation`, `invocation_bloc`, `creature`, `caracteristique`, `creature_caracteristique`, `creature_bonus_npm`, `creature_attaque`, `creature_capacite`, `creature_effet`, `amelioration_cadaverique`, `regle_magie`.
Le corps Markdown de la page (fabriqué depuis `data/rows`) ne sert plus qu'à la recherche plein texte et aux `[[liens]]`. Restent lus dans le front matter : le titre, les alias, le statut, et la
section « Disponibilité par race » (`magies_innees` des pages de race, avec l'exception du Nain, voir plus haut). Une page de magie sans ligne dans `magie` (la magie d'exemple) garde le rendu Markdown.

**Pour changer une magie ou un sort, on change la base, pas le `.md` fabriqué** (une modification du `.md` n'a plus d'effet sur ces pages). Aucun importeur ne réécrit encore ces lignes depuis les classeurs :
le changement passe par une migration `data/migrations/NNNN-<nom>.sql` appliquée par `npm run db:migrate` (voir `docs/sql/remplissage.md`). Les notes de cellule d'un sort sont dans sa colonne `remarque`
(la table `note_cellule` n'est qu'une trace : rien ne la lit). Le tableau des relations de `/wiki/magies/` lit aussi les résistances, vulnérabilités et incompatibilités dans la base
(`entriesAvecRelationsDeLaBase`) : les pages de magie et le tableau n'ont qu'une source.

Mise en page (pure forme, jamais de règle ajoutée ; `lib/sort-format.mjs`, testé dans `test/magies-page.test.mjs`) :

- **Bannière** : nom, rôles, santé et chakra offerts, caractéristique bonus, 4ᵉ barre ; la couleur de chaque magie (`COULEURS`) est un repère visuel sans valeur de règle.
- **Aucune virgule dans les données** : une liste devient des pastilles (une par élément), les bonus du D/S/B (« +8 dégâts, +2AM ») sont un élément par ligne, « 4.0 » s'affiche « 4 », les précisions entre
  parenthèses (`(xNP de créature)`) passent en petit (parenthèses gardées), le coût « 10 + 4 Sang » est séparé en coût et supplément, les types et les marques (IC, imparable, inesquivable) sont des pastilles.
  Le texte des cellules n'est jamais réécrit.
- **Un tableau par niveau de puissance magique (NPM)** : Nom, Type, Coût, Portée, Zone, D/S/B, une ligne par sort ; **pas de colonne Maîtrise**. Le bonus de niveau de maîtrise (NM, `sort_bonus_maitrise`, voir « Niveaux de maîtrise »
  ci-dessous) qu'une cellule de Coût, Portée, Zone ou D/S/B écrit entre parenthèses est une **pastille à sa place, à côté de la valeur** (« 55 » puis la pastille « -5/NM », « 5d6 [+3/NM] dégâts sonores » ;
  `marquerBonus` de `lib/sort-maitrise.mjs`). La colonne Type montre les types (`sort_type`), le **mode** de base (`sort_mode` : IC, imparable, inesquivable) puis, en pastille, le mode qui dépend d'un NM (« IC pour 3 NM »).
  Les bonus écrits dans les effets ou la remarque restent dans leur texte, dans le panneau du sort.
  La **règle spéciale d'un niveau** (`regle_magie`, « Règle spéciale pour sort niveau 5 ») est dans l'infobulle de la pastille « i » du titre du tableau concerné, pas sous le tableau. Pas de légende sur la page.
- **Un clic sur la ligne** (ou `#sort-<slug>` dans l'adresse) **ouvre juste en dessous un panneau** : un seul cadre « **Effets** » qui contient le texte des effets secondaires (`sort.effets`), puis, à la ligne, la remarque du classeur (`sort.remarque`,
  la note de cellule) et le texte du sort de niveau 5 (`sort.texte_niveau5`) sans intitulé propre. Les **altérations d'état** repérées dans le texte (`sort_etat`, un index dérivé du texte, non exhaustif) sont des **pastilles placées dans le texte**,
  sur le mot de la source, pas une liste à part ; chacune renvoie à sa section de `/wiki/guide/liste-des-alterations-d-etat/` et a une **infobulle** (type, magie liée, effet de chaque stade ; le stade cité est mis en avant : `etat`, `etat_magie`, `etat_stade`).
  Les mêmes infobulles servent aux altérations d'état des résistances et vulnérabilités de la magie. Pas de source citée, pas de liste des créatures qui lancent le sort.
  Quand le sort a **ses propres règles**, un bloc dédié : pour une invocation (Animation de mort, Appel aux Golems, Marionnette de l'ombre) les règles de l'onglet de l'invocation (**repliées** par défaut, dans un `<details>`), pour Animation de mort le tableau
  « AMELIORATION CADAVERIQUE » (replié aussi) et la liste des créatures invoquées par bloc : **un clic sur le nom d'une créature ouvre sa fiche minimale juste sous son bloc** (stats : santé, chakra, barrière, défense, vitesse ; dégâts : ses attaques,
  telles qu'écrites ; les six caractéristiques ; capacités avec leur NPM minimum et leur qualificatif « [Non enflammé] »), un bouton « Bestiaire » à côté du nom mène à sa page. Sans JavaScript, les panneaux des sorts, les fiches et la règle du NPM 5 sont affichés ;
  les règles d'invocation et l'annexe restent dans leur `<details>` replié.
- **Infobulles** (`components/Bulles.astro`, `Info.astro`, `EtatPastille.astro`) : au survol (la bulle reste ouverte quand le pointeur passe dessus), au focus clavier (Échap ferme la bulle seule, pas le panneau du sort) ou au toucher (un premier appui ouvre la bulle,
  un second suit le lien d'une pastille d'état), en position fixe près du déclencheur, bornée à l'écran (le tableau défile et couperait une bulle absolue) ; sans JavaScript l'attribut `title` du déclencheur donne le même contenu en texte simple. La bulle n'est faite que
  d'éléments « en ligne » (`<span>`) : une pastille est posée dans un paragraphe, où un bloc fermerait le `<p>` et ferait fuir le contenu de la bulle (`test/magies-html.test.mjs` le vérifie sur le site construit, ainsi que le câblage `aria-*`).
- **Sources** : ni « Source : … » dans le panneau d'un sort, ni section « Sources » en pied de page des pages de magie (`sources:` reste dans le front matter pour la traçabilité).
- **Chaque élément renvoie à sa page** : magie → page de la magie, altération d'état → sa section de `/wiki/guide/liste-des-alterations-d-etat/` (l'ancre est celle du titre `## <nom>`, vérifiée par
  le test), créature ou invocation → page du bestiaire, race → page de la race.
- `Résistances` et `Vulnérabilités` = `magie_resistance` (cibles « magie » et « état », écriture de la source sur la pastille), `Magie non compatible` = `v_magie_incompatible` (relation symétrique)
  plus la phrase libre `magie.incompatibilite_note` (Corruption).
- Le CSS de ces pages est dans `client/src/styles/magie.css`, injecté par `MagiePage.astro` seulement : le mettre dans `global.css` alourdirait les 1 500 autres pages (et chacune des pages de la version portable).

## Pages de race : un gabarit commun, alimenté par la base

Les 27 pages de `/wiki/races/<race>/` sont rendues comme les pages de magie : `components/race/RacePage.astro` (avec `RaceRelations.astro`) affiche les lignes des tables
typées lues par `client/src/lib/races-db.mjs`, jamais le Markdown. **Aucun tableau Markdown** : ce qui était un tableau dans la page (valeurs de départ, tableau du Drakos ou du Mort-vivant,
écarts) est une table de la base, rendue en tuiles, en cartes ou en vrai tableau HTML.

- **Contenu de l'onglet** (migration `0007-races-onglet`, décision R13) : `race_onglet` (description générale, histoire, description, valeurs de départ, avantages, inconvénients, don de base),
  `race_don` (un don par ethnie du tableau de l'onglet, ou le don unique de la race ; la note de cellule d'un don est dans `remarque`), `race_don_tableau_colonne` / `_ligne` / `_cellule`
  (le tableau en panneaux du Drakos et du Mort-vivant), `mode_hyper_effet` version `onglet_race` (avec le nom de la capacité, colonne `nom`). Les lignes ont été tirées des pages par
  `tools/db/races_onglet.py`, qui réécrit chaque section avec le code de l'importeur et exige la page à l'identique (`--verifier` le refait ; `test/races-onglet.test.mjs` le lance).
- **Matrice de la fiche** (décision R8) : magies innées (`race_magie`), sauf quand l'onglet limite lui-même la magie innée :
  `race_magie_onglet` prime (« en inné uniquement » : le Nain, décision R11, et les 13 races hybrides, dont la liste est celle de la matrice). Le test vérifie que la liste affichée est celle de `magies_innees`
  (pages de magie, tableau de `/wiki/races/`).
- **Race pure ou hybride** : la classe raciale est la classe « Hybride Animal » qui porte le nom de la race (même règle que `lib/race-kinds.mjs`, vérifiée par le test).
- **Retirés** : la section « Écarts avec la fiche de personnage V15.2.2 », les « Sous-races et origines » et les valeurs de la fiche (AP, AM, « Divers », restrictions), la section « Sources », et la liste des
  classes accessibles (demande du propriétaire : `race_classe` reste dans la base, mais seule la classe raciale d'une race hybride est citée, dans le bandeau).
- **Relations avec les autres peuples** (`peuple`, `relation_peuple`, vue `v_regard_peuple` ; `lib/race-relations.mjs`, testé dans `test/race-relations.test.mjs`) : **décision R12**, la case (ligne A, colonne B)
  de l'onglet « Relation entre les races » dit comment A voit B. Deux lectures, chacune en listes par niveau, de « Alliée » à « Ennemie » : comment les peuples de la race voient les autres (ouverte),
  comment les autres les voient (repliée). **On ne regroupe jamais deux peuples dont les relations diffèrent** (demande du propriétaire) : les peuples de la race au regard identique partagent un bloc,
  sinon chacun a le sien (Elfe Noir Charbon et Elfe Noir Salé côte à côte) ; dans un niveau, une autre race n'est citée d'un seul nom que si tous ses peuples y sont, sinon chacun de ses peuples est cité
  à son propre niveau (« Humain » suivi de « Central · Désertique »). Les relations entre peuples d'une même race sont dans une petite matrice. Une race sans peuple dans l'onglet (Anansi, Farfadet, Goleois) le dit.
- Le CSS est dans `client/src/styles/race/`, injecté par `RacePage.astro` (`?raw`) seulement, comme celui des magies. `test/races-html.test.mjs` contrôle le site construit (la CI le lance après le build).

**Pour changer une race, on change la base** (une migration `data/migrations/NNNN-<nom>.sql`, voir `docs/sql/remplissage.md`) : modifier le `.md` fabriqué n'a plus d'effet sur la page.

## Liste des classes (`/wiki/classes/`)

Un tableau de **cinq colonnes côte à côte** (demande du propriétaire), une par catégorie, dans cet ordre : **Physiques Mêlée**, **Physiques Distance**, **Magiques**, **Raciales**, **Spéciales**
(`lib/class-groups.mjs`, testé ; `components/classes/ClassesTableau.astro`, CSS `styles/classe/liste.css`). La catégorie vient du tag posé par l'import (intitulé du Sommaire du classeur) :
« Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride Animal » (raciales), « Classe Hybride » et « Classe spéciale » (spéciales : Flagelleur, Archimage).
Le Parleur, « corps à corps » dans le Sommaire, est sous « Spéciales » (décision du propriétaire, `CLASS_OVERRIDES`) ; une classe sans catégorie reconnue va dans « Non classées », sous « Spéciales ».
Chaque colonne prend la couleur de sa catégorie (celle des pages de classe) ; le nom d'une classe est écrit **sans « (classe) »** (`classLabel` : « Kitsune (classe) » → « Kitsune ») ;
le résumé de la page (`summary`) est dans une **infobulle** (`components/magie/Bulles.astro` : survol, focus clavier, premier appui au toucher puis le second suit le lien ; `title` sans JavaScript).
Sur un écran étroit, les colonnes passent à la ligne. Le fil d'Ariane d'une classe mène à sa colonne (`/wiki/classes/#raciales`…).

## Pages de classe : un gabarit commun, alimenté par la base

Les 39 pages de `/wiki/classes/<classe>/` sont rendues comme les pages de magie et de race : `components/classes/ClassePage.astro` (avec `ClasseDons`, `ChoixDeDons`, `DonCarte`) affiche
les lignes des tables lues par `client/src/lib/classes-db.mjs` : `classe`, `categorie_classe`, `specialite`, `capacite`, la vue `v_capacite_exclusive`, `type_don`, `classe_maitrise_arme`,
`classe_maitrise_armure`, `classe_objet_depart`, `objet_depart`, `classe_annexe`. **Aucun tableau Markdown** (le « Don de départ » est en tuiles, le tableau sans titre du Mage Bleu en cartes),
pas de source citée ; le Markdown de la page ne sert plus qu'à la recherche et aux `[[liens]]`. La classe d'exemple, sans ligne dans `classe`, garde le rendu Markdown.

- **Bandeau** : catégorie du Sommaire, santé, chakra et barrière de départ, « Classe magique +4 AM » (la classe elle-même, ou seulement « avec la spécialité … » quand c'est le don
  de cette spécialité qui le dit : classes raciales, Flagelleur ; `lib/classe-magique.mjs`), « Classe raciale » avec le lien vers la race.
- **Couleur** (demande du propriétaire), sur toute la page comme celle d'une magie, d'après la catégorie de `/wiki/classes/` (`lib/class-groups.mjs#classColor`, testé) : rouge pour les
  physiques de mêlée, vert pour les physiques à distance, bleu pour les magiques, violet pour les raciales (hybrides), jaune pour les spéciales (Parleur compris). Repère visuel sans valeur de règle.
- **Sections** : présentation et « Chose à savoir », descriptions des spécialités, « Au départ » (maîtrises, arme, armure, inventaire : chaque objet du glossaire a son infobulle, « A OU B »
  est un emplacement à deux options), **Dons**, tableau sans titre de l'onglet (Mage Bleu : une carte par magie).
- **Dons** (les « capacités » des onglets ; demande du propriétaire : c'est leur nom) : disposés **comme l'onglet** (`lib/classe-dons.mjs#plateauDeDons`, testé dans
  `test/classes-dons.test.mjs`), de haut en bas : les dons reçus sans choix (colonne P : niveaux 1 et 5), les deux spécialités (une seule au choix : elle exclut l'autre et
  tous ses dons), et le don du niveau 20 en bas ; l'Archimage a des groupes de 2 ou 3 dons au choix. **Spécialités en onglets** (demande du propriétaire) : le premier dans le coin gauche,
  le second dans le coin droit (comme les bannières A17 et X17), une pastille « ou » entre eux ; l'onglet ouvert montre le cartouche de la spécialité puis ses trois choix sur toute la largeur.
  Motif « tabs » de l'ARIA (flèches, Début, Fin) posé par le script de `ClasseDons.astro` ; une adresse ou un lien vers une spécialité ou un de ses dons (`#don-…`, la fiche du don) ouvre son onglet ;
  sans JavaScript et à l'impression, les deux spécialités se suivent avec leur titre. **Chaque choix est encadré** (« Au choix · Niveau N : un seul des deux »), ses options **côte à côte**
  (l'une sous l'autre sur un téléphone) avec une pastille « ou » entre elles ; les choix sont ceux de la vue `v_capacite_exclusive` (la disposition de l'onglet fait foi), le test
  vérifie qu'ils coïncident. Une carte de don : niveau, nom (lien vers la fiche), type (nom du guide, sa définition en infobulle native) et sa précision telle qu'écrite (« 2 fois/Combat »),
  effet, remarque du classeur. Ancre `#don-<slug>` : la fiche d'un don y renvoie.
- Le CSS est dans `client/src/styles/classe/` (et `styles/magie/tooltips.css` pour les infobulles), injecté par `ClassePage.astro` (`?raw`) seulement. `test/classes-html.test.mjs` contrôle
  le site construit (la CI le lance après le build).

**Pour changer une classe ou un don, on change la base** (une migration `data/migrations/NNNN-<nom>.sql`, voir `docs/sql/remplissage.md`) : modifier le `.md` fabriqué n'a plus d'effet sur la page.

## Niveaux de maîtrise (NM) des sorts

Chaque sort existe sur plusieurs niveaux de maîtrise (0 à 3 NM, jamais plus de 3). Un NM s'obtient par niveau du personnage (à partir du niveau 2, redistribuable parmi les sorts choisis), par la lecture d'un livre de
sort (fixe, propre au sort) ou par un cadeau du MJ (fixe ou flexible) ; ces trois sources s'ajoutent (codes `N`, `L`, `C` de la table `legende_sort`, qui n'est plus affichée sur les pages). Un sort est renforcé à chaque NM, ou quand il atteint 3 NM : devenir IC, coût
en chakra qui baisse, portée, zone, dégâts / soins / barrière, effet secondaire en plus. Les cellules du classeur l'écrivent dans des notations variées (`(+1d6/NM)`, `(-5/NM)`, `3NM = …`, `IC pour 3 NM`, `à 3NM`, `au niveau 3 de maîtrise`).

- **`sort_bonus_maitrise`** : une ligne par expression de NM, **exhaustive** (elle remplace l'index `sort_progression_nm` qui ne retenait que deux formes dans cinq colonnes). `champ` = la colonne où l'expression est écrite
  (type, coût, portée, zone, D/S/B, effets, remarque) ; `texte_brut` = l'expression recopiée exactement ; `contexte` = le passage de la cellule qui dit ce qu'elle modifie (« Dure 2 tours (+1/NM) ») ; `nature` : `par_nm`
  (un incrément à chaque NM ou chaque tranche de 3 NM : `increment_brut`, `pas_nm`), `palier` (à partir d'un NM : `seuil_nm`), `texte` (une mention de NM sans valeur typable). **Rien n'est calculé ni déduit** : une valeur n'est typée que si
  son écriture est sans ambiguïté. Un sort qui n'écrit aucun NM n'a aucune ligne.
- **`sort.bonus_maitrise`** : la colonne « Bonus Maîtrise » de la table des sorts, la recopie lisible de ces lignes (une ligne « Coût : -5/NM » par bonus), accord contrôlé par `test/maitrise-sorts.test.mjs`.
- **`v_sort_bonus_au_nm`** et `lib/sort-maitrise.mjs` (`applications`, `bonusAuNm`) : ce qui s'applique à un niveau de maîtrise donné (0 à 3), pour que la fiche de personnage détermine un sort d'après ses NM : `par_nm` = NM / `pas_nm`
  fois, `palier` = 1 à partir de `seuil_nm`. La vue SQL et la fonction JavaScript disent la même chose (test d'accord sur les 322 sorts).
- **Mode et type séparés** : `sort_type` = le type (attaque, entrave, soin…), `sort_mode` = le mode de base (IC, imparable, inesquivable, `IC x 2`) et `sort.mode_brut` = le texte entre parenthèses de la colonne Type ; un mode qui dépend d'un NM
  (`IC pour 3 NM`, `IC x 2 si 3NM`, `IC x 1/NM`) est un bonus de maîtrise (`champ = 'type'`). `type_brut` reste la cellule telle qu'écrite.
- Les corrections de ces données passent par une migration (`data/migrations/0004-bonus-maitrise.sql`, registre `.json` ligne par ligne) ; le registre est la trace de ce qui a été extrait de quelle cellule.

## Dons de classe (type `capacites`)

Les « capacités » des onglets de classe sont des **dons** (leur nom dans le jeu) : c'est ce qu'affiche le site (« Dons de classe », « Don » ; migration `0008-dons-de-classe`),
alors que les identifiants gardent `capacites/…` et la table `capacite` (identifiants stables). Chaque don d'un onglet de « Classe Maverick V7 » a sa fiche
`capacites/<classe>-<nom>.md` ; la page de la classe les montre tous, disposés comme l'onglet (voir « Pages de classe » plus haut). Champs du frontmatter, déclarés dans `content.config.ts` et lus par `client/src/lib/capacites.mjs` :

| Champ | Contenu |
| --- | --- |
| `classe` | id de la page de la classe (`classes/barde`) |
| `nature` | `classe` (reçue sans choix), `specialite` (cartouche de spécialité, niveau 10) ou `choix` (capacité d'une spécialité ou d'un palier) |
| `specialite` | bannière de la spécialité (absente pour `classe` et pour l'Archimage, qui n'a pas de spécialité) |
| `niveau`, `rang`, `ligne` | niveau de classe ; position de gauche à droite dans son groupe de choix (les capacités de la même ligne sous la même bannière : Nouvel accord, à droite de la ligne 29 du Barde, est de rang 1) ; ligne de la cellule dans l'onglet (commune aux deux bannières) |
| `choix_exclusif_avec` | ids des autres capacités de la **même ligne** : une seule au choix (symétrique) |

**Règle des choix** (confirmée par le propriétaire du projet, lisible dans la mise en page des onglets) : deux capacités côte à côte sur
une même ligne s'excluent ; les deux cartouches de spécialité sont sur une même ligne, donc choisir une spécialité exclut l'autre et
toutes ses capacités ; une capacité seule sur sa ligne est reçue sans choix. Exemple du Barde Ménestrel : Nouvel accord exclut Écho, Balade
guerrière exclut Amplification, Exaltation exclut Touérk. L'Archimage n'a pas de spécialité mais des groupes de 2 ou 3 capacités au même
niveau (Élémentaliste / Occultiste ; Création vivante / Tempus Figus / Obédience…). `checkSelection` contrôle un ensemble de capacités ;
`test/capacites-content.test.mjs` rejoue ces exemples sur les vraies pages.

**Bonus d'armure magique (+4 AM)** (`lib/classe-bonus.mjs`) : toute classe magique l'a (Sommaire : « Octroie 4 AM de base par classe
magique »). Pour une classe raciale, c'est sa 2ᵉ spécialité, le pendant lanceur de sort : la capacité de spécialisation de niveau 10 y dit
« considérer comme classe magique ». Le site lit cette phrase dans la fiche de la capacité, il ne devine pas la spécialité. L'Archimage est
une classe magique : la fiche V15.2.2 (BDD!H40, I40, BB2) le range parmi elles pour ce bonus et le propriétaire du projet le confirme ; le Sommaire le classe « spéciale » parce que
ses règles diffèrent de celles des autres classes (pas de spécialité, des groupes de choix par palier). La page de l'Archimage donne cette explication.

## Coquilles et fautes d'orthographe

Les classeurs sources contiennent des coquilles ; elles se corrigent (demande du propriétaire du projet), **jamais dans la page** mais dans le
registre `tools/sheets/corrections.json`, appliqué aux dumps avant les extracteurs (voir `docs/sources.md`). Seules sont admises les fautes de
frappe, d'orthographe, d'accent, d'accord, de ponctuation, de casse et d'espace : tout ce qui changerait un chiffre, un dé, un signe ou le sens
d'une règle est refusé par l'outil et se demande au propriétaire.

Depuis la conversion en base, la correction se fait **dans la base** : les sorts et les 15 magies (migration `data/migrations/0003-orthographe-magies`), puis toute la base
(migration `0005-orthographe-base` : pages, classes, capacités, races, bestiaire, équipement, guides, lore et tables typées), puis les noms (migration `0006-orthographe-noms` :
sens le plus probable, graphie majoritaire pour un nom propre ; le nom change partout, sa clé suit, son identifiant et l'adresse de sa page jamais), chacune avec son registre `.json` ;
`client/test/orthographe-magies.test.mjs`, `orthographe-base.test.mjs` et `orthographe-noms.test.mjs` vérifient que rien d'autre qu'une graphie n'a changé. Un nouvel import d'un classeur réintroduirait les fautes :
refaire la correction par une migration. Les citations « telles quelles » de la fiche (tableaux des écarts des races) gardent leurs fautes. Les points qui demandent une décision
(mot manquant, accord douteux) sont dans `docs/sql/orthographe-a-valider.md`. Les noms propres et les jeux de mots du classeur sont gardés (les noms
coupés sur deux cases, « Tenir ... » / « ... ou charger ? », sont voulus : ils se répondent pour souligner le choix).

## Liens entre pages

| Écriture | Effet |
| --- | --- |
| `[[Titre]]` | lien vers la page dont le titre, l'alias ou le slug correspond |
| `[[Titre\|texte]]` | idem, avec un texte d'affichage différent |
| `[[races/elfe]]` | désigne la page sans ambiguïté (utile si deux pages ont le même titre) |

La casse, les accents et les apostrophes sont ignorés. Les liens sont **résolus au build** :

- une page cible affiche automatiquement « Mentionnée par … » (rétroliens) ;
- un lien sans cible s'affiche en rouge, un avertissement `[wikilinks]` apparaît au build, et la page figure dans
  « Pages à créer » de `/wiki/` ;
- un titre porté par plusieurs pages est signalé comme ambigu : utiliser `[[catégorie/slug]]`.

Les `[[…]]` placés dans du code (`` `…` `` ou bloc ```) ne sont pas interprétés.

## Statuts

- `example` : contenu de démonstration (bandeau jaune) — à supprimer.
- `draft` : importé depuis une source, pas encore relu par le MJ (défaut). Sans bandeau sur le site (demande du propriétaire).
- `verified` : relu et validé.

## Conventions

- Noms de fichiers en ASCII minuscule avec tirets (`elfe-sylvestre.md`) : le slug devient l'URL.
- Toujours renseigner `sources:` pour pouvoir retrouver l'origine d'une règle.
- Ne rien inventer : un point de règle absent des sources reste absent (ou marqué « à confirmer »).
- Après l'ajout d'un **nouveau fichier**, relancer `npm run dev` (l'index des liens est lu au démarrage).

## Maillage automatique

Après un import, `npm run autolink` (depuis `client/`) propose des liens `[[…]]` vers les pages dont le titre ou un alias apparaît
dans le texte des autres pages. **Sans option, il n'écrit rien** : il affiche les statistiques et les 40 premiers liens ;
`npm run autolink -- --write` les applique, `-- --verbose` liste tout. Règles (précision d'abord) :

- un seul lien par page cible dans une page, jamais vers la page elle-même ni vers un terme de son propre nom ;
- rien dans le frontmatter, les titres, les tableaux, le code, les liens et URLs existants ;
- un titre porté par plusieurs pages est ignoré ; un titre d'un seul mot n'est lié que s'il commence par une majuscule ;
- les locutions courantes qui sont aussi un titre (par exemple « en résumé ») se déclarent dans `client/scripts/autolink-ignore.txt`.

L'outil ne modifie que du balisage de lien (vérifié : en retirant les `[[…]]`, on retrouve exactement le texte d'origine) et
peut être relancé sans risque après chaque import. Relire le résultat avec `git diff` avant de commiter.

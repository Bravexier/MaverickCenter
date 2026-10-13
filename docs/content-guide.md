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
`/races/`, celui des relations entre magies sous la carte de `/magies/`, et le rangement des races. (Les résistances, vulnérabilités et incompatibilités affichées sur une page de magie viennent de la base,
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
`lib/race-kinds.mjs`) ; à l'import, ces 13 races ont exactement 3 magies innées (un constat, pas une règle : décision R30). S'y ajoute le Drassah'thac, race hybride sans classe raciale
et aux 14 magies innées (décision R14, `HYBRIDES_SANS_CLASSE_RACIALE`). Les 13 races pures en ont 13 ou plus, sauf le Nain (5 magies innées d'après son onglet,
voir l'exception ci-dessus).

**Liste des races** (`/races/`, `components/race/RacesPastilles.astro`, CSS `styles/race/liste.css` en `?raw`) : une **pastille par race**, sur le modèle de la
carte des magies et de la page des classes (demande du propriétaire), en deux groupes côte à côte, races pures à gauche et hybrides à droite, l'un sous l'autre
sur un écran étroit. Chaque groupe a sa couleur, celle du bandeau des pages de race (`RACE_COLORS` dans `lib/race-kinds.mjs`, source unique : `RacePage.astro`
la pose aussi) ; repère visuel sans valeur de règle. L'ordre est celui du propriétaire (`ORDRE_DES_RACES`, différent de l'ordre de l'onglet « Race » de la fiche) ;
une race absente de cette liste vient après les autres, par titre. Une pastille ne porte que le nom de la race ; son accroche est en infobulle (`Infobulles.astro`,
`title` sans JavaScript) ; ni magies innées ni classe raciale : le tableau du bas de page donne les magies innées, la page de la race sa classe raciale.

**Tableaux des magies** (demande du propriétaire, qui remplacent l'ancienne page `/wiki/races-et-magies/`, supprimée) : en bas de `/races/`, les magies innées
de chaque race (`components/magie/TableauMagiesInnees.astro`, lignes rangées comme les deux listes, sans ligne de séparation entre pures et hybrides) ; sous la carte de `/magies/`, les relations entre
magies (`TableauRelationsMagies.astro`), sans ligne ni colonne pour le Potentiel Illimité (demande du propriétaire : il « ne sert pas vraiment » ici ; sa page garde
ses relations). Les magies y sont dans l'ordre du classeur (`magie.ordre`, `ordreDesMagies` de `lib/magies.ts`) et dans leur couleur
(`couleurDeMagie`) : colonnes teintées et une pastille de la couleur par magie innée, lignes teintées pour les relations. En-têtes verticaux et largeur fixe
(`styles/magie/tableaux.css`, inséré en `?raw`) : les deux tableaux tiennent sans barre de défilement horizontale, du téléphone (360 px) à la largeur du site.


## Pages de magie : un gabarit commun, alimenté par la base

**La carte de `/magies/`** (`components/magie/MagiesConstellation.astro`, CSS `styles/magie/orbit.css`) : une pastille par magie, le nom seul, **sans infobulle**
(demande du propriétaire : le survol ne montre que les relations) ; dense, comme les pastilles de `/classes/` et `/races/` (demande du propriétaire). **Relations au survol** (demandes du propriétaire), sur grand écran seulement : survoler
une magie affiche ses relations, et seulement les siennes, dans sa couleur, d'après la base (`magie_resistance`, `lib/magie-fleches.mjs`) : un trait par magie liée, une **épée** au bout
de la magie contre laquelle l'autre est efficace (sa « Vulnérabilité magique » cite l'autre), un **bouclier** au bout de celle qui résiste à l'autre (sa « Résistance magique » la cite),
une boucle à bouclier pour une magie qui résiste à elle-même. Les deux sens d'une paire sont sur le même trait : dans la base, quand A est efficace contre B, A résiste aussi à B
(épée chez B, bouclier chez A) ; Vide–Espace-Temps et Lumière–Ombre ont deux épées, Arcane–Corruption deux boucliers (testé sur la base). Au repos, aucun trait ; seuls le survol de la souris et le focus au clavier (`:focus-visible`) les affichent, pas le focus laissé par un clic (sinon, au retour arrière, les relations de la magie cliquée restaient affichées). La légende tient sur une ligne.
Disposition du grand écran (1000 × 440) : le Potentiel Illimité, sans relation, au centre (demande du propriétaire) ; les huit magies liées en anneau autour, symétriques gauche–droite
(Vent↔Nécromancie, Feu↔Eau, Terre↔Sang, Glace↔Foudre : la symétrie des relations le permet) ; Corruption–Arcane et Espace-Temps–Vide aux coins du haut, Lumière–Ombre en bas.
Elle est choisie pour qu'**aucun trait ni aucune boucle ne passe sous une autre pastille** et que deux pointes d'une même magie ne se touchent pas : Feu et Eau sont plus bas que Terre
et Sang parce que le trait Feu–Eau passerait sinon sous eux. Pour déplacer une pastille, vérifier ces conditions (`test/magies-html.test.mjs` les contrôle sur le site construit, de 58 à
62rem de large). Sous 60rem : deux colonnes, les paires côte à côte reliées par leur pointillé (incompatibles ou opposées), sans relations. Cette disposition est de la mise en page,
pas un classement de règle. `test/magies-html.test.mjs` vérifie aussi qu'aucune pastille n'en touche une autre, du téléphone (320 px) au grand écran, et qu'il n'y a plus d'infobulle ;
`test/magie-fleches.test.mjs` teste les relations et leur géométrie.

Les 15 pages de `/magies/<magie>/` ne sont **pas** rendues depuis leur Markdown : `components/MagiePage.astro` (avec `MagieSorts`, `TableauNpm`, `LigneDeSort`, `SortDetail`, `MagieAffinites`) affiche les lignes
des tables typées de la base, lues par `client/src/lib/magies-db.mjs` : `magie`, `magie_role`, `magie_resistance`, `etat`, `v_magie_incompatible`, `magie_ethnie_secondaire`, `mode_hyper_effet`,
`sort`, `sort_type`, `sort_mode`, `sort_bonus_maitrise`, `sort_etat`, `etat`, `etat_magie`, `etat_stade`, `invocation`, `invocation_bloc`, `creature`, `caracteristique`, `creature_caracteristique`, `creature_bonus_npm`, `creature_attaque`, `creature_capacite`, `creature_effet`, `amelioration_cadaverique`, `regle_magie`.
Le corps Markdown de la page (fabriqué depuis `data/rows`) ne sert plus qu'à la recherche plein texte et aux `[[liens]]`. Restent lus dans le front matter : le titre, les alias, le statut, et la
section « Disponibilité par race » (`magies_innees` des pages de race, avec l'exception du Nain, voir plus haut) : **une seule liste**, les races qui peuvent l'avoir en magie innée, dans l'ordre de `/races/`
(`ORDRE_DES_RACES`), sans séparer races pures et hybrides, sans la liste des races qui ne le peuvent pas ni lien vers le tableau de `/races/` (demande du propriétaire). Une page de magie sans ligne dans `magie` (la magie d'exemple) garde le rendu Markdown.

**Pour changer une magie ou un sort, on change la base, pas le `.md` fabriqué** (une modification du `.md` n'a plus d'effet sur ces pages). Aucun importeur ne réécrit encore ces lignes depuis les classeurs :
le changement passe par une migration `data/migrations/NNNN-<nom>.sql` appliquée par `npm run db:migrate` (voir `docs/sql/remplissage.md`). Les notes de cellule d'un sort sont dans sa colonne `remarque`
(la table `note_cellule` n'est qu'une trace : rien ne la lit). Le tableau des relations de `/magies/` lit aussi les résistances, vulnérabilités et incompatibilités dans la base
(`entriesAvecRelationsDeLaBase`) : les pages de magie et le tableau n'ont qu'une source.

Mise en page (pure forme, jamais de règle ajoutée ; `lib/sort-format.mjs`, testé dans `test/magies-page.test.mjs`) :

- **Bannière** : nom, rôles, santé et chakra offerts, caractéristique bonus, 4ᵉ barre ; la couleur de chaque magie (`COULEURS`) est un repère visuel sans valeur de règle.
- **Altération d'état liée** (demande du propriétaire) : après la présentation (et l'Explication), avant les résistances, un encart montre l'altération d'état de la magie
  (colonne « Magie Liée » de la « Liste des altérations d'état » : `etat_magie`) : son nom (lien vers sa section), son type et l'effet de chaque stade ; une altération partagée
  (Surcharge Magique : Arcane et Corruption) nomme l'autre magie. Pas d'encart sans altération liée (Potentiel Illimité). `components/magie/MagieEtats.astro`.
- **Capacité Mode Hyper** : un (+) à côté du titre mène à la liste des effets mode hyper (plus de lien en texte).
- **Aucune virgule dans les données** : une liste devient des pastilles (une par élément), les bonus du D/S/B (« +8 dégâts, +2AM ») sont un élément par ligne, « 4.0 » s'affiche « 4 », les précisions entre
  parenthèses (`(xNP de créature)`) passent en petit (parenthèses gardées), le coût « 10 + 4 Sang » est séparé en coût et supplément, les types et les marques (IC, imparable, inesquivable) sont des pastilles.
  Le texte des cellules n'est jamais réécrit.
- **Un tableau par niveau de puissance magique (NPM)** : Nom, Type, Coût, Portée, Zone, D/S/B, une ligne par sort ; **pas de colonne Maîtrise**. Un seul gabarit pour tous les tableaux de sorts du site,
  `components/magie/TableauNpm.astro` (une magie, un NPM ; une ligne : `LigneDeSort.astro` ; le comportement au clic : `SortsInteractifs.astro`, une fois par page). Le bonus de niveau de maîtrise (NM, `sort_bonus_maitrise`, voir « Niveaux de maîtrise »
  ci-dessous) qu'une cellule de Coût, Portée, Zone ou D/S/B écrit entre parenthèses est une **pastille à sa place, à côté de la valeur** (« 55 » puis la pastille « -5/NM », « 5d6 [+3/NM] dégâts sonores » ;
  `marquerBonus` de `lib/sort-maitrise.mjs`). La colonne Type montre les types (`sort_type`), le **mode** de base (`sort_mode` : IC, imparable, inesquivable) puis, en pastille, le mode qui dépend d'un NM (« IC pour 3 NM »).
  Les bonus écrits dans les effets ou la remarque restent dans leur texte, dans le panneau du sort.
  La **règle spéciale d'un niveau** (`regle_magie`, « Règle spéciale pour sort niveau 5 ») est dans l'infobulle de la pastille « i » du titre du tableau concerné, pas sous le tableau. Pas de légende sur la page.
- **Un clic sur la ligne** (ou `#sort-<slug>` dans l'adresse) **ouvre juste en dessous un panneau** : un seul cadre « **Effets** » qui contient le texte des effets secondaires (`sort.effets`), puis, à la ligne, la remarque du classeur (`sort.remarque`,
  la note de cellule) et le texte du sort de niveau 5 (`sort.texte_niveau5`) sans intitulé propre. Les **altérations d'état** repérées dans le texte (`sort_etat`, un index dérivé du texte, non exhaustif) sont des **pastilles placées dans le texte**,
  sur le mot de la source, pas une liste à part ; chacune renvoie à sa section de `/guide/liste-des-alterations-d-etat/` et a une **infobulle** (type, magie liée, effet de chaque stade ; le stade cité est mis en avant : `etat`, `etat_magie`, `etat_stade`).
  Les mêmes infobulles servent aux altérations d'état des résistances et vulnérabilités de la magie. Pas de source citée, pas de liste des créatures qui lancent le sort.
  Quand le sort a **ses propres règles**, un bloc dédié : pour une invocation (Animation de mort, Appel aux Golems, Marionnette de l'ombre) les règles de l'onglet de l'invocation (**repliées** par défaut, dans un `<details>`), pour Animation de mort le tableau
  « AMELIORATION CADAVERIQUE » (replié aussi) et la liste des créatures invoquées par bloc. **La carte du bestiaire d'une créature est son infobulle** (demande du propriétaire : « La carte sera à garder et servirait de tooltip
  dans leur correspondance dans les tableaux des magies et leurs sorts associés ») : au survol, au focus clavier ou au toucher de son nom (un bouton, dans la liste des créatures et dans les effets « Manteau noir » de la Marionnette de l'ombre),
  la carte entière (`components/bestiaire/CarteInvoquee.astro` en mode `bulle` : sans lien ni bouton ni identifiant, CSS commun `styles/bestiaire/carte.css`) s'ouvre à côté du nom (`data-placement="cote"`), sinon dessous ou dessus comme les autres bulles,
  sa hauteur bornée à l'espace qui reste pour ne pas cacher le nom ; plus haute que sa place, elle défile (molette, ou au clavier les flèches, pages, début et fin tant que le nom a le focus) ; un clic dedans ne la ferme pas.
  Au toucher, elle couvre presque l'écran d'un téléphone : un appui dedans la referme (`data-fermer-au-toucher`), et le nom n'est jamais un lien (le second appui tomberait sur la carte). Une carte par créature et par page (dans `.cartes-creatures`, après les tableaux de sorts, avant « Disponibilité par race »), y compris dans les onglets du Potentiel Illimité ;
  un lien « Bestiaire » à côté du nom mène à sa page. Sans JavaScript, les panneaux des sorts et la règle du NPM 5 sont affichés, la carte reste cachée et l'attribut `title` du nom en donne les valeurs (santé, chakra, barrière, défense, vitesse, dégâts) ;
  les règles d'invocation et l'annexe restent dans leur `<details>` replié.
- **Infobulles** (`components/Infobulles.astro`, commun à tout le site, `Info.astro`, `EtatPastille.astro` ; habillage `styles/global/infobulles.css`) : au survol (la bulle reste ouverte quand le pointeur passe dessus), au focus clavier (Échap ferme la bulle seule, pas le panneau du sort) ou au toucher (un premier appui ouvre la bulle,
  un second suit le lien d'une pastille d'état), en position fixe près du déclencheur, bornée à l'écran (le tableau défile et couperait une bulle absolue) ; sans JavaScript l'attribut `title` du déclencheur donne le même contenu en texte simple. La bulle n'est faite que
  d'éléments « en ligne » (`<span>`) : une pastille est posée dans un paragraphe, où un bloc fermerait le `<p>` et ferait fuir le contenu de la bulle (`test/magies-html.test.mjs` le vérifie sur le site construit, ainsi que le câblage `aria-*`) ;
  seule exception, la carte d'une créature invoquée (`<div class="bulle bulle--carte">`), posée hors de tout paragraphe, après les tableaux de sorts.
- **Potentiel Illimité** : il n'a pas de sorts à lui (« cette magie pioche ses sorts dans toutes les magies existantes », bloc « Explication » de son onglet). À la place de la
  section des sorts, sa page montre **« Sorts des autres magies » : 14 onglets, un par autre magie**, dans l'ordre du classeur et dans sa couleur (`components/magie/SortsDuPotentiel.astro`,
  `lib/potentiel-illimite.mjs`, CSS `styles/magie/potentiel.css` inséré en `?raw` sur cette page seulement). Chaque onglet reprend **les tableaux de cette magie du NPM 1 au NPM 4** (demande
  du propriétaire, `NPM_MAX_DU_POTENTIEL` : l'Explication le borne au NPM 3, le don de niveau 20 de l'Archimage, sa classe unique, « Semi-complet », donne le NPM 4) avec le gabarit `TableauNpm` : mêmes lignes et mêmes panneaux que sur la page de la magie, dont le titre de l'onglet est le lien. Les identifiants y sont
  préfixés du nom court de la magie (`magie.nom_cle`) : `#sort-feu-boule-de-feu`, `#npm-feu-1`, `#sorts-feu` (l'onglet), car deux magies peuvent avoir un sort du même nom ; une adresse vers un sort
  ouvre son onglet puis le sort ; pas de texte d'aide au-dessus des onglets. Les onglets (script commun avec les spécialités des pages de classe : `components/Onglets.astro`) suivent le motif « tabs » de l'ARIA ; sans JavaScript et à
  l'impression, les 14 magies se suivent, chacune sous son titre. `test/potentiel-illimite.test.mjs` et `test/magies-html.test.mjs` (site construit) le vérifient.
- **Sources** : ni « Source : … » dans le panneau d'un sort, ni section « Sources » en pied de page des pages de magie (`sources:` reste dans le front matter pour la traçabilité).
- **Chaque élément renvoie à sa page** : magie → page de la magie, altération d'état → sa section de `/guide/liste-des-alterations-d-etat/` (l'ancre est celle du titre `## <nom>`, vérifiée par
  le test), créature ou invocation → page du bestiaire, race → page de la race.
- `Résistances` et `Vulnérabilités` = `magie_resistance` (cibles « magie » et « état », écriture de la source sur la pastille), `Magie non compatible` = `v_magie_incompatible` (relation symétrique)
  **sans le Potentiel Illimité**, cité dans aucun bloc (il est incompatible avec toutes) ; une magie **mono-magie** (`magie.mono_magie` : Potentiel Illimité, Corruption) affiche à la place
  « Mono-magie uniquement », puis « Excepté pour » et les ethnies de `magie_ethnie_secondaire` (Elfe Noir Charbon, Felfe Noir pour la Corruption) ; décision R15, `lib/magie-non-compatible.mjs`.
  La phrase libre `magie.incompatibilite_note` (celle de la Corruption) reste dans la base comme trace.
- Le CSS de ces pages est dans `client/src/styles/magie.css`, injecté par `MagiePage.astro` seulement : le mettre dans `global.css` alourdirait les 1 500 autres pages (et chacune des pages de la version portable).

## Pages de race : un gabarit commun, alimenté par la base

Les 27 pages de `/races/<race>/` sont rendues comme les pages de magie : `components/race/RacePage.astro` (avec `RaceRelations.astro`) affiche les lignes des tables
typées lues par `client/src/lib/races-db.mjs`, jamais le Markdown. **Aucun tableau Markdown** : ce qui était un tableau dans la page (valeurs de départ, tableau du Drakos ou du Mort-vivant,
écarts) est une table de la base, rendue en tuiles, en cartes ou en vrai tableau HTML.

- **Contenu de l'onglet** (migration `0007-races-onglet`, décision R13) : `race_onglet` (description générale, histoire, description, valeurs de départ, avantages, inconvénients, don de base),
  `race_don` (un don par ethnie du tableau de l'onglet, ou le don unique de la race ; la note de cellule d'un don est dans `remarque`), `race_don_tableau_colonne` / `_ligne` / `_cellule`
  (le tableau en panneaux du Drakos et du Mort-vivant), `mode_hyper_effet` version `onglet_race` (avec le nom de la capacité, colonne `nom`). Les lignes ont été tirées des pages par
  `tools/db/races_onglet.py`, qui réécrit chaque section avec le code de l'importeur et exige la page à l'identique (`--verifier` le refait ; `test/races-onglet.test.mjs` le lance).
- **Matrice de la fiche** (décision R8) : magies innées (`race_magie`), sauf quand l'onglet limite lui-même la magie innée :
  `race_magie_onglet` prime (« en inné uniquement » : le Nain, décision R11, et les 13 races hybrides, dont la liste est celle de la matrice). Le test vérifie que la liste affichée est celle de `magies_innees`
  (pages de magie, tableau de `/races/`).
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

## Liste des classes (`/classes/`)

**Cinq colonnes côte à côte** (demande du propriétaire), une par catégorie, dans cet ordre : **Physiques Mêlée**, **Physiques Distance**, **Magiques**, **Raciales**, **Spéciales**
(`lib/class-groups.mjs`, testé ; `components/classes/ClassesPastilles.astro`, CSS `styles/classe/liste.css`). Chaque classe est une **pastille sur le modèle de la carte des magies**
(demande du propriétaire : plus de tableau) : pilule bordée et teintée de la couleur de sa catégorie, point de couleur, nom en gras, légère élévation au survol ; les titres des
colonnes partagent une même rangée (sous-grille), si bien que leurs soulignements restent alignés quand un titre passe à la ligne. La catégorie vient du tag posé par l'import (intitulé du Sommaire du classeur) :
« Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride Animal » (raciales), « Classe Hybride » et « Classe spéciale » (spéciales : Flagelleur, Archimage).
Le Parleur, « corps à corps » dans le Sommaire, est sous « Spéciales » (décision du propriétaire, `CLASS_OVERRIDES`) ; une classe sans catégorie reconnue va dans « Non classées », sous « Spéciales ».
Chaque colonne prend la couleur de sa catégorie (celle des pages de classe) ; le nom d'une classe est son titre : **« (classe) » est supprimé de partout, base comprise** (demande du propriétaire, migration `0009-classes-sans-suffixe`),
une classe raciale porte le nom de sa race (« Kitsune », page `classes/kitsune`) ;
le résumé de la page (`summary`) est dans une **infobulle** (`components/Infobulles.astro` : survol, focus clavier, premier appui au toucher puis le second suit le lien ; `title` sans JavaScript).
Sur un écran étroit, les colonnes passent à la ligne. Le fil d'Ariane d'une classe mène à sa colonne (`/classes/#raciales`…).

## Métiers (`/metiers/`) : un tableau, pas de page par métier

Un seul **long tableau** (demande du propriétaire), à l'image des tableaux de sorts : une ligne par métier de la table `metier`, par ordre alphabétique, en cinq colonnes :
- **Nom** ;
- **Bonus** (décisions R33, R37) : un rang de `metier_bonus` par ligne ; chaque compétence que le bonus augmente (`competence_id` : son Acquis) est une **pastille dans la couleur
  de sa caractéristique**, un attribut (`attribut` : l'initiative « +1 INI », la vitesse, la vitesse de nage) une pastille neutre, les options d'un choix reliées par « ou » (le choix se fait dans la fiche) ; un bonus
  qui ne vise ni l'une ni l'autre (« +1AP donné par les armures… », « Peut avoir un faucon ») reste son texte, en italique : il n'a pas d'effet automatique sur la fiche ;
- **Artisanat** (décision R34) : le texte libre de ce que le métier fabrique (« — » s'il ne fabrique rien) ;
- **Caractéristiques** : les deux caractéristiques de la compétence d'artisanat (`test_carac_1_id`, `test_carac_2_id`), en pastilles ; la compétence vaut 10 × chacune
  (constante `metier.artisanat_par_point_caracteristique`, page « Règles des métiers ») ;
- **Équipement supplémentaire** (décision R35) : les objets de départ (`metier_objet_depart`), un par puce, les options d'un choix reliées par « ou » ; un objet du
  glossaire des inventaires de départ a sa description en infobulle.

Les cellules sont les rendus de `lib/edition-rendu.mjs` (`metier-bonus`, `metier-artisanat`, `metier-carac`, `metier-equipement`), ceux que le mode modification réécrit après un
enregistrement : un seul HTML (`test/edition-rendu.test.mjs` le vérifie sur le site construit). Cliquer sur un métier ouvre sous sa ligne sa **description** (et son « Avantage
possible », sauf s'il se réduit à « … ») ; sans JavaScript, tout est affiché (`lib/metiers.mjs#chargerMetiers`, `contexteDesMetiers`, `components/metier/MetiersTableau.astro`,
CSS `styles/metier/tableau.css` inséré en `?raw`).

**Champs et liens** (`lib/metier-champs.mjs`, rejoué sur toute la base par `test/metier-champs.test.mjs`) : « Bonus » se découpe sur « , » (rangs) et « OU » (options), et un nom de
compétence (casse et accents ignorés) la lie ; « +N% dans une compétence sociale au choix » donne une option par compétence de la caractéristique nommée. « Équipement
supplémentaire » se découpe comme l'inventaire de départ d'une classe (« , » puis « OU » ; « (xN) » = la quantité, `objetDInventaire`). Sur le site de dev, l'artisanat se
modifie en trois champs (texte, caractéristique 1, caractéristique 2) ; « Artisanat possible » (`artisanat_brut`, que la page du métier écrit) en est recalculé, son crochet
gardant l'écriture de la source tant que ses caractéristiques ne changent pas.

**Filtres et tri** (demande du propriétaire) : au-dessus du tableau, un filtre par colonne (texte cherché sans accents ni casse) ; un clic sur l'en-tête
d'une colonne la trie (puis à l'envers) ; filtres et tri sont dans l'adresse (`?nom=…&tri=bonus`), pour partager une recherche (`lib/metiers-tri.mjs`, testé).
Sur le site de dev, un métier s'ajoute, se modifie ou se supprime depuis le tableau (`docs/serveur.md`, « Édition »).

**Les métiers n'ont plus de page à eux** : les pages `metiers/<slug>` restent dans la base et dans les `.md` fabriqués (recherche, mots-clés, `[[liens]]`), mais aucune route n'est construite
et **tout lien vers un métier mène à sa ligne** (`[[Forgeron]]` → `/metiers/#metier-forgeron`, qui ouvre la description) : `lib/metiers.mjs#cheminDePage`, utilisé par `entryHref`, `pageHref`,
le plugin des `[[liens]]`, l'index de recherche et l'onglet DB. Seule « Règles des métiers » (`PAGE_DES_REGLES`, sans ligne dans `metier`) garde sa page, citée au-dessus du tableau.
`test/metiers.test.mjs` vérifie que les autres pages du type sont exactement les lignes de `metier` ; `test/metiers-html.test.mjs` contrôle le site construit (CI après le build).

## Bestiaire (`/bestiaire/`) : deux tableaux filtrables

Les monstres du Google Doc « Bestiaire 2.0 » et, à part, les créatures invoquées : un onglet chacun, avec recherche et filtres à cases ; un grand tableau
trié par en-tête pour les monstres, trois tableaux dépliables (un par invocation) pour les créatures invoquées ; la carte d'une ligne (ou d'une case) à
côté ; rendus depuis les tables (`lib/bestiaire-db.mjs`), jamais depuis un Markdown. Les monstres n'ont pas de page.
La page, l'extraction du doc et les questions en attente : [`bestiaire.md`](bestiaire.md).

## Chronologie (`/chronologie/`) : une page par événement daté

Les événements que datent le Codex et les pages de race, une page chacun, lus comme le guide mais avec une frise en haut et en bas ; rendus depuis les tables
`evenement` et `evenement_extrait` (`lib/chronologie-db.mjs`), jamais depuis un Markdown : un événement n'a pas de page du wiki. Ses extraits sont **copiés**
des pages (registre `tools/chronologie/evenements.json`) : une page du Codex ou d'une race se corrige à sa place, puis le registre est relu (`--verifier`).
Règles de sélection et questions en attente : [`chronologie.md`](chronologie.md).
## Armes (`/ressources/armes/`) : un tableau par famille, la fiche de l'arme forgée

Demande du propriétaire (2026-10-13) : « Pas de tableau markdown, inspire-toi des sorts et fais un tableau par type d'arme. » La page est rendue depuis
les tables (`lib/armes-db.mjs`, `components/armes/`), jamais depuis son Markdown, dont seules les règles de l'onglet (introduction, « Comment déterminer le
prix de votre arme ? ») s'affichent, repliées ; le reste du Markdown (tableaux) ne sert qu'à la recherche et aux `[[liens]]`, et suit les tables à chaque
modification (`lib/corps-armes.mjs`).

- **Un tableau repliable par famille** (bandeau de l'onglet : Épées, Dagues…), sans les armes de monstres (décision R45). Colonnes : Nom (la description en
  infobulle), Compétence, Type, Dégâts, Type de dégâts, Portée, Durabilité, Effets supplémentaires, Origine. Les colonnes Dégâts (dé de l'arme, « D8 au lieu
  du D10 » de son effet, sinon celui de son type ; plus son bonus), Type de dégâts, Portée (1 par défaut, décision R50), Durabilité (2 crans de base, corrigés
  par « 1 seul cran » ou « ±1 cran »), Origine (« Origine X » ou « Facture X ») sont tirées de l'effet (`lib/arme-champs.mjs`) ; **Effets supplémentaires** =
  l'effet sans les clauses montrées ailleurs (une clause qui en contredit une autre reste écrite).
- **Compétence** (décision R48) : la compétence que l'onglet écrit sous le type, dans la couleur de sa caractéristique (table `competence`) — Lourde
  (Force), Légère (Agilité), Lourde / Légère (dégradé Force - Agilité), Arc (Force), Arc / Légère (dégradé Force - Agilité), Arbalète (Perception) ;
  la légende les reprend toutes.
- **Armes de départ** (nom sur fond bleu dans la source) : ligne en bleu, infobulle « Arme de départ ».
- **Sélection** (`src/scripts/armes.mjs`) : cliquer une arme ouvre à côté sa fiche (résumé collant : dégâts, durabilité, coût), puis les **matériaux**
  (case Matière dans sa couleur de l'onglet : `lib/materiaux-couleurs.mjs` ; prix en RO seulement) et les **améliorations** (+1 à +10, ligne TOTAL).
  Choisir un matériau (le fer par défaut) et une amélioration ajuste la fiche (`lib/arme-forge.mjs`, décision R49) : dégâts = dé de l'arme + bonus de
  l'arme, du matériau et du niveau d'amélioration ; durabilité = celle de l'arme + crans du matériau et de l'amélioration, au moins 1 (R51) ; coût = arme + niveaux +1 à +N
  + un matériau pour forger et ceux des niveaux, payés en RO ou fournis ; l'effet du matériau en vert. État dans l'adresse (`?arme=…&materiau=…&amelioration=N`).
  Sans JavaScript, tous les tableaux s'affichent, sans fiche.
- **Mode modification** (site de dev) : rien ne se sélectionne, tous les tableaux s'ouvrent, quatre colonnes de plus (Description, Coût, Effet, Arme de
  départ) ; une arme se crée (« + Ajouter une arme ») ou se supprime (retirée des fiches, R52) ; le nom d'un matériau change aussi pour les armures et les
  boucliers ; voir `docs/serveur.md`, « Édition ». La fiche de personnage calcule les mêmes dégâts (`degatsDArme`) et pose le fer avec l'arme choisie.
- `test/arme-champs.test.mjs` (découpages rejoués sur toute la base), `corps-armes.test.mjs`, `arme-forge.test.mjs` (l'exemple du propriétaire : Espadon
  en titane +5 = D10+29, 620 RO et 3 titanes ou 1 220 RO), `serveur-edition-armes.test.mjs`, `armes-html.test.mjs` (site construit).


## Pages de classe : un gabarit commun, alimenté par la base

Les 39 pages de `/classes/<classe>/` sont rendues comme les pages de magie et de race : `components/classes/ClassePage.astro` (avec `ClasseDons`, `ChoixDeDons`, `DonCarte`) affiche
les lignes des tables lues par `client/src/lib/classes-db.mjs` : `classe`, `categorie_classe`, `specialite`, `capacite`, la vue `v_capacite_exclusive`, `type_don`, `classe_maitrise_arme`,
`classe_maitrise_armure`, `classe_objet_depart`, `objet_depart`, `classe_annexe`. **Aucun tableau Markdown** (le « Don de départ » est en tuiles, le tableau sans titre du Mage Bleu en cartes),
pas de source citée ; le Markdown de la page ne sert plus qu'à la recherche et aux `[[liens]]`. La classe d'exemple, sans ligne dans `classe`, garde le rendu Markdown.

- **Bandeau** : catégorie du Sommaire, santé, chakra et barrière de départ, « Classe magique +4 AM » (la classe elle-même, ou seulement « avec la spécialité … » quand c'est le don
  de cette spécialité qui le dit : classes raciales, Flagelleur ; `lib/classe-magique.mjs`), « Classe raciale » avec le lien vers la race.
- **Couleur** (demande du propriétaire), sur toute la page comme celle d'une magie, d'après la catégorie de `/classes/` (`lib/class-groups.mjs#classColor`, testé) : rouge pour les
  physiques de mêlée, vert pour les physiques à distance, bleu pour les magiques, violet pour les raciales (hybrides), jaune pour les spéciales (Parleur compris). Repère visuel sans valeur de règle.
- **Sections** : présentation et « Chose à savoir », descriptions des spécialités (un article par spécialité qui a des dons, caché tant qu'il n'a ni description ni remarque :
  le mode modification l'ouvre pour le remplir), « Au départ » (maîtrises, arme, armure, inventaire : chaque objet du glossaire a son infobulle, « A OU B »
  est un emplacement à deux options), **Dons**, tableau sans titre de l'onglet (Mage Bleu : une carte par magie).
- **Dons** (les « capacités » des onglets ; demande du propriétaire : c'est leur nom) : disposés **comme l'onglet** (`lib/classe-dons.mjs#plateauDeDons`, testé dans
  `test/classes-dons.test.mjs`), de haut en bas : les dons reçus sans choix (colonne P : niveaux 1 et 5), les deux spécialités (une seule au choix : elle exclut l'autre et
  tous ses dons), et le don du niveau 20 en bas ; l'Archimage a des groupes de 2 ou 3 dons au choix. **Spécialités en onglets** (demande du propriétaire) : le premier dans le coin gauche,
  le second dans le coin droit (comme les bannières A17 et X17), une pastille « ou » entre eux ; l'onglet ouvert montre le cartouche de la spécialité puis ses trois choix sur toute la largeur.
  Motif « tabs » de l'ARIA (flèches, Début, Fin) posé par le script commun `components/Onglets.astro` ; une adresse ou un lien vers une spécialité ou un de ses dons (`#don-…`, la fiche du don) ouvre son onglet ;
  sans JavaScript et à l'impression, les deux spécialités se suivent avec leur titre ; une classe qui n'a qu'une spécialité (l'autre supprimée sur le site de dev) la montre seule,
  sans « Au choix » (« Niveau 10 : la spécialité de la classe. »). **Chaque choix est encadré** (« Au choix · Niveau N : un seul des deux »), ses options **côte à côte**
  (l'une sous l'autre sur un téléphone) avec une pastille « ou » entre elles ; les choix sont ceux de la vue `v_capacite_exclusive` (la disposition de l'onglet fait foi), le test
  vérifie qu'ils coïncident. Une carte de don : niveau, nom (lien vers la fiche), type (nom du guide, sa définition en infobulle, un `title`) et sa précision telle qu'écrite (« 2 fois/Combat »),
  effet, remarque du classeur. Ancre `#don-<slug>` : la fiche d'un don y renvoie.
- Le CSS est dans `client/src/styles/classe/` (et `styles/magie/tooltips.css` pour les infobulles), injecté par `ClassePage.astro` (`?raw`) seulement. `test/classes-html.test.mjs` contrôle
  le site construit (la CI le lance après le build).

**Pour changer une classe ou un don, on change la base**, depuis le site de dev (mode modification : ses champs, et des spécialités et des dons créés ou supprimés,
D11 ; `docs/serveur.md`, « Édition ») ou par une migration (`data/migrations/NNNN-<nom>.sql`, voir `docs/sql/remplissage.md`) : modifier le `.md` fabriqué n'a plus d'effet sur la page.
Une page construite avant une création ou une suppression est redessinée par le mode modification avec le même HTML (`lib/classe-dons-rendu.mjs`, testé contre le site construit).

## Guide du joueur (`/guide/`) : des chapitres à lire dans l'ordre

L'onglet Guide n'est plus une liste de liens (demande du propriétaire) : c'est un **guide du joueur** pour débutants, lu page après page, avec une flèche de
chaque côté du texte (grisée au premier et au dernier chapitre), les touches ← → et, en bas, les chapitres voisins et la pagination (titre en infobulle).
La page prend **toute la largeur** du site : les flèches ne prennent pas de place, elles passent **par-dessus** ses bords, collées en bas de l'écran, et
s'effacent dès que les liens du bas arrivent à l'écran (demande du propriétaire ; `styles/guide/guide.css`, script de `GuideChapitre.astro`). Sous 52rem,
elles disparaissent.
Sur écran tactile, **glisser le doigt** vers la gauche mène au chapitre suivant, vers la droite au précédent (demande du propriétaire ; script de
`GuideChapitre.astro`) : geste franchement horizontal, d'un seul doigt, ni sur un tableau qui défile, ni depuis le bord de l'écran (gestes du système), ni
sur une page zoomée ; la page suit un peu le doigt. `overscroll-behavior-x: none` empêche Chrome d'en faire aussi un retour dans l'historique.

- **Un chapitre** est une page `guide/<slug>` (famille `docs`) dont le frontmatter porte `chapitre: N` (1, 2, 3… sans trou : l'ordre de lecture) et
  `partie: <id>`. Les autres pages du type `guide` (« Fiche de personnage : … », combat, conseils au MJ, listes) sont des **pages de référence** :
  citées par les chapitres et listées, par document source, à la dernière page (« Les documents des règles »).
- **Les parties** et leurs couleurs sont dans `client/src/lib/guide.mjs#PARTIES` : Découvrir, Créer son personnage, Jouer, Progresser, Pour aller plus
  loin ; les chapitres d'une partie se suivent. La pagination et le sommaire de la page 1 sont regroupés par partie. Le plan (24 pages, validé par le
  propriétaire) : découvrir le jeu et la règle du D100 **avant** de créer son personnage ; la création en six étapes, dans l'ordre où l'on remplit la
  fiche, les attributs (qui se calculent) à la fin ; l'équipement avant les dégâts (la formule utilise l'armure). `test/guide.test.mjs` l'épingle.
- **Le premier chapitre** (`guide/bienvenue`) est servi à `/guide/` : il n'a pas de page à lui, ses liens y mènent (`adresseDePage`).
- **Les blocs tirés de la base** : une ligne seule `<!-- guide:<bloc> -->` dans le Markdown (`BLOCS`) est remplacée au rendu par un tableau lu dans
  la base (`lib/guide-db.mjs`, `components/guide/GuideBloc.astro`) : progression (`niveau_global`), postures, compétences, initiative, ce que donne
  chaque magie, types de don, entraînement… Ne jamais recopier ces chiffres dans le texte. Les caractéristiques (cadre de leurs compétences, « +1 en … » d'une
  magie) et les postures y sont dans leur couleur (demande du propriétaire, `lib/caracteristiques-postures.mjs`, clés = ids de la base, testé : Force
  #FF6666, Volonté #FF99FF, Intelligence #66CCFF, Perception #FFCC00, Social #DDDDDD, Agilité #99FF66 ; Offensif #FF6666, Neutre #EEEEEE, Défensif
  #99FF99, Focus #9999FF, Vigilance #FFFF66, Symbiose #CC66FF) : couleurs claires, en aplat sous un texte foncé. Un lien Markdown vers une rubrique s'écrit depuis la racine
  (`[les races](/races/)`) : le préfixe de déploiement est ajouté au rendu (`avecPrefixe`).
- **Les personnages fil rouge** (`lib/guide-fil-rouge.mjs`) : quatre pré-tirés (archer felfe Vide, mage rouge majin Feu, guerrier orios Sang, barde
  kitsune Vent). Seuls leurs choix y sont écrits (race, ethnie, magie, classe ; `nom` à venir) ; santé, chakra, barrière, maîtrises, équipement et
  emplacements de sorts sont lus dans la base et calculés comme la fiche automatique V15.2.2.
- Un chapitre n'a ni fil d'Ariane, ni mots-clés, ni pages liées, ni sources sous le texte (la lecture continue par la pagination) ; `sources:` reste
  dans le frontmatter. Rendu : `components/guide/GuideChapitre.astro`, CSS `styles/guide/guide.css` (`?raw`).
- **Modifier une page du guide sur le site de dev** (demande du propriétaire ; `docs/serveur.md`, « Édition ») : crayon, puis le texte se modifie en
  place, avec une barre d'outils (paragraphe, titres, citation, listes, gras, italique, barré, lien vers une page du wiki ou une adresse, retirer un
  lien, tableau, ajouter ou supprimer une ligne ou une colonne, couleur des cases). Les blocs tirés de la base ne se modifient pas ; le titre, si
  (l'ancien devient un alias). À l'enregistrement, chaque morceau de texte modifié est réécrit en Markdown (`lib/markdown-edition.mjs`, aller-retour
  vérifié sur toutes les pages du guide par `test/markdown-edition.test.mjs`) : un morceau inchangé garde son écriture exacte.
- **Couleur d'une case de tableau** : `{couleur:vert}` en tête de case (`| {couleur:vert} Réussite | … |`) ; couleurs : rouge, orange, jaune, vert,
  bleu, violet, gris (`COULEURS_DE_CASE`). Le plugin `lib/markdown-couleurs.mjs` en fait l'attribut `data-couleur` (palette dans
  `styles/global/wiki.css`) ; tout autre texte entre accolades reste tel quel.

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
- **Valeur à N NM** (`lib/sort-maitrise.mjs#valeurAuNm`, tableau des sorts de la fiche de personnage ; demande du propriétaire : la valeur calculée plutôt que
  « (+1/NM) ») : un bonus par NM entre parenthèses s'ajoute au terme qui le précède dans sa phrase quand ce n'est qu'un calcul (« 45 (-5/NM) » à 2 NM → 35 ;
  « 2d6 dégâts (+1d6/NM) » → 4d6 ; « 5d6 dégâts (+3/NM) » → 5d6 + 6 ; « 10d6 + 80 (+10/NM) » → 10d6 + 100) ; sinon il est écrit appliqué à la place de son
  expression (« 1 ou 2 clones (+2) ») ; à 0 NM il disparaît (la valeur de base, comme `sansBonus`) ; un palier « 3NM = … » ne garde son effet qu'au seuil ;
  toute autre écriture (« x4/3NM », « au niveau 3 de maîtrise ») reste telle qu'écrite. Les pages de magie, elles, montrent toujours l'expression en pastille.
  `test/maitrise-sorts.test.mjs` le rejoue sur tous les sorts, de 0 à 3 NM.
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
`test/capacites-content.test.mjs` rejoue ces exemples sur les pages de l'import (le site de dev peut ajouter ou retirer des dons).

**Dons et spécialités créés sur le site de dev** (D11, `docs/serveur.md`, « Édition ») : la fiche d'un don créé a pour seule source sa provenance
« Site de dev › édition du AAAA-MM-JJ », ses mots-clés (« capacité de classe », la classe telle que l'écrivent ses frères, la spécialité), son corps et
son résumé tirés de sa ligne ; ses champs structurés (`classe`, `specialite`, `niveau`, `nature`, `rang`, `ligne`, `type_capacite`,
`choix_exclusif_avec`) sont **tirés des tables** (`lib/dons-edition.mjs#donneesDeDon`, qui redonne les 660 fiches de l'import à l'octet près) et refaits
quand un voisin change : le `rang` d'un don reçu sans choix est sa place de haut en bas parmi ceux de sa classe, celui d'un cartouche le rang de sa
spécialité. La même règle des choix décide de la nature : une option fait d'un don reçu d'office un choix ; le dernier don d'un choix hors spécialité
redevient reçu sans choix ; dans une spécialité, il reste un choix sans alternative (la page le montre seul, la fiche ne le propose pas).

**Bonus d'armure magique (+4 AM)** (`lib/classe-bonus.mjs`) : toute classe magique l'a (Sommaire : « Octroie 4 AM de base par classe
magique »). Pour une classe raciale, c'est sa 2ᵉ spécialité, le pendant lanceur de sort : la capacité de spécialisation de niveau 10 y dit
« considérer comme classe magique ». Le site lit cette phrase dans la fiche de la capacité, il ne devine pas la spécialité. L'Archimage est
une classe magique : la fiche V15.2.2 (BDD!H40, I40, BB2) le range parmi elles pour ce bonus et le propriétaire du projet le confirme ; le Sommaire le classe « spéciale » parce que
ses règles diffèrent de celles des autres classes (pas de spécialité, des groupes de choix par palier). La page de l'Archimage donne cette explication.

## Codex (type `lore`) : le Google Doc « CODEX Maverick »

Les pages du Codex (116) sont fabriquées par `tools/docs/codex.py` depuis l'export du document rangé dans `sources/raw/` : une page par section
(divinité, temple ou guilde, nation ou région, objet légendaire), des pages de sommaire et `lore/codex` pour tout le document. Le texte est celui du
document ; seules les corrections du registre `tools/docs/codex-corrections.json` s'y appliquent. Ne pas modifier ces pages à la main : un nouvel export
les réécrit (`codex.py`, `--verifier`, `npm run db:sync-pages`). Détail, corrections et questions ouvertes : [`codex.md`](codex.md).

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
  « Pages à créer » de l'index du wiki (`/pages/`) ;
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
- les locutions courantes qui sont aussi un titre (par exemple « en résumé ») se déclarent dans `client/scripts/autolink-ignore.txt` ;
- les pages de race, de classe, de don et de magie ne reçoivent pas de liens (`TYPES_SANS_MAILLAGE`, `src/lib/autolink.mjs`) : leur corps est refait
  depuis les tables par le mode modification (rendu de l'importeur), un lien y serait perdu, et `races_onglet.py --verifier` le refuserait ; elles
  restent des cibles.

L'outil ne modifie que du balisage de lien (vérifié : en retirant les `[[…]]`, on retrouve exactement le texte d'origine) et
peut être relancé sans risque après chaque import. Relire le résultat avec `git diff` avant de commiter.

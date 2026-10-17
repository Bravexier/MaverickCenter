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
tags: [peuple, forêt]           # mots-clés (vocabulaire mot_cle) : /recherche/?mot-cle=<id>
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


## Tableaux : un gabarit commun à tout le site

Demande du propriétaire (2026-10-17) : « De manière générale il faudrait uniformiser tous les tableaux sous le même template commun ». Tous les
tableaux de règles suivent le même gabarit, écrit à un seul endroit (`styles/global/tableaux.css`, chargé sur toutes les pages) :

- **le cadre** (`.tableau`) : fond, bordure, coins arrondis ; un **titre** facultatif (`.tableau__titre` : le `<summary>` d'un tableau repliable, avec
  son chevron, ou un titre `<hN>`), le nom (`.tableau__nom`, en lien vers une page s'il le faut) et le compte à droite (`.tableau__compte`) ; une
  **note** sous le titre (`.tableau__note`) ; la **zone qui défile** en largeur (`.tableau__defile`, ou le cadre lui-même : `.tableau--defile`) ;
- **la table** (`.table-donnees`) : en-têtes en petites capitales sur un fond teinté, un filet entre deux lignes, cases alignées en haut à gauche ;
  deux densités (`.table-donnees--serree` : tableaux où l'on choisit une ligne — matériaux, formes, améliorations, étapes des accessoires — et
  bestiaire ; `.table-donnees--aeree` : les armes, « l'affichage est trop serré ») ; une **ligne colorée** (`tr.ligne-couleur`, `--ligne-fond`, `--ligne-texte`) prend toute la couleur de sa source (potions, bâtons
  magiques, matériaux des armes), un filet de sa teinte, un voile au survol ;
- **plusieurs tableaux** : `.tableaux` (l'un sous l'autre) ou `.tableaux--cote-a-cote` (autant par rangée que la largeur en tient : la largeur
  minimale d'un tableau, `--tableau-largeur`, 26rem par défaut, en fixe le nombre ; 30rem pour les potions de la ceinture, deux ou trois dans la page
  de 120rem) ; un tableau dans un groupe de tableaux a un nom plus petit que celui du groupe ;
- **la teinte** : l'accent du site, sauf celle que la page pose sur son conteneur (`--tab`, `--tab-soft`, `--tab-line`) : la couleur de la magie, de
  la race, de la partie du guide…

Le composant `components/Tableau.astro` écrit ce HTML (cadre, titre, compte, note, zone qui défile, `<table>` ; slots `titre`, `outils`, `avant`,
`apres`) ; son `bloc` pose aussi les classes de la page (`armes-famille`, `armes-famille__compte`…), auxquelles s'accrochent les scripts, les tests et
la feuille de la page, qui ne garde que ce qui lui est propre (largeurs de colonnes, couleurs, lignes sélectionnables) ; `attributsNom` et
`attributsNote` posent les champs du mode modification sur le nom et la note (avec `attributsNote`, la note est toujours écrite, cachée tant qu'elle est
vide : les onglets de « Composants », dont chaque panneau est un tableau du gabarit). Ceinture, Composants, Armes,
Armures et boucliers l'emploient ; les accessoires, les sorts, les races, les métiers, le bestiaire et les blocs du guide posent les classes
eux-mêmes. Les tableaux écrits en Markdown (pages du wiki, chapitres du guide) prennent le même gabarit par leur conteneur (`.prose`, `.guide-texte`),
leur cadre à la largeur du tableau, l'alignement que le Markdown écrit gardé (en mode modification, leurs cases sont marquées d'un pointillé, pour
écrire dedans). La table et ses cases sont sous `:where()` : une règle de page les précise toujours, quel que soit l'ordre des feuilles. Restent à
part deux grilles dont les colonnes portent le sens : les matrices des magies de `/magies/` et `/races/` (en-têtes verticaux, une colonne teintée
par magie) et le butin d'une carte de monstre (une colonne par échelle) ; et les tableaux de saisie de la fiche de personnage, de la page Debug et de
l'onglet DB. `test/tableaux.test.mjs` garde la règle : la présentation des en-têtes n'est écrite qu'une fois, et chaque tableau des
pages de règles construites suit le gabarit, dans sa zone qui défile.

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
  le nom est sur la couleur de sa magie (de la marge du bloc, sinon celle du sort), en dégradé quand il en a deux, sans lien « Bestiaire » à côté (demandes du propriétaire). Sans JavaScript, les panneaux des sorts et la règle du NPM 5 sont affichés, la carte reste cachée et l'attribut `title` du nom en donne les valeurs (santé, chakra, barrière, défense, vitesse, dégâts) ;
  les règles d'invocation et l'annexe restent dans leur `<details>` replié.
- **Infobulles** (`components/Infobulles.astro`, commun à tout le site, `Info.astro`, `EtatPastille.astro` ; habillage `styles/global/infobulles.css`) : au survol (la bulle reste ouverte quand le pointeur passe dessus), au focus clavier (Échap ferme la bulle seule, pas le panneau du sort) ou au toucher (un premier appui ouvre la bulle,
  un second suit le lien d'une pastille d'état), en position fixe près du déclencheur, bornée à l'écran (le tableau défile et couperait une bulle absolue) ; sans JavaScript l'attribut `title` du déclencheur donne le même contenu en texte simple. La bulle n'est faite que
  d'éléments « en ligne » (`<span>`) : une pastille est posée dans un paragraphe, où un bloc fermerait le `<p>` et ferait fuir le contenu de la bulle (`test/magies-html.test.mjs` le vérifie sur le site construit, ainsi que le câblage `aria-*`) ;
  seule exception, la carte d'une créature invoquée (`<div class="bulle bulle--carte">`), posée hors de tout paragraphe, après les tableaux de sorts.
  Avec JavaScript, **jamais l'infobulle du navigateur** (demande du propriétaire) : tout attribut `title` du site, écrit dans la page ou posé par un script, est
  aussitôt déplacé dans `data-infobulle` et s'affiche dans la bulle habillée (voir `CLAUDE.md`, « Infobulles »).
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

Les événements que datent le Codex et les pages de race, une page chacun, ouverte à droite d'une frise verticale en dégradé (date à gauche de la barre, titre à droite) ; deux chevrons, Haut et Bas, passent au précédent ou au suivant ; rendus depuis les tables
`evenement`, `evenement_extrait`, `categorie_chronologie` et `evenement_categorie` (`lib/chronologie-db.mjs`), jamais depuis un Markdown : un événement n'a pas de page du wiki. À l'import,
ses descriptions ont été **copiées** des pages (registre `tools/chronologie/evenements.json`, aujourd'hui la trace de l'import) ; depuis, elles se modifient
sur le site de dev, avec la date, le titre, le lien de chaque description et les catégories (plusieurs par événement ; sans catégorie, « Sans catégorie
(à trier) », sur le site de dev seulement) ; la frise se filtre par catégorie (une à la fois).
Règles de sélection et questions en attente : [`chronologie.md`](chronologie.md).
## Équipement (`/ressources/equipement/`) : armes, armures, boucliers, ceinture et accessoires

Demandes du propriétaire (2026-10-16) : « J'aimerai fusionner "Armes" et "Armures" dans un seule onglet : "Equipement" A l'instar de "Armure et bouclier"
les "Armes" seront dans un onglet à part. Il faudrait également un 4em onglet pour les bâtons magiques du coup qui auront mieux leur place ici » ;
« J'aimerai rajouter un 5 onglet pour y déplacer les accessoires » ; puis « revoir intégralement la page des objets à la ceinture, renommer l'onglet
en "Ceinture" et le mettre dans les onglets de équipement » (« Ceinture » ci-dessous). Une seule entrée du menu Ressources, **Équipement**, à la place
d'« Armes », d'« Armures », d'« Accessoires » et d'« Objets à la ceinture » ; une page sans page du wiki (`src/pages/ressources/equipement.astro`, `components/equipement/EquipementPage.astro`,
`styles/equipement/equipement.css`), rendue depuis la base, en **cinq onglets** (`components/Onglets.astro`, posé une fois ; sans JavaScript, les panneaux
se suivent, chacun sous son titre), dans l'ordre de `lib/equipement.mjs#ONGLETS_DE_L_EQUIPEMENT` :

| Onglet | Ancre | Page du wiki servie | Contenu |
| --- | --- | --- | --- |
| Armes | `#armes` (ouvert au départ) | `ressources/armes` | « Armes » ci-dessous (`components/armes/ArmesPage.astro`) |
| Armures | `#armures` | `ressources/armures` | « Armures et boucliers » ci-dessous (`components/armures/ArmuresPage.astro`) |
| Boucliers | `#boucliers` | `ressources/bouclier` | idem |
| Ceinture | `#ceinture` | aucune (l'ancienne page `/ressources/objets-a-la-ceinture/`, sans page du wiki) ; son sous-onglet Bâtons magiques (`#batons-magiques`) sert `ressources/baton-magique` | « Ceinture » ci-dessous (`components/ceinture/CeinturePanneau.astro`) : trois sous-onglets, Consommables, Carquois, Bâtons magiques (celui-ci avec son panneau de règles) |
| Accessoires | `#accessoires` | `ressources/accessoires` | « Accessoires » ci-dessous (`components/accessoires/AccessoiresPage.astro`) |

- Les cinq pages du wiki servies (`lib/equipement.mjs#PAGES_SERVIES_PAR_L_EQUIPEMENT` : quatre onglets et le sous-onglet des bâtons) **ne sont plus
  construites** (`lib/metiers.mjs#pageSansAdresse`) : elles restent dans la base (recherche, `[[liens]]`, contexte des liens de leur panneau de règles) ;
  leurs liens mènent à leur onglet (`adresseDePage`), leurs anciennes adresses aussi, par la page 404 (`lib/nav.mjs#PAGES_RENOMMEES`, la requête gardée :
  `/ressources/armes/?arme=…` → `/ressources/equipement/?arme=…#armes`), comme celle de l'ancienne page « Objets à la ceinture » (→ `#ceinture`). Les liens écrits à la main
  dans les chapitres du guide mènent aux onglets depuis la migration `0053-liens-page-equipement` (la version portable n'a pas de page 404).
- Un lien vers un élément d'un panneau (`#famille-bombes`, `#bouclier-ecu-fer`, `#effets-…`, `#batons-magiques`, `#objets-huile`) ouvre son onglet (et son
  sous-onglet). Chaque onglet garde son script
  (`src/scripts/armes.mjs`, `armures.mjs`, `batons.mjs`, `accessoires.mjs`) et ses paramètres d'adresse, **sans aucun en commun** (celui des bâtons n'en a pas) (l'amélioration d'une armure est
  `amelioration-armure`, celle d'une arme `amelioration`) : une même adresse garde l'état de plusieurs onglets. Échap ne ferme l'arme ouverte que si
  l'onglet Armes est affiché.
- Identifiants uniques sur toute la page : les matériaux et les améliorations des armes sont `#materiaux-armes`, `#ameliorations-arme`, celles des
  armures et des boucliers `#ameliorations-armure`, `#ameliorations-bouclier`. Le tableau MATÉRIAUX des armures et des boucliers (`#materiaux-armures`,
  lignes `#matiere-<clé>`) n'existe plus : il est mêlé à celui de la page « Composants » (voir « Armures et boucliers »).
- Mode modification (site de dev) : les onglets Armes, Armures et Boucliers comme avant (`src/scripts/edition/armes.mjs`, `armures.mjs`, chacune
  active dès que son bloc est dans la page) ; les cinq panneaux de règles (`src/scripts/edition/panneaux.mjs`, ci-dessous) ; les tableaux des
  consommables de la ceinture (« Ceinture » plus bas : les cases saisies des potions, par l'éditeur commun) ; ni les carquois ni les bâtons de la
  ceinture, ni les tableaux des accessoires.
- Tests : `test/equipement.test.mjs` (onglets et sous-onglets, adresses, menu, chargement, prix et rendu des bâtons), `equipement-html.test.mjs` (site
  construit : onglets et panneaux dans l'ordre, identifiants uniques, panneaux de règles, bâtons, anciennes pages absentes et plus aucun lien vers elles,
  scripts), `batons-script.test.mjs` (le curseur des bâtons, dans un faux navigateur) ; le contenu de chaque onglet : `armes-html`, `armures-html`,
  `ceinture-html`, `accessoires-html.test.mjs` ; les panneaux de règles : `panneaux-regles.test.mjs` (lecture, ordre, rendu, copie de l'import),
  `serveur-edition-panneaux.test.mjs` (le service).

### Panneaux de règles (en tête des onglets et du sous-onglet Bâtons magiques)

Demande du propriétaire (2026-10-16) : « Il faudrait refaçonner tous les encarts de début des onglets des équipements. La première ligne serait à
supprimer et intégrer dans le panneau déroulant. Il faudrait que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs
inclure des tuiles génériques (toujours insérables / modifiables en mode édition). Si l'écran est assez large, la zone de texte prendra deux colonnes.
Sinon une seule. Dans le cas présent pour les armes les blocs modulaires à séparer (et garder à part) seraient les définitions sur Recharge longue,
Recharge très longue, Mordhau, Dague et Arme de jet. »

- **Données** (migration `0056-glossaire-et-panneaux-de-regles`) : `panneau_regles` (un par page du wiki que la page sert,
  `lib/equipement.mjs#PAGES_SERVIES_PAR_L_EQUIPEMENT` ; son `id` est l'ancre de l'onglet ou du sous-onglet de cette page : `armes`, `armures`,
  `boucliers`, `accessoires`, et `batons-magiques`, le sous-onglet de l'onglet Ceinture ; son titre ; sa page, `page_id`, contexte des `[[liens]]`) et
  `panneau_regles_bloc` (ses blocs : `rang`, la clé, jamais redonné ; `ordre`, la place de lecture, non unique, à égalité le rang ; `tuile` 0 ou 1 ; le titre facultatif d'une tuile,
  jamais d'un bloc de texte ; le texte, du Markdown des pages). La migration a **copié** le texte que l'onglet affichait (tiré du corps de la page) ;
  depuis, le site de dev en est la source, et le corps de la page (`page.corps_md`) **n'est plus que la trace de l'import** de ces règles : il n'est plus
  affiché ni modifié (la recherche le lit encore, après le texte des panneaux, voir plus bas). Lecture : `lib/panneaux-regles-db.mjs` (`chargerPanneau`,
  `ordonnerBlocs`) ; `test/panneaux-regles.test.mjs` compare les panneaux aux pages servies (un panneau par page, son id = l'ancre :
  `PAGES_SERVIES_PAR_L_EQUIPEMENT`) et vérifie que chaque bloc de l'import se lit mot pour mot dans le corps de sa page.
- **L'onglet Ceinture n'a pas de panneau de règles** (il ne sert pas de page du wiki) : il garde son encart, le chapeau et les règles de la ceinture
  repliées (« Ceinture » plus bas), dont le texte est celui du guide, modifiable sur la page du guide.
- **Affichage** (`components/equipement/PanneauDeRegles.astro`, générique ; HTML des blocs : `lib/panneaux-regles-rendu.mjs`, le même au build et sur le
  site de dev ; CSS `.preg` dans `styles/equipement/equipement.css`) : plus de phrase au-dessus du panneau (le résumé de la page, qui répétait la
  première ligne) ; un `<details>` replié (celui des Accessoires déplié au départ, comme avant), le titre dans son `<summary>`, puis les blocs dans l'ordre
  de lecture : un **bloc de texte** est de la prose qui suit les colonnes, une **tuile** un cadre (filet de couleur à gauche, comme un don de classe ou
  une capacité du bestiaire) avec son titre s'il en a un. **Deux colonnes** séparées d'un filet à partir de 64rem, une seule en dessous ; une tuile, un
  paragraphe ou une liste ne se coupe jamais entre deux colonnes, et la fin d'un bloc de texte suivi d'une tuile reste avec elle (« CAS PARTICULIERS : »
  n'est jamais seul en bas d'une colonne ; `break-after: avoid`, que Firefox n'applique pas aux colonnes). Le Markdown de chaque bloc est rendu au build par `lib/guide-rendu.ts` (`[[liens]]`,
  couleurs, monnaies en icônes) avec la page du panneau comme contexte (`src/pages/ressources/equipement.astro`). Dans celui des armes, « Les armes en
  bleu… » prend le bleu des armes de départ (`lib/armes-rendu.mjs#avecPhraseDesArmesDeDepart`, sur le HTML du bloc qui la contient).
- **Panneaux à l'import** : Armes — l'introduction (fabrication, recyclage, bonus du matériau), trois tuiles **Recharge longue**, **Recharge très
  longue** et **Mordhau** (sans titre : chacune n'est que la balise du mot-clé en mode complet, « `{{recharge-longue:}}` », la définition vivant dans le
  glossaire), « Les armes en bleu… » et « CAS PARTICULIERS : », puis les tuiles **Dague**, **Arme de jet** et **Comment déterminer le prix de votre
  arme ?** ; Armures, Boucliers et Accessoires — leur texte en un bloc ; Bâtons magiques — l'introduction, puis la tuile **Comment fabriquer un bâton
  magique ?**. Les titres des panneaux et des tuiles sont ceux de la migration (les intitulés de la page, en minuscules).
- **Mode modification** (site de dev, `src/scripts/edition/panneaux.mjs`, service `serveur/edition-panneaux.mjs`) : chaque panneau s'ouvre et reste
  ouvert ; son titre est un champ (un clic, une espace ou Entrée dans le `<summary>` ne le replient pas) ; le texte de chaque bloc et le contenu de chaque
  tuile se modifient en place (l'éditeur de la chronologie : Texte, Mise en page, Liens, Mots-clés ; sa barre à gauche de l'écran, à la hauteur du bloc
  où est le curseur ; les mots-clés en balises écrites, la tuile **Recharge longue** montre `{{recharge-longue:}}`), le titre d'une tuile est un champ ; sous chaque bloc, « ↑ » et
  « ↓ » (il change de place avec son voisin, enregistré avec le reste), « Supprimer » (à l'enregistrement, après confirmation ; le dernier bloc d'un
  panneau reste), « + Texte » et « + Tuile » (insérés après ce bloc, créés tout de suite, puis modifiables). Un bloc de texte se coupe entre les deux colonnes comme
  en lecture, ses outils restent sous sa fin. Voir [`serveur.md`](serveur.md), « Édition ».
- **Recherche** : le titre et les blocs des panneaux d'une page sont en tête du texte de son entrée (`lib/recherche-index.ts`) ; le corps de la page
  (la trace de l'import) suit.

## Armes (onglet Armes de `/ressources/equipement/`) : un tableau par famille, la fiche de l'arme forgée

Demande du propriétaire (2026-10-13) : « Pas de tableau markdown, inspire-toi des sorts et fais un tableau par type d'arme. » La page est rendue depuis
les tables (`lib/armes-db.mjs`, `components/armes/`), jamais depuis son Markdown ; ses règles sont le panneau de règles de l'onglet (« Panneaux de
règles » plus haut : leur texte a été copié de l'introduction et de « Comment déterminer le prix de votre arme ? ») ; le Markdown de la page (tableaux)
ne sert qu'à la recherche et aux `[[liens]]`, et suit les tables à chaque modification (`lib/corps-armes.mjs`).

- **Règles** (« le texte des règles est mal rendu ») : le Markdown de l'introduction portait la mise en forme de la cellule A1 de l'onglet (lue dans le
  classeur, perdue à l'import), que les blocs du panneau gardent — « Les armes en bleu… » en gras (et en bleu sur la page, le bleu des armes de départ :
  `lib/armes-rendu.mjs#avecPhraseDesArmesDeDepart`), ***CAS PARTICULIERS :*** en gras italique ; Recharge longue, Recharge très longue et Mordhau, Dague,
  Arme de jet et le prix sont des tuiles (migration 0056) ; le texte, lui, n'est pas réécrit. Sur un grand écran, deux colonnes.

- **Un tableau repliable par famille** (bandeau de l'onglet : Épées, Dagues…), sans les armes de monstres (décision R45), aéré (« l'affichage est trop
  serré »). Colonnes : Nom (la description en infobulle), Compétence, Type, Dégâts, Type de dégâts, Portée, Durabilité, Origine ; les **effets
  supplémentaires** sur une seconde ligne, sous l'arme (« à l'instar des sorts choisis de la fiche de personnage » : `tr.arme-suite`, cachée quand l'arme
  n'en a pas ; survol, sélection et couleur avec l'arme). Les colonnes Dégâts (dé de l'arme, « D8 au lieu du D10 » de son effet, sinon celui de son type ;
  plus son bonus), Type de dégâts, Portée (1 par défaut, décision R50), Durabilité (2 crans de base, corrigés par « 1 seul cran » ou « ±1 cran »), Origine
  (« Origine X » ou « Facture X ») sont tirées de l'effet (`lib/arme-champs.mjs`) ; les effets supplémentaires = l'effet sans les clauses montrées ailleurs
  (une clause qui en contredit une autre reste écrite).
- **Compétence** (décision R48) : la compétence que l'onglet écrit sous le type, dans la couleur de sa caractéristique (table `competence`) — Lourde
  (Force), Légère (Agilité), Lourde / Légère (dégradé Force - Agilité), Arc (Force), Arc / Légère (dégradé Force - Agilité), Arbalète (Perception).
- **Filtre par compétence** (« filtrer les armes par compétence arc / arbalète / légère et lourde ») : quatre boutons à bascule, Lourde, Légère, Arc,
  Arbalète, dans leur couleur (ils servent aussi de légende) ; une arme reste si l'UNE de ses compétences est choisie (« Arc / Arme Légère » sous Arc comme
  sous Légère), « Toutes » efface le choix, une famille sans arme affichée se cache, les comptes disent « N armes sur M » ; une arme ouverte qui disparaît
  se ferme. Plus **« Arme de départ »** (« trier par "arme de départ" ») : seules les armes de départ, en même temps que les compétences. État dans
  l'adresse (`?competence=arc,arbalete&depart=1`) ; pas de filtre sans JavaScript ni en mode modification (`lib/armes-filtres.mjs`, testé).
- **Armes de départ** (nom sur fond bleu dans la source) : ligne en bleu, infobulle « Arme de départ ».
- **Remarque** : une étoile ★ à côté du nom, son texte en infobulle (et dans la fiche de l'arme) ; à l'import, seule la Bombe perçante en avait une,
  supprimée par la décision R91 (elle datait des armes à feu).
- **Panneau de l'arme** (`src/scripts/armes.mjs`) : à côté des tableaux, **toujours affiché** sur un grand écran et **de la largeur de celui des
  armures** (demande du propriétaire, 2026-10-16 : « Avoir l'endroit de l'arme en permanence visible comme c'est le cas pour l'armure, et avec la même
  largeur ») ; sous 80rem, il passe par-dessus la page une fois une arme choisie, comme celui des armures. Il suit le défilement et remonte à la fiche
  quand on choisit une arme ; au bout de son défilement, la molette fait défiler la page (« qu'elle descende la fenêtre entière si le max est atteint sur l'intermédiaire » ; de même pour les armures et les
  accessoires). Cliquer une arme (ou la ligne de ses effets) remplit sa fiche, **un seul cadre réduit à son minimum** (« Pas besoin de détailler les calculs
  en dessous, une tuile en tooltip de la case dégâts / durabilité et coût suffit ») : son bouton Fermer (qui la vide) en haut à droite ; type et mains,
  compétence, arme de départ ; ce dont elle est forgée ; trois tuiles, Dégâts, Durabilité « Solidité : X », Coût, dont le **détail du calcul est
  l'infobulle** (bulle riche, `[data-armes-bulles]`, hors du panneau qui défile) ; puis, sans titre, les effets (types de dégâts, portée, effets
  supplémentaires, celui du matériau en vert), la description et l'origine (« Origine X » ou « Facture X », le mot de la source) (« On en garderai que l'effet la description et l'origine »). Plus de
  « dés selon la maîtrise » ni de « Le nombre de dés dépend de la maîtrise du personnage ». Dessous, côte à côte quand la place le permet, les
  **matériaux** — toute la ligne dans la couleur du matériau (`lib/materiaux-couleurs.mjs`), prix en RO seulement, effets sur une seule ligne : le bonus
  aux dégâts sans le mot « Dégâts » (gardé pour les lecteurs d'écran), puis les autres effets, séparés par « | » (« +7 | dégâts doublés contre la
  barrière »), lignes basses — et les **améliorations** (+1 à +10, sans ligne TOTAL : « La ligne "total" des amélioration est inutile », de même pour
  les armures et les boucliers). Le matériau et l'amélioration choisis restent marqués sans arme choisie.
  Choisir un matériau (le fer par défaut) et une amélioration ajuste la fiche (`lib/arme-forge.mjs`, décision R49) : dégâts = dé de l'arme + bonus de
  l'arme, du matériau et du niveau d'amélioration ; durabilité = celle de l'arme + crans du matériau et de l'amélioration, au moins 1 (R51) ; coût = arme + niveaux +1 à +N
  + un matériau pour forger et ceux des niveaux, payés en RO ou fournis ; l'effet du matériau en vert. État dans l'adresse (`?arme=…&materiau=…&amelioration=N`,
  avec `competence=…` et `depart=1` du filtre ; le matériau et l'amélioration y restent sans arme).
  Sans JavaScript, tous les tableaux s'affichent, sans fiche.
- **Mode modification** (site de dev) : rien ne se sélectionne, tous les tableaux s'ouvrent, cinq colonnes de plus (Description, Coût, Effet, Arme de
  départ, Remarque : saisie, l'étoile apparaît ; vidée, elle part, R91) ; une arme se crée (« + Ajouter une arme ») ou se supprime (retirée des fiches, R52) ; le nom d'un matériau change aussi pour les armures et les
  boucliers ; voir `docs/serveur.md`, « Édition ». La fiche de personnage calcule les mêmes dégâts (`degatsDArme`) et pose le fer avec l'arme choisie.
- `test/arme-champs.test.mjs` (découpages rejoués sur toute la base), `corps-armes.test.mjs`, `arme-forge.test.mjs` (l'exemple du propriétaire : Espadon
  en titane +5 = D10+29, 620 RO et 3 titanes ou 1 220 RO), `armes-filtres.test.mjs`, `serveur-edition-armes.test.mjs`, `armes-html.test.mjs` (site
  construit : filtre, seconde ligne des effets, panneau, règles mises en forme).


## Armures et boucliers (onglets Armures et Boucliers de `/ressources/equipement/`) : deux matériaux pour une armure, une forme et une matière pour un bouclier

Demandes du propriétaire (2026-10-15) : « Je souhaite faire la refonte de l'onglet armure, de la même manière que les Armes. […] Les deux seront dans la
page » ; « les autres armures étant composées de deux matériaux il faut donc deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée. Une
liste plus classique est disponible également. Il faut aussi le tableau d'amélioration » ; « Il faut aussi inclure ce fonctionnement pour les
boucliers » ; « Pour les bouclier c'est forme + matière ». La page est rendue depuis les tables (`lib/armures-db.mjs`, `components/armures/ArmuresPage.astro`,
`styles/armures/armures.css`), jamais depuis les Markdown des pages « Armures » et « Bouclier » ; leurs règles sont le panneau de règles de chaque
onglet (« Panneaux de règles » plus haut : le texte avant les tableaux, copié par la migration 0056) ; le Markdown ne sert qu'à la recherche et aux
`[[liens]]`, et suit les tables à chaque modification (`lib/corps-armures.mjs`).
**Les pages « Armures » et « Bouclier » ne sont plus construites** : leurs liens mènent à leur onglet de la page « Équipement » (voir plus haut) ; le
lien écrit à la main vers la page « Bouclier » dans le chapitre du guide « L'équipement » menait à l'onglet Boucliers depuis la migration
`0046-armures-boucliers`, il mène à celui de la page « Équipement » depuis la migration `0053-liens-page-equipement` (seule l'adresse a changé).

- **Deux onglets** de la page « Équipement » (avant, de la page des armures) : Armures et Boucliers, chacun avec son panneau de règles replié. **Plus de tableau
  MATÉRIAUX** sous les deux (prix, description, fabrication) : demande du propriétaire, 2026-10-16 (« Les onglets Matériaux présent en bas de page de
  l'Armure et du bouclier (avec les grand textes) devraient disparaitre et être mélangés au tableau des matériaux des Composants ») ; sa description et
  son prix étaient déjà ceux du tableau des matériaux de la page « Composants » (R62), sa fabrication y est une colonne ; chaque onglet y renvoie
  (`/ressources/composants/#materiaux`), et la description d'une matière reste l'infobulle de son nom dans les tableaux à choisir.
- **Armures** : deux tableaux des matières de la grille, « Premier matériau » et « Second matériau » (case Matière dans la couleur de son type — vert léger,
  jaune intermédiaire, rouge lourd, relevés sur la capture de l'onglet : `COULEURS_DES_TYPES` ; description en infobulle ; défense, solidité, prix, et
  « Prix ×6 », le prix pour une armure : les 6 unités du matériau qu'elle demande, décision R93 ; demande du propriétaire, 2026-10-16). Un
  matériau dans chacun donne l'armure de la grille (dans un ordre ou dans l'autre ; chaque paire de matières a son armure, testé). Dessous, la **liste**
  des armures : **les armures particulières en premier** (Nom, Type, AP, AM, Solidité « uni », Effet, Prix ; demande du propriétaire, 2026-10-16 : « tu
  met le tableau "Armure particulières" en tout premier de la liste des armures »), puis les armures de la grille par type (Nom, Matériaux, Type, AP,
  AM, Solidité, Résistance, Faiblesse, Prix ; « séparer les colonnes d'AP et d'AM », demande du propriétaire, 2026-10-16, comme dans la liste des
  boucliers) ; une ligne choisit l'armure (et ses deux matériaux). **L'AP et l'AM sont deux valeurs de la base, chacune modifiable dans sa case**
  (demande du propriétaire, 2026-10-17 : « C'est en base que les deux devraient être séparées et donc éditable aussi »), voir « AP et AM » plus bas. Une armure **ne se fabrique plus pièce par pièce, seulement
  complète** (décision R93) : plus de tableau FABRICATION ; les paragraphes des règles de l'onglet sur la création par pièces sont
  retirés du texte de la page (« Suppression de la création par pièces », décision R95, migration `0055`), et donc du panneau de règles de l'onglet. **Prix d'une armure de la grille** (R93) : la fabrication de l'armure complète (ligne « Armure Complète » du tableau FABRICATION,
  10 RO, écrite dans la phrase du prix au-dessus des matériaux, modifiable sur le site de dev) + 6 unités de chacun de ses deux matériaux, au prix de la
  page Composants (R62) ; calculé partout (au build : `lib/armures-db.mjs#chargerArmures`, `prix_calcule` ; le script de la page le refait quand un prix
  de matériau ou la fabrication est réécrit), le prix écrit dans la grille n'est plus lu ni modifiable ; une armure particulière garde son prix écrit.
- **Fiche de l'armure** (à côté, dans un panneau qui suit le défilement et remonte à la fiche quand on choisit une autre armure ; sur un écran étroit,
  par-dessus la page ; `src/scripts/armures.mjs`, calcul `lib/armure-forge.mjs`) : **réduite à son minimum comme celle des armes** (demande du
  propriétaire, 2026-10-16) — le nom, le type, les matériaux et l'amélioration, quatre tuiles (AP, AM, solidité, coût) qui sont des boutons dont
  l'**infobulle donne le détail du calcul** (bulle riche écrite dans `[data-armures-bulles]`, hors du panneau), puis la résistance et la faiblesse (ou
  l'effet) — ; c'est toujours l'armure complète (R93), dont le coût détaille la fabrication et les 6 unités de chaque matériau, achetées ou fournies
  (« 28 RO, ou, matériaux fournis : 10 RO + 6 Cuir + 6 Peau »), et la fiche suit l'**amélioration** (+1 à +5 : coût des
  niveaux +1 à +N, AP, AM et crans écrits au niveau N, pour l'armure entière : R77 ; ses « Matériau » comptés sans prix, la source ne disant pas lequel
  des deux). Une armure particulière n'a que le prix de l'armure entière, et s'améliore aussi (R80). Les tableaux d'améliorations (armure, bouclier) n'ont plus de ligne TOTAL (demande du propriétaire, 2026-10-16, pour les
  armes : « La ligne "total" des amélioration est inutile »). Au bout du défilement du panneau, la molette fait défiler la page, comme pour les armes.
- **Boucliers** (demandes du propriétaire, 2026-10-16) : un tableau des **formes** (Bocle, Targe, Bouclier Rond, Écu, Pavois : classe, prix) et,
  **directement sous lui**, les **améliorations** (+1 à +5, **quatre colonnes** : Coût en RO, Matériaux — oui : 1 matériau de la matière, R76, acheté ou
  fourni —, AP supplémentaire — celui du niveau N —, Solidité — +1 cran ou non, **crans cumulés** — ; voir « Améliorations de bouclier » plus bas) ; à côté, le tableau des **matières** (fiche des matières pour boucliers). Une forme et une matière donnent le bouclier préfabriqué
  (décision R78 : prix et défense tels qu'écrits, **solidité de la matière**). Dessous, **la liste des boucliers en un seul tableau, replié par défaut,
  triable par toutes ses colonnes** (Nom, Forme, Matière, **AP et AM séparés**, Solidité, Poids, Prix : un clic sur l'en-tête trie croissant, puis
  décroissant, puis rend l'ordre de l'onglet ; une valeur absente — prix « ???? », AP ou AM non écrit, bouclier sans poids — va à la fin ; rien dans
  l'adresse ; la part pure dans `lib/armures-tri.mjs`, testée, appliquée par `src/scripts/armures.mjs` ; un poids de bouclier réécrit sur le site de dev
  refait les pastilles des boucliers). Le **poids** de chaque bouclier est **la couleur de fond de sa case dans l'onglet** du classeur original (décision
  R92 : vert Léger, jaune Moyen, orange Lourd, rouge Très lourd, `bouclier.poids_id`, migration `0054-poids-des-boucliers`, `COULEURS_DES_POIDS`) : une
  pastille dans cette couleur, dans la liste avec « Requiert N Force minimum » en infobulle, et dans la fiche une cinquième tuile « Poids » dont
  l'infobulle le dit ; la liste des poids n'est plus affichée (« Pas besoin de tableau pour l'expliquer ») : elle reste dans la page pour le mode
  modification et sans JavaScript. À côté, la fiche (réduite comme celle de l'armure : les tuiles AP, AM, solidité, poids, coût, dont l'infobulle donne
  le détail du calcul, la note R78 / R76 dans celle de la solidité). La page compose un bouclier d'une seule matière ; les règles de l'onglet
  permettent d'en mêler jusqu'à 3 (non composé ici).
- **Tuiles des fiches** (armure, bouclier, arme) : la valeur ne déborde pas de sa tuile ; un coût en plusieurs monnaies (« 4 [PP] 362 [RO] 50 [RF] »)
  passe à la ligne entre deux monnaies, jamais entre un nombre et sa monnaie, et la tuile grandit (demande du propriétaire, 2026-10-16).
- Les prix de la grille, des boucliers et des formes sont des RO (décision R79, exception à R63) : décomposés en monnaies ; « ???? » et un prix vide
  restent tels qu'écrits, sans calcul. Un écart de la source noté à l'import (la fiche des Écailles en tête de ligne écrit Solidité 4, celle en tête de
  colonne 3) s'affiche sous les tableaux des matériaux, tel qu'écrit (`ecartsDeLaSource`).
- État dans l'adresse : `?materiau1=…&materiau2=…&amelioration-armure=N` (ou `?armure=<ancre>` pour une armure particulière),
  `&forme=…&matiere=…&amelioration-bouclier=N` (un ancien `piece=…` est ignoré : R93) ; l'onglet dans l'ancre (`#armures`, `#boucliers`) ; une ancre `#armure-…` ou `#bouclier-…` choisit la ligne.
- **AP et AM** (demande du propriétaire, 2026-10-17 : « L'édition des colonne AP et AM est mal pris en compte. C'est en base que les deux devraient être
  séparées et donc éditable aussi » ; « Même remarque sur les AP / AM mais pour les armures ») : pour une armure (de la grille ou particulière) et un
  bouclier, les colonnes `ap` et `am` sont les valeurs saisies, chacune dans sa case (un entier, signe permis ; vide = pas de bonus, « — » dans la liste,
  0 dans la fiche) ; la défense écrite (`armure.stats_brut`, `bouclier.defense_brut`) n'est plus une case : le service la refait depuis l'AP et l'AM
  (`lib/armure-champs.mjs#defenseEcrite` : « +10AP +14AM », « +2AM », « Aucune » quand les deux sont vides), et la garde telle qu'écrite tant qu'elle se lit
  exactement en ces valeurs (`defenseExacte` : l'écriture de la source, « +13AP+12AM » sans espace, reste) ; elle ne sert plus qu'au corps Markdown (recherche) et
  à la trace de l'import (rapprochement des classeurs). Toutes les défenses écrites de la base se lisent exactement en leur AP et AM (testé) : aucune
  valeur n'a été réécrite. Les matières (`materiau_armure`, `materiau_bouclier`) ne se modifient pas (R62) : leur case « Défense » montre leurs colonnes
  `ap` et `am`. Le script de la page lit l'AP dans la case AP et l'AM dans la case AM.
- **Améliorations de bouclier** (demande du propriétaire, 2026-10-17 : « Le +1matériaux devrai être dans le cout (une 2e collonne cout matériaux boolean)
  Les effet séparés en deux autres colones aussi, Valeur d'AP supplémentaire, et Solidité + 1 ou non ») : quatre cases, chacune une colonne de
  `amelioration_equipement` — `cout_ro` (entier, obligatoire), `cout_materiaux` (Oui = 1, Non = NULL : 1 matériau de la matière du bouclier, R76),
  `bonus_ap` (entier ; vide = aucun), `bonus_cran` (Oui = 1, Non = NULL ; les crans se cumulent, R76) ; le coût et l'effet écrits (`cout_brut`,
  `effet_brut`) en sont refaits (`textesDeBouclierEcrits` : « 100 + 1 Matériau », « +2 AP, +1 cran de solidité »), gardés tels qu'écrits tant qu'ils se
  lisent exactement en ces cases (`ameliorationDeBouclierExacte` : « 100 » / « +4 AP + matériaux » de la source reste) ; la ligne TOTAL reste les RO seuls.
  Les améliorations d'arme et d'armure gardent leur coût et leur effet écrits comme cases : leur écriture n'est pas celle du bouclier (« +N dégâts »,
  « +2 crans de solidité » au +10 d'une arme ; « +N AP/AM » d'une armure, une valeur pour l'AP et l'AM) ; chaque cible refuse les cases de l'autre.
- **Lots notés avant** (journal du site de dev, lot figé, journal exporté) : un lot qui saisissait la défense ou le coût et l'effet d'une amélioration de
  bouclier en texte (le service en tirait les cases, notées avec lui) n'est jamais rejoué vers une ligne dont le texte et les cases divergent : la ligne
  telle qu'elle sera après la modification (celle des règles, les valeurs déjà notées par les lots du journal qui passent, puis les siennes) doit avoir un
  texte qui se lit exactement en ses cases ; sinon (un mot de plus, un signe détaché que l'ancien service ne lisait pas, des cases notées qui ne sont pas
  la lecture du texte…) son lot passe en conflit avec un message qui dit quoi refaire, et ne compte pas pour les lots suivants de la même ligne
  (`serveur/edition-armures.mjs#ancienneEcritureDesArmures`, branché dans `serveur/edition.mjs#rejouerLeJournal`, donc aussi dans la livraison,
  `db:appliquer-edition` et la mise à jour). « Exactement » : `defenseExacte`, `ameliorationDeBouclierExacte`, qui acceptent espaces, virgules et
  points-virgules entre les termes (« +5AP, +6AM » se rejoue : rien n'y est perdu), refusent toute balise du glossaire, et tirent leurs valeurs des
  lectures de l'ancien service (`statsDeProtection`, `analyserAmeliorationDeProtection`) : les deux lectures ne divergent jamais (testé).
- **Choix Oui / Non** (coût en matériaux, cran) : une valeur de la base que la liste n'a pas (un « 2 ») garde son option dans la saisie
  (`lib/edition-modele.mjs#optionsDuChoix`) : rien n'est envoyé tant qu'on n'y touche pas.
- **Mode modification** (site de dev) : rien ne se sélectionne, tous les tableaux s'ouvrent (la liste des boucliers et celle des poids comprises) ; les
  cases des armures et des boucliers (nom, AP, AM, prix, poids au choix pour un bouclier), des formes, des poids, des améliorations (coût et effet écrits
  pour une armure, quatre cases pour un bouclier) et le coût de fabrication du bouclier (sous les formes) se modifient, les matériaux
  restent en lecture (R62) ; ni création ni suppression. Voir `docs/serveur.md`, « Édition ».
- `test/armure-champs.test.mjs` (découpages rejoués sur toute la base), `armure-forge.test.mjs` (décisions R75 à R80, R93), `corps-armures.test.mjs`,
  `serveur-edition-armures.test.mjs` (service, notes de version, rejeu du journal), `boucliers-poids.test.mjs` (décision R92 : le registre de la
  migration 0054 = la base dans son état d'import, couleurs, pastille), `armures-tri.test.mjs` (tri de la liste), `armures-html.test.mjs` (site construit).

## Ceinture (onglet Ceinture de `/ressources/equipement/`) : consommables, carquois et sacs, bâtons magiques

Demandes du propriétaire : le 2026-10-15, « l'ensemble de tous les objets que les joueurs peuvent placer à la ceinture dans le but de pouvoir les
utiliser comme un IC. De plus il faut parler aussi des bâtons magiques. Ils ne sont pas consommables mais ils tiennent tout de même un emplacement à la
ceinture » (d'abord une page, `/ressources/objets-a-la-ceinture/`, aux tableaux repliables) ; le 2026-10-16 : « revoir intégralement la page des objets
à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement. Dans cet onglet chaque tableau aurai aussi ses sous onglets
plutôt que la recherche actuel. On y remettrait à ce moment le tableau Bâton magique (actuellement migré dans équipement). Les onglets seront
organisées dans l'ordre Consommable / Carquois / Bâton magiques. Les consommables regrouperai les fioles remêdes philtres huiles et alchimie
privatives dans cet ordre. il faudra aussi récupérer les couleurs utilisé dans les tableaux du GoogleSheet pour les lignes présentes. »

Le guide ne donne qu'une liste « non exhaustive » (« Voyez avec votre mj ») ; l'onglet liste ce que le propriétaire a retenu (décision R81) : **toutes
les potions** (fioles, remèdes et panacée, philtres, alchimie primitive), **toutes les huiles**, les **carquois, sacs de bombes et sacs de pierres**
(que le guide oblige à mettre à la ceinture pour être utilisés) et les **bâtons magiques**. Le bouclier n'en est pas : son emplacement est dans
l'armure (décision R82). Le matériel que le guide cite aussi (briquet, torche, lanterne, corde, kits) va à la ceinture mais n'est pas listé : il reste
dans « Composants ». L'onglet ne dit donc pas que rien d'autre ne va à la ceinture.

Quels objets : la vue **`v_objet_ceinture`** (migration `0047-objets-a-la-ceinture`), une ligne par objet avec sa famille (`fiole`, `philtre`, `remede`,
`primitive`, `huile`, `contenant`, `baton`) et sa potion ou son contenant (`ressource_id`) ou son bâton (`baton_id`) : les potions de la table `potion`,
les ressources du matériel dont la clé du nom écrit « carquois », « sac de bombe » ou « sac de pierre », les bâtons de `baton_magique`. Une vue et non une
table : elle suit les tables (un carquois créé sur la page « Composants » y entre). La fiche de personnage s'en sert pour ses trois emplacements
(`personnage_ceinture`, décision R89) : elle y reconnaît les bâtons magiques (un seul par emplacement) et les carquois ou sacs (leur contenance) ; les
emplacements, eux, prennent n'importe quel objet du sac (la liste du guide n'est pas exhaustive) ; voir `docs/character-generator.md`, « Ceinture ».

L'onglet est rendu depuis la base (`lib/ceinture-db.mjs`, `components/ceinture/CeinturePanneau.astro`, `styles/ceinture/ceinture.css`, lignes :
`lib/ceinture-rendu.mjs`), dans le panneau `section.equipement-panneau#ceinture` de la page « Équipement » :

- en tête, **les règles de la ceinture**, repliées comme celles des autres onglets : la section « La ceinture » du chapitre « L'équipement » du guide
  (`guide/l-equipement`), rendue depuis la base, et, en dépliable, le texte de la source : la section « Ceinture » de la page de référence « Fiche de
  personnage : Accessoires et Ceinture » (la liste « non exhaustive », « Voyez avec votre mj », le nombre de flèches d'un carquois) ;
- puis **trois sous-onglets** (`lib/equipement.mjs#SOUS_ONGLETS_DE_LA_CEINTURE`, `components/Onglets.astro` ; leur barre est un groupe à elle,
  `data-onglets="Ceinture"`), chacun un panneau `section.ceinture-panneau` dont l'id est l'ancre du sous-onglet :
  - **Consommables** (`#ceinture-consommables`, ouvert au départ) : les groupes repliables **Fioles**, **Remèdes**, **Philtres**, **Huiles**,
    **Alchimie primitive**, dans cet ordre (`lib/ceinture-db.mjs#FAMILLES_DE_LA_CEINTURE`), un lien par groupe en tête ; dans chacun, **un tableau par
    page de potion**, deux ou trois côte à côte selon la largeur, un seul sur un écran étroit (demande du propriétaire, 2026-10-17 : « Les tableaux des
    fioles sont trop larrges Mettre de coté 2 ou 3 tableaux serai plus lisible » ; grille `.tableaux--cote-a-cote` du gabarit commun, largeur minimale
    d'un tableau 30rem : au-delà de trois, l'effet n'aurait plus la place) : son titre (la page, en lien, ancre `#potions-<page>` :
    `lib/ceinture-rendu.mjs#ancreDePotions`), son nombre de paliers, le résumé de la page, puis une potion par ligne (nom, niveau, prix, effet tel
    qu'écrit), dans l'ordre où la page les écrit ;
  - **Carquois** (`#ceinture-carquois`) : le tableau **Carquois et sacs** (nom en lien vers sa ligne de « Composants », où ils se modifient, prix,
    description) ;
  - **Bâtons magiques** (`#batons-magiques`, l'ancre de l'ancien onglet de la page « Équipement » : les liens déjà faits vers lui ouvrent l'onglet Ceinture
    et ce sous-onglet) : son panneau de règles en tête, puis le tableau (« Bâtons magiques » ci-dessous).
- **Plus de recherche** (demande du propriétaire : des sous-onglets « plutôt que la recherche actuel ») : l'onglet n'a pas de script, sauf le curseur des
  bâtons. Sans JavaScript, tout est affiché, chaque sous-onglet sous son titre.
- **Couleurs des lignes** (`lib/ceinture-couleurs.mjs`, lues dans les sources originales le 2026-10-16 par les connecteurs Google de la session ; les
  instantanés de `sources/raw/` ne gardent pas la mise en forme) : chaque potion sur la couleur de son palier dans le Google Doc « Alchimie » (le fond de
  la case du nom, en tête du tableau du palier), sauf le Remède enragé et l'Huile rage, que le Doc ne colore pas ; les carquois et sacs n'ont pas de
  couleur dans l'onglet « Équipement inventaire » du classeur ; les bâtons, la case de leur magie dans l'onglet « Bâton magique ». Choix du site, pas de
  la source : la couleur de la case s'étend à toute la ligne, et le texte est celui que la source pose (blanc) ou, sinon, le plus lisible sur le fond
  (`texteSurCouleur`) — blanc sur les fonds sombres où la source écrit en noir par défaut (Méga et Ultime fiole rouge, les lignes de bâtons du Sang, du
  Feu, de la Terre, de l'Ombre…). Une potion créée plus tard, absente du module, resterait neutre. Repère visuel sans valeur de règle.

Rien n'est calculé : chaque case écrit une valeur de la base (seule la valeur en Ricken de fer d'un prix, en infobulle, est une conversion, comme sur
« Composants » ; le prix d'un bâton, celui des matériaux de sa recette) ; les prix et les textes montrent leurs monnaies en icônes (R63). Les titres des
pages citées sont lus dans la base ; une section de règles qu'une page n'écrit plus (titre renommé sur le site de dev) manque à l'onglet, et le build le
dit (avertissement `[ceinture]`).

**Mode modification** (site de dev ; demande du propriétaire, 2026-10-17 : « Les tableaux des consommables devrai pouvoir aussi être modifiées .
(sauf pour les champ calculés) ») : dans les tableaux du sous-onglet Consommables, chaque case **saisie** d'une potion devient une saisie de l'éditeur
commun (`src/scripts/edition/editeur.mjs` : ses `data-ed`, posés par `lib/ceinture-rendu.mjs#htmlDeLigneDePotion` ; rendus `potion-niveau`,
`potion-effet` de `RENDUS_DE_LA_CEINTURE` et `composant-prix`, le même HTML qu'au build), enregistrée par le service (`serveur/edition-consommables.mjs`) :

| Case | Source (saisie) | Ce que le service en refait |
| --- | --- | --- |
| Nom | `ressource.nom` (genre `potion`) | `nom_cle` ; le nom dans l'en-tête du tableau du palier de la page de la potion ; refusé s'il ne diffère d'un autre palier de la même page que par la casse, les accents ou les signes (le tableau se retrouve par son nom) |
| Niveau | `potion.niveau_id` (choix parmi `niveau_alchimie`, liste `niveauxDAlchimie`) | le nom du niveau dans le tableau du palier |
| Prix | `ressource.prix_brut` | `prix_rf` (`lib/composants-champs.mjs#prixEnRf`, la valeur en RF de l'infobulle) ; le prix du tableau du palier |
| Effet | `potion.effet` (texte, ses lignes) | les altérations d'état de `potion_etat` (`lib/potion-etats.mjs` : la règle de l'import, « Inflige gel 1 », « Réduit d'un cran la brûlure », « Soigne totalement la peur », rejouée sur toutes les potions par `test/potion-etats.test.mjs`) ; l'effet du tableau du palier (lignes jointes par `<br>`) |

En lecture, parce qu'ils sont calculés ou tirés d'ailleurs : la **couleur** de la ligne (la source, `lib/ceinture-couleurs.mjs`), la **valeur en RF**
d'un prix (infobulle), le **titre et le résumé d'un groupe** (le titre et la première phrase de la page de la potion), l'ordre des lignes (celui où la
page les écrit), les **carquois et sacs** (ils se modifient sur la page « Composants ») et les **bâtons** (gemme, bois : « Composants » ; effet : non
demandé). Ni création ni suppression de potion. Le corps de la page de la potion (« Fiole rouge »…, rendue depuis son Markdown) suit, case par case
(`lib/corps-potions.mjs`, aussi au rejeu du journal : `serveur/edition.mjs#recalculerLesPages`) ; ni HTML brut ni lien non sûr n'y est ajouté. Une
ressource qui n'est pas une potion reste au domaine des composants (`ressourcesParGenre`). Notes de version : domaine « Équipement », groupe
« Ceinture › Fioles »… ; API REST : `PATCH /api/v1/potions/<id>/` (description figée). Tests : `serveur-edition-consommables.test.mjs` (service,
rejeu, API), `corps-potions.test.mjs`, `potion-etats.test.mjs`.

Tests : `ceinture-db.test.mjs` (la vue, le chargement, l'ordre des tableaux et des sous-onglets, les sections telles que l'import les écrivait, les cases
d'une potion et leurs champs), `ceinture-couleurs.test.mjs` (une couleur par potion et par magie des bâtons, le rendu), `ceinture-html.test.mjs` (site
construit : sous-onglets, tableaux, un tableau par page de potion côte à côte, couleurs, liens, plus de recherche ni de page à part, les champs du mode modification sur les seules cases saisies) ;
`edition-rendu.test.mjs` réécrit chaque case modifiable depuis sa ligne de la base et la compare au site construit.

### Bâtons magiques (sous-onglet Bâtons magiques de la ceinture)

Demande du propriétaire (2026-10-16) : « Il faudrait colorer toute la ligne de la couleur de la magie concernée. La colonne magie elle même n'est pas
utile. Il faudra un tooltip pour donner le lien vers l'objet de la gemme ou et du bois utilisé. Il faudrait une colonne "niveau" avec un slider de 1 à 3
à chaque fois. La case de la colonne "effet" se mettra à jour en fonction du niveau. Rajouter une colonne pour le prix. »

- En tête, son **panneau de règles** (« Panneaux de règles » plus haut ; id `batons-magiques`, l'ancre du sous-onglet) : l'introduction de la page
  « Bâton magique », puis la fabrication en tuile, replié comme ceux des autres onglets.
- Une ligne par magie (ordre des magies), **toute sur la couleur de sa magie** : depuis la demande du propriétaire du 2026-10-16 (« récupérer les
  couleurs utilisé dans les tableaux du GoogleSheet pour les lignes présentes »), celle de la case du nom de la magie dans l'onglet « Bâton magique »
  du classeur (`lib/ceinture-couleurs.mjs#COULEURS_DES_BATONS`, texte posé par le classeur ou, sinon, le plus lisible : `texteSurCouleur` ; une magie
  absente de l'onglet garderait `couleurDeMagie`), **sans colonne Magie** (le nom de la magie reste dans l'en-tête de la ligne pour les lecteurs d'écran, et dans les infobulles) :
  **Gemme | Bois | Niveau | Effet | Prix**.
- **Gemme** et **Bois** : le nom, en lien vers sa ligne de la page « Composants », avec son **infobulle** (`data-bulle`, `components/Infobulles.astro`) : sa
  magie, sa description, son prix (la gemme entière aux trois qualités, celle du niveau de la ligne en avant) et un lien « Voir dans Composants » (hors
  tabulation : le nom l'est déjà). La gemme est **la pastille des accessoires** (`.acc-gemme`, dans la couleur de sa magie, commune aux deux onglets :
  `styles/equipement/equipement.css` ; ici un lien, avec un liseré qui la détache du fond de même couleur), **sans ligne pour sa qualité** (demande du
  propriétaire, 2026-10-16 : « La case des gemmes doit utiliser le même item que pour les accessoire. Une pastille. Et pas de 2em ligne pour la qualité
  de la gemme ») : la qualité du niveau se lit dans l'infobulle.
- **Niveau** : un curseur de 1 à 3 par ligne (`src/scripts/batons.mjs`, sans import) ; il pose `data-niveau` sur la ligne, et le CSS n'affiche que
  l'effet et le prix de ce niveau (chaque case les écrit tous, `data-niv`) et met sa qualité en avant dans l'infobulle de la gemme. Sans JavaScript : pas de curseur, chaque case écrit ses trois niveaux,
  chacun sous son nom.
- **Effet** : le bonus passif du niveau, tel qu'écrit (`baton_magique.bonus_brut`).
- **Prix** : la source n'écrit pas de prix pour un bâton, seulement ceux de ses matériaux et la recette de chaque niveau (« 1 Gemme Commune + 1 bois
  [magie] ») ; le prix affiché est celui des **matériaux de la recette** : la gemme entière de la qualité du niveau + le bois (`lib/batons-db.mjs#prixDuBaton`,
  null si l'un des deux manque), en icônes de monnaie ; l'en-tête le dit en infobulle. Aucun coût de fabrication n'est ajouté.
- Pas encore modifiable sur le site de dev : les prix de la gemme et du bois se modifient dans « Composants » et suivent au build suivant.

## Accessoires (onglet Accessoires de `/ressources/equipement/`) : le générateur d'accessoire

Demande du propriétaire (2026-10-14) : « Pas de tableau markdown. Au lieu de ça, je veux un générateur à accessoire », présenté comme la page des armes :
un bloc d'explication, plusieurs tableaux et, sur le côté, un encart qui décrit l'accessoire créé d'après ce qui a été sélectionné. La page est rendue
depuis les tables (`lib/accessoires-db.mjs`, `components/accessoires/AccessoiresPage.astro`, `styles/accessoires/`), jamais depuis son Markdown, dont
seules les consignes écrites sous chaque étape (« Accessoire trouvé ou bien accessoire vierge », « Ne peut dépasser 4 »…) s'affichent ; ses règles (avant
« ## CRÉATION D'ACCESSOIRE ») sont le panneau de règles de l'onglet, déplié au départ (« Panneaux de règles » plus haut) ; le reste (tableaux) ne sert
qu'à la recherche et aux `[[liens]]`. Seul le panneau de règles se modifie sur le site de dev.

- **Tableaux** : Étape 1 Identité (`accessoire_emplacement`), Étape 2 Propriété (`accessoire_propriete`, plages du 1d100), Étape 3 Effet — un tableau
  par propriété (`accessoire_effet`), chacun dans son **onglet** (« Et plutôt que des menus déroulants : ces tableau soient derrière des onglets », demande du
  propriétaire du 2026-10-16 ; `components/Onglets.astro`, sans JavaScript les tableaux se suivent ; choisir une propriété ouvre son onglet, par
  l'évènement `onglets:ouvrir`, sans ancre dans l'adresse), la
  Malédiction sans tableau —, puis la Monture (`accessoire_monture`). Le dé de chaque table est son plus grand jet écrit (1d4, 1d100, 1d6, 1d20).
- **Compétence** (demande du propriétaire du 2026-10-16 : « Lignes trop longues et trop nombreuses », « ne pas avoir le nom de la caractéristique en dessous mais directement dans le titre »,
  « La valeur de "Bonus d’acquis" deviendrai un slider (qui peut être varié par un dé, ou saisi manuellement) ») : **une ligne par compétence**, titrée « Compétence Force » pour
  le « Compétence F » de l'onglet (`lib/accessoires-db.mjs#titreDeCompetence`, affichage seulement : `accessoire_effet.libelle` ne change pas, la fiche et
  le tableur s'en servent) ; le bonus d'acquis se règle au curseur, à son dé (1d20) ou par saisie, borné aux plages écrites (1 % à 20 % :
  `lib/accessoires-generateur.mjs#bonusBorne`), et donne le niveau dont la plage le contient, donc l'effet de la ligne (son identifiant, sa couleur, son
  prix écrit : `data-niveaux`, `lib/accessoires-generateur.mjs#effetDuBonus`, `src/scripts/accessoires.mjs#reglerLAcquis`) ; la ligne est construite au
  plus petit bonus ; une adresse dont le bonus sort de la plage de son effet prend le plus petit de cette plage (`bonusDeLAdresse`). Sans JavaScript :
  chaque plage écrite du bonus, son niveau et son prix écrit, sans couleur.
- **Dé** (« dans chaque tableau une case avec un icône de dé ») : l'en-tête de la première colonne des tableaux des étapes, pas la Monture (« Pas de
  random à faire sur la table des Montures ») ; un clic tire une ligne au hasard et affiche le jet ;
  la Compétence tire 1d6 (la ligne) puis 1d20 (son bonus d'acquis, porté par le curseur de la ligne). « Tirer un accessoire » suit
  les étapes 1 à 3 ; une malédiction (propriété 96-100 ou ligne MALÉDICTION d'un tableau d'effets) rend l'accessoire maudit et fait relancer depuis
  l'**étape 2, avec le même emplacement** (l'étape 1 n'est tirée qu'une fois) ; une seconde malédiction dans cette relance le **détruit** : il tombe en
  poussière, sans troisième tirage (décision R94 : « on relance tout l'item à partir de l'étape 2 (on garde le même emplacement) Dans le 2em roll si
  on retombe à nouveau sur "Malédiction", l'objet est DETRUIT et tombe en poussière » ; `lib/accessoires-generateur.mjs#tirerUnAccessoire`, testé).
  Chaque jet, de « Tirer un accessoire » comme du dé d'un tableau, passe par `apresUnJet` : une malédiction tirée rend l'accessoire maudit, ou le
  détruit s'il l'était déjà (par une malédiction ou par la case « Maudit » cochée) ; **le dé de l'étape 1** commence un nouvel accessoire (R94 garde
  l'emplacement dans la relance : relancer l'emplacement, c'est un autre accessoire) : ni maudit ni détruit, et rien d'autre ne change (propriété,
  effet, monture, gemmes) ; **un dé jeté sur un accessoire détruit** (étape 1, 2 ou 3, le dé d'acquis d'une compétence compris) commence aussi un nouvel
  accessoire avant d'appliquer la transition : un accessoire détruit ne revient jamais (« sans troisième tirage »), l'emplacement reste s'il n'est pas
  relancé ; **le dé de l'étape 2** retire un effet « MALÉDICTION » choisi (relancer l'étape 2, c'est refaire les étapes 2 et 3 ; un autre effet reste
  si la propriété est la même). « Tirer un accessoire » repart de zéro, ne tire l'étape 1 qu'une fois et s'arrête à la destruction ; un dé de
  tableau garde ce qu'il ne relance pas. **Un clic** n'est pas un jet : il ne commence pas d'accessoire, et une ligne de malédiction cliquée rend
  l'accessoire maudit, jamais détruit. « Détruit » ne tient que tant que la propriété ou l'effet choisi est une malédiction (`etatDeMalediction`) :
  choisir une propriété ou un effet qui n'en est pas une le lève (l'accessoire reste maudit), décocher « Maudit », « Tout effacer » et « Tirer un
  accessoire » lèvent tout ; cliquer un emplacement ou une monture n'y change rien. Le texte des règles de la page (la source) n'est pas réécrit :
  l'aide sous les boutons et l'encart disent la décision.
  Rien n'est inversé ni calculé : l'encart le dit (`noteDeMalediction`) — détruit : l'emplacement, la propriété et l'effet de la seconde malédiction,
  la monture si elle a été choisie à la main (pas celle d'office), sans niveau, gemmes ni prix, « Seconde malédiction : l'accessoire est détruit et
  tombe en poussière. » ; une malédiction choisie : relancer depuis l'étape 2, même emplacement.
- **Encart** (`src/scripts/accessoires.mjs`) : identité, propriété, effet (et sa remarque), niveau, gemmes avec la qualité de leur niveau (phrase des règles :
  classique aux niveaux 1 et 2, raffinée aux 3 et 4, parfaite au 5) et le prix d'un quart de chacune, monture, prix écrit dans le tableau, case « Maudit ».
  Choisir un effet choisit d'office la monture de son niveau tant qu'on n'en a pas choisi une (le prix écrit d'un effet compte les quarts de gemme de la
  qualité de son niveau et la monture de ce niveau : vrai pour 115 des 116 effets à prix ; « Grenat + Onyx » au niveau 4, 179 Ro, fait exception).
  **Gemmes au choix** (« Dans le cas où les gemmes sont au choix, laisser la possibilité d'en cocher 2 », « Cela mettra alors le prix à jour » ; puis,
  le 2026-10-16, « Pour l'intelligence, il faut aussi pouvoir cocher au moins deux des gemmes pour justement avoir le calcul du prix. » ; « au moins deux » est lu « deux », comme le 2026-10-14, question posée au propriétaire) : une case par gemme au
  choix, deux gemmes en tout — les quatre de l'Intelligence en laissent cocher deux, « Onyx + Grenat/Malachite » une (`gemmesAuChoix`,
  `gemmesCochees`) —, **dans la ligne de l'effet** (`components/accessoires/GemmesDeLEffet.astro`, cocher choisit la ligne) comme dans l'encart, un seul
  état ; les gemmes cochées, le prix se calcule (`prixDeLAccessoire` : les quarts à la qualité du niveau + la monture, la composition des prix écrits,
  que `test/accessoires-db.test.mjs` vérifie sur chaque effet à gemmes imposées) : dans la ligne avec la monture de son niveau (comme les prix écrits
  du tableau), dans l'encart avec la monture choisie.
  Recliquer une ligne choisie la retire. État dans l'adresse (`?emplacement=…&propriete=…&effet=…&acquis=…&monture=…&gemmes=…&maudit=1&detruit=1`),
  lu tel quel (aucune transition à la lecture ; `detruit=1` n'est retenu qu'avec une malédiction choisie, et il implique `maudit`).
- **Couleurs** : les lignes d'effet, les montures et l'encart dans la couleur de leur niveau, celle des cases « Niveau 1 » à
  « Niveau 5 » du tableau Monture de l'onglet (`lib/accessoires-generateur.mjs#COULEURS_DES_NIVEAUX`) ; une gemme dans la couleur de sa magie
  (`couleurDeMagie`). **Pas de tableau des gemmes** : une infobulle par gemme (magie, description, prix d'un quart classique, raffiné, parfait).
- Sans JavaScript : tous les tableaux, l'un après l'autre, sans encart, dé, curseur ni case à cocher. `test/accessoires-generateur.test.mjs`, `accessoires-db.test.mjs` (tables complètes :
  chaque jet a sa ligne), `accessoires-html.test.mjs` (site construit), `accessoires-script.test.mjs` (le script dans un faux navigateur : malédiction,
  R94).

## Composants (`/ressources/composants/`) : tout ce qui sert à fabriquer sans être consommé

Demandes du propriétaire (2026-10-14) : « un onglet "Composants". Il comprendra les tableaux des gemmes, des matériaux, la monnaie, et l'ensemble des
tables de l'onglet "équipement inventaire". […] chaque élément est modifiable en édition, supprimable, ajoutable » ; « Il faut aussi y mettre la table des
fruits. Ainsi que tout ce qui n'est pas directement des consommables mais qui peut servir pour fabriquer les potions / fioles et autres ». La page n'a pas
de page du wiki : elle est rendue depuis les tables (`src/pages/ressources/composants.astro`, `lib/composants-db.mjs`, `components/composants/`,
`styles/composants/`, lignes : `lib/composants-rendu.mjs`), **un onglet par tableau**, comme la page « Équipement » (demande du propriétaire du
2026-10-17 : « à l'image de la page d'équipement avoir des onglets pour chaque table. Il faudrait aussi qu'elles soient modifiables et directement liées
en base ») :

- **Monnaie** (`monnaie`) : nom, symbole (son icône, décision R61), valeur en RF ; les conversions vers les plus petites (« 1 PP = 1 000 RO = 100 000 RF »)
  sont celles qui tombent juste, comme le CONVERTISSEUR de l'onglet (`lib/composants-champs.mjs#conversionsDe`). Le RF est l'unité (il vaut 1 et ne se
  supprime pas). Les valeurs ne se modifient pas, ni l'abréviation du RF, du RO et de la PP (R61).
- **Matériaux** (`ressource` de genre `materiau` et table `materiau`) : la **seule source** des matériaux (décision R62) — matière (dans la couleur de
  l'onglet « Armes »), type d'après l'armure (Léger, Intermédiaire, Lourd, Autres : migration `0041-materiaux-types`), prix, description, effets sur une
  arme (`materiau_arme`), et ce qui les utilise (armes, armures, boucliers, montures d'accessoire). La **fabrication** d'une matière (sa recette,
  « 10 minerais de fer + 1 charbon + Bas Fourneau » : table `recette` de genre `materiau`, en lecture) est la colonne du tableau MATÉRIAUX des onglets
  « Armures » et « Bouclier », qui a quitté la page « Équipement » (demande du propriétaire, 2026-10-16) ; l'Os, de la page des armes, n'en a pas ; la
  recherche de la page la lit aussi (« fer » trouve l'Acier, dont la recette en demande). Les
  pages des armes et des armures les reprennent en lecture : le nom suit partout, le type la fiche d'armure (`materiau_armure.type`, « Autres » refusé
  pour un matériau d'armure), le prix `materiau_arme`.
- **Gemmes** (`gemme`) : magie, gemme, description, prix de la gemme entière (bâton magique) et d'un quart (accessoires), par qualité.
- **Bois** (`bois`) des bâtons magiques : magie, bois, description, prix.
- **Ingrédients d'alchimie** (`ingredient_alchimie`, doc « Alchimie » › Liste d'ingrédients) : la **table des fruits** (les ingrédients de type
  « Fruit » : catégorie — amplificateur majeur ou catalyseur —, type, affinité), puis un tableau par catégorie (Solvant, Essence, Amplificateur,
  Catalyseur, Stabilisateur) sans les fruits.
- **Équipement** : les six tableaux de l'onglet « Équipement inventaire » (Végétaux, Animaux, Autres, Matos aventures, Matos fabrication — fioles de
  verre et kits d'alchimie compris —, Matos projectile).

Les potions, livres et parchemins (des consommables) n'y sont pas. Une recherche filtre les lignes de tous les tableaux (`src/scripts/composants.mjs`) :
chaque onglet dit combien de lignes il garde, un onglet sans ligne trouvée s'estompe, et si l'onglet ouvert n'en a plus, le premier qui en a s'ouvre.

**Onglets** (`components/Onglets.astro`, posé une fois par `ComposantsPage.astro`) : chacun est une ligne de la table `composant_onglet` (migration
`0057-onglets-des-composants`) — son id est l'ancre de l'onglet et l'id du panneau (`section.composants-panneau`) de son tableau (`monnaie`, `materiaux`,
`gemmes`, `bois`, `fruits`, `ingredients-<catégorie>`, `objets-<section>` : `lib/composants-db.mjs#TABLEAUX_DES_COMPOSANTS`), son **titre** est le nom de
l'onglet, sa **note** le texte au-dessus du tableau (facultative), son `ordre` sa place dans la barre. Un tableau sans onglet ou un onglet sans tableau
arrête le build (`ongletsDeLaPage`). Les anciennes ancres (`#materiaux`, `#objets-matos-projectile`, `#composant-…` d'une ligne) ouvrent leur onglet.
Sans JavaScript, les panneaux se suivent, chacun sous son titre.

**Mode modification** (site de dev, `src/scripts/edition/composants.mjs`, `serveur/edition-composants.mjs`) : le titre de chaque onglet (le titre de son
panneau, affiché en mode modification ; l'onglet le reprend à l'enregistrement) et sa note (vidée : sans note) — ni création ni suppression d'onglet ;
chaque case se modifie (nom, prix,
description, prix d'une gemme, type et affinité d'un ingrédient, nom, abréviation et valeur d'une monnaie) ; ce qui en est tiré est recalculé (prix en RF,
ligne du CONVERTISSEUR, type sans « (majeur) », marque majeur, affinité — créée si elle est nouvelle). Un bouton « + Ajouter » sous chaque tableau (une
gemme ou un bois pour une magie qui n'en a pas : « une par magie » ; un « (majeur) » seulement pour un amplificateur) ; « Supprimer » sur chaque ligne que
rien d'autre ne cite — un composant cité par une armure, une recette, un effet d'accessoire… ne se supprime pas (le bouton grisé dit pourquoi). Un objet
supprimé reste dans l'inventaire ou la ceinture d'une fiche de personnage, sous son nom, sans lien au catalogue, avec une note datée qui demande de mettre
la fiche à jour (décision R60, `serveur/fiches-retraits.mjs#OBJETS_AU_CATALOGUE`). Partout, les prix montrent leurs monnaies en icônes (R61) et un montant se décompose en PP / RO / RF (« 1245,5 RO » : 1 PP 245 RO 50 RF ; R63, `lib/monnaies.mjs`).
Le corps Markdown des pages qui écrivent ces composants suit, case par case (`lib/corps-composants.mjs`) : « Équipement inventaire » (lignes des objets,
MONNAIE et CONVERTISSEUR), « Armures » et « Bouclier » (prix et description d'un matériau ; son nom par `lib/corps-armes.mjs#corpsAvecMateriauRenomme`,
avec la page des armes), « Accessoires » (monture, gemmes et leurs combinaisons « A + B »), « Bâton magique » (gemmes et bois), « Liste d'ingrédients ».
Tests : `serveur-edition-composants.test.mjs`, `corps-composants.test.mjs`, `composants-onglets.test.mjs` (les onglets de la base), `composants-html.test.mjs` (site construit).

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
  lien, mot-clé et définition du glossaire, tableau, ajouter ou supprimer une ligne ou une colonne, couleur des cases), à gauche de l'écran, à la hauteur
  de la zone où est le curseur (la page décalée d'autant ; sous 48rem, en haut de l'écran ; demande du propriétaire du 2026-10-17, la même pour la
  chronologie et les panneaux de règles). Les mots-clés du glossaire y sont en balises écrites (« Mots-clés (glossaire) »). Les blocs tirés de la base ne se modifient pas ; le titre, si
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
« Site de dev › édition du AAAA-MM-JJ », son seul mot-clé « capacité de classe » (depuis la migration 0056 : ni la classe ni la spécialité), son corps et
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

## Mots-clés (glossaire)

Demande du propriétaire du 2026-10-16 : « Le mot-clé devra désormais servir un peu comme un glossaire. Le mot-clé aura son ID, son texte et une
description. Partout où un mot-clé est utilisé, il sera affiché en gras. Une infobulle de sa définition sera visible. » La table `mot_cle`
(migrations `0043`, `0056`) est ce **glossaire** : un identifiant figé (tiré une fois du premier libellé), un libellé, son écriture (`libelle_cle`) et
une **définition** (`description`, NULL tant qu'il n'est pas décrit). La migration `0056` a retiré les anciens mots-clés des pages : il reste ceux dont le
site se sert pour ranger ses pages (catégories de `/classes/`, « classe », « race », « race hybride », « capacité de classe », « métier », « codex ») et
ceux du glossaire (Mordhau, Recharge longue, Recharge très longue…).

**Citer un mot-clé : une balise, toujours écrite** (marquage explicite, jamais de repérage automatique du texte) :

| Écriture | Rendu |
| --- | --- |
| `{{recharge-longue}}` | **Recharge longue** (le libellé), en gras, la définition en infobulle |
| `{{non-mort\|non-morts}}` | **non-morts** (le texte écrit), en gras, la définition du mot-clé en infobulle |
| `{{mordhau:}}` | le **mode complet** : « **Mordhau** : définition », dans le fil du texte (la définition vient du glossaire et la suit) ; `{{mordhau :}}` (une espace avant les deux-points) est la même balise |

- Dans une saisie, la ref est l'**id** du mot-clé ou son **écriture** : `{{Recharge longue}}` = `{{recharge-longue}}`. La balise à copier est écrite à côté
  de chaque mot-clé sur `/recherche/` en mode modification. **La base ne garde que des ids** : le service enregistre la forme canonique (ci-dessous) et
  `db:check` refuse toute autre écriture (même règle), sauf le libellé écrit en texte dans un texte mis en forme (`{{id|Libellé}}`, que le service
  ramène à `{{id}}` : le corps d'une page typée l'écrit, un renommage peut en faire un).
- **Dans une case de tableau Markdown**, le séparateur s'écrit `\|` : `| Arbalète | {{recharge-longue\|à recharger}} |` (sinon la case s'arrête au
  `|` ; le service réécrit un `|` en `\|` sur une ligne de tableau). Le texte d'une balise est du **texte simple** : ni gras, ni lien, ni accolade, ni
  retour à la ligne dedans.
- **Partout** : corps des pages du guide et du Codex, descriptions de la chronologie, textes des tables (effet d'une arme, rubrique d'une carte de
  monstre, effet d'un don, description d'une capacité de monstre…), blocs des panneaux de règles, définition d'un autre mot-clé (citée en texte simple).
  Le site les rend à la construction (`src/middleware.mjs`, `lib/mots-cles-balises.mjs`) : une bulle par mot-clé et par page, posée en fin de page ;
  dans une bulle, un mot-clé est en gras sans bulle ; dans un bouton ou un résumé de `details`, en gras sans bulle (le toucher ferait l'action) ; dans un
  `title`, un `alt`, une description de page ou un attribut lu par un script, le texte simple. Rien n'est rendu dans le code (`code`, `pre`, ni dans
  leurs attributs), ni sur `/donnees/`, ni dans les textes d'aide du mode modification et la page Debug (les valeurs telles qu'écrites,
  `data-mots-cles-bruts`). Les monnaies ne lisent aucun montant dans une balise (`{{x|10 RO}}` reste écrit). La fiche de personnage n'en garde que le
  texte affiché (le texte écrit, ou le libellé ; jamais la définition), l'index de la recherche le texte simple (« Libellé : définition » pour le mode
  complet) ; `/recherche/?mot-cle=<id>` liste aussi les pages qui **citent** un mot-clé.
- **Forme canonique** (celle que le service du site de dev enregistre) : la ref est toujours l'id, et selon la colonne :
  - un **texte mis en forme** (Markdown : corps des pages du guide et du Codex, descriptions de la chronologie, blocs des panneaux de règles) garde
    `{{id}}` (le texte affiché suit le libellé : un renommage se voit partout), écrit `{{id|texte}}` si un autre texte que le libellé est écrit (le
    libellé écrit en texte redevient `{{id}}`), et permet le mode complet `{{id:}}`. Une balise dans un **code** (`` `{{id}}` ``, bloc ` ``` ` ou `~~~`) est
    une écriture littérale : ni mise en forme, ni refusée, ni rendue ;
  - un **texte de case** (cases, effets, descriptions des tables, définitions des mots-clés) porte toujours le texte de sa balise, `{{id|texte}}` (le
    libellé du moment si rien n'est écrit) : un découpage le lit **sans le vocabulaire** (« Recharge longue » d'un effet d'arme donne toujours la
    recharge longue, quel que soit le libellé du mot-clé). Le mode complet y est **refusé** (« le mode complet ne s'écrit que dans un texte mis en
    forme »). Une case découpée et affichée morceau par morceau (bonus et objets d'un métier, inventaire d'une classe, lieux d'une espèce) garde la
    balise de chaque morceau, que le site met en gras.
- **Refusés** à l'enregistrement : une balise dont la ref n'est pas un mot-clé, et une ref **ambiguë** (l'id d'un mot-clé et l'écriture d'un autre : un
  mot-clé renommé dont l'id est devenu l'écriture d'un nouveau ; préciser l'id voulu) — sauf si le texte l'avait déjà ; au rendu, une ref inconnue (texte
  d'avant la suppression de son mot-clé) s'affiche en texte simple.
- **Renommer** un mot-clé ne réécrit aucun texte : un texte de case garde le texte écrit de ses balises, un texte mis en forme montre le nouveau libellé.
  Le **supprimer** remplace chacune de ses balises par son texte simple (« Libellé : définition » pour le mode complet), partout ; le **fusionner** dans
  un autre les fait citer l'autre (un texte de case garde le texte qu'il montrait). À la livraison (rejeu du journal), cela vaut aussi pour les textes
  que le site de dev n'avait pas (pages d'exemple, textes reçus depuis) ; la cible d'une fusion y est reconnue aux étiquettes ou aux balises que le lot a
  reportées (sinon les balises sont retirées). Dans l'éditeur en place du mode modification (guide, Codex, chronologie, panneaux de règles), les
  mots-clés s'affichent **en balises écrites**, comme dans le Markdown (demande du propriétaire du 2026-10-17 : « Quand je passe en mode édition le
  texte devrai remettre le texte en mode Markdown […] je ne vois pas {{Recharge Longue}} ») : on les lit, les tape et les modifie comme le reste du
  texte ; ils ne sont rendus (gras, infobulle, mode complet) qu'une fois enregistrés. Ses outils « Mot-clé » et « Définition » écrivent la balise du
  mot-clé choisi à la place du texte choisi (`{{id}}`, `{{id|texte}}`, `{{id:}}`), ou, le curseur dans une balise, en changent le mot-clé.
- **Ce qui n'est pas un mot-clé** : une capacité (de monstre, de classe) ou une altération d'état qui porte le nom d'un mot-clé reste la capacité ou
  l'état (le Non-mort, type de monstre ET capacité de monstre : la tuile de capacité n'est jamais un mot-clé) ; seule une balise fait un mot-clé. Les
  valeurs « {N} » des capacités communes (une accolade : `{{12}}` est une balise, jamais un emplacement) et la couleur de case « {couleur:x} » ne sont
  pas des balises.

Chaque mot-clé a son adresse, `/recherche/?mot-cle=<id>` (son libellé, sa définition, puis les pages qui le portent ou le citent) ; renommé, il garde son
adresse. La page Recherche est le glossaire : tous les mots-clés, même sans page, chacun avec l'infobulle de sa définition. Sur le site de dev, en mode
modification, elle crée (avec sa définition), renomme, fusionne et supprime un mot-clé ; les mots-clés dont le site se sert ne se renomment ni ne se
suppriment, leur définition se modifie. Une page créée depuis le site ne porte que ces mots-clés-là. Les événements de la chronologie n'ont pas
d'étiquette (« trop nombreux et trop libres », demande du propriétaire) mais des **catégories**, un vocabulaire à part (voir « Chronologie ») ; leurs
descriptions peuvent citer des mots-clés.

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

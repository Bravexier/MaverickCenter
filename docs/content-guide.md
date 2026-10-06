# Écrire des pages du wiki

Une page = un fichier Markdown `client/src/content/wiki/<catégorie>/<slug>.md`.
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

Le site en tire : le bloc « Magies innées disponibles » d'une race, « Disponibilité par race » et « Relations avec les autres magies »
(fort contre = résistance, faible contre = vulnérabilité, incompatible) d'une magie, la page `/wiki/races-et-magies/` (deux tableaux) et le
rangement des races. L'incompatibilité est lue dans les deux sens : une magie citée par la page d'une autre est marquée « déduite » (*).
`test/races-magies-content.test.mjs` vérifie ces champs sur le contenu réel (noms existants, concordance avec le texte de la page, effectifs).

**Priorité entre les sources d'une race** : l'onglet de la race dans le classeur « Les races » (histoire, présentation, avantages et
inconvénients, don de base, ethnies, mode Hyper) prime sur la « Fiche personnage Maverick Auto V15.2.2 » quand les deux divergent
(la fiche est en retard par endroits : don de base, mode Hyper, statistiques du Drakos, magies innées du Nain…). Chaque page de race affiche
les valeurs de l'onglet et liste, dans « Écarts avec la fiche de personnage V15.2.2 », ce que la fiche dit de différent ; rien n'est tranché en silence.
Les écarts listés couvrent les valeurs de départ, le don de base, le mode Hyper, les magies innées, les ethnies, et aussi les écarts de texte libre :
une restriction de caractéristique (l'onglet du Majin dit « La Volonté a un maximum de 3 », la colonne « Restrictions Volonté » de la fiche dit « > 2.0 »),
« Accès à toutes les classes / à toutes les magies » ou « Une seule magie autorisé » contre le nombre de 1 des matrices de la fiche (la matrice reste affichée
telle quelle, sans interprétation), et les phrases du « Divers » de la fiche que l'onglet ne dit pas. Les sections « Classes accessibles » et « Magies accessibles »
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
`lib/race-kinds.mjs`) ; les données confirment que ces 13 races ont exactement 3 magies innées ; les 14 races pures en ont 13 ou plus, sauf le Nain
(5 magies innées d'après son onglet, voir l'exception ci-dessus).

## Capacités de classe (type `capacites`)

Chaque capacité d'un onglet de « Classe Maverick V7 » a sa fiche `capacites/<classe>-<nom>.md` (le tableau d'aptitudes n'est plus dans la page
de la classe). Champs du frontmatter, déclarés dans `content.config.ts` et lus par `client/src/lib/capacites.mjs` :

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
d'une règle est refusé par l'outil et se demande au propriétaire. Les noms propres et les jeux de mots du classeur sont gardés (les noms
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
- `draft` : importé depuis une source, pas encore relu par le MJ (défaut).
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

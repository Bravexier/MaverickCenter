# Fiche auto (Google Sheets) : la V1.2 corrigée

La fiche de personnage automatique est un classeur Google que chaque joueur copie. Son ancien mainteneur est parti ; depuis le 2026-10-10, le
propriétaire du projet en tient une version corrigée dans son Drive, avec des copies de tous les classeurs et Google Docs du jeu
(dossier « Maverick JDR ») :

| Fichier | Rôle |
| --- | --- |
| [Fiche personnage Maverick Auto V1.2](https://docs.google.com/spreadsheets/d/1LYTcRXjB7yMuZJC2DVd71LWkSy87AEEVl5FGUra7eWM/edit) | La fiche à copier : la V1.1 de l'ancien mainteneur, corrigée (ci-dessous) |
| `Maverick JDR/Classeurs et documents du jeu/` | Copies des 8 classeurs et 4 Google Docs, mêmes titres et mêmes onglets (gid) que les originaux ; le site les cite (migration `0014-sources-copies-drive`, registre `.json`) |
| `Maverick JDR/Anciennes fiches auto/` | Copies d'archive des fiches V15.0.5, V15.2.2 (celle que cite la base) et V1.1, non modifiées : elles lisent toujours les classeurs d'origine |

Le registre `data/migrations/0014-sources-copies-drive.json` donne, pour chaque document, l'identifiant d'origine et celui de la copie.
Deux documents du manifeste, « CODEX Maverick » (`1CwDqDKurMOdqig3ozX4NQETbBW9sggsxEqM1WfbOG5M`) et « Bestiaire 2.0 »
(`1vn5Tq11U6LG2T3X9Yobu5E_3DCKrg2jFoPFisvLYXK8`), étaient hors de portée du Drive du propriétaire et n'ont pas été copiés par la migration. Le
propriétaire les a copiés le 2026-10-11 : le « CODEX Maverick » (`1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg`, manifeste et [`codex.md`](codex.md)) et
le « Bestiaire 2.0 » (`1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE`, [`bestiaire.md`](bestiaire.md)). Le site ne renvoie plus aux classeurs « Familiers » et « Prototype » (migration `0019-liens-familiers-prototype`).

## Comment la fiche lit les règles

- **Importées** : la fiche lit quatre classeurs avec `IMPORTRANGE`, dont l'adresse est dans `BDD!BE2:BE6` (Classes, Races, Magies,
  Invocations, Ressources et craft ; `BE5` n'est lu par aucune formule). Les onglets « Classe1 Choisie », « Classe2 Choisie »,
  « Classe Choisie Archimage », « Sorts », « Armes », « Armures », « Bouclier », « Accessoire » et `IDOnglets` sont remplis ainsi.
- **Recopiées à la main** : « Race », « Accessibilité de Classe », « Accessibilité Magie », « Bonus Race » et « Magie » sont des valeurs figées
  dans la fiche. Elles ne suivent pas les classeurs : c'est par là que la fiche dérive (décision R13 : l'onglet de la race fait foi).
- **Autoriser l'accès** : Google demande d'autoriser chaque classeur une fois par fiche (y compris dans chaque copie d'un joueur). L'onglet
  « Connexions » de la V1.2 appelle chaque classeur sans filtre d'erreur : cliquer sur chaque case `#REF!` de la colonne Test, puis
  « Autoriser l'accès ». Un joueur doit aussi pouvoir **lire** les classeurs : les originaux étaient partagés « tous les utilisateurs
  disposant du lien » ; les copies doivent l'être de la même façon.

## Corrections de la V1.2

Numéros de la liste d'erreurs relevées dans la V15.2.2 (les points 1 et 2 étaient déjà corrigés par la V1.1). Chaque correction a été relue
dans la fiche après écriture ; « testé » signale un essai avec de vraies saisies (remises à blanc ensuite).

| # | Erreur | Correction | Fondement |
| --- | --- | --- | --- |
| 3 | Puissance magique 5 au niveau 17 | `BDD!AK6` : `W8>=16` (testé) | R16 |
| 4 | +4 AM : liste de 9 classes écrite en dur | `BDD!BK1:BK2` (« classe 1/2 magique ») : catégorie Magique, Archimage, ou don de spécialité choisi qui dit « considérer comme classe magique » (13 classes raciales, Flagelleur Masochiste), lu dans l'onglet de la classe dès le niveau 10 ; `H40`, `I40` et `BB2` (emplacements de sorts) les lisent (testé pour le Mage) | R6, R7 ; textes des dons |
| 5 | Le compteur d'attributs compte les bonus de Chakra des accessoires | `BDD!K40` retire aussi `N22` | — |
| 6 | Initiative des armures : « −5 INI » compté +5 | `BDD!AH29` garde le signe | effet de l'Armure montagne |
| 7 | Classe raciale fantôme (Drassah'thac, Lamia) | `BDD!B28` : `OR` au lieu de `AND` | R14 |
| 8 | Elfe forestier Forêt : +3 AP permanents | `'Bonus Race'!L2` ne lit plus « 3AP/AM au lieu de 1AP/AM » comme +3 AP ; le format « 4AP/0AM » des Drakos est conservé (vérifié) | texte de l'ethnie |
| 9 | Bonus de caractéristique des accessoires calculé mais jamais appliqué, et faux | `BDD!L12:Q12` : ±1 par accessoire « CARACTERISTIQUE » visant la caractéristique, signe de **son** accessoire ; `L14:Q14` : plafond = maximum racial (lui-même ≤ 4) ; `Personnage!G18, O18, W18, G19, O19, W19` = bonus de magie + bonus d'accessoire, donc compétences, maximum d'acquis, prérequis d'armes et initiative en tiennent compte (testé : +1, maudit −1, plafond) | Ressources et Craft › Accessoires : « SI CARACTERISTIQUE […] Ne peux dépasser 4 / Ne peux dépasser les limite raciale » ; malédiction : « +1 force devient -1 force » |
| 10 | La malédiction du premier accessoire d'un type s'applique à tous | `BDD!J38`, `J40` (AP/AM de base), `L18`, `L19` (dégâts physiques), `L21` (dégâts magiques) : signe de chaque accessoire ; `BC9` et `BC11` ne servent plus | — |
| 11 | Don « Proche » du Clerc seulement en classe 1 | `BDD!BH2` : Clerc en classe 1 ou 2 (l'altération suit, `V16:V29`) | don de niveau 1, sans choix |
| 12 | Ambidextrie | `BDD!AH31` (1re arme), `AH32` (2e) : 20 % / 40 %, divisé par 2 avec une dague et par 2 pour le Bimane ; « Équilibré » (Bimane, niv. 15) −5 % sur la 2e arme ; « Équilibre » (Mercenaire, niv. 15) −10 % sur les deux ; dons cherchés en classe 1 (`C51`) et en classe 2 (`C65`) (testé : −10 %/−15 %, −10 %/−30 %) | Ressources › Armes, Dague ; textes des dons |
| 14 | Felfe et Satyre sans ethnie | `'Bonus Race'` : « Felfle » → « Felfe », « Satyre␣ » → « Satyre » (testé) | R10 |
| 15 | Prérequis d'Agilité des armes jamais lus | `Armes!H2:M2` : un seul motif pour « N de X », « N d'X » et « N de Y et (de) X » ; seules 5 armes changent : Espadon fin 4, Espadon arqué 3, Bident 2, Glasius 2, Tibia de Véloce 5 | textes des armes |
| 16 | Éventail : +2 dégâts dans tous les modes | `Armes!N2` : quand l'effet décrit des modes (« Ouvert = … », « Fermé = … ») au bonus différent, le bonus n'est pas compté d'office (le texte reste affiché) ; Épée bâtarde (+2 dans ses deux modes) inchangée | texte de l'Éventail |
| 17 | Armure Cuivre/Vif Argent sans stats | coquille corrigée dans le classeur (copie) Ressources et Craft, `Armures!DV85` : « Stats :+16AP » → « Stats : +16AP » | R10 |
| 19 | Acquis d'Arme Lourde, Athlétisme, Parade, Stabilité | validation `Personnage!I23:I26` → `BDD!$L$8` | — |
| 20 | Acquis de Dressage, Intimidation, Manipulation, Négociation sans limite | validation `Personnage!V28:V31` → `BDD!$P$8` (5 × Social) | — |
| 21 | Classes interdites par la race proposées | `BDD!B2` filtre la liste (désormais en `BDD!BL2:BL26`) par « Accessibilité de Classe » ; l'Archimage (`B27`) et la classe raciale (`B28`) gardent leurs règles (testé : le Médusain n'a plus Guerrier, Cuirassé ni Frappeur) | matrice de la fiche (R8) |
| 22 | Dieux Eirnn et Onir absents | ajoutés à la liste de `Personnage!S5` | onglet Magie, colonne X |
| 23 | Nain : 15 magies innées | `'Accessibilité Magie'` : Potentiel Illimité, Arcane, Feu, Terre, Foudre (testé) | R11 |
| 24 | Corruption | `Magie!U5` sans l'Elfe Noir Salé ; `BDD!F2` : Corruption acquise permise à l'Elfe Noir Charbon et au Felfe Noir (testé, Salé exclu) | R15, R20 |
| 25 (races) | Capacité Mode Hyper des races | `Race!W2:W28` = texte de l'onglet de la race (celui de la base, orthographe corrigée) | R13 |
| 27 | Couleur des sorts du Potentiel Illimité ; coquilles | règle de mise en forme sur « Potentiel Illimité » (sans effet visible : un Potentiel Illimité affiche ses sorts sous leur propre magie) ; « Armure Celloluse/Acier » → « Cellulose » (classeur, `Armures!CM29`) | R10 |
| 28 | Orios de Terre sans ethnie | `'Bonus Race'!C54` : « Terre␣ » → « Terre » | R10 |
| 29 | Emplacements de sorts d'une bi-magie au niveau 16 calculés en puissance 4 | `BDD!BB2` : puissance 5 dès le niveau 16, même avec deux magies | Doc « Créer sa fiche de personnage » › Tableau magie : « Quand vous avez 2 magies, vous n'avez pas accès aux sortilèges de niveau 5, MAIS vous débloquerez tout de même les emplacements » |
| 30 | La ligne de spécialité de la classe 2 affiche le nom du don à la place de son type | `Personnage!I61` lit le type, comme `I47` pour la classe 1 | — |
| R21 | « Démon d'Eau Noire » | « Eaunoire » : liste `S5`, `Magie!X5` et couleur du dieu | R21 |
| R22 | Lamia sans Corruption | `'Accessibilité Magie'!E24` = 1 (testé) | R22 |

Restent à tester avec l'accès autorisé (ils lisent les classeurs) : 6, 15, 16, 17 et le cas « spécialité magique » du point 4.

## Non corrigé

| # | Point | Pourquoi |
| --- | --- | --- |
| 13 | Armure élémentaire : `Armures!Q2:T5` (AP, AM, effet par type) n'a que ses intitulés | Les valeurs ne sont écrites nulle part : à fournir par le propriétaire |
| 18 | Les 3 armures de familier du classeur (colonne HC) ne sont pas dans la liste | La fiche n'a pas de section familier : les ajouter à la liste du personnage les rendrait portables par lui |
| 25 (magies) | Capacités Mode Hyper de 8 magies différentes du classeur « Mode hyper et co » | Choix de la source à faire (fiche, « Mode hyper et co » ou onglet « Mode Hyper (Magie) » du classeur de magie) |
| 26 | Matrice des résistances Arcane/Corruption (`Magie!F2:S16`) | Question ouverte, `docs/sql/a-valider.md` §2 |
| — | Ambidextrie : « Fausse Patte » et « Ravageur » (−5 % avec les armes légères ou lourdes), « Directrice » (main directrice) | La fiche ne distingue ni la catégorie d'arme ni la main directrice |
| R23 | `BDD!B27` propose l'Archimage d'après la race (les 10 races qui ont le Potentiel Illimité en magie innée), sans regarder la magie innée choisie | Le propriétaire se concentre désormais sur la fiche du site (`/fiche/`), qui suit R23 |

## Importer une fiche auto sur le site

Demande du propriétaire (2026-10-15) : une fiche auto se reprend sur la page `/fiche/` (« Importer » ; détail dans
[`character-generator.md`](character-generator.md), « Tableur »). Dans Google Sheets : **Fichier › Télécharger** au format `.xlsx` ou `.ods` (ou
l'onglet « Personnage » en `.csv`), puis choisir le fichier. L'import (`client/src/lib/fiche-tableur-import.mjs`) reconnaît l'onglet à ses libellés
(« COMPÉTENCES » en B21, « AP Base » en AA20) : l'onglet « Personnage » d'abord, sinon le premier onglet qui les porte (un onglet renommé ou déplacé
est retrouvé, et le message de la page le nomme) ; les adresses sont dans `lib/fiche-tableur-cases.mjs#AUTO`.

- **Repris** : identité, race, ethnie (parmi celles de la race), magies, dieu choisi (« Démon d'Eau Noire » mène à Eaunoire, R21 : la migration
  0012 a changé le nom, pas l'identifiant `demon-deau-noire` ; depuis la migration 0006, un nom corrigé garde son identifiant), alignement (L5:O5), bourse, XP, classes et spécialités, caractéristiques et croix (cases à cocher), naturel des
  compétences, maîtrises (« Nd » en AI et AN), armes (nom sans la mention de ses mains, composition, amélioration, élément ; le fer quand la
  composition manque, R49), armure (AD21, AT20, AS21, AX21), bouclier et ses trois matériaux, accessoires (propriété, effet, valeur — « 18% » ou
  0,18 : 18 —, malédiction), ceinture (AQ29, AQ32, AQ35, et leur quantité en AX), inventaire, sorts et NM, dons à choix, métier, événements
  (jusqu'à la dernière ligne écrite ; le type, colonne I, entre dans le texte : « titre (type) : texte »), notes.
- **Déduit**, et dit dans les notes : l'acquis du joueur (l'acquis écrit moins le bonus du métier, R33 rogné au plafond R38, et les accessoires,
  R54 ; une remarque par compétence touchée, ces bonus pouvant différer de ceux de la base), les gains de niveau (d'après les maximums de santé et de
  chakra, F14 et M14 ; « à vérifier »), la compétence d'un accessoire « Compétence X » (d'après la case « Entraînement », L42, où la fiche note les
  bonus d'entraînement : guide « Fiche de personnage : Capacités/Dons »), l'élément d'une armure écrit par le nom de sa magie (l'armure élémentaire
  de cette magie et de la catégorie de l'armure), la caractéristique de la magie au choix du Potentiel Illimité, les NM des sorts (tous comptés de
  niveau : la fiche ne dit pas lesquels viennent d'un livre ou du MJ, R26 ; dit quand ils dépassent ceux du niveau). Déduits sans remarque : le
  mode bi-classe (deux classes au niveau global, sous le niveau 20 : R2) et la spécialité d'après un don de spécialité. Un nombre décimal là où la
  fiche veut un entier est arrondi vers le bas, avec une remarque.
- **Pas repris**, et dit dans les notes : un nom introuvable dans les règles ou qui en désigne plusieurs sans rien pour les départager, la case
  « Ambidextrie » cochée (AU8 : l'attaque à deux armes est calculée, décision R46), ce que les règles du site retirent. Les valeurs calculées
  (totaux, dégâts, AP, AM, paliers de résistance…) ne sont pas relues : le site les recalcule. L'image en A1 (le logo de la fiche auto) est ignorée.
- « Effet en plus » (AA13, AN13) n'est pas relu : dans les fiches du propriétaire, c'est une formule (`=BDD!AJ36`, relevée le 2026-10-15), qui ne
  porte aucune saisie du joueur ; on y lit l'effet du catalogue de l'arme, puis celui de son matériau (Lucien, Laiton : « dégâts doublés contre la
  barrière » ; Louise, Mythril : « Passe barrière »). L'effet en plus de la fiche importée reste vide.

Les deux fiches du propriétaire servent d'essai (`client/test/fixtures/fiche-auto-lucien.json`, `fiche-auto-louise.json` : valeurs affichées,
lues par l'API Google) : `test/fiche-tableur-import.test.mjs` vérifie ce qui est repris et ce qui part dans les notes, `test/fiche-tableur-aller-retour.test.mjs`
qu'une fois importées, exportées au modèle ordinateur puis réimportées, elles ne changent plus, et `test/fiche-tableur-page.test.mjs` que la fiche de
Lucien se retrouve dans un onglet renommé, rangé après d'autres.

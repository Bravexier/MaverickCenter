---
name: zone-fiche
description: "Fiche de personnage /fiche/ : quatre zones, règles au build (fiche-regles.mjs, regles.json), moteur pur (fiche-moteur.mjs), acquis calculé (R104), sorts, armes, armure, ceinture et sac, accessoires, résistances, postures, contrôles. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/pages/fiche/index.astro", "client/src/pages/fiche/regles.json.ts", "client/src/scripts/fiche.mjs", "client/src/lib/fiche-regles.mjs", "client/src/lib/fiche-moteur.mjs", "client/src/lib/fiche-controles.mjs", "client/src/lib/maitrise-arme.mjs", "client/src/lib/resistance-texte.mjs", "client/src/lib/degats-texte.mjs", "client/src/lib/posture-texte.mjs", "client/src/lib/sort-bonus-texte.mjs", "client/src/lib/acquis-texte.mjs", "client/src/lib/ceinture-texte.mjs", "client/src/styles/fiche/**", "client/test/fiche-*.test.mjs", "client/test/maitrise-arme.test.mjs", "client/test/resistance-texte.test.mjs", "client/test/degats-texte.test.mjs", "client/test/sort-bonus-contexte.test.mjs", "client/test/maitrise-sorts.test.mjs", "client/src/lib/accessoire-champs.mjs", "client/test/accessoire-champs.test.mjs", "client/src/scripts/portrait.mjs", "client/src/lib/portrait.mjs", "client/test/portrait.test.mjs", "docs/character-generator.md"]
user-invocable: false
---
# Fiche de personnage

## Fichiers
- Page : `client/src/pages/fiche/index.astro` (`/fiche/`, `/fiche/?id=<id>`), CSS `styles/fiche/fiche.css`.
- Script de page : `src/scripts/fiche.mjs` (DOM, enregistrement, autocomplétion du sac `#autocompletion`).
- Règles au build : `lib/fiche-regles.mjs` → `/fiche/regles.json` (`pages/fiche/regles.json.ts`).
- Calculs purs : `lib/fiche-moteur.mjs`. Libellés des contrôles : `lib/fiche-controles.mjs`.
- Lecteurs de textes de dons (au build) : `lib/acquis-texte.mjs` (`lecteurDAcquis`), `lib/maitrise-arme.mjs` (`desSelonLaForce`), `lib/resistance-texte.mjs`, `lib/degats-texte.mjs` (`RAISONS`, `parCranPerdu`), `lib/posture-texte.mjs`, `lib/sort-bonus-texte.mjs` (`preparationEcrite`, `ETIQUETTES_DES_SORTS`), `lib/ceinture-texte.mjs`.
- Partagés : `lib/sort-maitrise.mjs#valeurAuNm`, `lib/sort-cout.mjs`, `lib/creature-npm.mjs#creatureAuNpm`, `lib/accessoire-champs.mjs` (R54, voir « Situation »), portrait `src/scripts/portrait.mjs` + `lib/portrait.mjs` (partagés avec le mode modification du bestiaire).
- Format d'une fiche, tables de la section 13, retraits R42, base vivante : skill `zone-fiches-base` et skill `zone-service`. Tableur (Télécharger, Exporter, Importer) : skill `zone-fiche-tableur`. Liste `/personnages/` : skill `zone-personnages-liste`.

## À lire
- `docs/character-generator.md`, « La page `/fiche/` » : le détail de chaque bloc (zones, portrait, ceinture, sac, choix, dégâts, solidité, armure, deux armes, postures, compétences, métier, alignement, attributs, résistances, caractéristiques et acquis, maîtrises, sorts, sort préparé, dons, gains de niveau, accessoires, bouclier, défense et dégâts reçus, posture du moment, bâtons, invocations, sorts du moment, contrôle, enregistrement). Le lire avant de toucher un bloc.
- `docs/character-generator.md`, « Fiches dans la base » (tables et vues).
- `docs/decisions-regles.md` pour le texte exact de chaque R… cité ici.

## Invariants
- Les règles de la page viennent de la base au build (`lib/fiche-regles.mjs`), jamais écrites à la main. Rien n'y est recalculé ; seuls les lecteurs ci-dessus lisent des textes. Les balises du glossaire sont retirées de tout texte lu, avant les lectures comme dans le JSON (skill `zone-mots-cles`).
- Chaque calcul de `lib/fiche-moteur.mjs` cite sa source (fiche auto V15.2.2, guide, décisions) et a son test, comparé aux vues SQL quand elles existent.
- Les contrôles qui font foi sont ceux de `v_personnage_controle` (rendus par le service). Toute règle ajoutée à la vue doit avoir son libellé dans `lib/fiche-controles.mjs` (`test/fiche-controles.test.mjs`). Ils signalent, ils n'empêchent jamais d'enregistrer ; toute fiche est contrôlée, même inachevée (plus de statut, migration `0038-personnage-sans-statut`).
- Une colonne ajoutée à la section 13 apparaît dans le JSON d'une fiche sans rien changer au service ; la page, elle, doit lui donner un champ.
- Avant la 1.0, la fiche ne crée que des prétirés : création et modification d'un prétiré sur le même écran (`/fiche/`, `/fiche/?id=<id>`), enregistrement par le service (`/api/`). Une fiche se supprime par `DELETE /api/personnages/<id>/` avec sa version.
- `/generateur/` n'existe plus : la page 404 y renvoie (`lib/nav.mjs#nouvelleAdresse`, `PAGES_RENOMMEES`).
- Le script de page n'importe que des modules purs que seule cette page utilise (la version portable refuse un module partagé ; skill `site-version-portable`), sauf le choix et le recadrage du portrait (`src/scripts/portrait.mjs`, `lib/portrait.mjs`) : ils sont partagés avec le mode modification du bestiaire, absent de la version portable (alias vers `src/scripts/edition-absente.mjs`), où seule la fiche les emporte (skill `zone-bestiaire`, « Portrait »). Il n'importe ni `lib/arme-forge.mjs` ni `lib/armure-forge.mjs` (importés par les scripts des armes et des armures) : le moteur en recopie les formules, et un test compare les deux. Il n'importe pas non plus `lib/caracteristiques-postures.mjs` : les couleurs arrivent par `regles.json` (skill `ui-couleurs`).
- Rien de ce que la fiche calcule n'est stocké (skill `zone-fiches-base`). L'Acquis du métier n'est jamais écrit dans `personnage_competence`.
- Fiche d'avant : `sansPartiesRetirees` (`lib/fiche-format.mjs` ; entraînement en texte → lignes de texte, `entrainementEnLignes` ; acquis > 0 → un retrait noté, `acquisRetires`, nature `acquis`) ; la base vivante fait la même conversion par `COLONNES_CONVERTIES` de `serveur/base-vivante.mjs` quand l'ancienne base a la colonne.

## Choix du propriétaire

### Mise en page
- Quatre zones sans cadre ni titre visibles (maquette validée par le propriétaire) : I identité (portrait recadrable, nom, niveau seul, race · ethnie · métier, magies, « Bi-classé » et classes) ; II à portée de main (attributs, caractéristiques et compétences, armes et maîtrises, ceinture, sorts, dons débloqués et entraînement) ; III selon la situation (postures et Mode Hyper, armure avec défense et dégâts reçus, accessoires, inventaire juste en dessous, initiative et vitesses, résistances, bouclier) ; IV paramètres et suivi en onglets (progression, choix, notes, contrôle ; `components/Onglets.astro`, un panneau caché seulement sous `html.js` : skill `ui-onglets`).
- Page compacte, sans lien vers le guide : choix en menus déroulants (`<details class="choix">`), races, magies et classes en pastilles ; caractéristiques à 1 par défaut, jamais vides (`caracteristiquesCompletes`), et naturel des compétences en curseurs ; clic droit ou Entrée sur un curseur = saisie bornée (`borner`).
- Caractéristiques sur une seule ligne, deux cases de croix chacune (R19), score « N/A » à deux croix. Compétences sur deux colonnes remplies de haut en bas.
- Attributs sans texte de calcul (détail en infobulle) ; valeurs du moment en curseurs dans les cartes des attributs avec leur maximum, plus des boutons + et − (`ajusterValeurDuMoment`) ; chakra actuel ≤ chakra − corruption hors magie de la Corruption (`valeursDuMoment`) ; santé rouge, barrière jaune, chakra bleu, corruption noire. Initiative, vitesse et nage en tuiles.
- Alignement calculé à côté de ses quatre scores (`alignementDe`, guide « Alignement »). Jauge d'XP en tête du bloc de progression (`progressionXp`).
- Cadres des blocs dans la couleur de la magie innée, en dégradé vers l'acquise (`--magie-1`, `--magie-2`) ; seuls les cadres changent.
- Portrait : `personnage.portrait` (data URL de 700 000 caractères au plus) et son cadrage `portrait_x`, `portrait_y`, `portrait_zoom`, recadrage dans un `<dialog>` (migration `0031-fiche-zones`).
- Choix à faire (`choixEnAttente` : ethnie, spécialité, dons, métier, +1 d'une magie au choix, acquis, accessoire, résistance) surlignés (`data-a-choisir`) ; tant qu'il en reste, le panneau « Choix » en tiroir fixé en bas de l'écran, rangé quand la zone IV est à l'écran (IntersectionObserver).

### Race, magies, classes
- L'Archimage n'est ouverte qu'au Potentiel Illimité inné, qui l'impose en classe 1 et l'y verrouille (R23 : `classe.magie_innee_id`, migration `0015-archimage-potentiel-illimite`, règles `classe_reservee` / `classe_imposee`, `classesSelonLaMagieInnee`).
- Le Mage Bleu est fermé au Potentiel Illimité (R25 : `classe.magie_innee_exclue_id`, migration `0020-mage-bleu-potentiel-illimite`, règle `classe_exclue`).
- La Lamia n'a pas de magie acquise (R28 : `race.mono_magie`, migration `0022-lamia-une-seule-magie`, règle `race_mono_magie`).
- Une ethnie sans choix se pose d'office (`ethnieImposee`) ; une magie acquise que la race ou l'innée ferme part d'office (`magieAcquiseValable`).
- Un don à choix d'une classe ou d'une spécialité retirée part avec elle, et un don qu'aucun choix des règles ne range (supprimé sur le site de dev, devenu reçu d'office : D11) aussi (`donsValables`).
- Dons : le rappel des dons de race (don de base, don de l'ethnie, ligne du tableau de la race : `donsDeRace`) puis des dons de classe débloqués (`donsAcquis`) ; Méditation ou Repos au lieu de « Don de base » (`donDeBase`).

### Acquis calculé (R104, migration `0062-fiche-entrainement-acquis`)
- Plus d'acquis saisi (`personnage_competence.acquis` retirée, `COLONNES_RETIREES`). `competencesDe` le calcule, dans cet ordre (un arbitrage) : l'entraînement (`entrainementDe`), les dons débloqués et l'armure portée (`acquisDesDons`), le métier, puis l'accessoire, rognés au plafond de R41.
- `acquisDesDons` lit au build, par `lib/acquis-texte.mjs#lecteurDAcquis`, le texte de chaque don de classe passif, de race, de la ligne de l'ethnie du tableau de la race et de l'armure : `regles.classes[].dons[].acquis`, `regles.races[].dons[].acquis`, `regles.races[].dons_tableau.lignes[].acquis`, `regles.armures[].acquis`, une liste seulement quand il y en a.
- Une armure transformée par un élément ne compte pas ses acquis (R99). « acquis max en Social est augmenté de +20 » relève le plafond (`plafondBonus`, R125).
- Plafond : au plus 5 par point de la caractéristique totale, magie innée comprise (R41, migration `0026-acquis-caracteristique-totale`) ; il prévaut sur le métier (R38).
- « X ou Y » et « à répartir au choix » sont des choix du tiroir : `personnage_acquis_choix` (`source` = le don, `rang` = le rang du choix dans son texte, `valeur` pour une répartition) ; `acquisApresChoix`, `acquisApresRepartition`, `acquisChoixValables`, nature `acquis` de `choixEnAttente`.
- « pour les compétences d'arme » : une compétence parmi les quatre (R120). « choisir 2 sur les 3 » du Templier : deux choix différents parmi les quatre (R121).
- « à tout jet impliquant la Perception », « à tout test d'Agilité » : un bonus au jet, hors acquis et hors plafond, compté dans le score (R122 : `jet`, `jetDetail` de `competencesDe`).
- Les « tests d'artisanat » s'ajoutent à `artisanatDe` (R123), rien sans métier.
- « de la compétence de l'arme choisie » (et « de l'arme de départ », « Arme à distance liée ») : la famille d'armes de la maîtrise au choix de la classe, parmi les familles maîtrisables de la catégorie de sa ligne `classe_maitrise_arme` (`arme_famille.categorie`, R127), puis la compétence, déduite ou au choix parmi celles des armes de la famille (R119, R126 : Arc ou Arme légère pour l'Arc ; `personnage_acquis_choix.arme_famille_id`, `acquisApresChoixDArme`, `armeAuChoixDeLaClasse`, `lib/fiche-regles.mjs#famillesAuChoix`). Ne pas exiger la maîtrise dans cette famille : arbitrage en attente de Q45 ; lecture du « sauf » à confirmer (Q44).
- Drakos orange, « parmi les autres » : une compétence et une altération d'état au choix parmi celles des autres lignes du tableau, indépendantes (R124, `personnage_resistance_choix`, `resistanceChoixValables`).
- Ne rien compter d'autre : un bonus d'un cas particulier (situation, condition, falsification de documents au MJ) est seulement mentionné (R128, R123), dans le bloc « Bonus d'acquis non comptés » (`nonComptes`, `RAISONS_DE_L_ACQUIS` de la page).
- Entraînement en lignes dans les dons : `personnage_entrainement` (une compétence et ses points de 0 à 10, ou un texte libre jamais compté ; règles `entrainement_valeur`, `entrainement_competences` ; une ligne à 0 ne compte pas ; deux lignes d'une compétence fusionnées à l'envoi : `entrainementsAEnregistrer`) ; un livre de sort reste `personnage_sort.nm_livre`. Son aide est lue dans le guide au build (`aideDeLEntrainement`).

### Métier (R33 à R40)
- Bonus à l'Acquis de la compétence (affiché « +N », compté dans le score, rogné au plafond R41 : `competencesDe`) ou à l'initiative et aux vitesses (`attributsDe`).
- Une croix retire 20 à l'artisanat, deux le rendent inutilisable (R39). Un rang à choix se choisit sous le métier (`bonusDuMetier`, `choixDeMetierValables`). La compétence d'artisanat s'affiche (`artisanatDe`).
- Ses objets de départ entrent dans l'inventaire au choix du métier (`inventaireSelonLeMetier`, `choisirObjetDeMetier`). Page `/metiers/` : skill `zone-metiers`.

### Sorts
- Une liste par emplacement, sans emplacement en plus (`lignesDeSorts`, R27), groupée par NPM, chaque sort sur la couleur de sa magie (`sortsParNpm`). Sans colonne NPM ; D/S/B ; valeurs au NM du sort (`valeurAuNm`) ; effet secondaire sur sa ligne ; étoile et infobulle pour la remarque.
- NM : un seul curseur de 0 à 3 (R24, R26, R118 : `bornesDuNm`, `sortAuNm`), de 1 à 3 avec un livre (`personnage_sort.nm_livre`, choisi dans l'entraînement, `sortAvecLivre` ; le tableau n'en montre que la marque), dont le NM ne compte pas dans le décompte.
- NM du MJ pour toute la fiche : un champ « + MJ » à côté du décompte (`personnage.nm_mj`, migration `0066-nm-mj-fiche`, qui a retiré `personnage_sort.nm_cadeau` : `COLONNES_CONVERTIES`, `nmDuMjDesSorts`).
- Coût, portée, dégâts et soins recalculés avec les bonus des dons, accessoires, bâtons, armure élémentaire et posture (R102, `sortDuMoment`). Un coût par unité : « × N » sous le coût, multiplié avant les réductions (R129, `multiplicateurDuCout`, `bornesDuMultiplicateur`). Un bonus lié à une situation n'est jamais compté.
- Sorts grenades par leur étiquette « Sort grenade », jamais par leur nom (R114, `sort_mot_cle`, `ETIQUETTES_DES_SORTS`).
- Bloc « Sort préparé » des dons « Préparation » et « Chargement » : un sort d'attaque NPM 1 ou 2, son jet D100, calculé à la posture enregistrée à sa préparation (R115, `personnage_sort.prepare`, `prepare_jet`, `prepare_posture_id`, un seul par fiche, migration 0067).
- Sous un sort qui invoque, ses créatures, celles du personnage d'abord, et la carte de la choisie au NPM du « × N » ; sous un sort qui sacrifie, ce que donne l'invocation sacrifiée (R130, `creaturesDuSort`, `sacrificeDuSort`). Choix non enregistré.

### Armes et maîtrises
- Maîtrises d'armes : bloc à part, curseur étroit ; dé du Pugilat selon la Force (`deDeLaFamille`) ; quota des classes et de leurs dons dans le coin (`quotaDeMaitrise`, R32, textes des dons lus par `lib/maitrise-arme.mjs`).
- Dégâts « XDY+Z » (`degatsDArme` : dé de l'arme, bonus typés de l'arme, de la composition, des améliorations et de l'élément, dons passifs dont le texte écrit les armes visées, `lib/degats-texte.mjs`, rejoué sur toute la base).
- Attaque à deux armes de mêlée (R46, `attaqueADeuxArmes`, valeurs dans `regles.ambidextrie` faute de table) : une étoile et son malus en infobulle ; plus de case « Ambidextrie ».
- Solidité de chaque arme en curseur de 0 au maximum de l'arme forgée, pastille des dégâts grisée « Cassée » à 0 (R74). `durabiliteMaxDArme` recopie la formule R51 de `lib/arme-forge.mjs` (que la fiche ne peut pas importer) ; valeur au maximum ou au-dessus = NULL ; `armesApresChoix` supprime la clé quand l'arme change, `armesApresReglage` la borne quand le matériau ou l'amélioration change ; élément non compté (Q12).

### Armure, bouclier, défense
- Armure (R95) : une armure complète, son amélioration, son élément et l'amélioration de l'élément, puis un curseur de solidité par partie (casque, torse, bras, jambes ; un seul pour une armure à solidité unifiée), de 0 (« Cassée ») au maximum = solidité de l'armure + crans de son amélioration (R77 : `soliditeMaxDeLArmure`, recopie de `lib/armure-forge.mjs#forgerArmure`). Seules les parties abîmées sont gardées (`partiesValables`) ; une autre armure est neuve (`armureApresChoix`).
- Défense totale AP/AM de la partie touchée, le torse par défaut ; l'armure d'une partie cassée et le bouclier cassé ne comptent pas (R108 : `defenseDe`, `armureParPartie`). Calcul des dégâts reçus (R98, `degatsRecus`), rien d'enregistré.
- Bouclier forme + matière (R96 : `bouclierDe`, `bouclierApresChoix`, calcul de `lib/armure-forge.mjs#forgerBouclier` recopié).

### Situation
- Postures en cases, avantages en vert et inconvénients en rouge (R47, `posture_effet.inconvenient`) ; posture du moment `personnage.posture_id` (migration `0027-posture-du-moment`). La posture cochée recalcule scores, initiative, AP/AM, dégâts des armes et des sorts (R100 : `postureDuMoment`, `scoreDuMoment`, `degatsDArmeDuMoment`, `lib/posture-texte.mjs`).
- Mode Hyper et Mode Hyper 100 % à droite une fois débloqués (`modeHyperDe`, niveaux lus dans la page « Liste des effets mode hyper »).
- Accessoires : six emplacements (R97). Ce que chaque effet change est dans `accessoire_effet_cible` (R54, migration `0037`, découpage `lib/accessoire-champs.mjs` rejoué par `test/accessoire-champs.test.mjs` : un changement du découpage demande une migration). `effetsDesAccessoires` l'applique partout (caractéristiques, Acquis de la compétence choisie, attributs, armure de base, dégâts, portée, maîtrise, Mode Hyper, résistances ; malédiction = signe contraire) ; choix dans `personnage_accessoire.competence_id` / `.arme_famille_id` (tiroir) ; effets « (Action) » et à usage compté (`accessoire_effet.usage`) à la suite des dons de race (`actionsDesAccessoires`).
- Résistances et faiblesses en zone III (`resistancesDe`, six paliers de `resistance_palier`) : les crans s'additionnent — listes des pages de magie (`magie_resistance`, V8 ; l'Arcane et la Corruption se résistent l'une à l'autre : R90) pour l'innée et l'acquise, ce que les dons écrivent en toutes lettres (`lib/resistance-texte.mjs` : race et ethnie de l'onglet, dons de classe débloqués ; une immunité écrite prévaut), et les accessoires (R54). Au choix ou aléatoire : signalé, jamais compté, sauf la résistance au choix du Drakos orange, un choix du tiroir (R124). Pas encore le reste de l'équipement.

### Sac et ceinture
- Sac (R88) : 24 emplacements à Force 1, puis 28, 32, 36 et 48 à partir de Force 5, ou 48 avec le don « Organisé » quelle que soit la Force (`donDuSacSansForce`) ; constantes `inventaire.*`, migration `0050-inventaire-ceinture`. Une ligne = un emplacement [objet][quantité], proposée ou libre, quantité de 1 à 99 (`regles.sac`), 1 ne se voit qu'au survol ; rien n'est retiré au-delà de la place (`inventaireDe`). Autocomplétion dès deux caractères.
- Un bâton magique se règle magie + niveau avant d'aller à la ceinture ; ses effets passifs comptent à la ceinture (R101).
- Ceinture (R89, `personnage_ceinture`, 3 emplacements, migration `0031-fiche-zones`) : n'accepte qu'un objet du sac, n'importe lequel ; l'assigner en sort 3 exemplaires ou tous s'il y en a moins (4 avec « Organisé »), un bâton seul, un carquois plein (sa contenance, que « Organisé » ne change pas). La quantité ne change que par « Utiliser » (−1, sans toucher au sac ; le dernier libère l'emplacement, un carquois reste à 0), « Remplir » (jusqu'au maximum avec ce que le sac a, même moins que le manque ; grisé, pas caché, quand le sac n'en a plus : R131 ; un carquois +1, sans le sac) et « Ranger » (au sac, un carquois sans ses projectiles ; seul « Ranger » vide un emplacement, un nom effacé est refusé : R131). `personnage_ceinture.quantite >= 0` (migration `0052-ceinture-carquois-vide`). Fonctions : `mettreALaCeinture`, `actionsDeLEmplacement`, `utiliserLObjet`, `remplirLEmplacement`, `rangerLEmplacement`, `minimumDeLEmplacement`, `maximumDeLEmplacement` ; textes lus par `lib/ceinture-texte.mjs`. Bâtons et carquois reconnus par la vue `v_objet_ceinture` (skill `zone-ceinture`).

### Progression
- Gains de niveau en deux totaux, santé et chakra, avec « Total attribué : T / à saisir : Y » ou « entre Ymin et Ymax » (R73 : `gainsAttendus`, `gainsDeNiveau`, lus dans les cumuls de `v_niveau` passés par `regles.niveaux`, jamais 15 × (N − 1) en dur ; accord avec la règle SQL `gains_niveau` testé aux niveaux 1 à 20).

## Tests
- `test/fiche-moteur.test.mjs` (contre les vues et le fil rouge du guide), `fiche-regles`, `fiche-controles`, `fiche-acquis`, `fiche-arme-choisie`, `fiche-durabilite` (compare `durabiliteMaxDArme` à `arme-forge.mjs` sur toutes les combinaisons), `fiche-armure` (compare à `forgerArmure`), `fiche-bouclier-defense`, `fiche-ceinture-inventaire`, `fiche-accessoires`, `fiche-postures-sorts`, `fiche-grenades-et-sort-prepare`, `fiche-invocations`, `fiche-refonte`, `fiche-format-retirees`, `fiche-retraits-texte`, `fiche-html` (site construit).
- Lecteurs rejoués sur toute la base : `maitrise-arme`, `resistance-texte`, `degats-texte`, `accessoire-champs`, `sort-bonus-contexte`, `maitrise-sorts`.
- Fiches dans une copie de la base : `test/personnages-db.test.mjs` (skill `zone-fiches-base`).
- `portrait.test.mjs` : format accepté, bornes du cadrage, empreinte (le portrait d'une fiche ou d'une carte de monstre).

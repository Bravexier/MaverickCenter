---
name: zone-fiche-acquis
description: "Fiche /fiche/ : acquis calculé des compétences (R104 : entraînement, dons, armure, métier, accessoire, plafond R41), acquis à choisir, bonus de l'arme choisie (R119, R152), entraînement, métier (R33 à R40). À charger avant de lire, modifier ou relire ces calculs, acquis-texte.mjs ou leurs tests."
paths: ["client/src/lib/acquis-texte.mjs", "client/test/fiche-acquis.test.mjs", "client/test/fiche-arme-choisie.test.mjs"]
user-invocable: false
---
# Fiche : acquis, entraînement, métier

Noyau (fichiers, invariants communs) : skill `zone-fiche`. Détail : `docs/character-generator.md`, « Caractéristiques » (l'acquis), « Dons débloqués » (l'entraînement), « Métier ».

## Acquis calculé (R104, migration `0062-fiche-entrainement-acquis`)
- Plus d'acquis saisi (`personnage_competence.acquis` retirée, `COLONNES_RETIREES`). `competencesDe` le calcule, dans cet ordre (un arbitrage) : l'entraînement (`entrainementDe`), les dons débloqués et l'armure portée (`acquisDesDons`), le métier, puis l'accessoire, rognés au plafond de R41. L'Acquis du métier n'est jamais écrit dans `personnage_competence`.
- `acquisDesDons` lit au build, par `lib/acquis-texte.mjs#lecteurDAcquis`, le texte de chaque don de classe passif, de race, de la ligne de l'ethnie du tableau de la race et de l'armure : `regles.classes[].dons[].acquis`, `regles.races[].dons[].acquis`, `regles.races[].dons_tableau.lignes[].acquis`, `regles.armures[].acquis`, une liste seulement quand il y en a.
- Seule une armure de base compte ses acquis : une armure élémentaire n'a plus rien de l'armure d'origine (R99, R165), plus de raison `element` ; une armure à cran uni cassée non plus (R157 : skill `zone-fiche-armure`). « acquis max en Social est augmenté de +20 » relève le plafond (`plafondBonus`, R125).
- Plafond : au plus 5 par point de la caractéristique totale, magie innée comprise (R41, migration `0026-acquis-caracteristique-totale`) ; il prévaut sur le métier (R38).
- « X ou Y » et « à répartir au choix » sont des choix du tiroir : `personnage_acquis_choix` (`source` = le don, `rang` = le rang du choix dans son texte, `valeur` pour une répartition) ; `acquisApresChoix`, `acquisApresRepartition`, `acquisChoixValables`, nature `acquis` de `choixEnAttente`.
- « pour les compétences d'arme » : une compétence parmi les quatre (R120). « choisir 2 sur les 3 » du Templier : deux choix différents parmi les quatre (R121).
- « à tout jet impliquant la Perception », « à tout test d'Agilité » : un bonus au jet, hors acquis et hors plafond, compté dans le score (R122 : `jet`, `jetDetail` de `competencesDe`).
- Les « tests d'artisanat » s'ajoutent à `artisanatDe` (R123), rien sans métier.
- Drakos orange, « parmi les autres » : une compétence et une altération d'état au choix parmi celles des autres lignes du tableau, indépendantes (R124, `personnage_resistance_choix`, `resistanceChoixValables`).
- Ne rien compter d'autre : un bonus d'un cas particulier (situation, condition, falsification de documents au MJ) est seulement mentionné (R128, R123), dans le bloc « Bonus d'acquis non comptés » (`nonComptes`, `RAISONS_DE_L_ACQUIS` de la page).

## Bonus « de l'arme choisie » (R119, R152)
- « de la compétence de l'arme choisie », « de l'arme de départ », « Arme à distance liée » : l'arme est la famille choisie pour la maîtrise au choix de la classe du don (R152 « Un seul choix » : son point 1 dans `maitrise_choix`, `ligneAuChoixDeLaClasse`, `familleDeLaMaitriseAuChoix` ; ses options, les familles maîtrisables de la catégorie de sa ligne `classe_maitrise_arme`, `arme_famille.categorie`, R127, `armeAuChoixDeLaClasse`, `lib/maitrise-arme.mjs#famillesAuChoix`), jamais choisie dans les acquis.
- Puis la compétence, déduite (rien d'enregistré) ou au choix parmi celles des armes de la famille (R126 : Arc ou Arme légère pour l'Arc ; `acquisApresChoix`), gardée quand une autre famille l'offre. `personnage_acquis_choix` n'a plus `arme_famille_id` (migration 0076) ; `acquisApresChoixDArme` est retirée.
- Sans maîtrise au choix posée, le bonus attend : « Choisissez d'abord la maîtrise au choix de <classe> ». La page n'a plus de liste de familles sous « Acquis à choisir » : « Arme : ÉPÉES (maîtrise au choix de Tueur) », puis la liste des compétences seulement quand la famille en offre deux.
- Le « sauf » est la famille de son bandeau, tel quel ou au singulier, ou celle que R138 rattache à « Hast », « Bâton », « Arme jet », « Masse » (`lib/maitrise-arme.mjs#FAMILLES_DES_SAUF`, réexporté par `lib/fiche-regles.mjs`).

## Entraînement
- En lignes dans les dons : `personnage_entrainement` (une compétence et ses points de 0 à 10, ou un texte libre jamais compté ; règles `entrainement_valeur`, `entrainement_competences` ; une ligne à 0 ne compte pas ; deux lignes d'une compétence fusionnées à l'envoi : `entrainementsAEnregistrer`). Un livre de sort reste `personnage_sort.nm_livre` (skill `zone-fiche-sorts`). Son aide est lue dans le guide au build (`aideDeLEntrainement`).

## Fiche d'avant
- `sansPartiesRetirees` (`lib/fiche-format.mjs`) : entraînement en texte → lignes de texte (`entrainementEnLignes`) ; acquis > 0 → un retrait noté (`acquisRetires`, nature `acquis`). La base vivante fait la même conversion par `COLONNES_CONVERTIES` de `serveur/base-vivante.mjs` quand l'ancienne base a la colonne.

## Métier (R33 à R40)
- Bonus à l'Acquis de la compétence (affiché « +N », compté dans le score, rogné au plafond R41 : `competencesDe`) ou à l'initiative et aux vitesses (`attributsDe`).
- Une croix retire 20 à l'artisanat, deux le rendent inutilisable (R39). Un rang à choix se choisit sous le métier (`bonusDuMetier`, `choixDeMetierValables`). La compétence d'artisanat s'affiche (`artisanatDe`).
- Ses objets de départ entrent dans l'inventaire au choix du métier (`inventaireSelonLeMetier`, `choisirObjetDeMetier`). Page `/metiers/` : skill `zone-metiers`.

## Tests
`test/fiche-acquis.test.mjs`, `fiche-arme-choisie`, et `fiche-moteur` (skill `zone-fiche`).

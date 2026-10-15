# Rapprochement des classeurs et de la base (2026-10-15)

Demande du propriétaire : « m'assurer que toutes les sources des classeurs ont été correctement intégrées dans des tables dans tous les sens ». Ses
réponses du même jour sont la décision **R81** (`docs/decisions-regles.md`) : les classeurs **originaux** font foi, un écart est **listé** puis appliqué
à sa demande, une valeur modifiée à la fois dans le classeur et sur le site de dev **lui est demandée**. Méthode et outil : `docs/sources.md`,
« Rapprochement d'un classeur » ; instantanés du 2026-10-15 dans `sources/raw/classeurs/`.

Chaque écart est rangé dans une catégorie :

- **(d1) le classeur a changé depuis l'import** : la base a l'ancienne valeur. À valider par le propriétaire avant toute migration.
- **(d2) erreur ou oubli d'import** : cellule porteuse de règle absente de la base, valeur mal recopiée, provenance (`source_ref`) fausse ou incomplète.
- **(d3) écart voulu** (orthographe, décision R…) que l'outil ne sait pas encore reconnaître.

Les faux écarts de l'outil sont corrigés dans l'outil, pas listés ici.

## État par classeur

| Classeur | Lignes de la base | État | Écarts restants | Nature |
| --- | --- | --- | --- | --- |
| Classe Maverick V7 | 1 228 | **rapproché** (le test exige 0 écart) | 0 | — |
| Invocation | 1 128 | en cours | 26 | (d3) une copie de tableau ; aucun (d1) |
| Mode hyper et co | 133 | en cours | 56 | (d2) provenance incomplète, unité non écrite ; aucun (d1) |
| Les races | 5 226 | en cours | ≈ 1 270 | (d2) provenance en libellés de zone (forme de la migration 0007) ; aucun (d1) |
| Magie Maverick V8 | 2 413 | en cours | analyse en cours | — |
| Ressources et Craft | 2 981 | en cours | analyse en cours | — |
| Fiche auto V15.2.2 | 2 188 | en cours | analyse en cours | — |

**Aucun changement des classeurs depuis l'import (d1) n'a été trouvé à ce jour** dans les quatre classeurs analysés.

## Classe Maverick V7

Rapproché : 0 écart dans les deux sens. 270 cellules ignorées avec leur raison (onglet « Combo stat », bannières, consigne et intitulé du Sommaire) et deux
libellés de mise en page (« Lvl », intitulés du gabarit des onglets). Registre : `tools/sources/ignorer/classe-maverick-v7.json`.

## Invocation

**(d3) Tableau « AMÉLIORATION CADAVÉRIQUE » recopié dans deux classeurs (26 cellules).** Le schéma garde une seule copie (`invocation.tableau_titre` :
« le même tableau figure dans les deux classeurs (identité vérifiée à l'import) ; une seule copie ») : `amelioration_cadaverique` ne cite que
« Magie Maverick V8 › Nécromancie › D64:Y70 ». Les 26 cellules d'« Animation des morts » (AP41:AU47, BF41:BK46) sont identiques, cellule pour cellule, à
celles de Nécromancie (vérifié sur les instantanés). **À faire** (`ingenieur-donnees`) : une migration qui ajoute à chaque `source_ref` la citation
« ; Invocation › Animation des morts › AP<r>:BE<r> » (rangs 1 à 7) ou « BF<r>:BU<r> » (rangs 8 à 13).

## Mode hyper et co

**(d2) Provenance incomplète de `mode_hyper_effet` (version `classeur_modes`, 36 lignes ; 27 écarts et 20 cellules non citées).** Chaque ligne cite
sa cellule d'effet (F ou P) mais pas l'étiquette de sa ligne en colonne A (« Général », « Arcane »…), d'où viennent `libelle` et `magie_id`. Les valeurs
sont justes. **À faire** : une migration qui réécrit le `source_ref` en « Mode hyper et co › Mode Hyper › A<r>:E<r+2>, <F|P><r>:<O|Y><r+2> ».

**(d2) `regle_constante.unite` sans écriture dans le classeur (9 lignes).** « points » (5), « diviseur » (2) et « % » (2) ne sont pas écrits dans les
cellules citées, et aucun importeur ni test ne fabrique cette colonne (les lignes n'existent que dans `data/rows`). **À faire** (`expert-sql` puis
`ingenieur-donnees`) : un vocabulaire fermé (`CHECK (unite IN (…))`, que l'outil ne compare pas, comme les autres énumérations), ou un test qui retrouve
l'unité dans le texte.

**Remarque** : `mode_hyper_effet.variante_brut` est NULL pour la version `classeur_modes`, alors que les cellules F2 et P2 écrivent « Mono magie » et
« Bi magie » (le schéma dit « NULL si la source n'en écrit pas »). À relire avec la migration précédente.

## Les races

**(d2) Provenance en libellés de zone (355 citations, ≈ 1 270 écarts).** Les tables tirées des onglets de race par la migration 0007
(`race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, `mode_hyper_effet` version `onglet_race`) et la chronologie (`evenement`,
`evenement_extrait`) citent des rubriques (« Les races › Anansi › A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES… ») au lieu de cellules : l'outil ne
peut ni lire ni couvrir ces cellules (619 cellules non citées en découlent, et les valeurs de `race_onglet` ne se comparent qu'à A4). Vérifié à part par
l'analyse : les 690 valeurs de ces tables se lisent dans leur onglet, et les 646 cellules de contenu des onglets sont toutes dans ces tables (520 à
l'identique, 125 après les corrections d'orthographe de la page, 1 après R21). **À faire** (`ingenieur-donnees`) : une migration qui réécrit ces
`source_ref` en plages de cellules, et `tools/db/races_onglet.py` qui les écrit ainsi.

**(d2) Trois dons du Médusain citent la cellule de leur note (O30, O34, O38)** au lieu de leur ligne (A30:AJ33, A34:AJ37, A38:AJ41) : l'étiquette
« Eau en innée », « Foudre en innée », « Lumière en innée » (colonne A) n'est pas citée. Valeurs justes. **À faire** : la même migration.

**(d3) Elfe Noir!A4** : « grâce au démon d'eau noire » est devenu « grâce à Eaunoire » (décision R21, migration 0012) : déclaré dans le registre
(`voulus`).

## L'outil, après relecture

Relu par `relecteur-critique` et `expert-sql` (2026-10-15), corrigé en conséquence : base lue dans son état d'import (une ligne supprimée par le site de
dev ne rend plus ses cellules « non citées ») ; contrôle des mots d'une cellule citée (le classeur → la base, jusqu'au mot) ; conflits avec le site de
dev, ligne supprimée comprise ; registres d'orthographe découverts, clés de 0003 à clé primaire double, corrections héritées du texte dont une ligne a été
tirée, appliquées sans double correction ni coupure de mot ; colonnes typées contrôlées par leur `*_brut` ; énumérations et colonnes `*_brut` ;
plages lues malgré les annotations ; « première feuille » ; lignes qui citent deux classeurs ; notes et fils de `commentaire_orphelin`. Limites connues
(`docs/sources.md`) : deux nombres permutés entre deux cellules citées par la même ligne, deux descriptions échangées dans une même cellule fusionnée, les
formules et les listes de validation.

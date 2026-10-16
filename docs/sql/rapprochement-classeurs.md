# Rapprochement des classeurs et de la base (2026-10-15)

Demande du propriétaire : « m'assurer que toutes les sources des classeurs ont été correctement intégrées dans des tables dans tous les sens ». Ses
réponses du même jour sont la décision **R83** (`docs/decisions-regles.md`) : les classeurs **originaux** font foi, un écart est **listé** puis appliqué
à sa demande, une valeur modifiée à la fois dans le classeur et sur le site de dev **lui est demandée**. Méthode et outil : `docs/sources.md`,
« Rapprochement d'un classeur » (avec ce que « 0 écart » garantit et ne garantit pas) ; instantanés du 2026-10-15 dans `sources/raw/classeurs/`.

Chaque écart est rangé dans une catégorie :

- **(d1) le classeur a changé depuis l'import** : la base a l'ancienne valeur. Appliqué seulement une fois validé par le propriétaire.
- **(d2) erreur ou oubli d'import** : le plus souvent une **provenance** (`source_ref`) incomplète ou fausse alors que la valeur est juste ; parfois une
  colonne que l'import a fabriquée sans test, ou une donnée absente.
- **(d3) écart voulu** (orthographe, décision R…), déclaré dans le registre du classeur.

Les faux écarts de l'outil sont corrigés dans l'outil, pas listés ici.

## État par classeur

| Classeur | Modifié le | Lignes de la base | Cellules (ignorées) | Écarts | (d1) | Pour l'essentiel |
| --- | --- | --- | --- | --- | --- | --- |
| Classe Maverick V7 | 2026-09-30 | 1 228 | 3 964 (270) | **0 : rapproché** | 0 | — |
| Invocation | 2026-09-03 | 1 128 | 1 207 (26) | **0 : rapproché** | 0 | le tableau des améliorations cadavériques, copie déclarée de celui de Magie V8 |
| Mode hyper et co | 2026-09-30 | 133 | 159 (10) | 56 | 0 | (d2) provenance |
| Magie Maverick V8 | 2026-10-12 | 1 898 | 6 129 (2 302) | 55 | 0 (deux commentaires, ignorés) | (d2) provenance ; onglet « Statistiques » ignoré (R86) |
| Ressources et Craft | 2026-10-11 | 2 983 | 4 005 (284) | 464 | 9 cellules, **appliquées** (migration 0048) | (d2) provenance |
| Fiche auto V15.2.2 | 2026-03-31 | 2 188 | 17 181 (14 397) | 145 | 0 | (d2) provenance ; ses règles ignorées (R87) |
| Les races | 2026-10-12 | 5 226 | 6 203 (593) | 1 267 | 0 | (d2) provenance en libellés de zone |

« Cellules ignorées » : cellules qu'aucune ligne ne cite pour une raison écrite dans le registre du classeur (statistiques d'usage, titres, copies
vérifiées, consignes). **Aucune valeur de règle de la base n'est fausse au regard du classeur lu à l'import** : hors (d1), les écarts sont de provenance,
de colonnes fabriquées ou de cellules recopiées ailleurs.

## Réponses du propriétaire (2026-10-15) et ce qui en est fait

1. **« Ressources et Craft » a changé depuis l'import (2026-10-11)** : « Oui met à jour les objets tel que la dernière version des ressources les fait. »
   Appliqué par la migration `0048-ressources-et-craft-mise-a-jour` :
   - Accessoires, effet de défense 9 (CI60) : « Résistance Arcane et Surcharge Magique » ; effet de défense 11 (CI64) : « Résistance Corruption et
     Surcharge Magique » (la fiche compte une résistance de plus : Arcane, Corruption) ;
   - Pièces élémentaires, Arbalète d'eau (BU64) : « Recharge fluide (actif) : Munition infinie avec cette arme. » (orthographe corrigée comme le fait
     déjà 0005 ; registre `0048-ressources-et-craft-mise-a-jour.json`) ;
   - Pièces élémentaires, Épée de lumière (DD8) : « Louons le Soleil » ;
   - Bouclier, améliorations +1 à +5 (BJ4:BJ12) : 50, 100, 200, 400, 800 (total 1 550 ; la base avait 500 à 8 000) : la page « Armures et boucliers »
     les suit.
2. **Lien vers le Google Doc « Alchimie »** (9 descriptions, Équipement inventaire!BA4:BA22) : « On reviens vers l'original en cas de MAJ. » : le lien
   suit l'original écrit par le classeur, pas la copie de la migration 0014 : décision **R84**, appliquée par 0048 (descriptions et page
   « Équipement inventaire » ; le manifeste et les archives gardent la copie).
3. **« Magie Maverick V8 »** :
   - les deux fils « ICI » (Altération d'états!AV42) et « +1 » (Statistiques!AQ20) : « Tu peux les ignorer tous les deux. » (registre, `commentaires`) ;
   - l'onglet **« Statistiques »** : « tu peux ignorer l'onglet "Statistiques" c'est des données mise à la main il y a longtemps » ; les combinaisons de
     deux magies ne s'y lisent plus : « Les résistance/ faiblesses des deux magies se cumulent (ou s'annulent si opposées) », et « Il en faut une liste »
     (pas de limite de 4 magies par palier) : décisions **R85** et **R86**. Calculées depuis les listes de chaque magie (onglets de Magie V8), les 73
     combinaisons du tableau étaient exactes, sauf Nécromancie + Feu, à qui manquait « Terre » (Statistiques!AN265). Appliqué par la migration
     `0049-resistances-des-combinaisons` : les tables `resistance_duo` et `resistance_combinaison` (tirées de cet onglet) et la page
     `guide/statistiques-resistance-faiblesse` qui les recopiait (aucune page n'y renvoyait) laissent la place à la vue `v_resistance_combinaison`,
     calculée par cette règle pour tous les couples (105, dont Lumière + Ombre et Espace/Temps + Vide qui s'annulent entièrement).
4. **« Fiche auto V15.2.2 »** : « Ignore les règles de la fiche auto. Elle s'écarte beaucoup car plus maintenue depuis longtemps. » (décision **R87**,
   inscrite au registre du classeur). Ses règles absentes
   des classeurs ou différentes (maîtrise « Hast/Bâton », « Masse/Hache » ; solidité d'un bouclier ; crans des armures élémentaires d'Arcane et de
   Corruption ; Potentiel Illimité dans les incompatibilités, que R15 retire déjà ; six effets d'accessoire) ne sont pas reprises. Les décisions plus
   anciennes qui retiennent explicitement la fiche (R8 : matrice des magies innées…) ne changent pas sans le propriétaire.

## Provenance à réparer (d2, sans changer une valeur)

Une migration par lot, écrite par `ingenieur-donnees` et relue par `expert-sql` ; aucune valeur ne change, seuls les `source_ref` (et l'importeur qui
les écrit) :

| Classeur | Tables | Ce qui manque |
| --- | --- | --- |
| Les races | `race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, `mode_hyper_effet` (onglet_race), `evenement`, `evenement_extrait` | des rubriques (« HISTOIRE, DESCRIPTION, DONNÉES… ») au lieu de plages : 355 citations, 619 cellules (`tools/db/races_onglet.py`) ; trois dons du Médusain citent la cellule de leur note (O30, O34, O38) au lieu de leur ligne |
| Mode hyper et co | `mode_hyper_effet` (classeur_modes, 36 lignes) | l'étiquette de la ligne en colonne A (« Général », « Arcane »…) |
| Fiche auto V15.2.2 | `mode_hyper_effet` (fiche, 27 races) | `source_ref` tronqué : « Race › W7 » pour W27 (le chiffre des dizaines perdu), « Race › W » sans ligne |
| Fiche auto V15.2.2 | `mode_hyper_effet` (fiche : magies, effets de base), `seuil_niveau`, `caracteristique`, `arme_type` (pugilat) | l'étiquette ou l'en-tête d'où vient le libellé (Magie!A, Personnage!BA32, BDD!K35, K27, AK1…) |
| Magie Maverick V8 | `sort` (17 sorts de niveau 5), `mode_hyper_effet` (3) | le bloc du texte de niveau 5 (T79:BR88) ; le titre du panneau « Avantages de base » (AZ2) |
| Ressources et Craft | `ressource`, `recette`, `baton_magique`, `arme_famille`, `accessoire_effet(_gemme)`, `arme_elementaire`, `armure_elementaire` | l'en-tête de section, de magie, de colonne ou du bloc d'où vient la valeur (406 écarts, 296 valeurs vérifiées égales) |

**Colonnes fabriquées par l'import sans test** (à décider avec `expert-sql` : vocabulaire fermé par un `CHECK`, ou test qui les rejoue) :
`regle_constante.unite` (« points », « diviseur », « niveaux »…), `constante_equipement.unite`, `caracteristique.lettre`, `resistance_palier` (bornes et
multiplicateurs tirés de « V>2 », « ÷4 »), `regle_constante.valeur` des croix (−20, −1000). **Autres** : une note de « Ressources et Craft » (fil de
Fiche de tour!L12) n'a pas de ligne dans `note_cellule` ; 58 cellules de règles de « Ressources et Craft » ne sont que dans le corps d'une page
(`page.corps_md`), sans ligne typée ; la graphie de l'onyx diffère dans la base (« Onyx » / « Onix »).

## Écarts voulus déclarés (d3)

Inscrits dans le registre du classeur avec leur raison : « Eaunoire » (R21, migration 0012 : Les races, Fiche auto), Lamia et Corruption (R22, migration
0013), six notes corrigées par `0003-orthographe-magies.sql` hors de son registre (`voulus`) ; cinq commentaires écartés (`commentaires`) ; le tableau des
améliorations cadavériques d'« Invocation », copie de celui de Magie V8 (`copies`) ; « Elfe Noir Salé » retiré de la liste des ethnies de la Corruption
(R15, Fiche auto!U5) ; les règles de la fiche auto (R87) et l'onglet « Statistiques » (R86).

## L'outil, après relecture

Relu par `relecteur-critique` (deux fois) et `expert-sql`, et corrigé au fil des analyses des sept classeurs : base lue dans son état d'import ; contrôle
des mots d'une cellule citée ; conflits avec le site de dev, ligne supprimée comprise, et la décision du propriétaire comptée dans les deux sens ;
registres d'orthographe découverts, corrections héritées du texte dont une ligne a été tirée ; colonnes `*_brut`, énumérations et positions lues dans le
schéma ; formules et listes de validation ; « première feuille » ; lignes qui citent deux classeurs ; copies vérifiées ; entrées du registre périmées.
Le contrôle est **par ligne** : pour une mise à jour, c'est le mode `--avant` (chaque cellule changée et les lignes qu'elle touche) qui fait foi
(`docs/sources.md`).

# Rapprochement des classeurs et de la base (2026-10-15)

Demande du propriétaire : « m'assurer que toutes les sources des classeurs ont été correctement intégrées dans des tables dans tous les sens ». Ses
réponses du même jour sont la décision **R81** (`docs/decisions-regles.md`) : les classeurs **originaux** font foi, un écart est **listé** puis appliqué
à sa demande, une valeur modifiée à la fois dans le classeur et sur le site de dev **lui est demandée**. Méthode et outil : `docs/sources.md`,
« Rapprochement d'un classeur » ; instantanés du 2026-10-15 dans `sources/raw/classeurs/`.

Chaque écart est rangé dans une catégorie :

- **(d1) le classeur a changé depuis l'import** : la base a l'ancienne valeur. **À valider par le propriétaire** avant toute migration (section
  « Questions au propriétaire »).
- **(d2) erreur ou oubli d'import** : le plus souvent une **provenance** (`source_ref`) incomplète ou fausse alors que la valeur est juste ; parfois une
  colonne que l'import a fabriquée sans test, ou une donnée absente.
- **(d3) écart voulu** (orthographe, décision R…) que l'outil ne reconnaît pas encore.

Les faux écarts de l'outil sont corrigés dans l'outil, pas listés ici (voir la dernière section).

## État par classeur

| Classeur | Modifié le | Lignes de la base | Cellules (ignorées) | Écarts | (d1) | Pour l'essentiel |
| --- | --- | --- | --- | --- | --- | --- |
| Classe Maverick V7 | 2026-09-30 | 1 228 | 3 964 (270) | **0 : rapproché** | 0 | — |
| Invocation | 2026-09-03 | 1 128 | 1 207 (0) | 26 | 0 | (d3) une copie de tableau |
| Mode hyper et co | 2026-09-30 | 133 | 159 (10) | 56 | 0 | (d2) provenance |
| Magie Maverick V8 | 2026-10-12 | 2 413 | 6 129 (1 629) | 489 | 2 commentaires | (d2) provenance (431 paliers, 17 sorts de niveau 5) |
| Ressources et Craft | 2026-10-11 | 2 981 | 4 005 (284) | 491 | **9 cellules** | (d2) provenance ; (d1) à valider |
| Fiche auto V15.2.2 | 2026-03-31 | 2 188 | 17 181 (14 090) | 452 | 0 | (d2) provenance ; règles de la fiche à trancher |
| Les races | 2026-10-12 | 5 226 | 6 203 (593) | 1 267 | 0 | (d2) provenance en libellés de zone |

« Cellules ignorées » : cellules qu'aucune ligne ne cite pour une raison écrite dans le registre du classeur (statistiques d'usage, titres, miroirs
d'autres classeurs, consignes). **Aucune valeur de règle de la base n'est fausse au regard du classeur lu à l'import** : hors (d1), les écarts sont de
provenance, de colonnes fabriquées ou de cellules recopiées ailleurs.

## Questions au propriétaire

1. **« Ressources et Craft » a changé depuis l'import (2026-10-11).** À appliquer ?
   - Accessoires, effet de défense 9 (CI60) : « Résistance **Arcane et** Surcharge Magique » (la base : « Résistance Surcharge Magique ») ; effet de
     défense 11 (CI64) : « Résistance **Corruption et** Surcharge Magique ». Appliqué, la fiche compterait une résistance de plus (Arcane, Corruption).
   - Pièces élémentaires, Arbalète d'eau (BU64) : « Recharge fluide (actif) : **Munition infini avec cette arme.** » (la base : « … L'arbalète peut
     absorber l'humidité ambiante pour créer des carreaux d'eau, évitant au porteur de manquer de munitions. »).
   - Pièces élémentaires, Épée de lumière (DD8) : « Louons **le** Soleil » (la base : « Louons la Soleil »).
   - Bouclier, améliorations +1 à +5 (BJ4:BJ12) : **50, 100, 200, 400, 800** (total 1 550) ; la base, et donc la page « Armures et boucliers » (R76) :
     500, 1 000, 2 000, 4 000, 8 000 (total 15 500).
2. **« Ressources et Craft », lien vers le Google Doc « Alchimie »** (9 descriptions de fioles et kits d'alchimiste, Équipement inventaire!BA4:BA22) : le
   classeur original pointe vers le document d'origine, la base vers sa copie (migration 0014). R81 dit que les originaux font foi : garder le lien de la
   copie, ou revenir à l'original ?
3. **« Magie Maverick V8 »** :
   - deux fils de commentaire nouveaux, résolus, sans règle (« ICI » sur l'effet « Grande résistance » de Peur, Altération d'états!AV42 ; « +1 » sur le
     compteur « Terre = 26 », Statistiques!AQ20) : les ignorer ?
   - Statistiques!AN265 : une **cinquième magie, « Terre »**, dans la ligne « Résistance » de Nécromancie + Feu ; la base n'en a que quatre (Sang,
     Nécromancie, Feu, Foudre ; le schéma les limite à 4). À ajouter ?
4. **« Fiche auto V15.2.2 »** (inchangée depuis le 2026-03-31) écrit des règles que la base n'a pas, ou autrement. La fiche est-elle dépassée, ou
   porte-t-elle ces règles ?
   - maîtrise d'une « Arme d'Hast/Bâton » ou d'une « Masse/Hache » : la meilleure des deux (BDD!AI12, AI14) ;
   - solidité d'un bouclier : moyenne des solidités de ses matériaux, pondérée par leur quantité (BDD!BA12) ; R78 retient celle de la matière ;
   - armure élémentaire : +1 cran de résistance à sa propre magie (BDD!V3, V4) ; la base donne à l'armure d'Arcane +1 cran à la Corruption, et l'inverse ;
   - incompatibilités de Sang, Arcane, Espace/Temps, Vide et Nécromancie (Magie!T3:T8) : la base (V8) n'y met pas le Potentiel Illimité ;
   - six effets d'accessoire (Accessoire!P6, P16, R6, R12, R16, R19) écrits autrement que dans « Ressources et Craft », qui est plus récent.

## Provenance à réparer (d2, sans changer une valeur)

Une migration par lot, écrite par `ingenieur-donnees` et relue par `expert-sql` ; aucune valeur ne change, seuls les `source_ref` (et l'importeur qui
les écrit) :

| Classeur | Tables | Ce qui manque |
| --- | --- | --- |
| Les races | `race_onglet`, `race_don`, `race_don_tableau_*`, `race_magie_onglet`, `mode_hyper_effet` (onglet_race), `evenement`, `evenement_extrait` | des rubriques (« HISTOIRE, DESCRIPTION, DONNÉES… ») au lieu de plages : 355 citations, 619 cellules (`tools/db/races_onglet.py`) ; trois dons du Médusain citent la cellule de leur note (O30, O34, O38) au lieu de leur ligne |
| Mode hyper et co | `mode_hyper_effet` (classeur_modes, 36 lignes) | l'étiquette de la ligne en colonne A (« Général », « Arcane »…) |
| Fiche auto V15.2.2 | `mode_hyper_effet` (fiche, 27 races) | `source_ref` tronqué : « Race › W7 » pour W27 (le chiffre des dizaines perdu), « Race › W » sans ligne |
| Fiche auto V15.2.2 | `mode_hyper_effet` (fiche : magies, effets de base), `seuil_niveau`, `caracteristique`, `arme_type` (pugilat) | l'étiquette ou l'en-tête d'où vient le libellé (Magie!A, Personnage!BA32, BDD!K35, K27, AK1…) |
| Magie Maverick V8 | `sort` (17 sorts de niveau 5), `resistance_combinaison` (431), `mode_hyper_effet` (3) | le bloc du texte de niveau 5 (T79:BR88) ; la case N du palier ; le titre du panneau |
| Ressources et Craft | `ressource`, `recette`, `baton_magique`, `arme_famille`, `accessoire_effet(_gemme)`, `arme_elementaire`, `armure_elementaire` | l'en-tête de section, de magie, de colonne ou du bloc d'où vient la valeur (406 écarts, 296 valeurs vérifiées égales) |
| Invocation | `amelioration_cadaverique` (13 lignes) | la seconde copie du tableau (Animation des morts!AP41:BU47, identique à Nécromancie!D64:Y70) |

**Colonnes fabriquées par l'import sans test** (à décider avec `expert-sql` : vocabulaire fermé par un `CHECK`, ou test qui les rejoue) :
`regle_constante.unite` (« points », « diviseur », « niveaux »…), `constante_equipement.unite`, `caracteristique.lettre`, `resistance_palier` (bornes et
multiplicateurs tirés de « V>2 », « ÷4 »), `regle_constante.valeur` des croix (−20, −1000). **Autres** : une note de « Ressources et Craft » (fil de
Fiche de tour!L12) n'a pas de ligne dans `note_cellule` ; 58 cellules de règles de « Ressources et Craft » ne sont que dans le corps d'une page
(`page.corps_md`), sans ligne typée ; la graphie de l'onyx diffère dans la base (« Onyx » / « Onix »).

## Écarts voulus déclarés (d3)

Inscrits dans le registre du classeur (`voulus`, `commentaires`) avec leur raison : « Eaunoire » (R21, migration 0012 : Les races, Fiche auto),
Lamia et Corruption (R22, migration 0013), six notes corrigées par `0003-orthographe-magies.sql` hors de son registre, trois commentaires écartés à
l'import (message de conversation, compteurs d'usage). Restent à déclarer : « Elfe Noir Salé » retiré de la liste des ethnies de la Corruption (R15,
Fiche auto!U5) et la copie du tableau d'Invocation (plus haut).

## L'outil, après relecture

Relu par `relecteur-critique` et `expert-sql`, et corrigé au fil des analyses des sept classeurs : base lue dans son état d'import ; contrôle des mots
d'une cellule citée (le classeur → la base jusqu'au mot) ; conflits avec le site de dev, ligne supprimée comprise ; registres d'orthographe découverts,
corrections héritées du texte dont une ligne a été tirée, appliquées dans l'ordre des migrations pour la ligne, sans chevauchement ni coupure de mot
pour celles d'une autre ; colonnes `*_brut`, énumérations et positions lues dans le schéma ; formules et listes de validation ; « première feuille » ;
lignes qui citent deux classeurs ; identifiants des copies de 0014 ; notes, fils redits et réponses automatiques. Limites connues (`docs/sources.md`) :
deux nombres permutés entre deux cellules citées par la même ligne, deux descriptions échangées dans une même cellule fusionnée.

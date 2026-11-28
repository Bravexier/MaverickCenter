# Chantier 4 des mots-clés : le retrait des colonnes

État : conception écrite le 2026-11-28 par la session du chantier, **sans validation du propriétaire** : il a demandé de ne plus être interrogé (« Je te laisse toutes les autorisation. arrête de me demander. », 2026-11-27 ; « Lance le chantier 4 si tout est fini », 2026-11-28). Tout ce qui n'est pas cité entre guillemets comme venant de lui est un **choix d'équipe**, listé en fin de document, qu'il peut défaire. Décision suivie : R309 (6), (12), (13), (14). Aucune décision nouvelle n'est consignée en son nom.

Suite de `docs/chantier-ancrage-mots-cles.md` (chantier 1), `docs/chantier-adresses.md` (chantier 2) et `docs/chantier-pages-de-notion.md` (chantier 3). Dernier des quatre chantiers.

Les chiffres viennent de la base vivante du site de dev (`GET /api/edition/listes/`, v0.6.30, structure 134, lue le 2026-11-28 à 00:00 UTC). La copie `data/rows` du dépôt est encore celle d'avant l'ancrage : elle ne sert pas de référence ici.

## Pourquoi

R309, mots du propriétaire (2026-11-21 et 22) :

- (6) « Idéalement, il faudrai supprimer le champ définition d'un mot clé. Le mot clé refférant forcément à quelquechose ce sera alors récupérer la description de ce quelquechose. »
- (12) « Comme pour la description le libellé du mot clé sera aussi supprimé. Seul subsistera sa clé dans table. Le mot-clé récuperera le titre de la page / le nom du sort/ le nom de la race etc affin de tout uniformiser. »
- (13) « Un seul type par mot-clé. »
- (14) Synonymes, couleurs et icônes passent sur l'élément ; rien n'est perdu.

Depuis le chantier 1, `mot_cle.libelle` et `mot_cle.url` d'un mot-clé ancré ne sont plus que des copies du nom et de l'adresse de son élément, tenues par le module d'ancrage. Ce chantier retire les copies : **le mot-clé n'est plus qu'un identifiant**, et tout le reste se lit sur l'élément.

## Ce qui est en place

| | Nombre |
| --- | --- |
| Mots-clés | 1 764 |
| dont l'élément est une page | 1 318 |
| dont l'élément est un sort | 420 |
| sans élément | 26 (24 avec une adresse, 2 sans) |
| Définitions écrites | 192 : 139 sur une page de notion sans résumé, 33 sur une page qui a un résumé différent, 20 sur un mot-clé sans élément |
| Couleurs | 179 : 170 sur une page (55 Règles, 39 classes, 32 lore, 29 races, 15 magies), 9 sur un mot-clé sans élément (les neuf alignements) |
| Icônes | 21, toutes sur une page (15 magies, 3 types de dégâts, 3 monnaies) |
| Synonymes | 54, sur 36 mots-clés (35 de page, 1 sans élément : Consommable) |
| Types | un seul par mot-clé, pour les 1 764 |

Les types de sort, les types de dégâts et les monnaies ont tous leur page de notion (chantier 3) : leur nom est celui de cette page. Aucun sort ne porte de définition, de couleur, d'icône ni de synonyme.

Ce que le code fait aujourd'hui :

- Presque tout le site et le service lisent les mots-clés par une seule fonction, `lib/mots-cles-db.mjs#motsClesDeLaBase`, qui rend un objet par mot-clé (`libelle`, `url`, `description`, `couleur`, `icone`, `synonymes`, `categories`, `element`). `elementsDesMotsCles` y lit déjà le nom, l'adresse et le texte de l'élément.
- Le SQL direct sur ces colonnes est rare hors des tests : 15 requêtes dans 5 fichiers du service, 14 dans 8 modules, 11 dans 3 scripts, 2 outils Python. Les tests en comptent 484 dans 94 fichiers.
- La base du site de dev est une base source : une migration s'y applique sur place au démarrage (`serveur/structure-sur-place.mjs`), sans rejeu du journal. La CI applique la migration de la PR au contenu du jour du site de dev (`scripts/db-preparer-contenu.mjs`).
- Le paquet d'une mise à jour refuse toute table de contenu changée sans trace nouvelle au journal (`scripts/mise-a-jour-paquet.mjs`, code 4) ; une page est justifiée par une trace de sa propre ligne.

## Buts

1. `mot_cle` perd `libelle`, `url`, `description`, `couleur` et `icone`. Aucune valeur n'est perdue, réécrite ni complétée.
2. Rien ne change pour le lecteur : même nom, même lien, même infobulle, même couleur, même icône pour les 1 764 mots-clés ; R268 reste vraie (Bête, Mécanique et Démon sans infobulle).
3. Le site de dev n'est jamais cassé entre deux étapes, et chaque étape se défait.
4. La simulation de mise à jour reste verte.
5. Ensuite (lot 2) : le type devient une colonne obligatoire et les synonymes passent sur l'élément.

## Hors périmètre

- Les autres familles à ancrer (capacités de monstre, altérations d'état, équipement…), le balisage automatique, le remplacement d'un identifiant, la garde `db:ids`.
- Trancher le sort des 26 mots-clés sans élément ou des 33 définitions : chaque option retenue ici est celle qui ne change rien, l'autre est notée.
- Un champ de saisie pour la définition, la couleur, l'icône et les autres noms sur la page d'un élément : ils se corrigent par un lot de l'équipe, comme depuis le chantier 1 (R309 (17)).
- Les monnaies : elles restent figées (R219 (3)), `mot_cle.monnaie_id` ne bouge pas.

## À ne pas faire

- Écrire, fusionner ou compléter une définition ; en déplacer une dans un résumé.
- Changer la destination d'une balise.
- Écrire `data/rows` ou `data/paquet.json` à la main ; livrer en production.

## Approches

| Approche | Compromis | Sort |
| --- | --- | --- |
| **Deux PR : une table d'accueil et un lot pour les 26, puis une migration qui déplace le reste et retire les colonnes** | Deux passages de CI ; le lot laisse au journal la trace que le paquet exige pour la table nouvelle, et ses 26 lignes s'annulent (R291) | **Retenue** |
| Une seule PR, dont la migration déplace tout | La table des repères changerait sur le site de dev sans trace au journal : la simulation suivante serait refusée (code 4). Il faudrait d'abord « Copier vers le dépôt », que le garde-fou de la session a refusé | Écartée |
| Tout déplacer par des lots, la migration ne faisant que retirer | Le format de lot devrait apprendre quatre opérations pour un contenu qui ne change pas ; une fois les colonnes retirées, ces lignes ne s'annuleraient plus ; la CI lit le contenu du jour, donc une PR ouverte avant la fin des lots perdrait des valeurs | Écartée |
| Donner une page de notion aux 24 mots-clés qui ont une adresse | Leur balise mènerait ailleurs (« Classe » à `/regles/classe/` au lieu de `/classes/`) | Écartée |
| Garder `libelle` et `url` pour les seuls 26 | Le mot-clé garderait deux formes, et tout lecteur les deux chemins | Écartée |

## 1. Le modèle après le chantier

`mot_cle` ne garde que `id`, `cle`, `verrou` et `monnaie_id` (puis `categorie_id`, lot 2). Chaque mot-clé a **un élément** : une page (`page.mot_cle_id`), un sort (`sort.mot_cle_id`) ou, à défaut, un repère (§2). Une magie, un type de sort, un type de dégâts et une monnaie gardent leur lien, mais c'est la page qui porte leur nom.

| Ce qu'on lisait sur le mot-clé | Page | Sort | Repère |
| --- | --- | --- | --- |
| `libelle` | `page.titre` | `sort.nom` | `repere.nom` |
| `url` | l'adresse de la page (`lib/adresses-db.mjs`) | la place du sort dans la page de sa magie | `repere.adresse` |
| `description` | `page.definition` | `sort.definition` | `repere.definition` |
| `couleur` | `page.couleur` | `sort.couleur` | `repere.couleur` |
| `icone` | `page.icone` | `sort.icone` | `repere.icone` |

> **Correction de la revue (PR B, 2026-11-28).** La première version mettait « (aucune) » dans la colonne Sort, et le contrat C8 refusait (409) d'écrire une définition, une couleur ou une icône sur un mot-clé de sort. Cela contredisait R309 (14) (« Synonymes, couleurs et icônes passent sur l'élément ; rien n'est perdu ») et R309 (17) (« Type, couleur, icône, synonymes et définition d'un mot-clé ancré se corrigent par un lot, avec la clé de dépôt […], ligne annulable »). Le sort porte donc, comme la page, `definition`, `couleur` et `icone` (NULL permis, mêmes contraintes ; migration 0136). Aujourd'hui aucun sort n'en a : la migration recopie celles d'un mot-clé de sort sans page, et la page l'emporte pour un mot-clé qui a les deux.

L'infobulle garde sa règle (chantier 1, §8) : la définition de l'élément, sinon son résumé (`page.resume`) ou ses effets (`sort.effets`).

## 2. Le repère

Un **repère** est l'élément d'un mot-clé qui désigne un endroit du site qui n'est pas une ligne de la base (une rubrique, une page calculée, une section de page), ou une notion dont le nom attend un arbitrage. Table `repere` : `mot_cle_id` (clé primaire, référence à `mot_cle`, supprimée avec lui), `nom`, `adresse`, `definition`, `couleur`, `icone`, avec les contraintes qu'avaient les colonnes du mot-clé.

- Les 26 mots-clés sans élément reçoivent chacun le leur : même nom, même adresse, même définition, même couleur. Tableau en fin de document.
- Un mot-clé à repère reste « sans élément » au sens du verrou : il se modifie au Glossaire comme aujourd'hui, et ses champs s'écrivent dans son repère.
- Quand un mot-clé à repère reçoit une page (page de notion, « Préparer l'ancrage »), le repère part dans la même opération : sa définition, sa couleur et son icône passent sur la page.
- Un mot-clé créé nu (première race hybride, outil `scripts/baliser-mot-cle.mjs`) naît avec un repère à son nom, sans adresse.

## 3. Définition, couleur et icône de la page

`page` gagne `definition`, `couleur` et `icone`, vides sauf pour une page que désigne un mot-clé.

- Les 172 définitions de page y passent telles quelles. **Aucune ne va dans un résumé** : un résumé s'affiche sous le titre, dans la Recherche et dans les listes, ce serait un changement visible.
- Les 33 pages qui ont déjà un résumé gardent les deux textes ; l'infobulle montre la définition, comme aujourd'hui. Tableau en fin de document.
- Les 139 pages de notion montrent leur définition dans leur bloc (`<!-- guide:notion -->`), comme aujourd'hui.
- La couleur d'une page reste celle que portait son mot-clé (`lib/couleur-de-la-page.mjs`).

## 4. Lire : l'objet garde sa forme

`motsClesDeLaBase` rend le même objet qu'aujourd'hui ; seule sa source change. Les consommateurs en mémoire (balises, infobulles, Glossaire, Recherche, vocabulaire du site de dev, API v1 en lecture) ne changent pas. Passent à la lecture par l'élément :

- le SQL direct du service, des modules, des scripts et des outils Python (`tools/db/maverick.py`, `tools/docs/codex.py`, les importeurs qui lisaient le libellé dans `data/rows/mot_cle.sql`) ;
- la vue `v_mot_cle`, refaite sur l'élément (nom, définition, couleur ; l'adresse d'une page ne se calcule pas en SQL, la vue ne la rend plus) ;
- la note de version (`lib/notes-de-version.mjs`), qui compare la production (ancienne structure) au site de dev (nouvelle) : elle lit le nom, l'adresse et les champs d'un mot-clé dans la structure que chaque base a, et ne dit pas « définition ajoutée » pour une valeur seulement déplacée.

## 5. Écrire

- **Créer** un mot-clé avec son élément (page, sort, notion au Glossaire) : rien à copier, le nom et l'adresse se lisent.
- **Renommer** une page ou un sort : la clé est recalculée et les balises réécrites, comme aujourd'hui ; plus de copie du nom ni de l'adresse (`serveur/edition-ancrage.mjs#alignerMotCle`, `serveur/edition-adresses.mjs`).
- **Glossaire** : un mot-clé ancré reste en lecture seule ; un mot-clé à repère se modifie, ses champs vont dans le repère.
- **Fusion** : inchangée (un mot-clé à repère peut se fondre dans un autre ; son repère part avec lui).
- **Lots `maverick-lot/1`** : un lot écrit la définition, la couleur ou l'icône sur l'élément (`page`, `sort`, `repere` ; le sort : correction de la revue, §1). Un lot écrit avant ce chantier, qui les écrit sur `mot_cle`, est traduit vers l'élément à l'application ; le nom et l'adresse d'un mot-clé ancré restent fermés aux lots.
- **API v1** : la ressource `mots-cles` rend les mêmes champs ; elle n'accepte l'écriture de `libelle`, `url`, `description`, `couleur` et `icone` que pour un mot-clé à repère.

## 6. Le journal

Le journal du site de dev garde environ 4 900 lignes en attente, dont beaucoup notent les colonnes retirées. Rien ne s'y réécrit (comme la migration 0115).

- **Annuler une ligne** (R291) : les colonnes retirées sont ignorées dans la comparaison et dans l'écriture ; annuler la création d'un mot-clé le retire toujours. Une ligne qui n'écrivait que des colonnes retirées se refuse avec un message qui dit où le champ se corrige désormais.
  > **Correction de la revue (PR B, 2026-11-28).** Une ligne ancienne ne se refuse pas : elle s'annule sur l'élément du mot-clé (sa page, son sort ou son repère reprennent la définition, la couleur ou l'icône d'avant) ; quand rien n'y est à remettre (le nom ou l'adresse d'un mot-clé ancré, une copie), elle s'annule sans écriture, « rien à remettre » (R291 : chaque ligne s'annule).
- **Rejeu** (bases d'essai, résolution d'un conflit) : un adaptateur lit une ancienne ligne de `mot_cle` dans la forme d'aujourd'hui. Une création perd ses colonnes retirées et crée le repère du mot-clé ; une modification de définition, de couleur ou d'icône vise l'élément ; une modification du nom ou de l'adresse d'un mot-clé ancré est sans effet (c'était une copie).
- **Traces du paquet** : `repere` rejoint les tables qui partent avec un mot-clé supprimé (`scripts/mise-a-jour-github.mjs#tablesDuLot`).

## 7. Ordre des étapes

| Étape | Ce qui change | Le site de dev | Se défait par |
| --- | --- | --- | --- |
| **PR A** | Table `repere`, vide ; un lot sait y écrire | inchangé : rien ne la lit | une migration qui la retire |
| **Lot « repères »** (site de dev) | 26 lignes de `repere`, copies du nom, de l'adresse, de la définition et de la couleur | inchangé : les colonnes font encore foi | l'annulation du lot ou d'une ligne (R291) |
| **PR B** | Migration : `page.definition`, `page.couleur`, `page.icone`, et les mêmes sur `sort` (correction de la revue, §1) ; les valeurs passent des mots-clés à leur élément ; tout mot-clé sans page ni sort qui n'a pas de repère en reçoit un ; les repères existants sont réalignés sur les colonnes, qui font foi jusqu'au bout ; les cinq colonnes partent. Code : lecture et écriture par l'élément | le service applique la migration au démarrage, avec le code qui la lit : un seul basculement | la sauvegarde que le service fait avant toute migration sur place (`structure-…-v135.db`), ou une migration inverse, sans perte puisque chaque valeur est sur l'élément |
| **Simulation de mise à jour** | rien | contrôle | |

La migration de la PR B ne porte aucun texte : elle recopie des valeurs d'une colonne à l'autre (`INSERT … SELECT`, `UPDATE … SELECT`), comme les migrations 0115 et 0130. Elle est sûre sur toute base : sur la copie du dépôt, où les pages ne sont pas encore ancrées, chaque mot-clé garde son nom dans un repère.

Le lot précède la PR B pour une seule raison : la table `repere` diffère entre la copie du dépôt et le site de dev, et le paquet exige qu'une table qui diffère ait une trace au journal.

## 8. Lot 2 : le type en colonne, les synonymes sur l'élément

Après la fusion de la PR B, dans une PR à part :

- `mot_cle.categorie_id`, obligatoire, remplace la table `mot_cle_categorie` (une ligne par mot-clé depuis le chantier 1). Migration seule : `mot_cle` a déjà ses traces.
- Les synonymes quittent `mot_cle_synonyme` pour une table tenue par l'élément (une page ou un repère), l'unicité restant globale (R233). Les alias d'une page (`alias`) ne sont pas réutilisés : ils servent aux `[[liens]]`, et un alias qui deviendrait un synonyme rendrait ambiguës des balises aujourd'hui justes (« Localisation des dégâts » est l'alias d'une page et le nom d'un mot-clé).

Si le temps de la session ne suffit pas, ce lot reste à faire et le rapport le dit ; il ne bloque pas le retrait des cinq colonnes.

## 9. Effets de bord à traiter

- Compteurs épinglés : tables et liens (`debug-schema`, `serveur-debug-tables`), `tables-de-la-base`, `libelles-de-la-base`, registre de l'API, `docs/sql/*` (`db:doc`).
- `lib/edition-modele.mjs` (ressources `mot_cle`), `serveur/ressources.mjs`, `serveur/openapi.mjs`, `docs/api.md`.
- `serveur/controles-du-contenu.mjs` et `db:check` : tout mot-clé a un élément et un seul nom ; un repère ne double pas une page ou un sort.
- `planDeLAncrage` : la famille « pages de notion » prend les mots-clés à repère sans adresse ; les deux noms déjà pris restent « à trancher ».
- `client/scripts/liens-en-mots-cles.mjs`, `essai-variantes.mjs`, `baliser-mot-cle.mjs`, `autolink.mjs`.
- Docs : `docs/serveur.md`, `docs/content-guide.md`, `docs/chantier-ancrage-mots-cles.md` (section du chantier 4). Skills : demande de mise à jour écrite pour `tech-skills`, sans toucher à `.claude/skills/`.

## 10. Contrôles

- Migrations : structure, contraintes, aucune valeur perdue (comptes avant et après : noms, adresses, définitions, couleurs, icônes), rejouées sur la copie du dépôt et sur une copie ancrée.
- Lecture : pour chaque mot-clé d'une copie ancrée, l'objet rendu avant et après la migration est le même, champ par champ.
- R268 : Bête, Mécanique et Démon sans infobulle.
- Écriture : créer, renommer, supprimer, Glossaire d'un mot-clé à repère, verrou d'un mot-clé ancré, fusion, page de notion qui reprend un repère, lot ancien traduit.
- Journal : annulation d'une ligne ancienne, rejeu d'un journal d'avant la migration, note de version entre une base à l'ancienne structure et une base à la nouvelle.
- Avant chaque PR : `test:cible`, `db:check`, `db:controler-migrations`, build, et le circuit du paquet (`fabriquerPaquet`, contrôle du contenu à zéro) sur la copie ancrée.

## Les 26 mots-clés sans élément

Option retenue pour chacun, choix d'équipe : **un repère**, qui garde son nom, son adresse, sa définition et sa couleur. Sa balise mène où elle mène aujourd'hui.

| # | Mot-clé | Mène aujourd'hui à | Autre option possible |
| --- | --- | --- | --- |
| 25 | Artisanat | `/regles/artisanat/` | une page de notion à son nom (sa balise changerait d'adresse) |
| 42 | Bestiaire | `/bestiaire/` | une page de notion |
| 432 | Carquois | `/ressources/objets-a-la-ceinture/#ceinture-carquois` | une page de notion |
| 58 | Ceinture | `/ressources/objets-a-la-ceinture/` | une page de notion |
| 427 | Chaotique Bon | `/regles/alignement/#chaotique-bon` | une page de notion |
| 429 | Chaotique Mauvais | `/regles/alignement/#chaotique-mauvais` | une page de notion |
| 428 | Chaotique Neutre | `/regles/alignement/#chaotique-neutre` | une page de notion |
| 65 | Chronologie | `/chronologie/` | une page de notion |
| 66 | Classe | `/classes/` | une page de notion |
| 76 | Composants | `/ressources/composants/` | une page de notion |
| 431 | Consommable | `/ressources/objets-a-la-ceinture/#ceinture-consommables` | une page de notion |
| 135 | Fiche de personnage | `/fiche/` | une page de notion |
| 192 | Les neuf alignements | `/regles/alignement/#les-neuf-alignements` | le rattacher à la page « Alignement », qui a déjà son mot-clé (#10) : les deux se fondraient |
| 421 | Loyal Bon | `/regles/alignement/#loyal-bon` | une page de notion |
| 423 | Loyal Mauvais | `/regles/alignement/#loyal-mauvais` | une page de notion |
| 422 | Loyal Neutre | `/regles/alignement/#loyal-neutre` | une page de notion |
| 207 | Magie acquise | `/magies/` | une page de notion |
| 222 | Magie innée | `/magies/` | une page de notion |
| 223 | Magies | `/magies/` | une page de notion |
| 240 | Métier | `/metiers/` | une page de notion |
| 425 | Neutre | `/regles/alignement/#neutre` | une page de notion |
| 424 | Neutre Bon | `/regles/alignement/#neutre-bon` | une page de notion |
| 426 | Neutre Mauvais | `/regles/alignement/#neutre-mauvais` | une page de notion |
| 298 | Race | `/races/` | une page de notion |
| 388 | Localisation des dégâts | nulle part (pas de lien) | le rattacher à la page « Attaquer et se défendre », dont c'est un alias ; ou une page de notion sous un autre nom |
| 226 | Maîtrise d'arme | nulle part (pas de lien) | le rattacher à la page de la fiche « Armes et Maîtrise d'Arme », dont c'est un alias ; ou une page de notion sous un autre nom |

## Les 33 définitions d'une page qui a déjà un résumé

Option retenue pour chacune, choix d'équipe : **elle reste telle quelle**, comme définition de la page, à côté du résumé ; l'infobulle la montre, comme aujourd'hui. Autre option possible, la même pour toutes : n'en garder qu'un des deux textes (le résumé remplace la définition dans l'infobulle, ou la définition devient le résumé).

| # | Mot-clé | Page |
| --- | --- | --- |
| 10 | Alignement | `guide/alignement` |
| 11 | Altérations d'états | `guide/alterations-d-etats` |
| 27 | Les attaques d'opportunité | `guide/les-attaques-d-opportunite` |
| 26 | Les attaques discrètes | `guide/les-attaques-discretes` |
| 31 | Attributs | `guide/fiche-attributs` |
| 39 | Bâton magique | `ressources/baton-magique` |
| 49 | Bouclier | `ressources/bouclier` |
| 56 | Caractéristiques | `guide/fiche-caracteristiques` |
| 87 | Les dégâts | `guide/les-degats` |
| 112 | L'embuscade | `guide/l-embuscade` |
| 162 | Initiative | `guide/initiative` |
| 88 | Jet de dés | `guide/jet-de-des` |
| 214 | Magie de l'Arcane | `magies/magie-de-larcane` |
| 215 | Magie de l'Eau | `magies/magie-de-leau` |
| 216 | Magie de l'Espace/Temps | `magies/magie-de-lespace-temps` |
| 217 | Magie de l'Ombre | `magies/magie-de-lombre` |
| 208 | Magie de la Corruption | `magies/magie-de-la-corruption` |
| 209 | Magie de la Foudre | `magies/magie-de-la-foudre` |
| 210 | Magie de la Glace | `magies/magie-de-la-glace` |
| 211 | Magie de la Lumière | `magies/magie-de-la-lumiere` |
| 212 | Magie de la Nécromancie | `magies/magie-de-la-necromancie` |
| 213 | Magie de la Terre | `magies/magie-de-la-terre` |
| 218 | Magie du Feu | `magies/magie-du-feu` |
| 219 | Magie du Sang | `magies/magie-du-sang` |
| 220 | Magie du Vent | `magies/magie-du-vent` |
| 221 | Magie du Vide | `magies/magie-du-vide` |
| 245 | Le Mode Hyper | `guide/le-mode-hyper` |
| 420 | Mode Hyper 100 % | `guide/le-mode-hyper-100` |
| 246 | Mode Super | `guide/liste-des-effets-mode-super` |
| 284 | Pièces élémentaires | `ressources/pieces-elementaires` |
| 290 | Les postures | `guide/les-postures` |
| 291 | Potentiel illimité | `magies/potentiel-illimite` |
| 350 | La prise en tenaille et zone d'influence | `guide/prise-en-tenaille-et-zone-d-influence` |

Les 159 autres définitions (139 de pages de notion, 20 de mots-clés à repère) n'ont qu'une place possible et la prennent telles quelles.

## Choix de l'équipe

Pris par la session, non validés ; chacun se défait sans perte.

1. **Deux PR et un lot**, plutôt qu'une seule migration (« Approches »).
2. **Un repère pour chacun des 26 mots-clés sans élément**, plutôt qu'une page de notion ou un rattachement.
3. **La définition devient un champ de la page**, distinct du résumé ; aucune des 172 n'est versée dans un résumé. La décision 6 de R309 (« récupérer la description de ce quelquechose ») est lue ainsi : la définition appartient à l'élément, plus au mot-clé.
4. **Les 33 définitions restent à côté du résumé** de leur page.
5. **Couleur et icône sont des champs de la page et du repère** ; aucun champ de saisie n'est ajouté sur les pages, ils se corrigent par un lot (R309 (17)).
6. **L'objet « mot-clé » lu par le site garde sa forme** ; seul son chargement change.
7. **Le journal n'est pas réécrit** : annulation et rejeu ignorent ou traduisent les colonnes retirées.
8. **Les alias d'une page ne deviennent pas des synonymes** (lot 2).
9. **Le lot 2 est une PR à part**, après le retrait des cinq colonnes.

## Laissé au constructeur

Nom des fonctions et découpage des modules ; forme exacte de la vue `v_mot_cle` ; forme de l'opération de lot qui pose un repère ; messages de refus ; façon dont la note de version reconnaît la structure d'une base.

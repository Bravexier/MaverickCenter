# Chantier : les mots-clés au centre

État : conception validée par le propriétaire le 2026-11-22. Décision : R309. Branche : `feature/mots-cles-ancrage`.

Les chiffres viennent de la copie `data/rows` du 2026-11-20 (`16f753ab`), faute de clé de lecture de l'extrait. Sur le site de dev, le service refait le compte sur la base vivante : c'est lui qui fait foi.

## Pourquoi

Demande du propriétaire (2026-11-21) : « Je veux que les mot-clés soient centraux servent de base pour tout ce qui a besoin d'un identifiant. Une page -> Un Mot clé. Un sort -> un mot clé. Un type sort -> un mot clé. Etc... », pour « une interconnexion stable et rapide ». Puis (2026-11-22) : « maintenant que les mots clés sont un peu stabilisés j'aimerai verrouiller certaines choses ».

Aujourd'hui, 266 pages sur 1 164 ont un mot-clé, aucun sort n'a le sien et les types de sort sont une liste figée dans le schéma. Un mot-clé porte son propre nom, sa définition, son adresse et parfois plusieurs catégories, tenus à la main. Le but : **n'importe quel texte peut citer n'importe quelle page, sort ou type, avec un lien et une infobulle toujours justes, sans rien à maintenir au Glossaire.** Le gain attendu est l'interconnexion, pas la vitesse (mesuré : quelques microsecondes par requête, build inchangé).

## Le modèle visé

Un mot-clé est **l'identité d'une chose du jeu, et rien d'autre**. Dans sa table, il ne reste que son numéro, sa clé et son type. Son nom, son adresse, sa description, sa couleur, son icône et ses autres noms se lisent sur **l'élément** auquel il renvoie. Il ne se modifie nulle part : on modifie l'élément, et il suit. Ce qui n'est ni une page ni un sort, une pure notion comme « Boss » ou « Sort fer », reçoit sa propre page de wiki, qui liste les éléments liés.

Quatre chantiers, chacun une PR à part, conçu quand le précédent est livré :

| | Chantier | Ce qu'il livre |
| --- | --- | --- |
| **1** | **Ancrage et verrou** (détaillé ici) | Un mot-clé par page, sort et type de sort, qui suit seul ; un seul type par mot-clé ; le nom vient de l'élément ; Glossaire en lecture seule pour les mots-clés ancrés ; Glossaire et Recherche paginés |
| 2 | Adresse qui suit le titre | Renommer une page change son adresse, l'ancienne redirige |
| 3 | Pages de notion | Une page par notion, avec la liste calculée de ses éléments ; plus aucun mot-clé sans élément, Glossaire entièrement en lecture seule |
| 4 | Retrait des colonnes | `libelle`, `description`, `url`, `couleur`, `icone`, les synonymes et le lien à plusieurs catégories quittent le mot-clé |

## Approches

| Approche | Compromis | Sort |
| --- | --- | --- |
| **Ancrer progressivement** : chaque élément garde son identifiant et reçoit un `mot_cle_id`, comme `magie` | Deux identifiants coexistent ; fiches et journal ne bougent pas | **Retenue par le propriétaire** |
| Remplacer tous les identifiants par le numéro du mot-clé | 447 clés étrangères, fiches, journal et des dizaines de fichiers à réécrire, sans gain de vitesse | Écartée |
| Créer un mot-clé seulement quand on veut citer | Presque aucun travail, mais pas de registre central | Écartée |

## Ce que le propriétaire a décidé (2026-11-21 et 22)

1. **Ancrer progressivement**, en commençant par les pages, les sorts et les types de sort.
2. **Toutes les pages**, y compris les 690 pages de capacités de classe. Le guide reste vrai pour les textes : « seule une balise fait un mot-clé », rien ne se balise tout seul.
3. **Les cinq noms déjà pris sont la même chose** et reprennent le mot-clé existant : Attributs (#31), Initiative (#162), Caractéristiques (#56), Mode Hyper 100 % (#420), type de sort Météo (#239). Attributs, Initiative et Caractéristiques gagnent un lien vers leur page ; Mode Hyper 100 % mène à sa propre page.
4. **Le Glossaire et la Recherche montrent tous les mots-clés**, « mais une pagination devrai être faite pour alléger l'affichage ».
5. **Tout suit seul** : créer un élément crée son mot-clé, le renommer renomme le mot-clé, le supprimer retire le mot-clé si aucun texte ne le cite, sinon la suppression est refusée (décision 16).
6. **Le champ définition disparaît** : « Idéalement, il faudrai supprimer le champ définition d'un mot clé. Le mot clé refférant forcément à quelquechose ce sera alors récupérer la description de ce quelquechose. » Cette consigne a été rapprochée, comme le demande R283, de « Le mot-clé devra désormais servir un peu comme un glossaire » (2026-10-16) et de la définition affichée au Glossaire (R234 (3)) ; la réponse est la décision 7.
7. **Les notions ont leur page** : « Les notions auront leur propre page, comme pour un wiki. Cette page pourra faire par exemple la liste des éléments lié à cette notion. Exemple un type de sort (fer) listera factuellement tous les sorts considéré comme des sorts de fer. »
8. **Deux éléments peuvent porter le même nom** : « Le mot clé en bas sera rataché au type lié, comme c'est le cas pour les classe raciale et leur race lié. Deux mots clé au même libellé orios, mais une clé orios_race et orios_classe. » C'est ce que fait déjà R232 (`orios-race`, `orios-classe`).
9. **Un mot-clé ne se modifie plus** : « Les mots clés ne sont plus modifiables ». Le Glossaire passe en **lecture seule** : il montre, cherche et filtre. Un mot-clé naît, se renomme et disparaît avec son élément, et créer une notion revient à créer sa page. Les mots-clés sans élément restent modifiables jusqu'à ce qu'ils aient leur page. Rappel fait (R283) et réponse donnée : remplace R195 (1) (« Un mot clé peut toujours être changé sans tous les champs […] ») et R234 (5). C'est aussi la demande qu'attendait R290 (« il faudra supprimer cette possibilité plus tard ») : un mot-clé ancré ne se fond plus dans un autre (§7).
10. **L'adresse suit le titre** : « Si on change le titre d'une page, l'URL change dans le mot clé. Par contre on ne peux pas le changer dans la glossaire. » Renommer une page change son adresse et l'ancienne redirige ; l'identifiant interne ne bouge pas. Les 733 pages dont l'adresse diffère déjà de leur titre ne changent qu'à leur prochain renommage. Rappel fait (R283) : déroge à la règle « Identifiants figés » (`CLAUDE.md`) pour les adresses.
11. **La clé suit le nom** : renommer recalcule la clé et réécrit les balises qui la citent. Rappel fait (R283) : R232 (2) et (3) restent vraies, avec le nom de l'élément à la place du libellé.
12. **Le libellé disparaît** : « Comme pour la description le libellé du mot clé sera aussi supprimé. Seul subsistera sa clé dans table. Le mot-clé récuperera le titre de la page / le nom du sort/ le nom de la race etc affin de tout uniformiser. »
13. **Un seul type par mot-clé** : « Actuellement certains mots clés peuvent avoir plusieurs catégories. C'était une erreur. Un seul type par mot-clé. Les mot clés que j'ai mis dans plusieurs catégories deviendons du type "Notion" ou plus spécifique le cas échéant. » Remplace R232 (5).
14. **Synonymes, couleurs et icônes vont sur l'élément** (54, 179 et 21 aujourd'hui), au dernier chantier. Rappel fait (R283) de R233, R234 et R235 : rien n'est perdu, ils se modifient alors sur la page, la magie ou la race. Les monnaies étant figées (R219 (3)), le sort de leurs trois mots-clés sera tranché au chantier 4.
15. **« Dés » devient « Jet de dés »** : le mot-clé #88 prend le titre de sa page, comme les 17 autres, et sa clé devient `jet-de-des`. Seule la phrase « Le mot-clé s'appelle « Dés » » de R183 (10) est remplacée ; la formule des dés, ses crans et la définition ne changent pas.
16. **Supprimer : « Protéger et refuser »**. R221 reste : les pages désignées par un mot-clé verrouillé (264 des 266) ne se suppriment pas. Une autre page citée par un texte est refusée, avec la liste des textes à retoucher. Le « Plus tard » de R223 (7) est abandonné pour les pages : supprimer un mot-clé ne supprime jamais une page. Les mots-clés sans élément gardent le forçage de R223.
17. **Corriger : « L'équipe, en direct »**. Sur demande du propriétaire, une session corrige le type, la couleur, l'icône, les synonymes ou la définition d'un mot-clé ancré par un lot, avec la clé de dépôt (R306, R276). Le propriétaire voit la ligne sur la page Mise à jour et peut l'annuler. Le nom, l'adresse et la clé ne se corrigent jamais ainsi : ils viennent de l'élément.
18. **Les 13 lieux de culte passent tous en Faction** (option choisie : « Les 13 passent en Faction : on les lit d'abord comme des cultes organisés. »).

**R309 consignera ces décisions.** Elle remplace R183 (10) pour le nom, R195 (1) et R234 (5). Elle amende R219 (5), R221 (seconde phrase), R223 (3) et (7) pour les pages, R232 (5) pour le type unique, (9) par le parent et (11) pour les ancrés. Elle cite la levée de R218 (3) par `4361210a` (PR #329), absente du registre, et son retour pour les ancrés. Elle vaut la demande qu'attendait R290. R233, R234 (6) et (7) et R235 suivent. La règle « Identifiants figés » de `CLAUDE.md` sera amendée au chantier 2.

# Chantier 1 : l'ancrage et le verrou

## Ce qui ne change pas

- Les identifiants existants, les fiches de personnage, le journal. **Les adresses ne bougent pas dans ce chantier** (chantier 2).
- **Aucune définition n'est effacée ni déplacée** (chantier 4). Les synonymes, couleurs et icônes restent où ils sont.
- Un mot-clé verrouillé ne se supprime toujours pas, et la page qu'il désigne non plus (R218 (3) pour sa suppression, R221). L'interdiction de modifier ses champs (R218 (3)) a été levée par `4361210a` (PR #329, `edition.mjs:3444`) sans que le registre le dise ; ce chantier la rétablit pour les mots-clés ancrés, verrouillés ou non.
- Les mots-clés créés ne sont pas verrouillés (R219 (5)), mais un mot-clé ancré ne se modifie plus à la main : « il reste modifiable » ne vaut plus pour lui (§7).
- Une migration ne porte que de la structure ; le contenu entre par des lots de changements.

## 1. Structure (migration 0131)

- `page.mot_cle_id` et `sort.mot_cle_id` : `INTEGER REFERENCES mot_cle(id)`, NULL tant que l'élément n'est pas ancré, sans cascade, avec un index UNIQUE partiel (comme `magie.mot_cle_id`).
- `type_sort` (STRICT) : `id` (les 10 codes du CHECK de `sort_type.type`, insérés par la migration, sans texte de règle) et `mot_cle_id`, même index. `sort_type` ne change pas.
- Un même mot-clé peut désigner une page et un type (Météo).
- `mot_cle_categorie` garde sa forme jusqu'au chantier 4, avec **une seule ligne par mot-clé** une fois les lots appliqués. Le service refuse d'en poser une seconde ; l'index UNIQUE viendra quand la base vivante sera propre.

## 2. Qui reçoit quel mot-clé

| Élément | Nombre | Mot-clé | Adresse | Type |
| --- | --- | --- | --- | --- |
| Page dont un mot-clé a exactement l'adresse | 266 | l'existant, nom aligné sur le titre (§4) | inchangée | le sien, ou celui du §3 |
| Les 4 pages reprises (décision 3) | 4 | l'existant, nom aligné sur le titre | celle de la page | le sien, ou celui du §3 |
| Le type Météo (décision 3) | 1 | #239 | inchangée | inchangé |
| Autre page | 894 | créé, nom = titre | celle de la page | celui de sa rubrique (ci-dessous) |
| Sort | 420 | créé, nom = nom du sort | `<page de la magie>#sort-<slug>` | Sort |
| Autre type de sort | 8 | créé, nom = celui qu'écrivent ses sorts (`sort_type.libelle`) | aucune, jusqu'à sa page (chantier 3) | Type de sort |
| Type Aléatoire | 0 | aucun tant qu'aucun sort ne l'utilise | | |

**1 322 mots-clés créés, 1 764 au total.** Un mot-clé « de section » (les 10 de `/regles/alignement/#…`) ne désigne pas la page. `guide/le-mode-hyper` est désignée par #245 une fois #420 parti vers sa propre page.

**Un type par rubrique** : capacités → Don, classes → Classe, races → Race, métiers → Métier, bestiaire → Bestiaire, guide → **Guide**, ressources → **Ressource**. **Quatre catégories nouvelles** : Notion, Guide, Ressource, Type de sort.

**Deux éléments de même nom** (simulation : aucun refus). Les 13 paires race et classe gardent leur clé (`orios-race`, `orios-classe`). Types différents : le type s'ajoute. Même type : c'est **le parent** qui s'ajoute (la magie d'un sort), seul cas où la règle R232 s'étend, puisqu'un type unique ne peut plus les distinguer.

| Nom | Clés obtenues |
| --- | --- |
| Appel aux golems | `appel-aux-golems-bestiaire`, `appel-aux-golems-sort` |
| Marionnette de l'ombre | `marionnette-de-lombre-bestiaire`, `marionnette-de-lombre-sort` |
| Sapeur | `sapeur-metier`, `sapeur-sort` |
| Contre-sort | `contre-sort-arcane`, `contre-sort-corruption` |
| Vague déferlante | `vague-deferlante-arcane`, `vague-deferlante-corruption` |

## 3. Le type unique des 77 mots-clés concernés

71 mots-clés ont plusieurs catégories et 6 n'en ont aucune. Les 13 lieux de culte sont tranchés (décision 18). Pour les 64 autres, proposition d'après leur définition ou leur page : le type le plus spécifique quand l'un d'eux dit ce qu'est la chose, **Notion** quand elle traverse plusieurs domaines.

| Type proposé | Mots-clés |
| --- | --- |
| **Notion** (8) | Effet secondaire, Faiblesse, Mêlée, Mode Hyper, Mode Hyper 100 %, Mode Super, Portée, Roleplay |
| Alignement (9) | Alignement, Loyal Bon, Loyal Neutre, Loyal Mauvais, Neutre Bon, Neutre, Neutre Mauvais, Chaotique Neutre, Chaotique Mauvais |
| Bestiaire (2) | Boss, Immatériel |
| Classe (3) | Biclassage, Classe raciale, Niveau de classe |
| Dégâts (4) | Résistance magique, Vulnérabilité Magique, Résistance d'Armure, Vulnérabilité d'Armure |
| Équipement (9) | Armure magique, Armure physique, Bâton magique, Carquois, Consommable, Livre/Parchemin, Recharge longue, Recharge très longue, Solidité |
| Événement (1) | Les Impacts mineur et majeur |
| **Faction (13)**, décision 18 | Chapelle des Os, Église du Sel, Temple de la Foudre, Temple de la Glace, Temple de la Lumière, Temple de la Terre, Temple de l'Eau, Temple de l'Espace/Temps, Temple de l'Ombre, Temple de Vent, Temple du Feu, Temple du Savoir, Temple noir |
| Fiche de personnage (16) | Agilité, Ambidextrie, Arme Lourde, Barrière, Maîtrise d'arme, Santé, Score, Vitesse, Étape 1, Étape 2, Étape 3, Étape 5, Armure/Défense/Bouclier, Inventaire/Sac à dos, Maîtrise d'arme et Armes, Tableau Posture |
| Guide (1) | L'univers |
| Magie (8) | Bi-magie, Chakra, Emplacement de sort, Magie innée, Mono-magie, Puissance magique, Super Magie, Tour de charge |
| Métier (3) | Artisanat, Métier, S'entraîner |

## 4. Les 18 mots-clés dont le nom change

Le nom devient le titre de la page, la clé suit (décision 11). **100 balises dans 40 textes sont réécrites vers la nouvelle clé.** Elles gardent le texte qu'elles affichent, sauf **3 balises sans texte écrit** : Mode Hyper devient Le Mode Hyper (2), Rater ses sortilèges devient Rater ses sorts (1). L'ancienne clé reste reconnue (`mot_cle_ancienne_cle`) : une balise écrite avec l'ancien nom mène au bon mot-clé, sauf si un nouveau mot-clé reprend cette clé (R233 (11)) ou si l'écriture devient ambiguë (R232 (4) : `{{Force}}` quand deux mots-clés s'appellent Force, il faut alors écrire la clé).

| # | Nom actuel | Nouveau nom | Nouvelle clé | Balises |
| --- | --- | --- | --- | --- |
| 11 | Altération d'état | Altérations d'états | `alterations-detats` | 5 |
| 26 | Attaque discrète | Les attaques discrètes | `les-attaques-discretes` | 2 |
| 27 | Attaque d'opportunité | Les attaques d'opportunité | `les-attaques-dopportunite` | 7 |
| 44 | Bienvenue dans Maverick | Bienvenue dans Maverick JDR! | `bienvenue-dans-maverick-jdr` | 0 |
| 56 | Caractéristique | Caractéristiques | `caracteristiques` | 21 |
| 87 | Dégâts | Les dégâts | `les-degats` | 5 |
| 88 | Dés | Jet de dés | `jet-de-des` | 11 |
| 112 | Embuscade | L'embuscade | `lembuscade` | 3 |
| 137 | Fiche de personnage : Armure/Défense/Bouclier | Défense, Armure et Bouclier | `defense-armure-et-bouclier` | 1 |
| 138 | Fiche de personnage : Expérience/Niveau global | Expérience et Niveau global | `experience-et-niveau-global` | 6 |
| 139 | Fiche de personnage : Inventaire/Sac à dos | Inventaire, Accessoires et Ceinture | `inventaire-accessoires-et-ceinture` | 2 |
| 140 | Fiche de personnage : Maîtrise d'arme et Armes | Armes et Maîtrise d'Arme | `armes-et-maitrise-darme` | 1 |
| 141 | Fiche de personnage : Tableau Posture | Tableau Posture | `tableau-posture` | 1 |
| 245 | Mode Hyper | Le Mode Hyper | `le-mode-hyper` | 10 |
| 284 | Pièce élémentaire | Pièces élémentaires | `pieces-elementaires` | 2 |
| 290 | Posture | Les postures | `les-postures` | 18 |
| 300 | Rater ses sortilèges | Rater ses sorts | `rater-ses-sorts` | 1 |
| 350 | Tenaille | La prise en tenaille et zone d'influence | `la-prise-en-tenaille-et-zone-dinfluence` | 4 |

**Effet visible** : sept noms commencent désormais par un article (Les attaques discrètes, Les attaques d'opportunité, Les dégâts, L'embuscade, Le Mode Hyper, Les postures, La prise en tenaille…). Le tri du Glossaire ignore l'article de tête pour qu'ils restent à leur place alphabétique. Pour un autre nom, il suffit de renommer la page : le mot-clé suit.

## 5. La mise en place, sur la base du site de dev

Une action « Préparer l'ancrage » sur la page Mise à jour, à côté de « Tout recalculer » et sur son modèle (`POST /api/edition/lots/ancrage/`) :

- Elle lit la **base vivante**, calcule ce qui manque et dépose des lots de nature `decision` (R309). **Elle suit R291 et R306 (« Direct ») :** avec la clé de dépôt, ou le mot de passe une fois cette clé posée, chaque lot s'applique aussitôt, après le même essai à blanc et les mêmes contrôles que tout lot, puis s'annule ligne par ligne. Sans clé de dépôt posée, il reste une proposition à appliquer. Rien ne part en production sans « Effectuer la mise à jour ».
- Une création d'élément est **une** opération de lot. Les quatre lots restent loin du plafond de 2 000 opérations et ne sont plus imposés par lui : ils groupent par famille, pour la relecture, l'annulation et l'arrêt au premier refus. **Quatre lots, enchaînés par un seul clic.** Un lot refusé n'écrit rien et arrête la suite, avec son motif :
  1. les catégories, le type unique, les noms, les pages déjà désignées, les cinq reprises (environ 400 opérations) ;
  2. les sorts et les types (428) ;
  3. les pages hors capacités (204) ;
  4. les capacités (690).
- L'action est **rejouable** : elle ne prend que ce qui manque encore.
- **Une ligne annulée reste écartée.** Annuler est une décision du propriétaire (R291) : l'action ne la refait pas. Elle lit les lignes annulées de ses propres lots, les liste dans son résultat, et seul un geste explicite, « Reprendre les lignes annulées », les redépose. Si un renommage du §4 est annulé, le mot-clé garde son ancien nom jusqu'au prochain renommage de sa page, et l'action signale l'écart.
- **Elle ne devine rien.** Une page que plusieurs mots-clés désignent, un mot-clé repris qui a disparu, un nom que R232 ou R233 refuse, un mot-clé à plusieurs catégories absent de la liste du §3 : l'élément est laissé de côté et listé « à trancher » dans le résultat.
- **Qui la lance** : une session de l'équipe, avec la clé de dépôt si elle l'a, car la route est de classe `proposition`, comme « Tout recalculer » (`acces-routes.mjs:61`). Sinon, le propriétaire clique une fois. Le bouton sert ensuite à rejouer ce qui manque.
- **Défaire l'ancrage** : environ 4 400 lignes (3 par élément créé, plus environ 400), à annuler chacune avec sa confirmation, dans un ordre imposé, car une ligne citée s'annule après celle qui la cite (`edition-lots.mjs:729`, `lots-rendu.mjs:277`). Pour tout défaire : `POST /api/edition/lots/<id>/annuler/`, au mot de passe, du lot 4 au lot 1 (`acces-routes.mjs:62`, `api.mjs:67`), ou une restauration. Il n'y a pas de bouton « Annuler tout » (R297 (1)).
- Le format `maverick-lot/1` doit apprendre à créer un mot-clé **avec son type**, à créer une catégorie et à retirer une catégorie d'un mot-clé.

## 6. Tout suit seul

Une règle, un module (`serveur/edition-ancrage.mjs`), utilisée par la mise en place et par le service :

- **Créer** : `creerPage` crée le mot-clé, avec le type de sa rubrique, et l'ancre dans le même lot.
- **Un nom déjà pris** (décision 8) : les deux mots-clés cohabitent, R232 les distingue par leur type. Créer un métier « Force » donne `force-metier`, la caractéristique passe de `force` à `force-fiche-de-personnage` et ses balises sont réécrites. L'ancienne clé reste reconnue dans les limites du §4 : `{{Force}}`, désormais ambigu, est refusé à la saisie et il faut écrire la clé (R232 (4)).
- **Quand la règle ne peut pas suivre** (même nom, même type, pas de parent ; clé déjà prise ; titre qui s'écrit comme le synonyme d'un autre mot-clé, R233 (4), `edition.mjs:260`, `edition-chronologie.mjs:545`) : la création ou le renommage de l'élément passe quand même, sans toucher au mot-clé, et le cas est listé « à trancher » par « Préparer l'ancrage ». Il se règle en changeant le nom de l'élément, ou par un lot sur le type ou les synonymes.
- **Renommer** (`page.titre`, `sort.nom`) : le nom du mot-clé suit, sauf dans ces cas à trancher ; sa clé est recalculée et les balises réécrites (R232).
- **Supprimer** (décision 16) : une page désignée par un mot-clé verrouillé ne se supprime pas (R221, 264 pages). Pour les autres, le mot-clé propre de l'élément ne bloque plus la suppression (`refuserSiUnMotCleYMene`, `refuserSiLesFichesSontCitees`, plan des Règles). S'il est cité par une balise ou une étiquette, la suppression est refusée (409, comme R196), avec **un seul message qui liste les textes à retoucher**. Sinon il part dans le même lot, s'il n'est tenu par aucun autre élément (R289 : une magie, un type de dégâts ; Météo #239, aussi type de sort). Le forçage de R223 ne supprime jamais une page et ne reste offert qu'aux mots-clés sans élément.
- **Un sort** ne se crée ni ne se supprime depuis le site. Un lot qui en supprime un suit la même règle ; un sort créé par un lot est ancré par la prochaine « Préparer l'ancrage ».
- **Le mot-clé lui-même** : `page`, `sort` et `type_sort` entrent dans `REFERENCES_AUX_MOTS_CLES`. Il ne se supprime pas seul (R289).
- **Copies provisoires** : jusqu'au chantier 4, `mot_cle.libelle` et `mot_cle.url` d'un mot-clé ancré restent en base comme des **copies du nom et de l'adresse de l'élément, écrites seulement par ce module**. Les lecteurs actuels (18 fichiers) continuent ainsi de marcher sans changement.

## 7. Le verrou au Glossaire

- **Un mot-clé ancré** (relié à une page, un sort, un type de sort, une magie, une monnaie ou un type de dégâts) **ne se modifie plus à la main** : ni nom, ni adresse, ni type, ni définition, ni couleur, ni icône, ni synonymes ; ni fusion, ni suppression depuis le Glossaire. L'interface n'offre plus ces gestes et le service les refuse (409).
- **Son nom, son adresse et sa clé** ne sont écrits que par le module d'ancrage, quand l'élément change. Aucun lot n'y touche, même au mot de passe : le refus ne cite aucun numéro de décision, car un refus qui en cite un devient un verrou que le mot de passe ouvre (`edition-lots.mjs:241`). Annuler une ligne d'un lot d'ancrage reste permis (R291), et « Reprendre » un renommage annulé passe par une écriture réservée au module.
- **Son type, sa couleur, son icône, ses synonymes et sa définition** se corrigent par un lot de l'équipe (décision 17) : clé de dépôt, application directe (R306), ligne visible et annulable sur la page Mise à jour. Pour le type, c'est ce qui reste de R232 (11).
- **Au rejeu du journal, ces refus ne jouent pas** (R219 (6)) : un ancien lot qui a modifié un mot-clé, avant qu'il soit ancré, repasse tel quel.
- **Fusion** : un mot-clé ancré ne se fond plus dans un autre (décision 9, R290). Un mot-clé sans élément peut encore se fondre dans un ancré, qui reçoit seulement sa clé, comme une cible verrouillée ; si l'absorbé a des synonymes, la fusion est refusée (R219 (4), R233 (11)).
- **Un mot-clé sans élément** (164) garde ses gestes actuels jusqu'à ce qu'il ait sa page (chantier 3). Le Glossaire ne crée plus que ceux-là, avec un type unique, « Notion » par défaut.
- **Les catégories** se gèrent comme aujourd'hui : on en ajoute, on en renomme, on en supprime une vide (`edition-modele.mjs:659`). Renommer une catégorie recalcule la clé des homonymes qui la portent, ancrés compris (R232 (5), (11)).
- Le type n'est plus une liste : le filtre et la colonne du Glossaire montrent un seul type, sous l'en-tête **« Type »** au lieu de « Catégories » (R234 (6)). L'option « Sans catégorie » (R234 (7)) reste, masquée quand aucun mot-clé n'est à classer.

## 8. Ce que montre un mot-clé

- **Partout où une définition s'affiche** (bulle, mode complet, sous-ligne du Glossaire, vue de la Recherche) : **sa définition écrite s'il en a une, sinon le texte de son élément**, `page.resume` ou `sort.effets`, lu à l'affichage, jamais recopié.
- Résultat : **1 726 mots-clés sur 1 764 ont une bulle**, dont 228 mots-clés existants qui n'en avaient pas. 38 n'en ont pas, faute de texte : les 8 types de sort créés, 8 pages de ressources sans résumé, 22 mots-clés existants.
- **Recherche** : la vue d'un mot-clé (`?mot-cle=`) montre **d'abord son élément**, puis les pages qui le portent ou le citent. Sans cela, 1 322 pastilles mèneraient à « Aucune page ne porte ni ne cite ce mot-clé ». Une pastille mène toujours à cette vue, jamais à l'adresse du mot-clé (réponse Q12). La liste ne garde dans son HTML que les définitions écrites ; le texte de l'élément arrive avec la vue.
- **Glossaire** : la sous-ligne (R234 (3)) montre le même texte, signalé comme venant de l'élément, avec un lien vers l'endroit où il se modifie.

## 9. Glossaire et Recherche : tous, paginés

- **50 lignes par page** dans le Glossaire, **100 pastilles** dans la Recherche.
- Au build, seule la première page est visible ; les autres lignes portent `hidden`, ce qui évite de les dessiner. **Sans JavaScript, tout s'affiche** (`<noscript>`).
- Les filtres portent sur **tout** le registre, puis la pagination s'applique ; changer un filtre revient à la page 1. Le compteur reste le total. Le numéro de page est gardé dans l'adresse (`?page=`), pour que le retour arrière retrouve la même page.
- Navigation : précédent, suivant, numéros, au clavier, avec les attributs d'accessibilité.
- Mode modification (mots-clés sans élément) : même pagination ; l'évènement `glossaire:mots-cles` la réapplique.
- Deux scripts de page n'importent jamais le même module : la logique pure est dans `glossaire-filtre.mjs` et `recherche-mots-cles.mjs`, et un test compare les deux, comme pour `normaliser`.

## 10. La note de version et la page Mise à jour

La page Mise à jour sert au patch note et compare la base de dev à la production (R291). Sans précaution, elle afficherait une ligne par mot-clé créé, soit 1 322.

- **Note de version** : une ligne par famille (« 1 322 mots-clés ajoutés : 690 capacités, 204 autres pages, 420 sorts, 8 types de sort »). Les **18 renommages du §4 restent détaillés**, car aucun autre changement ne les dit, ainsi que les quatre catégories nouvelles.
- **Ensuite**, un mot-clé créé ou renommé avec son élément n'a pas de ligne à lui : celle de l'élément suffit. Les colonnes `mot_cle_id` n'entrent pas dans les colonnes listées.
- **« Modifications de l'équipe »** : chaque lot d'ancrage est replié derrière son titre et son nombre de lignes. Ses lignes restent consultables et annulables une à une (R291).

## 11. Effets de bord à traiter

- `ciblesDuVocabulaire` (`autolink`, `db-derive`) retire les termes d'une page visée par plusieurs mots-clés : les mots-clés de sorts ne doivent pas compter comme mots-clés de la page de leur magie.
- Le vocabulaire chargé sur le site de dev (`mots-cles-vivants`) est multiplié par quatre et doit porter le texte des éléments (environ 114 Ko) : à mesurer, et à alléger si la page en souffre.
- La règle de clé a deux jumelles à garder d'accord (`lib/mots-cles-cles.mjs`, `tools/db/maverick.py`), contrôlées par `db:check` : le parent s'ajoute aux deux.
- Compteurs de tables et de colonnes épinglés par les tests, `tables-de-la-base`, registre de l'API, `libelles-de-la-base`, doc `db:doc`.
- **Importeurs** (R183 (11), réponse du propriétaire : « Les exclure de l'import »). Un import ne crée jamais de mot-clé, mais il pose ceux qui existent. Une fois les mots-clés créés, le prochain import poserait six étiquettes qui n'en ont jamais eu, soit 83 poses, mesurées en rejouant les sept importeurs de classeurs et le Codex : « invocation » (66 créatures, vers le type de sort), « chasseur » (7 capacités de l'Olwman, vers le métier), « gladiateur » (7 capacités du Minotaure, vers le métier), « maison » et « construction » (page Maison, vers elle-même et vers le type de sort), « malédiction » (page Accessoires, vers le sort). Elles rejoignent `ETIQUETTES_NON_POSEES` (`tools/db/homonymes.py`), et `importeurs-etiquettes.test.mjs` rejoue aussi les importeurs des classes et des invocations. Le filtre reste dans les importeurs, pas dans `mots_cles_poses` : une étiquette posée à la main sur le site doit survivre à l'aller-retour des pages. L'importeur des magies a été rejoué sur la V8 du classeur, car sa propre garde refuse la V10.

## 12. Contrôles

- `db-0131-…` : structure, index, codes de `type_sort` égaux au CHECK de `sort_type`.
- `serveur-edition-ancrage` : les quatre lots sur une copie, dépôt direct et proposition, arrêt au premier refus, reprises, homonymes, parent, type unique, « à trancher », rejouable, ligne annulée écartée puis reprise ; créer, renommer, supprimer (cité ou non, verrouillé).
- Note de version : une ligne par famille, les 18 renommages détaillés, aucune ligne pour un mot-clé qui suit son élément ; lot d'ancrage replié, lignes annulables.
- Verrou : chaque geste refusé sur un mot-clé ancré, permis sur un mot-clé sans élément, permis au module d'ancrage. Un lot corrige type, couleur, icône, synonymes et définition ; son écriture du nom, de l'adresse ou de la clé est refusée, mot de passe compris ; au rejeu, un ancien lot repasse (R219 (6)). Fusion : source ancrée refusée, cible ancrée qui ne reçoit que la clé.
- Suppression : page protégée (R221), page citée refusée avec la liste des textes, mot-clé tenu par un autre élément qui reste (R289), forçage sans effet sur une page.
- Importeurs : les six étiquettes ne sont plus écrites, les autres sont intactes.
- Ce que montre un mot-clé : définition écrite prioritaire, texte de l'élément, ni l'un ni l'autre ; bulle, Glossaire, vue de la Recherche.
- Pagination : fonctions pures, HTML construit (`hidden`, `<noscript>`), filtres, tri sans l'article.
- Avant la PR : `test:cible`, `db:check`, `db:controler-migrations`, build complet.

## Choix de l'équipe

Validés avec la conception le 2026-11-22.

1. **Le type des 64 autres mots-clés** (§3), les 13 lieux de culte étant tranchés.
2. **Aléatoire reste sans mot-clé** tant qu'aucun sort ne l'utilise : aucun sort ne le porte et aucune donnée n'écrit son libellé.
3. **Guide et Ressource sont des catégories nouvelles.** « Règles » aurait refusé une page de guide au nom d'un mot-clé de règle (« Campagne »), et « Équipement » aurait mal classé des ressources comme « Fièvre des marais ».
4. **Deux sorts de même nom se distinguent par leur magie** (`contre-sort-arcane`), seule extension de R232.
5. **Une définition écrite reste prioritaire** jusqu'au chantier 4. Les 33 mots-clés de pages qui en ont une gardent ainsi leur bulle, souvent meilleure que le résumé (« Alignement » : « Moralité et Éthique du personnage… » contre « Dans Maverick, l'alignement n'est pas fixe. »).
6. **Le tri du Glossaire ignore l'article de tête** (Le, La, Les, L').
7. **Un nom que la règle ne sait pas distinguer ne bloque jamais la création** de l'élément : il attend, listé « à trancher ».
8. **La pagination** : 50 lignes au Glossaire, 100 pastilles à la Recherche.
9. **Un seul lancement enchaîne les quatre lots** (§5, R306), au lieu d'un clic par lot.
10. **Une ligne annulée ne revient pas seule** (§5) : elle attend le geste « Reprendre les lignes annulées ».
11. **La note de version condense l'ancrage** (§10) en une ligne par famille et garde le détail des 18 renommages.
12. **Les six étiquettes d'import sont exclues** (§11) : le prochain import ne pose que ce qu'il posait déjà.

## Laissé au constructeur

Découpage des modules, emplacement exact du bouton, libellés de la navigation, façon d'étendre le format de lot, façon de lire le texte d'un élément pour le site et le service, façon de passer le parent à la règle de clé.

# Les chantiers suivants

Ils auront chacun leur conception. Voici ce qui est déjà décidé et ce qu'il restera à trancher.

## Chantier 2 : l'adresse qui suit le titre

**Décidé** (décision 10) : renommer une page change son adresse, l'ancienne redirige vers la nouvelle, l'identifiant interne ne bouge pas (23 colonnes et 9 629 lignes le citent). Les 733 adresses qui diffèrent déjà du titre (694 capacités, 30 guides, 4 créatures, 4 ressources, 1 métier) ne changent qu'au prochain renommage.

**À concevoir** :

- Où vit l'adresse : aujourd'hui elle se déduit de l'identifiant (`lib/adresses-db.mjs`), avec deux exceptions écrites en dur (`ADRESSES_RENOMMEES_DU_GUIDE`, `lib/livres.mjs:283`) et les anciennes adresses dans une liste figée (`ADRESSES_DU_PLAN_PRECEDENT`, `lib/livres.mjs:337`), lue par la page 404. Il faudra une adresse en base et un registre des anciennes.
- La forme de l'adresse d'une capacité (`<classe>-<nom>`) quand son titre change, et deux pages qui viendraient à la même adresse.
- Les routes du site statique, les `[[liens]]` et la version portable.
- La règle « Identifiants figés » de `CLAUDE.md`, à amender.

## Chantier 3 : les pages de notion

**Décidé** (décision 7) : chaque notion a sa page de wiki, qui liste factuellement ses éléments. Exemple : « Sort fer » (#332, 14 sorts) et « Sort grenade » (#333, 14 sorts), reliés par `sort_mot_cle`.

**À trancher** :

- Le type de page, son adresse, sa place dans le menu, et ce qu'une page liste (sorts, pages qui la portent, textes qui la citent).
- Les **164 mots-clés sans élément** (140 sans adresse, 14 qui mènent à une rubrique, 10 à une section de page). 96 sont de pures notions (Boss, Mêlée, Campagne, Battlemap…), dont 86 ont une définition. Les 68 autres portent le nom d'un élément d'une autre table (30 compétences, 11 affinités, 6 caractéristiques…) : se rattachent-ils à lui, ou ont-ils aussi une page ?
- La page des 9 types de sort, des 3 monnaies et des 5 types de dégâts.
- R268 a clos « Bête, Mécanique et Démon : pas d'infobulle ». Leur page de notion ne doit pas leur en redonner une sans décision du propriétaire.

## Chantier 4 : le retrait des colonnes

Quand chaque mot-clé renvoie à quelque chose, il ne garde que son numéro, sa clé et son type :

- **`libelle` et `url`** disparaissent : le nom et l'adresse se lisent sur l'élément. `type_degats` et `type_sort` n'ont pas de nom aujourd'hui : il leur en faut un.
- Les **192 définitions** doivent avoir trouvé leur place : 151 sur des mots-clés sans élément passent sur leur page de notion ; 33 sur des mots-clés de page, toutes différentes du résumé, sont **à arbitrer une par une** par le propriétaire, aucune n'est abandonnée d'office ; 5 sur des types de dégâts, 3 sur des monnaies.
- **`couleur`** (179) et **`icone`** (21) passent sur l'élément, avec un champ pour les modifier. Les **monnaies sont figées** (R219 (3)) : le sort de leurs trois mots-clés sera tranché ici.
- Les **54 synonymes** passent sur l'élément (`alias` pour une page).
- Le lien `mot_cle_categorie` devient une colonne de type obligatoire.

Il touchera R195 (1), R222, R233, R234, R235, le mode complet des balises, l'API v1 et le Glossaire.

# Hors périmètre

- Les autres familles (capacités de monstre, altérations d'état, équipement…) : étapes suivantes, une par une.
- Tout balisage automatique des textes existants.
- Remplacer un identifiant existant.
- La garde `db:ids`, décrite dans `docs/sql/conception.md` mais absente du dépôt.

# Après la fusion du chantier 1

La mise à jour du site de dev applique la migration. La session lance alors l'ancrage avec la clé de dépôt si elle l'a ; sinon, un clic du propriétaire sur « Préparer l'ancrage » enchaîne les quatre lots. La page Mise à jour les montre, et chaque ligne s'annule. Sans clé de dépôt posée sur le serveur, chaque lot attend « Appliquer », puis un nouveau clic lance le suivant. Rien ne part en production sans « Effectuer la mise à jour ».

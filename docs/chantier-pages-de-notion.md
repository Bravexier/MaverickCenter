# Chantier 3 des mots-clés : les pages de notion

État : conception écrite le 2026-11-27 par la session du chantier, **sans validation du propriétaire** : il a demandé de ne plus être interrogé (« Je te laisse toutes les autorisation. arrête de me demander. », 2026-11-27). Tout ce qui n'est pas cité entre guillemets comme venant de lui est un **choix d'équipe**, listé en fin de document, qu'il peut défaire. Décision suivie : R309 (7). Aucune décision nouvelle n'est consignée en son nom. Branche : `feature/mots-cles-pages-de-notion`.

Suite de `docs/chantier-ancrage-mots-cles.md` (chantier 1, PR 457) et de `docs/chantier-adresses.md` (chantier 2, PR 463). Le chantier 4 (retrait de `mot_cle.libelle` et `mot_cle.url`) n'est pas commencé ici ; « Ce que le chantier 4 trouvera » dit ce qui lui est préparé.

Les chiffres de détail viennent de la copie `data/rows` du dépôt (`c6b059f1`, contenu d'avant l'ancrage), lue le 2026-11-27. Les totaux ont été recomptés le même jour sur la base vivante du site de dev (`GET /api/edition/listes/`, v0.6.21) : 1 764 mots-clés, dont 164 sans élément (24 avec une adresse, 151 avec une définition), 8 de type de sort, 5 de type de dégâts et 3 de monnaie sans page. Comme au chantier 1, le service refait le compte sur la base vivante : c'est lui qui fait foi.

## Pourquoi

Décision 7 de R309 (propriétaire, 2026-11-22) : « Les notions auront leur propre page, comme pour un wiki. Cette page pourra faire par exemple la liste des éléments lié à cette notion. Exemple un type de sort (fer) listera factuellement tous les sorts considéré comme des sorts de fer. »

Après le chantier 1, 164 mots-clés ne renvoient à rien (« Boss », « Mêlée », « Sort fer », « Force »…) : leur balise n'est pas un lien, et ils restent modifiables à la main au Glossaire. Huit types de sort, trois monnaies et cinq types de dégâts ont un mot-clé sans nom ni adresse à eux. Le but : **chaque notion a sa page, ancrée sur son mot-clé comme n'importe quelle page**, pour que le chantier 4 puisse lire le nom et l'adresse de tout mot-clé sur son élément.

## Ce qui est en place

- Un mot-clé est « ancré » s'il est cité par `page.mot_cle_id`, `sort.mot_cle_id`, `type_sort.mot_cle_id`, `magie.mot_cle_id`, `type_degats.mot_cle_id`, ou s'il porte `monnaie_id` (`lib/mots-cles-ancrage.mjs#estAncre`, `lib/mentions-des-mots-cles.mjs:27`). Ancré, il ne se modifie plus au Glossaire (`serveur/edition-ancrage.mjs#refusDuVerrou`).
- « Préparer l'ancrage » (`lib/mots-cles-ancrage.mjs#planDeLAncrage`, `serveur/edition-ancrage-lots.mjs`) lit la base vivante, calcule ce qui manque et dépose des lots R309, rejouable, avec ses listes « à trancher » et « lignes annulées ».
- Une page des Règles (`guide/<slug>`, adresse `/regles/<slug>/`) a un titre et un texte modifiables sur le site, une adresse qui suit son titre (R316), et des **blocs calculés** : une ligne `<!-- guide:<bloc> -->` dans son texte est remplacée au build par un bloc tiré de la base (`lib/guide.mjs#BLOCS`, `components/guide/GuideBloc.astro`).
- Toute page `guide/` doit être rangée (Découvrir, un onglet des Règles, le Guide du MJ), sinon le build s'arrête (`lib/livres.mjs#verifierLePlan`, R185 (7) : « Pas d'onglet « Autre » »). Les onglets des Règles sont fixes (réponse du propriétaire : « Non, fixe », `lib/edition-modele.mjs:704`).
- Un lot de changements ne sait pas créer une page ; le service ne crée une page des Règles que dans un onglet, avec un résumé (`serveur/edition-plan.mjs#page.creer`), et lui crée toujours un mot-clé neuf (`serveur/edition-ancrage.mjs#ancrerLaPage`).
- Ce que montre un mot-clé : sa définition écrite, sinon le résumé de sa page (`lib/mots-cles-balises.mjs#definitionDuMotCle`). R268 : Bête, Mécanique et Démon, « Pas d'infobulle ».

## Les mots-clés concernés

| Famille | Nombre | Ce chantier |
| --- | --- | --- |
| Mots-clés sans élément et sans adresse | 140 | une page de notion chacun |
| Mots-clés sans élément qui mènent déjà quelque part (9 rubriques, 3 pages servies ailleurs, 12 sections) | 24 | **laissés tels quels**, « À arbitrer par le propriétaire » |
| Types de sort ancrés sans page (les 9 ancrés moins Météo, qui a sa page) | 8 | une page de notion chacun |
| Monnaies | 3 | une page de notion chacune |
| Types de dégâts à mot-clé (taille, estoc, frappe, physique, sonore) | 5 | une page de notion chacun |

Soit **156 pages** attendues, moins les noms « à trancher ». Parmi les 140 : 63 portent le nom d'un élément d'une autre table (30 compétences, 11 affinités, 6 caractéristiques, 5 capacités de monstre communes…), 133 ont une définition, 28 des synonymes ; 7 n'ont pas de définition (distance, Faiblesse, magique, spéciale, et Bête, Mécanique, Démon par décision, R268). Deux noms sont déjà ceux d'une autre page (« Localisation des dégâts », alias de `guide/attaquer-et-se-defendre` ; « Maîtrise d'arme », alias de `guide/fiche-maitrise-darme-et-armes`) : ils sont listés « à trancher ». Essai du 2026-11-27 sur une copie du dépôt : les cinq lots s'enchaînent en 230 s, **154 pages de notion** sont créées, 26 mots-clés restent sans élément (les 24 et ces deux-là).

## Buts

1. Chaque mot-clé concerné a une page, à son nom, ancrée sur lui : même numéro, même clé, même type, même définition, mêmes synonymes, même couleur.
2. Sa balise devient un lien vers cette page ; son infobulle ne change pas.
3. La page montre ce que la base sait de la notion, et rien d'autre : sa définition, ses autres noms, son type, les éléments qui lui sont liés.
4. Un mot-clé nouveau naît avec sa page : le Glossaire ne fabrique plus de mot-clé sans élément.
5. La mise en place est un lot annulable ligne par ligne (R291), rejouable, qui ne devine rien.

## Hors périmètre

- Le chantier 4 : `mot_cle.libelle`, `mot_cle.url`, `description`, `couleur`, `icone` et les synonymes restent sur le mot-clé. Aucune définition n'est déplacée.
- Rattacher un mot-clé à l'élément homonyme d'une autre table (compétences, affinités, caractéristiques, capacités de monstre, altérations d'état, équipement…) : ce sont d'autres familles à ancrer, une par une.
- Tout balisage automatique, le remplacement d'un identifiant, la garde `db:ids`.
- Un type de page nouveau, un onglet nouveau, une migration : rien de tout cela n'est nécessaire (voir « Approches »).

## À ne pas faire

- Écrire, compléter ou déduire un texte : une page de notion n'a pas de résumé, et son texte ne porte que le bloc calculé.
- Donner une infobulle à Bête, Mécanique ou Démon (R268).
- Changer la destination d'une balise qui mène déjà quelque part (les 24).
- Toucher au numéro, à la clé ou au type d'un mot-clé existant.

## Approches

| Approche | Compromis | Sort |
| --- | --- | --- |
| **Une page des Règles hors menu** : `guide/<nom>`, adresse `/regles/<nom>/`, sans onglet, dont le texte porte le bloc calculé `notion` | Réutilise tout ce qu'une page des Règles sait faire (texte et titre modifiables, adresse qui suit le titre, blocs calculés, recherche, page 404 du site de dev) ; demande d'admettre qu'une page des Règles vive hors du plan | **Retenue** |
| Un type de page nouveau (`notions/<nom>`, `/notions/<nom>/`) | Le modèle le plus net, mais une ligne de `type_page` porte des libellés (« Notions ») : une migration de structure n'admet que des codes, une migration de données est refusée, et un lot laisserait la CI rouge entre la fusion et la copie du contenu. Il faudrait assouplir deux contrôles requis (R282) | Écartée |
| Un cinquième onglet des Règles, « Notions » | Les onglets sont fixes (« Non, fixe ») ; un menu latéral de 156 entrées, répété sur 156 pages | Écartée |
| Ranger chaque notion dans l'un des quatre onglets | Demande de classer 156 notions à la main (un jugement par notion) et de leur écrire un résumé, obligatoire dans un onglet | Écartée |
| Pas de page : la vue `?mot-cle=` de la Recherche tient lieu de page | Aucun contenu à poser, mais contredit la décision 7 (« leur propre page, comme pour un wiki ») et laisse le chantier 4 sans élément où lire le nom | Écartée |

## 1. Ce qu'est une page de notion

- Une ligne de `page`, de type `guide` : `guide/<slug>`, le slug tiré du nom du mot-clé comme pour toute page des Règles créée sur le site (suffixe `-2`, `-3`… si l'identifiant ou l'adresse est pris ou réservé). Adresse : `/regles/<slug>/`, qui suit ensuite le titre (R316).
- **Titre** : le nom du mot-clé, caractère pour caractère. **Résumé** : `NULL`. **Texte** : la seule ligne `<!-- guide:notion -->`. Statut brouillon et provenance « Site de dev › édition du … », comme toute page créée sur le site.
- **Aucune entrée de menu** : elle n'est dans aucun onglet. C'est ce qui la distingue : *une page des Règles hors du plan est une page de notion*. `verifierLePlan` l'admet et le fil d'Ariane la rattache au Glossaire ; elle n'a pas de menu latéral. R185 (7) est respectée : aucun onglet n'est créé.
- `page.mot_cle_id` désigne le mot-clé. Pour un mot-clé existant, l'ancre est posée sur lui : rien n'est créé au Glossaire. `mot_cle.url` devient l'adresse de la page (copie tenue par le module d'ancrage, comme pour toute page) ; `mot_cle.libelle` est déjà le titre.
- Un type de sort, une monnaie ou un type de dégâts garde son lien d'origine : son mot-clé désigne alors **et** la page **et** le type (comme Météo depuis le chantier 1). Le nom et l'adresse du mot-clé se lisent sur la page.
- Elle se trouve par le Glossaire (« Ouvrir » sur sa ligne), par ses balises dans les textes, par la Recherche et par `/pages/`.

## 2. Ce que montre la page

Le bloc `notion` (`<!-- guide:notion -->`), calculé au build depuis la base, pour le mot-clé de la page qui le porte. Chaque partie n'apparaît que si elle a quelque chose à montrer :

1. **La définition** : `mot_cle.description`, rendue comme au Glossaire (ses balises sont des liens). Sans définition écrite, le bloc montre le résumé de la page s'il en a un (`lib/mots-cles-balises.mjs#definitionDuMotCle`, la même règle que l'infobulle, chantier 1, §8) ; sans l'un ni l'autre, rien, pas même une phrase de remplacement. Les pages créées par ce chantier n'ont pas de résumé : elles ne montrent donc que la définition écrite du mot-clé.
2. **Le type** du mot-clé (sa catégorie) et **ses autres noms** (`mot_cle_synonyme`, dans leur ordre).
3. **Les sorts liés** : ceux qui portent le mot-clé en étiquette (`sort_mot_cle` : « Sort fer », « Sort grenade ») et, pour un type de sort, ceux de ce type (`sort_type`). Chaque sort mène à sa place dans la page de sa magie ; ils sont groupés par magie.
4. **Les pages qui portent ce mot-clé** en étiquette (`page_tag`), groupées par rubrique.
5. **Un lien vers la Recherche** (`/recherche/?mot-cle=<clé>`), qui montre déjà les pages qui citent le mot-clé dans leur texte : la page ne refait pas cette liste.

Le bloc peut se poser sur toute page des Règles (la page Météo pourrait lister ses sorts) : ce chantier ne le pose que sur les pages qu'il crée. Le propriétaire peut renommer la page et lui écrire un résumé (facultatif), comme sur toute page des Règles. Sa page prend la couleur de son mot-clé, comme toute page à laquelle mène un mot-clé coloré ; les autres noms d'une monnaie s'affichent par son icône, jamais par son abréviation (R61).

R268 : la page de Bête, de Mécanique et de Démon existe, sans définition ; leur mot-clé n'a toujours pas d'infobulle, puisque ni lui ni sa page ne portent de texte. Un test l'épingle.

## 3. La mise en place, sur la base du site de dev

« Préparer l'ancrage » apprend une cinquième famille : **les pages de notion**. Aucun bouton nouveau.

- Le plan (`planDeLAncrage`) ajoute un lot « pages de notion », après les quatre autres, de nature `decision` (R309) : une opération par page à créer. Il suit R291 et R306 comme les autres lots : appliqué aussitôt avec la clé de dépôt, proposition sinon, chaque ligne annulable.
- Il prend : tout mot-clé sans élément et sans adresse ; tout mot-clé d'un type de sort, d'une monnaie ou d'un type de dégâts qui ne désigne aucune page.
- **Il ne devine rien.** Sont laissés de côté et listés « à trancher » : un mot-clé sans élément qui a une adresse (les 24) ; un nom qui est déjà le titre, l'adresse ou l'alias d'une autre page ; un nom sans lettre ni chiffre.
- Rejouable : il ne prend que ce qui manque. Une ligne annulée reste écartée jusqu'à « Reprendre les lignes annulées », comme aujourd'hui.
- Le format `maverick-lot/1` apprend à **créer une page de notion pour un mot-clé existant**. Annuler cette ligne retire la page, son ancre et l'adresse du mot-clé ensemble : le mot-clé redevient sans élément, tel qu'il était.
- Taille : 156 opérations, environ 800 lignes de journal, loin du plafond de 2 000 opérations et sans effet mesurable sur la simulation de mise à jour (34 min sur 45 avec les 4 400 lignes de l'ancrage).
- **Note de version** : une seule ligne pour la famille (« 156 pages de notion », `lib/notes-de-version.mjs#comparerLesNotionsAjoutees`). Sur la page Mise à jour, le lot est replié, comme tout lot d'ancrage.

## 4. Ensuite : un mot-clé naît avec sa page

- **Au Glossaire, « Nouveau mot-clé » crée la notion et sa page** d'un même geste : nom, type (« Notion » par défaut), définition facultative. Le service crée le mot-clé, la page de notion et l'ancre dans le même lot. La création d'un mot-clé nu par le site est refusée.
- Une fois sa page créée, un mot-clé est ancré : le verrou du chantier 1 s'applique tel quel (ni nom, ni type, ni définition, ni fusion, ni suppression au Glossaire). **Renommer** : on renomme la page, le mot-clé, sa clé et l'adresse suivent. **Corriger** le type, la couleur, l'icône, les synonymes ou la définition : par un lot de l'équipe (décision 17 de R309), jusqu'au chantier 4.
- **Supprimer** une page de notion suit la décision 16 : refusée si un texte cite son mot-clé ou si le mot-clé est verrouillé ; sinon le mot-clé part avec elle, sauf s'il désigne aussi un type de sort, une monnaie ou un type de dégâts (R289), qui le garde.
- Les 24 mots-clés laissés de côté gardent leurs gestes d'aujourd'hui au Glossaire, jusqu'à l'arbitrage.
- **Limites connues.** Une notion ne peut pas porter le nom d'une page existante : le titre d'une page des Règles est unique (ses `[[liens]]` deviendraient ambigus), la création est refusée et nomme la page. Deux éléments de même nom restent possibles entre familles différentes (race et classe, sort et métier), pas entre deux pages des Règles. Deux voies créent encore un mot-clé sans page, qu'un prochain « Préparer l'ancrage » dotera de la sienne : l'étiquette que pose la première race hybride créée (`serveur/edition.mjs#motCleDe`), et l'outil de l'équipe `scripts/baliser-mot-cle.mjs`, dont le lot insère un mot-clé nu (un lot de l'équipe garde cette opération). Sur une base qui n'a pas encore la catégorie « Notion » (avant l'ancrage), une notion créée sans type naît sans type, « à trancher ».
- **Pas de texte libre pour l'instant.** Le mode modification découpe le texte d'une page en morceaux autour de ses blocs : une page réduite à son bloc n'offre aucun morceau à modifier. Le titre et le résumé se modifient ; écrire un paragraphe sur une page de notion demandera un geste « ajouter un texte », hors de ce chantier.
- **Le contrôle de `page_fts`.** Un lot qui crée ou retire une page de notion n'est pas refusé pour le seul écart de l'index de recherche (`page_fts : une ligne par page attendue`), que la fabrication du site refait : une création de page par une route du site ne passe déjà par aucun de ces contrôles. Tout autre problème né du lot reste un refus.
- **Un lot refusé arrête l'enchaînement** de « Préparer l'ancrage », avec son motif (`suite: false`), pour les cinq lots : avant ce chantier, un appelant qui relançait redéposait le lot refusé à chaque appel.

## 5. Effets de bord à traiter

- `lib/livres.mjs` : `verifierLePlan` (une page hors plan est une page de notion), `filDAriane` et `placeDansLeGuide` (rubrique « Glossaire »), routes `/regles/…` (elles servent aussi les pages hors plan), `PageDuGuide` sans menu latéral.
- La page 404 du site de dev, qui dessine une page créée avant la refabrication (`scripts/edition/nouvelles.mjs`).
- Le mode modification d'une page des Règles : le résumé, obligatoire dans un onglet, reste facultatif pour une page de notion.
- Les contrôles du contenu (`serveur/controles-du-contenu.mjs`, `db:check`) et les tests qui épinglent « toute page du guide est rangée ».
- Le sommaire des Règles, la ceinture et les notes de version, qui nomment une page par sa place dans le guide.
- `docs/serveur.md`, `docs/content-guide.md`, `docs/chantier-ancrage-mots-cles.md` (section du chantier 3).

## 6. Contrôles

- Plan : chaque famille prise ; les 24 et les noms déjà pris « à trancher » ; rejouable ; ligne annulée écartée puis reprise ; rien pour un mot-clé qui désigne déjà une page.
- Lot : la page créée a le nom du mot-clé, pas de résumé, le bloc pour texte, aucune entrée de menu ; le mot-clé garde numéro, clé, type, définition, synonymes ; son adresse est celle de la page ; annulation de la ligne ; rejeu du journal ; `db:check` vert.
- R268 : après la mise en place, Bête, Mécanique et Démon n'ont pas d'infobulle.
- Bloc : définition, type, autres noms, sorts par étiquette et par type, pages par étiquette, lien de Recherche ; chaque partie absente quand elle est vide.
- Plan des Règles : une page hors plan est admise, sans menu latéral, fil d'Ariane vers le Glossaire ; une page d'onglet ne change pas.
- Glossaire : « Nouveau mot-clé » crée mot-clé, page et ancre ; un mot-clé nu est refusé ; un mot-clé à page est verrouillé.
- Avant la PR : `test:cible`, `db:check`, `db:controler-migrations`, build complet, sur la copie du dépôt et sur une copie où l'ancrage et les pages de notion sont posés.

## À arbitrer par le propriétaire

Rien de ceci ne bloque : chaque élément reste tel qu'il est.

1. **Les 24 mots-clés qui mènent déjà quelque part.** Leur donner une page de notion changerait la destination de leurs balises (« Classe » mènerait à `/regles/classe/` au lieu de `/classes/`, « Loyal Bon » quitterait sa section d'Alignement). Les rattacher à leur rubrique ou à leur section demande un genre d'élément nouveau. À choisir, pour chacun ou pour tous : une page de notion, ou le rattachement. Ce sont : Artisanat, Bestiaire, Ceinture, Chronologie, Classe, Composants, Fiche de personnage, Magie acquise, Magie innée, Magies, Métier, Race, Les neuf alignements, les neuf alignements (Loyal Bon… Chaotique Mauvais), Consommable, Carquois. Le chantier 4 en a besoin avant de retirer `mot_cle.url`.
2. **Les 63 homonymes** ont une page de notion comme les autres (choix d'équipe n° 4). Si le propriétaire veut que « Force » soit la caractéristique elle-même, ce sera l'ancrage de cette famille, à part.
3. **La page Météo** (type de sort qui avait déjà sa page) ne liste pas ses sorts : il suffit d'ajouter la ligne `<!-- guide:notion -->` à son texte.
4. **Les noms déjà pris par une autre page**, listés « à trancher » par la mise en place : « Localisation des dégâts » (alias de la page « Attaquer et se défendre ») et « Maîtrise d'arme » (alias de la page de la fiche « Armes et Maîtrise d'Arme »). Sont-ils la même chose que cette page (le mot-clé s'y rattache, comme les cinq reprises du chantier 1), ou une notion à part, à nommer autrement ?
5. **Une notion du même nom qu'une page.** Aujourd'hui refusée (titre de page unique). Si le propriétaire veut un mot-clé « Force » d'un autre type alors qu'une page « Force » existe, il faudra dire comment nommer sa page.

## Choix de l'équipe

Pris par la session, non validés ; chacun se défait sans perte.

1. **Une page de notion est une page des Règles hors menu** (« Approches »), à `/regles/<nom>/`.
2. **Pas de place dans les menus** : le Glossaire est sa porte d'entrée, avec la Recherche et les balises.
3. **Le texte de la page est le seul bloc calculé** ; le résumé reste vide. La définition n'est pas recopiée : elle se lit sur le mot-clé jusqu'au chantier 4.
4. **Les 63 homonymes d'un élément d'une autre table reçoivent une page comme les autres** : aucun n'est rattaché par ressemblance de nom.
5. **Les 24 mots-clés qui ont déjà une adresse ne bougent pas** (« À arbitrer », n° 1).
6. **Types de sort, monnaies et types de dégâts reçoivent une page de notion**, leur mot-clé désignant à la fois la page et le type.
7. **La page ne liste que les liens posés en base** (étiquettes de sort, type de sort, étiquettes de page) ; les citations dans les textes restent à la Recherche.
8. **La mise en place est une cinquième famille de « Préparer l'ancrage »**, sous R309 (7), sans décision ni bouton nouveaux.
9. **« Nouveau mot-clé » du Glossaire crée la notion avec sa page** ; le site ne crée plus de mot-clé nu.
10. **Aucune migration** : rien ne change dans la structure.
11. **Un mot-clé qui a déjà une adresse, ou qui désigne un sort ou une magie, ne reçoit jamais de page de notion**, même par un lot écrit à la main : le service le refuse.
12. **Un mot-clé sans type unique n'a pas de page** tant que son type n'est pas tranché ; les mots-clés repris au chantier 1 (Attributs, Initiative, Caractéristiques, Mode Hyper 100 %, Météo) non plus.
13. **Une page des Règles dont l'entrée de menu disparaîtrait devient une page de notion** : le build ne s'arrête plus pour elle (fil vers le Glossaire, résumé facultatif, supprimable). C'est assumé : une entrée de menu ne naît et ne part qu'avec sa page (`lib/edition-modele.mjs`, commentaire de `regles_onglet_entree`).
14. **Une page de notion prend la couleur de son mot-clé** (les 43 notions colorées : caractéristiques, compétences…), par la règle existante des pages désignées par un mot-clé coloré.

## Ce que le chantier 4 trouvera

- Tout mot-clé a un élément, sauf les 24 à arbitrer et ceux listés « à trancher ».
- Le **nom** et l'**adresse** de chaque notion se lisent sur sa page (`page.titre`, adresse de la page).
- Les **133 définitions** des notions (et celles des types de dégâts et des monnaies) ont leur place prête : `page.resume` de la page de notion, aujourd'hui vide. Le bloc `notion` lit la définition à un seul endroit (`definitionDuMotCle`), à faire pointer sur le résumé.
- **Couleur, icône et synonymes** n'ont pas encore de champ sur la page : à créer au chantier 4, la page de notion étant l'élément qui les recevra.
- `type_degats` et `type_sort` ont désormais un nom : celui de leur page.

## Laissé au constructeur

Nom des fonctions et découpage des modules ; forme de l'opération de lot ; façon dont les routes `/regles/…`, le service et le navigateur reconnaissent une page hors plan ; présentation du bloc (titres, repli des longues listes) ; libellés de l'interface.

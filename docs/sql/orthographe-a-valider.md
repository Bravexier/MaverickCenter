# Orthographe de la base : ce qui reste à valider

Trois migrations de données ont corrigé l'orthographe de la base (décision R10 : « à corriger, jamais un chiffre ni le sens d'une règle ») :

- `0003-orthographe-magies` : les sorts, les 15 magies et leurs tables dérivées (500 corrections) ;
- `0005-orthographe-base` : la passe complète sur **toute** la base : pages du wiki, classes et capacités, races, bestiaire, équipement et artisanat, métiers, guides et lore,
  et toutes les tables typées qui reprennent ces textes. 2 247 corrections, chacune relue deux fois (relecture puis contre-vérification indépendante), et 56 noms
  corrigés sans changer de clé (accents, traits d'union, majuscules) ; une correction faite dans une phrase l'est partout où la même phrase est écrite.
  Registre : `data/migrations/0005-orthographe-base.json` (4 184 entrées, 2 111 cellules). Les citations « telles quelles » de la fiche V15.2.2
  (tableaux des écarts des races), les sources, les alias, les étiquettes, les adresses et les liens ne sont pas touchés.
  Cette passe a aussi relu les 500 corrections de 0003 : aucune n'a rendu un texte fautif ; 44 relèvent du style (espaces doubles, casse de termes du jeu comme « Fermeté »,
  circonflexes rétablis sur « coût » ou « brûlure » alors que l'orthographe de 1990 les admet, ligature « œil ») et sont laissées telles quelles.
- `0006-orthographe-noms` : les **noms** laissés en attente par 0003 et 0005, tranchés selon ta consigne : corriger en gardant le sens le plus probable
  (un jeu de mots ou une référence perdus, tant pis : on y reviendra) ; pour un nom propre écrit de plusieurs façons, la graphie majoritaire l'emporte.
  Chaque nom est corrigé partout où il est écrit (741 occurrences, 423 cellules) et sa clé recalculée (147) ; les **identifiants ne changent pas** : une page
  renommée garde son adresse (`/bestiaire/sihouetteur-obscur/` affiche « Silhouetteur obscur »). Registre : `data/migrations/0006-orthographe-noms.json`.

Les **phrases** qui suivent n'ont **pas** été touchées, parce que les corriger demanderait d'ajouter, de retirer ou de remplacer un mot, de choisir entre deux lectures,
ou parce que la graphie est peut-être un terme du jeu. Elles attendent ta décision (la règle d'or : on ne devine pas). Les noms sont tranchés (0006, ci-dessous).

## Passe complète de la base (migration 0005)

**390 phrases** attendent ta décision (les 178 noms sont tranchés par 0006, ci-dessous). Même convention : « oui » (la suggestion), « non » (on garde) ou la graphie voulue ; la correction se fait alors par une nouvelle migration de données.

### Noms : tranchés par la migration 0006

Ta consigne : « corrige de façon à garder le sens le plus probable ; pour les noms propres, la majorité des occurrences l'emporte ». Les 178 noms de cette liste
et les noms de sorts de 0003 sont corrigés comme proposé, partout où ils sont écrits (titres, noms typés, textes, notes de cellule, cibles des liens), sauf ce qui suit.

Formes retenues autres que la suggestion :

- « 1kg de oeuf, 20 oeuf » → « 1kg d'oeufs, 20 oeufs » (la ligature n'est pas imposée, comme ailleurs) ; « A deux Main » → « À deux Mains » (casse d'origine) ; « ParceQUE » → « Parce QUE » (le cri est gardé).
- « Croc Obsidien » → « Croc d'Obsidienne » ; « Entrave frigorifière » → « Entrave frigorifique » ; « LivreParchemin » → « Livre/Parchemin » (comme « Machine de Guerre/Siège »).
- « Fiole verte foncé » → « Fiole verte foncée » (comme les objets de sa page) ; « Gelée verte foncé », « Herbe verte foncé » → « … vert foncé » (comme « Champignon vert foncé »).
- « Coeur abyssale », « Coeur spatio-temporelle » : accord corrigé (« Coeur abyssal », « Coeur spatio-temporel »), ligature non imposée.
- « Folle de Guerre » / « Folle de guerre » → « Folie de Guerre » / « Folie de guerre » (nom de l'état et partout où il est cité) ; « Touché du Vide » → « Toucher du Vide » ;
  « Onde Confusion » → « Onde de Confusion » ; « Répar Os » → « Répar'Os » (comme « Destruc'Os », « Fractur'Os ») ; « Colonne tesla » → « Colonne Tesla ».
- « Marionette de lombre » → « Marionnette de l'ombre » (nom du sort qui l'invoque) ; les sources citent toujours l'onglet du classeur sous son nom (« Marionette de lombre »).
- Toutes les « Armure … complet » de l'équipement (22 noms) → « … complète », comme « Armure Complète » dans la même page.

Graphie majoritaire d'un nom propre : « Ocultomancien » **gardé** (48 contre 3 : les 3 « Occultomancien » de la description de la classe sont alignés dessus) ;
« Drassah'Thac » → « Drassah'thac » (402 contre 6) ; « owlmans » → « olwmans » ; « kistunes » → « kitsunes » ; « Rock(s) » → « Rokh(s) » (« culture rock » → « culture rokh ») ;
« Mithril » → « Mythril » ; « Jacklope » → « Jackalope » ; « Climatospetique » → « Climatosceptique » (nom du don) ; « Sihouetteur » → « Silhouetteur » (égalité : le sens l'emporte).

Gardés tels quels :

- « Renfermement » (sort du Sang, don majin, capacités du bestiaire) : le mot existe et c'est le nom constant du jeu ; « Explosion glorifique » : « glorifique » existe (vieilli : « qui glorifie »).
- « Sci du CAC » (Pugiliste) et « Tempus Figus » (Archimage) : aucun sens plus probable ne se dégage du texte de la capacité.
- « Martiale » : c'est le nom de la classe ; l'article de « chez le Martiale » est une phrase, pas un nom.
- « Eoline » : même clé que le dieu « Éoline » (seul l'accent de la majuscule diffère) ; « Séraphe » : un dieu distinct de « Séraphin » (deux entrées de la liste des dieux).
- Écriture de la source gardée comme trace : « Felfle » (colonne « Race » de l'onglet « Bonus Race » de la fiche, `ethnie.race_brut`, et la phrase qui la cite),
  les gemmes « Diament rose », « Emmeraude », « Gyspe », « Onix » telles que l'onglet Accessoires les écrit (`gemmes_brut`, `nom_source`, rapprochées dans `ecart_source`),
  « Veilliessement » tel qu'écrit dans la liste de la momie (`sort_nom_brut`, non rapproché d'un sort) ; partout ailleurs ces noms sont corrigés.
- « Peau Verglacé » : seulement dans un commentaire orphelin du classeur, identifié par l'empreinte de son texte (jamais réécrit).
- « Enhor » / « Enohr » (la même région ?) : une occurrence chacun, pas de majorité : à trancher.

### Phrases à trancher, par page

#### bestiaire/animation-des-morts

- **L5** — « ils sont créés magiquement » — Le sujet semble être « les invocations » (féminin) : il faudrait changer le pronom, sauf si « ils » désigne les créatures invoquées. → elles sont créées magiquement
- **L17** — « mais il a la possibilité » — Reprend « Une créature non-mort » (féminin) : il faudrait changer le pronom. → mais elle a la possibilité

#### bestiaire/appel-aux-golems

- **L5** — « ils sont créés magiquement » — Le sujet semble être « les invocations » (féminin) : il faudrait changer le pronom, sauf si « ils » désigne les créatures invoquées. → elles sont créées magiquement
- **L13** — « un allié peut très bien influer sa propre magie » — « influer » semble mis pour « infuser » (cf. « infuser sa magie » L23) : remplacement d'un mot. → un allié peut très bien infuser sa propre magie

#### bestiaire/carcalanche

- **L30** — « l'altération d'état lié à l'élément » — « lié » peut s'accorder avec « altération » (liée) ou avec « état » : deux lectures possibles. → l'altération d'état liée à l'élément

#### bestiaire/charcabe

- **L9** — « la haine ardente qui voue à la vie » — Homophone qui / qu'il : le verbe « voue » n'a pas de sujet ; corriger ajoute « il ». → la haine ardente qu'il voue à la vie

#### bestiaire/executeur-lunaire

- **L7** — « de l'ombre du lanceur À l’instant de son invocation » — Point final manquant entre deux phrases (« À » en majuscule). → de l'ombre du lanceur. À l’instant de son invocation

#### bestiaire/fulgurame

- **L9** — « Amalgâme entre os et métal » — « amalgame » ne prend pas d'accent, mais « Amalgâme » peut être un jeu de mots voulu avec « âme » (comme « Fulgurâme »). → Amalgame entre os et métal
- **L10** — « la puissance qu'il a tué » — Le sens attendu est sans doute « la puissance qui l'a tué » ; sinon l'accord serait « qu'il a tuée ». Deux lectures. → la puissance qui l'a tué
- **L32** — « lui oblige de faire un de vigueur » — Mot « jet » oublié et construction « obliger quelqu'un à » : corriger demande d'ajouter et de remplacer des mots. → l'oblige à faire un jet de vigueur

#### bestiaire/golem-de-chair

- **L33** — « Peut utilisé utiliser les sorts » — Verbe en double : corriger demande de retirer un mot. → Peut utiliser les sorts

#### bestiaire/golem-de-foudre

- **L9** — « Leur corps complètement fait de métal de différent type rendent son corps dur » — Accords incohérents (« Leur corps … rendent son corps ») et « de différent type » (différents types ou type différent ?) : plusieurs lectures possibles. → Leur corps complètement fait de métaux de différents types rend leur corps dur

#### bestiaire/golem-de-glace

- **L29** — « et fait perdurer tant que personne ne la change » — Complément « la » manquant : corriger demande d'ajouter un mot. → et la fait perdurer tant que personne ne la change

#### bestiaire/golem-de-sable

- **L11** — « vu qu’elle y tire sa puissance » — « tirer sa puissance de » se reprend par « en », pas « y » : corriger demande de remplacer un mot. → vu qu’elle en tire sa puissance

#### bestiaire/golem-dos

- **L31** — « autour de lanceur » — Article manquant (comparer L29 « autour du lanceur ») : corriger demande de remplacer « de » par « du ». → autour du lanceur

#### bestiaire/goule

- **L29** — « autour la créature » — Préposition « de » manquante : corriger demande d'ajouter un mot. → autour de la créature
- **L29** — « à chaque créature qui commence leur tour » — « chaque créature » est singulier, « leur » ne s'accorde pas : corriger demande de remplacer « leur » par « son ». → à chaque créature qui commence son tour

#### bestiaire/marionette-de-lombre

- **L11** — « même si le lanceur en possède que 1 » — Négation restrictive sans « ne » : corriger demande d'ajouter un mot. → même si le lanceur n'en possède que 1

#### bestiaire/os-froid

- **L9** — « parle d'ancien fidèle de la Déesse de la Glace qui aurait commis une faute très grave envers cette dernière et ont été condamné » — Singulier et pluriel mêlés (« ancien fidèle », « aurait » / « ont ») : il faut choisir entre deux lectures. → parle d'anciens fidèles de la Déesse de la Glace qui auraient commis une faute très grave envers cette dernière et ont été condamnés

#### bestiaire/poupee-sacre

- **L27** — « avec les niveaux de maîtrises maximum » — « Niveau de maîtrise » (NM) s'écrit d'ordinaire au singulier ; phrase type répétée dans les pages de créatures lanceuses de sorts de ce lot (poupee-sacre, poupee-sanglante, poupee-temporelle, poupee-terrestre, poupee-vide, squamique, squelette-venin, zombi-ronce, zombre). → avec les niveaux de maîtrise maximum

#### bestiaire/reanime

- **L9** — « ce sont des créatures sont équipées » — Deux verbes conjugués : corriger demande de retirer ou de remplacer un mot. → ce sont des créatures équipées
- **L9** — « qui leur empêchent de perdre » — « Empêcher quelqu'un de » demande un COD (« les ») : corriger demande de remplacer un mot. → qui les empêchent de perdre
- **L9** — « de se reformer ou d'être réparés » — Accord ambigu : « réparées » si le sujet est « ces créatures », « réparés » si ce sont les membres. → de se reformer ou d'être réparées

#### bestiaire/solecorche

- **L9** — « il reste que peu de temps » — Négation « ne … que » sans « ne » : corriger demande d'ajouter un mot. → il ne reste que peu de temps

#### bestiaire/squelette-de-pierre

- **L28** — « Marche qu’une fois. » — Négation « ne … que » sans « ne » : corriger demande d'ajouter un mot. → Ne marche qu’une fois.

#### bestiaire/temposs

- **L9** — « ayant plus que la peau sur les os » — Sans « ne », le sens s'inverse (« ayant davantage que ») ; corriger demande d'ajouter un mot. → n'ayant plus que la peau sur les os

#### bestiaire/zombi-ronce

- **L9** — « Les zombi ronce » — Nom de créature au pluriel sans marque du pluriel ; la forme plurielle du nom (« zombis ronce » ou « zombis ronces ») est à choisir. → Les zombis ronce
- **L9** — « ils sont symbioses avec » — « Être symbiose avec » n'est pas correct ; corriger demande d'ajouter un mot (« en symbiose »). → ils sont en symbiose avec

#### bestiaire/zombinox

- **L29** — « Tous les 10% de santé perdu » — Accord ambigu : « perdus » (avec « 10% ») ou « perdue » (avec « santé ») ; « perdu » ne s'accorde avec rien. → Tous les 10% de santé perdus

#### capacite.type_brut

- **capacites/marcass-super-hache** — « pAsSiF » — Casse alternée, probablement un clin d'œil volontaire ; à normaliser seulement si ce n'est pas voulu (champ brut de type de capacité). → Passif

#### capacites/anansi-anti-corps

- **L1** — « fioles "offensive" » — Accord attendu « offensives » (fioles), sauf si « offensive » est le nom d'une catégorie de fioles. → fioles "offensives"

#### capacites/arbaletrier-charger

- **L3** — « Ne marche le premier tour de jeu » — Négation incomplète (« pas » manquant) : corriger demande d'ajouter un mot. → Ne marche pas le premier tour de jeu

#### capacites/archimage-creation-vivante

- **L1** — « X = lniveau d'Archimage/5 » — Faute de frappe : « l » parasite ou article « le » mal saisi ; deux lectures possibles. → X = niveau d'Archimage/5

#### capacites/clerc-saint-combattant

- **L1** — « +7% Arme légères OU lourdes » — Nombre incohérent : « Arme » au singulier, adjectifs au pluriel ; corriger demande de choisir entre deux lectures. → +7% Armes légères OU lourdes

#### capacites/cuirasse-nope

- **L1** — « pour empêcher à une cible de lancer un sort alors qu'il est dans la zone » — « empêcher quelqu'un de » se construit sans « à » (retirer un mot) ; « il » ne s'accorde pas avec « une cible » (cible ou lanceur ?). → pour empêcher une cible de lancer un sort alors qu'elle est dans la zone

#### capacites/flagelleur-puni-moi

- **L1** — « la résistance aux altérations d'état lié à la magie innée » — « lié » est fautif mais l'accord dépend de ce qui est lié : « la résistance » (liée) ou « les altérations » (liées). → la résistance aux altérations d'état liées à la magie innée

#### capacites/flagelleur-punition

- **L1** — « la résistance aux altérations d'état lié à la magie innée au cible » — « lié » : accord avec « résistance » (liée) ou « altérations » (liées) ? « au cible » : « à la cible » ou « aux cibles » ? Deux lectures chaque fois. → la résistance aux altérations d'état liées à la magie innée à la cible

#### capacites/flagelleur-sadique

- **L1** — « +7% Arme légères OU lourdes » — Nombre incohérent : « Arme » au singulier, adjectifs au pluriel ; corriger demande de choisir entre deux lectures. → +7% Armes légères OU lourdes

#### capacites/frappeur-anti-am

- **L1** — « AM donné » — Contre-vérification : Le pluriel est certain (« des AM »), mais le genre du sigle est indécis : AM = « armure magique » (féminin → « données ») ou points d'AM (masculin → « donnés ») ; le corpus emploie les deux (« les AP données », « Les AP et AM naturels »). → AM donnés

#### capacites/frappeur-anti-arme

- **L1** — « à l'arme de cible » — Article manquant devant « cible » (ajouter un mot). → à l'arme de la cible

#### capacites/goleois-chant-15

- **L1** — « Permet pendant 2 tours d'être immunisé aux attaques » — Le bénéficiaire est « les alliés et le lanceur » : « immunisés » au pluriel ? L'accord porte sur un sujet sous-entendu. → d'être immunisés

#### capacites/goleois-irreductible

- **L1** — « +5% Arme légères et lourdes » — Nombre incohérent : « Arme » au singulier, adjectifs au pluriel ; corriger demande de choisir entre deux lectures. → +5% Armes légères et lourdes

#### capacites/grenadier-renversant

- **L1** — « de forcer de le jet de stabilité » — « de » en trop devant « le jet » : corriger demande de retirer un mot. → de forcer le jet de stabilité

#### capacites/kitsune-renardo

- **L1** — « Créer un renard fantomatique » — Infinitif en tête alors que les autres capacités sont au présent (« Crée ») ; possible consigne à l'infinitif. → Crée un renard fantomatique

#### capacites/lanceur-fantassin

- **L1** — « +8% Arme Lourdes » — Nombre incohérent : « Arme » au singulier, « Lourdes » au pluriel (« Arme Lourde » ou « Armes Lourdes » ?). → +8% Armes Lourdes

#### capacites/lanceur-passe-bouclier

- **L1** — « AP apporté » — Contre-vérification : Le pluriel est certain (« les AP »), mais le genre du sigle est indécis : AP = « armure physique » (féminin → « apportées ») ou points d'AP (masculin → « apportés ») ; le corpus emploie les deux (« les AP données », « Les AP et AM naturels »). → AP apportés

#### capacites/lancier-chargeur

- **L1** — « en cas d'attaque charger sur monture » — « charger » ne se rattache à rien : « attaque chargée », « attaque en charge » ? Corriger demande de choisir ou de changer un mot. → en cas d'attaque chargée sur monture

#### capacites/lancier-maitre-dhast

- **L1** — « +5% Arme Lourdes » — Nombre incohérent : « Arme » au singulier, « Lourdes » au pluriel (« Arme Lourde » ou « Armes Lourdes » ?). → +5% Armes Lourdes

#### capacites/maclier-boubou-magie

- **L1** — « Permet d'influer un sort offensif » — « influer » (avoir une influence) ne convient pas ; « infuser » semble voulu (remplacer un mot). → Permet d'infuser un sort offensif

#### capacites/maclier-contre-magique

- **L1** — « Permet d'influer un sort offensif de niveau 1 dans le bouclier » — « influer » ne convient pas ; « infuser » semble voulu (remplacer un mot). → Permet d'infuser un sort offensif de niveau 1 dans le bouclier

#### capacites/maclier-le-centuple

- **resume** — « Les sorts influer dans le bouclier » — « influer » (infinitif) ne convient pas ; « infusés » semble voulu (remplacer un mot). → Les sorts infusés dans le bouclier

#### capacites/mage-bleu-mimetisme

- **L3** — « prend en compte la posture le moment où il a été chargé » — Il manque une préposition (« au moment où ») : corriger demande de remplacer « le » par « au ». → prend en compte la posture au moment où il a été chargé

#### capacites/mage-rouge-mage-grenat

- **L1** — « +10% Arme légères OU lourdes » — Nom de compétence mal accordé : deux lectures possibles (« Armes légères OU lourdes » ou « Arme légère OU lourde »). → +10% Armes légères OU lourdes

#### capacites/mage-rouge-mage-rubis

- **L1** — « +5% Arme légères OU lourdes » — Nom de compétence mal accordé : deux lectures possibles (« Armes légères OU lourdes » ou « Arme légère OU lourde »). → +5% Armes légères OU lourdes

#### capacites/mage-rouge-preparation

- **L3** — « prend en compte la posture le moment où il a été chargé » — Il manque une préposition (« au moment où ») : corriger demande de remplacer « le » par « au ». → prend en compte la posture au moment où il a été chargé

#### capacites/marcass-pour-ma-hache

- **L2** — « x = Niveau de Marcass divisé 2 » — Préposition manquante (« divisé par 2 », comme sur les autres pages) : corriger demande d'ajouter un mot. → x = Niveau de Marcass divisé par 2

#### capacites/martiale-mon-arme

- **L1** — « la même catégorie arme » — Préposition manquante : corriger demande d'ajouter « d' ». → la même catégorie d'arme

#### capacites/martiale-rage-incoercible

- **resume** — « dure jusqu'à qu'il tombe au sol » — Locution « jusqu'à ce que » incomplète : corriger demande d'ajouter « ce ». → dure jusqu'à ce qu'il tombe au sol

#### capacites/medusain-hoplite

- **L1** — « +7% Arme légères et lourdes » — Nom de compétence mal accordé : deux lectures possibles (« Armes légères et lourdes » ou « Arme légère et lourde »). → +7% Armes légères et lourdes

#### capacites/medusain-tentattaque

- **L1** — « pour ne prendre l'altération d'état » — Négation incomplète (« pas » manquant) : corriger demande d'ajouter un mot. → pour ne pas prendre l'altération d'état

#### capacites/mercenaire-mimique

- **L1** — « un jet chance est nécessaire » — Préposition probablement manquante (« jet de chance », comme « jet de vigueur ») : corriger demande d'ajouter un mot. → un jet de chance est nécessaire

#### capacites/minotaure-gladiateur

- **L1** — « +7% Arme lourdes » — Nom de compétence mal accordé : deux lectures possibles (« Armes lourdes » ou « Arme lourde »). → +7% Armes lourdes

#### capacites/parleur-negociateur

- **L3** — « Il est pas impossible » — « ne » manquant (tournure orale) : corriger demande d'ajouter un mot. → Il n'est pas impossible

#### capacites/parleur-parle-mal

- **L1** — « si elle rate, elle prend » — Le pronom renvoie à « l'ennemi » (masculin) ; corriger demande de remplacer « elle » par « il ». → s'il rate, il prend

#### capacites/pugiliste-coup-de-paume

- **L1** — « Permet d’assigner un violent coup » — « assigner » est sans doute mis pour « asséner » (porter un coup) : remplacement d'un mot. → Permet d’asséner un violent coup

#### capacites/rokh-colombe

- **L1** — « considérer comme classe magique » — Participe attendu (« [classe] considérée comme classe magique ») ; la même formule se retrouve dans d'autres capacités et peut servir de repère (bonus de 4 AM), donc à décider globalement. → considérée comme classe magique

#### capacites/rokh-transport

- **L1** — « qui ne dépasse le double » — Négation incomplète (« pas » manquant) : corriger demande d'ajouter un mot. → qui ne dépasse pas le double

#### capacites/satyre-oracle

- **L1** — « considérer comme classe magique » — Participe attendu (« [classe] considérée comme classe magique ») ; formule commune à plusieurs capacités, à décider globalement. → considérée comme classe magique

#### capacites/satyre-testosterone

- **L1** — « s'il rate, il va devoir » — Texte repris de « Oestrogène » : la cible est « femelle », les pronoms devraient être « elle » ; remplacement de mots. → si elle rate, elle va devoir

#### capacites/tueur-anti-corps

- **L1** — « l'altération d'état lié à la magie innée » — « lié » peut s'accorder avec « altération » (liée) ou « état » (lié) : deux lectures possibles. → l'altération d'état liée à la magie innée

#### capacites/tueur-insistance

- **L1** — « dont il est vulnérable » — On est vulnérable « à » quelque chose : corriger demande de remplacer « dont ». → à laquelle il est vulnérable

#### capacites/voleur-frappe-discrete

- **L1** — « +1d de dégâts supplémentaire » — « supplémentaire » peut s'accorder avec « 1d » ou avec « dégâts » (supplémentaires) : deux lectures possibles. → +1d de dégâts supplémentaires

#### capacites/voleur-puissant

- **L1** — « 1d de dégâts supplémentaire » — « supplémentaire » peut s'accorder avec « 1d » ou avec « dégâts » (supplémentaires) : deux lectures possibles. → 1d de dégâts supplémentaires

#### classes/archer

- **L5** — « utilisant arcs pour harceler » — Déterminant manquant devant « arcs » : corriger demande d'ajouter un mot. → utilisant des arcs pour harceler

#### classes/bimane

- **L19** — « sans dépasser 1 dans le même » — Phrase incomplète ou accord douteux (« la même [arme] » ?) : on ne sait pas à quoi « le même » se rapporte. → sans dépasser 1 dans la même
- **L45** — « ou bien de faire une unique attaque » — Construction parallèle à « peut même manier » : « de » est en trop ; corriger demande de retirer un mot. → ou bien faire une unique attaque
- **L45** — « Car il y a jamais assez gros » — « ne » manquant (tournure orale, peut-être voulue) : corriger demande d'ajouter un mot. → Car il n'y a jamais assez gros

#### classes/jackalope

- **L51** — « du Foudre » — « foudre » (la magie de la foudre) est féminin ailleurs (« les sorts de la foudre ») ; corriger demande de remplacer « du » par « de la ». → de la Foudre

#### classes/kitsune

- **L5** — « Son agilité lui permettent » — Sujet singulier et verbe au pluriel ; la double espace laisse penser qu'un second sujet a été oublié (« Son agilité et … lui permettent »). Deux lectures possibles. → Son agilité lui permet
- **L43** — « plus efficace qu’elle n’y paraît » — La locution figée est impersonnelle (« qu'il n'y paraît ») ; corriger demande de remplacer « elle » par « il ». → plus efficace qu’il n’y paraît

#### classes/maclier

- **L9** — « d'influer ses sorts dans son bouclier » — « influer » (avoir une influence) ne prend pas de complément direct ; le sens attendu semble « infuser », mais c'est un autre mot. → d'infuser ses sorts dans son bouclier

#### classes/mage-bleu

- **L9** — « Il peut soit augmenter son savoir sur les monstres mais aussi d'avoir un compagnon familier » — Construction « soit … mais aussi de » incohérente ; corriger demande de remplacer ou retirer des mots. → Il peut soit augmenter son savoir sur les monstres, soit avoir un compagnon familier
- **L13** — « Dans le cas si on choisi » — « Dans le cas si » mélange « dans le cas où » et « si » ; corriger demande de remplacer un mot (« choisi » → « choisit » est corrigé à part). → Dans le cas où on choisit
- **L69** — « (Passif\] Sujet épineux » — Crochet fermant (échappé en Markdown) au lieu d'une parenthèse fermante ; on ne touche pas aux échappements Markdown. → (Passif) Sujet épineux

#### classes/mage-rouge

- **L9** — « frapper en même temps son arme et son sort » — « frapper son arme » n'a pas le sens voulu ; il manque sans doute « avec » (ajout d'un mot). → frapper en même temps avec son arme et son sort
- **L13** — « Dans le cas si on choisi » — « Dans le cas si » mélange « dans le cas où » et « si » ; corriger demande de remplacer un mot (« choisi » → « choisit » est corrigé à part). → Dans le cas où on choisit

#### classes/mage-vert

- **L13** — « Dans le cas si on choisi » — « Dans le cas si » mélange « dans le cas où » et « si » ; corriger demande de remplacer un mot (« choisi » → « choisit » est corrigé à part). → Dans le cas où on choisit

#### classes/medusain

- **L7** — « (variable selon la magie innée) » — Si l'adjectif se rapporte à « les altérations d'état », il faut le pluriel ; il peut aussi s'agir d'une ellipse (« c'est variable »). → (variables selon la magie innée)
- **L53** — « Grâce à son affinité avec l’eau amplifie l’impact » — Sujet manquant : corriger demande d'ajouter un mot. → Grâce à son affinité avec l’eau, il amplifie l’impact

#### classes/olwman

- **L5** — « Le Olwman est un expert » — Élision attendue devant une voyelle (« L'Olwman », comme « L'Orios »), sauf si le nom se prononce avec un « w » initial (comme « le ouistiti ») : prononciation à confirmer. → L'Olwman est un expert

#### classes/rokh

- **L5** — « contre les certaines magies » — Deux déterminants : corriger demande de retirer un mot. → contre certaines magies

#### classes/voleur

- **L7** — « on ne fait pas attraper non ? » — Pronom réfléchi manquant : corriger demande d'ajouter un mot. → on ne se fait pas attraper non ?

#### commentaire_orphelin.texte

- **magies#commentaire-orphelin:f20cee886492** — « Le lien gel touche la cible » — Ailleurs « lien de gel » : il manque sans doute « de », mais corriger demande d'ajouter un mot. → Le lien de gel touche la cible

#### creature_capacite.donnees

- **bestiaire/golem-de-chair#capacite:forme-changeante** — « Peut utilisé utiliser les sorts » — Verbe en double (« utilisé utiliser ») : corriger demande de retirer un mot. → Peut utiliser les sorts

#### guide/actions-et-mouvements

- **L5** — « on parle pas de la première case » — « ne » de négation absent (registre oral) : corriger demande d'ajouter un mot. → on ne parle pas de la première case
- **L9** — « Le nombre de cases qui lui est possible de parcourir en 1 tour » — Construction impersonnelle attendue (« qu'il lui est possible ») : corriger demande d'ajouter le pronom « il ». → Le nombre de cases qu'il lui est possible de parcourir en 1 tour

#### guide/alterations-d-etats-et-mode-hyper

- **L7** — « les explications du monde hyper » — « monde » est probablement une coquille pour « mode » (titre de la section : Mode Hyper), mais c'est un autre mot existant. → les explications du mode hyper

#### guide/attaque-et-defense

- **L46** — « la « tête » correspondait à sa **queue**, et donc le malus/effet s’y appliquaient » — Exemple hypothétique à l'imparfait (conditionnel attendu) et verbe pluriel pour « le malus/effet » : choix de lecture. → la « tête » correspondrait à sa **queue**, et donc le malus/effet s’y appliquerait

#### guide/campagne-ou-scenario-one-shot

- **L22** — « il s'agit ni plus ni moins que d'une aventure » — « ne » manquant : corriger demande d'ajouter un mot. → il ne s'agit ni plus ni moins que d'une aventure
- **L65** — « une liste de pnj importante » — Accord ambigu : « importante » se rapporte-t-il à la liste ou aux PNJ (« les pnj importants » plus haut) ? → une liste de pnj importants
- **L65** — « une liste de nom généré à l'avance » — « nom » devrait être au pluriel après « liste de » ; « généré » peut s'accorder avec « liste » ou avec « noms » : choix de lecture. → une liste de noms générés à l'avance

#### guide/distance-et-voyage

- **L5** — « avec des cheveux personnels » — « cheveux » est sans doute une coquille pour « chevaux » (moyen de transport), mais c'est un autre mot existant. → avec des chevaux personnels
- **L11** — « Route, voie, chemin entretenue » — Accord de « entretenue » avec une énumération de genres mêlés : masculin pluriel (« entretenus ») ou accord avec le plus proche (« entretenu »). → Route, voie, chemin entretenus
- **L30** — « Purée de poix » — L'expression du brouillard épais est « purée de pois » ; « poix » est un autre mot existant. → Purée de pois
- **L33** — « si je l’ai pas encore fait » — « ne » manquant (tournure orale) : corriger demande d'ajouter un mot. → si je ne l’ai pas encore fait

#### guide/donjon-pas-bon

- **L25** — « à la merci de la nature Cela dit » — Point manquant entre deux phrases (ajout d'un signe). → à la merci de la nature. Cela dit
- **L35** — « Tout ceci ne sont que des exemples » — Sujet singulier « Tout ceci » avec un verbe au pluriel ; corriger demande de changer la tournure (« n'est » ou « Ce ne sont »). → Tout ceci n’est que des exemples

#### guide/en-resume-deroulement-d-un-tour

- **L25** — « jamais 2 fois le même » — « le même » peut renvoyer à « IC » (masculin) ou à « actions bonus » (« la même ») : choix de lecture. → jamais 2 fois la même

#### guide/fiche-accessoires-et-ceinture

- **L9** — « permet une - utilisation plus rapide » — Tiret parasite au milieu de la phrase (reste d'import) : le retirer touche un signe. → permet une utilisation plus rapide
- **L10** — « allumer des autres objets » — « des autres » devrait être « d'autres » : changement de mot. → allumer d'autres objets
- **L16** — « absolument tout Attention il y a » — Point manquant entre deux phrases (ajout d'un signe). → absolument tout. Attention il y a
- **L20** — « Les objets sont dans la ceinture ne peuvent pas » — Deux verbes conjugués : il manque sans doute « qui » (ajout d'un mot). → Les objets qui sont dans la ceinture ne peuvent pas

#### guide/fiche-attributs

- **L19** — « (plus détail [ici] » — Il manque « de » (« plus de détails ») : ajout d'un mot. → (plus de détails [ici]

#### guide/fiche-capacites-dons

- **L27** — « il n’y pas de limite » — Il manque « a » (« il n'y a pas ») : ajout d'un mot. → il n’y a pas de limite

#### guide/fiche-caracteristiques

- **L11** — « aux niveaux 5, 10 et 15 global » — « global » qualifie-t-il « niveaux » (« globaux ») ou le niveau global du personnage ? Choix de lecture. → aux niveaux 5, 10 et 15 globaux
- **L13** — « elle influence grande le physique » — « grande » est sans doute une coquille pour l'adverbe « grandement », mais c'est un autre mot existant. → elle influence grandement le physique

#### guide/fiche-classe

- **L9** — « dans le documents des classes » — Déterminant singulier et nom pluriel : « le document » ou « les documents ». → dans le document des classes

#### guide/fiche-maitrise-darme-et-armes

- **L5** — « Les maîtrises d’armes augmentent » — Phrase inachevée (rien après le verbe) : la suite manque dans le texte. → (compléter depuis la source)
- **L11** — « C'est ici qu'on trouve là on peut noter les différentes armes » — Deux tournures mêlées (« qu'on trouve » / « là on peut noter ») : corriger demande de retirer des mots. → C'est ici qu'on peut noter les différentes armes
- **L14** — « les dégâts qu’inflige les dégâts de l’arme » — Phrase confuse (« les dégâts » répété, verbe au singulier) : corriger demande de retirer ou réordonner des mots. → les dégâts qu’inflige l’arme

#### guide/fiche-personnage

- **L13** — « aller [ici] » — Infinitif d'instruction ou impératif « allez » (le texte vouvoie le lecteur, « Retrouvez » ligne suivante) : deux lectures possibles. → allez [ici]

#### guide/fiche-tableau-magie

- **L8** — « Mais il y a pas que ça » — « ne » manquant (tournure orale) : corriger demande d'ajouter un mot. → Mais il n'y a pas que ça

#### guide/fiche-tableau-posture

- **L7** — « les dégâts seront au minimum avec les bonus » — Contradiction avec le titre « Dégâts maximum » et l'exemple (14 sur 2d6+2) : corriger demande de remplacer un mot. → les dégâts seront au maximum avec les bonus
- **L8** — « la posture offensif » — Accord de l'adjectif (« offensive », comme ligne 14) ou nom de posture « Offensif » (titre de section) : deux lectures. → la posture offensive
- **L18** — « d'obliger un adversaire à venir vous attaquer que vous pendant 1 tour » — « ne » manquant et pronom en double : corriger demande d'ajouter et de retirer des mots. → d'obliger un adversaire à ne venir attaquer que vous pendant 1 tour
- **L36** — « il n’y pas plus haut » — Verbe « a » manquant : corriger demande d'ajouter un mot. → il n’y a pas plus haut
- **L45** — « Permet grâce un jet » — Préposition « à » manquante : corriger demande d'ajouter un mot. → Permet grâce à un jet

#### guide/formule-des-degats

- **L20** — « Il est en posture offensif » — Accord de l'adjectif (« offensive ») ou nom de posture « Offensif » : deux lectures. → Il est en posture offensive
- **L20** — « Je suis en posture défense » — Le nom de la posture est « Défensif » / « défensive » : corriger demande de remplacer un mot. → Je suis en posture défensive

#### guide/jet-de-des

- **L43** — « entraînant conséquence négative » — Article manquant : corriger demande d'ajouter un mot. → entraînant une conséquence négative
- **L52** — « C’est pas une panacée » — « ne » manquant (tournure orale) : corriger demande d'ajouter un mot. → Ce n’est pas une panacée
- **L52** — « donner une collation » — « collation » (repas léger) ne convient pas au sens ; probablement « consolation » : ce serait remplacer un mot. → donner une consolation
- **L56** — « faire comme le souhaite » — Sujet « il » manquant : corriger demande d'ajouter un mot. → faire comme il le souhaite

#### guide/les-neuf-alignements

- **L1** — « des caractères, des valeurs et des façons d'agir très différentes » — Adjectif après des noms de genres différents : le masculin pluriel l'emporte (« différents »), sauf si seul « façons d'agir » est visé ; deux lectures possibles. → des caractères, des valeurs et des façons d'agir très différents

#### guide/les-pieges

- **L8** — « s'enclenchent magiquement en arrivant d’une certaine zone » — « arriver d'une zone » signifie en venir ; le sens voulu est sans doute « dans une zone », mais corriger demande de remplacer un mot. → en arrivant dans une certaine zone

#### guide/les-portes

- **L11** — « un niveau de maximum de 20 » — Le premier « de » est de trop ; corriger demande de retirer un mot. → un niveau maximum de 20

#### guide/liste-des-alterations-d-etat

- **L186** — « Dure que 3 Tours. » — Négation sans « ne » ; corriger demande d'ajouter un mot. → Ne dure que 3 Tours.
- **L200** — « Résistance Magique annulées » — Accord incohérent : singulier (« Résistance Magique annulée ») ou pluriel (« Résistances Magiques annulées ») ; deux lectures possibles. → Résistance Magique annulée

#### guide/liste-des-effets-mode-hyper

- **L80** — « pendant tout le monde hyper » — « monde » semble une faute de frappe pour « mode » (cf. L97 « pendant tout le mode hyper »), mais la correction remplace un mot existant par un autre. → pendant tout le mode hyper
- **L83** — « qui correspond à votre niveau puissance magique » — Antécédent de « qui » incertain (sorts ou magies) ; il manque aussi « de » devant « puissance » (ajout de mot). → qui correspondent à votre niveau de puissance magique
- **L85** — « Le sort malédiction ne marche. » — Négation incomplète : il manque « pas » (ou « plus ») ; corriger demande d'ajouter un mot. → Le sort malédiction ne marche pas.
- **L95** — « calqué sur le dégâts de l'arme » — Article singulier devant un nom pluriel : « les dégâts » ou « le dégât » ? → calqué sur les dégâts de l'arme

#### guide/liste-des-effets-mode-super

- **L5** — « l'aura magique se déferle » — « Déferler » n'est pas pronominal ; corriger demande de retirer « se ». → l'aura magique déferle
- **L7** — « réussir à attendre une parfaite harmonie » — « attendre » semble mis pour « atteindre » (remplacement d'un mot par un autre). → réussir à atteindre une parfaite harmonie
- **L19** — « 400.0 » — Nom d'objet manifestement issu d'une erreur d'import (nombre au lieu d'un nom).
- **L25** — « pour les alliées » — Féminin « alliées » alors que la page écrit « alliés » ailleurs ; peut-être « [cibles] alliées ». → pour les alliés

#### guide/meteo

- **L113** — « Une purée de poix » — L'expression est « purée de pois » (brouillard épais) ; « poix » est un autre mot existant. Voir aussi le nom de la météo (L111). → Une purée de pois
- **L160** — « qui réentrent dans les vêtements » — « réentrer » est rare (« entrer de nouveau ») ; sans doute « rentrent » ou « pénètrent » (remplacement de mot). → qui rentrent dans les vêtements
- **L198** — « couche de chakra pure » — « pure » s'accorde-t-il avec « couche » (féminin) ou avec « chakra » (masculin, « pur ») ? → couche de chakra pur
- **L226** — « des armes distance » — Il manque « à » (« armes à distance », comme L45) : ajout de mot. → des armes à distance

#### guide/mode-hyper-magie

- **L36** — « le temps du monde hyper » — Probablement « mode hyper » : corriger demande de remplacer un mot par un autre. → le temps du mode hyper
- **L44** — « L'ombre des ennemis les trahissent et les les poignardent » — « les » en double (retirer un mot) ; accord à choisir : sujet « L'ombre » (singulier) ou « Les ombres » voulu. → L'ombre des ennemis les trahit et les poignarde
- **L45** — « ignorent les PA" » — Guillemet orphelin en fin de cellule (reste d'import) ; aussi L52, L54 et L60. → ignorent les PA
- **L49** — « qui a 50% de renvoyer » — Mot manquant (« chance »), comme L91 « a 50% de chance de » : corriger demande d'ajouter un mot. → qui a 50% de chance de renvoyer
- **L68** — « Si l'arme n'a qu'à cran » — « à » mis pour « un » ou « 1 » : remplacer un mot. → Si l'arme n'a qu'un cran
- **L87** — « jusqu'à que vous changiez » — Locution « jusqu'à ce que » : corriger demande d'ajouter « ce ». → jusqu'à ce que vous changiez

#### guide/postures

- **L7** — « les dégâts seront au minimum avec les bonus » — Contradiction avec « Dégâts maximum » et l'exemple (14 dégâts pour 2d6+2) : « maximum » probable, mais c'est un autre mot. → les dégâts seront au maximum avec les bonus
- **L18** — « à venir vous attaquer que vous » — Négation restrictive sans « ne » : corriger demande d'ajouter un mot. → à ne venir attaquer que vous
- **L36** — « pour le sortilèges » — Article singulier et nom pluriel : choisir « les sortilèges » ou « le sortilège ». → pour les sortilèges
- **L36** — « qu’il n’y pas plus haut » — Verbe « a » manquant : corriger demande d'ajouter un mot. → qu’il n’y a pas plus haut
- **L45** — « Permet grâce un jet » — Préposition « à » manquante (« grâce à ») : ajouter un mot. → Permet grâce à un jet

#### guide/resistance-faiblesse-magie

- **L23** — « possède qu’une seule résistance » — Négation restrictive sans « ne » : corriger demande d'ajouter un mot. → ne possède qu’une seule résistance

#### guide/situations-avancees

- **L25** — « de manière plus gratuitement » — « de manière » suivi d'un adverbe : choisir « de manière plus gratuite » ou « plus gratuitement ». → de manière plus gratuite
- **L73** — « une équipe 4 joueurs » — Préposition « de » manquante : ajouter un mot. → une équipe de 4 joueurs

#### invocation_capacite_commune.texte

- **bestiaire/animation-des-morts#commune:elementaire** — « Celui du feu est résistance au Feu » — Nom « résistance » au lieu de l'adjectif « résistant » (cf. T109) : corriger remplace un mot par un autre. → Celui du feu est résistant au Feu

#### magies/magie-de-la-corruption

- **L26** — « les Felfes noirs peuvent cette magie en innée/acquis » — Verbe manquant après « peuvent » : corriger demande d'ajouter un mot. → les Felfes noirs peuvent avoir cette magie en innée/acquis
- **L52** — « Retire du 2d10 de chakra à la cible » — « du » devant un jet de dés semble en trop : corriger demande de retirer un mot. → Retire 2d10 de chakra à la cible
- **L73** — « Si la cible est dans la posture indiquée à ce moment-là, il doit changer » — Pronom masculin « il » pour « la cible » : corriger demande de remplacer un mot (ou il désigne le personnage). → elle doit changer
- **L83** — « on est pas bloqué à vie » — Négation sans « ne » : corriger demande d'ajouter un mot. → on n'est pas bloqué à vie

#### magies/magie-de-la-glace

- **L69** — « Le lien gel touche la cible » — Le sort s'appelle « Lien de gel » : « de » semble oublié, corriger demande d'ajouter un mot. → Le lien de gel touche la cible
- **L69** — « La cible est ainsi libérée mais peut se reprendre le lien de gel si jamais il est à côté » — Pronom masculin « il » pour « La cible » : corriger demande de remplacer un mot. → si jamais elle est à côté

#### magies/magie-de-la-necromancie

- **L13** — « **Santé offert** » — « Santé » est féminin, mais c'est un libellé de champ (en-tête de colonne ou libellé fabriqué par l'import, répété sur toutes les pages de magie) qui peut sous-entendre « [bonus de] Santé offert ». → **Santé offerte**
- **L64** — « Invoque de pieu depuis le sol » — « de pieu » est fautif ; corriger demande de choisir entre « un pieu » et « des pieux » (zone Cercle de 2), donc de remplacer un mot. → Invoque des pieux depuis le sol
- **L74** — « une vague de cadavre qui » — Contre-vérification : Le texte reprend le nom du sort « Vague de cadavre » (singulier), qu'on ne peut pas corriger sans changer son identifiant ; déjà en attente dans docs/sql/orthographe-a-valider.md (sort « vague-de-cadavre ») : au propriétaire de trancher nom et texte ensemble. → une vague de cadavres qui
- **L94** — « double de le coût précédent » — « de le » est agrammatical ; corriger demande de retirer « de ». → double le coût précédent

#### magies/magie-de-la-terre

- **L42** — « doit être dans environnement lié à la terre » — Article manquant : corriger demande d'ajouter un mot. → doit être dans un environnement lié à la terre
- **L53** — « retirer un cran solidité » — Préposition manquante (sauf si « cran solidité » est un terme du jeu) : corriger demande d'ajouter un mot. → retirer un cran de solidité
- **L71** — « double de le coût précédent » — « de le » est agrammatical ; corriger demande de retirer « de ». → double le coût précédent

#### magies/magie-de-larcane

- **L74** — « Ne se cumule avec "Rune Arcane multiple" » — Négation incomplète : « pas » manquant ; corriger demande d'ajouter un mot. → Ne se cumule pas avec "Rune Arcane multiple"
- **L89** — « Ne se cumule avec "Rune Arcane" » — Négation incomplète : « pas » manquant ; corriger demande d'ajouter un mot. → Ne se cumule pas avec "Rune Arcane"

#### magies/magie-de-leau

- **L26** — « est considéré comme une source d'eau QUE pour lui » — Restriction « ne… que » sans « ne » ; corriger demande d'ajouter un mot. → n'est considéré comme une source d'eau QUE pour lui
- **L50** — « retirer un cran solidité » — Préposition « de » manquante (« un cran de résistance » ailleurs) ; corriger demande d'ajouter un mot. → retirer un cran de solidité
- **L51** — « Place un un courant d'eau » — Mot « un » en double ; corriger demande de retirer un mot. → Place un courant d'eau
- **L53** — « de gros dégâts au adversaire » — « au adversaire » est fautif ; deux lectures possibles (singulier ou pluriel). → de gros dégâts aux adversaires (ou : à l'adversaire)

#### magies/magie-de-lespace-temps

- **L53** — « marche que sur les créatures vivantes » — Restriction « ne… que » sans « ne » ; corriger demande d'ajouter un mot. → ne marche que sur les créatures vivantes
- **L73** — « pas de jet est nécessaire » — Négation sans « ne » ; corriger demande d'ajouter un mot. → pas de jet n'est nécessaire

#### magies/magie-de-lombre

- **L9** — « des bracelets faits d'ombre violettes » — Accord ambigu : « violettes » ne s'accorde ni avec « bracelets » (masculin pluriel) ni avec « ombre » (singulier) ; il faut choisir le mot qualifié. → des bracelets faits d'ombre violette (ou : bracelets violets faits d'ombre)
- **L41** — « Met une croix dans 1 une caractéristique » — « 1 une » : un mot en double ; corriger demande d'en retirer un (et on ne touche pas aux chiffres). → Met une croix dans une caractéristique
- **L45** — « Créer 1 (+1/NM) lame(s) autour du lanceur » — Homophone -er/-e : les autres effets sont au présent (« Invoque », « Diminue ») ; l'infinitif reste possible. → Crée 1 (+1/NM) lame(s) autour du lanceur
- **L57** — « et va attaquer qu'elle » — Sens « n'attaque qu'elle » : il manque « ne » (ajout d'un mot) ; tournure à confirmer. → et ne va attaquer qu'elle

#### magies/magie-du-feu

- **L53** — « craché par la gueule. , 10% de chance » — Ponctuation parasite « . , » : retirer un signe n'est pas une correction admise sans avis. → craché par la gueule, 10% de chance

#### magies/magie-du-sang

- **L9** — « la taille et la musculature qui est plus élevée que la moyenne » — Accord ambigu : la relative peut porter sur « la musculature » seule ou sur « la taille et la musculature » (« qui sont plus élevées »). → la taille et la musculature qui sont plus élevées que la moyenne
- **L44** — « vers le lanceur ne fonctionne qu'en ligne » — Deux propositions sans ponctuation entre elles ; ajouter un signe (virgule ou point) est à valider. → vers le lanceur. Ne fonctionne qu'en ligne.
- **L83** — « qui se cumule pas avec le Saignement classique » — Négation sans « ne » : corriger demande d'ajouter un mot. → qui ne se cumule pas avec le Saignement classique

#### magies/magie-du-vent

- **L54** — « Incanche une vibration insupportable » — « Incanche » n'est pas un mot français ; le mot voulu est incertain (« Déclenche », « Enclenche », « Incante » ?) : remplacement d'un mot. → Déclenche une vibration insupportable

#### magies/magie-du-vide

- **L48** — « Annule les effets positif et négatif d'une cible. » — Adjectifs au singulier après « les effets » : tournure distributive possible (un effet positif, un effet négatif), mais le pluriel est plus probable. → Annule les effets positifs et négatifs d'une cible.
- **L53** — « marche que sur les créatures vivantes » — « ne » manquant dans la négation restrictive : corriger demande d'ajouter un mot. → ne marche que sur les créatures vivantes
- **L136** — « Le mage noir et blanc peuvent le faire » — Sujet au singulier avec verbe au pluriel ; il s'agit sans doute de deux mages (noir et blanc). → Les mages noir et blanc peuvent le faire

#### magies/potentiel-illimite

- **L15** — « en plus d'être limité à peu de races » — Accord incertain : se rapporte à « cette magie » (limitée) ou au Potentiel Illimité (limité). → en plus d'être limitée à peu de races
- **L20** — « (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global. » — Parenthèse ouverte jamais fermée. → (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).
- **L36** — « Résistance à la magie et dégâts physiques neutre. » — « neutre » ne s'accorde avec aucun nom : sans doute « dégâts physiques neutres », mais le mot auquel il se rapporte est incertain. → Résistance à la magie et dégâts physiques neutres.

#### metiers/boulanger

- **L1** — « les golems de pains » — Nom de matière normalement au singulier (« golems de pain ») ; peut être le nom d'une créature du jeu. → les golems de pain

#### metiers/bucheron

- **L1** — « Il est celui qui reconnaît tout type de bois mais également de les transformer en planche utilisable. » — Construction incomplète (« de les transformer » sans verbe qui l'introduise) ; corriger demande d'ajouter un mot. → Il est celui qui reconnaît tout type de bois mais également capable de les transformer en planches utilisables.

#### metiers/couturier

- **L5** — « Peut faire des vêtements, robe, … » — Énumération après « des vêtements » : « robes » au pluriel probable. → Peut faire des vêtements, robes, …

#### metiers/myciculteur

- **L1** — « (n’est pas relié à la champicer) » — Mot inconnu « champicer » (nom d'une organisation, d'un métier ou d'une magie ? coquille ?) : impossible de corriger sans deviner.

#### metiers/patissier

- **L1** — « Leur travail est souvent comparé à ceux d’un artiste » — Le sujet est « Le pâtissier » (singulier) et « ceux » reprend « travail » : corriger demande de remplacer des mots. → Son travail est souvent comparé à celui d’un artiste
- **L1** — « qui vénère Bauc » — Contre-vérification : Deux lectures : « de ceux qui vénèrent Bauc » ou « de celui qui vénère Bauc » (apposition à « un artiste », l'auteur écrit déjà « ceux d'un artiste » pour « celui ») ; seul l'auteur sait. → qui vénèrent Bauc

#### metiers/regles-des-metiers

- **L5** — « Bien qu’il ait des indications sur les classes » — Il manque « y » (« il y a ») : corriger demande d'ajouter un mot. → Bien qu’il y ait des indications sur les classes
- **L5** — « ce sont que des idées » — Négation sans « ne » : corriger demande d'ajouter un mot. → ce ne sont que des idées
- **L25** — « ne donnez pas trop de bonus et peu de bonus » — Phrase contradictoire (« ni trop, ni trop peu » ?) : corriger demande de changer des mots. → ne donnez ni trop de bonus ni trop peu de bonus

#### mode_hyper_effet.effet

- **fiche:magies/magie-de-la-glace:mono** — « 25.L'armure » — Contre-vérification : La cellule (ligne « fiche », Glace mono) accole le texte mono (+25) et le texte bi (+10) : probable artefact de concaténation de la Fiche auto ; au propriétaire de décider s'il faut séparer ou retirer la seconde phrase plutôt que d'ajouter une espace. → 25. L'armure
- **fiche:magies/potentiel-illimite:mono** — « dégâts physique neutre » — « neutre » peut se rapporter à « dégâts » (→ « neutres ») ou à « Résistance » ; lecture incertaine. → dégâts physiques neutres

#### mode_texte.texte

- **guide/liste-des-effets-mode-super#texte:ne-faire-plus-quun-avec-son-objet** — « l'aura magique se déferle » — « déferler » n'est pas pronominal (cf. T134 « l'aura magique déferle ») : corriger demande de retirer « se ». → l'aura magique déferle
- **guide/liste-des-effets-mode-super#texte:ne-faire-plus-quun-avec-son-objet** — « de réussir à attendre une parfaite harmonie » — Sans doute « atteindre » : corriger remplace un mot par un autre. → de réussir à atteindre une parfaite harmonie

#### note_cellule.texte

- **sort / magies/magie-de-la-necromancie#sort:animation-de-mort / 3** — « double de le coût précédent » — « de le » agrammatical : corriger demande de retirer « de ». → double le coût précédent

#### races/anansi

- **L20** — « comme les Anansi est la seule race » — Sujet pluriel avec un verbe au singulier : deux corrections possibles (« les Anansi sont » ou « l'Anansi est »). → comme les Anansi sont la seule race
- **L24** — « Nommés "Veuve noire" ou "Veuf sombre" » — Les autres tribus ont « Nommées » (accord avec « tribus ») ; ici la tribu est mixte, l'accord dépend de ce qui est désigné. → Nommées "Veuve noire" ou "Veuf sombre"
- **L24** — « des "guides d'assassins" » — Probablement « guildes d'assassins » : corriger remplace un mot par un autre. → des "guildes d'assassins"
- **L24** — « offrir leur servir pour l'assassinat » — « servir » est probablement « services » : corriger remplace un mot par un autre. → offrir leurs services pour l'assassinat
- **L34** — « entre 2m00 à 2m25 » — « entre … et … » attendu : corriger remplace un mot. → entre 2m00 et 2m25
- **L44** — « La couleur des yeux majoritaire chez les Anansis sont » — Sujet singulier avec verbe pluriel : deux corrections possibles (« Les couleurs des yeux majoritaires … sont » ou « … est »). → Les couleurs des yeux majoritaires chez les Anansis sont
- **L165** — « Les attaques vont obtenir une effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière a la cible \| Nécromancie= Inflige Poison 1 automatiquement \| Ombre = Réduit de 5 l'initiative de la cible toucher pour le prochaine tour. » — Troisième colonne : texte de la fiche V15.2.2 annoncé « cité tel quel » ; mêmes fautes que L99 (une effet, a la cible, toucher, le prochaine tour). À corriger seulement si la citation peut l'être. → Les attaques vont obtenir un effet secondaire selon la magie innée : Arcane = Vampirise 1d6 barrière à la cible \| Nécromancie= Inflige Poison 1 automatiquement \| Ombre = Réduit de 5 l'initiative de la cible touchée pour le prochain tour.

#### races/drakos

- **L11** — « de pays consacrée » — Accord ambigu avec « de ville ou de pays » : « consacré » (avec le plus proche, « pays ») ou « consacrés » (les deux noms) ; il faut choisir. → de pays consacrés
- **L11** — « au plus offrants » — Locution « au plus offrant » : corriger demande de choisir entre « au plus offrant » et « aux plus offrants ». → au plus offrant
- **L328** — « Les écailles absorbe les dégâts subits du même élément que la magie inné et les convertis en Barrière. » — Texte de la colonne « Fiche V15.2.2 (citée telle quelle) » : quatre fautes (absorbe → absorbent, subits → subis, inné → innée, convertis → convertissent), mais la citation se veut fidèle à la fiche. → Les écailles absorbent les dégâts subis du même élément que la magie innée et les convertissent en Barrière.
- **L330** — « des particularité du don racial » — Deux fois dans la ligne, dans des citations du texte de la fiche (« citée telle quelle ») ; la même faute est corrigée à la ligne 47. → des particularités du don racial
- **L334** — « magie autorisé » » — Contre-vérification : Citation littérale d'une phrase de l'onglet, écrite par tools/sheets/races.py (ACCESS_COPY_NOTE) : la corriger seule la désaccorde de la source et elle sera regénérée ; à faire avec la phrase de l'onglet et le script, sur décision. → magie autorisée »

#### races/drassahthac

- **L9** — « et ceux en l'an -450 » — « ceux » pour la locution « et ce » : remplacement d'un mot (homophone approximatif). → et ce, en l'an -450
- **L226** — « magie autorisé » » — Contre-vérification : Citation littérale d'une phrase de l'onglet, écrite par tools/sheets/races.py (ACCESS_COPY_NOTE) : la corriger seule la désaccorde de la source et elle sera regénérée ; à faire avec la phrase de l'onglet et le script, sur décision. → magie autorisée »

#### races/elfe-argente

- **L15** — « mais garde la mauvaise réputation » — Après « Une partie des argentés », le premier verbe est au pluriel (« se sont rebellés ») et le second au singulier : il faut choisir l'accord. → mais gardent la mauvaise réputation
- **L160** — « Toutes les sortilèges d'attaques sont imparable. » — Colonne « Fiche V15.2.2 (citée telle quelle) » : « Toutes » → « Tous » (sortilège est masculin) et « imparables ». Corriger rendrait la citation identique à la colonne de l'onglet et effacerait l'écart que la ligne du tableau signale. → Tous les sortilèges d'attaques sont imparables.

#### races/elfe-dore

- **L13** — « chacun avait leur portion » — Après « chacun », le possessif attendu est « sa » : corriger remplace un mot. → chacun avait sa portion
- **L15** — « 3 branches de lui-même » — « lui-même » se rapporte à « Cette race » (féminin) : corriger remplace le pronom. → 3 branches d'elle-même

#### races/elfe-forestier

- **L35** — « il garde un ton assez clair » — Le sujet « il » ne reprend rien au masculin singulier : « la couleur » (elle garde) ou « les elfes » (ils gardent) ; corriger demande de choisir. → elle garde un ton assez clair
- **L49** — « La Force à un maximum de 3, l'Agilité à un minimum de 3 » — « à » ou « a » : deux lectures possibles (énoncé elliptique « La Force à… » ou verbe avoir « La Force a un maximum… »). → La Force a un maximum de 3, l'Agilité a un minimum de 3
- **L146** — « magie autorisé » — Contre-vérification : Même cas que N0889 : citation de l'onglet « Une seule magie autorisé » dans la note générée par tools/sheets/races.py ; à corriger avec la source et le script, ou à garder comme citation exacte. → magie autorisée

#### races/elfe-noir

- **L7** — « un style vestimentaire qui est celle des Romains » — Accord de « qui est celle » avec trois antécédents (coutumes, façon de vivre, style vestimentaire) : corriger demande de choisir. → qui sont ceux des Romains
- **L113** — « soin 1 point de corruption » — « soin » (nom) à la place du verbe « soigne » (l'onglet dit « soigne ») ; mais ce texte est celui de la fiche, cité tel quel, et le corriger effacerait l'écart signalé en L141. → soigne 1 point de corruption
- **L138** — « tout les début de tour » — Citation de la fiche V15.2.2 « telle quelle » (tableau des écarts) : la corriger effacerait l'écart documenté. « tous les » et « débuts » au pluriel. → tous les débuts de tour
- **L141** — « objet) soin 1 point de corruption » — Colonne de la fiche « citée telle quelle » : « soin » (nom) pour « soigne » ; corriger effacerait l'écart avec l'onglet. → objet) soigne 1 point de corruption
- **L141** — « point de corruption | \- +10% à tout les tests » — Citation de la fiche V15.2.2 « telle quelle » (tableau des écarts) : la corriger effacerait l'écart documenté. « tout les tests » → « tous les tests ». → point de corruption | \- +10% à tous les tests
- **L143** — « magie autorisé » — Contre-vérification : Même cas que N0889 : citation de l'onglet « Une seule magie autorisé » dans la note générée par tools/sheets/races.py ; à corriger avec la source et le script, ou à garder comme citation exacte. → magie autorisée

#### races/farfadet

- **L47** — « La Force à un maximum de 3. » — « à » ou « a » : deux lectures possibles (énoncé elliptique « La Force à… » ou verbe avoir « La Force a un maximum… »). → La Force a un maximum de 3.
- **L86** — « pour être esquivé » — « pour être esquivé » : accord selon l'antécédent, « altérations » (esquivées) ou « états » (esquivés). → pour être esquivées
- **L102** — « qui correspond à votre niveau puissance magique » — « qui correspond » devrait sans doute s'accorder avec « sorts » (correspondent) et « de » manque devant « puissance » : antécédent incertain (virgule) et mot à ajouter. → qui correspondent à votre niveau de puissance magique

#### races/felfe

- **L43** — « La Force à un maximum de 2. » — « à » ou « a » : deux lectures possibles (énoncé elliptique « La Force à… » ou verbe avoir « La Force a un maximum… »). → La Force a un maximum de 2.

#### races/fenrir

- **L9** — « Apparu avec » — Accord du participe sans sujet exprimé : « Apparue » (cette race) ou « Apparus » (les Fenrirs) ; deux lectures possibles. → Apparue avec

#### races/goleois

- **L9** — « Apparu avec » — Accord du participe sans sujet exprimé : « Apparue » (cette race) ou « Apparus » (les Goleois) ; deux lectures possibles. → Apparue avec
- **L13** — « Cette race, a commencé » — Virgule entre le sujet et le verbe (retrait de ponctuation hors du périmètre). → Cette race a commencé
- **L13** — « notamment remarqué pour leur force » — Accord du participe : « remarquée » (la race) ou « remarqués » (les Goleois, repris par « leur ») ; deux lectures possibles. → notamment remarquée pour leur force

#### races/hujin

- **L13** — « il s'est vite remarqué par les scientifiques » — Tournure fautive (« se remarquer par ») ; la corriger demande d'ajouter ou de remplacer un mot. → il s'est vite fait remarquer par les scientifiques
- **L29** — « Japon féodale/Humaine » — « Japon » est masculin (« Japon féodal »), mais les adjectifs peuvent aussi s'accorder avec « Culture » (cf. « Humaine ») ; deux lectures. → Japon féodal/Humaine
- **L92** — « magiques reçu par 2 » — Accord fautif (« reçus », avec « dégâts ») dans la colonne de la fiche « citée telle quelle » : corriger contredirait la citation. → magiques reçus par 2
- **L95** — « « Une seule magie autorisé » » — Accord fautif (« autorisée ») dans une phrase citée entre guillemets depuis l'onglet. → « Une seule magie autorisée »

#### races/humain

- **L31** — « Les humains tropicaux à la peau sont soumis » — Il manque un adjectif après « à la peau » (comparer avec « à la peau sombre », « à la peau très blanche ») : mot oublié.
- **L33** — « mais aussi des brouillards naturels » — Après « immunisés à », la préposition attendue est « aux » ; corriger remplace un mot. → mais aussi aux brouillards naturels
- **L174** — « « Une seule magie autorisé » » — Accord fautif (« autorisée ») dans une phrase citée entre guillemets depuis l'onglet. → « Une seule magie autorisée »

#### races/jackalope

- **L15** — « une partie des jackalopes semblent croire que Mora est leur créateur et lui voue un culte » — Même sujet collectif accordé au pluriel (« semblent ») puis au singulier (« voue ») : il faut choisir un seul accord. → lui vouent un culte
- **L122** — « son altération d'état." » — Guillemet droit isolé en fin de ligne (reste d'import ; le même figure à la L165, colonne de la fiche) : le retirer supprime un caractère. → son altération d'état.
- **L164** — « Les terrains, météos ou effets qui retire de la Vitesse et/ou de l'Initiative ne fonctionne pas sur lui. » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la page affirme citer la fiche mot pour mot ; corriger la citation est au choix du propriétaire. Accords : sujets pluriels. → qui retirent de la Vitesse et/ou de l'Initiative ne fonctionnent pas sur lui

#### races/kitsune

- **L8** — « Apparu avec tous les autres » — Sujet sous-entendu ambigu : « Apparue » (la race) ou « Apparus » (les Kitsunes). → Apparus
- **L12** — « où les kistunes un culte d'humains ayant subi » — Verbe manquant : la phrase n'a pas de verbe principal ; corriger demande d'ajouter un mot. → où les kitsunes étaient un culte d'humains ayant subi
- **L12** — « les ont permis de s'adapter » — « permettre à quelqu'un » : pronom complément indirect « leur » ; corriger remplace un mot. → leur ont permis de s'adapter
- **L12** — « Persuadés, que c'est un signe divin » — Virgule fautive entre « Persuadés » et sa complétive. → Persuadés que c'est un signe divin

#### races/lamia

- **L5** — « ça ne les empêche d'être parfois belliqueuses » — Négation incomplète : « pas » manquant ; corriger demande d'ajouter un mot. → ça ne les empêche pas d'être parfois belliqueuses
- **L31** — « et ceux tout 5 ans » — « et ce » (homophone de « ceux ») puis « tous les 5 ans » : corriger demande d'ajouter « les ». → et ce tous les 5 ans
- **L37** — « leur visage ont des traits » — Sujet singulier, verbe pluriel : « leur visage a » ou « leurs visages ont » (deux lectures). → leurs visages ont des traits
- **L49** — « magie autorisé » — Contre-vérification : Même cas que N0889 : citation de l'onglet « Une seule magie autorisé » dans la note générée par tools/sheets/races.py ; à corriger avec la source et le script, ou à garder comme citation exacte. → magie autorisée
- **L71** — « capable d'empoisonné 2 et de paralysé 2 » — Infinitif attendu après « capable de » (« d'empoisonner 2 et de paralyser 2 »), à moins que « Empoisonné 2 » et « Paralysé 2 » ne soient des noms d'états : deux lectures. → capable d'empoisonner 2 et de paralyser 2
- **L106** — « capable d'empoisonné 2 et de paralysé 2 (deux colonnes) » — Même point qu'à la L71, dans la colonne de l'onglet et dans celle de la fiche citée telle quelle. → capable d'empoisonner 2 et de paralyser 2
- **L106** — « oblige 2 jet de vigueur pour résister au deux effets. | (dernière colonne) » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la page affirme citer la fiche mot pour mot ; corriger la citation est au choix du propriétaire. Fautes : « jets » (pluriel après 2) et « aux deux effets ». → oblige 2 jets de vigueur pour résister aux deux effets.
- **L108** — « Sang Froid, Une seule magie autorisé. | » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la page affirme citer la fiche mot pour mot ; corriger la citation est au choix du propriétaire. Accord : « magie autorisée ». → Une seule magie autorisée.

#### races/majin

- **L5** — « Cette race a pour origine dans ce que l'on nomme » — Construction fautive (« a pour origine » + « dans ») : corriger demande de retirer ou remplacer un mot. → Cette race a pour origine ce que l'on nomme
- **L5** — « Les Majins, sont des humanoïdes » — Virgule fautive entre le sujet et le verbe. → Les Majins sont des humanoïdes
- **L108** — « magie autorisé » — Contre-vérification : Même cas que N0889 : citation de l'onglet « Une seule magie autorisé » dans la note générée par tools/sheets/races.py ; à corriger avec la source et le script, ou à garder comme citation exacte. → magie autorisée

#### races/marcass

- **L31** — « une peau claire (bronzé pour ceux du feu) » — Accord à choisir : « bronzée » (la peau) ou « bronzés » (ceux du feu). → une peau claire (bronzée pour ceux du feu)
- **L172** — « Les AP et AM réduit les dégâts » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la page affirme citer la fiche mot pour mot ; corriger la citation est au choix du propriétaire. Accord : sujet pluriel. → Les AP et AM réduisent les dégâts
- **L173** — « Barrière bonus,Taux de Chakra bas. | » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la page affirme citer la fiche mot pour mot ; corriger la citation est au choix du propriétaire. Espace manquante après la virgule (corrigée à la L47). → Barrière bonus, Taux de Chakra bas.

#### races/medusain

- **L9** — « dans les ans -400 à -350 » — « dans les ans » n'est pas idiomatique ; corriger demande de remplacer un mot. → dans les années -400 à -350
- **L17** — « très protecteurs avec leur semblable » — Singulier distributif possible, mais le pluriel est plus naturel ; deux lectures. → très protecteurs avec leurs semblables
- **L23** — « il sont n'est donc pas rare » — Deux verbes conjugués : corriger demande de retirer « sont ». → il n'est donc pas rare
- **L25** — « un peuple plutôt discret, qui évitent » — « qui » peut renvoyer à « un peuple » (singulier) ou à « Les Medusains » (pluriel) : deux lectures. → un peuple plutôt discret, qui évite
- **L33** — « Elle possède le contrôle de ces tentacules et peuvent avoir des effets négatifs » — Sujet de « peuvent » absent ou mal accordé (« Elle … peut » ou « ces tentacules … peuvent ») : deux lectures. → Elle possède le contrôle de ces tentacules, qui peuvent avoir des effets négatifs

#### races/minotaure

- **L5** — « entre humains et bovin » — Nombre incohérent entre les deux noms (« humains » pluriel, « bovin » singulier) : deux lectures. → entre humains et bovins
- **L164** — « Les coups avec les cornes ou sabots inflige 20% des PV actuelle à la cible » — Colonne « citée telle quelle » de la fiche V15.2.2 : faute d'accord (« infligent », « actuels »), mais c'est une citation. → Les coups avec les cornes ou sabots infligent 20% des PV actuels à la cible

#### races/mort-vivant

- **L19** — « au dépend de ce qu'était la personne morte » — Locution mal employée (« aux dépens de » veut dire « au détriment de ») ; le sens voulu est « selon » : corriger demande de remplacer des mots. → en fonction de ce qu'était la personne morte
- **L28** — « Tous les avantages qu'ils avaient en étant vivants ne sont plus, il en garde des vestiges » — Passage de « ils » à « il » dans la même phrase : deux lectures. → ils en gardent des vestiges
- **L67** — « un petit plus de selon les conditions de la mort » — « de » en trop (ou mot manquant) : corriger demande de retirer ou d'ajouter un mot. → un petit plus selon les conditions de la mort

#### races/nain

- **L29** — « Le point d'origine des Nains sont les montagnes » — Sujet singulier (« Le point d'origine ») avec un verbe au pluriel accordé à l'attribut ; usage rare, la forme courante est « est ». → Le point d'origine des Nains est les montagnes
- **L155** — « « Une seule magie autorisé » » — Accord fautif (« magie », féminin), mais c'est une citation de l'onglet : à corriger seulement si la source l'est aussi. → « Une seule magie autorisée »

#### races/namazu

- **L11** — « une formes humaines hybrides requins » — Article singulier et groupe au pluriel : « une forme humaine hybride requin » ou « des formes humaines hybrides requins » ; choix entre deux lectures. → une forme humaine hybride requin
- **L11** — « hybrides animales » — Contre-vérification : Deux lectures : « la plupart des [races] hybrides animales » (ellipse de « race », nommée juste avant, féminin voulu par l'auteur, comme « aux autres hybrides animales » du Minotaure) ou « hybrides » nom masculin → « hybrides animaux » ; seul l'auteur tranche. → hybrides animaux
- **L13** — « ceux qui ont rejeter des tribus » — Infinitif après « ont » ; le sens voulu est sans doute « ont été rejetés des tribus », ce qui demande d'ajouter un mot (sinon « ont rejeté »). → ceux qui ont été rejetés des tribus
- **L15** — « sont les les tribus du sang » — Mot en double : corriger demande de retirer un mot. → sont les tribus du sang
- **L25** — « Il n'y pas de différence » — Verbe « a » manquant : corriger demande d'ajouter un mot. → Il n'y a pas de différence
- **L158** — « Double les AP donné par l'armure naturelle » — Accord fautif (« les AP », pluriel), mais la colonne de la fiche est « citée telle quelle ». → Double les AP donnés par l'armure naturelle

#### races/olwman

- **L19** — « qui peuvent utilisé comme des pieds » — Il manque « être » (sens passif) : corriger demande d'ajouter un mot. → qui peuvent être utilisés comme des pieds

#### races/orios

- **L53** — « l'Agilité a 3 maximum » — Probablement la préposition « à » (parallèle avec « La Force est obligatoirement à 3 minimum »), mais « a » (verbe avoir) se lit aussi. → l'Agilité à 3 maximum

#### races/rokh

- **L9** — « Apparu avec tous les autres animaux hybrides autres » — Accord de « Apparu » sans sujet exprimé (la race → « Apparue », ou « Apparus ») et « autres » en double : choisir la lecture et retirer un mot. → Apparue avec tous les autres animaux hybrides
- **L21** — « qui selon des rumeurs le point d'origine » — Verbe manquant : corriger demande d'ajouter un mot. → qui est selon des rumeurs le point d'origine
- **L31** — « qui peuvent utilisé comme des pieds » — Auxiliaire manquant : corriger demande d'ajouter « être ». → qui peuvent être utilisés comme des pieds
- **L92** — « le dégât est calqué sur le dégâts de l'arme » — Article singulier devant un nom au pluriel : choisir entre « le dégât » et « les dégâts » (même texte deux fois en L162). → le dégât est calqué sur le dégât de l'arme
- **L162** — « | Chaque attaque physique ou magique se suit d'un appel d'une \[Element Innée\] blanche \[dégâts non élémentaire\] » — Colonne « Fiche V15.2.2 (citée telle quelle) » : mêmes fautes que L92 (« Element », « non élémentaire »), non corrigées car la colonne se dit citation exacte. → | Chaque attaque physique ou magique se suit d'un appel d'une \[Élément Innée\] blanche \[dégâts non élémentaires\]
- **L163** — « \- Négotiation, Diplomatie et Réflexe » — Colonne « Fiche V15.2.2 (citée telle quelle) » : la coquille « Négotiation » est la seule différence avec la colonne de l'onglet ; la corriger viderait la ligne d'écart de son objet. → \- Négociation, Diplomatie et Réflexe (et retirer alors la ligne d'écart ?)

#### races/satyre

- **L29** — « de taille similaires aux humains » — Accord incertain : avec « taille » (« similaire ») ou avec « humanoïdes » (« similaires »). → de taille similaire aux humains

#### regle_magie.texte

- **magies#regle:regle-speciale-pour-sort-niveau-5** — « il est sera contraint » — Deux verbes conjugués : corriger demande de retirer un mot. → il sera contraint

#### ressources/accessoires

- **L15** — « ce sont des quarts de gemmes qui sont utilisées » — Accord incertain : avec « quarts » (« utilisés ») ou avec « gemmes » (« utilisées »). → ce sont des quarts de gemmes qui sont utilisés
- **L51** — « LEQUEL » — Renvoie à une caractéristique (féminin) : « LAQUELLE » remplacerait un mot. → LAQUELLE
- **L116** — « des altérations d'états de 1 quand ils sont infligés » — Accord incertain : avec « altérations » (« elles sont infligées ») ou avec « états » ; corriger remplace un pronom. → des altérations d'états de 1 quand elles sont infligées
- **L200** — « se remettre à un 1 santé » — « un » en trop devant « 1 » : corriger demande de retirer un mot. → se remettre à 1 santé

#### ressources/alchimie

- **L5** — « Elles se reconnaissent car n’ont pas la même forme » — Sujet manquant après « car » : corriger demande d'ajouter « elles ». → Elles se reconnaissent car elles n’ont pas la même forme
- **L26** — « Faire les recettes apprentis ou moins » — Accord des noms de niveau avec « recettes » (féminin) : « novice » (L25), « apprentis » (L26), « experts » (L28), « maîtres » (L29) ; à choisir (accord ou nom de niveau invariable). → Faire les recettes apprenties ou moins

#### ressources/alchimie-liste-ingredients

- **L16** — « la récupération de santé, la chakra ou » — « chakra » est masculin ailleurs (« recharger le chakra ») ; corriger demande de choisir entre « le chakra » et « de chakra » (récupération de chakra), ce qui remplace un mot. → la récupération de santé, de chakra ou

#### ressources/armes

- **L3** — « être le métier forgeron » — « être le métier » n'a pas de sens ; corriger demande de remplacer le verbe. → avoir le métier forgeron
- **L97** — « la taille et le poids démesuré » — Si « démesuré » qualifie la taille et le poids, il faut « démesurés » ; s'il ne qualifie que le poids, il est juste. → la taille et le poids démesurés
- **L108** — « fait énormément de dégâts quand il touche » — Le sujet est « cette arme » (féminin) : corriger demande de remplacer « il » par « elle ». → quand elle touche
- **L117** — « Cette arme rassemble beaucoup à une rapière » — Sens attendu « ressembler » ; « rassembler » est un autre mot existant. → Cette arme ressemble beaucoup à une rapière
- **L123** — « tellement épaisse qu'elle est assez difficile de la détruire » — Construction impersonnelle attendue (« qu'il est ») : corriger demande de remplacer « elle ». → tellement épaisse qu'il est assez difficile de la détruire
- **L164** — « Elle fût utiliser par les voleurs » — Le piolet est masculin : « Elle » devrait être « Il », et l'accord du participe (infinitif fautif) en dépend ; « fût » est aussi à corriger en « fut ». → Il fut utilisé par les voleurs
- **L167** — « inflige le double dégâts » — Il manque « de » (« le double de dégâts ») ou l'article est faux : corriger demande d'ajouter ou de changer un mot. → inflige le double de dégâts
- **L189** — « une arme grossière qui est utilisée pour la pêche, idéal pour la lancer » — « idéal » peut se rapporter au harpon (masculin) ou à « une arme » (féminin, repris par « la ») : deux lectures. → idéale pour la lancer
- **L198** — « quand ils utiliser comme une arme » — Verbe manquant : corriger demande d'ajouter « sont ». → quand ils sont utilisés comme une arme
- **L205** — « Une merveille de technologie naine, créer en l'an 781, ces gants » — « créer » doit être un participe passé, mais il peut se rapporter à « Une merveille » (créée) ou à « ces gants » (créés). → créée en l'an 781
- **L219** — « une hallebarde sur lequel une bannière » — Le relatif peut reprendre « une hallebarde » (sur laquelle) ou « L'étendard » (sur lequel) : deux lectures. → une hallebarde sur laquelle une bannière
- **L235** — « à la cible pour ne pas qu'il tombe » — Le pronom « il » reprend « la cible » (féminin) ; « qu'elle » serait l'accord attendu, sauf si « il » désigne volontairement l'adversaire. → pour ne pas qu'elle tombe
- **L241** — « Arme de jet légère et à grande portée, le Boomerang est aussi pratique qu'ingénieux. » — La description de l'Aiguille reprend mot pour mot celle du Boomerang (L240) : copie probable, hors orthographe, à vérifier dans la source. → Description propre à l'Aiguille, d'après la source.

#### ressources/armures

- **L31** — « sur les insectes ou autre arachnide » — Accord incertain : « autres arachnides » au pluriel (comme « les insectes ») ou « tout autre arachnide » ; choisir entre deux lectures. → sur les insectes ou autres arachnides
- **L33** — « il suffit de prendre de pioche » — « de pioche » semble une coquille pour « une pioche » ou « sa pioche » : corriger demande de remplacer un mot. → il suffit de prendre une pioche
- **L36** — « permet de faire de bonne armure » — Probablement « de bonnes armures » (pluriel), mais le partitif singulier « de bonne armure » se défend : deux lectures. → permet de faire de bonnes armures
- **L53** — « 100 RF / 1 R0 » — Le chiffre zéro remplace la lettre O du sigle « RO » ; on ne touche pas aux chiffres. → 100 RF / 1 RO

#### ressources/baton-magique

- **L1** — « Il y a pas de limite » — Négation incomplète : corriger demande d'ajouter « n' ». → Il n'y a pas de limite
- **L18** — « tout créatures assez folle » — Accord incohérent : deux lectures possibles (singulier ou pluriel). → toutes créatures assez folles (ou : toute créature assez folle)
- **L22** — « D'un un rouge » — Mot en double : corriger demande d'en retirer un. → D'un rouge
- **L27** — « d'un éclair un et » — « un » isolé en trop : corriger demande de retirer un mot. → d'un éclair et
- **L29** — « tordu des places » — « places » est peut-être une coquille pour « plages » (un palmier), mais c'est un autre mot existant. → tordu des plages

#### ressources/bouclier

- **L5** — « qui être encaissé » — Verbe manquant : corriger demande d'ajouter un mot (« peuvent »). → qui peuvent être encaissés
- **L13** — « qu'on mettre » — Verbe manquant : corriger demande d'ajouter un mot (« peut »). → qu'on peut mettre
- **L41** — « ou autre arachnide » — Accord à choisir : probablement pluriel comme « les insectes ». → ou autres arachnides
- **L43** — « prendre de pioche » — Mot probablement erroné : corriger demande de remplacer « de » par un autre mot. → prendre une pioche
- **L46** — « de bonne armure » — Nombre à choisir : « de bonnes armures » paraît voulu. → de bonnes armures

#### ressources/equipement-inventaire

- **L78** — « rapidement, est une action. » — Sujet manquant devant « est » : corriger demande d'ajouter un mot. → rapidement, c'est une action.

#### ressources/familiers

- **L32** — « quelques quelques gouttes d'eau » — Mot répété : corriger demande d'en retirer un. → quelques gouttes d'eau
- **L34** — « La fatigue niveau 1 ne donne réduit plus les dégâts » — Deux verbes conjugués (« donne » et « réduit ») : corriger demande de retirer un mot ; le sens de la règle est à confirmer. → La fatigue niveau 1 ne réduit plus les dégâts
- **L37** — « sa corne et est parfaitement blanche » — « et » en trop devant « est » : corriger demande de retirer un mot. → sa corne est parfaitement blanche
- **L37** — « ses petits naissance via » — Le nom « naissance » est employé à la place du verbe : corriger demande de remplacer un mot par un autre. → ses petits naissent via
- **L37** — « de d'autre cornilag » — « de d'autre » : « de » en trop (retrait d'un mot), et accord au pluriel ; pluriel de « cornilag » (jargon) à confirmer. → d'autres cornilags
- **L60** — « Il peut sembler pataud mais il est plus habile » — La grenouille géante est reprise par « elle » puis par « il » : uniformiser demande de remplacer des mots (et d'accorder « pataude »). → Elle peut sembler pataude mais elle est plus habile
- **L64** — « elle se flotte silencieusement » — « flotter » n'est pas pronominal ici : corriger demande de retirer « se ». → elle flotte silencieusement
- **L65** — « il est celui qui se lie pas à un champ » — « ne » de la négation manquant : corriger demande d'ajouter un mot. → il est celui qui ne se lie pas à un champ
- **L77** — « adapté des terrains de neige » — « adapté » se construit avec « à » : corriger demande de remplacer « des » par « aux ». → adapté aux terrains de neige

#### ressources/fievre-des-marais

- **L1** — « La fièvre des marais une maladie très commune » — Verbe manquant : corriger demande d'ajouter « est ». → La fièvre des marais est une maladie très commune
- **L3** — « des micros courbatures » — « micro » est un préfixe invariable qui se soude au nom ; graphie à choisir (soudée ou avec trait d'union). → des microcourbatures

#### ressources/fiole-blanche

- **L33** — « Augmente la chakra maximum de 10 » — « chakra » est masculin partout ailleurs (« le chakra ») ; il peut aussi manquer un mot (« la réserve de chakra maximale », cf. L3). → Augmente le chakra maximum de 10

#### ressources/fiole-multicolore

- **L1** — « la précieuse chair de blob royale » — Accord ambigu : « royale » qualifie la chair, ou la créature est un « blob royal » (nom d'ingrédient ou de créature possible). → la précieuse chair de blob royal

#### ressources/livre-parchemin

- **L21** — « Pour les gravés, il est nécessaire d'avoir » — Deux lectures : infinitif « Pour les graver » (le plus probable, même faute qu'aux lignes 12, 17 et 19) ou « pour les [parchemins] gravés ». La phrase est par ailleurs inachevée. → Pour les graver, il est nécessaire d'avoir
- **L25** — « c'est qu'une seule utilisation » — « ne » manquant dans la négation restrictive : corriger demande d'ajouter un mot. → ce n'est qu'une seule utilisation
- **L50** — « C'est qu'un seul NM par sort » — « ne » manquant dans la négation restrictive : corriger demande d'ajouter un mot. → Ce n'est qu'un seul NM par sort

#### ressources/machine-de-guerresiege

- **L5** — « les unités distances » — Tournure incomplète : « unités à distance » demande d'ajouter un mot. → les unités à distance
- **L6** — « et couvert par un toit » — Accord dépendant du sens : « couverte » si c'est la structure (parallèle à « montée »), « couvert » si c'est le châssis. → et couverte par un toit
- **L6** — « un toit un bois » — « un » à la place de « en » : corriger demande de remplacer un mot. → un toit en bois
- **L9** — « résister au brûlure » — « au » devant un nom féminin : deux corrections possibles, « aux brûlures » (parallèle à « aux projectiles ») ou « à la brûlure » (Brûlure est aussi un état du jeu). → résister aux brûlures

#### ressources/maladie

- **L12** — « Ingération » — Mot inexistant ; « Ingestion » (de « ingérer ») est probable mais c'est un autre mot. → Ingestion
- **L205** — « Anti poison » — Nom commun « antipoison » (en un mot) ou nom d'un objet du jeu ? → Antipoison

#### ressources/objets-de-depart-des-classes

- **L6** — « un sort niveau dedans » — Le numéro du niveau semble manquer (« sort niveau 1 » ?) : ajout d'un mot ou d'un chiffre. → un sort niveau 1 dedans
- **L15** — « Un instrument de musique, elle varie selon la magie. » — Pronom féminin pour « instrument » (masculin) ; remplacer « elle » par « il » change un mot. → Un instrument de musique, il varie selon la magie.
- **L35** — « Petite huile hémophilie » — Le nom « hémophilie » employé comme adjectif ; le nom de l'objet dit « hémophile ». Remplacement d'un mot. → Petite huile hémophile
- **L40** — « TU TE LES SCOTCH » — Conjugaison attendue « tu te les scotches », mais le texte est une blague volontaire qui joue sur « scotch ». → TU TE LES SCOTCHES
- **L45** — « quand elle au contact du chakra » — Verbe manquant (« est ») : corriger demande d'ajouter un mot. → quand elle est au contact du chakra

#### ressources/panacee

- **L1** — « Élaboré à partir d’ingrédients rares, il agit comme un remède universel … En combat, il peut annuler » — « La Panacée » est féminin : « Élaborée », « elle agit », « elle peut » demandent de remplacer « il » par « elle » (à moins que « il » renvoie à un « remède » sous-entendu). → Élaborée à partir d’ingrédients rares, elle agit … En combat, elle peut annuler

#### ressources/philtre-de-lescamoteur

- **L1** — « voire la l’agilité elle-même » — Article en double : corriger demande de retirer « la ». → voire l’agilité elle-même

#### ressources/pieces-elementaires

- **L66** — « afin au lanceur et aux alliés à côté d'avoir » — Construction incomplète : il manque un mot (« de permettre »). → afin de permettre au lanceur et aux alliés à côté d'avoir
- **L89** — « empêcher la cible l'utilisation de IC » — Il manque une préposition (« à la cible ») ; corriger demande d'ajouter un mot. → empêcher à la cible l'utilisation d'IC
- **L124** — « Infliger un dégâts » — Singulier « un » et pluriel « dégâts » : choix entre « un dégât » et « des dégâts ». → Infliger un dégât
- **L151** — « Peut être renouveler » — Infinitif fautif après « être » ; le participe dépend de ce qui est renouvelé (le sort ou l'arme). → Peut être renouvelé
- **L154** — « force l'adversaire un jet » — Il manque la préposition « à » ; corriger demande d'ajouter un mot. → force l'adversaire à un jet
- **L156** — « Plante la lance de le sol » — « de le » impossible ; la correction demande de remplacer un mot (« dans »). → Plante la lance dans le sol
- **L157** — « Si votre équipe êtes moins nombreux » — Sujet « votre équipe » avec verbe à la 2e personne du pluriel : réécriture nécessaire, plusieurs lectures possibles. → Si votre équipe est moins nombreuse
- **L197** — « qui infligent Xd6 dégâts » — Le sujet est « une explosion » (singulier) ; choix entre « inflige » et « infligera » (comme « soignera »). → qui infligera Xd6 dégâts
- **L215** — « lors de la l'attaque » — Article en double : corriger demande de retirer un mot. → lors de l'attaque
- **L217** — « en de multitude de racine qui empêche » — Construction fautive (article manquant, nombre de « racine ») ; plusieurs réécritures possibles. → en une multitude de racines qui empêchent
- **L233** — « toucher derrière lui » — « lui » reprend « la cible » (féminin) ; corriger demande de remplacer un mot. → toucher derrière elle
- **L263** — « Lorsque que l'arme » — « que » en double : corriger demande de retirer un mot. → Lorsque l'arme
- **L270** — « 1d dégâts supplémentaire » — Accord ambigu : « supplémentaire » se rapporte-t-il à « 1d » (singulier) ou à « dégâts » (pluriel) ? → 1d de dégâts supplémentaire / 1d dégâts supplémentaires
- **L292** — « à hauteur de 50% de dégâts qui inflige normalement » — Il manque le sujet de « inflige » (et « des » plutôt que « de ») : corriger demande d'ajouter ou de remplacer des mots. → à hauteur de 50% des dégâts qu'elle inflige normalement
- **L341** — « avec les sorts à la Terre » — Préposition : partout ailleurs « sorts de … » ; remplacer « à » par « de » change un mot. → avec les sorts de la Terre
- **L343** — « résistance au Foudre » — « foudre » est féminin (« sorts de foudre », « la foudre ») ; « à la Foudre » remplace un mot, sauf si la magie est voulue au masculin. → résistance à la Foudre
- **L344** — « résistance de la Lumière » — Préposition : les autres lignes disent « résistance à … » ; remplacer « de » par « à » change un mot. → résistance à la Lumière
- **L345** — « résistance de l'Ombre » — Préposition : les autres lignes disent « résistance à … » ; remplacer « de » par « à » change un mot. → résistance à l'Ombre

#### ressources/remede-surcharge

- **L1** — « dont le corps n’a pas pu encaisser » — « encaisser » est transitif direct : « dont » devrait être « que » (remplacement d'un mot). → que le corps n’a pas pu encaisser

#### sort.remarque

- **magies/magie-de-la-necromancie#sort:animation-de-mort** — « double de le coût précédent » — « de le » agrammatical (phrase présente deux fois dans la cellule) : corriger demande de retirer « de ». → double le coût précédent

## Sorts et magies (migration 0003)

Relecture de la migration `data/migrations/0003-orthographe-magies` (décision R10 : « à corriger, jamais un chiffre ni le sens d'une règle »). **500 corrections** ont été faites (registre complet : `data/migrations/0003-orthographe-magies.json`).
Les **188 points ci-dessous** n'ont **pas** été touchés, parce que les corriger demanderait d'ajouter ou de retirer un mot, de choisir entre deux lectures, de changer l'identifiant d'un sort ou parce que la graphie est peut-être un terme du jeu. Ils attendent ta décision (la règle d'or : on ne devine pas).

Les noms de sorts dont la correction aurait changé l'identifiant sont tranchés par 0006 (l'identifiant garde la clé d'origine) : Foudre argentée, Verrouillage Visible, Toucher du Vide,
Résurrection Noire, Vague de cadavres, Onde de Confusion, Lance-pierre, Estoc hurlant, Brume mentale, Colonne Tesla ; « Explosion glorifique » est gardé ; la créature
« Silhouetteur obscur » et l'invocation « Marionnette de l'ombre » sont corrigées aussi. Les points qui portaient sur ces noms (et sur « Folle de guerre », « Climatospetique »,
« tempête sable ») sont retirés de la liste.

Chaque entrée : endroit — passage — pourquoi on n'a pas corrigé — correction possible. Tu réponds « oui » (la suggestion), « non » (on garde) ou la graphie voulue ; la correction est alors une nouvelle migration de données.

### bestiaire/animation-des-morts

- **invocation** (`texte_general`) — « ils sont créés magiquement » — « les invocations n'ont pas… , ils sont créés » : le pronom reprend « invocations » (féminin) mais est au masculin ; l'auteur pense peut-être aux créatures/non-morts (masculin, cf. « il a la possibilité »). Même phrase dans les 3 invocations de ce fichier. → « elles sont créées magiquement » si le pronom reprend « invocations » ; sinon laisser.
- **invocation** (`texte_general`) — « les invocations n'ont pas de prérequis en termes d'environnement ou de matière, ils sont créés magiquement. » — « ils sont créés » reprend « les invocations » (féminin pluriel) ; l'accord strict donnerait « elles sont créées ». Mais « ils » peut désigner les êtres invoqués : sens incertain. Même phrase dans les trois textes d'invocation (animation-des-morts, appel-aux-golems, marionette-de-lombre). → « elles sont créées magiquement » si « ils » renvoie bien aux invocations ; sinon laisser.
- **invocation** (`texte_general`) — « (sauf le mode hyper de la nécromancie qui permet d'en avoir un deuxième) » — « en » reprend « invocation » (féminin) : « un deuxième » devrait être « une deuxième » ; mais l'auteur peut penser à la créature (masculin). → « une deuxième » si « en » = invocation ; même phrase dans les trois invocations de ce fichier.
- **invocation** (`texte_general`) — « Seule exception : le potentiel illimité ne peut pas faire d'invocation double élément » — « potentiel illimité » en minuscules alors que le nom de la magie s'écrit « Potentiel Illimité » (forme majoritaire dans les autres textes) ; même cas dans l'invocation « Appel aux golems ». Les noms de magies sont parfois en minuscules (« magie du sang »), d'où le doute. → « le Potentiel Illimité »

### bestiaire/appel-aux-golems

- **invocation** (`texte_general`) — « ils sont créés magiquement » — Même accord douteux « ils sont créés » après « les invocations » (féminin). → « elles sont créées magiquement » ou laisser (même décision que pour animation-des-morts).
- **invocation** (`texte_general`) — « influer sa propre magie » — « influer » existe mais n'a pas ce sens avec un complément direct ; le même texte écrit « infuser sa magie » plus bas. Remplacer un mot existant par un autre : à valider. → « infuser sa propre magie » (ou « insuffler »).
- **invocation** (`texte_general`) — « Boost la volonté » — « Boost » employé comme verbe conjugué (3e personne) ; pourrait être le libellé d'un effet de jeu invariable. → « Booste la volonté à 10 » si c'est bien un verbe.
- **invocation** (`texte_general`) — « les invocations n'ont pas de prérequis en termes d'environnement ou de matière, ils sont créés magiquement. » — Même phrase : « ils sont créés » renvoie à « les invocations » (féminin) ; lecture incertaine. → « elles sont créées magiquement » si le sujet est « les invocations ».
- **invocation** (`texte_general`) — « (sauf le mode hyper de la nécromancie qui permet d'en avoir un deuxième) » — Même phrase : « un deuxième » vs « une deuxième » (accord avec « invocation »). → « une deuxième » si « en » = invocation.
- **invocation** (`texte_general`) — « un allié peut très bien influer sa propre magie dans votre sort » — « influer » semble être une confusion avec « infuser » (employé dans la dernière phrase du même texte : « infuser sa magie »). Changement de mot, donc non appliqué. → « un allié peut très bien infuser sa propre magie dans votre sort »
- **invocation** (`texte_general`) — « - Inerte. Boost la volonté à 10 » — « Boost » conjugué à la 3e personne devrait être « Booste » ; peut être un libellé de règle volontairement abrégé. → « Booste la volonté à 10 »

### bestiaire/marionette-de-lombre

- **invocation** (`texte_general`) — « ils sont créés magiquement » — Même accord douteux « ils sont créés » après « les invocations » (féminin). → « elles sont créées magiquement » ou laisser (même décision que pour animation-des-morts).
- **invocation** (`texte_general`) — « en possède que 1 » — Négation incomplète (« ne » manquant) : corriger exige d'ajouter un mot. → « même si le lanceur n'en possède que 1 ».
- **invocation** (`texte_general`) — « les invocations n'ont pas de prérequis en termes d'environnement ou de matière, ils sont créés magiquement. » — Même phrase : « ils sont créés » renvoie à « les invocations » (féminin) ; lecture incertaine. → « elles sont créées magiquement » si le sujet est « les invocations ».
- **invocation** (`texte_general`) — « (sauf le mode hyper de la nécromancie qui permet d'en avoir un deuxième) » — Même phrase : « un deuxième » vs « une deuxième » (accord avec « invocation »). → « une deuxième » si « en » = invocation.
- **invocation** (`texte_general`) — « même si le lanceur en possède que 1 » — La négation « ne » manque (« n'en possède que 1 »). Ajouter un mot n'est pas permis. → « même si le lanceur n'en possède que 1 »

### légende des sorts

- **legende_sort** (`description`) — « Tour du joueur » — Majuscule à « Tour » en milieu de phrase (après un retour à la ligne) ; « tour » est en minuscule dans les autres textes, mais ici le retour à la ligne peut être voulu. → « tour du joueur » si la majuscule n'est pas intentionnelle.
- **legende_sort** (`description`) — « Le sort ne consomme pas le Tour du joueur (sauf échec crit) » — « Tour » prend une majuscule en milieu de phrase alors que « tour » est en minuscule partout ailleurs (« le tour 2 », « du premier tour »). Peut être un choix volontaire dans la légende. → « le tour du joueur » si la majuscule n'est pas voulue.

### magies (règles communes)

- **regle_magie regle:regle-speciale-pour-sort-niveau-5** (`texte`) — « il est sera contraint » — Deux verbes conjugués se suivent ; corriger exige de supprimer un mot (« est » ou « sera »), ce qui est interdit sans validation. → « mais il sera contraint de lancer le sort » (cohérent avec « mais perdra… » et le futur) ou « il est contraint ».
- **regle_magie regle:regle-speciale-pour-sort-niveau-5** (`texte`) — « mais il est sera contraint de lancer le sort » — Deux verbes conjugués se suivent (« est sera »). Corriger demande de supprimer un mot. → « mais il sera contraint de lancer le sort » (supprimer « est »), ou « il est contraint » (supprimer « sera »). Le contexte (futur) penche pour « il sera contraint ».

### magies/magie-de-la-corruption

- **magie** (`description`) — « des Elfes Charbons et des Felfes Noirs » — Noms de races : « Charbons » (pluriel) alors que la note d'incompatibilité écrit « Elfes noirs (Charbon) ». Majuscules aussi différentes (« Noirs » / « noirs »). → Vérifier le nom officiel des races (27 races) avant toute harmonisation.
- **magie** (`description_physique`) — « Les utilisateurs de la corruption sont marqués » — « corruption » en minuscule ; la description écrit « la Corruption » pour la magie. Mais « corruption » désigne aussi la réserve (minuscule voulue dans « explication »), donc non uniformisé sans validation. → « la Corruption » quand il s'agit de la magie ; minuscule pour la réserve de corruption.
- **magie** (`explication`) — « utilise énormément d'entrave » — Pluriel probable (« d'entraves ») mais le singulier peut être voulu (nom générique). Incertain. → utilise énormément d'entraves
- **magie** (`explication`) — « la transformation en abomination solvité » — « solvité » n'est pas un mot français connu (terme du jeu ou coquille ?). Impossible de deviner la forme voulue. → Vérifier dans la source du classeur ; ne rien changer sans confirmation. — **décidé (R141)** : « abomination », appliqué
- **magie** (`incompatibilite_note`) — « peuvent cette magie en innée/acquis avec une autre magie » — Il manque un verbe après « peuvent » (« utiliser » ?) et « innée/acquis » mélange féminin et masculin ; corrections = ajout de mot, donc non appliquées. → « peuvent utiliser cette magie en innée/acquise avec une autre magie »
- **magie** (`incompatibilite_note`) — « les Felfes noirs peuvent cette magie en innée/acquis avec une autre magie » — Il manque un verbe après « peuvent » (« avoir », « utiliser » ou « combiner ») ; le choix du verbe est incertain et ajouter un mot est interdit. → Soit « peuvent avoir cette magie », soit « peuvent utiliser cette magie » : au propriétaire de trancher.
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (même colonne) ; valeur « brute » peut-être utilisée comme clé de correspondance. → « Mono-magie » (aligné sur « Bi-magie »).
- **sort « grenade-collante »** (`effets`) — « (3NM = La grenade colle la cible) » — « colle la cible » : il manque probablement « à » (« colle à la cible »). Ajout d'un mot : non appliqué. → (3NM = La grenade colle à la cible)
- **sort « mine-noire »** (`remarque`) — « en posture vigilance » — Les noms de postures prennent la majuscule dans les D/S/B (« Bloque la posture Vigilance ») ; ici « vigilance » en minuscule. Terme de jeu : à valider. → en posture Vigilance
- **sort « mine-noire »** (`remarque`) — « en posture vigilance et seulement » — Le nom de posture s'écrit « Vigilance » (majuscule) dans « Bloque la posture Vigilance » (Verrouille Visible). Casse incohérente entre colonnes ; nom du vocabulaire du jeu. → en posture Vigilance (à valider)
- **sort « petrole »** (`dsb_brut`) — « le bonus initiative » — Il manque probablement « d' » (« bonus d'initiative »). Ajout d'un mot : non appliqué. → Divise par 2 la vitesse et le bonus d'initiative
- **sort « petrole »** (`dsb_brut`) — « Divise par 2 la vitesse et le bonus initiative » — Il manque probablement « d' » : « bonus d'initiative » (ajout de mot, non appliqué). → Divise par 2 la vitesse et le bonus d'initiative
- **sort « petrole »** (`remarque`) — « on est pas bloqué à vie » — Négation incomplète : « n' » manque (« on n'est pas bloqué »). Ajout d'un mot (« ne » élidé) : non appliqué. → on n'est pas bloqué à vie
- **sort « petrole »** (`remarque`) — « Bien entendu on est pas bloqué à vie » — Négation incomplète : « on est pas » devrait être « on n'est pas ». La correction exige d'ajouter « n' ». → Bien entendu on n'est pas bloqué à vie
- **sort « retrait »** (`dsb_brut`) — « 2d6 cr (+1d/NM) » — « cr » en minuscule alors que le sigle s'écrit « CR » partout ailleurs ; peut aussi être une unité écrite en minuscule comme « dégâts » dans « 2d6 dégâts ». → 2d6 CR (+1d/NM) — **décidé (R140)** : le sigle « CR », appliqué
- **sort « souffle-noir »** (`dsb_brut`) — « Retire du 2d10 de chakra à la cible » — « du » devant une expression de dés semble en trop (« Retire 2d10 de chakra »). Suppression d'un mot : non appliquée. → Retire 2d10 de chakra à la cible
- **sort « verrouillage-simple »** (`remarque`) — « il doit changer de posture de suite » — « de suite » est employé pour « tout de suite » (ajout d'un mot). Même phrase dans verrouille-visible, verrouillage-magique et verrouillage-physique. De plus « la cible » (féminin) est repris par « il ». → « tout de suite » (dans les 4 sorts de verrouillage) ; « il » inchangé car générique.

### magies/magie-de-la-foudre

- **magie** (`description_physique`) — « les yeux jaunes lors de l'utilisation d'un sort, de l’électricité parcourt en permanence leur corps » — Deux propositions juxtaposées par une simple virgule (virgule fautive) ; il manque une conjonction ou un point-virgule. Corriger exigerait d'ajouter un mot ou de changer la ponctuation sans certitude du sens voulu. → les yeux jaunes lors de l'utilisation d'un sort ; de l’électricité parcourt en permanence leur corps
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente entre les deux variantes (« Bi-magie » / « Mono-Magie »), identique dans les trois fichiers. Valeur « _brut » qui sert peut-être de clé de correspondance, et aucune forme n'est majoritaire dans la colonne. → « Mono-magie » (ou « Bi-Magie ») après vérification de l'usage de la valeur brute dans le code d'import.
- **sort « boules-de-foudre »** (`effets`) — « 1 boule (+1/NM) vont apparaître et vont s'approcher » — Sujet « 1 boule » au singulier mais verbes au pluriel ; plausible si le nombre de boules augmente avec le NM, donc pas corrigé. → « 1 boule (+1/NM) va apparaître et va s'approcher » si la formule vise le cas de base, ou « boule(s) » ; à valider.
- **sort « colonne-tesla »** (`remarque`) — « Para-tonnerre : Attire les sorts de la foudre » — Même terme que dans les effets : « paratonnerre » en un mot (voir l'entrée précédente). → Paratonnerre : Attire les sorts de la foudre
- **sort « foudre-rouge »** (`effets`) — « Inflige Paralysie 1 » — Casse incohérente des noms d'états : « Paralysie 1 » ici, mais « paralysie » en minuscule dans les autres sorts de la même magie (Éclair, Souffle électrique, Fulguration, Grenade paralysante). Peut être un nom d'état volontairement capitalisé (comme « Brûlure » dans la même cellule). → Inflige paralysie 1
- **sort « plaque-miroir »** (`effets`) — « 3 sorts qui le vise » — Le verbe « vise » est corrigé en « visent » (sujet « qui » = sorts), mais le pronom « le » est ambigu : il peut désigner le lanceur/la cible (singulier) ou les plaques (« les »). → Garder « le visent » si c'est le lanceur, ou « les visent » si ce sont les plaques.
- **sort « tazeur »** (`type_brut`) — « Attaque/ Entrave » — Espace après la barre oblique mais pas avant (asymétrique), systématique dans tout le fichier : Tazeur, Foudre Rouge, Orage Violet (« Attaque/ Entrave ») et Colonne tesla (« Amplification/ Entrave (IC pour 3 NM) »). Pas dans la liste des corrections permises, et l'import découpe peut-être sur « / ». → « Attaque/Entrave » (sans espace) pour toutes les occurrences, si l'import tolère les deux formes.

### magies/magie-de-la-glace

- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (l'autre variante), mais c'est probablement un libellé de clé : ne pas changer sans vérifier son usage. → Mono-magie (pour s'aligner sur « Bi-magie »)
- **sort « cuirasse-arctique »** (`effets`) — « Peut se cumuler avec Peau Verglacée. » — Casse incohérente avec le nom du sort « Peau verglacée » (colonne nom) et avec « Cuirasse arctique » cité dans l'effet de Peau verglacée. Je ne suis pas sûr que la majuscule à « Verglacée » soit une faute plutôt qu'un choix de saisie. → Peut se cumuler avec Peau verglacée.
- **sort « eclat-glace »** (`effets`) — « Une simple attaque de Glace. » — Casse de « Glace » variable dans la colonne : majuscule ici et dans Grenade cryogénique (« zone de Glace »), minuscule dans « élément glace », « dégâts de glace », « attaque surpuissante de glace ». Pas de forme majoritaire nette. → Uniformiser (majuscule pour l'élément, ou minuscule partout) selon le choix du propriétaire.
- **sort « execution-froide »** (`remarque`) — « vigueur, etc... le mj a le choix. » — Après « etc... », « le mj » commence probablement une nouvelle phrase : majuscule attendue. Le sigle « mj » serait aussi à mettre en « MJ ». Incertain, car les points de suspension pourraient marquer une simple pause. → vigueur, etc... Le MJ a le choix.
- **sort « gel-profond »** (`effets`) — « des altérations d'états » — Partout ailleurs l'expression est « altération d'état » (singulier) ; « d'états » est peut-être une faute mais le sens (états multiples) reste possible. → des altérations d'état
- **sort « gel-profond »** (`effets`) — « ou des altérations d'états. » — Le terme de jeu s'écrit « altération(s) d'état » partout ailleurs (ex. Eau Parfaite : « altérations d'état »). « d'états » est possible en français général, donc non corrigé avec certitude. → ou des altérations d'état.
- **sort « lien-de-gel »** (`remarque`) — « Le lien gel touche la cible » — Il manque « de » (« Le lien de gel »), partout ailleurs dans le texte. Il faut ajouter un mot, donc non appliqué. → Le lien de gel touche la cible
- **sort « pergelisol »** (`effets`) — « Augmente la résistance au Feu et au Vent de 1 cran. » — Incohérence de valeur, pas une faute de langue : la colonne D/S/B annonce « +2 cran(s) de résistance » alors que les effets disent « de 1 cran ». Règle de jeu, donc non touchée. → Vérifier la valeur (+2 ou 1 cran) dans la source du sort.
- **sort « tir-de-givre »** (`type_brut`) — « Attaque/ Entrave » — Espace après la barre oblique et pas avant, motif répété (Prison boréale, Grenade cryogénique, Frappe de Celsius) ; probablement hérité du classeur, donc non modifié. → Attaque/Entrave, à appliquer uniformément si le propriétaire le souhaite.

### magies/magie-de-la-lumiere

- **magie** (`description_physique`) — « Les utilisateurs de la Lumière ont des cheveux » — Casse incohérente : « Lumière » avec majuscule, alors que le même texte et les autres magies (foudre, ombre) écrivent « la lumière » en minuscule. Pourrait être voulu (nom de la déesse). → Les utilisateurs de la lumière ont des cheveux
- **mode hyper (bi)** (`effet`) — « (seulement le premier IC). (sauf les sorts niveau de puissance 5). » — Parenthèse en minuscule juste après un point (majuscule attendue si c'est une phrase) et point final hors de la parenthèse ; « sorts niveau de puissance 5 » semble sans « de » (« sorts de niveau de puissance 5 »), mais ajouter un mot est interdit. Même structure dans la magie de l'ombre (bi). → « (seulement le premier IC) (sauf les sorts de niveau de puissance 5). » ou « … IC). (Sauf les sorts de niveau de puissance 5.) » : à trancher par le propriétaire.
- **mode hyper (bi)** (`effet`) — « IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). » — Point suivi d'une parenthèse commençant par une minuscule : soit majuscule, soit suppression du point (à décider). Même motif dans la magie de l'ombre. → IC (seulement le premier IC). (Sauf les sorts niveau de puissance 5).
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Même incohérence de casse « Bi-magie » / « Mono-Magie » (valeur brute, sans forme majoritaire). → « Mono-magie » (ou « Bi-Magie »), à décider une fois pour toutes les magies.
- **sort « champ-de-force »** (`remarque`) — « avec 20 chakra maximum » — Pluriel après un nombre (« 20 chakras ») ? « chakra » est du vocabulaire de jeu, parfois invariable comme ressource (« +2 dégâts/chakra »). → « 20 chakras maximum » si le pluriel est voulu ; sinon laisser.
- **sort « flash »** (`type_brut`) — « Attaque/ Entrave » — Même espace asymétrique après la barre oblique, aussi dans Poussière d'étoile (« Attaque/ Entrave\n(Imparable) »). → « Attaque/Entrave » (sans espace), si l'import tolère les deux formes.

### magies/magie-de-la-necromancie

- **amelioration_cadaverique amelioration:zombi** (`effet`) — « Rés Nécromancie » — Abréviation de « Résistance » écrite « Rés » ici et « Res » (sans accent) dans les 10 autres améliorations. Forme à harmoniser, mais il s'agit d'une abréviation de jeu : à trancher. → Harmoniser en « Res Nécromancie » (forme majoritaire) ou en « Rés » partout
- **amelioration_cadaverique amelioration:zombi** (`effet`) — « +6 AP, +8 dégâts, Rés Nécromancie » — L'abréviation « Rés » (avec accent) est incohérente avec « Res » (sans accent) utilisée dans les 9 autres améliorations (Res Feu, Res Vide, Res Eau…). Les deux formes sont défendables ; laquelle est la forme du jeu n'est pas certain. → Uniformiser en « Res Nécromancie » (forme majoritaire) ou en « Rés » partout
- **magie** (`barre4_texte`) — « la 4ème barre » — « 4ème » est toléré mais l'abréviation recommandée est « 4e ». Préférence typographique, non appliquée. → la 4e barre
- **magie** (`barre4_texte`) — « un maximum de 10 Âmes et » — « Âmes » avec majuscule alors que « âme(s) » est en minuscule partout ailleurs (coûts, sorts). Peut être un nom de ressource voulu ; non certain. → « 10 âmes » si ce n'est pas un nom de ressource volontaire
- **mode hyper (mono)** (`effet`) — « Passe le sort animation de mort en IC » — Nom de sort écrit en minuscules (« animation de mort »), alors que le sort s'appelle « Animation de mort » ; correction de casse d'un nom propre de sort, non appliquée par prudence. → « Passe le sort Animation de mort en IC ».
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (même colonne, même motif). Les deux formes sont une seule occurrence chacune, donc pas de majorité ; la valeur sert probablement de clé de variante (les deux fichiers ont les mêmes valeurs). → « Mono-magie » pour s'aligner sur « Bi-magie », à condition que le code qui lit cette valeur soit adapté ; sinon laisser.
- **sort « animation-de-mort »** (`remarque`) — « double de le coût précédent pour l'invoquer » — « de le » est une contraction manquante (« du »), mais « double du coût précédent » est incorrect avec « double » verbe : la phrase demande de supprimer « de » (« double le coût ») ou de la réécrire (« est le double du coût »). Supprimer ou ajouter un mot est interdit. Cette phrase apparaît deux fois dans la remarque (doublon). → « double le coût précédent pour l'invoquer » (suppression de « de »).
- **sort « animation-de-mort »** (`remarque`) — « Chaque niveau de puissance de la créature invoquée double de le coût précédent pour l'invoquer. » — « double de le coût » est agrammatical (la phrase figure deux fois dans la remarque). La correction exige de remplacer deux mots par un seul (« de le » -> « du ») ou de reformuler (« double le coût »), ce qui retire un mot. → « double le coût précédent » (ou « double du coût précédent »), à appliquer aux deux occurrences de la phrase
- **sort « calin-putrefie »** (`effets`) — « Invoque un zombie qui va tomber sur l'adversaire. » — Graphie « zombie » alors que le reste du fichier emploie « zombi / zombis » (description, noms d'améliorations). Les deux graphies existent en français ; ce n'est pas une faute certaine. → « zombi » pour harmoniser avec le reste, si le propriétaire le souhaite
- **sort « corruption-dame »** (`type_brut`) — « Attaque/ Entrave » — Espace après la barre oblique mais pas avant. Même motif dans plusieurs sorts (valeur peut-être analysée par le code). Non modifié. → Attaque/Entrave (si la valeur n'est pas analysée sur « / »)
- **sort « dechirure »** (`effets`) — « inflige de gros dégâts, Si jet de vigueur raté » — Majuscule après une virgule. Deux corrections plausibles : point (« dégâts. Si ») ou minuscule (« dégâts, si »). → « inflige de gros dégâts. Si jet de vigueur raté = Inflige poison 2. » (schéma des autres sorts).
- **sort « dechirure »** (`effets`) — « inflige de gros dégâts, Si jet de vigueur raté = Inflige poison 2. » — Majuscule après une virgule (« , Si »). Deux corrections plausibles : « , si » ou « . Si ». Même schéma systématique dans d'autres cellules (« Res Eau, Double », « braise faible, Coup critique »), qui peut être voulu. → « inflige de gros dégâts. Si jet de vigueur raté = Inflige poison 2. » ou « , si … » ; à décider une fois pour tout le schéma
- **sort « detection-de-vie »** (`remarque`) — « Attention un simple mur empêche de voir à travers ce dernier. » — Ponctuation manquante après « Attention » : deux signes plausibles (deux-points ou virgule), ajout non appliqué car ambigu. → Attention : un simple mur empêche de voir à travers ce dernier. (ou « Attention, un simple mur… »)
- **sort « detection-de-vie »** (`remarque`) — « Attention un simple mur empêche de voir » — Ponctuation manquante après « Attention » ; deux corrections plausibles (deux-points ou virgule). → « Attention : un simple mur empêche de voir à travers ce dernier. »
- **sort « detection-de-vie »** (`remarque`) — « d'herbe.   Attention un simple mur empêche de voir à travers ce dernier. » — Virgule ou deux-points probablement attendus après « Attention » (interjection en tête de phrase), mais le choix de la ponctuation n'est pas certain. Il y a aussi une espace en fin de ligne avant le saut de paragraphe, sans conséquence visible. → « Attention, un simple mur… » (ou « Attention : un simple mur… ») ; supprimer l'espace avant « \n\n »
- **sort « forces-des-ames »** (`effets`) — « grâce à deux âmes pour le prochain coup. (Maxi 5 âmes d'un coup) » — Pas une faute de frappe mais une incohérence de contenu à vérifier : le coût est « 1 âme pour +3 dégâts » alors que le texte parle de « deux âmes ». Aucun chiffre modifié. → Laisser tel quel ; faire vérifier par le propriétaire.
- **sort « forge-de-ses-morts »** (`remarque`) — « Peut toucher l'immatériel et ignore les PA. » — Le sigle « PA » (2e paragraphe, doublon du 1er) est probablement une permutation de « AP », utilisé dans le 1er paragraphe et partout ailleurs. Les sigles de jeu sont à laisser tels quels sauf validation. → « ignore les AP » (comme le 1er paragraphe)
- **sort « pieu-dos »** (`effets`) — « Invoque de pieu depuis le sol. » — « de pieu » est fautif, mais deux corrections sont plausibles (« un pieu » ou « des pieux », la zone étant un cercle de 2). Le choix change le sens. → « Invoque des pieux depuis le sol. » ou « Invoque un pieu depuis le sol. » (à trancher par le propriétaire)
- **sort « prison-dos »** (`remarque`) — « est Invulnérable à l'estoc, Résistant à la taille mais vulnérable à la frappe. » — Casse incohérente dans la même phrase : « Invulnérable » et « Résistant » avec majuscule, « vulnérable » en minuscule. Ce sont peut-être des noms d'états du jeu. → « invulnérable… résistant… vulnérable » tout en minuscules, sauf si ce sont des états à majuscule
- **sort « prison-dos »** (`remarque`) — « Invulnérable à l'estoc, Résistant à la taille mais vulnérable à la frappe » — Casse incohérente dans la même phrase : « Invulnérable » et « Résistant » en capitale, « vulnérable » en minuscule. Ce sont probablement des noms d'états/propriétés, mais on ne peut pas trancher entre mettre la capitale ou l'enlever partout. → « Vulnérable » avec capitale (comme « Invulnérable » et « Résistant »), ou tout en minuscules.
- **sort « repar-os »** (`effets`) — « Permet de soigner les os et chair. » — Il manque probablement l'article « la » devant « chair » ; ajouter un mot est interdit. → « Permet de soigner les os et la chair. »

### magies/magie-de-la-terre

- **magie** (`description_physique`) — « une musculature plus haute que la moyenne » — « plus haute » s'accorde soit avec « musculature » seule (correct tel quel), soit avec « des tailles et une musculature » (alors « plus hautes ») : le sens exact est incertain. → Laisser tel quel, ou « plus hautes » si l'adjectif porte aussi sur « des tailles ».
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse différente de « Bi-magie » (même colonne). La même paire existe dans les deux fichiers, donc probablement une convention d'import. À valider globalement. → Mono-magie (ou « Bi-Magie »)
- **sort « alourdissement »** (`type_brut`) — « Amplification/ Entrave (IC pour 3 NM) » — Espace après la barre oblique, alors que « Soin/Entrave » n'en a pas dans le même fichier. C'est cohérent avec le fichier Vent (« Attaque/ Placement »), donc probablement une convention de la feuille, laissé tel quel. → Amplification/Entrave (IC pour 3 NM), à décider globalement
- **sort « appel-aux-golems »** (`remarque`) — « double de le coût précédent » — « de le » est fautif. Il faut supprimer « de » (« double le coût précédent »), ce qui retire un mot. Remplacer par « du » serait possible mais moins naturel. → double le coût précédent
- **sort « appel-aux-golems »** (`remarque`) — « Pour voir les golems possible » — Phrase tronquée (probable lien ou liste perdu à l'import de la cellule), sans complément ni ponctuation finale. → Vérifier la cellule source ; ne pas compléter sans la source.
- **sort « barriere-rocheuse »** (`remarque`) — « Corps de pierre : Double les PA, diminue » — « PA » est peut-être une permutation de « AP » (armure physique), sigle employé partout ailleurs ; sigle non corrigé d'office. → Double les AP
- **sort « barriere-rocheuse »** (`remarque`) — « mais ils doivent avoir été lancés avant. » — Le pronom renvoie à « Armure de roche et peau de pierre » (féminin) mais peut aussi désigner « les sorts » (masculin) : changement de mot et sens incertain. → mais elles doivent avoir été lancées avant.
- **sort « barriere-rocheuse »** (`remarque`) — « mais ils doivent avoir été lancés avant » — « ils … lancés » est correct si le pronom renvoie à « des sorts », mais devrait être « elles … lancées » s'il renvoie à « Armure de roche et peau de pierre » (féminin). → Laisser, ou « elles doivent avoir été lancées avant » selon le sens voulu.
- **sort « barriere-rocheuse »** (`remarque`) — « Corps de pierre : Double les PA, » — « PA » est une permutation probable du sigle « AP » (armure physique), utilisé partout ailleurs. C'est un sigle de jeu, donc non touché. → Double les AP,
- **sort « explosion-rocheuse »** (`effets`) — « Une attaque de Terre de Zone. » — « Zone » en majuscule alors que « zone » est en minuscule ailleurs (« dégâts de zone de Terre », « dans la zone »). Terme de règle possible, donc incertain. → Une attaque de Terre de zone.
- **sort « fer-raffine »** (`effets`) — « tape dans l'élément terre pendant 3 tours » — Même incohérence de casse : « Terre » est capitalisé dans « attaque de Terre » et « dégâts de zone de Terre », mais ici « terre ». → tape dans l'élément Terre pendant 3 tours
- **sort « peau-de-pierre »** (`remarque`) — « Peut se cumuler avec Armure de Roche. » — Le sort cité est « Cuirasse de roche » (voir effets du même sort). « Armure de Roche » (aussi dans la remarque de Barrière rocheuse) est un autre mot, pas une coquille, donc non corrigé. À vérifier avec la source. → Peut se cumuler avec Cuirasse de roche.
- **sort « racine-soignante »** (`effets`) — « doit être dans environnement lié à la terre pour fonctionner » — Article manquant devant « environnement » (ajout d'un mot). Point final absent aussi. → doit être dans un environnement lié à la terre pour fonctionner.
- **sort « rouille »** (`effets`) — « retirer un cran solidité à un morceau » — « de » manquant (« un cran de solidité ») : ajout d'un mot. → retirer un cran de solidité à un morceau
- **sort « rouille »** (`effets`) — « retirer un cran solidité à un morceau d’armure ou une arme » — Mots manquants probables : « un cran de solidité » et « ou à une arme ». Peut aussi être un raccourci de jeu volontaire. → « un cran de solidité à un morceau d’armure ou à une arme »
- **sort « rouille »** (`effets`) — « retirer un cran solidité à un morceau d’armure » — Préposition manquante entre « cran » et « solidité » (ajout d'un mot). → retirer un cran de solidité à un morceau d’armure

### magies/magie-de-larcane

- **magie** (`description_physique`) — « Les utilisateurs de l'arcane sont marqués » — « arcane » en minuscule alors que la description de la même magie écrit « l’Arcane » (nom de la magie, majuscule). → « l'Arcane », si le nom de la magie prend toujours la majuscule.
- **mode hyper (bi)** (`effet`) — « (seulement le premier IC). (sauf les sorts niveau de puissance 5). » — Une parenthèse commençant par une minuscule après un point : soit supprimer le point (« IC) (sauf… »), soit mettre « Sauf » en majuscule. Deux corrections plausibles. → Soit « (seulement le premier IC) (sauf les sorts niveau de puissance 5). », soit « (seulement le premier IC). (Sauf les sorts niveau de puissance 5). »
- **mode hyper (mono)** (`effet`) — « Les sorts amplifications deviennent des IC » — « sorts amplifications » : il manque probablement « d' » (« sorts d'amplification »). La correction exige d'ajouter un mot. → Les sorts d'amplification deviennent des IC
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (même colonne, autre ligne). Valeur « brute » qui sert peut-être de clé : pas de forme majoritaire à retenir. → Choisir « Bi-magie » / « Mono-magie » ou « Bi-Magie » / « Mono-Magie » partout, après vérification que la valeur n'est pas utilisée comme clé (même cas dans le fichier de la Corruption).
- **sort « champ-gardien »** (`dsb_brut`) — « Donne 2d6 + 3 Barrière et 12 dégâts » — « Barrière » avec majuscule alors que partout ailleurs le mot est en minuscule (« barrière »). Peut être une convention de style (« Donne X Chakra »). → Éventuellement « barrière » ; laissé tel quel faute de certitude.
- **sort « charge-denergie »** (`cout_brut`) — « 2=1 dégâts » — Pluriel après « 1 » (« 1 dégât »). Cellule de coût : je ne la modifie pas sans validation. → 2=1 dégât
- **sort « grenade-de-chakra »** (`effets`) — « Inflige des dégâts en Zone. » — « Zone » avec majuscule en milieu de phrase ; ailleurs « dégâts de zone » est en minuscule. Peut être un terme de jeu, d'où la validation. → Inflige des dégâts en zone.
- **sort « rune-arcane »** (`remarque`) — « Ne se cumule avec "Rune Arcane multiple" » — Négation incomplète : il manque « pas » (« Ne se cumule pas avec »). La correction exige d'ajouter un mot. → Ne se cumule pas avec "Rune Arcane multiple"
- **sort « rune-arcane-multiple »** (`remarque`) — « Ne se cumule avec "Rune Arcane" » — Négation incomplète : il manque « pas » (« Ne se cumule pas avec »). La correction exige d'ajouter un mot. → Ne se cumule pas avec "Rune Arcane"
- **sort « voile-chakratique »** (`effets`) — « le rôle de la Santé. Le coût en santé passe à 10% » — « Santé » / « santé » : casse incohérente dans le même texte ; peut aussi désigner une caractéristique du jeu. → Harmoniser (probablement « santé » ou « Santé » partout) après vérification du lexique du jeu.

### magies/magie-de-leau

- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (l'autre variante), mais c'est probablement un libellé de clé : ne pas changer sans vérifier son usage. → Mono-magie (pour s'aligner sur « Bi-magie »)
- **sort « courant-salvateur »** (`effets`) — « Place un un courant d'eau » — Mot doublé (« un un »). La correction supprime un mot entier, ce qui n'est pas permis sans validation. → Place un courant d'eau
- **sort « courant-salvateur »** (`effets`) — « de 1(+1/NM) cases » — Espace manquante avant la parenthèse, partout ailleurs « (+1/NM) » est précédé d'une espace. Touche à une expression chiffrée (progression par NM), donc laissé tel quel par prudence. → de 1 (+1/NM) cases
- **sort « crachat-acide »** (`effets`) — « retirer un cran solidité à un morceau d’armure » — Mot manquant (« de ») : l'ajouter n'est pas autorisé. → « retirer un cran de solidité à un morceau d’armure »
- **sort « crachat-acide »** (`effets`) — « retirer un cran solidité » — Mot manquant : « un cran solidité » appelle « de » ; ajouter un mot n'est pas permis en correction automatique. → retirer un cran de solidité
- **sort « eau-soignante »** (`effets`) — « les Dés passent à 8 » — « Dés » avec une majuscule en milieu de phrase ; peut être un terme de jeu voulu, donc non corrigé (seule la virgule manquante est proposée). → les dés passent à 8
- **sort « fouet-deau »** (`effets`) — « de gros dégâts au adversaire » — « au adversaire » est fautif, mais deux corrections sont plausibles (singulier ou pluriel) et le sens est incertain. → « à l'adversaire » ou « aux adversaires » (cf. « tranche les adversaires » dans Lame sous pression) : à trancher par le propriétaire.
- **sort « fouet-deau »** (`effets`) — « inflige de gros dégâts au adversaire » — « au adversaire » est fautif : « au » ne se met pas devant une voyelle. Deux corrections plausibles (singulier ou pluriel), donc non appliquée. → « aux adversaires » (cohérent avec « tranche les adversaires » de Lame sous pression) ou « à l'adversaire »
- **sort « ruisseau-conciliant »** (`effets`) — « Des petits courants d'eau » — Règle stricte : « de » devant un adjectif pluriel antéposé. L'usage courant admet « des petits », donc pas de correction automatique. → De petits courants d'eau (optionnel)
- **sort « souffle-hydraulique »** (`type_brut`) — « Attaque/ Entrave (Imparable) » — Espace après la barre oblique et pas avant (« Attaque/ Entrave »), motif répété dans Crachat Acide, Grenade Incapacitante, Laser Hydraulique ; probablement hérité du classeur (saut de ligne), donc non modifié. → Attaque/Entrave (Imparable), à appliquer uniformément si le propriétaire le souhaite.
- **sort « tir-de-flotte »** (`effets`) — « Une attaque d'eau qui se tire » — Casse incohérente : « Une attaque d'Eau » (Bulle d'eau, Laser Hydraulique) et « dégâts de zone d'Eau » (Grenade) portent une majuscule pour l'élément, ici minuscule. Peut aussi être volontaire (eau = substance). → Une attaque d'Eau qui se tire (si l'élément prend toujours une majuscule)

### magies/magie-de-lespace-temps

- **mode hyper (bi)** (`variante_brut`) — « Bi-magie » — Casse incohérente avec « Mono-Magie » (même colonne, même mot « magie », une fois en minuscule, une fois en majuscule). Une occurrence de chaque dans ce fichier, donc pas de forme majoritaire ; probablement une valeur produite par l'import. → Harmoniser en « Bi-Magie » / « Mono-Magie » ou « Bi-magie » / « Mono-magie » dans toute la base.
- **sort « faille-temporelle »** (`effets`) — « [Se combine avec une attaque distance] » — « attaque distance » : il manque probablement « à » (ajout d'un mot), sauf si « Distance » est une catégorie d'attaque du jeu. → « attaque à distance » si ce n'est pas un terme de jeu.
- **sort « frappe-temporelle »** (`effets`) — « une main géante en bandelette » — « bandelette » est peut-être un pluriel oublié (les bandages de momie de la magie), mais le singulier peut être voulu (« en forme de bandelette »). → une main géante en bandelettes (si le pluriel est voulu)
- **sort « frappe-temporelle »** (`effets`) — « Invoque une main géante en bandelette, téléporte la cible » — « en bandelette » : singulier ou pluriel (bandelettes) ? Sens incertain. → « en bandelettes » si la main est faite de plusieurs bandes (cohérent avec les « bandages » de la description) ; à valider.
- **sort « horloge-aspirante »** (`type_brut`) — « Attaque/Soin » — Le séparateur « / » est écrit sans espace ici, alors que les autres types composés du fichier l'ont avec espace (« Attaque/ Placement », « Amplification/ Entrave (IC) », « Placement/ Attaque »). Incohérence de forme, mais la forme avec espace semble venir du classeur : à ne pas toucher sans décision. → Attaque/ Soin si l'on harmonise sur la forme majoritaire, sinon ne rien changer
- **sort « image-diffuse »** (`remarque`) — « Si un clone prend un coup, il disparait. » — « disparait » sans accent circonflexe. C'est valide selon la réforme de 1990, mais le reste des textes suit l'orthographe traditionnelle (« maîtrise », « dégâts »). Pure préférence, donc non appliqué. → il disparaît
- **sort « portail »** (`remarque`) — « pas de jet est nécessaire » — Négation incomplète : « n' » manque devant « est » (la phrase dit l'inverse de ce qui est voulu). Corriger exige d'ajouter un mot, donc non appliqué. → pas de jet n'est nécessaire (ou « aucun jet n'est nécessaire »)
- **sort « portail »** (`remarque`) — « pour retirer un portail, pas de jet est nécessaire mais il faut consommer la moitié du chakra. » — « pas de jet est nécessaire » : il manque la particule « n' » devant « est » (ajout d'un mot, non appliqué). → « pas de jet n'est nécessaire » (ou « aucun jet n'est nécessaire »).
- **sort « portail »** (`remarque`) — « pour retirer un portail, pas de jet est nécessaire mais » — La négation est incomplète (« pas de jet est nécessaire »). La corriger demande d'ajouter « n' » (ou de changer de tournure), ce qui ajoute un mot. → pas de jet n'est nécessaire (ou « aucun jet n'est nécessaire »)
- **sort « teleport-parfait »** (`portee_brut`) — « 20Km (+20/NM) » — Unité : « Km » avec majuscule ; le symbole du kilomètre est « km ». Les unités sont hors périmètre. → « 20km (+20/NM) » (ou « 20 km »), si le propriétaire le souhaite.

### magies/magie-de-lombre

- **magie** (`description_physique`) — « émane de leur main et pied » — Nombre incertain : « leur main et pied » (une main et un pied par personne) ou « leurs mains et pieds ». Corriger exigerait peut-être d'ajouter un mot. → « de leurs mains et pieds » ou « de leur main et de leur pied ».
- **magie** (`description_physique`) — « des bracelets faits d'ombre violettes » — « violettes » (féminin pluriel) ne s'accorde pas avec « ombre » (singulier). Deux corrections plausibles : « ombre violette » ou « ombres violettes ». → des bracelets faits d'ombre violette
- **mode hyper (bi)** (`effet`) — « (seulement le premier IC). (sauf les sorts niveau de puissance 5). » — Même structure que dans la magie de la lumière : parenthèse en minuscule après un point, et « niveau de puissance 5 » sans « de » devant « niveau » (ajout interdit). → « (seulement le premier IC) (sauf les sorts de niveau de puissance 5). » ou majuscule « (Sauf … 5.) » : à trancher.
- **mode hyper (bi)** (`effet`) — « IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). » — Point suivi d'une parenthèse commençant par une minuscule : soit majuscule, soit suppression du point (à décider). Même motif dans la magie de la lumière. → IC (seulement le premier IC). (Sauf les sorts niveau de puissance 5).
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Même incohérence de casse « Bi-magie » / « Mono-Magie » (valeur brute, sans forme majoritaire). → « Mono-magie » (ou « Bi-Magie »), à décider une fois pour toutes les magies.
- **sort « brume-mental »** (`effets`) — « Met une croix dans 1 une caractéristique » — « 1 une » : chiffre et article accolés (doublon). Supprimer l'un des deux reviendrait à retirer un mot ou un chiffre, ce qui est interdit. → « Met une croix dans une caractéristique » (le « 1 » semble un résidu de saisie) ou « dans 1 caractéristique ».
- **sort « brume-mental »** (`effets`) — « Met une croix dans 1 une caractéristique au choix de l’adversaire » — « 1 » et « une » se suivent (doublon). Supprimer l'un des deux mots n'est pas autorisé et le choix n'est pas certain. → Met une croix dans 1 caractéristique au choix de l’adversaire (ou « dans une caractéristique »)
- **sort « chaine-de-lentrave »** (`remarque`) — « si ce n'est tenter un jet » — « si ce n'est tenter » : il manque « de » (« si ce n'est de tenter »). Ajout de mot interdit. → « si ce n'est de tenter un jet ».
- **sort « lame-dombre »** (`effets`) — « Créer 1 (+1/NM) lame(s) » — Tous les autres effets commencent par un verbe conjugué à la 3e personne (Invoque, Donne, Inflige…) ; « Créer » est probablement « Crée », mais l'infinitif peut être voulu. → « Crée 1 (+1/NM) lame(s) ».
- **sort « lame-dombre »** (`effets`) — « Créer 1 (+1/NM) lame(s) autour du lanceur » — Tous les effets de la colonne sont à la 3e personne du présent (Donne, Permet, Inflige, Invoque...) ; « Créer » est probablement « Crée », mais l'infinitif pourrait être volontaire. → Crée 1 (+1/NM) lame(s) autour du lanceur
- **sort « manteau-noir »** (`cout_brut`) — « 7 (xNP de créature) » — « xNP » alors que le sort Marionnette de l'ombre écrit « xNPM de créature » : coquille possible, mais c'est un sigle dans un coût (non modifié par prudence). → 7 (xNPM de créature)
- **sort « perturbation »** (`type_brut`) — « Attaque/ Entrave (Imparable) » — Même espace asymétrique après la barre oblique, aussi dans Cri ébranleur (« Attaque/ Entrave (Imparable) »), Lame d'ombre (« Attaque/ Amplification »), Grenade Fumigène et Frappe Négative (« Attaque/ Entrave »). → « Attaque/Entrave » (sans espace), si l'import tolère les deux formes.
- **sort « pire-ami »** (`effets`) — « et va attaquer qu'elle » — Négation restrictive incomplète : « ne » manque (« ne ... qu'elle »). Corriger exige d'ajouter un mot. → et ne va attaquer qu'elle

### magies/magie-du-feu

- **magie** (`description_physique`) — « mèches rouges vif » — Adjectif de couleur composé : « rouge vif » est normalement invariable, mais certains accordent (« rouges vifs »). Deux corrections plausibles. → mèches rouge vif
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente avec « Bi-magie » (même colonne, mêmes valeurs que dans l'autre fichier) ; pas de majorité, et valeur probablement utilisée comme clé. → « Mono-magie » pour s'aligner sur « Bi-magie » si le code qui lit cette valeur est adapté ; sinon laisser.
- **sort « bouffee-infernale »** (`effets`) — « craché par la gueule. , 10% de chance » — Ponctuation doublée « . , » : il faut supprimer soit le point, soit la virgule, et le choix change le sens de la phrase. → « craché par la gueule, 10% de chance d'infliger brûlure 1. » (même tournure que « Res Feu, 25% de chance… ») ou « …gueule. 10% de chance… ».
- **sort « bouffee-infernale »** (`effets`) — « craché par la gueule. , 10% de chance d'infliger brûlure 1. » — Espace avant la virgule et virgule isolée après un point (« . , »), reste probable d'un mot supprimé. Deux corrections plausibles (« gueule, 10 % … » en supprimant le point, ou « gueule. 10 % … » en supprimant la virgule), et un mot manque peut-être. → « Un vrai lance-flamme craché par la gueule, 10% de chance d'infliger brûlure 1. » ou version avec le point ; à trancher
- **sort « bouffee-infernale »** (`effets`) — « Un vrai lance-flamme craché par la gueule. » — « lance-flamme » : la forme classique est « lance-flammes » (invariable), la forme « lance-flamme » étant admise par la réforme de 1990. Non certain. → « lance-flammes » (forme traditionnelle)
- **sort « braise-magique »** (`effets`) — « braise faible, Coup critique = inflige » — Virgule suivie d'une majuscule : la virgule devrait être un point (ou « Coup » une minuscule). Deux corrections plausibles. → braise faible. Coup critique = inflige
- **sort « braise-magique »** (`effets`) — « avec une braise faible, Coup critique = inflige » — Majuscule après une virgule. Deux corrections plausibles : point avant « Coup critique » ou minuscule. → « avec une braise faible. Coup critique = inflige brûlure 1. »
- **sort « braise-magique »** (`effets`) — « avec une braise faible, Coup critique = inflige brûlure 1. » — Majuscule après virgule (« , Coup »). Même schéma que « , Si » ou « , Double » dans d'autres cellules, qui semble systématique et peut être voulu ; deux corrections plausibles (minuscule ou point). → « , coup critique = inflige brûlure 1. » ou « . Coup critique = … » ; à décider avec le schéma global
- **sort « braise-magique »** (`type_brut`) — « Attaque/ Entrave (Imparable) » — Espace après la barre oblique mais pas avant (même motif dans Étincelle et Grenade incendiaire). Valeur peut-être analysée par le code : non modifié. → Attaque/Entrave (Imparable) (si la valeur n'est pas analysée sur « / »)
- **sort « frappe-rageuse »** (`effets`) — « Envoie une violente vague de flamme. » — « vague de flamme » au singulier est peu naturel (« vague de flammes »), mais ce n'est pas une faute certaine. → « Envoie une violente vague de flammes. » si validé.
- **sort « marcheur-exalte »** (`effets`) — « mais impossible de porter une armure » — Il manque probablement « il est » avant « impossible » ; ajouter des mots est interdit. → « mais il est impossible de porter une armure à cet endroit temporairement ».

### magies/magie-du-sang

- **magie** (`description_physique`) — « La magie du Sang marque beaucoup sur la taille » — « Sang » avec majuscule alors que les autres textes de la magie écrivent « magie du sang » en minuscules (description, résumé) ; titre de page « Magie du Sang ». → « La magie du sang » pour harmoniser, ou laisser si le nom propre est voulu.
- **mode hyper (bi)** (`variante_brut`) — « Bi-magie » — Casse incohérente de « magie » dans la même colonne : « Bi-magie » (ici) et « Mono-Magie » (onglet_magie:magies/magie-du-sang:mono). La forme majoritaire sur toute la table n'est pas visible dans cette tranche. → Harmoniser avec la forme majoritaire de variante_brut (« Mono-Magie » / « Bi-Magie » ou « Mono-magie » / « Bi-magie »).
- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse incohérente entre les deux variantes de la colonne : « Bi-magie » (id ...:bi) et « Mono-Magie » (id ...:mono). La forme majoritaire dans toute la colonne n'est pas visible depuis ce fichier. → Aligner sur la forme majoritaire de la colonne variante_brut : « Mono-magie »/« Bi-magie » ou « Mono-Magie »/« Bi-Magie ».
- **sort « annulation »** (`type_brut`) — « Entrave/ Soin » — Espace après la barre oblique mais pas avant ; incohérent avec « Attaque/Soin » (morsure-aspirante). Même cas pour « Attaque/ Entrave » (saignee-forcee). Forme majoritaire à confirmer sur toute la colonne. → « Entrave/Soin » et « Attaque/Entrave » (sans espace), comme « Attaque/Soin ».
- **sort « attirance »** (`effets`) — « vers le lanceur ne fonctionne » — Deux propositions soudées sans ponctuation (« …vers le lanceur ne fonctionne qu'en ligne ») ; la ponctuation à ajouter (virgule, point-virgule ou point + majuscule) est incertaine. → « …vers le lanceur, ne fonctionne qu'en ligne » ou « …vers le lanceur. Ne fonctionne qu'en ligne ».
- **sort « attirance »** (`effets`) — « La cible est attirée de 3 cases vers le lanceur ne fonctionne qu'en ligne. » — Il manque une ponctuation entre « lanceur » et « ne fonctionne » (deux propositions de sujets différents). Virgule ou point : choix incertain (le point exigerait aussi une majuscule). → « …vers le lanceur. Ne fonctionne qu'en ligne. » (ou une virgule).
- **sort « clou »** (`effets`) — « Inflige Saignement 1 » — Casse incohérente de « saignement » dans la colonne effets : majuscule ici (et dans les remarques « Saignement … »), minuscule dans boule-de-sang, renfermement, grenade-a-clous (« prendre saignement 1 », « saignement stade 2 »). Nom d'état du jeu : à trancher globalement. → Harmoniser selon la forme majoritaire de la table (dans cette tranche, minuscule : « Inflige saignement 1 »).
- **sort « clou »** (`effets`) — « Si jet de vigueur raté = Inflige Saignement 1. » — Casse de « saignement » incohérente entre sorts (Clou « Saignement 1 » ; Boule de sang, Renfermement, Grenade « saignement 1 / stade 2 ») ; c'est peut-être un nom d'état, à laisser. → Choisir une casse unique pour l'état « saignement » sur l'ensemble des magies (majoritairement minuscule dans les effets).
- **sort « proportion-demesuree »** (`remarque`) — « on peut monter à 6 de force temporairement)  Le bonus en force casse les limites de la carac (oui oui, on peut monter à 7 de force temporairement) » — La remarque contient deux fois la même phrase avec un chiffre différent (6 puis 7). Ce n'est pas une faute de frappe corrigeable (valeur de jeu), signalé pour information. → Vérifier dans la source quelle valeur est la bonne ; ne pas modifier sans validation du propriétaire.
- **sort « saignee-forcee »** (`remarque`) — « qui se cumule pas » — Négation incomplète (« ne » manquant) : corriger exige d'ajouter un mot. → « qui ne se cumule pas avec le Saignement classique ».
- **sort « saignee-forcee »** (`remarque`) — « qui se cumule pas avec le Saignement classique » — La négation « ne » manque (« qui ne se cumule pas »). Ajouter un mot n'est pas permis. → « qui ne se cumule pas avec le Saignement classique »
- **sort « saignee-forcee »** (`type_brut`) — « Attaque/ Entrave » — Espace après la barre oblique seulement ; incohérent avec « Attaque/Soin ». → « Attaque/Entrave »
- **sort « sang-perfection »** (`effets`) — « +2INI dure 2 tours » — Ponctuation manquante avant « dure » ; les sorts voisins écrivent « +2INI. Dure 3 tours. » (point + majuscule). Ajouter le point et la majuscule modifie la ponctuation : à valider. → « +10 dégâts, +6AP, +6AM, +2 Vitesse, +2INI. Dure 2 tours (+1/NM). »
- **sort « sang-perfection »** (`effets`) — « +2INI dure 2 tours (+1/NM). » — Dans les autres sorts de Sang on lit « +2INI. Dure 3 tours. » ; ici le point et la majuscule manquent, mais la phrase se lit aussi d'un seul tenant. → « +2INI. Dure 2 tours (+1/NM). » si l'harmonisation est souhaitée.

### magies/magie-du-vent

- **mode hyper (mono)** (`variante_brut`) — « Mono-Magie » — Casse différente de « Bi-magie » (voir la même remarque pour la magie de la Terre). Libellé identique sur les 14 magies. → Laisser, ou harmoniser sur toutes les magies.
- **sort « allegement »** (`dsb_brut`) — « 6 Initiative et +2 Vitesse » — Le signe « + » semble manquant devant « 6 » (cohérent avec « +2 Vitesse »). C'est une valeur de jeu, donc non touchée. → +6 Initiative et +2 Vitesse (à confirmer par le propriétaire)
- **sort « estoc-hurlante »** (`type_brut`) — « Attaque/ Placement » — Espace après la barre oblique, voir Éternuement. → Attaque/Placement ou uniformiser avec espace
- **sort « eternuement »** (`type_brut`) — « Attaque/ Placement » — Espace après la barre oblique (même cas dans Estoc hurlante, Vibration, Tornade) ; la forme sans espace existe dans la magie de la Terre (« Soin/Entrave ») : à trancher globalement. → Attaque/Placement ou uniformiser avec espace
- **sort « propulsion »** (`portee_brut`) — « 10 (+2 / NM) » — Espaces autour de la barre oblique, alors que toutes les autres portées s'écrivent « (+N/NM) ». Cela touche une valeur de portée, donc laissé pour validation. → 10 (+2/NM)
- **sort « vent-couteau »** (`effets`) — « Inflige des dégâts de vent sur toute la ligne. » — Casse du nom d'élément : « Vent » prend une majuscule partout ailleurs (« attaque de Vent », « dégâts de zone de Vent », « élément Vent »), ici « vent ». Peut aussi être le nom commun, donc incertain. → Inflige des dégâts de Vent sur toute la ligne.
- **sort « vibration »** (`effets`) — « Incanche une vibration » — « Incanche » n'existe pas ; plusieurs verbes plausibles (« Enclenche », « Déclenche »). → Enclenche (ou Déclenche) une vibration
- **sort « vibration »** (`effets`) — « Incanche une vibration insupportable » — « Incanche » n'existe pas. Le verbe voulu est probablement « Enclenche » ou « Déclenche », mais le choix est incertain. → Enclenche une vibration insupportable (ou « Déclenche »)
- **sort « vibration »** (`effets`) — « insupportable, Si jet de vigueur raté = Inflige surdité 2, Si jet de stabilité » — Majuscules à « Si » après une virgule. La convention de la feuille semble être une majuscule en début de clause (comme « Inflige » après « = »), donc non corrigé. → insupportable, si jet de vigueur raté = Inflige surdité 2, si jet de stabilité (à confirmer)

### magies/magie-du-vide

- **magie** (`description`) — « En plus de ça, elle est capable d'utiliser la puissante télékinésie, ce qui leur permet un petit contrôle sur le terrain. » — Changement de sujet : « elle est capable » (la magie) puis « leur permet » (les utilisateurs), alors que le reste du paragraphe est à « ils ». Peut-être « ils sont capables d'utiliser ». Réécriture non appliquée. → « En plus de ça, ils sont capables d'utiliser la puissante télékinésie, ce qui leur permet… » si le sujet voulu est les utilisateurs.
- **magie** (`description_physique`) — « Les utilisateurs du vide ont une pilosité blanche » — Casse : « du vide » en minuscule alors que la description écrit « du Vide » (nom de la magie) ; nom propre ou nom commun ? → « Les utilisateurs du Vide » pour suivre la description.
- **mode hyper (bi)** (`variante_brut`) — « Bi-magie » — Casse incohérente avec « Mono-Magie » (même colonne, même mot « magie »). Une occurrence de chaque dans ce fichier, donc pas de forme majoritaire ; probablement une valeur produite par l'import. → Harmoniser en « Bi-Magie » / « Mono-Magie » ou « Bi-magie » / « Mono-magie » dans toute la base.
- **sort « alea-negatif »** (`remarque`) — « les altérations d'états sont 1 cran » — « altérations d'états » : la forme standard est « altérations d'état » (singulier), mais c'est peut-être un terme de jeu ; la même graphie est dans la remarque de Dissipation (« altérations d'états »). → les altérations d'état (à décider pour tout le jeu)
- **sort « alea-negatif »** (`remarque`) — « 16 : Inflige gel 1 17 : Inflige confusion 1 » — Les noms d'états sont précédés d'un astérisque dans la liste (*saignement, *poison, *brûlure, *surdité, *enragé...), sauf « gel », « confusion » et « couardise » (ligne 20). Il manque peut-être « * », mais ajouter un caractère ne relève pas d'une correction certaine. → Inflige *gel 1 / Inflige *confusion 1 / Inflige *couardise, si l'astérisque est bien voulu
- **sort « dissipation »** (`effets`) — « Annule les effets positif et négatif d'une cible. » — Adjectifs au singulier après « effets » (pluriel). La tournure « les effets positif et négatif » (un effet de chaque sorte) est admissible, donc pas de faute certaine. → les effets positifs et négatifs (si l'on veut le pluriel)
- **sort « dissipation »** (`remarque`) — « Les buff niveau 5 » — « buff » sans s après « Les » : anglicisme du vocabulaire du jeu, pluriel possiblement invariable ou « buffs ». Non corrigé (vocabulaire de jeu). → Les buffs niveau 5
- **sort « grenade-implosive »** (`zone_brut`) — « Croix infini » — « Croix » est féminin, donc « infinie » en bonne grammaire. La colonne zone est lue par le code et « infini » peut être un mot-clé voulu, d'où la prudence. → Croix infinie
- **sort « marteau-du-vide »** (`texte_niveau5`) — « Que Sa volonté se condense en un bras de fer » — Majuscule à « Sa » en milieu de phrase : probablement une majuscule de déférence (incantation à une divinité), laissée telle quelle. → Ne rien changer sauf si c'est une coquille (« sa »).
- **sort « touche-du-vide »** (`type_brut`) — « Attaque/Soin » — Séparateur « / » sans espace, alors que les autres types composés du fichier l'ont avec espace (« Attaque/ Entrave », « Attaque/ Placement », « Entrave/ Soin »). Incohérence de forme, mais la forme avec espace semble venir du classeur. → Attaque/ Soin si l'on harmonise sur la forme majoritaire, sinon ne rien changer

### magies/potentiel-illimite

- **magie** (`explication`) — « (Vulnérabilité contre les dégâts physique » — La parenthèse ouverte après « Surtension corporelle » n'est jamais refermée ; l'endroit où la fermer (après « physiques » ou en fin de phrase) est incertain. → Ajouter « ) » : soit après « dégâts physiques », soit après « niveau global » (avant le point). À trancher par le propriétaire.
- **magie** (`explication`) — « Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global. » — La parenthèse ouverte n'est jamais fermée. L'emplacement de « ) » est incertain. → Soit « physiques) , ne peut mettre… », soit « …niveau global.) » ; à trancher selon la source.
- **mode hyper (forme_complete)** (`effet`) — « Résistance à la magie et dégâts physiques neutre. » — « neutre » peut s'accorder avec « Résistance » (singulier) ou avec « dégâts physiques » (pluriel : « neutres »). Sens incertain. → Laisser, ou « neutres » si l'adjectif porte sur les dégâts physiques.
- **page** (`titre`) — « Potentiel illimité » — Casse différente du nom de la magie dans les descriptions (« Potentiel Illimité », forme majoritaire). Peut être voulu pour un titre de page. → Potentiel Illimité


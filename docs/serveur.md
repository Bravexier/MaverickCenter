# Mode client / serveur : le service des personnages

Demande du propriétaire : le site reste un ensemble de pages statiques pour **lire** les règles et le lore, et un petit **service** enregistre
ce qu'on y **écrit** : les fiches de personnages prétirés et, sur le site de dev, l'édition des règles. La connexion Discord et les fiches de
joueur viendront s'y ajouter ([`feuille-de-route.md`](feuille-de-route.md)) ; rien n'y est propre à l'hôte qui le fait tourner.

```
navigateur ──▶ nginx (mot de passe du site) ──┬──▶ site/            pages, scripts, base des règles (donnees/maverick.db)
                                              └──▶ /api/ ──▶ conteneur « serveur » (Node 22) ──▶ db/vivante.db  (base vivante)
```

**Pas de comptes** : quiconque a le mot de passe du site lit et écrit les prétirés (un prétiré n'est à personne et tout le monde
le voit : `v_personnage_visible`). Une fiche de joueur n'est ni listée ni lisible par l'API des personnages ; elle viendra avec la connexion
Discord. Sur le site de dev seulement, le menu « DB » de la page Debug lit pourtant toute la base vivante, fiches comprises (décision du
propriétaire du 2026-10-15 ; le serveur de dev reste ouvert à ceux qui y auront accès : [`api.md`](api.md), « Contenu des tables »). Sur le site de dev,
un second mot de passe, posé par le propriétaire, protège les écritures et la mise à jour ; la lecture des pages reste libre (« Accès au site de dev »).

## Le code

| Fichier | Rôle |
| --- | --- |
| `client/serveur/index.mjs` | Point d'entrée livré (variables d'environnement ci-dessous) |
| `client/serveur/service.mjs` | Serveur HTTP (`node:http`), surveillance des fichiers, arrêt propre |
| `client/serveur/api.mjs` | Routes : une requête lue → une réponse (JSON, sauf l'image d'un portrait et un classeur), sans réseau (testé directement) ; `POST /api/classeur/` et `GET /api/tipeee/` rendent une promesse, que `service.mjs` attend |
| `client/serveur/acces.mjs`, `acces-routes.mjs` | L'accès au site de dev : le réglage (`secrets/acces.json`), les sessions, les essais ratés, la commande de l'hôte ; le classement de chaque route (ouverte, lecture, écriture) que la porte de `traiter` consulte (« Accès au site de dev », plus bas) |
| `client/serveur/fiches.mjs` | Une fiche ↔ les lignes de la section 13 de `data/schema.sql` ; contrôles ; résumé pour la recherche |
| `client/serveur/base-vivante.mjs` | Création et renouvellement de la base vivante, archives |
| `client/serveur/structure-sur-place.mjs` | Un changement de structure appliqué à la base en place (migrations livrées, essai sur une copie, migrations reçues par une base refaite) : « Changement de structure appliqué sur place », ci-dessous ; pas encore branché sur la vraie base |
| `client/serveur/essai-de-structure.mjs` | L'essai d'une livraison avant son installation : les demandes de l'installateur dans `db/essai-de-structure/`, l'essai sur une copie, la réponse et le dernier résultat (`GET /api/debug/structure/`) : « Essai avant installation », ci-dessous |
| `client/serveur/essai-dans-l-ombre.mjs` | L'essai dans l'ombre : à chaque installation du site de dev, la base d'avant migrée sur place comparée à la base refaite, le rapport (`db/essai-de-structure/ombre.json`, `GET /api/debug/structure/`, champ `ombre`) : « Essai dans l'ombre », ci-dessous |
| `client/serveur/classeur.mjs` | « Importer (en ligne) » de la fiche : le téléchargement d'une feuille Google Sheets partagée par lien (`POST /api/classeur/`, ci-dessous), la seule sortie du service vers une adresse que donne le visiteur (« Hébergement ») |
| `client/serveur/tipeee.mjs` | La partie « Bienvenue » de Tipeee relue en direct (`GET /api/tipeee/`, ci-dessous) : cache, une requête à la fois, dernier texte gardé (`db/tipeee.json`), repli sur l'instantané livré avec le site ; l'extraction du texte est pure, `client/src/lib/tipeee.mjs` |
| `client/serveur/maintenance.mjs` | « Maintenance en cours » pendant une vraie mise à jour : annonce, dossier partagé, état de ce serveur (ci-dessous) |
| `client/serveur/ressources.mjs` | API REST `/api/v1/` (site de dev seulement) : le CRUD des éléments du jeu que décrit le registre `src/lib/ressources.mjs`, écritures par le service d'édition ([`api.md`](api.md)) |
| `client/serveur/openapi.mjs` | Description OpenAPI 3.1 du service (`GET /api/v1/openapi.json`), tirée du catalogue ; module pur |
| `client/serveur/journal-du-service.mjs` | Journal du service gardé en mémoire (page Debug du site de dev, `GET /api/debug/journal/`) ; sans import |
| `client/serveur/debug-tables.mjs` | Contenu des tables de la base vivante, en lecture seule, fiches comprises, et version de la base qui le fait suivre (menu « DB », le schéma de la base, de la page Debug, `GET /api/debug/tables/`, `GET /api/debug/base/` ; site de dev seulement) |
| `client/src/lib/fiche-format.mjs` | Format d'échange d'une fiche, **partagé** avec les pages du site (sans dépendance) |
| `client/serveur/dev.mjs` | `npm run serveur` (développement) — jamais livré |
| `client/serveur/livraison.mjs` | Intégration Astro : copie le service dans `dist/_serveur/` à chaque build — jamais livré |

Le service n'utilise que Node (≥ 22.13, `node:sqlite`) et ses propres modules : **aucun paquet npm** (`modulesDuServeur` refuse un import qui n'est
ni `node:…` ni relatif). Il est livré **avec le site** : `dist/_serveur/` contient ses modules, sous les mêmes chemins que dans `client/`
(`serveur/…`, `src/lib/…`), et `version.json` (version du site, empreinte du code). Le site et son service arrivent donc toujours ensemble sur le
serveur, par les installateurs (ou le zip du paquet du NAS, `deploy/build.sh`). nginx refuse l'adresse `/_serveur/` ; la version portable (`tools/build-artifact.mjs`)
ne l'emporte pas.

## La base vivante (`db/`)

| Fichier | Contenu |
| --- | --- |
| `db/vivante.db` | Copie de la base des règles publiée par le site (`site/donnees/maverick.db`), plus ce que le service écrit (section 13 : utilisateurs, fiches, groupes) |
| `db/vivante.json` | Empreinte SHA-256 du fichier des règles dont elle est faite (`regles`), leur empreinte logique (`logique`), la version de la logique de reconstruction (`reconstruction`), la version du service qui la fait tourner (`version`), version du schéma, date |
| `db/archives/` | Les 5 dernières bases remplacées qui avaient des lignes de la section 13, `vivante-<horodatage>-v<version>.db` (la version du service qui faisait tourner la base ; `-inconnue` si on ne la sait pas ; les anciennes `vivante-<horodatage>.db` se comptent et se purgent avec elles) |
| `db/source` | Seulement sur une base source (posé par `deploy/installateur/bascule.sh`) : la base n'est plus jamais refaite depuis les règles, elle est migrée sur place (« Base source (lot 8) », plus bas) |
| `db/metriques/` | Seulement sans dossier des métriques réglé (NAS, `npm run serveur`) : la base des métriques de l'instance (« Métriques et volume », plus bas) ; l'installateur de test ne la copie ni ne l'efface |

Pourquoi une copie des règles : les fiches citent les règles (race, classe, sorts…) par clés étrangères, et les contrôles (`v_personnage_controle`,
`v_personnage_niveau`) les joignent ; tout doit être dans la même base SQLite.

**Quand refait-on la base vivante ?** Quand ce que le fichier des règles apporte change, pas quand ses octets changent (lot 5 du chantier de la base de dev, R274).
- Comparaison rapide d'abord : le SHA-256 du fichier est celui de `vivante.json` (`regles`) et la version de la logique de reconstruction est la même : rien n'est
  calculé de plus, rien n'est refait.
- Sinon, le service copie le fichier et en calcule l'**empreinte logique** (`serveur/empreintes.mjs#empreinteLogique`) : le SQL de tout le schéma (tables de fiches et du
  journal comprises : une colonne de plus à `personnage` fait refaire la base), `user_version`, et les lignes de toutes les tables hors fiches et journal — contenu, notes,
  historique **et tables calculées** (une table calculée qui change fait refaire la base, sinon la production garderait des liens périmés ; le plein texte est lu par ses colonnes,
  pas par ses tables d'ombre). Même empreinte que `vivante.json` (`logique`) : la base est déjà faite de ce contenu, elle est **gardée telle quelle** (fiches intactes, ni archive ni
  rejeu) et seul `regles` est mis à jour ; le service le note (`base vivante gardée : …`) et l'évènement `empreinte_logique` donne la durée du calcul (≈ 0,3 s).
- **Dans le doute, elle est refaite** : pas d'empreinte gardée (`vivante.json` d'avant ce réglage, ou calcul en échec), schéma, ligne ou version différents. Un `vivante.json` sans
  `reconstruction` (écrit avant ce réglage) garde l'ancienne règle, sur les octets du fichier seulement, puis reçoit les deux champs à la reconstruction suivante.
- `VERSION_DE_LA_RECONSTRUCTION` (`serveur/base-vivante.mjs`) est à **augmenter de 1** quand ce que `preparerBaseVivante` fait d'une base d'avant change sans que les règles changent
  (conversion, retrait R42, armure R165, ligne écartée, table ou colonne retirée, rejeu, contrôle des fiches) ; sinon ce changement ne s'appliquerait qu'à la livraison suivante des règles.
  Augmentée, la base est refaite même si le fichier est le même.
- `db:build` est déterministe octet pour octet (deux constructions de la même arborescence, avec la même version de Node : même SHA-256) ; le fichier change donc de contenu quand
  `data/rows`, le schéma ou `data/derive.sql` changent. Il ne changeait d'octets sans changer de contenu que par une version de Node ou de SQLite : c'est ce cas, seul, que ce réglage
  épargne à la production.
- L'archive d'une reconstruction (avant toute reconstruction qui remplace une base qui avait des fiches ou un journal, comme avant) porte la version que `vivante.json` gardait pour
  la base remplacée (`version` : celle du service qui l'a faite, tenue à jour à chaque démarrage).

**Quand une livraison change les règles**, le service le voit (empreinte logique différente) et refait la base vivante : nouvelle copie des règles, puis
toutes les lignes de la section 13 y sont recopiées colonne par colonne (une colonne ajoutée prend sa valeur par défaut), et le journal de l'édition
est rejoué (site de dev, ci-dessous). Un **don, une spécialité (avec les dons choisis qui en dépendent), un sort, un métier ou une arme** que les nouvelles
règles n'ont plus est alors **retiré des fiches** qui l'utilisent, avec une note datée dans chacune (décisions R42, R52, « Fiches de personnage (R42) »
ci-dessous) ; `/api/etat` en donne la liste (`base.retraits` : `{ le, fiches }`, la dernière liste non vide, datée, gardée dans `vivante.json` par les
reconstructions qui ne retirent rien et au redémarrage). Deux cas de plus, notés de la même façon (décision R238, mise à jour de Décembre) : un **don qui change de spécialité en gardant son identifiant** (`capacites/cuirasse-appui`, de Vindicatif à Protecteur) est retiré des fiches qui avaient la spécialité d'avant (note « a changé de spécialité dans les règles », `cas: 'deplace'` ; `serveur/fiches-retraits.mjs#retirerLesManquants`, comparé à l'ancienne base ; une fiche d'une autre spécialité n'est pas touchée), et un **point de maîtrise de ligne de classe imposé qui devient à choisir** (l'Archimage, `classes/archimage#maitrise-arme:2` : « 1 maîtrise de Bâton » devenue une arme de contact au choix) ne retire rien — le choix est en attente, R148 — mais ajoute une ligne datée (nature `maitrise_imposee`, `maitrisesDevenuesAChoisir`), une seule fois. **Toute autre ligne qui ne passe pas** — une fiche cite une race, une classe, une magie… qui
n'existe plus (y compris un don, une spécialité ou un sort dont la classe ou la magie a disparu : un sort d'une magie supprimée chez un Potentiel
Illimité, un don d'une classe supprimée sur une fiche qui n'a pas la classe, qui ne sont pas retirés), une colonne remplie a disparu du schéma (sauf
une colonne que les règles retirent exprès, `COLONNES_RETIREES` de `fiche-format.mjs` : le `statut` des fiches, migration 0038, perdu sans bloquer), une
contrainte a changé — fait garder la base en place telle quelle (sans retrait ni note) :
le service continue avec elle (règles d'avant) et `/api/etat` donne l'erreur, par exemple `personnage_classe.classe_id = « classes/x » absent de
classe (1 ligne(s))`. Il faut alors une livraison qui règle le cas : migration de la section 13 (`data/migrations/`) ou correction des règles.
**Une table que les règles retirent de la section 13** (`TABLES_RETIREES` de `fiche-format.mjs`) n'est plus recopiée : ses lignes sont **converties**
après la copie des fiches (`CONVERSIONS` de `serveur/base-vivante.mjs`), jamais perdues sans le dire. `personnage_progression` (une ligne par niveau
atteint, jusqu'à la migration 0045) devient, pour chaque fiche, la somme de ses lignes dans `personnage.gains_sante` et `gains_chakra` (points du
niveau, plus le dé sur la santé, le chakra ou les deux ; décision R73). `personnage_armure` (une armure par emplacement, jusqu'à la migration
0055) devient l'armure de la fiche (`personnage.armure_id`, son amélioration, son élément et l'amélioration de l'élément ; décision R95) : la ligne du
premier emplacement, l'armure complète d'abord (`armureDesArmures` de `fiche-format.mjs`) ; une pièce gardée qui devient l'armure complète, et chaque
autre pièce qui ne porte pas la même armure (ou pas la même amélioration, le même élément), sont des retraits notés comme ceux de la décision R42 (une
ligne datée dans la fiche, la fiche listée dans `base.retraits` de `/api/etat`). Si la reconstruction échoue, le service continue avec la base d'avant
0055 : une fiche s'y lit avec une liste `armure_parties` vide et s'y enregistre sans elle (une liste non vide est refusée, ses lignes seraient perdues).
`personnage_bouclier_materiau` (jusqu'à trois matériaux, jusqu'à la migration 0060) devient la matière du bouclier (`personnage.bouclier_materiau_id`, le
matériau du premier rang ; décision R96), chaque autre matériau un retrait noté de même. **Des lignes qu'une table garde mais que ses nouvelles règles
refusent** ne sont pas recopiées (`LIGNES_ECARTEES` de `serveur/base-vivante.mjs` : un prédicat SQL, valable sur l'ancienne et la nouvelle forme de la
table, et ce qu'on en note) : depuis 0060, un accessoire de la Ceinture ou d'« Autre », ou sans effet de la table (décision R97), noté comme le nom ou
l'effet hors table qu'un accessoire gardé perd (`COLONNES_RETIREES` : `nom`, `texte`). **Une colonne retirée qui porte une donnée à reprendre**
est convertie de même (`COLONNES_CONVERTIES` de `serveur/base-vivante.mjs`, quand l'ancienne base a la colonne et la nouvelle ne l'a plus) : depuis
la migration 0062 (décision R104), le texte de `personnage.entrainement` devient des lignes de texte de `personnage_entrainement` (une par ligne du
texte : `entrainementEnLignes`), et l'acquis saisi de `personnage_competence` (au-dessus de 0) un retrait noté, daté, par compétence (l'Acquis se
calcule). Sur une base d'avant 0062 (reconstruction échouée), une fiche se lit avec des listes `entrainements` et `acquis_choix` vides et s'enregistre
sans elles (une liste non vide est refusée), l'acquis d'avant à 0. Depuis la migration 0066 (décision R118), les NM du MJ de chaque sort
(`personnage_sort.nm_cadeau`) deviennent ceux de la fiche, `personnage.nm_mj`, leur somme ; le NM de chaque sort ne change pas, rien n'est noté.
Depuis la migration 0082 (décision R169), le livre d'un sort (`personnage_sort.nm_livre` = 1) devient une ligne de `personnage_livre_sort`, rangée
dans l'ordre de la liste des sorts (comme la migration et `livresDesSorts`) ; le NM du sort ne change pas, rien n'est noté.
Depuis la migration 0076 (refonte des maîtrises d'armes, décisions R148 à R153), `personnage_maitrise_arme` (les dés par famille) et l'arme choisie
d'un choix d'acquis (`personnage_acquis_choix.arme_famille_id`, R119, retirée par R152) ne sont plus recopiées : **« Tout remettre à choisir »**
(R153), aucun choix de maîtrise n'est posé (`personnage_maitrise_choix` reste vide ; les familles imposées par les classes et les dons comptent
d'emblée), et chaque fiche qui avait des dés ou une arme choisie reçoit **une seule ligne datée** à la fin de ses notes, après celles de R42
(`maitrisesDAvant` et `ligneDeRetrait` de `fiche-format.mjs`, `noterLesMaitrisesDAvant` de `serveur/base-vivante.mjs`, appelée par la conversion de la
table et par celle de la colonne, une fois par reconstruction) : « Maîtrises d'armes avant la refonte (2026-10-22) : ÉPÉES 3D10, ARC 2D8 ; arme
choisie : Flétrisseur (Tueur) ÉPÉES » (familles dans l'ordre des bandeaux, dés écrits comme sur la page ; une partie absente est omise). La fiche est
marquée modifiée et listée dans `base.retraits` de `/api/etat` ; la compétence d'un choix d'acquis reste (R152).
**L'armure (décision R165, migration 0080)** : une fiche porte une armure de base (`armure_id`, `armure_amelioration_id`) **ou** une armure
élémentaire (`armure_elementaire_id`, `armure_amelioration_elementaire_id`, +1 à +5), jamais les deux. À **chaque reconstruction**, après le rejeu et
les retraits de R42 (`retirerLesArmuresHorsRegle` de `serveur/fiches-retraits.mjs`, idempotente), dans cet ordre : une fiche qui porte les deux (une
fiche d'avant : l'« élément » posé sur l'armure, R95) garde l'élément pour armure, avec son amélioration, sans ligne de partie (à son maximum) ;
l'armure d'origine, son amélioration et la solidité de ses parties abîmées sont notées (« l'armure « … » (amélioration +2, solidité Casque 1, Torse 0)
est devenue l'armure élémentaire « … » (amélioration +3) de la fiche, remise à sa solidité maximum… ») ; puis une armure « Familier » et une armure
élémentaire d'une magie ni innée ni acquise (une fiche sans magie innée ne l'a pas) sont retirées et notées ; enfin une armure plus lourde que le
poids portable de la fiche (R165 (6), (7) : « … n'est plus portée : elle est trop lourde pour le personnage (Lourd, au plus Intermédiaire) »), pour
**toutes les fiches, joueurs compris**. Le poids portable est le calcul du moteur de la fiche (`lib/fiche-moteur.mjs#poidsPortableDesTextes`, le même
que la page) sur des entrées lues dans la base refaite par `lib/poids-portable-db.mjs` (`poidsPortableDeLaBase`, un seul lecteur par reconstruction :
requêtes préparées une fois, vocabulaire des balises lu une fois) : la « Maîtrise Armures » (`classe_maitrise_armure`, objet `armure`) des classes de
niveau de classe ≥ 1 (`v_personnage_niveau`), le texte des dons acquis (`v_personnage_don_acquis`), les dons de la race et de l'ethnie (`race_don` ;
l'ethnie pas encore choisie, ceux de chaque ethnie de la race, table `ethnie` : « tout Nain », R165 (6)),
les avantages de la race (`race_onglet`) et l'explication de la magie innée, sans balises du glossaire. Une fiche sans classe porte au plus un
vêtement, comme sur la page. Une base qui n'a pas ce que lit le calcul (une base vivante d'avant, en repli : `COLONNES_LUES`) ne sait pas dire le
poids : rien n'est retiré. Pourquoi pas les règles complètes de la page (`chargerReglesDeFiche`) : près d'un Mo lu en 0,2 à 0,8 s, et le site de dev
modifie les règles dans la base même qu'il sert (un cache par base serait faux après une modification, un rechargement à chaque enregistrement trop
lent) ; quelques requêtes par fiche lisent toujours les règles du moment (`test/serveur-poids-portable.test.mjs` compare les deux calculs sur toute
la base). L'option `poidsPortable` de `preparerBaseVivante` (une fonction `(db, id) => 0 à 3 ou null`) remplace ce calcul, `null` le retire (tests).
Les textes sont ceux de la migration 0080
(`ligneDeRetrait`, natures `armure_transformee`, `armure_familier`, `armure_magie_absente`, `armure_trop_lourde` de `fiche-format.mjs`) ; la fiche est
marquée modifiée et listée dans `base.retraits` de `/api/etat`.
Depuis la migration 0081 (armes élémentaires, décision R167), `personnage_arme` n'a plus qu'un modèle d'arme : une arme du catalogue (`arme_id`, avec
son matériau) **ou** une arme élémentaire (`arme_elementaire_id`, sans matériau), et un seul niveau d'amélioration (`amelioration_id`, cible `arme`,
le tableau fondu) ; `amelioration_elementaire_id` est retirée (`COLONNES_RETIREES`). Une arme du catalogue qui porte un élément n'est pas recopiée
telle quelle (`LIGNES_ECARTEES`, le CHECK « l'une des deux » la refuserait) : la conversion de la colonne retirée (`COLONNES_CONVERTIES`,
`convertirLesArmesDAvant` de `serveur/base-vivante.mjs`, par `armeDAvant` de `fiche-format.mjs`) l'écrit dans sa nouvelle forme. **Élément du type de
l'arme** (le type élémentaire de sa famille, `arme_famille.type_elementaire_id` = `arme_elementaire.type_id`) : l'arme devient l'arme élémentaire
(`arme_id` et `materiau_id` à NULL), au niveau de l'ancienne amélioration de l'élément (`ressources/armes#amelioration:arme:N`, N lu dans l'ancienne
ligne ou dans son identifiant ; aucun s'il n'y en avait pas), la durabilité gardée, bornée au nouveau maximum (`piece_elementaire.solidite_base` de
`constante_equipement` + crans de la ligne ; NULL à ce maximum ou au-delà) ; l'arme, le matériau et l'amélioration d'origine sont notés, datés.
**Élément d'un autre type** : l'élément et son amélioration sont retirés et notés ; l'arme garde matériau, amélioration et durabilité. **Amélioration
d'élément sans élément** : retirée et notée. Une ligne datée par arme, nature `arme_elementaire` (`ligneDeRetrait`), listée dans `base.retraits` :
« [23/10/2026] Retrait (règles modifiées) : l'arme « Arc » (ARC, arme 1, matériau « Titane », amélioration +3) est devenue l'arme élémentaire « Arc de
Sang », avec l'amélioration +5 de son élément : une pièce élémentaire transforme l'arme, qui perd toutes ses caractéristiques d'avant. Adaptez la
fiche. » Une arme élémentaire n'est jamais une arme supprimée du catalogue (R52 : `arme_id` NULL) ; une arme élémentaire disparue des règles reste une
clé rompue qui bloque.
Des règles qui ont encore la table alors que le service la sait retirée
(service et règles qui ne vont pas ensemble), ou une table retirée sans conversion, bloquent la reconstruction avec ce message. Une table retirée de la
section 13 va donc dans `TABLES_RETIREES`, avec sa conversion. La base remplacée est d'abord archivée (`db/archives/`) : l'archive garde donc la base
d'avant les retraits et les conversions (les gains niveau par niveau compris).

**Revenir à une version d'avant la migration 0045** (« Revenir sous la migration 0045 » de
[`deploy/installateur/README.md`](../deploy/installateur/README.md), qui donne les commandes) : le service d'avant ne relit pas une base vivante
refaite en 0045 (sans `personnage_progression`, toute lecture de fiche échoue) et refuse de la reconstruire (`gains_sante` et `gains_chakra`,
obligatoires, sont toujours remplis, même à 0). Il faut lui rendre l'archive faite à la reconstruction 0045 : la plus récente de `db/archives/` qui
a encore la table `personnage_progression`, **copiée à part avant tout** (seules les `ARCHIVES_GARDEES` = 5 dernières sont gardées : au-delà,
chaque reconstruction efface la plus ancienne). **De même pour la migration 0055** : le service
d'avant ne relit pas une base refaite en 0055 (sans `personnage_armure`, toute lecture de fiche échoue) et refuse de la reconstruire (les colonnes
`personnage.armure_*` remplies n'existent pas dans ses règles) ; l'archive à rendre est la plus récente qui a encore la table `personnage_armure`
(sous 0045 aussi : celle qui a encore `personnage_progression`), et l'armure et la solidité des parties saisies depuis sont perdues avec le reste.
Conteneur « serveur » arrêté, elle remplace
`db/vivante.db` (ses `-wal`, `-shm` et `-journal` supprimés s'il y en a), `db/vivante.json` est supprimé (la base est alors refaite pour les règles
installées, fiches de l'archive reprises), puis le conteneur est relancé. **Tout ce que la base a reçu depuis la reconstruction 0045 est perdu** :
fiches créées, modifiées ou supprimées, gains de niveau, entraînement et solidité des armes saisis, et, sur le site de dev, les modifications des
règles en attente (journal de l'édition). Sauvegarder d'abord la base en place (`sqlite3 db/vivante.db ".backup …"`).

**Sauvegarde** : `db/` est la seule donnée du serveur qui ne se reconstruit pas. La copier avec `sqlite3 db/vivante.db ".backup sauvegarde.db"`
(cohérente même pendant une écriture), ou copier le dossier `db/` pendant que le conteneur « serveur » est arrêté. `data/rows` garde les tables de la section 13 **vides** : aucune
fiche réelle dans git ni dans `/donnees/maverick.db` (le service refuse une base des règles qui en contient).

### Changement de structure appliqué sur place

Lot 7 du chantier « la base du site de dev devient la source de vérité » (R274, R275 ; plan : `docs/chantier-base-de-dev.md`). Code : `serveur/structure-sur-place.mjs` ;
tests : `serveur-structure-sur-place`, `serveur-structure-sur-place-reconstruction`. **Sans le marqueur `db/source`** (« Base source (lot 8) », plus bas), rien ne migre la base
vivante au démarrage, qui reste refaite depuis les règles puis rejouée depuis le journal (« Quand refait-on la base vivante ? ») : le module sert alors à deux choses seulement, l'**essai** (sur une
copie) et la **note des migrations reçues** par une base refaite. **Avec lui**, le service migre sa vraie base sur place à son démarrage.

- **Livré.** Chaque `data/migrations/NNNN-<nom>.sql` (aucun registre `.json` : le service lit les références de `data/references/`, jointes à part) et `data/schema.sql` sont copiés dans `dist/_serveur/data/` (`livraison.mjs#fichiersDeStructure`, `FICHIERS_JOINTS`) :
  ils comptent dans l'empreinte du code. `lireLesMigrations` rend pour chacune son numéro, son fichier, son SQL et le sha256 des octets du `.sql`. Dossier absent : `null`, sans erreur.
- **Plancher.** La version livrée (`versionLivree`) est la plus haute de la dernière migration et du `user_version` de `schema.sql` (`versionDuSchemaSql`) : aujourd'hui égales ; quand les migrations mixtes
  sortent du dépôt, `schema.sql` garde leur version et sert de plancher (seules les migrations au-dessus s'appliquent ; l'essai d'une base à cette version dit `a_jour`, pas `en_avance` ; celui d'une base en dessous, sans migration livrée pour y monter, dit `refuse`, étape `plancher` : elle se refait depuis le schéma).
  Les tests de structure appliquent alors une vraie migration au-dessus du plancher (`test/aide-structure-sur-place.mjs#LIVRAISON`).
- **Appliquer** (`appliquerSurPlace`, les garde-fous de `tools/db/maverick.py#migrer`). Les migrations de numéro > `PRAGMA user_version`, **d'un seul bloc** : les numéros se suivent un à un ; une migration qui porte `BEGIN`, `COMMIT`, `END`, `ROLLBACK`
  ou `PRAGMA` est refusée ; la **sauvegarde** d'abord (`VACUUM INTO`, `structure-<instant>-v<version>.db` ; l'option `sauvegarde` est obligatoire, `false` pour un essai sur une copie) ; `foreign_keys` coupées pendant le bloc
  puis rétablies, `PRAGMA foreign_key_check` vide après chaque migration ; `user_version` posé ; le schéma obtenu comparé à `schema.sql` (`comparerLesSchemas`, portage de `comparer_schemas` : tables, colonnes dans l'ordre, index, vues) ;
  une ligne `migration_recue` en mode `sur_place` par migration (version du site notée si elle est X.Y.Z, sinon NULL). Au moindre écart : `ROLLBACK` complet et une `ErreurStructure` qui dit la migration, l'étape
  (`suite`, `interdit`, `execution`, `cles_etrangeres`, `schema`, `schema_attendu`, `notes`, `sauvegarde`) et la raison.
- **Essayer** (`essayerSurUneCopie`, `essayerEnArrierePlan` : un fil à part, un essai à la fois). Une copie `VACUUM INTO` de la base (ouverte en lecture seule), une seconde pour l'état d'avant ; l'application sur la première, sans sauvegarde ; le bilan ; les deux copies
  **toujours effacées** (`purgerLesEssaisDeStructure` retire celles d'un service arrêté en plein essai, à l'ouverture du service ; l'appel de `essayerEnArrierePlan` avant une installation : « Essai avant installation », plus bas ; l'essai à chaque installation : « Essai dans l'ombre », plus bas). **La remise du bilan à la relecture est faite par la CI** : `scripts/controler-les-migrations.mjs` applique les migrations d'une PR à la base de sa version de départ, remplie, par `appliquerSurPlace` et `bilanDesTables`, et écrit le bilan par migration dans le résumé du job (`docs/flux-git.md`, « Règles des migrations (lot 7) »). Le bilan est un JSON : `verdict` (`accepte`, `refuse`, `a_jour`, `indisponible`), `versions`, `migrations`, `tables`
  (`creees` et `retirees` avec leurs lignes, `renommees` { de, vers } — même contenu et mêmes colonnes sous un autre nom —, `modifiees` par table { `ajoutees`, `retirees`, `modifiees` comparées par clé primaire, `colonnes_ajoutees`,
  `colonnes_retirees`, `structure_changee` }, `inchangees` : les tables d'empreinte identique, par `serveur/empreintes.mjs#empreinteDeLaTable`, fiches et journal compris), `objets` (index, vues, déclencheurs créés, retirés, modifiés), `totaux`.
  Un refus rend `refuse` et `refus` { migration, etape, raison, details }. Les tables virtuelles (plein texte) n'y comptent pas : elles se recalculent.
- **Migrations reçues par une base refaite** (`noterLesMigrationsRecues`, appelée par `preparerBaseVivante`, `VERSION_DE_LA_RECONSTRUCTION` inchangée : la production porte les fiches des joueurs, on ne refait pas la base pour noter une table). Après chaque reconstruction, chaque migration livrée de numéro <= `user_version` que `migration_recue` ne note pas encore y
  entre en mode `reconstruction` (version du site X.Y.Z, sinon NULL). Une ligne déjà notée (`sur_place` comprise) n'est jamais réécrite ; si le fichier livré a changé depuis, l'écart est dit au journal du service. Une ligne dont le numéro dépasse la version
  de la base refaite (retour à une version plus ancienne) est retirée. Migrations non livrées : rien n'est noté, sans erreur, et le journal le dit. Une erreur d'écriture de la table n'arrête pas la reconstruction : la base refaite est gardée, l'erreur va au journal et dans `migrations.erreur` du résultat (son affichage sur la page Debug viendra avec les PR suivantes du lot 7).
  **Table vide** : une base qui n'a pas encore été refaite depuis cette migration n'a pas de lignes ; la table se remplit à la prochaine reconstruction naturelle (règles ou contenu changés). D'ici là, une table vide veut dire « migrations <= `user_version` présumées reçues ». `appliquerSurPlace` retire d'abord, dans son bloc, les lignes de numéro > `user_version`. Les lignes de `migration_recue` ne comptent pas pour décider d'archiver la base vivante.

#### Base source (lot 8)

Lot 8 du chantier (« Bascule 1 : la base du site de dev fait foi » ; garde-fous 5, 6 et 7 du plan). Code : `serveur/base-source.mjs`, `serveur/service.mjs`,
`deploy/installateur/installateur.sh`, `deploy/installateur/bascule.sh`, `scripts/constat-de-bascule.mjs` ; tests : `serveur-base-source`, `installateur-base-source`, `bascule`,
`bascule-constat`. **Rien ne pose le marqueur hors de `bascule.sh`**, que le propriétaire lance le jour de la bascule : sans lui, tout fonctionne comme avant.

- **Le marqueur** est un **fichier**, `db/source`, dans le dossier de la base vivante (jamais un réglage ni une variable) ; son contenu est indicatif (`format=maverick-source/1`, `pose_le`,
  `version`, `empreinte` du contenu de la base au constat, `sauvegarde` nommée). Le service le relit à chaque préparation de la base ; `bascule.sh` le pose, puis relance le service.
- **Jamais refaite depuis les règles.** Avec le marqueur, ni le démarrage ni la surveillance du fichier des règles ne refont la base (journal : « base des règles changée : la base est la
  source (db/source), elle n'est pas refaite ») : pas de rejeu du journal, pas d'`integrerLivrees`, pas d'archive de reconstruction, pas d'essai dans l'ombre (sans objet). **Base absente** :
  le service **ne démarre pas** (`ATTENTION base source absente : <chemin>, la restaurer depuis une sauvegarde, jamais depuis le dépôt`, puis sortie de code 1 : `index.mjs`) ; retirée
  pendant qu'il tourne, elle n'est pas recréée, `/api/etat` dit l'erreur et toute écriture répond 503.
- **Structure, avant toute écriture** (`preparerBaseSource`). Les migrations livrées (`_serveur/data/`) de numéro > `user_version` sont **essayées sur une copie** (`essayerSurUneCopie`, copies
  dans `db/essai-de-structure/`, toujours effacées), puis **appliquées sur place** (`appliquerSurPlace`, sauvegarde `structure-<instant>-v<version>.db` dans `db/archives/`, les 5 plus récentes
  gardées) ; ensuite la structure, migrée ou non, est comparée au `schema.sql` livré, `user_version` comprise (`ecartsAvecLeSchema`). Une base sous le plancher sans migration livrée pour y
  monter est refusée avant la comparaison par le même refus que l'essai (`structure-sur-place.mjs#refusSousLePlancher` : étape `schema`, `refus.etape` `plancher`, versions nommées). Migrations ou schéma non livrés, essai refusé, application
  en échec (le `ROLLBACK` laisse la base telle qu'elle était) ou structure différente (une publication plus ancienne que la base, par exemple) : le service **ne démarre pas**, la raison au
  journal (catégorie `base`, préfixe `ATTENTION`) et l'évènement `base_source` dans les métriques (`erreur` : l'étape `absente`, `non_livrees`, `essai`, `application`, `schema` ; le numéro de
  migration ; jamais un texte). Réussie : `base_source` (`appliquees`, `avant`, `apres`, `sauvegarde`) et « structure : base source migrée sur place, version A → B ». Une base remplacée
  pendant que le service tourne (une restauration) repasse par les mêmes contrôles ; refusée, elle reste fermée.
- **`vivante.json`** garde `version` (celle du service), `schema`, `source: true` et `sur_place` : la dernière application (`le`, `avant`, `apres`, `migrations` [{ numero, fichier }],
  `sauvegarde`, `essai_ms`, `duree_ms`). **`/api/etat`** : `base.source` (le marqueur présent ou non) et `base.sur_place` (`null` sans application). **`GET /api/debug/structure/`** ajoute
  `base_source` : `{ source, sur_place }` (le format `maverick-essai-etat/1` ne change pas ; la page Debug l'affiche en tête du bloc « Structure de la base », menu DB : `lib/debug-structure.mjs#htmlDeLaBaseSource`).
- **Mise à jour** : avec le marqueur, « Effectuer la mise à jour », la Simulation et « Copier vers le dépôt » figent un paquet (« Mise à jour depuis la base source (lot 8) »).
- **Lots de changements** : avec le marqueur, `POST /api/edition/lots/` donne `ouvertHorsEdition: true` à `controlerLeLot` (`serveur/api.mjs#traiterLots`) : un lot vaut pour toutes les tables de
  contenu, celles que le service d'édition ne sait pas écrire passant par la voie générique du journal ; `LOT_OUVERT_AUX_TABLES_HORS_EDITION` reste `false`, le défaut du module pur.
- **Installateur** : avec `db/source`, `--copier-base-prod` est refusé, une publication plus ancienne que la `version=` de `VERSION` aussi (avant toute écriture) ; un refus de l'essai de la
  structure arrête l'installation (« Essai avant installation »). Une instance sans `VERSION` lisible (une base restaurée avant la première installation) s'installe.
- **Le jour J** (`bascule.sh`, livré par l'installateur de test à la racine de l'instance ; `deploy/installateur/README.md`) : `geler` (fichier `GELER` et service arrêté : l'annonce de
  maintenance n'arrête pas les écritures), `constat` (dans le conteneur du service, `docker compose run` : `scripts/constat-de-bascule.mjs`, livré dans `_serveur/scripts/`, compare table de contenu
  par table de contenu l'attestation de la production, la base vivante du site de dev et son fichier des règles ; hors compte : tables propres au site et calculées, pages d'exemple ; il ne sort
  que des noms de tables et des comptes ; `EGALITE` ou la liste, code 0 ou 1), `sauvegarder` (copie `nuit` par `copie.sh`, gardée sous `<sauvegardes>/<instance>/nommees/bascule-1-<date>`,
  envoyée par `envoi.sh` avec l'étiquette `nommees,bascule-1-<date>`, gardée sans limite), `poser` (refusé sans constat `EGALITE` de moins d'une heure fait pendant ce gel ni sauvegarde
  nommée réussie depuis ; relance le service et lit `/api/etat` dans le conteneur), `retirer` (le marqueur est renommé `db/source-retire-<date>`, rien n'est effacé ; service relancé), `etat`,
  `copies` et `restaurer` (plus bas).

#### Restauration de la base du site de dev

Code : `deploy/installateur/bascule.sh` (`copies`, `restaurer`) ; test : `bascule`. Les copies sont celles des sauvegardes automatiques (« Sauvegardes automatiques ») ; restic n'est appelé que
pour une copie extérieure, avec les accès de l'envoi (`/etc/maverick-sauvegardes`, jamais en argument). Trois temps :

1. **Remettre la copie** : `restaurer --copie <type>/<nom>|derniere` (locale) ou `--exterieure <id>|latest` (restic, étiquette `inst-dev`, rendue dans `<sauvegardes>/.restauration.*`, effacé
   ensuite ; refusée, avant toute écriture, si ce n'est pas une copie du site de dev : chemin `…/dev/<type>/<nom>` et `INSTANCE=dev` dans son `copie.meta`). Sous le verrou des sauvegardes (aucune copie pendant ce temps). La copie est contrôlée avant tout geste (`PRAGMA integrity_check`, et chaque table de `vivante.db` compte les
   lignes notées dans son `comptes.tsv`) ; refusée, rien n'est touché. Puis `GELER` (s'il manque), service arrêté, `vivante.db` (et ses `-journal`, `-wal`, `-shm`) et `vivante.json` renommés dans
   `<dev>/var/avant-restauration-<date>/` (même disque, rien n'est effacé), la copie posée d'un coup (fichier provisoire, puis renommé), le service relancé, `GELER` retiré s'il l'a posé, et
   `/api/etat` lu dans le conteneur. `db/source` n'est pas touché : avec lui, le service essaie puis applique sur place les migrations livrées que la copie n'a pas (« Base source (lot 8) ») ;
   s'il les refuse, il ne démarre pas, la base d'avant reste dans `var/`.
2. **La remonter au dernier paquet livré.** Le report se refait seul : `serveur/paquet.mjs#actualiser` (à chaque `GET /api/mise-a-jour/`, et par la minuterie tant que le dernier lancement a
   moins de 4 h) reporte la note de tout paquet de `db/mise-a-jour/` dont la base n'a pas la note et que la production publie (`noteLivree`). Conditions : le fichier du paquet est encore là
   (les 3 plus récents sont gardés, et tout paquet de mise à jour non reporté dans la base où se fait la purge) ; la production publie la note de ce lot. **Limite** : le report n'apporte que
   la note, l'historique et l'état `integree` des modifications ; il ne remet pas le contenu. Un paquet figé **après** la copie a livré à la production un contenu que la base restaurée n'a
   pas : `restaurer` le signale (« ATTENTION le paquet … a été figé après cette copie », d'après la date du fichier), et `reporterPaquet` **refuse** alors le report (rien n'est écrit ;
   « ERREUR mise à jour : report de la note… » au journal et `erreur_report` dans le lancement, retenté à chaque suivi) : un lot que le paquet a versé dans l'historique n'est ni dans
   le journal (`modification_lot`) ni dans l'historique de la base. Critère sûr (chaque lot versé venait du journal de la base source) et d'une requête par lot ; des empreintes de
   tables ne conviendraient pas, la base ayant pu changer depuis le paquet. Le contenu du paquet est alors à refaire sur le site de dev, sa note disant quoi.
3. **Rejouer les lots écrits depuis** : rien ne le fait. Les modifications et lots de changements écrits après la copie ne sont que dans la base gardée à part (`var/avant-restauration-*`),
   si elle se lit encore ; la copie horaire (prise chaque heure où la base a changé) borne la perte à une heure d'écritures, la copie extérieure de nuit à une journée. Les numéros donnés
   depuis la copie (`numero_donne`) peuvent être redonnés par la base restaurée.

#### Répétition de la mise à jour de la production

Code : `deploy/installateur/repetition-prod.sh` (posé par l'installateur de test à la racine de l'instance, comme `bascule.sh`), `scripts/repetition-prod.mjs` (livré dans `_serveur/scripts/`) ;
test : `repetition-prod`. Avant la dernière mise à jour par l'ancien circuit (lot 8), il joue sur une **copie** ce que le service de la production fera de sa base en recevant le contenu du
site de dev, autant de fois qu'on veut, sans jamais toucher à la production.

- **La copie** : la base vivante de la production lue en lecture seule (`sqlite3 .backup`, comme `copie.sh`) ou, avec `--depuis-la-sauvegarde`, sa dernière copie locale ; avec sa `vivante.json`.
  Dossier de travail `<dev>/var/repetition-prod.*` (700), refusé sans la place de 4 fois la base de la production plus celle du site de dev plus 64 Mio ; effacé à la fin (`--garder` le garde).
- **Dans un conteneur du code du site de dev** (`docker compose run --rm --no-deps -T` du service `serveur` de son instance, dossier de travail monté sur `/repetition`) : le contenu à venir est
  l'extrait de la base du site de dev (`serveur/extrait.mjs#fabriquerExtrait` : tables de contenu, modifications en attente versées dans l'historique) ; puis `preparerBaseVivante` en mode
  production (sans essai dans l'ombre) sur la copie. Écarts avec le vrai fichier des règles : les tables calculées (liens, recherche) sont celles de la base du site de dev, et la vue
  `extrait_meta` s'y ajoute ; aucun n'entre dans le contrôle des fiches.
- **Rapport, des comptes seulement** (une valeur citée par un problème est masquée : `« … »`) : `PASSERA` (code 0) ou `REFUSEE` (code 1 : la production garderait sa base, son nouveau service
  tournerait sur elle ; les problèmes par table et colonne, avec leur nombre de lignes) ; schémas avant et après ; fiches avant et après ; lignes des tables de fiches qui changent ; fiches
  adaptées par nature (`ORDRE_DES_NATURES` : fiches et éléments, d'après l'évènement `retraits_fiches` de `preparerBaseVivante`, qui porte `natures`) ; contrôle de la base refaite (intégrité,
  clés rompues des fiches et du contenu) ; taille de l'archive ; tables en « chute anormale » pour la copie horaire suivante (seuils `CHUTE_POURCENT` et `CHUTE_MIN_LIGNES` des sauvegardes :
  la copie sera mise de côté jusqu'à `copie.sh accepter prod`) ; durées et place. Code 2 : répétition impossible.

#### Essai avant installation

Avant de remplacer le site, l'installateur fait essayer les migrations qu'il livre **par le service en place**, sur une copie de la vraie base : un seul programme touche la base à la fois, et ce n'est jamais l'installateur. Code : `serveur/essai-de-structure.mjs` (service),
`deploy/installateur/installateur.sh` (`essayer_la_structure`) ; tests : `serveur-essai-de-structure`, `installateur-essai-de-structure`. Les deux instances le font, la production comprise ; aucun geste du propriétaire, `docker-compose.yml` ne change (la demande passe par `db/`, déjà monté dans le conteneur).

- **Protocole** (tout sous `db/essai-de-structure/` de l'instance ; l'installateur n'y touche qu'à sa propre demande, et nulle part ailleurs dans `db/`).
  - L'installateur pose `demande-<version>-<pid>/` **d'un coup** (dossier provisoire `.depot-<pid>`, puis `mv`) : `demande.json` (`{ format: 'maverick-essai-demande/1', version, tag, deposee_le }`), `migrations/*.sql` et `schema.sql` **de la livraison** (extraits dans son dossier de travail, pas encore posés dans `site/`).
  - Le service accuse : `accuse.json` (`{ format: 'maverick-essai-accuse/1', recu_le, rang }`) dès qu'il voit la demande, même si un autre essai tourne (un seul à la fois, dans l'ordre des noms). L'installateur sait alors qu'un service lui répond.
  - Puis il essaie, avec **les migrations et le `schema.sql` de la demande** (pas les siens), sur une copie de sa base vivante (`VACUUM INTO`, base ouverte en lecture seule ; `essayerEnArrierePlan`), et écrit `resultat.json` dans le dossier de la demande : le bilan `maverick-structure/1` (`verdict` : `accepte`, `refuse`, `a_jour`, `indisponible`) plus `demande` { nom, version, deposee_le }, `essaye_le`, `instance` (`prod` ou `dev`) et `resume` (une phrase, jamais un nom de fiche). Chaque fichier est écrit d'un coup (fichier provisoire, puis renommé). Le JSON est indenté de deux espaces, `verdict` et `resume` au premier niveau : le shell de l'installateur les lit avec `sed`, sans JSON.
  - Le même résultat est gardé dans `db/essai-de-structure/dernier.json`, journalisé (catégorie `base`, « structure : essai de la livraison … » ; niveau `avertissement` pour un refus ou un essai indisponible) et noté dans les métriques (évènement `structure_essai` : verdict, version, nombre de migrations ; jamais le texte du refus).
  - Les copies d'un essai (`structure-essai-*.db`, dans ce même dossier) sont **toujours effacées** : à la fin de l'essai, même en échec, et à l'ouverture du service. Sans la place de deux copies plus une marge (3 × la base + 64 Mio), l'essai n'est pas lancé : `indisponible`, raison dite. Une demande abandonnée (un installateur tué) est retirée au bout d'une heure, à l'ouverture et à chaque passage ; seuls les noms `demande-…` et `.depot-<pid>` peuvent être retirés, jamais un autre fichier ni dossier. Si le fil de l'essai meurt, le service efface aussitôt les copies qu'il a laissées (un seul essai tourne à la fois).
- **Ce que fait l'installateur** (avant la synchronisation du site ; jamais pour une première installation — pas de `VERSION` ni de `db/vivante.db` —, ni avec `--copier-base-prod`). Il attend `accuse.json` au plus `MAVERICK_ESSAI_ACCUSE_S` (20 s) puis `resultat.json` jusqu'à `MAVERICK_ESSAI_DELAI_S` (120 s, compté depuis le dépôt), en regardant chaque seconde. Il écrit le verdict dans `installation.log`, retire sa demande, et :
  - **pas de réponse** (service arrêté, version du service sans cet essai : aucun accusé), délai dépassé, réponse illisible, `indisponible`, `a_jour` : noté, **l'installation continue** ;
  - **refus** : noté (`ATTENTION essai de la structure REFUSÉ…`), l'installation continue, **sauf si `db/source` existe** : il s'arrête alors avant d'avoir rien installé (code 1, `site/` et `VERSION` intacts). `db/source` est le marqueur du lot 8 (garde-fou 6 du plan : la base de l'instance est la source de vérité ; « Base source (lot 8) », plus haut) : seul `bascule.sh` le pose, le jour de la bascule ; avant, ce refus n'est jamais déclenché.
  - Le dossier `essai-de-structure/` ne compte pas pour un `db/` rempli (`--copier-base-prod` reste permise dans un `db/` qui n'a que lui et `metriques/`) et n'est jamais copié de la production.
- **Surveillance.** Un `readdir` de `db/essai-de-structure/` toutes les 3 s (`INTERVALLE_DES_DEMANDES_MS`, au plus l'intervalle de la surveillance des fichiers ; dossier absent : rien d'autre à faire), sans `fs.watch` (un dossier monté depuis l'hôte n'en garantit pas les évènements). Le travail lourd tourne dans un fil à part, un essai à la fois : sur la base de développement du dépôt (25 Mio), un essai prend environ 0,7 s de CPU et 50 Mio de disque le temps de l'essai, une fois par installation. Une demande déjà répondue (`resultat.json`) n'est jamais refaite après un redémarrage. La base vivante n'est pas en WAL : pendant le `VACUUM INTO` de l'essai, une écriture du service attend la fin de la copie (quelques dizaines de millisecondes pour la taille actuelle, 31 Mio ; le même verrou que la sauvegarde horaire `.backup`). Au-delà de `busy_timeout` (5 s, vers 3 Gio), l'écriture échouerait.
- **Page Debug.** `GET /api/debug/structure/` (site de dev, classe `lecture`, `Cache-Control: no-store`) : `{ format: 'maverick-essai-etat/1', en_cours: { demande, version, depuis } | null, en_attente, dernier, ombre }` (`ombre` : l'essai dans l'ombre, « Essai dans l'ombre » plus bas) ; `dernier` est le contenu de `dernier.json` (`null` tant qu'aucun essai n'a eu lieu, relu du disque : il survit à un redémarrage). Le format est stable : l'affichage de la page s'appuie sur lui.

#### Essai dans l'ombre

Quatrième PR du lot 7. Le circuit **ne change pas** : la base du site de dev est toujours refaite depuis les règles, puis le journal est rejoué (« Quand refait-on la base vivante ? »). À chaque **installation**, le service prouve en plus, sur les vraies données du site de dev, que **migrer la base sur place donnerait la bonne base** : c'est ce que le lot 8 mettra en service. Code : `serveur/essai-dans-l-ombre.mjs` ; tests : `serveur-essai-dans-l-ombre`. Aucun geste du propriétaire, `docker-compose.yml` ne change.

- **Quand.** Site de dev seulement (`edition` : la production n'en fait jamais, et sa `vivante.json` reste telle qu'avant). Quand `preparerBaseVivante` **refait une base qui existait** ET que le site ou la base a changé de version (`uneInstallation` : la `version` de `vivante.json` n'est pas celle du service qui démarre, ou son `schema` n'est pas la `user_version` de la base refaite) : une installation, jamais une simple relance (mêmes versions, règles ou contenu changés) ni une première création. Une version « inconnue » ne permet pas de conclure.
- **Les deux copies.** Juste avant que la base refaite remplace l'ancienne (tout est synchrone : aucune écriture ne passe entre les deux), `preparerBaseVivante` donne la main à `ombre.preparer` : la base d'**avant** (`VACUUM INTO`, base ouverte en lecture seule) et la base **refaite** (copie du fichier neuf, fermé) vont dans `db/essai-de-structure/` (`structure-essai-<pid>-<uuid>-ombre-avant.db` et `-ombre-apres.db`). Même contrôle de place que l'essai avant installation (3 × la base + 64 Mio) : sans elle, rien n'est copié, l'essai est `indisponible`. Coût au démarrage, base du dépôt (30 Mio) : environ 0,1 s, une fois par installation.
- **L'essai** (`comparerDansLOmbre`, un fil à part lancé **après l'ouverture du service**, jamais pendant son démarrage ; **un seul à la fois**, dans la même file que l'essai avant installation : `executerEnArrierePlan`). Les migrations livrées (`_serveur/data/`) sont appliquées **en place** à la copie d'avant (`appliquerSurPlace`, sans sauvegarde) : c'est la base « migrée sur place ». La base refaite n'est ouverte qu'en lecture seule. Comparaison de **structure** (`comparerLesSchemas`, plus la `user_version`), puis **table par table** (`bilanDesTables` : l'empreinte de `serveur/empreintes.mjs`, puis les lignes `ajoutees` (la base refaite en a plus), `retirees` (elle en a moins) et `modifiees` par clé primaire). Les copies sont **toujours effacées** (fin de l'essai, même en échec ; ouverture du service ; `purgerLesEssaisDeStructure` ; une purge d'un essai avant installation raté les laisse à leur essai). **Rien n'est écrit dans la vraie base** : l'essai ne la connaît pas, il ne voit que ses copies. Un essai qui échoue (fil mort, panne, disque) n'arrête ni le site ni l'installation : il rend `indisponible`, dit sur la page Debug. Coût, base du dépôt : environ 0,7 s de CPU dans le fil, 60 Mio de disque le temps de l'essai, une fois par installation.
- **Les empreintes des règles d'avant.** Avec l'essai, `vivante.json` garde `tables_regles` : l'empreinte (16 premiers caractères) de chaque table de **contenu** des règles dont la base est faite, calculée à la reconstruction **avant** le rejeu du journal (`empreinteLogique` la rend déjà : aucun calcul de plus). Le rapport compare celles d'avant à celles de la livraison. À la **première installation** qui suit ce changement, `vivante.json` ne les a pas : la catégorie vaut `inconnu`, et le rapport le dit (`regles_d_avant: 'inconnues'`).
- **Rapport** (`ombre.json`, écrit d'un coup ; format `maverick-ombre/1`) : `verdict`, `resume` (une phrase, jamais un nom de fiche ni une valeur), `fait_le`, `instance`, `version` { avant, apres } (du site), `schema` { avant, apres } (de `vivante.json`), `versions` { avant (la base d'avant), migree, refaite } (`user_version`), `migrations` [{ numero, fichier }] (celles appliquées), `regles_d_avant` (`connues` ou `inconnues`), `structure` { identique, ecarts (au plus 20 phrases) }, `tables` (les seules tables qui **diffèrent**, les plus graves d'abord : `table`, `classe`, `categorie`, `gravite`, `ajoutees`, `retirees`, `modifiees`, `raison`), `chiffres` { `tables_comparees`, `tables_identiques`, `tables_differentes`, `par_categorie` { <catégorie> : { tables, ajoutees, retirees, modifiees } } }, `duree_ms` ; `refuse` ajoute `refus` { migration, fichier, etape, raison, details } et `retour_arriere` ; `indisponible` ajoute `raison`.
- **Catégories d'une table qui diffère** (d'après `lib/tables-de-la-base.mjs`, jamais d'après son nom) :

| Catégorie | `gravite` | Sens |
| --- | --- | --- |
| `structure` | `grave` | colonnes (ou leur ordre) différentes, table présente d'un côté seulement ou renommée |
| `propre_au_site` | `grave` | fiches, comptes, groupes, journal, brouillon de la note : la migration sur place doit les garder tels quels |
| `inattendu` | `grave` | table de contenu dont les règles n'ont **pas** changé et qui diffère pourtant, ou table que le classement ne connaît pas |
| `livre_par_le_depot` | `attendu` | table de contenu dont les règles ont changé dans la livraison : le contenu arrive par le dépôt, ce que le lot 8 supprimera |
| `inconnu` | `attendu` | table de contenu, faute d'empreintes d'avant : on ne sait pas si le dépôt l'a changée |
| `calculee` | `ignore` | table calculée par le build (liens, recherche plein texte) : comptée, jamais jugée |
| `ignoree` | `ignore` | `migration_recue`, dont le mode diffère par construction (`reconstruction` contre `sur_place`) |

- **Verdicts.** `identique` : aucune différence (les tables `ignoree` ne comptent pas). `attendu` : seulement des `livre_par_le_depot`, `inconnu` ou `calculee` ; tant que le contenu arrive par le dépôt (jusqu'au lot 8), c'est le meilleur résultat d'une livraison qui change des règles. `ecart` : un écart de schéma (ou de `user_version`), une table `structure`, `propre_au_site` ou `inattendu` : la migration sur place ne donne pas la base que le circuit refait. `refuse` : l'application sur place a été refusée (garde-fous d'`appliquerSurPlace` : migration, étape, raison). `indisponible` : pas de base d'avant, pas de place, migrations ou `schema.sql` non livrés, panne du fil. Limite : une table que le dépôt a changée **et** qu'une migration a réécrite est rangée `livre_par_le_depot` : l'essai ne sépare pas les deux.
- **Journal, métriques, Debug.** Journal (catégorie `base`, « structure : essai dans l'ombre de la livraison … » ; niveau `avertissement`, préfixe `ATTENTION`, pour `ecart`, `refuse` et `indisponible`) ; évènement `structure_ombre` (verdict, version, migrations, étape d'un refus, nombres de tables ; jamais un texte). `GET /api/debug/structure/` ajoute `ombre` : `{ en_cours: { version, depuis, etat: 'en_attente' | 'en_cours' } | null, dernier: <ombre.json> | null }` (`null` partout sans l'essai : la production ne répond pas à cette route). Le format `maverick-essai-etat/1` ne change pas, le champ s'ajoute.

## L'API

| Requête | Réponse |
| --- | --- |
| `GET /api/maintenance/` | `{ active }` : ce serveur est-il en maintenance (« Maintenance pendant une mise à jour », plus bas) ; en maintenance, aussi `version_cible`, `depuis`, `etape` (et, sur le site de dev, `lot`, `run`, `levable`). Répond sans la base |
| `GET /api/etat/` | Version du service, état de la base vivante (`disponible`, `a_jour`, `erreur`, `regles`, `schema`, `refaite_le`, `retraits` : les fiches adaptées par la dernière reconstruction qui a retiré quelque chose, R42, ou `null` ; `pretires`) |
| `GET /api/personnages/` | `{ personnages: [...] }` : résumé de chaque prétiré (nom, portrait — `null` ou `{ empreinte, style }` : l'empreinte de l'image et le style qui en montre le carré cadré, `lib/portrait.mjs#styleDuCadrage` —, race, ethnie, magies, dieu, métier, classes et spécialités, niveaux, nombre de règles enfreintes, dates) |
| `POST /api/personnages/` | Crée un prétiré → `201`, `Location`, `{ personnage, controles, niveau }` |
| `GET /api/personnages/<id>/` | `{ personnage, controles, niveau }` |
| `PUT /api/personnages/<id>/` | Modifie → `{ personnage, controles, niveau }` |
| `DELETE /api/personnages/<id>/` | Supprime, corps `{ "version": … }` (celle de la fiche lue) → `{ supprime }` ; `409` si elle a changé entre-temps |
| `GET /api/personnages/<id>/portrait/` | L'image du portrait, telle quelle (pas du JSON : `Content-Type` de l'image, WebP, JPEG ou PNG), pour la liste des personnages qui n'en reçoit que l'empreinte ; `ETag` = l'empreinte, `304` si le navigateur l'a déjà (`If-None-Match`) ; `404` sans fiche ou sans portrait |
| `GET /api/tipeee/` | `{ paragraphes, lu_le, origine }` : la partie « Bienvenue » de la page Tipeee (de « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu'à la fin), en paragraphes de **texte seul** (jamais de HTML ; dans un paragraphe, `\n` est un retour à la ligne), que la page Bienvenue met à la place de l'instantané de son build s'il diffère. `lu_le` : quand ce texte a été lu ; `origine` : `tipeee` (lu il y a moins que la durée du cache, Tipeee ouvert) ou `repli` (le dernier texte connu, Tipeee n'ayant pas répondu ou n'ayant plus le repère, ou l'instantané livré avec le site) ; aucun texte connu : `paragraphes` vide, `lu_le` `null`. Sur **les deux instances**, sans la base. Voir « Hébergement » |
| `POST /api/classeur/` | Corps `{ "url": "https://docs.google.com/spreadsheets/d/<id>/…" }` (« Importer (en ligne) » de `/fiche/`) → les octets `.xlsx` de la feuille, partagée par lien (pas du JSON : `Content-Type` du classeur, son nom dans `Content-Disposition`). Sur **les deux instances**, sans la base (répond pendant qu'elle se refait). `400` lien qui n'est pas celui d'une feuille Google Sheets ; `403` feuille non partagée par lien (Google renvoie vers sa page de connexion, répond 401 ou 403, ou rend une page HTML) ; `404` feuille introuvable ; `413` plus de 16 Mio ; `429` plus de 2 téléchargements à la fois ou de 30 par minute (tout le service), ou Google qui limite ; `502` Google en panne, injoignable ou qui renvoie ailleurs ; `504` plus de 20 s. Voir « Hébergement » |

Les adresses finissent par « / », comme celles du site : en développement, Astro refuse une adresse sans « / » finale avant de la transmettre au
service (qui accepte les deux formes).

**Une fiche en JSON** (`fiche-format.mjs`) : les colonnes de `personnage` à la racine, sous leur nom ; une liste par table de détail
(`classes`, `caracteristiques`, `competences`, `entrainements`, `acquis_choix`, `resistance_choix`, `metier_bonus`, `capacites`, `dons_obtenus`, `sorts`, `livres_sorts`, `maitrise_choix`, `armes`,
`armure_parties`, `accessoires`, `inventaire`, `ceinture`, `actions_usage`), chaque ligne avec les colonnes de sa table sans `personnage_id` ; et `version`.
`specialisations_magie` (`[{ magie_id, specialisation_id }]`, décision R236, migration 0118) : la spécialisation magique choisie pour chaque magie de la fiche ; une
seule par magie (`400` « une seule spécialisation par magie de la fiche »), de cette magie (clé étrangère composée : `400` « n’existe pas dans les règles » sinon) ;
une ligne = un choix fait, aucune ligne = choix en attente ; celle d'un mono-magie ou d'un Potentiel Illimité s'enregistre, sans effet. Les contrôles
`sort_hors_specialisation` et `specialisation_hors_magie` du bi-magie sont ceux de `v_personnage_controle`.
`dons_obtenus` (`[{ source, entree_id }]`, décision R181, migration 0088) : l'entrée du tableau du Mage Bleu (`classe_annexe_entree`) qu'obtient chaque
don « Variable » (`source`) ; un choix par don (`400` « un don « Variable » n’obtient qu’une entrée ») et une entrée une seule fois par fiche (`400`
« … chaque entrée ne se prend qu’une fois (décision R181) ») ; une entrée hors de la liste du don, ou d'un don qui n'est plus acquis, s'enregistre et
est signalée (`v_personnage_controle`). Une page restée ouverte qui envoie encore
`bouclier_materiaux` (avant la migration 0060) voit sa liste convertie en matière du bouclier, les autres matériaux notés (avec les nouvelles clés du
bouclier : `409`) ; des accessoires avec un nom, un effet hors table ou un emplacement Ceinture ou Autre sont convertis de même (`sansPartiesRetirees`) ;
un texte `entrainement` (avant la migration 0062) devient des lignes de texte de `entrainements` (une par ligne du texte ; avec des lignes déjà là :
`409`) et l'`acquis` d'une compétence n'est plus repris, noté, daté, dans les notes (décision R104 : l'Acquis se calcule) ; des `sorts[].nm_cadeau`
(avant la migration 0066) donnent leur somme à `nm_mj` (décision R118 : les NM du MJ valent pour toute la fiche ; avec `nm_mj` et un `nm_cadeau`
positif : `409`, `nmDuMjAvecCadeaux`) ; des `sorts[].nm_livre` (avant la migration 0082) donnent les livres de la fiche, `livres_sorts`
(`[{ sort_id, rang }]`, un par sort à 1, dans l'ordre de la liste : décision R169, `livresDesSorts` ; avec `livres_sorts` et un `nm_livre` à 1 :
`409`, `livresAvecLivresDesSorts`) ; le `niveau_maitrise` d'un sort reste son NM, toutes origines comprises. Un livre se note sur n'importe quel sort,
choisi ou non (R169 : sur un sort non choisi, il est en attente, son NM n'est pas utilisé) ; un par sort (R26 : `400` « en double (sort_id) ») ;
une liste `maitrises_armes` (les dés par famille, avant la migration 0076) et l'`arme_famille_id` d'un choix
d'acquis sont retirées et notées en une ligne datée (R153, comme la base vivante ; aucun choix posé), et, envoyées avec `maitrise_choix` (une page
d'avant qui a repris une réponse), refusées : `409`, `maitrisesAvecChoix`. L'armure (décision R165) : la fiche enregistrée (l'envoi, avec les
colonnes qu'il ne change pas) qui porte une armure **et** une armure élémentaire (l'« élément » d'une page d'avant) est **convertie** comme à la
reconstruction, plutôt que refusée (c'est la forme d'avant elle-même, que R165 convertit, pas deux formes qu'on ne sait pas concilier) ; une armure
« Familier », une armure élémentaire d'une magie absente et une armure trop lourde pour le poids portable de la fiche enregistrée (classe, niveau,
dons, race, magie innée : un changement de classe qui le baisse retire l'armure ; le calcul de la reconstruction, `poidsPortableDeLaBase`, option
`poidsPortable` d'`enregistrerFiche`) ne sont jamais enregistrées : retirées et notées, datées, dans la réponse (`retirerLesArmuresHorsRegle`, après
l'écriture, dans la même transaction ; puis `noterLesRetraits`). La page `/fiche/` convertit de même une fiche
importée qui porte les deux (`sansPartiesRetirees`, `armureTransformee`). Une arme d'avant la migration 0081 (un élément posé sur une arme du
catalogue, `armes[].amelioration_elementaire_id`) prend la forme de la décision R167 (`armesDAvant`, la même règle que la base vivante), ce qu'elle perd
noté, daté. Une arme est une arme du catalogue **ou** une arme élémentaire (`armes[].arme_id` ou `armes[].arme_elementaire_id`) : aucune des deux,
ou un matériau sur une arme élémentaire, est refusé (`400`, message en français : `CHECKS_DE_LA_FICHE` de `serveur/fiches.mjs`) ; de même un type de
dégâts choisi (`armes[].type_degats_choisi` : taille, estoc ou frappe, celui de la Bombe « au choix », R167) sur une arme du catalogue. Sur une arme
élémentaire dont le type ne se choisit pas, ou hors des types de son type élémentaire, il est signalé (règle `arme_type_degats_choisi`), jamais
refusé. Une arme d'avant convertie n'a pas de type choisi (NULL) ; sur une base d'avant 0081, `type_degats_choisi` vide est ignoré
(`DEPART_DES_COLONNES_AJOUTEES`). Rien de calculé n'y est
stocké. Les maîtrises d'armes sont des choix : `maitrise_choix`, une ligne par point à choisir d'une source (`source` : l'id du don, ou
`<classe>#maitrise-arme:<rang>` pour une ligne de maîtrise de classe ; `rang` : le numéro du point ; `arme_famille_id`), les points et les dés de chaque
famille se calculent (R148, R149 ; vue `v_personnage_maitrise_arme`). Les gains de niveau sont deux colonnes (`gains_sante`, `gains_chakra` : décision R73, migration 0045) ; la durabilité d'une arme est une
colonne de sa ligne (`armes[].durabilite`, R74) ; l'entraînement, des lignes (une compétence et ses points, ou un texte : `entrainements`, R104).

```json
{ "nom": "Aldric", "race_id": "races/humain", "magie_innee_id": "magies/magie-du-feu", "xp": 0,
  "classes": [{ "rang": 1, "classe_id": "classes/guerrier", "specialite_id": null }],
  "caracteristiques": [{ "caracteristique_id": "force", "base": 4, "croix": 0 }] }
```

- **Création** : les colonnes absentes prennent la valeur d'une fiche vide (`ficheVide` : mono-classe, 0 XP, alignement, bourse,
  ambidextrie, gains de niveau et NM du MJ à zéro). Le service fixe l'identifiant (UUID), la nature (prétiré), le propriétaire (aucun), la visibilité (tous) et les dates.
- **Modification** : `version` (celle de la fiche lue) est obligatoire ; si la fiche a changé depuis, rien n'est écrit et la réponse `409` rend la
  fiche à jour. Une colonne absente garde sa valeur ; une liste présente remplace toute la liste, une liste absente ne change pas. La version est
  l'empreinte du contenu : une fiche dont une règle supprimée est retirée (R42 : liste, notes et date changent) change de version ; un élément
  seulement renommé ne la change pas (la fiche n'a que des identifiants).
- **Refus** (`400`, rien n'est écrit) : `{ erreur, problemes: [...] }`, un message par problème, en français (« caracteristiques[0] : valeur
  hors des bornes (base >= 1) », « « race_id » : « races/x » n'existe pas dans les règles (race) », champ inconnu…). Une colonne que les règles ont
  retirée (`COLONNES_RETIREES` de `fiche-format.mjs` : `statut`, migration 0038 ; `entrainement` et `competences[].acquis`, 0062 ; `sorts[].nm_cadeau`,
  0066 ; `acquis_choix[].arme_famille_id`, 0076 ; `armes[].amelioration_elementaire_id`, 0081 ; `sorts[].nm_livre`, 0082 ; convertis plus haut)
n'est pas un champ inconnu : elle est ignorée (fichier exporté avant).
  La clé d'une table retirée non plus (`TABLES_RETIREES`, `sansPartiesRetirees`) : une `progression` reçue (page restée ouverte, fichier d'avant la
  migration 0045) devient `gains_sante` et `gains_chakra` quand la fiche ne les porte pas. Avec eux, une `progression` vide est jetée sans rien
  dire (le reste de la fiche vide d'une page d'avant, qui a repris les deux totaux d'une réponse du service), mais une `progression` **non vide** est
  refusée : `409`, `{ erreur }` sans `personnage` (« La page vient d'une version précédente du site : rien n'a été enregistré. Rechargez-la… »),
  rien n'est écrit. Ses lignes peuvent être des gains nouveaux ou les anciens saisis de nouveau dans l'ancienne interface, vidée par la réponse :
  on ne sait pas les concilier avec les totaux (`progressionAvecGains` de `fiche-format.mjs`).
  **Repli sur une base vivante d'avant 0045** (sa reconstruction a échoué, le service continue avec elle) : la page à jour envoie toujours
  `gains_sante` et `gains_chakra` (0 dans une fiche vide). Une colonne ajoutée par 0045 que la base n'a pas (`gains_sante`, `gains_chakra`,
  `armes[].durabilite` : `DEPART_DES_COLONNES_AJOUTEES` de `serveur/fiches.mjs`) est **ignorée tant qu'elle ne porte rien** (sa
  valeur de départ, 0 pour les gains, ou vide : `null`, `""`) : la fiche se crée, se lit, se liste et se modifie, et ses gains niveau par niveau
  restent dans `personnage_progression`, convertis à la reconstruction suivante (la fiche relue n'a pas de gains : la page affiche 0). Une autre
  valeur (des gains, une solidité saisis) est **refusée**, « champ inconnu » (`400`) : rien n'est écrit, rien n'est perdu sans
  le dire. De même pour les colonnes des migrations 0055 (l'armure), 0060 (le bouclier : `bouclier_materiau_id`, `bouclier_amelioration_id`,
  `bouclier_solidite`), 0061 (`symbiose_magie_id`, la magie de la posture Symbiose) et 0066 (`nm_mj`, les NM du MJ : à 0 ignoré, une autre valeur
  refusée ; la page convertissant elle-même les `nm_cadeau` lus en `nm_mj`, une fiche qui a des NM du MJ ne s'enregistre pas sur cette base), 0084
  (`mode_hyper`, `mode_hyper_100`, `mode_hyper_semaine`, le Mode Hyper activable, R172 : décochés et compteur au maximum ignorés, un autre état refusé),
  0086 (`prepare_hyper`, `prepare_cent` de `personnage_sort`, un sort préparé en Mode Hyper ou au Mode Hyper 100 %, R172 : à 0 ignorés, à 1 refusés) et
  0089 (`prepare_critique` de `personnage_sort`, la réussite critique figée du sort préparé, R182 : vide ignorée, notée refusée) ; sur une
  base d'avant 0060, la page convertit elle-même la fiche lue (accessoires d'avant, matériaux du bouclier) et note, datés, ce qu'elle perd. Une table de la fiche que la base n'a pas encore
  (`personnage_armure_partie`, 0055 ; `personnage_entrainement` et `personnage_acquis_choix`, 0062 ; `personnage_resistance_choix`, 0069, la
  résistance au choix du Drakos orange, liste `resistance_choix` ; `personnage_maitrise_choix`, 0076, liste `maitrise_choix`, les anciens dés laissés
  intacts pour la reconstruction suivante ; `personnage_livre_sort`, 0082, liste `livres_sorts` : un livre ne s'enregistre pas sur cette base ; `personnage_action_usage`, 0085, liste
  `actions_usage` ; `personnage_don_obtenu`, 0088, liste `dons_obtenus` ; `personnage_specialisation_magie`, 0118, liste `specialisations_magie`, la spécialisation magique choisie par magie, R236) se lit vide, et une liste non vide pour elle est
  refusée (« pas encore dans cette base, ses lignes seraient perdues ») ; une colonne retirée qu'une base d'avant exige encore (`statut`,
  `competences[].acquis`) y prend sa valeur de départ.
- **Contrôles** : les règles de `v_personnage_controle` enfreintes sont rendues avec chaque fiche ; toute fiche est contrôlée, même inachevée, et
  les contrôles n'empêchent jamais d'enregistrer (une fiche n'a plus de statut brouillon / validé / archivé : demande du propriétaire, migration 0038).
  Pour les maîtrises d'armes (migration 0076) : `maitrise_a_choisir` (un point d'une source acquise sans famille), `maitrise_hors_choix` (une famille
  que la source ne propose pas), `maitrise_meme_famille` (une limite écrite dépassée, R150), `maitrise_plafond` (plus de 4 points sur une famille,
  R149), `maitrise_source_perdue` (le choix d'une source qui n'est plus acquise) et `maitrise_arme_exclue` (ARME DE MONSTRES, R45) : signalés, jamais
  refusés ; seules les contraintes de la base refusent (un rang de point sous 1, une famille inconnue).
  On peut **supprimer** un prétiré (demande du propriétaire) : la fiche et toutes ses lignes disparaissent (`ON DELETE CASCADE` ; une inscription dans un groupe passe à `NULL`), sans retour possible.
- **Écritures** : corps JSON (`Content-Type: application/json`) d'au plus 1 Mo, et pas de requête qu'un navigateur dit venir d'un autre site
  (`Sec-Fetch-Site`) : un formulaire ou un script d'un autre site ne peut pas écrire à la place de quelqu'un qui a le mot de passe. `POST /api/classeur/`
  suit la même garde.

## Édition des règles (site de dev)

Demande du propriétaire : sur le **site de dev seulement**, sur tous les écrans (téléphone et tablette compris depuis le 2026-10-15 : un outil pour
ceux qui bidouillent déjà, pas pour les utilisateurs finaux), les pages du guide, des races, des magies, des classes, des métiers, des armes et des armures, les panneaux de règles et les consommables de la ceinture de la page « Équipement », se modifient en place, et celles du Codex (pages du Codex et
bestiaire : « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi »). Le service n'ouvre ses routes
`/api/edition/` que s'il est lancé avec `MAVERICK_EDITION=1` (le `.env` du serveur de test, posé par `deploy/vps/instances.sh` ou l'installateur
de test ; `npm run serveur` l'ouvre par défaut, `MAVERICK_EDITION=0` le ferme) : ailleurs elles répondent `403` et `/api/etat/` dit
`edition: false`, et la page ne charge même pas l'éditeur (`src/scripts/edition.mjs`).

**Sur la page** : un crayon à cocher, à droite, passe en mode modification ; chaque champ affiché depuis la base (attribut `data-ed`,
`src/lib/edition-modele.mjs`) devient une saisie remplie avec la valeur de la base vivante. Le bouton « Enregistrer » flottant (ou Ctrl+S) envoie
toutes les modifications de la page **d'un bloc** puis repasse en lecture ; décocher le crayon les abandonne. Ce qui se modifie :

| Pages | Champs, et ce que la base recalcule |
| --- | --- |
| Guide | Titre, résumé (une ligne, obligatoire ; pas celui d'une page du Codex : `400`) et texte : éditeur en place (paragraphes, titres, citations, listes, gras, italique, barré, liens vers une page du wiki ou une adresse, tableaux, lignes, colonnes et couleur des cases), réécrit en Markdown (`lib/markdown-edition.mjs`) ; les blocs tirés de la base restent à leur place ; un ancien titre devient un alias ; un texte qui ajoute du HTML brut ou un lien non sûr (autre que http(s), mailto ou une adresse du site) est refusé, par le service puis par la mise à jour (lot reçu, puis corps des pages et texte des blocs de la chronologie et des panneaux de règles après le rejeu : `lib/markdown-sur.mjs`, `scripts/mise-a-jour-regles.mjs#texteNonSurApresLeRejeu`) et par le rapatriement (`npm run db:appliquer-edition`, après son rejeu : rien n'est écrit) ; un texte qui retire, renomme ou double une ancre figée d'intertitre (`## Texte {#ancre}`, `docs/content-guide.md`, « Ancres figées des intertitres ») est refusé (`400` qui nomme l'ancre ; tout texte Markdown de `TABLES`, `/api/v1/` et résolution d'un conflit compris : `serveur/edition.mjs#modifier`, `lib/ancres-figees.mjs#raisonDesAncresRompues`), une ancre ajoutée ou l'intertitre renommé qui garde la sienne passent |
| Races | Chaque case de l'onglet (présentation, histoire, valeurs de départ, avantages, dons et leur tableau, capacité Mode Hyper…), magies innées (une liste vide est refusée, `400` « Magies innées : une race a au moins une magie innée possible. » : décision R210 ; rien ne change, ni la liste de l'onglet ni la matrice ; la création d'une race n'est pas visée), relations entre peuples (déplacer ou ajouter une race ou une ethnie dans le tableau d'une race) ; créer une race (pure ou hybride ; en fin de la liste des races : `race.rang_liste` = le plus grand + 1, migration `0092`) ou un peuple ; l'ordre de la liste des races (ligne suivante) |
| Plan des Règles et liste des races | Lot de l'édition des menus (« changer l'ordre des menu latéraux (par un glisser déposer) », « ajouter / supprimer une page » ; réponses « Règles + Races », « Oui, par une liste », « Pages des Règles », « Titre, onglet, résumé », « Refus si citée, puis 404 » ; `serveur/edition-plan.mjs`). **Ordre d'un menu** : l'opération `ordonner` `{ onglet, ids }` (tous les identifiants des entrées du menu d'un onglet des Règles, pages, liens et entrées « bientôt », dans le nouvel ordre ; une autre liste : `409` avec `attendus`, la liste de la base) ou `{ races: 'pures' \| 'hybrides', ids }` (tous les identifiants d'un groupe de la liste des races, `lib/races-db.mjs#racesParNature` : la règle des hybrides de `race-kinds.mjs`) ; les rangs qu'occupait la liste sont redonnés dans le nouvel ordre (une race sans rang en reçoit un après tous), seules les lignes qui changent de rang sont écrites et notées. **Onglet d'une page** : `modifier` de `regles_onglet_entree.onglet_id` ; la page passe en fin du menu cible (son `rang` recalculé) ; refusé avant écriture pour la page d'ouverture d'un onglet (`409` : l'ouverture et l'ordre des onglets sont fixes, réponse « Non, fixe »), un lien ou une entrée « bientôt » (`400`). **Créer une page des Règles** : entité `page_des_regles` (table `page`) — `titre`, `onglet_id` (liste `onglets`), `resume` obligatoires, `bientot` facultatif ; adresse `/regles/<normalize(titre)>/`, figée ; un titre qui est déjà le nom d'une page (titre, slug, alias : `cle_page`) : `409` ; un identifiant déjà employé (page, journal, historique, `PAGES_SUPPRIMEES`, `PAGES_ABSORBEES`, `PAGES_RETIREES`, `NOMS_RESERVES`, id d'onglet) : suffixe `-2`, `-3`… ; corps « À compléter. », statut `draft`, famille `docs`, source « Site de dev › édition du … » (`FAMILLE_DES_PAGES_DU_SITE.guide`, comme `tools/db/pages_md.py`) ; son entrée en fin du menu de l'onglet, ou, avec `bientot` (l'id d'une entrée « bientôt » de cet onglet, dont le libellé est le titre), à sa place : l'entrée « bientôt » supprimée et la page insérée au même rang, dans le même lot. **Supprimer une page des Règles** (`supprimer` de `page_des_regles`, après confirmation) : refus avant toute écriture — `404` inconnue, `400` hors des quatre onglets (Découvrir, Guide du MJ…), `409` protégée (`details.raisons`, `lib/pages-protegees.mjs#raisonsDeProtection`, la seule source : clé étrangère sans cascade vers `page`, famille autre que `docs`, ouverture d'onglet, page nommée par `lib/livres.mjs` — création du personnage, « Par où commencer ? », page qui en absorbe une, rubriques sous la page ; pas la cible d'un renvoi d'une ancienne adresse, qui mène alors à la 404 (R185, P6) —, `PAGES_LUES_PAR_LE_CODE`, bloc `<!-- guide:… -->`), `409` citée (`details.citations`, `lib/citations-db.mjs` : `[[…]]` des textes de la base, liens écrits `/regles/<slug>/` et `guide/<slug>`, légende d'un bloc de la chronologie, balise d'un mot-clé qui mène à la page et ce mot-clé, migration `0098` ; pas la table `lien`, périmée sur le site de dev ; une page d'exemple ne bloque pas), `409` quand un mot-clé verrouillé y mène (décision R221 : son adresse ne se vide pas, `details.mots_cles_verrouilles`) ; puis son entrée de menu, puis la page (`supprimerPage`, qui refuse elle aussi une page `guide/…` protégée) ; son adresse donne la 404. Une contrainte vérifiée au `COMMIT` (la clé différée de la page d'ouverture) : `422`. La page lit le plan vivant par `GET /api/edition/plan/` |
| Magies | Présentation, description, explication, Mode Hyper ; nom, description et remarque des deux spécialisations de chaque magie (`magie_specialisation`, R236 (1) : ni création, ni suppression, ni changement d'ordre ; le rattachement d'un sort à sa spécialisation, comme son niveau, ne se modifie pas ; aucune dérivation, le corps de la page ne les dit pas) ; chaque case de chaque sort (type, mode, NM et états recalculés : `lib/sort-analyse.mjs` ; une ligne peut avoir un effet de NM dans plusieurs colonnes). Les rôles des magies sont supprimés (R237 (7), migration 0117) : la table `magie_role` reste, vide, et son traitement (`MAGIE_ROLE`, `corps-magies.mjs#poserRole`) reste inerte ; la modification d'un rôle d'un vieux journal est refusée (404). La table des relations entre magies ne se modifie pas |
| Classes | Tous les champs (maîtrises, inventaire, spécialités, dons : tables de détail recalculées, `lib/classe-champs.mjs` ; les sources de maîtrise d'arme des lignes de maîtrise et des dons, et les NM gagnés d'un don, refaites par `lib/maitrise-arme.mjs` : `serveur/edition-maitrises.mjs`, décisions R148 à R151, R154 ; refus 409 quand un don qui suit « l'arme déterminée avant » laisserait sa classe sans exactement une maîtrise au choix, R151 ; refus 409 d'une maîtrise que le lecteur ne lit pas, ligne typée d'une classe ou points de maîtrise d'arme dans l'effet d'un don, avec la phrase qui la cite : choix du propriétaire du 2026-10-23, « Refuser à la saisie » ; de même, un effet de don qui a plus d'une part à choisir, « le site ne sait garder qu'un seul choix de familles par don » : la fiche range ses choix par source et numéro du point) ; créer une classe dans une catégorie ; une classe raciale se crée pour une race hybride qui n'en a pas encore ; créer et supprimer une spécialité (avec son don de spécialité du niveau 10) ou un don (D11, ci-dessous) |
| Codex | Titre et texte des pages tirées du Google Doc « CODEX Maverick » (`lib/edition-modele.mjs#texteDePageModifiable` ; pas la description des relations entre les peuples, tirée du classeur des races), avec l'éditeur du guide (toute la page est un seul morceau de texte) ; `tools/docs/codex.py --verifier` contrôle une page que le site a modifiée dans son état d'import, et une nouvelle écriture des pages la garde telle quelle (docs/codex.md) |
| Bestiaire | Les monstres (`docs/bestiaire.md`, « Modifier le bestiaire ») : les champs de la carte ouverte (nom, catégorie, type, alignement, échelle, description de la créature (R65), texte de chaque rubrique ; de l'espèce : nom, échelles, description, lieu, complément, blocs, cases de butin ; du groupe d'espèces, « Ottar » : nom et description, R64 ; les capacités : nom et description d'une capacité commune, pour toutes ses cartes, son préfixe et la liste de sorts d'un « Lanceur de sorts » sur la carte, la valeur de chaque « {N} » au curseur, ajout et retrait d'une capacité, décisions R66 à R69) ; ajouter un monstre (une carte dans une espèce, rubriques vides) ou une espèce, supprimer une carte ou une espèce sans carte ; bornes des échelles, écriture de la catégorie, lieux de rencontre, valeurs typées et tables de détail d'une carte recalculés par les fonctions de l'extraction (`lib/monstre-champs.mjs`, `serveur/edition-bestiaire.mjs`) ; le portrait d'une carte ou d'une espèce sans carte (choisi, recadré ou retiré comme sur la fiche de personnage, `src/scripts/portrait.mjs` ; enregistré tout de suite, seul dans son lot ; cadrage gardé dans l'image par le service) ; le curseur d'échelle de la carte et les infobulles du butin refaits avec la carte (rendus `monstre-echelle`, `monstre-butin` : le tableau de l'introduction et le glossaire du butin viennent de `GET /api/edition/listes/`, `echellesDePuissance`, `objetsDuButin`, `renvoisAuxDegatsMoyens`) ; les types de dégâts des attaques (`monstre_attaque_type`, R299 : posés par un lot de changements, jamais saisis ; la carte qui refait ses attaques les garde si chaque libellé reste écrit dans le texte de l'attaque du même rang, dans l'ordre, sinon les retire au journal avant l'attaque : clé étrangère sans cascade). Les créatures invoquées ne se modifient pas ici |
| Armes | page Armes, `/ressources/armes/` (« tout peut être éditable à l'instar des autres pages ») : un menu latéral à gauche liste les familles, une seule liste sans titres de groupe (« Liste unique », 2026-11-05) : celles de mêlée puis celles à distance (`categorie` de la famille, R127), et un seul tableau est affiché, celui de la famille choisie ; en mode modification, rien ne se sélectionne, le menu reste et un seul tableau est affiché (comme les onglets d'avant : « Je veux les onglets aussi », 2026-10-23) ; le nom, le dé et l'en-tête de coût d'une famille se modifient dans l'en-tête de son tableau (son entrée du menu suit), un seul « + Nouvelle famille », en bas du menu (« Un seul bouton en bas », 2026-11-05), en crée une, dont le formulaire demande la catégorie, mêlée ou distance, fixée à la création (R159), insérée aussitôt avec son entrée et son tableau à la fin des familles de sa catégorie ; la famille choisie est écrite dans l'adresse, `#famille-<id>` (`docs/content-guide.md`, « Armes »). Chaque arme (sauf les armes de monstres) : nom, mains, compétence (une écriture de l'onglet), type, coût, effet, description, arme de départ, remarque (l'étoile ★ à côté du nom, refaite à l'enregistrement ; vidée, elle part : R91) ; dé, bonus, portée, solidité, provenance, types de dégâts et minimums de caractéristique en sont recalculés (`lib/arme-champs.mjs`, rejoué sur toute la base), les colonnes tirées se réaffichent après l'enregistrement. Une arme a toujours au moins 1 cran propre (décision R194) : un effet qui lui en donnerait moins (« 0 seul cran », ou un « −N crans » qui ramène la base sous 1) est refusé, `400`, à la création comme à la modification, `/api/v1/` comprise (`lib/arme-champs.mjs#refusDesCransPropres`, sans plancher) ; au rejeu, un lot qui le ferait passe en conflit, choix 2 seul (`serveur/edition.mjs#armesSansCranPropre`, comme les colonnes figées). Ajouter une arme (famille, nom, catégorie, type, effet… : à la fin du tableau de sa famille, et la page défile jusqu'à elle ; `famille_id` peut valoir « @i », la famille créée par l'opération i du même lot) ou la supprimer (retirée des fiches qui l'ont, avec une note datée : R52, comme R42). Chaque famille (une entrée du menu et un tableau, décision R159 ; table `arme_famille`, sauf ARME DE MONSTRES, refusée `400` : R45) : nom, dé (forme contrôlée `D<n>` ou `D<n>/D<n>…`, comme `D6/D8/D10` du Pugilat : `edition-modele.mjs#DE_DE_FAMILLE`, saisi en minuscules ou avec des espaces il est remis en forme) et en-tête de la colonne de coût (« Coût », « Coût en plus/moins », « Coût en plus/moins (unité) » : `COUTS_DE_FAMILLE`) ; le bandeau écrit (`libelle_brut`) est refait (« NOM - dé » et la note d'après le dé gardée, `lib/corps-armes.mjs#libelleDeFamille` ; un bandeau qui ne commence pas par « nom - dé » : `409`), l'identifiant, la catégorie et le nom de lecture (`nom_lecture`, migration 0077) ne changent jamais. Le dé d'une famille dont la note écrit des dés selon la Force (le Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », que la fiche lit, `maitrise-arme.mjs#desSelonLaForce`) ne se change pas sur le site (`400` ; limite technique, pas une règle : la page afficherait le nouveau dé, la fiche resterait sur les paliers) ; son nom et son en-tête de coût, si. Créer une famille (entité `arme_famille` : nom, dé, catégorie `contact` ou `distance`, posée une fois, en-tête de coût ; identifiant tiré du nom puis figé, suffixe `-2`… s'il a déjà servi ; dernier rang, maîtrisable, nom de lecture = nom de création ; une ligne `page_entite`) ; aucune ne se supprime. Refusés : un nom vide, avec une virgule ou un « : » (`400` : le classeur exporté s'en sert pour séparer les choix de maîtrise, limite technique), un nom déjà pris (`409` : le nom ou le nom de lecture d'une autre famille, au singulier près et pour chaque nom séparé par « / », ou un nom que R138 rattache à une famille, « Hast », « Bâton », « Arme jet », « Masse » : « 1 maîtrise Épée » deviendrait ambigu), un renommage ou une création qui changerait la lecture d'une source de maîtrise existante (`409` avec la liste dans `sources` : `edition-maitrises.mjs#sourcesChangeesParLesFamilles`). Une famille créée entre d'office dans les maîtrises au choix de sa catégorie et dans celles qui proposent toutes les familles (R119, R127, R150, R151) : les sources de toutes les classes et de tous les dons sont refaites et notées au journal (`sourcesRefaitesPourLesFamilles`) ; les « sauf » et les lignes nommées se lisent aussi par le nom de lecture (`lib/maitrise-arme.mjs#famillesDuNom`), un renommage ne change donc aucune source. Les matériaux sont en lecture (décision R62 : ils se modifient sur la page « Composants », la page des armes suit), les armes élémentaires aussi (décision R167 : listées dans le tableau de leur famille ; leur source est la page « Pièces élémentaires », choix du leader-technique), comme le type élémentaire d'une famille (`type_elementaire_id`, hors de `TABLES` ; une famille créée n'a aucune arme élémentaire, il reste NULL : R167). Chaque amélioration d'arme (un seul tableau pour l'arme du catalogue et l'arme élémentaire, R167) : coût matériel et effet (le coût élémentaire de la ligne est en lecture ; la ligne TOTAL du coût matériel est refaite dans la base et le corps Markdown ; la page ne l'affiche plus depuis le 2026-10-16). Le corps Markdown de la page suit, ligne à ligne, remarques comprises (une entrée « **Remarque de l’arme « Nom »** : … » sous le tableau de la famille, à la place de celles de l'importeur : `lib/corps-armes.mjs`, `serveur/edition-armes.mjs`) ; une famille renommée ou au dé changé : le titre de sa section (son bandeau échappé, comparé exactement) et sa puce des armes de départ ; son en-tête de coût changé : la première ligne de son tableau ; créée : sa section à la fin du corps (les sections des familles sont les dernières), en-tête sans arme |
| Armures et boucliers | pages Armures et Boucliers, `/ressources/armures/` et `/ressources/bouclier/` (refaite « de la même manière que les Armes », « Modifiable tout de suite », 2026-10-15) : en mode modification, rien ne se sélectionne, les fiches se ferment et tous les tableaux des deux onglets s'ouvrent. Chaque armure : nom, solidité, résistance et faiblesse (une armure de la grille) ; type, AP et AM (chacun dans sa case, demande du propriétaire du 2026-10-17 ; vide = pas de bonus), effet et prix d'une armure particulière (R80). **Le type, l'AP, l'AM et le prix d'une armure de la grille se calculent d'après ses deux matériaux** (décision R207 (1), E6, migrations `0105`, `0108` : le type le plus lourd des deux, la somme de leurs AP et AM, R75, et « Armure Complète » + `constante_equipement` « armure.unites_par_materiau » (6) unités de chaque matériau au prix de la page Composants, R93) : une valeur changée est refusée (`400`, `serveur/edition-armures.mjs#COLONNES_CALCULEES_DE_LA_GRILLE` ; renvoyée telle qu'en place, elle passe ; `/api/v1/` : `colonnesFigees`) ; le prix, la défense écrite (`stats_brut`, refaite depuis l'AP et l'AM, gardée telle qu'écrite tant qu'elle se lit exactement en eux) et les résistances et faiblesses (`armure_degats`) en sont recalculés (`lib/armure-champs.mjs`, rejoué sur toute la base). Le coût de fabrication de l'armure complète (dans la phrase du prix, onglet Armures ; les prix de la liste et la fiche le suivent) et celui du bouclier (sous les formes) : les deux lignes du tableau FABRICATION que la page affiche encore (le coût en RF suit ; les autres lignes, les pièces, ne sont plus affichées depuis R93 et ne se modifient que par `/api/v1/emplacements-d-armure/`), forme de bouclier (nom, prix : le coût de fabrication de ses boucliers), bouclier préfabriqué (nom, poids au choix parmi la liste : décision R92 ; **son AP, son AM et son prix se calculent** d'après sa forme et sa matière, décision R207 (1) : classe × AP ou AM de la matière, classe × prix de la matière + prix de la forme, `bouclier_classe.prix` ; dans `TABLES` pour que leurs cases en lecture suivent la ligne renvoyée, comme ceux de la grille, mais une valeur changée est refusée, `400`, `serveur/edition-armures.mjs#COLONNES_CALCULEES_DU_BOUCLIER` ; renvoyée telle qu'en place, elle passe ; `/api/v1/` : `colonnesFigees` ; la défense écrite `defense_brut` et le prix écrit suivent), poids de bouclier (nom, Force ; la Force minimum suit ; leur tableau ne s'affiche qu'en mode modification et sans JavaScript), amélioration d'armure (coût, effet écrits ; RO, matériaux, AP, AM et crans en sont tirés) ou de bouclier (quatre cases, demande du propriétaire du 2026-10-17 : coût en RO, coût en matériaux Oui / Non — 1 matériau, R76 —, AP supplémentaire, +1 cran de solidité Oui / Non ; le coût et l'effet écrits en sont refaits) ; chaque cible refuse les cases de l'autre ; la ligne TOTAL est refaite dans la base et le corps Markdown, la page ne l'affiche plus. Un lot noté avant (défense, coût ou effet d'une amélioration de bouclier saisis en texte) ne se rejoue que si la ligne après lui a un texte qui se lit exactement en ses cases (règles + lots du journal qui passent + lui) ; sinon il passe en conflit expliqué, sans compter pour les lots suivants (`serveur/edition-armures.mjs#ancienneEcritureDesArmures`). Refusés : un prix qui écrit un nombre illisible (« 2050 RO » ; « ???? » ou une case vide disent que la source ne le donne pas), un coût de pièce sans « N RF » (hors « / Classe » du bouclier), un nom d'armure sans lettre ni chiffre, un type hors de la liste. Ni création ni suppression (les fiches de personnage les citent). Les matériaux sont en lecture (R62). **Recalcul (R207 (1))** : quand le prix d'un matériau ou son type (page Composants), le coût de « Armure Complète » ou le prix d'une forme changent, le service refait le type, l'AP, l'AM et le prix de toute la grille et de tous les boucliers (formules `lib/armure-forge.mjs`, entrées `lib/armures-db.mjs#valeursCalculees`, écritures `serveur/edition-armures.mjs#suivreLesValeursCalculees`) : seules les lignes qui changent sont écrites et notées au lot, avec leur défense et leur prix écrits au format de leur colonne (armure : « 2 530 », milliers séparés, `prixEcritDeLArmure` ; bouclier : « 112,5 », « 1207,5 », sans séparateur de milliers comme le classeur et la migration `0105`, `prixEcritDuBouclier` ; vide si un prix de matériau manque ; un prix qui ne change pas n'est pas réécrit), et leur ligne du corps. Au rejeu, le même calcul est refait après chaque lot qui écrit une de ses entrées (`valeursCalculeesParLeLot`, hors journal) et un ancien lot qui écrit directement une colonne calculée passe en conflit, choix 2 seul (`ecrituresDesValeursCalculees`) : paragraphe des adaptateurs du rejeu. « 250 RF / Classe » (ligne « Bouclier » de FABRICATION) n'est qu'une autre écriture du prix des formes : `db:check` avertit quand une forme ne vaut plus classe × ce montant (`avertissements`, `lib/armures-db.mjs#ecartsDeFabricationDuBouclier` ; le prix d'un bouclier suit `bouclier_classe.prix`). Les notes de version listent l'AP, l'AM et le prix d'un bouclier qui changent. Le corps Markdown des pages « Armures » et « Bouclier » suit, ligne à ligne (`lib/corps-armures.mjs`, `serveur/edition-armures.mjs`) |
| Panneaux de règles | en tête de chaque page de l'équipement (rubrique Équipement) ou sous-onglet qui sert une page du wiki (Armes, Armures, Boucliers, Accessoires, et Bâtons magiques dans la page Ceinture, qui n'en a pas : ses règles sont le texte du guide, modifiable sur la page du guide) (`docs/content-guide.md`, « Panneaux de règles » ; migration `0056` ; « Il faudrait que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours insérables / modifiables en mode édition) », 2026-10-16) : en mode modification, chaque panneau s'ouvre et reste ouvert (un clic, une espace ou Entrée dans son `<summary>` ne le replient pas). Son titre (`panneau_regles.titre`, un champ commun dans le `<summary>`) ; le texte de chaque bloc et le contenu de chaque tuile, modifiés en place avec l'éditeur de la chronologie (Texte, Mise en page, Liens ; Markdown sûr, `lib/markdown-sur.mjs`, comme le guide : refusé par le service, dans un lot reçu et après le rejeu de la mise à jour ou du rapatriement ; un texte n'est envoyé que si son Markdown relu diffère de celui relu à l'entrée en mode modification, pas du texte de la base, que l'éditeur réécrit en apostrophes typographiques), le titre d'une tuile (un champ ; refusé sur un bloc de texte, `400`) ; sous chaque bloc, « ↑ » et « ↓ » (deux blocs échangent leurs ordres, `panneau_regles_bloc.ordre`, envoyés avec « Enregistrer » : `lib/panneaux-regles-db.mjs#ordresApresDeplacement`), « Supprimer » (à l'enregistrement, après confirmation ; le dernier bloc d'un panneau ne se supprime pas, `409`), « + Texte » et « + Tuile » (créés tout de suite après ce bloc : entité `panneau_regles_bloc`, champ `apres` = le rang du bloc après lequel l'insérer, vide = à la fin ; les blocs suivants sont repoussés d'une place, chaque décalage noté au journal : `ordresApresInsertion`). Un bloc créé prend un rang jamais employé (table, journal et historique). Le corps des pages « Armes »… (`page.corps_md`) n'est plus que la trace de l'import : jamais touché. Surcouche : une ligne de bloc modifiée depuis la construction refait son bloc (s'il a changé de texte, d'après son empreinte `data-preg-empreinte`) dans le navigateur, avec `lib/chronologie-rendu.mjs#htmlDuTexte` (HTML : `lib/panneaux-regles-rendu.mjs`, le même qu'au build ; Markdown rendu par la chaîne du build, monnaies en icônes comprises) ; le bloc est remis à sa place de lecture, ou retiré. Service : `serveur/edition-panneaux.mjs` ; page : `src/scripts/edition/panneaux.mjs` |
| Accueil (encart « Notre prochaine rencontre IRL ») | `/`, ancre `#prochaine-rencontre`, sur l'accueil (`components/accueil/LiensEtRencontre.astro` ; demande du propriétaire du 2026-10-18 : titre fixe, annonce modifiable sur le site de dev ; la page Liens qui le portait est supprimée le 2026-10-22 ; sous le texte de Bienvenue jusqu'au 2026-10-23, « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. » ; l'accueil propose donc le mode modification, page `accueil` au journal) : le texte de l'annonce (table `annonce`, migration `0068-annonces`) se modifie en place (`src/scripts/edition/annonces.mjs` ; la barre d'outils des panneaux de règles : texte, mise en page, liens, mots-clés) ; vide, la zone s'ouvre vide, le texte d'attente en filigrane ; vidée, elle repart à NULL (« Aucune rencontre annoncée pour le moment. ») ; Markdown sûr et balises canoniques comme le guide (`serveur/edition.mjs#ANNONCE`), contrôlé aussi par la mise à jour (`TEXTES_EN_MARKDOWN`, `texteNonSurApresLeRejeu`) ; ni création ni suppression ; note de version : domaine Guide, groupe Découvrir, « Accueil › Notre prochaine rencontre IRL » |
| Composants | `/ressources/composants/` (`docs/content-guide.md`, « Composants ») : monnaies, matériaux, gemmes, bois, ingrédients d'alchimie (fruits compris), objets de l'onglet « Équipement inventaire », un onglet par tableau. Le titre et la note de chaque onglet (table `composant_onglet`, migration `0057` ; demande du propriétaire du 2026-10-17 : « modifiables et directement liées en base » ; titre obligatoire, note vidée = NULL ; ni création ni suppression : un onglet par tableau). Chaque case se modifie (prix en RF, CONVERTISSEUR, type, marque majeur et affinité d'un ingrédient recalculés : `lib/composants-champs.mjs`) ; ajouter dans chaque tableau (une gemme ou un bois pour une magie qui n'en a pas, jamais pour le Potentiel Illimité : décision R160, ni gemme, ni bois, ni bâton magique, ni pièce élémentaire ; les listes `magiesSansGemme` et `magiesSansBois` ne le proposent pas, le service le refuse en `422` « Le Potentiel Illimité n’a ni gemme, ni bois, ni bâton magique, ni pièce élémentaire (décision R160). », et la base aussi, migration `0078`, dont l'erreur est traduite par le même message ; la seule liste de ces magies : `lib/edition-modele.mjs#MAGIES_SANS_OBJET_PAR_MAGIE`) ; supprimer ce que rien d'autre ne cite (refus 409 qui nomme les règles qui le citent) ; un objet supprimé reste dans l'inventaire et la ceinture des fiches sous son nom, sans lien au catalogue (`ressource_id` = NULL), avec une note datée (décision R60 ; aussi à la reconstruction de la base vivante, `fiches-retraits.mjs#OBJETS_AU_CATALOGUE`). **L'onglet Monnaie est figé** (décision R219 (3) : « Ni création, ni modification, ni suppression dans l'onglet Monnaie » ; R195 (2) et R197 abandonnées) : le service refuse en `409`, avec la raison, la création d'une monnaie, la modification de toute colonne et la suppression (`lib/edition-modele.mjs#TABLES_FIGEES`, `serveur/edition.mjs#raisonDuGel`, avant tout contrôle des valeurs ; `/api/v1/monnaies/` compris) ; `TABLES.monnaie` et `ENTITES.monnaie` restent, pour le rejeu d'un lot ancien, qui passe (R220 (1), « Rejeu du journal »), sauf un renommage, en conflit comme avant (le nom, figé par R193 et hors de `TABLES`, et la valeur, R61 : `serveur/edition.mjs#COLONNES_FIGEES`, `ecrituresFigees`) ; les matériaux ne se modifient qu'ici (R62 : type, suivi par `materiau_armure.type`, prix recopié dans `materiau_arme` quand le prix de la ressource change, jamais pour une autre colonne ; un prix ou un type changé refait le type, l'AP, l'AM et le prix des armures de la grille et des boucliers, décision R207 (1) : ligne « Armures et boucliers » ; lu par `lib/composants-champs.mjs#prixEnRf`, espace des milliers compris, que `lib/arme-champs.mjs` réemploie ; effets sur une arme). Le corps des pages qui écrivent ces composants suit (`lib/corps-composants.mjs`, `serveur/edition-composants.mjs`) |
| Consommables de la ceinture | sous-onglet Consommables de la page Ceinture, `/ressources/objets-a-la-ceinture/` (`docs/content-guide.md`, « Ceinture » ; « Les tableaux des consommables devrai pouvoir aussi être modifiées . (sauf pour les champ calculés) », 2026-10-17) : les quatre cases saisies de chaque potion, par l'éditeur commun — nom et prix (`ressource` de genre `potion` : `nom_cle` et prix en RF recalculés ; un nom qui ne diffère d'un autre palier de la même page que par la casse, les accents ou les signes est refusé, 409), niveau (`potion.niveau_id`, liste `niveauxDAlchimie`) et effet (`potion.effet` : ses altérations d'état `potion_etat` refaites, `lib/potion-etats.mjs`) ; le tableau du palier dans la page de la potion suit (`lib/corps-potions.mjs`, aussi au rejeu : `recalculerLesPages`) ; une description de potion est refusée (l'onglet n'en montre pas) ; ni création ni suppression ; en lecture : couleur de la ligne, valeur en RF, titre et résumé d'un groupe, carquois et sacs (page « Composants »), bâtons (`serveur/edition-consommables.mjs`, `ressourcesParGenre` : une autre ressource reste au domaine des composants) |
| Métiers | Ajouter, modifier, supprimer (retiré des fiches qui l'ont, avec une note : R42) ; bonus (et leur compétence ou l'initiative, décision R33), objets de départ (R35) et recettes recalculés (`lib/metier-champs.mjs`) ; artisanat en trois champs, texte et deux listes de caractéristiques (R34 : « Artisanat possible » en est recalculé, une seule caractéristique est refusée, sans texte elles partent) ; corps de la page (`lib/corps-metiers.mjs` : un champ réécrit en entier, paragraphes compris, ses liens `[[…]]` gardés tant que leur texte reste écrit) ; filtres et tri par colonne |
| Chronologie | Chaque événement (`/chronologie/<id>/`, [`chronologie.md`](chronologie.md), « Modifier la chronologie ») : date (époque, année, année de fin ; l'événement prend sa place d'après elle), titre, portée et lieu d'un Impact, catégories (cases à cocher, plusieurs au choix ; opération `categories`), descriptions (blocs modifiés en place avec l'éditeur du guide — leur rendu dans le navigateur, `lib/chronologie-rendu.mjs`, redonne le Markdown du build, `test/chronologie-rendu.test.mjs` —, leur lien vers une page du wiki ; en ajouter, en retirer, une au moins) ; créer un événement (« + Nouvel événement », affiché sur `/chronologie/?evenement=<id>` jusqu'à la version suivante du site) ou le supprimer (avec ses blocs et ses catégories) ; le bouton « Catégories » : créer, renommer, supprimer une catégorie (`categorie_chronologie` : id figé, écriture unique, jamais `sans-categorie` ; supprimée, elle quitte ses événements), enregistré d'un bloc à part. La frise et l'événement affiché sont refaits d'après la base vivante au chargement (`GET /api/edition/chronologie/`). Service : `serveur/edition-chronologie.mjs` ; page : `src/scripts/edition/chronologie.mjs` |
| Mots-clés | Le glossaire (migration `0056`, `docs/content-guide.md`, « Mots-clés (glossaire) ») sur la page Glossaire (`/regles/glossaire/`, extension `src/scripts/edition/mots-cles.mjs`), en mode modification : la liste relue dans la base vivante (`GET /api/edition/mots-cles/`, définitions comprises, avec le verrou et les mentions de chacun, et `refus_du_forcage` : la raison pour laquelle sa suppression forcée serait refusée, `null` si elle passerait — `serveur/edition.mjs#refusDesForcages`), chaque libellé modifiable sauf ceux des mots-clés verrouillés (ci-dessous), la **définition** de chaque mot-clé (`mot_cle.description` : champ commun ; vidée, `NULL`), ses **synonymes** (`mot_cle_synonyme`, migration `0115`, décision R233 : l'abréviation en est devenue un ; opération `{ op: 'synonymes_mot_cle', mot_cle, synonymes: [écritures], avant? }`, la liste dans l'ordre ; refusée sur un mot-clé verrouillé, `409`, R233 (6) ; un synonyme refusé : `400` pour son écriture — ni lettre ni chiffre, espace autour, `{`, `}`, `|`, saut de ligne, `:` final, le libellé du mot-clé lui-même —, `409` quand il s'écrit comme le libellé, un synonyme ou la clé d'un autre mot-clé, et pour un mot-clé créé ou renommé vers le synonyme d'un autre ; le refus porte `champ: "synonymes"` ou `"libelle"` et, en `409`, `mot_cle` : l'autre ; `serveur/edition-mots-cles.mjs#refuserLesSynonymes`, la règle de `db:check`, `lib/mots-cles-balises.mjs#fautesDuSynonyme`), ses **catégories** (`mot_cle_categorie`, migration `0113`, décision R232 ; opération `{ op: 'categories_mot_cle', mot_cle, categories: [ids], avant? }`, permise sur un mot-clé verrouillé, R232 (11)), sa **clé** calculée (`mot_cle.cle`, aucune route ne l'écrit : le slug du libellé, suivi pour un homonyme des slugs de ses catégories non communes à tous ses homonymes ; recalculée après chaque renommage, changement de catégorie, création, suppression ou fusion, et renommage de catégorie, `serveur/edition-mots-cles.mjs#recalculerLesCles`, la règle de `lib/mots-cles-cles.mjs#clesDesMotsCles` ; une clé qui change est écrite, la clé quittée notée dans `mot_cle_ancienne_cle`, retirée de cette table quand elle redevient courante, et chaque balise qui la citait réécrite dans tous les textes, définitions verrouillées comprises, chaque ligne notée au journal ; refus `409` : un homonyme sans catégorie qui le distingue de chacun des autres, `champ: "categories"`, une clé déjà prise, `champ: "libelle"`, `mots_cles` : les ids en cause), les **catégories des mots-clés** (`categorie_mot_cle`, décision R232 (5) : création, `{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle } }`, l'id suivant ; renommage par `modifier`, libellé unique, `409` sinon, qui recalcule les clés ; suppression d'une catégorie vide seulement, `409` avec `mots_cles` sinon), son **lien** et sa **couleur** (`mot_cle.url`, `mot_cle.couleur`, migration `0098` : les liens des textes devenus des balises ; vidés, `NULL` ; écrits à la création seulement s'ils sont donnés ; le lien : une adresse interne, relative à la racine du site et sans le préfixe de déploiement, `/races/drakos/`, `/metiers/#metier-mineur`, dont le chemin est celui d'une page qui n'est pas d'exemple, d'une rubrique ou d'une route fixe, lu dans la base vivante, `lib/adresses-db.mjs#adressesDuSite`, l'ancre et la requête non vérifiées ; la couleur : `#rrggbb`, écrite en minuscules, ou `<famille>:<id>` d'une couleur de la palette, `classe:melee` ; refus `400` avec `champ: "url"` ou `champ: "couleur"`, jamais `409` : `serveur/edition.mjs#refuserLeLien`, `#refuserLaCouleur`, `lib/mots-cles-liens.mjs#fauteDeLUrl`, `lib/palette-css.mjs#fauteDeLaCouleur`, les règles de `db:check`), son **icône** (`mot_cle.icone`, migration `0116`, décision R235 : `NULL` ou `<famille>:<id>` d'une icône de **la seule liste des icônes du site**, `lib/icones.mjs#ICONES`, les trois monnaies (`monnaie:rf`, `monnaie:ro`, `monnaie:pp`, remplies par la migration), les trois types de dégâts physiques (`degats:taille`, `degats:estoc`, `degats:frappe`) et les quinze magies (`magie:<clé>`, `magie:feu`, `magie:espace-temps`…), ces dernières seulement à choisir sur le site de dev (2026-11-14, « Liste seulement » : aucune n'est posée) ; choisie dans la liste `icones` de `GET /api/edition/listes/`, que `GET /api/edition/mots-cles/` rend aussi ; vidée, `NULL` ; hors de la liste, `400` avec `champ: "icone"`, `serveur/edition.mjs#refuserLIcone`, la règle de `db:check` ; couverte par le verrou, R235 (5) ; un dessin du site, pas une ligne : une monnaie supprimée ne la vide pas ; `monnaie_id` reste), la balise à copier (`{{clé}}`), « Fusionner dans… » et « Supprimer » mis en file et envoyés avec « Enregistrer », confirmés une fois avec ce qu'ils retirent (ordre du lot, `lib/mots-cles-edition.mjs#operationsDuVocabulaire` : les fusions ; les suppressions, les forcées après les autres ; les catégories des mots-clés, avant les renommages, pour qu'un homonyme ait déjà ses catégories distinctives ; les renommages, champs et catégories renommées ; les synonymes, après les renommages, un synonyme pouvant prendre une écriture qu'un renommage libère ; enfin les catégories supprimées), « + Ajouter un mot-clé » créé tout de suite, avec sa définition, son lien, sa couleur, ses catégories et ses synonymes, sa clé calculée ; un renommage vers l'écriture d'un autre mot-clé sans catégorie qui l'en distingue propose la fusion (`fusionner_mots_cles`, sinon `409`). Créer, renommer, fusionner et supprimer un mot-clé du vocabulaire (`mot_cle`, migration `0043`) ; **un mot-clé ne se supprime que si rien ne le mentionne** (décision R196 : « Le mot clé n'est supprimable que si cette liste est vide » ; la cascade d'avant, qui le retirait des pages et réécrivait ses balises en texte, est abandonnée) : une page qui le porte (`page_tag`) ou une balise `{{…}}` qui le cite (par sa clé, son libellé, un synonyme ou une clé quittée : `lib/mots-cles-balises.mjs#motCleDeLaRef`, sans égard à la casse) dans un texte de la base (`lib/mots-cles-db.mjs#textesDeLaBase` : corps d'une page, effet d'un don, description d'une compétence, définition d'un autre mot-clé, bloc d'un événement… ; pas sa propre définition, son lien ni sa couleur ; un prix « 100 RO » n'est pas une balise), **pages d'exemple comprises**, refusent la suppression : `409` avec `mentions`, la liste des endroits (`[{ table, cle, colonne, comment: 'etiquette' | 'balise', page: { id, titre } | null, libelle, exemple }]` : nommés par la page qui montre le texte — la page elle-même, la page de la ligne par `page_entite` ou l'id de la ligne, « Chronologie › <événement> », « Mot-clé « <libellé> » » pour la définition d'un autre mot-clé —, sinon par leur table et leur ligne ; `lib/mentions-des-mots-cles.mjs`, que le Glossaire reprendra pour son menu déroulant), rien n'est écrit ; le `409` porte aussi `refus_du_forcage` (ci-dessous) ; une suppression acceptée sans mention n'écrit que la ligne de `mot_cle`. `/api/v1/mots-cles/<id>/` (`DELETE`) passe par le même chemin. **La suppression forcée** (décision R223 ; `{ op: 'supprimer', entite: 'mot_cle', cle: { id }, forcer: true }`, `DELETE /api/v1/mots-cles/<id>/?forcer=1` ou le corps `{ "forcer": true }`) ne lève que le refus des mentions. Sont refusés en `409`, dans cet ordre et avant toute écriture : un mot-clé verrouillé (R218 (3)) ; qui étiquette un sort (R196 (3)) ; qui est le mot-clé d'un type de dégâts ou d'une magie (`references`, ci-dessous) ; cité par une balise de la définition d'un mot-clé verrouillé (R222 (1), par sa clé, son libellé, un synonyme ou une clé quittée : `mots_cles_verrouilles`, une définition verrouillée n'est jamais réécrite) ; dont le lien mène, sans ancre, à une page de la base (décision R223 (7) : la page serait supprimée, ce point est reporté ; `url` et `page` dans le refus ; `lib/adresses-db.mjs#pageDeLAdresse`, hors pages d'exemple : les routes fixes qui sont aussi des pages, `/ressources/armes/`, `/armures/`, sont refusées) ; un lien qui a une ancre (`/metiers/#metier-mineur`), ou qui ne mène à aucune page de la base (une route fixe sans page, `/fiche/`, `/recherche/`, une rubrique, `/races/`), est épargné et disparaît avec le mot-clé ; mentionné là où le site ne sait pas remplacer la balise (`mentions_bloquantes` : une table figée, une page qui ne se modifie pas ici, une colonne hors du modèle qu'aucune colonne de sa ligne ne refait ; `serveur/edition.mjs#mentionsQueLeSiteNeReecritPas`). Sinon, dans le même lot et par le chemin normal d'une modification (`serveur/edition.mjs#remplacerLesMentions` : opération « modifier », dérivations, journal), chaque mention de `mentionsDe` est remplacée, pages d'exemple comprises : chaque balise qui le cite, quelle que soit sa forme (`{{clé}}`, `{{clé|texte}}`, `{{clé:}}`) et l'écriture de sa ref, devient **son texte affiché, en texte simple, sans lien** (réponse du propriétaire, « Le texte affiché » : `{{clé}}` et `{{clé:}}` donnent le libellé, `{{clé|texte}}` le texte écrit, « les {{elfe|elfes}} » devient « les elfes » ; une ref écrite autrement que la clé montre ce qu'elle montrait, telle que tapée (R233 (10)) ; `lib/mots-cles-balises.mjs#remplacerParLeTexteAffiche`, la règle tenue par `texteQuiRemplaceLaBalise` ; échappé dans un texte mis en forme, `|` compris sur une ligne de tableau, et en tête de ligne pour ne devenir ni liste, ni titre, ni citation, `echapperDebutDeLigne` ; une balise dans un code reste), chaque étiquette de page est retirée, une colonne dérivée que ses tables ne refont pas (le corps d'une page d'exemple typée) est réécrite comme au rejeu ; puis la ligne de `mot_cle`. S'il reste une mention après le remplacement, `409` (`mentions_bloquantes`) et le lot entier est annulé : aucune balise orpheline. Le résumé du lot dit le nombre de mentions remplacées et d'étiquettes retirées. Sans mention, forcer n'écrit rien de plus, mais la suppression est marquée forcée au résumé du lot et se rejoue forcée (« Rejeu du journal »). `forcer` qui n'est pas un booléen : `400` ; sur une autre entité que `mot_cle`, au service comme sur `/api/v1/` : `400`. Refusés aussi, conditions nécessaires : les mots-clés verrouillés, même sans mention, ceux qui étiquettent un sort et ceux que la base cite (ci-dessous) ; ceux que le rejeu des migrations `0090` et `0098` vise se suppriment comme les autres (décision R211 : le rejeu d'un lot ancien écrit alors du texte simple, « Rejeu du journal ») ; une fusion recible ses balises (leur texte gardé) ; la cible garde son lien, sa couleur et son icône, prend ceux de la source qu'elle n'a pas (une modification notée au journal), sauf une cible verrouillée, qui ne prend rien, et le résumé du lot dit ce qu'elle garde ou ne prend pas. **La fusion transmet tout** (décision R233 (11), « Oui, tout transmettre » ; `serveur/edition-mots-cles.mjs#recevoirLaFusion`) : les synonymes de la source s'ajoutent, dans leur ordre, à la suite de ceux de la cible, sauf ceux que R233 (4) refuse (le libellé de la cible, un synonyme qu'elle a déjà, le libellé, la clé ou le synonyme d'un autre mot-clé : écartés, et le résumé du lot les nomme avec leur raison) ; **un mot-clé qui a des synonymes ne se fusionne pas dans un mot-clé verrouillé** (réponse du propriétaire, « Refuser la fusion » : « On ne peut pas fusionner un mot-clé dans un mot-clé verrouillé qui a des synonymes à recevoir. » ; `409` avec `champ: "synonymes"`, avant toute écriture ; le rejeu ne le contrôle pas, R219 (6)), et un mot-clé sans synonyme s'y fusionne (R219 (4)) en ne lui transmettant que ses clés ; la clé de la source et ses clés quittées deviennent des clés quittées de la cible (`mot_cle_ancienne_cle` : une ancienne adresse ou balise mène à la cible) ; un mot-clé créé ou renommé ensuite sous l'une de ces clés la prend, et le renvoi vers la cible disparaît (R233 (11), « Le nouveau la prend »). **Les lignes filles d'un mot-clé supprimé ou fusionné** (`mot_cle_categorie`, `mot_cle_synonyme`, `mot_cle_ancienne_cle` : `serveur/edition-mots-cles.mjs#TABLES_DES_FILLES_DU_MOT_CLE`, `retirerLesFillesDuMotCle`) sont **notées au journal** avant lui (retirées, ou reportées sur la cible d'une fusion), aussi par la résolution d'un lot en conflit (`edition-conflits.mjs#avantLaSuppression`) : la cascade du schéma n'en retire plus rien hors du journal, que la mise à jour refuserait (code 4) ; un lot noté avant se rejoue clés coupées, et `tablesCompletees` comme `tablesDuLot` permettent ces tables. Renommer garde l'id ; quand la clé change (le libellé, ou les catégories d'un homonyme), elle est recalculée et la ref de chaque balise qui la citait réécrite (plus haut ; une balise écrite par un synonyme ou un autre texte garde son texte, tel que tapé, R233 (10) ; une balise sans texte d'un texte mis en forme montre le nouveau libellé). **Le verrou** (`mot_cle.verrou`, migration `0110`, décisions R218 et R219) : un mot-clé verrouillé (`1`) ne se modifie pas (aucun champ : libellé, définition, synonymes, lien, couleur, icône ; ses catégories se changent, R232 (11), et sa clé suit), ne se supprime pas, même quand rien ne le mentionne, et ne se fusionne pas dans un autre (la fusion le supprimerait) : `409`, avec une raison qui cite R218 et R219 (`serveur/edition.mjs#raisonDuGel`, avant tout contrôle des valeurs ; `serveur/edition-chronologie.mjs#verifierNonVerrouille` ; `lib/mots-cles.mjs#estVerrouille`, `RAISON_DU_VERROU`). Il se pose encore sur une page et s'en retire (une page créée ou supprimée par le service), se cite par une balise, et reçoit la fusion d'un autre mot-clé, sans en prendre le lien ni la couleur. **Une définition verrouillée n'est pas réécrite** (décision R222 (1)) : la fusion d'un mot-clé qu'une balise `{{…}}` de la définition d'un mot-clé verrouillé cite (par sa clé, son libellé, un synonyme ou une clé quittée), celle de la cible comprise, est refusée en `409`, avant toute écriture, avec `mots_cles_verrouilles` (`[{ id, libelle }]` : `serveur/edition.mjs#definitionsVerrouilleesQuiCitent`, `reecrireLesBalises` ne réécrit aucun texte gelé) ; cité ailleurs seulement (une page, une définition non verrouillée), il se fusionne et ses balises y sont reciblées ; un mot écrit sans balise n'est pas une citation ; le rejeu, lui, fait la fusion (R219 (6)). **Une page vers laquelle mène un mot-clé verrouillé ne se supprime pas** sur le site (décision R221 : un métier par son ancre, `/metiers/#metier-mineur`, la fiche d'un don, une page des Règles) : `409` qui nomme le mot-clé et cite R221, avec `mots_cles_verrouilles` (`lib/citations-db.mjs#motsClesVerrouillesQuiYMenent`) ; son adresse n'est jamais vidée. Sont verrouillés à la migration : les mots-clés qui mènent à une page (`url`), ceux des monnaies (RF, RO, PP) et ceux dont le site se sert. Aucune route n'écrit `verrou` (pas dans `TABLES` ni `ENTITES` : `400`, `409` sur un mot-clé verrouillé) ; il ne change que par une migration (R218 (4) : « seul un admin », à venir). Un mot-clé créé vaut `0`, même avec un lien (R219 (5)). Les mots-clés qui rangent les pages du site (catégories des classes, « classe », « race », « race hybride », « capacité de classe », « métier », « codex » : `lib/mots-cles.mjs#MOTS_CLES_PROTEGES`), et « Sort grenade » (décision R114) et « Sort fer » (décision R164), que la fiche lit, sont verrouillés : le verrou remplace leur refus propre (R219 (2) ; `MOTS_CLES_PROTEGES` ne sert plus qu'à les identifier). Le site les reconnaît à leur id entier (`lib/mots-cles-proteges.mjs#IDS_DES_MOTS_CLES_PROTEGES`, migration 0113), jamais à leur écriture (décision R195 ; `page_tag.tag_id` ; les pages construites reçoivent leurs noms en `data.mots_cles`, `lib/wiki.ts`, `lib/pages-db.mjs#motsClesDesPages`, lus par `lib/class-groups.mjs`, `lib/race-kinds.mjs`, `lib/classe-magique.mjs`, `lib/races-db.mjs`, `lib/fiche-regles.mjs`). Un mot-clé créé ou renommé peut prendre l'écriture qu'un tel mot-clé n'a pas (ou plus) : il garde son propre id (`creerMotCle` ne donne jamais l'id d'un mot-clé dont le site se sert). « Race hybride », absent des règles, est créé verrouillé avec la première race hybride, sous l'id suivant, et se reconnaît à sa clé `race-hybride` tant que `lib/mots-cles-proteges.mjs` ne lui donne pas d'id (`motCleDe` ; décision R220 (2)) ; si un autre mot-clé s'écrit déjà « race hybride » sans catégorie distinctive, la création de la race est refusée (`409`). Un mot-clé que la base cite par clé étrangère (migration `0125`, demande du propriétaire de lier les valeurs fermées au glossaire : `type_degats.mot_cle_id` pour taille, estoc et frappe, `magie.mot_cle_id`) compte comme une mention (`comment: 'reference'`, la page de la magie la nomme) et ne se supprime pas, simple ou forcée, par analogie avec R223 (5) : `409` avec `references` (`serveur/edition-chronologie.mjs#verifierSansReference`), sans l'erreur brute de la base ; `refus_du_forcage` le dit au Glossaire. Sa fusion reporte la référence sur la cible (une modification de `type_degats` ou de `magie` notée au journal avant la suppression de la source, `edition-mots-cles.mjs#reporterLesReferences`) ; deux mots-clés cités chacun par une magie ne se fusionnent pas (un mot-clé par magie : `409`, `references`). Au rejeu, la suppression d'un mot-clé cité reste en conflit (R196 : mention) et une fusion se rejoue avec sa référence reportée. Un mot-clé qui étiquette un sort (`sort_mot_cle`, migrations `0067` et `0079`) ne se supprime ni ne se fusionne, dans un sens ou l'autre (`409`, avec les sorts qu'il étiquette : `serveur/edition-chronologie.mjs#verifierSansSort` ; la clé étrangère, sans cascade, le refuserait aussi). Une page créée depuis le site (race, classe, métier, don) ne porte que ces mots-clés-là, désignés par leur id (`motCleDe` ne crée plus de mot-clé libre ; une fiche de don : `capacite-de-classe` seul). Son identifiant est figé. Un renommage, une fusion ou un retrait sur une page du Codex la fait compter comme « modifiée par le site » par `tools/docs/codex.py` (gardée telle quelle, ses mots-clés non comparés au document) |

**Valeurs fermées liées au glossaire** (migration `0125`) : un type de dégâts (`type_degats`) et une magie (`magie.mot_cle_id`) s'affichent comme une balise. Une seule fonction les résout, `lib/mots-cles-des-valeurs.mjs#liensDesValeursFermees(db)` : `{ degats: { taille, estoc, frappe, physique, sonore, feu, eau, glace }, magies: { <id de magie> } }`, chaque valeur un lien `{ id, cle, libelle, description, couleur, classe, url, icone, texte, magie_id }` (le mot-clé que la balise cite, `{{cle}}` ou `{{cle|texte}}`) ou `null` sans mot-clé (physique, sonore). `texte` : le nom court d'une magie (« Feu » ; `feu`, `eau` et `glace` suivent leur magie), `null` pour taille, estoc, frappe (la page garde son libellé). Les lecteurs de la base le rendent en champ `liens` (`chargerArmes`, `chargerArmures`, `chargerMonstres`, `chargerInvocations`, `chargerMagies`, `chargerReglesDeFiche`) ; aucune table ni route n'en change, les colonnes qui portent ces valeurs gardent leurs identifiants.

**Balises du glossaire** (migration `0056`, `lib/mots-cles-balises.mjs`) : toute valeur texte d'un lot (un champ de `CHAMPS_DE_TEXTE` :
« ligne », « texte » ou « markdown », d'une modification ou d'une création, API `/api/v1/` comprise) est enregistrée sous sa **forme canonique**, la
clé du mot-clé pour ref (`mot_cle.cle`, migration 0113, décision R232 (3) : « Les balises et les adresses citent la clé »), selon la colonne (`lib/edition-modele.mjs#typeDeTexte`) — un texte mis en forme (« markdown ») : `{{clé}}` (le texte affiché suit le
libellé ; le libellé écrit en texte y revient), `{{clé|texte}}` pour un autre texte (« \| » sur une ligne de tableau Markdown), `{{clé:}}` ; une balise
dans un code y reste telle quelle ; un texte de case (« ligne », « texte ») : `{{clé|texte}}` toujours (le texte écrit, sinon le libellé du moment), le
mode complet refusé (`400`, « le mode complet ne s'écrit que dans un texte mis en forme ») — avant les dérivations : c'est elle que voient les
découpages (qui lisent le texte sans balises sans le vocabulaire : `texteSansBalises`) et que note le journal. La ref saisie est la clé, le libellé
(quand un seul mot-clé le porte) ou un synonyme du mot-clé (`mot_cle_synonyme`, migration 0115, décision R233 ; l'ancienne abréviation en est un), en
toute casse ; le texte affiché est exactement ce qui a été tapé (R233 (10), « Garder la casse tapée, incluant les synonymes et abréviations » :
`{{solidité}}` → `{{solidite|solidité}}`, `{{ic}}` → `{{instant-cast|ic}}`, `{{Action rapide}}` → `{{instant-cast|Action rapide}}` ; la clé, ou le
libellé écrit à l'identique, suit le libellé ; R183 (2), une abréviation écrite comme la base l'écrit, est abandonnée pour les nouvelles saisies). Une balise dont la ref n'est pas
un mot-clé, ou dont la ref est le libellé de plusieurs homonymes (R232 (4) : `ambiguiteDe`, la clé est à écrire ; le refus porte `refs` et
`homonymes`, leurs clés), est refusée
(`400`, la ref citée), sauf si la valeur en place l'avait déjà (un texte d'avant la suppression de son mot-clé se modifie encore). `db:check` lit les
balises de toutes les colonnes de texte des règles et des pages (`lib/mots-cles-db.mjs#textesDeLaBase` : ni les sections 13 à 15, ni les tables dérivées
`lien` et `lien_candidat`, que le build refait, ni les traces gardées telles quelles — notes de cellule, écarts, corrections, commentaires orphelins,
alias, sources — : `lib/tables-de-la-base.mjs`) et refuse une ref qui n'est pas une clé et une forme
non canonique pour la colonne (`formesNonCanoniques`, la règle de `formeCanonique` : une balise écrite autrement, espaces ou séparateur compris, sauf
le libellé écrit en texte dans un texte mis en forme, `{{clé|Libellé}}`). **Liens** (migration `0098`, `lib/mots-cles-liens.mjs`) : un lien vers une
page du site s'écrit par la balise d'un mot-clé qui porte son adresse. Un `[[cible]]`, `[[cible|texte]]` ou `[texte](/adresse)` qu'une saisie AJOUTE
à un texte (colonnes « ligne », « texte », « markdown » ; hors code ; un lien externe reste permis, comme `/#lien-discord`, gardé par la migration :
`LIENS_GARDES`) devient la balise, son texte affiché gardé, du seul mot-clé qui mène à l'adresse visée (celle de la page qu'un `[[…]]` désigne, résolu
comme le site, ou l'adresse écrite ; même adresse ancre comprise, sinon le même chemin : `motsClesDeLAdresse`), avant la forme canonique
(`serveur/edition.mjs#texteSansLiens`) ; aucun mot-clé, plusieurs, une cible introuvable ou ambiguë : `400` avec `champ` et `liens`, qui renvoie au
Glossaire (`/regles/glossaire/`). Un lien ajouté dont le texte affiché est vide, ou n'est pas un texte simple (une marque Markdown, une balise HTML ou
du glossaire, un saut de ligne : `TEXTE_DE_LIEN_NON_SIMPLE`), est refusé de même (`400` avec `champ` et `liens`) : le message demande d'écrire la
balise du mot-clé qui mène à la page avec un texte simple (`{{clé}}` ou `{{clé|texte}}`). Une page d'exemple garde ses liens. `db:check` refuse un lien de mot-clé mal écrit ou qui ne mène à aucune adresse du
site, une couleur inconnue de la palette, et tout `[[…]]` ou lien Markdown interne hors code dans ces textes (sauf pages d'exemple et `LIENS_GARDES`).
`GET /api/edition/mots-cles/` donne le lien, la couleur et la classe de chaque mot-clé (`classeDuMotCle` : `couleur-<famille>-<id>`, ou
`couleur-mot-cle-<id>` pour une couleur écrite) et la feuille de ces classes (`css`, `lib/palette-css.mjs#cssDesMotsCles`). Une balise dont le mot-clé
mène à une page la cite (`lib/citations-db.mjs`, `comment: "balise"`), comme le mot-clé lui-même (`comment: "mot-cle"`) : la page ne se supprime pas
tant qu'ils restent ; `db:derive` en tire les lignes de `lien` (vue `lien_page`). Le HTML que
pose l'éditeur après le chargement (rendus des champs, cartes rendues par le service, frise, descriptions) a ses balises rendues d'après le vocabulaire
**vivant**, comme le middleware du build, et les bulles et libellés de la page le suivent (`src/scripts/edition/mots-cles-vivants.mjs` : une définition
modifiée se voit avant le build suivant) ; l'éditeur en place (guide, Codex, chronologie, panneaux de règles) montre chaque mot-clé en sa balise écrite (`lib/markdown-edition.mjs#baliseEcrite`,
à l'entrée en mode modification ; le vocabulaire vivant ne rend rien dans une zone en cours de saisie) et l'écrit par ses outils « Mot-clé » et
« Définition » (`texte-en-place.mjs#outilsDesMotsCles`).

Ce qui suit aussi, pour que les outils du dépôt acceptent les modifications rapatriées (`serveur-edition-derivations`, `serveur-edition-rapatriement`,
`sort-etats`) : une page créée (race, classe, métier) a pour seule source sa provenance « Site de dev › édition du AAAA-MM-JJ » (tables `source`,
`page_source` ; `tools/db/pages_md.py` la rattache à la famille de son type), et une page supprimée emporte sa source si plus rien ne la cite ; les
champs structurés d'une page (`page.donnees`) s'écrivent comme `json.dumps` des importeurs (`lib/json-python.mjs`) ; les magies innées d'une race à
liste d'onglet gardent l'ordre de l'onglet (une magie ajoutée va à la fin) ; les altérations d'état d'un sort (`sort_etat`) sont relues dans les cases
modifiées (`lib/sort-etats.mjs`, la règle de l'importeur, qui redonne les lignes de tous les sorts) ; un sort renommé l'est aussi dans les panneaux
« Effet "…" » des créatures (`creature_effet`) et le titre de ce panneau dans leur page ; un peuple créé a sa case diagonale « Même peuple ».

Le **corps des pages typées** (et leur résumé), qui sert à la recherche (`page_fts`), aux liens (`lien`) et à `races_onglet.py --verifier`, est refait
depuis les tables à chaque modification, avec le rendu de leur importeur : morceaux d'une page de magie (`lib/corps-magies.mjs` : présentation, rôles,
Mode Hyper, ligne, notes et texte d'un sort), sections de l'onglet d'une race et listes des classes et magies accessibles (`lib/corps-races.mjs` ; les
citations de la fiche V15.2.2 restent), page entière d'une classe ou d'un don (`lib/corps-classes.mjs`), champs d'un métier (`lib/corps-metiers.mjs` ; depuis la migration `0098`, le corps est exactement le rendu de la ligne, il n'y a plus de lien du maillage à reposer) ;
une valeur de l'onglet d'une race s'enregistre sous la forme que `races_onglet.py` relit, et une forme qu'il ne saurait pas relire est refusée
(`422` : identifiant d'un don changé — seule la graphie de son étiquette ou de son nom peut changer —, remarque d'un don sans note de cellule dans
l'onglet, nom de don sans rubrique « Nom », titre du tableau du Mort-vivant, Mode Hyper sans nom) ; la note de cellule d'un don du Médusain
(`note_cellule`) suit sa remarque. Une race ou une classe créée reçoit d'emblée le rendu de ses
tables ; une race créée n'a pas d'onglet dans le classeur (ni source, ni Mode Hyper) : `races_onglet.py --verifier` ne relit que les races importées
(`serveur-edition-corps` vérifie le tout de bout en bout, journal rapatrié sur une copie de `data/rows`).

**Spécialités et dons créés ou supprimés** (D11, demande du propriétaire ; `lib/dons-edition.mjs`, `serveur/edition.mjs`, page : `src/scripts/edition/classes.mjs`).
Sur la page d'une classe, en mode modification : « + Ajouter un don de classe (reçu sans choix) », « + Ajouter un don à <SPÉCIALITÉ> », « + Ajouter une
option » (sur un choix ou un don seul), « + Ajouter une spécialité », et « Supprimer » à bascule sur chaque don et chaque spécialité qui peuvent l'être.
Les créations sont **mises en file** (une carte « sera créé à l'enregistrement » chacune) et partent avec « Enregistrer », dans le même lot que les
suppressions et les champs (ordre : champs, suppressions de spécialités, créations, suppressions de dons : `operationsDuLot`) ; une création sur une
ligne en file la cite par « @i » (l'opération i du lot, `ctx.crees`). Les conséquences (« Duelliste deviendra un don reçu sans choix. », « Contact
deviendra un choix… », « La spécialité ÉPÉISTE emporte… ») sont confirmées avant l'envoi. Rien n'est inventé : un don n'a que ce qu'on saisit (nom,
type parmi les cinq mots que `analyserTypeDeDon` reconnaît, précision, effet, niveau, et pour un don « Variable » la magie qu'il vise) ; le reste
applique des règles déjà écrites :

- **place** : une option reprend la ligne, le niveau et la spécialité de son choix (rang suivant) ; sans option, une nouvelle ligne « à la fin de son
  niveau » (`placeNouvelleLigne` : entre la dernière ligne de niveau ≤ N et la première de niveau > N de sa portée, sur un numéro qu'aucun don de la
  classe n'emploie — un don n'entre jamais par hasard dans un choix ; vers le milieu de l'écart quand rien n'est en dessous) ; niveaux : 1, 5, 10, 15
  ou 20 (décision R44, `NIVEAUX_DE_DON`), 10 au moins dans une spécialité (elle se choisit au niveau 10 : le formulaire n'en propose pas d'autre,
  `niveauxProposes`) ;
- **nature** : « des dons côte à côte sont un choix, un don seul sur sa ligne est reçu sans choix » (docs/content-guide.md) : un don seul hors
  spécialité est `classe`, une option en fait un `choix` (le don reçu d'office aussi) ; supprimer l'avant-dernier d'un choix hors spécialité rend le
  survivant `classe` ; dans une spécialité, le survivant reste `choix` sans alternative (le schéma n'y admet pas `classe`) : la page le montre seul, la
  fiche ne le propose pas ;
- **spécialité** : créée avec son don de spécialité (niveau 10, sur la ligne des autres dons de spécialité de la classe ; sans lui elle n'aurait ni
  colonne ni bannière), au plus deux par classe (décision R43, `SPECIALITES_MAX`) ; supprimée avec tous ses dons ; supprimer son don de spécialité seul est refusé ;
  +4 AM seulement si le texte de son don de spécialité le dit (R7) ;
- **identifiants** : tirés une fois du nom saisi (`capacites/<classe>-<nom>`, puis `-<niveau>`, `-<niveau>-<rang>`, `-2`… ;
  `<classe>#specialite:<nom>`, puis `-2`…), puis figés et **jamais réutilisés** (un id de l'historique ou du journal compte comme pris) ; titre
  « Nom (Classe) », sinon « , niveau N », sinon `409` ;
- **refus** : classe ou spécialité inconnue, spécialité d'une autre classe, niveau hors liste, don de spécialité avant le niveau 10, option d'un don de
  spécialité ou d'une autre classe, nombre de la limite du type trop grand (`400`) ; plus de place, titre pris, troisième spécialité, et l'Archimage —
  ses spécialités sont lues dans ses dons de niveau 10, ses deux dons « miroirs » (Élémentaliste, Occultiste) ne se suppriment pas et leur choix ne
  reçoit pas d'option — (`409`). Le refus d'une création commence par le nom saisi (« « Botte » : … ») : il désigne la carte de la file. Une ligne
  qu'une fiche de personnage cite n'est plus refusée : elle est retirée de la fiche (R42, ci-dessous) ;
- **don « Variable »** (décision R181 ; réponse du propriétaire : « Demander la magie ») : sa création demande la magie qu'il vise, « Magie innée » ou
  « Magie acquise » (champ `magie`, `don_magie` pour le don d'une spécialité : `lib/edition-modele.mjs#MAGIES_D_UN_DON_VARIABLE`), et écrit sa ligne
  `capacite_variable`, notée au journal ; sans elle : `400` qui cite R181 ; donnée pour un autre type : `400` (`serveur/edition.mjs#magieDuDonVariable`).
  Un type changé ensuite (réponse du propriétaire « Demander ou retirer », R192 : « Passer à « Variable » demande la magie (innée ou acquise) ; quitter
  « Variable » retire le lien à la magie. ») passe par l'opération `modifier` de `capacite` (`type_brut`, don d'une spécialité compris), avec la clé
  hors colonnes `magie` dans les mêmes `valeurs` (`lib/edition-modele.mjs#CHAMPS_HORS_COLONNES`, `serveur/edition.mjs#suivreLaMagieDuDon`) :
  passer à « Variable » sans `magie` valide est refusé (`400` qui cite R181, rien d'écrit), avec elle la ligne est insérée, notée dans le même lot que
  le type ; quitter « Variable » (type vidé compris) supprime la ligne, notée (ligne `avant` complète), et refuse une `magie` envoyée (`400`) ; sur un
  don déjà « Variable », `magie` (type envoyé ou non) modifie la ligne, et une modification sans `magie` la garde. Même règle par `PATCH /api/v1/`.
  La résolution d'un lot en conflit n'exige rien (le lot porte ses lignes `capacite_variable`) mais retire celle d'un don qui n'est plus « Variable » ;
  le rejeu rejoue les lignes du journal telles quelles. Les choix de don obtenu des fiches (`personnage_don_obtenu`) d'un don qui quitte « Variable »
  ou qui change de magie visée (innée ↔ acquise) sont **retirés des fiches avec une note datée**, comme pour un don supprimé (R42 ; réponses du
  propriétaire « Retirés avec une note », R192 : « Le choix est retiré des fiches avec une note datée, comme pour un don supprimé (R42). ») : à la fin d'un
  lot (`enregistrer`, quelle que soit l'opération, `PATCH /api/v1/` compris) et de la résolution d'un lot en conflit (`resoudreLeConflit`), la magie de
  chaque don « Variable » lue au début de la transaction est comparée à celle d'après (`serveur/fiches-retraits.mjs#retirerLesChoixDesDonsChanges`) ;
  à la reconstruction de la base vivante (livraison, rejeu du journal), celle de l'ancienne base à celle des nouvelles règles (`retirerLesManquants`).
  Un don resté « Variable » sur la même magie ne touche rien. Ligne de note : cas `type` ou `magie` de `lib/fiche-format.mjs#ligneDeRetrait` ;
  `fiches` de la réponse ; `v_personnage_controle` ne signale plus ces choix (`don_obtenu_source_perdue`, `don_obtenu_hors_liste`), il peut
  demander d'en refaire un (`don_obtenu_a_choisir`).
  Sur la page de la classe (`src/scripts/edition/classes.mjs`, `lib/dons-edition.mjs#champDeLaMagieDuDon`) : dans le formulaire d'un don ou d'une
  spécialité, « Magie liée » ne s'affiche et n'est exigée que pour le type « Variable » (cachée et non envoyée sinon) ; sous le type d'un don existant,
  un choix de la magie s'affiche quand le type saisi est « Variable » — exigé quand le don y passe, « inchangée » ou sa magie actuelle (`variables` de
  l'état de la classe : `{ [id du don]: 'innee' | 'acquise' }`, chaque don « Variable » de la classe et de ses spécialités,
  `serveur/edition.mjs#donneesDeClasse`) sinon — et part en `magie` dans l'opération `modifier` du don (`#avecLaMagieDuDon`).

La fiche d'un don créé (`capacites/<slug>`) a pour seule source sa provenance, son seul mot-clé « capacité de classe » (depuis la migration 0056 : ni
la classe ni la spécialité, et renommer une spécialité ne touche plus aux mots-clés), son corps et son résumé tirés de sa ligne ; ses champs structurés (`page.donnees` : classe, spécialité, niveau, nature,
rang, ligne, type, choix exclusifs) sont **une colonne dérivée** (`donneesDeDon`, qui redonne les 660 fiches de l'import à l'octet près), refaite à
chaque écriture et au rejeu pour tous les dons de la classe touchée : une livraison qui change un voisin (spécialité renommée, type) ne met plus une
création en conflit. Un don dont la fiche est encore citée (le mot-clé dont l'adresse y mène, une balise de ce mot-clé, un lien écrit) ne se
supprime pas, ni sa spécialité : `409` qui liste les citations, comme une page des Règles, et on retire d'abord ces liens
(`serveur/edition.mjs#refuserSiLesFichesSontCitees`, choix du chef technique : l'adresse d'un mot-clé ne se vide pas en douce). De même, un métier dont l'ancre (`/metiers/#metier-<id>`) est l'adresse d'un mot-clé ne se supprime pas : `409` qui nomme le ou les mots-clés (`mots_cles`, `citations`), `/api/v1/` comprise ; on change ou on vide d'abord leur lien (`serveur/edition.mjs#refuserSiUnMotCleYMene`), sauf celui d'un mot-clé verrouillé, qui ne change pas : le métier, comme la fiche d'un don ou une page des Règles vers laquelle mène un mot-clé verrouillé, ne se supprime pas (décision R221 : `409` qui le dit, `mots_cles_verrouilles`). Une suppression retire, dans l'ordre des clés étrangères, les notes de cellule du don, ses sources de maîtrise d'arme, ses
règles en données (`TABLES_DES_REGLES_DU_DON` : `capacite_variable`, `capacite_npm_plafond`, `capacite_condition_emplacements`, les tables qui le citent en
`ON DELETE CASCADE`, comparées au schéma par `test/serveur-edition-regles-du-don.test.mjs` ; réponse du propriétaire : « Autoriser et journaliser »), sa
ligne, puis sa fiche (mots-clés, sources, entités rattachées, source orpheline), **tout noté au journal** : la cascade du schéma n'en retire plus rien hors
du journal, que la mise à jour refuserait (fichier hors des tables du lot, code 4). Un lot noté avant (la suppression du don seule) se rejoue clés coupées :
la cascade retire ces lignes, et `tablesCompletees` (comme `scripts/mise-a-jour-github.mjs#tablesDuLot`) les permet. Résolution d'un lot en conflit : les
règles d'un don supprimé sont notées avant lui (`edition-conflits.mjs#avantLaSuppression`) ; une règle que les règles livrées ont changée depuis, dans
un lot qui supprime aussi son don, n'a **pas de choix à elle** : elle quitte les conflits pour les modifications du lot, « suit son don » (la page « Mise à jour » le nomme, et dit « Aucun choix à faire » à un lot qui n'a
plus d'autre conflit : `lib/conflits-rendu.mjs#issueDeLaSaine`, `#htmlDuLot`)
(issue `suit_le_don`, `edition-conflits.mjs#suiventLeDon`) — retirée et notée avec le don s'il part (modification saine ou choix 1), gardée telle que les
règles livrées l'écrivent s'il reste (choix 2) ; jamais une règle sans son don ni un don sans sa règle (réponse du chef technique, lot « Défauts du code »). `POST /api/edition/classe/` donne l'état vivant de la classe (spécialités, dons, choix, fiches qui
les citent, qui en seront retirées) : la page en tire ce qu'elle propose (`permissions`) et, quand la disposition a changé depuis la construction (l'empreinte
`data-ed-structure` de la page diffère de celle de l'état vivant : `empreinteDeStructure`, `doitRedessiner` — une simple modification de champ est
appliquée en place), redessine ses dons, ses spécialités, sa navigation (groupe « Dons par spécialité », liens « Spécialités » et « Dons ») et le
repère « Classe magique » du bandeau avec le HTML des gabarits (`lib/classe-dons-rendu.mjs` sur `lib/classe-assemblage.mjs`, comparés aux pages
construites par `classe-dons-rendu.test.mjs`), puis rebranche ses onglets (évènement `onglets:brancher`) : l'onglet ouvert le reste, et au
chargement l'élément que vise l'adresse (`#don-…`) est ouvert et montré. Limite : jusqu'à la construction suivante,
`/capacites/<slug>/` d'un don supprimé reste en ligne (l'adresse d'un don créé mène à son ancre sur la page de sa classe) et `/fiche/regles.json` ne
change pas : la page `/fiche/` propose encore un don, une spécialité ou un métier supprimé, et son envoi est refusé (`400`, problème nommé : la règle
n'existe plus) ; un élément renommé y garde son ancien nom, alors que `/personnages/` montre déjà le nouveau nom d'une race, d'une magie (colonnes) ou d'une classe
(filtre) ; la fiche écarte un don qu'aucun choix
des règles ne range (`donsValables`). En production (et sur le serveur de test), une fiche qui cite un don, une spécialité, un sort, un métier ou une
arme supprimé par une livraison en est retirée, avec une note datée, quand la base vivante est refaite (R42, R52).

**Fiches de personnage (R42)** (décision du propriétaire : « juste supprimer le don des fiches », « Même en dev il faut supprimer [le don] des
fiches », « Il en va de même pour les sorts ou métiers supprimés » ; une arme aussi : R52 ; `serveur/fiches-retraits.mjs`). Supprimer depuis le site un don,
une spécialité, un métier ou une arme qu'une fiche utilise le **retire de la fiche**, qui reste : la ligne `personnage_capacite` (ou `personnage_arme`, avec
la composition et l'amélioration de cet emplacement ; une arme élémentaire, qui ne se supprime pas, n'est jamais visée) part, `personnage_classe.specialite_id`
passe à `NULL` (la classe reste) avec les dons choisis de la spécialité, `personnage.metier_id` passe à `NULL` avec les bonus « A OU B » que la fiche
y avait choisis (`personnage_metier_bonus`) (la spécialisation magique choisie par une fiche, `personnage_specialisation_magie`, partie `specialisations_magie`
(R236, migration 0118 ; la clé étrangère est composée, spécialisation et magie, sans `ON DELETE`), part de même, la magie redevient « à choisir » : le
site ne supprime pas les spécialisations (28, par migration), le retrait se fait donc à la reconstruction, quand le couple n'existe plus dans les nouvelles
règles, avec sa ligne « la spécialisation magique « LICHE » (magie Nécromancie) n’existe plus dans les règles… » ; `retirerDesFiches` sait aussi la retirer
d'une liste `specialisations`) (un sort, que le site ne supprime pas
encore, partirait de `personnage_sort` avec son livre, `personnage_livre_sort`, même sur une fiche qui n'a que le livre : décision R169, la clé n'a pas
d'`ON DELETE` ; la ligne de note le dit, « 2 NM sur cette fiche dont 1 de livre », « livre de sort en attente, sort hors de la liste » ;
à la reconstruction, les quatre sont retirés, sauf un don, une spécialité ou un sort dont la classe ou la
magie a disparu aussi : celle-ci reste un blocage, hors R42). Un don « Variable » du Mage Bleu supprimé emporte le don obtenu de la fiche
(`personnage_don_obtenu`, décision R181 ; les deux clés n'ont pas d'`ON DELETE`), qu'elle ait le don dans ses choix ou non, avec sa ligne : « le don
obtenu « Moteur thermique » (par le don « Mimétisme », classe Mage Bleu, magie Feu) n’est plus obtenu : le don qui le donnait n’existe plus dans les
règles » ; à la reconstruction, une entrée du tableau disparue aussi (« … n’existe plus dans les règles »), sauf si la classe a disparu. Un don qui
quitte « Variable » ou change de magie visée emporte de même le don obtenu des fiches (cas `type` : « … n’est plus obtenu : le don qui le donnait n’est
plus un don « Variable » » ; cas `magie` : « … vise maintenant la magie acquise du personnage », réponses du propriétaire « Retirés avec une note », R192 ;
`retirerLesChoixDesDonsChanges`, après les écritures du lot, ci-dessus « don « Variable » »). Le retrait se fait **dans le même lot**, avant la suppression
de la règle, **en SQL direct** : jamais au journal (`TABLES_INTERDITES` contient toute la section 13 : une écriture de fiche par le rédacteur du lot
est refusée), donc jamais dans `data/rows` ni dans le résumé du lot (qui va dans l'historique et la note de version : ni nom ni compte de fiches) ;
un lot refusé annule aussi les retraits. Chaque fiche touchée reçoit **une ligne datée par élément** à la fin de ses notes (« NOTE », BA53 ; le
texte du joueur reste intact ; `lib/fiche-format.mjs#ligneDeRetrait`) :
`[11/10/2026] Retrait (règles modifiées) : le don « Botte secrète » (classe Bretteur des dunes, spécialité LAME COURBE, niveau 20) n’existe plus dans
les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.` (une spécialité nomme les dons choisis qui partent avec elle ; un sort,
sa magie, son NPM et les NM de la fiche ; une ligne par élément, dans l'ordre métier, spécialité, don, sort ; à la reconstruction, l'élément
retiré garde le nom des règles d'avant, sa classe, sa spécialité ou sa magie prend celui des nouvelles règles quand elle y est encore) ; `modifie_le` prend l'instant du lot, et
la version de la fiche change (une fiche ouverte ailleurs reçoit `409` avec la fiche à jour ; la page `/fiche/` dit alors combien d'éléments ont été
retirés, et une bannière résume les lignes de retrait de ses notes tant qu'elles y sont). La réponse du lot porte **`fiches`** :
`[{ fiche, retraits: [descriptions] }]` (le nom d'un prétiré, « fiche de joueur n° k » pour une fiche de joueur : k est son rang parmi toutes les
fiches de joueur de la base par date de création, `numerosDesFichesDeJoueur`, donc **le même d'une réponse à l'autre** — infobulle et confirmation
de la page d'une classe, réponse du lot, `/api/etat` — ; une fiche créée ensuite prend le numéro suivant, seule la suppression d'une fiche de joueur
plus ancienne décale les suivantes), annoncée après l'enregistrement
par le message commun de l'éditeur (`annonceDesFiches`, qui reste affiché) ; sur la page d'une classe, l'infobulle de « Supprimer » et la confirmation
des conséquences nomment d'avance les fiches qui perdront la ligne (`libelleDeRetrait`, `consequences`). Aucun contrôle de la base ne signale le
manque : la note est le signal (la page `/fiche/` remet aussi une spécialité ou un don à choix retiré dans ses choix à faire, pas un métier, un sort ni
une arme). Un élément **seulement modifié** (renommé, type, effet…) ne touche pas les fiches (ni
ligne, ni note, ni version) : une fiche ne garde que des identifiants, qui ne changent jamais (migration 0006) ; le nouveau nom se lit dans les règles
(`serveur-edition-fiches`). Une modification qui rend une fiche non conforme (don passé dans une autre spécialité) n'est pas un retrait :
`v_personnage_controle` le signale. Limites : sur le site de dev, aucune archive n'est faite au moment de l'édition (la note est la seule trace) ; à
la reconstruction, une création perdue par un lot en conflit est retirée des fiches avec la même note, et une suppression en conflit fait revenir la
règle sans rendre l'élément à la fiche ; la date de la note est le jour UTC de l'instant (entre minuit et 2 h, heure de Paris, la veille).

**Le journal** (section 14 de `data/schema.sql` : `modification_lot`, `modification`) : le service écrit chaque ligne touchée (avant, après) dans la
même transaction que la modification (`serveur/edition-journal.mjs`). Une saisie envoie la valeur qu'elle a lue (`avant`) : si la base a changé
depuis, `409` et rien n'est écrit. Les pages étant statiques, chacune demande au chargement les lignes modifiées depuis sa construction
(`GET /api/edition/en-attente/` ; sans les lignes du vocabulaire des mots-clés, que les pages lisent en direct, ni celles d'une page, d'un sort ou d'un type de sort dont seul `mot_cle_id` a changé : l'ancrage R309 en laissait 4 403 en attente, 3,6 Mo, rejouées une à une) et les réaffiche en un passage (`lib/edition-rejeu.mjs` : les extensions actives et les cadres ne sont relus qu'une fois) (pour une page du guide : l'aperçu HTML noté avec le texte, assaini ; sans aperçu, le texte actuel rendu dans le navigateur, ci-dessous « Limites ») ; une race ou une classe
créée a sa page provisoire sur la page 404 du site de dev, jusqu'à la livraison suivante.

**Quand une livraison change les règles**, la base vivante est refaite (ci-dessus) et le journal y est **rejoué**, lot par lot : une modification
déjà présente dans les nouvelles règles passe « intégrée » ; un champ que les règles ont changé depuis se **fusionne à trois voies** (« Fusion à trois
voies », dans « Mise à jour », plus bas) ; un lot dont le seul souci est une fusion ambiguë est **gardé** (la valeur du site écrite et en place,
le lot « conflit », à résoudre), un lot qui contredit autrement les nouvelles règles (ligne supprimée, référence rompue, contrainte, forme ancienne)
passe « conflit » en entier (rien n'en est réappliqué) ; `/api/etat/` compte les modifications `en_attente` et `conflit` (celles des lots à résoudre
seulement, et `lots_en_conflit` : un lot résolu garde ses lignes `conflit` comme trace), affichées à côté du crayon. Un lot en conflit se résout sur
la page « Mise à jour » (« Lots du journal en conflit », plus bas). L'ordre de rejeu (`ORDRE_DE_REJEU` :
instant du lot, puis son identifiant, puis le rang) est le même pour le service, `db:appliquer-edition` et la mise à jour des règles ; l'instant
est à la seconde, l'identifiant d'un lot commence par l'instant à la milliseconde et un compteur (`nouveauLot`) : deux lots de la même seconde
se rejouent dans l'ordre où ils ont été enregistrés. Une colonne qui vaut déjà ce qu'une modification plus récente de la même ligne y écrit est
« déjà là » (deux lots sur la même colonne, une ligne créée puis modifiée) — sauf si elle vaut encore ce que la modification avait trouvé (`avant`) :
elle n'est alors pas faite et se fait (A → B → A : un lot suivant peut compter sur B, un nom de catégorie ou de mot-clé libéré, une date intermédiaire ;
les lots déjà livrés, eux, ne sont jamais rejoués). **Point fixe** : dans un rejeu, un lot en conflit le reste — le journal exporté (mise à jour,
`db:appliquer-edition`) ne l'emporte pas ; la reconstruction suivante de la base vivante le réévalue (un lot pas encore résolu ; un lot résolu
jamais, sa résolution est un lot à elle). Le rejeu se fait donc par passes : chaque lot tombé en conflit est écarté et
la passe recommence sans lui (ni parmi les modifications « plus récentes » d'une ligne, ni parmi les lignes fantômes), jusqu'à ce qu'une passe n'en
écarte plus. Le résultat est celui des seuls lots qui passent : la reconstruction suivante et le rejeu du journal exporté le redonnent, sans conflit
nouveau (`test/serveur-edition-rejeu-fantomes.test.mjs`, dont les scénarios des revues adverses). Une ligne créée puis supprimée par le journal en
attente est « fantôme » le temps de cette vie : elle n'est pas insérée (ses modifications non plus), et une ligne qui la citait entre-temps (un bloc
de la chronologie lié à la page d'un métier créé puis supprimé) ne met pas son lot en conflit. Rien n'en est noté : ses modifications restent en
attente jusqu'à la livraison et sont réévaluées à chaque rejeu. À la fin d'une passe, un fantôme qu'une référence cite encore (le lot qui retirait la
citation est en conflit ; une clé étrangère qui ne vise pas la clé primaire, comme `capacite(specialite_id, classe_id)`, est comparée aux valeurs de
ses insertions) est écarté : la passe recommence avec sa ligne rejouée comme une autre — créée, modifiée, et supprimée seulement si plus rien ne la
cite. Aucune référence n'est jamais laissée rompue, et une création dont la suppression est en conflit existe entière. Un lien non plus : une page
des Règles (`guide/…`) qu'un lot supprime (rejouée « appliquée » : pas une page que les règles n'ont déjà plus) alors qu'un texte qui reste la cite (le lot qui retirait la citation est en conflit, ou les règles livrées la
citent depuis ; citations de `lib/citations-db.mjs`, la page retirée gardant pour la résolution son titre, les alias que le lot lui retire et son
adresse, que cite un mot-clé qui y mène et ses balises, hors pages d'exemple et colonnes dérivées) met son lot en conflit, avec la raison (`serveur/edition.mjs#liensRompusParLeLot`, dans `apresLeLot`) ; de même, comme le service les refuse, la fiche
d'un don (`capacites/…`, supprimée avec lui ou sa spécialité) que l'on cite encore, et un métier dont l'ancre est encore l'adresse d'un mot-clé
(`PAGES_GARDEES_AU_REJEU` : sa ligne et ce qui la compose n'ont aussi que le choix 2) ; sur la page
« Mise à jour », sa suppression et celles de ce qui la décrit n'ont que le choix 2 tant que le lien reste, et un choix 1 qui le casserait est refusé
(`409`) : résolu d'abord le lot qui retirait le lien, elle passe. Une ancre figée non plus : un lot noté avant la garde des ancres qui en retire,
renomme ou double une que les règles ont (même reçue depuis, migration `0100`) est une forme ancienne sans équivalent, son lot en conflit avec la
raison qui nomme l'ancre, et sur la page « Mise à jour » le choix 2 seul (`serveur/edition.mjs#ecrituresQuiRompentLesAncres`, dans l'adaptateur du
rejeu comme `ecrituresFigees`). Le service ne vide le
dictionnaire des sources que de ses orphelins (`supprimerPage`) : rejouée alors qu'une page la cite encore (sa suppression est en conflit), la
suppression d'une source n'est pas faite (`siOrphelines`). Un bloc de description de la chronologie, ou d'un panneau de règles, ne reprend jamais le
rang d'un bloc supprimé (`serveur/edition.mjs#rangLibre`, commun aux deux : table, journal et historique). Une suppression ancienne d'un mot-clé
qu'un endroit mentionne encore dans la base où elle est rejouée (décision R196 ; un lot noté avant R196, quand la cascade réécrivait les textes du site
de dev, ou des règles livrées qui le citent depuis) met son lot en conflit, avec la raison qui nomme ces endroits, sans rien écrire ; sur la page
« Mise à jour », cette suppression n'a que le choix 2, comme les colonnes figées (l'examen du lot refait le même calcul :
`serveur/edition-conflits.mjs#examiner`, par `OUTILS_DE_RESOLUTION` ; un choix 1 referait la cascade) (crochet `avantLeLot` de `rejouer`, sur la base telle que le lot la trouve :
`serveur/edition.mjs#motsClesEncoreMentionnes`, les mentions de `lib/mentions-des-mots-cles.mjs` hors de ce que le lot retire ou réécrit lui-même, des
colonnes dérivées, refaites depuis leurs tables, et des pages d'exemple, absentes du site de dev construit sans elles, où elles ne bloquaient pas la
suppression ; une fusion n'est pas visée). **Une suppression forcée se rejoue forcée** (décision R223 (6)). Le rejeu la reconnaît au marqueur que le service pose en tête du résumé du lot (`modification_lot.resume`) : « [suppression forcée R223 : id, …] » pour chaque mot-clé supprimé en forçant, avec ou sans mention, et « [fusion des mots-clés : source > cible, …] » pour chaque fusion (`serveur/edition.mjs#marqueursDuLot`, `marqueursDuResume`, `suppressionForcee`, `cibleDeLaFusion`). Les ids d'un marqueur d'après la migration 0113 sont des entiers ; ceux d'un lot d'avant (sa ligne de `mot_cle` nomme le mot-clé par un id texte : `lotDAvantLa0113`) se traduisent par la correspondance de la migration (`registreDes0113`), même l'ancien id « 400 », qui n'est pas l'id entier 400. Le marqueur est gardé entier hors de la troncature du résumé (`terminer(…, { entete })`), neutralisé dans le résumé de chaque opération (un nom saisi ne peut pas l'écrire : `neutraliserLeMarqueur`), et repris en tête par la résolution d'un conflit (`separerLeMarqueur`) ; le journal le porte partout où il va (export, rapatriement, mise à jour). Rien n'est deviné à ce que le lot écrit : une fusion dont la source n'était portée que par des pages qui portaient déjà la cible se rejoue en fusion (ses balises reçues depuis citent la cible), et un lot d'avant R223, cascade d'avant R196 comprise, n'est jamais forcé (il garde son conflit de R196) ; la cible d'une fusion ancienne, sans marqueur, se lit à ce que le lot reporte (`cibleReportee`). Une suppression forcée n'est jamais en conflit pour ses mentions, et celles qui sont présentes au rejeu (textes reçus depuis, pages d'exemple, définitions verrouillées : le verrou n'y est pas contrôlé, comme pour la fusion) deviennent leur texte affiché, après le lot (`balisesRetireesParLeLot`, puis `balisesDesColonnesDerivees`) ; les réécritures que le lot note se rejouent comme toute modification (elles passent sur un texte inchangé). Le rejeu ne contrôle ni le verrou des mots-clés ni le gel des monnaies (décisions R219 (6), R220 (1)) : un lot ancien qui modifiait ou supprimait un mot-clé désormais verrouillé, ou qui créait, modifiait (abréviation, remarque) ou supprimait une monnaie, passe ; la résolution d'un conflit non plus (`OUTILS_DE_RESOLUTION.modifier` : choix 1 et 2 ; le choix 3, une valeur saisie, n'est pas offert sur une ligne gelée, « Lots du journal en conflit ») ; « race hybride » créé par un lot noté avant la migration 0110 (son insertion, ou le mot-clé à créer d'un lot d'avant la 0043) l'est verrouillé, comme aujourd'hui (R220 (2), `raceHybrideVerrouillee`) ; seul le renommage d'une monnaie reste en conflit (R193, `COLONNES_FIGEES`). Supprimer un mot-clé (`mot_cle`) rejoue aussi les `ON DELETE CASCADE` de `page_tag` (les pages d'exemple), que la mise à jour
des règles a donc le droit d'écrire ; et, pendant de cette cascade, au même moment (dans son lot, annulé avec lui : `apresLeLot` de `rejouer`,
`balisesRetireesParLeLot`), un mot-clé que le lot supprime ou fusionne quitte les balises de **tous les textes** de la base où il est rejoué (colonnes de
texte des règles et des pages, `textesDeLaBase` : pour une suppression, il ne reste là que les pages d'exemple ; pour une fusion ou une suppression
forcée, aussi les textes que le site de dev n'avait pas) — retirées (leur texte simple ; leur texte affiché pour une suppression forcée), ou
reciblées pour une fusion dont la cible se reconnaît aux étiquettes ou aux balises que le lot a reportées (`cibleReportee`) — : un lot suivant qui
modifie un de ces textes (le site de dev l'a lu ainsi réécrit, sa base vivante refaite par le même rejeu) le retrouve tel qu'il l'a lu, et passe. Les
colonnes dérivées (corps et résumé des pages typées) sont refaites ensuite depuis leurs tables (`recalculerLesPages`, qui reçoit ces réécritures comme
des lignes rejouées), puis ce qu'il y reste est retiré (`balisesDesColonnesDerivees` : pages d'exemple ; une colonne dérivée n'est jamais comparée au
rejeu). Tables comptées dans `tablesCompletees`, `page` comprise (le job GitHub de la mise à jour les permet de même : `tablesDuLot`, d'après les
fichiers de `data/rows` qui ont une balise, `tablesAvecBalises`, et `page`). Un lot noté avant la migration 0090 (« CR » fondu dans « Corruption »,
R183 (3)) est lu comme la migration a réécrit les règles (`ancienneEcritureDesFusions`, d'après `FUSIONS_DE_MIGRATION`, avant l'adaptateur du
glossaire) : dans `avant` comme dans `apres`, `{{cr|…` et `{{cr\|…` deviennent `{{corruption|…`, `{{cr}}` devient `{{corruption|CR}}`, `{{cr:}}` et
`{{cr :}}` deviennent `{{corruption:}}`, et les étiquettes vers `cr` (`page_tag`, `sort_mot_cle`, clé comprise) citent `corruption` (une insertion qui
doublerait une étiquette déjà là est sans effet) : ni balise que `db:check` refuserait, ni faux conflit sur un texte que la migration a reciblé. Une
écriture sur la ligne `cr` elle-même (renommage, définition, suppression) n'est pas reportée sur `corruption` (la migration y a déjà fondu la définition ;
un libellé reporté écraserait le sien) : le lot est en conflit (« la ligne n'existe plus dans les règles »), comme pour un mot-clé que les règles ont
fusionné, et se résout sur `/mise-a-jour/`. Un lot noté avant la migration 0098 (les liens devenus des balises) est lu comme la migration a réécrit
les règles (`ancienneEcritureDesLiens`, après `ancienneEcritureDesFusions`) : dans `avant` comme dans `apres`, chaque `[[…]]` ou `[texte](/…)` d'une
colonne de `textesDeLaBase` devient la balise que la migration a écrite (`lib/liens-en-mots-cles.mjs#convertirLesLiens` avec la table du registre
de la migration, lue dans sa référence `data/references/liens-en-mots-cles-0098.json`, `tableDesLiensDeLa0098` ; la référence, et celle de la 0113
(`ids-des-mots-cles-0113.json`, `registreDes0113`), sont jointes au service livré, `serveur/livraison.mjs#FICHIERS_JOINTS` ; jamais le registre lui-même :
`docs/chantier-base-de-dev.md`, « Les lecteurs des migrations mixtes »),
et le texte simple que la migration a balisé sur l'Alchimiste et l'Apothicaire (`artisanat_texte`, `artisanat_brut`) l'est de même ; une page
d'exemple et un lien inconnu du registre restent tels quels. Un mot-clé que vise l'un de ces deux adaptateurs se supprime dès que rien ne le mentionne
(décision R211, « Les rendre supprimables ») : rejoué sur des règles qui ne l'ont plus, un lot ancien écrit du texte simple — la balise de `cr` devient
son texte écrit, sinon « CR » (`lib/mots-cles-balises.mjs#retirerLeMotCle`), une étiquette vers `cr` est sans effet, quand `corruption` n'existe plus ;
le lien qui menait à un mot-clé du registre supprimé devient son texte affiché, et le texte simple de l'Alchimiste ou de l'Apothicaire n'est pas
balisé —, jamais une balise vers un mot-clé absent. Une définition d'un lot d'avant 0090 sur un des mots-clés dont la migration a complété la définition (ou
changé le libellé : « Classe », « Métier ») est un vrai conflit : les deux côtés ont écrit le même texte. Un lot noté avant la migration 0056 (le glossaire) qui pose sur une page l'étiquette d'un
mot-clé absent et non protégé (la fiche d'un don créé par l'ancien code portait celle de sa classe), crée un mot-clé non protégé sans définition ou
renomme un mot-clé que les règles n'ont plus est rejoué **sans effet** (`ancienneEcritureDuGlossaire`, `sansEffet` de l'adaptateur : « intégrée », rien
d'écrit), comme ce qui suit dans le journal la même ligne ou ce mot-clé (une étiquette retirée, déplacée vers lui, un renommage) ; rien d'autre de son
lot n'est en conflit à cause d'elles. Une insertion qui suit est jugée pour elle-même : un mot-clé créé depuis 0056 sous le même id (le rapatriement
rejoue les lots déjà intégrés avec les suivants) ou une étiquette reposée à la même place passent. Un lot noté avant la migration 0043 (page_tag avec sa
colonne `libelle`, un mot-clé que le vocabulaire n'a pas) est lu dans la forme nouvelle au rejeu (`adapter` de `rejouer` : `ancienneEcritureDesMotsCles`) :
le mot-clé manquant est retrouvé par son écriture ; sinon, un mot-clé libre est sans effet depuis 0056 (ci-dessus : ni le mot-clé, ni l'étiquette), et un
mot-clé dont le site se sert est créé sous l'id noté (`-2`… seulement si l'historique l'a déjà employé) dans chaque lot qui le pose, s'il manque — par le
premier qui passe, avec son écriture, même si la ligne de `page_tag` est retirée ensuite —, annulé avec un lot en conflit, jamais noté au journal, et
jamais retiré ensuite ; table `mot_cle` alors écrite par la mise à jour. Un lot noté avant la migration 0044 qui touche les capacités d'une carte (une
capacité avec son `nom` et son `texte`, ou le texte de la rubrique « Capacité(s) », que 0044 vide : décision R66) n'a pas d'équivalent sûr (laquelle
des capacités communes, et à quel rang : 0044 a détaché « Tome de la corruption niv.1. ») : l'adaptateur (`ancienneEcritureDesCapacites`,
`serveur/edition-bestiaire.mjs`) rend un `conflit`, et le lot passe en conflit avec un message qui dit quoi refaire, au lieu d'un conflit qui ne
s'explique pas — rien n'en est écrit, ni dans les règles ni dans l'historique. Les autres modifications des monstres notées avant 0044 passent. Un lot
noté avant la migration 0075 (décision R155 : la « Double résistance » devenue la Grande résistance) : l'adaptateur (`ancienneEcritureDesResistances`,
`serveur/edition-bestiaire.mjs`) traduit le sens `double_resistance` en `grande_resistance` (`monstre_defense` : clé, `avant`, `apres` ;
`monstre_rubrique.rubrique`), et met en conflit explicite un lot qui note un titre d'avant 0075 (« … ÷4 », « … x4 » : seule la suppression d'une carte
en note un). Un lot noté avant la migration 0103 (décision R205 (3) : l'état « Gelé » s'écrit « Gel ») : l'adaptateur (`ancienneEcritureDuGel`,
`serveur/edition.mjs`) reconnaît un lot dont un `avant` écrit encore « Gelé » dans un texte que la migration a réécrit (`TEXTES_DU_GEL` : résistances
des magies, rubriques et capacités communes du bestiaire, accessoires, maladies, Mage Bleu et sa page) ou une cible `gele` de `monstre_defense`, là où la ligne attendue ne
l'écrit pas (celle que les lots précédents du journal, adaptés, ont laissée, sinon celle des règles : un `avant` « Gelé » qu'un lot noté après la
0103 a retapé est la ligne attendue, son lot passe tel quel au lieu de tomber en faux conflit), et réécrit chacune de ses modifications sur ces textes comme la migration (`ecritureDuGel` : « Gelé » → « Gel », « gelé N » → « gel N » ; `avant` et
`apres` ; cible « Gel », clé `gel`) ; un lot sans cette trace passe tel quel, un emploi adjectival (« sol gelé ») n'est jamais touché. Les
colonnes calculées d'après les matériaux (décision R207 (1), E6 : type, AP, AM et prix d'une armure de la grille ; AP, AM et prix d'un bouclier) :
un ancien lot qui en écrit une directement, à une valeur que les règles n'ont pas, sans écrire aucune entrée du calcul (`TABLES_DES_ENTREES_DU_CALCUL` :
prix d'un matériau, types, AP et AM des matières, coût de « Armure Complète », prix d'une forme, constante des unités ; un lot du service d'aujourd'hui
note ces colonnes avec l'entrée qui les change), est une forme ancienne sans équivalent : l'adaptateur (`ecrituresDesValeursCalculees`,
`serveur/edition-armures.mjs`) le met en conflit avec sa raison, et sur la page « Mise à jour » il n'a que le choix 2, comme `COLONNES_FIGEES` ; une
valeur déjà dans les règles passe, une armure particulière (R80) n'est pas visée. Après chaque lot rejoué qui écrit une entrée du calcul, le crochet
`apresLeLot` refait, hors journal, les colonnes calculées qui ne sont plus à la formule (`valeursCalculeesParLeLot` : un lot noté avant R207 qui change
le prix d'un matériau ne note pas ses armures ni ses boucliers), et la ligne du corps des pages Armures et Bouclier ; `armure`, `bouclier` et `page`
vont dans `tablesCompletees`, et `scripts/mise-a-jour-github.mjs#tablesDuLot` suit la même règle (`TABLES_DES_ENTREES_DU_CALCUL`,
`TABLES_DES_VALEURS_CALCULEES`, recopiées). Un lot
noté avant la migration 0063 qui écrit le coût d'un sort en une case, comme le classeur (« 12 + 3 âmes ») : l'adaptateur (`ancienneEcritureDuCout`,
`serveur/edition.mjs`, décision R105) le rejoue en deux colonnes, « Coût » et « Coût secondaire », par la règle de la migration
(`lib/sort-cout.mjs#repartirLeCout`), son `avant` comme son `apres`, colonnes typées relues ; un coût qui ne se répartit pas (l'un des 26 que le
propriétaire a tranchés depuis : décision R106, migration 0065) est rejoué tel quel et passe donc en conflit (la base n'a plus son `avant`), et un lot
noté depuis (les deux colonnes) passe tel quel. Le journal stocké garde sa forme (l'historique aussi : un import qui y
écrit le coût en une case se lit en deux, comme au rejeu). Le
**corps et le résumé des pages typées**, et les champs structurés des fiches de dons, ne sont pas des valeurs figées du journal (`colonneDerivee`) : le rejeu ne les compare ni ne les écrit, puis
`rejouerLeJournal` (`serveur/edition.mjs`) les refait depuis les tables rejouées, pour chaque page qu'elles touchent — dans la base vivante comme dans
`db:appliquer-edition` et la mise à jour des règles. Un lot n'est donc jamais en conflit pour une page qu'une autre modification ou une livraison a
réécrite, et un lot noté avant que l'édition ne suive le corps voit le corps de ses pages rattrapé (`serveur-edition-rejeu-corps`). De même, les
**liens de règle des métiers** (décisions R33, R35) qu'un lot noté avant la migration `0024-metiers-fiche` n'écrivait pas — compétence ou initiative d'un
bonus, objets de départ d'un équipement — sont refaits depuis les champs des métiers touchés (`completerLesMetiers`) ; la mise à jour des règles compte
ces tables parmi celles qu'elle a le droit d'écrire (`tablesCompletees`). Les **sources de maîtrise d'arme** (`maitrise_arme_part`,
`maitrise_arme_part_famille`, `capacite_nm_gagne` : migration 0076, décisions R148 à R151, R154) sont des tables de règles que le lecteur de
`lib/maitrise-arme.mjs` tire des lignes de `classe_maitrise_arme` et du texte des dons : l'édition les refait, notées au journal, à chaque écriture qui
change ce qu'il lit (les maîtrises d'une classe, l'effet d'un don, un don créé ou supprimé : `serveur/edition-maitrises.mjs`, les parts qui partent
avant leur ligne de classe ou leur don, les nouvelles après, à cause des clés étrangères) ; après chaque lot rejoué qui touche une classe ou un don, le
rejeu les refait par le même lecteur, hors journal (`sourcesRefaitesParLeLot`, crochet `apresLeLot`) : un lot noté avant 0076, qui ne les écrivait
pas, laisse des parts justes, et ces tables comptent dans `tablesCompletees` (et dans `tablesDuLot` dès qu'un lot touche `classe`,
`classe_maitrise_arme`, `capacite` ou `arme_famille`). Un lot qui écrit une famille d'armes (décision R159) touche toutes les sources : le rejeu refait
celles de toutes les classes et de tous les dons qu'il ne note pas, et la résolution d'un tel lot en conflit les refait toutes. Le rejeu ne refuse pas une maîtrise que le lecteur ne lit pas (l'édition la refuse à la saisie depuis le
2026-10-23) : un lot déjà noté se rejoue, ce qui ne se lit pas n'y donne aucune part, et une valeur ainsi notée perd son choix 1 à l'examen d'un lot
en conflit (« l'édition refuse aujourd'hui cette valeur »). Rejouée clés
étrangères coupées (base vivante refaite, mise à jour des règles), une suppression applique d'abord les `ON DELETE CASCADE` du schéma (`lien`,
`lien_candidat` : les `[[liens]]` d'une page supprimée) et les `ON DELETE SET NULL` (une monnaie supprimée par un lot ancien : `mot_cle.monnaie_id`
passe à `NULL`, le mot-clé reste ; `edition-journal.mjs#supprimerLesCascades`), sans les noter, comme SQLite le fait dans la base vivante ; `tablesCompletees`
et `scripts/mise-a-jour-github.mjs#tablesDuLot` permettent alors `mot_cle` ; sinon supprimer une page qui a des
liens mettait le lot en conflit (`serveur-base-vivante`). Chaque lot contrôle les clés étrangères des tables qu'il touche et de celles qui les citent,
**sauf celles des fiches** (`horsControleParLot` : la section 13, recopiée avant le rejeu) : une fiche peut citer un don, une spécialité ou une classe
qu'un lot suivant crée, et mettait en conflit un lot antérieur sans rapport qui touchait la même table ; `transferer` retire ensuite des fiches les dons,
spécialités, sorts et métiers disparus (R42 : jamais avant le rejeu complet, qui peut créer ce qu'une fiche cite), puis contrôle toutes les fiches.

**Rapatriement dans le dépôt** : le lien « N modifications à rapatrier » (à côté du crayon, `GET /api/edition/journal/`) télécharge le journal (les
modifications en attente, et les « intégrées » des lots absents de `historique_modification` : un don créé puis supprimé avant que la base vivante soit
refaite n'a rien à rejouer, mais son lot doit entrer dans l'historique, sans quoi son identifiant pourrait être repris ; `journalExporte`, comme le lot
figé de « Effectuer la mise à jour »), puis

```bash
cd client
npm run db:appliquer-edition -- ~/Téléchargements/journal-edition-AAAA-MM-JJ.json --rows <copie>   # rejoue le journal sur une COPIE de data/rows (rien d'écrit en cas de conflit) ; --rows est exigé
# data/rows n'est plus commité à la main (copie du site de dev, écrite par le workflow seul) : la copie sert aux tests de rapatriement
```

Les modifications rejouées (réappliquées ou déjà présentes) sont versées dans `historique_modification` avec `version` vide (rapatriées à la
main ; un lot déjà dans l'historique n'est pas repris), puis les tables du journal sont vidées. Une fois livrées, ces modifications reviennent
« intégrées » sur le site de dev. Le site est la source des données qu'il modifie (ci-dessous, « Mise à jour ») : les tests ne s'arrêtent plus sur
une valeur que le site a changée.

Un lot noté par un site de dev d'avant la migration 0113 nomme ses mots-clés par leur ancien id texte : le rejeu le lit en id entier
(`ancienneEcritureDesIds`), et la trace versée aussi (`traceDAujourdhui`, serveur/edition.mjs : registre de la 0113, puis clé, puis clé quittée ;
`libelle_cle` devient `cle` ; id inconnu laissé tel quel). (Le mode `--reparer-traces` de `db:appliquer-edition`, qui refaisait cette mise à jour sur les traces
déjà versées dans `data/rows`, est retiré au lot 12 : il réécrivait `data/rows`.)

**Nature de chaque trace** (migration 0127, lot 6 du chantier de la base de dev, garde-fou 11). `modification_lot` et `historique_modification` portent
`nature` (`saisie`, `source`, `decision`, `migration`, `code`) et `decision` (le numéro « R275 », présent si et seulement si la nature est `decision`). La
nature est celle du **lot** ; chaque ligne de l'historique reprend celle de son lot. Le service écrit `saisie` pour tout lot de l'éditeur
(`edition-journal.mjs#ouvrirLot`). Dans la résolution d'un conflit, seule la **reprise** d'un lot gardé (`edition-conflits.mjs#resoudreUnLotGarde`) garde la
nature et le numéro du lot repris ; le lot des choix 2 et 3 et l'ancienne forme (lots annulés) passent par `ouvrirLot` et écrivent `saisie` (choix voulu : c'est
un clic sur le site). Le report vers l'historique (`serveur/historique.mjs#historiser`,
`scripts/mise-a-jour-regles.mjs`, l'extrait) ne change pas la nature. Le journal exporté (`maverick-edition/1`) porte `nature` et `decision` sur chaque
lot ; `chargerJournal` lit un journal téléchargé avant la 0127, sans ces champs, comme une `saisie` (`edition-journal.mjs#natureDuLot`, qui refuse une
nature inconnue ou un numéro de décision mal placé en nommant le lot). Test : `serveur-edition-nature-des-traces`.
**L'état d'origine** (`lib/historique-site.mjs`, lu par les tests, `db:check`, le rapprochement des classeurs : `historiqueSite`, `lireHistorique`, `defaireLeSite` de
`test/aide-base-d-import.mjs`) ne défait que les traces de nature `saisie` et `decision` (`NATURES_DEFAITES`) : un réimport d'une source, une migration ou un recalcul du code
(`source`, `migration`, `code`) font partie du contenu de référence. Un historique sans colonne `nature` (base d'avant la 0127) se lit comme des saisies ; `valeursDAvant` (les noms
qu'une ligne a portés) lit toutes les natures. Tests : `historique-site`, `aide-base-d-import`.

| Requête | Réponse |
| --- | --- |
| `GET /api/edition/en-attente/` | Lignes modifiées depuis la construction des pages (`{ lignes: [{ table, cle, creee, ligne, apercu? }] }`), sans les tables du vocabulaire (`mot_cle`, `mot_cle_categorie`, `mot_cle_synonyme`, `mot_cle_ancienne_cle`, `categorie_mot_cle` : `GET edition/listes/` et `edition/mots-cles/`) ni les lignes de `page`, `sort`, `type_sort` dont toutes les modifications ne font qu'écrire `mot_cle_id` (R309) |
| `POST /api/edition/lignes/` | `{ lignes: [{ table, cle }] }` → la ligne actuelle de chacune (passage en mode modification) |
| `GET /api/edition/listes/` | Listes des formulaires (compétences, catégories de classe, races hybrides sans classe raciale, onglets des Règles `onglets: [{ valeur, libelle }]`…) |
| `GET /api/edition/pages/` | Les pages du wiki (`id`, `titre`) : cibles d'un lien posé dans le texte du guide |
| `GET /api/edition/mots-cles/` | `{ motsCles: [{ id, libelle, cle, description, url, couleur, classe, pages, verrou, monnaie_id, synonymes, categories, anciennes_cles, mentions, refus_du_forcage }], categories: [{ id, libelle, libelle_cle, mots_cles }], css }` : le glossaire dans la base vivante (`id` : l'entier figé, migration 0113 ; `cle` : la clé que citent les balises et les adresses, R232 ; `synonymes` : leurs écritures dans l'ordre, R233 ; `categories` : les ids de ses catégories ; `anciennes_cles` : les clés qu'il a quittées ; `monnaie_id` : la monnaie dont c'est le mot-clé ; `description` : la définition telle qu'enregistrée, `NULL` tant qu'il n'est pas décrit ; `url`, `couleur` : le lien et la couleur, migration `0098`, `NULL` sans eux ; `classe` : la classe de sa couleur, `lib/mots-cles-liens.mjs#classeDuMotCle`, `null` sans couleur ; `pages` : le nombre de pages qui le portent) (`lib/mots-cles-db.mjs#motsClesDeLaBase` ; `verrou` : `1` si le mot-clé est verrouillé, décisions R218 et R219, `0` sinon, ce qu'il permet encore : `lib/mots-cles.mjs#RAISON_DU_VERROU` ; `mentions` : ce qui le mentionne, la forme du `409` d'une suppression, `[]` sans mention, pour tous en un passage, `lib/mentions-des-mots-cles.mjs#mentionsDesMotsCles`, environ 60 ms sur la base du lot) ; `css` : la feuille des classes des mots-clés colorés (`lib/palette-css.mjs#cssDesMotsCles` : la page la réécrit sans importer la palette) |
| `GET /api/edition/plan/` | `{ onglets: [{ id, titre, ordre, ouverture, entrees: [{ id, sorte, rang, page_id, titre, libelle, adresse, protection, citations, supprimable }] }], races: { pures: [{ id, nom, rang_liste }], hybrides: [...] } }` : le plan vivant des Règles (`serveur/edition-plan.mjs#planVivant`) — les onglets dans l'ordre, leurs entrées dans l'ordre du menu (`sorte` : `page`, `lien` ou `bientot` ; `titre` : celui de la page ; `libelle` : celui d'un lien ou d'une entrée « bientôt » ; `adresse` : relative à la racine du site) ; pour une page, `protection` (les raisons de `lib/pages-protegees.mjs`, `[]` si rien ne la protège), `citations` (`lib/citations-db.mjs`, celles des pages d'exemple marquées `exemple`) et `supprimable` ; `null`, `null`, `false` pour un lien ou une entrée « bientôt » —, et les races de chaque groupe dans l'ordre de la liste (`rang_liste`, puis le nom) |
| `GET /api/edition/chronologie/` | `{ evenements: [...], categories: [...] }` : les événements dans l'ordre de lecture, avec leur date, leur portée et leurs catégories, et les catégories avec leur nombre d'événements (la frise refaite au chargement, la gestion des catégories) |
| `POST /api/edition/evenement/` | `{ evenement }` → l'événement, ses blocs (texte, lien, titre de la page liée) et ses catégories ; `404` s'il n'existe pas (ou plus) |
| `POST /api/edition/race/` | `{ race }` → magies innées et relations de la race dans la base vivante |
| `POST /api/edition/classe/` | `{ classe }` → spécialités, dons, choix et fiches qui les citent (qui en seront retirées), et `variables` (la magie, `innee` ou `acquise`, de chaque don « Variable » de la classe : R181), dans la base vivante (D11) |
| `POST /api/edition/bestiaire/` | `{ connues, logo }` → l'ordre des lignes du tableau des monstres (`ordre` : leurs identifiants) et, pour celles que la page n'a pas (`connues`), la ligne et la carte en HTML (`lib/bestiaire-rendu.mjs`, comme la page construite, sauf le lien du nom, qui mène à la carte dans la page (`#carte-…`) : un monstre créé depuis la construction n'a pas de page ; le logo à la place du portrait, que le mode modification charge ensuite) ; `{ capacites: [ids des cartes] }` → `{ capacites: { id: html } }` : le bloc des capacités de ces cartes (`htmlDesCapacitesDeLaCarte`), après une modification de leurs capacités ou d'une capacité commune qu'elles ont (décision R66) |
| `POST /api/edition/portrait/` | `{ table, cle }` → le portrait d'une carte de monstre ou d'une espèce, en entier (`portrait` : data URL, ou null) et son cadrage. Les autres réponses (lignes lues, en attente, d'un lot, d'un conflit) ne donnent d'une image que `{ image: true, empreinte, resume }` (`lib/edition-modele.mjs#ligneSansImage`) : 700 000 caractères par image |
| `POST /api/edition/` | `{ page, operations: [...] }` → applique un lot d'un bloc (`modifier`, `creer`, `supprimer`, `relations`, `magies_innees`, `categories`, `fusionner_mots_cles` : `serveur/edition.mjs` ; `ordonner` : `serveur/edition-plan.mjs` ; `valeurs_de_capacite` : les valeurs « {N} » d'une capacité de monstre pour une carte, décision R69, `serveur/edition-bestiaire.mjs`) ; rend `{ lot, modifications, crees, lignes, fiches }` (`fiches` : les fiches de personnage dont le lot a retiré un élément, R42) |
| `GET /api/edition/journal/` | Le journal des modifications en attente, et des « intégrées » des lots que les règles n'ont pas encore reçus (`maverick-edition/1` ; chaque lot porte sa `nature` et sa `decision`), en pièce jointe |
| `GET /api/edition/extrait/` | L'extrait du contenu (un fichier SQLite) : ci-dessous, « Extrait du contenu et attestation de la production » ; `…/extrait/meta/` : son méta en JSON |
| `GET`, `POST /api/edition/lots/`, `GET /api/edition/lots/<id>/`, `POST …/<id>/{essai,appliquer,refuser,annuler}/`, `GET …/<id>/annulation/`, `POST /api/edition/lots/recalcul/` | Les lots de changements : déposer une proposition, la lire, refaire son essai à blanc, l'appliquer, la refuser ou l'annuler d'un clic, aperçu de l'annulation, « tout recalculer » (ci-dessous, « Lots de changements (service) ») |

**Pas de comptes** : quiconque a le mot de passe du site de dev peut modifier les règles (le journal n'a pas d'auteur :
`modification_lot.auteur_id` attend la connexion Discord). Mêmes protections d'écriture que les fiches (JSON, `Sec-Fetch-Site`).

### Lots de changements (format)

Lot 6 du chantier de la base de dev (R274, R275). Un **lot de changements** est un fichier d'opérations pour changer ce que le site ne sait pas écrire : le
décrit et le valide `client/src/lib/lot-de-changements.mjs` (module pur, sans base ni navigateur). Il n'écrit rien : le dépôt, l'essai à blanc, l'application
d'un bloc et les numéros sont le service (section suivante) ; l'annulation d'un lot et « tout recalculer » suivent (lot 6, PR 3).

```json
{ "titre": "…", "nature": "decision", "decision": "R275", "auteur": "…",
  "operations": [ { "table": "…", "cle": { "id": 12 }, "operation": "modifier", "avant": { "colonne": "ancienne" }, "apres": { "colonne": "nouvelle" } } ] }
```

- **En-tête** : `titre` (lisible, 200 caractères au plus), `nature` (`source`, `decision`, `migration` ou `code` ; `saisie` est refusée, un lot n'étant pas une
  saisie du site), `decision` (« R… », si et seulement si la nature est `decision`), `auteur` (libre, facultatif), `format` (facultatif, `maverick-lot/1`).
  Une clé inconnue est refusée (une faute de frappe ne passe pas en silence).
- **Opérations**, dans l'ordre (le rang d'un message d'erreur est la place dans la liste, à partir de 1) : `table`, `cle` (l'objet de **toute** la clé
  primaire), `operation` (`inserer`, `modifier`, `supprimer`), `avant` (les valeurs attendues des colonnes touchées ; la ligne **entière** pour `supprimer` ;
  absent pour `inserer`), `apres` (les valeurs écrites ; absent pour `supprimer`) : la forme de `avant` / `apres` d'une ligne de `modification`. Une insertion
  porte sa clé dans `apres` ; une modification ne touche pas la clé et change chaque colonne qu'elle nomme.
- **Contrôles** (`controlerLeLot` : toutes les erreurs d'un coup, avec le rang à corriger) : table existante et de classe « contenu » (`lib/tables-de-la-base.mjs`),
  hors notes de version, historique et journal ; colonnes existantes ; clé complète ; cohérence `avant` / `apres` / opération ; jamais deux opérations sur la
  même ligne, sauf deux `modifier` de colonnes différentes. La structure des tables (colonnes, clé) est fournie par l'appelant (`PRAGMA table_info`).
- **Éteint hors de l'édition** : un lot est refusé pour une table que le service d'édition ne sait pas écrire (les tables de `TABLES` et d'`ENTITES`, `lib/edition-modele.mjs`,
  la seule liste : `tablesDeLEdition`), tant que `LOT_OUVERT_AUX_TABLES_HORS_EDITION` vaut `false` ; elle passe à `true` au lot 8, avec l'accord du propriétaire.
- **Valeurs attendues** (`comparerAvecLaBase(lot, lireLigne)`) : par opération, `applicable` ou `changee` (ligne déjà là pour une insertion, absente ou de valeur
  changée pour le reste), avec `raison` et, pour une valeur, `ecarts` (`colonne`, `attendue`, `actuelle`). Le site prime : une opération `changee` n'est pas écrite,
  elle est listée. C'est la base de l'essai à blanc.

- **Numéro à donner** : la clé entière d'une insertion (table à clé simple de type entier) s'écrit `{ "$numero": "a" }` ; le même jeton se réutilise ensuite
  dans `apres` (ou dans la clé d'une insertion à clé composée) d'une opération **suivante** du même lot. Un jeton se donne une fois, n'entre jamais dans `avant`
  ni dans la clé d'une modification ou d'une suppression. `donnerLesNumeros(lot, depart)` rend le lot résolu : numéros consécutifs par table et colonne, dans
  l'ordre des opérations ; `depart` est le plus haut numéro connu (le service le calcule : ci-dessous).

Tests : `lot-de-changements`, `lot-de-changements-numeros`, `serveur-edition-nature-des-traces`.

### Lots de changements (service)

Décision du propriétaire (R275, question 4 a) : « Chaque lot attend votre clic sur le site de dev, avec un aperçu avant et après. » Code :
`serveur/edition-lots.mjs` (les routes, dans `serveur/api.mjs#traiterLots`), `serveur/edition.mjs#appliquerUnLot` (l'hôte de l'application),
`serveur/controles-du-contenu.mjs` (les contrôles de `db:check`). Tables : `lot_de_changements` et `numero_donne` (migration 0128). Deux états de l'accès, que choisit
le propriétaire (R291, qui remplace R275 (4) : « Direct ») :

- **Tant que la clé de dépôt n'est pas posée** (l'état sûr, aussi sans aucun réglage d'accès) : une session **dépose** une proposition avec la **clé de lecture** ; rien n'est
  écrit dans le contenu ; le propriétaire l'**applique** ou la **refuse** (mot de passe). C'est le comportement de R275 (4a), inchangé.
- **Une fois la clé de dépôt posée** (`acces.sh --cle-de-depot`, « Accès au site de dev ») : la clé de lecture, que détient aussi la CI, **ne dépose plus** (`403`). La clé de
  **dépôt** ou le mot de passe déposent, et le lot est **appliqué aussitôt**, sans clic ; le propriétaire **annule** ensuite le lot, ou une seule de ses lignes (« Annuler une seule
  ligne », ci-dessous). Les propositions déjà déposées restent « propose » et se décident par leurs routes `appliquer` / `refuser` (mot de passe).

Sans mot de passe posé, le site se comporte comme avant.

| Route | Classe d'accès | Rôle |
| --- | --- | --- |
| `GET /api/edition/lots/` | lecture | Les lots, le plus récent d'abord (résumé : état, verdict de l'essai, `application`, `lignes_annulees`, `refus` ; lot appliqué : `lignes_nettes`, le nombre de ses lignes, sans lire son détail (absent si son journal est illisible), et, référence lisible, `ecart_production`) |
| `POST /api/edition/lots/` | proposition | Le lot (`maverick-lot/1`) : contrôlé par `controlerLeLot` (400 avec le rang de l'opération à corriger : `erreurs`), enregistré, essayé à blanc ; `201` avec l'essai (« propose »). **Clé de dépôt posée** : appliqué aussitôt (`201`, « applique »), ou refusé aux contrôles (`409`, « refuse », `motifs`) ; `verrous_ouverts?: ["R…"]` dans le corps (mot de passe seulement) |
| `GET /api/edition/lots/<id>/` | lecture | Le contenu déposé, l'essai (aperçu avant et après), le bilan ; un lot appliqué ou annulé porte `lignes` (« Annuler une seule ligne » ; référence lisible : `ecart_production` sur chacune) |
| `POST /api/edition/lots/<id>/essai/` | proposition | Refait l'essai (n'écrit que `essai` et `essaye_le`) |
| `POST /api/edition/lots/<id>/appliquer/` | écriture | `{ verrous_ouverts?: ["R…"] }` : l'application d'un bloc (le clic du propriétaire) |
| `POST /api/edition/lots/<id>/refuser/` | écriture | L'état « refuse » : rien n'est écrit, la proposition reste |
| `GET /api/edition/lots/<id>/annulation/` | lecture | L'aperçu de l'annulation d'un lot appliqué, calculé sur une copie (rien n'est écrit) : par ligne du lot du journal, `remise`, `gardee` (avec la valeur trouvée), `deja` |
| `POST /api/edition/lots/<id>/annuler/` | écriture | `{ verrous_ouverts?: ["R…"] }` : « Annuler ce lot » d'un bloc (le clic du propriétaire) |
| `GET /api/edition/lots/<id>/lignes/<n>/annulation/` | écriture | L'aperçu de l'annulation d'une seule ligne du lot, sur une copie (rien n'est écrit) |
| `POST /api/edition/lots/<id>/lignes/<n>/annuler/` | écriture | `{ verrous_ouverts?: ["R…"] }` : « Annuler cette modification » (le clic du propriétaire, après confirmation de la page) |
| `POST /api/edition/lots/recalcul/` | proposition | « Tout recalculer » : dépose les écarts des colonnes dérivées comme un lot de nature `code` (`201 { lot, recalcul }` ; `200` sans lot quand rien ne diffère) ; avec la clé de dépôt posée, le lot est appliqué aussitôt comme tout dépôt |

La classe **proposition** (`serveur/acces-routes.mjs`) est la porte des **dépôts** : déposer, refaire un essai, « tout recalculer ». Tant que la clé de dépôt n'est pas posée, elle a la
porte de la lecture (la clé OU le mot de passe) et elle n'écrit que `lot_de_changements` ; une fois posée, elle demande **la clé de dépôt OU le mot de passe** : sans rien `401`
(`acces: "cle_de_depot"`), avec la clé de lecture `403` (« la clé de dépôt est nécessaire »). Appliquer, refuser, annuler (le lot ou une ligne), qui décident, demandent le mot de passe,
que la clé de dépôt soit posée ou non : la clé de dépôt n'est pas une clé d'écriture. En production : `403` avant tout.

**Dépôt appliqué aussitôt** (R291 ; `edition-lots.mjs#deposerEtAppliquer`, `acces.mjs#depot`). Le service décide au dépôt : le réglage pose une clé de dépôt **et** la requête porte cette clé ou
le mot de passe → direct ; sinon (clé pas posée, aucun réglage d'accès, tests) → proposition, comme avant (« sans réglage, tout est permis » reste vrai pour le clic, mais le mode
direct est un choix du réglage). Le chemin est celui du clic : `deposer` (format : `400` motivé, rien n'est enregistré), essai à blanc sur une copie, puis `appliquer` dans une
transaction, contrôles du contenu rejoués, numéros donnés, lot du journal de la nature et de la décision du lot (ses modifications « en attente » : rien ne part en production sans
« Effectuer la mise à jour »). `bilan.application = { directe: true, par: 'cle_de_depot' | 'mot_de_passe' }` dit comment le lot est entré (un lot appliqué par le clic du propriétaire n'a pas de `application`). Si l'essai ou l'application refuse (opération refusée, problème du contenu né du lot, verrou pas ouvert, rien à écrire), **rien n'entre** : le lot est
enregistré « **refuse** » (un arrêt du service ou une erreur inattendue entre le dépôt et la décision le laisse « propose » : le clic du propriétaire le décide) avec ses motifs dans `essai.refus_du_depot` (la base veut un `bilan` vide pour un lot refusé ; `refus` dans la lecture), et la réponse est un `409`
`{ erreur, lot, motifs }`. Ouvrir un verrou de décision est **réservé au mot de passe** : `verrous_ouverts` du corps (liste de « R… », `verrousDuClic`, retirée du lot déposé) ouvre ce que le gel lève (R218, R219, R232 (2)) et
est enregistrée dans le lot (`verrous_ouverts`, `bilan.verrous_ouverts`) quand le dépôt vient du mot de passe ; avec la clé de dépôt, un corps qui le porte est refusé (`403`, rien n'est enregistré), et un lot dont
l'essai rend `verrous` n'est pas appliqué : il est enregistré « refuse », les R… à ouvrir dans `refus.verrous` et les motifs. Un refus de règle (R105, R181…) reste refusé. « Tout recalculer » (`recalculerTout`, `par`) s'aligne : appliqué aussitôt quand le droit le permet.

**Annuler une seule ligne** (R291 : « annuler cette modification » sur chaque ligne du patchnote ; `lignesDuLotApplique`, `annulerUneLigne`, `dependancesDesLignes`). Une **ligne** est une ligne de
l'effet net du lot (`effetNetDuLot` : une ligne de table avec les colonnes que le lot en a changées, ou la ligne qu'il a créée ou retirée), pas une colonne isolée : le service écrit plusieurs fois
la même ligne (clé recalculée, page refaite) et remettre une seule colonne laisserait ces recalculs en désaccord. Son numéro `n` est le rang de sa première écriture au journal du lot : stable, jamais
renuméroté. `GET …/<id>/` d'un lot « applique » ou « annule » porte `lignes` : `{ n, table, ligne, genre ('modifier' | 'inserer' | 'supprimer'), colonnes: [{ colonne, libelle, avant, apres }], etat,
annulee?, colonnes_modifiees?, annulable_seule, motif, depend_de }` ; `etat` : `en_place` (rien n'y a touché), `annulee` (par son clic, ou par l'annulation du lot entier), `modifiee_depuis` (le site a
changé une valeur que le lot avait écrite : le site prime), `comme_avant` (déjà revenue à sa valeur d'avant). `annulable_seule` est faux, avec un `motif` en français : lot pas appliqué, ligne déjà
annulée ou comme avant, tout modifié depuis, ou **une autre ligne du lot encore en place la tient** (`depend_de`) : une insertion que cite une autre ligne (clé étrangère, ex. un mot-clé et son synonyme),
une suppression dont le parent a été retiré aussi, une page refaite par le site d'après les autres lignes du lot. Ce qui n'est pas lié par une clé étrangère (un renvoi dans un texte) est laissé aux
contrôles du contenu, qui refusent avec leur motif ; rien n'est annulé en silence. L'aperçu (`GET …/lignes/<n>/annulation/`, sur une copie, mot de passe) et le clic (`POST …/lignes/<n>/annuler/`)
réutilisent `annulerLeLot` filtré sur la ligne : mêmes règles que le lot entier (une valeur n'est remise que si elle vaut encore ce que le lot a écrit, une insertion n'est supprimée qu'intacte, une
suppression n'est réinsérée que si la ligne est absente, un numéro n'est jamais rendu), même `BEGIN IMMEDIATE`, contrôles rejoués, verrous par `verrous_ouverts`. Le lot du journal est « Annulation d’une ligne
de « … » : <ligne> » de la même nature et décision ; `bilan.lignes_annulees[n] = { annule_le, lot_id, colonnes, gardees }` garde l'état ; quand plus aucune ligne n'est en place, le lot passe « annule ».
Le lot entier reste annulable (les lignes déjà annulées y sont « deja »). Sans migration.

**Essai à blanc.** Une copie de la base vivante (`VACUUM INTO`, dans `<dossier de la base>/essais/`, supprimée à la fin même en cas d'échec ; jamais la base elle-même), dans
un fil à part (le service ne s'arrête pas ; un essai à la fois). Le lot y est appliqué par **le même code** que l'application, puis les contrôles du contenu de
`db:check` (`controlerLeContenu`) avant et après : seuls les problèmes **qui naissent du lot** comptent (`problemes_nouveaux` ; ceux d'avant sont gardés dans
`problemes_avant` pour le contrôle de l'application). Résultat enregistré dans `lot_de_changements.essai` : `verdict` (`applicable`, `verrous`, `a_corriger`,
`rien_a_ecrire`, `en_echec`), `comptes`, `verrous_a_ouvrir`, `numeros` (provisoires) et, par opération, `etat` : `applicable` ; `changee` (la valeur a bougé : `ecarts`
avec la valeur trouvée) ; `verrouillee` (`decisions`) ; `refusee` (`message`, le rang est celui de l'opération) ; chacune avec son `apercu` (table et ligne par leur
nom, chaque colonne par son libellé, valeur d'avant et d'après ; `lib/libelles-de-la-base.mjs`).

**Application** (`appliquerUnLot`) : dans **une** transaction et sous le même verrou d'écrivain que `POST /api/edition/` (`BEGIN IMMEDIATE`). La comparaison est refaite au
clic (`comparerAvecLaBase` : une valeur changée entre-temps n'est pas écrite, listée avec la valeur trouvée dans `bilan` : le site prime) ; chaque opération est écrite
**par le service d'édition dès que la table lui est connue** (`traduire`) : « modifier » pour les colonnes de `TABLES`, « supprimer » par l'entité de la table
(ses refus comprennent liens rompus, fiches R42…) ; une colonne que le service ne sait pas écrire, sur une table qu'il connaît, passe par le journal (voie générique :
`ecrire_modifier`, `ecrire_inserer`, `ecrire_supprimer`, jamais dans `OPERATIONS` : aucune route ne les joint), jugée par l'essai et par `db:check`. Le service ne crée pas
la ligne d'une table qu'il crée lui-même (identifiant tiré du nom, page, clés recalculées) : l'insertion y est refusée, sauf un **mot-clé** : le service le CRÉE (`creer` de l'entité : id suivant,
clé de la règle R232, adresse, couleur et icône contrôlées), `verrou` à 1 s'écrit ensuite sous le gel (colonne tenue, R218 (4) : le propriétaire ouvre R218 au clic) et le lot **vérifie** que la ligne
créée est celle qu'il décrit (`verifier_ligne` : identifiant donné à l'application, clé ; sinon 409) ; ses catégories sont des lignes de `mot_cle_categorie`, opérations du lot à part. Une entité sans
suppression (R159) n'est pas supprimée. Une opération que le service accepte sans rien écrire est refusée. Le journal : un `modification_lot` à la nature, au numéro de décision et au titre du lot
(`resume`), ses `modification` « en_attente » comme une saisie (le rapatriement et la mise à jour les reprennent). `lot_de_changements` passe à « applique »
(`lot_id`, `decide_le`, `verrous_ouverts`, `bilan` : opérations écrites ou changées, numéros donnés) dans la même transaction. Refus (409, rien n'est écrit, le lot reste
« propose ») : l'essai a des opérations refusées ou des problèmes nés du lot, une opération est refusée au clic, un contrôle du contenu échoue après les écritures
(rejoué dans la transaction), un verrou n'est pas ouvert, ou rien ne reste à écrire.

**Verrous des décisions.** Ce que le service refuse au nom d'une décision cite son numéro (« décision R219 ») : `decisionsCitees` le lit du message, sans liste recopiée. Un
refus qui cite un numéro et que le **gel** (`ctx.gel === false` : mots-clés verrouillés, monnaies ; R218, R219, comme au rejeu) lève est « verrouillée » à l'essai
(`decisions`) ; à l'application, il est refusé sauf si **tous** ses numéros sont dans `verrous_ouverts` (donné au clic), qui est alors enregistré. L'opération s'écrit alors
sous un gel ouvert pour elle seule. Un refus qui cite un numéro mais que le gel ne lève pas (une règle : R105, R181…) reste « refusée ». Rien ne change pour l'édition ordinaire :
`enregistrer` n'est pas touché, le gel reste fermé.

**Numéros.** Le numéro d'un jeton = 1 + le plus haut de : le plafond de `numero_donne`, le maximum de la colonne, le plus haut trouvé dans `modification` et
`historique_modification` pour cette table (`plusHautNumero`, `serveur/edition-journal.mjs`) ; le plafond est monté dans la même transaction (`INSERT … ON CONFLICT … max`). Un
numéro n'est donc jamais redonné, même après une suppression, une annulation ou une base restaurée sans `numero_donne`. L'édition ordinaire donne ses numéros entiers
(`idSuivant` des mots-clés, de leurs synonymes et catégories, `serveur/edition-mots-cles.mjs`) par **la même fonction** (`donnerUnNumero`) : l'id est 1 + le plus haut numéro connu
(et, pour un mot-clé, `mot_cle_ancienne_cle` et le registre de la migration 0113) et le plafond monte dans la transaction du lot ; seuls des numéros plus hauts sont possibles.
Le rejeu d'un ancien journal (`ancienneEcritureDesIds`) calcule un numéro sans le réserver (`monter: false`). Une base d'avant la migration 0128 (sans `numero_donne`) s'en passe.

**Annuler ce lot** (`annuler`, `previsualiserLAnnulation` ; plan : « remet une valeur seulement si elle vaut encore ce que le lot a écrit »). Pour un lot « applique ». La source est le lot du
journal (`lot_id` : `modification`, à défaut `historique_modification`), ramené à son **effet net** par ligne de table (`lib/lot-de-changements.mjs#effetNetDuLot` : le service
écrit plusieurs fois la même ligne) puis jugé (`jugerLAnnulation`) : une colonne qui vaut encore ce que le lot a écrit reprend son `avant` (`remise`) ; si elle a sa valeur d'avant,
`deja` ; sinon `gardee`, listée avec la valeur trouvée (le site prime). Une ligne **insérée** par le lot n'est supprimée que si elle vaut encore, en entier, ce qu'il a inséré ; une ligne
**supprimée** n'est réinsérée (à l'identique, `restaurer` : pas de refus des colonnes tenues par le service) que si elle est encore absente. Ordre : les lignes retirées d'abord
(la dernière retirée en premier), puis les colonnes changées (dans l'ordre du lot), enfin les lignes créées (la dernière créée en premier). Écriture par le service d'édition dès qu'il
connaît la colonne (`traduire`, comme l'application) : ce qu'il recalcule seul (la clé d'un mot-clé après son libellé, la page d'un métier) est déjà revenu quand on arrive à la ligne qui le
note (`deja`). Une colonne dérivée d'une page typée, que le service refuse d'écrire, passe par le journal. La comparaison est **refaite à chaque ligne** sur l'état du moment ; l'aperçu
(`GET …/annulation/`, classe lecture) est calculé par **le même code** sur une copie `VACUUM INTO` dans un fil à part (un à la fois, avec les essais), rien n'est enregistré ; il rend
`verdict` (`applicable`, `verrous`, `refusee`, `rien_a_remettre`), `comptes`, `verrous_a_ouvrir`, les opérations avec leur aperçu avant et après (`ecarts` des valeurs gardées) et les
problèmes du contenu nés de l'annulation. Le clic (`POST …/annuler/`, mot de passe) : une transaction sous le verrou de l'édition, contrôles du contenu rejoués (le calcul « avant » se fait
au clic, environ une seconde), un lot du journal `Annulation de « … »` de **la même nature et du même numéro de décision** que le lot annulé (titre neutralisé comme à l'application), puis
`lot_de_changements` passe à « annule » (`annule_le`, `annulation_lot_id`, `bilan.annulation` : le bilan d'application est gardé). Les verrous de décision se rouvrent au clic
(`verrous_ouverts`). Refus (409, rien n'est écrit, le lot reste « applique ») : rien à remettre (tout a changé depuis, ou est déjà revenu), une ligne refusée par le service, un verrou
non ouvert, un contrôle du contenu qui échoue, un lot du journal en conflit ou qui n'y est plus. Les numéros donnés restent dans `numero_donne`. Limite connue : annuler un
renommage de mot-clé laisse la clé que le renommage avait posée en clé quittée (un renvoi, R233 (11)), que le service tient lui-même.

**Tout recalculer** (`recalculerTout`, classe `proposition`). Après un changement de code, le corps, le résumé et les `donnees` des pages que le code dérive des tables et que
`recalculerLesPages` refait sans qu'on lui dise ce qui a changé — races, classes, fiches de dons, métiers (`TYPES_DE_PAGES_RECALCULEES`) — sont refaits **sur une copie** et comparés à
ce qui est stocké ; les écarts sont **déposés comme un lot de nature `code`** (une opération `modifier` par page : la valeur stockée en `avant`, la valeur recalculée en `apres`), essayé à
blanc et traité comme tout dépôt (R291) : appliqué aussitôt avec la clé de dépôt ou le mot de passe quand la clé de dépôt est posée, sinon proposé au clic. Aucun écart : `200`, aucun lot. Les pages de magie, refaites morceau par morceau (`TABLES_DES_PAGES_PAR_MORCEAUX`), y sont aussi : chaque ligne de leurs tables est rejouée telle quelle (avant = après) et leurs morceaux, repérés par leur
place, suivent leurs tables. Les pages des armes, des armures et des boucliers, des composants dont le site ne crée pas de ligne hors de leur tableau (Équipement inventaire, ingrédients d'alchimie) et des potions sont
refaites **en entier** (`refaireLesCorpsEntiers`, `corpsDesArmesEntier`, `corpsDesArmuresEntier`, `corpsDeLaPageDesComposantsEntier`, `corpsDesPotionsEntier`) : chaque tableau est repéré par sa section et
chaque ligne par son rang, jamais par son ancien texte, si bien qu'une ligne que le corps n'écrit plus comme le code d'aujourd'hui la rend est refaite (un recalcul sert à cela) ; la prose, les matières en
tête des lignes de l'importeur (grille des armures, boucliers) ne bougent pas. Les tableaux des matériaux, des gemmes et des bois (pages des armures, boucliers, bâtons, accessoires) ne se refont pas par rang : le site en crée
sans ligne dans ces pages, et une création reprend le rang d'un élément supprimé ; ils restent rejoués ligne à ligne (`TABLES_REJOUEES_DES_COMPOSANTS`), sans effet sur un corps qui a déjà la ligne. Une page dont le corps n'a plus la
forme de l'importeur (section ou tableau introuvable, nombre de lignes qui n'est plus celui de la base) reste telle quelle et se dit dans `pages_illisibles`. Les clés des mots-clés et les colonnes
calculées des armures (R207) sont tenues par le service et ne sont pas non plus dans ce recalcul.

**La page « Mise à jour »** (`src/scripts/mise-a-jour.mjs`, rendu pur `src/lib/lots-rendu.mjs` ; R291) : la section « Modifications de l'équipe » (`[data-nv-lots]`), entre les listes de la note en préparation
et les lignes en conflit, sur le site de dev seulement (`GET /api/edition/lots/` répond `403` en production, `404` sans le service : la section reste cachée ; une autre erreur est dite). Elle tient dans
le même bloc dépliant que les domaines de la note (`details.nv-domaine`, `[data-nv-lots-repli]`), replié au départ sauf si une proposition attend son clic ; le message d'après un clic reste au-dessus. Elle sert au
patch note et ne montre que **ce qui change par rapport à la production** (demande du propriétaire du 2026-11-21) : chaque ligne d'un lot appliqué est comparée à la base de référence (`ecart_production`, colonnes touchées par le lot,
`serveur/edition-lots.mjs#differeDeLaProduction`), sans limite de nombre ; un lot ou une ligne que la production contient déjà disparaît, même absent de `historique_modification` (lot livré, annulé puis redéposé à l'identique).
Référence illisible : le champ manque et rien n'est retiré. Refusés et annulés ne sont plus sur la page (Debug › DB, table `lot_de_changements`). Chaque changement
appliqué se lit comme les notes de version, ligne par ligne (`lignes[]` du détail : nom de la ligne, table, colonnes par leur libellé, avant puis après, état : en place, annulée, modifiée depuis,
comme avant). Une ligne `en_place` et `annulable_seule` porte « Annuler cette modification » : l'aperçu (`GET …/lignes/<n>/annulation/`) s'affiche dans une confirmation (`<dialog>`, une case par
décision à ouvrir), puis « Oui, annuler cette modification » envoie `POST …/lignes/<n>/annuler/` ; une ligne qui ne s'annule pas seule montre son motif et les lignes dont elle dépend ; un `409` se dit sous
la ligne. Il n'y a plus d'« Annuler ce lot » sur la page (la route reste). Un changement d'ancrage (décision R309 : des centaines de lignes) est replié sous son titre et son nombre de lignes (`lignes_nettes` de la liste moins `lignes_annulees` ; le nombre exact une fois le détail lu) : son détail (`GET …/lots/<id>/`) ne se lit ni au chargement ni après un clic, mais à la première ouverture du repli (« Lecture des lignes… ») ; un repli déjà ouvert est relu, une lecture en échec se dit avec « Réessayer » et ne se relance que par ce bouton. Les propositions encore en attente (déposées avant R291, ou sans clé de dépôt posée) ont leur bloc à part
(`[data-nv-lots-attente]`, présent seulement s'il en reste) avec l'aperçu, « Appliquer », « Refuser » et « Refaire l'essai », comme avant. « Tout recalculer » (`POST …/recalcul/`) dit si le recalcul est appliqué ou proposé. R292 : `retraits_bloquants` de `GET /api/mise-a-jour/`
donne une alerte (`[data-nv-retraits]`) avant « Effectuer la mise à jour » quand une race, une classe ou une magie citée par une fiche de la production serait retirée. Le mot de passe est demandé par
`scripts/acces.mjs` (rien à faire dans la page). Tests : `lots-rendu` (module pur), `mise-a-jour-lots` (le script dans un faux navigateur), `lots-rendu-service` (le rendu sur ce que rend le vrai
service), `serveur-edition-lots-ecart-production` (l'écart avec la production), `notes-de-version-retraits`.

**Éteint hors de l'édition** : `controlerLeLot` refuse au dépôt une table que le service ne sait pas écrire (jusqu'au lot 8).

### Lots de changements (épreuve)

L'épreuve d'entrée du lot 6 (R274, R275 ; plan : « refaire les migrations 0122 à 0124 sous forme de lots, sur une copie, et retrouver la même base »). Code : `serveur/epreuve-des-lots.mjs`
et `scripts/epreuve-des-lots.mjs` (`npm run db:epreuve-lots`, dans `client/`, sur une copie de la base des règles (`--regles`, `var/maverick.db` par défaut), environ une minute ; sortie : le partage, la comparaison table par table, les annulations).
Test : `epreuve-lots-0122-0124` ; lots : `client/test/fixtures/lots-0122-0124/` (`0122.json`, `0123.json`, `0124.json`, `complement.json`).

- **Fabriqués une fois** (`epreuve-des-lots.mjs fabriquer`, avec l'historique git ; le test ne le lit pas) : pour chaque migration, la base du commit parent de celui qui l'a ajoutée et celle de ce commit sont
  bâties depuis `data/rows` (les migrations 0122, 0123 et 0124 ne se suivent pas dans une même base : un rapatriement de l'édition passe entre la 0122 et la 0123) ; la migration rejouée en SQL sur l'avant doit
  redonner l'après (sinon rien n'est écrit) ; la différence, table de contenu par table de contenu, devient un lot (modifier, puis insérer parents d'abord, puis supprimer enfants d'abord, un mot-clé avant la page
  qu'il ouvre : R221). `nature` `migration` (0122, 0123) ou `decision` R272 (0124, que sa migration cite). Les clés entières insérées sont des numéros à donner (`mot_cle_421` : le jeton garde le numéro de la
  migration). `complement.json` : les lignes que le service retire **lui-même** avec une entité supprimée (page : entrée de menu, alias, étiquettes, sources de page ; mot-clé : catégories, synonymes, clés
  quittées ; `COUVERT_PAR_L_ENTITE`), que le lot ne porte pas (la ligne serait déjà partie : 404), et que l'épreuve vérifie par la comparaison. Les tables calculées (`lien`, `lien_candidat`) ne sont pas dans un lot.
- **Refaite sur une copie** : la base des règles, les trois migrations défaites en SQL direct (avec ce qui a été posé APRÈS elles sur les lignes qu'elles ont créées : des saisies du site, comme des catégories ajoutées à des mots-clés créés par la 0123, ou une migration suivante) = la base
  d'**avant** ; la **référence** = l'avant, le SQL des migrations rejoué ; le **service** = l'avant, chaque lot déposé, essayé et appliqué par `edition-lots.mjs`, les verrous de l'essai ouverts (le clic). Les tables
  de contenu se comparent une à une (hors notes de version) ; les numéros donnés par le service diffèrent de ceux de la migration (le plus haut numéro d'aujourd'hui est plus haut) : comparés **modulo ces numéros**.
- **Le partage.** (a) passe aujourd'hui par un lot ; (b) est refusé : table que le service d'édition ne sait pas écrire (`hors_edition`, le lot reste éteint jusqu'au lot 8) ; (c) est refusé par le service **même
  une fois les tables ouvertes** (ses règles : une page protégée, un mot-clé qui y mène…). La partie (b) ne s'applique que par l'option de test `ouvertHorsEdition` de `controlerLeLot` (jamais une route : le lot
  entier est refusé au dépôt, `400`) ; ce que le service refuse alors est écarté du lot, listé, et expliqué dans la comparaison.
- **Résultat.** Même base, table par table, modulo les numéros donnés et la ligne (c). 0122 : 10 opérations, (a) 6 (5 pages, 1 mot-clé ; la suppression de la page, comptée avec les pages, est en réalité refusée par le service dans la partie (a) seule, faute des opérations (b) : elle est alors citée par une ligne de « Constante de règle » et ouvre un onglet) ; (b) 3, `regle_constante`, `regles_onglet`, `mot_cle_ancienne_cle` ; (c) 1 : la
  page `guide/la-montee-de-niveau` est protégée par le service (elle porte le bloc « niveaux » tiré de la base), donc elle et ce que le service emporte avec elle (5 `page_source`, 1 `source`, 1 entrée de menu) restent ;
  verrous R218, R219. 0123 : 21 opérations, (a) 12 (les neuf mots-clés créés par le service, `mot_cle` modifié, 2 pages), (b) 9 `mot_cle_categorie` ; refaite en entier ; verrou R218. 0124 : 7 opérations, (a) 5 (la suppression de `guide/fiche-accessoires-et-ceinture` y est aussi refusée sans les (b) : citée par une « Constante de règle »), (b) 2
  (`regle_constante`, `mot_cle_ancienne_cle`) ; refaite en entier avec les (b) ; verrous R218, R219. La liste (b) est épinglée par table par le test : quand le lot 8 ouvre une table, sa ligne en sort.
- **Annuler** (garde-fou 11), chaque lot sur une copie de la base juste après lui, dans l'ordre inverse : la 0122 s'annule et la base d'avant revient (toutes les tables égales) ; la 0123 est refusée par le service (le
  corps de « Alignement » perdrait ses ancres figées `{#…}` : elles ne se retirent pas) et la 0124 aussi (l'ancienne adresse `/regles/fiche-inventaire-sac-a-dos/` n'est plus celle d'aucune page : R272). Le lot
  reste appliqué ; le service ne remet pas ce qu'il ne saurait pas écrire aujourd'hui.
- **Ajouté pour l'épreuve** : une clé composée reprend le numéro qu'une insertion précédente a donné (`mot_cle_categorie` d'un mot-clé du même lot ; `controlerLeLot`, `donnerLesNumeros`) ; l'insertion d'un mot-clé
  passe par la création du service (ci-dessus). Rien ne change pour l'édition ordinaire.

Tests : `serveur-edition-lots` (dépôt avec la clé sans écriture dans le contenu, copie, application en bloc, changée entre-temps, refus avec rang, contrôles du contenu, verrou refusé
puis ouvert, numéros, table hors édition, édition ordinaire inchangée), `serveur-edition-lots-annulation` (remise, valeur gardée, insertion et suppression, aperçu sur copie, numéros jamais
rendus, nature du journal d'annulation, rien à remettre, verrous, classes d'accès, tout recalculer), `lot-de-changements-annulation` (effet net et jugement, module pur),
`serveur-edition-numeros` (`idSuivant`, `donnerUnNumero`), `lot-de-changements-numeros`, `serveur-acces-routes`, `serveur-edition-lots-mot-cle` (un mot-clé créé par un lot), `epreuve-lots-0122-0124` (l'épreuve).

## Extrait du contenu et attestation de la production

Lot 5 du chantier « la base du site de dev devient la source de vérité » (`docs/chantier-base-de-dev.md`, R274, R275 (3)) : les sessions de Claude lisent le
vrai contenu du site de dev, sans fiche ni compte ; la production dit d'elle-même, sans nom ni fiche, où elle en est.

**Le classement des tables** (`src/lib/tables-de-la-base.mjs#classeDeLaTable`, garde-fou 9). Toute table de la base est de l'une de trois classes ; une table
que le classement ne connaît pas rend `null`, et le test `tables-de-la-base` échoue : une migration qui ajoute une table l'ajoute à la liste de sa classe.
- **contenu** : les règles (sections 0 à 10 de `data/schema.sql` : `TABLES_DE_REGLES`), les notes de version et l'historique des modifications (section 15) ;
- **propre au site** : les fiches, comptes et groupes (section 13), le journal de l'édition et le brouillon de la note (section 14) — vides dans tout fichier qui sort ;
- **calculée** : les tables dérivées (`lien`, `lien_candidat`), la recherche plein texte (`page_fts`, `entite_fts`, avec leurs tables d'ombre) et les tables internes de SQLite.

**Les empreintes** (`serveur/empreintes.mjs#empreintesDuContenu`) : le SHA-256 de chaque table de contenu, puis une empreinte globale (noms et empreintes des
tables). Elles ne dépendent ni de l'ordre des lignes (lues triées par clé primaire, puis par toutes les colonnes, en comparaison binaire) ni de l'ordre des
colonnes (prises par nom, avec leur type, `NOT NULL` et rang dans la clé) ni des octets du fichier : deux bases au même contenu ont les mêmes empreintes.
Chaque valeur porte son type (NULL, entier, réel, texte, binaire). Une table propre au site, calculée ou inconnue n'y entre jamais.

**L'extrait** (`serveur/extrait.mjs`, site de dev seulement). Un fichier SQLite **neuf** (jamais la base vivante copiée puis vidée : aucune page libre héritée) :
le schéma de la base vivante ; les tables de contenu recopiées depuis elle, donc avec les modifications du site ; les tables propres au site **vides** (le service
refuse le fichier si l'une contient une ligne ; une table inconnue du classement n'est jamais recopiée) ; les tables calculées recopiées **telles que la base vivante
les porte** (le service ne les recalcule pas : après une édition, `lien` et la recherche plein texte peuvent retarder sur le contenu, jamais l'inverse) ; les
modifications en attente du journal versées dans `historique_modification` **sans leur auteur**, version `NULL` (garde-fou 10 ; la règle de `db:appliquer-edition` :
`serveur/historique.mjs#historiser`, un lot en conflit n'est pas versé) ; une vue `extrait_meta` (format, date UTC de fabrication, version du site, schéma,
empreinte globale). Les fiches, comptes, groupes et le journal n'y sont pas : un test cherche leurs noms sentinelles dans chaque octet.

Il est **refait une fois par changement**, pas à chaque téléchargement : rangé dans `db/extrait/` (`extrait.db` et `extrait.json`, le méta qui fait foi : date,
version du site, schéma, empreinte globale et de chaque table, lignes des tables calculées, taille et SHA-256 du fichier), réutilisé tant que la **clé de
changement** (`extrait.mjs#cleDeChangement`) ne bouge pas. Elle bouge avec la base vivante refaite (`vivante.json` : empreinte logique des règles, schéma, `refaite_le`) et avec le
journal de l'édition — un lot de plus, une modification qui change d'état (en attente, intégrée, en conflit), un lot résolu, abandonné — parce que tout écrit de
contenu passe par lui (`enregistrer`, résolution d'un conflit) ; jamais avec une fiche, un compte ou un groupe. Quelques requêtes sur le journal, jamais le contenu.
Le premier téléchargement qui suit un changement fabrique l'extrait **dans un fil à part** (`Worker` du même module : le service reste libre), une seule fabrication à
la fois (les demandes simultanées l'attendent), écriture atomique (`rename`, le méta en dernier).

| Requête | Réponse |
| --- | --- |
| `GET /api/edition/extrait/` | Le fichier SQLite (`application/vnd.sqlite3`, en pièce jointe) ; `ETag` = son SHA-256, `X-Extrait-Fabrique-Le` ; `304` sur `If-None-Match` ; `403` hors du site de dev ; `503` sans base |
| `GET /api/edition/extrait/meta/` | Le méta (`extrait.json`) : `format`, `fabrique_le`, `version_du_site`, `schema`, `empreinte`, `tables` (`{ empreinte, lignes }` par table), `calculees`, `modifications_versees`, `fichier` (`octets`, `sha256`), `duree_ms`… |

**La commande** : `cd client && npm run db:extrait` (`scripts/db-extrait.mjs`) télécharge l'extrait depuis `https://dev.maverick-jdr.com` (`--url` ou `MAVERICK_EXTRAIT_URL`),
dans `var/extrait/` (ignoré par git ; `--dossier`) : `maverick-dev.db` et `maverick-dev.json`. Une clé de lecture facultative (la variable `MAVERICK_EXTRAIT_CLE` seulement : une option `--cle` est refusée, la clé ne va jamais dans la ligne de commande ; sans mot de passe posé sur le site de dev, elle est inutile) part dans l'en-tête `X-Maverick-Cle` (« Accès au site de dev » : `Authorization` n'arrive jamais au service). Elle vérifie le SHA-256 du fichier, puis l'empreinte de **chaque** table
contre le méta (`ecartsAvecLeMeta`), pose le fichier par `rename` (rien n'est écrit si l'un ne concorde pas), ne retélécharge pas un extrait déjà à jour, et affiche **la date de
l'extrait** : chaque analyse la cite. Les sessions de Claude lisent ce fichier en lecture seule (`node:sqlite`, comme `interroger-la-base`), jamais les fiches ni les comptes.

**L'attestation de la production** (`serveur/attestation.mjs`). Au démarrage du service, après la préparation de la base vivante, après chaque reconstruction (aussi
quand elle échoue), et toutes les heures (`INTERVALLE_DE_L_ATTESTATION_MS`, option `attestation.intervalle` de `demarrerService` ; la dernière préparation redite telle quelle :
une fiche enregistrée depuis le démarrage compte avant qu'un paquet ne soit jugé), la production écrit par `rename` `<dossier des métriques>/attestation-prod.json` — le dossier que les deux instances se partagent sur le VPS
(`MAVERICK_DOSSIER_METRIQUES`, déjà monté dans les deux : aucun réglage de `deploy/`). Le site de dev n'en écrit pas (option `attestation` de `demarrerService` : `publier`
par défaut sans l'édition ; `false` : ni écriture ni lecture). Elle contient : `version` (`service`, `code`), `schema`, `base_vivante` (`empreinte` globale et `tables`
par table, du contenu de la base vivante), `regles_publiees` (`empreinte` globale du contenu de `site/donnees/maverick.db`), `preparation` (`appliquee`, **le nombre** de
`problemes`, jamais leur texte, `refaite_le`, `regles`), `citations` (pour chaque élément de règle cité par une fiche — clé étrangère d'une table de fiche vers une table
de contenu — `{ table, id, fiches }` : le nombre de fiches **distinctes** qui le citent, une clé composée donnant un id « a+b ») et `duree_ms`. Ni nom ni identifiant de fiche, de
compte ou de groupe. Un échec d'écriture est noté au journal du service (`ERREUR attestation`) et n'empêche rien : le service démarre, les fiches ne sont que lues.

**Côté site de dev** : `GET /api/mise-a-jour/` porte `etat_production` (`attestation.mjs#etatDeLaProduction`), la comparaison de l'attestation au contenu que la production
publie (`/production`, `MAVERICK_PRODUCTION` : son `_serveur/version.json` et l'empreinte de son `donnees/maverick.db`, gardée par signature du fichier : rien ne se recalcule à
chaque requête) :

```json
{ "etat": "a_jour" | "pas_appliquee" | "inconnue", "raison": null | "version" | "contenu" | "preparation" | "en_cours" | "absente" | "illisible" | "production_illisible" | "non_configuree",
  "message": "…", "version_publiee": "0.4.79", "version_attestee": "0.4.78", "attestee_le": "2026-11-14T10:00:00Z", "problemes": 0, "tables_differentes": [] }
```

`pas_appliquee` : la production n'a pas appliqué sa dernière mise à jour (`version` : elle tourne sur une autre version que celle qu'elle publie ; `contenu` : sa base vivante
n'a pas le contenu publié, `tables_differentes` les nomme ; `preparation` : la préparation de sa base a échoué). `inconnue` : sans alerte — `en_cours` (la version ou le contenu diffère, mais le fichier publié a changé il y a moins de `TOLERANCE_DE_LA_MISE_A_JOUR_MS` = 10 minutes et est plus neuf que l'attestation : la production applique sa mise à jour), ou l'attestation est absente (la production ne
l'écrit qu'après sa prochaine livraison) ou illisible, ou la production n'est pas lisible depuis ce site.

## Fabriquer le site depuis un fichier de contenu

Lot 9 du chantier « la base du site de dev devient la source de vérité » (`docs/chantier-base-de-dev.md`, PR 1 sur 4) : le site se fabrique depuis un fichier de contenu,
sans `data/rows`. Ce sont les briques de l'atelier du site de dev (PR 3) ; **le build par défaut ne change pas** : sans variable, `npm run build` reconstruit la base depuis `data/rows`
et produit le même site qu'avant.

- **`MAVERICK_CONTENU=<fichier SQLite>`** (`src/lib/contenu-fourni.mjs`) : un extrait du contenu (« Extrait du contenu et attestation de la production », ci-dessus). Posée, tout ce qui
  lit la base au build en lit **une copie** (`lib/donnees.mjs#ouvrirBase`, passée par `db-derive.mjs`, avec `--sans-exemples` si `HIDE_EXAMPLES=1` ; `scripts/db-export-pages.mjs`) ; le fichier
  fourni n'est jamais modifié, `trouverRacine` n'exige plus `data/rows`. La base de référence de la production (`scripts/db-reference.mjs`) se lit toujours dans git (les `data/rows` de master
  dans l'historique) : construite comme sans la variable quand git et master sont là (la CI), absente sans eux (le kit), ce que le build dit par une information. Un fichier
  introuvable est une erreur, jamais un repli sur `data/rows`.
- **La copie est préparée** (lot 10, R278 ; `lib/contenu-fourni.mjs#preparerLaCopie`, appelée par `ouvrirBase` et `db-export-pages`, sauf pour un fichier déjà dérivé) : la vue `extrait_meta`
  d'un extrait en est retirée (elle n'est pas du schéma : les lecteurs qui listent les vues ou refont un extrait la refusaient) ; un contenu de structure (`user_version`) **plus ancienne**
  que `data/schema.sql` reçoit les migrations manquantes de `data/migrations/` (`scripts/db-preparer-contenu.mjs`, lancé dans son propre processus, par le code du service :
  `serveur/structure-sur-place.mjs#appliquerSurPlace`, un seul bloc, clés étrangères contrôlées, schéma obtenu comparé à `data/schema.sql`) : c'est le cas d'une PR qui ajoute une migration
  et lit l'extrait du site de dev, qui ne l'a pas encore reçue ; **plus récente** : erreur « Rebasez la branche sur dev » (le site de dev a reçu une migration que la branche n'a pas).
  Le fichier fourni garde sa vue et sa structure. À la main : `node scripts/db-preparer-contenu.mjs <copie.db> [--racine <dépôt>] [--sans-exemples]` (jamais sur le fichier fourni : il l'écrit).
- **Pages d'exemple** (lot 10) : le site de dev n'a pas les pages `statut = 'example'` (des fixtures, pas du lore), que des tests attendent. Une copie qui n'en a **aucune**, migrations faites,
  reçoit celles du dépôt, `data/pages-d-exemple.sql` (`scripts/db-preparer-contenu.mjs#injecterLesPagesDExemple` : un seul bloc, clés étrangères contrôlées ; un échec ou un fichier absent
  est une erreur, jamais un contenu sans exemples en silence), dans le processus de la préparation ; db-derive les traite ensuite comme les autres. Un contenu qui en a déjà n'est pas touché.
  Pas d'ajout pour la variante qui les retire (`HIDE_EXAMPLES=1` : `ouvrirBase({ sansExemples })`, `db-export-pages`) : le kit de l'atelier, toujours dans cette variante, n'emporte pas ce fichier.
  Le fichier est exactement ce que `db-derive --sans-exemples` retire d'une base reconstruite depuis `data/rows` (les pages, leurs enfants, les sources qu'elles seules citaient), écrit comme
  l'exporteur : `node scripts/db-pages-d-exemple.mjs [--verifier]` ; `test/pages-d-exemple.test.mjs` le compare à `data/rows` tant qu'il existe. Le cas « déjà dérivé » (`MAVERICK_CONTENU_DERIVE`) ne change pas.
- **`npm run db:check` suit la variable** (lot 12 ; `scripts/db-check.mjs#choisirLaBase`, `test/db-check-contenu.test.mjs`) : sans base en argument et avec `MAVERICK_CONTENU`, il contrôle la **copie préparée**
  du contenu fourni, par la voie du build (`ouvrirBase` : préparée comme ci-dessus, puis `db-derive`), jamais le fichier fourni ; sans variable, `var/maverick.db` comme avant ; une base donnée en argument l'emporte
  sur la variable. Le JSON dit la base contrôlée (clé `base` : `origine` = `argument`, `contenu` ou `defaut`, et `chemin`). La CI ne pose pas la variable aux étapes qui lancent `db:check` (le job de simulation
  de mise à jour et le job preparer de `mise-a-jour.yml` contrôlent `data/rows` qu'ils viennent d'écrire) : rien n'y change, dans ses deux modes.
- **Proposer un réimport : `scripts/lot-de-source.mjs`** (lot 12 ; `test/lot-de-source.test.mjs`). L'outil générique des importeurs, de `db:sync-pages` et de `scripts/autolink.mjs --lot` : depuis une base réimportée (« après ») et
  l'extrait du jour du site de dev (« avant », `npm run db:extrait`), il écrit un lot de changements « maverick-lot/1 » **de nature `source`**, de ce qui diffère (tables de contenu :
  `serveur/epreuve-des-lots.mjs#differences`, `#lotDeLaDifference`), contrôlé comme au dépôt (`lib/lot-de-changements.mjs#controlerLaNature`, `#controlerLeLot`, toutes les tables ouvertes). Il **n'envoie rien** (aucune option d'envoi) :
  le lot se propose au site de dev par un humain (`POST /api/edition/lots/`, skill `modifier-une-page-wiki`). Ligne de commande :
  `node scripts/lot-de-source.mjs --apres <base.db> --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--auteur <nom>]` (`--avant` : `var/extrait/maverick-dev.db`) ; code 0 (lot écrit, ou aucune différence : rien n'est écrit),
  1 (lot refusé, bases incomparables), 2 (usage). API : `lotDeSource(avant, apres, { titre, auteur? })` sur deux bases ouvertes, `ecrireLeLotDeSource({ avant, apres, titre, auteur?, sortie })` sur deux fichiers,
  `lotDeSourceParModification(avant, modifier, { titre, auteur? })` quand l'outil retouche lui-même une copie (`autolink`) ; chacune rend `{ lot, bilan }` (`lot` : null sans différence ; `bilan` : opérations par table).
  Les deux bases doivent être comparables : même structure (`user_version`), mêmes pages d'exemple (le site de dev n'en a pas : bâtir l'« après » sans elles, `db-derive --sans-exemples`), l'« avant » de la ligne de commande étant une copie de l'extrait
  préparée comme celle du build (`db-preparer-contenu.mjs` : migrations du dépôt manquantes, sans exemples) ; une table sans clé primaire qui diffère est refusée. Comme `scripts/baliser-mot-cle.mjs` (qui s'en sert : `lotDesChangements`), le lot ne porte pas les colonnes dérivées
  (`serveur/edition.mjs#colonneDerivee`, refaites par le service) et range les mots-clés créés d'abord.
- **Pages modifiées ou réimportées : `npm run db:sync-pages`** (`scripts/db-sync-pages.mjs`, lot 12 ; `test/db-pages-du-site.test.mjs`). Il n'écrit plus `data/rows` :
  `npm run db:sync-pages -- --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--wiki <dossier>] [--auteur <nom>]` copie l'extrait (préparé, sans exemples), y reporte les `.md` par
  `tools/db/pages_md.py sync --base <copie>` (mêmes refus qu'avant : page ajoutée ou retirée hors des familles `docs` et `exemple`, provenance changée), puis écrit le lot `source` par
  `lot-de-source.mjs#ecrireLeLotDeSource`. Les `.md` de départ viennent du même extrait (`MAVERICK_CONTENU=<extrait> npm run db:export-pages`), sinon le lot défait ce que le site a changé.
  `pages_md.py sync` sans `--base` ni copie de lignes (`--rows <copie>`, pour les tests) est refusé, et `tools/db/exporter.py` refuse `data/rows` (`--rows <dossier>` exigé) : le workflow
  (`mise-a-jour-regles.mjs`, `mise-a-jour-paquet.mjs`, `mise-a-jour-github.mjs`) exporte dans un dossier de travail puis recopie lui-même ; `db:migrate` passe par `migrer.py`.
- **Essai mécanique des tests** (`scripts/essai-mecanique-tests.mjs`, usage en tête ; variantes : `scripts/essai-variantes.mjs` ; résultat du premier essai : `docs/essai-mecanique-des-tests.md`) :
  chaque fichier de test lancé seul sur un contenu donné. Passes A et B (contenu reconstruit depuis `data/rows`, puis rendu factice), **C** (l'extrait du site de dev, `npm run db:extrait`,
  sans le dépôt) et **V1 à V5** (variantes de l'extrait, chacune une modification que le site de dev permet, notée dans `historique_modification` comme une saisie : V1 icônes sur
  des mots-clés de genres variés ; V2 un sort renommé **par le service** (`serveur/edition.mjs#enregistrer`, puis `historiser` et le journal vidé, comme l'extrait) ; V3 des lignes créées
  par le service (opération `creer` ; un refus est noté, jamais forcé) et les magies innées d'une race changées (`magies_innees`) ; V4 des lignes retirées sans dépendant ; **V5** une
  magie renommée en écriture directe, hors des voies du site aujourd'hui (`test/serveur-edition-nom-de-magie.test.mjs`) : **informative**, rangée à part, elle ne bloque rien). C et V tournent dans une **copie jetable** de l'arbre (`git worktree` détaché sous `<sortie>/copies/<passe>`, modifications
  en cours recopiées, `data/rows/*.sql` retiré, `node_modules` par lien, `content/wiki` fabriqué depuis le contenu de la passe) ; rien n'y est commité, `--nettoyer` les retire. Un échec sur C :
  le test lit encore le dépôt (ou casse sur le vrai contenu du site) ; sur Vn seulement : il fige une valeur modifiable. Le tri de C range à part les fichiers qui lisent le dépôt par nature
  (`LIT_LE_DEPOT_PAR_NATURE`). `--passe <P> --controles` lance dans la copie, sous le contenu de la passe, les contrôles du job preparer (`scripts/mise-a-jour-github.mjs#CONTROLES`) :
  chaque test du site construit à part (sauté ou vide : rouge), `npm test` laissé à la passe, `db:build` et `db:check` à part (`CONTROLES_PAR_NATURE`, jamais rouges). Tri par passe : `<sortie>/tri.md` et `tri.json`. Toute la sortie reste sous `var/`.
- **`npm run build:depuis-contenu -- --contenu <fichier> [--sortie <dossier>] [--mesure <fichier.json>]`** (`scripts/fabriquer-depuis-contenu.mjs`, logique : `serveur/fabrication-depuis-contenu.mjs`) :
  1. *controle* : le fichier est copié dans un dossier de travail, puis contrôlé (`serveur/fichier-de-contenu.mjs`, avec le classement de `lib/tables-de-la-base.mjs` et les empreintes de
     `serveur/empreintes.mjs`) : SQLite lisible, structure (`user_version`) du `data/schema.sql` livré, toutes les tables du contenu présentes, aucune ligne dans une table propre au site
     (fiches, comptes, groupes, journal : l'extrait en garde les tables, vides) ni dans une table inconnue, empreinte annoncée (`extrait_meta`) égale à celle des tables. Le message nomme la table,
     jamais une valeur ;
  2. *pages* : `db-export-pages` écrit les pages du wiki depuis la copie, **dans le vrai `client/src/content/wiki/`** (fabriqué et ignoré par git, comme au `prebuild`) : après une
     fabrication depuis un extrait, `db:pages-check` peut être rouge à tort en local jusqu'au prochain `npm run build` ou `db:export-pages` ;
  3. *derive* (« en deux temps », le mode par défaut) : `db-derive` dérive une autre copie dans **son propre processus** (`--sans-exemples` si `HIDE_EXAMPLES=1`) ;
  4. *build* : `astro build` vers `--sortie` (défaut `client/dist`), `MAVERICK_CONTENU` pointant sur la copie dérivée et la variable interne `MAVERICK_CONTENU_DERIVE`
     (`complete` ou `sans-exemples`) disant à `ouvrirBase` de la copier telle quelle, pour cette variante seulement (une autre est une erreur). `--en-un-temps` garde l'ancien chemin
     (`ouvrirBase` dérive dans le processus d'Astro, sans étape *derive*) ; le JSON de mesure porte `mode` (`deux-temps` ou `en-un-temps`). Les deux sites produits sont identiques (`comparer-sites`).
     Astro vide son dossier de sortie : le script refuse un dossier qui contient le code, ou qui n'est ni vide ni un site déjà fabriqué, même interrompu (il porte `_astro` et une page : `index.html`,
     `404.html` ou `_serveur`) ; une seule trace au milieu de fichiers étrangers ne suffit pas.
  `--mesure` écrit un JSON `maverick-fabrication/1` : durée de chaque étape et totale, mémoire (pic de chaque processus Node et leur cumul, au total et par étape : `scripts/mesure-memoire.mjs`,
  chargé par `NODE_OPTIONS` dans les processus des étapes 2 à 4, `process.resourceUsage().maxRSS`), taille et nombre de fichiers du dossier produit, version, schéma et empreinte du contenu. Un échec
  sort en code 1, nomme l'étape et écrit quand même la mesure (`statut: "echec"`). Une limite de la mesure : sous Linux, le `maxRSS` d'un processus lancé par un gros processus
  reprend la taille de son parent au moment du `fork` (un enfant vide d'un parent de 1,2 Go rapporte 1,17 Go) ; `db-derive` lancé par Astro paraissait donc peser ~570 Mo, contre ~90 Mo seul.
  En deux temps, chaque processus naît du petit script de fabrication : les chiffres sont fidèles, et le pic réel est celui d'Astro (~1,4 Go sur l'extrait d'essai de 31 Mo).
- **`npm run comparer-sites -- <dossier-a> <dossier-b> [--json <fichier>] [--exemples <n>]`** (`scripts/comparer-sites.mjs`, logique : `serveur/comparaison-de-sites.mjs`) : empreinte sha256 de
  chaque fichier ; identiques, différents, seulement dans A, seulement dans B, listes plafonnées (20 exemples par défaut), nombres exacts. Code 0 si les sites sont équivalents. À part, `variables` :
  ce que la fabrication fait varier d'elle-même sans que le contenu change. Mesuré en fabriquant deux fois le même extrait : les deux sites sont identiques octet pour octet (les noms d'assets
  suivent leur contenu, aucune date n'entre dans une page). Entre un site fabriqué depuis un extrait et celui que GitHub livre depuis `data/rows`, ne varient que la base publiée
  `donnees/maverick.db` (mêmes lignes de contenu et mêmes tables calculées, autre forme de fichier : la vue `extrait_meta`, la disposition des pages) et `donnees/reference.db` / `.json` (lue dans git).
  Une règle de plus n'entre qu'après une mesure ; aucune ne cache un fichier dont le contenu diffère.
- **Ce que le kit doit porter** : `client/` et ses `node_modules`, `data/schema.sql`, `data/derive.sql`, `data/migrations/` (le schéma, et les registres `.json` que lisent `lib/archives.mjs`,
  `lib/noms-d-avant-des-migrations.mjs`), `sources/sources.json`, `sources/copies-drive.json` (le registre des copies du Drive, lu par `lib/archives.mjs`) et `sources/tipeee/bienvenue.json` (la page Archives et l'accueil les lisent). Ni `data/rows`, ni git. Chaque installateur de **test** l'emporte (`deploy/installateur/kit.mjs`, `fabriquer.mjs --kit`, posé par l'installateur dans `<instance>/atelier/kit/` hors de `site/` ; `deploy/installateur/README.md`, « Le kit de l'atelier ») : sans contenu (contrôle de `kit.mjs`), modules natifs de la libc de l'image `kit.json#image` seulement, et l'installation continue sans kit si la place manque. Le `node_modules` du kit ne doit contenir aucun lien vers un autre dossier : un lien vers le `node_modules` d'un autre arbre fait lire ses modules par leur chemin réel, les duplique, et change la disposition des assets du site fabriqué.
- **Tout fichier que lit le build doit être dans `A_EMPORTER`** (`deploy/installateur/kit.mjs`), et ses `INDISPENSABLES` : la CI a tout le dépôt et ne voit pas un fichier oublié, la fabrication sur le serveur casse (« ENOENT … /travail/kit/… »). Le test `kit-suffit-au-build.test.mjs` fait le kit par `fabriquerLeKit`, le décompresse hors du dépôt et y lance `scripts/fabriquer-depuis-contenu.mjs` comme `atelier/conteneur.sh` (environ une minute) : il échoue en nommant le fichier absent ; un second build, dans un kit privé de ce qui sortira du dépôt au lot 12 (`listerCeQuiSort`, sans les migrations mixtes), ne doit changer le site que par les migrations livrées au service.

## Atelier du site de dev

Lot 9 du chantier « la base du site de dev devient la source de vérité » (`docs/chantier-base-de-dev.md`, PR 3 sur 4) : après chaque installation du site de dev, un **atelier** fabrique un site témoin
depuis l'extrait du contenu de la base de dev, dans un conteneur Docker sans réseau, le compare au `site/` que GitHub a livré, et mesure (durée, mémoire, écarts). **Rien de ce qui est servi ne change** (sauf avec l'interrupteur `atelier/servir`, éteint par défaut : « Bascule 2 : préparation », PR 3b). Il n'existe
que sur l'instance de test, et seulement après le geste du propriétaire (`deploy/vps/README.md`, « Atelier du site de dev ») : avant, l'installateur pose le kit et la marque, rien ne les consomme, et le service rapporte
« atelier non installé » (le service ne voit rien de l'atelier avant le geste : le montage des rapports n'existe pas encore). Dossier des rapports monté mais sans kit, ou production : « pas d'atelier ». **La production ne change pas** : le `docker-compose.yml` livré, commun aux deux instances, ne dit rien de l'atelier.

**Qui fait quoi (garde-fou 20 du plan : aucun programme root n'obéit à une demande venue du site de dev).**
- *Le service* (`serveur/atelier.mjs`, jamais root) fabrique et tient à jour l'extrait du contenu de l'atelier dans le **dépôt de l'atelier**, `<instance>/atelier/depot/` (`/atelier-depot` dans le service) : `contenu-<version>.db`
  et `contenu.json` (`serveur/extrait.mjs#fabriquerExtrait` : sans fiche, sans compte, sans journal). Le dépôt est créé par root au geste du propriétaire, hors de `db/`, et monté en lecture-écriture par le `docker-compose.override.yml` que le geste écrit : le
  service ne peut ni le renommer ni le remplacer (point de montage), donc **la source que root monte ensuite dans le conteneur est un chemin fixé par root, jamais un chemin que le service peut changer en lien**. L'extrait est refait tout de suite après une nouvelle
  version et, pour un contenu qui change (les saisies du site), après un délai de 10 minutes. Avant le geste, le service ne voit pas `/atelier-depot` : il ne fabrique rien et rapporte « atelier non installé » ; un ancien extrait sous `db/essai-de-structure/atelier/` est
  effacé au premier passage. Il **lit** les rapports de root, montés en lecture seule par la même surcharge (`MAVERICK_ATELIER=/atelier`, `./atelier/rapports:/atelier:ro` ; première ligne `# maverick-atelier : …` : lui seul le reconnaît, le retire avec `--retirer` et respecte
  un fichier du même nom qu'il n'a pas écrit ; l'installateur ne le pose, ne le livre et ne l'efface jamais), un fichier à la fois, borné en taille, validé champ par champ (une liste blanche), jamais un lien suivi. De `<instance>/atelier/`, le service ne voit
  que `depot` et `rapports` (un test le vérifie) : ni le kit, ni le travail, ni la sortie, ni `outils/`, ni la marque ; `site/`, qu'il voit en lecture seule, est aussi monté en lecture seule dans le conteneur.
- *Root* (`deploy/installateur/atelier/`) : `lancer.sh` (systemd), `installer.sh` (le geste), `lib.sh`. Le déclencheur est la **marque** `atelier/declencheur/marque`, posée par l'installateur de test (root, livraison GitHub) dans un
  dossier que le service ne voit pas ; le service ne peut rien déclencher. Root n'écrit jamais dans `db/`, `metriques/` ni `maintenance/`, et **n'ouvre jamais un fichier d'un dossier que le service ou le conteneur peut toucher** : le service est root de conteneur avec `CAP_MKNOD`, il peut poser dans le dépôt une FIFO (root resterait bloqué), un nœud de
  périphérique (root lirait l'hôte) ou un lien. Sur l'extrait, root ne fait donc que des `stat` : fichier régulier, ni lien, ni FIFO, ni périphérique, taille plausible (refus sans attente). **C'est le conteneur, sans privilège, qui l'ouvre** (`outils/conteneur.sh`, monté en lecture seule) :
  le dépôt y est monté en lecture seule sur `/contenu` ; un nœud de périphérique y est interdit par Docker, une FIFO ou un fichier irrégulier est refusé (code 73), la taille est plafonnée (74), la copie vers `/travail` se fait sous `timeout` (75). Le démon Docker ne monte jamais
  un dossier que le service peut désigner : la source est `<instance>/atelier/depot`, fixée par root. Ce que le conteneur a écrit (`fabrication.json`, `comparaison.json`) n'est copié par root qu'**après la suppression du conteneur** (plus rien ne peut changer le type du
  fichier), seulement s'il est régulier (ni FIFO, ni périphérique, ni lien), sous `timeout`, avec un plafond de 256 Ko ; c'est le service qui les lit. Le nom de l'extrait porte la version de la marque : root l'attend par ce nom (au plus 5 minutes), sans lire son contenu.
- *Le conteneur* : image de `kit.json#image` (expression stricte, `docker pull` seulement si elle manque), `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--user 65534:65534`, `--pids-limit 1024`,
  `--cpus` (1), `--cpu-shares 128`, `--memory` = `--memory-swap` (aucun échange), `--oom-score-adj 500` (le premier à partir), `--cgroup-parent maverick-atelier.slice` (la tranche systemd posée par le geste : `CPUWeight=20`, `IOWeight=20`, la production passe devant). Le kit, le `site/` livré, le dépôt de l'extrait et `conteneur.sh` sont montés en lecture seule ; le travail (copie du kit : le build écrit
  `src/content/wiki`, `.astro`, `node_modules/.vite`), la sortie et les résultats sont dans `atelier/`, donnés à 65534, jamais dans `site/`. Il lance `build:depuis-contenu` puis `comparer-sites` (variables `HIDE_EXAMPLES=1`, `SITE_MODE=test`,
  `SITE_TAG` comme la CI ; `SITE_GOOGLE_CLIENT_ID` à régler, sinon le bouton « Exporter » est la seule différence). Le script de root tourne sous `nice` 19 et `ionice` idle (unité systemd).
  Le site est fabriqué dans `travail/site`, sur le montage du kit (Astro déplace ses fichiers de `.astro/.prerender` vers sa sortie par `rename`, impossible d'un montage à l'autre : `EXDEV`), comparé là, puis copié vers `sortie/site` (code 76 si la copie échoue). **Message d'une erreur de fabrication** : l'étape, le code, le sous-pas de `build` quand la sortie d'Astro le dit (« pendant la génération des pages », ou « après le build (intégrations, astro:build:done) » quand un « [build] ✓ Completed » suit la dernière ligne de page ; sinon rien), puis la **fin de stderr** (2000 caractères, en premier : c'est là qu'est l'erreur) et la **fin de stdout** (1000), étiquetées (`fabrication-depuis-contenu.mjs#messageDEchec`) ; le rapport en garde 3200 caractères (`atelier.mjs#messageDErreur`), ou son début et la dernière ligne d'erreur quand la cause tombe plus loin. **Le conteneur n'a que ce que l'image `node:*-bookworm-slim` porte** : pas de `git` (cause de l'échec du rapport 20261118-225551, kit 0.5.20 : `db-reference.mjs` lançait `git`, `spawnSync` rendait un `stdout` indéfini et le crochet `astro:build:done` levait après toutes les pages, build en code 1). `construireReference` ne lève plus : sans `git` (ou `tar`) elle rend `{ chemin: null, raison: 'git absent : …' }`, et le crochet ne fait jamais échouer un build dont le contenu est fourni (`MAVERICK_CONTENU`) ; `donnees/reference.db` est alors absent, ce que la comparaison avec le site livré classe comme attendu. **Journal du conteneur** : `lancer.sh` garde `docker logs` (stdout et stderr, la fin, 200 Ko au plus) avant `docker rm -f`, dans `rapports/<id>/journal-du-conteneur.txt` (root, 644, absent s'il est vide) ; le service ne le sert pas (il ne lit que des fichiers nommés), et rien n'y imprime l'environnement du conteneur : lecture humaine, `sudo tail -c 20000 <instance>/atelier/rapports/<id>/journal-du-conteneur.txt`. **Rejouer un échec en local** : monter le kit et l'extrait comme `lancer.sh` (`/kit`, `/site`, `/contenu` en lecture seule, `/travail`, `/sortie`, `/resultats` en écriture, `/tmp` en lecture seule), lancer `conteneur.sh` en utilisateur 65534 avec un `PATH` réduit à ce que l'image porte (sans `git`).

**Une fabrication à la fois** (`flock`) ; les marques qui arrivent pendant une fabrication se fondent (jusqu'à trois tours, la dernière version compte). **Mémoire** relevée avant chaque fabrication (`/proc/meminfo`) : plafond = min(maximum réglé
2,5 Go, `MemAvailable` / 2) ; refus `memoire_insuffisante` si le plafond est sous le besoin (**1,1 Go** par défaut, 1 153 433 ko), ou `marge_insuffisante` si la marge laissée à la production (`MemAvailable` − plafond) est sous max(1 Go, 25 % de `MemTotal`). **Pourquoi 1,1 Go** : la fabrication complète de l'extrait du jour (31 Mo), mesurée dans un cgroup limité (limite = limite avec le swap), a un pic de 1 370 856 ko d'RSS pour Astro sans limite (43 s) ; limitée à 1100 Mo, elle réussit (33 s, pic 1 011 248 ko : V8 s'adapte à la limite) ; limitée à 800 Mo, elle échoue à l'étape « generating static routes » (processus tué) : 1,1 Go est le plus petit plafond essayé qui réussit. Avec « disponible / 2 », un plafond de 1,1 Go correspond au refus sous **2 × le besoin** de mémoire disponible (2 306 866 ko, soit 2 253 Mo) : la production garde toujours au moins la moitié du disponible, et la marge minimale. Exemple, serveur de 2 processeurs (`MemTotal` 4 004 532 ko, marge minimale 1 048 576 ko) à 2 990 988 ko disponibles : plafond 1 495 494 ko, marge laissée 1 495 494 ko, besoin 1 153 433 ko, la fabrication démarre ; avec l'ancien besoin de 1,5 Go (1 572 864 ko), elle était refusée (`MemAvailable` < 3 145 728 ko). Un refus est une mesure : le rapport porte `MemAvailable`, le besoin, le plafond et la marge, et `installer.sh --etat` les dit en Mo avec le seuil et le geste qui lève le refus (libérer de la mémoire, ou `sudo sh <instance>/atelier/installer.sh --besoin <taille>` ; sous ce que la fabrication demande, le conteneur est tué au plafond, `OOMKilled`, une mesure en échec, la production gardant sa marge. Pour `marge_insuffisante` : libérer de la mémoire (il faut au moins min(maximum + marge minimale, 2 × marge minimale) disponibles), ou baisser `--memoire-max`, proposé seulement s'il reste le besoin sous `MemAvailable` − marge minimale). **Réglage déjà posé** : le geste ne reprend pas un `BESOIN_KO` égal à l'ancien défaut (1 572 864 ko, jamais choisi) : il passe au nouveau défaut et le dit ; un `--besoin` donné au geste l'emporte toujours (une valeur égale à l'ancien défaut est remplacée à chaque geste sans `--besoin`, car elle ne se distingue pas de lui : pour garder environ 1,5 Go, une autre taille, par exemple `--besoin 1.6g`), toute autre valeur posée est reprise. Les nouveaux scripts arrivent avec l'installateur de test (`atelier/outils/`, remplacés à chaque livraison) ; l'ancien `BESOIN_KO` de `reglages.env`, lu par `lancer.sh` à chaque fabrication, ne change qu'au prochain geste. **Disque** : refus sous
2 Go libres, et l'espace libre est relevé **pendant** la fabrication : sous le minimum, le conteneur est arrêté et le rapport le dit (`issue: "echec"`, `motif: "disque_insuffisant"`). Un refus est une mesure (le rapport porte les chiffres relevés), un conteneur arrêté par manque de mémoire (`OOMKilled`) aussi (`issue: "oom"`), un dépassement du délai (1800 s) aussi ; jamais de relance silencieuse. Seule la dernière
sortie est gardée, le travail est effacé.

**Rapports** : `atelier/rapports/<AAAAMMJJ-HHMMSS>/` (ceux du jour UTC sont tous gardés, plus les 100 plus anciens ; root en est propriétaire) : `rapport.json` (`maverick-atelier/1`, écrit par root : date, versions de l'installation et du kit, taille du serveur — `nproc`, `MemTotal`, `MemAvailable`, disque total et
libre, charge —, réglages, plafond et marge, issue et motif, durée, code de sortie, pic de mémoire du conteneur et sa source — `memory.peak` du cgroup v2, à défaut `memory.current` échantillonné, à défaut `docker stats` —, temps processeur, place du
kit, du travail et de la sortie), `fabrication.json` (`maverick-fabrication/1`) et `comparaison.json` (`maverick-comparaison/1`), produits dans le conteneur. À la racine de `rapports/` : `kit.json` (copie, posée par l'installateur), `installe.json` (le geste), `en-cours.json`
(une fabrication tourne). Le service les rend sous `GET /api/debug/atelier/` (`maverick-atelier-etat/1` ; états `pas_d_atelier`, `non_installe`, `en_attente`, `en_cours`, `rapport` ; forme et mise en forme pure : `src/lib/debug-atelier.mjs`),
note chaque rapport nouveau au journal (catégorie `service`) et aux métriques (évènements `atelier_extrait`, `atelier_fabrication`).

**La journée type** (lot 9, PR 4 ; le même geste unique la pose, il n'y a pas de second geste). Deux minuteurs systemd, déclenchés par l'horloge et jamais par le site de dev, lancent la même fabrication sous une autre *origine* (`lancer.sh --origine`) :
`maverick-atelier-nuit.timer` à 04:30 (après la sauvegarde de 03:30 ; origine `nuit`, elle remplace le contrôle de nuit jusqu'au lot 10) et `maverick-atelier-jour.timer` toutes les 20 minutes entre 8 h et 20 h (origine `journee_type`). Ce dernier n'ajoute une fabrication que si
**les trois** conditions sont réunies : la fenêtre de mesure est ouverte (`--jours-de-mesure`, 1 jour par défaut, compté depuis le geste ou sa relance), la journée en compte moins de 10 (toutes origines confondues : la nuit et les livraisons comptent aussi ; le jour compté est le jour UTC, donc une livraison entre minuit et 1 h ou 2 h, heure de Paris, compte pour la veille), la dernière date de plus de 40 minutes ; sinon il ne fait rien, sans rapport. Une marque de livraison
garde l'origine `livraison`. Toutes passent par le même chemin (verrou, refus de mémoire et de disque, plafonds). **Plafond du jour** (`--max-par-jour`, 12 par défaut) : il compte toutes les origines, livraisons comprises, par jour UTC ; au-delà, plus aucune fabrication ce jour-là et un seul
rapport court le dit (`motif: "plafond_du_jour"`, qui n'est pas une fabrication). On garde tous les rapports du jour UTC (jamais effacés : les plafonds du jour les comptent) et les 100 plus anciens, dans le dossier à root.

*La sonde* (pendant chaque fabrication, `lancer.sh`, root) : des requêtes en lecture seule sur `127.0.0.1` aux ports des deux instances (prod : le `.env` du dossier voisin `maverick-center` ou `--dossier-prod` ; site de dev : le `.env` de l'instance), vers deux cibles publiques valables sur les deux : une
page statique (`/`, nginx) et une route de lecture de l'API (`/api/personnages/`, la liste des prétirés, qui ne fait que lire la base) ; `/api/debug/` répond 403 en production. Au plus une requête par seconde et par instance, délai de 5 s ; chaque requête porte le User-Agent `maverick-atelier-sonde/1` (`UA_SONDE`, `serveur/metriques.mjs`) : le service des deux instances (le même code en production) ne la compte dans aucune métrique de requêtes (ni comptes, ni durées, ni mémoire des requêtes, ni navigateurs), et seulement ce User-Agent exact ; un autre est mesuré comme avant. Sans cela, la sonde ajouterait 60 à 200 requêtes à `/api/personnages/` par fabrication ; une référence d'environ 30 s avant la fabrication, la fabrication,
puis environ 30 s après. Trois mauvaises réponses de suite de la production (erreur, code hors 2xx et 3xx, ou plus de 2 s) arrêtent la sonde aussitôt, sans insister. nginx exige le mot de passe interne : root lit `/etc/caddy/maverick.env` (à root, 600 : `MAVERICK_ACCES_NORMAL`, `MAVERICK_ACCES_TEST`) et le passe à
`curl -K -` par l'entrée standard (jamais dans la ligne de commande) ; sans lui, la réponse 401 de nginx seul est comptée bonne et le rapport dit `authentifie: false` (ce qui mesure nginx, pas le service). **Garde-fou 20** : root ne garde que le code HTTP et le temps (`-o /dev/null`, `-w`), jamais un corps de réponse ; le `.env`
d'une instance n'est lu que s'il est un fichier régulier non lien, à root, hors de tout dossier monté en écriture dans un conteneur (`docker ps`, `docker inspect`) — sinon « sonde impossible » pour cette instance (`env_monte`). Le port se lit `MAVERICK_PORT=<port>` ou `MAVERICK_PORT=127.0.0.1:<port>` (la forme des instances du serveur), aucun autre hôte (`port_illisible`) ; quand aucune instance ne peut être sondée, le rapport garde le motif de chacune (`env_absent`, `env_monte`, `port_illisible`, `introuvable`). Le rapport (`sonde`, `maverick-sonde/1`) donne, par instance et par phase (`reference`, `fabrication`, `apres`) : n, médiane, 95e centile,
maximum, erreurs (centiles au rang le plus proche). La durée d'un rapport est celle du conteneur, sans la référence ni l'après.

*Le bilan* (`bilan`, `maverick-atelier-bilan/1`, `src/lib/atelier-bilan.mjs`, calculé à chaque lecture d'après les rapports des 24 dernières heures) : fabrications par origine, refus, échecs, taille du serveur, pic de mémoire maximal, durée médiane et maximale, temps processeur, disque, effet sur la production (95e centile et médiane
pendant les fabrications contre la référence : la référence est la médiane des références, « pendant » est le pire des 95e centiles de chaque fabrication). **Verdict** : `tient` (aucun refus ni échec, et un 95e centile de la production pendant les fabrications sous 2 fois la référence ou sous 1 s) ; `tient_tout_juste` (un refus ou un
échec étranger à la capacité, des mauvaises réponses isolées, un 95e centile au-delà du seuil mais pas grave) ; `ne_tient_pas` (refus de mémoire, de marge ou de disque, arrêt par manque de mémoire ou de disque, délai dépassé, sonde arrêtée parce que la production répondait mal, 95e centile à plus de 5 fois la référence et au-delà de 2 s, plus de 5 % de mauvaises
réponses) ; `journee_incomplete` (moins de 10 fabrications, rien de grave) ; `inconnu` (aucune fabrication, effet sur la production non mesuré, ou plus de la moitié des fabrications en échec pour une autre raison que la capacité). Les seuils (2 fois, 1 s, 10 fabrications, 5 fois, 2 s, 5 %) sont des constantes du module, exposées dans le bilan (`seuils`) : un choix technique, réglable là.
Cette PR livre ce qui fait tourner la journée seule sur le serveur ; le geste du propriétaire n'est pas encore fait, la mesure attend. Il ne compte que les rapports qui **suivent le dernier geste** du propriétaire (`installe.json#installe_le`, relu à chaque lecture) : une fenêtre rouverte après un correctif ne garde pas les échecs d'avant. Le bilan le dit (`depuis`, quand le geste tombe dans les 24 dernières heures ; la phrase et la ligne « Fabrications depuis le geste », « aucune fabrication depuis le geste du … ») ; un rapport d'avant le geste reste dans l'historique. Les fabrications d'origine `contenu` (ci-dessous) ne comptent pas dans le bilan : il mesure la journée type.

**Livraison** : l'installateur de test pose `atelier/installer.sh` et `atelier/outils/{lancer,lib}.sh` (`deploy/installateur/kit-pose.sh`), jamais ailleurs : le kit, le travail, la sortie, les rapports et les réglages ne sont jamais touchés, et seuls
les fichiers d'`outils/` qui ne sont plus livrés sont retirés. Le geste (`installer.sh`) écrit `docker-compose.override.yml` puis relance « docker compose up -d » dans le dossier de l'instance : **le service du site de dev redémarre quelques secondes**, le site reste servi ; `--retirer` supprime le fichier et le relance de même.
Tests : `deploy-atelier` (les scripts, dans un monde factice), `serveur-atelier`, `debug-atelier`.

## API REST `/api/v1/` et page Debug (site de dev)

Demande du propriétaire : un CRUD pour tous les éléments du jeu. Détail complet (adresses, paramètres, formats, ETag, codes, exemples `curl`,
ressources par module, comment rendre une ressource modifiable) : [`api.md`](api.md).

- **Site de dev seulement** : ouverte avec l'édition (`MAVERICK_EDITION=1`) ; ailleurs, **tout** `/api/v1/` répond `403`, lectures comprises
  (décision du propriétaire du 2026-10-15 : en production, la base n'est ouverte que par le front, c'est-à-dire les pages du site).
- **Lectures** : la base vivante, ressource par ressource (`GET /api/v1/` : le catalogue ; `GET /api/v1/openapi.json` : la description OpenAPI
  3.1 de tout le service, routes de cette page comprises). Jamais une table des sections 13 et 14 ni une image entière.
- **Écritures** : une requête = un lot de `serveur/edition.mjs#enregistrer` (page `api/v1/<ressource>`), comme le mode modification : journal,
  rejeu, note en préparation de « Mise à jour », livraison dans `data/rows`, retraits des fiches (R42). Une table que le site de dev écrit par une
  opération du lot (relations entre peuples, magies innées, catégories d'un événement, valeurs propres d'une capacité de monstre, fusion de
  mots-clés) l'est par la même opération (`operations`, `actions` du registre). Ce que le service d'édition ne sait pas écrire (ni `TABLES`, ni
  `ENTITES`, ni une opération du lot) est en lecture seule : `405`, jamais de SQL direct.

**Journal du service** (`serveur/journal-du-service.mjs`) : chaque ligne que le service note part toujours sur la sortie, horodatée (ce que montre
`docker logs`) ; sur le site de dev, aussi dans une mémoire des 2 000 dernières entrées `{ n, instant, niveau, categorie, message }` (niveau
`info`, `avertissement` ou `erreur` ; catégorie `service`, `http`, `base`, `fiches`, `edition`, `mise-a-jour`, `maintenance`, déduits du message
quand l'appelant ne les donne pas ; `n` croît depuis le démarrage, jamais réutilisé), et chaque requête `/api/` y est notée (catégorie `http` :
méthode, adresse avec sa requête, statut, durée ; jamais les corps), sauf les relèves réussies du journal lui-même, de la version de la base
(`/api/debug/base/`, menu « DB » ouvert), des métriques, du système et de l'état de maintenance, et la balise des pages vues (reconnues à leur
chemin, jamais à leur chaîne de requête : `estUneReleve`), qui noieraient le reste. La mémoire repart à vide quand le service redémarre ; chaque
lecture porte l'identité du processus (`processus`, tirée au démarrage) pour que la page voie un redémarrage. En production (sans édition), ni
mémoire ni ligne par requête réussie ou refusée : seuls les événements du service et ses échecs (`5xx`) vont sur la sortie, dont le log Docker
tourne (5 fichiers de 10 Mo par conteneur : « Métriques et volume », plus bas).

| Requête | Réponse |
| --- | --- |
| `GET /api/debug/journal/` | `{ processus, entrees, dernier, capacite, perdues }` : les entrées qui suivent `?depuis=<n>`, filtrées par `?niveau=`, `?categorie=` (une valeur, « a,b » ou répétée), `?q=` (texte, sans accents ni majuscules) et `?limite=` ; `dernier` = le curseur de la relève suivante, `perdues` = les entrées sorties de la mémoire. `403` hors du site de dev, `503` sans journal |
| `GET /api/debug/tables/`, `GET /api/debug/tables/<nom>/` | Les tables et vues de la base vivante (`{ tables: [{ nom, genre, lignes }] }`), puis une page des lignes de l'une d'elles, en lecture seule : toutes, fiches, comptes et groupes de la section 13 compris (décision du propriétaire du 2026-10-15 : « Il faut tout rendre ouvert. Ce qui est fermé c'est que la base du serveur de prod. ») ; images et textes longs résumés ; `ETag`, `304` sur `If-None-Match` : [`api.md`](api.md), « Contenu des tables ». `403` hors du site de dev |
| `GET /api/debug/base/` | `{ version }` : la version de la base vivante, qui change dès qu'une écriture est validée (coût fixe, aucune table lue ; `Cache-Control: no-store`) ; une relève (toutes les 2 s, menu « DB » ouvert) : ni au journal ni dans la mémoire des requêtes. `403` hors du site de dev, `503` sans base |
| `GET /api/debug/structure/` | `{ format, en_cours, en_attente, dernier }` : le dernier essai d'une livraison sur une copie de la base vivante, avant son installation (« Essai avant installation », plus haut) ; `Cache-Control: no-store` |

**Page Debug** (`/debug/`, menu Outils, site de dev seulement : absente du menu d'un build `SITE_MODE=prod`, où la page ne dit qu'une phrase, et de
la version portable) : quatre menus déroulants, **tous fermés par défaut**, dans l'ordre voulu par le propriétaire (2026-10-15) — « Système »
(processus, disque, fichiers, évènements, volume, alertes, et la jauge « Espace disque du serveur », colorée par type de données ; production **ou**
site de dev), « Performances » (temps de réponse par route, pages vues, navigateurs, origines, requêtes récentes, export CSV ; même instance), les
« Journaux du serveur » (relevés toutes les 2 s, filtres par niveau, catégorie, texte et durée) et « DB » (le schéma de la base : toutes les tables,
leurs colonnes et leurs clés étrangères, zoom ; au double clic, le contenu d'une table de la base vivante, fiches comprises, qui se met à jour
quand la table change). Un menu fermé ne demande rien au service : il charge à son ouverture et ne relève que tant qu'il reste ouvert. Plus de
testeur de l'API (« Tester l'API sera donc supprimé car devenu inutile après le schéma ») ; la description OpenAPI reste servie, pour des outils
externes : [`api.md`](api.md), « Page Debug » ; métriques : « Métriques et volume », plus bas.

## Mise à jour (site de dev)

Demande du propriétaire : une page **Mise à jour** (menu Outils, `/mise-a-jour/`) à deux visages, comme l'édition.

**Sur le serveur normal** (et partout sans service : version portable, site statique) : la page construite montre la **note de version** de la
dernière livraison (`note_version`, `note_version_ligne`, section 15 de `data/schema.sql`), puis l'**historique** des précédentes. Une note est
la liste des modifications des règles d'une version X.Y à la suivante (toutes les versions X.Y.Z de dev entre les deux), par domaine (sorts par
magie, magies, classes et leurs dons, races, métiers, guide, Codex, bestiaire : migration `0032-notes-codex-bestiaire` ; armes, matériaux et améliorations
d'arme : migration `0034-armes-modifiables` ; chronologie et mots-clés : migration `0043-chronologie-modifiable-mots-cles` ; armures et boucliers :
migration `0046-armures-boucliers`), l'ancienne valeur **barrée**
mais lisible et la nouvelle à côté, en **vert**
(amélioration) ou **rouge** (affaiblissement) d'après la décision R29 (`docs/decisions-regles.md`, `lib/notes-de-version-sens.mjs`), plus le
champ libre des admins. Tant qu'aucune livraison n'a eu lieu, deux notes d'exemple (lorem ipsum, `exemple = 1`, migration `0023`) tiennent la place ;
la première vraie mise à jour les retire.

**Sur le site de dev** (`MAVERICK_EDITION=1`) : au-dessus, la note **en préparation**, calculée par le service à chaque visite
(`GET /api/mise-a-jour/`) : la base de la **production** comparée à la base vivante (règles de dev + modifications du site). Référence, dans cet ordre
(`serveur/notes-de-version.mjs#lireReference`, lot 3 du chantier de la base de dev, R274) : **le contenu que la production publie** — le dossier `site/`
de son instance, monté en lecture seule sur `/production` (`MAVERICK_PRODUCTION` ; `donnees/maverick.db` et `_serveur/version.json`, donc ses règles et sa
version, sans fiche ni compte : la base des fiches reste fermée) ; à défaut (dossier non monté, base ou version illisible), la **copie de master tirée du
dépôt** (`site/donnees/reference.db` et `reference.json`, `scripts/db-reference.mjs`, `MAVERICK_REFERENCE` : un repli seulement). La page dit laquelle
sert, et pourquoi la production ne sert pas : dossier non monté, sans base, version absente de `version.json`, base illisible (une base à moitié
copiée, que le calcul de la note ne peut pas lire : repli sur la copie du dépôt, jamais une erreur de la page) ou **base de ce site même** (le même
fichier, même périphérique et même inode que `MAVERICK_REGLES` : le dev ne se compare pas à lui-même). Sur le VPS le montage est celui de
`docker-compose.yml` (`../maverick-center/site` par défaut, `MAVERICK_DOSSIER_PRODUCTION` dans `.env`, posé par `instances.sh`) : une installation qui
change le `docker-compose.yml` demande de lancer `docker compose up -d` dans le dossier de l'instance, une fois. Les tables de contenu que la
comparaison ne décrit pas (domaine « Autres tables ») sont comparées sur leurs colonnes communes : lignes ajoutées, retirées ou changées (au-delà de 40
par table : leur nombre), « structure changée » à part ; ni les fiches, le journal et les notes, ni ce que la fabrication calcule elle-même (`lien`,
`lien_candidat`, `page_fts`, `entite_fts`) n'y entrent, ni les lignes qui tiennent à une page d'exemple (`statut = 'example'` : la copie de master les
garde, le site de dev les masque ; les `source` que seules des pages d'exemple citent comprises). Ces lignes sont **affichées mais ne comptent pas
dans « à livrer »** (`lignesALivrer`) : le workflow n'écrit pas encore les « Autres tables » dans la note (`mise-a-jour-regles.mjs#lireTables`, sans
`autres`), si bien qu'une mise à jour dont seules ces lignes diffèrent, sans modification en attente ni texte, reste refusée (« Rien à livrer »). Juste
après une mise à jour réussie, la comparaison ne montre aucun écart.
Hors ce domaine, seuls les champs que le site modifie sont comparés (`lib/edition-modele.mjs#TABLES`) : le reste en est dérivé (depuis la migration `0043`, la chronologie
(événements, descriptions, catégories) et le vocabulaire des mots-clés en sont : domaines « Chronologie » et « Mots-clés » ; les catégories d'un événement sont comparées comme un ensemble ; depuis la migration `0056`, les panneaux de règles de la page « Équipement » : domaine « Équipement », un panneau sous le nom de son onglet, un bloc par son titre de tuile, sinon ses premiers mots (« Toutes les armes ont de base… »), ou le libellé du mot-clé d'une tuile qui n'est qu'une balise ; la place des blocs n'est pas listée bloc par bloc : une ligne « Ordre des blocs » par panneau quand les blocs qu'il garde ne se lisent plus dans le même ordre, de la première à la dernière place qui change (`comparerOrdreDesBlocs` ; une tuile insérée ou un bloc retiré n'est dit que par son ajout ou son retrait)). Une ligne qui n'existe qu'avec une
autre (la rubrique d'une carte de monstre, une case de butin, un bloc d'une espèce) n'est listée que pour un champ modifié : son ajout ou son retrait est
dit par la carte ou l'espèce qui la porte ; un contenu entièrement absent de la production (le Codex et le bestiaire à leur première livraison) tient en
une ligne (« 116 pages du Codex », « 144 espèces », « 315 monstres », « 469 capacités de monstre ») au lieu d'une par entité (`lib/notes-de-version.mjs`, `resume` et `detail`). Le **champ libre** (Markdown simple :
paragraphes, listes, gras, italique, liens web) s'enregistre dans `note_version_brouillon` (section 14 : il suit la base vivante quand les
règles changent ; `409` si quelqu'un l'a changé entre-temps).

**La case « Version majeure »** (demande du propriétaire du 2026-10-22), à côté du titre « Mise à jour en préparation : VX.Y+1 » : la cocher
demande une confirmation, puis la version en préparation devient **VX+1.0** (`POST /api/mise-a-jour/majeure/`, colonne
`note_version_brouillon.majeure`, migration `0070-mise-a-jour-majeure` ; la décocher revient à X.Y+1, sans confirmation). Elle ne déclenche rien :
« Effectuer la mise à jour » reste le seul déclencheur. Elle part avec le lot, comme le champ libre, ne se change plus tant qu'il est figé (`409`),
reste cochée s'il est annulé, et revient à X.Y+1 quand la livraison du lot vide le brouillon. Une mise à jour sans modification ni texte reste refusée
(« Rien à livrer »), même case cochée : un passage en version majeure seul demande un texte dans le champ libre (choix du propriétaire du
2026-10-22). Pour un lot majeur, la note de version est la X+1.0 et la PR de livraison `dev` → `master` porte `[V: X+1]` dans son titre :
`livraison.yml` fait alors la X+1.0.0 ([`flux-git.md`](flux-git.md)).

**« Effectuer la mise à jour »** (et « Simulation de mise à jour », sur tous les écrans ; pas de protection avant la connexion Discord, décision
du propriétaire, case « Version majeure » comprise, qui peut faire partir une version majeure : risque accepté le 2026-10-22, à revoir avec
l'authentification Discord) : après confirmation (taper `METTRE A JOUR`), le service **fige un lot** — le journal en attente (sans l'aperçu HTML du guide), le champ libre, les
versions et la case « Version majeure » (`majeure`, couverte par l'empreinte) — dans `db/mise-a-jour/<lot>.json`, avec son empreinte SHA-256, et le sert tel quel à `/api/mise-a-jour/lots/<lot>/`. Le texte et le
bouton restent verrouillés tant que le lot n'est pas livré ou annulé. Puis il déclenche le workflow GitHub **`mise-a-jour.yml`** sur `dev`
(`workflow_dispatch` : lot, empreinte, adresse ; jeton du serveur limité à la permission *Actions*), dont il suit le run (état dans
`db/mise-a-jour/etat.json`, gardé si le service redémarre). Sans jeton, la page donne les trois valeurs pour lancer le workflow à la main.

**« Simulation de mise à jour »** (bouton à côté, confirmation simple) : le même processus, avec un lot qui le dit (`simulation: true`, couvert
par l'empreinte ; absent d'un lot plus ancien = vraie mise à jour) et l'entrée `essai` cochée ; le workflow refuse, sans rien faire, un lot
dont le mode ne correspond pas à l'entrée (dans les deux sens : une case « Simulation » oubliée ne fait jamais de vraie livraison). Le job
`preparer` fait tout le travail, exactement comme pour une vraie mise à jour (branche à jour de `dev`, lot rejoué, note de version écrite,
liste des tables contrôlée, `db:build`, `db:check`, puis tout le job `client` de la CI : `npm test`, build, tests du site construit, build de
test, installateur, version portable) ; le job `livrer` vérifie sans effet de bord l'artefact (lot, commit, fichiers), son application sur le
`dev` à jour et le jeton (`git push --dry-run` authentifié : l'écriture sur *Contents* ; lecture des PR). **Rien n'est poussé** : ni PR, ni
fusion, ni livraison. Ce qu'une simulation ne peut pas vérifier sans effet de bord : les droits *Pull requests* et *Workflows* en écriture du
jeton (le résumé du run le dit). À la fin (réussie ou non), le lot est libéré et le texte redevient modifiable (`simulation_reussie` /
`simulation_echouee`).

Le workflow (`client/scripts/mise-a-jour-github.mjs`, une phase par invocation : `--phase preparer | dev | master`) a deux jobs, aux noms fixes :

1. **`preparer`**, sans aucun secret (`npm ci`, `npm test` et le code du dépôt y tournent ; seul le jeton du workflow, en lecture, y sert à
   `actions/checkout`, qui ne le garde pas) : télécharge le lot et vérifie son empreinte et son mode ; refuse si une **autre mise à jour est dans
   `dev` sans être sur `master`** (commit « Lot : … » d'un autre lot, ou code 7 de `mise-a-jour-regles.mjs` : sa note de la même version X.Y serait
   remplacée ; relancer le run de cette mise à jour-là, qui reprend à la livraison, ou livrer `dev` → `master` à la main) ; part de `dev` et y
   applique le lot (`client/scripts/mise-a-jour-regles.mjs`) : base reconstruite depuis `data/rows`, journal rejoué (**un conflit arrête tout**),
   note de version écrite (version X.Y de la prochaine livraison, d'après la même règle que le bot, X+1.0 pour un lot `majeure` ; les notes
   d'exemple retirées), journal versé
   dans `historique_modification`, puis `data/rows` réécrit par l'exporteur — dans une copie d'abord : **seuls les fichiers des tables que le
   journal a touchées et ceux des notes de version peuvent changer** (demande du propriétaire), sinon rien n'est écrit ; puis `db:build`,
   `db:check` et tout le job `client` de la CI, sans qu'aucun fichier ne change ; enfin un commit local, publié dans l'artefact `preparation`
   (le lot tel que servi, le commit en *git bundle* sur la base `origin/dev`, le résumé) ;
2. **`livrer`**, seul job à recevoir le jeton `MISE_A_JOUR_TOKEN` (*Contents*, *Pull requests*, *Workflows* en écriture), où ne tournent ni npm
   ni `node_modules` (les actions officielles, git et le script, qui n'importe que `node:` et `tools/flux-git/regles.mjs`) : il revérifie
   l'artefact avec git — le lot a l'empreinte de l'**entrée** du workflow, un seul commit sur la base annoncée, fichiers ⊆
   `data/rows/<tables du lot et de la note de version>.sql` (fichiers ordinaires), message attendu —, puis deux étapes, dont le service peut lire
   l'état :
   - **« Fusion dans dev »** : le commit posé sur le `dev` à jour, tel quel, ou rejoué par un rebase textuel si `dev` a bougé (`data/rows` a une
     ligne par ligne de table : un conflit textuel est la même ligne, ou sa voisine, changée des deux côtés : échec net, rien n'est poussé,
     relancer la mise à jour ; un rebase propre est sûr, la CI de la PR refaisant tous les contrôles) ; poussée sans hooks de
     `feature/mise-a-jour-regles-<date>`, PR vers `dev` (la branche est supprimée si l'ouverture échoue), CI verte attendue, fusion par commit
     de fusion ; si `dev` bouge pendant l'attente, PR fermée et commit rejoué sur le nouveau `dev` (3 essais). Un lot déjà dans `dev` (relance)
     termine l'étape sans rien refaire ;
   - **« Livraison vers master »** (elle repart du lot trouvé dans `dev`) : le commit de version du bot attendu, puis la PR de **livraison `dev`
     → `master`**, attend sa CI et la fusionne : `livraison.yml` fait la version X.Y.0, les étiquettes et les installateurs. Pour un lot
     `majeure` (case « Version majeure »), son titre porte `[V: X+1]` et `livraison.yml` fait la X+1.0.0 ; la livraison s'arrête si la PR porte
     le marqueur sans que le lot le demande, ou l'a perdu alors qu'il le demande (ouverte avant, titre changé pendant l'attente).

Le corps des deux PR est la note de version, jamais `[V: X+1]` (le marqueur n'est que dans le titre de la livraison d'un lot `majeure`), références GitHub (`#n`, `GH-n`, `propriétaire/dépôt#n`, adresses
…/issues/n et …/pull/n) et `@mentions` neutralisées par une espace sans chasse : une PR ouverte et fusionnée au nom du propriétaire ne ferme
aucun ticket et ne notifie personne. Relancer le run (*Re-run*) reprend où il s'est arrêté : un lot déjà dans `dev` passe directement à la
livraison, un lot déjà livré ne fait rien.

Quand la nouvelle version arrive sur le site de dev, la base vivante est refaite : les modifications déjà livrées (leur lot est dans
`historique_modification` des nouvelles règles) sont **« intégrées » avant tout rejeu** (`integrerLivrees`) — rejouées d'après leurs valeurs,
un aller-retour (A → B → A) se réappliquerait, deux saisies du même champ passeraient « conflit », et une valeur annulée par l'admin
reviendrait ; `db:appliquer-edition` et le script de rejeu du workflow écartent de même les lots déjà livrés. Le brouillon dont le lot a sa
note dans les règles est vidé. Le serveur normal reçoit la nouvelle note avec la livraison.

**États du lancement** (`db/mise-a-jour/etat.json`, `serveur/notes-de-version.mjs`) : `envoi` → `lance` → `en_cours` → `fusionne` (le lot est
dans dev : étape « Fusion dans dev » du job `livrer` réussie, ou sa note arrivée dans les règles) → `termine` (run réussi, ou la référence
porte la version de sa note — celle de la production installée, à défaut celle de la copie de master : jamais par la seule arrivée de la note dans dev ;
sans jeton, `manuel` : aucun suivi du run, `fusionne` dure jusqu'à l'installation par le cron des installateurs, ou jusqu'à `DUREE_MAX_RUN`). Un échec **avant** dev donne `echec` (annulable) ;
**après**, `echec_livraison` : le lot est dans dev, il ne s'annule plus, on relance son run (« Re-run all jobs » : il reprend à la livraison) ou on
fusionne sa PR de livraison, et une nouvelle mise à jour attend (le script de rejeu refuse aussi, code 7, d'écraser la note d'un autre lot
pas encore livrée). Sans jeton : `manuel`. Annulé : `annule`. Simulation : `simulation_reussie` / `simulation_echouee`. Garanties :
- seul le lot du lancement actuel, toujours en jeu, est servi au workflow (`lireLot`) : un lot annulé, remplacé ou de simulation finie répond
  `410`, si bien qu'un « Re-run » ou un lancement à la main ne peut pas le livrer ;
- un suivi ou un déclenchement revenu en retard n'écrase jamais un état plus récent ni celui d'un autre lot (`modifierLancement`) ;
  « Annuler » dit quel lot il vise (`{ lot }` : un onglet périmé reçoit `409`) ; les réponses portent `liberable` et `occupe`, les règles
  du service, que la page applique telles quelles ;
- au plus un lancement toutes les 2 minutes et 8 par 24 h (le bouton n'a pas d'authentification avant la connexion Discord) ; une vraie
  mise à jour sans rien à livrer est refusée ;
- au-delà de 3 h sans nouvelles (plus aucun run ne peut tourner), un lancement bloqué se libère (le texte d'un lot déjà dans dev quitte le
  brouillon, sans annuler le lot) ;
- le lot dit s'il est une simulation (`simulation`, couvert par l'empreinte) : le workflow refuse un lot lancé dans l'autre mode.

La page ne montre l'encart « Dernier lancement » / « Dernière simulation » que pour la **version en préparation** (demande du propriétaire :
la livraison précédente, terminée, disparaît) ; un lancement d'une autre version reste affiché tant qu'il pèse sur la page — `occupe`, son lot
tient le texte figé, ou ce lot, pas encore dans dev, s'annule encore (`liberable`) — pour qu'elle dise pourquoi (`lancementAffiche`,
`lib/notes-de-version-rendu.mjs`, testé).

**Le site est la source** des données qu'il modifie (décision du propriétaire) : toute modification rapatriée dans `data/rows` (par ce bouton,
avec la version qui la livre, ou par `npm run db:appliquer-edition`, version vide) est gardée, ligne par ligne, dans `historique_modification`
(lot, rang, date, table, clé, opération, avant, après, et la nature du lot avec son numéro de décision, migration 0127). `client/src/lib/historique-site.mjs` le relit (`historiqueSite(db)`) : `creee`,
`supprimee`, `modifiee`, `touchee` disent ce que le site a fait d'une ligne ou d'une colonne ; `valeurDImport`, `ligneDImport`, `lignesDImport`
et `effectifDImport` redonnent l'état d'avant toute édition (l'historique rejoué à l'envers ; clé = colonnes de la clé primaire, comme le
journal). Les tests s'en servent ainsi :

- un **pin d'import** (effectif d'une table, texte cité d'une cellule, liste du classeur, registre d'une migration) se lit sur l'état d'import :
  il garde exactement ce que l'import ou la migration a produit, la valeur courante devient libre ;
- l'**état courant** est contrôlé par des **invariants de cohérence** (une ligne par page, matrice complète, la page redit ses tables, la liste
  des magies innées est celle des tables, nombre de lignes de `sort_bonus_maitrise` = découpage des cellules…) ; un exemple nommé (Boule de
  feu, Forgeron…) n'est vérifié sur l'état courant que tant que le site n'a pas réécrit la colonne ;
- une entité créée par le site sans tout ce que l'import donnait (classe sans don, race sans magie innée) est admise et signalée « à compléter » ;
  une entité importée incomplète reste une erreur ;
- les tests du service lisent l'état avant d'écrire (ordre = max + 1, races hybrides sans classe raciale) et prennent des noms absents de la base ;
- un test qui lit `data/rows` **tient avec une note de version en attente de livraison** : pendant une mise à jour (le job `preparer` lance
  `npm test` après avoir écrit la note du lot, qui n'est pas encore sur master) et sur `dev` avant la livraison, `data/rows` en porte une. Un
  test qui applique un lot part d'une copie sans elle (`client/test/aide-mise-a-jour.mjs#copieSansNoteEnAttente`, d'après
  `notesEnAttente` de `mise-a-jour-regles.mjs` : sinon, code 7) ; un test qui écrit une note prend une version libre (`versionLibre`) et lit
  celle qu'une mise à jour rend (jamais « 0.2 » en dur) ; les balayages de tout le texte de la base (ancienne graphie, ancien identifiant,
  « (classe) »…) sautent la section 15 (`lib/notes-de-version.mjs#TABLES_DES_NOTES` : des traces, qui citent la production d'avant la
  livraison et les valeurs au moment de chaque modification) ; la page `/mise-a-jour/` construite se compare aux notes de la base (les notes
  d'exemple disparaissent à la première mise à jour : `site-html`). Le run 38151792080 (simulation du 2026-10-11) a échoué sur 14 tests qui
  l'ignoraient (et le test de la page construite aurait suivi) ; le job `simulation-de-mise-a-jour` de la CI (ci-dessous) le vérifie sur
  chaque PR.

**Simulation en CI** (job `simulation-de-mise-a-jour` de `.github/workflows/ci.yml`, parallèle au job `client`, sur chaque PR et après chaque
fusion) : `client/scripts/mise-a-jour-simulation.mjs` fabrique un **lot synthétique** — le service fait de vraies modifications dans une base
vivante tirée de `data/rows` (texte des deux premières pages de « Découvrir » du guide, `lib/livres.mjs`, description et bonus d'un métier, coût d'un sort, un don créé et gardé, un
autre créé puis supprimé ; valeurs lues avant d'écrire, noms libres), écrit le champ libre et fige le lot par `POST /api/mise-a-jour/lancer/`
en simulation —, puis le job le rejoue comme `preparer` (`mise-a-jour-regles.mjs`, production `origin/master`), indexe `data/rows` et lance
exactement les contrôles de `preparer` (`CONTROLES` de `mise-a-jour-github.mjs` : `db:build`, `db:check` puis tout le job `client` — `npm test`,
build, tests du site construit, build de test, installateur, version portable ; le test épingle la liste), sans qu'aucun fichier ne change
ensuite. Une PR qui rendrait la mise à jour impossible y est rouge. Quand `data/rows` porte déjà une note en attente (PR de mise à jour, `dev`
avant la livraison), aucun lot n'est écrit (un second serait refusé, code 7) : `data/rows` est contrôlé tel quel, déjà dans l'état d'après une
mise à jour. Le job n'est pas (encore) un check requis des règles de branches (`.github/rulesets/`) ni de `CHECKS_REQUIS` ; il coûte à peu près
les minutes du job `client`. En local :

```bash
cd client
git fetch origin master
node scripts/mise-a-jour-simulation.mjs --lot /tmp/lot.json --reference origin/master   # --guide : les deux pages du guide seulement (comme le run 38151792080)
node scripts/mise-a-jour-regles.mjs --lot /tmp/lot.json --reference origin/master
npm run db:build && npm run db:check && npm test                                        # puis, au besoin, le reste du job client (build…)
git checkout -- ../data/rows                                                            # data/rows remis tel qu'il était
```

`db:check` compare de même chaque note de cellule à la remarque d'import (`valeurDImport`) et ignore une ligne créée ou supprimée par le site ;
`tools/db/races_onglet.py --verifier` ignore une race créée depuis le site (son onglet cite « Site de dev › … », pas le classeur). Une migration
qui renomme une colonne doit aussi renommer ses clés dans `avant` / `apres` de `historique_modification`.

**Fusion à trois voies** (demande du propriétaire : « j'aimerai que les modification apporté sur le site prime sur celle qui peuvent être faites
"sous le radar" par le code et le dev. Si n'importe quel élément est modifiée à la fois par une modification manuelle et par une modification par le
code et la livraison d'un build, je site essaye de faire un merge automatique entre les deux. Quand un conflit est trop ambigüe seulement là il est
listé dans l'onglet mise à jour avec à gauche "modification sur site" et à droite "modification du code". » ; réponses : « Pendant qu'un conflit ambigu
attend son choix, la page du site affiche LA MODIFICATION DU SITE », « Une valeur courte non fusionnable (nombre, case à cocher, nom, choix dans une
liste) modifiée des deux côtés : LISTÉE EN CONFLIT (la valeur du site reste affichée en attendant) »). Au rejeu (`edition-journal.mjs#evaluerUne`), une
colonne que les règles ont changée depuis (elle ne vaut ni l'`avant` de la modification, ni déjà sa valeur) se fusionne : base = `avant`, site =
`apres`, code = la valeur des règles (`lib/fusion-trois-voies.mjs#fusionner`, module pur).
- **Texte long** : une colonne de `TABLES` de type `texte` ou `markdown`, et le corps d'une page (`lib/edition-modele.mjs#colonneFusionnable`,
  `TYPES_FUSIONNABLES` : lu dans le modèle, pas une liste de colonnes). Fusion ligne par ligne, puis mot à mot dans un passage que les deux côtés ont
  touché (une balise du glossaire compte pour un mot) ; deux changements séparés par au moins une ligne, ou un mot qui n'est pas un blanc, inchangé
  se gardent tous les deux ; deux changements qui se recouvrent ou se touchent, différents, sont **ambigus** (comme `git merge` : l'ordre de deux ajouts
  au même endroit ne se devine pas ; une page réécrite et un paragraphe ajouté au bout aussi). Fins de ligne lues « \n » ; au-delà de 1,5 million de
  cases de comparaison, ambigu. **Toute autre valeur est courte** (nombre, case, nom, choix d'une liste) : jamais fusionnée.
- **Sans recouvrement** : la valeur fusionnée est écrite, le lot reste en attente, sans conflit. Le site qui ne change rien de plus que le code :
  la valeur des règles reste. Le même `evaluerUne` sert la base vivante, `db:appliquer-edition` et la mise à jour des règles : le journal exporté
  se rejoue sur `data/rows` avec la même fusion.
- **Ambigu** (base vivante du site de dev seulement : `rejouerLeJournal(…, { garderLeSite })`, posé par `base-vivante.mjs#transferer`) : si c'est
  le seul souci du lot, il est **gardé** — la valeur du site est écrite et reste (la page la montre : `lignesEnAttente` compte ses lignes) ; pour un
  texte, c'est la fusion où **les passages en conflit prennent le côté du site et le reste est fusionné** : les changements du code ailleurs sont gardés
  (`fusionner(…).siteGagne` ; réponse du propriétaire du 12 novembre : « Les garder (Recommandé) » — le choix 1 ne tranche que les passages en
  conflit) ; une valeur courte : la valeur du site. Le lot
  passe « conflit » (listé sur la page, pas exporté), et la trace de chacune de ses lignes (`detail` : la phrase « … autrement, la valeur du site
  reste en place », puis, après un saut de ligne, `{"reprise": …}`, `edition-journal.mjs#MARQUE_DE_REPRISE`, `lireLaTrace`) garde ce que le rejeu a
  écrit et, pour chaque champ gardé, `{ base, site, code, passages, siteGagne, codeGagne, provenance }` : la valeur du code n'est plus dans la base. Les lots suivants du
  même champ se rejouent sur la valeur du site, sans cascade ; ils restent en attente mais ne partent qu'après la résolution du lot gardé
  (`edition-journal.mjs#lotsRetenus`, de proche en proche ; `journalExporte` les laisse et les liste dans `retenus`). Le bilan du rejeu compte les
  lignes d'un lot gardé dans `conflits`, et dans `gardees` (clé présente seulement s'il y en a). Les autres conflits (ligne supprimée, insertion
  qui existe déjà, référence rompue, contrainte, forme ancienne, refus communs au rejeu) annulent leur lot comme avant ; un lot qui a aussi l'un
  d'eux est annulé en entier, ses champs ambigus en conflit « colonnes » ordinaire.
- **Réévaluation** : avec `garderLeSite`, les lots en conflit pas encore résolus sont rejoués avec les autres à chaque reconstruction (un lot annulé
  d'une base vivante d'avant cette règle devient gardé, fusionné ou sain : rien ne reste perdu) ; un lot résolu ne l'est jamais. `preparerBaseVivante(…,
  { garderLeSite: false })` refait une base d'avant (réservé aux tests de la résolution des lots annulés).

**Lots du journal en conflit** (demande du propriétaire du 2026-10-22 : « Après les listes de modifications, montrer les lignes en conflits.
1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les deux. » ;
`serveur/edition-conflits.mjs`, site de dev seulement). Un lot passe « conflit » au rejeu (ci-dessus, « Édition des règles »), gardé (la valeur du
site en place, ci-dessus) ou annulé en entier, avec un seul message : il ne part jamais avec une mise à jour (`figerLot` → `journalExporte` : en
attente et intégrées seulement, hors lots retenus), reste sur le site de dev sans rien bloquer (la note en préparation le compte : `en_conflit`,
`{ lots, modifications }`) et se résout contre les règles d'aujourd'hui, même après une livraison. **La note en préparation** ne montre que ce qui
partira (réponse du propriétaire du 12 novembre : « Les retirer (Recommandé) ») : ses lignes sont calculées sur la base vivante dont les lots gardés
pas encore résolus et les lots retenus derrière eux sont défaits, dans un savepoint toujours annulé (`serveur/notes-de-version.mjs#tablesQuiPartiront`,
`edition-journal.mjs#defaireLesLotsEnSuspens`), et `en_attente` ne compte pas les lots retenus ; ils y apparaissent après la résolution.

- **Un lot gardé** (`garde: true`, `edition-conflits.mjs#examinerUnLotGarde`, `resoudreUnLotGarde`) : un conflit par champ gardé (genre `champ`,
  ou `hors_modele`), **version 1 = la modification du site** (ce lot, en place), **version 2 = la modification du code** (la valeur gardée dans
  la trace), `avant` = ce que le site avait trouvé, `passages` (les passages en conflit d'un texte : `{ base, site, code }`), `provenance_1`
  (`{ genre: 'site', lot, fait_le, resume }`), `provenance_2` (`{ genre: 'regles' }` les règles livrées, ou `{ genre: 'regles_et_site', lot, … }`
  quand un lot plus ancien du même rejeu avait déjà écrit ce champ, fusionné avec le code), `actuelle` (null, ou la valeur de la base quand un lot
  plus récent l'a changée depuis, avec sa `provenance`), `lots_suivants` (`{ lot, fait_le, resume }`), `valeur_1` et `valeur_2` (`{ genre:
  'valeur', valeur }` : la valeur que laisse chaque choix ; `valeur_2` null si le choix 2 est refusé). Choix 1 : garder la valeur en place (les
  passages en conflit côté site, le reste fusionné ; rien n'est écrit) ; 2, symétrique : les passages en conflit côté code, les changements du site
  hors conflit gardés (`codeGagne` ; une valeur courte : celle du code), les lots suivants du même champ refaits dessus par la même fusion (`refus_2` si l'un ne s'y fusionne pas —
  avec `refus_2_lot` : `{ lot, fait_le, resume }` de ce lot —, ou si l'éditeur la refuse aujourd'hui : une ancre figée retirée…, sans `refus_2_lot`) ; 3 : une valeur saisie (pas sur une ligne gelée, une image ni une colonne hors
  du modèle). Les autres lignes du lot sont ses saines (`fusionnees`, `fusionnees_libelles` : ses colonnes fusionnées sans conflit). La résolution
  écrit, dans une transaction, **la reprise du lot** (`<lot>-reprise`, « Reprise du lot X (conflit résolu) : … ») : un lot normal du journal à la place
  du lot gardé dans l'ordre du rejeu (même `fait_le`, son id le suit), qui note ce que le rejeu avait écrit à partir des règles (`avant` = la valeur
  du code) ; rejoué sur `data/rows`, il redonne la base vivante, et les lots suivants passent après lui. Puis, pour les choix 2 et 3, un lot écrit
  par l'éditeur sur la base telle qu'elle est (« Résolution du conflit du lot X : … », `nouveau_lot`). Le lot gardé est marqué résolu (`resolu_par` =
  la reprise), ses lignes restent `conflit` comme trace. Réponse : `reprise` en plus.
- **Ordre des résolutions** (bug du lot de 03:17 résolu avant celui de 03:16) : un conflit qu'un lot plus ancien, en conflit et pas résolu, touche
  aussi (même table, même clé, même colonne, ou la ligne entière) est bloqué : `bloque` (`{ lot, fait_le, resume, raison }`, null sinon ; le lot :
  `bloque` vrai si l'un l'est), et la résolution répond `409` (`details.bloque`). Un choix 1 d'un lot annulé qui écraserait la valeur d'un lot plus
  récent du site de dev (la provenance de la version 2, une résolution comptant à la place du lot qu'elle résout) est retiré (`refus_1`, avec
  `refus_1_lot` : `{ lot, fait_le, resume }` ; un refus de l'éditeur n'en a pas). Les phrases (`refus_1`, `refus_2`, `bloque.raison`, le message du
  `409`) gardent leur forme « Le lot du <fait_le> (« <résumé> »)… » ; les champs structurés servent la page. Tout résumé du diagnostic (`resume` d'un
  lot, des provenances, des lots suivants, des blocages, des lots résolus et retenus) est sans les marqueurs du rejeu ni l'id du lot qu'une résolution
  reprend (« Résolution du conflit du lot <id> : » et « Reprise du lot <id> (conflit résolu) : » retirés : `edition-conflits.mjs#resumeVu` ; `resout`
  d'une provenance donne ce lot).

- **Le diagnostic** (`GET /api/mise-a-jour/conflits/`) est recalculé à chaque demande sur la base vivante (règles livrées + lots rejoués depuis),
  dans un savepoint **toujours annulé** — exception assumée à « lecture seule quand rien n'est écrit » : même connexion, `traiter` synchrone. Le lot
  y est rejoué sans s'arrêter au premier conflit (`edition-journal.mjs#parcourirUnLot`, même adaptateur que le rejeu), par passes comme le rejeu :
  une modification abandonnée d'office (ci-dessous) est laissée de côté à la passe suivante. Chaque modification saine est dite (`reappliquee`,
  `deja_la`, `derivee`, `sans_effet`, avec ses colonnes si une autre colonne de la même ligne est en conflit), ainsi qu'une règle en données d'un don
  que le lot supprime aussi (`suit_le_don`, avec `don` : le libellé du don ; sans choix, elle suit celui du don, voir « Édition des règles », dons). Chaque conflit porte la
  **version 1** (ce que le site de dev avait écrit : la valeur du lot, et l'aperçu HTML d'une page du guide), la **version 2** (ce que disent les
  règles livrées : la valeur de la base vivante, ou « ligne supprimée »), ce que le site avait trouvé (`avant`) et les choix permis, et (lot annulé)
  `garde: false`, `provenance_1`, `provenance_2` (d'où vient la valeur actuelle : `regles`, `site` — un lot en attente plus récent ou plus ancien —
  ou `resolution`, avec `lot`, `fait_le`, `resume`, et `resout` pour une résolution : `edition-conflits.mjs#provenanceActuelle`), `passages` (deux
  textes : les passages en conflit de leur fusion), `valeur_1` et `valeur_2` (la valeur que laisse chaque choix) et `bloque`. Un texte long ambigu
  d'un lot annulé se résout comme celui d'un lot gardé (décision du leader-technique, la réponse du propriétaire « Les garder » valant pour eux) :
  choix 1, les passages en conflit côté site et le reste fusionné ; choix 2, côté code, les changements du site hors conflit gardés (écrits par
  l'éditeur) ; une valeur courte : version 1, ou la valeur actuelle. La page (`lib/conflits-rendu.mjs#titreDeLaVersion`) les titre « modifiée sur le site
  de dev (ce lot, du …) » et d'après `provenance_2` ; un lot gardé (`garde` vrai), « modification sur le site » à gauche (la version 1 ; la page du
  site affiche en attendant le choix `valeur_1` : les passages en conflit côté site, le reste fusionné) et « modification du code » à droite (la
  version 2), deux textes réduits à leurs passages en conflit (`passages`) ; de deux textes, elle ne montre que les différences mot à mot, les passages identiques repliés autour d'une ligne de contexte
  (`lib/diff-replie.mjs`, demande du propriétaire du 2026-11-07), les deux versions entières dans un bloc fermé. Genres : `champ`
  (une colonne de `TABLES`, id « rang:colonne » ; choix 1, 2, 3 — une image : 1, 2 — ; `saisie` = le champ de `TABLES`, qui fixe le type de la
  valeur saisie), `hors_modele` (une colonne hors du modèle : valeurs brutes, 1 ou 2), `insertion` (la ligne existe déjà, autrement : 1 ou 2),
  `suppression` (la ligne a changé depuis : 1 la supprime, 2 la garde), `ligne_supprimee` (la ligne n'existe plus : seul 2, la version 1 reste
  lisible pour être recopiée ailleurs — le cas des sept pages du guide fusionnées puis supprimées par la PR #219), `sans_valeur` (forme ancienne sans
  équivalent, clé étrangère rompue — rattachée à la modification qui écrit la ligne qui cite, ou à la suppression qui la cause —, écriture refusée,
  erreur après le lot : la raison, et seul 2, abandonner l'opération). La version 1 d'un champ est passée par l'éditeur : refusée aujourd'hui
  (Markdown sûr, bloc inconnu, balise d'un mot-clé disparu, titre déjà pris), le choix 1 disparaît et `refus_1` dit pourquoi ; une colonne saine
  que l'éditeur refuse devient un conflit (2 ou 3). Sur une ligne gelée (un mot-clé verrouillé, une monnaie : `raisonDuGel`), le choix 3 disparaît
  et `refus_3` dit pourquoi : une valeur saisie serait une modification nouvelle, que le verrou vise (R218 (3), R219 (6), R220 (1)) ; envoyé quand
  même, il est refusé en `409`. Les choix 1 et 2 restent. Une ligne de détail (bonus d'un métier…) n'est jamais un conflit à elle : elle suit sa source.
  Les lignes des sources de maîtrise d'arme (`maitrise_arme_part`, `maitrise_arme_part_famille`, `capacite_nm_gagne`) ne sont même pas parcourues :
  ni conflit ni modification saine, elles sont refaites par le lecteur après les choix (ci-dessous).
  **Les noms** (demande du propriétaire du 2026-10-23, quand « metier_bonus » et « alias » ressortaient sous leur nom technique : « Un vrai nom
  serai mieux ») : chaque table et chaque colonne est dite par son nom français, celui du registre `lib/libelles-de-la-base.mjs` (`nomDeTable`,
  `nomDeColonne`) — d'abord le libellé de `TABLES` quand il existe, puis les noms propres à une table (`NOMS_DES_TABLES`, `NOMS_DES_COLONNES`),
  enfin les noms communs à toutes (`COLONNES_COMMUNES` : identifiant, remarque, clés étrangères par la table citée…) ; « Bonus du métier »,
  « Autre nom de la page ». Le registre couvre toute table qu'un lot du journal peut porter (celles de `TABLES`, des créations et suppressions, et
  celles que le service écrit par dérivation : tables de détail, pages, étiquettes, relations, traces), chacune de leurs colonnes, les tables
  qu'elles citent par une clé étrangère, et celles qui les citent (une suppression du lot peut y rompre une référence, et la raison nomme la table
  qui cite : « Étiquette du sort : clé étrangère rompue vers Mot-clé … », fiches de personnage comprises), avec les colonnes d'une clé composée
  (`test/libelles-de-la-base.test.mjs`, contre `data/schema.sql` et le code de `serveur/edition*.mjs`). Hors de `TABLES`, le nom d'une table est
  celui du registre de l'API REST (`lib/ressources/*.mjs`, `nom`) quand il en a un, sauf les écarts que le test épingle avec leur raison
  (« Altération d’état », jamais « État » seul). Il ne rend jamais une colonne modifiable : `TABLES` reste la seule liste de ce que l'édition accepte. Seuls les noms changent : identifiants et
  valeurs restent tels quels. Une version faite d'une ligne (`ligne`, `valeurs`, `suppression`) ne montre ni les clés normalisées (`X_cle`,
  `alias.cle`) ni la provenance (`origine`, `source_ref`, retirée à la 1.0 : `colonneMasquee`), et nomme chacune de ses autres colonnes
  (`libelles` : colonne → nom) ; la colonne d'un conflit `hors_modele` a aussi son nom (`colonne_libelle`). Une raison qui cite une clé
  normalisée (le rejeu la compare aussi : « les règles ont changé nom, nom_cle autrement », « UNIQUE constraint failed: metier.nom_cle ») la dit
  par sa colonne source (`colonneSource` : « les règles ont changé « Nom » autrement »), la provenance jamais (« cette ligne » si rien ne reste).
  Le `libelle` d'une ligne est la table (son nom) et son nom, son titre ou son libellé, sinon l'id de sa clé (une
  page supprimée : « Page guide/… »), sinon ce que sa clé composée désigne : la ligne citée par sa clé étrangère, sans parenthèses ni nom de sa
  table (demande du propriétaire du 2026-10-23 : « Bonus du métier « Forgeron » »), par son nom lu dans la base entre guillemets si elle existe
  encore, sinon par son identifiant lisible (l'id de sa clé, ou ce que sa clé composée désigne à son tour), puis ses autres colonnes, un rang dit
  « n° N », une autre colonne par son nom dans le cours de la phrase (« Capacité de la carte « Amblypyge de brai », n° 1 », « Bonus du métier
  « Forgeron », n° 1, option 2 », « Autre nom de la page guide/le-mode-hyper, ordre 900 », « Valeur d’une capacité « Amblypyge de brai », n° 1,
  numéro de l’emplacement 2 ») ; une clé qui cite plusieurs lignes les distingue par le nom de leur colonne, après un deux-points (« Relation
  entre deux peuples : Peuple qui voit « Drakos », Peuple vu « Fenrir Urbain » ») ; `edition-conflits.mjs#libelleDeLigne`. Jamais de JSON. Les
  raisons, la ligne « Au rejeu » et les saines reprennent cette légende. La raison d'un conflit est rendue telle quelle (`raison`, une trace) et lisible
  (`raison_lisible`, `edition-conflits.mjs#raisonLisible`) : colonnes et tables par leur nom (« les règles ont changé « Texte » autrement »), une
  clé étrangère rompue par la ligne citée (« Autre nom de la page : clé étrangère rompue vers Page guide/le-mode-hyper »), un refus de la base sans nom qualifié ni
  expression SQL (« valeur déjà utilisée ailleurs (Sort : « Nom ») ») ; une forme inconnue (le texte d'un adaptateur) telle quelle. Une saine
  partielle porte ses colonnes (`colonnes`, leurs noms techniques) et leurs noms (`colonnes_libelles`). La page montre `libelle`,
  `raison_lisible`, `colonnes_libelles`, `colonne_libelle`, les `libelles` des versions et `detail_lisible`, avec repli sur `raison`, `colonnes`
  et le nom de la colonne pour une réponse ancienne ; une version faite d'une ligne ne montre que les colonnes que ses `libelles` nomment (jamais
  une colonne sous son nom technique quand le service nomme la version). La raison du rejeu (`detail`, la trace notée sur les lignes du lot : « lot <id> :
  <table> <clé JSON> : <raison> ») est rendue telle quelle, et aussi lisible (`detail_lisible`, `edition-conflits.mjs#detailLisible`) : sans l'id du
  lot, la ligne dite par la légende de son conflit (ou de sa modification saine) de même table et même clé, sinon par `libelleDeLigne`, les colonnes
  et les tables par leur nom (« Métier « Forgeron » : les règles ont changé « Bonus » autrement ») ; la
  colonne `detail` de la base ne change pas. Une empreinte (`empreinte`) couvre le diagnostic.
- **La résolution** (`POST /api/mise-a-jour/conflits/` `{ lot, empreinte, choix }`, protections d'écriture habituelles) : chaque conflit doit
  avoir son choix (1, 2, ou 3 avec sa `valeur`), sinon `400` ; `404` lot inconnu ou sans conflit ; `409` déjà résolu, empreinte changée, ou une
  modification qui ne passe plus avec ces choix (`lot` : le diagnostic à jour) ; `422` contrainte de la base. Une seule transaction
  (`BEGIN IMMEDIATE`, clés étrangères différées puis contrôlées) écrit **un nouveau lot normal du journal** (en attente, surcouche, journal
  exporté, historique, livré par la mise à jour suivante ; « Résolution du conflit du lot X : … ») : les modifications saines, puis, pour chaque
  conflit, 1 → la version 1, 2 → rien (la règle livrée reste), 3 → le texte saisi. Les colonnes du modèle passent par l'opération « modifier » de
  l'édition avec leurs valeurs finales (valeurDuChamp, forme canonique des balises, Markdown sûr, X_cle, dérivations ; l'aperçu repris pour le
  choix 1 d'une page du guide, aucun pour un texte saisi) ; le reste est rejoué comme le rejeu (colonnes dérivées non écrites), puis les balises
  d'un mot-clé retiré, les liens de règle des métiers, les pages typées et leurs colonnes dérivées comme `rejouerLeJournal`. Une ligne source
  gardée au choix 2 est re-dérivée : ses lignes de détail suivent la règle livrée. Les sources de maîtrise d'arme de toutes les classes et de tous
  les dons que le lot touche (ses lignes de `classe`, `classe_maitrise_arme`, `capacite`, et celles dont il notait des parts) sont refaites par le
  lecteur de `lib/maitrise-arme.mjs` une fois les choix écrits, notées dans le nouveau lot (`edition-maitrises.mjs#sourcesRefaitesParLaResolution`) :
  un lot noté avant 0076 (un don créé sans ses parts), un don créé que les règles ont aussi, gardé au choix 1, ou une ligne de maîtrise recopiée
  au choix 1 finissent tels que le lecteur les lit (décisions R148 à R151, R154) ; un don ou une ligne de maîtrise supprimés perdent leurs parts
  avant eux, au journal (`sourcesAvantLaSuppression`), pas par la cascade du schéma (`serveur-edition-conflits-maitrises`). Une suppression gardée retire des fiches ce qu'elle leur ôte
  (R42, R52, R60), avec la note datée (`fiches` de la réponse) ; un don que la résolution fait quitter « Variable » ou changer de magie, ses dons obtenus
  (R181, « Retirés avec une note », R192). L'ancien lot est marqué (`resolu_le`, `resolu_par` = le nouveau lot, `resolution`
  = les choix : migration `0072`), jamais effacé : ses lignes restent `conflit`, avec leur `detail`, comme trace ; tout au choix 2 sans rien de
  sain : aucun lot écrit, `resolu_par` reste NULL. Un second appel répond `409`. Le nouveau lot se rejoue sans conflit sur `data/rows` (son
  `avant` est la base vivante) ; une résolution faite pendant un lancement part avec la mise à jour suivante.
- **Limites** : un conflit d'un lot annulé sur une colonne qu'un lot plus récent a aussi écrite se résout contre la base vivante (qui porte le lot
  plus récent ; son choix 1 est retiré ; il devient gardé à la reconstruction suivante) ;
  la note en préparation défait les lots en suspens colonne par colonne (une colonne dérivée revient à sa valeur notée) ; une page du guide dont le
  corps a été fusionné, ou gardé avec un changement du code ailleurs, n'a plus d'aperçu HTML (il ne décrit plus le texte en place : la modification
  réécrite au rejeu perd son `apercu`, `lignesEnAttente` ne le rend pas pour un lot gardé) ; la page du site de dev (`edition/guide.mjs`, mode
  modification) rend alors elle-même le texte actuel de la base dans le navigateur (`lib/markdown-rendu.mjs`, même chaîne que le build : [[liens]] sur
  les pages de la base vivante `GET /api/edition/pages/`, couleurs de case, monnaies, ancres figées, anciennes adresses du guide ; `etatDuTexte`),
  assaini comme un aperçu (`htmlSur`), et le corps redevient modifiable en place. Écarts voulus : un `[[alias]]` qui n'est ni un titre ni un slug ne
  mène à rien (la route ne donne pas les alias), pas de coloration du code. Le message « il s'affichera à la prochaine mise à jour du site » ne
  reste que si le rendu échoue (service injoignable) ou si le texte actuel ne se découpe pas comme la page (blocs `<!-- guide:… -->`) ;
  une création résolue ne rend pas aux fiches ce que R42 leur a retiré à sa suppression ; le corps d'une page typée gardé au choix 2 est celui des
  règles (refait depuis les tables, jamais depuis la version 1).

| Requête | Réponse |
| --- | --- |
| `GET /api/mise-a-jour/` | La note en préparation : `reference`, `version_dev`, `version_cible` (selon la case « Version majeure »), `version_mineure`, `version_majeure`, `en_attente`, `en_conflit` (`{ lots, modifications }` à résoudre), `lignes`, `bilan`, `brouillon` (dont `majeure`), `lancement`, `github`, `confirmation`, `etat_production` (la production a-t-elle appliqué sa dernière mise à jour : « Extrait du contenu et attestation de la production », ci-dessus), `retraits_bloquants` (R292 : les races, classes et magies que des fiches de la production citent et que la mise à jour retirerait : « Un élément de règle retiré… », plus bas), `base_source` (le marqueur `db/source` : vrai, « Copier vers le dépôt » existe) et, avec lui, `confirmation_copie` |
| `POST /api/mise-a-jour/brouillon/` | `{ texte, avant }` → le champ libre enregistré (`409` s'il a changé entre-temps ou si un lot est figé) |
| `POST /api/mise-a-jour/majeure/` | `{ majeure }` (`true` ou `false`) → la case « Version majeure » enregistrée, et la note en préparation à sa nouvelle version cible ; rien n'est déclenché (`409` si un lot est figé) |
| `POST /api/mise-a-jour/lancer/` | `{ confirmation, simulation?, version_cible? }` → fige le lot et déclenche le workflow (`simulation: true` : simulation de mise à jour, rien n'est poussé ; `version_cible` : celle que la page a montrée, `409` si une autre partirait, case « Version majeure » changée depuis un autre onglet) → `202`, `{ lancement }` (`etat` : `envoi`, `lance`, `en_cours`, `termine`, `echec`, `erreur`, `manuel`, `annule`, `simulation_reussie`, `simulation_echouee`) |
| `POST /api/mise-a-jour/liberer/` | Annule un lancement qui n'est pas parti, a échoué ou se lance à la main : le texte redevient modifiable (annulé pendant l'envoi : le run parti quand même est annulé sur GitHub) |
| `GET /api/mise-a-jour/lancement/` | L'état du lancement (le run GitHub est relu au plus toutes les 20 s) |
| `GET /api/mise-a-jour/lots/<lot>/` | Le lot figé, octet pour octet (le workflow le télécharge et vérifie son empreinte) ; avec la base source, le paquet (`application/vnd.sqlite3`) |
| `POST /api/mise-a-jour/copier/` | Base source seulement : `{ confirmation }` (`confirmation_copie` de `GET /api/mise-a-jour/`) → « Copier vers le dépôt » : `202 { lancement, github }` ; `409` sans le marqueur, ou refus avant l'envoi (« Mise à jour depuis la base source (lot 8) ») |
| `GET /api/mise-a-jour/conflits/` | `{ lots: [{ lot, fait_le, page_id, resume, garde, bloque, detail, detail_lisible, empreinte, saines: [{ rang, table, cle, operation, libelle, issue, colonnes?, colonnes_libelles?, fusionnees?, fusionnees_libelles? }], conflits: [{ id, rang, table, cle, operation, libelle, colonne, colonne_libelle, genre, garde, raison, raison_lisible, version_1, version_2, avant, provenance_1, provenance_2, actuelle?, passages, lots_suivants?, valeur_1?, valeur_2?, apercu, choix_possibles, refus_1?, refus_1_lot?, refus_2?, refus_2_lot?, saisie, refus_3?, bloque }] }], resolus: [{ lot, fait_le, resume, resolu_le, resolu_par, resolution }], retenus: [{ lot, fait_le, resume, derriere }] }` (une version : `{ genre: 'valeur' \| 'ligne' \| 'valeurs' \| 'suppression' \| 'absente', valeur }`, images résumées) |
| `POST /api/mise-a-jour/conflits/` | `{ lot, empreinte, choix: { "<id>": { choix: 1 \| 2 \| 3, valeur? } } }` → `{ lot, nouveau_lot, reprise?, modifications, lignes, fiches, resolution }` ; `400`, `404`, `409` (`lot` : le diagnostic à jour ; `bloque` : un lot plus ancien à résoudre d'abord), `422` |

**Mise en place** (une fois) : le secret `MISE_A_JOUR_TOKEN` du dépôt (jeton fine-grained d'un administrateur, ce dépôt seulement : *Contents*,
*Pull requests* et *Workflows* en écriture ; le jeton d'un workflow ne déclenche ni la CI ni `livraison.yml` ; seul le job `livrer` le reçoit)
et, sur le serveur de test, le fichier `secrets/github-actions-token` (jeton fine-grained, ce dépôt seulement : *Actions* en écriture), pas à
pas dans [`deploy/vps/README.md`](../deploy/vps/README.md). Chaque mise à jour consomme environ quatre passages de la CI (préparation, PR,
livraison, publication) en minutes GitHub Actions ; une simulation, un seul (la préparation).

### Mise à jour depuis la base source (lot 8)

PR B du lot 8 (« Bascule 1 : la base du site de dev fait foi », `docs/chantier-base-de-dev.md`, garde-fous 4, 8, 9, 10 et 14 ; question 9). Code : `serveur/paquet.mjs`,
`serveur/notes-de-version.mjs` (`controlerLeLancement`, `lireLot`), `serveur/api.mjs` (`figerUnPaquet`), `scripts/mise-a-jour-paquet.mjs`, `scripts/mise-a-jour-github.mjs`,
`.github/workflows/mise-a-jour.yml` ; tests : `serveur-paquet`, `mise-a-jour-paquet`. **Tout est éteint sans le marqueur `db/source`** (« Base source (lot 8) ») : le lot figé du
journal, son rejeu et la note écrite par GitHub restent ceux décrits plus haut, à l'identique.

**Le paquet.** Avec le marqueur, « Effectuer la mise à jour » et la Simulation (`POST /api/mise-a-jour/lancer/`), et « Copier vers le dépôt » (`POST /api/mise-a-jour/copier/`),
figent un **paquet** au lieu d'un lot : un fichier SQLite **neuf**, fabriqué dans un fil à part comme l'extrait (`fabriquerExtrait` : le schéma de la base source, ses tables de
contenu, les tables calculées telles quelles, les tables propres au site **vides** — ni fiche, ni compte, ni groupe, ni journal —, les modifications en attente versées dans
`historique_modification` avec leur nature, sans auteur). Le service y écrit ensuite :
- mise à jour et simulation : la **note de version** de la version en préparation (`version_cible` de la page, X+1.0 case « Version majeure » cochée ; la page envoie celle
  qu'elle a montrée, `409` si une autre partirait), calculée comme avant (la base publiée par la production comparée au contenu du paquet, plan des Règles du paquet), avec le
  champ libre ; les notes d'exemple retirées ; les lignes d'historique versées prennent la version de cette note. La date de la note est celle du jour (UTC) ;
- copie : rien de plus. Ses lignes d'historique gardent une version vide (la règle de `db:appliquer-edition`), et ses modifications **restent en attente** dans la base source.

Une vue `paquet_meta` le décrit (`format` `maverick-paquet/1`, `id` du lot, `mode` `mise-a-jour` | `simulation` | `copie`, `version`, `depuis`, `majeure`, `fabrique_le`,
`version_du_site`, `schema`, `empreinte` du contenu, `lots` versés, `modifications`, `lignes` de la note, `tables_de_contenu`). Il est rangé dans `db/mise-a-jour/<lot>.db`
(un paquet à moitié fait, `.<lot>.db.neuf`, est effacé ; au-delà des 3 plus récents, `PAQUETS_GARDES`, les paquets sont effacés, sauf un paquet de mise à jour pas
encore reporté, et un paquet livré est d'abord gardé sous `db/archives/paquets-livres/` : « Bascule 2 : préparation »), son SHA-256 est l'`empreinte` du lancement, et il est servi **octet pour octet** à la même adresse qu'un lot,
`GET /api/mise-a-jour/lots/<lot>/` (classe ouverte, comme avant : le job `preparer` n'a aucun secret ; l'adresse ne sert que le lancement en cours). **La base source n'est
pas écrite** (garde-fou 8 : « préparée, pas livrée ») : seul `note_version_brouillon.lot`, le verrou du texte, est posé quand le paquet est prêt — jamais pour une copie, dont
le texte libre reste à la prochaine note. Mêmes états, mêmes verrous et même cadence que le lot figé (`controlerLeLancement` : mot de confirmation, place libre, aucun lot
figé, 2 minutes et 8 par 24 h, « Rien à livrer » sauf pour une copie) ; un seul paquet en fabrication à la fois (`409`) ; le texte ou la case « Version majeure » changés pendant la
fabrication font refuser (`409`, relancer). Le lancement porte en plus `paquet: true`, `mode`, `copie`, `octets`, `lignes`. Une copie ne met rien en maintenance
(`maintenance.mjs#annonceDuLancement`), n'a pas de `version_cible`, et son mot de confirmation est `COPIER VERS LE DEPOT` (`confirmation_copie`).

**Refus avant l'envoi**, pour les trois modes, avant tout déclenchement : l'attestation de la production doit décrire le contenu qu'elle publie (`etatDeLaProduction` : `a_jour`) ;
absente, illisible ou périmée (version ou contenu différents, livraison en cours) : `409`, `refus: { raison: 'attestation', etat, raison_production, message }`, rien n'est fabriqué.
**Un élément de règle retiré qu'une fiche de la production utilise ne fait jamais refuser** (décision R280, question 9 du plan) : la production adapte la fiche
à l'installation et le note dans ses notes, comme dans l'ancien circuit (« Quand une livraison change les règles », plus haut : retraits R42 et suites, `serveur/fiches-retraits.mjs#RETRAITS`).
Le paquet porte le même contenu que l'ancien lot une fois rejoué : à l'étape 1, la production reçoit toujours ses règles par `data/rows` et refait sa base comme avant.
Limite, gardée par le propriétaire (**R292**, option C : « le blocage actuel est gardé ») : une race, une classe ou une magie retirée (hors des tables de `RETRAITS`) n'est pas retirée des fiches ; la production garde alors sa base d'avant
(la mise à jour ne s'applique pas à la production), et l'équipe prévient le propriétaire **avant** de livrer. Aucun retrait automatique pour ces éléments. Ce que le service dit avant la livraison : `GET /api/mise-a-jour/` porte
`retraits_bloquants` (`attestation.mjs#retraitsBloquantsPourLaProduction`) : `{ connu, attestee_le, elements: [{ table: 'race' | 'classe' | 'magie', id, nom, libelle, fiches }], fiches_au_moins, fiches_au_plus, message }`, d'après les `citations` de
l'attestation de la production comparées à la base du site de dev ; `fiches` est le nombre de fiches distinctes qui citent l'élément, `fiches_au_moins` (le plus cité) et `fiches_au_plus` (la somme) encadrent le nombre de fiches touchées (une fiche peut citer
plusieurs éléments retirés) ; `connu: false` : l'attestation n'est pas lue (rien à dire) ; `elements` vide : rien ne bloque. Des nombres et le nom de l'élément (contenu public), jamais une fiche. La répétition (`repetition-prod`, « Répétition de la mise à jour de la production »)
le dit aussi : `REFUSEE`, avec le problème `personnage.race_id = « … » absent de race (N ligne(s))` par table et colonne (test `repetition-prod`).

L'attestation est réécrite toutes les heures (ses `citations` informent, elles ne font plus refuser).

**Le workflow.** Le service envoie l'entrée `copie: 'true'` pour une copie seulement (un lancement d'avant ne change pas). Le job `preparer` reconnaît un paquet à son en-tête
SQLite (`estUnPaquet`), vérifie l'empreinte, lit `paquet_meta` (`lirePaquet`) et refuse un mode qui ne correspond pas aux entrées, dans les deux sens (`verifierSimulation`,
`verifierCopie` ; `essai` et `copie` ensemble : refusés). Il le pose dans l'artefact (`paquet.db` au lieu de `lot.json`), puis lance `scripts/mise-a-jour-paquet.mjs` au lieu du
rejeu, qui **recontrôle** et tire `data/rows` du paquet :
1. le lot et le mode attendus ; la structure (`user_version` du fichier et de sa vue) égale à `data/rows/VERSION` (code 5) ; la note de ce lot, à la version que donnent dev et
   master (`versionDeLivraison`, comme le bot ; code 6), aucune pour une copie ;
2. aucune ligne dans une table ni de contenu ni calculée (fiches, comptes, groupes, journal, brouillon ; code 2) ;
3. ni HTML brut ni lien non sûr **ajouté** par rapport à `data/rows` (pages, annonces, blocs : `texteNonSurApresLeRejeu`, la règle du rejeu ; code 3) ;
4. `data/rows` réécrit par l'exporteur des importeurs, dans une copie d'abord ; toute table changée doit être une table de contenu du paquet, et avoir au moins une **trace
   nouvelle** dans `historique_modification` (une ligne `(lot_id, rang)` absente de celui de `data/rows`), ou en découler comme au rejeu d'un lot (`tablesDuLot` sur ces
   traces : sources de maîtrise, règles du don, armures calculées, filles et balises d'un mot-clé retiré) ; les tables des notes en sont exemptées. La table `page` se juge
   page par page (`pagesSansTrace`) : la trace de sa ligne, un mot-clé retiré, ou — pour une page typée que le code refait depuis ses tables, seulement sur ses colonnes
   dérivées (`edition.mjs#colonneDerivee`) — une trace d'une autre table ; une page libre (guide, lore) changée sans la trace de sa ligne est refusée (code 4, tables et pages nommées) ;
5. seuls les fichiers changés sont écrits. Puis les mêmes `CONTROLES` qu'aujourd'hui, le même commit, le même artefact.

**Pages d'exemple** (fixtures `statut = 'example'`, pas du lore) : le site de dev n'en a aucune, `data/rows` les garde. Un paquet qui n'en a aucune est recontrôlé et
exporté depuis une **copie de travail** qui reçoit celles du dépôt (`data/pages-d-exemple.sql`, `scripts/mise-a-jour-github.mjs#paquetAvecLesExemples`), au job `preparer`
(`appliquerPaquet`) comme au job `livrer` (`verifierContrePaquet`, qui réexporte la même copie). Identiques à celles de `data/rows`, elles ne changent aucun fichier et
n'excusent rien : une vraie page changée sans trace reste refusée (code 4) ; le paquet fourni n'est jamais modifié (`test/mise-a-jour-paquet-exemples.test.mjs`).
Sans cela, « Copier vers le dépôt » depuis le site de dev était refusée (code 4 : les pages d'exemple absentes du paquet, sans trace).

La liste blanche du job `livrer` est alors celle des **tables de contenu du paquet** (`tables_de_contenu`, couvertes par l'empreinte de l'entrée), plus les tables des notes ;
en plus, `livrer` **réexporte le paquet** (`tools/db/exporter.py`, Python et sa bibliothèque standard seulement, aucun npm) dans un dossier temporaire et compare octet pour
octet les `data/rows/*.sql` du commit de l'artefact à cet export (`verifierContrePaquet`) : mêmes fichiers des deux côtés, même contenu ; tout écart (un fichier retiré compris) est un refus net, rien n'est poussé. Le reste de `livrer` ne change pas. Une copie : commit et PR « Copie du contenu du site de dev vers le dépôt (lot …) », corps du commit `Copie : <id>` (jamais `Lot : <id>`,
si bien qu'une copie dans `dev` ne bloque aucune mise à jour : `lotsEnAttente`), fusion dans `dev` seulement ; l'étape « Livraison vers master » est sautée
(`if: ${{ !inputs.copie }}`) et le script la refuse de toute façon (`etat: 'copie'`). Le contenu copié part en production avec la prochaine livraison `dev` → `master`.

**Report après la confirmation** (`paquet.mjs#actualiser`, appelé à la place d'`actualiserLancement` par la page et par la minuterie du service). Quand la base publiée par la
production porte la note d'un paquet rangé (celui du lancement, ou un plus ancien que la production n'avait pas encore installé quand un autre lancement a pris la place) (`noteLivree` ; la copie de master seulement si la production n'est pas configurée sur ce site), le service écrit dans **sa** base, d'une
transaction (`reporterPaquet`) : la note, ses lignes et l'historique du paquet (une ligne déjà là sans version prend celle de la note), les notes d'exemple retirées, les
modifications livrées passées `integree` (`integrerLivrees`), le brouillon de ce lot vidé (`viderBrouillonLivre`) ; puis l'état `termine` (`reporte_le`, `report`).
Idempotent : une note déjà là n'est pas réécrite (un redémarrage entre le report et l'état). Un échec garde l'état, dit `erreur_report`, et se retente au prochain suivi.
Une copie n'écrit **rien** dans la base source, ni à son installation : ses modifications restent en attente ; la mise à jour suivante les verse avec sa version, et la ligne de
`data/rows` versée sans version par la copie prend alors cette version. La note reste juste : elle compare la production au contenu, pas au journal.

### Bascule 2 : préparation (lot 11, allumée le jour J)

PR 1 du lot 11 (`docs/chantier-base-de-dev.md`, §9 garde-fous 4, 17, 18). Code : `serveur/base-source.mjs` (`estEnBascule2`), `serveur/paquet.mjs`, `serveur/activation.mjs` ; tests : `serveur-bascule-2`, `serveur-activation`.
- **Interrupteur.** Le fichier `db/bascule-2`, à côté de `db/source` et lu comme lui à chaque fois (`service.bascule2`), seulement avec la base source ; **rien ne le pose** dans le code (un script de root, plus tard). Absent : les deux refus ci-dessous n'existent pas et le service est celui du lot 8.
- **Fiche d'identité** (toujours écrite, avec ou sans l'interrupteur) : trois colonnes ajoutées à la fin de `paquet_meta`, format `maverick-paquet/1` inchangé (`lirePaquet` et `mise-a-jour-paquet.mjs` lisent des colonnes nommées) : `commit_du_code` (`version.commit` de `_serveur/version.json`, `null` tant qu'elle n'en porte pas : un build normal ne la donne pas, le « kit seul » de la PR 4 la donne), `empreinte_du_code` (l'empreinte du code, 16 hex) et `empreintes` (JSON `{ table: sha256 }`, une par table de contenu, celles de l'empreinte globale ; `lireMetaDuPaquet` la rend décodée).
- **Garde-fou 4** (mise à jour et simulation ; pas « Copier vers le dépôt »). La version qui tourne (`service.etat().version`) doit être la plus haute livraison de test publiée (`creerGithub#etiquettesDeLivraison`, `GET /releases?per_page=30`, brouillons exclus ; même forme `VX.Y.Z[-suffixe]` et même comparaison que `mise-a-jour.sh`, régénération comprise, sauf que la version d'un service n'a pas de `-rebuild.N` : sans suffixe, seuls X.Y.Z comptent). Sinon `409 refus: { raison, version_en_cours, derniere_livraison, message }` : `code_pas_a_jour` (dire les deux versions ; attendre l'installation, au plus 5 min, ou `sudo sh /srv/maverick-center-test/mise-a-jour.sh`) ; `code_inconnu`, avec une `cause` : `jeton` (pas de client GitHub, pas de jeton, réponse 401 ou 403 : « poser ou renouveler le jeton GitHub du site de dev, `MAVERICK_GITHUB_JETON_FICHIER` »), `injoignable` (réseau, délai, 5xx : « réessayer dans 5 minutes »), `aucune_livraison`, `version_illisible`, `version_en_avance`. Posé après l'attestation, avant toute fabrication, la place du paquet étant prise avant la lecture de GitHub (deux lancements rapprochés : un seul passe, l'autre `409`).
- **Garde-fou 18** (mise à jour et simulation). `controlerLeContenu` tourne sur le paquet fini, dans le fil qui le fabrique (`controleDuContenu`) ; un problème refuse : `409 refus: { raison: 'contenu', total, problemes: [{ table, id, regle, message }], message }`, les 20 premiers nommés (`PLAFOND_DES_PROBLEMES`), `total` exact. `controlerLeContenu` rend en plus `emplacements[i]` (table, identifiant de la ligne, règle de `problemes[i]`) ; `problemes` ne change pas pour ses autres appelants. Rien n'est rangé ni noté.
- **Garde-fou 17** : `serveur/activation.mjs#controlerLActivation({ kit, paquet, production })` → `{ ok, refus: [{ raison, message }] }`, pur (objets déjà lus, aucun fichier), sans appelant avant la PR 5. Raisons : `kit_sans_paquet`, `empreinte`, `structure`, `note_manquante` (par version de note), `version_en_arriere` (égale ou plus ancienne que la production).

**PR 2 : le gel, les kits et les paquets gardés** (garde-fous 16 et 19, `docs/chantier-base-de-dev.md` §9). Code : `serveur/gel.mjs`, `serveur/paquet.mjs#garderLesPaquetsLivres`, `deploy/installateur/gel.sh`, `deploy/installateur/mise-a-jour.sh` ; tests : `serveur-gel`, `deploy-gel`, `serveur-paquets-livres`, `mise-a-jour` ; le gel des fusions : `docs/flux-git.md`, « Gel des fusions pendant une mise à jour ».
- **Gel des écritures (garde-fou 16).** Un fichier `db/gel.json` (`{ format: "maverick-gel/1", pose_le, jusqu_a, motif, geste }`), posé par root avec `sudo sh /srv/maverick-center[-test]/gel.sh poser [--duree <minutes, 60 par défaut, 240 au plus>] [--motif <texte>]`, gèle les écritures de `/api/` **sur l'instance où il est posé** (le même code sert les deux). **Éteint par défaut : sans fichier, `traiter` ne change rien** (le test le prouve). Non échu : toute écriture répond `503` avec un corps `{ erreur, gel }` qui dit jusqu'à quand, pourquoi, et le geste qui lève le gel (`sudo sh <instance>/gel.sh lever`, écrit par `gel.sh` dans le fichier, sinon le geste par défaut de l'instance), plus `Retry-After` (300 s au plus). Les lectures restent ouvertes. Écritures **exemptées** (`ROUTES_EXEMPTEES`, chacune avec sa raison, aucune n'écrit de contenu ni de fiche) : la connexion et la déconnexion (`POST` et `DELETE /api/acces/`), `POST /api/classeur/` (lit une feuille Google), la balise des pages vues (métriques, jamais la base vivante), les lectures faites en `POST` de `/api/edition/` (`lignes`, `race`, `classe`, `bestiaire`, `portrait`, `evenement`) et `POST /api/maintenance/lever/` (retire l'annonce partagée). Tout le reste est gelé, une route nouvelle ou inconnue aussi : fiches, `/api/v1/`, édition, lots de changements (dépôt, essai, appliquer, refuser, annuler), mise à jour (lancer, copier, libérer, brouillon, case majeure, conflits). L'écran de maintenance, lui, ne bloque aucune écriture : c'est le gel qui le fait.
- **Il survit à une relance et se lève seul.** Le gel est le fichier : un service relancé le relit. Le fichier est relu quand sa signature (inode, taille, date de modification) change (un `stat` par requête d'écriture et par tour de la minuterie, jamais une lecture inutile) ; l'échéance se compare à l'horloge à chaque appel. Échu : ignoré (le fichier reste, `gel.sh lever` le retire), noté **une fois** au journal du service (catégorie `gel`, évènement `gel` des métriques : `pose`, `echu`, `leve`). Une écriture gelée n'est ni une erreur 5xx des métriques ni une ligne du journal de la production. `GET /api/etat/` porte `gel` (`{ pose_le, jusqu_a, motif, geste, illisible, plafonne }`, `null` sans gel) ; `geste`, un chemin de l'hôte, y vaut `null` en production et pour un visiteur sans droit de lecture du site de dev (le corps du 503 d'une écriture suit la même règle : échéance et motif toujours, geste seulement avec le droit de lecture du site de dev). **Le report d'une livraison lancée avant le gel** (`actualiser` → `reporterPaquet`, appelé par `GET /api/mise-a-jour/` et la minuterie) **reste admis pendant un gel** : il n'est pas une requête d'écriture, et il ne fait que verser dans la base une note que la production a déjà publiée.
- **Prudence.** Fichier illisible, trop gros (8 Kio), pas un fichier ou sans `jusqu_a` valide : gel tenu, **2 h au plus** après sa date de modification, et le message le dit (« par prudence »). Une échéance plus lointaine que 4 h après la date de modification est ramenée à 4 h (`plafonne`) : `gel.sh` pose 240 minutes au plus, et un gel ne tient jamais indéfiniment.
- **`gel.sh poser | lever | etat`** : POSIX `sh`, lancé en root par `sudo sh`, livré **à la racine des deux instances** (production comprise) par l'installateur (`FICHIERS_LIVRES` de `fabriquer.mjs` ; une ligne de plus dans la boucle de `installateur.sh` qui pose déjà `bascule.sh` et `repetition-prod.sh`). Écrit un fichier provisoire `db/.gel.XXXXXX` (`mktemp`, nom imprévisible) puis le renomme (le service ne lit jamais un fichier à moitié écrit), en 644 : lisible par le conteneur, qui ne l'écrit jamais. Durée hors de 1 à 240 : refus (code 2) qui dit les bornes. Il ne touche ni la base, ni le service, ni `GELER` (que `bascule.sh geler` pose pour arrêter les mises à jour automatiques et le service du site de dev).
- **Garde-fou 19 : les kits et les paquets livrés dans la sauvegarde.** (1) Les **10 derniers** paquets de mise à jour **livrés** (sa note est dans la base : la V X.Y de la production ; `PAQUETS_LIVRES_GARDES`, réglable) sont liés (`link`, sinon copiés) sous `db/archives/paquets-livres/<X.Y>-<lot>.db` quand leur report passe (`actualiser`) et avant tout élagage (`purgerLesPaquets`) : ils survivent aux `PAQUETS_GARDES`, le plus récent n'est jamais retiré, et le 11e fait sortir le plus ancien. Les plus anciens restent dans l'historique de la sauvegarde hors du serveur (les copies étiquetées par version, `keep-tag version`, gardées sans limite). `db/archives/` part avec la copie (`copie.sh` : aucune base à contrôler dans `archives/`, ses fichiers copiés tels quels, liens durs d'une copie à l'autre ; `envoi.sh` : la copie entière, chaque nuit). Une simulation ou une copie vers le dépôt (pas de note) n'est jamais gardée. **Actif sans interrupteur** : rien de ce que le service sert ne change. Place : un paquet pèse environ un extrait (~31 Mo) ; tant qu'il est aussi dans `db/mise-a-jour/` le lien dur ne coûte rien, ensuite ~31 Mo, soit **~310 Mo au plus** (bien sous le plafond des copies locales, `PLAFOND_MO`, 4096 Mo). (2) `mise-a-jour.sh` garde les **trois** derniers installateurs installés dans `installateur-courant/` (`INSTALLATEURS_GARDES`, 3 par défaut), le plus récent n'étant jamais retiré : relevé des assets GitHub (2026-11-18) ~97,5 Mo par installateur de test, kit compris, ~35,4 Mo par installateur de production, donc ~290 Mo et ~106 Mo au plus par instance au lieu de ~97 Mo et ~35 Mo.

**PR 3a : la répétition complète du jour J** (`deploy/installateur/repetition-bascule-2.sh`, `scripts/repetition-bascule-2.mjs` livré dans `_serveur/scripts/`, `deploy/installateur/atelier/conteneur.sh` étendu ; tests : `repetition-bascule-2`, `deploy-repetition-bascule-2`, aide `aide-repetition-bascule-2.mjs`). Elle rejoue sur des **copies**, sans rien activer, ce que fera la production le jour J ; posée par l'installateur de test à la racine de l'instance, comme `repetition-prod.sh`, lancée en root : `sudo bash /srv/maverick-center-test/repetition-bascule-2.sh [--depuis-la-sauvegarde] [--garder]`.
- **Préalable (leçon 4 du jour J de la bascule 1).** L'atelier est installé (`atelier/reglages.env`, `atelier/outils/{lib.sh,conteneur.sh}`, que root ne source ni ne lance que s'ils sont à lui), et la version installée du site de dev (`VERSION`, `version=`) est celle du kit (`atelier/kit/kit.json`) ; sinon code 2 avec les deux versions et le geste (« attendre l'installation de la dernière livraison, au plus 5 min, ou `sudo sh /srv/maverick-center-test/mise-a-jour.sh` »). Pas de kit : refus avec le geste (installer l'atelier). Le verrou de l'atelier (`atelier/.verrou`, `flock -n`) est pris pour toute la répétition : une fabrication de l'atelier en cours la refuse (code 2, geste : attendre, `installer.sh --etat`), et `lancer.sh` refuse de démarrer pendant la répétition (il se retrouve à la fabrication suivante : le script le dit si la marque a changé). Avant le verrou, l'attestation de la production doit être visible du site de dev (incident du 2026-11-19) : `attestation-prod.json` dans le dossier des métriques que monte son conteneur (`metriques_de_l_instance dev` de `sauvegarde/lib.sh` : `docker inspect`, sinon `MAVERICK_DOSSIER_METRIQUES` de son `.env`), par un `stat` seulement (fichier régulier, non lien : garde-fou 20) ; sinon code 2 avec le geste (ajouter `MAVERICK_DOSSIER_METRIQUES=<dossier des métriques de la production>` au `.env` du site de dev, puis `docker compose up -d`). `bascule.sh etat` dit la même chose, sans refus.
- **Étape A, dans un conteneur du code du site de dev** (`docker compose run --rm --no-deps -T` du service `serveur`, comme `repetition-prod.sh`). Le contenu à livrer est un **paquet** en mode `simulation` (`serveur/paquet.mjs#fabriquerPaquet`), pas un extrait : le jour J la production reçoit un paquet (la note de la prochaine version, les notes d'exemple retirées, la fiche d'identité) et le garde-fou 17 lit sa version, sa structure et ses notes. `fabriquerPaquet` est pur : rien n'est écrit dans la base source ni dans `db/mise-a-jour/` (le paquet est `<travail>/contenu/paquet.db`, 644). La référence de la note est ce que la production publie (`/production`, monté explicitement par le script : `-v <--prod>/site:/production:ro`, donc la même production que la copie ; `donnees/maverick.db`, `_serveur/version.json`, comme le bouton) ; la version est `versionDeLivraison(version du code, version de la production)`. Puis : `controlerLeContenu` sur le paquet (garde-fou 18 : comptes, table, identifiant et règle, jamais un texte) ; `controlerLActivation` (garde-fou 17) avec le kit décrit par sa version (`kit.json`) et sa structure (le `PRAGMA user_version` de `kit/data/schema.sql`), le paquet fabriqué et les notes de la copie de la production ; enfin la base de la production refaite avec ses fiches, comme `repetition-prod.mjs` (`preparerBaseVivante` en mode production, avec le paquet pour contenu : `repeter({ contenu })`). Tant que `kit.json` n'annonce pas son paquet, l'empreinte annoncée est celle du paquet fabriqué : le refus `empreinte` n'est pas éprouvé par la répétition (il l'est par `serveur-activation`). Un refus de l'étape A arrête avant l'étape B ; tout ce qui refuse à l'étape A est dit d'un coup.
- **Étape B, les pages.** Tout le site de la production est fabriqué depuis le paquet avec le kit, dans un conteneur de l'image `kit.json#image`, sous les règles de l'atelier : `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534:65534`, `--cpus`, `--memory` et `--memory-swap` égaux au plafond calculé par `calculer_le_plafond` de `outils/lib.sh` (le même fichier, sourcé : rien n'est recopié), tranche `maverick-atelier.slice` si elle existe, `SITE_MODE=prod`, `HIDE_EXAMPLES=1`, `SITE_TAG=vX.Y` (la version du paquet), `HOME` et `TMPDIR` sous `/travail`. Le conteneur est `outils/conteneur.sh` de l'atelier, étendu par deux variables sans effet pour l'atelier : `CONTENU_FICHIER` (le paquet monté en lecture seule sur `/contenu`, copié par le conteneur : `dd` sous délai, refus d'un lien, d'une FIFO ou d'une taille inattendue) et `MODE_REPETITION=1` (ni comparaison avec le site livré, ni copie vers la sortie : le site est jugé là où il est fabriqué, sur le **même montage que le kit** copié, leçon EXDEV, puis effacé ; le nombre de pages `.html` est écrit dans `resultats/pages.txt`). Refus avant la fabrication, avec les chiffres de l'atelier et son geste : `memoire_insuffisante`, `marge_insuffisante` (`dire_la_memoire`), disque sous le minimum. Pendant la fabrication : pic de mémoire (cgroup, sinon `docker stats`), disque (le conteneur est arrêté sous le minimum), délai (`DELAI_S`). Échec, `OOMKilled` ou délai : `REFUSEE` avec le geste ; la fin du `docker logs` (200 Ko) est gardée dans `<dev>/var/repetition-bascule-2-journal-du-conteneur.txt` (le serveur de test, pas le dossier de travail, effacé) et ses 15 dernières lignes sont montrées.
- **Garde-fou 20.** Root ne fait que des `stat` (le paquet : fichier régulier non lien, plafond de l'atelier) et ne lit, après `docker rm -f`, que des fichiers réguliers de 256 Ko au plus (`fabrication.json`, `pages.txt`) pour en tirer des **chiffres** (`sed` sur des expressions à chiffres seulement) ; la version du paquet (`@@version-paquet=X.Y`, dernière ligne de l'étape A) est validée de même. Les sorties du conteneur ne sont jamais interprétées, et l'extrait du journal affiché est privé de ses caractères de contrôle.
- **Sortie** : des comptes seulement (tables contrôlées, problèmes par table, identifiant et règle, fiches adaptées par nature, pages et fichiers fabriqués, durées, pic de mémoire du conteneur et d'un processus, plafond) ; dernière ligne `repetition-bascule-2 : == la bascule PASSERAIT` (code 0), `== REFUSEE : <raison>` (code 1 : étape A, mémoire, disque, échec ou dépassement de l'étape B ; chiffres et geste dits), `== IMPOSSIBLE : <raison>` (code 2 : usage, préalable, verrou, dossier, place, outil). La base de la production et celle du site de dev ne sont jamais écrites ; le dossier de travail (`<dev>/var/repetition-bascule-2.*`, 700) est effacé à la fin, `--garder` le garde avec l'avertissement « il contient les fiches de la production ». Place demandée : 4 fois la base de la production, 2 fois celle du site de dev, 2 fois le kit, le minimum de disque de l'atelier, 64 Mo.
- **Livré avec le service** : `scripts/repetition-bascule-2.mjs` et `serveur/activation.mjs` (le garde-fou 17, sans appelant dans le service avant la PR 5) sont des `FICHIERS_JOINTS` ; un test vérifie que le script n'importe que des modules livrés. Deux points de vigilance : une base de site de dev qui porterait la vue `extrait_meta` (un extrait pris pour des règles) fait refuser `fabriquerPaquet` (« view extrait_meta already exists ») ; le plafond de mémoire et le pic se lisent sur le serveur, jamais sur une machine d'essai.

**PR 3b : l'atelier sert ce qu'il fabrique** (`deploy/installateur/atelier/{lancer,installer,lib}.sh`, `scripts/poser-un-site.mjs` (livré dans le kit), `serveur/atelier.mjs`, `src/lib/debug-atelier.mjs`, `src/lib/atelier-bilan.mjs` ; tests : `deploy-atelier`, `poser-un-site`, `serveur-atelier`, `debug-atelier`, `atelier-bilan`). **Éteinte par défaut.**
- **L'interrupteur** est le fichier `<instance>/atelier/servir`, à root (le fichier est la preuve, comme `reglages.env`) : `sudo sh /srv/maverick-center-test/atelier/installer.sh --servir [--pages-minimum <pct>]` le pose (avec `rapports/servir.json`, que le service lit pour la page Debug, et le minuteur du contenu) ; `--ne-plus-servir` le retire (et le minuteur) ; `--retirer` aussi. Il porte `SERVIR_DEPUIS` et `PAGES_MINIMUM_PCT` (90 par défaut), relus champ par champ. Sont exigés : l'atelier installé, un kit qui porte `client/scripts/poser-un-site.mjs`, et **la base source** (`db/source`, posé par `bascule.sh`) : sans elle, chaque pose changerait `donnees/maverick.db` et le service referait la base vivante (les saisies du site de dev s'y perdraient) ; `--servir` refuse, dit pourquoi et le geste (`sudo bash /srv/maverick-center-test/bascule.sh poser`). **Sans lui, rien de servi ne change** : la fabrication est celle d'avant, `site/` n'est pas touché (un test le prouve octet pour octet), aucun second conteneur ne tourne, le rapport porte `"servi": null`.
- **Poser le site** (seulement avec l'interrupteur, après une fabrication réussie : code 0, ni délai, ni OOM, ni disque). Root ne lit jamais la sortie du conteneur : il lance un **second conteneur**, même image, `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 128`, 512 Mo (`--memory-swap` égal), sous `--user` = **le propriétaire de `<instance>/site`**, délai 600 s. Il ne voit que : le kit (`/kit`, lecture seule), `atelier/sortie` (`/sortie`, **lecture seule** ; le script lit `/sortie/site`, un lien y est refusé *dans* le conteneur), `<instance>/site` (`/site`, écriture) **avec `<instance>/site/_serveur` remonté par-dessus en lecture seule** (`/site/_serveur:ro` : le code que le service exécute ne se réécrit pas d'ici ; un `_serveur` absent ou qui est un lien refuse la pose, `site_absent`) et `atelier/pose` (`/pose`, le résumé). *Ce que peut ce conteneur, exactement :* sur le serveur, `site/` est à root (l'installateur l'écrit en root), donc le conteneur tourne en **uid 0 DU CONTENEUR, sans aucune capacité** (`--cap-drop ALL`, pas de `CAP_DAC_OVERRIDE` : il ne lit que ce que ses droits de propriétaire ou « tous » permettent, ne change ni le propriétaire ni les droits d'un autre, ne crée pas de périphérique), sans réseau, système de fichiers en lecture seule, `no-new-privileges`, 512 Mo, 128 processus, avec **quatre montages** : il peut réécrire les pages et ressources de `site/` (c'est la fonction), et rien d'autre : ni `_serveur/` (lecture seule), ni `db/`, `metriques/`, `maintenance/`, `secrets/`, ni le socket Docker. Ce qui le rend acceptable : le script est celui du kit (monté en lecture seule), il n'obéit à aucun ordre, il refuse tout ce qu'il ne comprend pas, et son pire effet (défigurer le site servi) est celui de la fonction elle-même. *Limite :* une évasion du conteneur donnerait root sur l'hôte ; ce qui la rend improbable est l'absence de capacité, de réseau et d'écriture hors de ces montages. Un utilisateur autre que le propriétaire n'écrirait pas dans `site/` (`EACCES`, essayé).
- **Le script** `scripts/poser-un-site.mjs` (sans dépendance, `node --no-warnings`) : `lstat` partout, jamais de lien suivi ; **refuse** un lien, une FIFO, un périphérique, une socket (83), un `_serveur` dans la source (84), l'absence d'`index.html` (81), un site fabriqué qui compte **moins de 90 %** des pages HTML du site servi (82, `site_trop_petit` : le résumé porte les deux nombres et le minimum), une source illisible (85). Sinon : les ressources d'abord, les pages ensuite, chaque fichier par une copie provisoire dans le même dossier (`.pose-<pid>-<n>.tmp`, mode 0644) puis `rename` ; un fichier identique octet pour octet n'est pas réécrit (« inchangé ») ; ce que le nouveau site n'a pas est **retiré** (fichiers, liens et dossiers de la cible) ; **`_serveur/` n'est jamais lu, écrit ni retiré** (le code du service). Résumé `maverick-pose/1` (`pose.json` : posées, retirées, inchangées, octets, pages fabriquées et servies, minimum, refus) écrit de façon atomique. Un échec en cours de pose (disque plein…) sort en 86 en laissant les fichiers déjà posés (chacun est entier), jamais un fichier à moitié écrit.
- **Garde-fous de root** avant de lancer : `VERSION` (le fichier est à root) et la marque et le kit portent **la même version**, sinon refus `version_differente` avec les deux versions (une installation est arrivée pendant la fabrication) ; le script de pose est dans le kit (`kit_sans_pose`) ; `sortie/site` et `site/` sont des dossiers réels (`site_absent`). Le code de sortie du conteneur de pose (un nombre, par `docker inspect`) dit le motif ; `pose.json` est copié **après `docker rm -f`**, fichier régulier non lien, 256 Ko au plus, **sans être interprété** ; le service le valide. Le journal du conteneur (`journal-de-la-pose.txt`, lecture humaine) reste dans le dossier du rapport.
- **Le rapport** porte `servi` : `{ pose, motif, code_sortie, version_installee, version_de_l_instance, pages_minimum_pct, resume }` (`null` sans interrupteur ou sans fabrication réussie) ; le service le valide (liste blanche, `validerLeServi`, `validerLaPose`, `pose.json` ≤ 16 Ko, jamais un champ inconnu ni un nom de fichier) et joint le résumé dans `servi.resume`. Motifs : `version_differente`, `kit_sans_pose`, `site_absent`, `docker_refuse`, `index_absent`, `site_trop_petit`, `fichier_irregulier`, `serveur_dans_la_source`, `source_illisible`, `echec_de_la_pose`, `delai_de_la_pose`. La page Debug ajoute une ligne « Site servi » (`phraseDuServi` : posé avec ses nombres, ou NON posé avec le motif, les chiffres et le **geste exact** ; pour `site_trop_petit` : `sudo sh /srv/maverick-center-test/atelier/installer.sh --servir --pages-minimum <le pourcentage qui laisse passer>`) et classe un site non posé en « attention ».
- **Les déclencheurs.** (a) la livraison (marque, unité `.path`, inchangée) ; (b) **`maverick-atelier-contenu.timer`**, toutes les 10 minutes, posé par `--servir` (unité `.service` conditionnée au fichier `servir`) : `lancer.sh --origine contenu` ne fabrique que si l'interrupteur est posé ET si l'extrait a changé **depuis le dernier site posé** : root compare seulement le `stat` (nom, taille, date à la nanoseconde de `contenu-<version>.db`) à ce qu'il a noté dans `atelier/declencheur/dernier-contenu` (fichier à lui, écrit **seulement après une pose réussie** ; effacé par `--servir` et `--ne-plus-servir`). Extrait absent, suspect ou inchangé : rien, sans rapport et sans bruit. Plafond propre à l'origine : `MAX_CONTENU_PAR_JOUR` (48 par défaut, `--max-contenu-par-jour <n>`, 1 à 288), compté à part : les fabrications `contenu` ne comptent ni dans les 12 par jour des autres origines ni dans les 10 de la journée type, et n'en subissent pas le plafond ; au-delà, un seul rapport `plafond_du_jour` (origine `contenu`) le dit. Le verrou (`flock`) reste commun. (c) **« le bouton »** : `POST /api/edition/atelier/` (`docs/api.md`) fait refaire l'extrait tout de suite, sans le délai de 10 minutes ; root le voit à sa ronde (au plus 10 minutes), fabrique et pose. Le service ne commande rien : il ne fait que refaire son extrait.
- **Une installation et une pose ne s'écrivent pas ensemble, sauf au-delà de 45 min d'attente** : l'installation pose alors `site/` sans le verrou (noté au journal), et la fabrication de livraison qui suit repose le site fabriqué ; `_serveur` reste en lecture seule pour la pose.
  Détail : l'installateur de test prend, seulement si `atelier/` existe, le même verrou que `lancer.sh` (`flock` sur `atelier/.verrou`, 45 minutes d'attente au plus, puis il continue en le disant) pendant la seule pose de `site/` ; celui de production n'a rien de ce verrou (le script reste le modèle, un test le prouve).
- **Un refus qui ne changera pas** tant que l'extrait ne change pas (`site_trop_petit`, `fichier_irregulier`, `serveur_dans_la_source`) note l'extrait comme une pose réussie : le minuteur ne refabrique pas toutes les 10 minutes ; `--servir` (par exemple avec un autre `--pages-minimum`) efface la note.
- **Retour arrière.** `sudo sh /srv/maverick-center-test/atelier/installer.sh --ne-plus-servir`, puis `sudo sh /srv/maverick-center-test/mise-a-jour.sh --force` (réinstalle la livraison de GitHub, même déjà installée). **Limite :** à chaque installation, le site livré par GitHub revient jusqu'à la fabrication suivante (la marque de l'installateur déclenche une fabrication de l'atelier, qui pose si l'interrupteur est posé) ; entre-temps, le site servi est celui de GitHub.

**PR 4 : GitHub ne publie que des kits, le commit de lot sans contenu, le correctif urgent en code seul** (`tools/flux-git/bascule-2.mjs`, `client/scripts/mise-a-jour-github.mjs#identiteDuPaquet`, `controler-le-contenu-ecrit-lib.mjs#refusDeLIdentite`, `deploy/installateur/{fabriquer.mjs,kit-seul.sh,kit.mjs}`, `client/serveur/livraison.mjs`, `.github/workflows/livraison.yml` ; tests : `flux-git-bascule-2`, `mise-a-jour-identite`, `scripts-controler-le-contenu-ecrit-paquet`, `deploy-kit`, `deploy-kit-seul`, `serveur-livraison` ; flux : `docs/flux-git.md`, « Ce que GitHub publie avec la bascule 2 »). **Tout est éteint par la clé `actif` de `tools/flux-git/bascule-2.json` (`false`), lue dans `origin/dev`** (le gel des fusions a sa clé, `gel_des_fusions`, indépendante) : éteint, les livraisons, les installateurs (production comme test) et la mise à jour sont ceux d'avant, octet pour octet (`deploy-kit` : « production = modèle » ; `mise-a-jour-identite`, `flux-git-bascule-2` : le cas éteint). Allumé, le test devient un kit seul (PR 4) et la production aussi (PR 5b, ci-dessous) ; la production garde son site complet tant que `activation-par-paquet` manque.
- **Le commit de lot (identité du lot).** Interrupteur allumé sur `origin/dev`, `preparer` écrit `data/paquet.json` dans le commit du lot, **en plus** de la copie de `data/rows` (le secours, inchangé jusqu'au lot 12) : `{ format: "maverick-paquet-identite/1", lot, version, empreinte (sha256 des octets du paquet), structure (le `schema` du paquet), commit_du_code (celui de `paquet_meta`, `null` s'il est inconnu), fabrique_le }`, sans aucun contenu, clés dans cet ordre. Le fichier change à chaque lot (le lot, l'empreinte) : le commit n'est donc jamais vide, **il n'y a plus de « Rien à livrer »** et le code que ce commit porte désigne son paquet. Une simulation l'écrit aussi (elle éprouve le même commit) ; une copie vers le dépôt non (pas de version, pas un lot). La préparation annonce `identite: true` ; `livrer` l'exige alors dans la liste blanche (`verifierCommit`, seul fichier de plus, mode `100644`) et recalcule l'identité du paquet : elle doit être celle du commit **octet pour octet** (`verifierIdentite`) ; à tout autre moment `data/paquet.json` reste un fichier refusé. Un interrupteur illisible arrête la préparation.
- **Le contrôle du contenu écrit** (`controle-du-contenu-ecrit`, lu aussi sur `bascule-2.json`) : éteint, il ne voit pas ce fichier. Allumé, **`paquet-a-la-main`** : `data/paquet.json` ne change que dans un commit du workflow (branche `feature/mise-a-jour-regles-…`, `github-actions[bot]`, ligne `Lot :` ou `Copie :`), qui peut porter `data/rows/` et lui, rien d'autre ; et **`correctif-urgent`** refuse un `hotfix/*` qui le porte (en plus de « ni contenu ni structure », règle d'avant). Ces règles ne dépendent pas de l'interrupteur de la bascule 1.
- **Le kit annonce son paquet.** `kit.mjs` lit `data/paquet.json` de la racine s'il existe et écrit dans `kit.json` `paquet: { lot, version, empreinte, structure }` (la structure de ce paquet) ; absent : `paquet: null`. `kit.json#structure` est celle du kit lui-même (`PRAGMA user_version` de son `data/schema.sql`, `null` s'il ne s'y lit pas) : le garde-fou 17 (`activation.mjs`, qui lit `kit.paquet.empreinte`) refuse (`structure`) un paquet reçu d'une autre structure que le kit, ou un kit dont le paquet annoncé en a une autre. Illisible ou d'une autre forme : le kit n'est pas fabriqué. Le fichier n'entre pas dans le kit (l'empreinte du kit ne change pas).
- **`version.json` porte le commit.** `livrerServeur(dist, { commit })` l'écrit quand on le donne (40 hexadécimaux, sinon refus) ; sans lui, `version.json` est celui d'avant. Hors de l'empreinte du code. L'intégration Astro lit `MAVERICK_SHA`, **pas `GITHUB_SHA`** (sur l'événement d'une PR fermée, ce n'est pas le commit livré) ; le « kit seul » le donne par `--sha`. Seul `service.mjs` le lit (`version.commit`), pour `commit_du_code`. Tant que le site de dev n'a pas installé un kit seul (ou un build qui le donne), les paquets gardent `commit_du_code: null`.
- **L'installateur « kit seul »** (mode test) : `fabriquer.mjs --kit <racine> --kit-seul` (sans `--site` ; la production : PR 5b) fabrique une archive **sans pages** : `site/_serveur/` livré par `livrerServeur` (sans `donnees/`) et le kit ; son script porte `KIT_SEUL=1`. Ses sections (`kit-seul.sh`) sont insérées à huit lignes repères du modèle, retirées d'un installateur de production qui n'est pas un kit seul (son script reste le modèle, octet pour octet). Il **ne pose que `site/_serveur/`** (le reste de `site/` reste tel quel : l'atelier le refait), puis les fichiers de l'instance, le kit et la marque comme toute installation de test. **Refusé, avant toute écriture, sur une instance sans `atelier/servir`** (le site resterait celui d'avant) : le message donne `sudo sh <instance>/atelier/installer.sh --servir`. Un installateur de test ordinaire (`KIT_SEUL=0`) est inchangé.
- **`livraison.yml`.** Le job `version` lit `bascule-2.json` dans `origin/dev` (`bascule-2.mjs lire` ; fichier absent ou illisible : « éteint » et un avertissement, jamais un échec de la version). Allumé : le job `installateur` de **test** ne construit plus le site et appelle `fabriquer.mjs --kit . --kit-seul` ; le job `site` (branche NAS) est sauté ; la **production** : PR 5b. Éteint, ou pour un commit sans `bascule-2.mjs` (un correctif de `master` avant la prochaine livraison) : comme avant. Limite : le job `version` lance le module de la branche de base du passage ; sur un passage de `master` (livraison, correctif) avant que `master` ait ce module, l'interrupteur se lit « éteint » et l'installateur de test fabriqué dans ce même passage reste complet.
- **Le correctif urgent** (`hotfix/*`) ne porte ni contenu, ni structure, ni `data/paquet.json` (contrôle ci-dessus). Son **activation en production, après le contrôle du contenu en place sur le paquet de la production**, est celle de la PR 5.
- **Retour arrière.** Rien n'est à défaire tant que l'interrupteur est éteint. Allumé : le repasser à `false` par une PR vers `dev` ; les installateurs de test suivants redeviennent complets et `mise-a-jour.sh --force` réinstalle le site de GitHub ; `data/paquet.json` déjà fusionné reste (sans effet).

**PR 5a : l'activation en production, ÉTEINTE** (`deploy/installateur/{activer.sh,activation-conteneur.sh,activation-pose.sh}`, `client/scripts/{activation-controles,poser-un-site}.mjs`, `serveur/paquets-de-la-production.mjs`, `bascule.sh poser-bascule-2`, `tools/essai-activation/` ; tests : `deploy-activer`, `activation-controles`, `serveur-paquets-de-la-production`, `installateur-activation`, `bascule`, `poser-un-site`, `serveur-bascule-2`, `deploy-atelier-conteneur` ; `deploy/installateur/README.md`, « Activer un kit avec son paquet » ; `docs/api.md`, « Page Mise à jour : l'activation de la production »). **Rien ne change en production tant que le fichier `<production>/activation-par-paquet` (root) est absent** : `activer.sh` refuse (« éteinte », code 2, avant toute lecture) et le fragment de l'installateur de production (`activation_par_paquet`, `@@ACTIVATION@@`, absent de l'installateur de test) ne fait rien (un test compare le script de production au modèle, fragment compris).
- **Le paquet vers la production** (`serveur/paquets-de-la-production.mjs`). Sur le modèle de `maintenance/` : un dossier de l'hôte, `paquets/`, monté dans les deux services (`MAVERICK_PAQUETS=/paquets`, `docker-compose.yml` : `${MAVERICK_DOSSIER_PAQUETS:-/dev/null}:/paquets${MAVERICK_PAQUETS_OPTION-:ro}`) ; **sans réglage, rien de réel n'est monté** (`/dev/null` en lecture seule : aucun dossier créé, rien d'écrivable : la production garde son service d'avant), `bascule.sh poser-bascule-2` pose dans le `.env` du site de dev le `paquets/` de la production et l'option vide (lecture-écriture). **Seulement avec `db/bascule-2`** le site de dev y dépose `<X.Y>-<lot>.db` (une copie écrite à côté puis renommée, jamais écrasée si elle est déjà là avec la même taille, les trois plus récentes gardées) : quand il fige « Effectuer la mise à jour » (ni la simulation ni la copie : `figerPaquet`, option `paquets`), et le dernier paquet livré de `db/archives/paquets-livres/` après le report d'une livraison (`actualiser`, option `paquets` : de quoi rejouer `--correctif`). Le dossier n'est jamais créé par le service (c'est `bascule.sh poser-bascule-2`, en root) ; un lien à sa place, un nom ou une source irréguliers : rien n'est déposé, le journal dit pourquoi. La production ne lit rien ici qu'avec méfiance : un fichier de ce dossier vient d'un service que n'importe quel visiteur du site de dev atteint.
- **Le marqueur** (`bascule.sh poser-bascule-2`, `retirer-bascule-2`, `etat`). Refusé sans `db/source` ; crée `<production>/paquets/` (755, jamais un lien), ajoute `MAVERICK_DOSSIER_PAQUETS=<production>/paquets` au `.env` du site de dev s'il n'y est pas (le `docker-compose.yml` du site de dev doit déjà monter ce dossier, sinon refus avec le geste), écrit `db/bascule-2` d'un coup (fichier provisoire puis renommage), recrée le service (le volume se lit à la création du conteneur). Le service lit le marqueur à chaque fois : pas de redémarrage. `retirer-bascule-2` le renomme (`db/bascule-2-retire-<date>`, rien n'est effacé, `paquets/` reste), retire du `.env` les deux lignes et recrée le service (le montage redevient `/dev/null`).
- **`activer.sh`** (root, livré à la racine de la production avec `activation-conteneur.sh` : `FICHIERS_LIVRES` de `fabriquer.mjs`, production seulement ; lancé par l'installateur quand `activation-par-paquet` existe et que `activation/kit/kit.json` est posé, ou à la main). Dossier de la production : `activation/{kit/,reglages.env,rapport.json,dernier-paquet.json,en-cours,base-avant/,.verrou,travail.*}`, `paquets/`, `site.precedent/`.
  - **Préalables** (refus chiffrés, rien n'est changé) : root, `VERSION` en mode prod, l'interrupteur, les outils à root, le kit (`kit.json` : version, image, structure, paquet annoncé `{ lot, version, empreinte, structure }` ; ses scripts), l'utilisateur `maverick-site` (propriétaire de `site/`, `_serveur/` à root), le verrou (`activation/.verrou`, et celui de l'atelier du site de dev s'il est pris : le serveur n'a pas la mémoire de deux fabrications), mémoire (règles de l'atelier, mêmes constantes : un test les rapproche de `atelier/lib.sh`) et disque (2 fois le kit, 4 fois le site, 4 fois la base, le minimum de l'atelier). **Le paquet** : nom `<version>-<lot>.db` tiré de `kit.json#paquet` ; root fait un `stat` du fichier (régulier, pas un lien, ni FIFO ni dossier, de 1 octet à 512 Mo) AVANT toute lecture : `paquet_absent`, `paquet_irregulier`, `paquet_trop_gros`. Un kit sans paquet : `kit_sans_paquet` (garde-fou 17).
  - **Conteneur 1, les contrôles** (image du kit, `--network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534`, mémoire plafonnée sans échange, kit et `paquets/` en lecture seule, jamais `db/`, `secrets/`, `metriques/`, `maintenance/` ni le socket) : `activation-conteneur.sh controles` copie le paquet (`dd` sous délai, `iflag=nofollow`, taille revérifiée), puis le CODE DU KIT (`scripts/activation-controles.mjs`) : l'empreinte (sha256 des octets copiés) contre celle du **kit** (la seule à laquelle la production fait confiance), le fichier de contenu (`verifierLeContenu` : base saine, structure du kit, sans fiche ni compte), le mode du paquet (`mise-a-jour`), le contenu réel (garde-fou 18), `controlerLActivation` (garde-fou 17 : structure, notes de version, version) et la base de la production refaite avec ses fiches sur une COPIE (`sqlite3 .backup` de `db/vivante.db`, `repeter` de `repetition-prod.mjs`). Un fichier qui n'est pas une base lisible est `paquet_irregulier`, jamais un plantage. Le résultat est un JSON d'un mot par ligne : root n'en lit, après `docker rm`, que le verdict, des mots d'une liste blanche et des nombres, d'un fichier régulier de 256 Ko au plus ; le texte lisible du conteneur est montré sans caractère de commande.
  - **Le service vient du kit seul** (garde-fou 20) : un conteneur sans paquet ni contenu (`activation-conteneur.sh serveur` : `livrerServeur` du kit, `KIT_VERSION` de `kit.json`) fabrique `_serveur/` ; c'est lui que la bascule pose, **jamais** le `_serveur/` que le conteneur de fabrication a laissé dans le site (que le contenu du site de dev a pu influencer ; la pose des pages l'ignore). Après chaque `docker rm`, root vérifie par `[ -d ] && [ ! -L ]` le site fabriqué et ce service avant tout montage (Docker suit le lien de la source d'un montage) ; la version du service doit être celle du kit.
  - **Conteneur 2, les pages** : `activation-conteneur.sh fabrication` refuse (77) une copie qui n'a pas l'empreinte annoncée, copie le kit et fabrique TOUT le site (`SITE_MODE=prod`, `HIDE_EXAMPLES=1`, `SITE_TAG=vX.Y`) dans `/travail/site`, sur le même montage que le kit (leçon EXDEV) ; refus sous le minimum de pages (90 % du site servi), si la version de son `_serveur` n'est pas celle du kit, si le disque tombe sous le minimum, le délai ou la mémoire. Les deux conteneurs sont supprimés (`docker rm -f`) avant que root lise quoi que ce soit.
  - **La bascule courte** (le gel d'abord : `gel.sh poser --duree 45`, rapport `en_cours`, marqueur `activation/en-cours`) : service arrêté (la base ne bouge plus ; son sha256 est noté et une copie est mise de côté dans `activation/base-avant/`, avec un `-journal` ou un `-wal` resté en place, remis avec elle), `site/` copié dans `site.precedent/` par un conteneur sans capacité (`cp -RP --preserve=mode,timestamps` : sans `CAP_CHOWN`, les propriétaires ne se gardent pas, `site.precedent/` est à root), **pages** posées par `poser-un-site.mjs --sans-le-serveur-de-la-source` sous l'utilisateur `maverick-site` (`_serveur/` remonté en lecture seule par-dessus), **service** posé par `poser-un-site.mjs --serveur` (deux dossiers `_serveur`, un lien refusé, `serveur/index.mjs` et `version.json` exigés, `version.json` posé EN DERNIER) sous root sans capacité, sur `_serveur/` seulement ; puis `docker compose up -d serveur` et le **contrôle de santé** (`/api/etat` par `compose exec`, base disponible et à jour, version = celle du kit ; 300 s au plus, `MAVERICK_ACTIVATION_SANTE`). **Gel de 45 min** : le pire cas de la bascule est la somme des délais des conteneurs (copie 600 s, pages 600 s, service 600 s, santé 300 s : 2100 s), plus le retour ; le gel ne tombe pas en pleine bascule.
  - **Succès** : gel levé, `dernier-paquet.json` (version, lot, empreinte, structure : de quoi rejouer `--correctif`), rapport `passee`, `site.precedent/` gardé jusqu'à la prochaine activation. **Échec à n'importe quelle étape de la bascule, ou signal** (un `trap` sur la sortie : le conteneur en marche est supprimé d'abord, puis) : **retour automatique** : service arrêté, `site.precedent/` reposé (pages puis service, même scripts, `--minimum-pct 0`), la base REMISE depuis `base-avant/` si son sha256 a changé (le nouveau service l'avait refaite), service relancé et sa santé relue (120 s), gel levé, rapport `retour_automatique` ; si une étape du retour échoue : `retour_incomplet`, chaque `ATTENTION` dite, le geste (`--reprendre`, puis la sauvegarde). **`--reprendre`** : rejouer après une correction ; avec un marqueur `en-cours` (le script est mort pendant la bascule), le retour est fait d'abord. **`--correctif`** : le paquet est celui de `dernier-paquet.json` (empreinte comprise), recontrôlé avec le nouveau kit (« la même version » que la production n'est pas un refus ; une autre structure, si) puis les pages refaites ; `correctif_sans_paquet` s'il manque.
  - **Le rapport** (`activation/rapport.json`, aussi `paquets/activation.json` : écrit et mis en 644 DANS `activation/` (à root seul), puis renommé vers `paquets/` (`mv -T` : un lien posé là par le service est remplacé, jamais suivi ; même système de fichiers exigé, `stat -c %d`, sinon pas de rapport partagé) ; root n'écrit ni ne change les droits d'aucun fichier de `paquets/`) : `maverick-activation/1`, des états, des raisons d'une liste fermée (`RAISONS_DE_L_ACTIVATION` ; un test vérifie que `activer.sh` n'en écrit pas d'autres), des versions, des comptes, `phrase` et `geste` (jamais un nom de fiche). Le site de dev le lit (`lireLActivation` : `O_NOFOLLOW`, 16 Kio, liste blanche) et le rend par `GET /api/mise-a-jour/` (`activation_production` : `docs/api.md`) ; la page Debug l'affiche dans Système, bloc « Activation » (`[data-systeme-activation]`, `lib/debug-metriques.mjs#htmlDeLActivation`). `GET /api/debug/systeme/` porte `bascule_2` (lecture seule, toujours sur le site de dev) : les cinq interrupteurs de la bascule 2 en `true`, `false` ou `null` (inconnu, avec sa raison) et ce rapport, même sans le marqueur (`serveur/bascule-2-etat.mjs` ; `gel_des_fusions` et `actif` lus dans `tools/flux-git/bascule-2.json` sur `dev` par l'API de GitHub, en arrière-plan et en cache, jamais attendus ; `docs/api.md`, « l'état de la bascule 2 »).
- **L'utilisateur `maverick-site`** (`activation-pose.sh`, dans l'installateur de production quand `activation-par-paquet` existe) : créé s'il manque (`useradd --system --user-group --no-create-home --shell /usr/sbin/nologin`), `site/` à lui SAUF `site/_serveur/` (à root), par `find -P … -exec chown -h` (garde-fou 20 : jamais un lien suivi ; un test avec de fausses commandes système vérifie les appels). Sans être root : rien, le geste est dit.
- **Preuve de bout en bout** (`tools/essai-activation/`, `README.md` : un monde sous `/srv/essai-activation/`, le VRAI kit de `kit.mjs`, un VRAI paquet de `fabriquerPaquet` fait de l'extrait du jour, le VRAI service de production sous un petit superviseur, les conteneurs sous `setpriv` sans capacité, dans des espaces de noms de montage et de réseau, PATH sans git ; `lancer.sh reussite|refus|retour|retour-base`). Constatés le 2026-11-19 : réussite (code 0 : 1792 pages, service V0.5.20 → V0.5.27, base refaite, `site.precedent/` identique octet pour octet au site d'avant, gel levé) ; refus d'un paquet d'une autre empreinte (code 1 : base, `site/` et service intacts, aucun gel, aucun arrêt de service) ; retour automatique, contrôle de santé raté (code 1 : `site/` et `_serveur/` identiques à l'avant par sha256 de l'arbre, base identique, gel levé, service d'avant de retour) ; retour automatique après que le nouveau service a refait la base (la base remise, sha256 identique). **Non rejoué** : un vrai Docker (images, cgroups : le plafond de mémoire n'est pas imposé, le pic est mesuré), le `sqlite3` de la machine (un remplaçant par `VACUUM INTO`), nginx et Caddy, l'installateur de production lançant `activer.sh` sur un kit posé par lui (le kit de production est celui de la PR 5b), un kit fabriqué par GitHub (`data/paquet.json` : `paquet` de `kit.json` y est posé à la main), `--reprendre` et `--correctif` hors des tests, la durée réelle sur le serveur de 4 Go.
- **Défauts trouvés par cette preuve et corrigés** (le serveur réel les aurait rencontrés) : (1) le kit ne portait pas `sources/copies-drive.json`, que le build lit (`lib/archives.mjs`) : aucune fabrication d'un kit récent ne pouvait aboutir (`kit.mjs` : `A_EMPORTER` et `INDISPENSABLES`) ; (2) le site fabriqué porte le `_serveur/` du build, que `poser-un-site.mjs` refuse (84) : la pose de l'atelier du site de dev aurait toujours été refusée ; `atelier/conteneur.sh` retire ce dossier après la comparaison et avant la copie vers la sortie (`deploy-atelier-conteneur`) ; (3) `cp -a` sous un utilisateur sans capacité échoue (propriétaires) : la copie de `site.precedent/` ne garde que les droits et les dates.
- **Retour arrière.** Rien à défaire tant que l'interrupteur manque. Posé : `sudo rm /srv/maverick-center/activation-par-paquet` ; `bascule.sh retirer-bascule-2` retire le dépôt des paquets. Après une activation réussie, `site.precedent/` et `db/archives/` (le service archive l'ancienne base) permettent de revenir : remettre `site.precedent/` n'est pas automatique une fois le gel levé ; restaurer la sauvegarde de la production reste le geste.

**PR 5b : GitHub livre le kit à la production, ÉTEINTE avec `actif`** (`tools/flux-git/bascule-2.mjs#decisionDeLaLivraison`, `.github/workflows/livraison.yml`, `deploy/installateur/{fabriquer.mjs,kit-seul.sh,activation-pose.sh,installateur.sh,activer.sh}` ; tests : `flux-git-bascule-2`, `deploy-kit-seul-prod`, `deploy-kit`, `deploy-kit-seul`, `installateur-activation`, `deploy-activer` ; `docs/flux-git.md`, « Ce que GitHub publie avec la bascule 2 » ; `deploy/installateur/README.md`). **Éteint (`actif` faux), la livraison de production a le même comportement qu'avant** : `decider --mode prod --actif false` écrit `kit_seul=false`, le job construit le site, `fabriquer.mjs` refuse toujours `--kit` sans `--kit-seul`, et l'installateur est le modèle sans les six lignes repères `@@SEUL_…@@` (test « production = modèle » de `deploy-kit`) ; son script diffère d'avant par le fragment de l'activation (commentaires, `ACTIVATION_LANCEE`, `ACTIVER_OPTION`, la garde « kit périmé », trois messages) et par la rotation de `installation.log` (200 Ko, 500 lignes), jamais par ce qu'il pose.
- **La décision.** `decisionDeLaLivraison` ne dépend plus du mode : `actif === true` donne `kit_seul=true, construire_le_site=false` en production comme en test. `livraison.yml` passe `--kit .` quand le mode est test **ou** que la décision est kit seul, puis `--kit-seul` et pas de `--site` ; la note de la livraison de production dit ce qu'est un kit seul et le geste qui l'autorise.
- **L'archive** (`fabriquer.mjs --mode prod --kit . --kit-seul`, seulement avec `--kit-seul`) : ni pages, ni `donnees/`, ni `_serveur/` (un `site/` vide, que l'installateur compte : 0 page), le kit (`atelier-kit/`, avec `kit.json#paquet` : le `data/paquet.json` du commit de master), `activer.sh`, `activation-conteneur.sh`, `gel.sh` et les fichiers d'hébergement habituels ; rien de l'atelier du site de dev. Le service que la production exécutera est fabriqué par `activer.sh` depuis le kit seul (garde-fou 20), jamais livré par l'archive : l'essai de structure de l'installateur (qui lit `_serveur/data` de l'archive) n'a donc pas lieu, c'est `activer.sh` (garde-fou 17, structure) qui juge.
- **Ce que l'installateur fait** (sections `-prod` de `kit-seul.sh`). **Refus, avant toute écriture, avec le geste** : (1) sans `<prod>/activation-par-paquet` (fichier ordinaire, jamais un lien) : sinon la production resterait sur l'ancien site sans rien activer ; le message donne `sudo touch /srv/maverick-center/activation-par-paquet`, ou remettre `actif` à `false` dans `tools/flux-git/bascule-2.json` (la prochaine livraison de production redevient complète), et `sudo touch …/GELER` pour suspendre le minuteur en attendant ; (2) hors root ; (3) une instance qui n'est pas une production installée (VERSION en mode prod, `site/index.html`, `site/_serveur/`). Sinon, il pose le kit dans **`<prod>/activation/kit/`** (l'emplacement que lit `activer.sh`, à root ; décompressé à côté, l'ancien gardé jusqu'au renommage, restes d'une interruption jetés ou remis, place contrôlée) : un échec de cette pose **refuse l'installation** (`die`) avant que `VERSION` soit écrit, donc `mise-a-jour.sh` la retente ; puis les fichiers de l'instance ; **`VERSION` ne prend la nouvelle étiquette qu'après `activation : == PASSEE`** (ci-dessous) ; **`site/` et `site/_serveur/` ne sont pas touchés** ; enfin le fragment de la PR 5a crée `maverick-site`, rend `site/` à son propriétaire et lance `activer.sh --prod <prod>`. Pour une étiquette `VX.Y-hotfix.N` ou `VX.Y-rebuild.N` (même contenu republié : la version ne monte pas), il lance `activer.sh --correctif` : sans quoi `version_en_arriere` refuserait. Si `activer.sh` n'a pas pu être lancé (ni `maverick-site`, ni droits), une ligne `ATTENTION` en dit le geste.
- **`VERSION` après l'activation, la marque `.activation-refusee-<étiquette>`** (sections `version-avant-prod`, `version-apres-prod`, `activation-fin-prod` de `kit-seul.sh` ; `activer.sh` ; `mise-a-jour.sh`). Le modèle écrit `VERSION` avant le fragment de l'activation ; dans un kit seul de production, l'ancienne `VERSION` est gardée puis remise juste après, et la nouvelle attend dans `<prod>/activation/version-en-attente` (le même contenu). **Passée** (`activer.sh` sorti en 0, dernière ligne `activation : == PASSEE`) : `VERSION` prend la nouvelle étiquette, la mise en attente et les marques disparaissent ; `activer.sh` le fait lui-même quand il passe (donc aussi par `--reprendre`), seulement si la mise en attente est celle de SON kit (`version=` égale à celle de `kit.json`, `mode=prod`), sinon il la jette. **Non passée** (refus, retour automatique, `IMPOSSIBLE`, `RETOUR AUTOMATIQUE INCOMPLET`, sortie sans ligne `==`, ou `activer.sh` non lancé) : `VERSION` garde l'étiquette d'avant (la production ne se dit plus « à jour » sur son ancien site), l'installateur pose à root la marque `<prod>/.activation-refusee-<étiquette>` (avec la dernière ligne `activation : == …`, les autres marques `.activation-refusee-*` sont retirées), écrit **une seule ligne `ERREUR`** (la ligne et le geste : `sudo bash <prod>/activer.sh --reprendre`, avec `--correctif` pour un `-hotfix.N` ou `-rebuild.N`) et sort en **code 4** sans la ligne « Installé ». `mise-a-jour.sh` traite ce code 4 (installateur `KIT_SEUL=1` de production seulement : un installateur complet qui sortirait en 4 tombe dans l'erreur ordinaire) : il ne pose pas de seconde ligne `ERREUR` (une ligne d'information, sortie 1) et, tant que la marque de l'étiquette est là, ne télécharge ni ne rejoue rien aux passages suivants du minuteur (l'activation gèle les écritures et fabrique tout le site) ; `--force` passe outre ; une installation réussie, ou l'écriture de `VERSION` par `activer.sh`, efface les marques. Tests : `deploy-kit-seul-prod`, `deploy-activer`, `mise-a-jour`.
- **`mise-a-jour.sh` de production : rien à changer** (relu). Il télécharge le dernier asset de la livraison `latest`, vérifie l'archive (`--verifier` : 0 page), lance l'installateur comme toujours et garde les trois derniers installateurs ; un kit seul arrive comme une livraison ordinaire. Deux conséquences : un installateur qui refuse (pas d'`activation-par-paquet`) fait écrire une ligne `ERREUR` à chaque passage du minuteur (5 min) sans rien changer ; et une installation faite dont l'activation a refusé laissait `VERSION` à la nouvelle étiquette (le minuteur disait « À jour » sur l'ancien site) : **corrigé**, `VERSION` garde l'étiquette d'avant et la marque `.activation-refusee-<étiquette>` empêche de rejouer l'activation toutes les 5 minutes (ci-dessous). La reprise est `activer.sh --reprendre` (qui écrit `VERSION`), ou `mise-a-jour.sh --force`.
- **La reprise « GitHub a livré, la production a refusé ».** Vérifié dans le code : (a) `activer.sh` qui **refuse** (`REFUSEE`, code 1) ou **revient en arrière** (`RETOUR AUTOMATIQUE`) écrit `activation/rapport.json` et `paquets/activation.json` ; le site de dev le rend en `activation_production` (`etat`, `raisons`, `phrase`, `geste` : `docs/api.md`) ; la production n'a rien changé (ou a tout remis). (b) `activer.sh` **impossible** (code 2 : root, VERSION, kit absent, outil absent) et un refus **de l'installateur** n'écrivent **aucun rapport** : on ne les lit que dans la sortie de l'installateur (`installation.log`, `mise-a-jour.log` de la production). La ligne `ERREUR` de l'installateur (kit seul de production, activation non passée) y est écrite une fois, avec la dernière ligne d'`activer.sh` et le geste. (c) `etat_production` (attestation) compare l'attestation de la production au `site/` qu'elle publie : tant que `site/` n'a pas changé, il dit « à jour » ; il ne signale pas un refus. Un lancement de mise à jour reste à `fusionne` (la version cible n'est jamais installée) et les deux sites restent annoncés en maintenance (`/api/maintenance/`) tant que la production n'a pas sa version : c'est le signe, côté site de dev, qu'une activation attend. **Geste de reprise** : lire la dernière ligne et le `geste` de `activer.sh` (`sudo bash /srv/maverick-center/activer.sh`, ou la page Mise à jour du site de dev : `activation_production`), corriger la cause (paquet absent : refaire « Effectuer la mise à jour » ; place, mémoire : la libérer ; `maverick-site` : `sudo sh /srv/maverick-center/mise-a-jour.sh --force`), puis `sudo bash /srv/maverick-center/activer.sh --reprendre` (avec `--correctif` pour un correctif urgent) ; ou une nouvelle livraison de production, que l'installateur active à son tour. Rien n'est ajouté au code pour (b) et (c) : écrire un rapport avant le kit demanderait un second chemin d'écriture dans `paquets/` pour root, hors de ce que la PR 5a a validé (garde-fou 20).
- **Ce qui reste éteint.** Rien ne change en production tant que `actif` est faux dans `origin/dev` (le seul effet de ce code : un installateur de production fabriqué par `fabriquer.mjs --kit-seul`, jamais appelé sans la décision) ; et, allumé, la production refuse tout kit seul tant que `activation-par-paquet` manque. Le jour J, dans l'ordre : `bascule.sh poser-bascule-2` (site de dev), `sudo touch /srv/maverick-center/activation-par-paquet`, puis la PR qui passe `actif` à `true` ; le premier installateur de production kit seul est celui de la livraison `dev` → `master` suivante.
- **Retour arrière.** Repasser `actif` à `false` (PR vers `dev`) : la livraison de production suivante est complète ; `sudo sh /srv/maverick-center/mise-a-jour.sh --force` réinstalle la dernière livraison publiée (un kit seul, tant qu'une complète n'est pas publiée : republier `master` par « Run workflow » du workflow `livraison.yml`). `sudo rm /srv/maverick-center/activation-par-paquet` éteint l'activation (la production refuse alors tout kit seul).
- **Non mesuré ici** : le poids d'un installateur de production kit seul (le kit seul, sans pages, de l'ordre du kit d'un installateur de test) et donc ce que trois `installateur-courant/` y pèsent ; à relever sur la première livraison.

## Maintenance pendant une mise à jour

Demande du propriétaire : une mise à jour prend du temps (préparation, deux PR et leur CI, puis les installateurs : plusieurs dizaines de minutes). Dès que
**« Effectuer la mise à jour »** est lancé (la vraie, pas la simulation), **les deux sites** — le site de dev et la production — passent en
**« Maintenance en cours »** : chaque page part vers `/maintenance/` (« En travaux, merci de revenir dans quelques minutes »), où **tout le menu est
grisé** et inerte. L'écran disparaît **dès que c'est terminé, pour chaque serveur indépendamment** : celui qui s'installe le premier rouvre le premier.

| Où | Ce qui se passe |
| --- | --- |
| Service du site de dev | Il tient le lancement (`db/mise-a-jour/etat.json`) : une vraie mise à jour dans les états `envoi`, `lance`, `en_cours`, `fusionne` ou `termine` en fait une **annonce** (`annonceDuLancement` : lot, version cible X.Y, début, état), publiée dans le **dossier partagé** (`MAVERICK_MAINTENANCE`, fichier `annonce.json`) au lancement, à l'annulation, et à chaque tour de sa minuterie ; un lancement fini sans livraison (`echec`, `echec_livraison`, `erreur`, `annule`), une simulation ou un lancement à la main (`manuel` : la page « Mise à jour » doit rester ouverte pour en donner les valeurs) la retirent |
| Service de la production | Il lit l'annonce dans le même dossier (monté dans les deux instances : le `maintenance/` du serveur normal) ; il n'écrit rien |
| Chaque service | `GET /api/maintenance/` : en maintenance tant que **sa** version (celle qui tourne, `version.json` lu au démarrage) est plus ancienne que la version cible (`etatDeMaintenance`). Le serveur de test reçoit d'abord la version de dev qui porte le lot (0.2.Z+1 pour une livraison 0.3 : toujours en maintenance), puis la livraison (0.3.0, comme la production). La nouvelle version installée, le service redémarre et refait sa base vivante avant de répondre : ce serveur rouvre, l'autre reste en maintenance tant qu'il n'a pas la sienne |
| Chaque page (`layouts/Base.astro`) | Un script en ligne, dans `<head>`, demande `/api/maintenance/` au chargement, au retour sur l'onglet et toutes les 30 s ; en maintenance, il grise le menu et part vers `/maintenance/?retour=<la page>`. Sans service (site statique seul) ou service arrêté, rien ne se passe. Ni sur `/maintenance/`, ni dans la version portable |
| `/maintenance/` (`pages/maintenance.astro`, `scripts/maintenance.mjs`) | Redemande toutes les 3 s ; montre la version, l'heure du début et l'étape (préparation et contrôles, livraison, installation sur ce serveur) ; fini, ramène à la page d'où l'on venait (`lib/maintenance-retour.mjs` : une page de ce site seulement), sinon à l'accueil. Service injoignable (il redémarre) : il attend |
| Page « Mise à jour » | Après une vraie mise à jour lancée (pas « manuel »), elle part tout de suite vers `/maintenance/` ; la confirmation le dit |

Le site de dev **suit la mise à jour sans personne sur sa page** (ses pages renvoient vers `/maintenance/`) : sa minuterie (`MAVERICK_INTERVALLE`)
relit le run GitHub (au plus toutes les 20 s, tant qu'il est dans les états suivis et sans nouvelles depuis moins de 3 h) et ce que disent les
règles (`actualiserLancement` : note arrivée → `fusionne`, version installée en production → `termine`), puis republie l'annonce ; sans minuterie
(`npm run serveur`), c'est l'interrogation de la page de maintenance qui le fait. Un « Re-run » d'une livraison échouée repasse le lancement
`fusionne` : les deux sites se referment.

**Garde-fous** : une annonce mal formée ne compte pas ; au-delà de **4 h après le lancement** (`DUREE_MAX_MAINTENANCE` : 3 h de run au plus, puis
1 h pour les installateurs), plus rien n'est en maintenance, même si un installateur n'est jamais arrivé ; sur le site de dev, la page de
maintenance a un bouton **« Lever la maintenance (les deux sites) »** (`POST /api/maintenance/lever/`, `{ lot }` : le lot affiché ; noté
`maintenance_levee_le` dans le lancement, qui continue). Rien d'autre n'est bloqué : l'API reste ouverte (une fiche ouverte avant peut être enregistrée).

**Mise en place** (une fois) : `docker-compose.yml` monte le dossier hôte `${MAVERICK_DOSSIER_MAINTENANCE:-./maintenance}` sur `/maintenance` ; sur
le VPS, `deploy/vps/instances.sh` crée `/srv/maverick-center/maintenance` et pose `MAVERICK_DOSSIER_MAINTENANCE=/srv/maverick-center/maintenance`
dans le `.env` du serveur de test ; puis `docker compose up -d` dans les deux dossiers ([`deploy/vps/README.md`](../deploy/vps/README.md)). Sans ce
réglage, le site de dev se met en maintenance d'après son seul lancement et la production jamais.

## Accès au site de dev

Décision du propriétaire (R275, question 2, option b) : « Un mot de passe pour modifier et pour lancer une mise à jour ; la lecture reste ouverte. »
L'option c (« un mot de passe pour tout le site ») est le même réglage avec une autre **portée**, même mot de passe, une seule saisie. Chantier :
[`chantier-base-de-dev.md`](chantier-base-de-dev.md), lot 4. Code : `serveur/acces.mjs` (réglage, sessions, essais), `serveur/acces-routes.mjs` (le
classement des routes), la porte unique au début de `traiter` (`serveur/api.mjs`). Tests : `serveur-acces`, `serveur-acces-routes`, `deploy-acces`.

**Sans réglage, rien ne change** : la mise à jour, la Simulation, l'édition et `/api/v1/` répondent comme avant. Le service ne lit le réglage que sur le
site de dev (`MAVERICK_EDITION=1`) : la production n'est jamais concernée, ni l'installateur, ni la CI.

**Le réglage** est le fichier `secrets/acces.json` de l'instance (le dossier `secrets/`, déjà monté en lecture seule sur `/secrets` pour le jeton GitHub ;
`MAVERICK_ACCES_FICHIER` en dit un autre, sinon `acces.json` à côté de `MAVERICK_GITHUB_JETON_FICHIER`). Aucun secret en clair : l'empreinte **scrypt** du
mot de passe (avec son sel), l'empreinte **SHA-256** de la clé de lecture, un **secret de session**, la portée (`ecriture` ou `tout`). Le service le relit
quand le fichier change (date, inode, taille) : rien à redémarrer. Absent : ouvert. Illisible ou invalide : le site de dev reste **fermé** (aucune connexion
possible, ligne au journal) jusqu'à ce que la commande de l'hôte le refasse. Les comparaisons se font à temps constant.

**Qui peut quoi** : chaque route est classée dans `serveur/acces-routes.mjs`. Une route que la table ne nomme pas est fermée comme une écriture ; le test
`serveur-acces-routes` compare la table aux routes d'en-tête d'`api.mjs` et au code de l'aiguillage : **une route nouvelle non classée fait échouer la
suite**.

| Classe | Ce qu'il faut | Routes |
| --- | --- | --- |
| ouverte | rien | `GET /api/etat/` (sans la liste des fiches adaptées), `/api/maintenance/`, `/api/tipeee/`, `POST /api/classeur/`, `POST /api/metriques/page/` ; les prétirés en lecture (`GET /api/personnages/`, `…/<id>/`, `…/<id>/portrait/` : jamais une fiche de joueur) ; ce que les pages lisent pour montrer la base vivante : `GET /api/edition/{en-attente,listes,pages,mots-cles,chronologie,plan}/` et `POST /api/edition/{lignes,race,classe,bestiaire,portrait,evenement}/` (`classe` sans les libellés de fiches) ; la note en préparation et l'état du lancement `GET /api/mise-a-jour/` et `…/lancement/` (la page les relève sans connexion) ; le lot figé `GET /api/mise-a-jour/lots/<uuid>/` ; `/api/acces/` |
| lecture | la clé de lecture **ou** le mot de passe | `GET /api/edition/journal/`, `GET /api/edition/extrait/` et `…/extrait/meta/` (l'extrait du contenu : ni fiche, ni compte, ni journal), `GET /api/mise-a-jour/conflits/` (les lots en conflit), tout `GET /api/debug/…` (le contenu des tables : fiches, comptes et groupes compris), tout `GET /api/v1/…` |
| proposition | la clé de lecture **ou** le mot de passe ; **clé de dépôt posée** (R291) : la clé de dépôt **ou** le mot de passe | `POST /api/edition/lots/`, `POST …/lots/<id>/essai/` et `POST …/lots/recalcul/` : déposer un lot de changements, refaire son essai, « tout recalculer ». Sans clé de dépôt : elles n'écrivent que `lot_de_changements` (la proposition, son essai sur une copie), jamais le contenu. Avec : le lot est appliqué aussitôt ; la clé de lecture est refusée (`403`) |
| écriture | le mot de passe (session) | `POST /api/edition/` (un lot), `POST …/lots/<id>/appliquer/`, `…/refuser/`, `…/annuler/` et `…/lignes/<n>/annuler/`, `GET …/lignes/<n>/annulation/` (le clic du propriétaire sur un lot de changements ou une de ses lignes), `POST /api/maintenance/lever/`, `POST /api/mise-a-jour/{brouillon,majeure,lancer,liberer,conflits,copier}/` (« Effectuer la mise à jour », la Simulation et « Copier vers le dépôt »), les prétirés en écriture (`POST`, `PUT`, `DELETE /api/personnages/…`), tout `POST`, `PATCH`, `PUT`, `DELETE /api/v1/…` |

La clé de lecture ne permet jamais d'écrire dans le contenu (elle dépose une proposition, qui attend le clic du propriétaire, tant que la clé de dépôt n'est pas posée ; une fois posée, elle ne dépose plus).
La **clé de dépôt** (R291) est facultative : posée, elle vaut tout ce que vaut la lecture, plus le dépôt d'un lot **appliqué aussitôt** ; jamais une autre écriture (appliquer, annuler, édition,
mise à jour : le mot de passe). Le lot figé reste ouvert : le workflow `mise-a-jour.yml` (job `preparer`) ne joint que cette route du site de dev,
sans aucun secret ajouté côté GitHub ; l'adresse est à capacité (uuid aléatoire, lot sans fiche ni compte, contenu publié de toute façon dans la PR). Aucune
clé d'écriture n'est donnée à GitHub ; **la clé de dépôt ne va jamais à la CI** (elle n'a que la clé de lecture, `MAVERICK_EXTRAIT_CLE` ; `db:extrait` refuse une clé `mvd_` quand
`GITHUB_ACTIONS` est vrai) : c'est la parade au risque que la clé de lecture, que détient la CI, devienne une clé d'écriture. Les sessions de Claude reçoivent la clé de dépôt comme la clé de
lecture : par le formulaire sûr (en-tête `X-Maverick-Key`).

**Où passent les secrets** : le service ne voit jamais l'en-tête `Authorization` (Caddy y met le mot de passe interne de nginx, nginx l'efface). La clé de
lecture et la clé de dépôt (distinguées par leur empreinte) voyagent donc dans **`X-Maverick-Cle`**, ou son second nom **`X-Maverick-Key`** (le formulaire sûr qui remet la clé aux sessions de Claude n'accepte
qu'un nom d'en-tête finissant par `key`, `token`…) ; aucun autre en-tête, jamais l'adresse (que le journal note). Caddy et nginx transmettent ces deux
en-têtes tels quels. La session du navigateur voyage dans le cookie **`maverick_acces`**.
Aucun des deux n'est dans le journal, les métriques (seuls `Referer`, `Host` et `User-Agent` sont lus), l'état ou la page Debug.

**Connexion** (`/api/acces/`, toujours ouverte, mêmes refus que les écritures : JSON, requête d'une page de ce site) :
- `GET` → `{ protege, portee, connecte, droit, expire_le }` ; `droit` : `ecriture` (session du mot de passe), `depot` (clé de dépôt, R291), `lecture` (clé), `aucun`. Sans réglage :
  `{ protege: false, portee: null, connecte: false, droit: 'ecriture', expire_le: null }`.
- `POST { mot_de_passe }` → 200 avec le même état et le cookie `maverick_acces=v1.<expiration>.<HMAC-SHA256>` : `HttpOnly`, `SameSite=Strict`, `Path=/api/`,
  `Secure` pour un nom d'hôte (nginx réécrit `X-Forwarded-Proto` en `http` derrière Caddy : le service ne voit jamais `https`, il juge d'après l'hôte, comme `adressePublique`), **sans date** (il part avec le navigateur ; le jeton expire à 12 h). 401 mot de passe faux, **429** après 5 essais ratés d'une même
  source (première adresse de `X-Forwarded-For`, jamais notée) ou 60 au total sur 10 minutes (`attente_s`), 400 corps invalide, 409 sans mot de passe posé.
- `DELETE` → ferme la session : le cookie est retiré du navigateur, sous `/api/` et sous `/`, **sans révoquer le jeton** (valable jusqu'à 12 h pour qui l'aurait copié ;
  relancer `acces.sh` renouvelle le secret de session et ferme toutes les sessions).
- `GET /api/acces/verifier/` → 204 si la requête a au moins la lecture (cookie ou clé), 401 sinon : pour le `forward_auth` de Caddy (portée `tout`).
- Un refus de la porte est un **401** `{ erreur, acces }` : `acces: 'cle'` (la clé de lecture ou le mot de passe) pour une route de lecture, `'mot_de_passe'`
  pour une écriture ou une route inconnue, `'cle_de_depot'` (la clé de dépôt ou le mot de passe) pour un dépôt une fois la clé de dépôt posée ; la clé de lecture y reçoit un **403** `{ erreur, acces: 'cle_de_depot' }`
  (« la clé de dépôt est nécessaire »).
- Changer le mot de passe ou la portée renouvelle le secret de session : toutes les sessions ouvertes tombent, au prochain appel.

**Portée `tout`** (option c, non activée) : chaque route ouverte qui n'est pas indispensable passe en lecture ; restent ouvertes la connexion
(`/api/acces/…`) et le lot figé. Les pages sont servies par nginx : elles ne se ferment que si Caddy interroge `/api/acces/verifier/` avant de les servir.
La ligne est écrite, en commentaire et sans effet, dans `deploy/vps/Caddyfile` (`forward_auth` + exceptions : `/api/acces/*`, le lot figé, `/connexion/*`,
`/_astro/*`, `robots.txt`) ; elle n'a jamais été essayée sur un serveur, et la page `/connexion/` vers laquelle renvoyer un visiteur sans session reste à
écrire le jour où l'option c est choisie. Le cookie prend alors `Path=/` et `SameSite=Lax` (un lien venu d'ailleurs arrive connecté).

**Le geste du propriétaire** : `sudo sh /srv/maverick-center-test/acces/acces.sh` (livré par l'installateur dans le dossier de l'instance, comme
`sauvegarde/`, remplacé à chaque installation ; `secrets/` n'est jamais touché). Sans option : deux saisies du mot de passe, sans écho (10 caractères au
moins) ; il est haché par le service lui-même (`docker exec -i … node`, entrée standard : jamais un argument de commande, jamais un fichier, rien exigé de
l'hôte), le fichier est posé en 600 dans `secrets/` (700), et la première fois la **clé de lecture** s'affiche une seule fois à l'écran (jamais hors d'un
terminal). Changer le mot de passe garde la clé et ferme les sessions. Options : `--cle` (une clé neuve, l'ancienne cesse de marcher), `--portee
ecriture|tout`, `--etat` (sans secret), `--retirer` (retour à l'ouvert), et (R291) **`--cle-de-depot`** : pose (ou refait) la clé de dépôt, affichée une seule fois
sur un terminal comme la clé de lecture (`CLE_DE_DEPOT` dans la sortie du conteneur ; `mvd_…`, jamais dans le fichier, qui n'en garde que l'empreinte), qui garde le mot de passe, la clé de lecture et les sessions ouvertes ; **`--sans-cle-de-depot`**
la retire (retour à l'état sûr : la clé de lecture redépose une proposition qui attend le clic). `--etat` dit si la clé de dépôt est posée. Le propriétaire donne ensuite la clé de dépôt aux sessions de Claude par le formulaire
sûr (en-tête `X-Maverick-Key`), jamais à GitHub ni à la CI. Elle refuse la production (`MAVERICK_EDITION=1` absent du `.env`) et n'a pas besoin
de l'ancien mot de passe : un mot de passe perdu se remplace, ou la protection se retire, par la même commande. Elle ne change ni `docker-compose.yml`, ni
`nginx.conf`, ni le Caddyfile actif.

**Dans le navigateur** (pages, tech-front) : la lecture des pages ne demande rien. Une écriture ou une page de lecture protégée qui reçoit un 401 demande le
mot de passe **une fois** (`POST /api/acces/`) ; le cookie accompagne ensuite chaque appel de la visite. Un seul script, `src/scripts/acces.mjs`
(posé dans l'en-tête par `components/Acces.astro` depuis `layouts/Base.astro`, absent de la version portable), enveloppe `fetch` pour les adresses
`/api/…` : sur un 401 portant `acces`, une petite fenêtre (`<dialog>`, champ `password`, `autocomplete="current-password"`) demande le mot de passe, le
poste, puis rejoue l'appel ; des appels refusés en même temps partagent la même fenêtre, une session expirée (12 h) redemande, 401 et 429 (`attente_s`)
se disent dans la fenêtre. Annuler rend le 401 d'origine à la page ; une lecture refusée dans les 60 s qui suivent ne rouvre pas la fenêtre (les
relèves de la page Debug). Jamais de demande pour `/api/acces/`, la balise des pages ni la relève de la maintenance. Un `<a download>` du service
(journal de l'édition, exports de Debug) passe par `fetch` puis s'enregistre. Une fois connecté, « Connecté · Se déconnecter » apparaît dans le pied de
page (`sessionStorage`, confirmé par `GET /api/acces/`). L'option c n'y change rien : même mot de passe, même cookie, même fenêtre. Test :
`test/acces-navigateur.test.mjs`.

## Hébergement

Deux conteneurs dans chaque `docker-compose.yml`, celui des [installateurs](../deploy/installateur/README.md) (serveur normal et serveur de test,
[`deploy/vps/`](../deploy/vps/README.md)) comme celui du paquet du NAS ([`deploy/`](../deploy/README.md)) :

- **nginx** sert `site/` et transmet `/api/` au service (`deploy/nginx.conf`, le même fichier pour le NAS et les installateurs), derrière le
  même mot de passe. L'adresse du service est résolue à chaque requête : nginx démarre sans lui, et si le service est arrêté, `/api/` répond 502
  pendant que les pages de lecture restent servies.
- **serveur** (`node:22-alpine`) exécute `site/_serveur/serveur/index.mjs` ; aucun port publié (seul nginx l'atteint). Variables :
  `MAVERICK_REGLES` (base des règles, `/site/donnees/maverick.db`), `MAVERICK_DB` (dossier de la base vivante, `/db`), `HOST`, `PORT` (8787),
  `MAVERICK_INTERVALLE` (surveillance, 15 000 ms), `MAVERICK_EDITION` (`1` : édition des règles ouverte, serveur de test seulement) ; page
  « Mise à jour » du serveur de test : `MAVERICK_PRODUCTION` (`/production`, site de la production en lecture seule), `MAVERICK_REFERENCE` (repli : copie de master, `/site/donnees/reference.db`), `MAVERICK_ADRESSE_PUBLIQUE`
  (`https://dev.<domaine>`, sinon l'hôte de la requête), `MAVERICK_GITHUB_JETON_FICHIER` (`/secrets/github-actions-token`, dossier `secrets/` de
  l'instance monté en lecture seule), `MAVERICK_ACCES_FICHIER` (réglage de l'accès, `/secrets/acces.json` par défaut : « Accès au site de dev », ci-dessus), `MAVERICK_DEPOT` (`Bravexier/MaverickCenter`) ; les deux serveurs : `MAVERICK_MAINTENANCE` (`/maintenance`,
  dossier partagé de l'annonce de maintenance, ci-dessus), `MAVERICK_DOSSIER_METRIQUES` (`/metriques`), `MAVERICK_INSTANCE` (`prod` ou `dev`),
  `MAVERICK_METRIQUES_PAGES` (`1` par défaut) et `MAVERICK_METRIQUES_BRUTES` (`0` par défaut) : « Métriques et volume », ci-dessous ;
  `MAVERICK_TIPEEE` (`0` : Tipeee jamais relu) et `MAVERICK_TIPEEE_CACHE_MIN` (360 par défaut), absents des `docker-compose.yml` (valeurs par
  défaut) : « Tipeee », ci-dessous.
- **Journaux des conteneurs** (`docker logs`) : pilote `json-file`, **5 fichiers de 10 Mo au plus** par conteneur (`logging` de chaque service des
  deux `docker-compose.yml`) ; sans ce réglage, Docker les garde sans limite.

**Mises à jour, sans rien relancer à la main** : le service surveille trois fichiers (un changement compte quand il a été vu deux fois de suite,
pour ne pas agir au milieu d'une copie) :

1. `site/_serveur/version.json` : une nouvelle version du service s'arrête (code 0) et Docker la relance (`restart: unless-stopped`) ;
2. `site/donnees/maverick.db` : de nouvelles règles refont la base vivante (ci-dessus) ;
3. `db/vivante.db` : remplacée de l'extérieur (une restauration, ou la copie de la production que l'installateur de test pose sur demande, dans un
   `db/` vide), elle est rouverte. Une installation ne vide ni ne remplace jamais `db/` (R274) ; le dossier est monté dans le conteneur.

Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d` (l'installateur le signale ; sur le NAS, voir
`deploy/README.md`).

**Les sorties sur Internet en production** sont deux, sur les deux instances : `POST /api/classeur/` (« Importer (en ligne) » de la fiche,
`serveur/classeur.mjs`), que tout visiteur peut déclencher (le site est public), et la relecture de Tipeee (`GET /api/tipeee/`, `serveur/tipeee.mjs`,
ci-dessous). Le site de dev (`MAVERICK_EDITION=1`) joint aussi l'API GitHub (`api.github.com`), pour la page « Mise à jour » seulement et quand le
serveur de test a son jeton (`serveur/notes-de-version.mjs#creerGithub` ; « Mise à jour (site de dev) » ci-dessus) ; en production, le service n'a pas
de client GitHub. Pour le classeur, le service n'accepte qu'un lien `https://docs.google.com/spreadsheets/d/<id>…`,
construit lui-même l'adresse d'export (`…/export?format=xlsx`, jamais l'adresse reçue), suit les redirections une à une (5 au plus, `https`,
`docs.google.com` ou un hôte `*.googleusercontent.com` seulement), lit au plus **16 Mio** (taille annoncée, puis lecture par morceaux arrêtée
au-delà), abandonne après **20 s** (sous le délai de 60 s de nginx), fait au plus **2 téléchargements à la fois et 30 par minute** pour tout le
service, et arrête le téléchargement si le visiteur part. Il vérifie qu'il a reçu un `.xlsx` (« PK\x03\x04 »). Rien de l'adresse ni de l'identifiant
de la feuille n'est noté : le journal dit la taille, les redirections et la durée, les métriques comptent la route `/api/classeur/` et un évènement
`classeur` (statut, durée, octets, redirections). `fetch` est injectable (`demarrerService({ fetch })`) : les tests ne joignent pas Google.

**Tipeee** (réponses du propriétaire du 2026-10-22 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur
Tipee » ; « En direct par le serveur » : « Le serveur de production relit Tipeee lui-même, avec un cache de quelques heures, et garde le dernier
texte si Tipeee ne répond pas. Cela ajoute une connexion sortante au serveur de production. ») : l'accueil affiche au build l'instantané
versionné `sources/tipeee/bienvenue.json`, puis son script demande `GET /api/tipeee/` et remplace ses paragraphes s'ils diffèrent (sans service :
version portable, service arrêté, l'instantané reste).

- **Adresse fixe** : `https://api.tipeee.com/v2.0/projects/maverickjdr` (l'API publique du projet ; la page `fr.tipeee.com` est rendue en
  JavaScript), `GET` sans cookie, sans redirection suivie (une redirection est un échec) ; rien de la requête du visiteur n'y entre.
- **Cache** : pendant **6 heures** (`MAVERICK_TIPEEE_CACHE_MIN`, en minutes, de 1 à 10 080), aucune requête ; après un échec, pas de nouvel essai
  avant **15 minutes** : un visiteur n'attend Tipeee qu'une fois par période. **Une seule requête à la fois** pour tout le service : les visiteurs
  qui arrivent pendant une lecture attendent la même. Au plus **8 s** et **512 Kio** (taille annoncée, puis lecture par morceaux arrêtée au-delà).
  `MAVERICK_TIPEEE=0` : Tipeee n'est jamais joint, le dernier texte connu est servi (`origine` : `repli`, même s'il a été lu il y a moins que la
  durée du cache).
- **Texte seul** : du champ `contentv2.translations.fr.html`, `client/src/lib/tipeee.mjs#bienvenueDeTipeee` ne garde que le texte (balises,
  images — les emojis de Tipeee —, styles, scripts retirés ; entités décodées), en paragraphes, depuis le repère « Bienvenue sur le Tipeee de
  MaverickJDR ! » (cherché sans tenir compte de la casse ni des espaces) jusqu'à la fin ; au plus 40 paragraphes et 8 000 caractères.
- **Dernier texte gardé** : chaque lecture réussie est écrite dans `db/tipeee.json`, à côté de la base vivante (le format de l'instantané :
  `{ url, lu_le, paragraphes }`, écrit d'un coup), et relue au démarrage : un service relancé pendant le cache ne rejoint pas Tipeee. Le premier
  repli est l'instantané livré avec le site (`serveur/livraison.mjs` le copie dans `_serveur/sources/tipeee/bienvenue.json`, compté dans l'empreinte
  du code) ; le plus récent des deux est servi. L'instantané s'écrit par `tools/sources/tipeee.mjs` (`--verifier` : c'est encore le texte de
  Tipeee ; `docs/sources.md`, « Tipeee »).
- **Tipeee injoignable, lent, en erreur, réponse trop grosse, invalide ou sans le repère** : le dernier texte connu reste servi (`origine` :
  `repli`) et une alerte va au journal du service (« ATTENTION Tipeee : … ; le texte lu le … reste servi », niveau avertissement, aussi dans
  `docker logs`). Chaque lecture est un évènement `tipeee` des métriques (statut, durée, octets, raison d'un échec) et la route compte comme
  `/api/tipeee/`. `fetch` et l'horloge sont injectables (`demarrerService({ tipeee: { fetch } })`) : les tests ne joignent pas Tipeee.

## Métriques et volume

Demande du propriétaire : « isoler les informations de temps de réponse […] pour voir quels sont les appels les plus lents en moyenne […] extraire
absolument tout ce qui est possible d'extraire dans un but de suivi, maintenance et évolutions. Si une question de volume se pose, préviens-moi. Il
faudrait voir en effet l'espace libre sur le serveur. » Décisions du 2026-10-15 : **deux jeux de données séparés** entre la production et le site de
dev, et la mesure des pages par le navigateur **active aussi en production** dans un premier temps. Ce que le service mesure, ses routes et la page
Debug qui les montre : [`api.md`](api.md), « Page Debug ». Cette section dit **où** les métriques sont rangées, **combien** elles pèsent, et tout ce
qui grossit sur le serveur.

### Où sont les métriques

- **Une base SQLite par instance**, `<dossier des métriques>/<instance>.db` : `prod.db` (serveur normal), `dev.db` (site de dev). Jamais la base
  vivante, jamais `data/rows`, jamais le journal de l'édition. Chaque service n'écrit **que son fichier** ; le site de dev lit aussi `prod.db`, en
  lecture seule, et la page Debug montre l'un **ou** l'autre, au choix : les deux jeux ne se mêlent jamais.
- **Instance** : `MAVERICK_INSTANCE` (`prod` ou `dev`, posé par `deploy/vps/instances.sh` dans chaque `.env`) ; vide, le service la déduit de
  `MAVERICK_EDITION` (`1` : `dev`, sinon `prod`).
- **Dossier** : `MAVERICK_DOSSIER_METRIQUES`, monté sur `/metriques` dans le conteneur « serveur » (`docker-compose.yml` des installateurs :
  `${MAVERICK_DOSSIER_METRIQUES:-./metriques}:/metriques`), sur le modèle exact du dossier de la maintenance :

  | Hébergement | Dossier de l'hôte | Partagé |
  | --- | --- | --- |
  | VPS (`deploy/vps/`) | `/srv/maverick-center/metriques/` : `instances.sh` le crée (root, `755` : le service tourne en root dans `node:22-alpine`, comme pour `db/`) et le pose dans le `.env` **des deux** instances | Oui : `prod.db` et `dev.db` côte à côte, le site de dev lit `prod.db` |
  | Autre instance posée par un installateur | `metriques/` du dossier de l'instance (créé par Docker) | Non : le site de dev ne voit la production que si son `.env` donne `MAVERICK_DOSSIER_METRIQUES=<dossier du serveur normal>/metriques` |
  | NAS (`deploy/docker-compose.yml`) et `npm run serveur` | `db/metriques/` (défaut du service : `<dossier de la base vivante>/metriques/`) | Non (une seule instance) |

- **L'installateur de test** ne touche jamais à `db/`, sauf pour y poser, sur demande (`--copier-base-prod`) et dans un `db/` vide, une copie de celui du
  serveur normal : les métriques n'y sont pas quand le dossier est réglé, et `db/metriques/` (défaut) n'est **jamais copié** de la production, jamais
  effacé du test, et ne compte pas pour une base (un `db/` qui ne contient que lui est vide).
  `client/test/installateur.test.mjs` le vérifie.
- **Mesure des pages par le navigateur** (`POST /api/metriques/page/`) : acceptée sur les deux instances, chacune dans son fichier ; l'interrupteur
  pour plus tard est `MAVERICK_METRIQUES_PAGES=0` dans le `.env` de l'instance, puis `docker compose up -d` (la balise reçoit alors `403`).
- **Requêtes brutes** : jamais sur disque par défaut (les 2 000 dernières en mémoire, site de dev seulement) ; `MAVERICK_METRIQUES_BRUTES=1` dans le
  `.env` les garde 30 jours (volume ci-dessous).
- **Page d'origine d'un appel** : tirée de l'en-tête `Referer` (chemin seul). Les serveurs envoient pour cela `Referrer-Policy: same-origin`
  (`deploy/nginx.conf` et `deploy/vps/Caddyfile`, qui doivent dire la même chose : `client/test/deploy-vps.test.mjs`) : l'adresse d'une page n'est
  donnée qu'au site lui-même, **jamais à un site tiers** (Google Docs, Fandom…), comme avec l'ancien `no-referrer` ; avec `no-referrer`, la colonne
  « origines » de la page Debug resterait vide.
- **Sauvegarde** : inutile, les métriques se perdent sans dommage (seul `db/` compte). Sur le NAS, elles sont dans `db/` et partent donc avec lui.

- **Variables** (dans le `.env` de l'instance, puis `docker compose up -d`) : `MAVERICK_DOSSIER_METRIQUES` (le dossier, ci-dessus),
  `MAVERICK_INSTANCE` (`prod`, `dev`), `MAVERICK_METRIQUES_BRUTES=1` (requêtes brutes gardées 30 jours), `MAVERICK_METRIQUES_PAGES=0` (balise des
  pages refusée par le service : `403`). Au build, `SITE_METRIQUES_PAGES=0` retire la balise des pages elle-même. Sans elles : métriques dans
  `<db>/metriques/`, instance d'après l'édition, pas de requêtes brutes, mesure des pages **active**, en production comme sur le site de dev
  (décision du propriétaire du 2026-10-15 : « Active-le aussi en prod dans un premier temps »).

**Ce qui est mesuré** (détail des routes et des champs : [`api.md`](api.md), « Page Debug ») : pour chaque requête `/api/`, la route normalisée
(gabarit sans identifiant ni chaîne de requête), la méthode, le statut, la durée et ses phases (lecture du corps, traitement, envoi), les octets
reçus et envoyés, les requêtes SQL (nombre, temps, la plus lente sans ses valeurs), la page d'origine (chemin du `Referer` du même site), la famille
de navigateur et l'appareil, les requêtes simultanées ; chaque minute, la mémoire, la boucle d'événements, le CPU, la charge, le disque, la taille
des fichiers ; toutes les 10 minutes, la répartition du disque (« Jauge de l'espace disque », ci-dessous) ; les évènements du service avec leur
durée ; les pages vues mesurées par le navigateur. **Jamais** : adresse IP, corps, chaîne de requête, identifiant de fiche, `Authorization`,
cookie, User-Agent entier. Coût mesuré le 2026-10-15 (essai réel, 4 000 requêtes avec et sans collecte, alternées) : **+0,027 ms par requête en
moyenne** (1,475 → 1,501 ms ; médiane +0,015 ms, p95 +0,033 ms), versement d'une minute en ~1 ms. Une panne de la base des métriques (disque plein,
fichier verrouillé) ne fait jamais échouer une requête : la collecte continue en mémoire, bornée, et le versement suivant réessaie.

**Rétention** (constantes du service, `RETENTION` de `serveur/metriques.mjs`, renvoyées par `GET /api/debug/systeme/`, `volume.retention`) :
écriture en mémoire, versée dans la base une fois par minute (et à l'arrêt) en une transaction ; purge et `VACUUM` incrémental une fois par jour ;
le WAL est ramené à 1 Mio après chaque point de contrôle.

| Données | Gardées |
| --- | --- |
| Agrégats horaires des appels `/api/` (heure × route × méthode : nombre, erreurs, `304`, durées, histogramme, octets, SQL) | 400 jours |
| Agrégats par tranche de 5 minutes (période « 1 h » de la page Debug) | 2 jours |
| Agrégats horaires des pages vues (heure × page : temps jusqu'au premier octet, `DOMContentLoaded`, chargement, LCP) | 400 jours |
| Navigateurs et appareils, origines des appels (heure × page × route) | 400 jours |
| Échantillons système par minute (mémoire, boucle d'événements, CPU, charge, disque, tailles des fichiers) | 14 jours, puis un résumé par heure 400 jours |
| Répartition du disque (toutes les 10 minutes) | 14 jours, puis la dernière de chaque jour 400 jours |
| Évènements du service (démarrage, reconstruction de la base vivante, rejeu, lots, mise à jour, GitHub, maintenance, `5xx`, purge, arrêt) | 400 jours |
| Requêtes brutes | Jamais sur disque ; 30 jours avec `MAVERICK_METRIQUES_BRUTES=1` |

### Volume estimé des métriques

Mesuré le 2026-10-15 avec le vrai collecteur (`creerMetriques`, horloge injectée, une minute de collecte simulée après l'autre, 4 à 21 jours par
cas ; 1 000 requêtes par jour sur 12 h, une balise de page pour 5 appels), pour une instance. Le volume suit surtout le nombre de **pages
différentes vues par heure** (`origine_heure` : une ligne par page × route × heure ; `page_heure` : une ligne par page × heure), puis le nombre
de routes (`agregat_heure`, une ligne par route × méthode × heure), pas le nombre de requêtes. Trois chiffres, que le service calcule lui-même
(`GET /api/debug/systeme/`, `volume`) et que la page Debug montre :

- **écrit par jour** (`debit_ecriture_octets_par_jour`) : tout ce qui s'écrit, y compris ce que la rétention purge vite (agrégats de 5 minutes,
  2 jours ; échantillons par minute, ~140 Ko par jour, 14 jours) — un débit, pas une croissance ;
- **croissance en régime** (`croissance_octets_par_jour`) : ce que la base prend par jour une fois les tables courtes remplies — l'estimation (les
  tables gardées un an ou plus) tant que la mesure ne porte pas sur 7 jours, ou s'en écarte de plus d'un facteur 2 ; sinon la mesure, faite sur la
  **taille logique** de la base (`(page_count − freelist_count) × page_size`, notée chaque minute), jamais sur le fichier et son WAL, qui va de 0 à
  ~4 Mio au fil des points de contrôle (une mesure sur le fichier pouvait devenir négative) ;
- **dans un an** et **à rétention pleine** (`projection_un_an_octets`, `taille_a_terme_octets`) : table par table, chacune à sa rétention — jamais
  la taille + croissance × 365, qui comptait les tables purgées vite (la page affichait ~115 Mio le premier jour pour ~25 Mo réels à un an).

| Trafic supposé (une instance) | Écrit par jour | Croissance en régime | Dans un an | À 400 jours, puis stable |
| --- | --- | --- | --- | --- |
| 1 000 requêtes par jour sur 12 h, 20 routes, 40 pages (Zipf) | ~0,28 Mo | ~57 Ko / jour (mesurée : ~80 Ko au 21ᵉ jour) | ~24 Mo | **~25 Mo** |
| 3 000 requêtes par jour, 25 routes, 30 pages | ~0,31 Mo | ~90 Ko / jour | ~36 Mo | ~39 Mo |
| 20 000 requêtes par jour, 40 routes, 100 pages | ~0,59 Mo | ~0,36 Mo / jour | ~137 Mo | ~149 Mo |
| 50 000 requêtes par jour sur 12 h, 40 routes, 400 pages (Zipf) | ~1,4 Mo | ~1,17 Mo / jour | ~435 Mo | **plafond** (ci-dessous) vers le 9ᵉ mois |
| En plus avec `MAVERICK_METRIQUES_BRUTES=1` | ~145 o par requête : ~0,4 Mo / jour pour 3 000 requêtes | | | ~13 Mo (30 jours) |

L'essai réel du 2026-10-15 (733 appels et 68 pages vues sur le site de dev, 121 appels et 20 pages vues sur la production) a laissé `dev.db` à
96 Kio et `prod.db` à 76 Kio. Une alerte de la page Debug prévient au-delà de **200 Mio**, mesurés ou attendus à rétention pleine.

**Bornes, quel que soit le trafic** (même fabriqué : la balise et `/api/` sont joignables de tous sur le VPS, Caddy présentant lui-même le mot de
passe) :

- **pages du site seulement** : une page (balise ou `Referer`) que le site construit n'a pas (`pagesDuSite` : ses `index.html`, relus toutes les
  10 minutes) est comptée dans `{autres}` ; au plus `PAGES_PAR_HEURE` = 300 pages distinctes par heure, et `ORIGINES_PAR_HEURE` = 1 000 couples
  (page d'origine, route) par heure ; au-delà, `{autres}` ;
- **refus regroupés** : une requête refusée avant tout traitement (`403`, `405`) est comptée sous `/api/<premier segment>/{refusee}/` (en
  production, tout `/api/v1/` et `/api/debug/`) : une requête anonyme par gabarit × méthode fait 70 lignes par heure, au lieu de 2 600 ;
- **plafond dur** : `PLAFOND_METRIQUES_OCTETS` = 300 Mio par fichier (fichier + WAL), ou moins de 2 Gio libres sur le disque : la collecte est
  **restreinte** — plus aucune nouvelle page ni page d'origine (tout va dans `{autres}`), plus de requêtes brutes ; les routes continuent (leur
  nombre est borné par le code). Un évènement `metriques_restreintes` et une alerte le disent ; la restriction se lève d'elle-même quand la purge
  repasse sous le plafond. Le disque qui porte aussi la base vivante (les fiches) n'est donc jamais rempli par les métriques ;
- **lectures** : les pages et origines d'une période sont classées et coupées par SQLite (les 500 premières), jamais toutes lues en mémoire ; une
  période de 7 jours et plus, ou la lecture de l'autre instance, est gardée une minute (une page Debug ouverte, ou des appels répétés, ne refont
  pas le calcul) ; l'export s'arrête aux 100 000 lignes les plus récentes.

**Question de volume pour le propriétaire** (à l'ouverture à tout le Discord, 1.0) : au trafic actuel, quelques dizaines de Mo par an et
par instance. À ~20 000 requêtes par jour et 100 pages différentes par heure, ~150 Mo à rétention pleine ; au-delà de ~50 000, la base atteint le
plafond en quelques mois et ne garde plus de nouvelles pages. Deux leviers, aucun n'est appliqué : (1) ne plus noter l'origine des relèves
(`/api/maintenance/` et la balise : chaque page vue en fait déjà une), ~30 % de moins ; (2) regrouper `page_heure` et `origine_heure` par jour
au-delà de 30 jours, ×6 à ×20 de moins, sans rien perdre de visible (la page Debug montre déjà ces périodes par jour). Sinon : couper la mesure des
pages (`MAVERICK_METRIQUES_PAGES=0`) ou raccourcir leur rétention.

### Jauge de l'espace disque

Demande du propriétaire (2026-10-15) : « la métrique de la place occupée sur le serveur sur la place totale sous forme de jauge, colorée en fonction
du type de données (DB, Code, Import images, etc.) ». Une jauge de toute la taille du disque, un segment par type de données, dont la somme fait
exactement la taille du disque. Deux mesures, **avec les mêmes clés** :

- **le service** de chaque instance (`GET /api/debug/systeme/`, `disque.repartition` ; [`api.md`](api.md), « Page Debug ») mesure, de son
  conteneur, sa base (les images qu'elle contient à part), ses lots de mise à jour, le dossier des métriques et son site, et le disque (`statfs`) ;
  le reste (l'autre instance, Docker, les journaux, le système) ne se voit pas de là : il l'ajoute d'après le relevé de l'hôte (ci-dessous) quand
  il y en a un, sinon il tombe dans « Système et autres » ;
- **l'hôte** (VPS) : `deploy/vps/volume.sh` mesure tout le disque, avec les clés et les règles de classement des fichiers du site du service
  (`serveur/metriques.mjs`, `REPARTITION` et `categorieDuFichierDuSite`, que `client/test/deploy-volume.test.mjs` compare au script), plus trois
  clés que seul l'hôte voit. `instances.sh` le copie dans `/usr/local/lib/maverick-center/` et le fait lancer **toutes les 15 minutes** par le
  minuteur systemd `maverick-volume.timer` (et une première fois tout de suite), en lecture seule, à basse priorité (`Nice=19`, entrées-sorties
  `idle`) ; il écrit `volume-hote.json` dans le dossier des métriques partagé (`/srv/maverick-center/metriques/`, `/metriques/volume-hote.json`
  dans les conteneurs des deux instances), d'un coup (fichier provisoire au nom imprévisible, créé en exclusivité et écrit par son descripteur,
  puis renommage : un lien posé à l'avance par un conteneur dans ce dossier partagé n'est jamais suivi), `644`. Sur le NAS et en développement, pas de relevé de
  l'hôte : seule la mesure du service (en développement, `npm run serveur` compte le dernier site construit, `client/dist/`, comme le site d'une
  instance).

| Clé | Libellé | Contenu (octets **alloués** sur le disque, comme `df` et `du`) | Service | Hôte |
| --- | --- | --- | --- | --- |
| `base` | Base de données | `db/vivante.db` (+ `-wal`, `-shm`) et `db/archives/` ; l'hôte y ajoute les autres fichiers de `db/` et les sauvegardes faites à la main (`/root/vivante-*.db`) | Oui, moins les images qu'elles contiennent (celles de l'autre instance aussi : lues dans son fichier des métriques, `images_base`) | Oui, images comprises |
| `images` | Images importées | Images des colonnes d'image de la base vivante (portraits des prétirés et du bestiaire) et portraits publiés du site (`…/portraits/*.webp`) | Oui | Les portraits publiés seulement (les images d'une base ne se voient pas de dehors) |
| `mises-a-jour` | Mises à jour | Lots figés de la page « Mise à jour » (`db/mise-a-jour/`) | Oui | Oui |
| `metriques` | Métriques | Le dossier des métriques (`prod.db`, `dev.db`, leur `-wal`, `volume-hote.json`) | Oui | Oui (une fois, sans instance) |
| `site-code` | Code du site | `_serveur/` et `.html`, `.js`, `.mjs`, `.cjs`, `.css`, `.json`, `.map` | Oui | Oui |
| `site-donnees` | Données du site | `donnees/` hors pages `.html` (bases des règles et de la production), toute `.db`, `search-index.json`, `search-elements.json`, `fiche/regles.json` | Oui | Oui |
| `site-images` | Images du site | `.png`, `.webp`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.avif` hors portraits | Oui | Oui |
| `site-autres` | Autres fichiers du site | Polices, textes… ; l'hôte y ajoute le reste du dossier de l'instance (`docker-compose.yml`, `nginx.conf`, `.env`, scripts, dossiers) | Oui | Oui |
| `docker` | Docker (images et conteneurs) | Le dossier de Docker (`docker info` : `DockerRootDir`, `/var/lib/docker`), sans changer de disque, moins les journaux des conteneurs | — | Oui |
| `journaux` | Journaux | Journaux des conteneurs (`*-json.log*`), `/var/log` (journal de systemd, Caddy), journaux des scripts de l'instance (`*.log`) | — | Oui |
| `installations` | Installations et copies | Restes d'une installation (`.installation.*`, `.db.copie.*`), téléchargements de `mise-a-jour.sh` et `update-site.sh` (`/tmp/maverick-*`), installateurs copiés à la main (`/root`, `/home/*`), copies locales des sauvegardes automatiques (`/srv/maverick-sauvegardes`) | — | Oui |
| `autres` | Système et autres | La place prise que rien de ce qui précède n'explique (système, paquets, Caddy… ; côté service sans relevé de l'hôte, aussi Docker, les journaux et l'autre instance) | Oui | Oui |
| `reserve` | Réservé au système | La réserve du système de fichiers : blocs libres gardés pour root (ext4 : 5 % par défaut), que `df` ne compte ni dans *Used* ni dans *Avail* (`statfs` : `bfree − bavail`) ; à part, pour que la place occupée de la jauge soit celle de `df` (*Used*) | Oui | Oui |
| `libre` | Libre | La place disponible (`df` : *Avail*, `statfs` : `bavail`) | Oui | Oui |

**`volume-hote.json`** (`format` 1) :

```json
{
  "format": 1, "instant": "2026-10-15T14:45:03Z", "duree_ms": 640,
  "disque": { "dossier": "/srv/maverick-center", "point_de_montage": "/", "total": 0, "utilise": 0, "libre": 0, "reserve": 0 },
  "depasse": null,
  "repartition": [ { "cle": "base", "libelle": "Base de données", "octets": 0 }, "… les 14 clés dans l'ordre du tableau" ],
  "elements": [ { "cle": "base", "nom": "base vivante", "instance": "prod", "chemin": "/srv/maverick-center/db/vivante.db", "octets": 0 }, "…" ],
  "hors_disque": []
}
```

- `repartition` : les clés dans l'ordre de la jauge (celles du service, puis `docker`, `journaux`, `installations` juste avant `autres`, puis
  `reserve` et `libre`) ; leur somme fait exactement `disque.total` et tout sauf `reserve` et `libre` fait `disque.utilise` (*Used* de `df`), sauf
  si les clés comptées dépassent la place prise (`depasse` = `{ compte, occupe }`, `autres` à 0).
- `elements` : le détail de chaque clé, avec l'**instance** qu'il concerne (`MAVERICK_INSTANCE` de son `.env` : `prod`, `dev` ; le nom du dossier
  sans réglage) ou `null` (dossier partagé, Docker, système). Le dossier des métriques est mesuré avant que le relevé n'y soit écrit.
- `hors_disque` : ce qui a été mesuré sur un autre disque que celui des instances (ex. `/var/lib/docker` sur un disque à part) : listé, jamais
  dans la jauge.
- **Le service combine les deux mesures** (`serveur/metriques.mjs#lireReleveDeLHote`, au relevé de la répartition, toutes les 10 minutes) : ses
  propres mesures pour sa base vivante, ses archives, ses lots et son site (les images de sa base y sont séparées) ; de `volume-hote.json`, tous
  les autres éléments — ceux de l'autre instance ou d'aucune (Docker, journaux, sauvegardes…) et ceux de son instance qu'il ne voit pas (autres
  fichiers de `db/`, réglages et scripts, journaux des scripts, restes d'installation) —, jamais `metriques` (il compte déjà tout le dossier
  partagé) ni `hors_disque` ; `autres` = total − libre − réserve − le reste. Les trois clés de l'hôte n'apparaissent qu'avec un relevé pris en
  compte (`disque.repartition_hote` = `{ releve_le, utilise: true, raison: null }`). Un relevé de plus d'une heure est **périmé** (le minuteur ne
  tourne plus : `systemctl list-timers`), un relevé illisible, d'un autre format ou d'un autre disque (taille à plus de 1 % de celle que voit le
  service) est **écarté** : `utilise: false`, sa `raison`, une alerte « Information » et une phrase sous la jauge. La production note sa
  répartition combinée dans `prod.db` : le site de dev la montre telle quelle. Vérifié le 2026-10-15 sur un essai réel : la jauge du service
  tombe à l'octet près sur `df -B1` (total, *Used*, *Avail*) et, clé par clé, sur le relevé de l'hôte (`client/test/deploy-volume.test.mjs` le
  rejoue sur une arborescence factice).

**Coût et volume** : un relevé parcourt les deux dossiers d'instance (~1 800 fichiers par site), le dossier de Docker (quelques milliers de
fichiers pour les deux images) et `/var/log` : une à quelques secondes de `du`, à basse priorité, quatre fois par heure. Le fichier pèse ~6 Ko
et il est remplacé à chaque relevé (rien ne s'accumule) ; systemd note ~3 lignes par relevé dans son journal (~40 Ko par jour, borné par
journald).

### Tout ce qui grossit sur le serveur

| Quoi | Où (VPS) | Combien | Borné ? |
| --- | --- | --- | --- |
| Site | `/srv/maverick-center*/site/` | ~125 Mo (production) à ~145 Mo (dev : en plus `donnees/reference.db`, 18 Mo) ; base des règles `donnees/maverick.db` : 23 Mo | Oui : remplacé à chaque installation |
| Base vivante | `db/vivante.db` (+ `-wal` pendant une écriture) | ≈ la base des règles (23 Mo) + les fiches (un portrait : 700 000 caractères au plus, ~0,7 Mo) + le journal de l'édition (dev) | Suit les fiches ; refaite quand les règles changent |
| Texte de Tipeee | `db/tipeee.json` | ~1 Ko : la partie « Bienvenue », remplacée à chaque lecture réussie (toutes les 6 heures au plus) | Oui |
| Archives de la base vivante | `db/archives/` | `ARCHIVES_GARDEES` = 5 copies, ~25 Mo chacune : **≤ ~125 Mo par instance** | Oui (et seulement si la base avait des fiches ou un journal) |
| Lots figés de la mise à jour | `/srv/maverick-center-test/db/mise-a-jour/` | Un JSON par lancement (journal en attente : quelques Ko, plus ~1 Mio par portrait modifié), 8 au plus par 24 h ; jamais effacés (gardés pour l'enquête) | **Non**, mais lent (~quelques Mo par an) : à purger à la main au-delà d'un an si besoin |
| Métriques | `/srv/maverick-center/metriques/` | Quelques dizaines de Mo pour les deux fichiers au trafic actuel, puis stable ; plus à l'ouverture au Discord (« Volume estimé des métriques », ci-dessus) ; `volume-hote.json` : ~6 Ko, remplacé toutes les 15 minutes | Oui : rétention, pages du site seulement, refus regroupés et **plafond dur** de 300 Mio par fichier (`PLAFOND_METRIQUES_OCTETS` : au-delà, ou sous 2 Gio libres, collecte restreinte) |
| Journaux Docker | `/var/lib/docker/containers/*/…-json.log*` | nginx : une ligne (~250 o) par requête HTTP, ~2 Mo par jour et par instance ; service : production presque rien, dev une ligne par appel `/api/` (~0,5 Mo par jour). **Plafond : 4 conteneurs × 5 × 10 Mo = 200 Mo** | Oui depuis cette version (sinon ~1,5 Go par an, sans fin) ; s'applique quand le conteneur est recréé (`docker compose up -d`) |
| Images Docker | `/var/lib/docker/` | `nginx:1.27-alpine` (~50 Mo) et `node:22-alpine` (~160 Mo), partagées par les deux instances | Oui : jamais retirées automatiquement ; après un `docker compose pull`, l'ancienne image reste : `docker image prune` |
| Installateurs téléchargés par `mise-a-jour.sh` | `$TMPDIR` (`/tmp/maverick-mise-a-jour.*`), puis extraits dans `<instance>/.installation.<pid>/` | ~20 Mo, puis ~145 Mo extraits, **pendant l'installation seulement** (les deux instances peuvent s'installer dans les mêmes 5 minutes : ~330 Mo de pointe) | Oui : effacés à la fin ; restent seulement après un arrêt brutal (coupure, `kill -9`) : voir les commandes ci-dessous |
| Installateurs copiés à la main | `~/maverick-center-*-install.sh` | ~20 Mo chacun | **Non** : à effacer après l'installation |
| Copie de la base par l'installateur de test | `/srv/maverick-center-test/db/` (et `.db.copie.<pid>/` pendant la copie) | Le `db/` du serveur normal, archives comprises (≤ ~150 Mo), le double pendant la copie | Oui : jamais sans `--copier-base-prod`, refusée si `db/` n'est pas vide |
| Journaux des scripts | `mise-a-jour.log`, `update.log` ; `installation.log` | Les deux premiers tournent au-delà de 200 Ko ; `installation.log` : ~5 lignes par installation | `installation.log` non borné, ~0,2 Mo par an |
| Sauvegardes à la main | `/root/vivante-*.db` (`deploy/vps/README.md`, « Sauvegardes ») | Une base vivante chacune | **Non** : à faire tourner ou à sortir du serveur |
| Sauvegardes automatiques | `/srv/maverick-sauvegardes/` (copies locales, cache de restic) ; `<instance>/installateur-courant/` (les trois derniers installateurs : ~290 Mo au site de dev, ~106 Mo en production), `db/archives/paquets-livres/` (les 10 derniers paquets livrés, ~310 Mo au plus) | 24 horaires et 7 de nuit par instance, ~une base vivante chacune (les archives, identiques d'une copie à l'autre, sont des liens durs) | Oui : plafond de 4 Go et 3 Go libres au moins (`reglages.env`), au-delà plus rien n'est écrit et l'alerte le dit (« Sauvegardes automatiques ») |
| Système | journal de systemd (Caddy, mises à jour automatiques), `/var/cache/apt` | journald se borne seul (10 % du disque, 4 Gio au plus) | Oui ; `journalctl --vacuum-size=200M`, `apt-get clean` pour en reprendre |

**Voir l'espace libre sur le VPS** (la page Debug le montre aussi, mesuré par le service : `GET /api/debug/systeme/`, `disque` et `fichiers`, et
la jauge ci-dessus) :

```bash
df -h / /srv                                                    # espace libre du disque (et de /srv s'il est à part)
sudo cat /srv/maverick-center/metriques/volume-hote.json        # la répartition par type de données (relevé de l'hôte, ci-dessus)
systemctl list-timers maverick-volume.timer                     # dernier et prochain relevé ; à la main : sudo systemctl start maverick-volume
sudo du -sh /srv/maverick-center*/{site,db,metriques} /srv/maverick-center*/db/{archives,mise-a-jour} 2>/dev/null
sudo du -sh /srv/maverick-center/metriques/*                    # prod.db et dev.db (et leur -wal)
sudo docker system df                                           # images, conteneurs, volumes (détail : docker system df -v)
sudo sh -c 'du -ch /var/lib/docker/containers/*/*-json.log*' | tail -n 1     # journaux des conteneurs
sudo docker inspect --format '{{.Name}} {{.HostConfig.LogConfig}}' $(sudo docker ps -q)   # rotation appliquée : map[max-file:5 max-size:10m]
journalctl --disk-usage                                         # journal du système
ls -d /srv/maverick-center*/.installation.* /srv/maverick-center*/.db.copie.* /tmp/maverick-mise-a-jour.* ~/maverick-center-*-install.sh 2>/dev/null
```

La dernière ligne liste ce qu'une installation interrompue ou une installation à la main a laissé : à effacer (`sudo rm -rf …`) quand aucune
installation ne tourne (pas de `.installation.lock` ni de `.mise-a-jour.lock` dans le dossier de l'instance).

### Sauvegardes automatiques

Chantier « la base du site de dev devient la source de vérité » (`docs/chantier-base-de-dev.md`, lot 1 ; décisions R274, R275). Scripts dans
`deploy/installateur/sauvegarde/`, livrés dans le dossier `sauvegarde/` de chaque instance par son installateur (le site de dev les met à jour à chaque fusion dans
`dev`), exécutés en root par trois minuteurs systemd (`maverick-sauvegarde-horaire`, `-nuit`, `-essai`) que pose **une commande** (`sauvegarde/installer.sh`, mode
d'emploi et restauration : `deploy/vps/README.md`, « Sauvegardes »). Le lanceur (`/usr/local/lib/maverick-center/maverick-sauvegarde-lanceur.sh`) refuse des
scripts qu'un autre que root pourrait modifier.

| Script | Rôle |
| --- | --- |
| `copie.sh horaire\|nuit` | Copie la base des deux instances dans `/srv/maverick-sauvegardes/<instance>/{horaire,nuit}/<AAAAMMJJ-HHMMSS>/` (root 700) : chaque base SQLite par `.backup` (connexion en lecture seule : le contenu de `db/` n'est jamais modifié et rien n'y est créé — une base WAL sans `-wal` est ouverte « immutable », sans écrivain à gêner ; seul un `-wal` resté sans `-shm` après un arrêt brutal doit être rouvert par SQLite), les autres fichiers tels quels (lien dur sur le fichier identique de la copie précédente), `comptes.tsv` (lignes de chaque table), `copie.meta`. L'horaire ne copie que si `db/` a changé (noms, tailles et dates de modification) |
| `envoi.sh` | Envoie la dernière copie saine et le dernier installateur à un dépôt restic chiffré (S3), applique la rétention, contrôle le dépôt |
| `essai.sh` | Restaure la dernière copie extérieure dans un conteneur Docker jetable (image `ubuntu:24.04`, système de fichiers en lecture seule, seulement le binaire restic, les deux fichiers d'accès et un dossier de sortie vide), puis contrôle `integrity_check` et le nombre de lignes de chaque table contre `comptes.tsv` |
| `installer.sh` | Le geste : minuteurs, dossiers, saisie et essai du stockage, clé de chiffrement (6 mots de `mots.txt`), premier envoi, premier essai |

**Seuils** (`/etc/maverick-sauvegardes/reglages.env`, ou variable `MAVERICK_SAUV_<NOM>` ; défauts) : `PLAFOND_MO=4096` (place des copies locales, les deux instances),
`LIBRE_MIN_MO=3072` (libre du disque après une copie), `HORAIRES_GARDEES=24`, `NUITS_GARDEES=7`, `SUSPECTES_GARDEES=3`, `CHUTE_POURCENT=20` et `CHUTE_MIN_LIGNES=20` (une
table qui avait au moins 20 lignes dans la copie précédente et en perd plus de 20 % est une chute anormale, alerte ; une table disparue compte pour 100 %), `JOURS_GARDES=30`,
`VERSIONS_DE="prod dev"` (instances dont chaque version est gardée sans limite à l'extérieur), `CONTROLE_DONNEES=5%`. Un réglage se lit « retirer le `#` » : valeur éventuellement entre guillemets, commentaire de fin admis ; illisible (pas un entier, nom d'instance inconnu), il est dit sur la sortie d'erreur, listé dans `locale.reglages_illisibles` de l'état, fait sortir la copie en code 3 et la valeur par défaut est prise. Chaque instance est traitée dans son propre processus : un arrêt inattendu de l'une est noté en alerte `erreur_interne`, sa copie provisoire est effacée, l'autre est copiée. En alerte (chute, intégrité, copie impossible), la
copie va dans `suspectes/`, les copies saines ne sont ni remplacées ni tournées ; les copies mises de côté ne sont jamais envoyées à l'extérieur ; `copie.sh accepter <instance>` fait d'une baisse voulue la nouvelle référence. Plafond
atteint : les plus anciennes copies partent d'abord (jamais les deux dernières horaires, ni les deux dernières de nuit), sinon rien n'est écrit (alerte `plafond` ou `disque_plein`).

**Extérieur** : dépôt restic ; une copie chaque nuit par instance (étiquettes `inst-<instance>`, `horaire`|`nuit`, et `version` + l'étiquette de version quand elle a changé depuis le
dernier envoi : `--keep-tag version` les garde sans limite) ; `forget --keep-within-daily 30d --keep-monthly unlimited --keep-tag version` par instance, puis `prune` ; `check` chaque
nuit, avec `--read-data-subset` le dimanche. La dernière copie d'un groupe est toujours gardée par restic, quelle que soit la règle. Les installateurs sont gardés par `mise-a-jour.sh`
(`<instance>/installateur-courant/`, les trois derniers installés, `INSTALLATEURS_GARDES`), et les 10 derniers paquets de mise à jour livrés sont dans `db/archives/paquets-livres/`, que la copie emporte. Aucun secret en argument ni dans l'état : les accès sont dans l'environnement du processus, la clé de
chiffrement dans un fichier (`RESTIC_PASSWORD_FILE`).

**État pour la page Debug** : `<dossier des métriques>/sauvegardes.json` (`format` 1, `644`, remplacé d'un coup comme `volume-hote.json`, sans secret : dates, tailles, nombres, codes courts),
écrit à chaque passage des scripts. Si le dossier des métriques réglé (`MAVERICK_DIR_METRIQUES`, `<normal>/metriques`) n'existe pas (un VPS où `instances.sh` n'a pas été relancé depuis les
métriques), il est écrit là où le service de chaque instance lit ses métriques (`lib.sh#metriques_de_l_instance`) : le dossier que son conteneur monte sur son dossier des métriques
(`docker inspect` de `<MAVERICK_CONTENEUR>-serveur` : `MAVERICK_DOSSIER_METRIQUES`, sinon `<MAVERICK_DB>/metriques`), créé s'il manque ; sans conteneur, celui que son `.env` désigne s'il existe. Le service le lit (`serveur/metriques.mjs#lireSauvegardes`, champ par champ, sans rien reprendre d'inconnu) et l'expose dans `GET /api/debug/systeme/`,
champ `sauvegardes` (`null` sans fichier : NAS, développement), pour les deux instances quelle que soit celle qu'on regarde :

```json
{ "disponible": true, "raison": null, "instant": "2026-11-14T12:07:00Z", "age_s": 1800,
  "locale": { "plafond_octets": 0, "occupe_octets": 0, "part_plafond": 0.02, "libre_min_octets": 0, "disque_libre_octets": 0,
              "horaires_gardees": 24, "nuits_gardees": 7, "chute_pourcent": 20, "chute_min_lignes": 20, "reglages_illisibles": ["PLAFOND_MO"] },
  "instances": { "prod": { "copies": 12, "occupe_octets": 0, "etat": "ok|alerte|ancienne|sans_copie",
      "derniere_copie": { "le": "…Z", "age_s": 7200, "type": "horaire|nuit", "octets": 0, "lignes": 0 },
      "derniere_verification": { "le": "…Z", "age_s": 1800, "resultat": "copiee|inchangee|alerte|refusee|sans_base" },
      "alerte": { "le": "…Z", "age_s": 0, "code": "chute_de_lignes|integrite|copie_impossible|plafond|disque_plein|base_absente|erreur_interne", "detail": "…", "en_cours": true } },
    "dev": { "…": "…" } },
  "exterieur": { "active": true,
    "dernier_envoi": { "le": "…Z", "age_s": 0, "ok": true, "code": null, "instances": ["prod", "dev"] },
    "dernier_controle": { "le": "…Z", "age_s": 0, "ok": true, "donnees_relues": false },
    "dernier_essai": { "le": "…Z", "age_s": 0, "ok": true, "code": null, "duree_s": 41, "instances": { "prod": "ok", "dev": "ok" } } },
  "alertes": [ { "niveau": "info|avertissement|erreur", "message": "…" } ] }
```

`disponible: false` (avec `raison`) si le fichier est illisible, d'un autre format ou de plus de 64 Kio ; `derniere_copie`, `derniere_verification`, `alerte`, `dernier_*` valent `null` tant qu'ils n'existent pas.
`etat` : `alerte` (alerte de copie en cours), `ancienne` (aucune copie depuis plus de 26 h), `sans_copie`, sinon `ok`. Codes de l'envoi : `restic_absent`, `cle_refusee`, `depot_absent`,
`depot_inaccessible`, `envoi_echoue`, `retention_echouee`, `controle_echoue` ; de l'essai : `docker_absent`, `restic_absent`, `image_absente`, `restauration_echouee`, `copie_introuvable`, `integrite`,
`comptes_differents`, `copie_incomplete`. Les alertes (`alertes`, aussi ajoutées à celles de l'état du système) : erreur pour une alerte de copie en cours, une copie vieille de plus de 26 h, un envoi
raté ou vieux de plus de 36 h, un essai de restauration raté, un contrôle du dépôt raté ; avertissement quand l'état n'est plus réécrit depuis 3 h (minuteur arrêté), au-delà de 80 % du plafond, sous
l'espace libre minimal, ou sans essai de restauration depuis 40 jours ; information quand l'envoi hors du serveur n'est pas activé. Tests : `deploy-sauvegardes`, `deploy-sauvegardes-installer`,
`serveur-metriques-sauvegardes`, `mise-a-jour` (installateur gardé).

## Développement

```bash
cd client
npm run serveur     # le service sur http://127.0.0.1:8787/api/ ; règles : la base reconstruite depuis data/rows ; base vivante : var/serveur/
npm run dev         # dans un autre terminal : le site, qui transmet /api/ au service (astro.config.mjs ; PORT_SERVICE pour un autre port)
```

Les tests (`npm test`) : `serveur-base-vivante` (création, reprise des fiches, refus sans perte, archives), `serveur-api` (chaque route, chaque
refus, conflit de versions, serveur HTTP réel et sa surveillance), `serveur-armure-elementaire` et `serveur-poids-portable` (l'armure de R165 :
textes contre la migration 0080, reconstruction et enregistrement ; le poids portable lu dans la base comparé au moteur de la fiche sur toute la
base, l'armure trop lourde retirée à la reconstruction, joueurs compris, et à l'enregistrement, idempotence), `serveur-edition*` et `serveur-edition-journal` (édition : chaque domaine,
journal, rejeu), `serveur-tipeee` et `tipeee` (la partie « Bienvenue » de Tipeee : extraction du texte, réponse d'exemple, cache, une requête pour des appels simultanés, Tipeee injoignable, repère absent, réponse trop grosse, redémarrage, repli, route, livraison de l'instantané), `serveur-edition-conflits` (lots en conflit : diagnostic, choix 1, 2 et 3, nouveau lot, ancien marqué résolu, rejeu suivant sans conflit), `serveur-edition-fusion` (fusion à trois voies au rejeu, lots gardés, pas de cascade, lots retenus, réévaluation, résolution d'un lot gardé, ordre des résolutions, fixture `conflits-diagnostic-garde.json`), `fusion-trois-voies` (le module pur), `serveur-notes-de-version` (page Mise à jour : routes, lot figé, faux GitHub), `notes-de-version` et `notes-de-version-sens`
(liste et couleurs), `mise-a-jour-regles` (lot appliqué à data/rows : conflit, liste blanche), `mise-a-jour-github` (le workflow),
`mise-a-jour-simulation` (le lot synthétique de la CI, l'état « note en attente », le job `simulation-de-mise-a-jour`), `serveur-maintenance`
(annonce, deux serveurs qui rouvrent chacun à sa version, fin sans livraison, levée, plafond, minuterie, adresse de retour), `db-appliquer-edition` (rapatriement dans data/rows, versé dans l’historique), `historique-site` (ce que le site a changé, état d’import), `serveur-livraison` (modules livrés, service livré démarré tel quel,
`docker-compose.yml` et `nginx.conf` cohérents), `installateur` (`db/` jamais vidé ni remplacé, copie de la production sur demande dans un `db/` vide seulement, métriques jamais copiées ni effacées),
`serveur-metriques`, `serveur-metriques-http`, `serveur-metriques-bornes` et `serveur-metriques-disque` (métriques : routes normalisées, agrégats,
quantiles, rétention, deux instances, vraies requêtes HTTP, croissance et projections, cardinalité et plafond, répartition du disque, relevé de
l'hôte, réserve de root), `debug-metriques` et `debug-balise` (rendus de la page
Debug, balise des pages), `deploy-vps` (`instances.sh` : dossiers partagés de la maintenance et des métriques, une instance par fichier, minuteur du relevé de l'hôte) et
`deploy-volume` (rotation des journaux Docker, métriques montées hors de `db/`, mesure des pages active par défaut, `volume.sh` exécuté sur une
arborescence factice : clés et classement du service, chaque octet compté une fois, cette section fidèle au code), `serveur-extrait`, `serveur-attestation` et `db-extrait` (l'extrait du contenu : aucune trace d'une fiche, empreintes, modifications versées, une fabrication par changement,
route ; l'attestation de la production et son état côté dev ; la commande de téléchargement), `ressources-registre`, `serveur-api-v1` et
`api-doc` (API REST `/api/v1/`, [`api.md`](api.md)), `journal-du-service` et `debug-page` (page Debug) ; `site-html` contrôle `dist/_serveur/`
après le build, le script de maintenance de chaque page (exécuté dans un faux navigateur) et `/maintenance/`.

### Contrôle par mutation

Une modification faite sur le site de dev ne fait jamais échouer la suite (demande du propriétaire, `CLAUDE.md`, « Pas de texte figé »). Le contrôle
par mutation le vérifie : il modifie la base **par le service d'édition**, comme le site, puis passe les tests. C'est un outil à la main, en fin d'un
lot qui touche des tests sur la base réelle ; il n'est pas dans la CI.

```bash
cd client
npm run mutation -- <variante> [options] [fichiers de test…]   # toute la suite par défaut ; ex. : npm run mutation -- suppressions metiers-html guide
```

Il travaille dans une copie jetable, jamais dans le dépôt (`scripts/mutation.mjs`) :
1. un clone git partagé du dépôt (HEAD, branche et `origin/*` : `test/aide-mise-a-jour.mjs` et `scripts/mise-a-jour-regles.mjs` lisent
   `git show HEAD:…`, `scripts/db-reference.mjs` lit `origin/master`), qui reçoit l'arbre courant non commité (fichiers suivis et nouveaux) ;
   `node_modules` y est un lien ;
2. un journal produit par `serveur/edition.mjs#enregistrer` (`scripts/mutation-variantes.mjs` : validations, refus, protections et dérivations
   comme sur le site ; un lot par ligne, un refus est un résultat compté) ;
3. le journal rapatrié dans le `data/rows` de la copie (`db:appliquer-edition`), la base et les pages refaites, `db:check` (un échec est noté
   au bilan), le site construit si un test `*-html` est lancé ;
4. les tests, avec un rapporteur qui relève les échecs (`scripts/mutation-rapporteur.mjs`) ;
5. le bilan : `<dossier>/bilan.json` (mutations faites et refusées par table ou entité, rapatriement, tests en échec), résumé à l'écran, journaux de
   chaque étape dans `<dossier>/journaux/` (`tests-detail.log` : la sortie complète des tests). La copie est effacée à la fin, le dossier reste.

| Variante | Ce que le site de dev modifie |
| --- | --- |
| `temoin` | rien (journal vide) : les échecs de la copie elle-même, à retrancher de ceux d'une variante |
| `textes` | toute la prose modifiable réécrite, structure gardée (liens, balises, ancres figées, code, nombres) ; titre et résumé des pages du guide et du Codex |
| `noms` | `textes`, plus les intertitres renommés, la prose réduite et tous les autres textes modifiables (noms, effets) suffixés |
| `valeurs` | toutes les valeurs de règle modifiables : entiers, réels, listes de choix, colonnes `*_brut` et textes structurés (nombres et dés décalés) |
| `adresses` | les adresses des pages supprimées, absorbées ou retirées (`lib/livres.mjs`) écrites dans un texte de chaque colonne de prose |
| `suppressions` | toute ligne que le site permet de supprimer (`ENTITES` à `suppression` de `lib/edition-modele.mjs` ; pages des Règles : celles des menus), les plus dépendantes d'abord, en passes répétées tant qu'une passe en supprime ; refus (pages protégées ou citées, mots-clés protégés ou mentionnés, R196, ressources citées…) comptés |

| Option | Effet |
| --- | --- |
| `--dossier <d>` | dossier de travail (défaut : un dossier neuf `maverick-mutation-*` sous le dossier temporaire du système) |
| `--garder` | garder la copie (`<dossier>/depot`) pour y relancer un test à la main (`cd <dossier>/depot/client && node --test test/<fichier>`) |
| `--build`, `--sans-build` | construire le site ou non (défaut : seulement si un test `*-html` est lancé, toute la suite comprise) |
| `--sans-tests` | s'arrêter après la base, les pages et le build |
| `--journal <f>` | rapatrier ce journal au lieu d'en produire un (rejouer un passage) |
| `--entites a,b` | `suppressions` : seulement ces entités |
| `--une-sur n` | `suppressions` : une ligne sur n de chaque entité (la première, puis toutes les n) au lieu de toutes |
| `--exclure t,t.col` | `textes`, `noms`, `valeurs`, `adresses` : tables, colonnes ou pages (par leur id) laissées intactes |

`suppressions` vide des tables entières (tous les métiers, monstres, événements…) : un cas extrême ; `--une-sur 2` garde la moitié des lignes, le
cas courant du site. Code de sortie : 0 si les tests passent, 1 sinon. Un test qui tombe sous mutation est trop strict s'il lit un texte, une valeur ou une ligne que le
site modifie (skill `tests-conventions`) ; s'il tombe parce que le site se comporte mal après la modification, c'est le site qu'il faut corriger. Test
de l'outil : `mutation` (parties pures ; le passage complet est l'outil lui-même).

## Suite

- Pages du site branchées sur l'API : `/fiche/` (création et modification d'un prétiré) et `/personnages/` (recherche), voir
  [`character-generator.md`](character-generator.md).
- 1.0 : connexion Discord (sessions, rôles), fiches de joueur, partage, groupes (`v_personnage_visible`), protection des pages par le service
  (`auth_request`) à la place du mot de passe partagé.

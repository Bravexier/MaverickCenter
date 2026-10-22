# Mode client / serveur : le service des personnages

Demande du propriétaire : le site reste un ensemble de pages statiques pour **lire** les règles et le lore, et un petit **service** enregistre
ce qu'on y **écrit** : les fiches de personnages prétirés et, sur le site de dev, l'édition des règles. La connexion Discord et les fiches de
joueur viendront s'y ajouter ([`feuille-de-route.md`](feuille-de-route.md)) ; rien n'y est propre à l'hôte qui le fait tourner.

```
navigateur ──▶ nginx (mot de passe du site) ──┬──▶ site/            pages, scripts, base des règles (donnees/maverick.db)
                                              └──▶ /api/ ──▶ conteneur « serveur » (Node 22) ──▶ db/vivante.db  (base vivante)
```

**Avant la 1.0, pas de comptes** : quiconque a le mot de passe du site lit et écrit les prétirés (un prétiré n'est à personne et tout le monde
le voit : `v_personnage_visible`). Une fiche de joueur n'est ni listée ni lisible par l'API des personnages ; elle viendra avec la connexion
Discord. Sur le site de dev seulement, le menu « DB » de la page Debug lit pourtant toute la base vivante, fiches comprises (décision du
propriétaire du 2026-10-15 ; le serveur de dev reste ouvert à ceux qui y auront accès : [`api.md`](api.md), « Contenu des tables »).

## Le code

| Fichier | Rôle |
| --- | --- |
| `client/serveur/index.mjs` | Point d'entrée livré (variables d'environnement ci-dessous) |
| `client/serveur/service.mjs` | Serveur HTTP (`node:http`), surveillance des fichiers, arrêt propre |
| `client/serveur/api.mjs` | Routes : une requête lue → une réponse (JSON, sauf l'image d'un portrait et un classeur), sans réseau (testé directement) ; `POST /api/classeur/` rend une promesse, que `service.mjs` attend |
| `client/serveur/fiches.mjs` | Une fiche ↔ les lignes de la section 13 de `data/schema.sql` ; contrôles ; résumé pour la recherche |
| `client/serveur/base-vivante.mjs` | Création et renouvellement de la base vivante, archives |
| `client/serveur/classeur.mjs` | « Importer (en ligne) » de la fiche : le téléchargement d'une feuille Google Sheets partagée par lien (`POST /api/classeur/`, ci-dessous), la seule sortie du service sur Internet en production (le site de dev joint aussi l'API GitHub, pour la page « Mise à jour » : `serveur/notes-de-version.mjs#creerGithub`) |
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
| `db/vivante.json` | Empreinte SHA-256 des règles dont elle est faite, version du schéma, date |
| `db/archives/` | Les 5 dernières bases remplacées qui avaient des lignes de la section 13 |
| `db/metriques/` | Seulement sans dossier des métriques réglé (NAS, `npm run serveur`) : la base des métriques de l'instance (« Métriques et volume », plus bas) ; l'installateur de test ne la copie ni ne l'efface |

Pourquoi une copie des règles : les fiches citent les règles (race, classe, sorts…) par clés étrangères, et les contrôles (`v_personnage_controle`,
`v_personnage_niveau`) les joignent ; tout doit être dans la même base SQLite.

**Quand une livraison change les règles**, le service le voit (empreinte différente) et refait la base vivante : nouvelle copie des règles, puis
toutes les lignes de la section 13 y sont recopiées colonne par colonne (une colonne ajoutée prend sa valeur par défaut), et le journal de l'édition
est rejoué (site de dev, ci-dessous). Un **don, une spécialité (avec les dons choisis qui en dépendent), un sort, un métier ou une arme** que les nouvelles
règles n'ont plus est alors **retiré des fiches** qui l'utilisent, avec une note datée dans chacune (décisions R42, R52, « Fiches de personnage (R42) »
ci-dessous) ; `/api/etat` en donne la liste (`base.retraits` : `{ le, fiches }`, la dernière liste non vide, datée, gardée dans `vivante.json` par les
reconstructions qui ne retirent rien et au redémarrage). **Toute autre ligne qui ne passe pas** — une fiche cite une race, une classe, une magie… qui
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
Des règles qui ont encore la table alors que le service la sait retirée
(service et règles qui ne vont pas ensemble), ou une table retirée sans conversion, bloquent la reconstruction avec ce message. Une table retirée de la
section 13 va donc dans `TABLES_RETIREES`, avec sa conversion. La base remplacée est d'abord archivée (`db/archives/`) : l'archive garde donc la base
d'avant les retraits et les conversions (les gains niveau par niveau compris).

**Revenir à une version d'avant la migration 0045** (« Revenir sous la migration 0045 » de
[`deploy/installateur/README.md`](../deploy/installateur/README.md), qui donne les commandes) : le service d'avant ne relit pas une base vivante
refaite en 0045 (sans `personnage_progression`, toute lecture de fiche échoue) et refuse de la reconstruire (`gains_sante` et `gains_chakra`,
obligatoires, sont toujours remplis, même à 0). Il faut lui rendre l'archive faite à la reconstruction 0045 : la plus récente de `db/archives/` qui
a encore la table `personnage_progression`, **copiée à part avant tout** (seules les `ARCHIVES_GARDEES` = 5 dernières sont gardées : au-delà,
chaque reconstruction efface la plus ancienne ; l'installateur de test remplace le contenu de `db/`). **De même pour la migration 0055** : le service
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
| `POST /api/classeur/` | Corps `{ "url": "https://docs.google.com/spreadsheets/d/<id>/…" }` (« Importer (en ligne) » de `/fiche/`) → les octets `.xlsx` de la feuille, partagée par lien (pas du JSON : `Content-Type` du classeur, son nom dans `Content-Disposition`). Sur **les deux instances**, sans la base (répond pendant qu'elle se refait). `400` lien qui n'est pas celui d'une feuille Google Sheets ; `403` feuille non partagée par lien (Google renvoie vers sa page de connexion, répond 401 ou 403, ou rend une page HTML) ; `404` feuille introuvable ; `413` plus de 16 Mio ; `429` plus de 2 téléchargements à la fois ou de 30 par minute (tout le service), ou Google qui limite ; `502` Google en panne, injoignable ou qui renvoie ailleurs ; `504` plus de 20 s. Voir « Hébergement » |

Les adresses finissent par « / », comme celles du site : en développement, Astro refuse une adresse sans « / » finale avant de la transmettre au
service (qui accepte les deux formes).

**Une fiche en JSON** (`fiche-format.mjs`) : les colonnes de `personnage` à la racine, sous leur nom ; une liste par table de détail
(`classes`, `caracteristiques`, `competences`, `entrainements`, `acquis_choix`, `resistance_choix`, `metier_bonus`, `capacites`, `sorts`, `maitrises_armes`, `armes`,
`armure_parties`, `accessoires`, `inventaire`, `ceinture`), chaque ligne avec les colonnes de sa table sans `personnage_id` ; et `version`. Une page restée ouverte qui envoie encore
`bouclier_materiaux` (avant la migration 0060) voit sa liste convertie en matière du bouclier, les autres matériaux notés (avec les nouvelles clés du
bouclier : `409`) ; des accessoires avec un nom, un effet hors table ou un emplacement Ceinture ou Autre sont convertis de même (`sansPartiesRetirees`) ;
un texte `entrainement` (avant la migration 0062) devient des lignes de texte de `entrainements` (une par ligne du texte ; avec des lignes déjà là :
`409`) et l'`acquis` d'une compétence n'est plus repris, noté, daté, dans les notes (décision R104 : l'Acquis se calcule) ; des `sorts[].nm_cadeau`
(avant la migration 0066) donnent leur somme à `nm_mj` (décision R118 : les NM du MJ valent pour toute la fiche ; avec `nm_mj` et un `nm_cadeau`
positif : `409`, `nmDuMjAvecCadeaux`). Rien de calculé n'y est
stocké. Les gains de niveau sont deux colonnes (`gains_sante`, `gains_chakra` : décision R73, migration 0045) ; la durabilité d'une arme est une
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
  0066 ; convertis plus haut)
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
  refusée ; la page convertissant elle-même les `nm_cadeau` lus en `nm_mj`, une fiche qui a des NM du MJ ne s'enregistre pas sur cette base) ; sur une
  base d'avant 0060, la page convertit elle-même la fiche lue (accessoires d'avant, matériaux du bouclier) et note, datés, ce qu'elle perd. Une table de la fiche que la base n'a pas encore
  (`personnage_armure_partie`, 0055 ; `personnage_entrainement` et `personnage_acquis_choix`, 0062 ; `personnage_resistance_choix`, 0069, la
  résistance au choix du Drakos orange, liste `resistance_choix`) se lit vide, et une liste non vide pour elle est
  refusée (« pas encore dans cette base, ses lignes seraient perdues ») ; une colonne retirée qu'une base d'avant exige encore (`statut`,
  `competences[].acquis`) y prend sa valeur de départ.
- **Contrôles** : les règles de `v_personnage_controle` enfreintes sont rendues avec chaque fiche ; toute fiche est contrôlée, même inachevée, et
  les contrôles n'empêchent jamais d'enregistrer (une fiche n'a plus de statut brouillon / validé / archivé : demande du propriétaire, migration 0038).
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
| Guide | Titre et texte : éditeur en place (paragraphes, titres, citations, listes, gras, italique, barré, liens vers une page du wiki ou une adresse, tableaux, lignes, colonnes et couleur des cases), réécrit en Markdown (`lib/markdown-edition.mjs`) ; les blocs tirés de la base restent à leur place ; un ancien titre devient un alias ; un texte qui ajoute du HTML brut ou un lien non sûr (autre que http(s), mailto ou une adresse du site) est refusé, par le service puis par la mise à jour (lot reçu, puis corps des pages et texte des blocs de la chronologie et des panneaux de règles après le rejeu : `lib/markdown-sur.mjs`, `scripts/mise-a-jour-regles.mjs#texteNonSurApresLeRejeu`) et par le rapatriement (`npm run db:appliquer-edition`, après son rejeu : rien n'est écrit) |
| Races | Chaque case de l'onglet (présentation, histoire, valeurs de départ, avantages, dons et leur tableau, capacité Mode Hyper…), magies innées, relations entre peuples (déplacer ou ajouter une race ou une ethnie dans le tableau d'une race) ; créer une race (pure ou hybride) ou un peuple |
| Magies | Présentation, description, explication, rôles, Mode Hyper ; chaque case de chaque sort (type, mode, NM et états recalculés : `lib/sort-analyse.mjs` ; une ligne peut avoir un effet de NM dans plusieurs colonnes). La table des relations entre magies ne se modifie pas |
| Classes | Tous les champs (maîtrises, inventaire, spécialités, dons : tables de détail recalculées, `lib/classe-champs.mjs`) ; créer une classe dans une catégorie ; une classe raciale se crée pour une race hybride qui n'en a pas encore ; créer et supprimer une spécialité (avec son don de spécialité du niveau 10) ou un don (D11, ci-dessous) |
| Codex | Titre et texte des pages tirées du Google Doc « CODEX Maverick » (`lib/edition-modele.mjs#texteDePageModifiable` ; pas la description des relations entre les peuples, tirée du classeur des races), avec l'éditeur du guide (toute la page est un seul morceau de texte) ; `tools/docs/codex.py --verifier` contrôle une page que le site a modifiée dans son état d'import, et une nouvelle écriture des pages la garde telle quelle (docs/codex.md) |
| Bestiaire | Les monstres (`docs/bestiaire.md`, « Modifier le bestiaire ») : les champs de la carte ouverte (nom, catégorie, type, alignement, échelle, description de la créature (R65), texte de chaque rubrique ; de l'espèce : nom, échelles, description, lieu, complément, blocs, cases de butin ; du groupe d'espèces, « Ottar » : nom et description, R64 ; les capacités : nom et description d'une capacité commune, pour toutes ses cartes, son préfixe et la liste de sorts d'un « Lanceur de sorts » sur la carte, la valeur de chaque « {N} » au curseur, ajout et retrait d'une capacité, décisions R66 à R69) ; ajouter un monstre (une carte dans une espèce, rubriques vides) ou une espèce, supprimer une carte ou une espèce sans carte ; bornes des échelles, écriture de la catégorie, lieux de rencontre, valeurs typées et tables de détail d'une carte recalculés par les fonctions de l'extraction (`lib/monstre-champs.mjs`, `serveur/edition-bestiaire.mjs`) ; le portrait d'une carte ou d'une espèce sans carte (choisi, recadré ou retiré comme sur la fiche de personnage, `src/scripts/portrait.mjs` ; enregistré tout de suite, seul dans son lot ; cadrage gardé dans l'image par le service) ; le curseur d'échelle de la carte et les infobulles du butin refaits avec la carte (rendus `monstre-echelle`, `monstre-butin` : le tableau de l'introduction et le glossaire du butin viennent de `GET /api/edition/listes/`, `echellesDePuissance`, `objetsDuButin`, `renvoisAuxDegatsMoyens`). Les créatures invoquées ne se modifient pas ici |
| Armes | onglet Armes de `/ressources/equipement/` (« tout peut être éditable à l'instar des autres pages ») : en mode modification, rien ne se sélectionne et tous les tableaux s'ouvrent. Chaque arme (sauf les armes de monstres) : nom, mains, compétence (une écriture de l'onglet), type, coût, effet, description, arme de départ, remarque (l'étoile ★ à côté du nom, refaite à l'enregistrement ; vidée, elle part : R91) ; dé, bonus, portée, solidité, provenance, types de dégâts et minimums de caractéristique en sont recalculés (`lib/arme-champs.mjs`, rejoué sur toute la base), les colonnes tirées se réaffichent après l'enregistrement. Ajouter une arme (famille, nom, catégorie, type, effet… : à la fin du tableau de sa famille) ou la supprimer (retirée des fiches qui l'ont, avec une note datée : R52, comme R42). Les matériaux sont en lecture (décision R62 : ils se modifient sur la page « Composants », la page des armes suit). Chaque amélioration d'arme : coût et effet (la ligne TOTAL est refaite dans la base et le corps Markdown ; la page ne l'affiche plus depuis le 2026-10-16). Le corps Markdown de la page suit, ligne à ligne, remarques comprises (une entrée « **Remarque de l’arme « Nom »** : … » sous le tableau de la famille, à la place de celles de l'importeur : `lib/corps-armes.mjs`, `serveur/edition-armes.mjs`) |
| Armures et boucliers | onglets Armures et Boucliers de `/ressources/equipement/` (refaite « de la même manière que les Armes », « Modifiable tout de suite », 2026-10-15) : en mode modification, rien ne se sélectionne, les fiches se ferment et tous les tableaux des deux onglets s'ouvrent. Chaque armure : nom, type, AP et AM (chacun dans sa case, demande du propriétaire du 2026-10-17 ; vide = pas de bonus), solidité, résistance et faiblesse (une armure de la grille) ou effet et prix (une armure particulière ; le prix d'une armure de la grille est calculé, la fabrication + 6 unités de chaque matériau : décision R93, il ne se modifie plus sur la page) ; le prix, la défense écrite (`stats_brut`, refaite depuis l'AP et l'AM, gardée telle qu'écrite tant qu'elle se lit exactement en eux) et les résistances et faiblesses (`armure_degats`) en sont recalculés (`lib/armure-champs.mjs`, rejoué sur toute la base). Le coût de fabrication de l'armure complète (dans la phrase du prix, onglet Armures ; les prix de la liste et la fiche le suivent) et celui du bouclier (sous les formes) : les deux lignes du tableau FABRICATION que la page affiche encore (le coût en RF suit ; les autres lignes, les pièces, ne sont plus affichées depuis R93 et ne se modifient que par `/api/v1/emplacements-d-armure/`), forme de bouclier (nom, prix), bouclier préfabriqué (nom, AP et AM chacun dans sa case, prix, poids au choix parmi la liste : décision R92 ; la défense écrite `defense_brut` suit), poids de bouclier (nom, Force ; la Force minimum suit ; leur tableau ne s'affiche qu'en mode modification et sans JavaScript), amélioration d'armure (coût, effet écrits ; RO, matériaux, AP, AM et crans en sont tirés) ou de bouclier (quatre cases, demande du propriétaire du 2026-10-17 : coût en RO, coût en matériaux Oui / Non — 1 matériau, R76 —, AP supplémentaire, +1 cran de solidité Oui / Non ; le coût et l'effet écrits en sont refaits) ; chaque cible refuse les cases de l'autre ; la ligne TOTAL est refaite dans la base et le corps Markdown, la page ne l'affiche plus. Un lot noté avant (défense, coût ou effet d'une amélioration de bouclier saisis en texte) ne se rejoue que si la ligne après lui a un texte qui se lit exactement en ses cases (règles + lots du journal qui passent + lui) ; sinon il passe en conflit expliqué, sans compter pour les lots suivants (`serveur/edition-armures.mjs#ancienneEcritureDesArmures`). Refusés : un prix qui écrit un nombre illisible (« 2050 RO » ; « ???? » ou une case vide disent que la source ne le donne pas), un coût de pièce sans « N RF » (hors « / Classe » du bouclier), un nom d'armure sans lettre ni chiffre, un type hors de la liste. Ni création ni suppression (les fiches de personnage les citent). Les matériaux sont en lecture (R62). Le corps Markdown des pages « Armures » et « Bouclier » suit, ligne à ligne (`lib/corps-armures.mjs`, `serveur/edition-armures.mjs`) |
| Panneaux de règles | en tête de chaque onglet ou sous-onglet de `/ressources/equipement/` qui sert une page du wiki (Armes, Armures, Boucliers, Accessoires, et Bâtons magiques dans l'onglet Ceinture, qui n'en a pas : ses règles sont le texte du guide, modifiable sur la page du guide) (`docs/content-guide.md`, « Panneaux de règles » ; migration `0056` ; « Il faudrait que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours insérables / modifiables en mode édition) », 2026-10-16) : en mode modification, chaque panneau s'ouvre et reste ouvert (un clic, une espace ou Entrée dans son `<summary>` ne le replient pas). Son titre (`panneau_regles.titre`, un champ commun dans le `<summary>`) ; le texte de chaque bloc et le contenu de chaque tuile, modifiés en place avec l'éditeur de la chronologie (Texte, Mise en page, Liens ; Markdown sûr, `lib/markdown-sur.mjs`, comme le guide : refusé par le service, dans un lot reçu et après le rejeu de la mise à jour ou du rapatriement ; un texte n'est envoyé que si son Markdown relu diffère de celui relu à l'entrée en mode modification, pas du texte de la base, que l'éditeur réécrit en apostrophes typographiques), le titre d'une tuile (un champ ; refusé sur un bloc de texte, `400`) ; sous chaque bloc, « ↑ » et « ↓ » (deux blocs échangent leurs ordres, `panneau_regles_bloc.ordre`, envoyés avec « Enregistrer » : `lib/panneaux-regles-db.mjs#ordresApresDeplacement`), « Supprimer » (à l'enregistrement, après confirmation ; le dernier bloc d'un panneau ne se supprime pas, `409`), « + Texte » et « + Tuile » (créés tout de suite après ce bloc : entité `panneau_regles_bloc`, champ `apres` = le rang du bloc après lequel l'insérer, vide = à la fin ; les blocs suivants sont repoussés d'une place, chaque décalage noté au journal : `ordresApresInsertion`). Un bloc créé prend un rang jamais employé (table, journal et historique). Le corps des pages « Armes »… (`page.corps_md`) n'est plus que la trace de l'import : jamais touché. Surcouche : une ligne de bloc modifiée depuis la construction refait son bloc (s'il a changé de texte, d'après son empreinte `data-preg-empreinte`) dans le navigateur, avec `lib/chronologie-rendu.mjs#htmlDuTexte` (HTML : `lib/panneaux-regles-rendu.mjs`, le même qu'au build) : **les icônes de monnaie n'y sont qu'au build suivant** (le texte reste « 100 Ro ») ; le bloc est remis à sa place de lecture, ou retiré. Service : `serveur/edition-panneaux.mjs` ; page : `src/scripts/edition/panneaux.mjs` |
| Liens (encart « Notre prochaine rencontre IRL ») | `/decouvrir/liens/` (demande du propriétaire du 2026-10-18 : titre fixe, annonce modifiable sur le site de dev) : le texte de l'annonce (table `annonce`, migration `0068-annonces`) se modifie en place (`src/scripts/edition/annonces.mjs` ; la barre d'outils des panneaux de règles : texte, mise en page, liens, mots-clés) ; vide, la zone s'ouvre vide, le texte d'attente en filigrane ; vidée, elle repart à NULL (« Aucune rencontre annoncée pour le moment. ») ; Markdown sûr et balises canoniques comme le guide (`serveur/edition.mjs#ANNONCE`), contrôlé aussi par la mise à jour (`TEXTES_EN_MARKDOWN`, `texteNonSurApresLeRejeu`) ; ni création ni suppression ; note de version : domaine Guide, groupe Découvrir |
| Composants | `/ressources/composants/` (`docs/content-guide.md`, « Composants ») : monnaies, matériaux, gemmes, bois, ingrédients d'alchimie (fruits compris), objets de l'onglet « Équipement inventaire », un onglet par tableau. Le titre et la note de chaque onglet (table `composant_onglet`, migration `0057` ; demande du propriétaire du 2026-10-17 : « modifiables et directement liées en base » ; titre obligatoire, note vidée = NULL ; ni création ni suppression : un onglet par tableau). Chaque case se modifie (prix en RF, CONVERTISSEUR, type, marque majeur et affinité d'un ingrédient recalculés : `lib/composants-champs.mjs`) ; ajouter dans chaque tableau ; supprimer ce que rien d'autre ne cite (refus 409 qui nomme les règles qui le citent) ; un objet supprimé reste dans l'inventaire et la ceinture des fiches sous son nom, sans lien au catalogue (`ressource_id` = NULL), avec une note datée (décision R60 ; aussi à la reconstruction de la base vivante, `fiches-retraits.mjs#OBJETS_AU_CATALOGUE`). Les valeurs des monnaies ne se modifient pas (R61) ; les matériaux ne se modifient qu'ici (R62 : type, prix recopié dans `materiau_arme`, effets sur une arme). Le corps des pages qui écrivent ces composants suit (`lib/corps-composants.mjs`, `serveur/edition-composants.mjs`) |
| Consommables de la ceinture | sous-onglet Consommables de l'onglet Ceinture de `/ressources/equipement/` (`docs/content-guide.md`, « Ceinture » ; « Les tableaux des consommables devrai pouvoir aussi être modifiées . (sauf pour les champ calculés) », 2026-10-17) : les quatre cases saisies de chaque potion, par l'éditeur commun — nom et prix (`ressource` de genre `potion` : `nom_cle` et prix en RF recalculés ; un nom qui ne diffère d'un autre palier de la même page que par la casse, les accents ou les signes est refusé, 409), niveau (`potion.niveau_id`, liste `niveauxDAlchimie`) et effet (`potion.effet` : ses altérations d'état `potion_etat` refaites, `lib/potion-etats.mjs`) ; le tableau du palier dans la page de la potion suit (`lib/corps-potions.mjs`, aussi au rejeu : `recalculerLesPages`) ; une description de potion est refusée (l'onglet n'en montre pas) ; ni création ni suppression ; en lecture : couleur de la ligne, valeur en RF, titre et résumé d'un groupe, carquois et sacs (page « Composants »), bâtons (`serveur/edition-consommables.mjs`, `ressourcesParGenre` : une autre ressource reste au domaine des composants) |
| Métiers | Ajouter, modifier, supprimer (retiré des fiches qui l'ont, avec une note : R42) ; bonus (et leur compétence ou l'initiative, décision R33), objets de départ (R35) et recettes recalculés (`lib/metier-champs.mjs`) ; artisanat en trois champs, texte et deux listes de caractéristiques (R34 : « Artisanat possible » en est recalculé, une seule caractéristique est refusée, sans texte elles partent) ; corps de la page (`lib/corps-metiers.mjs` : un champ réécrit en entier, paragraphes compris, ses liens `[[…]]` gardés tant que leur texte reste écrit) ; filtres et tri par colonne |
| Chronologie | Chaque événement (`/chronologie/<id>/`, [`chronologie.md`](chronologie.md), « Modifier la chronologie ») : date (époque, année, année de fin ; l'événement prend sa place d'après elle), titre, portée et lieu d'un Impact, catégories (cases à cocher, plusieurs au choix ; opération `categories`), descriptions (blocs modifiés en place avec l'éditeur du guide — leur rendu dans le navigateur, `lib/chronologie-rendu.mjs`, redonne le Markdown du build, `test/chronologie-rendu.test.mjs` —, leur lien vers une page du wiki ; en ajouter, en retirer, une au moins) ; créer un événement (« + Nouvel événement », affiché sur `/chronologie/?evenement=<id>` jusqu'à la version suivante du site) ou le supprimer (avec ses blocs et ses catégories) ; le bouton « Catégories » : créer, renommer, supprimer une catégorie (`categorie_chronologie` : id figé, écriture unique, jamais `sans-categorie` ; supprimée, elle quitte ses événements), enregistré d'un bloc à part. La frise et l'événement affiché sont refaits d'après la base vivante au chargement (`GET /api/edition/chronologie/`). Service : `serveur/edition-chronologie.mjs` ; page : `src/scripts/edition/chronologie.mjs` |
| Mots-clés | Le glossaire (migration `0056`, `docs/content-guide.md`, « Mots-clés (glossaire) ») sur la page Recherche (`/recherche/`, extension `src/scripts/edition/mots-cles.mjs`), en mode modification : la liste relue dans la base vivante (`GET /api/edition/mots-cles/`, définitions comprises), chaque libellé modifiable, la **définition** de chaque mot-clé (`mot_cle.description` : champ commun, protégés compris ; vidée, `NULL`), la balise à copier (`{{id}}`), « Fusionner dans… » et « Supprimer » mis en file et envoyés avec « Enregistrer » (ordre du lot : fusions, suppressions, renommages : `lib/mots-cles-edition.mjs`, confirmés une fois avec ce qu'ils retirent), « + Ajouter un mot-clé » créé tout de suite, avec sa définition ; un renommage vers l'écriture d'un autre mot-clé propose la fusion (`fusionner_mots_cles`, sinon `409`). Créer, renommer, fusionner et supprimer un mot-clé du vocabulaire (`mot_cle`, migration `0043`) ; une suppression le retire de toutes les pages qui le portent (clé étrangère `ON DELETE CASCADE`, et le service les retire d'abord pour le journal ; les événements de la chronologie n'ont pas d'étiquette mais des catégories) et de **tous les textes qui le citent** (chaque balise devient son texte simple, « Libellé : définition » pour le mode complet : colonnes « ligne », « texte », « markdown » des tables de `TABLES`, définitions des autres mots-clés comprises, chacune par une modification ordinaire du lot, dérivations et journal compris : `serveur/edition.mjs#reecrireLesBalises`) ; une fusion recible ses balises (leur texte gardé). Renommer ne change aucun texte (les balises citent l'id : un texte de case garde le texte écrit de ses balises, un texte mis en forme montre le nouveau libellé). Les mots-clés qui rangent les pages du site (catégories des classes, « classe », « race », « race hybride », « capacité de classe », « métier », « codex » : `lib/mots-cles.mjs#MOTS_CLES_PROTEGES`), et « Sort grenade », que la fiche lit (décision R114), ne se suppriment, ne se renomment (pas même leur casse : les règles lisent leur écriture exacte), ne se fusionnent ni ne se créent seuls (`409`, avec la raison) ; leur définition se modifie. Un mot-clé qui étiquette un sort (`sort_mot_cle`, migration `0067`) ne se supprime ni ne se fusionne, dans un sens ou l'autre (`409`, avec les sorts qu'il étiquette : `serveur/edition-chronologie.mjs#verifierSansSort` ; la clé étrangère, sans cascade, le refuserait aussi). Une page créée depuis le site (race, classe, métier, don) ne porte que ces mots-clés-là (`motCleDe` ne crée plus de mot-clé libre ; une fiche de don : « capacité de classe » seul). Son identifiant est figé. Un renommage, une fusion ou un retrait sur une page du Codex la fait compter comme « modifiée par le site » par `tools/docs/codex.py` (gardée telle quelle, ses mots-clés non comparés au document) |

**Balises du glossaire** (migration `0056`, `lib/mots-cles-balises.mjs`) : toute valeur texte d'un lot (un champ de `CHAMPS_DE_TEXTE` :
« ligne », « texte » ou « markdown », d'une modification ou d'une création, API `/api/v1/` comprise) est enregistrée sous sa **forme canonique**, l'id
du mot-clé pour ref, selon la colonne (`lib/edition-modele.mjs#typeDeTexte`) — un texte mis en forme (« markdown ») : `{{id}}` (le texte affiché suit le
libellé ; le libellé écrit en texte y revient), `{{id|texte}}` pour un autre texte (« \| » sur une ligne de tableau Markdown), `{{id:}}` ; une balise
dans un code y reste telle quelle ; un texte de case (« ligne », « texte ») : `{{id|texte}}` toujours (le texte écrit, sinon le libellé du moment), le
mode complet refusé (`400`, « le mode complet ne s'écrit que dans un texte mis en forme ») — avant les dérivations : c'est elle que voient les
découpages (qui lisent le texte sans balises sans le vocabulaire : `texteSansBalises`) et que note le journal. Une balise dont la ref (id ou écriture)
n'est pas un mot-clé, ou dont la ref est à la fois l'id d'un mot-clé et l'écriture d'un autre (`ambiguiteDe` : préciser l'id voulu), est refusée
(`400`, la ref citée), sauf si la valeur en place l'avait déjà (un texte d'avant la suppression de son mot-clé se modifie encore). `db:check` lit les
balises de toutes les colonnes de texte des règles et des pages (`lib/mots-cles-db.mjs#textesDeLaBase` : ni les sections 13 à 15, ni les tables dérivées
`lien` et `lien_candidat`, que le build refait, ni les traces gardées telles quelles — notes de cellule, écarts, corrections, commentaires orphelins,
alias, sources — : `lib/tables-de-la-base.mjs`) et refuse une ref qui n'est pas un id et une forme
non canonique pour la colonne (`formesNonCanoniques`, la règle de `formeCanonique` : une balise écrite autrement, espaces ou séparateur compris, sauf
le libellé écrit en texte dans un texte mis en forme, `{{id|Libellé}}`). Le HTML que
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
modifiées (`lib/sort-etats.mjs`, la règle de l'importeur, qui redonne les lignes des 322 sorts) ; un sort renommé l'est aussi dans les panneaux
« Effet "…" » des créatures (`creature_effet`) et le titre de ce panneau dans leur page ; un peuple créé a sa case diagonale « Même peuple ».

Le **corps des pages typées** (et leur résumé), qui sert à la recherche (`page_fts`), aux `[[liens]]` et à `races_onglet.py --verifier`, est refait
depuis les tables à chaque modification, avec le rendu de leur importeur : morceaux d'une page de magie (`lib/corps-magies.mjs` : présentation, rôles,
Mode Hyper, ligne, notes et texte d'un sort), sections de l'onglet d'une race et listes des classes et magies accessibles (`lib/corps-races.mjs` ; les
citations de la fiche V15.2.2 restent), page entière d'une classe ou d'un don (`lib/corps-classes.mjs`), champs d'un métier (`lib/corps-metiers.mjs`) ;
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
type parmi les cinq mots que `analyserTypeDeDon` reconnaît, précision, effet, niveau) ; le reste applique des règles déjà écrites :

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
  qu'une fiche de personnage cite n'est plus refusée : elle est retirée de la fiche (R42, ci-dessous).

La fiche d'un don créé (`capacites/<slug>`) a pour seule source sa provenance, son seul mot-clé « capacité de classe » (depuis la migration 0056 : ni
la classe ni la spécialité, et renommer une spécialité ne touche plus aux mots-clés), son corps et son résumé tirés de sa ligne ; ses champs structurés (`page.donnees` : classe, spécialité, niveau, nature,
rang, ligne, type, choix exclusifs) sont **une colonne dérivée** (`donneesDeDon`, qui redonne les 660 fiches de l'import à l'octet près), refaite à
chaque écriture et au rejeu pour tous les dons de la classe touchée : une livraison qui change un voisin (spécialité renommée, type) ne met plus une
création en conflit. Une suppression retire, dans l'ordre des clés étrangères, les notes de cellule du don, sa ligne, puis sa fiche (mots-clés,
sources, entités rattachées, source orpheline). `POST /api/edition/classe/` donne l'état vivant de la classe (spécialités, dons, choix, fiches qui
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
la composition, l'amélioration et l'élément de cet emplacement) part, `personnage_classe.specialite_id`
passe à `NULL` (la classe reste) avec les dons choisis de la spécialité, `personnage.metier_id` passe à `NULL` avec les bonus « A OU B » que la fiche
y avait choisis (`personnage_metier_bonus`) (un sort, que le site ne supprime pas
encore, partirait de `personnage_sort` ; à la reconstruction, les quatre sont retirés, sauf un don, une spécialité ou un sort dont la classe ou la
magie a disparu aussi : celle-ci reste un blocage, hors R42). Le retrait se fait **dans le même lot**, avant la suppression
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
(`GET /api/edition/en-attente/`) et les réaffiche (pour une page du guide : l'aperçu HTML noté avec le texte, assaini) ; une race ou une classe
créée a sa page provisoire sur la page 404 du site de dev, jusqu'à la livraison suivante.

**Quand une livraison change les règles**, la base vivante est refaite (ci-dessus) et le journal y est **rejoué**, lot par lot : une modification
déjà présente dans les nouvelles règles passe « intégrée », un lot qui contredit les nouvelles règles passe « conflit » en entier (rien n'en est
réappliqué) ; `/api/etat/` compte les modifications `en_attente` et `conflit`, affichées à côté du crayon. L'ordre de rejeu (`ORDRE_DE_REJEU` :
instant du lot, puis son identifiant, puis le rang) est le même pour le service, `db:appliquer-edition` et la mise à jour des règles ; l'instant
est à la seconde, l'identifiant d'un lot commence par l'instant à la milliseconde et un compteur (`nouveauLot`) : deux lots de la même seconde
se rejouent dans l'ordre où ils ont été enregistrés. Une colonne qui vaut déjà ce qu'une modification plus récente de la même ligne y écrit est
« déjà là » (deux lots sur la même colonne, une ligne créée puis modifiée) — sauf si elle vaut encore ce que la modification avait trouvé (`avant`) :
elle n'est alors pas faite et se fait (A → B → A : un lot suivant peut compter sur B, un nom de catégorie ou de mot-clé libéré, une date intermédiaire ;
les lots déjà livrés, eux, ne sont jamais rejoués). **Point fixe** : un lot en conflit le reste — la reconstruction suivante ne le relit pas, le
journal exporté (mise à jour, `db:appliquer-edition`) ne l'emporte pas. Le rejeu se fait donc par passes : chaque lot tombé en conflit est écarté et
la passe recommence sans lui (ni parmi les modifications « plus récentes » d'une ligne, ni parmi les lignes fantômes), jusqu'à ce qu'une passe n'en
écarte plus. Le résultat est celui des seuls lots qui passent : la reconstruction suivante et le rejeu du journal exporté le redonnent, sans conflit
nouveau (`test/serveur-edition-rejeu-fantomes.test.mjs`, dont les scénarios des revues adverses). Une ligne créée puis supprimée par le journal en
attente est « fantôme » le temps de cette vie : elle n'est pas insérée (ses modifications non plus), et une ligne qui la citait entre-temps (un bloc
de la chronologie lié à la page d'un métier créé puis supprimé) ne met pas son lot en conflit. Rien n'en est noté : ses modifications restent en
attente jusqu'à la livraison et sont réévaluées à chaque rejeu. À la fin d'une passe, un fantôme qu'une référence cite encore (le lot qui retirait la
citation est en conflit ; une clé étrangère qui ne vise pas la clé primaire, comme `capacite(specialite_id, classe_id)`, est comparée aux valeurs de
ses insertions) est écarté : la passe recommence avec sa ligne rejouée comme une autre — créée, modifiée, et supprimée seulement si plus rien ne la
cite. Aucune référence n'est jamais laissée rompue, et une création dont la suppression est en conflit existe entière. Le service ne vide le
dictionnaire des sources que de ses orphelins (`supprimerPage`) : rejouée alors qu'une page la cite encore (sa suppression est en conflit), la
suppression d'une source n'est pas faite (`siOrphelines`). Un bloc de description de la chronologie, ou d'un panneau de règles, ne reprend jamais le
rang d'un bloc supprimé (`serveur/edition.mjs#rangLibre`, commun aux deux : table, journal et historique). Supprimer un mot-clé (`mot_cle`) rejoue aussi les `ON DELETE CASCADE` de `page_tag`, que la mise à jour
des règles a donc le droit d'écrire ; et, pendant de cette cascade, au même moment (dans son lot, annulé avec lui : `apresLeLot` de `rejouer`,
`balisesRetireesParLeLot`), un mot-clé que le lot supprime ou fusionne quitte les balises de **tous les textes** de la base où il est rejoué (colonnes de
texte des règles et des pages, `textesDeLaBase` : pages d'exemple et textes que le site de dev n'avait pas compris) — retirées (leur texte simple), ou
reciblées pour une fusion dont la cible se reconnaît aux étiquettes ou aux balises que le lot a reportées (`cibleReportee`) — : un lot suivant qui
modifie un de ces textes (le site de dev l'a lu ainsi réécrit, sa base vivante refaite par le même rejeu) le retrouve tel qu'il l'a lu, et passe. Les
colonnes dérivées (corps et résumé des pages typées) sont refaites ensuite depuis leurs tables (`recalculerLesPages`, qui reçoit ces réécritures comme
des lignes rejouées), puis ce qu'il y reste est retiré (`balisesDesColonnesDerivees` : pages d'exemple ; une colonne dérivée n'est jamais comparée au
rejeu). Tables comptées dans `tablesCompletees`, `page` comprise (le job GitHub de la mise à jour les permet de même : `tablesDuLot`, d'après les
fichiers de `data/rows` qui ont une balise, `tablesAvecBalises`, et `page`). Un lot noté avant la migration 0056 (le glossaire) qui pose sur une page l'étiquette d'un
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
ces tables parmi celles qu'elle a le droit d'écrire (`tablesCompletees`). Rejouée clés
étrangères coupées (base vivante refaite, mise à jour des règles), une suppression applique d'abord les `ON DELETE CASCADE` du schéma (`lien`,
`lien_candidat` : les `[[liens]]` d'une page supprimée), sans les noter, comme SQLite le fait dans la base vivante ; sinon supprimer une page qui a des
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
npm run db:appliquer-edition -- ~/Téléchargements/journal-edition-AAAA-MM-JJ.json   # rejoue le journal sur data/rows (rien d'écrit en cas de conflit)
npm run db:build && npm run db:check && npm test                                    # puis commit de data/rows (PR vers dev)
```

Les modifications rejouées (réappliquées ou déjà présentes) sont versées dans `historique_modification` avec `version` vide (rapatriées à la
main ; un lot déjà dans l'historique n'est pas repris), puis les tables du journal sont vidées. Une fois livrées, ces modifications reviennent
« intégrées » sur le site de dev. Le site est la source des données qu'il modifie (ci-dessous, « Mise à jour ») : les tests ne s'arrêtent plus sur
une valeur que le site a changée.

| Requête | Réponse |
| --- | --- |
| `GET /api/edition/en-attente/` | Lignes modifiées depuis la construction des pages (`{ lignes: [{ table, cle, creee, ligne, apercu? }] }`) |
| `POST /api/edition/lignes/` | `{ lignes: [{ table, cle }] }` → la ligne actuelle de chacune (passage en mode modification) |
| `GET /api/edition/listes/` | Listes des formulaires (compétences, catégories de classe, races hybrides sans classe raciale…) |
| `GET /api/edition/pages/` | Les pages du wiki (`id`, `titre`) : cibles d'un lien posé dans le texte du guide |
| `GET /api/edition/mots-cles/` | `{ motsCles: [{ id, libelle, libelle_cle, description, pages, protege }] }` : le glossaire dans la base vivante (`description` : la définition telle qu'enregistrée, `NULL` tant qu'il n'est pas décrit ; `pages` : le nombre de pages qui le portent) (vue `v_mot_cle` et `mot_cle` ; `protege` : la raison qui interdit de le supprimer ou d'en changer la clé, sinon `null`) |
| `GET /api/edition/chronologie/` | `{ evenements: [...], categories: [...] }` : les événements dans l'ordre de lecture, avec leur date, leur portée et leurs catégories, et les catégories avec leur nombre d'événements (la frise refaite au chargement, la gestion des catégories) |
| `POST /api/edition/evenement/` | `{ evenement }` → l'événement, ses blocs (texte, lien, titre de la page liée) et ses catégories ; `404` s'il n'existe pas (ou plus) |
| `POST /api/edition/race/` | `{ race }` → magies innées et relations de la race dans la base vivante |
| `POST /api/edition/classe/` | `{ classe }` → spécialités, dons, choix et fiches qui les citent (qui en seront retirées), dans la base vivante (D11) |
| `POST /api/edition/bestiaire/` | `{ connues, logo }` → l'ordre des lignes du tableau des monstres (`ordre` : leurs identifiants) et, pour celles que la page n'a pas (`connues`), la ligne et la carte en HTML (`lib/bestiaire-rendu.mjs`, comme la page construite, sauf le lien du nom, qui mène à la carte dans la page (`#carte-…`) : un monstre créé depuis la construction n'a pas de page ; le logo à la place du portrait, que le mode modification charge ensuite) ; `{ capacites: [ids des cartes] }` → `{ capacites: { id: html } }` : le bloc des capacités de ces cartes (`htmlDesCapacitesDeLaCarte`), après une modification de leurs capacités ou d'une capacité commune qu'elles ont (décision R66) |
| `POST /api/edition/portrait/` | `{ table, cle }` → le portrait d'une carte de monstre ou d'une espèce, en entier (`portrait` : data URL, ou null) et son cadrage. Les autres réponses (lignes lues, en attente, d'un lot, d'un conflit) ne donnent d'une image que `{ image: true, empreinte, resume }` (`lib/edition-modele.mjs#ligneSansImage`) : 700 000 caractères par image |
| `POST /api/edition/` | `{ page, operations: [...] }` → applique un lot d'un bloc (`modifier`, `creer`, `supprimer`, `relations`, `magies_innees`, `categories`, `fusionner_mots_cles` : `serveur/edition.mjs` ; `valeurs_de_capacite` : les valeurs « {N} » d'une capacité de monstre pour une carte, décision R69, `serveur/edition-bestiaire.mjs`) ; rend `{ lot, modifications, crees, lignes, fiches }` (`fiches` : les fiches de personnage dont le lot a retiré un élément, R42) |
| `GET /api/edition/journal/` | Le journal des modifications en attente, et des « intégrées » des lots que les règles n'ont pas encore reçus (`maverick-edition/1`), en pièce jointe |

**Avant la 1.0, pas de comptes** : quiconque a le mot de passe du site de dev peut modifier les règles (le journal n'a pas d'auteur :
`modification_lot.auteur_id` attend la connexion Discord). Mêmes protections d'écriture que les fiches (JSON, `Sec-Fetch-Site`).

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
(`GET /api/mise-a-jour/`) : la base de la **production** (référence : la base de master, construite au build à côté de celle du site,
`site/donnees/reference.db` et `reference.json`, `scripts/db-reference.mjs`) comparée à la base vivante (règles de dev + modifications du site).
Seuls les champs que le site modifie sont comparés (`lib/edition-modele.mjs#TABLES`) : le reste en est dérivé (depuis la migration `0043`, la chronologie
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
reste cochée s'il est annulé, et revient à X.Y+1 quand la livraison du lot vide le brouillon. Pour ce lot, la note de version est la X+1.0 et la
PR de livraison `dev` → `master` porte `[V: X+1]` dans son titre : `livraison.yml` fait alors la X+1.0.0 ([`flux-git.md`](flux-git.md)).

**« Effectuer la mise à jour »** (et « Simulation de mise à jour », sur tous les écrans ; pas de protection avant la connexion Discord, décision du propriétaire) : après
confirmation (taper `METTRE A JOUR`), le service **fige un lot** — le journal en attente (sans l'aperçu HTML du guide), le champ libre, les
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
— master — porte la version de sa note : jamais par la seule arrivée de la note dans dev). Un échec **avant** dev donne `echec` (annulable) ;
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
(lot, rang, date, table, clé, opération, avant, après). `client/src/lib/historique-site.mjs` le relit (`historiqueSite(db)`) : `creee`,
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

| Requête | Réponse |
| --- | --- |
| `GET /api/mise-a-jour/` | La note en préparation : `reference`, `version_dev`, `version_cible` (selon la case « Version majeure »), `version_mineure`, `version_majeure`, `en_attente`, `lignes`, `bilan`, `brouillon` (dont `majeure`), `lancement`, `github`, `confirmation` |
| `POST /api/mise-a-jour/brouillon/` | `{ texte, avant }` → le champ libre enregistré (`409` s'il a changé entre-temps ou si un lot est figé) |
| `POST /api/mise-a-jour/majeure/` | `{ majeure }` (`true` ou `false`) → la case « Version majeure » enregistrée, et la note en préparation à sa nouvelle version cible ; rien n'est déclenché (`409` si un lot est figé) |
| `POST /api/mise-a-jour/lancer/` | `{ confirmation, simulation? }` → fige le lot et déclenche le workflow (`simulation: true` : simulation de mise à jour, rien n'est poussé) → `202`, `{ lancement }` (`etat` : `envoi`, `lance`, `en_cours`, `termine`, `echec`, `erreur`, `manuel`, `annule`, `simulation_reussie`, `simulation_echouee`) |
| `POST /api/mise-a-jour/liberer/` | Annule un lancement qui n'est pas parti, a échoué ou se lance à la main : le texte redevient modifiable (annulé pendant l'envoi : le run parti quand même est annulé sur GitHub) |
| `GET /api/mise-a-jour/lancement/` | L'état du lancement (le run GitHub est relu au plus toutes les 20 s) |
| `GET /api/mise-a-jour/lots/<lot>/` | Le lot figé, octet pour octet (le workflow le télécharge et vérifie son empreinte) |

**Mise en place** (une fois) : le secret `MISE_A_JOUR_TOKEN` du dépôt (jeton fine-grained d'un administrateur, ce dépôt seulement : *Contents*,
*Pull requests* et *Workflows* en écriture ; le jeton d'un workflow ne déclenche ni la CI ni `livraison.yml` ; seul le job `livrer` le reçoit)
et, sur le serveur de test, le fichier `secrets/github-actions-token` (jeton fine-grained, ce dépôt seulement : *Actions* en écriture), pas à
pas dans [`deploy/vps/README.md`](../deploy/vps/README.md). Chaque mise à jour consomme environ quatre passages de la CI (préparation, PR,
livraison, publication) en minutes GitHub Actions ; une simulation, un seul (la préparation).

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
règles (`actualiserLancement` : note arrivée → `fusionne`, version livrée sur master → `termine`), puis republie l'annonce ; sans minuterie
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

## Hébergement

Deux conteneurs dans le même `docker-compose.yml` : celui des [installateurs](../deploy/installateur/README.md), qui posent le serveur normal et le
serveur de test ([`deploy/vps/`](../deploy/vps/README.md)), et celui du paquet du NAS ([`deploy/`](../deploy/README.md)) :

- **nginx** sert `site/` et transmet `/api/` au service (`deploy/nginx.conf`, le même fichier pour le NAS et les installateurs), derrière le
  même mot de passe. L'adresse du service est résolue à chaque requête : nginx démarre sans lui, et si le service est arrêté, `/api/` répond 502
  pendant que les pages de lecture restent servies.
- **serveur** (`node:22-alpine`) exécute `site/_serveur/serveur/index.mjs` ; aucun port publié (seul nginx l'atteint). Variables :
  `MAVERICK_REGLES` (base des règles, `/site/donnees/maverick.db`), `MAVERICK_DB` (dossier de la base vivante, `/db`), `HOST`, `PORT` (8787),
  `MAVERICK_INTERVALLE` (surveillance, 15 000 ms), `MAVERICK_EDITION` (`1` : édition des règles ouverte, serveur de test seulement) ; page
  « Mise à jour » du serveur de test : `MAVERICK_REFERENCE` (base de la production, `/site/donnees/reference.db`), `MAVERICK_ADRESSE_PUBLIQUE`
  (`https://dev.<domaine>`, sinon l'hôte de la requête), `MAVERICK_GITHUB_JETON_FICHIER` (`/secrets/github-actions-token`, dossier `secrets/` de
  l'instance monté en lecture seule), `MAVERICK_DEPOT` (`Bravexier/MaverickCenter`) ; les deux serveurs : `MAVERICK_MAINTENANCE` (`/maintenance`,
  dossier partagé de l'annonce de maintenance, ci-dessus), `MAVERICK_DOSSIER_METRIQUES` (`/metriques`), `MAVERICK_INSTANCE` (`prod` ou `dev`),
  `MAVERICK_METRIQUES_PAGES` (`1` par défaut) et `MAVERICK_METRIQUES_BRUTES` (`0` par défaut) : « Métriques et volume », ci-dessous.
- **Journaux des conteneurs** (`docker logs`) : pilote `json-file`, **5 fichiers de 10 Mo au plus** par conteneur (`logging` de chaque service des
  deux `docker-compose.yml`) ; sans ce réglage, Docker les garde sans limite.

**Mises à jour, sans rien relancer à la main** : le service surveille trois fichiers (un changement compte quand il a été vu deux fois de suite,
pour ne pas agir au milieu d'une copie) :

1. `site/_serveur/version.json` : une nouvelle version du service s'arrête (code 0) et Docker la relance (`restart: unless-stopped`) ;
2. `site/donnees/maverick.db` : de nouvelles règles refont la base vivante (ci-dessus) ;
3. `db/vivante.db` : remplacée par l'installateur du serveur de test (copie de la production), elle est rouverte. L'installateur remplace le
   **contenu** de `db/`, pas le dossier, qui est monté dans le conteneur.

Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d` (l'installateur le signale ; sur le NAS, voir
`deploy/README.md`).

**La seule sortie sur Internet en production** : `POST /api/classeur/` (« Importer (en ligne) » de la fiche, `serveur/classeur.mjs`), que tout
visiteur peut déclencher (le site est public). Le site de dev (`MAVERICK_EDITION=1`) joint aussi l'API GitHub (`api.github.com`), pour la page « Mise
à jour » seulement et quand le serveur de test a son jeton (`serveur/notes-de-version.mjs#creerGithub` ; « Mise à jour (site de dev) » ci-dessus) ; en
production, le service n'a pas de client GitHub. Pour le classeur, le service n'accepte qu'un lien `https://docs.google.com/spreadsheets/d/<id>…`,
construit lui-même l'adresse d'export (`…/export?format=xlsx`, jamais l'adresse reçue), suit les redirections une à une (5 au plus, `https`,
`docs.google.com` ou un hôte `*.googleusercontent.com` seulement), lit au plus **16 Mio** (taille annoncée, puis lecture par morceaux arrêtée
au-delà), abandonne après **20 s** (sous le délai de 60 s de nginx), fait au plus **2 téléchargements à la fois et 30 par minute** pour tout le
service, et arrête le téléchargement si le visiteur part. Il vérifie qu'il a reçu un `.xlsx` (« PK\x03\x04 »). Rien de l'adresse ni de l'identifiant
de la feuille n'est noté : le journal dit la taille, les redirections et la durée, les métriques comptent la route `/api/classeur/` et un évènement
`classeur` (statut, durée, octets, redirections). `fetch` est injectable (`demarrerService({ fetch })`) : les tests ne joignent pas Google.

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

- **L'installateur de test** remplace le contenu de `db/` par une copie de celui du serveur normal : les métriques n'y sont pas quand le dossier est
  réglé, et `db/metriques/` (défaut) n'est **ni copié** de la production **ni effacé** du test, ni compté comme une base (`MAVERICK_BASE_TEST=conservee`).
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

**Question de volume pour le propriétaire** (à l'ouverture à tout le Discord, 1.0) : au trafic d'avant la 1.0, quelques dizaines de Mo par an et
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
| `site-donnees` | Données du site | `donnees/` hors pages `.html` (bases des règles et de la production), toute `.db`, `search-index.json`, `fiche/regles.json` | Oui | Oui |
| `site-images` | Images du site | `.png`, `.webp`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.avif` hors portraits | Oui | Oui |
| `site-autres` | Autres fichiers du site | Polices, textes… ; l'hôte y ajoute le reste du dossier de l'instance (`docker-compose.yml`, `nginx.conf`, `.env`, scripts, dossiers) | Oui | Oui |
| `docker` | Docker (images et conteneurs) | Le dossier de Docker (`docker info` : `DockerRootDir`, `/var/lib/docker`), sans changer de disque, moins les journaux des conteneurs | — | Oui |
| `journaux` | Journaux | Journaux des conteneurs (`*-json.log*`), `/var/log` (journal de systemd, Caddy), journaux des scripts de l'instance (`*.log`) | — | Oui |
| `installations` | Installations et copies | Restes d'une installation (`.installation.*`, `.db.copie.*`), téléchargements de `mise-a-jour.sh` et `update-site.sh` (`/tmp/maverick-*`), installateurs copiés à la main (`/root`, `/home/*`) | — | Oui |
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
| Archives de la base vivante | `db/archives/` | `ARCHIVES_GARDEES` = 5 copies, ~25 Mo chacune : **≤ ~125 Mo par instance** | Oui (et seulement si la base avait des fiches ou un journal) |
| Lots figés de la mise à jour | `/srv/maverick-center-test/db/mise-a-jour/` | Un JSON par lancement (journal en attente : quelques Ko, plus ~1 Mio par portrait modifié), 8 au plus par 24 h ; jamais effacés (gardés pour l'enquête) | **Non**, mais lent (~quelques Mo par an) : à purger à la main au-delà d'un an si besoin |
| Métriques | `/srv/maverick-center/metriques/` | Quelques dizaines de Mo pour les deux fichiers au trafic d'avant la 1.0, puis stable ; plus à l'ouverture au Discord (« Volume estimé des métriques », ci-dessus) ; `volume-hote.json` : ~6 Ko, remplacé toutes les 15 minutes | Oui : rétention, pages du site seulement, refus regroupés et **plafond dur** de 300 Mio par fichier (`PLAFOND_METRIQUES_OCTETS` : au-delà, ou sous 2 Gio libres, collecte restreinte) |
| Journaux Docker | `/var/lib/docker/containers/*/…-json.log*` | nginx : une ligne (~250 o) par requête HTTP, ~2 Mo par jour et par instance ; service : production presque rien, dev une ligne par appel `/api/` (~0,5 Mo par jour). **Plafond : 4 conteneurs × 5 × 10 Mo = 200 Mo** | Oui depuis cette version (sinon ~1,5 Go par an, sans fin) ; s'applique quand le conteneur est recréé (`docker compose up -d`) |
| Images Docker | `/var/lib/docker/` | `nginx:1.27-alpine` (~50 Mo) et `node:22-alpine` (~160 Mo), partagées par les deux instances | Oui : jamais retirées automatiquement ; après un `docker compose pull`, l'ancienne image reste : `docker image prune` |
| Installateurs téléchargés par `mise-a-jour.sh` | `$TMPDIR` (`/tmp/maverick-mise-a-jour.*`), puis extraits dans `<instance>/.installation.<pid>/` | ~20 Mo, puis ~145 Mo extraits, **pendant l'installation seulement** (les deux instances peuvent s'installer dans les mêmes 5 minutes : ~330 Mo de pointe) | Oui : effacés à la fin ; restent seulement après un arrêt brutal (coupure, `kill -9`) : voir les commandes ci-dessous |
| Installateurs copiés à la main | `~/maverick-center-*-install.sh` | ~20 Mo chacun | **Non** : à effacer après l'installation |
| Copie de la base par l'installateur de test | `/srv/maverick-center-test/db/` (et `.db.copie.<pid>/` pendant la copie) | Le `db/` du serveur normal, archives comprises (≤ ~150 Mo), le double pendant la copie | Oui : avec `MAVERICK_BASE_TEST=conservee` (VPS), à la première installation seulement |
| Journaux des scripts | `mise-a-jour.log`, `update.log` ; `installation.log` | Les deux premiers tournent au-delà de 200 Ko ; `installation.log` : ~5 lignes par installation | `installation.log` non borné, ~0,2 Mo par an |
| Sauvegardes à la main | `/root/vivante-*.db` (`deploy/vps/README.md`, « Sauvegardes ») | Une base vivante chacune | **Non** : à faire tourner ou à sortir du serveur |
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

## Développement

```bash
cd client
npm run serveur     # le service sur http://127.0.0.1:8787/api/ ; règles : la base reconstruite depuis data/rows ; base vivante : var/serveur/
npm run dev         # dans un autre terminal : le site, qui transmet /api/ au service (astro.config.mjs ; PORT_SERVICE pour un autre port)
```

Les tests (`npm test`) : `serveur-base-vivante` (création, reprise des fiches, refus sans perte, archives), `serveur-api` (chaque route, chaque
refus, conflit de versions, serveur HTTP réel et sa surveillance), `serveur-edition*` et `serveur-edition-journal` (édition : chaque domaine,
journal, rejeu), `serveur-notes-de-version` (page Mise à jour : routes, lot figé, faux GitHub), `notes-de-version` et `notes-de-version-sens`
(liste et couleurs), `mise-a-jour-regles` (lot appliqué à data/rows : conflit, liste blanche), `mise-a-jour-github` (le workflow),
`mise-a-jour-simulation` (le lot synthétique de la CI, l'état « note en attente », le job `simulation-de-mise-a-jour`), `serveur-maintenance`
(annonce, deux serveurs qui rouvrent chacun à sa version, fin sans livraison, levée, plafond, minuterie, adresse de retour), `db-appliquer-edition` (rapatriement dans data/rows, versé dans l’historique), `historique-site` (ce que le site a changé, état d’import), `serveur-livraison` (modules livrés, service livré démarré tel quel,
`docker-compose.yml` et `nginx.conf` cohérents), `installateur` (contenu de `db/` remplacé, dossier gardé, métriques jamais copiées ni effacées),
`serveur-metriques`, `serveur-metriques-http`, `serveur-metriques-bornes` et `serveur-metriques-disque` (métriques : routes normalisées, agrégats,
quantiles, rétention, deux instances, vraies requêtes HTTP, croissance et projections, cardinalité et plafond, répartition du disque, relevé de
l'hôte, réserve de root), `debug-metriques` et `debug-balise` (rendus de la page
Debug, balise des pages), `deploy-vps` (`instances.sh` : dossiers partagés de la maintenance et des métriques, une instance par fichier, minuteur du relevé de l'hôte) et
`deploy-volume` (rotation des journaux Docker, métriques montées hors de `db/`, mesure des pages active par défaut, `volume.sh` exécuté sur une
arborescence factice : clés et classement du service, chaque octet compté une fois, cette section fidèle au code), `ressources-registre`, `serveur-api-v1` et
`api-doc` (API REST `/api/v1/`, [`api.md`](api.md)), `journal-du-service` et `debug-page` (page Debug) ; `site-html` contrôle `dist/_serveur/`
après le build, le script de maintenance de chaque page (exécuté dans un faux navigateur) et `/maintenance/`.

## Suite

- Pages du site branchées sur l'API : `/fiche/` (création et modification d'un prétiré) et `/personnages/` (recherche), voir
  [`character-generator.md`](character-generator.md).
- 1.0 : connexion Discord (sessions, rôles), fiches de joueur, partage, groupes (`v_personnage_visible`), protection des pages par le service
  (`auth_request`) à la place du mot de passe partagé.

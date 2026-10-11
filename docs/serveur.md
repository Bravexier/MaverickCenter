# Mode client / serveur : le service des personnages

Préparé avant la 1.0 (demande du propriétaire) : le site reste un ensemble de pages statiques pour **lire** les règles et le lore, et un petit
**service** enregistre ce qu'on y **écrit** — pour commencer, les fiches de personnages prétirés. C'est la fondation du serveur de la 1.0
(connexion Discord, fiches de joueur, édition des règles : [`feuille-de-route.md`](feuille-de-route.md)) ; rien n'y est propre au NAS.

```
navigateur ──▶ nginx (mot de passe du site) ──┬──▶ site/            pages, scripts, base des règles (donnees/maverick.db)
                                              └──▶ /api/ ──▶ conteneur « serveur » (Node 22) ──▶ db/vivante.db  (base vivante)
```

**Avant la 1.0, pas de comptes** : quiconque a le mot de passe du site lit et écrit les prétirés (un prétiré n'est à personne et tout le monde
le voit : `v_personnage_visible`). Une fiche de joueur n'est ni listée ni lisible par l'API ; elle viendra avec la connexion Discord.

## Le code

| Fichier | Rôle |
| --- | --- |
| `client/serveur/index.mjs` | Point d'entrée livré (variables d'environnement ci-dessous) |
| `client/serveur/service.mjs` | Serveur HTTP (`node:http`), surveillance des fichiers, arrêt propre |
| `client/serveur/api.mjs` | Routes : une requête lue → une réponse JSON, sans réseau (testé directement) |
| `client/serveur/fiches.mjs` | Une fiche ↔ les lignes de la section 13 de `data/schema.sql` ; contrôles ; résumé pour la recherche |
| `client/serveur/base-vivante.mjs` | Création et renouvellement de la base vivante, archives |
| `client/src/lib/fiche-format.mjs` | Format d'échange d'une fiche, **partagé** avec les pages du site (sans dépendance) |
| `client/serveur/dev.mjs` | `npm run serveur` (développement) — jamais livré |
| `client/serveur/livraison.mjs` | Intégration Astro : copie le service dans `dist/_serveur/` à chaque build — jamais livré |

Le service n'utilise que Node (≥ 22.13, `node:sqlite`) et ses propres modules : **aucun paquet npm** (`modulesDuServeur` refuse un import qui n'est
ni `node:…` ni relatif). Il est livré **avec le site** : `dist/_serveur/` contient ses modules, sous les mêmes chemins que dans `client/`
(`serveur/…`, `src/lib/…`), et `version.json` (version du site, empreinte du code). Le site et son service arrivent donc toujours ensemble sur le
serveur, par la branche `site` (NAS) ou par les installateurs. nginx refuse l'adresse `/_serveur/` ; la version portable (`tools/build-artifact.mjs`)
ne l'emporte pas.

## La base vivante (`db/`)

| Fichier | Contenu |
| --- | --- |
| `db/vivante.db` | Copie de la base des règles publiée par le site (`site/donnees/maverick.db`), plus ce que le service écrit (section 13 : utilisateurs, fiches, groupes) |
| `db/vivante.json` | Empreinte SHA-256 des règles dont elle est faite, version du schéma, date |
| `db/archives/` | Les 5 dernières bases remplacées qui avaient des lignes de la section 13 |

Pourquoi une copie des règles : les fiches citent les règles (race, classe, sorts…) par clés étrangères, et les contrôles (`v_personnage_controle`,
`v_personnage_niveau`) les joignent ; tout doit être dans la même base SQLite.

**Quand une livraison change les règles**, le service le voit (empreinte différente) et refait la base vivante : nouvelle copie des règles, puis
toutes les lignes de la section 13 y sont recopiées colonne par colonne (une colonne ajoutée prend sa valeur par défaut). **Rien ne se perd** : si
une seule ligne ne passe pas — une fiche cite une règle qui n'existe plus, une colonne remplie a disparu du schéma, une contrainte a changé — la
base en place est gardée telle quelle, le service continue avec elle (règles d'avant) et `/api/etat` donne l'erreur, par exemple
`personnage.metier_id = « metiers/x » absent de metier (1 ligne(s))`. Il faut alors une livraison qui règle le cas : migration de la section 13
(`data/migrations/`) ou correction des règles. La base remplacée est d'abord archivée.

**Sauvegarde** : `db/` est la seule donnée du serveur qui ne se reconstruit pas. La copier avec `sqlite3 db/vivante.db ".backup sauvegarde.db"`
(cohérente même pendant une écriture), ou copier le dossier `db/` pendant que le conteneur « serveur » est arrêté. `data/rows` garde les tables de la section 13 **vides** : aucune
fiche réelle dans git ni dans `/donnees/maverick.db` (le service refuse une base des règles qui en contient).

## L'API

| Requête | Réponse |
| --- | --- |
| `GET /api/etat/` | Version du service, état de la base vivante (`disponible`, `a_jour`, `erreur`, `regles`, `schema`, `pretires`) |
| `GET /api/personnages/` | `{ personnages: [...] }` : résumé de chaque prétiré (nom, statut, race, ethnie, magies, dieu, métier, classes et spécialités, niveaux, nombre de règles enfreintes, dates) |
| `POST /api/personnages/` | Crée un prétiré → `201`, `Location`, `{ personnage, controles, niveau }` |
| `GET /api/personnages/<id>/` | `{ personnage, controles, niveau }` |
| `PUT /api/personnages/<id>/` | Modifie → `{ personnage, controles, niveau }` |
| `DELETE /api/personnages/<id>/` | Supprime, corps `{ "version": … }` (celle de la fiche lue) → `{ supprime }` ; `409` si elle a changé entre-temps |

Les adresses finissent par « / », comme celles du site : en développement, Astro refuse une adresse sans « / » finale avant de la transmettre au
service (qui accepte les deux formes).

**Une fiche en JSON** (`fiche-format.mjs`) : les colonnes de `personnage` à la racine, sous leur nom ; une liste par table de détail
(`classes`, `caracteristiques`, `competences`, `progression`, `capacites`, `sorts`, `maitrises_armes`, `armes`, `armures`, `bouclier_materiaux`,
`accessoires`, `inventaire`), chaque ligne avec les colonnes de sa table sans `personnage_id` ; et `version`. Rien de calculé n'y est stocké.

```json
{ "nom": "Aldric", "statut": "brouillon", "race_id": "races/humain", "magie_innee_id": "magies/magie-du-feu", "xp": 0,
  "classes": [{ "rang": 1, "classe_id": "classes/guerrier", "specialite_id": null }],
  "caracteristiques": [{ "caracteristique_id": "force", "base": 4, "croix": 0 }] }
```

- **Création** : les colonnes absentes prennent la valeur d'une fiche vide (`ficheVide` : brouillon, mono-classe, 0 XP, alignement, bourse et
  ambidextrie à zéro). Le service fixe l'identifiant (UUID), la nature (prétiré), le propriétaire (aucun), la visibilité (tous) et les dates.
- **Modification** : `version` (celle de la fiche lue) est obligatoire ; si la fiche a changé depuis, rien n'est écrit et la réponse `409` rend la
  fiche à jour. Une colonne absente garde sa valeur ; une liste présente remplace toute la liste, une liste absente ne change pas.
- **Refus** (`400`, rien n'est écrit) : `{ erreur, problemes: [...] }`, un message par problème, en français (« caracteristiques[0] : valeur
  hors des bornes (base >= 1) », « « race_id » : « races/x » n'existe pas dans les règles (race) », champ inconnu…).
- **Contrôles** : les règles de `v_personnage_controle` enfreintes sont rendues avec chaque fiche ; un brouillon peut en avoir, une fiche ne
  passe `valide` que sans aucune (sinon `422` avec la liste). On peut archiver un prétiré (`statut: "archive"`) ou le **supprimer** (demande du
  propriétaire) : la fiche et toutes ses lignes disparaissent (`ON DELETE CASCADE` ; une inscription dans un groupe passe à `NULL`), sans retour possible.
- **Écritures** : corps JSON (`Content-Type: application/json`) d'au plus 1 Mo, et pas de requête qu'un navigateur dit venir d'un autre site
  (`Sec-Fetch-Site`) : un formulaire ou un script d'un autre site ne peut pas écrire à la place de quelqu'un qui a le mot de passe.

## Édition des règles (site de dev)

Demande du propriétaire : sur le **site de dev seulement**, et **sur ordinateur seulement** (écran large et pointeur précis : ni téléphone ni
tablette), les pages du guide, des races, des magies, des classes et des métiers se modifient en place. Le service n'ouvre ses routes
`/api/edition/` que s'il est lancé avec `MAVERICK_EDITION=1` (le `.env` du serveur de test, posé par `deploy/vps/instances.sh` ou l'installateur
de test ; `npm run serveur` l'ouvre par défaut, `MAVERICK_EDITION=0` le ferme) : ailleurs elles répondent `403` et `/api/etat/` dit
`edition: false`, et la page ne charge même pas l'éditeur (`src/scripts/edition.mjs`).

**Sur la page** : un crayon à cocher, à droite, passe en mode modification ; chaque champ affiché depuis la base (attribut `data-ed`,
`src/lib/edition-modele.mjs`) devient une saisie remplie avec la valeur de la base vivante. Le bouton « Enregistrer » flottant (ou Ctrl+S) envoie
toutes les modifications de la page **d'un bloc** puis repasse en lecture ; décocher le crayon les abandonne. Ce qui se modifie :

| Pages | Champs, et ce que la base recalcule |
| --- | --- |
| Guide | Titre et texte : éditeur en place (paragraphes, titres, citations, listes, gras, italique, barré, liens vers une page du wiki ou une adresse, tableaux, lignes, colonnes et couleur des cases), réécrit en Markdown (`lib/markdown-edition.mjs`) ; les blocs tirés de la base restent à leur place ; un ancien titre devient un alias |
| Races | Chaque case de l'onglet (présentation, histoire, valeurs de départ, avantages, dons et leur tableau, capacité Mode Hyper…), magies innées, relations entre peuples (déplacer ou ajouter une race ou une ethnie dans le tableau d'une race) ; créer une race (pure ou hybride) ou un peuple |
| Magies | Présentation, description, explication, rôles, Mode Hyper ; chaque case de chaque sort (type, mode, NM et états recalculés : `lib/sort-analyse.mjs` ; une ligne peut avoir un effet de NM dans plusieurs colonnes). La table des relations entre magies ne se modifie pas |
| Classes | Tous les champs (maîtrises, inventaire, spécialités, dons : tables de détail recalculées, `lib/classe-champs.mjs`) ; créer une classe dans une catégorie ; une classe raciale se crée pour une race hybride qui n'en a pas encore |
| Métiers | Ajouter, modifier, supprimer (refusé si une fiche l'utilise) ; bonus et recettes recalculés (`lib/metier-champs.mjs`) ; filtres et tri par colonne |

Ce qui suit aussi, pour que les outils du dépôt acceptent les modifications rapatriées (`serveur-edition-derivations`, `serveur-edition-rapatriement`,
`sort-etats`) : une page créée (race, classe, métier) a pour seule source sa provenance « Site de dev › édition du AAAA-MM-JJ » (tables `source`,
`page_source` ; `tools/db/pages_md.py` la rattache à la famille de son type), et une page supprimée emporte sa source si plus rien ne la cite ; les
champs structurés d'une page (`page.donnees`) s'écrivent comme `json.dumps` des importeurs (`lib/json-python.mjs`) ; les magies innées d'une race à
liste d'onglet gardent l'ordre de l'onglet (une magie ajoutée va à la fin) ; les altérations d'état d'un sort (`sort_etat`) sont relues dans les cases
modifiées (`lib/sort-etats.mjs`, la règle de l'importeur, qui redonne les lignes des 322 sorts) ; un sort renommé l'est aussi dans les panneaux
« Effet "…" » des créatures (`creature_effet`) ; un peuple créé a sa case diagonale « Même peuple ».

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
se rejouent dans l'ordre où ils ont été enregistrés.

**Rapatriement dans le dépôt** : le lien « N modifications à rapatrier » (à côté du crayon, `GET /api/edition/journal/`) télécharge le journal, puis

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
| `POST /api/edition/race/` | `{ race }` → magies innées et relations de la race dans la base vivante |
| `POST /api/edition/` | `{ page, operations: [...] }` → applique un lot d'un bloc (`modifier`, `creer`, `supprimer`, `relations`, `magies_innees` : `serveur/edition.mjs`) |
| `GET /api/edition/journal/` | Le journal des modifications en attente (`maverick-edition/1`), en pièce jointe |

**Avant la 1.0, pas de comptes** : quiconque a le mot de passe du site de dev peut modifier les règles (le journal n'a pas d'auteur :
`modification_lot.auteur_id` attend la connexion Discord). Mêmes protections d'écriture que les fiches (JSON, `Sec-Fetch-Site`).

## Mise à jour (site de dev)

Demande du propriétaire : une page **Mise à jour** (menu Outils, `/mise-a-jour/`) à deux visages, comme l'édition.

**Sur le serveur normal** (et partout sans service : version portable, site statique) : la page construite montre la **note de version** de la
dernière livraison (`note_version`, `note_version_ligne`, section 15 de `data/schema.sql`), puis l'**historique** des précédentes. Une note est
la liste des modifications des règles d'une version X.Y à la suivante (toutes les versions X.Y.Z de dev entre les deux), par domaine (sorts par
magie, magies, classes et leurs dons, races, métiers, guide), l'ancienne valeur **barrée** mais lisible et la nouvelle à côté, en **vert**
(amélioration) ou **rouge** (affaiblissement) d'après la décision R29 (`docs/decisions-regles.md`, `lib/notes-de-version-sens.mjs`), plus le
champ libre des admins. Tant qu'aucune livraison n'a eu lieu, deux notes d'exemple (lorem ipsum, `exemple = 1`, migration `0023`) tiennent la place ;
la première vraie mise à jour les retire.

**Sur le site de dev** (`MAVERICK_EDITION=1`) : au-dessus, la note **en préparation**, calculée par le service à chaque visite
(`GET /api/mise-a-jour/`) : la base de la **production** (référence : la base de master, construite au build à côté de celle du site,
`site/donnees/reference.db` et `reference.json`, `scripts/db-reference.mjs`) comparée à la base vivante (règles de dev + modifications du site).
Seuls les champs que le site modifie sont comparés (`lib/edition-modele.mjs#TABLES`) : le reste en est dérivé. Le **champ libre** (Markdown simple :
paragraphes, listes, gras, italique, liens web) s'enregistre dans `note_version_brouillon` (section 14 : il suit la base vivante quand les
règles changent ; `409` si quelqu'un l'a changé entre-temps).

**« Effectuer la mise à jour »** (ordinateur seulement ; pas de protection avant la connexion Discord, décision du propriétaire) : après
confirmation (taper `METTRE A JOUR`), le service **fige un lot** — le journal en attente (sans l'aperçu HTML du guide), le champ libre, les
versions — dans `db/mise-a-jour/<lot>.json`, avec son empreinte SHA-256, et le sert tel quel à `/api/mise-a-jour/lots/<lot>/`. Le texte et le
bouton restent verrouillés tant que le lot n'est pas livré ou annulé. Puis il déclenche le workflow GitHub **`mise-a-jour.yml`** sur `dev`
(`workflow_dispatch` : lot, empreinte, adresse ; jeton du serveur limité à la permission *Actions*), dont il suit le run (état dans
`db/mise-a-jour/etat.json`, gardé si le service redémarre). Sans jeton, la page donne les trois valeurs pour lancer le workflow à la main.

**« Simulation de mise à jour »** (bouton à côté, confirmation simple) : le même lot, le même workflow avec l'entrée `essai` cochée. GitHub fait
tout le travail (branche à jour de `dev`, lot rejoué, note de version écrite, liste des tables contrôlée, `db:check`, `npm test`) puis s'arrête
**sans rien pousser** : ni PR, ni fusion, ni livraison. À la fin (réussie ou non), le lot est libéré et le texte redevient modifiable
(`simulation_reussie` / `simulation_echouee`). À faire avant la première vraie mise à jour, qui fera la livraison 0.2.0.

Le workflow (`client/scripts/mise-a-jour-github.mjs`, avec le jeton `MISE_A_JOUR_TOKEN` du dépôt) :

1. télécharge le lot et vérifie son empreinte ;
2. part de `dev` sur `feature/mise-a-jour-regles-<date>`, y applique le lot (`client/scripts/mise-a-jour-regles.mjs`) : base reconstruite
   depuis `data/rows`, journal rejoué (**un conflit arrête tout**), note de version écrite (version X.Y de la prochaine livraison, d'après la même
   règle que le bot ; les notes d'exemple retirées), journal versé dans `historique_modification`, puis `data/rows` réécrit par l'exporteur — dans
   une copie d'abord : **seuls les fichiers des tables que le journal a touchées et ceux des notes de version peuvent changer** (demande du
   propriétaire), sinon rien n'est écrit ; `db:check` et `npm test` ;
3. ouvre la PR vers `dev`, attend la CI verte et la fusionne (commit de fusion) ; si `dev` a bougé entre-temps, le lot est rejoué sur le
   nouveau `dev` ;
4. attend le commit de version du bot, puis ouvre la PR de **livraison `dev` → `master`** (la note de version en corps, jamais `[V: X+1]`),
   attend sa CI et la fusionne : `livraison.yml` fait la version X.Y.0, les étiquettes et les installateurs.

Quand la nouvelle version arrive sur le site de dev, la base vivante est refaite et le journal rejoué (les modifications sont « intégrées ») ; le
brouillon dont le lot a sa note dans les règles est vidé et le lancement marqué terminé (`actualiserLancement`). Le serveur normal reçoit la
nouvelle note avec la livraison.

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
- les tests du service lisent l'état avant d'écrire (ordre = max + 1, races hybrides sans classe raciale) et prennent des noms absents de la base.

`db:check` compare de même chaque note de cellule à la remarque d'import (`valeurDImport`) et ignore une ligne créée ou supprimée par le site ;
`tools/db/races_onglet.py --verifier` ignore une race créée depuis le site (son onglet cite « Site de dev › … », pas le classeur). Une migration
qui renomme une colonne doit aussi renommer ses clés dans `avant` / `apres` de `historique_modification`.

| Requête | Réponse |
| --- | --- |
| `GET /api/mise-a-jour/` | La note en préparation : `reference`, `version_dev`, `version_cible`, `en_attente`, `lignes`, `bilan`, `brouillon`, `lancement`, `github`, `confirmation` |
| `POST /api/mise-a-jour/brouillon/` | `{ texte, avant }` → le champ libre enregistré (`409` s'il a changé entre-temps ou si un lot est figé) |
| `POST /api/mise-a-jour/lancer/` | `{ confirmation, simulation? }` → fige le lot et déclenche le workflow (`simulation: true` : simulation de mise à jour, rien n'est poussé) → `202`, `{ lancement }` (`etat` : `envoi`, `lance`, `en_cours`, `termine`, `echec`, `erreur`, `manuel`, `annule`, `simulation_reussie`, `simulation_echouee`) |
| `POST /api/mise-a-jour/liberer/` | Annule un lancement qui n'est pas parti, a échoué ou se lance à la main : le texte redevient modifiable (annulé pendant l'envoi : le run parti quand même est annulé sur GitHub) |
| `GET /api/mise-a-jour/lancement/` | L'état du lancement (le run GitHub est relu au plus toutes les 20 s) |
| `GET /api/mise-a-jour/lots/<lot>/` | Le lot figé, octet pour octet (le workflow le télécharge et vérifie son empreinte) |

**Mise en place** (une fois) : le secret `MISE_A_JOUR_TOKEN` du dépôt (jeton fine-grained d'un administrateur, ce dépôt seulement : *Contents*,
*Pull requests* et *Workflows* en écriture ; le jeton d'un workflow ne déclenche ni la CI ni `livraison.yml`) et, sur le serveur de test, le
fichier `secrets/github-actions-token` (jeton fine-grained, ce dépôt seulement : *Actions* en écriture), pas à pas dans
[`deploy/vps/README.md`](../deploy/vps/README.md). Chaque mise à jour consomme environ trois passages de la CI (PR, livraison, publication)
en minutes GitHub Actions.

## Hébergement

Deux conteneurs dans le même `docker-compose.yml` (NAS : [`deploy/`](../deploy/README.md) ; à partir de la 1.0 : les
[installateurs](../deploy/installateur/README.md)) :

- **nginx** sert `site/` et transmet `/api/` au service (`deploy/nginx.conf`, le même fichier pour le NAS et les installateurs), derrière le
  même mot de passe. L'adresse du service est résolue à chaque requête : nginx démarre sans lui, et si le service est arrêté, `/api/` répond 502
  pendant que les pages de lecture restent servies.
- **serveur** (`node:22-alpine`) exécute `site/_serveur/serveur/index.mjs` ; aucun port publié (seul nginx l'atteint). Variables :
  `MAVERICK_REGLES` (base des règles, `/site/donnees/maverick.db`), `MAVERICK_DB` (dossier de la base vivante, `/db`), `HOST`, `PORT` (8787),
  `MAVERICK_INTERVALLE` (surveillance, 15 000 ms), `MAVERICK_EDITION` (`1` : édition des règles ouverte, serveur de test seulement) ; page
  « Mise à jour » du serveur de test : `MAVERICK_REFERENCE` (base de la production, `/site/donnees/reference.db`), `MAVERICK_ADRESSE_PUBLIQUE`
  (`https://dev.<domaine>`, sinon l'hôte de la requête), `MAVERICK_GITHUB_JETON_FICHIER` (`/secrets/github-actions-token`, dossier `secrets/` de
  l'instance monté en lecture seule), `MAVERICK_DEPOT` (`Bravexier/MaverickCenter`).

**Mises à jour, sans rien relancer à la main** : le service surveille trois fichiers (un changement compte quand il a été vu deux fois de suite,
pour ne pas agir au milieu d'une copie) :

1. `site/_serveur/version.json` : une nouvelle version du service s'arrête (code 0) et Docker la relance (`restart: unless-stopped`) ;
2. `site/donnees/maverick.db` : de nouvelles règles refont la base vivante (ci-dessus) ;
3. `db/vivante.db` : remplacée par l'installateur du serveur de test (copie de la production), elle est rouverte. L'installateur remplace le
   **contenu** de `db/`, pas le dossier, qui est monté dans le conteneur.

Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d` (l'installateur le signale ; sur le NAS, voir
`deploy/README.md`).

## Développement

```bash
cd client
npm run serveur     # le service sur http://127.0.0.1:8787/api/ ; règles : la base reconstruite depuis data/rows ; base vivante : var/serveur/
npm run dev         # dans un autre terminal : le site, qui transmet /api/ au service (astro.config.mjs ; PORT_SERVICE pour un autre port)
```

Les tests (`npm test`) : `serveur-base-vivante` (création, reprise des fiches, refus sans perte, archives), `serveur-api` (chaque route, chaque
refus, conflit de versions, serveur HTTP réel et sa surveillance), `serveur-edition*` et `serveur-edition-journal` (édition : chaque domaine,
journal, rejeu), `serveur-notes-de-version` (page Mise à jour : routes, lot figé, faux GitHub), `notes-de-version` et `notes-de-version-sens`
(liste et couleurs), `mise-a-jour-regles` (lot appliqué à data/rows : conflit, liste blanche), `mise-a-jour-github` (le workflow), `db-appliquer-edition` (rapatriement dans data/rows, versé dans l’historique), `historique-site` (ce que le site a changé, état d’import), `serveur-livraison` (modules livrés, service livré démarré tel quel,
`docker-compose.yml` et `nginx.conf` cohérents), `installateur` (contenu de `db/` remplacé, dossier gardé) ; `site-html` contrôle `dist/_serveur/`
après le build.

## Suite

- Pages du site branchées sur l'API : `/fiche/` (création et modification d'un prétiré) et `/personnages/` (recherche), voir
  [`character-generator.md`](character-generator.md).
- 1.0 : connexion Discord (sessions, rôles), fiches de joueur, partage, groupes (`v_personnage_visible`), protection des pages par le service
  (`auth_request`) à la place du mot de passe partagé.

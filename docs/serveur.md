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
  passe `valide` que sans aucune (sinon `422` avec la liste). Un prétiré n'est pas supprimé par l'API : on l'archive (`statut: "archive"`).
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
| Magies | Présentation, description, explication, rôles, Mode Hyper ; chaque case de chaque sort (type, mode, NM et états recalculés : `lib/sort-analyse.mjs`). **Une seule colonne par ligne avec un effet de NM** : signalée en direct, refusée à l'enregistrement. La table des relations entre magies ne se modifie pas |
| Classes | Tous les champs (maîtrises, inventaire, spécialités, dons : tables de détail recalculées, `lib/classe-champs.mjs`) ; créer une classe dans une catégorie ; une classe raciale se crée pour une race hybride qui n'en a pas encore |
| Métiers | Ajouter, modifier, supprimer (refusé si une fiche l'utilise) ; bonus et recettes recalculés (`lib/metier-champs.mjs`) ; filtres et tri par colonne |

**Le journal** (section 14 de `data/schema.sql` : `modification_lot`, `modification`) : le service écrit chaque ligne touchée (avant, après) dans la
même transaction que la modification (`serveur/edition-journal.mjs`). Une saisie envoie la valeur qu'elle a lue (`avant`) : si la base a changé
depuis, `409` et rien n'est écrit. Les pages étant statiques, chacune demande au chargement les lignes modifiées depuis sa construction
(`GET /api/edition/en-attente/`) et les réaffiche (pour une page du guide : l'aperçu HTML noté avec le texte, assaini) ; une race ou une classe
créée a sa page provisoire sur la page 404 du site de dev, jusqu'à la livraison suivante.

**Quand une livraison change les règles**, la base vivante est refaite (ci-dessus) et le journal y est **rejoué**, lot par lot : une modification
déjà présente dans les nouvelles règles passe « intégrée », un lot qui contredit les nouvelles règles passe « conflit » en entier (rien n'en est
réappliqué) ; `/api/etat/` compte les modifications `en_attente` et `conflit`, affichées à côté du crayon.

**Rapatriement dans le dépôt** : le lien « N modifications à rapatrier » (à côté du crayon, `GET /api/edition/journal/`) télécharge le journal, puis

```bash
cd client
npm run db:appliquer-edition -- ~/Téléchargements/journal-edition-AAAA-MM-JJ.json   # rejoue le journal sur data/rows (rien d'écrit en cas de conflit)
npm run db:build && npm run db:check && npm test                                    # puis commit de data/rows (PR vers dev)
```

Une fois livrées, ces modifications reviennent « intégrées » sur le site de dev. Les tests qui épinglent les données importées (effectifs, fidélité
des pages de race à leur onglet : `races_onglet.py --verifier`) disent alors ce qui a changé ; c'est au propriétaire de décider, au premier
rapatriement, que le site devient la source de ces données (`docs/feuille-de-route.md`, étape 2).

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

## Hébergement

Deux conteneurs dans le même `docker-compose.yml` (NAS : [`deploy/`](../deploy/README.md) ; à partir de la 1.0 : les
[installateurs](../deploy/installateur/README.md)) :

- **nginx** sert `site/` et transmet `/api/` au service (`deploy/nginx.conf`, le même fichier pour le NAS et les installateurs), derrière le
  même mot de passe. L'adresse du service est résolue à chaque requête : nginx démarre sans lui, et si le service est arrêté, `/api/` répond 502
  pendant que les pages de lecture restent servies.
- **serveur** (`node:22-alpine`) exécute `site/_serveur/serveur/index.mjs` ; aucun port publié (seul nginx l'atteint). Variables :
  `MAVERICK_REGLES` (base des règles, `/site/donnees/maverick.db`), `MAVERICK_DB` (dossier de la base vivante, `/db`), `HOST`, `PORT` (8787),
  `MAVERICK_INTERVALLE` (surveillance, 15 000 ms), `MAVERICK_EDITION` (`1` : édition des règles ouverte, serveur de test seulement).

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
journal, rejeu), `db-appliquer-edition` (rapatriement dans data/rows), `serveur-livraison` (modules livrés, service livré démarré tel quel,
`docker-compose.yml` et `nginx.conf` cohérents), `installateur` (contenu de `db/` remplacé, dossier gardé) ; `site-html` contrôle `dist/_serveur/`
après le build.

## Suite

- Pages du site branchées sur l'API : `/fiche/` (création et modification d'un prétiré) et `/personnages/` (recherche), voir
  [`character-generator.md`](character-generator.md).
- 1.0 : connexion Discord (sessions, rôles), fiches de joueur, partage, groupes (`v_personnage_visible`), protection des pages par le service
  (`auth_request`) à la place du mot de passe partagé.

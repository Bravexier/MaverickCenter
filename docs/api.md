# API REST `/api/v1/` (site de dev)

Demande du propriétaire : « une entrée pour TOUS les éléments possibles, avec une API REST et un CRUD ». Chaque élément du jeu rangé dans la base
(races, classes, dons, sorts, armes, composants, monstres, événements de la chronologie, pages du guide…) a une adresse sous `/api/v1/`, où il se lit
et, quand le service d'édition sait le faire, se crée, se modifie et se supprime. La description OpenAPI (`GET /api/v1/openapi.json`) sert aux outils
externes ; la page **Debug** du site de dev (menu Outils) n'a plus de testeur depuis qu'elle montre le schéma de la base (« Page Debug », plus bas).

## Principes

- **Ouverte sur le site de dev seulement.** Décision du propriétaire (2026-10-15) : « En prod la db doit rester fermée et ouverte par le front
  exclusivement pour le moment. Laisse le ouverte sur la dev pour qu'on puisse tester des trucs » (citation telle quelle). Tout `/api/v1/` — catalogue, description OpenAPI,
  lectures et écritures — répond `403` quand le service n'est pas celui du site de dev (`MAVERICK_EDITION=1` absent, `service.edition` faux), avant
  tout `404` ou `405`, comme `/api/edition/`. En production, la base ne se lit que par les pages du site (le téléchargement `/donnees/maverick.db` de
  l'onglet DB, fichier du site, n'est pas concerné). `npm run serveur` ouvre l'API par défaut (`MAVERICK_EDITION=0` la ferme).
- **Toute écriture passe par le journal.** Un `POST`, un `PATCH` ou un `DELETE` devient un lot du service d'édition (`serveur/edition.mjs#enregistrer`),
  exactement comme le mode modification des pages : noté au journal (avant / après), rejoué à chaque reconstruction de la base vivante, listé dans la
  note en préparation de la page « Mise à jour », livré dans `data/rows` par la mise à jour ([`serveur.md`](serveur.md), « Édition » et « Mise à
  jour »). **Jamais de SQL direct** sur une table des règles : il serait perdu au rejeu. Mêmes refus, mêmes recalculs (colonnes `X_cle`, tables de
  détail, corps des pages), mêmes identifiants figés, mêmes retraits des fiches (R42, R52, R60) que le mode modification.
- **Ce qu'une ressource sait faire vient du service d'édition**, pas de l'API : modifier = ses colonnes dans `TABLES` (`lib/edition-modele.mjs`),
  créer et supprimer = une entité de `ENTITES`, ou une **opération du lot** quand le site de dev écrit la table par elle (`relations`,
  `magies_innees`, `categories`, `valeurs_de_capacite`, `fusionner_mots_cles` : plus bas, « Opérations du lot »). Une ressource que le service ne sait
  pas écrire est **en lecture seule** : l'API répond `405` (avec la raison), elle n'écrit jamais à sa place.
- **Ce que la page ne montre pas ne s'écrit pas** : une colonne que le service accepterait mais qu'aucune page n'affiche (le prix et la description
  d'un ingrédient d'alchimie, la description d'un produit non monétaire) ou qu'il refuse toujours (le prix de la ressource d'une gemme, qui est dans
  son extension) est **figée** dans le registre (`colonnesFigees`, `ecriture.champsFiges`) : non modifiable au catalogue, `400` avec la raison.
- **Jamais servi** : les tables des fiches de personnages, des comptes et des groupes (section 13 de `data/schema.sql` : elles passent par
  `/api/personnages/`) et celles du journal de l'édition (section 14). La section 15 (notes de version, historique des modifications) se lit seulement.
  Une image (portrait d'un monstre ou d'une espèce) n'est jamais rendue en entier : `{ image: true, empreinte, resume }`
  (`edition-modele.mjs#ligneSansImage`) ; l'image entière passe par `POST /api/edition/portrait/`.
- **Pas de comptes** : quiconque a le mot de passe du site de dev lit et écrit (le lot n'a pas d'auteur). Les écritures exigent
  `Content-Type: application/json` (`415` sinon, `DELETE` compris) et refusent une requête qu'un navigateur dit venir d'un autre site
  (`Sec-Fetch-Site`, `403`) ; corps de 1 Mio au plus (`413`).

Le registre des ressources est `client/src/lib/ressources.mjs` (son en-tête est le contrat du format) et ses modules `client/src/lib/ressources/<module>.mjs` ;
le routeur `client/serveur/ressources.mjs` ; la description OpenAPI `client/serveur/openapi.mjs`.

## Adresses

Toutes finissent par « / », comme celles du site (en développement, Astro refuse une adresse sans « / » finale avant de la transmettre au service).

| Méthode | Adresse | Rôle |
| --- | --- | --- |
| `GET` | `/api/v1/` | Le catalogue : les modules et, pour chaque ressource, ses capacités, ses colonnes (type, clé, obligatoire, `modifiable` d'après `TABLES`), ses champs de création (`ENTITES`, avec les valeurs des listes lues dans la base), ses sous-ressources, ses tables dérivées et son nombre de lignes |
| `GET` | `/api/v1/openapi.json` | La description OpenAPI 3.1 de tout le service : `/api/v1/` et les routes d'avant (`/api/etat/`, prétirés, édition, mise à jour, journal), avec une ligne réelle en exemple par ressource |
| `GET` | `/api/v1/<ressource>/` | Une liste paginée (paramètres ci-dessous) |
| `POST` | `/api/v1/<ressource>/` | Crée un élément → `201`, `Location`, `ETag` et le détail de l'élément créé |
| `GET` | `/api/v1/<ressource>/<clé>/` | Le détail d'un élément, `ETag` ; `304` sur `If-None-Match` ; `404` si la ligne n'existe pas ou sort de la ressource |
| `PATCH` | `/api/v1/<ressource>/<clé>/` | Modifie les colonnes envoyées (les autres restent) |
| `DELETE` | `/api/v1/<ressource>/<clé>/` | Supprime l'élément (avec ses retraits des fiches) |
| `GET`, `POST` | `/api/v1/<ressource>/<clé>/<sous-ressource>/` | La liste des lignes liées à l'élément (mêmes paramètres) ; la création d'une ligne liée (le parent vient de l'adresse) |
| `GET`, `PATCH`, `DELETE` | `/api/v1/<ressource>/<clé>/<sous-ressource>/<clé>/` | Une ligne liée |
| `POST` | `/api/v1/<ressource>/<clé>/<action>/` | Une action sur l'élément (`actions` du catalogue : fusionner un mot-clé dans un autre) |
| `GET` | `/api/debug/journal/` | Le journal du service gardé en mémoire (page Debug, plus bas) |
| `GET` | `/api/debug/metriques/`, `…/requetes/`, `…/export/` | Les métriques des appels `/api/` et des pages vues d'une instance ; les dernières requêtes une à une ; les agrégats horaires en pièce jointe (page Debug, plus bas) |
| `GET` | `/api/debug/systeme/` | Processus, disque et sa répartition par type de données, fichiers, échantillons, évènements, volume des métriques, alertes (page Debug, plus bas) |
| `GET` | `/api/debug/tables/`, `/api/debug/tables/<nom>/` | Les tables et vues de la base vivante, puis une page des lignes de l'une d'elles (fiches comprises), en lecture seule, avec son `ETag` et `304` sur `If-None-Match` (menu « DB », le schéma de la base, de la page Debug, plus bas) |
| `GET` | `/api/debug/base/` | La version de la base vivante, qui change à chaque écriture validée : la page Debug la relève pour suivre les tables en direct (plus bas) |
| `POST` | `/api/metriques/page/` | La balise des pages vues (mesures du navigateur) : **les deux instances**, hors `/api/v1/` (plus bas) |

`PUT` n'existe pas : `PATCH` modifie les colonnes envoyées, les autres restent.

**La clé d'une ligne dans l'adresse** (`lib/ressources.mjs#segmentDeCle`) : les valeurs des colonnes de sa clé primaire (pour une ligne liée, sans
celles que le parent donne), chacune encodée (`encodeURIComponent` : « / » → `%2F`, « # » → `%23`, « : » → `%3A`), jointes par « , ». Un
métier : `/api/v1/metiers/metiers%2Facrobate/` ; une capacité de carte de monstre (clé `monstre_id`, `rang`, le monstre venant du parent) :
`/api/v1/monstres/<monstre>/capacites/4/`. Chaque élément d'une liste et chaque détail donne déjà sa `cle` et son `adresse`.

## Lire

**Liste** (`GET /api/v1/<ressource>/`) :

```json
{ "ressource": "metiers", "adresse": "/api/v1/metiers/", "total": 72, "limite": 50, "decalage": 0, "tri": "nom,id",
  "elements": [{ "cle": "metiers%2Facrobate", "adresse": "/api/v1/metiers/metiers%2Facrobate/", "id": "metiers/acrobate", "nom": "Acrobate", … }] }
```

| Paramètre | Effet |
| --- | --- |
| `?q=` | Recherche dans les colonnes de recherche de la ressource (`recherche` du catalogue ; le libellé par défaut), sans accents ni majuscules (`lib/text.mjs#normalize`) |
| `?tri=col,-col` | Tri (« - » : décroissant) ; la clé primaire départage toujours ; défaut : le tri de la ressource (`tri` du catalogue) |
| `?limite=` | 50 par défaut, de 1 à 500 (`400` sinon) |
| `?decalage=` | Lignes sautées (pagination) |
| `?<colonne>=<valeur>` | Égalité ; répété, l'une OU l'autre (`?famille_id=a&famille_id=b`) ; vide, la colonne est vide (NULL, ou texte vide) ; une colonne inconnue : `400` qui donne les colonnes |

Une liste ne rend que les colonnes de liste de la ressource (`liste` du catalogue) ; une liste de lignes liées, toutes leurs colonnes. Une
ressource qui ne prend qu'une partie d'une table (les armes sans celles des monstres, les pages du guide…) applique toujours sa condition.
Une colonne de la table qui s'appelle `cle` ou `adresse` (`alias`, `invocation_bloc`, `note_version_ligne`, `historique_modification`) se lit
`colonne_cle` / `colonne_adresse` dans une liste ou une ligne liée (le détail, `element`, la garde sous son nom).

**Détail** (`GET /api/v1/<ressource>/<clé>/`) :

```json
{ "ressource": "metiers", "cle": "metiers%2Facrobate", "adresse": "/api/v1/metiers/metiers%2Facrobate/",
  "element": { "id": "metiers/acrobate", "nom": "Acrobate", "description": "…", … },
  "extensions": {}, "enfants": {}, "derivees": { "metier_bonus": [ … ], "metier_recette_famille": [ … ], "metier_objet_depart": [ … ] },
  "version": "3f1c…" }
```

- `element` : toute la ligne ; `extensions` : les lignes des tables 1:1 qui la complètent (par nom de table, `null` si absente) ; `enfants` : les
  lignes liées, par sous-ressource, chacune avec sa `cle` et son `adresse` ; `derivees` : les tables que le service refait quand la ligne change
  (bonus découpés d'un métier…), en lecture.
- `version` (et l'en-tête `ETag`) : l'empreinte de **toute la représentation** — `element`, `extensions`, `enfants` et `derivees`. Un enfant modifié
  sans toucher la ligne parente (le bloc d'un événement, le don d'une race…) change donc la version du parent : un client qui revalide
  (`If-None-Match`) reçoit la nouvelle liste, et un `DELETE` avec `If-Match`, qui emporte les enfants, est refusé (`409`) si l'un d'eux a changé.
  `If-None-Match` égal → `304` sans corps.

## Écrire

**Créer** (`POST /api/v1/<ressource>/`, corps = les champs de création du catalogue, `creation.champs`) : une opération `creer` de l'entité de la
ressource. L'identifiant est tiré une fois du nom puis figé, jamais réutilisé ; ce qui n'est pas donné reste vide ou « À compléter. » (règle d'or :
rien n'est déduit). Réponse `201` : le détail créé, plus `lot` et `fiches`, avec `Location` et `ETag`. Sur une sous-ressource, le parent vient de
l'adresse (le donner aussi dans le corps avec une autre valeur : `400`).

**Modifier** (`PATCH /api/v1/<ressource>/<clé>/`) : `{ "<colonne>": valeur, "<table d'extension>": { "<colonne>": valeur } }`. Une opération
`modifier` par table touchée, colonnes de `TABLES` seulement (une autre colonne : `400` qui donne la liste) ; ce qui en dépend est recalculé par le
service. Une extension absente n'est pas créée (`404`, rien n'est écrit). Réponse `200` : le détail relu, plus `lot` et `fiches`, `ETag`.

**Supprimer** (`DELETE /api/v1/<ressource>/<clé>/`, corps facultatif) : une opération `supprimer` de l'entité de la ressource → `{ supprime, adresse,
lot, fiches }`. Ce que d'autres règles citent est refusé (`409`, qui les nomme) ; un don, une spécialité, un métier ou une arme est retiré des fiches
qui l'ont, avec une note datée (R42, R52) ; un composant reste dans l'inventaire sous son nom (R60) ; `fiches` liste les fiches adaptées.

**Concurrence** : `If-Match` est facultatif. Égal à la `version` lue (celle de toute la représentation), les valeurs lues partent en `avant` dans le
lot (le contrôle du mode modification) ; périmé, rien n'est écrit et la réponse `409` rend l'état actuel `{ erreur, element, extensions, version }`,
pour recommencer.

**Opérations du lot** : certaines tables, le site de dev ne les écrit ni par `TABLES` ni par `ENTITES` mais par une opération du lot
(`serveur/edition.mjs#OPERATIONS`) ; le registre les nomme (`operations` : `{ POST, PATCH, DELETE }` → l'opération ; `actions`) et
`serveur/ressources.mjs#TRADUCTIONS` traduit la requête en cette opération (mêmes refus, même journal) ; le catalogue en donne les champs.

| Adresse | Méthodes | Opération | Ce qu'elle fait |
| --- | --- | --- | --- |
| `relations-entre-peuples/` | Relations entre peuples | `relation_peuple` | créer, modifier, supprimer | — |
| `races/<race>/magies-innees-de-l-onglet/` | `POST`, `DELETE` | `magies_innees` | Ajoute une magie à la fin de la liste de l'onglet (`magie_id`), l'en retire — seulement pour une race dont l'onglet limite ses magies (R11 ; sinon `409`) |
| `races/<race>/acces-aux-magies/<magie>/` | `PATCH` | `magies_innees` | Rend une magie accessible ou non en magie innée (`accessible` : 1 ou 0) dans la matrice de la fiche (R8), pour une race dont l'onglet ne limite pas ses magies (sinon `409`) : c'est ainsi qu'une race créée reçoit ses magies |
| `evenements/<événement>/categories/` | `POST`, `DELETE` | `categories` | Pose une catégorie sur l'événement (`categorie_id`), l'en retire |
| `monstres/<carte>/valeurs-de-capacites/` | `POST`, `PATCH`, `DELETE` | `valeurs_de_capacite` | Pose une valeur propre (`rang`, `numero`, `valeur`), la change, l'efface (R69) ; la valeur commune (ou `null`) n'est jamais écrite : elle efface la valeur propre (`element: null` dans la réponse) |
| `mots-cles/<mot-clé>/fusion/` | `POST` | `fusionner_mots_cles` | Verse les pages du mot-clé dans `dans`, y recible ses balises (« {{id}} » des textes), puis le retire du vocabulaire ; un `PATCH` qui renomme vers l'écriture d'un autre mot-clé répond `409` avec cette action toute prête (`action: { methode, adresse, corps }`) |

Les références « @i » d'un lot à plusieurs opérations (créer une spécialité puis son don dans la même requête) restent sur `POST /api/edition/`.

`lot` est l'identifiant du lot du journal (`null` si rien n'a changé : une valeur identique n'écrit rien). Chaque écriture réussie est notée au
journal du service : `api v1 : PATCH /api/v1/metiers/metiers%2Facrobate/ → lot <id> (N ligne(s))` (catégorie `edition`), avec le nombre de fiches
adaptées, jamais leurs noms ; le lot porte la page `api/v1/<ressource>[/<sous-ressource>]`.

## Codes de réponse

| Code | Quand |
| --- | --- |
| `200` `201` | Lu, modifié, supprimé ; créé (`Location`) |
| `304` | `If-None-Match` égal à la version (détail) |
| `400` | Corps illisible ou qui n'est pas un objet JSON, rien à modifier, colonne ou paramètre inconnu, valeur refusée par le service d'édition (type, bornes, champ obligatoire, balise du glossaire qui ne cite aucun mot-clé : `refs`), `limite` hors bornes |
| `403` | Hors du site de dev (tout `/api/v1/`) ; écriture qui vient d'un autre site (`Sec-Fetch-Site`) |
| `404` | Ressource, sous-ressource ou ligne inconnue (ou hors de la ressource) ; extension absente au `PATCH` |
| `405` | Méthode que la ressource n'a pas : `Allow` donne la liste exacte, le corps la raison (lecture seule ; ni le service d'édition ni une opération du lot ne le font, et par quelles méthodes la ressource s'écrit) et les `capacites` |
| `409` | `If-Match` périmé ; refus du service d'édition (élément cité par d'autres règles, mot-clé protégé, dernier bloc d'un événement…) |
| `413` | Corps de plus de 1 Mio |
| `415` | Écriture sans `Content-Type: application/json` |
| `422` | Refusé par la base (contrainte CHECK, UNIQUE, NOT NULL, clé étrangère) ou valeur que les importeurs ne sauraient pas relire |
| `503` | Base vivante indisponible (`/api/etat/` dit pourquoi) |

Une erreur est toujours `{ "erreur": "<message en français>", … }`, avec les détails utiles (`methodes`, `element`, `version`…).

## Exemples (`curl`)

Sur le site de dev, ajouter `-u <utilisateur>:<mot de passe>` (mot de passe du site) ; en développement, le service seul répond sur
`http://127.0.0.1:8787` (`npm run serveur`) et le site sur `http://localhost:4321` (`npm run dev`, qui lui transmet `/api/`).

```bash
API=http://127.0.0.1:8787/api/v1
curl -s "$API/" | jq '.modules'                                         # le catalogue
curl -s "$API/metiers/?q=forge&tri=-nom&limite=5"                       # une liste
curl -si "$API/metiers/metiers%2Facrobate/"                             # un détail, avec son ETag
curl -s -X PATCH "$API/metiers/metiers%2Facrobate/" -H 'Content-Type: application/json' \
  -H 'If-Match: "<version lue>"' -d '{"description":"Nouveau texte."}'  # modifier (409 si quelqu'un est passé avant)
curl -si -X POST "$API/categories-de-chronologie/" -H 'Content-Type: application/json' \
  -d '{"libelle":"Essai"}'                                             # 201, Location: …/categories-de-chronologie/essai/
curl -s -X DELETE "$API/categories-de-chronologie/essai/" -H 'Content-Type: application/json'   # Content-Type exigé, même sans corps
curl -s "$API/openapi.json" > openapi.json                              # pour un outil OpenAPI
```

L'identifiant d'un élément créé est tiré une fois de son nom puis figé, et **jamais réutilisé**, même après sa suppression : recréer
« Essai » sur la même base donne `essai-2`. La clé à employer ensuite est celle que rend la réponse (`cle`, `adresse`, `Location`).

## Ressources par module

Le catalogue (`GET /api/v1/`) fait foi : il dit, ressource par ressource, les colonnes qui se modifient et les champs de création. Le tableau suivant
en est le résumé (`test/api-doc.test.mjs` le compare au registre : une ressource ajoutée ou une capacité changée doit y être reportée). « (partie) » :
la ressource ne prend que les lignes de la table qui passent sa condition.

### Création de personnage (`creation`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `races/` | Races | `race` | créer, modifier | `dons` (modifier), `colonnes-du-tableau-de-dons` (modifier), `lignes-du-tableau-de-dons`, `cases-du-tableau-de-dons` (modifier), `restrictions-de-caracteristique`, `magies-innees-de-l-onglet` (créer, supprimer), `acces-aux-magies` (modifier), `acces-aux-classes` |
| `ethnies/` | Ethnies | `ethnie` | lecture seule | `resistances` |
| `categories-de-classe/` | Catégories de classe | `categorie_classe` | lecture seule | — |
| `classes/` | Classes | `classe` | créer, modifier | `tableau-annexe` |
| `specialites/` | Spécialités | `specialite` | créer, modifier, supprimer | — |
| `dons-de-classe/` | Dons de classe | `capacite` | créer, modifier, supprimer | — |
| `objets-de-depart/` | Objets de départ | `objet_depart` | lecture seule | — |
| `metiers/` | Métiers | `metier` | créer, modifier, supprimer | — |

### Règles de jeu (`regles`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `caracteristiques/` | Caractéristiques | `caracteristique` | lecture seule | — |
| `competences/` | Compétences | `competence` | lecture seule | — |
| `niveaux/` | Niveaux globaux | `niveau_global` | lecture seule | `deblocages` |
| `seuils-de-niveau/` | Seuils par niveau | `seuil_niveau` | lecture seule | — |
| `constantes-de-regle/` | Constantes de règle | `regle_constante` | lecture seule | — |
| `paliers-d-entrainement/` | Paliers d’entraînement | `entrainement_palier` | lecture seule | — |
| `bonus-d-initiative/` | Bonus d’initiative | `initiative_agilite` | lecture seule | — |
| `types-de-don/` | Types de don | `type_don` | lecture seule | — |
| `postures/` | Postures | `posture` | lecture seule | `effets` |
| `paliers-de-resistance/` | Paliers de résistance | `resistance_palier` | lecture seule | — |
| `alterations-d-etat/` | Altérations d’état | `etat` | lecture seule | `magies-liees`, `stades`, `effets-par-palier` |
| `meteos/` | Météos | `meteo` | lecture seule | `effets` |
| `textes-des-modes/` | Textes d’explication des modes | `mode_texte` | lecture seule | — |
| `depassements-du-mode-hyper/` | Dépassements du Mode Hyper | `mode_hyper_depassement` | lecture seule | — |
| `objets-mode-super/` | Objets du Mode Super | `mode_super_objet` | lecture seule | — |
| `effets-mode-hyper/` | Capacités Mode Hyper | `mode_hyper_effet` (partie) | modifier | — |
| `effets-mode-hyper-autres-lectures/` | Effets du Mode Hyper (autres lectures) | `mode_hyper_effet` (partie) | lecture seule | — |
| `maladies/` | Maladies | `maladie` | lecture seule | `methodes` |

### Magie (`magie`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `magies/` | Magies | `magie` | modifier | `roles` (modifier), `resistances`, `incompatibilites`, `ethnies-secondaires`, `dieux` |
| `sorts/` | Sorts | `sort` | modifier | `mots-cles` |
| `ameliorations-cadaveriques/` | Améliorations cadavériques | `amelioration_cadaverique` | lecture seule | — |
| `regles-de-magie/` | Règles de magie | `regle_magie` | lecture seule | — |
| `codes-de-la-legende-des-sorts/` | Codes de la légende des sorts | `legende_sort` | lecture seule | — |
| `invocations/` | Invocations | `invocation` | lecture seule | — |
| `capacites-communes-d-invocation/` | Capacités communes d’invocation | `invocation_capacite_commune` | lecture seule | `resistances` |
| `blocs-d-invocation/` | Blocs d’invocation | `invocation_bloc` | lecture seule | `magies` |
| `creatures-invoquees/` | Créatures invoquées | `creature` | lecture seule | `ressources`, `caracteristiques`, `bonus-par-niveau-magique`, `effets` |
| `attaques-de-creatures-invoquees/` | Attaques de créatures invoquées | `creature_attaque` | lecture seule | `types` |
| `capacites-de-creatures-invoquees/` | Capacités de créatures invoquées | `creature_capacite` | lecture seule | `sorts`, `resistances` |

### Équipement (`equipement`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `armes/` | Armes | `arme` (partie) | créer, modifier, supprimer | — |
| `armes-de-monstres/` | Armes de monstres | `arme` (partie) | lecture seule | — |
| `familles-d-armes/` | Familles d’armes | `arme_famille` | lecture seule | — |
| `types-d-armes/` | Types d’armes | `arme_type` | lecture seule | — |
| `armes-elementaires/` | Armes élémentaires | `arme_elementaire` | lecture seule | — |
| `emplacements-d-armure/` | Emplacements d’armure | `armure_emplacement` | modifier | — |
| `armures/` | Armures | `armure` | modifier | — |
| `armures-elementaires/` | Armures élémentaires | `armure_elementaire` | lecture seule | — |
| `classes-de-bouclier/` | Classes de bouclier | `bouclier_classe` | modifier | — |
| `poids-de-bouclier/` | Poids de bouclier | `bouclier_poids` | modifier | — |
| `boucliers/` | Boucliers | `bouclier` | modifier | — |
| `ameliorations-d-arme/` | Améliorations d’arme | `amelioration_equipement` (partie) | modifier | — |
| `ameliorations-d-armure/` | Améliorations d’armure | `amelioration_equipement` (partie) | modifier | — |
| `ameliorations-de-bouclier/` | Améliorations de bouclier | `amelioration_equipement` (partie) | modifier | — |
| `autres-ameliorations/` | Améliorations de pièce élémentaire | `amelioration_equipement` (partie) | lecture seule | — |
| `emplacements-d-accessoire/` | Emplacements d’accessoire | `accessoire_emplacement` | lecture seule | — |
| `proprietes-d-accessoire/` | Propriétés d’accessoire | `accessoire_propriete` | lecture seule | — |
| `effets-d-accessoire/` | Effets d’accessoire | `accessoire_effet` | lecture seule | — |
| `montures-d-accessoire/` | Montures d’accessoire | `accessoire_monture` | lecture seule | — |
| `batons-magiques/` | Bâtons magiques | `baton_magique` | lecture seule | — |
| `panneaux-de-regles/` | Panneaux de règles | `panneau_regles` | modifier | `blocs` (créer, modifier, supprimer) |
| `machines-de-guerre/` | Machines de guerre | `machine_guerre` | lecture seule | — |

### Artisanat et ressources (`artisanat`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `monnaies/` | Monnaies | `monnaie` | créer, modifier, supprimer | — |
| `onglets-des-composants/` | Onglets des composants | `composant_onglet` | modifier | — |
| `constantes-d-equipement/` | Constantes d’équipement | `constante_equipement` | lecture seule | — |
| `objets/` | Objets | `ressource` (partie) | créer, modifier, supprimer | — |
| `materiaux/` | Matériaux | `ressource` (partie) | créer, modifier, supprimer | — |
| `gemmes/` | Gemmes | `ressource` (partie) | créer, modifier, supprimer | — |
| `bois/` | Bois | `ressource` (partie) | créer, modifier, supprimer | — |
| `ingredients-d-alchimie/` | Ingrédients d’alchimie | `ressource` (partie) | créer, modifier, supprimer | — |
| `potions/` | Potions | `ressource` (partie) | modifier | — |
| `kits-d-alchimie/` | Kits d’alchimie | `ressource` (partie) | lecture seule | — |
| `livres-et-parchemins/` | Livres et parchemins | `ressource` (partie) | lecture seule | — |
| `materiaux-de-construction/` | Matériaux de construction | `ressource` (partie) | lecture seule | — |
| `ressources-mentionnees/` | Ressources mentionnées | `ressource` (partie) | lecture seule | — |
| `niveaux-d-alchimie/` | Niveaux d’alchimie | `niveau_alchimie` | lecture seule | — |
| `affinites/` | Affinités | `affinite` | lecture seule | — |
| `fioles-de-verre/` | Fioles de verre | `fiole_verre` | lecture seule | — |
| `recettes/` | Recettes | `recette` | lecture seule | `ingredients`, `produits` |
| `familiers/` | Familiers | `familier` | lecture seule | — |
| `batiments/` | Bâtiments | `batiment` | lecture seule | — |

### Univers (`univers`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `dieux/` | Dieux | `dieu` | lecture seule | — |
| `evenements/` | Événements de la chronologie | `evenement` | créer, modifier, supprimer | `descriptions` (créer, modifier, supprimer), `categories` (créer, supprimer) |
| `categories-de-chronologie/` | Catégories de la chronologie | `categorie_chronologie` | créer, modifier, supprimer | — |
| `niveaux-de-relation/` | Niveaux de relation | `echelle_relation` | lecture seule | — |
| `peuples/` | Peuples | `peuple` | créer | — |
| `relations-entre-peuples/` | Relations entre peuples | `relation_peuple` | créer, modifier, supprimer | — |

### Bestiaire (`bestiaire`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `monstres/` | Monstres | `monstre` | créer, modifier, supprimer | `rubriques` (modifier), `capacites` (créer, modifier, supprimer), `valeurs-de-capacites` (créer, modifier, supprimer) |
| `especes-de-monstres/` | Espèces de monstres | `monstre_espece` | créer, modifier, supprimer | `blocs` (modifier), `cases-de-butin` (modifier) |
| `groupes-d-especes/` | Groupes d’espèces | `monstre_groupe` | modifier | — |
| `capacites-de-monstres/` | Capacités de monstres | `monstre_capacite_commune` | créer, modifier, supprimer | — |
| `objets-de-butin/` | Objets de butin | `monstre_butin_objet` | lecture seule | — |
| `echelles-de-puissance/` | Échelles de puissance | `monstre_echelle` | lecture seule | — |
| `regles-du-bestiaire/` | Règles du bestiaire | `monstre_regle` | lecture seule | — |

### Wiki et administration (`wiki`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `pages-du-guide/` | Pages du guide | `page` (partie) | modifier | — |
| `pages-du-codex/` | Pages du Codex | `page` (partie) | modifier | — |
| `pages/` | Pages du wiki | `page` (partie) | lecture seule | — |
| `annonces/` | Annonces | `annonce` | modifier | — |
| `alias-des-pages/` | Alias des pages | `alias` | lecture seule | — |
| `mots-cles/` | Mots-clés | `mot_cle` | créer, modifier, supprimer | `pages` |
| `sources/` | Sources | `source` | lecture seule | `pages` |
| `entites-des-pages/` | Entités des pages | `page_entite` | lecture seule | — |
| `types-de-page/` | Rubriques du wiki | `type_page` | lecture seule | — |
| `familles/` | Familles d’import | `famille` | lecture seule | — |
| `notes-de-cellule/` | Notes de cellule | `note_cellule` | lecture seule | — |
| `ecarts-de-sources/` | Écarts entre sources | `ecart_source` | lecture seule | — |
| `corrections/` | Corrections de coquilles | `correction` | lecture seule | — |
| `liens/` | Liens entre pages | `lien` | lecture seule | — |
| `notes-de-version/` | Notes de version | `note_version` | lecture seule | `lignes` |
| `historique/` | Historique des modifications | `historique_modification` | lecture seule | — |

Les tables qui ne sont pas des éléments (tables de détail refaites par le service, vues de recherche, fiches de personnages, journal) sont rangées
dans `HORS_RESSOURCE` de leur module, avec la raison : `test/ressources-registre.test.mjs` exige que chaque table de `data/schema.sql` soit rangée une
fois et une seule (ressource, sous-ressource, extension, dérivée ou hors ressource).

Chaque opération du lot du service est joignable par une ressource (`test/ressources-registre.test.mjs` lit `OPERATIONS` dans
`serveur/edition.mjs`) ; seuls les lots à plusieurs opérations atomiques (références « @i » : créer une spécialité puis son don dans la même
requête) restent sur `POST /api/edition/` : [`serveur.md`](serveur.md), « Édition ».

Une table partagée par condition peut avoir la même dérivée dans chacune de ses ressources (`amelioration_total`, la ligne TOTAL de chaque cible
d'amélioration, dans `ameliorations-d-arme`, `ameliorations-d-armure`, `ameliorations-de-bouclier` et `autres-ameliorations`) ; le test du registre exige que chaque ligne d'un enfant, d'une dérivée ou
d'une extension ait son parent dans une ressource, condition comprise.

## Rendre une ressource modifiable

L'API ne sait écrire que ce que le service d'édition sait écrire : rendre une ressource modifiable, c'est l'apprendre **au service**, puis le
registre suit tout seul (`capacitesDe`). Une table en lecture seule aujourd'hui (états, dieux…) le devient ainsi :

1. **Colonnes modifiables** : son entrée dans `TABLES` (`client/src/lib/edition-modele.mjs` : colonnes, types de champ, `requis`, bornes, `choix`
   ou `liste`) ; une colonne qui prend ses valeurs dans une liste l'ajoute dans `listes(db)` (`serveur/edition.mjs`).
2. **Ce qui en dépend** : son domaine `{ colonnes, deriver }` dans `serveur/edition.mjs` (ou un module `serveur/edition-<domaine>.mjs` branché dans
   `DOMAINES`, sur le modèle des armes, des composants, du bestiaire et de la chronologie), avec les découpages des importeurs (colonnes typées,
   tables de détail) ; toute page typée qu'il réécrit va dans `recalculerLesPages` (colonne dérivée, sinon perdue au rejeu).
3. **Note de version** : la table dans `TABLES_LUES` et `DEFINITIONS` (`lib/notes-de-version.mjs`), avec un domaine de note existant ou une
   migration du CHECK de `note_version_ligne.domaine`.
4. **Créer et supprimer** : une entité dans `ENTITES` (`table`, `champs`, `suppression`) et `DOMAINES[table].creer(ctx, valeurs, op)` qui rend
   `{ id, resume }` (identifiant tiré du nom et vérifié par `idDejaEmploye`, `provenance`, page créée si l'entité en a une) ;
   `supprimer(ctx, cle, op)` vide les détails (`synchroniser(..., [])`), retire ou détache les fiches qui la citent (`retirerDesFiches`,
   `detacherDesFiches` ; une clé étrangère de la section 13 vers elle va dans `RETRAITS`) et refuse si d'autres règles la citent.
5. **Registre** : dans `lib/ressources/<module>.mjs`, `ecriture: { creer, supprimer }` (et `parentCreation`, `cleCreee`, `cleSuppression` pour une
   sous-ressource ou une clé composée ; `exiges`, `limite` pour que l'exemple de la documentation passe ; `champsFiges`, `colonnesFigees` pour ce que
   la page ne montre pas) ; retirer `lectureSeule` s'il y était. Une table que le service écrit par une opération du lot : `operations` (ou
   `actions`), sa traduction dans `TRADUCTIONS` et son nom dans `OPERATIONS_DU_LOT`. Reporter la capacité dans le tableau ci-dessus.
6. **Tests** : un test `serveur-edition-<domaine>` (le service) et le test du découpage rejoué sur toute la base ; `serveur-api-v1` vérifie déjà
   que le catalogue, les `405` et la description OpenAPI suivent le registre.
7. **Côté pages** (si la page doit se modifier aussi en mode modification) : `data-ed` (`attributEd`), un rendu dans `RENDUS`
   (`lib/edition-rendu.mjs`) et une extension dans `src/scripts/edition/`.

Ne jamais faire écrire l'API en SQL direct, ni déduire une valeur absente (règle d'or : une entité créée reçoit « À compléter. » ou des valeurs vides).

## Page Debug

`/debug/` (menu Outils, **site de dev seulement** ; demande du propriétaire : « une page Debug, visible uniquement sur le serveur dev ») : sous le
titre et la ligne d'état du service, **quatre menus déroulants, tous fermés par défaut** (ni `open`, ni état mémorisé qui les rouvrirait), dans
l'ordre voulu par le propriétaire (2026-10-15 : « Il faudra mettre les journaux du serveur dans un menu déroulant fermé de base. Performance et
système aussi sont fermés par défaut. L'ordre des menus est : 1) Système 2) Performance 3) Journaux 4) DB (ton futur schéma). Tester l'API sera
donc supprimé car devenu inutile après le schéma »), et rien d'autre. **Un menu fermé ne demande rien au service** : Système, Performances et
Journaux chargent leurs données à leur ouverture (aussitôt), les relèvent tant qu'ils restent ouverts (et que l'onglet se voit) et s'arrêtent quand
on les referme (`lib/debug-metriques.mjs#suivreLOuverture`) ; DB dessine le schéma à sa première ouverture puis, tant qu'il reste ouvert (et que
l'onglet se voit), relève la version de la base toutes les 2 s et ne relit nombres de lignes et contenu que quand elle change.

1. **Système** (choix de l'instance en tête, le même qu'en tête de Performances, les deux listes se suivent ; une adaptation, pas une demande :
   Performances étant fermé par défaut, sans elle il faudrait l'ouvrir, donc lancer ses relèves, pour changer l'instance de Système) : alertes,
   processus (version, code, Node, PID, démarrage, mémoire RSS / tas / externe, CPU, boucle d'événements p50 / p99 / max, charge), disque du dossier
   de la base vivante (sa jauge remplit la place **non disponible** : prise et réserve de root), volume des métriques (taille, croissance en régime
   mesurée ou estimée, débit d'écriture avant purge, taille dans un an et à rétention pleine calculées par le service table par table, réglages des
   requêtes brutes et de la balise — « — » s'ils sont inconnus —, rétention), courbe mémoire / boucle (pas : la médiane des écarts, un échantillon
   d'arrêt ne la hache pas), fichiers suivis (base vivante, archives, lots de mise à jour, métriques de chaque instance), évènements du service avec
   leur durée (démarrage, base vivante et rejeu, fiches, lots d'édition, mise à jour, appels GitHub, maintenance, `5xx` avec l'empreinte de la pile,
   purge, arrêt). D'une autre instance (production vue du site de dev), l'état vient de son fichier : son dernier échantillon par minute et son
   dernier démarrage. Relevé toutes les 30 s, menu ouvert. Dans Système, après le processus, le disque et le volume, la jauge **Espace disque du
   serveur** (demande du propriétaire du 2026-10-15 : « la métrique de la place occupée sur le serveur sur la place totale sous forme de jauge,
   colorée en fonction du type de données (DB, Code, Import images, etc.) », puis « Inclus-la directement dans Système ») : une jauge pleine largeur,
   un segment coloré par type de données (`disque.repartition` de la même réponse `/api/debug/systeme/`), la somme des segments faisant **exactement
   la place totale du disque** ; en titre « X Go occupés sur T Go (p %) · L Go libres · R Go réservés au système » (la place occupée est celle de
   `df`, *Used* ; la réserve de root à part) ; chaque segment a son infobulle habillée (nom, taille, part, ce qu'il compte) et la légende dit tout (la
   couleur n'est jamais seule) ; survoler un segment ou un type de la légende met les deux en évidence. Types : base de données, images importées,
   mises à jour, métriques, code, données, images et autres fichiers du site, puis, sur le VPS (relevé de l'hôte, `deploy/vps/volume.sh`), Docker,
   journaux, installations et copies, puis système et autres, réservé au système, libre (détail et règles : [`serveur.md`](serveur.md), « Jauge de
   l'espace disque »). Tailles en unités décimales (Go), comme les hébergeurs.
2. **Performances** (demande du propriétaire du 2026-10-15 : « isoler les informations de temps de réponse […] voir quels sont les appels les plus
   lents en moyenne ») : choix de l'**instance** (Site de dev ou Production : l'un **ou** l'autre, jamais mélangés — décision du propriétaire ; la
   même liste qu'en tête de Système, les deux se suivent), de la **période** (1 h, 24 h, 7 j, 30 j, 365 j, tout) et du **tri** ; chiffres globaux
   (appels, moyenne, médiane, p95, p99, min/max, écart type, temps cumulé, erreurs 4xx/5xx, part des `304`, octets, requêtes SQL par appel) et courbe
   des appels et du p95 par pas (5 min sur 1 h, heure sur 24 h et 7 j, jour au-delà), **sans les relèves automatiques** (journal, version de la base,
   métriques et système de la page Debug, maintenance de chaque page, balise : elles feraient l'essentiel des appels et mesureraient la page Debug
   elle-même ; leur nombre est dit à part, chacune garde sa ligne), tableau des **routes** (une ligne par route × méthode, triable par chaque
   colonne ; les trois plus lentes en moyenne et celles d'au moins 100 ms / 500 ms marquées ; un quantile au-delà de la dernière classe s'écrit
   « > 5 s »), **pages vues** (temps mesurés par le navigateur : premier octet, `DOMContentLoaded`, chargement, LCP, moyenne / p95), **navigateurs
   et appareils**, **origines des appels** (quelle page appelle quelle route ; ces trois listes sont comptées par heure : sur « 1 h », une phrase
   dit leur fenêtre, `depuis_horaire`), **requêtes récentes** une à une (site de dev seulement, mémoire du service : phases, octets, SQL dont la requête la plus lente,
   page, navigateur ; filtres « plus lentes que … ms » et route, le gabarit exact ; l'instance « Production » choisie, une phrase à la place : la page
   ne montre jamais la mémoire du site de dev sous l'étiquette de la production), boutons **Exporter (CSV)** et **JSON** (agrégats bruts de la période
   affichée). Relevé toutes les 30 s, menu ouvert.
3. **Journaux du serveur** : le journal du service gardé en mémoire (`serveur/journal-du-service.mjs` : les 2 000 dernières entrées, niveau info /
   avertissement / erreur, catégorie `service`, `http`, `base`, `fiches`, `edition`, `mise-a-jour`, `maintenance`), relevé toutes les 2 s, menu ouvert
   (`GET /api/debug/journal/?depuis=<n>` ; refermé puis rouvert, il reprend après la dernière entrée vue), filtré dans la page (niveaux, catégorie,
   texte), avec Pause (bouton bascule au libellé fixe, `aria-pressed`) et « Effacer l'affichage ». Les nouvelles lignes s'ajoutent en haut sans
   refaire le tableau : la ligne lue reste à sa place et une sélection en cours diffère l'affichage. Chaque réponse porte l'identité du processus
   (`processus`) : un redémarrage du service se voit même quand la page n'a rien relevé entre-temps (onglet caché, pause), et tout est relu depuis le
   début. Chaque requête `/api/` y est notée (catégorie `http` : méthode, adresse avec sa requête, statut, durée ; jamais les corps), sauf les relèves
   réussies du journal, de la version de la base, des métriques, du système et de l'état de maintenance, et la balise des pages vues (reconnues à
   leur chemin, jamais à leur chaîne de requête : `journal-du-service.mjs#estUneReleve`) ; son entrée porte en plus des **champs isolés**
   `{ duree_ms, methode, route, statut, octets_sortie }` (`route` : le gabarit sans identifiant, ci-dessous), d'où une colonne **Durée** triable
   (Heure / Durée) et le filtre « plus lent que … ms » (`?min_ms=`, appliqué par le service, qui fait tout relire). En production, ni mémoire ni ligne
   par requête : la sortie du service (`docker logs`) ne garde que ses événements et les échecs du service (`5xx`).
4. **DB**, le schéma de la base (dessiné à la première ouverture du menu ; demande du propriétaire du 2026-10-15 : « En plus d'un openapi, je veux un
   mappage vectoriel des tables […] D'un double clic sur une de ces tables, ça ouvrirait une popup avec le contenu dans un tableau (scrollable) »,
   puis « 4) DB (ton futur schéma) » : titre « DB », la sous-ligne dit « Schéma de la base » et ses nombres) : une carte de **toutes les tables**
   (195, dont les 2 dérivées `lien` et `lien_candidat`) et des **35 vues** (masquées par défaut, case « Montrer les vues » ; les montrer ne déplace
   aucune table), une boîte par table avec chaque colonne, son type déclaré, `PK`, `NN` et une pastille par clé étrangère, et **un lien par clé
   étrangère** (413 ; une clé à plusieurs colonnes reste un lien), de la ligne de la colonne à la colonne visée, flèche à l'arrivée ; une clé à
   plusieurs colonnes part de la colonne qui la distingue et arrive à la colonne visée au même rang (`indiceDuLien` :
   `race_don_tableau_cellule(race_id, ligne)` part de `ligne`, l'auto-référence de `note_cellule` de `repond_a` vers `rang`), et l'infobulle d'une
   colonne dit **chaque** clé qui la contient, en entier (« (race_id, colonne) → race_don_tableau_colonne(race_id, rang) »). Les tables sont rangées
   par section de `data/schema.sql` (un bloc teinté par section ; de loin, son titre court en grand, au moins 11 px à l'écran, et le titre entier en
   infobulle) et, dans une section, en couches : une table à droite de celles qu'elle cite. Les 152 liens vers `famille` sont allégés, une case les
   masque. **Zoom** (molette autour du pointeur une fois le schéma activé — un clic ou le focus dedans, ou le plein cadre — ou avec Ctrl ; de passage,
   et quand le zoom est à sa borne, la molette fait défiler la page ; pincement, boutons + et −, « Tout voir », « Plein cadre », où le reste de la
   page est inerte et qu'Échap quitte) et **déplacement** (glisser) ; trois niveaux de détail selon le zoom (de loin : les noms en grand ; à partir de
   0,7, quand ils se lisent : les colonnes ; de près : les types) ; le zoom est une transformation CSS d'un seul conteneur (boîtes en HTML, liens en
   SVG : un texte SVG serait remis en page à chaque image), l'épaisseur des traits suivant le zoom à la fin du geste (et par paliers pendant un grand
   zoom), l'infobulle ouverte suivant sa ligne. Survol d'une table : ses liens entrants et sortants éclairés ; clic sur la **pastille** d'une clé
   étrangère : la vue va aussitôt à la table visée (une colonne qui en vise plusieurs : la liste de ses clés) ; recherche d'une table (centrée,
   lisible, mise en évidence) ; les messages s'écrivent par-dessus la carte, sans la déplacer ; clavier : une table dans l'ordre de tabulation,
   flèches pour la voisine (dans la direction de la flèche, jamais de travers), Maj + flèches pour déplacer, + / − / 0, **L** pour la liste des clés
   étrangères de la table (Entrée y va), Entrée pour le contenu. **Double clic** ailleurs que sur une pastille (Entrée, appui long au toucher) : la
   fenêtre « Contenu de <table> » (`<dialog>`), lue dans la **base vivante** par `GET /api/debug/tables/<nom>/` par pages de 100 (« Charger plus », et
   au défilement), **toutes les tables et vues, fiches de personnages comprises**, total, tri par en-tête, NULL visible, nombres tels qu'en base
   (seule la partie entière est groupée par milliers), cellule coupée marquée d'un fondu et dépliée d'un clic ou au clavier ; Échap, « Fermer » ou un
   clic sur le fond la ferment ; un `403` (hors du site de dev) ou un service absent le disent en clair. Le nom d'une table n'est jamais coupé par le
   nombre de lignes de la base vivante (l'en-tête garde la place de « 99 999 lignes »). La structure (tables, colonnes, types, clés, sections,
   descriptions, nombre de lignes au build) est calculée **au build** (`lib/schema-structure.mjs`, depuis la base construite et `data/schema.sql`) et
   posée dans la page en JSON (`<script type="application/json" data-debug-schema>`), jamais dans un build `SITE_MODE=prod` ni dans la version
   portable ; les nombres de lignes des boîtes deviennent ceux de la base vivante dès que `GET /api/debug/tables/` répond, puis **suivent la base**
   tant que le menu reste ouvert, comme la fenêtre ouverte (« Suivi en direct », plus bas).

En production (`SITE_MODE=prod`) l'entrée n'est pas au menu et la page ne dit qu'une phrase, sans script ; la version portable ne l'emporte pas.
La CI construit aussi le site de production et y relance `debug-page` et `site-html` (`ci.yml`, `CONTROLES_DE_LA_CI`).
La page lit d'abord `GET /api/etat/` : sans `edition: true`, le service n'est pas celui du site de dev et elle s'arrête.

Code : `src/pages/debug.astro`, `src/scripts/debug.mjs` (Système, Performances, Journaux ; n'importe que `lib/debug-journaux.mjs` et
`lib/debug-metriques.mjs`, purs), `styles/debug/` ; DB : `components/debug/SchemaDeLaBase.astro`, son script `src/scripts/debug-schema.mjs` (n'importe
que `lib/debug-schema.mjs`, pur : mise en page, liens, caméra, recherche, rendus échappés ; aucun module commun avec `debug.mjs`),
`lib/schema-structure.mjs` (au build), `styles/debug/schema.css` ; menu : `lib/nav.mjs#entreesDuMenu` (`devSeulement`) ; service :
`serveur/metriques.mjs` (collecte, base des métriques, lectures), `serveur/metriques-sql.mjs` (requêtes SQL comptées pendant une requête HTTP) et
`serveur/debug-tables.mjs` (contenu des tables, version de la base).

### Contenu des tables

Site de dev seulement : ailleurs, `403` avant tout le reste — **seule la base du serveur de production reste fermée** (décision du propriétaire du
2026-10-15 : en production, la base ne s'ouvre que par les pages du site). Sur le site de dev, **tout se lit**, fiches comprises : décision du
propriétaire du 2026-10-15, « Il faut tout rendre ouvert. Ce qui est fermé c'est que la base du serveur de prod. » Lecture seule : toute autre
méthode que `GET` répond `405` (`Allow: GET`). Code : `serveur/debug-tables.mjs`.

**Le serveur de dev reste ouvert** (réponse du propriétaire du 2026-10-15 : « Le serveur dev restera. Il servira toujours pour modifier les
règles par ceux qui en auront l'accès. ») ; qui y a accès se réglera avec la connexion Discord (E7). Sa base vivante est une **copie de celle de
production**, faite à sa première installation puis conservée (`MAVERICK_BASE_TEST=conservee`, [`deploy/vps/README.md`](../deploy/vps/README.md)) :
ce qu'on y lit des fiches, des comptes et des groupes est cette copie, sans les règles de visibilité de `/api/personnages/` (`v_personnage_visible`).
Une fiche créée ou supprimée sur le site de dev ne part jamais en production (un lot ne porte pas la section 13). Le propriétaire attend une copie
de la production vers le dev après chaque mise en production, que le serveur de test ne fait pas encore (question 7 de
[`feuille-de-route.md`](feuille-de-route.md), « Questions encore ouvertes »).

| Requête | Réponse |
| --- | --- |
| `GET /api/debug/tables/` | `{ tables: [{ nom, genre, lignes }] }` : chaque table et vue de la **base vivante**, dans l'ordre des noms, ses lignes comptées maintenant ; `genre` = `table`, `derivee` (`-- @derivee` de `data/schema.sql`, hors FTS5) ou `vue` ; ni les tables internes de SQLite (`sqlite_…`), ni les tables FTS5 (virtuelles et leurs tables de *shadow*) |
| `GET /api/debug/tables/<nom>/?limite=1..500&decalage=&tri=<colonne>&ordre=asc\|desc` | `{ table, genre, colonnes: [{ nom, type, pk }], total, limite, decalage, tri, ordre, lignes: [{ <colonne>: valeur }] }` (100 lignes par défaut ; `tri` : `null` sans tri demandé) pour **toute** table ou vue de la liste, celles de la section 13 comprises (fiches de personnages, comptes, groupes, et les vues qui les lisent : `v_personnage_visible`, `v_personnage_controle`…) ; `ETag: "<16 hex>"` (sha256 du JSON du corps) et `Cache-Control: no-cache` ; `304` sans corps (avec l'`ETag`) si `If-None-Match` la contient (liste séparée par des virgules, `W/` toléré) ; `404` pour un nom qui n'est pas **exactement** celui d'une table ou d'une vue de la liste (interne, FTS5, casse, guillemets, « / » encodé…), `400` pour un tri qui n'est pas une colonne, un ordre inconnu, une limite hors de 1..500 ou un décalage qui n'est pas un entier positif (ni l'un ni l'autre n'a d'`ETag`) |
| `GET /api/debug/base/` | `{ version }` : la **version de la base vivante**, un texte opaque qui change dès qu'une écriture est validée, quelle que soit la table ; `Cache-Control: no-store` ; `405` (`Allow: GET`) pour une autre méthode, `503` sans base, `404` pour `/api/debug/base/<autre>/` |

Un nom n'entre dans le SQL qu'après avoir été trouvé tel quel dans `PRAGMA table_list` ; une colonne de tri, dans `PRAGMA table_info` ; la route
n'exécute que des `SELECT` et ces deux `PRAGMA`. Ordre **stable** d'une page à l'autre : la colonne de tri, puis la clé primaire, puis le rowid
(une vue : toutes ses colonnes) ; `desc` renverse tout l'ordre. Valeurs : une image (data URL `data:image/…`) n'est **jamais** rendue entière — une
question de volume, pas de secret : le portrait d'une fiche comme celui d'une carte de monstre devient `{ image: true, type, octets, empreinte }`
(l'empreinte de `lib/portrait.mjs`, comme `ligneSansImage`) ; une image **dans** un texte (le JSON de `modification.avant` / `apres` : le portrait
d'une carte de monstre modifié sur le site de dev) devient « [image <type>, N octets, empreinte <e>] » ; un texte de plus de 2 000 caractères est
coupé et suivi de « … (N caractères) » ; un BLOB devient `{ octets }` ; un entier hors de la plage sûre de JavaScript, son écriture en texte. **Ce
qui serait jeté n'est pas lu** : le SQL ne rend d'un texte long que ses 2 000 premiers caractères et sa longueur (`substr`, `length`), d'un BLOB que
sa taille ; seules les images (colonnes contraintes par `GLOB 'data:image/*'`, et un texte qui en contient une) sont lues en entier, pour leur
empreinte, et chaque ligne est résumée dès sa lecture. Une colonne d'image se **trie par sa taille** (`length`), et avec un tri la page de clés
(rowid ou clé primaire) se choisit d'abord, puis chaque ligne se lit par sa clé : le tri de SQLite ne porte jamais d'image (311 portraits de
700 000 caractères, le plafond : 100 lignes en ~0,3 s, sans hausse de mémoire ; triées par portrait, ~0,45 s au lieu de 0,7 à 1,4 s).
`/api/v1/` ne change pas : il ne sert jamais une table des sections 13 et 14 (`lib/ressources.mjs`).

**ETag d'une page** (`versionDuContenu`) : 16 caractères hexadécimaux d'un sha256 du JSON du corps, qui ne porte rien qui change sans que la page
lue change (ni heure, ni version de la base) : une autre page, une autre taille, un autre tri, une ligne de la page modifiée ou le total changé
donnent un autre ETag, une ligne hors de la page non.

**Version de la base** (`versionDeLaBase`) : « `<jeton>.<connexion>.<schema_version>.<data_version>.<total_changes>` », à coût fixe — une seule
instruction, préparée une fois par connexion, sans lire aucune table : le **jeton** est tiré au démarrage du processus (un service redémarré ne
redonne jamais une version déjà vue), la **connexion** est numérotée par une `WeakMap` sur l'objet que donne `service.base()` (l'enveloppe de
`serveur/metriques-sql.mjs`, la même pour une même connexion : une base rouverte ou remplacée en reçoit un autre), `PRAGMA schema_version` change
avec le schéma, `PRAGMA data_version` avec une écriture validée par une **autre** connexion sur le même fichier, `total_changes()` avec les lignes
écrites par **cette** connexion (celle du service). Une écriture validée change toujours la version ; une écriture annulée peut la changer (une
relecture pour rien). C'est une **relève** : réussie, elle n'est notée ni au journal du service ni dans la mémoire des requêtes, et elle est hors
du global des métriques, mais comptée sur sa ligne du tableau des routes (gabarit `/api/debug/base/`). Métriques : gabarits `/api/debug/tables/`,
`/api/debug/tables/{table}/` et `/api/debug/base/`.

**Suivi en direct** (demande du propriétaire du 2026-10-15 : « j'aimerais que ce tableau se mette à jour si la table change » ;
`src/scripts/debug-schema.mjs`, fonctions pures et testées de `lib/debug-schema.mjs`) : tant que le menu « DB » est ouvert **et** la page visible,
elle relève `GET /api/debug/base/` toutes les 2 s (minuterie enchaînée, jamais deux relèves à la fois ; aussitôt à l'ouverture du menu et au retour
de la page au premier plan ; rien menu fermé ou page cachée, pas même la suite d'une relève dont la réponse arrive après qu'on a refermé le menu ;
`403` : arrêt définitif ; réseau ou `5xx` : toutes les 10 s, puis 2 s après un succès : `suiteDeLaReleve`). La première version sert de
référence ; une version différente fait relire les nombres de lignes des boîtes (`GET /api/debug/tables/` ; une boîte dont le nombre change
s'éclaire 2 s, `.est-changee`) et, fenêtre « Contenu de <table> » ouverte, **chaque page déjà chargée** (pages alignées de 100 : `pagesARedemander`)
avec `If-None-Match` = l'`ETag` reçu pour elle : `304` = page inchangée ; `200` = ses lignes comparées à celles affichées par leur JSON, en
multiensemble (`planDeMiseAJour`), et seules celles qui diffèrent sont refaites. Le tableau montre alors exactement les premières min(lignes
affichées avant, total) lignes de la table (`assemblerLesPages` : une insertion garde le même nombre de lignes, « Charger plus » annonce les autres ;
une suppression en montre moins). Rien d'autre ne bouge : la première ligne visible reste à sa place à l'écran (sauf tout en haut), tri et ordre
gardés, en-têtes refaits seulement si les colonnes changent (focus d'un bouton de tri gardé), cellules dépliées gardées pour les lignes inchangées,
focus gardé (ou la case de même place) ; une ligne nouvelle ou changée **s'éclaire 2 s** (`tr.est-nouvelle` ; sous `prefers-reduced-motion`, un
simple fond retiré au même délai) ; les bandes alternées sont posées par ligne, pour qu'une insertion ne repeigne pas les suivantes. Une ligne
d'état dans l'en-tête de la fenêtre dit « Suivi en direct — à jour (lu à HH:MM:SS) », « … mis à jour à HH:MM:SS : N lignes changées » ou « …
interrompu : service injoignable, nouvel essai dans 10 s » (`libelleDuSuivi`) ; une zone `aria-live` polite, à part, n'annonce que les
changements. Jamais deux rafraîchissements à la fois, jamais pendant un chargement de page (« Charger plus », défilement : il attend la fin) ;
changer de table, de tri ou fermer la fenêtre l'abandonne ; plusieurs versions vues pendant l'un : un seul de plus ensuite. « Charger plus » n'est
jamais désactivé (Chrome retire le focus d'un bouton qui le devient) : pendant la lecture d'une page il est marqué occupé (`aria-disabled`), et un
clic pendant un rafraîchissement est rejoué après lui ; caché, il laisse le focus au cadre du tableau. « Charger plus » lit toujours une page alignée, et une page relue qui ne redonne pas les lignes déjà affichées qu'elle contient (la table a changé depuis) n'ajoute
rien : le tableau est rafraîchi d'abord (`pageAccordee`), pour que l'ETag de chaque page vaille pour ce qui est affiché. Erreurs au
rafraîchissement : `404` (table disparue) = message dans la zone d'erreur, contenu gardé, ni réécrit ni annoncé de nouveau tant qu'il ne change pas
(une écriture dans une autre table ne le répète pas) ; `400` sur le tri (colonne disparue) = retour à l'ordre par défaut et rechargement, dit avec le
résumé du rechargement (une seule annonce) et dans la ligne d'état (« mis à jour à … : colonne de tri « v » disparue, retour à l'ordre par défaut » :
`noteDuTriPerdu`) ; réseau = « interrompu », contenu gardé. Une lecture de page en échec (première page, « Charger plus ») le dit dans la ligne
d'état (`etatDeLEchec` : jamais « en attente du service » quand il a répondu) ; à la version suivante, une première page en échec se relit sans
rien effacer (ni « Chargement… », ni alerte réécrite si la réponse ne change pas), et un « Charger plus » en échec suivi d'un rafraîchissement sans
changement (tout en `304`) rend le bouton et le résumé.

### Routes des métriques

Site de dev seulement : ailleurs, `403` avant tout le reste (comme `/api/debug/journal/` et `/api/v1/`). Chaque instance a **son** fichier
(`prod.db`, `dev.db` : [`serveur.md`](serveur.md), « Métriques et volume ») ; le site de dev lit celui de la production en lecture seule.

| Requête | Réponse |
| --- | --- |
| `GET /api/debug/metriques/?instance=dev\|prod&periode=1h\|24h\|7j\|30j\|365j\|tout&tri=moyenne\|mediane\|p95\|p99\|max\|n\|erreurs\|total\|sql` | `{ instance, instances, periode, tri, depuis, jusqua, depuis_horaire, pas, bornes_ms, bornes_page_ms, global: STATS, global_avec_releves: STATS, releves: { n, routes }, routes: [{ route, methode, ...STATS }], serie: [{ debut, n, moyenne_ms, p95_ms, erreurs, erreurs_5xx }], pages: [{ page, n, ttfb_ms, ttfb_p95_ms, dom_ms, dom_p95_ms, charge_ms, charge_p95_ms, lcp_ms, lcp_p95_ms, au_dela }], navigateurs: [{ famille, appareil, n, pages }], origines: [{ page, route, n }], restreintes }` ; `global` et `serie` **sans les relèves automatiques** (`releves` les compte et les nomme, `global_avec_releves` les inclut) ; pages, navigateurs et origines (gardés par heure) depuis `depuis_horaire` ; les 500 pages et origines les plus nombreuses ; `instances` = celles dont le fichier existe ; `restreintes` = `{ raison, depuis }` pendant la restriction (plafond de la base ou disque bas : [`serveur.md`](serveur.md), « Volume estimé des métriques ») ; `404` pour une instance sans fichier, `400` pour une période ou un tri inconnu. Une période de 7 jours et plus, ou une lecture de l'autre instance, est gardée une minute |
| `GET /api/debug/metriques/requetes/?limite=&route=&route_exacte=&min_ms=&statut=` | `{ instance, capacite, requetes: [{ instant, methode, route, adresse, statut, duree_ms, phases: { corps_ms, traitement_ms, envoi_ms }, octets_entree, octets_sortie, sql: { n, ms, plus_lente: { sql, ms } }, page, navigateur, appareil, simultanees }] }` : les 2 000 dernières requêtes gardées en mémoire du site de dev (les relèves réussies de la page Debug, de la maintenance et la balise n'y sont pas), les plus récentes d'abord ; `route` : le gabarit contient ce texte, `route_exacte` : le gabarit est celui-ci (la liste « Route » de la page) ; `statut` = un code (`404`) ou une classe (`4xx`) ; `adresse` : le chemin, jamais l'identifiant d'une fiche (`/api/personnages/{id}/…`, ou `/api/personnages/…` pour une adresse inconnue dessous) |
| `GET /api/debug/metriques/export/?instance=&periode=&format=csv\|json` | Les agrégats bruts de la **même fenêtre que la page** (sommes, histogramme `h_le_<borne>ms`, octets, SQL, quantiles et `au_dela`) en pièce jointe (`Content-Disposition: attachment`) : par tranche de 5 minutes pour « 1h » (`pas` du JSON), par heure sinon ; 100 000 lignes au plus, les plus récentes (`X-Export-Tronque: 1` et `tronque` du JSON au-delà) |
| `GET /api/debug/systeme/?instance=dev\|prod` | `{ instance, instances, maintenant, periode, processus, disque: { dossier, libre, total, utilise, reserve, part_libre, repartition: [{ cle, libelle, octets }], repartition_le, repartition_partielle, repartition_hote }, fichiers, echantillons, evenements, volume: { metriques_octets, taille_logique_octets, croissance_octets_par_jour, croissance_source, croissance_mesuree_octets_par_jour, croissance_mesuree_jours, croissance_estimee_octets_par_jour, debit_ecriture_octets_par_jour, projection_un_an_octets, taille_a_terme_octets, lignes_par_jour, octets_par_ligne, retention, brutes, pages }, alertes: [{ niveau, message }] }` ; `volume` : voir [`serveur.md`](serveur.md), « Volume estimé des métriques » (`brutes` et `pages` d'une autre instance : lus dans son dernier démarrage, `null` s'il ne les dit pas) |
| `POST /api/metriques/page/` | La balise d'une page vue : `{ page, ttfb_ms, dom_ms, charge_ms, lcp_ms }` (chemin du site seulement, 200 caractères au plus ; une page que le site construit n'a pas est comptée dans `{autres}` ; valeurs de 0 à 120 000 ms ; corps de 2 Kio au plus ; `application/json` ou `text/plain` pour `navigator.sendBeacon` ; `Sec-Fetch-Site` du même site, et sans lui un en-tête `Origin` du même hôte ou aucun) → `204` ; acceptée sur **les deux instances** par défaut (décision du propriétaire : « Active-le aussi en prod dans un premier temps »), chacune dans son fichier, jamais dans la base vivante ; `MAVERICK_METRIQUES_PAGES=0` la ferme (`403`) ; 600 par minute au plus (`429`) |

`STATS` = `{ n, erreurs_4xx, erreurs_5xx, part_304, moyenne_ms, mediane_ms, p95_ms, p99_ms, min_ms, max_ms, ecart_type_ms, total_ms, octets_entree,
octets_sortie, sql_requetes_moyen, sql_ms_moyen, phases: { corps_ms, traitement_ms, envoi_ms }, sql_plus_lente: { sql, ms } | null, au_dela }`, au
centième de ms ; médiane et quantiles tirés d'un histogramme à bornes fixes (1, 2, 5, 10, 20, 50, 100, 200, 500, 1 000, 2 000, 5 000 ms, +∞), par
interpolation dans la classe — **jamais** dans la dernière (au-delà de 5 000 ms, sans borne haute : une seule valeur extrême y ferait la médiane et
le p95) : le quantile y est la borne basse de la classe (ou le minimum, plus haut) et son nom est dans `au_dela` (« > 5 s » sur la page). Les
pages vues ont leurs propres bornes (`bornes_page_ms` : 10 ms à 60 s, dont les seuils du LCP, 2,5 s et 4 s). **Route** : le gabarit de l'adresse,
jamais un identifiant ni la chaîne de requête (`/api/personnages/{id}/`, `/api/v1/metiers/{cle}/`, `/api/v1/races/{cle}/dons/{cle}/`,
`/api/mise-a-jour/lots/{lot}/`, `/api/debug/tables/{table}/` ; toute adresse inconnue : `/api/{inconnue}` ; une requête **refusée avant tout traitement**, `403` ou `405` :
`/api/<premier segment>/{refusee}/`, par exemple `/api/v1/{refusee}/` pour tout `/api/v1/` en production) : le nombre de routes est borné par le
code, même devant des requêtes fabriquées (une requête anonyme par gabarit × méthode en production : 70 lignes par heure, au lieu de 2 600).
**Jamais gardés** : adresse IP, corps, chaîne de requête, identifiant de fiche, `Authorization`, cookie, User-Agent entier (seulement sa famille
et l'appareil : ordinateur, téléphone, tablette, robot).

**Balise des pages** (`layouts/Base.astro`, script en ligne) : une fois par page vue, 5 s après le chargement ou plus tôt si l'on quitte la page
(ou masque l'onglet APRÈS le chargement ; un onglet masqué avant attend la fin du chargement, même en arrière-plan, pour que les chargements les
plus lents — ceux qu'on abandonne — comptent), une mesure d'environ 150 octets (`navigator.sendBeacon`) : temps jusqu'au premier octet,
`DOMContentLoaded`, chargement complet et LCP. Présente dans **tous** les builds,
production comprise, sauf la version portable, `/maintenance/` et `SITE_METRIQUES_PAGES=0` au build (l'interrupteur côté site ; côté service :
`MAVERICK_METRIQUES_PAGES=0`).

## Tests

`ressources-registre` (chaque table rangée une fois, registre cohérent, `RESSOURCES_MODULE=<module>` pour un seul module), `serveur-api-v1` (fermeture
en production, catalogue, description OpenAPI et ses exemples envoyés tels quels par un client, `test/aide-openapi.mjs`, listes, conditions, détail et ETag, sous-ressources, `405`, écritures par le journal,
`If-Match`, R42, images, `/api/debug/journal/`, serveur HTTP réel), `api-doc` (le tableau des ressources de ce document), `journal-du-service`,
`debug-page`, `nav` ; `serveur-metriques` (routes normalisées, collecte, agrégats, quantiles, rétention, lectures, deux instances),
`serveur-metriques-bornes` (quantiles au-delà de la dernière classe, migration du schéma 4, croissance logique et projections, échantillons d'une
même seconde, fenêtres « 1h » et export, `iterate`, relèves hors du global, cardinalité : pages du site, couples, refus, plafond ; lectures
classées par SQLite, images de l'autre instance),
`serveur-metriques-http` (vrai serveur : routes des métriques et balise), `serveur-metriques-disque` (répartition du disque, relevé de l'hôte,
réserve de root), `debug-metriques` (rendus purs de Performances, Système et de la jauge), `debug-balise` (balise des pages) ;
`serveur-debug-tables` (contenu des tables : `403` hors du site de dev, liste, noms piégés, `400`, pagination, ordre stable, images et textes
longs résumés, vues, tables et vues de la section 13 lisibles (portrait résumé), lecture seule, `ETag` et `304`, version de la base — stable sans
écriture, changée par une écriture de cette connexion ou d'une autre, par le schéma, par une réouverture, et d'un processus à l'autre —, route
`/api/debug/base/`, gabarits et relèves des métriques et du journal, vrai serveur), `debug-schema` (structure du build sur la vraie base, mêmes
tables dérivées que le service, mise en page sans chevauchement, un lien par clé étrangère, niveaux de détail, caméra, clavier, recherche, rendus
échappés, fenêtre du contenu, suivi en direct — relève, pages à redemander, assemblage, lignes à refaire rejouées au hasard contre une force
brute, libellés —, script et composant) ; `debug-page` vérifie les quatre menus fermés et leur ordre, qu'un menu fermé ne demande rien
(`suivreLOuverture`), et leur absence en production ; `serveur-livraison` liste les modules livrés.

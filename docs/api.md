# API REST `/api/v1/` (site de dev)

Demande du propriétaire : « une entrée pour TOUS les éléments possibles, avec une API REST et un CRUD ». Chaque élément du jeu rangé dans la base
(races, classes, dons, sorts, armes, composants, monstres, événements de la chronologie, pages du guide…) a une adresse sous `/api/v1/`, où il se lit
et, quand le service d'édition sait le faire, se crée, se modifie et se supprime. La page **Debug** du site de dev (menu Outils) permet de tout essayer
depuis le navigateur.

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
- **Pas de comptes avant la 1.0** : quiconque a le mot de passe du site de dev lit et écrit (le lot n'a pas d'auteur). Les écritures exigent
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
| `mots-cles/<mot-clé>/fusion/` | `POST` | `fusionner_mots_cles` | Verse les pages du mot-clé dans `dans` puis le retire du vocabulaire ; un `PATCH` qui renomme vers l'écriture d'un autre mot-clé répond `409` avec cette action toute prête (`action: { methode, adresse, corps }`) |

Les références « @i » d'un lot à plusieurs opérations (créer une spécialité puis son don dans la même requête) restent sur `POST /api/edition/`.

`lot` est l'identifiant du lot du journal (`null` si rien n'a changé : une valeur identique n'écrit rien). Chaque écriture réussie est notée au
journal du service : `api v1 : PATCH /api/v1/metiers/metiers%2Facrobate/ → lot <id> (N ligne(s))` (catégorie `edition`), avec le nombre de fiches
adaptées, jamais leurs noms ; le lot porte la page `api/v1/<ressource>[/<sous-ressource>]`.

## Codes de réponse

| Code | Quand |
| --- | --- |
| `200` `201` | Lu, modifié, supprimé ; créé (`Location`) |
| `304` | `If-None-Match` égal à la version (détail) |
| `400` | Corps illisible ou qui n'est pas un objet JSON, rien à modifier, colonne ou paramètre inconnu, valeur refusée par le service d'édition (type, bornes, champ obligatoire), `limite` hors bornes |
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
| `resistances-entre-magies/` | Résistances entre magies | `resistance_magie` | lecture seule | — |
| `resistances-des-couples-de-magies/` | Couples de magies | `resistance_duo` | lecture seule | `combinaisons` |
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
| `sorts/` | Sorts | `sort` | modifier | — |
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
| `emplacements-d-armure/` | Emplacements d’armure | `armure_emplacement` | lecture seule | — |
| `armures/` | Armures | `armure` | lecture seule | — |
| `armures-elementaires/` | Armures élémentaires | `armure_elementaire` | lecture seule | — |
| `classes-de-bouclier/` | Classes de bouclier | `bouclier_classe` | lecture seule | — |
| `poids-de-bouclier/` | Poids de bouclier | `bouclier_poids` | lecture seule | — |
| `boucliers/` | Boucliers | `bouclier` | lecture seule | — |
| `ameliorations-d-arme/` | Améliorations d’arme | `amelioration_equipement` (partie) | modifier | — |
| `autres-ameliorations/` | Améliorations d’armure, de bouclier et de pièce élémentaire | `amelioration_equipement` (partie) | lecture seule | — |
| `emplacements-d-accessoire/` | Emplacements d’accessoire | `accessoire_emplacement` | lecture seule | — |
| `proprietes-d-accessoire/` | Propriétés d’accessoire | `accessoire_propriete` | lecture seule | — |
| `effets-d-accessoire/` | Effets d’accessoire | `accessoire_effet` | lecture seule | — |
| `montures-d-accessoire/` | Montures d’accessoire | `accessoire_monture` | lecture seule | — |
| `batons-magiques/` | Bâtons magiques | `baton_magique` | lecture seule | — |
| `machines-de-guerre/` | Machines de guerre | `machine_guerre` | lecture seule | — |

### Artisanat et ressources (`artisanat`)

| Adresse | Élément | Table | Écritures | Sous-ressources |
| --- | --- | --- | --- | --- |
| `monnaies/` | Monnaies | `monnaie` | créer, modifier, supprimer | — |
| `constantes-d-equipement/` | Constantes d’équipement | `constante_equipement` | lecture seule | — |
| `objets/` | Objets | `ressource` (partie) | créer, modifier, supprimer | — |
| `materiaux/` | Matériaux | `ressource` (partie) | créer, modifier, supprimer | — |
| `gemmes/` | Gemmes | `ressource` (partie) | créer, modifier, supprimer | — |
| `bois/` | Bois | `ressource` (partie) | créer, modifier, supprimer | — |
| `ingredients-d-alchimie/` | Ingrédients d’alchimie | `ressource` (partie) | créer, modifier, supprimer | — |
| `potions/` | Potions | `ressource` (partie) | lecture seule | — |
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
d'amélioration, dans `ameliorations-d-arme` et `autres-ameliorations`) ; le test du registre exige que chaque ligne d'un enfant, d'une dérivée ou
d'une extension ait son parent dans une ressource, condition comprise.

## Rendre une ressource modifiable

L'API ne sait écrire que ce que le service d'édition sait écrire : rendre une ressource modifiable, c'est l'apprendre **au service**, puis le
registre suit tout seul (`capacitesDe`). Une table en lecture seule aujourd'hui (armures, potions, états, dieux…) le devient ainsi :

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

`/debug/` (menu Outils, **site de dev seulement** ; demande du propriétaire : « une page Debug, visible uniquement sur le serveur dev […] un menu
qui permettra de tester chaque requête à l'image d'un swagger. L'ensemble de ce swagger est caché dans un menu déroulant. En dessous on trouvera les
logs du serveur (avec une possibilité de filtrer) ») :

- **Tester l'API** (menu déroulant fermé) : construit à son ouverture depuis `GET /api/v1/openapi.json` ; un groupe par module (et « Service »),
  un filtre texte, une ligne par opération ; chaque opération ouverte donne ses paramètres (ceux d'une lecture ou d'une modification préremplis
  d'une ligne réelle ; un filtre de liste se répète — une valeur par ligne, l'une OU l'autre — ou part vide, « colonne vide »), son corps d'exemple,
  `If-Match` (seulement quand l'opération le déclare) repris de l'ETag du dernier `GET` de la même adresse, la réponse (statut, durée, en-têtes
  utiles, corps) et la commande `curl` équivalente. Une écriture ne part qu'avec la case « Je sais que cette requête modifie la base du site de dev »
  cochée : elle modifie la base du site de dev comme le mode modification (et apparaît dans la note en préparation de « Mise à jour »).
  **Garde-fous** : un `DELETE` (ou une action) n'arrive jamais prérempli avec la clé d'une ligne réelle — seulement avec l'adresse (`Location`) d'un
  élément créé dans la page, tant que ses champs n'ont pas été saisis à la main ; une création qu'aucune suppression ne défait (races, classes,
  peuples) n'a pas de corps d'exemple ; une écriture sans retour le dit à côté de la case (`x-sans-retour` de la description). Les créations
  d'exemple qui restent réussissent telles quelles (`201`) et se suppriment (test `serveur-api-v1`).
- **Journaux du serveur** : le journal du service gardé en mémoire (`serveur/journal-du-service.mjs` : les 2 000 dernières entrées, niveau
  info / avertissement / erreur, catégorie `service`, `http`, `base`, `fiches`, `edition`, `mise-a-jour`, `maintenance`), relevé toutes les 2 s
  (`GET /api/debug/journal/?depuis=<n>`), filtré dans la page (niveaux, catégorie, texte), avec Pause (bouton bascule au libellé fixe,
  `aria-pressed`) et « Effacer l'affichage ». Les nouvelles lignes s'ajoutent en haut sans refaire le tableau : la ligne lue reste à sa place et une
  sélection en cours diffère l'affichage. Chaque réponse porte l'identité du processus (`processus`) : un redémarrage du service se voit même quand
  la page n'a rien relevé entre-temps (onglet caché, pause), et tout est relu depuis le début. Chaque requête `/api/` y est notée (catégorie `http` :
  méthode, adresse avec sa requête, statut, durée ; jamais les corps), sauf les relèves du journal et de l'état de maintenance (reconnues à leur
  chemin, jamais à leur chaîne de requête). En production, ni mémoire ni ligne par requête : la sortie du service (`docker logs`) ne garde que ses
  événements et les échecs du service (`5xx`).

En production (`SITE_MODE=prod`) l'entrée n'est pas au menu et la page ne dit qu'une phrase, sans script ; la version portable ne l'emporte pas.
La CI construit aussi le site de production et y relance `debug-page` et `site-html` (`ci.yml`, `CONTROLES_DE_LA_CI`).
La page lit d'abord `GET /api/etat/` : sans `edition: true`, le service n'est pas celui du site de dev et elle s'arrête.

Code : `src/pages/debug.astro`, `src/scripts/debug.mjs` (n'importe que `lib/debug-api.mjs` et `lib/debug-journaux.mjs`, purs), `styles/debug/` ;
menu : `lib/nav.mjs#entreesDuMenu` (`devSeulement`).

## Tests

`ressources-registre` (chaque table rangée une fois, registre cohérent, `RESSOURCES_MODULE=<module>` pour un seul module), `serveur-api-v1` (fermeture
en production, catalogue, description OpenAPI et ses exemples, listes, conditions, détail et ETag, sous-ressources, `405`, écritures par le journal,
`If-Match`, R42, images, `/api/debug/journal/`, serveur HTTP réel), `api-doc` (le tableau des ressources de ce document), `journal-du-service`,
`debug-page`, `nav` ; `serveur-livraison` liste les modules livrés.

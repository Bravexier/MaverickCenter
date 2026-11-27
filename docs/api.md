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
  `/api/personnages/`, dont le JSON d'une fiche, les choix de maîtrise d'armes `maitrise_choix`, les livres de sort `livres_sorts` (R169) et les règles de contrôle sont décrits dans
  [`serveur.md`](serveur.md), « L'API ») et celles du journal de l'édition (section 14). La section 15 (notes de version, historique des modifications) se lit seulement.
  Une image (portrait d'un monstre ou d'une espèce) n'est jamais rendue en entier : `{ image: true, empreinte, resume }`
  (`edition-modele.mjs#ligneSansImage`) ; l'image entière passe par `POST /api/edition/portrait/`.
- **Le site de dev est fermé** (décision R310, qui retire le mot de passe de R275 ; [`serveur.md`](serveur.md), « Accès au site de dev » et « Connexion par Discord »). Chaque route est classée :
  **toute lecture d'`/api/v1/`** (catalogue, description OpenAPI comprises) demande **une session Discord de niveau MJ au moins** (cookie `maverick_session`, posé par `GET /api/connexion/discord/`) **ou la clé de lecture**
  (en-tête `X-Maverick-Cle: mvk_…` ou `X-Maverick-Key: mvk_…`, jamais dans l'adresse), et **toute écriture** (`POST`, `PATCH`, `DELETE`) demande **une session de niveau Créateur**. La clé de lecture ne permet jamais
  d'écrire dans le contenu (une **clé de dépôt** facultative, `mvd_…`, mêmes en-têtes, lit comme elle et dépose un lot appliqué aussitôt, R291). Un refus est un `401` `{ erreur, acces: "connexion" }` sans session ni clé,
  un `403` `{ erreur, acces: "niveau", niveau, niveau_requis }` avec une session de niveau trop bas, un `403` `{ erreur, acces: "cle" }` avec une clé qui ne suffit pas.
- **Les comptes sont ceux de Discord** (R310) : une écriture n'a pas d'auteur dans le lot (`auteur_id` reste vide : ni la clé ni le cookie ne le posent aujourd'hui). Les écritures exigent
  `Content-Type: application/json` (`415` sinon, `DELETE` compris) et refusent une requête qu'un navigateur dit venir d'un autre site
  (`Sec-Fetch-Site`, `403`) ; corps de 1 Mio au plus (`413`).

Le registre des ressources est `client/src/lib/ressources.mjs` (son en-tête est le contrat du format) et ses modules `client/src/lib/ressources/<module>.mjs` ;
le routeur `client/serveur/ressources.mjs` ; la description OpenAPI `client/serveur/openapi.mjs`.

## Adresses

Toutes finissent par « / », comme celles du site (en développement, Astro refuse une adresse sans « / » finale avant de la transmettre au service).

| Méthode | Adresse | Rôle |
| --- | --- | --- |
| `GET` | `/api/v1/` | Le catalogue : les modules et, pour chaque ressource, ses capacités, ses colonnes (type, clé, obligatoire, `modifiable` d'après `TABLES`), ses champs de création (`ENTITES`, avec les valeurs des listes lues dans la base), ses sous-ressources, ses tables dérivées et son nombre de lignes |
| `GET` | `/api/v1/openapi.json` | La description OpenAPI 3.1 de tout le service : `/api/v1/` et les routes d'avant (`/api/etat/`, prétirés, classeur, Tipeee, édition, mise à jour et ses lots en conflit, journal), avec une ligne réelle en exemple par ressource |
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
| `GET` | `/api/debug/structure/` | Le dernier essai d'une livraison sur une copie de la base vivante, avant son installation, et le dernier essai dans l'ombre : `{ format, en_cours, en_attente, dernier, ombre }` (plus bas) |
| `GET` | `/api/debug/atelier/` | L'**atelier du site de dev** (`docs/serveur.md`, « Atelier du site de dev ») : `{ format: 'maverick-atelier-etat/1', etat, message, version_installee, kit, installe, extrait, en_cours, dernier, historique, bilan, resume }`, forme décrite dans `client/src/lib/debug-atelier.mjs` ; `bilan` : le bilan des dernières 24 h (`maverick-atelier-bilan/1`, `client/src/lib/atelier-bilan.mjs`). `etat` : `pas_d_atelier`, `non_installe`, `en_attente`, `en_cours` ou `rapport`. Les rapports que root écrit sont lus en lecture seule, bornés et validés. `Cache-Control: no-store` ; 503 sans atelier, 403 en production. |
| `GET` | `/api/edition/page-de-l-adresse/?adresse=<chemin>` | Site de dev, même classe que `/api/edition/pages/` (lecture : une session MJ au moins ou la clé de lecture) : `{ page }`, l'id de la page vivante à cette adresse (relative à la racine du site, sans `/` initiale, `races/elfe/`), sinon celle dont c'est une ancienne adresse (R316), sinon `null` (adresse inconnue, rubrique, absente ou mal formée : jamais une erreur). La page 404 du site de dev la demande avant la refabrication d'une page renommée, pour renvoyer à l'adresse où le site construit la sert encore |
| `GET` | `/api/edition/extrait/`, `/api/edition/extrait/meta/` | L'extrait du contenu du site (un fichier SQLite neuf : règles, notes de version, historique avec les modifications en attente ; ni fiche, ni compte, ni journal) et son méta (date, empreinte de chaque table) : `npm run db:extrait`, [`serveur.md`](serveur.md#extrait-du-contenu-et-attestation-de-la-production) |
| `GET`, `POST` | `/api/edition/lots/`, `/api/edition/lots/<id>/`, `…/<id>/essai/`, `…/<id>/appliquer/`, `…/<id>/refuser/`, `…/<id>/annuler/`, `GET …/<id>/annulation/`, `GET …/<id>/lignes/<n>/annulation/`, `POST …/<id>/lignes/<n>/annuler/`, `POST /api/edition/lots/recalcul/` | Les lots de changements (R274, R275, R291) : tant que la clé de dépôt n'est pas posée, une session dépose une proposition avec la clé de lecture (rien n'est écrit dans le contenu) qu'un Créateur applique, refuse ou annule (session Discord) ; **clé de dépôt posée** : la clé de dépôt (ou une session Créateur) dépose un lot appliqué aussitôt (`409` avec `motifs` si l'essai le refuse : le lot est « refuse », rien n'est écrit), la clé de lecture est refusée (`403`) ; un Créateur annule le lot ou **une seule ligne** (session Créateur) ; l’aperçu de l’annulation du lot se lit avec la clé ; « tout recalculer » dépose un lot de nature `code` ; [`serveur.md`](serveur.md), « Lots de changements (service) » |
| `POST` | `/api/metriques/page/` | La balise des pages vues (mesures du navigateur) : **les deux instances**, hors `/api/v1/` (plus bas) |
| `GET` | `/api/acces/` | L'accès au site de dev : où en est le visiteur (`protege`, `connecte`, `niveau`, `droit`, `expire_le`) ; ouverte ([`serveur.md`](serveur.md), « Accès au site de dev ») |
| `GET` | `/api/acces/verifier/` | `204` si la requête a au moins la lecture (clé de lecture ou session MJ au moins), `401` sans rien, `403` avec une session de niveau trop bas : pour le `forward_auth` de Caddy, qui ferme les pages du site de dev |
| `GET` | `/api/connexion/discord/` | Commence la connexion par Discord (R310) : `302` vers Discord (portées `identify` et `guilds.members.read` seulement), état aléatoire dans un cookie signé de 10 minutes ; `?retour=<chemin>` : où revenir (un chemin du site seulement, défaut `/profil/`). **Les deux instances**, ouverte |
| `GET` | `/api/connexion/discord/retour/` | Le retour de Discord : vérifie l'état, lit le profil et l'appartenance au serveur Discord, écrit la ligne de `utilisateur`, révoque le jeton Discord, pose le cookie de session `maverick_session` (`HttpOnly`, `SameSite=Lax`, `Path=/` ; 12 h sur le site de dev, 7 jours en production) et renvoie (`302`) vers `retour` ; échec : `302` vers `/connexion/?erreur=refus\|indisponible\|discord\|etat` ; compte bot ou système : `403` `{ erreur, acces: "bot" }`, rien d'écrit |
| `GET` | `/api/moi/` | `{ connexion_disponible, connecte, utilisateur: { nom, avatar_url, banniere_url, niveau, serveur_rejoint_le } \| null }` : le profil de la session (jamais l'identifiant Discord, l'e-mail ni un jeton) ; `connecte: false` aussi pour la session d'un non-membre (sans compte, R312), qui porte alors en plus **`non_membre: true`** (R313 ; champ absent dans les autres cas, aucun nom). **Les deux instances**, ouverte |
| `POST` | `/api/deconnexion/` | Retire le cookie de session (corps JSON `{}`, requête d'une page du site : mêmes refus que les écritures) → `{ connecte: false }`. Le jeton n'est pas révoqué : il expire seul |

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
`modifier` par table touchée, colonnes de `TABLES` seulement (une autre colonne : `400` qui donne la liste), plus les clés hors colonnes de la table
principale (`lib/edition-modele.mjs#CHAMPS_HORS_COLONNES`, décrites par le catalogue sous `hors_colonnes` et par OpenAPI : `magie` d'un don de classe,
ci-dessous) ; ce qui en dépend est recalculé par le service. Une extension absente n'est pas créée (`404`, rien n'est écrit). Réponse `200` : le détail relu, plus `lot` et `fiches`, `ETag`.

**Supprimer** (`DELETE /api/v1/<ressource>/<clé>/`, corps facultatif) : une opération `supprimer` de l'entité de la ressource → `{ supprime, adresse,
lot, fiches }`. Ce que d'autres règles citent est refusé (`409`, qui les nomme) ; un don, une spécialité, un métier ou une arme est retiré des fiches
qui l'ont, avec une note datée (R42, R52) ; un composant reste dans l'inventaire sous son nom (R60) ; `fiches` liste les fiches adaptées. Un mot-clé
mentionné se supprime en forçant, `?forcer=1` (ou `true` ; ou le corps `{ "forcer": true }` ; décision R223, plus bas) ; `forcer` ailleurs que sur
un mot-clé, ou avec une autre valeur : `400`.

**Concurrence** : `If-Match` est facultatif. Égal à la `version` lue (celle de toute la représentation), les valeurs lues partent en `avant` dans le
lot (le contrôle du mode modification) ; périmé, rien n'est écrit et la réponse `409` rend l'état actuel `{ erreur, element, extensions, version }`,
pour recommencer.

**Opérations du lot** : certaines tables, le site de dev ne les écrit ni par `TABLES` ni par `ENTITES` mais par une opération du lot
(`serveur/edition.mjs#OPERATIONS`) ; le registre les nomme (`operations` : `{ POST, PATCH, DELETE }` → l'opération ; `actions`) et
`serveur/ressources.mjs#TRADUCTIONS` traduit la requête en cette opération (mêmes refus, même journal) ; le catalogue en donne les champs.

| Adresse | Méthodes | Opération | Ce qu'elle fait |
| --- | --- | --- | --- |
| `relations-entre-peuples/` | Relations entre peuples | `relation_peuple` | créer, modifier, supprimer | — |
| `races/<race>/magies-innees-de-l-onglet/` | `POST`, `DELETE` | `magies_innees` | Ajoute une magie à la fin de la liste de l'onglet (`magie_id`), l'en retire — seulement pour une race dont l'onglet limite ses magies (R11 ; sinon `409`) ; la dernière ne se retire pas (`400` : une race a au moins une magie innée possible, R210) |
| `races/<race>/acces-aux-magies/<magie>/` | `PATCH` | `magies_innees` | Rend une magie accessible ou non en magie innée (`accessible` : 1 ou 0) dans la matrice de la fiche (R8), pour une race dont l'onglet ne limite pas ses magies (sinon `409`) : c'est ainsi qu'une race créée reçoit ses magies ; la dernière case accessible ne se ferme pas (`400`, R210) |
| `evenements/<événement>/categories/` | `POST`, `DELETE` | `categories` | Pose une catégorie sur l'événement (`categorie_id`), l'en retire |
| `monstres/<carte>/valeurs-de-capacites/` | `POST`, `PATCH`, `DELETE` | `valeurs_de_capacite` | Pose une valeur propre (`rang`, `numero`, `valeur`), la change, l'efface (R69) ; la valeur commune (ou `null`) n'est jamais écrite : elle efface la valeur propre (`element: null` dans la réponse) |
| `onglets-des-regles/<onglet>/ordre/` | `POST` | `ordonner` | L'ordre du menu latéral de l'onglet, d'un bloc : `ids`, tous les identifiants de ses entrées dans le nouvel ordre (`409` si la liste n'est pas exactement celle du menu) ; les rangs qu'occupait le menu sont redonnés, seules les entrées qui changent de place sont écrites |
| `mots-cles/<mot-clé>/fusion/` | `POST` | `fusionner_mots_cles` | Verse les pages du mot-clé dans `dans` (l'id entier d'un autre), y recible ses balises (« {{cle}} » des textes), puis le retire du vocabulaire (`409` tant que la définition d'un mot-clé verrouillé le cite : R222) ; les clés sont recalculées (un homonyme disparu) ; `dans` reçoit ses synonymes (sauf ceux que R233 (4) refuse ; un mot-clé qui a des synonymes ne se fusionne pas dans un `dans` verrouillé : `409`, `champ: "synonymes"`) et sa clé et ses clés quittées deviennent des clés quittées de `dans` (R233 (11)) |

Les références « @i » d'un lot à plusieurs opérations (créer une spécialité puis son don dans la même requête) restent sur `POST /api/edition/`.

`lot` est l'identifiant du lot du journal (`null` si rien n'a changé : une valeur identique n'écrit rien). Chaque écriture réussie est notée au
journal du service : `api v1 : PATCH /api/v1/metiers/metiers%2Facrobate/ → lot <id> (N ligne(s))` (catégorie `edition`), avec le nombre de fiches
adaptées, jamais leurs noms ; le lot porte la page `api/v1/<ressource>[/<sous-ressource>]`.

## Codes de réponse

| Code | Quand |
| --- | --- |
| `200` `201` | Lu, modifié, supprimé ; créé (`Location`) |
| `304` | `If-None-Match` égal à la version (détail) |
| `400` | Corps illisible ou qui n'est pas un objet JSON, rien à modifier, colonne ou paramètre inconnu, valeur refusée par le service d'édition (type, bornes, champ obligatoire, balise du glossaire qui ne cite aucun mot-clé : `refs`, ou un libellé de plusieurs homonymes : `refs`, `homonymes` ; synonyme d'un mot-clé mal écrit : `champ: "synonymes"`, lien ou couleur d'un mot-clé refusés : `champ: "url"`, `champ: "couleur"`, lien saisi qu'aucun mot-clé ne porte : `champ`, `liens`), `limite` hors bornes, `forcer` mal écrit ou hors d'un mot-clé (R223) |
| `401` | Site de dev, ni session Discord ni clé : `{ erreur, acces: "connexion" \| "cle_de_depot" }` (`"cle_de_depot"` : un dépôt de lot, la clé de dépôt posée). `403` `{ erreur, acces: "niveau", niveau, niveau_requis }` : une session de niveau trop bas ; `403` `{ erreur, acces: "cle" }` : une clé qui ne suffit pas ; `403` `{ erreur, acces: "cle_de_depot" }` : la clé de lecture ne dépose plus une fois la clé de dépôt posée |
| `403` | Hors du site de dev (tout `/api/v1/`) ; écriture qui vient d'un autre site (`Sec-Fetch-Site`) |
| `404` | Ressource, sous-ressource ou ligne inconnue (ou hors de la ressource) ; extension absente au `PATCH` |
| `405` | Méthode que la ressource n'a pas : `Allow` donne la liste exacte, le corps la raison (lecture seule ; ni le service d'édition ni une opération du lot ne le font, et par quelles méthodes la ressource s'écrit) et les `capacites` |
| `409` | `If-Match` périmé ; refus du service d'édition (élément cité par d'autres règles, mot-clé protégé, dernier bloc d'un événement, maîtrise d'arme illisible dans une classe ou un don, don à plus d'une part de maîtrise à choisir, nom de famille d'armes déjà pris ou qui changerait une maîtrise existante, avec la liste dans `sources` : décision R159 ; synonyme d'un mot-clé qui est le libellé, un synonyme ou la clé d'un autre, ou mot-clé créé ou renommé vers le synonyme d'un autre : `champ: "synonymes"` ou `"libelle"`, `mot_cle` : l'autre ; homonyme sans catégorie distinctive ou clé déjà prise (R232) : `champ: "categories"` ou `"libelle"`, `mots_cles` ; catégorie de mots-clés non vide : `mots_cles` ; mot-clé mentionné : `mentions`, `refus_du_forcage` ; suppression forcée refusée : `mots_cles_verrouilles`, `url` ou `mentions_bloquantes`…) |
| `413` | Corps de plus de 1 Mio |
| `415` | Écriture sans `Content-Type: application/json` |
| `422` | Refusé par la base (contrainte CHECK, UNIQUE, NOT NULL, clé étrangère) ou valeur que les importeurs ne sauraient pas relire ; une gemme ou un bois du Potentiel Illimité (`POST /api/v1/gemmes/`, `POST /api/v1/bois/`) : « Le Potentiel Illimité n’a ni gemme, ni bois, ni bâton magique, ni pièce élémentaire (décision R160). » |
| `503` | Base vivante indisponible (`/api/etat/` dit pourquoi) ; ou **écritures gelées** (`db/gel.json`, posé par root : `{ erreur, gel: { pose_le, jusqu_a, motif, geste, illisible, plafonne } }`, `Retry-After`) : toute écriture de `/api/` est refusée jusqu'à l'échéance, les lectures restent ouvertes, `gel` de `GET /api/etat/` dit la même chose (`docs/serveur.md`, « Bascule 2 : préparation ») |

Une erreur est toujours `{ "erreur": "<message en français>", … }`, avec les détails utiles (`methodes`, `element`, `version`…).

## Exemples (`curl`)

Sur le site de dev, ajouter `-u <utilisateur>:<mot de passe>` (le mot de passe interne de nginx, que Caddy présente aux visiteurs) ; le site de dev est fermé (R310) : les lectures ajoutent
`-H "X-Maverick-Cle: $CLE"` (la clé de lecture ; `X-Maverick-Key` vaut aussi) ou le cookie d'une session Discord de niveau MJ au moins, et les écritures passent par le cookie d'une session de niveau Créateur (`-b "maverick_session=…"`, copié d'un navigateur connecté) ; en développement, le service seul répond sur
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
| `classes/` | Classes | `classe` | créer, modifier | `tableau-annexe`, `entrees-du-tableau` |
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
| `postures/` | Postures | `posture` | lecture seule | `effets`, `competences-du-critique` |
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
| `specialisations-de-magie/` | Spécialisations magiques | `magie_specialisation` | modifier | — |
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
| `familles-d-armes/` | Familles d’armes | `arme_famille` | créer, modifier | — |
| `types-d-armes/` | Types d’armes | `arme_type` | lecture seule | — |
| `armes-elementaires/` | Armes élémentaires | `arme_elementaire` | lecture seule | — |
| `types-d-armes-elementaires/` | Types d’armes élémentaires | `arme_elementaire_type` | lecture seule | `competences`, `types-de-degats` |
| `emplacements-d-armure/` | Emplacements d’armure | `armure_emplacement` | modifier | — |
| `armures/` | Armures | `armure` | modifier | — |
| `armures-elementaires/` | Armures élémentaires | `armure_elementaire` | lecture seule | — |
| `classes-de-bouclier/` | Classes de bouclier | `bouclier_classe` | modifier | — |
| `poids-de-bouclier/` | Poids de bouclier | `bouclier_poids` | modifier | — |
| `boucliers/` | Boucliers | `bouclier` | modifier | — |
| `ameliorations-d-arme/` | Améliorations d’arme | `amelioration_equipement` (partie) | modifier | — |
| `ameliorations-d-armure/` | Améliorations d’armure | `amelioration_equipement` (partie) | modifier | — |
| `ameliorations-de-bouclier/` | Améliorations de bouclier | `amelioration_equipement` (partie) | modifier | — |
| `autres-ameliorations/` | Améliorations d’armure élémentaire | `amelioration_equipement` (partie) | lecture seule | — |
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
| `pages-du-guide/` | Pages du guide | `page` (partie) | créer, modifier, supprimer | — |
| `pages-du-codex/` | Pages du Codex | `page` (partie) | modifier | — |
| `pages/` | Pages du wiki | `page` (partie) | lecture seule | — |
| `annonces/` | Annonces | `annonce` | modifier | — |
| `onglets-des-regles/` | Onglets des Règles | `regles_onglet` | lecture seule | `entrees` |
| `alias-des-pages/` | Alias des pages | `alias` | lecture seule | — |
| `mots-cles/` | Mots-clés | `mot_cle` | créer, modifier, supprimer | `pages`, `categories` (créer, supprimer), `synonymes` (créer, supprimer), `anciennes-cles` |
| `categories-de-mots-cles/` | Catégories de mots-clés | `categorie_mot_cle` | créer, modifier, supprimer | — |
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

`onglets-des-regles/` est le plan de la rubrique Règles (migration 0091, décisions R184 et R185) : les quatre onglets qui suivent Découvrir et
L'univers, chacun avec sa page d'ouverture, et leur menu latéral en sous-ressource `entrees` (une page du guide, un lien comme « Artisanat », ou une
entrée « bientôt »), dans l'ordre de `rang`. Les onglets sont fixes (ordre, titre, page d'ouverture : réponse du propriétaire « Non, fixe ») ;
leur menu se modifie sur le site de dev (lot de l'édition des menus, `serveur/edition-plan.mjs`), mais la sous-ressource `entrees` reste en lecture
seule ici (choix du leader-technique ; `lib/ressources.mjs#TABLES_SANS_ECRITURE_DIRECTE`, bien que `regles_onglet_entree` soit dans `TABLES`) :
l'ordre d'un menu passe par l'action `ordre` de l'onglet, et une entrée naît et part avec sa page des Règles, créée (`POST pages-du-guide/` :
`titre`, `onglet_id`, `resume`, et `bientot` pour remplir une entrée « bientôt ») ou supprimée (`DELETE pages-du-guide/<page>/` : `409` pour une
page protégée, avec `raisons`, ou citée, avec `citations` ; `400` pour une page de Découvrir ou du Guide du MJ). Le site lit le plan au build par
`client/src/lib/plan-des-regles-db.mjs`. Le résumé d'une page du guide (`resume`) se modifie par `PATCH pages-du-guide/<page>/`.

`mots-cles/` (migrations 0113 à 0115, décisions R232 et R233) : l'identifiant est un entier (`/api/v1/mots-cles/163/`), attribué à la création
(le suivant, jamais réutilisé) ; la clé (`cle`, en lecture seule) est calculée : le slug du libellé, suivi pour un homonyme des slugs de ses
catégories qui ne sont pas communes à tous ses homonymes ; elle est recalculée à chaque renommage, changement de catégorie, homonyme qui apparaît ou
disparaît et catégorie renommée, et chaque balise qui la cite est alors réécrite (`anciennes-cles` : les clés quittées, qui mènent encore au
mot-clé). Le libellé n'est plus unique. `synonymes` remplace l'abréviation : la sous-ressource `synonymes/` les liste dans l'ordre, `POST`
(`libelle`) en ajoute un à la fin, `DELETE` en retire un (opération `synonymes_mot_cle` ; `409` sur un mot-clé verrouillé, R233 (6)) ; un synonyme
qui s'écrit comme le libellé, un synonyme ou la clé d'un autre mot-clé est refusé en `409`, comme son propre libellé ou une écriture qui couperait
une balise en `400` (`champ: "synonymes"`). La sous-ressource `categories/` pose (`POST`, `categorie_id`) ou retire (`DELETE`) une catégorie
(opération `categories_mot_cle`, permise sur un mot-clé verrouillé, R232 (11)). La création (`POST mots-cles/`) accepte `categories` (identifiants)
et `synonymes` (écritures). Refusés en `409` : un homonyme sans catégorie qui le distingue de chacun des autres (`champ: "categories"`), une clé
déjà prise ou un libellé qui s'écrit comme le synonyme d'un autre mot-clé (`champ: "libelle"`). `categories-de-mots-cles/` : une catégorie se crée,
se renomme (`PATCH`, `libelle` unique, sinon `409`) et ne se supprime que vide (`409` avec `mots_cles` sinon). La ref d'une balise du glossaire peut
être la clé, le libellé que porte un seul mot-clé, ou un synonyme, quelle que soit la casse (un libellé de plusieurs homonymes : `400`, `refs` et
`homonymes`) ; elle s'enregistre par la clé, le texte tapé gardé tel quel (« {{ic}} » → « {{instant-cast|ic}} », R233 (10) :
[`content-guide.md`](content-guide.md), « Mots-clés (glossaire) »). `mots-cles/` liste aussi le lien et la couleur (`url`, `couleur`, migration 0098 ; `?q=`
cherche dans le lien), qui se donnent à la création et se modifient par `PATCH` (sauf ceux d'un mot-clé verrouillé, plus bas) : le lien, une adresse
interne relative à la racine du site, sans le préfixe de déploiement, dont le chemin mène à une page du site (`/races/drakos/`,
`/metiers/#metier-mineur` ; l'ancre et la requête ne sont pas vérifiées) ; la couleur, `#rrggbb` ou `<famille>:<id>` d'une couleur de la palette
(`classe:melee`) ; refusés en `400` avec `champ: "url"` ou `champ: "couleur"`. L'icône (`icone`, migration 0116, décision R235) se lit, se donne à
la création et se modifie de même : `null`, ou `<famille>:<id>` d'une icône de la liste du site (`lib/icones.mjs#ICONES` : les trois monnaies
(`monnaie:rf`, `monnaie:ro`, `monnaie:pp`), les types de dégâts (`degats:taille`, `degats:estoc`, `degats:frappe`) et les magies (`magie:feu`…) ; le catalogue en donne les `valeurs`, la liste `icones` de `GET /api/edition/listes/`), sinon `400` avec
`champ: "icone"`. Un lien `[[…]]` ou `[texte](/…)` saisi dans un texte devient la balise
du seul mot-clé qui mène à sa page (sinon `400` avec `champ` et `liens`, [`serveur.md`](serveur.md), « Édition des règles »). Le verrou d'un mot-clé
(`verrou`, migration 0110, décisions R218 et R219) se lit dans la liste, le détail et le catalogue (colonne non modifiable) ; aucune route ne l'écrit
(`400` dans un `POST` ou un `PATCH`). Un mot-clé verrouillé (`1` : ceux qui mènent à une page, ceux des monnaies, ceux dont le site se sert) ne se
modifie pas par `PATCH`, quel que soit le champ, ne se supprime pas par `DELETE`, même sans mention, et ne se fusionne pas dans un autre (action
`fusion`) : `409`, avec une raison qui cite R218 et R219 ; un autre mot-clé se fusionne dans lui (il garde son lien, sa couleur et son icône ; refusé en `409`, `champ: "synonymes"`, si cet autre a des synonymes), sauf quand la
définition d'un mot-clé verrouillé (la sienne comprise) cite cet autre par une balise : la fusion est alors refusée en `409`, avant toute écriture,
avec `mots_cles_verrouilles` (décision R222 ; le rejeu, lui, la fait). Une page vers laquelle mène un mot-clé verrouillé (un métier par son ancre, la
fiche d'un don, une page des Règles) ne se supprime pas : `DELETE` rend `409` avec `mots_cles_verrouilles` (décision R221). Un mot-clé créé vaut `0`,
même avec un lien. Un mot-clé non verrouillé se modifie entièrement (décision R195) ; il ne se supprime pas tant qu'une page ou un texte le mentionne
(R196 : `409` avec `mentions`, la liste des endroits, et `refus_du_forcage`, `null` si la suppression forcée passerait, sinon sa raison), ni ne se
fusionne s'il étiquette un sort (`409`) ; s'il est le mot-clé d'un type de dégâts ou d'une magie (migration `0125`), il ne se supprime pas, même forcé (`409` avec `references`, comptées parmi les `mentions` avec `comment: "reference"`), et sa fusion reporte la référence sur la cible. **La suppression forcée** (`DELETE /api/v1/mots-cles/<id>/?forcer=1`, décision R223) ne lève que le refus des
mentions : dans le même lot, chaque balise qui le cite (toute forme, ref par id, écriture ou abréviation, pages d'exemple comprises) devient son
texte affiché en texte simple, sans lien (le libellé pour `{{id}}` et `{{id:}}`, le texte écrit pour `{{id|texte}}`), chaque étiquette de page est retirée, puis le mot-clé est supprimé ; le résumé du lot compte les mentions
remplacées. Elle reste refusée en `409`, avant toute écriture, pour un mot-clé verrouillé, qui étiquette un sort, cité par la définition d'un mot-clé
verrouillé (`mots_cles_verrouilles`), dont le lien mène sans ancre à une page de la base (`url`, `page` ; décision R223 (7), ce cas attend une décision du
propriétaire ; une ancre, une route sans page comme `/fiche/` ou une rubrique comme `/races/` sont épargnées), ou mentionné là où le site ne sait pas remplacer la balise (`mentions_bloquantes`, aussi quand une mention reste après le remplacement :
le lot est alors annulé). Sans mention, forcer n'écrit rien de plus (la suppression est marquée forcée au résumé du lot, pour le rejeu). Détail : [`serveur.md`](serveur.md), « Édition des règles », ligne « Mots-clés ».

Les monnaies (`/api/v1/monnaies/`) sont en lecture seule de fait : l'onglet Monnaie est figé (décision R219), `POST`, `PATCH` (toute colonne) et
`DELETE` rendent `409` avec la raison ; le catalogue le dit (`figee`), et la description OpenAPI ne leur donne ni corps de création ni clé de
modification d'exemple.

Les tables qui ne sont pas des éléments (tables de détail refaites par le service, vues de recherche, fiches de personnages, journal) sont rangées
dans `HORS_RESSOURCE` de leur module, avec la raison : `test/ressources-registre.test.mjs` exige que chaque table de `data/schema.sql` soit rangée une
fois et une seule (ressource, sous-ressource, extension, dérivée ou hors ressource). Ainsi `maitrise_arme_part` et `maitrise_arme_part_famille` (ce que
donne chaque source de points de maîtrise d'armes, migration 0076) : une source est une ligne de maîtrise d'une classe ou un don, deux parents qu'une
dérivée ne sait pas porter ; `capacite_nm_gagne` (les NM de sorts gagnés d'un don, R154) est une dérivée de `dons-de-classe/`. Toutes trois sont
refaites par le service d'édition quand une écriture change une ligne de maîtrise d'une classe ou l'effet d'un don (`serveur/edition-maitrises.mjs`),
jamais écrites directement. `capacite_variable` (la magie que vise un don « Variable » du Mage Bleu, décision R181, migration 0088) est aussi une dérivée de
`dons-de-classe/` : écrite par la migration, et à la création d'un don de type « Variable » d'après son champ `magie` (`innee` ou `acquise`, « Magie
innée » / « Magie acquise » ; exigé pour ce type, refusé `400` pour un autre ; `don_magie` pour le don d'une spécialité créée : réponse du propriétaire
« Demander la magie »), et quand un `PATCH` change le type (réponse du propriétaire « Demander ou retirer », R192) : passer à « Variable » exige la clé
`magie` dans le même corps (`400` qui cite R181 sans elle, rien d'écrit), quitter « Variable » supprime la ligne (une `magie` envoyée alors : `400`) ;
sur un don déjà « Variable », `magie` seule change la magie visée. Écrites par la migration seulement (migration 0097) : `capacite_npm_plafond` (le plafond
de NPM des sorts que relève un don, R188) et `capacite_condition_emplacements` (les dons qui comptent comme une condition d'emplacements de sorts, R189),
dérivées de `dons-de-classe/`, et `magie_npm_plafond` (le plafond de NPM des sorts d'une magie innée, R188), dérivée de `magies/`. Un don supprimé emporte
ces trois lignes, notées au journal avant lui (réponse du propriétaire : « Autoriser et journaliser »). Les entrées du tableau du Mage Bleu (`classe_annexe_entree`) sont la sous-ressource `entrees-du-tableau` de `classes/`, en
lecture seule ; les dons obtenus d'une fiche (`personnage_don_obtenu`) et la spécialisation magique choisie par magie (`personnage_specialisation_magie`, R236) sont des parties de la fiche, hors ressource.

Chaque opération du lot du service est joignable par une ressource (`test/ressources-registre.test.mjs` lit `OPERATIONS` dans
`serveur/edition.mjs`) ; seuls les lots à plusieurs opérations atomiques (références « @i » : créer une spécialité puis son don dans la même
requête) restent sur `POST /api/edition/` : [`serveur.md`](serveur.md), « Édition ».

Une table partagée par condition peut avoir la même dérivée dans chacune de ses ressources (`amelioration_total`, la ligne TOTAL de chaque cible
d'amélioration, dans `ameliorations-d-arme`, `ameliorations-d-armure`, `ameliorations-de-bouclier` et `autres-ameliorations`) ; le test du registre exige que chaque ligne d'un enfant, d'une dérivée ou
d'une extension ait son parent dans une ressource, condition comprise. Une dérivée peut avoir sa propre `condition` (même forme que celle d'une
ressource) et un `parent` vide : elle montre alors à chaque élément les lignes qui la satisfont. C'est le cas des deux lignes TOTAL du tableau des
améliorations d'arme, un seul tableau pour l'arme du catalogue et l'arme élémentaire depuis la décision R167 (migration 0081) : le coût matériel
(`cible` « arme ») et le coût élémentaire (« arme_elementaire », dont la cible n'a plus de ligne d'amélioration), dans le détail de chaque
amélioration d'arme ; `autres-ameliorations/` n'a plus que les améliorations d'armure élémentaire.

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
   Puis le bloc **Sauvegardes** (`sauvegardes` de la même réponse, `null` sans fichier d'état : une ligne sobre « Pas de sauvegarde automatique sur
   cette machine ») : par instance (production, site de dev) l'âge et le type de la dernière copie, l'état, l'alerte en cours, la dernière vérification ;
   la place prise et sa part du plafond ; la copie extérieure (activée ou non, dernier envoi, contrôle du dépôt, dernier essai de restauration). Sont
   mis en évidence (classe d'alerte) une copie de plus de 26 h, un envoi actif de plus de 36 h et tout échec ; les alertes du service sont déjà dans celles du système.
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
   étrangère** (415 ; une clé à plusieurs colonnes reste un lien), de la ligne de la colonne à la colonne visée, flèche à l'arrivée ; une clé à
   plusieurs colonnes part de la colonne qui la distingue et arrive à la colonne visée au même rang (`indiceDuLien` :
   `race_don_tableau_cellule(race_id, ligne)` part de `ligne`, l'auto-référence de `note_cellule` de `repond_a` vers `rang` ; celle de `modification_lot`, migration 0072, de `resolu_par` vers `id`, en boucle comme elle), et l'infobulle d'une
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
   **Structure de la base** (bloc en tête du menu DB, lot 7, R274 : « le rapport s'affiche sur la page Debug » ; pas un cinquième menu) : les deux
   essais de structure du service, lus par **un seul** `GET /api/debug/structure/` à la première ouverture du menu, puis à chaque clic sur
   « Actualiser » (jamais relevés : la route n'est pas dans `RELEVES_GET`). *Essai avant installation* : verdict (`accepte`, `a_jour`, `refuse`,
   `indisponible` ; les deux derniers en alerte), version, date, migrations essayées, raison d'un refus, essai en cours ou en attente, et un
   tableau **replié** des tables qui changent (lignes ajoutées, retirées, modifiées) avec le nombre de tables inchangées. *Essai dans l'ombre* :
   verdict en toutes lettres (`identique` ok ; `attendu` normal, avec une phrase : le contenu arrive encore par le dépôt jusqu'au lot 8 ; `ecart`,
   `refuse`, `indisponible` en alerte « À examiner »), versions du site et de la base, migrations, chiffres par catégorie, tableau des tables qui
   diffèrent (catégorie, gravité, lignes, raison). *Base source* (lot 8, en tête du bloc, d'après `base_source: { source, sur_place }` de la même route) :
   « Base source : oui » ou « non » et, si le service en donne une, la dernière application des migrations sur place (date, versions de la base,
   migrations, sauvegarde) ; un service d'avant, sans `base_source`, n'a pas cette partie. `403` (pas le site de dev), `503`, `ombre: null` : un message neutre. Rendu pur :
   `lib/debug-structure.mjs` ; script : `scripts/debug-structure.mjs` (n'importe que ce module, qu'aucun autre script n'importe) ; test :
   `debug-structure.test.mjs`.
   **Fabrication témoin** (bloc suivant, même menu DB, lot 9, un seul `GET /api/debug/atelier/` à l'ouverture puis à « Actualiser », jamais relevé) :
   la sévérité (`neutre`, `ok`, `attention`, `alerte`) et le message du service s'affichent toujours (« pas d'atelier », « non installé », « en
   attente » sont des états normaux ; un refus faute de mémoire ou de disque est une mesure, dite avec ses chiffres), puis les lignes qui aident à choisir
   le prochain serveur (mémoire totale et disponible, plafond appliqué, pic mesuré, processeurs et temps processeur, durée, disque libre, place occupée,
   écarts avec le site livré) et un historique court des dernières fabrications (origine hors livraison dite ; sonde de la production avant et pendant, avec
   mention quand elle n'a mesuré que nginx). **En tête** (lot 9, PR 4) : le bilan des dernières 24 h (`etat.bilan`) : verdict en toutes lettres (le serveur tient /
   tient tout juste / ne tient pas ; « journée incomplète » est neutre et dit combien de fabrications ont eu lieu), phrase, raisons, lignes (serveur, pic de mémoire, durée,
   processeur, disque, effet sur la production) et, repliés, les seuils du verdict, dits choix techniques réglables (`lib/atelier-bilan.mjs`). `403`, `503` et l'erreur réseau : un message neutre. Mise en forme :
   `lib/debug-atelier.mjs` (partagé avec le service) ; rendu pur : `lib/debug-atelier-page.mjs` ; script : `scripts/debug-atelier.mjs` (n'importe que ces
   deux modules, qu'aucun autre script n'importe) ; test : `debug-atelier-page.test.mjs`.

En production (`SITE_MODE=prod`) l'entrée n'est pas au menu et la page ne dit qu'une phrase, sans script ; la version portable ne l'emporte pas.
La CI construit aussi le site de production et y relance `debug-page` et `site-html` (`ci.yml`, `CONTROLES_DE_LA_CI`).
La page lit d'abord `GET /api/etat/` : sans `edition: true`, le service n'est pas celui du site de dev et elle s'arrête.

Code : `src/pages/debug.astro`, `src/scripts/debug.mjs` (Système, Performances, Journaux ; n'importe que `lib/debug-journaux.mjs` et
`lib/debug-metriques.mjs`, purs), `styles/debug/` ; DB : `components/debug/SchemaDeLaBase.astro`, son script `src/scripts/debug-schema.mjs` (n'importe
que `lib/debug-schema.mjs`, pur : mise en page, liens, caméra, recherche, rendus échappés ; aucun module commun avec `debug.mjs`),
`lib/schema-structure.mjs` (au build), `styles/debug/schema.css` ; menu : `lib/nav.mjs#entreesDuMenu` (`devSeulement`) ; service :
`serveur/metriques.mjs` (collecte, base des métriques, lectures), `serveur/metriques-sql.mjs` (requêtes SQL comptées pendant une requête HTTP) et
`serveur/debug-tables.mjs` (contenu des tables, version de la base).

### « Le bouton » de l'atelier (`POST /api/edition/atelier/`)

Site de dev seulement (403 en production), sans corps, **classe d'accès `ecriture`** : une session Créateur (`serveur/acces-routes.mjs`). Il fait refaire **tout de suite** l'extrait du contenu de l'atelier, sans attendre les 10 minutes de calme qui suivent les saisies (`serveur/atelier.mjs#refaireMaintenant`). C'est tout ce que fait le service : il ne commande aucun programme de root (garde-fou 20). Root le voit à sa ronde (le minuteur `maverick-atelier-contenu.timer`, toutes les 10 minutes, compare le `stat` de l'extrait à celui du dernier site posé) et, **si l'interrupteur `atelier/servir` est posé**, fabrique et pose le site (`docs/serveur.md`, « Bascule 2 : préparation », PR 3b). Aucune page ne l'appelle encore.
- `200` `{ format: 'maverick-atelier-refaire/1', etat: 'fabrique' | 'a_jour', message, version, fabrique_le }` : `fabrique` (l'extrait vient d'être refait), `a_jour` (l'extrait suit déjà le contenu : rien à refaire) ;
- `409` `{ …, etat: 'occupe' }` (une fabrication de l'extrait est déjà en cours : réessayer) ou `etat: 'inactif'` (atelier non installé, base ou version pas prête) ;
- `500` `{ erreur }` : l'extrait n'a pas pu être refait (le journal du service dit pourquoi) ; `503` : pas d'atelier sur ce service ; `405` hors `POST` ; `404` pour une adresse plus longue.

Le rapport de l'atelier (`GET /api/debug/atelier/`) porte en plus : `servir` (`{ depuis, pages_minimum_pct }` ou `null` : l'interrupteur), `dernier.servi` (`{ pose, motif, code_sortie, version_installee, version_de_l_instance, pages_minimum_pct, resume }` ou `null` : le site fabriqué a-t-il été posé), l'origine `contenu` d'une fabrication, `historique[].servi` (`true`, `false` ou `null`) et `bilan.depuis` (le bilan ne compte que les rapports qui suivent le dernier geste du propriétaire).

### Contenu des tables

Site de dev seulement : ailleurs, `403` avant tout le reste — **seule la base du serveur de production reste fermée** (décision du propriétaire du
2026-10-15 : en production, la base ne s'ouvre que par les pages du site). Sur le site de dev, **tout se lit**, fiches comprises : décision du
propriétaire du 2026-10-15, « Il faut tout rendre ouvert. Ce qui est fermé c'est que la base du serveur de prod. » Lecture seule : toute autre
méthode que `GET` répond `405` (`Allow: GET`). Code : `serveur/debug-tables.mjs`.

**Le serveur de dev reste ouvert** (réponse du propriétaire du 2026-10-15 : « Le serveur dev restera. Il servira toujours pour modifier les
règles par ceux qui en auront l'accès. ») ; qui y a accès se réglera avec la connexion Discord (E7). Sa base vivante est la **sienne, que
l'installateur ne remplace jamais** (R274 ; [`deploy/installateur/README.md`](../deploy/installateur/README.md)) ; à l'origine, la copie de celle de
production que l'installateur de test pose sur demande (`--copier-base-prod`) : ce qu'on y lit des fiches, des comptes et des groupes est ce
qu'elle contient, sans les règles de visibilité de `/api/personnages/` (`v_personnage_visible`).
Une fiche créée ou supprimée sur le site de dev ne part jamais en production (un lot ne porte pas la section 13). Le propriétaire attend une copie
de la production vers le dev après chaque mise en production, que le serveur de test ne fait pas encore (question 7 de
[`feuille-de-route.md`](feuille-de-route.md), « Questions encore ouvertes »).

| Requête | Réponse |
| --- | --- |
| `GET /api/debug/tables/` | `{ tables: [{ nom, genre, lignes }] }` : chaque table et vue de la **base vivante**, dans l'ordre des noms, ses lignes comptées maintenant ; `genre` = `table`, `derivee` (`-- @derivee` de `data/schema.sql`, hors FTS5) ou `vue` ; ni les tables internes de SQLite (`sqlite_…`), ni les tables FTS5 (virtuelles et leurs tables de *shadow*) |
| `GET /api/debug/tables/<nom>/?limite=1..500&decalage=&tri=<colonne>&ordre=asc\|desc` | `{ table, genre, colonnes: [{ nom, type, pk }], total, limite, decalage, tri, ordre, lignes: [{ <colonne>: valeur }] }` (100 lignes par défaut ; `tri` : `null` sans tri demandé) pour **toute** table ou vue de la liste, celles de la section 13 comprises (fiches de personnages, comptes, groupes, et les vues qui les lisent : `v_personnage_visible`, `v_personnage_controle`…) ; `ETag: "<16 hex>"` (sha256 du JSON du corps) et `Cache-Control: no-cache` ; `304` sans corps (avec l'`ETag`) si `If-None-Match` la contient (liste séparée par des virgules, `W/` toléré) ; `404` pour un nom qui n'est pas **exactement** celui d'une table ou d'une vue de la liste (interne, FTS5, casse, guillemets, « / » encodé…), `400` pour un tri qui n'est pas une colonne, un ordre inconnu, une limite hors de 1..500 ou un décalage qui n'est pas un entier positif (ni l'un ni l'autre n'a d'`ETag`) |
| `GET /api/debug/base/` | `{ version }` : la **version de la base vivante**, un texte opaque qui change dès qu'une écriture est validée, quelle que soit la table ; `Cache-Control: no-store` ; `405` (`Allow: GET`) pour une autre méthode, `503` sans base, `404` pour `/api/debug/base/<autre>/` |
| `GET /api/debug/structure/` | `{ format: 'maverick-essai-etat/1', en_cours, en_attente, dernier, ombre }` : l'**essai d'une livraison avant son installation** (`docs/serveur.md`, « Essai avant installation »). `en_cours` : `{ demande, version, depuis }` ou `null` ; `en_attente` : le nombre de demandes en file ; `dernier` : le bilan `maverick-structure/1` du dernier essai (`verdict` : `accepte`, `refuse`, `a_jour` ou `indisponible` ; `versions`, `migrations`, `tables`, `objets`, `totaux`, `refus` { migration, etape, raison, details }, `duree_ms`) plus `demande` { nom, version, deposee_le }, `essaye_le`, `instance` et `resume` (une phrase), ou `null` quand aucun essai n'a eu lieu ; `ombre` : l'**essai dans l'ombre** (`docs/serveur.md`, « Essai dans l'ombre ») `{ en_cours: { version, depuis, etat } | null, dernier }`, où `dernier` est le rapport `maverick-ombre/1` du dernier essai à une installation (`verdict` : `identique`, `attendu`, `ecart`, `refuse` ou `indisponible` ; `resume`, `version`, `versions`, `migrations`, `regles_d_avant`, `structure` { identique, ecarts }, `tables` : les tables qui diffèrent, chacune avec `categorie` (`structure`, `propre_au_site`, `inattendu`, `livre_par_le_depot`, `inconnu`, `calculee`, `ignoree`), `gravite` (`grave`, `attendu`, `ignore`), `ajoutees`, `retirees`, `modifiees` et `raison`, `chiffres`, `duree_ms`), ou `null` quand aucune installation n'a eu lieu ; `Cache-Control: no-store` ; `405` pour une autre méthode, `503` sans le suivi, `404` pour `/api/debug/structure/<autre>/` |
| `GET /api/debug/atelier/` | `{ format: 'maverick-atelier-etat/1', etat, message, version_installee, kit, installe, extrait, en_cours, dernier, historique, resume }` : l'**atelier du site de dev** (`docs/serveur.md`, « Atelier du site de dev »). `dernier` : le rapport `maverick-atelier/1` de la dernière fabrication (serveur, plafond de mémoire, durée, pic de mémoire du conteneur, place, et les JSON `maverick-fabrication/1` et `maverick-comparaison/1` validés), `historique` : les quarante derniers résumés (avec leur `origine`), `bilan` : fabrications par origine, serveur, pic de mémoire, durées, temps processeur, effet sur la production (sonde), verdict (`tient`, `tient_tout_juste`, `ne_tient_pas`, `journee_incomplete`, `inconnu`), raisons, phrase, seuils. Mise en forme : `client/src/lib/debug-atelier.mjs`. |

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
| `GET /api/debug/systeme/?instance=dev\|prod` | `{ instance, instances, maintenant, periode, processus, disque: { dossier, libre, total, utilise, reserve, part_libre, repartition: [{ cle, libelle, octets }], repartition_le, repartition_partielle, repartition_hote }, fichiers, echantillons, evenements, volume: { metriques_octets, taille_logique_octets, croissance_octets_par_jour, croissance_source, croissance_mesuree_octets_par_jour, croissance_mesuree_jours, croissance_estimee_octets_par_jour, debit_ecriture_octets_par_jour, projection_un_an_octets, taille_a_terme_octets, lignes_par_jour, octets_par_ligne, retention, brutes, pages }, sauvegardes, alertes: [{ niveau, message }], bascule_2 }` ; `bascule_2` : voir plus bas, « Debug › Système : l'état de la bascule 2 » ; `volume` : voir [`serveur.md`](serveur.md), « Volume estimé des métriques » (`brutes` et `pages` d'une autre instance : lus dans son dernier démarrage, `null` s'il ne les dit pas) ; `sauvegardes` : `null` sans le fichier d'état du VPS, sinon l'état des copies des deux instances (`serveur.md`, « Sauvegardes automatiques », forme exacte) |
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

## Page Mise à jour : l'activation de la production (`activation_production`)

`GET /api/mise-a-jour/` (site de dev, accès comme le reste de la page) porte, **seulement avec le marqueur `db/bascule-2`** (lot 11, PR 5a ; sans lui ce champ n'existe pas : le même rapport se lit alors dans
`bascule_2.activation` de `GET /api/debug/systeme/`, voir plus bas), le champ `activation_production` : le dernier rapport de `activer.sh`, le script que la production lance en root pour activer un kit avec son
paquet (`docs/serveur.md`, « Bascule 2 : préparation », « PR 5a »). Le service du site de dev le lit dans le dossier partagé des paquets
(`MAVERICK_PAQUETS`, `paquets/activation.json` : un fichier ordinaire, jamais un lien, 16 Kio au plus), le valide champ par champ (liste blanche, jamais un champ inconnu) et le rend
tel quel ; **`null`** quand aucun rapport n'existe ou qu'il est illisible, trop gros ou mal formé. Aucun nom de fiche n'y passe : des états, des versions, des comptes.

```json
{
  "etat": "passee",
  "le": "2026-11-20T10:00:00Z",
  "version": "0.6", "depuis": "0.5", "lot": "5a5a5a5a-0000-4000-8000-000000000001", "mode": "paquet",
  "raisons": [], "pages": 1792, "duree_s": 43, "gel_leve": true,
  "phrase": "La production est passée à la V0.6 (kit V0.5.27) : 1792 pages, service en bonne santé, gel levé. …",
  "geste": null, "perime": false
}
```

- `etat` : `en_cours` (la bascule courte est commencée ; `perime: true` au-delà de 2 h : `activer.sh` a été interrompu, `--reprendre` remet le site précédent), `passee`, `refusee`
  (rien n'a changé : la raison et le geste sont dits), `retour_automatique` (la bascule a échoué, le site précédent est reposé, le gel levé, la base gardée), `retour_incomplet`
  (le retour automatique n'a pas tout remis : intervention du propriétaire, le geste est dit).
- `raisons` : des mots de `RAISONS_DE_L_ACTIVATION` (`serveur/paquets-de-la-production.mjs`) : `kit_sans_paquet`, `empreinte`, `structure`, `note_manquante`, `version_en_arriere` (le
  garde-fou 17), `paquet_absent`, `paquet_irregulier`, `paquet_trop_gros`, `correctif_sans_paquet`, `contenu`, `fiches`, `controles`, `memoire`, `disque`, `verrou`, `fabrication`,
  `bascule`, `sante`, `interrompue`.
- `phrase` (400 caractères au plus) dit les chiffres, `geste` (240 au plus ou `null`) la commande exacte ; `mode` : `paquet` ou `correctif` ; `version` et `depuis` : « X.Y » de
  la production après et avant ; `pages` : le nombre de pages fabriquées ; `duree_s` : la durée du script ; `gel_leve` : le gel des écritures de la production est levé.
- La page Mise à jour ne le montre pas : le bloc « Activation » est dans Debug › Système (`[data-systeme-activation]`, `lib/debug-metriques.mjs#htmlDeLActivation`), qui lit `bascule_2` (ci-dessous), porteur de ce même rapport. Test : `serveur-paquets-de-la-production`, `serveur-bascule-2`.

## Debug › Système : l'état de la bascule 2 (`bascule_2`)

`GET /api/debug/systeme/` (site de dev, accès comme le reste de la page Debug) porte **toujours** `bascule_2` (lecture seule, même sans le marqueur `db/bascule-2` ; absent en production,
où la route n'existe pas) : où en sont les cinq interrupteurs de la bascule 2 et le dernier résultat d'activation. Aucun secret, aucun chemin du serveur : des états, des dates,
des mots d'une liste fermée. `GET /api/mise-a-jour/` ne le porte plus (demande du propriétaire du 2026-11-21) ; il garde `activation_production` (seulement avec le marqueur).

```json
{
  "interrupteurs": {
    "gel_des_fusions": { "etat": false, "raison": null, "phrase": null, "lu_le": "2026-11-19T10:00:00.000Z" },
    "actif":           { "etat": null, "raison": "pas_encore_lu", "phrase": "…", "lu_le": null },
    "db_bascule_2":    { "etat": true, "raison": null, "phrase": null },
    "atelier_servir":  { "etat": true, "raison": null, "phrase": null, "depuis": "2026-11-18T08:00:00Z" },
    "activation_par_paquet": { "etat": true, "raison": null, "phrase": null, "vu_le": "2026-11-20T10:00:00Z" }
  },
  "activation": null
}
```

- Chaque interrupteur : `etat` vaut `true` (allumé), `false` (éteint) ou `null` (**inconnu** : jamais deviné), avec alors `raison` (un mot de `PHRASES_DES_RAISONS`, `serveur/bascule-2-etat.mjs`) et `phrase` (courte).
- `gel_des_fusions` et `actif` : les deux clés de `tools/flux-git/bascule-2.json` sur la branche `dev` de GitHub (la règle des lecteurs de la CI : clé absente = éteinte). Le service lit le
  fichier par l'API de GitHub (`GET /contents`, jeton du service) **en arrière-plan** ; la réponse n'attend jamais GitHub : valeur en cache (`lu_le`, valable 5 min, relue au plus tôt
  1 min après un échec), sinon `pas_encore_lu`. Inconnu : `sans_jeton`, `jeton_refuse`, `droit_manquant` (403), `fichier_introuvable` (404 : fichier absent ou dépôt illisible avec ce
  jeton), `github_injoignable`, `fichier_illisible`, `valeur_illisible` (la clé n'est ni `true` ni `false`), `github_absent`.
- `db_bascule_2` : le marqueur `db/bascule-2` (avec la base source) ; toujours `true` ou `false`.
- `atelier_servir` : `servir.json` des rapports de l'atelier (écrit par root avec l'interrupteur `<atelier>/servir`, retiré avec lui) : `true` et `depuis`, `false` (rapports montés, pas de
  `servir.json`), `null` : `atelier_non_installe` (rapports non montés) ou `rapport_illisible`. Rien d'autre de l'état de l'atelier n'est lu.
- `activation_par_paquet` : le fichier `<production>/activation-par-paquet`, que le site de dev ne voit pas. `activer.sh` refuse sans lui avant d'écrire un rapport : un rapport dit que
  l'interrupteur **existait à son heure** (`etat: true`, `vu_le` = `activation.le`, quel que soit son état, refus compris). Jamais `false` : sans rapport, `null` (`aucune_activation`, ou `pas_de_dossier_des_paquets`).
- `activation` : le dernier rapport (même forme que `activation_production`), `null` sans rapport ; lu même sans le marqueur dès que le dossier des paquets (`MAVERICK_PAQUETS`) est monté.
- Test : `serveur-bascule-2-etat`.

## Tests

`ressources-registre` (chaque table rangée une fois, registre cohérent, `RESSOURCES_MODULE=<module>` pour un seul module), `serveur-api-v1` (fermeture
en production, catalogue, description OpenAPI (chaque route de l'en-tête de `serveur/api.mjs` y est, avec sa méthode) et ses exemples envoyés tels quels par un client, `test/aide-openapi.mjs`, listes, conditions, détail et ETag, sous-ressources, `405`, écritures par le journal,
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

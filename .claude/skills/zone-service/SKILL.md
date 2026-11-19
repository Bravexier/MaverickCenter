---
name: zone-service
description: "Service des personnages client/serveur/ : API /api/ (prétirés, portrait), surveillance des fichiers, base source et marqueurs db/source et db/bascule-2, gel des écritures (db/gel.json), route de l'atelier, accès au site de dev (acces-routes.mjs). À charger avant de lire, modifier ou relire le service, fiche-format.mjs ou leurs tests. Base vivante et conversions : `zone-service-base-vivante`."
paths: ["client/serveur/api.mjs", "client/serveur/service.mjs", "client/serveur/index.mjs", "client/serveur/dev.mjs", "client/serveur/fiches.mjs", "client/serveur/livraison.mjs", "client/serveur/partage.mjs", "client/serveur/acces.mjs", "client/serveur/acces-routes.mjs", "client/test/serveur-acces*.test.mjs", "client/serveur/instant.mjs", "client/serveur/structure-sur-place.mjs", "client/serveur/base-source.mjs", "client/serveur/gel.mjs", "client/test/serveur-gel.test.mjs", "client/test/serveur-bascule-2.test.mjs", "client/test/serveur-base-source.test.mjs", "client/serveur/essai-de-structure.mjs", "client/serveur/essai-dans-l-ombre.mjs", "client/serveur/atelier.mjs", "client/src/lib/atelier-bilan.mjs", "client/test/atelier-bilan.test.mjs", "client/test/serveur-atelier.test.mjs", "client/test/serveur-structure-sur-place*.test.mjs", "client/test/serveur-essai-de-structure.test.mjs", "client/test/serveur-essai-dans-l-ombre.test.mjs", "client/test/aide-structure-sur-place.mjs", "client/src/lib/fiche-format.mjs", "client/test/serveur-api.test.mjs", "client/test/serveur-livraison.test.mjs", "docs/serveur.md"]
user-invocable: false
---
# Service des personnages (`client/serveur/`)

## Fichiers
- `serveur/index.mjs` (point d'entrée livré), `service.mjs` (HTTP, surveillance), `api.mjs` (routes), `fiches.mjs`, `livraison.mjs` (Astro), `structure-sur-place.mjs` (migrations sur place, essai sur copie, bilan `maverick-structure/1`), `base-source.mjs` (`estUneBaseSource`, `etatDeLaBaseSource`), `essai-de-structure.mjs` (essai avant installation ; option `essaiDeStructure`), `essai-dans-l-ombre.mjs`, `dev.mjs` (`npm run serveur`, jamais livré), `acces.mjs` et `acces-routes.mjs` (accès au site de dev).
- `serveur/atelier.mjs` : l'atelier du site de dev (option `atelier` de `demarrerService`, `service.atelier`), skill `zone-hebergement-atelier`. `serveur/gel.mjs` : le gel des écritures.
- `base-vivante.mjs`, `fiches-retraits.mjs` : skill `zone-service-base-vivante` (reconstruction, retraits R42, conversions, `TABLES_FICHES`).
- `src/lib/fiche-format.mjs` : format d'une fiche, partagé avec les pages (sans dépendance).
- Édition des règles (`/api/edition/`, `serveur/edition*.mjs`) : skill `zone-edition`. Conteneurs, nginx, installateurs : skill `zone-hebergement`. Maintenance : skill `zone-maintenance`. Page « Mise à jour » : skill `zone-mise-a-jour`. `/api/v1/` : skill `zone-api-rest`. Métriques et page Debug : skill `zone-debug-metriques`. Tables de la section 13 : skill `zone-fiches-base`. `POST /api/classeur/` et `GET /api/tipeee/` (les deux sorties vers l'extérieur) : skill `zone-service-sorties`. Extrait du contenu, attestation, empreintes : skill `zone-service-extrait`.

## À lire
- `docs/serveur.md` : « Le code », « La base vivante (`db/`) » (reconstruction, retraits, conversions), « L'API » (routes, format d'une fiche, refus), « Hébergement », « Développement ».

## Ce que fait le service
- Node ≥ 22.13, `node:sqlite`, aucun paquet npm. Sous `/api/` : prétirés (liste, lecture, création, modification avec `version`, suppression), portrait, contrôles de `v_personnage_controle` (ils signalent seulement).
- Il écrit dans la base vivante `db/vivante.db`. Site de dev : la base source, jamais refaite (« Structure de la base »). Production : copie de `site/donnees/maverick.db` + section 13, refaite seulement quand ce que les règles apportent change (fiches reprises ; archives dans `db/archives/`) : voir « Reconstruction ».
- À la reconstruction, un don, une spécialité, un sort (avec son livre), un métier ou une arme (R52) disparu est retiré des fiches avec une note datée (R42, `fiches-retraits.mjs`), liste dans `/api/etat` (l'évènement `retraits_fiches` porte `natures`). Toute autre référence rompue : rien ne change, `/api/etat` dit pourquoi.
- Livré : `livraison.mjs` le copie dans `dist/_serveur/` avec `version.json` et `FICHIERS_JOINTS` (qui livre aussi toutes les migrations `.sql`, `schema.sql`, `scripts/constat-de-bascule.mjs`, `scripts/repetition-prod.mjs`, `scripts/repetition-bascule-2.mjs` et `serveur/activation.mjs`, qui n'importent que des modules livrés). Prétirés seulement.
- `/api/etat` (site de dev) : `modifications.en_attente`, `.conflit` et `.lots_en_conflit` ne comptent que les lots à résoudre.

## Invariants
- Le service n'importe que `node:…` et des chemins relatifs (`modulesDuServeur` de `serveur/livraison.mjs`, testé). `tools/build-artifact.mjs` n'emporte pas `_serveur/` ; il emporte `lib/fiche-moteur.mjs` (pur) par `lib/poids-portable-db.mjs`, jamais `lib/fiche-regles.mjs`.
- Une écriture exige `Content-Type: application/json` et refuse un autre `Sec-Fetch-Site`.
- Les adresses de l'API finissent par « / » (`/api/personnages/<id>/`) : en développement, Astro (`trailingSlash: 'always'`) refuse les autres.
- `traiter` (`serveur/api.mjs`) est synchrone, sauf `POST /api/classeur/`, `GET /api/tipeee/`, `GET /api/edition/extrait/`, `POST /api/mise-a-jour/lancer/` (base source) et `…/copier/`, qui rendent une promesse que `service.mjs` attend (une réponse détruite n'est plus écrite).
- Surveillance (`service.mjs`) : un changement compte vu deux fois de suite (`guetteur`). `version.json` changé : le service s'arrête (code 0), Docker le relance ; `maverick.db` changé : base vivante préparée (refaite ou non) ; `db/vivante.db` remplacée : rouverte.

## Accès au site de dev (R275, option b : mot de passe pour modifier et lancer une mise à jour, lecture ouverte)
- `serveur/acces.mjs` : réglage `secrets/acces.json` (scrypt, SHA-256 de la clé de lecture, `cle_de_depot: { empreinte }` facultative, préfixe `mvd_`), sessions HMAC de 12 h, essais limités ; `serveur/acces-routes.mjs` : le classement des routes. Détail : `docs/serveur.md`, « Accès au site de dev ».
- Toute route nouvelle se classe dans `acces-routes.mjs` : ouverte, lecture (clé ou mot de passe), proposition ou écriture (mot de passe) ; une route inconnue est fermée comme une écriture, et `serveur-acces-routes.test.mjs` échoue sinon.
- Classe `proposition` : pour déposer un lot, refaire son essai et `POST /api/edition/lots/recalcul/`. Clé de dépôt non posée : la porte de `lecture` (clé ou mot de passe), elle n'écrit que `lot_de_changements`. Clé de dépôt posée (R291) : la clé de dépôt ou le mot de passe, la clé de lecture est refusée (403), et le lot est appliqué aussitôt ; sans rien, 401 `acces: "cle_de_depot"`. `/api/acces/` rend le droit `depot`. `GET …/annulation/` est en `lecture` ; appliquer, refuser, annuler un lot et les routes de ligne (`…/lignes/<n>/…`) sont en `ecriture` ; la clé de dépôt n'ouvre jamais un verrou de décision ; `scripts/db-extrait.mjs` refuse une clé `mvd_` sous `GITHUB_ACTIONS` (la CI ne garde que la clé de lecture). Toutes les routes `/api/edition/lots/` répondent 403 hors site de dev (skill `zone-edition-lots`).
- Réglage absent : tout est ouvert comme avant. La production n'est jamais concernée. Fiches de joueur, comptes et groupes ne sont jamais ouverts une fois le mot de passe posé.
- `/api/etat` sans droit de lecture est masqué : jamais `retraits` ni `base.erreur` détaillée.
- La clé passe par `X-Maverick-Cle` ou `X-Maverick-Key` (le formulaire de clé des sessions Claude exige un nom finissant par `key`), seulement ces deux (`ENTETES_CLE`, `serveur-acces.test.mjs`) : tout nouveau nom passe par là. Caddy et nginx effacent `Authorization`. Navigateur : cookie `maverick_acces`. Aucun secret dans le journal, les métriques ni la page Debug.

## Gel des écritures (`serveur/gel.mjs`, garde-fou 16 ; éteint sans `db/gel.json`)
- Le fichier `db/gel.json`, posé par root (`gel.sh`, skill `zone-hebergement-activation`) : non échu, toute écriture de `/api/` répond 503 (`{ erreur, gel }`, `Retry-After`) sur cette instance ; les lectures restent ouvertes. Sans fichier, `traiter` ne change rien (test). Fichier illisible ou trop gros : gel tenu par prudence 2 h au plus ; échéance plafonnée à 4 h après la date de modification.
- Une route qui écrit est gelée par défaut : une route nouvelle ou inconnue aussi. Seules `ROUTES_EXEMPTEES` passent (chacune avec sa raison : connexion, `POST /api/classeur/`, balise des pages vues, lectures faites en `POST` de `/api/edition/`, `POST /api/maintenance/lever/`). Un gel n'est ni une erreur 5xx des métriques ni une ligne du journal de la production.
- `GET /api/etat/` porte `gel` (`null` sans gel) ; son `geste` (un chemin de l'hôte) est masqué (`null`) en production et sans droit de lecture du site de dev (le corps du 503 suit la même règle). Le report d'une livraison (`actualiser`) reste admis pendant un gel.
- Tests : `serveur-gel`, `deploy-gel` (le script).

## Atelier du site de dev (`serveur/atelier.mjs`)
- Le service tient l'extrait de l'atelier dans le dépôt de l'atelier, monté sur `/atelier-depot` (`contenu-<version>.db`), jamais sous `db/essai-de-structure/` (effacé au premier passage) (skill `zone-service-extrait`).
- Route `POST /api/edition/atelier/` (« le bouton », `refaireMaintenant`) : l'extrait est refait tout de suite, rien d'autre (le service ne commande pas root) ; classée dans `acces-routes.mjs` comme toute route.
- Il lit les rapports de root montés sur `/atelier` en lecture seule, un fichier à la fois, forme et taille validées. Le champ `bilan` (`maverick-atelier-bilan/1`, verdicts `tient`, `tient_tout_juste`, `ne_tient_pas`, `journee_incomplete`) est calculé à chaque lecture par `src/lib/atelier-bilan.mjs` (module pur, livré avec le service) ; ses `SEUILS` sont des choix techniques, exposés et réglables. États : `pas_d_atelier`, `non_installe`, `en_attente`, `en_cours`, `rapport` (route et page : skill `zone-debug-metriques`).

## Structure de la base (R274, R275)
- Le site de dev porte le marqueur `db/source` (R274 ; seul `bascule.sh` le pose ou le retire : skill `zone-hebergement`). Le marqueur `db/bascule-2` (seulement avec `db/source`, relu à chaque fois, posé par `bascule.sh poser-bascule-2`) n'ajoute que des refus de mise à jour et le dépôt des paquets (skill `zone-mise-a-jour-paquet`) ; absent, le service est celui d'avant. La production n'en a pas : sa base est refaite depuis les règles, et un essai de structure qui échoue n'y arrête ni le site ni l'installation.
- Sur la base source :
  - elle n'est jamais refaite depuis les règles : ni rejeu, ni archive de reconstruction, ni essai dans l'ombre ;
  - base absente : le service ne démarre pas (sortie 1) et ne la recrée pas, même retirée en cours de route (toute écriture répond 503) ; une restauration repasse par les mêmes contrôles ;
  - `preparerBaseSource`, avant toute écriture : les migrations livrées de numéro > `user_version` sont essayées sur une copie, puis appliquées sur place avec sauvegarde `db/archives/structure-*.db` (5 gardées, même après un échec) ; la structure est comparée au `schema.sql` livré. La version livrée (`structure-sur-place.mjs#versionLivree`) est la plus haute de la dernière migration et de `versionDuSchemaSql(schema.sql)` : le `schema.sql` est le plancher quand des migrations mixtes quittent le dépôt, seules les migrations au-dessus s'appliquent, et une base au plancher est « à jour » (verdict `a_jour`), pas « en avance » ; en dessous, une migration manque (refus). Migrations ou schéma non livrés, essai ou application refusés, structure différente (une publication plus ancienne que la base) : le service ne démarre pas, la raison au journal (catégorie `base`) et dans l'évènement `base_source` ;
  - `vivante.json` porte `source` et `sur_place` ; `/api/etat` porte `base.source` et `base.sur_place` ; l'option `service.source` (vraie avec le marqueur) ouvre le paquet et les lots sur toutes les tables (skills `zone-edition-lots`, `zone-mise-a-jour`).
  - Détail : `docs/serveur.md`, « Base source » et « Restauration de la base du site de dev ».
- Les copies d'essai sont toujours effacées (purge à l'ouverture et dans le `catch` d'un fil mort). La base n'est pas en WAL : un `VACUUM INTO` fait attendre les écritures.
- Les messages « structure : … » du journal du service sont rangés en catégorie `base`. Page Debug : skill `zone-debug-metriques` ; installateur : skill `zone-hebergement`.

## Tests
- `serveur-base-source` (marqueur, refus de démarrer, application sur place, sauvegardes), `serveur-atelier`, `atelier-bilan`, `serveur-structure-sur-place*`, `serveur-essai-de-structure`, `serveur-essai-dans-l-ombre`.
- `serveur-acces` (réglage, sessions, essais), `serveur-acces-routes` (classement), `serveur-api` (routes, refus, conflit de versions, serveur HTTP réel), `serveur-bascule-2`, `serveur-livraison` (modules livrés, service livré démarré). Base vivante : skill `zone-service-base-vivante`.
- `test/site-html.test.mjs` contrôle `dist/_serveur/` après le build.

---
name: zone-debug-metriques
description: "Page /debug/ du site de dev (menus Système, Performances, Journaux, DB et schéma de la base), journal du service, contenu des tables, métriques du service (une base par instance, jauge du disque, volume.sh, balise des pages). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/pages/debug.astro", "client/src/scripts/debug.mjs", "client/src/scripts/debug-schema.mjs", "client/src/lib/debug-*.mjs", "client/src/lib/schema-structure.mjs", "client/src/components/debug/**", "client/src/styles/debug/**", "client/serveur/journal-du-service.mjs", "client/serveur/metriques.mjs", "client/serveur/metriques-sql.mjs", "client/serveur/debug-tables.mjs", "deploy/vps/volume.sh", "client/test/debug-*.test.mjs", "client/test/serveur-metriques*.test.mjs", "client/test/serveur-debug-tables.test.mjs", "client/test/journal-du-service.test.mjs", "client/test/deploy-volume.test.mjs"]
user-invocable: false
---
# Page Debug et métriques

## Fichiers
- Page : `client/src/pages/debug.astro`, `src/scripts/debug.mjs` (Système, Performances, Journaux ; n'importe que `lib/debug-journaux.mjs` et `lib/debug-metriques.mjs`, purs), `styles/debug/debug.css`.
- DB : `components/debug/SchemaDeLaBase.astro`, `src/scripts/debug-schema.mjs` (n'importe que `lib/debug-schema.mjs`, pur ; aucun module commun avec `debug.mjs`), `lib/schema-structure.mjs` (au build), `styles/debug/schema.css`.
- Service : `serveur/journal-du-service.mjs` (journal en mémoire, `estUneReleve`), `serveur/metriques.mjs` (collecte, base des métriques, lectures, jauge), `serveur/metriques-sql.mjs` (requêtes SQL comptées pendant une requête HTTP), `serveur/debug-tables.mjs` (contenu des tables, `versionDeLaBase`, `versionDuContenu`).
- Hôte : `deploy/vps/volume.sh` (relevé du disque, `volume-hote.json`). Balise des pages : script en ligne de `layouts/Base.astro`.

## À lire
- `docs/api.md`, « Page Debug » (les quatre menus en détail), « Contenu des tables », « Routes des métriques », « Tests ».
- `docs/serveur.md`, « Métriques et volume » (où, rétention, volume, bornes, jauge de l'espace disque, tout ce qui grossit) et le journal du service dans « API REST `/api/v1/` et page Debug ».

## Choix du propriétaire
- Site de dev seulement : `devSeulement` de `lib/nav.mjs#entreesDuMenu` (skill `zone-menu`). Ni au menu d'un build `SITE_MODE=prod` (la page n'y dit qu'une phrase, sans script) ni dans la version portable.
- Sous le titre et la ligne d'état du service, quatre menus déroulants fermés par défaut, dans l'ordre Système, Performances, Journaux, DB, et rien d'autre (demande du propriétaire du 2026-10-15). Plus de testeur de l'API (« Tester l'API sera donc supprimé car devenu inutile après le schéma ») ; `/api/v1/openapi.json` reste pour les outils externes.
- Système : choix de l'instance, synchronisé avec Performances (adaptation, pas une demande : Performances fermé n'a pas à s'ouvrir pour changer l'instance de Système) ; processus, disque, fichiers, évènements, volume des métriques, alertes, et la jauge « Espace disque du serveur » : somme = taille du disque, un segment coloré par type de données, réserve de root à part ; sur le VPS, complétée par le relevé de l'hôte `volume.sh`.
- Performances : temps de réponse par route normalisée, pages vues mesurées par le navigateur, navigateurs, origines, requêtes récentes, export CSV. Instance production ou site de dev, jamais mélangées (décision du propriétaire).
- Journaux du serveur : journal du service en mémoire, 2 000 entrées, `GET /api/debug/journal/?depuis=&min_ms=`, relevé toutes les 2 s, filtres niveau, catégorie, texte, durée ; chaque requête `/api/` notée en catégorie `http` avec ses champs isolés.
- DB (« un mappage vectoriel des tables ») : le schéma, dessiné à la première ouverture ; les 195 tables et 35 vues (masquées par défaut), colonnes, types, un lien par clé étrangère (415, dont deux auto-références en boucle : `note_cellule`, `modification_lot.resolu_par` de la migration 0072) ; zoom, déplacement, recherche ; au double clic, le contenu de la table dans une fenêtre, fiches comprises, qui se met à jour quand la table change.
- Contenu des tables : tout est lisible sur le site de dev ; seule la base de production est fermée (décision du propriétaire du 2026-10-15).
- Balise des pages (`Base.astro`) active en production aussi (décision du propriétaire du 2026-10-15) ; `MAVERICK_METRIQUES_PAGES=0` (service) ou `SITE_METRIQUES_PAGES=0` (build) la coupent.

## Invariants
- Un menu fermé ne demande rien au service : il charge à son ouverture, relève tant qu'il reste ouvert et s'arrête refermé (`lib/debug-metriques.mjs#suivreLOuverture`).
- La structure du schéma est calculée au build (`lib/schema-structure.mjs`) et posée en JSON hors production seulement.
- Contenu des tables : lu dans la base vivante en lecture seule, `GET /api/debug/tables/<nom>/` avec `ETag`, version relevée par `GET /api/debug/base/`. Images jamais entières, même dans le JSON du journal ; textes longs coupés en SQL. Un nom n'entre dans le SQL qu'après `PRAGMA table_list` (une colonne de tri, `PRAGMA table_info`).
- Métriques : une base SQLite par instance, `<MAVERICK_DOSSIER_METRIQUES>/<instance>.db` (`prod.db`, `dev.db`, dossier partagé). Jamais la base vivante ni `data/rows`.
- Versées une fois par minute, jamais une écriture par requête.
- Une route est un gabarit (`routeNormalisee`) : jamais un identifiant ni la chaîne de requête. Une route ajoutée à `serveur/api.mjs` y va aussi, sinon elle compte comme `/api/{inconnue}`.
- Jamais d'IP, de corps, de cookie ni de User-Agent entier.
- Cardinalité bornée même devant un trafic fabriqué : refus `403`/`405` regroupés (`routeGardee`), pages du site construit seulement (`pagesDuSite`), plafond dur `PLAFOND_METRIQUES_OCTETS` (au-delà, collecte restreinte).
- Un quantile au-delà de la dernière borne n'est qu'une borne basse (`au_dela`).
- Une colonne ajoutée : `SCHEMA_METRIQUES` + migration à l'ouverture (`ouvrir`, `migrerPagesVues`) ; le fichier de l'autre instance se lit tel quel.
- Une clé de la jauge (`REPARTITION`, `REPARTITION_HOTE`) se change ensemble dans le service, `deploy/vps/volume.sh`, `TYPES_DU_DISQUE` (`lib/debug-metriques.mjs`) et sa couleur (`debug.css`), et le tableau de `docs/serveur.md` (« Jauge de l'espace disque ») : les tests les comparent.

## Tests
- `debug-page` (quatre menus fermés et leur ordre, menu fermé sans requête, absence en production), `debug-metriques`, `debug-schema`, `debug-balise`, `nav`.
- `journal-du-service`, `serveur-debug-tables`, `serveur-metriques`, `serveur-metriques-bornes`, `serveur-metriques-http`, `serveur-metriques-disque`, `deploy-volume` (compare `volume.sh` au service).
- La CI construit aussi le site de production et y relance `debug-page.test.mjs` et `site-html.test.mjs`.

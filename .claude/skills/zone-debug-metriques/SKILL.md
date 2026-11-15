---
name: zone-debug-metriques
description: "Page /debug/ du site de dev (menus Système, Performances, Journaux, DB et schéma de la base), journal du service, contenu des tables, métriques du service (une base par instance, jauge du disque, volume.sh, balise des pages). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/pages/debug.astro", "client/src/scripts/debug.mjs", "client/src/scripts/debug-schema.mjs", "client/src/scripts/debug-structure.mjs", "client/src/lib/debug-*.mjs", "client/src/lib/schema-structure.mjs", "client/src/components/debug/**", "client/src/styles/debug/**", "client/serveur/journal-du-service.mjs", "client/serveur/metriques.mjs", "client/serveur/metriques-sql.mjs", "client/serveur/debug-tables.mjs", "deploy/vps/volume.sh", "client/test/debug-*.test.mjs", "client/test/serveur-metriques*.test.mjs", "client/test/serveur-debug-tables.test.mjs", "client/test/journal-du-service.test.mjs", "client/test/deploy-volume.test.mjs"]
user-invocable: false
---
# Page Debug et métriques

## Fichiers
- Page : `client/src/pages/debug.astro`, `src/scripts/debug.mjs` (Système, Performances, Journaux ; n'importe que `lib/debug-journaux.mjs` et `lib/debug-metriques.mjs`, purs), `styles/debug/debug.css`.
- DB : `components/debug/SchemaDeLaBase.astro`, `src/scripts/debug-structure.mjs` (bloc « Structure de la base » ; n'importe que `lib/debug-structure.mjs`, pur ; aucun module commun avec `debug.mjs` ni `debug-schema.mjs`), `src/scripts/debug-schema.mjs` (n'importe que `lib/debug-schema.mjs`, pur ; aucun module commun avec `debug.mjs`), `lib/schema-structure.mjs` (au build), `styles/debug/schema.css`.
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
- DB (« un mappage vectoriel des tables ») : le schéma, dessiné à la première ouverture ; toutes les tables et les vues (masquées par défaut), colonnes, types, un lien par clé étrangère (dont deux auto-références en boucle : `note_cellule`, `modification_lot.resolu_par` de la migration 0072) ; zoom, déplacement, recherche ; au double clic, le contenu de la table dans une fenêtre, fiches comprises, qui se met à jour quand la table change.
- Structure de la base (R274, R275) : bloc « Structure de la base » **en tête du menu DB** (les quatre menus restent, jamais un cinquième) ; il se charge à l'ouverture et sur « Actualiser », sans relève. Route `GET /api/debug/structure/` (`maverick-essai-etat/1`, avec `dernier` et `ombre`), évènements `structure_essai` et `structure_ombre`. Lecture : `attendu` est normal tant que la base du site de dev n'est pas la source (`db/source` absent) ; `ecart`, `refuse` et `indisponible` sont en alerte ; 403, 503 et `ombre: null` donnent un message neutre (service : skill `zone-service`). Test : `debug-structure`.
- Contenu des tables : tout est lisible sur le site de dev ; seule la base de production est fermée (décision du propriétaire du 2026-10-15). Avec le mot de passe d'accès posé (R275, skill `zone-service`), `GET /api/debug/…` demande la clé de lecture ou le mot de passe ; `scripts/acces.mjs` gère le 401 (relèves comprises), rien dans `debug.mjs`.
- Sauvegardes : bloc « Sauvegardes » du menu Système. `sauvegardes.json`, dans le dossier des métriques (écrit par `deploy/installateur/sauvegarde/`, skill `zone-hebergement`), est lu par `serveur/metriques.mjs#lireSauvegardes` et exposé dans le champ `sauvegardes` de `/api/debug/systeme/` ; `null` sans fichier, et le bloc affiche alors une ligne sobre. Seuils : `SEUILS_SAUVEGARDES` (`lib/debug-metriques.mjs`), 26 h par copie, 36 h par envoi.
- Balise des pages (`Base.astro`) active en production aussi (décision du propriétaire du 2026-10-15) ; `MAVERICK_METRIQUES_PAGES=0` (service) ou `SITE_METRIQUES_PAGES=0` (build) la coupent.

## Invariants
- Un menu fermé ne demande rien au service : il charge à son ouverture, relève tant qu'il reste ouvert et s'arrête refermé (`lib/debug-metriques.mjs#suivreLOuverture`).
- La structure du schéma est calculée au build (`lib/schema-structure.mjs`) et posée en JSON hors production seulement.
- Une table ajoutée peut faire tomber la densité de la carte sous le seuil de `debug-schema.test.mjs`. On rebalaie alors `RAPPORT_GLOBAL` (choisi au milieu d'un palier de densité), sans baisser le seuil.
- Contenu des tables : lu dans la base vivante en lecture seule, `GET /api/debug/tables/<nom>/` avec `ETag`, version relevée par `GET /api/debug/base/`. Images jamais entières, même dans le JSON du journal ; textes longs coupés en SQL. Un nom n'entre dans le SQL qu'après `PRAGMA table_list` (une colonne de tri, `PRAGMA table_info`).
- Métriques : une base SQLite par instance, `<MAVERICK_DOSSIER_METRIQUES>/<instance>.db` (`prod.db`, `dev.db`, dossier partagé). Jamais la base vivante ni `data/rows`.
- `lireSauvegardes` ne reprend que les champs connus, bornés. Le tableau `locale.reglages_illisibles` déclenche une alerte « avertissement » du service. Les clés de `systeme()` sont épinglées dans `serveur-metriques.test.mjs` : une clé ajoutée s'y ajoute.
- Versées une fois par minute, jamais une écriture par requête.
- Évènements `extrait` (fabrication de l'extrait du contenu) et `attestation` (écriture de celle de la production) : durée et nombres seulement, jamais un nom de fiche ni un texte de problème (skill `zone-service-extrait`). L'attestation passe par le dossier des métriques, déjà partagé entre les deux instances : rien dans `deploy/`.
- Une route est un gabarit (`routeNormalisee`) : jamais un identifiant ni la chaîne de requête. Une route ajoutée à `serveur/api.mjs` y va aussi, sinon elle compte comme `/api/{inconnue}` (gabarit `acces` pour `/api/acces/…`).
- Jamais d'IP, de corps, de cookie ni de User-Agent entier.
- Cardinalité bornée même devant un trafic fabriqué : refus `403`/`405` regroupés (`routeGardee`), pages du site construit seulement (`pagesDuSite`), plafond dur `PLAFOND_METRIQUES_OCTETS` (au-delà, collecte restreinte).
- Un quantile au-delà de la dernière borne n'est qu'une borne basse (`au_dela`).
- Une colonne ajoutée : `SCHEMA_METRIQUES` + migration à l'ouverture (`ouvrir`, `migrerPagesVues`) ; le fichier de l'autre instance se lit tel quel.
- Une clé de la jauge (`REPARTITION`, `REPARTITION_HOTE`) se change ensemble dans le service, `deploy/vps/volume.sh`, `TYPES_DU_DISQUE` (`lib/debug-metriques.mjs`) et sa couleur (`debug.css`), et le tableau de `docs/serveur.md` (« Jauge de l'espace disque ») : les tests les comparent.

## Tests
- `debug-page` (quatre menus fermés et leur ordre, menu fermé sans requête, absence en production), `debug-metriques`, `debug-schema`, `debug-balise`, `nav`.
- `journal-du-service`, `serveur-debug-tables`, `serveur-metriques`, `serveur-metriques-bornes`, `serveur-metriques-http`, `serveur-metriques-disque`, `serveur-metriques-sauvegardes`, `debug-metriques-sauvegardes`, `deploy-volume` (compare `volume.sh` au service).
- La CI construit aussi le site de production et y relance `debug-page.test.mjs` et `site-html.test.mjs`.

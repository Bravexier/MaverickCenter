---
name: zone-hebergement
description: "Hébergement deploy/ : installateurs prod/test, VPS (durcir, outils, instances, Caddyfile), paquet NAS (build.sh, update-site.sh, branche site qui n'avance plus), nginx.conf, docker-compose.yml, accès au site de dev (acces.sh), fins de ligne LF. L'atelier et le kit : skill `zone-hebergement-atelier`. À charger avant de lire, modifier ou relire deploy/ ou ses tests."
paths: ["deploy/{README.md,build.sh,docker-compose.yml,nginx.conf,update-site.sh}", "deploy/vps/**", "deploy/installateur/{README.md,docker-compose.yml,fabriquer.mjs,fabriquer.sh,installateur.sh,mise-a-jour.sh}", "deploy/installateur/acces/**", "deploy/installateur/sauvegarde/**", ".gitattributes", "client/test/deploy-vps.test.mjs", "client/test/deploy-volume.test.mjs", "client/test/installateur.test.mjs", "client/test/installateur-essai-de-structure.test.mjs", "client/test/mise-a-jour.test.mjs", "client/test/update-site.test.mjs", "client/test/serveur-livraison.test.mjs", "client/test/deploy-sauvegardes*.test.mjs", "client/test/deploy-acces.test.mjs", "client/test/aide-sauvegardes.mjs"]
user-invocable: false
---
# Hébergement (`deploy/`)

## Fichiers
- Installateurs (le site en ligne) : `deploy/installateur/installateur.sh` (modèle), `fabriquer.mjs` → un installateur `.sh` autonome par livraison, mode prod (serveur normal) ou test (ne copie plus le `db/` du serveur normal, sauf `--copier-base-prod` dans un `db/` vide) ; `mise-a-jour.sh` exécute le dernier du mode de l'instance ; `fabriquer.sh prod|test` à la main ; `docker-compose.yml`.
- VPS des deux instances : `deploy/vps/durcir.sh`, `outils.sh`, `instances.sh`, `volume.sh`, `Caddyfile`, `README.md` pas à pas (dont « 7. Site de dev : mode modification et page Mise à jour » : `MAVERICK_EDITION`, `MAVERICK_ADRESSE_PUBLIQUE`, les deux jetons).
- Paquet du NAS (installation à la main) : nginx + service des personnages dans Docker, mot de passe ; `deploy/build.sh` (le zip), `deploy/update-site.sh` (installe la branche `site` dans un dossier ; la livraison ne la reconstruit plus : elle publie des installateurs), `deploy/docker-compose.yml`, `deploy/README.md`. Une installation existante garde sa copie `update-nas.sh`.
- `deploy/nginx.conf` : commun au NAS et aux installateurs.
- Le service lui-même : skill `zone-service`. Maintenance et dossier partagé `maintenance/` : skill `zone-maintenance`. Métriques et `volume.sh` : skill `zone-debug-metriques`. Versions, releases et branche `site` : `docs/flux-git.md`.

## À lire
- `deploy/installateur/README.md` (instances, `db/`, mise à jour automatique), `deploy/vps/README.md` (mise en place du VPS), `deploy/README.md` (NAS).
- `docs/serveur.md`, « Hébergement » (conteneurs, variables d'environnement, surveillance, sortie sur Internet).

## Choix du propriétaire
- Les docs de l'hébergement décrivent le fonctionnement tel qu'il est, sans « à partir de la X » ni « avant la X » (demande du 2026-10-22) : ce qui ne sert plus se dit comme tel ou sort de la doc. `test/deploy-vps.test.mjs` le garde pour les README de `deploy/`, `docs/flux-git.md` et le README du dépôt.

## Invariants
- Les `.sh` et tout `deploy/` restent en LF (`.gitattributes` : `*.sh` et `deploy/**` en `eol=lf`) : ils partent tels quels sur un serveur Linux, même depuis un clone Windows.
- Deux conteneurs dans chaque `docker-compose.yml` (NAS et installateurs) : nginx et `serveur` (`node:22-alpine`, exécute `site/_serveur/serveur/index.mjs`, port 8787 sans port publié).
- `deploy/nginx.conf` transmet `/api/` (adresse résolue à chaque requête, `proxy_connect_timeout 5s` : nginx démarre sans le service, et `/api/` répond 502 s'il est arrêté) et répond 404 sur `/_serveur/` (code du service, jamais servi).
- Le service se relance seul quand `version.json` change (code 0, `restart: unless-stopped`). Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d`.
- Aucune installation ne vide ni ne remplace `db/` (R274 : les saisies du site de dev sont introuvables ailleurs). Copie de la production sur demande seulement (`--copier-base-prod`), refusée si `db/` est rempli hors `metriques/` et `essai-de-structure/`. `MAVERICK_BASE_TEST=conservee` est sans effet.
- `mise-a-jour.sh` en mode test refuse une livraison plus ancienne que celle installée (comparaison X, Y, Z, rebuild) ; `--force` pour revenir en arrière ; `VERSION` absent = première installation. La production n'est pas concernée.
- Un installateur de test refuse un dossier de production et inversement. L'installateur ne touche jamais aux métriques.
- L'attestation de la production (`attestation-prod.json`) voyage par le dossier des métriques, déjà partagé entre les deux instances : aucun montage ni variable de plus dans `deploy/` (skill `zone-service-extrait`).
- Le kit de l'atelier et l'atelier : skill `zone-hebergement-atelier`. L'installateur de production n'en porte rien (son script reste identique à celui d'avant le kit).
- Journaux des conteneurs : pilote `json-file`, 5 fichiers de 10 Mo au plus par conteneur (`logging` de chaque service des deux `docker-compose.yml`).

## VPS
- `instances.sh` pose les dossiers et le `.env` de chaque instance : ports sur `127.0.0.1` (Docker contourne ufw : seul Caddy les atteint), `MAVERICK_BASE_TEST=conservee` (ceinture contre un ancien installateur lancé à la main), `MAVERICK_EDITION=1` et `MAVERICK_DOSSIER_MAINTENANCE` (le `maintenance/` du serveur normal) et `MAVERICK_DOSSIER_PRODUCTION` (le `site/` du serveur normal, monté en lecture seule sur `/production` par `docker-compose.yml` : référence de l'onglet « Mise à jour », skill `zone-mise-a-jour`) pour le test ; ce dossier ne doit jamais être le `site/` de l'instance elle-même (le service refuse la production), et le NAS n'a pas ce montage (`deploy/vps/README.md`, « 7. Site de dev ») ; mots de passe internes présentés par Caddy à la place des visiteurs.
- `Caddyfile` : `maverick-jdr.com` → 8080 (serveur normal, `master`), `dev.maverick-jdr.com` → 8081 (serveur de test, `dev`), `www.` → domaine principal.
- Accès pour le PoC (décision du propriétaire) : pas de mot de passe visible pour la lecture, adresse non référencée (`X-Robots-Tag`, `robots.txt`). Le contenu appartient au propriétaire du jeu : ne pas désactiver la protection ni la non-indexation sans son accord.
- `PREMIERE_VERSION_HEBERGEE` (`tools/flux-git/regles.mjs`, 0.2.0) : en dessous, `livrableDe` choisirait la branche `site` ; dev et master l'ont dépassée, seuls les installateurs sont publiés.

## Sauvegardes automatiques (`deploy/installateur/sauvegarde/`)
- `lib.sh`, `copie.sh`, `envoi.sh`, `essai.sh`, `installer.sh`, `lanceur.sh`, `mots.txt` sont livrés dans `<instance>/sauvegarde/` par l'installateur, remplacés à chaque installation sans doublon (un fichier qui n'est plus livré est retiré). `mise-a-jour.sh` garde `installateur-courant/`, que l'installateur ne touche jamais.
- Trois minuteurs systemd (horaire, nuit, essai mensuel) les exécutent en root par le lanceur stable `/usr/local/lib/maverick-center/maverick-sauvegarde-lanceur.sh`, qui prend les scripts du site de dev, sinon ceux de la production, et refuse des scripts modifiables par un autre que root.
- Copies dans `/srv/maverick-sauvegardes`, accès et clé dans `/etc/maverick-sauvegardes` (700/600), hors des dossiers d'instance. `volume.sh` compte `/srv/maverick-sauvegardes` dans « installations ».
- Le geste unique du propriétaire, relançable : `sudo sh /srv/maverick-center-test/sauvegarde/installer.sh` (options `--stockage`, `--verifier-le-stockage`, `--afficher-la-cle`, `--essai`, `--sans-stockage`, `--retirer`).
- La copie ouvre chaque base en lecture seule : le contenu de `db/` n'est jamais modifié et rien n'y est créé (une base WAL sans `-wal` est ouverte « immutable », `copie.sh#source_a_ouvrir`) ; seule exception, un `-wal` laissé sans `-shm` après un arrêt brutal, que SQLite doit rouvrir. `docker-compose.yml` n'est pas concerné.
- Chaque instance est copiée dans son propre processus (`MAVERICK_SAUV_ENFANT=1`) : l'échec de l'une n'empêche jamais l'autre ; un arrêt inattendu donne l'alerte `erreur_interne`.
- Un réglage illisible de `reglages.env` alerte (`locale.reglages_illisibles`) et prend la valeur par défaut, jamais en silence.
- Aucun message ne répète la valeur d'un secret saisi (`installer.sh#valide_secret`).
- Aucun secret dans le dépôt, un journal, l'état ou la page Debug. Le dépôt est public : aucune valeur réelle de stockage, seulement `https://s3.exemple.invalid` et `bucket-exemple`.
- Outil : restic (apt). En 0.16.4, `--keep-monthly unlimited`, pas `-1`.
- Choix du propriétaire (R275) : copie extérieure chiffrée, fiches comprises, chez un autre fournisseur que l'hébergeur, dont il garde la clé ; rétention de 30 jours, plus une copie par mois et une par version sans limite ; envoi chaque nuit ; clé = phrase de 6 mots, réaffichable ; changer de stockage ou d'hébergeur ne demande que la phrase et les accès.

## Accès au site de dev (`deploy/installateur/acces/`, R275)
- `acces.sh` est livré dans `<instance>/acces/` comme `sauvegarde/` (`DOSSIERS_DE_SCRIPTS`, remplacé à chaque installation). Geste du propriétaire : `sudo sh /srv/maverick-center-test/acces/acces.sh` (options `--cle`, `--portee ecriture|tout`, `--etat`, `--retirer`). Il refuse la production et pose `secrets/acces.json` en 600. Le mot de passe n'est jamais un argument de commande ni un fichier. Détail : `docs/serveur.md`, « Accès au site de dev ».
- Option c (un mot de passe pour tout le site) : le snippet `forward_auth` de `deploy/vps/Caddyfile` est en commentaire, jamais actif ; `docker-compose.yml`, `nginx.conf` et le Caddyfile actif ne changent pas.

## Essai de structure et contrôle des migrations (R274, R275)
- `ci.yml` a un job `controle-des-migrations` : checkout `fetch-depth: 0`, sans `npm ci`, parallèle, hors du job `client` dont les commandes sont épinglées. Vers `master`, il ne contrôle que les règles (`--sans-essai`). Règles : `docs/flux-git.md`, « Règles des migrations ». Toute nouvelle commande du job `client` entre aussi dans `scripts/mise-a-jour-github.mjs#CONTROLES`.
- L'installateur n'écrit que sa demande dans `db/essai-de-structure/` et n'a jamais de `rm` ailleurs dans `db/`. Délais : 20 s pour l'accusé, 120 s pour le résultat.
- Ce dossier ne compte pas pour un `db/` rempli, et n'est copié ni de la production ni par les sauvegardes (`copie.sh`, `lib.sh`).
- Tant que `db/source` n'existe pas, l'installation continue toujours ; ce marqueur est celui de la bascule : un refus de l'essai arrêtera alors l'installation avant tout dépôt. Service : skill `zone-service`.

## Tests
- `deploy-acces` (`acces.sh`, livraison par l'installateur), `deploy-sauvegardes`, `deploy-sauvegardes-installer` (scripts exécutés pour de bon dans un monde factice, `aide-sauvegardes.mjs`).
- `deploy-vps` (`instances.sh` : dossiers partagés de la maintenance et des métriques, une instance par fichier, minuteur du relevé de l'hôte ; l'étape « Site de dev » du README), `deploy-volume` (rotation des journaux Docker, métriques hors de `db/`, `volume.sh`), `installateur` (`db/` jamais vidé ni remplacé, copie sur demande, métriques jamais copiées ni effacées), `installateur-essai-de-structure` (demande, délais, refus), `mise-a-jour` (`mise-a-jour.sh` : refus d'une livraison plus ancienne en mode test, R274), `update-site` (contre un faux serveur GitHub), `serveur-livraison` (`docker-compose.yml` et `nginx.conf` cohérents).

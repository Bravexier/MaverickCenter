---
name: zone-hebergement
description: "Hébergement deploy/ : installateurs prod/test, VPS (durcir, outils, instances, Caddyfile), paquet NAS (build.sh, update-site.sh, branche site qui n'avance plus), nginx.conf, docker-compose.yml, fins de ligne LF. À charger avant de lire, modifier ou relire deploy/ ou ses tests."
paths: ["deploy/**", ".gitattributes", "client/test/deploy-vps.test.mjs", "client/test/deploy-volume.test.mjs", "client/test/installateur.test.mjs", "client/test/update-site.test.mjs", "client/test/serveur-livraison.test.mjs"]
user-invocable: false
---
# Hébergement (`deploy/`)

## Fichiers
- Installateurs (le site en ligne) : `deploy/installateur/installateur.sh` (modèle), `fabriquer.mjs` → un installateur `.sh` autonome par livraison, mode prod (serveur normal) ou test (copie le `db/` du serveur normal à l'installation) ; `mise-a-jour.sh` exécute le dernier du mode de l'instance ; `fabriquer.sh prod|test` à la main ; `docker-compose.yml`.
- VPS des deux instances : `deploy/vps/durcir.sh`, `outils.sh`, `instances.sh`, `volume.sh`, `Caddyfile`, `README.md` pas à pas (dont « 7. Site de dev : mode modification et page Mise à jour » : `MAVERICK_EDITION`, `MAVERICK_ADRESSE_PUBLIQUE`, les deux jetons).
- Paquet du NAS (installation à la main) : nginx + service des personnages dans Docker, mot de passe ; `deploy/build.sh` (le zip), `deploy/update-site.sh` (installe la branche `site` dans un dossier ; la livraison ne la reconstruit plus : elle publie des installateurs), `deploy/docker-compose.yml`, `deploy/README.md`. Une installation existante garde sa copie `update-nas.sh`.
- `deploy/nginx.conf` : commun au NAS et aux installateurs.
- Le service lui-même : skill `zone-service`. Maintenance et dossier partagé `maintenance/` : skill `zone-mise-a-jour`. Métriques et `volume.sh` : skill `zone-debug-metriques`. Versions, releases et branche `site` : `docs/flux-git.md`.

## À lire
- `deploy/installateur/README.md` (instances, `db/`, mise à jour automatique), `deploy/vps/README.md` (mise en place du VPS), `deploy/README.md` (NAS).

## Choix du propriétaire
- Les docs de l'hébergement décrivent le fonctionnement tel qu'il est, sans « à partir de la X » ni « avant la X » (demande du 2026-10-22) : ce qui ne sert plus se dit comme tel ou sort de la doc.
- `docs/serveur.md`, « Hébergement » (conteneurs, variables d'environnement, surveillance, sortie sur Internet).

## Invariants
- Les `.sh` et tout `deploy/` restent en LF (`.gitattributes` : `*.sh` et `deploy/**` en `eol=lf`) : ils partent tels quels sur un serveur Linux, même depuis un clone Windows.
- Deux conteneurs dans chaque `docker-compose.yml` (NAS et installateurs) : nginx et `serveur` (`node:22-alpine`, exécute `site/_serveur/serveur/index.mjs`, port 8787 sans port publié).
- `deploy/nginx.conf` transmet `/api/` (adresse résolue à chaque requête, `proxy_connect_timeout 5s` : nginx démarre sans le service, et `/api/` répond 502 s'il est arrêté) et répond 404 sur `/_serveur/` (code du service, jamais servi).
- Le service se relance seul quand `version.json` change (code 0, `restart: unless-stopped`). Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d`.
- L'installateur de test remplace le contenu de `db/`, jamais le dossier : il est monté dans le conteneur, qui rouvre la base. Avec `MAVERICK_BASE_TEST=conservee` dans le `.env`, la copie n'est faite qu'à la première installation.
- Un installateur de test refuse un dossier de production et inversement. L'installateur ne touche jamais aux métriques.
- Journaux des conteneurs : pilote `json-file`, 5 fichiers de 10 Mo au plus par conteneur (`logging` de chaque service des deux `docker-compose.yml`).

## VPS
- `instances.sh` pose les dossiers et le `.env` de chaque instance : ports sur `127.0.0.1` (Docker contourne ufw : seul Caddy les atteint), `MAVERICK_BASE_TEST=conservee`, `MAVERICK_EDITION=1` et `MAVERICK_DOSSIER_MAINTENANCE` (le `maintenance/` du serveur normal) pour le test ; mots de passe internes présentés par Caddy à la place des visiteurs.
- `Caddyfile` : `maverick-jdr.com` → 8080 (serveur normal, `master`), `dev.maverick-jdr.com` → 8081 (serveur de test, `dev`), `www.` → domaine principal.
- Accès pour le PoC (décision du propriétaire) : pas de mot de passe visible, adresse non référencée (`X-Robots-Tag`, `robots.txt`). Le contenu appartient au propriétaire du jeu : ne pas désactiver la protection ni la non-indexation sans son accord.
- `PREMIERE_VERSION_HEBERGEE` (`tools/flux-git/regles.mjs`, 0.2.0) : en dessous, `livrableDe` choisirait la branche `site` ; dev et master l'ont dépassée, seuls les installateurs sont publiés.

## Tests
- `deploy-vps` (`instances.sh` : dossiers partagés de la maintenance et des métriques, une instance par fichier, minuteur du relevé de l'hôte ; l'étape « Site de dev » du README), `deploy-volume` (rotation des journaux Docker, métriques hors de `db/`, `volume.sh`), `installateur` (contenu de `db/` remplacé, dossier gardé, métriques jamais copiées ni effacées), `update-site` (contre un faux serveur GitHub), `serveur-livraison` (`docker-compose.yml` et `nginx.conf` cohérents).

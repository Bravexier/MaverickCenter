# Héberger le site sur un NAS

Le site est un dossier de pages statiques, servi par nginx, accompagné d'un petit **service** (Node) qui enregistre les fiches de personnages
dans sa base, `db/` (mode client / serveur : [`docs/serveur.md`](../docs/serveur.md)). Le code du service arrive avec le site (`site/_serveur/`).
Ce dossier contient tout pour les faire tourner dans Docker (Synology *Container Manager*, QNAP *Container Station*, Unraid, TrueNAS, ou tout hôte
Docker) : deux conteneurs, `maverick-center` (nginx) et `maverick-center-serveur` (le service).

> Ce paquet installe le site à la main, avec le zip que fabrique `./deploy/build.sh`. Le site en ligne, lui (serveur normal
> `maverick-jdr.com` et serveur de test `dev.maverick-jdr.com`), est posé par les installateurs autonomes de [`installateur/`](installateur/README.md)
> sur le serveur décrit dans [`vps/`](vps/README.md), et s'y met à jour seul après chaque fusion.

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

## Démarrage (avec Docker)

1. Décompressez `maverick-center-nas.zip` dans un dossier du NAS, par exemple `docker/maverick-center/`.
2. Créez le fichier de mots de passe (remplacez `invite` et `MotDePasse` ; `openssl` suffit) :
   ```bash
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd
   ```
   Plusieurs comptes : ajoutez une ligne par compte avec `>>`.
3. Lancez : `docker compose up -d`, puis ouvrez `http://IP-DU-NAS:8080` et connectez-vous.

Sur Synology : *Container Manager → Projet → Créer*, choisissez le dossier décompressé : il détecte `docker-compose.yml`.

Le dossier `db/` (créé au premier lancement) contient la base vivante du service : **les fiches enregistrées**. C'est la seule donnée qui ne se
reconstruit pas : sauvegardez-le (par exemple avec *Hyper Backup*), de préférence conteneur `maverick-center-serveur` arrêté. Le service y range
aussi ses métriques (`db/metriques/prod.db` : temps de réponse, pages, serveur ; [`docs/serveur.md`](../docs/serveur.md), « Métriques et
volume »), qui se perdent sans dommage. Les journaux des conteneurs tournent (5 fichiers de 10 Mo au plus par conteneur). Vérifier le service :
`http://IP-DU-NAS:8080/api/etat/` affiche son état (`"disponible":true`).

## Sans Docker

Servez le dossier `site/` avec le serveur web du NAS (Synology *Web Station*, par exemple) et activez un mot de passe
d'accès dans ses réglages : la lecture fonctionne. L'enregistrement des fiches demande en plus le service (Node.js ≥ 22.13 :
`node site/_serveur/serveur/index.mjs`, voir ses variables dans `docs/serveur.md`) et un renvoi de `/api/` vers lui (port 8787).

## Accès depuis l'extérieur du réseau local

N'ouvrez pas simplement un port du routeur vers le NAS. Préférez, par ordre de simplicité :
un VPN du type **Tailscale** (le propriétaire installe l'application et voit le site comme s'il était chez vous),
un **Cloudflare Tunnel**, ou le **proxy inversé du NAS avec HTTPS** (certificat Let's Encrypt) en gardant le mot de passe.

## Sous-chemin

Si le site doit répondre sur une adresse du type `https://nas.exemple/maverick/`, reconstruisez-le avec
`SITE_BASE=/maverick/ ./deploy/build.sh` et faites pointer le proxy inversé vers le conteneur.

## Mise à jour

Le paquet ne se met pas à jour seul : après chaque fusion, la livraison (`.github/workflows/livraison.yml`, [`docs/flux-git.md`](../docs/flux-git.md))
publie des installateurs, et ne reconstruit plus la branche `site`. Pour mettre le NAS à jour, construire un nouveau zip (`./deploy/build.sh`) et
remplacer `site/` dans le dossier du projet ; si `docker-compose.yml` ou `nginx.conf` ont changé, les remplacer aussi, puis `docker compose up -d`.
Le service se relance seul sur la nouvelle version de son code et refait sa base sans perdre les fiches.

`update-site.sh` (`update-nas.sh` sur un NAS installé avant son changement de nom), posé dans le zip, installe la branche `site` dans `site/` et peut
tourner toutes les 5 minutes (connexions sortantes seulement, jeton GitHub en lecture dans `.github-token`) : comme cette branche n'avance plus, il
garde le NAS sur la dernière version qu'elle porte. Ce qu'il fait :

- compare la version installée (`.installed-sha`) à la dernière de la branche `site` ; s'il n'y a rien de neuf, il s'arrête ;
- télécharge exactement cette version, refuse une archive vide ou incomplète (pas de `index.html`, moins de 20 pages) et ne touche alors **pas**
  au site en place ;
- remplace le contenu de `site/` (avec `rsync` s'il existe, sinon par copie), sans redémarrer nginx ;
- un jeton expiré ou un problème réseau n'abîme rien : le site reste tel quel et `update.log` indique l'erreur ;
- `sh update-site.sh --force` réinstalle même si la version est déjà à jour ; les réglages (`REPO`, `BRANCH`, `SITE_DIR`…) se placent dans un
  fichier facultatif `update-site.env` à côté du script (à défaut, l'ancien `update-nas.env` est lu).

## Ce qui a été vérifié

Le site statique est construit et testé (tests unitaires, contrôle navigateur). Le script `update-site.sh` est testé contre un
faux serveur GitHub (`client/test/update-site.test.mjs`), le service par `client/test/serveur-*.test.mjs`. `docker-compose.yml` et `nginx.conf` ont été
lancés avec Docker dans l'environnement de développement (le 2026-10-10 : mot de passe, pages, `/api/`, `/_serveur/` refusé, relance du service sur une
nouvelle version, base refaite quand les règles changent, site servi service arrêté).

# Installateurs : serveur normal et serveur de test (à partir de la 0.2.0)

À partir de la 0.2.0 (`PREMIERE_VERSION_HEBERGEE`, décision du propriétaire ; la 1.0 est ensuite l'ouverture à tout le Discord), la solution est hébergée hors du NAS et installée par des
**installateurs** : un script `.sh` autonome par fusion, qui contient le site et l'installe dans le dossier d'une instance, sans téléchargement ni
jeton. Ils sont publiés en *release* GitHub (privée comme le dépôt) par `.github/workflows/livraison.yml` ; voir [`docs/flux-git.md`](../../docs/flux-git.md).
Avant la 0.2.0, rien de tout cela ne sert : le NAS a sa propre installation ([`../README.md`](../README.md), branche `site`).

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

Prérequis sur l'hôte : un hôte Docker (Linux), `sh`, `tar`, `gzip`, et `sha256sum` (ou `shasum` / `openssl`) pour contrôler l'archive ;
`rsync` et `sqlite3` sont utilisés s'ils sont présents (`sqlite3` rend la copie de la base cohérente même pendant une écriture).

| | Serveur normal (production) | Serveur de test |
| --- | --- | --- |
| Installateur | `maverick-center-VX.Y-install.sh` (fusion dans `master` ; `VX.Y-hotfix.N` après un hotfix) | `maverick-center-VX.Y.Z-install.sh` (fusion dans `dev` : la version complète de `dev`, sans suffixe) |
| Dossier conseillé | `/srv/maverick-center` | `/srv/maverick-center-test` (à côté du serveur normal) |
| Adresse | `http://<hôte>:8080` | `http://<hôte>:8081`, bandeau « Serveur de dev » sur chaque page |
| Base vivante `db/` | jamais touchée par une installation | **son contenu est remplacé à chaque installation par une copie de celle du serveur normal, prise à cet instant** (le dossier reste : il est monté dans le conteneur du service, qui rouvre la base). **Sauf** si le `.env` de l'instance contient `MAVERICK_BASE_TEST=conservee` : la copie n'est faite qu'à la première installation (`db/` vide), puis `db/` n'est plus touché, pour que les modifications faites en test durent ([`deploy/vps/`](../vps/README.md) pose ce réglage) |

Une instance = un dossier : `site/` (remplacé à chaque installation, avec le code du service des personnages, `site/_serveur/`), `db/` (base vivante
du service : utilisateurs, fiches, et ce qu'ils font ; voir [`docs/serveur.md`](../../docs/serveur.md)), `docker-compose.yml` (deux conteneurs : nginx et le service),
`nginx.conf`, `.env` (port et nom du conteneur, créé une fois, jamais écrasé), `.htpasswd` (mots de passe, jamais touché), `VERSION` (ce qui est
installé), `installation.log`, et `maintenance/` (créé par Docker : l'annonce « Maintenance en cours » pendant une mise à jour, que le site de dev écrit
et que chaque serveur lit ; le serveur de test prend celui du serveur normal avec `MAVERICK_DOSSIER_MAINTENANCE=<dossier du serveur normal>/maintenance`
dans son `.env` — `deploy/vps/instances.sh` le pose —, sinon la production n'est jamais mise en maintenance ; voir [`docs/serveur.md`](../../docs/serveur.md),
« Maintenance pendant une mise à jour »), et `metriques/` (créé par Docker : la base des métriques du service, `prod.db` ou `dev.db`, une par
instance, jamais mêlées ; le serveur de test y lit aussi celle du serveur normal quand son `.env` donne
`MAVERICK_DOSSIER_METRIQUES=<dossier du serveur normal>/metriques` — `deploy/vps/instances.sh` le pose dans les deux `.env` ; voir
[`docs/serveur.md`](../../docs/serveur.md), « Métriques et volume »). L'installateur ne touche jamais aux métriques : hors de `db/`, et un
`db/metriques/` (service sans dossier réglé) n'est ni copié de la production ni effacé du test. Les journaux des conteneurs (`docker logs`)
tournent : 5 fichiers de 10 Mo au plus par conteneur. Un installateur de test refuse un dossier de production et inversement.

## Installer une version

1. Téléchargez l'installateur depuis la *release* GitHub de la version et copiez-le sur l'hôte.
2. Lancez-le (en `root` ou avec un compte qui peut écrire dans le dossier) :
   ```bash
   sh maverick-center-V1.2-install.sh --dossier /srv/maverick-center                # serveur normal
   sh maverick-center-V1.2.3-install.sh --dossier /srv/maverick-center-test         # test : copie la base du serveur normal voisin
   ```
   Options : `--verifier` (contrôle l'archive et s'arrête), `--dossier-prod <dossier>` (test : serveur normal ailleurs que dans le dossier voisin
   `maverick-center`), `--sans-base-prod` (test sans serveur normal : base vide).
3. **Première installation d'une instance** : créez le fichier de mots de passe, puis lancez le conteneur (l'installateur le rappelle) :
   ```bash
   cd /srv/maverick-center
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd    # une ligne par compte (>> pour ajouter)
   docker compose up -d
   ```

Ordre conseillé la première fois : le serveur normal, puis le serveur de test (qui copie sa base). Les mises à jour suivantes n'ont besoin que de
l'étape 2 : nginx relit les fichiers, et le service se relance seul quand la livraison apporte une nouvelle version de son code (il refait aussi sa
base quand les règles changent, sans perdre les fiches). Port ou nom du conteneur : à changer dans `.env`, puis `docker compose up -d`.

`docker-compose.yml` et `nginx.conf` : une livraison qui les change les remplace si vous ne les avez pas modifiés (l'installateur garde la version
livrée précédente dans `.livre/` pour le savoir) et vous demande `docker compose up -d` ; si vous les avez modifiés sur place, ils sont conservés et
la nouvelle version est écrite à côté (`.nouveau`), à reporter à la main.

**Revenir à une version précédente** : créez d'abord un fichier `GELER` dans le dossier de l'instance (sinon la mise à jour automatique réinstalle la
dernière livraison dans les 5 minutes), puis relancez l'installateur de la version voulue. Supprimez `GELER` une fois une livraison corrigée publiée.

**Revenir sous la migration 0045** (une version d'avant les gains de niveau en deux totaux, l'entraînement et la solidité des armes) : le service
d'avant ne relit pas la base des fiches refaite en 0045 (toute lecture de fiche échoue) et refuse de la reconstruire. Il faut lui remettre
l'archive faite à la reconstruction 0045, et **tout ce que la base a reçu depuis est perdu** : fiches créées, modifiées ou supprimées, gains de
niveau, entraînement et solidité des armes saisis (et, sur le serveur de test, les modifications des règles en attente). Dans le dossier de
l'instance :

1. `touch GELER`, puis sauvegardez la base en place, hors de `db/` : `sqlite3 db/vivante.db ".backup /root/vivante-avant-retour.db"`.
2. Trouvez l'archive, la plus récente de `db/archives/` qui a encore la table `personnage_progression`, et **copiez-la à part tout de suite** :
   seules les 5 dernières archives sont gardées (`ARCHIVES_GARDEES` : au-delà, chaque reconstruction efface la plus ancienne), et l'installateur
   de test remplace le contenu de `db/`.
   ```bash
   for f in db/archives/vivante-*.db; do sqlite3 "$f" ".tables personnage_progression" | grep -q . && echo "$f"; done | tail -1
   cp db/archives/vivante-AAAA-MM-JJT….db /root/vivante-avant-0045.db     # le fichier affiché par la ligne précédente
   ```
   Aucune archive de ce genre : soit la base n'avait ni fiche ni modification en attente à la reconstruction 0045 (à l'étape 4, supprimez alors
   aussi `db/vivante.db` au lieu d'y copier l'archive : le service en refait une vide), soit elle a déjà été effacée, et les fiches d'avant 0045
   ne se retrouvent plus que dans une sauvegarde faite à la main.
3. `docker compose stop serveur`, puis lancez l'installateur de la version voulue.
4. Remettez l'archive à la place de la base, sans ses fichiers voisins ni `vivante.json` (sans lui, le service refait la base pour les règles
   installées, en reprenant les fiches de l'archive) :
   ```bash
   cp /root/vivante-avant-0045.db db/vivante.db
   rm -f db/vivante.db-wal db/vivante.db-shm db/vivante.db-journal db/vivante.json
   ```
5. `docker compose start serveur`, puis vérifiez `/api/etat` (base refaite, sans erreur).

## Mise à jour automatique

`mise-a-jour.sh` (posé dans chaque instance par l'installateur) prend le dernier installateur publié pour le mode de l'instance (lu dans `VERSION`) et
l'exécute s'il n'est pas déjà installé. Connexions sortantes uniquement : aucun port à ouvrir. Il reconnaît les livraisons de son serveur à la
forme de leur étiquette : `VX.Y.Z` (trois nombres, la version de `dev`) pour le serveur de test, `VX.Y` pour le serveur normal.

1. **Jeton GitHub** : *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*, *Repository access* :
   **Only select repositories → MaverickCenter**, *Permissions → Contents : Read-only*. Déposez-le dans chaque dossier d'instance, lisible par `root`
   uniquement (jamais dans une conversation, un fichier du dépôt ou un journal) :
   ```bash
   printf '%s' 'COLLEZ_LE_JETON_ICI' > .github-token && chmod 600 .github-token
   ```
2. **Essai à la main** : `sh mise-a-jour.sh` (journal dans `mise-a-jour.log` ; `--force` réinstalle même si c'est déjà la dernière livraison).
3. **Planifier toutes les 5 minutes**, une tâche par instance : `crontab -e` puis `*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh`
   (et `…/maverick-center-test/mise-a-jour.sh`).

Serveur de test dont le serveur normal n'est pas le dossier voisin `maverick-center` : créez `mise-a-jour.env` à côté du script avec
`DOSSIER_PROD=/chemin/du/serveur-normal` (ou `SANS_BASE_PROD=1` pour un serveur de test sans serveur normal, base vide). Un fichier `GELER` dans le
dossier de l'instance suspend ses mises à jour. Chaque installation automatique du test reprend une copie fraîche de la base du serveur normal.
Un jeton expiré, un problème réseau ou un installateur abîmé n'abîment rien : l'instance reste telle quelle et `mise-a-jour.log` indique l'erreur.

## Fabriquer un installateur à la main

`./deploy/installateur/fabriquer.sh prod` (ou `test`) construit le site sur votre machine (Node.js ≥ 22.12) et écrit l'installateur dans
`deploy/installateur/sortie/` (étiquette `vX.Y.Z-local`).

## Ce qui a été vérifié

Les installateurs sont fabriqués et exécutés par `client/test/installateur.test.mjs` (installation, mise à jour, copie d'une vraie base SQLite en cours
d'écriture, refus) et `mise-a-jour.sh` est testé contre un faux GitHub (`client/test/mise-a-jour.test.mjs`), avec et sans `rsync` et `sqlite3`.
L'hébergement de la 1.0 n'existe pas encore : son premier lancement sera le vrai test de `docker-compose.yml` et de nginx.

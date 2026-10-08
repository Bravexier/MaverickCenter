# Héberger le site (NAS, Docker)

Le site est **100 % statique** : un dossier de fichiers HTML servi par nginx dans Docker (Synology *Container Manager*, QNAP *Container Station*,
Unraid, TrueNAS, ou tout hôte Docker).

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

**Deux époques** (voir [`docs/flux-git.md`](../docs/flux-git.md)) : **avant la 1.0**, un seul site, qui suit la branche `site` (reconstruite depuis
`dev` après chaque fusion) ; **à partir de la 1.0** (signal du propriétaire, avec la connexion Discord), un serveur normal et un serveur de test,
installés par des scripts publiés à chaque fusion. Le passage est décrit plus bas, « Le jour de la 1.0 ».

---

## Avant la 1.0 : un seul site (fonctionnement actuel)

### Démarrage (avec Docker)

1. Construisez le paquet : `./deploy/build.sh` (Node.js ≥ 22.12) produit `deploy/maverick-center-nas.zip`.
2. Décompressez `maverick-center-nas.zip` dans un dossier du NAS, par exemple `docker/maverick-center/`.
3. Créez le fichier de mots de passe (remplacez `invite` et `MotDePasse` ; `openssl` suffit) :
   ```bash
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd
   ```
   Plusieurs comptes : ajoutez une ligne par compte avec `>>`.
4. Lancez : `docker compose up -d`, puis ouvrez `http://IP-DU-NAS:8080` et connectez-vous.

Sur Synology : *Container Manager → Projet → Créer*, choisissez le dossier décompressé : il détecte `docker-compose.yml`.
Port ou nom du conteneur : un fichier `.env` à côté de `docker-compose.yml` (`MAVERICK_PORT=8090`, `MAVERICK_CONTENEUR=…`).

Sous-chemin (`https://nas.exemple/maverick/`) : `SITE_BASE=/maverick/ ./deploy/build.sh`, et faites pointer le proxy inversé vers le conteneur.

### Mise à jour automatique après chaque fusion dans `dev`

```
PR fusionnée dans dev ──▶ GitHub Actions : version, tests, construction ──▶ branche « site » (privée)
                                                                                 ▲
                                NAS : update-nas.sh (toutes les 5 min) ──────────┘  connexions sortantes uniquement
```

Aucun port à ouvrir : c'est le NAS qui interroge GitHub. Le workflow (`.github/workflows/livraison.yml`, job `Site`) refuse de publier si le dépôt
n'est plus privé.

1. **Créer un jeton GitHub** : *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   Propriétaire : votre compte ; *Repository access* : **Only select repositories → MaverickCenter** ;
   *Permissions → Repository permissions → Contents : Read-only*. Durée : 90 jours (à renouveler).
2. **Le déposer sur le NAS**, dans le dossier du projet (celui qui contient `docker-compose.yml`), lisible par `root` uniquement :
   ```bash
   printf '%s' 'COLLEZ_LE_JETON_ICI' > .github-token && chmod 600 .github-token
   ```
   Ne le collez jamais dans une conversation, un fichier du dépôt ou un journal.
3. **Premier essai à la main** : `sh update-nas.sh`. Il télécharge la version publiée et remplace le contenu de `site/` (journal dans `update.log`).
4. **Planifier toutes les 5 minutes** :
   - Synology : *Panneau de configuration → Planificateur de tâches → Créer → Tâche planifiée → Script défini par l'utilisateur*,
     utilisateur `root`, toutes les 5 minutes, commande `sh /volume1/docker/maverick-center/update-nas.sh` (adaptez le chemin) ;
   - autre NAS ou Linux : `crontab -e` puis `*/5 * * * * sh /chemin/vers/update-nas.sh`.

Ce que fait le script : il compare la version installée (`.installed-sha`) à la dernière de la branche `site` et s'arrête s'il n'y a rien de neuf ;
il télécharge exactement cette version, refuse une archive vide ou incomplète (pas de `index.html`, moins de 20 pages) sans toucher au site en place,
puis remplace le contenu de `site/` (avec `rsync` s'il existe, sinon par copie), sans redémarrer nginx. Un jeton expiré ou un problème réseau
n'abîme rien : le site reste tel quel et `update.log` indique l'erreur. `sh update-nas.sh --force` réinstalle même si la version est déjà à jour ;
les réglages (`REPO`, `BRANCH`, `SITE_DIR`…) se placent dans un fichier facultatif `update-nas.env` à côté du script.
Le jeton expire : en créer un nouveau et remplacer le contenu de `.github-token` (le journal le signale : « impossible de lire la dernière version… »).

---

## À partir de la 1.0 : serveur normal et serveur de test

Chaque version est livrée sous la forme d'un **installateur** : un script `.sh` autonome qui contient le site et l'installe dans le dossier d'une instance.

| | Serveur normal (production) | Serveur de test |
| --- | --- | --- |
| Installateur | `maverick-center-vX.Y.Z-install.sh` (fusion dans `master`) | `maverick-center-vX.Y.Z-test-install.sh` (fusion dans `dev`) |
| Dossier conseillé | `/volume1/docker/maverick-center` | `/volume1/docker/maverick-center-test` (à côté du serveur normal) |
| Adresse | `http://IP-DU-NAS:8080` | `http://IP-DU-NAS:8081`, bandeau « Serveur de test » sur chaque page |
| Base vivante `db/` | jamais touchée par une installation | **remplacée à chaque installation par une copie de celle du serveur normal, prise à cet instant** |

Une instance = un dossier : `site/` (remplacé à chaque installation), `db/` (base vivante : utilisateurs, et ce qu'ils font), `docker-compose.yml`,
`nginx.conf`, `.env` (port et nom du conteneur, créé une fois), `.htpasswd` (mots de passe), `VERSION` (ce qui est installé), `installation.log`.
Un installateur de test refuse un dossier de production et inversement.

### Le jour de la 1.0

1. Téléchargez l'installateur `v1.0.0` (*Releases* du dépôt) et lancez-le **dans le dossier actuel du NAS** :
   ```bash
   sh maverick-center-v1.0.0-install.sh --dossier /volume1/docker/maverick-center
   ```
   Il reconnaît l'installation d'avant (un `site/` sans `VERSION`) et en fait le serveur normal : il remplace le site, pose `db/`, `.env`, `VERSION` et
   le nouvel `update-nas.sh`. `.htpasswd` et `.github-token` sont conservés ; si `docker-compose.yml` a été modifié sur place, il est conservé et la
   version livrée est écrite à côté (`docker-compose.yml.nouveau`). La tâche planifiée existante suit désormais les livraisons de production,
   sans autre réglage (le mode est lu dans `VERSION`).
2. Installez le serveur de test à côté (« Installer une version » ci-dessous, avec l'installateur `v1.0.0-test`), puis ajoutez sa tâche planifiée.
3. La branche `site` n'est plus mise à jour : le propriétaire peut la supprimer.

### Installer une version

1. Téléchargez l'installateur depuis la *release* GitHub de la version et copiez-le sur le NAS.
2. Lancez-le (en `root` ou avec un compte qui peut écrire dans le dossier) :
   ```bash
   sh maverick-center-v1.2.0-install.sh --dossier /volume1/docker/maverick-center              # serveur normal
   sh maverick-center-v1.2.3-test-install.sh --dossier /volume1/docker/maverick-center-test    # test (copie la base du serveur normal voisin)
   ```
   Options : `--verifier` (contrôle l'archive et s'arrête), `--dossier-prod <dossier>` (test : serveur normal ailleurs que dans le dossier voisin
   `maverick-center`), `--sans-base-prod` (test sans serveur normal : base vide).
3. **Première installation d'une instance** : créez `.htpasswd` dans son dossier (voir plus haut), puis `docker compose up -d` (l'installateur le rappelle).

Les mises à jour suivantes n'ont besoin que de l'étape 2 : nginx relit les fichiers, aucun redémarrage. Revenir à une version précédente : relancer son
installateur. Port ou nom du conteneur : à changer dans `.env`, puis `docker compose up -d`.

### Mise à jour automatique

`update-nas.sh` (posé dans chaque instance par l'installateur) prend le dernier installateur publié pour le mode de l'instance (lu dans `VERSION`) et
l'exécute s'il n'est pas déjà installé. Même jeton que plus haut (un fichier `.github-token` dans chaque dossier d'instance), même planification
(une tâche par instance). Pour le serveur de test, si le serveur normal n'est pas le dossier voisin `maverick-center`, créez `update-nas.env` :
`DOSSIER_PROD=/chemin/du/serveur-normal`. Chaque installation automatique du test reprend une copie fraîche de la base du serveur normal.
Un jeton expiré, un problème réseau ou un installateur abîmé n'abîment rien : l'instance reste telle quelle et `update.log` indique l'erreur.

### Fabriquer un installateur à la main

`./deploy/build.sh prod` ou `./deploy/build.sh test` construit le site sur votre machine et écrit l'installateur dans `deploy/sortie/`
(étiquette `vX.Y.Z-local`).

---

## Accès depuis l'extérieur du réseau local

N'ouvrez pas simplement un port du routeur vers le NAS. Préférez, par ordre de simplicité :
un VPN du type **Tailscale** (le propriétaire installe l'application et voit le site comme s'il était chez vous),
un **Cloudflare Tunnel**, ou le **proxy inversé du NAS avec HTTPS** (certificat Let's Encrypt) en gardant le mot de passe.

## Sans Docker

Servez le dossier `site/` avec le serveur web du NAS (Synology *Web Station*, par exemple) et activez un mot de passe d'accès dans ses réglages.
Aucun module serveur n'est nécessaire (pas de PHP, pas de base de données).

## Ce qui a été vérifié

`update-nas.sh` est testé contre un faux GitHub dans ses deux fonctionnements : la branche `site` (`client/test/update-nas.test.mjs`, inchangé depuis
avant le flux Git) et les livraisons (`client/test/update-nas-livraisons.test.mjs`, dont le passage d'une installation d'avant à la 1.0). Les
installateurs sont fabriqués et exécutés par `client/test/installateur.test.mjs` (installation, mise à jour, copie d'une vraie base SQLite en cours
d'écriture, refus), avec et sans `rsync` et `sqlite3`. Ni la configuration nginx, ni `docker-compose.yml`, ni le contact avec le vrai GitHub depuis
un NAS n'ont pu être exécutés dans l'environnement de développement : le premier lancement sur le NAS est le vrai test.

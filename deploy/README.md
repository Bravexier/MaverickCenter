# Héberger le site (NAS, Docker)

Le site est **100 % statique** : un dossier de fichiers HTML servi par nginx dans Docker (Synology *Container Manager*, QNAP *Container Station*,
Unraid, TrueNAS, ou tout hôte Docker). Chaque version est livrée sous la forme d'un **installateur** : un script `.sh` autonome qui contient le site et
l'installe dans le dossier d'une instance (voir [`docs/flux-git.md`](../docs/flux-git.md) pour le moment où chacun est fabriqué).

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

## Deux instances : production et test

| | Production | Test |
| --- | --- | --- |
| Installateur | `maverick-center-vX.Y.Z-install.sh` (fusion dans `master`) | `maverick-center-vX.Y.Z-test-install.sh` (fusion dans `dev`) |
| Dossier conseillé | `/volume1/docker/maverick-center` | `/volume1/docker/maverick-center-test` (à côté de la production) |
| Adresse | `http://IP-DU-NAS:8080` | `http://IP-DU-NAS:8081`, bandeau « Serveur de test » sur chaque page |
| Base vivante `db/` | jamais touchée par une installation | **remplacée à chaque installation par une copie de celle de la production, prise à cet instant** |

Une instance = un dossier : `site/` (remplacé à chaque installation), `db/` (base vivante), `docker-compose.yml`, `nginx.conf`, `.env` (port et nom du
conteneur, créé une fois), `.htpasswd` (mots de passe), `VERSION` (ce qui est installé), `installation.log`. Un installateur de test refuse un dossier de
production et inversement.

Aujourd'hui, la production n'a pas encore de base vivante (la base du site est reconstruite à chaque version) : `db/` est vide, et la copie de test aussi.
Elle se remplira quand un service y écrira (édition, fiches de personnages).

## Installer une version

1. Téléchargez l'installateur depuis la *release* GitHub de la version (*Releases* du dépôt) et copiez-le sur le NAS.
2. Lancez-le (en `root` ou avec un compte qui peut écrire dans le dossier) :
   ```bash
   sh maverick-center-v0.2.0-install.sh --dossier /volume1/docker/maverick-center              # production
   sh maverick-center-v0.2.1-test-install.sh --dossier /volume1/docker/maverick-center-test    # test (copie la base de la production voisine)
   ```
   Options : `--verifier` (contrôle l'archive et s'arrête), `--dossier-prod <dossier>` (test : production ailleurs que dans le dossier voisin
   `maverick-center`), `--sans-base-prod` (test sans production : base vide).
3. **Première installation seulement** : créez le fichier de mots de passe, puis lancez le conteneur (l'installateur le rappelle) :
   ```bash
   cd /volume1/docker/maverick-center
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd    # une ligne par compte (>> pour ajouter)
   docker compose up -d
   ```
   Sur Synology : *Container Manager → Projet → Créer*, choisissez le dossier de l'instance : il détecte `docker-compose.yml`.

Les mises à jour suivantes n'ont besoin que de l'étape 2 : nginx relit les fichiers, aucun redémarrage. Revenir à une version précédente : relancer son
installateur. Si `docker-compose.yml` ou `nginx.conf` ont été modifiés sur place, ils sont conservés et la version livrée est écrite à côté (`.nouveau`).
Port ou nom du conteneur : à changer dans `.env`, puis `docker compose up -d`.

## Mise à jour automatique

`update-nas.sh` (posé dans chaque instance par l'installateur) regarde les livraisons GitHub et exécute le dernier installateur de son mode s'il n'est pas
déjà installé. Aucun port à ouvrir : c'est le NAS qui interroge GitHub.

```
PR fusionnée ──▶ GitHub Actions : version, tests, construction ──▶ release privée (installateur)
                                                                         ▲
                       NAS : update-nas.sh (toutes les 5 min) ───────────┘  connexions sortantes uniquement
```

1. **Créer un jeton GitHub** : *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   *Repository access* : **Only select repositories → MaverickCenter** ; *Permissions → Repository permissions → Contents : Read-only*. Durée : 90 jours (à renouveler).
2. **Le déposer dans le dossier de l'instance**, lisible par `root` uniquement (jamais dans une conversation, un fichier du dépôt ou un journal) :
   ```bash
   printf '%s' 'COLLEZ_LE_JETON_ICI' > .github-token && chmod 600 .github-token
   ```
3. **Instance de test** : créer `update-nas.env` dans son dossier :
   ```bash
   MODE=test
   DOSSIER_PROD=/volume1/docker/maverick-center    # facultatif si la production est le dossier voisin « maverick-center »
   ```
   (sans ce fichier, le mode est `prod`).
4. **Essai à la main** : `sh update-nas.sh` (journal dans `update.log` ; `--force` réinstalle même si c'est déjà la dernière livraison).
5. **Planifier toutes les 5 minutes**, une tâche par instance :
   - Synology : *Panneau de configuration → Planificateur de tâches → Créer → Tâche planifiée → Script défini par l'utilisateur*,
     utilisateur `root`, commande `sh /volume1/docker/maverick-center/update-nas.sh` (et `…/maverick-center-test/update-nas.sh`) ;
   - autre NAS ou Linux : `crontab -e` puis `*/5 * * * * sh /chemin/vers/update-nas.sh`.

Un jeton expiré, un problème réseau ou un installateur abîmé n'abîment rien : l'instance reste telle quelle et `update.log` indique l'erreur. Chaque
installation automatique du test reprend une copie fraîche de la base de la production.

## Passer de l'ancienne mise à jour (branche `site`)

L'ancien `update-nas.sh` téléchargeait la branche `site`, qui n'est plus publiée. Dans le dossier de l'installation actuelle (celui qui contient `site/`
et `docker-compose.yml`) :

1. Lancez l'installateur de production avec `--dossier` sur ce dossier : il reconnaît l'ancienne installation, remplace le site, pose `db/`, `.env`,
   `VERSION` et le nouvel `update-nas.sh`. Votre `docker-compose.yml` est conservé (la nouvelle version, qui lit `.env`, est dans `docker-compose.yml.nouveau`).
2. La tâche planifiée existante continue de fonctionner (même chemin de script) et suit désormais les livraisons de production.
3. Pour le serveur de test : un second dossier, voir « Installer une version » et l'étape 3 ci-dessus. Les deux conteneurs tournent côte à côte (ports 8080 et 8081).

## Fabriquer un installateur à la main

`./deploy/build.sh` (production) ou `./deploy/build.sh test` construit le site sur votre machine (Node.js ≥ 22.12) et écrit l'installateur dans
`deploy/sortie/` (étiquette `vX.Y.Z-local`). Sous-chemin (proxy inversé sur `/maverick/`) : `SITE_BASE=/maverick/ ./deploy/build.sh`.

## Accès depuis l'extérieur du réseau local

N'ouvrez pas simplement un port du routeur vers le NAS. Préférez, par ordre de simplicité :
un VPN du type **Tailscale** (le propriétaire installe l'application et voit le site comme s'il était chez vous),
un **Cloudflare Tunnel**, ou le **proxy inversé du NAS avec HTTPS** (certificat Let's Encrypt) en gardant le mot de passe.

## Sans Docker

Servez le dossier `site/` de l'instance avec le serveur web du NAS (Synology *Web Station*, par exemple) et activez un mot de passe d'accès dans ses
réglages. Aucun module serveur n'est nécessaire (pas de PHP, pas de base de données).

## Ce qui a été vérifié

Les installateurs sont fabriqués et exécutés par les tests (`client/test/installateur.test.mjs` : installation, mise à jour, copie d'une vraie base SQLite
en cours d'écriture, refus) et `update-nas.sh` est testé contre un faux GitHub (`client/test/update-nas.test.mjs`), avec et sans `rsync` et `sqlite3`.
Ni la configuration nginx, ni `docker-compose.yml`, ni le contact avec le vrai GitHub depuis un NAS n'ont pu être exécutés dans l'environnement de
développement : le premier lancement sur le NAS est le vrai test.

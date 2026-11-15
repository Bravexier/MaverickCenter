# Hébergement sur un serveur (VPS) : serveur normal et serveur de test

Met en place, sur un serveur Ubuntu/Debian neuf (écrits pour Ubuntu 26.04 chez Infomaniak, où ils ont été lancés pour la première fois le 2026-10-10 avec les paquets de la distribution :
Docker 29.1, Caddy 2.6.2 ; `instances.sh` est aussi exécuté par les tests, avec de faux outils), les deux instances décrites dans [`docs/flux-git.md`](../../docs/flux-git.md) :

| | Adresse | Branche | Port interne | Base `db/` |
| --- | --- | --- | --- | --- |
| **Serveur normal** | `https://maverick-jdr.com` | `master` | `127.0.0.1:8080` | `/srv/maverick-center/db`, jamais touchée par une installation |
| **Serveur de test** | `https://dev.maverick-jdr.com` | `dev` | `127.0.0.1:8081` | `/srv/maverick-center-test/db` : **la sienne**, jamais vidée ni remplacée par une installation ; la copie de celle du normal ne se pose que sur demande (`--copier-base-prod`, `db/` vide) |

Le site est posé par les [installateurs](../installateur/README.md) (un par fusion, publiés en *release* GitHub par
`.github/workflows/livraison.yml`). Caddy fait le HTTPS et aiguille vers l'instance selon l'adresse.

**Accès pour le PoC (décision du propriétaire)** : pas de mot de passe, adresse non référencée (en-tête `X-Robots-Tag`, `robots.txt`), comme les
Google Docs actuels. Les instances restent protégées en interne par un mot de passe que **Caddy présente à la place des visiteurs** : ils ne le
voient pas, mais les ports 8080 et 8081 ne servent à rien en direct. À la connexion Discord, on retire ce mécanisme (voir l'en-tête du `Caddyfile`).

| Fichier | Rôle |
| --- | --- |
| `durcir.sh` | Mises à jour de sécurité automatiques, SSH par clé uniquement, pare-feu (22, 80, 443), fail2ban |
| `outils.sh` | Docker (+ compose), Caddy, `robots.txt` |
| `instances.sh` | Les deux dossiers d'instance (`.env` avec ports sur `127.0.0.1`), dossiers partagés de la maintenance et des métriques, mots de passe internes, `Caddyfile` et son environnement, minuteur de `volume.sh` |
| `volume.sh` | Répartition du disque par type de données, vue de l'hôte (les deux instances, Docker, journaux, restes d'installation) : `metriques/volume-hote.json`, toutes les 15 minutes (jauge de la page Debug) |
| `Caddyfile` | `maverick-jdr.com` → 8080, `dev.maverick-jdr.com` → 8081, `www.` → domaine principal |

## Avant de commencer

1. **DNS** (OVH, zone de `maverick-jdr.com`) : des enregistrements **A** (IPv4) et **AAAA** (IPv6) vers le serveur pour le domaine lui-même, `www` et **`dev`**.
   Caddy obtient son certificat HTTPS seulement quand l'adresse pointe vers le serveur (sinon il réessaie sans succès).
2. **Accès SSH par clé** au serveur (compte `ubuntu` chez Infomaniak).
3. **Pare-feu de l'hébergeur** : il filtre avant le serveur, `durcir.sh` ne règle que celui du serveur (`ufw`). Chez Infomaniak (Manager → le serveur →
   *Régler le Firewall*), seuls le SSH (22) et le ping étaient ouverts au départ (constaté le 2026-10-10). **Ajouter une règle TCP pour les ports 80 et 443**
   (et UDP 443 pour HTTP/3), pour toutes les adresses, sans toucher à la règle du 22. Sans cela, Caddy n'obtient aucun certificat.
4. Ces fichiers sur votre ordinateur (cloner le dépôt, ou télécharger la branche en zip).

## 1. Copier ce dossier sur le serveur

Depuis votre ordinateur, dans le dossier du dépôt (Windows : invite de commandes ; `scp` est fourni avec Windows) :

```
scp -i .ssh\maverick_key -r deploy\vps ubuntu@<IP>:~/
```

Puis, sur le serveur : `ssh -i .ssh\maverick_key ubuntu@<IP>`.

## 2. Durcir le serveur

```
sudo bash ~/vps/durcir.sh
```

**Gardez cette fenêtre ouverte**, ouvrez-en une deuxième et vérifiez qu'une **nouvelle** connexion par clé fonctionne avant de fermer la première.
Le script refuse de désactiver le mot de passe s'il ne trouve aucune clé installée. S'il annonce à la fin qu'un redémarrage est demandé par les
mises à jour, le faire quand vous êtes prêt (`sudo reboot`) : Docker, Caddy et les conteneurs sont relancés au démarrage.

## 3. Installer Docker et Caddy

```
sudo bash ~/vps/outils.sh
```

## 4. Préparer les deux instances et Caddy

```
sudo bash ~/vps/instances.sh
```

Les mots de passe internes sont créés au hasard, écrits dans `/etc/caddy/maverick.env` (lisible par root seulement) et dans le `.htpasswd` de
chaque instance ; rien n'est affiché. Relancer le script les conserve (`--regenerer-acces` pour les refaire). Autre domaine : `--domaine exemple.org`.

## 5. Poser le site (les deux installateurs)

1. Dans GitHub, page **Releases** du dépôt (public depuis le 2026-10-14), télécharger les deux fichiers de la dernière version :
   `maverick-center-VX.Y-install.sh` (normal) et `maverick-center-VX.Y.Z-install.sh` (test : la version complète de `dev`).
2. Les copier sur le serveur : `scp -i .ssh\maverick_key maverick-center-*-install.sh ubuntu@<IP>:~/`
3. Sur le serveur, le normal d'abord (le serveur de test démarre avec une base vide, que le service crée à partir des règles du site ; pour partir d'une copie de la base du normal, ajouter `--copier-base-prod` à la commande du test) :

```
sudo sh ~/maverick-center-VX.Y-install.sh --dossier /srv/maverick-center
sudo sh ~/maverick-center-VX.Y.Z-install.sh --dossier /srv/maverick-center-test
cd /srv/maverick-center && sudo docker compose up -d
cd /srv/maverick-center-test && sudo docker compose up -d
```

Ouvrir `https://maverick-jdr.com` et `https://dev.maverick-jdr.com` (bandeau « Serveur de dev »).

## 6. Mises à jour automatiques

Chaque instance contient `mise-a-jour.sh` : il prend la dernière *release* de son mode et l'installe. Il lui faut un jeton GitHub en lecture seule
(*Settings → Developer settings → Fine-grained tokens*, dépôt `MaverickCenter` seulement, permission *Contents : Read-only*), **déposé directement
sur le serveur** (jamais dans une conversation ni dans git) :

```
sudo sh -c "printf '%s' 'COLLEZ_LE_JETON_ICI' > /srv/maverick-center/.github-token && chmod 600 /srv/maverick-center/.github-token"
sudo sh -c "printf '%s' 'COLLEZ_LE_JETON_ICI' > /srv/maverick-center-test/.github-token && chmod 600 /srv/maverick-center-test/.github-token"
sudo sh /srv/maverick-center/mise-a-jour.sh          # essai à la main (journal : mise-a-jour.log)
sudo crontab -e                                       # puis ajouter :
*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh
*/5 * * * * sh /srv/maverick-center-test/mise-a-jour.sh
```

Chaque fusion dans `dev` met à jour le serveur de test dans les 5 minutes, chaque livraison `dev` → `master` met à jour le serveur normal. La base du
test n'est pas touchée par ces mises à jour ; celle du normal non plus. Un fichier `GELER` dans le dossier d'une instance suspend ses mises à jour.

## 7. Site de dev : mode modification et page Mise à jour

`instances.sh` pose dans le `.env` du serveur de test `MAVERICK_EDITION=1` (le **mode modification** : crayon sur les pages ;
[`docs/serveur.md`](../../docs/serveur.md), « Édition ») et `MAVERICK_ADRESSE_PUBLIQUE` (l'adresse où GitHub télécharge le lot d'une mise à jour),
et crée son dossier `secrets/`. Le serveur normal n'a jamais ces réglages : ses pages ne se modifient pas.

La **page « Mise à jour »** du site de dev (bouton « Effectuer la mise à jour » ; [`docs/serveur.md`](../../docs/serveur.md), « Mise à jour »)
a besoin de deux jetons, **jamais dans une conversation ni dans git** :

- **dans GitHub** (une fois pour le dépôt) : *Settings → Developer settings → Fine-grained tokens*, un jeton d'un administrateur du dépôt,
  dépôt `MaverickCenter` seulement, permissions *Contents*, *Pull requests* et *Workflows* en lecture et écriture ; l'enregistrer dans le
  dépôt, *Settings → Secrets and variables → Actions → New repository secret*, sous le nom **`MISE_A_JOUR_TOKEN`**. C'est lui qui pousse la
  branche, ouvre et fusionne les deux PR (le jeton d'un workflow ne déclencherait ni la CI ni la livraison) ; seul le job `livrer` du
  workflow le reçoit, sans npm ni dépendance (le job `preparer`, qui lance les tests, n'a aucun secret) ;
- **sur le serveur** : un second jeton fine-grained, dépôt `MaverickCenter` seulement, permission *Actions* en lecture et écriture (rien
  d'autre : il ne fait que lancer et suivre le workflow). Depuis votre ordinateur (invite de commandes ou PowerShell), lancer la commande, coller
  le jeton, puis Entrée : il ne s'affiche pas et n'entre dans aucun historique.

  ```
  ssh -t -i .ssh\maverick_key ubuntu@<IP> "sudo sh -c 'umask 077; stty -echo; head -n 1 > /srv/maverick-center-test/secrets/github-actions-token; stty echo; chmod 600 /srv/maverick-center-test/secrets/github-actions-token; echo; echo Jeton enregistre'"
  ```

Le service relit le fichier à chaque lancement : rien à redémarrer. Sans ce fichier, la page donne les valeurs pour lancer le workflow à la
main (*Actions → Mise à jour des règles → Run workflow*, branche `dev`, case « essai » cochée pour une simulation, décochée sinon : le
workflow refuse un lot figé pour l'autre mode). Avant une vraie mise à jour, une **« Simulation de mise à jour »** (bouton à côté) fait tout le
travail sans rien pousser : sur GitHub, le lot est rejoué sur `dev` et passe tous les contrôles de la CI, puis le job `livrer` vérifie le commit,
son application sur `dev` et le jeton (écriture par un `git push --dry-run`, lecture des PR). Seuls les droits *Pull requests* et *Workflows* en
écriture du jeton ne peuvent pas se vérifier sans effet de bord (le résumé du run le rappelle).

**Mot de passe du site de dev** (décision du propriétaire, R275 : « un mot de passe pour modifier et pour lancer une mise à jour ; la lecture reste ouverte »).
Sans réglage, le site de dev se comporte comme avant. Pour en poser un, une commande depuis le serveur, à saisir au clavier (deux fois, sans écho) :

```
sudo sh /srv/maverick-center-test/acces/acces.sh
```

Elle pose le mot de passe (10 caractères au moins) dans `secrets/acces.json` (le service le relit tout seul : rien à redémarrer) et, la première fois, affiche
**une seule fois** la **clé de lecture** : à donner aux sessions de Claude (en-tête `X-Maverick-Cle` ou `X-Maverick-Key`) pour lire le journal d'édition, la page Debug et l'API
`/api/v1/`, jamais pour écrire. Relancer la même commande change le mot de passe (la clé est gardée, les sessions ouvertes sont fermées). Options :
`--cle` (une clé de lecture neuve), `--portee tout` (option c : le même mot de passe pour tout le site, voir le Caddyfile), `--etat`, et
`--retirer` (le site de dev redevient ouvert, comme avant). Elle refuse la production et n'a pas besoin de l'ancien mot de passe : on ne s'enferme jamais dehors.
Le workflow GitHub n'y gagne ni ne perd rien : il ne télécharge que le lot figé (`/api/mise-a-jour/lots/<uuid>/`), qui reste ouvert ; aucune clé d'écriture
n'est donnée à GitHub. Détail : [`docs/serveur.md`](../../docs/serveur.md), « Accès au site de dev ».

## 8. Maintenance pendant une mise à jour

Pendant une vraie mise à jour (bouton « Effectuer la mise à jour » du site de dev, pas la simulation), **les deux sites affichent « Maintenance en
cours »** et chacun rouvre de lui-même dès que sa nouvelle version y tourne ([`docs/serveur.md`](../../docs/serveur.md), « Maintenance pendant une
mise à jour »). Le service du serveur de test écrit l'annonce dans `/srv/maverick-center/maintenance/`, que les deux instances montent
(`docker-compose.yml`) : `instances.sh` (étape 4) crée ce dossier et pose `MAVERICK_DOSSIER_MAINTENANCE` dans le `.env` du test.

**Contenu de la production lu par le site de dev** (onglet « Mise à jour » de `docs/serveur.md`) : le `docker-compose.yml` monte le `site/` du serveur normal
en lecture seule sur `/production` (par défaut `../maverick-center/site`, vrai sur le VPS ; `instances.sh` pose aussi `MAVERICK_DOSSIER_PRODUCTION` dans le
`.env` du test). Un `docker-compose.yml` livré qui change n'est appliqué que par une commande à lancer à la main dans le dossier de l'instance (l'installateur
le dit dans son journal), **une seule fois pour ce montage** :

```bash
cd /srv/maverick-center-test
docker compose config -q && docker compose up -d          # config -q : la syntaxe seulement ; up -d ne recrée que le conteneur « serveur »
docker compose exec serveur ls /production/donnees/maverick.db /production/_serveur/version.json     # les deux fichiers doivent s'afficher
```

Puis, sur le site de dev, l'onglet « Mise à jour » dit « contenu publié par la production » (au lieu de « copie de master tirée du dépôt »). Tant que le
montage manque, l'onglet continue avec la copie de master et le dit : rien ne casse avant cette commande. Retour en arrière si le site de dev ne repart pas :
retirer du `docker-compose.yml` de l'instance la ligne `MAVERICK_PRODUCTION` et la ligne de volume `:/production:ro`, puis `docker compose up -d` (l'installation
ne garde pas l'ancienne version du fichier : `.livre/` reçoit la nouvelle). L'instance de production n'a rien à lancer : son service n'utilise pas ce montage.
Le NAS (`deploy/docker-compose.yml`) n'a ni ce montage ni la page de mise à jour (elle n'existe que sur le site de dev) : rien à régler. Une instance de
test dont le dossier voisin `maverick-center/site` n'existe pas : Docker crée un dossier vide à cet endroit, et la page retombe sur la copie de master ;
`MAVERICK_DOSSIER_PRODUCTION` dans son `.env` désigne le vrai `site/` de la production. Ce dossier ne doit jamais être le `site/` de l'instance elle-même :
le service refuse alors la production (« base de ce site même ») et la page garde la copie de master.

Une maintenance qui ne finit pas (installateur bloqué, fichier `GELER`) : bouton **« Lever la maintenance (les deux sites) »** sur
`https://dev.maverick-jdr.com/maintenance/` ; elle se lève d'elle-même 4 h après le lancement.

## 9. Métriques et espace disque

Le service de chaque instance mesure ses temps de réponse, ses pages et le serveur ([`docs/serveur.md`](../../docs/serveur.md), « Métriques et
volume » ; la page Debug du site de dev les montre). **Deux jeux de données séparés** (décision du propriétaire) : `prod.db` pour le serveur normal,
`dev.db` pour le serveur de test, côte à côte dans `/srv/maverick-center/metriques/`, que les deux instances montent ; chacune n'écrit que le sien,
le site de dev lit aussi celui de la production. Hors de `db/` : l'installateur ne les copie ni ne les efface. `instances.sh` (étape 4)
crée ce dossier, pose `MAVERICK_INSTANCE` et `MAVERICK_DOSSIER_METRIQUES` dans les deux `.env` et installe `volume.sh` et son minuteur
(`maverick-volume.timer`). Les journaux des conteneurs tournent : 5 fichiers de 10 Mo au plus par conteneur (`docker-compose.yml`). La mesure des
pages par le navigateur est active sur les deux sites ; pour la couper sur une instance : `MAVERICK_METRIQUES_PAGES=0` dans son `.env`, puis
`sudo docker compose up -d`.

**Jauge de l'espace disque** (page Debug du site de dev, demande du propriétaire) : chaque service mesure ce qu'il voit de son conteneur ; le
reste (l'autre instance, Docker, les journaux, les restes d'installation) est mesuré depuis le serveur par `volume.sh`, que `instances.sh` installe
dans `/usr/local/lib/maverick-center/` avec le minuteur systemd `maverick-volume.timer` : toutes les 15 minutes, en lecture seule et à basse
priorité, il écrit `/srv/maverick-center/metriques/volume-hote.json` ([`docs/serveur.md`](../../docs/serveur.md), « Jauge de l'espace disque »).
Après une copie plus récente de ce dossier (étape 1), relancer `instances.sh` (sûr à relancer : il garde les mots de passe et repose les réglages des `.env`)
reprend le script ; un `.env` changé, ou un `docker-compose.yml` qu'une livraison a remplacé (l'installateur l'écrit dans `installation.log` :
« docker-compose.yml mis à jour par cette livraison »), s'applique par `sudo docker compose up -d` dans le dossier de l'instance.

**Espace libre** : tout ce qui grossit sur le serveur, combien et jusqu'où, est dans [`docs/serveur.md`](../../docs/serveur.md), « Tout ce qui
grossit sur le serveur ». L'essentiel :

```
df -h /                                                         # espace libre du disque
sudo cat /srv/maverick-center/metriques/volume-hote.json        # répartition par type de données (dernier relevé)
systemctl list-timers maverick-volume.timer                     # dernier et prochain relevé
sudo du -sh /srv/maverick-center*/{site,db,metriques} 2>/dev/null
sudo docker system df                                           # images, conteneurs, journaux compris
```

## 10. Export vers Google Sheets (identifiant client OAuth)

Le bouton **« Exporter »** de la fiche de personnage crée une feuille Google Sheets dans le Drive de la personne connectée
([`docs/character-generator.md`](../../docs/character-generator.md), « Tableur »). Il lui faut un **identifiant client OAuth** de Google, posé au
build : sans lui, le bouton reste grisé (« Export vers Google Sheets pas encore configuré »). Rien à faire sur le serveur lui-même. À faire une
fois, par le propriétaire, avec son compte Google :

1. <https://console.cloud.google.com/> : **créer un projet** (par exemple « Maverick Center »).
2. *API et services › Bibliothèque* : **activer « Google Drive API »** (sans elle, Google refuse l'envoi : « HTTP 403 » dans le message de la page).
3. *Écran de consentement OAuth* (« Google Auth Platform ») : type d'utilisateurs **Externe** ; nom de l'application, adresse de contact ;
   domaine autorisé `maverick-jdr.com` ; accès demandé : `https://www.googleapis.com/auth/drive.file` (le site ne voit que les fichiers qu'il crée :
   un accès « non sensible », sans validation de Google). Puis **publier l'application (« En production »)** : en mode « Test », seuls les
   comptes déclarés comme testeurs peuvent se connecter.
4. *Identifiants › Créer des identifiants › ID client OAuth* : type **« Application Web »** ; **origines JavaScript autorisées** :
   `https://maverick-jdr.com`, `https://dev.maverick-jdr.com` et `http://localhost:4321` (développement) ; aucune URI de redirection.
5. Copier l'**ID client** (`<numéro>-<texte>.apps.googleusercontent.com`). Il est public (il est écrit dans la page) : ce n'est pas un secret, et
   le « code secret du client » ne sert pas.
6. GitHub : *Settings › Secrets and variables › Actions › onglet Variables › New repository variable* : nom **`GOOGLE_CLIENT_ID`**, valeur l'ID
   client. `.github/workflows/livraison.yml` le passe aux builds des sites (`SITE_GOOGLE_CLIENT_ID`) : il est pris en compte à la **livraison
   suivante** (serveur de test puis serveur normal). À la main : `SITE_GOOGLE_CLIENT_ID=<ID client> ./deploy/installateur/fabriquer.sh prod` ;
   en développement : `SITE_GOOGLE_CLIENT_ID=<ID client> npm run dev`.
7. Vérifier sur `https://dev.maverick-jdr.com/fiche/` : enregistrer une fiche, « Exporter » (la fenêtre de Google s'ouvre, puis « Feuille Google
   créée » et le lien), partager la feuille par lien, puis « Importer (en ligne) » avec ce lien.

« **Importer (en ligne) »** ne demande aucun réglage : le service de chaque instance télécharge lui-même la feuille partagée par lien
(`docs.google.com`, `*.googleusercontent.com` en HTTPS : le pare-feu du serveur laisse sortir ; bornes de taille, de délai et de débit :
[`docs/serveur.md`](../../docs/serveur.md), « Hébergement »).

## Vérifier

```
curl -sI https://maverick-jdr.com | head -n 3             # HTTP/2 200
curl -sI https://dev.maverick-jdr.com | head -n 3         # HTTP/2 200, cache-control: no-store
curl -s https://maverick-jdr.com/robots.txt               # Disallow: /
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://<IP>:8080/   # doit échouer : le port est fermé de l'extérieur
sudo docker ps                                            # les 4 conteneurs (nginx et service, normal et test)
sudo systemctl status caddy
df -h /                                                   # espace libre (étape 9)
```

## Sauvegardes (à faire avant d'y mettre de vraies données)

La base de chaque instance (`db/` : fiches, comptes, et pour le site de dev les modifications des règles) est la seule donnée qui ne se reconstruit
pas ([`docs/serveur.md`](../../docs/serveur.md), « Sauvegardes automatiques » : le détail, les réglages, la forme de l'état). Deux temps, posés par
**une seule commande**, lancée une fois sur le serveur :

```
sudo sh /srv/maverick-center-test/sauvegarde/installer.sh
```

Le dossier `sauvegarde/` est posé par l'installateur du site de dev (à chaque fusion dans `dev`, dans les cinq minutes : `mise-a-jour.sh`) ; les
scripts se mettent donc à jour tout seuls, sans `scp` ni geste. La commande demande son mot de passe `sudo` et rien d'autre tant que le temps 2 n'est pas
voulu.

1. **Temps 1, copies locales** (sans stockage extérieur, la commande les pose seule). Un minuteur copie toute la base des deux sites, de façon
   cohérente (interface de sauvegarde de SQLite, connexion en lecture seule : le contenu de `db/` n'est jamais modifié et rien n'y est créé ; seule exception, un `-wal` resté sans son `-shm` après un arrêt brutal, que SQLite doit alors rouvrir), **chaque heure où elle a changé** et **chaque nuit** (3 h 30), dans
   `/srv/maverick-sauvegardes` (root seul : les fiches y sont). Chaque copie est contrôlée (`integrity_check`, nombre de lignes de chaque table
   comparé à la copie précédente). Une **chute anormale** (une table de 20 lignes ou plus qui en perd plus de 20 %) ou une base abîmée met la nouvelle copie
   de côté (`suspectes/`), garde les anciennes sans les remplacer ni les tourner, et alerte (page Debug). Un plafond de place (4 Go pour toutes les
   copies) et un espace libre minimal (3 Go) protègent le disque partagé avec la production : au-delà, les plus anciennes copies partent d'abord (jamais les deux
   dernières de chaque sorte), puis plus rien n'est écrit et l'alerte le dit. Gardées : 24 copies horaires et 7 de nuit par instance.
   Les copies mises de côté (`suspectes/`) **ne partent jamais à l'extérieur** : l'envoi de nuit n'envoie que la dernière copie saine. Tant qu'une alerte n'est pas
   levée (une copie saine, ou `copie.sh accepter <instance>` pour une baisse voulue), rien de postérieur à la chute n'est donc envoyé : la dernière copie extérieure reste celle d'avant.
2. **Temps 2, envoi chiffré de nuit hors du serveur** (`restic`, paquet Ubuntu). Chaque nuit, la dernière bonne copie de chaque instance part, avec
   le dernier installateur de chaque site (`installateur-courant/`, gardé par `mise-a-jour.sh`), vers un stockage compatible S3 **chez un autre
   fournisseur que l'hébergeur**, chiffrée avec une phrase de 6 mots que seul le propriétaire garde (décision R275). Gardées : une copie par jour pendant 30
   jours, **une par mois et une par version sans limite**. L'étiquette « version » est posée par l'envoi de nuit qui suit un changement de version, sur la copie de cette nuit : si deux versions se succèdent entre deux nuits, seule la dernière est étiquetée. Réglable : `VERSIONS_DE="prod"` dans `reglages.env` limite les versions gardées à celles de la production (par défaut : `prod dev`). Chaque nuit, le dépôt est contrôlé (le dimanche, une partie des données est relue) ; chaque mois,
   et juste après l'activation, un **essai de restauration** relit la dernière copie extérieure dans un conteneur vide et contrôle l'intégrité et les nombres
   de lignes, sans le propriétaire. L'installateur du site de dev pèse environ 57 Mo parce qu'il emporte le kit de l'atelier (`deploy/installateur/README.md`) : l'envoi de nuit
   grossit d'autant chaque nuit où dev a changé de version (le kit voyage dans la sauvegarde, avant la bascule 2).

**Activer le temps 2.** Il faut un bucket chez le fournisseur et une clé d'accès (identifiant et clé secrète) qui peut y lire et y écrire. La commande
prend adresse, bucket et région (facultative) en arguments, et demande les deux clés, saisies masquées (rien n'est écrit dans un journal, dans `ps` ni dans
git) :

```
sudo sh /srv/maverick-center-test/sauvegarde/installer.sh --stockage --adresse https://s3.exemple.invalid --bucket bucket-exemple --region region-exemple
```

(sans `--adresse`, `--bucket` ni `--region`, la commande pose les questions ; les variables `MAVERICK_SAUV_ADRESSE`, `MAVERICK_SAUV_BUCKET` et
`MAVERICK_SAUV_REGION` font de même. La région est facultative : restic prend celle du stockage ; pour un stockage hors AWS, la région éventuelle est
transmise par `AWS_DEFAULT_REGION`.) Dans l'ordre, elle :

- essaie **tout de suite** le stockage : dépôt existant (la clé de chiffrement l'ouvre-t-elle, l'écriture est-elle permise ?), sinon création du dépôt. Un refus
  donne la cause probable en français (adresse injoignable, certificat, bucket introuvable, clés refusées ou droits insuffisants, région) sans afficher
  aucun secret, avec un code de sortie non nul, et **n'enregistre rien** : le stockage précédent, s'il y en avait un, est gardé ;
- crée la **clé de chiffrement** : six mots tirés au hasard (`/dev/urandom`) dans la liste de 7 776 mots `sauvegarde/mots.txt` (la grande liste de l'EFF
  pour les phrases de passe, licence CC BY 3.0 US), soit 6 × log₂ 7776 ≈ **77,5 bits** d'entropie, bien plus que ce qu'une attaque hors ligne peut essayer ;
  elle l'affiche et demande de la **recopier sur papier** ; elle reste dans `/etc/maverick-sauvegardes/cle-depot` (root, 600, dossier 700) ;
- range les accès au stockage dans `/etc/maverick-sauvegardes/stockage.env` (root, 600), fait un premier envoi, puis un essai de restauration.

La commande est **relançable sans dégât** : elle ne recrée jamais une clé existante, ne réinitialise jamais un dépôt existant, ne redemande rien de ce
qui est en place. Les autres options :

| Option | Effet |
| --- | --- |
| `--afficher-la-cle` | réaffiche la phrase de chiffrement (sur un terminal), tant que le serveur vit |
| `--verifier-le-stockage` | essaie le stockage déjà configuré (joignable, clé acceptée, écriture possible) sans rien ressaisir ni changer |
| `--stockage` | change de stockage (nouvelle adresse, nouveau bucket, nouvelles clés d'accès) ; **la clé de chiffrement et les copies locales sont gardées** |
| `--essai` | lance tout de suite un essai de restauration |
| `--sans-stockage` | ne propose pas le temps 2 |
| `--retirer` | arrête et retire les minuteurs (copies, clés et réglages restent) |

**Changer de stockage (autre bucket, autre fournisseur).** `--stockage` avec les nouvelles valeurs crée un dépôt neuf avec la **même** phrase ; les nuits
suivantes y vont. L'ancien dépôt n'est pas copié tout seul : on garde l'ancien bucket tant qu'on a besoin de son historique (les copies de l'ancien serveur y restent
lisibles avec la même phrase), ou on le reporte dans le nouveau avec `restic copy` (`restic -r <nouveau dépôt> copy --from-repo <ancien dépôt>`, voir la
documentation de restic : les clés d'accès de deux fournisseurs ne tiennent pas dans les mêmes variables `AWS_*`).

**Ce qu'on voit.** La page Debug (Système, alertes) : âge de la dernière copie, place prise et plafond, dernière alerte, dernier envoi, dernier essai de
restauration ; le fichier `/srv/maverick-center/metriques/sauvegardes.json` (sans secret). Sur le serveur :

```
systemctl list-timers 'maverick-sauvegarde-*'                     # dernier et prochain passage
sudo journalctl -u maverick-sauvegarde-horaire -u maverick-sauvegarde-nuit -u maverick-sauvegarde-essai -n 50
sudo ls /srv/maverick-sauvegardes/prod/{horaire,nuit,suspectes}     # les copies locales
sudo sh /srv/maverick-center-test/sauvegarde/copie.sh accepter prod # une chute de lignes voulue devient la référence
```

Les réglages (plafond, nombre de copies, seuil de chute, jours gardés, versions gardées) sont dans `/etc/maverick-sauvegardes/reglages.env` (lignes commentées, valeurs par
défaut dedans ; retirer le `#` d'une ligne suffit, un commentaire de fin de ligne et des guillemets sont admis). Un réglage illisible n'est jamais ignoré en silence : la valeur
par défaut est prise, le journal du minuteur le dit, la page Debug l'affiche et le code de sortie de la copie est 3. La phrase et les accès au stockage ne sont jamais dans le dépôt Git : à la charge du propriétaire, qui garde la phrase sur papier.

**Retour en arrière.** `sudo sh /srv/maverick-center-test/sauvegarde/installer.sh --retirer` arrête les minuteurs. Pour suspendre seulement l'envoi extérieur :
`sudo mv /etc/maverick-sauvegardes/stockage.env{,.arrete}` (le temps 1 continue) ; le remettre le reprend.

**Restaurer** (la base d'une instance abîmée, sur le même serveur) : arrêter le conteneur de l'instance (`docker compose stop serveur`), mettre de côté son
`db/` (`mv db db.abime`), copier le contenu de `db/` de la copie voulue (`/srv/maverick-sauvegardes/<instance>/<horaire|nuit>/<date>/db/`), `docker compose up -d`.
Aucune installation ne touche à `db/`.

**Serveur neuf, ou autre hébergeur** (avec la seule phrase et les accès au stockage ; essayé tous les mois par `essai.sh`, sans le propriétaire).

1. Sur la machine vide (Ubuntu 24.04) : `sudo apt-get install -y restic sqlite3`, puis les étapes 1 à 4 de ce guide (durcir, Docker et Caddy, les deux instances).
2. Dans une session `sudo -i`, sans laisser de trace dans l'historique :
   ```
   export RESTIC_REPOSITORY=s3:https://s3.exemple.invalid/bucket-exemple
   read -rs -p 'Identifiant de clé : ' AWS_ACCESS_KEY_ID; export AWS_ACCESS_KEY_ID; echo
   read -rs -p 'Clé secrète : ' AWS_SECRET_ACCESS_KEY; export AWS_SECRET_ACCESS_KEY; echo
   read -rs -p 'Phrase de chiffrement : ' RESTIC_PASSWORD; export RESTIC_PASSWORD; echo   # les mots séparés par des tirets
   restic snapshots                                  # une ligne par copie : étiquettes inst-prod / inst-dev, nuit, version, V…
   ```
3. Restaurer la dernière copie de chaque instance (ou une autre : l'identifiant de `restic snapshots`, ou `--tag V0.2` pour une version) :
   ```
   restic restore latest --host maverick --tag inst-prod --target /root/restauration/prod
   restic restore latest --host maverick --tag inst-dev  --target /root/restauration/dev
   ```
   Chaque dossier contient la copie (`…/srv/maverick-sauvegardes/<instance>/nuit/<date>/db/`, `comptes.tsv` : le nombre de lignes de chaque table au moment de la copie)
   et `…/<dossier de l'instance>/installateur-courant/` : le dernier installateur du site.
4. Contrôler : `sqlite3 <copie>/db/vivante.db 'PRAGMA integrity_check'` (« ok »).
5. Poser les sites avec leurs installateurs restaurés, qui créent chaque instance (étape 5 de ce guide) :
   `sh …/installateur-courant/maverick-center-<étiquette>-install.sh --dossier /srv/maverick-center` (et `…-test` pour l'autre), puis copier le contenu
   de `db/` de chaque copie dans `db/` de l'instance **avant** le premier `docker compose up -d`, et lancer les conteneurs. Les mots de passe, le `.env` et le jeton GitHub
   ne sont pas dans la copie : étapes 4 à 6 de ce guide.
6. Reprendre les sauvegardes : `sudo sh /srv/maverick-center-test/sauvegarde/installer.sh --stockage --adresse … --bucket …` (une fois la mise à jour automatique en
   place, qui pose `sauvegarde/`). Le dépôt existe déjà : la commande demande sa phrase (les mots en minuscules ou en majuscules, avec des espaces ou des tirets),
   le reprend tel quel sans le réinitialiser et garde la même clé.

**Pourquoi restic** (et non borg ou rclone + age). `restic` est dans les paquets d'Ubuntu 24.04 (0.16.4), parle S3 nativement, est un seul binaire qui se restaure
depuis n'importe quelle machine avec la seule phrase et les accès au stockage, chiffre et déduplique, et a la rétention (`forget`, étiquettes de version),
la vérification (`check`) et le prune. `borg` demande un serveur borg ou SSH (pas de S3 natif sans surcouche) ; `rclone` + `age` copie et chiffre des fichiers,
mais sans instantanés ni rétention ni contrôle : tout serait à écrire. Dans restic 0.16.4, `--keep-monthly -1` est refusé : la valeur illimitée s'écrit
`unlimited` ; « 30 jours » s'écrit `--keep-within-daily 30d` (et non `--keep-daily 30`, qui compterait les 30 derniers jours *qui ont une copie*).

## Atelier du site de dev (mesurer si le serveur tient la fabrication)

Le serveur de test peut fabriquer, après chaque installation, un **site témoin** depuis l'extrait du contenu de la base de dev, dans un conteneur Docker sans réseau, et le comparer au site que GitHub a livré : durée, mémoire, écarts, sur la page
Debug. **Rien de ce qui est servi ne change** ; c'est une mesure (`docs/serveur.md`, « Atelier du site de dev »). Elle se fait en une commande, une fois.

**Quand.** Après qu'une installation du site de dev a posé le kit (`/srv/maverick-center-test/atelier/kit/`, joint à chaque installateur de test) : la page Debug, menu « DB », bloc « Atelier », dit « atelier non installé » avant le geste (le service ne voit encore rien de l'atelier), « pas d'atelier »
si le kit manque (place manquante au moment de la pose) ou en production. Avant cette commande, rien ne tourne et rien ne casse.

**Commande** (en root, sur le serveur) :

```
sudo sh /srv/maverick-center-test/atelier/installer.sh
```

Réglages facultatifs (tailles en `g` ou `m`) : `--memoire-max 2.5g` (plafond du conteneur), `--besoin 1.5g` (en dessous, la fabrication est refusée et mesurée ; le pic mesuré est d'environ 1,4 Go), `--cpus 1`, `--disque-min 2g`, `--delai 1800` (secondes), `--client-google <identifiant>`
(la variable `GOOGLE_CLIENT_ID` du dépôt : sans lui, le bouton « Exporter » est la seule différence entre les deux sites), `--jours-de-mesure 1`, `--max-par-jour 12`, `--dossier-prod /srv/maverick-center`. La commande vérifie root, l'instance de test, Docker, le cgroup v2 et le kit, prépare l'image Docker du kit (téléchargée une fois), pose
`maverick-atelier.path` (qui surveille la marque de l'installateur), `maverick-atelier.service` et `maverick-atelier.slice` (poids bas du processeur et des disques : la production passe devant), écrit ses réglages dans `atelier/reglages.env` (à root) et un `docker-compose.override.yml` dans `/srv/maverick-center-test` (que compose lit de lui-même : le montage des rapports en lecture seule, et celui du dépôt de l'atelier, `atelier/depot/` créé par root, où le service dépose l'extrait du contenu ; le `docker-compose.yml` livré, commun à la production, ne change pas), puis lance **`docker compose up -d`** : cela **relance le service du site de dev quelques
secondes** ; le site reste servi. Un `docker-compose.override.yml` qui n'est pas celui de l'atelier est respecté : la commande s'arrête sans rien écrire et dit quoi faire (`--sans-montage` quand le montage y a été ajouté à la main). Il pose aussi **la journée type** (voir plus bas). Elle lance enfin une première fabrication. Relançable sans dégât (les réglages déjà posés sont repris : une option ne change que la sienne).

**La journée type : la mesure qui décide si le serveur tient.** Le même geste pose deux minuteurs, sans second geste, déclenchés par l'horloge (jamais par le site de dev) : **la nuit à 04:30** (après la sauvegarde de 03:30 ; elle remplace le contrôle de nuit, qui n'arrivera qu'au lot 10) et **le jour, toutes les 20 minutes entre 8 h et 20 h**. Le minuteur du jour n'ajoute une
fabrication que si la fenêtre de mesure est ouverte (`--jours-de-mesure 1`, 1 jour par défaut, compté depuis le geste ou sa relance : relancer la commande rouvre la fenêtre), si la journée en compte moins de 10 (fabrications de toutes origines : la nuit et les livraisons comptent aussi) et si la dernière date de plus de 40 minutes. Le jour compté est le jour UTC : une livraison entre minuit et 1 h ou 2 h, heure de Paris (selon l'heure d'été), compte donc pour la veille. `--max-par-jour 12` plafonne tout (livraisons comprises) : au-delà, plus aucune fabrication ce jour-là, et un rapport court le dit.
`--dossier-prod <dossier>` dit où est la production (par défaut le voisin `/srv/maverick-center`). Pendant chaque fabrication, une **sonde** interroge, une fois par seconde au plus, la page d'accueil et la liste publique des prétirés des deux instances (127.0.0.1, ports lus dans leurs `.env`), avant, pendant et après : elle s'arrête d'elle-même si la production répond mal.
Elle utilise le mot de passe interne que Caddy présente (`/etc/caddy/maverick.env`, à root) ; sans lui, elle ne mesure que nginx et le dit. Ses requêtes portent le User-Agent `maverick-atelier-sonde/1`, que le service ne compte pas dans ses métriques de requêtes (ce texte exact seulement). Après une journée, la page Debug (bloc « Atelier », « Bilan des dernières 24 h ») donne le verdict : **tient**, **tient tout juste**, **ne tient pas** (avec la raison) ou **journée incomplète** (moins de 10 fabrications). C'est ce verdict, avec la taille du serveur,
qui sert à choisir le serveur ; la marche à suivre est de lancer le geste, de laisser passer un jour ouvré, puis de lire ce bilan.

**Ce qu'il doit voir.**
- À la fin de la commande : « Première fabrication lancée » et où regarder ; `systemctl list-units 'maverick-atelier*'` ; `journalctl -u maverick-atelier.service -f` pour le suivi.
- Quelques minutes plus tard, la page Debug : « en cours », puis le rapport (issue, durée, pic de mémoire du conteneur, taille du serveur, écarts avec le site livré) et une phrase « ce serveur tient (ou ne tient pas) la fabrication ». Un refus (mémoire ou disque
  insuffisant) est aussi un rapport : il porte les chiffres relevés. Chaque livraison suivante du site de dev refait une fabrication toute seule, sans geste.
- `sudo sh /srv/maverick-center-test/atelier/installer.sh --etat` : l'état, les derniers rapports, et ce que la mémoire d'aujourd'hui permettrait. Les rapports sont dans `/srv/maverick-center-test/atelier/rapports/`.
- Sur un serveur trop juste (la mémoire disponible laisse un plafond sous 1,5 Go, ou moins de 1 Go ou 25 % de la mémoire totale à la production) la fabrication est refusée : c'est le résultat voulu de la mesure, non une panne.
  Chaque fabrication prend de la place (la dernière sortie, environ 180 Mo, plus le travail le temps de la fabrication) ; l'envoi de nuit de la sauvegarde grossit de la taille du kit à chaque version (voir « Sauvegardes »).

**Retour en arrière.** `sudo sh /srv/maverick-center-test/atelier/installer.sh --retirer` arrête et retire les unités (dont les minuteurs de nuit et du jour), les réglages, les dossiers de travail et les rapports, **supprime le `docker-compose.override.yml` de l'atelier, relance le service quelques secondes** (`docker compose up -d`) puis défait le dépôt ; le kit reste (il revient avec chaque installation). Rien d'autre à défaire : le site, la base et la production ne sont jamais touchés par l'atelier.

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| Certificat HTTPS impossible | `sudo journalctl -u caddy -n 50`. « Timeout during connect (likely firewall problem) » : les ports 80 et 443 sont fermés dans le pare-feu de l'hébergeur (« Avant de commencer », point 3). Sinon, l'adresse ne pointe pas encore vers le serveur (DNS). Une fois corrigé, `sudo systemctl restart caddy` redemande les certificats tout de suite |
| `caddy_legacy_user_removed` dans le journal de Caddy | Sans conséquence : le Caddy 2.6 des paquets Ubuntu ne sait plus demander de certificat de secours à ZeroSSL ; Let's Encrypt suffit |
| 401 sur le site | Les mots de passe de Caddy et de l'instance ne concordent plus : `sudo bash ~/vps/instances.sh --regenerer-acces` puis `docker compose restart` dans les deux dossiers |
| 502 | L'instance n'est pas lancée : `cd /srv/maverick-center && sudo docker compose up -d` (ou `/srv/maverick-center-test` pour `dev.maverick-jdr.com`) |
| « Maintenance en cours » qui ne finit pas | `sudo tail /srv/maverick-center*/mise-a-jour.log` (l'installateur est-il arrivé ?) ; bouton « Lever la maintenance » sur `https://dev.maverick-jdr.com/maintenance/`, sinon elle se lève seule 4 h après le lancement |
| Revenir à une version précédente | Voir [`deploy/installateur/README.md`](../installateur/README.md), « Revenir à une version précédente » (fichier `GELER`) ; sous la migration 0045, « Revenir sous la migration 0045 » (remettre l'archive de la base, copiée à part avant tout) |
| Disque presque plein | Commandes de l'étape 9, puis la liste de [`docs/serveur.md`](../../docs/serveur.md), « Tout ce qui grossit sur le serveur » : restes d'une installation interrompue (`.installation.*`, `.db.copie.*`, `/tmp/maverick-mise-a-jour.*`), installateurs copiés dans `~`, sauvegardes `/root/vivante-*.db`, `sudo docker image prune`, `sudo journalctl --vacuum-size=200M` ; les journaux des conteneurs ne tournent qu'après `docker compose up -d` avec le nouveau `docker-compose.yml` |
| Verrouillé hors du serveur | Console VNC d'Infomaniak (page du serveur) |

# Hébergement sur un serveur (VPS) : serveur normal et serveur de test

Met en place, sur un serveur Ubuntu/Debian neuf (écrits pour Ubuntu 26.04 chez Infomaniak, où ils ont été lancés pour la première fois le 2026-10-10 avec les paquets de la distribution :
Docker 29.1, Caddy 2.6.2 ; `instances.sh` est aussi exécuté par les tests, avec de faux outils), les deux instances décrites dans [`docs/flux-git.md`](../../docs/flux-git.md) :

| | Adresse | Branche | Port interne | Base `db/` |
| --- | --- | --- | --- | --- |
| **Serveur normal** | `https://maverick-jdr.com` | `master` | `127.0.0.1:8080` | `/srv/maverick-center/db`, jamais touchée par une installation |
| **Serveur de test** | `https://dev.maverick-jdr.com` | `dev` | `127.0.0.1:8081` | `/srv/maverick-center-test/db` : copie de celle du normal **à la première installation seulement**, puis **conservée** (`MAVERICK_BASE_TEST=conservee`) |

Le site est posé par les [installateurs](../installateur/README.md) (un par fusion, publiés en *release* GitHub dès la version 0.2.0,
`PREMIERE_VERSION_HEBERGEE` dans `tools/flux-git/regles.mjs`). Caddy fait le HTTPS et aiguille vers l'instance selon l'adresse.

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

> Avant la 0.2.0, il n'y a pas encore d'installateur : voir [« Avant la 0.2.0 »](#avant-la-020--le-serveur-de-test-suit-la-branche-site) plus bas,
> qui remplace les étapes 5 et 6 pour le serveur de test.

1. Dans GitHub, page **Releases** du dépôt (public depuis le 2026-10-14), télécharger les deux fichiers de la dernière version :
   `maverick-center-VX.Y-install.sh` (normal) et `maverick-center-VX.Y.Z-install.sh` (test : la version complète de `dev`).
2. Les copier sur le serveur : `scp -i .ssh\maverick_key maverick-center-*-install.sh ubuntu@<IP>:~/`
3. Sur le serveur, **le normal d'abord** (le test en copie la base) :

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

## 7. Maintenance pendant une mise à jour

Pendant une vraie mise à jour (bouton « Effectuer la mise à jour » du site de dev, pas la simulation), **les deux sites affichent « Maintenance en
cours »** et chacun rouvre de lui-même dès que sa nouvelle version y tourne ([`docs/serveur.md`](../../docs/serveur.md), « Maintenance pendant une
mise à jour »). Le service du serveur de test écrit l'annonce dans `/srv/maverick-center/maintenance/`, que les deux instances montent
(`docker-compose.yml`). À faire une fois, en copiant de nouveau ce dossier sur le serveur (étape 1) :

```
sudo bash ~/vps/instances.sh      # crée /srv/maverick-center/maintenance, pose MAVERICK_DOSSIER_MAINTENANCE dans le .env du test
```

puis, dans chaque dossier d'instance, **une fois que son installateur a posé le nouveau `docker-compose.yml`** (le test après la fusion dans `dev`
qui apporte la maintenance, le normal après la livraison suivante ; l'installateur l'écrit dans `installation.log` : « docker-compose.yml mis à jour
par cette livraison ») :

```
cd /srv/maverick-center-test && sudo docker compose up -d
cd /srv/maverick-center && sudo docker compose up -d
```

Jusque-là, seul le site de dev se met en maintenance. Une maintenance qui ne finit pas (installateur bloqué, fichier `GELER`) : bouton **« Lever la
maintenance (les deux sites) »** sur `https://dev.maverick-jdr.com/maintenance/` ; elle se lève d'elle-même 4 h après le lancement.

## 8. Métriques et espace disque

Le service de chaque instance mesure ses temps de réponse, ses pages et le serveur ([`docs/serveur.md`](../../docs/serveur.md), « Métriques et
volume » ; la page Debug du site de dev les montre). **Deux jeux de données séparés** (décision du propriétaire) : `prod.db` pour le serveur normal,
`dev.db` pour le serveur de test, côte à côte dans `/srv/maverick-center/metriques/`, que les deux instances montent ; chacune n'écrit que le sien,
le site de dev lit aussi celui de la production. Hors de `db/` : l'installateur de test ne les copie ni ne les efface. À faire une fois, en copiant
de nouveau ce dossier sur le serveur (étape 1) :

```
sudo bash ~/vps/instances.sh      # crée /srv/maverick-center/metriques, pose MAVERICK_INSTANCE et MAVERICK_DOSSIER_METRIQUES dans les deux .env,
                                  # installe volume.sh et son minuteur (maverick-volume.timer)
```

puis, comme pour la maintenance, `sudo docker compose up -d` dans chaque dossier d'instance **une fois que son installateur a posé le nouveau
`docker-compose.yml`**. Ce même `docker compose up -d` applique la **rotation des journaux des conteneurs** (5 fichiers de 10 Mo au plus par
conteneur ; avant, `docker logs` grossissait sans fin). La mesure des pages par le navigateur est active sur les deux sites ; pour la couper sur
une instance : `MAVERICK_METRIQUES_PAGES=0` dans son `.env`, puis `sudo docker compose up -d`.

**Jauge de l'espace disque** (page Debug du site de dev, demande du propriétaire) : chaque service mesure ce qu'il voit de son conteneur ; le
reste (l'autre instance, Docker, les journaux, les restes d'installation) est mesuré depuis le serveur par `volume.sh`, que `instances.sh` installe
dans `/usr/local/lib/maverick-center/` avec le minuteur systemd `maverick-volume.timer` : toutes les 15 minutes, en lecture seule et à basse
priorité, il écrit `/srv/maverick-center/metriques/volume-hote.json` ([`docs/serveur.md`](../../docs/serveur.md), « Jauge de l'espace disque »).
Après une copie plus récente de ce dossier, relancer `instances.sh` reprend le script.

**Espace libre** : tout ce qui grossit sur le serveur, combien et jusqu'où, est dans [`docs/serveur.md`](../../docs/serveur.md), « Tout ce qui
grossit sur le serveur ». L'essentiel :

```
df -h /                                                         # espace libre du disque
sudo cat /srv/maverick-center/metriques/volume-hote.json        # répartition par type de données (dernier relevé)
systemctl list-timers maverick-volume.timer                     # dernier et prochain relevé
sudo du -sh /srv/maverick-center*/{site,db,metriques} 2>/dev/null
sudo docker system df                                           # images, conteneurs, journaux compris
```

## 9. Export vers Google Sheets (identifiant client OAuth)

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

## Avant la 0.2.0 : le serveur de test suit la branche `site`

Tant que `dev` est en 0.1.x, il n'y a ni installateur ni *release* : après chaque fusion dans `dev`, le bot publie le site construit sur la
branche **`site`** ([`docs/flux-git.md`](../../docs/flux-git.md)). Le serveur de test peut déjà la suivre avec le script qui sert au NAS,
[`update-site.sh`](../update-site.sh), **à la place des étapes 5 et 6**. Les étapes 1 à 4 restent les mêmes, en copiant tout le dossier `deploy`
(`scp -i .ssh\maverick_key -r deploy ubuntu@<IP>:~/` ; les scripts sont alors dans `~/deploy/vps/`).

1. **Poser l'instance de test** (son `.env` et son `.htpasswd` viennent de `instances.sh`) :

   ```
   cd /srv/maverick-center-test
   sudo cp ~/deploy/installateur/docker-compose.yml ~/deploy/nginx.conf ~/deploy/update-site.sh .
   echo "mode=test" | sudo tee VERSION     # l'installateur 0.2.0-test reconnaîtra ce dossier plus tard
   ```

2. **Jeton GitHub** en lecture seule (le même qu'à l'étape 6 : dépôt `MaverickCenter` seulement, *Contents : Read-only*), **déposé directement sur
   le serveur**. Depuis votre ordinateur (invite de commandes ou PowerShell) : lancer la commande, coller le jeton, puis Entrée. Il ne s'affiche
   pas et n'entre dans aucun historique.

   ```
   ssh -t -i .ssh\maverick_key ubuntu@<IP> "sudo sh -c 'umask 077; stty -echo; head -n 1 > /srv/maverick-center-test/.github-token; stty echo; chmod 600 /srv/maverick-center-test/.github-token; echo; echo Jeton enregistre'"
   ```

3. **Premier téléchargement, puis les conteneurs** :

   ```
   sudo sh update-site.sh                  # pose la branche site dans site/ (journal : update.log)
   sudo docker compose up -d
   ```

4. **Mise à jour automatique** toutes les 2 minutes (la commande peut être relancée : pas de doublon) :

   ```
   (sudo crontab -l 2>/dev/null | grep -v maverick-center-test/update-site.sh; echo '*/2 * * * * sh /srv/maverick-center-test/update-site.sh >/dev/null 2>&1') | sudo crontab -
   ```

5. **Mode modification** (crayon sur les pages du guide, des races, des magies, des classes et des métiers ; [`docs/serveur.md`](../../docs/serveur.md),
   « Édition ») : `instances.sh` pose `MAVERICK_EDITION=1` dans le `.env` du serveur de test. Sur une instance de test posée avant ce réglage,
   reprendre le `docker-compose.yml` (qui le transmet au service) puis relancer les conteneurs :

   ```
   sudo bash ~/deploy/vps/instances.sh                    # sûr à relancer : ajoute MAVERICK_EDITION=1 au .env du test
   cd /srv/maverick-center-test && sudo cp ~/deploy/installateur/docker-compose.yml . && sudo docker compose up -d
   ```

   Le serveur normal n'a jamais ce réglage : ses pages ne se modifient pas.

6. **Page Mise à jour** (bouton « Effectuer la mise à jour » ; [`docs/serveur.md`](../../docs/serveur.md), « Mise à jour ») : relancer
   `instances.sh` et reprendre le `docker-compose.yml` comme au point 5 (ils posent `MAVERICK_ADRESSE_PUBLIQUE` et le dossier `secrets/`), puis
   deux jetons, **jamais dans une conversation ni dans git** :

   - **dans GitHub** (une fois pour le dépôt) : *Settings → Developer settings → Fine-grained tokens*, un jeton d'un administrateur du dépôt,
     dépôt `MaverickCenter` seulement, permissions *Contents*, *Pull requests* et *Workflows* en lecture et écriture ; l'enregistrer dans le
     dépôt, *Settings → Secrets and variables → Actions → New repository secret*, sous le nom **`MISE_A_JOUR_TOKEN`**. C'est lui qui pousse la
     branche, ouvre et fusionne les deux PR (le jeton d'un workflow ne déclencherait ni la CI ni la livraison) ; seul le job `livrer` du
     workflow le reçoit, sans npm ni dépendance (le job `preparer`, qui lance les tests, n'a aucun secret) ;
   - **sur le serveur** : un second jeton fine-grained, dépôt `MaverickCenter` seulement, permission *Actions* en lecture et écriture (rien
     d'autre : il ne fait que lancer et suivre le workflow). Depuis votre ordinateur, lancer la commande, coller le jeton, puis Entrée :

   ```
   ssh -t -i .ssh\maverick_key ubuntu@<IP> "sudo sh -c 'umask 077; stty -echo; head -n 1 > /srv/maverick-center-test/secrets/github-actions-token; stty echo; chmod 600 /srv/maverick-center-test/secrets/github-actions-token; echo; echo Jeton enregistre'"
   ```

   Le service relit le fichier à chaque lancement : rien à redémarrer. Sans ce fichier, la page donne les valeurs pour lancer le workflow à la
   main (*Actions → Mise à jour des règles → Run workflow*, branche `dev`, case « essai » cochée pour une simulation, décochée sinon : le
   workflow refuse un lot figé pour l'autre mode). Attention : la **première** mise à jour fait la livraison 0.2.0 (« Le jour de la 0.2.0 »
   ci-dessous) ; lancer d'abord une **« Simulation de mise à jour »** (bouton à côté) : sur GitHub, le lot est rejoué sur `dev` et passe tous
   les contrôles de la CI, puis le job `livrer` vérifie le commit, son application sur `dev` et le jeton (écriture par un `git push --dry-run`,
   lecture des PR) ; rien n'est poussé. Seuls les droits *Pull requests* et *Workflows* en écriture du jeton ne peuvent pas se vérifier sans
   effet de bord (le résumé du run le rappelle).

Ce qui diffère d'un serveur installé à partir de la 0.2.0 :

- **Pas de bandeau « Serveur de dev »** sur `https://dev.maverick-jdr.com` : la branche `site` est le site unique, construit sans le mode test.
  Le bandeau arrive avec l'installateur de test.
- **`https://maverick-jdr.com` répond 502** tant que le serveur normal n'est pas installé (Caddy est prêt, l'instance n'existe pas encore) : c'est attendu.
- `sudo docker ps` montre 2 conteneurs (`maverick-center-test` et `maverick-center-test-serveur`), pas 4.
- `db/` est créé au premier lancement, sans fiche. Il est conservé ensuite, y compris par l'installateur de test (`MAVERICK_BASE_TEST=conservee`).

**Le jour de la 0.2.0** : installer le serveur normal puis le serveur de test (étape 5), retirer la ligne `update-site.sh` de `sudo crontab -e`
et la remplacer par celles de l'étape 6 (`mise-a-jour.sh`). La branche `site` cesse alors d'avancer.

## Vérifier

```
curl -sI https://maverick-jdr.com | head -n 3             # HTTP/2 200
curl -sI https://dev.maverick-jdr.com | head -n 3         # HTTP/2 200, cache-control: no-store
curl -s https://maverick-jdr.com/robots.txt               # Disallow: /
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://<IP>:8080/   # doit échouer : le port est fermé de l'extérieur
sudo docker ps                                            # les 4 conteneurs (nginx et service, normal et test)
sudo systemctl status caddy
df -h /                                                   # espace libre (étape 8)
```

## Sauvegardes (à faire avant d'y mettre de vraies données)

`db/` de chaque instance est la seule donnée qui ne se reconstruit pas (voir [`docs/serveur.md`](../../docs/serveur.md)). En attendant une sauvegarde
automatique vers un stockage extérieur (prochaine étape) :

```
sudo sqlite3 /srv/maverick-center/db/vivante.db ".backup /root/vivante-$(date +%F).db"
```

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| Certificat HTTPS impossible | `sudo journalctl -u caddy -n 50`. « Timeout during connect (likely firewall problem) » : les ports 80 et 443 sont fermés dans le pare-feu de l'hébergeur (« Avant de commencer », point 3). Sinon, l'adresse ne pointe pas encore vers le serveur (DNS). Une fois corrigé, `sudo systemctl restart caddy` redemande les certificats tout de suite |
| `caddy_legacy_user_removed` dans le journal de Caddy | Sans conséquence : le Caddy 2.6 des paquets Ubuntu ne sait plus demander de certificat de secours à ZeroSSL ; Let's Encrypt suffit |
| 401 sur le site | Les mots de passe de Caddy et de l'instance ne concordent plus : `sudo bash ~/vps/instances.sh --regenerer-acces` puis `docker compose restart` dans les deux dossiers |
| 502 | L'instance n'est pas lancée : `cd /srv/maverick-center && sudo docker compose up -d` (avant la 0.2.0, c'est la réponse attendue de `maverick-jdr.com` : le serveur normal n'existe pas encore) |
| « Maintenance en cours » qui ne finit pas | `sudo tail /srv/maverick-center*/mise-a-jour.log` (l'installateur est-il arrivé ?) ; bouton « Lever la maintenance » sur `https://dev.maverick-jdr.com/maintenance/`, sinon elle se lève seule 4 h après le lancement |
| Revenir à une version précédente | Voir [`deploy/installateur/README.md`](../installateur/README.md), « Revenir à une version précédente » (fichier `GELER`) ; sous la migration 0045, « Revenir sous la migration 0045 » (remettre l'archive de la base, copiée à part avant tout) |
| Disque presque plein | Commandes de l'étape 8, puis la liste de [`docs/serveur.md`](../../docs/serveur.md), « Tout ce qui grossit sur le serveur » : restes d'une installation interrompue (`.installation.*`, `.db.copie.*`, `/tmp/maverick-mise-a-jour.*`), installateurs copiés dans `~`, sauvegardes `/root/vivante-*.db`, `sudo docker image prune`, `sudo journalctl --vacuum-size=200M` ; les journaux des conteneurs ne tournent qu'après `docker compose up -d` avec le nouveau `docker-compose.yml` |
| Verrouillé hors du serveur | Console VNC d'Infomaniak (page du serveur) |

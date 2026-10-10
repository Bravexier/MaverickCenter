# Hébergement sur un serveur (VPS) : serveur normal et serveur de test

Met en place, sur un serveur Ubuntu/Debian neuf (écrits pour Ubuntu 26.04 chez Infomaniak ; contrôlés ici — syntaxe, `instances.sh` exécuté avec de faux outils — mais **pas encore lancés sur le vrai serveur** :
le premier lancement est le vrai test), les deux instances décrites dans [`docs/flux-git.md`](../../docs/flux-git.md) :

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
| `instances.sh` | Les deux dossiers d'instance (`.env` avec ports sur `127.0.0.1`), mots de passe internes, `Caddyfile` et son environnement |
| `Caddyfile` | `maverick-jdr.com` → 8080, `dev.maverick-jdr.com` → 8081, `www.` → domaine principal |

## Avant de commencer

1. **DNS** (OVH, zone de `maverick-jdr.com`) : des enregistrements **A** (IPv4) et **AAAA** (IPv6) vers le serveur pour le domaine lui-même, `www` et **`dev`**.
   Caddy obtient son certificat HTTPS seulement quand l'adresse pointe vers le serveur (sinon il réessaie sans succès).
2. **Accès SSH par clé** au serveur (compte `ubuntu` chez Infomaniak). Le pare-feu d'Infomaniak peut rester tel quel ; `durcir.sh` règle celui du serveur.
3. Ces fichiers sur votre ordinateur (cloner le dépôt, ou télécharger la branche en zip).

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
Le script refuse de désactiver le mot de passe s'il ne trouve aucune clé installée.

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

1. Dans GitHub, page **Releases** du dépôt (privé : connexion nécessaire), télécharger les deux fichiers de la dernière version :
   `maverick-center-vX.Y.Z-install.sh` (normal) et `maverick-center-vX.Y.Z-test-install.sh` (test).
2. Les copier sur le serveur : `scp -i .ssh\maverick_key maverick-center-*-install.sh ubuntu@<IP>:~/`
3. Sur le serveur, **le normal d'abord** (le test en copie la base) :

```
sudo sh ~/maverick-center-vX.Y.Z-install.sh --dossier /srv/maverick-center
sudo sh ~/maverick-center-vX.Y.Z-test-install.sh --dossier /srv/maverick-center-test
cd /srv/maverick-center && sudo docker compose up -d
cd /srv/maverick-center-test && sudo docker compose up -d
```

Ouvrir `https://maverick-jdr.com` et `https://dev.maverick-jdr.com` (bandeau « Serveur de test »).

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
   le serveur**. Lancer la commande, coller le jeton, puis Entrée : il ne s'affiche pas et n'entre pas dans l'historique.

   ```
   sudo sh -c 'f=/srv/maverick-center-test/.github-token; umask 077; stty -echo; read -r t; stty echo; printf %s "$t" > "$f"; chmod 600 "$f"'
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

Ce qui diffère d'un serveur installé à partir de la 0.2.0 :

- **Pas de bandeau « Serveur de test »** sur `https://dev.maverick-jdr.com` : la branche `site` est le site unique, construit sans le mode test.
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
| Certificat HTTPS impossible | L'adresse ne pointe pas encore vers le serveur (DNS) : `sudo journalctl -u caddy -n 50` |
| 401 sur le site | Les mots de passe de Caddy et de l'instance ne concordent plus : `sudo bash ~/vps/instances.sh --regenerer-acces` puis `docker compose restart` dans les deux dossiers |
| 502 | L'instance n'est pas lancée : `cd /srv/maverick-center && sudo docker compose up -d` (avant la 0.2.0, c'est la réponse attendue de `maverick-jdr.com` : le serveur normal n'existe pas encore) |
| Revenir à une version précédente | Voir [`deploy/installateur/README.md`](../installateur/README.md), « Revenir à une version précédente » (fichier `GELER`) |
| Verrouillé hors du serveur | Console VNC d'Infomaniak (page du serveur) |
